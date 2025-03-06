import datetime
import operator
from itertools import groupby

import numpy as np
import pandas as pd
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.query import Query

from fleetmanager.data_access import (
    AllowedStarts,
    RoundTrips,
    engine_creator,
    RoundTripSegments,
)
from fleetmanager.logging import logging
from fleetmanager.model import vehicle
from fleetmanager.model.dashfree_utils import get_emission
from fleetmanager.model.qampo import qampo_simulation
from fleetmanager.model.qampo.classes import AlgorithmType
from fleetmanager.model.qampo.classes import Fleet as qampo_fleet
from fleetmanager.model.qampo.classes import Trip as qampo_trip
from fleetmanager.model.tco_calculator import TCOCalculator
from fleetmanager.model.trip_generator import shiftify, get_kilometer_per_hour
from fleetmanager.model.vehicle import Bike, ElectricBike


logger = logging.getLogger(__name__)

class Trips:
    """Trips class for containing and manipulating trips of the simulation.

    Parameters
    ----------
    dataset : name (string) of dummy dataset to load. If dataset is a pandas DataFrame it is loaded as trips.all_trips.

    Attributes
    ----------
    all_trips : All trips in dataset (no filtering)
    trips : Trips in dataset applying date and department filter
    date_filter : boolean numpy array with same length as all_trips
    department_filter : boolean numpy array with same length as all_trips
    """

    def __init__(
        self,
        location=None,
        dataset=None,
        dates=None,
        shifts=None,
        vehicles=None,
        kilometer_pr_hour=True,
        engine=None,
    ):
        if engine is None:
            self.engine = engine_creator()
        else:
            self.engine = engine
        self.all_trips = []
        if isinstance(dataset, pd.DataFrame):
            self.all_trips = dataset
        else:
            logger.info(f"locations: {location} date-period: {dates}")

            self.all_trips = self.load_trips(dates, vehicles, location)
            if len(self.all_trips) == 0:
                return

        if shifts is not None and len(shifts) > 0:
            logger.info(f"*** aggregating on shifts, going from {len(self.all_trips)}")
            self.all_trips = shiftify(self.all_trips, shifts).sort_values(
                ["start_time"], ascending=True
            )
            logger.info(f"to {len(self.all_trips)} trips")

        if not isinstance(dataset, pd.DataFrame):
            self.set_assignment()

        self.trips = self.all_trips.copy()

        self.trips["car_id"] = self.trips.car_id.apply(
            lambda x: None if pd.isna(x) else str(str(x).split(".")[0])
        )

        if kilometer_pr_hour:
            self.trips = get_kilometer_per_hour(self.trips, self.engine)
        else:
            self.trips["km/h"] = self.trips.apply(
                lambda row: row.distance
                / ((row.end_time - row.start_time).total_seconds() / 3600),
                axis=1,
            )
        logger.info(f"cars in simulation trips {self.trips.car_id.unique()}")
        self.distance_range = (
            self.trips.distance.min(),
            self.trips.distance.max(),
        )

    def load_trips(
        self,
        dates: list[datetime, datetime] = None,
        vehicles: list = None,
        location: int | list[int] = None,
    ):
        if type(location) == int:
            location = [location]

        session = sessionmaker(bind=self.engine)()
        query = session.query(RoundTrips, RoundTripSegments, AllowedStarts.address)
        if vehicles:
            query = query.filter(RoundTrips.car_id.in_(vehicles))
        if location:
            query = query.filter(RoundTrips.start_location_id.in_(location))
        if dates:
            query = query.filter(
                (RoundTrips.start_time > dates[0]) & (RoundTrips.end_time < dates[1])
            )

        query = query.outerjoin(
            RoundTripSegments, RoundTrips.id == RoundTripSegments.round_trip_id
        )

        query = query.join(
            AllowedStarts, AllowedStarts.id == RoundTrips.start_location_id
        )

        result_dict = {}
        for roundtrip, segment, address in query.all():
            id_ = roundtrip.id
            if id_ not in result_dict:
                record = {
                    key: value
                    for key, value in roundtrip.__dict__.items()
                    if key[0] != "_"
                }
                record["address"] = address
                record["trip_segments"] = []
                result_dict[id_] = record
            if segment:
                result_dict[id_]["trip_segments"].append(
                    {
                        "start_time": segment.start_time,
                        "end_time": segment.end_time,
                        "distance": segment.distance,
                    }
                )
        if not result_dict:
            return pd.DataFrame()
        return (
            pd.DataFrame(list(result_dict.values()))
            .sort_values(["start_time"])
            .reset_index()
            .iloc[:, 1:]
        )

    def set_assignment(self):
        """
        Method for setting up necessary columns on the trips in order
        to book-keep the allocated vehicles on the trips.
        """
        n = len(self.all_trips)
        self.all_trips["department"] = self.all_trips["address"].apply(
            lambda x: x.replace(",", "")
        )
        self.all_trips["tripid"] = self.all_trips["id"]
        self.all_trips["current"] = n * [vehicle.Unassigned()]
        self.all_trips["current_type"] = -np.ones((n,), dtype=int)
        self.all_trips["simulation"] = n * [vehicle.Unassigned()]
        self.all_trips["simulation_type"] = -np.ones((n,), dtype=int)

    def __iter__(self):
        """Yield trips as a single pandas row."""
        for i, r in self.trips.iterrows():
            yield r

    def _timestamp_to_timeslot(self, timestamp):
        """
        TODO: checkout this for a speed up: https://stackoverflow.com/questions/56796775/is-there-an-equivalent-to-numpy-digitize-that-works-on-an-pandas-intervalindex

        Parameters
        ----------
        timestamp : timestamp to be mapped to a timeslot

        Returns
        -------
        i : timeslot index as int. If None is returned the timestamp is outside the timeslots.
        """

        time_indexes = np.nonzero(
            np.logical_and(
                self.timestamps.start_time <= timestamp,
                self.timestamps.end_time > timestamp,
            )
        )
        return time_indexes[0] if len(time_indexes) > 0 else None

    def set_timestamps(self, timestamps):
        """
        Set timestamps of Trips and mapped all trips to the corresponding timeslots.

        Parameters
        ----------
        timestamps : pandas PeriodIndex
        """
        self.timestamps = timestamps
        start_slot = []
        end_slot = []
        x = 0
        for i, roundtrip in enumerate(self.__iter__()):
            x += 1
            start_slot.append(self._timestamp_to_timeslot(roundtrip.start_time))
            end_slot.append(self._timestamp_to_timeslot(roundtrip.end_time))

        self.trips["start_slot"] = start_slot
        self.trips["end_slot"] = end_slot

    def set_filtered_trips(self):
        """
        Applies date and department filter and sets model.trips accordingly.
        """
        # this function should create the filtered trips from filters
        self.trips = self.all_trips.copy()
        self.distance_range = (
            self.trips.distance.min(),
            self.trips.distance.max(),
        )


class ConsequenceCalculator:
    """
    ConsequenceCalculator class for computing economical, transport and emission consequences of a simulation


    Attributes

    ----------



    """

    def __init__(self, timeframe=None, states=None, settings=None):
        """
        Initiates the class with default timeframe on 30 days with default states on "current" and "simulation".
        The states will be used by the compute method to iterate over the elements in order to calculate the
        consequences.
        Parameters
        ----------
        timeframe   :   list of datetimes - [start time, end time] - defaults to [a month ago, now]
        states      :   list of strings - default to ["current", "simulation"]
        """
        if states is None:
            states = ["current", "simulation"]
        if timeframe is None:
            now = datetime.datetime.now()
            amonthback = now - datetime.timedelta(days=30)
            self.timeframe = [amonthback, now]
        self.table_keys = [
            "CO2-udledning [kg]",
            "Antal ture uden køretøj",
            "Udbetalte kørepenge [kr]",
            "Årlig gns. omkostning [kr/år]",
            "POGI årlig brændstofforbrug [kr/år]",
            "POGI CO2-ækvivalent udledning [CO2e]",
            "POGI samfundsøkonomiske omkostninger [kr/år]",
            "Samlet omkostning [kr/år]",
        ]
        if settings is None:
            settings = {}
        self.settings = settings
        self.states = states
        self.values = {
            f"{state[:3]}": [0] * len(self.table_keys) for state in self.states
        }

        self.consequence_table = {}

        # capacity
        for state in states:
            setattr(
                self,
                f"{state}_capacity",
                {"unassigned_trips": [0, 0], "trip_capacity": [0, 0]},
            )
            setattr(self, f"{state[:3]}_allowance", 0)

        self.capacity_source = {}

        self.update_consequence_table()
        self.update_capacity_source()

    def update_consequence_table(self):
        """Update the consequence table"""
        self.consequence_table = {
            "keys": self.table_keys,
        }
        for state in self.states:
            self.consequence_table[f"{state[:3]}_values"] = getattr(self, "values")[
                f"{state[:3]}"
            ]

    def update_capacity_source(self):
        d = {"timeframe": self.timeframe}

        for state in self.states:
            c_name = state[:3]
            d[f"{c_name}_unassigned_trips"] = getattr(self, f"{state}_capacity")[
                "unassigned_trips"
            ]
            d[f"{c_name}_trip_capacity"] = getattr(self, f"{state}_capacity")[
                "trip_capacity"
            ]
        self.capacity_source = d

    def compute(self, simulation, drivingallowance, tco_period):
        """
        The compute function that calculate the consequences;
        1) explicit CO2 emission,
            Calculated by taking the product of each vehicle's allocated km to a yearly approximation
            and the vehicle's explict noted gram CO2-emission pr. kilometer. Since this is only relevant
            for fossile vehicles, we don't report this number because it would always show the electrical vehicles
            to have 0 emission. Hence, we refer to 6) yearly CO2-e.
        2) number of trips without vehicle,
            Sum of all trips that have no vehicle assigned. Displayed in the simulation.trips.[inventory_type_column]
            with a value of -1.
        3) pay out in driving allowance,
            In order to punish the unallocated trips driving allowance is simulated. All unallocated trips are summed
            to a yearly approximation. The driving allowance is paid in rates; 3.44 kr. pr. km. under 840 kilometer
            threshold and 1.90 kr. pr. km. above 840 kilometer threshold.
        4) yearly average expense on hardware
            Is calculated by taking the sum of the reported "omkostning_aar" for all vehicles
        5) yearly expense on fuel
            Is calculated through the tco_calcluate.TCOCalculator, which is based on the tool
            "tco-vaerktoej-motorkoeretoejer" from POGI. Check the details on the class.
        6) yearly CO2-e expense (implicit CO2 emission)
            Is calculated through the tco_calcluate.TCOCalculator, which is based on the tool
            "tco-vaerktoej-motorkoeretoejer" from POGI. Check the details on the class.
        7) total yearly expense
            Is calculated by taking the sum of driving allowance, yearly average expense on hardware and yearly expense
            on fuel.

        Parameters
        ----------
        simulation  :   model.Simulation class - the simulation class with it's associated trips. The inventory - and distance columns of the
                            simulation.trips frame holds the necessary data to calculate the aforementioned values.
        drivingallowance    :   model.DrivingAllowance - a DrivingAllowance class or None.
        tco_period  :   list of two ints ([0, 1]) - the selected tco_period which is passed to the TCO_Calculator object.
                            First int to define projection periode, second int to define the evaluation period.

        Returns
        -------

        """
        if drivingallowance is None:
            drivingallowance = DrivingAllowance(self.settings)
        self.timeframe = [
            simulation.trips.trips.start_time.min(),
            simulation.trips.trips.end_time.max(),
        ]
        days = (self.timeframe[1] - self.timeframe[0]).total_seconds() / 3600 / 24
        if days <= 0:
            # we have to assume that there's at least one day worth of data
            days = 1

        calculate_this = {
            key: {val: 0 for val in self.table_keys} for key in self.states
        }
        self.store = {state: [] for state in self.states}
        vehicles_used = {key: {} for key in self.states}
        for roundtrip in simulation.trips:
            # co2 udledning
            # record the vehicle and how much it spent
            for state in self.states:
                if getattr(roundtrip, f"{state}_type") == -1:
                    pass
                elif getattr(roundtrip, state) not in vehicles_used[state]:
                    co2_pr_km = (
                        0
                        if pd.isna(roundtrip[state].co2_pr_km)
                        else roundtrip[state].co2_pr_km
                    )
                    vehicles_used[state][getattr(roundtrip, state)] = roundtrip.distance
                    calculate_this[state]["CO2-udledning [kg]"] += (
                        co2_pr_km * roundtrip.distance
                    )
                else:
                    co2_pr_km = (
                        0
                        if pd.isna(roundtrip[state].co2_pr_km)
                        else roundtrip[state].co2_pr_km
                    )
                    vehicles_used[state][
                        getattr(roundtrip, state)
                    ] += roundtrip.distance
                    calculate_this[state]["CO2-udledning [kg]"] += (
                        co2_pr_km * roundtrip.distance
                    )

        for state in self.states:
            c_name = state[:3]

            # antal ture uden køretøj
            calculate_this[state]["Antal ture uden køretøj"] = (
                simulation.trips.trips[f"{state}_type"] == -1
            ).sum()

            # straf ukørte ture
            undriven = simulation.trips.trips[
                simulation.trips.trips[f"{state}_type"] == -1
            ]
            undriven_km = undriven.distance.sum()
            undriven_yearly = undriven_km / days * 365

            # udbetalte kørepenge
            allowance = drivingallowance.calculate_allowance(undriven_yearly)
            # update drivmiddel if input from front-end
            drivmiddel = self.settings.get("undriven_type", "benzin")
            wltp_medarbejder = self.settings.get("undriven_wltp", 20)

            # udledning
            undriven_tco = TCOCalculator(
                koerselsforbrug=undriven_yearly,
                drivmiddel=drivmiddel,
                bil_type=drivmiddel,
                antal=1,
                evalueringsperiode=1,
                fremskrivnings_aar=tco_period[0],
                braendstofforbrug=wltp_medarbejder,
                elforbrug=wltp_medarbejder,
                **self.settings,
            )

            co2e_undriven, samfund_undriven = undriven_tco.ekstern_miljoevirkning(
                sum_it=True
            )
            calculate_this[state][
                "POGI CO2-ækvivalent udledning [CO2e]"
            ] += co2e_undriven
            calculate_this[state][
                "POGI samfundsøkonomiske omkostninger [kr/år]"
            ] += samfund_undriven
            self.store[state].append(
                [
                    "",
                    f"{drivmiddel.capitalize()} Medarbejderbil",
                    round(undriven_km),
                    round(undriven_yearly),
                    wltp_medarbejder,
                    round(co2e_undriven / 365 * days * 1000, 2),
                    round(co2e_undriven * 1000, 2),
                    round(allowance, 1),
                    0,
                    round(samfund_undriven, 1),
                    round(allowance + samfund_undriven),
                ]
            )
            # årlig gns. omkostning
            yearly_cost = sum(
                v.omkostning_aar
                for v in getattr(simulation.fleet_manager, f"{state}_fleet")
            )
            calculate_this[state]["Årlig gns. omkostning [kr/år]"] = yearly_cost

            # pogi årlig brændstofforbrug
            # pogi co2-ækvivalent udledning
            # pogi samfundsøkonomiske omkostninger
            for vehicle, distance in vehicles_used[state].items():
                distance_yearly = distance / days * 365
                vehicle_tco = TCOCalculator(
                    koerselsforbrug=distance_yearly,
                    drivmiddel=vehicle.fuel,
                    bil_type=vehicle.fuel,
                    antal=1,
                    evalueringsperiode=1,  # tco_period[1],
                    fremskrivnings_aar=tco_period[0],
                    braendstofforbrug=vehicle.wltp_fossil,
                    elforbrug=vehicle.wltp_el,
                    **self.settings,
                )
                co2e, samfund = vehicle_tco.ekstern_miljoevirkning(sum_it=True)
                driftsomkostning = (
                    0
                    if pd.isna(vehicle_tco.driftsomkostning)
                    else vehicle_tco.driftsomkostning
                )
                samfund = 0 if pd.isna(samfund) else samfund
                calculate_this[state][
                    "POGI årlig brændstofforbrug [kr/år]"
                ] += driftsomkostning
                calculate_this[state][
                    "POGI samfundsøkonomiske omkostninger [kr/år]"
                ] += samfund
                calculate_this[state]["POGI CO2-ækvivalent udledning [CO2e]"] += co2e
                self.store[state].append(
                    [
                        vehicle.name,
                        f"{vehicle.make} {vehicle.model} {vehicle.name.split('_')[-1]}",
                        round(distance),
                        round(distance_yearly),
                        get_emission(vehicle),
                        round(co2e / 365 * days * 1000, 2),
                        round(co2e * 1000, 2),
                        round(vehicle.omkostning_aar, 1),
                        round(driftsomkostning, 1),
                        round(samfund, 1),
                        round(vehicle.omkostning_aar + samfund + driftsomkostning),
                    ]
                )
            for vv in getattr(simulation.fleet_manager, f"{state}_fleet"):
                if any([vv.name == stored[0] for stored in self.store[state]]):
                    continue
                # vehicles below did not have any allocated kms
                self.store[state].append(
                    [
                        vv.name,
                        f"{vv.make} {vv.model} {vv.name.split('_')[-1]}",
                        0,
                        0,
                        get_emission(vv),
                        0,
                        0,
                        round(vv.omkostning_aar, 1),
                        0,
                        0,
                        round(vv.omkostning_aar),
                    ]
                )

            self.store[state] = [a[1:] for a in self.store[state]]
            # compute capacity
            # for each day, compute number of trips
            sub = simulation.trips.trips[
                ["start_time"] + [f"{state}_type" for state in self.states]
            ].copy(deep=True)

            sub[f"{c_name}_unassigned"] = sub[f"{state}_type"] == -1
            resampled = sub.resample("D", on="start_time")[
                [f"{c_name}_unassigned"]
            ].sum()
            self.timeframe = resampled.index.to_pydatetime()
            n = len(self.timeframe)
            getattr(self, f"{state}_capacity")["unassigned_trips"] = list(
                getattr(resampled, f"{c_name}_unassigned")
            )
            getattr(self, f"{state}_capacity")["trip_capacity"] = n * [0]

            calculate_this[state]["Samlet omkostning [kr/år]"] = (
                allowance
                + calculate_this[state]["Årlig gns. omkostning [kr/år]"]
                + calculate_this[state]["POGI årlig brændstofforbrug [kr/år]"]
                + calculate_this[state]["POGI samfundsøkonomiske omkostninger [kr/år]"]
            )

            getattr(self, "values")[c_name] = [
                calculate_this[state][key] for key in self.table_keys
            ]
            getattr(self, "values")[c_name][2] = allowance

        # update sources for frontend
        self.update_consequence_table()
        self.update_capacity_source()


class FleetManager:
    """FleetManager class keeps track of the fleets and the booking.

    parameters
    ----------
    options: options of type model.OptionsFile

    attributes
    ----------
    vehicle_factory : types of vehicles in fleet of type vehicle.VehicleFactory
    simulation_fleet : simulation fleet of type vehicle.FleetInventory
    current_fleet : current fleet of type vehicle.FleetInventory

    """

    def __init__(self, settings=None):
        # set the available vehicles
        self.vehicle_factory = vehicle.VehicleFactory()

        # initialise empty fleets
        self.simulation_fleet = vehicle.FleetInventory(
            self.vehicle_factory, name="simulation", settings=settings
        )
        self.current_fleet = vehicle.FleetInventory(
            self.vehicle_factory, name="current", settings=settings
        )

    def set_timestamps(self, ts):
        """Set timestamps of fleets"""
        self.simulation_fleet.set_timestamps(ts)
        self.current_fleet.set_timestamps(ts)


class Simulation:
    """
    The major Simulation class for performing simulation on trips.

    parameters
    ----------
    trips : trips for simulation of type modelTrips
    fleet_manager : fleet manager for handling fleets of type model.FleetManager
    progress_callback : None
    tabu    :   bool - to let the simulation know if it's a tabu simulation. If so, only the simulation setup will be
                simulated, and not the current.
    intelligent_simulation  :   bool - should intelligent simulation be used, i.e. Qampo algorithm to allocate trips.
    timestamp_set   :   bool -  whether the simulation trips already have generated timeslots

    """

    def __init__(
        self,
        trips,
        fleet_manager,
        progress_callback,
        tabu=False,
        intelligent_simulation=False,
        timestamps_set=False,
        timeslots=True,
    ):
        self.trips = trips
        self.fleet_manager = fleet_manager
        self.progress_callback = progress_callback
        self.tabu = tabu
        self.timeslots = timeslots
        self.timestamps_set = timestamps_set

        self.useQampo = intelligent_simulation

        if self.timestamps_set is False and self.timeslots:
            self.time_resolution = pd.Timedelta(minutes=1)
            start_day = self.trips.trips.start_time.min().date()
            end_day = self.trips.trips.end_time.max().date() + pd.Timedelta(days=1)
            self.timestamps = pd.period_range(
                start_day, end_day, freq=self.time_resolution
            )
            self.trips.set_timestamps(self.timestamps)

        # dummy vehicle for unassigned trips
        self.unassigned_vehicle = vehicle.Unassigned(name="Unassigned")

    def run(self):
        """Runs simulation of current and simulation fleet"""
        # push timetable to vehicle fleet
        if self.timeslots:
            self.fleet_manager.set_timestamps(self.timestamps)

        if self.useQampo:
            if self.tabu:
                self.run_single_qampo(self.fleet_manager)
            else:
                self.run_single_qampo(self.fleet_manager.simulation_fleet)
                self.run_single(self.fleet_manager.current_fleet)
        else:
            if self.tabu:
                self.run_single(self.fleet_manager)
            else:
                self.run_single(self.fleet_manager.simulation_fleet)
                self.run_single(self.fleet_manager.current_fleet)

    def run_single_qampo(self, fleet_inventory, algorithm_type="exact_mip"):
        """Convenience function for running simualtion on a single fleet through qampo api.

        parameters
        ----------
        fleet_inventory : fleet inventory to run simualtion on. Type model.FleetInventory.
        algorithm_type : the algorithm the qampo api uses. must be either 'exact_mip', 'greedy' or 'exact_cp'
        """
        # setting up api parameters
        # Helper function: Changes start day to be 00:00 of end day if more time is spend driving in end day
        a_day_delta = datetime.timedelta(days=1)
        last_second_delta = datetime.timedelta(hours=23, minutes=59, seconds=59)

        self.trips.trips = self.trips.trips.reset_index().iloc[:, 1:]
        self.trips.trips["tripid"] = self.trips.trips.index.values
        self.trips.trips["name"] = self.trips.trips.index.values
        self.trips.trips["multiday"] = False
        if self.trips.trips.iloc[-1].name != len(self.trips.trips) - 1:  # and \
            # "belongs_tos" not in self.trips.trips.columns:
            raise IndexError(
                "Some initial trips were falsely filtered after re-indexing."
            )

        bike_fleet = fleet_inventory.copy_bike_fleet("bike_fleet")
        if self.timestamps_set is False and self.timeslots:
            bike_fleet.set_timestamps(self.timestamps)
        self.run_single(bike_fleet)

        def set_start_times(trip):
            if trip["start_time"].normalize() != trip["end_time"].normalize():
                if (
                    trip["end_time"].normalize() - trip["start_time"].normalize()
                    > a_day_delta
                ):
                    # the trip spans multiple days, so we should be careful with booking of this
                    # additional bookkeeping applies hence the additional parameters
                    trip["multiday"] = True
                    trip["original_start_time"] = trip["start_time"]
                    trip["original_end_time"] = trip["end_time"]
                    trip["end_time"] = (
                        trip["start_time"].normalize() + last_second_delta
                    )
                    return trip
                time_in_start_day = trip["end_time"].normalize() - trip["start_time"]
                time_in_end_day = trip["end_time"] - trip["end_time"].normalize()
                if time_in_start_day < time_in_end_day:
                    trip["start_time"] = trip["end_time"].normalize()
            return trip

        trips_day_fixed = map(
            lambda trip: set_start_times(trip),
            self.trips.trips[self.trips.trips.bike_fleet_type == -1].to_dict("records"),
        )
        trips_day_fixed = sorted(trips_day_fixed, key=operator.itemgetter("start_time"))

        # Splitting trips into distinct days as the api can only work on a single day at a time
        # todo make it obvious that the intelligent allocation cannot handle multiday trips
        trips_pr_day = []
        for k, g in groupby(
            trips_day_fixed, lambda trip: trip["start_time"].normalize()
        ):
            trips_pr_day.append(list(g))

        # we're bookkeeping outside the qampo algorithm the long duration trips since it's not capable of handling
        # multiday trips. We check if a vehicle has been book for the long "original" trip, if so, we leave it out
        # of the fleet until then end of the day of the original end date.
        ongoing_multiday_trips = []
        response = []
        for trips_single_day in trips_pr_day:
            ongoing_multiday_trips = [
                trip
                for trip in ongoing_multiday_trips
                if (trip["trip"]["original_end_time"] + a_day_delta).normalize()
                > trips_single_day[0]["start_time"]
            ]  # find the trips that are still "going on" to get the vehicle id of the ones that should be skipped
            vehicles_on_long_duration_trips = [
                int(trip["vehicle"]) for trip in ongoing_multiday_trips
            ]
            data = self.generate_qampo_data(
                fleet_inventory,
                trips_single_day,
                skip_vehicles=vehicles_on_long_duration_trips,
            )
            fleet = qampo_fleet(**data["fleet"])
            trips = list(map(lambda T: qampo_trip(**T), data["trips"]))

            simulation = qampo_simulation.optimize_single_day(
                fleet, trips, AlgorithmType.EXACT_MIP
            )

            # is any of today's trips spanning multiple days?
            multiday_trips = list(
                filter(lambda trip: trip["multiday"], trips_single_day)
            )
            if any(multiday_trips):
                # find the ids of the relevant trips
                multiday_trips_ids = list(
                    map(lambda trip: trip["tripid"], multiday_trips)
                )

                # check if any multiday trip was booked
                # get the information if the trips have been booked in the simulation
                booked_multiday_trips = [
                    {
                        "vehicle": assignment.vehicle.id,
                        "trip": next(
                            filter(
                                lambda og_trip: trip.id == og_trip["tripid"],
                                multiday_trips,
                            )
                        ),
                    }
                    for assignment in simulation.assignments
                    for trip in assignment.route.trips
                    if trip.id in multiday_trips_ids
                ]
                ongoing_multiday_trips += booked_multiday_trips

            response.append(simulation)

        # Booking vehicles in accordance to the result from qampo api
        trip_vehicle = [[]] * len(self.trips.trips)
        trip_vehicle_type = [[]] * len(self.trips.trips)
        for content in response:
            for assignment in content.assignments:
                id = assignment.vehicle.id
                v = next(filter(lambda v: v.vehicle_id == id, fleet_inventory))
                for t in assignment.route.trips:
                    trip = next(filter(lambda tt: tt["tripid"] == t.id, self.trips))
                    v.book_trip(trip, self.timeslots)
                    trip_vehicle[trip.name] = v
                    trip_vehicle_type[trip.name] = v.vehicle_type_number

        for k in range(len(trip_vehicle)):
            if type(trip_vehicle[k]) is list:
                trip_vehicle[k] = self.trips.trips.bike_fleet[k]
                trip_vehicle_type[k] = self.trips.trips.bike_fleet_type[k]

        self.trips.trips[fleet_inventory.name] = trip_vehicle
        self.trips.trips[fleet_inventory.name + "_type"] = trip_vehicle_type

    def generate_qampo_data(self, fleet_inventory, trips, skip_vehicles=None):
        """Convenience function for converting fleet inventory and trips data to json format
        required by qampo api.

        parameters
        ----------
        fleet_inventory : fleet inventory to run simualtion on. Type model.FleetInventory.
        trips: trip data to run simulation on.
        """
        if skip_vehicles is None:
            skip_vehicles = []
        data = {
            "fleet": {
                "vehicles": [],
                # Needs to not be hard coded
                "employee_car": {
                    "variable_cost_per_kilometer": 20.0,
                    "co2_emission_gram_per_kilometer": 400.0,
                },
                "emission_cost_per_ton_co2": 5000.0,
            },
            "trips": [],
        }

        for v in fleet_inventory:
            if v.vehicle_type_number in [2, 3] or int(v.vehicle_id) in skip_vehicles:
                # skip the bikes as we handle those
                # skip the vehicles on multi day trips
                continue
            vehicle = {
                "id": int(v.vehicle_id),
                "name": v.name,
                "range_in_kilometers": float(v.max_distance_per_day),
                "variable_cost_per_kilometer": v.vcprkm,
                "maximum_driving_in_minutes": 1440
                if pd.isna(v.sleep)
                else (24 - v.sleep) * 60,
                "co2_emission_gram_per_kilometer": v.qampo_gr,
            }
            data["fleet"]["vehicles"].append(vehicle)

        for t in trips:
            trip = {
                "id": int(t["tripid"]),
                "start_time": t["start_time"].strftime("%Y-%m-%dT%H:%M:%S"),
                "end_time": t["end_time"].strftime("%Y-%m-%dT%H:%M:%S"),
                "length_in_kilometers": float(round(t["distance"], 2)),
            }
            data["trips"].append(trip)

        return data

    def run_single(self, fleet_inventory):
        """Convenience function for running simualtion on a single fleet

        Takes the fleet and iterates over the trips to see which, if any, vehicle is available for booking.
        If the fleet_inventory name is current, the vehicles are booked according to its recorded trips.
        This will overwrite any rules implied by the simulation, e.g. vehicle cannot be booked for a trip on the
        same minute stamp as it ends a trips, sleep rules for electrical cars etc.

        The vehicles should be sorted according to the desired priority (defaults to co2 emission). For every trip the
        first available vehicle is booked for the trips.

        parameters
        ----------
        fleet_inventory : fleet inventory to run simulation on. Type model.FleetInventory.
        """
        # loop over trips
        trip_vehicle = []
        trip_vehicle_type = []
        flagged = []
        for t in self.trips:
            booked_real = False
            if fleet_inventory.name == "current":
                # overwrites the simulated booking to reflect "reality"
                if any([str(a.id) == str(t.car_id) for a in fleet_inventory]):
                    for v in fleet_inventory:
                        if str(v.id) == str(t.car_id):
                            booked, acc, avail = v.bypass_book(
                                t, self.timeslots
                            )  # v.book_trip(t)

                            if booked:
                                trip_vehicle.append(v)
                                trip_vehicle_type.append(v.vehicle_type_number)
                                booked_real = True
                                break
                else:
                    # the car that drove the trip in real life is not part of the selected "current" fleet.
                    if t.car_id not in flagged:
                        logger.info(
                            f"********** car id from trips not in {str(t.car_id)}"
                        )
                        flagged.append(t.car_id)

            if booked_real:
                continue
            # loop over vehicles and check for availability
            booked = False
            for v in fleet_inventory:
                booked, acc, avail = v.book_trip(t, self.timeslots)

                if booked:
                    trip_vehicle.append(v)
                    trip_vehicle_type.append(v.vehicle_type_number)

                    # local sorting on km driven of same obj weight vehicles
                    fleet_inventory.set_sort_index(v.original_name)
                    break

            if not booked:
                trip_vehicle.append(self.unassigned_vehicle)
                trip_vehicle_type.append(self.unassigned_vehicle.vehicle_type_number)

        # add vehicles to trips
        self.trips.trips[fleet_inventory.name] = trip_vehicle
        self.trips.trips[fleet_inventory.name + "_type"] = trip_vehicle_type

    def __str__(self):
        return str(self.trips)


class DrivingAllowance:
    """Class for containing and manipulating driving allowance."""

    def __init__(self, settings=None):
        self.allowance = {"low": 3.44, "high": 1.90}
        self.distance_threshold = 840
        if settings:
            self.__dict__.update(**settings)

    def __str__(self):
        return (
            f"Driving allowance {self.allowance}\n  Dist: {self.distance_threshold}\n"
        )

    def calculate_allowance(self, yearly_distance):
        """
        Method for calculating the driving allowance for unallocated trips. Defines a threshold of 840 km which is
        eligible to get the high allowance fee, from which the fee drops to the low allowance. Especially useful in
        tabu search in order not to favor unallocated trips because it is cheap.

        Parameters
        ----------
        yearly_distance :   int - sum of kilometers without an allocated vehicle

        Returns
        -------
        driving allowance   :   int - sum of money paid out in driving allowance to attribute the unallocated trips
        """
        if yearly_distance > self.distance_threshold:
            allowance_to_pay = sum(
                [
                    self.distance_threshold * self.allowance["low"],
                    (yearly_distance - self.distance_threshold)
                    * self.allowance["high"],
                ]
            )
        else:
            allowance_to_pay = yearly_distance * self.allowance["low"]
        return allowance_to_pay


class Model:
    """Model class for MVC pattern of the simulation tool.

    Parameters
    ----------
    location    :   int - id of the location selected for the simulation
    dates   :   list of datetime - the selected time frame for the trips to simulated - i.e. [start time, end time]
                will define the period from which the trips will be pulled.

    """

    def __init__(
        self, location=None, dates=None, tco_period=(0, 1), settings=None, vehicles=None
    ):
        """
        Method for handling all interacting classes.
        Essential elements to be loaded are:
        trips   :   Trips class - holding all information on the trips from defined filters (location, dates)
        fleet_manager   :   FleetManager class - to hold the current - and simulation fleet will initialise vehicle
                                objects
        consequence_calculator  :   ConsequenceCalculator class - to associate the simulation with
                                    the simulation results
        drivingallowance    :   DrivingAllowance class - to attribute unallocated trips with associated inventory_type
                                value -1

        Parameters
        ----------
        location    :   int - id of the location selected for the simulation
        dates   :   list of datetime - the selected time frame for the trips to simulated - i.e. [start time, end time]
                    will define the period from which the trips will be pulled.
        tco_period  : tuple or list of two ints defining the projection period and evaluation period of the
                        TCO calculation
        """
        if settings is None:
            settings = {}
        self.settings = settings
        self.sub_time = (
            1 if "sub_time" not in self.settings else self.settings["sub_time"]
        )

        self.trips = Trips(
            location=location,
            dates=dates,
            shifts=settings.get("shifts", None),
            vehicles=vehicles,
        )
        if len(self.trips.all_trips) == 0:
            return
        self.fleet_manager = FleetManager(self.settings)

        self.consequence_calculator = ConsequenceCalculator(settings=self.settings)

        # static references to data sources needed by the view
        self.consequence_source = self.consequence_calculator.consequence_table
        self.capacity_source = self.consequence_calculator.capacity_source
        self.progress_source = {"start": [0.0], "progress": [0.0]}

        self.progress_callback = lambda x: print(f"Simulér ({100 * x}%)")

        # update histogram sources
        self.current_hist_datasource = {}
        self.simulation_hist_datasource = {}
        self.compute_histogram()

        # driving allowance
        self.drivingallowance = DrivingAllowance(settings=self.settings)
        self.tco_period = tco_period

    def _update_progress(self, progress):
        """Tester function for updating progress of simualtion"""
        self.progress_source = {"start": [0.0], "progress": [progress]}
        if progress > (1.0 - 1e-12):
            self.progress_callback(False)
        else:
            self.progress_callback(True)

    def _update_progress_stdout(self, progress):
        print(progress)

    def run_simulation(
        self,
        intelligent_simulation,
        bike_max_distance=5,
        bike_time_slots=None,
        max_bike_time_slot=0,
        bike_percentage=100,
        km_aar=False,
        use_timeslots=True,
    ):
        """
        Create and run a simulation. Updates histograms and consequence information.
        Sets up the simulation and initialises the fleets and runs the simulation.

        Parameters
        ------------
        intelligent_simulation  :   bool - to be passed to the simulation object
        bike_max_distance   :   int - to define bike configuration, max allowed distance for a bike trip
        bike_time_slots :   bike configuration time slot, when are bike vehicles allowed to accept trips
        max_bike_time_slot  :   bike configuration, how many bike slots are available for bikes
        bike_percentage :   how many percentage of the trips that qualifies for bike trip should be accepted
        km_aar  :   bool - should the vehicles associated km_aar constrain the vehicle from accepting trips when the
                        yearly capacity is reached. Only available on intelligent_simulation = False

        """
        if bike_time_slots is None:
            bike_time_slots = []
        self.simulation = Simulation(
            self.trips,
            self.fleet_manager,
            self._update_progress,
            intelligent_simulation=intelligent_simulation,
            timeslots=use_timeslots,
        )

        Bike.max_distance_pr_trip = bike_max_distance
        ElectricBike.max_distance_pr_trip = bike_max_distance
        Bike.allowed_driving_time_slots = bike_time_slots
        ElectricBike.allowed_driving_time_slots = bike_time_slots
        Bike.max_time_slot = max_bike_time_slot
        ElectricBike.max_time_slot = max_bike_time_slot
        Bike.percentage = bike_percentage
        ElectricBike.percentage = bike_percentage
        Bike.bike_speed = self.settings.get("bike_settings", {}).get("bike_speed", 8)
        ElectricBike.electrical_bike_speed = self.settings.get("bike_settings", {}).get(
            "electrical_bike_speed", 12
        )

        days = (
            self.trips.trips.iloc[-1].end_time - self.trips.trips.iloc[0].start_time
        ).days
        # collect data from frontend
        self.simulation.fleet_manager.current_fleet.initialise_fleet(
            km_aar, sub_time=self.sub_time, settings=self.settings, days=days
        )
        self.simulation.fleet_manager.simulation_fleet.initialise_fleet(
            km_aar, sub_time=self.sub_time, settings=self.settings, days=days
        )

        self.simulation.run()

        # update data sources for frontend
        self.compute_histogram()

        # update consequence sources for frontend
        self.consequence_calculator.compute(
            self.simulation, self.drivingallowance, self.tco_period
        )

    def compute_histogram(self, mindist=0, maxdist=None):
        """Compute histograms for current and simulation

        parameters
        ----------
        mindist : defaults to 0. Minimum distance to use for histograms
        maxdist : Maximum distance to use for histograms. If None, use the maximum distance of the trips

        """
        if maxdist is None:
            maxdist = self.trips.trips.distance.max()

        delta = (maxdist - mindist) / 20.0
        delta = max(delta, 0.001)
        distance_edges = np.arange(mindist, maxdist, delta)

        self.current_hist = {"edges": distance_edges[:-1]}
        self.simulation_hist = {"edges": distance_edges[:-1]}

        for i in range(-1, 4):
            # current
            d = self.trips.trips.distance[self.trips.trips.current_type == i]
            counts, edges = np.histogram(d, bins=distance_edges)
            self.current_hist[vehicle.vehicle_mapping[i]] = counts

            # simulation
            d = self.trips.trips.distance[self.trips.trips.simulation_type == i]
            counts, edges = np.histogram(d, bins=distance_edges)
            self.simulation_hist[vehicle.vehicle_mapping[i]] = counts

        self.current_hist_datasource = self.current_hist
        self.simulation_hist_datasource = self.simulation_hist

    @staticmethod
    def compute_histogram_static(trips: pd.DataFrame, mindist=0, fleet_name="simulation"):
        maxdist = trips.distance.max()
        delta = (maxdist - mindist) / 20.0
        delta = max(delta, 0.001)
        distance_edges = np.arange(mindist, maxdist, delta)

        hist = {"edges": distance_edges[:-1]}

        for i in range(-1, 4):
            d = trips.distance[trips[f"{fleet_name}_type"] == i]
            counts, edges = np.histogram(d, bins=distance_edges)
            hist[vehicle.vehicle_mapping[i]] = counts

        return hist
