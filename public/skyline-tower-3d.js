/**
 * Skyline — tour WebGL (Three.js), gratte-ciel empilé + animation de chute.
 * Attend window.THREE (three.min.js chargé avant ce fichier).
 */
(function () {
  var scene, camera, renderer, towerRoot, bgCities, starsPoints, groundMesh, canvas, container;
  var floorMeshes = [];
  var rafId = 0;
  var collapseActive = false;
  var FLOOR_H = 0.42;
  var BASE_W = 1.15;
  var BASE_D = 0.95;
  var MAX_F = 18;

  var wallMat, winMat, roofMat;

  function makeMaterials() {
    wallMat = new THREE.MeshStandardMaterial({
      color: 0x3d4f66,
      metalness: 0.25,
      roughness: 0.72,
      flatShading: false
    });
    winMat = new THREE.MeshStandardMaterial({
      color: 0x0a1816,
      emissive: 0x00c4b0,
      emissiveIntensity: 0.55,
      metalness: 0.2,
      roughness: 0.45
    });
    roofMat = new THREE.MeshStandardMaterial({
      color: 0x5a6d82,
      metalness: 0.35,
      roughness: 0.55
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
    var mat = isTop ? roofMat : wallMat;
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = h / 2;
    addWindowsToFace(mesh, w, h, d, isTop);
    var g = new THREE.Group();
    g.add(mesh);
    g.position.y = index * h;
    return g;
  }

  function clearTower() {
    floorMeshes.forEach(function (g) {
      if (g.parent) g.parent.remove(g);
      g.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
      });
    });
    floorMeshes = [];
    if (towerRoot) {
      while (towerRoot.children.length) towerRoot.remove(towerRoot.children[0]);
    }
  }

  function setFloors(n) {
    if (!towerRoot || collapseActive) return;
    n = Math.max(0, Math.min(MAX_F, n | 0));
    clearTower();
    for (var i = 0; i < n; i++) {
      var g = buildFloorMesh(i, n, i === n - 1);
      towerRoot.add(g);
      floorMeshes.push(g);
    }
  }

  /** Vide la tour sans animation (nouvelle manche) */
  function setFloorsInstant(n) {
    if (!towerRoot) return;
    collapseActive = false;
    setFloors(n);
  }

  function bumpPop() {
    if (!towerRoot || collapseActive) return;
    var s = 1.08;
    towerRoot.scale.setScalar(s);
    requestAnimationFrame(function () {
      towerRoot.scale.setScalar(1);
    });
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
    if (towerRoot && !collapseActive && !prefersReducedMotion()) {
      towerRoot.rotation.y += 0.004;
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
    scene.background = null;
    scene.fog = new THREE.FogExp2(0x050510, 0.04);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(3.2, 2.1, 4.2);
    camera.lookAt(0, 1.2, 0);

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
    var bMat = new THREE.MeshStandardMaterial({
      color: 0x2a3548,
      metalness: 0.2,
      roughness: 0.85
    });
    var bWin = new THREE.MeshStandardMaterial({
      color: 0x061210,
      emissive: 0x008877,
      emissiveIntensity: 0.4,
      roughness: 0.5
    });
    for (var bi = 0; bi < 28; bi++) {
      var ang = (bi / 28) * Math.PI * 2 + bi * 0.17;
      var rad = 5.5 + (bi % 5) * 0.35;
      var bw = 0.35 + (bi % 7) * 0.08;
      var bh = 0.8 + (bi * 73 % 17) / 7;
      var bd = 0.32 + (bi % 4) * 0.06;
      var box = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bMat);
      box.castShadow = true;
      box.receiveShadow = true;
      box.position.set(Math.cos(ang) * rad, bh / 2, Math.sin(ang) * rad);
      box.rotation.y = ang + 0.4;
      bgCities.add(box);
      var wmesh = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.35, bh * 0.2), bWin);
      wmesh.position.set(0, 0, bd / 2 + 0.01);
      box.add(wmesh);
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
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({
        color: 0x080a12,
        metalness: 0.1,
        roughness: 0.95
      })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.02;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

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
      bgCities.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material && !Array.isArray(o.material)) o.material.dispose();
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
    setFloorsInstant: setFloorsInstant,
    bumpPop: bumpPop,
    playCollapse: playCollapse,
    dispose: dispose,
    isReady: function () {
      return !!towerRoot;
    }
  };
})();
