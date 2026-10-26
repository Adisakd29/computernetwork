'use strict';
/* NetLab figures, batch j: figures for long lesson sections that had none.
   Register with NL_FIG('diagram'|'widget', name, svgString|mountFn). Placements: content/lessons/visuals.d/d.js
   Diagrams here are built from 310-unit-wide panels and come in two SVG variants inside one wrapper:
   a two-column "wide" SVG (viewBox width 640) and a one-column "narrow" SVG (viewBox width 322).
   A container query shows the narrow one when the figure is narrower than 560px, so SVG text stays >= ~12px on a 360px phone.
   No marker ids are used (arrow heads are drawn as polygons), so the two variants never share ids. */
window.NL_FIG = window.NL_FIG || function (kind, name, v) { const k = kind === 'diagram' ? 'NL_DIAGRAMS' : 'NL_WIDGETS'; (window[k] = window[k] || {})[name] = v; };

(function () {
  /* ---------- SVG helpers (colours only through CSS variables) ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MONO = 'JetBrains Mono,Consolas,monospace';
  const BL = 'var(--blue)', GR = 'var(--green)', OR = 'var(--orange)', BAD = 'var(--bad)', OK = 'var(--ok)', MU = 'var(--muted)', INK = 'var(--ink)', BR = 'var(--brown)', FLD = 'var(--field)';
  function T(x, y, s, o) {
    o = o || {};
    const fam = o.m ? ` font-family="${MONO}"` : ' font-family="inherit"';
    return `<text x="${x}" y="${y}" font-size="${o.s || 14}" text-anchor="${o.a || 'middle'}" fill="${o.c || INK}"${o.w ? ' font-weight="700"' : ''}${fam}${o.halo ? ' stroke="var(--panel)" stroke-width="4" stroke-linejoin="round" paint-order="stroke"' : ''}${o.sp ? ' xml:space="preserve" style="white-space:pre"' : ''}>${esc(s)}</text>`;
  }
  // several lines, left aligned by default
  function TL(x, y, lines, o) {
    o = o || {};
    const lh = o.lh || 19;
    return lines.map((l, i) => T(x, y + i * lh, l, Object.assign({ a: 'start', s: 13 }, o))).join('');
  }
  function R(x, y, w, h, o) {
    o = o || {};
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx == null ? 8 : o.rx}" fill="${o.f || 'var(--panel)'}"${o.fo != null ? ` fill-opacity="${o.fo}"` : ''} stroke="${o.st || 'var(--line)'}" stroke-width="${o.sw || 1.6}"${o.d ? ` stroke-dasharray="${o.d}"` : ''}/>`;
  }
  function L(x1, y1, x2, y2, o) {
    o = o || {};
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.c || MU}" stroke-width="${o.sw || 2}" stroke-linecap="round"${o.d ? ` stroke-dasharray="${o.d}"` : ''}/>`;
  }
  // polyline with an arrow head (drawn as a polygon) at the end, and optionally at the start
  function head(x1, y1, x2, y2, c) {
    const a = Math.atan2(y2 - y1, x2 - x1), Ln = 9, W = 4.6;
    const bx = x2 - Ln * Math.cos(a), by = y2 - Ln * Math.sin(a);
    const p = [[x2, y2], [bx + W * Math.sin(a), by - W * Math.cos(a)], [bx - W * Math.sin(a), by + W * Math.cos(a)]];
    return { s: `<polygon points="${p.map(q => q.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${c}"/>`, bx, by };
  }
  function A(pts, o) {
    o = o || {};
    const c = o.c || MU, n = pts.length;
    const e = head(pts[n - 2][0], pts[n - 2][1], pts[n - 1][0], pts[n - 1][1], c);
    const q = pts.slice(); q[n - 1] = [e.bx, e.by];
    let hs = e.s;
    if (o.both) { const s = head(pts[1][0], pts[1][1], pts[0][0], pts[0][1], c); q[0] = [s.bx, s.by]; hs += s.s; }
    return `<path d="M${q.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L')}" fill="none" stroke="${c}" stroke-width="${o.sw || 2}" stroke-linecap="round" stroke-linejoin="round"${o.d ? ` stroke-dasharray="${o.d}"` : ''}/>` + hs;
  }
  // box with a main label and an optional second line
  function BOX(x, y, w, h, main, sub, o) {
    o = o || {};
    const cx = x + w / 2;
    return R(x, y, w, h, { f: o.f, fo: o.fo, st: o.st, sw: o.sw, d: o.d }) +
      T(cx, y + (sub ? h / 2 - 3 : h / 2 + 5), main, { s: o.s || 14, w: o.bold !== false, m: o.m, c: o.c }) +
      (sub ? T(cx, y + h / 2 + 15, sub, { s: 13, c: o.subc || MU, m: o.subm }) : '');
  }
  // numbered callout disc
  function NUM(x, y, n, c) {
    return `<circle cx="${x}" cy="${y}" r="10" fill="${c || BAD}"/>` + T(x, y + 4.5, String(n), { s: 13, w: 1, c: 'var(--panel)' });
  }
  function PC(x, y, c) { // small monitor glyph 26x22
    return R(x, y, 26, 17, { rx: 2, f: FLD, st: c || INK, sw: 1.5 }) + `<path d="M${x + 13},${y + 17} v4 M${x + 7},${y + 22} h12" stroke="${c || INK}" stroke-width="1.6" fill="none"/>`;
  }

  /* ---------- two-variant panel layout ---------- */
  const PW = 310, GAP = 8, M = 6, WW = 640, WN = PW + 2 * M;
  function frame(p, h) {
    const c = p.c || MU;
    return R(0, 0, PW, h, { f: c, fo: 0.05, st: c, sw: 1.4, rx: 12, d: '6 4' }) +
      (Array.isArray(p.t) ? p.t : [p.t]).map((t, i) => T(12, 25 + i * 20, t, { s: 15, w: 1, a: 'start', c: c === MU ? INK : c })).join('');
  }
  const G = (x, y, s) => `<g transform="translate(${x},${y})">${s}</g>`;
  function svgOf(cls, id, title, w, h, body) {
    return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}" font-family="inherit"><title id="${id}">${esc(title)}</title>${body}</svg>`;
  }
  function dual(name, title, panels) {
    let y = M, sW = '';
    for (let i = 0; i < panels.length; i += 2) {
      const a = panels[i], b = panels[i + 1];
      if (b) {
        const h = Math.max(a.h, b.h);
        sW += G(M, y, frame(a, h) + a.b) + G(M + PW + GAP, y, frame(b, h) + b.b);
        y += h + GAP;
      } else { sW += G((WW - PW) / 2, y, frame(a, a.h) + a.b); y += a.h + GAP; }
    }
    const HW = y - GAP + M;
    let yn = M, sN = '';
    for (const p of panels) { sN += G(M, yn, frame(p, p.h) + p.b); yn += p.h + GAP; }
    const HN = yn - GAP + M;
    return `<div class="nlfj-dual">` + svgOf('nlfj-w', name + '-tw', title, WW, HW, sW) + svgOf('nlfj-n', name + '-tn', title, WN, HN, sN) + `</div>`;
  }
  (function css() {
    if (document.getElementById('nlfj-css')) return;
    const st = document.createElement('style'); st.id = 'nlfj-css';
    st.textContent = '.nlfj-dual{container-type:inline-size;width:100%}' +
      '.nlfj-dual>svg{width:100%;height:auto;display:block}' +
      '.nlfj-dual>svg.nlfj-n{display:none}' +
      '@container (max-width:559px){.nlfj-dual>svg.nlfj-w{display:none}.nlfj-dual>svg.nlfj-n{display:block}}';
    (document.head || document.documentElement).appendChild(st);
  })();

  /* ===================================================================
     diagram bridge-router-gw (w2 s2): bridge (L2), router (L3), modem/ONT (L1), gateway (protocol translation)
     =================================================================== */
  (function () {
    const pA = { t: 'Bridge: ชั้น 2 ตัดสินใจด้วย MAC', c: BL, h: 330, b:
      R(10, 42, 112, 100, { f: FLD }) + T(66, 60, 'ฝั่ง A', { s: 13, w: 1, c: MU }) +
      BOX(20, 70, 92, 28, 'PC1  .11', '', { m: 1, s: 13 }) + BOX(20, 104, 92, 28, 'PC2  .12', '', { m: 1, s: 13 }) +
      R(188, 42, 112, 100, { f: FLD }) + T(244, 60, 'ฝั่ง B', { s: 13, w: 1, c: MU }) +
      BOX(198, 70, 92, 28, 'PC3  .13', '', { m: 1, s: 13 }) + BOX(198, 104, 92, 28, 'PC4  .14', '', { m: 1, s: 13 }) +
      R(128, 66, 54, 64, { st: BL, sw: 2.4 }) + T(155, 92, 'Bridge', { s: 13, w: 1 }) + T(138, 120, '1', { s: 13, c: MU }) + T(172, 120, '2', { s: 13, c: MU }) +
      L(122, 98, 128, 98, { c: BL, sw: 3 }) + L(182, 98, 188, 98, { c: BL, sw: 3 }) +
      R(10, 152, 290, 62, { f: FLD }) + T(20, 170, 'ตาราง MAC ที่บริดจ์เรียนรู้', { s: 13, w: 1, a: 'start' }) +
      T(20, 189, 'MAC ของ PC1, PC2  →  พอร์ต 1', { s: 13, a: 'start' }) + T(20, 206, 'MAC ของ PC3, PC4  →  พอร์ต 2', { s: 13, a: 'start' }) +
      T(10, 236, 'PC1 → PC2: อยู่ฝั่ง A ด้วยกัน = กรองไว้ ไม่ข้าม', { s: 13, a: 'start' }) +
      T(10, 256, 'PC1 → PC3: อยู่อีกฝั่ง = ส่งข้ามไปพอร์ต 2', { s: 13, a: 'start' }) +
      T(10, 276, 'แยก Collision Domain เป็น 2 ส่วน', { s: 13, a: 'start', c: MU }) +
      T(10, 300, 'ทั้งหมดยังเป็นเครือข่ายเดียว 192.168.1.0/24', { s: 13, a: 'start', w: 1, c: BL }) +
      T(10, 319, 'Broadcast ข้ามบริดจ์ได้', { s: 13, a: 'start', c: MU }) };
    const pB = { t: 'Router: ชั้น 3 ตัดสินใจด้วย IP', c: GR, h: 378, b:
      R(10, 40, 290, 50, { f: FLD }) + T(20, 60, 'LAN 1', { s: 14, w: 1, a: 'start' }) + T(78, 60, '192.168.1.0/24', { s: 13, m: 1, a: 'start' }) +
      T(20, 80, 'PC .11 ตั้ง Default Gateway = .1', { s: 13, a: 'start', c: MU }) +
      L(155, 90, 155, 118, { c: GR, sw: 3 }) + T(163, 109, 'G0/0 192.168.1.1', { s: 13, m: 1, a: 'start' }) +
      R(96, 118, 110, 36, { st: GR, sw: 2.4 }) + T(151, 141, 'Router', { s: 14, w: 1 }) +
      L(206, 136, 258, 136, { c: GR, sw: 3 }) + T(232, 128, 'WAN', { s: 13, c: MU }) + BOX(258, 122, 42, 28, 'ISP', '', { s: 13 }) +
      L(155, 154, 155, 182, { c: GR, sw: 3 }) + T(163, 173, 'G0/1 192.168.2.1', { s: 13, m: 1, a: 'start' }) +
      R(10, 182, 290, 50, { f: FLD }) + T(20, 202, 'LAN 2', { s: 14, w: 1, a: 'start' }) + T(78, 202, '192.168.2.0/24', { s: 13, m: 1, a: 'start' }) +
      T(20, 222, 'Server .20 ตั้ง Default Gateway = .1', { s: 13, a: 'start', c: MU }) +
      R(10, 242, 290, 86, { f: FLD }) + T(20, 261, 'ตารางเส้นทาง (Routing Table)', { s: 13, w: 1, a: 'start' }) +
      T(20, 281, '192.168.1.0/24  G0/0  connected', { s: 13, m: 1, a: 'start', sp: 1 }) +
      T(20, 299, '192.168.2.0/24  G0/1  connected', { s: 13, m: 1, a: 'start', sp: 1 }) +
      T(20, 317, '0.0.0.0/0       WAN   → ISP', { s: 13, m: 1, a: 'start', sp: 1 }) +
      T(10, 348, 'แต่ละพอร์ตเป็น Broadcast Domain แยกกัน', { s: 13, a: 'start', w: 1, c: GR }) +
      T(10, 367, 'Broadcast ของ LAN 1 ไม่ข้ามไป LAN 2', { s: 13, a: 'start', c: MU }) };
    const pC = { t: 'Modem / ONT: ชั้น 1 แปลงสัญญาณ', c: OR, h: 226, b:
      BOX(10, 44, 84, 44, 'Router', '', { s: 13 }) + BOX(113, 44, 84, 44, 'ONT', '', { s: 13, st: OR, sw: 2.4 }) + BOX(216, 44, 84, 44, 'ISP', '', { s: 13 }) +
      L(94, 66, 113, 66, { c: BL, sw: 3 }) + L(197, 66, 216, 66, { c: OR, sw: 3, d: '5 3' }) +
      T(103, 108, 'สาย LAN', { s: 13 }) + T(103, 125, 'ไฟฟ้า', { s: 13, c: MU }) +
      T(206, 108, 'ไฟเบอร์', { s: 13 }) + T(206, 125, 'แสง', { s: 13, c: MU }) +
      TL(10, 152, ['Modem = Modulator-Demodulator', 'แปลงดิจิทัล ↔ สัญญาณบนสายผู้ให้บริการ', 'ไม่อ่าน MAC หรือ IP แค่แปลงรูปสัญญาณ']) +
      T(10, 212, 'ไฟ LOS สีแดง = ปัญหาที่สายไฟเบอร์', { s: 13, a: 'start', w: 1, c: OR }) };
    const pD = { t: 'Gateway: แปลงโปรโตคอล (ชั้น 4-7)', c: BR, h: 226, b:
      R(10, 42, 84, 56) + T(52, 64, 'เครือข่าย IP', { s: 13, w: 1 }) + T(52, 85, 'SIP + RTP', { s: 13, m: 1, c: MU }) +
      R(118, 42, 76, 56, { st: BR, sw: 2.4 }) + T(156, 64, 'VoIP', { s: 13, w: 1 }) + T(156, 85, 'Gateway', { s: 13, w: 1 }) +
      R(218, 42, 82, 56) + T(259, 64, 'สายโทรศัพท์', { s: 13, w: 1 }) + T(259, 85, 'PSTN', { s: 13, m: 1, c: MU }) +
      A([[96, 70], [116, 70]], { c: BR, both: 1, sw: 2.4 }) + A([[196, 70], [216, 70]], { c: BR, both: 1, sw: 2.4 }) +
      T(10, 122, 'แปลงทั้งรูปแบบข้อมูลและโปรโตคอล เหมือนล่าม', { s: 13, a: 'start' }) +
      R(10, 136, 290, 78, { f: FLD, st: BR, d: '5 3' }) + T(20, 156, 'ระวังสับสน: Default Gateway', { s: 13, w: 1, a: 'start' }) +
      T(20, 176, 'ในการตั้งค่า IP คือ IP ของพอร์ตเราเตอร์', { s: 13, a: 'start' }) +
      T(20, 196, 'เช่น 192.168.1.1 ไม่ใช่ตัวแปลงโปรโตคอล', { s: 13, a: 'start' }) };
    NL_FIG('diagram', 'bridge-router-gw', dual('bridge-router-gw',
      'อุปกรณ์เชื่อมต่อระหว่างเครือข่าย 4 ชนิด. Bridge ชั้น 2: เชื่อมฝั่ง A (PC1 .11, PC2 .12) กับฝั่ง B (PC3 .13, PC4 .14) ใช้ตาราง MAC ตัดสินใจ เฟรมจาก PC1 ถึง PC2 ถูกกรองไว้ เฟรมจาก PC1 ถึง PC3 ถูกส่งข้ามไปพอร์ต 2 ทั้งหมดยังเป็นเครือข่ายเดียว 192.168.1.0/24 และ Broadcast ข้ามได้. Router ชั้น 3: พอร์ต G0/0 192.168.1.1 ต่อ LAN 1 192.168.1.0/24 พอร์ต G0/1 192.168.2.1 ต่อ LAN 2 192.168.2.0/24 และพอร์ต WAN ไป ISP ตารางเส้นทางมีสองเครือข่ายที่ต่อตรงและเส้นทาง 0.0.0.0/0 ไป WAN แต่ละพอร์ตเป็น Broadcast Domain แยกกัน. Modem หรือ ONT ชั้น 1: แปลงสัญญาณไฟฟ้าจากสาย LAN ของเราเตอร์เป็นแสงบนสายไฟเบอร์ไปยัง ISP ไม่อ่าน MAC หรือ IP. Gateway: เช่น VoIP Gateway แปลง SIP และ RTP บนเครือข่าย IP กับสายโทรศัพท์ PSTN ซึ่งต่างจาก Default Gateway ในการตั้งค่า IP ที่หมายถึง IP ของพอร์ตเราเตอร์',
      [pA, pB, pC, pD]));
  })();

  /* ===================================================================
     diagram sw-data-protect (w16 s2): patching (WannaCry timeline), Defender scan types, C = BitLocker, I = SHA-256 check
     =================================================================== */
  (function () {
    const TB = 'var(--term-bg)', TI = 'var(--term-ink)', TD = 'var(--term-dim)';
    const pA = { t: 'อัปเดตก่อนถูกโจมตี: กรณี WannaCry', c: BL, h: 232, b:
      T(14, 56, '14 มี.ค. 2017', { s: 13, w: 1, a: 'start' }) + T(296, 56, '12 พ.ค. 2017', { s: 13, w: 1, a: 'end' }) +
      T(155, 56, 'ห่างราว 2 เดือน', { s: 13, c: MU }) +
      L(30, 70, 280, 70, { c: MU, sw: 2.4 }) + `<circle cx="30" cy="70" r="6" fill="${OK}"/><circle cx="280" cy="70" r="6" fill="${BAD}"/>` +
      TL(14, 94, ['Microsoft ออกแพตช์', 'MS17-010 (SMBv1)']) +
      TL(296, 94, ['WannaCry ระบาด', 'ผ่าน SMB พอร์ต 445'], { a: 'end' }) +
      BOX(10, 138, 140, 52, 'อัปเดตแล้ว', 'ไม่ติด', { st: OK, sw: 2.4, subc: OK }) +
      BOX(160, 138, 140, 52, 'ยังไม่อัปเดต', 'ไฟล์ถูกเข้ารหัส', { st: BAD, sw: 2.4, subc: BAD }) +
      T(10, 216, 'เปิด Windows Update อัตโนมัติไว้เสมอ', { s: 13, a: 'start', w: 1, c: BL }) };
    const rows = [['Quick scan', 'ตรวจจุดที่มัลแวร์ชอบซ่อน ใช้เวลาไม่นาน'], ['Full scan', 'ตรวจทุกไฟล์ ใช้เวลานาน'],
      ['Custom scan', 'เลือกโฟลเดอร์หรือแฟลชไดรฟ์เอง'], ['Microsoft Defender Offline scan', 'รีสตาร์ตแล้วสแกนก่อน Windows โหลด']];
    const pB = { t: 'Microsoft Defender: เลือกแบบสแกน', c: GR, h: 312, b:
      TL(10, 48, ['Windows Security → Virus & threat', 'protection → Scan options'], { c: MU, lh: 18 }) +
      rows.map((r, i) => R(10, 78 + i * 50, 290, 44, { f: FLD }) + T(20, 97 + i * 50, r[0], { s: 13, w: 1, a: 'start' }) + T(20, 114 + i * 50, r[1], { s: 13, a: 'start', c: MU })).join('') +
      T(10, 296, 'Real-time protection ควรเปิดไว้ตลอด', { s: 13, a: 'start', w: 1, c: GR }) };
    const pC = { t: 'C ความลับ: เข้ารหัสดิสก์ BitLocker', c: OR, h: 268, b:
      T(10, 50, 'โน้ตบุ๊กหาย คนเก็บได้ถอดดิสก์ไปต่อเครื่องอื่น', { s: 13, a: 'start' }) +
      R(10, 64, 140, 96, { st: BAD, sw: 2 }) + T(80, 86, 'ไม่เข้ารหัส', { s: 14, w: 1 }) + T(80, 112, 'เงินเดือน.xlsx', { s: 13 }) + T(80, 138, 'อ่านได้ทันที', { s: 13, w: 1, c: BAD }) +
      R(160, 64, 140, 96, { st: OK, sw: 2 }) + T(230, 86, 'เปิด BitLocker', { s: 14, w: 1 }) + T(230, 112, 'x9#Q 8f3a c91e', { s: 13, m: 1, c: MU }) + T(230, 138, 'อ่านไม่ออก', { s: 13, w: 1, c: OK }) +
      TL(10, 186, ['ปลดล็อกบนเครื่องอื่นต้องใช้ Recovery key', 'ซึ่งเป็นตัวเลข 48 หลัก: เก็บไว้ที่ปลอดภัย', 'มีใน Windows Pro ขึ้นไป รุ่น Home บางเครื่อง', 'มี Device encryption แทน']) };
    const pD = { t: 'I ความถูกต้อง: เทียบค่า SHA-256', c: BL, h: 338, b:
      BOX(10, 42, 136, 46, 'setup.exe', 'ไฟล์ที่ดาวน์โหลด', { s: 14, m: 1 }) + BOX(164, 42, 136, 46, 'เว็บผู้ผลิต', 'ประกาศค่า SHA-256', { s: 14 }) +
      R(10, 100, 290, 88, { f: TB, st: TB }) +
      T(18, 120, 'PS> Get-FileHash .\\setup.exe', { s: 13, m: 1, a: 'start', c: TI, w: 1 }) +
      T(18, 140, 'Algorithm Hash         Path', { s: 13, m: 1, a: 'start', c: TD, sp: 1 }) +
      T(18, 158, '--------- ----         ----', { s: 13, m: 1, a: 'start', c: TD, sp: 1 }) +
      T(18, 176, 'SHA256    3A7F…9C41  …\\setup.exe', { s: 13, m: 1, a: 'start', c: TI, sp: 1 }) +
      T(10, 206, 'ค่าแฮชย่อไว้ ค่าจริงยาว 64 ตัวอักษรฐานสิบหก', { s: 13, a: 'start', c: MU }) +
      BOX(10, 218, 140, 50, 'ตรงกันทุกตัว', 'ไฟล์ไม่ถูกแก้ไข', { st: OK, sw: 2.4, subc: OK }) +
      BOX(160, 218, 140, 50, 'ต่างแม้ 1 ตัว', 'อย่าเปิดไฟล์นี้', { st: BAD, sw: 2.4, subc: BAD }) +
      T(10, 292, 'certutil -hashfile setup.exe SHA256', { s: 13, m: 1, a: 'start' }) +
      T(10, 312, 'sha256sum setup.exe', { s: 13, m: 1, a: 'start' }) + T(170, 312, '(Linux)', { s: 13, a: 'start', c: MU }) };
    NL_FIG('diagram', 'sw-data-protect', dual('sw-data-protect',
      'การป้องกันทางซอฟต์แวร์และข้อมูล 4 ส่วน. ส่วนที่ 1 อัปเดต: 14 มีนาคม 2017 Microsoft ออกแพตช์ MS17-010 ปิดช่องโหว่ SMBv1 และ 12 พฤษภาคม 2017 WannaCry ระบาดผ่าน SMB พอร์ต 445 ห่างกันราว 2 เดือน เครื่องที่อัปเดตแล้วไม่ติด เครื่องที่ไม่อัปเดตถูกเข้ารหัสไฟล์. ส่วนที่ 2 Microsoft Defender ที่ Windows Security, Virus & threat protection, Scan options มี Quick scan, Full scan, Custom scan และ Microsoft Defender Offline scan. ส่วนที่ 3 ความลับ: ดิสก์ที่ไม่เข้ารหัสถูกถอดไปอ่านได้ทันที ดิสก์ที่เปิด BitLocker อ่านไม่ออก ต้องใช้ Recovery key ตัวเลข 48 หลัก. ส่วนที่ 4 ความถูกต้อง: คำสั่ง Get-FileHash แสดงค่า SHA-256 ของไฟล์ นำไปเทียบกับค่าที่เว็บผู้ผลิตประกาศ ตรงกันทุกตัวแปลว่าไฟล์ไม่ถูกแก้ ต่างแม้ตัวเดียวห้ามเปิด คำสั่งอื่นคือ certutil -hashfile และ sha256sum ใน Linux',
      [pA, pB, pC, pD]));
  })();

  /* ===================================================================
     diagram workgroup-domain (w8 s2): local accounts per PC vs central accounts on a domain controller, and the Windows dialog
     =================================================================== */
  (function () {
    const card = (x, name, acc) => R(x, 42, 92, 116, { f: FLD }) + PC(x + 33, 50, OR) + T(x + 46, 92, name, { s: 13, m: 1, w: 1 }) +
      T(x + 46, 112, 'บัญชีในเครื่อง', { s: 13, c: MU }) + acc.map((a, i) => T(x + 46, 132 + i * 18, a, { s: 13, m: 1 })).join('') + L(x + 46, 158, x + 46, 172, { c: OR, sw: 2.4 });
    const pA = { t: 'Workgroup (เช่น SHOPNET)', c: OR, h: 318, b:
      card(10, 'SHOP-POS1', ['cashier']) + card(109, 'SHOP-ACC', ['acc', 'owner']) + card(208, 'SHOP-OWNER', ['owner']) +
      R(10, 172, 290, 26, { f: OR, fo: 0.12, st: OR }) + T(155, 190, 'Switch: ทุกเครื่องเท่ากัน (Peer-to-Peer)', { s: 13 }) +
      TL(10, 222, ['ไม่มีเครื่องกลาง แต่ละเครื่องเก็บบัญชีเอง', 'owner ต้องมีบัญชีบน SHOP-ACC ด้วย', 'จึงเปิด \\\\SHOP-ACC ได้ (บัญชีซ้ำหลายที่)', 'เหมาะกับไม่เกินราว 10-20 เครื่อง']) };
    const pB = { t: 'Domain (เช่น CORP)', c: BL, h: 318, b:
      R(50, 40, 210, 100, { st: BL, sw: 2.4 }) + T(155, 62, 'DC01: Domain Controller', { s: 14, w: 1 }) + T(155, 82, 'Windows Server + AD DS', { s: 13, c: MU }) +
      R(62, 92, 186, 40, { f: FLD }) + T(155, 108, 'บัญชีผู้ใช้ทุกคน', { s: 13 }) + T(155, 125, '+ นโยบาย Group Policy', { s: 13 }) +
      A([[110, 140], [56, 176]], { c: BL, both: 1 }) + A([[155, 140], [155, 176]], { c: BL, both: 1 }) + A([[200, 140], [254, 176]], { c: BL, both: 1 }) +
      BOX(10, 178, 92, 36, 'PC-01', '', { s: 13, m: 1 }) + BOX(109, 178, 92, 36, 'PC-02', '', { s: 13, m: 1 }) + BOX(208, 178, 92, 36, 'PC-03', '', { s: 13, m: 1 }) +
      TL(10, 240, ['ล็อกอิน CORP\\somchai ได้ทุกเครื่อง', 'รหัสผ่านถูกตรวจที่ DC สร้างหรือปิดบัญชี', 'ครั้งเดียวมีผลทุกเครื่อง', 'เข้าร่วมได้เฉพาะ Pro, Enterprise, Education']) };
    const pC = { t: 'หน้าต่างตั้งชื่อเครื่องและ Workgroup', c: MU, h: 460, b:
      TL(10, 48, ['Windows + R → sysdm.cpl → แท็บ', 'Computer Name → ปุ่ม Change...', 'Windows 11: Settings → System → About', '→ Domain or workgroup'], { c: MU, lh: 18 }) +
      R(10, 118, 290, 250, { st: INK, sw: 1.4, rx: 6 }) + R(10, 118, 290, 28, { f: FLD, st: INK, sw: 1.4, rx: 6 }) +
      T(20, 137, 'Computer Name/Domain Changes', { s: 13, w: 1, a: 'start' }) +
      T(22, 170, 'Computer name:', { s: 13, a: 'start' }) + R(22, 178, 200, 26, { f: FLD, rx: 3 }) + T(30, 196, 'SHOP-ACC', { s: 13, m: 1, a: 'start' }) + NUM(240, 191, 1) +
      T(22, 226, 'Full computer name: SHOP-ACC', { s: 13, a: 'start', c: MU }) +
      R(22, 240, 266, 82, { rx: 4 }) + T(30, 256, 'Member of', { s: 13, w: 1, a: 'start' }) +
      `<circle cx="38" cy="275" r="6" fill="var(--panel)" stroke="${INK}" stroke-width="1.5"/>` + T(50, 280, 'Domain:', { s: 13, a: 'start' }) + R(130, 265, 120, 22, { f: FLD, rx: 3 }) +
      `<circle cx="38" cy="305" r="6" fill="var(--panel)" stroke="${INK}" stroke-width="1.5"/><circle cx="38" cy="305" r="3" fill="${INK}"/>` + T(50, 310, 'Workgroup:', { s: 13, a: 'start' }) +
      R(130, 295, 120, 22, { f: FLD, rx: 3 }) + T(136, 311, 'SHOPNET', { s: 13, m: 1, a: 'start' }) + NUM(270, 290, 2) +
      BOX(150, 332, 64, 26, 'OK', '', { s: 13 }) + BOX(222, 332, 70, 26, 'Cancel', '', { s: 13 }) +
      NUM(20, 390, 1) + T(36, 395, 'ไม่เกิน 15 ตัว ห้ามเว้นวรรค ใช้ A-Z 0-9 -', { s: 13, a: 'start' }) +
      NUM(20, 416, 2) + T(36, 421, 'เลือก Workgroup หรือ Domain อย่างเดียว', { s: 13, a: 'start' }) +
      NUM(20, 442, 3, BL) + T(36, 447, 'กด OK แล้วต้องรีสตาร์ทจึงมีผล', { s: 13, a: 'start' }) };
    NL_FIG('diagram', 'workgroup-domain', dual('workgroup-domain',
      'เทียบ Workgroup กับ Domain. Workgroup ชื่อ SHOPNET มี 3 เครื่องเท่ากันแบบ Peer-to-Peer: SHOP-POS1 มีบัญชี cashier, SHOP-ACC มีบัญชี acc และ owner, SHOP-OWNER มีบัญชี owner แต่ละเครื่องเก็บบัญชีของตัวเอง owner ต้องมีบัญชีบน SHOP-ACC ด้วยจึงเปิด \\\\SHOP-ACC ได้. Domain ชื่อ CORP มีเครื่อง DC01 เป็น Domain Controller ที่ใช้ Windows Server กับ AD DS เก็บบัญชีผู้ใช้ทุกคนและนโยบาย Group Policy เครื่อง PC-01 ถึง PC-03 ตรวจรหัสผ่านที่ DC ผู้ใช้ล็อกอินด้วย CORP\\somchai ได้ทุกเครื่อง เข้าร่วมได้เฉพาะ Windows Pro, Enterprise, Education. หน้าต่าง Computer Name/Domain Changes เปิดจาก sysdm.cpl แท็บ Computer Name ปุ่ม Change หรือ Windows 11 Settings, System, About, Domain or workgroup มีช่อง Computer name ไม่เกิน 15 ตัว และกลุ่ม Member of ให้เลือก Domain หรือ Workgroup อย่างเดียว กด OK แล้วต้องรีสตาร์ท',
      [pA, pB, pC]));
  })();

  /* ===================================================================
     diagram wlan-shared-air (w6 s1): where wireless and wired fit in a cafe, shared airtime, why real speed < box speed
     =================================================================== */
  (function () {
    const pA = { t: 'ร้านกาแฟ: ใช้ทั้งไร้สายและสาย', c: BL, h: 312, b:
      R(10, 40, 234, 190, { f: FLD, st: INK, sw: 2, rx: 4 }) + T(20, 58, 'ในร้าน', { s: 13, c: MU, a: 'start' }) +
      BOX(92, 48, 104, 40, 'Router + AP', '', { s: 13, st: BL, sw: 2.4 }) +
      `<path d="M92,68 H18 V190 M18,130 H26 M18,190 H26" fill="none" stroke="${GR}" stroke-width="3"/>` +
      BOX(26, 110, 96, 40, 'Printer', 'สาย LAN', { s: 13, st: GR }) + BOX(26, 170, 96, 40, 'เครื่อง POS', 'สาย LAN', { s: 13, st: GR }) +
      L(156, 89, 176, 109, { c: BL, sw: 2.4, d: '4 3' }) + `<path d="M196,68 H236 V190 H230" fill="none" stroke="${BL}" stroke-width="2" stroke-dasharray="4 4"/>` +
      BOX(132, 110, 98, 40, 'แท็บเล็ต', 'CAFE-STAFF', { s: 13, subm: 1 }) + BOX(132, 170, 98, 40, 'ลูกค้า', 'CAFE-GUEST', { s: 13, subm: 1 }) +
      `<path d="M252,82 q14,22 0,44 M262,72 q22,32 0,64" fill="none" stroke="${BL}" stroke-width="2" stroke-dasharray="4 4"/>` +
      T(276, 58, 'นอกร้าน', { s: 13, c: MU }) + BOX(250, 150, 52, 36, 'คนนอก', '', { s: 13, st: BAD }) +
      TL(10, 252, ['ใช้สายกับเครื่องประจำจุดที่ต้องเสถียร', 'แยก SSID พนักงานกับลูกค้า (Guest)', 'คลื่นทะลุออกนอกร้าน: ต้องใช้ WPA2/WPA3']) };
    const bars = [1, 5, 10].map((n, i) => {
      const y = 74 + i * 46;
      let s = T(10, y, `ใช้พร้อมกัน ${n} คน: คนละราว ${200 / n} Mbps`, { s: 13, a: 'start' }) + R(10, y + 8, 290, 18, { f: OR, fo: 0.2, st: OR, rx: 3 });
      for (let k = 1; k < n; k++) s += L(10 + 290 * k / n, y + 8, 10 + 290 * k / n, y + 26, { c: OR, sw: 1.6 });
      return s;
    }).join('');
    const pB = { t: 'สื่อที่ใช้ร่วมกัน: ผลัดกันส่ง', c: OR, h: 318, b:
      T(10, 48, 'สมมุติ AP ได้ความเร็วใช้งานจริงรวม 200 Mbps', { s: 13, a: 'start', c: MU }) + bars +
      T(10, 214, 'Switch แบบมีสาย: แต่ละพอร์ตไม่แบ่งกัน', { s: 13, a: 'start', w: 1 }) +
      [0, 1, 2, 3].map(k => BOX(10 + k * 74, 224, 68, 26, 'พอร์ต ' + (k + 1), '', { s: 13, bold: false, st: GR })).join('') +
      T(10, 270, 'เช่น 1 Gbps ต่อพอร์ต แบบ Full-duplex', { s: 13, a: 'start' }) +
      TL(10, 292, ['ตัวเลข Wi-Fi ข้างบนใช้อธิบายเท่านั้น', 'ของจริงขึ้นกับสัญญาณของแต่ละเครื่อง'], { c: MU, lh: 17 }) };
    const pC = { t: 'ทำไมความเร็วจริงต่ำกว่าบนกล่อง', c: GR, h: 262, b:
      R(10, 40, 290, 56, { f: FLD }) + T(20, 60, 'กล่องเขียน AX3000 (Wi-Fi 6)', { s: 14, w: 1, a: 'start' }) +
      T(20, 82, '≈ 2402 (5 GHz) + 574 (2.4 GHz) Mbps', { s: 13, a: 'start' }) +
      TL(10, 120, ['1. เป็นอัตราสูงสุดของทุกย่านรวมกัน', '2. เครื่องหนึ่งใช้ทีละย่าน และมือถือส่วนใหญ่', '    มีเสาอากาศ 2x2 หรือน้อยกว่า', '3. ระยะทาง ผนัง โลหะ ไมโครเวฟ (2.4 GHz)', '    และ Wi-Fi ข้างเคียงทำให้อัตราลดลง', '4. ต้องรอคิวส่ง (CSMA/CA) และมีส่วนหัว', '    ข้อมูลจริงจึงน้อยกว่าอัตราสัญญาณ'], { sp: 1 }) };
    NL_FIG('diagram', 'wlan-shared-air', dual('wlan-shared-air',
      'ข้อดีและข้อจำกัดของ WLAN. ผังร้านกาแฟ: Router + AP ต่อเครื่องพิมพ์และเครื่อง POS ด้วยสาย LAN ส่วนแท็บเล็ตพนักงานใช้ Wi-Fi ชื่อ CAFE-STAFF และลูกค้าใช้ CAFE-GUEST แยกกัน คลื่นทะลุออกนอกร้านถึงคนนอก จึงต้องใช้ WPA2 หรือ WPA3. สื่อที่ใช้ร่วมกัน: สมมุติ AP ได้ความเร็วจริงรวม 200 Mbps ผู้ใช้ 1 คนได้ราว 200, 5 คนได้คนละราว 40, 10 คนได้คนละราว 20 Mbps ส่วน Switch แบบมีสายแต่ละพอร์ตไม่แบ่งกัน เช่น 1 Gbps ต่อพอร์ตแบบ Full-duplex ตัวเลขใช้อธิบายเท่านั้น. ทำไมความเร็วจริงต่ำกว่าบนกล่อง: AX3000 คือราว 2402 Mbps ย่าน 5 GHz บวก 574 Mbps ย่าน 2.4 GHz เป็นอัตราสูงสุดรวมทุกย่าน เครื่องหนึ่งใช้ทีละย่าน มือถือมักมีเสาอากาศ 2x2 หรือน้อยกว่า ระยะ ผนัง โลหะ ไมโครเวฟ และ Wi-Fi ข้างเคียงทำให้อัตราลด และต้องรอคิวส่งแบบ CSMA/CA กับมีส่วนหัว',
      [pA, pB, pC]));
  })();

  /* ===================================================================
     diagram ssid-mac-exposed (w7 s3): hidden SSID leaks in probe/association frames; MAC is in the clear header; what WPA2/WPA3 protect
     =================================================================== */
  (function () {
    const X = [50, 155, 260];
    const msg = (y, text, from, to) => T(155, y, text, { s: 13, halo: 1 }) + A([[X[from] + (to > from ? 4 : -4), y + 12], [X[to] + (to > from ? -4 : 4), y + 12]], { c: OR, sw: 2.4 }) +
      (to !== 2 ? A([[X[1] + 6, y + 22], [X[2] - 4, y + 22]], { c: BAD, sw: 1.6, d: '4 3' }) : '');
    const pA = { t: 'ซ่อน SSID: ชื่อยังรั่วจากเฟรมอื่น', c: OR, h: 340, b:
      BOX(10, 40, 80, 32, 'มือถือ', '', { s: 13 }) + BOX(115, 40, 80, 32, 'AP', '', { s: 13 }) + BOX(220, 40, 80, 32, 'ตัวดักฟัง', '', { s: 13, st: BAD }) +
      X.map(x => [[72, 83], [100, 127], [146, 173], [192, 219], [238, 262]].map(r => L(x, r[0], x, r[1], { c: 'var(--line)', sw: 2, d: '3 4' })).join('')).join('') +
      T(155, 96, 'Beacon: ช่อง SSID ว่าง (ทุก ≈0.1 วินาที)', { s: 13, halo: 1 }) + A([[151, 108], [54, 108]], { c: MU, sw: 2.4 }) +
      msg(140, 'Probe Request: SSID = SHOP-STAFF', 0, 1) +
      msg(186, 'Probe Response: SSID = SHOP-STAFF', 1, 0) +
      msg(232, 'Association Request: SSID = SHOP-STAFF', 0, 1) +
      T(254, 270, 'อ่านได้', { s: 13, w: 1, c: BAD }) +
      TL(10, 292, ['เฟรมเหล่านี้ไม่เข้ารหัส เห็นชื่อทันทีที่มีคนต่อ', 'เครื่องที่เคยต่อจะถามหาชื่อนี้แม้อยู่นอกบ้าน'], { lh: 19 }) };
    const pB = { t: 'MAC Filtering: MAC อยู่ในหัวเฟรม', c: BL, h: 340, b:
      R(10, 44, 170, 44, { f: FLD, st: INK, rx: 3 }) + T(95, 62, 'ส่วนหัว MAC', { s: 13, w: 1 }) + T(95, 80, 'ไม่เข้ารหัสเสมอ', { s: 13, c: BAD }) +
      R(180, 44, 82, 44, { f: OK, fo: 0.15, st: OK, rx: 3 }) + T(221, 62, 'ข้อมูล', { s: 13, w: 1 }) + T(221, 80, 'เข้ารหัส', { s: 13, c: OK }) +
      R(262, 44, 38, 44, { f: FLD, rx: 3 }) + T(281, 71, 'FCS', { s: 13 }) +
      R(10, 98, 290, 52, { f: FLD }) + T(20, 118, 'Addr1 ผู้รับ', { s: 13, a: 'start' }) + T(118, 118, 'MAC ของ AP', { s: 13, a: 'start', c: MU }) +
      T(20, 140, 'Addr2 ผู้ส่ง', { s: 13, a: 'start' }) + T(118, 140, '3C:52:82:1A:9F:07', { s: 13, m: 1, a: 'start', w: 1, c: BAD }) +
      NUM(22, 176, 1, BL) + T(38, 181, 'ดักอ่าน MAC เครื่องที่ได้รับอนุญาต', { s: 13, a: 'start' }) +
      NUM(22, 204, 2, BL) + T(38, 209, 'ตั้ง MAC การ์ดตัวเองเป็นค่าเดียวกัน', { s: 13, a: 'start' }) +
      NUM(22, 232, 3, BL) + T(38, 237, 'ผ่านตัวกรองได้ (MAC Spoofing)', { s: 13, a: 'start' }) +
      T(10, 268, 'แต่ถ้าใช้ WPA2/WPA3 ยังต้องรู้รหัสผ่าน', { s: 13, a: 'start', w: 1, c: GR }) +
      TL(10, 292, ['เครื่องที่สุ่ม MAC (Random MAC) ต้องปิด', 'การสุ่มก่อน จึงจะตรงกับรายการอนุญาต'], { c: MU }) };
    const rows = [
      ['ซ่อน SSID', 'กัน: คนทั่วไปไม่เห็นชื่อในรายการ', 'ไม่กัน: ผู้ดักฟังที่อ่าน Probe', OR],
      ['MAC Filtering', 'กัน: เครื่องที่ไม่ได้ลงทะเบียน', 'ไม่กัน: การปลอม MAC', OR],
      ['WPA2-Personal (AES-CCMP)', 'เข้ารหัสข้อมูล ต้องรู้รหัสผ่านจึงเข้าได้', 'ระวัง: รหัสสั้นถูกเดาแบบออฟไลน์ได้', GR],
      ['WPA3-Personal (SAE)', 'เข้ารหัสเหมือนกัน และกันการเดา', 'รหัสผ่านแบบออฟไลน์จาก Handshake', GR]];
    const pC = { t: 'สิ่งที่ป้องกันได้จริง', c: GR, h: 320, b:
      rows.map((r, i) => { const y = 40 + i * 68; return R(10, y, 290, 62, { st: r[3], sw: 2 }) + T(20, y + 19, r[0], { s: 13, w: 1, a: 'start' }) + T(20, y + 37, r[1], { s: 13, a: 'start' }) + T(20, y + 55, r[2], { s: 13, a: 'start', c: MU }); }).join('') };
    NL_FIG('diagram', 'ssid-mac-exposed', dual('ssid-mac-exposed',
      'ทำไมการซ่อน SSID และ MAC Filtering จึงป้องกันได้น้อย. การซ่อน SSID: AP ส่ง Beacon ที่ช่อง SSID ว่างราวทุก 0.1 วินาที แต่เมื่อมือถือเชื่อมต่อ จะส่ง Probe Request ที่มีชื่อ SHOP-STAFF AP ตอบ Probe Response และมือถือส่ง Association Request ที่มีชื่อเดียวกัน เฟรมเหล่านี้ไม่เข้ารหัส ตัวดักฟังจึงอ่านชื่อได้ และเครื่องที่เคยต่อจะถามหาชื่อนี้แม้อยู่นอกบ้าน. MAC Filtering: เฟรม 802.11 มีส่วนหัว MAC ที่ไม่เข้ารหัสเสมอ ส่วนข้อมูลที่เข้ารหัส และ FCS ในส่วนหัวมี Addr2 ผู้ส่ง 3C:52:82:1A:9F:07 ผู้บุกรุกดักอ่าน แล้วตั้ง MAC การ์ดตัวเองให้ตรงกันเพื่อผ่านตัวกรอง แต่ถ้าใช้ WPA2 หรือ WPA3 ยังต้องรู้รหัสผ่าน. สิ่งที่ป้องกันได้จริง: WPA2-Personal AES-CCMP เข้ารหัสข้อมูลแต่รหัสสั้นถูกเดาแบบออฟไลน์ได้ WPA3-Personal SAE กันการเดารหัสผ่านแบบออฟไลน์จาก Handshake',
      [pA, pB, pC]));
  })();

  /* ===================================================================
     diagram unc-anatomy (w9 s3): parts of a UNC path, Map Network Drive dialog, the same with net use
     =================================================================== */
  (function () {
    const CW = 7.8, X0 = 18; // JetBrains Mono advance = 0.6em at 13px
    const parts = [['\\\\', INK, 'บอกว่าเป็นที่อยู่ในเครือข่าย'], ['LAB-PC07', BL, 'ชื่อเครื่อง (หรือใช้ IP แทน)'], ['\\', MU, ''], ['homework', OR, 'ชื่อแชร์ที่เจ้าของเครื่องตั้ง'],
      ['\\', MU, ''], ['m5-1', GR, 'โฟลเดอร์ย่อยภายในแชร์'], ['\\', MU, ''], ['std07.docx', BR, 'ไฟล์ปลายทาง']];
    let pos = 0, under = '';
    const spans = parts.map(p => { const x = X0 + pos * CW; if (p[2]) under += L(x + 1, 70, x + p[0].length * CW - 1, 70, { c: p[1], sw: 3.4 }); pos += p[0].length; return `<tspan fill="${p[1]}">${esc(p[0])}</tspan>`; }).join('');
    const legend = parts.filter(p => p[2]).map((p, i) => T(18, 98 + i * 21, p[0], { s: 13, m: 1, w: 1, a: 'start', c: p[1] }) + T(112, 98 + i * 21, p[2], { s: 13, a: 'start' })).join('');
    const pA = { t: 'อ่าน UNC path ทีละส่วน', c: BL, h: 398, b:
      R(10, 40, 290, 40, { f: FLD }) + `<text x="${X0}" y="63" font-size="13" font-weight="700" font-family="${MONO}" text-anchor="start">${spans}</text>` + under + legend +
      R(10, 202, 290, 46, { f: FLD }) + TL(20, 220, ['บนเครื่องจริง แชร์ homework อาจอยู่ที่', 'D:\\Teacher\\HW ผู้ใช้ไม่ต้องรู้ที่อยู่นี้'], { lh: 18 }) +
      T(10, 274, '\\\\LAB-PC07 อย่างเดียว = ดูรายการแชร์', { s: 13, a: 'start' }) +
      T(10, 294, 'แชร์ที่ชื่อลงท้าย $ เช่น C$ เป็นแชร์ซ่อน', { s: 13, a: 'start', c: MU }) +
      R(10, 310, 290, 76, { f: OR, fo: 0.08, st: OR, d: '5 3' }) +
      TL(20, 330, ['\\\\LAB-PC07 เปิดไม่ได้', 'แต่ \\\\192.168.20.57 เปิดได้', '= ปัญหาการแปลงชื่อ ไม่ใช่ที่การแชร์'], { lh: 19 }) };
    const pB = { t: 'Map network drive', c: GR, h: 398, b:
      R(10, 40, 290, 206, { st: INK, sw: 1.4, rx: 6 }) + R(10, 40, 290, 26, { f: FLD, st: INK, sw: 1.4, rx: 6 }) + T(20, 58, 'Map Network Drive', { s: 13, w: 1, a: 'start' }) +
      T(22, 95, 'Drive:', { s: 13, a: 'start' }) + R(80, 78, 70, 24, { f: FLD, rx: 3 }) + T(88, 95, 'Z:', { s: 13, m: 1, a: 'start' }) +
      `<path d="M134,87 l5,6 l5,-6 z" fill="${INK}"/>` +
      T(22, 129, 'Folder:', { s: 13, a: 'start' }) + R(80, 112, 210, 24, { f: FLD, rx: 3 }) + T(86, 129, '\\\\LAB-PC07\\homework', { s: 13, m: 1, a: 'start' }) +
      R(22, 150, 14, 14, { rx: 2, f: GR, st: GR }) + `<path d="M25,157 l3,4 l6,-8" fill="none" stroke="var(--panel)" stroke-width="2"/>` + T(44, 162, 'Reconnect at sign-in', { s: 13, a: 'start' }) +
      R(22, 176, 14, 14, { rx: 2 }) + T(44, 188, 'Connect using different credentials', { s: 13, a: 'start' }) +
      BOX(150, 206, 64, 28, 'Finish', '', { s: 13 }) + BOX(222, 206, 70, 28, 'Cancel', '', { s: 13 }) +
      T(10, 272, 'ผลใน This PC → Network locations', { s: 13, a: 'start', w: 1 }) +
      R(10, 282, 290, 32, { f: FLD }) + T(20, 303, 'homework (\\\\LAB-PC07) (Z:)', { s: 13, m: 1, a: 'start' }) +
      TL(10, 340, ['Reconnect at sign-in = ไดรฟ์กลับมาทุกครั้ง', 'ที่ล็อกอิน (เทียบกับ /persistent:yes)']) };
    const TB = 'var(--term-bg)', TI = 'var(--term-ink)', TD = 'var(--term-dim)';
    const term = [['C:\\>net use Z: \\\\LAB-PC07\\homework', 1], ['     /persistent:yes', 1], ['The command completed successfully.'], [''],
      ['C:\\>net use', 1], ['New connections will be remembered.'], [''], ['Status  Local  Remote', 2], ['-----------------------------', 2],
      ['OK      Z:     \\\\LAB-PC07\\homework'], ['The command completed successfully.'], [''], ['C:\\>net use Z: /delete', 1], ['Z: was deleted successfully.']];
    const pC = { t: 'ทำแบบเดียวกันด้วยคำสั่ง net use', c: MU, h: 384, b:
      R(10, 40, 290, 270, { f: TB, st: TB }) +
      term.map((l, i) => l[0] ? T(18, 60 + i * 18, l[0], { s: 13, m: 1, a: 'start', sp: 1, w: l[1] === 1, c: l[1] === 2 ? TD : TI }) : '').join('') +
      TL(10, 332, ['คำสั่งแรกพิมพ์ต่อกันในบรรทัดเดียว ภาพนี้ตัด', 'ขึ้นบรรทัดใหม่ และตัดคอลัมน์ Network ออก'], { c: MU }) };
    NL_FIG('diagram', 'unc-anatomy', dual('unc-anatomy',
      'ส่วนประกอบของ UNC path และการ Map network drive. UNC path \\\\LAB-PC07\\homework\\m5-1\\std07.docx แยกเป็น \\\\ บอกว่าเป็นที่อยู่ในเครือข่าย, LAB-PC07 ชื่อเครื่องหรือใช้ IP แทน, homework ชื่อแชร์, m5-1 โฟลเดอร์ย่อยในแชร์ และ std07.docx ไฟล์ บนเครื่องจริงแชร์ homework อาจอยู่ที่ D:\\Teacher\\HW พิมพ์ \\\\LAB-PC07 อย่างเดียวจะเห็นรายการแชร์ แชร์ที่ลงท้าย $ เป็นแชร์ซ่อน ถ้าชื่อเปิดไม่ได้แต่ IP 192.168.20.57 เปิดได้ แสดงว่าปัญหาอยู่ที่การแปลงชื่อ. หน้าต่าง Map Network Drive เลือก Drive Z: ช่อง Folder พิมพ์ \\\\LAB-PC07\\homework ติ๊ก Reconnect at sign-in แล้วกด Finish ใน This PC จะเห็น homework (\\\\LAB-PC07) (Z:). คำสั่งเทียบเท่า net use Z: \\\\LAB-PC07\\homework /persistent:yes, net use แสดง OK Z: \\\\LAB-PC07\\homework และ net use Z: /delete ยกเลิก',
      [pA, pB, pC]));
  })();

  /* ===================================================================
     diagram remote-access-paths (w14 s5): exposed RDP vs VPN first vs relay tools, protocol/port table
     =================================================================== */
  (function () {
    const pA = { t: 'อันตราย: เปิด 3389 สู่อินเทอร์เน็ต', c: BAD, h: 214, b:
      BOX(10, 44, 86, 48, 'บอทสแกน', 'ทั่วโลก', { s: 13, st: BAD }) + BOX(112, 44, 86, 48, 'Router', 'ส่งต่อ 3389', { s: 13 }) + BOX(214, 44, 86, 48, 'PC ในร้าน', 'RDP เปิดอยู่', { s: 13 }) +
      A([[97, 68], [111, 68]], { c: BAD, sw: 2.4 }) + A([[199, 68], [213, 68]], { c: BAD, sw: 2.4 }) +
      T(155, 116, 'TCP 3389 รับจากใครก็ได้', { s: 13, w: 1, c: BAD }) +
      TL(10, 142, ['ถูกสแกนและเดารหัสผ่านอัตโนมัติตลอดเวลา', 'ช่องโหว่ที่โจมตีได้ก่อนล็อกอิน เช่น', 'BlueKeep (ปี 2019) บน Windows รุ่นเก่า', 'เครื่องถูกยึดแล้ว ผู้บุกรุกเข้าถึง LAN ได้']) };
    const pB = { t: 'ดีกว่า: เข้า VPN ก่อน แล้วค่อย RDP/SSH', c: GR, h: 312, b:
      BOX(10, 44, 90, 48, 'ช่างที่บ้าน', 'VPN + MFA', { s: 13 }) +
      R(100, 56, 86, 24, { f: GR, fo: 0.18, st: GR, rx: 12 }) + T(143, 73, 'อุโมงค์ VPN', { s: 13 }) +
      BOX(186, 44, 114, 48, 'VPN Gateway', 'Firewall', { s: 13, st: GR, sw: 2.4 }) +
      A([[243, 92], [243, 128]], { c: GR, sw: 2.4 }) + A([[200, 92], [200, 110], [140, 110], [140, 206], [148, 206]], { c: GR, sw: 2.4 }) +
      BOX(150, 130, 150, 46, 'PC Windows', 'RDP 3389 + NLA', { s: 13 }) + BOX(150, 184, 150, 46, 'Linux Server', 'SSH 22 + กุญแจ', { s: 13 }) +
      TL(10, 146, ['Firewall ให้', '3389 และ 22', 'รับเฉพาะจาก', 'วง VPN'], { c: MU, lh: 18 }) +
      TL(10, 256, ['RDP: เปิด NLA ยืนยันตัวตนก่อนเปิดหน้าจอ', 'SSH: ใช้กุญแจแทนรหัสผ่าน ปิดล็อกอิน root', 'ทุกบัญชีเปิด MFA และใช้รหัสผ่านยาว']) };
    const pC = { t: 'TeamViewer, AnyDesk, Quick Assist', c: BL, h: 312, b:
      BOX(95, 42, 120, 48, 'เซิร์ฟเวอร์กลาง', 'ของผู้ให้บริการ', { s: 13, st: BL, sw: 2.4 }) +
      A([[60, 130], [60, 66], [93, 66]], { c: BL, sw: 2.4 }) + A([[250, 130], [250, 66], [217, 66]], { c: BL, sw: 2.4 }) +
      T(155, 116, 'ทั้งสองฝั่งเชื่อมต่อออก', { s: 13 }) +
      BOX(10, 132, 110, 46, 'ช่าง', 'กรอก ID ปลายทาง', { s: 13 }) + BOX(190, 132, 110, 46, 'ผู้ใช้', 'กด Accept', { s: 13 }) +
      TL(10, 202, ['ไม่ต้องเปิดพอร์ตขาเข้าที่เราเตอร์', 'ภัยหลัก: มิจฉาชีพหลอกให้บอก ID และกดยอมรับ', 'ป้องกัน: ยอมรับเฉพาะคนที่ยืนยันตัวตนแล้ว,', 'เปิด 2FA, ปิด Unattended Access ถ้าไม่ใช้,', 'อัปเดตโปรแกรม, ใช้เฉพาะที่ฝ่ายไอทีอนุมัติ']) };
    const rows = [['RDP  TCP/UDP 3389', 'หน้าจอ Windows เครื่องปลายทางต้องเป็น', 'Pro ขึ้นไป (Home เป็นฝั่งเรียกใช้ได้อย่างเดียว)'],
      ['SSH  TCP 22', 'บรรทัดคำสั่ง Linux และอุปกรณ์เครือข่าย', 'เข้ารหัสตลอดการเชื่อมต่อ'],
      ['VNC  TCP 5900 (+ เลขจอ)', 'หน้าจอข้ามระบบ รหัสผ่าน VNC แบบเดิม', 'ยาวได้ 8 ตัว ควรใช้ผ่าน VPN หรือ SSH'],
      ['โปรแกรมผ่านเซิร์ฟเวอร์กลาง', 'เชื่อมออกไปยังเซิร์ฟเวอร์ผู้ให้บริการ', 'ปลอดภัยแค่ไหนขึ้นกับการยืนยันตัวตน']];
    const pD = { t: 'เทียบช่องทางและพอร์ต', c: MU, h: 312, b:
      rows.map((r, i) => { const y = 40 + i * 67; return R(10, y, 290, 61, { f: FLD }) + T(20, y + 19, r[0], { s: 13, w: 1, a: 'start' }) + T(20, y + 37, r[1], { s: 13, a: 'start' }) + T(20, y + 54, r[2], { s: 13, a: 'start', c: MU }); }).join('') };
    NL_FIG('diagram', 'remote-access-paths', dual('remote-access-paths',
      'ช่องทางควบคุมระยะไกลและการป้องกัน. อันตราย: บอทสแกนทั่วโลกเข้ามาทาง Router ที่ส่งต่อพอร์ต TCP 3389 ถึง PC ที่เปิด RDP ถูกเดารหัสผ่านตลอดเวลาและเสี่ยงช่องโหว่ที่โจมตีก่อนล็อกอินได้ เช่น BlueKeep ปี 2019. ทางที่ดีกว่า: ช่างที่บ้านเข้า VPN พร้อม MFA ผ่านอุโมงค์ VPN ถึง VPN Gateway และ Firewall แล้วจึงใช้ RDP 3389 ที่เปิด NLA ไปยัง PC Windows หรือ SSH 22 ด้วยกุญแจไปยัง Linux Server โดย Firewall รับ 3389 และ 22 เฉพาะจากวง VPN. TeamViewer, AnyDesk, Quick Assist: ช่างและผู้ใช้ต่างเชื่อมต่อออกไปยังเซิร์ฟเวอร์กลางของผู้ให้บริการ ไม่ต้องเปิดพอร์ตขาเข้า ช่างกรอก ID ผู้ใช้กด Accept ภัยหลักคือมิจฉาชีพหลอกให้บอก ID. ตารางเทียบ: RDP TCP/UDP 3389 ปลายทางต้องเป็น Windows Pro ขึ้นไป, SSH TCP 22 เข้ารหัสตลอด, VNC TCP 5900 บวกเลขจอ รหัสผ่านแบบเดิม 8 ตัว ควรใช้ผ่าน VPN หรือ SSH, โปรแกรมผ่านเซิร์ฟเวอร์กลางเชื่อมออก',
      [pA, pB, pC, pD]));
  })();

  /* ===================================================================
     diagram nos-lineage (w11 s2): where each NOS comes from (years, owners) and which job each fits
     =================================================================== */
  (function () {
    const chain = (items, c) => items.map((it, i) => {
      const y = 40 + i * 58;
      return BOX(30, y, 250, 46, it[0], it[1], { s: 14, st: i === items.length - 1 ? c : undefined, sw: i === items.length - 1 ? 2.4 : undefined }) +
        (i < items.length - 1 ? A([[155, y + 47], [155, y + 57]], { c: c, sw: 2.4 }) : '');
    }).join('');
    const pU = { t: 'ตระกูล UNIX → Solaris', c: BL, h: 330, b:
      chain([['1969 UNIX', 'Bell Labs ของ AT&T'], ['1982 SunOS', 'Sun Microsystems (ฐาน BSD)'], ['1992 Solaris 2', 'SunOS 5 เปลี่ยนมาฐาน System V'], ['2010 Oracle Solaris', 'Oracle ซื้อกิจการ Sun']], BL) +
      TL(10, 290, ['เสถียรสูง ระบบไฟล์ ZFS ทำงานบน SPARC/x86', 'ใช้ในองค์กรใหญ่ ธนาคาร โทรคมนาคม']) };
    const pL = { t: 'Linux: คล้าย UNIX แต่เขียนใหม่', c: GR, h: 330, b:
      BOX(30, 40, 250, 46, '1991 Linux kernel', 'Linus Torvalds เปิดซอร์ส', { s: 14 }) + A([[155, 87], [155, 97]], { c: GR, sw: 2.4 }) +
      BOX(30, 98, 250, 46, 'Distribution', 'kernel + โปรแกรมอื่นรวมเป็นชุด', { s: 14 }) + A([[155, 145], [155, 157]], { c: GR, sw: 2.4 }) +
      BOX(10, 158, 140, 34, 'Debian (1993)', '', { s: 13, st: GR }) + BOX(160, 158, 140, 34, 'RHEL (2002)', '', { s: 13, st: GR }) +
      BOX(10, 198, 140, 34, 'Ubuntu (2004)', '', { s: 13, st: GR }) + BOX(160, 198, 140, 34, 'Rocky (2021)', '', { s: 13, st: GR }) +
      TL(10, 258, ['ไม่ได้ใช้โค้ดของ UNIX เดิม แต่ทำงานคล้ายกัน', 'โอเพนซอร์ส นิยมที่สุดในเว็บเซิร์ฟเวอร์', 'และระบบคลาวด์']) };
    const pW = { t: 'Windows Server (สาย Windows NT)', c: OR, h: 300, b:
      chain([['1993 Windows NT 3.1', 'เคอร์เนลใหม่ของ Microsoft'], ['2000 Windows 2000 Server', 'เริ่มมี Active Directory'], ['2019 / 2022 / 2025', 'Edition หลัก Standard, Datacenter']], OR) +
      TL(10, 232, ['บริการ AD, DNS, DHCP, File, IIS, Hyper-V', 'ต้องมี License (มีรุ่น Evaluation ให้ทดลอง)', 'เข้ากับเครื่องลูกข่าย Windows ได้ดี']) };
    const pN = { t: 'NetWare (Novell)', c: MU, h: 300, b:
      chain([['1983 NetWare', 'File & Print เร็ว ใช้ IPX/SPX'], ['1993 NDS', 'บริการไดเรกทอรีใน NetWare 4'], ['เลิกพัฒนาแล้ว', 'องค์กรย้ายไปใช้ NOS อื่น']], BAD) +
      TL(10, 232, ['เป็นต้นแบบแนวคิดเซิร์ฟเวอร์ไฟล์', 'และบริการไดเรกทอรีของยุคต่อมา']) };
    const jobs = [['ล็อกอินบัญชีเดียวหลายร้อยคน แชร์ไฟล์', 'Windows Server + Active Directory', OR], ['เว็บไซต์และระบบนัดหมายออนไลน์', 'Linux (เช่น Ubuntu Server)', GR], ['ระบบเดิมบน UNIX ขององค์กรใหญ่', 'Oracle Solaris', BL]];
    const pJ = { t: 'เลือก NOS ตามงาน: โรงพยาบาลตัวอย่าง', c: BR, h: 250, b:
      jobs.map((j, i) => { const y = 40 + i * 60; return R(10, y, 290, 54, { st: j[2], sw: 2 }) + T(20, y + 21, j[0], { s: 13, a: 'start' }) + T(20, y + 42, '→ ' + j[1], { s: 13, a: 'start', w: 1 }); }).join('') +
      T(10, 236, 'องค์กรจริงมักใช้หลาย NOS ร่วมกัน', { s: 13, a: 'start', w: 1, c: BR }) };
    NL_FIG('diagram', 'nos-lineage', dual('nos-lineage',
      'ที่มาของ NOS แต่ละตระกูลและงานที่เหมาะ. ตระกูล UNIX: 1969 UNIX ที่ Bell Labs ของ AT&T, 1982 SunOS ของ Sun Microsystems บนฐาน BSD, 1992 Solaris 2 คือ SunOS 5 บนฐาน System V, 2010 Oracle ซื้อ Sun เป็น Oracle Solaris เด่นเรื่องเสถียรและ ZFS. Linux: 1991 Linus Torvalds เปิดซอร์ส Linux kernel รวมกับโปรแกรมอื่นเป็น Distribution เช่น Debian 1993, RHEL 2002, Ubuntu 2004, Rocky 2021 ไม่ใช้โค้ด UNIX เดิมแต่ทำงานคล้ายกัน นิยมที่สุดในเว็บเซิร์ฟเวอร์และคลาวด์. Windows Server: 1993 Windows NT 3.1, 2000 Windows 2000 Server เริ่มมี Active Directory, รุ่นปัจจุบัน 2019 2022 2025 Edition Standard และ Datacenter ต้องมี License. NetWare ของ Novell: 1983 File & Print บน IPX/SPX, 1993 NDS ใน NetWare 4, เลิกพัฒนาแล้ว. เลือกตามงาน: ล็อกอินบัญชีเดียวหลายร้อยคนและแชร์ไฟล์ใช้ Windows Server กับ Active Directory, เว็บไซต์และระบบนัดหมายใช้ Linux, ระบบเดิมบน UNIX ใช้ Oracle Solaris องค์กรจริงมักใช้หลาย NOS ร่วมกัน',
      [pU, pL, pW, pN, pJ]));
  })();

  /* ===================================================================
     diagram vbox-vmware-map (w11 s5): products by hypervisor type and host OS, files of one VM, guest add-ons
     =================================================================== */
  (function () {
    const host = [['Windows', 'VirtualBox, Workstation Pro'], ['Linux', 'VirtualBox, Workstation Pro'], ['macOS', 'VirtualBox, Fusion']];
    const pA = { t: 'ผลิตภัณฑ์ตามชนิด Hypervisor', c: BL, h: 286, b:
      T(10, 52, 'Type 2: ติดตั้งบนระบบปฏิบัติการเดิม (Host)', { s: 13, w: 1, a: 'start' }) +
      R(10, 62, 290, 76, { f: FLD }) + T(20, 80, 'Host OS', { s: 13, a: 'start', c: MU }) + T(100, 80, 'โปรแกรม', { s: 13, a: 'start', c: MU }) +
      host.map((h, i) => T(20, 99 + i * 17, h[0], { s: 13, a: 'start', w: 1 }) + T(100, 99 + i * 17, h[1], { s: 13, a: 'start' })).join('') +
      T(10, 162, 'Type 1: ติดตั้งบนเครื่องเปล่า (Bare-metal)', { s: 13, w: 1, a: 'start' }) +
      R(10, 172, 290, 48, { f: FLD, st: BL }) + T(20, 192, 'VMware ESXi', { s: 14, w: 1, a: 'start' }) + T(20, 211, 'จัดการหลายเครื่องด้วย vCenter (vSphere)', { s: 13, a: 'start', c: MU }) +
      TL(10, 244, ['Workstation Pro และ Fusion เป็นของ VMware', 'VirtualBox (Oracle) ไม่มีรุ่น Type 1']) };
    const vb = [['Ubuntu.vbox', 'ค่าตั้งเครื่อง (XML)'], ['Ubuntu.vdi', 'ดิสก์เสมือน'], ['Snapshots\\', 'ข้อมูล Snapshot'], ['Logs\\', 'บันทึกการทำงาน']];
    const vm = [['Ubuntu.vmx', 'ค่าตั้งเครื่อง'], ['Ubuntu.vmdk', 'ดิสก์เสมือน'], ['Ubuntu.nvram', 'ค่า BIOS/UEFI'], ['vmware.log', 'บันทึกการทำงาน']];
    const files = (y, rows) => rows.map((r, i) => T(24, y + i * 19, r[0], { s: 13, m: 1, a: 'start' }) + T(140, y + i * 19, r[1], { s: 13, a: 'start', c: MU })).join('');
    const pB = { t: 'ไฟล์ของเครื่องจำลองหนึ่งเครื่อง', c: GR, h: 340, b:
      T(10, 52, 'VirtualBox', { s: 14, w: 1, a: 'start' }) + T(10, 72, 'VirtualBox VMs\\Ubuntu\\', { s: 13, m: 1, a: 'start', c: GR }) + files(94, vb) +
      T(10, 182, 'VMware Workstation', { s: 14, w: 1, a: 'start' }) + T(10, 202, 'Documents\\Virtual Machines\\Ubuntu\\', { s: 13, m: 1, a: 'start', c: GR }) + files(224, vm) +
      T(10, 308, 'ย้ายเครื่องจำลอง = คัดลอกทั้งโฟลเดอร์', { s: 13, a: 'start', w: 1 }) + T(10, 327, 'หรือ Export เป็นไฟล์ .ova', { s: 13, a: 'start', c: MU }) };
    const pC = { t: 'ส่วนเสริมที่ติดตั้งใน Guest', c: OR, h: 386, b:
      R(10, 40, 290, 150, { f: FLD }) + T(20, 58, 'Host: Windows + VirtualBox/VMware', { s: 13, w: 1, a: 'start' }) +
      R(30, 68, 250, 110, { st: OR, sw: 2 }) + T(155, 88, 'Guest: Ubuntu', { s: 14, w: 1 }) +
      R(46, 98, 218, 66, { f: OR, fo: 0.12, st: OR }) + T(155, 124, 'Guest Additions (VirtualBox)', { s: 13, w: 1 }) + T(155, 148, 'VMware Tools (VMware)', { s: 13, w: 1 }) +
      T(10, 214, 'ได้ความสามารถเพิ่ม:', { s: 13, a: 'start', w: 1 }) +
      TL(10, 234, ['ปรับขนาดจอตามหน้าต่างอัตโนมัติ', 'แชร์โฟลเดอร์ระหว่าง Host กับ Guest', 'คัดลอกข้อความข้ามเครื่อง (Clipboard)', 'เมาส์เลื่อนเข้าออกลื่น ไดรเวอร์จอดีขึ้น']) +
      TL(10, 318, ['VirtualBox: Devices → Insert Guest', 'Additions CD image...', 'VMware: VM → Install VMware Tools...', 'Guest Linux บน VMware ใช้แพ็กเกจ open-vm-tools'], { lh: 18, c: MU }) };
    NL_FIG('diagram', 'vbox-vmware-map', dual('vbox-vmware-map',
      'เทียบ VirtualBox กับ VMware. ผลิตภัณฑ์ Type 2 ติดตั้งบน Host OS: Windows ใช้ VirtualBox หรือ VMware Workstation Pro, Linux ใช้ VirtualBox หรือ Workstation Pro, macOS ใช้ VirtualBox หรือ VMware Fusion. Type 1 ติดตั้งบนเครื่องเปล่า: VMware ESXi จัดการหลายเครื่องด้วย vCenter (vSphere) VirtualBox ไม่มีรุ่น Type 1. ไฟล์ของเครื่องจำลอง: VirtualBox อยู่ในโฟลเดอร์ VirtualBox VMs มี Ubuntu.vbox ค่าตั้งเครื่องแบบ XML, Ubuntu.vdi ดิสก์เสมือน, โฟลเดอร์ Snapshots และ Logs ส่วน VMware Workstation อยู่ใน Documents\\Virtual Machines มี Ubuntu.vmx ค่าตั้งเครื่อง, Ubuntu.vmdk ดิสก์, Ubuntu.nvram ค่า BIOS/UEFI และ vmware.log ย้ายเครื่องได้โดยคัดลอกทั้งโฟลเดอร์หรือ Export เป็น .ova. ส่วนเสริมติดตั้งใน Guest: Guest Additions ของ VirtualBox และ VMware Tools ของ VMware ช่วยปรับขนาดจอ แชร์โฟลเดอร์ คัดลอกข้อความข้ามเครื่อง และเมาส์ลื่น ติดตั้งจากเมนู Devices, Insert Guest Additions CD image หรือ VM, Install VMware Tools ส่วน Guest Linux บน VMware ใช้แพ็กเกจ open-vm-tools',
      [pA, pB, pC]));
  })();

  /* ---------- DOM helpers for the widgets ---------- */
  const WCSS = `
.nlfj .nlfj-mail{border:1px solid var(--line);border-radius:10px;background:var(--panel);overflow:hidden;margin:8px 0}
.nlfj .nlfj-mhead{background:var(--field);padding:6px 10px;border-bottom:1px solid var(--line)}
.nlfj .nlfj-mbody{padding:8px 10px}
.nlfj .nlfj-row{display:flex;gap:4px 8px;align-items:center;flex-wrap:wrap;margin:1px 0;min-width:0}
.nlfj .nlfj-row>b{min-width:52px;color:var(--muted);font-weight:600;font-size:14px}
.nlfj .nlfj-spot{font:inherit;font-size:15px;color:inherit;background:transparent;border:2px dashed transparent;border-radius:6px;padding:3px 6px;text-align:left;cursor:pointer;min-height:36px;max-width:100%;overflow-wrap:anywhere;display:inline-flex;align-items:center;gap:6px}
.nlfj .nlfj-spot:hover{border-color:var(--blue)}
.nlfj .nlfj-spot.nlfj-f{border:2px solid var(--bad);background:color-mix(in srgb,var(--bad) 10%,transparent)}
.nlfj .nlfj-spot.nlfj-d{border:2px solid var(--line);background:var(--field)}
.nlfj .nlfj-blk{display:flex;width:100%;margin:3px 0}
.nlfj .nlfj-badge{display:inline-flex;align-items:center;justify-content:center;flex:none;background:var(--bad);color:var(--panel);border-radius:999px;min-width:22px;height:22px;font-size:13px;font-weight:700}
.nlfj .nlfj-badge.nlfj-g{background:var(--muted)}
.nlfj .nlfj-badge[hidden]{display:none}
.nlfj .nlfj-logo{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:17px;color:var(--blue)}
.nlfj .nlfj-logo i{display:inline-block;width:22px;height:22px;border-radius:5px;background:var(--blue)}
.nlfj .nlfj-link{color:var(--blue);text-decoration:underline;font-family:"JetBrains Mono",Consolas,monospace;font-size:14px}
.nlfj .nlfj-att{font-family:"JetBrains Mono",Consolas,monospace;font-size:14px}
.nlfj .nlfj-status{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;background:var(--field);border-top:1px solid var(--line);padding:5px 10px;overflow-wrap:anywhere;min-height:30px}
.nlfj .nlfj-status:empty::before{content:"วางเมาส์หรือโฟกัสที่ลิงก์เพื่อดูปลายทางจริง";color:var(--muted);font-family:inherit}
.nlfj .nlfj-term{white-space:pre;overflow:auto;max-height:360px;font-family:"JetBrains Mono",Consolas,monospace;font-size:12.5px;line-height:1.5;background:var(--term-bg);color:var(--term-ink);border-radius:8px;padding:10px 12px;margin:8px 0;tab-size:8}
.nlfj .nlfj-term .nlfj-c{font-weight:700}
.nlfj .nlfj-term .nlfj-n{color:var(--term-dim);white-space:pre-wrap}
.nlfj .nlfj-term mark{background:color-mix(in srgb,var(--orange) 45%,transparent);color:inherit;border-radius:2px}
.nlfj .nlfj-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.nlfj .nlfj-chip{border:1px solid var(--line);border-left:4px solid var(--blue);border-radius:8px;padding:4px 8px;background:var(--field);font-size:14px;max-width:100%;overflow-wrap:anywhere}
.nlfj .nlfj-chip code{font-weight:700;border:0;background:none;padding:0}
.nlfj .nlfj-chip small{display:block;color:var(--muted);font-size:13px}
.nlfj .nlfj-chip.nlfj-warn{border-left-color:var(--orange)}
.nlfj .nlfj-chip.nlfj-bad{border-left-color:var(--bad)}
.nlfj .nlfj-cmd{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}
.nlfj .nlfj-cmd .nlfj-pr{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;color:var(--muted)}
.nlfj .nlfj-cmd input{flex:1 1 200px;min-width:0;font-family:"JetBrains Mono",Consolas,monospace}
.nlfj .nlfj-ex{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.nlfj .nlfj-ex .nlw-btn{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;min-height:40px}
.nlfj .nlfj-out{font-family:"JetBrains Mono",Consolas,monospace;font-size:13.5px;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:4px 0;overflow-wrap:anywhere}
.nlfj .nlfj-msgs{list-style:none;padding:0;margin:6px 0}
.nlfj .nlfj-msgs li{border-left:4px solid var(--line);padding:5px 10px;margin:5px 0;background:var(--field);border-radius:0 6px 6px 0;font-size:14.5px}
.nlfj .nlfj-msgs li.nlfj-y{border-left-color:var(--ok)}.nlfj .nlfj-msgs li.nlfj-w{border-left-color:var(--orange)}.nlfj .nlfj-msgs li.nlfj-x{border-left-color:var(--bad)}
.nlfj .nlw-btn{min-height:40px}
@media (pointer:coarse){.nlfj .nlw-btn{min-height:44px}}
`;
  function injectW() {
    if (!document.getElementById('nl-widget-css')) {
      const base = window.NL_WIDGETS && window.NL_WIDGETS['caesar'];
      if (typeof base === 'function') { try { base(document.createElement('div')); } catch (e) { /* base styles optional */ } }
    }
    if (document.getElementById('nlfj-wcss')) return;
    const st = document.createElement('style'); st.id = 'nlfj-wcss'; st.textContent = WCSS;
    (document.head || document.documentElement).appendChild(st);
  }
  const PROPS = { value: 1, checked: 1, disabled: 1 };
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (PROPS[k]) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c == null || c === false) return; if (Array.isArray(c)) { c.forEach(x => add(e, x)); return; } e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); }
  function wframe(root, name, title, instr) {
    injectW();
    root.replaceChildren();
    root.classList.add('nlw', 'nlfj');
    root.setAttribute('data-fig', name);
    root.appendChild(h('div', { class: 'nlw-title' }, title));
    root.appendChild(h('p', { class: 'nlw-instr' }, h('b', null, 'คำแนะนำการใช้งาน: '), instr));
    return root;
  }
  const result = (kind, ...c) => h('div', { class: 'nlw-result nlw-is-' + kind }, ...c);

  /* ===================================================================
     widget phish-spotter (w15 s4): find the red flags in a fictional phishing e-mail
     =================================================================== */
  NL_FIG('widget', 'phish-spotter', function (root) {
    wframe(root, 'phish-spotter', 'ฝึกจับพิรุธอีเมลฟิชชิง',
      'อีเมลนี้สร้างขึ้นเพื่อฝึก "ธนาคารสมมุติ" และโดเมน .example ไม่มีอยู่จริง กดหรือแตะส่วนที่น่าสงสัย อีเมลนี้มีจุดพิรุธ 6 จุด บางส่วนดูน่าเชื่อหรือดูน่ากลัวแต่ไม่ใช่หลักฐาน ใช้ปุ่ม Tab เลื่อนและ Enter เพื่อเลือกได้');
    const SP = {
      from: { flag: 1, title: 'โดเมนผู้ส่งสะกดคล้ายของจริง', text: 'ตัวที่ 2 ของ s0mmutbank เป็นเลขศูนย์ (0) ไม่ใช่ตัว o โดเมนของธนาคารสมมุติคือ sommutbank.example ชื่อที่แสดง "ธนาคารสมมุติ" ใครก็ตั้งได้ ต้องดูที่อยู่อีเมลจริงเสมอ' },
      to: { flag: 0, text: 'อีเมลส่งถึงที่อยู่ของเราเป็นเรื่องปกติ ทั้งอีเมลจริงและปลอม จึงใช้ตัดสินไม่ได้' },
      date: { flag: 0, text: 'วันเวลาที่ส่งดูปกติ ไม่ได้ช่วยบอกว่าอีเมลจริงหรือปลอม' },
      subject: { flag: 1, title: 'เร่งรีบและขู่ให้กลัว', text: 'คำว่า ด่วน และ "จะถูกระงับภายใน 24 ชั่วโมง" ทำให้รีบทำโดยไม่คิด ถ้าข้อความเร่งให้รีบ ให้หยุดและตรวจสอบเองผ่านช่องทางทางการก่อน' },
      logo: { flag: 0, text: 'โลโก้คัดลอกได้ง่าย โลโก้ที่ดูถูกต้องจึงพิสูจน์ไม่ได้ว่าอีเมลเป็นของจริง แต่ก็ไม่ใช่จุดพิรุธในตัวเอง' },
      greet: { flag: 1, title: 'ไม่ระบุชื่อผู้รับ', text: '"เรียน ลูกค้าผู้มีอุปการคุณ" แสดงว่าผู้ส่งไม่รู้ว่าเราเป็นใคร เพราะส่งข้อความเดียวกันถึงคนจำนวนมาก' },
      alert: { flag: 0, text: 'ข้อความแจ้งเตือนการเข้าสู่ระบบผิดปกติ หน่วยงานจริงก็ส่งได้ ตัวมันเองยังไม่ใช่หลักฐาน ต้องดูส่วนอื่นประกอบ' },
      ask: { flag: 1, title: 'ขอข้อมูลลับ', text: 'ขอรหัสผ่าน เลขบัตรประชาชน และรหัส OTP ผ่านลิงก์ หน่วยงานจริงไม่ขอข้อมูลเหล่านี้ทางอีเมล โดยเฉพาะ OTP ที่ไม่ควรบอกใครเลย' },
      link: { flag: 1, title: 'ข้อความลิงก์กับปลายทางจริงไม่ตรงกัน', text: 'ตัวลิงก์แสดง https://www.sommutbank.example/verify แต่ปลายทางจริงคือ http://sommutbank.example.login-verify.example/th ให้อ่านชื่อโดเมนจากขวาไปซ้าย โดเมนจริงคือ login-verify.example ไม่ใช่ของธนาคาร และไม่ใช่ https' },
      att: { flag: 1, title: 'ไฟล์แนบที่ไม่ได้คาดหวัง', text: 'ไฟล์บีบอัด .zip ที่ไม่ได้ขอ อาจซ่อนโปรแกรมอันตรายหรือไฟล์ที่ขอให้เปิดมาโคร ไม่ควรเปิด' },
      foot: { flag: 0, text: 'ข้อความลิขสิทธิ์ท้ายอีเมลคัดลอกได้ ถ้าจะติดต่อสอบถาม ให้ใช้เบอร์หรือแอปทางการที่หาเอง ไม่ใช้ช่องทางที่ให้มาในอีเมล' }
    };
    const NFLAG = Object.values(SP).filter(x => x.flag).length;
    const LINK_REAL = 'http://sommutbank.example.login-verify.example/th';
    let found = [], wrong = new Set(), revealed = false;
    const btn = {};
    const status = h('div', { class: 'nlfj-status', 'aria-live': 'polite' });
    const spot = (id, label, ...content) => {
      const b = h('button', { type: 'button', class: 'nlfj-spot', 'aria-pressed': 'false', 'aria-label': label, onclick: () => pick(id) }, h('span', { class: 'nlfj-badge', hidden: true }), ...content);
      btn[id] = b; return b;
    };
    const link = spot('link', 'ลิงก์ในอีเมล', h('span', { class: 'nlfj-link' }, 'https://www.sommutbank.example/verify'));
    const showReal = () => { status.textContent = 'ลิงก์จริงพาไปที่: ' + LINK_REAL; };
    const hideReal = () => { status.textContent = ''; };
    link.addEventListener('mouseenter', showReal); link.addEventListener('focus', showReal);
    link.addEventListener('mouseleave', hideReal); link.addEventListener('blur', hideReal);
    const blk = el => { el.classList.add('nlfj-blk'); return el; };
    const mail = h('div', { class: 'nlfj-mail' },
      h('div', { class: 'nlfj-mhead' },
        h('div', { class: 'nlfj-row' }, h('b', null, 'จาก:'), spot('from', 'ผู้ส่ง', 'ธนาคารสมมุติ <security@s0mmutbank.example>')),
        h('div', { class: 'nlfj-row' }, h('b', null, 'ถึง:'), spot('to', 'ผู้รับ', 'you@example.com')),
        h('div', { class: 'nlfj-row' }, h('b', null, 'วันที่:'), spot('date', 'วันที่ส่ง', '14 ต.ค. 2569 เวลา 08:12')),
        h('div', { class: 'nlfj-row' }, h('b', null, 'เรื่อง:'), spot('subject', 'หัวเรื่อง', h('strong', null, '[ด่วน] บัญชีของท่านจะถูกระงับภายใน 24 ชั่วโมง')))),
      h('div', { class: 'nlfj-mbody' },
        blk(spot('logo', 'โลโก้ธนาคาร', h('span', { class: 'nlfj-logo' }, h('i', { 'aria-hidden': 'true' }), 'ธนาคารสมมุติ'))),
        blk(spot('greet', 'คำขึ้นต้น', 'เรียน ลูกค้าผู้มีอุปการคุณ')),
        blk(spot('alert', 'ย่อหน้าแจ้งเตือน', 'ระบบตรวจพบการเข้าสู่ระบบที่ผิดปกติจากอุปกรณ์ที่ไม่รู้จัก')),
        blk(spot('ask', 'คำขอข้อมูล', 'กรุณายืนยันตัวตนทันที โดยกรอกเลขบัตรประชาชน รหัสผ่าน และรหัส OTP ที่ได้รับทาง SMS ที่ลิงก์ด้านล่าง')),
        blk(link),
        blk(spot('att', 'ไฟล์แนบ', h('span', { class: 'nlfj-att' }, 'ไฟล์แนบ: เอกสารยืนยันตัวตน.zip (2.1 MB)'))),
        blk(spot('foot', 'ข้อความท้ายอีเมล', h('small', null, 'สงวนลิขสิทธิ์ 2569 ธนาคารสมมุติ จำกัด (มหาชน)')))),
      status);
    const score = h('div', { class: 'nlw-result', 'aria-live': 'polite' });
    const fb = h('div', { 'aria-live': 'polite' });
    const list = h('ol', { class: 'nlfj-msgs' });
    function paint() {
      for (const id in btn) {
        const b = btn[id], bd = b.firstChild, i = found.indexOf(id);
        b.classList.toggle('nlfj-f', i >= 0);
        b.classList.toggle('nlfj-d', wrong.has(id));
        b.setAttribute('aria-pressed', String(i >= 0 || wrong.has(id)));
        if (i >= 0) { bd.hidden = false; bd.textContent = String(i + 1); bd.className = 'nlfj-badge'; }
        else if (wrong.has(id)) { bd.hidden = false; bd.textContent = '-'; bd.className = 'nlfj-badge nlfj-g'; }
        else bd.hidden = true;
      }
      const done = found.length === NFLAG;
      score.className = 'nlw-result nlw-is-' + (done ? 'ok' : 'warn');
      score.textContent = `พบจุดพิรุธแล้ว ${found.length}/${NFLAG} จุด · กดส่วนที่ไม่ใช่หลักฐาน ${wrong.size} ครั้ง` +
        (done ? (revealed ? ' (ดูเฉลยแล้ว)' : ' ครบแล้ว') + ' หลักจำ: หยุด ตรวจสอบเองผ่านช่องทางทางการ แล้วค่อยทำ และเปิด 2FA ไว้เสมอ' : '');
      list.replaceChildren(...found.map(id => h('li', { class: 'nlfj-x' }, h('b', null, SP[id].title + ': '), SP[id].text)));
    }
    function pick(id) {
      const s = SP[id];
      if (id === 'link') showReal();
      if (s.flag) {
        if (!found.includes(id)) found.push(id);
        fb.replaceChildren(result('bad', 'จุดพิรุธ: ' + s.title + ' ', h('span', { style: 'font-weight:400' }, s.text)));
      } else {
        wrong.add(id);
        fb.replaceChildren(result('warn', 'ส่วนนี้ไม่ใช่จุดพิรุธ ', h('span', { style: 'font-weight:400' }, s.text)));
      }
      paint();
    }
    const reveal = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { revealed = true; for (const id in SP) if (SP[id].flag && !found.includes(id)) found.push(id); fb.replaceChildren(); paint(); } }, 'เฉลยทั้งหมด');
    const reset = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { found = []; wrong = new Set(); revealed = false; fb.replaceChildren(); hideReal(); paint(); } }, 'เริ่มใหม่');
    root.append(mail, score, fb, h('div', { class: 'nlw-row' }, reveal, reset), list);
    paint();
    return { destroy() { root.replaceChildren(); } };
  });

  /* ===================================================================
     widget unc-check (w9 s3): type a path, see its parts, problems, and the matching net use / Map network drive result
     =================================================================== */
  const BADCH = /[\\/:*?"<>|]/;
  function ipv4(s) { const m = s.split('.'); return m.length === 4 && m.every(x => /^\d{1,3}$/.test(x) && +x <= 255); }
  function analyseUNC(raw) {
    const s = String(raw || '').trim(), R = { parts: [], err: [], warn: [], note: [], host: '', share: '', sub: [], file: '' };
    if (!s) { R.err.push('ยังไม่ได้พิมพ์อะไร ลองพิมพ์ เช่น \\\\LAB-PC07\\homework'); return R; }
    if (/^smb:\/\//i.test(s)) { R.err.push('smb:// เป็นรูปแบบที่ใช้ใน macOS และ Linux ใน Windows ให้เขียนเป็น ' + '\\\\' + s.slice(6).replace(/\//g, '\\')); return R; }
    if (/^(https?|ftp):\/\//i.test(s)) { R.err.push('นี่คือที่อยู่เว็บ (URL) ไม่ใช่โฟลเดอร์แชร์ของ Windows'); return R; }
    if (/^[A-Za-z]:/.test(s)) { R.err.push('นี่คือ path บนไดรฟ์ ' + s.slice(0, 2).toUpperCase() + ' (เช่นไดรฟ์ที่ Map ไว้แล้ว) ไม่ใช่ UNC path UNC ต้องขึ้นต้นด้วย \\\\ชื่อเครื่อง'); return R; }
    if (/^\/\//.test(s) || (/^\\\\/.test(s) === false && /\//.test(s) && !/\\/.test(s))) { R.err.push('UNC path เขียนด้วยเครื่องหมาย \\ (Backslash) ไม่ใช่ / ลองแก้เป็น ' + s.replace(/\//g, '\\').replace(/^\\*/, '\\\\')); return R; }
    if (/^\\\\\\/.test(s)) { R.err.push('ขึ้นต้นด้วย \\ เกิน 2 ตัว ต้องเป็น \\\\ พอดี'); return R; }
    if (/^\\[^\\]/.test(s)) { R.err.push('ขึ้นต้นด้วย \\ ตัวเดียว Windows จะตีความเป็นโฟลเดอร์บนไดรฟ์ปัจจุบัน ไม่ใช่เครื่องในเครือข่าย ต้องใช้ \\\\ สองตัว'); return R; }
    if (!/^\\\\/.test(s)) { R.err.push('UNC path ต้องขึ้นต้นด้วย \\\\ ตามด้วยชื่อเครื่อง เช่น \\\\' + s.replace(/\//g, '\\')); return R; }
    const rest = s.slice(2), comps = rest.split('\\');
    if (comps.length > 1 && comps[comps.length - 1] === '') { comps.pop(); R.note.push('ตัด \\ ตัวท้ายสุดออกได้ ไม่มีผลต่อความหมาย'); }
    if (comps.some(c => c === '')) { R.err.push('มี \\ ซ้อนกันกลาง path ทำให้มีส่วนที่ว่าง'); return R; }
    const host = comps[0]; R.host = host;
    R.parts.push(['\\\\', 'ขึ้นต้น UNC (ไปทางเครือข่าย)']);
    if (/^[\d.]+$/.test(host)) {
      if (!ipv4(host)) { R.err.push('IP ' + host + ' ไม่ถูกต้อง IPv4 ต้องมี 4 ส่วน แต่ละส่วน 0 ถึง 255'); return R; }
      R.parts.push([host, 'IP ของเครื่องปลายทาง']);
      R.note.push('ใช้ IP แทนชื่อได้ ถ้าใช้ชื่อแล้วเปิดไม่ได้แต่ใช้ IP ได้ แสดงว่าปัญหาอยู่ที่การแปลงชื่อ ไม่ใช่การแชร์');
    } else {
      if (/\s/.test(host) || BADCH.test(host)) { R.err.push('ชื่อเครื่อง "' + host + '" มีช่องว่างหรืออักขระต้องห้าม ชื่อเครื่องใช้ A-Z, 0-9 และขีดกลาง'); return R; }
      if (/^\d+$/.test(host)) { R.err.push('ชื่อเครื่องเป็นตัวเลขล้วนไม่ได้'); return R; }
      if (!/^[A-Za-z0-9.-]+$/.test(host)) R.warn.push('ชื่อเครื่อง "' + host + '" มีอักขระนอกเหนือ A-Z, 0-9, ขีดกลาง และจุด อาจหาเครื่องไม่เจอ');
      if (!host.includes('.') && host.length > 15) R.warn.push('ชื่อเครื่องยาวเกิน 15 ตัว ซึ่งเกินข้อจำกัดชื่อ NetBIOS ของ Windows');
      R.parts.push([host, host.includes('.') ? 'ชื่อเครื่องแบบเต็ม (มีโดเมน)' : 'ชื่อเครื่อง']);
    }
    if (comps.length === 1) {
      R.note.push('มีแค่ชื่อเครื่อง: เปิดแล้วจะเห็นรายการแชร์ที่ไม่ได้ซ่อนของเครื่องนั้น เหมือนคำสั่ง net view \\\\' + host);
      R.ok = true; R.kind = 'host'; return R;
    }
    const share = comps[1]; R.share = share;
    if (BADCH.test(share)) { R.err.push('ชื่อแชร์ "' + share + '" มีอักขระต้องห้าม ( / : * ? " < > | )'); return R; }
    R.parts.push([share, share.endsWith('$') ? 'ชื่อแชร์ซ่อน (ลงท้าย $)' : 'ชื่อแชร์']);
    if (share.endsWith('$')) R.note.push('แชร์ที่ลงท้าย $ เป็นแชร์ซ่อน ไม่แสดงในรายการ ' + (/^[A-Za-z]\$$|^ADMIN\$$/i.test(share) ? share.toUpperCase() + ' เป็นแชร์ผู้ดูแลระบบที่ Windows สร้างเอง เปิดได้เฉพาะบัญชีผู้ดูแลของเครื่องนั้น' : 'ต้องพิมพ์ชื่อเองจึงจะเปิดได้'));
    for (let i = 2; i < comps.length; i++) {
      const c = comps[i];
      if (BADCH.test(c)) { R.err.push('ชื่อ "' + c + '" มีอักขระต้องห้าม ( / : * ? " < > | )'); return R; }
      const last = i === comps.length - 1, isFile = last && /\.[A-Za-z0-9]{1,5}$/.test(c);
      if (isFile) { R.file = c; R.parts.push([c, 'ไฟล์']); }
      else { R.sub.push(c); R.parts.push([c, 'โฟลเดอร์ย่อยในแชร์']); }
    }
    if (/\s/.test(rest)) R.note.push('มีช่องว่างใน path เวลาใช้ในคำสั่ง net use ต้องครอบด้วยเครื่องหมาย " "');
    R.ok = true; R.kind = R.file ? 'file' : 'folder';
    return R;
  }
  NL_FIG('widget', 'unc-check', function (root) {
    wframe(root, 'unc-check', 'ตรวจและแยกส่วน UNC path',
      'พิมพ์ UNC path หรือกดตัวอย่าง (มีทั้งแบบถูกและแบบที่มักพิมพ์ผิด) ระบบจะแยกแต่ละส่วน บอกจุดผิด และแสดงคำสั่ง net use กับชื่อไดรฟ์ที่จะเห็นใน This PC เมื่อ Map network drive');
    const inp = h('input', { type: 'text', value: '\\\\LAB-PC07\\homework', 'aria-label': 'UNC path', spellcheck: 'false', autocomplete: 'off', class: 'nlw-mono', style: 'width:100%' });
    const drv = h('select', { 'aria-label': 'อักษรไดรฟ์' }, 'ZYXWVUTSRQPONMLKJIHGFED'.split('').map(c => h('option', { value: c }, c + ':')));
    const rec = h('input', { type: 'checkbox', checked: true });
    const ex = ['\\\\LAB-PC07\\homework', '\\\\192.168.20.57\\homework', '\\\\LAB-PC07', '\\\\LAB-PC07\\homework\\m5-1', '\\\\LAB-PC07\\homework\\std07.docx', '\\\\LAB-PC07\\งาน ส่งครู',
      '\\\\LAB-PC07\\C$', '//LAB-PC07/homework', '\\LAB-PC07\\homework', 'LAB-PC07\\homework', 'smb://LAB-PC07/homework', 'Z:\\m5-1', '\\\\192.168.20.300\\homework', '\\\\LAB PC07\\homework'];
    const out = h('div', { 'aria-live': 'polite' });
    function render() {
      const r = analyseUNC(inp.value), L = drv.value + ':';
      inp.classList.toggle('nlw-invalid', !r.ok);
      const kids = [];
      kids.push(r.ok ? result('ok', 'รูปแบบ UNC ถูกต้อง') : result('bad', 'ยังไม่ใช่ UNC path ที่ถูกต้อง'));
      if (r.parts.length) kids.push(h('div', { class: 'nlfj-chips' }, r.parts.map(p => h('span', { class: 'nlfj-chip' }, h('code', null, p[0]), h('small', null, p[1])))));
      const msgs = [].concat(r.err.map(t => ['x', t]), r.warn.map(t => ['w', t]), r.note.map(t => ['y', t]));
      if (msgs.length) kids.push(h('ul', { class: 'nlfj-msgs' }, msgs.map(m => h('li', { class: 'nlfj-' + m[0] }, m[1]))));
      if (r.ok) {
        const unc = '\\\\' + [r.host, r.share].concat(r.sub).filter(Boolean).join('\\');
        const q = /\s/.test(unc) ? '"' + unc + '"' : unc;
        if (r.kind === 'host') {
          kids.push(h('p', null, 'ดูรายการแชร์ด้วยคำสั่ง:'), h('div', { class: 'nlfj-out' }, 'net view ' + unc));
          kids.push(h('p', { class: 'nlw-small' }, 'Map network drive ต้องระบุชื่อแชร์ด้วย ใช้ชื่อเครื่องอย่างเดียวไม่ได้'));
        } else {
          if (r.kind === 'file') kids.push(h('p', { class: 'nlw-small' }, 'Map network drive ผูกได้กับโฟลเดอร์ ไม่ใช่ไฟล์ ตัวอย่างข้างล่างจึงใช้โฟลเดอร์ที่เก็บไฟล์ ' + r.file + ' แทน'));
          kids.push(h('p', null, 'คำสั่งที่ได้ผลเหมือนกด Map network drive:'), h('div', { class: 'nlfj-out' }, 'net use ' + L + ' ' + q + (rec.checked ? ' /persistent:yes' : ' /persistent:no')));
          const label = (r.sub.length ? r.sub[r.sub.length - 1] + ' (\\\\' + r.host + '\\' + [r.share].concat(r.sub.slice(0, -1)).join('\\') + ')' : r.share + ' (\\\\' + r.host + ')') + ' (' + L + ')';
          kids.push(h('p', null, 'ชื่อที่จะเห็นใน This PC → Network locations:'), h('div', { class: 'nlfj-out' }, label));
          kids.push(h('p', { class: 'nlw-small' }, rec.checked ? 'Reconnect at sign-in ติ๊กไว้: ไดรฟ์ ' + L + ' จะกลับมาทุกครั้งที่ล็อกอิน' : 'ไม่ได้ติ๊ก Reconnect at sign-in: ไดรฟ์ ' + L + ' จะหายไปเมื่อออกจากระบบ'));
        }
      }
      out.replaceChildren(...kids);
    }
    inp.addEventListener('input', render); drv.addEventListener('change', render); rec.addEventListener('change', render);
    root.append(
      h('label', { class: 'nlw-field' }, h('span', null, 'UNC path'), inp),
      h('div', { class: 'nlw-row nlw-center' }, h('label', { class: 'nlw-field', style: 'flex-direction:row;align-items:center;gap:6px' }, h('span', null, 'ไดรฟ์'), drv),
        h('label', { class: 'nlw-check' }, rec, 'Reconnect at sign-in')),
      h('div', { class: 'nlw-small', style: 'margin-top:6px' }, 'ตัวอย่าง (กดเพื่อลอง):'),
      h('div', { class: 'nlfj-ex' }, ex.map(x => h('button', { type: 'button', class: 'nlw-btn nlw-sm', onclick: () => { inp.value = x; render(); } }, x))),
      out);
    render();
    return { destroy() { root.replaceChildren(); } };
  });

  /* ===================================================================
     widget net-user-term (w17 s6): a small terminal simulator for net user / net localgroup with state and annotated output
     =================================================================== */
  NL_FIG('widget', 'net-user-term', function (root) {
    wframe(root, 'net-user-term', 'เทอร์มินัลจำลอง: net user และ net localgroup',
      'พิมพ์คำสั่งแล้วกด Enter หรือกดปุ่มตัวอย่าง เทอร์มินัลจำลองนี้จำบัญชีและกลุ่มที่สร้างไว้ ลองสลับระหว่างผู้ใช้ทั่วไปกับ Run as administrator เพื่อดูว่าคำสั่งใดต้องใช้สิทธิ์ผู้ดูแล ใต้ผลลัพธ์จะอธิบายแต่ละส่วนของคำสั่ง ปุ่มลูกศรขึ้นลงเรียกคำสั่งเดิม ข้อความในวงเล็บเหลี่ยม [เครื่องจำลอง] เป็นคำอธิบาย ไม่ใช่ผลจริงของ Windows');
    const PC = 'LAB-PC07', DASH = '-'.repeat(79), OKS = 'The command completed successfully.';
    const GROUPS0 = [['Access Control Assistance Operators'], ['Administrators', 'Administrators have complete and unrestricted access to the computer/domain'], ['Backup Operators'],
      ['Cryptographic Operators'], ['Device Owners'], ['Distributed COM Users'], ['Event Log Readers'], ['Guests', 'Guests have the same access as members of the Users group by default, except for the Guest account which is further restricted'],
      ['Hyper-V Administrators'], ['IIS_IUSRS'], ['Network Configuration Operators'], ['Performance Log Users'], ['Performance Monitor Users'], ['Power Users'], ['Remote Desktop Users'],
      ['Remote Management Users'], ['Replicator'], ['System Managed Accounts Group'], ['Users', 'Users are prevented from making accidental or intentional system-wide changes and can run most applications']];
    let U, Gs, admin = false, hist = [], hi = 0;
    const T0 = new Date(2026, 5, 1, 8, 0, 0);
    function init() {
      U = new Map(); Gs = new Map();
      for (const g of GROUPS0) Gs.set(g[0].toLowerCase(), { name: g[0], comment: g[1] || '', members: [], builtin: true, fixed: g[0] === 'Users' ? ['NT AUTHORITY\\Authenticated Users', 'NT AUTHORITY\\INTERACTIVE'] : [] });
      const mk = (name, o) => U.set(name.toLowerCase(), Object.assign({ name, comment: '', active: true, set: T0, builtin: false, last: null }, o));
      mk('Administrator', { active: false, builtin: true, comment: 'Built-in account for administering the computer/domain' });
      mk('DefaultAccount', { active: false, builtin: true, comment: 'A user account managed by the system.' });
      mk('Guest', { active: false, builtin: true, guest: true, comment: 'Built-in account for guest access to the computer/domain' });
      mk('teacher', { last: new Date(2026, 9, 14, 7, 58, 3) });
      Gs.get('administrators').members.push('administrator', 'teacher');
      Gs.get('users').members.push('teacher');
      Gs.get('guests').members.push('guest');
      Gs.get('system managed accounts group').members.push('defaultaccount');
    }
    const fmt = d => { const H = d.getHours() % 12 || 12; return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${H}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`; };
    const pad = (s, n) => (s + ' '.repeat(n)).slice(0, Math.max(n, s.length + 1));
    function tokens(line) { const t = []; const re = /"([^"]*)"|(\S+)/g; let m; while ((m = re.exec(line))) t.push({ v: m[1] != null ? m[1] : m[2], q: m[1] != null }); return t; }
    const SIM = t => ({ sim: t });
    const ERR5 = ['System error 5 has occurred.', '', 'Access is denied.', ''];
    const help = n => ['', 'More help is available by typing NET HELPMSG ' + n + '.', ''];
    const badName = n => n.length > 20 || /["/\\[\]:;|=,+*?<>]/.test(n) || /^[.\s]+$/.test(n);
    function groupsOf(k) { return [...Gs.values()].filter(g => g.members.includes(k)).map(g => g.name); }
    function userInfo(u) {
      const k = u.name.toLowerCase(), exp = new Date(u.set.getTime() + 42 * 864e5);
      const L = (a, b) => pad(a, 29) + (b || '');
      const g = groupsOf(k).map(x => '*' + x), gl = [];
      for (let i = 0; i < Math.max(1, g.length); i += 2) gl.push(L(i ? '' : 'Local Group Memberships', g.length ? pad(g[i], 22) + (g[i + 1] || '') : '').replace(/\s+$/, ''));
      return [L('User name', u.name), L('Full Name'), L('Comment', u.comment), L("User's comment"), L('Country/region code', '000 (System Default)'),
        { mark: 1, t: L('Account active', u.active ? 'Yes' : 'No') }, L('Account expires', 'Never'), '',
        L('Password last set', fmt(u.set)), { mark: 2, t: L('Password expires', u.guest ? 'Never' : fmt(exp)) }, L('Password changeable', fmt(u.set)),
        L('Password required', u.guest ? 'No' : 'Yes'), L('User may change password', u.guest ? 'No' : 'Yes'), '',
        L('Workstations allowed', 'All'), L('Logon script'), L('User profile'), L('Home directory'), L('Last logon', u.last ? fmt(u.last) : 'Never'), '',
        L('Logon hours allowed', 'All'), '', ...gl.map((t, i) => i ? t : { mark: 3, t }), L('Global Group memberships', '*None'), OKS, ''];
    }
    function run(line) {
      const t = tokens(line); if (!t.length) return [];
      const c0 = t[0].v.toLowerCase();
      if (c0 === 'whoami') return [PC.toLowerCase() + '\\teacher', ''];
      if (c0 === 'hostname') return [PC, ''];
      if (c0 === 'cls') return null;
      if (c0 !== 'net' && c0 !== 'net.exe') return [`'${t[0].v}' is not recognized as an internal or external command,`, 'operable program or batch file.', ''];
      const sub = (t[1] || { v: '' }).v.toLowerCase();
      if (sub !== 'user' && sub !== 'localgroup') return [SIM('[เครื่องจำลอง] รองรับเฉพาะ net user และ net localgroup ส่วนคำสั่ง net อื่น เช่น net use, net share ลองได้ใน Command Prompt จริง')];
      const args = t.slice(2), pos = args.filter(a => a.q || !a.v.startsWith('/')).map(a => a.v), sw = args.filter(a => !a.q && a.v.startsWith('/')).map(a => a.v.toLowerCase());
      const known = sub === 'user' ? /^\/(add|delete|del|active:(yes|no))$/ : /^\/(add|delete|del)$/;
      const unk = sw.find(s => !known.test(s));
      if (unk) return ['The option ' + unk.toUpperCase() + ' is unknown.', '', SIM('[เครื่องจำลอง] Windows จะแสดงรูปแบบคำสั่งที่ถูกต้องต่อจากนี้ ตัวเลือกของ net user ได้แก่ /add /delete /active:yes /active:no'), ...help(sub === 'user' ? 3505 : 3506)];
      if (pos.some(p => p.startsWith('-'))) return [SIM('[เครื่องจำลอง] Windows ใช้เครื่องหมาย / นำหน้าตัวเลือก เช่น /add ไม่ใช่ -add')];
      const isAdd = sw.includes('/add'), isDel = sw.includes('/delete') || sw.includes('/del'), act = sw.find(s => s.startsWith('/active:'));
      const modifies = isAdd || isDel || act || (sub === 'user' && pos.length >= 2);
      if (sub === 'user') {
        if (!pos.length && !sw.length) {
          const names = [...U.values()].map(u => u.name).sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1), rows = [];
          for (let i = 0; i < names.length; i += 3) rows.push(names.slice(i, i + 3).map((n, j) => j < 2 ? pad(n, 25) : n).join('').replace(/\s+$/, ''));
          return ['', 'User accounts for \\\\' + PC, '', DASH, ...rows, OKS, ''];
        }
        if (!pos.length) return [SIM('[เครื่องจำลอง] ต้องระบุชื่อบัญชีก่อนตัวเลือก เช่น net user std01 /add')];
        const name = pos[0], k = name.toLowerCase(), u = U.get(k), pw = pos[1];
        if (pos.length > 2) return [SIM('[เครื่องจำลอง] มีคำเกินมา ถ้าชื่อหรือรหัสผ่านมีช่องว่างให้ครอบด้วย " "'), ...help(3505)];
        if (!modifies) return u ? userInfo(u) : ['The user name could not be found.', ...help(2221)];
        if (!admin) return ERR5;
        const prompts = pw === '*' ? ['Type a password for the user:', 'Retype the password to confirm:', SIM('[เครื่องจำลอง] ตัวอักษรรหัสผ่านไม่แสดงบนจอขณะพิมพ์'), ''] : [];
        const plainWarn = pw && pw !== '*' ? [SIM('[เครื่องจำลอง] รหัสผ่าน "' + pw + '" ค้างอยู่บนจอและในประวัติคำสั่ง ใช้ * แทนจะปลอดภัยกว่า')] : [];
        if (isAdd) {
          if (u) return ['The account already exists.', ...help(2224)];
          if (badName(name)) return [SIM('[เครื่องจำลอง] ชื่อบัญชียาวได้ไม่เกิน 20 ตัว และห้ามมีอักขระ " / \\ [ ] : ; | = , + * ? < >')];
          U.set(k, { name, comment: '', active: true, set: new Date(), builtin: false, last: null });
          Gs.get('users').members.push(k);
          return [...prompts, OKS, '', ...plainWarn, ...(pw ? [] : [SIM('[เครื่องจำลอง] ไม่ได้ใส่รหัสผ่าน บัญชีนี้จึงไม่มีรหัสผ่าน ควรตั้งด้วย net user ' + name + ' *')])];
        }
        if (!u) return ['The user name could not be found.', ...help(2221)];
        if (isDel) {
          if (u.builtin) return [SIM('[เครื่องจำลอง] บัญชี built-in ลบไม่ได้ ทำได้แค่ปิดใช้งานด้วย /active:no')];
          if (k === 'teacher') return [SIM('[เครื่องจำลอง] ไม่ให้ลบบัญชีที่กำลังใช้งานอยู่ในเครื่องจำลองนี้')];
          U.delete(k); for (const g of Gs.values()) g.members = g.members.filter(m => m !== k);
          return [OKS, ''];
        }
        if (act) { u.active = act.endsWith('yes'); return [OKS, '']; }
        u.set = new Date(); return [...prompts, OKS, '', ...plainWarn];
      }
      // localgroup
      if (!pos.length && !sw.length) return ['', 'Aliases for \\\\' + PC, '', DASH, ...[...Gs.values()].map(g => g.name).sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1).map(n => '*' + n), OKS, ''];
      if (!pos.length) return [SIM('[เครื่องจำลอง] ต้องระบุชื่อกลุ่ม เช่น net localgroup Students /add')];
      const gname = pos[0], gk = gname.toLowerCase(), g = Gs.get(gk), mem = pos.slice(1);
      if (!isAdd && !isDel) {
        if (mem.length) return [SIM('[เครื่องจำลอง] การเพิ่มหรือเอาสมาชิกออกต้องมี /add หรือ /delete ต่อท้าย'), ...help(3506)];
        if (!g) return ['System error 1376 has occurred.', '', 'The specified local group does not exist.', ''];
        return [pad('Alias name', 15) + g.name, pad('Comment', 15) + g.comment, '', 'Members', '', DASH, ...g.fixed, ...g.members.map(m => U.get(m).name), OKS, ''];
      }
      if (!admin) return ERR5;
      if (!mem.length) {
        if (isAdd) {
          if (g) return ['System error 1379 has occurred.', '', 'The specified local group already exists.', ''];
          if (badName(gname) || gname.length > 256) return [SIM('[เครื่องจำลอง] ชื่อกลุ่มห้ามมีอักขระ " / \\ [ ] : ; | = , + * ? < >')];
          Gs.set(gk, { name: gname, comment: '', members: [], builtin: false, fixed: [] }); return [OKS, ''];
        }
        if (!g) return ['System error 1376 has occurred.', '', 'The specified local group does not exist.', ''];
        if (g.builtin) return [SIM('[เครื่องจำลอง] กลุ่ม built-in ของ Windows ลบไม่ได้')];
        Gs.delete(gk); return [OKS, ''];
      }
      if (!g) return ['System error 1376 has occurred.', '', 'The specified local group does not exist.', ''];
      for (const m of mem) {
        const mk = m.toLowerCase().replace(/^(lab-pc07|\.)\\/, '');
        if (!U.has(mk)) return ['System error 1332 has occurred.', '', 'No mapping between account names and security IDs was done.', ''];
        if (isAdd && g.members.includes(mk)) return ['System error 1378 has occurred.', '', 'The specified account name is already a member of the group.', ''];
        if (isDel && !g.members.includes(mk)) return ['System error 1377 has occurred.', '', 'The specified account name is not a member of the group.', ''];
      }
      for (const m of mem) { const mk = m.toLowerCase().replace(/^(lab-pc07|\.)\\/, ''); if (isAdd) g.members.push(mk); else g.members = g.members.filter(x => x !== mk); }
      return [OKS, ''];
    }
    function explain(line) {
      const t = tokens(line); if (!t.length) return [];
      const sub = (t[1] || { v: '' }).v.toLowerCase(); let posI = 0;
      return t.map((tok, i) => {
        const v = tok.v, lv = v.toLowerCase(), show = tok.q ? '"' + v + '"' : v;
        if (i === 0) return [show, lv.startsWith('net') ? 'โปรแกรม net.exe' : lv === 'whoami' ? 'แสดงชื่อเครื่อง\\บัญชีที่ใช้อยู่' : lv === 'hostname' ? 'แสดงชื่อเครื่อง' : 'คำสั่ง', ''];
        if (i === 1 && sub === 'user') return [show, 'คำสั่งย่อย จัดการบัญชีผู้ใช้', ''];
        if (i === 1 && sub === 'localgroup') return [show, 'คำสั่งย่อย จัดการกลุ่มในเครื่อง', ''];
        if (!tok.q && v.startsWith('/')) return [show, { '/add': 'สร้างใหม่ หรือเพิ่มสมาชิก', '/delete': 'ลบ หรือเอาสมาชิกออก', '/del': 'ลบ (ย่อของ /delete)', '/active:no': 'ปิดใช้งานบัญชี', '/active:yes': 'เปิดใช้งานบัญชี' }[lv] || 'ตัวเลือกที่ไม่รู้จัก', /^\/(add|delete|del|active:(yes|no))$/.test(lv) ? '' : 'bad'];
        posI++;
        if (sub === 'user') return posI === 1 ? [show, 'ชื่อบัญชี', ''] : posI === 2 ? (v === '*' ? [show, 'ให้ถามรหัสผ่านโดยไม่แสดงบนจอ', ''] : [show, 'รหัสผ่านพิมพ์ตรง ๆ (ค้างบนจอ)', 'warn']) : [show, 'คำเกิน', 'bad'];
        return posI === 1 ? [show, 'ชื่อกลุ่ม', ''] : [show, 'สมาชิก (ชื่อบัญชี)', ''];
      });
    }
    const NOTE = { 1: 'Account active: Yes = ใช้งานได้, No = ถูกปิดไว้', 2: 'Password expires: วันที่รหัสผ่านหมดอายุ (นโยบายเริ่มต้นของเครื่องคือ 42 วัน)', 3: 'Local Group Memberships: กลุ่มที่บัญชีสังกัด มี * นำหน้าชื่อกลุ่ม' };
    const term = h('div', { class: 'nlfj-term', role: 'log', 'aria-live': 'polite', 'aria-label': 'ผลลัพธ์ของเทอร์มินัลจำลอง', tabindex: '0' });
    const anat = h('div', { 'aria-live': 'polite' });
    const prompt = () => admin ? 'C:\\Windows\\system32>' : 'C:\\Users\\teacher>';
    const pr = h('span', { class: 'nlfj-pr' });
    const inp = h('input', { type: 'text', 'aria-label': 'พิมพ์คำสั่ง', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', placeholder: 'เช่น net user std01' });
    function exec(line) {
      line = String(line).trim(); if (!line) return;
      hist.push(line); hi = hist.length;
      const res = run(line);
      if (res === null) { term.replaceChildren(); anat.replaceChildren(); return; }
      const frag = [h('div', { class: 'nlfj-c' }, prompt() + line)];
      const marks = [];
      for (const r of res) {
        if (r && r.sim) frag.push(h('div', { class: 'nlfj-n' }, r.sim));
        else if (r && r.mark) { marks.push(r.mark); frag.push(h('div', null, h('mark', null, r.t), '  [' + r.mark + ']')); }
        else frag.push(h('div', null, r || ' '));
      }
      term.append(...frag);
      while (term.childNodes.length > 400) term.firstChild.remove();
      term.scrollTop = term.scrollHeight;
      const ex = explain(line);
      anat.replaceChildren(
        h('p', { class: 'nlw-small', style: 'margin:8px 0 0' }, 'ส่วนประกอบของคำสั่งล่าสุด:'),
        h('div', { class: 'nlfj-chips' }, ex.map(e => h('span', { class: 'nlfj-chip' + (e[2] ? ' nlfj-' + e[2] : '') }, h('code', null, e[0]), h('small', null, e[1])))),
        marks.length ? h('ul', { class: 'nlfj-msgs' }, marks.map(m => h('li', { class: 'nlfj-w' }, '[' + m + '] ' + NOTE[m]))) : null);
    }
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); exec(inp.value); inp.value = ''; }
      else if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); hi = Math.max(0, hi - 1); inp.value = hist[hi]; }
      else if (e.key === 'ArrowDown' && hist.length) { e.preventDefault(); hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; }
    });
    const modeBtns = [['user', 'ผู้ใช้ทั่วไป'], ['admin', 'Run as administrator']].map(m => h('button', { type: 'button', class: 'nlw-btn', 'aria-pressed': String((m[0] === 'admin') === admin), onclick: () => setMode(m[0] === 'admin') }, m[1]));
    function setMode(a) { admin = a; modeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String((i === 1) === admin))); pr.textContent = prompt(); term.append(h('div', { class: 'nlfj-n' }, a ? '[เครื่องจำลอง] เปิด Command Prompt ใหม่ด้วย Run as administrator' : '[เครื่องจำลอง] เปิด Command Prompt ใหม่แบบผู้ใช้ทั่วไป')); term.scrollTop = term.scrollHeight; }
    const EX = ['whoami', 'net user', 'net user std01 * /add', 'net user std01', 'net localgroup', 'net localgroup Students /add', 'net localgroup Students std01 /add', 'net localgroup Students', 'net user std01 /active:no', 'net localgroup Administrators', 'net user std01 /delete'];
    const reset = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { init(); hist = []; hi = 0; term.replaceChildren(); anat.replaceChildren(); setMode(false); term.replaceChildren(); } }, 'เริ่มใหม่ (ล้างบัญชีที่สร้าง)');
    root.append(
      h('div', { class: 'nlw-seg', role: 'group', 'aria-label': 'สิทธิ์ของ Command Prompt' }, modeBtns),
      term,
      h('div', { class: 'nlfj-cmd' }, pr, inp, h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: () => { exec(inp.value); inp.value = ''; inp.focus(); } }, 'Enter')),
      h('div', { class: 'nlw-small' }, 'ตัวอย่าง (กดเพื่อรัน):'),
      h('div', { class: 'nlfj-ex' }, EX.map(x => h('button', { type: 'button', class: 'nlw-btn nlw-sm', onclick: () => exec(x) }, x))),
      anat, h('div', { class: 'nlw-row' }, reset));
    init(); pr.textContent = prompt();
    return { destroy() { root.replaceChildren(); } };
  });
})();
