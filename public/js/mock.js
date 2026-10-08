// In-browser preview backend. Mirrors server.js routes so the UI runs with no server
// (static previews, offline demos). Data lives in this browser's localStorage only.
const PRICES = {
  paper: { label: 'Newspaper & paper', rate: 14, color: '#c8a46a', bin: 'Dry' }, cardboard: { label: 'Cardboard', rate: 10, color: '#a87d4f', bin: 'Dry' },
  pet: { label: 'PET bottles (1)', rate: 22, color: '#38bdf8', bin: 'Dry' }, hdpe: { label: 'HDPE plastic (2)', rate: 26, color: '#60a5fa', bin: 'Dry' },
  ldpe: { label: 'LDPE film (4)', rate: 8, color: '#93c5fd', bin: 'Dry' }, pp: { label: 'PP plastic (5)', rate: 18, color: '#818cf8', bin: 'Dry' },
  ps: { label: 'Polystyrene (6)', rate: 4, color: '#a5b4fc', bin: 'Dry' }, mixed_plastic: { label: 'Mixed plastic', rate: 9, color: '#7dd3fc', bin: 'Dry' },
  aluminium: { label: 'Aluminium cans', rate: 110, color: '#cbd5e1', bin: 'Dry' }, steel: { label: 'Iron & steel', rate: 32, color: '#94a3b8', bin: 'Dry' },
  copper: { label: 'Copper wire', rate: 560, color: '#f59e0b', bin: 'Dry' }, glass: { label: 'Glass bottles', rate: 3, color: '#34d399', bin: 'Dry' },
  e_waste: { label: 'E-waste', rate: 45, color: '#f472b6', bin: 'E-waste' }, battery: { label: 'Batteries', rate: 0, color: '#ef4444', bin: 'Hazardous' },
  textile: { label: 'Old clothes', rate: 8, color: '#c084fc', bin: 'Dry' }, organic: { label: 'Organic / food', rate: 0, color: '#84cc16', bin: 'Wet' },
  other: { label: 'Other', rate: 2, color: '#a1a1aa', bin: 'Dry' },
};
const CO2 = { paper: 0.9, cardboard: 0.9, pet: 1.5, hdpe: 1.4, ldpe: 1.1, pp: 1.3, ps: 1, mixed_plastic: 1, aluminium: 9.1, steel: 1.8, copper: 3.5, glass: 0.3, e_waste: 2, battery: 1, textile: 3.2, organic: 0.2, other: 0.3 };
const KEY = 'ecosync.preview.db';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
let db = load() || { users: [], wallets: {}, listings: [], pickups: [], reports: [], passports: {} };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
const rid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const pid = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', p = () => Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join(''); return `ES-${p()}-${p()}`; };
const err = (status, error) => ({ __status: status, error });
const hav = (a, b) => { const R = 6371, r = (d) => d * Math.PI / 180; const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const mkey = (m) => { const k = String(m || 'other').toLowerCase().replace(/\s+/g, '_'); return PRICES[k] ? k : ({ aluminum: 'aluminium', plastic: 'mixed_plastic' }[k] || 'other'); };
const wallet = (uid) => (db.wallets[uid] ||= { coins: 120, kg: 0, co2: 0, txns: [{ id: rid('tx'), at: Date.now(), type: 'bonus', coins: 120, note: 'Welcome bonus' }] });
const award = (uid, coins, note, x = {}) => { const w = wallet(uid); w.coins += coins; if (x.kg) w.kg += x.kg; if (x.co2) w.co2 += x.co2; w.txns.unshift({ id: rid('tx'), at: Date.now(), type: coins >= 0 ? 'earn' : 'spend', coins, note, ...x }); };
const pub = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role, ward: u.ward, joined: u.joined, verified: true };
const SAMPLES = [
  ['Newspapers, 3 months', 'paper', 9, 'Sunita R.', 0.006, 0.004, 'Tied in bundles, dry.'], ['Amazon cartons, flattened', 'cardboard', 6, 'Kabir S.', -0.004, 0.007, 'About 25 boxes.'],
  ['Rinsed PET bottles', 'pet', 3.5, 'Green Hostel Block B', 0.009, -0.003, 'Labels removed, caps separate.'], ['Old laptop + chargers', 'e_waste', 4, 'Meera J.', -0.008, -0.006, 'Not working. Hard disk wiped.'],
  ['Aluminium cans', 'aluminium', 1.8, 'Café Brewhouse', 0.002, -0.011, 'Crushed, collected weekly.'], ['Copper wire offcuts', 'copper', 0.7, 'Electrician Ravi', -0.012, 0.002, 'From house rewiring.'],
  ['Glass jars & bottles', 'glass', 7, 'Sharma family', 0.013, 0.01, 'Clean, no lids.'], ['Old cotton clothes', 'textile', 5, 'Ananya P.', -0.002, 0.014, 'Usable for rags or donation.'],
  ['HDPE milk & oil cans', 'hdpe', 2.4, 'Gupta Dairy', 0.015, -0.009, 'Washed.'],
];
const seedListings = (c) => SAMPLES.map(([title, material, kg, sellerName, a, b, notes], i) => ({ id: `demo_${i}`, title, material, kg, price: Math.round(PRICES[material].rate * kg), lat: c.lat + a, lng: c.lng + b, area: 'Sample listing', notes, sellerId: 'demo_seller', sellerName, status: i === 4 ? 'reserved' : 'open', createdAt: Date.now() - (i + 1) * 1.8e7, demo: true }));
const SCANS = [
  { m: /bottle|pet|water/i, item: 'PET drinking-water bottle', material: 'pet', resinCode: 1, recyclable: true, hazard: null, condition: 'needs_rinse', estWeightKg: 0.03, confidence: 0.94, steps: ['Empty and rinse the bottle', 'Remove the cap and label; caps are PP (5)', 'Crush flat to save space'], upcycle: ['Self-watering herb planter', 'Bird feeder for your balcony'], funFact: 'Five recycled PET bottles make enough fibre for one T-shirt.' },
  { m: /can|alumin/i, item: 'Aluminium soft-drink can', material: 'aluminium', resinCode: null, recyclable: true, hazard: null, condition: 'clean', estWeightKg: 0.015, confidence: 0.91, steps: ['Rinse out any sugar', 'Crush lightly, keep the tab on', 'Collect 60+ cans for one kg'], upcycle: ['Desk pen stand', 'Tea-light lantern'], funFact: 'A recycled can can be back on the shelf in about 60 days.' },
  { m: /paper|news|book/i, item: 'Newspaper bundle', material: 'paper', resinCode: null, recyclable: true, hazard: null, condition: 'clean', estWeightKg: 1.2, confidence: 0.89, steps: ['Keep it dry', 'Tie in bundles of 5 kg', 'Remove plastic inserts'], upcycle: ['Papier-mâché bowl', 'Seed-starting pots'], funFact: 'Paper fibre can be recycled 5 to 7 times.' },
  { m: /phone|laptop|charger|battery|e-?waste/i, item: 'Old mobile charger', material: 'e_waste', resinCode: null, recyclable: true, hazard: 'Contains metals; give to an authorised e-waste collector, not the dry bin.', condition: 'clean', estWeightKg: 0.12, confidence: 0.86, steps: ['Do not throw in household bins', 'Wrap loose cable ends', 'Drop at an authorised e-waste centre'], upcycle: ['Cable organiser art', 'Keep spare parts for repair cafés'], funFact: 'One tonne of phones holds more gold than one tonne of gold ore.' },
  { m: /box|carton|cardboard/i, item: 'Corrugated cardboard box', material: 'cardboard', resinCode: null, recyclable: true, hazard: null, condition: 'clean', estWeightKg: 0.4, confidence: 0.92, steps: ['Remove tape and stickers', 'Flatten the box', 'Keep away from rain'], upcycle: ['Drawer organiser', 'Cat scratch pad'], funFact: 'Recycling one tonne of cardboard saves around 17 trees.' },
];
const SLOTS = ['08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00', '18:00–20:00'];
const REWARDS = [
  { id: 'tree', title: 'Plant a sapling in your ward', cost: 300, kind: 'impact' }, { id: 'metro', title: '₹50 metro card top-up', cost: 500, kind: 'voucher' },
  { id: 'books', title: 'Recycled-paper notebook set', cost: 250, kind: 'goods' }, { id: 'bag', title: 'Jute tote bag', cost: 180, kind: 'goods' },
  { id: 'school', title: 'Donate to a school eco-club', cost: 200, kind: 'impact' }, { id: 'data', title: '1 GB mobile data pack', cost: 400, kind: 'voucher' },
];
const otps = {};
const pview = (p, v) => { const { handshake, sellerId, buyerId, ...rest } = p; return { ...rest, role: v === sellerId ? 'seller' : v === buyerId ? 'buyer' : 'public', handshake: v === sellerId ? handshake : undefined }; };
const lview = (l, here) => ({ ...l, distanceKm: here ? +hav(here, l).toFixed(1) : null, seller: { name: l.sellerName } });

export async function mock(method, path, body = {}, token) {
  const [p, qs] = path.split('?'); const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const me = token ? db.users.find((u) => 'local.' + u.id === token) : null;
  const need = () => (me ? null : err(401, 'Sign in to continue.'));
  const here = q.lat ? { lat: +q.lat, lng: +q.lng } : null;
  let m;
  const R = (re) => (m = p.match(re));

  if (method === 'GET' && p === '/api/config') return { app: 'EcoSync', version: '1.0.0', auth: 'demo', firebase: null, payments: 'demo', razorpayKeyId: null, ai: 'demo', mapStyle: 'https://tiles.openfreemap.org/styles/liberty', prices: PRICES, preview: true };
  if (p === '/api/auth/otp/request') {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email || '')) return err(400, 'Enter a valid email address.');
    const code = String(Math.floor(100000 + Math.random() * 900000)); otps[body.email.toLowerCase()] = code; return { sent: false, demoCode: code };
  }
  if (p === '/api/auth/otp/verify') {
    const email = (body.email || '').toLowerCase();
    if (otps[email] !== String(body.code)) return err(400, 'That code is not right. Check it and try again.');
    let u = db.users.find((x) => x.email === email);
    if (!u) { u = { id: rid('u'), email, name: body.name || email.split('@')[0], role: body.role === 'buyer' ? 'buyer' : 'seller', ward: 'Ward 12', joined: Date.now() }; db.users.push(u); wallet(u.id); }
    else if (body.role) u.role = body.role;
    save(); return { token: 'local.' + u.id, user: pub(u) };
  }
  if (p === '/api/me') { if (need()) return need(); if (method === 'PATCH') { Object.assign(me, { ...(body.role ? { role: body.role } : {}), ...(body.name ? { name: body.name } : {}), ...(body.ward ? { ward: body.ward } : {}) }); save(); } return { user: pub(me), wallet: wallet(me.id) }; }

  if (p === '/api/ai/scan') {
    const s = SCANS.find((x) => x.m.test(body.hint || '')) || SCANS[Math.floor(Math.random() * SCANS.length)]; const { m: _, ...r } = s; const k = r.estWeightKg;
    return { ...r, pricePerKg: PRICES[r.material].rate, estValue: Math.round(PRICES[r.material].rate * k), co2SavedKg: +(k * CO2[r.material]).toFixed(2), coins: Math.round(k * 10) + 5, demo: true };
  }
  if (p === '/api/ai/chat') {
    const t = body.messages?.at(-1)?.text || '';
    const a = /battery|e-?waste|phone|laptop/i.test(t) ? 'E-waste never goes in the dry bin. Under India\'s E-Waste Rules, hand it to an authorised recycler or a brand take-back point. Open Map and filter "E-waste" to find the nearest one.'
      : /rate|price|kitna|bhav/i.test(t) ? 'Typical rates: newspaper ₹12–15/kg, cardboard ₹8–11/kg, PET bottles ₹18–25/kg, aluminium cans ₹100–120/kg. Scan an item to see an estimate for it.'
      : /plastic|bag|polythene/i.test(t) ? 'Thin carry bags (LDPE 4) are hard to recycle. Collect them clean and dry in one bag for a dry-waste collector. Bottles marked 1 or 2 are worth the most.'
      : /compost|wet|food/i.test(t) ? 'Mix kitchen scraps with dry leaves 1:2, keep it moist and turn it weekly. You\'ll have compost in about 6 weeks.'
      : 'I can help you sort waste, check scrap rates, find a recycling hub or plan a pickup. Try "Where do I throw old batteries?" or "Akhbaar ka rate kya hai?"';
    return { text: a, demo: true };
  }
  if (p === '/api/ai/upcycle') { const i = body.item || 'bottle'; return { ideas: [{ title: `${i} desk organiser`, time: '30 min', steps: ['Clean and dry it', 'Cut to the height you need', 'Decorate with paint or tape'] }, { title: `${i} planter`, time: '20 min', steps: ['Poke drainage holes', 'Fill with soil and a seedling', 'Keep in indirect sunlight'] }, { title: `${i} lamp shade`, time: '45 min', steps: ['Cut a pattern of small holes', 'Fit around a warm LED bulb', 'Hang with fabric cord'] }], image: null, demo: true }; }
  if (p === '/api/ai/parse-listing') {
    const t = body.text || ''; const kgm = +(t.match(/(\d+(?:\.\d+)?)\s*(kg|kilo)/i) || [])[1] || 2;
    const map = [[/akhbaar|news|paper/i, 'paper'], [/gatta|carton|box/i, 'cardboard'], [/bottle|botal/i, 'pet'], [/can|alumin/i, 'aluminium'], [/loha|iron|steel/i, 'steel'], [/copper|tamba/i, 'copper'], [/kapde|clothes/i, 'textile'], [/phone|laptop/i, 'e_waste']];
    return { title: t.slice(0, 60), material: (map.find(([re]) => re.test(t)) || [, 'other'])[1], kg: kgm, notes: '', demo: true };
  }
  if (p === '/api/hubs') {
    const c = here || { lat: 28.6139, lng: 77.209 };
    const s = [['Municipal Material Recovery Facility', 'centre', 0.011, 0.006, ['paper', 'plastic', 'glass', 'cans']], ['E-waste collection point', 'centre', -0.009, 0.013, ['electrical_appliances', 'batteries', 'mobile_phones']], ['Ward dry-waste drop-off', 'container', 0.004, -0.007, ['paper', 'plastic', 'cardboard']], ['Scrap dealer (kabadi market)', 'scrap', -0.015, -0.004, ['scrap_metal', 'paper', 'plastic']], ['Waste transfer station', 'transfer', 0.019, -0.016, ['mixed']], ['Clothes donation bin', 'container', 0.007, 0.018, ['clothes', 'shoes']]];
    return { source: 'sample', sample: true, hubs: s.map(([name, kind, a, b, accepts], i) => ({ id: `sample/${i}`, name, kind, kindLabel: { centre: 'Recycling centre', transfer: 'Waste transfer station', scrap: 'Scrap yard', container: 'Recycling drop-off' }[kind], lat: c.lat + a, lng: c.lng + b, accepts, official: kind !== 'scrap', distanceKm: +hav(c, { lat: c.lat + a, lng: c.lng + b }).toFixed(2), sample: true })).sort((a, b) => a.distanceKm - b.distanceKm) };
  }
  if (p === '/api/listings' && method === 'GET') {
    let items = db.listings.filter((l) => l.status !== 'removed');
    if (here && !items.some((l) => !l.demo && hav(here, l) < 30)) items = items.concat(seedListings(here).filter((s) => !db.listings.some((l) => l.id === s.id)));
    if (q.material) items = items.filter((l) => l.material === q.material);
    if (q.mine && q.uid) items = items.filter((l) => l.sellerId === q.uid || l.buyerId === q.uid);
    items = items.map((l) => lview(l, here)); if (here) items.sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || a.distanceKm - b.distanceKm);
    return { listings: items };
  }
  if (p === '/api/listings' && method === 'POST') {
    if (need()) return need(); const material = mkey(body.material), kgv = Math.max(0.1, +body.kg || 1);
    const l = { id: rid('l'), title: body.title || `${PRICES[material].label} · ${kgv} kg`, material, kg: kgv, price: Math.round(body.price ?? PRICES[material].rate * kgv), lat: +body.lat, lng: +body.lng, area: body.area || 'Nearby', notes: body.notes || '', photo: body.photo || null, sellerId: me.id, sellerName: me.name, status: 'open', createdAt: Date.now() };
    db.listings.unshift(l); award(me.id, 5, `Listed ${l.title}`); save(); return { listing: lview(l) };
  }
  if (R(/^\/api\/listings\/(.+)$/) && method === 'PATCH') { const l = db.listings.find((x) => x.id === m[1] && x.sellerId === me?.id); if (!l) return err(404, 'Listing not found.'); if (body.status === 'removed') l.status = 'removed'; save(); return { listing: l }; }
  const resolve = (id) => { let l = db.listings.find((x) => x.id === id); if (!l && id.startsWith('demo_') && body.snapshot) { l = { ...body.snapshot, id, sellerId: 'demo_seller', status: 'open', demo: true }; db.listings.push(l); } return l; };
  if (p === '/api/pay/order') { if (need()) return need(); const l = resolve(body.listingId); if (!l || l.status !== 'open') return err(400, 'This listing is no longer available.'); if (l.sellerId === me.id) return err(400, 'You cannot buy your own listing.'); return { mode: 'demo', orderId: rid('demo_order'), amount: Math.max(100, l.price * 100), currency: 'INR', listing: l }; }
  if (p === '/api/pay/verify') {
    if (need()) return need(); const l = resolve(body.listingId); if (!l || l.status !== 'open') return err(400, 'This listing is no longer available.');
    const id = pid(), co2 = +(l.kg * (CO2[l.material] ?? 0.5)).toFixed(2);
    db.passports[id] = { id, listingId: l.id, material: l.material, kg: l.kg, title: l.title, amount: l.price, co2, sellerId: l.sellerId, buyerId: me.id, sellerName: l.sellerName, buyerName: me.name, handshake: String(Math.floor(100000 + Math.random() * 900000)), escrow: 'held', paymentRef: rid('demo_pay'), paymentMode: 'demo',
      events: [{ stage: 'listed', at: l.createdAt || Date.now() - 864e5, note: l.demo ? 'Listed by a nearby seller' : `Listed in ${l.area || 'your area'}` }, { stage: 'paid', at: Date.now(), note: `₹${l.price} paid and held safely until pickup` }] };
    l.status = 'reserved'; l.buyerId = me.id; l.passportId = id; award(me.id, 10, `Bought ${l.title}`); save();
    const out = pview(db.passports[id], me.id);
    if (l.sellerId === 'demo_seller') out.demoHandshake = db.passports[id].handshake; // preview only: lets you play the seller's side
    return { passport: out };
  }
  if (p === '/api/passports/mine') { if (need()) return need(); return { passports: Object.values(db.passports).filter((x) => x.sellerId === me.id || x.buyerId === me.id).reverse().map((x) => ({ ...pview(x, me.id), demoHandshake: x.sellerId === 'demo_seller' && x.buyerId === me.id ? x.handshake : undefined })) }; }
  if (R(/^\/api\/passport\/([^/]+)$/)) { const x = db.passports[m[1].toUpperCase()]; if (!x) return err(404, 'No passport with that ID. Check the code on the QR label.'); return { passport: { ...pview(x, me?.id), demoHandshake: x.sellerId === 'demo_seller' && x.buyerId === me?.id ? x.handshake : undefined } }; }
  if (R(/^\/api\/passport\/([^/]+)\/handshake$/)) {
    if (need()) return need(); const x = db.passports[m[1].toUpperCase()]; if (!x) return err(404, 'Passport not found.');
    if (x.buyerId !== me.id) return err(403, 'Only the buyer can confirm this pickup.');
    if (x.escrow !== 'released') { if (String(body.code) !== x.handshake) return err(400, 'That handshake code does not match. Ask the seller to show their QR again.');
      x.escrow = 'released'; x.events.push({ stage: 'picked', at: Date.now(), note: 'Pickup confirmed by QR handshake. Payment released to seller.' });
      award(me.id, 15, `Collected ${x.title}`, { kg: x.kg, co2: x.co2 }); const l = db.listings.find((y) => y.id === x.listingId); if (l) l.status = 'sold'; save(); }
    return { passport: pview(x, me.id) };
  }
  if (R(/^\/api\/passport\/([^/]+)\/event$/)) { const x = db.passports[m[1].toUpperCase()]; if (!x || x.buyerId !== me?.id) return err(403, 'Only the buyer can update this passport.'); x.events.push({ stage: body.stage, at: Date.now(), note: body.note || { hub: 'Delivered to recycling hub', processed: 'Sorted and processed', reborn: 'Turned into a new product' }[body.stage] }); save(); return { passport: pview(x, me.id) }; }
  if (p === '/api/pickups/slots') { return { slots: SLOTS.map((s, i) => { const booked = db.pickups.filter((x) => x.date === q.date && x.slot === s && x.status !== 'cancelled').length; const g = booked > 0 || ((q.date || '').charCodeAt(9) + i) % 3 === 0; return { slot: s, booked, greenRoute: g, bonus: g ? 25 : 0, full: false }; }) }; }
  if (p === '/api/pickups' && method === 'POST') { if (need()) return need(); if (!SLOTS.includes(body.slot) || !body.date) return err(400, 'Pick a date and a time slot.'); const x = { id: rid('pk'), userId: me.id, ...body, status: 'scheduled', createdAt: Date.now(), code: String(Math.floor(1000 + Math.random() * 9000)) }; db.pickups.unshift(x); award(me.id, 10 + (body.greenRoute ? 25 : 0), body.greenRoute ? 'Pickup booked on a Green Route' : 'Pickup booked'); save(); return { pickup: x }; }
  if (p === '/api/pickups/mine') { if (need()) return need(); return { pickups: db.pickups.filter((x) => x.userId === me.id) }; }
  if (R(/^\/api\/pickups\/(.+)$/) && method === 'PATCH') { const x = db.pickups.find((y) => y.id === m[1] && y.userId === me?.id); if (!x) return err(404, 'Pickup not found.'); if (body.status === 'completed' && x.status === 'scheduled') award(me.id, Math.round((x.estKg || 2) * 8), 'Pickup completed', { kg: +x.estKg || 2, co2: +((x.estKg || 2) * 1.2).toFixed(1) }); x.status = body.status; save(); return { pickup: x }; }
  if (p === '/api/reports' && method === 'GET') { const c = here || { lat: 28.6139, lng: 77.209 }; let items = db.reports.filter((r) => hav(c, r) < 20); if (!items.length) items = [[0.004, 0.003, 3, 'plastic'], [-0.006, 0.002, 2, 'mixed'], [0.002, -0.007, 1, 'paper'], [-0.003, -0.004, 3, 'e_waste'], [0.008, -0.002, 2, 'construction'], [0.006, 0.008, 1, 'organic'], [-0.009, 0.007, 2, 'plastic']].map(([a, b, s, t], i) => ({ id: `demo_r${i}`, lat: c.lat + a, lng: c.lng + b, severity: s, type: t, note: 'Sample report', confirms: 3 + i, status: i === 5 ? 'cleaned' : 'open', at: Date.now() - i * 2.5e7, demo: true })); return { reports: items }; }
  if (p === '/api/reports' && method === 'POST') { if (need()) return need(); const r = { id: rid('r'), lat: +body.lat, lng: +body.lng, severity: +body.severity || 2, type: body.type || 'mixed', note: body.note || '', by: me.id, confirms: 1, status: 'open', at: Date.now() }; db.reports.unshift(r); award(me.id, 15, 'Reported a litter spot'); save(); return { report: r }; }
  if (R(/^\/api\/reports\/([^/]+)\/(confirm|clean)$/)) { if (need()) return need(); let r = db.reports.find((x) => x.id === m[1]); if (!r) return { report: { id: m[1], status: m[2] === 'clean' ? 'cleaned' : 'open' } }; if (m[2] === 'confirm') { r.confirms++; award(me.id, 2, 'Confirmed a litter spot'); } else { r.status = 'cleaned'; award(me.id, 40, 'Cleaned a litter spot'); } save(); return { report: r }; }
  if (p === '/api/wallet') { if (need()) return need(); return { wallet: wallet(me.id), rewards: REWARDS }; }
  if (p === '/api/rewards/redeem') { if (need()) return need(); const r = REWARDS.find((x) => x.id === body.id), w = wallet(me.id); if (w.coins < r.cost) return err(400, `You need ${r.cost - w.coins} more EcoCoins for this.`); award(me.id, -r.cost, `Redeemed: ${r.title}`); save(); return { wallet: w, code: 'ECO-' + Math.random().toString(16).slice(2, 8).toUpperCase() }; }
  if (p === '/api/leaderboard') { const w = me ? wallet(me.id) : { kg: 0, coins: 0 }; return { wards: [['Ward 7 · Green Park', 412], ['Ward 12 · Civil Lines', 388 + w.kg], ['Ward 3 · Model Town', 351], ['Ward 19 · Sadar Bazaar', 297], ['Ward 24 · Nehru Nagar', 260], ['Ward 9 · Rajendra Nagar', 214]].map(([ward, kg]) => ({ ward, kg: Math.round(kg) })).sort((a, b) => b.kg - a.kg), people: [{ name: 'Riya K.', ward: 'Ward 7', kg: 64, coins: 1840 }, { name: 'Dev M.', ward: 'Ward 12', kg: 51, coins: 1515 }, ...(me ? [{ name: me.name + ' (you)', ward: me.ward, kg: +w.kg.toFixed(1), coins: w.coins }] : []), { name: 'Farah A.', ward: 'Ward 3', kg: 38, coins: 990 }, { name: 'Ishaan T.', ward: 'Ward 19', kg: 22, coins: 610 }].sort((a, b) => b.coins - a.coins) }; }
  if (p === '/api/stats') return { users: 1240 + db.users.length, kg: 18420, co2: 26310, passports: 3120 + Object.keys(db.passports).length };
  return err(404, 'Not available in preview mode.');
}
