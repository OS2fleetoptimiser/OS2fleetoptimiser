import { configureStore, ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import simulationSlice from './SimulationSlice';

const store = configureStore({
    reducer: {
        simulation: simulationSlice,
    },
});

export default store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = ThunkDispatch<RootState, undefined, UnknownAction>;
