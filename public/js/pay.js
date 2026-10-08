import { post } from './api.js';
import { S, matLabel, refreshMe } from './state.js';
import { $, $$, esc, inr, kg, toast, sheet, qrSvg, setBusy } from './ui.js';
import { icon } from './icons.js';

// Reserve a lot and pay the seller directly: UPI (any UPI app, no gateway) or cash at pickup.
// The sale completes only when the buyer scans the seller's handshake QR at pickup.
export function openCheckout(l, onDone) {
  let method = l.seller?.hasUpi ? 'upi' : 'cash';
  sheet({
    title: 'Reserve this lot.', sub: `${esc(l.title)} · ${kg(l.kg)} · ${esc(matLabel(l.material))}`,
    body: `<div class="stack" id="co">
      <div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="muted" style="font-size:12px">You pay the seller</div><div class="amount">${inr(l.price)}</div></div><span class="muted" style="font-size:12px">${esc(l.seller?.name || '')}${l.distanceKm != null ? ` · ${l.distanceKm} km` : ''}</span></div>
      <div class="pay-opts">
        <button type="button" class="pay-opt" data-m="upi" ${l.seller?.hasUpi ? '' : 'disabled'}><b>${icon('phone').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px;margin-right:6px"')}UPI</b><span>${l.seller?.hasUpi ? 'GPay, PhonePe, Paytm or any UPI app' : 'The seller hasn\'t added a UPI ID'}</span></button>
        <button type="button" class="pay-opt" data-m="cash"><b>${icon('cash').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px;margin-right:6px"')}Cash at pickup</b><span>Pay when you collect</span></button>
      </div>
      <ul class="checks"><li>${icon('check')}Money goes straight to the seller. EcoSync takes nothing.</li><li>${icon('check')}The sale completes when you scan the seller's QR at pickup.</li></ul>
      <button class="btn btn-primary btn-lg" id="co-go">Reserve lot ${icon('arrowUR')}</button>
    </div>`,
    onMount(el, close) {
      const draw = () => $$('[data-m]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === method)));
      $$('[data-m]', el).forEach((b) => b.addEventListener('click', () => { method = b.dataset.m; draw(); })); draw();
      $('#co-go', el).onclick = async (e) => {
        setBusy(e.currentTarget, true, 'Reserving');
        try {
          const { passport: p } = await post('/api/orders', { listingId: l.id, method });
          refreshMe().then(() => dispatchEvent(new Event('ecosync:coins')));
          onDone?.();
          if (p.payMethod !== 'upi' || !p.sellerUpi) { close(); toast(`Reserved. Passport ${p.id} created.`); location.hash = `#/passport/${p.id}`; return; }
          const upi = `upi://pay?pa=${encodeURIComponent(p.sellerUpi)}&pn=${encodeURIComponent(p.sellerName)}&am=${p.amount}&cu=INR&tn=${encodeURIComponent('EcoSync ' + p.id)}`;
          $('.sheet-head h2', el).textContent = 'Pay the seller.';
          $('#co', el).innerHTML = `<p class="muted" style="font-size:13px">Scan with any UPI app, or tap the button on your phone. You're paying <b style="color:var(--fg)">${inr(p.amount)}</b> to <span class="mono" style="color:var(--fg)">${esc(p.sellerUpi)}</span>.</p>
            <div class="upi-qr">${qrSvg(upi)}</div>
            <a class="btn btn-primary btn-lg" href="${upi}">${icon('phone')}Open my UPI app</a>
            <label class="field"><span>UPI reference number <span class="faint">(optional, helps the seller match it)</span></span><input class="input mono" id="co-ref" inputmode="numeric" maxlength="22" placeholder="12-digit UTR"></label>
            <button class="btn btn-lg" id="co-done">I've paid · go to passport ${icon('arrowR')}</button>`;
          $('#co-done', el).onclick = async () => { const ref = $('#co-ref', el).value.trim(); if (ref) await post(`/api/passport/${p.id}/payref`, { ref }).catch(() => {}); close(); toast(`Passport ${p.id} created.`); location.hash = `#/passport/${p.id}`; };
        } catch (er) { setBusy(e.currentTarget, false); toast(er.message, 'err'); }
      };
    },
  });
}
