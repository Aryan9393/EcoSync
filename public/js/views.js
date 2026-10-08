import { get, post, patch, backend, store, setBase, BASE } from './api.js';
import { S, PRICES, matLabel, matColor, refreshMe, locate, tier } from './state.js';
import { $, $$, esc, inr, kg, ago, when, toast, sheet, qrSvg, setBusy, fileToDataUrl } from './ui.js';
import { icon, LOGO } from './icons.js';
import { openSignIn } from './auth.js';
import { requireAuth, renderShell, route, applyTheme } from './app.js';
import { openCheckout } from './pay.js';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const modeBanner = () => {
  const c = S.config || {};
  const parts = [];
  if (backend === 'preview') parts.push('Preview mode: data stays in this browser');
  if (c.ai === 'demo') parts.push('AI answers are samples until a Gemini key is added');
  if (c.payments === 'demo') parts.push('payments are simulated');
  return parts.length ? `<div class="mode-banner">${icon('spark').replace('<svg', '<svg style="width:18px;height:18px;color:var(--warn)"')}<span>${parts.join(' · ')}.</span></div>` : '';
};
export async function setRole(role) {
  if (!S.user || S.user.role === role) return;
  try { const r = await patch('/api/me', { role }); S.user = r.user; store.set('user', r.user); toast(role === 'buyer' ? 'Buyer mode: browse and collect nearby scrap' : 'Seller mode: list your scrap and book pickups', 'ok'); renderShell(); route(); }
  catch (e) { toast(e.message, 'err'); }
}
const SAMPLE_PASSPORT = 'ES-7K2P-QX9M';
const swatch = (m) => `<i class="swatch" style="background:${matColor(m)}"></i>`;

// =============== Landing ===============
export function landingHtml() {
  const url = `${location.origin}${location.pathname}#/passport/${SAMPLE_PASSPORT}`;
  const F = [
    ['scan', 'AI waste scanner', 'Point your camera at any item. Gemini names the material, its resin code, any hazard and today\'s scrap price.'],
    ['qr', 'QR material passport', 'Every sale gets a QR code that records each handover, from your doorstep to the recycler and into a new product.', 1],
    ['shield', 'Handshake escrow', 'Buyers pay up front; the money reaches the seller only when the buyer scans the seller\'s QR at pickup.', 1],
    ['route', 'Green Route pickups', 'Pick a slot when a collection van is already passing nearby and earn 25 bonus EcoCoins for the fuel saved.', 1],
    ['pin', 'Official hubs near you', 'Live recycling centres, e-waste points and scrap yards from OpenStreetMap, with directions and Street View.'],
    ['cube', '3D litter map', 'Pin garbage hotspots on a 3D city map. Neighbours confirm them, and whoever cleans up earns coins.', 1],
    ['market', 'Buyer and seller modes', 'Homes list scrap. Kabadiwalas, recyclers and upcyclers see every nearby lot and buy in two taps.'],
    ['image', 'Upcycle Studio', 'AI suggests projects for your item and generates a picture of what it could become.'],
    ['mic', 'Speak to list, in Hindi', 'Say "paanch kilo akhbaar" and the listing fills itself: material, weight and price.'],
    ['coin', 'EcoCoins and rewards', 'Earn on every sale, pickup and report. Redeem for metro top-ups, saplings and school supplies.'],
    ['trophy', 'Ward Wars', 'Wards compete each month on kilos recycled. Your ward\'s rank updates with every pickup.'],
    ['bot', 'EcoBot', 'Ask in Hindi or English about sorting rules, e-waste laws or what your scrap is worth.'],
  ];
  return `<div class="landing">
    <header class="wrap topbar">
      <a class="brand" href="#/">${LOGO}<span>EcoSync</span></a>
      <nav class="topnav" aria-label="Sections"><a href="#features" data-scroll>Features</a><a href="#how" data-scroll>How it works</a><a href="#roles" data-scroll>Buyers & sellers</a><a href="#android" data-scroll>Android app</a></nav>
      <div class="row" style="gap:8px"><button class="btn btn-ghost" data-signin>Sign in</button><button class="btn btn-primary" data-signin>Get started</button></div>
    </header>
    <section class="wrap hero">
      <div>
        <h1>Scan it. Sell it. See what it becomes.</h1>
        <p class="lede">EcoSync is a recycling marketplace for Indian homes and scrap collectors. AI identifies and prices your scrap, a nearby buyer books the pickup, and a QR passport follows every kilo to its next life.</p>
        <div class="cta"><button class="btn btn-primary btn-lg" data-signin="seller">${icon('scan')}Sell my scrap</button><button class="btn btn-lg" data-signin="buyer">${icon('market')}I buy scrap</button><a class="btn btn-lg btn-ghost" href="#/scan">Try the scanner</a></div>
        <div class="proof">
          <div><b class="num">17</b><span>materials priced per kg</span></div>
          <div><b class="num">6</b><span>pickup slots every day</span></div>
          <div><b class="num">₹0</b><span>to join, for buyers and sellers</span></div>
        </div>
      </div>
      <article class="passport" aria-label="Sample material passport">
        <div class="pp-head"><div><div class="pp-label">Material passport</div><div class="pp-id">${SAMPLE_PASSPORT}</div></div><span class="pill ok" id="hero-state">${icon('lock').replace('<svg', '<svg style="width:13px;height:13px"')}In escrow</span></div>
        <div class="pp-body">
          <div class="qr">${qrSvg(url)}</div>
          <dl class="pp-facts">
            <div><dt>Material</dt><dd>${swatch('pet')} PET bottles · 1</dd></div>
            <div><dt>Weight</dt><dd>3.5 kg</dd></div>
            <div><dt>Paid</dt><dd>₹77</dd></div>
            <div><dt>CO₂ avoided</dt><dd>5.3 kg</dd></div>
          </dl>
        </div>
        <ol class="timeline" id="hero-tl">
          ${[['Listed by Sunita R.', 'Rinsed, labels off', '09:12'], ['Paid by GreenCycle Traders', '₹77 held in escrow', '09:40'], ['Picked up', 'QR handshake at the gate', '11:05'], ['At recycling hub', 'Sorted, baled, weighed', '16:30'], ['Reborn', 'Spun into polyester fibre', 'Day 9']]
            .map(([t, s, tm], i) => `<li class="${i < 2 ? 'done' : ''} ${i === 1 ? 'now' : ''}"><span><b style="font-weight:600">${t}</b><small>${s}</small></span><time>${tm}</time></li>`).join('')}
        </ol>
      </article>
    </section>

    <section class="wrap section" id="features">
      <h2>Everything a scrap sale needs, in one app</h2>
      <p class="sub">Four signature features set EcoSync apart: the material passport, handshake escrow, Green Route pickups and the 3D litter map.</p>
      <div class="features">${F.map(([ic, t, d, n]) => `<div class="feature">${icon(ic)}<h3>${t}</h3><p>${d}</p>${n ? '<span class="new">Signature feature</span>' : ''}</div>`).join('')}</div>
    </section>

    <section class="wrap section" id="how">
      <h2>How one sale travels</h2>
      <ol class="steps">
        <li><b>Scan</b><span>AI names the item and estimates weight, value and CO₂ saved.</span></li>
        <li><b>List</b><span>Publish it to buyers within a few kilometres, or speak it in Hindi.</span></li>
        <li><b>Pay into escrow</b><span>The buyer pays by UPI or card. EcoSync holds the money.</span></li>
        <li><b>Handshake</b><span>At pickup the buyer scans the seller's QR. Money is released.</span></li>
        <li><b>Trace</b><span>The passport records the hub, the processing and the new product.</span></li>
      </ol>
    </section>

    <section class="wrap section" id="gallery" hidden>
      <h2>Second life</h2>
      <p class="sub">What everyday scrap becomes. Images generated with Gemini.</p>
      <div class="gallery" id="gallery-grid"></div>
    </section>

    <section class="wrap section" id="roles">
      <h2>Two sides of the same pickup</h2>
      <div class="roles">
        <div class="role-card"><h3>Sellers</h3><p class="muted">Households, hostels, shops and offices with scrap to clear.</p>
          <ul><li>Know what your scrap is worth before anyone quotes you</li><li>Book a pickup in three taps, with a pickup code</li><li>Get paid safely and earn EcoCoins</li></ul>
          <button class="btn btn-primary" data-signin="seller">Start selling</button></div>
        <div class="role-card"><h3>Buyers</h3><p class="muted">Kabadiwalas, recycling units and upcyclers looking for sorted material.</p>
          <ul><li>See every open lot on a map, sorted by distance</li><li>Pay through escrow; release with a QR scan</li><li>Prove where material came from with passports</li></ul>
          <button class="btn" data-signin="buyer">Start buying</button></div>
      </div>
    </section>

    <section class="wrap section" id="android">
      <div class="card" style="display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center">
        <div><h2 style="font:600 22px var(--font-display)">EcoSync for Android</h2><p class="muted" style="margin-top:8px;max-width:56ch">The Android app opens straight to the AI scanner, uses your phone camera and GPS, and keeps you signed in.</p></div>
        <a class="btn btn-primary btn-lg" href="${BASE}/download/android" ${backend === 'preview' ? 'aria-disabled="true" data-preview-apk' : ''}>${icon('android')}Download APK</a>
      </div>
    </section>
    <footer class="wrap footer"><span>EcoSync · built for TECHBEANS 7.0 FutureWebX</span><span>Map data © OpenStreetMap contributors</span></footer>
  </div>`;
}
export function landingMount(root) {
  $$('[data-signin]', root).forEach((b) => b.addEventListener('click', () => openSignIn(() => route(), b.dataset.signin || 'seller')));
  $$('[data-scroll]', root).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); $(a.getAttribute('href'), root)?.scrollIntoView({ behavior: 'smooth' }); }));
  $('[data-preview-apk]', root)?.addEventListener('click', (e) => { e.preventDefault(); toast('The APK downloads from the deployed site.'); });
  fetch('img/ai/index.json').then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d?.images?.length) return;
    const caps = { 'hero-city': 'Cleaner streets', 'pet-to-shirt': 'Bottles → T-shirt', 'paper-to-notebook': 'Newspaper → notebook', 'cans-to-bike': 'Cans → bicycle', 'ewaste-to-gold': 'E-waste → metals', kabadiwala: 'Your local collector' };
    $('#gallery-grid', root).innerHTML = d.images.map((i) => `<figure><img src="img/ai/${esc(i.file)}" alt="${esc(caps[i.name] || i.name)}" loading="lazy"><figcaption>${esc(caps[i.name] || i.name)}</figcaption></figure>`).join('');
    $('#gallery', root).hidden = false;
  }).catch(() => {});
  // The one orchestrated motion: the sample passport advances through its journey.
  const items = $$('#hero-tl li', root), state = $('#hero-state', root);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 1;
  const labels = ['Listed', 'In escrow', 'Released', 'At hub', 'Reborn'];
  const t = setInterval(() => {
    if (!document.body.contains(root.firstElementChild)) return clearInterval(t);
    i = (i + 1) % items.length;
    items.forEach((li, k) => { li.classList.toggle('done', k <= i); li.classList.toggle('now', k === i); });
    state.lastChild.textContent = labels[i];
  }, 1900);
}

// =============== Dashboard ===============
export async function dashboard(host) {
  if (!requireAuth()) return;
  await refreshMe(); renderShell('');
  const u = S.user, w = S.wallet || { coins: 0, kg: 0, co2: 0 }, t = tier(w.coins), buyer = u.role === 'buyer';
  host.innerHTML = `${modeBanner()}
    <div class="page-head"><div><h1>${greeting()}, ${esc(u.name.split(' ')[0])}</h1><p>${buyer ? 'Buyer mode · nearby lots, pickups and passports' : 'Seller mode · scan, list and track your scrap'}</p></div>
      <div class="row"><span class="pill">${icon('pin').replace('<svg', '<svg style="width:13px;height:13px"')}<span id="loc-label">${S.loc.approx ? 'Approximate location' : 'Using your location'}</span></span></div></div>
    <div class="impact" style="margin-bottom:16px">
      <div class="coins"><b>${w.coins.toLocaleString('en-IN')}</b><span>EcoCoins · ${t.name}</span></div>
      <div><b>${(+w.kg).toFixed(1)}</b><span>kg recycled</span></div>
      <div><b>${(+w.co2).toFixed(1)}</b><span>kg CO₂ avoided</span></div>
      <div><b>${(w.co2 / 21).toFixed(2)}</b><span>tree-years of CO₂</span></div>
    </div>
    <div class="actions" style="margin-bottom:16px">${(buyer ? [
      ['#/market', 'market', 'Browse nearby lots', 'Sorted by distance'], ['#/passport/scan', 'qr', 'Scan seller QR', 'Release payment at pickup'],
      ['#/map', 'pin', 'Find hubs', 'Where to drop collected scrap'], ['#/map/3d', 'cube', 'Litter map', 'Clean a hotspot, earn 40 coins'],
    ] : [
      ['#/scan', 'scan', 'Scan an item', 'AI price and sorting'], ['#/market/new', 'plus', 'List scrap', 'Reach nearby buyers'],
      ['#/pickups', 'truck', 'Book pickup', 'Green Route bonus slots'], ['#/map/3d', 'flag', 'Report litter', 'Pin it on the 3D map'],
    ]).map(([h, ic, b, s]) => `<a class="action" href="${h}">${icon(ic)}<span><b>${b}</b><br><span>${s}</span></span></a>`).join('')}</div>
    <div class="dash">
      <div class="stack">
        <section class="card"><div class="card-head"><h2>Passports</h2><a href="#/passport" class="btn btn-sm btn-ghost">All</a></div><div id="d-pass" class="list"><p class="muted">Loading…</p></div></section>
        <section class="card"><div class="card-head"><h2>${buyer ? 'Closest open lots' : 'Upcoming pickups'}</h2><a href="${buyer ? '#/market' : '#/pickups'}" class="btn btn-sm btn-ghost">${buyer ? 'Market' : 'Manage'}</a></div><div id="d-second" class="list"><p class="muted">Loading…</p></div></section>
      </div>
      <div class="stack">
        <section class="tip">${icon('sparkles')}<div><b>Tip from EcoBot</b><p class="muted" style="margin-top:4px">${tipOfDay()}</p></div></section>
        <section class="card"><div class="card-head"><h2>Recycling hubs near you</h2><a href="#/map" class="btn btn-sm btn-ghost">Map</a></div><div id="d-hubs" class="list"><p class="muted">Finding hubs…</p></div></section>
        <section class="card"><div class="card-head"><h2>${t.next ? `${t.need} coins to ${t.next}` : 'Top tier reached'}</h2><span class="pill coin">${t.name}</span></div><div class="bar"><i style="width:${t.pct}%"></i></div></section>
      </div>
    </div>`;
  const loc = await locate(); $('#loc-label') && ($('#loc-label').textContent = loc.approx ? 'Approximate location' : 'Using your location');
  get('/api/passports/mine').then(({ passports }) => {
    $('#d-pass').innerHTML = passports.length ? passports.slice(0, 4).map(passRow).join('') : `<div class="empty"><span>${buyer ? 'Buy a lot from the market and its passport appears here.' : 'When someone buys your scrap, its passport appears here.'}</span><a class="btn btn-sm" href="${buyer ? '#/market' : '#/market/new'}">${buyer ? 'Open market' : 'List scrap'}</a></div>`;
  }).catch(() => {});
  if (buyer) get(`/api/listings?lat=${loc.lat}&lng=${loc.lng}`).then(({ listings }) => { $('#d-second').innerHTML = listings.filter((l) => l.status === 'open').slice(0, 4).map(listRow).join(''); }).catch(() => {});
  else get('/api/pickups/mine').then(({ pickups }) => {
    const up = pickups.filter((p) => p.status === 'scheduled');
    $('#d-second').innerHTML = up.length ? up.slice(0, 3).map(pickRow).join('') : `<div class="empty"><span>No pickups booked. Slots with a leaf earn 25 bonus coins.</span><a class="btn btn-sm" href="#/pickups">Book a pickup</a></div>`;
  }).catch(() => {});
  get(`/api/hubs?lat=${loc.lat}&lng=${loc.lng}&r=8000`).then(({ hubs, sample }) => {
    $('#d-hubs').innerHTML = (hubs.length ? hubs.slice(0, 4).map((h) => `<a class="list-item" href="#/map" style="text-decoration:none;color:inherit"><span class="badge-ico">${icon(h.kind === 'scrap' ? 'market' : 'recycle')}</span><span style="min-width:0"><div class="t">${esc(h.name)}</div><div class="s">${esc(h.kindLabel)}${h.official ? ' · official' : ''}</div></span><span class="num muted">${h.distanceKm} km</span></a>`).join('') : '<p class="muted">No mapped hubs within 8 km. Open the map to search wider.</p>') + (sample ? '<p class="faint" style="font-size:12px;margin-top:8px">Sample hubs shown; live OpenStreetMap results load on the deployed site.</p>' : '');
  }).catch(() => { $('#d-hubs').innerHTML = '<p class="muted">Hubs could not load. Open the map to retry.</p>'; });
}
const TIPS = ['Rinse bottles and remove caps: clean PET sells for up to 30% more.', 'Keep newspapers dry and tied in 5 kg bundles. Wet paper is often refused.', 'Batteries and chargers never go in the dry bin. Find an e-waste point on the map.', 'Book slots marked with a leaf: a van is already nearby, so you earn 25 bonus coins.', 'Crushed aluminium cans are the most valuable scrap in most homes, at around ₹110/kg.'];
const tipOfDay = () => TIPS[new Date().getDate() % TIPS.length];
export const passRow = (p) => `<a class="list-item" href="#/passport/${p.id}" style="text-decoration:none;color:inherit"><span class="badge-ico">${icon('qr')}</span><span style="min-width:0"><div class="t">${esc(p.title)}</div><div class="s mono">${p.id}</div></span><span class="pill ${p.escrow === 'released' ? 'ok' : 'warn'}">${p.escrow === 'released' ? 'Released' : 'In escrow'}</span></a>`;
const listRow = (l) => `<a class="list-item" href="#/market" style="text-decoration:none;color:inherit"><span class="badge-ico" style="border-color:${matColor(l.material)}">${swatch(l.material)}</span><span style="min-width:0"><div class="t">${esc(l.title)}</div><div class="s">${kg(l.kg)} · ${l.distanceKm ?? '–'} km</div></span><span class="price" style="font-size:16px">${inr(l.price)}</span></a>`;
const pickRow = (p) => `<div class="list-item"><span class="badge-ico">${icon('truck')}</span><span style="min-width:0"><div class="t">${new Date(p.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${p.slot}</div><div class="s">Pickup code <b class="mono">${p.code}</b>${p.greenRoute ? ' · Green Route' : ''}</div></span><a class="btn btn-sm" href="#/pickups">Track</a></div>`;

// =============== Marketplace ===============
export async function market(host, params) {
  const loc = S.loc; let tab = params[0] === 'mine' ? 'mine' : 'near', mat = '';
  host.innerHTML = `${modeBanner()}<div class="page-head"><div><h1>Marketplace</h1><p>Open scrap lots near you. Buyers pay into escrow; sellers get paid at pickup.</p></div>
    <div class="row"><button class="btn btn-primary" id="m-new">${icon('plus')}List scrap</button></div></div>
    <div class="toolbar"><div class="seg" role="group" aria-label="View"><button data-tab="near">Nearby lots</button><button data-tab="mine">My activity</button></div>
    <div class="chips" id="m-chips"></div></div><div id="m-list" class="listings"></div>`;
  const mats = ['paper', 'cardboard', 'pet', 'hdpe', 'aluminium', 'steel', 'copper', 'glass', 'e_waste', 'textile'];
  $('#m-chips').innerHTML = `<button class="chip" data-mat="" aria-pressed="true">All</button>` + mats.map((m) => `<button class="chip" data-mat="${m}" aria-pressed="false">${swatch(m)}${esc(matLabel(m).replace(/ \(\d\)/, ''))}</button>`).join('');
  const load = async () => {
    $$('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    $$('[data-mat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mat === mat)));
    const box = $('#m-list'); box.innerHTML = '<p class="muted">Loading lots…</p>';
    if (tab === 'mine' && !S.user) { box.innerHTML = `<div class="empty"><span>Sign in to see what you've listed and bought.</span><button class="btn btn-sm" id="m-si">Sign in</button></div>`; $('#m-si').onclick = () => requireAuth(load); return; }
    try {
      const q = `/api/listings?lat=${loc.lat}&lng=${loc.lng}${mat ? `&material=${mat}` : ''}${tab === 'mine' ? `&mine=1&uid=${S.user.id}` : ''}`;
      const { listings } = await get(q);
      box.innerHTML = listings.length ? listings.map(listingCard).join('') : `<div class="empty"><span>${tab === 'mine' ? 'You have no listings or purchases yet.' : 'No lots of this material nearby yet.'}</span><button class="btn btn-sm" data-act="new">List scrap</button></div>`;
      box._data = listings;
    } catch (e) { box.innerHTML = `<div class="empty"><span>${esc(e.message)}</span></div>`; }
  };
  host.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab],[data-mat],[data-buy],[data-act],[data-remove],[data-pass]'); if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; load(); }
    else if (t.dataset.mat !== undefined && t.hasAttribute('data-mat')) { mat = t.dataset.mat; load(); }
    else if (t.dataset.buy) { const l = $('#m-list')._data.find((x) => x.id === t.dataset.buy); requireAuth(() => openCheckout(l, load), 'buyer') && openCheckout(l, load); }
    else if (t.dataset.act === 'new') newListing(load);
    else if (t.dataset.remove) patch(`/api/listings/${t.dataset.remove}`, { status: 'removed' }).then(() => { toast('Listing removed'); load(); }).catch((er) => toast(er.message, 'err'));
    else if (t.dataset.pass) location.hash = `#/passport/${t.dataset.pass}`;
  });
  $('#m-new').onclick = () => newListing(load);
  await load();
  if (params[0] === 'new') newListing(load);
}
function listingCard(l) {
  const mine = S.user && l.sellerId === S.user.id, bought = S.user && l.buyerId === S.user.id;
  const status = l.status === 'open' ? '' : `<span class="pill ${l.status === 'sold' ? 'ok' : 'warn'}">${l.status === 'sold' ? 'Sold' : 'Reserved'}</span>`;
  return `<article class="listing"><div class="stripe" style="background:${matColor(l.material)}"></div>
    <div class="body">${l.photo ? `<img class="thumb" src="${l.photo}" alt="" style="border-radius:10px;margin-bottom:6px">` : ''}
      <div class="row" style="justify-content:space-between;gap:8px"><span class="title">${esc(l.title)}</span>${status}</div>
      <div class="meta"><span>${swatch(l.material)} ${esc(matLabel(l.material))}</span><span>${kg(l.kg)}</span>${l.distanceKm != null ? `<span>${l.distanceKm} km</span>` : ''}</div>
      ${l.notes ? `<p class="muted" style="font-size:13.5px">${esc(l.notes)}</p>` : ''}
      <div class="meta"><span>${icon('user').replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"')} ${esc(l.seller?.name || l.sellerName)}</span><span>${ago(l.createdAt)}</span>${l.demo ? '<span class="faint">Sample</span>' : ''}</div>
    </div>
    <div class="foot"><span class="price">${inr(l.price)} <small>${l.kg ? inr(l.price / l.kg) + '/kg' : ''}</small></span>
      ${mine ? (l.status === 'open' ? `<button class="btn btn-sm" data-remove="${l.id}">Remove</button>` : l.passportId ? `<button class="btn btn-sm" data-pass="${l.passportId}">Passport</button>` : '')
        : bought && l.passportId ? `<button class="btn btn-sm" data-pass="${l.passportId}">${icon('qr')}Passport</button>`
        : l.status === 'open' ? `<button class="btn btn-sm btn-primary" data-buy="${l.id}">Buy</button>` : ''}
    </div></article>`;
}
export function newListing(onDone, prefill = JSON.parse(sessionStorage.getItem('ecosync.prefill') || 'null')) {
  if (!requireAuth(() => newListing(onDone, prefill), 'seller')) return;
  sessionStorage.removeItem('ecosync.prefill');
  const p = prefill || {}; const mats = Object.keys(PRICES()).filter((m) => !['organic', 'battery'].includes(m));
  let photo = p.photo || null;
  sheet({
    title: 'List scrap', sub: 'Nearby buyers see it right away. You earn 5 EcoCoins for listing.', wide: true,
    body: `<form class="stack" id="nl" novalidate>
      <div class="row"><button type="button" class="btn grow" id="nl-voice">${icon('mic')}<span>Speak your listing</span></button><label class="btn grow" style="cursor:pointer">${icon('camera')}<span>${photo ? 'Change photo' : 'Add photo'}</span><input type="file" accept="image/*" capture="environment" id="nl-photo" hidden></label></div>
      <p class="faint" style="font-size:12.5px;margin-top:-6px">Try: "paanch kilo akhbaar, sookha hai" or "3 kg plastic bottles".</p>
      <img id="nl-prev" ${photo ? `src="${photo}"` : 'hidden'} alt="" style="max-height:180px;object-fit:cover;border-radius:12px">
      <label class="field"><span>Title</span><input class="input" id="nl-title" value="${esc(p.title || '')}" placeholder="Newspapers, 3 months"></label>
      <div class="split">
        <label class="field"><span>Material</span><select class="input" id="nl-mat">${mats.map((m) => `<option value="${m}" ${m === (p.material || 'paper') ? 'selected' : ''}>${esc(matLabel(m))} · ₹${PRICES()[m].rate}/kg</option>`).join('')}</select></label>
        <label class="field"><span>Weight (kg)</span><input class="input" id="nl-kg" type="number" min="0.1" step="0.1" value="${p.kg || 2}"></label>
      </div>
      <div class="split">
        <label class="field"><span>Price (₹)</span><input class="input" id="nl-price" type="number" min="0" step="1"></label>
        <label class="field"><span>Area</span><input class="input" id="nl-area" placeholder="Block C, near the park"></label>
      </div>
      <label class="field"><span>Notes for buyers</span><textarea class="input" id="nl-notes" placeholder="Dry, tied in bundles">${esc(p.notes || '')}</textarea></label>
      <button class="btn btn-primary btn-lg" type="submit" id="nl-go">Publish listing</button>
    </form>`,
    onMount(el, close) {
      const price = $('#nl-price', el), suggest = () => { price.value = Math.round((PRICES()[$('#nl-mat', el).value]?.rate || 0) * (+$('#nl-kg', el).value || 0)); };
      suggest(); $('#nl-mat', el).onchange = suggest; $('#nl-kg', el).oninput = suggest;
      $('#nl-photo', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; photo = await fileToDataUrl(f, 640, 0.75); const im = $('#nl-prev', el); im.src = photo; im.hidden = false; };
      $('#nl-voice', el).onclick = (e) => voiceFill(e.currentTarget, el, suggest);
      $('#nl', el).onsubmit = async (e) => {
        e.preventDefault(); const btn = $('#nl-go', el); setBusy(btn, true, 'Publishing');
        try {
          await post('/api/listings', { title: $('#nl-title', el).value, material: $('#nl-mat', el).value, kg: +$('#nl-kg', el).value, price: +price.value, area: $('#nl-area', el).value, notes: $('#nl-notes', el).value, photo, lat: S.loc.lat, lng: S.loc.lng, ai: p.ai || null });
          toast('Listing published. +5 EcoCoins', 'ok'); close(); onDone?.();
          if (!onDone) location.hash = '#/market/mine';
        } catch (er) { setBusy(btn, false); toast(er.message, 'err'); }
      };
    },
  });
}
function voiceFill(btn, el, after) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const apply = async (text) => {
    setBusy(btn, true, 'Understanding');
    try { const r = await post('/api/ai/parse-listing', { text }); $('#nl-title', el).value = r.title || text; if (r.material && $(`#nl-mat option[value="${r.material}"]`, el)) $('#nl-mat', el).value = r.material; if (r.kg) $('#nl-kg', el).value = r.kg; if (r.notes) $('#nl-notes', el).value = r.notes; after(); toast('Listing filled from your voice', 'ok'); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(btn, false); }
  };
  if (!SR) {
    const t = $('#nl-title', el).value.trim();
    if (t) return apply(t);
    return toast('Voice input isn\'t supported in this browser. Type the listing in the title and tap again.', 'err');
  }
  const rec = new SR(); rec.lang = 'hi-IN'; rec.interimResults = false; rec.maxAlternatives = 1;
  btn.innerHTML = `${icon('mic')}<span>Listening… speak now</span>`;
  rec.onresult = (e) => apply(e.results[0][0].transcript);
  rec.onerror = () => { toast('Didn\'t catch that. Try again or type it.', 'err'); btn.innerHTML = `${icon('mic')}<span>Speak your listing</span>`; };
  rec.onend = () => { if (!btn.disabled) btn.innerHTML = `${icon('mic')}<span>Speak your listing</span>`; };
  rec.start();
}

// =============== Pickups ===============
export async function pickups(host) {
  if (!requireAuth()) return;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let date = iso(days[0]), slot = null, mats = new Set(['paper']);
  host.innerHTML = `${modeBanner()}<div class="page-head"><div><h1>Pickups</h1><p>Book a doorstep pickup. Slots with a leaf already have a van nearby: you earn 25 extra coins and save fuel.</p></div></div>
    <div class="grid-2" style="align-items:start">
      <form class="card stack" id="pk" novalidate>
        <h2>Book a pickup</h2>
        <div class="field"><span>Day</span><div class="dates">${days.map((d) => `<button type="button" class="date" data-date="${iso(d)}" aria-pressed="${iso(d) === date}">${d.toLocaleDateString('en-IN', { weekday: 'short' })}<b>${d.getDate()}</b></button>`).join('')}</div></div>
        <div class="field"><span>Time slot</span><div class="slots" id="pk-slots"></div></div>
        <div class="field"><span>What's going</span><div class="chips">${['paper', 'cardboard', 'pet', 'hdpe', 'aluminium', 'steel', 'glass', 'e_waste', 'textile'].map((m) => `<button type="button" class="chip" data-pm="${m}" aria-pressed="${mats.has(m)}">${swatch(m)}${esc(matLabel(m).replace(/ \(\d\)/, ''))}</button>`).join('')}</div></div>
        <div class="split"><label class="field"><span>Approx. weight (kg)</span><input class="input" id="pk-kg" type="number" min="1" value="5"></label>
          <label class="field"><span>Address</span><input class="input" id="pk-addr" placeholder="House 14, Block C" autocomplete="street-address"></label></div>
        <button class="btn btn-ghost btn-sm" type="button" id="pk-loc" style="justify-self:start">${icon('navigate')}Use my current location</button>
        <button class="btn btn-primary btn-lg" type="submit" id="pk-go">Book pickup</button>
      </form>
      <section class="card"><div class="card-head"><h2>Your pickups</h2></div><div id="pk-list" class="list"><p class="muted">Loading…</p></div></section>
    </div>`;
  const loadSlots = async () => {
    $('#pk-slots').innerHTML = '<p class="muted">Checking routes…</p>';
    const { slots } = await get(`/api/pickups/slots?date=${date}&lat=${S.loc.lat}&lng=${S.loc.lng}`);
    if (!slots.some((s) => s.slot === slot)) slot = (slots.find((s) => s.greenRoute && !s.full) || slots[0]).slot;
    $('#pk-slots').innerHTML = slots.map((s) => `<button type="button" class="slot" data-slot="${s.slot}" aria-pressed="${s.slot === slot}" ${s.full ? 'disabled' : ''} data-green="${s.greenRoute}"><b>${s.slot}</b>${s.greenRoute ? `<span class="green">${icon('leaf')}Green Route +25</span>` : `<small>${s.booked ? `${s.booked} nearby` : 'Standard'}</small>`}</button>`).join('');
  };
  const loadList = async () => {
    const { pickups: list } = await get('/api/pickups/mine');
    $('#pk-list').innerHTML = list.length ? list.map((p) => `<div class="list-item"><span class="badge-ico">${icon(p.status === 'completed' ? 'check' : 'truck')}</span>
      <span style="min-width:0"><div class="t">${new Date(p.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${p.slot}</div>
      <div class="s">${esc(p.address || 'Pinned location')} · code <b class="mono">${p.code}</b>${p.greenRoute ? ' · <span style="color:var(--ok)">Green Route</span>' : ''}</div></span>
      <span class="row" style="gap:6px">${p.status === 'scheduled' ? `<button class="btn btn-sm" data-track="${p.id}">Track</button><button class="btn btn-sm btn-ghost" data-cancel="${p.id}" aria-label="Cancel pickup">${icon('x')}</button>` : `<span class="pill ${p.status === 'completed' ? 'ok' : ''}">${p.status === 'completed' ? 'Done' : 'Cancelled'}</span>`}</span></div>`).join('')
      : `<div class="empty"><span>No pickups yet. Your first booking earns 10 coins, or 35 on a Green Route.</span></div>`;
    $('#pk-list')._data = list;
  };
  host.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-date],[data-slot],[data-pm],[data-track],[data-cancel]'); if (!t) return;
    if (t.dataset.date) { date = t.dataset.date; $$('[data-date]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.date === date))); loadSlots(); }
    else if (t.dataset.slot) { slot = t.dataset.slot; $$('[data-slot]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.slot === slot))); }
    else if (t.dataset.pm) { mats.has(t.dataset.pm) ? mats.delete(t.dataset.pm) : mats.add(t.dataset.pm); t.setAttribute('aria-pressed', String(mats.has(t.dataset.pm))); }
    else if (t.dataset.track) trackPickup($('#pk-list')._data.find((p) => p.id === t.dataset.track), loadList);
    else if (t.dataset.cancel) { await patch(`/api/pickups/${t.dataset.cancel}`, { status: 'cancelled' }).catch((er) => toast(er.message, 'err')); toast('Pickup cancelled'); loadList(); }
  });
  $('#pk-loc').onclick = async () => { const l = await locate(true); toast(l.approx ? 'Location permission was not given. Using an approximate location.' : 'Location set', l.approx ? 'err' : 'ok'); loadSlots(); };
  $('#pk').onsubmit = async (e) => {
    e.preventDefault(); const btn = $('#pk-go'); if (!slot) return toast('Pick a time slot.', 'err');
    setBusy(btn, true, 'Booking');
    const green = $(`[data-slot="${slot}"]`)?.dataset.green === 'true';
    try {
      const { pickup } = await post('/api/pickups', { date, slot, lat: S.loc.lat, lng: S.loc.lng, address: $('#pk-addr').value, materials: [...mats], estKg: +$('#pk-kg').value, greenRoute: green });
      toast(green ? 'Booked on a Green Route. +35 EcoCoins' : 'Pickup booked. +10 EcoCoins', 'ok');
      sheet({ title: 'Pickup booked', body: `<div class="stack" style="justify-items:start"><p class="muted">${new Date(pickup.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, ${pickup.slot}</p><div><div class="muted" style="font-size:13px">Pickup code · tell this to the collector</div><div class="code-big">${pickup.code}</div></div><button class="btn btn-primary" data-close>Done</button></div>` });
      loadList(); refreshMe().then(() => renderShell('pickups'));
    } catch (er) { toast(er.message, 'err'); } finally { setBusy(btn, false); }
  };
  await Promise.all([loadSlots(), loadList()]);
}
function trackPickup(p, after) {
  let timer, map;
  sheet({
    title: 'Live pickup tracking', sub: `${p.slot} · code <b class="mono">${p.code}</b>`, wide: true,
    body: `<div class="map" id="trk" style="height:340px"></div><div class="row" style="justify-content:space-between"><div><div class="muted" style="font-size:13px">Collector arriving in</div><div class="price" id="trk-eta">—</div></div><button class="btn" id="trk-done">${icon('check')}Mark as collected</button></div><p class="faint" style="font-size:12.5px">Route preview: the van position is simulated until a collector app is connected.</p>`,
    onMount(el, close) {
      const L = window.L, me = [p.lat || S.loc.lat, p.lng || S.loc.lng];
      map = L.map($('#trk', el), { zoomControl: false, attributionControl: true }).setView(me, 15);
      tiles(map);
      L.marker(me, { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18] }) }).addTo(map);
      const start = [me[0] + 0.012, me[1] - 0.014], path = [start, [me[0] + 0.012, me[1] - 0.004], [me[0] + 0.004, me[1] - 0.004], [me[0] + 0.004, me[1]], me];
      L.polyline(path, { color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3ee0a8', weight: 5, opacity: .8, dashArray: '2 10', lineCap: 'round' }).addTo(map);
      const truck = L.marker(start, { icon: L.divIcon({ className: '', html: `<div class="truck">${icon('truck')}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(map);
      map.fitBounds(path, { padding: [30, 30] });
      let k = 0; const N = 240;
      const seg = (f) => { const tot = path.length - 1, x = f * tot, i = Math.min(tot - 1, Math.floor(x)), r = x - i; return [path[i][0] + (path[i + 1][0] - path[i][0]) * r, path[i][1] + (path[i + 1][1] - path[i][1]) * r]; };
      timer = setInterval(() => { k = Math.min(N, k + 1); truck.setLatLng(seg(k / N)); const mins = Math.ceil((1 - k / N) * 18); $('#trk-eta', el).textContent = k >= N ? 'Arrived' : `${mins} min`; if (k >= N) clearInterval(timer); }, 120);
      $('#trk-done', el).onclick = async () => { try { await patch(`/api/pickups/${p.id}`, { status: 'completed' }); toast('Pickup completed. Coins added to your wallet.', 'ok'); close(); after(); refreshMe().then(() => renderShell('pickups')); } catch (e) { toast(e.message, 'err'); } };
    },
    onClose() { clearInterval(timer); map?.remove(); },
  });
}
export function tiles(map) {
  const L = window.L; const dark = getComputedStyle(document.documentElement).colorScheme.includes('dark');
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`, { maxZoom: 19, subdomains: 'abcd', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © CARTO' }).addTo(map);
}

// =============== Wallet ===============
export async function wallet(host) {
  if (!requireAuth()) return;
  const { wallet: w, rewards } = await get('/api/wallet'); S.wallet = w;
  const t = tier(w.coins);
  host.innerHTML = `${modeBanner()}<div class="page-head"><div><h1>EcoCoins</h1><p>Earn coins for every listing, sale, pickup and litter report. Spend them on rewards that do good.</p></div></div>
    <div class="grid-2" style="align-items:start">
      <div class="stack">
        <div class="balance"><span class="muted">Balance</span><b>${w.coins.toLocaleString('en-IN')}</b><span class="muted">${t.name}${t.next ? ` · ${t.need} more to ${t.next}` : ''}</span><div class="bar" style="margin-top:12px"><i style="width:${t.pct}%"></i></div></div>
        <div class="kv" style="margin-top:0"><div><b>${(+w.kg).toFixed(1)}</b><span>kg recycled</span></div><div><b>${(+w.co2).toFixed(1)}</b><span>kg CO₂ avoided</span></div><div><b>${Math.round(w.co2 / 0.12)}</b><span>car-km avoided</span></div></div>
        <section class="card"><div class="card-head"><h2>How to earn</h2></div><div class="list">
          ${[['List scrap', 5], ['Book a pickup', 10], ['Green Route slot', 25], ['Report a litter spot', 15], ['Clean a reported spot', 40], ['Sell scrap (per kg)', 10]].map(([a, c]) => `<div class="list-item" style="grid-template-columns:1fr auto"><span>${a}</span><span class="pill coin">+${c}</span></div>`).join('')}
        </div></section>
      </div>
      <div class="stack">
        <section class="card"><div class="card-head"><h2>Rewards</h2></div><div class="rewards">${rewards.map((r) => `<div class="reward"><div><b>${esc(r.title)}</b><div class="faint" style="font-size:12.5px;margin-top:4px">${r.kind === 'impact' ? 'Community impact' : r.kind === 'voucher' ? 'Voucher code' : 'Delivered to you'}</div></div><div class="row" style="justify-content:space-between"><span class="pill coin">${r.cost}</span><button class="btn btn-sm ${w.coins >= r.cost ? 'btn-primary' : ''}" data-redeem="${r.id}" ${w.coins >= r.cost ? '' : 'disabled'}>Redeem</button></div></div>`).join('')}</div></section>
        <section class="card"><div class="card-head"><h2>History</h2></div><div class="list">${w.txns.slice(0, 20).map((x) => `<div class="list-item" style="grid-template-columns:1fr auto"><span style="min-width:0"><div class="t" style="font-weight:500">${esc(x.note)}</div><div class="s">${when(x.at)}</div></span><span class="num" style="color:${x.coins >= 0 ? 'var(--ok)' : 'var(--danger)'};font-weight:600">${x.coins >= 0 ? '+' : ''}${x.coins}</span></div>`).join('')}</div></section>
      </div>
    </div>`;
  host.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-redeem]'); if (!b) return;
    setBusy(b, true);
    try { const r = await post('/api/rewards/redeem', { id: b.dataset.redeem }); sheet({ title: 'Reward redeemed', body: `<div class="stack" style="justify-items:start"><p class="muted">Show or enter this code to claim it.</p><div class="code-big" style="font-size:26px">${r.code}</div><button class="btn btn-primary" data-close>Done</button></div>`, onClose: () => route() }); refreshMe().then(() => renderShell('wallet')); }
    catch (er) { setBusy(b, false); toast(er.message, 'err'); }
  });
}

// =============== Ward Wars ===============
export async function board(host) {
  const { wards, people } = await get('/api/leaderboard');
  const max = Math.max(...wards.map((w) => w.kg), 1);
  host.innerHTML = `<div class="page-head"><div><h1>Ward Wars</h1><p>Kilos recycled this month, by ward. Every pickup in your ward moves it up.</p></div></div>
    <div class="grid-2" style="align-items:start">
      <section class="card"><div class="card-head"><h2>Wards</h2><span class="pill">October</span></div>${wards.map((w, i) => `<div class="board-row"><b class="num" style="color:${i === 0 ? 'var(--kraft)' : 'var(--muted)'}">${i + 1}</b><div style="min-width:0"><div class="row" style="justify-content:space-between"><span>${esc(w.ward)}</span><span class="num muted">${w.kg} kg</span></div><div class="bar"><i style="width:${(w.kg / max) * 100}%"></i></div></div><span></span></div>`).join('')}<p class="faint" style="font-size:12px;margin-top:10px">Ward totals include sample figures for the demo.</p></section>
      <section class="card"><div class="card-head"><h2>Top recyclers</h2></div>${people.map((p, i) => `<div class="board-row"><b class="num muted">${i + 1}</b><div><div>${esc(p.name)}</div><div class="faint" style="font-size:12.5px">${esc(p.ward)} · ${p.kg} kg</div></div><span class="pill coin">${p.coins}</span></div>`).join('')}</section>
    </div>`;
}

// =============== Profile ===============
export async function profile(host) {
  const u = S.user, c = S.config || {};
  const theme = store.get('theme') || 'system';
  host.innerHTML = `<div class="page-head"><div><h1>${u ? 'Profile & settings' : 'Settings'}</h1><p>${u ? esc(u.email) : 'Sign in to save your activity.'}</p></div></div>
    <div class="grid-2" style="align-items:start">
      <div class="stack">
        ${u ? `<form class="card stack" id="pf"><h2>Profile</h2>
          <label class="field"><span>Name</span><input class="input" id="pf-name" value="${esc(u.name)}"></label>
          <label class="field"><span>Ward</span><input class="input" id="pf-ward" value="${esc(u.ward || '')}" placeholder="Ward 12"></label>
          <div class="field"><span>Mode</span><div class="role-switch"><button type="button" data-r="seller" aria-pressed="${u.role === 'seller'}">Seller</button><button type="button" data-r="buyer" aria-pressed="${u.role === 'buyer'}">Buyer</button></div></div>
          <button class="btn btn-primary" type="submit">Save</button></form>` : `<div class="card stack"><h2>Account</h2><button class="btn btn-primary" id="pf-si">Sign in</button></div>`}
        <section class="card stack"><h2>Appearance</h2><div class="seg" role="group" aria-label="Theme">${['system', 'dark', 'light'].map((t) => `<button type="button" data-theme-set="${t}" aria-pressed="${theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></section>
        ${u ? `<button class="btn btn-ghost" id="pf-out">${icon('logout')}Sign out</button>` : ''}
      </div>
      <div class="stack">
        <section class="card stack"><h2>Android app</h2><p class="muted">Install EcoSync on your phone. It opens to the AI scanner and uses your camera and GPS.</p>
          <a class="btn btn-primary" href="${BASE}/download/android" ${backend === 'preview' ? 'data-preview-apk' : ''}>${icon('download')}Download APK</a></section>
        <section class="card stack"><h2>Services</h2><div class="list">
          ${[['Sign-in', c.auth === 'firebase' ? 'Firebase (Google + email)' : c.auth === 'email' ? 'Email code' : 'Demo codes on screen', c.auth !== 'demo'], ['AI', c.ai === 'gemini' ? `Gemini · ${c.models?.text}` : 'Sample answers', c.ai === 'gemini'], ['Payments', c.payments === 'razorpay' ? 'Razorpay' : 'Test mode', c.payments === 'razorpay'], ['Data', backend === 'preview' ? 'This browser only (preview)' : 'EcoSync server', backend !== 'preview'], ['Maps', 'OpenStreetMap · OpenFreeMap 3D', true]]
            .map(([k, v, ok]) => `<div class="list-item" style="grid-template-columns:1fr auto"><span><div class="t" style="font-weight:500">${k}</div><div class="s">${esc(v)}</div></span><span class="pill ${ok ? 'ok' : 'warn'}">${ok ? 'Live' : 'Demo'}</span></div>`).join('')}
        </div></section>
        <form class="card stack" id="pf-api"><h2>Server address</h2><p class="muted" style="font-size:13.5px">Leave empty to use this site. Set it when the app runs somewhere else, such as the Android app.</p>
          <input class="input mono" id="pf-api-url" placeholder="https://ecosync.onrender.com" value="${esc(BASE)}"><button class="btn" type="submit">Save and reload</button></form>
      </div>
    </div>`;
  $$('[data-theme-set]', host).forEach((b) => b.addEventListener('click', () => { const t = b.dataset.themeSet; t === 'system' ? store.del('theme') : store.set('theme', t); applyTheme(t, true); $$('[data-theme-set]', host).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  $('#pf-si', host)?.addEventListener('click', () => requireAuth());
  $('#pf-out', host)?.addEventListener('click', () => window.dispatchEvent(new Event('ecosync:signout')));
  $('[data-preview-apk]', host)?.addEventListener('click', (e) => { e.preventDefault(); toast('The APK downloads from the deployed site.'); });
  $$('[data-r]', host).forEach((b) => b.addEventListener('click', () => setRole(b.dataset.r)));
  $('#pf', host)?.addEventListener('submit', async (e) => { e.preventDefault(); try { const r = await patch('/api/me', { name: $('#pf-name').value, ward: $('#pf-ward').value }); S.user = r.user; store.set('user', r.user); toast('Saved', 'ok'); renderShell('profile'); } catch (er) { toast(er.message, 'err'); } });
  $('#pf-api', host).addEventListener('submit', (e) => { e.preventDefault(); setBase($('#pf-api-url').value.trim()); location.reload(); });
}
