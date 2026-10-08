// Real recycling locations from OpenStreetMap via the Overpass API (free, no key).
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const cache = new Map();

export async function findHubs(lat, lng, r) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${r}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.data;
  const around = `(around:${r},${lat},${lng})`;
  const q = `[out:json][timeout:20];(
    nwr["amenity"="recycling"]${around};
    nwr["amenity"="waste_transfer_station"]${around};
    nwr["shop"="scrap_yard"]${around};
    nwr["industrial"="scrap_yard"]${around};
    nwr["landuse"="landfill"]${around};
  );out center 80;`;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'EcoSync/1.0 (school project)' }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) continue;
      const json = await res.json();
      const hubs = json.elements.map((e) => toHub(e, lat, lng)).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm);
      const data = { source: 'OpenStreetMap', sample: false, hubs };
      cache.set(key, { at: Date.now(), data });
      return data;
    } catch { /* try next mirror */ }
  }
  return { source: 'OpenStreetMap', unavailable: true, hubs: [] };
}

function toHub(e, lat, lng) {
  const t = e.tags || {}; const p = e.center || e;
  if (p.lat == null) return null;
  const accepts = Object.keys(t).filter((k) => k.startsWith('recycling:') && t[k] === 'yes').map((k) => k.slice(10));
  const kind = t.recycling_type === 'centre' ? 'centre' : t.amenity === 'waste_transfer_station' ? 'transfer' : (t.shop === 'scrap_yard' || t.industrial === 'scrap_yard') ? 'scrap' : t.landuse === 'landfill' ? 'landfill' : 'container';
  const names = { centre: 'Recycling centre', transfer: 'Waste transfer station', scrap: 'Scrap yard', landfill: 'Landfill site', container: 'Recycling drop-off' };
  return {
    id: `${e.type}/${e.id}`, name: t.name || t.operator || names[kind], kind, kindLabel: names[kind],
    lat: p.lat, lng: p.lon, accepts, operator: t.operator || null, hours: t.opening_hours || null, phone: t.phone || t['contact:phone'] || null,
    official: !!(t.operator || kind === 'centre' || kind === 'transfer'), distanceKm: +dist(lat, lng, p.lat, p.lon).toFixed(2),
  };
}
function dist(a, b, c, d) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
