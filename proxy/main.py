import uuid
from base64 import b64decode
from typing import Any, cast

import aiohttp
import aiohttp_cors
import msgpack
from aiohttp import web

from client import InvalidCredentials, StudentVue

MISSING = cast(Any, None)

routes = web.RouteTableDef()
scrapers = web.AppKey('scrapers', dict[str, 'StudentVueScraper'])


class StudentVueScraper(StudentVue):
    """Scrapes new StudentVUE website for student grades and assignments."""

    def __init__(
        self,
        *,
        session: aiohttp.ClientSession,
        host: str,
        username: str,
        password: str,
    ) -> None:
        super().__init__(
            host=host,
            username=username,
            password=password,
            session=session,
        )

        self.student_info: dict[str, Any] = MISSING
        self.photo: bytes = MISSING
        self.reporting_periods: list[dict[str, Any]] = MISSING
        self.courses: dict[int, list[dict[str, Any]]] = {}  # lookup by reporting period idx
        self._default_reporting_period_idx: int = 0

    @property
    def serializable_courses(self) -> dict[str, list[dict[str, Any]]]:
        return {str(k): v for k, v in self.courses.items()}

    async def login(self) -> dict[str, Any]:
        self.invalidate_cache()
        student_info = (await self.get_student_info())['StudentInfo']
        self.student_info = self._sanitize_student_info(student_info)
        self.photo = b64decode(student_info['Photo']['$'])
        self._default_reporting_period_idx = await self.load_gradebook(respect_cache=False)
        return {
            'student': self.student_info,
            'gradingPeriods': self.reporting_periods,
            'defaultGradingPeriod': self._default_reporting_period_idx,
            'courses': self.serializable_courses,
        }

    async def load_gradebook(self, idx: int = None, *, respect_cache: bool = True) -> int:
        if respect_cache and len(self.courses) and idx in self.courses:
            return idx

        gradebook = await self.get_gradebook(idx)
        if self.reporting_periods is None:
            self.reporting_periods = [
                {
                    'id': i,
                    'name': r['@GradePeriod'],
                    'startDate': r['@StartDate'],
                    'endDate': r['@EndDate'],
                }
                for i, r in enumerate(gradebook['ReportingPeriods']['ReportPeriod'])
            ]

        name = gradebook['ReportingPeriod']['@GradePeriod']
        idx = next(idx for idx, pd in enumerate(self.reporting_periods) if pd['name'] == name)
        self.courses[idx] = [self._sanitize_course(c) for c in gradebook['Courses']['Course']]
        return idx

    async def fetch_courses(self, gp: int) -> list[dict[str, Any]]:
        await self.load_gradebook(gp)
        return self.courses[gp]

    def _sanitize_course(self, raw: dict[str, Any]) -> dict[str, Any]:
        marks = raw['Marks']['Mark']
        weights = marks['GradeCalculationSummary'].get('AssignmentGradeCalc', [])
        assignments = marks['Assignments'].get('Assignment', [])
        if not isinstance(assignments, list):
            assignments = [assignments]
        return {
            'classId': hash(raw['@Title']) >> 6,  # there is no actual ID provided, so just hash the name for now
            'period': raw['@Period'],
            'name': raw['@Title'],  # if MCPS, this is "Name (Course ID)"
            'teacher': raw['@Staff'],
            'room': raw['@Room'],
            'assignments': [self._sanitize_assignment(a) for a in assignments],
            'weights': [
                {
                    'name': w['@Type'],
                    'weight': float(w['@Weight'].removesuffix('%')) / 100,
                    'points': float(w['@Points']),
                    'maxPoints': float(w['@PointsPossible']),
                    'mark': w['@CalculatedMark'],
                }
                for w in weights
            ]
        }

    @staticmethod
    def _sanitize_assignment(raw: dict[str, Any]) -> dict[str, Any]:
        if raw['@Points'].endswith('Points Possible') or raw.get('@Score') == 'Not Graded':
            max_score = float(raw['@Points'].removesuffix(' Points Possible'))
            score = None
        else:
            try:
                score, max_score = raw['@Points'].split(' / ')
                score, max_score = float(score), float(max_score)
            except ValueError:
                score = max_score = None
        return {
            'gradebookId': raw['@GradebookID'],
            'name': raw['@Measure'],
            'type': raw['@Type'],
            'date': raw['@Date'],
            'dueDate': raw['@DueDate'],
            'score': score,
            'maxScore': max_score,
            'description': raw['@MeasureDescription'],
            'notForGrading': raw.get('@Notes') == '(Not For Grading)',
        }

    async def fetch_schedule(self, term_index: int = None) -> dict[str, Any]:
        raw = (await self.get_schedule(term_index))['StudentClassSchedule']
        today = raw['TodayScheduleInfoData']
        schedule = today['SchoolInfos'].get('SchoolInfo', None)

        return {
            'termName': raw['@TermIndexName'],
            'today': schedule and {
                'date': today['@Date'],
                'school': schedule['@SchoolName'],
                'scheduleName': schedule['@BellSchedName'],
                'timeBlocks': [
                    {
                        'period': period['@Period'],
                        'startTime': period['@StartTime'],
                        'endTime': period['@EndTime'],
                    }
                    for period in schedule['Classes']['ClassInfo']
                ],
            },
            'classes': [
                {
                    'period': c['@Period'],
                    'name': c['@CourseTitle'],
                    'room': c['@RoomName'],
                    'teacher': c['@Teacher'],
                }
                for c in raw['ClassLists']['ClassListing']
            ],
            'terms': [
                {
                    'index': term['@TermIndex'],
                    'name': term['@TermName'],
                    'beginDate': term['@BeginDate'],
                    'endDate': term['@EndDate'],
                }
                for term in raw['TermLists']['TermListing']
            ]
        }

    @staticmethod
    def _sanitize_student_info(raw: dict[str, Any]) -> dict[str, Any]:
        return {
            'id': raw['PermID']['$'],
            'fullName': raw['FormattedName']['$'],
            'name': raw['NickName']['$'],
            'grade': raw['Grade']['$'],
            'school': raw['CurrentSchool']['$'],
        }

    def invalidate_cache(self) -> None:
        self.courses.clear()
        self.student_info = self.reporting_periods = MISSING

    async def close(self) -> None:
        await self.session.close()


@routes.get('/')
async def hello(_: web.Request) -> web.Response:
    return web.Response(text='Hello, world!')


@routes.post('/login')
async def login(request: web.Request) -> web.Response:
    data = await request.json()
    pick = ('username', 'password', 'host')

    params: dict[str, str] = MISSING
    try:
        params = {key: data[key] for key in pick}
    except KeyError:
        invalid = True
    else:
        invalid = any(not isinstance(val, str) for val in params.values())
    if invalid:
        return web.Response(
            text='Must provide three strings "username", "password", and "host"',
            status=400,
        )

    scraper = StudentVueScraper(session=aiohttp.ClientSession(), **params)
    try:
        res = await scraper.login()
    except InvalidCredentials:
        return web.Response(text='Invalid credentials', status=401)
    token = uuid.uuid4().hex

    request.app[scrapers][token] = scraper
    out = msgpack.dumps({'token': token, **res})
    return web.Response(body=out)


def auth(request: web.Request) -> StudentVueScraper:
    token = request.headers.get('Authorization')
    if not token:
        raise web.HTTPUnauthorized(text='Missing token')

    if t := request.app[scrapers].get(token):
        if 'X-Invalidate-Cache' in request.headers:
            t.invalidate_cache()
        return t

    raise web.HTTPUnauthorized(text='Invalid token')


@routes.post('/refresh')
async def refresh_login(request: web.Request) -> web.Response:
    scraper = auth(request)
    try:
        res = await scraper.login()
    except web.HTTPUnauthorized:
        token = request.headers['Authorization']
        await scraper.close()
        del request.app[scrapers][token]
        raise

    out = msgpack.dumps(res)
    return web.Response(body=out)


@routes.get('/grades')
async def get_grades(request: web.Request) -> web.Response:
    scraper = auth(request)
    await scraper.load_gradebook(respect_cache=False)
    out = msgpack.dumps({
        'courses': scraper.serializable_courses,
        'gradingPeriods': scraper.reporting_periods,
        'defaultGradingPeriod': scraper._default_reporting_period_idx,
    })
    return web.Response(body=out)


@routes.get('/grades/{grading_period}')
async def get_grades_for_reporting_period(request: web.Request) -> web.Response:
    scraper = auth(request)
    try:
        grading_period = int(request.match_info['grading_period'])
        if not 0 <= grading_period < len(scraper.reporting_periods):
            raise ValueError
    except ValueError:
        return web.Response(text='invalid grading period', status=400)

    await scraper.load_gradebook(grading_period)
    try:
        out = msgpack.dumps(scraper.courses[grading_period])
    except IndexError:
        return web.Response(text='invalid grading period', status=400)
    return web.Response(body=out)


@routes.get('/schedule')
async def get_current_schedule(request: web.Request) -> web.Response:
    scraper = auth(request)
    schedule = await scraper.fetch_schedule()
    return web.Response(body=msgpack.dumps(schedule))


@routes.get('/schedule/{term_index}')
async def get_schedule(request: web.Request) -> web.Response:
    scraper = auth(request)
    try:
        term_index = int(request.match_info['term_index'])
    except ValueError:
        return web.Response(text='invalid term index', status=400)

    schedule = await scraper.fetch_schedule(term_index)
    return web.Response(body=msgpack.dumps(schedule))


@routes.get('/photo')
async def get_photo(request: web.Request) -> web.Response:
    scraper = auth(request)
    return web.Response(body=scraper.photo, content_type='image/png')


if __name__ == '__main__':
    app = web.Application()
    app[scrapers] = {}
    app.add_routes(routes)

    cors = aiohttp_cors.setup(app, defaults={
        '*': aiohttp_cors.ResourceOptions(
            allow_credentials=True,
            expose_headers='*',
            allow_headers='*',
        ),
    })
    for route in list(app.router.routes()):
        cors.add(route)

    web.run_app(app, port=8051)
