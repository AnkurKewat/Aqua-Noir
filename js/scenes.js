window.__fail = e => { let d = document.getElementById('err'); if (!d) { d = document.createElement('pre'); d.id = 'err'; d.style.cssText = 'position:fixed;left:12px;top:12px;right:12px;z-index:9;color:#ff8a8a;font:12px monospace;white-space:pre-wrap;user-select:text'; document.body.appendChild(d); } d.textContent = 'Error: ' + ((e && e.message) || e); };
addEventListener('error', ev => window.__fail(ev.error || ev.message));
(function () {
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x1b1b1b);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 9);

  // Studio-style environment: dark room with a few hard white strips -> sharp mirror facets
  const ec = document.createElement('canvas'); ec.width = 1024; ec.height = 512;
  const g = ec.getContext('2d');
  g.fillStyle = '#050505'; g.fillRect(0, 0, 1024, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#141414'); grad.addColorStop(.5, '#050505'); grad.addColorStop(1, '#101010');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = '#fff';
  [[250,150,30,300],[600,100,40,260],[430,20,150,50],[900,200,20,250]]
    .forEach(r => g.fillRect(r[0], r[1], r[2], r[3]));
  const envTex = new THREE.CanvasTexture(ec);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(envTex).texture;

  // Teardrop profile -> low-poly lathe, vertices nudged so facets look cut like crystal
  const R = 1.15, H = 2.0, pts = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let y, r;
    if (t < 0.5) { const a = -Math.PI / 2 + (t / 0.5) * Math.PI * 0.62; y = Math.sin(a) * R; r = Math.cos(a) * R; }
    else { const k = (t - 0.5) / 0.5; const y0 = Math.sin(-Math.PI / 2 + Math.PI * 0.62) * R; y = y0 + k * (H - y0); r = Math.cos(-Math.PI / 2 + Math.PI * 0.62) * R * Math.pow(1 - k, 1.25); }
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  const geo = new THREE.LatheGeometry(pts, 18);
  const p = geo.attributes.position;
  const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = (hash(Math.round(y * 50), Math.round(Math.atan2(z, x) * 20), 1) - .5) * 0.07;
    const l = Math.hypot(x, z);
    if (l > 0.01) { p.setX(i, x + (x / l) * k); p.setZ(i, z + (z / l) * k); }
  }
  geo.computeVertexNormals();
  // Split into separate triangles and give each a random id so most facets can dissolve into the background
  const geoN = geo.toNonIndexed();
  const fc = geoN.attributes.position.count / 3, fid = new Float32Array(fc * 3);
  for (let f = 0; f < fc; f++) { const h = hash(f, 7, 3); fid[f * 3] = fid[f * 3 + 1] = fid[f * 3 + 2] = h; }
  geoN.setAttribute('faceId', new THREE.BufferAttribute(fid, 1));
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06, flatShading: true, envMapIntensity: 1.2 });
  const uniT = { value: 0 };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = uniT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float faceId; varying float vF;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvF = faceId;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vF; uniform float uT;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (fract(vF + uT * .06) > .86) discard;');
  };
  const drop = new THREE.Mesh(geoN, mat);
  drop.position.y = -0.42;
  const holder = new THREE.Group(); holder.add(drop); scene.add(holder);

  // Pointer state
  const dot = document.getElementById('dot');
  const m = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
  const prev = { x: m.x, y: m.y };
  addEventListener('pointermove', e => { m.x = e.clientX; m.y = e.clientY; m.nx = (e.clientX / innerWidth) * 2 - 1; m.ny = -((e.clientY / innerHeight) * 2 - 1); });

  // Spring-smoothed motion
  const s = { rx: 0, ry: 0, px: 0, py: 0, stretch: 0, spin: 0, vx: 0, vy: 0 };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w / h < 0.8 ? 12 : 9;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // ---- Stage 2: mirrored apple / moon puzzle scene ----
  const scene2 = new THREE.Scene(); scene2.background = new THREE.Color(0x0a0a0a); scene2.environment = scene.environment;
  const cam2 = new THREE.PerspectiveCamera(50, 1, 0.1, 60); cam2.position.z = 5;
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(3, 5, 6); scene2.add(key);
  const mk = draw => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; draw(c.getContext('2d')); return new THREE.CanvasTexture(c); };
  const moonTex = mk(q => { q.fillStyle = '#9a9a9a'; q.fillRect(0, 0, 512, 256); for (let i = 0; i < 260; i++) { const v = 60 + Math.random() * 120 | 0; q.fillStyle = `rgb(${v},${v},${v})`; q.beginPath(); q.arc(Math.random() * 512, Math.random() * 256, 3 + Math.random() * 16, 0, 7); q.fill(); q.strokeStyle = 'rgba(255,255,255,.3)'; q.stroke(); } });
  const ribTex = mk(q => { q.fillStyle = '#111'; q.fillRect(0, 0, 512, 256); q.fillStyle = '#ddd'; for (let x = 0; x < 512; x += 8) q.fillRect(x, 0, 4, 256); });
  const appleMat = new THREE.MeshStandardMaterial({ color: 0x080808, metalness: .85, roughness: .16 });
  const moonMat = new THREE.MeshStandardMaterial({ map: moonTex, roughness: .85, metalness: 0 });
  const ribMat = new THREE.MeshStandardMaterial({ map: ribTex, roughness: .35, metalness: .5 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: .4, metalness: .3 });
  const prof = [];
  for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI; const r = Math.sin(a) * (0.95 - 0.22 * Math.cos(a)); let y = -Math.cos(a) * 0.85; if (a > Math.PI * 0.88) y -= 0.32 * (1 - (Math.PI - a) / (Math.PI * 0.12)); prof.push(new THREE.Vector2(Math.max(r, 0.001), y)); }
  const appleGeo = new THREE.LatheGeometry(prof, 40);
  const sphereGeo = new THREE.SphereGeometry(1, 40, 28);
  const coneGeo = new THREE.CylinderGeometry(0.5, 0.1, 2.4, 28);
  const world = new THREE.Group(); scene2.add(world);
  const items = [];
  const put = (mesh, x, y, z, s) => { mesh.position.set(x, y, z); mesh.scale.setScalar(s); mesh.userData.sp = (Math.random() - .5) * .7; world.add(mesh); items.push(mesh); };
  const apple = () => { const m = new THREE.Mesh(appleGeo, appleMat); const lf = new THREE.Mesh(sphereGeo, leafMat); lf.scale.set(.4, .02, .14); lf.position.set(.3, .72, 0); lf.rotation.z = .5; m.add(lf); return m; };
  // Tunnel: every 4 units a ring of moons, 4 apples, and a ribbed wall. Looped by wrapping z.
  scene2.fog = new THREE.Fog(0x0a0a0a, 8, 30);
  scene2.add(cam2);
  ribTex.wrapS = ribTex.wrapT = THREE.RepeatWrapping; ribTex.repeat.set(2, 1); ribMat.side = THREE.DoubleSide;
  const wallGeo = new THREE.CylinderGeometry(4.6, 4.6, 4, 64, 1, true);
  const moonGeo = new THREE.SphereGeometry(1, 24, 16), moons = [];
  for (let k = 0; k < 8; k++) {
    const z = -k * 4, off = (k % 2) * Math.PI / 12;
    const wall = new THREE.Mesh(wallGeo, ribMat); wall.rotation.x = Math.PI / 2; wall.position.z = z - 2; world.add(wall);
    // ring of 12 moons; each moon is smeared into a trail of 5 copies that fan out behind it
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + off; for (let j = 0; j < 5; j++) { const mo = new THREE.Mesh(moonGeo, moonMat); put(mo, Math.cos(a) * (2.9 + j * .22), Math.sin(a) * (2.9 + j * .22), z - j * .55, .55 + j * .02); mo.userData.sp = 0; moons.push(mo); } }
    // 4 apples inside the ring on the diagonals, 4 big dark apples out at the edges
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; const ap = apple(); ap.rotation.z = a + Math.PI / 2; put(ap, Math.cos(a) * 1.6, Math.sin(a) * 1.6, z - 1.5, 1.0); ap.userData.sp = 0; const ob = apple(); ob.rotation.z = a - Math.PI / 2; put(ob, Math.cos(a) * 4.0, Math.sin(a) * 4.0, z - 2.5, 1.9); ob.userData.sp = 0; }
  }
  // Centre sphere with a spiral of spheres behind it; every one of them spins exactly like the front one
  const chain = [];
  for (let i = 0; i < 16; i++) {
    const o = new THREE.Mesh(sphereGeo, moonMat);
    const a = i * .9, r = i * .32;
    o.position.set(Math.cos(a) * r, Math.sin(a) * r, -7 - i * 1.3);
    o.scale.setScalar(i === 0 ? 1.3 : 1.1 + i * .12);
    cam2.add(o); chain.push(o);
  }
  // Shapes that drift in from the sides and fly past the camera
  const fly = [];
  for (let i = 0; i < 20; i++) {
    const kind = i % 3;
    const o = kind === 0 ? apple() : kind === 1 ? new THREE.Mesh(sphereGeo, moonMat) : new THREE.Mesh(coneGeo, ribMat);
    o.userData = { a: Math.random() * 6.28, rad: 1.8 + Math.random() * 2.2, z: -Math.random() * 30, sp: 2.5 + Math.random() * 2.5, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(1.3) };
    o.scale.setScalar(.35 + Math.random() * .5);
    scene2.add(o); fly.push(o);
  }
  const rt = new THREE.WebGLRenderTarget(2, 2);
  const rt0 = new THREE.WebGLMultisampleRenderTarget(2, 2);
  function sizeRT() { const pr = renderer.getPixelRatio(); rt.setSize(innerWidth * pr, innerHeight * pr); rt0.setSize(innerWidth * pr, innerHeight * pr); cam2.aspect = innerWidth / innerHeight; cam2.updateProjectionMatrix(); }
  addEventListener('resize', sizeRT); sizeRT();
  // Mirror pass: fold the left half onto the right, greyscale
  const quadMat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, uniforms: { t: { value: rt.texture }, uMix: { value: 0 }, uFold: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: 'uniform sampler2D t; uniform float uMix; uniform float uFold; varying vec2 vUv; void main(){ vec2 p = (vUv - .5) * mix(.82, 1., uMix); vec2 q = mix(p + .5, .5 + abs(p), uFold); vec3 c = texture2D(t, q).rgb; float l = pow(dot(c, vec3(.34)), .9); gl_FragColor = vec4(mix(c, vec3(l), uFold) * mix(.35, 1., uMix), uMix); }' });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat);
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const quadCam = new THREE.Camera();
  // Droplet pass: red/cyan edge fringe (grows with cursor speed) + film grain
  const abMat = new THREE.ShaderMaterial({ depthTest: false, uniforms: { t: { value: rt0.texture }, amt: { value: .005 }, tm: { value: 0 } },
    vertexShader: quadMat.vertexShader,
    fragmentShader: 'uniform sampler2D t; uniform float amt; uniform float tm; varying vec2 vUv; void main(){ vec2 d = (vUv - .5) * amt; vec3 c = vec3(texture2D(t, vUv + d).r, texture2D(t, vUv).g, texture2D(t, vUv - d).b); float n = fract(sin(dot(vUv * vec2(1920., 1080.) + tm, vec2(12.9898, 78.233))) * 43758.5453); gl_FragColor = vec4(c + (n - .5) * .035, 1.); }' });
  const abScene = new THREE.Scene(); abScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), abMat));
  let ab = .005;

  // ---- Stage 3: flat shard scene (plays on every second hold) ----
  const c2 = document.getElementById('c2'), x2 = c2.getContext('2d');
  let shards = [], sT = 0, spawnAcc = 0, hits = 0, bgMix = 0, lastHitT = -9;
  function sizeC2() { c2.width = innerWidth; c2.height = innerHeight; }
  addEventListener('resize', sizeC2); sizeC2();
  const TRI = [[0, -1], [.9, .8], [-.9, .8]], SQ4 = [[-.8, -.8], [.8, -.8], [.8, .8], [-.8, .8]];
  function mkShard() {
    const W = c2.width, H = c2.height, k = Math.random();
    const type = k < .05 ? 'bar' : k < .3 ? 'poly' : k < .52 ? 'stripe' : k < .74 ? 'squig' : k < .9 ? 'dot' : 'ring';
    const n = 3 + Math.floor(Math.random() * 4), pts = [], sq = [];
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random() * .8, r = .4 + Math.random() * .6; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    for (let i = 0; i < 5; i++) sq.push([(i - 2) * .5, (Math.random() - .5) * .8]);
    const big = type === 'poly' || type === 'stripe';
    return { type, pts, sq, x: Math.random() * W, y: H * (1 - Math.pow(Math.random(), 2) * .95) + 20, vx: (Math.random() - .5) * 20, vy: -(10 + Math.random() * 35), rot: Math.random() * 6.28, vr: (Math.random() - .5) * 1.4,
      size: (type === 'dot' ? 4 : type === 'squig' ? 18 : 16) + Math.random() * (big ? 60 : 22), life: 0, max: 4 + Math.random() * 6, depth: .3 + Math.random(), acc: Math.random() < .3 };
  }
  // a long blue striped bar that shoots diagonally across the screen
  function fix(s) { if (s.type === 'bar') { s.x = c2.width + 120; s.y = Math.random() * c2.height * .6; s.vx = -(140 + Math.random() * 120); s.vy = 70 + Math.random() * 60; s.rot = Math.atan2(s.vy, s.vx); s.vr = 0; s.size = 140; s.max = 6; s.acc = true; s.depth = .8; } return s; }
  function drawShard(s, fg, ac) {
    const a = Math.min(1, s.life / .5) * Math.min(1, (s.max - s.life) / .8); if (a <= 0) return;
    x2.save(); x2.translate(s.x - m.nx * 30 * s.depth, s.y + m.ny * 20 * s.depth); x2.rotate(s.rot); x2.scale(s.size * a * (s.slow > 0 ? 1 + .12 * Math.sin(s.life * 9) : 1), s.size * a * (s.slow > 0 ? 1 + .12 * Math.sin(s.life * 9) : 1));
    const col = s.tint || (s.acc ? ac : fg); x2.fillStyle = col; x2.strokeStyle = col;
    if (s.type === 'poly' || s.type === 'stripe') {
      x2.beginPath(); (s.type === 'stripe' ? (s.pts.length % 2 ? TRI : SQ4) : s.pts).forEach((p, i) => i ? x2.lineTo(p[0], p[1]) : x2.moveTo(p[0], p[1])); x2.closePath();
      if (s.type === 'stripe') { x2.clip(); for (let i = -6; i < 6; i++) x2.fillRect(-1.5, i * .2, 3, .1); } else x2.fill();
    } else if (s.type === 'bar') {
      x2.beginPath(); x2.rect(-1, -.12, 2, .24); x2.clip(); for (let i = -14; i < 14; i++) x2.fillRect(i * .12, -.2, .06, .4);
    } else if (s.type === 'squig') {
      x2.lineWidth = .1; x2.beginPath(); x2.moveTo(s.sq[0][0], s.sq[0][1]);
      for (let i = 1; i < 5; i++) x2.quadraticCurveTo((s.sq[i - 1][0] + s.sq[i][0]) / 2, s.sq[i][1] * 1.6, s.sq[i][0], s.sq[i][1]);
      x2.stroke();
    } else if (s.type === 'dot') { x2.beginPath(); x2.arc(0, 0, .5, 0, 7); x2.fill(); }
    else { x2.lineWidth = .14; x2.beginPath(); x2.arc(0, 0, .5, 0, 7); x2.stroke(); }
    x2.restore();
  }
  function stepShards(dt) {
    sT += dt; spawnAcc += Math.min(4, 1 + sT * .3) * dt;
    while (spawnAcc > 1) { spawnAcc--; if (shards.length < 28) shards.push(fix(mkShard())); }
    shards.forEach(s => {
      s.life += dt;
      const a = Math.min(1, s.life / .5) * Math.min(1, (s.max - s.life) / .8);
      const sx = s.x - m.nx * 30 * s.depth, sy = s.y + m.ny * 20 * s.depth, dx = sx - m.x, dy = sy - m.y, d = Math.hypot(dx, dy) || 1;
      // cursor touches a shape: it slows right down, wobbles, spins and drifts away; the first touch also turns the scene white
      if (a > .2 && d < s.size * .7) {
        if (!s.hit && sT - lastHitT > 1.5) { s.hit = true; hits++; lastHitT = sT; s.tint = hits % 2 ? '#1a1aff' : '#ff7a00'; s.vr = (Math.random() < .5 ? -1 : 1) * (1.5 + Math.random() * 2); }
        s.slow = 2.5; s.x += dx / d * 40 * dt; s.y += dy / d * 40 * dt;
      }
      s.slow = Math.max(0, (s.slow || 0) - dt);
      const k = s.slow > 0 ? .07 : 1;
      s.x += (s.vx * k + (s.slow > 0 ? Math.sin(s.life * 9) * 14 : 0)) * dt;
      s.y += s.vy * dt * (.5 + s.depth) * k;
      s.rot += s.vr * dt * (s.slow > 0 ? 2.5 : 1);
    });
    shards = shards.filter(s => s.life < s.max);
    bgMix = lerp(bgMix, (hits >= 2 && hits % 2 === 0) ? 1 : 0, Math.min(1, dt * 8));
    const bv = Math.round(bgMix * 253), light = bgMix > .5;
    x2.fillStyle = 'rgb(' + bv + ',' + bv + ',' + bv + ')'; x2.fillRect(0, 0, c2.width, c2.height);
    shards.forEach(s => drawShard(s, light ? '#000' : '#fff', light ? '#f00' : '#00f'));
  }

  // ---- Stage 4: bright colour scene. A tower of objects on a violet-to-magenta gradient that bursts apart ----
  const scene3 = new THREE.Scene(), cam3 = new THREE.PerspectiveCamera(40, 1, .1, 80);
  let s3 = 0;
  { const gc = document.createElement('canvas'); gc.width = 4; gc.height = 256; const q = gc.getContext('2d'); const gr = q.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2a0b8f'); gr.addColorStop(1, '#c200cf'); q.fillStyle = gr; q.fillRect(0, 0, 4, 256); scene3.background = new THREE.CanvasTexture(gc); }
  const vividMat = k => new THREE.ShaderMaterial({ uniforms: { k: { value: k } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform float k; varying vec3 vN; void main(){ vec3 c = clamp((.5 + .5 * normalize(vN) - .15) * 1.7, 0., 1.); if (k > 2.5) c = c.bgr; else if (k > 1.5) c = c.brg; else if (k > .5) c = c.gbr; gl_FragColor = vec4(c, 1.); }' });
  const tower = new THREE.Group(); scene3.add(tower);
  const bits = [];
  const addT = (geo, k, y) => { const o = new THREE.Mesh(geo, vividMat(k)); o.position.y = y; tower.add(o); return o; };
  addT(new THREE.BoxGeometry(4, .25, 4), 0, -3); addT(new THREE.CylinderGeometry(.22, .22, 6, 24), 2, 0); addT(new THREE.BoxGeometry(3, .06, 3), 1, 3.4);
  const helix = []; for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 14; helix.push(new THREE.Vector3(Math.cos(a) * .9, -2.6 + i / 120 * 4.6, Math.sin(a) * .9)); }
  addT(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 240, .05, 6), 0, 0);
  const geos3 = [new THREE.SphereGeometry(.6, 20, 14), new THREE.ConeGeometry(.45, 1, 20), new THREE.TorusKnotGeometry(.4, .14, 60, 8), new THREE.CylinderGeometry(.3, .3, 1.2, 16), new THREE.TorusGeometry(.5, .12, 10, 28), new THREE.BoxGeometry(.8, .8, .8)];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, o = new THREE.Mesh(geos3[i % 6], vividMat(i % 4)); o.scale.setScalar(.8 + (i % 3) * .3);
    o.userData = { b: new THREE.Vector3(Math.cos(a) * .5, -2 + i / 14 * 5, Math.sin(a) * .5), d: new THREE.Vector3(Math.cos(a), (Math.random() - .3) * .8, Math.sin(a) * .8).multiplyScalar(3 + Math.random() * 3), sp: new THREE.Vector3(Math.random(), Math.random(), Math.random()) };
    tower.add(o); bits.push(o);
  }

  // ---- The lighter: follows the cursor, lights up, and burns pink holes into the blue box ----
  const boxMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uP: { value: Array.from({ length: 20 }, () => new THREE.Vector4()) }, uAll: { value: 0 } },
    vertexShader: 'varying vec3 vObj; varying vec3 vN; void main(){ vObj = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec4 uP[20]; uniform float uAll; varying vec3 vObj; varying vec3 vN; void main(){ float burn = 0.; for (int i = 0; i < 20; i++) { vec4 p = uP[i]; if (p.w > 0.) burn = max(burn, 1. - distance(vObj, p.xyz) / p.w); } float n = sin(vObj.x * 9.) * sin(vObj.y * 11.) * sin(vObj.z * 10.) * .5 + .5; burn += (n - .5) * .45 + uAll * 1.8; if (burn > .6) discard; vec3 b = mix(vec3(.05, .15, 1.), vec3(.1, .8, 1.), .5 + .5 * normalize(vN).y); b = mix(b, vec3(1., .1, .85), smoothstep(.15, .5, burn)); b += vec3(1., .65, .2) * smoothstep(.5, .6, burn); gl_FragColor = vec4(b, 1.); }' });
  const box = new THREE.Mesh(new THREE.BoxGeometry(3.4, 6.3, 3.4), boxMat); box.position.y = .05; tower.add(box);
  const lighter = new THREE.Group(); scene3.add(lighter);
  const lc = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .22, 16), vividMat(1)); lc.position.y = .72;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.13, .5, 12), new THREE.MeshBasicMaterial({ color: 0xffb02e })); flame.position.y = 1.1;
  const glow = new THREE.Mesh(new THREE.ConeGeometry(.24, .8, 12), new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: .45 })); glow.position.y = 1.2;
  lighter.add(new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1.4, 16), vividMat(2)), lc, flame, glow);
  const rc = new THREE.Raycaster(), bpts = [], UP = new THREE.Vector3(0, 1, 0), cursorW = new THREE.Vector3(), tmpV = new THREE.Vector3(), cL = new THREE.Vector3(), cP = new THREE.Vector3(), foll = { i: 0, t: 0 };
  let burnAcc = 0, bT = 0, rel = false, relT = 0;
  function resetBurn() { lighter.position.set(6, -4, 0); lighter.visible = true; bits.forEach(o => { o.userData.cur = null; o.userData.off = null; o.userData.free = false; }); foll.i = 0; foll.t = 0; bpts.length = 0; burnAcc = 0; bT = 0; rel = false; relT = 0; box.visible = true; boxMat.uniforms.uAll.value = 0; boxMat.uniforms.uP.value.forEach(v => v.set(0, 0, 0, 0)); }
  // returns how far the shapes have burst out of the box (0 while the box is still closed)
  function stepLighter(dt, t) {
    tower.updateMatrixWorld(true); cam3.updateMatrixWorld(true);
    rc.setFromCamera(new THREE.Vector2(m.nx, m.ny), cam3); rc.ray.at(12, cursorW);
    const hit = rel ? null : rc.intersectObject(box)[0], lit = s3 > 3.5;   // the lighter starts off and flames up after a few seconds
    let tp, tq;
    if (hit) { const n = hit.face.normal.clone().transformDirection(box.matrixWorld); tp = hit.point.clone().addScaledVector(n, 1.3); tq = new THREE.Quaternion().setFromUnitVectors(UP, n.clone().negate()); }
    else { tp = rc.ray.at(11, new THREE.Vector3()); tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -.35)); }
    lighter.position.lerp(tp, .25); lighter.quaternion.slerp(tq, .2);
    const f = lit ? 1 + Math.sin(t * 40) * .15 : (s3 > 2.6 && Math.random() < .3 ? .7 : 0);   // sputters before it catches
    flame.scale.set(f, f * (1 + Math.sin(t * 27) * .2), f); glow.scale.set(f, f, f);
    if (hit && lit) {
      burnAcc += dt; bT += dt;
      if (bT > .08) { bT = 0; const lp = box.worldToLocal(hit.point.clone()); if (!bpts.length || bpts[bpts.length - 1].p.distanceTo(lp) > .2) { bpts.push({ p: lp, r: .15 }); if (bpts.length > 20) bpts.shift(); } }
    }
    boxMat.uniforms.uP.value.forEach((v, i) => { const b = bpts[i]; if (b) { b.r = Math.min(.95, b.r + dt * .5); v.set(b.p.x, b.p.y, b.p.z, b.r); } else v.set(0, 0, 0, 0); });
    if (!rel && burnAcc > 6) { rel = true; relT = s3; }
    lighter.visible = !(rel && s3 - relT > 1);
    window.__tip = s3 < 3.5 ? 'The lighter is off…' : rel ? (s3 - relT > 2.2 ? 'One shape follows you — touch the others to throw them' : 'Release') : (burnAcc > .15 ? 'Keep the flame there' : 'Bring the flame to the box');
    if (rel) { const k = Math.min(1, (s3 - relT) / 1.2); boxMat.uniforms.uAll.value = k; if (k >= 1) box.visible = false; return 1 - Math.pow(1 - Math.min(1, Math.max(0, (s3 - relT - .4) / 6)), 3); }
    return 0;
  }

  // before release the shapes burst outward. afterwards they float free: ONE shape at a time chases the cursor,
  // and any other shape the cursor gets close to runs away from it
  function stepBits(ex, dt, t) {
    const fo = rel ? Math.min(1, Math.max(0, (s3 - relT - 1.2) / .8)) : 0;
    let curSpeed = 0;
    if (fo > 0) {
      cL.copy(cursorW); tower.worldToLocal(cL); curSpeed = dt > 0 ? cL.distanceTo(cP) / dt : 0; cP.copy(cL); foll.t += dt;
      if (foll.t > 5) {   // hand-over: the old follower is flung off, a new shape takes its place
        foll.t = 0; const ob = bits[foll.i].userData; if (ob.vel) { ob.vel.set((Math.random() - .5) * 10, (Math.random() - .5) * 8, (Math.random() - .5) * 4); ob.spin = 8; }
        foll.i = (foll.i + 1 + Math.floor(Math.random() * (bits.length - 1))) % bits.length;
      }
    }
    bits.forEach((o, i) => {
      const u = o.userData;
      const bx = u.b.x + u.d.x * ex, by = u.b.y + u.d.y * ex + Math.sin(t + u.sp.x * 6) * .15 * ex, bz = u.b.z + u.d.z * ex;
      if (!u.cur) u.cur = new THREE.Vector3(bx, by, bz);
      if (!u.off) u.off = new THREE.Vector3();
      if (fo > 0) {
        if (!u.free) { u.free = true; u.vel = u.d.clone().multiplyScalar(.25); u.spin = 0; }
        if (i === foll.i) {   // the chosen shape rides the cursor
          tmpV.set(cL.x, cL.y + Math.sin(t * 3) * .08, cL.z);
          u.cur.lerp(tmpV, Math.min(1, .14 * 60 * dt)); u.vel.set(0, 0, 0);
        } else {
          const dx = u.cur.x - cL.x, dy = u.cur.y - cL.y, dz = u.cur.z - cL.z, d = Math.hypot(dx, dy, dz) || 1;
          if (d < 1.3) {   // the cursor touches it: it is thrown away from the cursor, spinning
            const sp = 10 + Math.min(10, curSpeed * .5);
            let ax = dx, ay = dy, al = Math.hypot(ax, ay); if (al < .15) { const ang = Math.random() * 6.283; ax = Math.cos(ang); ay = Math.sin(ang); al = 1; }   // thrown across the screen, random way if hit dead-centre
            u.vel.set(ax / al * sp, ay / al * sp + 1.5, dz / d * sp * .25); u.spin = 8;
          }
          u.cur.addScaledVector(u.vel, dt);
          u.vel.multiplyScalar(Math.pow(.15, dt));
          u.vel.x += Math.sin(t * .6 + i) * .3 * dt; u.vel.y += Math.cos(t * .5 + i * 1.7) * .3 * dt;
          if (Math.abs(u.cur.x) > 7) { u.cur.x = Math.sign(u.cur.x) * 7; u.vel.x *= -.8; }
          if (Math.abs(u.cur.y) > 4.2) { u.cur.y = Math.sign(u.cur.y) * 4.2; u.vel.y *= -.8; }
          if (Math.abs(u.cur.z) > 3.5) { u.cur.z = Math.sign(u.cur.z) * 3.5; u.vel.z *= -.8; }
        }
        u.spin *= Math.pow(.2, dt);
      } else u.cur.set(bx, by, bz);
      o.position.copy(u.cur);
      o.rotation.x += u.sp.x * dt * (1 + fo * 2 + (u.spin || 0)); o.rotation.y += u.sp.y * dt * (1 + fo * 2 + (u.spin || 0));
    });
  }

  // Click & hold state
  let mode = 0, cycle = 0;
  let holding = false, prog = 0, done = false, mix = 0;
  addEventListener('pointerdown', e => { if (!window.__introDone || (e.target && e.target.closest && e.target.closest('#ui,#menu'))) return; holding = true; dot.style.width = dot.style.height = '6px'; });
  ['pointerup', 'pointercancel', 'blur'].forEach(e => addEventListener(e, () => { holding = false; dot.style.width = dot.style.height = '10px'; }));
  const hint = document.getElementById('hint'), bar = document.getElementById('bar');
  const pct = document.getElementById('pct');
  const t0 = performance.now();
  let last = t0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const t = (now - t0) / 1000;

    // cursor velocity (px/frame-ish), smoothed
    const vx = (m.x - prev.x), vy = (m.y - prev.y);
    prev.x = m.x; prev.y = m.y;
    s.vx = lerp(s.vx, vx, 0.18); s.vy = lerp(s.vy, vy, 0.18);

    // Moving down/up: droplet tilts toward the motion and stretches like liquid
    const idle = reduce ? 0 : Math.sin(t * 0.8) * 0.08;
    s.spin += (reduce ? 0 : 0.35 * dt) + s.vx * 0.004;
    s.ry = lerp(s.ry, s.spin + m.nx * 0.6, 0.12);
    s.rx = lerp(s.rx, -m.ny * 0.55 + s.vy * 0.012 + idle, 0.08);
    s.stretch = lerp(s.stretch, Math.min(Math.abs(s.vy) * 0.012, 0.35) * Math.sign(-s.vy), 0.1);
    s.px = lerp(s.px, m.nx * 0.55, 0.06);
    s.py = lerp(s.py, m.ny * 0.45, 0.06);

    holder.position.set(0, 0, 0); uniT.value = t;
    holder.rotation.set(s.rx, s.ry, -s.vx * 0.006);
    holder.scale.set((1 - s.stretch * 0.4) * .82, (1 + s.stretch) * .82, (1 - s.stretch * 0.4) * .82);
    scene.environment && (renderer.toneMappingExposure = 1);

    // cursor dot follows a hair behind the real pointer
    dot.style.transform = `translate(${m.x}px, ${m.y}px)`;

    // placeholder loader counter (replace with real progress later)
    const fake = Math.min(100, Math.floor(((t % 6) / 6) * 100));
    pct.textContent = 'Loading ' + fake + '%';

    // hold progress -> line fills under the droplet; at 100% the puzzle scene shows for as long as the click is held
    if (!done) { prog = holding ? Math.min(1, prog + dt / 1.6) : Math.max(0, prog - dt / 0.6); if (prog >= 1) { done = true; mode = cycle++ % 3; s3 = 0; resetBurn(); sT = 0; spawnAcc = 0; shards = []; hits = 0; bgMix = 0; lastHitT = -9; } }
    else if (!holding) { done = false; prog = 0; }
    mix = done ? Math.min(1, mix + dt / 1.2) : Math.max(0, mix - dt / 0.7);
    bar.style.transform = 'scaleX(' + prog + ')';
    hint.style.opacity = 0.55 * (1 - prog) * (1 - mix);
    bar.style.opacity = 1 - mix;

    renderer.autoClear = true;
    if (mix < 1) {
      try {
        renderer.setRenderTarget(rt0); renderer.render(scene, camera); renderer.setRenderTarget(null);
        ab = lerp(ab, 0.004 + Math.min(Math.hypot(s.vx, s.vy) * 0.0006, 0.02), 0.1);
        abMat.uniforms.amt.value = ab; abMat.uniforms.tm.value = t % 10;
        renderer.render(abScene, quadCam);
      } catch (e) { window.__fail(e); renderer.setRenderTarget(null); renderer.render(scene, camera); }
    }
    if (mix > 0 && mode === 0) {
      cam2.position.x = lerp(cam2.position.x, m.nx * 1.6, 0.05);
      cam2.position.y = lerp(cam2.position.y, m.ny * 1.1, 0.05);
      cam2.lookAt(0, 0, -10);
      chain.forEach(o => o.rotation.set(Math.sin(t * .5) * .35, t * .8, 0));
      world.position.z = (t * 1.6) % 4; world.rotation.z = t * 0.05 + m.nx * 0.3;
      items.forEach(o => { o.rotation.y += o.userData.sp * dt; });
      moons.forEach(o => o.rotation.set(.3, t * .7, 0));
      fly.forEach(o => { const u = o.userData; u.z += u.sp * dt; if (u.z > 4) { u.z = -30; u.a = Math.random() * 6.28; } u.a += dt * .25; o.position.set(Math.cos(u.a) * u.rad, Math.sin(u.a) * u.rad, u.z); o.rotation.x += u.spin.x * dt; o.rotation.y += u.spin.y * dt; o.rotation.z += u.spin.z * dt; });
      renderer.setRenderTarget(rt); renderer.render(scene2, cam2); renderer.setRenderTarget(null);
      quadMat.uniforms.uMix.value = mix;
      renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true;
    }
    if (mix > 0 && mode === 2) {
      s3 += dt; tower.rotation.y = .5 + Math.sin(t * .3) * .25;
      cam3.aspect = innerWidth / innerHeight; cam3.position.set(0, 1.2, 14); cam3.lookAt(0, 0, 0); cam3.updateProjectionMatrix();
      const ex = stepLighter(dt, t);
      stepBits(ex, dt, t);
      renderer.setRenderTarget(rt); renderer.render(scene3, cam3); renderer.setRenderTarget(null);
      quadMat.uniforms.uFold.value = 0; quadMat.uniforms.uMix.value = mix;
      renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true;
      quadMat.uniforms.uFold.value = 1;
    }
    c2.style.opacity = mode === 1 ? mix : 0;
    window.__st = { mode, mix, prog };
    if (mode === 1 && mix > 0) stepShards(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
