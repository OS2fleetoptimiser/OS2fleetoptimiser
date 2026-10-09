'use client';

import { MapContainer, Marker } from 'react-leaflet';
import { OsmTileLayer } from '@/components/LeafletBase';

type Props = {
    latitude: number;
    longitude: number;
};

export default function WorkshopMap({ latitude, longitude }: Props) {
    return (
        <MapContainer center={[latitude, longitude]} zoom={16} style={{ height: 240, width: '100%' }}>
            <OsmTileLayer />
            <Marker position={[latitude, longitude]} />
        </MapContainer>
    );
}
