'use strict';
/* NetLab 2.8 figures, batch f. Register with NL_FIG('diagram'|'widget', name, svgString|mountFn). */
window.NL_FIG = window.NL_FIG || function (kind, name, v) { const k = kind === 'diagram' ? 'NL_DIAGRAMS' : 'NL_WIDGETS'; (window[k] = window[k] || {})[name] = v; };

/* ---------- static diagrams: built as plain strings (no DOM), so server/figures.js can read them for label questions ---------- */
(function () {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const MONO = 'JetBrains Mono,Consolas,monospace';
  function T(x, y, t, o) {
    o = o || {};
    return `<text x="${x}" y="${y}" font-size="${o.fs || 15}" text-anchor="${o.a || 'middle'}" fill="${o.fill || 'var(--ink)'}"${o.w ? ` font-weight="${o.w}"` : ''} font-family="${o.mono ? MONO : 'inherit'}">${esc(t)}</text>`;
  }
  function R(x, y, w, h, o) {
    o = o || {};
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx == null ? 8 : o.rx}" fill="${o.fill || 'var(--panel)'}"${o.fo != null ? ` fill-opacity="${o.fo}"` : ''} stroke="${o.stroke || 'var(--ink)'}" stroke-width="${o.sw || 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
  }
  function L(x1, y1, x2, y2, o) {
    o = o || {};
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke || 'var(--ink)'}" stroke-width="${o.sw || 2}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''} stroke-linecap="round"${o.me ? ` marker-end="url(#${o.me})"` : ''}${o.ms ? ` marker-start="url(#${o.ms})"` : ''}/>`;
  }
  const MK = (id, color) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker>`;
  const SVG = (name, w, h, title, body, defs) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${name}-title" font-family="inherit"><title id="${name}-title">${esc(title)}</title>${defs ? '<defs>' + defs + '</defs>' : ''}${body}</svg>`;
  function dev(x, y, w, label, o) { o = o || {}; return R(x, y, w, 44, { fill: 'var(--panel)', stroke: o.stroke || 'var(--ink)' }) + T(x + w / 2, y + 28, label, { fs: 15, w: 600 }); }

  /* line-config: point-to-point vs multipoint */
  {
    const n = 'line-config'; let b = '';
    b += R(12, 12, 616, 214, { fill: 'var(--blue)', fo: 0.08, stroke: 'var(--blue)', rx: 12 });
    b += T(28, 42, 'จุดต่อจุด (Point-to-Point)', { a: 'start', fs: 17, w: 700 });
    b += dev(32, 60, 120, 'PC') + dev(468, 60, 140, 'พอร์ตสวิตช์') + L(152, 82, 468, 82, { stroke: 'var(--blue)', sw: 4 });
    b += T(310, 74, 'สาย UTP เส้นนี้ใช้กันแค่ 2 อุปกรณ์', { fs: 14 });
    b += dev(32, 122, 140, 'เราเตอร์สาขา') + dev(448, 122, 160, 'เราเตอร์สำนักงาน') + L(172, 144, 448, 144, { stroke: 'var(--blue)', sw: 4 });
    b += T(310, 136, 'ลิงก์ WAN ที่เช่า (ไฟเบอร์)', { fs: 14 });
    b += T(28, 196, 'ความจุทั้งลิงก์เป็นของสองอุปกรณ์นี้ ไม่ต้องแย่งสื่อกับเครื่องอื่น', { a: 'start', fs: 14 });
    b += T(28, 216, 'ปัจจุบันสาย LAN ทุกเส้นที่ต่อเข้าสวิตช์เป็นแบบจุดต่อจุด', { a: 'start', fs: 14, fill: 'var(--muted)' });
    b += R(12, 240, 616, 346, { fill: 'var(--orange)', fo: 0.08, stroke: 'var(--orange)', rx: 12 });
    b += T(28, 270, 'หลายจุด (Multipoint)', { a: 'start', fs: 17, w: 700 });
    // shared coax bus
    b += L(48, 360, 592, 360, { stroke: 'var(--brown)', sw: 5 }) + R(40, 350, 8, 20, { fill: 'var(--brown)', stroke: 'var(--brown)', rx: 1 }) + R(592, 350, 8, 20, { fill: 'var(--brown)', stroke: 'var(--brown)', rx: 1 });
    [110, 250, 390, 530].forEach((x, i) => { b += dev(x - 50, 288, 100, 'PC' + (i + 1)) + L(x, 332, x, 360, { stroke: 'var(--brown)', sw: 3 }); });
    b += T(320, 386, 'สายโคแอกซ์เส้นเดียวที่ทุกเครื่องใช้ร่วมกัน (10BASE2 ในอดีต)', { fs: 14 });
    // Wi-Fi: one channel shared by all stations
    b += dev(250, 404, 140, 'Access Point', { stroke: 'var(--orange)' });
    [[150, 'มือถือ'], [320, 'โน้ตบุ๊ก'], [490, 'แท็บเล็ต']].forEach(([x, t]) => { b += L(320, 448, x, 478, { stroke: 'var(--orange)', sw: 2.5, dash: '7 6' }) + dev(x - 55, 478, 110, t); });
    b += T(400, 431, 'ช่องสัญญาณ Wi-Fi เดียวกัน', { a: 'start', fs: 13, fill: 'var(--muted)' });
    b += T(28, 552, 'หลายเครื่องใช้สื่อเดียวกัน (สายเส้นเดียวหรือช่องสัญญาณ Wi-Fi เดียวกัน)', { a: 'start', fs: 14 });
    b += T(28, 574, 'จึงต้องผลัดกันส่ง เช่น CSMA/CA ของ Wi-Fi และต้องมีที่อยู่บอกว่าใครคือผู้รับ', { a: 'start', fs: 14 });
    NL_FIG('diagram', 'line-config', SVG(n, 640, 598, 'รูปแบบการเชื่อมต่อสาย (Line configuration): แบบจุดต่อจุด (Point-to-Point) ลิงก์หนึ่งเส้นเชื่อมเพียงสองอุปกรณ์ เช่น PC กับพอร์ตสวิตช์ด้วยสาย UTP หรือเราเตอร์สาขากับเราเตอร์สำนักงานด้วยลิงก์ WAN ความจุทั้งลิงก์เป็นของคู่นั้น ส่วนแบบหลายจุด (Multipoint) หลายอุปกรณ์ใช้สื่อเดียวกัน เช่น สายโคแอกซ์ 10BASE2 ในอดีต หรือช่องสัญญาณ Wi-Fi ที่ Access Point และเครื่องลูกข่ายใช้ร่วมกัน ต้องผลัดกันส่งและต้องมีที่อยู่ระบุผู้รับ', b));
  }

  /* layer-peer: layered architecture, interfaces and peer-to-peer processes (5-layer Internet model) */
  {
    const n = 'layer-peer'; let b = '';
    const COL = { A: 16, R: 245, B: 474 }, W = 150, Y = i => 96 + i * 66, BH = 44;
    const LAY = [['Application', 'blue'], ['Transport', 'green'], ['Network', 'orange'], ['Data Link', 'brown'], ['Physical', 'muted']];
    b += T(91, 52, 'เว็บเซิร์ฟเวอร์', { fs: 16, w: 700 }) + T(91, 72, '(ผู้ส่ง)', { fs: 13, fill: 'var(--muted)' });
    b += T(320, 52, 'เราเตอร์', { fs: 16, w: 700 }) + T(320, 72, '(ระหว่างทาง)', { fs: 13, fill: 'var(--muted)' });
    b += T(549, 52, 'มือถือ', { fs: 16, w: 700 }) + T(549, 72, '(ผู้รับ)', { fs: 13, fill: 'var(--muted)' });
    const PROTO = {
      A: ['HTTP (ส่งหน้าเว็บ)', 'TCP', 'IP', 'Ethernet', 'สาย UTP'],
      R: [null, null, 'IP', 'Ethernet | Wi-Fi', 'UTP | คลื่นวิทยุ'],
      B: ['HTTP (เบราว์เซอร์)', 'TCP', 'IP', 'Wi-Fi', 'คลื่นวิทยุ']
    };
    for (const c of ['A', 'R', 'B']) LAY.forEach(([name, col], i) => {
      if (!PROTO[c][i]) return;
      b += R(COL[c], Y(i), W, BH, { fill: `var(--${col})`, fo: 0.13, stroke: `var(--${col})` });
      b += T(COL[c] + W / 2, Y(i) + 19, name, { fs: 15, w: 700 }) + T(COL[c] + W / 2, Y(i) + 37, PROTO[c][i], { fs: 13, fill: 'var(--muted)' });
    });
    // real path: down through A, across the media, up to IP in the router and down again, up through B
    for (let i = 0; i < 4; i++) {
      b += L(91, Y(i) + BH + 2, 91, Y(i + 1) - 2, { stroke: 'var(--ink)', sw: 2.5, me: 'lp-k' });
      b += L(549, Y(i + 1) - 2, 549, Y(i) + BH + 2, { stroke: 'var(--ink)', sw: 2.5, me: 'lp-k' });
    }
    for (let i = 2; i < 4; i++) {
      b += L(296, Y(i + 1) - 2, 296, Y(i) + BH + 2, { stroke: 'var(--ink)', sw: 2.5, me: 'lp-k' });
      b += L(344, Y(i) + BH + 2, 344, Y(i + 1) - 2, { stroke: 'var(--ink)', sw: 2.5, me: 'lp-k' });
    }
    const yc = i => Y(i) + 26;
    b += L(166, yc(4), 245, yc(4), { stroke: 'var(--ink)', sw: 3.5 }) + L(395, yc(4), 474, yc(4), { stroke: 'var(--ink)', sw: 3.5, dash: '2 5' });
    b += T(205, yc(4) - 8, 'บิต', { fs: 13 }) + T(434, yc(4) - 8, 'บิต', { fs: 13 });
    // logical (peer-to-peer) communication: same layer, different devices
    const peer = (x1, x2, i, label, color) => L(x1 + 4, yc(i), x2 - 4, yc(i), { stroke: `var(--${color})`, sw: 2.5, dash: '7 6', me: 'lp-' + color, ms: 'lp-' + color }) + T((x1 + x2) / 2, yc(i) - 8, label, { fs: 13, w: 600 });
    b += peer(166, 474, 0, 'ข้อความ HTTP (Message)', 'blue');
    b += peer(166, 474, 1, 'Segment ของ TCP', 'green');
    b += peer(166, 245, 2, 'Packet', 'orange') + peer(395, 474, 2, 'Packet', 'orange');
    b += peer(166, 245, 3, 'Frame', 'brown') + peer(395, 474, 3, 'Frame', 'brown');
    b += L(24, 452, 70, 452, { stroke: 'var(--blue)', sw: 2.5, dash: '7 6' }) + T(80, 457, 'การสื่อสารเชิงตรรกะของชั้นเดียวกัน (Peer-to-Peer Process) ใช้โปรโตคอลของชั้นนั้น', { a: 'start', fs: 14 });
    b += L(47, 470, 47, 494, { stroke: 'var(--ink)', sw: 2.5, me: 'lp-k' }) + T(80, 488, 'ทางเดินจริงของข้อมูล: ผ่าน Interface ลงทีละชั้น ข้ามสื่อ แล้วขึ้นทีละชั้น', { a: 'start', fs: 14 });
    b += T(24, 524, 'เราเตอร์ทำงานถึงชั้น Network: เปิดอ่าน Packet และเปลี่ยน Frame ใหม่ แต่ไม่เปิด Segment', { a: 'start', fs: 14, fill: 'var(--muted)' });
    const defs = MK('lp-k', 'var(--ink)') + ['blue', 'green', 'orange', 'brown'].map(c => MK('lp-' + c, `var(--${c})`)).join('');
    NL_FIG('diagram', 'layer-peer', SVG(n, 640, 544, 'สถาปัตยกรรมแบบชั้นและ Peer-to-Peer Process: เว็บเซิร์ฟเวอร์ (ผู้ส่ง) มี 5 ชั้น Application (HTTP), Transport (TCP), Network (IP), Data Link (Ethernet), Physical (สาย UTP) เราเตอร์ระหว่างทางมีแค่ Network, Data Link และ Physical ส่วนมือถือ (ผู้รับ) มี 5 ชั้นโดยใช้ Wi-Fi และคลื่นวิทยุ ข้อมูลจริงเดินลงทีละชั้นผ่าน Interface ข้ามสื่อเป็นบิต ขึ้นถึงชั้น Network ของเราเตอร์แล้วลงอีกครั้ง จากนั้นขึ้นทีละชั้นที่ผู้รับ ขณะที่ชั้นเดียวกันของสองฝั่งสื่อสารกันเชิงตรรกะด้วยหน่วยข้อมูลของตน คือ ข้อความ HTTP, Segment ของ TCP, Packet และ Frame ซึ่ง Packet และ Frame คุยกันทีละช่วงกับเราเตอร์', b, defs));
  }

  /* ipv6-header: RFC 8200 base header, 32-bit rows */
  {
    const n = 'ipv6-header'; let b = '';
    const X0 = 40, BW = 18, RH = 56, Y0 = 92;   // 32 bits * 18 px = 576 px
    const bx = bit => X0 + bit * BW;
    b += T(320, 30, 'ส่วนหัวหลักของ IPv6 (IPv6 Base Header) ตาม RFC 8200', { fs: 17, w: 700 });
    b += T(320, 52, 'แต่ละแถวกว้าง 32 บิต', { fs: 14, fill: 'var(--muted)' });
    [0, 4, 8, 12, 16, 20, 24, 31].forEach(k => { b += T(bx(k) + BW / 2, 80, String(k), { fs: 13, fill: 'var(--muted)', mono: true }); });
    const F = (b0, b1, row, name, width, color, rows) => {
      const x = bx(b0), w = (b1 - b0) * BW, y = Y0 + row * RH, h = (rows || 1) * RH;
      return R(x, y, w, h, { fill: `var(--${color})`, fo: 0.14, stroke: `var(--${color})`, rx: 4 }) +
        T(x + w / 2, y + h / 2 - 2, name, { fs: 15, w: 700 }) + T(x + w / 2, y + h / 2 + 18, width, { fs: 13, fill: 'var(--muted)' });
    };
    b += F(0, 4, 0, 'Version', '4 บิต', 'muted') + F(4, 12, 0, 'Traffic Class', '8 บิต', 'blue') + F(12, 32, 0, 'Flow Label', '20 บิต', 'green');
    b += F(0, 16, 1, 'Payload Length', '16 บิต', 'orange') + F(16, 24, 1, 'Next Header', '8 บิต', 'brown') + F(24, 32, 1, 'Hop Limit', '8 บิต', 'blue');
    b += F(0, 32, 2, 'Source Address', '128 บิต (4 แถว)', 'green', 2);
    b += F(0, 32, 4, 'Destination Address', '128 บิต (4 แถว)', 'orange', 2);
    const yEnd = Y0 + 6 * RH;
    b += L(bx(0), yEnd + 16, bx(32), yEnd + 16, { stroke: 'var(--muted)', sw: 1.5, ms: 'v6-m', me: 'v6-m' });
    b += T(320, yEnd + 40, 'ยาวคงที่ 40 ไบต์ (320 บิต) ทุกแพ็กเก็ต', { fs: 15, w: 700 });
    b += T(320, yEnd + 66, 'ไม่มีฟิลด์ Checksum และไม่มีฟิลด์แบ่งชิ้น (Fragment) ในส่วนหัวหลัก', { fs: 14 });
    b += T(320, yEnd + 90, 'ข้อมูลเสริมใส่เป็น Extension Header ต่อท้ายเมื่อจำเป็น', { fs: 14, fill: 'var(--muted)' });
    NL_FIG('diagram', 'ipv6-header', SVG(n, 640, yEnd + 110, 'โครงสร้างส่วนหัวหลักของ IPv6 ตาม RFC 8200 แถวละ 32 บิต: แถวแรก Version 4 บิต, Traffic Class 8 บิต, Flow Label 20 บิต แถวที่สอง Payload Length 16 บิต, Next Header 8 บิต, Hop Limit 8 บิต ตามด้วย Source Address 128 บิต และ Destination Address 128 บิต รวมยาวคงที่ 40 ไบต์ ไม่มี Checksum และไม่มีฟิลด์แบ่งชิ้นในส่วนหัวหลัก', b, MK('v6-m', 'var(--muted)')));
  }

  /* ipv6-ext-headers: Next Header chain */
  {
    const n = 'ipv6-ext-headers'; let b = '';
    const box = (x, y, w, t1, t2, color) => R(x, y, w, 62, { fill: `var(--${color})`, fo: 0.14, stroke: `var(--${color})`, rx: 6 }) + T(x + w / 2, y + 26, t1, { fs: 14, w: 700 }) + T(x + w / 2, y + 48, t2, { fs: 13, mono: true });
    const arr = (x1, x2, y) => L(x1 + 2, y, x2 - 3, y, { stroke: 'var(--ink)', sw: 2, me: 'v6x-k' });
    b += T(16, 30, 'ตัวอย่าง 1: แพ็กเก็ตทั่วไป', { a: 'start', fs: 16, w: 700 });
    b += box(16, 44, 186, 'IPv6 Header', 'Next Header = 6', 'blue') + arr(202, 226, 75) + box(226, 44, 186, 'TCP Header', 'พอร์ต, seq, ack', 'green') + arr(412, 436, 75) + box(436, 44, 188, 'ข้อมูล (Data)', 'เช่น HTTP', 'muted');
    b += T(16, 146, 'ตัวอย่าง 2: มี Extension Header คั่น', { a: 'start', fs: 16, w: 700 });
    b += box(16, 160, 140, 'IPv6 Header', 'NH = 43', 'blue') + arr(156, 172, 191) + box(172, 160, 140, 'Routing', 'NH = 44', 'orange') + arr(312, 328, 191) + box(328, 160, 140, 'Fragment', 'NH = 17', 'orange') + arr(468, 484, 191) + box(484, 160, 140, 'UDP + ข้อมูล', 'หัว UDP 8 ไบต์', 'green');
    b += T(320, 250, 'แต่ละส่วนหัวบอกว่าส่วนถัดไปคืออะไร ด้วยเลข Next Header (NH)', { fs: 14 });
    b += T(320, 272, 'เราเตอร์ระหว่างทางอ่านแค่ส่วนหัวหลัก (ยกเว้น Hop-by-Hop Options)', { fs: 14, fill: 'var(--muted)' });
    b += R(16, 290, 608, 112, { fill: 'var(--field)', stroke: 'var(--line)', rx: 8 });
    b += T(32, 316, 'ค่า Next Header ที่พบบ่อย (ใช้ชุดเลขเดียวกับฟิลด์ Protocol ของ IPv4)', { a: 'start', fs: 14, w: 700 });
    [['6', 'TCP'], ['17', 'UDP'], ['58', 'ICMPv6'], ['0', 'Hop-by-Hop']].forEach(([v, t], i) => { b += T(32 + i * 150, 346, v + ' = ' + t, { a: 'start', fs: 14, mono: true }); });
    [['43', 'Routing'], ['44', 'Fragment'], ['50', 'ESP'], ['51', 'AH']].forEach(([v, t], i) => { b += T(32 + i * 150, 378, v + ' = ' + t, { a: 'start', fs: 14, mono: true }); });
    NL_FIG('diagram', 'ipv6-ext-headers', SVG(n, 640, 418, 'ห่วงโซ่ Next Header ของ IPv6: ตัวอย่างแรกส่วนหัว IPv6 มี Next Header เท่ากับ 6 ตามด้วย TCP และข้อมูล ตัวอย่างที่สองส่วนหัว IPv6 มี Next Header 43 ตามด้วย Routing Header ที่ชี้ 44 ไปยัง Fragment Header ที่ชี้ 17 ไปยัง UDP และข้อมูล ค่าที่พบบ่อย 6 TCP, 17 UDP, 58 ICMPv6, 0 Hop-by-Hop Options, 43 Routing, 44 Fragment, 50 ESP, 51 AH', b, MK('v6x-k', 'var(--ink)')));
  }

  /* socket-demux: ports and sockets, demultiplexing at the server */
  {
    const n = 'socket-demux'; let b = '';
    const xs = [16, 172, 328, 484], W = 140;
    b += R(8, 12, 304, 120, { fill: 'var(--blue)', fo: 0.07, stroke: 'var(--blue)', rx: 12 }) + T(160, 38, 'PC-A 192.168.1.50', { fs: 15, w: 700, mono: true });
    b += R(320, 12, 312, 120, { fill: 'var(--green)', fo: 0.07, stroke: 'var(--green)', rx: 12 }) + T(476, 38, 'PC-B 192.168.1.51', { fs: 15, w: 700, mono: true });
    const C = [['เบราว์เซอร์ แท็บ 1', 'TCP 51001'], ['เบราว์เซอร์ แท็บ 2', 'TCP 51002'], ['โปรแกรม SSH', 'TCP 50122'], ['ตัวถาม DNS', 'UDP 60311']];
    C.forEach(([a, p], i) => { b += R(xs[i], 56, W, 60, { rx: 6 }) + T(xs[i] + W / 2, 80, a, { fs: 14, w: 600 }) + T(xs[i] + W / 2, 104, p, { fs: 14, mono: true, fill: 'var(--blue)' }); });
    const S = [['TCP 443', 'HTTPS (แท็บ 1)'], ['TCP 443', 'HTTPS (แท็บ 2)'], ['TCP 22', 'SSH'], ['UDP 53', 'DNS']];
    const lab = ['51001 → 443', '51002 → 443', '50122 → 22', '60311 → 53'];
    xs.forEach((x, i) => {
      b += L(x + W / 2, 118, x + W / 2, 300, { stroke: i === 3 ? 'var(--orange)' : 'var(--blue)', sw: 2.5, me: i === 3 ? 'sd-o' : 'sd-b', dash: i === 3 ? '7 5' : null });
      b += R(x + 8, 196, W - 16, 28, { fill: 'var(--panel)', stroke: 'var(--line)', rx: 6 }) + T(x + W / 2, 215, lab[i], { fs: 13, mono: true });
    });
    b += R(8, 304, 624, 150, { fill: 'var(--orange)', fo: 0.07, stroke: 'var(--orange)', rx: 12 });
    S.forEach(([p, a], i) => { b += R(xs[i], 316, W, 60, { rx: 6 }) + T(xs[i] + W / 2, 340, p, { fs: 14, mono: true, w: 700 }) + T(xs[i] + W / 2, 364, a, { fs: 13 }); });
    b += T(320, 404, 'Server 192.168.1.20', { fs: 15, w: 700, mono: true });
    b += T(320, 430, 'ชั้น Transport ดูพอร์ตแล้วส่งข้อมูลให้โปรแกรมที่ถูกต้อง (Demultiplexing)', { fs: 13, fill: 'var(--muted)' });
    b += T(16, 486, 'TCP แยกการเชื่อมต่อด้วย 4 ค่า: IP ต้นทาง, พอร์ตต้นทาง, IP ปลายทาง, พอร์ตปลายทาง', { a: 'start', fs: 14 });
    b += T(16, 510, 'แท็บ 1 และแท็บ 2 ไปพอร์ต 443 เหมือนกัน แต่พอร์ตต้นทางต่างกัน ข้อมูลจึงไม่ปนกัน', { a: 'start', fs: 14 });
    b += T(16, 534, 'UDP ไม่มีการเชื่อมต่อ ส่งเข้าซ็อกเก็ตตาม IP และพอร์ตปลายทาง', { a: 'start', fs: 14 });
    b += T(16, 558, 'พอร์ตต้นทาง 51001, 51002, 50122, 60311 คือพอร์ตชั่วคราว (Ephemeral Port)', { a: 'start', fs: 14 });
    b += T(16, 582, 'Socket = IP + พอร์ต + โปรโตคอล เช่น 192.168.1.20 : 443 / TCP', { a: 'start', fs: 14, w: 700 });
    NL_FIG('diagram', 'socket-demux', SVG(n, 640, 600, 'พอร์ตและซ็อกเก็ต: PC-A 192.168.1.50 เปิดเบราว์เซอร์สองแท็บใช้พอร์ตต้นทาง TCP 51001 และ 51002 ไปยังพอร์ต 443 ของ Server 192.168.1.20 ส่วน PC-B 192.168.1.51 ใช้ SSH จากพอร์ต TCP 50122 ไปยังพอร์ต 22 และถาม DNS จากพอร์ต UDP 60311 ไปยังพอร์ต 53 ชั้น Transport ของ Server แยกข้อมูลส่งให้โปรแกรมที่ถูกต้อง TCP แยกการเชื่อมต่อด้วย IP และพอร์ตทั้งต้นทางและปลายทาง ส่วน UDP แยกด้วย IP และพอร์ตปลายทาง', b, MK('sd-b', 'var(--blue)') + MK('sd-o', 'var(--orange)')));
  }

  /* tcp-states: open (3-way) and close (4-way) with connection states */
  {
    const n = 'tcp-states'; let b = '';
    const CX = 200, SX = 440;
    b += T(CX, 30, 'Client', { fs: 16, w: 700 }) + T(SX, 30, 'Server', { fs: 16, w: 700 });
    b += L(CX, 40, CX, 690, { stroke: 'var(--muted)', sw: 1.5, dash: '4 6' }) + L(SX, 40, SX, 690, { stroke: 'var(--muted)', sw: 1.5, dash: '4 6' });
    const st = (side, y, t, c) => T(side === 'c' ? CX - 10 : SX + 10, y + 5, t, { a: side === 'c' ? 'end' : 'start', fs: 14, w: 700, fill: `var(--${c || 'blue'})`, mono: true });
    const msg = (x1, y1, x2, y2, t, c) => {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      return L(x1, y1, x2, y2, { stroke: `var(--${c})`, sw: 2.5, me: 'ts-' + c[0] }) + T(mx, my - 22, t, { fs: 13, mono: true });
    };
    b += R(8, 50, 624, 236, { fill: 'var(--green)', fo: 0.06, stroke: 'none', rx: 10 }) + T(320, 70, 'เปิดการเชื่อมต่อ (3-way handshake)', { fs: 14, w: 700, fill: 'var(--muted)' });
    b += st('c', 92, 'CLOSED', 'muted') + st('s', 92, 'LISTEN', 'muted');
    b += st('c', 116, 'SYN-SENT') + msg(CX, 116, SX, 156, 'SYN seq=1000', 'blue');
    b += st('s', 156, 'SYN-RECEIVED') + msg(SX, 172, CX, 212, 'SYN, ACK seq=5000 ack=1001', 'green');
    b += st('c', 212, 'ESTABLISHED', 'green') + msg(CX, 226, SX, 266, 'ACK seq=1001 ack=5001', 'blue');
    b += st('s', 266, 'ESTABLISHED', 'green');
    b += R(CX + 6, 296, SX - CX - 12, 40, { fill: 'var(--field)', stroke: 'var(--line)', rx: 6 }) + T(320, 313, 'ส่งข้อมูล 500 ไบต์ (seq 1001-1500)', { fs: 13 }) + T(320, 330, 'และ ACK ตอบกลับ', { fs: 13 });
    b += R(8, 346, 624, 336, { fill: 'var(--orange)', fo: 0.06, stroke: 'none', rx: 10 }) + T(320, 366, 'ปิดการเชื่อมต่อ (4-way close)', { fs: 14, w: 700, fill: 'var(--muted)' });
    b += st('c', 392, 'FIN-WAIT-1', 'orange') + msg(CX, 392, SX, 432, 'FIN, ACK seq=1501 ack=5001', 'blue');
    b += st('s', 432, 'CLOSE-WAIT', 'orange') + msg(SX, 446, CX, 486, 'ACK seq=5001 ack=1502', 'green');
    b += st('c', 486, 'FIN-WAIT-2', 'orange');
    b += T(SX + 10, 512, 'แอปฝั่งนี้ปิด', { a: 'start', fs: 13, fill: 'var(--muted)' });
    b += st('s', 532, 'LAST-ACK', 'orange') + msg(SX, 532, CX, 572, 'FIN, ACK seq=5001 ack=1502', 'green');
    b += st('c', 572, 'TIME-WAIT', 'bad') + msg(CX, 586, SX, 626, 'ACK seq=1502 ack=5002', 'blue');
    b += st('s', 626, 'CLOSED', 'muted');
    b += L(CX - 150, 590, CX - 150, 650, { stroke: 'var(--bad)', sw: 2, ms: 'ts-r', me: 'ts-r' }) + T(CX - 140, 616, 'รอ 2 x MSL', { a: 'start', fs: 13, fill: 'var(--bad)' }) + T(CX - 140, 636, 'เผื่อ FIN ซ้ำ', { a: 'start', fs: 13, fill: 'var(--bad)' });
    b += st('c', 666, 'CLOSED', 'muted');
    NL_FIG('diagram', 'tcp-states', SVG(n, 640, 700, 'สถานะการเชื่อมต่อ TCP: Client เริ่มที่ CLOSED และ Server รอที่ LISTEN Client ส่ง SYN seq=1000 เข้าสู่ SYN-SENT Server ตอบ SYN, ACK seq=5000 ack=1001 เข้าสู่ SYN-RECEIVED Client ส่ง ACK ack=5001 ทั้งสองฝั่งเป็น ESTABLISHED แล้วส่งข้อมูล 500 ไบต์ การปิด: Client ส่ง FIN เข้าสู่ FIN-WAIT-1 Server ตอบ ACK เข้าสู่ CLOSE-WAIT Client เป็น FIN-WAIT-2 เมื่อแอปฝั่ง Server ปิดจึงส่ง FIN เข้าสู่ LAST-ACK Client ตอบ ACK แล้วรอใน TIME-WAIT เป็นเวลา 2 เท่าของ MSL ก่อนเป็น CLOSED ส่วน Server เป็น CLOSED เมื่อได้รับ ACK สุดท้าย', b, MK('ts-b', 'var(--blue)') + MK('ts-g', 'var(--green)') + MK('ts-r', 'var(--bad)')));
  }
})();

/* ---------- interactive widgets (batch f) ---------- */
(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c == null || c === false) return; if (Array.isArray(c)) return c.forEach(x => add(e, x)); e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); }
  function s(tag, props) {
    const e = document.createElementNS(SVGNS, tag);
    if (props) for (const k in props) { const v = props[k]; if (v == null) continue; if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (let i = 2; i < arguments.length; i++) if (arguments[i]) e.appendChild(arguments[i]);
    return e;
  }
  const reduceMotion = () => !!(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fmt = (v, d) => Number(v).toLocaleString('en-US', { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d });
  const CSS = `
.nlff [hidden]{display:none !important}
.nlff .nlff-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
.nlff .nlw-btn{min-height:44px;min-width:44px}
.nlff .nlff-svg{display:block;width:100%;height:auto;max-width:620px;margin:6px auto}
.nlff .nlff-svg text{font-family:inherit}
.nlff .nlff-count{font-weight:700;font-variant-numeric:tabular-nums}
.nlff .nlff-desc{border-left:5px solid var(--blue);background:var(--field);border-radius:0 8px 8px 0;padding:8px 12px;margin:8px 0}
.nlff .nlff-desc h4{margin:0 0 4px;font-size:16px}
.nlff .nlff-desc ul{margin:4px 0;padding-left:20px}
.nlff .nlff-desc li{margin:2px 0;font-size:15px}
.nlff .nlff-ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:8px 14px;margin:8px 0}
.nlff .nlff-ctl label{display:flex;flex-direction:column;gap:2px;font-size:14px;color:var(--muted);min-width:0}
.nlff .nlff-ctl label b{color:var(--ink);font-variant-numeric:tabular-nums}
.nlff .nlff-ctl select{min-height:44px}
.nlff input[type=range]{width:100%;accent-color:var(--blue);min-height:44px;margin:0}
.nlff .nlff-bar{height:14px;background:var(--line);border-radius:7px;overflow:hidden;margin:4px 0}
.nlff .nlff-bar i{display:block;height:100%;background:var(--green)}
.nlff .nlff-strip{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}
.nlff .nlff-strip span{min-width:30px;text-align:center;font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;border:1px solid var(--line);border-radius:6px;padding:2px 4px;background:var(--panel)}
.nlff .nlff-strip span.nlff-ooo{border-color:var(--orange);background:color-mix(in srgb,var(--orange) 22%,transparent);font-weight:700}
.nlff .nlff-strip span.nlff-miss{border-style:dashed;color:var(--muted);background:transparent}
.nlff .nlff-strip span.nlff-okc{border-color:var(--green);background:color-mix(in srgb,var(--green) 16%,transparent)}
.nlff .nlff-bad{color:var(--bad);font-weight:700}.nlff .nlff-ok{color:var(--ok);font-weight:700}
.nlff .nlff-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}
.nlff .nlff-card{border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--panel);min-width:0}
.nlff .nlff-card small{display:block;color:var(--muted);font-size:13px}
.nlff .nlff-card b{display:block;font-family:"JetBrains Mono",Consolas,monospace;font-size:clamp(14px,4.2vw,18px);overflow-wrap:anywhere}
.nlff .nlff-ladder{max-height:460px;overflow:auto;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
.nlff .nlff-ladder svg{display:block;width:100%;height:auto}
.nlff .nlff-log{max-height:260px;overflow:auto}
.nlff .nlff-log table{border-collapse:collapse;width:100%;font-size:14px}
.nlff .nlff-log td,.nlff .nlff-log th{border-bottom:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}
.nlff .nlff-log th{background:var(--field);color:var(--muted);font-weight:600}
.nlff .nlff-log tr.nlff-cur td{background:color-mix(in srgb,var(--blue) 14%,transparent);font-weight:600}
.nlff .nlff-quiz{border-top:1px solid var(--line);margin-top:12px;padding-top:8px}
.nlff .nlff-q{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding:6px 0}
.nlff .nlff-q > span{flex:1 1 200px}
.nlff .nlff-fb{flex-basis:100%;font-size:14px;margin:2px 0 0}
.nlff .nlff-chips{display:flex;flex-wrap:wrap;gap:6px}
.nlff .nlff-link{cursor:pointer}
.nlff details summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:600}
`;
  function injectCSS() {
    if (!document.getElementById('nl-widget-css')) { const base = window.NL_WIDGETS && window.NL_WIDGETS['caesar']; if (typeof base === 'function') { try { base(document.createElement('div')); } catch (e) { /* base styles optional */ } } }
    if (document.getElementById('nlff-css')) return;
    const st = document.createElement('style'); st.id = 'nlff-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
  }
  function frame(root, cls, title, instr) {
    injectCSS(); root.replaceChildren(); root.classList.add('nlw', 'nlff', cls);
    root.append(h('div', { class: 'nlw-title' }, title), h('p', { class: 'nlw-instr' }, h('b', null, 'คำแนะนำการใช้งาน: '), instr));
  }
  function segButtons(opts, cur, onPick, label) {
    const wrap = h('div', { class: 'nlw-seg', role: 'group', 'aria-label': label });
    const btns = opts.map(([v, t]) => h('button', { type: 'button', class: 'nlw-btn', 'aria-pressed': String(v === cur), onclick: () => { set(v); onPick(v); } }, t));
    function set(v) { btns.forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i][0] === v))); }
    wrap.append(...btns); wrap.set = set;
    return wrap;
  }
  function slider(label, min, max, step, val, unit, onInput) {
    const out = h('b', null, String(val) + unit);
    const inp = h('input', { type: 'range', min, max, step, value: val, 'aria-label': label, oninput: e => { out.textContent = e.target.value + unit; onInput(Number(e.target.value)); } });
    return { el: h('label', null, h('span', null, label + ': ', out), inp), inp, out };
  }
  // deterministic pseudo-random number in [0,1) from (seed, key): FNV-1a + mulberry32 finaliser
  function rnd(seed, key) {
    let x = 2166136261 ^ (seed >>> 0); const str = '|' + key;
    for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
    let t = (x + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function Heap() {
    const a = []; let n = 0;
    const lt = (x, y) => x.t < y.t || (x.t === y.t && x._o < y._o);
    return {
      push(e) { e._o = n++; a.push(e); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (lt(a[i], a[p])) { const t = a[i]; a[i] = a[p]; a[p] = t; i = p; } else break; } },
      pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && lt(a[l], a[m])) m = l; if (r < a.length && lt(a[r], a[m])) m = r; if (m === i) break; const t = a[i]; a[i] = a[m]; a[m] = t; i = m; } } return top; },
      get size() { return a.length; }
    };
  }
  function whenRemoved(root, fn) { const mo = new MutationObserver(() => { if (!root.isConnected) { fn(); mo.disconnect(); } }); if (document.body) mo.observe(document.body, { childList: true, subtree: true }); }

  /* ===================================================================
     jitter-buffer: delay, jitter and a playout buffer for VoIP packets
     =================================================================== */
  function jitterSim(o) {
    const n = o.n || 24, P = 20, pk = [];
    for (let i = 0; i < n; i++) { const sT = i * P, d = o.base + rnd(o.seed, 'j' + i) * o.vari; pk.push({ i, s: sT, d, a: sT + d }); }
    const a0 = pk[0].a;
    pk.forEach(p => { p.play = a0 + o.buf + p.i * P; p.late = p.a > p.play + 1e-9; });
    const ds = pk.map(p => p.d), mean = ds.reduce((x, y) => x + y, 0) / n;
    let jsum = 0; for (let i = 1; i < n; i++) jsum += Math.abs(ds[i] - ds[i - 1]);
    const late = pk.filter(p => p.late).length;
    return { pk, P, mean, min: Math.min(...ds), max: Math.max(...ds), jitter: jsum / (n - 1), late, m2e: pk[0].d + o.buf };
  }
  function jitterBuffer(root) {
    frame(root, 'nlff-jb', 'ความตรงเวลาและ Jitter: แพ็กเก็ตเสียงผ่านเครือข่าย', 'เครื่องส่งเสียงทุก 20 ms เลื่อนความหน่วงพื้นฐานและความแปรปรวนของเครือข่าย แล้วปรับขนาดบัฟเฟอร์ฝั่งผู้รับ จุดสีแดงคือแพ็กเก็ตที่มาถึงหลังเวลาที่ต้องเล่น (เสียงขาด) กด "สุ่มเครือข่ายใหม่" เพื่อดูรอบอื่น');
    const o = { base: 40, vari: 40, buf: 30, seed: 7 };
    const s1 = slider('ความหน่วงพื้นฐาน', 10, 150, 5, o.base, ' ms', v => { o.base = v; render(); });
    const s2 = slider('ความแปรปรวนสูงสุด', 0, 120, 5, o.vari, ' ms', v => { o.vari = v; render(); });
    const s3 = slider('บัฟเฟอร์ฝั่งผู้รับ (Jitter buffer)', 0, 150, 5, o.buf, ' ms', v => { o.buf = v; render(); });
    const again = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { o.seed++; render(); } }, 'สุ่มเครือข่ายใหม่');
    const svg = s('svg', { class: 'nlff-svg', viewBox: '0 0 620 250', role: 'img' });
    const res = h('div', { class: 'nlff-desc', 'aria-live': 'polite' });
    root.append(h('div', { class: 'nlff-ctl' }, s1.el, s2.el, s3.el), h('div', { class: 'nlff-row' }, again), svg, res);
    function render() {
      const r = jitterSim(o);
      const tMax = Math.max(r.pk[r.pk.length - 1].play, ...r.pk.map(p => p.a)) + 10;
      const X = t => 60 + t * 548 / tMax;
      svg.replaceChildren();
      [['ส่ง', 44], ['มาถึง', 128], ['เล่น', 206]].forEach(([t, y]) => svg.append(s('text', { x: 6, y: y + 5, 'font-size': 14, fill: 'var(--muted)', text: t }), s('line', { x1: 56, y1: y, x2: 612, y2: y, stroke: 'var(--line)', 'stroke-width': 1 })));
      r.pk.forEach(p => {
        const col = p.late ? 'var(--bad)' : 'var(--green)';
        svg.append(s('line', { x1: X(p.s), y1: 44, x2: X(p.a), y2: 128, stroke: 'var(--blue)', 'stroke-width': 1.2, 'stroke-opacity': 0.6 }));
        svg.append(s('line', { x1: X(p.s), y1: 36, x2: X(p.s), y2: 52, stroke: 'var(--ink)', 'stroke-width': 2 }));
        svg.append(s('line', { x1: X(p.a), y1: 128, x2: X(p.play), y2: 206, stroke: col, 'stroke-width': 1.2, 'stroke-dasharray': p.late ? '3 3' : null }));
        svg.append(s('circle', { cx: X(p.a), cy: 128, r: 5, fill: col }));
        svg.append(s('line', { x1: X(p.play), y1: 198, x2: X(p.play), y2: 214, stroke: col, 'stroke-width': 2 }));
      });
      for (let t = 0; t <= tMax; t += 100) svg.append(s('text', { x: X(t), y: 238, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--muted)', text: t + ' ms' }));
      svg.setAttribute('aria-label', 'ส่ง 24 แพ็กเก็ตทุก 20 ms มาถึงช้ากว่ากำหนดเล่น ' + r.late + ' แพ็กเก็ต');
      const pct = Math.round(100 * r.late / r.pk.length);
      res.replaceChildren(h('h4', null, r.late ? 'เสียงขาด ' + r.late + ' จาก ' + r.pk.length + ' แพ็กเก็ต (' + pct + '%)' : 'เล่นได้ครบทุกแพ็กเก็ต ไม่มีเสียงขาด'),
        h('ul', null,
          h('li', null, 'ความหน่วงเฉลี่ย ' + fmt(r.mean) + ' ms (ต่ำสุด ' + fmt(r.min) + ', สูงสุด ' + fmt(r.max) + ')'),
          h('li', null, 'Jitter (ค่าเฉลี่ยความต่างของความหน่วงระหว่างแพ็กเก็ตที่ติดกัน) ' + fmt(r.jitter) + ' ms'),
          h('li', null, 'เริ่มเล่นที่เวลาแพ็กเก็ตแรกมาถึงบวกบัฟเฟอร์ ' + o.buf + ' ms แล้วเล่นต่อทุก 20 ms แพ็กเก็ตที่มาหลังเวลาเล่นของตัวเองถูกทิ้ง'),
          h('li', { class: r.m2e > 150 ? 'nlff-bad' : null }, 'ความหน่วงที่ผู้ฟังรู้สึก (ปากถึงหู) ประมาณ ' + fmt(r.m2e) + ' ms' + (r.m2e > 150 ? ' เกิน 150 ms ที่ ITU-T G.114 แนะนำสำหรับการโทรที่ดี คุยกันจะเริ่มพูดชนกัน' : '')),
          h('li', null, r.late && o.buf < 150 ? 'ลองเพิ่มบัฟเฟอร์: เสียงขาดน้อยลง แต่ความหน่วงรวมเพิ่มขึ้น นี่คือการแลกกันระหว่างความครบถ้วนกับความตรงเวลา' : 'ลองเพิ่มความแปรปรวน หรือลดบัฟเฟอร์เป็น 0 แล้วดูว่าเสียงเริ่มขาดเมื่อใด')));
    }
    render();
  }

  /* ===================================================================
     switching-lab: circuit vs packet switching on a 5-node network
     =================================================================== */
  const SW = {
    nodes: { A: { x: 50, y: 150 }, R1: { x: 172, y: 150 }, R2: { x: 318, y: 62 }, R3: { x: 318, y: 238 }, B: { x: 452, y: 150 } },
    links: [{ id: 'L1', a: 'A', b: 'R1', km: 10 }, { id: 'L2', a: 'R1', b: 'R2', km: 400 }, { id: 'L3', a: 'R2', b: 'B', km: 10 }, { id: 'L4', a: 'R1', b: 'R3', km: 800 }, { id: 'L5', a: 'R3', b: 'B', km: 10 }],
    US_PER_KM: 5,      // signal speed about 2 x 10^8 m/s in copper/fibre = 5 microseconds per km
    HDR: 40,           // header bytes per packet (e.g. IPv4 20 + TCP 20)
    SETUP_MS: 20,      // circuit set-up processing per switch (model assumption, shown in the UI)
    RTO: 200           // time before a lost packet is re-sent by the end host (Linux minimum RTO)
  };
  const swProp = l => l.km * SW.US_PER_KM / 1000;
  const swLink = id => SW.links.find(l => l.id === id);
  function swDown(breaks, t) { const d = new Set(); breaks.forEach(b => { if (b.t <= t) d.add(b.link); }); return d; }
  function swCosts(down) {   // hop count to B, distance as tie-break (small Bellman-Ford)
    const C = { B: { hops: 0, dist: 0 } }; let changed = true;
    while (changed) {
      changed = false;
      for (const l of SW.links) {
        if (down.has(l.id)) continue;
        for (const [u, v] of [[l.a, l.b], [l.b, l.a]]) {
          if (!C[v]) continue;
          const c = { hops: C[v].hops + 1, dist: C[v].dist + swProp(l) };
          if (!C[u] || c.hops < C[u].hops || (c.hops === C[u].hops && c.dist < C[u].dist - 1e-9)) { C[u] = c; changed = true; }
        }
      }
    }
    return C;
  }
  function swNextHop(node, down, k, ecmp) {
    const C = swCosts(down); if (!C[node]) return null;
    const cands = SW.links.filter(l => !down.has(l.id) && (l.a === node || l.b === node)).map(l => ({ l, n: l.a === node ? l.b : l.a }))
      .filter(x => C[x.n] && C[x.n].hops + 1 === C[node].hops);
    if (!cands.length) return null;
    if (ecmp && cands.length > 1) { cands.sort((p, q) => (p.n < q.n ? -1 : 1)); return cands[k % cands.length]; }
    cands.sort((p, q) => (C[p.n].dist + swProp(p.l)) - (C[q.n].dist + swProp(q.l)));
    return cands[0];
  }
  function swPath(down) { const p = []; let cur = 'A', g = 0; while (cur !== 'B' && g++ < 10) { const nh = swNextHop(cur, down, 0, false); if (!nh) return null; p.push({ from: cur, to: nh.n, l: nh.l }); cur = nh.n; } return p; }
  function swPacketSim(o, breaks) {
    const R = o.rate * 1000, P = Math.ceil(o.bytes / o.pay);
    const size = k => Math.min(o.pay, o.bytes - k * o.pay) + SW.HDR;
    const H = Heap(), free = {}, recs = [], arr = new Array(P).fill(null), arrivals = [], departA = [];
    let lost = 0, retx = 0, failed = 0, viaR3 = 0, guard = 0;
    const brkOf = id => breaks.reduce((m, b) => (b.link === id && b.t < m ? b.t : m), Infinity);
    for (let k = 0; k < P; k++) H.push({ t: 0, node: 'A', k, att: 1 });
    function retry(e, tLost) { if (e.att >= 4) { failed++; return; } retx++; H.push({ t: Math.max((departA[e.k] || 0) + SW.RTO, tLost), node: 'A', k: e.k, att: e.att + 1 }); }
    while (H.size && guard++ < 400000) {
      const e = H.pop();
      if (e.node === 'B') { if (arr[e.k] == null) { arr[e.k] = e.t; arrivals.push({ k: e.k, t: e.t, att: e.att }); } continue; }
      const nh = swNextHop(e.node, swDown(breaks, e.t), e.k, o.ecmp);
      if (!nh) { lost++; recs.push({ k: e.k, att: e.att, from: e.node, to: null, tStart: e.t, tArr: e.t, lostAt: e.t, noRoute: true }); retry(e, e.t); continue; }
      const key = e.node + '>' + nh.n, start = Math.max(e.t, free[key] || 0), end = start + size(e.k) * 8 / R, tArr = end + swProp(nh.l);
      free[key] = end;
      if (e.node === 'A') departA[e.k] = start;
      if (e.node === 'R1' && nh.n === 'R3') viaR3++;
      const tb = brkOf(nh.l.id);
      const r = { k: e.k, att: e.att, from: e.node, to: nh.n, link: nh.l.id, tStart: start, tArr, lostAt: tb > e.t && tb < tArr ? tb : null };
      recs.push(r);
      if (r.lostAt != null) { lost++; retry(e, r.lostAt); } else H.push({ t: tArr, node: nh.n, k: e.k, att: e.att });
    }
    const complete = arr.every(x => x != null);
    const dl = []; let prev = 0; for (let k = 0; k < P; k++) { prev = Math.max(prev, arr[k] == null ? Infinity : arr[k]); dl.push(prev); }
    let maxSeen = -1, reordered = 0; arrivals.forEach(a => { if (a.k < maxSeen) reordered++; else maxSeen = a.k; });
    recs.sort((a, b) => a.tStart - b.tStart);
    const end = complete ? dl[P - 1] : Math.max(0, ...recs.map(r => r.lostAt != null ? r.lostAt : r.tArr));
    return { mode: 'packet', P, T: (o.pay + SW.HDR) * 8 / R, Tlast: size(P - 1) * 8 / R, recs, arrivals, dl, complete, end, lost, retx, failed, viaR3, reordered };
  }
  function swCircuitSim(o, breaks) {
    const R = o.rate * 1000, phases = [];
    let t = 0, remaining = o.bytes, got = 0, setups = 0, drops = 0, failed = false, guard = 0;
    const firstBreak = (ids, a, b) => breaks.filter(x => ids.includes(x.link) && x.t > a && x.t <= b).sort((p, q) => p.t - q.t)[0];
    while (remaining > 0 && guard++ < 10) {
      const path = swPath(swDown(breaks, t));
      if (!path) { failed = true; phases.push({ kind: 'fail', t0: t, t1: t }); break; }
      const props = path.map(x => swProp(x.l)), sumP = props.reduce((a, b) => a + b, 0), ids = path.map(x => x.l.id);
      const t1 = t + sumP + path.length * SW.SETUP_MS + sumP; setups++;
      const bs = firstBreak(ids, t, t1);
      if (bs) { phases.push({ kind: 'setup', path, t0: t, t1: bs.t, full: t1, props, cut: bs }); drops++; t = bs.t; continue; }
      phases.push({ kind: 'setup', path, t0: t, t1, full: t1, props });
      const t0 = t1, tDone = t0 + remaining * 8 / R + sumP;
      const bd = firstBreak(ids, t0, tDone - 1e-12);
      if (!bd) { phases.push({ kind: 'data', path, t0, t1: tDone, sumP, from: got, bytes: remaining }); got += remaining; remaining = 0; t = tDone; break; }
      const idx = ids.indexOf(bd.link), before = props.slice(0, idx).reduce((a, b) => a + b, 0);
      const through = Math.max(0, Math.min(remaining, Math.floor(R * (bd.t - t0 - before - props[idx]) / 8)));
      phases.push({ kind: 'data', path, t0, t1: bd.t, sumP, from: got, bytes: through, cut: bd });
      got += through; remaining -= through; drops++; t = bd.t + before;   // the sender learns about the drop when the signal gets back to it
    }
    const end = remaining === 0 ? t : Math.max(t, ...phases.map(p => p.t1));
    return { mode: 'circuit', phases, complete: remaining === 0, end, got, setups, drops, failed };
  }
  function swArrivedBytes(sim, o, t) {
    if (sim.mode === 'circuit') {
      const R = o.rate * 1000;
      return sim.phases.filter(p => p.kind === 'data').reduce((a, p) => a + Math.max(0, Math.min(p.bytes, R * (t - p.t0 - p.sumP) / 8)), 0);
    }
    let lo = 0, hi = sim.dl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sim.dl[m] <= t) lo = m + 1; else hi = m; }
    return lo === 0 ? 0 : Math.min(o.bytes, lo * o.pay);
  }
  function switchingLab(root) {
    frame(root, 'nlff-sw', 'แล็บการสวิตชิง: Circuit switching เทียบ Packet switching', 'เลือกแบบการสวิตชิง ขนาดข้อความ และความเร็วลิงก์ แล้วกด "เล่น" หรือเลื่อนแถบเวลา ระหว่างที่กำลังส่ง ให้กดปุ่ม "ตัดลิงก์" (หรือแตะเส้นในภาพ) เพื่อดูว่าวงจรขาดหรือแพ็กเก็ตอ้อมไปทางอื่น ตัวเลขทุกตัวคำนวณจากความเร็วลิงก์ ระยะทาง และขนาดแพ็กเก็ตจริง');
    const o = { mode: 'packet', bytes: 100000, rate: 10, pay: 1460, ecmp: false };
    let breaks = [], sim = null, other = null, t = 0, timer = null, last = 0;
    const modeSeg = segButtons([['circuit', 'Circuit switching'], ['packet', 'Packet switching']], o.mode, v => { o.mode = v; rerun(true); }, 'เลือกแบบการสวิตชิง');
    const sel = (label, opts, val, on) => { const e = h('select', { 'aria-label': label, onchange: ev => on(Number(ev.target.value)) }, opts.map(([v, t2]) => h('option', { value: v, selected: v === val }, t2))); return { el: h('label', null, h('span', null, label), e), e }; };
    const sz = sel('ขนาดข้อความ', [[1000, '1 KB (1,000 ไบต์)'], [10000, '10 KB'], [100000, '100 KB'], [1000000, '1 MB']], o.bytes, v => { o.bytes = v; rerun(true); });
    const rt = sel('ความเร็วทุกลิงก์', [[1, '1 Mbps'], [10, '10 Mbps'], [100, '100 Mbps']], o.rate, v => { o.rate = v; rerun(true); });
    const py = sel('ข้อมูลต่อแพ็กเก็ต (ไม่รวมส่วนหัว 40 ไบต์)', [[500, '500 ไบต์'], [1000, '1,000 ไบต์'], [1460, '1,460 ไบต์ (รวมหัว = 1,500)']], o.pay, v => { o.pay = v; rerun(true); });
    const ecmpBox = h('label', { class: 'nlw-check' }, h('input', { type: 'checkbox', onchange: e => { o.ecmp = e.target.checked; rerun(true); } }), 'ให้ R1 ส่งแพ็กเก็ตสลับกันสองเส้นทาง (ผ่าน R2 และ R3)');
    const svg = s('svg', { class: 'nlff-svg', viewBox: '0 0 500 300', role: 'img' });
    const cutRow = h('div', { class: 'nlff-chips', role: 'group', 'aria-label': 'ตัดหรือซ่อมลิงก์ที่เวลาปัจจุบัน' });
    const linkBtns = {};
    SW.links.forEach(l => { linkBtns[l.id] = h('button', { type: 'button', class: 'nlw-btn', 'aria-pressed': 'false', onclick: () => toggleCut(l.id) }, 'ตัด ' + l.a + '-' + l.b); cutRow.append(linkBtns[l.id]); });
    const fixAll = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { breaks = []; rerun(false); } }, 'ซ่อมทุกลิงก์');
    cutRow.append(fixAll);
    const play = h('button', { type: 'button', class: 'nlw-btn nlw-primary', 'aria-pressed': 'false', onclick: () => (timer ? stop() : start()) }, 'เล่น');
    if (reduceMotion()) play.hidden = true;
    const back = h('button', { type: 'button', class: 'nlw-btn', 'aria-label': 'ถอยเวลา 5 เปอร์เซ็นต์', onclick: () => { stop(); setT(t - sim.end * 0.05); } }, '◀ 5%');
    const fwd = h('button', { type: 'button', class: 'nlw-btn', 'aria-label': 'เดินเวลา 5 เปอร์เซ็นต์', onclick: () => { stop(); setT(t + sim.end * 0.05); } }, '5% ▶');
    const toEnd = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { stop(); setT(sim.end); } }, 'ไปจุดจบ');
    const range = h('input', { type: 'range', min: 0, max: 1000, step: 1, value: 0, 'aria-label': 'เวลาจำลอง', oninput: e => { stop(); setT(sim.end * Number(e.target.value) / 1000); } });
    const tOut = h('output', { class: 'nlff-count', 'aria-live': 'off' });
    const bar = h('i', { style: 'width:0%' });
    const prog = h('div', { class: 'nlw-small' });
    const strip = h('div', { class: 'nlff-strip', role: 'group', 'aria-label': 'ลำดับแพ็กเก็ตที่มาถึง B' });
    const stripWrap = h('div', null, h('div', { class: 'nlw-small' }, 'ลำดับที่แพ็กเก็ตมาถึง B (40 ตัวแรก, สีส้ม = มาก่อนตัวที่เลขน้อยกว่า ต้องรอเรียงก่อนส่งให้แอป)'), strip);
    const res = h('div', { class: 'nlff-desc', 'aria-live': 'polite' });
    const cmp = h('p', { class: 'nlw-small' });
    root.append(modeSeg, h('div', { class: 'nlff-ctl' }, sz.el, rt.el, py.el), ecmpBox, svg,
      h('div', { class: 'nlw-small' }, 'ตัดลิงก์ที่เวลาปัจจุบัน (กดซ้ำเพื่อยกเลิก):'), cutRow,
      h('div', { class: 'nlff-row' }, play, back, fwd, toEnd, tOut), range,
      h('div', { class: 'nlff-bar', role: 'presentation' }, bar), prog, stripWrap, res, cmp);
    function toggleCut(id) {
      stop();
      const i = breaks.findIndex(b => b.link === id);
      if (i >= 0) breaks.splice(i, 1); else breaks.push({ link: id, t });
      rerun(false);
    }
    function rerun(resetTime) {
      py.el.hidden = o.mode !== 'packet'; ecmpBox.hidden = o.mode !== 'packet'; stripWrap.hidden = o.mode !== 'packet';
      sim = o.mode === 'packet' ? swPacketSim(o, breaks) : swCircuitSim(o, breaks);
      other = o.mode === 'packet' ? swCircuitSim(o, breaks) : swPacketSim(o, breaks);
      if (resetTime) { stop(); t = 0; }
      t = Math.min(t, sim.end);
      SW.links.forEach(l => { const b = breaks.find(x => x.link === l.id); linkBtns[l.id].setAttribute('aria-pressed', String(!!b)); linkBtns[l.id].textContent = b ? 'ตัด ' + l.a + '-' + l.b + ' (ที่ ' + fmt(b.t) + ' ms)' : 'ตัด ' + l.a + '-' + l.b; });
      explain(); draw();
    }
    function setT(v) { t = Math.max(0, Math.min(sim.end, v)); draw(); }
    function start() { if (t >= sim.end) t = 0; play.textContent = 'หยุด'; play.setAttribute('aria-pressed', 'true'); last = performance.now(); timer = requestAnimationFrame(tick); }
    function stop() { if (timer) cancelAnimationFrame(timer); timer = null; play.textContent = 'เล่น'; play.setAttribute('aria-pressed', 'false'); }
    function tick(now) { const dt = now - last; last = now; t = Math.min(sim.end, t + dt * sim.end / 9000); draw(); if (t >= sim.end) stop(); else timer = requestAnimationFrame(tick); }
    whenRemoved(root, stop);
    const P = id => SW.nodes[id];
    function draw() {
      range.value = String(sim.end ? Math.round(1000 * t / sim.end) : 0);
      tOut.textContent = 't = ' + fmt(t) + ' / ' + fmt(sim.end) + ' ms';
      const got = swArrivedBytes(sim, o, t), pct = Math.min(100, 100 * got / o.bytes);
      bar.style.width = pct.toFixed(1) + '%';
      prog.textContent = 'แอปที่ B ได้รับข้อมูลครบตามลำดับแล้ว ' + Math.floor(got).toLocaleString('en-US') + ' / ' + o.bytes.toLocaleString('en-US') + ' ไบต์ (' + pct.toFixed(0) + '%)';
      svg.replaceChildren();
      const down = swDown(breaks, t);
      let phase = null, onPath = new Set();
      if (sim.mode === 'circuit') { phase = sim.phases.filter(p => p.t0 <= t).pop() || null; if (phase && phase.path && !(phase.cut && t >= phase.t1)) phase.path.forEach(x => onPath.add(x.l.id)); }
      SW.links.forEach(l => {
        const a = P(l.a), b = P(l.b), isDown = down.has(l.id), res2 = onPath.has(l.id);
        const g = s('g', { class: 'nlff-link', onclick: () => toggleCut(l.id) });
        g.append(s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'transparent', 'stroke-width': 22 }));
        g.append(s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: isDown ? 'var(--bad)' : res2 ? 'var(--blue)' : 'var(--line)', 'stroke-width': res2 ? 7 : 4, 'stroke-dasharray': isDown ? '6 6' : null, 'stroke-linecap': 'round' }));
        if (res2 && phase.kind === 'data' && !reduceMotion()) g.append(s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'var(--on-accent)', 'stroke-width': 2, 'stroke-dasharray': '4 10', 'stroke-dashoffset': String(-(t * 3) % 14) }));
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dy = l.id === 'L2' ? -10 : l.id === 'L4' ? 22 : -10, dx = l.id === 'L2' ? -22 : l.id === 'L4' ? -22 : 0;
        g.append(s('text', { x: mx + dx, y: my + dy, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--muted)', text: l.km + ' km' }));
        if (isDown) g.append(s('text', { x: mx, y: my + 6, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: 'var(--bad)', text: 'X' }));
        svg.append(g);
      });
      if (sim.mode === 'packet') {
        let shown = 0;
        for (const r of sim.recs) {
          if (r.tStart > t) break;
          if (r.noRoute) continue;
          const endT = r.lostAt != null ? r.lostAt : r.tArr;
          if (t >= endT || shown > 80) continue;
          const f = Math.min(1, (t - r.tStart) / (r.tArr - r.tStart)), a = P(r.from), b = P(r.to);
          svg.append(s('circle', { cx: a.x + (b.x - a.x) * f, cy: a.y + (b.y - a.y) * f, r: 5.5, fill: r.att > 1 ? 'var(--orange)' : 'var(--green)', stroke: 'var(--panel)', 'stroke-width': 1.5 }));
          shown++;
        }
      } else if (phase && phase.kind === 'setup') {
        // the set-up request travels hop by hop (propagation, then processing at each switch); the confirmation travels back
        const path = phase.path, el = t - phase.t0; let pos = null, acc = 0;
        for (let i = 0; i < path.length && !pos; i++) { const p = phase.props[i]; if (el < acc + p) { const f = (el - acc) / p; pos = [path[i].from, path[i].to, f]; } acc += p; if (!pos && el < acc + SW.SETUP_MS) pos = [path[i].to, path[i].to, 0]; acc += SW.SETUP_MS; }
        for (let i = path.length - 1; i >= 0 && !pos; i--) { const p = phase.props[i]; if (el < acc + p) pos = [path[i].to, path[i].from, (el - acc) / p]; acc += p; }
        if (pos && !(phase.cut && t >= phase.t1)) { const a = P(pos[0]), b = P(pos[1]); svg.append(s('rect', { x: a.x + (b.x - a.x) * pos[2] - 9, y: a.y + (b.y - a.y) * pos[2] - 9, width: 18, height: 18, rx: 3, fill: 'var(--orange)', stroke: 'var(--panel)', 'stroke-width': 1.5 })); }
      }
      Object.entries(SW.nodes).forEach(([id, n]) => {
        const host = id === 'A' || id === 'B';
        svg.append(host ? s('rect', { x: n.x - 26, y: n.y - 18, width: 52, height: 36, rx: 6, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2 }) : s('circle', { cx: n.x, cy: n.y, r: 20, fill: 'var(--panel)', stroke: 'var(--orange)', 'stroke-width': 2.5 }));
        svg.append(s('text', { x: n.x, y: n.y + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: 'var(--ink)', text: id }));
      });
      svg.append(s('text', { x: 50, y: 196, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--muted)', text: 'ผู้ส่ง' }), s('text', { x: 452, y: 196, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--muted)', text: 'ผู้รับ' }));
      let status = '';
      if (sim.mode === 'circuit') status = !phase ? '' : phase.kind === 'fail' ? 'ไม่มีเส้นทาง ตั้งวงจรไม่ได้' : phase.cut && t >= phase.t1 ? 'วงจรขาด ต้องตั้งวงจรใหม่' : phase.kind === 'setup' ? 'กำลังจองวงจร (Setup)' : t >= phase.t1 ? 'ส่งครบ วงจรรอถูกปล่อย (Teardown)' : 'ส่งข้อมูลต่อเนื่องบนวงจรที่จองไว้';
      else status = 'สีเขียว = แพ็กเก็ต, สีส้ม = แพ็กเก็ตที่ส่งซ้ำ';
      svg.append(s('text', { x: 250, y: 290, 'text-anchor': 'middle', 'font-size': 14, fill: 'var(--ink)', text: status }));
      svg.setAttribute('aria-label', 'เครือข่าย A, R1, R2, R3, B เวลา ' + fmt(t) + ' ms ' + status + ' ได้รับแล้ว ' + pct.toFixed(0) + ' เปอร์เซ็นต์');
      if (sim.mode === 'packet') {
        strip.replaceChildren(); let mx = -1;
        sim.arrivals.filter(a => a.t <= t).slice(0, 40).forEach(a => { const ooo = a.k < mx; if (!ooo) mx = a.k; strip.append(h('span', { class: ooo ? 'nlff-ooo' : null }, String(a.k + 1))); });
      }
    }
    function explain() {
      const li = x => h('li', null, x);
      const items = [];
      const p0 = swPath(new Set()), sumP = p0.reduce((a, x) => a + swProp(x.l), 0), N = p0.length;
      const brkText = breaks.length ? breaks.map(b => swLink(b.link).a + '-' + swLink(b.link).b + ' ที่ ' + fmt(b.t) + ' ms').join(', ') : '';
      let head;
      if (sim.mode === 'circuit') {
        const setup = 2 * sumP + N * SW.SETUP_MS;
        head = sim.complete ? 'ส่งครบใน ' + fmt(sim.end) + ' ms' : 'ส่งไม่ครบ: ได้ ' + sim.got.toLocaleString('en-US') + ' ไบต์';
        items.push(li('ตั้งวงจร A-R1-R2-B: สัญญาณขอจองวิ่งไปและตอบกลับ 2 x ' + fmt(sumP, 2) + ' ms + สวิตช์ ' + N + ' จุด x ' + SW.SETUP_MS + ' ms = ' + fmt(setup, 2) + ' ms'));
        items.push(li('ส่งข้อมูลบนวงจร: ' + o.bytes.toLocaleString('en-US') + ' x 8 / ' + o.rate + ' Mbps = ' + fmt(o.bytes * 8 / (o.rate * 1000), 2) + ' ms + propagation ' + fmt(sumP, 2) + ' ms (ไม่มีส่วนหัวต่อแพ็กเก็ต ไม่ต้องรอเก็บแล้วส่งต่อ)'));
        if (sim.drops) items.push(li('ลิงก์ที่ตัด: ' + brkText + ' วงจรขาด ' + sim.drops + ' ครั้ง เครือข่ายไม่หาทางใหม่ให้เอง ผู้ส่งต้องตั้งวงจรใหม่' + (sim.complete ? ' (ตั้งวงจรทั้งหมด ' + sim.setups + ' ครั้ง แล้วส่งส่วนที่เหลือต่อ)' : '')));
        else if (breaks.length) items.push(li('ลิงก์ที่ตัด (' + brkText + ') ไม่ได้อยู่บนวงจร หรือตัดหลังส่งเสร็จ จึงไม่กระทบ'));
        if (sim.failed) items.push(li('ไม่มีเส้นทางเหลือจาก A ถึง B จึงตั้งวงจรไม่ได้'));
        items.push(li('ตลอดการคุย ลิงก์บนวงจรถูกจองไว้ทั้งเส้น แม้ช่วงที่ไม่มีข้อมูลก็ให้คนอื่นใช้ไม่ได้'));
      } else {
        head = sim.complete ? 'ส่งครบใน ' + fmt(sim.end) + ' ms' : 'ส่งไม่ครบ: แพ็กเก็ตบางตัวไปไม่ถึงแม้ส่งซ้ำแล้ว';
        items.push(li('แบ่งเป็น ' + sim.P + ' แพ็กเก็ต แต่ละตัวมีส่วนหัว ' + SW.HDR + ' ไบต์ เวลาส่ง 1 แพ็กเก็ตเต็มต่อลิงก์ T = ' + (o.pay + SW.HDR) + ' x 8 / ' + o.rate + ' Mbps = ' + fmt(sim.T, 3) + ' ms'));
        const approx = (N + sim.P - 1) * sim.T + sumP;
        items.push(li('Store-and-forward: เราเตอร์รับครบทั้งแพ็กเก็ตก่อนส่งต่อ สูตรประมาณ (N + P - 1) x T + propagation = (' + N + ' + ' + sim.P + ' - 1) x ' + fmt(sim.T, 3) + ' + ' + fmt(sumP, 2) + ' = ' + fmt(approx, 2) + ' ms' + (o.bytes % o.pay ? ' (แพ็กเก็ตสุดท้ายเล็กกว่า ค่าจริงจึงน้อยกว่าเล็กน้อย)' : '')));
        if (o.ecmp) items.push(li('R1 ส่งออกทาง R3 ' + sim.viaR3 + ' ครั้ง เส้นทาง R3 ยาวกว่า 400 km แพ็กเก็ตจึงมาถึงไม่เรียงลำดับ ' + sim.reordered + ' ตัว ผู้รับต้องเรียงใหม่ก่อนส่งให้แอป'));
        else if (sim.reordered) items.push(li('มีแพ็กเก็ตมาถึงไม่เรียงลำดับ ' + sim.reordered + ' ตัว ผู้รับต้องเรียงใหม่'));
        if (breaks.length) items.push(li('ลิงก์ที่ตัด: ' + brkText + ' แพ็กเก็ตที่อยู่บนลิงก์หรือรอคิวลิงก์นั้นหาย ' + sim.lost + ' ครั้ง เราเตอร์ส่งตัวต่อไปทางอื่นทันที (สมมติว่าเลือกเส้นทางใหม่ได้ทันที) ส่วนตัวที่หายผู้ส่งส่งซ้ำ ' + sim.retx + ' ครั้งหลังรอ ' + SW.RTO + ' ms'));
        if (sim.failed) items.push(li('ไม่มีเส้นทางจาก A ถึง B แพ็กเก็ต ' + sim.failed + ' ตัวส่งไม่สำเร็จหลังลอง 4 ครั้ง'));
      }
      res.replaceChildren(h('h4', null, (sim.mode === 'circuit' ? 'Circuit switching: ' : 'Packet switching: ') + head), h('ul', null, items));
      const cTime = sim.mode === 'circuit' ? sim : other, pTime = sim.mode === 'packet' ? sim : other;
      const tx = x => x.complete ? fmt(x.end) + ' ms' : 'ส่งไม่ครบ';
      cmp.textContent = 'เทียบด้วยค่าชุดเดียวกัน' + (breaks.length ? ' และตัดลิงก์เหมือนกัน' : '') + ': Circuit ' + tx(cTime) + ' · Packet ' + tx(pTime) + ' (สมมติว่าทุกลิงก์ว่าง ไม่มีผู้ใช้อื่น ความเร็วสัญญาณ 5 ไมโครวินาทีต่อกิโลเมตร)';
    }
    rerun(true);
  }

  /* ===================================================================
     transport-lab: TCP state machines vs UDP with loss, delay and jitter
     =================================================================== */
  const TL = { MSS: 100, GAP: 5, ISSC: 1000, ISSS: 5000, APP: 10, MAXTRY: 8, RTOMAX: 60000 };
  function segLabel(g) {
    if (g.udp) return 'Datagram #' + g.idx;
    if (g.rst) return 'RST';
    if (g.syn && g.ack) return 'SYN, ACK seq=' + g.seq + ' ack=' + g.ackNo;
    if (g.syn) return 'SYN seq=' + g.seq;
    if (g.fin) return 'FIN, ACK seq=' + g.seq + ' ack=' + g.ackNo;
    if (g.len) return 'ข้อมูล #' + g.idx + ' seq=' + g.seq + ' (' + g.len + ' ไบต์)';
    return 'ACK ack=' + g.ackNo;
  }
  function segShort(g) {
    if (g.udp) return '#' + g.idx;
    if (g.rst) return 'RST';
    if (g.syn && g.ack) return 'SYN,ACK a=' + g.ackNo;
    if (g.syn) return 'SYN s=' + g.seq;
    if (g.fin) return 'FIN s=' + g.seq;
    if (g.len) return '#' + g.idx + ' s=' + g.seq;
    return 'ACK a=' + g.ackNo;
  }
  function tcpSim(o) {
    const { MSS, GAP, ISSC, ISSS, APP, MAXTRY } = TL;
    const RTO0 = 4 * (o.lat + o.jit), TW = 3 * RTO0, DATAEND = ISSC + 1 + o.n * MSS;
    const H = Heap(), segs = [], ev = [], cnt = {};
    const mk = (id, name, state, iss) => ({ id, name, state, free: 0, timer: 0, armed: false, rto: RTO0, tries: 0, sndUna: iss, sndNxt: iss, rcvNxt: 0, dup: 0, finSeq: null });
    const C = mk('C', 'Client', 'CLOSED', ISSC), S = mk('S', 'Server', 'LISTEN', ISSS);
    C.next = 0; C.tw = 0; S.buf = new Map(); S.got = [];
    const st = { timeouts: 0, fast: 0, dupAcks: 0, retx: 0, aborted: false, allAt: null };
    const snap = (t, text, kind, seg) => ev.push({ t, text, kind, seg: seg ? seg.id : null, c: C.state, s: S.state, got: S.got.slice() });
    function setState(hh, v, t, why) { if (hh.state === v) return; hh.state = v; snap(t, hh.name + ' เปลี่ยนสถานะเป็น ' + v + (why ? ' (' + why + ')' : ''), 'state'); }
    function send(hh, f, t) {
      const depart = Math.max(t, hh.free); hh.free = depart + GAP;
      const k = hh.id + ':' + f.kind; cnt[k] = (cnt[k] || 0) + 1; const key = k + ':' + cnt[k];
      const first = cnt[k] === 1;
      const manual = first && ((hh.id === 'C' && f.len && o.drops.has(f.idx)) || (o.dropLastAck && f.kind === 'ACKFIN'));
      const lost = manual || rnd(o.seed, key) < o.loss / 100;
      const delay = Math.max(1, o.lat + (rnd(o.seed, key + ':d') * 2 - 1) * o.jit);
      const g = Object.assign({ id: segs.length, from: hh.id, depart, arr: depart + delay, lost, manual, again: !first }, f);
      g.label = segLabel(g); g.short = segShort(g);
      if (!first && f.kind !== 'ACKH' && !/^ACK/.test(f.kind)) st.retx++;
      segs.push(g); H.push({ t: depart, kind: 'tx', g });
      return g;
    }
    function arm(hh, t) { hh.timer++; hh.armed = true; H.push({ t: t + hh.rto, kind: 'rto', hh, id: hh.timer }); }
    function disarm(hh) { hh.timer++; hh.armed = false; }
    function fresh(hh) { hh.rto = RTO0; hh.tries = 0; }
    function fill(t) {
      if (C.state !== 'ESTABLISHED') return;
      while (C.next < o.n && C.sndNxt < C.sndUna + o.win * MSS) {
        const i = ++C.next;
        const g = send(C, { kind: 'DATA' + i, ack: true, seq: C.sndNxt, ackNo: C.rcvNxt, len: MSS, idx: i }, t);
        C.sndNxt += MSS; if (!C.armed) arm(C, g.depart);
      }
      if (C.sndUna === DATAEND && C.finSeq == null) {
        C.finSeq = C.sndNxt; C.sndNxt += 1;
        const g = send(C, { kind: 'FIN', fin: true, ack: true, seq: C.finSeq, ackNo: C.rcvNxt, len: 0 }, t);
        setState(C, 'FIN-WAIT-1', t, 'ข้อมูลได้รับ ACK ครบ แอปจึงสั่งปิด'); arm(C, g.depart);
      }
    }
    function cRetx(t) {
      let f = null;
      if (C.state === 'SYN-SENT') f = { kind: 'SYN', syn: true, seq: ISSC, len: 0 };
      else if (C.sndUna < DATAEND) { const i = (C.sndUna - ISSC - 1) / MSS + 1; f = { kind: 'DATA' + i, ack: true, seq: C.sndUna, ackNo: C.rcvNxt, len: MSS, idx: i }; }
      else if (C.finSeq != null && C.sndUna <= C.finSeq) f = { kind: 'FIN', fin: true, ack: true, seq: C.finSeq, ackNo: C.rcvNxt, len: 0 };
      return f ? send(C, f, t) : null;
    }
    function sRetx(t) {
      if (S.state === 'SYN-RECEIVED') return send(S, { kind: 'SYNACK', syn: true, ack: true, seq: ISSS, ackNo: S.rcvNxt, len: 0 }, t);
      if (S.state === 'LAST-ACK') return send(S, { kind: 'FIN', fin: true, ack: true, seq: S.finSeq, ackNo: S.rcvNxt, len: 0 }, t);
      return null;
    }
    function cRecv(g, t) {
      if (C.state === 'CLOSED') { if (!g.rst) { snap(t, 'Client ปิดไปแล้ว ไม่มีการเชื่อมต่อนี้ จึงตอบ RST', 'info'); send(C, { kind: 'RST', rst: true, seq: g.ackNo || 0, len: 0 }, t); } return; }
      if (g.syn && g.ack) {
        if (C.state === 'SYN-SENT' && g.ackNo === ISSC + 1) {
          C.rcvNxt = g.seq + 1; C.sndUna = ISSC + 1; fresh(C); disarm(C);
          setState(C, 'ESTABLISHED', t, 'ได้รับ SYN, ACK');
          send(C, { kind: 'ACKH', ack: true, seq: C.sndNxt, ackNo: C.rcvNxt, len: 0 }, t); fill(t);
        } else { snap(t, 'Client ได้ SYN, ACK ซ้ำ แปลว่า ACK ของ handshake หาย จึงส่ง ACK อีกครั้ง', 'info'); send(C, { kind: 'ACKH', ack: true, seq: C.sndNxt, ackNo: C.rcvNxt, len: 0 }, t); }
        return;
      }
      if (g.ack) {
        if (g.ackNo > C.sndUna) {
          C.sndUna = g.ackNo; C.dup = 0; fresh(C);
          if (C.sndUna < C.sndNxt) arm(C, t); else disarm(C);
          if (C.finSeq != null && C.sndUna === C.finSeq + 1) {
            if (C.state === 'FIN-WAIT-1') setState(C, 'FIN-WAIT-2', t, 'Server ตอบรับ FIN แล้ว รอ FIN ของ Server');
            else if (C.state === 'CLOSING') { setState(C, 'TIME-WAIT', t, 'FIN ของเราได้รับ ACK'); C.tw++; H.push({ t: t + TW, kind: 'tw', id: C.tw }); }
          }
          fill(t);
        } else if (g.ackNo === C.sndUna && C.sndUna < C.sndNxt && !g.len && !g.fin) {
          C.dup++; st.dupAcks++;
          if (C.dup === 3) { st.fast++; snap(t, 'Client ได้ ACK ซ้ำ ack=' + g.ackNo + ' ครบ 3 ครั้ง ส่งซ้ำทันทีโดยไม่รอหมดเวลา (Fast Retransmit)', 'timeout'); const g2 = cRetx(t); if (g2) arm(C, g2.depart); }
        }
      }
      if (g.fin) {
        if (g.seq === C.rcvNxt) {
          C.rcvNxt++;
          if (C.state === 'FIN-WAIT-2') { setState(C, 'TIME-WAIT', t, 'ได้รับ FIN ของ Server'); C.tw++; H.push({ t: t + TW, kind: 'tw', id: C.tw }); }
          else if (C.state === 'FIN-WAIT-1') setState(C, 'CLOSING', t, 'ได้ FIN ก่อน ACK ของ FIN ตัวเอง');
          send(C, { kind: 'ACKFIN', ack: true, seq: C.sndNxt, ackNo: C.rcvNxt, len: 0 }, t);
        } else if (C.state === 'TIME-WAIT' && g.seq === C.rcvNxt - 1) {
          snap(t, 'Client อยู่ใน TIME-WAIT ได้ FIN ซ้ำ (ACK ก่อนหน้าหาย) จึงตอบ ACK อีกครั้งและนับเวลารอใหม่', 'info');
          send(C, { kind: 'ACKFIN', ack: true, seq: C.sndNxt, ackNo: C.rcvNxt, len: 0 }, t); C.tw++; H.push({ t: t + TW, kind: 'tw', id: C.tw });
        }
      }
    }
    function accept(g, t) {
      if (g.len) { S.got.push(g.idx); S.rcvNxt += g.len; snap(t, 'Server ส่งข้อมูล #' + g.idx + ' ให้แอป (ตามลำดับ) รอ seq ถัดไป = ' + S.rcvNxt, 'deliver'); if (S.got.length === o.n) st.allAt = t; }
      if (g.fin) { S.rcvNxt += 1; setState(S, 'CLOSE-WAIT', t, 'ได้รับ FIN ของ Client'); H.push({ t: t + APP, kind: 'close' }); }
    }
    function sRecv(g, t) {
      if (g.rst) { disarm(S); setState(S, 'CLOSED', t, 'ได้รับ RST'); return; }
      if (S.state === 'CLOSED') return;
      if (g.syn && !g.ack) {
        if (S.state === 'LISTEN') { S.rcvNxt = g.seq + 1; setState(S, 'SYN-RECEIVED', t, 'ได้รับ SYN'); S.sndNxt = ISSS + 1; const g2 = send(S, { kind: 'SYNACK', syn: true, ack: true, seq: ISSS, ackNo: S.rcvNxt, len: 0 }, t); arm(S, g2.depart); }
        else if (S.state === 'SYN-RECEIVED') { snap(t, 'Server ได้ SYN ซ้ำ จึงส่ง SYN, ACK อีกครั้ง', 'info'); send(S, { kind: 'SYNACK', syn: true, ack: true, seq: ISSS, ackNo: S.rcvNxt, len: 0 }, t); }
        return;
      }
      if (g.ack && S.state === 'SYN-RECEIVED' && g.ackNo === ISSS + 1) { S.sndUna = ISSS + 1; fresh(S); disarm(S); setState(S, 'ESTABLISHED', t, g.len ? 'ข้อมูลที่มาถึงมี ACK ของ SYN, ACK ติดมาด้วย' : 'ได้รับ ACK ตัวสุดท้ายของ handshake'); }
      if (g.ack && S.state === 'LAST-ACK' && g.ackNo === S.finSeq + 1) { disarm(S); setState(S, 'CLOSED', t, 'ได้รับ ACK ของ FIN'); return; }
      if (S.state === 'LISTEN' || S.state === 'SYN-RECEIVED') return;
      if (!g.len && !g.fin) return;   // pure ACK: nothing to deliver
      if (g.seq === S.rcvNxt) {
        accept(g, t); let nx;
        while ((nx = S.buf.get(S.rcvNxt))) { S.buf.delete(S.rcvNxt); snap(t, 'Server ดึงข้อมูล #' + nx.idx + ' ที่รออยู่ในบัฟเฟอร์', 'info'); accept(nx, t); }
      } else if (g.seq > S.rcvNxt) {
        if (!S.buf.has(g.seq)) S.buf.set(g.seq, g);
        snap(t, 'Server ได้ ' + (g.len ? 'ข้อมูล #' + g.idx : 'FIN') + ' ก่อนลำดับ (ยังรอ seq=' + S.rcvNxt + ') เก็บไว้ในบัฟเฟอร์ ยังไม่ส่งให้แอป', 'buf');
      } else snap(t, 'Server ได้ ' + (g.len ? 'ข้อมูล #' + g.idx : 'FIN') + ' ซ้ำ (เคยรับแล้ว) ทิ้งไป', 'dup');
      send(S, { kind: 'ACK' + S.rcvNxt, ack: true, seq: S.sndNxt, ackNo: S.rcvNxt, len: 0 }, t);   // cumulative ACK for every data/FIN segment
    }
    C.state = 'SYN-SENT'; C.sndNxt = ISSC + 1;
    snap(0, 'แอป Client สั่งเชื่อมต่อ: Client ส่ง SYN และเข้าสู่ SYN-SENT ส่วน Server รออยู่ที่ LISTEN', 'state');
    const g0 = send(C, { kind: 'SYN', syn: true, seq: ISSC, len: 0 }, 0); arm(C, g0.depart);
    let guard = 0;
    while (H.size && guard++ < 6000) {
      const e = H.pop(), t = e.t;
      if (e.kind === 'tx') {
        const g = e.g, who = g.from === 'C' ? 'Client' : 'Server';
        snap(t, who + ' ส่ง ' + g.label + (g.again && (g.len || g.syn || g.fin) ? ' (ส่งซ้ำ)' : ''), 'send', g);
        H.push(g.lost ? { t: (g.depart + g.arr) / 2, kind: 'lost', g } : { t: g.arr, kind: 'arr', g });
      } else if (e.kind === 'lost') snap(t, e.g.label + ' หายระหว่างทาง' + (e.g.manual ? ' (นักเรียนสั่งทิ้ง)' : ''), 'lost', e.g);
      else if (e.kind === 'arr') { const g = e.g; snap(t, (g.from === 'C' ? 'Server' : 'Client') + ' ได้รับ ' + g.label, 'arr', g); if (g.from === 'C') sRecv(g, t); else cRecv(g, t); }
      else if (e.kind === 'rto') {
        const hh = e.hh; if (e.id !== hh.timer || !hh.armed) continue;
        st.timeouts++; hh.tries++;
        if (hh.tries > TL.MAXTRY) { st.aborted = true; snap(t, hh.name + ' ส่งซ้ำครบ ' + TL.MAXTRY + ' ครั้งแล้วไม่สำเร็จ จึงยกเลิกการเชื่อมต่อ', 'timeout'); disarm(C); disarm(S); setState(C, 'CLOSED', t); setState(S, 'CLOSED', t); break; }
        snap(t, hh.name + ' หมดเวลารอ ACK (RTO = ' + Math.round(hh.rto) + ' ms) ส่งซ้ำตัวที่เก่าที่สุดที่ยังไม่ได้ ACK แล้วเพิ่ม RTO เป็น 2 เท่า (ไม่เกิน 60 วินาที)', 'timeout');
        hh.rto = Math.min(TL.RTOMAX, hh.rto * 2);
        const g = hh === C ? cRetx(t) : sRetx(t);
        if (g) arm(hh, g.depart); else hh.armed = false;
      } else if (e.kind === 'close') {
        if (S.state !== 'CLOSE-WAIT') continue;
        S.finSeq = S.sndNxt; S.sndNxt += 1;
        setState(S, 'LAST-ACK', t, 'แอปฝั่ง Server ปิดบ้าง จึงส่ง FIN ของตัวเอง');
        const g = send(S, { kind: 'FIN', fin: true, ack: true, seq: S.finSeq, ackNo: S.rcvNxt, len: 0 }, t); arm(S, g.depart);
      } else if (e.kind === 'tw') { if (e.id === C.tw && C.state === 'TIME-WAIT') setState(C, 'CLOSED', t, 'รอครบ 2 x MSL'); }
    }
    return { proto: 'tcp', segs, ev, got: S.got.slice(), st, RTO0, TW, end: ev.length ? ev[ev.length - 1].t : 0 };
  }
  function udpSim(o) {
    const segs = [], items = [];
    for (let i = 1; i <= o.n; i++) {
      const key = 'C:DATA' + i + ':1', depart = (i - 1) * TL.GAP, manual = o.drops.has(i);
      const lost = manual || rnd(o.seed, key) < o.loss / 100, delay = Math.max(1, o.lat + (rnd(o.seed, key + ':d') * 2 - 1) * o.jit);
      const g = { id: segs.length, from: 'C', udp: true, idx: i, depart, arr: depart + delay, lost, manual, len: TL.MSS };
      g.label = segLabel(g); g.short = segShort(g); segs.push(g);
      items.push({ t: depart, o: 2 * i, kind: 'tx', g }, { t: lost ? depart + delay / 2 : depart + delay, o: 2 * i + 1, kind: lost ? 'lost' : 'arr', g });
    }
    items.sort((a, b) => a.t - b.t || a.o - b.o);
    const got = [], ev = [{ t: 0, text: 'UDP ไม่มีการเชื่อมต่อและไม่มีสถานะ Client ส่ง Datagram ได้ทันที Server เพียงเปิดซ็อกเก็ตรอที่พอร์ตปลายทาง', kind: 'state', seg: null, c: '-', s: '-', got: [] }];
    items.forEach(it => {
      const g = it.g;
      if (it.kind === 'tx') ev.push({ t: it.t, text: 'Client ส่ง ' + g.label + ' ทันที ไม่รอ ACK', kind: 'send', seg: g.id, c: '-', s: '-', got: got.slice() });
      else if (it.kind === 'lost') ev.push({ t: it.t, text: g.label + ' หายระหว่างทาง' + (g.manual ? ' (นักเรียนสั่งทิ้ง)' : '') + ' ไม่มีใครส่งซ้ำ', kind: 'lost', seg: g.id, c: '-', s: '-', got: got.slice() });
      else { got.push(g.idx); ev.push({ t: it.t, text: 'Server ได้รับ ' + g.label + ' ส่งให้แอปทันทีตามลำดับที่มาถึง', kind: 'arr', seg: g.id, c: '-', s: '-', got: got.slice() }); }
    });
    let mx = 0, ooo = 0; got.forEach(k => { if (k < mx) ooo++; else mx = k; });
    return { proto: 'udp', segs, ev, got, st: { lost: segs.filter(g => g.lost).length, ooo }, end: ev[ev.length - 1].t };
  }
  const APPS = [
    ['โทรศัพท์ผ่านอินเทอร์เน็ต (VoIP)', 'udp', 'เสียงต้องมาตรงจังหวะ แพ็กเก็ตที่มาช้ากว่ากำหนดเล่นก็ใช้ไม่ได้แล้ว การรอส่งซ้ำแบบ TCP ทำให้เสียงสะดุดมากกว่า VoIP จึงส่งเสียงด้วย RTP บน UDP'],
    ['ดาวน์โหลดไฟล์ติดตั้งโปรแกรม', 'tcp', 'ไฟล์ขาดหรือสลับลำดับแม้ไบต์เดียวก็ใช้งานไม่ได้ ต้องครบและเรียงถูกต้อง จึงใช้ TCP (เช่น HTTPS หรือ FTP)'],
    ['ถามชื่อเว็บจาก DNS Server', 'udp', 'คำถามและคำตอบสั้นแค่ไปกลับครั้งเดียว ถ้าหายก็ถามใหม่ ไม่คุ้มที่จะเปิดการเชื่อมต่อ จึงใช้ UDP พอร์ต 53 (ใช้ TCP 53 เมื่อคำตอบใหญ่เกินหรือโอนข้อมูลทั้งโซน)'],
    ['เกมออนไลน์ส่งตำแหน่งผู้เล่น', 'udp', 'ตำแหน่งล่าสุดสำคัญกว่าตำแหน่งเก่าที่หายไป เกมส่วนใหญ่ส่งข้อมูลนี้ด้วย UDP แล้วจัดการความถูกต้องเองเท่าที่จำเป็น (ส่วนแชตหรือการซื้อไอเทมอาจใช้ TCP)'],
    ['เปิดหน้าเว็บร้านค้าออนไลน์', 'tcp', 'HTML รูป และสคริปต์ต้องครบถูกต้อง HTTP/1.1 และ HTTP/2 จึงใช้ TCP พอร์ต 443 ส่วน HTTP/3 ใช้ QUIC ซึ่งวิ่งบน UDP แต่ทำการส่งซ้ำและเรียงลำดับเองแทน TCP']
  ];
  function transportLab(root) {
    frame(root, 'nlff-tl', 'แล็บชั้น Transport: TCP เทียบ UDP', 'เลือก TCP หรือ UDP ตั้งจำนวนข้อมูล โอกาสสูญหาย และความหน่วง แล้วกด "ถัดไป" ทีละเหตุการณ์ ดูสถานะของ Client และ Server เลข seq/ack และสิ่งที่แอปฝั่ง Server ได้รับ ลองกดปุ่ม "ทิ้ง #" เพื่อทำให้ข้อมูลชิ้นนั้นหายในการส่งครั้งแรก แล้วสลับ TCP/UDP ด้วยค่าชุดเดียวกัน');
    const o = { proto: 'tcp', n: 5, loss: 0, lat: 50, jit: 20, win: 4, seed: 1, drops: new Set([3]), dropLastAck: false };
    let sim = null, i = 0, timer = null;
    const protoSeg = segButtons([['tcp', 'TCP'], ['udp', 'UDP']], o.proto, v => { o.proto = v; rerun(); }, 'เลือกโปรโตคอล');
    const sN = slider('จำนวนข้อมูล', 3, 8, 1, o.n, ' ชิ้น', v => { o.n = v; [...o.drops].forEach(k => { if (k > v) o.drops.delete(k); }); chips(); rerun(); });
    const sL = slider('โอกาสสูญหายแบบสุ่ม', 0, 50, 5, o.loss, '%', v => { o.loss = v; rerun(); });
    const sD = slider('ความหน่วงทางเดียว', 10, 200, 10, o.lat, ' ms', v => { o.lat = v; rerun(); });
    const sJ = slider('ความแปรปรวน (Jitter) ±', 0, 100, 5, o.jit, ' ms', v => { o.jit = v; rerun(); });
    const win = h('select', { 'aria-label': 'ขนาดหน้าต่าง', onchange: e => { o.win = Number(e.target.value); rerun(); } }, [[1, '1 เซกเมนต์ (ส่งทีละชิ้น รอ ACK)'], [2, '2 เซกเมนต์'], [4, '4 เซกเมนต์']].map(([v, t]) => h('option', { value: v, selected: v === o.win }, t)));
    const winL = h('label', null, h('span', null, 'หน้าต่าง TCP (ส่งได้ก่อนรอ ACK)'), win);
    const seedOut = h('b', null, String(o.seed));
    const reseed = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { o.seed++; seedOut.textContent = String(o.seed); rerun(); } }, 'สุ่มชุดใหม่');
    const chipBox = h('div', { class: 'nlff-chips', role: 'group', 'aria-label': 'เลือกข้อมูลที่จะทิ้งในการส่งครั้งแรก' });
    const ackBox = h('label', { class: 'nlw-check' }, h('input', { type: 'checkbox', onchange: e => { o.dropLastAck = e.target.checked; rerun(); } }), 'ทิ้ง ACK ตัวสุดท้ายของการปิด (ดูว่า TIME-WAIT ช่วยอะไร)');
    function chips() { chipBox.replaceChildren(...Array.from({ length: o.n }, (_, k) => h('button', { type: 'button', class: 'nlw-btn', 'aria-pressed': String(o.drops.has(k + 1)), onclick: e => { if (o.drops.has(k + 1)) o.drops.delete(k + 1); else o.drops.add(k + 1); e.currentTarget.setAttribute('aria-pressed', String(o.drops.has(k + 1))); rerun(); } }, 'ทิ้ง #' + (k + 1)))); }
    chips();
    const cardC = h('b'), cardS = h('b'), cardG = h('div', { class: 'nlff-strip' });
    const prev = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { stop(); if (i > 0) { i--; render(); } } }, '◀ ก่อนหน้า');
    const next = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: () => { stop(); if (i < sim.ev.length - 1) { i++; render(); } } }, 'ถัดไป ▶');
    const toEnd = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { stop(); i = sim.ev.length - 1; render(); } }, 'ไปท้ายสุด');
    const restart = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { stop(); i = 0; render(); } }, 'เริ่มใหม่');
    const auto = h('button', { type: 'button', class: 'nlw-btn', 'aria-pressed': 'false', onclick: () => (timer ? stop() : startAuto()) }, 'เล่นอัตโนมัติ');
    if (reduceMotion()) auto.hidden = true;
    const counter = h('span', { class: 'nlff-count' });
    const now = h('div', { class: 'nlff-desc', 'aria-live': 'polite' });
    const ladderBox = h('div', { class: 'nlff-ladder', tabindex: '0', role: 'region', 'aria-label': 'แผนภาพลำดับการส่ง (เลื่อนดูได้)' });
    const logBody = h('tbody');
    const sum = h('div', { class: 'nlff-desc' });
    root.append(protoSeg, h('div', { class: 'nlff-ctl' }, sN.el, sL.el, sD.el, sJ.el, winL), h('div', { class: 'nlff-row' }, reseed, h('span', { class: 'nlw-small' }, 'ชุดสุ่มที่ ', seedOut)),
      h('div', { class: 'nlw-small' }, 'ทิ้งข้อมูลในการส่งครั้งแรก (ใช้ผลเดียวกันทั้ง TCP และ UDP):'), chipBox, ackBox,
      h('div', { class: 'nlff-cards' }, h('div', { class: 'nlff-card' }, h('small', null, 'สถานะ Client'), cardC), h('div', { class: 'nlff-card' }, h('small', null, 'สถานะ Server'), cardS)),
      h('div', { class: 'nlw-small' }, 'ข้อมูลที่แอปฝั่ง Server ได้รับ (เรียงตามที่ได้รับจริง):'), cardG,
      h('div', { class: 'nlff-row' }, prev, next, toEnd, restart, auto, counter), now, ladderBox,
      h('details', null, h('summary', null, 'ดูบันทึกเหตุการณ์ทั้งหมด'), h('div', { class: 'nlff-log', tabindex: '0', role: 'region', 'aria-label': 'บันทึกเหตุการณ์ทั้งหมด (เลื่อนดูได้)' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'เวลา (ms)'), h('th', null, 'เหตุการณ์'))), logBody))), sum);
    function startAuto() { if (i >= sim.ev.length - 1) i = 0; auto.textContent = 'หยุด'; auto.setAttribute('aria-pressed', 'true'); timer = setInterval(() => { if (i < sim.ev.length - 1) { i++; render(); } else stop(); }, 1100); }
    function stop() { if (timer) clearInterval(timer); timer = null; auto.textContent = 'เล่นอัตโนมัติ'; auto.setAttribute('aria-pressed', 'false'); }
    whenRemoved(root, stop);
    function rerun() {
      stop();
      winL.hidden = o.proto !== 'tcp'; ackBox.hidden = o.proto !== 'tcp';
      sim = o.proto === 'tcp' ? tcpSim(o) : udpSim(o);
      i = 0;
      logBody.replaceChildren(...sim.ev.map(e => h('tr', null, h('td', null, fmt(e.t)), h('td', null, e.text))));
      summary(); render();
    }
    function summary() {
      const li = x => h('li', null, x);
      if (sim.proto === 'tcp') {
        const st = sim.st, ok = sim.got.length === o.n;
        sum.replaceChildren(h('h4', null, 'สรุป TCP: ' + (st.aborted ? 'ยกเลิกการเชื่อมต่อเพราะส่งซ้ำไม่สำเร็จ' : ok ? 'แอปได้รับครบ ' + o.n + ' ชิ้น เรียงลำดับถูกต้อง' : 'ยังได้รับไม่ครบ')),
          h('ul', null,
            li('ส่งทั้งหมด ' + sim.segs.length + ' เซกเมนต์ ส่งซ้ำ ' + st.retx + ' ครั้ง (หมดเวลา ' + st.timeouts + ' ครั้ง, Fast Retransmit ' + st.fast + ' ครั้ง)'),
            li('RTO เริ่มต้นในแล็บ = 2 x RTT สูงสุด = ' + Math.round(sim.RTO0) + ' ms และเพิ่มเป็น 2 เท่าทุกครั้งที่หมดเวลา (ของจริงคำนวณจาก RTT ที่วัดได้ตาม RFC 6298)'),
            st.allAt != null ? li('ข้อมูลครบที่เวลา ' + fmt(st.allAt) + ' ms รวมทั้งเปิดและปิดการเชื่อมต่อใช้ ' + fmt(sim.end) + ' ms (TIME-WAIT ในแล็บย่อเหลือ ' + Math.round(sim.TW) + ' ms ของจริงนาน 30 วินาทีถึง 4 นาที)') : null,
            li('ACK ของ TCP เป็นแบบสะสม (Cumulative): ack=1301 หมายถึง "ได้ครบถึงไบต์ 1300 แล้ว ต้องการ 1301 ต่อ"')));
      } else {
        const st = sim.st;
        sum.replaceChildren(h('h4', null, 'สรุป UDP: ได้รับ ' + sim.got.length + ' จาก ' + o.n + ' ชิ้น'),
          h('ul', null, li('หาย ' + st.lost + ' ชิ้น ไม่มีการส่งซ้ำ และไม่มีใครรู้ว่าหาย เว้นแต่แอปจะตรวจเอง'), li('มาถึงสลับลำดับ ' + st.ooo + ' ครั้ง แอปได้รับตามลำดับที่มาถึง: ' + (sim.got.join(', ') || '-')), li('ไม่มี handshake ไม่มีการปิด จึงเริ่มส่งได้ทันทีและส่วนหัวเล็ก (8 ไบต์)')));
      }
    }
    const CX = 100, SX = 360;
    function yMap() {
      const times = [...new Set(sim.ev.map(e => e.t))].sort((a, b) => a - b), Y = new Map(); let y = 56, prevT = null;
      times.forEach(t => { if (prevT != null) y += Math.min(36, Math.max(21, (t - prevT) * 0.45)); Y.set(t, y); prevT = t; });
      return { Y, end: y + 30 };
    }
    function render() {
      const e = sim.ev[i];
      counter.textContent = 'เหตุการณ์ ' + (i + 1) + ' / ' + sim.ev.length;
      prev.disabled = i === 0; next.disabled = i === sim.ev.length - 1;
      cardC.textContent = sim.proto === 'tcp' ? e.c : 'ไม่มีสถานะ (UDP)'; cardS.textContent = sim.proto === 'tcp' ? e.s : 'ไม่มีสถานะ (UDP)';
      cardG.replaceChildren(...(e.got.length ? e.got.map((k, j) => h('span', { class: e.got.slice(0, j).some(x => x > k) ? 'nlff-ooo' : 'nlff-okc' }, '#' + k)) : [h('span', { class: 'nlff-miss' }, 'ยังไม่มี')]));
      now.replaceChildren(h('h4', null, 't = ' + fmt(e.t) + ' ms'), h('p', { style: 'margin:0' }, e.text));
      [...logBody.children].forEach((tr, j) => tr.classList.toggle('nlff-cur', j === i));
      // ladder
      const { Y, end } = yMap(), tNow = e.t, yNow = Y.get(tNow);
      const svg = s('svg', { viewBox: '0 0 460 ' + end, role: 'img', 'aria-label': 'แผนภาพลำดับเวลา Client และ Server ถึงเหตุการณ์ที่ ' + (i + 1) });
      svg.append(s('defs', null, s('marker', { id: 'tl-a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0L10 5L0 10Z', fill: 'var(--blue)' })), s('marker', { id: 'tl-g', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0L10 5L0 10Z', fill: 'var(--green)' }))));
      svg.append(s('text', { x: CX, y: 22, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: 'var(--ink)', text: 'Client' }), s('text', { x: SX, y: 22, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: 'var(--ink)', text: 'Server' }));
      svg.append(s('text', { x: CX, y: 40, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--muted)', text: ':50123' }), s('text', { x: SX, y: 40, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--muted)', text: ':9000' }));
      svg.append(s('line', { x1: CX, y1: 46, x2: CX, y2: end, stroke: 'var(--muted)', 'stroke-dasharray': '4 6' }), s('line', { x1: SX, y1: 46, x2: SX, y2: end, stroke: 'var(--muted)', 'stroke-dasharray': '4 6' }));
      svg.append(s('line', { x1: 0, y1: yNow, x2: 460, y2: yNow, stroke: 'var(--orange)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' }));
      const shownTx = new Set(), done = new Set(), lostSeen = new Set();
      sim.ev.slice(0, i + 1).forEach(x => { if (x.seg == null) return; if (x.kind === 'send') shownTx.add(x.seg); if (x.kind === 'arr') done.add(x.seg); if (x.kind === 'lost') lostSeen.add(x.seg); });
      sim.segs.forEach(g => {
        if (!shownTx.has(g.id)) return;
        const fromC = g.from === 'C', x1 = fromC ? CX : SX, x2 = fromC ? SX : CX, y1 = Y.get(g.depart);
        const tEnd = g.lost ? (g.depart + g.arr) / 2 : g.arr;
        const fin = g.lost ? lostSeen.has(g.id) : done.has(g.id);
        const frac = fin ? (g.lost ? 0.5 : 1) : Math.max(0.04, Math.min(g.lost ? 0.5 : 1, (tNow - g.depart) / (g.arr - g.depart)));
        const yEnd = fin ? Y.get(tEnd) : y1 + (yNow - y1);
        const xE = x1 + (x2 - x1) * frac, col = fromC ? 'var(--blue)' : 'var(--green)';
        svg.append(s('line', { x1, y1, x2: xE, y2: yEnd, stroke: g.lost ? 'var(--bad)' : col, 'stroke-width': 2.2, 'stroke-dasharray': g.lost ? '5 4' : null, 'marker-end': g.lost || !fin ? null : 'url(#tl-' + (fromC ? 'a' : 'g') + ')' }));
        if (g.lost && fin) svg.append(s('text', { x: xE, y: yEnd + 6, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: 'var(--bad)', text: 'X' }));
        svg.append(s('text', { x: fromC ? x1 + 8 : x1 - 8, y: y1 - 4, 'text-anchor': fromC ? 'start' : 'end', 'font-size': 12.5, fill: g.lost ? 'var(--bad)' : 'var(--ink)', stroke: 'var(--panel)', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round', 'font-family': 'JetBrains Mono,Consolas,monospace', text: g.short + (g.again && (g.len || g.syn || g.fin) ? ' (ซ้ำ)' : '') }));
      });
      if (sim.proto === 'tcp') {
        let lc = null, ls = null;
        sim.ev.slice(0, i + 1).forEach(x => {
          const y = Y.get(x.t);
          if (x.c !== lc) { svg.append(s('text', { x: CX - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 11, 'font-weight': 700, fill: x.c === 'ESTABLISHED' ? 'var(--green)' : 'var(--blue)', text: x.c })); lc = x.c; }
          if (x.s !== ls) { svg.append(s('text', { x: SX + 6, y: y + 4, 'text-anchor': 'start', 'font-size': 11, 'font-weight': 700, fill: x.s === 'ESTABLISHED' ? 'var(--green)' : 'var(--blue)', text: x.s })); ls = x.s; }
        });
      }
      ladderBox.replaceChildren(svg);
      const sc = ladderBox.clientHeight ? yNow * (ladderBox.clientWidth / 460) - ladderBox.clientHeight / 2 : 0;
      if (ladderBox.clientHeight) ladderBox.scrollTop = Math.max(0, sc);
    }
    // app choice exercise
    const picks = {};
    const fbs = [];
    const rows = APPS.map(([name], k) => {
      const fb = h('p', { class: 'nlff-fb', 'aria-live': 'polite' }); fbs.push(fb);
      return h('div', { class: 'nlff-q' }, h('span', null, (k + 1) + '. ' + name), segButtons([['tcp', 'TCP'], ['udp', 'UDP']], null, v => { picks[k] = v; fb.textContent = ''; }, 'โปรโตคอลสำหรับ ' + name), fb);
    });
    const score = h('p', { class: 'nlff-count', 'aria-live': 'polite' });
    const check = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: () => {
      let ok = 0;
      APPS.forEach(([, ans, why], k) => {
        const p = picks[k]; fbs[k].className = 'nlff-fb ' + (p === ans ? 'nlff-ok' : 'nlff-bad');
        if (p === ans) ok++;
        fbs[k].textContent = (p == null ? 'ยังไม่ได้เลือก: ' : p === ans ? 'ถูก: ' : 'ยังไม่ถูก (ควรเป็น ' + ans.toUpperCase() + '): ') + why;
      });
      score.textContent = 'ได้ ' + ok + ' / ' + APPS.length + ' ข้อ';
    } }, 'ตรวจคำตอบ');
    root.append(h('div', { class: 'nlff-quiz' }, h('div', { class: 'nlw-title' }, 'แบบฝึก: งานนี้ควรใช้ TCP หรือ UDP'), rows, h('div', { class: 'nlff-row' }, check, score)));
    rerun();
  }

  window.NL_FIGF_SIM = { jitterSim, swPacketSim, swCircuitSim, swPath, tcpSim, udpSim, rnd, SW, TL };
  NL_FIG('widget', 'jitter-buffer', jitterBuffer);
  NL_FIG('widget', 'switching-lab', switchingLab);
  NL_FIG('widget', 'transport-lab', transportLab);
})();
