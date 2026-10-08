import { $, $$, esc, sheet, qrSvg, scribbleEllipse } from './ui.js';
import { icon, MARK, BRAND } from './icons.js';
import { mockup } from './mocks.js';
import { backend, BASE, store } from './api.js';

const STEPS = [
  ['scan', 'Scan it', 'Point your camera. The scanner names the material and its price per kilo.'],
  ['market', 'List it', 'Collectors nearby see it straight away. Or just say it, in Hindi.'],
  ['pickup', 'Book it', 'Pick a day and a slot. A leaf means a van is already passing.'],
  ['passport', 'Hand it over', 'The collector scans your QR. The sale is done, the money is yours.'],
  ['coins', 'Trace it', 'Follow it to the hub and into something new. Earn as you go.'],
];

export function landingHtml() {
  return `
  <header class="nav"><div class="wrap">
    <a class="brand" href="#/" aria-label="EcoSync home">${BRAND}</a>
    <nav class="nav-links" aria-label="Sections"><a href="#paths" data-scroll class="circled">Two paths</a><a href="#how" data-scroll>How it works</a><a href="#/bot">Help</a></nav>
    <div class="nav-right">
      <button class="icon-btn" data-theme-toggle aria-label="Switch theme">${icon('sun')}</button>
      <button class="link hide-sm" data-signin="in">Sign in</button>
      <button class="btn" data-signin="up">Create your account ${icon('arrowUR')}</button>
    </div>
  </div></header>

  <main>
  <section class="wrap hero">
    <div>
      <span class="eyebrow">Free, for every household</span>
      <h1>A second life<br>for your scrap.</h1>
      <p class="lede">Your home. Your street. Your own recycling trail.<br>Scan it, sell it to a collector nearby, and see what it becomes.</p>
      <div class="cta"><button class="btn btn-primary btn-lg" data-signin="up">Start recycling ${icon('arrowUR')}</button><a class="link" href="#paths" data-scroll>Find your path ${icon('arrowD')}</a></div>
      <p class="fine">No subscriptions. No commission. Just a cleaner street.</p>
    </div>
    <div class="card-stage" id="stage">
      <div class="blob"></div>
      <div class="pcard" id="pcard">
        <div class="top">${MARK()}<div class="qr-mini">${qrSvg('https://ecosync.app')}</div></div>
        <div><div class="label">Your material passport</div><div class="pid">ES-····-····</div><div class="stripe" style="margin-top:14px"></div></div>
        <div class="bottom"><div class="bars"></div><span class="built">Built on EcoSync ${icon('arrowUR')}</span></div>
      </div>
      <svg class="scribble" viewBox="0 0 200 80" fill="none" aria-hidden="true">
        <path id="curve" d="M0 74 C 50 76, 100 64, 150 40" />
        <text><textPath href="#curve">Yours, from the first scan.</textPath></text>
        <path d="M190 6 C 184 26, 176 38, 158 48 M158 48 l8 -10 M158 48 l13 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
    </div>
  </section>
  <div class="wrap hero-meta"><span>${MARK()} An independent platform, built with care.</span><a class="link" href="#paths" data-scroll style="font-weight:500;font-size:11.5px;color:var(--faint)">Scroll to make it yours ${icon('arrowD')}</a></div>

  <section class="wrap section" id="paths">
    <div class="sec-head"><div><span class="eyebrow plain">Two ways to belong</span><h2>Different sides.<br>One clean pickup.</h2></div>
      <p class="aside">Start with what you have.<br>We'll bring the right tools along.</p></div>
    <div class="paths">
      <article class="path">
        <div class="ph">${icon('home')}<span>For homes, hostels &amp; shops ${icon('arrowUR')}</span></div>
        <div><h3>Seller</h3><p class="sub">Clear the clutter. Get paid fairly.</p></div>
        <div class="tilt" style="transform:none">${mockup('scan', 'seller')}</div>
        <ul class="arrows"><li>AI scanner and a fair price per kilo</li><li>Doorstep pickups with a code</li><li>Paid by UPI or cash, sealed by a QR handshake</li><li>EcoCoins for every kilo</li></ul>
        <button class="foot" data-signin="up" data-role="seller">Start as a seller ${icon('arrowR')}</button>
      </article>
      <article class="path">
        <div class="ph">${icon('truck')}<span>For kabadiwalas, recyclers &amp; upcyclers ${icon('arrowUR')}</span></div>
        <div><h3>Collector</h3><p class="sub">Sorted scrap, close by. No more door-knocking.</p></div>
        <div style="transform:none">${mockup('market', 'collector')}</div>
        <ul class="arrows"><li>Every open lot nearby, nearest first</li><li>Pay sellers directly by UPI or in cash</li><li>Passports that prove where material came from</li><li>Official recycling hubs to drop off at</li></ul>
        <button class="foot" data-signin="up" data-role="buyer">Start as a collector ${icon('arrowR')}</button>
      </article>
    </div>
  </section>

  <section class="wrap section" id="how">
    <div class="how">
      <div>
        <span class="eyebrow plain">A few taps. A trail of your own.</span>
        <h2>Your scrap<br>sells itself.</h2>
        <ol class="steps" id="steps">${STEPS.map(([k, t, d], i) => `<li><button data-step="${i}"><span class="n">${i + 1}</span><span><b>${t}</b><span class="d">${d}</span></span></button></li>`).join('')}</ol>
      </div>
      <div>
        <div class="preview-label">Live interface preview · <span id="step-name">Scan it</span></div>
        <div class="mock-wrap" id="step-mock">${mockup('scan')}</div>
        <div class="preview-foot"><div class="seg" role="group" aria-label="View as"><button data-who="seller" aria-pressed="true">Seller</button><button data-who="collector" aria-pressed="false">Collector</button></div><span>Preview only</span></div>
      </div>
    </div>
  </section>

  <div class="band"><section class="wrap section">
    <div class="feature-row">
      <div>
        <span class="eyebrow plain">A shared trail</span>
        <h2>One QR.<br>Every handover.</h2>
        <p class="lead">The same passport follows a bag of bottles from your door to the recycler, and shows everyone the same record. Sellers, collectors and anyone who scans the label.</p>
        <div class="row" style="margin-top:22px"><span class="tag grad">Seller</span><span class="tag">Collector</span><span class="tag">Anyone with the QR</span></div>
        <ul class="checks" style="margin-top:18px"><li>${icon('check')}Names shortened, addresses never shown</li><li>${icon('check')}Every step is timestamped and can't be skipped</li></ul>
      </div>
      <div class="tilt">${mockup('passport')}</div>
    </div>
  </section></div>

  <section class="wrap section">
    <div class="feature-row flip">
      <div>
        <span class="eyebrow plain">Real places. A clear map.</span>
        <h2>The map does<br>the walking.</h2>
        <p class="lead">Recycling centres, e-waste points and scrap yards come straight from OpenStreetMap. Spot a garbage pile? Pin it on the 3D city map. Whoever cleans it up earns 40 coins.</p>
        <ul class="checks" style="margin-top:20px"><li>${icon('check')}Live data from OpenStreetMap</li><li>${icon('check')}A 3D city you can orbit</li><li>${icon('check')}Look around any spot with Street View</li></ul>
        <a class="link" href="#/map" style="margin-top:22px">Open the map ${icon('arrowR')}</a>
      </div>
      <div class="tilt-r">${mockup('map')}</div>
    </div>
  </section>

  <section class="wrap section">
    <div class="feature-row">
      <div>
        <span class="eyebrow plain">Small acts, counted</span>
        <h2>Less waste.<br>More worth.</h2>
        <p class="lead">Every listing, pickup and cleaned-up corner adds EcoCoins. Book when a van is already nearby and you earn more, because the trip was going to happen anyway.</p>
        <p class="lead" style="margin-top:10px;font-size:12.5px">Ask EcoBot anything, in Hindi or English. Turn coins into saplings, metro top-ups and notebooks.</p>
      </div>
      <div class="mock-wrap tilt">${mockup('coins')}${scribbleEllipse('', [44, 30, 70, 22])}</div>
    </div>
  </section>

  <section class="wrap cta-end">
    <div><span class="eyebrow plain">Your home. Your street.</span><h2 class="serif" style="font-size:clamp(46px,6.2vw,80px);line-height:.93;margin-top:14px">Make room for<br>a cleaner street.</h2></div>
    <div class="stack" style="gap:18px;justify-items:start"><p>Choose your path. Add your name.<br>We'll help you make it yours.</p>
      <button class="btn btn-primary btn-lg" data-signin="up">Create your free account ${icon('arrowUR')}</button>
      <button class="link" data-tour style="font-weight:500">Take a tour</button></div>
  </section>
  </main>

  <footer class="footer"><div class="wrap">
    <div class="top"><span>${MARK()} Built for places that recycle together</span>
      <nav><button data-signin="in">Sign in</button><button data-tour>Take the tour</button><a href="${BASE}/download/android" data-apk>Android app</a></nav></div>
    <a class="wordmark" href="#/" data-top aria-label="Back to top"><b>ecosync</b>${icon('arrowUR')}</a>
    <div class="bottom"><span>Free for every household.</span><span>Independent student build · TECHBEANS 7.0 · © 2026</span><button data-top>Back to top ↑</button></div>
  </div></footer>`;
}

export function landingMount(root, { openSignIn, applyTheme }) {
  const cleanups = [];
  $$('[data-signin]', root).forEach((b) => b.addEventListener('click', () => openSignIn(b.dataset.signin, b.dataset.role)));
  $$('[data-scroll]', root).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); $(a.getAttribute('href'), root)?.scrollIntoView({ behavior: 'smooth' }); }));
  $$('[data-tour]', root).forEach((b) => b.addEventListener('click', () => openTour()));
  $$('[data-top]', root).forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); }));
  $('[data-apk]', root)?.addEventListener('click', (e) => { if (backend === 'preview') { e.preventDefault(); } });
  $('[data-theme-toggle]', root).addEventListener('click', () => {
    const dark = getComputedStyle(document.documentElement).colorScheme.includes('dark');
    const t = dark ? 'light' : 'dark'; store.set('theme', t); applyTheme(t, true);
    $('[data-theme-toggle]', root).innerHTML = icon(dark ? 'moon' : 'sun');
  });

  // Card: gradient stripe fills in, gentle parallax with the pointer.
  const card = $('#pcard', root), stage = $('#stage', root);
  setTimeout(() => card.classList.add('on'), 400);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    const move = (e) => { const r = stage.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; card.style.transform = `rotateX(${9 - y * 10}deg) rotateY(${-16 + x * 16}deg) rotateZ(3deg)`; };
    const leave = () => (card.style.transform = '');
    stage.addEventListener('pointermove', move); stage.addEventListener('pointerleave', leave);
  }

  // Steps with auto-advance and seller/collector toggle.
  let step = 0, who = 'seller', timer;
  const draw = () => {
    $$('#steps button', root).forEach((b, i) => { i === step ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'); b.querySelector('.n').innerHTML = i < step ? icon('check') : String(i + 1); });
    $('#step-name', root).textContent = STEPS[step][1];
    $('#step-mock', root).innerHTML = mockup(STEPS[step][0], who);
  };
  const auto = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => { step = (step + 1) % STEPS.length; draw(); }, 3600); };
  $$('#steps button', root).forEach((b) => b.addEventListener('click', () => { step = +b.dataset.step; draw(); auto(); }));
  $$('[data-who]', root).forEach((b) => b.addEventListener('click', () => { who = b.dataset.who; $$('[data-who]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); auto(); }));
  draw(); auto();
  cleanups.push(() => clearInterval(timer));

  const prog = $('#progress');
  const onScroll = () => { const h = document.documentElement.scrollHeight - innerHeight; prog.style.width = `${h > 0 ? (scrollY / h) * 100 : 0}%`; };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  cleanups.push(() => { removeEventListener('scroll', onScroll); prog.style.width = '0'; });
  return () => cleanups.forEach((f) => f());
}

// Guided tour, Plinth-style: preview on the left, story on the right.
const TOUR = [
  ['overview', 'Welcome to EcoSync', 'A second life for your scrap.', 'EcoSync connects homes with scrap to clear and collectors who want it, and keeps a record of where every kilo goes. Free for everyone.', [20, 30, 70, 30]],
  ['scan', 'The scanner', 'Point. Know. Sort.', 'The scanner runs right in your browser. It names the item, its plastic number, how to prepare it and what it\'s worth per kilo.', [64, 28, 62, 20]],
  ['market', 'The market', 'Lots near you, nearest first.', 'Sellers list in seconds, by typing or speaking. Collectors see every open lot nearby and reserve it with one tap.', [19, 29, 70, 24]],
  ['pickup', 'Pickups', 'Ride along on a Green Route.', 'Choose a day and a slot. Slots marked with a leaf already have a pickup close by, so you earn 25 extra coins.', [22, 52, 30, 26]],
  ['passport', 'The passport', 'One QR. Every handover.', 'Each sale gets a QR passport. At pickup the collector scans the seller\'s QR, which completes the sale. Then it follows the scrap to the hub.', [22, 28, 70, 56]],
  ['map', 'Maps', 'Real hubs. A 3D street.', 'Official recycling centres and e-waste points from OpenStreetMap, plus a 3D map where neighbours pin and clean up litter.', [26, 30, 68, 62]],
  ['coins', 'EcoCoins', 'Small acts, counted.', 'Coins for listing, selling, pickups and clean-ups. Spend them on saplings, metro top-ups and notebooks.', [17, 28, 40, 26]],
  ['chat', 'EcoBot', 'Ask in Hindi or English.', 'What goes in which bin, what newspaper sells for, where old batteries go. EcoBot answers instantly.', [38, 28, 72, 26]],
];
export function openTour(onFinish) {
  let i = 0;
  sheet({
    title: '', wide: true, cls: 'tour', small: true,
    body: '<div id="tour"></div>',
    onMount(el, close) {
      const head = $('.sheet-head h2', el);
      const draw = () => {
        const [k, eb, title, text, box] = TOUR[i];
        head.textContent = `Take a look around · ${i + 1} of ${TOUR.length}`;
        $('#tour', el).innerHTML = `<div class="tour-body"><div class="mock-wrap">${mockup(k)}${scribbleEllipse('', box)}</div>
          <div><span class="eyebrow plain">${esc(eb)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="tour-dots">${TOUR.map((_, k2) => `<i class="${k2 === i ? 'on' : ''}"></i>`).join('')}</div></div></div>
          <div class="tour-foot" style="margin-top:20px"><button class="link faint" data-skip style="font-weight:500;color:var(--muted)">Skip tour</button>
          <div class="row"><button class="link" data-back ${i === 0 ? 'disabled style="opacity:.3"' : ''}>${icon('arrowL')} Back</button><button class="btn btn-primary btn-sm" data-next>${i === TOUR.length - 1 ? 'Get started' : 'Next'} ${icon('arrowR')}</button></div></div>`;
        $('[data-skip]', el).onclick = close;
        $('[data-back]', el).onclick = () => { if (i > 0) { i--; draw(); } };
        $('[data-next]', el).onclick = () => { if (i < TOUR.length - 1) { i++; draw(); } else { close(); onFinish?.(); } };
      };
      head.classList.add('small'); draw();
      el.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' && i < TOUR.length - 1) { i++; draw(); } if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); } });
    },
  });
}
