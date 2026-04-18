/* ─────────────────────────────────────────────
   ZapPlay — fx.js  (Premium FX shared library)
   - 3D hero scene (vanilla WebGL-free, pure CSS3D + canvas2D with depth)
   - Confetti burst
   - Button ripple
   - Scroll reveal
   - Count-up numbers
   - Parallax tilt
   - Page entry transition
   ───────────────────────────────────────────── */
(function(){
'use strict';

const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ═══════════════════════════════════════════════
//  CONFETTI BURST (canvas 2D, self-cleaning)
// ═══════════════════════════════════════════════
function confetti(opts){
  if(prefersReduced) return;
  opts = opts || {};
  const count = opts.count || 140;
  const colors = opts.colors || ['#00E8D4','#FF4D6D','#5B9FFF','#A78BFA','#F5D547','#FF7033','#34D399'];
  const duration = opts.duration || 3500;
  const originY = opts.originY != null ? opts.originY : 0.35;
  const spread = opts.spread || 1.0;

  const cvs = document.createElement('canvas');
  cvs.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99998;';
  document.body.appendChild(cvs);
  const ctx = cvs.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  const resize = () => {
    cvs.width = innerWidth*dpr; cvs.height = innerHeight*dpr;
    cvs.style.width = innerWidth+'px'; cvs.style.height = innerHeight+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  };
  resize();

  const parts = [];
  for(let i=0;i<count;i++){
    const angle = (Math.random()-0.5)*Math.PI*spread - Math.PI/2;
    const speed = 6 + Math.random()*10;
    parts.push({
      x: innerWidth*0.5 + (Math.random()-0.5)*innerWidth*0.3,
      y: innerHeight*originY,
      vx: Math.cos(angle)*speed*(0.6+Math.random()*0.8),
      vy: Math.sin(angle)*speed*(0.9+Math.random()*0.4),
      g: 0.25+Math.random()*0.15,
      rot: Math.random()*Math.PI*2,
      vr: (Math.random()-0.5)*0.3,
      size: 5 + Math.random()*8,
      color: colors[Math.floor(Math.random()*colors.length)],
      shape: Math.random()<0.5 ? 'rect' : 'circ',
      life: 1
    });
  }

  const start = performance.now();
  let rafId;
  function tick(now){
    const t = now - start;
    const alpha = Math.max(0, 1 - t/duration);
    ctx.clearRect(0,0,innerWidth,innerHeight);
    parts.forEach(p=>{
      p.vy += p.g;
      p.vx *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life = alpha;
      ctx.save();
      ctx.globalAlpha = Math.min(1,p.life*1.2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if(p.shape==='rect') ctx.fillRect(-p.size/2, -p.size/3, p.size, p.size*0.6);
      else { ctx.beginPath(); ctx.arc(0,0,p.size*0.45,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    });
    if(t < duration) rafId = requestAnimationFrame(tick);
    else cvs.remove();
  }
  rafId = requestAnimationFrame(tick);
  addEventListener('resize', resize, {once:false});
}

// ═══════════════════════════════════════════════
//  RIPPLE ON BUTTONS
// ═══════════════════════════════════════════════
function bindRipple(root){
  root = root || document;
  const selector = '.btn, .btn-cta, .btn-p, .btn-s, .zp-start-btn, .zp-choice-btn, .zp-vote-btn, .zp-back-btn, button.fx-ripple';
  root.addEventListener('pointerdown', (e)=>{
    const el = e.target.closest(selector);
    if(!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const size = Math.max(r.width, r.height)*1.8;
    const span = document.createElement('span');
    span.className = 'zp-ripple';
    span.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`;
    const prevPos = getComputedStyle(el).position;
    if(prevPos==='static') el.style.position='relative';
    el.appendChild(span);
    setTimeout(()=>span.remove(), 650);
  }, {passive:true});
}

// ═══════════════════════════════════════════════
//  SCROLL REVEAL via IntersectionObserver
// ═══════════════════════════════════════════════
function bindReveal(root){
  if(prefersReduced || !('IntersectionObserver' in window)) return;
  root = root || document;
  const els = root.querySelectorAll('[data-reveal]:not(.fx-revealed)');
  if(!els.length) return;
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{
      if(en.isIntersecting){
        en.target.classList.add('fx-revealed');
        io.unobserve(en.target);
      }
    });
  }, {threshold: 0.12, rootMargin: '0px 0px -8% 0px'});
  els.forEach(el=>io.observe(el));
}

// ═══════════════════════════════════════════════
//  COUNT-UP on [data-countup="N"]
// ═══════════════════════════════════════════════
function countUp(el, target, dur){
  if(prefersReduced){ el.textContent = target; return; }
  dur = dur || 1200;
  const start = performance.now();
  const from = 0;
  const step = (now)=>{
    const t = Math.min(1, (now-start)/dur);
    const eased = 1 - Math.pow(1-t, 3);
    el.textContent = Math.round(from + (target-from)*eased);
    if(t<1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function bindCountUp(root){
  root = root || document;
  root.querySelectorAll('[data-countup]:not(.fx-counted)').forEach(el=>{
    const target = parseFloat(el.dataset.countup);
    if(!isFinite(target)) return;
    el.classList.add('fx-counted');
    countUp(el, target, parseFloat(el.dataset.countupDur)||1200);
  });
}

// ═══════════════════════════════════════════════
//  3D TILT on [data-tilt]
// ═══════════════════════════════════════════════
function bindTilt(root){
  if(prefersReduced) return;
  root = root || document;
  const clamp = (v,mn,mx)=>Math.max(mn,Math.min(mx,v));
  const supportsHover = matchMedia && matchMedia('(hover:hover)').matches;
  root.querySelectorAll('[data-tilt]:not(.fx-tilt)').forEach(c=>{
    c.classList.add('fx-tilt');
    let raf=0, lastX=0, lastY=0;
    const maxR = parseFloat(c.dataset.tiltMax) || 10;
    const apply = () => {
      raf=0;
      const r=c.getBoundingClientRect();
      const px=(lastX - r.left)/Math.max(1,r.width);
      const py=(lastY - r.top)/Math.max(1,r.height);
      const rx = clamp((0.5-py)*maxR, -maxR, maxR);
      const ry = clamp((px-0.5)*maxR*1.1, -maxR*1.1, maxR*1.1);
      c.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    };
    const move = (x,y)=>{ lastX=x; lastY=y; if(!raf) raf=requestAnimationFrame(apply); };
    const reset = ()=>{ if(raf){cancelAnimationFrame(raf); raf=0;} c.style.transform=''; };
    if(supportsHover){
      c.addEventListener('mousemove', e=>move(e.clientX,e.clientY));
      c.addEventListener('mouseleave', reset);
    }
    c.addEventListener('touchstart', e=>{
      const t=e.touches&&e.touches[0]; if(!t) return;
      move(t.clientX,t.clientY); setTimeout(reset,500);
    }, {passive:true});
  });
}

// ═══════════════════════════════════════════════
//  HERO 3D SCENE — pure canvas2D w/ depth projection
//  (léger, pas de dépendance three.js)
// ═══════════════════════════════════════════════
function mountHero3D(container){
  if(!container) return;
  if(prefersReduced){ return; }

  const cvs = document.createElement('canvas');
  cvs.className = 'fx-hero-canvas';
  cvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  container.appendChild(cvs);
  const ctx = cvs.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio||1, 2);

  let W=0,H=0,cx=0,cy=0,focal=520;
  function resize(){
    const r = container.getBoundingClientRect();
    W = r.width; H = r.height;
    cvs.width = W*dpr; cvs.height = H*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    cx = W/2; cy = H/2;
    focal = Math.max(320, Math.min(W,H)*1.2);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // Build a swarm of 3D shapes
  const rand = (a,b)=>a+Math.random()*(b-a);
  const COLORS = [
    {r:0,g:245,b:212},   // teal
    {r:255,g:56,b:100},  // pink
    {r:59,g:130,b:246},  // blue
    {r:168,g:85,b:247},  // purple
    {r:255,g:226,b:52},  // gold
  ];
  const SHAPES = [];
  const N = 36;
  for(let i=0;i<N;i++){
    const c = COLORS[Math.floor(Math.random()*COLORS.length)];
    SHAPES.push({
      x: rand(-260,260),
      y: rand(-160,160),
      z: rand(-280,380),
      size: rand(10,26),
      type: Math.random()<0.35?'cube':(Math.random()<0.55?'ring':'dot'),
      color: c,
      spin: rand(-0.015,0.015),
      rot: rand(0,Math.PI*2),
      vx: rand(-0.18,0.18),
      vy: rand(-0.14,0.14),
      vz: rand(-0.22,0.22),
    });
  }

  let mouseX=0, mouseY=0, targetMX=0, targetMY=0;
  container.addEventListener('mousemove', (e)=>{
    const r = container.getBoundingClientRect();
    targetMX = ((e.clientX - r.left)/r.width - 0.5)*2;
    targetMY = ((e.clientY - r.top)/r.height - 0.5)*2;
  });
  container.addEventListener('mouseleave', ()=>{ targetMX=0; targetMY=0; });

  function project(x,y,z){
    const sx = cx + (x*focal)/(focal+z);
    const sy = cy + (y*focal)/(focal+z);
    const s = focal/(focal+z);
    return {x:sx, y:sy, s};
  }

  function drawCube(p, size, color, rot, alpha){
    const half = size*p.s*0.6;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    // soft glow background
    const grad = ctx.createRadialGradient(0,0,0, 0,0, half*2.2);
    grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${0.35*alpha})`);
    grad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(-half*2.2,-half*2.2, half*4.4, half*4.4);
    // face
    ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${0.20*alpha})`;
    ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${0.85*alpha})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.rect(-half,-half, half*2, half*2);
    ctx.fill(); ctx.stroke();
    // inner detail
    ctx.beginPath();
    ctx.moveTo(-half,-half); ctx.lineTo(half,half);
    ctx.moveTo(half,-half); ctx.lineTo(-half,half);
    ctx.globalAlpha = 0.25*alpha;
    ctx.stroke();
    ctx.restore();
  }
  function drawRing(p, size, color, rot, alpha){
    const r = size*p.s;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    // ring (ellipse for 3D feel)
    ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${0.9*alpha})`;
    ctx.lineWidth = Math.max(1, 2*p.s);
    ctx.beginPath();
    ctx.ellipse(0,0, r, r*0.45, 0, 0, Math.PI*2);
    ctx.stroke();
    // glow
    const grad = ctx.createRadialGradient(0,0,r*0.2, 0,0,r*1.3);
    grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${0.15*alpha})`);
    grad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0,0, r*1.4, r*0.9, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function drawDot(p, size, color, alpha){
    const r = size*p.s*0.4;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(0,0,0, 0,0, r*3);
    grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${0.95*alpha})`);
    grad.addColorStop(0.4, `rgba(${color.r},${color.g},${color.b},${0.35*alpha})`);
    grad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0,0, r*3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.9*alpha})`;
    ctx.beginPath(); ctx.arc(0,0, r*0.55, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  let t0 = performance.now();
  let running = true;
  function tick(now){
    if(!running) return;
    const dt = Math.min(50, now - t0); t0 = now;
    mouseX += (targetMX - mouseX)*0.06;
    mouseY += (targetMY - mouseY)*0.06;

    ctx.clearRect(0,0,W,H);

    // soft vignette gradient
    const bg = ctx.createRadialGradient(cx + mouseX*40, cy + mouseY*30, 40, cx, cy, Math.max(W,H)*0.7);
    bg.addColorStop(0, 'rgba(0,232,212,0.09)');
    bg.addColorStop(0.55, 'rgba(91,159,255,0.04)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,W,H);

    // update + sort by z
    SHAPES.forEach(sh=>{
      sh.x += sh.vx + mouseX*0.12;
      sh.y += sh.vy + mouseY*0.08;
      sh.z += sh.vz;
      sh.rot += sh.spin;
      if(sh.x>300) sh.x=-300; if(sh.x<-300) sh.x=300;
      if(sh.y>200) sh.y=-200; if(sh.y<-200) sh.y=200;
      if(sh.z>420) sh.z=-300; if(sh.z<-320) sh.z=420;
    });
    SHAPES.sort((a,b)=>b.z - a.z);
    SHAPES.forEach(sh=>{
      const p = project(sh.x, sh.y, sh.z);
      if(p.s<=0) return;
      const alpha = Math.max(0, Math.min(1, (1 - sh.z/420)*0.9));
      if(sh.type==='cube') drawCube(p, sh.size, sh.color, sh.rot, alpha);
      else if(sh.type==='ring') drawRing(p, sh.size, sh.color, sh.rot, alpha);
      else drawDot(p, sh.size, sh.color, alpha);
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Pause when offscreen
  const vio = new IntersectionObserver(entries=>{
    entries.forEach(en=>{
      if(en.isIntersecting && !running){ running=true; t0=performance.now(); requestAnimationFrame(tick); }
      else if(!en.isIntersecting) running=false;
    });
  }, {threshold: 0.01});
  vio.observe(container);

  return { destroy(){ ro.disconnect(); vio.disconnect(); cvs.remove(); running=false; } };
}

// ═══════════════════════════════════════════════
//  PAGE ENTRY TRANSITION
// ═══════════════════════════════════════════════
function pageEntry(){
  if(prefersReduced) return;
  document.documentElement.classList.add('fx-page-in');
  requestAnimationFrame(()=>{
    setTimeout(()=>document.documentElement.classList.add('fx-page-in-done'), 30);
  });
}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
function init(){
  pageEntry();
  bindRipple();
  bindReveal();
  bindCountUp();
  bindTilt();
  const heroEl = document.querySelector('[data-hero-3d]');
  if(heroEl) mountHero3D(heroEl);
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

// observe DOM for new [data-reveal] / [data-countup] / [data-tilt] (for SPA-ish games)
const mo = new MutationObserver(()=>{
  bindReveal(); bindCountUp(); bindTilt();
});
mo.observe(document.documentElement, {childList:true, subtree:true});

window.ZapFX = { confetti, countUp, mountHero3D, bindRipple, bindReveal, bindCountUp, bindTilt };
})();
