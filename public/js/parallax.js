'use strict';
/* NetLab cursor parallax background (2.7).
   NLParallax.mount(hostElement, {strength}) adds 5 decorative layers behind the host's content:
     1 gradient · 2 grid + circuit traces · 3 network nodes/links with moving packets · 4 floating geometric shapes · 5 soft light
   Each layer moves a few px (depth x 4–12 px, scaled to the screen) towards the cursor, eased with requestAnimationFrame
   and CSS transforms only (no layout work, no framework state). Layers ignore the pointer (pointer-events:none) so forms stay usable.
   Touch screens: no cursor tracking, only slow packets. prefers-reduced-motion: completely static.
   The loop stops when the tab is hidden or the host is off screen; destroy() removes listeners, observers and DOM. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const live = new Set();
  const mq = q => (window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener() {}, removeEventListener() {} });
  const svg = (tag, a = {}) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
  /* small seeded random so the picture is the same on every visit */
  const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  function buildNetwork(rand) {
    const W = 1200, H = 800, nodes = [];
    const cols = 6, rows = 4;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rand() < 0.22) continue;
      nodes.push({ x: (c + 0.5) / cols * W + (rand() - 0.5) * 120, y: (r + 0.5) / rows * H + (rand() - 0.5) * 110, hub: rand() < 0.22 });
    }
    const edges = [], seen = new Set();
    nodes.forEach((n, i) => {
      nodes.map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) })).filter(o => o.j !== i).sort((a, b) => a.d - b.d).slice(0, n.hub ? 3 : 2)
        .forEach(({ j }) => { const k = i < j ? i + '-' + j : j + '-' + i; if (!seen.has(k)) { seen.add(k); edges.push([i, j]); } });
    });
    return { W, H, nodes, edges };
  }

  function mount(host, opts = {}) {
    if (!host || host.querySelector(':scope > .px')) return { destroy() {} };
    const strength = opts.strength == null ? 1 : opts.strength;
    const reduce = mq('(prefers-reduced-motion: reduce)').matches;
    const touch = mq('(hover: none), (pointer: coarse)').matches;
    const rand = rng(opts.seed || 20261013);
    const root = document.createElement('div');
    root.className = 'px' + (reduce ? ' px-still' : '');
    root.setAttribute('aria-hidden', 'true');

    const L = [];
    const layer = (cls, depth) => { const d = document.createElement('div'); d.className = 'px-l ' + cls; root.append(d); L.push({ el: d, depth }); return d; };
    layer('px-grad', 0.15);

    /* 2: grid + circuit traces */
    const g2 = layer('px-grid', 0.35);
    const s2 = svg('svg', { viewBox: '0 0 1200 800', preserveAspectRatio: 'xMidYMid slice' });
    const pat = svg('pattern', { id: 'pxgrid' + live.size, width: 40, height: 40, patternUnits: 'userSpaceOnUse' });
    pat.append(svg('path', { d: 'M40 0H0V40', class: 'px-gridline' }));
    const defs = svg('defs'); defs.append(pat); s2.append(defs, svg('rect', { width: 1200, height: 800, fill: `url(#${pat.id})` }));
    for (let i = 0; i < 9; i++) {
      let x = Math.round(rand() * 30) * 40, y = Math.round(rand() * 20) * 40, d = `M${x} ${y}`;
      for (let k = 0; k < 4; k++) { if (k % 2) y += (rand() < 0.5 ? -1 : 1) * Math.round(1 + rand() * 4) * 40; else x += (rand() < 0.5 ? -1 : 1) * Math.round(2 + rand() * 5) * 40; d += ` L${x} ${y}`; }
      s2.append(svg('path', { d, class: 'px-trace' }), svg('circle', { cx: x, cy: y, r: 4, class: 'px-pad' }));
    }
    g2.append(s2);

    /* 3: network nodes, links and packets */
    const g3 = layer('px-net', 0.65);
    const net = buildNetwork(rand);
    const s3 = svg('svg', { viewBox: `0 0 ${net.W} ${net.H}`, preserveAspectRatio: 'xMidYMid slice' });
    const glow = svg('filter', { id: 'pxglow' + live.size, x: '-50%', y: '-50%', width: '200%', height: '200%' });
    glow.append(svg('feGaussianBlur', { stdDeviation: 4, result: 'b' }));
    const mg = svg('feMerge'); mg.append(svg('feMergeNode', { in: 'b' }), svg('feMergeNode', { in: 'SourceGraphic' })); glow.append(mg);
    const d3 = svg('defs'); d3.append(glow); s3.append(d3);
    net.edges.forEach(([a, b]) => s3.append(svg('line', { x1: net.nodes[a].x, y1: net.nodes[a].y, x2: net.nodes[b].x, y2: net.nodes[b].y, class: 'px-link' })));
    net.nodes.forEach(n => {
      const gN = svg('g', { class: 'px-node' + (n.hub ? ' hub' : ''), transform: `translate(${n.x} ${n.y})` });
      gN.append(svg('circle', { r: n.hub ? 22 : 13, class: 'px-ring' }), svg('circle', { r: n.hub ? 7 : 4.5, class: 'px-core', filter: `url(#${glow.id})` }));
      s3.append(gN);
    });
    const packets = [];
    const nPk = reduce ? 0 : touch ? 3 : 7;
    for (let i = 0; i < nPk; i++) {
      const c = svg('circle', { r: 3.4, class: 'px-packet', filter: `url(#${glow.id})` }); s3.append(c);
      packets.push({ el: c, e: Math.floor(rand() * net.edges.length), t: rand(), dir: rand() < 0.5 ? 1 : -1, v: (touch ? 0.06 : 0.12) * (0.7 + rand() * 0.6) });
    }
    g3.append(s3);

    /* 4: floating geometric shapes */
    const g4 = layer('px-shapes', 1);
    for (let i = 0; i < 7; i++) {
      const s = document.createElement('i');
      s.className = 'px-shape s' + (i % 3);
      s.style.left = (6 + rand() * 88) + '%'; s.style.top = (6 + rand() * 84) + '%';
      s.style.setProperty('--sz', Math.round(18 + rand() * 46) + 'px');
      s.style.animationDelay = (-rand() * 12).toFixed(2) + 's'; s.style.animationDuration = (10 + rand() * 8).toFixed(1) + 's';
      g4.append(s);
    }
    /* 5: soft light that drifts slightly against the cursor */
    layer('px-light', -0.4);

    host.classList.add('px-host');
    host.prepend(root);

    /* ---------- motion ---------- */
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, visible = true, last = performance.now(), maxPx = 8;
    const size = () => { const w = window.innerWidth || 1024; maxPx = Math.max(4, Math.min(12, w / 120)) * strength; };
    size();
    const apply = () => {
      for (const l of L) l.el.style.transform = `translate3d(${(cx * l.depth * maxPx).toFixed(2)}px, ${(cy * l.depth * maxPx).toFixed(2)}px, 0)`;
      g3.style.transform += ` rotateX(${(-cy * 1.2 * strength).toFixed(3)}deg) rotateY(${(cx * 1.2 * strength).toFixed(3)}deg)`;   // slight change of viewpoint
    };
    const stepPackets = dt => {
      for (const p of packets) {
        p.t += p.v * dt * p.dir;
        if (p.t > 1 || p.t < 0) {   // arrive at a node: continue on another link from that node
          const [a, b] = net.edges[p.e]; const at = p.t > 1 ? b : a;
          const next = net.edges.map((e, i) => ({ e, i })).filter(o => o.i !== p.e && (o.e[0] === at || o.e[1] === at));
          const pick = next.length ? next[Math.floor(Math.random() * next.length)] : { e: net.edges[p.e], i: p.e };
          p.e = pick.i; p.dir = pick.e[0] === at ? 1 : -1; p.t = p.dir === 1 ? 0 : 1;
        }
        const [a, b] = net.edges[p.e], A = net.nodes[a], B = net.nodes[b];
        p.el.setAttribute('cx', (A.x + (B.x - A.x) * p.t).toFixed(1)); p.el.setAttribute('cy', (A.y + (B.y - A.y) * p.t).toFixed(1));
      }
    };
    const loop = now => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const k = 1 - Math.pow(0.0025, dt);           // frame-rate independent easing (~90% of the way in 0.4 s)
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      if (Math.abs(tx - cx) < 0.0005) cx = tx; if (Math.abs(ty - cy) < 0.0005) cy = ty;
      apply();
      if (packets.length) stepPackets(dt);
      if (packets.length || cx !== tx || cy !== ty) raf = requestAnimationFrame(loop);   // idle when nothing moves
    };
    const kick = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const onMove = e => { tx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1)); ty = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1)); kick(); };
    const onLeave = e => { if (!e.relatedTarget) { tx = 0; ty = 0; kick(); } };
    const onVis = () => { if (!document.hidden) kick(); };
    const onResize = () => { size(); kick(); };
    const track = !reduce && !touch;
    if (track) { window.addEventListener('pointermove', onMove, { passive: true }); document.addEventListener('pointerout', onLeave); }
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    let io = null;
    if ('IntersectionObserver' in window) { io = new IntersectionObserver(es => { visible = es.some(x => x.isIntersecting); if (visible) kick(); }); io.observe(host); }
    if (packets.length) stepPackets(0);
    apply(); kick();

    const h = {
      host, root,
      state: () => ({ cx, cy, tx, ty, running: !!raf, tracking: track, packets: packets.length, maxPx }),
      destroy() {
        cancelAnimationFrame(raf); raf = 0;
        if (track) { window.removeEventListener('pointermove', onMove); document.removeEventListener('pointerout', onLeave); }
        window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis);
        if (io) io.disconnect();
        root.remove(); host.classList.remove('px-host'); live.delete(h);
      }
    };
    live.add(h);
    return h;
  }
  /* routes call this before drawing a new page; also drops instances whose host left the document */
  function destroyAll() { for (const h of [...live]) h.destroy(); }
  function sweep() { for (const h of [...live]) if (!document.contains(h.host)) h.destroy(); }
  window.NLParallax = { mount, destroyAll, sweep, count: () => live.size, states: () => [...live].map(h => h.state()) };
})();
