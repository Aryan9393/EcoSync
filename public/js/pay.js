import { post } from './api.js';
import { S, matLabel, matColor } from './state.js';
import { sheet, toast, esc, inr, kg, setBusy, loadScript, $ } from './ui.js';
import { icon } from './icons.js';

// Checkout with escrow: money is captured now, released to the seller only after the QR handshake at pickup.
export function openCheckout(l, onDone) {
  const live = S.config?.payments === 'razorpay';
  const snapshot = { title: l.title, material: l.material, kg: l.kg, price: l.price, lat: l.lat, lng: l.lng, area: l.area, notes: l.notes, sellerName: l.seller?.name || l.sellerName };
  sheet({
    title: 'Buy and book pickup', sub: `${esc(l.title)} · ${kg(l.kg)} from ${esc(snapshot.sellerName || 'a seller')}`,
    body: `<div class="pay-sheet stack">
      <div class="row" style="justify-content:space-between"><div><div class="muted" style="font-size:13px">You pay</div><div class="amount">${inr(l.price)}</div></div>
        <span class="pill" style="border-color:${matColor(l.material)}"><i class="swatch" style="background:${matColor(l.material)}"></i>${esc(matLabel(l.material))}</span></div>
      <div class="escrow">
        <div>${icon('lock')}Paid into EcoSync escrow</div>
        <div>${icon('qr')}Scan seller's QR at pickup</div>
        <div>${icon('check')}Money released to seller</div>
      </div>
      <p class="muted" style="font-size:13.5px">If the pickup doesn't happen, the payment is refunded. Every sale gets a QR material passport you can track.</p>
      ${live ? '' : '<div class="demo-code">Test mode: no payment gateway is connected, so no real money moves. Add Razorpay keys on the server to accept UPI, cards and netbanking.</div>'}
      <button class="btn btn-primary btn-lg btn-block" id="pay-go">${icon('shield')}${live ? `Pay ${inr(l.price)} securely` : `Complete test payment of ${inr(l.price)}`}</button>
      <p class="faint" style="font-size:12px;text-align:center">${live ? 'Secured by Razorpay · UPI, cards, netbanking, wallets' : 'Simulated checkout'}</p>
    </div>`,
    onMount(el, close) {
      $('#pay-go', el).onclick = async (e) => {
        const btn = e.currentTarget; setBusy(btn, true, 'Starting payment');
        try {
          const order = await post('/api/pay/order', { listingId: l.id, snapshot });
          if (order.mode === 'razorpay') {
            await loadScript('https://checkout.razorpay.com/v1/checkout.js');
            const rzp = new window.Razorpay({
              key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
              name: 'EcoSync', description: l.title, prefill: { name: S.user?.name, email: S.user?.email },
              theme: { color: '#0c9c70' },
              handler: async (resp) => { try { const r = await post('/api/pay/verify', { listingId: l.id, snapshot, ...resp }); close(); success(r.passport, onDone); } catch (err) { toast(err.message, 'err'); } },
              modal: { ondismiss: () => setBusy(btn, false) },
            });
            rzp.on('payment.failed', (r) => { toast(r.error?.description || 'Payment failed. No money was taken.', 'err'); setBusy(btn, false); });
            rzp.open();
          } else {
            btn.innerHTML = '<span class="spinner"></span><span>Processing test payment</span>';
            await new Promise((r) => setTimeout(r, 1100));
            const r = await post('/api/pay/verify', { listingId: l.id, snapshot, demo: true });
            close(); success(r.passport, onDone);
          }
        } catch (err) { setBusy(btn, false); toast(err.message, 'err'); }
      };
    },
  });
}
function success(p, onDone) {
  toast(`Payment held in escrow. Passport ${p.id} created.`, 'ok');
  onDone?.(p);
  location.hash = `#/passport/${p.id}`;
}
