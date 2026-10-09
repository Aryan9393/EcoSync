// Real pickup tracking.
// Collector: after "I'm leaving now", the phone's GPS is sent every few seconds while the trip is active.
// Seller: sees the collector's real position, the road route and an arrival time computed from it.
import { get, post } from './api.js';
import { S } from './state.js';
import { $, esc, toast, sheet, dayLabel } from './ui.js';
import { icon } from './icons.js';
import { tiles } from './views.js';

const VEHICLE = { bike: 'Bike / scooter', van: 'Tempo / van', cycle: 'Cycle cart' };
export const vehicleLabel = (v) => VEHICLE[v] || VEHICLE.bike;
const SRC = { google: 'Live traffic · Google Maps', osm: 'Road route · OpenStreetMap', estimate: 'Estimate from distance' };
export const clock = (t) => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const mins = (s) => (s < 60 ? 'under a minute' : `${Math.round(s / 60)} min`);
const agoS = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 10 ? 'just now' : s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`; };

export function statusLine(p) {
  switch (p.status) {
    case 'scheduled': return { tag: '', text: 'Waiting for a collector to accept' };
    case 'accepted': return { tag: 'warn', text: `${esc(p.collector?.name || 'A collector')} accepted · not left yet` };
    case 'on_the_way': return { tag: 'ok', text: p.eta ? `On the way · arriving ${clock(p.eta.arriveAt)}` : 'On the way · getting location' };
    case 'arrived': return { tag: 'ok', text: `${esc(p.collector?.name || 'Collector')} has arrived` };
    case 'completed': return { tag: 'ok', text: 'Collected' };
    case 'cancelled': return { tag: 'bad', text: 'Cancelled' };
    default: return { tag: '', text: esc(p.status) };
  }
}

// Google encoded polyline → [[lat, lng], ...]
export function decodePolyline(str) {
  const out = []; let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let b, shift = 0, res = 0;
      do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = res & 1 ? ~(res >> 1) : res >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

// ---------- Seller (and collector) live view ----------
export function openTracker(id, onChange) {
  let timer, map, me, home, line, last = null, closed = false;
  sheet({
    title: 'Live pickup.', sub: '<span id="tk-sub">Loading…</span>', wide: true,
    body: `<div id="tk-state"></div><div class="map" id="tk-map" style="height:330px" hidden></div><div id="tk-foot"></div>`,
    async onMount(el, close) {
      const L = window.L;
      const draw = (p) => {
        last = p;
        $('#tk-sub', el).innerHTML = `${dayLabel(p.date)} · ${p.slot}${p.role === 'seller' ? ` · your code <b class="mono">${p.code}</b>` : ''}`;
        const live = p.live && ['on_the_way', 'arrived'].includes(p.status);
        if (!live) {
          $('#tk-map', el).hidden = true;
          const st = statusLine(p);
          $('#tk-state', el).innerHTML = `<div class="empty"><span class="serif">${p.status === 'scheduled' ? 'No collector yet.' : p.status === 'accepted' ? 'Accepted. Not on the road yet.' : p.status === 'completed' ? 'Collected.' : 'Not active.'}</span>
            <span>${p.status === 'scheduled' ? 'As soon as a collector near you accepts, you\'ll see their name here.' : p.status === 'accepted' ? `${esc(p.collector?.name)} will share their live location when they leave. The arrival time appears then, worked out from their real position.` : st.text}</span></div>`;
          $('#tk-foot', el).innerHTML = '';
          return;
        }
        $('#tk-map', el).hidden = false;
        if (!map) {
          map = L.map($('#tk-map', el), { zoomControl: true }); tiles(map);
          home = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: `<div class="pin" style="background:#7fe3b4">${icon('home')}</div>`, iconSize: [26, 26], iconAnchor: [13, 26] }) }).addTo(map);
          me = L.marker([p.live.lat, p.live.lng], { icon: L.divIcon({ className: '', html: `<div class="truck">${icon('truck')}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] }), zIndexOffset: 500 }).addTo(map);
        }
        me.setLatLng([p.live.lat, p.live.lng]);
        line?.remove();
        const pts = p.eta?.polyline ? decodePolyline(p.eta.polyline) : [[p.live.lat, p.live.lng], [p.lat, p.lng]];
        line = L.polyline(pts, { color: getComputedStyle(document.documentElement).getPropertyValue('--fg').trim(), weight: 4, opacity: 0.75, dashArray: p.eta?.polyline ? null : '4 8', lineCap: 'round' }).addTo(map);
        if (!map._fitted) { map.fitBounds(L.latLngBounds([...pts, [p.live.lat, p.live.lng], [p.lat, p.lng]]), { padding: [36, 36], maxZoom: 16 }); map._fitted = true; }
        const stale = Date.now() - p.live.at > 120_000;
        const arrived = p.status === 'arrived';
        $('#tk-state', el).innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:12px">
            <div><div class="muted" style="font-size:12px">${arrived ? 'Arrived at' : 'Arriving at'}</div><div class="amount">${p.eta ? clock(p.eta.arriveAt) : '—'}</div></div>
            <div style="text-align:right"><div style="font-weight:600">${arrived ? 'At your door' : p.eta ? `${mins(p.eta.seconds)} · ${(p.eta.meters / 1000).toFixed(1)} km` : 'Working out the route…'}</div>
            <div class="muted" style="font-size:12px">${esc(p.collector?.name || '')} · ${vehicleLabel(p.vehicle)} · left at ${clock(p.departedAt)}</div></div></div>
          ${stale ? `<div class="note">${icon('alert')}<span>No location from the collector for ${agoS(p.live.at).replace(' ago', '')}. Their phone may have lost signal; the last known position is shown.</span></div>` : ''}`;
        $('#tk-foot', el).innerHTML = `<p class="faint" style="font-size:11.5px;margin-top:10px">Location updated ${agoS(p.live.at)}${p.live.accuracy ? ` · accurate to ${Math.round(p.live.accuracy)} m` : ''}${p.eta ? ` · ${SRC[p.eta.source] || ''}` : ''}</p>`;
      };
      const tick = async () => {
        if (closed) return;
        try { const { pickup } = await get(`/api/pickups/${id}/track`); const changed = last && last.status !== pickup.status; draw(pickup); if (changed) onChange?.(pickup); }
        catch (e) { $('#tk-state', el).innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
        timer = setTimeout(tick, document.hidden ? 20_000 : 8_000);
      };
      tick();
    },
    onClose() { closed = true; clearTimeout(timer); map?.remove(); },
  });
}

// ---------- Collector: sharing live location ----------
let share = null; // { id, watch, lastSent, lastPos, wake, name }
export const sharingId = () => share?.id || null;

function renderBar() {
  let bar = $('#share-bar');
  if (!share) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'share-bar'; bar.className = 'share-bar'; document.body.append(bar); }
  bar.innerHTML = `<span class="pulse"></span><span class="grow">Sharing your location with ${esc(share.name)}${share.lastSent ? ` · sent ${agoS(share.lastSent)}` : ''}</span><a class="btn btn-sm" href="#/pickups">Open</a>`;
}
export async function startSharing(p, onUpdate) {
  if (!navigator.geolocation) throw new Error('This device can\'t share its location.');
  stopSharing(false);
  share = { id: p.id, name: p.seller?.name || 'the seller', lastSent: 0, lastPos: null, onUpdate };
  try { share.wake = await navigator.wakeLock?.request('screen'); } catch { /* optional */ }
  const send = async (pos, force) => {
    if (!share) return;
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const moved = share.lastPos ? Math.hypot((lat - share.lastPos.lat) * 111_000, (lng - share.lastPos.lng) * 111_000 * Math.cos((lat * Math.PI) / 180)) : Infinity;
    if (!force && Date.now() - share.lastSent < 8_000 && moved < 40) return;
    share.lastSent = Date.now(); share.lastPos = { lat, lng };
    try {
      const { pickup } = await post(`/api/pickups/${share.id}/location`, { lat, lng, accuracy });
      share?.onUpdate?.(pickup);
      if (pickup.status === 'arrived' && share) toast('You\'ve arrived. Ask the seller for their pickup code.');
    } catch (e) { if (/ended/.test(e.message)) stopSharing(); }
    renderBar();
  };
  share.watch = navigator.geolocation.watchPosition((pos) => send(pos), (e) => { if (e.code === 1) { toast('Location permission was turned off. Sharing stopped.', 'err'); stopSharing(); } },
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
  share.heartbeat = setInterval(() => navigator.geolocation.getCurrentPosition((pos) => send(pos, true), () => {}, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }), 30_000);
  renderBar();
}
export function stopSharing(render = true) {
  if (!share) return;
  navigator.geolocation?.clearWatch(share.watch); clearInterval(share.heartbeat);
  share.wake?.release?.().catch?.(() => {});
  share = null; if (render) renderBar();
}
export function currentPosition() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('This device can\'t share its location.'));
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => rej(new Error(e.code === 1 ? 'Allow location access so the seller can see you coming.' : 'Couldn\'t get your location. Step outside or turn on GPS and try again.')),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
  });
}
// Resume sharing after a page reload if a trip is active.
export async function resumeSharing() {
  if (!S.user || share) return;
  try { const { jobs } = await get('/api/pickups/jobs'); const live = jobs.find((j) => ['on_the_way', 'arrived'].includes(j.status)); if (live) await startSharing(live); } catch { /* ignore */ }
}
