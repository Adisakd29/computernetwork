'use strict';
/* NetLab 2.8 figures, batch e. Register with NL_FIG('diagram'|'widget', name, svgString|mountFn). */
window.NL_FIG = window.NL_FIG || function (kind, name, v) { const k = kind === 'diagram' ? 'NL_DIAGRAMS' : 'NL_WIDGETS'; (window[k] = window[k] || {})[name] = v; };

/* Week 4 supplementary sections (x1-x4): serial/parallel transmission, RS-232 console, error detection, ARQ.
   Part 1 is pure logic (no DOM) so it can be unit-tested in Node: the UART framer/sampler, the parallel skew model,
   parity / 2-D parity / CRC long division / Internet checksum, and the Stop-and-Wait / Go-Back-N event simulator.
   Part 2 registers static diagrams, part 3 mounts the widgets. */
(function () {
  /* ======================================================================
     Part 1. Pure logic
     ====================================================================== */
  const sum = a => a.reduce((x, y) => x + y, 0);
  function mkRng(seed) { // mulberry32
    let a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /* parity bit that makes the total number of 1s even ('E') or odd ('O') */
  function parityBit(bits, mode) { const p = sum(bits) % 2; return mode === 'O' ? 1 - p : p; }

  /* ---------- UART (asynchronous serial) ---------- */
  // cfg = { baud, data (5-8), parity 'N'|'E'|'O', stop (1|2) }
  function uartFrame(byte, cfg) {
    const out = [{ v: 0, role: 'start' }];
    const d = [];
    for (let i = 0; i < cfg.data; i++) d.push((byte >> i) & 1); // LSB first
    d.forEach((v, i) => out.push({ v, role: 'data', i }));
    if (cfg.parity !== 'N') out.push({ v: parityBit(d, cfg.parity), role: 'parity' });
    for (let i = 0; i < cfg.stop; i++) out.push({ v: 1, role: 'stop', i });
    return out;
  }
  function uartEncode(bytes, cfg, gapBits) {
    const tb = 1 / cfg.baud, segs = [];
    let t = (gapBits == null ? 2 : gapBits) * tb; // line idles (logic 1) before the first character
    bytes.forEach((b, ci) => {
      uartFrame(b, cfg).forEach((bit, bi) => { segs.push({ t0: t, t1: t + tb, v: bit.v, role: bit.role, i: bit.i, ci, bi }); t += tb; });
      t += (gapBits == null ? 2 : gapBits) * tb;
    });
    return { segs, end: t, tb };
  }
  function lineLevel(segs, t) { // idle = 1 (mark)
    let lo = 0, hi = segs.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1, s = segs[m];
      if (t < s.t0) hi = m - 1; else if (t >= s.t1) lo = m + 1; else return s.v;
    }
    return 1;
  }
  function fallingEdges(segs) {
    const e = [];
    segs.forEach((s, k) => {
      if (s.v !== 0) return;
      const prev = k > 0 && Math.abs(segs[k - 1].t1 - s.t0) < 1e-12 ? segs[k - 1].v : 1;
      if (prev === 1) e.push(s.t0);
    });
    return e;
  }
  /* The receiver hunts for a 1->0 edge, checks the middle of the start bit, then samples each following bit in its middle
     using ITS OWN baud rate and format. Like common UARTs it checks only the first stop bit. */
  function uartDecode(enc, cfg) {
    const tb = 1 / cfg.baud, edges = fallingEdges(enc.segs), frames = [];
    let from = 0, guard = 0;
    while (guard++ < 2000) {
      const e = edges.find(x => x >= from - 1e-12);
      if (e == null || e > enc.end) break;
      const mid = e + tb / 2;
      if (lineLevel(enc.segs, mid) !== 0) { frames.push({ t0: e, falseStart: true, samples: [{ t: mid, v: 1, role: 'start' }] }); from = mid; continue; }
      const samples = [{ t: mid, v: 0, role: 'start' }];
      let value = 0;
      const d = [];
      for (let i = 0; i < cfg.data; i++) { const t = e + (1.5 + i) * tb, v = lineLevel(enc.segs, t); samples.push({ t, v, role: 'data', i }); d.push(v); value |= v << i; }
      let k = cfg.data + 1, parityErr = false;
      if (cfg.parity !== 'N') { const t = e + (k + 0.5) * tb, v = lineLevel(enc.segs, t); samples.push({ t, v, role: 'parity' }); parityErr = v !== parityBit(d, cfg.parity); k++; }
      const ts = e + (k + 0.5) * tb, vs = lineLevel(enc.segs, ts);
      samples.push({ t: ts, v: vs, role: 'stop' });
      frames.push({ t0: e, t1: e + (k + cfg.stop) * tb, samples, value, parityErr, framingErr: vs !== 1 });
      from = ts;
    }
    return frames;
  }
  function uartRun(bytes, tx, rx) {
    const enc = uartEncode(bytes, tx, 2), frames = uartDecode(enc, rx), got = frames.filter(f => !f.falseStart);
    return {
      enc, frames, bytes: got.map(f => f.value),
      parityErrors: got.filter(f => f.parityErr).length, framingErrors: got.filter(f => f.framingErr).length,
      ok: got.length === bytes.length && got.every((f, i) => f.value === (bytes[i] & ((1 << rx.data) - 1)) && !f.parityErr && !f.framingErr) && tx.data === rx.data
    };
  }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(s));
    return Array.from(unescape(encodeURIComponent(s))).map(c => c.charCodeAt(0));
  }
  // how a terminal set to an 8-bit (Latin-1) character set would show a received byte
  function termChar(b) { if (b >= 32 && b <= 126) return String.fromCharCode(b); if (b >= 0xA1) return String.fromCharCode(b); return '·'; }

  /* ---------- parallel bus skew ---------- */
  const SKEW = [0, 0.35, 0.9, 0.15, 0.6, 1, 0.25, 0.75]; // relative delay of wires D0..D7 (one fixed example cable)
  function parallelSample(byte, prev, clockMHz, skewNs) {
    const T = 1000 / clockMHz, at = T / 2; // the receiver latches all 8 wires at the middle of the clock period
    const wires = SKEW.map((k, i) => {
      const bit = (byte >> i) & 1, old = (prev >> i) & 1, delay = k * skewNs, late = delay > at;
      return { i, bit, delay, late, got: late ? old : bit };
    });
    const got = wires.reduce((a, w) => a | (w.got << w.i), 0);
    return { T, at, wires, got, ok: got === byte, maxClockMHz: skewNs > 0 ? 1000 / (2 * skewNs) : Infinity };
  }

  /* ---------- error detection ---------- */
  const bitsOf = s => String(s).split('').map(Number);
  const strOf = a => a.join('');
  function crcDivide(dividend, gen) { // modulo-2 long division, returns remainder (gen.length-1 bits) and the XOR steps
    const r = gen.length - 1, w = dividend.slice(), steps = [];
    for (let i = 0; i + r < w.length; i++) {
      if (w[i] !== 1) continue;
      const before = w.slice();
      for (let j = 0; j < gen.length; j++) w[i + j] ^= gen[j];
      steps.push({ pos: i, before, after: w.slice() });
    }
    return { remainder: w.slice(w.length - r), steps, work: w };
  }
  function crcEncode(data, gen) {
    const r = gen.length - 1, div = crcDivide(data.concat(new Array(r).fill(0)), gen);
    return { r, remainder: div.remainder, steps: div.steps, dividend: data.concat(new Array(r).fill(0)), codeword: data.concat(div.remainder) };
  }
  function crcCheck(codeword, gen) { const d = crcDivide(codeword, gen); return { remainder: d.remainder, steps: d.steps, ok: d.remainder.every(b => b === 0) }; }
  function onesAdd(a, b) { let s = a + b; const carry = s > 0xFFFF; if (carry) s = (s & 0xFFFF) + 1; return { s, carry }; }
  function onesSum(words) {
    let s = 0; const steps = [];
    words.forEach(w => { const r = onesAdd(s, w); steps.push({ w, before: s, after: r.s, carry: r.carry }); s = r.s; });
    return { sum: s, steps };
  }
  function inetChecksum(words) { const r = onesSum(words); return { sum: r.sum, steps: r.steps, checksum: (~r.sum) & 0xFFFF }; }
  function inetVerify(wordsWithChecksum) { const r = onesSum(wordsWithChecksum); return { sum: r.sum, steps: r.steps, ok: r.sum === 0xFFFF }; }
  // 2-D even parity: rows of `cols` data bits + row parity, then a row of column parities (+ corner)
  function parity2dEncode(data, cols) {
    const d = data.slice(); while (d.length % cols) d.push(0);
    const rows = [];
    for (let i = 0; i < d.length; i += cols) { const r = d.slice(i, i + cols); rows.push(r.concat(parityBit(r, 'E'))); }
    const last = []; for (let c = 0; c <= cols; c++) last.push(parityBit(rows.map(r => r[c]), 'E'));
    rows.push(last);
    return { rows, padded: d.length - data.length, flat: [].concat(...rows), width: cols + 1 };
  }
  function parity2dCheck(flat, width) {
    const rows = []; for (let i = 0; i < flat.length; i += width) rows.push(flat.slice(i, i + width));
    const badRows = [], badCols = [];
    rows.forEach((r, i) => { if (sum(r) % 2) badRows.push(i); });
    for (let c = 0; c < width; c++) if (sum(rows.map(r => r[c])) % 2) badCols.push(c);
    const ok = !badRows.length && !badCols.length;
    return { ok, badRows, badCols, fix: badRows.length === 1 && badCols.length === 1 ? { r: badRows[0], c: badCols[0] } : null };
  }

  /* ---------- ARQ: Stop-and-Wait (= window 1, seq 0/1) and Go-Back-N (3-bit seq, window 1..7) ---------- */
  // time unit: Tf = transmission time of one data frame = 1. ACKs are tiny (transmission time ~0). D = one-way propagation delay.
  function arqSim(o) {
    const P = Object.assign({ proto: 'gbn', N: 4, D: 1, loss: 0, timeout: null, total: 10, seed: 1 }, o);
    const Tf = 1;
    const M = P.proto === 'sw' ? 2 : 8, N = P.proto === 'sw' ? 1 : Math.max(1, Math.min(7, P.N));
    const TO = P.timeout != null ? P.timeout : Tf + 2 * P.D + 0.5;
    const rng = mkRng(P.seed * 2654435761);
    const S = {
      P, M, N, TO, Tf, now: 0, q: [], seqNo: 0, pkts: [], log: [],
      base: 0, next: 0, maxSent: 0, linkFree: 0, freeEv: false, timer: null, tok: 0,
      expected: 0, done: false, finish: null,
      c: { sent: 0, retx: 0, delivered: 0, discarded: 0, acks: 0, lostData: 0, lostAck: 0, timeouts: 0 }
    };
    const push = (t, type, x) => { S.q.push(Object.assign({ t, type, k: S.seqNo++ }, x)); S.q.sort((a, b) => a.t - b.t || a.k - b.k); };
    const say = (t, cls, msg) => { S.log.push({ t, cls, msg }); };
    function lossDraw() { const a = rng(), b = rng(); return { lost: a < P.loss, frac: 0.3 + 0.4 * b }; }
    function trySend(t) {
      if (S.done) return;
      if (!(S.next < S.base + N && S.next < P.total)) return;
      if (S.linkFree > t + 1e-9) { if (!S.freeEv) { S.freeEv = true; push(S.linkFree, 'free', {}); } return; }
      const idx = S.next, seq = idx % M, retx = idx < S.maxSent, L = lossDraw();
      const p = { id: S.pkts.length, kind: 'D', idx, seq, t0: t, t1: t + Tf + P.D, retx, lost: L.lost, frac: L.frac, manual: false };
      S.pkts.push(p); S.c.sent++; if (retx) S.c.retx++;
      S.next++; S.maxSent = Math.max(S.maxSent, S.next);
      S.linkFree = t + Tf;
      if (!S.timer) startTimer(t);
      if (p.lost) { S.c.lostData++; push(t + Tf + p.frac * P.D, 'lostD', { p }); } else push(p.t1, 'arrive', { p });
      say(t, retx ? 'w' : 'i', `ส่ง${retx ? 'ซ้ำ' : ''} F${idx} (seq ${seq})`);
      S.freeEv = true; push(S.linkFree, 'free', {});
    }
    function startTimer(t) { S.tok++; S.timer = { t0: t, exp: t + TO, tok: S.tok, idx: S.base }; push(t + TO, 'timeout', { tok: S.tok }); }
    function sendAck(t, a, dup) {
      const L = lossDraw();
      const p = { id: S.pkts.length, kind: 'A', ack: a, t0: t, t1: t + P.D, lost: L.lost, frac: L.frac, dup, manual: false };
      S.pkts.push(p); S.c.acks++;
      if (p.lost) { S.c.lostAck++; push(t + p.frac * P.D, 'lostA', { p }); } else push(p.t1, 'ack', { p });
    }
    function handle(ev) {
      const t = ev.t;
      if (ev.type === 'free') { S.freeEv = false; trySend(t); return; }
      if (ev.type === 'lostD') { if (!ev.p.manual) say(t, 'e', `F${ev.p.idx} หายระหว่างทาง ผู้รับไม่ได้รับ`); return; }
      if (ev.type === 'lostA') { if (!ev.p.manual) say(t, 'e', `ACK ${ev.p.ack} หายระหว่างทาง`); return; }
      if (ev.type === 'arrive') {
        const p = ev.p; if (p.lost) return;
        if (p.seq === S.expected % M) {
          S.expected++; S.c.delivered++; p.res = 'ok';
          say(t, 'o', `ผู้รับได้ F${p.idx} ตรงลำดับ ส่งต่อขึ้นชั้นบน ตอบ ACK ${S.expected % M}`);
          sendAck(t, S.expected % M, false);
        } else {
          S.c.discarded++; p.res = 'drop';
          say(t, 'w', `ผู้รับได้ seq ${p.seq} แต่รอ seq ${S.expected % M} จึงทิ้ง แล้วตอบ ACK ${S.expected % M} ซ้ำ`);
          sendAck(t, S.expected % M, true);
        }
        return;
      }
      if (ev.type === 'ack') {
        const p = ev.p; if (p.lost || S.done) return;
        const k = (p.ack - (S.base % M) + M) % M;
        if (k >= 1 && k <= S.maxSent - S.base) {
          S.base += k; if (S.next < S.base) S.next = S.base;
          p.res = 'ok';
          say(t, 'o', `ผู้ส่งได้ ACK ${p.ack}: ยืนยันถึง F${S.base - 1} หน้าต่างเลื่อนไปเริ่มที่ F${S.base}`);
          S.timer = null;
          if (S.base >= P.total) { S.done = true; S.finish = t; say(t, 'o', `ส่งครบ ${P.total} เฟรม ใช้เวลา ${+t.toFixed(2)} หน่วย`); return; }
          if (S.base < S.maxSent) startTimer(t);
          trySend(t);
        } else { p.res = 'dup'; say(t, 'i', `ผู้ส่งได้ ACK ${p.ack} ซ้ำ ไม่มีเฟรมใหม่ถูกยืนยัน จึงไม่ทำอะไร`); }
        return;
      }
      if (ev.type === 'timeout') {
        if (!S.timer || S.timer.tok !== ev.tok || S.done) return;
        S.c.timeouts++; S.timer = null;
        say(t, 'e', `Timer หมดเวลา: ${N === 1 ? 'ส่ง F' + S.base + ' ซ้ำ' : 'ย้อนกลับไปส่งตั้งแต่ F' + S.base + ' ถึง F' + (S.maxSent - 1) + ' ใหม่ทั้งหมด'}`);
        S.next = S.base;
        trySend(t);
      }
    }
    function processUntil(t) {
      while (!S.done && S.q.length && S.q[0].t <= t + 1e-9) { const ev = S.q.shift(); S.now = Math.max(S.now, ev.t); handle(ev); }
      if (!S.done) S.now = Math.max(S.now, t);
    }
    const api = {
      S,
      start() { trySend(0); return api; },
      nextTime() { return S.q.length ? S.q[0].t : null; },
      advanceTo(t) { processUntil(t); return api; },
      step() { const t = api.nextTime(); if (t != null && !S.done) processUntil(t); return api; },
      run(limit) { let g = 0; while (!S.done && S.q.length && g++ < (limit || 20000)) api.step(); return api; },
      inFlight() { return S.pkts.filter(p => !p.lost && p.t0 <= S.now + 1e-9 && S.now < p.t1 - 1e-9); },
      drop(id) { // manual "drop this frame" at the current time
        const p = S.pkts[id]; if (!p || p.lost || !(p.t0 <= S.now + 1e-9 && S.now < p.t1)) return false;
        p.lost = true; p.manual = true;
        const travel = p.kind === 'D' ? Math.max(0, S.now - p.t0 - 0) : S.now - p.t0;
        p.frac = Math.max(0.05, Math.min(1, P.D > 0 ? travel / P.D : 1));
        if (p.kind === 'D') { S.c.lostData++; say(S.now, 'e', `คุณทิ้ง F${p.idx} ระหว่างทาง`); } else { S.c.lostAck++; say(S.now, 'e', `คุณทิ้ง ACK ${p.ack} ระหว่างทาง`); }
        return true;
      },
      efficiency() { const t = S.done ? S.finish : S.now; return t > 0 ? (S.c.delivered * Tf) / t : 0; },
      ideal() { return N * Tf >= Tf + 2 * P.D ? 1 : (N * Tf) / (Tf + 2 * P.D); }
    };
    return api;
  }

  const LOGIC = { mkRng, parityBit, uartFrame, uartEncode, uartDecode, uartRun, lineLevel, utf8, termChar, parallelSample, SKEW,
    bitsOf, strOf, crcDivide, crcEncode, crcCheck, onesSum, inetChecksum, inetVerify, parity2dEncode, parity2dCheck, arqSim };
  if (typeof module === 'object' && module && module.exports) module.exports = LOGIC;
  window.NL_FIG_E = LOGIC;

  /* ======================================================================
     Part 2. Static diagrams (inline SVG strings, theme CSS variables only)
     ====================================================================== */
  const MONO = '"JetBrains Mono",Consolas,monospace';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  const r1 = v => Math.round(v * 10) / 10;
  function at(o) { let s = ''; for (const k in o) if (o[k] != null && o[k] !== false) s += ` ${k}="${o[k]}"`; return s; }
  function T(x, y, s, o) {
    o = o || {};
    return `<text${at({ x: r1(x), y: r1(y), 'font-size': o.size || 14, 'text-anchor': o.anchor || 'start', fill: o.fill || 'var(--ink)', 'font-weight': o.weight })}${o.mono ? ` font-family='${MONO}'` : ' font-family="inherit"'}>${esc(s)}</text>`;
  }
  function R(x, y, w, h, o) { o = o || {}; return `<rect${at({ x: r1(x), y: r1(y), width: r1(w), height: r1(h), rx: o.rx, fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.stroke, 'stroke-width': o.sw, 'stroke-dasharray': o.dash })}/>`; }
  function Ln(x1, y1, x2, y2, o) { o = o || {}; return `<line${at({ x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), stroke: o.stroke || 'var(--ink)', 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash, 'stroke-linecap': 'round' })}/>`; }
  function Pth(d, o) { o = o || {}; return `<path${at({ d, fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.stroke || 'var(--ink)', 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })}/>`; }
  function arrow(x1, y1, x2, y2, o) {
    o = o || {};
    const a = Math.atan2(y2 - y1, x2 - x1), L = 10, c = o.stroke || 'var(--ink)';
    const p1 = [x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45)], p2 = [x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45)];
    return Ln(x1, y1, x2, y2, o) + `<path d="M${r1(x2)} ${r1(y2)}L${r1(p1[0])} ${r1(p1[1])}L${r1(p2[0])} ${r1(p2[1])}Z" fill="${c}"/>`;
  }
  function box(x, y, w, h, l1, l2, col) {
    return R(x, y, w, h, { rx: 8, fill: 'var(--panel)', stroke: col || 'var(--ink)', sw: 2 }) + R(x, y, w, h, { rx: 8, fill: col || 'var(--blue)', fo: 0.08 }) +
      T(x + w / 2, y + (l2 ? h / 2 - 3 : h / 2 + 5), l1, { anchor: 'middle', weight: 700, size: 14 }) + (l2 ? T(x + w / 2, y + h / 2 + 15, l2, { anchor: 'middle', size: 12.5, fill: 'var(--muted)' }) : '');
  }
  function svgDoc(id, w, h, title, body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-title" font-family="inherit"><title id="${id}-title">${esc(title)}</title>${body}</svg>`;
  }

  /* ---- serial-parallel: parallel bus with skew, async 8N1 frame of "A", simplex / half / full duplex ---- */
  (function () {
    let s = '';
    s += T(12, 22, '1) Parallel: ส่ง 8 บิตพร้อมกันบนสาย 8 เส้น', { weight: 700, size: 15 });
    s += T(50, 44, 'ผู้ส่ง', { anchor: 'middle', size: 13, fill: 'var(--muted)' }) + T(430, 44, 'ผู้รับ', { anchor: 'middle', size: 13, fill: 'var(--muted)' });
    s += R(10, 50, 80, 186, { rx: 8, fill: 'var(--panel)', stroke: 'var(--ink)', sw: 2 }) + R(390, 50, 80, 186, { rx: 8, fill: 'var(--panel)', stroke: 'var(--ink)', sw: 2 });
    for (let i = 0; i < 8; i++) {
      const y = 64 + i * 19, bit = (0x41 >> i) & 1, x = 150 + SKEW[i] * 170;
      s += T(50, y + 5, 'D' + i, { anchor: 'middle', size: 12.5, mono: true });
      s += Ln(90, y, 390, y, { stroke: 'var(--blue)', sw: 1.6 });
      s += R(x - 11, y - 8, 22, 16, { rx: 4, fill: 'var(--blue)', fo: bit ? 0.85 : 0.2, stroke: 'var(--blue)', sw: 1 });
      s += T(x, y + 4.5, String(bit), { anchor: 'middle', size: 12, mono: true, fill: bit ? 'var(--panel)' : 'var(--ink)', weight: 700 });
    }
    s += T(50, 224, 'CLK', { anchor: 'middle', size: 12.5, mono: true }) + Ln(90, 220, 390, 220, { stroke: 'var(--orange)', sw: 1.6, dash: '6 5' });
    s += Ln(320, 54, 320, 230, { stroke: 'var(--bad)', sw: 1.5, dash: '3 4' }) + T(318, 246, 'จุดที่ผู้รับอ่านพร้อมกัน', { anchor: 'end', size: 12, fill: 'var(--bad)' });
    s += T(12, 266, 'แต่ละเส้นมาถึงไม่พร้อมกัน (Skew) และสายที่วางชิดกันรบกวนกัน (Crosstalk)', { size: 13 });
    s += T(12, 284, 'ยิ่งความถี่สูงหรือสายยาว ยิ่งอ่านผิด จึงใช้ได้ดีเฉพาะระยะสั้นและความเร็วไม่สูง', { size: 13 });
    // serial frame
    const y0 = 312;
    s += T(12, y0, '2) Serial แบบ Asynchronous (8N1): ส่งตัว A ทีละบิต', { weight: 700, size: 15 });
    const cells = [['idle', 1, 'var(--muted)']].concat([['S', 0, 'var(--orange)']], [0, 1, 2, 3, 4, 5, 6, 7].map(i => ['D' + i, (0x41 >> i) & 1, 'var(--blue)']), [['Stop', 1, 'var(--green)'], ['idle', 1, 'var(--muted)']]);
    const cw = 38, x0 = 12, hi = y0 + 34, lo = y0 + 66;
    let d = '', prev = null;
    cells.forEach((c, k) => {
      const x = x0 + k * cw, y = c[1] ? hi : lo;
      s += R(x, hi - 10, cw, lo - hi + 20, { fill: c[2], fo: 0.1 });
      d += (prev == null ? `M${x} ${y}` : (prev !== y ? `L${x} ${prev}L${x} ${y}` : '')) + `L${x + cw} ${y}`;
      prev = y;
      s += T(x + cw / 2, lo + 30, c[0], { anchor: 'middle', size: 12.5, mono: true, fill: c[2] === 'var(--muted)' ? 'var(--muted)' : 'var(--ink)' });
      if (k > 0 && k < cells.length - 1) s += T(x + cw / 2, hi - 14, String(c[1]), { anchor: 'middle', size: 13, mono: true, weight: 700 });
    });
    s += Pth(d, { stroke: 'var(--ink)', sw: 2.5 });
    s += T(4, hi + 4, '1', { size: 11, fill: 'var(--muted)', mono: true }) + T(4, lo + 4, '0', { size: 11, fill: 'var(--muted)', mono: true });
    s += T(12, lo + 56, 'ส่งบิตต่ำสุด (LSB) ก่อน: 0x41 = 0100 0001 จึงส่ง D0..D7 = 1 0 0 0 0 0 1 0', { size: 13 });
    s += T(12, lo + 76, 'Start bit (0) บอกว่าเริ่มตัวอักษร Stop bit (1) ปิดท้าย ใช้ 10 บิตต่อข้อมูล 8 บิต (80%)', { size: 13 });
    // modes
    const y1 = lo + 116;
    s += T(12, y1, '3) ทิศทางการส่ง (Transmission mode)', { weight: 700, size: 15 });
    const modes = [
      ['Simplex', 'ส่งทางเดียวตลอด เช่น วิทยุ FM, ป้ายประกาศ', [[1, false]]],
      ['Half-duplex', 'สองทางแต่ทีละทาง เช่น วิทยุสื่อสาร, Hub', [[1, false], [-1, true]]],
      ['Full-duplex', 'สองทางพร้อมกัน เช่น โทรศัพท์, พอร์ต Switch', [[1, false], [-1, false]]]
    ];
    modes.forEach((m, k) => {
      const yT = y1 + 16 + k * 64;
      s += T(12, yT + 20, m[0], { weight: 700, size: 14.5 }) + T(12, yT + 42, m[1], { size: 12.5, fill: 'var(--muted)' });
      s += box(296, yT + 6, 38, 34, 'A') + box(436, yT + 6, 38, 34, 'B');
      m[2].forEach((a, j) => {
        const yy = yT + 16 + j * 14 + (m[2].length === 1 ? 7 : 0);
        s += a[0] > 0 ? arrow(340, yy, 430, yy, { stroke: 'var(--blue)', sw: 2.2, dash: a[1] ? '5 4' : null }) : arrow(430, yy, 340, yy, { stroke: 'var(--green)', sw: 2.2, dash: a[1] ? '5 4' : null });
      });
      if (k === 1) s += T(385, yT + 56, 'ผลัดกันใช้', { anchor: 'middle', size: 12, fill: 'var(--muted)' });
      if (k === 2) s += T(385, yT + 56, 'พร้อมกัน', { anchor: 'middle', size: 12, fill: 'var(--muted)' });
    });
    const H = y1 + 16 + 3 * 64 + 6;
    NL_FIG('diagram', 'serial-parallel', svgDoc('serial-parallel', 480, H,
      'การส่งข้อมูลดิจิทัล: ภาพบน Parallel ส่ง 8 บิตของตัว A พร้อมกันบนสาย D0 ถึง D7 และสายนาฬิกา แต่ละเส้นมาถึงไม่พร้อมกัน (skew) ภาพกลาง Serial แบบ Asynchronous 8N1 ส่งตัว A ทีละบิต: idle 1, Start bit 0, D0 ถึง D7 = 1 0 0 0 0 0 1 0 (LSB ก่อน), Stop bit 1 ภาพล่าง ทิศทางการส่ง Simplex ทางเดียว Half-duplex สองทางทีละทาง Full-duplex สองทางพร้อมกัน', s));
  })();

  /* ---- dte-dce-console: modem link (history), console cable today, DB-9 pins + null modem, ADSL vs FTTH ---- */
  (function () {
    let s = '';
    s += T(12, 22, 'ในอดีต: ต่อคอมพิวเตอร์สองเครื่องผ่านโมเด็มและสายโทรศัพท์', { weight: 700, size: 15 });
    s += box(4, 40, 84, 46, 'คอมพิวเตอร์', 'DTE') + box(132, 40, 84, 46, 'โมเด็ม', 'DCE', 'var(--orange)') + box(264, 40, 84, 46, 'โมเด็ม', 'DCE', 'var(--orange)') + box(392, 40, 84, 46, 'คอมพิวเตอร์', 'DTE');
    s += Ln(88, 63, 132, 63, { stroke: 'var(--blue)', sw: 3 }) + Ln(348, 63, 392, 63, { stroke: 'var(--blue)', sw: 3 });
    s += Pth('M216 63 q8 -10 16 0 t16 0 t16 0', { stroke: 'var(--brown)', sw: 2.5 });
    s += T(110, 104, 'RS-232', { anchor: 'middle', size: 12, fill: 'var(--blue)', weight: 700 }) + T(370, 104, 'RS-232', { anchor: 'middle', size: 12, fill: 'var(--blue)', weight: 700 });
    s += T(240, 104, 'สายโทรศัพท์ (แอนะล็อก)', { anchor: 'middle', size: 12, fill: 'var(--brown)' });
    s += T(12, 128, 'DTE สร้างหรือใช้ข้อมูล ส่วน DCE แปลงสัญญาณและเชื่อมเข้าสู่สายสื่อสาร', { size: 13 });
    // console chain
    const y = 156;
    s += T(12, y, 'ปัจจุบัน: ต่อคอนโซลเพื่อตั้งค่า Switch/Router ครั้งแรก', { weight: 700, size: 15 });
    const chain = [
      ['โน้ตบุ๊ก', 'โปรแกรม Terminal เช่น PuTTY, Tera Term', 'ตั้ง 9600 8N1, Flow control: None'],
      ['ตัวแปลง USB-to-Serial', 'เครื่องเห็นเป็นพอร์ต COM เช่น COM3', 'ดูหมายเลขได้ใน Device Manager'],
      ['สายคอนโซล (Rollover)', 'ปลาย DB-9 ต่อตัวแปลง ปลาย RJ-45', 'ต่อพอร์ต Console (ขา 1↔8, 2↔7 ...)'],
      ['พอร์ต Console', 'ของ Switch / Router', 'รุ่นใหม่บางรุ่นมี USB console ด้วย']
    ];
    const links = ['USB', 'DB-9 (RS-232)', 'RJ-45'];
    chain.forEach((c, k) => {
      const yy = y + 16 + k * 76;
      s += box(10, yy, 168, 48, c[0], null, k === 3 ? 'var(--green)' : 'var(--blue)');
      s += T(192, yy + 20, c[1], { size: 13 }) + T(192, yy + 40, c[2], { size: 12.5, fill: 'var(--muted)' });
      if (k < 3) s += Ln(94, yy + 48, 94, yy + 76, { stroke: 'var(--ink)', sw: 2.5 }) + T(104, yy + 67, links[k], { size: 12.5, weight: 700, fill: 'var(--orange)' });
    });
    // DB-9 face + null modem
    const y2 = y + 16 + 4 * 76 + 10;
    s += T(12, y2, 'หัว DB-9 ฝั่ง DTE (ด้านหน้า)', { weight: 700, size: 14.5 });
    s += Pth(`M20 ${y2 + 18} L220 ${y2 + 18} L204 ${y2 + 78} L36 ${y2 + 78} Z`, { stroke: 'var(--ink)', sw: 2, fill: 'var(--field)' });
    const pinC = { 2: 'var(--green)', 3: 'var(--blue)', 5: 'var(--muted)' };
    for (let p = 1; p <= 5; p++) { const cx = 44 + (p - 1) * 38; s += `<circle cx="${cx}" cy="${y2 + 36}" r="7" fill="${pinC[p] || 'var(--panel)'}" stroke="var(--ink)" stroke-width="1.5"/>` + T(cx, y2 + 58, String(p), { anchor: 'middle', size: 11, mono: true }); }
    for (let p = 6; p <= 9; p++) { const cx = 63 + (p - 6) * 38; s += `<circle cx="${cx}" cy="${y2 + 66}" r="6" fill="var(--panel)" stroke="var(--ink)" stroke-width="1.5"/>`; }
    s += T(12, y2 + 104, 'ขา 2 RXD รับ · ขา 3 TXD ส่ง', { size: 13 }) + T(12, y2 + 124, 'ขา 5 GND กราวด์', { size: 13 });
    s += T(12, y2 + 146, 'มาตรฐานกำหนดลอจิก 1 = แรงดันลบ, 0 = แรงดันบวก (±3 ถึง ±15 V)', { size: 12.5, fill: 'var(--muted)' });
    // null modem
    s += T(250, y2, 'Null modem: DTE ต่อ DTE ตรง ๆ', { weight: 700, size: 14.5 });
    s += box(250, y2 + 16, 70, 70, 'DTE', 'A') + box(404, y2 + 16, 70, 70, 'DTE', 'B');
    s += T(330, y2 + 36, 'TXD', { size: 11.5, mono: true }) + T(330, y2 + 72, 'RXD', { size: 11.5, mono: true });
    s += T(396, y2 + 36, 'TXD', { size: 11.5, mono: true, anchor: 'end' }) + T(396, y2 + 72, 'RXD', { size: 11.5, mono: true, anchor: 'end' });
    s += arrow(356, y2 + 32, 372, y2 + 68, { stroke: 'var(--blue)', sw: 2 }) + arrow(372, y2 + 32, 356, y2 + 68, { stroke: 'var(--green)', sw: 2 });
    s += T(250, y2 + 104, 'ไขว้ขาส่งกับขารับ (และสายควบคุม)', { size: 12.5 });
    // ADSL vs FTTH
    const y3 = y2 + 180;
    s += T(12, y3, 'อินเทอร์เน็ตบ้าน: ในอดีต ADSL ปัจจุบัน FTTH', { weight: 700, size: 15 });
    s += T(12, y3 + 24, 'ในอดีต (ADSL ใช้คู่สายโทรศัพท์ทองแดงเดิม)', { size: 13, fill: 'var(--muted)' });
    s += box(10, y3 + 34, 118, 46, 'ADSL Router', 'มีโมเด็มในตัว', 'var(--orange)') + box(352, y3 + 34, 118, 46, 'DSLAM', 'ที่ชุมสาย', 'var(--orange)');
    s += Ln(128, y3 + 57, 352, y3 + 57, { stroke: 'var(--brown)', sw: 3 }) + R(206, y3 + 45, 70, 24, { rx: 5, fill: 'var(--panel)', stroke: 'var(--brown)', sw: 1.5 }) + T(241, y3 + 62, 'Splitter', { anchor: 'middle', size: 12 });
    s += T(240, y3 + 96, 'ดาวน์โหลดเร็วกว่าอัปโหลด (Asymmetric) ไกลชุมสายยิ่งช้า', { anchor: 'middle', size: 12.5 });
    s += T(12, y3 + 126, 'ปัจจุบัน (FTTH ใยแก้วนำแสงถึงบ้าน)', { size: 13, fill: 'var(--muted)' });
    s += box(10, y3 + 136, 118, 46, 'Wi-Fi Router', null, 'var(--blue)') + box(181, y3 + 136, 118, 46, 'ONT / ONU', 'แสง ↔ ไฟฟ้า', 'var(--green)') + box(352, y3 + 136, 118, 46, 'OLT', 'ของ ISP', 'var(--green)');
    s += Ln(128, y3 + 159, 181, y3 + 159, { stroke: 'var(--blue)', sw: 3 }) + Ln(299, y3 + 159, 352, y3 + 159, { stroke: 'var(--brown)', sw: 4 });
    s += T(154, y3 + 198, 'UTP', { anchor: 'middle', size: 12, weight: 700, fill: 'var(--blue)' }) + T(326, y3 + 198, 'ใยแก้ว', { anchor: 'middle', size: 12, weight: 700, fill: 'var(--brown)' });
    const H = y3 + 214;
    NL_FIG('diagram', 'dte-dce-console', svgDoc('dte-dce-console', 480, H,
      'อินเทอร์เฟซและโมเด็ม: ในอดีตคอมพิวเตอร์ (DTE) ต่อโมเด็ม (DCE) ด้วย RS-232 แล้วโมเด็มสองฝั่งคุยกันผ่านสายโทรศัพท์แอนะล็อก ปัจจุบันใช้พอร์ตอนุกรมเพื่อต่อคอนโซล: โน้ตบุ๊กที่รันโปรแกรม Terminal ตั้ง 9600 8N1 ต่อ USB เข้าตัวแปลง USB-to-Serial ต่อหัว DB-9 เข้าสายคอนโซลแบบ Rollover ปลาย RJ-45 เสียบพอร์ต Console ของ Switch หรือ Router หัว DB-9 ฝั่ง DTE ขา 2 RXD ขา 3 TXD ขา 5 GND สาย Null modem ไขว้ TXD กับ RXD เพื่อต่อ DTE สองเครื่องตรงกัน อินเทอร์เน็ตบ้านในอดีตใช้ ADSL บนสายโทรศัพท์ผ่าน Splitter ไป DSLAM ที่ชุมสาย ปัจจุบันใช้ FTTH: Wi-Fi Router ต่อ UTP เข้า ONT แล้วใยแก้วไปยัง OLT ของผู้ให้บริการ', s));
  })();

  /* ======================================================================
     Part 3. Widgets
     ====================================================================== */
  const CSS = `
.nlfe .nlw-btn,.nlfe select,.nlfe input[type=text],.nlfe input[type=number]{min-height:44px}
.nlfe .nlfe-panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin:8px 0}
.nlfe .nlfe-dev{border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--field);min-width:0}
.nlfe .nlfe-dev h4{margin:0 0 6px;font-size:15.5px}
.nlfe .nlfe-dev .nlfe-sel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 8px}
.nlfe .nlfe-term{font-family:"JetBrains Mono",Consolas,monospace;background:#111;color:#E8E8E8;border-radius:8px;padding:10px 12px;min-height:3.2em;white-space:pre-wrap;word-break:break-all;font-size:15px;line-height:1.45;margin:6px 0}
.nlfe .nlfe-term .nlfe-badc{color:#FF8A80;text-decoration:underline wavy}
.nlfe .nlfe-svgbox{overflow-x:auto;max-width:100%;margin:6px 0}
.nlfe .nlfe-svgbox svg{display:block;width:100%;height:auto;min-width:540px}
.nlfe .nlfe-svgbox.nlfe-fit svg{min-width:0;max-width:560px;margin:0 auto}
.nlfe .nlfe-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px;margin:8px 0}
.nlfe .nlfe-stat{background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 10px;min-width:0}
.nlfe .nlfe-stat span{display:block;font-size:13px;color:var(--muted)}
.nlfe .nlfe-stat b{font-size:17px}
.nlfe .nlfe-bits{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.nlfe .nlfe-bit{min-width:44px;min-height:44px;padding:0 4px;font-family:"JetBrains Mono",Consolas,monospace;font-size:17px;font-weight:700;border-radius:8px;border:2px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer;position:relative}
.nlfe .nlfe-bit.nlfe-chk{border-color:var(--orange);background:var(--field)}
.nlfe .nlfe-bit[aria-pressed="true"]{border-color:var(--bad);background:var(--bad);color:var(--panel)}
.nlfe .nlfe-bit small{position:absolute;top:1px;right:3px;font-size:9.5px;font-weight:400;opacity:.75}
.nlfe .nlfe-grid2d{display:grid;gap:4px;margin:6px 0;width:max-content;max-width:100%}
.nlfe .nlfe-wpre{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;line-height:1.5;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:8px 10px;white-space:pre;overflow-x:auto;margin:6px 0;max-height:360px;overflow-y:auto}
.nlfe .nlfe-wpre b{color:var(--blue)}
.nlfe .nlfe-wpre i{font-style:normal;color:var(--orange);font-weight:700}
.nlfe .nlfe-log{list-style:none;margin:6px 0;padding:0;font-size:14px;max-height:190px;overflow-y:auto;border:1px solid var(--line);border-radius:8px}
.nlfe .nlfe-log li{padding:4px 8px;border-bottom:1px solid var(--line)}
.nlfe .nlfe-log li:last-child{border-bottom:0}
.nlfe .nlfe-log .o{color:var(--ok)}.nlfe .nlfe-log .e{color:var(--bad)}.nlfe .nlfe-log .w{color:var(--orange)}
.nlfe .nlfe-ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 12px;margin:8px 0}
.nlfe .nlfe-ctl label{display:flex;flex-direction:column;gap:2px;font-size:14px;color:var(--muted);min-width:0}
.nlfe .nlfe-ctl label b{color:var(--ink)}
.nlfe .nlfe-ctl input[type=range]{min-height:44px}
.nlfe .nlfe-challenge{display:grid;gap:6px;margin:8px 0}
.nlfe .nlfe-challenge div{display:flex;gap:8px;align-items:flex-start;font-size:14.5px}
.nlfe .nlfe-challenge .nlw-chip{flex:none;white-space:nowrap}
.nlfe .nlfe-cmp{border-collapse:collapse;width:100%;font-size:14px;margin:6px 0}
.nlfe .nlfe-cmp th,.nlfe .nlfe-cmp td{border-bottom:1px solid var(--line);padding:4px 6px;text-align:left}
.nlfe .nlfe-sub{border-top:1px dashed var(--line);margin-top:14px;padding-top:10px}
`;
  function feCSS() {
    if (!document.getElementById('nl-widget-css')) {
      const base = window.NL_WIDGETS && window.NL_WIDGETS['caesar'];
      if (typeof base === 'function') { try { base(document.createElement('div')); } catch (e) { /* base styles optional */ } }
    }
    if (document.getElementById('nlfe-css')) return;
    const st = document.createElement('style'); st.id = 'nlfe-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  const KEEP = { value: 1, checked: 1, disabled: 1, selected: 1 };
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'style') e.style.cssText = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (KEEP[k]) e[k] = v; else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) addc(e, arguments[i]);
    return e;
  }
  function addc(e, c) { if (c == null || c === false) return; if (Array.isArray(c)) { c.forEach(x => addc(e, x)); return; } e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); }
  function frame(root, cls, title, instr) {
    feCSS(); root.replaceChildren(); root.classList.add('nlw', 'nlfe', cls);
    root.appendChild(h('div', { class: 'nlw-title' }, title));
    root.appendChild(h('p', { class: 'nlw-instr' }, h('b', null, 'คำแนะนำการใช้งาน: '), instr));
  }
  function seg(opts, val, onChange, label) {
    const wrap = h('div', { class: 'nlw-seg', role: 'group', 'aria-label': label });
    const btns = opts.map(o => h('button', { type: 'button', class: 'nlw-btn', 'data-v': String(o[0]), 'aria-pressed': String(o[0] === val), onclick: () => { set(o[0]); onChange(o[0]); } }, o[1]));
    function set(v) { btns.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === String(v)))); }
    btns.forEach(b => wrap.appendChild(b));
    return { el: wrap, set };
  }
  function select(label, opts, val, onChange) {
    const s = h('select', { 'aria-label': label, onchange: e => onChange(e.target.value) }, opts.map(o => h('option', { value: String(o[0]), selected: String(o[0]) === String(val) }, o[1])));
    return { el: h('label', { class: 'nlw-field' }, h('span', null, label), s), sel: s, set: v => { s.value = String(v); } };
  }
  function stat(label, value, cls) { return h('div', { class: 'nlfe-stat' }, h('span', null, label), h('b', { class: cls || null }, value)); }
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  let ARQ_UID = 0;
  const hex2 = b => b.toString(16).toUpperCase().padStart(2, '0');
  const hex4 = w => w.toString(16).toUpperCase().padStart(4, '0');
  const bin16 = w => w.toString(2).padStart(16, '0');

  /* ----------------------------------------------------------------------
     Widget 1: serial-terminal (UART framing + receiver sampling + parallel skew)
     ---------------------------------------------------------------------- */
  NL_FIG('widget', 'serial-terminal', function (root) {
    frame(root, 'nlfe-uart', 'จำลองการสื่อสารผ่านพอร์ตอนุกรม (Terminal ↔ Console port)',
      'ตั้งค่าพอร์ตของแต่ละฝั่ง (Baud rate, Data bits, Parity, Stop bits) แล้วพิมพ์ข้อความ ตัวส่งจะแบ่งข้อความเป็นเฟรมทีละบิตจริง ส่วนตัวรับจะสุ่มอ่านสัญญาณตามค่าของตัวเอง ถ้าค่าไม่ตรงกันจะได้ตัวอักษรเพี้ยนหรือ Framing/Parity error เป้าหมาย: ตั้งให้ทั้งสองฝั่งเป็น 9600 8N1 ซึ่งเป็นค่าคอนโซลมาตรฐานของ Switch/Router');
    const BAUDS = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];
    const st = { pc: { baud: 115200, data: 8, parity: 'N', stop: 1 }, sw: { baud: 9600, data: 8, parity: 'N', stop: 1 }, dir: 'pc2sw', msg: 'enable', ci: 0 };
    const name = { pc: 'PC (โปรแกรม Terminal)', sw: 'Switch (พอร์ต Console)' };
    const fmt = c => `${c.baud} ${c.data}${c.parity}${c.stop}`;
    function devPanel(key) {
      const c = st[key];
      const up = (f, conv) => v => { st[key][f] = conv(v); st.ci = 0; render(); };
      return h('div', { class: 'nlfe-dev' }, h('h4', null, name[key]),
        h('div', { class: 'nlfe-sel' },
          select('Baud rate (bit/s)', BAUDS.map(b => [b, String(b)]), c.baud, up('baud', Number)).el,
          select('Data bits', [5, 6, 7, 8].map(b => [b, String(b)]), c.data, up('data', Number)).el,
          select('Parity', [['N', 'None (N)'], ['E', 'Even (E)'], ['O', 'Odd (O)']], c.parity, up('parity', String)).el,
          select('Stop bits', [[1, '1'], [2, '2']], c.stop, up('stop', Number)).el),
        h('div', { class: 'nlw-small', style: 'margin-top:6px' }, 'ค่าปัจจุบัน: ', h('b', { class: 'nlw-mono' }, fmt(c))));
    }
    const panels = h('div', { class: 'nlfe-panels' }, devPanel('pc'), devPanel('sw'));
    const segDir = seg([['pc2sw', 'PC → Switch'], ['sw2pc', 'Switch → PC']], st.dir, v => { st.dir = v; st.ci = 0; render(); }, 'ทิศทางการส่ง');
    const inp = h('input', { type: 'text', value: st.msg, maxlength: '24', 'aria-label': 'ข้อความที่จะส่ง', style: 'width:100%', oninput: e => { st.msg = e.target.value; st.ci = 0; render(); } });
    const bFix = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { st.pc = { baud: 9600, data: 8, parity: 'N', stop: 1 }; panels.replaceChildren(devPanel('pc'), devPanel('sw')); render(); } }, 'ตั้ง PC เป็น 9600 8N1');
    const out = h('div', { 'aria-live': 'polite' });
    const timeline = h('div');
    root.appendChild(panels);
    root.appendChild(h('div', { class: 'nlw-row nlw-center' }, segDir.el));
    root.appendChild(h('div', { class: 'nlw-row nlw-center' }, h('label', { class: 'nlw-field', style: 'flex:1 1 220px' }, h('span', null, 'ข้อความที่ส่ง (สูงสุด 24 ไบต์)'), inp), bFix));
    root.appendChild(out);
    root.appendChild(timeline);
    const par = h('div', { class: 'nlfe-sub' });
    root.appendChild(par);

    function render() {
      const tx = st.dir === 'pc2sw' ? st.pc : st.sw, rx = st.dir === 'pc2sw' ? st.sw : st.pc;
      const txN = st.dir === 'pc2sw' ? 'PC' : 'Switch', rxN = st.dir === 'pc2sw' ? 'Switch' : 'PC';
      const bytes = utf8(st.msg).slice(0, 24);
      const res = uartRun(bytes, tx, rx);
      const got = res.frames.filter(f => !f.falseStart);
      const goal = ['pc', 'sw'].every(k => st[k].baud === 9600 && st[k].data === 8 && st[k].parity === 'N' && st[k].stop === 1);
      const diffs = [];
      if (tx.baud !== rx.baud) diffs.push(`Baud rate ไม่ตรง (${txN} ${tx.baud}, ${rxN} ${rx.baud}) ตัวรับอ่านบิตเร็วหรือช้ากว่าจริง ${(tx.baud / rx.baud).toFixed(2)} เท่า จุดอ่านจึงคลาดไปเรื่อย ๆ`);
      if (tx.data !== rx.data) diffs.push(`Data bits ไม่ตรง (${tx.data} กับ ${rx.data}) ตัวรับนับบิตข้อมูลผิดจำนวน`);
      if (tx.parity !== rx.parity) diffs.push(`Parity ไม่ตรง (${tx.parity} กับ ${rx.parity}) ตัวรับอาจอ่านบิต Parity เป็นข้อมูล หรืออ่านบิตอื่นเป็น Parity`);
      if (tx.stop !== rx.stop) diffs.push(`Stop bits ไม่ตรง (${tx.stop} กับ ${rx.stop}) ส่วนนี้มักไม่ทำให้ข้อมูลเพี้ยน เพราะตัวรับตรวจเฉพาะ Stop bit แรก`);
      const shown = got.map(f => termChar(f.value));
      const term = h('div', { class: 'nlfe-term', role: 'img', 'aria-label': 'หน้าจอฝั่ง ' + rxN + ' แสดง: ' + shown.join('') },
        got.length ? got.map(f => h('span', { class: f.framingErr || f.parityErr ? 'nlfe-badc' : null }, termChar(f.value))) : h('span', { style: 'opacity:.6' }, '(ไม่ได้รับตัวอักษรใดเลย)'));
      const verdict = res.ok && bytes.length
        ? (goal ? 'สำเร็จ: ทั้งสองฝั่งเป็น 9600 8N1 ตรงกับค่าคอนโซลมาตรฐาน ข้อความถึงครบทุกตัว' : 'ข้อความถึงถูกต้องเพราะค่าทั้งสองฝั่งตรงกัน แต่คอนโซลของ Switch/Router จริงใช้ 9600 8N1 ลองตั้งให้ตรงค่านี้')
        : (bytes.length ? 'ข้อความเพี้ยน: ค่าของสองฝั่งไม่ตรงกัน' : 'พิมพ์ข้อความก่อน');
      out.replaceChildren(
        h('div', { class: 'nlw-small' }, `ส่ง ${bytes.length} ไบต์ (${bytes.map(hex2).join(' ')}) จาก ${txN} ที่ ${fmt(tx)} ไปยัง ${rxN} ที่ ${fmt(rx)}`),
        h('div', { class: 'nlw-small', style: 'margin-top:4px' }, `หน้าจอ/อินพุตของ ${rxN}:`), term,
        h('div', { class: 'nlfe-stats' },
          stat('ไบต์ที่รับได้', `${got.length} (ส่ง ${bytes.length})`, got.length === bytes.length ? 'nlw-ok' : 'nlw-bad'),
          stat('Framing error', String(res.framingErrors), res.framingErrors ? 'nlw-bad' : 'nlw-ok'),
          stat('Parity error', rx.parity === 'N' ? 'ไม่ตรวจ' : String(res.parityErrors), res.parityErrors ? 'nlw-bad' : null),
          stat('เริ่มผิดจังหวะ (false start)', String(res.frames.length - got.length))),
        h('div', { class: 'nlw-small' }, 'ค่าที่ตัวรับอ่านได้ (hex): ' + (got.map(f => hex2(f.value)).join(' ') || '-')),
        h('div', { class: 'nlw-result ' + (res.ok && goal ? 'nlw-is-ok' : res.ok ? 'nlw-is-warn' : 'nlw-is-bad') }, verdict),
        diffs.length ? h('ul', { class: 'nlw-list nlw-small' }, diffs.map(d => h('li', null, d))) : null);
      drawTimeline(bytes, res, tx, rx, txN, rxN);
    }

    function drawTimeline(bytes, res, tx, rx, txN, rxN) {
      if (!bytes.length) { timeline.replaceChildren(); return; }
      st.ci = Math.max(0, Math.min(bytes.length - 1, st.ci));
      const segs = res.enc.segs.filter(s => s.ci === st.ci);
      const tA = segs[0].t0 - res.enc.tb, tB0 = segs[segs.length - 1].t1 + res.enc.tb;
      const rxTb = 1 / rx.baud;
      const span = Math.max(tB0 - tA, 13 * rxTb * 0.6);
      const tB = tA + span;
      const W = 640, X0 = 70, X1 = 630, x = t => X0 + (t - tA) / (tB - tA) * (X1 - X0);
      const yH = 64, yL = 104;
      const roleCol = { start: 'var(--orange)', data: 'var(--blue)', parity: 'var(--brown)', stop: 'var(--green)' };
      const roleLbl = (b) => b.role === 'start' ? 'S' : b.role === 'data' ? 'D' + b.i : b.role === 'parity' ? 'P' : 'T';
      let s = `<svg viewBox="0 0 ${W} 250" xmlns="http://www.w3.org/2000/svg" font-family="inherit">`;
      s += T(4, 22, `ตัวส่ง ${txN}`, { size: 14, weight: 700 }) + T(4, 40, fmt(tx), { size: 12.5, mono: true, fill: 'var(--muted)' });
      // sender cells and waveform
      const all = res.enc.segs.filter(q => q.t1 > tA && q.t0 < tB);
      all.forEach(q => {
        const a = Math.max(x(q.t0), X0), b = Math.min(x(q.t1), X1);
        s += R(a, yH - 8, b - a, yL - yH + 16, { fill: roleCol[q.role], fo: q.ci === st.ci ? 0.16 : 0.06, stroke: 'var(--line)', sw: 0.6 });
        if (q.ci === st.ci && b - a > 18) s += T((a + b) / 2, yL + 24, roleLbl(q), { size: 12, anchor: 'middle', mono: true, fill: roleCol[q.role] }) + T((a + b) / 2, yH - 13, String(q.v), { size: 13, anchor: 'middle', mono: true, weight: 700 });
      });
      // waveform path sampled at segment boundaries
      const pts = [tA]; res.enc.segs.forEach(q => { if (q.t0 > tA && q.t0 < tB) pts.push(q.t0); if (q.t1 > tA && q.t1 < tB) pts.push(q.t1); }); pts.push(tB);
      pts.sort((a, b) => a - b);
      let prevY = null, d = '';
      pts.forEach((t, k) => {
        if (k === pts.length - 1) return;
        const yv = lineLevel(res.enc.segs, (t + pts[k + 1]) / 2) ? yH : yL;
        if (prevY == null) d = `M${r1(x(t))} ${yv}`; else if (prevY !== yv) d += `L${r1(x(t))} ${yv}`;
        d += `L${r1(x(pts[k + 1]))} ${yv}`; prevY = yv;
      });
      s += Pth(d, { stroke: 'var(--ink)', sw: 2.5 });
      s += T(X0 - 6, yH + 4, '1', { size: 11, anchor: 'end', mono: true, fill: 'var(--muted)' }) + T(X0 - 6, yL + 4, '0', { size: 11, anchor: 'end', mono: true, fill: 'var(--muted)' });
      // receiver sampling
      const yR = 176;
      s += T(4, yR - 10, `ตัวรับ ${rxN}`, { size: 14, weight: 700 }) + T(4, yR + 8, fmt(rx), { size: 12.5, mono: true, fill: 'var(--muted)' });
      s += Ln(X0, yR, X1, yR, { stroke: 'var(--line)', sw: 1 });
      res.frames.forEach(f => {
        f.samples.forEach(sm => {
          if (sm.t < tA || sm.t > tB) return;
          const px = x(sm.t), bad = (sm.role === 'stop' && sm.v !== 1) || (sm.role === 'parity' && f.parityErr) || f.falseStart;
          s += Ln(px, yH - 6, px, yR - 12, { stroke: bad ? 'var(--bad)' : 'var(--muted)', sw: 1, dash: '2 3' });
          s += `<circle cx="${r1(px)}" cy="${yR}" r="11" fill="var(--panel)" stroke="${bad ? 'var(--bad)' : roleCol[sm.role]}" stroke-width="2"/>`;
          s += T(px, yR + 4.5, String(sm.v), { size: 12.5, anchor: 'middle', mono: true, weight: 700 });
          s += T(px, yR + 28, sm.role === 'start' ? 'S' : sm.role === 'data' ? 'D' + sm.i : sm.role === 'parity' ? 'P' : 'T', { size: 11, anchor: 'middle', mono: true, fill: bad ? 'var(--bad)' : 'var(--muted)' });
        });
      });
      s += T(X0, 238, 'วงกลม = จุดที่ตัวรับสุ่มอ่าน (กลางบิตตามจังหวะของตัวรับ) สีแดง = อ่านแล้วผิดรูปแบบ', { size: 12, fill: 'var(--muted)' });
      s += '</svg>';
      const ch = bytes[st.ci];
      timeline.replaceChildren(
        h('div', { class: 'nlw-row nlw-center' },
          h('button', { type: 'button', class: 'nlw-btn', disabled: st.ci === 0, onclick: () => { st.ci--; render(); }, 'aria-label': 'ตัวอักษรก่อนหน้า' }, '◀ ก่อนหน้า'),
          h('span', { class: 'nlw-small', 'aria-live': 'polite' }, `ไบต์ที่ ${st.ci + 1}/${bytes.length}: ${termChar(ch)} = 0x${hex2(ch)} = ${ch.toString(2).padStart(8, '0')} (ส่ง LSB ก่อน)`),
          h('button', { type: 'button', class: 'nlw-btn', disabled: st.ci >= bytes.length - 1, onclick: () => { st.ci++; render(); }, 'aria-label': 'ตัวอักษรถัดไป' }, 'ถัดไป ▶')),
        h('div', { class: 'nlfe-svgbox', role: 'img', 'aria-label': `แผนภาพเวลาของไบต์ที่ ${st.ci + 1}: บนคือสัญญาณที่ตัวส่งส่ง ล่างคือค่าที่ตัวรับอ่านได้ในแต่ละจุด`, html: null }));
      timeline.lastChild.innerHTML = s;
    }

    // parallel vs serial for one byte
    const pst = { byte: 0x41, mhz: 100, skew: 2 };
    const parOut = h('div', { 'aria-live': 'polite' });
    const rClock = h('input', { type: 'range', min: '10', max: '500', step: '10', value: String(pst.mhz), 'aria-label': 'ความถี่สัญญาณนาฬิกา (MHz)', oninput: e => { pst.mhz = Number(e.target.value); renderPar(); } });
    const rSkew = h('input', { type: 'range', min: '0', max: '5', step: '0.5', value: String(pst.skew), 'aria-label': 'Skew สูงสุดระหว่างสาย (ns)', oninput: e => { pst.skew = Number(e.target.value); renderPar(); } });
    const lClock = h('b'), lSkew = h('b');
    par.appendChild(h('div', { class: 'nlw-title', style: 'font-size:16.5px' }, 'เทียบ Parallel กับ Serial สำหรับ 1 ไบต์'));
    par.appendChild(h('p', { class: 'nlw-small' }, 'Parallel ส่ง 8 บิตพร้อมกันบน 8 สาย ผู้รับอ่านทุกสายพร้อมกันที่กลางคาบนาฬิกา ถ้าบางสายช้ากว่า (Skew) เกินครึ่งคาบ ผู้รับจะยังเห็นค่าของไบต์ก่อนหน้าในสายนั้น ในที่นี้ส่ง 0x41 (ตัว A) ต่อจากไบต์ 0xBE ซึ่งทุกบิตตรงข้ามกัน ลองเพิ่มความถี่หรือ Skew'));
    par.appendChild(h('div', { class: 'nlfe-ctl' },
      h('label', null, h('span', null, 'ความถี่นาฬิกา: ', lClock), rClock),
      h('label', null, h('span', null, 'Skew สูงสุด: ', lSkew), rSkew)));
    par.appendChild(parOut);
    function renderPar() {
      lClock.textContent = pst.mhz + ' MHz'; lSkew.textContent = pst.skew + ' ns';
      const prev = (~pst.byte) & 0xFF, p = parallelSample(pst.byte, prev, pst.mhz, pst.skew);
      const serialNs = 10 * p.T;
      parOut.replaceChildren(
        h('div', { class: 'nlw-scroll' }, h('table', { class: 'nlw-table' },
          h('thead', null, h('tr', null, h('th', null, 'สาย'), h('th', null, 'บิตที่ส่ง'), h('th', null, 'มาถึงช้า (ns)'), h('th', null, 'ผู้รับอ่านได้'))),
          h('tbody', null, p.wires.map(w => h('tr', null, h('td', { class: 'nlw-mono' }, 'D' + w.i), h('td', { class: 'nlw-mono' }, String(w.bit)), h('td', null, w.delay.toFixed(2) + (w.late ? ' > ' + p.at.toFixed(2) : '')), h('td', { class: 'nlw-mono ' + (w.got === w.bit ? 'nlw-ok' : 'nlw-bad') }, String(w.got) + (w.got === w.bit ? '' : ' ผิด'))))))),
        h('div', { class: 'nlw-result ' + (p.ok ? 'nlw-is-ok' : 'nlw-is-bad') },
          `Parallel: คาบนาฬิกา ${p.T.toFixed(2)} ns อ่านที่ ${p.at.toFixed(2)} ns ได้ 0x${hex2(p.got)} ${p.ok ? 'ถูกต้อง' : 'ผิด (ควรเป็น 0x41)'} ใช้ 1 คาบต่อไบต์ ความถี่สูงสุดที่ยังปลอดภัยกับ Skew นี้ ≈ ${isFinite(p.maxClockMHz) ? Math.floor(p.maxClockMHz) + ' MHz' : 'ไม่จำกัดโดย Skew'}`),
        h('div', { class: 'nlw-box' }, `Serial แบบ Asynchronous 8N1 ที่อัตราบิตเท่ากัน (${pst.mhz} Mbit/s) ใช้สายเดียว 10 บิตต่อไบต์ = ${serialNs.toFixed(1)} ns ต่อไบต์ ช้ากว่าต่อรอบนาฬิกา แต่ไม่มีปัญหา Skew ระหว่างสาย จึงเร่งอัตราบิตต่อสายให้สูงมากได้ ลิงก์ Serial ความเร็วสูงสมัยใหม่ (USB, SATA, PCIe, Ethernet) ฝังจังหวะนาฬิกาไว้ในสัญญาณและส่งได้หลายพันล้านบิตต่อวินาทีต่อเลน`));
    }
    render(); renderPar();
  });

  /* ----------------------------------------------------------------------
     Widget 2: error-lab (parity, 2-D parity, CRC long division, Internet checksum)
     ---------------------------------------------------------------------- */
  NL_FIG('widget', 'error-lab', function (root) {
    frame(root, 'nlfe-err', 'ห้องทดลองการตรวจจับข้อผิดพลาด',
      'เลือกวิธีตรวจ ใส่ข้อมูล (หรือกดสุ่ม) ดูการคำนวณของผู้ส่ง แล้วกดบิตในช่อง "ระหว่างทาง" เพื่อพลิกบิตให้เสีย ผู้รับจะคำนวณตรวจจริงและบอกว่าตรวจพบหรือหลุดไป ลองทำโจทย์ลองคิดด้านล่าง');
    const GENS = [['1011', 'CRC-3: x³+x+1 (1011)'], ['10011', 'CRC-4: x⁴+x+1 (10011)'], ['100000111', 'CRC-8: x⁸+x²+x+1 (100000111)']];
    const st = { mode: 'even', data: '1101011011', gen: '10011', words: '4500 001C 1C46', flips: new Set(), rngN: 7, done: {} };
    const rng = mkRng(20261013);
    const segMode = seg([['even', 'Parity คู่'], ['odd', 'Parity คี่'], ['p2d', 'Parity 2 มิติ'], ['crc', 'CRC'], ['sum', 'Internet Checksum']], st.mode, v => { st.mode = v; st.flips.clear(); render(); }, 'วิธีตรวจจับข้อผิดพลาด');
    const inData = h('input', { type: 'text', value: st.data, 'aria-label': 'บิตข้อมูล (0/1 ไม่เกิน 24 บิต)', class: 'nlw-mono', style: 'width:100%', oninput: e => { st.data = e.target.value.replace(/\s/g, ''); st.flips.clear(); render(); } });
    const inWords = h('input', { type: 'text', value: st.words, 'aria-label': 'คำ 16 บิตเป็นเลขฐาน 16 คั่นด้วยช่องว่าง (2 ถึง 4 คำ)', class: 'nlw-mono', style: 'width:100%', oninput: e => { st.words = e.target.value; st.flips.clear(); render(); } });
    const selGen = select('ตัวหาร (Generator)', GENS, st.gen, v => { st.gen = v; st.flips.clear(); render(); });
    const bRand = h('button', { type: 'button', class: 'nlw-btn', onclick: () => {
      if (st.mode === 'sum') { const n = 3; const w = []; for (let i = 0; i < n; i++) w.push(hex4(Math.floor(rng() * 65536))); st.words = w.join(' '); inWords.value = st.words; }
      else { let s = ''; const n = 8 + Math.floor(rng() * 5); for (let i = 0; i < n; i++) s += rng() < 0.5 ? '0' : '1'; st.data = s; inData.value = s; }
      st.flips.clear(); render();
    } }, 'สุ่มข้อมูล');
    const rowData = h('div', { class: 'nlw-row' }, h('label', { class: 'nlw-field', style: 'flex:1 1 220px' }, h('span', null, 'บิตข้อมูล (0/1 ไม่เกิน 24 บิต)'), inData));
    const rowWords = h('div', { class: 'nlw-row' }, h('label', { class: 'nlw-field', style: 'flex:1 1 220px' }, h('span', null, 'คำ 16 บิต (hex, 2–4 คำ)'), inWords));
    const rowGen = h('div', { class: 'nlw-row' }, selGen.el);
    const senderBox = h('div'), transitBox = h('div'), recvBox = h('div', { 'aria-live': 'polite' }), chBox = h('div');
    const burstSel = select('ความยาว Burst', [2, 3, 4, 5, 6, 8].map(n => [n, n + ' บิต']), 3, v => { st.burst = Number(v); });
    st.burst = 3;
    root.appendChild(segMode.el);
    root.appendChild(rowData); root.appendChild(rowWords); root.appendChild(rowGen);
    root.appendChild(h('div', { class: 'nlw-row' }, bRand));
    root.appendChild(h('div', { class: 'nlw-title', style: 'font-size:16px;margin-top:10px' }, '1) ผู้ส่งคำนวณ'));
    root.appendChild(senderBox);
    root.appendChild(h('div', { class: 'nlw-title', style: 'font-size:16px;margin-top:10px' }, '2) ระหว่างทาง: กดบิตเพื่อพลิก (0↔1)'));
    root.appendChild(transitBox);
    root.appendChild(h('div', { class: 'nlw-row nlw-center' },
      h('button', { type: 'button', class: 'nlw-btn', onclick: () => { const L = cw().length; st.flips = new Set([Math.floor(rng() * L)]); render(); } }, 'พลิก 1 บิตแบบสุ่ม'),
      burstSel.el,
      h('button', { type: 'button', class: 'nlw-btn', onclick: () => { const L = cw().length, b = Math.min(st.burst, L), p0 = Math.floor(rng() * (L - b + 1)); st.flips = new Set(); for (let i = 0; i < b; i++) st.flips.add(p0 + i); render(); } }, 'สร้าง Burst error'),
      h('button', { type: 'button', class: 'nlw-btn', onclick: () => { st.flips.clear(); render(); } }, 'ล้างการพลิก')));
    root.appendChild(h('div', { class: 'nlw-title', style: 'font-size:16px;margin-top:10px' }, '3) ผู้รับตรวจ'));
    root.appendChild(recvBox);
    root.appendChild(h('div', { class: 'nlfe-sub' }, h('div', { class: 'nlw-title', style: 'font-size:16px' }, 'โจทย์ลองคิด'), chBox));

    let C = null; // current computation
    function dataBits() { return /^[01]{1,24}$/.test(st.data) ? bitsOf(st.data) : null; }
    function words() { const w = st.words.trim().split(/[\s,]+/).filter(Boolean); if (w.length < 2 || w.length > 4 || !w.every(x => /^[0-9a-fA-F]{1,4}$/.test(x))) return null; return w.map(x => parseInt(x, 16)); }
    function cw() { return C ? C.code : []; }
    function compute() {
      const m = st.mode;
      if (m === 'sum') {
        const w = words(); if (!w) return null;
        const ck = inetChecksum(w);
        const code = []; w.concat([ck.checksum]).forEach(x => { for (let i = 15; i >= 0; i--) code.push((x >> i) & 1); });
        return { m, w, ck, code, nData: w.length * 16 };
      }
      const d = dataBits(); if (!d) return null;
      if (m === 'even' || m === 'odd') { const p = parityBit(d, m === 'even' ? 'E' : 'O'); return { m, d, p, code: d.concat(p), nData: d.length }; }
      if (m === 'p2d') { const e = parity2dEncode(d, 4); return { m, d, e, code: e.flat, nData: null }; }
      const g = bitsOf(st.gen), e = crcEncode(d, g); return { m, d, g, e, code: e.codeword, nData: d.length };
    }
    function received() { return C.code.map((b, i) => st.flips.has(i) ? 1 - b : b); }
    function isCheckBit(i) {
      if (C.m === 'p2d') { const W = C.e.width; return i % W === W - 1 || i >= C.code.length - W; }
      return i >= C.nData;
    }
    function divisionText(steps, startBits, r) {
      const lines = [], L = startBits.length;
      const fmtRow = (arr, from) => arr.map((b, i) => (i >= from && i < from + r + 1) ? `<b>${b}</b>` : String(b)).join('');
      lines.push(`       ${startBits.join('')}`);
      steps.forEach(sp => {
        lines.push(`XOR    ${' '.repeat(sp.pos)}<i>${(C.g || []).join('')}</i>`);
        lines.push(`=      ${fmtRow(sp.after, sp.pos)}`);
      });
      const w = steps.length ? steps[steps.length - 1].after : startBits;
      lines.push(`rem    ${' '.repeat(L - r)}<i>${w.slice(L - r).join('')}</i>`);
      return lines.join('\n');
    }
    function render() {
      rowData.style.display = st.mode === 'sum' ? 'none' : ''; rowWords.style.display = st.mode !== 'sum' ? 'none' : ''; rowGen.style.display = st.mode !== 'crc' ? 'none' : '';
      inData.classList.toggle('nlw-invalid', st.mode !== 'sum' && !dataBits());
      inWords.classList.toggle('nlw-invalid', st.mode === 'sum' && !words());
      C = compute();
      if (!C) { senderBox.replaceChildren(h('div', { class: 'nlw-result nlw-is-bad' }, st.mode === 'sum' ? 'ใส่คำ 16 บิตเป็นเลขฐาน 16 จำนวน 2–4 คำ เช่น 4500 001C 1C46' : 'ใส่บิตข้อมูลเป็น 0 และ 1 ยาว 1–24 บิต')); transitBox.replaceChildren(); recvBox.replaceChildren(); renderCh(null); return; }
      [...st.flips].forEach(i => { if (i >= C.code.length) st.flips.delete(i); });
      // sender
      let sendEl;
      if (C.m === 'even' || C.m === 'odd') {
        const ones = sum(C.d);
        sendEl = h('div', { class: 'nlw-box' }, `ข้อมูล ${C.d.join('')} มีเลข 1 จำนวน ${ones} ตัว ใช้ Parity ${C.m === 'even' ? 'คู่ (Even)' : 'คี่ (Odd)'} จึงเติมบิต Parity = ${C.p} ให้จำนวน 1 ทั้งหมดเป็น${C.m === 'even' ? 'เลขคู่' : 'เลขคี่'} (${ones + C.p} ตัว) ส่ง ${C.code.join('')}`);
      } else if (C.m === 'p2d') {
        sendEl = h('div', { class: 'nlw-box' }, `เรียงข้อมูลเป็นแถวละ 4 บิต${C.e.padded ? ` (เติม 0 ท้าย ${C.e.padded} บิตให้ครบแถว)` : ''} เติม Parity คู่ท้ายทุกแถว แล้วเพิ่มแถวสุดท้ายเป็น Parity คู่ของแต่ละคอลัมน์ รวมส่ง ${C.code.length} บิต (ช่องขอบสีส้ม = บิตตรวจสอบ)`);
      } else if (C.m === 'crc') {
        const r = C.g.length - 1;
        const pre = h('div', { class: 'nlfe-wpre' }); pre.innerHTML = divisionText(C.e.steps, C.e.dividend, r);
        sendEl = h('div', null, h('div', { class: 'nlw-box' }, `Generator ${C.g.join('')} มีดีกรี ${r} จึงต่อ 0 ท้ายข้อมูล ${r} ตัว แล้วหารแบบ Modulo-2 (ลบด้วย XOR ไม่มีการยืม) ทุกครั้งที่บิตซ้ายสุดของส่วนที่เหลือเป็น 1 ให้ XOR ด้วย Generator`), pre,
          h('div', { class: 'nlw-box' }, `เศษ ${C.e.remainder.join('')} คือ CRC ผู้ส่งต่อท้ายข้อมูล ได้ ${C.d.join('')} ${C.e.remainder.join('')} (${C.code.length} บิต)`));
      } else {
        const lines = [];
        C.ck.steps.forEach((sp, k) => { lines.push(`${k ? '+ ' : '  '}${hex4(sp.w)}  =>  ${hex4(sp.after)}${sp.carry ? '  (มีตัวทด บวกวนกลับ +1)' : ''}`); });
        lines.push(`ผลรวม = ${hex4(C.ck.sum)} = ${bin16(C.ck.sum)}`);
        lines.push(`กลับบิต (One's complement) = <i>${hex4(C.ck.checksum)}</i> = ${bin16(C.ck.checksum)}`);
        const pre = h('div', { class: 'nlfe-wpre' }); pre.innerHTML = lines.join('\n');
        sendEl = h('div', null, h('div', { class: 'nlw-box' }, 'บวกคำ 16 บิตทีละคำแบบ One\'s complement (ถ้าเกิน 16 บิต ให้นำตัวทดมาบวกกลับเข้าบิตต่ำสุด) แล้วกลับบิตผลรวมเป็น Checksum'), pre);
      }
      senderBox.replaceChildren(sendEl);
      // transit
      const btn = i => h('button', { type: 'button', class: 'nlfe-bit' + (isCheckBit(i) ? ' nlfe-chk' : ''), 'aria-pressed': String(st.flips.has(i)), 'aria-label': `บิตที่ ${i + 1}${isCheckBit(i) ? ' (บิตตรวจสอบ)' : ''} ค่า ${received()[i]}`, onclick: () => { if (st.flips.has(i)) st.flips.delete(i); else st.flips.add(i); render(); const b = transitBox.querySelector(`[data-i="${i}"]`); if (b) b.focus(); }, 'data-i': String(i) }, String(received()[i]), h('small', null, String(i + 1)));
      if (C.m === 'p2d') {
        const W = C.e.width;
        transitBox.replaceChildren(h('div', { class: 'nlfe-grid2d', style: `grid-template-columns:repeat(${W},44px)` }, C.code.map((_, i) => btn(i))));
      } else if (C.m === 'sum') {
        const rows = []; for (let w = 0; w < C.code.length / 16; w++) rows.push(h('div', null, h('div', { class: 'nlw-small' }, w < C.w.length ? `คำที่ ${w + 1}` : 'Checksum'), h('div', { class: 'nlfe-bits' }, Array.from({ length: 16 }, (_, k) => btn(w * 16 + k)))));
        transitBox.replaceChildren(...rows);
      } else transitBox.replaceChildren(h('div', { class: 'nlfe-bits' }, C.code.map((_, i) => btn(i))));
      // receiver
      const rcv = received(), nf = st.flips.size;
      const pos = [...st.flips].sort((a, b) => a - b);
      const burstLen = nf ? pos[pos.length - 1] - pos[0] + 1 : 0;
      let pass, detail = [], fix = null;
      if (C.m === 'even' || C.m === 'odd') {
        const ones = sum(rcv); pass = C.m === 'even' ? ones % 2 === 0 : ones % 2 === 1;
        detail.push(h('div', { class: 'nlw-box' }, `ผู้รับนับเลข 1 ใน ${rcv.join('')} ได้ ${ones} ตัว ซึ่งเป็นเลข${ones % 2 ? 'คี่' : 'คู่'} ${pass ? 'ตรงกับที่ตกลงไว้' : 'ไม่ตรงกับที่ตกลงไว้'}`));
      } else if (C.m === 'p2d') {
        const r = parity2dCheck(rcv, C.e.width); pass = r.ok; fix = r.fix;
        detail.push(h('div', { class: 'nlw-box' }, `แถวที่ Parity ผิด: ${r.badRows.map(x => x + 1).join(', ') || 'ไม่มี'} · คอลัมน์ที่ Parity ผิด: ${r.badCols.map(x => x + 1).join(', ') || 'ไม่มี'}` + (fix ? ` → ชี้ตำแหน่งได้ว่าบิตแถว ${fix.r + 1} คอลัมน์ ${fix.c + 1} เสีย แก้ไขได้โดยกลับบิตนั้น` : (!r.ok ? ' → ตรวจพบ แต่ระบุตำแหน่งไม่ได้แน่ชัด' : ''))));
      } else if (C.m === 'crc') {
        const r = crcCheck(rcv, C.g); pass = r.ok;
        const pre = h('div', { class: 'nlfe-wpre' }); pre.innerHTML = divisionText(r.steps, rcv, C.g.length - 1);
        detail.push(h('div', { class: 'nlw-box' }, `ผู้รับนำทั้งเฟรมที่ได้รับ (ข้อมูล + CRC) มาหารด้วย ${C.g.join('')} เศษ = ${r.remainder.join('')} ${pass ? '(ศูนย์ทั้งหมด จึงถือว่าถูกต้อง)' : '(ไม่เป็นศูนย์ แปลว่ามีบิตเสีย)'}`), pre);
      } else {
        const ws = []; for (let i = 0; i < rcv.length; i += 16) ws.push(parseInt(rcv.slice(i, i + 16).join(''), 2));
        const r = inetVerify(ws); pass = r.ok;
        detail.push(h('div', { class: 'nlw-box nlw-mono' }, `${ws.map(hex4).join(' + ')} = ${hex4(r.sum)} ${pass ? '= FFFF ถูกต้อง' : '≠ FFFF ผิด'}`));
      }
      const truth = nf === 0 ? 'ไม่มีบิตเสียจริง' : `จริง ๆ มีบิตเสีย ${nf} บิต (ตำแหน่ง ${pos.map(i => i + 1).join(', ')}${nf > 1 ? `, ช่วง burst ยาว ${burstLen} บิต` : ''})`;
      let cls, msg;
      if (nf === 0 && pass) { cls = 'nlw-is-ok'; msg = 'ผ่านการตรวจ และไม่มีบิตเสีย: ถูกต้อง'; }
      else if (nf > 0 && !pass) { cls = 'nlw-is-ok'; msg = 'ตรวจพบข้อผิดพลาด ผู้รับทิ้งเฟรม' + (fix && nf === 1 ? ' (หรือแก้ไขเองได้เพราะชี้ตำแหน่งได้)' : ''); }
      else { cls = 'nlw-is-bad'; msg = 'หลุด! มีบิตเสียแต่ผ่านการตรวจ ผู้รับรับข้อมูลผิดไปโดยไม่รู้ตัว'; }
      recvBox.replaceChildren(...detail, h('div', { class: 'nlw-small' }, truth), h('div', { class: 'nlw-result ' + cls }, msg));
      renderCh({ pass, nf });
    }
    function renderCh(r) {
      if (r && C) {
        if ((C.m === 'even' || C.m === 'odd') && r.nf === 2 && r.pass) st.done.par = true;
        if (C.m === 'crc' && st.gen === '10011' && r.nf > 0 && r.pass) st.done.crc = true;
        if (C.m === 'sum' && r.nf === 2 && r.pass) st.done.sum = true;
        if (C.m === 'p2d' && r.nf === 4 && r.pass) st.done.p2d = true;
      }
      const item = (k, txt, hint) => h('div', null, h('span', { class: 'nlw-chip ' + (st.done[k] ? 'nlw-is-ok' : '') }, st.done[k] ? 'ทำได้แล้ว' : 'ยังไม่สำเร็จ'), h('span', null, txt, h('br'), h('span', { class: 'nlw-small' }, 'คำใบ้: ' + hint)));
      chBox.replaceChildren(h('div', { class: 'nlfe-challenge' },
        item('par', 'Parity: หาข้อผิดพลาด 2 บิตที่ Parity ตรวจไม่พบ', 'จำนวนเลข 1 เปลี่ยนไปเท่าไรเมื่อพลิก 2 บิต'),
        item('p2d', 'Parity 2 มิติ: หาข้อผิดพลาด 4 บิตที่ตรวจไม่พบ', 'ลองพลิก 4 บิตที่อยู่มุมของสี่เหลี่ยมเดียวกัน'),
        item('sum', 'Checksum: พลิก 2 บิตให้ Checksum ตรวจไม่พบ', 'ในคำสองคำ ที่ตำแหน่งบิตเดียวกัน ให้ข้างหนึ่ง 0→1 อีกข้าง 1→0'),
        item('crc', 'CRC-4 (10011): หาข้อผิดพลาดที่ CRC ตรวจไม่พบ', 'รูปแบบบิตที่พลิกต้องหารด้วย 10011 ลงตัว เช่น พลิกตามลาย 1 0 0 1 1 ติดกัน 5 ตำแหน่ง')));
    }
    render();
  });

  /* ----------------------------------------------------------------------
     Widget 3: arq-lab (Stop-and-Wait vs Go-Back-N ladder diagram)
     ---------------------------------------------------------------------- */
  NL_FIG('widget', 'arq-lab', function (root) {
    frame(root, 'nlfe-arq', 'จำลองการส่งซ้ำอัตโนมัติ (ARQ): Stop-and-Wait กับ Go-Back-N',
      'เลือกโปรโตคอล ปรับขนาดหน้าต่าง ระยะหน่วง (Propagation delay) และโอกาสเฟรมหาย แล้วกด "เล่น" หรือ "ก้าวถัดไป" ทีละเหตุการณ์ ระหว่างที่เฟรมหรือ ACK กำลังเดินทาง กดปุ่ม "ทิ้ง" เพื่อทำให้หายเองได้ ดูว่า Timer หมดเวลาแล้วส่งซ้ำอย่างไร และเทียบประสิทธิภาพของสองแบบ');
    const RM = reducedMotion(), clipId = 'arqclip' + (++ARQ_UID);
    const st = { proto: 'sw', N: 4, D: 1.5, loss: 0, total: 8, seed: 1, timeout: null };
    let sim, timer = null, results = { sw: null, gbn: null };
    const segP = seg([['sw', 'Stop-and-Wait'], ['gbn', 'Go-Back-N']], st.proto, v => { st.proto = v; reset(); }, 'โปรโตคอล');
    const mk = (label, min, max, step, val, fmt, on) => {
      const b = h('b', null, fmt(val));
      const r = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(val), 'aria-label': label, oninput: e => { const v = Number(e.target.value); b.textContent = fmt(v); on(v); } });
      return { el: h('label', null, h('span', null, label + ': ', b), r), r, b };
    };
    const cN = mk('ขนาดหน้าต่าง N (Go-Back-N)', 1, 7, 1, st.N, v => String(v), v => { st.N = v; reset(); });
    const cD = mk('Propagation delay (D)', 0.5, 4, 0.5, st.D, v => v + ' หน่วย', v => { st.D = v; st.timeout = null; reset(); });
    const cL = mk('โอกาสเฟรม/ACK หาย', 0, 40, 5, 0, v => v + '%', v => { st.loss = v / 100; reset(); });
    const cT = mk('Timeout', 1, 14, 0.5, 1 + 2 * st.D + 0.5, v => v + ' หน่วย', v => { st.timeout = v; reset(); });
    const cF = mk('จำนวนเฟรมที่ต้องส่ง', 4, 16, 1, st.total, v => String(v), v => { st.total = v; reset(); });
    const inSeed = h('input', { type: 'number', min: '1', max: '9999', value: String(st.seed), 'aria-label': 'Seed ของการสุ่ม', style: 'width:110px', onchange: e => { st.seed = Math.max(1, Number(e.target.value) || 1); reset(); } });
    const bPlay = h('button', { type: 'button', class: 'nlw-btn nlw-primary', hidden: RM, onclick: play }, 'เล่น');
    const bStep = h('button', { type: 'button', class: 'nlw-btn' + (RM ? ' nlw-primary' : ''), onclick: () => { stop(); sim.step(); draw(); } }, 'ก้าวถัดไป');
    const bAll = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { stop(); sim.run(); draw(); } }, 'รันจนจบ');
    const bReset = h('button', { type: 'button', class: 'nlw-btn', onclick: reset }, 'เริ่มใหม่');
    const svgBox = h('div', { class: 'nlfe-svgbox nlfe-fit', role: 'img', 'aria-label': 'แผนภาพเวลา ผู้ส่งซ้าย ผู้รับขวา เวลาไหลลง' });
    const dropBox = h('div', { class: 'nlw-row nlw-center', 'aria-label': 'ทิ้งเฟรมที่กำลังเดินทาง' });
    const stats = h('div', { class: 'nlfe-stats', 'aria-live': 'polite' });
    const log = h('ul', { class: 'nlfe-log', 'aria-live': 'polite' });
    const cmp = h('div');
    root.appendChild(segP.el);
    root.appendChild(h('div', { class: 'nlfe-ctl' }, cN.el, cD.el, cL.el, cT.el, cF.el, h('label', null, h('span', null, 'Seed การสุ่ม'), inSeed)));
    root.appendChild(h('div', { class: 'nlw-row nlw-center' }, bPlay, bStep, bAll, bReset));
    root.appendChild(svgBox);
    root.appendChild(dropBox);
    root.appendChild(stats);
    root.appendChild(log);
    root.appendChild(cmp);
    root.appendChild(h('p', { class: 'nlw-small' }, '1 หน่วยเวลา = เวลาที่ใช้ปล่อยเฟรมข้อมูล 1 เฟรมลงสาย (Transmission time) ACK สั้นมากจึงถือว่าใช้เวลาปล่อยเป็นศูนย์ Go-Back-N ในแบบจำลองใช้เลขลำดับ 3 บิต (0–7) หน้าต่างจึงใหญ่ได้ไม่เกิน 7 ส่วน Stop-and-Wait ใช้เลขลำดับ 0/1 สลับกัน'));

    function reset() {
      stop();
      cN.r.disabled = st.proto === 'sw';
      const to = st.timeout != null ? st.timeout : 1 + 2 * st.D + 0.5;
      cT.r.value = String(to); cT.b.textContent = to + ' หน่วย';
      sim = arqSim({ proto: st.proto, N: st.N, D: st.D, loss: st.loss, timeout: to, total: st.total, seed: st.seed }).start();
      draw();
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      if (timer) { stop(); draw(); return; }
      if (sim.S.done) reset();
      timer = setInterval(() => {
        if (!root.isConnected) { stop(); return; }
        if (sim.S.done || (!sim.S.q.length)) { stop(); draw(); return; }
        sim.advanceTo(sim.S.now + 0.1); draw();
      }, 60);
      draw();
    }
    function draw() {
      const S = sim.S, now = S.now, PX = 28, top = 30, H = 420, xs = 112, xr = 318, W = 440;
      const span = (H - top - 40) / PX, tTop = Math.max(0, now - span + 1.5);
      const y = t => top + (t - tTop) * PX;
      let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="inherit"><defs><clipPath id="${clipId}"><rect x="0" y="${top - 2}" width="${W}" height="${Math.max(0, y(now) - top + 2)}"/></clipPath></defs>`;
      s += T(xs, 20, 'ผู้ส่ง', { anchor: 'middle', weight: 700, size: 15 }) + T(xr, 20, 'ผู้รับ', { anchor: 'middle', weight: 700, size: 15 });
      for (let t = Math.ceil(tTop); t <= tTop + span; t++) { s += Ln(xs - 6, y(t), xs, y(t), { stroke: 'var(--muted)', sw: 1 }) + T(xs - 8, y(t) + 4, 't=' + t, { size: 11, anchor: 'end', fill: 'var(--muted)', mono: true }); }
      s += Ln(xs, top, xs, H - 30, { stroke: 'var(--ink)', sw: 2.5 }) + Ln(xr, top, xr, H - 30, { stroke: 'var(--ink)', sw: 2.5 });
      let body = '';
      const D = S.P.D, Tf = S.Tf, vis = p => p.t0 <= tTop + span + 1 && (p.lost ? p.t0 + Tf + D : p.t1) >= tTop - 1;
      S.pkts.filter(vis).forEach(p => {
        if (p.kind === 'D') {
          const f = p.lost ? p.frac : 1, xe = xs + (xr - xs) * f, col = p.lost ? 'var(--bad)' : p.retx ? 'var(--orange)' : 'var(--blue)';
          body += `<polygon points="${xs},${r1(y(p.t0))} ${r1(xe)},${r1(y(p.t0 + f * D))} ${r1(xe)},${r1(y(p.t0 + Tf + f * D))} ${xs},${r1(y(p.t0 + Tf))}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.5"/>`;
          body += T(xs - 44, y(p.t0 + Tf / 2) + 5, `F${p.idx}`, { size: 13, anchor: 'end', weight: 700, fill: col, mono: true }) + T(xs + 6, y(p.t0 + Tf / 2) + 5, 'seq ' + p.seq, { size: 11.5, fill: col, mono: true });
          if (p.lost) body += T(xe, y(p.t0 + Tf + f * D) + 5, '✕', { size: 20, anchor: 'middle', weight: 700, fill: 'var(--bad)' });
          if (!p.lost && p.res) body += T(xr + 8, y(p.t1) + 5, p.res === 'ok' ? `รับ F${p.idx}` : `ทิ้ง seq ${p.seq}`, { size: 12.5, fill: p.res === 'ok' ? 'var(--ok)' : 'var(--orange)' });
        } else {
          const f = p.lost ? p.frac : 1, xe = xr - (xr - xs) * f, col = p.lost ? 'var(--bad)' : 'var(--green)';
          body += Ln(xr, y(p.t0), xe, y(p.t0 + f * D), { stroke: col, sw: 2, dash: p.dup ? '6 4' : null });
          body += T(xr + 8, y(p.t0) + 19, `ACK ${p.ack}${p.dup ? ' ซ้ำ' : ''}`, { size: 12, fill: col, mono: true });
          if (p.lost) body += T(xe, y(p.t0 + f * D) + 5, '✕', { size: 18, anchor: 'middle', weight: 700, fill: 'var(--bad)' });
        }
      });
      S.log.filter(l => /Timer หมดเวลา/.test(l.msg)).forEach(l => { body += T(xs - 44, y(l.t) - 4, 'หมดเวลา', { size: 11.5, anchor: 'end', fill: 'var(--bad)', weight: 700 }) + Ln(xs - 40, y(l.t), xs, y(l.t), { stroke: 'var(--bad)', sw: 2 }); });
      s += `<g clip-path="url(#${clipId})">${body}</g>`;
      if (S.timer && !S.done) { const a = y(Math.max(S.timer.t0, tTop)), b = Math.min(y(S.timer.exp), H - 30); s += Ln(10, a, 10, b, { stroke: 'var(--orange)', sw: 4, dash: '4 3' }) + T(16, Math.min(b, H - 34), 'timer', { size: 11, fill: 'var(--orange)' }); }
      s += Ln(xs - 4, y(now), xr + 4, y(now), { stroke: 'var(--muted)', sw: 1, dash: '3 3' }) + T(xr + 6, y(now) + 14, 'ตอนนี้', { size: 11, fill: 'var(--muted)' });
      // window bracket at the sender
      if (!S.done) { const yy = H - 8; s += T(8, yy, `หน้าต่าง: F${S.base}–F${Math.min(S.base + S.N, S.P.total) - 1}  ถัดไปจะส่ง F${Math.min(S.next, S.P.total)}`, { size: 12, fill: 'var(--ink)', mono: true }); }
      s += '</svg>';
      svgBox.innerHTML = s;
      const fl = sim.inFlight();
      dropBox.replaceChildren(h('span', { class: 'nlw-small' }, fl.length ? 'กำลังเดินทาง:' : 'ไม่มีเฟรมหรือ ACK กำลังเดินทาง'),
        ...fl.map(p => h('button', { type: 'button', class: 'nlw-btn', onclick: () => { sim.drop(p.id); draw(); } }, p.kind === 'D' ? `ทิ้ง F${p.idx}` : `ทิ้ง ACK ${p.ack}`)));
      const eff = sim.efficiency();
      if (S.done) results[S.P.proto] = { N: S.N, D: S.P.D, loss: S.P.loss, t: S.finish, sent: S.c.sent, retx: S.c.retx, eff };
      stats.replaceChildren(
        stat('เวลา', now.toFixed(1) + ' หน่วย'),
        stat('ส่งถึงผู้รับตามลำดับ', `${S.c.delivered} / ${S.P.total}`, S.done ? 'nlw-ok' : null),
        stat('เฟรมที่ส่งทั้งหมด', String(S.c.sent)),
        stat('ส่งซ้ำ (Retransmit)', String(S.c.retx), S.c.retx ? 'nlw-bad' : 'nlw-ok'),
        stat('Timeout', String(S.c.timeouts)),
        stat('ผู้รับทิ้ง (ซ้ำ/ผิดลำดับ)', String(S.c.discarded)),
        stat('ประสิทธิภาพ (Utilization)', (eff * 100).toFixed(0) + '%'),
        stat('ทฤษฎีถ้าไม่มีการสูญหาย', (sim.ideal() * 100).toFixed(0) + '%'));
      log.replaceChildren(...(S.log.length ? S.log.slice(-8).reverse().map(l => h('li', { class: l.cls }, `t=${l.t.toFixed(1)}: ${l.msg}`)) : [h('li', null, 'ยังไม่เริ่ม')]));
      bPlay.textContent = timer ? 'หยุด' : 'เล่น'; bPlay.setAttribute('aria-pressed', String(!!timer));
      bStep.disabled = S.done; bAll.disabled = S.done;
      const row = (k, label) => { const r = results[k]; return h('tr', null, h('td', null, label), h('td', null, r ? (k === 'gbn' ? 'N=' + r.N + ', ' : '') + 'D=' + r.D + ', หาย ' + Math.round(r.loss * 100) + '%' : '-'), h('td', null, r ? r.t.toFixed(1) : 'ยังไม่ได้รันจนจบ'), h('td', null, r ? `${r.sent} (ซ้ำ ${r.retx})` : '-'), h('td', null, r ? (r.eff * 100).toFixed(0) + '%' : '-')); };
      cmp.replaceChildren(h('div', { class: 'nlw-scroll' }, h('table', { class: 'nlfe-cmp' }, h('caption', { class: 'nlw-small', style: 'text-align:left' }, 'ผลล่าสุดที่รันจนจบของแต่ละโปรโตคอล'),
        h('thead', null, h('tr', null, h('th', null, 'โปรโตคอล'), h('th', null, 'ค่าที่ตั้ง'), h('th', null, 'เวลา'), h('th', null, 'เฟรมที่ส่ง'), h('th', null, 'ประสิทธิภาพ'))),
        h('tbody', null, row('sw', 'Stop-and-Wait'), row('gbn', 'Go-Back-N')))));
    }
    reset();
  });
})();
