import { icon } from './icons.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const kg = (n) => { const v = +n || 0; return `${v >= 10 ? Math.round(v) : v.toFixed(v < 1 ? 2 : 1)} kg`; };
export const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`; return `${Math.round(s / 86400)} d ago`;
};
export const when = (t) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const dayLabel = (iso) => new Date(iso + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'err' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), type === 'err' ? 5000 : 3200);
}

// Modal sheet. body is an HTML string; onMount(el, close) wires it up.
export function sheet({ title, sub = '', body, wide = false, small = false, onMount, onClose, cls = '' }) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="sheet ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><div><h2 class="${small ? 'small' : ''}">${esc(title)}</h2>${sub ? `<p class="muted" style="margin-top:8px;font-size:13px">${sub}</p>` : ''}</div>
    <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>${body}</div>`;
  let closed = false;
  const close = () => { if (closed) return; closed = true; scrim.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => e.key === 'Escape' && close();
  scrim.addEventListener('click', (e) => { if (e.target === scrim || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  $('#sheet-root').append(scrim);
  const el = scrim.querySelector('.sheet');
  el._close = close;
  onMount?.(el, close);
  setTimeout(() => el.querySelector('input:not([type=file]),textarea')?.focus(), 80);
  return { el, close };
}
export const closeSheets = () => $$('#sheet-root .sheet').forEach((s) => s._close?.());

export function qrSvg(text) {
  if (!window.qrcode) return `<div class="mono" style="color:#000;font-size:10px;padding:6px;word-break:break-all">${esc(text)}</div>`;
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
export function qrPng(text, size = 720) {
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), pad = 4, s = size / (n + pad * 2);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#0a0a0a';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + pad) * s, (r + pad) * s, Math.ceil(s), Math.ceil(s));
  return c.toDataURL('image/png');
}
export function fileToDataUrl(file, max = 1024, q = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = rej; img.src = url;
  });
}
export function videoFrame(video, max = 1024) {
  const s = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
  const c = document.createElement('canvas'); c.width = Math.round(video.videoWidth * s); c.height = Math.round(video.videoHeight * s);
  c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
export function decodeQrFromDataUrl(dataUrl) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      res(window.jsQR?.(d.data, d.width, d.height)?.data || null);
    };
    img.onerror = () => res(null); img.src = dataUrl;
  });
}
export function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="spinner"></span>${label ? `<span>${esc(label)}</span>` : ''}`; btn.disabled = true; }
  else { if (btn.dataset.label) btn.innerHTML = btn.dataset.label; btn.disabled = false; }
}
export const resinGlyph = (n) => `<span class="resin" title="Resin code ${n}"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M22 5 39 35H5z"/></svg><span>${n}</span></span>`;
const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); }; document.head.append(s); });
  return loaded[src];
}
export function loadCss(href) {
  if ($(`link[href="${href}"]`)) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.append(l);
}
// Hand-drawn ellipse annotation (red ink by default), placed over an element.
export const scribbleEllipse = (cls = '', box) => `<svg class="annot ${cls}" ${box ? `style="inset:auto;top:${box[0]}%;left:${box[1]}%;width:${box[2]}%;height:${box[3]}%"` : ''} viewBox="0 0 100 60" preserveAspectRatio="none" fill="none"><path d="M12 34C8 18 40 8 66 10s30 14 26 26-36 16-58 12S6 30 20 18" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" vector-effect="non-scaling-stroke" style="stroke-width:1.8px"/></svg>`;
