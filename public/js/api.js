// API client. Talks to the EcoSync server; when none is reachable (a static preview)
// it falls back to an in-browser backend that stores data in this browser only.
import { mock } from './mock.js';

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem('ecosync.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ecosync.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('ecosync.' + k); } catch {} },
};
const params = new URLSearchParams(location.search);
if (params.get('api')) store.set('api', params.get('api').replace(/\/$/, ''));
export let BASE = store.get('api', '');
export let backend = 'server';

export async function detect() {
  try {
    const r = await fetch(BASE + '/api/config', { signal: AbortSignal.timeout(6000) });
    const cfg = r.ok ? await r.json() : null;
    if (cfg?.app !== 'EcoSync') throw new Error();
    backend = 'server'; return cfg;
  } catch { backend = 'preview'; return mock('GET', '/api/config'); }
}
export function setBase(url) { BASE = (url || '').replace(/\/$/, ''); store.set('api', BASE); }

export async function api(method, path, body) {
  const token = store.get('token');
  if (backend === 'preview') {
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 200));
    const out = await mock(method, path, body, token);
    if (out && out.__status) { const e = new Error(out.error); e.status = out.__status; throw e; }
    return out;
  }
  const r = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  if (!r) { const e = new Error('No connection. Check your internet and try again.'); e.status = 0; throw e; }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || `Request failed (${r.status})`); e.status = r.status; throw e; }
  return data;
}
export const get = (p) => api('GET', p);
export const post = (p, b) => api('POST', p, b || {});
export const patch = (p, b) => api('PATCH', p, b || {});
