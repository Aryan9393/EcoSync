// Google Places (New) Text Search for recycling businesses near a point.
// Used when GOOGLE_MAPS_API_KEY is set; results are merged with OpenStreetMap.
const QUERIES = [
  ['recycling centre', 'centre'],
  ['scrap dealer kabadiwala', 'scrap'],
  ['e-waste recycling', 'centre'],
];
const FIELDS = 'places.id,places.displayName,places.location,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours.openNow,places.businessStatus';
const cache = new Map();
export let placesStatus = { ok: null, error: null };

const dist = (a, b, c, d) => { const R = 6371, r = (x) => (x * Math.PI) / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

export async function googleHubs(lat, lng, radius) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return [];
  const ck = `${lat.toFixed(2)},${lng.toFixed(2)},${radius}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.data;
  const out = new Map();
  await Promise.all(QUERIES.map(async ([textQuery, kind]) => {
    try {
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
        body: JSON.stringify({ textQuery, maxResultCount: 20, locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radius, 50000) } } }),
        signal: AbortSignal.timeout(12_000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { placesStatus = { ok: false, error: j?.error?.message || `HTTP ${r.status}` }; return; }
      placesStatus = { ok: true, error: null };
      for (const p of j.places || []) {
        if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
        const d = dist(lat, lng, p.location.latitude, p.location.longitude);
        if (d * 1000 > radius * 1.5) continue;
        const isE = /e-?waste/i.test(textQuery) || /electronic/i.test(p.displayName?.text || '');
        out.set(p.id, {
          id: `google/${p.id}`, name: p.displayName?.text || 'Recycling place', kind, kindLabel: kind === 'scrap' ? 'Scrap dealer' : isE ? 'E-waste recycler' : 'Recycling centre',
          lat: p.location.latitude, lng: p.location.longitude, accepts: isE ? ['electrical_appliances', 'mobile_phones', 'batteries'] : [],
          address: p.formattedAddress || null, rating: p.rating || null, ratings: p.userRatingCount || 0, openNow: p.regularOpeningHours?.openNow ?? null,
          mapsUrl: p.googleMapsUri || null, official: false, source: 'Google', distanceKm: +d.toFixed(2),
        });
      }
    } catch (e) { placesStatus = { ok: false, error: e.message }; }
  }));
  const data = [...out.values()];
  cache.set(ck, { at: Date.now(), data });
  return data;
}
