/* ZapPlay — Loader universel (auto + WS)
 * Usage:
 *  - Auto: inclure ce script avant </body>, rien d’autre.
 *  - WS: dans ws.onopen => window.ZPLoader?.hide()
 */

(function () {
  const Z_INDEX = 2147483646;
  /** Aligné sur shared.js (MIN_LOADER_MS) — évite un flash trop court */
  const MIN_MS = 1500;
  const SAFETY_MS = 12000;

  let shownAt = 0;
  let hideScheduled = false;
  let safetyTimer = null;

  /** Plein viewport (overlay toujours au-dessus, même si CSS arrive en retard) */
  function lockFullscreen(el) {
    if (!el) return;
    if (el.parentNode !== document.documentElement) {
      try { document.documentElement.appendChild(el); } catch (_) {}
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
    try { el.style.minHeight = '100vh'; } catch (_) {}
    try { el.style.minHeight = '100dvh'; } catch (_) {}
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

  function ensureCss() {
    // Si la page a déjà un <link>, rien à faire
    if (document.querySelector('link[href*="zp-loader.css"]')) return;
    // Sinon on l’ajoute pour être vraiment “universel”
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = '/zp-loader.css';
    document.head.appendChild(l);
  }

  function mk(tag, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  function inject() {
    let el = document.getElementById('zp-loader');
    if (el) {
      ensureCss();
      lockFullscreen(el);
      applyScrollLock();
      return el;
    }

    ensureCss();

    // Essaie de coller au markup déjà utilisé dans shared.js / zp-loader.css
    el = mk('div');
    el.id = 'zp-loader';

    ['a', 'b'].forEach(c => el.appendChild(mk('div', 'zl-nebula ' + c)));
    ['tl', 'tr', 'bl', 'br'].forEach(c => el.appendChild(mk('div', 'zl-corner ' + c)));

    ['r1', 'r2', 'r3'].forEach(c => {
      const r = mk('div', 'zl-ring ' + c);
      r.style.cssText = 'position:absolute;top:50%;left:50%';
      const sz = { r1: 105, r2: 135, r3: 165 }[c] || 105;
      r.style.marginTop = r.style.marginLeft = '-' + sz + 'px';
      el.appendChild(r);
    });

    const pBox = mk('div');
    pBox.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden';
    const pCols = ['#00E8D4', '#FF4D6D', '#5B9FFF', '#A78BFA', '#F5D547', '#FF7033'];
    for (let i = 0; i < 22; i++) {
      const p = mk('div', 'zl-p');
      const sz = (0.5 + Math.random() * 2.5).toFixed(1);
      const dx = (Math.random() * 40 - 20).toFixed(0) + 'px';
      p.style.cssText =
        'left:' + Math.round(Math.random() * 100) + '%;' +
        'width:' + sz + 'px;height:' + sz + 'px;' +
        'background:' + pCols[i % pCols.length] + ';' +
        'animation-duration:' + (4 + Math.random() * 7).toFixed(1) + 's;' +
        'animation-delay:' + (Math.random() * 5).toFixed(1) + 's;' +
        '--dx:' + dx + ';opacity:0';
      pBox.appendChild(p);
    }
    el.appendChild(pBox);

    const center = mk('div', 'zl-center');
    const logo = mk('div', 'zl-logo'); logo.textContent = 'ZapPlay';
    const tag = mk('div', 'zl-tag'); tag.textContent = 'Arcade Multijoueur';
    const div = mk('div', 'zl-div'); div.appendChild(mk('div', 'zl-div-dot'));
    const barWrap = mk('div', 'zl-bar-wrap');
    const bar = mk('div', 'zl-bar'); barWrap.appendChild(bar);
    const status = mk('div', 'zl-status');
    const sub = mk('div', 'zl-sub'); sub.textContent = 'Chargement';
    [1, 2, 3].forEach(() => status.appendChild(mk('div', 'zl-dot')));
    status.insertBefore(sub, status.firstChild);
    [logo, tag, div, barWrap, status].forEach(n => center.appendChild(n));
    el.appendChild(center);

    // messages cycliques (optionnel)
    const msgs = ['Initialisation', 'Chargement', 'Connexion', 'Préparation'];
    let mi = 0;
    const cycleId = setInterval(() => { mi = (mi + 1) % msgs.length; sub.textContent = msgs[mi]; }, 900);
    el._cycleId = cycleId;

    document.documentElement.appendChild(el);
    lockFullscreen(el);
    applyScrollLock();
    return el;
  }

  function show() {
    // Si shared.js est déjà présent, on réutilise son API.
    if (window.ZapPlay && typeof window.ZapPlay.showLoader === 'function') {
      try { window.ZapPlay.showLoader(); } catch (_) {}
      shownAt = Date.now();
      hideScheduled = false;
      requestAnimationFrame(() => lockFullscreen(document.getElementById('zp-loader')));
      return;
    }
    const el = inject();
    shownAt = Date.now();
    hideScheduled = false;
    if (el) el.classList.remove('hide');
    lockFullscreen(el);
    if (safetyTimer) clearTimeout(safetyTimer);
    safetyTimer = setTimeout(() => {
      safetyTimer = null;
      if (document.getElementById('zp-loader') && !hideScheduled) hide();
    }, SAFETY_MS);
  }

  function hide() {
    if (window.ZapPlay && typeof window.ZapPlay.hideLoader === 'function') {
      try { window.ZapPlay.hideLoader(); } catch (_) {}
      return;
    }
    const el = document.getElementById('zp-loader');
    if (!el) return;
    if (hideScheduled) return;
    hideScheduled = true;
    if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
    if (el._cycleId) clearInterval(el._cycleId);
    const elapsed = Date.now() - shownAt;
    const remaining = Math.max(0, MIN_MS - elapsed);
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => {
        try { el.remove(); } catch (_) {}
        releaseScrollLock();
      }, 650);
    }, remaining);
  }

  window.ZPLoader = window.ZPLoader || {};
  window.ZPLoader.show = show;
  window.ZPLoader.hide = hide;

  // Mode auto
  // Si l’accueil a déjà un loader legacy (#loader), on n’affiche pas un deuxième overlay.
  if (!document.getElementById('loader')) {
    show();
    window.addEventListener(
      'load',
      () => {
        requestAnimationFrame(() => hide());
      },
      { once: true }
    );
  }
})();

