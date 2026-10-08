import { get, post } from './api.js';
import { S, locate, matColor, refreshMe } from './state.js';
import { $, $$, esc, toast, sheet, setBusy, loadScript, loadCss, ago, fileToDataUrl } from './ui.js';
import { icon } from './icons.js';
import { requireAuth } from './app.js';
import { tiles } from './views.js';
import { hasGoogle, loadGoogle, mapStyles, pinIcon, dotIcon, lookAround } from './gmaps.js';

const KIND = { centre: ['#7fe3b4', 'recycle', 'Recycling centre'], transfer: ['#93c5fd', 'truck', 'Transfer station'], scrap: ['#e3b86c', 'market', 'Scrap yard'], container: ['#d1fae5', 'recycle', 'Drop-off point'], landfill: ['#ff8a7a', 'alert', 'Landfill'] };
const streetView = (lat, lng) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
const directions = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
const coins = () => refreshMe().then(() => dispatchEvent(new Event('ecosync:coins')));

export async function render(host, params) {
  const mode = params[0] === '3d' ? '3d' : '2d';
  host.innerHTML = `<div class="page-head"><div><span class="eyebrow">Maps</span><h1>${mode === '3d' ? 'Pin it.<br>Clean it.' : 'Real places,<br>close by.'}</h1><p>${mode === '3d' ? 'Garbage spots reported by neighbours, drawn in 3D. Taller columns are worse, or confirmed by more people.' : 'Recycling centres, e-waste points and scrap yards from OpenStreetMap, nearest first.'}</p></div>
    <div class="seg" role="group" aria-label="Map"><a href="#/map" aria-pressed="${mode === '2d'}">${icon('map')}Hubs</a><a href="#/map/3d" aria-pressed="${mode === '3d'}">${icon('cube')}3D litter map</a></div></div><div id="map-host"></div>`;
  return mode === '3d' ? render3d($('#map-host')) : render2d($('#map-host'));
}

async function render2d(box) {
  if (hasGoogle()) { try { return await render2dGoogle(box); } catch (e) { toast(e.message, 'err'); } }
  let filter = 'all', radius = 8000, hubs = [], markers = [], lots;
  box.innerHTML = `<div class="toolbar"><div class="chips">${[['all', 'All'], ['official', 'Official'], ['ewaste', 'E-waste'], ['scrap', 'Scrap yards'], ['container', 'Drop-off']].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div>
    <select class="input" id="hr" style="width:auto;min-height:32px;padding:4px 10px;font-size:12.5px" aria-label="Distance"><option value="3000">3 km</option><option value="8000" selected>8 km</option><option value="15000">15 km</option></select>
    <button class="btn btn-sm" id="hme">${icon('navigate')}My location</button></div>
    <div class="map-wrap"><div class="map" id="m2"></div><div class="map-side" id="hlist"><p class="muted">Finding places…</p></div></div>`;
  const L = window.L, map = L.map('m2').setView([S.loc.lat, S.loc.lng], 14); tiles(map);
  const me = L.marker([S.loc.lat, S.loc.lng], { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [16, 16] }), zIndexOffset: 1000 }).addTo(map);
  const pin = (c, ic) => L.divIcon({ className: '', html: `<div class="pin" style="background:${c}">${icon(ic)}</div>`, iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24] });
  const visible = () => hubs.filter((h) => filter === 'all' || (filter === 'official' && h.official) || (filter === 'ewaste' && h.accepts.some((a) => /electr|batter|mobile|computer|e_waste|appliance/.test(a))) || (filter === 'scrap' && h.kind === 'scrap') || (filter === 'container' && h.kind === 'container'));
  const popup = (h) => `<b>${esc(h.name)}</b><div class="muted" style="font-size:12px">${esc(h.kindLabel)}${h.official ? ' · official' : ''} · ${h.distanceKm} km</div>${h.accepts?.length ? `<div style="font-size:12px;margin-top:6px">Takes ${esc(h.accepts.slice(0, 6).map((a) => a.replace(/_/g, ' ')).join(', '))}</div>` : ''}${h.hours ? `<div style="font-size:12px">${esc(h.hours)}</div>` : ''}
    <div class="row" style="gap:6px;margin-top:10px"><a class="btn btn-sm btn-primary" target="_blank" rel="noopener" href="${directions(h.lat, h.lng)}">Directions</a><a class="btn btn-sm" target="_blank" rel="noopener" href="${streetView(h.lat, h.lng)}">Look around</a></div>`;
  const draw = (unavailable) => {
    markers.forEach((m) => m.remove()); markers = [];
    const list = visible();
    list.forEach((h) => { const [c, ic] = KIND[h.kind] || KIND.container; const m = L.marker([h.lat, h.lng], { icon: pin(c, ic) }).bindPopup(popup(h)).addTo(map); m._id = h.id; markers.push(m); });
    $('#hlist').innerHTML = unavailable ? `<div class="empty"><span class="serif">OpenStreetMap is busy.</span><span>The map service didn't answer. Try again in a moment.</span><button class="btn btn-sm" data-retry>Try again</button></div>`
      : (list.length ? `<p class="faint" style="font-size:11.5px">${list.length} places · © OpenStreetMap contributors</p>` + list.map((h) => `<button class="hub" data-hub="${h.id}"><span class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="n">${esc(h.name)}</span><span class="num muted" style="font-size:12px;white-space:nowrap">${h.distanceKm} km</span></span>
        <span class="row" style="gap:6px"><span class="tag">${esc((KIND[h.kind] || KIND.container)[2])}</span>${h.official ? '<span class="tag ok">Official</span>' : ''}</span>${h.accepts?.length ? `<span class="faint" style="font-size:11.5px">${esc(h.accepts.slice(0, 5).map((a) => a.replace(/_/g, ' ')).join(' · '))}</span>` : ''}</button>`).join('')
        : `<div class="empty"><span>No places match within ${radius / 1000} km. Widen the distance or choose "All".</span></div>`);
  };
  const load = async () => {
    $('#hlist').innerHTML = '<p class="muted">Finding places…</p>';
    try { const r = await get(`/api/hubs?lat=${S.loc.lat}&lng=${S.loc.lng}&r=${radius}`); hubs = r.hubs; draw(r.unavailable); if (hubs.length) map.fitBounds(L.latLngBounds([[S.loc.lat, S.loc.lng], ...visible().slice(0, 12).map((h) => [h.lat, h.lng])]), { padding: [40, 40], maxZoom: 15 }); }
    catch (e) { $('#hlist').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  const loadLots = async () => {
    lots?.remove();
    const { listings } = await get(`/api/listings?lat=${S.loc.lat}&lng=${S.loc.lng}`).catch(() => ({ listings: [] }));
    lots = L.layerGroup(listings.map((l) => L.circleMarker([l.lat, l.lng], { radius: 7, color: '#0a0a0a', weight: 2, fillColor: matColor(l.material), fillOpacity: 1 }).bindPopup(`<b>${esc(l.title)}</b><div class="muted" style="font-size:12px">${l.kg} kg · ₹${l.price}</div><a class="btn btn-sm btn-primary" style="margin-top:8px" href="#/market">Open in market</a>`))).addTo(map);
  };
  box.addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; $$('[data-f]', box).forEach((b) => b.setAttribute('aria-pressed', String(b === f))); draw(); return; }
    if (e.target.closest('[data-retry]')) return load();
    const h = e.target.closest('[data-hub]'); if (h) { const m = markers.find((x) => x._id === h.dataset.hub); if (m) { map.setView(m.getLatLng(), 16); m.openPopup(); } }
  });
  $('#hr').onchange = (e) => { radius = +e.target.value; load(); };
  $('#hme').onclick = async () => { const l = await locate(true); if (l.approx) toast('Allow location access to use your exact position.', 'err'); me.setLatLng([l.lat, l.lng]); map.setView([l.lat, l.lng], 14); load(); loadLots(); };
  setTimeout(() => map.invalidateSize(), 60);
  locate().then((l) => { me.setLatLng([l.lat, l.lng]); map.setView([l.lat, l.lng], 14); load(); loadLots(); });
  return () => map.remove();
}

// ---------- 3D litter map (MapLibre + OpenFreeMap 3D buildings) ----------
const SEV = ['#7fe3b4', '#f1c96b', '#ff9e6b', '#ff6b6b'];
const hex = (lat, lng, r) => { const o = []; for (let i = 0; i <= 6; i++) { const a = (Math.PI / 3) * i; o.push([lng + (r * Math.cos(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (r * Math.sin(a)) / 110540]); } return [o]; };
function offlineStyle(c) {
  // Used only when the vector-tile style can't load: a quiet generated city so the map still works.
  let s = Math.round(Math.abs(c.lat * 1e4 + c.lng * 1e4)) || 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const blocks = [];
  for (let x = -14; x <= 14; x++) for (let y = -14; y <= 14; y++) {
    if (x % 5 === 0 || y % 5 === 0 || rnd() < 0.2) continue;
    const la = c.lat + y * 0.00055, ln = c.lng + x * 0.00065, w = 0.0002 + rnd() * 0.00014, h = 0.00018 + rnd() * 0.00015;
    blocks.push({ type: 'Feature', properties: { h: 6 + Math.pow(rnd(), 2.2) * (Math.hypot(x, y) < 6 ? 60 : 24) }, geometry: { type: 'Polygon', coordinates: [[[ln - w, la - h], [ln + w, la - h], [ln + w, la + h], [ln - w, la + h], [ln - w, la - h]]] } });
  }
  const css = getComputedStyle(document.documentElement), v = (n) => css.getPropertyValue(n).trim();
  return { version: 8, sources: { b: { type: 'geojson', data: { type: 'FeatureCollection', features: blocks } } }, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': v('--map-bg') } }, { id: 'b', type: 'fill-extrusion', source: 'b', paint: { 'fill-extrusion-color': v('--surface-2'), 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.95 } }] };
}
async function render3d(box) {
  box.innerHTML = `<div class="map" id="m3" style="height:calc(100vh - 250px);min-height:460px">
    <div class="overlay"><button class="btn btn-sm glass" id="o-orbit">${icon('orbit')}Orbit</button><button class="btn btn-sm btn-primary" id="o-report">${icon('flag')}Report litter</button><button class="btn btn-sm glass" id="o-look">${icon('eye')}Look around</button><button class="btn btn-sm glass" id="o-me">${icon('navigate')}Me</button></div>
    <div class="legend glass"><span><i style="background:${SEV[1]}"></i>Low</span><span><i style="background:${SEV[2]}"></i>Medium</span><span><i style="background:${SEV[3]}"></i>High</span><span><i style="background:${SEV[0]}"></i>Cleaned</span></div>
    <div class="map-note glass" id="m3-note" hidden></div>
    <div id="m3-load" style="position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-size:12.5px"><span class="row"><span class="spinner"></span>Building the city…</span></div></div>`;
  try { loadCss('vendor/maplibre-gl.css'); await loadScript('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'); }
  catch { $('#m3-load').innerHTML = '<div class="empty">The 3D map couldn\'t load. Check your connection.</div>'; return; }
  const ml = window.maplibregl, loc = await locate();
  let reports = [], orbit = false, raf = 0, reporting = false;
  const ok = await fetch(S.config?.mapStyle || '').then((r) => r.ok).catch(() => false);
  const map = new ml.Map({ container: 'm3', style: ok ? S.config.mapStyle : offlineStyle(loc), center: [loc.lng, loc.lat], zoom: 15.8, pitch: 62, bearing: -20, antialias: true, attributionControl: { compact: true } });
  map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'bottom-right');
  const note = (t) => { const n = $('#m3-note'); if (n) { n.hidden = !t; n.textContent = t || ''; } };
  if (!ok) note('Showing a simplified city. Street-level 3D buildings load when the map service is reachable.');
  const geo = () => ({ type: 'FeatureCollection', features: reports.map((r) => ({ type: 'Feature', properties: { id: r.id, color: r.status === 'cleaned' ? SEV[0] : SEV[r.severity] || SEV[2], h: r.status === 'cleaned' ? 6 : 16 + r.severity * 18 + Math.min(r.confirms || 1, 12) * 4 }, geometry: { type: 'Polygon', coordinates: hex(r.lat, r.lng, 14) } })) });
  const load = async () => { try { reports = (await get(`/api/reports?lat=${loc.lat}&lng=${loc.lng}`)).reports; map.getSource('reports')?.setData(geo()); if (!reports.length) note('No litter reported around you. Spotted some? Tap "Report litter".'); } catch (e) { toast(e.message, 'err'); } };
  map.on('load', async () => {
    $('#m3-load')?.remove();
    if (ok && map.getSource('openmaptiles') && !map.getStyle().layers.some((l) => l.type === 'fill-extrusion')) {
      map.addLayer({ id: 'es-buildings', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14, paint: { 'fill-extrusion-color': '#9aa39e', 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.8 } });
    }
    map.addSource('reports', { type: 'geojson', data: geo() });
    map.addLayer({ id: 'reports-3d', type: 'fill-extrusion', source: 'reports', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.95 } });
    map.addSource('me', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: hex(loc.lat, loc.lng, 7) } } });
    map.addLayer({ id: 'me-3d', type: 'fill-extrusion', source: 'me', paint: { 'fill-extrusion-color': '#ffffff', 'fill-extrusion-height': 46 } });
    const { hubs } = await get(`/api/hubs?lat=${loc.lat}&lng=${loc.lng}&r=4000`).catch(() => ({ hubs: [] }));
    map.addSource('hubs', { type: 'geojson', data: { type: 'FeatureCollection', features: hubs.slice(0, 25).map((h) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: hex(h.lat, h.lng, 9) } })) } });
    map.addLayer({ id: 'hubs-3d', type: 'fill-extrusion', source: 'hubs', paint: { 'fill-extrusion-color': '#93c5fd', 'fill-extrusion-height': 28 } });
    load();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) map.easeTo({ bearing: 24, zoom: 16.3, duration: 3200 });
  });
  map.on('mouseenter', 'reports-3d', () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', 'reports-3d', () => (map.getCanvas().style.cursor = ''));
  map.on('click', (e) => {
    if (reporting) { reporting = false; $('#m3').classList.remove('reporting'); note(''); return report(e.lngLat); }
    const f = map.queryRenderedFeatures(e.point, { layers: ['reports-3d'] })[0]; if (!f) return;
    const r = reports.find((x) => x.id === f.properties.id); if (!r) return;
    const pop = new ml.Popup({ offset: 12, maxWidth: '280px' }).setLngLat([r.lng, r.lat]).setHTML(`<b style="text-transform:capitalize">${esc(r.type.replace('_', '-'))}</b><div class="muted" style="font-size:12px">${['', 'Low', 'Medium', 'High'][r.severity]} · ${r.confirms} ${r.confirms === 1 ? 'report' : 'confirmations'} · ${ago(r.at)}</div>${r.note ? `<p style="margin-top:6px;font-size:12.5px">${esc(r.note)}</p>` : ''}
      <div class="row" style="gap:6px;margin-top:10px">${r.status === 'cleaned' ? '<span class="tag ok">Cleaned</span>' : '<button class="btn btn-sm" data-rc="confirm">Confirm +2</button><button class="btn btn-sm btn-primary" data-rc="clean">I cleaned it +40</button>'}<button class="btn btn-sm" data-look>Look around</button></div>`).addTo(map);
    pop.getElement().addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-look]')) return lookAround(r.lat, r.lng, `${r.type} waste report`);
      const b = ev.target.closest('[data-rc]'); if (!b || !requireAuth()) return; setBusy(b, true);
      try { const { report: nr } = await post(`/api/reports/${r.id}/${b.dataset.rc}`); Object.assign(r, nr); map.getSource('reports').setData(geo()); pop.remove(); toast(b.dataset.rc === 'clean' ? 'Thank you. +40 EcoCoins' : 'Confirmed. +2 EcoCoins'); coins(); }
      catch (er) { setBusy(b, false); toast(er.message, 'err'); }
    });
  });
  const spin = () => { map.setBearing((map.getBearing() + 0.12) % 360); raf = requestAnimationFrame(spin); };
  $('#o-orbit').onclick = (e) => { orbit = !orbit; e.currentTarget.classList.toggle('btn-primary', orbit); e.currentTarget.classList.toggle('glass', !orbit); orbit ? spin() : cancelAnimationFrame(raf); };
  $('#o-report').onclick = () => { if (!requireAuth()) return; reporting = true; $('#m3').classList.add('reporting'); note('Tap the exact spot where the garbage is.'); };
  $('#o-look').onclick = () => { const c = map.getCenter(); lookAround(c.lat, c.lng, 'Map centre'); };
  $('#o-me').onclick = async () => { const l = await locate(true); map.flyTo({ center: [l.lng, l.lat], zoom: 16.4, pitch: 62 }); };
  function report(ll) {
    let sev = 2, type = 'plastic', photo = null;
    sheet({
      title: 'Report a spot.', sub: `Pinned at ${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)} · +15 EcoCoins`,
      body: `<form class="stack" id="rp" novalidate>
        <div class="field"><span>How bad is it?</span><div class="seg" style="justify-self:start">${['Low', 'Medium', 'High'].map((l, i) => `<button type="button" data-sev="${i + 1}" aria-pressed="${i + 1 === sev}">${l}</button>`).join('')}</div></div>
        <div class="field"><span>Mostly</span><div class="chips">${['plastic', 'mixed', 'paper', 'e_waste', 'construction', 'organic'].map((t) => `<button type="button" class="chip" data-type="${t}" aria-pressed="${t === type}">${t.replace('_', '-')}</button>`).join('')}</div></div>
        <label class="btn" style="cursor:pointer;justify-self:start">${icon('camera')}<span id="rp-ph">Add a photo</span><input type="file" accept="image/*" capture="environment" id="rp-file" hidden></label>
        <label class="field"><span>Where exactly? <span class="faint">(optional)</span></span><input class="input" id="rp-note" placeholder="Behind the bus stop, by the drain"></label>
        <button class="btn btn-primary btn-lg" type="submit" id="rp-go">Pin this report ${icon('arrowUR')}</button></form>`,
      onMount(el, close) {
        el.addEventListener('click', (e) => { const s = e.target.closest('[data-sev]'), t = e.target.closest('[data-type]'); if (s) { sev = +s.dataset.sev; $$('[data-sev]', el).forEach((b) => b.setAttribute('aria-pressed', String(b === s))); } if (t) { type = t.dataset.type; $$('[data-type]', el).forEach((b) => b.setAttribute('aria-pressed', String(b === t))); } });
        $('#rp-file', el).onchange = async (e) => { const f = e.target.files[0]; if (f) { photo = await fileToDataUrl(f, 640, 0.7); $('#rp-ph', el).textContent = 'Photo added'; } };
        $('#rp', el).onsubmit = async (e) => {
          e.preventDefault(); const b = $('#rp-go', el); setBusy(b, true, 'Pinning');
          try { const { report: r } = await post('/api/reports', { lat: ll.lat, lng: ll.lng, severity: sev, type, note: $('#rp-note', el).value, photo }); reports.unshift(r); map.getSource('reports').setData(geo()); note(''); toast('Pinned. +15 EcoCoins'); close(); coins(); }
          catch (er) { setBusy(b, false); toast(er.message, 'err'); }
        };
      },
    });
  }
  return () => { cancelAnimationFrame(raf); map.remove(); };
}

// ---------- 2D hubs on Google Maps (when a Maps key is configured) ----------
async function render2dGoogle(box) {
  let filter = 'all', radius = 8000, hubs = [], markers = [], lots = [];
  box.innerHTML = `<div class="toolbar"><div class="chips">${[['all', 'All'], ['official', 'Official'], ['ewaste', 'E-waste'], ['scrap', 'Scrap dealers'], ['container', 'Drop-off']].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div>
    <select class="input" id="hr" style="width:auto;min-height:32px;padding:4px 10px;font-size:12.5px" aria-label="Distance"><option value="3000">3 km</option><option value="8000" selected>8 km</option><option value="15000">15 km</option></select>
    <button class="btn btn-sm" id="hme">${icon('navigate')}My location</button></div>
    <div class="map-wrap"><div class="map" id="m2"><div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-size:12.5px"><span class="row"><span class="spinner"></span>Loading Google Maps…</span></div></div><div class="map-side" id="hlist"><p class="muted">Finding places…</p></div></div>`;
  const g = await loadGoogle();
  const map = new g.Map($('#m2'), { center: { lat: S.loc.lat, lng: S.loc.lng }, zoom: 14, styles: mapStyles(), disableDefaultUI: true, zoomControl: true, fullscreenControl: true, streetViewControl: true, gestureHandling: 'greedy', clickableIcons: false });
  const info = new g.InfoWindow();
  const me = new g.Marker({ map, position: { lat: S.loc.lat, lng: S.loc.lng }, icon: dotIcon('#ffffff', 8), zIndex: 999, title: 'You' });
  const visible = () => hubs.filter((h) => filter === 'all' || (filter === 'official' && h.official) || (filter === 'ewaste' && (h.accepts.some((a) => /electr|batter|mobile|computer|e_waste|appliance/.test(a)) || /e-waste/i.test(h.kindLabel))) || (filter === 'scrap' && h.kind === 'scrap') || (filter === 'container' && h.kind === 'container'));
  const card = (h) => `<div style="color:#111;font:13px Manrope,system-ui,sans-serif;max-width:240px"><b>${esc(h.name)}</b><div style="color:#666;font-size:12px">${esc(h.kindLabel)} · ${h.distanceKm} km${h.rating ? ` · ★ ${h.rating} (${h.ratings})` : ''}</div>${h.address ? `<div style="font-size:12px;margin-top:4px">${esc(h.address)}</div>` : ''}${h.openNow != null ? `<div style="font-size:12px;margin-top:2px;color:${h.openNow ? '#1f7a52' : '#a33'}">${h.openNow ? 'Open now' : 'Closed now'}</div>` : ''}
    <div style="display:flex;gap:6px;margin-top:10px"><a target="_blank" rel="noopener" href="${directions(h.lat, h.lng)}" style="background:#0a0a0a;color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none;font-weight:600;font-size:12px">Directions</a><button data-look="${h.id}" style="border:1px solid #ccc;background:#fff;padding:6px 10px;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer">Look around</button></div></div>`;
  const draw = (unavailable) => {
    markers.forEach((m) => m.setMap(null)); markers = [];
    const list = visible();
    list.forEach((h) => { const m = new g.Marker({ map, position: { lat: h.lat, lng: h.lng }, icon: pinIcon((KIND[h.kind] || KIND.container)[0]), title: h.name }); m._id = h.id; m.addListener('click', () => { info.setContent(card(h)); info.open({ map, anchor: m }); }); markers.push(m); });
    $('#hlist').innerHTML = unavailable && !list.length ? `<div class="empty"><span class="serif">The map services are busy.</span><span>Try again in a moment.</span><button class="btn btn-sm" data-retry>Try again</button></div>`
      : (list.length ? `<p class="faint" style="font-size:11.5px">${list.length} places · Google Maps &amp; OpenStreetMap</p>` + list.map((h) => `<button class="hub" data-hub="${h.id}"><span class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="n">${esc(h.name)}</span><span class="num muted" style="font-size:12px;white-space:nowrap">${h.distanceKm} km</span></span>
        <span class="row" style="gap:6px"><span class="tag">${esc(h.kindLabel)}</span>${h.official ? '<span class="tag ok">Official</span>' : ''}${h.rating ? `<span class="tag">★ ${h.rating}</span>` : ''}${h.openNow ? '<span class="tag ok">Open now</span>' : ''}</span>${h.address ? `<span class="faint" style="font-size:11.5px">${esc(h.address)}</span>` : ''}</button>`).join('')
        : `<div class="empty"><span>No places match within ${radius / 1000} km. Widen the distance or choose "All".</span></div>`);
  };
  const load = async () => {
    $('#hlist').innerHTML = '<p class="muted">Finding places…</p>';
    try { const r = await get(`/api/hubs?lat=${S.loc.lat}&lng=${S.loc.lng}&r=${radius}`); hubs = r.hubs; draw(r.unavailable);
      if (hubs.length) { const b = new g.LatLngBounds(); b.extend({ lat: S.loc.lat, lng: S.loc.lng }); visible().slice(0, 15).forEach((h) => b.extend({ lat: h.lat, lng: h.lng })); map.fitBounds(b, 60); } }
    catch (e) { $('#hlist').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  const loadLots = async () => {
    lots.forEach((m) => m.setMap(null));
    const { listings } = await get(`/api/listings?lat=${S.loc.lat}&lng=${S.loc.lng}`).catch(() => ({ listings: [] }));
    lots = listings.map((l) => { const m = new g.Marker({ map, position: { lat: l.lat, lng: l.lng }, icon: dotIcon(matColor(l.material), 7), title: l.title }); m.addListener('click', () => { info.setContent(`<div style="color:#111;font:13px Manrope,sans-serif"><b>${esc(l.title)}</b><div style="color:#666;font-size:12px">${l.kg} kg · ₹${l.price}</div><a href="#/market" style="display:inline-block;margin-top:8px;background:#0a0a0a;color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none;font-weight:600;font-size:12px">Open in market</a></div>`); info.open({ map, anchor: m }); }); return m; });
  };
  const onLook = (e) => { const b = e.target.closest('[data-look]'); if (!b) return; const h = hubs.find((x) => x.id === b.dataset.look); if (h) lookAround(h.lat, h.lng, h.name); };
  document.addEventListener('click', onLook);
  box.addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; $$('[data-f]', box).forEach((b) => b.setAttribute('aria-pressed', String(b === f))); draw(); return; }
    if (e.target.closest('[data-retry]')) return load();
    const h = e.target.closest('[data-hub]'); if (h) { const m = markers.find((x) => x._id === h.dataset.hub); if (m) { map.panTo(m.getPosition()); map.setZoom(16); g.event.trigger(m, 'click'); } }
  });
  $('#hr').onchange = (e) => { radius = +e.target.value; load(); };
  $('#hme').onclick = async () => { const l = await locate(true); if (l.approx) toast('Allow location access to use your exact position.', 'err'); me.setPosition({ lat: l.lat, lng: l.lng }); map.setCenter({ lat: l.lat, lng: l.lng }); load(); loadLots(); };
  locate().then((l) => { me.setPosition({ lat: l.lat, lng: l.lng }); map.setCenter({ lat: l.lat, lng: l.lng }); load(); loadLots(); });
  return () => document.removeEventListener('click', onLook);
}
