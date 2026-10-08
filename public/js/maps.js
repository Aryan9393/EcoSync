import { get, post } from './api.js';
import { S, locate, matColor, refreshMe } from './state.js';
import { $, $$, esc, toast, sheet, setBusy, loadScript, loadCss, ago, fileToDataUrl } from './ui.js';
import { icon } from './icons.js';
import { requireAuth, renderShell } from './app.js';
import { tiles } from './views.js';

const KIND = { centre: ['#3ee0a8', 'recycle', 'Recycling centre'], transfer: ['#5cc8ff', 'truck', 'Transfer station'], scrap: ['#e3b86c', 'market', 'Scrap yard'], container: ['#9be7c9', 'recycle', 'Drop-off point'], landfill: ['#ff7a7a', 'alert', 'Landfill'] };
const streetView = (lat, lng) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
const directions = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export async function render(host, params) {
  const mode = params[0] === '3d' ? '3d' : '2d';
  host.innerHTML = `<div class="page-head"><div><h1>${mode === '3d' ? '3D litter map' : 'Recycling hubs near you'}</h1><p>${mode === '3d' ? 'Garbage hotspots reported by neighbours, drawn in 3D. Taller columns are worse or confirmed by more people.' : 'Recycling centres, e-waste points and scrap yards from OpenStreetMap, closest first.'}</p></div>
    <div class="seg" role="group" aria-label="Map type"><a class="btn btn-sm ${mode === '2d' ? '' : 'btn-ghost'}" href="#/map" aria-pressed="${mode === '2d'}">${icon('map')}Hubs</a><a class="btn btn-sm ${mode === '3d' ? '' : 'btn-ghost'}" href="#/map/3d" aria-pressed="${mode === '3d'}">${icon('cube')}3D litter map</a></div></div>
    <div id="map-host"></div>`;
  return mode === '3d' ? render3d($('#map-host')) : render2d($('#map-host'));
}

// ---------------- 2D hubs (Leaflet) ----------------
async function render2d(box) {
  let filter = 'all', showListings = true, radius = 8000, hubs = [], markers = [], listingLayer;
  box.innerHTML = `<div class="toolbar"><div class="chips" id="hf">${[['all', 'All'], ['official', 'Official'], ['ewaste', 'E-waste'], ['scrap', 'Scrap yards'], ['container', 'Drop-off']].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div>
    <select class="input" id="hr" style="width:auto;min-height:36px" aria-label="Search radius"><option value="3000">3 km</option><option value="8000" selected>8 km</option><option value="15000">15 km</option></select>
    <button class="chip" id="hl" aria-pressed="true">${icon('market').replace('<svg', '<svg style="width:14px;height:14px"')}Scrap lots</button>
    <button class="btn btn-sm" id="hme">${icon('navigate')}My location</button></div>
    <div class="map-wrap"><div class="map" id="m2"></div><div class="map-side" id="hlist"><p class="muted">Finding hubs…</p></div></div>`;
  const L = window.L;
  const map = L.map('m2', { zoomControl: true }).setView([S.loc.lat, S.loc.lng], 14);
  tiles(map);
  const me = L.marker([S.loc.lat, S.loc.lng], { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18] }), zIndexOffset: 1000 }).addTo(map);
  const pinIcon = (color, ic) => L.divIcon({ className: '', html: `<div class="pin" style="background:${color}">${icon(ic)}</div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
  const visible = () => hubs.filter((h) => filter === 'all' || (filter === 'official' && h.official) || (filter === 'ewaste' && h.accepts.some((a) => /electr|batter|mobile|computer|e_waste|small_appliances/.test(a))) || (filter === 'scrap' && h.kind === 'scrap') || (filter === 'container' && h.kind === 'container'));
  const popup = (h) => `<b>${esc(h.name)}</b><div class="muted" style="font-size:13px">${esc(h.kindLabel)}${h.official ? ' · official' : ''} · ${h.distanceKm} km</div>
    ${h.accepts?.length ? `<div style="font-size:12.5px;margin-top:6px">Accepts: ${esc(h.accepts.slice(0, 6).map((a) => a.replace(/_/g, ' ')).join(', '))}</div>` : ''}${h.hours ? `<div style="font-size:12.5px">Hours: ${esc(h.hours)}</div>` : ''}
    <div class="row" style="gap:6px;margin-top:10px"><a class="btn btn-sm btn-primary" target="_blank" rel="noopener" href="${directions(h.lat, h.lng)}">Directions</a><a class="btn btn-sm" target="_blank" rel="noopener" href="${streetView(h.lat, h.lng)}">Look around</a></div>`;
  const draw = () => {
    markers.forEach((m) => m.remove()); markers = [];
    const list = visible();
    list.forEach((h) => { const [c, ic] = KIND[h.kind] || KIND.container; const m = L.marker([h.lat, h.lng], { icon: pinIcon(c, ic) }).bindPopup(popup(h)).addTo(map); m._hid = h.id; markers.push(m); });
    $('#hlist').innerHTML = (window._hubSample ? `<div class="mode-banner" style="margin:0">${icon('spark').replace('<svg', '<svg style="width:16px;height:16px;color:var(--warn)"')}<span>Showing sample hubs. Live OpenStreetMap data loads on the deployed site.</span></div>` : `<p class="faint" style="font-size:12.5px">${list.length} places · data © OpenStreetMap contributors</p>`)
      + (list.length ? list.map((h) => `<button class="hub" data-hub="${h.id}"><span class="row" style="justify-content:space-between"><span class="n">${esc(h.name)}</span><span class="num muted">${h.distanceKm} km</span></span>
        <span class="row"><span class="pill" style="border-color:${(KIND[h.kind] || KIND.container)[0]}">${esc((KIND[h.kind] || KIND.container)[2])}</span>${h.official ? '<span class="pill ok">Official</span>' : ''}</span>
        ${h.accepts?.length ? `<span class="faint" style="font-size:12.5px">${esc(h.accepts.slice(0, 5).map((a) => a.replace(/_/g, ' ')).join(' · '))}</span>` : ''}</button>`).join('') : '<div class="empty">No places match this filter. Widen the radius or pick "All".</div>');
  };
  const load = async () => {
    $('#hlist').innerHTML = '<p class="muted">Finding hubs…</p>';
    try { const r = await get(`/api/hubs?lat=${S.loc.lat}&lng=${S.loc.lng}&r=${radius}`); hubs = r.hubs; window._hubSample = r.sample; draw(); if (hubs.length) map.fitBounds(L.latLngBounds([[S.loc.lat, S.loc.lng], ...visible().slice(0, 12).map((h) => [h.lat, h.lng])]), { padding: [40, 40], maxZoom: 15 }); }
    catch (e) { $('#hlist').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  const loadListings = async () => {
    listingLayer?.remove(); if (!showListings) return;
    const { listings } = await get(`/api/listings?lat=${S.loc.lat}&lng=${S.loc.lng}`).catch(() => ({ listings: [] }));
    listingLayer = L.layerGroup(listings.filter((l) => l.status === 'open').map((l) => L.circleMarker([l.lat, l.lng], { radius: 8, color: '#0b1a18', weight: 2, fillColor: matColor(l.material), fillOpacity: 0.95 })
      .bindPopup(`<b>${esc(l.title)}</b><div class="muted" style="font-size:13px">${l.kg} kg · ₹${l.price} · ${esc(l.seller?.name || '')}</div><a class="btn btn-sm btn-primary" style="margin-top:8px" href="#/market">Open in market</a>`))).addTo(map);
  };
  box.addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; $$('[data-f]', box).forEach((b) => b.setAttribute('aria-pressed', String(b === f))); draw(); return; }
    const h = e.target.closest('[data-hub]'); if (h) { const m = markers.find((x) => x._hid === h.dataset.hub); if (m) { map.setView(m.getLatLng(), 16); m.openPopup(); } }
  });
  $('#hr').onchange = (e) => { radius = +e.target.value; load(); };
  $('#hl').onclick = (e) => { showListings = !showListings; e.currentTarget.setAttribute('aria-pressed', String(showListings)); loadListings(); };
  $('#hme').onclick = async () => { const l = await locate(true); if (l.approx) toast('Allow location access to use your exact position.', 'err'); me.setLatLng([l.lat, l.lng]); map.setView([l.lat, l.lng], 14); load(); loadListings(); };
  setTimeout(() => map.invalidateSize(), 50);
  locate().then((l) => { me.setLatLng([l.lat, l.lng]); map.setView([l.lat, l.lng], 14); load(); loadListings(); });
  return () => map.remove();
}

// ---------------- 3D litter map (MapLibre) ----------------
const SEV = ['#9be7c9', '#ffc65c', '#ff9a5c', '#ff6b6b'];
const hexagon = (lat, lng, rM) => { const out = []; for (let i = 0; i <= 6; i++) { const a = (Math.PI / 3) * i; out.push([lng + (rM * Math.cos(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (rM * Math.sin(a)) / 110540]); } return [out]; };

function fallbackStyle(c) {
  // Procedural "digital twin" city used when vector tiles can't load (offline previews).
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(Math.round(Math.abs(c.lat * 1e4 + c.lng * 1e4)) || 7);
  const blocks = [];
  for (let gx = -14; gx <= 14; gx++) for (let gy = -14; gy <= 14; gy++) {
    if (gx % 5 === 0 || gy % 5 === 0) continue; if (rnd() < 0.2) continue;
    const lat = c.lat + gy * 0.00055, lng = c.lng + gx * 0.00065, w = 0.0002 + rnd() * 0.00015, h = 0.00018 + rnd() * 0.00016;
    blocks.push({ type: 'Feature', properties: { h: 6 + Math.pow(rnd(), 2.2) * (Math.hypot(gx, gy) < 6 ? 70 : 28) }, geometry: { type: 'Polygon', coordinates: [[[lng - w, lat - h], [lng + w, lat - h], [lng + w, lat + h], [lng - w, lat + h], [lng - w, lat - h]]] } });
  }
  const roads = [];
  for (let k = -15; k <= 15; k += 5) {
    roads.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[c.lng + k * 0.00065, c.lat - 0.009], [c.lng + k * 0.00065, c.lat + 0.009]] } });
    roads.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[c.lng - 0.011, c.lat + k * 0.00055], [c.lng + 0.011, c.lat + k * 0.00055]] } });
  }
  const css = getComputedStyle(document.documentElement), v = (n) => css.getPropertyValue(n).trim();
  return { version: 8, sources: { blocks: { type: 'geojson', data: { type: 'FeatureCollection', features: blocks } }, roads: { type: 'geojson', data: { type: 'FeatureCollection', features: roads } } },
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': v('--map-bg') || '#13282a' } },
      { id: 'roads', type: 'line', source: 'roads', paint: { 'line-color': v('--line') || '#2a4a45', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 18, 14] } },
      { id: 'blocks', type: 'fill-extrusion', source: 'blocks', paint: { 'fill-extrusion-color': v('--surface-2') || '#1d3733', 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.92 } }] };
}

async function render3d(box) {
  box.innerHTML = `<div class="map" id="m3" style="height:calc(100vh - 210px);min-height:460px">
      <div class="map3d-overlay"><button class="btn btn-sm glass" id="o-orbit">${icon('orbit')}Orbit</button><button class="btn btn-sm btn-primary" id="o-report">${icon('flag')}Report litter</button><button class="btn btn-sm glass" id="o-look">${icon('eye')}Look around</button><button class="btn btn-sm glass" id="o-me">${icon('navigate')}Me</button></div>
      <div class="legend glass"><b style="font-size:12.5px">Severity</b><span><i style="background:${SEV[1]}"></i>Low</span><span><i style="background:${SEV[2]}"></i>Medium</span><span><i style="background:${SEV[3]}"></i>High</span><span><i style="background:${SEV[0]}"></i>Cleaned</span></div>
      <div class="map-note glass" id="m3-note" hidden></div>
      <div class="placeholder" id="m3-load" style="position:absolute;inset:0;display:grid;place-items:center;color:var(--muted)"><span class="row"><span class="spinner"></span>Building the 3D city…</span></div>
    </div>`;
  try { loadCss('vendor/maplibre-gl.css'); await loadScript('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'); }
  catch { $('#m3-load').innerHTML = '<div class="empty">The 3D engine could not load. Check your connection and reopen this tab.</div>'; return; }
  const ml = window.maplibregl, loc = await locate();
  let fallback = false, reports = [], orbiting = false, raf = 0, reporting = false;
  const styleOk = await fetch(S.config?.mapStyle || '', { method: 'GET' }).then((r) => r.ok).catch(() => false);
  if (!styleOk) fallback = true;
  const map = new ml.Map({ container: 'm3', style: fallback ? fallbackStyle(loc) : S.config.mapStyle, center: [loc.lng, loc.lat], zoom: 15.6, pitch: 62, bearing: -24, antialias: true, attributionControl: { compact: true } });
  map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'bottom-right');
  const note = (t) => { const n = $('#m3-note'); if (n) { n.hidden = !t; n.textContent = t || ''; } };
  if (fallback) note('Offline 3D preview: buildings are generated. Real 3D buildings load from OpenFreeMap on the deployed site.');
  map.on('error', (e) => { if (!fallback && /style|tile|source/i.test(e?.error?.message || '')) console.warn(e.error); });

  const toGeo = () => ({ type: 'FeatureCollection', features: reports.map((r) => ({ type: 'Feature', id: r.id, properties: { id: r.id, color: r.status === 'cleaned' ? SEV[0] : SEV[r.severity] || SEV[2], h: r.status === 'cleaned' ? 6 : 14 + r.severity * 18 + Math.min(r.confirms || 1, 12) * 4 }, geometry: { type: "Polygon", coordinates: hexagon(r.lat, r.lng, 16) } })) });
  const load = async () => { try { reports = (await get(`/api/reports?lat=${loc.lat}&lng=${loc.lng}`)).reports; map.getSource('reports')?.setData(toGeo()); } catch (e) { toast(e.message, 'err'); } };
  const loadHubs = async () => {
    const { hubs } = await get(`/api/hubs?lat=${loc.lat}&lng=${loc.lng}&r=4000`).catch(() => ({ hubs: [] }));
    map.getSource('hubs')?.setData({ type: 'FeatureCollection', features: hubs.slice(0, 25).map((h) => ({ type: 'Feature', properties: { name: h.name }, geometry: { type: 'Polygon', coordinates: hexagon(h.lat, h.lng, 7) } })) });
  };
  map.on('load', () => {
    $('#m3-load')?.remove();
    // Real 3D buildings from the OpenMapTiles schema, if the style doesn't already extrude them.
    if (!fallback && map.getSource('openmaptiles') && !map.getStyle().layers.some((l) => l.type === 'fill-extrusion')) {
      map.addLayer({ id: 'es-buildings', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14, paint: { 'fill-extrusion-color': '#8fa7a0', 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.75 } });
    }
    map.addSource('reports', { type: 'geojson', data: toGeo() });
    map.addSource('hubs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'hubs-3d', type: 'fill-extrusion', source: 'hubs', paint: { 'fill-extrusion-color': '#5cc8ff', 'fill-extrusion-height': 30, 'fill-extrusion-opacity': 0.85 } });
    map.addLayer({ id: 'reports-3d', type: 'fill-extrusion', source: 'reports', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.95 } });
    map.addSource('me', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: hexagon(loc.lat, loc.lng, 6) } } });
    map.addLayer({ id: 'me-3d', type: 'fill-extrusion', source: 'me', paint: { 'fill-extrusion-color': '#ffffff', 'fill-extrusion-height': 50, 'fill-extrusion-opacity': 0.9 } });
    load(); loadHubs();
    // Intro fly-in
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) map.easeTo({ bearing: 20, zoom: 16.2, duration: 3200 });
  });
  map.on('mouseenter', 'reports-3d', () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', 'reports-3d', () => (map.getCanvas().style.cursor = ''));
  map.on('click', (e) => {
    if (reporting) { reporting = false; $('#m3').classList.remove('reporting'); note(fallback ? 'Offline 3D preview: buildings are generated.' : ''); return openReport(e.lngLat); }
    const f = map.queryRenderedFeatures(e.point, { layers: ['reports-3d'] })[0];
    if (!f) return;
    const r = reports.find((x) => x.id === f.properties.id); if (!r) return;
    const pop = new ml.Popup({ offset: 12, maxWidth: '280px' }).setLngLat([r.lng, r.lat]).setHTML(`<b style="text-transform:capitalize">${esc(r.type.replace('_', '-'))} waste</b>
      <div class="muted" style="font-size:13px">${['', 'Low', 'Medium', 'High'][r.severity]} · ${r.confirms} confirmations · ${ago(r.at)}${r.demo ? ' · sample' : ''}</div>${r.note ? `<p style="margin-top:6px;font-size:13.5px">${esc(r.note)}</p>` : ''}
      <div class="row" style="gap:6px;margin-top:10px">${r.status === 'cleaned' ? '<span class="pill ok">Cleaned</span>' : `<button class="btn btn-sm" data-rc="confirm">Confirm +2</button><button class="btn btn-sm btn-primary" data-rc="clean">Cleaned it +40</button>`}<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="${streetView(r.lat, r.lng)}">Look around</a></div>`).addTo(map);
    pop.getElement().addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-rc]'); if (!b) return;
      if (!requireAuth()) return;
      setBusy(b, true);
      try { await post(`/api/reports/${r.id}/${b.dataset.rc}`); toast(b.dataset.rc === 'clean' ? 'Thanks for cleaning up. +40 EcoCoins' : 'Confirmed. +2 EcoCoins', 'ok'); if (b.dataset.rc === 'clean') r.status = 'cleaned'; else r.confirms++; map.getSource('reports').setData(toGeo()); pop.remove(); refreshMe().then(() => renderShell('map')); }
      catch (er) { setBusy(b, false); toast(er.message, 'err'); }
    });
  });
  const spin = () => { map.setBearing((map.getBearing() + 0.12) % 360); raf = requestAnimationFrame(spin); };
  $('#o-orbit').onclick = (e) => { orbiting = !orbiting; e.currentTarget.classList.toggle('btn-primary', orbiting); e.currentTarget.classList.toggle('glass', !orbiting); orbiting ? spin() : cancelAnimationFrame(raf); };
  $('#o-report').onclick = () => { if (!requireAuth()) return; reporting = true; $('#m3').classList.add('reporting'); note('Tap the exact spot where the garbage is.'); };
  $('#o-look').onclick = () => { const c = map.getCenter(); window.open(streetView(c.lat, c.lng), '_blank', 'noopener'); };
  $('#o-me').onclick = async () => { const l = await locate(true); map.flyTo({ center: [l.lng, l.lat], zoom: 16.4, pitch: 62 }); };

  function openReport(ll) {
    let sev = 2, type = 'plastic', photo = null;
    sheet({
      title: 'Report a litter spot', sub: `Pinned at ${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}. You earn 15 EcoCoins.`,
      body: `<form class="stack" id="rp" novalidate>
        <div class="field"><span>How bad is it?</span><div class="seg" role="group">${['Low', 'Medium', 'High'].map((l, i) => `<button type="button" data-sev="${i + 1}" aria-pressed="${i + 1 === sev}">${l}</button>`).join('')}</div></div>
        <div class="field"><span>Mostly</span><div class="chips">${['plastic', 'mixed', 'paper', 'e_waste', 'construction', 'organic'].map((t) => `<button type="button" class="chip" data-type="${t}" aria-pressed="${t === type}">${t.replace('_', '-')}</button>`).join('')}</div></div>
        <label class="btn" style="cursor:pointer;justify-self:start">${icon('camera')}<span id="rp-ph">Add a photo</span><input type="file" accept="image/*" capture="environment" id="rp-file" hidden></label>
        <label class="field"><span>Note (optional)</span><input class="input" id="rp-note" placeholder="Behind the bus stop, near the drain"></label>
        <button class="btn btn-primary btn-lg" type="submit" id="rp-go">Pin this report</button></form>`,
      onMount(el, close) {
        el.addEventListener('click', (e) => { const s = e.target.closest('[data-sev]'), t = e.target.closest('[data-type]'); if (s) { sev = +s.dataset.sev; $$('[data-sev]', el).forEach((b) => b.setAttribute('aria-pressed', String(b === s))); } if (t) { type = t.dataset.type; $$('[data-type]', el).forEach((b) => b.setAttribute('aria-pressed', String(b === t))); } });
        $('#rp-file', el).onchange = async (e) => { const f = e.target.files[0]; if (f) { photo = await fileToDataUrl(f, 640, 0.7); $('#rp-ph', el).textContent = 'Photo added'; } };
        $('#rp', el).onsubmit = async (e) => {
          e.preventDefault(); const b = $('#rp-go', el); setBusy(b, true, 'Pinning');
          try { const { report } = await post('/api/reports', { lat: ll.lat, lng: ll.lng, severity: sev, type, note: $('#rp-note', el).value, photo }); reports.unshift(report); map.getSource('reports').setData(toGeo()); toast('Report pinned. +15 EcoCoins', 'ok'); close(); refreshMe().then(() => renderShell('map')); }
          catch (er) { setBusy(b, false); toast(er.message, 'err'); }
        };
      },
    });
  }
  return () => { cancelAnimationFrame(raf); map.remove(); };
}
