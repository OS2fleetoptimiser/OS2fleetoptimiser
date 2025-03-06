from importlib.resources import files
import time
from uuid import uuid4

import lxml.etree as et
import requests
import xmltodict

from fleetmanager.logging import logging


logger = logging.getLogger(__name__)


class SoapAgent:
    """
    Class to handle the API request to the SOAP service run by SkyHost

    Needs the api_jwt in the init, otherwise it handles the scoring system implemented in the service.
    Each request has a score "self.functions". We're allowed to maximum use 1000 / minute, however the score for a specific call is not released once
    a minute has passed. Hence the self.total_used variable to account the usage such that we are not timed out. If 1000 is reached
    we have to sleep for 300 secs.
    """

    def __init__(self, api_key=""):
        self.time = time.time()
        self.point_pr_sec = []
        self.score_sec = 0
        self.point_pr_minut = []
        self.score_minut = 0
        self.minut_cap = 1000
        self.second_cap = 100
        self.total_used = 0
        self.api_key = api_key
        self.message_id = None
        self.sequence_offer = None
        self.base_service_wsdl = "https://www.skyhost.dk/soap/basic.svc?WSDL"
        self.base_service = "https://www.skyhost.dk/soap/basic.svc"
        self.base_xml_template_path = files("fleetmanager").joinpath("extractors/skyhost/xml_templates")
        self.header = {"content-type": "application/soap+xml; charset=utf-8"}
        self.sequence_id = None
        self.last_response = None
        self.message_no = None
        # limits 100 point / sekund, 1000 point / minut
        self.functions = {
            "Trackers_GetDrivers": 20,  # {'TrackerID': x}
            "Trackers_GetTracker": 20,  # {'TrackerID': x}
            "Trackers_GetMilageLog": 100,  # {'TrackerID': x, 'Begin': datetime, 'End': datetime}
            "Trackers_GetAllTrackers": 100,  # none
            "Account_GetAllUsers": 100,  # none
            "Trackers_GetMilagePositions": 100,
        }  # {'MilageLogID': x}
        self._connect()

    def _connect(self):
        """
        Initiate the connection and creates uids for message id and sequence offer.
        A login to the service is required before starting actions it consists of:
            CreateSequence -> sequence_id
            Login

        Returns
        -------
        None
        """
        self.message_id = "urn:uuid:" + str(uuid4())
        self.sequence_offer = "urn:uuid:" + str(uuid4())
        self.total_used = 0
        self.create_sequence()
        self.login_api()

    def create_sequence(self):
        """
        Create the sequence required to make actions
        Returns
        -------
        None
        """
        self.add_call("create_sequence")  # punish sequence creation
        self.sequence_template = et.parse("{}/{}".format(self.base_xml_template_path, "createSequence.xml"))
        self.sequence_template = xmltodict.parse(
            self.xml_to_string(self.sequence_template)
        )
        self.sequence_template["s:Envelope"]["s:Header"][
            "a:MessageID"
        ] = self.message_id
        self.sequence_template["s:Envelope"]["s:Body"]["CreateSequence"]["Offer"][
            "Identifier"
        ] = self.sequence_offer

        body = xmltodict.unparse(self.sequence_template)
        self.last_response = requests.post(
            self.base_service, data=body, headers=self.header
        )
        self.last_response.raise_for_status()
        response = xmltodict.parse(self.last_response.text)
        self.sequence_id = response["s:Envelope"]["s:Body"]["CreateSequenceResponse"][
            "Identifier"
        ]

    def login_api(self):
        """
        Uses the sequence_id returned by create sequence to complete the login
        increments the message_no
        Returns
        -------
        None
        """
        self.message_no = 1
        self.add_call("login")  # punish login
        self.login_template = et.parse("{}/{}".format(self.base_xml_template_path, "loginWithApiKey.xml"))
        self.login_template = xmltodict.parse(self.xml_to_string(self.login_template))
        self.login_template["s:Envelope"]["s:Header"]["r:Sequence"][
            "r:Identifier"
        ] = self.sequence_id
        self.login_template["s:Envelope"]["s:Header"]["a:MessageID"] = self.message_id
        self.login_template["s:Envelope"]["s:Body"]["LoginWithApiKey"][
            "apiKey"
        ] = self.api_key
        body = xmltodict.unparse(self.login_template)
        self.last_response = requests.post(
            self.base_service, data=body, headers=self.header
        )
        self.last_response.raise_for_status()
        self.message_no += 1

    def execute_action(self, func=None, params=None):
        """
        Major method for creating calls to the api, check self.functions to see pre-implemented functions.
        Uses the getAllUsers.xml template to fill out necessary entries. Returns the text version of the XML response
        Parameters
        ----------
        func    :   function name that you want to call
        params  :   the params necessary for the call

        Returns
        -------
        text response of the xml call
        """
        if self.last_response is None or self.last_response.status_code != 200:
            self._connect()
        self.action_template = et.parse("{}/{}".format(self.base_xml_template_path, "getAllUsers.xml"))
        self.action_template = xmltodict.parse(self.xml_to_string(self.action_template))
        self.action_template["s:Envelope"]["s:Header"]["r:SequenceAcknowledgement"][
            "r:Identifier"
        ] = self.sequence_offer
        self.action_template["s:Envelope"]["s:Header"]["r:Sequence"][
            "r:Identifier"
        ] = self.sequence_id
        self.action_template["s:Envelope"]["s:Header"]["r:Sequence"][
            "r:MessageNumber"
        ] = str(self.message_no)
        self.action_template["s:Envelope"]["s:Header"]["a:MessageID"] = self.message_id
        self.action_template["s:Envelope"]["s:Header"]["a:Action"]["#text"] = (
            "http://tempuri.org/IBasic/" + func
        )
        self.action_template["s:Envelope"]["s:Body"][func] = self.action_template[
            "s:Envelope"
        ]["s:Body"].pop("Account_GetAllUsers")
        if params:
            for param_name, value in params.items():
                self.action_template["s:Envelope"]["s:Body"][func][param_name] = value

        self.add_call(func)
        request_body = xmltodict.unparse(self.action_template)
        self.last_response = requests.post(
            self.base_service, data=request_body, headers=self.header
        )
        self.message_no += 1
        return self.last_response

    def xml_to_string(self, req):
        return et.tostring(req, encoding="unicode")

    def add_call(self, func):
        """
        Method to add call to the record such that we can track the progress
        If the service was to release points when 60 sec has passed since call we'd do a while loop here, but since
        that's not the case we simply wait 300 secs to ensure that we're not logged out during run.
        We initiate a new connection when 1000 total_used has been reached.
        Parameters
        ----------
        func    :   function called to attribute the associated score

        Returns
        -------
        None    :   when call is allowed
        """
        self.prune_calls()
        if func in self.functions:
            self.point_pr_minut.append([self.functions[func], time.time()])
            self.point_pr_sec.append([self.functions[func], time.time()])
            self.total_used += self.functions[func]
        else:
            self.point_pr_minut.append([100, time.time()])
            self.point_pr_sec.append([100, time.time()])
            self.total_used += 100
        ready_min, ready_sec = self.prune_calls()
        if ready_min is False:
            logger.info("Sleeping 60 sec")
            time.sleep(60)
            # if self.total_used >= self.minut_cap:
            #     print('Sleeping 240 sec')
            #     time.sleep(240)
            self._connect()  # the API doesn't release points as they proclaim
            # no more than 10 calls including create and login is feasible
            ready_min, ready_sec = self.prune_calls()
        if ready_sec is False:
            time.sleep(1)

    def prune_calls(self):
        """
        Method for cleaning the list of calls in the record. Useful when the service will actually release points
        dynamically.

        Returns
        -------
        call_ready (bool) or (score_minut okay (bool), score_sec okay (bool))
        """
        self.point_pr_minut = [
            [items[0], items[1]]
            for items in self.point_pr_minut
            if time.time() - items[1] < 60
        ]
        self.point_pr_sec = [
            [items[0], items[1]]
            for items in self.point_pr_sec
            if time.time() - items[1] < 1
        ]
        self.score_minut = sum([items[0] for items in self.point_pr_minut])
        self.score_sec = sum([items[0] for items in self.point_pr_sec])
        call_ready = all(
            [self.score_minut < self.minut_cap, self.score_sec < self.second_cap]
        )
        return (
            self.score_minut < self.minut_cap,
            self.score_sec < self.second_cap,
        )  # call_ready
