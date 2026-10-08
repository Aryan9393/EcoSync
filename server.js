/**
 * EcoSync server
 * Express API + static frontend. Every external service is optional:
 * without keys the app runs in a clearly-labelled demo mode, and each
 * feature switches to the real provider as soon as its env vars exist.
 */
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { loadDb, saveDb, seedListingsNear, newId, passportId } from './lib/db.js';
import { gemini, geminiImage, aiEnabled, MODELS } from './lib/gemini.js';
import { demoScan, demoChat, demoUpcycle, demoParse } from './lib/demo-ai.js';
import { PRICES, CO2_PER_KG, materialKey } from './lib/materials.js';
import { findHubs } from './lib/hubs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const PORT = Number(env.PORT || 8080);
const SESSION_SECRET = new TextEncoder().encode(env.SESSION_SECRET || 'dev-only-change-me-' + (env.RENDER_SERVICE_ID || 'local'));

const FIREBASE = env.FIREBASE_API_KEY && env.FIREBASE_PROJECT_ID ? {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN || `${env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: env.FIREBASE_PROJECT_ID,
  appId: env.FIREBASE_APP_ID || undefined,
} : null;
const RAZORPAY = env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET ? { id: env.RAZORPAY_KEY_ID, secret: env.RAZORPAY_KEY_SECRET } : null;
const EMAIL = env.RESEND_API_KEY ? { key: env.RESEND_API_KEY, from: env.EMAIL_FROM || 'EcoSync <onboarding@resend.dev>' } : null;
const authMode = FIREBASE ? 'firebase' : EMAIL ? 'email' : 'demo';

const db = loadDb();
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(compression());
app.use(express.json({ limit: '8mb' }));

// Allow the Android app / Gemini workspace previews to call the API cross-origin.
app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- tiny helpers ----------
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, reset: now + windowMs };
  if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
  b.n++; buckets.set(key, b);
  return b.n <= max;
}
const limit = (name, max, windowMs = 60_000) => (req, res, next) =>
  rateLimit(`${name}:${req.ip}`, max, windowMs) ? next() : res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' });

const haversineKm = (a, b) => {
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clean = (s, max = 300) => String(s ?? '').replace(/[<>]/g, '').slice(0, max).trim();

async function issueSession(user) {
  return new SignJWT({ uid: user.id, role: user.role }).setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime('30d').sign(SESSION_SECRET);
}
async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET);
    const user = db.users.find((u) => u.id === payload.uid);
    if (!user) return res.status(401).json({ error: 'Your session expired. Sign in again.' });
    req.user = user; next();
  } catch { res.status(401).json({ error: 'Your session expired. Sign in again.' }); }
}
function wallet(uid) {
  if (!db.wallets[uid]) db.wallets[uid] = { coins: 120, kg: 0, co2: 0, txns: [{ id: newId('tx'), at: Date.now(), type: 'bonus', coins: 120, note: 'Welcome bonus' }] };
  return db.wallets[uid];
}
function award(uid, coins, note, extra = {}) {
  const w = wallet(uid);
  w.coins += coins; if (extra.kg) w.kg += extra.kg; if (extra.co2) w.co2 += extra.co2;
  w.txns.unshift({ id: newId('tx'), at: Date.now(), type: coins >= 0 ? 'earn' : 'spend', coins, note, ...extra });
  w.txns = w.txns.slice(0, 80);
}
const publicUser = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role, ward: u.ward, joined: u.joined, verified: u.verified };

// ---------- config ----------
app.get('/api/config', (req, res) => {
  res.json({
    app: 'EcoSync', version: '1.0.0',
    auth: authMode, firebase: FIREBASE,
    payments: RAZORPAY ? 'razorpay' : 'demo', razorpayKeyId: RAZORPAY?.id || null,
    ai: aiEnabled() ? 'gemini' : 'demo', models: aiEnabled() ? MODELS : null,
    mapStyle: env.MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
    prices: PRICES,
  });
});
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---------- auth: email one-time code ----------
const otps = new Map();
app.post('/api/auth/otp/request', limit('otp', 5), async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  const code = String(crypto.randomInt(100000, 999999));
  otps.set(email, { hash: crypto.createHash('sha256').update(code).digest('hex'), exp: Date.now() + 10 * 60_000, tries: 0 });
  if (EMAIL) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${EMAIL.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL.from, to: email, subject: `${code} is your EcoSync sign-in code`,
        html: `<div style="font-family:system-ui;max-width:420px;margin:auto;padding:24px"><h2 style="color:#0f766e">EcoSync</h2><p>Your sign-in code is</p><p style="font-size:32px;letter-spacing:8px;font-weight:700">${code}</p><p style="color:#64748b">It expires in 10 minutes. If you didn't ask for it, ignore this email.</p></div>`,
      }),
    }).catch(() => null);
    if (!r || !r.ok) return res.status(502).json({ error: 'We could not send the email. Check the address and try again.' });
    return res.json({ sent: true });
  }
  // Demo mode: no email provider configured, so the code is returned to show on screen.
  res.json({ sent: false, demoCode: code });
});
app.post('/api/auth/otp/verify', limit('otpv', 10), async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  const rec = otps.get(email);
  if (!rec || rec.exp < Date.now()) return res.status(400).json({ error: 'That code expired. Request a new one.' });
  if (++rec.tries > 5) { otps.delete(email); return res.status(429).json({ error: 'Too many wrong codes. Request a new one.' }); }
  const ok = crypto.createHash('sha256').update(String(req.body.code || '')).digest('hex') === rec.hash;
  if (!ok) return res.status(400).json({ error: 'That code is not right. Check the email and try again.' });
  otps.delete(email);
  const user = upsertUser({ email, name: clean(req.body.name, 60), role: req.body.role, verified: true });
  res.json({ token: await issueSession(user), user: publicUser(user) });
});
const firebaseJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
app.post('/api/auth/firebase', limit('fb', 20), async (req, res) => {
  if (!FIREBASE) return res.status(400).json({ error: 'Firebase sign-in is not configured on this server.' });
  try {
    const { payload } = await jwtVerify(String(req.body.idToken || ''), firebaseJwks, {
      issuer: `https://securetoken.google.com/${FIREBASE.projectId}`, audience: FIREBASE.projectId,
    });
    if (!payload.email) return res.status(400).json({ error: 'This account has no email address.' });
    const user = upsertUser({ email: payload.email, name: clean(req.body.name || payload.name, 60), role: req.body.role, verified: !!payload.email_verified, firebaseUid: payload.sub });
    res.json({ token: await issueSession(user), user: publicUser(user) });
  } catch { res.status(401).json({ error: 'Sign-in could not be verified. Try again.' }); }
});
function upsertUser({ email, name, role, verified, firebaseUid }) {
  let u = db.users.find((x) => x.email === email);
  if (!u) {
    u = { id: newId('u'), email, name: name || email.split('@')[0], role: role === 'buyer' ? 'buyer' : 'seller', ward: 'Ward 12', joined: Date.now(), verified };
    db.users.push(u); wallet(u.id);
  } else {
    if (name) u.name = name;
    if (role === 'buyer' || role === 'seller') u.role = role;
    u.verified = u.verified || verified;
  }
  if (firebaseUid) u.firebaseUid = firebaseUid;
  saveDb(db); return u;
}
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user), wallet: wallet(req.user.id) }));
app.patch('/api/me', auth, (req, res) => {
  if (req.body.role === 'buyer' || req.body.role === 'seller') req.user.role = req.body.role;
  if (req.body.name) req.user.name = clean(req.body.name, 60);
  if (req.body.ward) req.user.ward = clean(req.body.ward, 40);
  saveDb(db); res.json({ user: publicUser(req.user) });
});

// ---------- AI (Gemini) ----------
const SCAN_PROMPT = `You are EcoSync's recycling expert for India. Look at the photo and identify the main waste item.
Reply ONLY with JSON of this shape:
{"item": string, "material": one of ["paper","cardboard","pet","hdpe","ldpe","pp","ps","mixed_plastic","aluminium","steel","copper","glass","e_waste","battery","textile","organic","other"],
 "resinCode": number|null (1-7 if plastic), "recyclable": boolean, "hazard": string|null,
 "condition": "clean"|"needs_rinse"|"contaminated", "estWeightKg": number, "confidence": number (0-1),
 "steps": [3 short disposal/prep steps], "upcycle": [2 short upcycling ideas], "funFact": string}`;
app.post('/api/ai/scan', limit('ai', 15), async (req, res) => {
  const { image, mime = 'image/jpeg', hint = '' } = req.body || {};
  if (!image || image.length > 7_000_000) return res.status(400).json({ error: 'Add a photo under 5 MB.' });
  let r;
  if (aiEnabled()) {
    try { r = await gemini({ prompt: SCAN_PROMPT + (hint ? `\nUser hint: ${clean(hint, 120)}` : ''), image, mime, json: true }); }
    catch (e) { return res.status(502).json({ error: 'The AI scanner is busy. Try again in a moment.', detail: e.message }); }
  } else r = demoScan(hint);
  const key = materialKey(r.material);
  const kg = Math.max(0.05, num(r.estWeightKg, 0.5));
  res.json({ ...r, material: key, pricePerKg: PRICES[key]?.rate ?? 0, estValue: Math.round((PRICES[key]?.rate ?? 0) * kg), co2SavedKg: +(kg * (CO2_PER_KG[key] ?? 0.5)).toFixed(2), coins: Math.round(kg * 10) + 5, demo: !aiEnabled() });
});
app.post('/api/ai/chat', limit('ai', 20), async (req, res) => {
  const msgs = (req.body.messages || []).slice(-12).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: clean(m.text, 1200) }));
  if (!msgs.length) return res.status(400).json({ error: 'Type a question first.' });
  if (!aiEnabled()) return res.json({ text: demoChat(msgs.at(-1).text), demo: true });
  try {
    const text = await gemini({
      system: 'You are EcoBot, the friendly assistant inside EcoSync, a waste-recycling app in India. Answer in the language the user writes in (Hindi, Hinglish or English). Keep answers under 120 words, practical, with local context (kabadiwala rates, municipal rules, e-waste rules). Use short bullet points when listing.',
      history: msgs,
    });
    res.json({ text });
  } catch (e) { res.status(502).json({ error: 'EcoBot could not answer right now. Try again.', detail: e.message }); }
});
app.post('/api/ai/upcycle', limit('aiimg', 6), async (req, res) => {
  const item = clean(req.body.item, 80) || 'plastic bottle';
  const wantImage = !!req.body.image;
  if (!aiEnabled()) return res.json({ ...demoUpcycle(item), demo: true });
  try {
    const ideas = await gemini({ prompt: `Give 3 creative, safe upcycling projects a student can make at home from: ${item}. JSON: {"ideas":[{"title":string,"time":string,"steps":[3 strings]}]}`, json: true });
    let img = null;
    if (wantImage && ideas.ideas?.[0]) {
      img = await geminiImage(`A clean, bright product photo of a handmade upcycled ${ideas.ideas[0].title} made from a ${item}, on a light wooden desk, soft daylight, minimal background`).catch(() => null);
    }
    res.json({ ...ideas, image: img });
  } catch (e) { res.status(502).json({ error: 'Upcycle Studio is busy. Try again.', detail: e.message }); }
});
app.post('/api/ai/parse-listing', limit('ai', 15), async (req, res) => {
  const text = clean(req.body.text, 400);
  if (!text) return res.status(400).json({ error: 'Say or type what you want to sell.' });
  if (!aiEnabled()) return res.json({ ...demoParse(text), demo: true });
  try {
    const r = await gemini({ prompt: `Turn this spoken scrap listing (may be Hindi/Hinglish) into JSON {"title":string,"material":one of [paper,cardboard,pet,hdpe,aluminium,steel,copper,glass,e_waste,textile,mixed_plastic,other],"kg":number,"notes":string}. Text: "${text}"`, json: true });
    res.json({ ...r, material: materialKey(r.material) });
  } catch (e) { res.status(502).json({ error: 'Could not understand that. Try typing it.', detail: e.message }); }
});
app.post('/api/ai/image', limit('aiimg', 6), async (req, res) => {
  if (!aiEnabled()) return res.status(400).json({ error: 'Add GEMINI_API_KEY to generate images.' });
  try { res.json({ image: await geminiImage(clean(req.body.prompt, 500)) }); }
  catch (e) { res.status(502).json({ error: 'Image generation failed. Try again.', detail: e.message }); }
});

// ---------- recycling hubs (OpenStreetMap) ----------
app.get('/api/hubs', limit('hubs', 30), async (req, res) => {
  const lat = num(req.query.lat, 28.6139), lng = num(req.query.lng, 77.209), r = Math.min(num(req.query.r, 8000), 25000);
  res.json(await findHubs(lat, lng, r));
});

// ---------- marketplace ----------
function listingView(l, here) {
  return { ...l, distanceKm: here ? +haversineKm(here, l).toFixed(1) : null, seller: publicUser(db.users.find((u) => u.id === l.sellerId)) || { name: l.sellerName } };
}
app.get('/api/listings', (req, res) => {
  const here = req.query.lat ? { lat: num(req.query.lat), lng: num(req.query.lng) } : null;
  let items = db.listings.filter((l) => l.status !== 'removed');
  if (here && !items.some((l) => !l.demo && haversineKm(here, l) < 30)) items = items.concat(seedListingsNear(here));
  if (req.query.material) items = items.filter((l) => l.material === req.query.material);
  if (req.query.mine && req.query.uid) items = items.filter((l) => l.sellerId === req.query.uid || l.buyerId === req.query.uid);
  items = items.map((l) => listingView(l, here));
  if (here) items.sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || a.distanceKm - b.distanceKm);
  res.json({ listings: items.slice(0, 80) });
});
app.post('/api/listings', auth, (req, res) => {
  const b = req.body; const material = materialKey(b.material); const kg = Math.max(0.1, Math.min(num(b.kg, 1), 2000));
  const price = Math.max(0, Math.round(num(b.price, (PRICES[material]?.rate || 5) * kg)));
  const l = {
    id: newId('l'), title: clean(b.title, 80) || `${PRICES[material]?.label || 'Scrap'} · ${kg} kg`, material, kg, price,
    lat: num(b.lat, 28.6139), lng: num(b.lng, 77.209), area: clean(b.area, 60) || 'Nearby', notes: clean(b.notes, 280),
    photo: typeof b.photo === 'string' && b.photo.startsWith('data:image') && b.photo.length < 400_000 ? b.photo : null,
    sellerId: req.user.id, sellerName: req.user.name, status: 'open', createdAt: Date.now(), ai: b.ai || null,
  };
  db.listings.unshift(l); award(req.user.id, 5, `Listed ${l.title}`); saveDb(db);
  res.json({ listing: listingView(l) });
});
app.patch('/api/listings/:id', auth, (req, res) => {
  const l = db.listings.find((x) => x.id === req.params.id);
  if (!l || l.sellerId !== req.user.id) return res.status(404).json({ error: 'Listing not found.' });
  if (req.body.status === 'removed' && l.status === 'open') l.status = 'removed';
  if (req.body.price != null) l.price = Math.max(0, Math.round(num(req.body.price, l.price)));
  saveDb(db); res.json({ listing: listingView(l) });
});
// Demo listings are created on request near the buyer. Buying one materialises it.
function resolveListing(id, body) {
  let l = db.listings.find((x) => x.id === id);
  if (!l && id.startsWith('demo_') && body?.snapshot) {
    const s = body.snapshot;
    l = { id, title: clean(s.title, 80), material: materialKey(s.material), kg: num(s.kg, 1), price: num(s.price, 10), lat: num(s.lat), lng: num(s.lng), area: clean(s.area, 60), notes: clean(s.notes, 280), sellerId: 'demo_seller', sellerName: clean(s.sellerName, 40) || 'Demo seller', status: 'open', createdAt: Date.now(), demo: true };
    db.listings.push(l);
  }
  return l;
}

// ---------- payments (Razorpay, escrow released on QR handshake) ----------
app.post('/api/pay/order', auth, limit('pay', 20), async (req, res) => {
  const l = resolveListing(String(req.body.listingId || ''), req.body);
  if (!l || l.status !== 'open') return res.status(400).json({ error: 'This listing is no longer available.' });
  if (l.sellerId === req.user.id) return res.status(400).json({ error: 'You cannot buy your own listing.' });
  const amount = Math.max(100, Math.round(l.price * 100)); // paise; Razorpay minimum is ₹1
  if (!RAZORPAY) return res.json({ mode: 'demo', orderId: newId('demo_order'), amount, currency: 'INR', listing: l });
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${RAZORPAY.id}:${RAZORPAY.secret}`).toString('base64'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'INR', receipt: l.id.slice(0, 40), notes: { listing: l.id, buyer: req.user.id } }),
  }).catch(() => null);
  const data = r && (await r.json().catch(() => null));
  if (!r?.ok || !data?.id) return res.status(502).json({ error: 'Payment could not start. Try again.' });
  db.orders[data.id] = { listingId: l.id, buyerId: req.user.id, amount };
  saveDb(db);
  res.json({ mode: 'razorpay', orderId: data.id, amount, currency: 'INR', keyId: RAZORPAY.id, listing: l });
});
app.post('/api/pay/verify', auth, async (req, res) => {
  const b = req.body; const l = resolveListing(String(b.listingId || ''), b);
  if (!l || l.status !== 'open') return res.status(400).json({ error: 'This listing is no longer available.' });
  let paymentRef;
  if (RAZORPAY) {
    const expected = crypto.createHmac('sha256', RAZORPAY.secret).update(`${b.razorpay_order_id}|${b.razorpay_payment_id}`).digest('hex');
    const sig = String(b.razorpay_signature || '');
    const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    const order = db.orders[b.razorpay_order_id];
    if (!ok || !order || order.listingId !== l.id || order.buyerId !== req.user.id) return res.status(400).json({ error: 'Payment could not be verified. You have not been charged twice; contact support if money left your account.' });
    paymentRef = b.razorpay_payment_id;
  } else {
    if (!b.demo) return res.status(400).json({ error: 'Demo payment flag missing.' });
    paymentRef = newId('demo_pay');
  }
  const pid = passportId();
  const handshake = String(crypto.randomInt(100000, 999999));
  const co2 = +(l.kg * (CO2_PER_KG[l.material] ?? 0.5)).toFixed(2);
  db.passports[pid] = {
    id: pid, listingId: l.id, material: l.material, kg: l.kg, title: l.title, amount: l.price, co2,
    sellerId: l.sellerId, buyerId: req.user.id, sellerName: l.sellerName, buyerName: req.user.name, handshake,
    escrow: 'held', paymentRef, paymentMode: RAZORPAY ? 'razorpay' : 'demo',
    events: [
      { stage: 'listed', at: l.createdAt, note: l.demo ? 'Listed by a nearby seller' : `Listed in ${l.area}` },
      { stage: 'paid', at: Date.now(), note: `₹${l.price} paid and held safely until pickup` },
    ],
  };
  l.status = 'reserved'; l.buyerId = req.user.id; l.passportId = pid;
  award(req.user.id, 10, `Bought ${l.title}`);
  saveDb(db);
  res.json({ passport: passportView(db.passports[pid], req.user.id) });
});
function passportView(p, viewerId) {
  const mine = viewerId && (viewerId === p.sellerId || viewerId === p.buyerId);
  const { handshake, sellerId, buyerId, ...pub } = p;
  return {
    ...pub, role: viewerId === p.sellerId ? 'seller' : viewerId === p.buyerId ? 'buyer' : 'public',
    handshake: mine && viewerId === p.sellerId ? handshake : undefined,
    // Sample lots have no real seller to show a QR, so the buyer gets the code to demo the flow.
    demoHandshake: sellerId === 'demo_seller' && viewerId === buyerId ? handshake : undefined,
  };
}
app.get('/api/passport/:id', async (req, res) => {
  const p = db.passports[req.params.id.toUpperCase()];
  if (!p) return res.status(404).json({ error: 'No passport with that ID. Check the code on the QR label.' });
  let viewer = null;
  try { const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); if (t) viewer = (await jwtVerify(t, SESSION_SECRET)).payload.uid; } catch {}
  res.json({ passport: passportView(p, viewer) });
});
app.get('/api/passports/mine', auth, (req, res) => {
  res.json({ passports: Object.values(db.passports).filter((p) => p.sellerId === req.user.id || p.buyerId === req.user.id).sort((a, b) => b.events.at(-1).at - a.events.at(-1).at).map((p) => passportView(p, req.user.id)) });
});
// Buyer scans the seller's handshake QR at pickup -> escrow released to seller.
app.post('/api/passport/:id/handshake', auth, (req, res) => {
  const p = db.passports[req.params.id.toUpperCase()];
  if (!p) return res.status(404).json({ error: 'Passport not found.' });
  if (p.buyerId !== req.user.id) return res.status(403).json({ error: 'Only the buyer can confirm this pickup.' });
  if (p.escrow === 'released') return res.json({ passport: passportView(p, req.user.id) });
  if (String(req.body.code) !== p.handshake) return res.status(400).json({ error: 'That handshake code does not match. Ask the seller to show their QR again.' });
  p.escrow = 'released';
  p.events.push({ stage: 'picked', at: Date.now(), note: 'Pickup confirmed by QR handshake. Payment released to seller.' });
  if (p.sellerId !== 'demo_seller') award(p.sellerId, Math.round(p.kg * 10) + 20, `Sold ${p.title}`, { kg: p.kg, co2: p.co2 });
  award(p.buyerId, 15, `Collected ${p.title}`, { kg: p.kg, co2: p.co2 });
  const l = db.listings.find((x) => x.id === p.listingId); if (l) l.status = 'sold';
  saveDb(db); res.json({ passport: passportView(p, req.user.id) });
});
app.post('/api/passport/:id/event', auth, (req, res) => {
  const p = db.passports[req.params.id.toUpperCase()];
  if (!p || p.buyerId !== req.user.id) return res.status(403).json({ error: 'Only the buyer can update this passport.' });
  const stage = ['hub', 'processed', 'reborn'].includes(req.body.stage) ? req.body.stage : null;
  if (!stage) return res.status(400).json({ error: 'Unknown stage.' });
  p.events.push({ stage, at: Date.now(), note: clean(req.body.note, 200) || { hub: 'Delivered to recycling hub', processed: 'Sorted and processed', reborn: 'Turned into a new product' }[stage] });
  saveDb(db); res.json({ passport: passportView(p, req.user.id) });
});

// ---------- pickups with Green Route bonus ----------
const SLOTS = ['08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00', '18:00–20:00'];
app.get('/api/pickups/slots', (req, res) => {
  const date = clean(req.query.date, 10); const here = { lat: num(req.query.lat, 28.6139), lng: num(req.query.lng, 77.209) };
  const seedRoute = (s) => (parseInt(crypto.createHash('md5').update(date + s).digest('hex').slice(0, 2), 16) % 3 === 0);
  res.json({
    slots: SLOTS.map((s) => {
      const near = db.pickups.filter((p) => p.date === date && p.slot === s && p.status !== 'cancelled' && haversineKm(here, p) < 2.5).length;
      const greenRoute = near > 0 || seedRoute(s);
      return { slot: s, booked: near, greenRoute, bonus: greenRoute ? 25 : 0, full: near >= 12 };
    }),
  });
});
app.post('/api/pickups', auth, (req, res) => {
  const b = req.body;
  if (!SLOTS.includes(b.slot) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Pick a date and a time slot.' });
  const p = {
    id: newId('pk'), userId: req.user.id, date: b.date, slot: b.slot, lat: num(b.lat, 28.6139), lng: num(b.lng, 77.209),
    address: clean(b.address, 160) || 'Pinned location', materials: (b.materials || []).map(materialKey).slice(0, 8), estKg: num(b.estKg, 2),
    greenRoute: !!b.greenRoute, status: 'scheduled', createdAt: Date.now(), code: String(crypto.randomInt(1000, 9999)),
  };
  db.pickups.unshift(p);
  award(req.user.id, 10 + (p.greenRoute ? 25 : 0), p.greenRoute ? 'Pickup booked on a Green Route' : 'Pickup booked');
  saveDb(db); res.json({ pickup: p });
});
app.get('/api/pickups/mine', auth, (req, res) => res.json({ pickups: db.pickups.filter((p) => p.userId === req.user.id) }));
app.patch('/api/pickups/:id', auth, (req, res) => {
  const p = db.pickups.find((x) => x.id === req.params.id && x.userId === req.user.id);
  if (!p) return res.status(404).json({ error: 'Pickup not found.' });
  if (req.body.status === 'cancelled' && p.status === 'scheduled') p.status = 'cancelled';
  if (req.body.status === 'completed' && p.status === 'scheduled') { p.status = 'completed'; award(req.user.id, Math.round(p.estKg * 8), 'Pickup completed', { kg: p.estKg, co2: +(p.estKg * 1.2).toFixed(1) }); }
  saveDb(db); res.json({ pickup: p });
});

// ---------- litter reports for the 3D map ----------
app.get('/api/reports', (req, res) => {
  const here = { lat: num(req.query.lat, 28.6139), lng: num(req.query.lng, 77.209) };
  let items = db.reports.filter((r) => haversineKm(here, r) < 20);
  if (!items.length) items = seedReportsNear(here);
  res.json({ reports: items.map(({ photo, ...r }) => ({ ...r, hasPhoto: !!photo })) });
});
function seedReportsNear(c) {
  const pts = [[0.004, 0.003, 3, 'plastic'], [-0.006, 0.002, 2, 'mixed'], [0.002, -0.007, 1, 'paper'], [-0.003, -0.004, 3, 'e_waste'], [0.008, -0.002, 2, 'construction'], [0.006, 0.008, 1, 'organic'], [-0.009, 0.007, 2, 'plastic']];
  return pts.map(([a, b, s, t], i) => ({ id: `demo_r${i}`, lat: c.lat + a, lng: c.lng + b, severity: s, type: t, note: 'Sample report', confirms: 3 + i, status: i === 5 ? 'cleaned' : 'open', at: Date.now() - i * 36e5 * 7, demo: true }));
}
app.post('/api/reports', auth, limit('rep', 10), (req, res) => {
  const b = req.body;
  const r = {
    id: newId('r'), lat: num(b.lat), lng: num(b.lng), severity: Math.min(3, Math.max(1, num(b.severity, 2))), type: clean(b.type, 20) || 'mixed', note: clean(b.note, 200),
    photo: typeof b.photo === 'string' && b.photo.startsWith('data:image') && b.photo.length < 400_000 ? b.photo : null,
    by: req.user.id, confirms: 1, status: 'open', at: Date.now(),
  };
  if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return res.status(400).json({ error: 'Tap the map to place the report.' });
  db.reports.unshift(r); award(req.user.id, 15, 'Reported a litter spot'); saveDb(db);
  const { photo, ...pub } = r; res.json({ report: pub });
});
app.post('/api/reports/:id/:action', auth, (req, res) => {
  const r = db.reports.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Report not found.' });
  if (req.params.action === 'confirm') { r.confirms++; award(req.user.id, 2, 'Confirmed a litter spot'); }
  if (req.params.action === 'clean' && r.status === 'open') { r.status = 'cleaned'; award(req.user.id, 40, 'Cleaned a litter spot'); }
  saveDb(db); const { photo, ...pub } = r; res.json({ report: pub });
});

// ---------- wallet, rewards, leaderboard ----------
const REWARDS = [
  { id: 'tree', title: 'Plant a sapling in your ward', cost: 300, kind: 'impact' },
  { id: 'metro', title: '₹50 metro card top-up', cost: 500, kind: 'voucher' },
  { id: 'books', title: 'Recycled-paper notebook set', cost: 250, kind: 'goods' },
  { id: 'bag', title: 'Jute tote bag', cost: 180, kind: 'goods' },
  { id: 'school', title: 'Donate to a school eco-club', cost: 200, kind: 'impact' },
  { id: 'data', title: '1 GB mobile data pack', cost: 400, kind: 'voucher' },
];
app.get('/api/wallet', auth, (req, res) => res.json({ wallet: wallet(req.user.id), rewards: REWARDS }));
app.post('/api/rewards/redeem', auth, (req, res) => {
  const r = REWARDS.find((x) => x.id === req.body.id); const w = wallet(req.user.id);
  if (!r) return res.status(404).json({ error: 'Reward not found.' });
  if (w.coins < r.cost) return res.status(400).json({ error: `You need ${r.cost - w.coins} more EcoCoins for this.` });
  award(req.user.id, -r.cost, `Redeemed: ${r.title}`);
  const code = 'ECO-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  saveDb(db); res.json({ wallet: w, code });
});
app.get('/api/leaderboard', (req, res) => {
  const wards = {};
  for (const u of db.users) { const w = wallet(u.id); wards[u.ward] = (wards[u.ward] || 0) + w.kg; }
  const seed = [['Ward 7 · Green Park', 412], ['Ward 12 · Civil Lines', 388], ['Ward 3 · Model Town', 351], ['Ward 19 · Sadar Bazaar', 297], ['Ward 24 · Nehru Nagar', 260], ['Ward 9 · Rajendra Nagar', 214]];
  const board = seed.map(([w, kg]) => ({ ward: w, kg: Math.round(kg + (wards[w.split(' · ')[0]] || 0)) }));
  const people = db.users.map((u) => ({ name: u.name, ward: u.ward, kg: +wallet(u.id).kg.toFixed(1), coins: wallet(u.id).coins })).sort((a, b) => b.coins - a.coins).slice(0, 10);
  res.json({ wards: board.sort((a, b) => b.kg - a.kg), people });
});
app.get('/api/stats', (req, res) => {
  const kg = Object.values(db.wallets).reduce((s, w) => s + w.kg, 0);
  res.json({ users: db.users.length, kg: Math.round(kg), co2: Math.round(Object.values(db.wallets).reduce((s, w) => s + w.co2, 0)), passports: Object.keys(db.passports).length });
});

// ---------- static frontend ----------
const pub = path.join(__dirname, 'public');
app.use(express.static(pub, { maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('sw.js') || p.endsWith('.html')) res.set('Cache-Control', 'no-cache'); } }));
app.get('/download/android', (req, res) => {
  const apk = path.join(pub, 'downloads', 'EcoSync.apk');
  fs.existsSync(apk) ? res.download(apk, 'EcoSync.apk') : res.status(404).send('APK not uploaded yet. Build it from the GitHub Actions tab.');
});
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(pub, 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong on our side. Try again.' }); });

app.listen(PORT, () => console.log(`EcoSync running on http://localhost:${PORT}  auth=${authMode} ai=${aiEnabled() ? 'gemini' : 'demo'} payments=${RAZORPAY ? 'razorpay' : 'demo'}`));
