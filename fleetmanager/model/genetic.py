import math
import random
from deap import base, creator, tools
import numpy as np
from datetime import date, datetime, time
from typing import TypedDict, Tuple

from sqlalchemy import and_, or_, func, text
from sqlalchemy.engine.row import Row
from sqlalchemy.orm import sessionmaker

from fleetmanager.data_access import engine_creator, Cars
from fleetmanager.fleet_simulation import get_unallocated, allocation_distribution, vehicle_usage
from fleetmanager.model.tco_calculator import TCOCalculator
from fleetmanager.model.model import Trips, Simulation, ConsequenceCalculator, Model
from fleetmanager.model.vehicle import Bike, ElectricBike, FleetInventory, VehicleFactory
from fleetmanager.configuration.util import load_shift_settings, load_bike_configuration_from_db
from fleetmanager.model.trip_generator import extract_peak_day
from fleetmanager.simulation_setup import get_emission


shift_type = TypedDict(
    "shift_type",
    {
        "shift_start": time,
        "shift_end": time,
        "break": time,
    }
)


bike_settings_type = TypedDict(
    "bike_settings_type", {
        "allowed_driving_time_slots": list[Tuple[datetime, datetime]],
        "bike_percentage": int | None,
        "bike_speed": int,
        "electrical_bike_speed": int,
        "max_distance_pr_trip": int | None,
        "max_time_slot": float,
    }
)


prepared_settings_type = TypedDict(
    "prepared_settings_type", {
        "high": float,
        "low": float,
        "benzin_udledning": float,
        "diesel_udledning": float,
        "el_udledning": float,
        "hvo_udledning": float,
        "pris_benzin": float,
        "pris_diesel": float,
        "pris_el": float,
        "pris_hvo": float,
        "max_undriven": int,
        "slack": int,
        "sub_time": int,
        "prioritisation": int | None,
        "intelligent_allocation": bool | None,
        "undriven_type": str,
        "undriven_wltp": float,
        "vaerdisaetning_tons_co2": int,
        "bike_settings": bike_settings_type,
        "shifts": list[shift_type] | None,
        "dates": list[datetime | date],
        "location": list[int],
        "km_aar": bool | None
    }
)


class TripHandler:
    """
    Class to handle the loading of trips for use in automatic simulation.
    It handles the class initiation of trips, selection of date range, locations and vehicles.
    Creates a peak day representation of the roundtrips set.
    It will apply the shifts to the roundtrips of the first location of the location list if no shift settings
    are presented at initiation.

    Contains functionality for estimating the effective bike count.

    start_date : date from which roundtrips should be loaded
    end_date : date to which roundtrips should be loaded
    locations : location ids from which roundtrips should be loaded
    vehicles : car_ids from which roundtrips should be loaded
    shifts_settings : shifts to apply to roundtrips
    """
    def __init__(
            self,
            start_date: date | datetime,
            end_date: date | datetime,
            locations: list[int],
            vehicles: list[int],
            shift_settings: list[shift_type] = None
    ):
        self.engine = engine_creator()
        self.session = sessionmaker(bind=self.engine)
        self.start_date = start_date
        self.end_date = end_date
        self.locations = locations
        self.vehicles = vehicles
        self.shift_settings = shift_settings
        self.trips, self.peak_day = self.__load_trips()

    def __load_trips(self):
        if self.shift_settings is None:
            shift_settings = load_shift_settings(self.session(), location=self.locations[0], get_all=False)
            shift_settings = [
                {
                    "shift_start": time.fromisoformat(shift["shift_start"]),
                    "shift_end": time.fromisoformat(shift["shift_end"]),
                    "break": None if shift["break"] is None else time.fromisoformat(shift["break"])
                 } for shift in shift_settings]
        else:
            shift_settings = self.shift_settings
        trips = Trips(
            location=self.locations,
            dates=[self.start_date, self.end_date],
            shifts=shift_settings,
            vehicles=self.vehicles,
            engine=self.engine
        )

        if len(trips.all_trips) == 0:
            return trips, []
        return trips, extract_peak_day(trips.all_trips)

    @staticmethod
    def prepare_bike_settings(bike_settings):
        allowed_times = [
            (datetime.combine(datetime(2020, 1, 1), time.fromisoformat(start)),
             datetime.combine(datetime(2020, 1, 1), time.fromisoformat(end)))
            for start, end in
            zip(bike_settings.get("bike_start", ["00:00:00"]), bike_settings.get("bike_end", ["23:59:59"]))]
        bike_settings["allowed_driving_time_slots"] = allowed_times
        bike_settings["max_time_slot"] = max([
            (end - start).total_seconds()
            for start, end in allowed_times]) / 3600
        bike_settings["bike_percentage"] = int(bike_settings.get("percentage_of_trips"), 100)
        bike_settings["max_distance_pr_trip"] = int(bike_settings.get("max_km_pr_trip"), 20)
        return bike_settings

    def estimate_bike_potential(self, trips, bike_settings: bike_settings_type | None):
        if bike_settings is None:
            bike_settings = load_bike_configuration_from_db(self.session())
            bike_settings = self.prepare_bike_settings(bike_settings)
        allowed_times = bike_settings.get("allowed_driving_time_slots", [])
        max_slot = bike_settings.get("max_time_slot")
        max_km_pr_trip = float(bike_settings.get("max_distance_pr_trip"))
        percentage = int(bike_settings.get("bike_percentage"))

        def create_bike():
            Bike.max_distance_pr_trip = max_km_pr_trip
            Bike.allowed_driving_time_slots = allowed_times
            Bike.max_time_slot = max_slot
            Bike.percentage = percentage
            Bike.range = 20
            Bike.skip_kmh_check = True
            return Bike()

        def create_ebike():
            ElectricBike.max_distance_pr_trip = max_km_pr_trip
            ElectricBike.allowed_driving_time_slots = allowed_times
            ElectricBike.range = 50
            ElectricBike.percentage = percentage
            ElectricBike.skip_kmh_check = True
            return ElectricBike()

        bike_in_use = []
        regular = []
        electrical = []

        for trip in trips.itertuples():
            accepted = False

            for bike in bike_in_use:
                if len(bike.trips) and trip.start_time < bike.trips[-1][-1]:
                    continue
                accepted = bike.accept_trip(trip)
                if accepted:
                    break
            if accepted:
                continue

            # will a new bike accept it?
            new_bike = create_bike()
            accepted = new_bike.accept_trip(trip)
            if accepted:
                bike_in_use.append(new_bike)
                regular.append(new_bike)
                continue
            new_ebike = create_ebike()
            accepted = new_ebike.accept_trip(trip)
            if accepted:
                bike_in_use.append(new_ebike)
                electrical.append(new_ebike)

        return len(bike_in_use)


class FleetHandler:
    """
    Class for handling the vehicles and its attributes for the automatic simulation.
    Contains the method for loading and attributing vehicles in the selection. In addition, methods for
    preparing and setting up simulation scenarios; trim or cook.

    It handles the evaluation of solutions through its fitness scoring since it knows the objective of the simulation
    based on the prioritisation, weighting as well as the simulation specific fitness of the vehicles.

    fixed_vehicles : list of car ids that is "locked" in the solution. If a trim scenario is activated, these will be
        the only vehicles that are pickable by the simulation, i.e. lower and upper boundaries are set on the fixed
        set
    test_vehicles : list of car ids that is an allowed choice by the simulation
    current_vehicles : list car ids that makes up the comparison fleet. I.e. the vehicles that have been brought through
        to simulation.
    prioritisation : int between 0 - 10.

    """
    def __init__(
            self,
            fixed_vehicles: list[int],
            test_vehicles: list[int] = None,
            current_vehicles: list[int] = None,
            prioritsation: int = 5,
            settings: prepared_settings_type = None,
    ):
        if settings is None:
            settings = {}
        self.settings = settings
        self.standard_daily_ranges = {
            1: 15,
            2: 30,
            3: 350,
            4: 1000,
        }
        self.fuel_to_name = {
            10: "bike",
            2: "diesel",
            3: "el",
            1: "benzin",
            4: "benzin",  # hybrid
            5: "benzin",  # hybrid benzin
            6: "diesel",  # hybrid diesel
            7: "el",  # electric
            8: "el",  # electric3
            9: "benzin",  # petrol
            11: "hvo"
        }
        self.bike_estimate = 1
        self.min_vehicle_counts = 10

        self.trim_scenario = False
        self.prioritisation = prioritsation
        self.weight_gen = lambda prio: (2 * (prio / 10), 2 * ((10 - prio) / 10))
        self.co2e_weight, self.cost_weight = self.weight_gen(self.prioritisation)

        self.engine = engine_creator()
        self.session = sessionmaker(bind=self.engine)
        self.fixed_vehicles = fixed_vehicles
        self.current_vehicles = current_vehicles

        self.original_fleet = self.__load_pickable_cars(fixed_vehicles, test_vehicles, current_vehicles)
        self.original_count = self.__count_original()
        self.fleet = self.original_fleet

        self.grouped_sorting = {}  # used for chopping bad choices
        self.lows, self.ups = [], []  # used for setting up boundaries in the selection
        self.attributed_fleet = self.__attribute_cars()
        self.__chop_bad_choices()  # used for measuring fitness, is re-calculated when scenario is activated

    def __count_original(self):
        count_dict = {}
        opslag = {str(id_): vehicle_type for vehicle_type in self.original_fleet for id_ in vehicle_type[-1].split(",")}
        for vehicle_id in self.current_vehicles:
            vehicle_name = self.get_vehicle_name(opslag.get(str(vehicle_id)))
            if vehicle_name not in count_dict:
                count_dict[vehicle_name] = {"count": 0, "id": vehicle_id}
            count_dict[vehicle_name]["count"] += 1
        return count_dict

    def __load_pickable_cars(self, fixed_vehicles: list[int], test_vehicles: list[int], current_vehicles: list[int]):
        car_query = self.session().query(
            Cars.make,
            Cars.model,
            Cars.sleep,
            Cars.omkostning_aar,
            Cars.wltp_el,
            Cars.wltp_fossil,
            Cars.range,
            Cars.type,
            Cars.fuel,
            Cars.km_aar,
            Cars.capacity_decrease,
            self.__get_aggregate_id()
        ).group_by(
            Cars.make,
            Cars.model,
            Cars.sleep,
            Cars.omkostning_aar,
            Cars.wltp_el,
            Cars.wltp_fossil,
            Cars.range,
            Cars.type,
            Cars.fuel,
            Cars.km_aar,
            Cars.capacity_decrease
        ).filter(
            Cars.omkostning_aar.isnot(None),
            Cars.type.isnot(None),
            Cars.fuel.isnot(None),
            Cars.make.isnot(None),
            or_(Cars.wltp_el.isnot(None), Cars.wltp_fossil.isnot(None), Cars.fuel == 10),
            and_(
                or_(Cars.disabled.is_(None), Cars.disabled == False),
                or_(Cars.deleted.is_(None), Cars.deleted == False))
        )
        if test_vehicles and len(test_vehicles) > 0:
            car_query = car_query.filter(
                Cars.id.in_(fixed_vehicles) |
                Cars.id.in_(test_vehicles) |
                Cars.id.in_([] if current_vehicles is None else current_vehicles)
            )

        return car_query.all()

    def __attribute_cars(self, fleet: list[Row] = None):
        if fleet is None:
            fleet = self.fleet

        attributed_fleet = []
        for vehicle in fleet:
            tco = TCOCalculator(
                drivmiddel=self.fuel_to_name[vehicle.fuel],
                bil_type=self.fuel_to_name[vehicle.fuel],
                koerselsforbrug=10000,
                braendstofforbrug=vehicle.wltp_fossil,
                elforbrug=vehicle.wltp_el,
                diesel_udledning=self.settings.get("diesel_udledning", 2.98),
                hvo_udledning=self.settings.get("hvo_udledning", 0.894),
                benzin_udledning=self.settings.get("benzin_udledning", 2.52),
                el_udledning=self.settings.get("el_udledning", 0.09),
                evalueringsperiode=1,
                vaerdisaetning_tons_co2=self.settings.get("vaerdisaetning_tons_co2", 1500),
                pris_benzin=self.settings.get("pris_benzin", 12.33),
                pris_diesel=self.settings.get("pris_diesel", 10.83),
                pris_el=self.settings.get("pris_el", 2.13),
                pris_hvo=self.settings.get("pris_hvo", 19.84)
            )
            co2e, samfund = tco.ekstern_miljoevirkning(sum_it=True)
            expense = vehicle.omkostning_aar + tco.driftsomkostning + samfund
            cost = expense / 10000

            attributed_fleet.append(
                {
                    "range": vehicle.range,  # standard_daily_range becomes relevant if range is introduced in scoring
                    "sleep": 0 if vehicle.sleep is None else vehicle.sleep,
                    "yearly_cost": vehicle.omkostning_aar,
                    "cost_pr_km": cost,
                    "co2e_pr_km": co2e,
                    "type": vehicle.type
                }
            )

        costs = np.array([v['cost_pr_km'] for v in attributed_fleet])
        co2es = np.array([v['co2e_pr_km'] for v in attributed_fleet])

        lower_percentile = 5
        upper_percentile = 95

        cost_p5 = np.percentile(costs, lower_percentile)
        cost_p95 = np.percentile(costs, upper_percentile)
        co2e_p5 = np.percentile(co2es, lower_percentile)
        co2e_p95 = np.percentile(co2es, upper_percentile)

        for v in attributed_fleet:
            v['cost_clipped'] = np.clip(v['cost_pr_km'], cost_p5, cost_p95)
            v['co2e_clipped'] = np.clip(v['co2e_pr_km'], co2e_p5, co2e_p95)

        for v in attributed_fleet:
            v['normalized_cost'] = (v['cost_clipped'] - cost_p5) / (cost_p95 - cost_p5)
            v['normalized_co2e'] = (v['co2e_clipped'] - co2e_p5) / (co2e_p95 - co2e_p5)

        return attributed_fleet

    def __chop_bad_choices(self):
        vehicle_type_dict = dict()
        for vehicle_idx, vehicle in enumerate(self.attributed_fleet):
            if vehicle["type"] not in vehicle_type_dict:
                vehicle_type_dict[vehicle["type"]] = []
            vehicle_type_dict[vehicle["type"]].append((vehicle_idx, vehicle))

        top_vehicles_to_keep = {
            1: 5,
            2: 5,
            3: 15,
            4: 15,
        }
        group_vehicles = {}

        new_fleet = []
        new_attributed_fleet = []
        for vehicle_type, vehicle_list in vehicle_type_dict.items():
            sorted_vehicle_list = sorted(vehicle_list, key=lambda x: (1 * x[1]['normalized_cost'] + 1 * x[1]['normalized_co2e']))
            selected_vehicles = [selected_vehicle[0] for selected_vehicle in sorted_vehicle_list[:top_vehicles_to_keep[vehicle_type]]]
            group_fleet = [self.fleet[k] for k in selected_vehicles]
            group_vehicles[vehicle_type] = group_fleet
            new_fleet += group_fleet
            new_attributed_fleet += [self.attributed_fleet[k] for k in selected_vehicles]

        self.fleet = new_fleet
        self.attributed_fleet = new_attributed_fleet
        self.grouped_sorting = group_vehicles

    def activate_trim_scenario(self):
        # chop away vehicle types that are not represented in the fixed vehicles
        # find the count for the unique count
        # creating hash for efficiency, ids should be stored in last index and be comma separated
        opslag = {str(id_): vehicle_type for vehicle_type in self.original_fleet for id_ in vehicle_type[-1].split(",")}
        name_to_idx = {}
        new_fleet = []
        lows = []
        ups = []
        for id_ in self.fixed_vehicles:
            vehicle = opslag[str(id_)]
            name = self.get_vehicle_name(vehicle)
            if name not in name_to_idx:
                new_fleet.append(vehicle)
                idx = len(name_to_idx)
                name_to_idx[name] = idx
                lows.append(0)
                ups.append(1)
            else:
                idx = name_to_idx[name]
                ups[idx] += 1

        self.lows = lows
        self.ups = ups
        self.fleet = new_fleet
        self.attributed_fleet = self.__attribute_cars(fleet=new_fleet)

    def activate_cook_scenario(self):
        #  in a cook scenario we want to at least have the fixed cars in and allow new types
        #   the min for the fixed should be the vehicle type count
        #   the min for the remaining should be 0
        #   the max for the fixed should be the max estimate
        #   the max for the remaining best choices should be the max estimate minus the sum of fixed
        opslag = {str(id_): vehicle_type for vehicle_type in self.original_fleet for id_ in vehicle_type[-1].split(",")}
        name_to_idx = {}
        self.__attribute_cars(self.original_fleet)  # the bad choice removal is dependent on attributed cars
        self.__chop_bad_choices()

        new_fleet = []
        ups = []
        lows = []

        for id_ in self.fixed_vehicles:  # account for the fixed cars
            vehicle = opslag[str(id_)]
            name = self.get_vehicle_name(vehicle)
            if name not in name_to_idx:
                idx = len(name_to_idx)
                name_to_idx[name] = idx
                new_fleet.append(vehicle)
                ups.append(0)
                lows.append(0)
            else:
                idx = name_to_idx[name]

            lows[idx] += 1  # adding a count on the type to assert the min count is adhered to
            ups[idx] = self.min_vehicle_counts

        remaining_slots = self.min_vehicle_counts - len(self.fixed_vehicles)
        for vehicle in self.fleet:  # adding additional choices
            # iterate over the best choices
            name = self.get_vehicle_name(vehicle)
            if name in name_to_idx:
                # the choice is already available through the fixed cars
                continue
            new_fleet.append(vehicle)
            lows.append(0)
            ups.append(remaining_slots)

        self.ups = ups
        self.lows = lows
        self.fleet = new_fleet
        self.attributed_fleet = self.__attribute_cars(new_fleet)

    @staticmethod
    def get_vehicle_name(vehicle_object: Row, use_ids: bool = False):
        return "_".join(
                [
                    str(a) for a in
                    [
                        vehicle_object.make,
                        vehicle_object.model,
                        FleetHandler.get_sleep_val(vehicle_object, use_ids=use_ids),
                        vehicle_object.wltp_el,
                        vehicle_object.wltp_fossil,
                        vehicle_object.range,
                        int(vehicle_object.type_id) if use_ids else vehicle_object.type,
                        int(vehicle_object.fuel_id) if use_ids else vehicle_object.fuel,
                        vehicle_object.km_aar,
                        vehicle_object.capacity_decrease,
                        vehicle_object.omkostning_aar
                    ]
                ]
            ).lower().replace("nan", "").replace("none", "")

    @staticmethod
    def get_sleep_val(vehicle_object: Row, use_ids: bool = False):

        sleep_val = None if vehicle_object.sleep is None or np.isnan(vehicle_object.sleep) else int(vehicle_object.sleep)
        if sleep_val:
            return sleep_val
        if use_ids and str(vehicle_object.fuel_id) in ["3", "7", "8"]:
            return 7
        if use_ids is False and str(vehicle_object.fuel) in ["3", "7", "8"]:
            return 7
        return sleep_val

    def fitness(self, solution: list[int], min_vehicle_counts: int = None, bike_estimate: int = None):
        """
        Scoring function for evaluating a solution.

        Rewards:
            meeting minimum required vehicles
            meeting bike estimate
            low co2e weight
            low cost weight
            low amount of unique vehicle types

        Penalises:
            unmet minimum vehicle count
            unmet bike estimat
            more unique vehicle types
            high co2e weight
            high cost weight
        """

        if min_vehicle_counts is None:
            min_vehicle_counts = self.min_vehicle_counts
        if bike_estimate is None:
            bike_estimate = self.bike_estimate
        total_cost = 0
        total_co2e = 0
        total_vehicles = sum(solution)
        total_bikes = 0

        penalty = 0

        if total_vehicles == 0:
            penalty += 1e6
        else:
            for idx, (n_i, vehicle) in enumerate(zip(solution, self.attributed_fleet)):
                if n_i < 0:
                    penalty += 1e6
                    continue

                total_cost += n_i * vehicle['normalized_cost']
                total_co2e += n_i * vehicle['normalized_co2e']

                if vehicle['type'] in [1, 2]:
                    total_bikes += n_i

        # encourage vehicle count
        car_count = total_vehicles - total_bikes
        if car_count < min_vehicle_counts:
            cars_to_go = abs(min_vehicle_counts - car_count)
            penalty += 1000 * cars_to_go  # penalise if required vehicles not met, less penalty the closer
        if car_count > min_vehicle_counts:
            penalty += 10

        # encourage bike usage
        penalty += abs(total_bikes - bike_estimate) * 1  # don't punish too much, estimates are not too accurate

        # encourage less unique types
        vehicle_types_used = sum(1 for n_i in solution if n_i > 0)

        diversity_penalty_weight = 1
        penalty += vehicle_types_used * diversity_penalty_weight

        penalty_weight = 1

        fitness_value = (
                self.cost_weight * total_cost +
                self.co2e_weight * total_co2e +
                penalty_weight * penalty
        )
        return (fitness_value,)

    def __get_aggregate_id(self):
        if "mysql" in self.engine.dialect.name:
            return func.group_concat(Cars.id).label('ids')
        elif "sqlite" in self.engine.dialect.name:
            return func.group_concat(Cars.id, ',').label('ids')
        return text("STRING_AGG(CONVERT(VARCHAR(20), cars.id), ',')")


def run_solution_search(
        population: list,
        toolbox: base.Toolbox,
        crossover_pb: float,
        mutation_pb: float,
        generation: int,
        elite_size: int = 1,
        stats: tools.Statistics = None,
        best_solutions: tools.HallOfFame = None,
        stagnation_limit=20
):
    """
    Handle the genetic search with elitism by keeping best solutions in generations.
    """
    logbook = tools.Logbook()
    logbook.header = ['gen', 'nevals'] + (stats.fields if stats else [])
    best_fitness = None
    generations_without_improvement = 0
    fitnesses = list(map(toolbox.evaluate, population))
    for ind, fit in zip(population, fitnesses):
        ind.fitness.values = fit

    if best_solutions is not None:
        best_solutions.update(population)

    record = stats.compile(population) if stats else {}
    logbook.record(gen=0, nevals=len(population), **record)
    # print(logbook.stream)

    for gen in range(1, generation + 1):
        offspring = toolbox.select(population, len(population) - elite_size)
        offspring = list(map(toolbox.clone, offspring))

        for child1, child2 in zip(offspring[::2], offspring[1::2]):
            if random.random() < crossover_pb:
                toolbox.mate(child1, child2)
                del child1.fitness.values
                del child2.fitness.values

        for mutant in offspring:
            if random.random() < mutation_pb:
                toolbox.mutate(mutant)
                del mutant.fitness.values

        invalid_ind = [ind for ind in offspring if not ind.fitness.valid]
        fitnesses = list(map(toolbox.evaluate, invalid_ind))
        for ind, fit in zip(invalid_ind, fitnesses):
            ind.fitness.values = fit

        if best_solutions is not None:
            best_solutions.update(population)
            elites = best_solutions.items[:elite_size]
        else:
            elites = tools.selBest(population, elite_size)
        offspring.extend(elites)

        population[:] = offspring

        record = stats.compile(population) if stats else {}
        logbook.record(gen=gen, nevals=len(invalid_ind), **record)
        # print(logbook.stream)

        current_best_fitness = best_solutions[0].fitness.values[0] if best_solutions else min(population, key=lambda ind: ind.fitness.values[0]).fitness.values[0]

        if best_fitness is None or current_best_fitness < best_fitness:
            best_fitness = current_best_fitness
            generations_without_improvement = 0
        else:
            generations_without_improvement += 1

        if generations_without_improvement >= stagnation_limit:
            # print(f"Stopping early due to {stagnation_limit} generations without improvement.")
            break

    return population, logbook


def genetic_handler(fleet_handler):
    """
    runs the genetic algorithm with deap library. Calls search/generation with elitism where best solutions are kept.

    Requires the fleet_handler that has defined either a trim or cook scenario in order to keep record
    of the fitness of the generated solutions.
    """

    random.seed(42)

    num_generations = 200
    crossover_prob = 0.5
    mutation_prob = 0.2
    pop_size = 1000
    elite_size = 10

    try:
        del creator.Individual
        del creator.FitnessMin
    except:
        pass
    creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
    creator.create("Individual", list, fitness=creator.FitnessMin)
    toolbox = base.Toolbox()

    # each gene represents the count of a vehicle type, initialized randomly
    lows_fleet = fleet_handler.lows
    ups_fleet = fleet_handler.ups

    def initiation_individual(icls, lows, ups):
        individual = [random.randint(low, up) for low, up in zip(lows, ups)]
        return icls(individual)

    def mutation_per_gene(individual, lows, ups, indpb):
        for i in range(len(individual)):
            if random.random() < indpb:
                individual[i] = random.randint(lows[i], ups[i])
        return (individual,)

    def crossover_genes(ind1, ind2, indpb, lows, ups):
        for i in range(len(ind1)):
            if random.random() < indpb:
                ind1[i], ind2[i] = ind2[i], ind1[i]
                # ensure new values are within bounds
                ind1[i] = min(max(ind1[i], lows[i]), ups[i])
                ind2[i] = min(max(ind2[i], lows[i]), ups[i])
        return ind1, ind2

    def evaluate(individual):
        return fleet_handler.fitness(individual)

    toolbox.register("individual", initiation_individual, creator.Individual, lows=lows_fleet, ups=ups_fleet)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)
    toolbox.register("evaluate", evaluate)
    toolbox.register("select", tools.selTournament, tournsize=3)
    toolbox.register("mate", crossover_genes, indpb=crossover_prob, lows=lows_fleet, ups=ups_fleet)
    toolbox.register("mutate", mutation_per_gene, lows=lows_fleet, ups=ups_fleet, indpb=mutation_prob)

    population = toolbox.population(n=pop_size)

    stats = tools.Statistics(lambda ind: ind.fitness.values)
    stats.register("avg", lambda fits: np.mean([fit[0] for fit in fits]))
    stats.register("std", lambda fits: np.std([fit[0] for fit in fits]))
    stats.register("min", lambda fits: np.min([fit[0] for fit in fits]))
    stats.register("max", lambda fits: np.max([fit[0] for fit in fits]))

    best_solutions = tools.HallOfFame(maxsize=elite_size)

    _, _ = run_solution_search(
        population,
        toolbox,
        crossover_pb=crossover_prob,
        mutation_pb=mutation_prob,
        generation=num_generations,
        elite_size=elite_size,
        stats=stats,
        best_solutions=best_solutions,
        stagnation_limit=50 if fleet_handler.trim_scenario else 20
    )
    solutions = []
    for idx, best_individual in enumerate(best_solutions):
        solutions.append(best_individual)

    return solutions


class DrivingTest:
    """
    Class to help testing the solutions. Contains methods for estimating the required number of vehicles, by testing
    on peak_day and then evaluating with the whole trip set.

    Used to evaluate the final solutions as well as the current solution for comparison.

    fleet_handler : the initiated fleet_handler that has the defined scenario initiated
    trip_handler : the initiated trip_handler that holds the relevant roundtrips
    settings : the input settings which is used for building fleets with the appriopriate settings
    """
    def __init__(self, fleet_handler: FleetHandler, trip_handler: TripHandler, settings: prepared_settings_type = None):
        if settings is None:
            settings = {}
        self.settings = settings
        self.fleet_handler = fleet_handler
        self.trip_handler = trip_handler
        self.fleet_name = "drivingcheck"
        self.default_fleet = None
        self.type_translation = None
        self.fuel_translation = None

    def estimate_required_vehicles(self, trips: Trips = None, number_of_bikes: int = None):
        if trips is None:
            peak_day = self.trip_handler.peak_day
            peak_day["car_id"] = 0
            peak_day["id"] = list(range(len(peak_day)))
            trips = Trips(dataset=peak_day)
        if number_of_bikes is None:
            number_of_bikes = 1

        vehicles = []
        solution = []
        if 1 in self.fleet_handler.grouped_sorting.keys():
            car_idx = 1
            vehicles = [self.fleet_handler.grouped_sorting[1][0]]  # adding a bike
            solution = [number_of_bikes]
        elif 2 in self.fleet_handler.grouped_sorting.keys():
            car_idx = 1
            vehicles = [self.fleet_handler.grouped_sorting[2][0]]  # adding an electric bike
            solution = [number_of_bikes]
        else:
            # no bikes available in fleet
            car_idx = 0

        if 4 in self.fleet_handler.grouped_sorting.keys():
            best_fossil_vehicle = self.fleet_handler.grouped_sorting[4][0]
            vehicles.append(best_fossil_vehicle)  # adding fossil
            solution.append(
                len(self.trip_handler.trips.all_trips.car_id.unique())
            )
        elif 3 in self.fleet_handler.grouped_sorting.keys():
            longest_ranging_electrical_vehicle = max([
                (idx, vehicle.range or 500) for idx, vehicle in enumerate(self.fleet_handler.fleet)
                if vehicle.type == 3
            ], key=lambda x: x[1])
            best_electrical_vehicle = self.fleet_handler.fleet[longest_ranging_electrical_vehicle[0]]  # adding el
            vehicles.append(best_electrical_vehicle)
            solution.append(0)

        vehicles = self.fleet_to_dict(vehicles)

        # initialise fleet
        vehicle_factory = VehicleFactory(
            load_self=False,
            unique_vehicles=vehicles
        )

        self.default_fleet = solution
        start_solution = solution
        if self.settings.get("km_aar", False):
            max_dist = trips.all_trips.distance.max()
            modify_key = None
            for key, val in vehicle_factory:
                if val.type_id in [4, 3] and val.km_aar:
                    if max_dist * 365 > val.km_aar * 1.15:
                        modify_key = key
            if modify_key:
                vehicle_factory.vmapper[modify_key].km_aar = max_dist * 365

        breakpoint_found, count = self.__search(
            start_solution,
            vehicle_factory=vehicle_factory,
            trips=trips,
            car_idx=car_idx  # search with the specified index
        )
        return breakpoint_found, count

    def fleet_to_dict(self, vehicles: list[Row]):
        self.type_translation = {
            1: "cykel",
            2: "elcykel",
            3: "elbil",
            4: "fossilbil"
        }
        self.fuel_translation = {
            1: "benzin",
            2: "diesel",
            3: "el",
            4: "benzin",
            5: "benzin",
            6: "diesel",
            7: "el",
            8: "el",
            9: "benzin",
            10: "bike",
            11: "hvo"
        }

        return [
            {
                "id": str(k),
                "make": vehicle.make,
                "model": vehicle.model,
                "wltp_fossil": vehicle.wltp_fossil,
                "wltp_el": vehicle.wltp_el,
                "range": vehicle.range,
                "type": self.type_translation[vehicle.type],
                "type_id": vehicle.type,
                "fuel": self.fuel_translation[vehicle.fuel],
                "fuel_id": vehicle.fuel,
                "omkostning_aar": vehicle.omkostning_aar,
                "sleep": vehicle.sleep,
                "co2_pr_km": 0,   # this attr is irrelevant
                "km_aar": vehicle.km_aar,
                "capacity_decrease": vehicle.capacity_decrease
            }
            for k, vehicle in enumerate(vehicles)
        ]

    def build_fleet(self, solution: list[int], vehicle_factory: VehicleFactory, days: int = 1):
        fleet = FleetInventory(vehicle_factory, name=self.fleet_name)
        for k, count in enumerate(solution):
            setattr(fleet, str(k), count)
        fleet.initialise_fleet(
            km_aar=self.settings.get("km_aar", False),
            days=days,
            sub_time=self.settings.get("sub_time", 5),
            settings=self.settings,
            bike_settings=self.settings.get("bike_settings")
        )
        return fleet

    def __search(
        self,
        solution: list[int],
        vehicle_factory: VehicleFactory,
        down: bool = True,
        old: int = None,
        numbers_checked: dict = None,
        iteration: int = 0,
        max_iter: int = 100,
        car_idx: int = 0,
        trips: Trips = None
    ):
        iteration += 1
        if numbers_checked is None:
            fleet = self.build_fleet(solution, vehicle_factory)
            numbers_checked = {solution[car_idx]: self.__is_drivable(trips, fleet)}
        if old is None:
            old = solution[car_idx]
        if down:
            bottom = (
                max(
                    [
                        number for number, viable in numbers_checked.items() if viable is False
                    ] + [0]
                ) if numbers_checked else 0
            )
            numbers = list(range(bottom, solution[car_idx] + 1))
        else:
            numbers = list(range(solution[car_idx], old + 1))

        middle = math.floor(np.median(numbers))
        if middle == old:
            middle += 1
        new_solution = self.default_fleet
        new_solution[car_idx] = middle
        fleet = self.build_fleet(new_solution, vehicle_factory)
        drivable = self.__is_drivable(trips, fleet)
        numbers_checked[middle] = drivable

        # found breaking point?
        checked = np.array(list(numbers_checked.keys()))
        checked.sort()
        difference = checked[1:] - checked[:-1]
        terminate = [
            k + 1
            for k, (index, diff) in enumerate(zip(range(len(checked) + 1), difference))
            if diff == 1
            and numbers_checked[checked[index]] is False
            and numbers_checked[checked[index + 1]] is True
        ]

        if terminate:
            count = checked[terminate[0]]
            # set the actual number of days
            min_date = self.trip_handler.trips.all_trips.start_time.min()
            max_date = self.trip_handler.trips.all_trips.end_time.max()
            days = math.ceil(
                (max_date - datetime.combine(min_date.date(), time(0))).total_seconds() / 3600 / 24
            )
            while True:
                new_solution = self.default_fleet
                new_solution[car_idx] = count
                fleet = self.build_fleet(new_solution, vehicle_factory, days=days)
                drivable = self.__is_drivable(self.trip_handler.trips, fleet)
                if drivable:
                    break
                count += 1
            return True, new_solution
        elif iteration > max_iter:
            return False, new_solution

        if drivable:
            new_solution = self.__search(
                new_solution,
                vehicle_factory=vehicle_factory,
                trips=trips,
                car_idx=car_idx,
                down=True,
                numbers_checked=numbers_checked,
                iteration=iteration,
                max_iter=max_iter,
            )
        else:
            old = middle
            new_solution = self.__search(
                new_solution,
                vehicle_factory=vehicle_factory,
                trips=trips,
                car_idx=car_idx,
                down=False,
                old=old,
                numbers_checked=numbers_checked,
                iteration=iteration,
                max_iter=max_iter,
            )

        return new_solution

    def __is_drivable(self, trips: Trips, fleet: FleetInventory):
        simulation = Simulation(
            trips,
            fleet,
            progress_callback=None,
            tabu=True,
            intelligent_simulation=self.settings.get("intelligent_allocation", False),
            timestamps_set=True,
            timeslots=False
        )
        simulation.run()
        twv = simulation.trips.trips[simulation.trips.trips[f"{self.fleet_name}_type"] == -1]
        allowed_skipped = 0
        slack = self.settings.get("slack", 0)
        if slack > 0:
            allowed_skipped = round(
                (trips.trips.end_time.max() - trips.trips.start_time.min()).total_seconds() / 3600 / 24 / slack
            )
        drivable = False if len(twv) > allowed_skipped else True
        if len(twv[twv.distance > self.settings.get("max_undriven", 20)]) > 0:
            return False
        return drivable

    def run_simulation(self, trips: Trips, fleet: FleetInventory, fleet_name: str = None):
        if fleet_name is None:
            fleet_name = self.fleet_name
        simulation = Simulation(
            trips,
            fleet,
            progress_callback=None,
            tabu=True,
            intelligent_simulation=self.settings.get("intelligent_allocation", False),
            timestamps_set=True,
            timeslots=False
        )
        simulation.run()
        setattr(
            simulation.fleet_manager,
            f"{fleet_name}_fleet",
            simulation.fleet_manager.vehicles
        )
        cq = ConsequenceCalculator(states=[fleet_name], settings=self.settings)
        cq.compute(simulation, None, [0, 1])
        savings_key = cq.consequence_table["keys"].index(
            "Samlet omkostning [kr/år]"
        )
        co2e_key = cq.consequence_table["keys"].index(
            "POGI CO2-ækvivalent udledning [CO2e]"
        )
        uallokeret_key = cq.consequence_table["keys"].index(
            "Antal ture uden køretøj",
        )

        omkostning = cq.consequence_table[f"{fleet_name[:3]}_values"][savings_key]
        udledning = cq.consequence_table[f"{fleet_name[:3]}_values"][co2e_key]
        uallokeret = cq.consequence_table[f"{fleet_name[:3]}_values"][uallokeret_key]
        driving_book = simulation.trips.trips
        return {
            "omkostning": omkostning,
            "udledning": udledning,
            "uallokeret": uallokeret,
            "driving_book": driving_book.copy(),
            "consequence_calculator": cq
        }


class AutomaticSimulation:
    """
    Class for handling the automatic simulation with genetic solution search

    locations : ids of the locations from which roundtrips will be loaded
    start_date : date from which roundtrips should be loaded
    end_date : date to which roundtrips should be loaded
    fixed_vehicles : list of car ids that is "locked" in the solution. If a trim scenario is activated, these will be
        the only vehicles that are pickable by the simulation, i.e. lower and upper boundaries are set on the fixed
        set
    current_vehicles : list car ids that makes up the comparison fleet. I.e. the vehicles that have been brought through
        to simulation.
    test_vehicles : list of car ids that is an allowed choice by the simulation
    settings : prepared settings

    """
    def __init__(
            self,
            locations: list[int],
            start_date: date | datetime,
            end_date: date | datetime,
            fixed_vehicles: list[int],
            current_vehicles: list[int],
            test_vehicles: list[int] = None,
            settings: prepared_settings_type = None
    ):
        self.dt = None  # driving test initiated in preparation
        self.fh = None  # fleet handler initiated in preparation
        self.bike_estimate = None
        self.th = None  # trip handler initiated in preparation
        self.settings = settings
        self.locations = locations
        self.start_date = start_date
        self.end_date = end_date
        self.fixed_vehicles = fixed_vehicles
        self.current_vehicles = current_vehicles
        self.test_vehicles = test_vehicles
        self.days = (end_date - start_date).total_seconds() / 3600 / 24
        self.progress = 0
        self.reports = []
        self.all_solutions = []
        self.check_vehicle_counts = []
        self.vehicle_assumption = []  # For skipping previously failed type combinations
        self.vehicle_approved = []
        self.qualified = []  # The solutions that were successful
        self.typtrans = {"fossilbil": 0, "elbil": 1, "elcykel": 2, "cykel": 3}

    def prepare_simulation(self):
        self.th = TripHandler(
            locations=self.locations,
            start_date=self.start_date,
            end_date=self.end_date,
            vehicles=self.current_vehicles,
            shift_settings=self.settings.get("shifts")
        )
        self.bike_estimate = self.th.estimate_bike_potential(self.th.trips.all_trips, self.settings.get("bike_settings"))

        self.fh = FleetHandler(
            fixed_vehicles=self.fixed_vehicles,
            prioritsation=self.settings.get("prioritisation", 5),
            test_vehicles=self.test_vehicles,
            current_vehicles=self.current_vehicles
        )
        self.dt = DrivingTest(fleet_handler=self.fh, trip_handler=self.th, settings=self.settings)

    def run_search(self):
        number_of_searches = self.bike_estimate + 1
        for bike_count in range(0, min(self.bike_estimate + 1, 10)):
            self.fh.bike_estimate = bike_count
            breakpoint_found, solution_with_bikes = self.dt.estimate_required_vehicles(number_of_bikes=bike_count)
            vehicle_count = sum(solution_with_bikes) - bike_count
            if vehicle_count in self.check_vehicle_counts:
                yield bike_count, number_of_searches
                continue
            self.check_vehicle_counts.append(vehicle_count)
            trim_scenario = len(self.fixed_vehicles) >= vehicle_count
            self.fh.trim_scenario = trim_scenario
            self.fh.min_vehicle_counts = vehicle_count
            if trim_scenario:
                self.fh.activate_trim_scenario()
            else:
                self.fh.activate_cook_scenario()

            solutions = genetic_handler(fleet_handler=self.fh)
            for solution in solutions:
                fleet = self.dt.build_fleet(
                    solution,
                    VehicleFactory(load_self=False, unique_vehicles=self.dt.fleet_to_dict(self.fh.fleet)),
                    days=self.days
                )
                self.all_solutions.append({
                    "bike_count": bike_count,
                    "vehicle_count": vehicle_count,
                    "fleet_list": solution,
                    "fitness": solution.fitness.values[0],
                    "fleet": fleet
                })
            yield bike_count, number_of_searches
            continue

    def run_solutions(self):
        self.all_solutions.sort(key=lambda x: x["fitness"])
        num_solutions = len(self.all_solutions)
        for idx, sol in enumerate(self.all_solutions):
            type_count = [0, 0, 0, 0]
            for vehicle in sol["fleet"]:
                type_count[self.typtrans[vehicle.type]] += 1

            # if len(self.qualified) == 5:
            #     break
            if (
                tuple(type_count) in self.vehicle_assumption
                and tuple(type_count) not in self.vehicle_approved
            ):
                yield idx, num_solutions
                continue

            results = self.dt.run_simulation(self.th.trips, sol['fleet'])
            if results["uallokeret"] > self.settings.get("slack", 0):
                db = results["driving_book"]
                twv = db[db[f"{self.dt.fleet_name}_type"] == -1]
                if len(twv[twv.distance > self.settings.get("max_undriven", 20)]) > 0:
                    self.vehicle_assumption.append(tuple(type_count))
                    yield idx, num_solutions
                    continue
            self.vehicle_approved.append(tuple(type_count))
            self.qualified.append(sol)
            report = results
            prepared_results = {
                "unallocated_pr_day": get_unallocated(results["driving_book"], fleet_name=self.dt.fleet_name),
                "simulation_vehicle_distribution": allocation_distribution(Model.compute_histogram_static(results["driving_book"], fleet_name=self.dt.fleet_name)),
                "vehicle_usage": vehicle_usage(results["consequence_calculator"].store)
            }
            fleet_counter = {}
            vehicles = []
            for vehicle in sol["fleet"]:
                class_name = " ".join([str(vehicle.make), str(vehicle.model)])
                omkostning_aar = str(vehicle.omkostning_aar)
                udledning = get_emission(vehicle)
                key = self.fh.get_vehicle_name(vehicle, use_ids=True).lower()
                vehicles.append(key)
                if key not in fleet_counter:
                    fleet_counter[key] = {
                        "fleet_id": vehicle.id,
                        "id": vehicle.id,
                        "class_name": class_name,
                        "omkostning_aar": omkostning_aar,
                        "stringified_emission": udledning,
                        "count": 0
                    }
                fleet_counter[key]["count"] += 1

            for vehicle_key in vehicles:
                if vehicle_key not in self.fh.original_count:
                    fleet_counter[vehicle_key]["count_difference"] = fleet_counter[vehicle_key]["count"]
                else:
                    fleet_counter[vehicle_key]["count_difference"] = fleet_counter[vehicle_key]["count"] - self.fh.original_count[vehicle_key]["count"]
            for original_vehicle_key, original_vehicle_items in self.fh.original_count.items():
                if original_vehicle_key not in fleet_counter:
                    original_vehicle_count = original_vehicle_items["count"]
                    original_vehicle_id = str(original_vehicle_items["id"])
                    unused_vehicle = [vehicle for vehicle in self.fh.original_fleet if original_vehicle_id in vehicle[-1].split(",")]
                    if len(unused_vehicle) == 0:
                        continue
                    unused_vehicle = unused_vehicle[0]
                    fleet_counter[original_vehicle_key] = {
                        "fleet_id": original_vehicle_id,
                        "count": 0,
                        "count_difference": -original_vehicle_count,
                        "class_name": " ".join([str(unused_vehicle.make), str(unused_vehicle.model)]),
                        "omkostning_aar": unused_vehicle.omkostning_aar,
                        "stringified_emission": get_emission(unused_vehicle)
                    }
            report["flåde"] = list(fleet_counter.values())
            report["results"] = prepared_results
            self.reports.append(report)

            yield idx, num_solutions

    def run_current(self):
        current_fleet = []
        for current_id in self.current_vehicles:
            try:
                vehicle_object = next(filter(lambda unique_vehicle: str(current_id) in unique_vehicle[-1].split(','), self.fh.original_fleet))
            except StopIteration:
                continue

            current_fleet.append(
                {
                    "id": str(current_id),
                    "make": vehicle_object.make,
                    "model": vehicle_object.model,
                    "wltp_fossil": vehicle_object.wltp_fossil,
                    "wltp_el": vehicle_object.wltp_el,
                    "range": vehicle_object.range,
                    "type": self.dt.type_translation[vehicle_object.type],
                    "type_id": vehicle_object.type,
                    "fuel": self.dt.fuel_translation[vehicle_object.fuel],
                    "omkostning_aar": vehicle_object.omkostning_aar,
                    "sleep": vehicle_object.sleep,
                    "co2_pr_km": 0,  # this attr is irrelevant
                    "km_aar": vehicle_object.km_aar,
                    "capacity_decrease": vehicle_object.capacity_decrease
                }
            )

        fleet = FleetInventory(VehicleFactory(load_self=False, unique_vehicles=current_fleet), name="current")
        for k, id_ in enumerate(self.current_vehicles):
            setattr(fleet, str(id_), 1)
        fleet.initialise_fleet(
            km_aar=self.settings.get("km_aar", False),
            days=self.days,
            sub_time=self.settings.get("sub_time", 5),
            settings=self.settings,
            bike_settings=self.settings.get("bike_settings")
        )

        current_results = self.dt.run_simulation(self.th.trips, fleet, fleet_name="current")

        prepared_results = {
            "unallocated_pr_day": get_unallocated(current_results["driving_book"], fleet_name="current"),
            "current_vehicle_distribution": allocation_distribution(
                Model.compute_histogram_static(current_results["driving_book"], fleet_name="current")),
            "vehicle_usage": vehicle_usage(current_results["consequence_calculator"].store)
        }
        current_results["results"] = prepared_results
        return current_results
