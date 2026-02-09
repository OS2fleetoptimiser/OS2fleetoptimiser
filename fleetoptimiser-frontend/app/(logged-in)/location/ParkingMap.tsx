'use client';

import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import { useGetLatLonAddress } from "@/components/hooks/useAddressSearch";
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {AllowedStart} from "@/components/hooks/useGetLocationPrecision";
import {Button, Chip, TextField} from "@mui/material";
import dayjs from "dayjs";
import {useEffect, useState} from "react";

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
                let copyPs = {...parkingSpots} as AllowedStart
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
                <TextField className="mr-4" id="filled-basic" label="Adresse" size="small" variant="filled" onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setAddress(event.target.value);
                  }} />
                <Button variant="contained" color="secondary" onClick={
                    () => setSearchAddress(address)
                }>Søg</Button>
                {
                    data === null &&
                    <Chip className="ml-2" label="Kunne ikke finde adresse."/>
                }
            </div>
            {parkingSpots &&
            <MapContainer
                center={(parkingSpots.latitude && parkingSpots.longitude) ? [parkingSpots.latitude, parkingSpots.longitude] : [55.66237749227234, 12.586059686301747]}
                zoom={16}
                style={{height: '80%', width: '100%', zIndex: 5}}
            >

                <RecenterAutomatically
                    lat={data && data.lat ? data.lat : parkingSpots.latitude}
                    lng={data && data.lon ? data.lon : parkingSpots.longitude}
                />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                {parkingSpots.latitude && parkingSpots.longitude &&
                    <Marker position={[parkingSpots.latitude, parkingSpots.longitude]}>
                        <Popup>
                            <p>#1</p>
                            <p>Koordinator: ({parkingSpots.latitude}, {parkingSpots.longitude})</p>
                        </Popup>
                    </Marker>}
                {parkingSpots.additional_starts &&
                    parkingSpots.additional_starts.map((spot, index) => (
                        <Marker key={'marker' + index} position={[spot.latitude, spot.longitude]}>
                            <Popup>
                                <div>
                                    <p>#{parkingSpots.latitude ? 2 + index : 1 + index}</p>
                                    <p>Koordinator: ({spot.latitude}, {spot.longitude})</p>
                                    <p>Tilføjet: {spot.addition_date?.split('T')[0]}</p>
                                </div>
                            </Popup>
                        </Marker>
                    ))
                }
                {clickEnabled && <LocationMarker/>}
            </MapContainer>
            }
        {clickEnabled &&
            <div>
                <Chip className="my-2" label="Tilføjelse aktiv, klik på et punkt på kortet for at gemme"/>
                <Button color="secondary" variant="contained" className="ml-10" onClick={() => setClickEnabled(false)}>Fortryd</Button>
            </div>
        }

            </>

    );
};

export default ParkingMap
