import msgpack from 'msgpack-lite';
import {
  Assignment,
  Course,
  DistrictInfo,
  GradebookInfo,
  GradingPeriod,
  LoginResponse,
  Schedule,
  StudentInfo
} from "./types";
import {createRoot, createSignal, Signal} from "solid-js";
import {ReactiveMap} from "@solid-primitives/map";
import {someIterator} from "../utils";
import GradingPolicy from "./GradingPolicy";
import WeightingPolicy from "./WeightingPolicy";

export const BASE_URL = 'https://turbovue-api.jay3332.tech'
// export const BASE_URL = 'http://127.0.0.1:8051'

export type CustomAssignment = Assignment & {
  isCustom?: boolean
}

export function createAssignment(base: Assignment, isCustom: boolean): CustomAssignment {
  return {...base, isCustom}
}

export interface CustomCourse {
  gradingPeriod: number
  classId: number
  assignments: CustomAssignment[]
  needsRollback: boolean
}

type CourseId = `${number}:${number}`

export class Gradebook {
  courses: ReactiveMap<CourseId, Course>
  modifiedCourses: ReactiveMap<CourseId, CustomCourse>
  loadedGradingPeriods: Signal<number[]>

  constructor(
    public api: Api,
    public policy: GradingPolicy,
    public weighting: WeightingPolicy,
    public gradingPeriods: GradingPeriod[],
    public defaultGradingPeriod: number,
    coursesForDefaultGP: Course[],
  ) {
    this.courses = new ReactiveMap()
    this.modifiedCourses = new ReactiveMap()
    this.loadedGradingPeriods = createSignal<number[]>([])
    this.populateAllCourses(this.defaultGradingPeriod, coursesForDefaultGP)
  }

  static fromResponse(api: Api, response: GradebookInfo): Gradebook {
    return new Gradebook(
      api,
      GradingPolicy.mcps(), // TODO: customizable grading policies?
      WeightingPolicy.mcps(), // TODO: customizable weighting policies?
      response.gradingPeriods,
      response.defaultGradingPeriod,
      response.courses[response.defaultGradingPeriod as any],
    )
  }

  async updateAllCourses(gradingPeriod?: number) {
    gradingPeriod ??= this.defaultGradingPeriod;
    const {data, error} = await this.api.request(`/grades/${gradingPeriod}`);
    if (error) throw new Error(error);
    this.populateAllCourses(gradingPeriod, data)
  }

  populateAllCourses(gradingPeriod: number, courses: Course[]) {
    for (const course of courses) {
      this.courses.set(`${gradingPeriod}:${course.classId}`, course);
      this.populateModifiedCourse(gradingPeriod, course)
    }
    const [, setLoaded] = this.loadedGradingPeriods
    setLoaded(p => [...p, gradingPeriod])
  }

  populateModifiedCourse(gradingPeriod: number, course: Course) {
    const assignments = course.assignments.sort((a, b) => (
      new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
    )).map(assignment => createAssignment(assignment, false))

    this.modifiedCourses.set(`${gradingPeriod}:${course.classId}`, {
      gradingPeriod,
      classId: course.classId,
      assignments, needsRollback: false
    })
  }

  private totalAssignmentPointsBy(
    transform: (a: CustomAssignment) => number,
    gradingPeriod: number,
    courseId: number,
    category?: string,
    assignments?: CustomAssignment[],
  ): number {
    assignments ??= this.modifiedCourses.get(`${gradingPeriod}:${courseId}`)!.assignments;
    return assignments
      .filter(assignment =>
        !assignment.notForGrading
        && assignment.score != null
        && (category != null ? assignment.type === category : true)
      )
      .reduce((acc, assignment) => acc + transform(assignment), 0)
  }

  totalAssignmentPoints(
    gradingPeriod: number, courseId: number, category?: string,
    assignments?: CustomAssignment[],
  ): number {
    return this.totalAssignmentPointsBy(a => a.score ?? 0, gradingPeriod, courseId, category, assignments)
  }

  maxAssignmentPoints(
    gradingPeriod: number, courseId: number, category?: string,
    assignments?: CustomAssignment[],
  ): number {
    return this.totalAssignmentPointsBy(a => a.maxScore ?? 0, gradingPeriod, courseId, category, assignments)
  }

  calculateWeightedPointRatio(
    gradingPeriod: number,
    courseId: number,
    adjustments?: Record<string, [number, number]>,
    assignments?: CustomAssignment[],
  ): number {
    const [weight, ratio] = [...this.weighting.weights.values()]
      .map(type => [
        type.name,
        type.weight,
        this.maxAssignmentPoints(gradingPeriod, courseId, type.name, assignments),
        adjustments?.[type.name] ?? [0, 0],
      ] as const)
      .filter(([_weightName, _weight, total, _adjustment]: any) => !!total)
      .map(([weightName, weight, total, [extraPoints, extraTotal]]: any) => [
        weight,
        (this.totalAssignmentPoints(gradingPeriod, courseId, weightName, assignments) + extraPoints)
        / (total + extraTotal)
        * weight,
      ])
      .filter(([_weight, ratio]: any) => !isNaN(ratio))
      .reduce(([a, b], [weight, ratio]: any) => [a + weight, b + ratio], [0, 0])

    return ratio / weight // Normalize ratio (e.g. if cum_weights=0.5, ratio should be normalized as ratio / 0.5)
  }

  isCourseWeighted(name: string): boolean { // TODO: make platform agnostic
    return ['AP', 'Hon', 'Honors', 'Adv', 'Advanced', 'Mag', 'Magnet', 'IB'].some(term => name.includes(term))
  }

  sortedCourses(gradingPeriod: number): Course[] {
    let courses = [];
    for (const [key, course] of this.courses.entries()) {
      if (!key.startsWith(`${gradingPeriod}:`)) continue
      courses.push(course)
    }
    return courses.sort((a, b) => a.period - b.period)
  }

  isGPLoaded(gradingPeriod: number): boolean {
    const [loaded] = this.loadedGradingPeriods
    return loaded().includes(gradingPeriod)
  }

  * walkCourses(gradingPeriod: number) {
    for (const [key, course] of this.courses.entries()) {
      if (!key.startsWith(`${gradingPeriod}:`)) continue
      yield course
    }
  }

  calculateGpa(gradingPeriod: number): { weighted: number, unweighted: number } {
    let totalWeighted = 0, totalUnweighted = 0;
    let countWeighted = 0, countUnweighted = 0;
    const getMark = (ratio: number) => this.policy.getMark(ratio)

    for (const course of this.walkCourses(gradingPeriod)) {
      const mark = getMark(this.calculateWeightedPointRatio(gradingPeriod, course.classId))

      totalWeighted += this.isCourseWeighted(course.name)
        ? mark.wgpaPoints ?? mark.gpaPoints ?? 0
        : mark.gpaPoints ?? 0
      totalUnweighted += mark.gpaPoints ?? 0

      if (mark.wgpaPoints != null || mark.gpaPoints != null) countWeighted++
      if (mark.gpaPoints != null) countUnweighted++
    }

    return {
      weighted: totalWeighted / countWeighted,
      unweighted: totalUnweighted / countUnweighted,
    }
  }
}

export class Api {
  token: string
  student: StudentInfo
  gradebookSignal: Signal<Gradebook | null>
  scheduleSignal: Signal<Schedule | null>

  constructor(loginResponse: LoginResponse) {
    this.token = loginResponse.token
    this.student = loginResponse.student
    this.gradebookSignal = createSignal<Gradebook | null>(Gradebook.fromResponse(this, loginResponse))
    this.scheduleSignal = createSignal<Schedule | null>(null)
  }

  get gradebook(): Gradebook | null {
    const [gradebook] = this.gradebookSignal
    return gradebook()
  }

  set gradebook(gradebook: Gradebook) {
    const [, setGradebook] = this.gradebookSignal
    setGradebook(gradebook)
  }

  get schedules(): Schedule | null {
    const [schedules] = this.scheduleSignal
    return schedules()
  }

  set schedules(schedules: Schedule) {
    const [, setSchedules] = this.scheduleSignal
    setSchedules(schedules)
  }

  static async fromLogin(host: string, username: string, password: string): Promise<Api> {
    const response = await fetch(BASE_URL + '/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({host, username, password}),
    });
    if (!response.ok) throw new Error(await response.text());
    const loginResponse = msgpack.decode(new Uint8Array(await response.arrayBuffer())) as LoginResponse;
    return new Api(loginResponse);
  }

  static async fromToken(token: string): Promise<Api> {
    const headers = {Authorization: token};
    const response = await fetch(BASE_URL + '/refresh', {method: 'POST', headers});
    if (!response.ok) throw new Error(await response.text());

    const loginResponse = msgpack.decode(new Uint8Array(await response.arrayBuffer())) as LoginResponse;
    return new Api({...loginResponse, token});
  }

  static async fetchDistricts(zipCode: number): Promise<DistrictInfo[]> {
    const paramStr =
      '&lt;Parms&gt;&lt;Key&gt;5E4B7859-B805-474B-A833-FDB15D205D40&lt;/Key' +
      `&gt;&lt;MatchToDistrictZipCode&gt;${zipCode}&lt;/MatchToDistrictZipCode&gt;&lt;/Parms&gt;`;
    const response = await fetch('https://support.edupoint.com/Service/HDInfoCommunication.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://edupoint.com/webservices/ProcessWebServiceRequest',
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
          xmlns:xsd="http://www.w3.org/2001/XMLSchema"
          xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
        >
          <soap:Body>
            <ProcessWebServiceRequest xmlns="http://edupoint.com/webservices/">
              <userID>EdupointDistrictInfo</userID>
              <password>Edup01nt</password>
              <skipLoginLog>1</skipLoginLog>
              <parent>0</parent>
              <webServiceHandleName>HDInfoServices</webServiceHandleName>
              <methodName>GetMatchingDistrictList</methodName>
              <paramStr>${paramStr}</paramStr>
            </ProcessWebServiceRequest>
          </soap:Body>
        </soap:Envelope>
      `,
    })

    const text = await response.text();
    const parser = new DOMParser().parseFromString(text, 'text/xml');
    const xml = new DOMParser().parseFromString(
      parser.querySelector('ProcessWebServiceRequestResult')!.textContent!,
      'text/xml',
    )
    return [...xml.getElementsByTagName('DistrictInfo')].map((entry) => ({
      name: entry.getAttribute('Name')!,
      address: entry.getAttribute('Address')!,
      host: entry.getAttribute('PvueURL')!,
    }))
  }

  async request<T = any>(path: string, options: RequestInit = {}): Promise<
    {data: T, error: null} | {data: null, error: string}
  > {
    const headers: any = {
      ...(options.headers ?? {}),
      Authorization: this.token,
    }
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
    options.headers = headers;

    const response = await fetch(BASE_URL + path, options);
    return response.ok
      ? {data: msgpack.decode(new Uint8Array(await response.arrayBuffer())), error: null}
      : {error: await response.text(), data: null};
  }
}

export const [getApi, setApi] = createRoot(() => {
  const _globalApi = createSignal<Api>()
  const getApi = _globalApi[0]
  const [confirmedApiAccess, setConfirmedApiAccess] = createSignal(false)

  function setApi(api: Api) {
    // @ts-ignore
    if (window) try {
      Object.defineProperty(window, 'api', {
        get: () => {
          if (!confirmedApiAccess())
            confirm('Access to the "api" development/debug variable has been requested. ' +
              'Press "OK" to confirm access, otherwise press "Cancel" to deny access.\n\n' +
              'This is used to access the API from the browser console and can be used to gain access to your account. ' +
              'If you do not know what this is, you should probably press "Cancel".') && setConfirmedApiAccess(true)

          return confirmedApiAccess() ? api : undefined
        },
      })
    } catch (ignored) {}

    _globalApi[1](api)
  }
  return [getApi, setApi] as const
});

(window as any)['_Api'] = Api
