import { get, post } from './api.js';
import { S, matLabel, matColor, refreshMe } from './state.js';
import { $, esc, inr, kg, when, toast, sheet, qrSvg, qrPng, setBusy, decodeQrFromDataUrl, fileToDataUrl } from './ui.js';
import { icon } from './icons.js';
import { requireAuth, route } from './app.js';
import { passRow } from './views.js';

const STAGES = [['listed', 'Listed', 'Posted for collection'], ['reserved', 'Reserved', 'A collector reserved it and paid'], ['picked', 'Handed over', 'Confirmed by QR handshake'], ['hub', 'At a recycling hub', 'Delivered for sorting'], ['processed', 'Processed', 'Sorted, baled and weighed'], ['reborn', 'Reborn', 'Made into something new']];
const pageUrl = (id) => `${location.origin}${location.pathname}#/passport/${id}`;
const coins = () => refreshMe().then(() => dispatchEvent(new Event('ecosync:coins')));

export async function render(host, params) {
  if (params[0] === 'scan') { list(host); setTimeout(() => scanQr(handleScan), 60); return; }
  if (params[0]) return detail(host, params[0].toUpperCase());
  list(host);
}
function list(host) {
  host.innerHTML = `<div class="page-head"><div><span class="eyebrow">Passports</span><h1>One QR.<br>Every handover.</h1><p>Each sale gets a passport that records where the scrap went, from your door to its next life.</p></div></div>
    <div class="grid-2">
      <form class="card stack" id="pl"><h2>Look up a passport</h2>
        <div class="row" style="flex-wrap:nowrap"><input class="input mono grow" id="pl-id" placeholder="ES-7K2P-QX9M" autocapitalize="characters" aria-label="Passport ID"><button class="btn btn-primary" type="submit">Open</button></div>
        <button class="btn" type="button" id="pl-scan">${icon('qr')}Scan a QR code</button>
        <p class="faint" style="font-size:11.5px">Collecting a lot? Scan the seller's handshake QR here to complete the pickup.</p></form>
      <section class="card"><div class="card-head"><h2>Yours</h2></div><div id="pl-list" class="list"><p class="muted">${S.user ? 'Loading…' : 'Sign in to see your passports.'}</p></div></section>
    </div>`;
  $('#pl').onsubmit = (e) => { e.preventDefault(); const id = $('#pl-id').value.trim().toUpperCase(); /^ES-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(id) ? (location.hash = `#/passport/${id}`) : toast('Passport IDs look like ES-7K2P-QX9M.', 'err'); };
  $('#pl-scan').onclick = () => scanQr(handleScan);
  if (S.user) get('/api/passports/mine').then(({ passports }) => { $('#pl-list').innerHTML = passports.length ? passports.map(passRow).join('') : '<div class="empty"><span>No passports yet. One is created each time a lot is reserved.</span></div>'; }).catch(() => {});
}
async function handleScan(text) {
  const hs = text.match(/ECOSYNC:HS:(ES-[A-Z0-9]{4}-[A-Z0-9]{4}):(\d{6})/);
  if (hs) return handshake(hs[1], hs[2]);
  const pp = text.match(/(ES-[A-Z0-9]{4}-[A-Z0-9]{4})/);
  pp ? (location.hash = `#/passport/${pp[1]}`) : toast('That QR code isn\'t an EcoSync passport.', 'err');
}
async function handshake(id, code) {
  if (!requireAuth(() => handshake(id, code), 'buyer')) return;
  try { await post(`/api/passport/${id}/handshake`, { code }); toast('Handed over. Sale complete. +15 EcoCoins'); coins(); location.hash === `#/passport/${id}` ? route() : (location.hash = `#/passport/${id}`); }
  catch (e) { toast(e.message, 'err'); }
}

async function detail(host, id) {
  host.innerHTML = '<p class="muted">Opening passport…</p>';
  let p; try { p = (await get(`/api/passport/${id}`)).passport; } catch (e) { host.innerHTML = `<div class="empty"><span class="serif">${esc(e.message)}</span><a class="btn btn-sm" href="#/passport">All passports</a></div>`; return; }
  const ev = (s) => p.events.find((e) => e.stage === s), next = STAGES.find(([s]) => !ev(s))?.[0];
  const statusTxt = { awaiting_pickup: ['warn', 'Awaiting pickup'], collected: ['ok', 'Handed over'], reborn: ['ok', 'Reborn'] }[p.status] || ['', p.status];
  host.innerHTML = `<div class="page-head"><div><span class="eyebrow">Passport</span><h1 class="mono" style="font:500 clamp(28px,4vw,40px)/1 var(--mono);letter-spacing:.04em">${p.id}</h1><p>${esc(p.title)} · ${p.role === 'public' ? 'public record' : `you're the ${p.role === 'buyer' ? 'collector' : 'seller'}`}</p></div><a class="link" href="#/passport">${icon('arrowL')} All passports</a></div>
    <div class="grid-2">
      <article class="passport">
        <div class="pp-head"><div><div class="pp-label">Material passport</div><div class="pp-id">${p.id}</div></div><span class="tag ${statusTxt[0]}">${statusTxt[1]}</span></div>
        <div class="pp-body"><div class="qr">${qrSvg(pageUrl(p.id))}</div>
          <dl class="pp-facts"><div><dt>Material</dt><dd><i class="dot" style="background:${matColor(p.material)}"></i> ${esc(matLabel(p.material))}</dd></div><div><dt>Weight</dt><dd>${kg(p.kg)}</dd></div><div><dt>Amount</dt><dd>${inr(p.amount)} · ${p.payMethod === 'upi' ? 'UPI' : 'Cash'}</dd></div><div><dt>CO₂ avoided</dt><dd>${p.co2} kg</dd></div><div><dt>Seller</dt><dd>${esc(p.sellerName)}</dd></div><div><dt>Collector</dt><dd>${esc(p.buyerName)}</dd></div></dl></div>
        <ol class="timeline">${STAGES.map(([s, t, d]) => { const e = ev(s); return `<li class="${e ? 'done' : ''} ${s === next ? 'now' : ''}"><span><b style="font-weight:600">${t}</b><small>${esc(e?.note || d)}</small></span><time>${e?.at ? when(e.at) : ''}</time></li>`; }).join('')}</ol>
      </article>
      <div class="stack" id="pp-act"></div>
    </div>`;
  const box = $('#pp-act'); let html = '';
  if (p.role === 'seller' && p.status === 'awaiting_pickup') html += `<section class="card stack"><h2>At pickup</h2><p class="muted" style="font-size:12.5px">When the collector has your scrap, show them this QR. Their scan completes the sale.</p><button class="btn btn-primary btn-lg" id="pp-show">${icon('qr')}Show handshake QR</button></section>`;
  if (p.role === 'seller') html += `<section class="card stack"><h2>Payment</h2><p class="muted" style="font-size:12.5px">${p.payMethod === 'upi' ? `${inr(p.amount)} by UPI${p.payRef ? ` · reference <span class="mono">${esc(p.payRef)}</span>` : ''}. Check your UPI app.` : `${inr(p.amount)} in cash at pickup.`}</p>${p.payConfirmed ? '<span class="tag ok" style="justify-self:start">Payment received</span>' : `<button class="btn" id="pp-paid" style="justify-self:start">${icon('check')}I've received the money</button>`}</section>`;
  if (p.role === 'buyer' && p.status === 'awaiting_pickup') html += `<section class="card stack"><h2>Collecting it?</h2><p class="muted" style="font-size:12.5px">Scan the seller's handshake QR when you pick it up, or type their 6-digit code.</p><button class="btn btn-primary btn-lg" id="pp-scan">${icon('scan')}Scan seller's QR</button>
      <div class="row" style="flex-wrap:nowrap"><input class="input mono grow" id="pp-code" inputmode="numeric" maxlength="6" placeholder="6-digit code" aria-label="Handshake code"><button class="btn" id="pp-go">Confirm</button></div>
      ${p.payMethod === 'upi' && p.sellerUpi ? `<p class="faint" style="font-size:11.5px">Paying by UPI to <span class="mono">${esc(p.sellerUpi)}</span>.</p>` : ''}</section>`;
  if (p.role === 'buyer' && p.status !== 'awaiting_pickup' && next) {
    const lab = { hub: 'Delivered to a recycling hub', processed: 'Sorted and processed', reborn: 'Record what it became' }[next];
    if (lab) html += `<section class="card stack"><h2>What happened next?</h2><p class="muted" style="font-size:12.5px">Keep the trail going so the seller can see where their scrap ended up.</p>${next === 'reborn' ? '<input class="input" id="pp-note" placeholder="e.g. Spun into polyester fibre">' : ''}<button class="btn btn-primary" id="pp-next" data-stage="${next}" style="justify-self:start">${icon('check')}${lab}</button></section>`;
  }
  html += `<section class="card stack"><h2>Label</h2><p class="muted" style="font-size:12.5px">Print the QR and stick it on the bag or bale. Anyone who scans it sees this journey, without addresses or full names.</p>
    <div class="row"><a class="btn grow" href="${qrPng(pageUrl(p.id))}" download="${p.id}.png">${icon('download')}Download QR label</a><button class="btn grow" id="pp-copy">${icon('send')}Copy link</button></div></section>`;
  box.innerHTML = html;
  $('#pp-copy').onclick = async () => { try { await navigator.clipboard.writeText(pageUrl(p.id)); toast('Link copied'); } catch { toast(pageUrl(p.id)); } };
  $('#pp-show')?.addEventListener('click', () => sheet({ title: 'Handshake.', sub: 'Let the collector scan this when they have your scrap.', body: `<div class="stack" style="justify-items:center;text-align:center"><div class="upi-qr" style="width:min(260px,72vw)">${qrSvg(`ECOSYNC:HS:${p.id}:${p.handshake}`)}</div><div><div class="muted" style="font-size:12px;margin-bottom:6px">Or read out this code</div><div class="code-big">${p.handshake}</div></div></div>` }));
  $('#pp-paid')?.addEventListener('click', async (e) => { setBusy(e.currentTarget, true); try { await post(`/api/passport/${p.id}/paid`); toast('Marked as received'); route(); } catch (er) { setBusy(e.currentTarget, false); toast(er.message, 'err'); } });
  $('#pp-scan')?.addEventListener('click', () => scanQr(handleScan));
  $('#pp-go')?.addEventListener('click', () => { const c = $('#pp-code').value.trim(); /^\d{6}$/.test(c) ? handshake(p.id, c) : toast('Enter the 6-digit code.', 'err'); });
  $('#pp-next')?.addEventListener('click', async (e) => { const b = e.currentTarget; setBusy(b, true); try { await post(`/api/passport/${p.id}/event`, { stage: b.dataset.stage, note: $('#pp-note')?.value }); toast('Passport updated'); route(); } catch (er) { setBusy(b, false); toast(er.message, 'err'); } });
}

export function scanQr(onText) {
  let stream, raf, done = false;
  const stop = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  sheet({
    title: 'Scan a QR.', sub: 'Hold the code inside the frame.',
    body: `<div class="viewport busy" id="qv"><div class="ph" id="qv-ph"><span class="spinner"></span><span>Starting camera…</span></div><div class="frame"></div><div class="beam"></div></div>
      <label class="btn" style="cursor:pointer;justify-self:start">${icon('upload')}Scan from a photo<input type="file" accept="image/*" id="qv-file" hidden></label>`,
    onMount(el, close) {
      const finish = (t) => { if (done) return; done = true; stop(); close(); onText(t); };
      $('#qv-file', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const t = await decodeQrFromDataUrl(await fileToDataUrl(f, 1400, 0.92)); t ? finish(t) : toast('No QR code found in that photo.', 'err'); };
      (navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: { ideal: 'environment' } }, audio: false }) || Promise.reject(new Error('no camera'))).then(async (s) => {
        stream = s; const v = document.createElement('video'); v.playsInline = true; v.muted = true; v.srcObject = s;
        $('#qv', el).prepend(v); $('#qv-ph', el).hidden = true; await v.play();
        const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
        const tick = () => { if (done) return; if (v.readyState >= 2) { c.width = v.videoWidth; c.height = v.videoHeight; g.drawImage(v, 0, 0); const d = g.getImageData(0, 0, c.width, c.height); const r = window.jsQR?.(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' }); if (r?.data) return finish(r.data); } raf = requestAnimationFrame(tick); };
        tick();
      }).catch(() => { $('#qv-ph', el).innerHTML = `${icon('camera')}<span>Camera isn't available. Scan from a photo instead.</span>`; $('#qv', el).classList.remove('busy'); });
    },
    onClose: stop,
  });
}
