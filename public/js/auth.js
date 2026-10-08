import { post, store } from './api.js';
import { S } from './state.js';
import { sheet, toast, setBusy, $, $$ } from './ui.js';
import { icon } from './icons.js';

// Email + password accounts. Passwords are hashed on the server and stored in Postgres.
export function openSignIn(mode = 'up', role = 'seller', done) {
  sheet({
    title: mode === 'in' ? 'Welcome back.' : 'Make it yours.',
    sub: mode === 'in' ? 'Sign in to your EcoSync account.' : 'One account for the web and the Android app.',
    body: `<div class="seg" role="tablist" style="justify-self:start"><button data-mode="up">Create account</button><button data-mode="in">Sign in</button></div>
      <form class="stack" id="au" novalidate>
        <div class="field" data-up><span>I'm here to</span><div class="pay-opts">
          <button type="button" class="pay-opt" data-role="seller"><b>Sell my scrap</b><span>Home, hostel, shop</span></button>
          <button type="button" class="pay-opt" data-role="buyer"><b>Collect scrap</b><span>Kabadiwala, recycler, upcycler</span></button></div></div>
        <label class="field" data-up><span>Your name</span><input class="input" id="au-name" autocomplete="name"></label>
        <label class="field"><span>Email</span><input class="input" id="au-email" type="email" autocomplete="email" inputmode="email"></label>
        <label class="field"><span>Password</span><input class="input" id="au-pass" type="password" autocomplete="current-password" placeholder="At least 8 characters"></label>
        <label class="field" data-up><span>Ward or area <span class="faint">(optional, for Ward Wars)</span></span><input class="input" id="au-ward" placeholder="Ward 12"></label>
        <button class="btn btn-primary btn-lg" type="submit" id="au-go"></button>
        <p class="faint" style="font-size:11.5px">Your password is stored as a salted hash. We never share your email.</p>
      </form>`,
    onMount(el, close) {
      const draw = () => {
        $$('[data-mode]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
        $$('[data-up]', el).forEach((x) => (x.hidden = mode === 'in'));
        $$('[data-role]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === role)));
        $('.sheet-head h2', el).textContent = mode === 'in' ? 'Welcome back.' : 'Make it yours.';
        $('#au-go', el).innerHTML = `${mode === 'in' ? 'Sign in' : 'Create account'} ${icon('arrowUR')}`;
        $('#au-pass', el).autocomplete = mode === 'in' ? 'current-password' : 'new-password';
      };
      $$('[data-mode]', el).forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; draw(); }));
      $$('[data-role]', el).forEach((b) => b.addEventListener('click', () => { role = b.dataset.role; draw(); }));
      draw();
      $('#au', el).onsubmit = async (e) => {
        e.preventDefault();
        const btn = $('#au-go', el); setBusy(btn, true, mode === 'in' ? 'Signing in' : 'Creating your account');
        try {
          const body = { email: $('#au-email', el).value.trim(), password: $('#au-pass', el).value };
          const r = mode === 'in' ? await post('/api/auth/signin', body) : await post('/api/auth/signup', { ...body, name: $('#au-name', el).value.trim(), ward: $('#au-ward', el).value.trim(), role });
          store.set('token', r.token); store.set('user', r.user); S.user = r.user;
          close(); toast(mode === 'in' ? `Welcome back, ${r.user.name.split(' ')[0]}` : 'Account created. +50 EcoCoins to start.');
          done ? done() : (location.hash = '#/home');
        } catch (er) { setBusy(btn, false); toast(er.message, 'err'); }
      };
    },
  });
}
