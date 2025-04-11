import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import dayjs from 'dayjs';
import { Vehicle } from '../hooks/useGetVehicles';
import { VehicleWithStatus } from '../hooks/useGetVehiclesByLocation';
import { SelectedLocation } from '@/app/(logged-in)/setup/LocationPicker';
import { reduceDuplicateVehicles } from '../DuplicateReducer';
import { bike_settings, settings, shift_settings, simulation_settings } from '../hooks/useGetSettings';
import AxiosBase from '../AxiosBase';
import { DropDownData } from '../hooks/useGetDropDownData';
import { RootState } from '@/components/redux/store';

type fleetSimulationSettings = {
    simulation_vehicles: {
        id: number;
        simulation_count: number;
    }[];
    extraVehicles: Vehicle[];
};

type LocationIdAddress = {
    id: number;
    address: string;
};

type goalSimulationSettings = {
    fixed_vehicles: number[];
    extraExpense?: number;
    CO2eSavings?: number;
    expenseEmissionPrioritisation: number;
    testVehicles: number[];
    testVehiclesMeta: Vehicle[];
};

type Simulation = {
    selectedVehicles: VehicleWithStatus[];
    start_date: string;
    end_date: string;
    location_id: number;
    location_ids: number[];
    forvaltninger: Record<string, any>;
    locationForvaltning: SelectedLocation[];
    intelligent_allocation: boolean;
    limit_km: boolean;
    settings: settings;
    fleetSimulationSettings: fleetSimulationSettings;
    goalSimulationSettings: goalSimulationSettings;
    locationIdAddresses: LocationIdAddress[];
};

const initialCars: Simulation = {
    selectedVehicles: [],
    start_date: dayjs().add(-7, 'day').format('YYYY-MM-DD'),
    end_date: dayjs().format('YYYY-MM-DD'),
    location_id: 0,
    location_ids: [],
    forvaltninger: [],
    locationForvaltning: [],
    intelligent_allocation: false,
    limit_km: false,
    settings: {
        simulation_settings: {
            benzin_udledning: 0,
            diesel_udledning: 0,
            hvo_udledning: 0,
            distance_threshold: 0,
            el_udledning: 0,
            high: 0,
            keep_data: 0,
            low: 0,
            max_undriven: 0,
            pris_benzin: 0,
            pris_diesel: 0,
            pris_hvo: 0,
            pris_el: 0,
            slack: 0,
            sub_time: 0,
            undriven_type: 'benzin',
            undriven_wltp: 0,
            vaerdisaetning_tons_co2: 0,
        },
        bike_settings: {
            bike_slots: [],
            max_km_pr_trip: 0,
            percentage_of_trips: 0,
            bike_speed: 0,
            electrical_bike_speed: 0,
        },
        shift_settings: [],
    },
    fleetSimulationSettings: {
        simulation_vehicles: [],
        extraVehicles: [],
    },
    goalSimulationSettings: {
        expenseEmissionPrioritisation: 5,
        testVehicles: [],
        fixed_vehicles: [],
        testVehiclesMeta: [],
    },
    locationIdAddresses: [],
};

export const prepareGoalSimulation = createAsyncThunk<number[], void, { state: RootState }>(
    'simulation/prepareGoalSimulation',
    async (_, { getState, dispatch }): Promise<number[]> => {
        // thunk to enforce that it's not allowed to bring above current vehicle type values / test vehicle values from manual sim to goal sim
        // ensures that the count is "reset" whenever the user clicks to the automatic simulation page from navigation or setup
        const state = getState();
        const updatedFixedVehicles: number[] = [];
        const duplicateGroups = reduceDuplicateVehicles(state.simulation.selectedVehicles);

        state.simulation.fleetSimulationSettings.simulation_vehicles.forEach((simVehicle) => {
            const group = duplicateGroups.find((g) => g.vehicle.id === simVehicle.id);
            const allowedCount = simVehicle.simulation_count;
            const groupIds = group ? group.originalVehicles : [];
            const safeCount = Math.min(allowedCount, groupIds.length);
            updatedFixedVehicles.push(...groupIds.slice(0, safeCount));
        });
        dispatch(setGoalSimulationVehicles(updatedFixedVehicles));

        // align the manual simulation selected vehicles
        const updatedSimulationVehicles = state.simulation.fleetSimulationSettings.simulation_vehicles.map((simVehicle) => {
            const group = duplicateGroups.find((g) => g.vehicle.id === simVehicle.id);
            const groupIds = group ? group.originalVehicles : [];
            const newCount = Math.min(simVehicle.simulation_count, groupIds.length);
            return { ...simVehicle, simulation_count: newCount };
        });
        dispatch(setSimulationVehicles(updatedSimulationVehicles));
        return updatedFixedVehicles;
    }
);

export const fetchSimulationSettings = createAsyncThunk('simulation/settings', async (thunkApi) => {
    const response = await AxiosBase.get<settings>('configuration/simulation-configurations');
    return response.data;
});

export const setAllShiftSettings = createAsyncThunk('simulation/settings/shifts', async (shifts: shift_settings) => {
    const locations = await AxiosBase.get<DropDownData>('configuration/dropdown-data').then((res) => res.data.locations.map((loc) => loc.id));
    return locations.map((loc) => ({ location_id: loc, shifts: shifts.shifts }));
});

export const simulationSlice = createSlice({
    name: 'simulationSlice',
    initialState: initialCars,
    reducers: {
        // Generel settings reducers
        addCar: (state, action: PayloadAction<VehicleWithStatus>) => {
            if (action.payload.status === 'dataMissing') {
                return;
            }
            //Don't add car if it's already there
            if (!state.selectedVehicles.find((car) => car.id === action.payload.id)) state.selectedVehicles.push(action.payload);
            const reducedCars = reduceDuplicateVehicles(state.selectedVehicles);
            state.fleetSimulationSettings.simulation_vehicles = reducedCars.map((c) => ({ id: c.vehicle.id, simulation_count: c.count }));
            if (!state.goalSimulationSettings.fixed_vehicles.find((vehicleId) => vehicleId === action.payload.id))
                state.goalSimulationSettings.fixed_vehicles.push(action.payload.id);
        },
        removeCarById: (state, action: PayloadAction<number>) => {
            let index = state.selectedVehicles.findIndex((car) => car.id === action.payload);
            if (index != -1) {
                state.selectedVehicles.splice(index, 1);
            }
            const reducedCars = reduceDuplicateVehicles(state.selectedVehicles);
            state.fleetSimulationSettings.simulation_vehicles = reducedCars.map((c) => ({ id: c.vehicle.id, simulation_count: c.count }));
            state.goalSimulationSettings.fixed_vehicles = state.goalSimulationSettings.fixed_vehicles.filter((c) => c !== action.payload);
        },
        setCars: (state, action: PayloadAction<VehicleWithStatus[]>) => {
            const selectableVehicles = action.payload.filter((v) => v.status !== 'dataMissing');
            state.selectedVehicles = selectableVehicles;

            const reducedCars = reduceDuplicateVehicles(state.selectedVehicles);
            state.fleetSimulationSettings.simulation_vehicles = reducedCars.map((c) => ({ id: c.vehicle.id, simulation_count: c.count }));
            state.goalSimulationSettings.fixed_vehicles = selectableVehicles.map((v) => v.id);
        },
        setCarsByDepartment: (state, action: PayloadAction<string>) => {
            state.selectedVehicles = state.selectedVehicles.filter((car) => car.department === action.payload);
        },
        clearCars: (state, action: PayloadAction) => {
            state.selectedVehicles = [];
            state.goalSimulationSettings.fixed_vehicles = [];
            state.fleetSimulationSettings.simulation_vehicles = [];
        },
        setLocationId: (state, action: PayloadAction<number>) => {
            state.location_id = action.payload;
        },
        setLocationIds: (state, action: PayloadAction<number[]>) => {
            state.location_ids = action.payload;
        },
        setForvaltningLocations: (state, action: PayloadAction<Record<string, any>>) => {
            state.forvaltninger = action.payload;
        },
        setStartDate: (state, action: PayloadAction<string>) => {
            state.start_date = action.payload;
        },
        setEndDate: (state, action: PayloadAction<string>) => {
            state.end_date = action.payload;
        },
        setIntelligentAllocation: (state, action: PayloadAction<boolean>) => {
            state.intelligent_allocation = action.payload;
        },
        setLimitKm: (state, action: PayloadAction<boolean>) => {
            state.limit_km = action.payload;
        },
        setAllSettings: (state, action: PayloadAction<settings>) => {
            state.settings = action.payload;
        },
        setSimulationSettings: (state, action: PayloadAction<simulation_settings>) => {
            state.settings.simulation_settings = action.payload;
        },
        setBikeSettings: (state, action: PayloadAction<bike_settings>) => {
            state.settings.bike_settings = action.payload;
        },
        setLocationSpecificShifts: (state, action: PayloadAction<shift_settings>) => {
            const shiftIndex = state.settings.shift_settings.findIndex((shifts) => shifts.location_id === action.payload.location_id);
            if (shiftIndex !== -1) {
                state.settings.shift_settings[shiftIndex] = action.payload;
            }
        },
        // Fleet simulation settings reducers
        setSimulationVehicle: (state, action: PayloadAction<{ id: number; simulation_count: number }>) => {
            const vehicle = state.fleetSimulationSettings.simulation_vehicles.findIndex((v) => v.id == action.payload.id);
            if (vehicle !== -1) {
                if (action.payload.simulation_count === 0) {
                    state.fleetSimulationSettings.simulation_vehicles.splice(vehicle, 1);
                } else {
                    state.fleetSimulationSettings.simulation_vehicles[vehicle].simulation_count = action.payload.simulation_count;
                }
            } else {
                if (action.payload.simulation_count != 0) state.fleetSimulationSettings.simulation_vehicles.push(action.payload);
            }
        },
        setSimulationVehicles: (state, action: PayloadAction<{ id: number; simulation_count: number }[]>) => {
            state.fleetSimulationSettings.simulation_vehicles = action.payload;
        },
        addExtraVehicles: (state, action: PayloadAction<Vehicle[]>) => {
            action.payload.forEach((vehicle) => {
                if (!state.fleetSimulationSettings.extraVehicles.find((v) => v.id === vehicle.id)) {
                    state.fleetSimulationSettings.extraVehicles.push(vehicle);
                }
            });
        },
        setLocationForvaltning: (state, action: PayloadAction<SelectedLocation[]>) => {
            state.locationForvaltning = action.payload;
            state.location_ids = action.payload.map((loc) => loc.id);
            state.forvaltninger = action.payload.reduce((acc, loc) => {
                (acc[loc.forvaltning] ||= []).push(loc.id);
                return acc;
            }, {} as Record<string, number[]>);
        },
        addExtraVehicle: (state, action: PayloadAction<Vehicle>) => {
            const existing = state.fleetSimulationSettings.extraVehicles.findIndex((v) => v.id === action.payload.id);
            if (existing === -1) {
                state.fleetSimulationSettings.extraVehicles.push(action.payload);
            }
        },
        removeExtraVehicle: (state, action: PayloadAction<Vehicle>) => {
            const existing = state.fleetSimulationSettings.extraVehicles.findIndex((v) => v.id === action.payload.id);
            if (existing !== -1) {
                const simulationVehiclesIndex = state.fleetSimulationSettings.simulation_vehicles.findIndex(
                    (vehicle) => vehicle.id === state.fleetSimulationSettings.extraVehicles[existing].id
                );
                state.fleetSimulationSettings.simulation_vehicles.splice(simulationVehiclesIndex, 1);
                state.fleetSimulationSettings.extraVehicles.splice(existing, 1);
            }
        },
        clearExtraVehicles: (state, action: PayloadAction) => {
            state.fleetSimulationSettings.extraVehicles = [];
        },
        clearSimulationVehicle: (state, action: PayloadAction) => {
            state.fleetSimulationSettings.simulation_vehicles = [];
        },
        // Goal simulation settings reducers
        setExtraExpense: (state, action: PayloadAction<number | undefined>) => {
            if (action.payload) {
                state.goalSimulationSettings.extraExpense = action.payload;
            } else {
                state.goalSimulationSettings.extraExpense = undefined;
            }
        },
        setCO2eSavings: (state, action: PayloadAction<number | undefined>) => {
            if (action.payload) {
                state.goalSimulationSettings.CO2eSavings = action.payload;
            } else {
                state.goalSimulationSettings.CO2eSavings = undefined;
            }
        },
        setexpenseEmissionPrioritisation: (state, action: PayloadAction<number>) => {
            state.goalSimulationSettings.expenseEmissionPrioritisation = action.payload;
        },
        addTestVehicles: (state, action: PayloadAction<(number | undefined | null)[]>) => {
            action.payload.forEach((vehicleId) => {
                if (!state.goalSimulationSettings.testVehicles.find((id) => vehicleId === id) && vehicleId) {
                    state.goalSimulationSettings.testVehicles.push(vehicleId);
                }
            });
        },
        addTestVehicle: (state, action: PayloadAction<number>) => {
            if (!state.goalSimulationSettings.testVehicles.find((id) => id === action.payload)) {
                state.goalSimulationSettings.testVehicles.push(action.payload);
            }
        },
        addTestVehicleMeta: (state, action: PayloadAction<Vehicle>) => {
            const existing = state.goalSimulationSettings.testVehiclesMeta.findIndex((v) => v.id === action.payload.id);
            if (existing === -1) {
                state.goalSimulationSettings.testVehiclesMeta.push(action.payload);
            }
        },
        addTestVehiclesMeta: (state, action: PayloadAction<undefined | Vehicle[]>) => {
            if (action.payload) {
                action.payload.forEach((veh) => {
                    if (!state.goalSimulationSettings.testVehiclesMeta.find((vehKnown) => vehKnown.id === veh.id) && veh) {
                        state.goalSimulationSettings.testVehiclesMeta.push(veh);
                    }
                });
            }
        },
        removeTestVehicle: (state, action: PayloadAction<number>) => {
            state.goalSimulationSettings.testVehicles = state.goalSimulationSettings.testVehicles.filter((i) => i != action.payload);
        },
        removeTestVehicleMeta: (state, action: PayloadAction<Vehicle>) => {
            const existing = state.goalSimulationSettings.testVehiclesMeta.findIndex((v) => v.id === action.payload.id);
            if (existing !== -1) {
                state.goalSimulationSettings.testVehiclesMeta.splice(existing, 1);
            }
        },
        clearTestVehicles: (state, action: PayloadAction) => {
            state.goalSimulationSettings.testVehicles = [];
            state.goalSimulationSettings.testVehiclesMeta = [];
        },
        setGoalSimulationVehicles: (state, action: PayloadAction<number[]>) => {
            state.goalSimulationSettings.fixed_vehicles = action.payload;
        },
        setLocationAddresses: (state, action: PayloadAction<LocationIdAddress[]>) => {
            state.locationIdAddresses = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchSimulationSettings.fulfilled, (state, action) => {
            state.settings = action.payload;
        });
        builder.addCase(setAllShiftSettings.fulfilled, (state, action) => {
            state.settings.shift_settings = action.payload;
        });
    },
});

export const {
    addCar,
    removeCarById,
    setCars,
    setCarsByDepartment,
    clearCars,
    setEndDate,
    setLocationId,
    setLocationIds,
    setForvaltningLocations,
    setStartDate,
    addExtraVehicle,
    addExtraVehicles,
    clearExtraVehicles,
    clearSimulationVehicle,
    removeExtraVehicle,
    setIntelligentAllocation,
    setLimitKm,
    setSimulationVehicle,
    addTestVehicle,
    addTestVehicles,
    clearTestVehicles,
    removeTestVehicle,
    setCO2eSavings,
    setExtraExpense,
    setexpenseEmissionPrioritisation,
    setLocationForvaltning,
    setGoalSimulationVehicles,
    setSimulationVehicles,
    setAllSettings,
    setSimulationSettings,
    setBikeSettings,
    setLocationSpecificShifts,
    addTestVehicleMeta,
    addTestVehiclesMeta,
    removeTestVehicleMeta,
    setLocationAddresses,
} = simulationSlice.actions;

export default simulationSlice.reducer;
