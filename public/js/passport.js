import { get, post } from './api.js';
import { S, matLabel, matColor, refreshMe } from './state.js';
import { $, esc, inr, kg, when, toast, sheet, qrSvg, qrPng, setBusy, decodeQrFromDataUrl, fileToDataUrl } from './ui.js';
import { icon } from './icons.js';
import { requireAuth, renderShell, route } from './app.js';
import { passRow } from './views.js';

const STAGES = [['listed', 'Listed', 'Seller posted the lot'], ['paid', 'Paid into escrow', 'Buyer paid; EcoSync holds the money'], ['picked', 'Picked up', 'QR handshake confirmed; seller paid'], ['hub', 'At recycling hub', 'Delivered for sorting'], ['processed', 'Processed', 'Sorted, baled and weighed'], ['reborn', 'Reborn', 'Made into a new product']];
const pageUrl = (id) => `${location.origin}${location.pathname}#/passport/${id}`;

export async function render(host, params) {
  if (params[0] === 'scan') { listView(host); setTimeout(() => scanQr(handleScan), 50); return; }
  if (params[0]) return detail(host, params[0].toUpperCase());
  listView(host);
}

function listView(host) {
  host.innerHTML = `<div class="page-head"><div><h1>Material passports</h1><p>Every sale on EcoSync gets a QR passport that records each handover, from doorstep to new product.</p></div></div>
    <div class="grid-2" style="align-items:start">
      <form class="card stack" id="pl"><h2>Look up a passport</h2>
        <div class="row"><input class="input mono grow" id="pl-id" placeholder="ES-7K2P-QX9M" autocapitalize="characters" aria-label="Passport ID"><button class="btn btn-primary" type="submit">Open</button></div>
        <button class="btn" type="button" id="pl-scan">${icon('qr')}Scan a QR code</button>
        <p class="faint" style="font-size:12.5px">Buyers: scan the seller's handshake QR here at pickup to release the payment.</p></form>
      <section class="card"><div class="card-head"><h2>Your passports</h2></div><div id="pl-list" class="list"><p class="muted">${S.user ? 'Loading…' : 'Sign in to see your passports.'}</p></div></section>
    </div>`;
  $('#pl').onsubmit = (e) => { e.preventDefault(); const id = $('#pl-id').value.trim().toUpperCase(); if (/^ES-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(id)) location.hash = `#/passport/${id}`; else toast('Passport IDs look like ES-7K2P-QX9M.', 'err'); };
  $('#pl-scan').onclick = () => scanQr(handleScan);
  if (S.user) get('/api/passports/mine').then(({ passports }) => { $('#pl-list').innerHTML = passports.length ? passports.map(passRow).join('') : '<div class="empty">No passports yet. They are created when a lot is bought.</div>'; }).catch(() => {});
}

async function handleScan(text) {
  const hs = text.match(/ECOSYNC:HS:(ES-[A-Z0-9]{4}-[A-Z0-9]{4}):(\d{6})/);
  if (hs) return handshake(hs[1], hs[2]);
  const pp = text.match(/(ES-[A-Z0-9]{4}-[A-Z0-9]{4})/);
  if (pp) { location.hash = `#/passport/${pp[1]}`; return; }
  toast('That QR code is not an EcoSync passport.', 'err');
}
async function handshake(id, code) {
  if (!requireAuth(() => handshake(id, code), 'buyer')) return;
  try {
    await post(`/api/passport/${id}/handshake`, { code });
    toast('Pickup confirmed. Payment released to the seller. +15 EcoCoins', 'ok');
    refreshMe().then(() => renderShell('passport'));
    if (location.hash === `#/passport/${id}`) route(); else location.hash = `#/passport/${id}`;
  } catch (e) { toast(e.message, 'err'); }
}

async function detail(host, id) {
  host.innerHTML = '<p class="muted">Loading passport…</p>';
  let p;
  try { p = (await get(`/api/passport/${id}`)).passport; }
  catch (e) { host.innerHTML = `<div class="empty"><b>${esc(e.message)}</b><a class="btn btn-sm" href="#/passport">Back to passports</a></div>`; return; }
  const done = new Set(p.events.map((e) => e.stage));
  const ev = (s) => p.events.find((e) => e.stage === s);
  const next = STAGES.find(([s]) => !done.has(s))?.[0];
  host.innerHTML = `<div class="page-head"><div><h1>Passport <span class="mono">${p.id}</span></h1><p>${esc(p.title)} · ${p.role === 'public' ? 'public view' : `you are the ${p.role}`}</p></div><a class="btn btn-sm btn-ghost" href="#/passport">All passports</a></div>
    <div class="grid-2" style="align-items:start">
      <article class="passport">
        <div class="pp-head"><div><div class="pp-label">Material passport</div><div class="pp-id">${p.id}</div></div><span class="pill ${p.escrow === 'released' ? 'ok' : 'warn'}">${icon(p.escrow === 'released' ? 'check' : 'lock').replace('<svg', '<svg style="width:13px;height:13px"')}${p.escrow === 'released' ? 'Payment released' : 'In escrow'}</span></div>
        <div class="pp-body"><div class="qr">${qrSvg(pageUrl(p.id))}</div>
          <dl class="pp-facts"><div><dt>Material</dt><dd><i class="swatch" style="background:${matColor(p.material)};display:inline-block"></i> ${esc(matLabel(p.material))}</dd></div><div><dt>Weight</dt><dd>${kg(p.kg)}</dd></div><div><dt>Amount</dt><dd>${inr(p.amount)}</dd></div><div><dt>CO₂ avoided</dt><dd>${p.co2} kg</dd></div><div><dt>Seller</dt><dd>${esc(p.sellerName)}</dd></div><div><dt>Buyer</dt><dd>${esc(p.buyerName)}</dd></div></dl></div>
        <ol class="timeline">${STAGES.map(([s, t, d]) => { const e = ev(s); return `<li class="${e ? 'done' : ''} ${s === next ? 'now' : ''}"><span><b style="font-weight:600">${t}</b><small>${esc(e?.note || d)}</small></span><time>${e ? when(e.at) : ''}</time></li>`; }).join('')}</ol>
        <p class="faint" style="font-size:12px">Payment ${p.paymentMode === 'demo' ? 'simulated (test mode)' : `via Razorpay · ${esc(p.paymentRef || '')}`}</p>
      </article>
      <div class="stack" id="pp-actions"></div>
    </div>`;
  const box = $('#pp-actions');
  const label = qrPng(pageUrl(p.id));
  let html = `<section class="card stack"><h2>Share this passport</h2><p class="muted" style="font-size:13.5px">Print the QR label and stick it on the bag or bale. Anyone who scans it sees this journey, without personal details.</p>
    <div class="row"><a class="btn grow" href="${label}" download="${p.id}.png">${icon('download')}Download QR label</a><button class="btn grow" id="pp-copy">${icon('send')}Copy link</button></div></section>`;
  if (p.role === 'seller' && p.escrow !== 'released') html = `<section class="card stack"><h2>At pickup</h2><p class="muted">Show this QR to the buyer when they collect. Scanning it releases ${inr(p.amount)} to you.</p><button class="btn btn-primary btn-lg" id="pp-show">${icon('qr')}Show handshake QR</button></section>` + html;
  if (p.role === 'buyer' && p.escrow !== 'released') html = `<section class="card stack"><h2>Collecting this lot?</h2><p class="muted">Scan the seller's handshake QR when you pick it up. That confirms the pickup and releases the payment.</p><button class="btn btn-primary btn-lg" id="pp-scan">${icon('scan')}Scan seller's QR</button>
      <div class="row"><input class="input mono grow" id="pp-code" inputmode="numeric" maxlength="6" placeholder="or type the 6-digit code" aria-label="Handshake code"><button class="btn" id="pp-codego">Confirm</button></div>
      ${p.demoHandshake ? `<div class="demo-code">Sample seller: this lot belongs to a demo seller, so their handshake code is <b class="mono">${p.demoHandshake}</b>. <button class="btn btn-sm" id="pp-sim" style="margin-top:8px">Show the seller's QR</button></div>` : ''}</section>` + html;
  if (p.role === 'buyer' && p.escrow === 'released' && next) {
    const labels = { hub: 'Mark as delivered to hub', processed: 'Mark as processed', reborn: 'Record what it became' };
    if (labels[next]) html = `<section class="card stack"><h2>Next step</h2><p class="muted">Keep the passport going so the seller sees where their scrap ended up.</p>${next === 'reborn' ? '<input class="input" id="pp-note" placeholder="e.g. Spun into polyester fibre for T-shirts">' : ''}<button class="btn btn-primary" id="pp-next" data-stage="${next}">${icon('check')}${labels[next]}</button></section>` + html;
  }
  box.innerHTML = html;
  $('#pp-copy').onclick = async () => { try { await navigator.clipboard.writeText(pageUrl(p.id)); toast('Link copied', 'ok'); } catch { toast(pageUrl(p.id)); } };
  $('#pp-show')?.addEventListener('click', () => showHandshake(p.id, p.handshake));
  $('#pp-sim')?.addEventListener('click', () => showHandshake(p.id, p.demoHandshake, true));
  $('#pp-scan')?.addEventListener('click', () => scanQr(handleScan));
  $('#pp-codego')?.addEventListener('click', () => { const c = $('#pp-code').value.trim(); if (!/^\d{6}$/.test(c)) return toast('Enter the 6-digit code.', 'err'); handshake(p.id, c); });
  $('#pp-next')?.addEventListener('click', async (e) => { const b = e.currentTarget; setBusy(b, true); try { await post(`/api/passport/${p.id}/event`, { stage: b.dataset.stage, note: $('#pp-note')?.value }); toast('Passport updated', 'ok'); route(); } catch (er) { setBusy(b, false); toast(er.message, 'err'); } });
}

function showHandshake(id, code, demo) {
  sheet({ title: 'Handshake QR', sub: demo ? 'Preview: this is what the seller would show you.' : 'Let the buyer scan this at pickup.',
    body: `<div class="stack" style="justify-items:center;text-align:center"><div class="qr" style="width:min(280px,80vw)">${qrSvg(`ECOSYNC:HS:${id}:${code}`)}</div>
      <div><div class="muted" style="font-size:13px">Or read out this code</div><div class="code-big">${code}</div></div>
      ${demo ? `<button class="btn btn-primary" id="hs-sim" data-close>Simulate the buyer scanning it</button>` : '<p class="faint" style="font-size:12.5px">Only share this when the buyer has your scrap.</p>'}</div>`,
    onMount(el) { $('#hs-sim', el)?.addEventListener('click', () => handshake(id, code)); } });
}

// Camera QR scanner (jsQR), with photo upload and manual fallbacks.
export function scanQr(onText) {
  let stream, raf, done = false;
  const stop = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  sheet({
    title: 'Scan a QR code', sub: 'Hold the code inside the frame.',
    body: `<div class="viewport busy" id="qv"><div class="placeholder" id="qv-ph"><span class="spinner"></span><span>Starting camera…</span></div><div class="reticle"></div><div class="beam"></div></div>
      <label class="btn" style="cursor:pointer">${icon('upload')}Scan from a photo<input type="file" accept="image/*" id="qv-file" hidden></label>`,
    onMount(el, close) {
      const finish = (t) => { if (done) return; done = true; stop(); close(); onText(t); };
      $('#qv-file', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const t = await decodeQrFromDataUrl(await fileToDataUrl(f, 1400, 0.9)); t ? finish(t) : toast('No QR code found in that photo.', 'err'); };
      (navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: { ideal: 'environment' } }, audio: false }) || Promise.reject(new Error('no camera'))).then(async (s) => {
        stream = s; const v = document.createElement('video'); v.playsInline = true; v.muted = true; v.srcObject = s;
        $('#qv', el).prepend(v); $('#qv-ph', el).hidden = true; await v.play();
        const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
        const tick = () => {
          if (done) return;
          if (v.readyState >= 2) { c.width = v.videoWidth; c.height = v.videoHeight; g.drawImage(v, 0, 0); const d = g.getImageData(0, 0, c.width, c.height); const r = window.jsQR?.(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' }); if (r?.data) return finish(r.data); }
          raf = requestAnimationFrame(tick);
        }; tick();
      }).catch(() => { $('#qv-ph', el).innerHTML = `${icon('camera')}<span>Camera not available. Scan from a photo instead.</span>`; $('#qv', el).classList.remove('busy'); });
    },
    onClose: stop,
  });
}
