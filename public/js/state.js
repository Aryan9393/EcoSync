import { store, get } from './api.js';

export const S = {
  config: null,
  user: store.get('user'),
  wallet: null,
  loc: store.get('loc', { lat: 28.6139, lng: 77.209, approx: true }),
  isApp: /[?&]app=android/.test(location.search) || store.get('isApp', false),
};
if (S.isApp) store.set('isApp', true);

export const PRICES = () => S.config?.prices || {};
export const matLabel = (m) => PRICES()[m]?.label || 'Other';
export const matColor = (m) => PRICES()[m]?.color || '#a1a1aa';

let locating = null;
export function locate(force = false) {
  if (!force && !S.loc.approx) return Promise.resolve(S.loc);
  if (locating) return locating;
  locating = new Promise((res) => {
    if (!navigator.geolocation) return res(S.loc);
    navigator.geolocation.getCurrentPosition(
      (p) => { S.loc = { lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), approx: false }; store.set('loc', S.loc); res(S.loc); },
      () => res(S.loc), { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 });
  }).finally(() => { locating = null; });
  return locating;
}

export async function refreshMe() {
  if (!store.get('token')) return;
  try { const r = await get('/api/me'); S.user = r.user; S.wallet = r.wallet; store.set('user', r.user); }
  catch (e) { if (e.status === 401) signOutLocal(); }
}
export function signOutLocal() { store.del('token'); store.del('user'); S.user = null; S.wallet = null; }
export const tier = (coins) => {
  const T = [['Seedling', 0], ['Sapling', 500], ['Grove', 1500], ['Forest', 4000], ['Biosphere', 10000]];
  let i = T.findLastIndex(([, c]) => coins >= c);
  const [name, min] = T[i]; const next = T[i + 1];
  return { name, next: next?.[0], need: next ? next[1] - coins : 0, pct: next ? Math.min(100, ((coins - min) / (next[1] - min)) * 100) : 100 };
};
