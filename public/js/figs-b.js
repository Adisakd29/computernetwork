'use strict';
/* NetLab 2.6 figures, batch b. Register with NL_FIG('diagram'|'widget', name, svgString|mountFn). */
window.NL_FIG = window.NL_FIG || function (kind, name, v) { const k = kind === 'diagram' ? 'NL_DIAGRAMS' : 'NL_WIDGETS'; (window[k] = window[k] || {})[name] = v; };

/* Weeks 4-9: Ethernet standards, duplex, UTP cable, crimping, Wi-Fi placement/generations/channels,
   Windows adapters and ipconfig. Diagrams are built once at load into plain SVG strings.
   Colours use the theme CSS variables, except real wire colours (fixed hex so they stay true in dark mode). */
(function () {
  const MONO = '"JetBrains Mono",Consolas,monospace';
  // real conductor colours (TIA-568 colour code); fixed on purpose
  const WC = { o: '#EE7A16', g: '#2C9A47', b: '#2862D6', br: '#7B4A22', w: '#FFFFFF', edge: '#59616B', cu: '#C27A3E', cuHi: '#E3A066', foil: '#AEB6BF', nylon: '#E9DDB4', clear: '#DCE7EE' };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function n(v) { return Math.round(v * 10) / 10; }
  function attrs(o) {
    let s = '';
    for (const k in o) if (o[k] != null && o[k] !== false) s += ` ${k}="${o[k]}"`;
    return s;
  }
  // text
  function T(x, y, s, o) {
    o = o || {};
    const ff = o.mono ? ` font-family='${MONO}'` : ' font-family="inherit"';
    return `<text${attrs({ x: n(x), y: n(y), 'font-size': o.size || 14, 'text-anchor': o.anchor || 'start', fill: o.fill || 'var(--ink)', 'font-weight': o.weight, 'fill-opacity': o.op, 'font-style': o.italic ? 'italic' : null })}${ff}>${esc(s)}</text>`;
  }
  function R(x, y, w, h, o) {
    o = o || {};
    return `<rect${attrs({ x: n(x), y: n(y), width: n(w), height: n(h), rx: o.rx, fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.stroke, 'stroke-width': o.sw, 'stroke-dasharray': o.dash, 'stroke-opacity': o.so })}/>`;
  }
  function L(x1, y1, x2, y2, o) {
    o = o || {};
    return `<line${attrs({ x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2), stroke: o.stroke || 'var(--line)', 'stroke-width': o.sw || 1.5, 'stroke-dasharray': o.dash, 'stroke-linecap': o.cap || 'round', 'stroke-opacity': o.so })}/>`;
  }
  function C(cx, cy, r, o) {
    o = o || {};
    return `<circle${attrs({ cx: n(cx), cy: n(cy), r: n(r), fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.stroke, 'stroke-width': o.sw, 'stroke-dasharray': o.dash })}/>`;
  }
  function P(d, o) {
    o = o || {};
    return `<path${attrs({ d: d, fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.stroke, 'stroke-width': o.sw, 'stroke-linecap': o.cap, 'stroke-linejoin': o.join || 'round', 'stroke-dasharray': o.dash, 'stroke-opacity': o.so })}/>`;
  }
  function svg(name, h, title, body, w) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w || 640} ${h}" role="img" aria-labelledby="${name}-title" font-family="inherit"><title id="${name}-title">${esc(title)}</title>${body}</svg>`;
  }
  // numbered badge
  function badge(cx, cy, num, col) {
    return C(cx, cy, 11, { fill: col || 'var(--blue)' }) + T(cx, cy + 5, num, { size: 13, anchor: 'middle', fill: 'var(--on-accent)', weight: 700 });
  }
  // stripe patterns for white-striped wires; ids prefixed per figure/instance
  function stripeDefs(pre) {
    let s = '';
    for (const k of ['o', 'g', 'b', 'br']) s += `<pattern id="${pre}-st-${k}" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(35)"><rect width="9" height="9" fill="${WC.w}"/><rect width="3.6" height="9" fill="${WC[k]}"/></pattern>`;
    return s;
  }
  // wire fill: 'o' solid orange, 'wo' white/orange
  function wfill(pre, c) { return c[0] === 'w' && c.length > 1 ? `url(#${pre}-st-${c.slice(1)})` : WC[c]; }
  const T568B = ['wo', 'o', 'wg', 'b', 'wb', 'g', 'wbr', 'br'];
  const T568B_TH = ['ขาวส้ม', 'ส้ม', 'ขาวเขียว', 'น้ำเงิน', 'ขาวน้ำเงิน', 'เขียว', 'ขาวน้ำตาล', 'น้ำตาล'];
  // horizontal wire segment with outline
  function hwire(pre, x1, x2, y, th, c) {
    return R(Math.min(x1, x2), y - th / 2, Math.abs(x2 - x1), th, { fill: wfill(pre, c), stroke: WC.edge, sw: 0.8, rx: th / 2 });
  }
  function vwire(pre, x, y1, y2, th, c) {
    return R(x - th / 2, Math.min(y1, y2), th, Math.abs(y2 - y1), { fill: wfill(pre, c), stroke: WC.edge, sw: 0.8, rx: th / 2 });
  }

  /* ======================================================================
     1. ethernet-standards: how to read IEEE 802.3 names + speed/medium/distance chart
     ====================================================================== */
  (function () {
    const N = 'ethernet-standards';
    let b = '';
    // decoder panel
    b += R(16, 10, 608, 262, { rx: 12, fill: 'var(--field)', stroke: 'var(--line)', sw: 1.5 });
    b += T(32, 38, 'วิธีอ่านชื่อมาตรฐาน Ethernet', { size: 17, weight: 700 });
    const cw = 20.4, x0 = 320 - cw * 5; // "1000BASE-T" in 34px mono, centred
    b += T(320, 84, '1000BASE-T', { size: 34, anchor: 'middle', mono: true, weight: 700 });
    const parts = [[0, 4, 'var(--blue)', 126], [4, 8, 'var(--green)', 320], [8, 10, 'var(--orange)', 514]];
    for (const [a, z, col, bx] of parts) {
      const xa = x0 + a * cw + 2, xz = x0 + z * cw - 2, xm = (xa + xz) / 2;
      b += P(`M${n(xa)} 94 v6 h${n(xz - xa)} v-6`, { stroke: col, sw: 2.5 });
      b += P(`M${n(xm)} 100 C ${n(xm)} 112, ${bx} 104, ${bx} 120`, { stroke: col, sw: 2 });
    }
    const boxes = [
      [28, 'var(--blue)', 'ความเร็ว', ['ตัวเลขเปล่า = Mb/s', '1000 = 1000 Mb/s = 1 Gb/s', 'มี G เช่น 10G = 10 Gb/s']],
      [222, 'var(--green)', 'BASE = Baseband', ['ส่งสัญญาณดิจิทัลทีละสัญญาณ', 'ใช้ทั้งช่องสัญญาณของสื่อ', '(ตรงข้ามกับ Broadband)']],
      [416, 'var(--orange)', 'ชนิดสื่อ', ['T, TX = สายคู่บิดเกลียว', 'SX, SR = ใยแก้ว แสงคลื่นสั้น', 'LX, LR = ใยแก้ว แสงคลื่นยาว']]
    ];
    for (const [bx, col, head, lines] of boxes) {
      b += R(bx, 120, 196, 108, { rx: 8, fill: 'var(--panel)', stroke: col, sw: 2 });
      b += T(bx + 12, 144, head, { size: 15, weight: 700 });
      lines.forEach((l, i) => { b += T(bx + 12, 166 + i * 20, l, { size: 13.5, fill: i === 2 && head === 'BASE = Baseband' ? 'var(--muted)' : 'var(--ink)' }); });
    }
    b += T(32, 254, 'S = แสงคลื่นสั้น 850 nm (Multi-mode)   L = แสงคลื่นยาว 1310 nm   X, R = วิธีเข้ารหัส', { size: 13.5, fill: 'var(--muted)' });

    // chart
    const top0 = 324, rh = 46, xL = 432, xR = 620, dec = (xR - xL) / 3;
    const pos = d => xL + dec * Math.log10(d / 10);
    b += T(16, 300, 'มาตรฐาน', { size: 14, weight: 700, fill: 'var(--muted)' });
    b += T(158, 300, 'ความเร็ว', { size: 14, weight: 700, fill: 'var(--muted)' });
    b += T(238, 300, 'สื่อที่ใช้', { size: 14, weight: 700, fill: 'var(--muted)' });
    b += T(xL, 300, 'ระยะสูงสุด (สเกลลอการิทึม)', { size: 14, weight: 700, fill: 'var(--muted)' });
    b += L(16, 310, 624, 310, { stroke: 'var(--line)', sw: 1.5 });
    const rows = [
      ['10BASE-T', '802.3i · 1990', '10 Mb/s', ['UTP Cat3 ขึ้นไป', 'ใช้ 2 คู่ (ขา 1,2 และ 3,6)'], '100 m', [100], 'cu'],
      ['100BASE-TX', '802.3u · 1995', '100 Mb/s', ['UTP Cat5 ขึ้นไป', 'ใช้ 2 คู่ (ขา 1,2 และ 3,6)'], '100 m', [100], 'cu'],
      ['1000BASE-T', '802.3ab · 1999', '1 Gb/s', ['UTP Cat5e ขึ้นไป', 'ใช้ครบ 4 คู่ ส่งและรับพร้อมกัน'], '100 m', [100], 'cu'],
      ['2.5GBASE-T', '802.3bz · 2016', '2.5 Gb/s', ['UTP Cat5e ขึ้นไป', 'ใช้ครบ 4 คู่'], '100 m', [100], 'cu'],
      ['5GBASE-T', '802.3bz · 2016', '5 Gb/s', ['Cat6 (Cat5e ได้ในบางกรณี)', 'ใช้ครบ 4 คู่'], '100 m', [100], 'cu'],
      ['10GBASE-T', '802.3an · 2006', '10 Gb/s', ['Cat6a ได้ 100 m', 'Cat6 ได้ราว 55 m'], '55 m (Cat6) – 100 m (Cat6a)', [55, 100], 'cu'],
      ['1000BASE-SX', '802.3z · 1998', '1 Gb/s', ['ใยแก้ว Multi-mode', 'แสง 850 nm'], '220–550 m ตามเกรดใยแก้ว', [220, 550], 'fx'],
      ['1000BASE-LX', '802.3z · 1998', '1 Gb/s', ['ใยแก้ว Single-mode', 'แสง 1310 nm'], '5 km', [5000], 'fx'],
      ['10GBASE-SR', '802.3ae · 2002', '10 Gb/s', ['ใยแก้ว Multi-mode', '850 nm (OM1 ถึง OM4)'], '26 m (OM1) – 400 m (OM4)', [26, 400], 'fx'],
      ['10GBASE-LR', '802.3ae · 2002', '10 Gb/s', ['ใยแก้ว Single-mode', 'แสง 1310 nm'], '10 km', [10000], 'fx']
    ];
    // grid lines
    for (const d of [10, 100, 1000, 10000]) b += L(pos(d), top0 - 8, pos(d), top0 + rows.length * rh - 4, { stroke: 'var(--line)', sw: 1, dash: '3 4' });
    rows.forEach((r, i) => {
      const y = top0 + i * rh, col = r[6] === 'cu' ? 'var(--blue)' : 'var(--orange)';
      if (i % 2 === 0) b += R(16, y - 10, 608, rh, { rx: 6, fill: 'var(--field)' });
      b += R(16, y - 6, 5, rh - 8, { rx: 2, fill: col });
      b += T(28, y + 11, r[0], { size: 15, weight: 700 });
      b += T(28, y + 29, r[1], { size: 13, fill: 'var(--muted)' });
      b += T(158, y + 11, r[2], { size: 14, weight: 600 });
      b += T(238, y + 11, r[3][0], { size: 13.5 });
      b += T(238, y + 29, r[3][1], { size: 13, fill: 'var(--muted)' });
      b += T(xL, y + 10, r[4], { size: 13, weight: 600 });
      const d = r[5], x1 = pos(d[0]);
      b += R(xL, y + 18, x1 - xL, 10, { rx: 3, fill: col });
      if (d[1]) b += R(x1, y + 18, pos(d[1]) - x1, 10, { rx: 3, fill: col, fo: 0.35, stroke: col, sw: 1 });
    });
    const yAx = top0 + rows.length * rh + 8;
    [[10, '10 m', 'start'], [100, '100 m', 'middle'], [1000, '1 km', 'middle'], [10000, '10 km', 'end']].forEach(([d, s, a]) => { b += T(pos(d), yAx + 8, s, { size: 13, anchor: a, fill: 'var(--muted)' }); });
    const yF = yAx + 34;
    b += R(16, yF - 12, 14, 12, { rx: 2, fill: 'var(--blue)' }) + T(36, yF - 1, 'สายทองแดง (UTP)', { size: 13.5 });
    b += R(176, yF - 12, 14, 12, { rx: 2, fill: 'var(--orange)' }) + T(196, yF - 1, 'ใยแก้วนำแสง', { size: 13.5 });
    b += R(300, yF - 12, 14, 12, { rx: 2, fill: 'var(--muted)', fo: 0.35, stroke: 'var(--muted)', sw: 1 }) + T(320, yF - 1, 'ส่วนจาง = ไกลขึ้นเมื่อใช้สื่อเกรดสูงกว่า', { size: 13.5 });
    b += T(16, yF + 22, 'ระยะของ UTP คือความยาว Channel รวมสายแพตช์ทั้งสองปลาย ไม่เกิน 100 m ทุกความเร็ว', { size: 13.5, fill: 'var(--muted)' });
    b += T(16, yF + 42, 'ระยะใยแก้วขึ้นกับเกรดใยแก้ว (OM1–OM4) และโมดูล ค่าในภาพเป็นค่าตามมาตรฐาน IEEE 802.3', { size: 13.5, fill: 'var(--muted)' });
    const H = yF + 56;
    NL_FIG('diagram', 'ethernet-standards', svg(N, H,
      'แผนภาพวิธีอ่านชื่อมาตรฐาน Ethernet และตารางเปรียบเทียบ ชื่อ 1000BASE-T แยกเป็นสามส่วน คือ 1000 คือความเร็วเป็น Mb/s, BASE คือ Baseband และ T คือสายคู่บิดเกลียว ส่วน SX/SR คือใยแก้ว Multi-mode แสง 850 นาโนเมตร และ LX/LR คือแสง 1310 นาโนเมตรที่ใช้ Single-mode ได้ไกล ตารางแสดง 10BASE-T 10 Mb/s Cat3 100 เมตร, 100BASE-TX 100 Mb/s Cat5 100 เมตร, 1000BASE-T 1 Gb/s Cat5e ใช้ 4 คู่ 100 เมตร, 2.5GBASE-T และ 5GBASE-T (802.3bz) 100 เมตร, 10GBASE-T บน Cat6a 100 เมตรและบน Cat6 ราว 55 เมตร, 1000BASE-SX 220 ถึง 550 เมตร, 1000BASE-LX 5 กิโลเมตร, 10GBASE-SR 26 ถึง 400 เมตร และ 10GBASE-LR 10 กิโลเมตร โดยแสดงระยะเป็นแถบบนสเกลลอการิทึม',
      b));
  })();

  /* ======================================================================
     3. utp-anatomy: cut-away + cross-section, Cat5e/6/6a comparison, shielding types
     ====================================================================== */
  (function () {
    const N = 'utp-anatomy', pre = N;
    let b = `<defs>${stripeDefs(pre)}</defs>`;
    b += T(16, 26, 'ส่วนประกอบของสาย UTP (ภาพตัดเปลือกและภาพตัดขวาง)', { size: 17, weight: 700 });
    // --- cut-away (left) and cross-section (right), shifted down
    b += '<g transform="translate(0,30)">';
    const jx1 = 24, jx2 = 168, jy = 150, jh = 64;
    // pairs fanning out from jacket end
    const pairs = [['o', 'wo', 74, 24], ['g', 'wg', 128, 30], ['b', 'wb', 182, 36], ['br', 'wbr', 236, 42]];
    function strandPts(y0, y1, pitch, phase) {
      const pts = [];
      for (let x = jx2 - 6; x <= 392; x += 2) {
        const t = Math.min(1, (x - jx2 + 6) / 70), e = t * t * (3 - 2 * t);
        const yc = y0 + (y1 - y0) * e;
        const a = 4.2 * Math.sin(2 * Math.PI * (x - jx2) / pitch + phase);
        pts.push([x, yc + a, Math.cos(2 * Math.PI * (x - jx2) / pitch + phase)]);
      }
      return pts;
    }
    function strand(pts, fill, front) {
      // draw as run of short segments; when front is set only the parts facing the viewer
      let d = '', on = false;
      for (let i = 0; i < pts.length; i++) {
        const vis = front == null || (front ? pts[i][2] > 0 : true);
        if (vis) { d += (on ? 'L' : 'M') + n(pts[i][0]) + ' ' + n(pts[i][1]) + ' '; on = true; } else on = false;
      }
      return P(d, { stroke: WC.edge, sw: 8.6, cap: 'round' }) + P(d, { stroke: fill, sw: 6.6, cap: 'round' });
    }
    const ys = [138, 146, 154, 162];
    pairs.forEach(([solid, striped, yEnd, pitch], i) => {
      const a = strandPts(ys[i], yEnd, pitch, 0), c = strandPts(ys[i], yEnd, pitch, Math.PI);
      b += strand(c, wfill(pre, striped)) + strand(a, WC[solid]);
      // the striped strand passes in front on alternate half-twists
      b += strand(c, wfill(pre, striped), true);
    });
    // exposed copper tip on the orange strand
    b += P('M392 70 L404 70', { stroke: WC.cu, sw: 3.4, cap: 'round' });
    // spline (Cat6 cross filler) sticking out
    b += R(jx2 - 4, jy - 3, 46, 6, { rx: 2, fill: 'var(--muted)', fo: 0.75 });
    // rip cord
    b += P(`M${jx2 - 30} ${jy - 24} C ${jx2 + 10} ${jy - 30}, ${jx2 + 10} ${jy - 70}, ${jx2 + 40} ${jy - 92}`, { stroke: WC.edge, sw: 3.6, cap: 'round' }) + P(`M${jx2 - 30} ${jy - 24} C ${jx2 + 10} ${jy - 30}, ${jx2 + 10} ${jy - 70}, ${jx2 + 40} ${jy - 92}`, { stroke: WC.nylon, sw: 2.2, cap: 'round' });
    // jacket
    b += R(jx1, jy - jh / 2, jx2 - jx1, jh, { rx: 10, fill: 'var(--muted)', fo: 0.45, stroke: 'var(--muted)', sw: 1.5 });
    b += P(`M${jx2} ${jy - jh / 2} q 10 ${jh / 2} 0 ${jh}`, { fill: 'var(--panel)', stroke: 'var(--muted)', sw: 1.5 });
    b += T(40, jy + 5, 'Cat6 U/UTP', { size: 14, weight: 700 });
    // labels (cut-away)
    b += L(70, jy + jh / 2, 70, 214, { stroke: 'var(--ink)', sw: 1 }) + T(24, 232, 'เปลือกนอก (Jacket)', { size: 14, weight: 600 }) + T(24, 250, 'PVC หรือ LSZH', { size: 13, fill: 'var(--muted)' });
    b += L(jx2 + 40, jy - 92, jx2 + 40, 48, { stroke: 'var(--ink)', sw: 1 }) + T(jx2 + 30, 42, 'เชือกฉีกเปลือก (Rip cord)', { size: 14, weight: 600, anchor: 'end' });
    b += L(jx2 + 30, jy + 4, jx2 + 30, 268, { stroke: 'var(--ink)', sw: 1 }) + T(jx2 + 30, 284, 'แกนกากบาท (Spline) แยกคู่สายใน Cat6', { size: 14, weight: 600, anchor: 'middle' });
    b += L(404, 70, 404, 52, { stroke: 'var(--ink)', sw: 1 }) + T(404, 46, 'ทองแดง 23–24 AWG', { size: 13.5, anchor: 'middle', weight: 600 });
    b += T(398, 258, 'ระยะบิดของแต่ละคู่ไม่เท่ากัน', { size: 13.5, fill: 'var(--muted)', anchor: 'end' });

    // --- cross-section (right)
    const cx = 528, cy = 152, R0 = 86;

    b += C(cx, cy, R0, { fill: 'var(--muted)', fo: 0.45, stroke: 'var(--muted)', sw: 1.5 });
    b += C(cx, cy, R0 - 11, { fill: 'var(--panel)' });
    b += R(cx - 4, cy - 70, 8, 140, { rx: 2, fill: 'var(--muted)', fo: 0.75 }) + R(cx - 70, cy - 4, 140, 8, { rx: 2, fill: 'var(--muted)', fo: 0.75 });
    function cond(x, y, c) {
      let s = '';
      if (c[0] === 'w' && c.length > 1) {
        s += C(x, y, 13, { fill: WC.w, stroke: WC.edge, sw: 1 });
        const col = WC[c.slice(1)], r = 10.5, a1 = -0.5, a2 = 1.6;
        s += P(`M${n(x + r * Math.cos(a1))} ${n(y + r * Math.sin(a1))} A ${r} ${r} 0 0 1 ${n(x + r * Math.cos(a2))} ${n(y + r * Math.sin(a2))}`, { stroke: col, sw: 4.5 });
      } else s += C(x, y, 13, { fill: WC[c], stroke: WC.edge, sw: 1 });
      return s + C(x, y, 5.5, { fill: WC.cu, stroke: '#8A5426', sw: 0.8 });
    }
    const quad = [[-1, -1, 'o'], [1, -1, 'g'], [-1, 1, 'b'], [1, 1, 'br']];
    for (const [sx, sy, k] of quad) {
      const qx = cx + sx * 36, qy = cy + sy * 36;
      b += cond(qx - 10, qy - 10 * sx * sy, 'w' + k) + cond(qx + 10, qy + 10 * sx * sy, k);
    }
    b += C(cx + 14, cy - 64, 4.5, { fill: WC.nylon, stroke: WC.edge, sw: 1 });
    // cross-section labels
    b += L(cx + 17, cy - 68, cx + 40, cy - 104, { stroke: 'var(--ink)', sw: 1 }) + T(cx + 36, cy - 108, 'Rip cord', { size: 13 });
    b += T(cx, cy + 142, 'ภาพตัดขวาง Cat6', { size: 14, weight: 700, anchor: 'middle' });
    b += L(cx - 74, cy + 52, cx - 84, cy + 104, { stroke: 'var(--ink)', sw: 1 }) + T(cx - 92, cy + 120, 'ฉนวนสี', { size: 13 });
    b += L(cx - 36, cy + 26, cx - 36, cy + 106, { stroke: 'var(--ink)', sw: 1 }) + T(cx - 30, cy + 120, 'ทองแดง', { size: 13 });
    b += L(cx + 4, cy + 60, cx + 40, cy + 106, { stroke: 'var(--ink)', sw: 1 }) + T(cx + 32, cy + 120, 'Spline', { size: 13 });

    b += '</g>';
    // --- why twist
    let y = 340;
    b += R(16, y, 608, 78, { rx: 10, fill: 'var(--blue)', fo: 0.08, stroke: 'var(--blue)', sw: 1.5 });
    b += T(30, y + 24, 'ทำไมต้องบิดเกลียว', { size: 15, weight: 700 });
    b += T(30, y + 44, 'สัญญาณในคู่เดียวกันวิ่งสวนขั้วกัน (Differential) สัญญาณรบกวนที่เข้าทั้งสองเส้นเท่ากันจึงหักล้างกัน', { size: 13.5 });
    b += T(30, y + 62, 'และการให้แต่ละคู่บิดถี่ไม่เท่ากัน ช่วยลดสัญญาณข้ามคู่ (Crosstalk) จึงห้ามคลายเกลียวยาวเกินจำเป็น', { size: 13.5 });

    // --- category comparison
    y = 432;
    b += T(16, y + 6, 'เปรียบเทียบสายแต่ละเกรด', { size: 16, weight: 700 });
    const cols = [16, 196, 340, 484], cwid = [180, 144, 144, 140];
    const head = ['', 'Cat5e', 'Cat6', 'Cat6a'];
    const trs = [
      ['ความถี่ใช้งาน', '100 MHz', '250 MHz', '500 MHz'],
      ['1000BASE-T', '100 m', '100 m', '100 m'],
      ['10GBASE-T', 'ไม่รองรับ', 'ราว 55 m', '100 m'],
      ['แกนกากบาท', 'ไม่มี', 'มักมี', 'มักมี สายหนากว่า'],
      ['ขนาดทองแดง', '24 AWG', '23–24 AWG', '23 AWG']
    ];
    b += R(16, y + 16, 608, 30, { rx: 6, fill: 'var(--field)' });
    head.forEach((h, i) => { if (h) b += T(cols[i] + cwid[i] / 2, y + 36, h, { size: 15, weight: 700, anchor: 'middle' }); });
    trs.forEach((r, j) => {
      const yy = y + 46 + j * 30;
      b += L(16, yy, 624, yy, { stroke: 'var(--line)', sw: 1 });
      r.forEach((c, i) => {
        const bad = c === 'ไม่รองรับ', best = j === 2 && i === 3;
        b += T(i ? cols[i] + cwid[i] / 2 : 28, yy + 21, c, { size: 14, anchor: i ? 'middle' : 'start', weight: i ? (best ? 700 : 400) : 600, fill: bad ? 'var(--bad)' : best ? 'var(--green)' : 'var(--ink)' });
      });
    });
    b += T(16, y + 46 + 5 * 30 + 20, 'ค่าระยะคือความยาว Channel สูงสุดตามมาตรฐาน', { size: 13, fill: 'var(--muted)' });
    b += T(16, y + 46 + 5 * 30 + 38, '10GBASE-T บน Cat6 ได้ 37–55 m ขึ้นกับสัญญาณรบกวนจากสายข้างเคียง (Alien crosstalk)', { size: 13, fill: 'var(--muted)' });

    // --- shielding
    y = 708;
    b += T(16, y, 'ชนิดชีลด์ (ชื่อตาม ISO/IEC 11801: ชีลด์รวม / ชีลด์แต่ละคู่)', { size: 16, weight: 700 });
    const sh = [['U/UTP', 'ไม่มีชีลด์', 0, 0], ['F/UTP', 'ฟอยล์หุ้มรวม', 1, 0], ['U/FTP', 'ฟอยล์หุ้มแต่ละคู่', 0, 1], ['S/FTP', 'ถักเปียรวม + ฟอยล์แต่ละคู่', 2, 1]];
    sh.forEach(([nm, desc, outer, inner], i) => {
      const mx = 92 + i * 152, my = y + 58;
      b += C(mx, my, 40, { fill: 'var(--muted)', fo: 0.45, stroke: 'var(--muted)', sw: 1.2 });
      b += C(mx, my, 34, { fill: 'var(--panel)' });
      if (outer === 1) b += C(mx, my, 32, { stroke: WC.foil, sw: 3 });
      if (outer === 2) b += C(mx, my, 32, { stroke: WC.foil, sw: 4, dash: '2 2' }) + C(mx, my, 28.5, { stroke: WC.foil, sw: 1.6 });
      [['o', -1, -1], ['g', 1, -1], ['b', -1, 1], ['br', 1, 1]].forEach(([k, sx, sy]) => {
        const px = mx + sx * 12, py = my + sy * 12;
        if (inner) b += C(px, py, 10, { stroke: WC.foil, sw: 2.2 });
        b += C(px - 3.6, py, 3.8, { fill: WC.w, stroke: WC.edge, sw: 0.8 }) + C(px + 3.6, py, 3.8, { fill: WC[k], stroke: WC.edge, sw: 0.8 });
      });
      b += T(mx, my + 62, nm, { size: 15, weight: 700, anchor: 'middle' });
      b += T(mx, my + 81, desc, { size: 13, anchor: 'middle', fill: 'var(--muted)' });
    });
    b += T(16, y + 168, 'สายชีลด์ต้องใช้หัว RJ-45 แบบชีลด์และต่อกราวด์ที่ตู้ Rack จึงจะกันสัญญาณรบกวนได้ผล', { size: 13.5 });
    b += T(16, y + 188, 'ภาพเป็นภาพอธิบาย ไม่ได้วาดตามสัดส่วนจริง', { size: 13, fill: 'var(--muted)' });
    NL_FIG('diagram', 'utp-anatomy', svg(N, y + 200,
      'ภาพส่วนประกอบของสาย UTP Cat6 ด้านซ้ายเป็นภาพตัดเปลือกนอก เห็นสายทองแดง 4 คู่ คือคู่ส้ม เขียว น้ำเงิน น้ำตาล แต่ละคู่มีเส้นสีทึบบิดเกลียวกับเส้นสีขาวคาดสีเดียวกัน ระยะบิดแต่ละคู่ไม่เท่ากัน มีเชือกฉีกเปลือก (Rip cord) และแกนกากบาท (Spline) แยกคู่สาย ด้านขวาเป็นภาพตัดขวางเห็นเปลือกนอก แกนกากบาทแบ่งคู่สายเป็นสี่ส่วน ฉนวนสีและแกนทองแดง กล่องอธิบายว่าการบิดเกลียวทำให้สัญญาณรบกวนหักล้างกันและลด Crosstalk ตารางเปรียบเทียบ Cat5e 100 MHz, Cat6 250 MHz, Cat6a 500 MHz ทุกเกรดใช้ 1000BASE-T ได้ 100 เมตร ส่วน 10GBASE-T Cat5e ไม่รองรับ Cat6 ได้ราว 55 เมตร Cat6a ได้ 100 เมตร และภาพชนิดชีลด์ U/UTP ไม่มีชีลด์, F/UTP ฟอยล์หุ้มรวม, U/FTP ฟอยล์หุ้มแต่ละคู่, S/FTP ถักเปียรวมและฟอยล์แต่ละคู่',
      b));
  })();

  /* ======================================================================
     7. wifi-generations: Wi-Fi 4/5/6/6E/7 comparison cards
     ====================================================================== */
  (function () {
    const N = 'wifi-generations';
    let b = '';
    b += T(16, 26, 'Wi-Fi แต่ละรุ่นต่างกันอย่างไร', { size: 17, weight: 700 });
    b += T(16, 48, 'ค่าสูงสุดตามมาตรฐาน IEEE 802.11 (อุปกรณ์จริงส่วนใหญ่รองรับน้อยกว่านี้)', { size: 13.5, fill: 'var(--muted)' });
    const gens = [
      ['Wi-Fi 4', '802.11n', 'ปี 2009', [1, 1, 0], '40 MHz', '64-QAM (6 บิต/สัญลักษณ์)', '4 สตรีม', 0.6, '600 Mb/s', 'MIMO ส่งหลายสตรีมพร้อมกัน, รวมช่องสัญญาณเป็น 40 MHz'],
      ['Wi-Fi 5', '802.11ac', 'ปี 2013', [0, 1, 0], '160 MHz', '256-QAM (8 บิต/สัญลักษณ์)', '8 สตรีม', 6.9, '6.9 Gb/s', 'MU-MIMO ขาลง (AP ส่งถึงหลายเครื่องพร้อมกัน), Beamforming'],
      ['Wi-Fi 6', '802.11ax', 'ปี 2019', [1, 1, 0], '160 MHz', '1024-QAM (10 บิต/สัญลักษณ์)', '8 สตรีม', 9.6, '9.6 Gb/s', 'OFDMA แบ่งช่องย่อยให้หลายเครื่อง, MU-MIMO ขึ้น-ลง, TWT ประหยัดแบต'],
      ['Wi-Fi 6E', '802.11ax + 6 GHz', 'ปี 2021', [1, 1, 1], '160 MHz', '1024-QAM (10 บิต/สัญลักษณ์)', '8 สตรีม', 9.6, '9.6 Gb/s', 'เหมือน Wi-Fi 6 แต่ใช้ย่าน 6 GHz ที่ว่าง ไม่มีอุปกรณ์รุ่นเก่า, 6 GHz บังคับ WPA3'],
      ['Wi-Fi 7', '802.11be', 'ปี 2024', [1, 1, 1], '320 MHz (6 GHz)', '4096-QAM (12 บิต/สัญลักษณ์)', '8 สตรีม', 23, 'ราว 23 Gb/s', 'MLO ใช้หลายย่านพร้อมกัน, ช่อง 320 MHz, Multi-RU, Preamble puncturing']
    ];
    const ch = 126, y0 = 62, barW = 150;
    gens.forEach((g, i) => {
      const y = y0 + i * (ch + 8);
      const hi = i === 4;
      b += R(16, y, 608, ch, { rx: 10, fill: 'var(--field)', stroke: hi ? 'var(--blue)' : 'var(--line)', sw: hi ? 2 : 1.5 });
      b += T(30, y + 30, g[0], { size: 20, weight: 700 });
      b += T(30, y + 50, g[1], { size: 14, fill: 'var(--muted)', mono: false });
      b += T(30, y + 68, 'รับรอง' + g[2].replace('ปี', ''), { size: 13, fill: 'var(--muted)' });
      ['2.4', '5', '6'].forEach((band, k) => {
        const on = g[3][k], bx = 30 + k * 44;
        b += R(bx, y + 76, 40, 22, { rx: 11, fill: on ? 'var(--blue)' : 'none', fo: on ? 0.18 : null, stroke: on ? 'var(--blue)' : 'var(--line)', sw: 1.5, dash: on ? null : '3 3' });
        b += T(bx + 20, y + 92, band, { size: 13, anchor: 'middle', weight: on ? 700 : 400, fill: on ? 'var(--ink)' : 'var(--muted)' });
      });
      b += T(164, y + 92, 'GHz', { size: 13, fill: 'var(--muted)' });
      b += T(212, y + 26, 'ช่องกว้างสุด: ' + g[4], { size: 14 });
      b += T(212, y + 46, 'Modulation: ' + g[5].replace('บิต/สัญลักษณ์', 'บิต'), { size: 14 });
      b += T(212, y + 66, 'สตรีมสูงสุด: ' + g[6], { size: 14 });
      b += L(30, y + 102, 610, y + 102, { stroke: 'var(--line)', sw: 1 });
      b += T(30, y + 118, 'เด่น: ' + g[9], { size: 13.5, fill: 'var(--ink)', weight: 600 });
      // PHY rate bar (linear)
      b += T(464, y + 24, 'PHY สูงสุดตามทฤษฎี', { size: 13, fill: 'var(--muted)' });
      b += T(464, y + 48, g[8], { size: 18, weight: 700 });
      b += R(464, y + 56, barW, 10, { rx: 3, fill: 'var(--line)', fo: 0.6 });
      b += R(464, y + 56, Math.max(3, barW * g[7] / 23), 10, { rx: 3, fill: 'var(--blue)' });
    });
    const yF = y0 + 5 * (ch + 8) + 6;
    b += R(16, yF, 608, 116, { rx: 10, fill: 'var(--orange)', fo: 0.08, stroke: 'var(--orange)', sw: 1.5 });
    b += T(30, yF + 24, 'ความเร็วตามทฤษฎีกับความเร็วจริง', { size: 15, weight: 700 });
    b += T(30, yF + 46, 'ตัวเลข PHY คิดจากสตรีมสูงสุด ช่องกว้างสุด และ Modulation สูงสุดพร้อมกัน ซึ่งแทบไม่มีอุปกรณ์ใดทำได้', { size: 13.5 });
    b += T(30, yF + 66, 'ตัวอย่าง: มือถือ Wi-Fi 6 แบบ 2 สตรีม ช่อง 80 MHz ได้ Link rate ราว 1.2 Gb/s และความเร็วโหลดจริง', { size: 13.5 });
    b += T(30, yF + 86, 'มักเหลือครึ่งหนึ่งหรือน้อยกว่า เพราะ CSMA/CA, Overhead, ระยะ, ผนัง และผู้ใช้ที่แบ่งคลื่นกัน', { size: 13.5 });
    b += T(30, yF + 106, 'บางแหล่งเขียน Wi-Fi 7 = 46 Gb/s ซึ่งคิดจาก 16 สตรีมในร่างแรก มาตรฐานจริงกำหนด 8 สตรีม', { size: 13, fill: 'var(--muted)' });
    NL_FIG('diagram', 'wifi-generations', svg(N, yF + 128,
      'ตารางการ์ดเปรียบเทียบ Wi-Fi 5 รุ่น Wi-Fi 4 (802.11n ปี 2009) ใช้ 2.4 และ 5 GHz ช่องกว้างสุด 40 MHz, 64-QAM, 4 สตรีม, 600 Mb/s เด่นที่ MIMO, Wi-Fi 5 (802.11ac ปี 2013) ใช้ 5 GHz อย่างเดียว ช่อง 160 MHz, 256-QAM, 8 สตรีม, 6.9 Gb/s เด่นที่ MU-MIMO ขาลง, Wi-Fi 6 (802.11ax ปี 2019) 2.4 และ 5 GHz ช่อง 160 MHz, 1024-QAM, 8 สตรีม, 9.6 Gb/s เด่นที่ OFDMA, MU-MIMO และ TWT, Wi-Fi 6E (ปี 2021) เพิ่มย่าน 6 GHz และบังคับ WPA3 ในย่านนั้น, Wi-Fi 7 (802.11be ปี 2024) ใช้ 2.4, 5 และ 6 GHz ช่อง 320 MHz ใน 6 GHz, 4096-QAM, 8 สตรีม ราว 23 Gb/s เด่นที่ MLO ความเร็วทั้งหมดเป็นค่าทฤษฎี ความเร็วจริงต่ำกว่ามาก เช่น มือถือ Wi-Fi 6 สองสตรีมช่อง 80 MHz ได้ link rate ราว 1.2 Gb/s',
      b));
  })();
  /* ======================================================================
     4. crimp-tools: crimper, RJ-45 plug (pin 1 orientation), boot, stripper, LAN tester
     ====================================================================== */
  (function () {
    const N = 'crimp-tools', pre = N;
    let b = `<defs>${stripeDefs(pre)}</defs>`;
    const metal = 'var(--muted)', ink = 'var(--ink)';
    b += T(16, 26, 'เครื่องมือเข้าหัวสาย UTP', { size: 17, weight: 700 });
    // ---- crimping tool (side view): head at left, handles to the right
    const oy = 44;
    b += `<g transform="translate(0,${oy})">`;
    b += P('M170 118 L590 92 Q604 94 602 108 L600 112 L172 150 Z', { fill: metal, fo: 0.35, stroke: ink, sw: 1.5 });
    b += P('M172 160 L600 200 L602 204 Q604 218 590 220 L170 192 Z', { fill: metal, fo: 0.35, stroke: ink, sw: 1.5 });
    b += P('M360 104 L590 92 Q604 94 602 108 L600 112 L360 128 Z', { fill: 'var(--blue)', fo: 0.3, stroke: ink, sw: 1.2 });
    b += P('M360 177 L600 200 L602 204 Q604 218 590 220 L360 202 Z', { fill: 'var(--blue)', fo: 0.3, stroke: ink, sw: 1.2 });
    // head
    b += P('M40 40 L150 40 Q178 40 182 70 L190 240 Q190 256 172 256 L58 256 Q40 256 40 238 Z', { fill: metal, fo: 0.45, stroke: ink, sw: 1.8 });
    // cutter blades at the top
    b += P('M54 48 L136 48 L136 60 L54 66 Z', { fill: 'var(--panel)', stroke: ink, sw: 1.4 }) + L(56, 58, 134, 54, { stroke: ink, sw: 2 });
    // stripper slot
    b += R(58, 82, 74, 16, { rx: 3, fill: 'var(--panel)', stroke: ink, sw: 1.4 }) + L(62, 90, 128, 90, { stroke: ink, sw: 1, dash: '4 3' });
    // 8P die with teeth
    b += R(56, 126, 90, 40, { rx: 3, fill: 'var(--panel)', stroke: ink, sw: 1.6 });
    for (let i = 0; i < 8; i++) b += R(62 + i * 10.2, 126, 5, 12, { fill: ink, fo: 0.7 });
    b += T(101, 160, '8P', { size: 14, weight: 700, anchor: 'middle' });
    // 6P die
    b += R(64, 190, 72, 32, { rx: 3, fill: 'var(--panel)', stroke: ink, sw: 1.4 });
    for (let i = 0; i < 6; i++) b += R(70 + i * 10.2, 190, 5, 10, { fill: ink, fo: 0.7 });
    b += T(100, 216, '6P', { size: 13, weight: 700, anchor: 'middle' });
    // pivot + ratchet
    b += C(196, 156, 12, { fill: 'var(--panel)', stroke: ink, sw: 1.6 }) + C(196, 156, 4, { fill: ink });
    b += P('M214 146 l8 -6 l4 8 l8 -6 l4 8 l8 -6 l4 8', { stroke: ink, sw: 1.6 });
    // labels
    b += L(136, 54, 230, 22, { stroke: ink, sw: 1 }) + T(236, 26, 'ใบมีดตัดสาย (Cutter)', { size: 14, weight: 600 });
    b += L(132, 90, 300, 60, { stroke: ink, sw: 1 }) + T(306, 64, 'ช่องปอกเปลือก (Stripper)', { size: 14, weight: 600 });
    b += L(236, 140, 300, 90, { stroke: ink, sw: 1 }) + T(306, 94, 'เฟืองล็อก (Ratchet)', { size: 13.5 });
    b += L(146, 150, 240, 230, { stroke: ink, sw: 1 }) + T(246, 236, 'ช่องย้ำ 8P สำหรับหัว RJ-45', { size: 14, weight: 600 });
    b += L(136, 216, 240, 254, { stroke: ink, sw: 1 }) + T(246, 260, 'ช่องย้ำ 6P สำหรับ RJ-11 (สายโทรศัพท์)', { size: 14, weight: 600 });
    b += '</g>';
    b += T(624, 26, 'คีมย้ำหัว (Crimping tool)', { size: 15, weight: 700, anchor: 'end' });

    // ---- RJ-45 plug, view onto contacts (clip underneath)
    let y = 336;
    b += L(16, y - 18, 624, y - 18, { stroke: 'var(--line)', sw: 1 });
    b += T(16, y + 6, 'หัว RJ-45 (8P8C) มองด้านหน้าสัมผัส', { size: 15, weight: 700 });
    const px = 40, pw = 150, py = y + 44, ph = 116;
    for (let i = 0; i < 8; i++) b += vwire(pre, px + 17 + i * 16.5, py + 22, py + ph + 34, 9, T568B[i]);
    // cable jacket: opaque so the wires end inside it
    b += R(px + 6, py + 80, pw - 12, ph - 80 + 34, { rx: 4, fill: 'var(--panel)' }) + R(px + 6, py + 80, pw - 12, ph - 80 + 34, { rx: 4, fill: 'var(--muted)', fo: 0.5, stroke: 'var(--muted)', sw: 1 });
    b += R(px, py, pw, ph, { rx: 8, fill: WC.clear, fo: 0.3, stroke: ink, sw: 1.8 });
    for (let i = 0; i < 8; i++) {
      const wx = px + 17 + i * 16.5;
      b += R(wx - 4, py + 4, 8, 22, { rx: 1.5, fill: '#D4A62A', stroke: '#8C6A12', sw: 1 });
      b += T(wx, py - 7, String(i + 1), { size: 13, anchor: 'middle', weight: 700 });
    }
    b += L(px + pw + 6, py + 14, px + pw + 18, py + 14, { stroke: ink, sw: 1 }) + T(px + pw + 22, py + 18, 'หน้าสัมผัส', { size: 13.5 });
    b += T(px + pw + 22, py + 36, 'หันขึ้น', { size: 13.5 });
    b += T(px + pw + 22, py + ph + 18, 'สาย', { size: 13.5 });
    b += T(px + pw + 22, py + ph + 36, 'เข้าหาตัว', { size: 13.5 });
    b += R(px - 18, py + ph + 50, pw + 36, 48, { rx: 8, fill: 'var(--green)', fo: 0.12, stroke: 'var(--green)', sw: 1.5 });
    b += T(px + pw / 2, py + ph + 70, 'ตัวล็อก (Clip) คว่ำลงด้านล่าง', { size: 13.5, anchor: 'middle', weight: 700 });
    b += T(px + pw / 2, py + ph + 89, 'ขา 1 อยู่ซ้ายสุด ขา 8 ขวาสุด', { size: 13.5, anchor: 'middle', weight: 700 });

    // side view with numbered parts
    const sx = 282, sy = y + 70;
    b += T(sx, y + 40, 'มองด้านข้าง', { size: 14, weight: 700 });
    b += P(`M${sx} ${sy} L${sx + 140} ${sy} L${sx + 140} ${sy + 50} L${sx + 6} ${sy + 50} Q${sx} ${sy + 50} ${sx} ${sy + 44} Z`, { fill: WC.clear, fo: 0.3, stroke: ink, sw: 1.8 });
    b += R(sx + 6, sy - 3, 40, 6, { rx: 1, fill: '#D4A62A', stroke: '#8C6A12', sw: 1 });
    b += P(`M${sx + 24} ${sy + 50} L${sx + 92} ${sy + 72} L${sx + 96} ${sy + 64} L${sx + 40} ${sy + 50}`, { fill: WC.clear, fo: 0.5, stroke: ink, sw: 1.6 });
    b += P(`M${sx + 96} ${sy + 4} l14 0 l-6 14 l-14 0 z`, { fill: ink, fo: 0.5, stroke: ink, sw: 1 });
    b += R(sx + 140, sy + 8, 44, 34, { rx: 6, fill: 'var(--muted)', fo: 0.5, stroke: 'var(--muted)', sw: 1 });
    b += badge(sx + 26, sy - 18, '1') + badge(sx + 112, sy + 78, '2') + badge(sx + 124, sy - 14, '3');
    const lg = [['1', 'หน้าสัมผัสทองแดง (ด้านบน)'], ['2', 'ตัวล็อก (Clip) ด้านล่าง'], ['3', 'ตัวกดล็อกเปลือกนอก']];
    lg.forEach(([k, s2], i) => { b += badge(sx + 10, sy + 112 + i * 24, k) + T(sx + 28, sy + 117 + i * 24, s2, { size: 13.5 }); });

    // boot
    const bx = 562, by = y + 40;
    b += P(`M${bx - 30} ${by} L${bx + 30} ${by} L${bx + 22} ${by + 70} L${bx + 10} ${by + 120} L${bx - 10} ${by + 120} L${bx - 22} ${by + 70} Z`, { fill: 'var(--blue)', fo: 0.3, stroke: ink, sw: 1.6 });
    b += P(`M${bx - 24} ${by + 4} q 24 -18 48 0`, { stroke: ink, sw: 1.2 });
    for (let k = 0; k < 4; k++) b += L(bx - 16 + k * 2, by + 80 + k * 9, bx + 16 - k * 2, by + 80 + k * 9, { stroke: ink, sw: 1, so: 0.6 });
    b += T(bx, by + 144, 'ปลอกหุ้มหัว', { size: 14, weight: 700, anchor: 'middle' });
    b += T(bx, by + 162, '(Boot)', { size: 14, weight: 700, anchor: 'middle' });
    b += T(bx, by + 182, 'สวมเข้าสายก่อน', { size: 13, anchor: 'middle', fill: 'var(--muted)' });
    b += T(bx, by + 200, 'เข้าหัว', { size: 13, anchor: 'middle', fill: 'var(--muted)' });

    // ---- rotary stripper + LAN tester
    y = 620;
    b += L(16, y - 18, 624, y - 18, { stroke: 'var(--line)', sw: 1 });
    b += T(16, y + 6, 'คีมปอกสายแบบหมุน', { size: 15, weight: 700 });
    const rx = 86, ry = y + 90;
    b += P(`M${rx - 56} ${ry - 30} Q${rx - 60} ${ry - 56} ${rx - 30} ${ry - 56} L${rx + 40} ${ry - 56} Q${rx + 62} ${ry - 56} ${rx + 60} ${ry - 30} L${rx + 56} ${ry + 40} Q${rx + 52} ${ry + 56} ${rx + 30} ${ry + 56} L${rx - 30} ${ry + 56} Q${rx - 54} ${ry + 56} ${rx - 56} ${ry + 30} Z`, { fill: 'var(--orange)', fo: 0.25, stroke: ink, sw: 1.6 });
    b += C(rx, ry, 18, { fill: 'var(--panel)', stroke: ink, sw: 1.6 });
    b += C(rx, ry, 9, { fill: 'var(--muted)', fo: 0.55, stroke: 'var(--muted)', sw: 1 });
    b += P(`M${rx + 4} ${ry - 18} l6 -16 l6 0 l-6 16 z`, { fill: WC.foil, stroke: ink, sw: 1 });
    b += P(`M${rx - 34} ${ry + 34} a 44 44 0 0 1 -6 -54`, { stroke: 'var(--blue)', sw: 2.5 }) + P(`M${rx - 44} ${ry - 18} l4 -9 l4 9`, { stroke: 'var(--blue)', sw: 2.5, join: 'round' });
    b += L(rx + 14, ry - 30, rx + 70, ry - 64, { stroke: ink, sw: 1 }) + T(rx + 74, ry - 60, 'ใบมีด', { size: 13, weight: 600 });
    b += T(rx, ry + 82, 'สอดสาย หมุน 1–2 รอบ', { size: 13.5, anchor: 'middle' });
    b += T(rx, ry + 100, 'แล้วดึงเปลือกออก', { size: 13.5, anchor: 'middle' });

    // LAN tester
    b += T(214, y + 6, 'เครื่องทดสอบสาย (LAN Tester)', { size: 15, weight: 700 });
    function unit(ux, uy, w, title, lit, sw) {
      let s = R(ux, uy, w, 156, { rx: 12, fill: 'var(--field)', stroke: ink, sw: 1.6 });
      s += T(ux + w / 2, uy + 22, title, { size: 14, weight: 700, anchor: 'middle' });
      ['1', '2', '3', '4', '5', '6', '7', '8', 'G'].forEach((l, i) => {
        const lx = ux + 22 + i * ((w - 44) / 8), on = l === lit;
        s += C(lx, uy + 52, 7, { fill: on ? 'var(--green)' : 'var(--line)', stroke: on ? 'var(--green)' : 'var(--muted)', sw: 1.2 });
        s += T(lx, uy + 76, l, { size: 13, anchor: 'middle', weight: on ? 700 : 400 });
      });
      s += R(ux + w / 2 - 22, uy + 100, 44, 34, { rx: 3, fill: 'var(--panel)', stroke: ink, sw: 1.4 });
      s += R(ux + w / 2 - 14, uy + 104, 28, 6, { fill: '#D4A62A' });
      if (sw) s += R(ux + w - 44, uy + 106, 26, 14, { rx: 7, fill: 'var(--panel)', stroke: ink, sw: 1.2 }) + C(ux + w - 25, uy + 113, 5, { fill: ink }) + T(ux + w - 31, uy + 140, 'ON', { size: 13, anchor: 'middle' });
      return s;
    }
    const uy = y + 22;
    b += unit(214, uy, 196, 'ตัวแม่ (Master)', '4', true);
    b += unit(440, uy, 184, 'ตัวลูก (Remote)', '4', false);
    b += P(`M312 ${uy + 134} C 312 ${uy + 196}, 532 ${uy + 196}, 532 ${uy + 134}`, { stroke: 'var(--muted)', sw: 6, cap: 'round' });
    b += T(420, uy + 202, 'สายที่ทดสอบ', { size: 13, anchor: 'middle', fill: 'var(--muted)' });
    b += T(420, uy + 226, 'ไฟวิ่งทีละขา สายตรงที่ดี ขาเดียวกันติดพร้อมกันทั้งสองฝั่ง', { size: 13.5, anchor: 'middle' });
    b += T(420, uy + 244, 'ไฟ G ใช้ตรวจชีลด์ สาย UTP ไม่ติดถือว่าปกติ', { size: 13, anchor: 'middle', fill: 'var(--muted)' });
    NL_FIG('diagram', 'crimp-tools', svg(N, y + 280,
      'ภาพเครื่องมือเข้าหัวสาย UTP คีมย้ำหัว (Crimping tool) มองด้านข้าง มีใบมีดตัดสายที่ปลายคีม ช่องปอกเปลือก ช่องย้ำ 8P สำหรับหัว RJ-45 ช่องย้ำ 6P สำหรับ RJ-11 และเฟืองล็อก หัว RJ-45 มองจากด้านหน้าสัมผัส หน้าสัมผัสทองแดงหันขึ้น ตัวล็อกคว่ำลงด้านล่าง สายเข้าทางผู้ถือ ขา 1 อยู่ซ้ายสุดถึงขา 8 ขวาสุด เรียงสีตาม T568B ภาพด้านข้างแสดงหน้าสัมผัสด้านบน ตัวล็อกด้านล่าง และตัวกดล็อกเปลือก ปลอกหุ้มหัว (Boot) ต้องสวมเข้าสายก่อนเข้าหัว คีมปอกสายแบบหมุน และเครื่องทดสอบสาย LAN Tester มีตัวแม่และตัวลูก แต่ละตัวมีไฟ 1 ถึง 8 และ G ไฟวิ่งทีละขา สายตรงที่ดีขาเดียวกันติดพร้อมกันทั้งสองฝั่ง',
      b));
  })();

  /* ======================================================================
     9. network-adapter: mock "Network Connections" + adapter Properties (Windows 11 style)
     ====================================================================== */
  (function () {
    const N = 'network-adapter';
    const ink = 'var(--ink)';
    let b = '';
    b += R(470, 6, 154, 26, { rx: 13, fill: 'var(--orange)', fo: 0.14, stroke: 'var(--orange)', sw: 1.5 }) + T(547, 24, 'ภาพจำลองหน้าจอ', { size: 13.5, weight: 700, anchor: 'middle' });
    b += T(16, 26, 'Network Connections (ncpa.cpl)', { size: 17, weight: 700 });
    // window 1
    const wy = 42;
    b += R(16, wy, 608, 262, { rx: 10, fill: 'var(--panel)', stroke: 'var(--line)', sw: 1.5 });
    b += R(16, wy, 608, 34, { rx: 10, fill: 'var(--field)' }) + R(16, wy + 20, 608, 14, { fill: 'var(--field)' });
    b += T(32, wy + 23, 'Network Connections', { size: 14 });
    b += L(540, wy + 17, 552, wy + 17, { stroke: ink, sw: 1.2 }) + R(568, wy + 11, 11, 11, { stroke: ink, sw: 1.2 }) + L(596, wy + 11, 607, wy + 22, { stroke: ink, sw: 1.2 }) + L(607, wy + 11, 596, wy + 22, { stroke: ink, sw: 1.2 });
    b += R(28, wy + 42, 584, 26, { rx: 6, fill: 'var(--field)', stroke: 'var(--line)', sw: 1 });
    b += T(40, wy + 60, 'Control Panel  ›  Network and Internet  ›  Network Connections', { size: 13 });
    b += T(28, wy + 90, 'Organize ▾', { size: 13, fill: 'var(--muted)' }) + T(120, wy + 90, 'Disable this network device', { size: 13, fill: 'var(--muted)' }) + T(316, wy + 90, 'Diagnose this connection', { size: 13, fill: 'var(--muted)' });
    b += L(16, wy + 100, 624, wy + 100, { stroke: 'var(--line)', sw: 1 });
    function nicIcon(x, y, kind, state) {
      let s = '';
      const col = state === 'off' ? 'var(--muted)' : 'var(--blue)';
      s += R(x, y, 34, 24, { rx: 3, fill: col, fo: 0.18, stroke: col, sw: 1.6 });
      s += L(x + 17, y + 24, x + 17, y + 30, { stroke: col, sw: 2 }) + L(x + 9, y + 31, x + 25, y + 31, { stroke: col, sw: 2 });
      if (kind === 'wifi') s += P(`M${x + 9} ${y + 14} q8 -8 16 0 M${x + 12} ${y + 17} q5 -5 10 0`, { stroke: col, sw: 1.6 }) + C(x + 17, y + 19, 1.6, { fill: col });
      else s += R(x + 11, y + 8, 12, 9, { stroke: col, sw: 1.4 }) + L(x + 14, y + 12, x + 20, y + 12, { stroke: col, sw: 1.2 });
      if (state === 'unplugged') s += C(x + 32, y + 26, 8, { fill: 'var(--bad)' }) + L(x + 28.5, y + 22.5, x + 35.5, y + 29.5, { stroke: 'var(--on-accent)', sw: 2 }) + L(x + 35.5, y + 22.5, x + 28.5, y + 29.5, { stroke: 'var(--on-accent)', sw: 2 });
      return s;
    }
    const tiles = [
      ['Ethernet', 'LAB-NET', 'PCIe GbE Controller', 'eth', 'ok', 'var(--green)', ['เชื่อมต่อแล้ว', 'บรรทัดที่ 2 คือชื่อเครือข่าย']],
      ['Ethernet 2', 'Network cable unplugged', 'USB GbE Adapter', 'eth', 'unplugged', 'var(--bad)', ['ไม่ได้เสียบสาย', 'หรือสาย/พอร์ตเสีย']],
      ['Wi-Fi', 'Disabled', 'Wireless Adapter', 'wifi', 'off', 'var(--muted)', ['ถูกปิดใช้งาน', 'คลิกขวา › Enable']]
    ];
    tiles.forEach((t, i) => {
      const x = 28 + i * 198, y = wy + 112;
      if (i === 0) b += R(x - 6, y - 6, 192, 64, { rx: 6, fill: 'var(--blue)', fo: 0.12, stroke: 'var(--blue)', sw: 1.2 });
      b += nicIcon(x, y + 6, t[3], t[4]);
      b += T(x + 46, y + 12, t[0], { size: 14, weight: 700, fill: t[4] === 'off' ? 'var(--muted)' : ink });
      b += T(x + 46, y + 30, t[1], { size: 13, fill: t[4] === 'unplugged' ? 'var(--bad)' : t[4] === 'off' ? 'var(--muted)' : ink });
      b += T(x + 46, y + 48, t[2], { size: 13, fill: 'var(--muted)' });
      b += R(x - 6, y + 66, 186, 48, { rx: 8, fill: t[5], fo: 0.1, stroke: t[5], sw: 1.5 });
      b += T(x + 87, y + 86, t[6][0], { size: 13.5, weight: 700, anchor: 'middle' });
      b += T(x + 87, y + 105, t[6][1], { size: 13, anchor: 'middle' });
    });
    b += T(28, wy + 248, 'ถ้าขึ้น Unidentified network แปลว่าเสียบสายแล้วแต่ไม่ได้ค่าจาก DHCP หรือไม่มี Gateway', { size: 13, fill: 'var(--muted)' });

    // window 2: Properties dialog
    const dy = 328, dw = 386;
    b += R(16, dy, dw, 430, { rx: 10, fill: 'var(--panel)', stroke: 'var(--line)', sw: 1.5 });
    b += R(16, dy, dw, 34, { rx: 10, fill: 'var(--field)' }) + R(16, dy + 20, dw, 14, { fill: 'var(--field)' });
    b += T(32, dy + 23, 'Ethernet Properties', { size: 14 });
    b += L(dw - 8, dy + 11, dw + 3, dy + 22, { stroke: ink, sw: 1.2 }) + L(dw + 3, dy + 11, dw - 8, dy + 22, { stroke: ink, sw: 1.2 });
    b += T(32, dy + 58, 'Networking', { size: 13.5, weight: 700 }) + L(32, dy + 64, 106, dy + 64, { stroke: 'var(--blue)', sw: 2.5 }) + T(124, dy + 58, 'Sharing', { size: 13.5, fill: 'var(--muted)' });
    b += T(32, dy + 88, 'Connect using:', { size: 13 });
    b += R(32, dy + 96, 236, 26, { rx: 4, fill: 'var(--field)', stroke: 'var(--line)', sw: 1 }) + T(42, dy + 114, 'PCIe GbE Controller', { size: 13 });
    b += R(278, dy + 96, 104, 26, { rx: 4, fill: 'var(--field)', stroke: 'var(--line)', sw: 1 }) + T(330, dy + 114, 'Configure...', { size: 13, anchor: 'middle' });
    b += T(32, dy + 144, 'This connection uses the following items:', { size: 13 });
    const items = [
      [1, 'Client for Microsoft Networks'], [1, 'File and Printer Sharing for Microsoft Networks'], [1, 'QoS Packet Scheduler'],
      [1, 'Internet Protocol Version 4 (TCP/IPv4)'], [0, 'Microsoft Network Adapter Multiplexor Protocol'], [1, 'Microsoft LLDP Protocol Driver'],
      [1, 'Internet Protocol Version 6 (TCP/IPv6)'], [1, 'Link-Layer Topology Discovery Responder'], [1, 'Link-Layer Topology Discovery Mapper I/O Driver']
    ];
    b += R(44, dy + 152, 338, items.length * 21 + 10, { rx: 4, fill: 'var(--field)', stroke: 'var(--line)', sw: 1 });
    items.forEach(([on, txt], i) => {
      const y = dy + 160 + i * 21;
      if (i === 3) b += R(46, y - 2, 334, 21, { fill: 'var(--blue)', fo: 0.2 });
      b += R(52, y + 3, 13, 13, { rx: 2, fill: on ? 'var(--blue)' : 'var(--panel)', stroke: on ? 'var(--blue)' : 'var(--muted)', sw: 1.2 });
      if (on) b += P(`M54.5 ${y + 9.5} l3.5 3.5 l6 -7`, { stroke: 'var(--on-accent)', sw: 1.8 });
      b += T(72, y + 14, txt, { size: 13 });
    });
    const by2 = dy + 160 + items.length * 21 + 12;
    ['Install...', 'Uninstall', 'Properties'].forEach((s, i) => {
      const x = 32 + i * 118;
      b += R(x, by2, 110, 26, { rx: 4, fill: i === 2 ? 'var(--blue)' : 'var(--field)', fo: i === 2 ? 0.2 : null, stroke: i === 2 ? 'var(--blue)' : 'var(--line)', sw: i === 2 ? 2 : 1 });
      b += T(x + 55, by2 + 18, s, { size: 13, anchor: 'middle', weight: i === 2 ? 700 : 400 });
    });
    b += T(32, by2 + 50, 'Description: TCP/IP ใช้สื่อสารข้ามเครือข่าย', { size: 13, fill: 'var(--muted)' });
    // callouts
    const cx0 = 418;
    const notes = [
      [dy + 100, '1', 'Configure...', ['ตั้งค่าไดรเวอร์การ์ด เช่น', 'Speed & Duplex (แท็บ Advanced)']],
      [dy + 172, '2', 'File and Printer Sharing', ['ต้องติ๊กไว้ เครื่องอื่นจึง', 'เข้าโฟลเดอร์แชร์ของเราได้']],
      [dy + 244, '3', 'TCP/IPv4 › Properties', ['เลือกแล้วกด Properties เพื่อตั้ง', 'IP, Mask, Gateway และ DNS']],
      [dy + 316, '4', 'TCP/IPv6', ['ปล่อยติ๊กไว้ Windows ใช้ IPv6', 'ภายในด้วย ไม่ควรปิด']],
      [dy + 388, '5', 'ช่องติ๊กถูก', ['เอาออก = ปิดรายการนั้น', 'เฉพาะการ์ดตัวนี้']]
    ];
    const anchorY = { '1': dy + 109, '2': dy + 190, '3': dy + 232, '4': dy + 295, '5': 0 };
    const anchorX = { '1': 382, '2': 382, '3': 382, '4': 382, '5': 53 };
    notes.forEach(([yy, num, head, lines]) => {
      if (num !== '5') b += L(anchorX[num], anchorY[num], cx0 - 2, yy - 4, { stroke: 'var(--blue)', sw: 1.2 });
      b += badge(cx0 + 10, yy - 4, num);
      b += T(cx0 + 28, yy, head, { size: 13.5, weight: 700 });
      lines.forEach((l, k) => { b += T(cx0 + 28, yy + 18 + k * 17, l, { size: 13 }); });
    });
    b += badge(30, dy + 160 + 4 * 21 + 9, '5');
    b += T(16, dy + 456, 'วาดจำลองตามรูปแบบหน้าต่าง Windows 11 รายการจริงอาจต่างกันตามเครื่องและไดรเวอร์', { size: 13, fill: 'var(--muted)' });
    NL_FIG('diagram', 'network-adapter', svg(N, dy + 468,
      'ภาพจำลองหน้าจอ Windows 11 หน้าต่าง Network Connections (ncpa.cpl) มีการ์ดเครือข่าย 3 ตัว Ethernet เชื่อมต่อแล้วแสดงชื่อเครือข่าย LAB-NET, Ethernet 2 แสดง Network cable unplugged มีกากบาทสีแดงหมายถึงไม่ได้เสียบสายหรือสายเสีย และ Wi-Fi แสดง Disabled สีเทาหมายถึงถูกปิดใช้งาน ต้องคลิกขวาเลือก Enable ด้านล่างเป็นหน้าต่าง Ethernet Properties แท็บ Networking มีปุ่ม Configure สำหรับตั้งค่าไดรเวอร์เช่น Speed and Duplex รายการที่การ์ดใช้ ได้แก่ Client for Microsoft Networks, File and Printer Sharing for Microsoft Networks ซึ่งต้องเปิดไว้จึงแชร์ไฟล์ได้, QoS Packet Scheduler, Internet Protocol Version 4 (TCP/IPv4) ที่ถูกเลือกไว้ กด Properties เพื่อตั้ง IP, Mask, Gateway และ DNS, Internet Protocol Version 6 ควรเปิดไว้ และการเอาเครื่องหมายถูกออกคือปิดรายการนั้นเฉพาะการ์ดตัวนี้',
      b));
  })();

  /* ======================================================================
     10. ipconfig-output: annotated ipconfig /all + problem patterns
     ====================================================================== */
  (function () {
    const N = 'ipconfig-output';
    let b = '';
    const lh = 19, fs = 13;
    function term(x, y, w, lines, marks) {
      const h = lines.length * lh + 20;
      let s = R(x, y, w, h, { rx: 10, fill: 'var(--term-bg)' });
      lines.forEach((ln, i) => {
        const ty = y + 22 + i * lh;
        const parts = typeof ln === 'string' ? [[ln, 0]] : ln;
        let tx = x + 40;
        let out = `<text x="${tx}" y="${ty}" font-size="${fs}" font-family='${MONO}' xml:space="preserve" style="white-space:pre">`;
        let col = 0, under = '';
        for (const [seg, kind] of parts) {
          out += `<tspan fill="${kind === 3 ? 'var(--term-dim)' : 'var(--term-ink)'}"${kind === 1 || kind === 2 ? ' font-weight="700"' : ''}>${esc(seg)}</tspan>`;
          // problem values: red underline (monospace advance 0.6em)
          if (kind === 2) under += R(tx + col * fs * 0.6, ty + 4, seg.length * fs * 0.6, 3, { rx: 1.5, fill: 'var(--bad)' });
          col += seg.length;
        }
        s += out + '</text>' + under;
        if (marks && marks[i]) s += badge(x + 20, ty - 4, marks[i], marks[i].startsWith('!') ? 'var(--bad)' : 'var(--blue)').replace(`>${marks[i]}<`, `>${marks[i].replace('!', '')}<`);
      });
      return [s, h];
    }
    const dim = 3;
    b += T(16, 26, 'อ่านผลคำสั่ง ipconfig /all', { size: 17, weight: 700 });
    const L1 = [
      [['C:\\>', dim], ['ipconfig /all', 1]],
      '',
      [['Ethernet adapter Ethernet:', 1]],
      '',
      [['   Description . . . . . . . . . . . : ', dim], ['PCIe GbE Controller', 0]],
      [['   Physical Address. . . . . . . . . : ', dim], ['3C-52-82-1A-9F-07', 1]],
      [['   DHCP Enabled. . . . . . . . . . . : ', dim], ['Yes', 1]],
      [['   Autoconfiguration Enabled . . . . : ', dim], ['Yes', 0]],
      [['   Link-local IPv6 Address . . . . . : ', dim], ['fe80::1c4a:5e17%12', 1], ['(Preferred)', 0]],
      [['   IPv4 Address. . . . . . . . . . . : ', dim], ['192.168.20.57', 1], ['(Preferred)', 0]],
      [['   Subnet Mask . . . . . . . . . . . : ', dim], ['255.255.255.0', 1]],
      [['   Lease Obtained. . . . . . . . . . : ', dim], ['12 October 2026 08:05:13', 0]],
      [['   Lease Expires . . . . . . . . . . : ', dim], ['13 October 2026 08:05:13', 0]],
      [['   Default Gateway . . . . . . . . . : ', dim], ['192.168.20.1', 1]],
      [['   DHCP Server . . . . . . . . . . . : ', dim], ['192.168.20.1', 1]],
      [['   DNS Servers . . . . . . . . . . . : ', dim], ['192.168.20.10', 1]],
      [['                                       ', dim], ['8.8.8.8', 1]],
      [['   NetBIOS over Tcpip. . . . . . . . : ', dim], ['Enabled', 0]]
    ];
    const M1 = { 5: '1', 6: '2', 8: '3', 9: '4', 10: '5', 11: '6', 13: '7', 14: '8', 15: '9' };
    const [t1, h1] = term(16, 40, 608, L1, M1);
    b += t1;
    let y = 40 + h1 + 30;
    const ex = [
      ['1', 'Physical Address', 'MAC Address 48 บิตของการ์ดตัวนี้ ใช้ทำ MAC filtering หรือจอง IP ใน DHCP'],
      ['2', 'DHCP Enabled', 'Yes = รับค่าอัตโนมัติจาก DHCP · No = ตั้ง Static เอง (ไม่มีบรรทัด Lease)'],
      ['3', 'Link-local IPv6', 'fe80:: สร้างเองทุกการ์ด ใช้ได้เฉพาะในวงเดียวกัน · %12 = เลข Interface'],
      ['4', 'IPv4 Address', '(Preferred) = ใช้งานได้ · ถ้าขึ้น (Duplicate) = IP ซ้ำกับเครื่องอื่น'],
      ['5', 'Subnet Mask', '255.255.255.0 = /24 เครื่องวงเดียวกันคือ 192.168.20.1 ถึง .254'],
      ['6', 'Lease Obtained / Expires', 'ช่วงเวลาที่ยืม IP จาก DHCP เครื่องจะขอต่ออายุเองก่อนหมดเวลา'],
      ['7', 'Default Gateway', 'Router สำหรับออกนอกวง ต้องอยู่วงเดียวกับ IPv4 ถ้าว่างจะคุยได้แค่ในวง'],
      ['8', 'DHCP Server', 'เครื่องที่แจก IP ให้ ในบ้านมักเป็น Router ตัวเดียวกับ Gateway'],
      ['9', 'DNS Servers', 'ตัวแปลงชื่อเป็น IP ถ้าผิด จะ ping ด้วย IP ได้ แต่เปิดเว็บด้วยชื่อไม่ได้']
    ];
    ex.forEach(([num, head, txt], i) => {
      const yy = y + i * 44;
      b += badge(28, yy - 5, num);
      b += T(46, yy, head, { size: 14, weight: 700 });
      b += T(46, yy + 19, txt, { size: 13.5 });
    });
    y += ex.length * 44 + 12;
    b += T(16, y, 'เมื่อมีปัญหาจะเห็นแบบนี้', { size: 16, weight: 700 });
    y += 12;
    const L2 = [
      [['Ethernet adapter Ethernet:', 1]],
      [['   DHCP Enabled. . . . . . . . . . . : ', dim], ['Yes', 0]],
      [['   Autoconfiguration IPv4 Address. . : ', dim], ['169.254.83.12', 2], ['(Preferred)', 0]],
      [['   Subnet Mask . . . . . . . . . . . : ', dim], ['255.255.0.0', 0]],
      [['   Default Gateway . . . . . . . . . : ', dim]],
      '',
      [['Wireless LAN adapter Wi-Fi:', 1]],
      [['   Media State . . . . . . . . . . . : ', dim], ['Media disconnected', 2]]
    ];
    const [t2, h2] = term(16, y, 608, L2, { 2: '!A', 4: '!B', 7: '!C' });
    b += t2;
    y += h2 + 28;
    const pr = [
      ['A', '169.254.x.x (APIPA)', 'ขอ IP จาก DHCP ไม่สำเร็จ ตรวจสาย ไฟพอร์ต Switch และ Router/DHCP'],
      ['B', 'Default Gateway ว่าง', 'ไม่มีทางออกนอกวง ออกอินเทอร์เน็ตไม่ได้ (Static ลืมใส่ หรือไม่ได้ DHCP)'],
      ['C', 'Media disconnected', 'การ์ดนี้ไม่ได้เชื่อมต่อ: สายไม่ได้เสียบ หรือ Wi-Fi ยังไม่ได้ต่อ']
    ];
    pr.forEach(([num, head, txt], i) => {
      const yy = y + i * 44;
      b += badge(28, yy - 5, num, 'var(--bad)');
      b += T(46, yy, head, { size: 14, weight: 700 });
      b += T(46, yy + 19, txt, { size: 13.5 });
    });
    y += pr.length * 44;
    NL_FIG('diagram', 'ipconfig-output', svg(N, y,
      'ตัวอย่างผลคำสั่ง ipconfig /all ของการ์ด Ethernet พร้อมหมายเลขอธิบาย Physical Address 3C-52-82-1A-9F-07 คือ MAC Address, DHCP Enabled Yes คือรับค่าจาก DHCP, Link-local IPv6 ขึ้นต้น fe80 สร้างเองอัตโนมัติ, IPv4 Address 192.168.20.57 (Preferred) คือใช้งานได้ ถ้าเป็น Duplicate คือ IP ซ้ำ, Subnet Mask 255.255.255.0 คือ /24, Lease Obtained และ Lease Expires คือช่วงเวลายืม IP, Default Gateway 192.168.20.1 คือ Router ออกนอกวง, DHCP Server 192.168.20.1 และ DNS Servers 192.168.20.10 กับ 8.8.8.8 ส่วนล่างแสดงอาการผิดปกติ ได้แก่ Autoconfiguration IPv4 Address 169.254.x.x หมายถึงขอ IP จาก DHCP ไม่สำเร็จ, Default Gateway ว่างหมายถึงออกนอกวงไม่ได้ และ Media disconnected หมายถึงไม่ได้เสียบสายหรือยังไม่ได้ต่อ Wi-Fi',
      b));
  })();
  /* ======================================================================
     Widgets (batch b). Shared helpers. Classes .nlfb-*; base look from widgets.js (.nlw-*)
     ====================================================================== */
  const FB_CSS = `
.nlfb [hidden]{display:none !important}
.nlfb .nlw-btn,.nlfb select{min-height:44px}
.nlfb .nlw-btn.nlfb-sq{min-width:44px}
.nlfb .nlfb-svg svg{display:block;width:100%;height:auto}
.nlfb .nlfb-svg{border:1px solid var(--line);border-radius:10px;background:var(--field);overflow:hidden;margin:8px 0}
.nlfb .nlfb-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr));gap:6px;margin:8px 0}
.nlfb .nlfb-stat{border:1px solid var(--line);border-radius:8px;background:var(--field);padding:6px 10px;min-width:0}
.nlfb .nlfb-stat span{display:block;font-size:13.5px;color:var(--muted)}
.nlfb .nlfb-stat b{font-size:18px}
.nlfb .nlfb-log{list-style:none;margin:6px 0;padding:0;font-size:14.5px}
.nlfb .nlfb-log li{border-left:4px solid var(--line);padding:3px 10px;margin:4px 0;background:var(--field);border-radius:0 6px 6px 0}
.nlfb .nlfb-log li.nlfb-e{border-left-color:var(--bad)}
.nlfb .nlfb-log li.nlfb-o{border-left-color:var(--ok)}
.nlfb .nlfb-log li.nlfb-i{border-left-color:var(--blue)}
.nlfb .nlfb-strip{display:flex;flex-wrap:wrap;gap:2px;margin:6px 0}
.nlfb .nlfb-strip i{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:4px;font-style:normal;font-size:12.5px;font-weight:700;border:1px solid var(--line);background:var(--panel);color:var(--ink)}
.nlfb .nlfb-strip i.nlfb-tx{background:color-mix(in srgb,var(--blue) 22%,var(--panel));border-color:var(--blue)}
.nlfb .nlfb-strip i.nlfb-col{background:color-mix(in srgb,var(--bad) 26%,var(--panel));border-color:var(--bad)}
.nlfb .nlfb-strip i.nlfb-multi{background:color-mix(in srgb,var(--green) 24%,var(--panel));border-color:var(--green)}
.nlfb .nlfb-cmp{width:100%;border-collapse:collapse;font-size:14.5px;margin:6px 0}
.nlfb .nlfb-cmp th,.nlfb .nlfb-cmp td{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left}
.nlfb .nlfb-cmp th{color:var(--muted);font-weight:600;background:var(--field)}
.nlfb .nlfb-dots{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.nlfb .nlfb-dots .nlw-btn{min-width:44px;padding:4px 8px}
.nlfb .nlfb-dots .nlw-btn[aria-current="step"]{background:var(--blue);border-color:var(--blue);color:var(--panel);font-weight:700}
.nlfb .nlfb-mist{border:1px solid var(--line);border-left:5px solid var(--orange);border-radius:0 10px 10px 0;background:var(--field);padding:8px 12px;margin:8px 0}
.nlfb .nlfb-mist.nlfb-on{border-left-color:var(--bad)}
.nlfb .nlfb-mist p{margin:.25em 0}
.nlfb .nlfb-h{font-weight:700;font-size:16.5px;margin:8px 0 2px}
.nlfb .nlfb-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;margin:6px 0}
.nlfb .nlfb-legend span{display:inline-flex;align-items:center;gap:6px}
.nlfb .nlfb-legend i{display:inline-block;width:16px;height:16px;border-radius:3px;border:1px solid var(--line)}
.nlfb .nlfb-row{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:8px 0}
.nlfb .nlfb-row .nlw-field{min-width:120px}
.nlfb .nlfb-bars{display:grid;gap:6px;margin:8px 0}
.nlfb .nlfb-bar{display:grid;grid-template-columns:minmax(0,110px) minmax(0,1fr) 52px;gap:8px;align-items:center;font-size:14.5px}
.nlfb .nlfb-bar .nlfb-track{height:14px;border-radius:7px;background:var(--line);overflow:hidden}
.nlfb .nlfb-bar .nlfb-track i{display:block;height:100%;border-radius:7px}
.nlfb .nlfb-ap{cursor:pointer}
.nlfb .nlfb-ap:focus{outline:none}
.nlfb .nlfb-ap:focus-visible .nlfb-ring{stroke:var(--ink);stroke-width:3}
.nlfb .nlfb-plan{cursor:crosshair;touch-action:manipulation}
@media (prefers-reduced-motion:no-preference){.nlfb .nlfb-bar .nlfb-track i{transition:width .25s}}
`;
  function fbCSS() {
    if (!document.getElementById('nl-widget-css')) {
      const base = window.NL_WIDGETS && window.NL_WIDGETS['caesar'];
      if (typeof base === 'function') { try { base(document.createElement('div')); } catch (e) { /* base css optional */ } }
    }
    if (document.getElementById('nlfb-css')) return;
    const st = document.createElement('style');
    st.id = 'nlfb-css';
    st.textContent = FB_CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  const KEEP = { value: 1, checked: 1, disabled: 1, selected: 1 };
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
  function addc(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(x => addc(e, x)); return; }
    e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function fbFrame(root, cls, title, instr) {
    fbCSS();
    root.replaceChildren();
    root.classList.add('nlw', 'nlfb', cls);
    root.appendChild(h('div', { class: 'nlw-title' }, title));
    root.appendChild(h('p', { class: 'nlw-instr' }, h('b', null, 'คำแนะนำการใช้งาน: '), instr));
  }
  function fbSeg(opts, val, onChange, label) {
    const wrap = h('div', { class: 'nlw-seg', role: 'group', 'aria-label': label });
    const btns = opts.map(o => h('button', { type: 'button', class: 'nlw-btn', 'data-v': o[0], 'aria-pressed': String(o[0] === val), onclick: () => { set(o[0]); onChange(o[0]); } }, o[1]));
    function set(v) { btns.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === String(v)))); }
    btns.forEach(b => wrap.appendChild(b));
    return { el: wrap, set: set };
  }
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  let UID = 0;

  /* ======================================================================
     2. duplex-modes: half-duplex hub (CSMA/CD + binary exponential backoff) vs full-duplex switch
     ====================================================================== */
  NL_FIG('widget', 'duplex-modes', function (root) {
    fbFrame(root, 'nlfb-duplex', 'Half-duplex บน Hub กับ Full-duplex บน Switch',
      'เลือกโหมด แล้วกด "ก้าวทีละ slot" เพื่อดูทีละช่วงเวลา หรือ "เล่น" ให้รันต่อเนื่อง ทุกเครื่องมีเฟรมรอส่งชุดเดียวกัน ลองรันทั้งสองโหมดแล้วเทียบเวลาที่ใช้และจำนวนการชนในตารางด้านล่าง');
    const RM = reducedMotion();
    const ST = ['A', 'B', 'C', 'D'];
    const POS = { A: [96, 56], B: [544, 56], C: [96, 274], D: [544, 274] };
    const FRAME = 3, PER = 2;
    let mode = 'half', seed = 7, rng, work, S, timer = null, results = { half: null, full: null };
    function mkRng(sd) { let x = sd >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
    function makeWork() {
      const r = mkRng(seed * 7919);
      work = {};
      ST.forEach(s => { work[s] = []; for (let k = 0; k < PER; k++) { const others = ST.filter(o => o !== s); work[s].push(others[Math.floor(r() * 3)]); } });
    }
    function reset() {
      stop();
      rng = mkRng(seed * 104729 + (mode === 'half' ? 1 : 2));
      S = { t: 0, delivered: 0, collisions: 0, dropped: 0, hist: [], log: [], done: false, st: {}, cur: null, flash: null, sw: {} };
      ST.forEach(s => {
        S.st[s] = { q: work[s].slice(), backoff: 0, att: 0, up: null };
        S.sw[s] = { queue: [], down: null };
      });
      draw();
    }
    const total = () => ST.length * PER;
    function logm(cls, txt) { S.log.unshift([cls, 'slot ' + S.t + ': ' + txt]); S.log = S.log.slice(0, 6); }
    function stepHalf() {
      S.t++; S.flash = null;
      if (S.cur) {
        const c = S.cur; c.left--;
        ST.forEach(s => { if (s !== c.src && S.st[s].backoff > 0) S.st[s].backoff--; });
        S.hist.push(['tx', c.src]);
        if (c.left === 0) {
          S.delivered++; S.st[c.src].q.shift(); S.st[c.src].att = 0; S.cur = null;
          logm('nlfb-o', `PC ${c.src} ส่งถึง PC ${c.dst} สำเร็จ`);
        }
        return;
      }
      const ready = ST.filter(s => S.st[s].q.length && S.st[s].backoff === 0);
      ST.forEach(s => { if (!ready.includes(s) && S.st[s].backoff > 0) S.st[s].backoff--; });
      if (!ready.length) { S.hist.push(['idle']); return; }
      if (ready.length === 1) {
        const s = ready[0];
        S.cur = { src: s, dst: S.st[s].q[0], left: FRAME - 1 };
        S.hist.push(['tx', s]);
        logm('nlfb-i', `สายว่าง PC ${s} เริ่มส่งเฟรมถึง PC ${S.st[s].q[0]} เครื่องอื่นได้ยินว่าสายไม่ว่างจึงรอ`);
        return;
      }
      S.collisions++; S.flash = ready.slice(); S.hist.push(['col', ready.join('')]);
      const parts = [];
      ready.forEach(s => {
        const o = S.st[s]; o.att++;
        if (o.att >= 16) { o.q.shift(); o.att = 0; S.dropped++; parts.push(`PC ${s} ชนครบ 16 ครั้ง ทิ้งเฟรม`); return; }
        const k = Math.min(o.att, 10), max = Math.pow(2, k) - 1;
        o.backoff = Math.floor(rng() * (max + 1));
        parts.push(`PC ${s} ชนครั้งที่ ${o.att} สุ่ม 0–${max} ได้รอ ${o.backoff} slot`);
      });
      logm('nlfb-e', `ชนกัน! ${ready.map(s => 'PC ' + s).join(' กับ ')} ส่งพร้อมกัน ส่งสัญญาณ Jam แล้ว ` + parts.join(', '));
    }
    function stepFull() {
      S.t++;
      let active = 0;
      // switch output ports first (store-and-forward: a frame received this slot leaves next slot)
      ST.forEach(p => {
        const port = S.sw[p];
        if (port.down) {
          port.down.left--; active++;
          if (port.down.left === 0) { S.delivered++; logm('nlfb-o', `Switch ส่งเฟรมจาก PC ${port.down.src} ออกพอร์ตของ PC ${p} สำเร็จ`); port.down = null; }
        } else if (port.queue.length) {
          const f = port.queue.shift(); port.down = { src: f.src, left: FRAME - 1 }; active++;
          if (port.queue.length) logm('nlfb-i', `พอร์ตของ PC ${p} มีเฟรมรอคิวในบัฟเฟอร์ ${port.queue.length} เฟรม (รอคิว ไม่ใช่การชน)`);
        }
      });
      ST.forEach(s => {
        const o = S.st[s];
        if (o.up) {
          o.up.left--; active++;
          if (o.up.left === 0) { S.sw[o.up.dst].queue.push({ src: s }); o.q.shift(); o.up = null; }
        } else if (o.q.length) {
          o.up = { dst: o.q[0], left: FRAME - 1 }; active++;
          logm('nlfb-i', `PC ${s} ส่งเฟรมถึง PC ${o.q[0]} บนคู่สาย TX ของตัวเอง พร้อมกับรับข้อมูลบนคู่ RX ได้`);
        }
      });
      S.hist.push(active ? ['multi', String(active)] : ['idle']);
    }
    function finished() {
      if (mode === 'half') return !S.cur && ST.every(s => !S.st[s].q.length);
      return ST.every(s => !S.st[s].q.length && !S.st[s].up && !S.sw[s].down && !S.sw[s].queue.length);
    }
    function step() {
      if (S.done) return;
      if (mode === 'half') stepHalf(); else stepFull();
      if (finished()) {
        S.done = true; stop();
        results[mode] = { t: S.t, col: S.collisions, drop: S.dropped };
        logm('nlfb-o', `ส่งครบ ${S.delivered} เฟรม ใช้เวลา ${S.t} slot`);
      }
      if (S.t > 4000) { S.done = true; stop(); }
      draw();
    }
    function play() {
      if (timer) { stop(); draw(); return; }
      if (S.done) reset();
      timer = setInterval(() => { if (!root.isConnected) { stop(); return; } step(); }, 650);
      draw();
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function runAll() { stop(); let g = 0; while (!S.done && g++ < 5000) { if (mode === 'half') stepHalf(); else stepFull(); if (finished()) { S.done = true; results[mode] = { t: S.t, col: S.collisions, drop: S.dropped }; logm('nlfb-o', `ส่งครบ ${S.delivered} เฟรม ใช้เวลา ${S.t} slot`); } } draw(); }

    // ---- view
    const segMode = fbSeg([['half', 'Half-duplex (Hub)'], ['full', 'Full-duplex (Switch)']], mode, v => { mode = v; reset(); }, 'โหมดการส่ง');
    const bStep = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: () => { stop(); step(); } }, 'ก้าวทีละ slot');
    const bPlay = h('button', { type: 'button', class: 'nlw-btn', onclick: play, hidden: RM }, 'เล่น');
    const bAll = h('button', { type: 'button', class: 'nlw-btn', onclick: runAll }, 'รันจนจบ');
    const bReset = h('button', { type: 'button', class: 'nlw-btn', onclick: reset }, 'เริ่มใหม่');
    const bNew = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { seed = (seed * 48271) % 2147483647; makeWork(); results = { half: null, full: null }; reset(); } }, 'สุ่มงานชุดใหม่');
    const svgBox = h('div', { class: 'nlfb-svg', 'aria-hidden': 'true' });
    const stats = h('div', { class: 'nlfb-stats', 'aria-live': 'polite' });
    const strip = h('div', { class: 'nlfb-strip', 'aria-hidden': 'true' });
    const log = h('ul', { class: 'nlfb-log', 'aria-live': 'polite' });
    const legend = h('div', { class: 'nlw-small' });
    const cmp = h('div');
    root.appendChild(segMode.el);
    root.appendChild(h('div', { class: 'nlw-row nlw-center' }, bStep, bPlay, bAll, bReset, bNew));
    root.appendChild(svgBox);
    root.appendChild(stats);
    root.appendChild(h('div', { class: 'nlw-small' }, 'แต่ละช่องคือ 1 slot (ใน 10 Mb/s Ethernet 1 slot = 512 บิต = 51.2 ไมโครวินาที) และในแบบจำลองนี้ 1 เฟรมใช้ ' + FRAME + ' slot'));
    root.appendChild(strip);
    root.appendChild(legend);
    root.appendChild(log);
    root.appendChild(cmp);
    root.appendChild(h('div', { class: 'nlw-box' },
      h('p', null, h('b', null, 'Half-duplex: '), 'Hub ทวนสัญญาณออกทุกพอร์ต ทุกเครื่องใช้สื่อร่วมกัน ส่งหรือรับได้ทีละทาง ต้องใช้ CSMA/CD ฟังก่อนส่ง ถ้าชนให้ส่ง Jam แล้วสุ่มรอ (Binary exponential backoff) หลังชนครั้งที่ n สุ่มรอ 0 ถึง 2', h('sup', null, 'n'), ' − 1 slot (n สูงสุด 10) ชนครบ 16 ครั้งทิ้งเฟรม'),
      h('p', null, h('b', null, 'Full-duplex: '), 'แต่ละพอร์ตของ Switch เป็นลิงก์ของเครื่องเดียว ส่งบนคู่ TX และรับบนคู่ RX แยกกัน จึงไม่มีการชนและปิด CSMA/CD ถ้าหลายเครื่องส่งหาเครื่องเดียวกัน Switch เก็บเฟรมไว้ในบัฟเฟอร์รอคิวแทน'),
      h('p', { class: 'nlw-small' }, 'ถ้าตั้งค่า Duplex สองฝั่งไม่ตรงกัน (Duplex mismatch) เช่น ฝั่งหนึ่ง Full อีกฝั่ง Half ลิงก์ยังขึ้นแต่ช้ามาก และฝั่ง Half จะพบ Late collision ปัจจุบันจึงควรปล่อยเป็น Auto-negotiation ทั้งสองฝั่ง')));

    function draw() {
      const half = mode === 'half';
      const cx = 320, cy = 165;
      let s = `<svg viewBox="0 0 640 330" xmlns="http://www.w3.org/2000/svg" font-family="inherit">`;
      ST.forEach(p => {
        const [x, y] = POS[p];
        if (half) {
          let col = 'var(--line)', w = 4, dash = '';
          if (S.flash) { col = 'var(--bad)'; w = 5; }
          else if (S.cur) { col = S.cur.src === p ? 'var(--blue)' : 'var(--blue)'; w = S.cur.src === p ? 6 : 3; dash = S.cur.src === p ? '' : '6 5'; }
          s += L(x, y, cx, cy, { stroke: col, sw: w, dash: dash || null, cap: 'round' });
          if (S.cur && S.cur.src === p) {
            const f = (FRAME - S.cur.left) / FRAME;
            s += R(x + (cx - x) * f - 9, y + (cy - y) * f - 7, 18, 14, { rx: 3, fill: 'var(--blue)' });
          }
        } else {
          const dx = cx - x, dy = cy - y, len = Math.hypot(dx, dy), nx = -dy / len * 6, ny = dx / len * 6;
          const up = S.st[p].up, dn = S.sw[p].down;
          s += L(x + nx, y + ny, cx + nx, cy + ny, { stroke: up ? 'var(--blue)' : 'var(--line)', sw: up ? 5 : 3 });
          s += L(x - nx, y - ny, cx - nx, cy - ny, { stroke: dn ? 'var(--green)' : 'var(--line)', sw: dn ? 5 : 3 });
          if (up) { const f = (FRAME - up.left) / FRAME; s += R(x + nx + dx * f - 8, y + ny + dy * f - 6, 16, 12, { rx: 3, fill: 'var(--blue)' }); }
          if (dn) { const f = 1 - (FRAME - dn.left) / FRAME; s += R(x - nx + dx * f - 8, y - ny + dy * f - 6, 16, 12, { rx: 3, fill: 'var(--green)' }); }
          const q = S.sw[p].queue.length;
          if (q) { const qx = cx + (x - cx) * 0.25, qy = cy + (y - cy) * 0.25 + (y < cy ? -18 : 18); s += R(qx - 32, qy - 13, 64, 26, { rx: 5, fill: 'var(--orange)', fo: 0.2, stroke: 'var(--orange)', sw: 1.5 }) + T(qx, qy + 6, 'คิว ' + q, { size: 16, anchor: 'middle', weight: 700 }); }
        }
      });
      // centre device
      s += R(cx - 78, cy - 26, 156, 52, { rx: 8, fill: 'var(--panel)' });
      s += R(cx - 78, cy - 26, 156, 52, { rx: 8, fill: half ? 'var(--orange)' : 'var(--blue)', fo: 0.16, stroke: half ? 'var(--orange)' : 'var(--blue)', sw: 2 });
      s += T(cx, cy - 2, half ? 'Hub' : 'Switch', { size: 21, weight: 700, anchor: 'middle' });
      s += T(cx, cy + 19, half ? 'สื่อใช้ร่วมกัน' : 'แยก TX/RX', { size: 16, anchor: 'middle', fill: 'var(--muted)' });
      if (half && S.flash) {
        s += P(`M${cx} ${cy - 62} l10 22 l24 -8 l-12 20 l22 12 l-24 4 l4 24 l-24 -14 l-16 18 l-4 -24 l-24 -2 l20 -14 l-14 -20 l24 6 z`, { fill: 'var(--bad)', fo: 0.25, stroke: 'var(--bad)', sw: 2 });
        s += T(cx, cy - 36, 'ชนกัน! Jam', { size: 18, weight: 700, anchor: 'middle', fill: 'var(--bad)' });
      }
      if (!half) s += T(POS.A[0] + 66, POS.A[1] + 48, 'TX', { size: 16, fill: 'var(--blue)', weight: 700 }) + T(POS.A[0] + 14, POS.A[1] + 70, 'RX', { size: 16, fill: 'var(--green)', weight: 700 });
      ST.forEach(p => {
        const [x, y] = POS[p], o = S.st[p];
        const sending = half ? (S.cur && S.cur.src === p) : !!o.up;
        s += R(x - 84, y - 32, 168, 64, { rx: 8, fill: 'var(--panel)', stroke: sending ? 'var(--blue)' : S.flash && S.flash.includes(p) ? 'var(--bad)' : 'var(--line)', sw: 2 });
        s += T(x, y - 6, 'PC ' + p, { size: 20, weight: 700, anchor: 'middle' });
        let st = o.q.length ? 'รอส่ง ' + o.q.length + ' เฟรม' : 'ส่งครบแล้ว';
        if (half && o.backoff > 0 && o.q.length) st = 'Backoff รอ ' + o.backoff + ' slot';
        if (sending) st = 'กำลังส่ง → ' + (half ? S.cur.dst : o.up.dst);
        s += T(x, y + 19, st, { size: 16, anchor: 'middle', fill: sending ? 'var(--blue)' : o.backoff > 0 && half ? 'var(--orange)' : 'var(--muted)', weight: sending ? 700 : 400 });
      });
      s += '</svg>';
      svgBox.innerHTML = s;
      stats.replaceChildren(
        h('div', { class: 'nlfb-stat' }, h('span', null, 'เวลา'), h('b', null, S.t + ' slot')),
        h('div', { class: 'nlfb-stat' }, h('span', null, 'ส่งสำเร็จ'), h('b', null, S.delivered + ' / ' + total())),
        h('div', { class: 'nlfb-stat' }, h('span', null, 'การชน (Collision)'), h('b', { class: S.collisions ? 'nlw-bad' : 'nlw-ok' }, String(S.collisions))),
        h('div', { class: 'nlfb-stat' }, h('span', null, 'สถานะ'), h('b', null, S.done ? 'จบแล้ว' : timer ? 'กำลังเล่น' : S.t ? 'หยุดอยู่' : 'พร้อม')));
      strip.replaceChildren(...S.hist.slice(-48).map(x => x[0] === 'tx' ? h('i', { class: 'nlfb-tx' }, x[1]) : x[0] === 'col' ? h('i', { class: 'nlfb-col' }, 'X') : x[0] === 'multi' ? h('i', { class: 'nlfb-multi' }, x[1]) : h('i', null, '')));
      log.replaceChildren(...(S.log.length ? S.log.map(([c, t]) => h('li', { class: c }, t)) : [h('li', null, 'ยังไม่เริ่ม กด "ก้าวทีละ slot"')]));
      bPlay.textContent = timer ? 'หยุด' : 'เล่น';
      bPlay.setAttribute('aria-pressed', String(!!timer));
      bStep.disabled = S.done;
      const rowOf = (k, label) => { const r = results[k]; return h('tr', null, h('td', null, label), h('td', null, r ? r.t + ' slot' : 'ยังไม่ได้รัน'), h('td', null, r ? String(r.col) : '-')); };
      cmp.replaceChildren(h('table', { class: 'nlfb-cmp' }, h('caption', { class: 'nlw-small', style: 'text-align:left' }, 'ผลรันจนจบของงานชุดเดียวกัน (' + total() + ' เฟรม)'),
        h('thead', null, h('tr', null, h('th', null, 'โหมด'), h('th', null, 'เวลาที่ใช้'), h('th', null, 'ชนกัน'))),
        h('tbody', null, rowOf('half', 'Half-duplex (Hub)'), rowOf('full', 'Full-duplex (Switch)'))));
      legend.textContent = mode === 'half' ? 'แถบเวลา: ตัวอักษร = เครื่องที่กำลังใช้สาย, X = ชนกัน, ช่องว่าง = สายว่าง' : 'แถบเวลา: ตัวเลข = จำนวนลิงก์ (TX หรือ RX) ที่รับส่งพร้อมกันใน slot นั้น';
    }
    makeWork();
    reset();
  });

  /* ======================================================================
     5. crimp-steps: 8 steps, each with a drawing, what to do, and a common mistake view
     ====================================================================== */
  NL_FIG('widget', 'crimp-steps', function (root) {
    fbFrame(root, 'nlfb-crimp', 'ขั้นตอนเข้าหัว RJ-45 แบบ T568B',
      'กด "ถัดไป" และ "ย้อนกลับ" เพื่อดูทีละขั้น ทุกขั้นมีปุ่ม "ดูตัวอย่างที่ผิด" ให้เทียบภาพที่ทำผิดบ่อย ขั้นสุดท้ายกดทดสอบด้วย LAN Tester ได้ ในภาพมองจากด้านบน หน้าสัมผัสหันขึ้น ปลายหัวชี้ไปทางขวา ขา 1 จึงอยู่บนสุด');
    const pre = 'nlfbc' + (++UID);
    const ORDER_PAIRS = ['wo', 'o', 'wg', 'g', 'wb', 'b', 'wbr', 'br'];
    const MM = 4, Y0 = 70, GAP = 14;
    const wy = i => Y0 + i * GAP;
    const STEPS = [
      ['ตัดสายและสวม Boot', 'ตัดสายให้ได้ความยาวที่ต้องการ เผื่อไว้เล็กน้อย แล้วสวม Boot เข้าที่สายทั้งสองปลายก่อน โดยหันด้านใหญ่ไปทางปลายสาย',
        'ลืมสวม Boot แล้วย้ำหัวไปก่อน หัวที่ย้ำแล้วถอดออกไม่ได้และ Boot สวมผ่านหัวไม่ได้ ต้องตัดหัวทิ้งแล้วเริ่มใหม่'],
      ['ปอกเปลือกนอกราว 2–3 ซม.', 'ใช้ช่องปอกของคีมหรือคีมปอกแบบหมุน หมุนรอบสาย 1–2 รอบแล้วดึงเปลือกออก ตัดเชือกไนลอนหรือแกนกากบาท (Spline) ที่โผล่ออกมาทิ้ง',
        'กดใบมีดลึกเกินจนบาดฉนวนของสายเส้นใน แม้ไฟทดสอบจะติด แต่ทองแดงที่โผล่อาจแตะกันหรือหักภายหลัง ให้ตัดช่วงนั้นทิ้งแล้วปอกใหม่'],
      ['คลายเกลียวและรีดสายให้ตรง', 'แยกคู่สายทั้ง 4 คู่ออกจากกัน คลายเกลียวเท่าที่จำเป็น แล้วรีดแต่ละเส้นให้ตรงด้วยนิ้ว เพื่อให้เรียงแบนชิดกันได้',
        'สายยังหยักงอตามรอยเกลียว จะเรียงไม่แบน พอสอดเข้าหัวแล้วสายสลับที่กันหรือบางเส้นไม่ถึงปลายหัว'],
      ['เรียงสีตาม T568B', 'เรียงจากขา 1 ถึงขา 8: ขาวส้ม ส้ม ขาวเขียว น้ำเงิน ขาวน้ำเงิน เขียว ขาวน้ำตาล น้ำตาล สังเกตว่าเส้นเขียวต้องข้ามคู่น้ำเงินไปอยู่ขา 6 บีบสายให้แบนชิดกัน',
        'เรียงคู่ติดกันเป็นกลุ่ม (ขาวเขียว เขียว ขาวน้ำเงิน น้ำเงิน) ถ้าทำแบบนี้ทั้งสองปลาย LAN Tester ไฟติดตรงกันครบ แต่คู่สายถูกแยก (Split pair) ขา 3 กับ 6 ไม่ใช่คู่บิดเกลียวเดียวกัน ใช้งานจริงช้าหรือหลุดบ่อย'],
      ['ตัดปลายให้เสมอ เหลือราว 12–13 มม.', 'บีบสายที่เรียงแล้วให้แบน ตัดปลายให้ตรงเสมอกันด้วยใบมีดของคีม เหลือส่วนที่คลายเกลียวราว 12–13 มม. (ไม่เกิน 13 มม.)',
        'เหลือสายยาวเกินไป เปลือกนอกจะเข้าไปไม่ถึงตัวกดล็อกในหัว ดึงแล้วหลุด และช่วงที่คลายเกลียวยาวทำให้เกิด Crosstalk'],
      ['สอดสายเข้าหัว หน้าสัมผัสหันขึ้น', 'ถือหัวให้หน้าสัมผัสทองแดงหันขึ้นและตัวล็อกคว่ำลง ดันสายจนทุกเส้นชนปลายหัว เปลือกนอกเข้าไปอยู่ใต้ตัวกดล็อก แล้วส่องผ่านหัวใสตรวจลำดับสีอีกครั้ง',
        'ดันสายไม่สุด บางเส้นไม่ถึงปลายหัว (ในภาพคือขาวน้ำตาล ขา 7) หน้าสัมผัสจะไม่แตะทองแดง ไฟทดสอบดวงนั้นไม่ติด หรือถือหัวกลับด้านทำให้สีเรียงกลับทั้งหมด'],
      ['ย้ำด้วยคีมจนสุด', 'ใส่หัวเข้าช่อง 8P ให้สุด บีบคีมจนสุดจนเฟืองล็อกปล่อยเอง หน้าสัมผัสทั้ง 8 ถูกกดลงเจาะฉนวนไปแตะทองแดง และตัวกดล็อกยุบลงยึดเปลือกนอก',
        'บีบไม่สุดหรือใส่หัวไม่สุดช่อง หน้าสัมผัสบางขายังลอยอยู่ ไฟบางดวงติดบ้างไม่ติดบ้าง และตัวกดล็อกไม่ยุบ สายดึงหลุดง่าย'],
      ['สวม Boot และทดสอบด้วย LAN Tester', 'ดัน Boot มาครอบหัว เข้าหัวอีกปลายด้วยวิธีเดียวกัน แล้วเสียบสายที่ตัวแม่และตัวลูก กด "ทดสอบทีละขา" สายตรงที่ดีไฟต้องติดคู่กัน 1-1, 2-2 ไปจนถึง 8-8',
        'ไฟดวงหนึ่งไม่ติดทั้งสองฝั่ง (ในภาพคือขา 7) แปลว่าสายเส้นนั้นขาดหรือไม่ถึงหน้าสัมผัส (Open) ถ้าไฟติดสลับขาแปลว่าเรียงสีผิด ถ้าสองดวงติดพร้อมกันแปลว่าลัดวงจร ต้องตัดหัวทำใหม่']
    ];
    let idx = 0, bad = false, test = -1;

    // ---------- drawing helpers
    function jacket(x1, x2) { return R(x1, Y0 - 12, x2 - x1, 8 * GAP + 13, { rx: 8, fill: 'var(--muted)', fo: 0.5, stroke: 'var(--muted)', sw: 1.5 }) + P(`M${x2} ${Y0 - 12} q 8 ${(8 * GAP + 13) / 2} 0 ${8 * GAP + 13}`, { stroke: 'var(--muted)', sw: 1.5 }); }
    function boot(x, w) { const t = Y0 - 18, bt = Y0 + 8 * GAP + 7; return P(`M${x} ${t + 14} L${x + w} ${t} L${x + w} ${bt} L${x} ${bt - 14} Z`, { fill: 'var(--blue)', fo: 0.3, stroke: 'var(--ink)', sw: 1.4 }); }
    function wires(x, len, order, opt) {
      opt = opt || {};
      let s = '';
      order.forEach((c, i) => {
        const y = wy(i), L2 = opt.short && opt.short[i] ? len - opt.short[i] : len;
        if (opt.wavy) {
          let d = `M${x} ${y}`;
          for (let k = 1; k <= 12; k++) d += ` Q ${n(x + (k - 0.5) * L2 / 12)} ${n(y + (k % 2 ? 4 : -4))} ${n(x + k * L2 / 12)} ${y}`;
          s += P(d, { stroke: WC.edge, sw: 8.4, cap: 'round' }) + P(d, { stroke: wfill(pre, c), sw: 6.6, cap: 'round' });
        } else s += hwire(pre, x, x + L2, y, 10, c);
      });
      return s;
    }
    function twisted(x, len) {
      let s = '';
      [['wo', 'o'], ['wg', 'g'], ['wb', 'b'], ['wbr', 'br']].forEach(([a, c], k) => {
        const yc = Y0 + 5 + k * 2 * GAP, pitch = 22 + k * 4;
        function pts(ph) { const p = []; for (let xx = x; xx <= x + len; xx += 2) p.push([xx, yc + 4.5 * Math.sin(2 * Math.PI * (xx - x) / pitch + ph), Math.cos(2 * Math.PI * (xx - x) / pitch + ph)]); return p; }
        function path(p, front) { let d = '', on = false; p.forEach(q => { const v = front == null || q[2] > 0; if (v) { d += (on ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1]) + ' '; on = true; } else on = false; }); return d; }
        const A = pts(0), B = pts(Math.PI);
        const dB = path(B), dA = path(A), dBf = path(B, true);
        s += P(dB, { stroke: WC.edge, sw: 8.4, cap: 'round' }) + P(dB, { stroke: wfill(pre, a), sw: 6.6, cap: 'round' });
        s += P(dA, { stroke: WC.edge, sw: 8.4, cap: 'round' }) + P(dA, { stroke: WC[c], sw: 6.6, cap: 'round' });
        s += P(dBf, { stroke: WC.edge, sw: 8.4, cap: 'round' }) + P(dBf, { stroke: wfill(pre, a), sw: 6.6, cap: 'round' });
      });
      return s;
    }
    function ruler(x0, mm, y, label, bad2) {
      const col = bad2 ? 'var(--bad)' : 'var(--ink)';
      let s = L(x0, y, x0 + mm * MM, y, { stroke: col, sw: 1.6 });
      for (let k = 0; k <= mm; k++) s += L(x0 + k * MM, y, x0 + k * MM, y - (k % 10 === 0 ? 9 : k % 5 === 0 ? 6 : 3), { stroke: col, sw: 1 });
      return s + T(x0 + mm * MM / 2, y - 14, label, { size: 14, anchor: 'middle', weight: 700, fill: col });
    }
    function pins(x) { let s = ''; for (let i = 0; i < 8; i++) s += T(x, wy(i) + 5, String(i + 1), { size: 13, weight: 700, anchor: 'middle' }); return s; }
    function cross(x, y, r) { return C(x, y, r, { stroke: 'var(--bad)', sw: 3 }); }
    function note(x, y, lines, col, anchor) { return lines.map((l, i) => T(x, y + i * 19, l, { size: 16, weight: i ? 400 : 700, fill: i ? 'var(--ink)' : col || 'var(--ink)', anchor: anchor || 'start' })).join(''); }
    function plug(xTip, opt) {
      opt = opt || {};
      const x0 = xTip - 86, top = Y0 - 16, hgt = 8 * GAP + 21;
      let s = R(x0, top, 86, hgt, { rx: 6, fill: WC.clear, fo: 0.3, stroke: 'var(--ink)', sw: 1.8 });
      for (let i = 0; i < 8; i++) s += R(xTip - 26, wy(i) - 3, 20, 6, { rx: 1, fill: '#D4A62A', stroke: '#8C6A12', sw: 0.8, fo: opt.ghost ? 0.5 : 1 });
      s += P(`M${x0 + 18} ${top + 2} l10 0 l-4 8 l-10 0 z`, { fill: 'var(--ink)', fo: 0.55 });
      return s;
    }
    function ledRow(x, y, title, lit, dead) {
      let s = T(x, y - 30, title, { size: 14, weight: 700 });
      ['1', '2', '3', '4', '5', '6', '7', '8', 'G'].forEach((l, i) => {
        const on = i === lit && !(dead != null && i === dead) && i !== 8;
        s += C(x + 10 + i * 26, y - 8, 8, { fill: on ? 'var(--green)' : 'var(--line)', stroke: on ? 'var(--green)' : 'var(--muted)', sw: 1.2 });
        s += T(x + 10 + i * 26, y + 16, l, { size: 13, anchor: 'middle', weight: i === lit ? 700 : 400 });
      });
      return s;
    }

    function scene() {
      let s = `<svg viewBox="0 0 640 250" xmlns="http://www.w3.org/2000/svg" font-family="inherit"><defs>${stripeDefs(pre)}</defs>`;
      switch (idx) {
        case 0:
          if (!bad) {
            s += jacket(10, 470) + boot(170, 70);
            s += P('M120 44 L232 44', { stroke: 'var(--blue)', sw: 2.5 }) + P('M222 37 L232 44 L222 51', { stroke: 'var(--blue)', sw: 2.5 });
            s += note(120, 30, ['สวม Boot ก่อน'], 'var(--blue)');
            s += note(300, 214, ['ด้านใหญ่ของ Boot หันไปทางปลายสาย', 'ทำทั้งสองปลายก่อนเริ่มปอก']);
          } else {
            s += jacket(10, 300) + wires(300, 52, T568B) + plug(388);
            s += boot(478, 70) + cross(514, 122, 52);
            s += note(20, 214, ['ลืมสวม Boot', 'หัวย้ำแล้ว Boot สวมผ่านหัวไม่ได้ ต้องตัดหัวทิ้ง'], 'var(--bad)');
          }
          break;
        case 1:
          s += jacket(10, 330) + boot(120, 70) + twisted(334, 100);
          s += ruler(330, 25, 44, 'ปอกออก 25 มม.');
          s += R(470, Y0 - 12, 100, 8 * GAP + 13, { rx: 8, fill: 'var(--muted)', fo: 0.2, stroke: 'var(--muted)', sw: 1.5, dash: '5 4' });
          s += T(520, Y0 + 47, 'เปลือกที่ปอกออก', { size: 13, anchor: 'middle', fill: 'var(--muted)' });
          if (bad) {
            s += C(356, wy(3), 6, { fill: WC.cu, stroke: '#8A5426', sw: 1 }) + cross(356, wy(3), 15);
            s += note(20, 214, ['ใบมีดบาดฉนวน ทองแดงโผล่', 'ตัดช่วงนี้ทิ้งแล้วปอกใหม่'], 'var(--bad)');
          } else s += note(20, 214, ['ตรวจทุกเส้นว่าฉนวนไม่ถูกบาด', 'ตัดเชือกไนลอนและแกนกากบาททิ้ง']);
          break;
        case 2:
          s += jacket(10, 330) + boot(120, 70) + wires(334, 100, ORDER_PAIRS, { wavy: bad });
          if (bad) { s += cross(384, 122, 58); s += note(20, 214, ['สายยังหยักงอ', 'เรียงให้แบนชิดกันไม่ได้ ต้องรีดให้ตรงก่อน'], 'var(--bad)'); }
          else s += note(20, 214, ['คลายเกลียวทีละคู่ แล้วรีดให้ตรง', 'ยังไม่ต้องเรียงสี']);
          break;
        case 3: {
          const ord = bad ? ORDER_PAIRS : T568B;
          s += jacket(10, 330) + boot(120, 70) + wires(334, 100, ord) + pins(452);
          s += T(470, wy(0) + 5, 'ขา 1', { size: 13, fill: 'var(--muted)' }) + T(470, wy(7) + 5, 'ขา 8', { size: 13, fill: 'var(--muted)' });
          if (bad) {
            s += R(338, wy(2) - 7, 104, 14, { rx: 4, stroke: 'var(--bad)', sw: 2.5 }) + R(338, wy(5) - 7, 104, 14, { rx: 4, stroke: 'var(--bad)', sw: 2.5 });
            s += note(512, wy(2) + 5, ['ขา 3 กับ 6', 'ไม่ใช่คู่เดียวกัน'], 'var(--bad)');
            s += note(20, 214, ['Split pair', 'ไฟทดสอบติดครบ แต่ใช้งานจริงช้าหรือหลุด'], 'var(--bad)');
          } else {
            s += R(338, wy(5) - 7, 104, 14, { rx: 4, stroke: 'var(--green)', sw: 2.5 });
            s += note(512, wy(5) + 5, ['เขียวอยู่ขา 6', 'ข้ามคู่น้ำเงิน'], 'var(--green)');
            s += note(20, 214, ['T568B: ขาวส้ม ส้ม ขาวเขียว น้ำเงิน', 'ขาวน้ำเงิน เขียว ขาวน้ำตาล น้ำตาล']);
          }
          break;
        }
        case 4: {
          const mm = bad ? 25 : 13;
          s += jacket(10, 330) + boot(120, 70) + wires(334, mm * MM - 4, T568B);
          s += ruler(330, mm, 44, bad ? '25 มม. ยาวเกิน' : '12–13 มม.', bad);
          if (!bad) {
            s += L(334 + mm * MM + 6, Y0 - 16, 334 + mm * MM + 6, wy(7) + 16, { stroke: 'var(--muted)', sw: 1.5, dash: '4 4' });
            s += T(334 + mm * MM + 14, wy(7) + 14, 'ตัดเสมอกัน', { size: 13, fill: 'var(--muted)' });
            s += note(20, 214, ['ปลายทุกเส้นยาวเท่ากัน', 'เปลือกนอกจะเข้าไปถึงตัวกดล็อกในหัว']);
          } else s += note(20, 214, ['ยาวเกินไป', 'เปลือกไม่ถึงตัวกดล็อก และเกิด Crosstalk'], 'var(--bad)');
          break;
        }
        case 5: {
          const tip = 420;
          s += jacket(10, 366) + boot(150, 70) + wires(366, 50, T568B, { short: bad ? { 6: 22 } : null }) + plug(tip) + pins(tip + 14);
          s += T(tip + 28, wy(0) + 5, 'ขา 1', { size: 13, fill: 'var(--muted)' }) + T(tip + 28, wy(7) + 5, 'ขา 8', { size: 13, fill: 'var(--muted)' });
          s += L(352, Y0 - 16, 352, Y0 - 34, { stroke: 'var(--ink)', sw: 1 }) + T(362, Y0 - 40, 'ตัวกดล็อกเปลือก', { size: 13, anchor: 'end' });
          s += L(tip - 16, Y0 - 16, tip - 16, Y0 - 34, { stroke: 'var(--ink)', sw: 1 }) + T(tip - 22, Y0 - 40, 'หน้าสัมผัส (ด้านบน)', { size: 13, anchor: 'start' });
          if (bad) { s += cross(tip - 34, wy(6), 14); s += note(20, 214, ['ขาวน้ำตาลไม่ถึงปลายหัว', 'หน้าสัมผัสขา 7 จะไม่แตะทองแดง'], 'var(--bad)'); }
          else s += note(20, 214, ['ทุกเส้นชนปลายหัว ตัวล็อกคว่ำลงด้านล่าง', 'ส่องผ่านหัวใสตรวจสีอีกครั้งก่อนย้ำ']);
          break;
        }
        case 6: {
          // end view of the contacts + side view of strain relief
          const ex = 60, ey = 120;
          s += T(ex + 100, 36, 'มองจากปลายหัว', { size: 14, weight: 700, anchor: 'middle' });
          s += R(ex, ey - 30, 200, 70, { rx: 8, fill: WC.clear, fo: 0.3, stroke: 'var(--ink)', sw: 1.8 });
          const up = bad ? [0, 0, 9, 0, 12, 0, 0, 7] : [0, 0, 0, 0, 0, 0, 0, 0];
          for (let i = 0; i < 8; i++) {
            const cx2 = ex + 24 + i * 21.7;
            s += R(cx2 - 4, ey - 26 - up[i], 8, 22, { rx: 1, fill: '#D4A62A', stroke: '#8C6A12', sw: 0.8 });
            s += C(cx2, ey + 14, 6, { fill: wfill(pre, T568B[i]), stroke: WC.edge, sw: 0.8 }) + C(cx2, ey + 14, 2.5, { fill: WC.cu });
            if (up[i]) s += cross(cx2, ey - 18 - up[i], 11);
          }
          s += P(`M${ex + 100} ${ey - 78} L${ex + 100} ${ey - 46}`, { stroke: 'var(--blue)', sw: 3 }) + P(`M${ex + 92} ${ey - 56} L${ex + 100} ${ey - 44} L${ex + 108} ${ey - 56}`, { stroke: 'var(--blue)', sw: 3 });
          s += T(ex + 118, ey - 62, 'แรงกดจากคีม', { size: 13, fill: 'var(--blue)' });
          // side view strain relief
          const sx = 360, sy = 96;
          s += T(sx + 110, 36, 'มองด้านข้าง', { size: 14, weight: 700, anchor: 'middle' });
          s += R(sx, sy, 180, 56, { rx: 6, fill: WC.clear, fo: 0.3, stroke: 'var(--ink)', sw: 1.8 });
          s += R(sx + 90 + (bad ? 30 : 0), sy + 14, 130 - (bad ? 30 : 0), 28, { rx: 5, fill: 'var(--muted)', fo: 0.6, stroke: 'var(--muted)', sw: 1 });
          s += P(bad ? `M${sx + 100} ${sy + 2} l18 0 l-6 10 l-18 0 z` : `M${sx + 100} ${sy + 2} l18 0 l-6 18 l-18 0 z`, { fill: 'var(--ink)', fo: 0.6 });
          if (bad) s += cross(sx + 104, sy + 12, 14);
          s += T(sx + 110, sy + 80, bad ? 'ตัวกดล็อกไม่ยุบ เปลือกไม่ถึง' : 'ตัวกดล็อกยุบลงกดเปลือกนอก', { size: 13.5, anchor: 'middle', fill: bad ? 'var(--bad)' : 'var(--ink)', weight: 600 });
          s += note(20, 214, bad ? ['บีบไม่สุด', 'หน้าสัมผัสบางขาลอย ไม่แตะทองแดง'] : ['หน้าสัมผัสทั้ง 8 ลงระดับเดียวกัน', 'เจาะฉนวนลงไปแตะทองแดงทุกเส้น'], bad ? 'var(--bad)' : null);
          break;
        }
        case 7: {
          s += jacket(10, 70) + wires(120, 84, T568B) + boot(64, 64) + plug(210);
          s += T(140, 214, 'Boot ครอบหัวแล้ว', { size: 13.5, anchor: 'middle' });
          const lit = test < 0 ? -1 : test;
          s += ledRow(300, 92, 'ตัวแม่ (Master)', lit, null);
          s += ledRow(300, 176, 'ตัวลูก (Remote)', lit, bad ? 6 : null);
          if (test >= 0) {
            const okp = test === 8 ? null : !(bad && test === 6);
            const msg = test === 8 ? 'G: ไม่ติดทั้งสองฝั่ง ปกติสำหรับสาย UTP' : okp ? `ขา ${test + 1}: ติดทั้งสองฝั่งตรงกัน` : `ขา ${test + 1}: ตัวลูกไม่ติด สายขาด (Open)`;
            s += T(300, 230, msg, { size: 14, weight: 700, fill: okp === false ? 'var(--bad)' : 'var(--ink)' });
          } else s += T(300, 230, 'กดปุ่ม "ทดสอบทีละขา"', { size: 14, fill: 'var(--muted)' });
          break;
        }
      }
      return s + '</svg>';
    }
    const head = h('div', { class: 'nlfb-h', 'aria-live': 'polite' });
    const pic = h('div', { class: 'nlfb-svg' });
    const doP = h('p');
    const mist = h('div', { class: 'nlfb-mist' });
    const bBad = h('button', { type: 'button', class: 'nlw-btn', 'aria-pressed': 'false', onclick: () => { bad = !bad; render(); } }, 'ดูตัวอย่างที่ผิด');
    const bTest = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: () => { test = (test + 1) % 9; render(); } }, 'ทดสอบทีละขา');
    const bPrev = h('button', { type: 'button', class: 'nlw-btn', onclick: () => go(idx - 1) }, 'ย้อนกลับ');
    const bNext = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: () => go(idx + 1) }, 'ถัดไป');
    const dots = h('div', { class: 'nlfb-dots', role: 'group', 'aria-label': 'เลือกขั้นตอน' });
    const dotBtns = STEPS.map((st, i) => { const b = h('button', { type: 'button', class: 'nlw-btn', 'aria-label': `ขั้นที่ ${i + 1} ${st[0]}`, onclick: () => go(i) }, String(i + 1)); dots.appendChild(b); return b; });
    function go(i) { if (i < 0 || i >= STEPS.length) return; idx = i; bad = false; test = -1; render(); }
    function render() {
      const st = STEPS[idx];
      head.textContent = `ขั้นที่ ${idx + 1} จาก ${STEPS.length}: ${st[0]}`;
      pic.innerHTML = scene();
      const svgEl = pic.querySelector('svg');
      svgEl.setAttribute('role', 'img');
      svgEl.setAttribute('aria-label', (bad ? 'ภาพตัวอย่างที่ผิด: ' + st[2] : 'ภาพขั้นที่ ' + (idx + 1) + ': ' + st[1]));
      doP.replaceChildren(h('b', null, 'ทำอย่างไร: '), st[1]);
      mist.className = 'nlfb-mist' + (bad ? ' nlfb-on' : '');
      mist.replaceChildren(h('p', null, h('b', null, 'ข้อผิดพลาดที่พบบ่อย: '), st[2]), h('div', { class: 'nlw-row' }, bBad, idx === 7 ? bTest : null));
      bBad.setAttribute('aria-pressed', String(bad));
      bBad.textContent = bad ? 'กลับไปดูภาพที่ถูกต้อง' : 'ดูตัวอย่างที่ผิด';
      bPrev.disabled = idx === 0; bNext.disabled = idx === STEPS.length - 1;
      dotBtns.forEach((b, i) => { if (i === idx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    }
    root.appendChild(dots);
    root.appendChild(head);
    root.appendChild(pic);
    root.appendChild(doP);
    root.appendChild(mist);
    root.appendChild(h('div', { class: 'nlw-row' }, bPrev, bNext));
    render();
  });

  /* ======================================================================
     6. ap-placement: floor plan, place 1-2 APs, simplified path-loss + wall-loss heatmap
     ====================================================================== */
  NL_FIG('widget', 'ap-placement', function (root) {
    fbFrame(root, 'nlfb-apw', 'ลองวาง Access Point ในอาคารเรียน',
      'คลิกหรือแตะบนแผนผังเพื่อย้าย AP ที่เลือกอยู่ หรือกด Tab ไปที่ AP แล้วใช้ปุ่มลูกศรเลื่อน (กด Shift ค้างเพื่อเลื่อนทีละ 2 เมตร) เปิด AP ตัวที่ 2 ได้ แล้วดูสีความแรงสัญญาณ จุดอับ และคำแนะนำด้านล่าง');
    const W = 32, H = 16, S = 20, CELL = 0.5;
    // walls: [x1,y1,x2,y2,lossDb at 2.4 GHz, kind]
    const WALLS = [];
    const wall = (x1, y1, x2, y2, loss, kind) => WALLS.push([x1, y1, x2, y2, loss, kind]);
    [[0, 4], [5.2, 14], [15.2, 25], [26.2, 32]].forEach(([a, z]) => wall(a, 7, z, 7, 6, 'brick'));
    [[0, 3], [4.2, 8], [14, 18], [19.2, 24], [24, 27], [28.2, 32]].forEach(([a, z]) => wall(a, 9, z, 9, 6, 'brick'));
    wall(8, 9, 10.4, 9, 13, 'concrete'); wall(11.6, 9, 14, 9, 13, 'concrete');
    wall(10, 0, 10, 7, 6, 'brick'); wall(20, 0, 20, 7, 6, 'brick');
    wall(8, 9, 8, 16, 13, 'concrete'); wall(14, 9, 14, 16, 13, 'concrete'); wall(24, 9, 24, 16, 6, 'brick');
    // steel lockers in the teachers' room (free standing)
    const MET = [22, 3.4, 27, 4.2];
    wall(MET[0], MET[1], MET[2], MET[1], 20, 'metal'); wall(MET[0], MET[3], MET[2], MET[3], 20, 'metal');
    wall(MET[0], MET[1], MET[0], MET[3], 20, 'metal'); wall(MET[2], MET[1], MET[2], MET[3], 20, 'metal');
    const MW = [30.6, 14.6];
    const ROOMS = [
      ['ห้องเรียน 1', 0, 0, 10, 7], ['ห้องแล็บคอม', 10, 0, 20, 7], ['ห้องพักครู', 20, 0, 32, 7], ['ทางเดิน', 0, 7, 32, 9],
      ['ห้องเรียน 2', 0, 9, 8, 16], ['บันได/ห้องน้ำ', 8, 9, 14, 16], ['ห้องเรียน 3', 14, 9, 24, 16], ['โรงอาหาร', 24, 9, 32, 16]
    ];
    let aps = [{ x: 1, y: 1 }, { x: 24, y: 8 }], two = false, sel = 0, band = '2.4', mount = 'high', mwOn = true, focusAp = -1;
    function segX(ax, ay, bx, by, cx, cy, dx, dy) {
      const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
      if (Math.abs(d) < 1e-9) return false;
      const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
      return t > 0 && t < 1 && u >= 0 && u <= 1;
    }
    function rssi(ap, x, y) {
      const hAp = mount === 'high' ? 2.7 : 0.8, d2 = Math.hypot(x - ap.x, y - ap.y), d = Math.max(1, Math.hypot(d2, hAp - 1.0));
      const pl0 = band === '2.4' ? 40 : 46.4, wf = band === '2.4' ? 1 : 1.6;
      let loss = pl0 + 30 * Math.log10(d);
      for (const w of WALLS) if (segX(ap.x, ap.y, x, y, w[0], w[1], w[2], w[3])) loss += w[4] * wf;
      if (mount === 'low' && d2 > 3) loss += 6; // people, desks and cabinets block a low AP
      return 20 - loss;
    }
    function level(v, x, y) {
      let l = v >= -67 ? 0 : v >= -75 ? 1 : v >= -82 ? 2 : 3;
      if (band === '2.4' && mwOn && Math.hypot(x - MW[0], y - MW[1]) < 4 && l < 3) l++;
      return l;
    }
    const LV = [['ดีมาก (≥ −67 dBm)', 'var(--green)', 0.7], ['ใช้งานได้ (−67 ถึง −75)', 'var(--green)', 0.32], ['อ่อน (−75 ถึง −82)', 'var(--orange)', 0.5], ['จุดอับ (< −82)', 'var(--bad)', 0.6]];
    function compute() {
      const cells = [], cnt = [0, 0, 0, 0], perRoom = ROOMS.map(() => [0, 0, 0, 0]);
      const act = two ? aps : [aps[0]];
      for (let y = CELL / 2; y < H; y += CELL) for (let x = CELL / 2; x < W; x += CELL) {
        const v = Math.max(...act.map(a => rssi(a, x, y))), l = level(v, x, y);
        cells.push([x, y, l]); cnt[l]++;
        const ri = ROOMS.findIndex(r => x >= r[1] && x < r[3] && y >= r[2] && y < r[4]);
        if (ri >= 0) perRoom[ri][l]++;
      }
      return { cells, cnt, perRoom };
    }
    const planBox = h('div', { class: 'nlfb-svg' });
    const out = h('div', { 'aria-live': 'polite' });
    const tips = h('ul', { class: 'nlfb-log' });
    const selSeg = fbSeg([['0', 'ย้าย AP 1'], ['1', 'ย้าย AP 2']], '0', v => { sel = +v; render(); }, 'เลือก AP ที่จะย้าย');
    const chkTwo = h('input', { type: 'checkbox', onchange: () => { two = chkTwo.checked; if (!two) { sel = 0; selSeg.set('0'); } render(); } });
    const bandSeg = fbSeg([['2.4', '2.4 GHz'], ['5', '5 GHz']], band, v => { band = v; render(); }, 'ย่านความถี่');
    const mountSeg = fbSeg([['high', 'ติดสูงใกล้เพดาน'], ['low', 'วางต่ำบนโต๊ะ/ตู้']], mount, v => { mount = v; render(); }, 'ความสูงที่ติดตั้ง');
    const chkMw = h('input', { type: 'checkbox', checked: true, onchange: () => { mwOn = chkMw.checked; render(); } });
    const presets = h('div', { class: 'nlw-row nlw-center' }, h('span', { class: 'nlw-small' }, 'ตัวอย่าง:'),
      h('button', { type: 'button', class: 'nlw-btn', onclick: () => preset([{ x: 1, y: 1 }], false) }, 'มุมอาคาร'),
      h('button', { type: 'button', class: 'nlw-btn', onclick: () => preset([{ x: 16, y: 8 }], false) }, 'กลางอาคาร'),
      h('button', { type: 'button', class: 'nlw-btn', onclick: () => preset([{ x: 8, y: 8 }, { x: 24, y: 8 }], true) }, '2 ตัว แบ่งครึ่งอาคาร'));
    function preset(list, t2) { aps[0] = Object.assign({}, list[0]); if (list[1]) aps[1] = Object.assign({}, list[1]); two = t2; chkTwo.checked = t2; sel = 0; selSeg.set('0'); render(); }
    root.appendChild(h('div', { class: 'nlfb-row' }, bandSeg.el, mountSeg.el));
    root.appendChild(h('div', { class: 'nlfb-row' }, h('label', { class: 'nlw-check' }, chkTwo, 'ใช้ AP ตัวที่ 2'), selSeg.el, h('label', { class: 'nlw-check' }, chkMw, 'ไมโครเวฟในโรงอาหารกำลังทำงาน')));
    root.appendChild(presets);
    root.appendChild(planBox);
    root.appendChild(h('div', { class: 'nlfb-legend' }, LV.map(l => h('span', null, h('i', { style: `background:color-mix(in srgb,${l[1]} ${Math.round(l[2] * 100)}%,var(--field))` }), l[0]))));
    root.appendChild(out);
    root.appendChild(tips);
    root.appendChild(h('div', { class: 'nlw-box' },
      h('p', null, h('b', null, 'หลักการวาง AP: '), 'วางใกล้จุดศูนย์กลางของพื้นที่ที่ต้องการใช้งาน ติดสูงใกล้เพดานให้พ้นคน โต๊ะ และตู้ หลีกเลี่ยงตู้เหล็ก ผนังคอนกรีตหนา และไมโครเวฟ (ไมโครเวฟทำงานที่ราว 2.45 GHz รบกวนย่าน 2.4 GHz) อาคารใหญ่ใช้ AP หลายตัวให้พื้นที่ซ้อนกันเล็กน้อย'),
      h('p', { class: 'nlw-small' }, 'แบบจำลองอย่างง่ายเพื่อการเรียนรู้: กำลังส่ง 20 dBm, Path loss = ค่าที่ 1 เมตร (40 dB ที่ 2.4 GHz, 46 dB ที่ 5 GHz) + 30·log10(ระยะ) บวกค่าลดทอนของผนังที่สัญญาณผ่าน (อิฐ 6 dB, คอนกรีต 13 dB, ตู้เหล็ก 20 dB, ที่ 5 GHz คูณ 1.6) ค่าจริงต่างไปตามวัสดุและอุปกรณ์ งานจริงต้องสำรวจหน้างาน (Site survey) ด้วยเครื่องมือวัด')));

    function render() {
      const r = compute();
      let s = `<svg viewBox="0 0 ${W * S} ${H * S}" xmlns="http://www.w3.org/2000/svg" font-family="inherit" class="nlfb-plan" role="group" aria-label="แผนผังอาคารเรียนพร้อมสีความแรงสัญญาณ Wi-Fi โดยประมาณ">`;
      s += '<g shape-rendering="crispEdges">';
      for (const [x, y, l] of r.cells) s += R((x - CELL / 2) * S, (y - CELL / 2) * S, CELL * S, CELL * S, { fill: LV[l][1], fo: LV[l][2] });
      s += '</g>';
      if (band === '2.4' && mwOn) s += C(MW[0] * S, MW[1] * S, 4 * S, { stroke: 'var(--bad)', sw: 2, dash: '6 5' });
      ROOMS.forEach(rm => { s += T((rm[0] === 'ทางเดิน' ? 2.6 : (rm[1] + rm[3]) / 2) * S, (rm[0] === 'ทางเดิน' ? 8.35 : rm[2] + 1.1) * S, rm[0], { size: 17, weight: 700, anchor: 'middle' }); });
      s += R(1, 1, W * S - 2, H * S - 2, { stroke: 'var(--ink)', sw: 3 });
      for (const w of WALLS) if (w[5] !== 'metal') s += L(w[0] * S, w[1] * S, w[2] * S, w[3] * S, { stroke: 'var(--ink)', sw: w[5] === 'concrete' ? 5 : 2.5, cap: 'butt' });
      s += R(MET[0] * S, MET[1] * S, (MET[2] - MET[0]) * S, (MET[3] - MET[1]) * S, { fill: 'var(--muted)', stroke: 'var(--ink)', sw: 1.5 });
      s += T((MET[0] + MET[2]) / 2 * S, MET[1] * S - 6, 'ตู้เหล็ก', { size: 13, anchor: 'middle', weight: 600 });
      s += R(MW[0] * S - 14, MW[1] * S - 10, 28, 20, { rx: 3, fill: 'var(--panel)', stroke: 'var(--ink)', sw: 1.5 }) + R(MW[0] * S - 10, MW[1] * S - 6, 14, 12, { fill: 'var(--muted)', fo: 0.6 });
      s += T(MW[0] * S - 20, MW[1] * S + 5, 'ไมโครเวฟ', { size: 13, anchor: 'end', weight: 600 });
      (two ? [0, 1] : [0]).forEach(i => {
        const a = aps[i];
        s += `<g class="nlfb-ap" data-ap="${i}" tabindex="0" role="button" aria-label="AP ${i + 1} ที่ตำแหน่ง x ${a.x} เมตร y ${a.y} เมตร ใช้ปุ่มลูกศรเพื่อเลื่อน">`;
        s += C(a.x * S, a.y * S, 22, { fill: 'var(--panel)', fo: 0.01 });
        s += C(a.x * S, a.y * S, 13, { fill: 'var(--blue)', stroke: 'var(--panel)', sw: 2 }) + `<circle class="nlfb-ring" cx="${a.x * S}" cy="${a.y * S}" r="17" fill="none" stroke="${sel === i ? 'var(--ink)' : 'none'}" stroke-width="2" stroke-dasharray="${sel === i ? '4 3' : '0'}"/>`;
        s += T(a.x * S, a.y * S + 5, String(i + 1), { size: 14, weight: 700, anchor: 'middle', fill: 'var(--on-accent)' });
        s += '</g>';
      });
      s += '</svg>';
      planBox.innerHTML = s;
      const svgEl = planBox.querySelector('svg');
      svgEl.addEventListener('click', e => {
        const g = e.target.closest && e.target.closest('.nlfb-ap');
        if (g) { sel = +g.getAttribute('data-ap'); selSeg.set(String(sel)); focusAp = sel; render(); return; }
        const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const m = svgEl.getScreenCTM(); if (!m) return;
        const p = pt.matrixTransform(m.inverse());
        aps[sel] = { x: clampX(Math.round(p.x / S * 2) / 2), y: clampY(Math.round(p.y / S * 2) / 2) };
        focusAp = -1; render();
      });
      svgEl.querySelectorAll('.nlfb-ap').forEach(g => g.addEventListener('keydown', e => {
        const i = +g.getAttribute('data-ap'), st = e.shiftKey ? 2 : 0.5;
        const mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
        if (!mv) return;
        e.preventDefault();
        sel = i; selSeg.set(String(i));
        aps[i] = { x: clampX(aps[i].x + mv[0]), y: clampY(aps[i].y + mv[1]) };
        focusAp = i; render();
      }));
      if (focusAp >= 0) { const g = svgEl.querySelector(`.nlfb-ap[data-ap="${focusAp}"]`); if (g) g.focus(); }
      // summary
      const tot = r.cnt.reduce((a, b) => a + b, 0), pc = k => Math.round(r.cnt[k] * 100 / tot);
      const deadRooms = ROOMS.map((rm, i) => [rm[0], r.perRoom[i]]).filter(([, c]) => { const t = c.reduce((a, b) => a + b, 0); return c[3] / t > 0.05; }).map(x => x[0]);
      const weakRooms = ROOMS.map((rm, i) => [rm[0], r.perRoom[i]]).filter(([nm, c]) => { const t = c.reduce((a, b) => a + b, 0); return !deadRooms.includes(nm) && c[2] / t > 0.25; }).map(x => x[0]);
      out.replaceChildren(
        h('div', { class: 'nlfb-stats' },
          h('div', { class: 'nlfb-stat' }, h('span', null, 'ดีมาก + ใช้งานได้'), h('b', { class: pc(0) + pc(1) >= 85 ? 'nlw-ok' : 'nlw-warn' }, (pc(0) + pc(1)) + '%')),
          h('div', { class: 'nlfb-stat' }, h('span', null, 'สัญญาณอ่อน'), h('b', null, pc(2) + '%')),
          h('div', { class: 'nlfb-stat' }, h('span', null, 'จุดอับ'), h('b', { class: pc(3) ? 'nlw-bad' : 'nlw-ok' }, pc(3) + '%'))),
        h('p', null, deadRooms.length ? h('span', null, h('b', { class: 'nlw-bad' }, 'มีจุดอับใน: '), deadRooms.join(', ')) : h('b', { class: 'nlw-ok' }, 'ไม่มีห้องที่มีจุดอับเกิน 5%'),
          weakRooms.length ? h('span', null, ' · ', h('b', null, 'สัญญาณอ่อน: '), weakRooms.join(', ')) : null));
      const t = [];
      const act = two ? aps : [aps[0]];
      act.forEach((a, i) => {
        const nm = 'AP ' + (i + 1);
        if (a.x < 2 || a.x > W - 2 || a.y < 1.5 || a.y > H - 1.5) t.push(['nlfb-e', nm + ' ชิดผนังด้านนอก สัญญาณราวครึ่งหนึ่งออกไปนอกอาคาร ควรขยับเข้าใกล้กลางพื้นที่ใช้งาน']);
        if (a.x > MET[0] - 2 && a.x < MET[2] + 2 && a.y > MET[1] - 2 && a.y < MET[3] + 2) t.push(['nlfb-e', nm + ' อยู่ใกล้ตู้เหล็ก โลหะสะท้อนและบังสัญญาณ ด้านหลังตู้จะเป็นเงาอับ']);
        if (band === '2.4' && mwOn && Math.hypot(a.x - MW[0], a.y - MW[1]) < 6) t.push(['nlfb-e', nm + ' อยู่ใกล้ไมโครเวฟ เมื่อไมโครเวฟทำงานจะรบกวนย่าน 2.4 GHz']);
      });
      if (two && Math.hypot(aps[0].x - aps[1].x, aps[0].y - aps[1].y) < 8) t.push(['nlfb-e', 'AP สองตัวอยู่ใกล้กันเกินไป พื้นที่ซ้อนกันมากแต่ปลายอาคารยังอับ ควรแยกให้แต่ละตัวดูแลคนละครึ่ง']);
      if (mount === 'low') t.push(['nlfb-i', 'AP ที่วางต่ำถูกคน โต๊ะ และตู้บัง (แบบจำลองนี้หักเพิ่ม 6 dB) ควรติดสูงใกล้เพดาน']);
      if (band === '5') t.push(['nlfb-i', '5 GHz เร็วกว่าแต่ผ่านผนังได้น้อยกว่า อาคารนี้มักต้องใช้ AP มากกว่า 1 ตัว']);
      if (band === '2.4' && mwOn) t.push(['nlfb-i', 'ไมโครเวฟเปิดอยู่: พื้นที่รอบไมโครเวฟราว 4 เมตรลดระดับลงหนึ่งขั้น ลองปิดเพื่อเทียบ หรือเปลี่ยนเป็น 5 GHz']);
      if (!t.length || (pc(0) + pc(1) >= 90 && !pc(3))) t.unshift(['nlfb-o', 'ตำแหน่งนี้ครอบคลุมดี ลองเปลี่ยนเป็น 5 GHz หรือวางต่ำ แล้วดูว่าต้องปรับอย่างไร']);
      tips.replaceChildren(...t.map(([c, x]) => h('li', { class: c }, x)));
      selSeg.el.hidden = !two;
    }
    const clampX = v => Math.min(W - 0.5, Math.max(0.5, v)), clampY = v => Math.min(H - 0.5, Math.max(0.5, v));
    render();
  });

  /* ======================================================================
     8. wifi-interference: choose channels for 3 neighbouring APs on 2.4 GHz
     ====================================================================== */
  NL_FIG('widget', 'wifi-interference', function (root) {
    fbFrame(root, 'nlfb-wint', 'เลือกช่องสัญญาณ 2.4 GHz ให้ AP ที่อยู่ติดกัน',
      'AP สามตัวติดตั้งในห้อง 101, 102 และ 103 ที่อยู่ติดกันและได้ยินสัญญาณกันทั้งหมด เลือกช่อง (Channel) ให้แต่ละตัว หรือกดตัวอย่าง แล้วดูกราฟคลื่นความถี่และความเร็วที่เหลือโดยประมาณ');
    const COLS = ['var(--blue)', 'var(--green)', 'var(--orange)'];
    let ch = [1, 3, 6];
    const f = c => 2407 + 5 * c;
    // relative capacity penalty for an overlapping (adjacent) channel, by channel distance
    const ACI = { 1: 0.8, 2: 0.6, 3: 0.35, 4: 0.08 };
    function evaluate() {
      return ch.map((c, i) => {
        let co = 0, aci = 0; const why = [];
        ch.forEach((d, j) => {
          if (i === j) return;
          const dd = Math.abs(c - d);
          if (dd === 0) { co++; why.push(`ช่องเดียวกับ AP${j + 1}: ได้ยินกันและผลัดกันส่ง (แบ่งเวลา)`); }
          else if (ACI[dd]) { aci += ACI[dd]; why.push(dd <= 3 ? `เหลื่อมกับ AP${j + 1} (ห่าง ${dd} ช่อง): ถอดรหัสกันไม่ได้ กลายเป็นสัญญาณรบกวน` : `ห่าง AP${j + 1} 4 ช่อง: ขอบช่องชิดกัน รั่วเล็กน้อย`); }
        });
        const cap = Math.round(100 * (1 / (co + 1)) * Math.max(0.1, 1 - aci));
        return { cap, why };
      });
    }
    const x0 = 30, sc = 590 / 85, base = 210, hgt = 140;
    const fx = mhz => x0 + (mhz - 2400) * sc;
    function spectrum(c, i) {
      const fc = f(c), lvl = hgt - i * 8;
      const pts = [[-30, -40], [-20, -28], [-11, -20], [-9, 0], [9, 0], [11, -20], [20, -28], [30, -40]].map(([o, db]) => [Math.min(620, Math.max(x0, fx(fc + o))), base - lvl * (1 + db / 40)]);
      const d = 'M' + pts.map(p => n(p[0]) + ' ' + n(p[1])).join(' L') + ` L${n(pts[7][0])} ${base} L${n(pts[0][0])} ${base} Z`;
      let s = P(d, { fill: COLS[i], fo: 0.1, stroke: COLS[i], sw: 1, dash: '4 3' });
      s += R(fx(fc - 10), base - lvl, 20 * sc, lvl, { fill: COLS[i], fo: 0.28, stroke: COLS[i], sw: 2 });
      const rank = ch.slice(0, i).filter(d => d === c).length;
      const bx = fx(fc) + rank * 24;
      s += C(bx, base - lvl - 15, 12, { fill: COLS[i] }) + T(bx, base - lvl - 9, String(i + 1), { size: 16, anchor: 'middle', weight: 700, fill: 'var(--on-accent)' });
      return s;
    }
    function draw() {
      let s = `<svg viewBox="0 0 640 262" xmlns="http://www.w3.org/2000/svg" font-family="inherit">`;
      // overlap of main 20 MHz blocks
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
        const dd = Math.abs(ch[i] - ch[j]);
        if (dd >= 1 && dd <= 3) {
          const lo = Math.max(f(ch[i]), f(ch[j])) - 10, hi = Math.min(f(ch[i]), f(ch[j])) + 10;
          s += R(fx(lo), 48, (hi - lo) * sc, base - 48, { fill: 'var(--bad)', fo: 0.14 });
          s += T(fx((lo + hi) / 2), 44, 'เหลื่อม', { size: 15, anchor: 'middle', fill: 'var(--bad)', weight: 700 });
        }
      }
      ch.forEach((c, i) => { s += spectrum(c, i); });
      ch.forEach((c, i) => { s += C(x0 + 8 + i * 196, 16, 7, { fill: COLS[i] }) + T(x0 + 20 + i * 196, 22, `AP${i + 1}: ช่อง ${c} (${f(c)} MHz)`, { size: 15, weight: 600 }); });
      s += L(x0, base, 620, base, { stroke: 'var(--ink)', sw: 1.5 });
      for (let c = 1; c <= 13; c++) {
        const x = fx(f(c)), key = c === 1 || c === 6 || c === 11;
        s += L(x, base, x, base + 6, { stroke: 'var(--ink)', sw: 1.2 });
        s += T(x, base + 24, String(c), { size: 16, anchor: 'middle', weight: key ? 700 : 400, fill: key ? 'var(--ink)' : 'var(--muted)' });
      }
      s += T(x0, base + 44, 'ช่อง (Channel) · ห่างกันช่องละ 5 MHz · ช่องกว้าง 20 MHz', { size: 13, fill: 'var(--muted)' });
      s += T(620, base + 44, '2412–2472 MHz', { size: 13, fill: 'var(--muted)', anchor: 'end' });
      s += '</svg>';
      return s;
    }
    const sels = ch.map((c, i) => {
      const sl = h('select', { 'aria-label': `ช่องของ AP${i + 1}`, onchange: () => { ch[i] = +sl.value; render(); } });
      for (let k = 1; k <= 13; k++) sl.appendChild(h('option', { value: String(k), selected: k === c }, 'ช่อง ' + k));
      return sl;
    });
    const pic = h('div', { class: 'nlfb-svg' });
    const bars = h('div', { class: 'nlfb-bars', 'aria-live': 'polite' });
    const verdict = h('div', { class: 'nlw-result' });
    const reasons = h('ul', { class: 'nlfb-log' });
    const preset = (arr, label) => h('button', { type: 'button', class: 'nlw-btn', onclick: () => { ch = arr.slice(); sels.forEach((s, i) => { s.value = String(ch[i]); }); render(); } }, label);
    const five = h('div', { hidden: true });
    const bFive = h('button', { type: 'button', class: 'nlw-btn', 'aria-expanded': 'false', onclick: () => { five.hidden = !five.hidden; bFive.setAttribute('aria-expanded', String(!five.hidden)); bFive.textContent = five.hidden ? 'เทียบกับย่าน 5 GHz' : 'ซ่อนย่าน 5 GHz'; } }, 'เทียบกับย่าน 5 GHz');
    root.appendChild(h('div', { class: 'nlfb-row' }, sels.map((s, i) => h('label', { class: 'nlw-field' }, h('span', { style: `color:${COLS[i]}` }, `AP${i + 1} ห้อง 10${i + 1}`), s))));
    root.appendChild(h('div', { class: 'nlw-row nlw-center' }, h('span', { class: 'nlw-small' }, 'ตัวอย่าง:'), preset([1, 6, 11], '1 / 6 / 11'), preset([1, 3, 6], '1 / 3 / 6'), preset([6, 6, 6], '6 / 6 / 6'), preset([1, 5, 9], '1 / 5 / 9'), preset([1, 6, 6], '1 / 6 / 6')));
    root.appendChild(pic);
    root.appendChild(h('p', { class: 'nlw-small' }, 'แท่งทึบคือช่อง 20 MHz ส่วนเส้นประจางคือพลังงานที่รั่วนอกช่องตาม Spectral mask ซึ่งต่ำกว่าตัวช่อง 20 dB ขึ้นไป'));
    root.appendChild(verdict);
    root.appendChild(bars);
    root.appendChild(reasons);
    root.appendChild(h('div', { class: 'nlw-box' },
      h('p', null, h('b', null, 'ทำไมต้อง 1, 6, 11: '), 'ช่อง 2.4 GHz อยู่ห่างกันเพียง 5 MHz แต่สัญญาณกว้าง 20 MHz (802.11b เดิมกว้าง 22 MHz) ช่องติดกันจึงทับกัน ต้องห่างกันอย่างน้อย 5 ช่องจึงไม่ทับ ช่อง 1, 6, 11 จึงเป็นชุดที่ไม่ทับกันและใช้ได้ทุกประเทศ (สหรัฐฯ ใช้ได้ถึงช่อง 11 ส่วนหลายประเทศรวมถึงไทยใช้ได้ถึง 13)'),
      h('p', null, h('b', null, 'ช่องเดียวกันดีกว่าช่องเหลื่อม: '), 'AP ช่องเดียวกันได้ยินกันและผลัดกันส่งตาม CSMA/CA (แบ่งเวลา) แต่ AP ช่องที่เหลื่อมกันอ่านสัญญาณของอีกฝ่ายไม่ออก จึงไม่รอกัน สัญญาณกลายเป็นสัญญาณรบกวน ข้อมูลเสียต้องส่งซ้ำ'),
      h('p', { class: 'nlw-small' }, 'ตัวเลขความเร็วที่เหลือเป็นค่าประมาณจากแบบจำลองอย่างง่ายเพื่อเปรียบเทียบเท่านั้น'),
      bFive, five));
    // 5 GHz overview
    (function () {
      const groups = [['UNII-1', [36, 40, 44, 48], false], ['UNII-2 (DFS)', [52, 56, 60, 64], true], ['UNII-2e (DFS)', [100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144], true], ['UNII-3', [149, 153, 157, 161, 165], false]];
      let s = `<svg viewBox="0 0 640 150" xmlns="http://www.w3.org/2000/svg" font-family="inherit" role="img" aria-label="ช่อง 20 MHz ในย่าน 5 GHz เรียงต่อกันไม่ทับกัน 25 ช่อง ได้แก่ 36 ถึง 64, 100 ถึง 144 และ 149 ถึง 165 กลุ่ม UNII-2 และ UNII-2e ต้องใช้ DFS">`;
      let x = 16; const w = 21.5;
      groups.forEach(([nm, chans, dfs]) => {
        const gx = x;
        chans.forEach((c, k) => {
          s += R(x, 50, w - 2, 46, { rx: 3, fill: dfs ? 'var(--orange)' : 'var(--blue)', fo: 0.25, stroke: dfs ? 'var(--orange)' : 'var(--blue)', sw: 1.2 });
          s += `<text x="${n(x + w / 2 - 1)}" y="78" font-size="13" text-anchor="middle" fill="var(--ink)" font-family="inherit" transform="rotate(-90 ${n(x + w / 2 - 1)} 73)">${c}</text>`;
          x += w;
        });
        s += T((gx + x) / 2, 38, nm, { size: 13, anchor: 'middle', weight: 700 });
        x += 8;
      });
      s += T(16, 122, 'ช่อง 20 MHz ทุกช่องไม่ทับกันเลย รวมสูงสุด 25 ช่อง (ใช้ได้จริงขึ้นกับประเทศ)', { size: 13.5 });
      s += T(16, 142, 'สีส้ม = DFS ต้องหลบสัญญาณเรดาร์ · รวมเป็น 40/80 MHz จำนวนช่องจะลดลง', { size: 13, fill: 'var(--muted)' });
      five.appendChild(h('div', { class: 'nlfb-svg', html: null }));
      five.firstChild.innerHTML = s + '</svg>';
    })();
    function render() {
      pic.innerHTML = draw();
      const svgEl = pic.querySelector('svg');
      svgEl.setAttribute('role', 'img');
      svgEl.setAttribute('aria-label', `กราฟความถี่ 2.4 GHz แสดง AP1 ช่อง ${ch[0]}, AP2 ช่อง ${ch[1]}, AP3 ช่อง ${ch[2]}`);
      const ev = evaluate();
      bars.replaceChildren(...ev.map((e, i) => h('div', { class: 'nlfb-bar' }, h('span', null, `AP${i + 1} ช่อง ${ch[i]}`), h('span', { class: 'nlfb-track' }, h('i', { style: `width:${e.cap}%;background:${e.cap >= 90 ? 'var(--ok)' : e.cap >= 45 ? 'var(--orange)' : 'var(--bad)'}` })), h('b', null, e.cap + '%'))));
      const avg = Math.round(ev.reduce((a, e) => a + e.cap, 0) / 3);
      const pair = (lo, hi) => ch.some((c, i) => ch.some((d, j) => i !== j && Math.abs(c - d) >= lo && Math.abs(c - d) <= hi));
      const anyAci = pair(1, 3), anyCo = pair(0, 0), anyEdge = pair(4, 4);
      verdict.className = 'nlw-result ' + (anyAci ? 'nlw-is-bad' : anyCo || anyEdge ? 'nlw-is-warn' : 'nlw-is-ok');
      verdict.textContent = anyAci ? `มีช่องเหลื่อมกัน (Adjacent-channel interference) รบกวนกันมาก เฉลี่ยเหลือราว ${avg}%`
        : anyCo ? `ใช้ช่องซ้ำกัน (Co-channel) ต้องแบ่งเวลากันส่ง เฉลี่ยเหลือราว ${avg}%`
        : anyEdge ? `ห่างกัน 4 ช่อง ขอบช่องชิดกันพอดี รบกวนเล็กน้อย (เฉลี่ย ${avg}%) ชุด 1, 6, 11 มีช่องว่างกันชนมากกว่า`
        : `เยี่ยม: ไม่มีช่องทับกัน แต่ละ AP ใช้คลื่นได้เต็มที่ (เฉลี่ย ${avg}%)`;
      const rs = [];
      ev.forEach((e, i) => e.why.forEach(w => rs.push(['AP' + (i + 1) + ': ' + w, w.indexOf('เหลื่อม') >= 0 ? 'nlfb-e' : 'nlfb-i'])));
      reasons.replaceChildren(...(rs.length ? rs.map(([t, c]) => h('li', { class: c }, t)) : [h('li', { class: 'nlfb-o' }, 'ทุก AP ห่างกันอย่างน้อย 5 ช่อง ไม่ทับกัน')]));
    }
    render();
  });
})();
