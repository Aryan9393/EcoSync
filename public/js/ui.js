import { icon } from './icons.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const kg = (n) => `${(+n || 0) >= 10 ? Math.round(n) : (+n || 0).toFixed(1)} kg`;
export const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`; return `${Math.round(s / 86400)} d ago`;
};
export const when = (t) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type === 'ok' ? icon('check') : type === 'err' ? icon('alert') : icon('spark')}<span>${esc(msg)}</span>`;
  el.querySelector('svg').style.cssText = 'width:18px;height:18px;flex:none;color:' + (type === 'err' ? 'var(--danger)' : 'var(--accent)');
  $('#toasts').append(el);
  setTimeout(() => el.remove(), type === 'err' ? 5200 : 3400);
}

// Modal sheet. Returns {el, close}. Content is HTML string; onMount wires events.
export function sheet({ title, sub = '', body, wide = false, onMount, onClose }) {
  const root = $('#sheet-root');
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><div><h2>${esc(title)}</h2>${sub ? `<p class="muted" style="margin-top:6px">${sub}</p>` : ''}</div>
    <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>${body}</div>`;
  const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => e.key === 'Escape' && close();
  scrim.addEventListener('click', (e) => { if (e.target === scrim || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  root.append(scrim);
  const el = scrim.querySelector('.sheet');
  onMount?.(el, close);
  setTimeout(() => el.querySelector('input,button:not([data-close])')?.focus(), 60);
  return { el, close };
}

// QR code as inline SVG (qrcode-generator global).
export function qrSvg(text, cell = 4) {
  if (!window.qrcode) return `<div class="mono" style="color:#000;font-size:11px;padding:8px;word-break:break-all">${esc(text)}</div>`;
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: cell, margin: 0, scalable: true });
}
export function qrPng(text, size = 640) {
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), pad = 4, s = size / (n + pad * 2);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#0b1a18';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + pad) * s, (r + pad) * s, Math.ceil(s), Math.ceil(s));
  return c.toDataURL('image/png');
}

// Downscale an image file to a JPEG data URL (keeps uploads small for AI + storage).
export function fileToDataUrl(file, max = 1024, q = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
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
  return c.toDataURL('image/jpeg', 0.82);
}

// Read a QR code from an image data URL with jsQR.
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
  else { btn.innerHTML = btn.dataset.label || btn.innerHTML; btn.disabled = false; }
}

// Resin identification code glyph (the triangle on plastics).
export const resinGlyph = (n) => `<span class="resin" title="Resin code ${n}"><svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M22 5 39 35H5z"/></svg><span style="margin-top:8px">${n}</span></span>`;

// Load a script once (used for MapLibre and Razorpay, which are only needed on some screens).
const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); }; document.head.append(s); });
  return loaded[src];
}
export function loadCss(href) {
  if ($(`link[href="${href}"]`)) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.append(l);
}
