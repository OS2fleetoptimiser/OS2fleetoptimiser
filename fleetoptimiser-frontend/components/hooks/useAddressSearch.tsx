import { useQuery } from "@tanstack/react-query";

type LatLon = {
  lat: number;
  lon: number;
};

const fetchLatLon = async (address: string): Promise<LatLon | null> => {
  const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    address
  )}&format=jsonv2`;

  const headers = {
    'User-Agent': 'FleetOptimiser/1.0',
  };

  const response = await fetch(osmUrl, { headers });

  if (!response.ok) {
    console.error(
      `Calling ${address} for OSM failed with error code ${response.status}, url: ${osmUrl}`
    );
    return null;
  }

  const data = await response.json();

  if (data.length === 0) {
    console.warn(`Could not find lat/lon for ${address} with OSM, url: ${osmUrl}`);
    return null;
  }

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
  };
};

export const useGetLatLonAddress = (address: string) => {
  return useQuery({
    queryKey: ['latlon', address],
    queryFn: () => fetchLatLon(address),
    enabled: !!address
  });
};
