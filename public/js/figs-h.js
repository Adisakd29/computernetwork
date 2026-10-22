'use strict';
/* NetLab Phase 4 figures, batch h: VLAN / 802.1Q / STP (week 4), NAT / PAT / CGNAT (week 10), router ACLs (week 16).
   Register with NL_FIG('diagram'|'widget', name, svgString|mountFn). Colours only through CSS variables. */
window.NL_FIG = window.NL_FIG || function (kind, name, v) { const k = kind === 'diagram' ? 'NL_DIAGRAMS' : 'NL_WIDGETS'; (window[k] = window[k] || {})[name] = v; };

(function () {
  /* ---------- SVG helpers (same style as figs-g.js) ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MONO = 'JetBrains Mono,Consolas,monospace';
  const BL = 'var(--blue)', OR = 'var(--orange)', GR = 'var(--green)', OK = 'var(--ok)', BAD = 'var(--bad)', MU = 'var(--muted)', INK = 'var(--ink)';
  function T(x, y, s, o) {
    o = o || {};
    const fam = o.m ? ` font-family="${MONO}"` : ' font-family="inherit"';
    return `<text x="${x}" y="${y}" font-size="${o.s || 15}" text-anchor="${o.a || 'middle'}" fill="${o.c || INK}"${o.w ? ' font-weight="700"' : ''}${o.op ? ` opacity="${o.op}"` : ''}${fam}>${esc(s)}</text>`;
  }
  function R(x, y, w, h, o) {
    o = o || {};
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx == null ? 9 : o.rx}" fill="${o.f || 'var(--panel)'}"${o.fo != null ? ` fill-opacity="${o.fo}"` : ''} stroke="${o.st || 'var(--line)'}" stroke-width="${o.sw || 1.8}"${o.d ? ` stroke-dasharray="${o.d}"` : ''}${o.op ? ` opacity="${o.op}"` : ''}/>`;
  }
  function P(d, o) {
    o = o || {};
    const me = o.me === false ? '' : ` marker-end="url(#${o.me})"`;
    return `<path d="${d}" fill="none" stroke="${o.c || MU}" stroke-width="${o.sw || 2.2}" stroke-linecap="round" stroke-linejoin="round"${o.d ? ` stroke-dasharray="${o.d}"` : ''}${o.op ? ` opacity="${o.op}"` : ''}${me}/>`;
  }
  function L(x1, y1, x2, y2, o) {
    o = o || {};
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.c || MU}" stroke-width="${o.sw || 2}"${o.d ? ` stroke-dasharray="${o.d}"` : ''} stroke-linecap="round"/>`;
  }
  function marker(id, c) {
    return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`;
  }
  function BOX(x, y, w, h, main, sub, o) {
    o = o || {};
    const cx = x + w / 2;
    return R(x, y, w, h, { f: o.f || 'var(--panel)', fo: o.fo, st: o.st || 'var(--line)', sw: o.sw || 1.8 }) +
      T(cx, y + (sub ? h / 2 - 3 : h / 2 + 6), main, { s: o.s || 15, w: o.bold !== false, m: o.m }) +
      (sub ? T(cx, y + h / 2 + 16, sub, { s: o.ss || 12.5, c: MU, m: o.subm }) : '');
  }
  function XM(x, y, r, c) { r = r || 7; return `<path d="M${x - r},${y - r} L${x + r},${y + r} M${x + r},${y - r} L${x - r},${y + r}" stroke="${c || BAD}" stroke-width="3" stroke-linecap="round"/>`; }
  function CIRC(x, y, n, c) { return `<circle cx="${x}" cy="${y}" r="12" fill="var(--panel)" stroke="${c || INK}" stroke-width="2"/>` + T(x, y + 5, String(n), { s: 13, w: 1, c: c || INK }); }
  function svg(id, w, h, title, defs, body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-title" font-family="inherit"><title id="${id}-title">${esc(title)}</title><defs>${defs}</defs>${body}</svg>`;
  }

  /* ===================================================================
     diagram vlan-broadcast-domains
     =================================================================== */
  NL_FIG('diagram', 'vlan-broadcast-domains', (function () {
    const ports = [[95, 'Fa0/1', BL, 'LAB1', '.11'], [175, 'Fa0/2', BL, 'LAB2', '.12'], [255, 'Fa0/3', BL, 'LAB3', '.13'],
      [385, 'Fa0/4', OR, 'OFF1', '.11'], [465, 'Fa0/5', OR, 'OFF2', '.12'], [545, 'Fa0/6', OR, 'OFF3', '.13']];
    let s = '';
    s += BOX(220, 14, 200, 58, 'Router หรือ L3 Switch', 'Gateway 192.168.10.1 และ .20.1');
    s += L(320, 72, 320, 128, { c: MU, d: '6 5' });
    s += T(332, 104, 'ข้าม VLAN ต้องผ่านอุปกรณ์ชั้น 3', { s: 13, a: 'start', c: MU });
    s += T(24, 100, 'LAB1 ส่ง Broadcast (ARP Request)', { s: 13.5, a: 'start', c: BL, w: 1 });
    s += T(24, 120, 'ปลายทาง ffff.ffff.ffff', { s: 12.5, a: 'start', c: MU, m: 1 });
    // switch
    s += R(30, 130, 580, 92, { rx: 10, sw: 2 });
    s += T(598, 152, 'SW1 Managed Switch', { s: 14, a: 'end', w: 1 });
    s += R(306, 124, 28, 12, { rx: 3, f: 'var(--field)', st: MU, sw: 1.4 });
    s += P('M95,194 V170 H255 V194', { c: BL, sw: 2.6, me: 'vbd-b' });
    s += P('M175,170 V194', { c: BL, sw: 2.6, me: 'vbd-b' });
    s += T(175, 162, 'Flood ภายใน VLAN 10', { s: 12.5, c: BL });
    ports.forEach(([x, n, c]) => {
      s += R(x - 16, 196, 32, 18, { rx: 3, f: c, fo: 0.22, st: c, sw: 1.8 });
      s += T(x, 188, n, { s: 11.5, m: 1, c: MU });
    });
    // links + PCs
    ports.forEach(([x, , c, name, ip], i) => {
      if (i === 0) s += P(`M${x},288 V218`, { c: BL, sw: 2.6, me: 'vbd-b' });
      else if (i < 3) s += P(`M${x},216 V286`, { c: BL, sw: 2.6, me: 'vbd-b' });
      else { s += L(x, 216, x, 288, { c: MU, sw: 1.8, d: '4 4' }); s += XM(x, 250, 7, BAD); }
      s += BOX(x - 36, 290, 72, 52, name, ip, { s: 14, subm: 1, st: c });
    });
    s += R(26, 272, 278, 128, { f: BL, fo: 0.05, st: BL, sw: 1.4, d: '7 5', rx: 14 });
    s += R(336, 272, 278, 128, { f: OR, fo: 0.05, st: OR, sw: 1.4, d: '7 5', rx: 14 });
    s += T(165, 366, 'VLAN 10 (LAB) 192.168.10.0/24', { s: 13.5, w: 1, c: BL });
    s += T(165, 388, 'Broadcast Domain ที่ 1', { s: 12.5, c: MU });
    s += T(475, 366, 'VLAN 20 (OFFICE) 192.168.20.0/24', { s: 13.5, w: 1, c: OR });
    s += T(475, 388, 'ไม่ได้รับ Broadcast ของ VLAN 10', { s: 12.5, c: MU });
    const title = 'สวิตช์ SW1 ตัวเดียวแบ่งเป็นสอง VLAN พอร์ต Fa0/1 ถึง Fa0/3 อยู่ VLAN 10 ชื่อ LAB วง 192.168.10.0/24 มีเครื่อง LAB1 ถึง LAB3 พอร์ต Fa0/4 ถึง Fa0/6 อยู่ VLAN 20 ชื่อ OFFICE วง 192.168.20.0/24 มีเครื่อง OFF1 ถึง OFF3 เมื่อ LAB1 ส่ง ARP Request แบบ Broadcast สวิตช์ส่งต่อเฉพาะ Fa0/2 และ Fa0/3 ใน VLAN เดียวกัน เครื่องใน VLAN 20 ไม่ได้รับ ถ้าต้องการส่งข้าม VLAN ต้องผ่าน Router หรือ L3 Switch ที่เป็น Gateway ของทั้งสองวง';
    return svg('vlan-broadcast-domains', 640, 410, title, marker('vbd-b', BL), s);
  })());

  /* ===================================================================
     diagram dot1q-tag: untagged vs tagged frame, TCI bits
     =================================================================== */
  NL_FIG('diagram', 'dot1q-tag', (function () {
    let s = '';
    const fld = (x, y, w, name, size, o) => {
      o = o || {};
      return R(x, y, w, 54, { rx: 0, f: o.f || 'var(--field)', fo: o.fo, st: o.st || 'var(--line)', sw: o.sw || 1.6 }) +
        T(x + w / 2, y + 23, name, { s: 13.5, w: 1 }) + T(x + w / 2, y + 43, size, { s: 12, c: MU, m: o.m });
    };
    s += T(20, 28, 'เฟรม Ethernet เดิม (Untagged)', { s: 15, a: 'start', w: 1 });
    s += T(620, 28, 'ไม่ตามสเกล', { s: 12, a: 'end', c: MU });
    let y = 40;
    s += fld(20, y, 90, 'Dest MAC', '6 ไบต์') + fld(110, y, 90, 'Source MAC', '6 ไบต์') + fld(200, y, 70, 'Type', '2 ไบต์') +
      fld(270, y, 290, 'Data (Payload)', '46 ถึง 1500 ไบต์') + fld(560, y, 60, 'FCS', '4 ไบต์');
    s += P('M200,96 L236,144', { c: OR, sw: 2.4, me: 'dqt-o' });
    s += T(250, 124, 'แทรก 4 ไบต์ระหว่าง Source MAC กับ Type', { s: 13, a: 'start', c: INK });
    s += T(20, 136, 'เฟรมที่มีแท็ก 802.1Q (Tagged)', { s: 15, a: 'start', w: 1 });
    y = 148;
    s += fld(20, y, 90, 'Dest MAC', '6 ไบต์') + fld(110, y, 90, 'Source MAC', '6 ไบต์') +
      fld(200, y, 80, 'TPID', '0x8100', { f: OR, fo: 0.16, st: OR, sw: 2, m: 1 }) + fld(280, y, 80, 'TCI', '2 ไบต์', { f: OR, fo: 0.16, st: OR, sw: 2 }) +
      fld(360, y, 70, 'Type', '2 ไบต์') + fld(430, y, 130, 'Data', '42 ถึง 1500') + fld(560, y, 60, 'FCS', 'ใหม่ 4');
    // TCI expansion
    s += L(280, 202, 120, 254, { c: OR, d: '5 4', sw: 1.6 }) + L(360, 202, 520, 254, { c: OR, d: '5 4', sw: 1.6 });
    s += T(20, 240, 'TCI 16 บิต', { s: 14, a: 'start', w: 1 });
    const bits = '0000000000001010';
    for (let i = 0; i < 16; i++) {
      const c = i < 3 ? GR : i === 3 ? MU : BL;
      s += R(120 + i * 25, 254, 25, 34, { rx: 0, f: c, fo: 0.14, st: c, sw: 1.4 });
      s += T(132.5 + i * 25, 277, bits[i], { s: 14, m: 1, w: bits[i] === '1' });
    }
    s += T(530, 277, '= 0x000A', { s: 13, a: 'start', m: 1 });
    s += T(157.5, 310, 'PCP', { s: 13.5, w: 1, c: GR }) + T(157.5, 328, '3 บิต', { s: 12, c: MU });
    s += T(207.5, 310, 'DEI', { s: 13.5, w: 1, c: MU }) + T(207.5, 328, '1 บิต', { s: 12, c: MU });
    s += T(370, 310, 'VID (VLAN ID) 12 บิต', { s: 13.5, w: 1, c: BL }) + T(370, 328, '0000 0000 1010 = VLAN 10', { s: 12, c: MU, m: 1 });
    s += T(20, 362, 'PCP = ลำดับความสำคัญ 0 ถึง 7 (802.1p)   DEI = ทิ้งก่อนได้เมื่อแออัด', { s: 13, a: 'start' });
    s += T(20, 384, 'VID 0 และ 4095 สงวนไว้ จึงใช้งานได้ VLAN 1 ถึง 4094', { s: 13, a: 'start' });
    s += T(20, 406, 'เฟรมยาวสุด 1518 เป็น 1522 ไบต์ และ FCS ต้องคำนวณใหม่ทุกครั้งที่ใส่หรือถอดแท็ก', { s: 13, a: 'start' });
    const title = 'เปรียบเทียบเฟรม Ethernet เดิมกับเฟรมที่มีแท็ก IEEE 802.1Q เฟรมเดิมมี Destination MAC 6 ไบต์ Source MAC 6 ไบต์ Type 2 ไบต์ Data 46 ถึง 1500 ไบต์ และ FCS 4 ไบต์ เฟรมที่มีแท็กแทรก 4 ไบต์ระหว่าง Source MAC กับ Type ได้แก่ TPID 2 ไบต์ค่า 0x8100 และ TCI 2 ไบต์ ข้อมูลขั้นต่ำเหลือ 42 ไบต์ และ FCS ถูกคำนวณใหม่ TCI 16 บิตแบ่งเป็น PCP 3 บิต ลำดับความสำคัญ DEI 1 บิต และ VLAN ID 12 บิต ตัวอย่าง VLAN 10 Priority 0 ได้บิต 0000 0000 0000 1010 เท่ากับ 0x000A VLAN ID 0 และ 4095 สงวนไว้ ใช้งานได้ 1 ถึง 4094 เฟรมยาวสุดจาก 1518 เป็น 1522 ไบต์';
    return svg('dot1q-tag', 640, 420, title, marker('dqt-o', OR), s);
  })());

  /* ===================================================================
     diagram router-on-a-stick
     =================================================================== */
  NL_FIG('diagram', 'router-on-a-stick', (function () {
    let s = '';
    s += R(150, 14, 340, 104, { rx: 10, sw: 2 });
    s += T(320, 40, 'R1 (Router) ขา g0/0 ขาเดียว', { s: 15, w: 1 });
    s += T(320, 68, 'g0/0.10  dot1Q 10  192.168.10.1/24', { s: 13, m: 1, c: BL, w: 1 });
    s += T(320, 94, 'g0/0.20  dot1Q 20  192.168.20.1/24', { s: 13, m: 1, c: OR, w: 1 });
    // trunk, up blue / down orange
    s += P('M300,218 V122', { c: BL, sw: 3, me: 'ros-b' });
    s += P('M340,122 V218', { c: OR, sw: 3, me: 'ros-o' });
    s += CIRC(300, 170, 2, BL) + CIRC(340, 170, 3, OR);
    s += T(282, 150, 'ขึ้น: แท็ก VID 10', { s: 13, a: 'end', c: BL, w: 1 });
    s += T(282, 196, 'Trunk 802.1Q', { s: 12.5, a: 'end', c: MU });
    s += T(358, 150, 'ลง: แท็ก VID 20', { s: 13, a: 'start', c: OR, w: 1 });
    s += T(358, 196, 'สายเส้นเดียว', { s: 12.5, a: 'start', c: MU });
    // switch
    s += R(110, 220, 420, 70, { rx: 10, sw: 2 });
    s += T(130, 246, 'SW1', { s: 15, a: 'start', w: 1 });
    s += T(320, 240, 'Gi0/1 (Trunk)', { s: 12, m: 1, c: MU });
    s += R(176, 272, 48, 16, { rx: 3, f: BL, fo: 0.22, st: BL }) + T(200, 266, 'Fa0/1 VLAN 10', { s: 11.5, m: 1, c: BL });
    s += R(416, 272, 48, 16, { rx: 3, f: OR, fo: 0.22, st: OR }) + T(440, 266, 'Fa0/2 VLAN 20', { s: 11.5, m: 1, c: OR });
    // access links
    s += P('M200,360 V294', { c: BL, sw: 3, me: 'ros-b' });
    s += P('M440,294 V360', { c: OR, sw: 3, me: 'ros-o' });
    s += CIRC(200, 326, 1, BL) + CIRC(440, 326, 4, OR);
    s += T(218, 331, 'ไม่มีแท็ก', { s: 12.5, a: 'start', c: MU });
    s += T(422, 331, 'ไม่มีแท็ก', { s: 12.5, a: 'end', c: MU });
    // hosts
    const host = (x, c, name, ip, gw) => R(x, 362, 180, 72, { st: c, sw: 2 }) + T(x + 90, 384, name, { s: 14.5, w: 1 }) +
      T(x + 90, 404, ip, { s: 12.5, m: 1, c: MU }) + T(x + 90, 424, gw, { s: 12.5, m: 1, c: MU });
    s += host(110, BL, 'LAB1 (VLAN 10)', '192.168.10.11/24', 'GW 192.168.10.1');
    s += host(350, OR, 'OFF1 (VLAN 20)', '192.168.20.11/24', 'GW 192.168.20.1');
    s += T(320, 462, 'R1 รับเฟรมแท็ก 10 เข้า g0/0.10 แล้ว Route ไปวง 192.168.20.0/24 ออก g0/0.20 จึงใส่แท็ก 20', { s: 13 });
    const title = 'Router-on-a-stick: Router R1 ใช้ขา g0/0 ขาเดียวต่อกับพอร์ต Gi0/1 ของสวิตช์ SW1 ที่เป็น Trunk 802.1Q แบ่งเป็น Subinterface g0/0.10 ใช้ dot1Q 10 IP 192.168.10.1/24 และ g0/0.20 ใช้ dot1Q 20 IP 192.168.20.1/24 ขั้นที่ 1 LAB1 (192.168.10.11 Gateway 192.168.10.1) ส่งเฟรมไม่มีแท็กเข้า Fa0/1 ซึ่งอยู่ VLAN 10 ขั้นที่ 2 SW1 ส่งขึ้น Trunk ด้วยแท็ก VID 10 ขั้นที่ 3 R1 Route ไปวง 192.168.20.0/24 แล้วส่งลง Trunk ด้วยแท็ก VID 20 ขั้นที่ 4 SW1 ถอดแท็กแล้วส่งออก Fa0/2 ไปหา OFF1 (192.168.20.11)';
    return svg('router-on-a-stick', 640, 474, title, marker('ros-b', BL) + marker('ros-o', OR), s);
  })());

  /* ===================================================================
     STP engine (shared by diagram stp-roles and widget stp-root-calc)
     triangle: A-B, B-C, A-C. Ports: A Gi0/1->B Gi0/2->C, B Gi0/1->A Gi0/2->C, C Gi0/1->A Gi0/2->B (port ID 128.1 / 128.2)
     =================================================================== */
  const STP_LINKS = [['A', 'B', 'ab'], ['B', 'C', 'bc'], ['A', 'C', 'ac']];
  const PORT_OF = { A: { B: 1, C: 2 }, B: { A: 1, C: 2 }, C: { A: 1, B: 2 } };
  const SPEEDS = [['10', '10 Mb/s', 100], ['100', '100 Mb/s', 19], ['1000', '1 Gb/s', 4], ['10000', '10 Gb/s', 2]];
  const costOf = sp => (SPEEDS.find(x => x[0] === sp) || SPEEDS[2])[2];
  const macHex = m => { const h = String(m || '').toLowerCase().replace(/[.:\-\s]/g, ''); return /^[0-9a-f]{12}$/.test(h) ? h : null; };
  const macDot = h => h.slice(0, 4) + '.' + h.slice(4, 8) + '.' + h.slice(8);
  const bidCmp = (a, b) => a.prio !== b.prio ? a.prio - b.prio : a.mac < b.mac ? -1 : a.mac > b.mac ? 1 : 0;
  const vecCmp = (a, b) => { for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; const c = typeof x === 'object' ? bidCmp(x, y) : x - y; if (c) return c; } return 0; };
  function stpSolve(sw, speeds) {
    // sw: {A:{prio,mac(hex)},...}; speeds: {ab:'1000',...}
    const ids = ['A', 'B', 'C'];
    const lc = (x, y) => { const l = STP_LINKS.find(k => (k[0] === x && k[1] === y) || (k[0] === y && k[1] === x)); return costOf(speeds[l[2]]); };
    const root = ids.slice().sort((x, y) => bidCmp(sw[x], sw[y]))[0];
    const cost = { A: Infinity, B: Infinity, C: Infinity }; cost[root] = 0;
    for (let k = 0; k < 4; k++) ids.forEach(x => ids.forEach(y => { if (x !== y && cost[y] + lc(x, y) < cost[x]) cost[x] = cost[y] + lc(x, y); }));
    const rp = {}, rpWhy = {};
    ids.filter(x => x !== root).forEach(x => {
      const cands = ids.filter(y => y !== x).map(y => ({ via: y, port: PORT_OF[x][y], vec: [cost[y] + lc(x, y), sw[y], PORT_OF[y][x], PORT_OF[x][y]], c: cost[y] + lc(x, y), link: lc(x, y), nb: cost[y] }));
      cands.sort((p, q) => vecCmp(p.vec, q.vec));
      rp[x] = cands[0].port; rpWhy[x] = cands;
    });
    const ports = {}; const segs = [];
    STP_LINKS.forEach(([x, y]) => {
      const vx = [cost[x], sw[x], PORT_OF[x][y]], vy = [cost[y], sw[y], PORT_OF[y][x]];
      const xWins = vecCmp(vx, vy) < 0;
      const des = xWins ? x : y, other = xWins ? y : x;
      const why = cost[x] !== cost[y] ? 'cost' : bidCmp(sw[x], sw[y]) !== 0 ? 'bid' : 'port';
      ports[des + PORT_OF[des][other]] = { sw: des, port: PORT_OF[des][other], to: other, role: 'D' };
      const r = rp[other] === PORT_OF[other][des] ? 'R' : 'ALT';
      ports[other + PORT_OF[other][des]] = { sw: other, port: PORT_OF[other][des], to: des, role: r };
      segs.push({ x, y, des, other, why, otherRole: r });
    });
    return { root, cost, rp, rpWhy, ports, segs, lc };
  }
  const STP_DEF = { sw: { A: { prio: 32768, mac: '001122330001' }, B: { prio: 32768, mac: '001122330002' }, C: { prio: 32768, mac: '001122330003' } }, speeds: { ab: '1000', bc: '1000', ac: '1000' } };
  const ROLE_TXT = { R: 'Root', D: 'Designated', ALT: 'Alternate' };
  const ROLE_C = { R: OK, D: BL, ALT: BAD };
  // triangle drawing used by diagram and widget
  const STP_WIDE = { bw: 190, bh: 80, pos: { A: [225, 22], B: [24, 300], C: [426, 300] },
    end: { A1: [250, 102], A2: [390, 102], B1: [150, 300], B2: [214, 340], C1: [490, 300], C2: [426, 340] },
    tag: { A1: [184, 114], A2: [456, 114], B1: [94, 276], B2: [262, 368], C1: [546, 276], C2: [378, 368] }, tw: 96,
    lbl: { ab: [168, 206, 'end'], ac: [472, 206, 'start'], bc: [320, 330, 'middle'] }, fs: 13 };
  const STP_NARROW = { bw: 150, bh: 76, pos: { A: [105, 8], B: [4, 296], C: [206, 296] }, narrow: true,
    end: { A1: [130, 84], A2: [230, 84], B1: [79, 296], B2: [154, 334], C1: [281, 296], C2: [206, 334] },
    tag: { A1: [66, 112], A2: [294, 112], B1: [44, 262], B2: [118, 390], C1: [316, 262], C2: [242, 390] }, tw: 80,
    lbl: { ab: [94, 190, 'end'], ac: [266, 190, 'start'], bc: [180, 322, 'middle'] }, fs: 12 };
  function stpTriangle(sw, speeds, res, lay) {
    lay = lay || STP_WIDE;
    let s = '';
    const end = lay.end;
    const lnk = { ab: ['A1', 'B1'], ac: ['A2', 'C1'], bc: ['B2', 'C2'] };
    const sp = k => (SPEEDS.find(x => x[0] === speeds[k]) || SPEEDS[2]);
    Object.keys(lnk).forEach(k => {
      const [p, q] = lnk[k]; const a = end[p], b = end[q];
      const blocked = res.ports[p].role === 'ALT' || res.ports[q].role === 'ALT';
      s += L(a[0], a[1], b[0], b[1], { c: blocked ? MU : INK, sw: 2.6, d: blocked ? '7 6' : null });
    });
    Object.keys(lay.lbl).forEach(k => { const [x, y, a] = lay.lbl[k]; const z = sp(k); s += T(x, y, (lay.narrow && k === 'bc' ? '' : z[1] + ' ') + 'cost ' + z[2], { s: lay.fs, a, c: MU }); });
    ['A', 'B', 'C'].forEach(id => {
      const [x, y] = lay.pos[id]; const isRoot = res.root === id; const cx = x + lay.bw / 2;
      s += R(x, y, lay.bw, lay.bh, { st: isRoot ? OK : 'var(--line)', sw: isRoot ? 3 : 1.8, f: isRoot ? OK : 'var(--panel)', fo: isRoot ? 0.08 : null });
      if (lay.narrow) {
        s += T(cx, y + 21, 'SW-' + id + (isRoot ? ' (Root)' : ''), { s: 14, w: 1, c: isRoot ? OK : INK });
        s += T(cx, y + 41, macDot(sw[id].mac), { s: 12, m: 1, c: MU });
        s += T(cx, y + 62, 'P ' + sw[id].prio + '  cost ' + res.cost[id], { s: 12, c: MU });
      } else {
        s += T(cx, y + 24, 'SW-' + id + (isRoot ? '  Root Bridge' : ''), { s: 15, w: 1, c: isRoot ? OK : INK });
        s += T(cx, y + 46, sw[id].prio + ' / ' + macDot(sw[id].mac), { s: 12.5, m: 1, c: MU });
        s += T(cx, y + 68, 'Root path cost ' + res.cost[id], { s: 12.5, c: MU });
      }
    });
    const other = { A1: 'B1', B1: 'A1', A2: 'C1', C1: 'A2', B2: 'C2', C2: 'B2' };
    Object.keys(lay.tag).forEach(k => {
      const p = res.ports[k]; const [x, y] = lay.tag[k]; const c = ROLE_C[p.role];
      const txt = 'Gi0/' + p.port + ' ' + (p.role === 'ALT' ? 'BLK' : p.role);
      s += `<rect x="${x - lay.tw / 2}" y="${y - 15}" width="${lay.tw}" height="24" rx="12" fill="${c}" fill-opacity="0.14" stroke="${c}" stroke-width="1.8"/>` + T(x, y + 2, txt, { s: 12, w: 1, m: 1, c });
      if (p.role === 'ALT') {
        const e = end[k], f = end[other[k]]; const dx = f[0] - e[0], dy = f[1] - e[1], n = Math.hypot(dx, dy) || 1;
        const ux = dx / n, uy = dy / n, mx = e[0] + ux * 14, my = e[1] + uy * 14;
        s += L(+(mx - uy * 12).toFixed(1), +(my + ux * 12).toFixed(1), +(mx + uy * 12).toFixed(1), +(my - ux * 12).toFixed(1), { c: BAD, sw: 5 });
      }
    });
    return s;
  }
  NL_FIG('diagram', 'stp-roles', (function () {
    const res = stpSolve(STP_DEF.sw, STP_DEF.speeds);
    let s = stpTriangle(STP_DEF.sw, STP_DEF.speeds, res, STP_WIDE);
    s += T(320, 414, 'R = Root Port (ทางที่ใกล้ Root ที่สุด)   D = Designated Port   BLK = ถูก Block (Alternate)', { s: 13 });
    s += T(320, 436, 'ลิงก์ SW-B ถึง SW-C: ทั้งสองฝั่งมี Cost ไปถึง Root เท่ากัน (4) SW-B มี Bridge ID ต่ำกว่าจึงได้ D', { s: 13, c: MU });
    s += T(320, 458, 'พอร์ตทุกพอร์ตของ Root Bridge เป็น Designated', { s: 13, c: MU });
    const title = 'Spanning Tree บนสวิตช์ 3 ตัวต่อเป็นวงสามเหลี่ยม ทุกลิงก์ 1 Gb/s cost 4 และทุกตัวใช้ Priority 32768 SW-A มี MAC 0011.2233.0001 ต่ำที่สุดจึงเป็น Root Bridge พอร์ต Gi0/1 และ Gi0/2 ของ SW-A เป็น Designated SW-B (MAC 0011.2233.0002) และ SW-C (MAC 0011.2233.0003) ใช้ Gi0/1 ที่ต่อตรงไป SW-A เป็น Root Port Root path cost 4 บนลิงก์ SW-B ถึง SW-C ทั้งสองฝั่งมี cost 4 เท่ากัน SW-B มี Bridge ID ต่ำกว่าจึงได้ Gi0/2 เป็น Designated ส่วน Gi0/2 ของ SW-C ถูก Block (Alternate) เพื่อตัดวง';
    return svg('stp-roles', 640, 470, title, '', s);
  })());

  /* ===================================================================
     NAT diagrams
     =================================================================== */
  NL_FIG('diagram', 'nat-types', (function () {
    let s = '';
    s += T(20, 26, 'สมมติ ISP ให้ Public IP วง 198.51.100.0/29', { s: 15, a: 'start', w: 1 });
    s += T(20, 48, '.1 = ISP   .2 = ขา WAN ของ Router   .3 ถึง .6 ว่างให้ใช้   .7 = Broadcast', { s: 13, a: 'start', c: MU });
    let y = 66;
    const panel = (title, c, rows) => {
      const h = 58 + rows.length * 32;
      let p = R(10, y, 620, h, { f: c, fo: 0.05, st: c, sw: 1.6, rx: 12 });
      p += T(26, y + 24, title, { s: 14.5, a: 'start', w: 1, c });
      p += T(26, y + 46, 'Inside Local', { s: 12, a: 'start', c: MU }) + T(340, y + 46, 'Inside Global', { s: 12, a: 'start', c: MU });
      rows.forEach((r, i) => {
        const ry = y + 72 + i * 32;
        p += T(26, ry, r[0], { s: 13, a: 'start', m: 1 });
        p += P(`M252,${ry - 5} H328`, { c, sw: 2.2, me: 'nty-' + (c === BAD ? 'r' : c === OR ? 'o' : c === GR ? 'g' : 'b') });
        if (r[2] === 'bad') { p += XM(290, ry - 5, 7, BAD); p += T(340, ry, r[1], { s: 13, a: 'start', c: BAD, w: 1 }); }
        else p += T(340, ry, r[1], { s: 13, a: 'start', m: 1, w: 1 });
        if (r[3]) p += T(506, ry, r[3], { s: 12, a: 'start', c: MU });
      });
      y += h + 14;
      return p;
    };
    s += panel('Static NAT: จับคู่ถาวร 1 ต่อ 1 ทุกพอร์ต', BL, [['Server 192.168.1.10', '198.51.100.3'], ['PC1 192.168.1.11', '198.51.100.6']]);
    s += panel('Dynamic NAT: ยืมจาก Pool 198.51.100.4 ถึง .5', GR, [['PC1 192.168.1.11', '198.51.100.4'], ['PC2 192.168.1.12', '198.51.100.5'], ['PC3 192.168.1.13', 'Pool หมด ส่งไม่ได้', 'bad']]);
    s += panel('PAT (Overload) บนขา WAN 198.51.100.2', OR, [['PC1 192.168.1.11:50001', '198.51.100.2:50001'], ['PC2 192.168.1.12:50001', '198.51.100.2:50002', '', 'พอร์ตชน เลื่อน'], ['PC3 192.168.1.13:51000', '198.51.100.2:51000']]);
    const title = 'เปรียบเทียบ NAT สามแบบ สมมติ ISP ให้ Public IP วง 198.51.100.0/29 โดย .1 เป็น ISP .2 เป็นขา WAN ของ Router และ .3 ถึง .6 ว่าง Static NAT จับคู่ถาวรทุกพอร์ต Server 192.168.1.10 คู่กับ 198.51.100.3 และ PC1 192.168.1.11 คู่กับ 198.51.100.6 Dynamic NAT ยืมจาก Pool 198.51.100.4 ถึง .5 PC1 ได้ .4 PC2 ได้ .5 ส่วน PC3 ส่งไม่ได้เพราะ Pool หมด PAT ใช้ IP ขา WAN 198.51.100.2 ตัวเดียว PC1 พอร์ต 50001 ได้ 198.51.100.2:50001 PC2 พอร์ต 50001 ชนจึงได้ 50002 และ PC3 พอร์ต 51000 ได้ 198.51.100.2:51000';
    return svg('nat-types', 640, y + 2, title, marker('nty-b', BL) + marker('nty-g', GR) + marker('nty-o', OR) + marker('nty-r', BAD), s);
  })());

  NL_FIG('diagram', 'nat-pat-walk', (function () {
    let s = '';
    s += BOX(10, 14, 140, 60, 'PC1 .11 / PC2 .12', 'LAN 192.168.1.0/24', { s: 14 });
    s += BOX(240, 14, 160, 60, 'Router1 (PAT)', 'WAN 198.51.100.2', { s: 14, subm: 1 });
    s += BOX(490, 14, 140, 60, 'Web Server', '203.0.113.80:443', { s: 14, subm: 1 });
    [80, 320, 560].forEach(x => { s += L(x, 74, x, 372, { c: 'var(--line)', d: '5 5', sw: 1.6 }); });
    const lab = (x, y, a, b, hi) => T(x, y - 30, a, { s: 12, m: 1, c: hi === 0 ? OR : INK, w: hi === 0 }) + T(x, y - 13, b, { s: 12, m: 1, c: hi === 1 ? OR : INK, w: hi === 1 });
    // row 1
    let y = 134;
    s += P(`M82,${y} H306`, { c: BL, me: 'npw-b' }) + P(`M334,${y} H558`, { c: BL, me: 'npw-b' }) + CIRC(320, y, 1, BL);
    s += lab(196, y, 'src 192.168.1.11:50001', 'dst 203.0.113.80:443') + lab(444, y, 'src 198.51.100.2:50001', 'dst 203.0.113.80:443', 0);
    s += T(444, y + 20, 'เปลี่ยนต้นทาง พอร์ตเดิมว่าง', { s: 12.5, c: MU });
    // row 2
    y = 232;
    s += P(`M82,${y} H306`, { c: GR, me: 'npw-g' }) + P(`M334,${y} H558`, { c: GR, me: 'npw-g' }) + CIRC(320, y, 2, GR);
    s += lab(196, y, 'src 192.168.1.12:50001', 'dst 203.0.113.80:443') + lab(444, y, 'src 198.51.100.2:50002', 'dst 203.0.113.80:443', 0);
    s += T(444, y + 20, '50001 ถูกใช้แล้ว จึงใช้ 50002', { s: 12.5, c: MU });
    // row 3 reply
    y = 330;
    s += P(`M558,${y} H334`, { c: OR, me: 'npw-o' }) + P(`M306,${y} H82`, { c: OR, me: 'npw-o' }) + CIRC(320, y, 3, OR);
    s += lab(444, y, 'src 203.0.113.80:443', 'dst 198.51.100.2:50002') + lab(196, y, 'src 203.0.113.80:443', 'dst 192.168.1.12:50001', 1);
    s += T(196, y + 20, 'ค้นตาราง: 50002 คือ PC2', { s: 12.5, c: MU });
    // table
    s += R(10, 384, 620, 140, { f: 'var(--field)', rx: 10 });
    s += T(24, 408, 'ตาราง NAT ของ Router1 (show ip nat translations)', { s: 14, a: 'start', w: 1 });
    const cols = [24, 70, 250, 430];
    const row = (yy, v, o) => v.map((t, i) => T(cols[i], yy, t, Object.assign({ s: 12.5, a: 'start', m: 1 }, o))).join('');
    s += row(436, ['Pro', 'Inside global', 'Inside local', 'Outside global'], { c: MU, w: 1 });
    s += L(20, 444, 620, 444, { c: 'var(--line)', sw: 1.2 });
    s += row(464, ['tcp', '198.51.100.2:50001', '192.168.1.11:50001', '203.0.113.80:443']);
    s += row(488, ['tcp', '198.51.100.2:50002', '192.168.1.12:50001', '203.0.113.80:443']);
    s += T(24, 512, 'Outside local เท่ากับ Outside global จึงละไว้ แถวหมดอายุเมื่อไม่มีการใช้งานระยะหนึ่ง', { s: 12.5, a: 'start', c: MU });
    const title = 'PAT ทีละขั้น ขั้นที่ 1 PC1 ส่งจาก 192.168.1.11:50001 ไป 203.0.113.80:443 Router1 เปลี่ยนต้นทางเป็น 198.51.100.2:50001 เพราะพอร์ตเดิมว่าง ขั้นที่ 2 PC2 ส่งจาก 192.168.1.12:50001 ไปที่เดียวกัน พอร์ต 50001 ของ 198.51.100.2 ถูกใช้แล้ว จึงเปลี่ยนเป็น 198.51.100.2:50002 ขั้นที่ 3 คำตอบจาก 203.0.113.80:443 มาถึง 198.51.100.2:50002 Router1 ค้นตารางแล้วเปลี่ยนปลายทางเป็น 192.168.1.12:50001 ตาราง NAT มีสองแถว tcp Inside global 198.51.100.2:50001 Inside local 192.168.1.11:50001 และ Inside global 198.51.100.2:50002 Inside local 192.168.1.12:50001 Outside global 203.0.113.80:443 ทั้งสองแถว';
    return svg('nat-pat-walk', 640, 534, title, marker('npw-b', BL) + marker('npw-g', GR) + marker('npw-o', OR), s);
  })());

  NL_FIG('diagram', 'cgnat-chain', (function () {
    let s = '';
    s += BOX(150, 14, 340, 58, 'อินเทอร์เน็ต', 'มือถือของเจ้าของร้านใช้เน็ตมือถือ', { s: 15 });
    s += BOX(150, 130, 340, 66, 'CGNAT ของ ISP', 'ภายใน 100.64.0.0/10  ภายนอก 203.0.113.45 (ใช้ร่วมหลายราย)', { s: 15, st: OR, sw: 2.4, ss: 12 });
    s += BOX(150, 254, 340, 66, 'เราเตอร์ของร้าน (NAT ชั้นที่ 1)', 'WAN 100.70.15.23   LAN 192.168.1.1', { s: 15, ss: 12.5 });
    s += BOX(150, 378, 340, 58, 'NVR 192.168.1.20', 'ตั้ง Port Forwarding ไว้ที่เราเตอร์ร้านแล้ว', { s: 15 });
    // outbound (left, up)
    s += P('M200,376 V322', { c: OK, sw: 2.6, me: 'cgn-k' }) + P('M200,252 V198', { c: OK, sw: 2.6, me: 'cgn-k' }) + P('M200,128 V74', { c: OK, sw: 2.6, me: 'cgn-k' });
    s += T(188, 346, 'src 192.168.1.20', { s: 12, a: 'end', m: 1 }) + T(188, 364, 'ขาออก', { s: 12, a: 'end', c: OK, w: 1 });
    s += T(188, 222, 'src 100.70.15.23', { s: 12, a: 'end', m: 1 }) + T(188, 240, 'แปลงครั้งที่ 1', { s: 12, a: 'end', c: MU });
    s += T(188, 98, 'src 203.0.113.45', { s: 12, a: 'end', m: 1 }) + T(188, 116, 'แปลงครั้งที่ 2', { s: 12, a: 'end', c: MU });
    // inbound (right, down) stopped at CGNAT
    s += P('M440,74 V126', { c: BAD, sw: 2.6, me: 'cgn-r' });
    s += XM(440, 112, 8, BAD);
    s += T(452, 90, 'ขาเข้า: ไป 203.0.113.45:8000', { s: 12, a: 'start', c: BAD, w: 1 });
    s += T(452, 108, 'CGNAT ไม่มีแถว จึงทิ้ง', { s: 12, a: 'start', c: MU });
    s += L(440, 198, 440, 252, { c: MU, d: '5 5', sw: 1.8 });
    s += T(452, 222, 'ไม่มาถึงเราเตอร์ร้าน', { s: 12, a: 'start', c: MU });
    s += T(452, 240, 'Port Forwarding ไม่ถูกใช้', { s: 12, a: 'start', c: MU });
    s += T(320, 462, 'ตรวจ: ถ้า IP ขา WAN อยู่ในช่วง 100.64.0.0 ถึง 100.127.255.255 แปลว่าอยู่หลัง CGNAT', { s: 13 });
    s += T(320, 482, 'พอร์ต 8000 เป็นตัวอย่าง', { s: 12, c: MU });
    const title = 'NAT สองชั้นเมื่ออยู่หลัง CGNAT ขาออก NVR 192.168.1.20 ส่งออกไป เราเตอร์ของร้านแปลงต้นทางเป็น 100.70.15.23 ซึ่งเป็น Shared Address Space ของ ISP จากนั้น CGNAT ของ ISP แปลงอีกครั้งเป็น Public IP 203.0.113.45 ที่ใช้ร่วมกับลูกค้าหลายราย ขาเข้า มือถือภายนอกเชื่อมต่อไปที่ 203.0.113.45 พอร์ต 8000 แต่ CGNAT ไม่มีแถวในตารางจึงทิ้ง แพ็กเก็ตไม่มาถึงเราเตอร์ของร้าน Port Forwarding ที่ตั้งไว้จึงไม่ถูกใช้ วิธีตรวจคือดูว่า IP ขา WAN อยู่ในช่วง 100.64.0.0 ถึง 100.127.255.255 หรือไม่';
    return svg('cgnat-chain', 640, 494, title, marker('cgn-k', OK) + marker('cgn-r', BAD), s);
  })());

  /* ===================================================================
     ACL diagrams
     =================================================================== */
  NL_FIG('diagram', 'acl-first-match', (function () {
    let s = '';
    s += R(20, 12, 600, 62, { f: BL, fo: 0.07, st: BL, sw: 2 });
    s += T(320, 36, 'แพ็กเก็ตเข้าขา g0/0 ตรวจด้วย ACL 120 ทิศ in', { s: 14.5, w: 1 });
    s += T(320, 60, 'TCP 192.168.50.20:50123 ไป 192.168.30.10:22 (SSH)', { s: 13, m: 1 });
    const rules = [
      ['1  permit tcp 192.168.50.0 0.0.0.255', '   host 192.168.30.10 eq 80', 'no', 'ไม่ตรง', 'พอร์ต 22 ไม่ใช่ 80'],
      ['2  permit tcp 192.168.50.0 0.0.0.255', '   host 192.168.30.10 eq 443', 'no', 'ไม่ตรง', 'พอร์ต 22 ไม่ใช่ 443'],
      ['3  deny ip 192.168.50.0 0.0.0.255', '   192.168.0.0 0.0.255.255', 'hit', 'ตรง: deny', 'ทิ้งแพ็กเก็ต หยุดตรวจ'],
      ['4  permit ip 192.168.50.0 0.0.0.255', '   any', 'skip', 'ไม่ถูกตรวจ', 'จบที่ข้อ 3 แล้ว'],
      ['   deny ip any any', '   (Implicit Deny ซ่อนอยู่ท้าย ACL)', 'imp', 'ใช้เมื่อไม่ตรง', 'กฎใดเลย']
    ];
    rules.forEach((r, i) => {
      const y = 98 + i * 82; const k = r[2];
      const st = k === 'hit' ? BAD : k === 'imp' ? MU : 'var(--line)';
      const op = k === 'skip' || k === 'imp' ? 0.6 : null;
      s += R(20, y, 440, 58, { st, sw: k === 'hit' ? 2.6 : 1.8, d: k === 'imp' ? '6 5' : null, op, f: k === 'hit' ? BAD : 'var(--panel)', fo: k === 'hit' ? 0.07 : null });
      s += T(34, y + 24, r[0], { s: 12.5, a: 'start', m: 1, op }) + T(34, y + 45, r[1], { s: 12.5, a: 'start', m: 1, op });
      const c = k === 'hit' ? BAD : k === 'no' ? MU : MU;
      s += T(478, y + 24, r[3], { s: 13.5, a: 'start', w: 1, c, op });
      s += T(478, y + 45, r[4], { s: 12.5, a: 'start', c: MU, op });
      if (k === 'no') s += P(`M240,${y + 58} V${y + 80}`, { c: MU, me: 'afm-m' });
      if (k === 'hit') s += P(`M460,${y + 29} H472`, { c: BAD, me: false });
    });
    s += P('M240,74 V96', { c: BL, me: 'afm-b' });
    s += T(320, 520, 'ตรวจจากบนลงล่าง กฎแรกที่ตรงเป็นผู้ตัดสิน ไม่ใช่กฎที่เจาะจงที่สุด', { s: 13.5, w: 1 });
    const title = 'ACL ตรวจกฎแรกที่ตรง แพ็กเก็ต TCP จาก 192.168.50.20 ไป 192.168.30.10 พอร์ต 22 (SSH) เข้าขา g0/0 ที่ผูก ACL 120 ทิศ in กฎข้อ 1 permit tcp 192.168.50.0 0.0.0.255 host 192.168.30.10 eq 80 ไม่ตรงเพราะพอร์ต 22 ไม่ใช่ 80 กฎข้อ 2 eq 443 ไม่ตรงเช่นกัน กฎข้อ 3 deny ip 192.168.50.0 0.0.0.255 192.168.0.0 0.0.255.255 ตรง จึงทิ้งแพ็กเก็ตและหยุดตรวจ กฎข้อ 4 permit ip 192.168.50.0 0.0.0.255 any ไม่ถูกตรวจ ท้ายรายการมี deny ip any any ซ่อนอยู่ ใช้เมื่อไม่ตรงกฎใดเลย';
    return svg('acl-first-match', 640, 534, title, marker('afm-m', MU) + marker('afm-b', BL), s);
  })());

  NL_FIG('diagram', 'wildcard-mask', (function () {
    let s = '';
    s += T(20, 26, '192.168.10.16 0.0.0.15 ครอบคลุม IP ใดบ้าง', { s: 15, a: 'start', w: 1 });
    const X0 = 324, CW = 30;
    s += R(X0, 44, 4 * CW, 26, { rx: 4, f: BL, fo: 0.1, st: BL, sw: 1.2 }) + T(X0 + 2 * CW, 62, 'ต้องตรง (0)', { s: 12.5, c: BL, w: 1 });
    s += R(X0 + 4 * CW, 44, 4 * CW, 26, { rx: 4, f: MU, fo: 0.12, st: MU, sw: 1.2 }) + T(X0 + 6 * CW, 62, 'ไม่สนใจ (1)', { s: 12.5, c: MU, w: 1 });
    const rows = [
      [92, 'Subnet mask ของ /28', '255.255.255.', '11110000', null, null],
      [130, 'Wildcard (กลับบิต)', '0.0.0.', '00001111', null, null],
      [180, 'ที่อยู่ในกฎ .16', '192.168.10.', '00010000', null, null],
      [218, 'แพ็กเก็ตจาก .29', '192.168.10.', '00011101', 'ok', '00010000'],
      [256, 'แพ็กเก็ตจาก .37', '192.168.10.', '00100101', 'bad', '00010000']
    ];
    s += L(20, 154, 620, 154, { c: 'var(--line)', sw: 1.4 });
    rows.forEach(([y, label, pre, bits, res, ref]) => {
      s += T(16, y, label, { s: 13.5, a: 'start' });
      s += T(X0 - 6, y, pre, { s: 13, a: 'end', m: 1, c: MU });
      for (let i = 0; i < 8; i++) {
        const diff = ref && i < 4 && bits[i] !== ref[i];
        s += R(X0 + i * CW, y - 19, CW, 26, { rx: 0, f: i < 4 ? BL : MU, fo: i < 4 ? 0.06 : 0.1, st: diff ? BAD : 'var(--line)', sw: diff ? 2.6 : 1.2 });
        s += T(X0 + i * CW + CW / 2, y, bits[i], { s: 14, m: 1, w: 1, c: diff ? BAD : i < 4 ? INK : MU });
      }
      if (res) s += T(X0 + 8 * CW + 10, y, res === 'ok' ? 'ตรง' : 'ไม่ตรง', { s: 14, a: 'start', w: 1, c: res === 'ok' ? OK : BAD });
    });
    s += T(20, 300, 'ออกเต็ต 1 ถึง 3 มี Wildcard 0 ทุกบิต จึงต้องเป็น 192.168.10 เท่านั้น', { s: 13.5, a: 'start' });
    s += T(20, 324, 'ออกเต็ตที่ 4 ต้องตรงแค่ 4 บิตแรก (0001) ไม่สนใจ 4 บิตท้าย = 16 ค่า', { s: 13.5, a: 'start' });
    s += T(20, 348, 'จึงครอบคลุม 192.168.10.16 ถึง 192.168.10.31 (วง /28)', { s: 13.5, a: 'start', w: 1 });
    s += T(20, 372, '.37 มี 4 บิตแรกเป็น 0010 ไม่ใช่ 0001 จึงไม่ตรงกฎ', { s: 13.5, a: 'start', c: BAD });
    s += T(20, 396, 'สูตร: Wildcard = 255.255.255.255 ลบ Subnet mask เช่น 255 ลบ 240 = 15', { s: 13.5, a: 'start', c: MU });
    const title = 'Wildcard mask ทีละบิต ตัวอย่าง 192.168.10.16 0.0.0.15 Subnet mask ของ /28 คือ 255.255.255.240 ออกเต็ตสุดท้าย 11110000 Wildcard กลับบิตเป็น 0.0.0.15 ออกเต็ตสุดท้าย 00001111 บิต 0 ต้องตรง บิต 1 ไม่สนใจ ที่อยู่ในกฎ .16 คือ 00010000 แพ็กเก็ตจาก 192.168.10.29 ออกเต็ตสุดท้าย 00011101 สี่บิตแรก 0001 ตรงกับกฎ จึงตรง แพ็กเก็ตจาก 192.168.10.37 ออกเต็ตสุดท้าย 00100101 สี่บิตแรก 0010 ไม่ตรง ช่วงที่ครอบคลุมคือ 192.168.10.16 ถึง 192.168.10.31 สูตร Wildcard เท่ากับ 255.255.255.255 ลบ Subnet mask';
    return svg('wildcard-mask', 640, 410, title, '', s);
  })());

  NL_FIG('diagram', 'acl-placement', (function () {
    let s = '';
    s += BOX(240, 14, 160, 52, 'อินเทอร์เน็ต', '', { s: 15 });
    s += R(240, 196, 160, 84, { rx: 12, sw: 2.6 }) + T(320, 236, 'R1', { s: 18, w: 1 }) + T(320, 260, 'Router', { s: 12.5, c: MU });
    s += BOX(12, 208, 168, 60, 'วง Guest', '192.168.50.0/24', { s: 15, subm: 1, st: OR, sw: 2.2 });
    s += BOX(460, 208, 168, 60, 'วงเซิร์ฟเวอร์', '192.168.30.0/24', { s: 15, subm: 1 });
    s += BOX(230, 398, 180, 60, 'วงพนักงาน', '192.168.20.0/24', { s: 15, subm: 1, st: BL, sw: 2.2 });
    s += L(320, 66, 320, 196, { c: INK }) + T(330, 186, 'g0/3', { s: 12, a: 'start', m: 1, c: MU });
    s += L(180, 238, 240, 238, { c: INK }) + T(236, 230, 'g0/0', { s: 12, a: 'end', m: 1, c: MU });
    s += L(400, 238, 460, 238, { c: INK }) + T(404, 230, 'g0/2', { s: 12, a: 'start', m: 1, c: MU });
    s += L(320, 280, 320, 398, { c: INK }) + T(330, 296, 'g0/1', { s: 12, a: 'start', m: 1, c: MU });
    // ACL 120 in at g0/0
    s += P('M186,254 H236', { c: OR, sw: 3.2, me: 'apl-o' });
    s += R(12, 112, 214, 72, { f: OR, fo: 0.1, st: OR, sw: 2 });
    s += T(119, 136, 'ACL 120 ทิศ in ที่ g0/0', { s: 13.5, w: 1, c: OR });
    s += T(119, 156, 'Extended: วางใกล้ต้นทาง', { s: 12.5 });
    s += T(119, 174, 'ทิ้งก่อนเข้า R1 ไม่เปลืองทาง', { s: 12.5, c: MU });
    // ACL 10 out at g0/1
    s += P('M336,300 V350', { c: BL, sw: 3.2, me: 'apl-b' });
    s += R(420, 300, 210, 90, { f: BL, fo: 0.08, st: BL, sw: 2 });
    s += T(525, 322, 'ACL 10 ทิศ out ที่ g0/1', { s: 13.5, w: 1, c: BL });
    s += T(525, 342, 'Standard: วางใกล้ปลายทาง', { s: 12.5 });
    s += T(525, 360, 'deny 192.168.50.0 0.0.0.255', { s: 11.5, m: 1 });
    s += T(525, 377, 'permit any', { s: 11.5, m: 1 });
    s += T(12, 316, 'ถ้าวาง Standard ACL ที่ g0/0 ทิศ in', { s: 12.5, a: 'start', c: MU });
    s += T(12, 334, 'Guest จะไปที่ใดไม่ได้เลย', { s: 12.5, a: 'start', c: MU });
    s += T(12, 352, 'รวมถึงอินเทอร์เน็ตและเซิร์ฟเวอร์', { s: 12.5, a: 'start', c: MU });
    // order bar
    const steps = ['เข้าขา', 'ACL in', 'Routing', 'ACL out', 'ออกขา'];
    steps.forEach((t, i) => {
      const x = 12 + i * 126;
      s += R(x, 482, 102, 34, { rx: 8, f: i === 1 ? OR : i === 3 ? BL : 'var(--field)', fo: i === 1 || i === 3 ? 0.14 : null });
      s += T(x + 51, 504, t, { s: 13, w: 1 });
      if (i < 4) s += P(`M${x + 104},499 H${x + 124}`, { c: MU, me: 'apl-m' });
    });
    s += T(320, 474, 'ลำดับการตรวจใน Router', { s: 12.5, c: MU });
    const title = 'ตำแหน่งและทิศของ ACL Router R1 มี 4 ขา g0/0 ต่อวง Guest 192.168.50.0/24 g0/1 ต่อวงพนักงาน 192.168.20.0/24 g0/2 ต่อวงเซิร์ฟเวอร์ 192.168.30.0/24 และ g0/3 ต่ออินเทอร์เน็ต Extended ACL 120 ผูกทิศ in ที่ g0/0 ใกล้ต้นทาง ทิ้งแพ็กเก็ตก่อนเข้า Router Standard ACL 10 (deny 192.168.50.0 0.0.0.255 แล้ว permit any) ผูกทิศ out ที่ g0/1 ใกล้ปลายทาง ถ้าวาง Standard ACL ที่ g0/0 ทิศ in Guest จะไปที่ใดไม่ได้เลย ลำดับการตรวจใน Router คือ เข้าขา ACL in Routing ACL out แล้วออกขา';
    return svg('acl-placement', 640, 526, title, marker('apl-o', OR) + marker('apl-b', BL) + marker('apl-m', MU), s);
  })());

  /* ---------- DOM helpers ---------- */
  const CSS = `
.nlwh .nlwh-panel{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:10px 0;background:var(--panel)}
.nlwh .nlwh-panel h4{margin:0 0 6px;font-size:16px;line-height:1.35}
.nlwh .nlw-btn{min-height:44px}
.nlwh .nlwh-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.nlwh fieldset{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:0;min-width:0}
.nlwh legend{font-weight:700;font-size:15px;padding:0 4px}
.nlwh .nlwh-checks{display:flex;flex-wrap:wrap;gap:4px 12px}
.nlwh .nlwh-checks label{display:flex;align-items:center;gap:6px;min-height:40px;font-size:15px;cursor:pointer}
.nlwh .nlwh-checks input{width:20px;height:20px}
.nlwh select,.nlwh input[type=text],.nlwh input[type=number]{min-height:42px;max-width:100%}
.nlwh .nlwh-svg{display:block;width:100%;height:auto;max-width:640px;margin:6px auto}
.nlwh .nlwh-steps{margin:6px 0;padding-left:24px}
.nlwh .nlwh-steps li{margin:6px 0;padding:6px 10px;border-left:4px solid var(--line);background:var(--field);border-radius:0 8px 8px 0;font-size:15px}
.nlwh .nlwh-steps li.nlwh-ok{border-left-color:var(--ok)}.nlwh .nlwh-steps li.nlwh-bad{border-left-color:var(--bad)}.nlwh .nlwh-steps li.nlwh-warn{border-left-color:var(--orange)}
.nlwh .nlwh-steps li.nlwh-now{box-shadow:inset 0 0 0 2px var(--blue)}
.nlwh .nlwh-wire{display:flex;flex-wrap:wrap;gap:0;margin:6px 0;border:1px solid var(--line);border-radius:8px;overflow:hidden;font-family:"JetBrains Mono",Consolas,monospace;font-size:12.5px}
.nlwh .nlwh-wire span{padding:4px 7px;border-right:1px solid var(--line);background:var(--field);flex:1 1 auto;text-align:center}
.nlwh .nlwh-wire span.nlwh-tag{background:color-mix(in srgb,var(--orange) 22%,var(--field));font-weight:700}
.nlwh .nlwh-scroll{overflow-x:auto;max-width:100%}
.nlwh table.nlwh-t{width:100%;border-collapse:collapse;font-size:14px}
.nlwh table.nlwh-t th,.nlwh table.nlwh-t td{border-bottom:1px solid var(--line);padding:6px;text-align:left;vertical-align:top}
.nlwh table.nlwh-t th{color:var(--muted);background:var(--field);font-weight:600}
.nlwh table.nlwh-t td.nlwh-m{font-family:"JetBrains Mono",Consolas,monospace;font-size:12.5px;white-space:nowrap}
.nlwh table.nlwh-t td .nlw-btn{white-space:nowrap}
.nlwh table.nlwh-t tr.nlwh-hit td{background:color-mix(in srgb,var(--blue) 12%,transparent)}
.nlwh table.nlwh-t tr.nlwh-new td{background:color-mix(in srgb,var(--green) 14%,transparent)}
.nlwh table.nlwh-t tr.nlwh-dim td{opacity:.55}
.nlwh .nlwh-log{list-style:none;padding:0;margin:6px 0}
.nlwh .nlwh-log li{border-left:4px solid var(--line);padding:6px 10px;margin:6px 0;background:var(--field);border-radius:0 8px 8px 0;font-size:14.5px}
.nlwh .nlwh-log li.nlwh-ok{border-left-color:var(--ok)}.nlwh .nlwh-log li.nlwh-bad{border-left-color:var(--bad)}.nlwh .nlwh-log li.nlwh-warn{border-left-color:var(--orange)}
.nlwh .nlwh-log code,.nlwh .nlwh-mono{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;overflow-wrap:anywhere}
.nlwh .nlwh-rules{list-style:none;padding:0;margin:6px 0;counter-reset:r}
.nlwh .nlwh-rules li{border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:6px 0;background:var(--panel);font-size:14px}
.nlwh .nlwh-rules li .nlwh-line{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;overflow-wrap:anywhere;display:block;font-weight:600}
.nlwh .nlwh-rules li.nlwh-hitp{border:2px solid var(--ok);background:color-mix(in srgb,var(--ok) 9%,var(--panel))}
.nlwh .nlwh-rules li.nlwh-hitd{border:2px solid var(--bad);background:color-mix(in srgb,var(--bad) 9%,var(--panel))}
.nlwh .nlwh-rules li.nlwh-skip{color:var(--muted);text-decoration:line-through;text-decoration-color:var(--line)}
.nlwh .nlwh-rules li.nlwh-err{border-color:var(--orange)}
.nlwh .nlwh-rules small{display:block;color:var(--muted);font-size:13px;margin-top:2px}
.nlwh .nlwh-bits{font-family:"JetBrains Mono",Consolas,monospace;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--muted)}
.nlwh textarea.nlwh-acl{width:100%;min-height:150px;font-family:"JetBrains Mono",Consolas,monospace;font-size:13.5px;line-height:1.5}
.nlwh .nlwh-row2{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
`;
  function injectCSS() {
    if (!document.getElementById('nl-widget-css')) {
      const base = window.NL_WIDGETS && window.NL_WIDGETS['caesar'];
      if (typeof base === 'function') { try { base(document.createElement('div')); } catch (e) { /* base styles optional */ } }
    }
    if (document.getElementById('nlwh-css')) return;
    const st = document.createElement('style'); st.id = 'nlwh-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  const PROPS = { value: 1, checked: 1, disabled: 1, selected: 1 };
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
  function frame(root, title, instr) {
    injectCSS();
    root.replaceChildren();
    root.classList.add('nlw', 'nlwh');
    root.appendChild(h('div', { class: 'nlw-title' }, title));
    root.appendChild(h('p', { class: 'nlw-instr' }, h('b', null, 'คำแนะนำการใช้งาน: '), instr));
    return root;
  }
  const result = (kind, ...c) => h('div', { class: 'nlw-result nlw-is-' + kind }, ...c);
  const field = (label, input) => h('label', { class: 'nlw-field' }, h('span', null, label), input);
  function select(opts, val, label) {
    const s = h('select', { 'aria-label': label || null });
    opts.forEach(o => s.appendChild(h('option', { value: String(o[0]), selected: String(o[0]) === String(val) }, o[1])));
    return s;
  }
  function svgEl(markup, label) {
    const d = h('div', { class: 'nlwh-svgwrap', role: 'img', 'aria-label': label });
    d.innerHTML = markup;
    const s = d.firstElementChild; if (s) { s.setAttribute('class', 'nlwh-svg'); s.setAttribute('aria-hidden', 'true'); }
    return d;
  }

  /* ===================================================================
     widget vlan-trunk-lab: 802.1Q tagging stepper over SW1 -- trunk -- SW2
     =================================================================== */
  const VT_HOSTS = {
    lab1: { name: 'LAB1', sw: 'sw1', port: 'Fa0/1', vlan: 10, ip: '192.168.10.11', mac: '0050.7966.0a11' },
    off1: { name: 'OFF1', sw: 'sw1', port: 'Fa0/2', vlan: 20, ip: '192.168.20.11', mac: '0050.7966.0a21' },
    lab2: { name: 'LAB2', sw: 'sw2', port: 'Fa0/1', vlan: 10, ip: '192.168.10.12', mac: '0050.7966.0a12' },
    off2: { name: 'OFF2', sw: 'sw2', port: 'Fa0/2', vlan: 20, ip: '192.168.20.12', mac: '0050.7966.0a22' }
  };
  const VT_SWN = { sw1: 'SW1', sw2: 'SW2' };
  // returns { steps:[{t, k, hl:{link, vlan, tag}, recv:{host:'ok'|'drop'}}], outcome }
  function vtSimulate(cfg, srcId, kind) {
    const src = VT_HOSTS[srcId];
    const S = src.sw, Tsw = S === 'sw1' ? 'sw2' : 'sw1';
    const peer = Object.keys(VT_HOSTS).find(k => VT_HOSTS[k].sw === Tsw && VT_HOSTS[k].vlan === src.vlan);
    const local = Object.keys(VT_HOSTS).filter(k => k !== srcId && VT_HOSTS[k].sw === S);
    const steps = []; const recv = {};
    const v = src.vlan; const cs = cfg[S], ct = cfg[Tsw];
    const dstTxt = kind === 'bcast' ? 'ffff.ffff.ffff (Broadcast)' : VT_HOSTS[peer].mac + ' (' + VT_HOSTS[peer].name + ')';
    steps.push({ k: 'info', t: kind === 'bcast'
      ? `${src.name} ส่ง ARP Request ถามหา ${VT_HOSTS[peer].ip} ปลายทาง ${dstTxt} เฟรมออกจากการ์ดแลนแบบไม่มีแท็ก เพราะ PC ไม่รู้จัก VLAN`
      : `${src.name} ส่งเฟรม Unicast ถึง MAC ของ ${VT_HOSTS[peer].name} (สมมติว่ารู้ MAC จาก ARP แล้ว) เฟรมออกจากการ์ดแลนแบบไม่มีแท็ก`,
      hl: { link: srcId, vlan: v, tag: null }, wire: { dst: dstTxt, src: src.mac, tag: null } });
    let t2 = `${VT_SWN[S]} รับเฟรมที่ ${src.port} ซึ่งเป็น Access Port ของ VLAN ${v} จึงจัดเฟรมนี้ไว้ใน VLAN ${v}`;
    if (kind === 'bcast') {
      const other = local.map(k => VT_HOSTS[k]).filter(x => x.vlan !== v);
      if (other.length) t2 += ' แล้ว Flood ออกทุกพอร์ตของ VLAN ' + v + ' ส่วน ' + other.map(x => `${x.name} (VLAN ${x.vlan})`).join(', ') + ' ไม่ได้รับเพราะอยู่ต่าง VLAN';
      other.forEach(x => { recv[Object.keys(VT_HOSTS).find(k => VT_HOSTS[k] === x)] = 'none'; });
    } else t2 += ` และพบ MAC ปลายทางในตาราง MAC ของ VLAN ${v} ว่าอยู่ทาง Gi0/1`;
    steps.push({ k: 'info', t: t2, hl: { link: null, vlan: v, sw: S } });
    // trunk egress
    if (!cs.allowed[v]) {
      steps.push({ k: 'bad', t: `VLAN ${v} ไม่อยู่ใน allowed list ของ ${VT_SWN[S]} Gi0/1 เฟรมจึงไม่ถูกส่งออก Trunk และไม่ถึงสวิตช์อีกตัว`, hl: { link: 'trunk', vlan: v, drop: S } });
      return { steps, recv, outcome: 'ไม่มีเครื่องใดอีกฝั่งได้รับเฟรม: ตรวจ switchport trunk allowed vlan ของ ' + VT_SWN[S] };
    }
    if (cfg.pvst && cs.native !== ct.native && (v === cs.native || v === ct.native)) {
      steps.push({ k: 'bad', t: `Native VLAN สองฝั่งไม่ตรงกัน (${VT_SWN[S]} = ${cs.native}, ${VT_SWN[Tsw]} = ${ct.native}) PVST+ จึง Block Gi0/1 สำหรับ VLAN ${cs.native} และ ${ct.native} (PVID inconsistent) และ CDP แจ้ง NATIVE_VLAN_MISMATCH เฟรมของ VLAN ${v} จึงถูกทิ้ง`, hl: { link: 'trunk', vlan: v, drop: S } });
      return { steps, recv, outcome: 'เฟรมไม่ข้าม Trunk เพราะพอร์ตถูก Block ป้องกันการรั่วข้าม VLAN แก้โดยตั้ง Native VLAN ให้ตรงกัน' };
    }
    const tagged = v !== cs.native;
    steps.push({ k: tagged ? 'ok' : 'warn', t: tagged
      ? `${VT_SWN[S]} ส่งออก Gi0/1 (Trunk) โดยแทรกแท็ก 802.1Q: TPID 0x8100, PCP 0, DEI 0, VID ${v} แล้วคำนวณ FCS ใหม่`
      : `VLAN ${v} เป็น Native VLAN ของ ${VT_SWN[S]} Gi0/1 จึงส่งออก Trunk แบบไม่มีแท็ก`,
    hl: { link: 'trunk', vlan: v, tag: tagged ? v : null }, wire: { dst: dstTxt, src: src.mac, tag: tagged ? v : null } });
    // trunk ingress
    let vt;
    if (tagged) {
      vt = v;
      if (!ct.allowed[vt]) {
        steps.push({ k: 'bad', t: `${VT_SWN[Tsw]} อ่านแท็กได้ VID ${vt} แต่ VLAN ${vt} ไม่อยู่ใน allowed list ของ ${VT_SWN[Tsw]} Gi0/1 จึงทิ้งเฟรม`, hl: { link: 'trunk', vlan: v, drop: Tsw } });
        return { steps, recv, outcome: 'เฟรมถูกทิ้งที่ปลายสาย Trunk: allowed list สองฝั่งต้องมี VLAN นี้ทั้งคู่' };
      }
      steps.push({ k: 'ok', t: `${VT_SWN[Tsw]} รับเฟรมที่ Gi0/1 อ่านแท็ก VID ${vt} จึงจัดเฟรมไว้ใน VLAN ${vt}`, hl: { link: null, vlan: vt, sw: Tsw } });
    } else {
      vt = ct.native;
      if (!ct.allowed[vt]) {
        steps.push({ k: 'bad', t: `${VT_SWN[Tsw]} ได้รับเฟรมไม่มีแท็ก จึงจัดไว้ใน Native VLAN ของตัวเอง (VLAN ${vt}) แต่ VLAN ${vt} ไม่อยู่ใน allowed list จึงทิ้ง`, hl: { link: 'trunk', vlan: v, drop: Tsw } });
        return { steps, recv, outcome: 'เฟรมถูกทิ้งที่ปลายสาย Trunk' };
      }
      steps.push({ k: vt === v ? 'ok' : 'bad', t: `${VT_SWN[Tsw]} ได้รับเฟรมไม่มีแท็ก จึงจัดไว้ใน Native VLAN ของตัวเองคือ VLAN ${vt}` +
        (vt === v ? '' : ` ทั้งที่ต้นทางเป็น VLAN ${v} เฟรมจึงรั่วข้าม VLAN (VLAN leak) นี่คือเหตุที่ Native VLAN ต้องตรงกัน`), hl: { link: null, vlan: vt, sw: Tsw } });
    }
    // egress on T
    const inVt = Object.keys(VT_HOSTS).filter(k => VT_HOSTS[k].sw === Tsw && VT_HOSTS[k].vlan === vt);
    const notVt = Object.keys(VT_HOSTS).filter(k => VT_HOSTS[k].sw === Tsw && VT_HOSTS[k].vlan !== vt);
    if (!inVt.length) {
      steps.push({ k: 'bad', t: `${VT_SWN[Tsw]} ไม่มี Access Port ใดอยู่ใน VLAN ${vt} เฟรมจึงไปไม่ถึงเครื่องใด`, hl: { link: null, vlan: vt, sw: Tsw } });
      notVt.forEach(k => { recv[k] = 'none'; });
      return { steps, recv, outcome: 'ไม่มีเครื่องใดได้รับเฟรม' };
    }
    let outs;
    if (kind === 'bcast' || VT_HOSTS[peer].vlan !== vt) {
      outs = inVt;
      const why = kind === 'bcast' ? 'Flood เฟรม Broadcast' : `ไม่พบ MAC ของ ${VT_HOSTS[peer].name} ในตาราง MAC ของ VLAN ${vt} (Unknown Unicast) จึง Flood`;
      steps.push({ k: vt === v ? 'ok' : 'bad', t: `${VT_SWN[Tsw]} ${why} ออกทุก Access Port ของ VLAN ${vt} โดยถอดแท็กออกก่อน: ` + outs.map(k => `${VT_HOSTS[k].port} ไปหา ${VT_HOSTS[k].name}`).join(', '),
        hl: { link: outs, vlan: vt, tag: null }, wire: { dst: dstTxt, src: src.mac, tag: null } });
    } else {
      outs = [peer];
      steps.push({ k: 'ok', t: `${VT_SWN[Tsw]} พบ MAC ของ ${VT_HOSTS[peer].name} ที่ ${VT_HOSTS[peer].port} ใน VLAN ${vt} จึงถอดแท็กแล้วส่งออกพอร์ตเดียว`, hl: { link: outs, vlan: vt, tag: null }, wire: { dst: dstTxt, src: src.mac, tag: null } });
    }
    outs.forEach(k => {
      const x = VT_HOSTS[k];
      if (kind === 'bcast') recv[k] = x.ip === VT_HOSTS[peer].ip ? 'ok' : (x.vlan !== v ? 'leak' : 'ok');
      else recv[k] = k === peer ? 'ok' : 'leak';
    });
    notVt.forEach(k => { if (!recv[k]) recv[k] = 'none'; });
    const got = outs.map(k => VT_HOSTS[k].name).join(', ');
    let outcome;
    if (vt === v) outcome = kind === 'bcast' ? `${got} ได้รับ ARP Request และ ${VT_HOSTS[peer].name} ตอบกลับ: ทำงานถูกต้อง` : `${got} ได้รับเฟรม: ทำงานถูกต้อง`;
    else outcome = `${got} อยู่ VLAN ${vt} แต่ได้รับเฟรมของ VLAN ${v}: เกิดการรั่วข้าม VLAN` + (kind === 'bcast' ? ` (${got} ได้รับแต่ไม่ตอบ เพราะ IP ที่ถามไม่ใช่ของตัวเอง)` : ' (การ์ดแลนทิ้งเพราะ MAC ปลายทางไม่ตรง)');
    steps.push({ k: vt === v ? 'ok' : 'bad', t: 'ผล: ' + outcome, hl: { link: outs, vlan: vt, done: true } });
    return { steps, recv, outcome };
  }
  function vtSvg(state) {
    // state: { upto: [hl...], cur: hl, recv }
    const N = !!state.narrow;
    const pcPos = N ? { lab1: [44, 196], off1: [134, 196], lab2: [226, 196], off2: [316, 196] } : { lab1: [90, 196], off1: [250, 196], lab2: [390, 196], off2: [550, 196] };
    const portPt = N ? { lab1: [40, 82], off1: [120, 82], lab2: [240, 82], off2: [320, 82] } : { lab1: [130, 82], off1: [210, 82], lab2: [430, 82], off2: [510, 82] };
    const SWX = N ? { sw1: [10, 130], sw2: [220, 130] } : { sw1: [90, 160], sw2: [390, 160] };
    const TR = N ? [140, 220] : [250, 390]; const TM = (TR[0] + TR[1]) / 2; const PW = N ? 84 : 100;
    const vc = v => v === 10 ? BL : v === 20 ? OR : MU;
    let s = '';
    const used = {}; let drop = null; const swHl = {};
    (state.upto || []).forEach(hl => {
      if (!hl) return;
      const links = Array.isArray(hl.link) ? hl.link : hl.link ? [hl.link] : [];
      links.forEach(l => { used[l] = hl; });
      if (hl.drop) drop = hl.drop;
      if (hl.sw) swHl[hl.sw] = hl.vlan;
    });
    const cur = state.cur || {};
    const curLinks = Array.isArray(cur.link) ? cur.link : cur.link ? [cur.link] : [];
    // trunk
    const tu = used.trunk;
    s += L(TR[0], 56, TR[1], 56, { c: tu ? vc(tu.vlan) : INK, sw: curLinks.includes('trunk') ? 6 : tu ? 4 : 2.4 });
    s += T(TM, 44, N ? 'Trunk' : 'Trunk Gi0/1 ถึง Gi0/1', { s: 12.5, c: MU });
    if (tu) {
      const lbl = tu.drop ? 'ถูกทิ้ง' : tu.tag ? 'แท็ก VID ' + tu.tag : 'ไม่มีแท็ก';
      s += `<rect x="${TM - 58}" y="${N ? 2 : 66}" width="116" height="24" rx="12" fill="${tu.drop ? BAD : vc(tu.vlan)}" fill-opacity="0.15" stroke="${tu.drop ? BAD : vc(tu.vlan)}" stroke-width="1.6"/>` + T(TM, N ? 19 : 83, lbl, { s: 12.5, w: 1, c: tu.drop ? BAD : INK });
      if (tu.drop) s += XM(tu.drop === 'sw1' ? TR[0] + 16 : TR[1] - 16, 56, 8, BAD);
    }
    // switches
    ['sw1', 'sw2'].forEach(id => {
      const hv = swHl[id]; const [x, w] = SWX[id];
      s += R(x, 28, w, 54, { rx: 10, sw: hv ? 3 : 2, st: hv ? vc(hv) : 'var(--line)' });
      s += T(x + w / 2, 52, VT_SWN[id], { s: 15, w: 1 });
      s += T(x + w / 2, 72, hv ? (N ? 'VLAN ' : 'จัดไว้ใน VLAN ') + hv : 'Native ' + state.cfg[id].native, { s: 12, c: hv ? vc(hv) : MU });
    });
    Object.keys(VT_HOSTS).forEach(k => {
      const x = VT_HOSTS[k]; const [px, py] = pcPos[k]; const [qx, qy] = portPt[k];
      const u = used[k];
      s += L(qx, qy, px, py - 26, { c: u ? vc(u.vlan) : 'var(--line)', sw: curLinks.includes(k) ? 6 : u ? 4 : 2 });
      s += T(qx + (qx < px ? 8 : -8), qy + 16, x.port, { s: 11, m: 1, c: MU, a: qx < px ? 'start' : 'end' });
      const r = state.recv && state.recv[k];
      const st = r === 'ok' ? OK : r === 'leak' ? BAD : k === state.src ? vc(x.vlan) : 'var(--line)';
      s += R(px - PW / 2, py - 26, PW, 62, { st, sw: r || k === state.src ? 3 : 1.8, f: r === 'leak' ? BAD : r === 'ok' ? OK : 'var(--panel)', fo: r === 'leak' || r === 'ok' ? 0.1 : null });
      s += T(px, py - 4, x.name, { s: 14, w: 1 });
      s += T(px, py + 14, 'VLAN ' + x.vlan, { s: 12, c: vc(x.vlan), w: 1 });
      s += T(px, py + 30, r === 'ok' ? 'ได้รับ' : r === 'leak' ? 'ได้รับ (รั่ว)' : r === 'none' ? 'ไม่ได้รับ' : k === state.src ? 'ต้นทาง' : '', { s: 11.5, c: r === 'leak' ? BAD : r === 'ok' ? OK : MU });
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N ? 360 : 640} 240" font-family="inherit">${s}</svg>`;
  }
  function vlanTrunkLab(root) {
    frame(root, 'ติดตามเฟรมข้าม Trunk 802.1Q ทีละขั้น',
      'ตั้งค่าพอร์ต Gi0/1 ของ SW1 และ SW2 (Native VLAN และ VLAN ที่อนุญาต) เลือกเครื่องต้นทางและชนิดเฟรม แล้วกด "ส่งเฟรม" จากนั้นกด "ขั้นถัดไป" เพื่อดูว่าสวิตช์ใส่หรือถอดแท็กที่ใด เฟรมถูกทิ้งเพราะอะไร และใครได้รับ ใช้คีย์บอร์ดได้ทุกปุ่ม');
    const DEF = () => ({ sw1: { native: 99, allowed: { 1: false, 10: true, 20: true, 99: true } }, sw2: { native: 99, allowed: { 1: false, 10: true, 20: true, 99: true } }, pvst: true });
    let cfg = DEF();
    const ctl = {};
    const swBox = id => {
      const nat = select([[1, 'VLAN 1'], [10, 'VLAN 10'], [20, 'VLAN 20'], [99, 'VLAN 99']], cfg[id].native, 'Native VLAN ของ ' + VT_SWN[id] + ' Gi0/1');
      nat.addEventListener('change', () => { cfg[id].native = Number(nat.value); reset(); });
      const checks = [1, 10, 20, 99].map(v => {
        const c = h('input', { type: 'checkbox', checked: cfg[id].allowed[v] });
        c.addEventListener('change', () => { cfg[id].allowed[v] = c.checked; reset(); });
        return { v, c, el: h('label', null, c, 'VLAN ' + v) };
      });
      ctl[id] = { nat, checks };
      return h('fieldset', null, h('legend', null, VT_SWN[id] + ' พอร์ต Gi0/1 (Trunk)'), field('Native VLAN (ไม่มีแท็ก)', nat),
        h('div', { class: 'nlw-small', style: 'margin-top:6px' }, 'switchport trunk allowed vlan'), h('div', { class: 'nlwh-checks' }, checks.map(x => x.el)));
    };
    const pv = h('input', { type: 'checkbox', checked: cfg.pvst });
    pv.addEventListener('change', () => { cfg.pvst = pv.checked; reset(); });
    const srcSel = select(Object.keys(VT_HOSTS).map(k => [k, `${VT_HOSTS[k].name} (${VT_SWN[VT_HOSTS[k].sw]} ${VT_HOSTS[k].port}, VLAN ${VT_HOSTS[k].vlan})`]), 'lab1', 'เครื่องต้นทาง');
    const kindSel = select([['bcast', 'Broadcast: ARP Request'], ['ucast', 'Unicast ถึงเครื่อง VLAN เดียวกันอีกฝั่ง']], 'bcast', 'ชนิดเฟรม');
    srcSel.addEventListener('change', reset); kindSel.addEventListener('change', reset);
    const bSend = h('button', { type: 'button', class: 'nlw-btn nlw-primary' }, 'ส่งเฟรม');
    const bNext = h('button', { type: 'button', class: 'nlw-btn', disabled: true }, 'ขั้นถัดไป');
    const bAll = h('button', { type: 'button', class: 'nlw-btn', disabled: true }, 'แสดงทุกขั้น');
    const presets = [
      ['ค่าที่ถูกต้อง (Native 99)', () => DEF()],
      ['Native VLAN ไม่ตรงกัน', () => { const c = DEF(); c.sw1.native = 10; c.sw2.native = 20; c.pvst = false; return c; }],
      ['ลืมอนุญาต VLAN 20 ที่ SW2', () => { const c = DEF(); c.sw2.allowed[20] = false; return c; }]
    ].map(([t, f]) => h('button', { type: 'button', class: 'nlw-btn nlw-sm', onclick: () => { cfg = f(); syncCtl(); reset(); } }, t));
    const pic = h('div');
    const wire = h('div', { 'aria-live': 'polite' });
    const list = h('ol', { class: 'nlwh-steps', 'aria-live': 'polite' });
    const out = h('div');
    let run = null, idx = -1, lastNarrow = null;
    const isNarrow = () => (root.clientWidth || window.innerWidth || 640) < 520;
    if (window.ResizeObserver) new ResizeObserver(() => { if (lastNarrow !== null && isNarrow() !== lastNarrow) drawPic(); }).observe(root);
    function syncCtl() {
      ['sw1', 'sw2'].forEach(id => { ctl[id].nat.value = String(cfg[id].native); ctl[id].checks.forEach(x => { x.c.checked = !!cfg[id].allowed[x.v]; }); });
      pv.checked = cfg.pvst;
    }
    function drawPic() {
      const upto = run ? run.steps.slice(0, idx + 1).map(x => x.hl) : [];
      const cur = run && idx >= 0 ? run.steps[idx].hl : null;
      const recv = run && idx === run.steps.length - 1 ? run.recv : {};
      const label = run && idx >= 0 ? 'ภาพเครือข่าย ขั้นที่ ' + (idx + 1) + ': ' + run.steps[idx].t : 'ภาพเครือข่าย SW1 และ SW2 ต่อกันด้วย Trunk Gi0/1 แต่ละตัวมี LAB (VLAN 10) และ OFF (VLAN 20)';
      lastNarrow = isNarrow(); pic.replaceChildren(svgEl(vtSvg({ upto, cur, recv, cfg, src: srcSel.value, narrow: lastNarrow }), label));
      const w = run && idx >= 0 ? (run.steps.slice(0, idx + 1).filter(x => x.wire).pop() || {}).wire : null;
      wire.replaceChildren();
      if (w) {
        wire.append(h('div', { class: 'nlw-small' }, 'เฟรมบนสายช่วงล่าสุด:'),
          h('div', { class: 'nlwh-wire' }, h('span', null, 'DA ' + w.dst.split(' ')[0]), h('span', null, 'SA ' + w.src),
            w.tag ? h('span', { class: 'nlwh-tag' }, '8100 | VID ' + w.tag) : null, h('span', null, 'Type 0806/0800'), h('span', null, 'Data'), h('span', null, 'FCS')));
      }
    }
    function drawList() {
      list.replaceChildren(...(run ? run.steps.slice(0, idx + 1).map((st, i) => h('li', { class: 'nlwh-' + (st.k === 'info' ? 'x' : st.k) + (i === idx ? ' nlwh-now' : '') }, st.t)) : []));
      bNext.disabled = !run || idx >= run.steps.length - 1;
      bAll.disabled = bNext.disabled;
      out.replaceChildren();
      if (run && idx === run.steps.length - 1) {
        const bad = run.steps.some(x => x.k === 'bad');
        out.append(result(bad ? 'bad' : 'ok', run.outcome));
      }
      drawPic();
    }
    function reset() { run = null; idx = -1; drawList(); }
    bSend.addEventListener('click', () => { run = vtSimulate(cfg, srcSel.value, kindSel.value); idx = 0; drawList(); bNext.focus(); });
    bNext.addEventListener('click', () => { if (run && idx < run.steps.length - 1) { idx++; drawList(); if (bNext.disabled) bSend.focus(); } });
    bAll.addEventListener('click', () => { if (run) { idx = run.steps.length - 1; drawList(); bSend.focus(); } });
    root.append(
      h('div', { class: 'nlwh-grid' }, swBox('sw1'), swBox('sw2')),
      h('label', { class: 'nlw-check' }, pv, 'เปิดการตรวจ Native VLAN ของ PVST+ (แบบสวิตช์ Cisco และห้องจำลอง)'),
      h('div', { class: 'nlw-row' }, h('span', { class: 'nlw-small' }, 'ตัวอย่างการตั้งค่า:'), presets),
      h('div', { class: 'nlwh-row2' }, field('เครื่องต้นทาง', srcSel), field('ชนิดเฟรม', kindSel)),
      h('div', { class: 'nlw-row nlw-center' }, bSend, bNext, bAll),
      pic, wire, list, out,
      h('p', { class: 'nlw-small' }, 'แบบจำลองนี้ตัดรายละเอียดบางอย่างออก เช่น DTP และการเรียนรู้ MAC ทีละขั้น ส่วนกติกาการใส่แท็ก การถอดแท็ก Native VLAN และ Allowed list เป็นไปตาม IEEE 802.1Q และพฤติกรรมของสวิตช์ Cisco'));
    drawList();
  }
  NL_FIG('widget', 'vlan-trunk-lab', vlanTrunkLab);

  /* ===================================================================
     widget stp-root-calc
     =================================================================== */
  function stpRootCalc(root) {
    frame(root, 'คำนวณ Spanning Tree: Root Bridge และบทบาทพอร์ต',
      'แก้ Bridge Priority และ MAC ของสวิตช์ทั้งสามตัว หรือเปลี่ยนความเร็วลิงก์ ผลจะคำนวณใหม่ทันทีตามกติกา 802.1D: Bridge ID ต่ำสุดเป็น Root, Root Port คือทางที่ Cost ต่ำสุด, แต่ละลิงก์มี Designated Port หนึ่งพอร์ต และพอร์ตที่เหลือถูก Block');
    const st = JSON.parse(JSON.stringify(STP_DEF));
    const prOpts = []; for (let p = 0; p <= 61440; p += 4096) prOpts.push([p, String(p)]);
    const inputs = {};
    const swFs = ['A', 'B', 'C'].map(id => {
      const pr = select(prOpts, st.sw[id].prio, 'Bridge Priority ของ SW-' + id);
      const mac = h('input', { type: 'text', value: macDot(st.sw[id].mac), spellcheck: 'false', autocomplete: 'off', 'aria-label': 'MAC Address ของ SW-' + id, class: 'nlw-mono' });
      pr.addEventListener('change', () => { st.sw[id].prio = Number(pr.value); calc(); });
      mac.addEventListener('input', calc);
      inputs[id] = { pr, mac };
      return h('fieldset', null, h('legend', null, 'SW-' + id), field('Bridge Priority', pr), field('MAC Address', mac));
    });
    const spSel = {};
    const linkFs = h('fieldset', null, h('legend', null, 'ความเร็วลิงก์ (Path Cost แบบสั้น)'),
      h('div', { class: 'nlwh-row2' }, [['ab', 'SW-A ถึง SW-B'], ['bc', 'SW-B ถึง SW-C'], ['ac', 'SW-A ถึง SW-C']].map(([k, t]) => {
        const s = select(SPEEDS.map(x => [x[0], x[1] + ' (cost ' + x[2] + ')']), st.speeds[k], 'ความเร็ว ' + t);
        s.addEventListener('change', () => { st.speeds[k] = s.value; calc(); });
        spSel[k] = s;
        return field(t, s);
      })));
    const presets = [
      ['ค่าเริ่มต้น (Priority เท่ากัน)', () => JSON.parse(JSON.stringify(STP_DEF))],
      ['ให้ SW-C เป็น Root (Priority 4096)', () => { const c = JSON.parse(JSON.stringify(STP_DEF)); c.sw.C.prio = 4096; return c; }],
      ['ลิงก์ SW-A ถึง SW-B ช้า (100 Mb/s)', () => { const c = JSON.parse(JSON.stringify(STP_DEF)); c.speeds.ab = '100'; return c; }]
    ].map(([t, f]) => h('button', { type: 'button', class: 'nlw-btn nlw-sm', onclick: () => {
      const c = f(); st.sw = c.sw; st.speeds = c.speeds;
      ['A', 'B', 'C'].forEach(id => { inputs[id].pr.value = String(st.sw[id].prio); inputs[id].mac.value = macDot(st.sw[id].mac); });
      Object.keys(spSel).forEach(k => { spSel[k].value = st.speeds[k]; });
      calc();
    } }, t));
    const pic = h('div'); const outp = h('div', { 'aria-live': 'polite' });
    const isNarrow = () => (root.clientWidth || window.innerWidth || 640) < 520;
    let lastNarrow = null;
    if (window.ResizeObserver) new ResizeObserver(() => { if (lastNarrow !== null && isNarrow() !== lastNarrow) calc(); }).observe(root);
    function calc() {
      const errs = [];
      ['A', 'B', 'C'].forEach(id => {
        const m = macHex(inputs[id].mac.value);
        inputs[id].mac.classList.toggle('nlw-invalid', !m);
        inputs[id].mac.setAttribute('aria-invalid', m ? 'false' : 'true');
        if (!m) errs.push('MAC ของ SW-' + id + ' ต้องเป็นเลขฐาน 16 จำนวน 12 หลัก เช่น 0011.2233.0001 หรือ 00:11:22:33:00:01');
        else st.sw[id].mac = m;
      });
      if (!errs.length) {
        const ms = ['A', 'B', 'C'].map(id => st.sw[id].mac);
        if (new Set(ms).size < 3) errs.push('MAC ของสวิตช์ต้องไม่ซ้ำกัน (MAC จริงไม่ซ้ำกันทั่วโลก)');
      }
      if (errs.length) { outp.replaceChildren(result('warn', errs.join(' / '))); return; }
      const res = stpSolve(st.sw, st.speeds);
      const narrow = isNarrow(); lastNarrow = narrow;
      const tri = stpTriangle(st.sw, st.speeds, res, narrow ? STP_NARROW : STP_WIDE);
      pic.replaceChildren(svgEl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${narrow ? '0 0 360 406' : '0 0 640 392'}" font-family="inherit">${tri}</svg>`,
        'ผลการคำนวณ: SW-' + res.root + ' เป็น Root Bridge ' + Object.values(res.ports).filter(p => p.role === 'ALT').map(p => 'พอร์ต Gi0/' + p.port + ' ของ SW-' + p.sw + ' ถูก Block').join(' ')));
      const bidTxt = id => st.sw[id].prio + ' / ' + macDot(st.sw[id].mac);
      const order = ['A', 'B', 'C'].slice().sort((x, y) => bidCmp(st.sw[x], st.sw[y]));
      const steps = [];
      const samePr = st.sw[order[0]].prio === st.sw[order[1]].prio;
      steps.push(h('li', null, h('b', null, '1. เลือก Root Bridge: '), 'เรียง Bridge ID จากน้อยไปมาก ' + order.map(id => 'SW-' + id + ' (' + bidTxt(id) + ')').join(' < ') +
        ' ดังนั้น SW-' + res.root + ' เป็น Root ' + (samePr ? '(Priority เท่ากับตัวถัดไป จึงตัดสินด้วย MAC ที่ต่ำกว่า)' : '(Priority ต่ำกว่าจึงชนะทันทีโดยไม่ต้องดู MAC)')));
      ['A', 'B', 'C'].filter(x => x !== res.root).forEach(x => {
        const c = res.rpWhy[x];
        const parts = c.map(k => 'Gi0/' + k.port + ' ผ่าน SW-' + k.via + ' = ' + (k.nb ? k.nb + ' + ' : '') + k.link + ' = ' + k.c);
        let why = c[0].c < c[1].c ? 'Cost ต่ำกว่า' : bidCmp(st.sw[c[0].via], st.sw[c[1].via]) < 0 ? 'Cost เท่ากัน จึงเลือกทางที่สวิตช์ฝั่งตรงข้ามมี Bridge ID ต่ำกว่า' : 'Cost และ Bridge ID เท่ากัน จึงดู Port ID';
        steps.push(h('li', null, h('b', null, '2. Root Port ของ SW-' + x + ': '), parts.join(' และ ') + ' เลือก Gi0/' + res.rp[x] + ' เพราะ ' + why + ' (Root path cost ' + res.cost[x] + ')'));
      });
      res.segs.forEach(g => {
        const reason = g.des === res.root ? 'SW-' + g.des + ' เป็น Root พอร์ตทุกพอร์ตของ Root เป็น Designated'
          : g.why === 'cost' ? 'SW-' + g.des + ' ไปถึง Root ด้วย Cost ' + res.cost[g.des] + ' ต่ำกว่า SW-' + g.other + ' (' + res.cost[g.other] + ')'
            : g.why === 'bid' ? 'Cost เท่ากัน (' + res.cost[g.des] + ') SW-' + g.des + ' มี Bridge ID ต่ำกว่า' : 'Cost และ Bridge ID เท่ากัน จึงดู Port ID';
        steps.push(h('li', null, h('b', null, '3. ลิงก์ SW-' + g.x + ' ถึง SW-' + g.y + ': '), 'Designated คือ Gi0/' + PORT_OF[g.des][g.other] + ' ของ SW-' + g.des + ' เพราะ ' + reason +
          ' ฝั่ง SW-' + g.other + ' (Gi0/' + PORT_OF[g.other][g.des] + ') ' + (g.otherRole === 'R' ? 'เป็น Root Port ของตัวเองอยู่แล้ว' : 'ไม่ใช่ทั้ง Root Port และ Designated จึงถูก Block (Alternate)')));
      });
      const rows = Object.keys(res.ports).sort().map(k => {
        const p = res.ports[k];
        return h('tr', { class: p.role === 'ALT' ? 'nlwh-hit' : null }, h('td', null, 'SW-' + p.sw + ' ', h('span', { class: 'nlwh-mono' }, 'Gi0/' + p.port)), h('td', null, 'SW-' + p.to),
          h('td', null, ROLE_TXT[p.role]), h('td', null, p.role === 'ALT' ? 'Blocking / Discarding' : 'Forwarding / Forwarding'));
      });
      outp.replaceChildren(
        result('ok', 'Root Bridge: SW-' + res.root + '   พอร์ตที่ถูก Block: ' + Object.values(res.ports).filter(p => p.role === 'ALT').map(p => 'SW-' + p.sw + ' Gi0/' + p.port).join(', ')),
        h('ol', { class: 'nlwh-log', style: 'list-style:none' }, steps),
        h('div', { class: 'nlwh-scroll' }, h('table', { class: 'nlwh-t' }, h('caption', { class: 'nlw-small', style: 'text-align:left' }, 'บทบาทและสถานะพอร์ตหลังคำนวณเสร็จ (Converged)'),
          h('thead', null, h('tr', null, ['พอร์ต', 'ต่อไปยัง', 'บทบาท', 'สถานะ 802.1D / RSTP'].map(t => h('th', { scope: 'col' }, t)))), h('tbody', null, rows))),
        h('p', { class: 'nlw-small' }, 'บนสวิตช์ Cisco ที่ใช้ PVST+ ค่า Priority ที่แสดงจะบวกหมายเลข VLAN ด้วย เช่น 32768 + VLAN 1 = 32769 แต่ทุกสวิตช์บวกเลขเดียวกัน ผลการเลือก Root จึงเหมือนเดิม Port ID ในแบบจำลองนี้คือ 128.1 สำหรับ Gi0/1 และ 128.2 สำหรับ Gi0/2'));
    }
    root.append(h('div', { class: 'nlwh-grid' }, swFs), linkFs, h('div', { class: 'nlw-row' }, h('span', { class: 'nlw-small' }, 'ลองสถานการณ์:'), presets), pic, outp);
    calc();
  }
  NL_FIG('widget', 'stp-root-calc', stpRootCalc);

  /* ===================================================================
     widget nat-pat-lab: NAT translation table stepper
     =================================================================== */
  const NP = {
    wan: '198.51.100.2', pool: ['198.51.100.4', '198.51.100.5'],
    statics: { '192.168.1.10': '198.51.100.3', '192.168.1.11': '198.51.100.6' },
    hosts: [['192.168.1.10', 'Server', 40000], ['192.168.1.11', 'PC1', 50001], ['192.168.1.12', 'PC2', 50001], ['192.168.1.13', 'PC3', 51000]],
    dests: [['web', 'tcp', '203.0.113.80', 443, 'เว็บ www.netlab.test (TCP 443)'], ['dns', 'udp', '8.8.8.8', 53, 'DNS 8.8.8.8 (UDP 53)']],
    outside: '192.0.2.50'
  };
  const hostName = ip => (NP.hosts.find(x => x[0] === ip) || [ip, ip])[1];
  function natPatLab(root) {
    frame(root, 'ตาราง NAT ทีละแพ็กเก็ต (ร้านค้าใช้ LAN 192.168.1.0/24)',
      'เลือกโหมด NAT แล้วส่งแพ็กเก็ตจากเครื่องในร้านทีละเครื่อง ดูว่า Router เปลี่ยน IP และพอร์ตต้นทางอย่างไร และตาราง NAT เพิ่มแถวใด ลองให้ PC1 และ PC2 ใช้พอร์ตต้นทางเดียวกัน กด "ส่งคำตอบกลับ" ในแถวของตาราง และลองให้เครื่องภายนอกเชื่อมต่อเข้ามาเองทั้งแบบเปิดและปิด Port Forwarding');
    let mode = 'pat', pf = false, table = [], lastKey = null, dynMap = {};
    const modeSel = select([['pat', 'PAT (Overload) บน ' + NP.wan], ['dynamic', 'Dynamic NAT: Pool ' + NP.pool[0] + ' ถึง .5'], ['static', 'Static NAT: .10 คู่ .3 และ .11 คู่ .6']], mode, 'โหมด NAT');
    const pfChk = h('input', { type: 'checkbox' });
    const hostSel = select(NP.hosts.map(x => [x[0], x[1] + ' ' + x[0]]), '192.168.1.11', 'เครื่องต้นทาง');
    const dstSel = select(NP.dests.map(x => [x[0], x[4]]), 'web', 'ปลายทาง');
    const sport = h('input', { type: 'number', min: '1024', max: '65535', value: '50001', inputmode: 'numeric', 'aria-label': 'พอร์ตต้นทาง' });
    hostSel.addEventListener('change', () => { sport.value = String(NP.hosts.find(x => x[0] === hostSel.value)[2]); });
    const bSend = h('button', { type: 'button', class: 'nlw-btn nlw-primary' }, 'ส่งแพ็กเก็ตออก');
    const bClear = h('button', { type: 'button', class: 'nlw-btn' }, 'ล้างตาราง');
    const inIp = select([[NP.wan, NP.wan + ' (ขา WAN)'], ['198.51.100.3', '198.51.100.3'], ['198.51.100.4', '198.51.100.4'], ['198.51.100.6', '198.51.100.6']], NP.wan, 'IP ปลายทางของการเชื่อมต่อขาเข้า');
    const inPort = select([[443, 'TCP 443 (HTTPS)'], [3389, 'TCP 3389 (Remote Desktop)'], [22, 'TCP 22 (SSH)']], 443, 'พอร์ตปลายทางของการเชื่อมต่อขาเข้า');
    const bIn = h('button', { type: 'button', class: 'nlw-btn' }, 'เครื่องภายนอกเชื่อมต่อเข้ามา');
    const tWrap = h('div', { class: 'nlwh-scroll' });
    const log = h('ul', { class: 'nlwh-log', 'aria-live': 'polite' });
    const addLog = (k, ...c) => { log.prepend(h('li', { class: 'nlwh-' + k }, ...c)); while (log.children.length > 6) log.lastChild.remove(); };
    const code = t => h('code', null, t);
    const ap = (ip, p) => ip + ':' + p;
    function drawTable() {
      const rows = [];
      if (mode === 'static') Object.keys(NP.statics).forEach(l => rows.push({ type: 'static', proto: '---', ig: NP.statics[l], il: l, og: '---', perm: true }));
      if (pf) rows.push({ type: 'forward', proto: 'tcp', ig: ap(NP.wan, 443), il: ap('192.168.1.10', 443), og: '---', perm: true });
      if (mode === 'dynamic') Object.keys(dynMap).forEach(l => rows.push({ type: 'dynamic', proto: '---', ig: dynMap[l], il: l, og: '---', perm: true, simple: true }));
      table.forEach(r => rows.push(r));
      const head = h('tr', null, ['ชนิด', 'Pro', 'Inside global', 'Inside local', 'Outside global', ''].map(t => h('th', { scope: 'col' }, t)));
      const body = rows.length ? rows.map(r => h('tr', { class: r.key && r.key === lastKey ? 'nlwh-new' : null },
        h('td', null, r.type === 'forward' ? 'Port Forward' : r.type), h('td', { class: 'nlwh-m' }, r.proto), h('td', { class: 'nlwh-m' }, r.ig), h('td', { class: 'nlwh-m' }, r.il), h('td', { class: 'nlwh-m' }, r.og),
        h('td', null, r.perm ? h('span', { class: 'nlw-small' }, r.simple ? 'ยืมอยู่' : 'ถาวร') : h('button', { type: 'button', class: 'nlw-btn nlw-sm', onclick: () => reply(r), 'aria-label': 'ส่งคำตอบกลับจาก ' + r.og + ' ถึง ' + r.ig }, 'ส่งคำตอบกลับ'))))
        : [h('tr', null, h('td', { colspan: '6', class: 'nlw-small' }, 'ตารางยังว่าง ส่งแพ็กเก็ตออกเพื่อสร้างแถว'))];
      tWrap.replaceChildren(h('table', { class: 'nlwh-t' }, h('caption', { class: 'nlw-small', style: 'text-align:left' }, 'ตาราง NAT ของ Router (แบบ show ip nat translations ' + (mode === 'pat' ? 'แถวละหนึ่ง IP:พอร์ต' : 'แถว --- คือการจับคู่ IP อย่างเดียว') + ')'), h('thead', null, head), h('tbody', null, body)));
    }
    function usedPort(proto, p) {
      return table.some(r => r.proto === proto && r.ig === ap(NP.wan, p)) || (pf && proto === 'tcp' && p === 443);
    }
    function send() {
      const il = hostSel.value; const d = NP.dests.find(x => x[0] === dstSel.value);
      const p = Number(sport.value);
      if (!Number.isInteger(p) || p < 1024 || p > 65535) { sport.classList.add('nlw-invalid'); addLog('warn', 'พอร์ตต้นทางของเครื่องลูกข่ายควรเป็นเลข 1024 ถึง 65535 (ระบบปฏิบัติการสุ่มจากช่วง Dynamic เช่น 49152 ถึง 65535)'); return; }
      sport.classList.remove('nlw-invalid');
      const [, proto, dip, dport] = d;
      const before = ap(il, p) + ' ไป ' + ap(dip, dport);
      const og = ap(dip, dport);
      const exist = table.find(r => r.il === ap(il, p) && r.og === og && r.proto === proto);
      if (exist) { lastKey = exist.key; drawTable(); addLog('ok', 'เป็นการเชื่อมต่อเดิม Router ใช้แถวเดิม ', code(exist.il), ' เป็น ', code(exist.ig)); return; }
      let ig, why;
      if (mode === 'static') {
        const g = NP.statics[il];
        if (!g) { addLog('bad', hostName(il) + ' (' + il + ') ไม่มีการจับคู่ Static NAT จึงไม่ถูกแปลง แพ็กเก็ตออกไปด้วย Private IP และ ISP ทิ้ง: Static NAT ต้องจับคู่ให้ทีละเครื่อง'); return; }
        ig = ap(g, p); why = 'ใช้คู่ Static ' + il + ' กับ ' + g + ' พอร์ตไม่เปลี่ยน';
      } else if (mode === 'dynamic') {
        let g = dynMap[il];
        if (!g) {
          g = NP.pool.find(x => !Object.values(dynMap).includes(x));
          if (!g) { addLog('bad', 'Pool หมดแล้ว (' + NP.pool.join(', ') + ' ถูกยืมไปหมด) ' + hostName(il) + ' จึงออกอินเทอร์เน็ตไม่ได้จนกว่าจะมีการคืน IP นี่คือข้อจำกัดของ Dynamic NAT ที่ PAT แก้ได้'); return; }
          dynMap[il] = g; why = 'ยืม ' + g + ' จาก Pool ให้ ' + hostName(il) + ' (1 ต่อ 1) พอร์ตไม่เปลี่ยน';
        } else why = hostName(il) + ' ยืม ' + g + ' อยู่แล้ว ใช้ IP เดิม';
        ig = ap(g, p);
      } else {
        let gp = p; let k = 0;
        while (usedPort(proto, gp) && k < 70000) { gp = gp >= 65535 ? 1024 : gp + 1; k++; }
        ig = ap(NP.wan, gp);
        why = gp === p ? 'พอร์ต ' + p + ' ของ ' + NP.wan + ' ยังว่าง จึงใช้พอร์ตเดิม' : 'พอร์ต ' + p + ' ของ ' + NP.wan + ' ถูกใช้แล้ว จึงเลือกพอร์ตถัดไปที่ว่างคือ ' + gp;
      }
      const row = { key: 'r' + Date.now() + Math.random(), type: mode === 'pat' ? 'PAT' : mode, proto, ig, il: ap(il, p), og };
      table.push(row); lastKey = row.key; drawTable();
      addLog('ok', h('b', null, hostName(il) + ' ส่งออก: '), 'ก่อน NAT ', code('src ' + before.split(' ไป ')[0]), ' หลัง NAT ', code('src ' + ig), ' ปลายทาง ', code(og), ' (' + why + ')');
    }
    function reply(r) {
      lastKey = r.key; drawTable();
      addLog('ok', h('b', null, 'คำตอบกลับ: '), code('src ' + r.og + ' dst ' + r.ig), ' Router ค้นตารางพบ Inside global ' + r.ig + ' จึงเปลี่ยนปลายทางเป็น ', code(r.il), ' แล้วส่งให้ ' + hostName(r.il.split(':')[0]));
    }
    function inbound() {
      const dip = inIp.value, dp = Number(inPort.value);
      const pkt = 'src ' + NP.outside + ':52000 dst ' + ap(dip, dp);
      const risky = dp === 3389 || dp === 22;
      if (mode === 'static') {
        const l = Object.keys(NP.statics).find(x => NP.statics[x] === dip);
        if (l) { addLog(risky ? 'bad' : 'warn', h('b', null, 'ขาเข้า: '), code(pkt), ' ตรงกับ Static NAT ' + dip + ' คู่กับ ' + l + ' ทุกพอร์ต จึงส่งต่อถึง ' + hostName(l) + ' พอร์ต ' + dp + (risky ? ' เท่ากับเปิดบริการนี้ให้คนทั้งอินเทอร์เน็ต อันตราย' : '')); return; }
      }
      if (pf && dip === NP.wan && dp === 443) { addLog('ok', h('b', null, 'ขาเข้า: '), code(pkt), ' ตรงกับ Port Forwarding TCP ' + NP.wan + ':443 จึงเปลี่ยนปลายทางเป็น ', code('192.168.1.10:443'), ' เปิดเฉพาะเว็บของ Server'); return; }
      if (mode === 'dynamic') {
        const l = Object.keys(dynMap).find(x => dynMap[x] === dip);
        if (l) { addLog('warn', h('b', null, 'ขาเข้า: '), code(pkt), ' ' + dip + ' ถูกยืมให้ ' + hostName(l) + ' อยู่ Router แบบ Cisco มีแถวจับคู่ IP นี้ จึงส่งต่อถึง ' + l + ' ได้ตราบที่ยังยืมอยู่'); return; }
      }
      addLog('bad', h('b', null, 'ขาเข้า: '), code(pkt), ' ไม่มีแถวใดในตาราง NAT ที่ตรงกับ ' + ap(dip, dp) + ' Router ไม่รู้ว่าจะส่งให้เครื่องใดจึงทิ้ง (ผลข้างเคียงของ NAT ไม่ใช่กฎไฟร์วอลล์)' + (dp === 443 && dip === NP.wan && !pf ? ' ถ้าต้องการเปิดเว็บของ Server ให้ติ๊ก Port Forwarding' : ''));
    }
    modeSel.addEventListener('change', () => { mode = modeSel.value; table = []; dynMap = {}; lastKey = null; drawTable(); log.replaceChildren(); addLog('ok', 'เปลี่ยนโหมดเป็น ' + modeSel.options[modeSel.selectedIndex].text + ' และล้างตาราง'); });
    pfChk.addEventListener('change', () => { pf = pfChk.checked; drawTable(); });
    bSend.addEventListener('click', send);
    bClear.addEventListener('click', () => { table = []; dynMap = {}; lastKey = null; drawTable(); log.replaceChildren(); });
    bIn.addEventListener('click', inbound);
    root.append(
      h('div', { class: 'nlwh-panel' }, h('h4', null, 'การตั้งค่า Router (ขา WAN ' + NP.wan + ', ISP ให้วง 198.51.100.0/29)'),
        field('โหมด NAT', modeSel),
        h('label', { class: 'nlw-check' }, pfChk, 'Port Forwarding: TCP ' + NP.wan + ':443 ไปที่ Server 192.168.1.10:443')),
      h('div', { class: 'nlwh-panel' }, h('h4', null, 'ส่งแพ็กเก็ตจากเครื่องในร้าน'),
        h('div', { class: 'nlwh-row2' }, field('เครื่องต้นทาง', hostSel), field('ปลายทาง', dstSel), field('พอร์ตต้นทาง', sport)),
        h('div', { class: 'nlw-row nlw-center' }, bSend, bClear)),
      tWrap,
      h('div', { class: 'nlwh-panel' }, h('h4', null, 'เครื่องภายนอก ' + NP.outside + ' เริ่มเชื่อมต่อเข้ามาเอง'),
        h('div', { class: 'nlwh-row2' }, field('IP ปลายทาง', inIp), field('พอร์ตปลายทาง', inPort)), h('div', { class: 'nlw-row' }, bIn)),
      h('div', { class: 'nlw-small' }, 'ผลล่าสุดอยู่บนสุด'), log,
      h('p', { class: 'nlw-small' }, 'การเลือกพอร์ตใหม่เมื่อชนกันใช้วิธี "พอร์ตถัดไปที่ว่าง" เหมือนห้องจำลอง อุปกรณ์จริงแต่ละยี่ห้ออาจสุ่มพอร์ตแทน และแถวในตารางจริงจะหมดอายุเมื่อไม่มีการใช้งานระยะหนึ่ง'));
    drawTable();
  }
  NL_FIG('widget', 'nat-pat-lab', natPatLab);

  /* ===================================================================
     widget acl-lab: Cisco-style numbered ACL first-match tester with wildcard maths
     =================================================================== */
  const ipToInt = s => { const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim()); if (!m) return null; const o = m.slice(1).map(Number); if (o.some(x => x > 255)) return null; return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3]; };
  const intToIp = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const PORTKW = { www: 80, domain: 53, telnet: 23, ftp: 21, 'ftp-data': 20, smtp: 25, pop3: 110, bootps: 67, bootpc: 68, tftp: 69, snmp: 161, ntp: 123 };
  const isMaskLike = w => { if (w === 0 || w === 0xffffffff) return false; const inv = (~w) >>> 0; return ((inv + 1) & inv) === 0 && (w >>> 31) === 1; }; // contiguous ones from the left
  function aclParse(text) {
    const rules = [], problems = []; let num = null, kind = null;
    String(text).split(/\r?\n/).forEach((raw, li) => {
      const line = raw.trim(); if (!line || line[0] === '!') return;
      const tk = line.split(/\s+/); let i = 0; const err = m => { rules.push({ raw: line, li: li + 1, err: m }); };
      let n = null;
      if (/^access-list$/i.test(tk[0])) { n = Number(tk[1]); i = 2; if (!Number.isInteger(n)) return err('ต้องมีหมายเลข ACL หลัง access-list'); }
      else if (/^\d+$/.test(tk[0]) && /^(permit|deny)$/i.test(tk[1] || '')) i = 1; // sequence number of a named ACL
      if (n !== null) {
        const k = (n >= 1 && n <= 99) || (n >= 1300 && n <= 1999) ? 'standard' : (n >= 100 && n <= 199) || (n >= 2000 && n <= 2699) ? 'extended' : null;
        if (!k) return err('หมายเลข ' + n + ' ไม่ใช่ IPv4 ACL (Standard 1–99, 1300–1999 / Extended 100–199, 2000–2699)');
        if (num !== null && num !== n) problems.push('มี ACL หลายหมายเลข (' + num + ' และ ' + n + ') เครื่องมือนี้ทดสอบทีละชุด จึงใช้เฉพาะบรรทัดของ ACL ' + num);
        if (num !== null && num !== n) return;
        num = n; kind = k;
      }
      const act = (tk[i] || '').toLowerCase();
      if (act === 'remark') return;
      if (act !== 'permit' && act !== 'deny') return err('ต้องขึ้นต้นด้วย permit หรือ deny');
      i++;
      const k = kind || (/^(ip|tcp|udp|icmp)$/i.test(tk[i] || '') ? 'extended' : 'standard');
      const addr = () => {
        const a = (tk[i] || '').toLowerCase();
        if (a === 'any') { i++; return { a: 0, w: 0xffffffff, txt: 'any' }; }
        if (a === 'host') { const ip = ipToInt(tk[i + 1] || ''); if (ip === null) return { e: 'ต้องมี IP หลัง host' }; i += 2; return { a: ip, w: 0, txt: 'host ' + intToIp(ip) }; }
        const ip = ipToInt(tk[i] || ''); if (ip === null) return { e: 'ที่อยู่ "' + (tk[i] || '') + '" ไม่ถูกต้อง ใช้ any, host A หรือ A W' };
        i++;
        let w = 0; const wi = ipToInt(tk[i] || '');
        if (wi !== null) { w = wi; i++; } else if (k === 'extended') return { e: 'Extended ACL ต้องมี Wildcard หลังที่อยู่ ' + intToIp(ip) + ' (หรือใช้ host)' };
        const o = { a: ip, w, txt: intToIp(ip) + ' ' + intToIp(w) };
        if (isMaskLike(w)) o.mask = true;
        if ((ip & w) !== 0) o.fix = intToIp((ip & ~w) >>> 0);
        return o;
      };
      const portspec = () => {
        if ((tk[i] || '').toLowerCase() !== 'eq') return null;
        const v = (tk[i + 1] || '').toLowerCase(); i += 2;
        const p = /^\d+$/.test(v) ? Number(v) : PORTKW[v];
        if (p === undefined || p < 0 || p > 65535) return { e: 'ไม่รู้จักพอร์ต "' + v + '" ใช้ตัวเลข เช่น eq 443' };
        return { p, txt: 'eq ' + v };
      };
      let r;
      if (k === 'standard') {
        const s = addr(); if (s.e) return err(s.e);
        r = { act, kind: k, proto: 'ip', src: s, dst: null };
      } else {
        const proto = (tk[i] || '').toLowerCase();
        if (!/^(ip|tcp|udp|icmp)$/.test(proto)) return err('โปรโตคอลต้องเป็น ip, tcp, udp หรือ icmp');
        i++;
        const s = addr(); if (s.e) return err(s.e);
        const sp = portspec(); if (sp && sp.e) return err(sp.e);
        const d = addr(); if (d.e) return err(d.e);
        const dp = portspec(); if (dp && dp.e) return err(dp.e);
        let est = false;
        if ((tk[i] || '').toLowerCase() === 'established') { est = true; i++; }
        if ((sp || dp || est) && proto !== 'tcp' && proto !== 'udp') return err('ระบุพอร์ตหรือ established ได้เฉพาะ tcp หรือ udp');
        if (est && proto !== 'tcp') return err('established ใช้ได้กับ tcp เท่านั้น');
        r = { act, kind: k, proto, src: s, dst: d, sp, dp, est };
      }
      if (i < tk.length) return err('มีคำเกินมา: "' + tk.slice(i).join(' ') + '"');
      r.raw = line; r.li = li + 1;
      rules.push(r);
    });
    return { rules, problems, num, kind };
  }
  function octetWhy(pkt, a, w) {
    // explain the match per octet
    const out = []; let ok = true;
    for (let o = 0; o < 4; o++) {
      const sh = 24 - o * 8, pv = (pkt >>> sh) & 255, av = (a >>> sh) & 255, wv = (w >>> sh) & 255;
      const m = ((pv ^ av) & (~wv & 255)) === 0;
      if (!m) ok = false;
      if (wv === 255) out.push('ออกเต็ต ' + (o + 1) + ': Wildcard 255 ไม่สนใจ');
      else if (wv === 0) out.push('ออกเต็ต ' + (o + 1) + ': ต้องเป็น ' + av + ' ได้ ' + pv + (m ? ' ตรง' : ' ไม่ตรง'));
      else {
        const b = x => x.toString(2).padStart(8, '0');
        out.push('ออกเต็ต ' + (o + 1) + ': Wildcard ' + wv + ' (' + b(wv) + ') เทียบเฉพาะบิตที่เป็น 0: กฎ ' + b(av) + ' แพ็กเก็ต ' + b(pv) + (m ? ' ตรง' : ' ไม่ตรง'));
      }
    }
    return { ok, out };
  }
  function aclEval(parsed, pkt) {
    const rows = []; let hit = null;
    parsed.rules.forEach((r, idx) => {
      if (r.err) { rows.push({ r, state: 'err' }); return; }
      if (hit) { rows.push({ r, state: 'skip' }); return; }
      const why = []; let m = true;
      if (r.proto !== 'ip' && r.proto !== pkt.proto) { m = false; why.push('โปรโตคอลของกฎคือ ' + r.proto + ' แต่แพ็กเก็ตเป็น ' + pkt.proto); }
      const sw = r.src.w === 0xffffffff ? { ok: true, out: ['any ตรงทุก IP'] } : octetWhy(pkt.src, r.src.a, r.src.w);
      why.push('IP ต้นทาง ' + intToIp(pkt.src) + ' เทียบ ' + r.src.txt + ': ' + (sw.ok ? 'ตรง' : 'ไม่ตรง'));
      if (!sw.ok) m = false;
      let detail = [{ t: 'ต้นทาง', o: sw.out }];
      if (r.dst) {
        const dw = r.dst.w === 0xffffffff ? { ok: true, out: ['any ตรงทุก IP'] } : octetWhy(pkt.dst, r.dst.a, r.dst.w);
        why.push('IP ปลายทาง ' + intToIp(pkt.dst) + ' เทียบ ' + r.dst.txt + ': ' + (dw.ok ? 'ตรง' : 'ไม่ตรง'));
        if (!dw.ok) m = false;
        detail.push({ t: 'ปลายทาง', o: dw.out });
      } else why.push('Standard ACL ไม่ดูปลายทาง โปรโตคอล และพอร์ต');
      if (r.dp) { const pm = pkt.proto === r.proto && pkt.dport === r.dp.p; why.push('พอร์ตปลายทาง ' + (pkt.proto === 'icmp' ? '(ICMP ไม่มีพอร์ต)' : pkt.dport) + ' เทียบ eq ' + r.dp.p + ': ' + (pm ? 'ตรง' : 'ไม่ตรง')); if (!pm) m = false; }
      if (r.sp) { const pm = pkt.proto === r.proto && pkt.sport === r.sp.p; why.push('พอร์ตต้นทาง ' + pkt.sport + ' เทียบ eq ' + r.sp.p + ': ' + (pm ? 'ตรง' : 'ไม่ตรง')); if (!pm) m = false; }
      if (r.est) { const em = pkt.proto === 'tcp' && pkt.ack; why.push('established ต้องมีบิต ACK หรือ RST: ' + (em ? 'มี ตรง' : 'ไม่มี (แพ็กเก็ตเริ่มการเชื่อมต่อ) ไม่ตรง')); if (!em) m = false; }
      if (m) hit = { idx, r };
      rows.push({ r, state: m ? 'hit' : 'miss', why, detail });
    });
    return { rows, hit };
  }
  const ACL_PRESETS = [
    ['นโยบาย Guest (ACL 120)', 'access-list 120 remark Guest เปิดเว็บบริษัทได้ ห้ามเข้าภายใน ใช้เน็ตได้\naccess-list 120 permit tcp 192.168.50.0 0.0.0.255 host 192.168.30.10 eq 80\naccess-list 120 permit tcp 192.168.50.0 0.0.0.255 host 192.168.30.10 eq 443\naccess-list 120 deny ip 192.168.50.0 0.0.0.255 192.168.0.0 0.0.255.255\naccess-list 120 permit ip 192.168.50.0 0.0.0.255 any'],
    ['ลำดับผิด (deny กว้างอยู่ก่อน)', 'access-list 120 deny ip 192.168.50.0 0.0.0.255 192.168.0.0 0.0.255.255\naccess-list 120 permit tcp 192.168.50.0 0.0.0.255 host 192.168.30.10 eq 80\naccess-list 120 permit tcp 192.168.50.0 0.0.0.255 host 192.168.30.10 eq 443\naccess-list 120 permit ip 192.168.50.0 0.0.0.255 any'],
    ['ใส่ Subnet mask ในช่อง Wildcard', 'access-list 120 permit tcp 192.168.50.0 255.255.255.0 host 192.168.30.10 eq 443\naccess-list 120 deny ip any any'],
    ['Standard ACL 10', 'access-list 10 deny 192.168.50.0 0.0.0.255\naccess-list 10 permit any'],
    ['ACL ขาออกที่ต้องรับคำตอบ (established)', 'access-list 130 permit tcp host 192.168.30.10 eq 443 192.168.50.0 0.0.0.255 established\naccess-list 130 deny ip any any']
  ];
  const PKT_PRESETS = [
    ['HTTPS ไปเว็บบริษัท', { proto: 'tcp', src: '192.168.50.20', dst: '192.168.30.10', dport: 443, sport: 50123, ack: false }],
    ['SSH ไปเว็บบริษัท', { proto: 'tcp', src: '192.168.50.20', dst: '192.168.30.10', dport: 22, sport: 50124, ack: false }],
    ['SMB ไปไฟล์เซิร์ฟเวอร์', { proto: 'tcp', src: '192.168.50.20', dst: '192.168.30.20', dport: 445, sport: 50125, ack: false }],
    ['เว็บบนอินเทอร์เน็ต', { proto: 'tcp', src: '192.168.50.20', dst: '203.0.113.80', dport: 443, sport: 50126, ack: false }],
    ['Ping ไปเว็บบริษัท', { proto: 'icmp', src: '192.168.50.20', dst: '192.168.30.10', dport: 0, sport: 0, ack: false }],
    ['คำตอบจากเว็บบริษัท', { proto: 'tcp', src: '192.168.30.10', dst: '192.168.50.20', dport: 50123, sport: 443, ack: true }],
    ['จากวงพนักงาน', { proto: 'tcp', src: '192.168.20.15', dst: '192.168.30.10', dport: 443, sport: 50200, ack: false }]
  ];
  function aclLab(root) {
    frame(root, 'ทดสอบ ACL แบบ Cisco: กฎแรกที่ตรงชนะ',
      'พิมพ์หรือแก้บรรทัด ACL (บรรทัดละหนึ่งกฎ รองรับ access-list หมายเลข Standard และ Extended, any, host, Wildcard, eq พอร์ต และ established) แล้วกำหนดแพ็กเก็ตที่จะทดสอบ กด "ทดสอบแพ็กเก็ต" ระบบจะเทียบทีละบรรทัด แสดงการคำนวณ Wildcard บอกบรรทัดแรกที่ตรง หรือ Implicit Deny ถ้าไม่ตรงเลย');
    const ta = h('textarea', { class: 'nlwh-acl', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'บรรทัด ACL' });
    ta.value = ACL_PRESETS[0][1];
    const aclBtns = ACL_PRESETS.map(([t, v]) => h('button', { type: 'button', class: 'nlw-btn nlw-sm', onclick: () => { ta.value = v; run(); } }, t));
    const proto = select([['tcp', 'TCP'], ['udp', 'UDP'], ['icmp', 'ICMP (ping)']], 'tcp', 'โปรโตคอล');
    const src = h('input', { type: 'text', value: '192.168.50.20', spellcheck: 'false', autocomplete: 'off', class: 'nlw-mono' });
    const dst = h('input', { type: 'text', value: '192.168.30.10', spellcheck: 'false', autocomplete: 'off', class: 'nlw-mono' });
    const dport = h('input', { type: 'number', min: '0', max: '65535', value: '443', inputmode: 'numeric' });
    const sport = h('input', { type: 'number', min: '0', max: '65535', value: '50123', inputmode: 'numeric' });
    const ack = h('input', { type: 'checkbox' });
    const pktBtns = PKT_PRESETS.map(([t, p]) => h('button', { type: 'button', class: 'nlw-btn nlw-sm', onclick: () => { proto.value = p.proto; src.value = p.src; dst.value = p.dst; dport.value = String(p.dport); sport.value = String(p.sport); ack.checked = p.ack; syncProto(); run(); } }, t));
    const bRun = h('button', { type: 'button', class: 'nlw-btn nlw-primary' }, 'ทดสอบแพ็กเก็ต');
    const out = h('div', { 'aria-live': 'polite' });
    function syncProto() { const ic = proto.value === 'icmp'; dport.disabled = ic; sport.disabled = ic; ack.disabled = proto.value !== 'tcp'; }
    proto.addEventListener('change', syncProto);
    function run() {
      const errs = [];
      const s = ipToInt(src.value), d = ipToInt(dst.value);
      src.classList.toggle('nlw-invalid', s === null); dst.classList.toggle('nlw-invalid', d === null);
      if (s === null || d === null) errs.push('IP ต้นทางและปลายทางต้องเป็น IPv4 เช่น 192.168.50.20');
      const pr = proto.value;
      const dp = Number(dport.value), sp = Number(sport.value);
      if (pr !== 'icmp' && (!Number.isInteger(dp) || dp < 0 || dp > 65535 || !Number.isInteger(sp) || sp < 0 || sp > 65535)) errs.push('พอร์ตต้องเป็นเลข 0 ถึง 65535');
      if (errs.length) { out.replaceChildren(result('warn', errs.join(' '))); return; }
      const parsed = aclParse(ta.value);
      const pkt = { proto: pr, src: s, dst: d, dport: pr === 'icmp' ? null : dp, sport: pr === 'icmp' ? null : sp, ack: pr === 'tcp' && ack.checked };
      const ev = aclEval(parsed, pkt);
      const items = ev.rows.map(x => {
        const r = x.r;
        const cls = x.state === 'err' ? 'nlwh-err' : x.state === 'skip' ? 'nlwh-skip' : x.state === 'hit' ? (r.act === 'permit' ? 'nlwh-hitp' : 'nlwh-hitd') : '';
        const head = x.state === 'err' ? 'บรรทัด ' + r.li + ' ผิดรูปแบบ (ไม่ถูกนำมาใช้): ' + r.err
          : x.state === 'skip' ? 'ไม่ถูกตรวจ เพราะตัดสินที่บรรทัดก่อนหน้าแล้ว'
            : x.state === 'hit' ? 'ตรงเป็นบรรทัดแรก: ' + (r.act === 'permit' ? 'อนุญาต (permit)' : 'ทิ้ง (deny)') + ' หยุดตรวจ' : 'ไม่ตรง ไปบรรทัดถัดไป';
        const warn = [];
        if (r.src && r.src.mask) warn.push('ช่อง Wildcard ของต้นทาง (' + intToIp(r.src.w) + ') เป็นรูปแบบ Subnet mask เราเตอร์จะตีความตามตัวอักษรว่า "สนใจเฉพาะออกเต็ตสุดท้าย" ซึ่งไม่ใช่สิ่งที่ตั้งใจ ควรใช้ ' + intToIp((~r.src.w) >>> 0));
        if (r.dst && r.dst.mask) warn.push('ช่อง Wildcard ของปลายทาง (' + intToIp(r.dst.w) + ') เป็นรูปแบบ Subnet mask ควรใช้ ' + intToIp((~r.dst.w) >>> 0));
        if (r.src && r.src.fix) warn.push('ที่อยู่ต้นทางมีบิตในส่วนที่ Wildcard ไม่สนใจ IOS จะเก็บเป็น ' + r.src.fix);
        if (r.dst && r.dst.fix) warn.push('ที่อยู่ปลายทางมีบิตในส่วนที่ Wildcard ไม่สนใจ IOS จะเก็บเป็น ' + r.dst.fix);
        return h('li', { class: cls }, h('span', { class: 'nlwh-line' }, r.raw), h('div', null, head),
          x.why ? h('small', null, x.why.join(' / ')) : null,
          x.detail && x.state !== 'skip' ? h('details', null, h('summary', { class: 'nlw-small' }, 'ดูการคำนวณ Wildcard ทีละออกเต็ต'), x.detail.map(dd => h('div', { class: 'nlwh-bits' }, dd.t + ': ' + dd.o.join(' | ')))) : null,
          warn.length ? h('small', { style: 'color:var(--orange)' }, warn.join(' ')) : null);
      });
      if (!ev.hit) items.push(h('li', { class: 'nlwh-hitd' }, h('span', { class: 'nlwh-line' }, 'deny ip any any (Implicit Deny ซ่อนอยู่)'), h('div', null, 'ไม่ตรงบรรทัดใดเลย จึงถูกทิ้งด้วย Implicit Deny')));
      const ok = ev.hit && ev.hit.r.act === 'permit';
      const pktTxt = pr.toUpperCase() + ' ' + intToIp(s) + (pr === 'icmp' ? '' : ':' + sp) + ' ไป ' + intToIp(d) + (pr === 'icmp' ? '' : ':' + dp) + (pkt.ack ? ' (มีบิต ACK)' : '');
      const valid = parsed.rules.filter(r => !r.err).length;
      out.replaceChildren(...[
        result(ok ? 'ok' : 'bad', (ok ? 'ผ่าน (permit)' : 'ถูกทิ้ง (deny)') + ': ' + pktTxt + (ev.hit ? ' ตัดสินที่บรรทัด ' + ev.hit.r.li : ' ด้วย Implicit Deny')),
        parsed.problems.length ? result('warn', Array.from(new Set(parsed.problems)).join(' ')) : null,
        !valid ? result('warn', 'ยังไม่มีกฎที่ใช้ได้ บนเราเตอร์จริง ACL ว่างที่ผูกกับขาจะไม่กรองอะไร แต่ ACL ที่มีกฎจะจบด้วย Implicit Deny เสมอ') : null,
        parsed.kind ? h('p', { class: 'nlw-small' }, 'ACL ' + parsed.num + ' เป็น ' + (parsed.kind === 'standard' ? 'Standard (ดูเฉพาะ IP ต้นทาง ควรวางใกล้ปลายทาง)' : 'Extended (ดูโปรโตคอล ต้นทาง ปลายทาง และพอร์ต ควรวางใกล้ต้นทาง)')) : null,
        h('ol', { class: 'nlwh-rules' }, items)].filter(Boolean));
    }
    bRun.addEventListener('click', run);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
    root.append(
      h('div', { class: 'nlwh-panel' }, h('h4', null, 'บรรทัด ACL'), ta, h('div', { class: 'nlw-small' }, 'กด Ctrl + Enter ในช่องนี้เพื่อทดสอบทันที'),
        h('div', { class: 'nlw-row' }, h('span', { class: 'nlw-small' }, 'ตัวอย่าง ACL:'), aclBtns)),
      h('div', { class: 'nlwh-panel' }, h('h4', null, 'แพ็กเก็ตที่จะทดสอบ'),
        h('div', { class: 'nlwh-row2' }, field('โปรโตคอล', proto), field('IP ต้นทาง', src), field('IP ปลายทาง', dst), field('พอร์ตปลายทาง', dport), field('พอร์ตต้นทาง', sport)),
        h('label', { class: 'nlw-check' }, ack, 'แพ็กเก็ตนี้เป็นส่วนของการเชื่อมต่อเดิม (มีบิต ACK) เช่น คำตอบจากเซิร์ฟเวอร์'),
        h('div', { class: 'nlw-row' }, h('span', { class: 'nlw-small' }, 'ตัวอย่างแพ็กเก็ต:'), pktBtns),
        h('div', { class: 'nlw-row nlw-center' }, bRun)),
      out,
      h('p', { class: 'nlw-small' }, 'เครื่องมือนี้ตรวจแบบ Stateless ทีละแพ็กเก็ตเหมือน ACL บนเราเตอร์และห้องจำลอง ไม่จำการเชื่อมต่อ ชื่อพอร์ตที่รองรับ: www, domain, telnet, ftp, smtp, pop3, bootps, bootpc, tftp, snmp, ntp นอกนั้นใช้ตัวเลข'));
    syncProto();
    run();
  }
  NL_FIG('widget', 'acl-lab', aclLab);

  // expose pure engines for tests (no DOM)
  window.NL_FIGS_H = { stpSolve, vtSimulate, aclParse, aclEval, ipToInt };
})();
