'use strict';
/* NetLab 2.8 figures, batch d. Register with NL_FIG('diagram'|'widget', name, svgString|mountFn). */
window.NL_FIG = window.NL_FIG || function (kind, name, v) { const k = kind === 'diagram' ? 'NL_DIAGRAMS' : 'NL_WIDGETS'; (window[k] = window[k] || {})[name] = v; };

/* Week 2 supplementary: data and signals, line coding, impairment, multiplexing.
   Diagrams: signal-anatomy, mux-types. Widgets: signal-lab, mux-lab.
   Everything is computed: waveforms from the formulas, line codes from the bits, noise from a seeded PRNG,
   decoding by sampling against thresholds, TDM by slot arithmetic, FDM by real carriers and a DFT. */
(function () {
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function n(v) { return Math.round(v * 10) / 10; }
  function attrs(o) { let s = ''; for (const k in o) if (o[k] != null && o[k] !== false) s += ` ${k}="${o[k]}"`; return s; }
  function T(x, y, s, o) {
    o = o || {};
    return `<text${attrs({ x: n(x), y: n(y), 'font-size': o.size || 14, 'text-anchor': o.anchor || 'start', fill: o.fill || 'var(--ink)', 'font-weight': o.weight, 'font-family': o.mono ? 'JetBrains Mono,Consolas,monospace' : 'inherit' })}>${esc(s)}</text>`;
  }
  function R(x, y, w, h, o) { o = o || {}; return `<rect${attrs({ x: n(x), y: n(y), width: n(w), height: n(h), rx: o.rx, fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.stroke, 'stroke-width': o.sw, 'stroke-dasharray': o.dash })}/>`; }
  function L(x1, y1, x2, y2, o) { o = o || {}; return `<line${attrs({ x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2), stroke: o.stroke || 'var(--line)', 'stroke-width': o.sw || 1.5, 'stroke-dasharray': o.dash, 'stroke-linecap': 'round', 'marker-start': o.ms, 'marker-end': o.me })}/>`; }
  function P(d, o) { o = o || {}; return `<path${attrs({ d: d, fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.stroke, 'stroke-width': o.sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': o.dash })}/>`; }
  function C(cx, cy, r, o) { o = o || {}; return `<circle${attrs({ cx: n(cx), cy: n(cy), r: n(r), fill: o.fill || 'none', stroke: o.stroke, 'stroke-width': o.sw })}/>`; }
  function arrowDefs(id, col) {
    return `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${col}"/></marker></defs>`;
  }
  function wave(x0, w, y0, amp, cycles, ph) {   // y = y0 - amp * sin(2*pi*cycles*u + ph), u in [0,1]
    const pts = [];
    for (let i = 0; i <= Math.ceil(w / 2); i++) { const u = Math.min(1, (2 * i) / w); pts.push(n(x0 + u * w) + ' ' + n(y0 - amp * Math.sin(2 * Math.PI * cycles * u + ph))); }
    return 'M' + pts.join(' L');
  }

  /* ---------------- diagram: signal-anatomy ---------------- */
  (function () {
    const id = 'signal-anatomy';
    let b = arrowDefs('nlfd-sa-ar', 'var(--ink)') + arrowDefs('nlfd-sa-ag', 'var(--orange)');
    // panel 1: time domain
    const x0 = 60, w = 500, y0 = 160, A = 70;   // 2 cycles across w
    b += T(20, 30, 'สัญญาณเป็นฟังก์ชันของเวลา (Time domain)', { size: 16, weight: 700 });
    b += L(x0, y0, 630, y0, { stroke: 'var(--muted)', sw: 1.5 });
    b += L(x0, y0 + A + 16, x0, y0 - A - 16, { stroke: 'var(--muted)', sw: 1.5 });
    b += T(630, y0 - 8, 'เวลา t', { size: 14, anchor: 'end', fill: 'var(--muted)' });
    b += T(x0 - 8, y0 - A + 5, '+A', { size: 14, anchor: 'end', fill: 'var(--muted)' });
    b += T(x0 - 8, y0 + 5, '0', { size: 14, anchor: 'end', fill: 'var(--muted)' });
    b += T(x0 - 8, y0 + A + 5, '−A', { size: 14, anchor: 'end', fill: 'var(--muted)' });
    b += P(wave(x0, w, y0, A, 2, Math.PI / 2), { stroke: 'var(--orange)', sw: 2, dash: '7 6' });
    b += P(wave(x0, w, y0, A, 2, 0), { stroke: 'var(--blue)', sw: 3 });
    // amplitude arrow at first crest (u = 1/8)
    const xc = x0 + w / 8;
    b += L(xc, y0, xc, y0 - A + 3, { stroke: 'var(--ink)', sw: 1.6, me: 'url(#nlfd-sa-ar)' });
    b += L(xc - 30, y0 - A, xc + 30, y0 - A, { stroke: 'var(--muted)', sw: 1, dash: '3 3' });
    b += L(xc, y0 - A - 4, xc - 4, y0 - A - 22, { stroke: 'var(--muted)', sw: 1 });
    b += T(xc - 50, y0 - A - 28, 'แอมพลิจูด (Amplitude)', { size: 15, weight: 700 });
    // period arrow: crest to crest (u = 1/8 .. 5/8)
    const xp1 = x0 + w / 8, xp2 = x0 + 5 * w / 8, yp = y0 + A + 34;
    b += L(xp1, y0 - A, xp1, yp + 6, { stroke: 'var(--muted)', sw: 1, dash: '3 3' });
    b += L(xp2, y0 - A, xp2, yp + 6, { stroke: 'var(--muted)', sw: 1, dash: '3 3' });
    b += L(xp1 + 2, yp, xp2 - 2, yp, { stroke: 'var(--ink)', sw: 1.6, ms: 'url(#nlfd-sa-ar)', me: 'url(#nlfd-sa-ar)' });
    b += T((xp1 + xp2) / 2, yp + 22, 'คาบ (Period) T', { size: 15, anchor: 'middle', weight: 700 });
    // phase: orange dashed wave leads by 90 degrees; arrow between its crest (u=0) and the blue crest (u=1/8)
    const xo = x0 + w / 2, xb = x0 + 5 * w / 8;
    b += L(xo + 2, y0 - A - 12, xb - 2, y0 - A - 12, { stroke: 'var(--orange)', sw: 1.6, ms: 'url(#nlfd-sa-ag)', me: 'url(#nlfd-sa-ag)' });
    b += T(xo - 20, y0 - A - 28, 'เฟส (Phase) ต่างกัน 90°', { size: 15, weight: 700, fill: 'var(--ink)' });
    b += T(20, yp + 56, 'เส้นทึบ: A sin(2πft)   เส้นประ: คลื่นเดียวกันที่เลื่อนเฟส 90° (เริ่มที่ยอดคลื่น)', { size: 14, fill: 'var(--muted)' });
    // formula box
    b += R(20, yp + 70, 600, 40, { rx: 8, fill: 'var(--blue)', fo: 0.1, stroke: 'var(--blue)', sw: 1.2 });
    b += T(320, yp + 96, 'ความถี่ f = 1/T  หน่วย Hz (รอบต่อวินาที)   เช่น T = 1 ms → f = 1 kHz', { size: 15, anchor: 'middle', weight: 600 });
    // panel 2: space domain
    const y2 = yp + 250, A2 = 45;
    b += T(20, y2 - 100, 'คลื่นที่กำลังเดินทางในสื่อกลาง (ภาพ ณ เวลาหนึ่ง)', { size: 16, weight: 700 });
    b += L(x0, y2, 630, y2, { stroke: 'var(--muted)', sw: 1.5 });
    b += T(630, y2 - 8, 'ระยะทาง', { size: 14, anchor: 'end', fill: 'var(--muted)' });
    b += P(wave(x0, w, y2, A2, 3, 0), { stroke: 'var(--green)', sw: 3 });
    const xl1 = x0 + w / 12, xl2 = x0 + 5 * w / 12;
    b += L(xl1, y2 - A2, xl1, y2 - A2 - 22, { stroke: 'var(--muted)', sw: 1, dash: '3 3' });
    b += L(xl2, y2 - A2, xl2, y2 - A2 - 22, { stroke: 'var(--muted)', sw: 1, dash: '3 3' });
    b += L(xl1 + 2, y2 - A2 - 16, xl2 - 2, y2 - A2 - 16, { stroke: 'var(--ink)', sw: 1.6, ms: 'url(#nlfd-sa-ar)', me: 'url(#nlfd-sa-ar)' });
    b += T((xl1 + xl2) / 2, y2 - A2 - 26, 'ความยาวคลื่น (Wavelength) λ', { size: 15, anchor: 'middle', weight: 700 });
    b += T(20, y2 + A2 + 34, 'λ = v / f  (v คือความเร็วของคลื่นในสื่อนั้น)', { size: 15, weight: 600 });
    b += T(20, y2 + A2 + 58, 'ในอากาศ v ≈ 3×10⁸ m/s: คลื่น 2.4 GHz ยาวราว 12.5 cm', { size: 14, fill: 'var(--muted)' });
    b += T(20, y2 + A2 + 80, 'ในสายทองแดงและไฟเบอร์ v ช้ากว่าในอากาศ ราว 2/3 ของความเร็วแสง', { size: 14, fill: 'var(--muted)' });
    const H = y2 + A2 + 96;
    const title = 'องค์ประกอบของสัญญาณแบบคาบ (Periodic signal) รูปไซน์: แอมพลิจูด (Amplitude) คือความสูงจากศูนย์ถึงยอดคลื่น, คาบ (Period, T) คือเวลาของหนึ่งรอบ วัดจากยอดถึงยอดถัดไป, ความถี่ f = 1/T มีหน่วยเฮิรตซ์, เฟส (Phase) คือตำแหน่งของคลื่นเทียบกับเวลาศูนย์ ภาพแสดงคลื่นสองเส้นที่ต่างเฟสกัน 90 องศา และภาพล่างคือความยาวคลื่น (Wavelength) λ = v/f ซึ่งวัดตามระยะทาง';
    NL_FIG('diagram', 'signal-anatomy', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${n(H)}" role="img" aria-labelledby="${id}-title" font-family="inherit"><title id="${id}-title">${esc(title)}</title>${b}</svg>`);
  })();

  /* ---------------- diagram: mux-types ---------------- */
  (function () {
    const id = 'mux-types';
    const COL = ['var(--blue)', 'var(--green)', 'var(--orange)'];
    let b = arrowDefs('nlfd-mt-ar', 'var(--muted)');
    // FDM
    b += T(20, 30, 'FDM: แบ่งตามความถี่ ทุกแหล่งส่งพร้อมกันตลอดเวลา', { size: 16, weight: 700 });
    const fx = 60, fw = 540, fy = 150;
    b += L(fx, fy, fx + fw, fy, { stroke: 'var(--muted)', sw: 1.5, me: 'url(#nlfd-mt-ar)' });
    b += T(fx + fw, fy + 22, 'ความถี่', { size: 14, anchor: 'end', fill: 'var(--muted)' });
    ['A', 'B', 'C'].forEach((s, i) => {
      const x = fx + 40 + i * 170;
      b += P(`M${x} ${fy} C ${x + 20} ${fy - 95}, ${x + 120} ${fy - 95}, ${x + 140} ${fy} Z`, { fill: COL[i], fo: 0.28, stroke: COL[i], sw: 2 });
      b += T(x + 70, fy - 30, 'ช่อง ' + s, { size: 15, anchor: 'middle', weight: 700 });
      if (i < 2) b += T(x + 155, fy - 8, 'guard', { size: 12, anchor: 'middle', fill: 'var(--muted)' });
    });
    b += T(20, fy + 46, 'เช่น สถานีวิทยุ FM แต่ละสถานีใช้ความถี่ของตัวเอง, ช่อง Wi-Fi 1/6/11', { size: 14, fill: 'var(--muted)' });
    // TDM
    const ty = 250;
    b += T(20, ty, 'TDM: แบ่งตามเวลา ผลัดกันใช้ทั้งช่องทีละช่วงสั้น ๆ (ช่องเวลา slot)', { size: 16, weight: 700 });
    const sw = 44, tx0 = 60, row = ty + 28;
    const seq = ['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C'];
    seq.forEach((s, i) => {
      const ci = 'ABC'.indexOf(s);
      b += R(tx0 + i * sw, row, sw - 3, 40, { rx: 4, fill: COL[ci], fo: 0.25, stroke: COL[ci], sw: 1.5 });
      b += T(tx0 + i * sw + (sw - 3) / 2, row + 26, s, { size: 16, anchor: 'middle', weight: 700 });
    });
    for (let f = 0; f <= 4; f++) b += L(tx0 + f * 3 * sw - 1.5, row - 8, tx0 + f * 3 * sw - 1.5, row + 48, { stroke: 'var(--ink)', sw: 2 });
    b += T(tx0 + 1.5 * sw, row + 70, '1 เฟรม', { size: 14, anchor: 'middle', weight: 600 });
    b += L(tx0, row + 54, tx0 + 3 * sw - 4, row + 54, { stroke: 'var(--muted)', sw: 1.2 });
    b += L(tx0 + 4 * sw, row + 62, tx0 + 12 * sw, row + 62, { stroke: 'var(--muted)', sw: 1.5, me: 'url(#nlfd-mt-ar)' });
    b += T(tx0 + 12 * sw, row + 82, 'เวลา', { size: 14, anchor: 'end', fill: 'var(--muted)' });
    b += T(20, row + 106, 'เช่น ชุมสายโทรศัพท์ E1 มี 32 ช่องเวลา ช่องละ 64 kbps รวม 2.048 Mbps', { size: 14, fill: 'var(--muted)' });
    // WDM
    const wy = row + 160;
    b += T(20, wy, 'WDM: แบ่งตามความยาวคลื่นแสง หลายสีในไฟเบอร์เส้นเดียว', { size: 16, weight: 700 });
    const lam = ['λ1', 'λ2', 'λ3'];
    const my = wy + 80;
    lam.forEach((s, i) => {
      const y = wy + 36 + i * 44;
      b += L(70, y, 200, my, { stroke: COL[i], sw: 4 });
      b += T(60, y + 5, s, { size: 15, anchor: 'end', weight: 700 });
      b += L(440, my, 570, y, { stroke: COL[i], sw: 4 });
      b += T(580, y + 5, s, { size: 15, weight: 700 });
    });
    b += R(190, my - 26, 64, 52, { rx: 8, fill: 'var(--panel)', stroke: 'var(--ink)', sw: 1.8 });
    b += T(222, my + 5, 'MUX', { size: 14, anchor: 'middle', weight: 700 });
    b += R(386, my - 26, 64, 52, { rx: 8, fill: 'var(--panel)', stroke: 'var(--ink)', sw: 1.8 });
    b += T(418, my + 5, 'DEMUX', { size: 13, anchor: 'middle', weight: 700 });
    b += R(254, my - 7, 132, 14, { rx: 7, fill: 'var(--brown)', fo: 0.35, stroke: 'var(--brown)', sw: 1.5 });
    b += T(320, my + 30, 'ไฟเบอร์ 1 เส้น', { size: 14, anchor: 'middle', fill: 'var(--muted)' });
    b += T(20, my + 98, 'เช่น FTTH (GPON) ส่งลง 1490 nm ส่งขึ้น 1310 nm ในเส้นเดียวกัน', { size: 14, fill: 'var(--muted)' });
    const H = my + 116;
    const title = 'เปรียบเทียบการมัลติเพล็กซ์สามแบบ: FDM แบ่งย่านความถี่ให้แต่ละแหล่งส่งพร้อมกันโดยมีแถบป้องกัน (guard band) คั่น, TDM ให้แต่ละแหล่งผลัดกันใช้ช่องสัญญาณทั้งหมดตามช่องเวลา (slot) ที่เรียงเป็นเฟรม A B C ซ้ำไปเรื่อย ๆ, WDM รวมแสงหลายความยาวคลื่น λ1 λ2 λ3 เข้าไฟเบอร์เส้นเดียวด้วย MUX แล้วแยกออกด้วย DEMUX ที่ปลายทาง';
    NL_FIG('diagram', 'mux-types', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${n(H)}" role="img" aria-labelledby="${id}-title" font-family="inherit"><title id="${id}-title">${esc(title)}</title>${b}</svg>`);
  })();

  /* ---------------- shared widget helpers ---------------- */
  const KEEP = { value: 1, checked: 1, selected: 1, disabled: 1 };
  function addc(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(x => addc(e, x)); return; }
    e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (KEEP[k]) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) addc(e, arguments[i]);
    return e;
  }
  const CSS = `
.nlfd [hidden]{display:none !important}
.nlfd .nlw-btn,.nlfd select,.nlfd input[type=text],.nlfd input[type=number]{min-height:44px}
.nlfd input[type=range]{min-height:44px;margin:0}
.nlfd .nlfd-svg{border:1px solid var(--line);border-radius:10px;background:var(--field);overflow:hidden;margin:8px 0}
.nlfd .nlfd-svg svg{display:block;width:100%;height:auto}
.nlfd .nlfd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:6px 14px;margin:8px 0}
.nlfd .nlfd-rng{display:flex;flex-direction:column;font-size:14px;color:var(--muted);min-width:0}
.nlfd .nlfd-rng>span{display:flex;justify-content:space-between;gap:8px;font-weight:600}
.nlfd .nlfd-rng output{color:var(--ink);font-family:"JetBrains Mono",Consolas,monospace;font-weight:700}
.nlfd .nlfd-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr));gap:6px;margin:8px 0}
.nlfd .nlfd-stat{border:1px solid var(--line);border-radius:8px;background:var(--field);padding:6px 10px;min-width:0}
.nlfd .nlfd-stat span{display:block;font-size:13.5px;color:var(--muted)}
.nlfd .nlfd-stat b{font-size:17px;overflow-wrap:anywhere}
.nlfd .nlfd-bits{display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin:4px 0}
.nlfd .nlfd-bits>span{min-width:76px;font-size:14px;color:var(--muted);font-weight:600}
.nlfd .nlfd-bits i{display:inline-flex;align-items:center;justify-content:center;width:24px;height:28px;border-radius:5px;font-style:normal;font-family:"JetBrains Mono",Consolas,monospace;font-weight:700;font-size:15px;border:1px solid var(--line);background:var(--panel);color:var(--ink)}
.nlfd .nlfd-bits i.nlfd-err{background:color-mix(in srgb,var(--bad) 28%,var(--panel));border-color:var(--bad)}
.nlfd .nlfd-formula{font-family:"JetBrains Mono",Consolas,monospace;font-size:14px;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:8px 0;overflow-wrap:anywhere}
.nlfd .nlfd-scroll{overflow-x:auto;max-width:100%}
.nlfd .nlfd-tab{border-collapse:collapse;font-size:14.5px;margin:6px 0;width:100%}
.nlfd .nlfd-tab th,.nlfd .nlfd-tab td{border:1px solid var(--line);padding:4px 6px;text-align:center}
.nlfd .nlfd-tab th{background:var(--field);color:var(--muted);font-weight:600}
.nlfd .nlfd-tab td.nlfd-idle{color:var(--muted);background:repeating-linear-gradient(45deg,var(--field) 0 6px,var(--panel) 6px 12px)}
.nlfd .nlfd-tab td.nlfd-l{text-align:left}
.nlfd .nlfd-tab .nlfd-mono{font-family:"JetBrains Mono",Consolas,monospace;font-weight:700}
.nlfd .nlfd-tag{display:inline-block;min-width:22px;border-radius:4px;padding:0 4px;font-size:12.5px;font-weight:700;color:var(--on-accent)}
.nlfd .nlfd-ok{color:var(--ok);font-weight:700}.nlfd .nlfd-bad{color:var(--bad);font-weight:700}
.nlfd .nlfd-srcs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:6px 12px}
.nlfd .nlfd-srcs input{width:100%;font-family:"JetBrains Mono",Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}
.nlfd .nlfd-map{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,120px),1fr));gap:6px 10px;margin:6px 0}
.nlfd .nlfd-h{font-weight:700;font-size:16px;margin:12px 0 2px}
`;
  function ensureCSS() {
    if (document.getElementById('nlfd-css')) return;
    const st = document.createElement('style'); st.id = 'nlfd-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  function frame(root, cls, title, instr) {
    ensureCSS();
    root.replaceChildren();
    root.classList.add('nlw', 'nlfd', cls);
    root.appendChild(h('div', { class: 'nlw-title' }, title));
    root.appendChild(h('p', { class: 'nlw-instr' }, h('b', null, 'คำแนะนำการใช้งาน: '), instr));
  }
  function seg(opts, val, onChange, label) {
    const wrap = h('div', { class: 'nlw-seg', role: 'group', 'aria-label': label });
    const btns = opts.map(o => h('button', { type: 'button', class: 'nlw-btn', 'data-v': o[0], 'aria-pressed': String(o[0] === val), onclick: () => { set(o[0]); onChange(o[0]); } }, o[1]));
    function set(v) { btns.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === String(v)))); }
    btns.forEach(b => wrap.appendChild(b));
    return { el: wrap, set: set };
  }
  function range(label, min, max, step, val, fmt, onInput) {
    const out = h('output', null, fmt(val));
    const inp = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(val), 'aria-label': label });
    inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); onInput(+inp.value); });
    return { el: h('label', { class: 'nlfd-rng' }, h('span', null, label, out), inp), inp: inp, set: v => { inp.value = String(v); out.textContent = fmt(v); } };
  }
  function stat(label) { const b = h('b', null, '-'); return { el: h('div', { class: 'nlfd-stat' }, h('span', null, label), b), b: b }; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gaussFrom(rnd) { return function () { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); }; }
  function widthOf(el) { const w = el && el.clientWidth ? el.clientWidth : 640; return Math.max(320, Math.min(760, Math.round(w))); }
  function onResize(el, fn) {
    if (typeof ResizeObserver === 'undefined') return;
    let last = 0, tm = 0;
    new ResizeObserver(() => { const w = widthOf(el); if (Math.abs(w - last) < 24) return; last = w; clearTimeout(tm); tm = setTimeout(fn, 60); }).observe(el);
  }
  const fmtNum = (v, d) => { const s = v.toFixed(d == null ? 2 : d); return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s; };

  /* ======================================================================
     widget: signal-lab
     ====================================================================== */
  const SPB = 32;   // samples per bit
  const CODES = {
    'nrzl': { name: 'NRZ-L', r: 1, L: 2 },
    'nrzi': { name: 'NRZ-I', r: 1, L: 2 },
    'man': { name: 'Manchester', r: 0.5, L: 2 },
    'pam4': { name: 'PAM-4', r: 2, L: 4 }
  };
  const PAM = { '00': -1, '01': -1 / 3, '11': 1 / 3, '10': 1 };   // Gray-coded 4 levels
  function encode(bits, code) {
    const s = [];
    if (code === 'nrzl') bits.forEach(b => { for (let k = 0; k < SPB; k++) s.push(b ? 1 : -1); });
    else if (code === 'nrzi') { let lv = -1; bits.forEach(b => { if (b) lv = -lv; for (let k = 0; k < SPB; k++) s.push(lv); }); }
    else if (code === 'man') bits.forEach(b => { for (let k = 0; k < SPB; k++) s.push((k < SPB / 2) === !!b ? -1 : 1); });  // IEEE 802.3: 1 = low->high, 0 = high->low
    else for (let i = 0; i < bits.length; i += 2) { const v = PAM['' + bits[i] + bits[i + 1]]; for (let k = 0; k < 2 * SPB; k++) s.push(v); }
    return s;
  }
  // returns decoded bits and the sample points used
  function decode(rx, code, nb) {
    const bits = [], pts = [];
    if (code === 'nrzl' || code === 'nrzi') {
      let prev = -1;
      for (let b = 0; b < nb; b++) {
        const i = b * SPB + SPB / 2, d = rx[i] > 0 ? 1 : -1;
        pts.push({ i: i, b: b });
        bits.push(code === 'nrzl' ? (d > 0 ? 1 : 0) : (d !== prev ? 1 : 0));
        prev = d;
      }
    } else if (code === 'man') {
      for (let b = 0; b < nb; b++) {
        const i1 = b * SPB + SPB / 4, i2 = b * SPB + 3 * SPB / 4;
        pts.push({ i: i1, b: b }, { i: i2, b: b });
        bits.push(rx[i2] > rx[i1] ? 1 : 0);
      }
    } else {
      for (let j = 0; j < nb / 2; j++) {
        const i = j * 2 * SPB + SPB, v = rx[i];
        pts.push({ i: i, b: 2 * j }, { i: i, b: 2 * j + 1 });
        const g = v < -2 / 3 ? '00' : v < 0 ? '01' : v < 2 / 3 ? '11' : '10';
        bits.push(+g[0], +g[1]);
      }
    }
    return { bits: bits, pts: pts };
  }
  const DB_PER_100M = 10;   // simplified model value, stated in the widget

  NL_FIG('widget', 'signal-lab', function (root) {
    frame(root, 'nlfd-sig', 'Signal Lab: สัญญาณ การเข้ารหัสสาย และสัญญาณรบกวน',
      'แท็บดิจิทัล: พิมพ์บิต เลือกวิธีเข้ารหัสสาย แล้วปรับระยะสายและสัญญาณรบกวน เครื่องรับจะสุ่มตัวอย่างแล้วตัดสินบิตด้วยค่าขีดแบ่ง (threshold) ดูว่าบิตใดผิด แท็บแอนะล็อก: ปรับแอมพลิจูด ความถี่ และเฟสของคลื่นไซน์ หรือประกอบคลื่นสี่เหลี่ยมจากฮาร์มอนิก');
    const st = { mode: 'digital', bits: '10110010', code: 'man', rate: 10, dist: 100, sigma: 0.05, rep: false, seed: 7, A: 3, f: 1, ph: 0, sq: false, K: 3 };
    const modeSeg = seg([['digital', 'ดิจิทัล: เข้ารหัสสาย'], ['analog', 'แอนะล็อก: คลื่นไซน์']], st.mode, v => { st.mode = v; render(); }, 'ชนิดสัญญาณ');
    root.appendChild(modeSeg.el);

    /* digital controls */
    const dBox = h('div');
    const bitsIn = h('input', { type: 'text', value: st.bits, maxlength: '24', inputmode: 'numeric', spellcheck: 'false', 'aria-label': 'บิตที่จะส่ง (0 และ 1 สูงสุด 24 บิต)', style: 'font-family:JetBrains Mono,Consolas,monospace;width:100%' });
    bitsIn.addEventListener('input', () => { st.bits = bitsIn.value; render(); });
    const codeSeg = seg([['nrzl', 'NRZ-L'], ['nrzi', 'NRZ-I'], ['man', 'Manchester'], ['pam4', 'PAM-4']], st.code, v => { st.code = v; render(); }, 'วิธีเข้ารหัสสาย');
    const rateSel = h('select', { 'aria-label': 'อัตราบิต', onchange: () => { st.rate = +rateSel.value; render(); } });
    [[1, '1 Mbps'], [10, '10 Mbps'], [100, '100 Mbps']].forEach(([v, t]) => rateSel.appendChild(h('option', { value: String(v), selected: v === st.rate }, t)));
    const rDist = range('ระยะสาย', 0, 300, 10, st.dist, v => v + ' m', v => { st.dist = v; render(); });
    const rNoise = range('สัญญาณรบกวน σ', 0, 0.3, 0.01, st.sigma, v => fmtNum(v) + ' V', v => { st.sigma = v; render(); });
    const repChk = h('input', { type: 'checkbox', onchange: () => { st.rep = repChk.checked; render(); } });
    const seedIn = h('input', { type: 'number', min: '1', max: '9999', value: String(st.seed), 'aria-label': 'เลขชุดสุ่ม (seed)', style: 'width:7em', onchange: () => { st.seed = Math.max(1, Math.min(9999, Math.round(+seedIn.value) || 1)); seedIn.value = String(st.seed); render(); } });
    const reseed = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { st.seed = st.seed % 9999 + 1; seedIn.value = String(st.seed); render(); } }, 'สุ่มสัญญาณรบกวนชุดใหม่');
    dBox.appendChild(h('div', { class: 'nlfd-grid' },
      h('label', { class: 'nlw-field' }, h('span', null, 'บิตที่จะส่ง (0/1 สูงสุด 24 บิต)'), bitsIn),
      h('label', { class: 'nlw-field' }, h('span', null, 'อัตราบิต (Bit rate)'), rateSel)));
    dBox.appendChild(h('div', { class: 'nlw-field' }, h('span', null, 'วิธีเข้ารหัสสาย (Line coding)'), codeSeg.el));
    dBox.appendChild(h('div', { class: 'nlfd-grid' }, rDist.el, rNoise.el));
    dBox.appendChild(h('div', { class: 'nlw-row nlw-center' },
      h('label', { class: 'nlw-check', style: 'min-height:44px' }, repChk, 'มีรีพีตเตอร์ทุก 100 m (สร้างสัญญาณใหม่)'),
      h('label', { class: 'nlw-field', style: 'flex-direction:row;align-items:center;gap:6px' }, h('span', null, 'seed'), seedIn), reseed));
    const dNote = h('p', { class: 'nlw-small' });
    const dPic = h('div', { class: 'nlfd-svg' });
    const bitsRows = h('div', { 'aria-live': 'polite' });
    const dVerdict = h('div', { class: 'nlw-result' });
    const sBit = stat('อัตราบิต'), sBaud = stat('อัตราสัญลักษณ์ (Baud)'), sAtt = stat('การลดทอน'), sSnr = stat('SNR ที่เครื่องรับ'), sErr = stat('บิตผิด');
    const formula = h('div', { class: 'nlfd-formula' });
    dBox.appendChild(dNote);
    dBox.appendChild(dPic);
    dBox.appendChild(bitsRows);
    dBox.appendChild(dVerdict);
    dBox.appendChild(h('div', { class: 'nlfd-stats' }, sBit.el, sBaud.el, sAtt.el, sSnr.el, sErr.el));
    dBox.appendChild(formula);
    dBox.appendChild(h('p', { class: 'nlw-small' }, `แบบจำลองอย่างง่าย: สายลดทอน ${DB_PER_100M} dB ต่อ 100 m (ค่าจริงขึ้นกับชนิดสายและความถี่) สัญญาณรบกวนแบบความร้อนเป็นแบบเกาส์ (Gaussian) เพิ่มที่เครื่องรับ เลข seed เดิมให้ผลเดิมทุกครั้ง เครื่องรับขยายสัญญาณกลับ (AGC) แล้วตัดสินที่จุดกลางของแต่ละช่วงสัญญาณ`));

    /* analog controls */
    const aBox = h('div', { hidden: true });
    const rA = range('แอมพลิจูด A', 0.5, 5, 0.5, st.A, v => fmtNum(v, 1) + ' V', v => { st.A = v; render(); });
    const rF = range('ความถี่ f', 0.5, 5, 0.5, st.f, v => fmtNum(v, 1) + ' kHz', v => { st.f = v; render(); });
    const rP = range('เฟส φ', 0, 315, 45, st.ph, v => v + '°', v => { st.ph = v; render(); });
    const rK = range('จำนวนฮาร์มอนิกคี่ที่รวม', 1, 15, 1, st.K, v => String(v), v => { st.K = v; render(); });
    const aSeg = seg([['sine', 'คลื่นไซน์เดียว'], ['sq', 'ประกอบคลื่นสี่เหลี่ยม']], 'sine', v => { st.sq = v === 'sq'; render(); }, 'รูปคลื่นแอนะล็อก');
    aBox.appendChild(aSeg.el);
    aBox.appendChild(h('div', { class: 'nlfd-grid' }, rA.el, rF.el, rP.el, rK.el));
    const aPic = h('div', { class: 'nlfd-svg' });
    const aStats = [stat('คาบ T = 1/f'), stat('ความถี่ f'), stat('ความยาวคลื่นในสายทองแดง'), stat('ค่าที่ t = 0')];
    const aInfo = h('div', { class: 'nlw-box' });
    aBox.appendChild(aPic);
    aBox.appendChild(h('div', { class: 'nlfd-stats', 'aria-live': 'polite' }, aStats.map(s => s.el)));
    aBox.appendChild(aInfo);

    root.appendChild(dBox);
    root.appendChild(aBox);

    function cleanBits() {
      let b = (st.bits || '').replace(/[^01]/g, '').slice(0, 24);
      let padded = false;
      if (!b.length) b = '0';
      if (st.code === 'pam4' && b.length % 2) { b += '0'; padded = true; }
      return { arr: b.split('').map(Number), padded: padded, bad: /[^01]/.test(st.bits || '') };
    }
    function simulate(bits) {
      const g = gaussFrom(mulberry32(st.seed));
      const segs = st.rep && st.dist > 100 ? Math.ceil(st.dist / 100) : 1;
      const segLen = segs > 1 ? st.dist / segs : st.dist;
      let cur = bits.slice(), last = null;
      for (let s = 0; s < segs; s++) {
        const tx = encode(cur, st.code);
        const att = DB_PER_100M * segLen / 100, gain = Math.pow(10, -att / 20);
        const raw = tx.map(v => v * gain + st.sigma * g());
        const norm = raw.map(v => v / gain);
        const dec = decode(norm, st.code, cur.length);
        last = { tx: tx, raw: raw, norm: norm, dec: dec, att: att, gain: gain, input: cur };
        cur = dec.bits;
      }
      last.segs = segs; last.segLen = segLen; last.out = cur;
      return last;
    }
    function trackPath(arr, x0, w, yc, sc, clip) {
      const N = arr.length, pts = [];
      for (let i = 0; i < N; i++) {
        const v = Math.max(-clip, Math.min(clip, arr[i]));
        pts.push(n(x0 + (i + 0.5) * w / N) + ' ' + n(yc - v * sc));
      }
      return 'M' + pts.join(' L');
    }
    function stepPath(arr, x0, w, yc, sc) {
      const N = arr.length; let d = '';
      for (let i = 0; i < N; i++) {
        const x1 = x0 + i * w / N, y = yc - arr[i] * sc;
        d += (i === 0 ? 'M' + n(x1) + ' ' + n(y) : ' L' + n(x1) + ' ' + n(y));
        if (i === N - 1 || arr[i + 1] !== arr[i]) d += ' L' + n(x0 + (i + 1) * w / N) + ' ' + n(y);
      }
      return d;
    }
    function renderDigital() {
      const cb = cleanBits(), bits = cb.arr, nb = bits.length, code = CODES[st.code];
      const sim = simulate(bits);
      const W = widthOf(dPic) - 2, x0 = 8, pw = W - 16, sc = 26;
      const yT = 56, yR = 150, yN = 248, H = 300;
      let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="inherit">`;
      // bit cells
      const bw = pw / nb;
      for (let b = 0; b <= nb; b++) s += L(x0 + b * bw, 18, x0 + b * bw, H - 8, { stroke: 'var(--line)', sw: 1, dash: '3 4' });
      for (let b = 0; b < nb; b++) s += T(x0 + (b + 0.5) * bw, 15, String(bits[b]), { size: bw < 16 ? 11 : 13, anchor: 'middle', weight: 700, mono: true, fill: 'var(--muted)' });
      // tracks
      const TR = [[yT, 'ส่ง (TX)'], [yR, 'ปลายสายก่อนขยาย'], [yN, 'หลังขยาย + จุดสุ่มตัวอย่าง']];
      TR.forEach(([y]) => { s += L(x0, y, x0 + pw, y, { stroke: 'var(--muted)', sw: 1, dash: '2 3' }); });
      s += P(stepPath(sim.tx, x0, pw, yT, sc), { stroke: 'var(--blue)', sw: 2.5 });
      s += P(trackPath(sim.raw, x0, pw, yR, sc, 1.6), { stroke: 'var(--orange)', sw: 1.4 });
      s += P(trackPath(sim.norm, x0, pw, yN, sc, 1.6), { stroke: 'var(--green)', sw: 1.4 });
      // thresholds
      const th = st.code === 'pam4' ? [-2 / 3, 0, 2 / 3] : st.code === 'man' ? [] : [0];
      th.forEach(t => { s += L(x0, yN - t * sc, x0 + pw, yN - t * sc, { stroke: 'var(--bad)', sw: 1.2, dash: '6 4' }); });
      // sample points
      const outBits = sim.out, wrong = new Set();
      outBits.forEach((b, i) => { if (b !== bits[i]) wrong.add(i); });
      const segWrong = new Set(); sim.dec.bits.forEach((b, i) => { if (b !== sim.input[i]) segWrong.add(i); });
      const N = sim.norm.length;
      sim.dec.pts.forEach(p => {
        const v = Math.max(-1.6, Math.min(1.6, sim.norm[p.i]));
        s += C(x0 + (p.i + 0.5) * pw / N, yN - v * sc, 4, { fill: segWrong.has(p.b) ? 'var(--bad)' : 'var(--ink)' });
      });
      TR.forEach(([y, t]) => {   // labels last so the traces never hide them
        s += R(x0 + 2, y - 47, Math.min(pw - 4, t.length * 7.2 + 14), 20, { rx: 4, fill: 'var(--panel)', fo: 0.92, stroke: 'var(--line)', sw: 1 });
        s += T(x0 + 9, y - 32, t, { size: 13, fill: 'var(--ink)', weight: 600 });
      });
      s += '</svg>';
      dPic.innerHTML = s;
      const sv = dPic.querySelector('svg');
      sv.setAttribute('role', 'img');
      sv.setAttribute('aria-label', `รูปคลื่น ${code.name} ของบิต ${bits.join('')} ที่ระยะ ${st.dist} เมตร: สัญญาณส่ง สัญญาณที่ปลายสาย และสัญญาณหลังขยายพร้อมจุดสุ่มตัวอย่าง ถอดได้ ${outBits.join('')} ผิด ${wrong.size} บิต`);
      // bits rows
      const row = (label, arr, mark) => h('div', { class: 'nlfd-bits' }, h('span', null, label), arr.map((b, i) => h('i', { class: mark && mark.has(i) ? 'nlfd-err' : null, title: mark && mark.has(i) ? 'บิตที่ ' + (i + 1) + ' ผิด' : null }, String(b))));
      bitsRows.replaceChildren(row('ส่ง', bits), row('ถอดได้', outBits, wrong));
      const notes = [];
      if (cb.bad) notes.push('ตัดอักขระที่ไม่ใช่ 0/1 ออกแล้ว');
      if (cb.padded) notes.push('PAM-4 ส่งครั้งละ 2 บิต จึงเติม 0 ท้ายให้ครบคู่');
      if (st.code === 'nrzl') notes.push('NRZ-L: ระดับสัญญาณบอกค่าบิตตรง ๆ (แล็บนี้ใช้ 1 = +V, 0 = −V บางตำราใช้กลับกัน)');
      if (st.code === 'nrzi') notes.push('NRZ-I: บิต 1 = กลับระดับที่ต้นบิต, บิต 0 = คงระดับเดิม เครื่องรับดูว่าระดับเปลี่ยนหรือไม่');
      if (st.code === 'man') notes.push('Manchester (แบบ IEEE 802.3 ของ 10BASE-T): ทุกบิตมีการเปลี่ยนระดับกลางบิต 1 = ต่ำไปสูง, 0 = สูงไปต่ำ เครื่องรับเทียบครึ่งแรกกับครึ่งหลัง');
      if (st.code === 'pam4') notes.push('PAM-4: 4 ระดับ ระดับละ 2 บิต (00, 01, 11, 10 แบบ Gray code) ระยะห่างระหว่างระดับแคบลง จึงทนสัญญาณรบกวนได้น้อยกว่า');
      dNote.textContent = notes.join(' · ');
      // stats
      const baud = st.rate / code.r;
      sBit.b.textContent = st.rate + ' Mbps';
      sBaud.b.textContent = fmtNum(baud) + ' Mbaud';
      sAtt.b.textContent = sim.segs > 1 ? `${fmtNum(sim.att, 1)} dB/ช่วง × ${sim.segs}` : `${fmtNum(sim.att, 1)} dB (เหลือ ${fmtNum(sim.gain * 100, 1)}%)`;
      const snr = st.sigma > 0 ? 20 * Math.log10(sim.gain / st.sigma) : Infinity;
      sSnr.b.textContent = isFinite(snr) ? fmtNum(snr, 1) + ' dB' : 'ไม่มีสัญญาณรบกวน';
      sErr.b.textContent = `${wrong.size} / ${nb} บิต`;
      const rTxt = code.r === 0.5 ? 'r = 1/2 (2 ช่วงสัญญาณต่อ 1 บิต)' : `r = log2(${code.L}) = ${code.r} บิตต่อสัญลักษณ์`;
      formula.textContent = `${code.name}: ${rTxt} → Baud = Bit rate / r = ${st.rate} / ${code.r === 0.5 ? '0.5' : code.r} = ${fmtNum(baud)} Mbaud`;
      // verdict
      const ber = wrong.size / nb;
      dVerdict.className = 'nlw-result ' + (wrong.size === 0 ? 'nlw-is-ok' : ber <= 0.1 ? 'nlw-is-warn' : 'nlw-is-bad');
      const via = sim.segs > 1 ? `ผ่านรีพีตเตอร์ ${sim.segs - 1} ตัว แต่ละช่วงยาว ${fmtNum(sim.segLen, 1)} m` : `สายยาว ${st.dist} m ไม่มีรีพีตเตอร์`;
      dVerdict.textContent = wrong.size === 0
        ? `รับถูกทุกบิต (${via})`
        : `บิตผิด ${wrong.size} จาก ${nb} บิต (BER ≈ ${fmtNum(ber * 100, 1)}%) ${via}` + (st.code === 'nrzi' ? ' · NRZ-I ตัดสินระดับผิดครั้งเดียวทำให้บิตผิดได้ 2 บิตติดกัน' : '');
    }
    function renderAnalog() {
      const W = widthOf(aPic) - 2, x0 = 52, pw = W - x0 - 14, yc = 120, sc = 18, H = 268;   // 1 V = 18 px, window 2 ms
      const tmax = 2, fk = st.f, ph = st.ph * Math.PI / 180, A = st.A;
      const yv = v => yc - v * sc, xt = t => x0 + t / tmax * pw;
      let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="inherit">` + arrowDefs('nlfd-sl-ar', 'var(--ink)');
      [-5, -2.5, 0, 2.5, 5].forEach(v => { s += L(x0, yv(v), x0 + pw, yv(v), { stroke: 'var(--line)', sw: v === 0 ? 1.5 : 1, dash: v === 0 ? null : '3 4' }); s += T(x0 - 6, yv(v) + 5, (v > 0 ? '+' : '') + v + ' V', { size: 12, anchor: 'end', fill: 'var(--muted)' }); });
      for (let t = 0; t <= tmax + 1e-9; t += 0.5) { s += L(xt(t), yv(-5), xt(t), yv(-5) + 5, { stroke: 'var(--muted)', sw: 1 }); s += T(xt(t), yv(-5) + 20, fmtNum(t, 1) + (t === tmax ? ' ms' : ''), { size: 12, anchor: t === tmax ? 'end' : 'middle', fill: 'var(--muted)' }); }
      const M = Math.max(200, Math.round(pw));
      const sine = (t, amp, f, p) => amp * Math.sin(2 * Math.PI * f * t + p);   // t ms, f kHz -> cycles
      const path = fn => { const pts = []; for (let i = 0; i <= M; i++) { const t = i / M * tmax; pts.push(n(xt(t)) + ' ' + n(yv(Math.max(-6.2, Math.min(6.2, fn(t)))))); } return 'M' + pts.join(' L'); };
      let sq = null;
      if (st.sq) {
        // ideal square wave (dashed) and its Fourier partial sum with K odd harmonics
        s += P(path(t => (Math.sin(2 * Math.PI * fk * t + ph) >= 0 ? A : -A)), { stroke: 'var(--muted)', sw: 1.5, dash: '5 4' });
        sq = t => { let v = 0; for (let k = 1; k <= st.K; k++) { const m = 2 * k - 1; v += Math.sin(m * (2 * Math.PI * fk * t + ph)) / m; } return 4 * A / Math.PI * v; };
        s += P(path(sq), { stroke: 'var(--blue)', sw: 2.5 });
      } else {
        if (st.ph) s += P(path(t => sine(t, A, fk, 0)), { stroke: 'var(--muted)', sw: 1.5, dash: '5 4' });
        s += P(path(t => sine(t, A, fk, ph)), { stroke: 'var(--blue)', sw: 2.8 });
        // period arrow between the first two crests
        let t0 = (Math.PI / 2 - ph) / (2 * Math.PI * fk); const T0 = 1 / fk;
        while (t0 < 0) t0 += T0;
        if (t0 + T0 <= tmax + 1e-9) {
          const ya = yv(A) - 12;
          s += L(xt(t0), yv(A), xt(t0), ya - 6, { stroke: 'var(--muted)', sw: 1, dash: '3 3' }) + L(xt(t0 + T0), yv(A), xt(t0 + T0), ya - 6, { stroke: 'var(--muted)', sw: 1, dash: '3 3' });
          s += L(xt(t0) + 2, ya, xt(t0 + T0) - 2, ya, { stroke: 'var(--ink)', sw: 1.5, ms: 'url(#nlfd-sl-ar)', me: 'url(#nlfd-sl-ar)' });
          s += R((xt(t0) + xt(t0 + T0)) / 2 - 50, ya - 22, 100, 18, { rx: 4, fill: 'var(--field)', fo: 0.9 });
          s += T((xt(t0) + xt(t0 + T0)) / 2, ya - 8, 'T = ' + fmtNum(T0 * 1000, 0) + ' µs', { size: 13, anchor: 'middle', weight: 700 });
        }
      }
      s += '</svg>';
      aPic.innerHTML = s;
      const sv = aPic.querySelector('svg'); sv.setAttribute('role', 'img');
      sv.setAttribute('aria-label', st.sq ? `คลื่นสี่เหลี่ยมความถี่ ${st.f} kHz ประกอบจากฮาร์มอนิกคี่ ${st.K} ตัว` : `คลื่นไซน์ แอมพลิจูด ${st.A} V ความถี่ ${st.f} kHz เฟส ${st.ph} องศา ช่วงเวลา 0 ถึง 2 ms`);
      const Tms = 1 / st.f;
      aStats[0].b.textContent = fmtNum(Tms, 3) + ' ms';
      aStats[1].b.textContent = fmtNum(st.f * 1000, 0) + ' Hz';
      aStats[2].b.textContent = fmtNum(2e8 / (st.f * 1000) / 1000, 1) + ' km';
      aStats[3].b.textContent = fmtNum(st.sq ? sq(0) : sine(0, A, fk, ph), 2) + ' V';
      rK.el.hidden = !st.sq; rP.el.hidden = false;
      if (st.sq) {
        const hi = (2 * st.K - 1) * st.f;
        aInfo.replaceChildren(
          h('p', null, h('b', null, 'แบนด์วิดท์ (Bandwidth): '), `ใช้ความถี่ตั้งแต่ ${fmtNum(st.f, 1)} kHz ถึง ${fmtNum(hi, 1)} kHz (ฮาร์มอนิก 1, 3, 5, ... ถึง ${2 * st.K - 1}) ช่วงความถี่ที่ใช้กว้าง ${fmtNum(hi - st.f, 1)} kHz`),
          h('p', null, 'ยิ่งช่องสัญญาณยอมให้ความถี่สูงผ่านได้มาก (แบนด์วิดท์กว้าง) ขอบของสัญญาณดิจิทัลยิ่งคม ถ้าแบนด์วิดท์แคบ สัญญาณจะมนจนแยก 0 กับ 1 ยาก จึงส่งบิตได้ช้าลง'),
          h('p', { class: 'nlw-small' }, 'สูตร: คลื่นสี่เหลี่ยม ≈ (4A/π) [sin x + sin 3x / 3 + sin 5x / 5 + ...] โดย x = 2πft + φ'));
      } else {
        aInfo.replaceChildren(
          h('p', null, h('b', null, 'สูตร: '), `v(t) = A sin(2πft + φ) = ${fmtNum(st.A, 1)} sin(2π × ${fmtNum(st.f * 1000, 0)} t + ${st.ph}°)`),
          h('p', null, `คลื่นนี้ครบ ${fmtNum(st.f * 2, 1)} รอบในกรอบ 2 ms เพราะ f = ${fmtNum(st.f, 1)} kHz คือ ${fmtNum(st.f * 1000, 0)} รอบต่อวินาที` + (st.ph ? ` เส้นประคือคลื่นเดิมที่เฟส 0° เลื่อนเฟส ${st.ph}° เท่ากับเลื่อนเวลา ${fmtNum(st.ph / 360 * Tms * 1000, 1)} µs` : '')),
          h('p', { class: 'nlw-small' }, 'ความยาวคลื่นคิดจาก λ = v/f โดยประมาณความเร็วในสายทองแดง v ≈ 2×10⁸ m/s'));
      }
    }
    function render() {
      dBox.hidden = st.mode !== 'digital'; aBox.hidden = st.mode !== 'analog';
      if (st.mode === 'digital') renderDigital(); else renderAnalog();
    }
    onResize(root, render);
    render();
  });

  /* ======================================================================
     widget: mux-lab
     ====================================================================== */
  const SRC = ['A', 'B', 'C', 'D'];
  const SCOL = ['var(--blue)', 'var(--green)', 'var(--orange)', 'var(--brown)'];
  const TICKS = 8;
  const CARR = [20, 30, 40, 50];          // kHz, one per band; symbol time 1 ms
  const NS = 128;                          // samples per symbol (fs = 128 kHz)
  const code = c => c === '.' ? 0 : c.charCodeAt(0) - 64;          // A=1 ... Z=26
  const fromCode = v => v <= 0 ? '.' : v > 26 ? '?' : String.fromCharCode(64 + v);

  NL_FIG('widget', 'mux-lab', function (root) {
    frame(root, 'nlfd-mux', 'Mux Lab: TDM และ FDM',
      'แหล่งข้อมูล A ถึง D ส่งตัวอักษรทีละช่วงเวลา (จุด . คือช่วงที่ไม่มีข้อมูล) เลือกวิธีมัลติเพล็กซ์ แล้วกำหนดช่องเวลา (slot) หรือย่านความถี่ของฝั่งส่งและฝั่งรับ ดูตารางผลลัพธ์ว่าแต่ละปลายทางได้ข้อมูลถูกต้องหรือปนกัน');
    const st = { mode: 'sync', data: ['HELLO...', 'NET.....', '..LAN...', '....OK..'], tx: [0, 1, 2, 3], rx: [0, 1, 2, 3], slip: 0, S: 2, ftx: [0, 1, 2, 3], frx: [0, 1, 2, 3] };
    const modeSeg = seg([['sync', 'TDM แบบซิงโครนัส'], ['stat', 'TDM เชิงสถิติ'], ['fdm', 'FDM']], st.mode, v => { st.mode = v; render(); }, 'วิธีมัลติเพล็กซ์');
    root.appendChild(modeSeg.el);
    const ins = st.data.map((d, i) => {
      const inp = h('input', { type: 'text', value: d, maxlength: String(TICKS), spellcheck: 'false', 'aria-label': 'ข้อมูลของแหล่ง ' + SRC[i] + ' (A-Z และจุด)' });
      inp.addEventListener('input', () => { st.data[i] = norm(inp.value); render(); });
      return inp;
    });
    function norm(v) { return (String(v || '').toUpperCase().replace(/[^A-Z.]/g, '.') + '........').slice(0, TICKS); }
    root.appendChild(h('div', { class: 'nlfd-h' }, 'ข้อมูลต้นทาง (8 ช่วงเวลา)'));
    root.appendChild(h('div', { class: 'nlfd-srcs' }, ins.map((inp, i) => h('label', { class: 'nlw-field' }, h('span', { style: `color:${SCOL[i]}` }, 'แหล่ง ' + SRC[i]), inp))));

    const cfg = h('div');
    const pic = h('div');
    const outBox = h('div', { 'aria-live': 'polite' });
    const verdict = h('div', { class: 'nlw-result' });
    const stats = h('div', { class: 'nlfd-stats' });
    const info = h('div', { class: 'nlw-box' });
    root.appendChild(cfg); root.appendChild(pic); root.appendChild(verdict); root.appendChild(outBox); root.appendChild(stats); root.appendChild(info);

    function sel(label, opts, val, onCh) {
      const s = h('select', { 'aria-label': label, onchange: () => onCh(+s.value) });
      opts.forEach((t, i) => s.appendChild(h('option', { value: String(i), selected: i === val }, t)));
      return h('label', { class: 'nlw-field' }, h('span', null, label), s);
    }
    function swapSet(arr, i, v) { const j = arr.indexOf(v); if (j >= 0 && j !== i) arr[j] = arr[i]; arr[i] = v; }
    const tag = i => h('span', { class: 'nlfd-tag', style: `background:${SCOL[i]}` }, SRC[i]);
    function presetBtn(label, fn) { return h('button', { type: 'button', class: 'nlw-btn', 'aria-label': label, onclick: () => { fn(); render(); } }, label); }

    function buildCfg() {
      cfg.replaceChildren();
      if (st.mode === 'sync') {
        cfg.appendChild(h('div', { class: 'nlfd-h' }, 'ฝั่งส่ง (MUX): ช่องเวลาในแต่ละเฟรม'));
        cfg.appendChild(h('div', { class: 'nlfd-map' }, [0, 1, 2, 3].map(s => sel('slot ' + (s + 1) + ' ใส่ข้อมูลของ', SRC.map(x => 'แหล่ง ' + x), st.tx[s], v => { swapSet(st.tx, s, v); render(); }))));
        cfg.appendChild(h('div', { class: 'nlfd-h' }, 'ฝั่งรับ (DEMUX): ส่ง slot ไปยังปลายทาง'));
        cfg.appendChild(h('div', { class: 'nlfd-map' }, [0, 1, 2, 3].map(s => sel('slot ' + (s + 1) + ' ส่งไป', SRC.map(x => 'ปลายทาง ' + x), st.rx[s], v => { swapSet(st.rx, s, v); render(); })),
          sel('ฝั่งรับเริ่มนับเฟรมเลื่อนไป', ['0 slot (ซิงค์ตรง)', '1 slot', '2 slot', '3 slot'], st.slip, v => { st.slip = v; render(); })));
        cfg.appendChild(h('div', { class: 'nlw-row' },
          presetBtn('ตั้งให้ตรงกัน', () => { st.tx = [0, 1, 2, 3]; st.rx = [0, 1, 2, 3]; st.slip = 0; }),
          presetBtn('ฝั่งรับสลับ slot 2 กับ 3', () => { st.tx = [0, 1, 2, 3]; st.rx = [0, 2, 1, 3]; st.slip = 0; }),
          presetBtn('เฟรมเลื่อน 1 slot', () => { st.tx = [0, 1, 2, 3]; st.rx = [0, 1, 2, 3]; st.slip = 1; })));
      } else if (st.mode === 'stat') {
        cfg.appendChild(h('div', { class: 'nlfd-map' }, sel('จำนวน slot ต่อเฟรม', ['1 slot', '2 slot', '3 slot', '4 slot'], st.S - 1, v => { st.S = v + 1; render(); })));
      } else {
        const bands = CARR.map((c, i) => `ช่อง ${i + 1} (${c} kHz)`);
        cfg.appendChild(h('div', { class: 'nlfd-h' }, 'ฝั่งส่ง: แต่ละแหล่งมอดูเลตลงคลื่นพาห์ของช่อง'));
        cfg.appendChild(h('div', { class: 'nlfd-map' }, [0, 1, 2, 3].map(i => sel('แหล่ง ' + SRC[i] + ' ใช้', bands, st.ftx[i], v => { st.ftx[i] = v; render(); }))));
        cfg.appendChild(h('div', { class: 'nlfd-h' }, 'ฝั่งรับ: แต่ละปลายทางจูนตัวกรองไปที่ช่อง'));
        cfg.appendChild(h('div', { class: 'nlfd-map' }, [0, 1, 2, 3].map(i => sel('ปลายทาง ' + SRC[i] + ' จูน', bands, st.frx[i], v => { st.frx[i] = v; render(); }))));
        cfg.appendChild(h('div', { class: 'nlw-row' },
          presetBtn('ตั้งให้ตรงกัน', () => { st.ftx = [0, 1, 2, 3]; st.frx = [0, 1, 2, 3]; }),
          presetBtn('A และ B ใช้ช่องเดียวกัน', () => { st.ftx = [0, 0, 2, 3]; st.frx = [0, 1, 2, 3]; }),
          presetBtn('ปลายทาง C จูนผิดช่อง', () => { st.ftx = [0, 1, 2, 3]; st.frx = [0, 1, 3, 3]; })));
      }
    }
    function expected(i) { return st.data[i]; }
    function cellTd(ch, src, cls) {
      return h('td', { class: (ch === '.' ? 'nlfd-idle ' : '') + (cls || '') }, src != null ? tag(src) : null, ' ', h('span', { class: 'nlfd-mono' }, ch === '.' ? 'ว่าง' : ch));
    }
    function outTable(rows) {
      const tb = h('table', { class: 'nlfd-tab' },
        h('thead', null, h('tr', null, h('th', null, 'ปลายทาง'), h('th', null, 'ต้นทางส่ง'), h('th', null, 'ได้รับ'), h('th', null, 'ผล'))),
        h('tbody', null, rows.map((r, i) => h('tr', null, h('td', null, tag(i)), h('td', { class: 'nlfd-mono' }, r.want || '(ไม่มี)'), h('td', { class: 'nlfd-mono' }, r.got || '(ไม่มี)'),
          h('td', { class: r.ok ? 'nlfd-ok' : 'nlfd-bad' }, r.ok ? 'ถูกต้อง' : r.why)))));
      outBox.replaceChildren(h('div', { class: 'nlfd-h' }, 'ผลที่ปลายทาง (DEMUX)'), h('div', { class: 'nlfd-scroll' }, tb));
      const bad = rows.filter(r => !r.ok).length;
      verdict.className = 'nlw-result ' + (bad ? 'nlw-is-bad' : 'nlw-is-ok');
      return bad;
    }
    function statsSet(list) { stats.replaceChildren(...list.map(([k, v]) => h('div', { class: 'nlfd-stat' }, h('span', null, k), h('b', null, v)))); }

    function renderSync() {
      // serial stream: frame t, slot s carries source tx[s] at time t
      const stream = [];
      for (let t = 0; t < TICKS; t++) for (let s = 0; s < 4; s++) stream.push({ src: st.tx[s], ch: st.data[st.tx[s]][t] });
      const got = ['', '', '', ''];
      const rxFrames = [];
      for (let f = 0; ; f++) {
        const base = st.slip + f * 4; if (base + 3 >= stream.length) break;   // incomplete last frame is dropped
        const fr = [];
        for (let s = 0; s < 4; s++) { const e = stream[base + s]; fr.push(e); if (e.ch !== '.') got[st.rx[s]] += e.ch; }
        rxFrames.push(fr);
      }
      const head = h('tr', null, h('th', null, 'เฟรม'), [0, 1, 2, 3].map(s => h('th', null, 'slot ' + (s + 1))));
      const txT = h('table', { class: 'nlfd-tab' }, h('thead', null, head), h('tbody', null, Array.from({ length: TICKS }, (_, t) => h('tr', null, h('th', null, String(t + 1)), [0, 1, 2, 3].map(s => cellTd(stream[t * 4 + s].ch, stream[t * 4 + s].src))))));
      const rxT = h('table', { class: 'nlfd-tab' }, h('thead', null, h('tr', null, h('th', null, 'เฟรมที่รับ'), [0, 1, 2, 3].map(s => h('th', null, 'slot ' + (s + 1) + ' → ', tag(st.rx[s]))))),
        h('tbody', null, rxFrames.map((fr, f) => h('tr', null, h('th', null, String(f + 1)), fr.map(e => cellTd(e.ch, e.src))))));
      pic.replaceChildren(h('div', { class: 'nlfd-h' }, 'สิ่งที่ส่งในสาย (ทุก slot ถูกส่งแม้ว่าง)'), h('div', { class: 'nlfd-scroll' }, txT),
        h('div', { class: 'nlfd-h' }, 'ฝั่งรับแบ่งเฟรมและส่งต่อ (สีป้ายคือแหล่งที่มาจริงของข้อมูลในช่องนั้น)'), h('div', { class: 'nlfd-scroll' }, rxT));
      const rows = [0, 1, 2, 3].map(i => {
        const want = expected(i).replace(/\./g, ''), g = got[i];
        return { want: want, got: g, ok: want === g, why: g.length < want.length ? 'ขาดหาย/ปนกัน' : 'ข้อมูลปนกัน' };
      });
      const bad = outTable(rows);
      const idle = stream.filter(e => e.ch === '.').length;
      verdict.textContent = bad ? `ปลายทาง ${bad} แห่งได้ข้อมูลผิด: ฝั่งส่งและฝั่งรับต้องตกลงตำแหน่ง slot และจังหวะเริ่มเฟรมให้ตรงกัน` : 'ทุกปลายทางได้ข้อมูลถูกต้อง เพราะฝั่งรับรู้ตำแหน่ง slot จากลำดับในเฟรม (ไม่ต้องมีที่อยู่ในข้อมูล)';
      statsSet([['slot ที่ส่งทั้งหมด', String(stream.length)], ['slot ว่าง (เสียเปล่า)', `${idle} (${Math.round(idle / stream.length * 100)}%)`], ['ประสิทธิภาพ', Math.round((stream.length - idle) / stream.length * 100) + '%'], ['บิตที่ส่ง (8 บิต/slot)', String(stream.length * 8)]]);
      info.replaceChildren(h('p', null, h('b', null, 'TDM แบบซิงโครนัส: '), 'แต่ละแหล่งได้ slot ประจำในทุกเฟรม แม้ไม่มีข้อมูลก็ต้องส่ง slot ว่าง ฝั่งรับรู้ว่าข้อมูลเป็นของใครจากตำแหน่งในเฟรม ระบบจริงจึงมีบิตจัดเฟรม (framing) ไว้ให้ฝั่งรับซิงค์ได้ ถ้าซิงค์เลื่อนไปแม้ 1 slot ข้อมูลจะปนกันทั้งหมด'));
    }
    function renderStat() {
      const S = st.S, q = [[], [], [], []], frames = [], got = ['', '', '', ''];
      let ptr = 0, maxWait = 0, used = 0;
      for (let f = 0; f < 64; f++) {
        if (f < TICKS) for (let i = 0; i < 4; i++) if (st.data[i][f] !== '.') q[i].push({ ch: st.data[i][f], t: f });
        if (f >= TICKS && q.every(x => !x.length)) break;
        const fr = [];
        for (let k = 0; k < 4 && fr.length < S; k++) {
          const i = (ptr + k) % 4;
          if (q[i].length) { const e = q[i].shift(); fr.push({ src: i, ch: e.ch, wait: f - e.t }); maxWait = Math.max(maxWait, f - e.t); }
        }
        if (fr.length) ptr = (fr[fr.length - 1].src + 1) % 4;
        used += fr.length;
        fr.forEach(e => { got[e.src] += e.ch; });   // DEMUX reads the address in each slot
        frames.push(fr);
      }
      const tb = h('table', { class: 'nlfd-tab' }, h('thead', null, h('tr', null, h('th', null, 'เฟรม'), Array.from({ length: S }, (_, k) => h('th', null, 'slot ' + (k + 1) + ' [ที่อยู่|ข้อมูล]')))),
        h('tbody', null, frames.map((fr, f) => h('tr', null, h('th', null, String(f + 1)), Array.from({ length: S }, (_, k) => fr[k]
          ? h('td', null, h('span', { class: 'nlfd-mono' }, '[' + fr[k].src.toString(2).padStart(2, '0') + '|'), tag(fr[k].src), h('span', { class: 'nlfd-mono' }, ' ' + fr[k].ch + ']'), fr[k].wait ? h('span', { class: 'nlw-small' }, ' รอ ' + fr[k].wait) : null)
          : h('td', { class: 'nlfd-idle' }, 'ว่าง'))))));
      pic.replaceChildren(h('div', { class: 'nlfd-h' }, 'เฟรมที่ส่ง: ใส่เฉพาะข้อมูลที่มีจริง พร้อมที่อยู่ 2 บิต (00=A, 01=B, 10=C, 11=D)'), h('div', { class: 'nlfd-scroll' }, tb));
      const rows = [0, 1, 2, 3].map(i => { const want = expected(i).replace(/\./g, ''); return { want: want, got: got[i], ok: want === got[i], why: 'ผิด' }; });
      outTable(rows);
      const slots = frames.length * S, bitsStat = slots * 10, bitsSync = TICKS * 4 * 8, late = frames.length - TICKS;
      verdict.textContent = `ทุกปลายทางได้ข้อมูลถูกต้องจากที่อยู่ใน slot ใช้ ${frames.length} เฟรม` + (late > 0 ? ` (นานกว่าข้อมูลเข้า ${late} เฟรม เพราะช่วงที่ข้อมูลมาพร้อมกันมากกว่าจำนวน slot ต้องรอในบัฟเฟอร์)` : '');
      statsSet([['slot ที่ส่ง', `${slots} (ว่าง ${slots - used})`], ['บิตที่ส่ง (10 บิต/slot)', String(bitsStat)], ['ถ้าใช้ TDM ซิงโครนัส', bitsSync + ' บิต'], ['รอในบัฟเฟอร์นานสุด', maxWait + ' เฟรม']]);
      info.replaceChildren(h('p', null, h('b', null, 'TDM เชิงสถิติ (Statistical TDM): '), 'จัด slot ให้เฉพาะแหล่งที่มีข้อมูลจริง เฟรมจึงมี slot น้อยกว่าจำนวนแหล่งได้ แต่ทุก slot ต้องมีที่อยู่ (address) บอกเจ้าของ และถ้าหลายแหล่งส่งพร้อมกันเกินจำนวน slot ข้อมูลต้องรอในบัฟเฟอร์ ลองลดเหลือ 1 slot แล้วดูเวลารอ'));
    }
    function renderFdm() {
      const nT = TICKS, N = nT * NS, x = new Float64Array(N);
      for (let i = 0; i < 4; i++) {
        const k = CARR[st.ftx[i]] * NS / 128;   // cycles per symbol window: f(kHz) * 1 ms
        for (let t = 0; t < nT; t++) { const a = code(st.data[i][t]) / 26; if (!a) continue; for (let m = 0; m < NS; m++) x[t * NS + m] += a * Math.cos(2 * Math.PI * k * m / NS); }
      }
      // receiver: correlate each symbol window with the tuned carrier (coherent demodulation)
      const got = [0, 1, 2, 3].map(j => {
        const k = CARR[st.frx[j]] * NS / 128; let s = '';
        for (let t = 0; t < nT; t++) { let acc = 0; for (let m = 0; m < NS; m++) acc += x[t * NS + m] * Math.cos(2 * Math.PI * k * m / NS); s += fromCode(Math.round(acc * 2 / NS * 26)); }
        return s;
      });
      // spectrum of the combined signal (DFT magnitude, 0..64 kHz, 125 Hz per bin)
      const bins = N / 2, mag = new Float64Array(bins + 1), cs = new Float64Array(N), sn = new Float64Array(N);
      for (let i = 0; i < N; i++) { cs[i] = Math.cos(2 * Math.PI * i / N); sn[i] = Math.sin(2 * Math.PI * i / N); }
      let mx = 1e-9;
      for (let b = 0; b <= bins; b++) { let re = 0, im = 0, idx = 0; for (let i = 0; i < N; i++) { re += x[i] * cs[idx]; im -= x[i] * sn[idx]; idx += b; if (idx >= N) idx -= N; } mag[b] = Math.hypot(re, im); if (mag[b] > mx) mx = mag[b]; }
      const W = widthOf(root) - 30, x0 = 10, pw = W - 20, base = 190, hh = 140, fmax = 64;
      const xf = f => x0 + f / fmax * pw;
      let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 250" font-family="inherit">`;
      CARR.forEach((c, bi) => {
        const users = [0, 1, 2, 3].filter(i => st.ftx[i] === bi);
        const col = users.length > 1 ? 'var(--bad)' : users.length ? SCOL[users[0]] : 'var(--line)';
        s += R(xf(c - 4), base - hh - 10, xf(c + 4) - xf(c - 4), hh + 10, { fill: col, fo: users.length ? 0.14 : 0.05, stroke: col, sw: 1, dash: users.length ? null : '3 3' });
        s += T(xf(c), base - hh - 16, users.length ? users.map(i => SRC[i]).join('+') + (users.length > 1 ? ' ชนกัน' : '') : 'ว่าง', { size: 13, anchor: 'middle', weight: 700, fill: users.length > 1 ? 'var(--bad)' : 'var(--ink)' });
      });
      const pts = []; for (let b = 0; b <= bins; b++) pts.push(n(xf(b * 128 / N)) + ' ' + n(base - Math.sqrt(mag[b] / mx) * hh));
      s += P('M' + pts.join(' L'), { stroke: 'var(--ink)', sw: 1.3 });
      s += L(x0, base, x0 + pw, base, { stroke: 'var(--muted)', sw: 1.2 });
      for (let f = 0; f <= fmax; f += 10) { s += L(xf(f), base, xf(f), base + 5, { stroke: 'var(--muted)', sw: 1 }); s += T(xf(f), base + 20, String(f), { size: 12, anchor: 'middle', fill: 'var(--muted)' }); }
      s += T(x0 + pw, base + 40, 'ความถี่ (kHz)', { size: 13, anchor: 'end', fill: 'var(--muted)' });
      s += T(x0, base + 40, 'สเปกตรัมของสัญญาณรวม (คำนวณด้วย DFT)', { size: 13, fill: 'var(--muted)' });
      s += '</svg>';
      const box = h('div', { class: 'nlfd-svg' }); box.innerHTML = s;
      const sv = box.querySelector('svg'); sv.setAttribute('role', 'img');
      sv.setAttribute('aria-label', 'สเปกตรัมสัญญาณรวม: ' + CARR.map((c, bi) => { const u = [0, 1, 2, 3].filter(i => st.ftx[i] === bi).map(i => SRC[i]); return `ช่อง ${bi + 1} ${c} kHz ${u.length ? 'แหล่ง ' + u.join(' และ ') : 'ว่าง'}`; }).join(', '));
      pic.replaceChildren(box);
      const rows = [0, 1, 2, 3].map(i => {
        const want = expected(i), g = got[i];
        const why = st.frx[i] !== st.ftx[i] ? 'จูนไม่ตรงช่องของต้นทาง' : 'สัญญาณสองแหล่งรวมกันในช่องเดียว';
        return { want: want, got: g, ok: want === g, why: why };
      });
      const bad = outTable(rows);
      verdict.textContent = bad ? `ปลายทาง ${bad} แห่งได้ข้อมูลผิด: ถ้าสองแหล่งใช้ช่องเดียวกัน สัญญาณจะบวกกัน (เช่น H=8 รวมกับ N=14 ได้ 22 = V) แยกกลับไม่ได้` : 'ทุกปลายทางได้ข้อมูลถูกต้อง แต่ละแหล่งอยู่คนละย่านความถี่ ตัวกรองจึงแยกออกจากกันได้ แม้ส่งพร้อมกัน';
      const usedB = new Set(st.ftx).size;
      statsSet([['ช่องความถี่ที่ใช้', usedB + ' จาก 4'], ['ส่งพร้อมกัน', 'ทุกแหล่ง ตลอดเวลา'], ['ระยะห่างคลื่นพาห์', '10 kHz']]);
      info.replaceChildren(
        h('p', null, h('b', null, 'FDM: '), 'แต่ละแหล่งมอดูเลตข้อมูลลงคลื่นพาห์ (Carrier) คนละความถี่ แล้วรวมกันส่งในสื่อเดียว ฝั่งรับแยกด้วยตัวกรองหรือการคูณกับคลื่นพาห์ที่จูนไว้'),
        h('p', { class: 'nlw-small' }, 'แบบจำลอง: ตัวอักษร A–Z แทนด้วยแอมพลิจูด 1/26 ถึง 26/26 ช่วงละ 1 ms (ASK) คลื่นพาห์ 20, 30, 40, 50 kHz อัตราสุ่ม 128 kHz ฝั่งรับหาแอมพลิจูดด้วยการคูณกับคลื่นพาห์แล้วเฉลี่ย ค่าที่เกิน Z แสดงเป็น ?'));
    }
    function render() {
      ins.forEach((inp, i) => { if (document.activeElement !== inp) inp.value = st.data[i]; });
      const ae = document.activeElement, fl = ae && cfg.contains(ae) ? ae.getAttribute('aria-label') : null;
      buildCfg();
      if (fl) { const again = Array.from(cfg.querySelectorAll('[aria-label]')).find(e => e.getAttribute('aria-label') === fl); if (again) again.focus(); }
      if (st.mode === 'sync') renderSync(); else if (st.mode === 'stat') renderStat(); else renderFdm();
    }
    onResize(root, () => { if (st.mode === 'fdm') render(); });
    render();
  });
})();
