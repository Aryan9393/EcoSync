import { detect, backend, store } from './api.js';
import { S, refreshMe, locate, signOutLocal } from './state.js';
import { $, $$, esc, toast, sheet, closeSheets } from './ui.js';
import { icon, BRAND } from './icons.js';
import { openSignIn } from './auth.js';
import { landingHtml, landingMount, openTour } from './landing.js';
import * as V from './views.js';
import * as Scan from './scan.js';
import * as Maps from './maps.js';
import * as Passport from './passport.js';
import * as Bot from './bot.js';

const NAV = [
  ['home', 'Overview', 'home'], ['scan', 'Scanner', 'scan'], ['market', 'Market', 'market'], ['pickups', 'Pickups', 'truck'],
  ['passport', 'Passports', 'qr'], ['map', 'Maps', 'map'], ['wallet', 'EcoCoins', 'coin'], ['bot', 'EcoBot', 'bot'], ['board', 'Ward Wars', 'trophy'],
];
const TABS = [['home', 'Home', 'home'], ['market', 'Market', 'market'], ['scan', 'Scan', 'scan'], ['map', 'Maps', 'map'], ['wallet', 'Coins', 'coin']];
const ROUTES = { home: V.dashboard, scan: Scan.render, market: V.market, pickups: V.pickups, passport: Passport.render, map: Maps.render, wallet: V.wallet, bot: Bot.render, board: V.board, profile: V.profile };
const PUBLIC = new Set(['scan', 'map', 'bot', 'board', 'passport', 'market']);

let cleanup = null;
export function requireAuth(next, role = 'seller') {
  if (S.user) return true;
  openSignIn('up', role, () => { renderShell(); next ? next() : route(); });
  return false;
}
export function applyTheme(t = store.get('theme'), fromUser = false) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else if (fromUser) delete document.documentElement.dataset.theme;
}
export { route, renderShell, openTour };

async function boot() {
  applyTheme();
  playIntro();
  S.config = await detect();
  await refreshMe();
  if (!S.loc.approx || S.isApp) locate();
  addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && backend === 'server' && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

function playIntro() {
  const intro = $('#intro');
  let seen = false; try { seen = sessionStorage.getItem('ecosync.intro'); } catch {}
  if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches) { intro.remove(); return; }
  const end = () => { intro.classList.add('done'); setTimeout(() => intro.remove(), 650); try { sessionStorage.setItem('ecosync.intro', '1'); } catch {} };
  intro.onclick = end; setTimeout(end, 2300);
}

const parse = () => { const [, name = '', ...rest] = (location.hash || '#/').split('/'); return { name: name.split('?')[0], params: rest }; };

async function route() {
  const { name, params } = parse();
  cleanup?.(); cleanup = null; closeSheets();
  if (!name || name === 'about') return renderLanding();
  if (!ROUTES[name]) { location.hash = '#/home'; return; }
  if (!S.user && !PUBLIC.has(name)) { renderLanding(); openSignIn('in', 'seller', () => route()); return; }
  renderShell(name);
  scrollTo(0, 0);
  const host = $('#page'); host.innerHTML = '';
  try { cleanup = (await ROUTES[name](host, params)) || null; }
  catch (e) { console.error(e); host.innerHTML = `<div class="empty"><span class="serif">This screen didn't load.</span><span>${esc(e.message)}</span><button class="btn" onclick="location.reload()">Reload</button></div>`; }
}

function renderLanding() {
  const app = $('#app');
  app.innerHTML = landingHtml();
  if (S.user) $$('[data-signin]', app).forEach((b) => { if (!b.closest('.footer')) { b.innerHTML = b.classList.contains('link') ? 'Open app' : `Open EcoSync ${icon('arrowUR')}`; b.dataset.open = '1'; } });
  cleanup = landingMount(app, { openSignIn: (mode, role) => (S.user ? (location.hash = '#/home') : openSignIn(mode, role)), applyTheme });
  scrollTo(0, 0);
}

function renderShell(current = parse().name) {
  const app = $('#app'), u = S.user;
  if (!$('.shell', app)) {
    app.innerHTML = `<div class="shell">
      <aside class="side" aria-label="Main"><a class="brand" href="#/">${BRAND}</a><div id="side-who"></div><nav id="side-nav" class="stack" style="gap:2px"></nav><div class="spacer"></div><div class="side-foot" id="side-foot"></div></aside>
      <div class="main">
        <div class="topline"><div class="crumb" id="crumb"></div><div class="row" id="top-right"></div></div>
        <header class="mobile-top"><a class="brand" href="#/">${BRAND}</a><div class="row" style="gap:6px" id="m-right"></div></header>
        <div class="page" id="page"></div>
      </div>
      <nav class="tabbar" id="tabbar" aria-label="Tabs"></nav></div>`;
  }
  const initials = (u?.name || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  $('#side-who').innerHTML = u ? `<a class="who" href="#/profile"><span class="avatar">${esc(initials)}</span><span style="min-width:0"><b>${esc(u.name)}</b><span>${u.role === 'buyer' ? 'Collector' : 'Seller'}${u.ward ? ' · ' + esc(u.ward) : ''}</span></span></a>`
    : `<div class="who"><span class="avatar">${icon('user').replace('<svg', '<svg style="width:15px;height:15px"')}</span><span><b>Guest</b><span>Sign in to save your work</span></span></div>`;
  $('#side-nav').innerHTML = NAV.map(([r, l, ic]) => `<a class="nav-item" href="#/${r}" ${r === current ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></a>`).join('');
  $('#side-foot').innerHTML = u ? `<div class="seg" role="group" aria-label="Mode" style="width:100%"><button data-role="seller" aria-pressed="${u.role === 'seller'}" style="flex:1">Seller</button><button data-role="buyer" aria-pressed="${u.role === 'buyer'}" style="flex:1">Collector</button></div>
      <div class="row" style="justify-content:space-between"><button class="link" data-tour style="font-weight:500;color:var(--muted)">Take the tour</button><button class="icon-btn" data-theme aria-label="Switch theme">${icon('sun')}</button></div>`
    : `<button class="btn btn-primary btn-block" data-signin>Create account ${icon('arrowUR')}</button><button class="link" data-signin-in style="font-weight:500;color:var(--muted)">I already have an account</button>`;
  const label = (NAV.find(([r]) => r === current) || [, current === 'profile' ? 'Profile' : ''])[1];
  $('#crumb').innerHTML = `<span>ecosync.app</span><span>/</span><b>${esc(label)}</b>`;
  $('#top-right').innerHTML = u ? `<a class="tag" href="#/wallet" style="text-decoration:none">${icon('coin')}<span class="num">${S.wallet?.coins ?? '—'}</span> EcoCoins</a>` : `<button class="btn btn-sm btn-primary" data-signin>Sign up free</button>`;
  $('#m-right').innerHTML = `${u ? `<a class="tag" href="#/wallet" style="text-decoration:none">${icon('coin')}<span class="num">${S.wallet?.coins ?? '—'}</span></a>` : `<button class="btn btn-sm btn-primary" data-signin>Sign up</button>`}<button class="icon-btn" id="m-more" aria-label="Menu">${icon('menu')}</button>`;
  $('#tabbar').innerHTML = TABS.map(([r, l, ic]) => r === 'scan'
    ? `<a href="#/scan" class="scan" ${r === current ? 'aria-current="page"' : ''}><span class="ring">${icon(ic)}</span><span>${l}</span></a>`
    : `<a href="#/${r}" ${r === current ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></a>`).join('');
  $$('[data-role]', app).forEach((b) => b.addEventListener('click', () => V.setRole(b.dataset.role)));
  $$('[data-signin]', app).forEach((b) => b.addEventListener('click', () => requireAuth()));
  $$('[data-signin-in]', app).forEach((b) => b.addEventListener('click', () => openSignIn('in', 'seller', () => { renderShell(); route(); })));
  $$('[data-tour]', app).forEach((b) => b.addEventListener('click', () => openTour()));
  $$('[data-theme]', app).forEach((b) => b.addEventListener('click', toggleTheme));
  $('#m-more').onclick = () => sheet({
    title: 'Menu', small: true,
    body: `<nav class="stack" style="gap:2px">${[...NAV, ['profile', 'Profile & settings', 'user']].map(([r, l, ic]) => `<a class="nav-item" data-close href="#/${r}" ${r === current ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
      ${u ? `<div class="seg" style="width:100%"><button data-close data-role2="seller" aria-pressed="${u.role === 'seller'}" style="flex:1">Seller mode</button><button data-close data-role2="buyer" aria-pressed="${u.role === 'buyer'}" style="flex:1">Collector mode</button></div>` : ''}
      <div class="row" style="justify-content:space-between"><button class="link" data-close data-tour2>Take the tour</button><button class="icon-btn" data-theme2 aria-label="Switch theme">${icon('sun')}</button></div>`,
    onMount(el) { $$('[data-role2]', el).forEach((b) => b.addEventListener('click', () => V.setRole(b.dataset.role2))); $('[data-tour2]', el).onclick = () => setTimeout(openTour, 50); $('[data-theme2]', el).onclick = toggleTheme; },
  });
}
function toggleTheme() {
  const dark = getComputedStyle(document.documentElement).colorScheme.includes('dark');
  const t = dark ? 'light' : 'dark'; store.set('theme', t); applyTheme(t, true);
}

addEventListener('ecosync:signout', () => { signOutLocal(); location.hash = '#/'; toast('Signed out'); });
addEventListener('ecosync:coins', () => { const c = S.wallet?.coins; $$('#top-right .num, #m-right .num').forEach((n) => (n.textContent = c ?? '—')); });
boot();
