/* ZapPlay — Loader universel (style menu principal)
 * Injecte le même écran de chargement que index.html (#loader) sur toutes les pages.
 * Usage :
 *  - Auto : inclure ce script avant </body>, rien d'autre.
 *  - WS   : dans ws.onopen => window.ZPLoader.hide()  (ou ZapPlay.hideLoader())
 */

(function () {
  if (window.__ZP_MAIN_LOADER__) return;
  window.__ZP_MAIN_LOADER__ = true;

  const Z_INDEX = 2147483646;
  const LOADER_ID = 'loader';
  const STYLE_ID = 'zp-main-loader-style';
  const FONT_ID = 'zp-main-loader-font';
  /** Aligné sur shared.js / accueil : visible au moins 1,5 s */
  const MIN_MS = 1500;
  const SAFETY_MS = 9000;

  let shownAt = 0;
  let hideScheduled = false;
  let safetyTimer = null;
  let progressRAF = null;
  let progress = 0;
  let target = 0;
  let stepIdx = 0;

  /** Plein viewport — au-dessus du reste, même avant que tout le CSS soit prêt */
  function lockMainLoaderFullscreen(el) {
    if (!el) return;
    if (el.parentNode !== document.documentElement) {
      try {
        document.documentElement.appendChild(el);
      } catch (_) {}
    }
    el.style.setProperty('z-index', String(Z_INDEX), 'important');
    el.style.setProperty('position', 'fixed', 'important');
    el.style.setProperty('top', '0', 'important');
    el.style.setProperty('right', '0', 'important');
    el.style.setProperty('bottom', '0', 'important');
    el.style.setProperty('left', '0', 'important');
    el.style.setProperty('width', '100%', 'important');
    el.style.setProperty('max-width', '100%', 'important');
    el.style.setProperty('box-sizing', 'border-box', 'important');
    try {
      el.style.minHeight = '100vh';
    } catch (_) {}
    try {
      el.style.minHeight = '100dvh';
    } catch (_) {}
  }

  function applyScrollLock() {
    try {
      document.documentElement.classList.add('zp-page-loading');
      document.body.style.setProperty('overflow', 'hidden', 'important');
    } catch (_) {}
  }

  function releaseScrollLock() {
    try {
      document.documentElement.classList.remove('zp-page-loading');
      document.body.style.removeProperty('overflow');
    } catch (_) {}
  }

  const CSS = `
#loader.zp-ml {
  --zp-bg: #07070e;
  --zp-teal: #5EEAD4;
  --zp-violet: #A78BFA;
  --zp-pink: #FF4D6D;
  --zp-ink-dim: #a9a8c4;
  --zp-ink-mute: #6c6a89;
  --zp-ease: cubic-bezier(.22,1,.36,1);
  position: fixed; inset: 0; z-index: 2147483646;
  display: flex; align-items: center; justify-content: center;
  background: var(--zp-bg); overflow: hidden;
  transition: opacity .8s var(--zp-ease), visibility 0s .8s;
  font-family: 'Inter', system-ui, sans-serif;
}
#loader.zp-ml.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; }
#loader.zp-ml .zp-ml-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(600px 400px at 30% 40%, rgba(94,234,212,.12), transparent 60%),
    radial-gradient(500px 400px at 70% 60%, rgba(167,139,250,.10), transparent 60%),
    radial-gradient(400px 300px at 50% 90%, rgba(255,77,109,.08), transparent 60%);
  animation: zpMlPulse 6s ease-in-out infinite;
}
#loader.zp-ml .zp-ml-bg::before,
#loader.zp-ml .zp-ml-bg::after {
  content: ""; position: absolute; inset: 0;
  background-image:
    linear-gradient(to right, rgba(255,255,255,.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size: 80px 80px;
  -webkit-mask: radial-gradient(600px 600px at 50% 50%, #000, transparent 70%);
          mask: radial-gradient(600px 600px at 50% 50%, #000, transparent 70%);
}
@keyframes zpMlPulse { 0%,100%{opacity:.8} 50%{opacity:1} }
#loader.zp-ml .zp-ml-content {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center;
  gap: 28px; padding: 0 24px;
}
#loader.zp-ml .zp-ml-mark { position: relative; animation: zpMlFloat 3s ease-in-out infinite; }
#loader.zp-ml .zp-ml-mark svg { display: block; }
#loader.zp-ml .zp-ml-ring-1 { animation: zpMlSpin 2.4s linear infinite; transform-origin: 60px 60px; }
#loader.zp-ml .zp-ml-ring-3 { animation: zpMlSpin 4s linear infinite reverse; transform-origin: 60px 60px; }
#loader.zp-ml .zp-ml-bolt {
  filter: drop-shadow(0 0 12px rgba(94,234,212,.6));
  animation: zpMlBolt 1.4s ease-in-out infinite;
  transform-origin: 58px 60px;
}
@keyframes zpMlSpin { to { transform: rotate(360deg); } }
@keyframes zpMlFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes zpMlBolt { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.85;transform:scale(1.08)} }
#loader.zp-ml .zp-ml-brand {
  font-family: 'Instrument Serif', 'Times New Roman', serif;
  font-size: 48px; letter-spacing: -.02em;
  display: flex; align-items: baseline; gap: 2px;
  color: #f4f3ff;
  animation: zpMlFadeIn 1s var(--zp-ease) both;
}
#loader.zp-ml .zp-ml-dot { color: var(--zp-teal); }
#loader.zp-ml .zp-ml-tagline {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px; letter-spacing: .28em; color: var(--zp-ink-mute);
  display: flex; gap: 2px; align-items: center;
}
#loader.zp-ml .zp-ml-gap { width: 12px; }
#loader.zp-ml .zp-ml-char {
  display: inline-block;
  animation: zpMlChar 1.6s var(--zp-ease) both infinite;
}
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(1)  { animation-delay: 0s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(2)  { animation-delay: .05s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(3)  { animation-delay: .10s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(4)  { animation-delay: .15s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(6)  { animation-delay: .25s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(7)  { animation-delay: .30s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(8)  { animation-delay: .35s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(9)  { animation-delay: .40s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(11) { animation-delay: .50s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(12) { animation-delay: .55s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(13) { animation-delay: .60s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(14) { animation-delay: .65s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(15) { animation-delay: .70s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(16) { animation-delay: .75s; }
#loader.zp-ml .zp-ml-tagline .zp-ml-char:nth-child(17) { animation-delay: .80s; }
@keyframes zpMlChar {
  0%,40%,100% { opacity:.35; transform: translateY(0); }
  20% { opacity:1; transform: translateY(-2px); color: var(--zp-teal); }
}
#loader.zp-ml .zp-ml-bar {
  width: 260px; max-width: 60vw; height: 2px;
  background: rgba(255,255,255,.08); border-radius: 2px;
  overflow: hidden; position: relative;
}
#loader.zp-ml .zp-ml-bar-fill {
  position: absolute; inset: 0; width: 0%;
  background: linear-gradient(90deg, var(--zp-teal), var(--zp-violet), var(--zp-pink));
  transition: width .3s var(--zp-ease);
  box-shadow: 0 0 12px rgba(94,234,212,.5);
}
#loader.zp-ml .zp-ml-bar-fill::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent);
  animation: zpMlShimmer 1.4s linear infinite;
}
@keyframes zpMlShimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
#loader.zp-ml .zp-ml-meta {
  display: flex; align-items: center; gap: 18px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px; letter-spacing: .1em; color: var(--zp-ink-dim);
}
#loader.zp-ml .zp-ml-pct {
  color: var(--zp-teal); font-weight: 600;
  min-width: 42px; display: inline-block;
}
#loader.zp-ml .zp-ml-status { position: relative; padding-left: 14px; }
#loader.zp-ml .zp-ml-status::before {
  content: ""; position: absolute; left: 0; top: 50%;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--zp-teal); transform: translateY(-50%);
  animation: zpMlBlink 1s ease-in-out infinite;
  box-shadow: 0 0 8px var(--zp-teal);
}
@keyframes zpMlBlink { 0%,100%{opacity:1} 50%{opacity:.3} }
@keyframes zpMlFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  #loader.zp-ml *, #loader.zp-ml *::before, #loader.zp-ml *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  #loader.zp-ml .zp-ml-bar-fill { width: 92% !important; }
}
`;

  const HTML = `
<div class="zp-ml-bg"></div>
<div class="zp-ml-content">
  <div class="zp-ml-mark">
    <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
      <defs>
        <linearGradient id="zp-ml-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#5eead4"/>
          <stop offset="50%" stop-color="#a78bfa"/>
          <stop offset="100%" stop-color="#ff4d6d"/>
        </linearGradient>
      </defs>
      <circle class="zp-ml-ring-1" cx="60" cy="60" r="54" fill="none" stroke="url(#zp-ml-grad)" stroke-width="1.5" stroke-dasharray="340" stroke-dashoffset="0"/>
      <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
      <circle class="zp-ml-ring-3" cx="60" cy="60" r="30" fill="none" stroke="url(#zp-ml-grad)" stroke-width="1" stroke-dasharray="12 8"/>
      <path class="zp-ml-bolt" d="M58 32 L42 66 L56 66 L50 88 L74 52 L60 52 Z" fill="url(#zp-ml-grad)"/>
    </svg>
  </div>
  <div class="zp-ml-brand">
    <span>ZAPPLAY</span><span class="zp-ml-dot">.</span>
  </div>
  <div class="zp-ml-tagline" aria-label="Play with friends">
    <span class="zp-ml-char">P</span><span class="zp-ml-char">L</span><span class="zp-ml-char">A</span><span class="zp-ml-char">Y</span>
    <span class="zp-ml-gap"></span>
    <span class="zp-ml-char">W</span><span class="zp-ml-char">I</span><span class="zp-ml-char">T</span><span class="zp-ml-char">H</span>
    <span class="zp-ml-gap"></span>
    <span class="zp-ml-char">F</span><span class="zp-ml-char">R</span><span class="zp-ml-char">I</span><span class="zp-ml-char">E</span><span class="zp-ml-char">N</span><span class="zp-ml-char">D</span><span class="zp-ml-char">S</span>
  </div>
  <div class="zp-ml-bar"><div class="zp-ml-bar-fill" data-zp-fill></div></div>
  <div class="zp-ml-meta">
    <span class="zp-ml-pct" data-zp-pct>0%</span>
    <span class="zp-ml-status" data-zp-status>Connexion aux serveurs</span>
  </div>
</div>`;

  function ensureFonts() {
    if (document.getElementById(FONT_ID)) return;
    const pc1 = document.createElement('link');
    pc1.rel = 'preconnect';
    pc1.href = 'https://fonts.googleapis.com';
    const pc2 = document.createElement('link');
    pc2.rel = 'preconnect';
    pc2.href = 'https://fonts.gstatic.com';
    pc2.crossOrigin = 'anonymous';
    const link = document.createElement('link');
    link.id = FONT_ID;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.appendChild(pc1);
    document.head.appendChild(pc2);
    document.head.appendChild(link);
  }

  function ensureCss() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function removeOldZpLoader() {
    const old = document.getElementById('zp-loader');
    if (old && old.id !== LOADER_ID) old.remove();
  }

  function inject() {
    removeOldZpLoader();
    ensureCss();
    ensureFonts();
    let el = document.getElementById(LOADER_ID);
    if (el) {
      el.classList.add('zp-ml');
      el.classList.remove('is-hidden');
      lockMainLoaderFullscreen(el);
      applyScrollLock();
      return el;
    }
    el = document.createElement('div');
    el.id = LOADER_ID;
    el.className = 'zp-ml';
    el.innerHTML = HTML;
    document.documentElement.appendChild(el);
    lockMainLoaderFullscreen(el);
    applyScrollLock();
    return el;
  }

  const STEPS = [
    { t: 25, msg: 'Connexion aux serveurs' },
    { t: 55, msg: 'Chargement' },
    { t: 82, msg: 'Préparation' },
    { t: 96, msg: 'Presque prêt' },
  ];

  function startProgress(el) {
    const fill = el.querySelector('[data-zp-fill]');
    const pct = el.querySelector('[data-zp-pct]');
    const status = el.querySelector('[data-zp-status]');
    if (!fill || !pct) return;
    progress = 0;
    target = 15;
    stepIdx = 0;
    const stepTick = setInterval(() => {
      if (hideScheduled) {
        clearInterval(stepTick);
        return;
      }
      if (stepIdx < STEPS.length) {
        target = STEPS[stepIdx].t;
        if (status) status.textContent = STEPS[stepIdx].msg;
        stepIdx++;
      } else {
        clearInterval(stepTick);
      }
    }, 520);
    el._stepTick = stepTick;
    function animate() {
      if (hideScheduled) {
        progress += (100 - progress) * 0.25;
      } else {
        progress += (target - progress) * 0.12;
      }
      const v = Math.min(100, Math.round(progress));
      fill.style.width = v + '%';
      pct.textContent = v + '%';
      if (hideScheduled && v >= 99) {
        fill.style.width = '100%';
        pct.textContent = '100%';
        return;
      }
      progressRAF = requestAnimationFrame(animate);
    }
    progressRAF = requestAnimationFrame(animate);
  }

  function show() {
    const el = inject();
    shownAt = Date.now();
    hideScheduled = false;
    el.classList.remove('is-hidden');
    lockMainLoaderFullscreen(el);
    if (!progressRAF) startProgress(el);
    if (safetyTimer) clearTimeout(safetyTimer);
    safetyTimer = setTimeout(() => {
      safetyTimer = null;
      if (!hideScheduled) hide();
    }, SAFETY_MS);
  }

  function hide() {
    const el = document.getElementById(LOADER_ID);
    if (!el) return;
    if (hideScheduled) return;
    hideScheduled = true;
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
    if (el._stepTick) {
      clearInterval(el._stepTick);
      el._stepTick = null;
    }
    const elapsed = Date.now() - shownAt;
    const remaining = Math.max(0, MIN_MS - elapsed);
    setTimeout(() => {
      el.classList.add('is-hidden');
      setTimeout(() => {
        if (progressRAF) {
          cancelAnimationFrame(progressRAF);
          progressRAF = null;
        }
        try {
          el.remove();
        } catch (_) {}
        releaseScrollLock();
      }, 850);
    }, remaining);
  }

  window.ZPLoader = { show, hide };

  // Harmonise l'API héritée : les pages appellent ZapPlay.hideLoader() dans ws.onopen.
  function hookZapPlay() {
    if (!window.ZapPlay) return false;
    window.ZapPlay.showLoader = show;
    window.ZapPlay.hideLoader = hide;
    return true;
  }
  if (!hookZapPlay()) {
    setTimeout(hookZapPlay, 0);
    document.addEventListener('DOMContentLoaded', hookZapPlay, { once: true });
  }

  show();
  if (document.readyState === 'complete') {
    setTimeout(hide, MIN_MS);
  } else {
    window.addEventListener('load', () => hide(), { once: true });
  }
})();
