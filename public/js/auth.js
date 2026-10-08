import { post, store } from './api.js';
import { S } from './state.js';
import { sheet, toast, esc, setBusy, $, $$ } from './ui.js';
import { icon, LOGO } from './icons.js';

const FB = 'https://www.gstatic.com/firebasejs/11.10.0/';
let fb = null;
async function firebase() {
  if (fb) return fb;
  const [{ initializeApp }, A] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js')]);
  const app = initializeApp(S.config.firebase);
  fb = { A, auth: A.getAuth(app) };
  return fb;
}
async function finish(fbUser, extra, done) {
  const idToken = await fbUser.getIdToken();
  const r = await post('/api/auth/firebase', { idToken, ...extra });
  complete(r, done);
}
function complete(r, done) {
  store.set('token', r.token); store.set('user', r.user); S.user = r.user;
  toast(`Welcome, ${r.user.name}`, 'ok'); done?.();
}

// Completes a passwordless email-link sign-in when the user lands from the email.
export async function completeEmailLink(done) {
  if (S.config?.auth !== 'firebase' || !/[?&]oobCode=/.test(location.href)) return;
  try {
    const { A, auth } = await firebase();
    if (!A.isSignInWithEmailLink(auth, location.href)) return;
    const email = store.get('pendingEmail') || '';
    if (!email) return toast('Open the link on the device where you asked for it.', 'err');
    const cred = await A.signInWithEmailLink(auth, email, location.href);
    history.replaceState(null, '', location.pathname + location.hash);
    await finish(cred.user, store.get('pendingProfile', {}), done);
  } catch (e) { toast('That sign-in link has expired. Ask for a new one.', 'err'); }
}

export function openSignIn(done, preRole) {
  const mode = S.config?.auth || 'demo';
  let role = preRole || 'seller';
  const roleHtml = `
    <div class="field"><span>I want to</span>
      <div class="seg" role="group" aria-label="Role" style="width:100%">
        <button type="button" data-role="seller" style="flex:1">Sell my scrap</button>
        <button type="button" data-role="buyer" style="flex:1">Buy & collect scrap</button>
      </div></div>
    <label class="field"><span>Your name</span><input class="input" id="si-name" autocomplete="name" placeholder="Aryan Sharma"></label>`;
  const body = `
    <form class="stack" id="si-form" novalidate>
      ${roleHtml}
      ${mode === 'firebase' ? `
        <button type="button" class="btn btn-lg btn-block" id="si-google"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z"/></svg>Continue with Google</button>
        <div class="row faint" style="font-size:13px"><span class="grow" style="height:1px;background:var(--line)"></span>or use email<span class="grow" style="height:1px;background:var(--line)"></span></div>
        <label class="field"><span>Email</span><input class="input" id="si-email" type="email" autocomplete="email" placeholder="you@school.edu.in" required></label>
        <label class="field"><span>Password</span><input class="input" id="si-pass" type="password" autocomplete="current-password" placeholder="At least 8 characters"></label>
        <div class="split"><button class="btn btn-primary btn-lg" id="si-in" type="submit">Sign in</button><button class="btn btn-lg" id="si-up" type="button">Create account</button></div>
        <button type="button" class="btn btn-ghost btn-sm" id="si-link">${icon('mail')}Email me a sign-in link instead</button>
      ` : `
        <label class="field"><span>Email</span><input class="input" id="si-email" type="email" autocomplete="email" placeholder="you@school.edu.in" required></label>
        <div id="si-code-wrap" hidden class="stack">
          <div class="field"><span id="si-code-label">Enter the 6-digit code we emailed you</span>
            <div class="otp">${'<input class="input" inputmode="numeric" maxlength="1" aria-label="Digit">'.repeat(6)}</div></div>
          <div id="si-demo" class="demo-code" hidden></div>
        </div>
        <button class="btn btn-primary btn-lg btn-block" id="si-go" type="submit">Email me a code</button>
      `}
      <p class="faint" style="font-size:12.5px">${mode === 'demo' ? 'Demo mode: no email service is connected, so your code appears on screen. Add an email key on the server for real emails.' : 'We only use your email to sign you in and send pickup receipts.'}</p>
    </form>`;

  sheet({
    title: 'Sign in to EcoSync', sub: 'One account works on the web and the Android app.', body,
    onMount(el, close) {
      const pickRole = (r) => { role = r; $$('[data-role]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === r))); };
      $$('[data-role]', el).forEach((b) => b.addEventListener('click', () => pickRole(b.dataset.role))); pickRole(role);
      const profile = () => ({ name: $('#si-name', el).value.trim(), role });
      const ok = () => { close(); done?.(); };

      if (mode === 'firebase') {
        const email = () => $('#si-email', el).value.trim(), pass = () => $('#si-pass', el).value;
        const wrap = async (btn, fn) => { setBusy(btn, true); try { await fn(); } catch (e) { toast(fbError(e), 'err'); } finally { setBusy(btn, false); } };
        $('#si-google', el).onclick = (e) => wrap(e.currentTarget, async () => { const { A, auth } = await firebase(); const c = await A.signInWithPopup(auth, new A.GoogleAuthProvider()); await finish(c.user, profile(), ok); });
        $('#si-form', el).onsubmit = (e) => { e.preventDefault(); wrap($('#si-in', el), async () => { const { A, auth } = await firebase(); const c = await A.signInWithEmailAndPassword(auth, email(), pass()); await finish(c.user, profile(), ok); }); };
        $('#si-up', el).onclick = (e) => wrap(e.currentTarget, async () => {
          if (pass().length < 8) throw { code: 'weak' };
          const { A, auth } = await firebase(); const c = await A.createUserWithEmailAndPassword(auth, email(), pass());
          if (profile().name) await A.updateProfile(c.user, { displayName: profile().name });
          await A.sendEmailVerification(c.user).catch(() => {});
          toast('Account created. Check your inbox to verify your email.', 'ok'); await finish(c.user, profile(), ok);
        });
        $('#si-link', el).onclick = (e) => wrap(e.currentTarget, async () => {
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email())) throw { code: 'auth/invalid-email' };
          const { A, auth } = await firebase();
          await A.sendSignInLinkToEmail(auth, email(), { url: location.origin + location.pathname, handleCodeInApp: true });
          store.set('pendingEmail', email()); store.set('pendingProfile', profile());
          toast(`Sign-in link sent to ${email()}. Open it on this device.`, 'ok'); close();
        });
        return;
      }

      // Email one-time code (Resend on the server, or on-screen code in demo mode)
      let stage = 'email';
      const boxes = $$('.otp input', el);
      boxes.forEach((b, i) => {
        b.addEventListener('input', () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && boxes[i + 1]) boxes[i + 1].focus(); if (boxes.every((x) => x.value)) $('#si-form', el).requestSubmit(); });
        b.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
        b.addEventListener('paste', (e) => { const d = (e.clipboardData.getData('text').match(/\d/g) || []).slice(0, 6); if (d.length) { e.preventDefault(); d.forEach((v, k) => boxes[k] && (boxes[k].value = v)); boxes[Math.min(5, d.length)]?.focus(); if (d.length === 6) $('#si-form', el).requestSubmit(); } });
      });
      $('#si-form', el).onsubmit = async (e) => {
        e.preventDefault();
        const btn = $('#si-go', el), email = $('#si-email', el).value.trim();
        if (stage === 'email') {
          setBusy(btn, true, 'Sending');
          try {
            const r = await post('/api/auth/otp/request', { email });
            stage = 'code'; $('#si-code-wrap', el).hidden = false; $('#si-email', el).readOnly = true;
            if (r.demoCode) { const d = $('#si-demo', el); d.hidden = false; d.innerHTML = `Demo code: <b class="mono" style="letter-spacing:.2em">${esc(r.demoCode)}</b>`; $('#si-code-label', el).textContent = 'Enter the 6-digit code'; }
            setBusy(btn, false); btn.textContent = 'Verify and continue'; boxes[0].focus();
          } catch (err) { setBusy(btn, false); toast(err.message, 'err'); }
        } else {
          const code = boxes.map((b) => b.value).join('');
          if (code.length < 6) return toast('Enter all 6 digits.', 'err');
          setBusy(btn, true, 'Checking');
          try { const r = await post('/api/auth/otp/verify', { email, code, ...profile() }); complete(r, ok); }
          catch (err) { setBusy(btn, false); toast(err.message, 'err'); boxes.forEach((b) => (b.value = '')); boxes[0].focus(); }
        }
      };
    },
  });
}
function fbError(e) {
  const c = e?.code || '';
  if (c === 'weak') return 'Use a password with at least 8 characters.';
  if (c.includes('invalid-email')) return 'Enter a valid email address.';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Email or password is wrong. Try again or create an account.';
  if (c.includes('email-already-in-use')) return 'That email already has an account. Sign in instead.';
  if (c.includes('popup')) return 'The Google window was closed before finishing.';
  if (c.includes('unauthorized-domain')) return 'Add this site\'s domain to Firebase Authentication → Settings → Authorized domains.';
  return e?.message || 'Sign-in failed. Try again.';
}
export { LOGO };
