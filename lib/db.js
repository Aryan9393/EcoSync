// Postgres data layer.
// • DATABASE_URL set (e.g. your Neon connection string) → node-postgres pool, data lives in Neon.
// • No DATABASE_URL → PGlite (real Postgres compiled to WebAssembly) stored in ./data/pglite,
//   so the app runs anywhere with zero setup. Same SQL either way.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let query = null;
export let dbMode = 'local';

export async function initDb() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: pg } = await import('pg');
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 20_000, ssl: local ? false : { rejectUnauthorized: false } });
    pool.on('error', (e) => console.error('pg pool error', e.message));
    query = async (sql, params = []) => (await pool.query(sql, params)).rows;
    dbMode = /neon\.tech/.test(url) ? 'neon' : 'postgres';
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.DATA_DIR || path.resolve('data/pglite');
    fs.mkdirSync(dir, { recursive: true });
    const db = new PGlite(dir);
    await db.waitReady;
    query = async (sql, params = []) => (await db.query(sql, params)).rows;
    dbMode = 'local';
  }
  for (const stmt of SCHEMA) await query(stmt);
  return dbMode;
}
export const q = (sql, params) => query(sql, params);
export const one = async (sql, params) => (await query(sql, params))[0] || null;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (
     id text PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, role text NOT NULL DEFAULT 'seller',
     ward text NOT NULL DEFAULT '', upi text NOT NULL DEFAULT '', pass_hash text NOT NULL,
     coins integer NOT NULL DEFAULT 0, kg real NOT NULL DEFAULT 0, co2 real NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS txns (
     id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     coins integer NOT NULL, note text NOT NULL, kg real NOT NULL DEFAULT 0, co2 real NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS txns_user ON txns(user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS listings (
     id text PRIMARY KEY, seller_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title text NOT NULL, material text NOT NULL, kg real NOT NULL, price integer NOT NULL,
     lat double precision NOT NULL, lng double precision NOT NULL, area text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
     photo text, status text NOT NULL DEFAULT 'open', buyer_id text REFERENCES users(id), passport_id text,
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS listings_status ON listings(status, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS passports (
     id text PRIMARY KEY, listing_id text NOT NULL REFERENCES listings(id), title text NOT NULL, material text NOT NULL,
     kg real NOT NULL, amount integer NOT NULL, co2 real NOT NULL, seller_id text NOT NULL REFERENCES users(id), buyer_id text NOT NULL REFERENCES users(id),
     pay_method text NOT NULL, pay_ref text NOT NULL DEFAULT '', pay_confirmed boolean NOT NULL DEFAULT false,
     handshake text NOT NULL, status text NOT NULL DEFAULT 'awaiting_pickup', events jsonb NOT NULL DEFAULT '[]'::jsonb,
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS pickups (
     id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, date text NOT NULL, slot text NOT NULL,
     lat double precision NOT NULL, lng double precision NOT NULL, address text NOT NULL DEFAULT '', materials jsonb NOT NULL DEFAULT '[]'::jsonb,
     est_kg real NOT NULL DEFAULT 1, green_route boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'scheduled', code text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS pickups_slot ON pickups(date, slot)`,
  `CREATE TABLE IF NOT EXISTS reports (
     id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     lat double precision NOT NULL, lng double precision NOT NULL, severity integer NOT NULL, type text NOT NULL,
     note text NOT NULL DEFAULT '', photo text, confirms integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'open',
     created_at timestamptz NOT NULL DEFAULT now())`,
];

// Session signing secret: SESSION_SECRET if given, otherwise generated once and kept in the database.
export async function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const row = await one(`SELECT value FROM settings WHERE key = 'session_secret'`);
  if (row) return row.value;
  const v = crypto.randomBytes(32).toString('hex');
  await q(`INSERT INTO settings(key, value) VALUES ('session_secret', $1) ON CONFLICT (key) DO NOTHING`, [v]);
  return (await one(`SELECT value FROM settings WHERE key = 'session_secret'`)).value;
}

export const newId = (p) => `${p}_${crypto.randomBytes(6).toString('hex')}`;
export function passportId() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = () => Array.from({ length: 4 }, () => a[crypto.randomInt(a.length)]).join('');
  return `ES-${pick()}-${pick()}`;
}
export const ms = (d) => (d ? new Date(d).getTime() : null);
