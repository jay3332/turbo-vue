from collections import OrderedDict
from urllib.parse import urlparse

from aiohttp import ClientSession
from lxml import etree
from xmljson import badgerfish, XMLData

COOKIES = {
    'PVUE': 'ENG',
    'MOBILE_REQUEST_CORE_PAGE': 'Y',
    'AppSupportsSession': '1',
    # This must be kept up to date with mobile version
    'edupointkeyversion': '/NA4Hhin2wgW9fCFiArBMbltR1oy6rlqC1Uug/bNBRyheGs9Un8FJZq8MrAFljL/',
}

XML_TEMPLATE = """
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <ProcessWebServiceRequestMultiWeb xmlns="http://edupoint.com/webservices/">
            <userID>{username}</userID>
            <password>{password}</password>
            <skipLoginLog>0</skipLoginLog>
            <parent>0</parent>
            <webDBName></webDBName>
            <webServiceHandleName>PXPWebServices</webServiceHandleName>
            <methodName>{method_name}</methodName>
            <paramStr>{param_str}</paramStr>
        </ProcessWebServiceRequestMultiWeb>
    </soap:Body>
</soap:Envelope>
""".strip()

ENVELOPE = '{http://schemas.xmlsoap.org/soap/envelope/}'
WEBSERVICES = '{http://edupoint.com/webservices/}'


def xmlesc(txt: str) -> str:
    txt = txt.replace("&", "&amp;")
    txt = txt.replace("<", "&lt;")
    txt = txt.replace(">", "&gt;")
    txt = txt.replace('"', "&quot;")
    txt = txt.replace("'", "&apos;")
    return txt


class StudentVue:
    """Modified version of https://github.com/StudentVue/StudentVue.py/blob/master/studentvue/StudentVue.py"""

    def __init__(
        self,
        *,
        username: str,
        password: str,
        host: str,
        session: ClientSession = None,
    ) -> None:
        self._username: str = username
        self._password: str = password

        parse_result = urlparse(host)
        if parse_result.scheme:
            self.district_domain = parse_result.netloc + parse_result.path
        else:
            self.district_domain = parse_result.path
            if self.district_domain[len(self.district_domain) - 1] == '/':
                self.district_domain = self.district_domain[:-1]

        self.xmljson_serializer: XMLData = badgerfish
        self.session: ClientSession = session

    async def execute(self, method_name: str, **kwargs) -> OrderedDict:
        return self._xml_json_serialize(await self._make_service_request(method_name, **kwargs))

    async def get_calendar(self) -> OrderedDict:
        return await self.execute('StudentCalendar')

    async def get_attendance(self) -> OrderedDict:
        return await self.execute('Attendance')

    async def get_gradebook(self, report_period: int = None) -> OrderedDict:
        params = {}
        if report_period is not None:
            params['ReportPeriod'] = report_period

        res = await self.execute('Gradebook', **params)
        return res['Gradebook']

    async def get_students(self) -> OrderedDict:
        return await self.execute('ChildList')

    async def get_student_info(self) -> OrderedDict:
        return await self.execute('StudentInfo')

    async def get_schedule(self, term_index: int = None) -> OrderedDict:
        params = {}
        if term_index is not None:
            params['TermIndex'] = term_index

        return await self.execute('StudentClassList', **params)

    async def get_school_info(self) -> OrderedDict:
        return await self.execute('StudentSchoolInfo')

    async def list_report_cards(self) -> OrderedDict:
        return await self.execute('GetReportCardInitialData')

    async def get_report_card(self, document_guid: str) -> OrderedDict:
        return await self.execute('GetReportCardDocumentData', DocumentGU=document_guid)

    async def list_documents(self) -> OrderedDict:
        return await self.execute('GetStudentDocumentInitialData')

    async def get_document(self, document_guid: str) -> OrderedDict:
        return await self.execute('GetContentOfAttachedDoc', DocumentGU=document_guid)

    async def _make_service_request(self, method_name: str, **kwargs) -> bytes:
        param_str = '&lt;Parms&gt;'
        for key, value in kwargs.items():
            param_str += '&lt;' + key + '&gt;'
            param_str += str(value)
            param_str += '&lt;/' + key + '&gt;'
        param_str += '&lt;/Parms&gt;'

        xml = XML_TEMPLATE.format(
            username=xmlesc(self._username),
            password=xmlesc(self._password),
            method_name=method_name,
            param_str=param_str,
        )

        # Prevent cookie jar from escaping
        cookies = '; '.join(f'{key}={value}' for key, value in COOKIES.items())

        async with self.session.post(
            f'https://{self.district_domain}/Service/PXPCommunication.asmx',
            headers={
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://edupoint.com/webservices/ProcessWebServiceRequestMultiWeb',
                'Host': self.district_domain,
                'User-Agent': 'StudentVUE/11.7.1 CFNetwork/1568.300.101 Darwin/24.2.0',
                'Cookie': cookies,
            },
            data=xml,
        ) as resp:
            return await resp.read()

    def _xml_json_serialize(self, xml_string: bytes) -> OrderedDict:
        response = (
            self.xmljson_serializer.data(etree.fromstring(xml_string))
            [ENVELOPE + 'Envelope']
            [ENVELOPE + 'Body']
            [WEBSERVICES + 'ProcessWebServiceRequestMultiWebResponse']
            [WEBSERVICES + 'ProcessWebServiceRequestMultiWebResult']
            ['$']
        )
        out = self.xmljson_serializer.data(etree.fromstring(response))
        if 'RT_ERROR' in out and 'The user name or password is incorrect' in out['RT_ERROR'].get('@ERROR_MESSAGE', ''):
            raise InvalidCredentials(out['RT_ERROR'])
        return out


class InvalidCredentials(Exception):
    pass
