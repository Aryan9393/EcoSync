import { detect, backend, store } from './api.js';
import { S, refreshMe, locate, signOutLocal } from './state.js';
import { $, $$, esc, toast, sheet } from './ui.js';
import { icon, LOGO } from './icons.js';
import { openSignIn, completeEmailLink } from './auth.js';
import * as V from './views.js';
import * as Scan from './scan.js';
import * as Maps from './maps.js';
import * as Passport from './passport.js';
import * as Bot from './bot.js';

const NAV = [
  ['', 'Home', 'home'], ['scan', 'AI scanner', 'scan'], ['market', 'Marketplace', 'market'], ['map', 'Maps', 'map'],
  ['pickups', 'Pickups', 'truck'], ['wallet', 'EcoCoins', 'wallet'], ['passport', 'Passports', 'qr'], ['bot', 'EcoBot', 'bot'], ['board', 'Ward Wars', 'trophy'],
];
const TABS = [['', 'Home', 'home'], ['market', 'Market', 'market'], ['scan', 'Scan', 'scan'], ['map', 'Maps', 'map'], ['wallet', 'Coins', 'wallet']];
const ROUTES = { '': V.dashboard, scan: Scan.render, market: V.market, map: Maps.render, pickups: V.pickups, wallet: V.wallet, passport: Passport.render, bot: Bot.render, board: V.board, profile: V.profile };

let cleanup = null;
export function requireAuth(next, role) {
  if (S.user) return true;
  openSignIn(() => { renderShell(); next ? next() : route(); }, role);
  return false;
}
export { route };

async function boot() {
  applyTheme();
  playIntro();
  S.config = await detect();
  if (backend === 'preview') document.documentElement.dataset.preview = '1';
  await completeEmailLink(() => route());
  await refreshMe();
  locate();
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && backend === 'server' && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

function playIntro() {
  const intro = $('#intro');
  const seen = sessionStorage.getItem('ecosync.intro');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (seen || reduce) { intro.remove(); return; }
  const end = () => { intro.classList.add('done'); setTimeout(() => intro.remove(), 600); try { sessionStorage.setItem('ecosync.intro', '1'); } catch {} };
  $('.intro-skip', intro).onclick = end; intro.onclick = end;
  setTimeout(end, 2700);
}

// Only touches data-theme when the user picked a theme in Settings, so a host's own theme attribute is respected.
export function applyTheme(t = store.get('theme'), fromUser = false) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else if (fromUser) delete document.documentElement.dataset.theme;
}

function parse() {
  const [, name = '', ...rest] = (location.hash || '#/').split('/');
  return { name: name.split('?')[0], params: rest };
}

async function route() {
  const { name, params } = parse();
  cleanup?.(); cleanup = null;
  $$('#sheet-root .scrim').forEach((x) => x.querySelector('[data-close]')?.click());
  window.scrollTo(0, 0);
  if (!name && !S.user) { renderLanding(); return; }
  const view = ROUTES[name] || V.dashboard;
  renderShell(name);
  const host = $('#page');
  host.innerHTML = '';
  try { cleanup = (await view(host, params)) || null; }
  catch (e) { console.error(e); host.innerHTML = `<div class="empty"><b>This screen didn't load.</b><span>${esc(e.message)}</span><button class="btn" onclick="location.reload()">Reload</button></div>`; }
}

function renderShell(current = parse().name) {
  const app = $('#app');
  const u = S.user;
  if (!$('.shell', app)) {
    app.dataset.view = 'app';
    app.innerHTML = `<div class="shell">
      <aside class="rail" aria-label="Main">
        <a class="brand" href="#/">${LOGO}<span>EcoSync</span></a>
        <nav class="stack" style="gap:2px" id="rail-nav"></nav>
        <div class="spacer"></div>
        <div id="rail-foot" class="stack" style="gap:10px"></div>
      </aside>
      <header class="mobile-top">
        <a class="brand" href="#/">${LOGO}<span>EcoSync</span></a>
        <div class="row" style="gap:8px" id="mtop-actions"></div>
      </header>
      <main class="main" id="main"><div class="page" id="page"></div></main>
      <nav class="tabbar" id="tabbar" aria-label="Tabs"></nav>
    </div>`;
  }
  $('#rail-nav').innerHTML = NAV.map(([r, label, ic]) => `<a class="nav-item" href="#/${r}" ${r === current ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('');
  $('#tabbar').innerHTML = TABS.map(([r, label, ic]) => r === 'scan'
    ? `<a href="#/scan" class="scan-tab" ${r === current ? 'aria-current="page"' : ''}><span class="ring">${icon(ic)}</span><span>${label}</span></a>`
    : `<a href="#/${r}" ${r === current ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('');
  $('#rail-foot').innerHTML = u ? `
    <div class="role-switch" role="group" aria-label="Mode">
      <button data-setrole="seller" aria-pressed="${u.role === 'seller'}">Seller</button>
      <button data-setrole="buyer" aria-pressed="${u.role === 'buyer'}">Buyer</button>
    </div>
    <a class="nav-item" href="#/profile" ${current === 'profile' ? 'aria-current="page"' : ''}>${icon('user')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.name)}</span></a>`
    : `<button class="btn btn-primary btn-block" id="rail-signin">Sign in</button>`;
  $('#mtop-actions').innerHTML = `${u ? `<button class="pill coin" id="mtop-coins">${icon('coin').replace('<svg', '<svg style="width:14px;height:14px"')}${S.wallet?.coins ?? '—'}</button>` : ''}
    <button class="icon-btn" id="mtop-more" aria-label="All screens">${icon('settings')}</button>`;
  $('#rail-signin')?.addEventListener('click', () => requireAuth());
  $$('[data-setrole]').forEach((b) => b.addEventListener('click', () => V.setRole(b.dataset.setrole)));
  $('#mtop-coins')?.addEventListener('click', () => (location.hash = '#/wallet'));
  $('#mtop-more').onclick = () => sheet({
    title: 'EcoSync', body: `<nav class="stack" style="gap:2px">${[...NAV, ['profile', u ? 'Profile & settings' : 'Settings', 'user']].map(([r, l, ic]) => `<a class="nav-item" data-close href="#/${r}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
      ${u ? `<div class="role-switch" role="group" aria-label="Mode"><button data-close data-setrole2="seller" aria-pressed="${u.role === 'seller'}">Seller mode</button><button data-close data-setrole2="buyer" aria-pressed="${u.role === 'buyer'}">Buyer mode</button></div>` : '<button class="btn btn-primary btn-block" data-close id="more-signin">Sign in</button>'}`,
    onMount(el) { $$('[data-setrole2]', el).forEach((b) => b.addEventListener('click', () => V.setRole(b.dataset.setrole2))); $('#more-signin', el)?.addEventListener('click', () => requireAuth()); },
  });
}
export { renderShell };

function renderLanding() {
  const app = $('#app');
  app.dataset.view = 'landing';
  app.innerHTML = V.landingHtml();
  V.landingMount(app);
}

window.addEventListener('ecosync:signout', () => { signOutLocal(); location.hash = '#/'; renderLanding(); toast('Signed out'); });
boot();
