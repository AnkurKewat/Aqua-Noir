(function () {
  const $ = id => document.getElementById(id);
  const title = $('title'), sub = $('sub'), hero = $('hero'), chap = $('chap'), chN = $('chNum'), chT = $('chTitle'), chS = $('chNotes'), menu = $('menu'), btn = $('menuBtn'), disc = $('disc');
  const G = 'abcdefghijklmnopqrstuvwxyz*+/<>';
  const LINES = ['One drop,', 'after midnight.'];
  const SUB = 'A perfume house distilled from black apples, moon salt and cold glass.';
  // the tagline is shown one short phrase at a time: each blurs in with the letter-spacing tightening, rests, then blurs out
  const PH = ['A perfume house', 'distilled from black apples,', 'moon salt and cold glass.'];
  function cycleSub() {
    let i = 0;
    (function next() {
      sub.textContent = PH[i++ % PH.length]; sub.classList.remove('out');
      setTimeout(() => { sub.classList.add('out'); setTimeout(next, 1100); }, 2600);
    })();
  }
  const CH = [{ n: 'II — Orchard', t: 'The Orchard', s: 'Black apple · Moon salt · Cold glass' }, { n: 'III — Fracture', t: 'Fracture', s: 'Pink pepper · Broken ice · Smoke' }, { n: 'IV — Afterglow', t: 'Afterglow', s: 'Neon musk · Hot glass · Citrus flare' }];
  const veil = $('veil'), holdTxt = $('holdTxt'), tip = $('tip'); let lastTip = ''; let hT = 0, hLast = '', lastNow = performance.now();
  let letters = [], started = false, curMode = -1, mx = innerWidth / 2, my = innerHeight / 2;
  // text scramble: letters resolve left to right out of random glyphs
  function scr(el, txt, dur) { const s = performance.now(); (function f(n) { const p = Math.min(1, (n - s) / dur); let o = ''; for (let i = 0; i < txt.length; i++) o += (txt[i] === ' ' || i < p * txt.length) ? txt[i] : G[Math.random() * G.length | 0]; el.textContent = o; if (p < 1) requestAnimationFrame(f); })(s); }
  function build() {
    let html = '', k = 0;
    LINES.forEach(L => { html += `<span class='ln'>`; for (const c of L) html += `<span class='w' style='animation-delay:${(k++ * .05).toFixed(2)}s'><span class='l'>${c === ' ' ? '&nbsp;' : c}</span></span>`; html += '</span>'; });
    title.innerHTML = html; letters = [].slice.call(title.querySelectorAll('.l'));
  }
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });
  btn.addEventListener('click', () => menu.classList.toggle('open'));
  disc.addEventListener('click', () => menu.classList.add('open'));
  menu.addEventListener('click', e => { if (!(e.target.closest && e.target.closest('.row'))) menu.classList.remove('open'); });
  [].slice.call(document.querySelectorAll('.row b')).forEach(b => b.addEventListener('mouseenter', () => scr(b, b.dataset.t, 600)));
  function loop() {
    const st = window.__st || { mode: 0, mix: 0, prog: 0 };
    if (window.__introDone && !started) { started = true; build(); cycleSub(); }
    if (started) {
      // hero fades while you hold; letters spread apart and blur as the click is held
      hero.style.opacity = (1 - st.prog * .95) * (1 - Math.min(1, st.mix * 1.5));
      title.style.letterSpacing = (st.prog * .22) + 'em'; title.style.filter = 'blur(' + (st.prog * 7) + 'px)';
      letters.forEach(l => { const r = l.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - mx, r.top + r.height / 2 - my), k = Math.max(0, 1 - d / 200); l.style.transform = 'translateY(' + (-k * 18) + 'px) skewX(' + (-k * 14) + 'deg)'; });
      const want = st.mix > .6 ? st.mode : -1;
      if (want !== curMode) { curMode = want; if (want >= 0) { chN.textContent = CH[want].n; scr(chT, CH[want].t, 900); scr(chS, CH[want].s, 1500); chap.classList.add('on'); } else chap.classList.remove('on'); }
      btn.textContent = menu.classList.contains('open') ? 'Close' : 'Menu';
      // while holding: the page goes black and cycles Keep / Holding / On
      const nowT = performance.now(), dtl = Math.min(.1, (nowT - lastNow) / 1000); lastNow = nowT;
      hT = st.prog > .03 ? hT + dtl : 0;
      veil.style.opacity = Math.min(1, st.prog * 1.5) * (1 - st.mix);
      holdTxt.style.opacity = (hT > 0 ? Math.min(1, hT * 3) : 0) * (1 - st.mix);
      const hw = ['Keep', 'Holding', 'On'][Math.floor(hT / .9) % 3]; if (hT > 0 && hw !== hLast) { hLast = hw; holdTxt.textContent = hw; }
      // short instructions while the lighter scene is open
      const tipS = (st.mix > .6 && st.mode === 2) ? (window.__tip || '') : '';
      if (tipS !== lastTip) { lastTip = tipS; if (tipS) { tip.style.opacity = .9; scr(tip, tipS, 600); } else tip.style.opacity = 0; }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
