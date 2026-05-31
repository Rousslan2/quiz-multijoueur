/* FoodPlug — ambient WebGL depth layer (Three.js r128 UMD global THREE)
   Lightweight: drifting motes (steam/dust) + glowing turntable disc + parallax.
   Auto-throttles on mobile, pauses offscreen, respects reduced-motion. */
(function () {
  if (typeof THREE === 'undefined') return;
  const canvas = document.getElementById('bg3d');
  if (!canvas) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 820px)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  // ---- soft round sprite texture ----
  function sprite(c1, c2) {
    const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d');
    const rg = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    rg.addColorStop(0, c1); rg.addColorStop(.5, c2); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
    const t = new THREE.Texture(cv); t.needsUpdate = true; return t;
  }
  const moteTex = sprite('rgba(255,255,255,.9)', 'rgba(248,201,110,.35)');
  const glowTex = sprite('rgba(248,201,110,.5)', 'rgba(240,169,58,.12)');

  // ---- motes (steam / dust) ----
  const COUNT = reduce ? 40 : (mobile ? 90 : 240);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const spd = new Float32Array(COUNT);
  const RANGE = 11;
  for (let i = 0; i < COUNT; i++) {
    pos[i*3]   = (Math.random() - .5) * RANGE;
    pos[i*3+1] = (Math.random() - .5) * RANGE;
    pos[i*3+2] = (Math.random() - .5) * 6 - 1;
    spd[i] = .15 + Math.random() * .5;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({
    size: mobile ? .12 : .1, map: moteTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: .85, sizeAttenuation: true
  }));
  scene.add(motes);

  // ---- turntable discs (glow rings under the hero) ----
  const discs = new THREE.Group();
  function disc(r, op) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r * .62, r, 80),
      new THREE.MeshBasicMaterial({ map: glowTex, color: 0xf0a93a, transparent: true, opacity: op,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2.15;
    m.position.y = -1.6;
    return m;
  }
  const d1 = disc(3.2, .5), d2 = disc(4.8, .22);
  discs.add(d1, d2); scene.add(discs);

  // ---- volumetric glows ----
  function glow(x, y, s, op, col) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ map: glowTex, color: col, transparent: true, opacity: op,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, y, -3); return m;
  }
  const g1 = glow(-3, 2, 8, .5, 0xf0a93a);
  const g2 = glow(3.5, -2.5, 9, .3, 0xe4002b);
  scene.add(g1, g2);

  // ---- interaction state ----
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollY = 0;
  window.addEventListener('pointermove', e => {
    mouse.tx = (e.clientX / window.innerWidth - .5);
    mouse.ty = (e.clientY / window.innerHeight - .5);
  }, { passive: true });
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  let running = true;
  const io = new IntersectionObserver(es => { running = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (!running) { last = now; return; }
    const dt = Math.min((now - last) / 1000, .05); last = now;
    resize();

    // motes drift up + wrap
    const p = geo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      p[i*3+1] += spd[i] * dt * (reduce ? .2 : 1);
      p[i*3]   += Math.sin(now * .0003 + i) * dt * .08;
      if (p[i*3+1] > RANGE/2) p[i*3+1] = -RANGE/2;
    }
    geo.attributes.position.needsUpdate = true;

    discs.rotation.y += dt * .25;          // slow turntable
    d2.rotation.z += dt * .1;
    g1.material.opacity = .42 + Math.sin(now*.0007) * .1;

    // parallax + scroll
    mouse.x += (mouse.tx - mouse.x) * .04;
    mouse.y += (mouse.ty - mouse.y) * .04;
    camera.position.x = mouse.x * 1.1;
    camera.position.y = -mouse.y * .8 - scrollY * .0008;
    camera.lookAt(0, -scrollY * .0006, 0);

    renderer.render(scene, camera);
  }
  resize();
  requestAnimationFrame(tick);
})();
