import { useState, useEffect } from 'react';

/**
 * Watches the browser's geolocation and returns the current position.
 * Falls back gracefully if the user denies permission.
 */
export function useUserLocation() {
  const [userLoc, setUserLoc]   = useState(null);   // { lat, lng, accuracy }
  const [locError, setLocError] = useState(null);
  const [locLoading, setLocLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation not supported by this browser.');
      setLocLoading(false);
      return;
    }

    // Initial one-shot fetch
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocLoading(false);
      },
      (err) => {
        setLocError(`Location unavailable (${err.message})`);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );

    // Then watch for changes
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLoc({
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {},
      { enableHighAccuracy: true },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { userLoc, locError, locLoading };
}

/**
 * Given the user's location and the list of resources,
 * returns resources sorted by distance ascending,
 * plus the distance for each one.
 */
export function useNearbyResponders(userLoc, resources) {
  if (!userLoc || !resources?.length) return [];

  return resources
    .map((res) => {
      const dLat = ((res.lat - userLoc.lat) * Math.PI) / 180;
      const dLng = ((res.lng - userLoc.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((userLoc.lat * Math.PI) / 180) *
          Math.cos((res.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...res, distKm };
    })
    .sort((a, b) => a.distKm - b.distKm);
}
