/* ZapPlay hero 3D — Three.js r160 module
   Central dodecahedron (wire) + icosa (solid iridescent) + starfield
   Reacts to mouse + scroll.
*/
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function initHero(canvasEl) {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  // ----- Lights -----
  const amb = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(amb);
  const key = new THREE.PointLight(0x5EEAD4, 2.4, 30);
  key.position.set(4, 3, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0xA78BFA, 2.0, 30);
  rim.position.set(-5, -2, 4);
  scene.add(rim);
  const pink = new THREE.PointLight(0xFF4D6D, 1.4, 25);
  pink.position.set(0, 4, -4);
  scene.add(pink);

  // ----- Floating GAME OBJECTS -----
  const gameObjects = [];

  function makeDie(size, color) {
    const geo = new THREE.BoxGeometry(size, size, size, 2, 2, 2);
    const mat = new THREE.MeshPhysicalMaterial({
      color, metalness: 0.3, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: 0.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const pipGeo = new THREE.SphereGeometry(size * 0.09, 12, 12);
    const pipMat = new THREE.MeshBasicMaterial({ color: 0x0b0b17 });
    const offs = size / 2 + 0.001;
    const p = size * 0.28;
    // +Z face: 1 pip
    const f1 = new THREE.Mesh(pipGeo, pipMat); f1.position.set(0, 0, offs); mesh.add(f1);
    // -Z face: 6 pips
    [[-p, p], [-p, 0], [-p, -p], [p, p], [p, 0], [p, -p]].forEach(([x, y]) => {
      const m = new THREE.Mesh(pipGeo, pipMat); m.position.set(x, y, -offs); mesh.add(m);
    });
    // +X face: 3 pips diagonal
    [[-p, -p], [0, 0], [p, p]].forEach(([y, z]) => {
      const m = new THREE.Mesh(pipGeo, pipMat); m.position.set(offs, y, z); mesh.add(m);
    });
    // -X face: 4 pips corners
    [[-p, -p], [-p, p], [p, -p], [p, p]].forEach(([y, z]) => {
      const m = new THREE.Mesh(pipGeo, pipMat); m.position.set(-offs, y, z); mesh.add(m);
    });
    // +Y face: 2 pips
    [[-p, -p], [p, p]].forEach(([x, z]) => {
      const m = new THREE.Mesh(pipGeo, pipMat); m.position.set(x, offs, z); mesh.add(m);
    });
    // -Y face: 5 pips
    [[-p, -p], [-p, p], [0, 0], [p, -p], [p, p]].forEach(([x, z]) => {
      const m = new THREE.Mesh(pipGeo, pipMat); m.position.set(x, -offs, z); mesh.add(m);
    });
    return mesh;
  }

  function makeCard(color) {
    const shape = new THREE.Shape();
    const w = 1.0, h = 1.5, r = 0.12;
    shape.moveTo(-w/2 + r, -h/2);
    shape.lineTo(w/2 - r, -h/2);
    shape.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
    shape.lineTo(w/2, h/2 - r);
    shape.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
    shape.lineTo(-w/2 + r, h/2);
    shape.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
    shape.lineTo(-w/2, -h/2 + r);
    shape.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    geo.center();
    const mat = new THREE.MeshPhysicalMaterial({
      color, metalness: 0.5, roughness: 0.3, clearcoat: 1, iridescence: 0.7,
    });
    return new THREE.Mesh(geo, mat);
  }

  function makePawn(color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color, metalness: 0.6, roughness: 0.2, clearcoat: 1, iridescence: 0.5,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.14, 24), mat); base.position.y = -0.55;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.7, 24), mat); stem.position.y = -0.13;
    const neck = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 12, 24), mat); neck.position.y = 0.27; neck.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), mat); head.position.y = 0.55;
    group.add(base, stem, neck, head);
    return group;
  }

  function makeRing(color) {
    const geo = new THREE.TorusGeometry(0.65, 0.16, 24, 64);
    const mat = new THREE.MeshPhysicalMaterial({
      color, metalness: 0.9, roughness: 0.15, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.4,
    });
    return new THREE.Mesh(geo, mat);
  }

  const spawns = [
    { obj: makeDie(1.2, 0x5EEAD4),  pos: [0, 0.1, 0],      scale: 1.0, floatAmp: 0.14, rotSpeed: [0.22, 0.28, 0.1] },
    { obj: makeDie(0.65, 0xFF4D6D), pos: [2.3, 1.4, -0.4],  scale: 1.0, floatAmp: 0.26, rotSpeed: [0.3, -0.2, 0.15] },
    { obj: makeCard(0xA78BFA),      pos: [-2.5, 0.9, 0.5],  scale: 1.1, floatAmp: 0.22, rotSpeed: [0.05, 0.35, 0.0] },
    { obj: makeCard(0xF5D547),      pos: [2.5, -1.5, 0.8],  scale: 0.9, floatAmp: 0.22, rotSpeed: [0.08, -0.4, 0.05] },
    { obj: makePawn(0x5EEAD4),      pos: [-2.2, -1.5, -0.4], scale: 0.95, floatAmp: 0.16, rotSpeed: [0, 0.25, 0] },
    { obj: makeRing(0xFF4D6D),      pos: [0, 2.2, -1],      scale: 1.0, floatAmp: 0.12, rotSpeed: [0.4, 0.1, 0.2] },
    { obj: makeRing(0xA78BFA),      pos: [0.4, -2.3, -0.5], scale: 0.85, floatAmp: 0.14, rotSpeed: [-0.3, 0.2, -0.15] },
    { obj: makeDie(0.5, 0xF5D547),  pos: [-3.3, -0.3, -1],  scale: 1.0, floatAmp: 0.3, rotSpeed: [0.5, 0.4, 0.3] },
  ];

  spawns.forEach((s, i) => {
    s.obj.position.set(...s.pos);
    s.obj.scale.setScalar(s.scale);
    s.obj.userData = {
      basePos: s.pos.slice(),
      rotSpeed: s.rotSpeed,
      floatAmp: s.floatAmp,
      floatPhase: i * 0.8,
    };
    scene.add(s.obj);
    gameObjects.push(s.obj);
  });

  // Wireframe shell
  const wireGeo = new THREE.IcosahedronGeometry(2.4, 2);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x5EEAD4,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
  });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  scene.add(wire);

  // Outer dodecahedron faint
  const outerGeo = new THREE.DodecahedronGeometry(3.4, 0);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xA78BFA,
    wireframe: true,
    transparent: true,
    opacity: 0.08,
  });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  scene.add(outer);

  // ----- Particles forming a sphere -----
  const PCOUNT = 1400;
  const pGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(PCOUNT * 3);
  const sizes = new Float32Array(PCOUNT);
  const colors = new Float32Array(PCOUNT * 3);
  const palette = [
    new THREE.Color(0x5EEAD4),
    new THREE.Color(0xA78BFA),
    new THREE.Color(0xFF4D6D),
    new THREE.Color(0xF5D547),
    new THREE.Color(0xffffff),
  ];
  for (let i = 0; i < PCOUNT; i++) {
    const r = 3.5 + Math.random() * 2.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = Math.random() * 0.04 + 0.01;
    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pMat = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // Starfield — very far, tiny
  const sCount = 800;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(sCount * 3);
  for (let i = 0; i < sCount; i++) {
    sPos[i*3]     = (Math.random() - .5) * 60;
    sPos[i*3 + 1] = (Math.random() - .5) * 40;
    sPos[i*3 + 2] = -Math.random() * 30 - 10;
  }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sMat = new THREE.PointsMaterial({
    size: 0.03,
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
  });
  scene.add(new THREE.Points(sGeo, sMat));

  // ----- Mouse + scroll state -----
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollY = 0;

  window.addEventListener('mousemove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -(e.clientY / window.innerHeight) * 2 + 1;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
  }, { passive: true });

  // ----- Resize -----
  function resize() {
    const rect = canvasEl.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  window.addEventListener('resize', resize);

  // ----- Animation loop -----
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();

    // smooth mouse
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;

    const scrollProg = Math.min(scrollY / 800, 1);

    gameObjects.forEach((o) => {
      const d = o.userData;
      o.rotation.x += d.rotSpeed[0] * 0.01;
      o.rotation.y += d.rotSpeed[1] * 0.01;
      o.rotation.z += d.rotSpeed[2] * 0.01;
      o.position.y = d.basePos[1] + Math.sin(t * 0.9 + d.floatPhase) * d.floatAmp;
      o.position.x = d.basePos[0] + Math.cos(t * 0.7 + d.floatPhase) * d.floatAmp * 0.5;
      o.position.z = d.basePos[2] - scrollProg * 1.2;
    });

    wire.rotation.x = -t * 0.08;
    wire.rotation.y = -t * 0.1 - mouse.x * 0.3;

    outer.rotation.x = t * 0.05;
    outer.rotation.y = -t * 0.06;

    points.rotation.y = t * 0.04;
    points.rotation.x = mouse.y * 0.2;

    camera.position.x += (mouse.x * 1.4 - camera.position.x) * 0.04;
    camera.position.y += (mouse.y * 0.8 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
}

// ----- CTA section: simpler orb -----
export function initCTA(canvasEl) {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const l1 = new THREE.PointLight(0x5EEAD4, 2.5, 20); l1.position.set(3, 2, 3); scene.add(l1);
  const l2 = new THREE.PointLight(0xFF4D6D, 2.0, 20); l2.position.set(-3, -2, 3); scene.add(l2);

  const geo = new THREE.TorusKnotGeometry(1.2, 0.35, 200, 32);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0b17,
    metalness: 1,
    roughness: 0.2,
    iridescence: 1,
    iridescenceIOR: 1.5,
    clearcoat: 1,
  });
  const knot = new THREE.Mesh(geo, mat);
  scene.add(knot);

  function resize() {
    const r = canvasEl.parentElement.getBoundingClientRect();
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    renderer.setSize(r.width, r.height, false);
  }
  resize();
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  (function loop() {
    const t = clock.getElapsedTime();
    knot.rotation.x = t * 0.2;
    knot.rotation.y = t * 0.3;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })();
}
