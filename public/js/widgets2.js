'use strict';
(function(){
  /* ===================================================================
     NetLab interactive widgets, set 2. Usage: NL_WIDGETS[name](rootDiv)
     Loaded after widgets.js. Reuses .nlw- classes; own CSS uses .nlw2-
     No global ids (except the style tag), no storage, no network.
     =================================================================== */
  const CSS = `
.nlw2 [hidden]{display:none !important}
.nlw2 .nlw-btn.nlw-mono{max-width:100%;overflow-wrap:anywhere;text-align:left}
.nlw2 .nlw2-radio{display:flex;gap:8px;align-items:center;font-size:15px;cursor:pointer;min-height:32px}
.nlw2 input[type=radio]{width:18px;height:18px;accent-color:var(--blue);margin:0;flex:none}
.nlw2 .nlw2-sub{font-weight:700;font-size:15.5px;margin:12px 0 4px}
.nlw2 .nlw2-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:8px;margin:8px 0}
.nlw2 .nlw2-card{border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--field);min-width:0}
.nlw2 .nlw2-card.nlw2-off{opacity:.6}
.nlw2 .nlw2-card h4{margin:0 0 4px;font-size:15px;line-height:1.35}
.nlw2 .nlw2-card p{margin:.2em 0;font-size:14px}
.nlw2 .nlw2-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}
.nlw2 .nlw2-g2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,112px),1fr));gap:6px 8px}
.nlw2 .nlw2-g2.nlw2-wide{grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))}
.nlw2 .nlw2-g2 select,.nlw2 .nlw2-g2 input[type=text]{width:100%}
.nlw2 .nlw2-steps{margin:6px 0;padding-left:22px}
.nlw2 .nlw2-steps li{margin:4px 0}
.nlw2 .nlw2-fail{color:var(--bad);font-weight:600}
.nlw2 .nlw2-pass{color:var(--ok);font-weight:600}
/* ipv6 */
.nlw2 .nlw2-v6in{width:100%;max-width:440px}
.nlw2 .nlw2-groups{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;margin:8px 0}
.nlw2 .nlw2-grp{border:1px solid var(--line);border-top:4px solid var(--line);border-radius:6px;background:var(--panel);text-align:center;padding:3px 2px;min-width:0}
.nlw2 .nlw2-grp b{display:block;font-family:"JetBrains Mono",Consolas,monospace;font-size:14px}
.nlw2 .nlw2-grp i{display:block;font-style:normal;font-size:11.5px;color:var(--muted)}
.nlw2 .nlw2-grp.nlw2-net{border-top-color:var(--blue)}
.nlw2 .nlw2-grp.nlw2-iid{border-top-color:var(--orange)}
.nlw2 .nlw2-grp.nlw2-zero b{color:var(--muted)}
.nlw2 .nlw2-big{font-family:"JetBrains Mono",Consolas,monospace;font-size:16px;font-weight:600;word-break:break-all}
@media (max-width:520px){.nlw2 .nlw2-groups{grid-template-columns:repeat(4,minmax(0,1fr))}}
/* subnet bar */
.nlw2 .nlw2-bar{display:flex;width:100%;height:40px;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:8px 0;background:var(--field)}
.nlw2 .nlw2-seg{flex:1 1 0;min-width:0;border:0;border-right:1px solid var(--panel);padding:0;margin:0;font:inherit;font-size:12px;font-weight:700;color:var(--on-accent);cursor:pointer;overflow:hidden;white-space:nowrap}
.nlw2 .nlw2-seg:last-child{border-right:0}
.nlw2 .nlw2-seg.nlw2-c0{background:var(--blue)}.nlw2 .nlw2-seg.nlw2-c1{background:var(--green)}
.nlw2 .nlw2-seg[aria-pressed="true"]{background:var(--orange)}
.nlw2 .nlw2-seg:focus-visible{outline:3px solid var(--ink);outline-offset:-3px}
.nlw2 tr.nlw2-sel td{background:color-mix(in srgb,var(--orange) 16%,transparent)}
.nlw2 .nlw2-axis{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);font-family:"JetBrains Mono",Consolas,monospace;gap:8px}
/* route table */
.nlw2 .nlw-rule.nlw2-match{border:2px dashed var(--blue)}
.nlw2 .nlw-rule.nlw-hit{border:2px solid var(--ok);box-shadow:inset 4px 0 0 var(--ok)}
.nlw2 .nlw-rule input.nlw2-dst{width:150px}
.nlw2 .nlw-rule input.nlw2-hop{width:130px}
.nlw2 .nlw-rule input.nlw2-ifc{width:96px}
.nlw2 .nlw2-tag{font-size:12.5px;font-weight:700;border-radius:4px;padding:0 6px;border:1px solid currentColor;white-space:nowrap}
/* nic form */
.nlw2 .nlw2-win{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--field);margin:8px 0}
.nlw2 .nlw2-frow{display:grid;grid-template-columns:minmax(0,190px) minmax(0,190px);gap:4px 10px;align-items:center;margin:4px 0 4px 26px}
.nlw2 .nlw2-frow label{font-size:14.5px}
.nlw2 .nlw2-frow input{width:100%}
.nlw2 .nlw2-frow input:disabled{opacity:.5}
@media (max-width:480px){.nlw2 .nlw2-frow{grid-template-columns:minmax(0,1fr);margin-left:0;gap:2px}}
.nlw2 .nlw2-issues{list-style:none;padding:0;margin:6px 0}
.nlw2 .nlw2-issues li{border-left:4px solid var(--line);padding:4px 10px;margin:5px 0;background:var(--field);border-radius:0 6px 6px 0;font-size:14.5px}
.nlw2 .nlw2-issues li.nlw2-e{border-left-color:var(--bad)}
.nlw2 .nlw2-issues li.nlw2-w{border-left-color:var(--orange)}
.nlw2 .nlw2-issues li.nlw2-i{border-left-color:var(--blue)}
.nlw2 .nlw2-issues li b{margin-right:4px}
/* threat */
.nlw2 .nlw2-scn{font-size:16px;border:1px solid var(--line);border-left:5px solid var(--blue);border-radius:0 10px 10px 0;padding:10px 12px;background:var(--field);margin:8px 0}
.nlw2 .nlw2-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,128px),1fr));gap:6px}
.nlw2 .nlw2-opts .nlw-btn{width:100%}
.nlw2 .nlw2-opts .nlw-btn.nlw2-right{background:var(--ok);border-color:var(--ok);color:var(--on-accent);font-weight:700}
.nlw2 .nlw2-opts .nlw-btn.nlw2-wrong{background:var(--bad);border-color:var(--bad);color:var(--on-accent);font-weight:700}
.nlw2 .nlw2-progress{height:8px;background:var(--line);border-radius:4px;overflow:hidden;margin:4px 0 8px}
.nlw2 .nlw2-progress i{display:block;height:100%;background:var(--blue)}
@media (prefers-reduced-motion:no-preference){.nlw2 .nlw2-progress i{transition:width .25s}.nlw2 .nlw2-seg{transition:background-color .15s}}
@media (pointer:coarse){
  .nlw2 .nlw-btn,.nlw2 .nlw-btn.nlw-sm,.nlw2 select,.nlw2 input[type=text],.nlw2 input[type=number]{min-height:44px}
  .nlw2 .nlw-btn.nlw-sm{min-width:44px}
  .nlw2 .nlw-check,.nlw2 .nlw2-radio{min-height:44px}
  .nlw2 .nlw2-seg{min-height:44px}
  .nlw2 .nlw2-bar{height:46px}
}
`;
  function injectCSS(){
    // base .nlw- styles live in widgets.js and are injected the first time one of its widgets renders
    if (!document.getElementById('nl-widget-css')){
      const base = window.NL_WIDGETS && window.NL_WIDGETS['caesar'];
      if (typeof base === 'function'){ try { base(document.createElement('div')); } catch(e){} }
    }
    if (document.getElementById('nlw2-css')) return;
    const st = document.createElement('style');
    st.id = 'nlw2-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------- tiny DOM helpers (same contract as widgets.js) ---------- */
  const PROPS = { value:1, checked:1, disabled:1, selected:1 };
  function h(tag, props){
    const e = document.createElement(tag);
    if (props) for (const k in props){
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.slice(0,2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (PROPS[k]) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c){
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(x => add(e, x)); return; }
    e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function frame(root, title, instr){
    injectCSS();
    root.replaceChildren();
    root.classList.add('nlw', 'nlw2');
    root.appendChild(h('div', {class:'nlw-title'}, title));
    root.appendChild(h('p', {class:'nlw-instr'}, h('b', null, 'คำแนะนำการใช้งาน: '), instr));
    return root;
  }
  function seg(options, value, onChange, label){
    const wrap = h('div', {class:'nlw-seg', role:'group', 'aria-label': label || null});
    const btns = options.map(o => {
      const b = h('button', {type:'button', class:'nlw-btn', 'data-v': o[0], 'aria-pressed': String(o[0] === value),
        onclick: () => { api.set(o[0]); onChange(o[0]); }}, o[1]);
      wrap.appendChild(b);
      return b;
    });
    const api = { el: wrap, set(v){ btns.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === String(v)))); } };
    return api;
  }
  function field(label, control){
    return h('label', {class:'nlw-field'}, h('span', null, label), control);
  }
  function select(options, value, onchange, attrs){
    const sel = h('select', Object.assign({onchange}, attrs || {}));
    options.forEach(o => sel.appendChild(h('option', {value: o[0], selected: o[0] === value}, o[1])));
    return sel;
  }
  function chip(text, kind, attrs){
    return h('span', Object.assign({class:'nlw-chip' + (kind ? ' nlw-is-' + kind : '')}, attrs || {}), text);
  }
  const fmt = n => Number(n).toLocaleString('en-US');

  /* ---------- IPv4 helpers (unsigned 32-bit) ---------- */
  function parseIP(str){
    const t = String(str).trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) return null;
    const p = t.split('.').map(Number);
    if (p.some(x => x > 255)) return null;
    return (((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]) >>> 0;
  }
  const ipStr = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const maskOf = p => p === 0 ? 0 : ((0xFFFFFFFF << (32 - p)) >>> 0);
  function prefixFromMask(m){
    const inv = (~m) >>> 0;
    if (((inv & (inv + 1)) >>> 0) !== 0) return -1;
    let bits = 0; for (let i = 0; i < 32; i++) if ((m >>> i) & 1) bits++;
    return bits;
  }
  // "a.b.c.d/p" or "a.b.c.d 255.255.255.0"  -> {ip, p} | {err}
  function parseCIDR(str){
    const t = String(str).trim();
    let m = t.match(/^(\S+)\s*\/\s*(\d{1,2})$/), ipT, p;
    if (m){ ipT = m[1]; p = Number(m[2]); if (p > 32) return {err:'Prefix ต้องอยู่ระหว่าง /0 ถึง /32'}; }
    else if ((m = t.match(/^(\S+)\s+(\S+)$/))){
      ipT = m[1]; const mk = parseIP(m[2]);
      if (mk === null) return {err:'Subnet mask "' + m[2] + '" ไม่ถูกต้อง'};
      p = prefixFromMask(mk); if (p < 0) return {err:'Subnet mask ต้องมีบิต 1 เรียงติดกันจากซ้าย เช่น 255.255.255.0'};
    } else return {err:'ต้องพิมพ์ในรูป เครือข่าย/prefix เช่น 192.168.10.0/24'};
    const ip = parseIP(ipT);
    if (ip === null) return {err:'IP "' + ipT + '" ไม่ถูกต้อง: ต้องเป็นตัวเลข 4 ชุดคั่นด้วยจุด แต่ละชุด 0–255'};
    return {ip, p};
  }

  /* ===================================================================
     1. ipv6-tool
     =================================================================== */
  function parseIPv6(input){
    let t = String(input).trim(), prefix = null, zone = null;
    if (t === '') return {err:'ยังไม่ได้พิมพ์ที่อยู่ IPv6'};
    const pm = t.match(/^(.*)\/(\d{1,3})$/);
    if (pm){ t = pm[1]; prefix = Number(pm[2]); if (prefix > 128) return {err:'Prefix ของ IPv6 ต้องอยู่ระหว่าง /0 ถึง /128'}; }
    else if (t.indexOf('/') >= 0) return {err:'Prefix หลังเครื่องหมาย / ต้องเป็นตัวเลข 0–128 เช่น /64'};
    const zi = t.indexOf('%');
    if (zi >= 0){ zone = t.slice(zi + 1); t = t.slice(0, zi); if (!/^[0-9A-Za-z._-]+$/.test(zone)) return {err:'Zone ID หลังเครื่องหมาย % ไม่ถูกต้อง (เช่น fe80::1%12 ใน Windows หมายถึงการ์ดเครือข่ายหมายเลข 12)'}; }
    if (/[^0-9a-fA-F:.]/.test(t)){
      const bad = t.match(/[^0-9a-fA-F:.]/)[0];
      return {err:'มีอักขระ "' + bad + '" ที่ใช้ไม่ได้ IPv6 ใช้เลขฐานสิบหกได้เฉพาะ 0–9 และ a–f คั่นแต่ละกลุ่มด้วย :'};
    }
    if (t.indexOf(':') < 0) return {err: /^\d{1,3}(\.\d{1,3}){3}$/.test(t) ? 'นี่เป็นรูปแบบ IPv4 (เลขฐานสิบ 4 ชุดคั่นด้วยจุด) ไม่ใช่ IPv6 ที่ใช้เลขฐานสิบหก 8 กลุ่มคั่นด้วย :' : 'IPv6 ต้องมีเครื่องหมาย : คั่นระหว่างกลุ่ม'};
    let v4 = null;
    const lc = t.lastIndexOf(':'), last = t.slice(lc + 1);
    if (last.indexOf('.') >= 0){
      v4 = parseIP(last);
      if (v4 === null) return {err:'ส่วน IPv4 ท้ายที่อยู่ ("' + last + '") ไม่ถูกต้อง'};
      t = t.slice(0, lc + 1) + (v4 >>> 16).toString(16) + ':' + (v4 & 65535).toString(16);
    }
    if (t.indexOf('.') >= 0) return {err:'เครื่องหมายจุด (.) ใช้ได้เฉพาะเมื่อเขียน IPv4 ฝังไว้ท้ายสุด เช่น ::ffff:192.168.1.10'};
    if (t.indexOf(':::') >= 0) return {err:'ห้ามมีเครื่องหมาย : ติดกัน 3 ตัว (ใช้ได้มากสุด :: )'};
    const dbl = t.split('::').length - 1;
    if (dbl > 1) return {err:'ใช้ :: ได้เพียงครั้งเดียว ถ้ามีสองที่จะไม่รู้ว่าแต่ละที่แทนกลุ่ม 0 กี่กลุ่ม'};
    let head, tail = [];
    if (dbl === 1){ const sp = t.split('::'); head = sp[0] ? sp[0].split(':') : []; tail = sp[1] ? sp[1].split(':') : []; }
    else head = t.split(':');
    const parts = head.concat(tail);
    for (const g of parts){
      if (g === '') return {err:'มีกลุ่มว่าง เช่น : เดี่ยวที่ต้นหรือท้ายที่อยู่ (ถ้าต้องการย่อกลุ่ม 0 ให้ใช้ :: )'};
      if (g.length > 4) return {err:'กลุ่ม "' + g + '" ยาวเกิน 4 หลัก แต่ละกลุ่มมีได้ 16 บิต คือเลขฐานสิบหกไม่เกิน 4 หลัก'};
    }
    let groups;
    if (dbl === 1){
      if (parts.length > 7) return {err:':: ต้องแทนกลุ่ม 0 อย่างน้อย 1 กลุ่ม แต่ที่อยู่นี้มีครบ ' + parts.length + ' กลุ่มแล้ว'};
      groups = head.concat(new Array(8 - parts.length).fill('0'), tail);
    } else {
      if (parts.length !== 8) return {err:'ต้องมี 8 กลุ่มพอดี (พบ ' + parts.length + ' กลุ่ม) หรือใช้ :: แทนกลุ่มที่เป็น 0 ที่ติดกัน'};
      groups = parts;
    }
    return {groups: groups.map(g => parseInt(g, 16)), prefix, zone, hadV4: v4 !== null};
  }
  const hex4 = n => ('000' + n.toString(16)).slice(-4);
  function v6Full(g){ return g.map(hex4).join(':'); }
  function v6Compress(g){
    let bs = -1, bl = 0;
    for (let i = 0; i < 8; ){
      if (g[i] !== 0){ i++; continue; }
      let j = i; while (j < 8 && g[j] === 0) j++;
      if (j - i > bl){ bs = i; bl = j - i; }   // strictly longer -> first run wins on tie
      i = j;
    }
    const hx = g.map(x => x.toString(16));
    if (bl < 2) return {text: hx.join(':'), start:-1, len:0};
    return {text: hx.slice(0, bs).join(':') + '::' + hx.slice(bs + bl).join(':'), start: bs, len: bl};
  }
  function v6Type(g){
    const z = (a, b) => { for (let i = a; i <= b; i++) if (g[i] !== 0) return false; return true; };
    if (z(0,7)) return {k:'unspecified', name:'Unspecified (::/128)', unicast:false,
      d:'ที่อยู่ว่าง หมายถึง "ยังไม่มีที่อยู่" ใช้เป็นที่อยู่ต้นทางขณะเครื่องกำลังขอที่อยู่ และใช้ในโปรแกรมเพื่อรอรับจากทุกการ์ด (เทียบกับ 0.0.0.0 ของ IPv4) กำหนดให้เครื่องไม่ได้'};
    if (z(0,6) && g[7] === 1) return {k:'loopback', name:'Loopback (::1/128)', unicast:false,
      d:'ที่อยู่วนกลับภายในเครื่องตัวเอง เทียบกับ 127.0.0.1 ของ IPv4 ใช้ทดสอบว่า TCP/IP ในเครื่องทำงาน เช่น ping ::1 แพ็กเก็ตไม่ออกจากเครื่อง'};
    if (z(0,4) && g[5] === 0xffff) return {k:'v4mapped', name:'IPv4-mapped (::ffff:0:0/96)', unicast:false,
      d:'ใช้แทน IPv4 ภายในโปรแกรมที่ทำงานแบบ IPv6 โดย 32 บิตท้ายคือ IPv4 ' + ipStr(((g[6] << 16) >>> 0) + g[7]) + ' ไม่ได้ส่งออกไปบนเครือข่าย IPv6 จริง'};
    if ((g[0] & 0xff00) === 0xff00){
      const sc = g[0] & 0xf, SC = {1:'interface-local (ภายในการ์ดเดียว)', 2:'link-local (ภายในลิงก์/วง LAN เดียว)', 4:'admin-local', 5:'site-local (ภายในไซต์)', 8:'organization-local (ภายในองค์กร)', 14:'global (ทั่วโลก)'};
      let extra = '';
      if (g[0] === 0xff02 && z(1,6) && g[7] === 1) extra = ' ที่อยู่นี้คือ ff02::1 = อุปกรณ์ IPv6 ทุกตัวในลิงก์ (All-nodes)';
      else if (g[0] === 0xff02 && z(1,6) && g[7] === 2) extra = ' ที่อยู่นี้คือ ff02::2 = เราเตอร์ทุกตัวในลิงก์ (All-routers)';
      return {k:'multicast', name:'Multicast (ff00::/8)', unicast:false,
        d:'ส่งถึงกลุ่มอุปกรณ์ที่สมัครรับ IPv6 ไม่มี Broadcast จึงใช้ Multicast แทน ขอบเขต (scope) = ' + (SC[sc] || 'ค่า ' + sc.toString(16)) + extra};
    }
    if ((g[0] & 0xffc0) === 0xfe80) return {k:'linklocal', name:'Link-local (fe80::/10)', unicast:true,
      d:'ทุกการ์ดที่เปิด IPv6 สร้างที่อยู่นี้เองอัตโนมัติ ใช้คุยได้เฉพาะในลิงก์ (วง LAN) เดียวกัน เราเตอร์ไม่ส่งต่อออกนอกวง (คล้ายแนวคิด 169.254.x.x ของ IPv4 แต่ IPv6 มีเสมอ) ใน Windows มักเห็นต่อท้ายด้วย %หมายเลขการ์ด'};
    if ((g[0] & 0xfe00) === 0xfc00) return {k:'ula', name:'Unique local (fc00::/7)', unicast:true,
      d:'ใช้ภายในองค์กร ไม่ถูกส่งออกอินเทอร์เน็ต เทียบได้กับ Private IP ของ IPv4 ที่ใช้จริงคือ fd00::/8 (บิต L = 1 กำหนดเองในองค์กร พร้อมสุ่ม Global ID 40 บิต)' + ((g[0] & 0xff00) === 0xfc00 ? ' ส่วน fc00::/8 ยังไม่มีการกำหนดวิธีใช้' : '')};
    if ((g[0] & 0xe000) === 0x2000){
      let extra = '';
      if (g[0] === 0x2001 && g[1] === 0x0db8) extra = ' หมายเหตุ: 2001:db8::/32 เป็นช่วงที่สงวนไว้สำหรับตัวอย่างในเอกสารและตำรา (RFC 3849) ไม่ใช้บนอินเทอร์เน็ตจริง';
      return {k:'global', name:'Global unicast (2000::/3)', unicast:true,
        d:'ที่อยู่สาธารณะที่ใช้บนอินเทอร์เน็ตได้ เทียบกับ Public IP ของ IPv4 ISP มักแจกให้ลูกค้าเป็นบล็อก เช่น /48 หรือ /56 แล้วแบ่งเป็นวงละ /64' + extra};
    }
    return {k:'other', name:'อื่น ๆ (ไม่อยู่ในช่วงที่ใช้งานทั่วไป)', unicast:false,
      d:'ไม่อยู่ในกลุ่ม loopback, unspecified, link-local, unique local, multicast, global unicast หรือ IPv4-mapped อาจเป็นช่วงที่สงวนไว้หรือเลิกใช้แล้ว เช่น fec0::/10 (site-local เดิม)'};
  }
  function ipv6Tool(root){
    frame(root, 'เครื่องมือ IPv6: ตรวจ ขยาย และย่อที่อยู่', 'พิมพ์ที่อยู่ IPv6 (ใส่ /prefix ต่อท้ายได้) หรือกดปุ่มตัวอย่าง เครื่องมือจะตรวจว่าถูกต้องไหม แสดงรูปเต็ม รูปย่อที่สั้นที่สุดตามมาตรฐาน RFC 5952 ประเภทของที่อยู่ และ 8 กลุ่ม กลุ่มละ 16 บิต');
    const inp = h('input', {type:'text', class:'nlw-mono nlw2-v6in', value:'2001:0db8:0000:0000:0000:ff00:0042:8329', autocomplete:'off', spellcheck:'false', autocapitalize:'off', 'data-in':'v6', 'aria-label':'ที่อยู่ IPv6', oninput: calc});
    const SAMPLES = ['2001:0db8:0000:0000:0000:ff00:0042:8329', 'fe80::1%12', '::1', '::', 'ff02::1', 'fd12:3456:789a:1::1/64', '::ffff:192.168.1.10', '2001:db8:0:0:1:0:0:1', 'FE80:0:0:0:0204:61FF:FE9D:F156', '2001:db8::1::2'];
    const samples = h('div', {class:'nlw-row nlw-center', role:'group', 'aria-label':'ที่อยู่ตัวอย่าง'},
      SAMPLES.map(sv => h('button', {type:'button', class:'nlw-btn nlw-sm nlw-mono', onclick: () => { inp.value = sv; calc(); }}, sv)));
    const msg = h('div', {class:'nlw-result', 'aria-live':'polite', 'data-k':'status'});
    const out = h('div');
    const showBin = {v:false};
    root.append(field('ที่อยู่ IPv6', inp), h('div', {class:'nlw-small', style:'margin-top:6px'}, 'ตัวอย่าง:'), samples, msg, out);
    function calc(){
      const r = parseIPv6(inp.value);
      inp.classList.toggle('nlw-invalid', !!r.err);
      out.replaceChildren();
      if (r.err){ msg.className = 'nlw-result nlw-is-bad'; msg.textContent = 'ไม่ใช่ IPv6 ที่ถูกต้อง: ' + r.err; return; }
      const g = r.groups, c = v6Compress(g), T = v6Type(g);
      msg.className = 'nlw-result nlw-is-ok';
      msg.textContent = 'ถูกต้อง: ' + c.text + (r.prefix != null ? '/' + r.prefix : '') + ' เป็นประเภท ' + T.name;
      const row = (k, label, val, mono) => h('tr', null, h('th', {scope:'row'}, label), h('td', {'data-k':k, class: mono ? 'nlw2-big' : null}, val));
      const rows = [
        row('full', 'รูปเต็ม (Expanded)', v6Full(g), true),
        row('short', 'รูปย่อ (Compressed)', c.text, true)
      ];
      if (T.k === 'v4mapped') rows.push(row('mixed', 'แบบผสม IPv4', '::ffff:' + ipStr(((g[6] << 16) >>> 0) + g[7]), true));
      rows.push(row('type', 'ประเภท', T.name));
      if (r.prefix != null){
        const net = g.map((x, i) => { const b = Math.max(0, Math.min(16, r.prefix - 16 * i)); return b === 0 ? 0 : (x & ((0xffff << (16 - b)) & 0xffff)); });
        rows.push(row('net', 'เครือข่าย (Prefix)', v6Compress(net).text + '/' + r.prefix, true));
      }
      if (r.zone) rows.push(row('zone', 'Zone ID', '%' + r.zone + ' ระบุการ์ดเครือข่ายที่ใช้ส่ง (ไม่ใช่ส่วนของที่อยู่ 128 บิต)'));
      out.append(h('div', {class:'nlw-scroll'}, h('table', {class:'nlw-table'}, h('tbody', null, rows))),
        h('p', {class:'nlw-small', 'data-k':'typedesc'}, T.d));
      // explain the compression
      const steps = [];
      const orig = inp.value.trim().replace(/\/\d+$/, '').replace(/%.*$/, '');
      if (/[A-F]/.test(orig)) steps.push('เปลี่ยนตัวอักษรเป็นตัวพิมพ์เล็ก (a–f)');
      if (/(^|:)0[0-9a-fA-F]/.test(orig)) steps.push('ตัดเลข 0 นำหน้าในแต่ละกลุ่ม เช่น 0db8 → db8 และ 0000 → 0');
      if (c.len >= 2) steps.push('แทนกลุ่ม 0 ที่ติดกันยาวที่สุด (' + c.len + ' กลุ่ม ตั้งแต่กลุ่มที่ ' + (c.start + 1) + ') ด้วย :: ได้ครั้งเดียว ถ้ามีช่วงยาวเท่ากันให้ย่อช่วงแรก');
      else if (g.some(x => x === 0)) steps.push('มีกลุ่ม 0 เดี่ยว ๆ เท่านั้น ตามมาตรฐานห้ามใช้ :: แทนกลุ่ม 0 เพียงกลุ่มเดียว จึงเขียนเป็น 0');
      if (!steps.length) steps.push('ที่อยู่นี้อยู่ในรูปย่อที่สั้นที่สุดอยู่แล้ว');
      out.append(h('div', {class:'nlw2-sub'}, 'วิธีย่อตามกฎ RFC 5952'), h('ol', {class:'nlw2-steps'}, steps.map(t => h('li', null, t))));
      // groups
      const grid = h('div', {class:'nlw2-groups', 'data-k':'groups'});
      g.forEach((x, i) => grid.append(h('div', {class:'nlw2-grp' + (T.unicast ? (i < 4 ? ' nlw2-net' : ' nlw2-iid') : '') + (x === 0 ? ' nlw2-zero' : ''), title:'กลุ่มที่ ' + (i + 1) + ' = ' + x + ' ฐานสิบ'},
        h('i', null, 'กลุ่ม ' + (i + 1)), h('b', null, hex4(x)))));
      const binBox = h('div', {class:'nlw-box', hidden: !showBin.v},
        g.map((x, i) => h('div', {class:'nlw-bin'}, h('span', {class:'nlw-small'}, (i + 1) + ': '), hex4(x) + ' = ', ('000000000000000' + x.toString(2)).slice(-16).replace(/(\d{4})(?=\d)/g, '$1 '))));
      const binBtn = h('button', {type:'button', class:'nlw-btn nlw-sm', 'aria-pressed': String(showBin.v), onclick: () => { showBin.v = !showBin.v; binBox.hidden = !showBin.v; binBtn.setAttribute('aria-pressed', String(showBin.v)); }}, 'แสดงเลขฐานสอง 16 บิต');
      out.append(h('div', {class:'nlw2-sub'}, '8 กลุ่ม กลุ่มละ 16 บิต (รวม 128 บิต)'), grid,
        T.unicast ? h('p', {class:'nlw-small'}, h('span', {class:'nlw-netbit'}, 'ขอบน้ำเงิน'), ' = 64 บิตแรก ส่วนเครือข่าย (Network prefix) · ', h('span', {class:'nlw-hostbit'}, 'ขอบส้ม'), ' = 64 บิตหลัง Interface ID ของเครื่อง (วง LAN ทั่วไปใช้ /64)') : null,
        h('div', {class:'nlw-row'}, binBtn), binBox);
    }
    calc();
  }

  /* ===================================================================
     2. subnet-splitter
     =================================================================== */
  function subnetSplitter(root){
    frame(root, 'แบ่งเครือข่ายย่อยเท่า ๆ กัน (Subnetting)', 'พิมพ์เครือข่ายตั้งต้น เช่น 192.168.10.0/24 แล้วเลือกว่าจะแบ่งตาม "จำนวนซับเน็ต" หรือ "จำนวนโฮสต์ต่อซับเน็ต" ตารางและแถบแสดงช่วงที่อยู่จะคำนวณทันที กดแถบหรือแถวเพื่อเน้นซับเน็ตนั้น');
    let mode = 'count', selIdx = -1;
    const netIn = h('input', {type:'text', class:'nlw-mono', value:'192.168.10.0/24', autocomplete:'off', spellcheck:'false', 'data-in':'net', style:'width:190px', oninput: () => { selIdx = -1; calc(); }});
    const cntIn = h('input', {type:'number', min:'1', step:'1', value:'4', 'data-in':'count', style:'width:110px', oninput: () => { selIdx = -1; calc(); }});
    const hostIn = h('input', {type:'number', min:'1', step:'1', value:'50', 'data-in':'hosts', style:'width:110px', oninput: () => { selIdx = -1; calc(); }});
    const quick = h('div', {class:'nlw-seg', role:'group', 'aria-label':'จำนวนซับเน็ตที่ใช้บ่อย'},
      [2, 4, 8, 16, 32].map(n => h('button', {type:'button', class:'nlw-btn nlw-sm', onclick: () => { cntIn.value = n; selIdx = -1; calc(); }}, String(n))));
    const cntBox = h('div', {class:'nlw-row'}, field('จำนวนซับเน็ตที่ต้องการ', cntIn), quick);
    const hostBox = h('div', {class:'nlw-row', hidden:true}, field('จำนวนโฮสต์ต่อซับเน็ต (อย่างน้อย)', hostIn));
    const modeSeg = seg([['count', 'แบ่งตามจำนวนซับเน็ต'], ['hosts', 'แบ่งตามจำนวนโฮสต์']], mode, v => { mode = v; cntBox.hidden = v !== 'count'; hostBox.hidden = v !== 'hosts'; selIdx = -1; calc(); }, 'วิธีแบ่ง');
    const msg = h('div', {class:'nlw-result', 'aria-live':'polite', 'data-k':'summary'});
    const out = h('div');
    root.append(h('div', {class:'nlw-row'}, field('เครือข่ายตั้งต้น', netIn)), modeSeg.el, cntBox, hostBox, msg, out);
    function bad(t){ msg.className = 'nlw-result nlw-is-bad'; msg.textContent = t; out.replaceChildren(); }
    function calc(){
      const r = parseCIDR(netIn.value);
      netIn.classList.toggle('nlw-invalid', !!r.err);
      if (r.err) return bad('เครือข่ายตั้งต้นไม่ถูกต้อง: ' + r.err);
      const p = r.p, net = (r.ip & maskOf(p)) >>> 0;
      if (p > 30) return bad('/' + p + ' เล็กเกินไป แบ่งต่อไม่ได้ เพราะซับเน็ตที่เล็กที่สุดที่ยังมีโฮสต์ใช้งานคือ /30 (2 โฮสต์)');
      let np, note = '';
      cntIn.classList.remove('nlw-invalid'); hostIn.classList.remove('nlw-invalid');
      if (mode === 'count'){
        const n = Number(cntIn.value);
        if (!Number.isInteger(n) || n < 1){ cntIn.classList.add('nlw-invalid'); return bad('จำนวนซับเน็ตต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป'); }
        const bits = Math.ceil(Math.log2(n) - 1e-9);
        np = p + bits;
        if (np > 30){ cntIn.classList.add('nlw-invalid'); return bad('วง /' + p + ' แบ่งได้มากที่สุด ' + fmt(Math.pow(2, 30 - p)) + ' ซับเน็ต (ขนาด /30 ซับเน็ตละ 2 โฮสต์) ต้องการ ' + fmt(n) + ' ซับเน็ตจึงแบ่งไม่ได้'); }
        if (Math.pow(2, bits) !== n) note = 'จำนวน ' + n + ' ไม่ใช่เลขยกกำลังของ 2 การยืมบิตจึงต้องปัดขึ้นเป็น 2^' + bits + ' = ' + Math.pow(2, bits) + ' ซับเน็ต (ใช้ ' + n + ' ซับเน็ต เหลือสำรอง ' + (Math.pow(2, bits) - n) + ')';
      } else {
        const H = Number(hostIn.value);
        if (!Number.isInteger(H) || H < 1){ hostIn.classList.add('nlw-invalid'); return bad('จำนวนโฮสต์ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป'); }
        let hb = 2; while (Math.pow(2, hb) - 2 < H) hb++;
        np = 32 - hb;
        if (np < p){ hostIn.classList.add('nlw-invalid'); return bad('วง /' + p + ' มีโฮสต์ใช้งานได้สูงสุด ' + fmt(Math.pow(2, 32 - p) - 2) + ' เครื่อง ไม่พอสำหรับ ' + fmt(H) + ' เครื่องต่อซับเน็ต'); }
        note = 'ต้องการ ' + fmt(H) + ' โฮสต์: บิตโฮสต์ ' + hb + ' บิตให้ 2^' + hb + ' − 2 = ' + fmt(Math.pow(2, hb) - 2) + ' โฮสต์ ซึ่งเป็นค่าน้อยที่สุดที่พอ (' + (hb - 1) + ' บิตได้เพียง ' + fmt(Math.max(0, Math.pow(2, hb - 1) - 2)) + ')';
      }
      const count = Math.pow(2, np - p), size = Math.pow(2, 32 - np), hosts = size - 2;
      const k = Math.floor((np - 1) / 8), inc = np === 0 ? 0 : Math.pow(2, 8 * (k + 1) - np);
      msg.className = 'nlw-result nlw-is-ok';
      msg.textContent = ipStr(net) + '/' + p + ' แบ่งเป็น ' + fmt(count) + ' ซับเน็ต ขนาด /' + np + ' (mask ' + ipStr(maskOf(np)) + ') ซับเน็ตละ ' + fmt(hosts) + ' โฮสต์ใช้งานได้';
      out.replaceChildren();
      if (r.ip !== net) out.append(h('p', {class:'nlw-small nlw-warn'}, 'หมายเหตุ: ' + ipStr(r.ip) + ' มีบิตส่วนโฮสต์ไม่เป็น 0 จึงใช้ที่อยู่เครือข่ายจริง ' + ipStr(net) + '/' + p + ' เป็นจุดตั้งต้น'));
      out.append(h('div', {class:'nlw-box'},
        h('p', {'data-k':'borrow'}, 'ยืมบิตโฮสต์มา ' + (np - p) + ' บิต: /' + p + ' → /' + np + ' ได้ 2^' + (np - p) + ' = ' + fmt(count) + ' ซับเน็ต'),
        h('p', null, 'แต่ละซับเน็ตมี 2^' + (32 - np) + ' = ' + fmt(size) + ' ที่อยู่ ใช้งานได้ ' + fmt(size) + ' − 2 = ' + fmt(hosts) + ' โฮสต์ (หัก Network และ Broadcast)'),
        h('p', null, 'ขนาดบล็อก (ระยะห่าง) = ' + inc + ' ในออกเตตที่ ' + (k + 1) + ' ซับเน็ตจึงขึ้นต้นทีละ ' + inc),
        note ? h('p', {class:'nlw-warn'}, note) : null));
      // bar
      const MAXSEG = 64;
      if (count <= MAXSEG){
        const bar = h('div', {class:'nlw2-bar', role:'group', 'aria-label':'แถบช่วงที่อยู่ของ ' + ipStr(net) + '/' + p});
        for (let i = 0; i < count; i++){
          const sn = net + i * size;
          bar.append(h('button', {type:'button', class:'nlw2-seg nlw2-c' + (i % 2), 'aria-pressed': String(i === selIdx), 'aria-label':'ซับเน็ตที่ ' + (i + 1) + ' ' + ipStr(sn) + '/' + np,
            title: ipStr(sn) + '/' + np, onclick: () => { selIdx = selIdx === i ? -1 : i; calc(); }}, count <= 16 ? String(i + 1) : ''));
        }
        out.append(bar, h('div', {class:'nlw2-axis'}, h('span', null, ipStr(net)), h('span', null, ipStr((net + Math.pow(2, 32 - p) - 1) >>> 0))));
      } else out.append(h('p', {class:'nlw-small'}, 'มี ' + fmt(count) + ' ซับเน็ต เล็กเกินกว่าจะวาดแยกช่องบนแถบได้ ตารางด้านล่างแสดง ' + MAXSEG + ' ซับเน็ตแรก'));
      const tbody = h('tbody');
      const shown = Math.min(count, MAXSEG);
      for (let i = 0; i < shown; i++){
        const sn = (net + i * size) >>> 0, bc = (sn + size - 1) >>> 0;
        tbody.append(h('tr', {class: i === selIdx ? 'nlw2-sel' : null, 'data-row': i, tabindex:'0', 'aria-selected': String(i === selIdx),
          onclick: () => { selIdx = selIdx === i ? -1 : i; calc(); },
          onkeydown: e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); selIdx = selIdx === i ? -1 : i; calc(); } }},
          h('td', null, String(i + 1)), h('td', {class:'nlw-mono', 'data-k':'net'}, ipStr(sn) + '/' + np),
          h('td', {class:'nlw-mono', 'data-k':'first'}, ipStr(sn + 1)), h('td', {class:'nlw-mono', 'data-k':'last'}, ipStr(bc - 1)),
          h('td', {class:'nlw-mono', 'data-k':'bc'}, ipStr(bc)), h('td', {'data-k':'hosts'}, fmt(hosts))));
      }
      out.append(h('div', {class:'nlw-scroll', tabindex:'0', 'aria-label':'ตารางซับเน็ต (เลื่อนซ้ายขวาได้)'}, h('table', {class:'nlw-table'},
        h('thead', null, h('tr', null, ['#', 'Network', 'โฮสต์แรก', 'โฮสต์สุดท้าย', 'Broadcast', 'โฮสต์'].map(t => h('th', {scope:'col'}, t)))), tbody)));
      if (selIdx >= 0){
        const sn = (net + selIdx * size) >>> 0;
        out.append(h('p', {class:'nlw-small', 'aria-live':'polite'}, 'เลือกซับเน็ตที่ ' + (selIdx + 1) + ': ' + ipStr(sn) + '/' + np + ' ตั้งให้เครื่องได้ ' + ipStr(sn + 1) + ' ถึง ' + ipStr(sn + size - 2) + ' ส่วน Default gateway มักใช้โฮสต์แรก ' + ipStr(sn + 1)));
      }
    }
    calc();
  }

  /* ===================================================================
     3. route-lookup
     =================================================================== */
  const ROUTE_PRESETS = {
    pc: { name:'PC ในห้องแล็บ', dst:'8.8.8.8', samples:['192.168.10.25', '8.8.8.8', '127.0.0.1', '192.168.11.5'], rows:[
      {dst:'0.0.0.0/0', type:'via', hop:'192.168.10.1', ifc:'Ethernet'},
      {dst:'127.0.0.0/8', type:'direct', hop:'', ifc:'Loopback'},
      {dst:'192.168.10.0/24', type:'direct', hop:'', ifc:'Ethernet'}
    ]},
    branch: { name:'เราเตอร์สาขา', dst:'172.16.50.9', samples:['172.16.50.9', '172.16.8.1', '8.8.8.8', '192.168.20.77', '10.1.2.2'], rows:[
      {dst:'192.168.20.0/24', type:'direct', hop:'', ifc:'G0/1'},
      {dst:'10.1.1.0/30', type:'direct', hop:'', ifc:'S0/0/0'},
      {dst:'10.1.2.0/30', type:'direct', hop:'', ifc:'S0/0/1'},
      {dst:'172.16.0.0/16', type:'via', hop:'10.1.1.1', ifc:'S0/0/0'},
      {dst:'172.16.50.0/24', type:'via', hop:'10.1.2.2', ifc:'S0/0/1'},
      {dst:'0.0.0.0/0', type:'via', hop:'10.1.1.1', ifc:'S0/0/0'}
    ]}
  };
  function routeLookup(root){
    frame(root, 'ค้นหาเส้นทางในตาราง Routing (Longest Prefix Match)', 'แก้ไขตารางเส้นทางได้ (ปลายทาง/prefix, ส่งต่อให้ next hop หรือเชื่อมต่อตรง, interface) แล้วพิมพ์ IP ปลายทาง ระบบจะเน้นทุกเส้นทางที่ตรง (เส้นประ) และเลือกเส้นทางที่ prefix ยาวที่สุด (กรอบเขียว) พร้อมอธิบายเหตุผล');
    let rows = [], preset = 'pc';
    const dstIn = h('input', {type:'text', class:'nlw-mono', autocomplete:'off', spellcheck:'false', inputmode:'decimal', 'data-in':'dst', style:'width:170px', oninput: lookup});
    const presetSeg = seg(Object.keys(ROUTE_PRESETS).map(k => [k, ROUTE_PRESETS[k].name]), preset, v => load(v), 'ตารางตัวอย่าง');
    const samples = h('div', {class:'nlw-row nlw-center', role:'group', 'aria-label':'IP ปลายทางตัวอย่าง'});
    const list = h('div', {'data-k':'table'});
    const res = h('div', {class:'nlw-result', 'aria-live':'polite', 'data-k':'result'});
    const why = h('div', {class:'nlw-box', 'data-k':'why'});
    root.append(h('div', {class:'nlw-row nlw-center'}, h('span', {class:'nlw-small'}, 'ตารางตัวอย่าง:'), presetSeg.el),
      h('div', {class:'nlw2-sub'}, 'ตารางเส้นทาง (Routing table)'), list,
      h('div', {class:'nlw-row'}, h('button', {type:'button', class:'nlw-btn', 'data-act':'add', onclick: () => { rows.push({dst:'', type:'via', hop:'', ifc:''}); renderRows(); lookup(); const ins = list.querySelectorAll('input.nlw2-dst'); if (ins.length) ins[ins.length - 1].focus(); }}, 'เพิ่มเส้นทาง')),
      h('div', {class:'nlw-row'}, field('IP ปลายทางของแพ็กเก็ต', dstIn)), samples, res, why);
    function load(k){
      preset = k; const P = ROUTE_PRESETS[k];
      rows = P.rows.map(r => Object.assign({}, r));
      dstIn.value = P.dst;
      samples.replaceChildren(h('span', {class:'nlw-small'}, 'ลองปลายทาง:'), ...P.samples.map(sv => h('button', {type:'button', class:'nlw-btn nlw-sm nlw-mono', onclick: () => { dstIn.value = sv; lookup(); }}, sv)));
      renderRows(); lookup();
    }
    function parseRow(r){
      const t = r.dst.trim();
      const m = t.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})$/);
      if (!m) return {err:'ปลายทางต้องอยู่ในรูป เครือข่าย/prefix เช่น 192.168.1.0/24'};
      const ip = parseIP(m[1]), p = Number(m[2]);
      if (ip === null) return {err:'IP เครือข่าย ' + m[1] + ' ไม่ถูกต้อง'};
      if (p > 32) return {err:'prefix ต้องไม่เกิน /32'};
      const net = (ip & maskOf(p)) >>> 0;
      if (net !== ip) return {err:'มีบิตโฮสต์ไม่เป็น 0 ควรเขียนเป็น ' + ipStr(net) + '/' + p};
      let hop = null;
      if (r.type === 'via'){ hop = parseIP(r.hop); if (hop === null) return {err:'Next hop ต้องเป็น IP ที่ถูกต้อง หรือเลือก "เชื่อมต่อตรง"'}; }
      return {net, p, mask: maskOf(p), hop};
    }
    function renderRows(){
      list.replaceChildren();
      rows.forEach((r, i) => {
        const hop = h('input', {type:'text', class:'nlw-mono nlw2-hop', value:r.hop, placeholder:'IP next hop', 'aria-label':'Next hop แถวที่ ' + (i + 1), disabled: r.type === 'direct', autocomplete:'off', spellcheck:'false',
          oninput: e => { r.hop = e.target.value; lookup(); }});
        const typ = select([['via', 'ส่งต่อให้'], ['direct', 'เชื่อมต่อตรง']], r.type, e => { r.type = e.target.value; hop.disabled = r.type === 'direct'; if (r.type === 'direct') { r.hop = ''; hop.value = ''; } lookup(); }, {'aria-label':'ชนิดเส้นทางแถวที่ ' + (i + 1)});
        list.append(h('div', {class:'nlw-rule', 'data-row': i},
          h('span', {class:'nlw-num'}, String(i + 1)),
          h('input', {type:'text', class:'nlw-mono nlw2-dst', value:r.dst, placeholder:'เช่น 10.0.0.0/8', 'aria-label':'ปลายทาง/prefix แถวที่ ' + (i + 1), autocomplete:'off', spellcheck:'false', oninput: e => { r.dst = e.target.value; lookup(); }}),
          typ, hop,
          h('input', {type:'text', class:'nlw2-ifc', value:r.ifc, placeholder:'Interface', 'aria-label':'Interface แถวที่ ' + (i + 1), autocomplete:'off', spellcheck:'false', oninput: e => { r.ifc = e.target.value; lookup(); }}),
          h('span', {class:'nlw2-tag', 'data-k':'tag'}),
          h('button', {type:'button', class:'nlw-btn nlw-sm', 'aria-label':'ลบเส้นทางแถวที่ ' + (i + 1), onclick: () => { rows.splice(i, 1); renderRows(); lookup(); }}, 'ลบ')));
      });
      if (!rows.length) list.append(h('p', {class:'nlw-small'}, 'ตารางว่าง ทุกแพ็กเก็ตจะถูกทิ้งเพราะไม่มีเส้นทาง'));
    }
    function lookup(){
      const ip = parseIP(dstIn.value);
      dstIn.classList.toggle('nlw-invalid', ip === null);
      const parsed = rows.map(parseRow);
      const els = list.querySelectorAll('.nlw-rule');
      let best = -1;
      const lines = [];
      parsed.forEach((pr, i) => {
        const el = els[i]; if (!el) return;
        const tag = el.querySelector('[data-k=tag]');
        el.classList.remove('nlw-hit', 'nlw2-match', 'nlw-badrule');
        el.querySelector('.nlw2-dst').classList.toggle('nlw-invalid', !!pr.err && !/Next hop/.test(pr.err));
        el.querySelector('.nlw2-hop').classList.toggle('nlw-invalid', !!pr.err && /Next hop/.test(pr.err));
        if (pr.err){ el.classList.add('nlw-badrule'); tag.className = 'nlw2-tag nlw-bad'; tag.textContent = 'ผิดรูปแบบ'; lines.push(h('li', null, 'แถว ' + (i + 1) + ': ข้าม เพราะ' + pr.err)); return; }
        if (ip === null){ tag.className = 'nlw2-tag'; tag.textContent = '/' + pr.p; return; }
        const and = (ip & pr.mask) >>> 0, hit = and === pr.net;
        if (hit && (best < 0 || pr.p > parsed[best].p)) best = i;
        tag.className = 'nlw2-tag ' + (hit ? 'nlw-ok' : 'nlw-small');
        tag.textContent = hit ? 'ตรง /' + pr.p : 'ไม่ตรง';
        if (hit) el.classList.add('nlw2-match');
        lines.push(h('li', {'data-match': String(hit)}, 'แถว ' + (i + 1) + ' ' + ipStr(pr.net) + '/' + pr.p + ': ',
          h('span', {class:'nlw-mono'}, ipStr(ip) + ' AND ' + ipStr(pr.mask) + ' = ' + ipStr(and)),
          hit ? h('b', {class:'nlw-ok'}, ' ตรงกับเครือข่าย (prefix ยาว ' + pr.p + ' บิต)') : h('span', {class:'nlw-bad'}, ' ≠ ' + ipStr(pr.net) + ' ไม่ตรง')));
      });
      why.replaceChildren();
      if (ip === null){ res.className = 'nlw-result nlw-is-bad'; res.textContent = 'IP ปลายทางไม่ถูกต้อง: ต้องเป็นตัวเลข 4 ชุดคั่นด้วยจุด แต่ละชุด 0–255'; return; }
      const matches = parsed.map((pr, i) => (!pr.err && ((ip & pr.mask) >>> 0) === pr.net) ? i : -1).filter(i => i >= 0);
      if (best < 0){
        res.setAttribute('data-best', '-1'); res.removeAttribute('data-prefix');
        res.className = 'nlw-result nlw-is-bad';
        res.textContent = 'ไม่มีเส้นทางที่ตรงกับ ' + ipStr(ip) + ' และไม่มี Default route (0.0.0.0/0) แพ็กเก็ตจึงถูกทิ้ง (Destination unreachable)';
      } else {
        const pr = parsed[best], r = rows[best];
        els[best].classList.remove('nlw2-match'); els[best].classList.add('nlw-hit');
        const ties = matches.filter(i => i !== best && parsed[i].p === pr.p);
        res.className = 'nlw-result nlw-is-ok';
        res.setAttribute('data-best', String(best));
        res.setAttribute('data-prefix', String(pr.p));
        let action;
        if (r.type === 'direct') action = 'ปลายทางอยู่ในเครือข่ายที่เชื่อมต่อตรง ส่งออกทาง ' + (r.ifc || '(ไม่ระบุ interface)') + ' ถึงเครื่อง ' + ipStr(ip) + ' โดยตรง (ใช้ ARP หา MAC ของ ' + ipStr(ip) + ')';
        else action = 'ส่งต่อให้ next hop ' + ipStr(pr.hop) + ' ทาง ' + (r.ifc || '(ไม่ระบุ interface)') + ' (ใช้ ARP หา MAC ของ ' + ipStr(pr.hop) + ' ไม่ใช่ของปลายทาง)';
        res.textContent = 'เลือกแถว ' + (best + 1) + ': ' + ipStr(pr.net) + '/' + pr.p + ' → ' + action;
        const explain = [];
        if (matches.length > 1) explain.push('มีเส้นทางที่ตรง ' + matches.length + ' แถว (' + matches.map(i => '/' + parsed[i].p).join(', ') + ') เราเตอร์เลือก /' + pr.p + ' เพราะ prefix ยาวที่สุด แปลว่าระบุเครือข่ายได้เจาะจงที่สุด (Longest Prefix Match)');
        else explain.push('มีเส้นทางที่ตรงเพียงแถวเดียว จึงใช้แถวนี้');
        if (pr.p === 0) explain.push('แถวนี้คือ Default route (0.0.0.0/0) ตรงกับทุกที่อยู่เพราะ mask เป็น 0 ทั้งหมด จึงถูกใช้เมื่อไม่มีเส้นทางอื่นที่เจาะจงกว่า เครื่อง PC เรียก next hop ของเส้นทางนี้ว่า Default gateway');
        if (ties.length) explain.push('แถว ' + ties.map(i => i + 1).join(', ') + ' มี prefix ยาวเท่ากัน ตัวจำลองนี้ใช้แถวแรก ส่วนเราเตอร์จริงจะตัดสินด้วยค่า Administrative distance หรือ metric');
        if (r.type === 'via'){
          const conn = parsed.some((q, i) => !q.err && rows[i].type === 'direct' && ((pr.hop & q.mask) >>> 0) === q.net);
          if (!conn) explain.push('ข้อควรระวัง: next hop ' + ipStr(pr.hop) + ' ไม่อยู่ในเครือข่ายที่เชื่อมต่อตรงแถวใดเลย เราเตอร์จริงจะส่งไปหา next hop นี้ไม่ได้');
        }
        why.append(h('p', null, h('b', null, 'เหตุผล: '), explain.join(' ')));
      }
      why.append(h('div', {class:'nlw-small'}, 'ตรวจทุกแถวด้วยการ AND IP ปลายทางกับ mask ของแถวนั้น ถ้าผลเท่ากับเครือข่ายของแถวถือว่าตรง'), h('ul', {class:'nlw-list nlw-small'}, lines));
    }
    load(preset);
  }

  /* ===================================================================
     4. nic-config
     =================================================================== */
  function nicConfig(root){
    frame(root, 'ตรวจการตั้งค่า IPv4 ของการ์ดเครือข่าย (Windows)', 'กรอกค่าเหมือนหน้าต่าง Internet Protocol Version 4 (TCP/IPv4) Properties ใน Windows หรือกดปุ่มสถานการณ์ตัวอย่าง ระบบจะตรวจทุกช่องทันทีและบอกปัญหาที่พบพร้อมเหตุผล');
    const uid = 'nlw2nic' + Math.random().toString(36).slice(2, 8);
    let ipMode = 'static', dnsMode = 'static';
    const inp = (k, v) => h('input', {type:'text', class:'nlw-mono', value:v, id: uid + k, 'data-in':k, inputmode:'decimal', autocomplete:'off', spellcheck:'false', oninput: check});
    const F = { ip: inp('ip', '192.168.20.30'), mask: inp('mask', '255.255.255.0'), gw: inp('gw', '192.168.20.1'), dns1: inp('dns1', '192.168.20.10'), dns2: inp('dns2', '8.8.8.8') };
    const radio = (name, val, label, cur, on) => {
      const r = h('input', {type:'radio', name: uid + name, value: val, checked: cur === val, 'data-mode': name + '-' + val, onchange: () => on(val)});
      return {el: h('label', {class:'nlw2-radio'}, r, h('span', null, label)), input: r};
    };
    const rIpAuto = radio('ip', 'dhcp', 'Obtain an IP address automatically', ipMode, v => setIp(v));
    const rIpSt = radio('ip', 'static', 'Use the following IP address:', ipMode, v => setIp(v));
    const rDnsAuto = radio('dns', 'dhcp', 'Obtain DNS server address automatically', dnsMode, v => setDns(v));
    const rDnsSt = radio('dns', 'static', 'Use the following DNS server addresses:', dnsMode, v => setDns(v));
    const frow = (k, label) => h('div', {class:'nlw2-frow'}, h('label', {for: uid + k}, label), F[k]);
    const win = h('div', {class:'nlw2-win', role:'group', 'aria-label':'Internet Protocol Version 4 (TCP/IPv4) Properties'},
      h('div', {class:'nlw-small', style:'font-weight:700;margin-bottom:4px'}, 'Internet Protocol Version 4 (TCP/IPv4) Properties'),
      rIpAuto.el, rIpSt.el, frow('ip', 'IP address:'), frow('mask', 'Subnet mask:'), frow('gw', 'Default gateway:'),
      h('div', {style:'height:6px'}), rDnsAuto.el, rDnsSt.el, frow('dns1', 'Preferred DNS server:'), frow('dns2', 'Alternate DNS server:'));
    const PRESETS = [
      ['ok', 'ตั้งถูกต้อง', ['static', 'static', '192.168.20.30', '255.255.255.0', '192.168.20.1', '192.168.20.10', '8.8.8.8']],
      ['gw', 'Gateway ผิดวง', ['static', 'static', '192.168.20.30', '255.255.255.0', '192.168.2.1', '192.168.20.10', '']],
      ['bc', 'IP เป็น Broadcast', ['static', 'static', '192.168.20.255', '255.255.255.0', '192.168.20.1', '192.168.20.10', '']],
      ['mask', 'Mask ผิด', ['static', 'static', '192.168.20.30', '255.255.0.255', '192.168.20.1', '192.168.20.10', '']],
      ['apipa', 'APIPA', ['static', 'static', '169.254.12.5', '255.255.0.0', '', '', '']],
      ['dup', 'ค่าซ้ำกัน', ['static', 'static', '192.168.20.30', '255.255.255.0', '192.168.20.30', '192.168.20.1', '192.168.20.1']],
      ['dhcp', 'รับอัตโนมัติ (DHCP)', ['dhcp', 'dhcp', '', '', '', '', '']]
    ];
    const pre = h('div', {class:'nlw-row nlw-center', role:'group', 'aria-label':'สถานการณ์ตัวอย่าง'}, PRESETS.map(p => h('button', {type:'button', class:'nlw-btn nlw-sm', 'data-preset': p[0], onclick: () => {
      const v = p[2]; F.ip.value = v[2]; F.mask.value = v[3]; F.gw.value = v[4]; F.dns1.value = v[5]; F.dns2.value = v[6]; setIp(v[0], true); setDns(v[1]);
    }}, p[1])));
    const res = h('div', {class:'nlw-result', 'aria-live':'polite', 'data-k':'result'});
    const issues = h('ul', {class:'nlw2-issues', 'data-k':'issues'});
    const calcBox = h('div');
    root.append(h('div', {class:'nlw-small'}, 'สถานการณ์ตัวอย่าง:'), pre, win, res, issues, calcBox);
    function setIp(v, keepDns){
      ipMode = v; rIpAuto.input.checked = v === 'dhcp'; rIpSt.input.checked = v === 'static';
      // Windows: a static IP forces static DNS; the "obtain DNS automatically" option is disabled
      rDnsAuto.input.disabled = v === 'static';
      if (v === 'static' && dnsMode === 'dhcp') setDns('static');
      else if (v === 'dhcp' && !keepDns && !F.dns1.value.trim() && !F.dns2.value.trim()) setDns('dhcp');
      else sync();
    }
    function setDns(v){ dnsMode = v; rDnsAuto.input.checked = v === 'dhcp'; rDnsSt.input.checked = v === 'static'; sync(); }
    function sync(){
      ['ip', 'mask', 'gw'].forEach(k => F[k].disabled = ipMode === 'dhcp');
      ['dns1', 'dns2'].forEach(k => F[k].disabled = dnsMode === 'dhcp');
      rDnsAuto.input.disabled = ipMode === 'static';
      check();
    }
    function check(){
      const L = []; // [level, field, text]
      const E = (f, t) => L.push(['e', f, t]), W = (f, t) => L.push(['w', f, t]), I = (f, t) => L.push(['i', f, t]);
      Object.values(F).forEach(x => x.classList.remove('nlw-invalid'));
      calcBox.replaceChildren();
      let ip = null, p = -1, net = 0, bc = 0, m = 0;
      if (ipMode === 'static'){
        const ipT = F.ip.value.trim(), mT = F.mask.value.trim(), gT = F.gw.value.trim();
        if (!ipT) E('ip', 'ยังไม่ได้กรอก IP address');
        else if ((ip = parseIP(ipT)) === null) E('ip', 'IP address "' + ipT + '" ไม่ถูกต้อง ต้องเป็นตัวเลข 4 ชุดคั่นด้วยจุด แต่ละชุด 0–255');
        if (!mT) E('mask', 'ยังไม่ได้กรอก Subnet mask (เมื่อคลิกช่องนี้ Windows จะเติมค่าเริ่มต้นตามคลาสให้)');
        else if (/^\/?\d{1,2}$/.test(mT)) E('mask', 'ช่อง Subnet mask ใน Windows ต้องกรอกเป็นเลขฐานสิบ 4 ชุด เช่น /24 ให้กรอก 255.255.255.0');
        else { const mk = parseIP(mT); if (mk === null) E('mask', 'Subnet mask "' + mT + '" ไม่ถูกต้อง ต้องเป็นตัวเลข 4 ชุด 0–255');
          else if ((p = prefixFromMask(mk)) < 0) E('mask', 'Subnet mask ' + mT + ' ไม่ถูกต้อง บิต 1 ต้องเรียงติดกันจากซ้าย ค่าที่ใช้ได้ในแต่ละชุดคือ 0, 128, 192, 224, 240, 248, 252, 254, 255 และชุดหลังต้องไม่มากกว่าชุดหน้า');
          else if (p === 0) { E('mask', 'Subnet mask 0.0.0.0 ใช้กับการ์ดเครือข่ายไม่ได้'); p = -1; }
          else if (p >= 31) { E('mask', 'Subnet mask /' + p + ' เหลือที่อยู่ไม่พอสำหรับเครื่องใน LAN ที่มี Gateway (เครื่องทั่วไปใช้ไม่เกิน /30 ในห้องแล็บมักใช้ 255.255.255.0)'); p = -1; } }
        if (ip !== null){
          const a = ip >>> 24;
          if (a === 127) { E('ip', ipT + ' เป็นที่อยู่ Loopback (127.0.0.0/8) ใช้ภายในเครื่องเท่านั้น ตั้งให้การ์ดเครือข่ายไม่ได้'); }
          else if (a === 0) { E('ip', 'ที่อยู่ที่ขึ้นต้นด้วย 0 (0.0.0.0/8) ตั้งให้เครื่องไม่ได้'); }
          else if (a >= 224 && a <= 239) { E('ip', ipT + ' เป็น Multicast (Class D 224–239) ใช้ส่งถึงกลุ่ม ตั้งให้เครื่องไม่ได้'); }
          else if (a >= 240) { E('ip', ipT + ' อยู่ในช่วงสงวน Class E (240–255) ตั้งให้เครื่องไม่ได้'); }
          else if (a === 169 && ((ip >>> 16) & 255) === 254) W('ip', '169.254.x.x คือ APIPA ที่ Windows ตั้งให้ตัวเองเมื่อขอ IP จาก DHCP ไม่สำเร็จ คุยได้เฉพาะเครื่อง APIPA ด้วยกันและออกอินเทอร์เน็ตไม่ได้ ถ้าเห็นค่านี้ในคำสั่ง ipconfig ให้ตรวจสาย/Wi-Fi และ DHCP Server แล้วสั่ง ipconfig /renew ไม่ควรพิมพ์ตั้งเอง');
        }
        if (ip !== null && p > 0 && p <= 30){
          m = maskOf(p); net = (ip & m) >>> 0; bc = (net | (~m >>> 0)) >>> 0;
          if (ip === net) E('ip', ipT + ' เป็น Network address ของวง ' + ipStr(net) + '/' + p + ' (บิตส่วนโฮสต์เป็น 0 ทั้งหมด) ตั้งให้เครื่องไม่ได้ ใช้ได้ตั้งแต่ ' + ipStr(net + 1));
          else if (ip === bc) E('ip', ipT + ' เป็น Broadcast address ของวง ' + ipStr(net) + '/' + p + ' (บิตส่วนโฮสต์เป็น 1 ทั้งหมด) ตั้งให้เครื่องไม่ได้ ใช้ได้ถึง ' + ipStr(bc - 1));
          const a = ip >>> 24, b = (ip >>> 16) & 255;
          const priv = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
          if (!priv && !(a === 169 && b === 254) && a < 224 && a !== 127 && a !== 0) I('ip', ipT + ' เป็น Public IP ในห้องแล็บหรือ LAN ทั่วไปควรใช้ Private IP (10.x.x.x, 172.16–31.x.x, 192.168.x.x) เว้นแต่ ISP กำหนดให้');
        }
        // gateway
        if (!gT) { if (ip !== null) W('gw', 'ไม่ได้กำหนด Default gateway เครื่องจะคุยได้เฉพาะเครื่องในวงเดียวกัน ออกนอกวงหรืออินเทอร์เน็ตไม่ได้'); }
        else {
          const gw = parseIP(gT);
          if (gw === null) E('gw', 'Default gateway "' + gT + '" ไม่ถูกต้อง');
          else if (ip !== null && gw === ip) E('gw', 'Default gateway เป็น IP เดียวกับเครื่องตัวเอง เครื่องจะส่งแพ็กเก็ตที่ออกนอกวงกลับมาหาตัวเอง Gateway ต้องเป็น IP ของเราเตอร์ เช่น ' + (p > 0 && p <= 30 ? ipStr(net + 1) : '192.168.20.1'));
          else if (ip !== null && p > 0 && p <= 30){
            if (((gw & m) >>> 0) !== net) E('gw', 'Default gateway ' + gT + ' ไม่อยู่ในวงเดียวกับเครื่อง: เครื่องอยู่วง ' + ipStr(net) + '/' + p + ' แต่ Gateway อยู่วง ' + ipStr((gw & m) >>> 0) + '/' + p + ' เครื่องจะส่งไปหา Gateway ไม่ได้ (Windows จะเตือนเมื่อกด OK)');
            else if (gw === net || gw === bc) E('gw', 'Default gateway ' + gT + ' เป็น ' + (gw === net ? 'Network' : 'Broadcast') + ' address ของวง ใช้เป็น Gateway ไม่ได้');
          }
        }
      }
      // DNS
      if (dnsMode === 'static'){
        const d1T = F.dns1.value.trim(), d2T = F.dns2.value.trim();
        const d1 = d1T ? parseIP(d1T) : null, d2 = d2T ? parseIP(d2T) : null;
        if (!d1T && !d2T) W('dns1', 'ไม่ได้กำหนด DNS server เครื่องจะ ping ด้วย IP ได้ แต่ใช้ชื่อ เช่น เปิดเว็บด้วยชื่อโดเมน ไม่ได้ เพราะแปลงชื่อเป็น IP ไม่ได้');
        else if (!d1T) W('dns1', 'กรอก Alternate DNS แต่เว้น Preferred DNS ไว้ ควรใส่ตัวหลักที่ Preferred ก่อน');
        if (d1T && d1 === null) E('dns1', 'Preferred DNS "' + d1T + '" ไม่ถูกต้อง');
        if (d2T && d2 === null) E('dns2', 'Alternate DNS "' + d2T + '" ไม่ถูกต้อง');
        [[d1, 'dns1', 'Preferred DNS', d1T], [d2, 'dns2', 'Alternate DNS', d2T]].forEach(x => {
          const [d, k, name, t] = x; if (d === null) return;
          const a = d >>> 24;
          if (a === 127) W(k, name + ' ' + t + ' เป็น Loopback ใช้ได้เฉพาะเมื่อเครื่องนี้เป็น DNS server เอง');
          else if (a === 0 || a >= 224) E(k, name + ' ' + t + ' ไม่ใช่ที่อยู่ของเครื่อง DNS server ที่ใช้ได้');
          else if (ipMode === 'static' && ip !== null && p > 0 && p <= 30 && (d === net || d === bc)) E(k, name + ' ' + t + ' เป็น ' + (d === net ? 'Network' : 'Broadcast') + ' address ของวง ไม่ใช่เครื่อง DNS server');
          else if (ipMode === 'static' && ip !== null && d === ip) W(k, name + ' เป็น IP ของเครื่องตัวเอง ถูกต้องเฉพาะเมื่อเครื่องนี้ติดตั้งบริการ DNS server ไว้ ถ้าเป็นเครื่องลูกข่ายทั่วไปให้ใส่ IP ของ DNS server จริง');
        });
        if (d1 !== null && d2 !== null && d1 === d2) W('dns2', 'Preferred และ Alternate DNS เป็นค่าเดียวกัน ไม่มีตัวสำรองเมื่อ DNS ตัวแรกล่ม ควรใส่ DNS server อีกตัวหรือเว้นว่าง');
        if (ipMode === 'static'){ const gw = parseIP(F.gw.value); if (gw !== null && d1 !== null && gw === d1 && gw !== ip) I('dns1', 'Preferred DNS เป็น IP เดียวกับ Gateway ใช้ได้ถ้าเราเตอร์ทำหน้าที่ส่งต่อ DNS (DNS relay/proxy) ซึ่งเราเตอร์บ้านส่วนใหญ่ทำได้'); }
      }
      // render
      L.forEach(x => F[x[1]] && (x[0] === 'e') && F[x[1]].classList.add('nlw-invalid'));
      const ne = L.filter(x => x[0] === 'e').length, nw = L.filter(x => x[0] === 'w').length;
      const NAME = {ip:'IP address', mask:'Subnet mask', gw:'Default gateway', dns1:'Preferred DNS', dns2:'Alternate DNS'};
      const LV = {e:'ผิด', w:'ควรแก้', i:'ข้อสังเกต'};
      issues.replaceChildren(...L.map(x => h('li', {class:'nlw2-' + x[0], 'data-lv': x[0], 'data-f': x[1]}, h('b', {class: x[0] === 'e' ? 'nlw-bad' : x[0] === 'w' ? 'nlw-warn' : null}, LV[x[0]] + ' · ' + NAME[x[1]] + ':'), x[2])));
      res.setAttribute('data-errors', String(ne)); res.setAttribute('data-warnings', String(nw));
      if (ipMode === 'dhcp'){
        res.className = 'nlw-result ' + (ne ? 'nlw-is-bad' : nw ? 'nlw-is-warn' : 'nlw-is-ok');
        res.textContent = 'โหมดรับ IP อัตโนมัติ (DHCP)' + (dnsMode === 'static' ? ' แต่กำหนด DNS เอง' : '') + (ne ? ' — พบข้อผิดพลาด ' + ne + ' จุด' : nw ? ' — มีข้อควรแก้ ' + nw + ' จุด' : ' — ค่าที่ต้องใช้จะได้จาก DHCP Server');
        calcBox.append(h('div', {class:'nlw-box', 'data-k':'dhcp'},
          h('p', null, h('b', null, 'DHCP Server (ในห้องแล็บมักเป็นเราเตอร์หรือเซิร์ฟเวอร์) แจกค่าเหล่านี้ให้:')),
          h('ul', {class:'nlw-list'},
            h('li', null, 'IP address และ Subnet mask ที่ว่างอยู่ในช่วงที่กำหนด (Scope/Pool) จึงไม่ซ้ำกับเครื่องอื่น'),
            h('li', null, 'Default gateway (DHCP option 3 Router)'),
            h('li', null, 'DNS server (option 6)' + (dnsMode === 'static' ? ' แต่เครื่องนี้เลือกใช้ DNS ที่กรอกเองแทน' : '')),
            h('li', null, 'ระยะเวลาเช่า (Lease time) เมื่อใกล้หมดเครื่องจะต่ออายุเอง')),
          h('p', null, 'ขั้นตอนขอ IP มี 4 ข้อความ เรียกว่า DORA: Discover → Offer → Request → Acknowledge (พอร์ต UDP 67/68)'),
          h('p', null, 'ถ้าขอไม่สำเร็จ Windows จะตั้ง APIPA 169.254.x.x / 255.255.0.0 ให้ตัวเองโดยไม่มี Gateway ตรวจด้วย ipconfig /all และขอใหม่ด้วย ipconfig /release แล้ว ipconfig /renew')));
        return;
      }
      res.className = 'nlw-result ' + (ne ? 'nlw-is-bad' : nw ? 'nlw-is-warn' : 'nlw-is-ok');
      res.textContent = ne ? 'พบข้อผิดพลาด ' + ne + ' จุด' + (nw ? ' และข้อควรแก้ ' + nw + ' จุด' : '') + ' ต้องแก้ก่อนใช้งาน'
        : nw ? 'ใช้งานได้บางส่วน มีข้อควรแก้ ' + nw + ' จุด' : 'การตั้งค่าถูกต้อง ใช้งานในวงนี้ได้';
      if (ip !== null && p > 0 && p <= 30){
        calcBox.append(h('div', {class:'nlw-scroll'}, h('table', {class:'nlw-table'}, h('tbody', null,
          h('tr', null, h('th', {scope:'row'}, 'วงเครือข่าย (Network)'), h('td', {class:'nlw-mono', 'data-k':'net'}, ipStr(net) + '/' + p)),
          h('tr', null, h('th', {scope:'row'}, 'Broadcast'), h('td', {class:'nlw-mono', 'data-k':'bc'}, ipStr(bc))),
          h('tr', null, h('th', {scope:'row'}, 'IP ที่ตั้งให้เครื่องได้'), h('td', {class:'nlw-mono', 'data-k':'range'}, ipStr(net + 1) + ' – ' + ipStr(bc - 1))),
          h('tr', null, h('th', {scope:'row'}, 'จำนวนโฮสต์'), h('td', null, fmt(Math.pow(2, 32 - p) - 2)))))));
        calcBox.append(h('p', {class:'nlw-small'}, 'ตัวจำลองนี้ตรวจรูปแบบค่าได้ แต่ไม่รู้ว่ามีเครื่องอื่นใช้ IP นี้อยู่หรือไม่ ถ้า IP ซ้ำ Windows จะแจ้ง IP address conflict และ ipconfig /all จะแสดง (Duplicate) ควรเลือก IP นอกช่วงที่ DHCP แจก'));
      }
    }
    sync();
  }

  /* ===================================================================
     5. share-ntfs
     =================================================================== */
  // rights: R read, X execute/traverse, W write/create, D delete, P change permissions/take ownership
  const RIGHTS = ['R', 'X', 'W', 'D', 'P'];
  const RNAME = {R:'อ่าน/เปิดไฟล์', X:'รันโปรแกรม', W:'สร้างและแก้ไขไฟล์', D:'ลบ', P:'เปลี่ยนสิทธิ์/ยึดความเป็นเจ้าของ'};
  const SHARE_LV = [['', '—'], ['R', 'Read'], ['C', 'Change'], ['F', 'Full Control']];
  const SHARE_B = {R:'RX', C:'RXWD', F:'RXWDP'};
  const NTFS_LV = [['', '—'], ['R', 'Read'], ['RX', 'Read & execute'], ['W', 'Write'], ['M', 'Modify'], ['F', 'Full control']];
  const NTFS_B = {R:'R', RX:'RX', W:'W', M:'RXWD', F:'RXWDP'};
  const lvLabel = (list, v) => (list.find(x => x[0] === v) || ['', '—'])[1];
  function bitsName(b, ctx){
    const s = RIGHTS.filter(k => b.has(k)).join('');
    if (!b.size) return 'ไม่มีสิทธิ์ (เข้าไม่ได้)';
    if (s === 'RXWDP') return ctx === 'ntfs' ? 'Full control' : 'Full Control';
    if (s === 'RXWD') return ctx === 'share' ? 'Change' : ctx === 'ntfs' ? 'Modify' : 'Change / Modify';
    if (b.has('R') && b.has('W')) return 'Read + Write' + (b.has('D') ? '' : ' (ลบไม่ได้)');
    if (b.has('R') && b.has('D')) return 'Read + ลบ (สร้าง/แก้ไขไฟล์ไม่ได้)';
    if (s === 'RX') return ctx === 'ntfs' ? 'Read & execute' : 'Read';
    if (s === 'R') return 'Read';
    if (b.has('W') && !b.has('R')) return 'Write อย่างเดียว (เขียนได้แต่เปิดอ่านไม่ได้)';
    return 'สิทธิ์บางส่วน';
  }
  const capText = b => b.size ? RIGHTS.filter(k => b.has(k)).map(k => RNAME[k]).join(', ') : 'ทำอะไรไม่ได้';
  function shareNtfs(root){
    frame(root, 'คำนวณสิทธิ์จริง: Share + NTFS', 'ติ๊กกลุ่มที่ผู้ใช้เป็นสมาชิก แล้วตั้งสิทธิ์ Allow/Deny ของแต่ละกลุ่มทั้งชั้น Share (แท็บ Sharing) และชั้น NTFS (แท็บ Security) ระบบจะคำนวณสิทธิ์ที่มีผลจริงเมื่อเข้าผ่านเครือข่ายและเมื่อนั่งที่เครื่อง พร้อมแสดงขั้นตอนคิด');
    const GROUPS = [['Everyone', 'Everyone (ทุกคน)'], ['Students', 'Students'], ['Teachers', 'Teachers']];
    const blank = () => ({sa:'', sd:'', na:'', nd:''});
    let st;
    const PRESETS = {
      book: {name:'Share Read + NTFS Modify', member:{Students:true, Teachers:false}, g:{Everyone:{sa:'R', sd:'', na:'', nd:''}, Students:{sa:'', sd:'', na:'M', nd:''}, Teachers:blank()}},
      forgot: {name:'ลืมให้สิทธิ์ Write', member:{Students:true, Teachers:false}, g:{Everyone:blank(), Students:{sa:'C', sd:'', na:'RX', nd:''}, Teachers:{sa:'F', sd:'', na:'F', nd:''}}},
      deny: {name:'Deny ชนะ Allow', member:{Students:true, Teachers:true}, g:{Everyone:{sa:'C', sd:'', na:'', nd:''}, Students:{sa:'', sd:'', na:'', nd:'W'}, Teachers:{sa:'', sd:'', na:'M', nd:''}}},
      teacher: {name:'ครูเป็นสมาชิก 2 กลุ่ม', member:{Students:true, Teachers:true}, g:{Everyone:{sa:'F', sd:'', na:'', nd:''}, Students:{sa:'', sd:'', na:'R', nd:''}, Teachers:{sa:'', sd:'', na:'M', nd:''}}}
    };
    const presetSeg = seg(Object.keys(PRESETS).map(k => [k, PRESETS[k].name]), 'book', v => load(v), 'สถานการณ์ตัวอย่าง');
    const cards = h('div', {class:'nlw2-cards'});
    const res = h('div', {class:'nlw-result', 'aria-live':'polite', 'data-k':'result'});
    const steps = h('ol', {class:'nlw2-steps', 'data-k':'steps'});
    root.append(h('div', {class:'nlw-small'}, 'สถานการณ์ตัวอย่าง:'), presetSeg.el, h('div', {class:'nlw2-sub'}, 'ผู้ใช้ somchai และสิทธิ์ของแต่ละกลุ่มบนโฟลเดอร์ D:\\Homework'), cards, res,
      h('div', {class:'nlw2-sub'}, 'ขั้นตอนการคิด'), steps,
      h('p', {class:'nlw-small'}, 'แบบจำลองนี้ใช้สิทธิ์ระดับพื้นฐาน (Basic permissions) ที่ตั้งตรงบนโฟลเดอร์ ไม่รวมสิทธิ์ที่สืบทอด (inherited) และสิทธิ์แบบละเอียด (Advanced) ใน Windows จริง Deny ที่ตั้งตรงชนะ Allow เสมอ'));
    function load(k){
      const P = PRESETS[k];
      st = {member:{Everyone:true, Students:!!P.member.Students, Teachers:!!P.member.Teachers}, g:{}};
      GROUPS.forEach(g => st.g[g[0]] = Object.assign(blank(), P.g[g[0]] || {}));
      renderCards(); calc();
    }
    function renderCards(){
      cards.replaceChildren();
      GROUPS.forEach(([gk, gname]) => {
        const s = st.g[gk];
        const sel = (list, key, label) => field(label, select(list, s[key], e => { s[key] = e.target.value; presetSeg.set(''); calc(); }, {'data-g': gk, 'data-p': key}));
        const cb = h('input', {type:'checkbox', checked: st.member[gk], disabled: gk === 'Everyone', 'data-member': gk, onchange: e => { st.member[gk] = e.target.checked; presetSeg.set(''); calc(); }});
        const card = h('div', {class:'nlw2-card' + (st.member[gk] ? '' : ' nlw2-off'), 'data-card': gk},
          h('label', {class:'nlw-check', style:'font-weight:700'}, cb, h('span', null, 'somchai เป็นสมาชิก ' + gname)),
          gk === 'Everyone' ? h('p', {class:'nlw-small'}, 'ทุกบัญชีอยู่ในกลุ่ม Everyone เสมอ เอาออกไม่ได้') : null,
          h('div', {class:'nlw2-g2'}, sel(SHARE_LV, 'sa', 'Share: Allow'), sel(SHARE_LV, 'sd', 'Share: Deny'), sel(NTFS_LV, 'na', 'NTFS: Allow'), sel(NTFS_LV, 'nd', 'NTFS: Deny')));
        cards.append(card);
      });
    }
    function layer(kind){
      const map = kind === 'share' ? SHARE_B : NTFS_B, list = kind === 'share' ? SHARE_LV : NTFS_LV;
      const ak = kind === 'share' ? 'sa' : 'na', dk = kind === 'share' ? 'sd' : 'nd';
      const allow = new Set(), deny = new Set(), aTxt = [], dTxt = [];
      GROUPS.forEach(([gk]) => {
        if (!st.member[gk]) return;
        const s = st.g[gk];
        if (s[ak]) { map[s[ak]].split('').forEach(r => allow.add(r)); aTxt.push(gk + ' = ' + lvLabel(list, s[ak])); }
        if (s[dk]) { map[s[dk]].split('').forEach(r => deny.add(r)); dTxt.push(gk + ' = ' + lvLabel(list, s[dk])); }
      });
      const eff = new Set([...allow].filter(r => !deny.has(r)));
      return {allow, deny, eff, aTxt, dTxt};
    }
    function limiter(a, b){
      const sub = (x, y) => [...x].every(r => y.has(r));
      if (!a.size && !b.size) return 'ทั้งสองชั้นไม่ให้สิทธิ์';
      if (!a.size) return 'ชั้น Share ไม่ให้สิทธิ์เลย จึงเข้าผ่านเครือข่ายไม่ได้';
      if (!b.size) return 'ชั้น NTFS ไม่ให้สิทธิ์เลย จึงเข้าไม่ได้';
      if (sub(a, b) && sub(b, a)) return 'สองชั้นให้สิทธิ์เท่ากัน';
      if (sub(a, b)) return 'ชั้น Share เป็นตัวจำกัด';
      if (sub(b, a)) return 'ชั้น NTFS เป็นตัวจำกัด';
      return 'แต่ละชั้นจำกัดคนละส่วน';
    }
    function calc(){
      cards.querySelectorAll('[data-card]').forEach(c => c.classList.toggle('nlw2-off', !st.member[c.getAttribute('data-card')]));
      const S = layer('share'), N = layer('ntfs');
      const net = new Set([...S.eff].filter(r => N.eff.has(r)));
      const sN = bitsName(S.eff, 'share'), nN = bitsName(N.eff, 'ntfs'), netN = bitsName(net, 'net');
      res.className = 'nlw-result ' + (net.size ? 'nlw-is-ok' : 'nlw-is-bad');
      res.replaceChildren(
        h('div', null, 'เข้าผ่านเครือข่าย (\\\\SERVER\\Homework): ', h('span', {'data-k':'net'}, netN)),
        h('div', null, 'นั่งใช้ที่เครื่องนั้นเอง (Local): ', h('span', {'data-k':'local'}, nN)));
      const members = GROUPS.filter(g => st.member[g[0]]).map(g => g[0]);
      const ignored = GROUPS.filter(g => !st.member[g[0]]).map(g => g[0]);
      const layerStep = (name, L, nm) => h('li', null, h('b', null, 'สิทธิ์ชั้น ' + name + ': '),
        'Allow ที่ได้จากทุกกลุ่มรวมกัน (สะสม) ' + (L.aTxt.length ? L.aTxt.join(', ') : 'ไม่มี') + ' → ' + capText(L.allow) + '. ',
        L.dTxt.length ? h('span', {class:'nlw-bad'}, 'มี Deny: ' + L.dTxt.join(', ') + ' ตัดสิทธิ์ ' + capText(L.deny) + ' ออก (Deny ชนะ Allow). ') : 'ไม่มี Deny. ',
        'ผลชั้น ' + name + ' = ', h('b', {'data-k': name.toLowerCase()}, nm), L.eff.size ? ' (' + capText(L.eff) + ')' : '');
      steps.replaceChildren(
        h('li', null, h('b', null, 'กลุ่มที่สังกัด: '), members.join(', ') + (ignored.length ? ' (ไม่นับสิทธิ์ของ ' + ignored.join(', ') + ' เพราะไม่ได้เป็นสมาชิก)' : '')),
        layerStep('Share', S, sN), layerStep('NTFS', N, nN),
        h('li', null, h('b', null, 'เข้าผ่านเครือข่าย: '), 'ต้องผ่านทั้งสองชั้น จึงได้เฉพาะสิทธิ์ที่มีในทั้ง Share และ NTFS (เลือกที่เข้มงวดกว่า) = ', h('b', null, netN),
          net.size ? ' (' + capText(net) + ')' : '', ' ' + limiter(S.eff, N.eff)),
        h('li', null, h('b', null, 'นั่งที่เครื่อง (Local): '), 'ไม่ผ่าน Share จึงใช้ NTFS อย่างเดียว = ', h('b', null, nN)));
    }
    load('book');
  }

  /* ===================================================================
     6. vm-netmode
     =================================================================== */
  const VM_TARGETS = [['host', 'เครื่อง Host (PC ที่รัน VirtualBox)'], ['lan', 'เครื่องอื่นใน LAN ห้องแล็บ'], ['inet', 'อินเทอร์เน็ต'], ['vm', 'VM อื่นที่ตั้งโหมดเดียวกัน']];
  const VM_MODES = {
    nat: {name:'NAT', ip:'10.0.2.15/24 · Gateway 10.0.2.2 · DNS 10.0.2.3 (ได้จาก DHCP ในตัว VirtualBox ทุก VM ที่ใช้ NAT ได้ IP นี้เหมือนกัน)',
      t:{
        host:{in:[false, 'Host เปิดการเชื่อมต่อเข้า VM โดยตรงไม่ได้ เพราะ VM ซ่อนอยู่หลังเราเตอร์ NAT ของ VirtualBox'], out:[true, 'VM ติดต่อบริการบน Host ได้ผ่าน 10.0.2.2 (ชี้ไปที่ตัว Host) หรือ IP จริงของ Host']},
        lan:{in:[false, 'เครื่องอื่นมองไม่เห็น 10.0.2.15 เพราะเป็นวงส่วนตัวภายใน VirtualBox'], out:[true, 'VirtualBox แปลงที่อยู่ให้ แพ็กเก็ตออกไปด้วย IP ของ Host เครื่องปลายทางจึงเห็นเหมือน Host เป็นผู้เชื่อมต่อ']},
        inet:{in:[false, 'คนบนอินเทอร์เน็ตเข้ามาหา VM ไม่ได้ (ผ่าน NAT สองชั้น คือ VirtualBox และเราเตอร์ของแล็บ)'], out:[true, 'ออกอินเทอร์เน็ตได้ทันทีถ้า Host ออกได้ จึงเป็นค่าเริ่มต้นที่เหมาะกับการอัปเดตระบบ']},
        vm:{in:[false, 'VM แต่ละตัวที่ใช้ NAT มีเราเตอร์ NAT แยกเป็นของตัวเอง จึงคุยกันไม่ได้ ถ้าต้องการให้คุยกันและออกเน็ตได้ ใช้โหมด NAT Network'], out:[false, 'เหตุผลเดียวกัน แต่ละ VM อยู่คนละวงเสมือนแม้ IP จะเป็น 10.0.2.15 เหมือนกัน']}
      }},
    bridged: {name:'Bridged Adapter', ip:'IP วงเดียวกับเครื่องจริงในแล็บ ได้จาก DHCP ของแล็บ เช่น 192.168.20.1xx/24 · Gateway 192.168.20.1 (VM มี MAC Address ของตัวเอง)',
      t:{
        host:{in:[true, 'VM เป็นเหมือนอีกเครื่องหนึ่งที่เสียบสายเข้าสวิตช์เดียวกับ Host'], out:[true, 'อยู่วงเดียวกัน ติดต่อกันได้ตรง (ถ้าไฟร์วอลล์ของแต่ละฝั่งอนุญาต)']},
        lan:{in:[true, 'เครื่องอื่นในแล็บเห็น VM เป็นเครื่องหนึ่งในวง จึงเหมาะกับการทำเซิร์ฟเวอร์ให้เพื่อนใช้'], out:[true, 'ใช้วงและ Gateway เดียวกับเครื่องจริง']},
        inet:{in:[false, 'VM ได้ Private IP ของแล็บ คนภายนอกเข้าถึงไม่ได้ เว้นแต่เราเตอร์ของแล็บตั้ง Port Forwarding ให้ (เหมือนเครื่องจริงทุกเครื่อง)'], out:[true, 'ออกผ่านเราเตอร์ (Default gateway) ของแล็บ']},
        vm:{in:[true, 'VM ที่ Bridged เข้าการ์ดเดียวกันอยู่ใน LAN เดียวกันทั้งหมด'], out:[true, 'คุยกันได้เหมือนเครื่องจริงสองเครื่องในวงเดียวกัน']}
      }},
    hostonly: {name:'Host-only Adapter', ip:'192.168.56.101 ขึ้นไป (DHCP ของ Host-only network ค่าเริ่มต้นวง 192.168.56.0/24 ฝั่ง Host คือ 192.168.56.1) · ไม่มี Gateway ออกนอก',
      t:{
        host:{in:[true, 'Host มีการ์ดเสมือน VirtualBox Host-Only Ethernet Adapter (192.168.56.1) อยู่วงเดียวกับ VM'], out:[true, 'VM ติดต่อ Host ที่ 192.168.56.1 ได้']},
        lan:{in:[false, 'วง 192.168.56.0/24 มีอยู่เฉพาะในเครื่อง Host ไม่ได้ต่อกับการ์ดแลนจริง'], out:[false, 'ไม่มีทางออกไปยังเครือข่ายจริงของแล็บ']},
        inet:{in:[false, 'ไม่มีเส้นทางจากภายนอกเข้ามา'], out:[false, 'ไม่มี Gateway ออกนอก ถ้าต้องการเน็ตให้เพิ่มการ์ดใบที่ 2 เป็น NAT']},
        vm:{in:[true, 'VM ที่ใช้ Host-only network ตัวเดียวกันอยู่วง 192.168.56.0/24 ด้วยกัน'], out:[true, 'คุยกันได้ เหมาะกับแล็บทดลองเซิร์ฟเวอร์กับไคลเอนต์ที่แยกจากเครือข่ายจริง']}
      }},
    internal: {name:'Internal Network', ip:'ไม่มี DHCP ให้ตามค่าเริ่มต้น ต้องตั้ง Static IP เอง เช่น 10.10.10.1/24 และ 10.10.10.2/24 (ถ้าไม่ตั้ง Windows จะได้ APIPA 169.254.x.x) หรือให้ VM ตัวหนึ่งเป็น DHCP Server',
      t:{
        host:{in:[false, 'Host ไม่มีการ์ดในเครือข่ายนี้เลย จึงมองไม่เห็น VM'], out:[false, 'VM ไม่มีเส้นทางไปหา Host']},
        lan:{in:[false, 'เครือข่ายนี้แยกขาดจากการ์ดแลนจริง'], out:[false, 'ออกไปเครือข่ายจริงไม่ได้']},
        inet:{in:[false, 'ไม่มีทางเข้าจากภายนอก'], out:[false, 'ไม่มีทางออกอินเทอร์เน็ต เว้นแต่มี VM ตัวหนึ่งทำหน้าที่เราเตอร์ที่มีการ์ด NAT อีกใบ']},
        vm:{in:[true, 'คุยกันได้เฉพาะ VM ที่ตั้งชื่อ Internal network ตรงกัน (ค่าเริ่มต้น intnet) บน Host เครื่องเดียวกัน'], out:[true, 'ใช้จำลองเครือข่ายปิด เช่น ทดสอบ DHCP Server หรือ Domain Controller โดยไม่รบกวนแล็บ']}
      }}
  };
  function vmNetmode(root){
    frame(root, 'โหมดเครือข่ายของเครื่องจำลอง (VirtualBox)', 'เลือกโหมดการ์ดเครือข่ายของ VM ดูว่าใครเชื่อมต่อเข้า VM ได้ VM เชื่อมต่อออกไปหาใครได้ และ VM จะได้ IP แบบใด สำหรับโหมด NAT ลองติ๊ก Port Forwarding ด้วย');
    let mode = 'nat', pf = false;
    const modeSeg = seg(Object.keys(VM_MODES).map(k => [k, VM_MODES[k].name]), mode, v => { mode = v; render(); }, 'โหมดเครือข่าย');
    const pfCb = h('input', {type:'checkbox', 'data-in':'pf', onchange: e => { pf = e.target.checked; render(); }});
    const pfRow = h('label', {class:'nlw-check'}, pfCb, h('span', null, 'ตั้ง Port Forwarding (เช่น Host port 2222 → Guest port 22 สำหรับ SSH)'));
    const ipBox = h('div', {class:'nlw-result', 'aria-live':'polite', 'data-k':'ip'});
    const cards = h('div', {class:'nlw2-cards', 'data-k':'cards'});
    root.append(modeSeg.el, pfRow, ipBox, cards,
      h('p', {class:'nlw-small'}, 'อ้างอิงค่าเริ่มต้นของ Oracle VirtualBox (เช่น วง NAT 10.0.2.0/24 และ Host-only 192.168.56.0/24) โปรแกรมอื่นอย่าง VMware ใช้ชื่อและวง IP ต่างออกไป และไฟร์วอลล์ของแต่ละเครื่องยังอาจบล็อกการเชื่อมต่อได้แม้โหมดเครือข่ายอนุญาต'));
    function render(){
      const M = VM_MODES[mode];
      pfRow.hidden = mode !== 'nat';
      ipBox.className = 'nlw-result';
      ipBox.replaceChildren(h('div', null, 'โหมด ' + M.name + ' · IP ที่ VM ได้: '), h('span', {class:'nlw-mono', style:'font-weight:600'}, M.ip));
      cards.replaceChildren(...VM_TARGETS.map(([k, name]) => {
        const T = M.t[k];
        let inn = T.in;
        if (mode === 'nat' && pf && (k === 'host' || k === 'lan'))
          inn = [true, k === 'host' ? 'ได้เฉพาะพอร์ตที่ forward: Host เชื่อมต่อ 127.0.0.1:2222 แล้ว VirtualBox ส่งต่อไป VM พอร์ต 22' : 'ได้เฉพาะพอร์ตที่ forward: เครื่องอื่นเชื่อมต่อ IP ของ Host พอร์ต 2222 (ไฟร์วอลล์ของ Host ต้องอนุญาต) แล้วถูกส่งต่อไป VM พอร์ต 22', 'pf'];
        const c = (v, label) => chip(label + ': ' + (v[0] ? (v[2] === 'pf' ? 'ได้ (บางพอร์ต)' : 'ได้') : 'ไม่ได้'), v[0] ? (v[2] === 'pf' ? 'warn' : 'ok') : 'bad');
        return h('div', {class:'nlw2-card', 'data-target': k},
          h('h4', null, name),
          h('div', {class:'nlw2-chips'}, h('span', {'data-k': k + '-in'}, c(inn, k === 'vm' ? 'VM อื่น → VM นี้' : 'เข้าหา VM')), h('span', {'data-k': k + '-out'}, c(T.out, k === 'vm' ? 'VM นี้ → VM อื่น' : 'VM ไปหา'))),
          h('p', null, h('b', null, 'เข้า: '), inn[1]), h('p', null, h('b', null, 'ออก: '), T.out[1]));
      }));
    }
    render();
  }

  /* ===================================================================
     7. threat-sorter
     =================================================================== */
  const THREATS = [
    ['Virus', 'ไวรัส', 'ต้องแฝงในไฟล์โฮสต์ (โปรแกรมหรือเอกสารมาโคร) และทำงานเมื่อผู้ใช้เปิดไฟล์ แพร่โดยการส่งต่อไฟล์'],
    ['Worm', 'เวิร์ม', 'แพร่ตัวเองผ่านเครือข่ายโดยอัตโนมัติผ่านช่องโหว่ ไม่ต้องแฝงในไฟล์และไม่ต้องรอผู้ใช้เปิด'],
    ['Trojan', 'โทรจัน', 'ปลอมเป็นโปรแกรมที่มีประโยชน์ให้ผู้ใช้ติดตั้งเอง แล้วแอบทำงานอันตรายเบื้องหลัง ไม่แพร่พันธุ์ตัวเอง'],
    ['Ransomware', 'แรนซัมแวร์', 'เข้ารหัสไฟล์ให้เปิดไม่ได้ แล้วเรียกค่าไถ่แลกกับกุญแจถอดรหัส'],
    ['Spyware', 'สปายแวร์', 'แอบเก็บข้อมูลหรือพฤติกรรมการใช้งาน (รวมถึง Keylogger) ส่งให้ผู้อื่นโดยเจ้าของไม่รู้ตัว'],
    ['Phishing', 'ฟิชชิง', 'ข้อความหลอกที่ปลอมเป็นหน่วยงานน่าเชื่อถือ ให้กดลิงก์ไปเว็บปลอมแล้วกรอกข้อมูลลับ'],
    ['Rootkit', 'รูทคิต', 'ฝังลึกในระบบปฏิบัติการหรือส่วนบูต เพื่อซ่อนตัวเองและมัลแวร์อื่นจากผู้ใช้และโปรแกรมป้องกันไวรัส'],
    ['Backdoor', 'แบ็กดอร์', 'ช่องทางลับให้ผู้บุกรุกกลับเข้าระบบได้โดยไม่ผ่านการยืนยันตัวตนตามปกติ'],
    ['Sniffing', 'การดักฟังข้อมูล', 'ดักจับแพ็กเก็ตที่วิ่งผ่านเครือข่ายเพื่ออ่านเนื้อหา ได้ผลกับข้อมูลที่ไม่เข้ารหัส'],
    ['DoS', 'การโจมตีให้ปฏิเสธบริการ', 'ส่งคำขอหรือข้อมูลปริมาณมหาศาลจนระบบรับไม่ไหว ผู้ใช้จริงใช้บริการไม่ได้ (ทำลาย Availability)']
  ];
  const SCENARIOS = [
    ['s1', 'Virus', 'ไฟล์ Word ที่เพื่อนส่งต่อมาทางแฟลชไดรฟ์มีมาโครแฝงอยู่ เมื่อเปิดไฟล์ มาโครคัดลอกตัวเองไปติดไฟล์เอกสารอื่นในแฟลชไดรฟ์ทุกไฟล์'],
    ['s2', 'Worm', 'เครื่องในห้องแล็บที่ไม่ได้อัปเดต Windows ติดมัลแวร์ทีละเครื่องจนเกือบทั้งห้องภายในไม่กี่นาที ทั้งที่ไม่มีใครเปิดไฟล์หรือกดลิงก์ใด และเครือข่ายช้าลงมาก'],
    ['s3', 'Trojan', 'นักเรียนดาวน์โหลด "โปรแกรมแต่งรูปฟรี เวอร์ชันเต็ม" จากเว็บแจกโปรแกรมเถื่อนมาติดตั้งเอง โปรแกรมใช้งานได้จริง แต่เบื้องหลังแอบเปิดให้คนภายนอกสั่งงานเครื่องได้'],
    ['s4', 'Ransomware', 'เช้าวันจันทร์ ไฟล์บัญชีทั้งหมดของร้านเปลี่ยนนามสกุลและเปิดไม่ได้ บนหน้าจอมีข้อความให้โอนเงินคริปโทภายใน 72 ชั่วโมงเพื่อแลกกับกุญแจถอดรหัส'],
    ['s5', 'Spyware', 'ส่วนขยายเบราว์เซอร์ที่ติดตั้งมาพร้อมโปรแกรมฟรี แอบบันทึกเว็บที่เข้าและทุกตัวอักษรที่พิมพ์ แล้วส่งไปยังเซิร์ฟเวอร์ของผู้อื่น ขณะที่เครื่องยังใช้งานได้ปกติ'],
    ['s6', 'Phishing', 'ได้รับ SMS อ้างว่าเป็นธนาคาร แจ้งว่าบัญชีจะถูกระงับใน 24 ชั่วโมง ให้กดลิงก์ไปยืนยันตัวตน เว็บที่เปิดขึ้นหน้าตาเหมือนธนาคารจริงและขอรหัส OTP'],
    ['s7', 'Rootkit', 'Task Manager และโปรแกรมป้องกันไวรัสไม่พบสิ่งผิดปกติ แต่เครื่องยังส่งข้อมูลออกไปตลอด ช่างต้องบูตเครื่องจากแฟลชไดรฟ์กู้ระบบจึงสแกนเจอไฟล์ที่ฝังอยู่ในส่วนลึกของระบบ'],
    ['s8', 'Backdoor', 'ตรวจพบโปรแกรมเล็ก ๆ บนเซิร์ฟเวอร์ที่เปิดพอร์ตลับรอรับคำสั่ง ทำให้ผู้บุกรุกที่เคยเจาะเข้ามากลับเข้าควบคุมเครื่องได้ทุกเมื่อโดยไม่ต้องใส่ชื่อผู้ใช้และรหัสผ่าน'],
    ['s9', 'Sniffing', 'ในร้านกาแฟที่ Wi-Fi ไม่ตั้งรหัส มีคนเปิดโปรแกรมจับแพ็กเก็ต แล้วอ่านชื่อผู้ใช้และรหัสผ่านที่ลูกค้าอีกโต๊ะส่งผ่านเว็บแบบ HTTP ได้'],
    ['s10', 'DoS', 'ช่วงเปิดลงทะเบียนเรียน เว็บของวิทยาลัยเข้าไม่ได้เลย เพราะมีคำขอปลอมจำนวนมหาศาลถูกส่งเข้ามาพร้อมกันจนเซิร์ฟเวอร์รับไม่ไหว']
  ];
  function threatSorter(root){
    frame(root, 'จัดประเภทภัยคุกคาม', 'อ่านสถานการณ์แล้วแตะประเภทภัยคุกคามที่ตรงที่สุด ระบบบอกผลทันทีพร้อมจุดสังเกตสำคัญ ตอบครบ 10 ข้อแล้วดูคะแนน กดเริ่มใหม่เพื่อสุ่มลำดับข้อใหม่');
    let order = [], idx = 0, score = 0, answered = false, log = [];
    const prog = h('div', {class:'nlw-small', 'data-k':'progress'});
    const bar = h('i', {style:'width:0'});
    const scn = h('div', {class:'nlw2-scn', 'data-k':'scenario', tabindex:'-1'});
    const opts = h('div', {class:'nlw2-opts', role:'group', 'aria-label':'ประเภทภัยคุกคาม'});
    const fb = h('div', {'aria-live':'polite', 'data-k':'feedback'});
    const nextBtn = h('button', {type:'button', class:'nlw-btn nlw-primary', 'data-act':'next', onclick: next}, 'ข้อต่อไป');
    const resetBtn = h('button', {type:'button', class:'nlw-btn', 'data-act':'reset', onclick: reset}, 'เริ่มใหม่ (สุ่มลำดับ)');
    const scoreEl = h('div', {class:'nlw-small', 'data-k':'score'});
    root.append(prog, h('div', {class:'nlw2-progress', 'aria-hidden':'true'}, bar), scn, opts, fb, h('div', {class:'nlw-row nlw-center'}, nextBtn, resetBtn, scoreEl));
    const btns = THREATS.map(t => h('button', {type:'button', class:'nlw-btn', 'data-ans': t[0], onclick: () => pick(t[0])}, t[0], h('span', {class:'nlw-small', style:'display:block;font-size:12.5px;color:inherit;opacity:.85'}, t[1])));
    opts.append(...btns);
    function shuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function reset(){ order = shuffle(SCENARIOS.slice()); idx = 0; score = 0; log = []; show(); }
    function show(){
      answered = false;
      fb.replaceChildren(); nextBtn.hidden = true;
      btns.forEach(b => { b.disabled = false; b.classList.remove('nlw2-right', 'nlw2-wrong'); b.removeAttribute('aria-pressed'); });
      bar.style.width = (idx / order.length * 100) + '%';
      scoreEl.textContent = 'คะแนน ' + score + ' / ' + idx;
      if (idx >= order.length){
        prog.textContent = 'ทำครบ ' + order.length + ' ข้อแล้ว';
        scn.setAttribute('data-sid', 'done');
        scn.replaceChildren(h('b', null, 'ได้คะแนน ' + score + ' จาก ' + order.length), h('div', {class:'nlw-small'}, score === order.length ? 'ถูกทุกข้อ แยกจุดเด่นของภัยแต่ละชนิดได้ดีมาก' : score >= 7 ? 'ดีมาก ทบทวนข้อที่ตอบผิดด้านล่าง' : 'ลองทบทวนจุดสังเกตของแต่ละประเภท แล้วกดเริ่มใหม่'));
        opts.hidden = true;
        const wrong = log.filter(x => !x.ok);
        fb.replaceChildren(h('div', {class:'nlw-result ' + (score === order.length ? 'nlw-is-ok' : 'nlw-is-warn'), 'data-k':'final'}, 'คะแนนรวม ' + score + ' / ' + order.length),
          wrong.length ? h('ul', {class:'nlw-list nlw-small'}, wrong.map(x => h('li', null, 'ข้อที่ตอบ ' + x.pick + ' แต่คำตอบคือ ' + x.ans + ': ' + THREATS.find(t => t[0] === x.ans)[2]))) : null);
        resetBtn.focus({preventScroll:true});
        return;
      }
      opts.hidden = false;
      const S = order[idx];
      prog.textContent = 'ข้อ ' + (idx + 1) + ' จาก ' + order.length;
      scn.setAttribute('data-sid', S[0]);
      scn.textContent = S[2];
    }
    function pick(a){
      if (answered) return;
      answered = true;
      const S = order[idx], ok = a === S[1];
      if (ok) score++;
      log.push({ok, pick:a, ans:S[1]});
      btns.forEach(b => { const v = b.getAttribute('data-ans'); b.disabled = true; if (v === S[1]) b.classList.add('nlw2-right'); if (v === a && !ok) b.classList.add('nlw2-wrong'); if (v === a) b.setAttribute('aria-pressed', 'true'); });
      const T = THREATS.find(t => t[0] === S[1]), P = THREATS.find(t => t[0] === a);
      fb.replaceChildren(h('div', {class:'nlw-result ' + (ok ? 'nlw-is-ok' : 'nlw-is-bad'), 'data-ok': String(ok)},
        ok ? 'ถูกต้อง: ' + T[0] + ' (' + T[1] + ')' : 'ยังไม่ถูก คำตอบคือ ' + T[0] + ' (' + T[1] + ')'),
        h('p', null, h('b', null, 'จุดสังเกตของ ' + T[0] + ': '), T[2]),
        ok ? null : h('p', {class:'nlw-small'}, h('b', null, 'ส่วน ' + P[0] + ' ที่เลือก: '), P[2]));
      scoreEl.textContent = 'คะแนน ' + score + ' / ' + (idx + 1);
      nextBtn.hidden = false;
      nextBtn.textContent = idx + 1 >= order.length ? 'ดูผลคะแนน' : 'ข้อต่อไป';
      nextBtn.focus({preventScroll:true});
    }
    function next(){ if (!answered) return; idx++; show(); if (idx < order.length) scn.focus({preventScroll:true}); }
    reset();
  }

  /* ===================================================================
     8. backup-321
     =================================================================== */
  const BK_MEDIA = [['samedisk', 'อีกโฟลเดอร์/พาร์ทิชันบนดิสก์เดียวกัน'], ['usb', 'ฮาร์ดดิสก์ภายนอก (USB)'], ['nas', 'NAS / เซิร์ฟเวอร์ไฟล์'], ['cloud', 'คลาวด์']];
  const BK_SCEN = [
    ['disk', 'ฮาร์ดดิสก์ในเครื่องเสีย'],
    ['ransom', 'โดนแรนซัมแวร์เข้ารหัสไฟล์'],
    ['fire', 'ไฟไหม้อาคาร'],
    ['delete', 'ลบไฟล์ผิดโดยไม่ตั้งใจ (รู้ตัวในวันถัดมา)']
  ];
  function backup321(root){
    frame(root, 'วางแผนสำรองข้อมูลตามหลัก 3-2-1', 'เลือกจำนวนชุดสำรอง แล้วกำหนดสื่อ ที่เก็บ รูปแบบ และการเชื่อมต่อของแต่ละชุด ระบบจะตรวจหลัก 3-2-1 และบอกว่าเหตุการณ์ใดทำให้ข้อมูลหาย เพราะอะไร (ข้อมูลต้นฉบับอยู่บนดิสก์ในเครื่องหน้าร้าน)');
    let copies = [];
    const mk = (medium, where, kind, link) => ({medium, where, kind, link});
    const PRESETS = {
      none: {name:'ไม่มีสำรอง', c:[]},
      usb: {name:'USB เสียบไว้ตลอด', c:[mk('usb', 'onsite', 'backup', 'online')]},
      sync: {name:'ซิงก์คลาวด์อย่างเดียว', c:[mk('cloud', 'offsite', 'sync', 'online')]},
      good: {name:'ตามหลัก 3-2-1', c:[mk('nas', 'onsite', 'backup', 'offline'), mk('cloud', 'offsite', 'backup', 'online')]}
    };
    const presetSeg = seg(Object.keys(PRESETS).map(k => [k, PRESETS[k].name]), 'usb', v => load(v), 'แผนตัวอย่าง');
    const countSeg = seg([['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']], '1', v => setCount(Number(v)), 'จำนวนชุดสำรอง');
    const cards = h('div', {class:'nlw2-cards'});
    const rule = h('div', {class:'nlw-box', 'data-k':'rule'});
    const res = h('div', {class:'nlw-result', 'aria-live':'polite', 'data-k':'result'});
    const scen = h('div', {class:'nlw2-cards', 'data-k':'scen'});
    root.append(h('div', {class:'nlw-small'}, 'แผนตัวอย่าง:'), presetSeg.el,
      h('div', {class:'nlw-row nlw-center'}, h('span', {style:'font-weight:600'}, 'จำนวนชุดสำรอง (ไม่นับต้นฉบับ):'), countSeg.el),
      cards, rule, res, scen,
      h('p', {class:'nlw-small'}, 'หลัก 3-2-1: มีข้อมูลอย่างน้อย 3 ชุด (ต้นฉบับ + สำรอง 2), เก็บบนสื่ออย่างน้อย 2 ชนิด, และอย่างน้อย 1 ชุดอยู่นอกสถานที่ ปัจจุบันนิยมเพิ่มว่าควรมี 1 ชุดที่ออฟไลน์หรือแก้ไขไม่ได้ และต้องทดสอบกู้คืนเป็นระยะ'));
    function load(k){ copies = PRESETS[k].c.map(c => Object.assign({}, c)); countSeg.set(String(copies.length)); renderCards(); calc(); }
    function setCount(n){
      while (copies.length < n) copies.push(mk('usb', 'onsite', 'backup', 'offline'));
      copies.length = n; presetSeg.set(''); renderCards(); calc();
    }
    function norm(c){
      if (c.medium === 'samedisk'){ c.where = 'onsite'; c.link = 'online'; }
      if (c.medium === 'cloud'){ c.where = 'offsite'; c.link = 'online'; }
      if (c.medium === 'usb' && c.where === 'offsite') c.link = 'offline';
    }
    function renderCards(){
      cards.replaceChildren();
      copies.forEach((c, i) => {
        norm(c);
        const ch = (key, opts, label, dis) => field(label, select(opts, c[key], e => { c[key] = e.target.value; presetSeg.set(''); renderCards(); calc(); }, {'data-c': i, 'data-p': key, disabled: !!dis}));
        cards.append(h('div', {class:'nlw2-card', 'data-copy': i},
          h('h4', null, 'ชุดสำรองที่ ' + (i + 1)),
          h('div', {class:'nlw2-g2 nlw2-wide'},
            ch('medium', BK_MEDIA, 'สื่อที่เก็บ'),
            ch('where', [['onsite', 'ในอาคารเดียวกัน'], ['offsite', 'นอกสถานที่']], 'ที่เก็บ', c.medium === 'samedisk' || c.medium === 'cloud'),
            ch('kind', [['backup', 'สำรองแบบเก็บเวอร์ชัน'], ['sync', 'ซิงก์/มิเรอร์ทันที']], 'รูปแบบ'),
            c.medium === 'cloud' ? h('div', {class:'nlw-field'}, h('span', null, 'การเชื่อมต่อ'), h('span', {class:'nlw-small', style:'font-weight:400'}, 'ออนไลน์ผ่านบัญชีคลาวด์'))
              : ch('link', [['online', 'เครื่องเขียนได้ตลอด'], ['offline', 'ถอดเก็บ/แยกสิทธิ์']], 'การเชื่อมต่อ', c.medium === 'samedisk' || (c.medium === 'usb' && c.where === 'offsite')))));
      });
      if (!copies.length) cards.append(h('p', {class:'nlw-small'}, 'มีเพียงข้อมูลต้นฉบับบนดิสก์ในเครื่อง ไม่มีชุดสำรอง'));
    }
    const MNAME = k => (BK_MEDIA.find(m => m[0] === k) || ['', k])[1];
    function survive(c, s){
      switch (s){
        case 'disk': return c.medium === 'samedisk' ? [false, 'อยู่บนดิสก์ลูกเดียวกับต้นฉบับ เสียพร้อมกัน'] : [true, 'อยู่บนสื่ออีกชิ้นหนึ่ง ไม่เสียไปด้วย'];
        case 'delete': return c.kind === 'sync' ? [false, 'การซิงก์ลบไฟล์ในชุดสำรองตามไปทันที'] : [true, 'เก็บเวอร์ชันก่อนลบไว้ กู้คืนได้'];
        case 'ransom':
          if (c.medium === 'samedisk') return [false, 'อยู่ในเครื่องที่ติดแรนซัมแวร์ ถูกเข้ารหัสไปด้วย'];
          if (c.medium === 'cloud') return c.kind === 'sync' ? [false, 'ไฟล์ที่ถูกเข้ารหัสถูกซิงก์ขึ้นไปทับของเดิม'] : [true, 'มีเวอร์ชันย้อนหลังที่เครื่องที่ติดเชื้อเขียนทับไม่ได้ (ถ้าบัญชีคลาวด์ไม่ถูกขโมยไปด้วย)'];
          return c.link === 'online' ? [false, 'เครื่องเข้าถึงและเขียนได้ตลอด แรนซัมแวร์จึงไล่เข้ารหัสไดรฟ์นี้ด้วย'] : [true, 'ถอดเก็บหรือเครื่องหลักไม่มีสิทธิ์เขียน แรนซัมแวร์เข้าไม่ถึง'];
        case 'fire': return c.where === 'offsite' ? [true, 'เก็บไว้นอกสถานที่'] : [false, 'อยู่ในอาคารเดียวกัน เสียหายไปพร้อมกัน'];
      }
    }
    function calc(){
      const total = 1 + copies.length;
      const media = new Set(['internal']); copies.forEach(c => media.add(c.medium === 'samedisk' ? 'internal' : c.medium));
      const off = copies.filter(c => c.where === 'offsite').length;
      const offline = copies.filter(c => (c.medium === 'cloud' && c.kind === 'backup') || (c.medium !== 'cloud' && c.medium !== 'samedisk' && c.link === 'offline')).length;
      const r3 = total >= 3, r2 = media.size >= 2, r1 = off >= 1;
      const line = (ok, k, t) => h('p', {'data-rule': k, 'data-ok': String(ok)}, h('span', {class: ok ? 'nlw2-pass' : 'nlw2-fail'}, ok ? 'ผ่าน' : 'ไม่ผ่าน'), ' · ', t);
      rule.replaceChildren(h('b', null, 'ตรวจหลัก 3-2-1'),
        line(r3, '3', '3 ชุด: มี ' + total + ' ชุด (ต้นฉบับ 1 + สำรอง ' + copies.length + ')' + (r3 ? '' : ' ต้องมีสำรองอย่างน้อย 2 ชุด')),
        line(r2, '2', '2 สื่อ: ใช้สื่อ ' + media.size + ' ชนิด' + (r2 ? '' : ' (ชุดสำรองบนดิสก์เดียวกันนับเป็นสื่อเดิม)')),
        line(r1, '1', '1 นอกสถานที่: มี ' + off + ' ชุด' + (r1 ? '' : ' ควรเก็บที่บ้านเจ้าของร้าน สาขาอื่น หรือคลาวด์')),
        h('p', {class:'nlw-small'}, 'ชุดที่ออฟไลน์หรือแก้ไขไม่ได้: ' + offline + ' ชุด' + (offline ? '' : ' (ไม่มี เสี่ยงต่อแรนซัมแวร์)')));
      let lost = 0;
      scen.replaceChildren(...BK_SCEN.map(([sk, sname]) => {
        const rs = copies.map(c => survive(c, sk));
        const okIdx = rs.findIndex(x => x[0]);
        if (okIdx < 0) lost++;
        return h('div', {class:'nlw2-card', 'data-scen': sk, 'data-lost': String(okIdx < 0)},
          h('h4', null, sname),
          h('div', {class:'nlw2-chips'}, okIdx < 0 ? chip('ข้อมูลหาย', 'bad') : chip('กู้คืนได้จากชุดที่ ' + (okIdx + 1), 'ok')),
          h('p', {class:'nlw-small'}, 'ต้นฉบับ: เสียหาย'),
          rs.map((x, i) => h('p', {class:'nlw-small'}, 'ชุดที่ ' + (i + 1) + ' (' + MNAME(copies[i].medium) + '): ', h('span', {class: x[0] ? 'nlw-ok' : 'nlw-bad'}, x[0] ? 'รอด' : 'เสีย'), ' เพราะ' + x[1])),
          copies.length ? null : h('p', {class:'nlw-small nlw-bad'}, 'ไม่มีชุดสำรองให้กู้คืน'));
      }));
      res.className = 'nlw-result ' + (lost ? 'nlw-is-bad' : (r3 && r2 && r1) ? 'nlw-is-ok' : 'nlw-is-warn');
      res.setAttribute('data-lost', String(lost));
      res.textContent = lost ? 'แผนนี้ทำให้ข้อมูลหายใน ' + lost + ' จาก ' + BK_SCEN.length + ' เหตุการณ์' + (r3 && r2 && r1 ? ' แม้ผ่าน 3-2-1 แล้ว ควรมีชุดที่ออฟไลน์หรือเก็บเวอร์ชัน' : '')
        : 'แผนนี้กู้ข้อมูลได้ทุกเหตุการณ์' + (r3 && r2 && r1 ? ' และผ่านหลัก 3-2-1' : ' แต่ยังไม่ครบหลัก 3-2-1');
    }
    load('usb');
  }

  window.NL_WIDGETS = Object.assign(window.NL_WIDGETS || {}, {
    'ipv6-tool': ipv6Tool,
    'subnet-splitter': subnetSplitter,
    'route-lookup': routeLookup,
    'nic-config': nicConfig,
    'share-ntfs': shareNtfs,
    'vm-netmode': vmNetmode,
    'threat-sorter': threatSorter,
    'backup-321': backup321
  });
})();
