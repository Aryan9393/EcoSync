// Cream "live interface" mockups of EcoSync screens, used on the landing page and in the tour.
import { icon } from './icons.js';
import { qrSvg } from './ui.js';

const SIDE = [['overview', 'Overview', 'home'], ['scan', 'Scanner', 'scan'], ['market', 'Market', 'market'], ['pickup', 'Pickups', 'truck'], ['passport', 'Passports', 'qr'], ['map', 'Maps', 'map'], ['coins', 'EcoCoins', 'coin']];
const URL = { overview: 'ecosync.app/home', scan: 'ecosync.app/scan', market: 'ecosync.app/market', pickup: 'ecosync.app/pickups', passport: 'ecosync.app/passport/ES-7K2P-QX9M', map: 'ecosync.app/map', coins: 'ecosync.app/coins', chat: 'ecosync.app/ecobot' };

const C = {
  overview: (who) => `<div class="h"><div><b>${who === 'collector' ? 'Collections' : 'Overview'}</b><small>${who === 'collector' ? 'Lots near you, nearest first' : 'Your recycling at a glance'}</small></div><span class="live">Synced</span></div>
    <div class="mock-stats">${who === 'collector' ? '<div><b>8</b><span>Open lots nearby</span></div><div><b>2</b><span>Pickups today</span></div><div><b>46</b><span>kg this week</span></div>' : '<div><b>12.4</b><span>kg recycled</span></div><div><b>3</b><span>Pickups booked</span></div><div><b>340</b><span>EcoCoins</span></div>'}</div>
    <div class="mock-cards"><div class="mock-card"><div class="t"><span>Next pickup</span><span>Sat · 10:00</span></div><div class="mock-lines"><i></i><i></i><i class="g"></i></div></div>
    <div class="mock-card"><div class="t"><span>Passport</span><span>In transit</span></div><div class="mock-lines"><i></i><i class="g"></i><i></i></div></div></div>`,
  scan: () => `<div class="h"><div><b>AI scanner</b><small>Point at one item</small></div><span class="live">On-device</span></div>
    <div class="mock-photo"><div class="obj"></div><div class="ret"></div></div>
    <div class="row" style="gap:5px"><span class="mock-chip"><b>PET bottle</b></span><span class="mock-chip">Resin 1</span><span class="mock-chip">₹22 / kg</span><span class="mock-chip g">Recyclable</span></div>
    <div class="mock-btn"><span>List for nearby collectors</span><span>→</span></div>`,
  market: () => `<div class="h"><div><b>Nearby lots</b><small>Sorted by distance</small></div><span class="live">Live</span></div>
    ${[['#c8a46a', 'Newspapers, tied', '9 kg · 0.8 km', '₹126'], ['#38bdf8', 'Rinsed PET bottles', '3.5 kg · 1.0 km', '₹77'], ['#cbd5e1', 'Aluminium cans', '1.8 kg · 1.1 km', '₹198'], ['#f472b6', 'Old chargers & cables', '2 kg · 1.6 km', '₹90']].map(([c, t, s, p]) => `<div class="mock-row"><i class="sw" style="background:${c}"></i><div class="grow"><b>${t}</b><span>${s}</span></div><span class="pr">${p}</span><span class="buy">Buy</span></div>`).join('')}`,
  pickup: () => `<div class="h"><div><b>Book a pickup</b><small>Saturday, 11 October</small></div></div>
    <div class="mock-slots">${[['08–10', 'Standard'], ['10–12', '<span>Green Route +25</span>', 1], ['12–14', 'Standard'], ['14–16', 'Standard'], ['16–18', '<span>Green Route +25</span>', 1], ['18–20', 'Standard']].map(([t, s, g]) => `<div class="${g ? 'g' : ''}"><b>${t}</b>${s}</div>`).join('')}</div>
    <div class="mock-btn"><span>Book pickup · code 4821</span><span>→</span></div>`,
  passport: () => `<div class="h"><div><b>ES-7K2P-QX9M</b><small>Rinsed PET bottles · 3.5 kg</small></div><span class="live">Collected</span></div>
    <div class="row" style="gap:12px;align-items:flex-start;flex-wrap:nowrap"><div class="mock-qr">${qrSvg('https://ecosync.app/#/passport/ES-7K2P-QX9M')}</div>
    <div class="mock-tl grow"><div class="d"><span>Listed</span><span>09:12</span></div><div class="d"><span>Paid by UPI</span><span>09:40</span></div><div class="d"><span>Handed over · QR</span><span>11:05</span></div><div><span>At recycling hub</span><span></span></div><div><span>Made into fibre</span><span></span></div></div></div>`,
  map: () => `<div class="h"><div><b>Recycling hubs</b><small>From OpenStreetMap</small></div><span class="live">3 within 2 km</span></div>
    <div class="mock-map"><svg viewBox="0 0 300 170" preserveAspectRatio="xMidYMid slice"><g stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"><path d="M-10 120 C60 100 120 140 310 90"/><path d="M90 -10 C100 60 70 120 110 190"/><path d="M200 -10 L230 190"/></g><g stroke="#d7ddd5" stroke-width="2.5" fill="none"><path d="M-10 40 L310 55"/><path d="M40 -10 L20 190"/><path d="M260 -10 L280 190"/></g>
      <rect x="130" y="20" width="50" height="30" rx="4" fill="#d8e3d6"/><rect x="20" y="130" width="40" height="28" rx="4" fill="#d8e3d6"/>
      <g><circle cx="150" cy="95" r="7" fill="#1b1b18"/><circle cx="150" cy="95" r="15" fill="#1b1b18" opacity=".12"/></g>
      <g fill="#1d5a43"><path d="M70 70a8 8 0 1 1 16 0c0 6-8 13-8 13s-8-7-8-13z"/><path d="M215 40a8 8 0 1 1 16 0c0 6-8 13-8 13s-8-7-8-13z"/><path d="M235 120a8 8 0 1 1 16 0c0 6-8 13-8 13s-8-7-8-13z"/></g>
      <g fill="#c8a46a"><circle cx="120" cy="140" r="5"/><circle cx="190" cy="110" r="5"/></g></svg></div>`,
  coins: () => `<div class="h"><div><b>EcoCoins</b><small>Sapling · 160 to Grove</small></div></div>
    <div><b style="font:300 34px/1 Manrope,sans-serif;letter-spacing:-.04em">1,340</b></div>
    <div style="height:4px;border-radius:9px;background:#e1dfd6;overflow:hidden"><i style="display:block;height:100%;width:72%;background:var(--grad)"></i></div>
    ${[['Green Route pickup', '+35'], ['Sold 3.5 kg PET', '+55'], ['Cleaned a litter spot', '+40']].map(([a, b], i) => `<div class="mock-row"><div class="grow"><b>${a}</b></div><span class="${i === 0 ? 'mock-chip g' : 'pr'}">${b}</span></div>`).join('')}`,
  chat: () => `<div class="h"><div><b>EcoBot</b><small>Hindi · English</small></div><span class="live">Online</span></div>
    <div class="mock-bubble me">Akhbaar ka rate kya hai?</div>
    <div class="mock-bubble">Newspaper sells for ₹12–15/kg. Keep it dry and tie it in 5 kg bundles.</div>
    <div class="mock-bubble me">Purane charger kahan dein?</div>
    <div class="mock-bubble">That's e-waste. The nearest drop-off is 1.4 km away. Open Maps → E-waste.</div>`,
};

export function mockup(kind = 'overview', who = 'seller') {
  const active = kind === 'chat' ? 'overview' : kind;
  return `<div class="mock"><div class="mock-bar"><i></i><i></i><i></i><span>${URL[kind] || 'ecosync.app'}</span>${icon('lock').replace('<svg', '<svg style="width:9px;height:9px;color:#9a988f"')}</div>
    <div class="mock-body"><div class="mock-side"><div class="who"><i></i>${who === 'collector' ? 'Your yard' : 'Your home'}</div>
      ${SIDE.map(([k, l, ic]) => `<div class="it ${k === active ? 'on' : ''}">${icon(ic)}${l}</div>`).join('')}
      <div style="margin-top:18px;font-size:8.5px;color:#9a988f;padding:0 6px">${who === 'collector' ? 'Collector' : 'Seller'} view</div></div>
    <div class="mock-main">${C[kind](who)}</div></div></div>`;
}
