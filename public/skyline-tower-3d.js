/**
 * Skyline — tour WebGL (Three.js), gratte-ciel empilé + animation de chute.
 * Attend window.THREE (three.min.js chargé avant ce fichier).
 */
(function () {
  var scene, camera, renderer, towerRoot, pedestalMesh, bgCities, starsPoints, groundMesh, horizonMesh, canvas, container;
  var floorMeshes = [];
  var rafId = 0;
  var collapseActive = false;
  var stackAnimActive = false;
  var FLOOR_H = 0.58;
  var BASE_W = 1.22;
  var BASE_D = 1.02;
  var PEDESTAL_H = 0.22;
  var MAX_F = 18;

  var wallMat, wallMatB, winMat, roofMat;

  function makeMaterials() {
    wallMat = new THREE.MeshStandardMaterial({
      color: 0x4a6a8a,
      metalness: 0.35,
      roughness: 0.55,
      flatShading: false
    });
    wallMatB = new THREE.MeshStandardMaterial({
      color: 0x3d5a72,
      metalness: 0.28,
      roughness: 0.62
    });
    winMat = new THREE.MeshStandardMaterial({
      color: 0x0a1816,
      emissive: 0x00e8d4,
      emissiveIntensity: 0.62,
      metalness: 0.25,
      roughness: 0.4
    });
    roofMat = new THREE.MeshStandardMaterial({
      color: 0x7a8ca8,
      metalness: 0.45,
      roughness: 0.42
    });
  }

  function addWindowsToFace(mesh, w, h, d, isRoof) {
    var rows = isRoof ? 1 : 2;
    var cols = 3;
    var padX = 0.12;
    var padY = isRoof ? 0.05 : 0.08;
    var cellW = (w - padX * 2) / cols;
    var cellH = (h - padY * 2) / rows;
    var wwin = cellW * 0.55;
    var hwin = cellH * 0.45;
    var geo = new THREE.PlaneGeometry(wwin, hwin);
    var zOff = d / 2 + 0.008;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var m = new THREE.Mesh(geo, winMat);
        m.position.set(
          -w / 2 + padX + cellW * (c + 0.5),
          -h / 2 + padY + cellH * (r + 0.5),
          zOff
        );
        mesh.add(m);
      }
    }
  }

  function buildFloorMesh(index, total, isTop) {
    var w = BASE_W;
    var h = FLOOR_H;
    var d = BASE_D;
    var geo = new THREE.BoxGeometry(w, h, d);
    var mat = isTop ? roofMat : index % 2 === 0 ? wallMat : wallMatB;
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = h / 2;
    addWindowsToFace(mesh, w, h, d, isTop);
    var g = new THREE.Group();
    g.add(mesh);
    g.position.y = PEDESTAL_H + index * h;
    return g;
  }

  function clearFloorsOnly() {
    floorMeshes.forEach(function (g) {
      if (g.parent) g.parent.remove(g);
      g.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
      });
    });
    floorMeshes = [];
  }

  function clearTower() {
    clearFloorsOnly();
    if (towerRoot && pedestalMesh) {
      towerRoot.remove(pedestalMesh);
      if (pedestalMesh.geometry) pedestalMesh.geometry.dispose();
      if (pedestalMesh.material) pedestalMesh.material.dispose();
      pedestalMesh = null;
    }
  }

  function ensurePedestal() {
    if (!towerRoot || pedestalMesh) return;
    pedestalMesh = new THREE.Mesh(
      new THREE.BoxGeometry(BASE_W * 1.35, PEDESTAL_H, BASE_D * 1.25),
      new THREE.MeshStandardMaterial({
        color: 0x2a3038,
        metalness: 0.15,
        roughness: 0.88
      })
    );
    pedestalMesh.castShadow = true;
    pedestalMesh.receiveShadow = true;
    pedestalMesh.position.y = PEDESTAL_H / 2;
    towerRoot.add(pedestalMesh);
  }

  function updateCameraForStack(n) {
    if (!camera) return;
    var stackH = PEDESTAL_H + Math.max(0, n) * FLOOR_H;
    var lookY = stackH * 0.42 + 0.15;
    var camY = Math.min(6.5, 1.1 + stackH * 0.52);
    var camZ = Math.min(10, 4.8 + stackH * 0.38);
    camera.position.set(0.35, camY, camZ);
    camera.lookAt(0, lookY, 0);
  }

  function setFloors(n) {
    if (!towerRoot || collapseActive || stackAnimActive) return;
    n = Math.max(0, Math.min(MAX_F, n | 0));
    clearFloorsOnly();
    ensurePedestal();
    for (var i = 0; i < n; i++) {
      var g = buildFloorMesh(i, n, i === n - 1);
      towerRoot.add(g);
      floorMeshes.push(g);
    }
    updateCameraForStack(n);
  }

  /** Vide la tour sans animation (nouvelle manche) */
  function setFloorsInstant(n) {
    if (!towerRoot) return;
    collapseActive = false;
    stackAnimActive = false;
    setFloors(n);
  }

  function bumpPop() {
    if (!towerRoot || collapseActive || stackAnimActive) return;
    var s = 1.06;
    towerRoot.scale.setScalar(s);
    requestAnimationFrame(function () {
      towerRoot.scale.setScalar(1);
    });
  }

  /** Réaffiche toute la pile puis anime la chute du dernier bloc (empilement visible). */
  function setFloorsFromBottom(prevN, newN, done) {
    if (!towerRoot || collapseActive) {
      if (typeof done === 'function') done();
      return;
    }
    prevN = Math.max(0, Math.min(MAX_F, prevN | 0));
    newN = Math.max(0, Math.min(MAX_F, newN | 0));
    stackAnimActive = true;
    clearFloorsOnly();
    ensurePedestal();
    for (var i = 0; i < newN; i++) {
      var g = buildFloorMesh(i, newN, i === newN - 1);
      towerRoot.add(g);
      floorMeshes.push(g);
    }
    updateCameraForStack(newN);
    if (newN <= prevN || newN < 1) {
      stackAnimActive = false;
      if (typeof done === 'function') done();
      return;
    }
    var top = floorMeshes[floorMeshes.length - 1];
    var startY = top.position.y + 2.4;
    top.position.y = startY;
    var t0 = performance.now();
    var dropDur = 420;
    var targetY = PEDESTAL_H + (newN - 1) * FLOOR_H;
    function dropStep(now) {
      var u = Math.min(1, (now - t0) / dropDur);
      var e = 1 - Math.pow(1 - u, 3);
      top.position.y = startY + (targetY - startY) * e;
      if (u < 1) {
        requestAnimationFrame(dropStep);
      } else {
        top.position.y = targetY;
        stackAnimActive = false;
        bumpPop();
        if (typeof done === 'function') done();
      }
    }
    requestAnimationFrame(dropStep);
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
      return false;
    }
  }

  function tick() {
    if (!renderer || !scene || !camera) return;
    if (towerRoot && !collapseActive && !stackAnimActive && !prefersReducedMotion()) {
      towerRoot.rotation.y += 0.0022;
    }
    if (bgCities && !prefersReducedMotion()) {
      bgCities.rotation.y += 0.0006;
    }
    if (starsPoints && !prefersReducedMotion()) {
      starsPoints.rotation.y += 0.00015;
    }
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  function onResize() {
    if (!container || !camera || !renderer) return;
    var w = container.clientWidth || 300;
    var h = container.clientHeight || 180;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  function initWebGL(containerEl) {
    if (typeof THREE === 'undefined') return false;
    container = containerEl;
    canvas = container.querySelector('canvas');
    if (!canvas) return false;

    makeMaterials();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060814);
    scene.fog = new THREE.Fog(0x0a0e1c, 12, 42);

    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0.4, 2.2, 5.4);
    camera.lookAt(0, 0.9, 0);

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    if (renderer.outputColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.SRGBColorSpace === undefined && renderer.outputEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    towerRoot = new THREE.Group();
    towerRoot.position.y = 0;
    scene.add(towerRoot);

    bgCities = new THREE.Group();
    scene.add(bgCities);

    var matGlass = new THREE.MeshStandardMaterial({
      color: 0x1a2838,
      metalness: 0.55,
      roughness: 0.18,
      envMapIntensity: 0.8
    });
    var matConcrete = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      metalness: 0.08,
      roughness: 0.92
    });
    var matBrick = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      metalness: 0.05,
      roughness: 0.88
    });
    var matDark = new THREE.MeshStandardMaterial({
      color: 0x1e2433,
      metalness: 0.15,
      roughness: 0.78
    });
    var winTeal = new THREE.MeshStandardMaterial({
      color: 0x020808,
      emissive: 0x00c9b8,
      emissiveIntensity: 0.5,
      roughness: 0.35
    });
    var winGold = new THREE.MeshStandardMaterial({
      color: 0x1a1205,
      emissive: 0xffb84d,
      emissiveIntensity: 0.35,
      roughness: 0.4
    });

    function addWinStrip(parent, w, h, zFace, mat) {
      var rows = Math.max(2, Math.floor(h * 4));
      var cols = 3;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var gw = w * 0.12;
          var gh = h * 0.08;
          var g = new THREE.PlaneGeometry(gw, gh);
          var m = new THREE.Mesh(g, Math.random() > 0.15 ? mat : winGold);
          m.position.set(
            (c - 1) * w * 0.22,
            (r / rows - 0.5) * h * 0.85 + h * 0.05,
            zFace
          );
          parent.add(m);
        }
      }
    }

    function buildingSlim(x, z, h, rot, winM) {
      var w = 0.38;
      var d = 0.34;
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matGlass);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(x, h / 2, z);
      mesh.rotation.y = rot;
      addWinStrip(mesh, w, h, d / 2 + 0.01, winM);
      bgCities.add(mesh);
      if (h > 1.6) {
        var ant = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.03, 0.35, 6),
          new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.6, roughness: 0.35 })
        );
        ant.position.set(0, h / 2 + 0.2, 0);
        mesh.add(ant);
      }
    }

    function buildingPodiumTower(x, z, rot) {
      var pw = 0.95;
      var pd = 0.75;
      var ph = 0.35;
      var base = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), matConcrete);
      base.castShadow = true;
      base.receiveShadow = true;
      base.position.set(x, ph / 2, z);
      base.rotation.y = rot;
      bgCities.add(base);
      var tw = 0.42;
      var th = 1.45;
      var td = 0.38;
      var top = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td), matGlass);
      top.castShadow = true;
      top.position.set(0, ph + th / 2, 0);
      base.add(top);
      addWinStrip(top, tw, th, td / 2 + 0.01, winTeal);
    }

    function buildingStepped(x, z, rot) {
      var g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      var y = 0;
      var w = 0.85;
      var d = 0.72;
      for (var s = 0; s < 4; s++) {
        var sh = 0.32 + s * 0.06;
        var mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, sh, d),
          s % 2 === 0 ? matBrick : matDark
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.y = y + sh / 2;
        y += sh;
        w *= 0.82;
        d *= 0.82;
        g.add(mesh);
        addWinStrip(mesh, w * 1.15, sh, d / 2 + 0.02, winTeal);
      }
      bgCities.add(g);
    }

    function buildingCylinder(x, z, h, rot) {
      var r = 0.28 + (h % 1) * 0.08;
      var mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 1.08, h, 14),
        matGlass
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(x, h / 2, z);
      mesh.rotation.y = rot;
      bgCities.add(mesh);
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(r * 1.02, 0.025, 6, 24),
        new THREE.MeshStandardMaterial({ color: 0x00e8d4, emissive: 0x004d44, emissiveIntensity: 0.3 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = h * 0.35;
      mesh.add(ring);
    }

    function buildingLShape(x, z, rot) {
      var g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      var a = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 0.4), matConcrete);
      a.castShadow = true;
      a.position.set(-0.15, 0.55, 0);
      g.add(a);
      addWinStrip(a, 0.55, 1.1, 0.21, winTeal);
      var b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.75, 0.45), matDark);
      b.castShadow = true;
      b.position.set(0.2, 0.375, 0.15);
      g.add(b);
      addWinStrip(b, 0.4, 0.75, 0.23, winGold);
      bgCities.add(g);
    }

    var placements = [
      { fn: 'slim', x: -5.2, z: 2.1, h: 1.9, r: 0.4 },
      { fn: 'podium', x: -3.8, z: 4.2, r: -0.25 },
      { fn: 'step', x: -2.1, z: 5.5, r: 0.55 },
      { fn: 'cyl', x: -0.5, z: 6.1, h: 1.65, r: 0.2 },
      { fn: 'slim', x: 1.2, z: 5.8, h: 2.2, r: -0.35 },
      { fn: 'L', x: 3.4, z: 4.9, r: 0.9 },
      { fn: 'podium', x: 5.1, z: 3.2, r: -0.6 },
      { fn: 'step', x: 6.0, z: 1.0, r: 1.2 },
      { fn: 'cyl', x: 5.5, z: -1.2, h: 1.4, r: 2.0 },
      { fn: 'slim', x: 4.2, z: -3.5, h: 1.7, r: 2.3 },
      { fn: 'L', x: 2.0, z: -4.8, r: -0.9 },
      { fn: 'podium', x: -0.5, z: -5.5, r: -0.2 },
      { fn: 'step', x: -2.8, z: -4.9, r: 0.15 },
      { fn: 'cyl', x: -4.5, z: -3.2, h: 1.55, r: 0.5 },
      { fn: 'slim', x: -5.8, z: -0.8, h: 2.0, r: 0.0 },
      { fn: 'L', x: -4.0, z: 1.5, r: 0.7 },
      { fn: 'slim', x: 6.2, z: -3.8, h: 1.5, r: -2.5 },
      { fn: 'step', x: -6.0, z: 3.0, r: -0.4 }
    ];
    for (var pi = 0; pi < placements.length; pi++) {
      var p = placements[pi];
      if (p.fn === 'slim') buildingSlim(p.x, p.z, p.h, p.r, winTeal);
      else if (p.fn === 'podium') buildingPodiumTower(p.x, p.z, p.r);
      else if (p.fn === 'step') buildingStepped(p.x, p.z, p.r);
      else if (p.fn === 'cyl') buildingCylinder(p.x, p.z, p.h, p.r);
      else if (p.fn === 'L') buildingLShape(p.x, p.z, p.r);
    }
    var starGeo = new THREE.BufferGeometry();
    var starCount = 420;
    var pos = new Float32Array(starCount * 3);
    for (var si = 0; si < starCount; si++) {
      pos[si * 3] = (Math.random() - 0.5) * 70;
      pos[si * 3 + 1] = 4 + Math.random() * 22;
      pos[si * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starsPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xaaccff, size: 0.045, transparent: true, opacity: 0.65 })
    );
    scene.add(starsPoints);

    var amb = new THREE.AmbientLight(0x6a7a90, 0.45);
    scene.add(amb);
    var dir = new THREE.DirectionalLight(0xffffff, 1.05);
    dir.position.set(4, 10, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);
    var rim = new THREE.DirectionalLight(0x00e8d4, 0.35);
    rim.position.set(-3, 4, -4);
    scene.add(rim);

    groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({
        color: 0x0a0c18,
        metalness: 0.05,
        roughness: 0.98
      })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.02;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    horizonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(48, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      new THREE.MeshBasicMaterial({
        color: 0x0d1528,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.95
      })
    );
    horizonMesh.position.y = 6;
    scene.add(horizonMesh);

    onResize();
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver && container) {
      var ro = new ResizeObserver(onResize);
      ro.observe(container);
      container._skyRo = ro;
    }

    rafId = requestAnimationFrame(tick);
    return true;
  }

  function playCollapse(done) {
    if (!towerRoot || collapseActive) {
      if (typeof done === 'function') done();
      return;
    }
    stackAnimActive = false;
    collapseActive = true;
    var start = performance.now();
    var dur = 650;
    var ry = towerRoot.rotation.y;
    var startX = towerRoot.rotation.x;
    var startZ = towerRoot.rotation.z;
    function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - t, 2);
      towerRoot.rotation.x = startX + e * (Math.PI * 0.52);
      towerRoot.rotation.z = startZ + e * 0.35;
      towerRoot.rotation.y = ry + e * 0.2;
      towerRoot.position.y = -e * 1.8;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        collapseActive = false;
        clearTower();
        towerRoot.position.y = 0;
        towerRoot.rotation.set(0, 0, 0);
        if (typeof done === 'function') done();
      }
    }
    requestAnimationFrame(step);
  }

  function dispose() {
    window.removeEventListener('resize', onResize);
    if (container && container._skyRo) {
      container._skyRo.disconnect();
      container._skyRo = null;
    }
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    clearTower();
    if (bgCities && scene) {
      scene.remove(bgCities);
      var matDone = {};
      bgCities.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material && !Array.isArray(o.material)) {
          var u = o.material.uuid;
          if (!matDone[u]) {
            matDone[u] = true;
            o.material.dispose();
          }
        }
      });
      bgCities = null;
    }
    if (starsPoints && scene) {
      scene.remove(starsPoints);
      if (starsPoints.geometry) starsPoints.geometry.dispose();
      if (starsPoints.material) starsPoints.material.dispose();
      starsPoints = null;
    }
    if (groundMesh && scene) {
      scene.remove(groundMesh);
      if (groundMesh.geometry) groundMesh.geometry.dispose();
      if (groundMesh.material) groundMesh.material.dispose();
      groundMesh = null;
    }
    if (horizonMesh && scene) {
      scene.remove(horizonMesh);
      if (horizonMesh.geometry) horizonMesh.geometry.dispose();
      if (horizonMesh.material) horizonMesh.material.dispose();
      horizonMesh = null;
    }
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    scene = null;
    camera = null;
    towerRoot = null;
  }

  window.SkylineTower3D = {
    init: function (containerId) {
      var el = document.getElementById(containerId);
      if (!el) return false;
      if (typeof THREE === 'undefined') return false;
      dispose();
      return initWebGL(el);
    },
    setFloors: setFloors,
    setFloorsFromBottom: setFloorsFromBottom,
    setFloorsInstant: setFloorsInstant,
    bumpPop: bumpPop,
    playCollapse: playCollapse,
    dispose: dispose,
    isReady: function () {
      return !!towerRoot;
    }
  };
})();
