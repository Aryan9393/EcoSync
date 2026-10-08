// A small JSON-file store. Good for demos and the competition; swap for Firestore/Postgres in production.
// On Render's free plan the disk resets on each deploy — attach a Render Disk at /var/data to keep data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIR = process.env.DATA_DIR || (fs.existsSync('/var/data') ? '/var/data' : path.resolve('data'));
const FILE = path.join(DIR, 'db.json');
const EMPTY = { users: [], wallets: {}, listings: [], pickups: [], reports: [], passports: {}, orders: {} };

export function loadDb() {
  try { fs.mkdirSync(DIR, { recursive: true }); return { ...EMPTY, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch { return structuredClone(EMPTY); }
}
let timer = null;
export function saveDb(db) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(db)); fs.renameSync(FILE + '.tmp', FILE); } catch (e) { console.error('db save failed', e.message); }
  }, 150);
}
export const newId = (p) => `${p}_${crypto.randomBytes(6).toString('hex')}`;
export function passportId() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = () => Array.from({ length: 4 }, () => a[crypto.randomInt(a.length)]).join('');
  return `ES-${pick()}-${pick()}`;
}

// Sample listings placed around whoever is looking, so the market never opens empty.
const SAMPLES = [
  ['Newspapers, 3 months', 'paper', 9, 'Sunita R.', 0.006, 0.004, 'Tied in bundles, dry.'],
  ['Amazon cartons, flattened', 'cardboard', 6, 'Kabir S.', -0.004, 0.007, 'About 25 boxes.'],
  ['Rinsed PET bottles', 'pet', 3.5, 'Green Hostel Block B', 0.009, -0.003, 'Labels removed, caps separate.'],
  ['Old laptop + chargers', 'e_waste', 4, 'Meera J.', -0.008, -0.006, 'Not working. Hard disk wiped.'],
  ['Aluminium cans', 'aluminium', 1.8, 'Café Brewhouse', 0.002, -0.011, 'Crushed, collected weekly.'],
  ['Copper wire offcuts', 'copper', 0.7, 'Electrician Ravi', -0.012, 0.002, 'From house rewiring.'],
  ['Glass jars & bottles', 'glass', 7, 'Sharma family', 0.013, 0.01, 'Clean, no lids.'],
  ['Old cotton clothes', 'textile', 5, 'Ananya P.', -0.002, 0.014, 'Usable for rags or donation.'],
  ['HDPE milk & oil cans', 'hdpe', 2.4, 'Gupta Dairy', 0.015, -0.009, 'Washed.'],
];
const RATES = { paper: 14, cardboard: 10, pet: 22, e_waste: 45, aluminium: 110, copper: 560, glass: 3, textile: 8, hdpe: 26 };
export function seedListingsNear(c) {
  return SAMPLES.map(([title, material, kg, sellerName, a, b, notes], i) => ({
    id: `demo_${i}`, title, material, kg, price: Math.round(RATES[material] * kg), lat: c.lat + a, lng: c.lng + b,
    area: 'Sample listing', notes, sellerId: 'demo_seller', sellerName, status: i === 4 ? 'reserved' : 'open',
    createdAt: Date.now() - (i + 1) * 3.6e6 * 5, demo: true,
  }));
}
