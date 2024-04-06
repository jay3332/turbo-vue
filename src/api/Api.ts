import msgpack from 'msgpack-lite';
import {Course, CourseMetadata, DistrictInfo, GradingPeriod, GradingPolicy, LoginResponse, StudentInfo} from "./types";
import {createRoot, createSignal} from "solid-js";
import {ReactiveMap} from "@solid-primitives/map";

export const BASE_URL = 'http://127.0.0.1:8051'

export class Api {
  token: string
  courseOrders: ReactiveMap<string, CourseMetadata[]>
  courses: ReactiveMap<string, Course>
  policy: GradingPolicy
  gradingPeriods: Record<string, GradingPeriod>
  student: StudentInfo

  constructor(loginResponse: LoginResponse) {
    this.token = loginResponse.token
    this.courseOrders = new ReactiveMap()
    this.courses = new ReactiveMap()
    this.policy = loginResponse.policy
    this.student = loginResponse.student
    this.gradingPeriods = loginResponse.gradingPeriods

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

    for (const course of data) {
      this.courses.set(`${gradingPeriod}:${course.classId}`, course);
    }
  }

  calculateScoreStyle(scoreType: number, ratio: number): string {
    const policy = this.policy.reportCardScoreTypes.find((type) => type.id === scoreType)!;
    if (policy.max == -1) return 'fg'; // No max, so no percentage
    if (ratio >= 1.0) return 'scale-6';
    if (ratio <= 0.0) return 'scale-0';
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
