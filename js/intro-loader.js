(function () {
  const $ = id => document.getElementById(id);
  const intro = $('intro'), bar = $('ibar'), drop = $('idrop'), dp = $('idp'), track = $('itrack'), line = $('iline');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const t0 = performance.now();
  function tick(now) {
    const t = (now - t0) / 1000;
    // 0-0.6s black -> grey; after the curtain (2.9s) the screen is dark grey
    const g = Math.round(34 * seg(t, .2, .6));
    intro.style.background = t > 2.9 ? '#111' : 'rgb(' + g + ',' + g + ',' + g + ')';
    // small drop fades in (black), flips to white as the curtain opens, falls onto the line at the end
    const dOp = seg(t, .6, 1.2), fall = ease(seg(t, 5.0, 5.4)), sc = .6 + .4 * dOp;
    drop.style.opacity = dOp * (1 - seg(t, 5.5, 5.8));
    drop.style.transform = 'translateY(' + (fall * 16) + 'px) scale(' + sc + ',' + (sc * (1 - .35 * fall)) + ')';
    dp.setAttribute('fill', t < 2.1 ? '#000' : '#fff');
    // thin vertical line grows, thickens into a bar, then widens to fill the screen
    bar.style.height = (ease(seg(t, 1.4, 1.9)) * 100) + '%';
    bar.style.width = (1 + 15 * ease(seg(t, 1.9, 2.4)) + innerWidth * ease(seg(t, 2.4, 2.9))) + 'px';
    // progress line grows from the centre under the drop, then collapses
    track.style.opacity = seg(t, 2.9, 3.2) * (1 - seg(t, 5.4, 5.7));
    line.style.width = (450 * ease(seg(t, 3.0, 5.2)) * (1 - ease(seg(t, 5.4, 5.8)))) + 'px';
    // reveal the droplet scene
    intro.style.opacity = 1 - seg(t, 5.9, 7.2);
    if (t > 6.5) window.__introDone = true;
    if (t < 7.3) requestAnimationFrame(tick); else intro.remove();
  }
  requestAnimationFrame(tick);
})();
