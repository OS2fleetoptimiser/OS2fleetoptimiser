'use client';

import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import { useGetLatLonAddress } from "@/components/hooks/useAddressSearch";
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {AllowedStart} from "@/components/hooks/useGetLocationPrecision";
import {Alert, Button, Chip, TextField} from "@mui/material";
import dayjs from "dayjs";
import {useEffect, useState} from "react";
import { gray } from '@/theme/themePrimitives';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: typeof markerIcon2x === 'string' ? markerIcon2x : markerIcon2x.src,
  iconUrl: typeof markerIcon === 'string' ? markerIcon : markerIcon.src,
  shadowUrl: typeof markerShadow === 'string' ? markerShadow : markerShadow.src,
});

type ParkingMapProps = {
    setNoChanges: (unchanged: boolean) => void;
    parkingSpots?: AllowedStart;
    changeParkingSpots: (e: any) => void;
    clickEnabled: boolean;
    setClickEnabled: (e: any) => void;
};

const ParkingMap = ({
    setNoChanges,
    parkingSpots,
    changeParkingSpots,
    clickEnabled,
    setClickEnabled
}: ParkingMapProps) => {
    const nowDate = dayjs().toDate();
    const [address, setAddress] = useState('');
    const [searchAddress, setSearchAddress] = useState('')
    const { data } = useGetLatLonAddress(searchAddress);

    const RecenterAutomatically = ({ lat, lng }: { lat: number | null; lng: number | null }) => {
      const map = useMap();

      useEffect(() => {
        if (lat !== null && lng !== null) {
          map.setView([lat, lng], map.getZoom(), { animate: true });
        }
      }, [lat, lng, map]);

      return null;
    };
    const LocationMarker = () => {
        useMapEvents({
            click(e: { latlng: { lat: number | null ; lng: number | null; }; }) {
                const copyPs = {...parkingSpots} as AllowedStart
                if (!copyPs.additional_starts){
                    copyPs.additional_starts = []
                }
                if (copyPs.latitude === null){
                    copyPs.latitude = e.latlng.lat
                    copyPs.longitude = e.latlng.lng
                    copyPs.addition_date = nowDate.toISOString()
                } else {
                    copyPs.additional_starts.push({latitude: e.latlng.lat as number, longitude: e.latlng.lng as number, id: copyPs.additional_starts.length + 1, addition_date: nowDate.toISOString(), allowed_start_id: parkingSpots?.id ?? null})
                }
                changeParkingSpots(copyPs)
                setNoChanges(false);
                setClickEnabled(false);
                },
            });
        return null;
    };

    return (
        <>
            <div className="flex items-center mb-4">
                <TextField className="mr-4" label="Adresse" size="small" variant="outlined" onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setAddress(event.target.value);
                  }} />
                <Button variant="contained" onClick={
                    () => setSearchAddress(address)
                }>Søg</Button>
                {
                    data === null &&
                    <Chip className="ml-2" label="Kunne ikke finde adresse."/>
                }
            </div>
            {parkingSpots &&
            <div style={{ position: 'relative' }}>
                <MapContainer
                    center={(parkingSpots.latitude && parkingSpots.longitude) ? [parkingSpots.latitude, parkingSpots.longitude] : [55.66237749227234, 12.586059686301747]}
                    zoom={16}
                    style={{height: 550, width: '100%', zIndex: 5}}
                >
                    <RecenterAutomatically
                        lat={data && data.lat ? data.lat : parkingSpots.latitude}
                        lng={data && data.lon ? data.lon : parkingSpots.longitude}
                    />
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                    {parkingSpots.latitude && parkingSpots.longitude &&
                        <Marker position={[parkingSpots.latitude, parkingSpots.longitude]}>
                            <Popup>
                                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Parkeringspunkt #1</div>
                                    <div style={{ color: gray[500] }}>
                                        {parkingSpots.latitude.toFixed(5)}, {parkingSpots.longitude.toFixed(5)}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>}
                    {parkingSpots.additional_starts &&
                        parkingSpots.additional_starts.map((spot, index) => (
                            <Marker key={'marker' + index} position={[spot.latitude, spot.longitude]}>
                                <Popup>
                                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                            Parkeringspunkt #{parkingSpots.latitude ? 2 + index : 1 + index}
                                        </div>
                                        <div style={{ color: gray[500] }}>
                                            {spot.latitude.toFixed(5)}, {spot.longitude.toFixed(5)}
                                        </div>
                                        {spot.addition_date && (
                                            <div style={{ color: gray[400], fontSize: 12, marginTop: 2 }}>
                                                Tilføjet {spot.addition_date.split('T')[0]}
                                            </div>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        ))
                    }
                    {clickEnabled && <LocationMarker/>}
                </MapContainer>
                {clickEnabled &&
                    <Alert
                        severity="info"
                        sx={{ position: 'absolute', bottom: 16, left: 16, right: 16, zIndex: 1000 }}
                        action={
                            <Button color="inherit" size="small" onClick={() => setClickEnabled(false)}>
                                Fortryd
                            </Button>
                        }
                    >
                        Klik på kortet for at tilføje et parkeringspunkt
                    </Alert>
                }
            </div>
            }

            </>

    );
};

export default ParkingMap
