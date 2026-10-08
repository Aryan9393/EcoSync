import { post, get } from './api.js';
import { S, PRICES, matLabel, matColor } from './state.js';
import { $, $$, esc, inr, toast, setBusy, fileToDataUrl, videoFrame, resinGlyph, sheet } from './ui.js';
import { icon } from './icons.js';
import { newListing } from './views.js';
import { INFO, classify, loadModel } from './materials.js';

// AI scanner. Uses Gemini on the server when configured, otherwise MobileNet running in the browser.
export async function render(host) {
  let stream = null, photo = null;
  const server = S.config?.ai === 'gemini';
  host.innerHTML = `<div class="page-head"><div><span class="eyebrow">Scanner</span><h1>Point. Know.<br>Sort.</h1><p>Show one item to the camera. You'll see what it is, how to prepare it, and what it's worth.</p></div><span class="tag">${icon('sparkles')}${server ? 'Gemini vision' : 'Runs on your device'}</span></div>
    <div class="scanner">
      <div>
        <div class="viewport" id="vp"><div class="ph" id="vp-ph">${icon('camera').replace('<svg', '<svg style="width:28px;height:28px"')}<span class="serif">One item at a time.</span><span>Start the camera or upload a photo.</span></div><div class="frame"></div><div class="beam"></div></div>
        <div class="row" style="margin-top:10px"><button class="btn btn-primary btn-lg grow" id="sc-cam">${icon('camera')}Start camera</button><label class="btn btn-lg grow" style="cursor:pointer">${icon('upload')}Upload a photo<input type="file" accept="image/*" id="sc-file" hidden></label></div>
        <p class="faint" style="font-size:11.5px;margin-top:10px" id="sc-model">${server ? '' : 'The first scan downloads a small vision model (about 16 MB). After that it works instantly.'}</p>
      </div>
      <div id="sc-out"><div class="card stack"><h2>What you'll get</h2><div class="list">
        ${[['recycle', 'Material and plastic number', 'PET 1, HDPE 2, aluminium, e-waste…'], ['coin', 'A fair price', 'Per kilo, for 17 materials'], ['alert', 'Safety warnings', 'Batteries, e-waste, broken glass'], ['leaf', 'CO₂ avoided', 'Compared with landfill'], ['sparkles', 'Upcycle ideas', 'Three things to make from it']]
          .map(([ic, t, s]) => `<div class="li"><span class="ico">${icon(ic)}</span><span><div class="t">${t}</div><div class="s">${s}</div></span><span></span></div>`).join('')}
      </div></div></div>
    </div>`;
  if (!server) loadModel().then(() => { const m = $('#sc-model'); if (m) m.textContent = 'Vision model ready. Scanning happens on this device; your photo isn\'t uploaded.'; }).catch(() => {});
  const vp = $('#vp'), out = $('#sc-out');
  const stop = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };

  const analyse = async (dataUrl) => {
    photo = dataUrl; vp.classList.add('busy');
    out.innerHTML = `<div class="card stack"><div class="row"><span class="spinner"></span><b>Looking closely…</b></div><p class="muted" style="font-size:12.5px">Identifying the material and checking for hazards.</p></div>`;
    try {
      let r;
      if (server) r = await post('/api/ai/scan', { image: dataUrl, mime: 'image/jpeg' });
      else {
        const img = new Image(); img.src = dataUrl; await img.decode();
        const c = await classify(img);
        r = { item: c.material ? c.item : c.label, material: c.material, label: c.label, confidence: c.confidence, guesses: c.preds?.slice(0, 3).map((p) => p.className.split(',')[0]) };
      }
      show(r);
    } catch (e) {
      out.innerHTML = `<div class="card stack"><span class="serif" style="font-size:26px">Couldn't load the scanner.</span><p class="muted" style="font-size:12.5px">Check your connection, or pick the material yourself.</p>${pickerHtml()}</div>`;
      bindPicker();
    } finally { vp.classList.remove('busy'); }
  };
  const pickerHtml = (sel) => `<div class="chips" id="pick">${['pet', 'hdpe', 'ldpe', 'aluminium', 'steel', 'copper', 'glass', 'paper', 'cardboard', 'e_waste', 'battery', 'textile', 'organic'].map((m) => `<button class="chip" data-pick="${m}" aria-pressed="${m === sel}"><i class="dot" style="background:${matColor(m)}"></i>${esc(matLabel(m).replace(/ \(\d\)/, ''))}</button>`).join('')}</div>`;
  const bindPicker = (base = {}) => $$('[data-pick]', out).forEach((b) => b.addEventListener('click', () => show({ ...base, material: b.dataset.pick, item: base.item || matLabel(b.dataset.pick), picked: true })));

  function show(r) {
    if (!r.material) {
      out.innerHTML = `<div class="card stack"><span class="eyebrow plain">Looks like</span><h2 class="serif" style="font-size:34px;line-height:1">${esc(r.item || 'Something new')}</h2>
        <p class="muted" style="font-size:12.5px">${r.guesses?.length ? `Other guesses: ${esc(r.guesses.join(', '))}. ` : ''}Which material is it?</p>${pickerHtml()}</div>`;
      return bindPicker(r);
    }
    const info = INFO[r.material] || INFO.other, rate = PRICES()[r.material]?.rate ?? 0;
    const kgEst = +(r.estWeightKg || info.kg), value = Math.max(0, Math.round(rate * kgEst)), co2 = +(kgEst * ({ pet: 1.5, hdpe: 1.4, aluminium: 9.1, steel: 1.8, copper: 3.5, glass: 0.3, paper: 0.9, cardboard: 0.9, e_waste: 2, textile: 3.2 }[r.material] ?? 0.5)).toFixed(2);
    const resin = r.resinCode ?? info.resin, hazard = r.hazard || info.hazard, recyclable = r.recyclable ?? info.recyclable ?? true;
    const steps = r.steps?.length ? r.steps : info.steps;
    out.innerHTML = `<div class="card result stack">
      <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap"><div style="min-width:0"><span class="eyebrow plain">${r.picked ? 'You picked' : `Identified${r.confidence ? ` · ${Math.round(r.confidence * 100)}% sure` : ''}`}</span><h2 style="margin-top:6px">${esc(r.item)}</h2></div>${resin ? resinGlyph(resin) : ''}</div>
      <div class="row" style="gap:6px"><span class="tag"><i class="dot" style="background:${matColor(r.material)}"></i>${esc(matLabel(r.material))}</span><span class="tag ${recyclable ? 'ok' : 'bad'}">${recyclable ? 'Recyclable' : 'Wet bin or compost'}</span>${r.label && !r.picked && r.label !== r.item ? `<span class="tag">${esc(r.label)}</span>` : ''}</div>
      ${hazard ? `<div class="alert">${icon('alert')}<span>${esc(hazard)}</span></div>` : ''}
      <div class="kv"><div><b>${inr(rate)}</b><span>per kg</span></div><div><b>${co2} kg</b><span>CO₂ avoided</span></div><div><b>+${Math.round(kgEst * 10) + 20}</b><span>EcoCoins if sold</span></div></div>
      <div><b style="font-size:13px">How to prepare it</b><ol class="ol" style="margin-top:8px">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
      <p class="muted" style="font-size:12.5px">${esc(r.funFact || info.fact)}</p>
      <div class="row">${recyclable && rate > 0 ? `<button class="btn btn-primary grow" id="r-list">${icon('market')}List it</button>` : ''}<a class="btn grow" href="#/pickups">${icon('truck')}Book a pickup</a></div>
      <div class="row"><a class="btn grow" href="#/map">${icon('pin')}Nearest hub</a><button class="btn grow" id="r-up">${icon('sparkles')}Upcycle ideas</button></div>
      ${r.picked ? '' : `<button class="link faint" id="r-wrong" style="font-weight:500;color:var(--muted);font-size:12px">Not right? Pick the material</button>`}
    </div>`;
    $('#r-list', out)?.addEventListener('click', () => newListing(null, { title: r.item, material: r.material, kg: Math.max(0.1, +kgEst.toFixed(2)), notes: steps[0] || '', photo }));
    $('#r-up', out).onclick = () => upcycle(r.item, r.material);
    $('#r-wrong', out)?.addEventListener('click', () => { out.innerHTML = `<div class="card stack"><h2>Which material is it?</h2>${pickerHtml(r.material)}</div>`; bindPicker({ item: r.item }); });
  }

  $('#sc-cam').onclick = async (e) => {
    const btn = e.currentTarget;
    if (stream) { const shot = videoFrame($('video', vp)); stop(); $('video', vp)?.remove(); vp.insertAdjacentHTML('afterbegin', `<img class="shot" src="${shot}" alt="Captured photo">`); btn.innerHTML = `${icon('camera')}Scan again`; return analyse(shot); }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      $('img.shot', vp)?.remove(); $('#vp-ph').hidden = true;
      const v = document.createElement('video'); v.playsInline = true; v.muted = true; v.srcObject = stream; vp.prepend(v); await v.play();
      btn.innerHTML = `${icon('scan')}Capture and scan`;
    } catch { toast('Camera isn\'t available. Allow camera access, or upload a photo.', 'err'); }
  };
  $('#sc-file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; stop(); $('video', vp)?.remove(); $('img.shot', vp)?.remove();
    const d = await fileToDataUrl(f); $('#vp-ph').hidden = true;
    vp.insertAdjacentHTML('afterbegin', `<img class="shot" src="${d}" alt="Your photo">`); analyse(d); e.target.value = '';
  };
  if (S.isApp && navigator.mediaDevices) setTimeout(() => $('#sc-cam')?.click(), 400);
  return stop;
}

export function upcycle(item, material) {
  sheet({
    title: 'Make something.', sub: `Ideas for ${esc(item)}`, wide: true, body: '<div id="up" class="stack"><p class="muted">Finding ideas…</p></div>',
    async onMount(el) {
      try {
        const { ideas } = await get(`/api/upcycle/${material}`);
        $('#up', el).innerHTML = ideas.map((i, k) => `<div class="card" style="padding:16px"><div class="row" style="justify-content:space-between"><b>${k + 1}. ${esc(i.title)}</b><span class="tag">${esc(i.time)}</span></div><ol class="ol" style="margin-top:8px">${i.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`).join('');
      } catch (e) { $('#up', el).innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
    },
  });
}
