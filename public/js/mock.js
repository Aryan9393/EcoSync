// In-browser backend for static previews (no server). Mirrors server.js routes.
// Data is stored in this browser's localStorage only and starts empty.
const PRICES = {
  paper: { label: 'Newspaper & paper', rate: 14, color: '#c8a46a' }, cardboard: { label: 'Cardboard', rate: 10, color: '#a87d4f' },
  pet: { label: 'PET bottles (1)', rate: 22, color: '#38bdf8' }, hdpe: { label: 'HDPE plastic (2)', rate: 26, color: '#60a5fa' },
  ldpe: { label: 'LDPE film (4)', rate: 8, color: '#93c5fd' }, pp: { label: 'PP plastic (5)', rate: 18, color: '#818cf8' },
  ps: { label: 'Polystyrene (6)', rate: 4, color: '#a5b4fc' }, mixed_plastic: { label: 'Mixed plastic', rate: 9, color: '#7dd3fc' },
  aluminium: { label: 'Aluminium cans', rate: 110, color: '#cbd5e1' }, steel: { label: 'Iron & steel', rate: 32, color: '#94a3b8' },
  copper: { label: 'Copper wire', rate: 560, color: '#f59e0b' }, glass: { label: 'Glass bottles', rate: 3, color: '#34d399' },
  e_waste: { label: 'E-waste', rate: 45, color: '#f472b6' }, battery: { label: 'Batteries', rate: 0, color: '#ef4444' },
  textile: { label: 'Old clothes', rate: 8, color: '#c084fc' }, organic: { label: 'Organic / food', rate: 0, color: '#84cc16' },
  other: { label: 'Other', rate: 2, color: '#a1a1aa' },
};
const CO2 = { paper: 0.9, cardboard: 0.9, pet: 1.5, hdpe: 1.4, ldpe: 1.1, pp: 1.3, ps: 1, mixed_plastic: 1, aluminium: 9.1, steel: 1.8, copper: 3.5, glass: 0.3, e_waste: 2, battery: 1, textile: 3.2, organic: 0.2, other: 0.3 };
const KEY = 'ecosync.preview.v2';
let db; try { db = JSON.parse(localStorage.getItem(KEY)); } catch {}
db ||= { users: [], txns: [], listings: [], passports: {}, pickups: [], reports: [] };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
const rid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const pidGen = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', p = () => Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join(''); return `ES-${p()}-${p()}`; };
const err = (status, error) => ({ __status: status, error });
const km = (a, b) => { const R = 6371, r = (d) => d * Math.PI / 180, h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const mkey = (m) => (PRICES[String(m || '').toLowerCase()] ? String(m).toLowerCase() : 'other');
const short = (n = '') => { const [f, l] = n.trim().split(/\s+/); return l ? `${f} ${l[0]}.` : f || 'Member'; };
const hash = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ecosync:' + s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const uview = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, ward: u.ward, upi: u.upi, joined: u.at });
const award = (u, coins, note, kg = 0, co2 = 0) => { db.txns.unshift({ id: rid('tx'), user: u.id, coins, note, at: Date.now() }); u.coins += coins; u.kg += kg; u.co2 += co2; };
const wallet = (u) => ({ coins: u.coins, kg: +u.kg.toFixed(2), co2: +u.co2.toFixed(2), txns: db.txns.filter((t) => t.user === u.id).slice(0, 60) });
const byId = (id) => db.users.find((u) => u.id === id);
const lview = (l, here) => ({ ...l, seller: { name: short(byId(l.sellerId)?.name), hasUpi: !!byId(l.sellerId)?.upi }, distanceKm: here ? +km(here, l).toFixed(1) : null });
const pview = (p, v) => { const role = v === p.sellerId ? 'seller' : v === p.buyerId ? 'buyer' : 'public'; const { handshake, sellerId, buyerId, ...rest } = p; return { ...rest, role, sellerName: short(byId(sellerId)?.name), buyerName: short(byId(buyerId)?.name), handshake: role === 'seller' ? handshake : undefined, sellerUpi: role === 'buyer' ? byId(sellerId)?.upi : undefined, payRef: role !== 'public' ? p.payRef : undefined }; };
const SLOTS = ['08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00', '18:00–20:00'];
const REWARDS = [{ id: 'tree', title: 'Plant a sapling in your ward', cost: 300, kind: 'Community impact' }, { id: 'school', title: 'Donate to a school eco-club', cost: 200, kind: 'Community impact' }, { id: 'bag', title: 'Jute tote bag', cost: 180, kind: 'Delivered to you' }, { id: 'books', title: 'Recycled-paper notebook set', cost: 250, kind: 'Delivered to you' }, { id: 'metro', title: '₹50 metro card top-up', cost: 500, kind: 'Voucher code' }, { id: 'data', title: '1 GB mobile data pack', cost: 400, kind: 'Voucher code' }];
const KB = [[/batter/i, 'Batteries never go in household bins. Tape the ends and drop them at an e-waste point or a battery shop that takes old ones back.'], [/e-?waste|phone|laptop|charger|wire/i, 'Electronics are e-waste. Wipe your data and give them to an authorised e-waste collector. Copper wire alone sells for ₹500–600/kg.'], [/rate|price|kitna|bhav|worth/i, 'Typical rates (₹/kg): newspaper 12–15, cardboard 8–11, PET bottles 18–25, HDPE 22–28, aluminium cans 100–120, iron 28–35, copper 500–600.'], [/compost|wet|food|kitchen/i, 'Mix kitchen scraps with dry leaves 1:2, keep it moist and turn it weekly. Compost is ready in 6–8 weeks.'], [/plastic|bag|polythene|bottle/i, 'Check the number in the recycling triangle: 1 (PET) and 2 (HDPE) are worth the most. Rinse, remove caps and crush flat. Thin bags go to a dry-waste collector.'], [/paper|akhbaar|news/i, 'Keep paper dry, remove plastic covers and tie it in 5 kg bundles. Oily paper goes in the wet bin.']];
const UP = { pet: [['Self-watering herb planter', '25 min', ['Cut the bottle two-thirds up', 'Invert the top into the base with a cotton wick', 'Plant coriander or mint']], ['Bird feeder', '20 min', ['Make two holes near the base', 'Push a wooden spoon through', 'Fill with grains and hang it']], ['Vertical garden pocket', '30 min', ['Cut a window in the side', 'Hang from a balcony grill', 'Plant succulents']]], other: [['Desk organiser', '30 min', ['Clean and dry the item', 'Cut it to size', 'Decorate with paint or tape']], ['Planter', '20 min', ['Poke drainage holes', 'Fill with soil and a seedling', 'Keep in indirect sunlight']], ['Gift wrap', '10 min', ['Pick a clean piece', 'Fold it neatly', 'Seal with a sticker']]] };

export async function mock(method, path, body = {}, token) {
  const [p, qs] = path.split('?'); const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const me = token ? db.users.find((u) => 'local.' + u.id === token) : null;
  const need = () => (me ? null : err(401, 'Sign in to continue.'));
  const here = q.lat ? { lat: +q.lat, lng: +q.lng } : null;
  let m; const R = (re) => (m = p.match(re));
  const done = (x) => { save(); return x; };

  if (p === '/api/config') return { app: 'EcoSync', version: '2.0.0', db: 'browser', ai: 'device', model: 'MobileNet (on-device)', prices: PRICES, mapStyle: 'https://tiles.openfreemap.org/styles/liberty', preview: true };
  if (p === '/api/auth/signup') {
    const email = (body.email || '').trim().toLowerCase();
    if (!body.name?.trim()) return err(400, 'Add your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return err(400, 'Enter a valid email address.');
    if ((body.password || '').length < 8) return err(400, 'Use a password with at least 8 characters.');
    if (db.users.some((u) => u.email === email)) return err(409, 'That email already has an account. Sign in instead.');
    const u = { id: rid('u'), email, name: body.name.trim(), role: body.role === 'buyer' ? 'buyer' : 'seller', ward: body.ward || '', upi: '', pass: await hash(body.password), coins: 0, kg: 0, co2: 0, at: Date.now() };
    db.users.push(u); award(u, 50, 'Welcome to EcoSync'); return done({ token: 'local.' + u.id, user: uview(u) });
  }
  if (p === '/api/auth/signin') { const u = db.users.find((x) => x.email === (body.email || '').trim().toLowerCase()); if (!u || u.pass !== await hash(body.password || '')) return err(401, 'Email or password is wrong.'); return { token: 'local.' + u.id, user: uview(u) }; }
  if (p === '/api/me') {
    if (need()) return need();
    if (method === 'PATCH') { if (body.upi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(body.upi)) return err(400, 'UPI IDs look like name@okaxis.'); ['name', 'ward', 'role', 'upi'].forEach((k) => { if (body[k] != null && (k !== 'name' || body[k])) me[k] = body[k]; }); save(); }
    return { user: uview(me), wallet: wallet(me) };
  }
  if (p === '/api/ai/scan') return err(404, 'Use on-device scanning.');
  if (p === '/api/ai/chat') { const t = body.messages?.at(-1)?.text || ''; const hit = KB.find(([re]) => re.test(t)); return { text: hit ? hit[1] : 'I can help with sorting rules, scrap prices, e-waste and composting. Try "Where do old batteries go?" or "Akhbaar ka rate kya hai?"' }; }
  if (p === '/api/ai/parse-listing') { const t = body.text || ''; const kgv = +(t.match(/(\d+(?:\.\d+)?)\s*(kg|kilo)/i) || [])[1] || 2; const mm = [[/akhbaar|news|paper/i, 'paper'], [/gatta|carton|box/i, 'cardboard'], [/bottle|botal/i, 'pet'], [/can|alumin/i, 'aluminium'], [/loha|iron|steel/i, 'steel'], [/copper|tamba/i, 'copper'], [/kapde|clothes/i, 'textile'], [/phone|laptop/i, 'e_waste']].find(([re]) => re.test(t)); return { title: t.slice(0, 60), material: mm ? mm[1] : 'other', kg: kgv, notes: '' }; }
  if (R(/^\/api\/upcycle\/(.+)$/)) return { ideas: (UP[m[1]] || UP.other).map(([title, time, steps]) => ({ title, time, steps })) };
  if (p === '/api/hubs') return { source: 'OpenStreetMap', unavailable: true, hubs: [] };
  if (p === '/api/listings' && method === 'GET') {
    if (q.mine && !me) return err(401, 'Sign in to continue.');
    let items = db.listings.filter((l) => (q.mine ? (l.sellerId === me.id || l.buyerId === me.id) && l.status !== 'removed' : l.status === 'open'));
    if (q.material) items = items.filter((l) => l.material === q.material);
    items = items.map((l) => lview(l, here)); if (here && !q.mine) items.sort((a, b) => a.distanceKm - b.distanceKm);
    return { listings: items };
  }
  if (p === '/api/listings' && method === 'POST') {
    if (need()) return need(); const material = mkey(body.material), kgv = Math.max(0.1, +body.kg || 1);
    const l = { id: rid('l'), title: body.title || `${PRICES[material].label} · ${kgv} kg`, material, kg: kgv, price: Math.round(body.price ?? PRICES[material].rate * kgv), lat: +body.lat, lng: +body.lng, area: body.area || '', notes: body.notes || '', photo: body.photo || null, sellerId: me.id, status: 'open', createdAt: Date.now() };
    db.listings.unshift(l); award(me, 5, 'Listed scrap'); return done({ listing: lview(l) });
  }
  if (R(/^\/api\/listings\/(.+)$/)) { const l = db.listings.find((x) => x.id === m[1] && x.sellerId === me?.id); if (!l) return err(404, 'Listing not found.'); if (body.status === 'removed' && l.status === 'open') l.status = 'removed'; return done({ ok: true }); }
  if (p === '/api/orders') {
    if (need()) return need(); const l = db.listings.find((x) => x.id === body.listingId);
    if (!l || l.status !== 'open') return err(400, 'This listing is no longer available.'); if (l.sellerId === me.id) return err(400, 'You can\'t buy your own listing.');
    const seller = byId(l.sellerId), method2 = body.method === 'upi' && seller.upi ? 'upi' : 'cash', id = pidGen();
    db.passports[id] = { id, listingId: l.id, title: l.title, material: l.material, kg: l.kg, amount: l.price, co2: +(l.kg * (CO2[l.material] ?? 0.5)).toFixed(2), sellerId: l.sellerId, buyerId: me.id, payMethod: method2, payRef: body.ref || '', payConfirmed: false, handshake: String(Math.floor(100000 + Math.random() * 900000)), status: 'awaiting_pickup', createdAt: Date.now(),
      events: [{ stage: 'listed', at: l.createdAt, note: 'Listed for collection' }, { stage: 'reserved', at: Date.now(), note: method2 === 'upi' ? `₹${l.price} paid by UPI to the seller` : `₹${l.price} to be paid in cash at pickup` }] };
    Object.assign(l, { status: 'reserved', buyerId: me.id, passportId: id }); award(me, 10, 'Reserved a lot'); return done({ passport: pview(db.passports[id], me.id) });
  }
  if (p === '/api/passports/mine') { if (need()) return need(); return { passports: Object.values(db.passports).filter((x) => x.sellerId === me.id || x.buyerId === me.id).sort((a, b) => b.createdAt - a.createdAt).map((x) => pview(x, me.id)) }; }
  if (R(/^\/api\/passport\/([^/]+)$/)) { const x = db.passports[m[1].toUpperCase()]; return x ? { passport: pview(x, me?.id) } : err(404, 'No passport with that ID. Check the code on the QR label.'); }
  if (R(/^\/api\/passport\/([^/]+)\/(handshake|paid|payref|event)$/)) {
    if (need()) return need(); const x = db.passports[m[1].toUpperCase()]; if (!x) return err(404, 'Passport not found.');
    if (m[2] === 'handshake') {
      if (x.buyerId !== me.id) return err(403, 'Only the buyer can confirm this pickup.');
      if (x.status === 'awaiting_pickup') { if (String(body.code) !== x.handshake) return err(400, 'That code doesn\'t match. Ask the seller to show their QR again.'); x.status = 'collected'; x.events.push({ stage: 'picked', at: Date.now(), note: 'Handed over · confirmed by QR handshake' }); const l = db.listings.find((y) => y.id === x.listingId); if (l) l.status = 'sold'; award(byId(x.sellerId), Math.round(x.kg * 10) + 20, `Sold ${x.title}`, x.kg, x.co2); award(me, 15, `Collected ${x.title}`); }
    } else if (m[2] === 'paid') { if (x.sellerId !== me.id) return err(404, 'Passport not found.'); x.payConfirmed = true; }
    else if (m[2] === 'payref') { if (x.buyerId !== me.id) return err(404, 'Passport not found.'); x.payRef = body.ref || ''; }
    else { if (x.buyerId !== me.id || x.status === 'awaiting_pickup') return err(400, 'Confirm the pickup first.'); x.events.push({ stage: body.stage, at: Date.now(), note: body.note || { hub: 'Delivered to a recycling hub', processed: 'Sorted, baled and weighed', reborn: 'Made into something new' }[body.stage] }); if (body.stage === 'reborn') x.status = 'reborn'; }
    return done({ passport: pview(x, me.id) });
  }
  if (p === '/api/pickups/slots') { const c = here || { lat: 28.61, lng: 77.2 }; return { slots: SLOTS.map((s) => { const n = db.pickups.filter((x) => x.date === q.date && x.slot === s && x.status !== 'cancelled' && km(c, x) < 2.5).length; return { slot: s, nearby: n, greenRoute: n > 0, full: n >= 12 }; }) }; }
  if (p === '/api/pickups' && method === 'POST') { if (need()) return need(); if (!SLOTS.includes(body.slot) || !body.date) return err(400, 'Pick a day and a time slot.'); const n = db.pickups.filter((x) => x.date === body.date && x.slot === body.slot && x.status !== 'cancelled' && x.user !== me.id && km(body, x) < 2.5).length; const x = { id: rid('pk'), user: me.id, date: body.date, slot: body.slot, lat: body.lat, lng: body.lng, address: body.address || '', materials: body.materials || [], estKg: +body.estKg || 2, greenRoute: n > 0, status: 'scheduled', code: String(Math.floor(1000 + Math.random() * 9000)), createdAt: Date.now() }; db.pickups.unshift(x); award(me, n > 0 ? 35 : 10, n > 0 ? 'Pickup booked on a Green Route' : 'Pickup booked'); return done({ pickup: x }); }
  if (p === '/api/pickups/mine') { if (need()) return need(); return { pickups: db.pickups.filter((x) => x.user === me.id) }; }
  if (R(/^\/api\/pickups\/(.+)$/)) { const x = db.pickups.find((y) => y.id === m[1] && y.user === me?.id); if (!x) return err(404, 'Pickup not found.'); if (x.status === 'scheduled' && ['cancelled', 'completed'].includes(body.status)) { x.status = body.status; if (body.status === 'completed') award(me, Math.round(x.estKg * 8), 'Pickup completed', x.estKg, +(x.estKg * 1.2).toFixed(2)); } return done({ pickup: x }); }
  if (p === '/api/reports' && method === 'GET') { const c = here || { lat: 28.61, lng: 77.2 }; return { reports: db.reports.filter((r) => km(c, r) < 25) }; }
  if (p === '/api/reports' && method === 'POST') { if (need()) return need(); const r = { id: rid('r'), lat: +body.lat, lng: +body.lng, severity: +body.severity || 2, type: body.type || 'mixed', note: body.note || '', confirms: 1, status: 'open', at: Date.now() }; db.reports.unshift(r); award(me, 15, 'Reported a litter spot'); return done({ report: r }); }
  if (R(/^\/api\/reports\/([^/]+)\/(confirm|clean)$/)) { if (need()) return need(); const r = db.reports.find((x) => x.id === m[1]); if (!r) return err(404, 'Report not found.'); if (m[2] === 'confirm') { r.confirms++; award(me, 2, 'Confirmed a litter spot'); } else if (r.status === 'open') { r.status = 'cleaned'; award(me, 40, 'Cleaned a litter spot'); } return done({ report: r }); }
  if (p === '/api/wallet') { if (need()) return need(); return { wallet: wallet(me), rewards: REWARDS }; }
  if (p === '/api/rewards/redeem') { if (need()) return need(); const r = REWARDS.find((x) => x.id === body.id); if (me.coins < r.cost) return err(400, 'You don\'t have enough EcoCoins for this yet.'); me.coins -= r.cost; db.txns.unshift({ id: rid('tx'), user: me.id, coins: -r.cost, note: `Redeemed: ${r.title}`, at: Date.now() }); return done({ wallet: wallet(me), code: 'ECO-' + Math.random().toString(16).slice(2, 8).toUpperCase() }); }
  if (p === '/api/leaderboard') { const w = {}; db.users.filter((u) => u.ward).forEach((u) => { w[u.ward] ||= { ward: u.ward, kg: 0, members: 0 }; w[u.ward].kg += u.kg; w[u.ward].members++; }); return { wards: Object.values(w).sort((a, b) => b.kg - a.kg), people: [...db.users].sort((a, b) => b.coins - a.coins).slice(0, 10).map((u) => ({ name: short(u.name), ward: u.ward, kg: +u.kg.toFixed(1), coins: u.coins })) }; }
  if (p === '/api/stats') return { members: db.users.length, kg: Object.values(db.passports).filter((x) => x.status !== 'awaiting_pickup').reduce((s, x) => s + x.kg, 0), passports: Object.keys(db.passports).length, open: db.listings.filter((l) => l.status === 'open').length };
  return err(404, 'Not available in preview.');
}
