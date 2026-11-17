/* WebGL hero text: the title is drawn to a texture and bent by a shader.
   dissolve-in with a glowing edge, liquid ripples round the cursor, RGB split, glitch slices,
   pearlescent sheen, melting while you hold. Cosmic dust floats behind and flees the cursor. */
(function () {
  const hero = document.getElementById('hero');
  const cv = document.createElement('canvas'); cv.id = 'fx'; hero.insertBefore(cv, hero.firstChild);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (e) { return; }   // no WebGL: the normal HTML title stays
  renderer.setClearColor(0x000000, 0);
  hero.classList.add('fx');
  const scene = new THREE.Scene(), cam = new THREE.Camera(), LINES = ['One drop,', 'after midnight.'];
  const tc = document.createElement('canvas'), tex = new THREE.CanvasTexture(tc); tex.minFilter = THREE.LinearFilter;
  const U = { tMap: { value: tex }, uT: { value: 0 }, uM: { value: new THREE.Vector2(.5, .5) }, uV: { value: 0 }, uHold: { value: 0 }, uRev: { value: 0 }, uAsp: { value: 1 }, uPx: { value: 1 } };
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const FRAG = `uniform sampler2D tMap; uniform float uT, uV, uHold, uRev, uAsp; uniform vec2 uM; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
    float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * n(p); p *= 2.1; a *= .5; } return s; }
    void main(){
      vec2 uv = vUv;
      float row = floor(uv.y * 38.);
      uv.x += step(.965, h(vec2(row, floor(uT * 7.)))) * (h(vec2(row, 3.)) - .5) * .06;                  // glitch slices
      vec2 d = (uv - uM) * vec2(uAsp, 1.); float r = length(d);
      uv += normalize(d + 1e-4) * sin(r * 38. - uT * 5.) * exp(-r * 5.) * (.02 + uV * .12);                // liquid ripple round the cursor
      uv.y += sin(uv.x * 9. + uT * 1.3) * .004 + uHold * fbm(uv * 4. + uT * .2) * .35;                       // breathing + melt while holding
      uv.x += (fbm(uv * 5. - uT * .15) - .5) * (.012 + uHold * .2);
      vec2 dir = normalize(d + 1e-4); float ca = .0015 + exp(-r * 4.) * (.004 + uV * .02) + uHold * .02;     // chromatic split
      float a1 = texture2D(tMap, uv + dir * ca).a, a2 = texture2D(tMap, uv).a, a3 = texture2D(tMap, uv - dir * ca).a;
      vec3 col = vec3(a1, a2, a3); float alpha = max(max(a1, a2), a3);
      float s = fbm(uv * 3. + uT * .08);
      vec3 irid = .5 + .5 * cos(6.2831 * (vec3(0., .33, .67) + s * 1.5 + uT * .05));                        // pearlescent sheen
      col = mix(col, col * irid * 1.6, .45);
      float nz = fbm(uv * 6.5 + 3.), th = uRev * 1.3 - .1;                                                  // dissolve-in
      float vis = 1. - smoothstep(th - .08, th, nz);
      float band = smoothstep(th - .12, th - .04, nz) * (1. - smoothstep(th - .04, th, nz));
      col += vec3(.45, .95, 1.) * band * alpha * 2.;
      gl_FragColor = vec4(col, alpha * vis);
    }`;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthTest: false, vertexShader: VERT, fragmentShader: FRAG }));
  scene.add(quad);
  // cosmic dust
  const N = 420, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * 2 - 1; pos[i * 3 + 1] = Math.random() * 2 - 1; seed[i] = Math.random(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aS', new THREE.BufferAttribute(seed, 1));
  const dust = new THREE.Points(pg, new THREE.ShaderMaterial({ transparent: true, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uT: U.uT, uV: U.uV, uM: U.uM, uPx: U.uPx },
    vertexShader: `attribute float aS; uniform float uT, uV, uPx; uniform vec2 uM; varying float vA;
      void main(){ vec2 p = position.xy; p.y = mod(p.y + 1. + uT * (.01 + aS * .03), 2.) - 1.; p.x += sin(uT * .3 + aS * 40.) * .02;
        vec2 m = uM * 2. - 1.; vec2 d = p - m; float r = length(d * vec2(1.6, 1.)); p += normalize(d + 1e-4) * exp(-r * 6.) * (.08 + uV * .25);
        gl_Position = vec4(p, 0., 1.); gl_PointSize = (1.2 + aS * 4.) * uPx * (.6 + .4 * sin(uT * 2. + aS * 60.)); vA = .25 + .75 * aS; }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(.8, .9, 1., (1. - smoothstep(0., .5, d)) * vA); }' }));
  dust.frustumCulled = false; scene.add(dust);
  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false); U.uPx.value = dpr; U.uAsp.value = W / H;
    tc.width = W; tc.height = H; const g = tc.getContext('2d'); g.clearRect(0, 0, W, H);
    const fs = Math.min(128, Math.max(40, innerWidth * .085)) * dpr;
    g.font = 'italic 300 ' + fs + 'px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    LINES.forEach((L, i) => g.fillText(L, W / 2, H / 2 - 27 * dpr + (i - .5) * fs * .95));
    tex.needsUpdate = true;
  }
  build(); addEventListener('resize', build);
  if (document.fonts && document.fonts.load) document.fonts.load('italic 300 64px "Cormorant Garamond"').then(build, () => {});
  let mx = innerWidth / 2, my = innerHeight / 2, px = mx, py = my, vS = 0, rs = -1;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });
  const t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    vS += (Math.min(1, Math.hypot(mx - px, my - py) / 50) - vS) * .12; px = mx; py = my;
    U.uT.value = t; U.uV.value = vS; U.uM.value.set(mx / innerWidth, 1 - my / innerHeight);
    U.uHold.value = (window.__st && window.__st.prog) || 0;
    if (window.__introDone) { if (rs < 0) rs = t; U.uRev.value = Math.min(1, (t - rs) / 2.6); }
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
