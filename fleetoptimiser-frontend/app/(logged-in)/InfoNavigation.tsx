'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import ToolTip from '@/components/ToolTip';
import Typography from '@mui/material/Typography';

const InfoNav = () => {
    let pathname: string = usePathname();
    const pathnameSplit = pathname.split('/');

    const pageTitle: { [key: string]: string } = {
        driving: 'Dashboard  /  Kørsel',
        'trip-segments': 'Dashboard  /  Turoverblik',
        activity: 'Dashboard  /  Køretøjsaktivitet',
        timeactivity: 'Dashboard  /  Tidsaktivitet',
        availability: 'Dashboard  /  Ledighed',
        dashboard: 'Dashboard',
        settings: 'Settings',
        profile: 'Profile',
        '/': 'Simuleringssetup',
        configuration: 'Konfiguration / Køretøjer',
        fleet: 'Manuel simulering',
        goal: 'Automatisk simulering',
        'simulation-history': 'Simuleringshistorik',
        location: 'Konfiguration / Lokationer'
    };

    if (pathname !== '/') {
        for (let pi = pathnameSplit.length; pi > 0; pi--) {
            let pathPart = pathnameSplit[pi];
            if (Object.keys(pageTitle).includes(pathPart)) {
                pathname = pathPart;
                break;
            }
        }
    }

    const pageInformation: { [key: string]: string } = {
        Simuleringssetup:
            'Her udvælges lokationer, tidsperiode samt køretøjer, der skal danne baggrund for simuleringerne. Når denne side er udfyldt, så kan både\n' +
            '                    manuel og automatisk simulering tilgåes',
        'Konfiguration / Køretøjer':
            'På denne side kan man rette i oplysninger om indregistrerede køretøjer og tilføje nye køretøjer man gerne vil bruge i simuleringsværktøjer.\n' +
            '                    Vær observant på at kommatal skal skrives i engelsk format, dvs. punktum i stedet for komma.',
        'Manuel simulering':
            'På denne side kan man som bruger undersøge hvilken indflydelse det har, at tilføje eller fjerne køretøjer til den samlede flåde. Disse ændringer\n' +
            '                kommer til at påvirke de estimerede årlige omkostninger, det estimerede årlige CO2e forbrug, samt hvor mange ture der ikke bliver allokeret.',
        'Dashboard  /  Køretøjsaktivitet':
            'Grafen er opdelt på dagsbasis når perioden er under 31 dage, på uge basis når perioden er under 90 dage, og på månedsbasis hvis perioden er\n' +
            '                    længere end 90 dage.',
        'Dashboard  /  Tidsaktivitet': 'Indtast en anden grænseværdi, hvis du ønsker at fremhæve en lavere grad af udnyttelse',
        'Dashboard  /  Turoverblik':
            'Dette dashboard viser afsluttet rundture, der er startet og sluttet på samme lokation. Der vises kvalificerede rundture ud fra de indtastede\n' +
            '                    parametre, hvilket kan betyde at alle kilometer fra Køretøjsaktivitet-dashboard ikke vises.',
        'Automatisk simulering': 'På denne side kan man som bruger anmode AI modulet om at komme med forslag til nye flådesammensætninger',
        Simuleringshistorik: 'På denne side kan man se tidligere simuleringer, kørt på systemet.',
        'Konfiguration / Lokationer': 'På denne side kan du se præcisionen på rundturs-aggregering. Du kan justere på parkeringspunkter på lokationen ' +
            'for at højne kvaliteten og præcisionen af den gemte data fra flådestyringssystemet. Præcisionen er en indikation på, hvor god algoritmen er til at ' +
            'sammensætte fra enkelte GPS punkter til rundture. Det er ikke en indikation på antallet af kilometer der gemmes fra flådestyringssystemet.'
    };

    const title = pageTitle[pathname] || undefined;
    const description = title ? pageInformation[title] : undefined;

    return (
        <>
            {title && (
                <nav className="bg-white border-b border-gray-200 z-10 flex justify-between items-center p-1 px-8 md:ml-76 mb-10 mt-2 pl-6">
                    <div className="flex items-center ml-12 md:ml-0">
                        <Typography variant="h6">{title}</Typography>
                        {description && <ToolTip>{description}</ToolTip>}
                    </div>
                </nav>
            )}
        </>
    );
};

export default InfoNav;
