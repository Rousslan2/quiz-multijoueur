/* ZapPlay — UI interactions
   Cursor, reveal on scroll, accordion, magnetic buttons, games hover glow, stat counters
*/

// ---------- Cursor ----------
(function cursor() {
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;
  let mx = -100, my = -100, rx = -100, ry = -100;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  }, { passive: true });

  function loop() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  loop();

  document.querySelectorAll('a, button, .game, .how__step, [data-cursor]').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('is-hover'));
    el.addEventListener('mouseleave', () => ring.classList.remove('is-hover'));
  });
})();

// ---------- Reveal on scroll ----------
(function reveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

// ---------- How-it-works accordion ----------
(function accordion() {
  const steps = document.querySelectorAll('.how__step');
  steps.forEach((s, i) => {
    if (i === 0) s.classList.add('is-open');
    s.addEventListener('click', () => {
      const wasOpen = s.classList.contains('is-open');
      steps.forEach(x => x.classList.remove('is-open'));
      if (!wasOpen) s.classList.add('is-open');
    });
  });
})();

// ---------- Games hover glow (mouse-follow) ----------
(function gameGlow() {
  document.querySelectorAll('.game').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
})();

// ---------- Games filter ----------
(function gamesFilter() {
  const btns = document.querySelectorAll('.games-filter__btn');
  const cards = document.querySelectorAll('.game');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const f = btn.dataset.filter;
      cards.forEach(c => {
        const show = f === 'all' || c.dataset.cat === f;
        c.classList.toggle('is-hidden', !show);
      });
    });
  });
})();

// ---------- Code box (room join) ----------
(function codebox() {
  const inputs = document.querySelectorAll('#codebox input');
  if (!inputs.length) return;
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (inp.value) {
        inp.classList.add('has-val');
        const next = inputs[i + 1];
        if (next) next.focus();
      } else {
        inp.classList.remove('has-val');
      }
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
    });
    inp.addEventListener('paste', (e) => {
      e.preventDefault();
      const txt = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      inputs.forEach((x, idx) => {
        x.value = txt[idx] || '';
        x.classList.toggle('has-val', !!x.value);
      });
      const last = Math.min(txt.length, inputs.length - 1);
      inputs[last].focus();
    });
  });
})();

// ---------- Magnetic CTA buttons ----------
(function magnetic() {
  document.querySelectorAll('[data-magnetic]').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.15}px, ${y * 0.25}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
})();

// ---------- Text scramble on display elements ----------
(function scramble() {
  const chars = '!<>-_\\/[]{}—=+*^?#________';
  class Scrambler {
    constructor(el) {
      this.el = el;
      this.original = el.textContent;
      this.queue = [];
      this.frame = 0;
      this.frameReq = null;
    }
    trigger() {
      const oldText = this.el.textContent;
      const newText = this.original;
      const length = Math.max(oldText.length, newText.length);
      this.queue = [];
      for (let i = 0; i < length; i++) {
        const from = oldText[i] || '';
        const to = newText[i] || '';
        const start = Math.floor(Math.random() * 20);
        const end = start + Math.floor(Math.random() * 20);
        this.queue.push({ from, to, start, end, char: '' });
      }
      cancelAnimationFrame(this.frameReq);
      this.frame = 0;
      this.update();
    }
    update() {
      let output = '';
      let complete = 0;
      for (let i = 0; i < this.queue.length; i++) {
        const q = this.queue[i];
        if (this.frame >= q.end) {
          complete++;
          output += q.to;
        } else if (this.frame >= q.start) {
          if (!q.char || Math.random() < 0.28) {
            q.char = chars[Math.floor(Math.random() * chars.length)];
          }
          output += `<span style="color:var(--teal)">${q.char}</span>`;
        } else {
          output += q.from;
        }
      }
      this.el.innerHTML = output;
      if (complete !== this.queue.length) {
        this.frameReq = requestAnimationFrame(() => this.update());
        this.frame++;
      }
    }
  }
  document.querySelectorAll('[data-scramble]').forEach(el => {
    const s = new Scrambler(el);
    el.addEventListener('mouseenter', () => s.trigger());
  });
})();

// ---------- Parallax for showcase cards ----------
(function parallax() {
  const cards = document.querySelectorAll('[data-parallax]');
  function update() {
    const vh = window.innerHeight;
    cards.forEach(card => {
      const r = card.getBoundingClientRect();
      const progress = (r.top - vh) / -vh;
      const offset = Number(card.dataset.parallax) || 20;
      card.style.transform = `translateY(${progress * -offset}px)`;
    });
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
})();

// ---------- Nav scroll state ----------
(function navScroll() {
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) nav.style.borderBottom = '1px solid var(--line)';
    else nav.style.borderBottom = '';
  }, { passive: true });
})();
