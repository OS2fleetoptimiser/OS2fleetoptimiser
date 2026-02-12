'use client';

import ToolTip from '@/components/ToolTip';
import { setexpenseEmissionPrioritisation } from '@/components/redux/SimulationSlice';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { Slider } from '@mui/material';
import RecyclingIcon from '@mui/icons-material/Recycling';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

const OptimisationSettings = () => {
    const dispatch = useAppDispatch();

    return (
        <div className="mb-2 w-full max-w-128">
            <div className="flex mb-2 items-center justify-start ml-4">
                <span className="font-bold">
                    Vægtning mellem omkostning og CO2e udledning
                    <ToolTip>
                        For at guide algoritmen i valg af løsninger, kan du prioritere mellem CO2e-udledning og omkostning, hvis du vægter en af målene højere.
                        Er slideren helt til venstre, med en værdi på 0, vil omkostninger blive prioriteret, mens CO2e vægtes mere jo højere en værdi - maksimum
                        10.
                    </ToolTip>
                </span>
            </div>
            <div className="flex items-center">
                <AttachMoneyIcon className="mx-4"/>
                <Slider
                    value={useAppSelector((state) => state.simulation.goalSimulationSettings.expenseEmissionPrioritisation)}
                    onChange={(e, v) => {
                        if (typeof v === 'number') dispatch(setexpenseEmissionPrioritisation(v));
                    }}
                    step={1}
                    marks
                    min={0}
                    max={10}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => (<div className="z-10">{value*10}% CO2e Udledning<br/>{(10 - value) * 10}% Omkostning </div>)}
                ></Slider>
                <RecyclingIcon className="mx-4 mr-8 text-green-800"/>
            </div>
        </div>
    );
};

export default OptimisationSettings;
