import { post } from './api.js';
import { S, matLabel, matColor } from './state.js';
import { $, esc, inr, toast, setBusy, fileToDataUrl, videoFrame, resinGlyph, sheet } from './ui.js';
import { icon } from './icons.js';
import { newListing } from './views.js';

export async function render(host) {
  let stream = null, last = null, photo = null;
  host.innerHTML = `
    ${S.config?.ai === 'demo' ? `<div class="mode-banner">${icon('spark').replace('<svg', '<svg style="width:18px;height:18px;color:var(--warn)"')}<span>Sample results until a Gemini API key is added on the server. Type a hint like "bottle", "can" or "charger" to steer the demo.</span></div>` : ''}
    <div class="page-head"><div><h1>AI scanner</h1><p>Point your camera at an item. You'll get the material, how to prepare it, what it's worth and where it goes.</p></div></div>
    <div class="scanner">
      <div>
        <div class="viewport" id="vp">
          <div class="placeholder" id="vp-ph">${icon('camera')}<b>Camera is off</b><span style="font-size:13.5px">Start the camera or upload a photo of one item.</span></div>
          <div class="reticle"></div><div class="beam"></div>
        </div>
        <div class="scan-controls">
          <button class="btn btn-primary btn-lg grow" id="sc-cam">${icon('camera')}Start camera</button>
          <label class="btn btn-lg grow" style="cursor:pointer">${icon('upload')}Upload photo<input type="file" accept="image/*" id="sc-file" hidden></label>
        </div>
        <label class="field" style="margin-top:12px"><span>Hint (optional)</span><input class="input" id="sc-hint" placeholder="e.g. old phone charger, juice tetra pack"></label>
      </div>
      <div id="sc-out">
        <div class="card stack">
          <h2>What the scanner tells you</h2>
          <div class="list">
            ${[['recycle', 'Material and resin code', 'PET 1, HDPE 2, aluminium, e-waste and more'], ['coin', 'Price estimate', 'Weight × today\'s rate per kg'], ['alert', 'Hazard warnings', 'Batteries, chemicals, sharp glass'], ['leaf', 'CO₂ avoided', 'Compared with sending it to landfill'], ['image', 'Upcycle ideas', 'With an AI-generated preview']]
              .map(([ic, t, s]) => `<div class="list-item"><span class="badge-ico">${icon(ic)}</span><span><div class="t">${t}</div><div class="s">${s}</div></span><span></span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  const vp = $('#vp'), out = $('#sc-out');
  const stop = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  const analyse = async (dataUrl) => {
    photo = dataUrl; vp.classList.add('busy');
    out.innerHTML = `<div class="card stack"><div class="row"><span class="spinner" style="color:var(--accent)"></span><b>Analysing with ${S.config?.ai === 'gemini' ? 'Gemini' : 'the sample model'}…</b></div><p class="muted">Identifying the material, checking for hazards and pricing it.</p></div>`;
    try {
      const r = await post('/api/ai/scan', { image: dataUrl, mime: 'image/jpeg', hint: $('#sc-hint').value });
      last = r; showResult(r);
    } catch (e) { out.innerHTML = `<div class="empty"><b>Scan failed</b><span>${esc(e.message)}</span></div>`; }
    finally { vp.classList.remove('busy'); }
  };
  const showResult = (r) => {
    out.innerHTML = `<div class="card result stack">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><div style="min-width:0"><div class="muted" style="font-size:13px">Identified · ${Math.round((r.confidence || 0) * 100)}% sure${r.demo ? ' · sample' : ''}</div><h2>${esc(r.item)}</h2></div>${r.resinCode ? resinGlyph(r.resinCode) : ''}</div>
      <div class="chips"><span class="pill" style="border-color:${matColor(r.material)}"><i class="swatch" style="background:${matColor(r.material)}"></i>${esc(matLabel(r.material))}</span>
        <span class="pill ${r.recyclable ? 'ok' : 'bad'}">${r.recyclable ? 'Recyclable' : 'Not recyclable'}</span>
        <span class="pill ${r.condition === 'clean' ? 'ok' : 'warn'}">${{ clean: 'Clean', needs_rinse: 'Rinse first', contaminated: 'Contaminated' }[r.condition] || 'Check condition'}</span></div>
      ${r.hazard ? `<div class="alert">${icon('alert')}<span>${esc(r.hazard)}</span></div>` : ''}
      <div class="kv"><div><b>${inr(r.estValue)}</b><span>est. value · ${inr(r.pricePerKg)}/kg</span></div><div><b>${r.co2SavedKg} kg</b><span>CO₂ avoided</span></div><div><b>+${r.coins}</b><span>EcoCoins if sold</span></div></div>
      <div><b>How to prepare it</b><ol class="steps-list" style="margin-top:8px">${(r.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
      ${r.funFact ? `<p class="muted" style="font-size:13.5px">${icon('sparkles').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-2px;color:var(--accent-2)"')} ${esc(r.funFact)}</p>` : ''}
      <div class="row">
        <button class="btn btn-primary grow" id="r-list">${icon('market')}List for ${inr(Math.max(r.estValue, 1))}</button>
        <a class="btn grow" href="#/pickups">${icon('truck')}Book pickup</a>
      </div>
      <div class="row"><a class="btn btn-ghost grow" href="#/map">${icon('pin')}Nearest hub</a><button class="btn btn-ghost grow" id="r-up">${icon('image')}Upcycle Studio</button></div>
    </div>`;
    $('#r-list').onclick = () => newListing(null, { title: r.item, material: r.material, kg: Math.max(0.1, +(r.estWeightKg || 1).toFixed(2)), notes: (r.steps || [])[0] || '', photo, ai: { item: r.item, confidence: r.confidence } });
    $('#r-up').onclick = () => upcycle(r.item);
  };

  $('#sc-cam').onclick = async (e) => {
    if (stream) { // capture
      const shot = videoFrame($('video', vp)); stop();
      vp.querySelector('video')?.remove();
      vp.insertAdjacentHTML('afterbegin', `<img class="shot" src="${shot}" alt="Captured photo">`);
      e.currentTarget.innerHTML = `${icon('camera')}Scan again`; analyse(shot); return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      vp.querySelector('img.shot')?.remove(); $('#vp-ph').hidden = true;
      const v = document.createElement('video'); v.playsInline = true; v.muted = true; v.srcObject = stream; vp.prepend(v); await v.play();
      e.currentTarget.innerHTML = `${icon('scan')}Capture and scan`;
    } catch { toast('Camera not available. Allow camera access, or upload a photo instead.', 'err'); }
  };
  $('#sc-file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; stop(); vp.querySelector('video')?.remove(); vp.querySelector('img.shot')?.remove();
    const d = await fileToDataUrl(f); $('#vp-ph').hidden = true;
    vp.insertAdjacentHTML('afterbegin', `<img class="shot" src="${d}" alt="Uploaded photo">`); analyse(d); e.target.value = '';
  };
  if (S.isApp && navigator.mediaDevices) setTimeout(() => $('#sc-cam')?.click(), 400);
  return stop;
}

export function upcycle(item) {
  sheet({
    title: 'Upcycle Studio', sub: `Ideas for: ${esc(item)}`, wide: true,
    body: `<div id="up-body" class="stack"><div class="row"><span class="spinner" style="color:var(--accent)"></span><span>Thinking up projects${S.config?.ai === 'gemini' ? ' and drawing a preview' : ''}…</span></div></div>`,
    async onMount(el) {
      try {
        const r = await post('/api/ai/upcycle', { item, image: true });
        $('#up-body', el).innerHTML = `${r.image ? `<img class="gen-img" src="${r.image}" alt="AI-generated preview of ${esc(r.ideas?.[0]?.title || 'the project')}"><p class="faint" style="font-size:12px">Image generated by Gemini</p>` : `<div class="empty" style="aspect-ratio:auto">${icon('image')}<span>${r.demo ? 'Add a Gemini API key on the server to generate a picture of the finished project.' : 'No image this time.'}</span></div>`}
          ${(r.ideas || []).map((i, k) => `<div class="card" style="padding:16px"><div class="row" style="justify-content:space-between"><b>${k + 1}. ${esc(i.title)}</b><span class="pill">${esc(i.time || '')}</span></div><ol class="steps-list" style="margin-top:8px">${(i.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`).join('')}`;
      } catch (e) { $('#up-body', el).innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    },
  });
}
