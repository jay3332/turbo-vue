import msgpack from 'msgpack-lite';
import {
  Assignment,
  Course,
  CourseMetadata,
  DistrictInfo,
  GradingPeriod,
  GradingPolicy,
  LoginResponse,
  StudentInfo
} from "./types";
import {createRoot, createSignal} from "solid-js";
import {ReactiveMap} from "@solid-primitives/map";
import {isMCPS} from "../utils";

export const BASE_URL = 'https://turbovue-api.jay3332.tech'

export type CustomAssignment = Assignment & {
  isCustom?: boolean
}

export function createAssignment(base: Assignment, isCustom: boolean): CustomAssignment {
  return {...base, isCustom}
}

export interface CustomCourse {
  assignments: CustomAssignment[]
  needsRollback: boolean
}

export class Api {
  token: string
  courseOrders: ReactiveMap<string, CourseMetadata[]>
  courses: ReactiveMap<string, Course>
  policy: GradingPolicy
  gradingPeriods: Record<string, GradingPeriod>
  student: StudentInfo
  modifiedCourses: ReactiveMap<string, CustomCourse>

  constructor(loginResponse: LoginResponse) {
    this.token = loginResponse.token
    this.courseOrders = new ReactiveMap()
    this.courses = new ReactiveMap()
    this.policy = loginResponse.policy
    this.student = loginResponse.student
    this.gradingPeriods = loginResponse.gradingPeriods
    this.modifiedCourses = new ReactiveMap()

    this.courseOrders.set(this.defaultGradingPeriod, loginResponse.courseOrder)
    let {} = this.updateAllCourses()
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

  get defaultGradingPeriod(): string {
    return Object.values(this.gradingPeriods).find((period) => period.defaultFocus)!.GU
  }

  async updateAllCourses(gradingPeriod?: string) {
    gradingPeriod ??= this.defaultGradingPeriod;
    const {data, error} = await this.request(`/grades/${gradingPeriod}/courses`);
    if (error) throw new Error(error);
    this.populateAllCourses(gradingPeriod, data)
  }

  populateAllCourses(gradingPeriod: string, courses: Course[]) {
    for (const course of courses) {
      this.courses.set(`${gradingPeriod}:${course.classId}`, course);
      this.populateModifiedCourse(gradingPeriod, course)
    }
  }

  populateModifiedCourse(gradingPeriod: string, course: Course) {
    const assignments = course.assignments.sort((a, b) => (
      new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
    )).map(assignment => createAssignment(assignment, false))

    this.modifiedCourses.set(`${gradingPeriod}:${course.classId}`, {
      assignments, needsRollback: false
    })
  }

  private totalAssignmentPointsBy(
    transform: (a: CustomAssignment) => number,
    gradingPeriod: string,
    courseId: number,
    categoryId?: number,
    assignments?: CustomAssignment[],
  ): number {
    assignments ??= this.modifiedCourses.get(`${gradingPeriod}:${courseId}`)!.assignments;
    return assignments
      .filter(assignment =>
        assignment.isForGrading
        && assignment.score != null
        && (categoryId != null ? assignment.measureTypeId === categoryId : true)
      )
      .reduce((acc, assignment) => acc + transform(assignment), 0)
  }

  totalAssignmentPoints(
    gradingPeriod: string, courseId: number, categoryId?: number,
    assignments?: CustomAssignment[],
    ): number {
    return this.totalAssignmentPointsBy(a => parseFloat(a.score!), gradingPeriod, courseId, categoryId, assignments)
  }

  maxAssignmentPoints(
    gradingPeriod: string, courseId: number, categoryId?: number,
    assignments?: CustomAssignment[],
  ): number {
    return this.totalAssignmentPointsBy(a => parseFloat(a.maxScore), gradingPeriod, courseId, categoryId, assignments)
  }

  calculateWeightedPointRatio(
    gradingPeriod: string,
    courseId: number,
    adjustments?: Record<number, [number, number]>,
    assignments?: CustomAssignment[],
  ): number {
    const [weight, ratio] = this.policy.measureTypes
      .map(type => [
        type.id,
        type.weight / 100,
        this.maxAssignmentPoints(gradingPeriod, courseId, type.id, assignments),
        adjustments?.[type.id] ?? [0, 0],
      ] as const)
      .filter(([_id, _weight, total, _adjustment]) => !!total)
      .map(([id, weight, total, [extraPoints, extraTotal]]) => [
        weight,
        (this.totalAssignmentPoints(gradingPeriod, courseId, id, assignments) + extraPoints)
        / (total + extraTotal)
        * weight,
      ])
      .filter(([_weight, ratio]) => !isNaN(ratio))
      .reduce(([a, b], [weight, ratio]) => [a + weight, b + ratio], [0, 0])

    return ratio / weight // Normalize ratio (e.g. if cum_weights=0.5, ratio should be normalized as ratio / 0.5)
  }

  calculateMark(scoreType: number, ratio: number): string {
    const policy = this.policy.reportCardScoreTypes.find((type) => type.id === scoreType)!;
    if (isNaN(ratio) || !policy || policy.max == -1) return 'N/A'; // No max, so no percentage

    if (isMCPS()) {
      if (ratio >= 0.895) return 'A'
      else if (ratio >= 0.795) return 'B'
      else if (ratio >= 0.695) return 'C'
      else if (ratio >= 0.595) return 'D'
      else return 'E'
    }

    for (const boundary of policy.details.sort((a, b) => b.lowScore - a.lowScore)) {
      if (ratio >= boundary.lowScore / policy.max) return boundary.score;
    }
    return 'N/A';
  }

  private mcpsGpaValue(mark: string, weighted: boolean): number | null {
    const extra = weighted ? 1 : 0
    switch (mark) {
      case 'A': return 4 + extra
      case 'B': return 3 + extra
      case 'C': return 2 + extra
      case 'D': return 1
      case 'E': return 0
      default: return null
    }
  }

  isMcpsCourseWeighted(name: string): boolean {
    return ['AP', 'Hon', 'Honors', 'Adv', 'Advanced', 'Mag', 'Magnet', 'IB'].some(term => name.includes(term))
  }

  calculateMcpsGpa(gradingPeriod: string): { weighted: number, unweighted: number } {
    let totalWeighted = 0, totalUnweighted = 0, count = 0
    const getMark = (ratio: number) => this.calculateMark(this.policy.defaultReportCardScoreTypeId, ratio)

    for (const course of this.courseOrders.get(gradingPeriod)!) {
      const modified = this.modifiedCourses.get(`${gradingPeriod}:${course.ID}`)
      const mark = modified != null
        ? getMark(this.calculateWeightedPointRatio(gradingPeriod, course.ID))
        : (
          /\d/.test(course.markPreview) ? getMark(parseFloat(course.markPreview)) : course.markPreview
        )

      const weighted = this.mcpsGpaValue(mark, this.isMcpsCourseWeighted(course.Name))
      if (weighted) {
        totalWeighted += weighted
        totalUnweighted += this.mcpsGpaValue(mark, false) ?? 0
        count++
      }
    }

    return {
      weighted: totalWeighted / count,
      unweighted: totalUnweighted / count,
    }
  }

  calculateScoreStyle(scoreType: number, ratio: number): string {
    const policy = this.policy.reportCardScoreTypes.find((type) => type.id === scoreType)!;
    if (policy.max == -1) return 'fg'; // No max, so no percentage
    if (ratio >= 1.0) return 'scale-6';
    if (ratio <= 0.0) return 'scale-0';

    if (isMCPS()) {
      if (isNaN(ratio)) return 'fg'
      else if (ratio >= 0.895) return 'scale-5'
      else if (ratio >= 0.795) return 'scale-4'
      else if (ratio >= 0.695) return 'scale-3'
      else if (ratio >= 0.595) return 'scale-2'
      else return 'scale-1'
    }

    // synergy measures in hundredths of a percent
    ratio = Math.round(ratio * 10_000) / 10_000;

    let scale = 5;
    for (const boundary of policy.details) {
      const lowRatio = boundary.lowScore / policy.max;
      if (ratio >= lowRatio) return `scale-${scale}`;
      scale = Math.max(1, scale - 1);
    }
    return 'fg';
  }

  async request(path: string, options: RequestInit = {}): Promise<
    {data: any, error: null} | {data: null, error: string}
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
