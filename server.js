/**
 * EcoSync server — Express API + static frontend, backed by Postgres (Neon).
 * Runs with zero configuration: no API keys needed.
 *   DATABASE_URL     Neon connection string (optional; local Postgres file otherwise)
 *   GEMINI_API_KEY   optional; when present the scanner and EcoBot use Gemini instead of the built-in models
 */
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
import { initDb, q, one, newId, passportId, sessionSecret, ms, dbMode } from './lib/db.js';
import { gemini, aiEnabled, MODELS } from './lib/gemini.js';
import { ecobotAnswer, parseListing, upcycleFor } from './lib/ecobot.js';
import { PRICES, CO2_PER_KG, materialKey } from './lib/materials.js';
import { findHubs } from './lib/hubs.js';
import { TEST_IMAGE } from './lib/selftest-image.js';
import { googleHubs, placesStatus } from './lib/places.js';
import { routeEta, routingStatus } from './lib/eta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const scrypt = promisify(crypto.scrypt);
await initDb();
const SECRET = new TextEncoder().encode(await sessionSecret());

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '8mb' }));
app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- helpers ----------
const buckets = new Map();
const limit = (name, max, windowMs = 60_000) => (req, res, next) => {
  const k = `${name}:${req.ip}`, now = Date.now(), b = buckets.get(k) || { n: 0, reset: now + windowMs };
  if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
  b.n++; buckets.set(k, b);
  return b.n <= max ? next() : res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' });
};
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clean = (s, max = 300) => String(s ?? '').replace(/[<>]/g, '').slice(0, max).trim();
const km = (a, b) => { const R = 6371, r = (d) => (d * Math.PI) / 180, h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const shortName = (n = '') => { const [f, l] = n.trim().split(/\s+/); return l ? `${f} ${l[0]}.` : f || 'Member'; };

async function hashPassword(p) { const salt = crypto.randomBytes(16).toString('hex'); return `${salt}:${(await scrypt(p, salt, 64)).toString('hex')}`; }
async function checkPassword(p, stored) {
  const [salt, hash] = String(stored).split(':'); if (!salt || !hash) return false;
  const got = await scrypt(p, salt, 64); const want = Buffer.from(hash, 'hex');
  return want.length === got.length && crypto.timingSafeEqual(got, want);
}
const issue = (u) => new SignJWT({ uid: u.id }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(SECRET);
async function viewer(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!t) return null;
  try { const { payload } = await jwtVerify(t, SECRET); return await one('SELECT * FROM users WHERE id = $1', [payload.uid]); } catch { return null; }
}
const auth = wrap(async (req, res, next) => { const u = await viewer(req); if (!u) return res.status(401).json({ error: 'Sign in to continue.' }); req.user = u; next(); });
const userView = (u) => u && { id: u.id, email: u.email, name: u.name, role: u.role, ward: u.ward, upi: u.upi, joined: ms(u.created_at) };
async function walletOf(uid) {
  const u = await one('SELECT coins, kg, co2 FROM users WHERE id = $1', [uid]);
  const txns = await q('SELECT id, coins, note, created_at FROM txns WHERE user_id = $1 ORDER BY created_at DESC LIMIT 60', [uid]);
  return { coins: u?.coins ?? 0, kg: +(u?.kg ?? 0).toFixed(2), co2: +(u?.co2 ?? 0).toFixed(2), txns: txns.map((t) => ({ id: t.id, coins: t.coins, note: t.note, at: ms(t.created_at) })) };
}
async function award(uid, coins, note, kg = 0, co2 = 0) {
  await q('INSERT INTO txns(id, user_id, coins, note, kg, co2) VALUES ($1,$2,$3,$4,$5,$6)', [newId('tx'), uid, coins, note, kg, co2]);
  await q('UPDATE users SET coins = coins + $2, kg = kg + $3, co2 = co2 + $4 WHERE id = $1', [uid, coins, kg, co2]);
}

// ---------- config ----------
app.get('/api/config', (req, res) => res.json({ app: 'EcoSync', version: '2.1.0', db: dbMode, ai: aiEnabled() ? 'gemini' : 'device', model: aiEnabled() ? MODELS.text : 'MobileNet (on-device)', prices: PRICES, mapsKey: process.env.GOOGLE_MAPS_API_KEY || null, mapStyle: process.env.MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty' }));
// Live check of every service (no secrets in the output). Cached for 5 minutes.
let statusCache = null;
app.get('/api/status', wrap(async (req, res) => {
  if (statusCache && Date.now() - statusCache.at < 5 * 60_000 && !req.query.fresh) return res.json(statusCache.data);
  const out = { database: { mode: dbMode, ok: false }, gemini: { configured: aiEnabled(), ok: null, model: aiEnabled() ? MODELS.text : null }, places: { configured: !!process.env.GOOGLE_MAPS_API_KEY, ok: null } };
  try { await q('SELECT 1'); out.database.ok = true; } catch (e) { out.database.error = e.message; }
  if (aiEnabled() && req.query.deep) {
    try { const t = await gemini({ prompt: 'Reply with the single word: ready' }); out.gemini.ok = /ready/i.test(t); out.gemini.reply = t.slice(0, 40); }
    catch (e) { out.gemini.ok = false; out.gemini.error = e.message.slice(0, 200); }
    try { const t = await gemini({ system: ECOBOT_SYSTEM, history: [{ role: 'model', text: 'Namaste! Ask me anything.' }, { role: 'user', text: 'Akhbaar ka rate kya hai?' }] }); out.gemini.chat = { ok: true, reply: t.slice(0, 80) }; }
    catch (e) { out.gemini.chat = { ok: false, error: e.message.slice(0, 200) }; }
    try { const r = await gemini({ prompt: SCAN_PROMPT, image: TEST_IMAGE, mime: 'image/jpeg', json: true }); out.gemini.scan = { ok: !!r.item, item: r.item, material: materialKey(r.material) }; }
    catch (e) { out.gemini.scan = { ok: false, error: e.message.slice(0, 200) }; }
  }
  if (process.env.GOOGLE_MAPS_API_KEY && req.query.deep) { const r = await googleHubs(28.6139, 77.209, 5000).catch(() => []); out.places.ok = placesStatus.ok ?? r.length > 0; out.places.results = r.length; if (placesStatus.error) out.places.error = placesStatus.error.slice(0, 200); }
  statusCache = { at: Date.now(), data: out };
  res.json(out);
}));
app.get('/healthz', wrap(async (req, res) => { await q('SELECT 1'); res.json({ ok: true, db: dbMode }); }));

// ---------- accounts (email + password, stored hashed in Postgres) ----------
const emailOk = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e);
app.post('/api/auth/signup', limit('auth', 10), wrap(async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase(), name = clean(req.body.name, 60), pass = String(req.body.password || '');
  if (!name) return res.status(400).json({ error: 'Add your name.' });
  if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (pass.length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters.' });
  if (await one('SELECT 1 FROM users WHERE email = $1', [email])) return res.status(409).json({ error: 'That email already has an account. Sign in instead.' });
  const id = newId('u'), role = req.body.role === 'buyer' ? 'buyer' : 'seller';
  await q('INSERT INTO users(id, email, name, role, ward, pass_hash) VALUES ($1,$2,$3,$4,$5,$6)', [id, email, name, role, clean(req.body.ward, 40), await hashPassword(pass)]);
  await award(id, 50, 'Welcome to EcoSync');
  const row = await one('SELECT * FROM users WHERE id = $1', [id]);
  res.json({ token: await issue(row), user: userView(row) });
}));
app.post('/api/auth/signin', limit('auth', 10), wrap(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE email = $1', [clean(req.body.email, 120).toLowerCase()]);
  if (!u || !(await checkPassword(String(req.body.password || ''), u.pass_hash))) return res.status(401).json({ error: 'Email or password is wrong.' });
  res.json({ token: await issue(u), user: userView(u) });
}));
app.get('/api/me', auth, wrap(async (req, res) => res.json({ user: userView(req.user), wallet: await walletOf(req.user.id) })));
app.patch('/api/me', auth, wrap(async (req, res) => {
  const b = req.body, u = req.user;
  const role = b.role === 'buyer' || b.role === 'seller' ? b.role : u.role;
  const upi = b.upi != null ? clean(b.upi, 60) : u.upi;
  if (upi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) return res.status(400).json({ error: 'UPI IDs look like name@okaxis.' });
  await q('UPDATE users SET name = $2, ward = $3, role = $4, upi = $5 WHERE id = $1', [u.id, clean(b.name, 60) || u.name, b.ward != null ? clean(b.ward, 40) : u.ward, role, upi]);
  res.json({ user: userView(await one('SELECT * FROM users WHERE id = $1', [u.id])) });
}));

// ---------- AI (Gemini when configured, otherwise built-in) ----------
const SCAN_PROMPT = `You are EcoSync's recycling expert for India. Identify the main waste item in the photo. Reply ONLY with JSON:
{"item": string, "material": one of ["paper","cardboard","pet","hdpe","ldpe","pp","ps","mixed_plastic","aluminium","steel","copper","glass","e_waste","battery","textile","organic","other"], "resinCode": number|null, "recyclable": boolean, "hazard": string|null, "condition": "clean"|"needs_rinse"|"contaminated", "estWeightKg": number, "confidence": number, "steps": [3 short strings], "funFact": string}`;
app.post('/api/ai/scan', limit('ai', 15), wrap(async (req, res) => {
  if (!aiEnabled()) return res.status(404).json({ error: 'Use on-device scanning.' });
  const { image, mime = 'image/jpeg' } = req.body || {};
  if (!image || image.length > 7_000_000) return res.status(400).json({ error: 'Add a photo under 5 MB.' });
  try { const r = await gemini({ prompt: SCAN_PROMPT, image, mime, json: true }); res.json({ ...r, material: materialKey(r.material), source: 'gemini' }); }
  catch (e) { console.error('AI scan failed:', e.message); res.status(502).json({ error: 'The scanner is busy. Try again in a moment.' }); }
}));
const ECOBOT_SYSTEM = 'You are EcoBot inside EcoSync, a recycling app in India. Reply in the user\'s language (Hindi, Hinglish or English), under 110 words, practical and local. Use short bullet points for lists.';
app.post('/api/ai/chat', limit('ai', 30), wrap(async (req, res) => {
  const msgs = (req.body.messages || []).slice(-12).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: clean(m.text, 1200) })).filter((m) => m.text);
  if (!msgs.length) return res.status(400).json({ error: 'Type a question first.' });
  if (aiEnabled()) {
    try { return res.json({ text: await gemini({ system: ECOBOT_SYSTEM, history: msgs }), source: 'gemini' }); } catch (e) { console.error('AI chat failed:', e.message); }
  }
  res.json({ text: ecobotAnswer(msgs.at(-1).text), source: 'builtin' });
}));
app.post('/api/ai/parse-listing', wrap(async (req, res) => {
  const text = clean(req.body.text, 400);
  if (!text) return res.status(400).json({ error: 'Say or type what you want to sell.' });
  res.json(parseListing(text));
}));
app.get('/api/upcycle/:material', (req, res) => res.json({ ideas: upcycleFor(materialKey(req.params.material)) }));

// ---------- recycling hubs from OpenStreetMap ----------
app.get('/api/hubs', limit('hubs', 30), wrap(async (req, res) => {
  res.json(await findHubs(num(req.query.lat, 28.6139), num(req.query.lng, 77.209), Math.min(num(req.query.r, 8000), 25000)));
}));

// ---------- marketplace ----------
const listingView = (l, here) => ({
  id: l.id, title: l.title, material: l.material, kg: l.kg, price: l.price, lat: l.lat, lng: l.lng, area: l.area, notes: l.notes, photo: l.photo,
  status: l.status, sellerId: l.seller_id, buyerId: l.buyer_id, passportId: l.passport_id, createdAt: ms(l.created_at),
  seller: { name: shortName(l.seller_name), hasUpi: !!l.seller_upi }, distanceKm: here ? +km(here, l).toFixed(1) : null,
});
const LSEL = 'SELECT l.*, u.name AS seller_name, u.upi AS seller_upi FROM listings l JOIN users u ON u.id = l.seller_id';
app.get('/api/listings', wrap(async (req, res) => {
  const here = req.query.lat ? { lat: num(req.query.lat), lng: num(req.query.lng) } : null;
  const me = req.query.mine ? await viewer(req) : null;
  if (req.query.mine && !me) return res.status(401).json({ error: 'Sign in to continue.' });
  const params = [], where = [];
  if (me) { params.push(me.id); where.push(`(l.seller_id = $1 OR l.buyer_id = $1) AND l.status <> 'removed'`); }
  else where.push(`l.status = 'open'`);
  if (req.query.material) { params.push(materialKey(req.query.material)); where.push(`l.material = $${params.length}`); }
  let items = (await q(`${LSEL} WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT 200`, params)).map((l) => listingView(l, here));
  if (here && !me) items = items.filter((l) => l.distanceKm <= 50).sort((a, b) => a.distanceKm - b.distanceKm);
  res.json({ listings: items.slice(0, 80) });
}));
app.post('/api/listings', auth, wrap(async (req, res) => {
  const b = req.body, material = materialKey(b.material), kg = Math.max(0.1, Math.min(num(b.kg, 1), 2000));
  const price = Math.max(0, Math.round(num(b.price, (PRICES[material]?.rate || 2) * kg)));
  const lat = num(b.lat, NaN), lng = num(b.lng, NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Turn on location so buyers can find your listing.' });
  const photo = typeof b.photo === 'string' && b.photo.startsWith('data:image') && b.photo.length < 400_000 ? b.photo : null;
  const id = newId('l');
  await q(`INSERT INTO listings(id, seller_id, title, material, kg, price, lat, lng, area, notes, photo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, req.user.id, clean(b.title, 80) || `${PRICES[material]?.label || 'Scrap'} · ${kg} kg`, material, kg, price, lat, lng, clean(b.area, 60), clean(b.notes, 280), photo]);
  await award(req.user.id, 5, 'Listed scrap');
  res.json({ listing: listingView(await one(`${LSEL} WHERE l.id = $1`, [id])) });
}));
app.patch('/api/listings/:id', auth, wrap(async (req, res) => {
  const l = await one('SELECT * FROM listings WHERE id = $1 AND seller_id = $2', [req.params.id, req.user.id]);
  if (!l) return res.status(404).json({ error: 'Listing not found.' });
  if (req.body.status === 'removed' && l.status === 'open') await q(`UPDATE listings SET status = 'removed' WHERE id = $1`, [l.id]);
  res.json({ ok: true });
}));

// ---------- orders: direct UPI to the seller or cash, completed by QR handshake ----------
app.post('/api/orders', auth, limit('order', 20), wrap(async (req, res) => {
  const l = await one(`${LSEL} WHERE l.id = $1`, [String(req.body.listingId || '')]);
  if (!l || l.status !== 'open') return res.status(400).json({ error: 'This listing is no longer available.' });
  if (l.seller_id === req.user.id) return res.status(400).json({ error: 'You can\'t buy your own listing.' });
  const method = req.body.method === 'upi' && l.seller_upi ? 'upi' : 'cash';
  const ref = clean(req.body.ref, 40);
  const id = passportId(), co2 = +(l.kg * (CO2_PER_KG[l.material] ?? 0.5)).toFixed(2);
  const upd = await q(`UPDATE listings SET status = 'reserved', buyer_id = $2, passport_id = $3 WHERE id = $1 AND status = 'open' RETURNING id`, [l.id, req.user.id, id]);
  if (!upd.length) return res.status(409).json({ error: 'Someone else just reserved this lot.' });
  const events = [
    { stage: 'listed', at: ms(l.created_at), note: 'Listed for collection' },
    { stage: 'reserved', at: Date.now(), note: method === 'upi' ? `₹${l.price} sent by UPI${ref ? ` · ref ${ref}` : ''}` : `₹${l.price} to be paid in cash at pickup` },
  ];
  await q(`INSERT INTO passports(id, listing_id, title, material, kg, amount, co2, seller_id, buyer_id, pay_method, pay_ref, handshake, events) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, l.id, l.title, l.material, l.kg, l.price, co2, l.seller_id, req.user.id, method, ref, String(crypto.randomInt(100000, 999999)), JSON.stringify(events)]);
  await award(req.user.id, 10, 'Reserved a lot');
  res.json({ passport: await passportView(id, req.user.id) });
}));
async function passportView(id, viewerId) {
  const p = await one(`SELECT p.*, s.name AS seller_name, b.name AS buyer_name, s.upi AS seller_upi FROM passports p JOIN users s ON s.id = p.seller_id JOIN users b ON b.id = p.buyer_id WHERE p.id = $1`, [String(id).toUpperCase()]);
  if (!p) return null;
  const role = viewerId === p.seller_id ? 'seller' : viewerId === p.buyer_id ? 'buyer' : 'public';
  return {
    id: p.id, title: p.title, material: p.material, kg: p.kg, amount: p.amount, co2: p.co2, status: p.status, events: p.events,
    payMethod: p.pay_method, payConfirmed: p.pay_confirmed, createdAt: ms(p.created_at), role,
    sellerName: shortName(p.seller_name), buyerName: shortName(p.buyer_name),
    payRef: role !== 'public' ? p.pay_ref : undefined, sellerUpi: role === 'buyer' ? p.seller_upi : undefined,
    handshake: role === 'seller' ? p.handshake : undefined,
  };
}
app.get('/api/passport/:id', wrap(async (req, res) => {
  const v = await viewer(req); const p = await passportView(req.params.id, v?.id);
  p ? res.json({ passport: p }) : res.status(404).json({ error: 'No passport with that ID. Check the code on the QR label.' });
}));
app.get('/api/passports/mine', auth, wrap(async (req, res) => {
  const rows = await q('SELECT id FROM passports WHERE seller_id = $1 OR buyer_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json({ passports: await Promise.all(rows.map((r) => passportView(r.id, req.user.id))) });
}));
app.post('/api/passport/:id/handshake', auth, wrap(async (req, res) => {
  const p = await one('SELECT * FROM passports WHERE id = $1', [req.params.id.toUpperCase()]);
  if (!p) return res.status(404).json({ error: 'Passport not found.' });
  if (p.buyer_id !== req.user.id) return res.status(403).json({ error: 'Only the buyer can confirm this pickup.' });
  if (p.status === 'awaiting_pickup') {
    if (String(req.body.code) !== p.handshake) return res.status(400).json({ error: 'That code doesn\'t match. Ask the seller to show their QR again.' });
    await q(`UPDATE passports SET status = 'collected', events = $2 WHERE id = $1`, [p.id, JSON.stringify([...p.events, { stage: 'picked', at: Date.now(), note: 'Handed over · confirmed by QR handshake' }])]);
    await q(`UPDATE listings SET status = 'sold' WHERE id = $1`, [p.listing_id]);
    await award(p.seller_id, Math.round(p.kg * 10) + 20, `Sold ${p.title}`, p.kg, p.co2);
    await award(p.buyer_id, 15, `Collected ${p.title}`);
  }
  res.json({ passport: await passportView(p.id, req.user.id) });
}));
app.post('/api/passport/:id/payref', auth, wrap(async (req, res) => {
  const p = await one('SELECT * FROM passports WHERE id = $1 AND buyer_id = $2', [req.params.id.toUpperCase(), req.user.id]);
  if (!p) return res.status(404).json({ error: 'Passport not found.' });
  const ref = clean(req.body.ref, 40);
  const events = p.events.map((e) => (e.stage === 'reserved' && p.pay_method === 'upi' ? { ...e, note: `₹${p.amount} sent by UPI${ref ? ` · ref ${ref}` : ''}` } : e));
  await q('UPDATE passports SET pay_ref = $2, events = $3 WHERE id = $1', [p.id, ref, JSON.stringify(events)]);
  res.json({ passport: await passportView(p.id, req.user.id) });
}));
app.post('/api/passport/:id/paid', auth, wrap(async (req, res) => {
  const p = await one('SELECT * FROM passports WHERE id = $1 AND seller_id = $2', [req.params.id.toUpperCase(), req.user.id]);
  if (!p) return res.status(404).json({ error: 'Passport not found.' });
  await q('UPDATE passports SET pay_confirmed = true WHERE id = $1', [p.id]);
  res.json({ passport: await passportView(p.id, req.user.id) });
}));
app.post('/api/passport/:id/event', auth, wrap(async (req, res) => {
  const p = await one('SELECT * FROM passports WHERE id = $1 AND buyer_id = $2', [req.params.id.toUpperCase(), req.user.id]);
  if (!p) return res.status(403).json({ error: 'Only the buyer can update this passport.' });
  const stage = ['hub', 'processed', 'reborn'].includes(req.body.stage) ? req.body.stage : null;
  if (!stage || p.status === 'awaiting_pickup') return res.status(400).json({ error: 'Confirm the pickup first.' });
  const note = clean(req.body.note, 200) || { hub: 'Delivered to a recycling hub', processed: 'Sorted, baled and weighed', reborn: 'Made into something new' }[stage];
  await q('UPDATE passports SET events = $2, status = $3 WHERE id = $1', [p.id, JSON.stringify([...p.events, { stage, at: Date.now(), note }]), stage === 'reborn' ? 'reborn' : p.status]);
  res.json({ passport: await passportView(p.id, req.user.id) });
}));

// ---------- pickups (Green Route = another pickup already booked nearby in that slot) ----------
const SLOTS = ['08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00', '18:00–20:00'];
app.get('/api/pickups/slots', wrap(async (req, res) => {
  const date = clean(req.query.date, 10), here = { lat: num(req.query.lat, 28.6139), lng: num(req.query.lng, 77.209) };
  const booked = await q(`SELECT slot, lat, lng FROM pickups WHERE date = $1 AND status <> 'cancelled'`, [date]);
  res.json({ slots: SLOTS.map((s) => { const near = booked.filter((b) => b.slot === s && km(here, b) < 2.5).length; return { slot: s, nearby: near, greenRoute: near > 0, full: near >= 12 }; }) });
}));
// Pickup lifecycle: scheduled → accepted (a collector takes it) → on_the_way (collector confirms they've left and
// shares live GPS) → arrived → completed (collector enters the seller's pickup code). No position or ETA is shown
// until the collector has actually left and sent a real location.
const LIVE = ['on_the_way', 'arrived'];
const PSEL = `SELECT p.*, c.name AS collector_name, s.name AS seller_name FROM pickups p JOIN users s ON s.id = p.user_id LEFT JOIN users c ON c.id = p.collector_id`;
function pickupView(p, viewer) {
  const isSeller = viewer === p.user_id, isCollector = viewer && viewer === p.collector_id;
  const base = {
    id: p.id, date: p.date, slot: p.slot, materials: p.materials, estKg: p.est_kg, greenRoute: p.green_route, status: p.status,
    vehicle: p.vehicle, createdAt: ms(p.created_at), acceptedAt: ms(p.accepted_at), departedAt: ms(p.departed_at), arrivedAt: ms(p.arrived_at), completedAt: ms(p.completed_at),
    collector: p.collector_id ? { name: shortName(p.collector_name) } : null, seller: { name: shortName(p.seller_name) },
    role: isSeller ? 'seller' : isCollector ? 'collector' : 'public',
  };
  if (isSeller) Object.assign(base, { lat: p.lat, lng: p.lng, address: p.address, code: p.code });
  if (isCollector) Object.assign(base, { lat: p.lat, lng: p.lng, address: p.address }); // the code stays with the seller
  if ((isSeller || isCollector) && LIVE.includes(p.status) && p.c_lat != null) {
    base.live = { lat: p.c_lat, lng: p.c_lng, accuracy: p.c_acc, at: ms(p.c_at) };
    if (p.eta_s != null) {
      // Count down from when the ETA was computed, so the arrival time stays honest between updates.
      const elapsed = Math.max(0, (Date.now() - ms(p.eta_at)) / 1000);
      const left = Math.max(0, Math.round(p.eta_s - Math.min(elapsed, 120)));
      base.eta = { seconds: p.status === 'arrived' ? 0 : left, meters: p.eta_m, source: p.eta_src, computedAt: ms(p.eta_at), arriveAt: p.status === 'arrived' ? ms(p.arrived_at) : Date.now() + left * 1000, polyline: p.eta_poly };
    }
  }
  return base;
}
app.post('/api/pickups', auth, wrap(async (req, res) => {
  const b = req.body;
  if (!SLOTS.includes(b.slot) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Pick a day and a time slot.' });
  const lat = num(b.lat, NaN), lng = num(b.lng, NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Turn on location so the collector can find you.' });
  const near = (await q(`SELECT lat, lng FROM pickups WHERE date = $1 AND slot = $2 AND status <> 'cancelled' AND user_id <> $3`, [b.date, b.slot, req.user.id])).filter((p) => km({ lat, lng }, p) < 2.5).length;
  const id = newId('pk');
  await q(`INSERT INTO pickups(id, user_id, date, slot, lat, lng, address, materials, est_kg, green_route, code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, req.user.id, b.date, b.slot, lat, lng, clean(b.address, 160), JSON.stringify((b.materials || []).map(materialKey).slice(0, 8)), Math.max(0.5, num(b.estKg, 2)), near > 0, String(crypto.randomInt(1000, 9999))]);
  await award(req.user.id, near > 0 ? 35 : 10, near > 0 ? 'Pickup booked on a Green Route' : 'Pickup booked');
  res.json({ pickup: pickupView(await one(`${PSEL} WHERE p.id = $1`, [id]), req.user.id) });
}));
app.get('/api/pickups/mine', auth, wrap(async (req, res) => {
  const rows = await q(`${PSEL} WHERE p.user_id = $1 ORDER BY p.date DESC, p.created_at DESC LIMIT 50`, [req.user.id]);
  res.json({ pickups: rows.map((p) => pickupView(p, req.user.id)) });
}));
// Collector: open requests nearby (exact address hidden until accepted).
app.get('/api/pickups/requests', auth, wrap(async (req, res) => {
  const here = { lat: num(req.query.lat, NaN), lng: num(req.query.lng, NaN) };
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const rows = await q(`${PSEL} WHERE p.status = 'scheduled' AND p.collector_id IS NULL AND p.date >= $1 AND p.user_id <> $2 ORDER BY p.date, p.slot LIMIT 200`, [today, req.user.id]);
  const out = rows.map((p) => ({ ...pickupView(p, req.user.id), distanceKm: Number.isFinite(here.lat) ? +km(here, p).toFixed(1) : null }))
    .filter((p) => p.distanceKm == null || p.distanceKm <= 15);
  if (Number.isFinite(here.lat)) out.sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot) || a.distanceKm - b.distanceKm);
  res.json({ requests: out.slice(0, 50) });
}));
app.get('/api/pickups/jobs', auth, wrap(async (req, res) => {
  const rows = await q(`${PSEL} WHERE p.collector_id = $1 ORDER BY (p.status IN ('on_the_way','arrived')) DESC, p.date, p.slot LIMIT 50`, [req.user.id]);
  res.json({ jobs: rows.map((p) => pickupView(p, req.user.id)) });
}));
async function mine(req, res, as) {
  const p = await one(`${PSEL} WHERE p.id = $1`, [req.params.id]);
  if (!p) { res.status(404).json({ error: 'Pickup not found.' }); return null; }
  if (as === 'collector' && p.collector_id !== req.user.id) { res.status(403).json({ error: 'This pickup is assigned to another collector.' }); return null; }
  if (as === 'party' && p.collector_id !== req.user.id && p.user_id !== req.user.id) { res.status(403).json({ error: 'You are not part of this pickup.' }); return null; }
  return p;
}
const okLatLng = (b) => Number.isFinite(num(b.lat, NaN)) && Number.isFinite(num(b.lng, NaN)) && Math.abs(b.lat) <= 90 && Math.abs(b.lng) <= 180;
async function refreshEta(id, from, force = false) {
  const p = await one('SELECT * FROM pickups WHERE id = $1', [id]);
  const moved = p.eta_lat == null ? Infinity : km(from, { lat: p.eta_lat, lng: p.eta_lng }) * 1000;
  const age = p.eta_at ? (Date.now() - ms(p.eta_at)) / 1000 : Infinity;
  if (!force && age < 45 && moved < 150) return; // keep routing calls modest
  const r = await routeEta(from, { lat: p.lat, lng: p.lng }, p.vehicle);
  await q('UPDATE pickups SET eta_s = $2, eta_m = $3, eta_src = $4, eta_poly = $5, eta_at = now(), eta_lat = $6, eta_lng = $7 WHERE id = $1', [id, r.seconds, r.meters, r.source, r.polyline, from.lat, from.lng]);
}
app.post('/api/pickups/:id/accept', auth, wrap(async (req, res) => {
  const vehicle = ['bike', 'van', 'cycle'].includes(req.body.vehicle) ? req.body.vehicle : 'bike';
  const upd = await q(`UPDATE pickups SET collector_id = $2, status = 'accepted', accepted_at = now(), vehicle = $3 WHERE id = $1 AND status = 'scheduled' AND collector_id IS NULL AND user_id <> $2 RETURNING id`, [req.params.id, req.user.id, vehicle]);
  if (!upd.length) return res.status(409).json({ error: 'Another collector already took this pickup.' });
  res.json({ pickup: pickupView(await one(`${PSEL} WHERE p.id = $1`, [req.params.id]), req.user.id) });
}));
app.post('/api/pickups/:id/release', auth, wrap(async (req, res) => {
  const p = await mine(req, res, 'collector'); if (!p) return;
  if (p.status === 'completed') return res.status(400).json({ error: 'This pickup is already complete.' });
  await q(`UPDATE pickups SET collector_id = NULL, status = 'scheduled', accepted_at = NULL, departed_at = NULL, arrived_at = NULL, c_lat = NULL, c_lng = NULL, c_at = NULL, eta_s = NULL, eta_at = NULL, eta_poly = NULL, eta_lat = NULL, eta_lng = NULL WHERE id = $1`, [p.id]);
  res.json({ ok: true });
}));
app.post('/api/pickups/:id/depart', auth, wrap(async (req, res) => {
  const p = await mine(req, res, 'collector'); if (!p) return;
  if (p.status !== 'accepted') return res.status(400).json({ error: p.status === 'scheduled' ? 'Accept the pickup first.' : 'You have already left for this pickup.' });
  if (!okLatLng(req.body)) return res.status(400).json({ error: 'Your location is needed to start. Allow location access and try again.' });
  const from = { lat: +req.body.lat, lng: +req.body.lng };
  await q(`UPDATE pickups SET status = 'on_the_way', departed_at = now(), c_lat = $2, c_lng = $3, c_acc = $4, c_at = now() WHERE id = $1`, [p.id, from.lat, from.lng, num(req.body.accuracy, null)]);
  await refreshEta(p.id, from, true);
  res.json({ pickup: pickupView(await one(`${PSEL} WHERE p.id = $1`, [p.id]), req.user.id) });
}));
app.post('/api/pickups/:id/location', auth, limit('loc', 30), wrap(async (req, res) => {
  const p = await mine(req, res, 'collector'); if (!p) return;
  if (!LIVE.includes(p.status)) return res.status(400).json({ error: 'Location sharing has ended for this pickup.' });
  if (!okLatLng(req.body)) return res.status(400).json({ error: 'Invalid location.' });
  const from = { lat: +req.body.lat, lng: +req.body.lng };
  await q('UPDATE pickups SET c_lat = $2, c_lng = $3, c_acc = $4, c_at = now() WHERE id = $1', [p.id, from.lat, from.lng, num(req.body.accuracy, null)]);
  // Within ~80 m of the door counts as arrived.
  if (p.status === 'on_the_way' && km(from, p) * 1000 <= 80) await q(`UPDATE pickups SET status = 'arrived', arrived_at = now(), eta_s = 0, eta_at = now() WHERE id = $1`, [p.id]);
  else if (p.status === 'on_the_way') await refreshEta(p.id, from);
  res.json({ pickup: pickupView(await one(`${PSEL} WHERE p.id = $1`, [p.id]), req.user.id) });
}));
app.post('/api/pickups/:id/arrive', auth, wrap(async (req, res) => {
  const p = await mine(req, res, 'collector'); if (!p) return;
  if (p.status !== 'on_the_way') return res.status(400).json({ error: 'Tap "I\'m leaving now" first.' });
  await q(`UPDATE pickups SET status = 'arrived', arrived_at = now(), eta_s = 0, eta_at = now() WHERE id = $1`, [p.id]);
  res.json({ pickup: pickupView(await one(`${PSEL} WHERE p.id = $1`, [p.id]), req.user.id) });
}));
app.post('/api/pickups/:id/complete', auth, wrap(async (req, res) => {
  const p = await mine(req, res, 'collector'); if (!p) return;
  if (!LIVE.includes(p.status)) return res.status(400).json({ error: 'Start the trip before completing the pickup.' });
  if (String(req.body.code || '').trim() !== p.code) return res.status(400).json({ error: 'That pickup code is wrong. Ask the seller for the 4-digit code in their app.' });
  const kgv = Math.max(0.1, num(req.body.kg, p.est_kg));
  await q(`UPDATE pickups SET status = 'completed', completed_at = now(), est_kg = $2, c_lat = NULL, c_lng = NULL WHERE id = $1`, [p.id, kgv]);
  await award(p.user_id, Math.round(kgv * 8), 'Pickup collected', kgv, +(kgv * 1.2).toFixed(2));
  await award(req.user.id, 15, 'Completed a pickup');
  res.json({ pickup: pickupView(await one(`${PSEL} WHERE p.id = $1`, [p.id]), req.user.id) });
}));
app.get('/api/pickups/:id/track', auth, wrap(async (req, res) => {
  const p = await mine(req, res, 'party'); if (!p) return;
  res.json({ pickup: pickupView(p, req.user.id) });
}));
app.patch('/api/pickups/:id', auth, wrap(async (req, res) => {
  const p = await one('SELECT * FROM pickups WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!p) return res.status(404).json({ error: 'Pickup not found.' });
  if (req.body.status === 'cancelled' && ['scheduled', 'accepted', 'on_the_way'].includes(p.status)) await q(`UPDATE pickups SET status = 'cancelled', c_lat = NULL, c_lng = NULL WHERE id = $1`, [p.id]);
  res.json({ pickup: pickupView(await one(`${PSEL} WHERE p.id = $1`, [p.id]), req.user.id) });
}));

// ---------- litter reports (3D map) ----------
const reportView = (r) => ({ id: r.id, lat: r.lat, lng: r.lng, severity: r.severity, type: r.type, note: r.note, confirms: r.confirms, status: r.status, at: ms(r.created_at), hasPhoto: !!r.photo });
app.get('/api/reports', wrap(async (req, res) => {
  const lat = num(req.query.lat, 28.6139), lng = num(req.query.lng, 77.209);
  const rows = await q('SELECT * FROM reports WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4 ORDER BY created_at DESC LIMIT 300', [lat - 0.2, lat + 0.2, lng - 0.2, lng + 0.2]);
  res.json({ reports: rows.map(reportView) });
}));
app.post('/api/reports', auth, limit('rep', 10), wrap(async (req, res) => {
  const b = req.body, lat = num(b.lat, NaN), lng = num(b.lng, NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Tap the map to place the report.' });
  const id = newId('r');
  await q('INSERT INTO reports(id, user_id, lat, lng, severity, type, note, photo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, req.user.id, lat, lng, Math.min(3, Math.max(1, num(b.severity, 2))), clean(b.type, 20) || 'mixed', clean(b.note, 200), typeof b.photo === 'string' && b.photo.startsWith('data:image') && b.photo.length < 400_000 ? b.photo : null]);
  await award(req.user.id, 15, 'Reported a litter spot');
  res.json({ report: reportView(await one('SELECT * FROM reports WHERE id = $1', [id])) });
}));
app.post('/api/reports/:id/:action(confirm|clean)', auth, wrap(async (req, res) => {
  const r = await one('SELECT * FROM reports WHERE id = $1', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Report not found.' });
  if (req.params.action === 'confirm') { await q('UPDATE reports SET confirms = confirms + 1 WHERE id = $1', [r.id]); await award(req.user.id, 2, 'Confirmed a litter spot'); }
  else if (r.status === 'open') { await q(`UPDATE reports SET status = 'cleaned' WHERE id = $1`, [r.id]); await award(req.user.id, 40, 'Cleaned a litter spot'); }
  res.json({ report: reportView(await one('SELECT * FROM reports WHERE id = $1', [r.id])) });
}));

// ---------- wallet, rewards, leaderboard, stats ----------
const REWARDS = [
  { id: 'tree', title: 'Plant a sapling in your ward', cost: 300, kind: 'Community impact' },
  { id: 'school', title: 'Donate to a school eco-club', cost: 200, kind: 'Community impact' },
  { id: 'bag', title: 'Jute tote bag', cost: 180, kind: 'Delivered to you' },
  { id: 'books', title: 'Recycled-paper notebook set', cost: 250, kind: 'Delivered to you' },
  { id: 'metro', title: '₹50 metro card top-up', cost: 500, kind: 'Voucher code' },
  { id: 'data', title: '1 GB mobile data pack', cost: 400, kind: 'Voucher code' },
];
app.get('/api/wallet', auth, wrap(async (req, res) => res.json({ wallet: await walletOf(req.user.id), rewards: REWARDS })));
app.post('/api/rewards/redeem', auth, wrap(async (req, res) => {
  const r = REWARDS.find((x) => x.id === req.body.id); if (!r) return res.status(404).json({ error: 'Reward not found.' });
  const upd = await q('UPDATE users SET coins = coins - $2 WHERE id = $1 AND coins >= $2 RETURNING coins', [req.user.id, r.cost]);
  if (!upd.length) return res.status(400).json({ error: 'You don\'t have enough EcoCoins for this yet.' });
  await q('INSERT INTO txns(id, user_id, coins, note) VALUES ($1,$2,$3,$4)', [newId('tx'), req.user.id, -r.cost, `Redeemed: ${r.title}`]);
  res.json({ wallet: await walletOf(req.user.id), code: 'ECO-' + crypto.randomBytes(3).toString('hex').toUpperCase() });
}));
app.get('/api/leaderboard', wrap(async (req, res) => {
  const wards = await q(`SELECT ward, round(sum(kg)::numeric, 1)::float AS kg, count(*)::int AS members FROM users WHERE ward <> '' GROUP BY ward ORDER BY kg DESC LIMIT 12`);
  const people = (await q(`SELECT name, ward, kg, coins FROM users ORDER BY coins DESC LIMIT 10`)).map((p) => ({ name: shortName(p.name), ward: p.ward, kg: +(+p.kg).toFixed(1), coins: p.coins }));
  res.json({ wards, people });
}));
app.get('/api/stats', wrap(async (req, res) => {
  res.json(await one(`SELECT (SELECT count(*) FROM users)::int AS members, (SELECT coalesce(sum(kg),0) FROM passports WHERE status <> 'awaiting_pickup')::float AS kg, (SELECT count(*) FROM passports)::int AS passports, (SELECT count(*) FROM listings WHERE status = 'open')::int AS open`));
}));

// ---------- static frontend ----------
const pub = path.join(__dirname, 'public');
app.use(express.static(pub, { maxAge: '1h', setHeaders: (res, p) => { if (/\.(html|js|css)$/.test(p)) res.set('Cache-Control', 'no-cache'); } }));
app.get('/download/android', (req, res) => {
  const apk = path.join(pub, 'downloads', 'EcoSync.apk');
  fs.existsSync(apk) ? res.download(apk, 'EcoSync.apk') : res.status(404).send('The Android app is not available yet.');
});
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(pub, 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong on our side. Try again.' }); });

app.listen(PORT, () => {
  console.log(`EcoSync on http://localhost:${PORT} · database: ${dbMode} · AI: ${aiEnabled() ? 'gemini' : 'on-device'}`);
  // Startup self-check of the database. Gemini and Places are only tested via /api/status?deep=1 so deploys don't use up API quota.
  setTimeout(() => fetch(`http://localhost:${PORT}/api/status?fresh=1`).then((r) => r.json()).then((j) => console.log('Self-check', JSON.stringify(j))).catch((e) => console.log('Self-check failed', e.message)), 1500);
  setTimeout(() => routeEta({ lat: 28.6139, lng: 77.209 }, { lat: 28.6304, lng: 77.2177 }, 'bike').then((r) => console.log('Routing check', JSON.stringify({ source: r.source, minutes: Math.round(r.seconds / 60), km: +(r.meters / 1000).toFixed(1), google: routingStatus }))).catch((e) => console.log('Routing check failed', e.message)), 2500);
});
