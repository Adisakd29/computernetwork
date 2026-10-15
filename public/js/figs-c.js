'use strict';
/* NetLab 2.6 figures, batch c. Register with NL_FIG('diagram'|'widget', name, svgString|mountFn). */
window.NL_FIG = window.NL_FIG || function (kind, name, v) { const k = kind === 'diagram' ? 'NL_DIAGRAMS' : 'NL_WIDGETS'; (window[k] = window[k] || {})[name] = v; };

(function () {
  /* ---------- SVG string helpers (colours only through CSS variables) ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MONO = 'JetBrains Mono,Consolas,monospace';
  // text: o = {s:size, c:colour, a:anchor, w:bold, m:mono, i:italic}
  function T(x, y, s, o) {
    o = o || {};
    const fam = o.m ? ` font-family="${MONO}" xml:space="preserve" style="white-space:pre"` : ' font-family="inherit"';
    return `<text x="${x}" y="${y}" font-size="${o.s || 15}" text-anchor="${o.a || 'start'}" fill="${o.c || 'var(--ink)'}"${o.w ? ' font-weight="600"' : ''}${fam}>${esc(s)}</text>`;
  }
  // multi-line text block, lh = line height
  function TL(x, y, lines, o, lh) { return lines.map((s, i) => T(x, y + i * (lh || 22), s, o)).join(''); }
  // rect: o = {f:fill, fo:fill-opacity, st:stroke, sw, rx, d:dash}
  function R(x, y, w, h, o) {
    o = o || {};
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx == null ? 8 : o.rx}" fill="${o.f || 'var(--panel)'}"${o.fo != null ? ` fill-opacity="${o.fo}"` : ''} stroke="${o.st || 'var(--line)'}" stroke-width="${o.sw || 1.5}"${o.d ? ` stroke-dasharray="${o.d}"` : ''}/>`;
  }
  function L(x1, y1, x2, y2, o) {
    o = o || {};
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.c || 'var(--muted)'}" stroke-width="${o.sw || 2}" stroke-linecap="round"${o.d ? ` stroke-dasharray="${o.d}"` : ''}${o.me ? ` marker-end="url(#${o.me})"` : ''}${o.ms ? ` marker-start="url(#${o.ms})"` : ''}/>`;
  }
  function P(d, o) {
    o = o || {};
    return `<path d="${d}" fill="${o.f || 'none'}"${o.fo != null ? ` fill-opacity="${o.fo}"` : ''} stroke="${o.c || 'var(--muted)'}" stroke-width="${o.sw || 2}" stroke-linecap="round" stroke-linejoin="round"${o.d ? ` stroke-dasharray="${o.d}"` : ''}${o.me ? ` marker-end="url(#${o.me})"` : ''}${o.ms ? ` marker-start="url(#${o.ms})"` : ''}/>`;
  }
  // numbered badge
  function B(cx, cy, n, c, r) {
    r = r || 12;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c || 'var(--orange)'}"/>` + T(cx, cy + 5, n, { s: r > 13 ? 16 : 14, a: 'middle', c: 'var(--on-accent)', w: 1 });
  }
  function marker(id, c) {
    return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`;
  }
  function svg(name, h, title, body, defs) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${h}" role="img" aria-labelledby="${name}-title" font-family="inherit"><title id="${name}-title">${esc(title)}</title>${defs ? '<defs>' + defs + '</defs>' : ''}${body}</svg>`;
  }
  // checkbox (mock UI)
  function CB(x, y, on, label, o) {
    o = o || {};
    return R(x, y - 13, 16, 16, { rx: 3, f: on ? 'var(--blue)' : 'var(--panel)', st: on ? 'var(--blue)' : 'var(--muted)' }) +
      (on ? P(`M${x + 3},${y - 5} L${x + 7},${y - 1} L${x + 13},${y - 9}`, { c: 'var(--on-accent)', sw: 2.2 }) : '') +
      T(x + 24, y, label, { s: o.s || 14, c: o.c || 'var(--ink)', w: o.w });
  }
  // mock window frame with a title bar
  function WIN(x, y, w, h, title, sub) {
    return R(x, y, w, h, { f: 'var(--panel)', st: 'var(--muted)', rx: 8 }) +
      `<path d="M${x},${y + 30} L${x},${y + 8} Q${x},${y} ${x + 8},${y} L${x + w - 8},${y} Q${x + w},${y} ${x + w},${y + 8} L${x + w},${y + 30} Z" fill="var(--field)" stroke="var(--muted)" stroke-width="1.5"/>` +
      T(x + 12, y + 21, title, { s: 14, w: 1 }) + (sub ? T(x + w - 12, y + 21, sub, { s: 13, a: 'end', c: 'var(--muted)' }) : '');
  }
  // mock input field
  function FLD(x, y, w, val, o) {
    o = o || {};
    return R(x, y, w, 28, { rx: 4, f: 'var(--field)', st: o.hl ? 'var(--orange)' : 'var(--line)', sw: o.hl ? 2.2 : 1.5 }) +
      T(x + 8, y + 19, val, { s: 14, m: o.m }) + (o.dd ? P(`M${x + w - 18},${y + 11} l5,6 l5,-6`, { c: 'var(--muted)', sw: 1.8 }) : '');
  }
  // slider with green/red zones; frac = thumb position 0..1, safe = end of green zone
  function SLIDER(x, y, w, frac, safe) {
    const g = Math.round(w * safe);
    return `<rect x="${x}" y="${y}" width="${g}" height="6" rx="3" fill="var(--green)" fill-opacity="0.55"/>` +
      `<rect x="${x + g}" y="${y}" width="${w - g}" height="6" rx="3" fill="var(--bad)" fill-opacity="0.45"/>` +
      `<circle cx="${x + Math.round(w * frac)}" cy="${y + 3}" r="8" fill="var(--panel)" stroke="var(--blue)" stroke-width="3"/>`;
  }
  // terminal block: lines = [text | {t, c, b:badge}] ; returns {svg, h}
  function TERM(x, y, w, lines, o) {
    o = o || {};
    const lh = 20, pad = 14, h = pad * 2 + lines.length * lh - 4;
    let s = R(x, y, w, h, { f: 'var(--term-bg)', st: 'var(--term-bg)', rx: 8 });
    lines.forEach((ln, i) => {
      const L0 = typeof ln === 'string' ? { t: ln } : ln;
      const yy = y + pad + 12 + i * lh;
      if (L0.hl) s += `<rect x="${x + 6}" y="${yy - 15}" width="${w - 12}" height="20" rx="3" fill="var(${L0.hl})" fill-opacity="0.28"/>`;
      if (L0.t) s += T(x + 14, yy, L0.t, { s: o.s || 13.5, m: 1, c: L0.c || 'var(--term-ink)' });
      if (L0.b) s += B(x + w - 18, yy - 5, L0.b, L0.bc || 'var(--orange)', 11);
    });
    return { svg: s, h };
  }

  /* =====================================================================
     1. vm-create-steps (w12)
     ===================================================================== */
  (function () {
    const N = 'vm-create-steps';
    let y = 16, b = '';
    b += R(16, y, 608, 84, { f: 'var(--blue)', fo: 0.08, st: 'var(--blue)', rx: 12 });
    b += T(320, y + 32, 'สร้างเครื่องจำลองใหม่ทีละขั้น (แบบ VirtualBox)', { s: 18, a: 'middle', w: 1 });
    b += T(320, y + 56, 'ภาพจำลองหน้าจอ วาดขึ้นใหม่เพื่อการเรียน ไม่ใช่ภาพจริงของโปรแกรม', { s: 14, a: 'middle', c: 'var(--muted)' });
    b += T(320, y + 76, 'ชื่อปุ่มและหน้าอาจต่างกันเล็กน้อยตามรุ่นของโปรแกรม', { s: 14, a: 'middle', c: 'var(--muted)' });
    y += 104;
    function head(n, title) { b += B(34, y + 14, n, 'var(--blue)', 15) + T(58, y + 20, title, { s: 16, w: 1 }); y += 38; }
    function notes(lines, c) { lines.forEach(s => { const cont = /^\s/.test(s); if (!cont) b += `<circle cx="44" cy="${y + 11}" r="3.5" fill="${c || 'var(--orange)'}"/>`; b += T(56, y + 16, s.trim(), { s: 14 }); y += 23; }); y += 16; }
    const WX = 24, WW = 592, MOCK = 'ภาพจำลองหน้าจอ';

    // step 1
    head(1, 'ตั้งชื่อและเลือกระบบปฏิบัติการ (Name and Operating System)');
    b += WIN(WX, y, WW, 228, 'New Virtual Machine', MOCK);
    let r = y + 44;
    b += T(40, r + 19, 'Name', { s: 14 }) + FLD(150, r, 300, 'SRV01-Ubuntu'); r += 36;
    b += T(40, r + 19, 'Folder', { s: 14 }) + FLD(150, r, 300, 'D:\\VMs', { dd: 1 }); r += 36;
    b += T(40, r + 19, 'ISO Image', { s: 14 }) + FLD(150, r, 450, 'ubuntu-24.04-live-server-amd64.iso', { dd: 1, hl: 1 }); r += 36;
    b += T(40, r + 19, 'Type', { s: 14 }) + FLD(150, r, 150, 'Linux', { dd: 1 });
    b += T(318, r + 19, 'Version', { s: 14 }) + FLD(390, r, 210, 'Ubuntu (64-bit)', { dd: 1, hl: 1 }); r += 44;
    b += CB(40, r + 12, true, 'Skip Unattended Installation', { w: 1 });
    b += R(34, r - 6, 270, 26, { f: 'none', st: 'var(--orange)', sw: 2, rx: 5 });
    y += 228 + 12;
    notes(['ISO Image: เลือกไฟล์ติดตั้งที่ดาวน์โหลดจากเว็บไซต์ทางการ',
      'Version ต้องเป็นรุ่น 64-bit ให้ตรงกับ ISO ถ้ามีให้เลือกแค่ 32-bit',
      '   แปลว่ายังไม่ได้เปิด VT-x / AMD-V ใน BIOS',
      'ติ๊ก Skip Unattended Installation เพื่อฝึกติดตั้งเองทีละขั้น']);

    // step 2
    head(2, 'กำหนดฮาร์ดแวร์: หน่วยความจำและ CPU (Hardware)');
    b += WIN(WX, y, WW, 176, 'Hardware', MOCK);
    r = y + 48;
    b += T(40, r + 10, 'Base Memory', { s: 14 }) + SLIDER(160, r + 4, 320, 2048 / 16384, 0.5) + FLD(496, r - 8, 104, '2048 MB', { hl: 1 });
    b += T(160, r + 34, '4 MB', { s: 13, c: 'var(--muted)' }) + T(480, r + 34, '16384 MB', { s: 13, a: 'end', c: 'var(--muted)' });
    r += 64;
    b += T(40, r + 10, 'Processors', { s: 14 }) + SLIDER(160, r + 4, 320, 1 / 5, 1) + FLD(496, r - 8, 104, '2', { hl: 1 });
    b += T(160, r + 34, '1 CPU', { s: 13, c: 'var(--muted)' }) + T(480, r + 34, '6 CPU', { s: 13, a: 'end', c: 'var(--muted)' });
    y += 176 + 12;
    notes(['ตัวอย่างเครื่องแล็บ RAM 16 GB, CPU 6 คอร์ ให้ Ubuntu Server 2048 MB, 2 CPU',
      'RAM ไม่เกินราวครึ่งหนึ่งของเครื่องจริง ส่วน CPU ไม่เกินจำนวนคอร์จริง',
      'แถบเขียว = ค่าที่เหมาะ ถ้าเลื่อนเข้าแถบแดง Host จะเหลือทรัพยากรไม่พอ']);

    // step 3
    head(3, 'สร้างฮาร์ดดิสก์เสมือน (Virtual Hard Disk)');
    b += WIN(WX, y, WW, 196, 'Virtual Hard Disk', MOCK);
    r = y + 48;
    b += `<circle cx="48" cy="${r + 6}" r="8" fill="var(--panel)" stroke="var(--blue)" stroke-width="2"/><circle cx="48" cy="${r + 6}" r="4" fill="var(--blue)"/>` + T(64, r + 11, 'Create a Virtual Hard Disk Now', { s: 14, w: 1 });
    r += 36;
    b += T(40, r + 10, 'Disk Size', { s: 14 }) + SLIDER(160, r + 4, 320, 0.38, 1) + FLD(496, r - 8, 104, '25.00 GB', { hl: 1 });
    r += 34;
    b += T(40, r + 19, 'File Type', { s: 14 }) + FLD(160, r, 300, 'VDI (VirtualBox Disk Image)', { dd: 1 });
    r += 48;
    b += CB(40, r + 6, false, 'Pre-allocate Full Size', { w: 1 });
    b += R(34, r - 12, 228, 26, { f: 'none', st: 'var(--orange)', sw: 2, rx: 5 });
    b += T(276, r + 6, 'ไม่ติ๊ก = Dynamically allocated', { s: 14, c: 'var(--orange)', w: 1 });
    y += 196 + 12;
    notes(['Dynamically allocated: ไฟล์ .vdi เริ่มเล็กแล้วค่อยโตตามข้อมูลจนถึง 25 GB',
      '25 GB พอสำหรับฝึก Ubuntu Server ตรวจที่ว่างในไดรฟ์ของ Host ก่อน']);

    // step 4
    head(4, 'ตรวจสรุป (Summary) แล้วกด Finish');
    b += WIN(WX, y, WW, 196, 'Summary', MOCK);
    r = y + 52;
    [['Machine Name', 'SRV01-Ubuntu'], ['Guest OS Type', 'Ubuntu (64-bit)'], ['Base Memory', '2048'], ['Processors', '2'], ['Disk Size', '25.00 GB'], ['Pre-allocate Full Size', 'false']].forEach((kv, i) => {
      b += T(40, r + i * 22, kv[0], { s: 14, c: 'var(--muted)' }) + T(250, r + i * 22, kv[1], { s: 14, w: 1 });
    });
    b += R(400, y + 150, 90, 32, { rx: 6, f: 'var(--field)' }) + T(445, y + 171, 'Back', { s: 14, a: 'middle' });
    b += R(504, y + 150, 96, 32, { rx: 6, f: 'var(--blue)', st: 'var(--blue)' }) + T(552, y + 171, 'Finish', { s: 14, a: 'middle', c: 'var(--on-accent)', w: 1 });
    y += 196 + 12;
    notes(['เครื่องใหม่จะอยู่ในรายการด้านซ้าย สถานะ Powered Off (ยังไม่เปิด)']);

    // step 5
    head(5, 'เปิด Settings ตรวจ Storage และ Network');
    b += WIN(WX, y, WW, 262, 'SRV01-Ubuntu - Settings', MOCK);
    r = y + 44;
    ['General', 'System', 'Display', 'Storage', 'Audio', 'Network', 'USB'].forEach((m, i) => {
      const on = m === 'Storage' || m === 'Network';
      if (on) b += R(34, r + i * 30 - 2, 118, 26, { rx: 5, f: 'var(--orange)', fo: 0.16, st: 'var(--orange)' });
      b += T(46, r + i * 30 + 16, m, { s: 14, w: on ? 1 : 0 });
    });
    b += L(164, y + 38, 164, y + 252, { c: 'var(--line)', sw: 1.5 });
    // storage tree
    b += T(180, r + 16, 'Storage Devices', { s: 14, w: 1 });
    b += T(192, r + 40, 'Controller: IDE', { s: 14, c: 'var(--muted)' });
    b += `<circle cx="214" cy="${r + 58}" r="9" fill="none" stroke="var(--blue)" stroke-width="2"/><circle cx="214" cy="${r + 58}" r="2.5" fill="var(--blue)"/>`;
    b += T(230, r + 63, 'ubuntu-24.04-live-server-amd64.iso', { s: 14, w: 1 });
    b += T(192, r + 88, 'Controller: SATA', { s: 14, c: 'var(--muted)' });
    b += R(205, r + 98, 18, 14, { rx: 2, f: 'var(--green)', fo: 0.2, st: 'var(--green)' });
    b += T(230, r + 111, 'SRV01-Ubuntu.vdi', { s: 14, w: 1 });
    b += L(176, r + 128, 604, r + 128, { c: 'var(--line)', sw: 1.2 });
    // network
    b += T(180, r + 152, 'Network: Adapter 1', { s: 14, w: 1 });
    b += CB(192, r + 178, true, 'Enable Network Adapter');
    b += T(192, r + 207, 'Attached to', { s: 14 }) + FLD(290, r + 188, 200, 'NAT', { dd: 1, hl: 1 });
    y += 262 + 12;
    notes(['Storage: ไฟล์ ISO ต้องอยู่ในไดรฟ์ออปติคัล (ไอคอนแผ่นดิสก์) จึงบูตติดตั้งได้',
      'Network: NAT ออกอินเทอร์เน็ตได้ทันที เลือก Bridged Adapter เมื่อต้องให้',
      '   เครื่องอื่นในห้องเข้าถึงเครื่องจำลองนี้']);

    // step 6
    head(6, 'กด Start บูตจาก ISO แล้วติดตั้ง');
    b += WIN(WX, y, WW, 168, 'SRV01-Ubuntu [Running]', MOCK);
    b += `<rect x="32" y="${y + 38}" width="576" height="122" rx="4" fill="var(--term-bg)"/>`;
    b += T(48, y + 66, 'GNU GRUB', { s: 13.5, m: 1, c: 'var(--term-dim)' });
    b += `<rect x="44" y="${y + 80}" width="420" height="24" rx="3" fill="var(--term-ink)" fill-opacity="0.9"/>`;
    b += T(52, y + 97, '*Try or Install Ubuntu Server', { s: 14, m: 1, c: 'var(--term-bg)' });
    b += T(48, y + 140, 'กด Enter เพื่อเริ่มตัวติดตั้ง', { s: 14, c: 'var(--term-ink)' });
    y += 168 + 12;
    notes(['คลิกในหน้าต่างแล้วเมาส์ถูกจับไว้ใน Guest กด Right Ctrl (Host key) เพื่อกลับมา',
      'ติดตั้งเสร็จ ตัวติดตั้งจะให้เอาสื่อติดตั้งออกแล้วกด Enter เพื่อรีบูต',
      'ถ้ายังบูตเข้าตัวติดตั้งซ้ำ ให้เอา ISO ออกจากไดรฟ์ใน Settings → Storage']);

    // summary table
    b += R(16, y, 608, 168, { f: 'var(--green)', fo: 0.08, st: 'var(--green)', rx: 12 });
    b += T(32, y + 30, 'ค่าที่เหมาะกับเครื่องห้องแล็บ (RAM 16 GB, CPU 6 คอร์)', { s: 16, w: 1 });
    b += T(32, y + 60, 'เครื่องจำลอง', { s: 14, c: 'var(--muted)', w: 1 }) + T(250, y + 60, 'RAM', { s: 14, c: 'var(--muted)', w: 1 }) + T(340, y + 60, 'CPU', { s: 14, c: 'var(--muted)', w: 1 }) + T(420, y + 60, 'ดิสก์ (Dynamic)', { s: 14, c: 'var(--muted)', w: 1 });
    b += T(32, y + 86, 'Ubuntu Server', { s: 15 }) + T(250, y + 86, '2 GB', { s: 15, w: 1 }) + T(340, y + 86, '2', { s: 15, w: 1 }) + T(420, y + 86, '25 GB', { s: 15, w: 1 });
    b += T(32, y + 112, 'Windows 10/11 ลูกข่าย', { s: 15 }) + T(250, y + 112, '4 GB', { s: 15, w: 1 }) + T(340, y + 112, '2', { s: 15, w: 1 }) + T(420, y + 112, '64 GB', { s: 15, w: 1 });
    b += T(32, y + 148, 'เปิดพร้อมกันใช้ RAM 6 GB และ 4 คอร์ Host ยังเหลือ RAM 10 GB กับ 2 คอร์', { s: 14, c: 'var(--ink)' });
    y += 168 + 16;
    NL_FIG('diagram', 'vm-create-steps', svg(N, y, 'ภาพจำลองหน้าจอ 6 ขั้นตอนสร้างเครื่องจำลองแบบ VirtualBox: ตั้งชื่อ SRV01-Ubuntu เลือก ISO และ Type Linux Version Ubuntu 64-bit ติ๊ก Skip Unattended Installation, กำหนด RAM 2048 MB และ CPU 2, สร้างดิสก์ VDI 25 GB แบบ Dynamically allocated, ตรวจสรุปแล้วกด Finish, ตรวจ Settings ว่า ISO อยู่ในไดรฟ์ออปติคัลและ Network เป็น NAT, กด Start บูตเข้าตัวติดตั้ง พร้อมตารางค่าที่เหมาะกับเครื่องแล็บ RAM 16 GB CPU 6 คอร์', b));
  })();

  /* =====================================================================
     3. structured-cabling (w13)
     ===================================================================== */
  (function () {
    const N = 'structured-cabling';
    const defs = marker(N + '-a', 'var(--muted)') + marker(N + '-ab', 'var(--blue)') + marker(N + '-ao', 'var(--orange)');
    let b = '';
    b += T(320, 32, 'ระบบสายสัญญาณแบบมีโครงสร้าง (Structured Cabling)', { s: 18, a: 'middle', w: 1 });
    b += T(320, 56, 'ตัวอย่างผังสำนักงานชั้น 2: เต้ารับที่โต๊ะ → สายในฝ้า → ตู้ Rack', { s: 15, a: 'middle', c: 'var(--muted)' });
    // floor plan
    const FY = 76;
    b += R(16, FY, 608, 330, { f: 'var(--field)', st: 'var(--ink)', sw: 2.5, rx: 4 });
    // telecom room
    b += R(452, FY, 172, 330, { f: 'var(--brown)', fo: 0.08, st: 'var(--ink)', sw: 2.5, rx: 4 });
    b += T(560, FY + 276, 'ห้องอุปกรณ์', { s: 15, a: 'middle', w: 1 }) + T(560, FY + 296, '(Telecom Room)', { s: 13, a: 'middle', c: 'var(--muted)' });
    // door gap
    b += `<rect x="446" y="${FY + 250}" width="12" height="44" fill="var(--field)"/>` + P(`M452,${FY + 250} A44,44 0 0 0 496,${FY + 294}`, { c: 'var(--muted)', sw: 1.2, d: '3 3' });
    b += T(234, FY + 318, 'พื้นที่ทำงาน (Work Area)', { s: 15, a: 'middle', w: 1 });
    // cable tray along ceiling
    b += `<rect x="40" y="${FY + 18}" width="440" height="14" rx="3" fill="var(--orange)" fill-opacity="0.15" stroke="var(--orange)" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    b += T(36, FY + 294, 'เส้นประส้ม = สายในรางเดินบนฝ้า (Cable Tray)', { s: 13, c: 'var(--orange)', w: 1 });
    // rack
    b += R(500, FY + 64, 76, 160, { rx: 4, f: 'var(--panel)', st: 'var(--ink)', sw: 2 });
    [['Patch Panel', 'var(--orange)'], ['Cable Mgr', 'var(--muted)'], ['Switch', 'var(--blue)'], ['Router/FW', 'var(--green)'], ['UPS', 'var(--muted)']].forEach((u, i) => {
      b += `<rect x="506" y="${FY + 72 + i * 30}" width="64" height="22" rx="2" fill="${u[1]}" fill-opacity="0.2" stroke="${u[1]}" stroke-width="1.3"/>` + T(538, FY + 88 + i * 30, u[0], { s: 13, a: 'middle' });
    });
    b += T(538, FY + 244, 'ตู้ Rack', { s: 14, a: 'middle', w: 1 });
    // desks and outlets: 2 rows x 3
    const desks = [[56, 112], [184, 112], [312, 112], [56, 206], [184, 206], [312, 206]];
    desks.forEach((d, i) => {
      const x = d[0], yy = FY + d[1];
      b += R(x, yy, 100, 54, { rx: 4, f: 'var(--panel)', st: 'var(--muted)' });
      // pc
      b += `<rect x="${x + 12}" y="${yy + 10}" width="30" height="20" rx="2" fill="var(--blue)" fill-opacity="0.15" stroke="var(--blue)" stroke-width="1.4"/><rect x="${x + 22}" y="${yy + 30}" width="10" height="5" fill="var(--blue)"/>`;
      // outlet faceplate on wall-side (top edge of desk)
      b += `<rect x="${x + 62}" y="${yy + 8}" width="26" height="26" rx="3" fill="var(--orange)" fill-opacity="0.18" stroke="var(--orange)" stroke-width="1.6"/><rect x="${x + 69}" y="${yy + 15}" width="12" height="10" rx="1" fill="var(--orange)"/>`;
      b += T(x + 50, yy + 50, 'F2-PP1-0' + (i + 1), { s: 13, a: 'middle', m: 1, w: 1 });
      // patch cord pc->outlet
      b += P(`M${x + 42},${yy + 20} L${x + 62},${yy + 20}`, { c: 'var(--blue)', sw: 2 });
      // horizontal cable from outlet to tray
      b += i < 3 ? P(`M${x + 75},${yy + 8} L${x + 75},${FY + 32}`, { c: 'var(--orange)', sw: 1.6, d: '6 4' })
        : P(`M${x + 88},${yy + 21} L${x + 114},${yy + 21} L${x + 114},${FY + 32}`, { c: 'var(--orange)', sw: 1.6, d: '6 4' });
    });
    // tray to rack
    b += P(`M480,${FY + 25} L538,${FY + 25} L538,${FY + 64}`, { c: 'var(--orange)', sw: 3, me: N + '-ao' });
    // 90m label
    b += R(236, FY + 40, 204, 26, { rx: 13, f: 'var(--panel)', st: 'var(--orange)', sw: 1.6 }) + T(338, FY + 58, 'สายถาวร ≤ 90 m', { s: 14, a: 'middle', c: 'var(--orange)', w: 1 });

    // linear chain
    let y = 432;
    b += T(320, y, 'เส้นทางของสัญญาณหนึ่งเส้น (หนึ่งช่องสัญญาณ = Channel)', { s: 16, a: 'middle', w: 1 });
    y += 24;
    function node(cx, cy, w, label, sub, c) {
      return R(cx - w / 2, cy - 26, w, 52, { rx: 8, f: c, fo: 0.12, st: c, sw: 1.8 }) + T(cx, cy - 2, label, { s: 14, a: 'middle', w: 1 }) + (sub ? T(cx, cy + 17, sub, { s: 13, a: 'middle', c: 'var(--muted)' }) : '');
    }
    const cy1 = y + 70;
    b += node(62, cy1, 92, 'PC', 'โต๊ะทำงาน', 'var(--blue)');
    b += node(196, cy1, 104, 'เต้ารับ', 'Outlet', 'var(--orange)');
    b += node(430, cy1, 116, 'Patch Panel', 'ด้านหลังเข้าหัว', 'var(--orange)');
    b += node(572, cy1, 92, 'Switch', 'ในตู้ Rack', 'var(--blue)');
    b += L(108, cy1, 144, cy1, { c: 'var(--blue)', sw: 3 });
    b += L(248, cy1, 372, cy1, { c: 'var(--orange)', sw: 4, d: '9 5' });
    b += L(488, cy1, 526, cy1, { c: 'var(--blue)', sw: 3 });
    b += T(126, cy1 + 46, 'Patch Cord', { s: 13, a: 'middle', c: 'var(--blue)', w: 1 });
    b += T(310, cy1 + 22, 'Horizontal Cable', { s: 13, a: 'middle', c: 'var(--orange)', w: 1 });
    b += T(507, cy1 + 46, 'Patch Cord', { s: 13, a: 'middle', c: 'var(--blue)', w: 1 });
    // brackets
    const by1 = y + 14;
    b += P(`M196,${by1 + 16} L196,${by1} L430,${by1} L430,${by1 + 16}`, { c: 'var(--orange)', sw: 1.8 });
    b += R(228, by1 - 14, 170, 26, { rx: 13, f: 'var(--panel)', st: 'var(--orange)' }) + T(313, by1 + 4, 'Permanent Link ≤ 90 m', { s: 13, a: 'middle', c: 'var(--orange)', w: 1 });
    const by2 = cy1 + 64;
    b += P(`M20,${by2 - 14} L20,${by2} L618,${by2} L618,${by2 - 14}`, { c: 'var(--ink)', sw: 1.8 });
    b += R(150, by2 - 13, 340, 26, { rx: 13, f: 'var(--panel)', st: 'var(--ink)' }) + T(320, by2 + 5, 'Channel ทั้งเส้น ≤ 100 m', { s: 14, a: 'middle', w: 1 });
    y = by2 + 34;
    b += T(320, y, 'Patch Cord ฝั่งโต๊ะ + ฝั่งตู้ รวมกันไม่เกินประมาณ 10 m', { s: 14, a: 'middle', c: 'var(--muted)' });
    // uplink row
    y += 30;
    const cy2 = y + 34;
    b += node(572, cy2, 92, 'Router', 'Firewall', 'var(--green)');
    b += node(390, cy2, 128, 'ONU / Modem', 'อุปกรณ์ของ ISP', 'var(--brown)');
    b += `<path d="M146,${cy2 + 22} C120,${cy2 + 22} 122,${cy2 - 4} 148,${cy2 - 2} C150,${cy2 - 28} 196,${cy2 - 30} 206,${cy2 - 10} C226,${cy2 - 22} 256,${cy2 - 8} 246,${cy2 + 6} C266,${cy2 + 8} 262,${cy2 + 22} 244,${cy2 + 22} Z" fill="var(--muted)" fill-opacity="0.12" stroke="var(--muted)" stroke-width="1.6"/>`;
    b += T(194, cy2 + 8, 'ISP / Internet', { s: 14, a: 'middle', w: 1 });
    b += L(526, cy2, 456, cy2, { c: 'var(--muted)', sw: 2.5, me: N + '-a' });
    b += L(326, cy2, 262, cy2, { c: 'var(--muted)', sw: 2.5, me: N + '-a' });
    b += T(40, cy2 - 34, 'Switch → Router/Firewall → ISP (ภายในตู้และออกนอกอาคาร)', { s: 13, c: 'var(--muted)' });
    // arrow from switch down to router
    b += L(600, cy1 + 26, 600, cy2 - 28, { c: 'var(--muted)', sw: 2.5, me: N + '-a' });
    y = cy2 + 52;

    // labelling scheme
    b += R(16, y, 608, 236, { f: 'var(--panel)', st: 'var(--line)', rx: 12 });
    b += T(32, y + 30, 'การติดป้ายสาย (Cable Labeling)', { s: 16, w: 1 });
    b += T(32, y + 54, 'ใช้รหัสเดียวกันที่ปลายสายทั้งสองด้าน และที่เต้ารับกับพอร์ต Patch Panel', { s: 14, c: 'var(--muted)' });
    // big label
    const lx = 40, ly = y + 72;
    b += R(lx, ly, 260, 50, { rx: 6, f: 'var(--orange)', fo: 0.12, st: 'var(--orange)', sw: 2 });
    b += T(lx + 22, ly + 34, 'F2', { s: 24, m: 1, w: 1, c: 'var(--blue)' }) + T(lx + 58, ly + 34, '-', { s: 24, m: 1 }) + T(lx + 76, ly + 34, 'PP1', { s: 24, m: 1, w: 1, c: 'var(--green)' }) + T(lx + 132, ly + 34, '-', { s: 24, m: 1 }) + T(lx + 150, ly + 34, '07', { s: 24, m: 1, w: 1, c: 'var(--orange)' });
    b += T(330, ly + 14, 'F2 = ชั้น 2', { s: 14, c: 'var(--blue)', w: 1 });
    b += T(330, ly + 36, 'PP1 = Patch Panel ตัวที่ 1', { s: 14, c: 'var(--green)', w: 1 });
    b += T(330, ly + 58, '07 = พอร์ตที่ 7 ของแผงนั้น', { s: 14, c: 'var(--orange)', w: 1 });
    // record table
    const ty = ly + 84;
    b += R(32, ty, 576, 64, { rx: 6, f: 'var(--field)' });
    b += T(44, ty + 24, 'บันทึกในแฟ้มเครือข่าย:', { s: 14, w: 1 });
    b += T(44, ty + 50, 'F2-PP1-07 → Switch1 พอร์ต 7 → โต๊ะบัญชี 3 → ทดสอบผ่าน', { s: 14 });
    y += 236 + 14;
    b += T(320, y + 8, 'ระยะตามมาตรฐานสาย UTP สำหรับ Ethernet (ANSI/TIA-568): 90 + 10 = 100 m', { s: 13, a: 'middle', c: 'var(--muted)' });
    y += 24;
    NL_FIG('diagram', 'structured-cabling', svg(N, y, 'ผังสำนักงานแบบมีโครงสร้าง: เต้ารับที่โต๊ะทำงานเดินสายถาวรผ่านรางในฝ้าไม่เกิน 90 เมตรไปยัง Patch Panel ในตู้ Rack ห้องอุปกรณ์ ต่อ Patch Cord เข้า Switch แล้วไป Router/Firewall และ ISP ช่องสัญญาณทั้งเส้นไม่เกิน 100 เมตร Patch Cord สองฝั่งรวมไม่เกินประมาณ 10 เมตร และการติดป้ายสาย F2-PP1-07 ที่ปลายทั้งสองด้าน', b, defs));
  })();

  /* =====================================================================
     4. cmd-outputs (w14)
     ===================================================================== */
  (function () {
    const N = 'cmd-outputs';
    let y = 16, b = '';
    b += T(320, y + 18, 'อ่านผล ping, tracert และ nslookup ของ Windows', { s: 18, a: 'middle', w: 1 });
    b += T(320, y + 42, 'เครื่องเรา 192.168.20.105/24  Gateway 192.168.20.1  DNS 192.168.20.10', { s: 14, a: 'middle', c: 'var(--muted)' });
    y += 62;
    const P1 = 'var(--green)', P2 = 'var(--orange)', P3 = 'var(--bad)';
    function panel(title, c, lines, expl, concl) {
      b += `<rect x="16" y="${y}" width="6" height="26" rx="3" fill="${c}"/>` + T(32, y + 19, title, { s: 16, w: 1 });
      y += 36;
      const t = TERM(16, y, 608, lines);
      b += t.svg; y += t.h + 14;
      expl.forEach(e => {
        b += B(30, y + 10, e[0], 'var(--orange)', 11);
        e.slice(1).forEach((s, i) => { b += T(50, y + 15 + i * 21, s, { s: 14 }); });
        y += 21 * (e.length - 1) + 8;
      });
      if (concl) {
        const h = 16 + concl.length * 21;
        b += R(16, y, 608, h, { f: c, fo: 0.08, st: c, rx: 8 });
        concl.forEach((s, i) => { b += T(30, y + 25 + i * 21, s, { s: 14, w: i === 0 ? 1 : 0 }); });
        y += h;
      }
      y += 28;
    }
    panel('1. ping สำเร็จ', P1, [
      { t: 'C:\\>ping 192.168.20.1', c: 'var(--term-dim)' }, '',
      'Pinging 192.168.20.1 with 32 bytes of data:',
      { t: 'Reply from 192.168.20.1: bytes=32 time=1ms TTL=64', b: '1', hl: '--green' },
      'Reply from 192.168.20.1: bytes=32 time<1ms TTL=64',
      'Reply from 192.168.20.1: bytes=32 time<1ms TTL=64',
      'Reply from 192.168.20.1: bytes=32 time<1ms TTL=64', '',
      'Ping statistics for 192.168.20.1:',
      { t: '    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),', b: '2' },
      'Approximate round trip times in milli-seconds:',
      { t: '    Minimum = 0ms, Maximum = 1ms, Average = 0ms', b: '3' }
    ], [
      ['1', 'Reply from = ปลายทางตอบกลับ  bytes = ขนาดข้อมูลทดสอบ', 'time = เวลาไปกลับ  TTL = อายุแพ็กเก็ตที่เหลือเมื่อถึงเรา'],
      ['2', 'ส่ง 4 ได้รับ 4 สูญหาย 0 ครั้ง'],
      ['3', 'เวลาไปกลับต่ำสุด สูงสุด เฉลี่ย ใน LAN มักไม่เกินไม่กี่ ms']
    ], ['สรุป: เครื่องเราถึง Default Gateway ได้', 'ขั้นต่อไป ping IP นอกวง เช่น 8.8.8.8']);

    panel('2. ping ได้ Request timed out', P2, [
      { t: 'C:\\>ping 192.168.20.31', c: 'var(--term-dim)' }, '',
      'Pinging 192.168.20.31 with 32 bytes of data:',
      { t: 'Request timed out.', b: '1', hl: '--orange' },
      'Request timed out.', 'Request timed out.', 'Request timed out.', '',
      'Ping statistics for 192.168.20.31:',
      { t: '    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),', b: '2' }
    ], [
      ['1', 'ส่งออกไปแล้ว แต่ไม่มีคำตอบภายในเวลาที่รอ (ค่าเริ่มต้น 4 วินาที)'],
      ['2', 'ไม่ได้รับเลย สูญหาย 100%']
    ], ['สรุป: ยังบอกไม่ได้ว่าปลายทางดับ อาจเป็นไฟร์วอลล์บล็อก ICMP', '(Windows ปกติไม่ตอบ ping) หรือเครื่องปิด/สายขาด', 'ให้ ping เครื่องอื่นในวงเทียบก่อนสรุป']);

    panel('3. ping ได้ Destination host unreachable', P3, [
      { t: 'C:\\>ping 192.168.20.77', c: 'var(--term-dim)' }, '',
      'Pinging 192.168.20.77 with 32 bytes of data:',
      { t: 'Reply from 192.168.20.105: Destination host unreachable.', b: '1', hl: '--bad' },
      'Reply from 192.168.20.105: Destination host unreachable.',
      'Reply from 192.168.20.105: Destination host unreachable.',
      'Reply from 192.168.20.105: Destination host unreachable.', '',
      'Ping statistics for 192.168.20.77:',
      { t: '    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),', b: '2' }
    ], [
      ['1', 'Reply from 192.168.20.105 คือ IP ของเครื่องเราเอง ไม่ใช่ปลายทาง', 'เครื่องเราถาม ARP หา MAC ของปลายทางแล้วไม่มีใครตอบ'],
      ['2', 'Windows นับข้อความนี้เป็น Received จึงขึ้น 0% loss ทั้งที่ติดต่อไม่ได้']
    ], ['สรุป: ไม่มีเครื่องนี้ในวง หรือปลายทางปิด/สายหลุด', 'ถ้าปลายทางอยู่นอกวง ให้ตรวจค่า Default Gateway']);

    panel('4. tracert -d 8.8.8.8', P1, [
      { t: 'C:\\>tracert -d 8.8.8.8', c: 'var(--term-dim)' }, '',
      'Tracing route to 8.8.8.8 over a maximum of 30 hops', '',
      { t: '  1    <1 ms    <1 ms    <1 ms  192.168.20.1', b: '1' },
      '  2     3 ms     2 ms     3 ms  10.10.0.1',
      { t: '  3     *        *        *     Request timed out.', b: '2', hl: '--orange' },
      '  4    12 ms    11 ms    13 ms  198.51.100.9',
      '  5    18 ms    17 ms    18 ms  8.8.8.8', '',
      { t: 'Trace complete.', b: '3' }
    ], [
      ['1', 'เลข hop  เวลา 3 ช่องจากการทดสอบ 3 ครั้ง  และ IP ของเราเตอร์', 'hop 1 คือ Default Gateway ของเรา'],
      ['2', '* * * ที่ hop 3 แต่ hop 4 ยังตอบ = เราเตอร์ตัวนั้นแค่ไม่ตอบ ICMP', 'ข้อมูลยังผ่านไปได้ ไม่ใช่ปัญหา'],
      ['3', 'ถึงปลายทางแล้ว']
    ], ['ถ้าตอบถึง hop 1 แล้วเป็น * * * ทุกบรรทัดจนครบ 30 hop', '= ข้อมูลไปไม่ถึงหลังเราเตอร์ของเรา เช่น ลิงก์ไป ISP ขาด']);

    panel('5. nslookup สำเร็จ', P1, [
      { t: 'C:\\>nslookup www.example.com', c: 'var(--term-dim)' },
      { t: 'Server:  dns.netlab.test', b: '1' },
      'Address:  192.168.20.10', '',
      { t: 'Non-authoritative answer:', b: '2' },
      { t: 'Name:    www.example.com', b: '3', hl: '--green' },
      { t: 'Address:  203.0.113.80', hl: '--green' }
    ], [
      ['1', 'DNS Server ที่เครื่องใช้ถาม ควรตรงกับ DNS Servers ใน ipconfig /all', 'ถ้าชื่อขึ้น UnKnown แปลว่าหาชื่อของ DNS Server ไม่ได้ ไม่ใช่ข้อผิดพลาด'],
      ['2', 'ได้คำตอบจาก DNS Server ที่ไม่ใช่เจ้าของโดเมน (มักมาจากแคช) เป็นเรื่องปกติ'],
      ['3', 'คำตอบ: ชื่อนี้แปลงเป็น IP 203.0.113.80']
    ], null);

    panel('6. nslookup ล้มเหลว: DNS Server ไม่ตอบ', P3, [
      { t: 'C:\\>nslookup www.example.com', c: 'var(--term-dim)' },
      { t: 'DNS request timed out.', b: '1', hl: '--bad' },
      '    timeout was 2 seconds.',
      'Server:  UnKnown',
      { t: 'Address:  192.168.20.100', b: '2' }, '',
      'DNS request timed out.',
      '    timeout was 2 seconds.',
      { t: '*** Request to UnKnown timed-out', hl: '--bad' }
    ], [
      ['1', 'ส่งคำถามไปแล้วไม่มีคำตอบ'],
      ['2', 'เครื่องตั้ง DNS Server เป็น 192.168.20.100 ซึ่งไม่ใช่ DNS ของวง (ควรเป็น .10)']
    ], ['สรุป: ปัญหา DNS ตรวจ DNS Servers ใน ipconfig /all', 'แล้วลองถามตัวอื่น: nslookup www.example.com 8.8.8.8']);
    b += T(320, y - 6, 'ที่อยู่ในภาพเป็นตัวอย่างสำหรับเอกสาร (RFC 5737, RFC 1918) ค่าจริงจะต่างไป', { s: 13, a: 'middle', c: 'var(--muted)' });
    y += 12;
    NL_FIG('diagram', 'cmd-outputs', svg(N, y, 'ตัวอย่างผลคำสั่ง Windows พร้อมคำอธิบาย: ping สำเร็จมี Reply from ปลายทางและ Lost 0, Request timed out คือไม่มีคำตอบอาจเพราะไฟร์วอลล์, Destination host unreachable ตอบจาก IP เครื่องเราเองเพราะ ARP ไม่พบปลายทางและ Windows นับเป็น Received, tracert แสดง hop โดย * * * ที่ hop กลางทางแต่ hop ถัดไปตอบไม่ใช่ปัญหา, nslookup แสดง Server Address และ Non-authoritative answer และกรณี DNS request timed out เมื่อตั้ง DNS Server ผิด', b));
  })();

  /* =====================================================================
     7. ntfs-inheritance (w18)
     ===================================================================== */
  (function () {
    const N = 'ntfs-inheritance';
    let b = '', y = 16;
    b += T(320, y + 18, 'สิทธิ์ NTFS แบบสืบทอด (Inherited) และแบบตั้งเอง (Explicit)', { s: 17, a: 'middle', w: 1 });
    y += 40;
    // users
    function user(x, name, role, groups) {
      b += R(x, y, 292, 78, { rx: 10, f: 'var(--field)' });
      b += `<circle cx="${x + 28}" cy="${y + 26}" r="11" fill="var(--blue)" fill-opacity="0.2" stroke="var(--blue)" stroke-width="1.6"/><path d="M${x + 12},${y + 54} Q${x + 28},${y + 34} ${x + 44},${y + 54}" fill="var(--blue)" fill-opacity="0.2" stroke="var(--blue)" stroke-width="1.6"/>`;
      b += T(x + 54, y + 26, name, { s: 15, w: 1 }) + T(x + 54, y + 46, role, { s: 13, c: 'var(--muted)' });
      b += T(x + 54, y + 68, 'กลุ่ม: ' + groups, { s: 14, c: 'var(--blue)', w: 1 });
    }
    user(16, 'สมชาย', 'พนักงานฝ่ายขาย', 'Staff, Sales');
    user(332, 'มานี', 'นักศึกษาฝึกงานฝ่ายบุคคล', 'Staff, HR, Interns');
    y += 100;
    // legend
    b += R(16, y, 608, 40, { rx: 8, f: 'var(--panel)' });
    b += R(28, y + 11, 30, 18, { rx: 4, f: 'var(--green)', fo: 0.15, st: 'var(--green)' }) + T(66, y + 25, 'ตั้งเอง (Explicit)', { s: 13 });
    b += R(196, y + 11, 30, 18, { rx: 4, f: 'var(--panel)', st: 'var(--muted)', d: '4 3' }) + T(234, y + 25, 'สืบทอดมา (Inherited)', { s: 13 });
    b += R(392, y + 11, 30, 18, { rx: 4, f: 'var(--bad)', fo: 0.15, st: 'var(--bad)' }) + T(430, y + 25, 'Deny (ปฏิเสธ)', { s: 13 });
    y += 58;
    // tree
    function folder(x, yy, c) { return `<path d="M${x},${yy + 4} L${x + 9},${yy + 4} L${x + 12},${yy} L${x + 24},${yy} L${x + 24},${yy + 18} L${x},${yy + 18} Z" fill="${c || 'var(--orange)'}" fill-opacity="0.25" stroke="${c || 'var(--orange)'}" stroke-width="1.5" stroke-linejoin="round"/>`; }
    function file(x, yy) { return `<path d="M${x + 3},${yy - 2} L${x + 15},${yy - 2} L${x + 21},${yy + 4} L${x + 21},${yy + 20} L${x + 3},${yy + 20} Z" fill="var(--blue)" fill-opacity="0.15" stroke="var(--blue)" stroke-width="1.5" stroke-linejoin="round"/>`; }
    function chip(x, yy, text, kind) {
      const w = Math.round(text.length * 7.9 + 20);
      const st = kind === 'e' ? { f: 'var(--green)', fo: 0.13, st: 'var(--green)' } : kind === 'd' ? { f: 'var(--bad)', fo: 0.13, st: 'var(--bad)', sw: 2 } : { f: 'var(--panel)', st: 'var(--muted)', d: '4 3' };
      st.rx = 5;
      return { s: R(x, yy, w, 26, st) + T(x + 10, yy + 18, text, { s: 13, m: 1, c: kind === 'd' ? 'var(--bad)' : 'var(--ink)', w: kind === 'd' ? 1 : 0 }), w };
    }
    function row(depth, icon, name, chips, note) {
      const x = 24 + depth * 30;
      b += (icon === 'f' ? folder(x, y + 4) : file(x, y + 4)) + T(x + 32, y + 19, name, { s: 15, w: 1, m: 1 });
      if (note) b += T(x + 32 + name.length * 9.2 + 10, y + 19, note, { s: 13, c: 'var(--orange)', w: 1 });
      let cy = y + 30, cx = x + 32;
      chips.forEach(cpt => {
        const c = chip(cx, cy, cpt[0], cpt[1]);
        if (cx + c.w > 620) { cx = x + 32; cy += 32; const c2 = chip(cx, cy, cpt[0], cpt[1]); b += c2.s; cx += c2.w + 8; return; }
        b += c.s; cx += c.w + 8;
      });
      y = cy + 40;
      return x;
    }
    const tree0 = y;
    row(0, 'f', 'D:\\Data', [['Administrators: Full control', 'e'], ['Staff: Read & execute', 'e']]);
    const ySales = y;
    row(1, 'f', 'Sales', [['Staff: Read & execute', 'i'], ['Sales: Modify', 'e']]);
    const yPrice = y;
    row(2, 'd', 'ราคา.xlsx', [['Staff: Read & execute', 'i'], ['Sales: Modify', 'i']]);
    const yHR = y;
    row(1, 'f', 'HR', [['HR: Modify', 'e']], 'ปิดการสืบทอด และเอา Staff ออก');
    const ySal = y;
    row(2, 'd', 'เงินเดือน.xlsx', [['HR: Modify', 'i'], ['Interns: Deny Full control', 'd']]);
    // tree lines
    b += P(`M36,${tree0 + 24} L36,${yHR + 13} L52,${yHR + 13}`, { c: 'var(--line)', sw: 2 }) + P(`M36,${ySales + 13} L52,${ySales + 13}`, { c: 'var(--line)', sw: 2 });
    b += P(`M66,${ySales + 24} L66,${yPrice + 13} L82,${yPrice + 13}`, { c: 'var(--line)', sw: 2 });
    b += P(`M66,${yHR + 24} L66,${ySal + 13} L82,${ySal + 13}`, { c: 'var(--line)', sw: 2 });
    b += T(24, y + 4, 'Administrators: Full control สืบทอดลงทุกชั้น (ไม่แสดงซ้ำ)', { s: 13, c: 'var(--muted)' });
    y += 36;

    // effective table
    b += T(16, y + 6, 'สิทธิ์ที่มีผลจริง (Effective Permission)', { s: 16, w: 1 });
    y += 20;
    const rows = [
      ['สมชาย', 'ราคา.xlsx', 'Modify', 'var(--green)', 'Allow จาก Sales และ Staff รวมกัน'],
      ['สมชาย', 'เงินเดือน.xlsx', 'ไม่มีสิทธิ์', 'var(--muted)', 'ไม่มี Allow ให้กลุ่มใดของเขาเลย'],
      ['มานี', 'ราคา.xlsx', 'Read & execute', 'var(--blue)', 'ได้จาก Staff ที่สืบทอดมา'],
      ['มานี', 'เงินเดือน.xlsx', 'ไม่มีสิทธิ์', 'var(--bad)', 'Deny ที่ตั้งเองชนะ Allow ที่สืบทอดจาก HR']
    ];
    rows.forEach((r, i) => {
      const yy = y + i * 60;
      b += R(16, yy, 608, 52, { rx: 8, f: i % 2 ? 'var(--panel)' : 'var(--field)' });
      b += T(30, yy + 22, r[0], { s: 15, w: 1 }) + T(30, yy + 42, r[1], { s: 13, m: 1, c: 'var(--muted)' });
      b += T(170, yy + 22, r[2], { s: 15, w: 1, c: r[3] }) + T(170, yy + 42, r[4], { s: 14 });
    });
    y += rows.length * 60 + 12;

    // rules
    b += R(16, y, 608, 226, { rx: 12, f: 'var(--orange)', fo: 0.07, st: 'var(--orange)' });
    b += T(32, y + 28, 'ลำดับที่ Windows ใช้ตัดสินเมื่อสิทธิ์ขัดกัน (สูงไปต่ำ)', { s: 16, w: 1 });
    [['1', 'Deny ที่ตั้งเอง (Explicit Deny)', 'var(--bad)'], ['2', 'Allow ที่ตั้งเอง (Explicit Allow)', 'var(--green)'], ['3', 'Deny ที่สืบทอดมา (Inherited Deny)', 'var(--bad)'], ['4', 'Allow ที่สืบทอดมา (Inherited Allow)', 'var(--green)']].forEach((r, i) => {
      b += B(46, y + 54 + i * 30, r[0], r[2], 11) + T(66, y + 59 + i * 30, r[1], { s: 15 });
    });
    b += T(32, y + 186, 'Allow ของทุกกลุ่มนำมารวมกัน ถ้าไม่มี Allow เลยก็ไม่มีสิทธิ์', { s: 14 });
    b += T(32, y + 208, 'Allow ที่ตั้งเองชนะ Deny ที่สืบทอดมาได้', { s: 14 });
    y += 226 + 14;
    b += R(16, y, 608, 82, { rx: 12, f: 'var(--blue)', fo: 0.07, st: 'var(--blue)' });
    b += T(32, y + 28, 'เข้าผ่านเครือข่าย: Share + NTFS = เลือกค่าที่เข้มงวดกว่า', { s: 15, w: 1 });
    b += T(32, y + 56, 'เช่น Share ให้ Read แต่ NTFS ให้ Modify สมชายจะแก้ ราคา.xlsx ไม่ได้ ได้แค่ Read', { s: 14 });
    y += 82 + 16;
    NL_FIG('diagram', 'ntfs-inheritance', svg(N, y, 'ต้นไม้โฟลเดอร์ D:\\Data มีสิทธิ์ Staff Read & execute ที่สืบทอดลงไป Sales และ ราคา.xlsx, Sales ตั้ง Allow Modify ให้กลุ่ม Sales, HR ปิดการสืบทอดและให้ HR Modify, เงินเดือน.xlsx ตั้ง Deny Full control ให้ Interns ผลคือ สมชาย (Staff, Sales) ได้ Modify ที่ ราคา.xlsx ไม่มีสิทธิ์ที่ เงินเดือน.xlsx ส่วนมานี (Staff, HR, Interns) ได้ Read & execute ที่ ราคา.xlsx และไม่มีสิทธิ์ที่ เงินเดือน.xlsx เพราะ Deny ที่ตั้งเองชนะ ลำดับตัดสินคือ Explicit Deny, Explicit Allow, Inherited Deny, Inherited Allow และเมื่อเข้าผ่านเครือข่ายใช้ค่าที่เข้มงวดกว่าระหว่าง Share กับ NTFS', b));
  })();

  /* =====================================================================
     8. group-permissions (w17)
     ===================================================================== */
  (function () {
    const N = 'group-permissions';
    const defs = marker(N + '-a', 'var(--muted)');
    let b = '', y = 16;
    b += T(320, y + 18, 'ให้สิทธิ์รายคน เทียบกับ ให้สิทธิ์ผ่านกลุ่ม', { s: 18, a: 'middle', w: 1 });
    y += 44;
    const users = [['สมศรี', 'บัญชี'], ['วิภา', 'บัญชี'], ['ก้อง', 'ขาย'], ['นภา', 'ขาย'], ['ต้น', 'IT'], ['เอ', 'IT']];
    function person(x, yy, n, c) {
      return `<circle cx="${x + 12}" cy="${yy + 10}" r="7" fill="${c}" fill-opacity="0.25" stroke="${c}" stroke-width="1.5"/><path d="M${x + 1},${yy + 28} Q${x + 12},${yy + 14} ${x + 23},${yy + 28}" fill="${c}" fill-opacity="0.25" stroke="${c}" stroke-width="1.5"/>` + T(x + 32, yy + 23, n, { s: 15, w: 1 });
    }
    function fold(x, yy, n, w) {
      return R(x, yy, w || 140, 38, { rx: 6, f: 'var(--orange)', fo: 0.12, st: 'var(--orange)' }) + `<path d="M${x + 10},${yy + 13} L${x + 18},${yy + 13} L${x + 21},${yy + 9} L${x + 32},${yy + 9} L${x + 32},${yy + 28} L${x + 10},${yy + 28} Z" fill="var(--orange)" fill-opacity="0.35" stroke="var(--orange)" stroke-width="1.3"/>` + T(x + 40, yy + 25, n, { s: 15, w: 1 });
    }
    // ---- panel A: per user
    b += R(16, y, 608, 380, { rx: 12, f: 'var(--bad)', fo: 0.05, st: 'var(--bad)', d: '7 5' });
    b += T(32, y + 30, 'แบบ ก: ให้สิทธิ์ทีละคน', { s: 16, w: 1, c: 'var(--bad)' });
    const ay = y + 52;
    users.forEach((u, i) => { b += person(40, ay + i * 44, u[0], 'var(--muted)'); });
    const fA = [['บัญชี', ay + 30], ['ฝ่ายขาย', ay + 120], ['โปรแกรมติดตั้ง', ay + 210]];
    fA.forEach(f => { b += fold(440, f[1], f[0], 170); });
    const links = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 1], [3, 1], [3, 0, 1], [4, 2], [4, 0], [5, 2], [5, 1]];
    links.forEach(k => {
      const yu = ay + k[0] * 44 + 16, yf = fA[k[1]][1] + 19;
      b += P(`M112,${yu} C260,${yu} 300,${yf} 438,${yf}`, { c: k[2] ? 'var(--bad)' : 'var(--muted)', sw: k[2] ? 2.6 : 1.6, d: k[2] ? '6 4' : null });
    });
    b += T(32, y + 326, links.length + ' รายการสิทธิ์ที่ต้องตั้งและตามแก้ทีละคน', { s: 14, w: 1 });
    b += T(32, y + 350, 'เส้นประแดง: นภาย้ายจากบัญชีไปฝ่ายขาย แต่สิทธิ์เก่ายังค้างอยู่', { s: 14, c: 'var(--bad)' });
    b += T(32, y + 372, 'IT เปิดไฟล์บัญชีได้ทั้งที่งานไม่ต้องใช้', { s: 14, c: 'var(--bad)' });
    y += 380 + 20;

    // ---- panel B: via groups
    b += R(16, y, 608, 440, { rx: 12, f: 'var(--green)', fo: 0.05, st: 'var(--green)' });
    b += T(32, y + 30, 'แบบ ข: ผู้ใช้ → กลุ่ม → สิทธิ์บนโฟลเดอร์', { s: 16, w: 1, c: 'var(--green)' });
    const by = y + 56;
    b += T(40, by, 'ผู้ใช้', { s: 13, c: 'var(--muted)', w: 1 }) + T(216, by, 'กลุ่ม', { s: 13, c: 'var(--muted)', w: 1 }) + T(440, by, 'โฟลเดอร์และสิทธิ์', { s: 13, c: 'var(--muted)', w: 1 });
    const gc = ['var(--blue)', 'var(--green)', 'var(--brown)'];
    const groups = [['ฝ่ายบัญชี', by + 34], ['ฝ่ายขาย', by + 134], ['IT', by + 234]];
    users.forEach((u, i) => {
      const g = Math.floor(i / 2), yy = by + 14 + i * 50;
      b += person(36, yy, u[0], gc[g]);
      b += L(142, yy + 16, 208, groups[g][1] + 20, { c: gc[g], sw: 1.8 });
    });
    groups.forEach((g, i) => {
      b += R(210, g[1], 120, 40, { rx: 20, f: gc[i], fo: 0.16, st: gc[i], sw: 2 }) + T(270, g[1] + 26, g[0], { s: 15, a: 'middle', w: 1 });
    });
    const fB = [['บัญชี', by + 20], ['ฝ่ายขาย', by + 120], ['โปรแกรมติดตั้ง', by + 220]];
    fB.forEach(f => { b += fold(440, f[1], f[0], 170); });
    function perm(g, f, label, dy) {
      const y1 = groups[g][1] + 20, y2 = fB[f][1] + 19 + (dy || 0);
      b += P(`M330,${y1} C380,${y1} 390,${y2} 436,${y2}`, { c: gc[g], sw: 2.2, me: N + '-a' });
      b += R(352, (y1 + y2) / 2 - 12 + (dy || 0) * 0.3, 66, 22, { rx: 11, f: 'var(--panel)', st: gc[g] }) + T(385, (y1 + y2) / 2 + 4 + (dy || 0) * 0.3, label, { s: 13, a: 'middle', w: 1 });
    }
    perm(0, 0, 'Modify');
    perm(1, 1, 'Modify');
    perm(0, 1, 'Read', -8);
    perm(2, 2, 'Modify');
    b += T(32, y + 372, '4 รายการสิทธิ์ ใช้ได้กับคนกี่คนก็ได้', { s: 14, w: 1 });
    b += T(32, y + 396, 'พนักงานใหม่หรือย้ายแผนก: แก้แค่การเป็นสมาชิกกลุ่มครั้งเดียว', { s: 14 });
    b += T(32, y + 420, 'บัญชีได้ Read ฝ่ายขายเพื่อดูยอดขาย IT ไม่ได้สิทธิ์ข้อมูลบัญชี', { s: 14 });
    y += 440 + 18;
    b += R(16, y, 608, 92, { rx: 12, f: 'var(--blue)', fo: 0.07, st: 'var(--blue)' });
    b += T(32, y + 28, 'หลัก Least Privilege: ให้เท่าที่งานต้องใช้', { s: 15, w: 1 });
    b += T(32, y + 54, 'เริ่มจากไม่มีสิทธิ์ แล้วเพิ่มให้กลุ่มทีละอย่าง (Read ก่อน Modify)', { s: 14 });
    b += T(32, y + 78, 'บัญชีถูกขโมยหรือติดมัลแวร์ ความเสียหายจะจำกัดอยู่แค่สิทธิ์ของกลุ่มนั้น', { s: 14 });
    y += 92 + 16;
    NL_FIG('diagram', 'group-permissions', svg(N, y, 'เปรียบเทียบการให้สิทธิ์ทีละคน 11 รายการที่ยุ่งและมีสิทธิ์ค้างเมื่อย้ายแผนก กับการให้สิทธิ์ผ่านกลุ่ม ฝ่ายบัญชี ฝ่ายขาย และ IT: ฝ่ายบัญชีได้ Modify โฟลเดอร์บัญชีและ Read ฝ่ายขาย ฝ่ายขายได้ Modify ฝ่ายขาย IT ได้ Modify โปรแกรมติดตั้ง รวม 4 รายการ ตามหลัก Least Privilege', b, defs));
  })();

  /* =====================================================================
     9. user-mgmt-screen (w17)
     ===================================================================== */
  (function () {
    const N = 'user-mgmt-screen';
    let b = '', y = 16;
    const MOCK = 'ภาพจำลองหน้าจอ';
    b += T(320, y + 18, 'จัดการบัญชีด้วย Local Users and Groups (lusrmgr.msc)', { s: 17, a: 'middle', w: 1 });
    b += T(320, y + 42, 'ภาพจำลองหน้าจอ วาดขึ้นใหม่เพื่อการเรียน (Windows 10/11 Pro ขึ้นไป)', { s: 14, a: 'middle', c: 'var(--muted)' });
    y += 60;
    // main window
    const WH = 252;
    b += WIN(16, y, 608, WH, 'lusrmgr - Local Users and Groups (Local)\\Users', MOCK);
    // left tree
    b += R(24, y + 38, 160, WH - 46, { rx: 4, f: 'var(--field)' });
    b += T(34, y + 62, 'Local Users and', { s: 13, w: 1 }) + T(34, y + 80, 'Groups (Local)', { s: 13, w: 1 });
    b += R(40, y + 92, 120, 26, { rx: 4, f: 'var(--blue)', fo: 0.18, st: 'var(--blue)' }) + T(52, y + 110, 'Users', { s: 14, w: 1 });
    b += T(52, y + 142, 'Groups', { s: 14 });
    // list
    const lx = 194;
    b += R(lx, y + 38, 422, 28, { rx: 0, f: 'var(--field)', st: 'var(--line)' });
    b += T(lx + 10, y + 57, 'Name', { s: 13, w: 1 }) + T(lx + 140, y + 57, 'Full Name', { s: 13, w: 1 }) + T(lx + 260, y + 57, 'Description', { s: 13, w: 1 });
    const acc = [['Administrator', '', 'Built-in account...', true], ['DefaultAccount', '', 'A user account...', true], ['Guest', '', 'Built-in account...', true], ['std01', 'Somchai J.', 'นักเรียน ปวช.2/1', false], ['teacher', 'Kru Malee', 'ครูประจำห้อง', false]];
    acc.forEach((a, i) => {
      const yy = y + 90 + i * 32;
      b += `<circle cx="${lx + 18}" cy="${yy - 5}" r="7" fill="var(--muted)" fill-opacity="0.25" stroke="var(--muted)" stroke-width="1.4"/>`;
      if (a[3]) b += `<circle cx="${lx + 25}" cy="${yy + 3}" r="6" fill="var(--panel)" stroke="var(--bad)" stroke-width="1.4"/>` + P(`M${lx + 25},${yy - 1} L${lx + 25},${yy + 6} M${lx + 22},${yy + 3} L${lx + 25},${yy + 6} L${lx + 28},${yy + 3}`, { c: 'var(--bad)', sw: 1.4 });
      b += T(lx + 36, yy, a[0], { s: 13, w: a[3] ? 0 : 1, c: a[3] ? 'var(--muted)' : 'var(--ink)' }) + T(lx + 140, yy, a[1], { s: 13 }) + T(lx + 260, yy, a[2], { s: 13, c: 'var(--muted)' });
    });
    y += WH + 12;
    b += `<circle cx="34" cy="${y + 9}" r="6" fill="var(--panel)" stroke="var(--bad)" stroke-width="1.4"/>` + P(`M34,${y + 5} L34,${y + 12} M31,${y + 9} L34,${y + 12} L37,${y + 9}`, { c: 'var(--bad)', sw: 1.4 });
    b += T(50, y + 14, 'ไอคอนมีลูกศรลง = บัญชีถูกปิด (Account is disabled) เช่น Administrator, Guest', { s: 14 });
    y += 26;
    b += T(34, y + 14, 'คลิกขวาที่ Users → New User... เพื่อเปิดหน้าต่างด้านล่าง', { s: 14, c: 'var(--muted)' });
    y += 36;

    // new user dialog
    const DH = 420;
    b += WIN(16, y, 608, DH, 'New User', MOCK);
    let r = y + 46;
    [['User name:', 'std01', 1], ['Full name:', 'Somchai Jaidee', 0], ['Description:', 'นักเรียน ปวช.2/1', 0]].forEach(f => {
      b += T(32, r + 19, f[0], { s: 14 }) + FLD(160, r, 250, f[1], { hl: f[2] }); r += 36;
    });
    b += B(430, y + 60, '1', 'var(--orange)', 11) + T(448, y + 65, 'ชื่อที่ใช้ล็อกอิน', { s: 14 });
    b += T(448, y + 87, 'ห้ามซ้ำในเครื่อง', { s: 13, c: 'var(--muted)' });
    r += 6;
    b += T(32, r + 19, 'Password:', { s: 14 }) + FLD(160, r, 250, '••••••••••••••'); r += 36;
    b += T(32, r + 19, 'Confirm password:', { s: 14 }) + FLD(160, r, 250, '••••••••••••••');
    b += B(430, r - 14, '2', 'var(--orange)', 11) + T(448, r - 9, 'พิมพ์ให้ตรงกันทั้งสองช่อง', { s: 14 });
    b += T(448, r + 13, 'ยาวอย่างน้อย 15 ตัว', { s: 13, c: 'var(--muted)' });
    r += 52;
    b += L(32, r - 10, 608, r - 10, { c: 'var(--line)', sw: 1.2 });
    const opts = [['User must change password at next logon', true, 'บังคับตั้งรหัสใหม่เมื่อเข้าครั้งแรก'], ['User cannot change password', false, 'ผู้ใช้เปลี่ยนรหัสเองไม่ได้'], ['Password never expires', false, 'รหัสไม่หมดอายุตามนโยบาย'], ['Account is disabled', false, 'ปิดบัญชีไว้ก่อน']];
    opts.forEach((o, i) => {
      b += CB(32, r + 14 + i * 30, o[1], o[0], { w: o[1] ? 1 : 0 });
      b += T(400, r + 14 + i * 30, o[2], { s: 13, c: 'var(--muted)' });
    });
    b += B(594, r - 10, '3', 'var(--orange)', 11);
    r += 130;
    b += R(330, r - 8, 84, 32, { rx: 6, f: 'var(--field)' }) + T(372, r + 13, 'Help', { s: 14, a: 'middle' });
    b += R(424, r - 8, 84, 32, { rx: 6, f: 'var(--blue)', st: 'var(--blue)' }) + T(466, r + 13, 'Create', { s: 14, a: 'middle', c: 'var(--on-accent)', w: 1 });
    b += R(518, r - 8, 84, 32, { rx: 6, f: 'var(--field)' }) + T(560, r + 13, 'Close', { s: 14, a: 'middle' });
    y += DH + 14;
    b += B(30, y + 9, '3', 'var(--orange)', 11) + T(50, y + 14, 'ค่าเริ่มต้นติ๊กข้อแรกไว้ ถ้าติ๊กข้อแรกจะติ๊ก User cannot change password', { s: 14 });
    b += T(50, y + 36, 'หรือ Password never expires พร้อมกันไม่ได้ เพราะขัดกัน', { s: 14 });
    b += T(50, y + 58, 'กด Create แล้วบัญชีใหม่เป็นสมาชิกกลุ่ม Users อัตโนมัติ', { s: 14 });
    y += 84;

    // commands side by side
    b += T(320, y + 10, 'งานเดียวกันด้วยคำสั่ง', { s: 17, a: 'middle', w: 1 });
    y += 26;
    b += R(16, y, 300, 30, { rx: 6, f: 'var(--blue)', fo: 0.14, st: 'var(--blue)' }) + T(166, y + 21, 'Windows (cmd แบบ Run as administrator)', { s: 13, a: 'middle', w: 1 });
    b += R(324, y, 300, 30, { rx: 6, f: 'var(--green)', fo: 0.14, st: 'var(--green)' }) + T(474, y + 21, 'Linux (Ubuntu ใช้ sudo)', { s: 13, a: 'middle', w: 1 });
    y += 42;
    const cmds = [
      ['สร้างบัญชี', 'net user std01 * /add', 'sudo useradd -m -s /bin/bash std01'],
      ['ตั้ง/เปลี่ยนรหัสผ่าน', 'net user std01 *', 'sudo passwd std01'],
      ['บังคับเปลี่ยนรหัสเมื่อเข้าระบบครั้งถัดไป', 'net user std01 /logonpasswordchg:yes', 'sudo passwd -e std01'],
      ['สร้างกลุ่ม', 'net localgroup Students /add', 'sudo groupadd students'],
      ['เพิ่มสมาชิกเข้ากลุ่ม', 'net localgroup Students std01 /add', 'sudo usermod -aG students std01'],
      ['ปิดใช้งานบัญชี', 'net user std01 /active:no', 'sudo usermod -L -e 1 std01'],
      ['ดูรายละเอียดและกลุ่มที่สังกัด', 'net user std01', 'id std01']
    ];
    cmds.forEach(c => {
      b += T(16, y + 14, c[0], { s: 14, w: 1 });
      b += R(16, y + 22, 300, 30, { rx: 5, f: 'var(--term-bg)', st: 'var(--term-bg)' }) + T(26, y + 42, c[1], { s: 13, m: 1, c: 'var(--term-ink)' });
      b += R(324, y + 22, 300, 30, { rx: 5, f: 'var(--term-bg)', st: 'var(--term-bg)' }) + T(334, y + 42, c[2], { s: 13, m: 1, c: 'var(--term-ink)' });
      y += 64;
    });
    b += R(16, y, 608, 118, { rx: 10, f: 'var(--field)' });
    b += TL(30, y + 26, [
      'Windows: เครื่องหมาย * ให้พิมพ์รหัสแบบไม่แสดงบนจอ',
      'Linux -aG: a = append เพิ่มต่อจากกลุ่มเดิม ถ้าลืม -a จะถูกถอดจากกลุ่มเสริมเดิม',
      'useradd -m สร้างโฮมไดเรกทอรี ส่วน Ubuntu มี adduser ที่ถามทีละขั้น',
      'usermod -L ล็อกรหัสผ่าน และ -e 1 ทำให้บัญชีหมดอายุ จึงเข้าระบบไม่ได้'
    ], { s: 13.5 }, 24);
    y += 118 + 16;
    NL_FIG('diagram', 'user-mgmt-screen', svg(N, y, 'ภาพจำลองหน้าจอ Local Users and Groups ที่มีรายการ Users โดยบัญชีที่ปิดอยู่มีลูกศรลง และหน้าต่าง New User ที่มีช่อง User name, Full name, Description, Password, Confirm password และตัวเลือก User must change password at next logon ซึ่งติ๊กเป็นค่าเริ่มต้น User cannot change password, Password never expires, Account is disabled พร้อมตารางเทียบคำสั่ง Windows net user และ net localgroup กับ Linux useradd passwd groupadd usermod -aG และ id', b));
  })();
})();

/* ======================= widgets (batch c) ======================= */
(function () {
  const CSS = `
.nlwc [hidden]{display:none !important}
.nlwc .nlwc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px;margin:8px 0}
.nlwc .nlwc-card{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--field);min-width:0}
.nlwc .nlwc-card h4{margin:0 0 6px;font-size:15.5px;line-height:1.35}
.nlwc .nlwc-card p{margin:.2em 0;font-size:14.5px}
.nlwc .nlwc-kv{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:14.5px}
.nlwc .nlwc-kv dt{color:var(--muted)}.nlwc .nlwc-kv dd{margin:0;font-weight:600;min-width:0;overflow-wrap:anywhere}
.nlwc .nlwc-btns{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.nlwc .nlwc-tree{list-style:none;margin:6px 0;padding:0}
.nlwc .nlwc-tree li{margin:4px 0}
.nlwc .nlwc-snap{width:100%;text-align:left;display:flex;gap:8px;align-items:flex-start}
.nlwc .nlwc-snap small{display:block;font-size:13px;color:var(--muted);font-weight:400}
.nlwc .nlwc-snap[aria-pressed="true"] small{color:inherit}
.nlwc .nlwc-cur{border:2px dashed var(--orange);border-radius:8px;padding:6px 10px;font-size:14.5px;background:var(--panel)}
.nlwc .nlwc-chain{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;line-height:1.7;overflow-wrap:anywhere}
.nlwc .nlwc-chain span{display:inline-block;border:1px solid var(--line);border-radius:5px;padding:0 6px;background:var(--panel);margin:1px 0}
.nlwc .nlwc-chain span.nlwc-w{border-color:var(--orange);border-width:2px}
.nlwc .nlwc-bad{color:var(--bad);font-weight:600}.nlwc .nlwc-ok{color:var(--ok);font-weight:600}
.nlwc .nlwc-term{font-family:"JetBrains Mono",Consolas,monospace;font-size:12.5px;line-height:1.5;background:var(--term-bg);color:var(--term-ink);border-radius:8px;padding:10px 12px;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0}
.nlwc .nlwc-steps{list-style:none;padding:0;margin:6px 0;counter-reset:s}
.nlwc .nlwc-steps li{border-left:4px solid var(--line);background:var(--field);border-radius:0 8px 8px 0;padding:6px 10px;margin:6px 0;font-size:14.5px}
.nlwc .nlwc-steps li.nlwc-s-ok{border-left-color:var(--ok)}
.nlwc .nlwc-steps li.nlwc-s-fail{border-left-color:var(--bad);background:color-mix(in srgb,var(--bad) 9%,var(--field))}
.nlwc .nlwc-steps li.nlwc-s-skip{color:var(--muted)} .nlwc .nlwc-steps li.nlwc-s-skip b{color:var(--muted)}
.nlwc .nlwc-steps li.nlwc-s-now{outline:2px solid var(--blue);outline-offset:1px}
.nlwc .nlwc-steps li b{display:block}
.nlwc .nlwc-svg{display:block;width:100%;height:auto;max-width:620px;margin:6px auto}
.nlwc .nlwc-hl{color:var(--bad);font-weight:700}
.nlwc .nlwc-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:6px;margin:8px 0}
.nlwc .nlwc-opts .nlw-btn{width:100%;text-align:left;min-height:44px}
.nlwc .nlwc-opts .nlw-btn.nlwc-k{box-shadow:inset 5px 0 0 var(--ok)}
.nlwc .nlwc-opts .nlw-btn.nlwc-p{box-shadow:inset 5px 0 0 var(--orange)}
.nlwc .nlwc-opts .nlw-btn.nlwc-x{box-shadow:inset 5px 0 0 var(--bad)}
.nlwc .nlwc-fb{list-style:none;padding:0;margin:6px 0}
.nlwc .nlwc-fb li{border-left:4px solid var(--line);padding:5px 10px;margin:5px 0;background:var(--field);border-radius:0 6px 6px 0;font-size:14.5px}
.nlwc .nlwc-fb li.nlwc-k{border-left-color:var(--ok)}.nlwc .nlwc-fb li.nlwc-p{border-left-color:var(--orange)}.nlwc .nlwc-fb li.nlwc-x{border-left-color:var(--bad)}.nlwc .nlwc-fb li.nlwc-m{border-left-color:var(--blue)}
.nlwc .nlwc-tag{display:inline-block;font-size:12.5px;font-weight:600;border:1px solid currentColor;border-radius:4px;padding:0 5px;margin:0 3px 0 0;color:var(--muted)}
.nlwc .nlwc-scn{font-size:15.5px;border:1px solid var(--line);border-left:5px solid var(--orange);border-radius:0 10px 10px 0;padding:10px 12px;background:var(--field);margin:8px 0}
@media (pointer:coarse){.nlwc .nlw-btn{min-height:44px}.nlwc .nlw-btn.nlw-sm{min-width:44px}}
`;
  function injectCSS() {
    if (!document.getElementById('nl-widget-css')) {
      const base = window.NL_WIDGETS && window.NL_WIDGETS['caesar'];
      if (typeof base === 'function') { try { base(document.createElement('div')); } catch (e) { /* base css only */ } }
    }
    if (document.getElementById('nlwc-css')) return;
    const st = document.createElement('style'); st.id = 'nlwc-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  const PROPS = { value: 1, checked: 1, disabled: 1, selected: 1 };
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
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
    root.classList.add('nlw', 'nlwc');
    root.appendChild(h('div', { class: 'nlw-title' }, title));
    root.appendChild(h('p', { class: 'nlw-instr' }, h('b', null, 'คำแนะนำการใช้งาน: '), instr));
    return root;
  }
  function seg(options, value, onChange, label) {
    const wrap = h('div', { class: 'nlw-seg', role: 'group', 'aria-label': label || null });
    const btns = options.map(o => { const b = h('button', { type: 'button', class: 'nlw-btn', 'data-v': o[0], 'aria-pressed': String(o[0] === value), onclick: () => { api.set(o[0]); onChange(o[0]); } }, o[1]); wrap.appendChild(b); return b; });
    const api = { el: wrap, set(v) { btns.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === String(v)))); } };
    return api;
  }

  /* ===================================================================
     snapshot-restore: VM state + snapshot tree + differencing images
     =================================================================== */
  const SN_ACTIONS = [
    ['app', 'ติดตั้งโปรแกรม (apt install nginx)', 180],
    ['net', 'แก้ไฟล์ตั้งค่าเครือข่ายผิด', 1],
    ['mal', 'รันไฟล์มัลแวร์ทดลองในแล็บ', 25],
    ['doc', 'สร้างไฟล์งานใหม่', 5]
  ];
  function snapshotRestore(root) {
    frame(root, 'จำลอง Snapshot และ Restore', 'กด Take Snapshot เพื่อบันทึกสถานะ แล้วลองเปลี่ยนเครื่อง (ติดตั้งโปรแกรม ตั้งค่าผิด ติดมัลแวร์) จากนั้นแตะเลือก Snapshot แล้วกด Restore ดูว่าสถานะกลับเป็นอย่างไร ลองกด "ดิสก์ของ Host เสีย" เพื่อดูว่าทำไม Snapshot ไม่ใช่ Backup ในโปรแกรมจริงควรปิดเครื่องจำลองก่อน Restore');
    let S, uid;
    function fresh() {
      uid = 0;
      S = { snaps: [], cur: { parent: null, img: 'base', st: { apps: [], net: true, mal: false, docs: 0 } }, images: { base: { name: 'SRV01-Ubuntu.vdi', mb: 6200, base: true } }, sel: null, lost: false, backup: null, msg: 'เริ่มจากเครื่องจำลอง Ubuntu Server ที่ติดตั้งเสร็จแล้ว ยังไม่มี Snapshot การเปลี่ยนแปลงทั้งหมดเขียนลงไฟล์ดิสก์หลักโดยตรง', kind: 'i' };
    }
    const clone = st => ({ apps: st.apps.slice(), net: st.net, mal: st.mal, docs: st.docs });
    function newDiff() { uid++; const id = 'd' + uid; S.images[id] = { name: '{diff-' + uid + '}.vdi', mb: 0, base: false }; return id; }
    function depth(s) { let d = 0, p = s.parent; while (p) { d++; p = S.snaps.find(x => x.id === p).parent; } return d; }
    function children(id) { return S.snaps.filter(x => x.parent === id).length + (S.cur.parent === id ? 1 : 0); }
    function chainFrom(img) {
      // image chain: current diff -> parent snapshot images up to base
      const out = [img]; let p = S.cur.parent;
      while (p) { const sn = S.snaps.find(x => x.id === p); out.push(sn.img); p = sn.parent; }
      return out;
    }
    const nameIn = h('input', { type: 'text', value: 'หลังติดตั้งเสร็จ', 'aria-label': 'ชื่อ Snapshot', maxlength: '40', style: 'flex:1 1 180px' });
    const takeBtn = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: take }, 'Take Snapshot');
    const actWrap = h('div', { class: 'nlwc-btns', role: 'group', 'aria-label': 'เปลี่ยนแปลงเครื่องจำลอง' });
    const actBtns = SN_ACTIONS.map(a => h('button', { type: 'button', class: 'nlw-btn', 'data-act': a[0], onclick: () => act(a) }, a[1]));
    actWrap.append(...actBtns);
    const stBox = h('div', { class: 'nlwc-card' });
    const treeBox = h('div', { class: 'nlwc-card' });
    const diskBox = h('div', { class: 'nlwc-card' });
    const restoreBtn = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: restore }, 'Restore');
    const delBtn = h('button', { type: 'button', class: 'nlw-btn', onclick: del }, 'Delete Snapshot');
    const fail = h('button', { type: 'button', class: 'nlw-btn', onclick: hostFail }, 'ดิสก์ของ Host เสีย');
    const bkBtn = h('button', { type: 'button', class: 'nlw-btn', onclick: backup }, 'Backup: Export ไปฮาร์ดดิสก์ภายนอก');
    const fromBk = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: restoreBackup }, 'กู้จาก Backup');
    const reset = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { fresh(); render(); } }, 'เริ่มใหม่');
    const msg = h('div', { class: 'nlw-result', 'aria-live': 'polite' });
    root.append(
      h('div', { class: 'nlw-row nlw-center' }, nameIn, takeBtn),
      h('div', { class: 'nlw-small' }, 'เปลี่ยนแปลงเครื่องจำลอง (Current State):'), actWrap,
      msg,
      h('div', { class: 'nlwc-grid' }, stBox, treeBox),
      diskBox,
      h('div', { class: 'nlw-row nlw-center' }, bkBtn, fail, fromBk, reset));
    function say(t, k) { S.msg = t; S.kind = k || 'i'; }
    function take() {
      if (S.lost) return;
      const nm = nameIn.value.trim() || ('Snapshot ' + (S.snaps.length + 1));
      const id = 's' + (S.snaps.length + 1) + '-' + uid;
      // freeze the current image, keep writing to a new differencing image
      const frozen = S.cur.img;
      S.snaps.push({ id, name: nm, parent: S.cur.parent, img: frozen, st: clone(S.cur.st) });
      S.cur = { parent: id, img: newDiff(), st: S.cur.st };
      S.sel = id;
      nameIn.value = 'Snapshot ' + (S.snaps.length + 1);
      say('สร้าง Snapshot "' + nm + '" แล้ว ไฟล์ ' + S.images[frozen].name + ' ถูกหยุดเขียน การเปลี่ยนแปลงต่อจากนี้ไปลงไฟล์ส่วนต่าง ' + S.images[S.cur.img].name, 'ok');
      render();
    }
    function act(a) {
      if (S.lost) return;
      const st = S.cur.st;
      if (a[0] === 'app') { if (st.apps.includes('nginx')) { say('nginx ติดตั้งอยู่แล้ว', 'warn'); render(); return; } st.apps.push('nginx'); say('ติดตั้ง nginx แล้ว ข้อมูลใหม่ถูกเขียนลงไฟล์ ' + S.images[S.cur.img].name, 'i'); }
      if (a[0] === 'net') { if (!st.net) { say('ไฟล์ตั้งค่าเครือข่ายผิดอยู่แล้ว', 'warn'); render(); return; } st.net = false; say('ตั้งค่าเครือข่ายผิด เครื่องจำลอง ping Gateway ไม่ผ่านแล้ว', 'bad'); }
      if (a[0] === 'mal') { if (st.mal) { say('เครื่องติดมัลแวร์อยู่แล้ว', 'warn'); render(); return; } st.mal = true; say('เครื่องจำลองติดมัลแวร์ (ทดลองในแล็บที่ตัดจากเครือข่ายจริง)', 'bad'); }
      if (a[0] === 'doc') { st.docs++; say('สร้างไฟล์งาน report-' + st.docs + '.txt แล้ว ไฟล์นี้จะหายถ้า Restore ไปจุดที่สร้างก่อนหน้า', 'i'); }
      S.images[S.cur.img].mb += a[2];
      render();
    }
    function restore() {
      if (S.lost || !S.sel) return;
      const sn = S.snaps.find(x => x.id === S.sel);
      const dropped = S.images[S.cur.img];
      const lostDocs = Math.max(0, S.cur.st.docs - sn.st.docs);
      delete S.images[S.cur.img];
      S.cur = { parent: sn.id, img: newDiff(), st: clone(sn.st) };
      say('Restore ไป "' + sn.name + '" แล้ว ทิ้งไฟล์ส่วนต่าง ' + dropped.name + ' (' + dropped.mb + ' MB) เครื่องกลับไปเหมือนตอนสร้าง Snapshot' + (lostDocs ? ' ไฟล์งานที่สร้างหลังจุดนั้น ' + lostDocs + ' ไฟล์หายไปด้วย' : '') + (sn.st.mal ? ' ระวัง: Snapshot นี้ถ่ายตอนติดมัลแวร์แล้ว จึงยังมีมัลแวร์อยู่' : ''), sn.st.mal ? 'warn' : 'ok');
      render();
    }
    function del() {
      if (S.lost || !S.sel) return;
      const sn = S.snaps.find(x => x.id === S.sel);
      if (children(sn.id) > 1) { say('ลบ "' + sn.name + '" ไม่ได้ในเครื่องจำลองนี้ เพราะมีสาขาต่อจาก Snapshot นี้มากกว่าหนึ่งทาง ต้องลบสาขาอื่นก่อน', 'warn'); render(); return; }
      // merge this snapshot's image into its single child
      const childSnap = S.snaps.find(x => x.parent === sn.id);
      const childImg = childSnap ? childSnap.img : S.cur.img;
      S.images[childImg].mb += S.images[sn.img].mb;
      if (S.images[sn.img].base) { S.images[childImg] = { name: S.images[sn.img].name, mb: S.images[childImg].mb, base: true }; }
      delete S.images[sn.img];
      if (childSnap) childSnap.parent = sn.parent; else S.cur.parent = sn.parent;
      S.snaps = S.snaps.filter(x => x !== sn);
      S.sel = null;
      say('ลบ Snapshot "' + sn.name + '" แล้ว โปรแกรมรวม (merge) ไฟล์ดิสก์ของจุดนั้นเข้ากับไฟล์ถัดไป สถานะปัจจุบันไม่เปลี่ยน แต่ย้อนกลับไปจุดนั้นไม่ได้อีก', 'ok');
      render();
    }
    function backup() {
      if (S.lost) return;
      S.backup = { st: clone(S.cur.st) };
      say('Export เครื่องจำลอง (สถานะปัจจุบัน) เป็นไฟล์ .ova ไปเก็บในฮาร์ดดิสก์ภายนอกแล้ว นี่คือ Backup เพราะอยู่คนละสื่อกับดิสก์ของ Host', 'ok');
      render();
    }
    function hostFail() {
      if (S.lost) return;
      S.lost = true; S.snaps = []; S.images = {}; S.sel = null;
      say('ดิสก์ของ Host เสีย ไฟล์ดิสก์หลักและไฟล์ส่วนต่างของทุก Snapshot อยู่ในโฟลเดอร์เดียวกันบนดิสก์นี้ จึงหายหมด Snapshot ช่วยไม่ได้' + (S.backup ? ' แต่ยังมี Backup ในฮาร์ดดิสก์ภายนอก' : ' และยังไม่เคยทำ Backup'), 'bad');
      render();
    }
    function restoreBackup() {
      if (!S.lost || !S.backup) return;
      uid = 0; S.lost = false;
      S.images = { base: { name: 'SRV01-Ubuntu.vdi', mb: 6200, base: true } };
      S.cur = { parent: null, img: 'base', st: clone(S.backup.st) };
      say('Import จาก Backup แล้ว ได้เครื่องคืนตามสถานะตอน Export แต่ไม่มี Snapshot เดิมติดมา', 'ok');
      render();
    }
    function stateList(st) {
      return h('dl', { class: 'nlwc-kv' },
        h('dt', null, 'โปรแกรมเพิ่ม'), h('dd', null, st.apps.length ? st.apps.join(', ') : 'ไม่มี'),
        h('dt', null, 'เครือข่าย'), h('dd', { class: st.net ? 'nlwc-ok' : 'nlwc-bad' }, st.net ? 'ใช้งานได้' : 'ตั้งค่าผิด ping ไม่ผ่าน'),
        h('dt', null, 'มัลแวร์'), h('dd', { class: st.mal ? 'nlwc-bad' : 'nlwc-ok' }, st.mal ? 'ติดมัลแวร์' : 'สะอาด'),
        h('dt', null, 'ไฟล์งาน'), h('dd', null, st.docs ? st.docs + ' ไฟล์' : 'ไม่มี'));
    }
    function short(st) { return [st.apps.length ? st.apps.join(',') : 'ไม่มีโปรแกรมเพิ่ม', st.net ? 'เน็ตปกติ' : 'เน็ตเสีย', st.mal ? 'มีมัลแวร์' : 'สะอาด', 'งาน ' + st.docs].join(' · '); }
    function render() {
      msg.className = 'nlw-result ' + (S.kind === 'ok' ? 'nlw-is-ok' : S.kind === 'bad' ? 'nlw-is-bad' : S.kind === 'warn' ? 'nlw-is-warn' : '');
      msg.textContent = S.msg;
      [takeBtn, nameIn, bkBtn, fail].concat(actBtns).forEach(b => { b.disabled = S.lost; });
      fromBk.hidden = !(S.lost && S.backup);
      // state
      stBox.replaceChildren(h('h4', null, 'สถานะเครื่องจำลองตอนนี้'), S.lost ? h('p', { class: 'nlwc-bad' }, 'ไม่มีเครื่องจำลอง: ไฟล์หายไปกับดิสก์ของ Host') : stateList(S.cur.st),
        S.backup ? h('p', { class: 'nlw-small' }, 'มี Backup ภายนอก: ' + short(S.backup.st)) : h('p', { class: 'nlw-small' }, 'ยังไม่มี Backup ภายนอก'));
      // tree (depth-first)
      const list = h('ul', { class: 'nlwc-tree' });
      function walk(parent, d) {
        S.snaps.filter(x => x.parent === parent).forEach(sn => {
          list.append(h('li', { style: 'margin-left:' + (d * 18) + 'px' }, h('button', { type: 'button', class: 'nlw-btn nlwc-snap', 'aria-pressed': String(S.sel === sn.id), onclick: () => { S.sel = S.sel === sn.id ? null : sn.id; render(); } },
            h('span', { 'aria-hidden': 'true' }, '◉'), h('span', null, sn.name, h('small', null, short(sn.st))))));
          walk(sn.id, d + 1);
        });
        if (S.cur.parent === parent && !S.lost) list.append(h('li', { style: 'margin-left:' + (d * 18) + 'px' }, h('div', { class: 'nlwc-cur' }, h('b', null, 'Current State'), ' (สถานะปัจจุบัน ต่อจาก ' + (parent ? S.snaps.find(x => x.id === parent).name : 'ดิสก์หลัก') + ')')));
      }
      walk(null, 0);
      const sel = S.snaps.find(x => x.id === S.sel);
      restoreBtn.disabled = !sel || S.lost; delBtn.disabled = !sel || S.lost;
      treeBox.replaceChildren(h('h4', null, 'Snapshots (' + S.snaps.length + ')'), S.snaps.length || S.lost ? list : h('p', { class: 'nlw-small' }, 'ยังไม่มี Snapshot'),
        h('div', { class: 'nlw-small' }, sel ? 'เลือก: ' + sel.name : 'แตะ Snapshot เพื่อเลือก'), h('div', { class: 'nlwc-btns' }, restoreBtn, delBtn));
      // disks
      if (S.lost) { diskBox.replaceChildren(h('h4', null, 'ไฟล์ดิสก์บน Host'), h('p', { class: 'nlwc-bad' }, 'ไม่เหลือไฟล์ใดเลย')); return; }
      const chain = chainFrom(S.cur.img);
      const total = Object.keys(S.images).reduce((a, k) => a + S.images[k].mb, 0);
      const ch = h('div', { class: 'nlwc-chain' });
      chain.forEach((k, i) => { if (i) ch.append(' → '); ch.append(h('span', { class: i === 0 ? 'nlwc-w' : null }, S.images[k].name + ' ' + (S.images[k].mb >= 1000 ? (S.images[k].mb / 1000).toFixed(1) + ' GB' : S.images[k].mb + ' MB'))); });
      diskBox.replaceChildren(h('h4', null, 'ไฟล์ดิสก์บน Host (โฟลเดอร์ D:\\VMs\\SRV01-Ubuntu)'),
        h('p', { class: 'nlw-small' }, 'เครื่องอ่านข้อมูลไล่จากไฟล์ซ้ายสุด (กรอบส้ม = ไฟล์ที่กำลังเขียน) ไปจนถึงไฟล์หลัก ถ้าไฟล์ใดในสายนี้เสีย เครื่องจะเปิดไม่ได้'),
        ch,
        h('p', { class: 'nlw-small' }, 'มีทั้งหมด ' + Object.keys(S.images).length + ' ไฟล์ รวมประมาณ ' + (total / 1000).toFixed(2) + ' GB ทั้งหมดอยู่บนดิสก์ลูกเดียวกัน Snapshot จึงไม่ใช่ Backup'));
    }
    fresh(); render();
  }

  /* ===================================================================
     gateway-dns-fault: stepper of browsing with config faults
     =================================================================== */
  const GD = {
    me: '192.168.20.105', router: '192.168.20.1', lanDns: '192.168.20.10',
    lan: { '192.168.20.1': 'เราเตอร์ของห้อง', '192.168.20.10': 'DNS Server ของวง' },
    net: { '8.8.8.8': 'DNS สาธารณะ (dns.google)', '203.0.113.80': 'เว็บเซิร์ฟเวอร์ www.example.com' },
    dnsServers: { '192.168.20.10': 'dns.netlab.test', '8.8.8.8': 'dns.google' },
    site: 'www.example.com', siteIp: '203.0.113.80'
  };
  const same24 = (a, b) => a.split('.').slice(0, 3).join('.') === b.split('.').slice(0, 3).join('.');
  function gdConfig(scn, dnsLoc) {
    const good = dnsLoc === 'ext' ? '8.8.8.8' : GD.lanDns;
    return { ip: GD.me, mask: '255.255.255.0', gw: scn === 'gw' ? '192.168.20.254' : GD.router, dns: scn === 'dns' ? '192.168.20.100' : good };
  }
  // path to an IPv4 destination from the PC: {ok, next, same, why}
  function gdReach(cfg, dst) {
    const same = same24(cfg.ip, dst), next = same ? dst : cfg.gw;
    if (!GD.lan[next]) return { ok: false, same, next, arp: false, why: 'ส่ง ARP ถาม "ใครคือ ' + next + '" แล้วไม่มีใครตอบ เพราะไม่มีอุปกรณ์ที่ใช้ IP นี้ในวง' };
    if (same) return { ok: true, same, next, arp: true };
    if (next !== GD.router) return { ok: false, same, next, arp: true, why: next + ' ไม่ใช่เราเตอร์ จึงไม่ส่งต่อออกนอกวง' };
    return GD.net[dst] ? { ok: true, same, next, arp: true } : { ok: false, same, next, arp: true, why: 'ไม่มีเครื่องปลายทาง' };
  }
  function gdSteps(cfg) {
    const S = [];
    S.push({ t: 'ตรวจค่า IP ของเครื่อง', d: 'IP ' + cfg.ip + '/24, Gateway ' + cfg.gw + ', DNS ' + cfg.dns + ' (เครื่องไม่รู้ว่าค่าใดผิด มันใช้ตามที่ตั้งไว้)', ok: true, hl: ['pc'] });
    const r1 = gdReach(cfg, cfg.dns);
    S.push({ t: 'หา MAC ของ ' + (r1.same ? 'DNS Server ' + cfg.dns + ' (อยู่วงเดียวกัน ส่งตรง)' : 'Gateway ' + cfg.gw + ' (DNS อยู่นอกวง ต้องส่งผ่าน Gateway)') + ' ด้วย ARP',
      d: r1.arp ? 'ได้คำตอบ ARP Reply รู้ MAC แล้ว ส่งเฟรมได้' : r1.why, ok: r1.arp, hl: r1.arp ? (r1.same ? ['pc', 'dns'] : ['pc', 'gw']) : ['pc'], fail: r1.arp ? null : 'ghost', ghost: r1.next });
    if (!r1.arp) return S;
    const isDns = !!GD.dnsServers[cfg.dns];
    const dnsOk = r1.ok && isDns;
    S.push({ t: 'DNS Query (UDP พอร์ต 53): ถาม ' + GD.site + ' ไปที่ ' + cfg.dns,
      d: dnsOk ? 'ได้คำตอบ ' + GD.site + ' = ' + GD.siteIp : (r1.ok ? cfg.dns + ' ไม่ได้เป็น DNS Server จึงไม่ตอบ' : r1.why) + ' รอจนหมดเวลา เบราว์เซอร์ขึ้นว่าหาเว็บไม่พบ (DNS)', ok: dnsOk, hl: r1.same ? ['pc', 'dns'] : ['pc', 'gw', 'inet'], fail: dnsOk ? null : (r1.same ? 'dns' : 'inet') });
    if (!dnsOk) return S;
    const r2 = gdReach(cfg, GD.siteIp);
    S.push({ t: GD.siteIp + ' อยู่นอกวง ต้องส่งให้ Default Gateway ' + cfg.gw + ': หา MAC ด้วย ARP', d: r2.arp ? 'เราเตอร์ตอบ ARP Reply แล้ว' : r2.why, ok: r2.arp, hl: r2.arp ? ['pc', 'gw'] : ['pc'], fail: r2.arp ? null : 'ghost', ghost: r2.next });
    if (!r2.arp) return S;
    S.push({ t: 'TCP 3-way handshake ไปพอร์ต 443 (SYN → SYN-ACK → ACK)', d: r2.ok ? 'เชื่อมต่อสำเร็จผ่านเราเตอร์ออกอินเทอร์เน็ต' : r2.why, ok: r2.ok, hl: ['pc', 'gw', 'inet', 'web'], fail: r2.ok ? null : 'web' });
    if (!r2.ok) return S;
    S.push({ t: 'ส่งคำขอ HTTPS และได้หน้าเว็บ', d: 'เปิดเว็บสำเร็จ', ok: true, hl: ['pc', 'gw', 'inet', 'web'] });
    return S;
  }
  function gdPing(cfg, dst) {
    const r = gdReach(cfg, dst), L = ['C:\\>ping ' + dst, '', 'Pinging ' + dst + ' with 32 bytes of data:'];
    if (r.ok) {
      const t = r.same ? ['1ms', '<1ms', '<1ms', '<1ms'] : ['18ms', '17ms', '18ms', '17ms'], ttl = r.same ? 64 : 117;
      t.forEach(x => L.push('Reply from ' + dst + ': bytes=32 time' + (x[0] === '<' ? x : '=' + x) + ' TTL=' + ttl));
      L.push('', 'Ping statistics for ' + dst + ':', '    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),');
    } else {
      for (let i = 0; i < 4; i++) L.push('Reply from ' + cfg.ip + ': Destination host unreachable.');
      L.push('', 'Ping statistics for ' + dst + ':', '    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),');
    }
    return { text: L.join('\n'), ok: r.ok, note: r.ok ? 'ผ่าน: ติดต่อ ' + dst + ' ได้' : 'ไม่ผ่าน: ข้อความมาจาก IP ของเครื่องเราเอง (' + cfg.ip + ') เพราะ ARP หา ' + r.next + ' ไม่พบ ถึงบรรทัดสรุปจะขึ้น 0% loss ก็ถือว่าติดต่อไม่ได้ (บางเครื่องอาจขึ้น Request timed out)' };
  }
  function gdNslookup(cfg, server) {
    const srv = server || cfg.dns, r = gdReach(cfg, srv), name = GD.dnsServers[srv];
    const L = ['C:\\>nslookup ' + GD.site + (server ? ' ' + server : '')];
    if (r.ok && name) {
      L.push('Server:  ' + name, 'Address:  ' + srv, '', 'Non-authoritative answer:', 'Name:    ' + GD.site, 'Address:  ' + GD.siteIp);
      return { text: L.join('\n'), ok: true, note: 'ผ่าน: DNS Server ' + srv + ' ตอบว่า ' + GD.site + ' = ' + GD.siteIp };
    }
    L.push('DNS request timed out.', '    timeout was 2 seconds.', 'Server:  UnKnown', 'Address:  ' + srv, '', 'DNS request timed out.', '    timeout was 2 seconds.', 'DNS request timed out.', '    timeout was 2 seconds.', '*** Request to UnKnown timed-out');
    return { text: L.join('\n'), ok: false, note: 'ไม่ผ่าน: ' + srv + ' ไม่ตอบ' + (r.same ? '' : ' (ต้องส่งผ่าน Gateway ' + cfg.gw + ')') };
  }
  function gdTopo(step) {
    const hl = new Set(step ? step.hl : []), fail = step ? step.fail : null;
    const col = k => fail === k ? 'var(--bad)' : hl.has(k) ? 'var(--blue)' : 'var(--muted)';
    const wire = (x1, y1, x2, y2, on) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${on ? 'var(--blue)' : 'var(--line)'}" stroke-width="${on ? 4 : 2.5}" stroke-linecap="round"/>`;
    const box = (x, y, w, k, t1, t2, dash) => `<rect x="${x}" y="${y}" width="${w}" height="52" rx="8" fill="${col(k)}" fill-opacity="0.12" stroke="${col(k)}" stroke-width="${hl.has(k) || fail === k ? 2.5 : 1.5}"${dash ? ' stroke-dasharray="6 4"' : ''}/><text x="${x + w / 2}" y="${y + 23}" font-size="18" text-anchor="middle" fill="var(--ink)" font-weight="600" font-family="inherit">${t1}</text><text x="${x + w / 2}" y="${y + 44}" font-size="15" text-anchor="middle" fill="var(--muted)" font-family="JetBrains Mono,Consolas,monospace">${t2}</text>`;
    const ghost = fail === 'ghost';
    let s = '<svg class="nlwc-svg" viewBox="0 0 640 240" role="img" aria-label="แผนผัง: PC ต่อ Switch ไปยัง DNS Server ของวงและเราเตอร์ เราเตอร์ต่ออินเทอร์เน็ตที่มี 8.8.8.8 และเว็บเซิร์ฟเวอร์ ส่วนที่กำลังใช้แสดงสีน้ำเงิน จุดที่ล้มเหลวสีแดง">';
    s += wire(120, 60, 250, 115, hl.has('pc') && (hl.size > 1 || ghost));
    s += wire(300, 130, 300, 176, hl.has('dns'));
    s += wire(350, 115, 420, 86, hl.has('gw'));
    s += wire(520, 60, 530, 60, hl.has('inet'));
    s += wire(580, 86, 580, 150, hl.has('web'));
    if (ghost) s += `<line x1="250" y1="122" x2="190" y2="176" stroke="var(--bad)" stroke-width="3" stroke-dasharray="6 4"/>`;
    s += box(10, 34, 110, 'pc', 'PC', '.20.105');
    s += `<rect x="250" y="100" width="100" height="30" rx="6" fill="var(--field)" stroke="var(--muted)" stroke-width="1.5"/><text x="300" y="121" font-size="16" text-anchor="middle" fill="var(--ink)" font-family="inherit">Switch</text>`;
    s += box(240, 176, 130, 'dns', 'DNS ในวง', '.20.10');
    s += box(420, 34, 100, 'gw', 'เราเตอร์', '.20.1');
    s += box(530, 34, 100, 'inet', 'Internet', '8.8.8.8');
    s += box(500, 150, 135, 'web', 'เว็บ', '203.0.113.80');
    if (ghost) s += box(40, 176, 180, 'ghost', 'ไม่มีเครื่องนี้', step.ghost, true);
    if (fail) { const P = { dns: [370, 176], gw: [520, 34], inet: [630, 34], web: [635, 150], ghost: [220, 176] }[fail]; if (P) s += `<circle cx="${P[0] - 6}" cy="${P[1] + 6}" r="13" fill="var(--bad)"/><path d="M${P[0] - 12},${P[1]} l12,12 M${P[0]},${P[1]} l-12,12" stroke="var(--panel)" stroke-width="3" stroke-linecap="round"/>`; }
    return s + '</svg>';
  }
  function gatewayDnsFault(root) {
    frame(root, 'Default Gateway ผิด หรือ DNS ผิด: ล้มที่ขั้นไหน', 'เลือกสถานการณ์ แล้วกด "ขั้นถัดไป" ดูว่าเครื่องพยายามเปิด www.example.com ทีละขั้นและล้มที่จุดใด จากนั้นกดปุ่มทดสอบ ping และ nslookup ดูผลจริงที่คำสั่งแสดง เทียบผลทั้งสามสถานการณ์');
    let scn = 'ok', loc = 'lan', idx = 0, steps = [], tests = {};
    const segS = seg([['ok', 'ปกติ'], ['gw', 'Default Gateway ผิด'], ['dns', 'DNS Server ผิด']], scn, v => { scn = v; recompute(); }, 'สถานการณ์');
    const segL = seg([['lan', 'DNS ในวง (192.168.20.10)'], ['ext', 'DNS ภายนอก (8.8.8.8)']], loc, v => { loc = v; recompute(); }, 'DNS Server ที่ถูกต้องของเครือข่าย');
    const cfgBox = h('div', { class: 'nlwc-term', 'aria-label': 'ผล ipconfig /all บางส่วน' });
    const topo = h('div');
    const list = h('ol', { class: 'nlwc-steps', 'aria-live': 'polite' });
    const prev = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { if (idx > 0) { idx--; draw(); } } }, 'ขั้นก่อนหน้า');
    const next = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: () => { if (idx < steps.length - 1) { idx++; draw(); } } }, 'ขั้นถัดไป');
    const all = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { idx = steps.length - 1; draw(); } }, 'แสดงทุกขั้น');
    const pos = h('span', { class: 'nlw-small' });
    const tOut = h('div');
    const diag = h('div', { 'aria-live': 'polite' });
    const TESTS = [['pgw', 'ping Gateway'], ['p8', 'ping 8.8.8.8'], ['ns', 'nslookup ' + GD.site], ['ns8', 'nslookup ' + GD.site + ' 8.8.8.8']];
    const tBtns = TESTS.map(t => h('button', { type: 'button', class: 'nlw-btn', 'data-t': t[0], onclick: () => runTest(t[0]) }, t[1]));
    root.append(h('div', { class: 'nlw-small' }, 'สถานการณ์:'), segS.el, h('div', { class: 'nlw-small', style: 'margin-top:6px' }, 'DNS Server ที่ถูกต้องของเครือข่ายนี้:'), segL.el,
      h('div', { class: 'nlw-small', style: 'margin-top:8px' }, 'C:\\>ipconfig /all (บางส่วน)'), cfgBox, topo,
      h('div', { class: 'nlw-row nlw-center' }, prev, next, all, pos), list,
      h('div', { class: 'nlw-small', style: 'margin-top:8px' }, 'ทดสอบด้วยคำสั่ง (ผลคำนวณจากค่าที่ตั้งไว้):'), h('div', { class: 'nlwc-btns' }, tBtns), tOut, diag);
    function cfg() { return gdConfig(scn, loc); }
    function recompute() { steps = gdSteps(cfg()); idx = 0; tests = {}; tOut.replaceChildren(); draw(); }
    function draw() {
      const c = cfg();
      cfgBox.replaceChildren(
        'IPv4 Address. . . : ' + c.ip + '\nSubnet Mask . . . : ' + c.mask + '\nDefault Gateway . : ', scn === 'gw' ? h('span', { class: 'nlwc-hl' }, c.gw + '  (ผิด)') : c.gw,
        '\nDNS Servers . . . : ', scn === 'dns' ? h('span', { class: 'nlwc-hl' }, c.dns + '  (ผิด)') : c.dns);
      const st = steps[idx];
      topo.innerHTML = gdTopo(st);
      list.replaceChildren(...steps.map((s, i) => h('li', { class: (i > idx ? 'nlwc-s-skip' : s.ok ? 'nlwc-s-ok' : 'nlwc-s-fail') + (i === idx ? ' nlwc-s-now' : '') },
        h('b', null, (i + 1) + '. ' + s.t + (i <= idx ? (s.ok ? '  [ผ่าน]' : '  [ล้มเหลว]') : '')), i <= idx ? s.d : 'ยังไม่ถึงขั้นนี้')));
      const last = steps[steps.length - 1];
      if (idx === steps.length - 1 && !last.ok) list.append(h('li', { class: 'nlwc-s-fail' }, h('b', null, 'หยุดที่ขั้นนี้'), 'ขั้นต่อจากนี้ไม่ได้ทำ เพราะต้องใช้ผลของขั้นที่ล้มเหลว'));
      prev.disabled = idx === 0; next.disabled = idx >= steps.length - 1;
      pos.textContent = 'ขั้น ' + (idx + 1) + ' / ' + steps.length;
      drawDiag();
    }
    function runTest(k) {
      const c = cfg();
      const r = k === 'pgw' ? gdPing(c, c.gw) : k === 'p8' ? gdPing(c, '8.8.8.8') : k === 'ns' ? gdNslookup(c) : gdNslookup(c, '8.8.8.8');
      tests[k] = r.ok;
      tOut.replaceChildren(h('div', { class: 'nlwc-term' }, r.text), h('div', { class: 'nlw-result ' + (r.ok ? 'nlw-is-ok' : 'nlw-is-bad') }, r.note));
      drawDiag();
    }
    function drawDiag() {
      const need = ['pgw', 'p8', 'ns'];
      const done = need.filter(k => k in tests);
      if (done.length < 3) { diag.replaceChildren(h('p', { class: 'nlw-small' }, 'ทดสอบ ping Gateway, ping 8.8.8.8 และ nslookup ให้ครบ (' + done.length + '/3) แล้วระบบจะช่วยสรุป')); return; }
      const g = tests.pgw, e = tests.p8, n = tests.ns;
      let t;
      if (g && e && n) t = 'ทั้งสามผ่าน: ค่า IP, Gateway และ DNS ใช้งานได้ ถ้ายังเปิดเว็บไม่ได้ให้ตรวจที่เบราว์เซอร์หรือเว็บปลายทาง';
      else if (!g && !e) t = 'ping Gateway และ ping 8.8.8.8 ไม่ผ่าน: เครื่องออกนอกวงไม่ได้ ตรวจ Default Gateway ใน ipconfig /all ว่าตรงกับ IP ของเราเตอร์ (192.168.20.1) หรือไม่' + (n ? ' (nslookup ยังผ่านเพราะ DNS Server อยู่ในวงเดียวกัน ไม่ต้องผ่าน Gateway)' : ' (nslookup ล้มด้วยเพราะ DNS Server อยู่นอกวง ต้องผ่าน Gateway)');
      else if (g && e && !n) t = 'ping ผ่านทั้งสองแต่ nslookup ไม่ผ่าน: ใช้ IP ได้แต่แปลงชื่อไม่ได้ = ปัญหา DNS ตรวจ DNS Servers ใน ipconfig /all' + ('ns8' in tests ? (tests.ns8 ? ' และ nslookup ผ่าน 8.8.8.8 ได้ ยืนยันว่าค่า DNS ในเครื่องผิด' : '') : ' แล้วลอง nslookup ผ่าน 8.8.8.8 เพื่อยืนยัน');
      else t = 'ผลผสม: ไล่ตรวจจากล่างขึ้นบน เริ่มที่ขั้นแรกที่ไม่ผ่าน';
      diag.replaceChildren(h('div', { class: 'nlw-result ' + (g && e && n ? 'nlw-is-ok' : 'nlw-is-warn') }, 'สรุปจากผลทดสอบ: ' + t));
    }
    recompute();
  }

  /* ===================================================================
     control-picker: pick controls for each scenario, graded
     =================================================================== */
  const TYPE = { phys: 'กายภาพ (Physical)', tech: 'เทคนิค (Technical)', admin: 'บริหารจัดการ (Administrative)' };
  const FN = { prev: 'ป้องกัน (Preventive)', det: 'ตรวจจับ (Detective)', corr: 'แก้ไข/กู้คืน (Corrective)' };
  const CTRL = {
    aware: ['อบรมให้รู้ทันฟิชชิงและการหลอกลวง', 'admin', ['prev'], 'ทำให้คนไม่หลงกดลิงก์ เปิดไฟล์ หรือบอกรหัสผ่าน'],
    mailf: ['กรองอีเมลและบล็อกไฟล์แนบอันตราย', 'tech', ['prev'], 'สกัดอีเมลอันตรายก่อนถึงผู้ใช้'],
    av: ['Microsoft Defender เปิด Real-time protection', 'tech', ['prev', 'det'], 'ตรวจจับและหยุดมัลแวร์บนเครื่อง'],
    backup: ['สำรองข้อมูล 3-2-1 มีชุดออฟไลน์ และทดลองกู้คืน', 'tech', ['corr'], 'กู้ข้อมูลคืนเมื่อข้อมูลเสียหายหรือหาย'],
    lp: ['ใช้บัญชีผู้ใช้ทั่วไป ไม่ใช้ Administrator ทำงานประจำวัน', 'tech', ['prev'], 'จำกัดความเสียหายเมื่อบัญชีถูกใช้ในทางที่ผิด'],
    patch: ['ติดตั้งอัปเดตความปลอดภัย (Patch) ตามรอบ', 'tech', ['prev'], 'ปิดช่องโหว่ซอฟต์แวร์ที่ประกาศแล้ว'],
    wpa: ['ใช้ WPA2/WPA3 กับรหัสผ่าน Wi-Fi ยาวอย่างน้อย 12 ตัว', 'tech', ['prev'], 'กันคนนอกเดารหัสเข้า Wi-Fi'],
    wps: ['ปิด WPS บนเราเตอร์', 'tech', ['prev'], 'ปิดช่องทางเข้า Wi-Fi ด้วย PIN 8 หลักที่ถูกเดาได้'],
    guest: ['แยก Wi-Fi แขก (Guest network) ออกจากเครือข่ายภายใน', 'tech', ['prev'], 'แยกอุปกรณ์ของคนนอกไม่ให้เห็นเครื่องภายใน'],
    bitl: ['เข้ารหัสทั้งดิสก์ด้วย BitLocker', 'tech', ['prev'], 'ข้อมูลในดิสก์อ่านไม่ได้เมื่อเครื่องหรือดิสก์ถูกขโมย'],
    lock: ['สายล็อกโน้ตบุ๊ก และไม่ทิ้งเครื่องไว้ในรถหรือที่สาธารณะ', 'phys', ['prev'], 'ลดโอกาสที่ตัวเครื่องถูกขโมย'],
    cctv: ['กล้องวงจรปิด (CCTV)', 'phys', ['det'], 'บันทึกเหตุการณ์และช่วยระบุตัวคนร้ายในพื้นที่'],
    privacy: ['ฟิล์มกันมองด้านข้าง และหันจอออกจากทางเดิน', 'phys', ['prev'], 'กันคนข้าง ๆ มองเห็นหน้าจอ'],
    scrlock: ['ล็อกหน้าจออัตโนมัติ และกด Windows + L เมื่อลุก', 'tech', ['prev'], 'กันคนอื่นใช้เครื่องที่เข้าระบบค้างไว้'],
    mfa: ['ยืนยันตัวตนหลายปัจจัย (MFA)', 'tech', ['prev'], 'รหัสหลุดก็ยังเข้าบัญชีไม่ได้ถ้าไม่มีปัจจัยที่สอง'],
    fw: ['ไฟร์วอลล์เปิดเฉพาะพอร์ตที่จำเป็น', 'tech', ['prev'], 'ลดช่องทางที่คนจากเครือข่ายอื่นเข้าถึงบริการ'],
    log: ['เปิดบันทึก Log และระบบแจ้งเตือนการบุกรุก (IDS)', 'tech', ['det'], 'รู้ตัวเร็วเมื่อมีความพยายามโจมตี'],
    find: ['เปิด Find my device เพื่อหาตำแหน่งและสั่งล็อกเครื่อง', 'tech', ['det', 'corr'], 'ติดตามและล็อกอุปกรณ์ที่หาย'],
    ir: ['แผนรับมือเหตุ: แจ้งใคร ตัดเครื่องจากเครือข่าย เปลี่ยนรหัสผ่าน', 'admin', ['corr'], 'จำกัดความเสียหายและกลับมาทำงานได้เร็วหลังเกิดเหตุ'],
    ups: ['เครื่องสำรองไฟ (UPS)', 'phys', ['prev'], 'กันไฟดับและไฟกระชาก']
  };
  const CP_SCN = [
    { id: 'ransom', t: 'พนักงานบัญชีเปิดไฟล์แนบ ใบแจ้งหนี้.zip จากอีเมลที่ไม่รู้จัก ไฟล์ในเครื่องและโฟลเดอร์แชร์ถูกเข้ารหัส มีข้อความเรียกค่าไถ่',
      key: { aware: 'ต้นเหตุคือคนเปิดไฟล์แนบ การอบรมทำให้สงสัยและไม่เปิด', mailf: 'สกัดไฟล์แนบอันตรายก่อนถึงกล่องจดหมาย', av: 'ตรวจจับและหยุดแรนซัมแวร์ขณะเริ่มทำงาน', backup: 'ถ้าโดนแล้ว ชุดสำรองออฟไลน์คือทางกู้ไฟล์คืนโดยไม่ต้องจ่ายค่าไถ่' },
      part: { lp: 'จำกัดโฟลเดอร์ที่มัลแวร์เขียนทับได้ แต่ไฟล์ที่บัญชีนั้นมีสิทธิ์ก็ยังโดน', patch: 'กันมัลแวร์ที่อาศัยช่องโหว่ แต่ไม่กันคนเปิดไฟล์เอง', ir: 'ช่วยตัดเครื่องออกจากเครือข่ายเร็ว ลดการลาม', log: 'ช่วยรู้ตัวเร็วขึ้น แต่ไม่หยุดการเข้ารหัส' },
      why: { bitl: 'BitLocker ปกป้องข้อมูลเมื่อดิสก์ถูกขโมย แต่ตอนเครื่องเปิดใช้งาน แรนซัมแวร์อ่านและเข้ารหัสไฟล์ได้ตามปกติ', fw: 'ผู้ใช้เปิดไฟล์เองในเครื่อง ไฟร์วอลล์ที่กรองการเชื่อมต่อเข้าจึงไม่ได้หยุดเหตุนี้' } },
    { id: 'wifi', t: 'ร้านกาแฟใช้รหัส Wi-Fi 12345678 วงเดียวกับเครื่องคิดเงิน และเปิด WPS ไว้ ลูกค้าคนหนึ่งสแกนเห็นเครื่องคิดเงินในร้าน',
      key: { wpa: 'รหัสสั้นและง่ายถูกเดาหรือถูกบอกต่อ ต้องเปลี่ยนเป็นรหัสยาวกับ WPA2/WPA3', wps: 'WPS PIN ถูกเดาได้แม้เปลี่ยนรหัส Wi-Fi แล้ว', guest: 'ลูกค้าควรอยู่คนละวงกับเครื่องคิดเงิน จะได้มองไม่เห็นกัน' },
      part: { fw: 'ไฟร์วอลล์บนเครื่องคิดเงินลดสิ่งที่ลูกค้าเข้าถึงได้', patch: 'ลดช่องโหว่ถ้ามีคนเข้าถึงเครื่องได้', log: 'ช่วยรู้ว่ามีการสแกน' },
      why: { aware: 'ปัญหาอยู่ที่การตั้งค่าเครือข่าย ไม่ใช่พนักงานถูกหลอก' } },
    { id: 'server', t: 'เว็บเซิร์ฟเวอร์ของวิทยาลัยไม่ได้อัปเดตมา 2 ปี มีช่องโหว่ที่ประกาศแล้ว และเปิดพอร์ตจัดการระยะไกลให้ทุกคนจากอินเทอร์เน็ต',
      key: { patch: 'ช่องโหว่ที่ประกาศแล้วปิดได้ด้วยการอัปเดต', fw: 'พอร์ตจัดการไม่ควรเปิดให้ทั้งอินเทอร์เน็ต เปิดเฉพาะเครือข่ายผู้ดูแล', log: 'ต้องรู้ให้เร็วเมื่อมีคนพยายามเจาะ' },
      part: { mfa: 'ทำให้การเข้าระบบจัดการยากขึ้น แต่ช่องโหว่ของซอฟต์แวร์ยังอยู่', backup: 'ช่วยกู้คืนถ้าถูกเจาะ แต่ไม่ได้กันการเจาะ', ir: 'ช่วยรับมือหลังเกิดเหตุ', lp: 'ให้บริการเว็บรันด้วยบัญชีสิทธิ์ต่ำ ลดความเสียหายถ้าถูกเจาะ', av: 'อาจตรวจพบมัลแวร์ที่ถูกฝังหลังเจาะ' },
      why: { aware: 'ปัญหาคือระบบไม่ได้อัปเดตและเปิดพอร์ตเกินจำเป็น ไม่ใช่คนถูกหลอก' } },
    { id: 'laptop', t: 'โน้ตบุ๊กฝ่ายขายที่มีไฟล์รายชื่อลูกค้าถูกขโมยจากรถ ดิสก์ไม่ได้เข้ารหัส',
      key: { bitl: 'ถ้าดิสก์เข้ารหัส คนร้ายถอดดิสก์ไปอ่านไฟล์ลูกค้าไม่ได้', find: 'ช่วยหาตำแหน่งและสั่งล็อกเครื่องจากระยะไกล', ir: 'ต้องแจ้งเหตุ เปลี่ยนรหัสผ่านบัญชีที่เคยใช้ในเครื่อง และประเมินข้อมูลที่หลุด' },
      part: { lock: 'ลดโอกาสถูกขโมย แต่ไม่ช่วยหลังเครื่องหายแล้ว', backup: 'บริษัทยังมีข้อมูลใช้ต่อ แต่ไม่กันข้อมูลรั่ว', mfa: 'กันคนร้ายใช้รหัสที่บันทึกในเครื่องเข้าบัญชีออนไลน์', aware: 'สอนไม่ให้ทิ้งเครื่องไว้ในรถ' },
      why: { av: 'คนร้ายถอดดิสก์ไปอ่านจากเครื่องอื่นได้ โปรแกรมป้องกันไวรัสในเครื่องจึงไม่ได้ทำงาน', scrlock: 'ล็อกหน้าจอไม่ได้เข้ารหัสดิสก์ ถอดดิสก์ไปอ่านได้อยู่ดี' } },
    { id: 'shoulder', t: 'พนักงานหน้าเคาน์เตอร์พิมพ์รหัสผ่านระบบลูกค้า ขณะที่มีคนต่อแถวยืนมองจอและแป้นพิมพ์อยู่ด้านหลัง',
      key: { privacy: 'ลดสิ่งที่คนข้างหลังมองเห็นบนจอ', mfa: 'แม้รหัสถูกแอบดู คนอื่นก็เข้าไม่ได้ถ้าไม่มีปัจจัยที่สอง', aware: 'พนักงานรู้จักบังแป้นพิมพ์และสังเกตคนรอบตัว' },
      part: { scrlock: 'กันคนอื่นใช้เครื่องที่เข้าระบบค้างไว้เมื่อพนักงานลุก', cctv: 'บันทึกหลักฐานถ้ามีคนนำรหัสไปใช้', ir: 'ถ้ารู้ว่ารหัสถูกเห็น ต้องเปลี่ยนรหัสทันที' },
      why: { bitl: 'การแอบดูรหัสเกิดตอนพิมพ์ การเข้ารหัสดิสก์ไม่เกี่ยว' } }
  ];
  function cpGrade(sc, picked) {
    const rows = [];
    let keys = 0, parts = 0, wrong = 0;
    picked.forEach(id => {
      const c = CTRL[id];
      if (sc.key[id]) { keys++; rows.push({ k: 'k', id, label: 'ตรงจุด', why: sc.key[id] }); }
      else if (sc.part[id]) { parts++; rows.push({ k: 'p', id, label: 'ช่วยได้บางส่วน', why: sc.part[id] }); }
      else { wrong++; rows.push({ k: 'x', id, label: 'ไม่ตรงกับเหตุการณ์นี้', why: (sc.why && sc.why[id]) || ('มาตรการนี้ช่วยเรื่อง: ' + c[3] + ' ซึ่งไม่ใช่จุดอ่อนในเหตุการณ์นี้') }); }
    });
    Object.keys(sc.key).filter(id => !picked.includes(id)).forEach(id => rows.push({ k: 'm', id, label: 'ยังไม่ได้เลือก (มาตรการหลัก)', why: sc.key[id] }));
    const total = Object.keys(sc.key).length;
    const score = Math.max(0, keys * 2 + parts - wrong * 2), max = total * 2 + Object.keys(sc.part).length;
    const fns = new Set(), types = new Set();
    picked.filter(id => sc.key[id] || sc.part[id]).forEach(id => { CTRL[id][2].forEach(f => fns.add(f)); types.add(CTRL[id][1]); });
    return { rows, keys, total, parts, wrong, score, max, fns, types, pass: keys === total && wrong === 0 };
  }
  function controlPicker(root) {
    frame(root, 'เลือกมาตรการป้องกันให้ตรงเหตุการณ์', 'อ่านเหตุการณ์ แล้วแตะเลือกมาตรการที่ช่วยป้องกันหรือรับมือได้ (เลือกได้หลายข้อ) กด "ตรวจคำตอบ" เพื่อดูผลรายข้อว่าตรงจุด ช่วยบางส่วน หรือไม่เกี่ยว พร้อมชั้นของมาตรการ (กายภาพ เทคนิค บริหารจัดการ) และหน้าที่ (ป้องกัน ตรวจจับ แก้ไข) การเลือกที่ไม่เกี่ยวจะถูกหักคะแนน');
    let si = 0;
    const picks = CP_SCN.map(() => new Set()), results = CP_SCN.map(() => null);
    const nav = h('div', { class: 'nlw-seg', role: 'group', 'aria-label': 'เลือกเหตุการณ์' });
    const navBtns = CP_SCN.map((s, i) => h('button', { type: 'button', class: 'nlw-btn', onclick: () => { si = i; render(); scn.focus({ preventScroll: true }); } }, 'เหตุการณ์ ' + (i + 1)));
    nav.append(...navBtns);
    const scn = h('div', { class: 'nlwc-scn', tabindex: '-1' });
    const opts = h('div', { class: 'nlwc-opts', role: 'group', 'aria-label': 'มาตรการ' });
    const ids = Object.keys(CTRL);
    const oBtns = ids.map(id => h('button', { type: 'button', class: 'nlw-btn', 'data-c': id, 'aria-pressed': 'false', onclick: () => toggle(id) }, CTRL[id][0]));
    opts.append(...oBtns);
    const check = h('button', { type: 'button', class: 'nlw-btn nlw-primary', onclick: grade }, 'ตรวจคำตอบ');
    const clear = h('button', { type: 'button', class: 'nlw-btn', onclick: () => { picks[si].clear(); results[si] = null; render(); } }, 'ล้างที่เลือก');
    const count = h('span', { class: 'nlw-small' });
    const fb = h('div', { 'aria-live': 'polite' });
    const sum = h('div', { class: 'nlw-small' });
    root.append(nav, scn, opts, h('div', { class: 'nlw-row nlw-center' }, check, clear, count), fb, sum);
    function toggle(id) { const p = picks[si]; if (p.has(id)) p.delete(id); else p.add(id); results[si] = null; render(); }
    function grade() { if (!picks[si].size) { fb.replaceChildren(h('div', { class: 'nlw-result nlw-is-warn' }, 'ยังไม่ได้เลือกมาตรการ')); return; } results[si] = cpGrade(CP_SCN[si], Array.from(picks[si])); render(); fb.focus && fb.firstChild && fb.firstChild.focus && fb.firstChild.focus({ preventScroll: true }); }
    const tags = id => [h('span', { class: 'nlwc-tag' }, TYPE[CTRL[id][1]])].concat(CTRL[id][2].map(f => h('span', { class: 'nlwc-tag' }, FN[f])));
    function render() {
      const sc = CP_SCN[si], p = picks[si], r = results[si];
      navBtns.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === si)); b.textContent = 'เหตุการณ์ ' + (i + 1) + (results[i] ? (results[i].pass ? ' (ผ่าน)' : ' (' + results[i].score + '/' + results[i].max + ')') : ''); });
      scn.textContent = sc.t;
      oBtns.forEach(b => {
        const id = b.getAttribute('data-c');
        b.setAttribute('aria-pressed', String(p.has(id)));
        b.classList.remove('nlwc-k', 'nlwc-p', 'nlwc-x');
        if (r && p.has(id)) b.classList.add(sc.key[id] ? 'nlwc-k' : sc.part[id] ? 'nlwc-p' : 'nlwc-x');
      });
      count.textContent = 'เลือกแล้ว ' + p.size + ' ข้อ';
      if (!r) { fb.replaceChildren(); }
      else {
        const missF = ['prev', 'det', 'corr'].filter(f => !r.fns.has(f)).map(f => FN[f]);
        fb.replaceChildren(
          h('div', { class: 'nlw-result ' + (r.pass ? 'nlw-is-ok' : r.wrong ? 'nlw-is-bad' : 'nlw-is-warn'), tabindex: '-1' },
            (r.pass ? 'ครบทุกมาตรการหลักและไม่มีข้อที่ไม่เกี่ยว ' : 'มาตรการหลัก ' + r.keys + '/' + r.total + ', ช่วยบางส่วน ' + r.parts + ', ไม่เกี่ยว ' + r.wrong + ' ') + '(คะแนน ' + r.score + '/' + r.max + ')'),
          h('ul', { class: 'nlwc-fb' }, r.rows.map(x => h('li', { class: 'nlwc-' + x.k }, h('b', null, x.label + ': '), CTRL[x.id][0], h('div', null, tags(x.id)), h('div', { class: 'nlw-small', style: 'color:var(--ink)' }, x.why)))),
          h('p', { class: 'nlw-small' }, 'ชุดที่ใช้ได้ของคุณครอบคลุมชั้น: ' + (r.types.size ? Array.from(r.types).map(t => TYPE[t]).join(', ') : 'ยังไม่มี') + (missF.length ? ' | ยังขาดหน้าที่: ' + missF.join(', ') + ' การป้องกันเชิงลึกควรมีทั้งป้องกัน ตรวจจับ และแก้ไข' : ' | ครบทั้งป้องกัน ตรวจจับ และแก้ไข')));
      }
      const done = results.filter(Boolean), passN = done.filter(x => x.pass).length;
      sum.textContent = 'ตรวจแล้ว ' + done.length + '/' + CP_SCN.length + ' เหตุการณ์ ผ่านครบ ' + passN + ' เหตุการณ์';
    }
    render();
  }

  NL_FIG('widget', 'snapshot-restore', snapshotRestore);
  NL_FIG('widget', 'gateway-dns-fault', gatewayDnsFault);
  NL_FIG('widget', 'control-picker', controlPicker);
})();
