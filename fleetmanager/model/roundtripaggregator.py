import json
import math
import operator
import os
from datetime import date, datetime, timedelta
from typing import List, TypedDict, Callable, Union
from sqlalchemy.orm import Session, sessionmaker

import numpy as np
import pandas as pd

from fleetmanager.data_access import RoundTripSegments, RoundTrips, Cars
from fleetmanager.logging import logging

logger = logging.getLogger(__name__)

route_segment = TypedDict(
    "route_segment", {"distance": int, "start_time": datetime, "end_time": datetime}
)


route = TypedDict(
    "route",
    {
        "start_time": datetime,
        "end_time": datetime,
        "start_latitude": float,
        "start_longitude": float,
        "end_latitude": float,
        "end_longitude": float,
        "car_id": int,
        "distance": float,
        "ids": list[int],
        "start_location_id": int,
        "segments": list[route_segment],
        "aggregation_type": str,
    },
)

car_model = TypedDict("car_model", {"id": int, "location": int})

start_location = TypedDict(
    "start_location",
    {
        "id": int,
        "latitude": float,
        "longitude": float,
    },
)

start_locations = List[start_location]


def end_is_same_home(
    end_point: tuple,
    allowed_starts: start_locations,
    home_criteria: float | int,
    closest_home: int,
) -> bool:
    """
    Function to determine whether the endpoint of a log is the same as the start.
    Useful for discard bad logs, that has long duration but no travelling. Will return True if endpoint is
    home_criteria distance within closest home
    """
    end_location_distance_to_starts = map(
        lambda start: (
            start["id"],
            calc_distance((start["latitude"], start["longitude"]), end_point),
        ),
        allowed_starts,
    )
    closest_end_home, closest_end_distance = min(
        end_location_distance_to_starts, key=lambda x: x[1]
    )
    if closest_end_distance < home_criteria and closest_home == closest_end_home:
        return True
    return False


def split_roundtrip(
    roundtrip: list,
    stop_duration_limit: timedelta,
    duration_limit: timedelta,
    distance_criteria: float | int,
) -> list:
    """
    Function to forcefully split collected trips in to "unnatural" roundtrips because home could not be found
    within the defined criteria. It takes the collected trips and aggregate consecutive trips to a roundtrip if:
        stop_duration_limit is exceeded for the next start (break in between driving)
        duration_limit is exceeded if the trip is added
        distance_criteria is met

    roundtrip: list of trip objects
    stop_duration_limit: timedelta object defining the maximum allowed break time
    duration_limit: timedelta object defining the maximum allowed roundtrip time
    distance_criteria: minimum distance required to accept as roundtrip

    """

    split_roundtrips = []
    current_roundtrip = []
    if (
        roundtrip[0].stop_duration > stop_duration_limit
        and roundtrip[0].distance < distance_criteria
    ):
        pass
    else:
        if roundtrip[0].stop_duration > stop_duration_limit:
            split_roundtrips.append([roundtrip[0]])
        else:
            current_roundtrip = [roundtrip[0]]

    for trip in roundtrip[1:]:
        if (
            len(current_roundtrip) > 0
            and trip.end_time - current_roundtrip[0].start_time > duration_limit
        ):
            # end roundtrip before adding new trip if the roundtrip duration gets too long
            if (
                sum(t.distance for t in current_roundtrip) > distance_criteria
            ):  # and len(current_roundtrip) >= 2:
                split_roundtrips.append(current_roundtrip)
            current_roundtrip = [trip]
        elif trip.stop_duration > stop_duration_limit:
            # end the roundtrip after adding the trip because the next start is too long
            current_roundtrip.append(trip)
            if (
                sum(t.distance for t in current_roundtrip) > distance_criteria
            ):  # and len(current_roundtrip) >= 2:
                split_roundtrips.append(current_roundtrip)
            current_roundtrip = []
        else:
            # add the trip to the roundtrip and continue
            current_roundtrip.append(trip)

    # if so we'd ruin a possible natural aggregation if we add it
    if (
        current_roundtrip
        and current_roundtrip[-1].end_time - current_roundtrip[0].start_time
        < duration_limit
        and sum(t.distance for t in current_roundtrip) > distance_criteria
    ):
        split_roundtrips.append(current_roundtrip)

    return split_roundtrips


def returns_to_home(
    trips: pd.DataFrame,
    current_trip_index: int,
    home: int,
    allowed_starts: start_locations,
    search_time: datetime,
    home_criteria: float | int,
) -> bool:
    """
    Function to determine whether the vehicle ends up at the recorded home within the given time frame (search_time).
    Whenever we find a new probable home location while making a roundtrip, we need to find out whether the car
    continues driving trips from the "new-found home" or whether it returns to its original home within the allowed
    time frame. Hence, the search_time is expected to be a specific datetime for when we expect the vehicle to be home.
    It should be calculated from the current trip duration and adding whatever time there's left before we hit the
    allowed trip duration

    trips: the complete trip frame for the car
    current_trip_index: the index of the current trip
    home: the id of the current home
    allowed_starts: the list of dict of start locations
    search_time: the time we'd expect the vehicle to return to home
    home_criteria: the distance that defines home
    """
    locations_to_look_for = list(
        filter(lambda start: start["id"] == home, allowed_starts)
    )

    # prepare the frame with the trips where we look for original home
    future_trips = trips.iloc[current_trip_index + 1 :].copy()
    future_trips = future_trips[future_trips.end_time <= search_time]
    if len(locations_to_look_for) == 0:
        logger.warning(
            f"There was no location to look for, car id: {trips.car_id.unique()}, home location: {home}, "
            f"no of allowed starts:  {len(allowed_starts)}, start: {trips.start_time.max()}, end: "
            f"{trips.end_time.max()}"
        )
        return True
    for _, trip in future_trips.iterrows():
        current_position_start = (trip.start_latitude, trip.start_longitude)
        current_position_end = (trip.end_latitude, trip.end_longitude)

        # Calculate distances to home
        distance_to_home_start = min(
            map(
                lambda start: (
                    calc_distance(
                        (start["latitude"], start["longitude"]), current_position_start
                    )
                ),
                locations_to_look_for,
            )
        )
        distance_to_home_end = min(
            map(
                lambda start: (
                    calc_distance(
                        (start["latitude"], start["longitude"]), current_position_end
                    )
                ),
                locations_to_look_for,
            )
        )

        if (
            distance_to_home_start < home_criteria
            or distance_to_home_end < home_criteria
        ):
            # the car returns to original roundtrip home
            return True

    # the car does not return to it original roundtrip home
    return False


def calc_distance(coord1: tuple, coord2: tuple) -> float:
    """
    Simple distance function to measure the distance in km from two coordinates (lat, long) (lat, long)
    Parameters
    ----------
    coord1 : (latitude, longitude)
    coord2 : (latitude, longitude)

    Returns
    -------
    distance in km
    """
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371
    phi1 = lat1 * math.pi / 180
    phi2 = lat2 * math.pi / 180
    delta_phi = (lat2 - lat1) * math.pi / 180
    delta_lambda = (lon2 - lon1) * math.pi / 180

    a = math.sin(delta_phi / 2) * math.sin(delta_phi / 2) + math.cos(phi1) * math.cos(
        phi2
    ) * math.sin(delta_lambda / 2) * math.sin(delta_lambda / 2)

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def aggregator(
    car: car_model,
    car_trips: pd.DataFrame,
    allowed_starts: start_locations,
    allowed_stop_duration: timedelta = timedelta(hours=0.75),
    allowed_trip_duration: timedelta = timedelta(hours=10),
    home_criteria: float | int = 0.2,
    distance_criteria: float | int = 0.1,
    anonymise_gps: bool = True,
    only_natural_aggregation: bool = False,
    use_most_frequent_location: bool = False,
    pre_process: bool = True,
) -> list[route]:
    """
    Aggregates car trip data into a list of routes based on various criteria.

    This function takes a series of car trips and aggregates them into routes based on the proximity to allowed start
    locations, duration of stops, and other criteria. It returns a list of aggregated routes, each represented as a
    dictionary.

    Parameters:
        car (car_model): The car model information.
        car_trips (pd.DataFrame): A DataFrame containing car trip data.
        allowed_starts (start_locations): A list of allowed start locations.
        allowed_stop_duration (timedelta, optional): The maximum allowed stop duration between trips for them to be
            considered part of the same route. Defaults to 45 minutes. Is only enforced if roundtrip otherwise looks
            incorrectly
        allowed_trip_duration (timedelta, optional): The maximum allowed duration of a single trip. Defaults to 10 hours
        home_criteria (float | int, optional): The maximum allowed distance from an allowed start location for a trip to
            be considered starting or ending at home. Defaults to 0.2.
        distance_criteria (float | int, optional): The minimum required distance for a trip to be considered valid.
            Defaults to 0.1.
        anonymise_gps (bool, optional): If True, anonymise GPS coordinates in the output. Defaults to True.
        only_natural_aggregation (bool, optional): If True, only naturally aggregated routes (those that do not require
            additional conditions to be combined) are returned. Defaults to False.
        use_most_frequent_location (bool, optional): If True, use the most frequent location in the aggregation process.
            Defaults to False.
        pre_process (bool, optional): If True, time processing will happen within the function

    Returns:
        list[route]: A list of aggregated routes.

    Conditions and Logical Branches:
    1. Check for Empty Input: If the `car_trips` DataFrame is empty, return an empty list.

    2. Data Preprocessing: Convert start and end times to datetime objects and sort the trips by start time.
        Calculate the stop duration between trips.

    3. Initialisation: Initialise variables to store the state of the aggregation process, including lists to hold the
        current and completed routes, and variables to track the current home location and roundtrip distance.

    4. Main Loop: Iterate through the trips in `car_trips`.
        a. GPS Validity Check: Skip trips with invalid GPS coordinates.
        b. Home Location Identification: Identify if the trip starts or ends at a home location.
        c. Start New Route: If the car is at home and certain conditions are met, start a new route.
            - If the car returns to home within the allowed trip duration, consider updating the allowed trip duration.
        d. Complete Current Route: If the car returns to home and the route is long enough, complete the current route.
            - If `only_natural_aggregation` is False, split the route if it exceeds the allowed trip duration.
        e. Change of Home Location: If the car moves to a new home location and does not return home, start a new route.
        f. In-Between Trips: If allowed, account for trips that occur between natural aggregations.

    5. Route Finalisation: Convert the aggregated routes into the desired output format, anonymising GPS coordinates
        if requested.

    6. Post-processing: sanity of the roundtrips. Checks long duration trips and trips that has a low average km/h

    7. Output: Return the list of aggregated routes.
    """

    if len(car_trips) == 0:
        return []

    vicinity_log_ratio = 0.5  # the ratio threshold of logs within the vicinity that defines alternative trip duration
    vicinity_distance_ratio = 0.6  # the ratio threshold of distance within the vicinity that defines alternative trip
    # duration
    minimum_allowed_kmh = (
        0.2  # the minimum allowed km/h for roundtrips before they're forcefully split
    )
    original_allowed_trip_duration = allowed_trip_duration
    alternative_trip_duration = timedelta(
        hours=10
    )  # the alternative trip duration for trips that stays within vicinity

    if pre_process:
        car_trips["start_time"] = car_trips.start_time.apply(
            lambda x: datetime.strptime(x, "%Y-%m-%d %H:%M:%S") if type(x) is str else x
        )
        car_trips["end_time"] = car_trips.end_time.apply(
            lambda x: datetime.strptime(x, "%Y-%m-%d %H:%M:%S") if type(x) is str else x
        )

        car_trips = car_trips.sort_values(["start_time"]).reset_index().iloc[:, 1:]
        car_trips["stop_duration"] = (
            car_trips["start_time"].shift(-1) - car_trips["end_time"]
        )

    aggregating_types = []  # recording the type of aggregation for the roundtrips
    car_roundtrips = []  # list for holding the roundtrips
    current_roundtrip = []  # list for holding the current roundtrip
    current_home = None  # variable to hold the currently recorded home/location id
    roundtrip_distance = (
        0  # value for holding the travelled distance of the current roundtrip
    )
    anonymise_location = next(
        filter(lambda start: start["id"] == car["location"], allowed_starts)
    )
    anonymise_coordinates = (
        anonymise_location["latitude"],
        anonymise_location["longitude"],
    )
    frequency_to_locations = (
        car_trips.apply(
            lambda row: (
                lambda filtered: int(min(filtered, key=lambda x: x[1])[0])
                if filtered
                else 0
            )(
                list(
                    filter(
                        lambda it: it[-1] < home_criteria and pd.isna(it[-1]) is False,
                        map(
                            lambda start: (
                                start["id"],
                                calc_distance(
                                    (start["latitude"], start["longitude"]),
                                    (row["start_latitude"], row["start_longitude"]),
                                ),
                            ),
                            allowed_starts,
                        ),
                    )
                )
            ),
            axis=1,
        )
        .value_counts()
        .to_dict()
    )

    if 0 in frequency_to_locations:
        del frequency_to_locations[0]

    if frequency_to_locations:
        most_frequent_location, frequency = max(
            frequency_to_locations.items(), key=operator.itemgetter(1)
        )
    else:
        most_frequent_location = 0

    force_end = False
    for k, trip in enumerate(car_trips.itertuples()):
        current_start, current_end = (trip.start_latitude, trip.start_longitude), (
            trip.end_latitude,
            trip.end_longitude,
        )

        # check for GPS validity
        if (
            current_start == (0, 0)
            or any([pd.isna(a) for a in current_start + current_end])
            or current_end == (0, 0)
        ):
            continue

        closest_home, closest_distance = get_closest_home_distance(
            allowed_starts, current_start
        )

        # if the roundtrip has not yet started
        if (current_home is None or pd.isna(current_home)) and (
            (
                use_most_frequent_location
                and int(most_frequent_location) == int(closest_home)
            )
            or (use_most_frequent_location is False)
        ):
            # start the roundtrip if the car is at home
            if closest_distance < home_criteria:
                # account the logs in between natural aggregation if we allow it
                if only_natural_aggregation is False and len(current_roundtrip) != 0:
                    # assert inbetween roundtrips adhere to the criteria
                    new_roundtrips = split_roundtrip(
                        current_roundtrip,
                        allowed_stop_duration,
                        allowed_trip_duration,
                        distance_criteria,
                    )
                    car_roundtrips += new_roundtrips
                    aggregating_types += ["inbetween"] * len(new_roundtrips)
                    allowed_trip_duration = original_allowed_trip_duration
                    current_roundtrip = []

                # we take the start time of the roundtrip
                rt_starter = (
                    trip.start_time
                    if len(current_roundtrip) == 0
                    else current_roundtrip[0].start_time
                )

                # get the location frequency of all the points which is within the defined trip duration
                eligible_trips_location_frequency = locations_frequency(
                    car_trips[
                        (car_trips.start_time >= rt_starter)
                        & (car_trips.end_time <= rt_starter + allowed_trip_duration)
                    ].to_dict("records"),
                    allowed_starts,
                    home_criteria,
                )
                location_frequency_sorted = sorted(
                    eligible_trips_location_frequency.items(),
                    key=operator.itemgetter(1),
                    reverse=True,
                )
                # we check if the most frequent location of the roundtrip is current closest home and if the closest
                # home is as frequent as the most frequent
                if (
                    location_frequency_sorted and
                    location_frequency_sorted[0][0] != closest_home
                    and next(
                        filter(
                            lambda x: x[0] == closest_home, location_frequency_sorted
                        )
                    )[1]
                    <= location_frequency_sorted[0][1]
                ):
                    # we account the trip, but don't define it as a new current home
                    roundtrip_distance += trip.distance
                    current_roundtrip.append(trip)
                    continue

                # discard if the end is also home, then we can assume that next start is also home
                if end_is_same_home(
                    current_end, allowed_starts, home_criteria, closest_home
                ):
                    continue

                log_ratio, distance_ratio = stays_within_vicinity(
                    current_start, car_trips, trip.start_time, allowed_trip_duration
                )
                if (
                    log_ratio > vicinity_log_ratio
                    and distance_ratio > vicinity_distance_ratio
                ):
                    # if the majority of logs and distance is driven within the vicinity of 5 km we define the allowed
                    # trip duration as the alternative to make the roundtrips shorter
                    allowed_trip_duration = alternative_trip_duration

                current_home = closest_home
                current_roundtrip.append(trip)
                roundtrip_distance += trip.distance

            elif only_natural_aggregation is False:
                # we account for the in between natural aggregated roundtrips if allowed
                current_roundtrip.append(trip)

        # if the roundtrip has already started
        elif current_home is not None:
            # check if the current roundtrip exceed the allowed duration
            if (
                current_roundtrip[-1].end_time - current_roundtrip[0].start_time
                > allowed_trip_duration
            ):
                if closest_distance < home_criteria:
                    if only_natural_aggregation is False:
                        # the trip is at a start, so we'll start a new roundtrip from here
                        new_roundtrips = split_roundtrip(
                            current_roundtrip,
                            allowed_stop_duration,
                            allowed_trip_duration,
                            distance_criteria,
                        )
                        aggregating_types += ["too_long"] * len(new_roundtrips)
                        allowed_trip_duration = original_allowed_trip_duration
                        car_roundtrips += new_roundtrips
                    current_roundtrip = [trip]
                    roundtrip_distance += trip.distance
                    log_ratio, distance_ratio = stays_within_vicinity(
                        current_start, car_trips, trip.start_time, allowed_trip_duration
                    )
                    if (
                        log_ratio > vicinity_log_ratio
                        and distance_ratio > vicinity_distance_ratio
                    ):
                        # if the majority of logs and distance is driven within the vicinity of 5 km we define the
                        # allowed trip duration as the alternative to make the roundtrips shorter
                        allowed_trip_duration = alternative_trip_duration

                    current_home = closest_home
                else:
                    if only_natural_aggregation is False:
                        current_roundtrip.append(trip)
                        new_roundtrips = split_roundtrip(
                            current_roundtrip,
                            allowed_stop_duration,
                            allowed_trip_duration,
                            distance_criteria,
                        )
                        aggregating_types += ["too_long"] * len(new_roundtrips)
                        allowed_trip_duration = original_allowed_trip_duration

                        car_roundtrips += new_roundtrips
                    current_roundtrip = []
                    current_home = None

            elif (
                (
                    (closest_home == current_home and closest_distance < home_criteria)
                    or force_end
                )
                and sum(a.distance for a in current_roundtrip) > distance_criteria
                and len(current_roundtrip) >= 2
            ):
                if force_end and not (
                    closest_home == current_home and closest_distance < home_criteria
                ):
                    force_end = False
                aggregating_types.append(f"complete")
                allowed_trip_duration = original_allowed_trip_duration
                car_roundtrips.append(current_roundtrip)

                # check if the next is also the home if so we skip the current
                if end_is_same_home(
                    current_end, allowed_starts, home_criteria, closest_home
                ):
                    current_roundtrip = []
                    roundtrip_distance = 0
                    current_home = None
                else:
                    log_ratio, distance_ratio = stays_within_vicinity(
                        current_start, car_trips, trip.start_time, allowed_trip_duration
                    )
                    if (
                        log_ratio > vicinity_log_ratio
                        and distance_ratio > vicinity_distance_ratio
                    ):
                        # if the majority of logs and distance is driven within the vicinity of 5 km we define the
                        # allowed trip duration as the alternative to make the roundtrips shorter
                        allowed_trip_duration = alternative_trip_duration
                    current_roundtrip = [trip]
                    roundtrip_distance = trip.distance

            # end current roundtrip and start a new on if the car has moved to a new home
            elif (
                closest_home != current_home
                and closest_distance < home_criteria
                and
                # trip.stop_duration > allowed_stop_duration and  # less accurate than the below condition method
                not returns_to_home(
                    car_trips,
                    k,
                    current_home,
                    allowed_starts,
                    current_roundtrip[0].start_time + allowed_trip_duration,
                    home_criteria,
                )
            ):
                if (
                    sum(a.distance for a in current_roundtrip) > distance_criteria
                    and only_natural_aggregation is False
                ):
                    # qualified, the car does not return home, so we "cut" the roundtrip here
                    # to account for the driven kilometers
                    car_roundtrips.append(current_roundtrip)
                    aggregating_types.append("location_change")
                    allowed_trip_duration = original_allowed_trip_duration

                current_roundtrip = [trip]
                roundtrip_distance = trip.distance
                log_ratio, distance_ratio = stays_within_vicinity(
                    current_start, car_trips, trip.start_time, allowed_trip_duration
                )
                if (
                    log_ratio > vicinity_log_ratio
                    and distance_ratio > vicinity_distance_ratio
                ):
                    # if the majority of logs and distance is driven within the vicinity of 5 km we define the
                    # allowed trip duration as the alternative to make the roundtrips shorter
                    allowed_trip_duration = alternative_trip_duration
                current_home = closest_home
            else:
                # force end of next if the end is close... SKYHOST GPS SHIFT ISSUE
                closest_end_home, closest_end_distance = get_closest_home_distance(
                    allowed_starts, current_end
                )
                force_end = (
                    closest_end_distance < home_criteria
                    and closest_end_home == current_home
                )
                roundtrip_distance += trip.distance
                current_roundtrip.append(trip)

    roundtrips = [
        route_format(
            finished_route,
            car["id"],
            get_closest_home_distance(
                allowed_starts,
                (finished_route[0].start_latitude, finished_route[0].start_longitude),
            )[0],
            aggregation_type=aggregating_types[index],
            enforced_point=None if anonymise_gps is False else anonymise_coordinates,
        )
        for index, finished_route in enumerate(car_roundtrips)
    ]

    ### POST PROCESSING START ###
    # ensure that the last roundtrip is a completed one - otherwise we want to wait until the
    # following day to allow for more logs to get in, in order to allow the vehicle to possibly return to home
    if roundtrips:
        # find the trips that is longer than the defined alternative trip duration to perform sanity check
        roundtrip_longer_than_alternative_hours = list(
            filter(
                lambda roundtrip: roundtrip["end_time"] - roundtrip["start_time"]
                > alternative_trip_duration,
                roundtrips,
            )
        )
        if roundtrip_longer_than_alternative_hours:
            # get the most frequent locations for the roundtrips
            most_visited_locations = list(
                map(
                    lambda roundtrip, index: (
                        index,
                        locations_frequency(
                            car_trips[car_trips.id.isin(roundtrip["ids"])].to_dict(
                                "records"
                            ),
                            allowed_starts,
                            home_criteria=home_criteria,
                        ),
                    ),
                    roundtrip_longer_than_alternative_hours,
                    range(len(roundtrip_longer_than_alternative_hours)),
                )
            )

            # get the list of suspicious roundtrips from the criteria below
            suspicious_roundtrips = list(
                filter(
                    # to figure out if there are logs and locations
                    lambda roundtrip: 0 not in roundtrip[-1]
                    and len(roundtrip[-1].values())
                    # qualify only if there are more than 10 logs
                    and len(
                        roundtrip_longer_than_alternative_hours[roundtrip[0]]["ids"]
                    )
                    > 10  # check if the assigned start_location_id is the most frequently visited location
                    and max(roundtrip[-1].values())
                    > roundtrip[-1].get(
                roundtrip_longer_than_alternative_hours[roundtrip[0]]["start_location_id"], 0),
                    most_visited_locations,
                )
            )

            if suspicious_roundtrips:
                for roundtrip_id, frequency in suspicious_roundtrips:
                    suspicious_roundtrip = roundtrip_longer_than_alternative_hours[
                        roundtrip_id
                    ]
                    # try to create a roundtrips for the suspicious roundtrip with the most frequently visited location
                    new_roundtrips = aggregator(
                        car=car,
                        car_trips=car_trips[
                            car_trips.id.isin(suspicious_roundtrip["ids"])
                        ].copy(),
                        allowed_starts=allowed_starts,
                        allowed_trip_duration=allowed_trip_duration,
                        allowed_stop_duration=allowed_stop_duration,
                        home_criteria=home_criteria,
                        distance_criteria=distance_criteria,
                        anonymise_gps=anonymise_gps,
                        only_natural_aggregation=only_natural_aggregation,
                        use_most_frequent_location=True,
                        pre_process=False
                    )
                    if new_roundtrips:
                        roundtrips = [
                            roundtrip
                            for roundtrip in roundtrips
                            if roundtrip["ids"] != suspicious_roundtrip["ids"]
                        ]
                        roundtrips += new_roundtrips

                roundtrips = (
                    pd.DataFrame(roundtrips)
                    .sort_values("start_time")
                    .to_dict("records")
                )

        ### POST PROCESSING CONTINUED ###
        temporary_roundtrip_frame = pd.DataFrame(roundtrips)
        temporary_roundtrip_frame["duration"] = temporary_roundtrip_frame.apply(
            lambda x: (x.end_time - x.start_time).total_seconds() / 3600, axis=1
        )
        # sanitising the roundtrips based on unrealistically low km/h, .2 minimum_allowed_kmh
        temporary_roundtrip_frame["dist_to_dur"] = (
            temporary_roundtrip_frame.distance / temporary_roundtrip_frame.duration
        )
        suspicious = temporary_roundtrip_frame[
            (
                (temporary_roundtrip_frame.dist_to_dur < minimum_allowed_kmh)
                | (
                    (
                        temporary_roundtrip_frame.duration
                        > alternative_trip_duration.total_seconds() / 3600
                    )
                    & (
                        temporary_roundtrip_frame.aggregation_type.apply(
                            lambda x: "complete" not in x
                        )
                    )
                )
            )
        ].copy()
        clean = (
            temporary_roundtrip_frame[
                ~(
                    (temporary_roundtrip_frame.dist_to_dur < minimum_allowed_kmh)
                    | (
                        (
                            temporary_roundtrip_frame.duration
                            > alternative_trip_duration.total_seconds() / 3600
                        )
                        & (
                            temporary_roundtrip_frame.aggregation_type.apply(
                                lambda x: "complete" not in x
                            )
                        )
                    )
                )
            ]
            .copy()
            .to_dict("records")
        )
        if len(suspicious):
            roundtrips_to_split = map(
                lambda roundtrip: car_trips[car_trips.id.isin(roundtrip.ids)].copy(),
                suspicious.itertuples(),
            )
            for roundtrip in roundtrips_to_split:
                roundtrip["stop_duration"] = (
                    roundtrip["start_time"].shift(-1) - roundtrip["end_time"]
                )
                splitted_roundtrips = split_roundtrip(
                    list(roundtrip.itertuples()),
                    stop_duration_limit=allowed_stop_duration,
                    duration_limit=allowed_trip_duration,
                    distance_criteria=distance_criteria,
                )

                clean += list(
                    map(
                        lambda splitted: route_format(
                            splitted,
                            car_id=car["id"],
                            location=car["location"],
                            aggregation_type="forcefully_split",
                            enforced_point=None
                            if anonymise_gps is False
                            else anonymise_coordinates,
                        ),
                        splitted_roundtrips,
                    )
                )
            if clean:
                roundtrips = (
                    pd.DataFrame(clean).sort_values("start_time").to_dict("records")
                )
            else:
                roundtrips = []
        ### POST PROCESSING END ###
        if (
            roundtrips and
            "complete" not in roundtrips[-1]["aggregation_type"]
            and use_most_frequent_location is False
        ):
            # we don't want to save the last roundtrip if it's not a complete one
            roundtrips.pop(-1)

    roundtrips = pd.DataFrame(roundtrips)
    roundtrips["start_location_id"] = car.get("location")
    return roundtrips.to_dict("records")


def stays_within_vicinity(
    home_coordinates: tuple[float, float],
    trips: pd.DataFrame,
    start_time: datetime,
    delta_time: timedelta,
    radius: int = 5,
):
    """
    Calculates the ratio of trips and distance within a given radius of a home location in a specific time window.

    Parameters:
        home_coordinates (tuple[float, float]): Latitude and Longitude of the home location.
        trips (pd.DataFrame): DataFrame containing trip data with start and end times, locations, and distances.
        start_time (datetime): The starting time of the analysis window.
        delta_time (timedelta): The duration of the analysis window.
        radius (int, optional): The radius defining the vicinity around the home location. Default is 5.

    Returns:
        tuple[float, float]: A tuple containing two ratios:
            1. The ratio of trips within the vicinity to all trips in the time window.
            2. The ratio of the sum of distances for trips within the vicinity to the sum of distances for all trips
                in the time window.
    """
    relevant_trips = trips[
        (trips.start_time >= start_time) & (trips.end_time <= start_time + delta_time)
    ].copy()
    within_vicinity_mask = relevant_trips.apply(
        lambda trip: calc_distance(
            home_coordinates, (trip.start_latitude, trip.start_longitude)
        )
        < radius,
        axis=1,
    )

    if len(relevant_trips) == 0 or relevant_trips.distance.sum() == 0:
        return 0, 0

    ratio = sum(within_vicinity_mask) / len(relevant_trips)
    distance_ratio = (
        relevant_trips[within_vicinity_mask].distance.sum()
        / relevant_trips.distance.sum()
    )

    return ratio, distance_ratio


def get_closest_home_distance(
    allowed_starts_locations: start_locations, coordinate: tuple[float, float]
):
    """
    Returns the ID and distance of the closest start location to the given coordinate.

    Parameters:
        allowed_starts (list[dict]): List of start locations with 'id', 'latitude', and 'longitude'.
        coordinate (tuple[float, float]): Target latitude and longitude.

    Returns:
        tuple[int, float]: ID of the closest start location and the distance to it.
    """
    # get the current distance to allowed starts
    distances_to_starts = map(
        lambda start: (
            start["id"],
            calc_distance((start["latitude"], start["longitude"]), coordinate),
        ),
        allowed_starts_locations,
    )
    closest_home, closest_distance = min(distances_to_starts, key=lambda x: x[1])
    return closest_home, closest_distance


def locations_frequency(
    trips: list[dict], starts: start_locations, home_criteria: float | int = 0.2
):
    """
    Calculate the frequency of trips starting near each given location.

    This function takes a list of trips and a list of start locations, and returns a
    dictionary where keys are the start locations ids, and values are
    the number of trips that started near each location. A trip is considered to have
    started near a location if the distance between the trip's start point and the
    location is less than `home_criteria`.

    Parameters:
        trips (list[dict]): A list of dictionaries, each representing a trip. Each dictionary
                            must contain the keys 'start_latitude' and 'start_longitude'.
        starts (list[dict]): A list of dictionaries, each representing a start location. Each
                             dictionary must contain the keys 'id', 'latitude', and 'longitude'.
        home_criteria (float | int, optional): The maximum distance a trip's start point can
                                               be from a location for the trip to be considered
                                               as starting near that location. Defaults to 0.2.

    Returns:
        dict: A dictionary where the keys are the IDs of the start locations (int), and the
              values are the number of trips that started near each location (int). Locations
              with no nearby trips are not included in the dictionary.
    """
    closest_location_list = list(
        map(
            lambda trip: (
                lambda filtered: int(min(filtered, key=lambda x: x[1])[0])
                if filtered
                else 0
            )(
                list(
                    filter(
                        lambda low_distance: low_distance[-1] < home_criteria and pd.isna(low_distance[-1]) is False,
                        map(
                            lambda start: (
                                start["id"],
                                calc_distance(
                                    (start["latitude"], start["longitude"]),
                                    (trip["start_latitude"], trip["start_longitude"]),
                                ),
                            ),
                            starts,
                        ),
                    )
                )
            ),
            trips,
        )
    )
    frequency_to_location = {
        location_id: closest_location_list.count(location_id)
        for location_id in set(closest_location_list)
    }
    if 0 in frequency_to_location:
        del frequency_to_location[0]

    return frequency_to_location


def route_format(
    current_route: List,
    car_id: int,
    location: int,
    distance=None,
    aggregation_type: str | None = None,
    enforced_point: tuple | None = None,
) -> route:
    """
    Convenience function to convert to unified route format before saving to database

    Parameters
    ----------
    current_route   :   list of trips that makes up the route
    car_id  :   int, id of the car
    location    :   int, id of the location that should be enforced
    distance    :   int, the km distance of trip
    aggregation_type    :   the type of the aggregation, all_good, change etc.
    enforced_point  :   if not none, this will be the noted start and end point

    Returns
    -------
    dictionary of the trip
    """
    return {
        "start_time": current_route[0].start_time,
        "end_time": current_route[-1].end_time,
        "start_latitude": current_route[0].start_latitude
        if enforced_point is None
        else enforced_point[0],
        "start_longitude": current_route[0].start_longitude
        if enforced_point is None
        else enforced_point[1],
        "end_latitude": current_route[-1].end_latitude
        if enforced_point is None
        else enforced_point[0],
        "end_longitude": current_route[-1].end_longitude
        if enforced_point is None
        else enforced_point[1],
        "car_id": car_id,
        "distance": sum([a.distance for a in current_route])
        if pd.isna(distance)
        else distance,
        "ids": [a.id for a in current_route],
        "start_location_id": location,
        "trip_segments": [
            {
                "distance": current_route_segment.distance,
                "start_time": current_route_segment.start_time,
                "end_time": current_route_segment.end_time,
            }
            for current_route_segment in current_route
        ],
        "aggregation_type": aggregation_type,
    }


def sanitise_for_overlaps(
    c_trips: List[route],
    summer_times: List[date] = None,
    winter_times: List[date] = None,
):
    """
    Function to check if there are overlaps within the logs from gps provider. If there are overlaps, it'll be checked
    whether it's due to shift in time. Will exclude the overlap trips and return cleaned to avoid messing
    with roundtrips.
    """
    if summer_times is None:
        summer_times = []
    if winter_times is None:
        winter_times = []
    car_routes_frame = pd.DataFrame(c_trips).sort_values(["start_time"])
    mask = get_overlap_mask(car_routes_frame)

    if not all(mask):
        mask = np.insert(mask, 0, True)
        overlaps = car_routes_frame.iloc[~mask]
        accepted_overlaps = overlaps.start_time.apply(
            lambda x: x.date() in summer_times or x.date() in winter_times
        )
        if any(accepted_overlaps.values):
            return car_routes_frame[
                ~car_routes_frame.id.isin(
                    car_routes_frame.loc[overlaps.index].id.values
                )
            ].copy()
        else:
            car_routes_frame = car_routes_frame[
                ~car_routes_frame.id.isin(
                    car_routes_frame.loc[overlaps.index].id.values
                )
            ].copy()
            logger.warning(
                f"Overlap error from fleet system provider, removing {len(overlaps)} trips, check the trips\n"
                f" from {overlaps.start_time.values[0]} to {overlaps.end_time.values[-1]}"
            )
            logger.warning("Continuing aggregation without the overlap logs")
    realistic_gps_logs_mask = get_realistic_mask(car_routes_frame)
    if not all(realistic_gps_logs_mask):
        removing = np.where(realistic_gps_logs_mask == False)

        logger.warning(
            f"Unrealistically long trip duration, removing {len(removing)} trips\n"
            f"{', '.join([f'{a.start_time} - {a.end_time}' for a in car_routes_frame.iloc[removing].itertuples()])} "
        )
        car_routes_frame = car_routes_frame[realistic_gps_logs_mask].copy()
    return car_routes_frame


def get_realistic_mask(c_trips: pd.DataFrame):
    """
    Skyhost will occasionally send trips that have an unrealistically long duration > 20 days.
    A single gps log cannot be that long.
    This messes up the remainder of roundtrip aggregation
    """
    if len(c_trips):
        return c_trips.apply(lambda trip: trip.end_time - trip.start_time < timedelta(days=20), axis=1).values
    return np.array([])


def get_overlap_mask(c_trips: pd.DataFrame):
    """
    Function that returns a mask that checks a time sorted frame that the "next" start is not before the "current" end
    time.
    """
    return (
        c_trips.start_time[1:].values - c_trips.end_time[:-1].values
    ) / np.timedelta64(1, "s") / 3600 >= 0


def aggregating_score(complete_ratio, utility_ratio, avg_trip_length):
    return (0.4 * complete_ratio) + (0.2 * utility_ratio) + (0.4 * avg_trip_length)


def process_car_roundtrips(
        car,
        car_trips: pd.DataFrame,
        allowed_starts: start_locations,
        aggregator: Callable[
            ...,
            List[route]
        ],
        score: Callable[[float, float, float], float],
        session_or_maker: Union[Session, sessionmaker],
        is_session_maker: bool,
        return_ids: bool = False,
        save: bool = True,
        precision_only: bool = False,
):
    car_model = {"id": car.id, "location": car.location}
    result = []
    saved = []
    qualified_routes = None
    usage_count = 0
    possible_count = 0
    usage_distance = 0
    possible_distance = 0

    car_trips["start_time"] = car_trips.start_time.apply(
        lambda x: datetime.strptime(x, "%Y-%m-%d %H:%M:%S") if type(x) is str else x
    )
    car_trips["end_time"] = car_trips.end_time.apply(
        lambda x: datetime.strptime(x, "%Y-%m-%d %H:%M:%S") if type(x) is str else x
    )

    car_trips = car_trips.sort_values(["start_time"]).reset_index().iloc[:, 1:]
    car_trips["stop_duration"] = (
        car_trips["start_time"].shift(-1) - car_trips["end_time"]
    )

    if json.loads(os.getenv("BIRD_FLIGHT", "false")):
        car_trips["distance"] = car_trips.apply(
            lambda single_trip: calc_distance(
                (single_trip.start_latitude, single_trip.start_longitude),
                (single_trip.end_latitude, single_trip.end_longitude),
            ),
            axis=1,
        )

    for definition_of_home in np.array(list(range(1, 4))[::-1] + [0.5]) * 0.1:
        finished_roundtrips = aggregator(
            car_model,
            car_trips,
            allowed_starts,
            home_criteria=definition_of_home,
            anonymise_gps=True,
            only_natural_aggregation=json.loads(os.getenv("ONLY_NATURAL", "false")),
            allowed_trip_duration=timedelta(days=float(os.getenv("TRIP_DURATION", 7))),
            pre_process=False,
        )

        if len(finished_roundtrips):
            finished_roundtrips = pd.DataFrame(finished_roundtrips)
            saved.append(finished_roundtrips)
            end_check = finished_roundtrips.iloc[-1].end_time
            completed_ratio = (
                    finished_roundtrips[
                        finished_roundtrips.aggregation_type.apply(lambda x: "complete" in x)
                    ].distance.sum()
                    / finished_roundtrips.distance.sum()
            )
            utilised_ratio = (
                    finished_roundtrips.distance.sum()
                    / car_trips[car_trips.end_time <= end_check].distance.sum()
            )
            result.append(score(completed_ratio, utilised_ratio, 1 / finished_roundtrips.ids.apply(len).mean()))

    if result:
        qualified_routes = saved[np.argmax(result)]

    if precision_only:
        if not result or qualified_routes is None or len(qualified_routes) == 0:
            return 0, 0
        elgible_trips = car_trips[
            (car_trips.start_time >= qualified_routes.iloc[0].start_time) &
            (car_trips.end_time <= qualified_routes.iloc[-1].end_time)]
        total_kilometers = elgible_trips.distance.sum()
        precision = qualified_routes[qualified_routes.aggregation_type.apply(lambda x: "complete" in x)].distance.sum() / total_kilometers
        return precision, total_kilometers

    if qualified_routes is not None and len(qualified_routes) >= 1:
        usage_count = sum([len(a["ids"]) for a in qualified_routes.to_dict("records")])
        possible_count = len(car_trips[car_trips.end_time <= qualified_routes.iloc[-1].end_time])
        usage_distance = qualified_routes.distance.sum()
        possible_distance = car_trips[car_trips.end_time <= qualified_routes.iloc[-1].end_time].distance.sum()
        if save and precision_only is False:
            if is_session_maker:
                with session_or_maker.begin() as session:
                    commit_roundtrips(session, car, qualified_routes)
            else:
                commit_roundtrips(session_or_maker, car, qualified_routes)

        logger.info(
            f"Car: {car.id}, {len(qualified_routes)} roundtrips. Km utilisation "
            f"{usage_distance / possible_distance}"
            f". Ratio log {usage_count / possible_count}, "
        )
    if return_ids:
        ids = []
        if qualified_routes is not None:
            ids = [
                {"ids": rt["ids"], "start_time": rt["start_time"], "end_time": rt["end_time"]}
                for rt in qualified_routes.to_dict("records")
            ]
        return usage_count, possible_count, usage_distance, possible_distance, ids
    return usage_count, possible_count, usage_distance, possible_distance


def commit_roundtrips(session, car, qualified_routes):
    car_in_db = session.query(Cars).get(int(car.id))
    rt = [
        RoundTrips(
            id=None,
            start_time=route["start_time"],
            end_time=route["end_time"],
            start_latitude=route["start_latitude"],
            start_longitude=route["start_longitude"],
            end_latitude=route["end_latitude"],
            end_longitude=route["end_longitude"],
            car_id=int(route["car_id"]),
            car=car_in_db,
            distance=route["distance"],
            driver_name=None,
            start_location_id=route["start_location_id"],
            trip_segments=[
                RoundTripSegments(
                    id=None,
                    distance=segment["distance"],
                    start_time=segment["start_time"],
                    end_time=segment["end_time"],
                )
                for segment in route["trip_segments"]
            ],
            aggregation_type=route["aggregation_type"],
        )
        for route in qualified_routes.to_dict("records")
    ]
    session.add_all(rt)
    session.commit()
