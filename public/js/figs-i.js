'use strict';
/* NetLab Phase 4 figures, batch i (supplementary sections w8 subnetting/IPv6, w12 cloud/SDN/automation, w13 VLSM/static routing).
   Register with NL_FIG('diagram'|'widget', name, svgString|mountFn). Colours only through CSS variables. */
window.NL_FIG = window.NL_FIG || function (kind, name, v) { const k = kind === 'diagram' ? 'NL_DIAGRAMS' : 'NL_WIDGETS'; (window[k] = window[k] || {})[name] = v; };

(function () {
  /* ---------- SVG helpers (same style as figs-g.js) ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MONO = 'JetBrains Mono,Consolas,monospace';
  const B = 'var(--blue)', G = 'var(--green)', O = 'var(--orange)', M = 'var(--muted)', INK = 'var(--ink)', OK = 'var(--ok)', BAD = 'var(--bad)';
  function T(x, y, s, o) {
    o = o || {};
    const fam = o.m ? ` font-family="${MONO}"` : ' font-family="inherit"';
    const halo = o.halo ? ' stroke="var(--panel)" stroke-width="5" stroke-linejoin="round" paint-order="stroke"' : '';
    return `<text x="${x}" y="${y}" font-size="${o.s || 15}" text-anchor="${o.a || 'middle'}" fill="${o.c || INK}"${o.w ? ' font-weight="700"' : ''}${fam}${o.xs ? ' xml:space="preserve"' : ''}${halo}>${esc(s)}</text>`;
  }
  function R(x, y, w, h, o) {
    o = o || {};
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx == null ? 9 : o.rx}" fill="${o.f || 'var(--panel)'}"${o.fo != null ? ` fill-opacity="${o.fo}"` : ''} stroke="${o.st || 'var(--line)'}" stroke-width="${o.sw == null ? 1.8 : o.sw}"${o.d ? ` stroke-dasharray="${o.d}"` : ''}/>`;
  }
  function P(d, o) {
    o = o || {};
    return `<path d="${d}" fill="none" stroke="${o.c || M}" stroke-width="${o.sw || 2.2}" stroke-linecap="round" stroke-linejoin="round"${o.d ? ` stroke-dasharray="${o.d}"` : ''}${o.me === false ? '' : ` marker-end="url(#${o.me || 'fgi-a'})"`}/>`;
  }
  // tinted box that hides lines drawn behind it (opaque panel under a translucent tint)
  const RB = (x, y, w, h, o) => R(x, y, w, h, { f: 'var(--panel)', st: 'none', sw: 0, rx: (o && o.rx) || 8 }) + R(x, y, w, h, o);
  const L = (x1, y1, x2, y2, o) => P(`M${x1},${y1} L${x2},${y2}`, Object.assign({ me: false }, o || {}));
  function marker(id, c) {
    return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`;
  }
  function BOX(x, y, w, h, main, sub, o) {
    o = o || {};
    const cx = x + w / 2;
    return R(x, y, w, h, { f: o.f || 'var(--panel)', fo: o.fo, st: o.st || 'var(--line)', sw: o.sw || 1.8, rx: o.rx }) +
      T(cx, y + (sub ? h / 2 - 3 : h / 2 + 6), main, { s: o.s || 15, w: o.bold !== false, m: o.m, c: o.c }) +
      (sub ? T(cx, y + h / 2 + 16, sub, { s: o.ss || 12.5, c: M, m: o.subm }) : '');
  }
  // numbered round badge
  const NUM = (x, y, n, c) => `<circle cx="${x}" cy="${y}" r="10" fill="${c || B}"/>` + T(x, y + 4.5, String(n), { s: 12.5, w: 1, c: 'var(--on-accent)' });
  // terminal panel: lines = [text | {t, c, b}]; marks = {lineIndex: badgeNumber}
  function TERM(x, y, w, lines, o) {
    o = o || {};
    const lh = o.lh || 18, fs = o.fs || 12, pad = 12;
    const h = pad * 2 + lines.length * lh - 4;
    let s = R(x, y, w, h, { f: 'var(--term-bg)', st: 'var(--term-bg)', sw: 1, rx: 8 });
    lines.forEach((ln, i) => {
      const t = typeof ln === 'string' ? ln : ln.t;
      const c = (typeof ln === 'object' && ln.c) || 'var(--term-ink)';
      s += `<text x="${x + (o.gutter || 14)}" y="${y + pad + 10 + i * lh}" font-size="${fs}" fill="${c}" font-family="${MONO}" xml:space="preserve"${typeof ln === 'object' && ln.b ? ' font-weight="700"' : ''}>${esc(t)}</text>`;
    });
    Object.keys(o.marks || {}).forEach(k => { s += NUM(x + w - 14, y + pad + 6 + Number(k) * lh, o.marks[k], O); });
    return { svg: s, h };
  }
  const wrap = (id, w, h, title, body, extraDefs) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-t" font-family="inherit"><title id="${id}-t">${esc(title)}</title><defs>${marker('fgi-a', 'var(--muted)')}${marker('fgi-b', B)}${marker('fgi-g', G)}${marker('fgi-o', O)}${marker('fgi-r', BAD)}${marker('fgi-k', OK)}${extraDefs || ''}</defs>${body}</svg>`;
  const HATCH = '<pattern id="fgi-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--field)"/><line x1="0" y1="0" x2="0" y2="8" stroke="var(--muted)" stroke-width="2.4" stroke-opacity=".55"/></pattern>';

  /* ---------- IPv4 helpers for computed figures ---------- */
  const ip4 = s => s.split('.').reduce((a, o) => a * 256 + Number(o), 0);
  const s4 = n => [24, 16, 8, 0].map(k => Math.floor(n / Math.pow(2, k)) % 256).join('.');
  const lastOct = n => n % 256;

  /* ===================================================================
     diagram cidr-mask-bits: 192.168.1.77/26 -> mask, AND, broadcast, block size 64
     =================================================================== */
  const cidrMaskBits = (function () {
    const ipv = 77, p = 26, maskOct = 256 - Math.pow(2, 32 - p), blk = 256 - maskOct;
    const net = Math.floor(ipv / blk) * blk, bc = net + blk - 1;
    const nb = p - 24; // network bits inside the 4th octet
    const bits = v => v.toString(2).padStart(8, '0');
    const BX = 262, BW = 34, BS = 38;
    let s = T(320, 28, 'ตัวอย่าง 192.168.1.77/26: ดูเฉพาะออกเตตที่ 4 ซึ่งมีเส้นแบ่ง', { s: 16, w: 1 });
    s += R(14, 42, 14, 14, { f: B, fo: 0.25, st: B, rx: 3, sw: 1.4 }) + T(34, 54, 'บิต Network (26 บิตแรก)', { s: 13, a: 'start' });
    s += R(214, 42, 14, 14, { f: O, fo: 0.25, st: O, rx: 3, sw: 1.4 }) + T(234, 54, 'บิต Host (6 บิตท้าย)', { s: 13, a: 'start' });
    s += T(420, 54, 'mask 3 ออกเตตแรก = 255', { s: 13, a: 'start', c: M });
    // place values
    [128, 64, 32, 16, 8, 4, 2, 1].forEach((v, i) => { s += T(BX + i * BS + BW / 2, 84, String(v), { s: 12.5, c: M, m: 1 }); });
    const rows = [
      ['IP Address', '192.168.1.77', '192.168.1.', ipv],
      ['Mask /26', '255.255.255.192', '255.255.255.', maskOct],
      ['Network (AND)', '192.168.1.' + net, '192.168.1.', net],
      ['Broadcast', 'บิต Host เป็น 1', '192.168.1.', bc]
    ];
    rows.forEach((r, k) => {
      const y = 94 + k * 52;
      s += T(10, y + 17, r[0], { s: 13.5, w: 1, a: 'start' }) + T(10, y + 35, r[1], { s: 12.5, a: 'start', c: M, m: 1 });
      s += T(BX - 6, y + 25, r[2], { s: 14, a: 'end', m: 1, c: B });
      bits(r[3]).split('').forEach((bit, i) => {
        const net1 = i < nb;
        s += R(BX + i * BS, y + 4, BW, 32, { f: net1 ? B : O, fo: 0.16, st: net1 ? B : O, rx: 5, sw: 1.4 }) + T(BX + i * BS + BW / 2, y + 26, bit, { s: 16, w: 1, m: 1 });
      });
      s += T(BX + 8 * BS + 4, y + 26, '= ' + r[3], { s: 15, w: 1, a: 'start', m: 1 });
    });
    const cutX = BX + nb * BS - 2;
    s += L(cutX, 70, cutX, 300, { c: INK, sw: 2, d: '5 4' }) + T(cutX, 314, 'เส้นแบ่ง /26', { s: 12.5, w: 1 });
    // block size number line
    const AX = 40, AW = 560, y0 = 390, px = v => AX + v * AW / 256;
    s += T(320, 342, 'Block size = 256 − 192 = ' + blk + ' (ค่าประจำหลักของบิต Network ตัวสุดท้าย)', { s: 14.5, w: 1 });
    for (let i = 0; i < 256 / blk; i++) {
      const on = i * blk === net;
      s += R(px(i * blk) + 1, y0, AW * blk / 256 - 2, 34, { f: on ? G : 'var(--field)', fo: on ? 0.22 : 1, st: on ? G : 'var(--line)', rx: 4, sw: on ? 2.4 : 1.4 });
      s += T(px(i * blk) + AW * blk / 512, y0 + 22, '.' + (i * blk) + ' – .' + (i * blk + blk - 1), { s: 13, m: 1, w: on ? 1 : 0 });
    }
    [0, 64, 128, 192, 256].forEach(v => { s += T(px(v), y0 + 52, String(v), { s: 12, c: M, m: 1 }); });
    s += P(`M${px(ipv)},${y0 - 16} L${px(ipv)},${y0 - 2}`, { c: O, me: 'fgi-o' }) + T(px(ipv) + 6, y0 - 8, '77 อยู่ในบล็อก 64–127', { s: 12.5, a: 'start', c: O, w: 1 });
    // summary
    s += R(10, 462, 620, 66, { f: G, fo: 0.08, st: G, rx: 10 });
    s += T(320, 486, 'Network 192.168.1.' + net + '   Host แรก .' + (net + 1) + '   Host สุดท้าย .' + (bc - 1) + '   Broadcast .' + bc, { s: 14, w: 1, m: 1 });
    s += T(320, 512, 'บิต Host h = 32 − 26 = 6 → ใช้งานได้ 2^6 − 2 = ' + (Math.pow(2, 32 - p) - 2) + ' เครื่อง (หัก Network และ Broadcast)', { s: 13.5 });
    const title = 'การหา Network ของ 192.168.1.77/26 แบบเลขฐานสอง: ออกเตตที่ 4 ของ IP คือ 01001101 (77) mask /26 ในออกเตตนี้คือ 11000000 (192) นำมา AND ได้ 01000000 (64) จึงได้ Network 192.168.1.64 ตั้งบิต Host ทั้ง 6 บิตเป็น 1 ได้ 01111111 (127) คือ Broadcast 192.168.1.127 Block size = 256 − 192 = 64 ทำให้วงเริ่มที่ .0 .64 .128 .192 และ 77 อยู่ในบล็อก 64 ถึง 127 Host แรก .65 Host สุดท้าย .126 ใช้งานได้ 62 เครื่อง';
    return wrap('cidr-mask-bits', 640, 538, title, s);
  })();
  NL_FIG('diagram', 'cidr-mask-bits', cidrMaskBits);

  /* ===================================================================
     diagram subnet-borrow-27: 192.168.10.0/24 borrows 3 bits -> 8 x /27
     =================================================================== */
  const subnetBorrow27 = (function () {
    const base = ip4('192.168.10.0'), sb = 3, size = Math.pow(2, 8 - sb);
    let s = T(320, 28, 'แบ่ง 192.168.10.0/24 เป็น 8 วง: ยืมบิต Host มา 3 บิต → /27', { s: 16, w: 1 });
    const BX = 172, BS = 38, BW = 34;
    s += T(10, 78, 'ออกเตตที่ 4', { s: 13.5, w: 1, a: 'start' }) + T(10, 96, 'ของ /27', { s: 12.5, c: M, a: 'start' });
    [128, 64, 32, 16, 8, 4, 2, 1].forEach((v, i) => {
      const sub = i < sb;
      s += T(BX + i * BS + BW / 2, 54, String(v), { s: 12.5, c: M, m: 1 });
      s += R(BX + i * BS, 62, BW, 34, { f: sub ? G : O, fo: 0.18, st: sub ? G : O, rx: 5, sw: 1.6 }) + T(BX + i * BS + BW / 2, 85, sub ? 'S' : 'H', { s: 15, w: 1, m: 1 });
    });
    s += P(`M${BX},106 L${BX},114 L${BX + sb * BS - 4},114 L${BX + sb * BS - 4},106`, { c: G, me: false, sw: 2 }) + T(BX + (sb * BS - 4) / 2, 132, 'S = บิตที่ยืม 3 บิต', { s: 13, c: G, w: 1 });
    s += P(`M${BX + sb * BS},106 L${BX + sb * BS},114 L${BX + 8 * BS - 4},114 L${BX + 8 * BS - 4},106`, { c: O, me: false, sw: 2 }) + T(BX + sb * BS + (5 * BS - 4) / 2, 132, 'H = บิต Host ที่เหลือ 5 บิต', { s: 13, c: O, w: 1 });
    s += T(10, 160, 'จำนวนวง = 2^3 = 8   ขนาดวง = 2^5 = 32 address   ใช้งานได้ 32 − 2 = 30 เครื่อง   Mask = 255.255.255.224', { s: 13, a: 'start' });
    // table
    const cols = [[10, 'บิต S'], [80, 'Network'], [276, 'Host แรก – Host สุดท้าย'], [500, 'Broadcast']];
    const ty = 178;
    s += R(10, ty, 620, 30, { f: 'var(--field)', st: 'var(--line)', rx: 6, sw: 1.2 });
    cols.forEach(c => { s += T(c[0] + 8, ty + 20, c[1], { s: 13, w: 1, a: 'start' }); });
    for (let i = 0; i < Math.pow(2, sb); i++) {
      const n = base + i * size, y = ty + 32 + i * 30;
      if (i % 2) s += R(10, y, 620, 30, { f: 'var(--field)', st: 'none', sw: 0, rx: 0 });
      s += T(18, y + 20, i.toString(2).padStart(sb, '0'), { s: 13.5, a: 'start', m: 1, c: G, w: 1 });
      s += T(88, y + 20, s4(n) + '/27', { s: 13.5, a: 'start', m: 1 });
      s += T(284, y + 20, '.' + lastOct(n + 1) + ' – .' + lastOct(n + size - 2), { s: 13.5, a: 'start', m: 1 });
      s += T(508, y + 20, '.' + lastOct(n + size - 1), { s: 13.5, a: 'start', m: 1 });
    }
    const yEnd = ty + 32 + 8 * 30 + 22;
    s += T(320, yEnd, 'Network ขยับทีละ 32 (block size) และ Broadcast = Network ถัดไป − 1', { s: 13.5, c: M });
    const title = 'การยืมบิต: 192.168.10.0/24 ยืมบิต Host 3 บิตในออกเตตที่ 4 (ค่า 128 64 32) จึงได้ /27 จำนวน 2^3 = 8 วง วงละ 32 address ใช้ได้ 30 เครื่อง ได้แก่ .0 ถึง .31, .32 ถึง .63, .64 ถึง .95, .96 ถึง .127, .128 ถึง .159, .160 ถึง .191, .192 ถึง .223 และ .224 ถึง .255 Host แรกคือ Network บวก 1 Host สุดท้ายคือ Broadcast ลบ 1';
    return wrap('subnet-borrow-27', 640, yEnd + 14, title, s);
  })();
  NL_FIG('diagram', 'subnet-borrow-27', subnetBorrow27);

  /* ===================================================================
     diagram ipv6-addr-anatomy: 8 x 16-bit groups, /48 + subnet ID + interface ID, RFC 5952 shortening
     =================================================================== */
  const ipv6Anatomy = (function () {
    const groups = ['2001', '0db8', 'acad', '0001', '0000', '0000', '0000', '0010'];
    const GX = 14, GW = 70, GS = 77;
    let s = T(320, 28, 'IPv6 = 128 บิต แบ่งเป็น 8 กลุ่ม กลุ่มละ 16 บิต (เลขฐาน 16 สี่หลัก)', { s: 16, w: 1 });
    groups.forEach((g, i) => {
      const c = i < 3 ? B : i === 3 ? G : O;
      s += R(GX + i * GS, 48, GW, 44, { f: c, fo: 0.14, st: c, rx: 6, sw: 1.8 }) + T(GX + i * GS + GW / 2, 76, g, { s: 17, w: 1, m: 1 });
      if (i < 7) s += T(GX + i * GS + GW + 3.5, 76, ':', { s: 18, w: 1, m: 1 });
    });
    const br = (i0, i1, y, c, t1, t2) => {
      const x0 = GX + i0 * GS, x1 = GX + i1 * GS + GW;
      return P(`M${x0},${y} L${x0},${y + 8} L${x1},${y + 8} L${x1},${y}`, { c, me: false, sw: 2 }) + T((x0 + x1) / 2, y + 26, t1, { s: 13.5, w: 1, c }) + (t2 ? T((x0 + x1) / 2, y + 43, t2, { s: 12.5, c: M }) : '');
    };
    s += br(0, 2, 98, B, 'Global Routing Prefix 48 บิต', 'ISP หรือหน่วยงานได้รับมา');
    s += br(3, 3, 98, G, 'Subnet ID', '16 บิต');
    s += br(4, 7, 98, O, 'Interface ID 64 บิต', 'ระบุเครื่อง (ตั้งเอง, EUI-64 หรือสุ่ม)');
    s += R(GX, 160, 4 * GS - 7, 26, { f: 'none', st: INK, sw: 1.6, d: '6 4', rx: 6 }) + T(GX + (4 * GS - 7) / 2, 178, 'Prefix /64 = ที่อยู่ของวง LAN หนึ่งวง', { s: 13.5, w: 1 });
    // shortening steps
    s += R(10, 200, 620, 112, { f: 'var(--field)', st: 'var(--line)', rx: 10 });
    s += T(24, 224, 'ย่อตาม RFC 5952', { s: 15, w: 1, a: 'start' });
    s += T(24, 250, 'ขั้น 1 ตัด 0 นำหน้าทุกกลุ่ม', { s: 13.5, a: 'start' }) + T(616, 250, '2001:db8:acad:1:0:0:0:10', { s: 14, a: 'end', m: 1 });
    s += T(24, 276, 'ขั้น 2 กลุ่ม 0 ติดกันยาวที่สุด (กลุ่ม 5–7) → ::', { s: 13.5, a: 'start' }) + T(616, 276, '2001:db8:acad:1::10', { s: 14, a: 'end', m: 1, w: 1, c: G });
    s += T(24, 300, 'ขยายกลับ: นับกลุ่มที่เห็น (5 กลุ่ม) แล้วเติม 0 แทน :: ให้ครบ 8 กลุ่ม', { s: 12.5, a: 'start', c: M });
    // rule table
    const rows = [
      ['2001:0db8:0000:0000:0001:0000:0000:0001', '2001:db8::1:0:0:1', 'ช่วง 0 ยาวเท่ากัน ย่อช่วงแรก'],
      ['2001:0db8:0000:0001:0000:0000:0000:0001', '2001:db8:0:1::1', 'เลือกช่วงที่ยาวกว่า (3 กลุ่ม)'],
      ['2001:0db8:0001:0000:0001:0001:0001:0001', '2001:db8:1:0:1:1:1:1', '0 กลุ่มเดียว ห้ามใช้ ::'],
      ['FE80:0000:0000:0000:0000:0000:0000:00A1', 'fe80::a1', 'เขียน a–f เป็นตัวพิมพ์เล็ก'],
      ['0000:0000:0000:0000:0000:0000:0000:0001', '::1', 'Loopback']
    ];
    s += T(10, 340, 'รูปเต็ม', { s: 13, w: 1, a: 'start', c: M }) + T(630, 340, 'รูปย่อที่ถูกต้อง / กฎที่ใช้', { s: 13, w: 1, a: 'end', c: M });
    rows.forEach((r, i) => {
      const y = 352 + i * 50;
      s += R(10, y, 620, 44, { f: i % 2 ? 'var(--field)' : 'var(--panel)', st: 'var(--line)', sw: 1, rx: 6 });
      s += T(18, y + 18, r[0], { s: 12, a: 'start', m: 1, c: M });
      s += T(18, y + 37, '→ ' + r[1], { s: 14, a: 'start', m: 1, w: 1 });
      s += T(622, y + 37, r[2], { s: 12.5, a: 'end', c: O });
    });
    s += T(320, 618, 'ใช้ :: ได้ครั้งเดียวต่อ address เช่น 2001:db8::1::1 ผิด เพราะขยายกลับได้หลายแบบ', { s: 13, w: 1, c: BAD });
    const title = 'โครงสร้าง IPv6 2001:0db8:acad:0001:0000:0000:0000:0010 แปดกลุ่ม กลุ่มละ 16 บิต สามกลุ่มแรก 48 บิตคือ Global Routing Prefix กลุ่มที่สี่คือ Subnet ID 16 บิต รวมเป็น prefix /64 ของวง LAN อีกสี่กลุ่มคือ Interface ID 64 บิต การย่อตาม RFC 5952: ตัด 0 นำหน้าได้ 2001:db8:acad:1:0:0:0:10 แล้วแทนช่วง 0 ที่ยาวที่สุดด้วย :: ได้ 2001:db8:acad:1::10 ตัวอย่างเพิ่ม 2001:db8::1:0:0:1 เมื่อยาวเท่ากันย่อช่วงแรก 2001:db8:0:1::1 เลือกช่วงที่ยาวกว่า 2001:db8:1:0:1:1:1:1 ศูนย์กลุ่มเดียวห้ามย่อ fe80::a1 ใช้ตัวพิมพ์เล็ก ::1 คือ loopback และใช้ :: ได้ครั้งเดียว';
    return wrap('ipv6-addr-anatomy', 640, 632, title, s);
  })();
  NL_FIG('diagram', 'ipv6-addr-anatomy', ipv6Anatomy);

  /* ===================================================================
     diagram slaac-dad-flow: link-local + DAD, RS, RA (prefix, A flag), global + DAD
     =================================================================== */
  const slaacFlow = (function () {
    const XA = 96, XM = 330, XR = 556;
    let s = T(320, 26, 'SLAAC แบบย่อ: PC-A (MAC 00:1a:2b:3c:4d:5e) เพิ่งเสียบสายเข้าวง', { s: 15.5, w: 1 });
    s += BOX(XA - 76, 40, 152, 44, 'PC-A', 'โหมด SLAAC', { st: B, sw: 2.2 });
    s += BOX(XM - 86, 40, 172, 44, 'เครื่องอื่นในลิงก์', 'รับ multicast', {});
    s += BOX(XR - 76, 40, 152, 44, 'Router R1', 'fe80::1 (ส่ง RA)', { st: G, sw: 2.2 });
    [XA, XM, XR].forEach(x => { s += L(x, 84, x, 548, { c: 'var(--line)', sw: 2, d: '4 5' }); });
    // 1 link-local
    s += NUM(24, 112, 1, B) + RB(40, 98, 300, 46, { f: B, fo: 0.08, st: B, rx: 8, sw: 1.4 });
    s += T(50, 117, 'สร้าง link-local = fe80::/64 + Interface ID', { s: 12.5, a: 'start' }) + T(50, 136, 'fe80::21a:2bff:fe3c:4d5e (tentative)', { s: 12.5, a: 'start', m: 1, w: 1 });
    // 2 DAD NS
    s += NUM(24, 174, 2, O);
    s += P(`M${XA},182 L${XR - 4},182`, { c: O, me: 'fgi-o', d: '8 5' });
    s += T(XM, 168, 'DAD: Neighbor Solicitation (ICMPv6 135)', { halo: 1, s: 13, w: 1, c: O });
    s += T(XM, 200, 'src :: → dst ff02::1:ff3c:4d5e (solicited-node)', { halo: 1, s: 12.5, m: 1 });
    s += RB(40, 210, 590, 46, { f: 'var(--field)', st: 'var(--line)', rx: 8, sw: 1.2 });
    s += T(50, 229, 'ไม่มีใครตอบ Neighbor Advertisement ภายในเวลารอ (ค่าเริ่มต้นประมาณ 1 วินาที)', { s: 12.5, a: 'start' });
    s += T(50, 247, '→ address ใช้ได้ ถ้ามีคนตอบ = ซ้ำ: Windows แสดง (Duplicate), Linux แสดง dadfailed', { s: 12.5, a: 'start', c: BAD });
    // 3 RS
    s += NUM(24, 290, 3, B);
    s += P(`M${XA},298 L${XR - 4},298`, { c: B, me: 'fgi-b' });
    s += T(XM, 284, 'Router Solicitation (ICMPv6 133) "มีเราเตอร์ไหม"', { halo: 1, s: 13, w: 1, c: B });
    s += T(XM, 316, 'fe80::21a:2bff:fe3c:4d5e → ff02::2 (เราเตอร์ทุกตัว)', { halo: 1, s: 12.5, m: 1 });
    // 4 RA
    s += NUM(24, 352, 4, G);
    s += P(`M${XR},360 L${XA + 4},360`, { c: G, me: 'fgi-g' });
    s += T(XM, 346, 'Router Advertisement (ICMPv6 134)', { halo: 1, s: 13, w: 1, c: G });
    s += T(XM, 378, 'fe80::1 → ff02::1 (ทุกเครื่อง)', { halo: 1, s: 12.5, m: 1 });
    s += T(XM, 396, 'Prefix 2001:db8:10::/64, ธง A = 1 (ให้สร้างเอง)', { halo: 1, s: 12.5, m: 1, w: 1 });
    // 5 global
    s += NUM(24, 432, 5, B) + RB(40, 418, 590, 74, { f: G, fo: 0.08, st: G, rx: 8, sw: 1.4 });
    s += T(50, 437, 'Global = prefix 64 บิต + Interface ID 64 บิต แล้วทำ DAD ซ้ำอีกครั้ง', { s: 12.5, a: 'start' });
    s += T(50, 459, '2001:db8:10:0:21a:2bff:fe3c:4d5e/64', { s: 14, a: 'start', m: 1, w: 1 });
    s += T(50, 480, 'Default gateway = fe80::1 (link-local ของเราเตอร์ที่ส่ง RA)', { s: 12.5, a: 'start' });
    s += T(320, 520, 'สังเกต: กลุ่ม :0: ที่เหลือกลุ่มเดียวห้ามย่อเป็น :: และ ff:fe ตรงกลางบอกว่าเป็น EUI-64', { s: 12.5, c: M, halo: 1 });
    s += T(320, 540, 'ถ้า RA ตั้งธง M หรือ O เครื่องจะถาม DHCPv6 เพิ่ม (address หรือค่าอื่น เช่น DNS)', { s: 12.5, c: M, halo: 1 });
    const title = 'ลำดับ SLAAC แบบย่อ 1 PC-A สร้าง link-local fe80::21a:2bff:fe3c:4d5e สถานะ tentative 2 ทำ DAD ส่ง Neighbor Solicitation จาก :: ไปยัง solicited-node multicast ff02::1:ff3c:4d5e ถ้าไม่มีใครตอบภายในประมาณ 1 วินาทีจึงใช้ได้ ถ้ามีคนตอบคือ address ซ้ำ 3 ส่ง Router Solicitation ไปยัง ff02::2 4 Router R1 ตอบ Router Advertisement จาก fe80::1 ไปยัง ff02::1 พร้อม prefix 2001:db8:10::/64 และธง A 5 PC-A สร้าง global 2001:db8:10:0:21a:2bff:fe3c:4d5e/64 ทำ DAD ซ้ำ และใช้ fe80::1 เป็น default gateway ถ้า RA ตั้งธง M หรือ O จะถาม DHCPv6 เพิ่ม';
    return wrap('slaac-dad-flow', 640, 556, title, s);
  })();
  NL_FIG('diagram', 'slaac-dad-flow', slaacFlow);

  /* ===================================================================
     diagram ipv6-cmd-read: Windows ipconfig vs Linux ip -6 addr with numbered callouts
     =================================================================== */
  const ipv6CmdRead = (function () {
    let s = T(320, 24, 'อ่านผล IPv6 จากคำสั่ง (ตัดบรรทัดที่ไม่เกี่ยวข้องออก)', { s: 15.5, w: 1 });
    const w1 = TERM(10, 36, 620, [
      { t: 'C:\\> ipconfig', c: 'var(--term-dim)' },
      'Ethernet adapter Ethernet:',
      '   IPv6 Address. . . . . : 2001:db8:10:0:b5c1:8e2f:6a0d:13c4',
      '   Temporary IPv6 Address: 2001:db8:10:0:9c4e:61a2:3b7f:d10e',
      '   Link-local IPv6 Address: fe80::5c1e:a3f2:84d1:2b07%12',
      '   IPv4 Address. . . . . : 192.168.20.105',
      '   Default Gateway . . . : fe80::1%12',
      '                           192.168.20.1'
    ], { marks: { 2: 1, 3: 2, 4: 3, 6: 4 } });
    s += w1.svg;
    let y = 36 + w1.h + 10;
    const leg = (items, y0) => {
      let out = '';
      items.forEach((it, i) => { out += NUM(22, y0 + i * 22, it[0], O) + T(40, y0 + 5 + i * 22, it[1], { s: 12.5, a: 'start' }); });
      return out;
    };
    s += leg([[1, 'Global unicast (2000::/3) จาก SLAAC: Windows สุ่ม Interface ID ไม่ใช้ EUI-64'],
      [2, 'Temporary address (privacy) เปลี่ยนเป็นระยะ ใช้เป็นต้นทางเวลาออกอินเทอร์เน็ต'],
      [3, 'Link-local (fe80::/10) มีทุกการ์ดเสมอ %12 = Zone ID หมายเลขการ์ดของเครื่องนี้'],
      [4, 'Gateway เป็น link-local ของเราเตอร์ที่ได้จาก RA จึงต้องมี %12 ระบุการ์ด']], y + 8);
    y += 8 + 4 * 22 + 6;
    const w2 = TERM(10, y, 620, [
      { t: '$ ip -6 addr show dev eth0', c: 'var(--term-dim)' },
      '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP',
      '    inet6 2001:db8:10:0:21a:2bff:fe3c:4d5e/64 scope global dynamic',
      '       valid_lft 2591998sec preferred_lft 604798sec',
      '    inet6 fe80::21a:2bff:fe3c:4d5e/64 scope link',
      '       valid_lft forever preferred_lft forever'
    ], { marks: { 2: 5, 3: 6, 4: 7 } });
    s += w2.svg;
    y += w2.h + 10;
    s += leg([[5, 'scope global dynamic = ได้จาก RA (SLAAC), /64, มี ff:fe ตรงกลาง = EUI-64'],
      [6, 'อายุที่ RA กำหนด: valid ราว 30 วัน, preferred ราว 7 วัน (ค่าเริ่มต้นของ RA)'],
      [7, 'scope link = link-local ใช้ได้เฉพาะในลิงก์เดียวกัน เราเตอร์ไม่ส่งต่อ']], y + 8);
    y += 8 + 3 * 22 + 4;
    s += R(10, y, 620, 50, { f: 'var(--field)', st: 'var(--line)', rx: 8, sw: 1.2 });
    s += T(20, y + 20, 'ทดสอบ: ping -6 2001:db8:10::1 (Windows)  หรือ  ping -6 -c 4 2001:db8:10::1 (Linux)', { s: 12.5, a: 'start', m: 1 });
    s += T(20, y + 40, 'ping link-local ต้องบอกการ์ด: ping -6 fe80::1%12 หรือ ping -6 fe80::1%eth0', { s: 12.5, a: 'start', m: 1 });
    y += 60;
    const title = 'ผลคำสั่ง ipconfig ของ Windows: IPv6 Address 2001:db8:10:0:b5c1:8e2f:6a0d:13c4 คือ global จาก SLAAC ที่สุ่ม Interface ID, Temporary IPv6 Address คือ address ชั่วคราวเพื่อความเป็นส่วนตัว, Link-local IPv6 Address fe80::5c1e:a3f2:84d1:2b07%12 โดย %12 คือ Zone ID, Default Gateway fe80::1%12 คือ link-local ของเราเตอร์ ผลคำสั่ง ip -6 addr ของ Linux: inet6 2001:db8:10:0:21a:2bff:fe3c:4d5e/64 scope global dynamic คือ address จาก SLAAC แบบ EUI-64 มี valid_lft และ preferred_lft ตามที่ RA กำหนด inet6 fe80::21a:2bff:fe3c:4d5e/64 scope link คือ link-local การทดสอบใช้ ping -6 และ ping link-local ต้องระบุ zone เช่น %12 หรือ %eth0';
    return wrap('ipv6-cmd-read', 640, y, title, s);
  })();
  NL_FIG('diagram', 'ipv6-cmd-read', ipv6CmdRead);

  /* ===================================================================
     VLSM data shared by vlsm-map, vlsm-boundary and the w13 routing figure
     =================================================================== */
  function vlsmAlloc(baseStr, prefix, needs, sort) {
    const base = ip4(baseStr), end = base + Math.pow(2, 32 - prefix);
    const list = needs.map((n, i) => Object.assign({ i }, n));
    if (sort) list.sort((a, b) => b.need - a.need || a.i - b.i);
    let next = base;
    return list.map(n => {
      let h = 2; while (Math.pow(2, h) - 2 < n.need) h++;
      const size = Math.pow(2, h);
      const start = Math.ceil((next - base) / size) * size + base;
      const gap = start - next;
      next = start + size;
      return Object.assign(n, { h, size, prefix: 32 - h, net: start, bc: start + size - 1, gapBefore: gap, fits: start + size <= end });
    });
  }
  const VLSM_NEEDS = [{ name: 'LAN-A ห้องแล็บ', need: 60 }, { name: 'LAN-B ห้องพักครู', need: 28 }, { name: 'LAN-C ธุรการ', need: 12 }, { name: 'WAN R1–R2', need: 2 }];

  /* ===================================================================
     diagram vlsm-map: 192.168.10.0/24 for 60, 28, 12, 2 hosts
     =================================================================== */
  const vlsmMap = (function () {
    const al = vlsmAlloc('192.168.10.0', 24, VLSM_NEEDS, true);
    const AX = 20, AW = 600, px = v => AX + v * AW / 256;
    const cols = [B, G, O, 'var(--brown)'];
    let s = T(320, 26, 'VLSM: 192.168.10.0/24 ให้ 4 วงที่ต้องการ 60, 28, 12 และ 2 เครื่อง', { s: 15.5, w: 1 });
    const y0 = 70;
    al.forEach((a, k) => {
      const o = lastOct(a.net);
      s += R(px(o), y0, AW * a.size / 256, 46, { f: cols[k], fo: 0.22, st: cols[k], rx: 3, sw: 1.8 });
      if (a.size >= 16) s += T(px(o) + AW * a.size / 512, y0 + 28, '/' + a.prefix, { s: 14, w: 1, m: 1 });
    });
    const used = al.reduce((m, a) => Math.max(m, lastOct(a.bc) + 1), 0);
    s += `<rect x="${px(used)}" y="${y0}" width="${AW * (256 - used) / 256}" height="46" fill="url(#fgi-hatch)" stroke="var(--line)" stroke-width="1.4"/>`;
    s += R(px(used) + 40, y0 + 10, 240, 26, { f: 'var(--panel)', st: 'var(--line)', rx: 6, sw: 1 }) + T(px(used) + 160, y0 + 28, 'ว่าง .' + used + ' – .255 (' + (256 - used) + ' address)', { s: 13, w: 1 });
    // WAN callout
    const w = al[3], wo = lastOct(w.net);
    s += P(`M${px(wo) + 4},${y0 - 12} L${px(wo) + 4},${y0 - 2}`, { c: 'var(--brown)', me: 'fgi-a' }) + T(px(wo) + 4, y0 - 16, 'WAN /30', { s: 12.5, w: 1 });
    // ticks
    [0, 64, 96, 112, 256].forEach(v => { s += L(px(v), y0 + 46, px(v), y0 + 56, { c: M, sw: 1.6 }) + T(px(v), y0 + 72, v === 256 ? '.255' : '.' + v, { s: 12, m: 1, c: M }); });
    s += L(px(116), y0 + 46, px(116), y0 + 84, { c: M, sw: 1.6 }) + T(px(116) + 3, y0 + 96, '.116', { s: 12, m: 1, c: M, a: 'start' });
    // table
    const ty = 214, cx = [10, 172, 232, 318, 412, 534];
    const head = ['วง (เรียงมาก → น้อย)', 'ต้องการ', 'Prefix (ได้)', 'Network', 'Host แรก – สุดท้าย', 'Broadcast'];
    s += T(320, ty - 10, 'ตารางกำหนด address (192.168.10.x)', { s: 13.5, w: 1 });
    s += R(10, ty, 620, 30, { f: 'var(--field)', st: 'var(--line)', rx: 6, sw: 1.2 });
    head.forEach((t, i) => { s += T(cx[i] + 6, ty + 20, t, { s: 12, w: 1, a: 'start' }); });
    al.forEach((a, k) => {
      const y = ty + 32 + k * 34;
      s += R(10, y, 620, 32, { f: cols[k], fo: 0.08, st: 'none', sw: 0, rx: 4 });
      s += T(cx[0] + 6, y + 21, a.name, { s: 12.5, a: 'start' });
      s += T(cx[1] + 6, y + 21, String(a.need), { s: 13, a: 'start', m: 1 });
      s += T(cx[2] + 6, y + 21, '/' + a.prefix + ' (' + (a.size - 2) + ')', { s: 13, a: 'start', m: 1 });
      s += T(cx[3] + 6, y + 21, '.' + lastOct(a.net) + '/' + a.prefix, { s: 13, a: 'start', m: 1, w: 1 });
      s += T(cx[4] + 6, y + 21, '.' + lastOct(a.net + 1) + ' – .' + lastOct(a.bc - 1), { s: 13, a: 'start', m: 1 });
      s += T(cx[5] + 6, y + 21, '.' + lastOct(a.bc), { s: 13, a: 'start', m: 1 });
    });
    const yb = ty + 32 + 4 * 34 + 20;
    s += T(320, yb, 'Mask: /26 = 255.255.255.192, /27 = .224, /28 = .240, /30 = .252', { s: 13, c: M });
    s += T(320, yb + 22, 'แต่ละวงเริ่มที่จุดจบของวงก่อนหน้าพอดี เพราะขนาด 64, 32, 16, 4 ลดลงทีละขั้น', { s: 13, c: M });
    const title = 'แผนผัง VLSM ของ 192.168.10.0/24: LAN-A 60 เครื่องได้ 192.168.10.0/26 host .1 ถึง .62 broadcast .63, LAN-B 28 เครื่องได้ .64/27 host .65 ถึง .94 broadcast .95, LAN-C 12 เครื่องได้ .96/28 host .97 ถึง .110 broadcast .111, ลิงก์ WAN 2 เครื่องได้ .112/30 host .113 และ .114 broadcast .115 เหลือว่าง .116 ถึง .255 รวม 140 address';
    return wrap('vlsm-map', 640, yb + 36, title, s, HATCH);
  })();
  NL_FIG('diagram', 'vlsm-map', vlsmMap);

  /* ===================================================================
     diagram vlsm-boundary: sorted vs unsorted allocation, alignment rule
     =================================================================== */
  const vlsmBoundary = (function () {
    const AX = 20, AW = 600, px = v => AX + v * AW / 256;
    const cols = { 60: B, 28: G, 12: O, 2: 'var(--brown)' };
    let s = T(320, 26, 'ทำไมต้องเรียงจากวงใหญ่ไปวงเล็ก และ Network ต้องตรงขอบบล็อก', { s: 15.5, w: 1 });
    const bar = (y, al, label) => {
      let o = T(20, y - 10, label, { s: 13.5, w: 1, a: 'start' });
      o += R(px(0), y, AW, 40, { f: 'var(--panel)', st: 'var(--line)', rx: 3, sw: 1.2 });
      al.forEach(a => {
        const st = lastOct(a.net);
        if (a.gapBefore) o += `<rect x="${px(st - a.gapBefore)}" y="${y}" width="${AW * a.gapBefore / 256}" height="40" fill="url(#fgi-hatch)" stroke="var(--bad)" stroke-width="1.6"/>` +
          R(px(st - a.gapBefore) + 3, y + 8, AW * a.gapBefore / 256 - 6, 24, { f: 'var(--panel)', st: 'none', sw: 0, rx: 4 }) +
          T(px(st - a.gapBefore) + AW * a.gapBefore / 512, y + 25, 'ช่องว่าง ' + a.gapBefore, { s: 12, w: 1, c: BAD });
        o += R(px(st), y, AW * a.size / 256, 40, { f: cols[a.need], fo: 0.24, st: cols[a.need], rx: 3, sw: 1.8 });
        if (a.size >= 32) o += T(px(st) + AW * a.size / 512, y + 25, '.' + st + '/' + a.prefix, { s: 12.5, w: 1, m: 1 });
        else if (a.size >= 16) o += T(px(st) + AW * a.size / 512, y + 25, '/' + a.prefix, { s: 11.5, w: 1, m: 1 });
      });
      return o;
    };
    const sorted = vlsmAlloc('192.168.10.0', 24, [{ need: 60 }, { need: 28 }, { need: 12 }, { need: 2 }], true);
    const raw = vlsmAlloc('192.168.10.0', 24, [{ need: 12 }, { need: 2 }, { need: 60 }, { need: 28 }], false);
    s += bar(70, sorted, 'ถูกวิธี: 60 → 28 → 12 → 2 ต่อกันพอดี ไม่มีช่องว่าง');
    s += T(px(116) + 6, 128, 'ที่เหลือ .116 – .255 ต่อเนื่องกัน (= .116/30 + .120/29 + .128/25)', { s: 12.5, a: 'start', c: M });
    s += bar(172, raw, 'ไม่เรียง: 12 → 2 → 60 → 28');
    const g = raw[2];
    s += T(20, 232, '/28 ได้ .0, /30 ได้ .16 แต่ /26 เริ่มที่ .20 ไม่ได้ ต้องข้ามไป .' + lastOct(g.net) + ' เสียช่องว่าง ' + g.gapBefore + ' address', { s: 12.5, a: 'start', c: BAD });
    s += T(20, 252, 'ช่องว่างนี้ยังใช้ได้กับวงเล็ก แต่พื้นที่แตกเป็นชิ้น วางแผนเพิ่มยากขึ้น', { s: 12.5, a: 'start', c: M });
    // alignment rule
    s += R(10, 272, 620, 168, { f: 'var(--field)', st: 'var(--line)', rx: 10 });
    s += T(24, 298, 'กฎขอบบล็อก: Network ของวงขนาด S ต้องหารด้วย S ลงตัว (นับจากต้นบล็อก)', { s: 14, w: 1, a: 'start' });
    const rules = [['/26 (S = 64)', '.0  .64  .128  .192'], ['/27 (S = 32)', '.0  .32  .64  .96  .128 ...'], ['/28 (S = 16)', '.0  .16  .32  .48  .64 ...'], ['/30 (S = 4)', '.0  .4  .8  .12 ... .112  .116 ...']];
    rules.forEach((r, i) => { s += T(24, 326 + i * 24, r[0], { s: 13, a: 'start', w: 1 }) + T(150, 326 + i * 24, r[1], { s: 13, a: 'start', m: 1 }); });
    s += T(24, 428, 'ตัวอย่างผิด: 192.168.10.20/26 ไม่ใช่ Network address เพราะ 20 หาร 64 ไม่ลงตัว', { s: 13, a: 'start', c: BAD, w: 1 });
    const title = 'เปรียบเทียบการจัด VLSM: เรียงจากมากไปน้อย 60, 28, 12, 2 ได้ .0/26 .64/27 .96/28 .112/30 ต่อกันไม่มีช่องว่าง ส่วนถ้าไม่เรียง 12, 2, 60, 28 จะได้ .0/28 .16/30 แล้ว /26 ต้องข้ามไปเริ่ม .64 เกิดช่องว่าง 44 address และ /27 ไปอยู่ .128 กฎคือ Network ของวงขนาด S ต้องหารด้วย S ลงตัว เช่น /26 เริ่มได้ที่ .0 .64 .128 .192 เท่านั้น 192.168.10.20/26 จึงไม่ใช่ Network address';
    return wrap('vlsm-boundary', 640, 452, title, s, HATCH);
  })();
  NL_FIG('diagram', 'vlsm-boundary', vlsmBoundary);

  /* ===================================================================
     diagram static-route-3r: 3 routers in a chain + ISP, Cisco static routes
     =================================================================== */
  const staticRoute3r = (function () {
    let s = T(320, 24, 'ตัวอย่าง 3 เราเตอร์: ใช้ address จากตาราง VLSM และลิงก์ WAN เพิ่ม .116/30', { s: 15, w: 1 });
    const RX = [90, 320, 550], RY = 130;
    // ISP
    s += BOX(RX[0] - 80, 40, 160, 46, 'ISP', '203.0.113.1', { st: M, subm: 1 });
    s += L(RX[0], 86, RX[0], 128, { c: INK, sw: 2.4 }) + T(RX[0] + 8, 112, 'G0/2 203.0.113.2/30', { s: 12, a: 'start', m: 1 });
    ['R1', 'R2', 'R3'].forEach((r, i) => { s += BOX(RX[i] - 45, RY, 90, 44, r, '', { st: G, sw: 2.4, s: 17 }); });
    // WAN links
    s += L(RX[0] + 45, 152, RX[1] - 45, 152, { c: INK, sw: 2.4 }) + L(RX[1] + 45, 152, RX[2] - 45, 152, { c: INK, sw: 2.4 });
    s += T((RX[0] + RX[1]) / 2, 142, '.112/30', { s: 12.5, m: 1, w: 1, c: 'var(--brown)' }) + T((RX[1] + RX[2]) / 2, 142, '.116/30', { s: 12.5, m: 1, w: 1, c: 'var(--brown)' });
    s += T(RX[0] + 49, 170, 'G0/1 .113', { s: 11.5, a: 'start', m: 1 }) + T(RX[1] - 49, 188, '.114 G0/1', { s: 11.5, a: 'end', m: 1 });
    s += T(RX[1] + 49, 170, 'G0/2 .117', { s: 11.5, a: 'start', m: 1 }) + T(RX[2] - 49, 188, '.118 G0/1', { s: 11.5, a: 'end', m: 1 });
    // LANs
    const lans = [['LAN-A .0/26', 'G0/0 .1', 'PC-A .10', B], ['LAN-B .64/27', 'G0/0 .65', 'PC-B .70', G], ['LAN-C .96/28', 'G0/0 .97', 'PC-C .100', O]];
    lans.forEach((l, i) => {
      s += L(RX[i], 174, RX[i], 214, { c: INK, sw: 2.4 }) + T(RX[i] + 6, 206, l[1], { s: 11.5, a: 'start', m: 1, halo: 1 });
      s += R(RX[i] - 84, 214, 168, 58, { f: l[3], fo: 0.12, st: l[3], rx: 8 });
      s += T(RX[i], 236, l[0], { s: 13.5, w: 1, m: 1 }) + T(RX[i], 258, l[2], { s: 12.5, m: 1 });
    });
    s += T(320, 296, 'ทุก address อยู่ในวง 192.168.10.x (เขียนย่อเฉพาะออกเตตสุดท้าย)', { s: 12.5, c: M });
    // route tables as Cisco commands
    const blocks = [
      ['R1 รู้จัก .0/26, .112/30 และ 203.0.113.0/30 (ต่อตรง) ต้องเพิ่ม:', [
        ['ip route 192.168.10.64 255.255.255.224 192.168.10.114', 'ไป LAN-B'],
        ['ip route 192.168.10.96 255.255.255.240 192.168.10.114', 'ไป LAN-C'],
        ['ip route 192.168.10.116 255.255.255.252 192.168.10.114', 'ไปลิงก์ R2–R3'],
        ['ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'Default ไป ISP']]],
      ['R2 รู้จัก .64/27, .112/30, .116/30 (ต่อตรง) ต้องเพิ่ม:', [
        ['ip route 192.168.10.0 255.255.255.192 192.168.10.113', 'ไป LAN-A'],
        ['ip route 192.168.10.96 255.255.255.240 192.168.10.118', 'ไป LAN-C'],
        ['ip route 0.0.0.0 0.0.0.0 192.168.10.113', 'ที่เหลือส่งให้ R1']]],
      ['R3 เป็นเราเตอร์ปลายทาง (stub) มีทางออกทางเดียว:', [
        ['ip route 0.0.0.0 0.0.0.0 192.168.10.117', 'ทุกที่ส่งให้ R2']]]
    ];
    let y = 318;
    blocks.forEach((b, i) => {
      const h = 30 + b[1].length * 22;
      s += R(10, y, 620, h, { f: 'var(--field)', st: [G, G, G][i], rx: 8, sw: 1.4 });
      s += T(20, y + 20, b[0], { s: 13, w: 1, a: 'start' });
      b[1].forEach((r, k) => { s += T(20, y + 42 + k * 22, r[0], { s: 12, a: 'start', m: 1 }) + T(622, y + 42 + k * 22, r[1], { s: 12, a: 'end', c: M }); });
      y += h + 10;
    });
    s += T(320, y + 10, 'ต้องมีเส้นทางกลับ: PC-C ping PC-A ได้ เมื่อ R3 ส่งไปถึง R1 ได้ และ R1 รู้ทางกลับมา .96/28', { s: 12.5, w: 1, c: O });
    y += 24;
    const title = 'เครือข่าย 3 เราเตอร์ต่อกันเป็นสาย R1 ต่อ ISP 203.0.113.1 ด้วย G0/2 203.0.113.2/30 R1 G0/1 192.168.10.113 ต่อ R2 G0/1 .114 ในวง .112/30 R2 G0/2 .117 ต่อ R3 G0/1 .118 ในวง .116/30 LAN-A .0/26 ที่ R1 G0/0 .1 LAN-B .64/27 ที่ R2 G0/0 .65 LAN-C .96/28 ที่ R3 G0/0 .97 Static route: R1 ไป .64/27 .96/28 .116/30 ผ่าน .114 และ default ผ่าน 203.0.113.1 R2 ไป .0/26 ผ่าน .113 ไป .96/28 ผ่าน .118 และ default ผ่าน .113 R3 มีแค่ default ผ่าน .117 ทุกเส้นทางต้องมีขากลับ';
    return wrap('static-route-3r', 640, y + 6, title, s);
  })();
  NL_FIG('diagram', 'static-route-3r', staticRoute3r);

  /* ===================================================================
     diagram route-table-read: Linux ip route, Windows route print, Cisco show ip route
     =================================================================== */
  const routeTableRead = (function () {
    let s = T(320, 24, 'อ่านตารางเส้นทางจาก 3 ระบบ (เครือข่ายเดียวกับตัวอย่าง 3 เราเตอร์)', { s: 15, w: 1 });
    let y = 38;
    const leg = (items) => { let o = ''; items.forEach((it, i) => { o += NUM(22, y + 12 + i * 22, it[0], O) + T(40, y + 17 + i * 22, it[1], { s: 12.5, a: 'start' }); }); y += items.length * 22 + 10; return o; };
    s += T(10, y + 12, 'Linux: PC-B (192.168.10.70/27)', { s: 13.5, w: 1, a: 'start' }); y += 20;
    const a = TERM(10, y, 620, [{ t: '$ ip route', c: 'var(--term-dim)' },
      'default via 192.168.10.65 dev eth0 proto static metric 100',
      '192.168.10.64/27 dev eth0 proto kernel scope link src 192.168.10.70'], { marks: { 1: 1, 2: 2 } });
    s += a.svg; y += a.h + 6;
    s += leg([[1, 'default = 0.0.0.0/0, via = next hop (IP เราเตอร์), dev = exit interface'], [2, 'ไม่มี via = วงที่ต่อตรง (scope link) ส่งถึงปลายทางเองโดยหา MAC ด้วย ARP']]);
    s += T(10, y + 12, 'Windows: PC-A (192.168.10.10/26) คำสั่ง route print -4 (บางส่วน)', { s: 13.5, w: 1, a: 'start' }); y += 20;
    const b = TERM(10, y, 620, [{ t: 'Network Destination        Netmask         Gateway      Interface  Metric', c: 'var(--term-dim)' },
      '          0.0.0.0          0.0.0.0    192.168.10.1  192.168.10.10     25',
      '     192.168.10.0  255.255.255.192        On-link   192.168.10.10    281',
      '    192.168.10.63  255.255.255.255        On-link   192.168.10.10    281'], { marks: { 1: 3, 2: 4, 3: 5 }, fs: 11.5 });
    s += b.svg; y += b.h + 6;
    s += leg([[3, 'Default route: ปลายทางนอกวงทั้งหมดส่งให้ Gateway 192.168.10.1'], [4, 'On-link = วงที่ต่อตรง ไม่ต้องผ่านเราเตอร์ (mask .192 = /26)'], [5, 'Host route /32 ของ Broadcast .63 ค่า Metric ยิ่งน้อยยิ่งถูกเลือก']]);
    s += T(10, y + 12, 'Cisco: R1 คำสั่ง show ip route (บางส่วน)', { s: 13.5, w: 1, a: 'start' }); y += 20;
    const c = TERM(10, y, 620, [
      'Gateway of last resort is 203.0.113.1 to network 0.0.0.0',
      'S*    0.0.0.0/0 [1/0] via 203.0.113.1',
      'C        192.168.10.0/26 is directly connected, GigabitEthernet0/0',
      'L        192.168.10.1/32 is directly connected, GigabitEthernet0/0',
      'S        192.168.10.64/27 [1/0] via 192.168.10.114',
      'S        192.168.10.96/28 [1/0] via 192.168.10.114',
      'C        192.168.10.112/30 is directly connected, GigabitEthernet0/1'], { marks: { 1: 6, 2: 7, 3: 8, 4: 9 }, fs: 11.5 });
    s += c.svg; y += c.h + 6;
    s += leg([[6, 'S* = static ที่เป็น default route (Gateway of last resort)'], [7, 'C = connected วงที่ต่อตรงกับ interface'], [8, 'L = local: address ของเราเตอร์เองบน interface นั้น (/32)'], [9, '[1/0] = [Administrative Distance / Metric] static มี AD = 1']]);
    const title = 'ตัวอย่างตารางเส้นทาง Linux คำสั่ง ip route ของ PC-B: default via 192.168.10.65 dev eth0 คือ default route ผ่าน next hop และ exit interface ส่วน 192.168.10.64/27 dev eth0 scope link คือวงที่ต่อตรง Windows คำสั่ง route print ของ PC-A: 0.0.0.0 mask 0.0.0.0 gateway 192.168.10.1 คือ default route, 192.168.10.0 mask 255.255.255.192 On-link คือวงที่ต่อตรง Cisco show ip route ของ R1: S* 0.0.0.0/0 via 203.0.113.1 คือ default, C คือ connected, L คือ address ของเราเตอร์เอง, S 192.168.10.64/27 [1/0] via 192.168.10.114 คือ static route ที่มี administrative distance 1';
    return wrap('route-table-read', 640, y + 2, title, s);
  })();
  NL_FIG('diagram', 'route-table-read', routeTableRead);

  /* ===================================================================
     diagram cloud-models: who manages each layer, on-premises / IaaS / PaaS / SaaS
     =================================================================== */
  const cloudModels = (function () {
    const layers = ['แอปพลิเคชัน', 'ข้อมูลและบัญชีผู้ใช้', 'Runtime', 'Middleware', 'ระบบปฏิบัติการ', 'Virtualization', 'เซิร์ฟเวอร์', 'Storage', 'เครือข่าย'];
    // c = customer, p = provider
    const cols = [['On-premises', 'ccccccccc'], ['IaaS', 'cccccpppp'], ['PaaS', 'ccppppppp'], ['SaaS', 'pcppppppp']];
    const X0 = 150, CW = 120;
    let s = T(320, 24, 'ใครดูแลอะไร: ยิ่งไปทางขวา ผู้ให้บริการดูแลมากขึ้น', { s: 15.5, w: 1 });
    s += R(150, 38, 14, 14, { f: B, fo: 0.3, st: B, rx: 3, sw: 1.4 }) + T(170, 50, 'คุณ (องค์กร/ผู้ใช้) ดูแล', { s: 13, a: 'start' });
    s += R(370, 38, 14, 14, { f: G, fo: 0.3, st: G, rx: 3, sw: 1.4 }) + T(390, 50, 'ผู้ให้บริการคลาวด์ดูแล', { s: 13, a: 'start' });
    cols.forEach((c, i) => { s += T(X0 + i * CW + CW / 2, 80, c[0], { s: 14.5, w: 1 }); });
    layers.forEach((l, r) => {
      const y = 90 + r * 32;
      s += T(142, y + 20, l, { s: 13, a: 'end', w: r === 1 ? 1 : 0 });
      cols.forEach((c, i) => {
        const cu = c[1][r] === 'c';
        s += R(X0 + i * CW + 3, y + 2, CW - 6, 28, { f: cu ? B : G, fo: cu ? 0.22 : 0.16, st: cu ? B : G, rx: 5, sw: 1.2 });
        s += T(X0 + i * CW + CW / 2, y + 21, cu ? 'คุณ' : 'ผู้ให้บริการ', { s: 12, c: INK });
      });
    });
    const yb = 90 + 9 * 32 + 12;
    const ex = [['ห้องเซิร์ฟเวอร์', 'ของวิทยาลัยเอง'], ['เครื่องเสมือน', 'เช่น Amazon EC2,', 'Azure VM'], ['แพลตฟอร์มรันโค้ด', 'เช่น Google App', 'Engine, Azure', 'App Service'], ['ซอฟต์แวร์พร้อมใช้', 'เช่น Microsoft 365,', 'Google Workspace']];
    s += T(142, yb + 16, 'ตัวอย่าง', { s: 13, a: 'end', w: 1 });
    ex.forEach((e, i) => { e.forEach((t, k) => { s += T(X0 + i * CW + CW / 2, yb + 16 + k * 17, t, { s: 11.5, c: k ? M : INK, w: k ? 0 : 1 }); }); });
    s += T(320, yb + 92, 'ข้อมูลและสิทธิ์ผู้ใช้เป็นความรับผิดชอบของคุณทุกแบบ (Shared Responsibility Model)', { s: 12.5, c: O, w: 1 });
    const title = 'ตารางความรับผิดชอบ 9 ชั้น ได้แก่ แอปพลิเคชัน ข้อมูลและบัญชีผู้ใช้ Runtime Middleware ระบบปฏิบัติการ Virtualization เซิร์ฟเวอร์ Storage และเครือข่าย On-premises องค์กรดูแลทุกชั้น IaaS ผู้ให้บริการดูแล Virtualization เซิร์ฟเวอร์ Storage เครือข่าย ส่วนคุณดูแลระบบปฏิบัติการขึ้นไป PaaS ผู้ให้บริการดูแลถึง Runtime คุณดูแลแอปและข้อมูล SaaS ผู้ให้บริการดูแลแม้แต่แอปพลิเคชัน แต่ข้อมูลและสิทธิ์ผู้ใช้ยังเป็นความรับผิดชอบของคุณทุกแบบ ตัวอย่าง IaaS Amazon EC2 Azure VM, PaaS Google App Engine Azure App Service, SaaS Microsoft 365 Google Workspace';
    return wrap('cloud-models', 640, yb + 106, title, s);
  })();
  NL_FIG('diagram', 'cloud-models', cloudModels);

  /* ===================================================================
     diagram vpc-layout: region, VPC, 2 AZs, public/private subnets, IGW, NAT GW, SG vs NACL, route tables
     =================================================================== */
  const vpcLayout = (function () {
    let s = '';
    s += BOX(250, 6, 140, 40, 'อินเทอร์เน็ต', '', { st: M, s: 14 });
    s += R(10, 60, 620, 520, { f: 'none', st: M, rx: 14, sw: 1.6, d: '8 5' }) + T(24, 82, 'Region (ภูมิภาค)', { s: 13, a: 'start', c: M, w: 1 });
    s += R(24, 94, 592, 472, { f: B, fo: 0.04, st: B, rx: 12, sw: 2 }) + T(38, 116, 'VPC 10.0.0.0/16', { s: 14, a: 'start', w: 1, c: B });
    // IGW on VPC edge
    s += BOX(250, 80, 140, 36, 'Internet Gateway', '', { st: G, sw: 2.2, s: 13, f: 'var(--panel)' });
    s += L(320, 46, 320, 80, { c: G, sw: 2.4 });
    const AZ = [[38, 'Availability Zone A', '10.0.1.0/24', '10.0.11.0/24'], [330, 'Availability Zone B', '10.0.2.0/24', '10.0.12.0/24']];
    AZ.forEach((a, i) => {
      const x = a[0];
      s += R(x, 128, 272, 300, { f: 'none', st: M, rx: 10, sw: 1.4, d: '4 4' }) + T(x + 136, 148, a[1], { s: 13, w: 1, c: M , halo: 1 });
      // public subnet
      s += R(x + 10, 158, 252, 118, { f: G, fo: 0.08, st: G, rx: 8, sw: 2, d: '7 4' });
      s += T(x + 20, 176, 'Public subnet ' + a[2], { s: 12.5, a: 'start', w: 1, m: 0 , halo: 1 });
      s += R(x + 22, 188, 112, 52, { f: 'var(--panel)', st: O, rx: 6, sw: 2.2 }) + T(x + 78, 210, 'Web-' + (i + 1), { s: 13, w: 1 }) + T(x + 78, 228, 'SG-web', { s: 11.5, c: O, w: 1 });
      if (i === 0) s += BOX(x + 142, 188, 110, 52, 'NAT Gateway', 'ออกได้ทางเดียว', { st: G, s: 12.5, ss: 11 });
      s += T(x + 20, 266, 'NACL ของ subnet (เส้นประ)', { s: 11.5, a: 'start', c: M });
      // private subnet
      s += R(x + 10, 290, 252, 126, { f: B, fo: 0.08, st: B, rx: 8, sw: 2, d: '7 4' });
      s += T(x + 20, 308, 'Private subnet ' + a[3], { s: 12.5, a: 'start', w: 1 , halo: 1 });
      s += R(x + 22, 320, 112, 52, { f: 'var(--panel)', st: O, rx: 6, sw: 2.2 }) + T(x + 78, 342, i ? 'DB-2 (สำรอง)' : 'DB-1', { s: 13, w: 1 }) + T(x + 78, 360, 'SG-db', { s: 11.5, c: O, w: 1 });
      s += T(x + 20, 398, i ? 'ไม่มี Public IP เข้าจากนอกโดยตรงไม่ได้' : 'ออกผ่าน NAT ได้ (เส้นประ) เข้าจากนอกไม่ได้', { s: 11.5, a: 'start', c: M });
    });
    // arrows: internet -> web, db -> nat -> igw
    s += P('M300,116 L110,186', { c: G, me: 'fgi-g' });
    s += P('M134,346 L230,242', { c: B, me: 'fgi-b', d: '6 4' });
    s += P('M236,188 L300,118', { c: B, me: 'fgi-b', d: '6 4' });
    // route tables
    s += R(38, 440, 272, 116, { f: 'var(--panel)', st: G, rx: 8, sw: 1.6 });
    s += T(48, 460, 'Route table ของ Public subnet', { s: 12.5, a: 'start', w: 1 });
    s += T(48, 486, '10.0.0.0/16  → local', { s: 12, a: 'start', m: 1 }) + T(48, 508, '0.0.0.0/0    → internet-gw', { s: 12, a: 'start', m: 1, w: 1 });
    s += T(48, 536, 'จึงเรียกว่า Public subnet', { s: 11.5, a: 'start', c: M });
    s += R(330, 440, 272, 116, { f: 'var(--panel)', st: B, rx: 8, sw: 1.6 });
    s += T(340, 460, 'Route table ของ Private subnet', { s: 12.5, a: 'start', w: 1 });
    s += T(340, 486, '10.0.0.0/16  → local', { s: 12, a: 'start', m: 1 }) + T(340, 508, '0.0.0.0/0    → nat-gw', { s: 12, a: 'start', m: 1, w: 1 });
    s += T(340, 536, 'ขาออกผ่าน NAT ขาเข้าเริ่มจากนอกไม่ได้', { s: 11.5, a: 'start', c: M });
    // legend SG/NACL
    s += R(10, 590, 620, 60, { f: 'var(--field)', st: 'var(--line)', rx: 8, sw: 1.2 });
    s += T(20, 612, 'Security Group (กรอบส้ม) = ไฟร์วอลล์ระดับเครื่อง, stateful, มีแต่กฎอนุญาต', { s: 12.5, a: 'start' });
    s += T(20, 636, 'Network ACL (เส้นประรอบ subnet) = ระดับ subnet, stateless, กฎมีลำดับเลข อนุญาต/ปฏิเสธได้', { s: 12.5, a: 'start' });
    const title = 'โครงสร้างเครือข่ายเสมือนบนคลาวด์ใน Region หนึ่ง VPC 10.0.0.0/16 กระจาย 2 Availability Zone แต่ละ AZ มี Public subnet 10.0.1.0/24 และ 10.0.2.0/24 ที่มีเว็บเซิร์ฟเวอร์ และ Private subnet 10.0.11.0/24 และ 10.0.12.0/24 ที่มีฐานข้อมูล Internet Gateway ติดอยู่ที่ขอบ VPC Route table ของ public subnet ส่ง 0.0.0.0/0 ไป internet gateway ส่วน private subnet ส่ง 0.0.0.0/0 ไป NAT Gateway ที่อยู่ใน public subnet ทำให้ออกได้แต่คนนอกเริ่มเชื่อมต่อเข้ามาไม่ได้ Security Group คือไฟร์วอลล์ระดับเครื่องแบบ stateful Network ACL คือกฎระดับ subnet แบบ stateless';
    return wrap('vpc-layout', 640, 660, title, s);
  })();
  NL_FIG('diagram', 'vpc-layout', vpcLayout);

  /* ===================================================================
     diagram sdn-planes: traditional (control+data in every box) vs SDN (central controller, NB/SB APIs)
     =================================================================== */
  const sdnPlanes = (function () {
    let s = T(320, 24, 'แบบดั้งเดิม: ทุกอุปกรณ์มีทั้งสมองและมือ', { s: 15, w: 1 });
    const sw3 = [40, 240, 440];
    s += BOX(250, 36, 140, 36, 'ผู้ดูแลระบบ', 'ตั้งค่าทีละเครื่อง', { s: 13, ss: 11 });
    sw3.forEach((x, i) => {
      s += P(`M320,72 L${x + 80},${108}`, { c: M, me: 'fgi-a' });
      s += R(x, 110, 160, 110, { f: 'var(--panel)', st: 'var(--line)', rx: 10 });
      s += T(x + 80, 128, 'Switch ' + (i + 1), { s: 13, w: 1 });
      s += R(x + 10, 136, 140, 36, { f: O, fo: 0.18, st: O, rx: 6, sw: 1.4 }) + T(x + 80, 152, 'Control plane', { s: 12.5, w: 1 }) + T(x + 80, 166, 'คิดเส้นทางเอง', { s: 11, c: M });
      s += R(x + 10, 176, 140, 36, { f: B, fo: 0.16, st: B, rx: 6, sw: 1.4 }) + T(x + 80, 192, 'Data plane', { s: 12.5, w: 1 }) + T(x + 80, 206, 'ส่งต่อแพ็กเก็ต', { s: 11, c: M });
    });
    s += L(200, 194, 240, 194, { c: INK, sw: 2.4 }) + L(400, 194, 440, 194, { c: INK, sw: 2.4 });
    s += T(320, 244, 'แต่ละตัวคุยกันด้วย routing protocol (เช่น OSPF) แล้วตัดสินใจเอง เปลี่ยนนโยบายต้องเข้าทุกเครื่อง', { s: 12, c: M });
    s += L(10, 262, 630, 262, { c: 'var(--line)', sw: 1.6, d: '6 5' });
    s += T(320, 290, 'SDN: แยกสมองไปรวมที่ Controller', { s: 15, w: 1 });
    s += BOX(110, 304, 420, 42, 'แอปพลิเคชันเครือข่าย', 'เช่น ไฟร์วอลล์, load balancing, จัดเส้นทาง, ตรวจสอบ', { st: M, s: 13.5, ss: 11.5 });
    s += P('M320,346 L320,374', { c: G, me: 'fgi-g', sw: 2.6 }) + P('M300,374 L300,348', { c: G, me: 'fgi-g', sw: 2.6 });
    s += T(336, 366, 'Northbound API (เช่น REST)', { s: 12, a: 'start', c: G, w: 1 });
    s += R(110, 378, 420, 58, { f: O, fo: 0.18, st: O, rx: 10, sw: 2.4 });
    s += T(320, 400, 'SDN Controller = Control plane รวมศูนย์', { s: 14, w: 1 });
    s += T(320, 420, 'เห็นทั้งเครือข่าย คำนวณแล้วส่ง flow rule ลงไป (เช่น ONOS, OpenDaylight)', { s: 11.5, c: M });
    sw3.forEach((x, i) => {
      s += P(`M${300 + (i - 1) * 60},436 L${x + 80},${494}`, { c: B, me: 'fgi-b', sw: 2.2 });
      s += R(x, 498, 160, 66, { f: B, fo: 0.12, st: B, rx: 10, sw: 1.8 });
      s += T(x + 80, 520, 'Switch ' + (i + 1), { s: 13, w: 1 }) + T(x + 80, 538, 'Data plane + Flow table', { s: 11.5 }) + T(x + 80, 554, 'ทำตามกฎที่ได้รับ', { s: 11, c: M });
    });
    s += T(492, 458, 'Southbound API', { s: 12, a: 'start', c: B, w: 1, halo: 1 }) + T(492, 474, '(เช่น OpenFlow)', { s: 11.5, a: 'start', c: B, halo: 1 });
    s += L(200, 531, 240, 531, { c: INK, sw: 2.4 }) + L(400, 531, 440, 531, { c: INK, sw: 2.4 });
    s += T(320, 588, 'เปลี่ยนนโยบายครั้งเดียวที่ Controller แล้วทุกสวิตช์ได้รับกฎใหม่ (ถ้า Controller ล่ม ต้องมีตัวสำรอง)', { s: 12, c: O, w: 1 });
    const title = 'เปรียบเทียบเครือข่ายแบบดั้งเดิมกับ SDN แบบดั้งเดิมสวิตช์ทุกตัวมีทั้ง Control plane ที่คิดเส้นทางเองและ Data plane ที่ส่งต่อแพ็กเก็ต ผู้ดูแลต้องตั้งค่าทีละเครื่อง แบบ SDN แอปพลิเคชันเครือข่ายสั่งงานผ่าน Northbound API เช่น REST ไปยัง SDN Controller ซึ่งเป็น Control plane รวมศูนย์ที่เห็นทั้งเครือข่าย แล้วส่ง flow rule ผ่าน Southbound API เช่น OpenFlow ลงไปยังสวิตช์ที่เหลือแต่ Data plane และ Flow table เปลี่ยนนโยบายครั้งเดียวที่ Controller แต่ต้องมี Controller สำรอง';
    return wrap('sdn-planes', 640, 600, title, s);
  })();
  NL_FIG('diagram', 'sdn-planes', sdnPlanes);

  /* ===================================================================
     diagram openflow-pipeline: flow entry fields, table-miss -> Packet-In -> Flow-Mod/Packet-Out
     =================================================================== */
  const openflowPipeline = (function () {
    let s = T(320, 24, 'Flow table ของสวิตช์ OpenFlow (ตัวอย่างอย่างง่าย)', { s: 15, w: 1 });
    const cx = [10, 92, 300, 450, 552];
    const head = ['Priority', 'Match (เงื่อนไข)', 'Action', 'Counter', 'Timeout'];
    s += R(10, 38, 620, 28, { f: 'var(--field)', st: 'var(--line)', rx: 6, sw: 1.2 });
    head.forEach((h, i) => { s += T(cx[i] + 8, 57, h, { s: 12.5, w: 1, a: 'start' }); });
    const rows = [['200', 'src 10.0.0.2, dst 10.0.0.3', 'drop', '12 แพ็กเก็ต', 'idle 60 s', BAD],
      ['100', 'dst 10.0.0.3, TCP 80', 'output: พอร์ต 3', '340 แพ็กเก็ต', 'idle 60 s', G],
      ['0', 'ทุกแพ็กเก็ต (table-miss)', 'ส่งให้ Controller', '–', '–', O]];
    rows.forEach((r, k) => {
      const y = 68 + k * 32;
      s += R(10, y, 620, 30, { f: r[5], fo: 0.08, st: 'none', sw: 0, rx: 4 });
      r.slice(0, 5).forEach((t, i) => { s += T(cx[i] + 8, y + 20, t, { s: 12.5, a: 'start', m: i === 0, c: i === 2 ? r[5] : INK, w: i === 2 }); });
    });
    s += T(320, 182, 'สวิตช์ไล่จาก Priority สูงไปต่ำ ใช้แถวแรกที่ Match ตรง และนับ Counter ทุกครั้ง', { s: 12.5, c: M });
    // sequence
    const XH = 70, XS = 260, XC = 450, XD = 590;
    s += T(320, 214, 'แพ็กเก็ตแรกของการสื่อสารใหม่ (reactive)', { s: 14, w: 1 });
    s += BOX(XH - 50, 226, 100, 36, 'H1', '10.0.0.1', { s: 13, ss: 11, subm: 1 });
    s += BOX(XS - 60, 226, 120, 36, 'Switch S1', '', { st: B, s: 13 });
    s += BOX(XC - 60, 226, 120, 36, 'Controller', '', { st: O, s: 13 });
    s += BOX(XD - 46, 226, 92, 36, 'H3', '10.0.0.3', { s: 13, ss: 11, subm: 1 });
    [XH, XS, XC, XD].forEach(x => { s += L(x, 262, x, 470, { c: 'var(--line)', sw: 2, d: '4 5' }); });
    s += NUM(14, 290, 1, B) + P(`M${XH},292 L${XS - 4},292`, { c: B, me: 'fgi-b' }) + T((XH + XS) / 2, 284, 'TCP 80 ไป H3', { s: 12 });
    s += RB(XS - 70, 300, 140, 24, { f: O, fo: 0.12, st: O, rx: 5, sw: 1.2 }) + T(XS, 317, 'ไม่มีแถวตรง = table-miss', { s: 11.5, w: 1 });
    s += NUM(14, 344, 2, O) + P(`M${XS},346 L${XC - 4},346`, { c: O, me: 'fgi-o' }) + T((XS + XC) / 2, 338, 'Packet-In', { s: 12.5, w: 1, c: O });
    s += RB(XC - 80, 354, 160, 24, { f: 'var(--field)', st: 'var(--line)', rx: 5, sw: 1 }) + T(XC, 371, 'แอปตัดสิน: อนุญาต', { s: 11.5 });
    s += NUM(14, 398, 3, G) + P(`M${XC},400 L${XS + 4},400`, { c: G, me: 'fgi-g' }) + T((XS + XC) / 2, 392, 'Flow-Mod (เพิ่มแถว) + Packet-Out', { s: 12, w: 1, c: G });
    s += NUM(14, 430, 4, B) + P(`M${XS},432 L${XD - 4},432`, { c: B, me: 'fgi-b' }) + T((XS + XD) / 2, 424, 'ส่งออกพอร์ต 3', { s: 12 });
    s += NUM(14, 462, 5, G) + P(`M${XH},464 L${XS - 4},464`, { c: G, me: 'fgi-g', d: '6 4' }) + P(`M${XS},464 L${XD - 4},464`, { c: G, me: 'fgi-g', d: '6 4' });
    s += T((XS + XD) / 2 - 20, 456, 'แพ็กเก็ตถัดไป: Match แถวที่เพิ่ม ไม่ผ่าน Controller', { s: 11.5, c: G, w: 1 });
    s += T(320, 494, 'Controller เชื่อมกับสวิตช์ทาง TCP พอร์ต 6653 (IANA) และมักเข้ารหัสด้วย TLS', { s: 12, c: M });
    const title = 'Flow table ของสวิตช์ OpenFlow มีคอลัมน์ Priority Match Action Counter Timeout ตัวอย่าง priority 200 src 10.0.0.2 dst 10.0.0.3 drop, priority 100 dst 10.0.0.3 TCP 80 output พอร์ต 3, priority 0 table-miss ส่งให้ Controller ลำดับเมื่อแพ็กเก็ตแรกจาก H1 ไป H3 มาถึง: 1 ไปถึง S1 ไม่มีแถวตรง 2 S1 ส่ง Packet-In ให้ Controller 3 Controller ส่ง Flow-Mod เพิ่มแถวและ Packet-Out 4 S1 ส่งออกพอร์ต 3 ไป H3 5 แพ็กเก็ตถัดไป match แถวใหม่ในสวิตช์โดยไม่ผ่าน Controller Controller ใช้ TCP พอร์ต 6653';
    return wrap('openflow-pipeline', 640, 508, title, s);
  })();
  NL_FIG('diagram', 'openflow-pipeline', openflowPipeline);

  /* ===================================================================
     diagram automation-pipeline: source of truth + template -> render -> push -> verify -> save / rollback
     =================================================================== */
  const automationPipeline = (function () {
    let s = T(320, 24, 'งานอัตโนมัติ: ข้อมูล + แม่แบบ → config ของทุกเครื่อง → ตรวจ', { s: 15, w: 1 });
    const step = (y, n, title, sub, c) => NUM(22, y + 22, n, c) + R(40, y, 590, 44, { f: c, fo: 0.08, st: c, rx: 8, sw: 1.6 }) + T(52, y + 19, title, { s: 13.5, w: 1, a: 'start' }) + T(52, y + 37, sub, { s: 12, a: 'start', c: M });
    s += step(38, 1, 'Source of Truth: ข้อมูลที่ "ควรเป็น" ที่เดียว', 'เช่น ตาราง inventory, ไฟล์ YAML ใน Git หรือระบบอย่าง NetBox', B);
    const inv = TERM(40, 88, 590, ['hostname,mgmt_ip,vlans', 'ACC-SW1,10.10.99.11,10;20;99', 'ACC-SW2,10.10.99.12,10;20;30;99'], { lh: 17 });
    s += inv.svg;
    let y = 88 + inv.h + 8;
    s += step(y, 2, 'Template (แม่แบบ Jinja2): ส่วนที่เหมือนกันทุกเครื่อง + ตัวแปร', '{{ ตัวแปร }} แทนค่า, {% for %} วนลูป, {% if %} เงื่อนไข', G);
    y += 50;
    const tp = TERM(40, y, 590, ['hostname {{ hostname }}', '{% for v in vlans %}', 'vlan {{ v }}', '{% endfor %}', 'interface Vlan99', ' ip address {{ mgmt_ip }} 255.255.255.0'], { lh: 17 });
    s += tp.svg; y += tp.h + 8;
    s += step(y, 3, 'Render: ได้ config เฉพาะของแต่ละเครื่อง', 'ACC-SW1 → hostname ACC-SW1, vlan 10, vlan 20, vlan 99, ip address 10.10.99.11', O);
    y += 52;
    s += step(y, 4, 'Push: ส่งเข้าอุปกรณ์ผ่าน SSH หรือ API', 'เครื่องมือ: Ansible (playbook YAML), Python + Netmiko หรือ NAPALM', B);
    y += 52;
    s += step(y, 5, 'Verify: ตรวจผลจริง (ping, show vlan, พอร์ต 22)', 'ผ่าน → save ลง startup-config / ไม่ผ่าน → rollback เป็น backup', G);
    y += 56;
    s += T(10, y + 10, 'ตัวอย่าง Ansible (inventory แบบ INI และ playbook แบบ YAML)', { s: 13, w: 1, a: 'start' });
    y += 18;
    const ai = TERM(10, y, 620, ['[access_switches]', 'ACC-SW1 ansible_host=10.10.99.11', 'ACC-SW2 ansible_host=10.10.99.12', '[access_switches:vars]', 'ansible_network_os=cisco.ios.ios', 'ansible_connection=ansible.netcommon.network_cli'], { lh: 17 });
    s += ai.svg; y += ai.h + 6;
    const pb = TERM(10, y, 620, ['- name: เพิ่ม VLAN 30 ให้ access switch ทุกตัว', '  hosts: access_switches', '  gather_facts: false', '  tasks:', '    - name: VLAN 30 ต้องมีอยู่', '      cisco.ios.ios_vlans:', '        config:', '          - vlan_id: 30', '            name: LAB-IOT', '        state: merged'], { lh: 17 });
    s += pb.svg; y += pb.h + 8;
    s += T(320, y + 8, 'YAML ใช้การย่อหน้า (เว้นวรรค ไม่ใช้ Tab) บอกโครงสร้าง ย่อหน้าผิด = playbook ผิด', { s: 12, c: O, w: 1 });
    const title = 'ขั้นตอนงานอัตโนมัติ 1 Source of Truth เช่น inventory hostname mgmt_ip vlans ของ ACC-SW1 และ ACC-SW2 2 Template Jinja2 ใช้ {{ ตัวแปร }} {% for %} {% if %} 3 Render ได้ config เฉพาะแต่ละเครื่อง 4 Push ผ่าน SSH หรือ API ด้วย Ansible Netmiko หรือ NAPALM 5 Verify ตรวจผลจริง ผ่านแล้ว save ไม่ผ่าน rollback ตัวอย่าง Ansible inventory กลุ่ม access_switches พร้อม ansible_network_os cisco.ios.ios และ playbook YAML ที่ใช้โมดูล cisco.ios.ios_vlans สร้าง VLAN 30 ชื่อ LAB-IOT แบบ state merged';
    return wrap('automation-pipeline', 640, y + 22, title, s);
  })();
  NL_FIG('diagram', 'automation-pipeline', automationPipeline);

  /* ===================================================================
     diagram idempotent-run: command-style vs desired-state, run twice
     =================================================================== */
  const idempotentRun = (function () {
    let s = T(320, 24, 'Idempotent: รันซ้ำกี่ครั้งก็ได้ผลเหมือนรันครั้งเดียว', { s: 15, w: 1 });
    s += T(10, 54, 'แบบสั่งคำสั่งตรง ๆ (ไม่ idempotent)', { s: 13.5, w: 1, a: 'start', c: BAD });
    const a = TERM(10, 64, 620, [
      { t: '# รันครั้งที่ 1', c: 'var(--term-dim)' },
      '$ sudo ip route add 10.20.0.0/16 via 192.168.1.1',
      { t: '# รันครั้งที่ 2 (สคริปต์เดิม)', c: 'var(--term-dim)' },
      '$ sudo ip route add 10.20.0.0/16 via 192.168.1.1',
      'RTNETLINK answers: File exists'], { lh: 18 });
    s += a.svg;
    let y = 64 + a.h + 8;
    s += T(10, y + 12, 'ครั้งที่ 2 ล้มเหลวเพราะมีเส้นทางอยู่แล้ว (ใช้ ip route replace จะไม่ error)', { s: 12.5, a: 'start', c: M });
    y += 36;
    s += T(10, y, 'แบบประกาศสถานะที่ต้องการ (idempotent) เช่น โมดูล Ansible', { s: 13.5, w: 1, a: 'start', c: G });
    y += 12;
    // two runs side by side as status cards
    const devs = [['ACC-SW1', 'ยังไม่มี VLAN 30'], ['ACC-SW2', 'มี VLAN 30 แล้ว'], ['ACC-SW3', 'ยังไม่มี VLAN 30']];
    s += R(10, y, 620, 30, { f: 'var(--field)', st: 'var(--line)', rx: 6, sw: 1.2 });
    [[18, 'อุปกรณ์'], [130, 'สถานะเดิม'], [300, 'รันครั้งที่ 1'], [470, 'รันครั้งที่ 2']].forEach(c => { s += T(c[0], y + 20, c[1], { s: 12.5, w: 1, a: 'start' }); });
    devs.forEach((d, i) => {
      const yy = y + 32 + i * 30, has = i === 1;
      s += T(18, yy + 20, d[0], { s: 12.5, a: 'start', m: 1 }) + T(130, yy + 20, d[1], { s: 12.5, a: 'start' });
      s += T(300, yy + 20, has ? 'ok (ไม่ต้องทำ)' : 'changed (เพิ่ม)', { s: 12.5, a: 'start', w: 1, c: has ? G : O });
      s += T(470, yy + 20, 'ok (ไม่ต้องทำ)', { s: 12.5, a: 'start', w: 1, c: G });
    });
    y += 32 + 3 * 30 + 6;
    const r = TERM(10, y, 620, [
      { t: 'PLAY RECAP (ครั้งที่ 1)', c: 'var(--term-dim)' },
      'ACC-SW1 : ok=1  changed=1  unreachable=0  failed=0',
      'ACC-SW2 : ok=1  changed=0  unreachable=0  failed=0',
      { t: 'PLAY RECAP (ครั้งที่ 2)', c: 'var(--term-dim)' },
      'ACC-SW1 : ok=1  changed=0  unreachable=0  failed=0',
      'ACC-SW2 : ok=1  changed=0  unreachable=0  failed=0'], { lh: 18 });
    s += r.svg; y += r.h + 8;
    s += T(320, y + 10, 'โมดูลอ่านสถานะจริงก่อน แล้วเปลี่ยนเฉพาะส่วนที่ต่าง changed=0 คือยืนยันว่าตรงแล้ว', { s: 12.5, c: M });
    const title = 'เปรียบเทียบแบบไม่ idempotent: รันคำสั่ง ip route add 10.20.0.0/16 via 192.168.1.1 ครั้งที่สองได้ error RTNETLINK answers: File exists กับแบบ idempotent ที่ประกาศสถานะต้องการว่า VLAN 30 ต้องมีอยู่ รันครั้งแรก ACC-SW1 และ ACC-SW3 ที่ยังไม่มีได้ changed ส่วน ACC-SW2 ที่มีแล้วได้ ok รันครั้งที่สองทุกเครื่องได้ ok changed=0 ผลสรุป PLAY RECAP แสดง ok changed unreachable failed';
    return wrap('idempotent-run', 640, y + 24, title, s);
  })();
  NL_FIG('diagram', 'idempotent-run', idempotentRun);

  /* =================================================================== widgets */
  const CSS = `
.nlwi .nlw-btn{min-height:44px}
.nlwi .nlw-btn.nlw-sm{min-height:36px}
.nlwi .nlwi-pane{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:8px 0;background:var(--panel)}
.nlwi .nlwi-pane h4{margin:0 0 6px;font-size:15.5px;line-height:1.35}
.nlwi .nlwi-pane p{margin:.3em 0}
.nlwi .nlwi-pane.nlwi-now{border:2px solid var(--blue)}
.nlwi .nlwi-bits{display:flex;flex-wrap:wrap;gap:4px 10px;font-family:"JetBrains Mono",Consolas,monospace;font-size:14px;margin:4px 0}
.nlwi .nlwi-oct{display:inline-flex;gap:1px}
.nlwi .nlwi-oct i{font-style:normal;display:inline-block;min-width:13px;text-align:center;border-radius:3px}
.nlwi .nlwi-n{background:color-mix(in srgb,var(--blue) 22%,transparent)}
.nlwi .nlwi-h{background:color-mix(in srgb,var(--orange) 24%,transparent)}
.nlwi .nlwi-kv{display:grid;grid-template-columns:minmax(0,max-content) minmax(0,1fr);gap:3px 12px;font-size:14.5px;margin:6px 0}
.nlwi .nlwi-kv dt{color:var(--muted)}
.nlwi .nlwi-kv dd{margin:0;font-family:"JetBrains Mono",Consolas,monospace;overflow-wrap:anywhere}
.nlwi .nlwi-chips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.nlwi .nlwi-chips span{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;border:1px solid var(--line);border-radius:6px;padding:1px 7px;background:var(--field)}
.nlwi .nlwi-chips span.nlwi-on{border:2px solid var(--green);font-weight:700}
.nlwi .nlwi-bar{display:flex;width:100%;height:42px;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:8px 0;background:var(--field)}
.nlwi .nlwi-bar span{display:flex;align-items:center;justify-content:center;min-width:0;overflow:hidden;white-space:nowrap;font-size:12px;font-weight:700;color:var(--ink);border-right:1px solid var(--panel)}
.nlwi .nlwi-c0{background:color-mix(in srgb,var(--blue) 38%,transparent)}
.nlwi .nlwi-c1{background:color-mix(in srgb,var(--green) 38%,transparent)}
.nlwi .nlwi-c2{background:color-mix(in srgb,var(--orange) 38%,transparent)}
.nlwi .nlwi-c3{background:color-mix(in srgb,var(--brown) 40%,transparent)}
.nlwi .nlwi-gap{background:repeating-linear-gradient(45deg,var(--field) 0 5px,color-mix(in srgb,var(--bad) 45%,transparent) 5px 8px)}
.nlwi .nlwi-free{background:repeating-linear-gradient(45deg,var(--field) 0 5px,var(--line) 5px 8px)}
.nlwi .nlwi-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;color:var(--muted)}
.nlwi .nlwi-legend i{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:4px;border:1px solid var(--line)}
.nlwi .nlwi-rowin{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}
.nlwi .nlwi-rowin input[type=text]{flex:1 1 150px}
.nlwi .nlwi-rowin input[type=number]{width:96px}
.nlwi .nlwi-path{list-style:none;padding:0;margin:6px 0}
.nlwi .nlwi-path li{border-left:4px solid var(--line);padding:4px 10px;margin:4px 0;background:var(--field);border-radius:0 6px 6px 0;font-size:14px;overflow-wrap:anywhere}
.nlwi .nlwi-path li.nlwi-y{border-left-color:var(--ok)}
.nlwi .nlwi-path li.nlwi-x{border-left-color:var(--bad)}
.nlwi .nlwi-path li.nlwi-i{border-left-color:var(--blue)}
.nlwi fieldset{border:1px solid var(--line);border-radius:10px;padding:6px 10px 8px;margin:8px 0;min-width:0}
.nlwi legend{font-weight:700;font-size:14.5px;padding:0 4px}
.nlwi .nlwi-code{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;line-height:1.5;width:100%;min-height:150px;white-space:pre;overflow:auto}
.nlwi .nlwi-out{font-family:"JetBrains Mono",Consolas,monospace;font-size:12.5px;line-height:1.55;background:var(--term-bg);color:var(--term-ink);border-radius:8px;padding:10px 12px;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0;max-height:320px;overflow:auto}
.nlwi .nlwi-out:empty{display:none}
.nlwi .nlwi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
.nlwi .nlwi-mx td,.nlwi .nlwi-mx th{text-align:center}
.nlwi .nlwi-mx td.nlwi-okc{color:var(--ok);font-weight:700}
.nlwi .nlwi-mx td.nlwi-badc{color:var(--bad);font-weight:700}
.nlwi .nlwi-meta{font-size:13.5px;color:var(--muted);margin:2px 0}
.nlwi tr.nlwi-hit td{background:color-mix(in srgb,var(--green) 16%,transparent)}
.nlwi tr.nlwi-bad td{background:color-mix(in srgb,var(--bad) 12%,transparent)}
`;
  function injectCSS() {
    if (!document.getElementById('nl-widget-css')) {
      const base = window.NL_WIDGETS && window.NL_WIDGETS['caesar'];
      if (typeof base === 'function') { try { base(document.createElement('div')); } catch (e) { /* base styles optional */ } }
    }
    if (document.getElementById('nlwi-css')) return;
    const st = document.createElement('style'); st.id = 'nlwi-css'; st.textContent = CSS;
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
    root.classList.add('nlw', 'nlwi');
    root.appendChild(h('div', { class: 'nlw-title' }, title));
    root.appendChild(h('p', { class: 'nlw-instr' }, h('b', null, 'คำแนะนำการใช้งาน: '), instr));
    return root;
  }
  function seg(options, value, onChange, label) {
    const wrap = h('div', { class: 'nlw-seg', role: 'group', 'aria-label': label || null });
    const btns = options.map(o => h('button', { type: 'button', class: 'nlw-btn', 'data-v': o[0], 'aria-pressed': String(o[0] === value), onclick: () => { api.set(o[0]); onChange(o[0]); } }, o[1]));
    wrap.append(...btns);
    const api = { el: wrap, btns, set(v) { btns.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === String(v)))); } };
    return api;
  }
  const field = (label, input) => h('label', { class: 'nlw-field' }, h('span', null, label), input);
  const result = (el, kind, text) => { el.className = 'nlw-result nlw-is-' + kind; el.textContent = text; };
  const fmt = n => Number(n).toLocaleString('en-US');
  function checkbox(label, checked, onchange, extra) {
    const inp = h('input', { type: 'checkbox', checked: !!checked, onchange });
    return { el: h('label', { class: 'nlw-check' }, inp, h('span', extra || null, label)), input: inp };
  }
  function selectEl(options, value, onchange, aria) {
    const sel = h('select', { onchange, 'aria-label': aria || null });
    options.forEach(o => sel.appendChild(h('option', { value: o[0], selected: o[0] === value }, o[1])));
    return sel;
  }

  /* ---------- IPv4 arithmetic with plain numbers (no 32-bit sign problems) ---------- */
  function parseIPv4(s) {
    const t = String(s).trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) return null;
    const p = t.split('.').map(Number);
    if (p.some(x => x > 255)) return null;
    return ((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3];
  }
  function parseCidr(s) {
    const m = /^\s*([\d.]+)\s*\/\s*(\d{1,2})\s*$/.exec(String(s));
    if (!m) return { err: 'ต้องเขียนในรูป IP/prefix เช่น 192.168.1.77/26' };
    const ip = parseIPv4(m[1]);
    if (ip === null) return { err: 'IP ต้องเป็นตัวเลข 4 ชุด แต่ละชุด 0–255' };
    const p = Number(m[2]);
    if (p > 32) return { err: 'prefix ต้องอยู่ระหว่าง /0 ถึง /32' };
    return { ip, p };
  }
  const octs = n => [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256];
  const ipS = n => octs(n).join('.');
  const blockOf = p => Math.pow(2, 32 - p);
  const netOf = (ip, p) => ip - (ip % blockOf(p));
  const inNet = (ip, net, p) => netOf(ip, p) === net;
  const maskS = p => ipS(Math.pow(2, 32) - blockOf(p));

  /* ---------- IPv6 helpers (RFC 5952 output) ---------- */
  function v6expand(s) {
    const t = String(s).trim().toLowerCase();
    if (!/^[0-9a-f:]+$/.test(t) || (t.match(/::/g) || []).length > 1) return null;
    let parts;
    if (t.includes('::')) {
      const [a, b] = t.split('::');
      const L = a ? a.split(':') : [], R = b ? b.split(':') : [];
      if (L.length + R.length > 7) return null;
      parts = L.concat(Array(8 - L.length - R.length).fill('0'), R);
    } else parts = t.split(':');
    if (parts.length !== 8 || parts.some(x => !/^[0-9a-f]{1,4}$/.test(x))) return null;
    return parts.map(x => parseInt(x, 16));
  }
  function v6compress(w) {
    let best = -1, bl = 0;
    for (let i = 0; i < 8;) {
      if (w[i] !== 0) { i++; continue; }
      let j = i; while (j < 8 && w[j] === 0) j++;
      if (j - i > bl) { best = i; bl = j - i; }
      i = j;
    }
    const hx = w.map(x => x.toString(16));
    if (bl < 2) return hx.join(':');
    return hx.slice(0, best).join(':') + '::' + hx.slice(best + bl).join(':');
  }
  const hex2 = b => b.toString(16).padStart(2, '0');

  /* ===================================================================
     widget subnet-stepper: IP/prefix -> binary, mask, block size, network, broadcast, hosts, one step at a time
     =================================================================== */
  function subnetStepper(root) {
    frame(root, 'คำนวณ Subnet ทีละขั้นด้วยวิธี Block size',
      'พิมพ์ IP/prefix หรือกดโจทย์ตัวอย่าง แล้วกด "ขั้นถัดไป" ทีละขั้น ลองคิดคำตอบของขั้นถัดไปก่อนกด สีน้ำเงินคือบิต Network สีส้มคือบิต Host');
    const inp = h('input', { type: 'text', class: 'nlw-mono', value: '192.168.1.77/26', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'IP Address และ prefix', style: 'width:230px' });
    const exs = ['192.168.1.77/26', '192.168.10.45/27', '172.16.5.200/28', '10.37.200.5/13'];
    const exRow = h('div', { class: 'nlw-row nlw-center', role: 'group', 'aria-label': 'โจทย์ตัวอย่าง' }, h('span', { class: 'nlw-small' }, 'โจทย์ตัวอย่าง:'),
      exs.map(e => h('button', { type: 'button', class: 'nlw-btn nlw-sm nlw-mono', onclick: () => { inp.value = e; step = 0; render(); } }, e)));
    let step = 0;
    const N = 6;
    const status = h('div', { class: 'nlw-small', 'aria-live': 'polite' });
    const bPrev = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { if (step > 0) { step--; render(); } } }, 'ขั้นก่อนหน้า');
    const bNext = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: () => { if (step < N - 1) { step++; render(true); } } }, 'ขั้นถัดไป');
    const bAll = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { step = N - 1; render(true); } }, 'แสดงทุกขั้น');
    const msg = h('div', { class: 'nlw-result', 'aria-live': 'polite' });
    const body = h('div');
    inp.addEventListener('input', () => render());
    root.append(h('div', { class: 'nlw-row' }, field('IP/prefix', inp)), exRow, h('div', { class: 'nlw-row nlw-center' }, bPrev, bNext, bAll, status), msg, body);
    function bitsRow(n, p) {
      return h('div', { class: 'nlwi-bits', 'aria-label': octs(n).map(o => o.toString(2).padStart(8, '0')).join('.') },
        octs(n).map((o, k) => h('span', { class: 'nlwi-oct' }, o.toString(2).padStart(8, '0').split('').map((b, i) => h('i', { class: k * 8 + i < p ? 'nlwi-n' : 'nlwi-h' }, b)))));
    }
    function render(focusNew) {
      const r = parseCidr(inp.value);
      inp.classList.toggle('nlw-invalid', !!r.err);
      body.replaceChildren();
      if (r.err) { result(msg, 'bad', r.err); status.textContent = ''; return; }
      const { ip, p } = r;
      if (p === 31 || p === 32) { result(msg, 'warn', '/' + p + ' เป็นกรณีพิเศษ: /31 ใช้กับลิงก์ point-to-point ได้ทั้ง 2 address (RFC 3021) และ /32 คือ address เดียว (ใช้กับ loopback) สูตร 2^h − 2 ใช้ไม่ได้ ดูภารกิจ s10'); status.textContent = ''; return; }
      if (p < 1) { result(msg, 'bad', '/0 หมายถึงทุก address (default route) ไม่ใช่วงที่ตั้งให้เครื่องได้'); status.textContent = ''; return; }
      const k = Math.floor((p - 1) / 8);             // octet that holds the last network bit (0-based)
      const nbits = p - k * 8;                       // network bits inside that octet (1..8)
      const mo = 256 - Math.pow(2, 8 - nbits);       // mask value of that octet
      const B = 256 - mo;                            // block size
      const v = octs(ip)[k];
      const start = Math.floor(v / B) * B;
      const net = netOf(ip, p), size = blockOf(p), bc = net + size - 1;
      const hb = 32 - p;
      result(msg, 'ok', ipS(ip) + '/' + p + ': ขั้นที่ ' + (step + 1) + ' จาก ' + N);
      status.textContent = '';
      const panes = [];
      const place = [128, 64, 32, 16, 8, 4, 2, 1];
      const parts = place.filter((pv, i) => (v >> (7 - i)) & 1);
      panes.push(['1. แปลง IP เป็นเลขฐานสอง', [
        bitsRow(ip, p),
        h('p', null, 'prefix /' + p + ' แปลว่า ' + p + ' บิตแรกเป็น Network และอีก h = 32 − ' + p + ' = ' + hb + ' บิตเป็น Host'),
        h('p', null, 'ออกเตตที่ ' + (k + 1) + ' (ค่า ' + v + ') คือออกเตตที่มีเส้นแบ่ง: ' + v + ' = ' + (parts.length ? parts.join(' + ') : '0') + ' = ' + v.toString(2).padStart(8, '0'))]]);
      panes.push(['2. Prefix → Subnet mask', [
        bitsRow(Math.pow(2, 32) - size, p),
        h('dl', { class: 'nlwi-kv' }, h('dt', null, 'Mask'), h('dd', null, maskS(p)), h('dt', null, 'ออกเตตที่ ' + (k + 1)), h('dd', null, place.slice(0, nbits).join(' + ') + ' = ' + mo)),
        h('p', null, nbits === 8 ? 'เส้นแบ่งตรงขอบออกเตตพอดี mask ของออกเตตนี้จึงเป็น 255' : 'บิต 1 ใน mask ออกเตตที่ ' + (k + 1) + ' มี ' + nbits + ' บิต จึงได้ ' + mo)]]);
      panes.push(['3. หา Block size (เลขกระโดด)', [
        h('p', { class: 'nlw-big' }, 'Block size = 256 − ' + mo + ' = ' + B),
        h('p', null, 'เท่ากับค่าประจำหลักของบิต Network ตัวสุดท้าย (2^' + (8 - nbits) + ' = ' + B + ') วงย่อยจึงขึ้นต้นทีละ ' + B + ' ในออกเตตที่ ' + (k + 1))]]);
      const count = 256 / B;
      let chips;
      if (count <= 16) chips = Array.from({ length: count }, (_, i) => i * B);
      else chips = [start - B, start, start + B].filter(x => x >= 0 && x < 256);
      panes.push(['4. หาว่า ' + v + ' อยู่บล็อกไหน', [
        h('div', { class: 'nlwi-chips', 'aria-label': 'บล็อกในออกเตตที่ ' + (k + 1) }, count > 16 ? h('span', null, '...') : null,
          chips.map(c => h('span', { class: c === start ? 'nlwi-on' : null }, c + '–' + (c + B - 1))), count > 16 ? h('span', null, '...') : null),
        h('p', null, v + ' ÷ ' + B + ' ได้ ' + Math.floor(v / B) + ' เศษ ' + (v % B) + ' → บล็อกเริ่มที่ ' + Math.floor(v / B) + ' × ' + B + ' = ' + start + ' และจบที่ ' + start + ' + ' + B + ' − 1 = ' + (start + B - 1))]]);
      const right = k < 3 ? ' ออกเตตทางขวาของออกเตตที่ ' + (k + 1) + ' เป็น 0 (Network) และ 255 (Broadcast)' : '';
      panes.push(['5. Network และ Broadcast', [
        h('dl', { class: 'nlwi-kv' }, h('dt', null, 'Network'), h('dd', null, ipS(net)), h('dt', null, 'Broadcast'), h('dd', null, ipS(bc))),
        bitsRow(net, p), bitsRow(bc, p),
        h('p', null, 'Network = บิต Host เป็น 0 ทั้งหมด (ค่าเดียวกับ IP AND Mask), Broadcast = บิต Host เป็น 1 ทั้งหมด' + right)]]);
      panes.push(['6. Host แรก, Host สุดท้าย และจำนวน Host', [
        h('dl', { class: 'nlwi-kv' }, h('dt', null, 'Host แรก'), h('dd', null, ipS(net + 1) + ' (Network + 1)'), h('dt', null, 'Host สุดท้าย'), h('dd', null, ipS(bc - 1) + ' (Broadcast − 1)'),
          h('dt', null, 'จำนวน Host'), h('dd', null, '2^' + hb + ' − 2 = ' + fmt(size - 2))),
        h('p', null, 'ลบ 2 เพราะ Network และ Broadcast ตั้งให้เครื่องไม่ได้ ' + (ip === net ? 'IP ที่พิมพ์คือ Network address จึงตั้งให้เครื่องไม่ได้' : ip === bc ? 'IP ที่พิมพ์คือ Broadcast จึงตั้งให้เครื่องไม่ได้' : ipS(ip) + ' เป็น Host ที่ใช้ได้ในวงนี้'))]]);
      panes.slice(0, step + 1).forEach((pn, i) => body.append(h('section', { class: 'nlwi-pane' + (i === step ? ' nlwi-now' : ''), tabindex: i === step ? '-1' : null }, h('h4', null, pn[0]), pn[1])));
      bPrev.disabled = step === 0; bNext.disabled = step === N - 1;
      status.textContent = 'แสดง ' + (step + 1) + '/' + N + ' ขั้น';
      if (focusNew) { const cur = body.querySelector('.nlwi-now'); if (cur) cur.focus({ preventScroll: false }); }
    }
    render();
  }

  /* ===================================================================
     widget eui64-builder: MAC -> modified EUI-64 -> link-local, SLAAC global, solicited-node; or random IID
     =================================================================== */
  function eui64Builder(root) {
    frame(root, 'สร้าง Interface ID: EUI-64 หรือสุ่ม',
      'พิมพ์ MAC address และ prefix /64 ที่ได้จาก RA แล้วดูการสร้าง Interface ID ทีละขั้น จากนั้นสลับเป็น "สุ่ม (privacy)" เพื่อเทียบกับแบบที่ Windows ใช้');
    const mac = h('input', { type: 'text', class: 'nlw-mono', value: '00:1a:2b:3c:4d:5e', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'MAC address', style: 'width:200px' });
    const pre = h('input', { type: 'text', class: 'nlw-mono', value: '2001:db8:10::/64', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'prefix จาก Router Advertisement', style: 'width:220px' });
    let mode = 'eui', rnd = null;
    const bNew = h('button', { type: 'button', class: 'nlw-btn', hidden: true, onclick: () => { rnd = randomIID(); calc(); } }, 'สุ่มใหม่');
    const modeSeg = seg([['eui', 'EUI-64 (จาก MAC)'], ['rand', 'สุ่ม (privacy)']], mode, v => { mode = v; bNew.hidden = v !== 'rand'; if (v === 'rand' && !rnd) rnd = randomIID(); calc(); }, 'วิธีสร้าง Interface ID');
    const msg = h('div', { class: 'nlw-result', 'aria-live': 'polite' });
    const out = h('ol', { class: 'nlwi-path' });
    const sum = h('dl', { class: 'nlwi-kv' });
    mac.addEventListener('input', calc); pre.addEventListener('input', calc);
    root.append(h('div', { class: 'nlw-row' }, field('MAC address', mac), field('Prefix (/64)', pre)), h('div', { class: 'nlw-row nlw-center' }, modeSeg.el, bNew), msg, out, sum);
    function randomIID() {
      const b = new Uint8Array(8);
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b); else for (let i = 0; i < 8; i++) b[i] = Math.floor(Math.random() * 256);
      return Array.from(b);
    }
    function calc() {
      out.replaceChildren(); sum.replaceChildren();
      const pm = /^\s*([0-9a-fA-F:]+)\s*\/\s*(\d{1,3})\s*$/.exec(pre.value);
      const pw = pm ? v6expand(pm[1]) : null;
      pre.classList.toggle('nlw-invalid', !pw);
      if (!pw) return result(msg, 'bad', 'prefix ต้องเขียนเป็น IPv6/ความยาว เช่น 2001:db8:10::/64');
      if (Number(pm[2]) !== 64) return result(msg, 'bad', 'SLAAC ใช้ได้กับ prefix /64 เท่านั้น เพราะ Interface ID ยาว 64 บิตพอดี (ได้ /' + pm[2] + ')');
      let iid;
      if (mode === 'eui') {
        const raw = mac.value.trim().replace(/[:\-.\s]/g, '');
        const ok = /^[0-9a-fA-F]{12}$/.test(raw);
        mac.classList.toggle('nlw-invalid', !ok);
        if (!ok) return result(msg, 'bad', 'MAC address ต้องมีเลขฐาน 16 จำนวน 12 หลัก เช่น 00:1a:2b:3c:4d:5e หรือ 00-1A-2B-3C-4D-5E');
        const m = raw.toLowerCase().match(/../g).map(x => parseInt(x, 16));
        const f0 = m[0] ^ 0x02;
        iid = [f0, m[1], m[2], 0xff, 0xfe, m[3], m[4], m[5]];
        const li = (t, c) => h('li', { class: 'nlwi-i' }, t, c ? h('div', { class: 'nlw-mono' }, c) : null);
        out.append(
          li('1. แบ่ง MAC 48 บิตเป็นสองครึ่ง ครึ่งละ 3 ไบต์', m.slice(0, 3).map(hex2).join(':') + '  |  ' + m.slice(3).map(hex2).join(':')),
          li('2. แทรก ff:fe ตรงกลาง ได้ 64 บิต', m.slice(0, 3).map(hex2).join(':') + ':ff:fe:' + m.slice(3).map(hex2).join(':')),
          li('3. กลับบิต U/L (บิตที่ 7 จากซ้าย ค่า 0x02) ของไบต์แรก', hex2(m[0]) + ' = ' + m[0].toString(2).padStart(8, '0') + '  →  ' + f0.toString(2).padStart(8, '0') + ' = ' + hex2(f0) + (m[0] & 2 ? '  (บิตเดิมเป็น 1 จึงกลายเป็น 0)' : '  (บิตเดิมเป็น 0 จึงกลายเป็น 1)')),
          li('4. Interface ID 64 บิต (เขียนเป็น 4 กลุ่ม)', [0, 2, 4, 6].map(i => hex2(iid[i]) + hex2(iid[i + 1])).join(':')));
      } else {
        mac.classList.remove('nlw-invalid');
        iid = rnd;
        out.append(h('li', { class: 'nlwi-i' }, '1. สุ่ม Interface ID 64 บิตด้วยตัวสร้างเลขสุ่มของเครื่อง ไม่เกี่ยวกับ MAC', h('div', { class: 'nlw-mono' }, [0, 2, 4, 6].map(i => hex2(iid[i]) + hex2(iid[i + 1])).join(':'))),
          h('li', { class: 'nlwi-i' }, '2. ไม่มี ff:fe ตรงกลาง คนภายนอกจึงเดา MAC และติดตามเครื่องข้ามเครือข่ายไม่ได้ (Windows 10/11 ใช้แบบสุ่มเป็นค่าเริ่มต้น และสร้าง Temporary address เพิ่ม)'));
      }
      const ig = [0, 2, 4, 6].map(i => iid[i] * 256 + iid[i + 1]);
      const ll = v6compress([0xfe80, 0, 0, 0].concat(ig));
      const gl = v6compress(pw.slice(0, 4).concat(ig));
      const sn = v6compress([0xff02, 0, 0, 0, 0, 1, 0xff00 + iid[5], iid[6] * 256 + iid[7]]);
      const hostBits = pw.slice(4).some(x => x !== 0);
      sum.append(h('dt', null, 'Link-local'), h('dd', null, ll),
        h('dt', null, 'Global (SLAAC)'), h('dd', null, gl + '/64'),
        h('dt', null, 'DAD ถามที่'), h('dd', null, sn + ' (solicited-node multicast จาก 24 บิตท้าย)'));
      result(msg, hostBits ? 'warn' : 'ok', (hostBits ? 'prefix ที่พิมพ์มีบิตท้ายไม่เป็น 0 ระบบใช้เฉพาะ 64 บิตแรก ' : '') + 'ผลลัพธ์เขียนตามกฎ RFC 5952: ' + gl);
    }
    calc();
  }

  /* ===================================================================
     widget vlsm-allocator: host needs -> largest-first aligned blocks, addressing table, gaps
     =================================================================== */
  function vlsmAllocator(root) {
    frame(root, 'จัดสรร address แบบ VLSM',
      'กำหนดวงตั้งต้น แล้วกรอกชื่อและจำนวนเครื่องที่ต้องการของแต่ละวง (ลิงก์ระหว่างเราเตอร์ใส่ 2) ระบบเลือก prefix ที่เล็กที่สุดที่พอ วางบล็อกบนขอบที่ถูกต้อง และทำตารางกำหนด address ให้ ลองสลับเป็น "ตามลำดับที่กรอก" เพื่อดูช่องว่างที่เกิดขึ้น');
    const base = h('input', { type: 'text', class: 'nlw-mono', value: '192.168.10.0/24', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'วงตั้งต้น', style: 'width:200px' });
    let rows = [['LAN-A ห้องแล็บ', 60], ['LAN-B ห้องพักครู', 28], ['LAN-C ธุรการ', 12], ['WAN R1–R2', 2]];
    let sorted = true;
    const list = h('div');
    const orderSeg = seg([['sort', 'เรียงมาก → น้อย (VLSM)'], ['raw', 'ตามลำดับที่กรอก']], 'sort', v => { sorted = v === 'sort'; calc(); }, 'ลำดับการจัดสรร');
    const msg = h('div', { class: 'nlw-result', 'aria-live': 'polite' });
    const out = h('div');
    base.addEventListener('input', calc);
    root.append(h('div', { class: 'nlw-row' }, field('วงตั้งต้น', base)), h('div', { class: 'nlw-small' }, 'ความต้องการของแต่ละวง'), list,
      h('div', { class: 'nlw-row' }, h('button', { type: 'button', class: 'nlw-btn', onclick: () => { rows.push(['วงใหม่', 10]); renderRows(); calc(); const ins = list.querySelectorAll('input[type=text]'); ins[ins.length - 1].focus(); } }, 'เพิ่มวง'),
        h('button', { type: 'button', class: 'nlw-btn', onclick: () => { rows = [['LAN-A ห้องแล็บ', 60], ['LAN-B ห้องพักครู', 28], ['LAN-C ธุรการ', 12], ['WAN R1–R2', 2]]; base.value = '192.168.10.0/24'; renderRows(); calc(); } }, 'คืนค่าตัวอย่าง')),
      orderSeg.el, msg, out);
    function renderRows() {
      list.replaceChildren();
      rows.forEach((r, i) => {
        list.append(h('div', { class: 'nlwi-rowin' },
          h('input', { type: 'text', value: r[0], 'aria-label': 'ชื่อวงที่ ' + (i + 1), autocomplete: 'off', oninput: e => { r[0] = e.target.value; calc(); } }),
          h('input', { type: 'number', min: '1', step: '1', value: String(r[1]), 'aria-label': 'จำนวนเครื่องของวงที่ ' + (i + 1), inputmode: 'numeric', oninput: e => { r[1] = e.target.value; calc(); } }),
          h('button', { type: 'button', class: 'nlw-btn nlw-sm', 'aria-label': 'ลบวงที่ ' + (i + 1), onclick: () => { rows.splice(i, 1); renderRows(); calc(); } }, 'ลบ')));
      });
    }
    function calc() {
      out.replaceChildren();
      const r = parseCidr(base.value);
      base.classList.toggle('nlw-invalid', !!r.err);
      if (r.err) return result(msg, 'bad', 'วงตั้งต้นไม่ถูกต้อง: ' + r.err);
      if (r.p < 8 || r.p > 30) return result(msg, 'bad', 'ใช้ prefix ระหว่าง /8 ถึง /30');
      const start = netOf(r.ip, r.p), total = blockOf(r.p), end = start + total;
      const needs = [];
      for (let i = 0; i < rows.length; i++) {
        const n = Number(rows[i][1]);
        if (!Number.isInteger(n) || n < 1) return result(msg, 'bad', 'วงที่ ' + (i + 1) + ' (' + rows[i][0] + '): จำนวนเครื่องต้องเป็นจำนวนเต็มตั้งแต่ 1');
        needs.push({ i, name: rows[i][0] || ('วงที่ ' + (i + 1)), need: n });
      }
      if (!needs.length) return result(msg, 'warn', 'ยังไม่มีวงที่ต้องการ กด "เพิ่มวง"');
      const order = needs.slice();
      if (sorted) order.sort((a, b) => b.need - a.need || a.i - b.i);
      let next = start, gaps = 0, fail = null;
      const al = [];
      for (const n of order) {
        let hb = 2; while (Math.pow(2, hb) - 2 < n.need) hb++;
        const size = Math.pow(2, hb);
        const at = start + Math.ceil((next - start) / size) * size;
        if (at + size > end) { fail = n; break; }
        if (at > next) { al.push({ gap: true, net: next, size: at - next }); gaps += at - next; }
        al.push(Object.assign({}, n, { hb, size, prefix: 32 - hb, net: at }));
        next = at + size;
      }
      const used = al.filter(a => !a.gap).reduce((s, a) => s + a.size, 0);
      if (fail) result(msg, 'bad', 'พื้นที่ไม่พอ: วง "' + fail.name + '" ต้องการ ' + fail.need + ' เครื่อง แต่ ' + ipS(start) + '/' + r.p + ' เหลือไม่พอสำหรับบล็อกขนาดนั้น ลองใช้วงตั้งต้นที่ใหญ่ขึ้น');
      else result(msg, gaps ? 'warn' : 'ok', 'ใช้ไป ' + fmt(used) + ' จาก ' + fmt(total) + ' address' + (gaps ? ' มีช่องว่างระหว่างบล็อก ' + fmt(gaps) + ' address เพราะไม่ได้เรียงจากมากไปน้อย' : ' ไม่มีช่องว่างระหว่างบล็อก') + ' เหลือต่อท้าย ' + fmt(end - next) + ' address');
      if (r.ip !== start) out.append(h('p', { class: 'nlw-small nlw-warn' }, ipS(r.ip) + ' ไม่ใช่ Network address ระบบใช้ ' + ipS(start) + '/' + r.p + ' เป็นวงตั้งต้น'));
      // bar
      const bar = h('div', { class: 'nlwi-bar', role: 'img', 'aria-label': 'แถบ address ของ ' + ipS(start) + '/' + r.p });
      let ci = 0;
      al.forEach(a => {
        const pct = a.size / total * 100;
        if (a.gap) bar.append(h('span', { class: 'nlwi-gap', style: 'flex:0 0 ' + pct + '%', title: 'ช่องว่าง ' + ipS(a.net) + ' (' + a.size + ')' }, pct > 8 ? 'ว่าง ' + a.size : ''));
        else bar.append(h('span', { class: 'nlwi-c' + (ci++ % 4), style: 'flex:0 0 ' + pct + '%', title: a.name + ' ' + ipS(a.net) + '/' + a.prefix }, pct > 8 ? '/' + a.prefix : ''));
      });
      if (end > next) bar.append(h('span', { class: 'nlwi-free', style: 'flex:1 1 0' }, (end - next) / total > 0.1 ? 'เหลือ ' + fmt(end - next) : ''));
      out.append(bar, h('div', { class: 'nlwi-legend' }, h('span', null, h('i', { class: 'nlwi-gap' }), 'ช่องว่างจากการวางไม่เรียง'), h('span', null, h('i', { class: 'nlwi-free' }), 'เหลือใช้ภายหลัง')));
      const tb = h('tbody');
      al.forEach(a => {
        if (a.gap) { tb.append(h('tr', { class: 'nlwi-bad' }, h('td', { colspan: '8' }, 'ช่องว่าง ' + ipS(a.net) + ' – ' + ipS(a.net + a.size - 1) + ' (' + a.size + ' address) วงถัดไปต้องเริ่มที่ขอบบล็อกของตัวเอง'))); return; }
        tb.append(h('tr', null, h('td', null, a.name), h('td', null, String(a.need)), h('td', { class: 'nlw-mono' }, '/' + a.prefix + ' (' + fmt(a.size - 2) + ')'),
          h('td', { class: 'nlw-mono' }, maskS(a.prefix)), h('td', { class: 'nlw-mono' }, ipS(a.net)), h('td', { class: 'nlw-mono' }, ipS(a.net + 1) + ' – ' + ipS(a.net + a.size - 2)),
          h('td', { class: 'nlw-mono' }, ipS(a.net + a.size - 1)), h('td', null, fmt(a.size - 2 - a.need))));
      });
      out.append(h('div', { class: 'nlw-scroll', tabindex: '0', 'aria-label': 'ตารางกำหนด address (เลื่อนซ้ายขวาได้)' }, h('table', { class: 'nlw-table' },
        h('thead', null, h('tr', null, ['วง', 'ต้องการ', 'Prefix (ใช้ได้)', 'Mask', 'Network', 'Host แรก – สุดท้าย', 'Broadcast', 'เผื่อ'].map(t => h('th', { scope: 'col' }, t)))), tb)));
      const first = al.find(a => !a.gap);
      if (first) out.append(h('p', { class: 'nlw-small' }, 'วิธีคิด: ' + first.name + ' ต้องการ ' + first.need + ' เครื่อง → h = ' + first.hb + ' บิต เพราะ 2^' + first.hb + ' − 2 = ' + (first.size - 2) + ' ≥ ' + first.need + (first.hb > 2 ? ' แต่ 2^' + (first.hb - 1) + ' − 2 = ' + (first.size / 2 - 2) + ' ไม่พอ' : '') + ' → /' + first.prefix + ' ขนาดบล็อก ' + first.size));
    }
    renderRows(); calc();
  }

  /* ===================================================================
     widget static-route-trace: 3 routers, tick static routes, trace request AND reply hop by hop (LPM)
     =================================================================== */
  function staticRouteTrace(root) {
    frame(root, 'ทดลอง Static route บน 3 เราเตอร์',
      'ติ๊กเส้นทางที่ต้องการใส่ในแต่ละเราเตอร์ แล้วเลือกต้นทางและปลายทาง ระบบจะส่ง ping ทีละ hop ทั้งขาไปและขากลับ โดยแต่ละเราเตอร์เลือกเส้นทางที่ prefix ยาวที่สุด (Longest Prefix Match) ตารางด้านล่างสรุปผล ping ทุกคู่');
    const A = s => parseIPv4(s);
    const DEV = {
      R1: { name: 'R1', ifs: [['G0/0', '192.168.10.1', 26], ['G0/1', '192.168.10.113', 30], ['G0/2', '203.0.113.2', 30]] },
      R2: { name: 'R2', ifs: [['G0/0', '192.168.10.65', 27], ['G0/1', '192.168.10.114', 30], ['G0/2', '192.168.10.117', 30]] },
      R3: { name: 'R3', ifs: [['G0/0', '192.168.10.97', 28], ['G0/1', '192.168.10.118', 30]] },
      ISP: { name: 'ISP', ifs: [['G0/0', '203.0.113.1', 30], ['G0/1', '8.8.8.1', 24]], fixed: [['192.168.10.0', 24, '203.0.113.2']] }
    };
    const HOSTS = { 'PC-A': ['192.168.10.10', 26, '192.168.10.1'], 'PC-B': ['192.168.10.70', 27, '192.168.10.65'], 'PC-C': ['192.168.10.100', 28, '192.168.10.97'], 'Web 8.8.8.8': ['8.8.8.8', 24, '8.8.8.1'] };
    const CAND = [
      { id: 'r1a', r: 'R1', dst: '192.168.10.64', p: 27, via: '192.168.10.114', on: true, note: 'ไป LAN-B' },
      { id: 'r1b', r: 'R1', dst: '192.168.10.96', p: 28, via: '192.168.10.114', on: false, note: 'ไป LAN-C' },
      { id: 'r1c', r: 'R1', dst: '192.168.10.116', p: 30, via: '192.168.10.114', on: false, note: 'ไปลิงก์ R2–R3' },
      { id: 'r1d', r: 'R1', dst: '0.0.0.0', p: 0, via: '203.0.113.1', on: true, note: 'Default ไป ISP' },
      { id: 'r2a', r: 'R2', dst: '192.168.10.0', p: 26, via: '192.168.10.113', on: true, note: 'ไป LAN-A' },
      { id: 'r2b', r: 'R2', dst: '192.168.10.96', p: 28, via: '192.168.10.118', on: false, note: 'ไป LAN-C' },
      { id: 'r2x', r: 'R2', dst: '192.168.10.96', p: 28, via: '192.168.10.113', on: false, note: 'ไป LAN-C (ส่งผิดทาง)' },
      { id: 'r2c', r: 'R2', dst: '0.0.0.0', p: 0, via: '192.168.10.113', on: false, note: 'Default ให้ R1' },
      { id: 'r3a', r: 'R3', dst: '0.0.0.0', p: 0, via: '192.168.10.117', on: false, note: 'Default ให้ R2' }
    ];
    CAND.forEach(c => { c.net = A(c.dst); c.hop = A(c.via); });
    const ifOwner = ip => { for (const d in DEV) for (const f of DEV[d].ifs) if (A(f[1]) === ip) return [d, f]; return null; };
    const hostAt = ip => Object.keys(HOSTS).find(k => A(HOSTS[k][0]) === ip) || null;
    const cmd = c => (c.p === 0 ? 'ip route 0.0.0.0 0.0.0.0 ' : 'ip route ' + c.dst + ' ' + maskS(c.p) + ' ') + c.via;
    const sets = {};
    ['R1', 'R2', 'R3'].forEach(r => {
      const fs = h('fieldset', null, h('legend', null, r));
      fs.append(h('div', { class: 'nlw-small' }, 'ต่อตรง (C): ' + DEV[r].ifs.map(f => ipS(netOf(A(f[1]), f[2])) + '/' + f[2] + ' ' + f[0]).join(', ')));
      CAND.filter(c => c.r === r).forEach(c => {
        const cb = checkbox(cmd(c), c.on, e => { c.on = e.target.checked; run(); }, { class: 'nlw-mono', style: 'font-size:13px;overflow-wrap:anywhere;flex:1 1 auto;min-width:0' });
        cb.el.lastChild.append(h('span', { class: 'nlw-small', style: 'display:block;font-family:inherit' }, c.note));
        fs.append(cb.el);
      });
      sets[r] = fs;
    });
    const names = Object.keys(HOSTS);
    let src = 'PC-A', dst = 'PC-C';
    const sSel = selectEl(names.map(n => [n, n + ' (' + HOSTS[n][0] + ')']), src, e => { src = e.target.value; run(); }, 'ต้นทาง');
    const dSel = selectEl(names.map(n => [n, n + ' (' + HOSTS[n][0] + ')']), dst, e => { dst = e.target.value; run(); }, 'ปลายทาง');
    const msg = h('div', { class: 'nlw-result', 'aria-live': 'polite' });
    const go = h('ol', { class: 'nlwi-path', 'aria-label': 'ขาไป' }), back = h('ol', { class: 'nlwi-path', 'aria-label': 'ขากลับ' });
    const mx = h('div');
    root.append(h('div', { class: 'nlwi-grid' }, sets.R1, h('div', null, sets.R2, sets.R3)),
      h('p', { class: 'nlw-small' }, 'สมมติว่า ISP มีเส้นทางกลับ 192.168.10.0/24 มาที่ R1 (งานจริง R1 จะทำ NAT แทน ดูภารกิจ t10)'),
      h('div', { class: 'nlw-row' }, field('ต้นทาง', sSel), field('ปลายทาง', dSel)), msg,
      h('div', { class: 'nlwi-grid' }, h('div', null, h('b', null, 'ขาไป (Echo Request)'), go), h('div', null, h('b', null, 'ขากลับ (Echo Reply)'), back)),
      h('b', null, 'ผล ping ทุกคู่ (แถว = ต้นทาง, คอลัมน์ = ปลายทาง)'), mx);
    // one direction; returns {ok, steps[], code, reporter}
    function trace(fromHost, dIP) {
      const steps = [];
      const H = HOSTS[fromHost], hip = A(H[0]);
      if (inNet(dIP, netOf(hip, H[1]), H[1])) {
        const t = hostAt(dIP);
        steps.push([t ? 'y' : 'x', fromHost + ': ปลายทางอยู่วงเดียวกัน ส่งตรง' + (t ? ' ถึง ' + t : ' แต่ไม่มีเครื่องนี้')]);
        return { ok: !!t, steps, code: t ? 'ok' : 'host' };
      }
      steps.push(['i', fromHost + ': ปลายทางอยู่นอกวง ส่งให้ Default gateway ' + H[2]]);
      let at = ifOwner(A(H[2]));
      if (!at) return { ok: false, steps, code: 'gw' };
      let inIf = at[1];
      for (let ttl = 0; ttl < 10; ttl++) {
        const d = DEV[at[0]];
        if (d.ifs.some(f => A(f[1]) === dIP)) { steps.push(['y', d.name + ': ' + ipS(dIP) + ' คือ address ของเราเตอร์เอง']); return { ok: true, steps, code: 'ok' }; }
        const con = d.ifs.find(f => inNet(dIP, netOf(A(f[1]), f[2]), f[2]));
        if (con) {
          const t = hostAt(dIP), r = ifOwner(dIP);
          if (t) { steps.push(['y', d.name + ': ' + ipS(dIP) + ' อยู่ในวงที่ต่อตรง (C) ทาง ' + con[0] + ' ส่งถึง ' + t]); return { ok: true, steps, code: 'ok' }; }
          if (r) { steps.push(['y', d.name + ': ส่งถึงเราเตอร์ ' + r[0] + ' ในวงที่ต่อตรง']); return { ok: true, steps, code: 'ok' }; }
          steps.push(['x', d.name + ': วงต่อตรงแต่ไม่มีเครื่อง ' + ipS(dIP)]); return { ok: false, steps, code: 'host', reporter: [at[0], inIf] };
        }
        const routes = (d.fixed || []).map(f => ({ net: A(f[0]), p: f[1], hop: A(f[2]), lbl: f[0] + '/' + f[1] + ' via ' + f[2] }))
          .concat(CAND.filter(c => c.r === at[0] && c.on).map(c => ({ net: c.net, p: c.p, hop: c.hop, lbl: (c.p ? c.dst : '0.0.0.0') + '/' + c.p + ' via ' + c.via })));
        const m = routes.filter(rt => inNet(dIP, rt.net, rt.p)).sort((a, b) => b.p - a.p);
        if (!m.length) { steps.push(['x', d.name + ': ไม่มีเส้นทางไป ' + ipS(dIP) + ' และไม่มี default route → ทิ้งแพ็กเก็ต ตอบ Destination net unreachable']); return { ok: false, steps, code: 'net', reporter: [at[0], inIf] }; }
        const best = m[0];
        const outIf = d.ifs.find(f => inNet(best.hop, netOf(A(f[1]), f[2]), f[2]));
        steps.push(['i', d.name + ': ' + (m.length > 1 ? 'ตรง ' + m.length + ' เส้นทาง เลือก /' + best.p + ' (ยาวที่สุด) ' : 'ใช้ ') + best.lbl + (outIf ? ' ออกทาง ' + outIf[0] : '')]);
        const nx = ifOwner(best.hop);
        if (!outIf || !nx) { steps.push(['x', d.name + ': next hop ' + ipS(best.hop) + ' ไม่อยู่ในวงที่ต่อตรง ส่งต่อไม่ได้']); return { ok: false, steps, code: 'net', reporter: [at[0], inIf] }; }
        at = nx; inIf = nx[1];
      }
      steps.push(['x', 'วนไปมาจน TTL หมด (routing loop) เราเตอร์ทิ้งแพ็กเก็ตและตอบ Time exceeded']);
      return { ok: false, steps, code: 'loop', reporter: [at[0], inIf] };
    }
    function hostOf(ipStrv) { return Object.keys(HOSTS).find(k => HOSTS[k][0] === ipStrv); }
    function ping(s, d) {
      const dIP = A(HOSTS[d][0]);
      const t1 = trace(s, dIP);
      if (!t1.ok) {
        // ICMP error goes back from the reporting router to the source, if that router can reach it
        let shown = 'Request timed out.';
        if (t1.reporter) {
          const rIP = A(t1.reporter[1][1]);
          const t3 = traceFromRouter(t1.reporter[0], A(HOSTS[s][0]));
          if (t3) shown = 'Reply from ' + ipS(rIP) + ': ' + (t1.code === 'loop' ? 'TTL expired in transit.' : t1.code === 'host' ? 'Destination host unreachable.' : 'Destination net unreachable.');
        }
        return { ok: false, go: t1, back: null, line: shown };
      }
      const t2 = trace(hostOf(HOSTS[d][0]), A(HOSTS[s][0]));
      return { ok: t2.ok, go: t1, back: t2, line: t2.ok ? 'Reply from ' + HOSTS[d][0] + ': bytes=32' : 'Request timed out.' };
    }
    // can router r reach ip? (for ICMP errors)
    function traceFromRouter(r, ip) {
      let at = r;
      for (let i = 0; i < 10; i++) {
        const d = DEV[at];
        if (d.ifs.some(f => inNet(ip, netOf(A(f[1]), f[2]), f[2]))) return true;
        const routes = (d.fixed || []).map(f => ({ net: A(f[0]), p: f[1], hop: A(f[2]) })).concat(CAND.filter(c => c.r === at && c.on));
        const m = routes.filter(rt => inNet(ip, rt.net, rt.p)).sort((a, b) => b.p - a.p);
        if (!m.length) return false;
        const nx = ifOwner(m[0].hop);
        if (!nx) return false;
        at = nx[0];
      }
      return false;
    }
    function run() {
      go.replaceChildren(); back.replaceChildren();
      if (src === dst) { result(msg, 'warn', 'เลือกต้นทางและปลายทางคนละเครื่อง'); }
      else {
        const r = ping(src, dst);
        r.go.steps.forEach(s => go.append(h('li', { class: 'nlwi-' + s[0] }, s[1])));
        if (r.back) r.back.steps.forEach(s => back.append(h('li', { class: 'nlwi-' + s[0] }, s[1])));
        else back.append(h('li', null, 'ไม่มีขากลับ เพราะขาไปไม่ถึงปลายทาง'));
        let why = '';
        if (r.go.ok && !r.ok) why = ' ขาไปถึงแล้วแต่ขากลับไม่มีเส้นทาง: ต้องเพิ่ม route ขากลับ';
        result(msg, r.ok ? 'ok' : 'bad', 'ping ' + HOSTS[dst][0] + ' จาก ' + src + ': ' + r.line + why);
      }
      const tb = h('tbody');
      names.forEach(a => tb.append(h('tr', null, h('th', { scope: 'row' }, a), names.map(b => {
        if (a === b) return h('td', null, '–');
        const ok = ping(a, b).ok;
        return h('td', { class: ok ? 'nlwi-okc' : 'nlwi-badc' }, ok ? 'ได้' : 'ไม่ได้');
      }))));
      mx.replaceChildren(h('div', { class: 'nlw-scroll', tabindex: '0', 'aria-label': 'ตารางผล ping ทุกคู่' }, h('table', { class: 'nlw-table nlwi-mx' }, h('thead', null, h('tr', null, h('th', null, ''), names.map(n => h('th', { scope: 'col' }, n)))), tb)));
    }
    run();
  }

  /* ===================================================================
     widget sg-nacl-tester: stateless NACL (numbered, both directions) vs stateful security group
     =================================================================== */
  function sgNaclTester(root) {
    frame(root, 'Security Group กับ Network ACL: แพ็กเก็ตผ่านหรือไม่',
      'เว็บเซิร์ฟเวอร์ 10.0.1.10 อยู่ใน Public subnet ติ๊กเปิดหรือปิดกฎ แล้วเลือกผู้ใช้และพอร์ต ระบบตรวจคำขอขาเข้าและคำตอบขาออกทีละด่าน สังเกตว่า Network ACL ต้องอนุญาตขาออกของคำตอบเอง แต่ Security Group จำการเชื่อมต่อไว้ให้');
    const A = parseIPv4;
    const cidr = s => { const [ip, p] = s.split('/'); return { net: A(ip), p: Number(p) }; };
    const hit = (ip, c) => { const x = cidr(c); return inNet(ip, netOf(x.net, x.p), x.p); };
    const naclIn = [
      { n: 90, act: 'deny', proto: 'ทั้งหมด', lo: 0, hi: 65535, src: '198.51.100.0/24', on: false },
      { n: 100, act: 'allow', proto: 'TCP', lo: 443, hi: 443, src: '0.0.0.0/0', on: true },
      { n: 110, act: 'allow', proto: 'TCP', lo: 22, hi: 22, src: '0.0.0.0/0', on: true }];
    const naclOut = [{ n: 100, act: 'allow', proto: 'TCP', lo: 1024, hi: 65535, src: '0.0.0.0/0', on: false }];
    const sgIn = [{ proto: 'TCP', lo: 443, hi: 443, src: '0.0.0.0/0', on: true }, { proto: 'TCP', lo: 22, hi: 22, src: '203.0.113.10/32', on: true }];
    const ruleTxt = r => (r.n != null ? r.n + ' ' + (r.act === 'allow' ? 'ALLOW' : 'DENY') + ' ' : 'ALLOW ') + r.proto + ' ' + (r.lo === 0 && r.hi === 65535 ? 'ทุกพอร์ต' : r.lo === r.hi ? 'พอร์ต ' + r.lo : 'พอร์ต ' + r.lo + '–' + r.hi) + (r.n != null && naclOut.includes(r) ? ' ปลายทาง ' : ' จาก ') + r.src;
    const box = (title, arr, tail) => {
      const fs = h('fieldset', null, h('legend', null, title));
      arr.forEach(r => fs.append(checkbox(ruleTxt(r), r.on, e => { r.on = e.target.checked; run(); }, { class: 'nlw-mono', style: 'font-size:13px' }).el));
      fs.append(h('div', { class: 'nlw-small nlw-mono' }, tail));
      return fs;
    };
    const clients = [['203.0.113.10', 'เครื่องผู้ดูแลระบบ 203.0.113.10'], ['198.51.100.7', 'ผู้ใช้ 198.51.100.7'], ['192.0.2.50', 'ผู้ใช้ 192.0.2.50']];
    const ports = [['443', 'HTTPS 443'], ['22', 'SSH 22'], ['80', 'HTTP 80']];
    let cli = '198.51.100.7', port = 443;
    const EPH = 50432;
    const msg = h('div', { class: 'nlw-result', 'aria-live': 'polite' });
    const steps = h('ol', { class: 'nlwi-path' });
    root.append(h('div', { class: 'nlwi-grid' },
      box('Network ACL ขาเข้า (stateless, เรียงตามเลข)', naclIn, '*   DENY ทั้งหมด (กฎท้ายสุด)'),
      h('div', null, box('Network ACL ขาออก (stateless)', naclOut, '*   DENY ทั้งหมด (กฎท้ายสุด)'),
        box('Security Group ขาเข้า (stateful, มีแต่ ALLOW)', sgIn, 'ขาออก: อนุญาตทั้งหมด (ค่าเริ่มต้น)'))),
    h('div', { class: 'nlw-row' }, field('ผู้ใช้ (ต้นทาง)', selectEl(clients, cli, e => { cli = e.target.value; run(); }, 'ผู้ใช้')), field('บริการ (พอร์ตปลายทาง)', selectEl(ports, String(port), e => { port = Number(e.target.value); run(); }, 'พอร์ต'))),
    msg, steps);
    function nacl(arr, ip, p) {
      const on = arr.filter(r => r.on).sort((a, b) => a.n - b.n);
      for (const r of on) if (p >= r.lo && p <= r.hi && hit(ip, r.src)) return { ok: r.act === 'allow', why: 'ตรงกฎ ' + r.n + ' (' + (r.act === 'allow' ? 'ALLOW' : 'DENY') + ') เป็นกฎแรกที่ตรง' };
      return { ok: false, why: 'ไม่ตรงกฎที่มีเลขเลย จึงตกกฎ * DENY' };
    }
    function run() {
      steps.replaceChildren();
      const ip = A(cli);
      const li = (ok, t) => steps.append(h('li', { class: ok ? 'nlwi-y' : 'nlwi-x' }, (ok ? 'ผ่าน: ' : 'ไม่ผ่าน: ') + t));
      steps.append(h('li', { class: 'nlwi-i' }, 'คำขอ: ' + cli + ':' + EPH + ' → 10.0.1.10:' + port + ' (พอร์ตต้นทาง ' + EPH + ' เป็น ephemeral port ที่เครื่องผู้ใช้สุ่ม)'));
      const a = nacl(naclIn, ip, port);
      li(a.ok, '1 Network ACL ขาเข้า: ' + a.why);
      if (!a.ok) return result(msg, 'bad', 'ถูกทิ้งที่ขอบ subnet ก่อนถึงเครื่อง (NACL ขาเข้า)');
      const s = sgIn.find(r => r.on && port >= r.lo && port <= r.hi && hit(ip, r.src));
      li(!!s, '2 Security Group ขาเข้า: ' + (s ? 'มีกฎอนุญาต ' + ruleTxt(s) : 'ไม่มีกฎอนุญาตที่ตรง (SG ไม่มีกฎ DENY: ไม่ตรงกฎไหนเท่ากับไม่อนุญาต)'));
      if (!s) return result(msg, 'bad', 'ผ่าน NACL แล้วแต่ถูก Security Group ของเครื่องปฏิเสธ');
      steps.append(h('li', { class: 'nlwi-i' }, '3 เซิร์ฟเวอร์ตอบ: 10.0.1.10:' + port + ' → ' + cli + ':' + EPH));
      li(true, '4 Security Group ขาออก: เป็นคำตอบของการเชื่อมต่อที่อนุญาตแล้ว ผ่านอัตโนมัติ (stateful)');
      const b = nacl(naclOut, ip, EPH);
      li(b.ok, '5 Network ACL ขาออก: ตรวจคำตอบเหมือนแพ็กเก็ตใหม่ (stateless) ปลายทางพอร์ต ' + EPH + ': ' + b.why);
      if (!b.ok) return result(msg, 'bad', 'คำขอไปถึงเซิร์ฟเวอร์แล้ว แต่คำตอบถูกทิ้งที่ NACL ขาออก ผู้ใช้จะเห็นการเชื่อมต่อค้างจนหมดเวลา');
      result(msg, 'ok', 'เชื่อมต่อสำเร็จทั้งไปและกลับ');
    }
    run();
  }

  /* ===================================================================
     widget sdn-flow-lab: reactive OpenFlow switch + controller (table-miss, Packet-In, Flow-Mod, counters, disconnect)
     =================================================================== */
  function sdnFlowLab(root) {
    frame(root, 'Control plane กับ Data plane ในสวิตช์ OpenFlow',
      'ส่งแพ็กเก็ตระหว่างเครื่อง H1, H2, H3 (เว็บเซิร์ฟเวอร์) ผ่านสวิตช์ S1 แพ็กเก็ตแรกที่ไม่มีแถวใน Flow table จะถูกส่งไปถาม Controller ส่วนแพ็กเก็ตถัดไปสวิตช์จัดการเอง ลองเปลี่ยนนโยบายที่ Controller และตัดการเชื่อมต่อ Controller แล้วสังเกตผล');
    const HO = { H1: ['10.0.0.1', 1], H2: ['10.0.0.2', 2], H3: ['10.0.0.3', 3] };
    const pol = { 'H2>H3': true, 'H1>H2': false };
    let flows = [], conn = true, pktIn = 0, flowMod = 0, log = [], pending = [];
    let src = 'H1', dst = 'H3';
    const names = Object.keys(HO).map(n => [n, n + ' (' + HO[n][0] + ')']);
    const sSel = selectEl(names, src, e => { src = e.target.value; }, 'ต้นทาง');
    const dSel = selectEl(names, dst, e => { dst = e.target.value; }, 'ปลายทาง');
    const ctrlBox = h('fieldset', null, h('legend', null, 'นโยบายที่ Controller (Control plane)'));
    Object.keys(pol).forEach(k => ctrlBox.append(checkbox('บล็อก ' + k.replace('>', ' → '), pol[k], e => { pol[k] = e.target.checked; policyChanged(k); }).el));
    ctrlBox.append(h('div', { class: 'nlw-small' }, 'คู่อื่นทั้งหมด: อนุญาต'));
    const connSeg = seg([['on', 'Controller เชื่อมต่ออยู่'], ['off', 'ตัดการเชื่อมต่อ Controller']], 'on', v => { conn = v === 'on'; say(conn ? 'เชื่อมต่อ Controller อีกครั้ง' + (pending.length ? ' และส่ง Flow-Mod ลบแถวของนโยบายที่เปลี่ยนระหว่างขาด ' + pending.join(', ') : '') : 'ขาดการเชื่อมต่อกับ Controller: แถวเดิมยังใช้ได้ แต่แพ็กเก็ตใหม่ที่ไม่มีแถวจะไม่มีใครตัดสิน'); if (conn) { pending.forEach(k => dropPair(k)); pending = []; } draw(); }, 'สถานะ Controller');
    const msg = h('div', { class: 'nlw-result', 'aria-live': 'polite' });
    const ft = h('div'), lg = h('ol', { class: 'nlwi-path', 'aria-label': 'บันทึกข้อความ' }), ctr = h('p', { class: 'nlw-small' });
    root.append(ctrlBox, connSeg.el,
      h('div', { class: 'nlw-row' }, field('ต้นทาง', sSel), field('ปลายทาง', dSel),
        h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: send }, 'ส่งแพ็กเก็ต'),
        h('button', { type: 'button', class: 'nlw-btn', onclick: () => { flows = []; say('แถวทั้งหมดหมดเวลา idle 60 วินาทีและถูกลบ'); draw(); } }, 'จำลองหมดเวลา idle')),
      msg, h('b', null, 'Flow table ของ S1 (Data plane)'), ft, ctr, h('b', null, 'บันทึกข้อความล่าสุด'), lg);
    function say(t) { log.unshift(t); log = log.slice(0, 10); }
    function dropPair(k) { const [a, b] = k.split('>'); const n = flows.length; flows = flows.filter(f => !(f.src === a && f.dst === b)); if (n !== flows.length) { flowMod++; say('Controller → S1: Flow-Mod ลบแถว ' + a + ' → ' + b + ' (นโยบายเปลี่ยน)'); } }
    function policyChanged(k) {
      if (conn) { dropPair(k); say('นโยบาย ' + k.replace('>', ' → ') + ' เปลี่ยนที่ Controller ครั้งเดียว มีผลกับสวิตช์ทุกตัวที่ Controller ดูแล'); }
      else { if (!pending.includes(k)) pending.push(k); say('เปลี่ยนนโยบายแล้ว แต่ส่งถึง S1 ไม่ได้ แถวเดิมของ ' + k.replace('>', ' → ') + ' ยังทำงานจนกว่าจะเชื่อมต่อใหม่'); }
      draw();
    }
    function send() {
      if (src === dst) { result(msg, 'warn', 'เลือกต้นทางและปลายทางคนละเครื่อง'); return; }
      const f = flows.filter(x => x.src === src && x.dst === dst).sort((a, b) => b.prio - a.prio)[0];
      if (f) {
        f.packets++;
        say('S1: ' + src + ' → ' + dst + ' ตรงแถว priority ' + f.prio + ' ทำ ' + f.action + ' เองโดยไม่ถาม Controller');
        result(msg, f.action === 'drop' ? 'bad' : 'ok', f.action === 'drop' ? 'ทิ้งแพ็กเก็ตตามแถวใน Flow table (Data plane ทำงานเอง)' : 'ส่งถึง ' + dst + ' ทันทีจากแถวใน Flow table (Data plane ทำงานเอง)');
      } else if (!conn) {
        say('S1: ' + src + ' → ' + dst + ' table-miss แต่ติดต่อ Controller ไม่ได้ → ทิ้ง');
        result(msg, 'bad', 'ไม่มีแถวที่ตรงและติดต่อ Controller ไม่ได้ แพ็กเก็ตถูกทิ้ง (โหมด fail secure) จึงต้องมี Controller สำรอง');
      } else {
        pktIn++; flowMod++;
        const block = !!pol[src + '>' + dst];
        const nf = { prio: block ? 200 : 100, src, dst, action: block ? 'drop' : 'output:' + HO[dst][1], packets: 1 };
        flows.push(nf);
        say('S1 → Controller: Packet-In (' + src + ' → ' + dst + ' ไม่มีแถวตรง)');
        say('Controller → S1: Flow-Mod เพิ่มแถว priority ' + nf.prio + ' ' + nf.action + (block ? '' : ' และ Packet-Out ส่งแพ็กเก็ตแรกออกไป'));
        result(msg, block ? 'bad' : 'ok', block ? 'Controller ตัดสินตามนโยบายว่าให้บล็อก และติดตั้งแถว drop ไว้ในสวิตช์' : 'Controller อนุญาต ติดตั้งแถวใหม่ แพ็กเก็ตต่อไปไม่ต้องถามอีก');
      }
      draw();
    }
    function draw() {
      const tb = h('tbody');
      flows.slice().sort((a, b) => b.prio - a.prio).forEach(f => tb.append(h('tr', { class: f.action === 'drop' ? 'nlwi-bad' : 'nlwi-hit' },
        h('td', null, String(f.prio)), h('td', { class: 'nlw-mono' }, 'src ' + HO[f.src][0] + ', dst ' + HO[f.dst][0]), h('td', { class: 'nlw-mono' }, f.action), h('td', null, String(f.packets)))));
      tb.append(h('tr', null, h('td', null, '0'), h('td', null, 'ทุกแพ็กเก็ต (table-miss)'), h('td', null, conn ? 'ส่งให้ Controller' : 'ส่งให้ Controller (ขาดการเชื่อมต่อ)'), h('td', null, String(pktIn))));
      ft.replaceChildren(h('div', { class: 'nlw-scroll', tabindex: '0', 'aria-label': 'Flow table' }, h('table', { class: 'nlw-table' },
        h('thead', null, h('tr', null, ['Priority', 'Match', 'Action', 'Counter'].map(t => h('th', { scope: 'col' }, t)))), tb)));
      ctr.textContent = 'Packet-In ไป Controller: ' + pktIn + ' ครั้ง, Flow-Mod จาก Controller: ' + flowMod + ' ครั้ง';
      lg.replaceChildren(...log.map(t => h('li', { class: 'nlwi-i' }, t)));
      if (!log.length) lg.append(h('li', null, 'ยังไม่มีข้อความ กด "ส่งแพ็กเก็ต"'));
    }
    result(msg, 'ok', 'Flow table ยังว่าง (มีแค่แถว table-miss) แพ็กเก็ตแรกจะต้องถาม Controller');
    draw();
  }

  /* ===================================================================
     widget config-render: inventory + Jinja-like template -> per-device config, idempotent apply
     =================================================================== */
  function tplCompile(src) {
    // tokens: text, {{ expr }}, {% stmt %}, {# comment #}; a line holding only a {% %} or {# #} tag is removed (trim_blocks)
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const toks = [];
    lines.forEach((ln, i) => {
      const n = i + 1;
      if (/^\s*(\{%[^%]*%\}|\{#.*#\})\s*$/.test(ln)) { const m = /\{%([^%]*)%\}/.exec(ln); if (m) toks.push({ t: 'stmt', v: m[1].trim(), n }); return; }
      let rest = ln;
      while (rest.length) {
        const i1 = rest.search(/\{\{|\{%|\{#/);
        if (i1 < 0) { toks.push({ t: 'text', v: rest, n }); break; }
        if (i1 > 0) toks.push({ t: 'text', v: rest.slice(0, i1), n });
        const kind = rest.slice(i1, i1 + 2), close = kind === '{{' ? '}}' : kind === '{%' ? '%}' : '#}';
        const j = rest.indexOf(close, i1 + 2);
        if (j < 0) throw { n, m: 'พบ ' + kind + ' แต่ไม่มี ' + close + ' ปิดในบรรทัดเดียวกัน' };
        const body = rest.slice(i1 + 2, j).trim();
        if (kind === '{{') { if (!body) throw { n, m: '{{ }} ว่างเปล่า ต้องใส่ชื่อตัวแปร' }; toks.push({ t: 'expr', v: body, n }); }
        else if (kind === '{%') toks.push({ t: 'stmt', v: body, n });
        rest = rest.slice(j + 2);
      }
      toks.push({ t: 'text', v: '\n', n });
    });
    let k = 0;
    function block(ends) {
      const out = [];
      while (k < toks.length) {
        const tk = toks[k];
        if (tk.t === 'stmt') {
          const w = tk.v.split(/\s+/)[0];
          if (ends.includes(w)) return out;
          k++;
          if (w === 'for') {
            const m = /^for\s+([a-z_]\w*)\s+in\s+([a-z_]\w*)$/i.exec(tk.v);
            if (!m) throw { n: tk.n, m: 'รูปแบบต้องเป็น {% for v in รายการ %}' };
            const body = block(['endfor']);
            if (k >= toks.length) throw { n: tk.n, m: 'ไม่พบ {% endfor %} ปิด {% for %}' };
            k++; out.push({ t: 'for', v: m[1], list: m[2], body, n: tk.n });
          } else if (w === 'if') {
            const br = [{ cond: tk.v.slice(2).trim(), body: null, n: tk.n }];
            br[0].body = block(['elif', 'else', 'endif']);
            for (;;) {
              if (k >= toks.length) throw { n: tk.n, m: 'ไม่พบ {% endif %} ปิด {% if %}' };
              const e = toks[k]; const ew = e.v.split(/\s+/)[0]; k++;
              if (ew === 'endif') break;
              const b = { cond: ew === 'else' ? null : e.v.slice(4).trim(), n: e.n };
              b.body = block(['elif', 'else', 'endif']); br.push(b);
            }
            out.push({ t: 'if', br });
          } else throw { n: tk.n, m: 'ไม่รู้จักคำสั่ง {% ' + tk.v + ' %} (ใช้ได้: for, if, elif, else, endif, endfor)' };
        } else { k++; out.push(tk); }
      }
      if (ends.length) throw { n: toks.length ? toks[toks.length - 1].n : 0, m: 'ไม่พบ {% ' + ends[ends.length - 1] + ' %}' };
      return out;
    }
    const tree = block([]);
    return tree;
  }
  function tplRender(tree, vars) {
    let out = '';
    const val = (x, sc, n) => {
      x = x.trim();
      if (/^-?\d+$/.test(x)) return Number(x);
      if (/^(['"]).*\1$/.test(x)) return x.slice(1, -1);
      if (!/^[a-z_]\w*$/i.test(x)) throw { n, m: 'นิพจน์ "' + x + '" ใช้ไม่ได้ (ใช้ชื่อตัวแปร ตัวเลข หรือข้อความในเครื่องหมายคำพูด)' };
      if (!(x in sc)) throw { n, m: 'ไม่มีตัวแปรชื่อ ' + x + ' (มี: ' + Object.keys(sc).join(', ') + ')' };
      return sc[x];
    };
    const test = (c, sc, n) => {
      const m = /^(.+?)\s*(==|!=)\s*(.+)$/.exec(c);
      if (!m) { const v = val(c, sc, n); return Array.isArray(v) ? v.length > 0 : !!v; }
      const a = String(val(m[1], sc, n)), b = String(val(m[3], sc, n));
      return m[2] === '==' ? a === b : a !== b;
    };
    const run = (nodes, sc) => nodes.forEach(nd => {
      if (nd.t === 'text') out += nd.v;
      else if (nd.t === 'expr') { const v = val(nd.v, sc, nd.n); if (Array.isArray(v)) throw { n: nd.n, m: nd.v + ' เป็นรายการ ใช้ {% for %} วน หรือใช้ตัวแปร ' + nd.v.replace(/s$/, '') + '_list' }; out += String(v); }
      else if (nd.t === 'for') { const L = val(nd.list, sc, nd.n); if (!Array.isArray(L)) throw { n: nd.n, m: nd.list + ' ไม่ใช่รายการ วนลูปไม่ได้' }; L.forEach(it => { const s2 = Object.assign({}, sc); s2[nd.v] = it; run(nd.body, s2); }); }
      else if (nd.t === 'if') { const b = nd.br.find(x => x.cond === null || test(x.cond, sc, x.n)); if (b) run(b.body, sc); }
      if (out.length > 20000) throw { n: 0, m: 'ผลลัพธ์ยาวเกินไป' };
    });
    run(tree, vars);
    return out.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
  }
  function configRender(root) {
    frame(root, 'Template + Inventory → Config ของทุกเครื่อง',
      'แก้ inventory (ตาราง CSV: vlans คั่นด้วย ;) หรือ template แล้วเลือกอุปกรณ์เพื่อดู config ที่ได้ จากนั้นกด "Apply ทุกเครื่อง" ระบบเทียบกับสถานะจริงของสวิตช์จำลองและเปลี่ยนเฉพาะส่วนที่ต่าง กดซ้ำเพื่อดูว่า changed เป็น 0 (idempotent) ทั้งหมดนี้เป็นการจำลองในหน้าเว็บ ไม่ได้ติดต่ออุปกรณ์จริง');
    const INV0 = 'hostname,mgmt_ip,vlans\nACC-SW1,10.10.99.11,10;20;99\nACC-SW2,10.10.99.12,10;20;30;99\nACC-SW3,10.10.99.13,10;99';
    const TPL0 = 'hostname {{ hostname }}\n{% for v in vlans %}\nvlan {{ v }}\n{% if v == 10 %}\n name STUDENT\n{% elif v == 20 %}\n name TEACHER\n{% elif v == 30 %}\n name LAB-IOT\n{% else %}\n name MGMT\n{% endif %}\n{% endfor %}\ninterface Vlan99\n ip address {{ mgmt_ip }} 255.255.255.0';
    const inv = h('textarea', { class: 'nlwi-code', rows: '5', spellcheck: 'false', 'aria-label': 'Inventory แบบ CSV', style: 'min-height:96px' }); inv.value = INV0;
    const tpl = h('textarea', { class: 'nlwi-code', rows: '14', spellcheck: 'false', 'aria-label': 'Template' }); tpl.value = TPL0;
    let dev = 'ACC-SW1';
    const devSel = h('select', { 'aria-label': 'อุปกรณ์ที่จะดูผล', onchange: e => { dev = e.target.value; render(); } });
    const msg = h('div', { class: 'nlw-result', 'aria-live': 'polite' });
    const out = h('pre', { class: 'nlwi-out', 'aria-label': 'config ที่ render ได้' });
    const amsg = h('div', { class: 'nlw-result', 'aria-live': 'polite' });
    const rep = h('div');
    const fresh = () => ({
      'ACC-SW1': { hostname: 'Switch', vlans: { 1: 'default' }, mgmt: '' },
      'ACC-SW2': { hostname: 'ACC-SW2', vlans: { 1: 'default', 10: 'STUDENT', 20: 'TEACHER', 99: 'MGMT' }, mgmt: '10.10.99.12' },
      'ACC-SW3': { hostname: 'ACC-SW3', vlans: { 1: 'default', 10: 'STUDENT', 99: 'MGMT' }, mgmt: '10.10.99.13' }
    });
    let state = fresh(), runs = 0;
    inv.addEventListener('input', render); tpl.addEventListener('input', render);
    root.append(h('div', { class: 'nlwi-grid' }, field('Inventory (Source of Truth)', inv), field('Template', tpl)),
      h('div', { class: 'nlw-row' }, field('ดูผลของอุปกรณ์', devSel)), msg, out,
      h('div', { class: 'nlw-row' }, h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: apply }, 'Apply ทุกเครื่อง'),
        h('button', { type: 'button', class: 'nlw-btn', onclick: () => { state = fresh(); runs = 0; rep.replaceChildren(); result(amsg, 'ok', 'คืนสวิตช์จำลองเป็นสถานะเริ่มต้นแล้ว'); } }, 'คืนสถานะสวิตช์'),
        h('button', { type: 'button', class: 'nlw-btn', onclick: () => { inv.value = INV0; tpl.value = TPL0; inv.scrollLeft = tpl.scrollLeft = 0; inv.scrollTop = tpl.scrollTop = 0; render(); } }, 'คืน template ตัวอย่าง')),
      amsg, rep);
    function parseInv() {
      const lines = inv.value.replace(/\r\n?/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
      if (!lines.length) throw { n: 0, m: 'inventory ว่าง บรรทัดแรกต้องเป็นหัวตาราง เช่น hostname,mgmt_ip,vlans' };
      const cols = lines[0].split(',').map(s => s.trim().toLowerCase());
      if (!cols.includes('hostname')) throw { n: 1, m: 'หัวตารางต้องมีคอลัมน์ hostname' };
      const rows = [];
      lines.slice(1).forEach((ln, i) => {
        const c = ln.split(',').map(s => s.trim());
        if (c.length !== cols.length) throw { n: i + 2, m: 'บรรทัดที่ ' + (i + 2) + ' มี ' + c.length + ' ช่อง แต่หัวตารางมี ' + cols.length + ' คอลัมน์' };
        const v = {};
        cols.forEach((k, j) => {
          if (k === 'vlans') {
            const nums = c[j].split(';').map(s => s.trim()).filter(Boolean);
            if (nums.some(x => !/^\d{1,4}$/.test(x) || +x < 1 || +x > 4094)) throw { n: i + 2, m: 'VLAN ต้องเป็นเลข 1–4094 คั่นด้วย ;' };
            v.vlans = nums.map(Number); v.vlan_list = v.vlans.join(',');
          } else v[k] = c[j];
        });
        if (!v.hostname) throw { n: i + 2, m: 'hostname ว่าง' };
        rows.push(v);
      });
      return rows;
    }
    function build() {
      let rows, tree;
      try { rows = parseInv(); } catch (e) { return { err: 'Inventory บรรทัด ' + e.n + ': ' + e.m }; }
      try { tree = tplCompile(tpl.value); } catch (e) { return { err: 'Template บรรทัด ' + e.n + ': ' + e.m }; }
      const res = {};
      for (const r of rows) {
        try { res[r.hostname] = tplRender(tree, Object.assign({ gateway: '10.10.99.1' }, r)); } catch (e) { return { err: 'Template บรรทัด ' + e.n + ' (' + r.hostname + '): ' + e.m }; }
      }
      return { rows, res };
    }
    function render() {
      const b = build();
      const names = b.rows ? b.rows.map(r => r.hostname) : [];
      devSel.replaceChildren(...names.map(n => h('option', { value: n, selected: n === dev }, n)));
      if (!names.includes(dev) && names.length) { dev = names[0]; devSel.value = dev; }
      if (b.err) { result(msg, 'bad', b.err); out.textContent = ''; return; }
      result(msg, 'ok', 'Render สำเร็จ ' + names.length + ' เครื่องจาก template เดียวกัน');
      out.textContent = b.res[dev] || '';
    }
    function desired(cfg) {
      const d = { hostname: null, vlans: {}, mgmt: null };
      let cur = null, inVlan99 = false;
      cfg.split('\n').forEach(ln => {
        let m;
        if ((m = /^hostname\s+(\S+)/.exec(ln))) { d.hostname = m[1]; cur = null; inVlan99 = false; }
        else if ((m = /^vlan\s+(\d+)/.exec(ln))) { cur = m[1]; d.vlans[cur] = d.vlans[cur] || ''; inVlan99 = false; }
        else if ((m = /^\s+name\s+(\S+)/.exec(ln)) && cur) d.vlans[cur] = m[1];
        else if (/^interface\s+Vlan99/i.test(ln)) { inVlan99 = true; cur = null; }
        else if ((m = /^\s+ip address\s+(\S+)/.exec(ln)) && inVlan99) d.mgmt = m[1];
        else if (/^\S/.test(ln)) { cur = null; inVlan99 = false; }
      });
      return d;
    }
    function apply() {
      const b = build();
      if (b.err) { result(amsg, 'bad', 'Apply ไม่ได้: ' + b.err); return; }
      runs++;
      const tb = h('tbody');
      let total = 0;
      Object.keys(b.res).forEach(name => {
        const st = state[name];
        if (!st) { tb.append(h('tr', { class: 'nlwi-bad' }, h('td', null, name), h('td', null, 'failed'), h('td', null, 'ไม่มีอุปกรณ์นี้ในเครือข่ายจำลอง (unreachable)'))); return; }
        const d = desired(b.res[name]), ch = [];
        if (d.hostname && d.hostname !== st.hostname) { ch.push('hostname ' + st.hostname + ' → ' + d.hostname); st.hostname = d.hostname; }
        Object.keys(d.vlans).forEach(v => {
          const nm = d.vlans[v] || ('VLAN' + String(v).padStart(4, '0'));
          if (!(v in st.vlans)) { ch.push('เพิ่ม vlan ' + v + ' (' + nm + ')'); st.vlans[v] = nm; }
          else if (st.vlans[v] !== nm) { ch.push('เปลี่ยนชื่อ vlan ' + v + ' ' + st.vlans[v] + ' → ' + nm); st.vlans[v] = nm; }
        });
        if (d.mgmt && d.mgmt !== st.mgmt) { ch.push('Vlan99 ip ' + (st.mgmt || '(ไม่มี)') + ' → ' + d.mgmt); st.mgmt = d.mgmt; }
        total += ch.length ? 1 : 0;
        tb.append(h('tr', { class: ch.length ? null : 'nlwi-hit' }, h('td', null, name), h('td', null, ch.length ? 'changed' : 'ok'), h('td', null, ch.length ? ch.join('; ') : 'ตรงกับที่ต้องการแล้ว ไม่ส่งคำสั่ง')));
      });
      rep.replaceChildren(h('div', { class: 'nlw-scroll', tabindex: '0', 'aria-label': 'ผลการ Apply' }, h('table', { class: 'nlw-table' },
        h('thead', null, h('tr', null, ['อุปกรณ์', 'ผล', 'สิ่งที่เปลี่ยน'].map(t => h('th', { scope: 'col' }, t)))), tb)));
      result(amsg, total ? 'warn' : 'ok', 'Apply ครั้งที่ ' + runs + ': changed ' + total + ' เครื่อง' + (total ? ' กดอีกครั้งเพื่อดูว่ารอบถัดไปไม่มีอะไรเปลี่ยน' : ' ทุกเครื่องตรงกับ template แล้ว นี่คือความหมายของ idempotent'));
    }
    render();
  }

  NL_FIG('widget', 'subnet-stepper', subnetStepper);
  NL_FIG('widget', 'eui64-builder', eui64Builder);
  NL_FIG('widget', 'vlsm-allocator', vlsmAllocator);
  NL_FIG('widget', 'static-route-trace', staticRouteTrace);
  NL_FIG('widget', 'sg-nacl-tester', sgNaclTester);
  NL_FIG('widget', 'sdn-flow-lab', sdnFlowLab);
  NL_FIG('widget', 'config-render', configRender);
})();
