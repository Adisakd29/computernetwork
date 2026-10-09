'use strict';
(function(){
  /* ===================================================================
     NetLab interactive widgets. Usage: NL_WIDGETS[name](rootDiv)
     No globals ids, no storage, no network. All classes prefixed .nlw-
     =================================================================== */
  const CSS = `
.nlw{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0;font-family:inherit;font-size:16px;line-height:1.55;max-width:100%;min-width:0;overflow-wrap:break-word}
.nlw *,.nlw *::before,.nlw *::after{box-sizing:border-box}
.nlw-title{font-weight:700;font-size:18px;margin:0 0 2px;line-height:1.35}
.nlw-instr{margin:0 0 12px;color:var(--muted);font-size:14.5px}
.nlw-instr b{color:var(--ink);font-weight:600}
.nlw-row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin:8px 0}
.nlw-row.nlw-center{align-items:center}
.nlw-btn{font:inherit;font-size:15px;line-height:1.3;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 12px;cursor:pointer;min-height:36px}
.nlw-btn:hover{border-color:var(--blue)}
.nlw-btn[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:var(--panel);font-weight:600}
.nlw-btn.nlw-primary{background:var(--ink);color:var(--panel);border-color:var(--ink);font-weight:600}
.nlw-btn.nlw-sm{min-height:30px;padding:3px 9px;font-size:14px}
.nlw-btn:disabled{opacity:.45;cursor:default}
.nlw-seg{display:flex;flex-wrap:wrap;gap:6px}
.nlw button:focus-visible,.nlw [tabindex]:focus-visible,.nlw input:focus-visible,.nlw select:focus-visible,.nlw textarea:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nlw input[type=text],.nlw input[type=number],.nlw input[type=search],.nlw select,.nlw textarea{font:inherit;font-size:15px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 10px;min-width:0;max-width:100%;min-height:36px}
.nlw textarea{width:100%;resize:vertical}
.nlw input[type=range]{width:100%;accent-color:var(--blue)}
.nlw input[type=checkbox]{width:18px;height:18px;accent-color:var(--blue);margin:0;flex:none}
.nlw input.nlw-invalid{border-color:var(--bad);outline:1px solid var(--bad)}
.nlw-field{display:flex;flex-direction:column;gap:3px;font-size:14px;color:var(--muted);min-width:0}
.nlw-field>span{font-weight:600}
.nlw-check{display:flex;gap:8px;align-items:center;font-size:15px;cursor:pointer;min-height:32px}
.nlw-mono,.nlw code{font-family:"JetBrains Mono",Consolas,monospace}
.nlw code{font-size:.92em;background:var(--field);border:1px solid var(--line);border-radius:4px;padding:0 4px}
.nlw-box{background:var(--field);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:10px 0;font-size:15px}
.nlw-box p{margin:.25em 0}
.nlw-ok{color:var(--ok)}.nlw-bad{color:var(--bad)}.nlw-warn{color:var(--orange)}
.nlw-result{font-weight:600;border-left:5px solid var(--blue);padding:8px 12px;background:var(--field);border-radius:0 8px 8px 0;margin:10px 0}
.nlw-result.nlw-is-ok{border-left-color:var(--ok)}.nlw-result.nlw-is-bad{border-left-color:var(--bad)}.nlw-result.nlw-is-warn{border-left-color:var(--orange)}
.nlw-svg{display:block;width:100%;height:auto;max-width:560px;margin:6px auto}
.nlw-scroll{overflow-x:auto;max-width:100%}
.nlw-table{border-collapse:collapse;width:100%;font-size:14.5px}
.nlw-table th,.nlw-table td{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}
.nlw-table th{color:var(--muted);font-weight:600;background:var(--field)}
.nlw-pre{font-family:"JetBrains Mono",Consolas,monospace;font-size:12.5px;line-height:1.5;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:10px;white-space:pre-wrap;word-break:break-word;margin:8px 0;max-height:320px;overflow:auto}
.nlw-chip{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:14px;background:var(--field)}
.nlw-chip.nlw-is-ok{border-color:var(--ok);color:var(--ok)}.nlw-chip.nlw-is-warn{border-color:var(--orange);color:var(--ink)}.nlw-chip.nlw-is-bad{border-color:var(--bad);color:var(--bad)}
.nlw-small{font-size:13.5px;color:var(--muted)}
.nlw-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
.nlw-list{margin:6px 0;padding-left:20px}
.nlw-list li{margin:3px 0}
.nlw-pre:empty{display:none}
/* topology */
.nlw-topo-link{cursor:pointer}
.nlw-topo-link:focus{outline:none}
.nlw-topo-link:focus-visible .nlw-topo-hit{stroke:var(--blue);stroke-opacity:.25}
.nlw-topo-link:hover .nlw-topo-hit{stroke:var(--blue);stroke-opacity:.15}
/* osi */
.nlw-osi{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:4px 6px}
.nlw-osi-bar{display:flex;gap:8px;align-items:center;text-align:left;width:100%;border-left-width:6px}
.nlw-osi-bar[aria-pressed="true"] .nlw-small{color:inherit}
.nlw-osi-bar .nlw-n{font-family:"JetBrains Mono",Consolas,monospace;font-weight:600}
.nlw-osi-tcp{display:flex;align-items:center;justify-content:center;text-align:center;border:1px dashed var(--line);border-radius:8px;font-size:13.5px;color:var(--muted);padding:4px}
.nlw-osi-tcp.nlw-on{border-style:solid;border-color:var(--blue);color:var(--blue);font-weight:600;background:var(--field)}
/* encapsulation */
.nlw-pdu{display:flex;flex-wrap:wrap;gap:0;margin:8px 0;border-radius:8px;overflow:hidden;border:1px solid var(--line)}
.nlw-seg-box{padding:6px 8px;font-size:13px;min-width:70px;flex:1 1 auto;border-right:1px solid var(--line);background:var(--field)}
.nlw-seg-box:last-child{border-right:0}
.nlw-seg-box b{display:block;font-size:13.5px}
.nlw-seg-box .nlw-mono{font-size:12px;word-break:break-all}
.nlw-k-eth{border-top:5px solid var(--brown)}.nlw-k-ip{border-top:5px solid var(--blue)}.nlw-k-tcp{border-top:5px solid var(--green)}.nlw-k-data{border-top:5px solid var(--orange)}.nlw-k-fcs{border-top:5px solid var(--brown)}
.nlw-k-new{box-shadow:inset 0 0 0 2px var(--blue)}
.nlw-dots{display:flex;gap:4px;flex-wrap:wrap}
.nlw-dot{width:12px;height:12px;border-radius:50%;background:var(--line)}
.nlw-dot.nlw-on{background:var(--blue)}
.nlw-layers{display:flex;flex-wrap:wrap;gap:4px}
.nlw-layers span{font-size:13px;border:1px solid var(--line);border-radius:6px;padding:1px 7px;color:var(--muted)}
.nlw-layers span.nlw-on{border-color:var(--blue);color:var(--blue);font-weight:700}
/* ip calc */
.nlw-bin{font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;letter-spacing:.02em;word-break:break-all}
.nlw-netbit{color:var(--blue);font-weight:700}
.nlw-hostbit{color:var(--orange)}
/* meter */
.nlw-meter{height:14px;background:var(--line);border-radius:7px;overflow:hidden}
.nlw-meter i{display:block;height:100%;border-radius:7px;transition:width .3s}
.nlw-score{font-size:30px;font-weight:700;line-height:1.1}
/* ping */
.nlw-steps{display:grid;gap:6px;margin:8px 0}
.nlw-step{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;justify-content:space-between;text-align:left;width:100%}
.nlw-step .nlw-mono{font-size:14px}
.nlw-st{font-size:13.5px;font-weight:700}
/* firewall */
.nlw-rule{display:flex;flex-wrap:wrap;gap:6px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:6px 8px;margin:6px 0;background:var(--panel)}
.nlw-rule.nlw-hit{border:2px solid var(--blue);background:var(--field)}
.nlw-rule.nlw-badrule{border-color:var(--bad)}
.nlw-rule .nlw-num{font-family:"JetBrains Mono",Consolas,monospace;font-weight:700;min-width:22px}
.nlw-rule input[type=text]{width:120px}
.nlw-rule input.nlw-port{width:84px}
/* caesar */
.nlw-alpha{background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 8px;margin:8px 0}
.nlw-amap{display:flex;flex-wrap:wrap;gap:3px;font-family:"JetBrains Mono",Consolas,monospace;font-size:13px;margin-top:4px}
.nlw-amap span{display:flex;flex-direction:column;align-items:center;min-width:20px;border:1px solid var(--line);border-radius:4px;background:var(--panel);line-height:1.35}
.nlw-amap i{font-style:normal;color:var(--ink)}
.nlw-amap b{color:var(--blue);border-top:1px solid var(--line);width:100%;text-align:center}
/* perm */
.nlw-perm td,.nlw-perm th{text-align:center}
.nlw-perm td:first-child,.nlw-perm th:first-child{text-align:left}
.nlw-perm label{display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:36px;cursor:pointer}
.nlw-big{font-family:"JetBrains Mono",Consolas,monospace;font-size:17px;font-weight:600}
/* port */
.nlw-tag{display:inline-block;font-size:12px;font-weight:700;border:1px solid currentColor;border-radius:4px;padding:0 5px;margin-left:4px;white-space:nowrap}
`;
  function injectCSS(){
    if (document.getElementById('nl-widget-css')) return;
    const st = document.createElement('style');
    st.id = 'nl-widget-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------- tiny DOM helpers ---------- */
  const PROPS = { value:1, checked:1, disabled:1, selected:1, min:0, max:0 };
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
  const SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs){
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs){
      const v = attrs[k];
      if (v == null) continue;
      if (k === 'text') e.textContent = v;
      else if (k.slice(0,2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function frame(root, title, instr){
    injectCSS();
    root.replaceChildren();
    root.classList.add('nlw');
    root.appendChild(h('div', {class:'nlw-title'}, title));
    root.appendChild(h('p', {class:'nlw-instr'}, h('b', null, 'คำแนะนำการใช้งาน: '), instr));
    return root;
  }
  // segmented button group (aria-pressed)
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
  function field(label, control, extraClass){
    return h('label', {class:'nlw-field' + (extraClass ? ' ' + extraClass : '')}, h('span', null, label), control);
  }
  function groupField(label, group){
    return h('div', {class:'nlw-field'}, h('span', null, label), group);
  }
  function check(label, checked, onchange){
    const inp = h('input', {type:'checkbox', checked: !!checked, onchange});
    return { el: h('label', {class:'nlw-check'}, inp, h('span', null, label)), input: inp };
  }
  function select(options, value, onchange){
    const sel = h('select', {onchange});
    options.forEach(o => sel.appendChild(h('option', {value: o[0], selected: o[0] === value}, o[1])));
    return sel;
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
    if (((inv & (inv + 1)) >>> 0) !== 0) return -1; // not contiguous
    let bits = 0; for (let i = 0; i < 32; i++) if ((m >>> i) & 1) bits++;
    return bits;
  }
  function parsePrefix(str){
    let t = String(str).trim();
    if (t.charAt(0) === '/') t = t.slice(1).trim();
    if (/^\d{1,2}$/.test(t)) { const p = Number(t); return p <= 32 ? p : -1; }
    const m = parseIP(t);
    if (m === null) return -1;
    return prefixFromMask(m);
  }
  // CIDR / ANY matching: spec "ANY" | "a.b.c.d" | "a.b.c.d/p"
  function parseIPSpec(spec){
    const t = String(spec).trim();
    if (t === '' || /^(any|\*)$/i.test(t)) return { any:true };
    const parts = t.split('/');
    if (parts.length > 2) return null;
    const ip = parseIP(parts[0]);
    if (ip === null) return null;
    let p = 32;
    if (parts.length === 2){ if (!/^\d{1,2}$/.test(parts[1].trim())) return null; p = Number(parts[1]); if (p > 32) return null; }
    const m = maskOf(p);
    return { any:false, net: (ip & m) >>> 0, mask: m, p };
  }
  const ipMatch = (spec, ip) => spec.any || (((ip & spec.mask) >>> 0) === spec.net);

  /* ===================================================================
     1. topology-sim
     =================================================================== */
  function topologySim(root){
    frame(root, 'จำลองโทโพโลยีเครือข่าย (Topology)', 'เลือกรูปแบบ Bus / Ring / Star / Mesh แล้วคลิกที่เส้นสาย (หรือกด Tab ไปที่สายแล้วกด Enter) เพื่อตัดหรือต่อสาย ดูว่าเครื่องใดยังติดต่อกันได้');
    const PCS = ['PC1','PC2','PC3','PC4','PC5'];
    let type = 'star', cut = new Set(), swDown = false, dual = false, realCoax = false;

    const typeSeg = seg([['bus','Bus'],['ring','Ring'],['star','Star'],['mesh','Mesh']], type, v => { type = v; cut.clear(); swDown = false; render(); }, 'เลือกโทโพโลยี');
    const opts = h('div', {class:'nlw-row nlw-center'});
    const svg = s('svg', {class:'nlw-svg', viewBox:'0 0 400 250', role:'img', 'aria-label':'แผนภาพโทโพโลยี'});
    const summary = h('div', {class:'nlw-result', 'aria-live':'polite'});
    const pcList = h('div', {class:'nlw-row nlw-center'});
    const note = h('div', {class:'nlw-box'});
    root.append(typeSeg.el, opts, svg, summary, pcList, note,
      h('div', {class:'nlw-row'}, h('button', {type:'button', class:'nlw-btn', onclick: () => { cut.clear(); swDown = false; render(); }}, 'ต่อสายทั้งหมดกลับ')));

    function ring5(cx, cy, r){ return PCS.map((_, i) => { const a = (-90 + 72 * i) * Math.PI / 180; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }); }
    function build(){
      const nodes = {}, links = [];
      if (type === 'bus'){
        PCS.forEach((p, i) => { const x = 50 + 75 * i; nodes[p] = {x, y:60, kind:'pc'}; nodes['T' + (i+1)] = {x, y:175, kind:'tap'}; });
        PCS.forEach((p, i) => links.push({id:'d' + (i+1), a:p, b:'T' + (i+1), label:'สายต่อเข้า ' + p}));
        for (let i = 1; i < 5; i++) links.push({id:'b' + i, a:'T' + i, b:'T' + (i+1), label:'สายหลักช่วง ' + i + ' (ระหว่าง ' + PCS[i-1] + ' กับ ' + PCS[i] + ')', backbone:true});
      } else if (type === 'ring'){
        const pos = ring5(200, 128, 100);
        PCS.forEach((p, i) => nodes[p] = {x:pos[i].x, y:pos[i].y, kind:'pc'});
        PCS.forEach((p, i) => links.push({id:'r' + (i+1), a:p, b:PCS[(i+1) % 5], label:'สาย ' + p + '–' + PCS[(i+1) % 5]}));
      } else if (type === 'star'){
        const pos = ring5(200, 130, 102);
        nodes.SW = {x:200, y:130, kind:'sw'};
        PCS.forEach((p, i) => { nodes[p] = {x:pos[i].x, y:pos[i].y, kind:'pc'}; links.push({id:'s' + (i+1), a:p, b:'SW', label:'สายของ ' + p}); });
      } else {
        const pos = ring5(200, 128, 102);
        PCS.forEach((p, i) => nodes[p] = {x:pos[i].x, y:pos[i].y, kind:'pc'});
        for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) links.push({id:'m' + (i+1) + (j+1), a:PCS[i], b:PCS[j], label:'สาย ' + PCS[i] + '–' + PCS[j]});
      }
      return {nodes, links};
    }
    // graph search -> comm(i,j) true if i and j can exchange data (both directions)
    function analyse(g){
      const adj = {};
      Object.keys(g.nodes).forEach(n => adj[n] = []);
      const down = n => (n === 'SW' && swDown);
      const directed = (type === 'ring' && !dual);
      const backboneCut = g.links.some(l => l.backbone && cut.has(l.id));
      const busDead = type === 'bus' && realCoax && backboneCut;
      if (!busDead) g.links.forEach(l => {
        if (cut.has(l.id) || down(l.a) || down(l.b)) return;
        adj[l.a].push(l.b);
        if (!directed) adj[l.b].push(l.a);
      });
      function reach(src){ const seen = new Set([src]), q = [src]; while (q.length){ const n = q.shift(); adj[n].forEach(m => { if (!seen.has(m)) { seen.add(m); q.push(m); } }); } return seen; }
      const R = {}; PCS.forEach(p => R[p] = reach(p));
      const comm = (a, b) => R[a].has(b) && R[b].has(a);
      const groups = [];
      PCS.forEach(p => { const g2 = groups.find(gr => comm(gr[0], p)); if (g2) g2.push(p); else groups.push([p]); });
      return {comm, groups, backboneCut, busDead};
    }
    function render(){
      // options per type
      opts.replaceChildren();
      if (type === 'bus'){
        const c = check('จำลองแบบสายโคแอกซ์จริง (สายหลักขาด = ไม่มีตัวปิดปลาย ทั้งบัสล่ม)', realCoax, e => { realCoax = e.target.checked; render(); });
        opts.append(c.el);
      } else if (type === 'ring'){
        const c = check('วงแหวนคู่ (Dual ring เช่น FDDI) ส่งได้สองทิศทาง', dual, e => { dual = e.target.checked; render(); });
        opts.append(c.el);
      } else if (type === 'star'){
        opts.append(h('button', {type:'button', class:'nlw-btn', 'aria-pressed': String(swDown), 'data-act':'swfail', onclick: () => { swDown = !swDown; render(); }}, swDown ? 'สวิตช์เสีย (กดเพื่อซ่อม)' : 'จำลองสวิตช์เสีย'));
      }
      const g = build(), A = analyse(g);
      // svg
      svg.replaceChildren();
      if (type === 'bus'){
        svg.append(s('line', {x1:22, y1:175, x2:50, y2:175, stroke:'var(--ink)', 'stroke-width':4}), s('line', {x1:350, y1:175, x2:378, y2:175, stroke:'var(--ink)', 'stroke-width':4}));
        [16, 378].forEach(x => svg.append(s('rect', {x, y:165, width:6, height:20, fill:'var(--brown)'})));
        svg.append(s('text', {x:200, y:222, 'text-anchor':'middle', 'font-size':12, fill:'var(--muted)', text:'สายหลัก (Backbone) — ปลายทั้งสองมีตัวปิดปลาย (Terminator)'}));
      }
      g.links.forEach(l => {
        const a = g.nodes[l.a], b = g.nodes[l.b], isCut = cut.has(l.id);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const grp = s('g', {class:'nlw-topo-link', tabindex:0, role:'button', 'data-link': l.id, 'aria-pressed': String(isCut),
          'aria-label': l.label + (isCut ? ' (ขาด) กดเพื่อต่อ' : ' (ปกติ) กดเพื่อตัด')});
        grp.append(s('title', {text: l.label + (isCut ? ' — ขาด' : ' — ปกติ')}));
        grp.append(s('line', {class:'nlw-topo-hit', x1:a.x, y1:a.y, x2:b.x, y2:b.y, stroke:'var(--blue)', 'stroke-opacity':0, 'stroke-width':18, 'stroke-linecap':'round'}));
        grp.append(s('circle', {cx:mx, cy:my, r:11, fill:'transparent'}));
        grp.append(s('line', {x1:a.x, y1:a.y, x2:b.x, y2:b.y, stroke: isCut ? 'var(--bad)' : (l.backbone ? 'var(--ink)' : 'var(--muted)'), 'stroke-width': l.backbone ? 4 : 2.5, 'stroke-dasharray': isCut ? '6 5' : null}));
        if (isCut) grp.append(s('path', {d:`M${mx-7} ${my-7}L${mx+7} ${my+7}M${mx+7} ${my-7}L${mx-7} ${my+7}`, stroke:'var(--bad)', 'stroke-width':3.5, 'stroke-linecap':'round'}));
        const toggle = refocus => { if (cut.has(l.id)) cut.delete(l.id); else cut.add(l.id); render(); if (refocus){ const again = svg.querySelector('[data-link="' + l.id + '"]'); if (again) again.focus(); } };
        grp.addEventListener('click', () => toggle(false));
        grp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(true); } });
        svg.append(grp);
      });
      if (type === 'ring' && !dual){
        // direction arrows for unidirectional ring
        g.links.forEach(l => { const a = g.nodes[l.a], b = g.nodes[l.b]; const t = 0.62, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
          svg.append(s('path', {d:'M-6 -5L4 0L-6 5Z', fill:'var(--blue)', transform:`translate(${x} ${y}) rotate(${ang})`, 'pointer-events':'none'})); });
      }
      Object.keys(g.nodes).forEach(id => {
        const n = g.nodes[id];
        if (n.kind === 'tap') { svg.append(s('circle', {cx:n.x, cy:n.y, r:4.5, fill:'var(--ink)'})); return; }
        if (n.kind === 'sw') {
          svg.append(s('rect', {x:n.x - 32, y:n.y - 15, width:64, height:30, rx:6, fill: swDown ? 'var(--bad)' : 'var(--ink)'}),
                     s('text', {x:n.x, y:n.y + 5, 'text-anchor':'middle', 'font-size':13, 'font-weight':700, fill:'var(--panel)', text: swDown ? 'เสีย' : 'Switch'}));
          return;
        }
        const nOk = PCS.filter(p => p !== id && A.comm(id, p)).length;
        svg.append(s('rect', {x:n.x - 25, y:n.y - 14, width:50, height:28, rx:6, fill:'var(--panel)', stroke: nOk === 4 ? 'var(--ok)' : nOk === 0 ? 'var(--bad)' : 'var(--orange)', 'stroke-width':2.5}),
                   s('text', {x:n.x, y:n.y + 5, 'text-anchor':'middle', 'font-size':13, 'font-weight':700, fill:'var(--ink)', text:id}));
      });
      // per-PC
      pcList.replaceChildren();
      PCS.forEach(p => {
        const others = PCS.filter(q => q !== p), ok = others.filter(q => A.comm(p, q));
        const all = ok.length === others.length, none = ok.length === 0;
        const lost = others.filter(q => !A.comm(p, q));
        pcList.append(h('span', {class:'nlw-chip ' + (all ? 'nlw-is-ok' : none ? 'nlw-is-bad' : 'nlw-is-warn'), 'data-pc': p, 'data-state': all ? 'full' : none ? 'isolated' : 'partial'},
          all ? '✓ ' + p + ' ถึงทุกเครื่อง (4/4)' : none ? '✗ ' + p + ' ถูกตัดขาด (0/4)' : '! ' + p + ' ถึง ' + ok.length + '/4 · ไปไม่ถึง ' + lost.join(', ')));
      });
      // summary
      const full = A.groups.length === 1;
      let prefix = '';
      if (type === 'star' && swDown) prefix = 'สวิตช์เสีย: ';
      else if (type === 'bus' && A.backboneCut) prefix = 'สายหลักขาด: ';
      else if (type === 'ring' && cut.size && !full) prefix = 'วงแหวนขาด: ';
      let text, cls;
      if (full){
        cls = 'nlw-is-ok';
        text = 'ทุกเครื่องยังสื่อสารกันได้ครบ' + (cut.size ? (type === 'ring' ? ' — วงแหวนคู่ส่งย้อนอีกทิศทางได้' : type === 'mesh' ? ' — Mesh มีเส้นทางสำรองให้เลือกใช้' : '') : '');
      } else if (A.groups.every(gr => gr.length === 1)){
        cls = 'nlw-is-bad'; text = prefix + 'ทุกเครื่องสื่อสารกันไม่ได้';
      } else {
        cls = 'nlw-is-warn';
        const singles = A.groups.filter(gr => gr.length === 1).map(gr => gr[0]);
        text = prefix + 'เครือข่ายแยกเป็น ' + A.groups.length + ' ส่วน: ' + A.groups.map(gr => '[' + gr.join(', ') + ']').join(' | ');
        if (singles.length === 1 && A.groups.length === 2) text += ' — เฉพาะ ' + singles[0] + ' ถูกตัดขาด เครื่องอื่นยังใช้งานได้';
        else if (singles.length) text += ' — เครื่องที่ถูกตัดขาด: ' + singles.join(', ');
      }
      summary.className = 'nlw-result ' + cls; summary.textContent = text;
      // note
      note.replaceChildren();
      if (type === 'bus'){
        note.append(h('p', null, h('b', null, 'แบบจำลอง Bus: '), 'ทุกเครื่องต่อเข้าสายหลักเส้นเดียวผ่านจุดแยก (tap) สายหลักถูกแบ่งเป็น 4 ช่วงระหว่างจุดแยก ถ้าตัดช่วงใดช่วงหนึ่ง กราฟจะแยกเป็นสองฝั่ง'),
          h('p', {class: A.backboneCut ? 'nlw-warn' : null}, h('b', null, 'หมายเหตุสายโคแอกซ์จริง: '), 'เมื่อสายหลักขาด ปลายที่ขาดจะไม่มีตัวปิดปลาย (terminator) สัญญาณสะท้อนกลับไปชนกัน ทำให้โดยปกติ "ทั้งบัส" ใช้งานไม่ได้ ไม่ใช่แค่แยกสองฝั่ง (เลือกช่องด้านบนเพื่อจำลองกรณีนี้)'));
      } else if (type === 'ring'){
        note.append(h('p', null, h('b', null, 'สมมติฐาน: '), dual
          ? 'วงแหวนคู่มีสองวงวิ่งสวนทางกัน ตัดสาย 1 จุด ข้อมูลยังวิ่งอ้อมอีกทางได้ ตัด 2 จุดขึ้นไปจึงแยกเครือข่าย'
          : 'วงแหวนเดี่ยวส่งข้อมูลทางเดียว (ตามลูกศร) การคุยกันต้องส่งไปและได้คำตอบกลับ ซึ่งรวมกันต้องวนครบรอบวง ดังนั้นสายขาดเพียงจุดเดียวทุกคู่สื่อสารไม่ได้'),
          h('p', {class:'nlw-small'}, 'ระบบคำนวณจากการค้นหาเส้นทางในกราฟแบบมีทิศทาง: เครื่อง A คุยกับ B ได้ เมื่อมีเส้นทาง A→B และ B→A'));
      } else if (type === 'star'){
        note.append(h('p', null, h('b', null, 'Star: '), 'ทุกเครื่องต่อเข้าสวิตช์ตรงกลาง สายของเครื่องใดขาด จะกระทบเฉพาะเครื่องนั้น แต่ถ้าสวิตช์ (จุดศูนย์กลาง) เสีย ทุกเครื่องสื่อสารกันไม่ได้ (single point of failure)'));
      } else {
        note.append(h('p', null, h('b', null, 'Full Mesh: '), 'ทุกเครื่องต่อตรงถึงกันทุกคู่ จำนวนสาย = n(n−1)/2 = 5×4/2 = ', h('b', null, '10 เส้น'), ' (ตอนนี้ขาด ' + cut.size + ' เส้น) ทนทานสูงแต่สิ้นเปลืองสายและพอร์ตมาก'));
      }
    }
    render();
  }

  /* ===================================================================
     2. hub-switch-sim
     =================================================================== */
  function hubSwitchSim(root){
    frame(root, 'Hub กับ Switch ส่งเฟรมต่างกันอย่างไร', 'เลือกโหมด Hub หรือ Switch เลือกเครื่องผู้ส่งและผู้รับ แล้วกด "ส่งเฟรม" สังเกตว่าเฟรมไปถึงพอร์ตใดบ้าง และตาราง MAC ของ Switch');
    const PCS = ['A','B','C','D'];
    const MAC = {A:'00:1A:2B:3C:4D:0A', B:'00:1A:2B:3C:4D:0B', C:'00:1A:2B:3C:4D:0C', D:'00:1A:2B:3C:4D:0D'};
    const PORT = {A:1, B:2, C:3, D:4};
    const BCAST = 'FF:FF:FF:FF:FF:FF';
    const POS = {A:{x:62,y:46}, B:{x:338,y:46}, C:{x:62,y:186}, D:{x:338,y:186}};
    let mode = 'switch', table = new Map(), count = 0, last = null;

    const modeSeg = seg([['hub','Hub'],['switch','Switch']], mode, v => { mode = v; last = null; render(); }, 'โหมดอุปกรณ์');
    const srcSel = select(PCS.map(p => [p, 'PC ' + p]), 'A', () => fixDst());
    const dstSel = h('select');
    function fixDst(){
      const cur = dstSel.value, src = srcSel.value;
      dstSel.replaceChildren();
      PCS.filter(p => p !== src).forEach(p => dstSel.appendChild(h('option', {value:p}, 'PC ' + p)));
      dstSel.appendChild(h('option', {value:'ALL'}, 'ทุกเครื่อง (Broadcast)'));
      dstSel.value = (cur && cur !== src) ? cur : dstSel.options[0].value;
    }
    fixDst();
    const sendBtn = h('button', {type:'button', class:'nlw-btn nlw-primary', 'data-act':'send', onclick: () => send(srcSel.value, dstSel.value)}, 'ส่งเฟรม');
    const clearBtn = h('button', {type:'button', class:'nlw-btn', 'data-act':'clear', onclick: () => { table.clear(); log('ล้างตาราง MAC แล้ว (Switch ต้องเรียนรู้ใหม่)'); render(); }}, 'ล้างตาราง MAC');
    const svg = s('svg', {class:'nlw-svg', viewBox:'0 0 400 236', role:'img', 'aria-label':'แผนภาพการส่งเฟรม'});
    const result = h('div', {class:'nlw-result', 'aria-live':'polite'}, 'ยังไม่ได้ส่งเฟรม');
    const tableBox = h('div');
    const logBox = h('ol', {class:'nlw-pre nlw-list', reversed:true, 'data-log':'1', style:'padding-left:34px'});
    root.append(modeSeg.el,
      h('div', {class:'nlw-row'}, field('ผู้ส่ง', srcSel), field('ผู้รับ', dstSel), sendBtn, clearBtn),
      svg, result, tableBox, h('div', {class:'nlw-small'}, 'บันทึกเหตุการณ์ (ล่าสุดอยู่บน)'), logBox);

    function log(t){ count++; logBox.insertBefore(h('li', null, t), logBox.firstChild); while (logBox.children.length > 40) logBox.removeChild(logBox.lastChild); }
    function send(src, dst){
      const dstMac = dst === 'ALL' ? BCAST : MAC[dst];
      const others = PCS.filter(p => p !== src);
      let out, how, learnTxt = '';
      if (mode === 'hub'){
        out = others;
        how = 'Hub ไม่อ่าน MAC — ทวนสัญญาณออกทุกพอร์ตยกเว้นพอร์ตที่รับเข้ามา (พอร์ต ' + out.map(p => PORT[p]).join(',') + ')';
      } else {
        const had = table.get(MAC[src]);
        table.set(MAC[src], PORT[src]);
        learnTxt = had === PORT[src] ? 'MAC ของ ' + src + ' มีในตารางแล้ว (พอร์ต ' + PORT[src] + ')' : 'เรียนรู้ MAC ต้นทาง ' + MAC[src] + ' อยู่พอร์ต ' + PORT[src];
        if (dst === 'ALL'){ out = others; how = 'MAC ปลายทางเป็น Broadcast → flood ออกทุกพอร์ต (' + out.map(p => PORT[p]).join(',') + ')'; }
        else if (table.has(dstMac)){
          const p = table.get(dstMac);
          if (p === PORT[src]){ out = []; how = 'ปลายทางอยู่พอร์ตเดียวกับต้นทาง → กรองทิ้ง (filter)'; }
          else { out = PCS.filter(x => PORT[x] === p); how = 'พบ MAC ปลายทางในตาราง → ส่งต่อ (forward) เฉพาะพอร์ต ' + p; }
        } else { out = others; how = 'ไม่พบ MAC ปลายทางในตาราง → flood ออกทุกพอร์ตยกเว้นพอร์ตต้นทาง (' + out.map(p => PORT[p]).join(',') + ')'; }
      }
      const st = {}; PCS.forEach(p => st[p] = 'none'); st[src] = 'src';
      out.forEach(p => st[p] = (dstMac === BCAST || MAC[p] === dstMac) ? 'accept' : 'discard');
      last = {src, dst, st, out};
      const acc = out.filter(p => st[p] === 'accept'), dis = out.filter(p => st[p] === 'discard');
      log('#' + (count + 1) + ' [' + (mode === 'hub' ? 'Hub' : 'Switch') + '] ' + src + ' → ' + (dst === 'ALL' ? 'Broadcast' : dst) + ': ' + (learnTxt ? learnTxt + ' · ' : '') + how +
        ' · รับ: ' + (acc.join(',') || '-') + (dis.length ? ' · ทิ้งเฟรม: ' + dis.join(',') : ''));
      result.className = 'nlw-result ' + (out.length > 1 && dst !== 'ALL' ? 'nlw-is-warn' : 'nlw-is-ok');
      result.textContent = how + '. ' + (dis.length ? 'เครื่อง ' + dis.join(', ') + ' ได้รับเฟรมแต่ MAC ไม่ตรงจึงทิ้งไป (เสียแบนด์วิดท์)' : 'ไม่มีเครื่องใดได้รับเฟรมโดยไม่จำเป็น');
      render();
    }
    function render(){
      svg.replaceChildren();
      const st = last ? last.st : null;
      PCS.forEach(p => {
        const P = POS[p], s0 = st ? st[p] : 'none';
        const col = s0 === 'src' ? 'var(--blue)' : s0 === 'accept' ? 'var(--ok)' : s0 === 'discard' ? 'var(--orange)' : 'var(--line)';
        const dx = P.x < 200 ? 140 : 260, dy = P.y < 118 ? 104 : 132;
        svg.append(s('line', {x1:P.x, y1:P.y, x2:dx, y2:dy, stroke:col, 'stroke-width': s0 === 'none' ? 2.5 : 5}));
        svg.append(s('text', {x: dx + (P.x < 200 ? -14 : 14), y: dy + (P.y < 118 ? -6 : 16), 'text-anchor':'middle', 'font-size':11, fill:'var(--muted)', text:'P' + PORT[p]}));
      });
      svg.append(s('rect', {x:140, y:98, width:120, height:40, rx:8, fill: mode === 'hub' ? 'var(--brown)' : 'var(--blue)'}),
        s('text', {x:200, y:123, 'text-anchor':'middle', 'font-size':15, 'font-weight':700, fill:'var(--panel)', text: mode === 'hub' ? 'HUB' : 'SWITCH'}));
      PCS.forEach(p => {
        const P = POS[p], s0 = st ? st[p] : 'none';
        const lbl = {src:'ผู้ส่ง', accept:'รับเฟรม ✓', discard:'ทิ้งเฟรม (MAC ไม่ตรง)', none: st ? 'ไม่ได้รับ' : ''}[s0];
        const ty = P.y < 118 ? P.y - 24 : P.y + 32;
        svg.append(s('rect', {x:P.x - 58, y:P.y - 18, width:116, height:36, rx:6, fill:'var(--panel)', stroke: s0 === 'none' ? 'var(--muted)' : s0 === 'src' ? 'var(--blue)' : s0 === 'accept' ? 'var(--ok)' : 'var(--orange)', 'stroke-width':2}),
          s('text', {x:P.x, y:P.y - 2, 'text-anchor':'middle', 'font-size':13, 'font-weight':700, fill:'var(--ink)', text:'PC ' + p}),
          s('text', {x:P.x, y:P.y + 12, 'text-anchor':'middle', 'font-size':9, textLength:104, lengthAdjust:'spacingAndGlyphs', fill:'var(--muted)', 'font-family':'JetBrains Mono,Consolas,monospace', text:MAC[p]}),
          s('text', {x:P.x, y:ty, 'text-anchor':'middle', 'font-size':12, 'font-weight':600, 'data-pc':p, 'data-state':s0, fill: s0 === 'accept' ? 'var(--ok)' : s0 === 'discard' ? 'var(--orange)' : 'var(--blue)', text:lbl}));
      });
      tableBox.replaceChildren();
      clearBtn.disabled = mode === 'hub';
      if (mode === 'hub'){
        tableBox.append(h('div', {class:'nlw-box'}, 'Hub ทำงานในชั้น Physical ไม่มีตาราง MAC — ทุกพอร์ตอยู่ใน collision domain เดียวกัน'));
      } else {
        const rows = [...table.entries()].sort((a, b) => a[1] - b[1]);
        tableBox.append(h('div', {class:'nlw-small', style:'margin-top:6px'}, 'ตาราง MAC Address ของ Switch (' + rows.length + ' รายการ)'),
          h('div', {class:'nlw-scroll'}, h('table', {class:'nlw-table', 'data-mactable':'1'},
            h('thead', null, h('tr', null, h('th', null, 'พอร์ต'), h('th', null, 'MAC Address'), h('th', null, 'เครื่อง'))),
            h('tbody', null, rows.length ? rows.map(r => h('tr', null, h('td', null, String(r[1])), h('td', {class:'nlw-mono'}, r[0]), h('td', null, PCS.find(p => MAC[p] === r[0]))))
              : h('tr', null, h('td', {colspan:3, class:'nlw-small'}, 'ว่าง — Switch ยังไม่รู้จักเครื่องใด'))))));
      }
    }
    render();
  }

  /* ===================================================================
     3. osi-explorer
     =================================================================== */
  const OSI = [
    null,
    {en:'Physical', th:'ชั้นกายภาพ', tcp:'Network Access', fn:'ส่งข้อมูลเป็นบิต (0/1) ในรูปสัญญาณไฟฟ้า แสง หรือคลื่นวิทยุ กำหนดลักษณะสาย หัวต่อ ระดับแรงดัน และความเร็วในการส่ง', pdu:'Bit (บิต)', proto:'มาตรฐานสัญญาณ/สื่อ เช่น 10BASE-T, 100BASE-TX, 1000BASE-T, RS-232, DSL, สาย UTP/Fiber, หัว RJ-45', dev:'Hub, Repeater, สายสัญญาณ, Modem, Media converter'},
    {en:'Data Link', th:'ชั้นเชื่อมต่อข้อมูล', tcp:'Network Access', fn:'ส่งเฟรมระหว่างอุปกรณ์ที่อยู่ในเครือข่ายเดียวกัน ใช้ MAC Address ระบุเครื่อง ตรวจจับข้อผิดพลาดด้วย FCS ควบคุมการเข้าใช้สื่อ (แบ่งเป็นชั้นย่อย LLC และ MAC)', pdu:'Frame (เฟรม)', proto:'Ethernet (IEEE 802.3), Wi-Fi (IEEE 802.11), PPP, HDLC', dev:'Switch, Bridge, Access Point, การ์ดแลน (NIC)'},
    {en:'Network', th:'ชั้นเครือข่าย', tcp:'Internet', fn:'กำหนดที่อยู่เชิงตรรกะ (IP Address) และเลือกเส้นทาง (Routing) เพื่อส่งแพ็กเก็ตข้ามเครือข่ายไปถึงปลายทาง', pdu:'Packet (แพ็กเก็ต)', proto:'IPv4, IPv6, ICMP (ping), IPX', dev:'Router, Layer 3 Switch'},
    {en:'Transport', th:'ชั้นขนส่ง', tcp:'Transport', fn:'ส่งข้อมูลระหว่างโปรแกรมต้นทางกับปลายทาง (end-to-end) ใช้หมายเลขพอร์ตแยกโปรแกรม แบ่งข้อมูลเป็นส่วน ๆ TCP รับประกันความถูกต้อง/ลำดับ/ควบคุมการไหล ส่วน UDP ส่งเร็วแต่ไม่รับประกัน', pdu:'Segment (TCP) / Datagram (UDP)', proto:'TCP, UDP', dev:'Firewall (กรองตามพอร์ต), Load balancer แบบ Layer 4'},
    {en:'Session', th:'ชั้นเซสชัน', tcp:'Application', fn:'สร้าง ควบคุม และยุติการเชื่อมต่อ (เซสชัน) ระหว่างโปรแกรมสองฝั่ง ดูแลการผลัดกันส่งและจุดตรวจสอบ (checkpoint) เพื่อส่งต่อได้เมื่อขาดตอน', pdu:'Data (ข้อมูล)', proto:'NetBIOS, RPC, PPTP', dev:'ไม่มีอุปกรณ์เฉพาะ — ทำงานในซอฟต์แวร์ของเครื่องปลายทาง'},
    {en:'Presentation', th:'ชั้นนำเสนอข้อมูล', tcp:'Application', fn:'แปลงรูปแบบข้อมูลให้ทั้งสองฝั่งเข้าใจตรงกัน เช่น รหัสตัวอักษร การเข้ารหัส/ถอดรหัส (encryption) และการบีบอัดข้อมูล (compression)', pdu:'Data (ข้อมูล)', proto:'TLS/SSL (การเข้ารหัส), ASCII, UTF-8, JPEG, PNG, MPEG', dev:'ไม่มีอุปกรณ์เฉพาะ — ทำงานในซอฟต์แวร์ของเครื่องปลายทาง'},
    {en:'Application', th:'ชั้นแอปพลิเคชัน', tcp:'Application', fn:'ชั้นที่ใกล้ผู้ใช้ที่สุด ให้บริการเครือข่ายแก่โปรแกรม เช่น เว็บ อีเมล โอนไฟล์ แปลงชื่อโดเมน', pdu:'Data (ข้อมูล)', proto:'HTTP, HTTPS, FTP, SMTP, POP3, IMAP, DNS, DHCP, SSH, Telnet', dev:'เครื่องปลายทาง (Host), Proxy server, Gateway, Firewall แบบ Layer 7'}
  ];
  const TCPCOL = {'Application':'var(--orange)', 'Transport':'var(--green)', 'Internet':'var(--blue)', 'Network Access':'var(--brown)'};
  function osiExplorer(root){
    frame(root, 'สำรวจแบบจำลอง OSI 7 ชั้น', 'คลิกที่ชั้นใดชั้นหนึ่ง (ชั้น 7 อยู่บนสุด) เพื่อดูหน้าที่ PDU โปรโตคอล อุปกรณ์ และชั้นที่ตรงกันใน TCP/IP');
    let sel = 7;
    const grid = h('div', {class:'nlw-osi'});
    const detail = h('div', {class:'nlw-box', 'aria-live':'polite'});
    grid.append(h('div', {class:'nlw-small', style:'font-weight:600'}, 'OSI (7 ชั้น)'), h('div', {class:'nlw-small', style:'font-weight:600'}, 'TCP/IP (4 ชั้น)'));
    const bars = {};
    const tcpCells = {};
    for (let n = 7; n >= 1; n--){
      const L = OSI[n];
      const b = h('button', {type:'button', class:'nlw-btn nlw-osi-bar', 'data-layer': n, style:'border-left-color:' + TCPCOL[L.tcp] + ';grid-column:1;grid-row:' + (9 - n),
        onclick: () => { sel = n; render(); }}, h('span', {class:'nlw-n'}, String(n)), h('span', null, L.en, h('span', {class:'nlw-small'}, ' ' + L.th)));
      bars[n] = b; grid.append(b);
    }
    [['Application', 2, 5], ['Transport', 5, 6], ['Internet', 6, 7], ['Network Access', 7, 9]].forEach(t => {
      const c = h('div', {class:'nlw-osi-tcp', style:'grid-column:2;grid-row:' + t[1] + '/' + t[2] + ';border-left:4px solid ' + TCPCOL[t[0]]}, t[0]);
      tcpCells[t[0]] = c; grid.append(c);
    });
    root.append(grid, detail, h('p', {class:'nlw-small'}, 'ช่วยจำจากบนลงล่าง: All People Seem To Need Data Processing (Application → Physical)'));
    function render(){
      const L = OSI[sel];
      for (const n in bars) bars[n].setAttribute('aria-pressed', String(Number(n) === sel));
      for (const k in tcpCells) tcpCells[k].classList.toggle('nlw-on', k === L.tcp);
      detail.replaceChildren(
        h('div', {style:'font-weight:700;font-size:17px'}, 'ชั้นที่ ' + sel + ' ' + L.en + ' — ' + L.th),
        h('p', null, h('b', null, 'หน้าที่: '), L.fn),
        h('p', null, h('b', null, 'PDU: '), L.pdu),
        h('p', null, h('b', null, 'ตัวอย่างโปรโตคอล/มาตรฐาน: '), L.proto),
        h('p', null, h('b', null, 'ตัวอย่างอุปกรณ์: '), L.dev),
        h('p', null, h('b', null, 'ตรงกับ TCP/IP ชั้น: '), h('span', {'data-k':'tcp'}, L.tcp)));
    }
    render();
  }

  /* ===================================================================
     4. encap-stepper
     =================================================================== */
  function encapStepper(root){
    frame(root, 'การห่อหุ้มข้อมูล (Encapsulation) ของคำขอเว็บ', 'กด "ถัดไป" เพื่อดูว่าข้อมูลถูกเพิ่ม header ทีละชั้นที่ผู้ส่ง แล้วถูกแกะออกทีละชั้นที่ผู้รับ กด "ก่อนหน้า" เพื่อย้อนกลับ');
    const CL = {ip:'192.168.1.20', sv:'203.0.113.10', sp:50123, dp:80, mac:'00:1A:2B:3C:4D:5E', gw:'3C:52:82:1F:6A:01'};
    const D = {k:'data', t:'Data (HTTP)', v:'GET / HTTP/1.1\nHost: www.example.com'};
    const T = {k:'tcp', t:'TCP header', v:'Src port ' + CL.sp + ' → Dst port ' + CL.dp};
    const I = {k:'ip', t:'IP header', v:'Src ' + CL.ip + ' → Dst ' + CL.sv};
    const E = {k:'eth', t:'Ethernet header', v:'Dst MAC ' + CL.gw + ' · Src MAC ' + CL.mac};
    const F = {k:'fcs', t:'Trailer', v:'FCS (CRC-32)'};
    const macBits = CL.gw.split(':').map(x => parseInt(x, 16).toString(2).padStart(8, '0')).join(' ');
    const bits = '10101010 '.repeat(7) + '10101011 ' + macBits + ' …';
    const STEPS = [
      {side:'ผู้ส่ง (เบราว์เซอร์)', layer:'Application', pdu:'Data', boxes:[D], newk:'data', ex:'ผู้ใช้พิมพ์ www.example.com เบราว์เซอร์สร้างคำขอ HTTP "GET /" ข้อมูลในชั้นนี้เรียกว่า Data'},
      {side:'ผู้ส่ง', layer:'Transport', pdu:'Segment', boxes:[T, D], newk:'tcp', ex:'TCP เพิ่ม header ที่มีพอร์ตต้นทาง ' + CL.sp + ' (พอร์ตชั่วคราวที่ระบบสุ่มให้เบราว์เซอร์) และพอร์ตปลายทาง 80 (HTTP) พร้อมหมายเลขลำดับ (sequence) ได้เป็น Segment'},
      {side:'ผู้ส่ง', layer:'Network', pdu:'Packet', boxes:[I, T, D], newk:'ip', ex:'IP เพิ่ม header ที่มี IP ต้นทาง ' + CL.ip + ' และ IP ปลายทาง ' + CL.sv + ' (ของเว็บเซิร์ฟเวอร์) และ TTL ได้เป็น Packet'},
      {side:'ผู้ส่ง', layer:'Data Link', pdu:'Frame', boxes:[E, I, T, D, F], newk:'eth', ex:'Ethernet เพิ่ม header (MAC ปลายทาง/ต้นทาง) และ trailer คือ FCS ไว้ตรวจข้อผิดพลาด ได้เป็น Frame — เซิร์ฟเวอร์อยู่ต่างเครือข่าย MAC ปลายทางจึงเป็นของ Default Gateway (เราเตอร์) ไม่ใช่ของเซิร์ฟเวอร์'},
      {side:'ผู้ส่ง', layer:'Physical', pdu:'Bits', boxes:[{k:'eth', t:'Bits บนสาย', v:bits}], newk:'eth', ex:'การ์ดแลนแปลงเฟรมเป็นบิตแล้วส่งเป็นสัญญาณไฟฟ้าทางสาย UTP เริ่มด้วย Preamble 10101010 ×7 และ SFD 10101011 ตามด้วยบิตของ MAC ปลายทาง (แปลงจริงจาก ' + CL.gw + ')'},
      {side:'ผู้รับ (เว็บเซิร์ฟเวอร์)', layer:'Physical', pdu:'Bits → Frame', boxes:[E, I, T, D, F], newk:null, up:true, ex:'ฝั่งผู้รับ (หลังผ่านเราเตอร์ซึ่งจะเปลี่ยน header ของ Ethernet ให้เป็นของช่วงสายถัดไป) การ์ดแลนรับสัญญาณแปลงกลับเป็นบิตและประกอบเป็นเฟรม'},
      {side:'ผู้รับ', layer:'Data Link', pdu:'Packet', boxes:[I, T, D], newk:null, up:true, ex:'ตรวจว่า MAC ปลายทางตรงกับเครื่องตน และคำนวณ FCS ว่าไม่มีข้อผิดพลาด จากนั้นแกะ Ethernet header/trailer ออก ส่ง Packet ขึ้นชั้น Network'},
      {side:'ผู้รับ', layer:'Network', pdu:'Segment', boxes:[T, D], newk:null, up:true, ex:'ตรวจว่า IP ปลายทาง ' + CL.sv + ' เป็นของตน แล้วแกะ IP header ออก ส่ง Segment ให้ TCP'},
      {side:'ผู้รับ', layer:'Transport', pdu:'Data', boxes:[D], newk:null, up:true, ex:'TCP ดูพอร์ตปลายทาง 80 จึงส่งข้อมูลให้โปรแกรมเว็บเซิร์ฟเวอร์ แกะ TCP header ออก (และจำพอร์ต ' + CL.sp + ' ไว้ตอบกลับ)'},
      {side:'ผู้รับ', layer:'Application', pdu:'Data', boxes:[D], newk:null, up:true, ex:'เว็บเซิร์ฟเวอร์อ่านคำขอ "GET /" แล้วเตรียมส่งหน้าเว็บกลับ ซึ่งจะผ่านการห่อหุ้มแบบเดียวกันในทิศทางกลับ'}
    ];
    const LAYERS = ['Application','Transport','Network','Data Link','Physical'];
    let i = 0;
    const head = h('div', {style:'font-weight:700', 'aria-live':'polite'});
    const layers = h('div', {class:'nlw-layers'});
    const pdu = h('div', {class:'nlw-pdu'});
    const ex = h('div', {class:'nlw-box'});
    const dots = h('div', {class:'nlw-dots', 'aria-hidden':'true'});
    const prev = h('button', {type:'button', class:'nlw-btn', 'data-act':'prev', onclick: () => { if (i > 0) { i--; render(); } }}, '◀ ก่อนหน้า');
    const next = h('button', {type:'button', class:'nlw-btn nlw-primary', 'data-act':'next', onclick: () => { if (i < STEPS.length - 1) { i++; render(); } }}, 'ถัดไป ▶');
    root.append(head, layers, pdu, ex, h('div', {class:'nlw-row nlw-center'}, prev, next, dots));
    function render(){
      const S = STEPS[i];
      head.textContent = 'ขั้นที่ ' + (i + 1) + '/' + STEPS.length + ' · ' + S.side + ' · ชั้น ' + S.layer + (S.up ? ' ↑ (แกะออก)' : ' ↓ (ห่อหุ้ม)') + ' · PDU: ' + S.pdu;
      layers.replaceChildren(...LAYERS.map(l => h('span', {class: l === S.layer ? 'nlw-on' : ''}, l)));
      pdu.replaceChildren(...S.boxes.map(b => h('div', {class:'nlw-seg-box nlw-k-' + b.k + (b.k === S.newk ? ' nlw-k-new' : ''), 'data-box': b.k}, h('b', null, b.t), h('span', {class:'nlw-mono', style:'white-space:pre-wrap'}, b.v))));
      ex.textContent = S.ex;
      dots.replaceChildren(...STEPS.map((_, j) => h('span', {class:'nlw-dot' + (j === i ? ' nlw-on' : '')})));
      prev.disabled = i === 0; next.disabled = i === STEPS.length - 1;
    }
    render();
  }

  /* ===================================================================
     5. ip-calc
     =================================================================== */
  function ipCalc(root){
    frame(root, 'เครื่องคำนวณ IPv4 / Subnet', 'พิมพ์ IP Address และ Prefix (เช่น /26) หรือ Subnet mask (เช่น 255.255.255.192) ผลลัพธ์จะคำนวณทันที');
    const ipIn = h('input', {type:'text', value:'192.168.10.37', inputmode:'decimal', autocomplete:'off', spellcheck:'false', class:'nlw-mono', 'data-in':'ip', style:'width:170px', oninput: calc});
    const pfIn = h('input', {type:'text', value:'/26', autocomplete:'off', spellcheck:'false', class:'nlw-mono', 'data-in':'prefix', style:'width:170px', oninput: calc});
    const msg = h('div', {'aria-live':'polite'});
    const out = h('div');
    root.append(h('div', {class:'nlw-row'}, field('IP Address', ipIn), field('Prefix หรือ Subnet mask', pfIn),
      h('button', {type:'button', class:'nlw-btn nlw-primary', onclick: calc}, 'คำนวณ')), msg, out);
    function binHTML(n, p){
      const wrap = h('span', {class:'nlw-bin'});
      for (let b = 31; b >= 0; b--){
        const idx = 31 - b;
        wrap.append(h('span', {class: idx < p ? 'nlw-netbit' : 'nlw-hostbit'}, String((n >>> b) & 1)));
        if (b % 8 === 0 && b) wrap.append('.');
      }
      return wrap;
    }
    function classify(ip){
      const a = ip >>> 24, b = (ip >>> 16) & 255;
      const cls = a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D' : 'E';
      let type;
      if (ip === 0xFFFFFFFF) type = 'Limited broadcast (ประกาศทั้งเครือข่ายท้องถิ่น)';
      else if (a === 127) type = 'Loopback (ทดสอบภายในเครื่องตัวเอง 127.0.0.0/8)';
      else if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) type = 'Private (ใช้ภายในองค์กร/บ้าน ออกอินเทอร์เน็ตต้องผ่าน NAT)';
      else if (a === 169 && b === 254) type = 'APIPA / Link-local (Windows ตั้งเองเมื่อขอ IP จาก DHCP ไม่ได้)';
      else if (a >= 224 && a <= 239) type = 'Multicast (ส่งถึงกลุ่มเครื่อง)';
      else if (a >= 240) type = 'Reserved (สงวนไว้ ใช้งานทั่วไปไม่ได้)';
      else if (a === 0) type = 'This network (0.0.0.0/8 ใช้งานกับเครื่องไม่ได้)';
      else if (a === 100 && b >= 64 && b <= 127) type = 'Shared address / CGNAT (100.64.0.0/10 ของผู้ให้บริการ)';
      else type = 'Public (ใช้บนอินเทอร์เน็ตได้)';
      const def = cls === 'A' ? '/8 (255.0.0.0)' : cls === 'B' ? '/16 (255.255.0.0)' : cls === 'C' ? '/24 (255.255.255.0)' : 'ไม่มี (ไม่ใช้กับเครื่องทั่วไป)';
      return {cls, type, def};
    }
    function calc(){
      let ipText = ipIn.value.trim();
      if (ipText.indexOf('/') >= 0){ const sp = ipText.split('/'); ipText = sp[0]; pfIn.value = '/' + sp[1]; ipIn.value = ipText; }
      const ip = parseIP(ipText), p = parsePrefix(pfIn.value);
      ipIn.classList.toggle('nlw-invalid', ip === null);
      pfIn.classList.toggle('nlw-invalid', p < 0);
      out.replaceChildren();
      if (ip === null || p < 0){
        msg.className = 'nlw-result nlw-is-bad';
        msg.textContent = ip === null ? 'IP Address ไม่ถูกต้อง: ต้องเป็นตัวเลข 4 ชุดคั่นด้วยจุด แต่ละชุด 0–255 เช่น 192.168.1.10'
          : 'Prefix/Subnet mask ไม่ถูกต้อง: ใช้ /0 ถึง /32 หรือ mask ที่บิต 1 เรียงติดกันจากซ้าย เช่น 255.255.255.0';
        return;
      }
      const m = maskOf(p), wild = (~m) >>> 0, net = (ip & m) >>> 0, bc = (net | wild) >>> 0;
      const total = Math.pow(2, 32 - p);
      const C = classify(ip);
      let first, last, hosts, bcText, note = '';
      if (p === 32){ first = last = ip; hosts = 1; bcText = '— (ไม่มี)'; note = '/32 มีที่อยู่เดียว ใช้ระบุเครื่องเดียว (host route เช่น loopback ของเราเตอร์) ไม่มี network/broadcast แยก'; }
      else if (p === 31){ first = net; last = bc; hosts = 2; bcText = '— (ไม่มี ใช้ตาม RFC 3021)'; note = '/31 มี 2 ที่อยู่ ใช้ได้ทั้งสองสำหรับลิงก์แบบจุดต่อจุด (point-to-point) ระหว่างเราเตอร์ จึงไม่ต้องเสียที่อยู่ให้ network/broadcast'; }
      else { first = (net + 1) >>> 0; last = (bc - 1) >>> 0; hosts = total - 2; bcText = ipStr(bc); note = 'จำนวนโฮสต์ = 2^(32−' + p + ') − 2 = ' + fmt(total) + ' − 2 (หักที่อยู่ network และ broadcast)'; }
      msg.className = 'nlw-result nlw-is-ok';
      msg.textContent = ipStr(ip) + '/' + p + ' อยู่ในเครือข่าย ' + ipStr(net) + '/' + p;
      if (p <= 30 && (ip === net || ip === bc)) { msg.className = 'nlw-result nlw-is-warn'; msg.textContent += ' — ระวัง: ที่อยู่นี้เป็น ' + (ip === net ? 'Network address' : 'Broadcast address') + ' กำหนดให้เครื่องไม่ได้'; }
      const row = (k, label, val, mono) => h('tr', null, h('th', {scope:'row'}, label), h('td', {'data-k':k, class: mono ? 'nlw-mono' : null}, val));
      out.append(h('div', {class:'nlw-scroll'}, h('table', {class:'nlw-table'}, h('tbody', null,
        row('class', 'คลาส', 'Class ' + C.cls + ' (mask เริ่มต้น ' + C.def + ')'),
        row('type', 'ประเภท', C.type),
        row('mask', 'Subnet mask', ipStr(m) + ' (/' + p + ')', true),
        row('wildcard', 'Wildcard mask', ipStr(wild), true),
        row('network', 'Network address', ipStr(net), true),
        row('broadcast', 'Broadcast address', bcText, true),
        row('first', 'โฮสต์แรก', ipStr(first), true),
        row('last', 'โฮสต์สุดท้าย', ipStr(last), true),
        row('hosts', 'จำนวนโฮสต์ที่ใช้ได้', fmt(hosts)),
        row('total', 'จำนวนที่อยู่ทั้งหมด', fmt(total))))),
        h('p', {class:'nlw-small'}, note),
        h('div', {class:'nlw-box'},
          h('div', {class:'nlw-small'}, 'เลขฐานสอง (', h('span', {class:'nlw-netbit'}, 'น้ำเงิน = บิตเครือข่าย ' + p + ' บิต'), ', ', h('span', {class:'nlw-hostbit'}, 'ส้ม = บิตโฮสต์ ' + (32 - p) + ' บิต'), ')'),
          h('div', null, h('span', {class:'nlw-small'}, 'IP   '), binHTML(ip, p)),
          h('div', null, h('span', {class:'nlw-small'}, 'Mask '), binHTML(m, p)),
          h('div', null, h('span', {class:'nlw-small'}, 'Net  '), binHTML(net, p))));
      if (C.cls === 'D' || C.cls === 'E') out.append(h('p', {class:'nlw-small nlw-warn'}, 'Class ' + C.cls + ' ไม่ได้ใช้แบ่ง subnet ให้เครื่องทั่วไป ผลการคำนวณแสดงเพื่อการเรียนรู้เท่านั้น'));
    }
    calc();
  }

  /* ===================================================================
     6. bandwidth-calc
     =================================================================== */
  function fmtDuration(sec){
    if (!isFinite(sec)) return '—';
    if (sec < 1) return (sec * 1000).toFixed(sec < 0.01 ? 2 : 1) + ' มิลลิวินาที';
    let t = Math.round(sec * 10) / 10;
    const d = Math.floor(t / 86400); t -= d * 86400;
    const hh = Math.floor(t / 3600); t -= hh * 3600;
    const mm = Math.floor(t / 60); t -= mm * 60;
    const ss = Math.round(t * 10) / 10;
    const parts = [];
    if (d) parts.push(d + ' วัน');
    if (hh) parts.push(hh + ' ชั่วโมง');
    if (mm) parts.push(mm + ' นาที');
    if (ss || !parts.length) parts.push((ss % 1 ? ss.toFixed(1) : ss) + ' วินาที');
    return parts.join(' ');
  }
  function bandwidthCalc(root){
    frame(root, 'คำนวณเวลาส่งไฟล์ (Bandwidth)', 'ใส่ขนาดไฟล์และความเร็วลิงก์ เลือกหน่วย แล้วปรับประสิทธิภาพจริงของลิงก์ ผลลัพธ์จะคำนวณทันที');
    const SIZEU = {KB:1e3, MB:1e6, GB:1e9, TB:1e12}, BIN = {KB:1024, MB:1048576, GB:1073741824, TB:1099511627776}, SPEEDU = {Kbps:1e3, Mbps:1e6, Gbps:1e9};
    const sizeIn = h('input', {type:'number', min:'0', step:'any', value:'700', 'data-in':'size', style:'width:110px', oninput: calc});
    const sizeU = select(Object.keys(SIZEU).map(k => [k, k]), 'MB', calc);
    const spIn = h('input', {type:'number', min:'0', step:'any', value:'100', 'data-in':'speed', style:'width:110px', oninput: calc});
    const spU = select(Object.keys(SPEEDU).map(k => [k, k]), 'Mbps', calc);
    const effIn = h('input', {type:'range', min:'50', max:'100', step:'5', value:'100', oninput: calc});
    const effOut = h('span', {class:'nlw-mono'});
    const res = h('div', {class:'nlw-result', 'aria-live':'polite'});
    const steps = h('div', {class:'nlw-box'});
    const presets = [['หนัง 4 GB ผ่าน 100 Mbps', 4, 'GB', 100, 'Mbps'], ['ไฟล์งาน 25 MB ผ่าน 10 Mbps', 25, 'MB', 10, 'Mbps'], ['ISO 6 GB ผ่าน 1 Gbps', 6, 'GB', 1, 'Gbps']];
    root.append(
      h('div', {class:'nlw-row'}, field('ขนาดไฟล์', sizeIn), field('หน่วย', sizeU), field('ความเร็วลิงก์', spIn), field('หน่วย', spU)),
      h('label', {class:'nlw-field', style:'max-width:360px'}, h('span', null, 'ประสิทธิภาพของลิงก์ (overhead/การใช้งานร่วม) ', effOut), effIn),
      h('div', {class:'nlw-row nlw-center'}, h('span', {class:'nlw-small'}, 'ตัวอย่าง:'), presets.map(p => h('button', {type:'button', class:'nlw-btn nlw-sm', onclick: () => { sizeIn.value = p[1]; sizeU.value = p[2]; spIn.value = p[3]; spU.value = p[4]; calc(); }}, p[0]))),
      res, steps,
      h('p', {class:'nlw-small'}, 'ไฟล์วัดเป็น "ไบต์" (B) แต่ความเร็วเครือข่ายวัดเป็น "บิตต่อวินาที" (bps) 1 ไบต์ = 8 บิต จึงต้องคูณขนาดไฟล์ด้วย 8 ก่อนหาร — เช่น เน็ต 100 Mbps โหลดได้สูงสุดประมาณ 12.5 MB/s'));
    function calc(){
      const size = Number(sizeIn.value), sp = Number(spIn.value), eff = Number(effIn.value) / 100;
      effOut.textContent = Math.round(eff * 100) + '%';
      const bad = !(size > 0) || !(sp > 0) || !isFinite(size) || !isFinite(sp);
      sizeIn.classList.toggle('nlw-invalid', !(size > 0)); spIn.classList.toggle('nlw-invalid', !(sp > 0));
      if (bad){ res.className = 'nlw-result nlw-is-bad'; res.textContent = 'กรุณาใส่ขนาดไฟล์และความเร็วเป็นตัวเลขมากกว่า 0'; steps.replaceChildren(); return; }
      const bytes = size * SIZEU[sizeU.value], bitsN = bytes * 8, bps = sp * SPEEDU[spU.value] * eff;
      const sec = bitsN / bps;
      const bytesBin = size * BIN[sizeU.value], secBin = bytesBin * 8 / bps;
      res.className = 'nlw-result nlw-is-ok';
      res.setAttribute('data-sec', String(sec));
      res.textContent = 'เวลาโดยประมาณ: ' + fmtDuration(sec) + (sec >= 60 ? ' (' + fmt(Math.round(sec * 10) / 10) + ' วินาที)' : '');
      const biU = sizeU.value.charAt(0) + 'iB';
      steps.replaceChildren(
        h('p', null, '1) ขนาด: ' + fmt(size) + ' ' + sizeU.value + ' = ' + fmt(bytes) + ' ไบต์ (คิดแบบ 1 ' + sizeU.value + ' = ' + fmt(SIZEU[sizeU.value]) + ' ไบต์)'),
        h('p', null, '2) แปลงเป็นบิต: ' + fmt(bytes) + ' × 8 = ', h('b', null, fmt(bitsN) + ' บิต')),
        h('p', null, '3) ความเร็วใช้งานจริง: ' + fmt(sp) + ' ' + spU.value + ' × ' + Math.round(eff * 100) + '% = ' + fmt(Math.round(bps)) + ' บิต/วินาที (≈ ' + (bps / 8 / 1e6).toFixed(2) + ' MB/s)'),
        h('p', null, '4) เวลา = ' + fmt(bitsN) + ' ÷ ' + fmt(Math.round(bps)) + ' = ', h('b', null, fmt(Math.round(sec * 1000) / 1000) + ' วินาที')),
        h('p', {class:'nlw-small'}, 'ถ้าเป็นขนาดแบบฐาน 1024 (' + fmt(size) + ' ' + biU + ' = ' + fmt(bytesBin) + ' ไบต์ ตามที่ Windows แสดงเป็น "' + sizeU.value + '") จะใช้เวลา ' + fmtDuration(secBin)));
    }
    calc();
  }

  /* ===================================================================
     7. pinout-viewer
     =================================================================== */
  const T568 = {
    A: [['wo','green','ขาวเขียว'],['s','green','เขียว'],['wo','orange','ขาวส้ม'],['s','blue','น้ำเงิน'],['wo','blue','ขาวน้ำเงิน'],['s','orange','ส้ม'],['wo','brown','ขาวน้ำตาล'],['s','brown','น้ำตาล']],
    B: [['wo','orange','ขาวส้ม'],['s','orange','ส้ม'],['wo','green','ขาวเขียว'],['s','blue','น้ำเงิน'],['wo','blue','ขาวน้ำเงิน'],['s','green','เขียว'],['wo','brown','ขาวน้ำตาล'],['s','brown','น้ำตาล']]
  };
  function pinoutViewer(root){
    frame(root, 'การเข้าสาย RJ-45 แบบ T568A / T568B', 'เลือกมาตรฐานของปลายสายทั้งสองด้าน ดูสีสายแต่ละขาและผลว่าเป็นสายตรงหรือสายไขว้');
    let e1 = 'B', e2 = 'B';
    const s1 = seg([['A','T568A'],['B','T568B']], e1, v => { e1 = v; render(); }, 'มาตรฐานปลายที่ 1');
    const s2 = seg([['A','T568A'],['B','T568B']], e2, v => { e2 = v; render(); }, 'มาตรฐานปลายที่ 2');
    const p1 = h('div', {style:'flex:1 1 200px;min-width:0'}), p2 = h('div', {style:'flex:1 1 200px;min-width:0'});
    const res = h('div', {class:'nlw-result', 'aria-live':'polite', 'data-k':'cable'});
    const tbl = h('div', {class:'nlw-scroll'});
    root.append(h('div', {class:'nlw-row'}, groupField('ปลายที่ 1', s1.el), groupField('ปลายที่ 2', s2.el)),
      h('div', {class:'nlw-row', style:'align-items:flex-start'}, p1, p2), res, tbl,
      h('p', {class:'nlw-small'}, 'มุมมองภาพ: หันด้านหน้าสัมผัสทองแดงเข้าหาตัว ปลายหัวชี้ขึ้น คลิปล็อกอยู่ด้านล่าง (ด้านหลัง) ขา 1 อยู่ซ้ายสุด · สายลายขาวแสดงเป็นแถบสลับ'));
    function plug(std, title){
      const svg = s('svg', {class:'nlw-svg', viewBox:'0 0 200 230', role:'img', 'aria-label': title + ' แบบ T568' + std + ': ' + T568[std].map((w, i) => (i + 1) + ' ' + w[2]).join(', '), style:'max-width:260px'});
      svg.append(s('text', {x:100, y:14, 'text-anchor':'middle', 'font-size':13, 'font-weight':700, fill:'var(--ink)', text: title + ' · T568' + std}));
      svg.append(s('rect', {x:14, y:22, width:172, height:140, rx:10, fill:'var(--field)', stroke:'var(--muted)', 'stroke-width':2}));
      svg.append(s('rect', {x:70, y:146, width:60, height:14, rx:4, fill:'var(--line)', stroke:'var(--muted)', 'stroke-dasharray':'3 3'}),
        s('text', {x:100, y:157, 'text-anchor':'middle', 'font-size':10, fill:'var(--muted)', text:'คลิป'}));
      svg.append(s('rect', {x:44, y:172, width:112, height:56, rx:6, fill:'var(--line)'}));
      T568[std].forEach((w, i) => {
        const x = 26 + i * 20, col = 'var(--' + w[1] + ')';
        svg.append(s('text', {x: x + 7, y:38, 'text-anchor':'middle', 'font-size':11, 'font-weight':700, fill:'var(--ink)', 'font-family':'JetBrains Mono,Consolas,monospace', text:String(i + 1)}));
        svg.append(s('rect', {x: x + 1, y:42, width:12, height:8, fill:'var(--muted)'}));
        if (w[0] === 's') svg.append(s('rect', {x, y:52, width:14, height:90, rx:3, fill:col}));
        else {
          svg.append(s('rect', {x, y:52, width:14, height:90, rx:3, fill:'var(--wo)', stroke:'var(--muted)', 'stroke-width':0.6}));
          for (let y = 56; y < 138; y += 16) svg.append(s('rect', {x: x + 0.5, y, width:13, height:8, fill:col}));
        }
      });
      return svg;
    }
    function render(){
      p1.replaceChildren(plug(e1, 'ปลายที่ 1')); p2.replaceChildren(plug(e2, 'ปลายที่ 2'));
      const same = e1 === e2;
      // physical wire mapping: the wire at end1 pin i has colour c; find pin with same colour at end2
      const key = w => w[0] + w[1];
      const map = T568[e1].map(w => T568[e2].findIndex(x => key(x) === key(w)) + 1);
      res.className = 'nlw-result ' + (same ? 'nlw-is-ok' : 'nlw-is-warn');
      res.replaceChildren(same
        ? h('span', null, 'สายตรง (Straight-through): ทั้งสองปลายใช้ T568' + e1 + ' ขาเดียวกันต่อถึงกัน 1→1 … 8→8 ใช้ต่อ PC–Switch, Router–Switch')
        : h('span', null, 'สายไขว้ (Crossover): ปลายหนึ่ง T568A อีกปลาย T568B สายคู่ส่ง/รับสลับกัน 1→' + map[0] + ', 2→' + map[1] + ', 3→' + map[2] + ', 6→' + map[5] + ' ใช้ต่ออุปกรณ์ชนิดเดียวกัน เช่น PC–PC, Switch–Switch (อุปกรณ์ใหม่ที่มี Auto MDI-X ใช้สายตรงได้)'));
      const fn100 = ['TX+ (ส่ง)','TX− (ส่ง)','RX+ (รับ)','ไม่ใช้','ไม่ใช้','RX− (รับ)','ไม่ใช้','ไม่ใช้'];
      const gig = ['BI_DA+','BI_DA−','BI_DB+','BI_DC+','BI_DC−','BI_DB−','BI_DD+','BI_DD−'];
      const sw = w => h('span', {style:'display:inline-block;width:22px;height:12px;border-radius:3px;vertical-align:middle;margin-right:6px;border:1px solid var(--muted);background:' + (w[0] === 's' ? 'var(--' + w[1] + ')' : 'repeating-linear-gradient(90deg,var(--wo) 0 4px,var(--' + w[1] + ') 4px 8px)')});
      tbl.replaceChildren(h('table', {class:'nlw-table'},
        h('thead', null, h('tr', null, h('th', null, 'ขา'), h('th', null, 'ปลาย 1 (' + e1 + ')'), h('th', null, 'ปลาย 2 (' + e2 + ')'), h('th', null, 'ไปออกขา (ปลาย 2)'), h('th', null, '10/100 Mbps'), h('th', null, 'Gigabit'))),
        h('tbody', null, T568[e1].map((w, i) => h('tr', null, h('td', {class:'nlw-mono'}, String(i + 1)), h('td', {'data-pin1': i + 1, style:'white-space:nowrap'}, sw(w), w[2]), h('td', {'data-pin2': i + 1, style:'white-space:nowrap'}, sw(T568[e2][i]), T568[e2][i][2]),
          h('td', {class:'nlw-mono'}, String(map[i])), h('td', null, fn100[i]), h('td', {class:'nlw-mono'}, gig[i]))))));
      tbl.append(h('p', {class:'nlw-small'}, '10BASE-T/100BASE-TX ใช้เพียง 2 คู่: ขา 1,2 ส่ง (TX) และขา 3,6 รับ (RX) ของฝั่ง PC ส่วน 1000BASE-T (Gigabit) ใช้ครบทั้ง 4 คู่ (1-2, 3-6, 4-5, 7-8) ส่งและรับพร้อมกันทุกคู่ · T568A กับ T568B ต่างกันเพียงสลับคู่สีส้มกับคู่สีเขียว'));
    }
    render();
  }

  /* ===================================================================
     8. wifi-security-check
     =================================================================== */
  const COMMON_PW = ['12345678','123456789','1234567890','password','password1','password123','qwerty123','qwertyuiop','qwerty12','11111111','00000000','88888888','87654321','12341234','11223344','iloveyou','admin123','abc12345','abcd1234','1q2w3e4r','wifi1234','internet','sunshine','princess','football','baseball','welcome1','letmein1','asdfghjk','zxcvbnm1','aa123456','password12'];
  function pwStrength(pw){
    const notes = []; let pts = 0;
    const len = pw.length;
    const lower = /[a-z]/.test(pw), upper = /[A-Z]/.test(pw), digit = /\d/.test(pw), sym = /[^A-Za-z0-9]/.test(pw);
    const classes = [lower, upper, digit, sym].filter(Boolean).length;
    if (len < 8) { notes.push(['bad', 'ยาว ' + len + ' ตัวอักษร: WPA2/WPA3 ต้องยาวอย่างน้อย 8 ตัว เราเตอร์จะไม่ยอมรับ']); return {pts:0, notes, label:'ใช้ไม่ได้'}; }
    if (COMMON_PW.indexOf(pw.toLowerCase()) >= 0) { notes.push(['bad', 'เป็นรหัสผ่านยอดนิยมที่อยู่ในรายการเดาของแฮกเกอร์ ถูกเดาได้ในไม่กี่วินาที']); return {pts:0, notes, label:'อ่อนมาก'}; }
    if (/^(.)\1+$/.test(pw)) { notes.push(['bad', 'เป็นตัวอักษรซ้ำกันทั้งหมด เดาง่ายมาก']); return {pts:0, notes, label:'อ่อนมาก'}; }
    const lp = len >= 16 ? 20 : len >= 12 ? 15 : 8;
    pts += lp;
    notes.push([len >= 12 ? 'ok' : 'warn', 'ความยาว ' + len + ' ตัว (+' + lp + ')' + (len < 12 ? ' แนะนำ 12 ตัวขึ้นไป' : '')]);
    const cp = Math.round(classes * 2.5);
    pts += cp;
    const miss = [];
    if (!lower) miss.push('ตัวพิมพ์เล็ก'); if (!upper) miss.push('ตัวพิมพ์ใหญ่'); if (!digit) miss.push('ตัวเลข'); if (!sym) miss.push('สัญลักษณ์');
    notes.push([classes >= 3 ? 'ok' : 'warn', 'ใช้อักขระ ' + classes + '/4 ประเภท (+' + cp + ')' + (miss.length ? ' ยังขาด: ' + miss.join(', ') : '')]);
    if (/^\d+$/.test(pw)) { pts = Math.min(pts, 5); notes.push(['bad', 'เป็นตัวเลขล้วน (เช่น วันเกิด เบอร์โทร) เดาได้ง่าย']); }
    pts = Math.min(30, pts);
    return {pts, notes, label: pts >= 25 ? 'แข็งแรง' : pts >= 15 ? 'ปานกลาง' : 'อ่อน'};
  }
  function wifiSecurityCheck(root){
    frame(root, 'ตรวจความปลอดภัยการตั้งค่า Wi-Fi', 'เลือกการตั้งค่าเราเตอร์และพิมพ์รหัสผ่าน Wi-Fi คะแนนและคำแนะนำจะเปลี่ยนทันที ลองปรับให้ได้คะแนนสูงที่สุด');
    const mode = select([['open','Open (ไม่มีรหัส)'],['wep','WEP'],['wpa2','WPA2-Personal'],['mixed','WPA2/WPA3 (ผสม)'],['wpa3','WPA3-Personal']], 'wpa2', calc);
    const pw = h('input', {type:'text', value:'12345678', autocomplete:'off', spellcheck:'false', class:'nlw-mono', 'data-in':'pw', style:'width:220px', oninput: calc});
    const admin = check('เปลี่ยนรหัสผ่านผู้ดูแล (admin) ของเราเตอร์แล้ว', false, calc);
    const wps = check('เปิดใช้ WPS', true, calc);
    const hide = check('ซ่อน SSID (Hidden SSID)', false, calc);
    const fw = check('อัปเดต Firmware เป็นรุ่นล่าสุดแล้ว', false, calc);
    const guest = check('มี Guest network แยกสำหรับผู้มาเยือน', false, calc);
    const score = h('div', {class:'nlw-score', 'data-k':'score'});
    const grade = h('div', {style:'font-weight:600'});
    const meter = h('i');
    const list = h('ul', {class:'nlw-list'});
    root.append(h('div', {class:'nlw-row'}, field('โหมดความปลอดภัย', mode), field('รหัสผ่าน Wi-Fi', pw)),
      h('div', {class:'nlw-grid2'}, h('div', null, admin.el, wps.el, hide.el), h('div', null, fw.el, guest.el)),
      h('div', {class:'nlw-box', 'aria-live':'polite'}, h('div', {class:'nlw-row nlw-center', style:'margin:0 0 6px'}, score, grade), h('div', {class:'nlw-meter'}, meter), list));
    function calc(){
      const m = mode.value, items = [];
      let sc = 0;
      const ENC = {open:[0,'bad','Open: ไม่มีการเข้ารหัส ใครก็เชื่อมต่อและดักอ่านข้อมูลได้ → เปลี่ยนเป็น WPA3 หรือ WPA2'],
        wep:[5,'bad','WEP: การเข้ารหัสแบบเก่าที่ถูกเจาะได้ภายในไม่กี่นาที → เปลี่ยนเป็น WPA2/WPA3'],
        wpa2:[30,'ok','WPA2-Personal (AES): ปลอดภัยพอใช้ ถ้าอุปกรณ์รองรับควรใช้ WPA3'],
        mixed:[33,'ok','WPA2/WPA3 ผสม: อุปกรณ์ใหม่ใช้ WPA3 อุปกรณ์เก่ายังเชื่อมต่อได้ด้วย WPA2'],
        wpa3:[40,'ok','WPA3-Personal (SAE): ปลอดภัยที่สุด ต้านการเดารหัสแบบออฟไลน์']}[m];
      sc += ENC[0]; items.push([ENC[1], ENC[2] + ' (+' + ENC[0] + ')']);
      pw.disabled = m === 'open';
      if (m !== 'open'){
        const P = pwStrength(pw.value);
        sc += P.pts;
        items.push([P.pts >= 25 ? 'ok' : P.pts >= 15 ? 'warn' : 'bad', 'รหัสผ่าน Wi-Fi: ' + P.label + ' (+' + P.pts + '/30)']);
        P.notes.forEach(n => items.push([n[0], '— ' + n[1]]));
      } else items.push(['bad', 'ไม่มีรหัสผ่าน Wi-Fi (+0/30)']);
      if (admin.input.checked){ sc += 10; items.push(['ok', 'เปลี่ยนรหัสผู้ดูแลเราเตอร์แล้ว (+10)']); }
      else items.push(['bad', 'ยังใช้รหัส admin ค่าเริ่มต้น (เช่น admin/admin) ผู้ที่เข้า Wi-Fi ได้สามารถเข้าไปแก้ค่าเราเตอร์ได้ → เปลี่ยนรหัส (+0/10)']);
      if (!wps.input.checked){ sc += 8; items.push(['ok', 'ปิด WPS แล้ว (+8)']); }
      else items.push(['bad', 'เปิด WPS: PIN 8 หลักของ WPS ถูกสุ่มเดาได้ ทำให้ได้รหัส Wi-Fi แม้รหัสจะยาก → ปิด WPS (+0/8)']);
      if (fw.input.checked){ sc += 7; items.push(['ok', 'อัปเดต Firmware แล้ว ปิดช่องโหว่ที่รู้จัก (+7)']); }
      else items.push(['warn', 'Firmware ยังไม่อัปเดต อาจมีช่องโหว่ที่ถูกโจมตีได้ → อัปเดตจากเว็บผู้ผลิต (+0/7)']);
      if (guest.input.checked){ sc += 4; items.push(['ok', 'มี Guest network แยกเครื่องแขกออกจากเครื่องในเครือข่ายหลัก (+4)']); }
      else items.push(['warn', 'ไม่มี Guest network แขกที่มาใช้ Wi-Fi จะอยู่เครือข่ายเดียวกับเครื่องและไฟล์แชร์ของเรา (+0/4)']);
      if (hide.input.checked){ sc += 1; items.push(['warn', 'ซ่อน SSID: ช่วยได้น้อยมาก (+1) เพราะชื่อเครือข่ายยังปรากฏในแพ็กเก็ตตอนอุปกรณ์เชื่อมต่อ ดักจับได้ด้วยเครื่องมือทั่วไป และอุปกรณ์ของเราต้องตะโกนหาชื่อนี้ตลอด อย่าใช้แทนรหัสผ่านที่ดี']); }
      else items.push(['muted', 'ไม่ซ่อน SSID: ไม่เป็นไร การซ่อนแทบไม่เพิ่มความปลอดภัย (ได้สูงสุด +1)']);
      let cap = null;
      if (m === 'open') cap = 15; else if (m === 'wep') cap = 25;
      if (cap !== null && sc > cap){ items.unshift(['bad', 'คะแนนถูกจำกัดไม่เกิน ' + cap + ' เพราะใช้ ' + (m === 'open' ? 'Open' : 'WEP') + ' — ตั้งค่าอื่นดีแค่ไหนก็ไม่ช่วยถ้าการเข้ารหัสอ่อน']); sc = cap; }
      sc = Math.max(0, Math.min(100, Math.round(sc)));
      const g = sc >= 90 ? ['ดีมาก', 'var(--ok)'] : sc >= 70 ? ['ดี', 'var(--green)'] : sc >= 40 ? ['พอใช้ ควรปรับปรุง', 'var(--orange)'] : ['อันตราย', 'var(--bad)'];
      score.textContent = sc + '/100'; score.style.color = g[1];
      grade.textContent = 'ระดับ: ' + g[0];
      meter.style.width = sc + '%'; meter.style.background = g[1];
      list.replaceChildren(...items.map(it => h('li', {class: it[0] === 'ok' ? 'nlw-ok' : it[0] === 'bad' ? 'nlw-bad' : it[0] === 'warn' ? 'nlw-warn' : 'nlw-small'}, (it[0] === 'ok' ? '✓ ' : it[0] === 'bad' ? '✗ ' : it[0] === 'warn' ? '! ' : '') + it[1])));
    }
    calc();
  }

  /* ===================================================================
     9. ping-ladder
     =================================================================== */
  const FAULTS = [
    ['none', 'ไม่มีปัญหา'], ['stack', 'TCP/IP stack เสีย'], ['nic', 'การ์ดแลนหรือสายหลุด'],
    ['gateway', 'Gateway ผิดหรือเราเตอร์ดับ'], ['isp', 'อินเทอร์เน็ตจากผู้ให้บริการล่ม'], ['dns', 'DNS เสีย']
  ];
  // R=reply G=general failure U=destination host unreachable T=timed out N=could not find host
  const PING_MATRIX = { none:'RRRRR', stack:'GGGGN', nic:'RGGGN', gateway:'RRUUN', isp:'RRRTN', dns:'RRRRN' };
  const PING_STEPS = [
    {cmd:'127.0.0.1', ip:'127.0.0.1', what:'ทดสอบ TCP/IP stack ภายในเครื่อง (loopback)', t:[0,0], ttl:128},
    {cmd:'192.168.1.20', ip:'192.168.1.20', what:'ทดสอบ IP ของเครื่องตัวเองและการ์ดแลน', t:[0,0], ttl:128},
    {cmd:'192.168.1.1', ip:'192.168.1.1', what:'ทดสอบการเชื่อมต่อถึง Default Gateway (เราเตอร์)', t:[1,4], ttl:64},
    {cmd:'8.8.8.8', ip:'8.8.8.8', what:'ทดสอบการออกอินเทอร์เน็ตด้วย IP (ไม่ใช้ DNS)', t:[18,30], ttl:117},
    {cmd:'www.google.com', ip:'142.250.199.4', name:true, what:'ทดสอบการแปลงชื่อด้วย DNS และเข้าเว็บด้วยชื่อ', t:[15,28], ttl:117}
  ];
  const DIAG = [
    'TCP/IP stack ในเครื่องเสีย → ลองรีเซ็ตด้วย netsh int ip reset / ติดตั้งไดรเวอร์หรือโปรโตคอลใหม่',
    'การ์ดแลนหรือสายมีปัญหา (สายหลุด/ไดรเวอร์/การ์ดถูกปิด) → ตรวจไฟที่พอร์ต เสียบสายใหม่ ตรวจ Device Manager',
    'ไปไม่ถึง Gateway → ตรวจค่า Default Gateway ใน ipconfig ว่าถูกต้อง และเราเตอร์เปิดอยู่หรือไม่',
    'ออกอินเทอร์เน็ตไม่ได้แม้ถึงเราเตอร์ → ปัญหาอยู่ฝั่งผู้ให้บริการ (ISP) หรือสายภายนอก ติดต่อ ISP',
    'ping ด้วย IP ได้แต่ด้วยชื่อไม่ได้ → DNS มีปัญหา ตรวจค่า DNS server (เช่น ตั้งเป็น 8.8.8.8) แล้ว ipconfig /flushdns'
  ];
  const DIAG_FAULT = ['stack','nic','gateway','isp','dns'];
  function pingLadder(root){
    frame(root, 'ไล่ ping หาจุดเสีย (Ping Ladder)', 'เลือกจุดที่เสีย แล้วกด ping ทีละขั้นจากล่างขึ้นบน (หรือ "ทำทั้งหมด") ดูผลลัพธ์และขั้นแรกที่ล้มเหลว · โหมดทายปัญหา: ระบบสุ่มจุดเสียให้ทาย');
    let fault = 'none', quiz = false, hidden = null, results = [null,null,null,null,null], answered = false, fbText = '', fbOk = false, guessVal = 'none';
    const faultSel = select(FAULTS, 'none', () => { fault = faultSel.value; reset(); });
    const faultField = field('จุดที่เสีย (สถานการณ์)', faultSel);
    const quizChk = check('โหมดทายปัญหา (สุ่มจุดเสียแบบซ่อน)', false, () => { quiz = quizChk.input.checked; newQuiz(); });
    const stepsBox = h('div', {class:'nlw-steps'});
    const term = h('pre', {class:'nlw-pre', 'aria-live':'polite', 'data-k':'term'}, 'กดปุ่ม ping เพื่อเริ่มทดสอบ');
    const concl = h('div', {class:'nlw-result', 'data-k':'conclusion'});
    const quizBox = h('div', {class:'nlw-box'});
    const nextBtn = h('button', {type:'button', class:'nlw-btn nlw-primary', 'data-act':'next', onclick: () => { const k = results.indexOf(null); if (k >= 0) run(k); }}, 'ทำขั้นถัดไป');
    const allBtn = h('button', {type:'button', class:'nlw-btn', 'data-act':'all', onclick: () => { let out = []; for (let k = 0; k < 5; k++) { if (results[k] === null) run(k, true); out.push(results[k].text); } term.textContent = out.join('\n\n'); }}, 'ทำทั้งหมด');
    const resetBtn = h('button', {type:'button', class:'nlw-btn', onclick: () => reset()}, 'เริ่มใหม่');
    root.append(h('div', {class:'nlw-row'}, faultField, quizChk.el), stepsBox, h('div', {class:'nlw-row nlw-center'}, nextBtn, allBtn, resetBtn), term, concl, quizBox);
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    function pingText(step, kind){
      const S = PING_STEPS[step];
      const L = ['C:\\Users\\student>ping ' + S.cmd, ''];
      if (kind === 'N'){ L.push('Ping request could not find host ' + S.cmd + '. Please check the name and try again.'); return L.join('\n'); }
      L.push('Pinging ' + (S.name ? S.cmd + ' [' + S.ip + ']' : S.ip) + ' with 32 bytes of data:');
      let recv = 0; const times = [];
      for (let k = 0; k < 4; k++){
        if (kind === 'R'){ const t = rnd(S.t[0], S.t[1]); times.push(t); recv++; L.push('Reply from ' + S.ip + ': bytes=32 ' + (t === 0 ? 'time<1ms' : 'time=' + t + 'ms') + ' TTL=' + S.ttl); }
        else if (kind === 'T') L.push('Request timed out.');
        else if (kind === 'U'){ recv++; L.push('Reply from 192.168.1.20: Destination host unreachable.'); }
        else L.push('PING: transmit failed. General failure.');
      }
      L.push('', 'Ping statistics for ' + S.ip + ':', '    Packets: Sent = 4, Received = ' + recv + ', Lost = ' + (4 - recv) + ' (' + Math.round((4 - recv) * 25) + '% loss),');
      if (kind === 'R'){ const mn = Math.min(...times), mx = Math.max(...times), av = Math.round(times.reduce((a, b) => a + b, 0) / 4);
        L.push('Approximate round trip times in milli-seconds:', '    Minimum = ' + mn + 'ms, Maximum = ' + mx + 'ms, Average = ' + av + 'ms'); }
      return L.join('\n');
    }
    const activeFault = () => quiz ? hidden : fault;
    function run(k, silent){
      const kind = PING_MATRIX[activeFault()].charAt(k);
      results[k] = {kind, pass: kind === 'R', text: pingText(k, kind)};
      if (!silent) term.textContent = results[k].text;
      render();
    }
    function reset(){ results = [null,null,null,null,null]; answered = false; fbText = ''; term.textContent = 'กดปุ่ม ping เพื่อเริ่มทดสอบ'; render(); }
    function newQuiz(){ hidden = FAULTS[Math.floor(Math.random() * FAULTS.length)][0]; faultField.style.display = quiz ? 'none' : ''; reset(); }
    function render(){
      stepsBox.replaceChildren(...PING_STEPS.map((S, k) => {
        const r = results[k];
        const st = r === null ? h('span', {class:'nlw-st nlw-small'}, 'ยังไม่ทดสอบ')
          : h('span', {class:'nlw-st ' + (r.pass ? 'nlw-ok' : 'nlw-bad')}, r.pass ? '✓ ผ่าน' : '✗ ไม่ผ่าน · ' + {G:'General failure', U:'Destination host unreachable', T:'Request timed out', N:'could not find host'}[r.kind]);
        return h('button', {type:'button', class:'nlw-btn nlw-step', 'data-step': k + 1, 'data-pass': r === null ? '' : (r.pass ? '1' : '0'), onclick: () => run(k)},
          h('span', null, h('b', null, (k + 1) + '. '), h('span', {class:'nlw-mono'}, 'ping ' + S.cmd), h('br'), h('span', {class:'nlw-small'}, S.what)), st);
      }));
      nextBtn.disabled = results.indexOf(null) < 0;
      // conclusion: walk up the ladder
      let txt = '', cls = '';
      let k = 0;
      while (k < 5 && results[k] && results[k].pass) k++;
      if (k === 5){ txt = 'ผ่านทุกขั้น: เครือข่ายปกติ ใช้งานอินเทอร์เน็ตได้'; cls = 'nlw-is-ok'; }
      else if (results[k] && !results[k].pass){ txt = 'ขั้นแรกที่ล้มเหลวคือขั้นที่ ' + (k + 1) + ' (ping ' + PING_STEPS[k].cmd + ') → ' + DIAG[k]; cls = 'nlw-is-bad'; }
      else { txt = results.some(Boolean) ? 'ยังสรุปไม่ได้ — ทดสอบขั้นที่ ' + (k + 1) + ' ต่อ (ไล่จากล่างขึ้นบน)' : 'ยังไม่ได้ทดสอบ'; cls = ''; }
      const concluded = cls !== '';
      if (quiz && !answered){ concl.className = 'nlw-result'; concl.textContent = concluded ? 'ได้ข้อมูลพอแล้ว ลองทายจุดเสียด้านล่าง (ข้อสรุปจะแสดงหลังตอบ)' : txt; concl.setAttribute('data-done', concluded ? '1' : '0'); }
      else { concl.className = 'nlw-result ' + cls; concl.textContent = txt; concl.setAttribute('data-done', concluded ? '1' : '0'); }
      quizBox.style.display = quiz ? '' : 'none';
      if (quiz){
        const guess = select(FAULTS, guessVal, () => { guessVal = guess.value; });
        const fb = h('div', {'aria-live':'polite', style:'margin-top:6px'});
        const ran = results.some(Boolean);
        const checkBtn = h('button', {type:'button', class:'nlw-btn nlw-primary', disabled: !ran || answered, onclick: () => {
          answered = true;
          const ok = guess.value === hidden;
          const ansName = FAULTS.find(f => f[0] === hidden)[1];
          const first = results.findIndex(r => r && !r.pass);
          fbOk = ok;
          fbText = (ok ? '✓ ถูกต้อง! ' : '✗ ยังไม่ถูก คำตอบคือ "' + ansName + '" ') +
            (hidden === 'none' ? 'ทุกขั้นตอบกลับปกติ' : 'ขั้นแรกที่ล้มเหลวคือขั้นที่ ' + (DIAG_FAULT.indexOf(hidden) + 1) + ' (ping ' + PING_STEPS[DIAG_FAULT.indexOf(hidden)].cmd + ')' + (first < 0 ? ' — คุณยังไม่ได้ทดสอบถึงขั้นนั้น' : ''));
          render();
          const b2 = quizBox.querySelector('[data-k="feedback"]'); if (b2) b2.focus();
        }}, 'ตรวจคำตอบ');
        fb.setAttribute('data-k', 'feedback'); fb.setAttribute('tabindex', '-1');
        if (fbText){ fb.className = fbOk ? 'nlw-ok' : 'nlw-bad'; fb.textContent = fbText; }
        quizBox.replaceChildren(h('div', {class:'nlw-row'}, field('คุณคิดว่าเสียที่ใด', guess), checkBtn,
          h('button', {type:'button', class:'nlw-btn', onclick: newQuiz}, 'สุ่มโจทย์ใหม่')), fb,
          ran ? null : h('div', {class:'nlw-small'}, 'ต้องทดสอบ ping อย่างน้อย 1 ขั้นก่อนตอบ'));
      }
    }
    newQuiz();
  }

  /* ===================================================================
     10. firewall-tester
     =================================================================== */
  function parsePortSpec(t){
    t = String(t).trim();
    if (t === '' || /^(any|\*)$/i.test(t)) return {any:true, text:'ANY'};
    const ranges = [];
    for (const part of t.split(',')){
      const m = part.trim().match(/^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/);
      if (!m) return null;
      const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
      if (a < 1 || b > 65535 || a > b) return null;
      ranges.push([a, b]);
    }
    return {any:false, ranges};
  }
  function firewallTester(root){
    frame(root, 'ทดสอบกฎไฟร์วอลล์', 'แก้ไขรายการกฎ (กฎบนสุดถูกตรวจก่อน) แล้วกรอกข้อมูลแพ็กเก็ตเพื่อดูว่ากฎข้อใดตรงเป็นข้อแรก ถ้าไม่ตรงข้อใดจะใช้นโยบายเริ่มต้น');
    let rules = [], uid = 0;
    const R = (dir, proto, port, src, action, name) => ({id: ++uid, dir, proto, port, src, action, name: name || ''});
    const PRESETS = {
      web: {name:'เว็บเซิร์ฟเวอร์', defIn:'block', defOut:'allow', rules:[R('in','TCP','80','ANY','allow','HTTP'), R('in','TCP','443','ANY','allow','HTTPS'), R('in','TCP','22','192.168.20.0/24','allow','SSH จากห้องแล็บ')], pkt:['in','TCP','80','203.0.113.50']},
      ftp: {name:'บล็อก FTP ขาออก', defIn:'block', defOut:'allow', rules:[R('out','TCP','20-21','ANY','block','FTP')], pkt:['out','TCP','21','198.51.100.7']},
      rdp: {name:'อนุญาต RDP เฉพาะเครื่องครู', defIn:'block', defOut:'allow', rules:[R('in','TCP','3389','192.168.20.5','allow','RDP เครื่องครู'), R('in','TCP','3389','ANY','block','RDP อื่น ๆ')], pkt:['in','TCP','3389','192.168.20.31']}
    };
    const defIn = select([['block','Block (ค่าเริ่มต้น Windows)'],['allow','Allow']], 'block', test);
    const defOut = select([['allow','Allow (ค่าเริ่มต้น Windows)'],['block','Block']], 'allow', test);
    const list = h('div', {'data-k':'rules'});
    const pDir = select([['in','ขาเข้า (Inbound)'],['out','ขาออก (Outbound)']], 'in', test);
    const pProto = select([['TCP','TCP'],['UDP','UDP']], 'TCP', test);
    const pPort = h('input', {type:'text', value:'80', inputmode:'numeric', class:'nlw-mono', style:'width:90px', 'data-in':'pport', oninput: test});
    const pIP = h('input', {type:'text', value:'203.0.113.50', class:'nlw-mono', style:'width:150px', 'data-in':'pip', oninput: test});
    const res = h('div', {class:'nlw-result', 'aria-live':'polite', 'data-k':'result'});
    const trace = h('ol', {class:'nlw-list nlw-small'});
    root.append(
      h('div', {class:'nlw-row nlw-center'}, h('span', {class:'nlw-small'}, 'ตัวอย่าง:'), Object.keys(PRESETS).map(k => h('button', {type:'button', class:'nlw-btn nlw-sm', 'data-preset':k, onclick: () => load(k)}, PRESETS[k].name))),
      h('div', {class:'nlw-row'}, field('นโยบายเริ่มต้นขาเข้า', defIn), field('นโยบายเริ่มต้นขาออก', defOut)),
      h('div', {class:'nlw-small', style:'margin-top:8px'}, 'กฎ (ช่อง IP = เครื่องฝั่งตรงข้าม: ขาเข้าคือ IP ต้นทาง ขาออกคือ IP ปลายทาง ใส่ ANY หรือ 192.168.20.0/24 ได้ · พอร์ตใส่ ANY, 80, 20-21 หรือ 80,443)'),
      list,
      h('button', {type:'button', class:'nlw-btn', 'data-act':'add', onclick: () => { rules.push(R('in','TCP','ANY','ANY','allow')); renderRules(); test(); const ins = list.querySelectorAll('.nlw-rule'); const last = ins[ins.length - 1]; if (last) last.querySelector('select').focus(); }}, '+ เพิ่มกฎ'),
      h('div', {class:'nlw-box'}, h('b', null, 'ทดสอบแพ็กเก็ต'),
        h('div', {class:'nlw-row'}, field('ทิศทาง', pDir), field('โปรโตคอล', pProto), field('พอร์ตปลายทาง', pPort), field('IP เครื่องฝั่งตรงข้าม', pIP),
          h('button', {type:'button', class:'nlw-btn nlw-primary', 'data-act':'test', onclick: test}, 'ทดสอบ')),
        res, trace));
    function ruleValid(r){ return parsePortSpec(r.port) && parseIPSpec(r.src); }
    function renderRules(focusSel){
      list.replaceChildren();
      if (!rules.length) list.append(h('p', {class:'nlw-small'}, 'ยังไม่มีกฎ — ทุกแพ็กเก็ตจะใช้นโยบายเริ่มต้น'));
      rules.forEach((r, i) => {
        const upd = (k, el) => () => { r[k] = el.value; row.classList.toggle('nlw-badrule', !ruleValid(r)); el.classList.toggle('nlw-invalid', (k === 'port' && !parsePortSpec(r.port)) || (k === 'src' && !parseIPSpec(r.src))); test(); };
        const dir = select([['in','In'],['out','Out']], r.dir, null); dir.addEventListener('change', upd('dir', dir));
        const proto = select([['TCP','TCP'],['UDP','UDP'],['ANY','ANY']], r.proto, null); proto.addEventListener('change', upd('proto', proto));
        const port = h('input', {type:'text', value:r.port, class:'nlw-mono nlw-port', 'aria-label':'พอร์ตของกฎข้อ ' + (i + 1)}); port.addEventListener('input', upd('port', port));
        const src = h('input', {type:'text', value:r.src, class:'nlw-mono', 'aria-label':'IP ของกฎข้อ ' + (i + 1)}); src.addEventListener('input', upd('src', src));
        const act = select([['allow','Allow'],['block','Block']], r.action, null); act.addEventListener('change', upd('action', act));
        dir.setAttribute('aria-label', 'ทิศทางของกฎข้อ ' + (i + 1)); proto.setAttribute('aria-label', 'โปรโตคอลของกฎข้อ ' + (i + 1)); act.setAttribute('aria-label', 'การกระทำของกฎข้อ ' + (i + 1));
        const mv = (d, tag) => h('button', {type:'button', class:'nlw-btn nlw-sm', 'data-mv':tag, 'aria-label': (d < 0 ? 'เลื่อนขึ้น' : 'เลื่อนลง') + ' กฎข้อ ' + (i + 1), disabled: (d < 0 && i === 0) || (d > 0 && i === rules.length - 1),
          onclick: () => { const j = i + d; [rules[i], rules[j]] = [rules[j], rules[i]]; renderRules({id:r.id, tag}); test(); }}, d < 0 ? '↑' : '↓');
        const del = h('button', {type:'button', class:'nlw-btn nlw-sm', 'aria-label':'ลบกฎข้อ ' + (i + 1), onclick: () => { rules.splice(i, 1); renderRules(); test(); }}, '✕');
        const row = h('div', {class:'nlw-rule' + (ruleValid(r) ? '' : ' nlw-badrule'), 'data-rule': i + 1},
          h('span', {class:'nlw-num'}, (i + 1) + '.'), dir, proto, port, src, act, r.name ? h('span', {class:'nlw-small'}, r.name) : null,
          h('span', {style:'margin-left:auto;display:flex;gap:4px'}, mv(-1, 'up'), mv(1, 'down'), del));
        list.append(row);
        if (focusSel && focusSel.id === r.id){ const b = row.querySelector('[data-mv="' + focusSel.tag + '"]'); (b && !b.disabled ? b : row.querySelector('[data-mv]:not([disabled])')).focus(); }
      });
    }
    function load(k){
      const P = PRESETS[k];
      rules = P.rules.map(r => Object.assign({}, r, {id: ++uid}));
      defIn.value = P.defIn; defOut.value = P.defOut;
      pDir.value = P.pkt[0]; pProto.value = P.pkt[1]; pPort.value = P.pkt[2]; pIP.value = P.pkt[3];
      renderRules(); test();
    }
    function test(){
      const port = Number(pPort.value), ip = parseIP(pIP.value);
      const portOk = /^\d{1,5}$/.test(pPort.value.trim()) && port >= 1 && port <= 65535;
      pPort.classList.toggle('nlw-invalid', !portOk); pIP.classList.toggle('nlw-invalid', ip === null);
      list.querySelectorAll('.nlw-rule').forEach(el => el.classList.remove('nlw-hit'));
      trace.replaceChildren();
      if (!portOk || ip === null){ res.className = 'nlw-result nlw-is-bad'; res.textContent = 'ข้อมูลแพ็กเก็ตไม่ถูกต้อง: พอร์ต 1–65535 และ IP เช่น 192.168.20.5'; res.removeAttribute('data-action'); return; }
      const dir = pDir.value, proto = pProto.value;
      let hit = -1;
      for (let i = 0; i < rules.length; i++){
        const r = rules[i], ps = parsePortSpec(r.port), is = parseIPSpec(r.src);
        let why = '';
        if (!ps || !is) why = 'ข้ามไป: กฎเขียนไม่ถูกต้อง';
        else if (r.dir !== dir) why = 'ทิศทางไม่ตรง';
        else if (r.proto !== 'ANY' && r.proto !== proto) why = 'โปรโตคอลไม่ตรง';
        else if (!ps.any && !ps.ranges.some(g => port >= g[0] && port <= g[1])) why = 'พอร์ตไม่ตรง';
        else if (!ipMatch(is, ip)) why = 'IP ไม่อยู่ในช่วง ' + r.src;
        if (why){ trace.append(h('li', null, 'กฎข้อ ' + (i + 1) + ': ไม่ตรง (' + why + ')')); continue; }
        hit = i; trace.append(h('li', {class:'nlw-ok', style:'font-weight:600'}, 'กฎข้อ ' + (i + 1) + ': ตรงทุกเงื่อนไข → หยุดตรวจ (first match wins)')); break;
      }
      let action, text;
      if (hit >= 0){
        action = rules[hit].action;
        const row = list.querySelector('[data-rule="' + (hit + 1) + '"]'); if (row) row.classList.add('nlw-hit');
        text = 'ตรงกับกฎข้อ ' + (hit + 1) + (rules[hit].name ? ' (' + rules[hit].name + ')' : '') + ' → ' + (action === 'allow' ? 'อนุญาต (Allow)' : 'ปิดกั้น (Block)');
      } else {
        action = dir === 'in' ? defIn.value : defOut.value;
        text = 'ไม่ตรงกับกฎข้อใด → ใช้นโยบายเริ่มต้น' + (dir === 'in' ? 'ขาเข้า' : 'ขาออก') + ': ' + (action === 'allow' ? 'อนุญาต (Allow)' : 'ปิดกั้น (Block)');
      }
      res.className = 'nlw-result ' + (action === 'allow' ? 'nlw-is-ok' : 'nlw-is-bad');
      res.setAttribute('data-action', action); res.setAttribute('data-rule', hit >= 0 ? String(hit + 1) : 'default');
      res.textContent = (dir === 'in' ? 'ขาเข้า ' : 'ขาออก ') + proto + ' พอร์ต ' + port + ' (' + ipStr(ip) + '): ' + text;
    }
    load('web');
  }

  /* ===================================================================
     11. caesar
     =================================================================== */
  function caesarShift(text, k){
    k = ((k % 26) + 26) % 26;
    return text.replace(/[A-Za-z]/g, c => { const base = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - base + k) % 26 + base); });
  }
  function caesar(root){
    frame(root, 'รหัสซีซาร์ (Caesar Cipher)', 'พิมพ์ข้อความภาษาอังกฤษ เลือกเข้ารหัสหรือถอดรหัส แล้วเลื่อนแถบเพื่อเปลี่ยนค่ากุญแจ (shift) ผลลัพธ์จะแสดงทันที');
    let mode = 'enc';
    const txt = h('textarea', {rows:2, 'data-in':'text', oninput: calc}); txt.value = 'NETWORK';
    const shift = h('input', {type:'range', min:'0', max:'25', step:'1', value:'3', 'data-in':'shift', oninput: calc});
    const shiftOut = h('b', {class:'nlw-mono'});
    const modeSeg = seg([['enc','เข้ารหัส (Encrypt)'],['dec','ถอดรหัส (Decrypt)']], mode, v => { mode = v; calc(); }, 'โหมด');
    const out = h('div', {class:'nlw-result nlw-mono', 'aria-live':'polite', 'data-k':'output', style:'white-space:pre-wrap;word-break:break-word'});
    const alpha = h('div', {class:'nlw-alpha', role:'group', 'aria-label':'ตารางเทียบตัวอักษร'});
    const brute = h('div');
    root.append(field('ข้อความ', txt), modeSeg.el,
      h('label', {class:'nlw-field', style:'max-width:420px;margin-top:8px'}, h('span', null, 'ค่ากุญแจ (shift) = ', shiftOut), shift),
      h('div', {class:'nlw-small'}, 'ผลลัพธ์'), out, alpha,
      h('button', {type:'button', class:'nlw-btn', 'data-act':'brute', onclick: bruteForce}, 'ลองทุกกุญแจ (Brute force)'), brute,
      h('p', {class:'nlw-small'}, 'เปลี่ยนเฉพาะ A–Z และ a–z อักขระอื่น (ตัวเลข ช่องว่าง ภาษาไทย) คงเดิม'));
    function calc(){
      const k = Number(shift.value);
      shiftOut.textContent = String(k);
      const eff = mode === 'enc' ? k : -k;
      out.textContent = caesarShift(txt.value, eff) || ' ';
      const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const top = A.split(''), bot = caesarShift(A, eff).split('');
      alpha.replaceChildren(
        h('div', {class:'nlw-small'}, 'แถวบน = ' + (mode === 'enc' ? 'ต้นฉบับ (plaintext)' : 'ข้อความรหัส (ciphertext)') + ' · แถวล่าง = ' + (mode === 'enc' ? 'ข้อความรหัส' : 'ต้นฉบับ')),
        h('div', {class:'nlw-amap'}, top.map((c, i) => h('span', {'aria-label': c + ' เป็น ' + bot[i]}, h('i', null, c), h('b', null, bot[i])))));
      if (brute.childNodes.length) bruteForce();
    }
    function bruteForce(){
      const t = txt.value;
      brute.replaceChildren(h('div', {class:'nlw-small', style:'margin-top:8px'}, 'ถอดรหัสด้วยทุกกุญแจ 1–25 — มีเพียง 25 แบบ ผู้โจมตีลองครบได้ในพริบตา แล้วเลือกบรรทัดที่อ่านออก นี่คือเหตุผลที่ Caesar ไม่ปลอดภัย'),
        h('div', {class:'nlw-pre', 'data-k':'brute'}, Array.from({length:25}, (_, i) => 'shift ' + String(i + 1).padStart(2, ' ') + ': ' + caesarShift(t, -(i + 1))).join('\n')));
    }
    calc();
  }

  /* ===================================================================
     12. perm-calc
     =================================================================== */
  function permCalc(root){
    frame(root, 'คำนวณสิทธิ์ไฟล์ Linux (chmod)', 'ติ๊กช่อง r w x หรือพิมพ์เลขฐานแปด (เช่น 750) หรือข้อความสิทธิ์ (เช่น rwxr-x---) ค่าอื่นจะเปลี่ยนตามทันที');
    let bits = [true,true,true, true,false,true, false,false,false];
    const WHO = [['owner','เจ้าของ (u)'],['group','กลุ่ม (g)'],['others','คนอื่น (o)']], RWX = ['r','w','x'];
    const boxes = [];
    const tbody = h('tbody');
    WHO.forEach((w, i) => {
      const tr = h('tr', null, h('th', {scope:'row'}, w[1]));
      RWX.forEach((p, j) => {
        const cb = h('input', {type:'checkbox', 'data-bit': w[0] + '-' + p, 'aria-label': w[1] + ' สิทธิ์ ' + p, onchange: () => { bits[i * 3 + j] = cb.checked; sync('box'); }});
        boxes.push(cb);
        tr.append(h('td', null, h('label', null, cb)));
      });
      tr.append(h('td', {class:'nlw-mono', 'data-digit': i}));
      tbody.append(tr);
    });
    const octIn = h('input', {type:'text', inputmode:'numeric', maxlength:'4', class:'nlw-mono nlw-big', style:'width:90px', 'data-in':'octal', oninput: () => fromOct()});
    const symIn = h('input', {type:'text', maxlength:'10', class:'nlw-mono nlw-big', style:'width:150px', spellcheck:'false', 'data-in':'symbolic', oninput: () => fromSym()});
    const cmd = h('div', {class:'nlw-pre', 'data-k':'cmd', style:'font-size:15px'});
    const msg = h('div', {class:'nlw-small', 'aria-live':'polite'});
    const desc = h('ul', {class:'nlw-list'});
    root.append(
      h('div', {class:'nlw-scroll'}, h('table', {class:'nlw-table nlw-perm', style:'max-width:420px'},
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'r (4)'), h('th', null, 'w (2)'), h('th', null, 'x (1)'), h('th', null, 'รวม'))), tbody)),
      h('div', {class:'nlw-row'}, field('เลขฐานแปด', octIn), field('แบบตัวอักษร (ls -l)', symIn)), msg,
      h('div', {class:'nlw-row nlw-center'}, h('span', {class:'nlw-small'}, 'ค่าที่ใช้บ่อย:'), ['644','755','700','600','750'].map(v => h('button', {type:'button', class:'nlw-btn nlw-sm', 'data-preset':v, onclick: () => { setOct(v); sync('preset'); }}, v))),
      cmd, desc,
      h('div', {class:'nlw-box'}, h('p', null, 'r (read) = 4, w (write) = 2, x (execute) = 1 นำมาบวกกันแต่ละกลุ่ม เช่น rwx = 4+2+1 = 7, r-x = 4+1 = 5, --- = 0'),
        h('p', null, 'สำหรับ "ไดเรกทอรี": r = ดูรายชื่อไฟล์ข้างใน, w = สร้าง/ลบ/เปลี่ยนชื่อไฟล์ข้างใน, x = เข้าไปในไดเรกทอรี (cd) และเข้าถึงไฟล์ข้างในได้ — ไม่มี x จะเข้าใช้งานไม่ได้แม้มี r')));
    function setOct(v){ const d = v.slice(-3).split('').map(Number); bits = []; d.forEach(n => { bits.push(!!(n & 4), !!(n & 2), !!(n & 1)); }); }
    const octStr = () => [0,1,2].map(i => (bits[i*3] ? 4 : 0) + (bits[i*3+1] ? 2 : 0) + (bits[i*3+2] ? 1 : 0)).join('');
    const symStr = () => bits.map((b, k) => b ? RWX[k % 3] : '-').join('');
    function fromOct(){
      const v = octIn.value.trim();
      if (/^0?[0-7]{3}$/.test(v)){ setOct(v); octIn.classList.remove('nlw-invalid'); sync('oct'); }
      else { octIn.classList.add('nlw-invalid'); msg.className = 'nlw-small nlw-bad'; msg.textContent = 'เลขฐานแปดต้องมี 3 หลัก แต่ละหลัก 0–7 เช่น 750'; }
    }
    function fromSym(){
      let v = symIn.value.trim();
      if (v.length === 10 && /^[-dl]/.test(v)) v = v.slice(1);
      if (/^([r-][w-][x-]){3}$/.test(v)){ bits = v.split('').map(c => c !== '-'); symIn.classList.remove('nlw-invalid'); sync('sym'); }
      else { symIn.classList.add('nlw-invalid'); msg.className = 'nlw-small nlw-bad'; msg.textContent = 'ข้อความสิทธิ์ต้องมี 9 ตัว เรียง rwx สามชุด ใช้ - แทนสิทธิ์ที่ไม่มี เช่น rwxr-x---'; }
    }
    function sync(from){
      msg.className = 'nlw-small'; msg.textContent = '';
      const o = octStr(), sy = symStr();
      boxes.forEach((b, k) => b.checked = bits[k]);
      tbody.querySelectorAll('[data-digit]').forEach((td, i) => td.textContent = o.charAt(i));
      if (from !== 'oct') { octIn.value = o; octIn.classList.remove('nlw-invalid'); }
      if (from !== 'sym') { symIn.value = sy; symIn.classList.remove('nlw-invalid'); }
      cmd.textContent = '$ chmod ' + o + ' file\n$ ls -l file\n-' + sy + ' 1 student student 1024 Oct  8 09:00 file';
      const words = k => { const p = []; if (bits[k]) p.push('อ่าน'); if (bits[k+1]) p.push('เขียน'); if (bits[k+2]) p.push('รัน'); return p.length ? p.join(' ') : 'ไม่มีสิทธิ์'; };
      desc.replaceChildren(...WHO.map((w, i) => h('li', null, h('b', null, w[1] + ' = ' + o.charAt(i) + ' (' + sy.substr(i * 3, 3) + '): '), words(i * 3))));
    }
    sync('init');
  }

  /* ===================================================================
     13. port-lookup
     =================================================================== */
  const PORTS = [
    [20,'TCP','FTP (data)','ส่งข้อมูลไฟล์ของ FTP','bad'],
    [21,'TCP','FTP (control)','โอนย้ายไฟล์ ส่งคำสั่งและรหัสผ่านแบบไม่เข้ารหัส → ใช้ SFTP (22) หรือ FTPS แทน','bad'],
    [22,'TCP','SSH / SFTP','เข้าควบคุมเครื่องระยะไกลและโอนไฟล์แบบเข้ารหัส','ok'],
    [23,'TCP','Telnet','เข้าควบคุมเครื่องระยะไกล ส่งทุกอย่างรวมถึงรหัสผ่านเป็นข้อความธรรมดา (plaintext) → ใช้ SSH แทน','bad'],
    [25,'TCP','SMTP','ส่งอีเมลระหว่างเมลเซิร์ฟเวอร์ (ค่าเดิมไม่เข้ารหัส)','warn'],
    [53,'UDP/TCP','DNS','แปลงชื่อโดเมนเป็น IP Address (ถามตอบทั่วไปใช้ UDP, คำตอบใหญ่/zone transfer ใช้ TCP)',null],
    [67,'UDP','DHCP (server)','เซิร์ฟเวอร์แจก IP Address อัตโนมัติ',null],
    [68,'UDP','DHCP (client)','เครื่องลูกข่ายรับ IP Address จาก DHCP',null],
    [69,'UDP','TFTP','โอนไฟล์แบบง่าย ไม่มีการยืนยันตัวตน ใช้บูตเครื่อง/อัปโหลด config อุปกรณ์','bad'],
    [80,'TCP','HTTP','เว็บแบบไม่เข้ารหัส ข้อมูลถูกดักอ่านได้','bad'],
    [110,'TCP','POP3','ดึงอีเมลมาเก็บที่เครื่อง (ไม่เข้ารหัส)','bad'],
    [123,'UDP','NTP','ตั้งเวลานาฬิกาให้ตรงกันทั้งเครือข่าย',null],
    [143,'TCP','IMAP','อ่านอีเมลบนเซิร์ฟเวอร์ (ไม่เข้ารหัส)','bad'],
    [161,'UDP','SNMP','ตรวจสอบและจัดการอุปกรณ์เครือข่าย (v1/v2c ส่ง community string แบบไม่เข้ารหัส ควรใช้ v3)','warn'],
    [389,'TCP/UDP','LDAP','บริการไดเรกทอรี ค้นหาผู้ใช้/กลุ่ม เช่น Active Directory (แบบเข้ารหัสคือ LDAPS 636)','warn'],
    [443,'TCP','HTTPS','เว็บแบบเข้ารหัสด้วย TLS (HTTP/3 ใช้ UDP 443)','ok'],
    [445,'TCP','SMB','แชร์ไฟล์และเครื่องพิมพ์ใน Windows ไม่ควรเปิดออกอินเทอร์เน็ต (เป้าหมายของ ransomware)','warn'],
    [587,'TCP','SMTP submission','โปรแกรมอีเมลส่งเมลขึ้นเซิร์ฟเวอร์ พร้อมยืนยันตัวตนและเข้ารหัสด้วย STARTTLS','ok'],
    [993,'TCP','IMAPS','IMAP แบบเข้ารหัส TLS','ok'],
    [995,'TCP','POP3S','POP3 แบบเข้ารหัส TLS','ok'],
    [3306,'TCP','MySQL','ฐานข้อมูล MySQL/MariaDB ไม่ควรเปิดให้เข้าจากอินเทอร์เน็ตโดยตรง','warn'],
    [3389,'TCP','RDP','Remote Desktop ของ Windows (ใช้ UDP 3389 ร่วมด้วย) ไม่ควรเปิดออกอินเทอร์เน็ต ควรผ่าน VPN','warn']
  ];
  function portLookup(root){
    frame(root, 'ค้นหาหมายเลขพอร์ต', 'พิมพ์หมายเลขพอร์ตหรือชื่อบริการ (เช่น 443, ssh, อีเมล) รายการจะกรองทันทีขณะพิมพ์');
    const q = h('input', {type:'search', placeholder:'เช่น 22 หรือ DNS', autocomplete:'off', 'data-in':'q', style:'width:100%;max-width:320px', oninput: render});
    const count = h('div', {class:'nlw-small', 'aria-live':'polite'});
    const tbody = h('tbody');
    root.append(field('ค้นหา', q), count,
      h('div', {class:'nlw-scroll'}, h('table', {class:'nlw-table'}, h('thead', null, h('tr', null, h('th', null, 'พอร์ต'), h('th', null, 'โปรโตคอล'), h('th', null, 'บริการ / คำอธิบาย'))), tbody)),
      h('div', {class:'nlw-box'}, h('span', {class:'nlw-tag nlw-ok'}, 'เข้ารหัส'), ' ปลอดภัยกว่า · ', h('span', {class:'nlw-tag nlw-bad'}, 'ไม่เข้ารหัส'), ' ข้อมูลเป็น plaintext ดักอ่านได้ · ', h('span', {class:'nlw-tag nlw-warn'}, 'ระวัง'), ' ใช้ได้แต่ต้องตั้งค่า/จำกัดการเข้าถึง',
        h('p', null, 'Telnet (23) และ FTP (20/21) ส่งชื่อผู้ใช้และรหัสผ่านเป็นข้อความธรรมดา ผู้ที่ดักจับแพ็กเก็ต (เช่นด้วย Wireshark) อ่านได้ทันที ควรใช้ SSH (22) และ SFTP/FTPS แทน')));
    function render(){
      const t = q.value.trim().toLowerCase();
      const rows = PORTS.filter(p => !t || String(p[0]).indexOf(t) >= 0 || (p[2] + ' ' + p[3] + ' ' + p[1]).toLowerCase().indexOf(t) >= 0);
      count.textContent = 'พบ ' + rows.length + ' จาก ' + PORTS.length + ' รายการ';
      tbody.replaceChildren(...(rows.length ? rows.map(p => h('tr', {'data-port': p[0]},
        h('td', {class:'nlw-mono', style:'font-weight:700'}, String(p[0])), h('td', {class:'nlw-mono'}, p[1]),
        h('td', null, h('b', null, p[2]), p[4] ? h('span', {class:'nlw-tag nlw-' + p[4]}, {ok:'เข้ารหัส', bad:'ไม่เข้ารหัส', warn:'ระวัง'}[p[4]]) : null, h('br'), h('span', {class:'nlw-small'}, p[3]))))
        : [h('tr', null, h('td', {colspan:3, class:'nlw-small'}, 'ไม่พบพอร์ตที่ตรงกับ "' + q.value + '"'))]));
    }
    render();
  }

  window.NL_WIDGETS = {
    'topology-sim': topologySim,
    'hub-switch-sim': hubSwitchSim,
    'osi-explorer': osiExplorer,
    'encap-stepper': encapStepper,
    'ip-calc': ipCalc,
    'bandwidth-calc': bandwidthCalc,
    'pinout-viewer': pinoutViewer,
    'wifi-security-check': wifiSecurityCheck,
    'ping-ladder': pingLadder,
    'firewall-tester': firewallTester,
    'caesar': caesar,
    'perm-calc': permCalc,
    'port-lookup': portLookup
  };
})();
