import { useMutation, useQuery } from "@tanstack/react-query";

type LatLon = {
  lat: number;
  lon: number;
  displayName: string;
};

const fetchLatLon = async (address: string): Promise<LatLon | null> => {
  const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    address
  )}&format=jsonv2&countrycodes=dk`;

  const response = await fetch(osmUrl);

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
    displayName: data[0].display_name,
  };
};

export const useGetLatLonAddress = (address: string) => {
  return useQuery({
    queryKey: ['latlon', address],
    queryFn: () => fetchLatLon(address),
    enabled: !!address
  });
};

export const useSearchAddress = () => {
  return useMutation({
    mutationFn: fetchLatLon,
  });
};
