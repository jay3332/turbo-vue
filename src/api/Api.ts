import msgpack from 'msgpack-lite';
import {CourseMetadata, DistrictInfo, GradingPolicy, LoginResponse} from "./types";
import {createRoot, createSignal} from "solid-js";

const BASE_URL = 'http://127.0.0.1:8051'

export class Api {
  token: string
  courseOrder: CourseMetadata[]
  policy: GradingPolicy

  constructor(loginResponse: LoginResponse) {
    this.token = loginResponse.token
    this.courseOrder = loginResponse.courseOrder
    this.policy = loginResponse.policy
  }

  static async fromLogin(host: string, username: string, password: string): Promise<Api> {
    const response = await fetch(BASE_URL + '/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({host, username, password}),
    });
    const loginResponse = msgpack.decode(new Uint8Array(await response.arrayBuffer())) as LoginResponse;
    return new Api(loginResponse);
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

  async request(path: string, options: RequestInit = {}): Promise<any> {
    const headers: any = {
      ...(options.headers ?? {}),
      Authorization: this.token,
    }
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
    options.headers = headers;

    const response = await fetch(BASE_URL + path, options);
    if (!response.ok)
      throw new Error(response.statusText);

    return msgpack.decode(new Uint8Array(await response.arrayBuffer()));
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
