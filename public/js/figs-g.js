'use strict';
/* NetLab 2.8 figures, batch g. Register with NL_FIG('diagram'|'widget', name, svgString|mountFn). */
window.NL_FIG = window.NL_FIG || function (kind, name, v) { const k = kind === 'diagram' ? 'NL_DIAGRAMS' : 'NL_WIDGETS'; (window[k] = window[k] || {})[name] = v; };

(function () {
  /* ---------- SVG helpers (colours only through CSS variables) ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MONO = 'JetBrains Mono,Consolas,monospace';
  function T(x, y, s, o) {
    o = o || {};
    const fam = o.m ? ` font-family="${MONO}"` : ' font-family="inherit"';
    return `<text x="${x}" y="${y}" font-size="${o.s || 15}" text-anchor="${o.a || 'middle'}" fill="${o.c || 'var(--ink)'}"${o.w ? ' font-weight="700"' : ''}${fam}>${esc(s)}</text>`;
  }
  function R(x, y, w, h, o) {
    o = o || {};
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx == null ? 9 : o.rx}" fill="${o.f || 'var(--panel)'}"${o.fo != null ? ` fill-opacity="${o.fo}"` : ''} stroke="${o.st || 'var(--line)'}" stroke-width="${o.sw || 1.8}"${o.d ? ` stroke-dasharray="${o.d}"` : ''}/>`;
  }
  function P(d, o) {
    o = o || {};
    return `<path d="${d}" fill="none" stroke="${o.c || 'var(--muted)'}" stroke-width="${o.sw || 2.2}" stroke-linecap="round" stroke-linejoin="round"${o.d ? ` stroke-dasharray="${o.d}"` : ''} marker-end="url(#${o.me || 'pkf-a'})"/>`;
  }
  function marker(id, c) {
    return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`;
  }
  // box with a main label and an optional second line
  function BOX(x, y, w, h, main, sub, o) {
    o = o || {};
    const cx = x + w / 2;
    return R(x, y, w, h, { f: o.f || 'var(--panel)', st: o.st || 'var(--line)', sw: o.sw || 1.8 }) +
      T(cx, y + (sub ? h / 2 - 3 : h / 2 + 6), main, { s: o.s || 15.5, w: o.bold !== false, m: o.m }) +
      (sub ? T(cx, y + h / 2 + 17, sub, { s: 13, c: 'var(--muted)', m: o.subm }) : '');
  }
  // small key glyph
  function KEY(x, y, c) {
    return `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${c}" stroke-width="2.4"/>` +
      `<path d="M${x + 7},${y} h16 m-5,0 v6 m-6,-6 v5" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`;
  }

  /* ===================================================================
     diagram pki-flow: sign (sender) -> verify (receiver) -> where the public key comes from (certificate chain)
     =================================================================== */
  const PKI_TITLE = 'ลายเซ็นดิจิทัลและใบรับรอง แบ่งเป็น 3 ส่วน ส่วนที่ 1 ฝั่งผู้ส่งชื่อนิดา: นำข้อความไปคำนวณ SHA-256 ได้ค่าแฮช 256 บิต แล้วลงนาม (Sign) ค่าแฮชด้วยกุญแจส่วนตัวของผู้ส่งซึ่งเก็บเป็นความลับ ได้ลายเซ็นดิจิทัล จากนั้นส่งข้อความพร้อมลายเซ็นผ่านเครือข่าย ข้อความไม่ได้ถูกซ่อน ส่วนที่ 2 ฝั่งผู้รับ: คำนวณ SHA-256 ของข้อความที่ได้รับอีกครั้ง แล้วนำค่าแฮช ลายเซ็นที่ได้รับ และกุญแจสาธารณะของผู้ส่งเข้าขั้นตรวจสอบ (Verify) ถ้าตรงกันจึงยอมรับ แปลว่าข้อความไม่ถูกแก้ไขและมาจากผู้ถือกุญแจส่วนตัว ถ้าไม่ตรงให้ปฏิเสธ เพราะข้อความหรือลายเซ็นถูกแก้ หรือใช้กุญแจคนละคู่ ส่วนที่ 3 ผู้รับรู้ว่ากุญแจสาธารณะเป็นของผู้ส่งจริงจากใบรับรอง: Root CA ที่อยู่ใน Trust Store ของระบบปฏิบัติการหรือเบราว์เซอร์ ลงนามรับรอง Intermediate CA ซึ่งลงนามรับรองใบรับรองของผู้ส่งที่บรรจุชื่อผู้ส่งกับกุญแจสาธารณะ';
  const pkiFlow = (function () {
    const B = 'var(--blue)', G = 'var(--green)', O = 'var(--orange)', BAD = 'var(--bad)', OK = 'var(--ok)';
    let s = '';
    // part 1: sender
    s += R(10, 14, 620, 300, { f: B, fo: 0.06, st: B, sw: 1.6, d: '7 5', rx: 14 });
    s += T(26, 42, '1  ฝั่งผู้ส่ง (นิดา): ลงนาม', { s: 17, w: 1, a: 'start', c: B });
    s += BOX(26, 62, 170, 62, 'ข้อความ', 'อนุมัติเบิก 2,450 บาท');
    s += P('M196,93 L228,93', { c: B, me: 'pkf-b' });
    s += BOX(232, 62, 150, 62, 'SHA-256', 'ฟังก์ชันแฮช');
    s += P('M382,93 L414,93', { c: B, me: 'pkf-b' });
    s += BOX(418, 62, 196, 62, 'ค่าแฮช 256 บิต', '9f3a...c71e', { subm: 1 });
    s += P('M516,124 L516,160', { c: B, me: 'pkf-b' });
    s += R(26, 164, 290, 62, { f: O, fo: 0.12, st: O, sw: 2 });
    s += KEY(48, 195, O);
    s += T(186, 190, 'กุญแจส่วนตัวของผู้ส่ง', { s: 15.5, w: 1 });
    s += T(186, 213, 'เก็บเป็นความลับ ไม่ส่งให้ใคร', { s: 13, c: 'var(--muted)' });
    s += P('M316,195 L414,195', { c: O, me: 'pkf-o' });
    s += BOX(418, 164, 196, 62, 'ลงนาม (Sign)', 'ใช้กุญแจกับค่าแฮช', { st: B, sw: 2.4 });
    s += P('M516,226 L516,246', { c: B, me: 'pkf-b' });
    s += BOX(418, 250, 196, 52, 'ลายเซ็นดิจิทัล', '', { st: B });
    s += T(26 + 145, 270, 'ข้อความ + ลายเซ็น ส่งไปด้วยกัน', { s: 14, c: 'var(--muted)' });
    s += T(26 + 145, 291, 'ลายเซ็นไม่ได้ซ่อนเนื้อความ', { s: 14, c: 'var(--muted)' });
    // network hop
    s += P('M320,316 L320,360', { c: 'var(--muted)', sw: 2.4, d: '6 5' });
    s += T(332, 344, 'ส่งผ่านเครือข่าย', { s: 14, c: 'var(--muted)', a: 'start' });
    // part 2: receiver
    s += R(10, 366, 620, 300, { f: G, fo: 0.06, st: G, sw: 1.6, d: '7 5', rx: 14 });
    s += T(26, 394, '2  ฝั่งผู้รับ (ครู): ตรวจสอบ', { s: 17, w: 1, a: 'start', c: G });
    s += BOX(26, 410, 190, 56, 'ข้อความที่ได้รับ', '');
    s += P('M121,466 L121,494', { c: G, me: 'pkf-g' });
    s += BOX(26, 498, 190, 56, 'SHA-256 อีกครั้ง', 'ได้ค่าแฮชที่คำนวณเอง');
    s += BOX(424, 410, 190, 56, 'ลายเซ็นที่ได้รับ', '');
    s += R(424, 498, 190, 56, { f: O, fo: 0.12, st: O, sw: 2 });
    s += T(519, 522, 'กุญแจสาธารณะของผู้ส่ง', { s: 14.5, w: 1 });
    s += T(519, 543, 'ใครก็มีได้ (แจกได้)', { s: 13, c: 'var(--muted)' });
    s += BOX(244, 470, 152, 66, 'ตรวจสอบ (Verify)', 'แฮช + ลายเซ็น + กุญแจ', { st: G, sw: 2.4, s: 15 });
    s += P('M216,526 L240,512', { c: G, me: 'pkf-g' });
    s += P('M424,438 L400,486', { c: G, me: 'pkf-g' });
    s += P('M424,526 L400,514', { c: O, me: 'pkf-o' });
    s += P('M300,536 L190,580', { c: OK, me: 'pkf-k' });
    s += P('M340,536 L450,580', { c: BAD, me: 'pkf-r' });
    s += BOX(26, 584, 286, 66, 'ตรงกัน: ยอมรับ', 'ไม่ถูกแก้ไข และมาจากผู้ถือกุญแจ', { st: OK, sw: 2.4 });
    s += BOX(328, 584, 286, 66, 'ไม่ตรง: ปฏิเสธ', 'ถูกแก้ระหว่างทาง หรือกุญแจผิดคู่', { st: BAD, sw: 2.4 });
    // part 3: where the public key comes from
    s += R(10, 682, 620, 214, { f: O, fo: 0.06, st: O, sw: 1.6, d: '7 5', rx: 14 });
    s += T(26, 710, '3  รู้ได้อย่างไรว่ากุญแจสาธารณะเป็นของผู้ส่งจริง', { s: 17, w: 1, a: 'start', c: 'var(--ink)' });
    s += BOX(26, 730, 176, 70, 'Root CA', 'อยู่ใน Trust Store', { st: O, sw: 2.2 });
    s += P('M202,765 L228,765', { c: O, me: 'pkf-o' });
    s += BOX(232, 730, 176, 70, 'Intermediate CA', 'CA ระดับกลาง', { s: 15 });
    s += P('M408,765 L434,765', { c: O, me: 'pkf-o' });
    s += BOX(438, 730, 176, 70, 'ใบรับรองของผู้ส่ง', 'ชื่อ + กุญแจสาธารณะ', { s: 15 });
    s += T(320, 830, 'ลูกศร = ใบทางซ้ายลงนามรับรองใบทางขวา', { s: 14, c: 'var(--muted)' });
    s += T(320, 854, 'เบราว์เซอร์ไล่ตรวจลายเซ็นจากใบของผู้ส่งขึ้นไปจนถึงใบบนสุดที่เชื่อถือ', { s: 14, c: 'var(--muted)' });
    s += T(320, 878, 'ถ้าไล่ไม่ถึง หรือใบใดหมดอายุ จะขึ้นคำเตือนใบรับรอง', { s: 14, c: 'var(--muted)' });
    // certificate supplies the public key (dashed, around the right edge)
    s += P('M614,748 L632,748 L632,526 L618,526', { c: O, d: '6 5', me: 'pkf-o' });
    const defs = marker('pkf-a', 'var(--muted)') + marker('pkf-b', B) + marker('pkf-g', G) + marker('pkf-o', O) + marker('pkf-k', OK) + marker('pkf-r', BAD);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 906" role="img" aria-labelledby="pki-flow-title" font-family="inherit"><title id="pki-flow-title">${esc(PKI_TITLE)}</title><defs>${defs}</defs>${s}</svg>`;
  })();
  NL_FIG('diagram', 'pki-flow', pkiFlow);

  /* ---------- DOM helpers ---------- */
  const CSS = `
.nlwg .nlwg-panel{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:10px 0;background:var(--panel)}
.nlwg .nlwg-panel h4{margin:0 0 6px;font-size:16px;line-height:1.35}
.nlwg .nlw-btn{min-height:44px}
.nlwg .nlwg-tabs{margin:0 0 6px}
.nlwg .nlwg-tabs .nlw-btn{flex:1 1 150px}
.nlwg label.nlw-field{margin:6px 0}
.nlwg .nlwg-in{width:100%}
.nlwg textarea.nlwg-in{min-height:64px}
.nlwg .nlwg-out{font-family:"JetBrains Mono",Consolas,monospace;font-size:12.5px;line-height:1.55;background:var(--term-bg);color:var(--term-ink);border-radius:8px;padding:10px 12px;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0}
.nlwg .nlwg-out:empty{display:none}
.nlwg .nlwg-hex{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;line-height:1.6;overflow-wrap:anywhere;word-break:break-all;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 8px;margin:4px 0}
.nlwg .nlwg-hex mark{background:color-mix(in srgb,var(--orange) 30%,transparent);color:var(--ink);border-radius:2px}
.nlwg .nlwg-meta{font-size:13.5px;color:var(--muted);margin:2px 0}
.nlwg .nlwg-bar{height:12px;background:var(--line);border-radius:6px;overflow:hidden;margin:4px 0}
.nlwg .nlwg-bar i{display:block;height:100%;background:var(--orange)}
.nlwg .nlwg-keys{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0}
.nlwg .nlwg-keys th,.nlwg .nlwg-keys td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}
.nlwg .nlwg-keys th{color:var(--muted);background:var(--field)}
.nlwg .nlwg-keys tr.nlwg-now td{background:color-mix(in srgb,var(--blue) 12%,transparent)}
.nlwg .nlwg-priv{color:var(--orange);font-weight:700}.nlwg .nlwg-pub{color:var(--green);font-weight:700}
.nlwg .nlwg-scroll{overflow-x:auto;max-width:100%}
.nlwg .nlwg-url{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--field);border-radius:999px;padding:6px 14px;font-family:"JetBrains Mono",Consolas,monospace;font-size:14px;overflow-wrap:anywhere;margin:6px 0}
.nlwg .nlwg-url b{font-family:inherit;white-space:nowrap;flex:none}
.nlwg .nlwg-scn{font-size:15px;border-left:5px solid var(--orange);background:var(--field);border-radius:0 10px 10px 0;padding:8px 12px;margin:8px 0}
.nlwg .nlwg-cert{width:100%;border-collapse:collapse;font-size:14px}
.nlwg .nlwg-cert th,.nlwg .nlwg-cert td{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}
.nlwg .nlwg-cert th{color:var(--muted);font-weight:600;width:34%;background:var(--field)}
.nlwg .nlwg-cert td{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;overflow-wrap:anywhere}
.nlwg .nlwg-chain{list-style:none;padding:0;margin:6px 0}
.nlwg .nlwg-chain li{border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:4px 0;background:var(--field);font-size:14px}
.nlwg .nlwg-chain li small{display:block;color:var(--muted);font-size:13px}
.nlwg .nlwg-chain li+li{margin-left:14px}
.nlwg .nlwg-fb{list-style:none;padding:0;margin:6px 0}
.nlwg .nlwg-fb li{border-left:4px solid var(--line);padding:5px 10px;margin:5px 0;background:var(--field);border-radius:0 6px 6px 0;font-size:14.5px}
.nlwg .nlwg-fb li.nlwg-y{border-left-color:var(--ok)}.nlwg .nlwg-fb li.nlwg-n{border-left-color:var(--bad)}
.nlwg .nlwg-q{font-weight:600;margin:10px 0 4px;font-size:15px}
`;
  function injectCSS() {
    if (!document.getElementById('nl-widget-css')) {
      const base = window.NL_WIDGETS && window.NL_WIDGETS['caesar'];
      if (typeof base === 'function') { try { base(document.createElement('div')); } catch (e) { /* base styles optional */ } }
    }
    if (document.getElementById('nlwg-css')) return;
    const st = document.createElement('style'); st.id = 'nlwg-css'; st.textContent = CSS;
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
  function frame(root, title, instr) {
    injectCSS();
    root.replaceChildren();
    root.classList.add('nlw', 'nlwg');
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
  const result = (kind, ...c) => h('div', { class: 'nlw-result nlw-is-' + kind }, ...c);
  const field = (label, input, hint) => h('label', { class: 'nlw-field' }, h('span', null, label), input, hint ? h('span', { class: 'nlwg-meta', style: 'font-weight:400' }, hint) : null);

  /* ---------- byte helpers ---------- */
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  const unb64 = s => { const bin = atob(String(s).replace(/\s+/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const nbytes = s => new TextEncoder().encode(s).length;
  // change one character: digits roll over, other characters move to the next code point
  function changeOne(s) {
    const a = Array.from(s);
    if (!a.length) return 'a';
    let i = a.length - 1;
    for (let k = a.length - 1; k >= 0; k--) if (/[0-9A-Za-z]/.test(a[k])) { i = k; break; }
    const c = a[i];
    a[i] = /[0-9]/.test(c) ? String((Number(c) + 1) % 10) : c === 'z' ? 'a' : c === 'Z' ? 'A' : String.fromCodePoint(c.codePointAt(0) + 1);
    return a.join('');
  }
  function flipBit(b64str, byteFromEnd) {
    const u = unb64(b64str);
    const i = Math.max(0, u.length - 1 - (byteFromEnd || 0));
    u[i] ^= 0x01;
    return b64(u);
  }

  /* ===================================================================
     widget crypto-lab: AES-GCM with PBKDF2, SHA-256 avalanche, ECDSA P-256 sign/verify (WebCrypto, all local)
     =================================================================== */
  const ITER = 600000; // PBKDF2-HMAC-SHA256 work factor recommended by OWASP (2023)
  function cryptoLab(root) {
    frame(root, 'ห้องทดลองการเข้ารหัส (ทำงานในเบราว์เซอร์นี้เท่านั้น)',
      'เลือกการทดลองด้านบน: AES-GCM เข้ารหัสด้วยกุญแจที่สร้างจากรหัสผ่าน, SHA-256 ดูว่าแก้ 1 ตัวอักษรแล้วค่าแฮชเปลี่ยนแค่ไหน, และลายเซ็นดิจิทัล ECDSA ลองแก้ข้อความหรือลายเซ็นแล้วตรวจใหม่ ทุกอย่างคำนวณด้วย Web Crypto API ของเบราว์เซอร์ กุญแจสร้างในเครื่องนี้และไม่ถูกส่งไปที่ใด');
    const subtle = (typeof window !== 'undefined' && window.isSecureContext && window.crypto && window.crypto.subtle) || null;
    if (!subtle) {
      root.append(result('bad', 'เบราว์เซอร์ไม่เปิดให้ใช้ Web Crypto API (crypto.subtle) ในหน้านี้'),
        h('p', null, 'เบราว์เซอร์อนุญาตฟังก์ชันเข้ารหัสเฉพาะหน้าเว็บที่อยู่ในบริบทปลอดภัย (Secure Context) คือเปิดผ่าน HTTPS หรือเปิดจากเครื่องตัวเองด้วย http://localhost หรือ http://127.0.0.1 หน้านี้น่าจะเปิดด้วย http:// ผ่าน IP ของเครื่องอื่นในวง LAN'),
        h('ul', { class: 'nlw-list' },
          h('li', null, 'ให้ครูเปิด NetLab ผ่าน HTTPS หรือเปิดบนเครื่องที่รันเซิร์ฟเวอร์ด้วย http://localhost'),
          h('li', null, 'หรือใช้เบราว์เซอร์รุ่นใหม่ (Chrome, Edge, Firefox, Safari ปัจจุบันรองรับทั้งหมด)')),
        h('p', { class: 'nlw-small' }, 'นี่คือตัวอย่างจริงของนโยบายความปลอดภัย: เบราว์เซอร์ไม่ยอมให้หน้าเว็บที่อาจถูกดักแก้ระหว่างทาง (HTTP ธรรมดา) ใช้ความสามารถด้านการเข้ารหัส'));
      return;
    }
    const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
    const panes = {};
    let tabs;
    const show = k => { Object.keys(panes).forEach(x => { panes[x].hidden = x !== k; }); tabs.set(k); };
    tabs = seg([['aes', 'AES-GCM เข้ารหัส'], ['sha', 'SHA-256 แฮช'], ['sig', 'ลายเซ็นดิจิทัล']], 'aes', show, 'เลือกการทดลอง');
    tabs.el.classList.add('nlwg-tabs');
    root.append(tabs.el);

    /* ---------- (a) AES-GCM ---------- */
    {
      const msg = h('textarea', { class: 'nlwg-in', rows: '2', 'aria-label': 'ข้อความต้นฉบับ' });
      msg.value = 'คะแนนสอบกลางภาค ห้อง ปวช.2/1: นิดา 18/20';
      const pass = h('input', { type: 'text', class: 'nlwg-in', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'รหัสผ่านของผู้ส่ง' });
      pass.value = 'Lab-Key-2569';
      const bEnc = h('button', { type: 'button', class: 'nlw-btn nlw-primary' }, 'เข้ารหัส (Encrypt)');
      const status = h('div', { class: 'nlw-small', 'aria-live': 'polite' });
      const out = h('div', { class: 'nlwg-out', 'aria-label': 'ผลการเข้ารหัส' });
      const pass2 = h('input', { type: 'text', class: 'nlwg-in', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'รหัสผ่านที่ผู้รับใส่' });
      const bDec = h('button', { type: 'button', class: 'nlw-btn nlw-primary', disabled: true }, 'ถอดรหัส (Decrypt)');
      const bSame = h('button', { type: 'button', class: 'nlw-btn', disabled: true }, 'ใส่รหัสผ่านที่ถูก');
      const bTamper = h('button', { type: 'button', class: 'nlw-btn', disabled: true }, 'แก้ ciphertext 1 บิต');
      const bReset = h('button', { type: 'button', class: 'nlw-btn', disabled: true }, 'คืน ciphertext เดิม');
      const dOut = h('div', { 'aria-live': 'polite' });
      let box = null; // {salt, iv, ct (b64), orig}
      const busy = on => { [bEnc, bDec].forEach(b => { b.disabled = on || (b === bDec && !box); }); status.textContent = on ? 'กำลังสร้างกุญแจ 256 บิตจากรหัสผ่านด้วย PBKDF2 (' + ITER.toLocaleString('en-US') + ' รอบ) โปรดรอสักครู่...' : ''; };
      async function deriveKey(p, salt) {
        const base = await subtle.importKey('raw', enc.encode(p), 'PBKDF2', false, ['deriveKey']);
        return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      }
      function drawBox() {
        const ctBytes = unb64(box.ct).length;
        out.textContent = 'Salt (16 ไบต์ สุ่มใหม่ทุกครั้ง): ' + b64(box.salt) +
          '\nIV/Nonce (12 ไบต์ สุ่มใหม่ทุกครั้ง): ' + b64(box.iv) +
          '\nCiphertext + Tag (base64):\n' + box.ct +
          '\n\nขนาด: ข้อความ ' + box.ptLen + ' ไบต์ -> ciphertext ' + (ctBytes - 16) + ' ไบต์ + Authentication tag 16 ไบต์' +
          (box.ct !== box.orig ? '\n(ciphertext นี้ถูกแก้ไขแล้ว 1 บิต)' : '');
      }
      bEnc.addEventListener('click', async () => {
        if (!pass.value) { dOut.replaceChildren(result('warn', 'ใส่รหัสผ่านก่อนเข้ารหัส')); return; }
        busy(true);
        try {
          const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
          const key = await deriveKey(pass.value, salt);
          const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(msg.value)));
          box = { salt, iv, ct: b64(ct), orig: b64(ct), ptLen: nbytes(msg.value) };
          drawBox();
          pass2.value = '';
          dOut.replaceChildren(result('ok', 'เข้ารหัสแล้ว ข้อความกลายเป็นไบต์ที่อ่านไม่ออก ลองกดเข้ารหัสซ้ำด้วยข้อความเดิม จะได้ ciphertext ต่างไปทุกครั้งเพราะ Salt และ IV สุ่มใหม่'),
            h('p', { class: 'nlw-small' }, 'ถัดไป: ใส่รหัสผ่านในช่องของผู้รับ ลองทั้งรหัสที่ถูกและรหัสที่ผิด หรือกดแก้ ciphertext แล้วถอดรหัส'));
        } catch (e) { dOut.replaceChildren(result('bad', 'เข้ารหัสไม่สำเร็จ: ' + e.message)); }
        busy(false);
        [bSame, bTamper, bReset].forEach(b => { b.disabled = !box; });
      });
      bSame.addEventListener('click', () => { pass2.value = pass.value; pass2.focus(); });
      bTamper.addEventListener('click', () => { if (!box) return; box.ct = flipBit(box.ct, 20); drawBox(); dOut.replaceChildren(result('warn', 'แก้ไบต์หนึ่งของ ciphertext แล้ว (สมมติว่ามีคนแก้ระหว่างทาง) ลองถอดรหัสด้วยรหัสผ่านที่ถูกดู')); });
      bReset.addEventListener('click', () => { if (!box) return; box.ct = box.orig; drawBox(); dOut.replaceChildren(result('ok', 'คืน ciphertext เดิมแล้ว')); });
      bDec.addEventListener('click', async () => {
        if (!box) return;
        busy(true);
        const tampered = box.ct !== box.orig, rightPass = pass2.value === pass.value;
        try {
          const key = await deriveKey(pass2.value, box.salt);
          const pt = await subtle.decrypt({ name: 'AES-GCM', iv: box.iv }, key, unb64(box.ct));
          dOut.replaceChildren(result('ok', 'ถอดรหัสสำเร็จ และ Authentication tag ตรงกัน: ข้อมูลไม่ถูกแก้ไข'), h('div', { class: 'nlwg-out' }, dec.decode(pt)),
            h('p', { class: 'nlw-small' }, 'รหัสผ่านเดียวกัน + Salt เดิม ให้กุญแจ AES ตัวเดิม จึงถอดกลับได้ นี่คือการเข้ารหัสแบบสมมาตร (Symmetric) คือใช้กุญแจเดียวกันทั้งเข้าและถอดรหัส'));
        } catch (e) {
          const why = tampered && rightPass ? 'รหัสผ่านถูก แต่ ciphertext ถูกแก้ไป 1 บิต ค่า tag ที่คำนวณใหม่จึงไม่ตรงกับ tag ที่แนบมา GCM จึงไม่ยอมคืนข้อมูลใด ๆ นี่คือการตรวจความถูกต้อง (Integrity) ในตัว'
            : !rightPass ? 'รหัสผ่านต่างไปแม้เพียงตัวเดียว PBKDF2 จะได้กุญแจคนละตัวโดยสิ้นเชิง เมื่อ GCM คำนวณ Authentication tag ด้วยกุญแจผิด ค่า tag ไม่ตรงกับที่แนบมา จึงปฏิเสธทั้งหมด ไม่คืนข้อความขยะออกมาให้เดา' + (tampered ? ' (และ ciphertext ก็ถูกแก้ด้วย)' : '')
              : 'ข้อมูลไม่ผ่านการตรวจ Authentication tag';
          dOut.replaceChildren(result('bad', 'ถอดรหัสไม่สำเร็จ: การตรวจสอบความถูกต้องล้มเหลว (' + (e && e.name ? e.name : 'Error') + ')'), h('p', null, why));
        }
        busy(false);
      });
      panes.aes = h('div', { class: 'nlwg-panel' },
        h('h4', null, 'ก. เข้ารหัสแบบสมมาตรด้วย AES-256-GCM'),
        field('ข้อความต้นฉบับ (Plaintext)', msg),
        field('รหัสผ่านของผู้ส่ง (Passphrase)', pass, 'เบราว์เซอร์สร้างกุญแจ AES 256 บิตจากรหัสผ่านนี้ด้วย PBKDF2-SHA256 และ Salt สุ่ม'),
        h('div', { class: 'nlw-row nlw-center' }, bEnc), status, out,
        h('div', { class: 'nlwg-q' }, 'ฝั่งผู้รับ: ถอดรหัส'),
        field('รหัสผ่านที่ผู้รับใส่', pass2, 'ลองพิมพ์รหัสผิด เช่น เปลี่ยนตัวพิมพ์เล็กใหญ่เพียงตัวเดียว'),
        h('div', { class: 'nlw-row nlw-center' }, bDec, bSame, bTamper, bReset), dOut);
    }

    /* ---------- (b) SHA-256 avalanche ---------- */
    {
      const a = h('textarea', { class: 'nlwg-in', rows: '2', 'aria-label': 'ข้อความ A' });
      const b = h('textarea', { class: 'nlwg-in', rows: '2', 'aria-label': 'ข้อความ B' });
      a.value = 'โอนเงินค่าชุดฝึกงาน 1500 บาท'; b.value = changeOne(a.value);
      const ha = h('div', { class: 'nlwg-hex', 'aria-live': 'polite' }), hb = h('div', { class: 'nlwg-hex', 'aria-live': 'polite' });
      const ma = h('div', { class: 'nlwg-meta' }), mb = h('div', { class: 'nlwg-meta' });
      const diff = h('div'), bar = h('div', { class: 'nlwg-bar', 'aria-hidden': 'true' }, h('i'));
      const bOne = h('button', { type: 'button', class: 'nlw-btn' }, 'ให้ B = A แก้ 1 ตัวอักษร');
      const bSameB = h('button', { type: 'button', class: 'nlw-btn' }, 'ให้ B = A ทุกตัว');
      let seq = 0;
      const sha = async s => new Uint8Array(await subtle.digest('SHA-256', enc.encode(s)));
      async function run() {
        const my = ++seq;
        const [da, db] = await Promise.all([sha(a.value), sha(b.value)]);
        if (my !== seq) return;
        const xa = hex(da), xb = hex(db);
        let bits = 0; for (let i = 0; i < 32; i++) { let v = da[i] ^ db[i]; while (v) { bits += v & 1; v >>= 1; } }
        ha.textContent = xa;
        hb.replaceChildren(...Array.from(xb, (c, i) => c !== xa[i] ? h('mark', null, c) : c));
        ma.textContent = 'A: ' + Array.from(a.value).length + ' ตัวอักษร = ' + nbytes(a.value) + ' ไบต์ (UTF-8, อักษรไทย 1 ตัวใช้ 3 ไบต์) -> แฮช 32 ไบต์';
        mb.textContent = 'B: ' + Array.from(b.value).length + ' ตัวอักษร = ' + nbytes(b.value) + ' ไบต์ -> แฮช 32 ไบต์ (ตัวที่ไฮไลต์ = ต่างจาก A)';
        bar.firstChild.style.width = (bits / 256 * 100).toFixed(1) + '%';
        const hexDiff = Array.from(xb).filter((c, i) => c !== xa[i]).length;
        diff.replaceChildren(a.value === b.value
          ? result('ok', 'ข้อความเหมือนกันทุกไบต์ ค่าแฮชจึงเหมือนกันทุกตัว (ฟังก์ชันแฮชให้ผลเดิมเสมอเมื่อข้อมูลเดิม)')
          : result('warn', 'บิตที่ต่างกัน ' + bits + ' จาก 256 บิต (' + (bits / 256 * 100).toFixed(1) + '%) และเลขฐานสิบหกต่างกัน ' + hexDiff + ' จาก 64 ตัว'),
        h('p', { class: 'nlw-small' }, a.value === b.value ? 'ลองแก้ข้อความ B เพียงตัวเดียว' : 'แก้ข้อมูลเพียงเล็กน้อย ผลลัพธ์เปลี่ยนไปราวครึ่งหนึ่งของบิตทั้งหมด เรียกว่า Avalanche effect จึงเดาไม่ได้ว่าข้อมูลถูกแก้ตรงไหน และไม่มีกุญแจให้ถอดกลับ แฮชจึงใช้ตรวจความถูกต้อง ไม่ใช่ใช้ซ่อนข้อมูล'));
      }
      a.addEventListener('input', run); b.addEventListener('input', run);
      bOne.addEventListener('click', () => { b.value = changeOne(a.value); run(); });
      bSameB.addEventListener('click', () => { b.value = a.value; run(); });
      panes.sha = h('div', { class: 'nlwg-panel', hidden: true },
        h('h4', null, 'ข. ฟังก์ชันแฮช SHA-256 และ Avalanche effect'),
        field('ข้อความ A', a), h('div', { class: 'nlwg-q' }, 'SHA-256(A)'), ha, ma,
        field('ข้อความ B', b), h('div', { class: 'nlw-row nlw-center' }, bOne, bSameB),
        h('div', { class: 'nlwg-q' }, 'SHA-256(B)'), hb, mb, bar, diff,
        h('p', { class: 'nlw-small' }, 'ผลลัพธ์ยาว 64 หลักฐานสิบหก (256 บิต) เสมอ ไม่ว่าข้อความจะสั้นหรือยาวแค่ไหน ลองลบข้อความ A ให้ว่าง ค่าที่ได้ต้องเป็น e3b0c442...b855 ตามมาตรฐาน'));
      run();
    }

    /* ---------- (c) ECDSA P-256 signature ---------- */
    {
      const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
      let nida = null, other = null, sent = null, useKey = 'nida', stepNow = -1;
      const bGen = h('button', { type: 'button', class: 'nlw-btn nlw-primary' }, '1. สร้างคู่กุญแจของนิดา');
      const keyOut = h('div', { class: 'nlwg-out' });
      const msg = h('textarea', { class: 'nlwg-in', rows: '2', 'aria-label': 'ข้อความที่นิดาจะลงนาม' });
      msg.value = 'อนุมัติเบิกค่าสาย UTP Cat6 จำนวน 2,450 บาท - นิดา หัวหน้าห้อง';
      const bSign = h('button', { type: 'button', class: 'nlw-btn nlw-primary', disabled: true }, '2. ลงนามด้วยกุญแจส่วนตัวของนิดา');
      const sigOut = h('div', { class: 'nlwg-out' });
      const rMsg = h('textarea', { class: 'nlwg-in', rows: '2', 'aria-label': 'ข้อความที่ผู้รับได้รับ', disabled: true });
      const rSig = h('textarea', { class: 'nlwg-in', rows: '2', spellcheck: 'false', 'aria-label': 'ลายเซ็นที่ผู้รับได้รับ (base64)', disabled: true });
      const keySel = seg([['nida', 'กุญแจสาธารณะของนิดา'], ['other', 'กุญแจสาธารณะของสมชาย (คนละคู่)']], 'nida', v => { useKey = v; }, 'กุญแจสาธารณะที่ใช้ตรวจ');
      const bVer = h('button', { type: 'button', class: 'nlw-btn nlw-primary', disabled: true }, '3. ตรวจสอบ (Verify)');
      const bTm = h('button', { type: 'button', class: 'nlw-btn', disabled: true }, 'แก้ข้อความ 1 ตัว');
      const bTs = h('button', { type: 'button', class: 'nlw-btn', disabled: true }, 'แก้ลายเซ็น 1 บิต');
      const bRs = h('button', { type: 'button', class: 'nlw-btn', disabled: true }, 'คืนค่าที่ส่งมา');
      const vOut = h('div', { 'aria-live': 'polite' });
      const rows = [
        ['สร้างคู่กุญแจ', 'ได้ทั้งกุญแจส่วนตัวและกุญแจสาธารณะ', 'นิดา'],
        ['ลงนาม (Sign)', h('span', { class: 'nlwg-priv' }, 'กุญแจส่วนตัวของผู้ส่ง'), 'มีเฉพาะนิดา'],
        ['ตรวจสอบ (Verify)', h('span', { class: 'nlwg-pub' }, 'กุญแจสาธารณะของผู้ส่ง'), 'ใครก็มีได้']
      ];
      const tbody = h('tbody', null, rows.map(r => h('tr', null, r.map(c => h('td', null, c)))));
      const keyTable = h('div', { class: 'nlwg-scroll' }, h('table', { class: 'nlwg-keys' }, h('thead', null, h('tr', null, h('th', null, 'ขั้นตอน'), h('th', null, 'ใช้กุญแจใด'), h('th', null, 'ใครมีกุญแจนี้'))), tbody));
      const mark = i => { stepNow = i; Array.from(tbody.children).forEach((tr, k) => tr.classList.toggle('nlwg-now', k === i)); };
      const fp = async spki => { const d = hex(await subtle.digest('SHA-256', spki)); return d.slice(0, 32).match(/.{4}/g).join(':'); };
      bGen.addEventListener('click', async () => {
        try {
          nida = await subtle.generateKey(ALG, false, ['sign', 'verify']);   // private key non-extractable; public key is always exportable
          other = await subtle.generateKey(ALG, false, ['sign', 'verify']);
          const spki = new Uint8Array(await subtle.exportKey('spki', nida.publicKey));
          keyOut.textContent = 'กุญแจสาธารณะของนิดา (SPKI ' + spki.length + ' ไบต์, base64):\n' + b64(spki) +
            '\nลายนิ้วมือ (SHA-256 ของกุญแจ, 16 ไบต์แรก): ' + await fp(spki) +
            '\n\nกุญแจส่วนตัวของนิดา: สร้างแบบส่งออกไม่ได้ (non-extractable) อยู่ในหน่วยความจำของแท็บนี้เท่านั้น ไม่แสดงและไม่ถูกส่งไปไหน';
          bSign.disabled = false; sent = null; [bVer, bTm, bTs, bRs].forEach(b => { b.disabled = true; }); rMsg.disabled = rSig.disabled = true;
          sigOut.textContent = ''; vOut.replaceChildren(result('ok', 'สร้างคู่กุญแจใหม่แล้ว (และสร้างอีกคู่ให้สมชายไว้ทดลองตรวจด้วยกุญแจผิดคู่)')); mark(0);
        } catch (e) { vOut.replaceChildren(result('bad', 'สร้างกุญแจไม่สำเร็จ: ' + e.message)); }
      });
      bSign.addEventListener('click', async () => {
        if (!nida) return;
        try {
          const sig = new Uint8Array(await subtle.sign(SIG, nida.privateKey, enc.encode(msg.value)));
          sent = { msg: msg.value, sig: b64(sig) };
          sigOut.textContent = 'ลายเซ็น (ECDSA P-256 + SHA-256, ' + sig.length + ' ไบต์, base64):\n' + sent.sig;
          rMsg.value = sent.msg; rSig.value = sent.sig; rMsg.disabled = rSig.disabled = false;
          [bVer, bTm, bTs, bRs].forEach(b => { b.disabled = false; });
          vOut.replaceChildren(result('ok', 'ลงนามแล้ว ข้อความกับลายเซ็นถูกส่งไปที่ฝั่งผู้รับด้านล่าง'), h('p', { class: 'nlw-small' }, 'ลองกดลงนามซ้ำ ECDSA จะให้ลายเซ็นไม่ซ้ำเดิมทุกครั้ง (ใช้ค่าสุ่มภายใน) แต่ทุกอันตรวจผ่านด้วยกุญแจสาธารณะเดียวกัน')); mark(1);
        } catch (e) { vOut.replaceChildren(result('bad', 'ลงนามไม่สำเร็จ: ' + e.message)); }
      });
      bTm.addEventListener('click', () => { rMsg.value = changeOne(rMsg.value); vOut.replaceChildren(result('warn', 'แก้ข้อความที่ได้รับไป 1 ตัวอักษร (เช่นมีคนแก้ยอดเงิน) กดตรวจสอบดู')); });
      bTs.addEventListener('click', () => { try { rSig.value = flipBit(rSig.value, 5); vOut.replaceChildren(result('warn', 'แก้ลายเซ็นไป 1 บิต กดตรวจสอบดู')); } catch (e) { vOut.replaceChildren(result('bad', 'ลายเซ็นไม่ใช่ base64 ที่ถูกต้อง')); } });
      bRs.addEventListener('click', () => { if (!sent) return; rMsg.value = sent.msg; rSig.value = sent.sig; keySel.set('nida'); useKey = 'nida'; vOut.replaceChildren(result('ok', 'คืนข้อความและลายเซ็นตามที่นิดาส่งมาแล้ว')); });
      bVer.addEventListener('click', async () => {
        if (!sent) return;
        mark(2);
        const pub = useKey === 'nida' ? nida.publicKey : other.publicKey;
        let ok = false, bad64 = false;
        try { ok = await subtle.verify(SIG, pub, unb64(rSig.value), enc.encode(rMsg.value)); } catch (e) { bad64 = true; }
        const mChanged = rMsg.value !== sent.msg, sChanged = rSig.value.replace(/\s+/g, '') !== sent.sig, wrongKey = useKey !== 'nida';
        const reasons = [];
        if (bad64) reasons.push('ลายเซ็นที่ได้รับไม่ใช่ base64 ที่ถูกต้อง');
        if (mChanged) reasons.push('ข้อความถูกแก้: ค่าแฮชของข้อความใหม่ไม่ใช่ค่าที่นิดาลงนามไว้');
        if (sChanged && !bad64) reasons.push('ลายเซ็นถูกแก้: ไม่ใช่ลายเซ็นที่สร้างจากกุญแจส่วนตัวของนิดา');
        if (wrongKey) reasons.push('ใช้กุญแจสาธารณะของสมชาย ซึ่งไม่ใช่คู่ของกุญแจส่วนตัวที่ใช้ลงนาม');
        vOut.replaceChildren(ok
          ? result('ok', 'ตรวจสอบผ่าน: ลายเซ็นถูกต้อง')
          : result('bad', 'ตรวจสอบไม่ผ่าน: ลายเซ็นไม่ถูกต้อง'),
        ok ? h('p', null, 'ผู้รับมั่นใจได้ 3 อย่าง: ข้อความไม่ถูกแก้ไข (Integrity) มาจากผู้ถือกุญแจส่วนตัวของนิดาจริง (Authentication) และนิดาปฏิเสธภายหลังได้ยากว่าไม่ได้ส่ง (Non-repudiation) แต่ข้อความไม่ได้เป็นความลับ ใครดักได้ก็อ่านออก')
          : h('ul', { class: 'nlw-list' }, reasons.map(r => h('li', null, r))));
      });
      panes.sig = h('div', { class: 'nlwg-panel', hidden: true },
        h('h4', null, 'ค. ลายเซ็นดิจิทัลด้วย ECDSA P-256'),
        keyTable,
        h('div', { class: 'nlw-row nlw-center' }, bGen), keyOut,
        field('ข้อความที่นิดาจะลงนาม', msg),
        h('div', { class: 'nlw-row nlw-center' }, bSign), sigOut,
        h('div', { class: 'nlwg-q' }, 'ฝั่งผู้รับ (ครู): สิ่งที่ได้รับ'),
        field('ข้อความที่ได้รับ', rMsg), field('ลายเซ็นที่ได้รับ (base64)', rSig),
        h('div', { class: 'nlwg-q' }, 'ตรวจด้วยกุญแจสาธารณะของใคร'), keySel.el,
        h('div', { class: 'nlw-row nlw-center' }, bVer, bTm, bTs, bRs), vOut);
    }
    root.append(panes.aes, panes.sha, panes.sig);
  }
  NL_FIG('widget', 'crypto-lab', cryptoLab);

  /* ===================================================================
     widget cert-inspector: simulated certificates for fictional hosts; real checks (dates, hostname/SAN with wildcard, chain to trust store)
     =================================================================== */
  const TODAY = '2026-10-13';
  const TRUST_STORE = ['Example Trust Root R1', 'Example Global Root G2'];
  const CERT_CASES = [
    { url: 'mail.example.com', scn: 'ครูเปิดเว็บเมลของบริษัทฝึกงานจากห้องแล็บเพื่อส่งรายชื่อนักศึกษา เบราว์เซอร์ขึ้นหน้าคำเตือนใบรับรอง',
      cn: 'mail.example.com', san: ['mail.example.com'], from: '2025-09-10', to: '2026-10-01',
      chain: [{ n: 'mail.example.com', by: 'Example TLS Issuing CA 2' }, { n: 'Example TLS Issuing CA 2', by: 'Example Global Root G2' }, { n: 'Example Global Root G2', by: 'Example Global Root G2' }] },
    { url: 'intranet.example.ac.th', scn: 'นักเรียนเปิดระบบอินทราเน็ตของวิทยาลัยเพื่อดูตารางสอบ แล้วคลิกดูรายละเอียดใบรับรอง',
      cn: 'intranet.example.ac.th', san: ['intranet.example.ac.th', 'www.intranet.example.ac.th'], from: '2026-08-01', to: '2027-02-16',
      chain: [{ n: 'intranet.example.ac.th', by: 'Example Academy Issuing CA' }, { n: 'Example Academy Issuing CA', by: 'Example Trust Root R1' }, { n: 'Example Trust Root R1', by: 'Example Trust Root R1' }] },
    { url: 'shop.example.net', scn: 'เจ้าของร้าน SME พิมพ์ที่อยู่ร้านออนไลน์ของตัวเอง แต่ใบรับรองที่เซิร์ฟเวอร์ส่งมาดูไม่ค่อยตรง',
      cn: 'www.example.org', san: ['www.example.org', 'example.org'], from: '2026-06-01', to: '2026-12-17',
      chain: [{ n: 'www.example.org', by: 'Example TLS Issuing CA 2' }, { n: 'Example TLS Issuing CA 2', by: 'Example Global Root G2' }, { n: 'Example Global Root G2', by: 'Example Global Root G2' }] },
    { url: 'pay.example.com', scn: 'นักเรียนต่อ Wi-Fi ฟรีชื่อ FreeNet_Cafe ในร้านกาแฟ แล้วเปิดหน้าชำระเงินออนไลน์ เบราว์เซอร์ขึ้นคำเตือน',
      cn: 'pay.example.com', san: ['pay.example.com'], from: '2026-10-12', to: '2027-10-12',
      chain: [{ n: 'pay.example.com', by: 'FreeNet Secure Proxy CA' }, { n: 'FreeNet Secure Proxy CA', by: 'FreeNet Secure Proxy CA' }] },
    { url: 'learn.example.ac.th', scn: 'นักเรียนเข้าระบบ e-Learning ของวิทยาลัย ใบรับรองระบุชื่อแบบมีเครื่องหมายดอกจัน (*)',
      cn: '*.example.ac.th', san: ['*.example.ac.th', 'example.ac.th'], from: '2026-07-20', to: '2027-02-04',
      chain: [{ n: '*.example.ac.th', by: 'Example Academy Issuing CA' }, { n: 'Example Academy Issuing CA', by: 'Example Trust Root R1' }, { n: 'Example Trust Root R1', by: 'Example Trust Root R1' }] },
    { url: 'nas.lab.example', scn: 'ครูให้นักเรียนเปิดหน้าตั้งค่า NAS ในห้องแล็บ (เครือข่ายภายใน) เบราว์เซอร์ขึ้นคำเตือนใบรับรอง',
      cn: 'nas.lab.example', san: ['nas.lab.example'], from: '2024-01-15', to: '2034-01-12',
      chain: [{ n: 'nas.lab.example', by: 'nas.lab.example' }] }
  ];
  const REASONS = [['ok', 'ผ่านทุกข้อ'], ['date', 'หมดอายุหรือยังไม่ถึงวันเริ่มใช้'], ['host', 'ชื่อโฮสต์ไม่ตรงกับใบรับรอง'], ['self', 'ใบรับรองลงนามตัวเอง (Self-signed)'], ['ca', 'ผู้ออกไม่อยู่ใน Trust Store (CA ไม่รู้จัก)']];
  // RFC 6125 style: wildcard only as the whole left-most label and matches exactly one label
  function hostMatches(pattern, host) {
    const p = pattern.toLowerCase().split('.'), hh = host.toLowerCase().split('.');
    if (p.length !== hh.length) return false;
    return p.every((x, i) => (i === 0 && x === '*') ? hh[0].length > 0 : x === hh[i]);
  }
  function certChecks(c) {
    const dateOK = c.from <= TODAY && TODAY <= c.to;
    const hostOK = c.san.some(p => hostMatches(p, c.url));
    const last = c.chain[c.chain.length - 1];
    const selfSigned = c.chain.length === 1 && c.chain[0].n === c.chain[0].by;
    let linked = true;
    for (let i = 0; i + 1 < c.chain.length; i++) if (c.chain[i].by !== c.chain[i + 1].n) linked = false;
    const anchored = last.n === last.by && TRUST_STORE.includes(last.n);
    const chainOK = linked && anchored;
    const reason = !chainOK ? (selfSigned ? 'self' : 'ca') : !dateOK ? 'date' : !hostOK ? 'host' : 'ok';
    const days = Math.round((Date.parse(TODAY) - Date.parse(c.to)) / 86400000);
    return { dateOK, hostOK, chainOK, selfSigned, reason, trust: dateOK && hostOK && chainOK, days, last };
  }
  const ERR = { date: 'NET::ERR_CERT_DATE_INVALID', host: 'NET::ERR_CERT_COMMON_NAME_INVALID', self: 'NET::ERR_CERT_AUTHORITY_INVALID', ca: 'NET::ERR_CERT_AUTHORITY_INVALID' };
  const ADVICE = {
    ok: 'ทั้งสามข้อผ่าน เบราว์เซอร์แสดงการเชื่อมต่อที่ปลอดภัย แต่ยังต้องดูว่าชื่อเว็บเป็นของหน่วยงานที่ตั้งใจจะเข้าจริง เพราะเว็บหลอกลวงก็ขอใบรับรองที่ถูกต้องได้',
    date: 'ใบรับรองหมดอายุ ผู้ดูแลเซิร์ฟเวอร์ต้องต่ออายุ ผู้ใช้ไม่ควรกดข้ามคำเตือน ให้แจ้งผู้ดูแล (ตรวจด้วยว่านาฬิกาเครื่องตัวเองถูกต้อง เพราะเวลาเครื่องผิดก็ทำให้เกิดคำเตือนนี้ได้)',
    host: 'ใบรับรองถูกออกให้ชื่ออื่น อาจเป็นการตั้งค่าเซิร์ฟเวอร์ผิดหรือถูกพาไปเซิร์ฟเวอร์ปลอม ไม่ควรกรอกข้อมูลใด ๆ',
    self: 'ใบรับรองลงนามตัวเอง ไม่มี CA ใดรับรอง เบราว์เซอร์จึงพิสูจน์ไม่ได้ว่าเป็นอุปกรณ์จริง ในเครือข่ายภายในผู้ดูแลควรออกใบรับรองจาก CA ภายในและติดตั้ง Root ของ CA นั้นในเครื่องของหน่วยงาน หรือยืนยันลายนิ้วมือ (Fingerprint) ของใบรับรองผ่านช่องทางอื่น ไม่ควรฝึกให้ผู้ใช้กดข้ามคำเตือน',
    ca: 'ชื่อและวันที่ถูก แต่ผู้ออกไม่อยู่ใน Trust Store ลักษณะนี้บน Wi-Fi สาธารณะบ่งชี้ว่ามีคนดักกลางทาง (MITM) ให้หยุด ปิดหน้า และตัดการเชื่อมต่อ Wi-Fi นั้น'
  };
  function certInspector(root) {
    frame(root, 'ตรวจใบรับรอง (Certificate) ก่อนเชื่อถือเว็บ',
      'แต่ละกรณีจำลองเว็บของหน่วยงานสมมติ (โดเมน example) อ่านที่อยู่เว็บ วันที่ในเครื่อง และรายละเอียดใบรับรอง แล้วเลือกว่าควรเชื่อถือหรือไม่ พร้อมเหตุผล กด "ตรวจคำตอบ" เพื่อดูว่าเบราว์เซอร์ตรวจอะไรบ้างและผลแต่ละข้อ');
    let ci = 0;
    const ans = CERT_CASES.map(() => ({ d: null, r: null, done: null }));
    const nav = h('div', { class: 'nlw-seg', role: 'group', 'aria-label': 'เลือกกรณี' });
    const navBtns = CERT_CASES.map((c, i) => h('button', { type: 'button', class: 'nlw-btn', onclick: () => { ci = i; render(); body.focus({ preventScroll: true }); } }, 'กรณี ' + (i + 1)));
    nav.append(...navBtns);
    const body = h('div', { tabindex: '-1' });
    const dec = seg([['yes', 'เชื่อถือได้ ไปต่อ'], ['no', 'ไม่ควรเชื่อถือ หยุด']], null, v => { ans[ci].d = v; ans[ci].done = null; render(); }, 'การตัดสินใจ');
    const rs = seg(REASONS, null, v => { ans[ci].r = v; ans[ci].done = null; render(); }, 'เหตุผล');
    rs.el.style.flexDirection = 'column';
    rs.btns.forEach(b => { b.style.textAlign = 'left'; });
    const bCheck = h('button', { type: 'button', class: 'nlw-btn nlw-primary' }, 'ตรวจคำตอบ');
    const fb = h('div', { 'aria-live': 'polite' });
    const sum = h('div', { class: 'nlw-small' });
    bCheck.addEventListener('click', () => {
      const a = ans[ci];
      if (!a.d || !a.r) { fb.replaceChildren(result('warn', 'เลือกทั้งการตัดสินใจและเหตุผลก่อนตรวจคำตอบ')); return; }
      const k = certChecks(CERT_CASES[ci]);
      const dOK = (a.d === 'yes') === k.trust;
      const rOK = a.r === k.reason || (k.reason === 'self' && a.r === 'ca');
      a.done = { dOK, rOK, k };
      render();
    });
    root.append(nav, body, h('div', { class: 'nlwg-q' }, 'การตัดสินใจของคุณ'), dec.el, h('div', { class: 'nlwg-q' }, 'เหตุผลหลัก'), rs.el, h('div', { class: 'nlw-row nlw-center' }, bCheck), fb, sum);
    function render() {
      const c = CERT_CASES[ci], a = ans[ci];
      navBtns.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === ci)); const d = ans[i].done; b.textContent = 'กรณี ' + (i + 1) + (d ? (d.dOK && d.rOK ? ' (ถูก)' : ' (ลองใหม่)') : ''); });
      const row = (k, v) => h('tr', null, h('th', { scope: 'row' }, k), h('td', null, v));
      body.replaceChildren(
        h('div', { class: 'nlwg-scn' }, c.scn),
        h('div', { class: 'nlwg-url', 'aria-label': 'แถบที่อยู่เว็บ' }, h('b', null, 'ที่อยู่เว็บ'), 'https://' + c.url + '/'),
        h('div', { class: 'nlwg-meta' }, 'วันที่ในเครื่องผู้ใช้ (สมมติ): ' + TODAY),
        h('div', { class: 'nlwg-scroll' }, h('table', { class: 'nlwg-cert' }, h('tbody', null,
          row('Subject (CN)', c.cn),
          row('Subject Alternative Name (SAN)', c.san.map(s => 'DNS:' + s).join(', ')),
          row('Issuer (ผู้ออก)', c.chain[0].by),
          row('Valid from', c.from),
          row('Valid to', c.to)))),
        h('div', { class: 'nlwg-q' }, 'ห่วงโซ่ใบรับรอง (Certificate chain) จากบนลงล่าง: ใบของเว็บ -> ผู้ออก'),
        h('ul', { class: 'nlwg-chain' }, c.chain.slice().map((x, i) => h('li', null, x.n,
          h('small', null, (i === 0 ? 'ใบของเว็บ' : x.n === x.by ? 'Root (ลงนามตัวเอง)' : 'CA ระดับกลาง') + ' | ลงนามโดย: ' + x.by +
            (x.n === x.by ? ' | อยู่ใน Trust Store ของเบราว์เซอร์: ' + (TRUST_STORE.includes(x.n) ? 'ใช่' : 'ไม่ใช่') : ''))))),
        h('p', { class: 'nlw-small' }, 'Trust Store ของเบราว์เซอร์ในกิจกรรมนี้มี: ' + TRUST_STORE.join(', ')));
      dec.set(a.d); rs.set(a.r);
      if (!a.done) fb.replaceChildren();
      else {
        const { dOK, rOK, k } = a.done;
        const right = REASONS.find(x => x[0] === k.reason)[1];
        const items = [
          [k.dateOK, 'วันที่: ' + (k.dateOK ? TODAY + ' อยู่ในช่วง ' + c.from + ' ถึง ' + c.to : (TODAY > c.to ? 'หมดอายุแล้ว ' + k.days + ' วัน (Valid to ' + c.to + ')' : 'ยังไม่ถึงวันเริ่มใช้'))],
          [k.hostOK, 'ชื่อโฮสต์: ' + c.url + (k.hostOK ? ' ตรงกับ SAN ' + c.san.filter(p => hostMatches(p, c.url)).join(', ') + (c.san.some(p => p[0] === '*' && hostMatches(p, c.url)) ? ' (ดอกจันแทนได้ 1 ระดับชื่อเท่านั้น เช่น a.example.ac.th ได้ แต่ x.a.example.ac.th ไม่ได้)' : '') : ' ไม่อยู่ในรายชื่อ SAN (' + c.san.join(', ') + ') เบราว์เซอร์ใช้ SAN ตรวจชื่อ ไม่ได้ดูแค่ CN')],
          [k.chainOK, 'ผู้ออก: ' + (k.chainOK ? 'ไล่ห่วงโซ่ถึง ' + k.last.n + ' ซึ่งอยู่ใน Trust Store' : k.selfSigned ? 'ลงนามตัวเอง ไม่มี CA ที่เชื่อถือรับรอง' : 'ห่วงโซ่จบที่ ' + k.last.n + ' ซึ่งไม่อยู่ใน Trust Store')]
        ];
        fb.replaceChildren(
          result(dOK && rOK ? 'ok' : dOK ? 'warn' : 'bad',
            (dOK ? 'ตัดสินใจถูก' : 'ตัดสินใจยังไม่ถูก') + ' | ' + (rOK ? 'เหตุผลถูก' : 'เหตุผลที่ถูกคือ: ' + right) +
            (k.reason === 'self' && a.r === 'ca' ? ' (ตอบ CA ไม่รู้จักก็ถือว่าถูก แต่ชื่อที่ตรงที่สุดคือ Self-signed)' : '')),
          h('ul', { class: 'nlwg-fb' }, items.map(x => h('li', { class: x[0] ? 'nlwg-y' : 'nlwg-n' }, h('b', null, x[0] ? 'ผ่าน: ' : 'ไม่ผ่าน: '), x[1]))),
          ...(k.trust ? [] : [h('p', { class: 'nlw-small' }, 'ตัวอย่างรหัสข้อผิดพลาดใน Chrome/Edge: ' + ERR[k.reason])]),
          h('p', null, ADVICE[k.reason]));
      }
      const done = ans.filter(x => x.done), good = done.filter(x => x.done.dOK && x.done.rOK).length;
      sum.textContent = 'ตรวจแล้ว ' + done.length + '/' + CERT_CASES.length + ' กรณี ถูกทั้งการตัดสินใจและเหตุผล ' + good + ' กรณี';
    }
    render();
  }
  NL_FIG('widget', 'cert-inspector', certInspector);
})();
