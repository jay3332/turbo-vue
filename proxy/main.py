import asyncio
import functools
import json
import re
import uuid
from typing import Any, Literal, cast

import aiohttp
import aiohttp_cors
import bs4
import msgpack
from aiohttp import web
from aiohttp.client import _RequestContextManager

MISSING = cast(Any, None)
REPLACE_PXP = re.compile(r'(?<=:)PXP\.\w+\.\w+(?=[,}\]])')

METADATA_JSON = {"FriendlyName": "genericdata.classdata", "Method": "GetClassData", "Parameters": "{}"}
# irrelevant keys to remove (save bandwidth)
METADATA_REMOVE_KEYS = (
    'analysisBands',
    'applyRigorPoints',
    'gradeBookScoreTypes',
    'isAssignmentWeightingOn',
    'isPostWindowOpen',
    'markRoundingOn',
    'markRoundingPlaces',
    'markType',
    'percentageRoundingOn',
    'percentageRoundingPlaces',
    'rigorPoints',
    'standardsAssignments',
    'standardsEvidence',
    'standardsModeAssignmentScorePreference',
    'termWeighting',
    'termWeightingClassGrades',
    'useTeachersOverrideMarkValueInTermWeighting',
)
# general metadata keys (rather than course-specific)
METADATA_GENERAL_KEYS = ('comments', 'measureTypes', 'reportCardScoreTypes', 'students')

routes = web.RouteTableDef()
scrapers = web.AppKey('scrapers', dict[str, 'StudentVueScraper'])


class StudentVueScraper:
    """Scrapes new StudentVUE website for student grades and assignments."""

    def __init__(self, *, session: aiohttp.ClientSession, host: str, username: str, password: str) -> None:
        self.host: str = host
        self.session: aiohttp.ClientSession = session

        self.cookies: aiohttp.CookieJar = MISSING
        self._gradebooks: dict[str, bs4.BeautifulSoup] = {}
        self._html: str = MISSING

        self._course_focus_data: dict[tuple[str, int], dict[str, Any]] = {}
        self._course_data: dict[tuple[str, int], dict[str, Any]] = {}
        self.general_course_metadata: dict[str, Any] = MISSING

        self.student_info: dict[str, Any] = MISSING
        self.student_image: bytes | None = None

        self._login_params = {
            'ctl00$MainContent$username': username,
            'ctl00$MainContent$password': password,
            'ctl00$MainContent$btnLogin': 'Login',
        }

    @staticmethod
    def _find_token(scraper: bs4.BeautifulSoup, id: str) -> str:
        return scraper.find('input', id=id)['value']

    async def login(self) -> None:
        self.invalidate_cache()
        async with self.get(path := '/PXP2_Login_Student.aspx?regenerateSessionId=True') as response:
            self._html = await response.text()

        # Fast enough that it shouldn't block
        scraper = bs4.BeautifulSoup(self._html, 'lxml')
        get = functools.partial(self._find_token, scraper)
        payload = {
            '__VIEWSTATE': get('__VIEWSTATE'),
            '__VIEWSTATEGENERATOR': get('__VIEWSTATEGENERATOR'),
            '__EVENTVALIDATION': get('__EVENTVALIDATION'),
            **self._login_params,
        }
        async with self.post(path, data=payload) as response:
            html = await response.text()
            if 'ctl00_MainContent_ERROR' in html:
                raise web.HTTPUnauthorized(text='Invalid credentials')
            self.cookies = response.cookies

        headers = {'Current_web_portal': 'StudentVUE'}
        async with self.post('/PXP2_GradeBook.aspx?AGU=0', headers=headers) as response:
            html = await response.text()
            self._register_focus_data(html)
            self.default_grading_period = gu = next(g['GU'] for g in self.grading_periods.values() if g['defaultFocus'])
            self._register_gradebook(html, gu)

    def _register_gradebook(self, html: str, gu: str) -> None:
        self._gradebooks[gu] = bs4.BeautifulSoup(html, 'lxml')

    def _register_focus_data(self, html: str) -> None:
        _, rest = html.split('PXP.GBFocusData = ', maxsplit=1)
        raw, rest = rest.split('\n', maxsplit=1)
        self.grading_periods: dict[str, dict[str, Any]] = {
            record['GU']: record for record in json.loads(raw.removesuffix(';'))['GradingPeriods']
        }

        # _, rest = html.split('PXP.GBCurrentFocus = ', maxsplit=1)
        # raw, _ = rest.split('\n', maxsplit=1)
        # self._base_gp_focus_payload: dict[str, Any] = json.loads(raw.removesuffix(';'))['FocusArgs']

    @staticmethod
    def _create_gp_focus_payload(grading_period: dict[str, Any]) -> dict[str, str | int]:
        return {
            'AGU': 0,
            'GradingPeriodGroup': grading_period['GroupName'],
            'OrgYearGU': grading_period['OrgYearGU'],
            'gradePeriodGU': grading_period['GU'],
            'schoolID': grading_period['schoolID'],
        }

    async def fetch_gradebook(self, grading_period: str) -> bs4.BeautifulSoup:
        if gradebook := self._gradebooks.get(grading_period):
            return gradebook

        payload = {
            'control': 'Gradebook_SchoolClasses',
            'parameters': self._create_gp_focus_payload(self.grading_periods[grading_period]),
        }
        async with self.post('/service/PXP2Communication.asmx/LoadControl', json=payload) as response:
            data = await response.json()
            self._register_gradebook(data['d']['Data']['html'], grading_period)
        return self._gradebooks[grading_period]

    async def fetch_courses_metadata(self, grading_period: str) -> list[dict[str, Any]]:
        gp_data = self.grading_periods[grading_period]
        payload = {
            "request": {
                "gradingPeriodGU": grading_period,
                "AGU": '0',
                "orgYearGU": gp_data['OrgYearGU'],
                "schoolID": gp_data['schoolID'],
                "markPeriodGU": gp_data['MarkPeriods'][0]['GU'],
            }
        }
        async with self.post('/service/PXP2Communication.asmx/GradebookFocusClassInfo', json=payload) as response:
            data = await response.json()
            courses = data['d']['Data']['Classes']

        await self._scrape_course_preview(grading_period, courses)
        return courses

    async def _scrape_course_preview(self, grading_period: str, courses: list[dict[str, Any]]) -> None:
        gradebook = await self.fetch_gradebook(grading_period)
        for course in courses:
            course_id = course['ID']
            div = gradebook.find('div', {'data-guid': str(course_id)})
            course['room'] = div.find('div', class_='teacher-room').text.removeprefix('Room: ')

            if (grading_period, course_id) not in self._course_focus_data:
                btn = div.find('button', {'data-focus': True})
                self._course_focus_data[grading_period, course_id] = json.loads(btn['data-focus'])

            div = gradebook.find('div', {'data-guid': str(course_id), 'data-mark-gu': True})
            course['markPreview'] = div.find('span', class_='mark').text
            course['scorePreview'] = div.find('span', class_='score').text

    async def fetch_grading_policy(self) -> dict[str, Any]:
        async with self.post(
            '/api/GB/ClientSideData/Transfer?action=genericdata.classdata-GetClassData',
            json=METADATA_JSON,
            headers={'Current_web_portal': 'StudentVUE'}
        ) as response:
            data = await response.json()

        for key in METADATA_REMOVE_KEYS:
            data.pop(key, None)

        metadata = {}
        for key in METADATA_GENERAL_KEYS:
            metadata[key] = data.pop(key, None)

        if self.general_course_metadata is MISSING:
            self.general_course_metadata = metadata
        metadata['defaultReportCardScoreTypeId'] = data['classGrades'][0]['reportCardScoreTypeId']
        return data

    async def fetch_course_data(self, grading_period: str, course_id: int) -> dict[str, Any]:
        if course_data := self._course_data.get((grading_period, course_id)):
            if 'assignments' in course_data:
                return course_data

        key = grading_period, course_id
        if key not in self._course_focus_data:
            await self.fetch_courses_metadata(grading_period)

        focus_data = self._course_focus_data[key]
        payload = {
            "control": 'Gradebook_ClassDetails',
            "parameters": focus_data['FocusArgs'],
        }
        async with self.post(
            '/service/PXP2Communication.asmx/LoadControl',
            json={"request": payload},
            headers={
                'Current_web_portal': 'StudentVUE',
                'Referer': self.host + '/PXP2_GradeBook.aspx?AGU=0',
            }
        ) as response:
            data = await response.json()
            course_html: str = data['d']['Data']['html']

        _, rest = course_html.rsplit('.dxDataGrid(PXP.DevExpress.ExtendGridConfiguration(', maxsplit=1)
        raw, _ = rest.split('\n', maxsplit=1)

        assignment_lookup = {
            int(record['gradeBookId']): json.loads(record['GBAssignment'])['value']
            for record in json.loads(REPLACE_PXP.sub('""', raw.rstrip(');\r')))['dataSource']
        }

        course_data = await self.fetch_grading_policy()
        assignments = course_data['assignments']
        for assignment in assignments:
            if name := assignment_lookup.get(assignment['gradeBookId']):
                assignment['name'] = name
            else:
                # TODO: use logging
                print('Missing assignment:', assignment['gradeBookId'])

        self._course_data[grading_period, course_id] = course_data
        return course_data

    async def fetch_all_courses(self, grading_period: str) -> list[dict[str, Any]]:  # Slow query
        courses = await self.fetch_courses_metadata(grading_period)
        tasks = [self.fetch_course_data(grading_period, course['ID']) for course in courses]
        return list(await asyncio.gather(*tasks))

    async def fetch_student_info(self) -> dict[str, Any]:
        if self.student_info:
            return self.student_info

        async with self.post('/api/v1/components/pxp/student-picker/StudentPicker/GetStudents') as response:
            data = await response.json()
            self.student_info = out = data['data'][0]
            return out

    async def fetch_student_image(self) -> bytes:
        if self.student_image is not None:
            return self.student_image

        student_info = await self.fetch_student_info()
        async with self.get('/' + student_info['photoUrl']) as response:
            self.student_image = out = await response.read()
            return out

    def request(self, method: Literal['GET', 'POST'], path: str, **kwargs: Any) -> _RequestContextManager:
        return self.session.request(method, self.host + path, cookies=self.cookies, **kwargs)

    def get(self, path: str, **kwargs: Any) -> _RequestContextManager:
        return self.request('GET', path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> _RequestContextManager:
        return self.request('POST', path, **kwargs)

    def invalidate_cache(self) -> None:
        self._course_data.clear()
        self._gradebooks.clear()

    async def close(self) -> None:
        await self.session.close()


@routes.get('/')
async def hello() -> web.Response:
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
    await scraper.login()
    token = uuid.uuid4().hex

    request.app[scrapers][token] = scraper
    student = await scraper.fetch_student_info()
    metadata = await scraper.fetch_courses_metadata(scraper.default_grading_period)
    await scraper.fetch_grading_policy()

    out = msgpack.dumps({
        'token': token,
        'courseOrder': metadata,
        'policy': scraper.general_course_metadata,
        'student': student,
        'gradingPeriods': scraper.grading_periods,
    })
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
        await scraper.login()
    except web.HTTPUnauthorized:
        token = request.headers['Authorization']
        await scraper.close()
        del request.app[scrapers][token]
        raise

    metadata = await scraper.fetch_courses_metadata(scraper.default_grading_period)
    student = await scraper.fetch_student_info()
    await scraper.fetch_grading_policy()

    out = msgpack.dumps({
        'courseOrder': metadata,
        'policy': scraper.general_course_metadata,
        'student': student,
        'gradingPeriods': scraper.grading_periods,
    })
    return web.Response(body=out)


@routes.get('/grades/{grading_period}')
async def get_grading_period_info(request: web.Request) -> web.Response:
    scraper = auth(request)
    grading_period = request.match_info['grading_period']
    if grading_period not in scraper.grading_periods:
        return web.Response(text='Invalid grading period', status=400)

    out = msgpack.dumps(await scraper.fetch_courses_metadata(grading_period))
    return web.Response(body=out)


@routes.get('/grades/{grading_period}/courses')
async def get_courses(request: web.Request) -> web.Response:
    scraper = auth(request)
    grading_period = request.match_info['grading_period']
    if grading_period not in scraper.grading_periods:
        return web.Response(text='Invalid grading period', status=400)

    out = msgpack.dumps(await scraper.fetch_all_courses(grading_period))
    return web.Response(body=out)


@routes.get('/grades/{grading_period}/courses/{course_id}')
async def get_course(request: web.Request) -> web.Response:
    scraper = auth(request)
    grading_period = request.match_info['grading_period']
    try:
        course_id = int(request.match_info['course_id'])
    except ValueError:
        return web.Response(text='invalid course ID', status=400)
    if grading_period not in scraper.grading_periods:
        return web.Response(text='invalid grading period', status=400)

    try:
        out = msgpack.dumps(await scraper.fetch_course_data(grading_period, course_id))
    except KeyError:
        return web.Response(text='invalid course ID', status=400)
    return web.Response(body=out)


@routes.get('/photo')
async def get_photo(request: web.Request) -> web.Response:
    scraper = auth(request)
    image = await scraper.fetch_student_image()
    return web.Response(body=image, content_type='image/png')


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
