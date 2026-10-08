import { get, post, patch, backend, store, setBase, BASE } from './api.js';
import { S, PRICES, matLabel, matColor, refreshMe, locate, tier, firstName } from './state.js';
import { $, $$, esc, inr, kg, ago, when, dayLabel, toast, sheet, setBusy, fileToDataUrl } from './ui.js';
import { icon } from './icons.js';
import { requireAuth, renderShell, route, applyTheme } from './app.js';
import { openCheckout } from './pay.js';

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const dot = (m) => `<i class="dot" style="background:${matColor(m)}"></i>`;
const coinsChanged = () => dispatchEvent(new Event('ecosync:coins'));
export async function setRole(role) {
  if (!S.user || S.user.role === role) return;
  try { const r = await patch('/api/me', { role }); S.user = r.user; store.set('user', r.user); toast(role === 'buyer' ? 'Collector mode' : 'Seller mode'); renderShell(); route(); }
  catch (e) { toast(e.message, 'err'); }
}
const head = (eb, title, p, right = '') => `<div class="page-head"><div><span class="eyebrow">${eb}</span><h1>${title}</h1>${p ? `<p>${p}</p>` : ''}</div>${right}</div>`;

// =============== Overview ===============
export async function dashboard(host) {
  await refreshMe(); renderShell('home');
  const u = S.user, w = S.wallet || { coins: 0, kg: 0, co2: 0 }, t = tier(w.coins), buyer = u.role === 'buyer';
  host.innerHTML = `${head(buyer ? 'Collector' : 'Seller', `${greet()},<br>${esc(firstName(u.name))}.`, buyer ? 'Lots near you, your pickups and the passports you carry.' : 'Scan, list and follow your scrap to its next life.')}
    <div class="stats" style="margin-bottom:12px">
      <div><b>${w.coins.toLocaleString('en-IN')}</b><span>EcoCoins · ${t.name}</span></div>
      <div><b>${(+w.kg).toFixed(1)}</b><span>kg recycled</span></div>
      <div><b>${(+w.co2).toFixed(1)}</b><span>kg CO₂ avoided</span></div>
      <div><b>${(w.co2 / 0.12).toFixed(0)}</b><span>car-km equivalent</span></div>
    </div>
    <div class="actions" style="margin-bottom:12px">${(buyer ? [
      ['#/market', 'market', 'Browse lots', 'Nearest first'], ['#/passport/scan', 'qr', 'Scan a seller\'s QR', 'Complete a pickup'],
      ['#/map', 'pin', 'Recycling hubs', 'Where to drop off'], ['#/map/3d', 'cube', 'Litter map', 'Clean a spot, +40'],
    ] : [
      ['#/scan', 'scan', 'Scan an item', 'Material and price'], ['#/market/new', 'plus', 'List scrap', 'Reach collectors nearby'],
      ['#/pickups', 'truck', 'Book a pickup', 'Leaf slots earn +25'], ['#/map/3d', 'flag', 'Report litter', 'Pin it in 3D, +15'],
    ]).map(([h, ic, b, s]) => `<a class="action" href="${h}">${icon(ic)}<span><b>${b}</b><span>${s}</span></span></a>`).join('')}</div>
    <div class="dash">
      <div class="stack">
        <section class="card"><div class="card-head"><h2>Passports</h2><a class="link" href="#/passport" style="font-size:12px">All ${icon('arrowR')}</a></div><div id="d-pass" class="list"><p class="muted">Loading…</p></div></section>
        <section class="card"><div class="card-head"><h2>${buyer ? 'Closest open lots' : 'Upcoming pickups'}</h2><a class="link" href="${buyer ? '#/market' : '#/pickups'}" style="font-size:12px">${buyer ? 'Market' : 'Manage'} ${icon('arrowR')}</a></div><div id="d-two" class="list"><p class="muted">Loading…</p></div></section>
      </div>
      <div class="stack">
        <section class="card"><div class="card-head"><h2>${t.next ? `${t.need} coins to ${t.next}` : 'Top tier reached'}</h2><span class="tag">${t.name}</span></div><div class="bar"><i style="width:${t.pct}%"></i></div></section>
        <section class="card"><div class="card-head"><h2>Recycling hubs near you</h2><a class="link" href="#/map" style="font-size:12px">Map ${icon('arrowR')}</a></div><div id="d-hubs" class="list"><p class="muted">Finding hubs…</p></div></section>
        ${S.isApp ? '' : `<section class="card"><div class="card-head"><h2>EcoSync for Android</h2>${icon('android').replace('<svg', '<svg style="width:18px;height:18px"')}</div><p class="muted" style="font-size:12.5px;margin-bottom:12px">Opens straight to the scanner, with your camera and GPS.</p><a class="btn btn-sm" href="${BASE}/download/android" ${backend === 'preview' ? 'data-noapk' : ''}>${icon('download')}Download the app</a></section>`}
      </div>
    </div>`;
  $('[data-noapk]', host)?.addEventListener('click', (e) => { e.preventDefault(); toast('The app downloads from the live site.'); });
  const loc = await locate();
  get('/api/passports/mine').then(({ passports }) => {
    $('#d-pass').innerHTML = passports.length ? passports.slice(0, 4).map(passRow).join('') : empty(buyer ? 'Reserve a lot and its passport starts here.' : 'When a collector reserves your scrap, its passport starts here.', buyer ? ['#/market', 'Open the market'] : ['#/market/new', 'List scrap']);
  }).catch(() => {});
  if (buyer) get(`/api/listings?lat=${loc.lat}&lng=${loc.lng}`).then(({ listings }) => { $('#d-two').innerHTML = listings.length ? listings.slice(0, 4).map(listRow).join('') : empty('No open lots near you yet. They appear here the moment someone lists.'); }).catch(() => {});
  else get('/api/pickups/mine').then(({ pickups }) => { const up = pickups.filter((p) => p.status === 'scheduled'); $('#d-two').innerHTML = up.length ? up.slice(0, 3).map(pickRow).join('') : empty('Nothing booked. A leaf on a slot means a van is already nearby.', ['#/pickups', 'Book a pickup']); }).catch(() => {});
  hubsInto($('#d-hubs'), loc, 4);
}
export function hubsInto(box, loc, n) {
  get(`/api/hubs?lat=${loc.lat}&lng=${loc.lng}&r=8000`).then(({ hubs, unavailable }) => {
    box.innerHTML = hubs.length ? hubs.slice(0, n).map((h) => `<a class="li" href="#/map"><span class="ico">${icon(h.kind === 'scrap' ? 'market' : 'recycle')}</span><span style="min-width:0"><div class="t">${esc(h.name)}</div><div class="s">${esc(h.kindLabel)}${h.official ? ' · official' : ''}</div></span><span class="num muted" style="font-size:12px">${h.distanceKm} km</span></a>`).join('')
      : `<p class="muted" style="font-size:12.5px">${unavailable ? 'OpenStreetMap is busy right now. Open the map to try again.' : 'No recycling places are mapped within 8 km yet.'}</p>`;
  }).catch(() => { box.innerHTML = '<p class="muted" style="font-size:12.5px">Hubs could not load.</p>'; });
}
const empty = (text, link) => `<div class="empty"><span>${text}</span>${link ? `<a class="btn btn-sm" href="${link[0]}">${link[1]} ${icon('arrowR')}</a>` : ''}</div>`;
export const passRow = (p) => `<a class="li" href="#/passport/${p.id}"><span class="ico">${icon('qr')}</span><span style="min-width:0"><div class="t">${esc(p.title)}</div><div class="s mono">${p.id}</div></span>${statusTag(p.status)}</a>`;
export const statusTag = (s) => ({ awaiting_pickup: '<span class="tag warn">Awaiting pickup</span>', collected: '<span class="tag ok">Collected</span>', reborn: '<span class="tag grad">Reborn</span>' }[s] || `<span class="tag">${esc(s)}</span>`);
const listRow = (l) => `<a class="li" href="#/market"><span class="ico">${dot(l.material)}</span><span style="min-width:0"><div class="t">${esc(l.title)}</div><div class="s">${kg(l.kg)} · ${l.distanceKm ?? '–'} km</div></span><span class="price" style="font-size:18px">${inr(l.price)}</span></a>`;
const pickRow = (p) => `<div class="li"><span class="ico">${icon('truck')}</span><span style="min-width:0"><div class="t">${dayLabel(p.date)} · ${p.slot}</div><div class="s">Code <b class="mono">${p.code}</b>${p.greenRoute ? ' · Green Route' : ''}</div></span><a class="btn btn-sm" href="#/pickups">Track</a></div>`;

// =============== Market ===============
export async function market(host, params) {
  let tab = params[0] === 'mine' ? 'mine' : 'near', mat = '';
  const loc = await locate();
  host.innerHTML = `${head('Market', 'Lots near you.', 'Open scrap lots, nearest first. Collectors reserve and pay the seller directly; the QR handshake at pickup completes the sale.', `<button class="btn btn-primary" id="m-new">${icon('plus')}List scrap</button>`)}
    <div class="toolbar"><div class="seg" role="group" aria-label="View"><button data-tab="near">Nearby</button><button data-tab="mine">Mine</button></div><div class="chips" id="m-chips"></div></div>
    <div id="m-list" class="listings"></div>`;
  const mats = ['paper', 'cardboard', 'pet', 'hdpe', 'aluminium', 'steel', 'copper', 'glass', 'e_waste', 'textile'];
  $('#m-chips').innerHTML = `<button class="chip" data-mat="" aria-pressed="true">All</button>` + mats.map((m) => `<button class="chip" data-mat="${m}" aria-pressed="false">${dot(m)}${esc(matLabel(m).replace(/ \(\d\)/, ''))}</button>`).join('');
  let data = [];
  const load = async () => {
    $$('[data-tab]', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    $$('[data-mat]', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mat === mat)));
    const box = $('#m-list');
    if (tab === 'mine' && !S.user) { box.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="serif">Your lots live here.</span><span>Sign in to see what you've listed and reserved.</span><button class="btn btn-sm btn-primary" data-act="signin">Sign in</button></div>`; return; }
    box.innerHTML = '<p class="muted">Loading lots…</p>';
    try {
      data = (await get(`/api/listings?lat=${loc.lat}&lng=${loc.lng}${mat ? `&material=${mat}` : ''}${tab === 'mine' ? '&mine=1' : ''}`)).listings;
      box.innerHTML = data.length ? data.map(card).join('') : `<div class="empty" style="grid-column:1/-1"><span class="serif">${tab === 'mine' ? 'Nothing listed yet.' : 'No open lots nearby, yet.'}</span><span>${tab === 'mine' ? 'Scan an item or list a bag of scrap in under a minute.' : 'Be the first on your street. Lots show up here the moment someone lists.'}</span><button class="btn btn-sm btn-primary" data-act="new">${icon('plus')}List scrap</button></div>`;
    } catch (e) { box.innerHTML = `<div class="empty" style="grid-column:1/-1">${esc(e.message)}</div>`; }
  };
  host.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab],[data-mat],[data-buy],[data-act],[data-remove],[data-pass]'); if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; load(); }
    else if (t.hasAttribute('data-mat')) { mat = t.dataset.mat; load(); }
    else if (t.dataset.buy) { const l = data.find((x) => x.id === t.dataset.buy); if (requireAuth(() => openCheckout(l, load), 'buyer')) openCheckout(l, load); }
    else if (t.dataset.act === 'new') newListing(load);
    else if (t.dataset.act === 'signin') requireAuth(load);
    else if (t.dataset.remove) patch(`/api/listings/${t.dataset.remove}`, { status: 'removed' }).then(() => { toast('Listing removed'); load(); }).catch((er) => toast(er.message, 'err'));
    else if (t.dataset.pass) location.hash = `#/passport/${t.dataset.pass}`;
  });
  $('#m-new').onclick = () => newListing(load);
  await load();
  if (params[0] === 'new') newListing(load);
}
function card(l) {
  const mine = S.user && l.sellerId === S.user.id, bought = S.user && l.buyerId === S.user.id;
  const st = l.status === 'open' ? '' : `<span class="tag ${l.status === 'sold' ? 'ok' : 'warn'}">${l.status === 'sold' ? 'Sold' : 'Reserved'}</span>`;
  return `<article class="listing">${l.photo ? `<img class="thumb" src="${l.photo}" alt="">` : ''}
    <div class="body"><div class="row" style="justify-content:space-between;gap:8px;flex-wrap:nowrap"><span class="title">${esc(l.title)}</span>${st}</div>
      <div class="meta"><span class="row" style="gap:6px">${dot(l.material)}${esc(matLabel(l.material))}</span><span>${kg(l.kg)}</span>${l.distanceKm != null ? `<span>${l.distanceKm} km</span>` : ''}</div>
      ${l.notes ? `<p class="muted" style="font-size:12.5px">${esc(l.notes)}</p>` : ''}
      <div class="meta"><span>${esc(l.seller?.name || '')}</span><span>${ago(l.createdAt)}</span>${l.seller?.hasUpi ? '<span>UPI</span>' : '<span>Cash</span>'}</div></div>
    <div class="foot"><span class="price">${inr(l.price)} <small>${l.kg ? inr(l.price / l.kg) + '/kg' : ''}</small></span>
      ${mine ? (l.status === 'open' ? `<button class="btn btn-sm" data-remove="${l.id}">Remove</button>` : l.passportId ? `<button class="btn btn-sm" data-pass="${l.passportId}">Passport</button>` : '')
        : bought && l.passportId ? `<button class="btn btn-sm" data-pass="${l.passportId}">${icon('qr')}Passport</button>`
        : l.status === 'open' ? `<button class="btn btn-sm btn-primary" data-buy="${l.id}">Reserve</button>` : ''}</div></article>`;
}

export function newListing(onDone, prefill) {
  if (!requireAuth(() => newListing(onDone, prefill), 'seller')) return;
  const p = prefill || {}, mats = Object.keys(PRICES()).filter((m) => !['organic', 'battery'].includes(m));
  let photo = p.photo || null;
  sheet({
    title: 'List your scrap.', sub: 'Collectors nearby see it straight away. +5 EcoCoins.', wide: true,
    body: `<form class="stack" id="nl" novalidate>
      <div class="row"><button type="button" class="btn grow" id="nl-voice">${icon('mic')}<span>Say it</span></button><label class="btn grow" style="cursor:pointer">${icon('camera')}<span>${photo ? 'Change photo' : 'Add a photo'}</span><input type="file" accept="image/*" capture="environment" id="nl-photo" hidden></label></div>
      <p class="faint" style="font-size:11.5px;margin-top:-6px">Try "paanch kilo akhbaar, sookha hai" or "3 kg plastic bottles".</p>
      <img id="nl-prev" ${photo ? `src="${photo}"` : 'hidden'} alt="" style="max-height:170px;object-fit:cover;border-radius:10px">
      <label class="field"><span>What is it?</span><input class="input" id="nl-title" value="${esc(p.title || '')}" placeholder="Newspapers, 3 months"></label>
      <div class="split">
        <label class="field"><span>Material</span><select class="input" id="nl-mat">${mats.map((m) => `<option value="${m}" ${m === (p.material || 'paper') ? 'selected' : ''}>${esc(matLabel(m))} · ₹${PRICES()[m].rate}/kg</option>`).join('')}</select></label>
        <label class="field"><span>Weight (kg)</span><input class="input" id="nl-kg" type="number" min="0.1" step="0.1" value="${p.kg || 2}"></label>
      </div>
      <div class="split">
        <label class="field"><span>Price (₹)</span><input class="input" id="nl-price" type="number" min="0" step="1"></label>
        <label class="field"><span>Area</span><input class="input" id="nl-area" placeholder="Block C, near the park"></label>
      </div>
      <label class="field"><span>Your UPI ID <span class="faint">(so collectors can pay you directly; optional)</span></span><input class="input mono" id="nl-upi" value="${esc(S.user?.upi || '')}" placeholder="yourname@okaxis"></label>
      <label class="field"><span>Notes for collectors</span><textarea class="input" id="nl-notes" placeholder="Dry, tied in bundles">${esc(p.notes || '')}</textarea></label>
      <button class="btn btn-primary btn-lg" type="submit" id="nl-go">Publish listing ${icon('arrowUR')}</button>
    </form>`,
    onMount(el, close) {
      const price = $('#nl-price', el), suggest = () => { price.value = Math.max(1, Math.round((PRICES()[$('#nl-mat', el).value]?.rate || 0) * (+$('#nl-kg', el).value || 0))); };
      suggest(); $('#nl-mat', el).onchange = suggest; $('#nl-kg', el).oninput = suggest;
      $('#nl-photo', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; photo = await fileToDataUrl(f, 640, 0.75); const im = $('#nl-prev', el); im.src = photo; im.hidden = false; };
      $('#nl-voice', el).onclick = (e) => voiceFill(e.currentTarget, el, suggest);
      $('#nl', el).onsubmit = async (e) => {
        e.preventDefault(); const btn = $('#nl-go', el); setBusy(btn, true, 'Publishing');
        try {
          const loc = await locate(true);
          const upi = $('#nl-upi', el).value.trim();
          if (upi !== (S.user.upi || '')) { const r = await patch('/api/me', { upi }); S.user = r.user; store.set('user', r.user); }
          await post('/api/listings', { title: $('#nl-title', el).value, material: $('#nl-mat', el).value, kg: +$('#nl-kg', el).value, price: +price.value, area: $('#nl-area', el).value, notes: $('#nl-notes', el).value, photo, lat: loc.lat, lng: loc.lng });
          toast('Listed. +5 EcoCoins'); close(); refreshMe().then(coinsChanged);
          onDone ? onDone() : (location.hash = '#/market/mine');
        } catch (er) { setBusy(btn, false); toast(er.message, 'err'); }
      };
    },
  });
}
function voiceFill(btn, el, after) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const apply = async (text) => {
    setBusy(btn, true, 'Understanding');
    try { const r = await post('/api/ai/parse-listing', { text }); $('#nl-title', el).value = r.title || text; if ($(`#nl-mat option[value="${r.material}"]`, el)) $('#nl-mat', el).value = r.material; if (r.kg) $('#nl-kg', el).value = r.kg; if (r.notes) $('#nl-notes', el).value = r.notes; after(); toast('Filled in from what you said'); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(btn, false); }
  };
  if (!SR) { const t = $('#nl-title', el).value.trim(); return t ? apply(t) : toast('Voice input isn\'t available in this browser. Type it in "What is it?" and tap again.', 'err'); }
  const rec = new SR(); rec.lang = 'hi-IN'; rec.interimResults = false;
  btn.innerHTML = `${icon('mic')}<span>Listening…</span>`;
  rec.onresult = (e) => apply(e.results[0][0].transcript);
  rec.onerror = () => { toast('Didn\'t catch that. Try again or type it.', 'err'); btn.innerHTML = `${icon('mic')}<span>Say it</span>`; };
  rec.onend = () => { if (!btn.disabled) btn.innerHTML = `${icon('mic')}<span>Say it</span>`; };
  rec.start();
}

// =============== Pickups ===============
export async function pickups(host) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let date = iso(days[0]), slot = null; const mats = new Set(['paper']);
  host.innerHTML = `${head('Pickups', 'At your door.', 'Choose a day and a slot. A leaf means another pickup is already booked close by, so the trip is shared and you earn 25 extra coins.')}
    <div class="grid-2">
      <form class="card stack" id="pk" novalidate>
        <h2>Book a pickup</h2>
        <div class="field"><span>Day</span><div class="dates">${days.map((d) => `<button type="button" class="date" data-date="${iso(d)}" aria-pressed="${iso(d) === date}">${d.toLocaleDateString('en-IN', { weekday: 'short' })}<b>${d.getDate()}</b></button>`).join('')}</div></div>
        <div class="field"><span>Time</span><div class="slots" id="pk-slots"></div></div>
        <div class="field"><span>What's going</span><div class="chips">${['paper', 'cardboard', 'pet', 'hdpe', 'aluminium', 'steel', 'glass', 'e_waste', 'textile'].map((m) => `<button type="button" class="chip" data-pm="${m}" aria-pressed="${mats.has(m)}">${dot(m)}${esc(matLabel(m).replace(/ \(\d\)/, ''))}</button>`).join('')}</div></div>
        <div class="split"><label class="field"><span>About how many kg?</span><input class="input" id="pk-kg" type="number" min="1" value="5"></label>
          <label class="field"><span>Address</span><input class="input" id="pk-addr" placeholder="House 14, Block C" autocomplete="street-address"></label></div>
        <button class="btn btn-primary btn-lg" type="submit" id="pk-go">Book pickup ${icon('arrowUR')}</button>
      </form>
      <section class="card"><div class="card-head"><h2>Your pickups</h2></div><div id="pk-list" class="list"><p class="muted">${S.user ? 'Loading…' : 'Sign in to see your pickups.'}</p></div></section>
    </div>`;
  let list = [];
  const loadSlots = async () => {
    const loc = S.loc;
    const { slots } = await get(`/api/pickups/slots?date=${date}&lat=${loc.lat}&lng=${loc.lng}`);
    if (!slots.some((s) => s.slot === slot)) slot = (slots.find((s) => s.greenRoute && !s.full) || slots[1]).slot;
    $('#pk-slots').innerHTML = slots.map((s) => `<button type="button" class="slot" data-slot="${s.slot}" aria-pressed="${s.slot === slot}" ${s.full ? 'disabled' : ''} data-green="${s.greenRoute}"><b>${s.slot}</b>${s.greenRoute ? `<span class="green">${icon('leaf')}Green Route +25</span>` : '<span>Standard</span>'}</button>`).join('');
  };
  const loadList = async () => {
    if (!S.user) return;
    list = (await get('/api/pickups/mine')).pickups;
    $('#pk-list').innerHTML = list.length ? list.map((p) => `<div class="li"><span class="ico">${icon(p.status === 'completed' ? 'check' : 'truck')}</span>
      <span style="min-width:0"><div class="t">${dayLabel(p.date)} · ${p.slot}</div><div class="s">${esc(p.address || 'Your location')} · code <b class="mono">${p.code}</b>${p.greenRoute ? ' · <span style="color:var(--ok)">Green Route</span>' : ''}</div></span>
      <span class="row" style="gap:6px">${p.status === 'scheduled' ? `<button class="btn btn-sm" data-track="${p.id}">Track</button><button class="icon-btn" data-cancel="${p.id}" aria-label="Cancel pickup">${icon('x')}</button>` : `<span class="tag ${p.status === 'completed' ? 'ok' : ''}">${p.status === 'completed' ? 'Done' : 'Cancelled'}</span>`}</span></div>`).join('')
      : empty('No pickups yet. Your first booking earns 10 coins, or 35 on a Green Route.');
  };
  host.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-date],[data-slot],[data-pm],[data-track],[data-cancel]'); if (!t) return;
    if (t.dataset.date) { date = t.dataset.date; $$('[data-date]', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.date === date))); loadSlots(); }
    else if (t.dataset.slot) { slot = t.dataset.slot; $$('[data-slot]', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.slot === slot))); }
    else if (t.dataset.pm) { mats.has(t.dataset.pm) ? mats.delete(t.dataset.pm) : mats.add(t.dataset.pm); t.setAttribute('aria-pressed', String(mats.has(t.dataset.pm))); }
    else if (t.dataset.track) track(list.find((p) => p.id === t.dataset.track), loadList);
    else if (t.dataset.cancel) { try { await patch(`/api/pickups/${t.dataset.cancel}`, { status: 'cancelled' }); toast('Pickup cancelled'); loadList(); } catch (er) { toast(er.message, 'err'); } }
  });
  $('#pk').onsubmit = async (e) => {
    e.preventDefault(); if (!requireAuth()) return;
    const btn = $('#pk-go'); setBusy(btn, true, 'Booking');
    try {
      const loc = await locate(true);
      const { pickup } = await post('/api/pickups', { date, slot, lat: loc.lat, lng: loc.lng, address: $('#pk-addr').value, materials: [...mats], estKg: +$('#pk-kg').value });
      toast(pickup.greenRoute ? 'Booked on a Green Route. +35 EcoCoins' : 'Pickup booked. +10 EcoCoins');
      sheet({ title: 'You\'re booked.', body: `<div class="stack" style="justify-items:start"><p class="muted">${dayLabel(pickup.date)}, ${pickup.slot}</p><div><div class="muted" style="font-size:12px;margin-bottom:6px">Pickup code · tell this to the collector</div><div class="code-big">${pickup.code}</div></div><button class="btn btn-primary" data-close>Done</button></div>` });
      loadList(); refreshMe().then(coinsChanged);
    } catch (er) { toast(er.message, 'err'); } finally { setBusy(btn, false); }
  };
  await Promise.all([loadSlots(), loadList()]);
}
function track(p, after) {
  let timer, map;
  sheet({
    title: 'On its way.', sub: `${dayLabel(p.date)} · ${p.slot} · code <b class="mono">${p.code}</b>`, wide: true,
    body: `<div class="map" id="trk" style="height:320px"></div><div class="row" style="justify-content:space-between"><div><div class="muted" style="font-size:12px">Collector route preview</div><div class="price" id="trk-eta">—</div></div><button class="btn btn-primary" id="trk-done">${icon('check')}Mark as collected</button></div><p class="faint" style="font-size:11.5px">The van's live position appears here once collectors share location from their app. For now this shows the route to your door.</p>`,
    onMount(el, close) {
      const L = window.L, me = [p.lat || S.loc.lat, p.lng || S.loc.lng];
      map = L.map($('#trk', el), { zoomControl: false }).setView(me, 15); tiles(map);
      L.marker(me, { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [16, 16] }) }).addTo(map);
      const path = [[me[0] + 0.012, me[1] - 0.014], [me[0] + 0.012, me[1] - 0.004], [me[0] + 0.004, me[1] - 0.004], [me[0] + 0.004, me[1]], me];
      L.polyline(path, { color: getComputedStyle(document.documentElement).getPropertyValue('--fg').trim(), weight: 3, opacity: 0.7, dashArray: '2 8', lineCap: 'round' }).addTo(map);
      const truck = L.marker(path[0], { icon: L.divIcon({ className: '', html: `<div class="truck">${icon('truck')}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] }) }).addTo(map);
      map.fitBounds(path, { padding: [30, 30] });
      let k = 0; const N = 220;
      const at = (f) => { const tot = path.length - 1, x = f * tot, i = Math.min(tot - 1, Math.floor(x)), r = x - i; return [path[i][0] + (path[i + 1][0] - path[i][0]) * r, path[i][1] + (path[i + 1][1] - path[i][1]) * r]; };
      timer = setInterval(() => { k = Math.min(N, k + 1); truck.setLatLng(at(k / N)); $('#trk-eta', el).textContent = k >= N ? 'At your door' : `${Math.ceil((1 - k / N) * 16)} min`; if (k >= N) clearInterval(timer); }, 110);
      $('#trk-done', el).onclick = async () => { try { await patch(`/api/pickups/${p.id}`, { status: 'completed' }); toast('Collected. Coins added.'); close(); after(); refreshMe().then(coinsChanged); } catch (e) { toast(e.message, 'err'); } };
    },
    onClose() { clearInterval(timer); map?.remove(); },
  });
}
export function tiles(map) {
  const dark = getComputedStyle(document.documentElement).colorScheme.includes('dark');
  window.L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`, { maxZoom: 19, subdomains: 'abcd', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © CARTO' }).addTo(map);
}

// =============== EcoCoins ===============
export async function wallet(host) {
  const { wallet: w, rewards } = await get('/api/wallet'); S.wallet = w; coinsChanged();
  const t = tier(w.coins);
  host.innerHTML = `${head('EcoCoins', 'Small acts,<br>counted.', 'Coins for listing, selling, pickups and clean-ups. Spend them on things that do some good.')}
    <div class="grid-2">
      <div class="stack">
        <div class="balance"><span class="muted" style="font-size:12px">Balance</span><b>${w.coins.toLocaleString('en-IN')}</b><span class="muted" style="font-size:12.5px">${t.name}${t.next ? ` · ${t.need} more to ${t.next}` : ''}</span><div class="bar" style="margin-top:14px"><i style="width:${t.pct}%"></i></div></div>
        <div class="kv"><div><b>${(+w.kg).toFixed(1)}</b><span>kg recycled</span></div><div><b>${(+w.co2).toFixed(1)}</b><span>kg CO₂ avoided</span></div><div><b>${(w.co2 / 21).toFixed(2)}</b><span>tree-years</span></div></div>
        <section class="card"><div class="card-head"><h2>How to earn</h2></div><div class="list">
          ${[['List scrap', 5], ['Book a pickup', 10], ['Green Route slot', 35], ['Report a litter spot', 15], ['Clean a reported spot', 40], ['Sell scrap', '10/kg']].map(([a, c]) => `<div class="li" style="grid-template-columns:1fr auto"><span style="font-size:13px">${a}</span><span class="tag">+${c}</span></div>`).join('')}
        </div></section>
      </div>
      <div class="stack">
        <section class="card"><div class="card-head"><h2>Rewards</h2></div><div class="rewards">${rewards.map((r) => `<div class="reward"><div><b style="font-size:13px">${esc(r.title)}</b><div class="faint" style="font-size:11.5px;margin-top:4px">${esc(r.kind)}</div></div><div class="row" style="justify-content:space-between"><span class="num" style="font-weight:600">${r.cost}</span><button class="btn btn-sm ${w.coins >= r.cost ? 'btn-primary' : ''}" data-redeem="${r.id}" ${w.coins >= r.cost ? '' : 'disabled'}>Redeem</button></div></div>`).join('')}</div></section>
        <section class="card"><div class="card-head"><h2>History</h2></div><div class="list">${w.txns.length ? w.txns.slice(0, 25).map((x) => `<div class="li" style="grid-template-columns:1fr auto"><span style="min-width:0"><div class="t" style="font-weight:500">${esc(x.note)}</div><div class="s">${when(x.at)}</div></span><span class="num" style="color:${x.coins >= 0 ? 'var(--ok)' : 'var(--bad)'};font-weight:600">${x.coins >= 0 ? '+' : ''}${x.coins}</span></div>`).join('') : '<p class="muted">No activity yet.</p>'}</div></section>
      </div>
    </div>`;
  host.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-redeem]'); if (!b) return;
    setBusy(b, true);
    try { const r = await post('/api/rewards/redeem', { id: b.dataset.redeem }); sheet({ title: 'Redeemed.', body: `<div class="stack" style="justify-items:start"><p class="muted">Use this code to claim it.</p><div class="code-big" style="font-size:26px">${r.code}</div><button class="btn btn-primary" data-close>Done</button></div>`, onClose: () => route() }); refreshMe().then(coinsChanged); }
    catch (er) { setBusy(b, false); toast(er.message, 'err'); }
  });
}

// =============== Ward Wars ===============
export async function board(host) {
  const { wards, people } = await get('/api/leaderboard');
  const max = Math.max(1, ...wards.map((w) => w.kg));
  host.innerHTML = `${head('Ward Wars', 'Street by<br>street.', 'Kilos recycled by members of each ward. Add your ward in your profile to count towards it.')}
    <div class="grid-2">
      <section class="card"><div class="card-head"><h2>Wards</h2></div>${wards.length ? wards.map((w, i) => `<div class="board-row"><b class="num muted">${i + 1}</b><div style="min-width:0"><div class="row" style="justify-content:space-between;font-size:13px"><span>${esc(w.ward)}</span><span class="num muted">${(+w.kg).toFixed(1)} kg · ${w.members} ${w.members === 1 ? 'member' : 'members'}</span></div><div class="bar" style="margin-top:8px"><i style="width:${(w.kg / max) * 100}%"></i></div></div><span></span></div>`).join('') : empty('No wards yet. Add your ward in your profile and be the first on the board.', ['#/profile', 'Add my ward'])}</section>
      <section class="card"><div class="card-head"><h2>Top recyclers</h2></div>${people.length ? people.map((p, i) => `<div class="board-row"><b class="num muted">${i + 1}</b><div><div style="font-size:13px;font-weight:600">${esc(p.name)}</div><div class="faint" style="font-size:11.5px">${esc(p.ward || 'No ward')} · ${p.kg} kg</div></div><span class="tag">${p.coins}</span></div>`).join('') : empty('Nobody here yet. Sign up and you\'re number one.')}</section>
    </div>`;
}

// =============== Profile ===============
export async function profile(host) {
  if (!requireAuth()) return;
  const u = S.user, c = S.config || {}, theme = store.get('theme') || 'system';
  host.innerHTML = `${head('Profile', esc(u.name) + '.', esc(u.email))}
    <div class="grid-2">
      <div class="stack">
        <form class="card stack" id="pf"><h2>Your details</h2>
          <label class="field"><span>Name</span><input class="input" id="pf-name" value="${esc(u.name)}"></label>
          <label class="field"><span>Ward or area</span><input class="input" id="pf-ward" value="${esc(u.ward || '')}" placeholder="Ward 12"></label>
          <label class="field"><span>UPI ID <span class="faint">(collectors pay you here)</span></span><input class="input mono" id="pf-upi" value="${esc(u.upi || '')}" placeholder="yourname@okaxis"></label>
          <div class="field"><span>Mode</span><div class="seg"><button type="button" data-r="seller" aria-pressed="${u.role === 'seller'}">Seller</button><button type="button" data-r="buyer" aria-pressed="${u.role === 'buyer'}">Collector</button></div></div>
          <button class="btn btn-primary" type="submit" style="justify-self:start">Save changes</button></form>
        <section class="card stack"><h2>Appearance</h2><div class="seg" style="justify-self:start">${['system', 'dark', 'light'].map((t) => `<button type="button" data-th="${t}" aria-pressed="${theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></section>
        <button class="btn" id="pf-out" style="justify-self:start">${icon('logout')}Sign out</button>
      </div>
      <div class="stack">
        <section class="card stack"><h2>EcoSync for Android</h2><p class="muted" style="font-size:12.5px">Opens straight to the scanner, uses your camera and GPS, and keeps you signed in.</p><a class="btn btn-primary" href="${BASE}/download/android" style="justify-self:start" ${backend === 'preview' ? 'data-noapk' : ''}>${icon('download')}Download APK</a></section>
        <section class="card"><div class="card-head"><h2>How your data is kept</h2></div><div class="list">
          ${[['Database', c.db === 'neon' ? 'Neon Postgres' : c.db === 'postgres' ? 'Postgres' : c.db === 'browser' ? 'This browser (preview)' : 'Postgres on the EcoSync server'], ['Passwords', 'Salted scrypt hashes'], ['Scanner', c.ai === 'gemini' ? 'Gemini vision' : 'MobileNet, runs on your device'], ['Payments', 'UPI directly to the seller, or cash'], ['Maps', 'OpenStreetMap · OpenFreeMap 3D']]
            .map(([k, v]) => `<div class="li" style="grid-template-columns:1fr auto"><span style="font-size:13px">${k}</span><span class="muted" style="font-size:12.5px;text-align:right">${esc(v)}</span></div>`).join('')}
        </div></section>
        ${S.isApp || backend === 'preview' ? `<form class="card stack" id="pf-api"><h2>Server address</h2><p class="muted" style="font-size:12.5px">The EcoSync site this app talks to.</p><input class="input mono" id="pf-api-url" placeholder="https://ecosync-29iu.onrender.com" value="${esc(BASE)}"><button class="btn" type="submit" style="justify-self:start">Save and reload</button></form>` : ''}
      </div>
    </div>`;
  $$('[data-th]', host).forEach((b) => b.addEventListener('click', () => { const t = b.dataset.th; t === 'system' ? store.del('theme') : store.set('theme', t); applyTheme(t, true); $$('[data-th]', host).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  $('#pf-out', host).onclick = () => dispatchEvent(new Event('ecosync:signout'));
  $('[data-noapk]', host)?.addEventListener('click', (e) => { e.preventDefault(); toast('The app downloads from the live site.'); });
  $$('[data-r]', host).forEach((b) => b.addEventListener('click', () => setRole(b.dataset.r)));
  $('#pf', host).onsubmit = async (e) => { e.preventDefault(); try { const r = await patch('/api/me', { name: $('#pf-name').value, ward: $('#pf-ward').value, upi: $('#pf-upi').value.trim() }); S.user = r.user; store.set('user', r.user); toast('Saved'); renderShell('profile'); } catch (er) { toast(er.message, 'err'); } };
  $('#pf-api', host)?.addEventListener('submit', (e) => { e.preventDefault(); setBase($('#pf-api-url').value.trim()); location.reload(); });
}
