// Road ETA from the collector's live position to the seller's door.
// 1. Google Routes API (live traffic) when GOOGLE_MAPS_API_KEY is set.
// 2. OSRM road routing on OpenStreetMap data (free, no key).
// 3. Straight-line estimate, clearly labelled as an estimate.
const GOOGLE_MODE = { bike: 'TWO_WHEELER', van: 'DRIVE', cycle: 'BICYCLE' };
const OSRM = { bike: 'https://router.project-osrm.org/route/v1/driving', van: 'https://router.project-osrm.org/route/v1/driving', cycle: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving' };
const SPEED_KMH = { bike: 22, van: 18, cycle: 10 }; // typical city speeds, used only for the last-resort estimate
export let routingStatus = { google: null, error: null };

const km = (a, b) => { const R = 6371, r = (d) => (d * Math.PI) / 180, h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

async function google(from, to, vehicle) {
  const key = process.env.GOOGLE_MAPS_API_KEY; if (!key) return null;
  const mode = GOOGLE_MODE[vehicle] || 'TWO_WHEELER';
  const body = {
    origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
    destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
    travelMode: mode, polylineEncoding: 'ENCODED_POLYLINE',
    ...(mode === 'BICYCLE' ? {} : { routingPreference: 'TRAFFIC_AWARE' }),
  };
  const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { routingStatus = { google: false, error: j?.error?.message || `HTTP ${r.status}` }; return null; }
  const route = j.routes?.[0]; if (!route) return null;
  routingStatus = { google: true, error: null };
  return { seconds: parseInt(route.duration, 10) || 0, meters: route.distanceMeters || 0, polyline: route.polyline?.encodedPolyline || null, source: 'google' };
}
async function osrm(from, to, vehicle) {
  const url = `${OSRM[vehicle] || OSRM.bike}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=simplified&geometries=polyline`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'EcoSync/1.0 (school project)' } });
  if (!r.ok) return null;
  const j = await r.json(); const route = j.routes?.[0]; if (!route) return null;
  // OSRM's public car profile ignores traffic; scale for Indian city traffic on two-wheelers / vans.
  const factor = vehicle === 'cycle' ? 1 : vehicle === 'van' ? 1.5 : 1.25;
  return { seconds: Math.round(route.duration * factor), meters: Math.round(route.distance), polyline: route.geometry, source: 'osm' };
}
export async function routeEta(from, to, vehicle = 'bike') {
  for (const fn of [google, osrm]) {
    try { const r = await fn(from, to, vehicle); if (r) return r; } catch { /* try next */ }
  }
  const m = km(from, to) * 1000 * 1.35;
  return { seconds: Math.round((m / 1000 / (SPEED_KMH[vehicle] || 18)) * 3600), meters: Math.round(m), polyline: null, source: 'estimate' };
}
export const straightKm = km;
