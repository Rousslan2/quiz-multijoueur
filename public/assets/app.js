/* FoodPlug — shared UI behaviour */
(function () {
  'use strict';

  /* ---- reveal + count-up driven by rAF (robust where CSS transitions
         are frozen). Hidden/visible states are static CSS under .anim-on. ---- */
  const reduceMo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const armed = document.documentElement.classList.contains('anim-on') && !reduceMo;
  const DELAY = { 'rv-d1': 80, 'rv-d2': 160, 'rv-d3': 240, 'rv-d4': 320, 'rv-d5': 400 };
  const revealEls = [...document.querySelectorAll('.rv')];
  const countEls = [...document.querySelectorAll('[data-count]')];

  function delayOf(el){ for (const k in DELAY) if (el.classList.contains(k)) return DELAY[k]; return 0; }

  function reveal(el) {
    if (el.dataset.shown) return; el.dataset.shown = '1';
    if (!armed) { el.classList.add('in'); return; }
    const d = delayOf(el), dur = 820, t0 = performance.now() + d;
    el.style.opacity = '0'; el.style.transform = 'translateY(26px)';
    (function step(now) {
      let t = (now - t0) / dur;
      if (t < 0) { requestAnimationFrame(step); return; }
      if (t > 1) t = 1;
      const e = 1 - Math.pow(1 - t, 3);
      el.style.opacity = e.toFixed(3);
      el.style.transform = 'translateY(' + (26 * (1 - e)).toFixed(2) + 'px)';
      if (t < 1) requestAnimationFrame(step);
      else { el.classList.add('in'); el.style.opacity = ''; el.style.transform = ''; }
    })(performance.now());
  }

  function runCount(el) {
    if (el.dataset.done) return; el.dataset.done = '1';
    const to = parseFloat(el.dataset.count), dec = (el.dataset.dec | 0);
    const suf = el.dataset.suffix || '', pre = el.dataset.prefix || '';
    const fmt = v => pre + (dec ? v.toFixed(dec).replace('.', ',') : Math.round(v).toLocaleString('fr-FR')) + suf;
    if (!armed) { el.textContent = fmt(to); return; }
    const dur = 1400, start = performance.now();
    (function step(now) {
      const t = Math.min((now - start) / dur, 1);
      el.textContent = fmt(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  function check() {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    for (let i = revealEls.length - 1; i >= 0; i--) {
      if (revealEls[i].getBoundingClientRect().top < vh * 0.92) { reveal(revealEls[i]); revealEls.splice(i, 1); }
    }
    for (let i = countEls.length - 1; i >= 0; i--) {
      if (countEls[i].getBoundingClientRect().top < vh * 0.85) { runCount(countEls[i]); countEls.splice(i, 1); }
    }
  }
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check, { passive: true });
  check();
  requestAnimationFrame(check);
  setTimeout(check, 300);
  // ultimate fallback: never leave content hidden / counters at zero
  setTimeout(() => {
    document.querySelectorAll('.rv').forEach(el => { el.classList.add('in'); el.style.opacity = ''; el.style.transform = ''; });
    document.querySelectorAll('[data-count]').forEach(el => {
      const to = parseFloat(el.dataset.count), dec = (el.dataset.dec | 0);
      el.textContent = (el.dataset.prefix || '') + (dec ? to.toFixed(dec).replace('.', ',') : Math.round(to).toLocaleString('fr-FR')) + (el.dataset.suffix || '');
      el.dataset.done = '1';
    });
  }, 2800);
  /* ---- nav: scrolled + hide on scroll-down ---- */
  const nav = document.querySelector('.nav');
  let lastY = 0;
  function onScroll() {
    const y = window.scrollY;
    if (nav) {
      nav.classList.toggle('scrolled', y > 24);
      if (y > 560 && y > lastY + 4) nav.classList.add('hide');
      else if (y < lastY - 4 || y < 560) nav.classList.remove('hide');
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- mobile menu ---- */
  const burger = document.querySelector('.burger');
  const mmenu = document.querySelector('.mmenu');
  if (burger && mmenu) {
    burger.addEventListener('click', () => {
      const open = mmenu.classList.toggle('open');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mmenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      mmenu.classList.remove('open'); document.body.style.overflow = '';
    }));
  }

  /* ---- hero food parallax (mouse) ---- */
  const floaters = document.querySelectorAll('[data-parallax]');
  if (floaters.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let mx = 0, my = 0, cx = 0, cy = 0;
    window.addEventListener('pointermove', e => {
      mx = (e.clientX / window.innerWidth - .5);
      my = (e.clientY / window.innerHeight - .5);
    }, { passive: true });
    (function loop() {
      cx += (mx - cx) * .06; cy += (my - cy) * .06;
      floaters.forEach(el => {
        const d = parseFloat(el.dataset.parallax) || 1;
        el.style.transform = `translate3d(${cx * 26 * d}px, ${cy * 20 * d}px, 0) rotateX(${-cy * 6 * d}deg) rotateY(${cx * 8 * d}deg)`;
      });
      requestAnimationFrame(loop);
    })();
  }

  /* ---- tilt cards ---- */
  function bindTilt(card) {
    if (card.dataset.tb) return; card.dataset.tb = '1';
    let raf;
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.transform = `perspective(900px) rotateY(${px * 9}deg) rotateX(${-py * 9}deg) translateZ(6px)`;
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      card.style.transform = 'perspective(900px) rotateY(0) rotateX(0)';
    });
  }
  document.querySelectorAll('[data-tilt]').forEach(bindTilt);

  /* ---- public hook: re-arm reveal/count/tilt for dynamically added nodes ---- */
  function scan() {
    document.querySelectorAll('.rv:not([data-shown])').forEach(el => { if (!revealEls.includes(el)) revealEls.push(el); });
    document.querySelectorAll('[data-count]:not([data-done])').forEach(el => { if (!countEls.includes(el)) countEls.push(el); });
    document.querySelectorAll('[data-tilt]').forEach(bindTilt);
    check();
  }
  window.__fp = { scan, check };

  /* ---- scroll-driven hero zoom ---- */
  const zoom = document.querySelector('[data-herozoom]');
  if (zoom) {
    window.addEventListener('scroll', () => {
      const y = Math.min(window.scrollY, 700);
      zoom.style.setProperty('--hz', 1 + y * 0.00018);
      zoom.style.setProperty('--hy', y * 0.05 + 'px');
    }, { passive: true });
  }
})();
