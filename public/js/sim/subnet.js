'use strict';
// Subnetting Simulator — browser module (docs/SIM-SPEC.md §1 and §4.2)
// Problems come from the server (signed); the browser never receives answers. After grading, the
// step-by-step solution is computed here from the problem itself.
(function () {
  const CSS = `
.nls-subnet{--nls-mono:"JetBrains Mono",Consolas,monospace;color:var(--ink);font-family:inherit;max-width:100%;min-width:0;container-type:inline-size;container-name:nlsroot}
.nls-subnet *{box-sizing:border-box}
.nls-subnet button,.nls-subnet input,.nls-subnet select{font:inherit;color:inherit}
.nls-subnet-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-bottom:12px}
.nls-subnet-head h2{margin:0;font-size:1.3em;line-height:1.3;flex:1 1 220px}
.nls-subnet-tabs{display:flex;gap:4px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:4px;flex:1 1 320px;max-width:520px}
.nls-subnet-tab{flex:1;border:0;background:transparent;border-radius:8px;padding:9px 8px;font-weight:600;color:var(--muted);cursor:pointer;min-height:44px}
.nls-subnet-tab[aria-selected="true"]{background:var(--ink);color:var(--bg)}
.nls-subnet-box{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:14px;min-width:0}
.nls-subnet-help summary{cursor:pointer;font-weight:600;min-height:32px;display:flex;align-items:center}
.nls-subnet-help ol{margin:8px 0 0;padding-left:22px;font-size:.93em}
.nls-subnet-help li{margin:3px 0}
.nls-subnet-grid{display:grid;grid-template-columns:minmax(220px,280px) minmax(0,1fr);gap:14px;align-items:start}
.nls-subnet-missions{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.nls-subnet-mbtn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--line);border-radius:10px;padding:9px 12px;cursor:pointer;min-height:44px}
.nls-subnet-mbtn[data-level="easy"]{border-left-color:var(--green)}
.nls-subnet-mbtn[data-level="medium"]{border-left-color:var(--orange)}
.nls-subnet-mbtn[data-level="hard"]{border-left-color:var(--bad)}
.nls-subnet-mbtn[aria-current="true"]{outline:2px solid var(--blue);outline-offset:-1px;background:var(--field)}
.nls-subnet-mbtn b{font-size:.95em;line-height:1.35}
.nls-subnet-mstat{font-size:.8em;color:var(--muted)}
.nls-subnet-mstat.full{color:var(--ok);font-weight:600}
.nls-subnet-lv{display:inline-block;font-size:.75em;font-weight:700;border-radius:4px;padding:0 6px;border:1px solid currentColor;margin-right:6px;vertical-align:1px}
.nls-subnet-lv.easy{color:var(--green)}.nls-subnet-lv.medium{color:var(--orange)}.nls-subnet-lv.hard{color:var(--bad)}
.nls-subnet-mtitle{margin:0 0 4px;font-size:1.1em;line-height:1.4}
.nls-subnet-desc{margin:0 0 10px;color:var(--muted);font-size:.93em}
.nls-subnet-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-subnet-btn{background:var(--ink);color:var(--bg);border:0;border-radius:8px;padding:10px 16px;font-weight:600;cursor:pointer;min-height:44px}
.nls-subnet-btn.go{background:var(--green);color:var(--on-accent,#fff)}
.nls-subnet-btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.nls-subnet-btn:disabled{opacity:.5;cursor:default}
.nls-subnet-btn:focus-visible,.nls-subnet-tab:focus-visible,.nls-subnet-mbtn:focus-visible,.nls-subnet-bit:focus-visible,.nls-subnet input:focus-visible,.nls-subnet select:focus-visible,.nls-subnet summary:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-subnet-hints{margin:10px 0 0;padding-left:22px;font-size:.93em}
.nls-subnet-hints li{margin:4px 0;background:var(--field);border-radius:6px;padding:4px 8px}
.nls-subnet-q{background:var(--field);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:12px 0}
.nls-subnet-q p{margin:0 0 6px}
.nls-subnet-big{font-family:var(--nls-mono);font-size:1.25em;font-weight:700;word-break:break-all;color:var(--blue)}
.nls-subnet-mono{font-family:var(--nls-mono)}
.nls-subnet-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px 14px;margin:12px 0}
.nls-subnet-f{display:flex;flex-direction:column;gap:4px;min-width:0}
.nls-subnet-f span{font-size:.88em;font-weight:600}
.nls-subnet-f input,.nls-subnet-f select{width:100%;min-width:0;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:9px 10px;font-family:var(--nls-mono);font-size:15px;min-height:44px}
.nls-subnet-f select{font-family:inherit}
.nls-subnet-f.ok input,.nls-subnet-f.ok select{border:2px solid var(--ok)}
.nls-subnet-f.bad input,.nls-subnet-f.bad select{border:2px solid var(--bad)}
.nls-subnet-f .nls-subnet-mark{font-size:.8em;font-weight:700}
.nls-subnet-f.ok .nls-subnet-mark{color:var(--ok)}.nls-subnet-f.bad .nls-subnet-mark{color:var(--bad)}
.nls-subnet-vrow{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel)}
.nls-subnet-vrow h4{margin:0 0 6px;font-size:.95em}
.nls-subnet-vrow .nls-subnet-fields{margin:0;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.nls-subnet-vlist{display:grid;gap:10px;margin:12px 0}
.nls-subnet-msg{margin:8px 0 0;font-size:.93em}
.nls-subnet-msg.err{color:var(--bad);font-weight:600}
.nls-subnet-result{border:2px solid var(--line);border-radius:12px;padding:12px 14px;margin:12px 0}
.nls-subnet-result.full{border-color:var(--ok)}.nls-subnet-result.part{border-color:var(--orange)}.nls-subnet-result.zero{border-color:var(--bad)}
.nls-subnet-score{font-size:1.5em;font-weight:800;margin:0}
.nls-subnet-result ul{margin:6px 0 0;padding-left:20px;font-size:.93em}
.nls-subnet-result li{margin:3px 0}
.nls-subnet-sol>summary{cursor:pointer;font-weight:700;font-size:1.05em;min-height:40px;display:flex;align-items:center}
.nls-subnet-steps{list-style:none;margin:8px 0 0;padding:0;counter-reset:st}
.nls-subnet-steps>li{position:relative;padding:0;border-top:1px dashed var(--line);counter-increment:st;min-width:0}
.nls-subnet-stepd>summary{list-style:none;display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 0;min-height:44px;border-radius:8px;touch-action:manipulation}
.nls-subnet-stepd>summary::-webkit-details-marker{display:none}
.nls-subnet-stepd>summary,.nls-subnet-sol>summary,.nls-subnet-help summary{-webkit-tap-highlight-color:transparent}
.nls-subnet-stepd>summary:active{background:var(--field)}
.nls-subnet-stepd>summary::before{content:counter(st);flex:0 0 28px;width:28px;height:28px;border-radius:50%;background:var(--blue);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:.9em}
.nls-subnet-stepd>summary::after{content:"";flex:0 0 auto;margin-left:auto;width:9px;height:9px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:translateY(-2px) rotate(45deg);transition:transform .15s}
.nls-subnet-stepd[open]>summary::after{transform:translateY(2px) rotate(-135deg)}
.nls-subnet-stepd>summary h4{margin:0;font-size:1em;flex:1 1 auto;min-width:0}
.nls-subnet-stepb{padding:0 0 10px 38px;min-width:0}
.nls-subnet-steps p{margin:4px 0}
.nls-subnet-stepbar{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0}
.nls-subnet-stepbar .nls-subnet-btn{min-height:36px;padding:6px 12px;font-size:.88em}
.nls-subnet-eq{font-family:var(--nls-mono);background:var(--field);border-radius:6px;padding:4px 8px;display:inline-block;max-width:100%;overflow-wrap:anywhere}
.nls-subnet-bits{display:inline-grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px;margin:6px 0;max-width:100%;width:340px}
.nls-subnet-bits .pv{font-size:11px;color:var(--muted);text-align:center;font-family:var(--nls-mono)}
.nls-subnet-bits .b{text-align:center;font-family:var(--nls-mono);font-weight:700;border-radius:5px;padding:4px 0;background:var(--field);border:1px solid var(--line)}
.nls-subnet-bits .b.n{background:var(--blue);color:#fff;border-color:var(--blue)}
.nls-subnet-legend{font-size:.82em;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.nls-subnet-legend i{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:4px;border:1px solid var(--line);background:var(--field)}
.nls-subnet-legend i.n{background:var(--blue);border-color:var(--blue)}
.nls-subnet-oct4{display:flex;flex-wrap:wrap;gap:4px 10px;font-family:var(--nls-mono);font-size:.95em;margin:6px 0}
.nls-subnet-oct4 span{white-space:nowrap}
.nls-subnet-oct4 u{text-decoration:none;color:#fff;background:var(--blue);border-radius:3px;padding:0 1px}
.nls-subnet-chips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.nls-subnet-chips span{font-family:var(--nls-mono);font-size:.85em;border:1px solid var(--line);border-radius:12px;padding:1px 8px}
.nls-subnet-chips span.hit{background:var(--orange);color:#fff;border-color:var(--orange);font-weight:700}
.nls-subnet-tw{overflow-x:auto;max-width:100%;margin:6px 0;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
  background:linear-gradient(to right,var(--panel) 30%,transparent) left/24px 100% no-repeat local,linear-gradient(to left,var(--panel) 30%,transparent) right/24px 100% no-repeat local,
  radial-gradient(farthest-side at 0 50%,rgba(0,0,0,.18),transparent) left/10px 100% no-repeat scroll,radial-gradient(farthest-side at 100% 50%,rgba(0,0,0,.18),transparent) right/10px 100% no-repeat scroll}
.nls-subnet-tw:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-subnet-table{border-collapse:collapse;font-size:.88em;min-width:100%}
.nls-subnet-table th,.nls-subnet-table td{border:1px solid var(--line);padding:5px 8px;text-align:left;white-space:nowrap}
.nls-subnet-table th{background:var(--field);font-weight:600}
.nls-subnet-table td.m{font-family:var(--nls-mono)}
.nls-subnet-table tr.hit td{background:var(--field);font-weight:700}
.nls-subnet-side{display:flex;flex-direction:column;gap:14px;min-width:0}
.nls-subnet-nav{min-width:0}
.nls-subnet-main{min-width:0}
.nls-subnet-bin{margin-bottom:0;container-type:inline-size;container-name:nlsbin}
.nls-subnet-bin h3{margin:0 0 6px;font-size:1em}
.nls-subnet-binrow{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px;max-width:520px}
.nls-subnet-bit{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;border:1px solid var(--line);background:var(--field);border-radius:8px;padding:4px 0;cursor:pointer;min-height:48px;min-width:0;touch-action:manipulation}
.nls-subnet-bit small{font-size:11px;color:var(--muted);font-family:var(--nls-mono)}
.nls-subnet-bit b{font-family:var(--nls-mono);font-size:1.15em}
.nls-subnet-bit[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:#fff}
.nls-subnet-bit[aria-pressed="true"] small{color:#fff}
.nls-subnet-binout{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin-top:8px;font-size:.93em}
.nls-subnet-binout input{width:84px;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-family:var(--nls-mono);min-height:40px}
.nls-subnet-binout [data-el="bsum"]{font-size:1.05em;font-weight:600;overflow-wrap:anywhere;min-width:0}
.nls-subnet-calcin{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1.3fr);gap:10px 14px}
.nls-subnet-calcblk{display:grid;grid-template-columns:minmax(0,1fr) 88px;gap:10px;min-width:0}
.nls-subnet-sub{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.nls-subnet-sub button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.nls-subnet-empty{color:var(--muted);font-size:.93em;margin:8px 0}
.nls-subnet-hide{display:none!important}
.nls-subnet input,.nls-subnet select,.nls-subnet button{scroll-margin-bottom:calc(var(--nl-bnav, 0px) + 72px);scroll-margin-top:72px}
@media (max-width:760px){
  .nls-subnet{padding-bottom:calc(var(--nl-bnav, 0px) + 12px)}
  .nls-subnet-grid{grid-template-columns:minmax(0,1fr)}
  .nls-subnet-side{display:contents}
  .nls-subnet-nav{order:1}.nls-subnet-main{order:2}.nls-subnet-bin{order:3}
  .nls-subnet-missions{flex-direction:row;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
  .nls-subnet-missions li{flex:0 0 200px;scroll-snap-align:start}
  .nls-subnet-mbtn{height:100%}
  .nls-subnet-calcin{grid-template-columns:minmax(0,1fr)}
  .nls-subnet-box{padding:12px}
}
@media (max-width:600px){
  .nls-subnet-fields,.nls-subnet-vrow .nls-subnet-fields{grid-template-columns:minmax(0,1fr)}
  .nls-subnet-f input,.nls-subnet-f select{font-size:16px}
  .nls-subnet-submitrow .nls-subnet-btn{flex:1 1 auto}
  .nls-subnet-stepb{padding-left:0}
  .nls-subnet-table{font-size:.85em}
}
@media (max-width:480px){
  .nls-subnet-binrow{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
  .nls-subnet-bit{flex-direction:row;gap:8px;min-height:48px}
  .nls-subnet-bit small{font-size:12px}
  .nls-subnet-bits{width:100%}
}
@media (max-width:420px){
  .nls-subnet-tab{font-size:.88em;padding:8px 4px}
}
@media (pointer:coarse){
  .nls-subnet-bit,.nls-subnet-btn,.nls-subnet-mbtn,.nls-subnet-tab{min-height:48px}
  .nls-subnet-bit{min-width:44px}
  .nls-subnet-f input,.nls-subnet-f select,.nls-subnet-binout input{min-height:48px;font-size:16px}
  .nls-subnet-help summary,.nls-subnet-sol>summary{min-height:48px}
  .nls-subnet-stepd>summary{min-height:48px}
  .nls-subnet-stepbar .nls-subnet-btn{min-height:44px}
}
/* the sim column can be narrow even on wide screens (app sidebar / rail): stack missions, main and helper by real width */
@container nlsroot (max-width:719px){
  .nls-subnet-grid{grid-template-columns:minmax(0,1fr)}
  .nls-subnet-side{display:contents}
  .nls-subnet-nav{order:1}.nls-subnet-main{order:2}.nls-subnet-bin{order:3}
  .nls-subnet-missions{flex-direction:row;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
  .nls-subnet-missions li{flex:0 0 200px;scroll-snap-align:start}
  .nls-subnet-mbtn{height:100%}
  .nls-subnet-calcin{grid-template-columns:minmax(0,1fr)}
}
/* bit row: wrap by the width the helper panel really has (side column, full width, rail/sidebar open or closed) */
@container nlsbin (max-width:229px){
  .nls-subnet-binrow{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
}
@container nlsbin (max-width:379px){
  @media (pointer:coarse){
    .nls-subnet-binrow{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
  }
}
@container nlsbin (max-width:259px){
  .nls-subnet-bit{flex-direction:column;gap:0}
}
@container nlsbin (max-width:199px){
  .nls-subnet-binrow{grid-template-columns:repeat(2,minmax(0,1fr))}
  .nls-subnet-bit{flex-direction:row;gap:8px}
}
@media (prefers-reduced-motion:reduce){.nls-subnet-stepd>summary::after{transition:none}}`;

  // ------------------------------------------------------------------------------------------
  // IPv4 math (browser copy, independent of the server)
  const ipToInt = (s) => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s || '').replace(/\s+/g, ''));
    if (!m) return null; let n = 0;
    for (let i = 1; i <= 4; i++) { const o = Number(m[i]); if (o > 255) return null; n = n * 256 + o; }
    return n;
  };
  const oct = (n, i) => Math.floor(n / Math.pow(256, 3 - i)) % 256;
  const octs = (n) => [0, 1, 2, 3].map((i) => oct(n, i));
  const ipStr = (n) => octs(n).join('.');
  const maskInt = (p) => (p <= 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0);
  const netOf = (ip, p) => (ip & maskInt(p)) >>> 0;
  const pow2 = (h) => Math.pow(2, h);
  const prefixFromMask = (m) => { const inv = (~m) >>> 0; if ((inv & (inv + 1)) !== 0) return null; let p = 0; for (let i = 31; i >= 0 && ((m >>> i) & 1); i--) p++; return p; };
  const parseMaskOrPrefix = (s) => {
    s = String(s || '').replace(/\s+/g, '');
    const m = /^\/?(\d{1,2})$/.exec(s); if (m) { const p = Number(m[1]); return p <= 32 ? p : null; }
    const mi = ipToInt(s); return mi === null ? null : prefixFromMask(mi);
  };
  const classOf = (ip) => { const o = oct(ip, 0); return o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D' : 'E'; };
  const needH = (n) => { let h = 2; while (pow2(h) - 2 < n) h++; return h; };
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bin8 = (v) => ('00000000' + v.toString(2)).slice(-8);
  const ORD = ['แรก', 'ที่ 2', 'ที่ 3', 'ที่ 4'];

  // ------------------------------------------------------------------------------------------
  // Solution renderers (return HTML)
  function bitsRow(v, netBits) {
    let h = '<div class="nls-subnet-bits" aria-hidden="true">';
    [128, 64, 32, 16, 8, 4, 2, 1].forEach((pv) => { h += `<span class="pv">${pv}</span>`; });
    bin8(v).split('').forEach((b, i) => { h += `<span class="b${i < netBits ? ' n' : ''}">${b}</span>`; });
    return h + '</div><span class="nls-subnet-legend"><span><i class="n"></i>บิต network</span><span><i></i>บิต host</span></span>';
  }
  function oct4(n, p) { // dotted binary with first p bits highlighted
    const b = octs(n).map(bin8).join('');
    let out = '<div class="nls-subnet-oct4" aria-label="' + esc(ipStr(n)) + '">';
    for (let i = 0; i < 4; i++) {
      out += '<span>';
      for (let j = 0; j < 8; j++) { const k = i * 8 + j; out += k < p ? `<u>${b[k]}</u>` : b[k]; }
      out += '</span>' + (i < 3 ? '.' : '');
    }
    return out + '</div>';
  }
  // each step is its own disclosure (accordion); the caller decides which ones start open
  const step = (title, body) => `<li><details class="nls-subnet-stepd" open><summary><h4>${title}</h4></summary><div class="nls-subnet-stepb">${body}</div></details></li>`;
  const eq = (s) => `<span class="nls-subnet-eq">${s}</span>`;
  function blockChips(v, B) {
    if (B >= 256) return '';
    const starts = []; for (let s = 0; s < 256; s += B) starts.push(s);
    let list = starts;
    const hitIdx = Math.floor(v / B);
    if (starts.length > 16) list = starts.slice(Math.max(0, hitIdx - 3), hitIdx + 4);
    const pre = list[0] > 0 ? '<span>…</span>' : ''; const post = list[list.length - 1] + B < 256 ? '<span>…</span>' : '';
    return '<div class="nls-subnet-chips">' + pre + list.map((s) => `<span class="${s === hitIdx * B ? 'hit' : ''}">${s}–${s + B - 1}</span>`).join('') + post + '</div>';
  }

  function hostSteps(ip, p, how) {
    how = how || {};
    const h = 32 - p, mask = maskInt(p), net = netOf(ip, p), bc = net + pow2(h) - 1;
    const io = Math.min(3, Math.floor(p / 8)); // octet index containing the boundary (or first all-host octet)
    const mo = oct(mask, io), v = oct(ip, io), B = 256 - mo, q = Math.floor(v / B), nv = q * B;
    const netBitsHere = p - io * 8;
    let s = '';
    if (how.classful) {
      const c = classOf(ip), o1 = oct(ip, 0);
      s += step('ดู Class จาก octet แรก', `<p>octet แรก = <b>${o1}</b> → ` + (c === 'A' ? 'อยู่ช่วง 1–126' : c === 'B' ? 'อยู่ช่วง 128–191' : 'อยู่ช่วง 192–223') +
        ` จึงเป็น <b>Class ${c}</b> ใช้ default mask <b>/${p}</b></p>`);
    }
    if (how.maskGiven) {
      const mo4 = octs(mask);
      s += step('แปลง Subnet mask เป็น prefix', oct4(mask, p) + '<p>' + mo4.map((o) => `${o} = ${bin8(o).split('').filter((c) => c === '1').length} บิต`).join(', ') +
        `</p><p>${eq(mo4.map((o) => bin8(o).split('').filter((c) => c === '1').length).join(' + ') + ' = /' + p)}</p>`);
    }
    s += step('เขียน Subnet mask เป็นเลขฐานสอง', oct4(mask, p) + `<p>บิต 1 จำนวน <b>${p}</b> บิต = ส่วน network, บิต 0 จำนวน <b>${h}</b> บิต = ส่วน host</p><p>Subnet mask = ${eq(ipStr(mask) + '  (/' + p + ')')}</p>`);
    s += step('หา octet ที่สนใจ', (netBitsHere === 0
      ? `<p>/${p} ลงตัวที่ 8 บิตพอดี → octet ${ORD[io]} เป็นส่วน host ทั้งหมด (mask = 0)</p>`
      : `<p>ขอบเขต network/host อยู่ใน octet ${ORD[io]} (mask ใน octet นี้ = <b>${mo}</b>) มีบิต network ${netBitsHere} บิต</p>`) +
      `<p>octet ${ORD[io]} ของ IP = <b>${v}</b> = ${eq(bin8(v))}</p>` + bitsRow(v, netBitsHere));
    s += step('หา Block size', `<p>${eq('256 − ' + mo + ' = ' + B)}${B === 256 ? ' (ทั้ง octet)' : ''}</p>` +
      (B < 256 ? `<p>วงย่อยใน octet นี้เริ่มที่ ${[0, B, 2 * B, 3 * B].filter((x) => x < 256).join(', ')}${4 * B < 256 ? ', …' : ''} → เลข ${v} อยู่ในวงที่ไฮไลต์</p>` + blockChips(v, B) : ''));
    s += step('หา Network address', `<p>${eq('⌊' + v + ' ÷ ' + B + '⌋ × ' + B + ' = ' + q + ' × ' + B + ' = ' + nv)}</p>` +
      `<p>octet ทางซ้ายคงเดิม, octet ทางขวาเป็น 0 → Network = <b class="nls-subnet-mono">${ipStr(net)}</b></p>` +
      (netBitsHere > 0 ? `<p>(เทียบแบบ AND: ${eq(bin8(v) + ' AND ' + bin8(mo) + ' = ' + bin8(nv))})</p>` : ''));
    s += step('หา Broadcast address', `<p>network ถัดไป ${eq(nv + ' + ' + B + ' = ' + (nv + B))} → broadcast ${eq((nv + B) + ' − 1 = ' + (nv + B - 1))}</p>` +
      `<p>octet ทางขวาเป็น 255 → Broadcast = <b class="nls-subnet-mono">${ipStr(bc)}</b></p>`);
    s += step('หา Host แรกและ Host สุดท้าย', `<p>Host แรก = network + 1 = <b class="nls-subnet-mono">${ipStr(net + 1)}</b></p><p>Host สุดท้าย = broadcast − 1 = <b class="nls-subnet-mono">${ipStr(bc - 1)}</b></p>`);
    s += step('นับจำนวน Host ที่ใช้ได้', `<p>h = 32 − ${p} = ${h} บิต → ${eq('2^' + h + ' − 2 = ' + fmt(pow2(h)) + ' − 2 = ' + fmt(pow2(h) - 2))}</p><p>(ลบ 2 เพราะ network address และ broadcast address ใช้กับเครื่องไม่ได้)</p>`);
    const rows = [['Class', how.classful ? classOf(ip) : null], ['Subnet mask', ipStr(mask) + ' (/' + p + ')'], ['Network', ipStr(net)], ['Broadcast', ipStr(bc)],
      ['Host แรก', ipStr(net + 1)], ['Host สุดท้าย', ipStr(bc - 1)], ['จำนวน host', fmt(pow2(h) - 2)]].filter((r) => r[1] !== null);
    s += step('สรุป', '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><tbody>' + rows.map((r) => `<tr><th>${r[0]}</th><td class="m">${esc(r[1])}</td></tr>`).join('') + '</tbody></table></div>');
    return '<ol class="nls-subnet-steps">' + s + '</ol>';
  }

  function netQuick(label, ip, p) {
    const io = Math.min(3, Math.floor(p / 8)), mo = oct(maskInt(p), io), v = oct(ip, io), B = 256 - mo, nv = Math.floor(v / B) * B;
    return `<p><b>${label}</b> ${eq(ipStr(ip))}: octet ${ORD[io]} = ${v} → ${eq('⌊' + v + ' ÷ ' + B + '⌋ × ' + B + ' = ' + nv)} → network <b class="nls-subnet-mono">${ipStr(netOf(ip, p))}</b></p>` + bitsRow(v, p - io * 8);
  }
  function sameSteps(a, b, p) {
    const io = Math.min(3, Math.floor(p / 8)), mo = oct(maskInt(p), io), B = 256 - mo;
    const na = netOf(a, p), nb = netOf(b, p);
    let s = step('หา mask และ block size', `<p>/${p} → mask ${eq(ipStr(maskInt(p)))}, octet ที่สนใจคือ octet ${ORD[io]} (mask = ${mo}) → block size ${eq('256 − ' + mo + ' = ' + B)}</p>`);
    s += step('หา network ของ IP A', netQuick('IP A', a, p));
    s += step('หา network ของ IP B', netQuick('IP B', b, p));
    s += step('เปรียบเทียบ', `<p>${eq(ipStr(na))} ${na === nb ? '=' : '≠'} ${eq(ipStr(nb))} → <b>${na === nb ? 'อยู่ subnet เดียวกัน (ส่งหากันได้ตรง ๆ ผ่าน switch)' : 'อยู่คนละ subnet (ต้องผ่าน router / default gateway)'}</b></p>`);
    return '<ol class="nls-subnet-steps">' + s + '</ol>';
  }

  function hostsTable(n) {
    const h0 = needH(n); let rows = '';
    for (let h = Math.max(2, h0 - 3); h <= h0; h++) rows += `<tr class="${h === h0 ? 'hit' : ''}"><td class="m">${h}</td><td class="m">2^${h} − 2 = ${fmt(pow2(h) - 2)}</td><td>${pow2(h) - 2 >= n ? 'พอ ✔' : 'ไม่พอ'}</td><td class="m">/${32 - h}</td></tr>`;
    return '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><thead><tr><th>h (บิต host)</th><th>host ที่ใช้ได้</th><th>' + fmt(n) + ' hosts?</th><th>prefix</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function sizeInOctets(size) {
    if (size < 256) return `${size} ใน octet ที่ 4`;
    if (size < 65536) return `${size / 256} ใน octet ที่ 3 (เพราะ ${fmt(size)} = ${size / 256} × 256)`;
    return `${size / 65536} ใน octet ที่ 2 (เพราะ ${fmt(size)} = ${size / 65536} × 65,536)`;
  }
  function countSteps(pr) {
    const blk = ipToInt(pr.block), y = pr.prefix, x = pr.x, k = pr.k, n = pr.n, d = x - y, size = pow2(32 - x);
    let s = step('จำนวน subnet', `<p>ยืมบิต host มา ${eq(x + ' − ' + y + ' = ' + d)} บิต → ${eq('2^' + d + ' = ' + fmt(pow2(d)))} subnet</p>`);
    s += step('จำนวน host ต่อ subnet', `<p>h = 32 − ${x} = ${32 - x} → ${eq('2^' + (32 - x) + ' − 2 = ' + fmt(size - 2))}</p>`);
    let list = '';
    const show = []; for (let i = 1; i <= Math.min(3, k); i++) show.push(i); if (show.indexOf(k) < 0) show.push(k);
    show.forEach((i, j) => {
      if (j > 0 && i !== show[j - 1] + 1) list += '<tr><td colspan="3">…</td></tr>';
      const nn = blk + (i - 1) * size;
      list += `<tr class="${i === k ? 'hit' : ''}"><td>${i}</td><td class="m">${ipStr(nn)}/${x}</td><td class="m">${ipStr(nn + size - 1)}</td></tr>`;
    });
    s += step('Network ของ subnet ลำดับที่ ' + k, `<p>ขนาด block ของ /${x} = 2^${32 - x} = ${fmt(size)} addresses = เพิ่มทีละ ${sizeInOctets(size)}</p>` +
      `<p>${eq('network ที่ ' + k + ' = ' + pr.block + ' + (' + k + ' − 1) × ' + fmt(size) + ' = ' + ipStr(blk + (k - 1) * size))}</p>` +
      '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><thead><tr><th>ลำดับ</th><th>Network</th><th>Broadcast</th></tr></thead><tbody>' + list + '</tbody></table></div>');
    s += step('Prefix สำหรับ ' + fmt(n) + ' hosts', `<p>หา h ที่น้อยที่สุดที่ 2^h − 2 ≥ ${fmt(n)}</p>` + hostsTable(n) + `<p>→ h = ${needH(n)} → prefix ${eq('32 − ' + needH(n) + ' = /' + (32 - needH(n)))} (mask ${ipStr(maskInt(32 - needH(n)))})</p>`);
    return '<ol class="nls-subnet-steps">' + s + '</ol>';
  }

  function vlsmPlan(blk, b, reqs) {
    const order = reqs.map((r, i) => ({ i, name: r.name, hosts: r.hosts })).sort((p, q) => q.hosts - p.hosts || p.i - q.i);
    let next = netOf(blk, b); const end = netOf(blk, b) + pow2(32 - b);
    order.forEach((o) => { o.h = needH(o.hosts); o.p = 32 - o.h; o.size = pow2(o.h); o.net = next; o.bc = next + o.size - 1; o.fits = o.bc < end; next += o.size; });
    return { order, next, end };
  }
  function vlsmSteps(blk, b, reqs) {
    const plan = vlsmPlan(blk, b, reqs);
    let s = step('เรียงจาก host มากไปน้อย', '<p>' + plan.order.map((o) => `${esc(o.name)} (${fmt(o.hosts)})`).join(' → ') + '</p><p class="nls-subnet-legend">ถ้าจำนวนเท่ากัน ให้จัดตามลำดับในโจทย์</p>');
    s += step('เลือกขนาด block ของแต่ละห้อง', '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><thead><tr><th>ห้อง</th><th>ต้องการ</th><th>h</th><th>2^h − 2</th><th>block</th><th>prefix</th></tr></thead><tbody>' +
      plan.order.map((o) => `<tr><td>${esc(o.name)}</td><td class="m">${fmt(o.hosts)}</td><td class="m">${o.h}</td><td class="m">${fmt(o.size - 2)}</td><td class="m">${fmt(o.size)}</td><td class="m">/${o.p}</td></tr>`).join('') + '</tbody></table></div>');
    s += step('วางต่อกันตั้งแต่ต้น block ' + ipStr(netOf(blk, b)) + '/' + b, '<p>network ถัดไป = network ก่อนหน้า + ขนาด block ก่อนหน้า</p><div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><thead><tr><th>ห้อง</th><th>Network/prefix</th><th>Host แรก – สุดท้าย</th><th>Broadcast</th></tr></thead><tbody>' +
      plan.order.map((o) => `<tr><td>${esc(o.name)}</td><td class="m">${o.fits ? ipStr(o.net) + '/' + o.p : 'ไม่พอ!'}</td><td class="m">${o.fits ? ipStr(o.net + 1) + ' – ' + ipStr(o.bc - 1) : '-'}</td><td class="m">${o.fits ? ipStr(o.bc) : '-'}</td></tr>`).join('') + '</tbody></table></div>' +
      (plan.next <= plan.end ? `<p>ใช้ไป ${fmt(plan.next - netOf(blk, b))} จาก ${fmt(pow2(32 - b))} addresses เหลือตั้งแต่ <span class="nls-subnet-mono">${ipStr(plan.next)}</span> ไว้ขยายภายหลัง</p>` : '<p class="nls-subnet-msg err">block นี้มีขนาดไม่พอสำหรับทุกห้อง</p>'));
    return '<ol class="nls-subnet-steps">' + s + '</ol>';
  }

  function solutionFor(pr) {
    try {
      if (pr.kind === 'host') {
        const ip = ipToInt(pr.ip); if (ip === null) return '';
        if (pr.mission === 's1') return hostSteps(ip, { A: 8, B: 16, C: 24 }[classOf(ip)] || 24, { classful: true });
        if (pr.mask) return hostSteps(ip, prefixFromMask(ipToInt(pr.mask)), { maskGiven: true });
        return hostSteps(ip, pr.prefix, {});
      }
      if (pr.kind === 'same') return sameSteps(ipToInt(pr.ipA), ipToInt(pr.ipB), pr.prefix);
      if (pr.kind === 'count') return countSteps(pr);
      if (pr.kind === 'vlsm') return vlsmSteps(ipToInt(pr.block), pr.prefix, pr.reqs);
    } catch (e) { /* fall through */ }
    return '<p class="nls-subnet-empty">แสดงวิธีทำของโจทย์นี้ไม่ได้</p>';
  }

  function statementFor(pr) {
    if (pr.kind === 'host') {
      if (pr.mission === 's1') return `<p>IP Address</p><p class="nls-subnet-big">${esc(pr.ip)}</p><p class="nls-subnet-desc">ไม่บอก mask — ใช้ default mask ตาม Class</p>`;
      if (pr.mask) return `<p>IP Address <span class="nls-subnet-big">${esc(pr.ip)}</span></p><p>Subnet mask <span class="nls-subnet-big">${esc(pr.mask)}</span></p>`;
      return `<p>IP Address / prefix</p><p class="nls-subnet-big">${esc(pr.ip)}/${esc(pr.prefix)}</p>`;
    }
    if (pr.kind === 'same') return `<p>IP A <span class="nls-subnet-big">${esc(pr.ipA)}/${esc(pr.prefix)}</span></p><p>IP B <span class="nls-subnet-big">${esc(pr.ipB)}/${esc(pr.prefix)}</span></p>`;
    if (pr.kind === 'count') return `<p>Block <span class="nls-subnet-big">${esc(pr.block)}/${esc(pr.prefix)}</span> แบ่งเป็น subnet ย่อยขนาด <span class="nls-subnet-big">/${esc(pr.x)}</span></p>` +
      `<p>ตอบ: จำนวน subnet, host ต่อ subnet, network ของ subnet ลำดับที่ <b>${esc(pr.k)}</b> (subnet แรก = ลำดับที่ 1) และ prefix ที่เล็กที่สุดที่รองรับ <b>${fmt(pr.n)}</b> hosts</p>`;
    if (pr.kind === 'vlsm') return `<p>Block ที่ได้รับ <span class="nls-subnet-big">${esc(pr.block)}/${esc(pr.prefix)}</span></p><p>ความต้องการ (ยังไม่เรียง):</p>` +
      '<div class="nls-subnet-tw" tabindex="0" role="region" aria-label="ตาราง (เลื่อนซ้าย-ขวาได้)"><table class="nls-subnet-table"><thead><tr><th>ห้อง / ลิงก์</th><th>จำนวน host</th></tr></thead><tbody>' +
      pr.reqs.map((r) => `<tr><td>${esc(r.name)}</td><td class="m">${fmt(r.hosts)}</td></tr>`).join('') + '</tbody></table></div>' +
      '<p class="nls-subnet-desc">จัดสรรจากห้องที่ต้องการ host มากที่สุดก่อน ถ้าเท่ากันให้จัดตามลำดับในตาราง</p>';
    return '';
  }

  // phone keyboards: dotted values (IP / mask, which also accepts a bare prefix number) -> decimal keypad with ".";
  // counts and prefix numbers ("/" is optional everywhere) -> digit keypad
  const INPUTMODE = { ip: 'decimal', mask: 'decimal', num: 'numeric', prefix: 'numeric' };
  const INPUT_ATTRS = 'type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"';
  function fieldHtml(f) {
    const id = 'nls-subnet-f-' + Math.random().toString(36).slice(2, 9);
    let ctl;
    if (f.type === 'yesno') ctl = `<select id="${id}" data-key="${esc(f.key)}"><option value="">— เลือก —</option><option value="ใช่">ใช่ (วงเดียวกัน)</option><option value="ไม่ใช่">ไม่ใช่ (คนละวง)</option></select>`;
    else if (f.type === 'cls') ctl = `<select id="${id}" data-key="${esc(f.key)}"><option value="">— เลือก —</option><option>A</option><option>B</option><option>C</option></select>`;
    else ctl = `<input id="${id}" data-key="${esc(f.key)}" data-type="${esc(f.type || '')}" ${INPUT_ATTRS} maxlength="40" inputmode="${INPUTMODE[f.type] || 'text'}" enterkeyhint="${f.last ? 'done' : 'next'}" placeholder="${esc(f.type === 'prefix' ? 'n เช่น 26' : f.type === 'mask' && /\/n/.test(f.ph || '') ? (f.ph || '').replace('/n', 'n') : (f.ph || ''))}">`;
    return `<label class="nls-subnet-f" for="${id}" data-field="${esc(f.key)}"><span>${esc(f.label)} <em class="nls-subnet-mark" aria-live="polite"></em></span>${ctl}</label>`;
  }
  function fieldsHtml(pr) {
    const fs0 = Array.isArray(pr.fields) ? pr.fields : [];
    const fs = fs0.map((f, i) => Object.assign({}, f, { last: i === fs0.length - 1 }));
    if (pr.kind === 'vlsm') {
      return '<div class="nls-subnet-vlist">' + pr.reqs.map((r, i) => `<div class="nls-subnet-vrow"><h4>${esc(r.name)} — ${fmt(r.hosts)} hosts</h4><div class="nls-subnet-fields">` +
        fs.filter((f) => f.row === i).map((f) => fieldHtml(Object.assign({}, f, { label: /^net/.test(f.key) ? 'Network address' : 'Prefix (/n หรือ mask)' }))).join('') + '</div></div>').join('') + '</div>';
    }
    return '<div class="nls-subnet-fields">' + fs.map(fieldHtml).join('') + '</div>';
  }

  // ------------------------------------------------------------------------------------------
  window.NL_SIMS = window.NL_SIMS || {};
  window.NL_SIMS['subnet'] = {
    title: 'จำลองการคำนวณ Subnet',
    mount(root, ctx) {
      ctx = ctx || {};
      if (!document.getElementById('nls-subnet-css')) {
        const st = document.createElement('style'); st.id = 'nls-subnet-css'; st.textContent = CSS; document.head.appendChild(st);
      }
      const missions = Array.isArray(ctx.missions) ? ctx.missions : [];
      const done = Object.assign({}, ctx.done || {});
      const state = { tab: 'practice', cur: missions[0] ? missions[0].id : null, work: {}, calcMode: 'ip', bits: 0, alive: true };
      const toast = (t) => { try { if (typeof ctx.toast === 'function') ctx.toast(t); } catch (e) { /* ignore */ } };
      const mq = (q) => { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } };
      const narrow = () => mq('(max-width:600px)');
      const coarse = () => mq('(pointer:coarse)');
      const timers = new Set();
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (state.alive) fn(); }, ms); timers.add(id); return id; };

      const el = document.createElement('div');
      el.className = 'nls-subnet';
      el.innerHTML = `
<div class="nls-subnet-head"><h2>จำลองการคำนวณ Subnet</h2>
  <div class="nls-subnet-tabs" role="tablist" aria-label="โหมด">
    <button type="button" class="nls-subnet-tab" role="tab" data-tab="practice" aria-selected="true">ฝึกทำโจทย์</button>
    <button type="button" class="nls-subnet-tab" role="tab" data-tab="calc" aria-selected="false">เครื่องคิดเลขช่วยคิด</button>
  </div></div>
<details class="nls-subnet-box nls-subnet-help"><summary>คำแนะนำการใช้งาน</summary><ol>
  <li>เลือกภารกิจทางซ้าย (มือถือ: เลื่อนแถบภารกิจไปทางขวา) แล้วกด <b>โจทย์ใหม่</b></li>
  <li>กรอกคำตอบทุกช่อง: IP เขียนแบบ 192.168.1.64, mask ตอบได้ทั้ง 255.255.255.192 หรือ /26, จำนวน host ใส่ตัวเลขอย่างเดียว (เว้นวรรคได้)</li>
  <li>กด <b>ตรวจคำตอบ</b> (หรือกด Enter) ระบบให้คะแนนทีละช่อง เต็ม 10 แล้วแสดง <b>วิธีทำทีละขั้น</b></li>
  <li>ติดตรงไหนกด <b>คำใบ้</b> หรือใช้ <b>ตัวช่วยเลขฐานสอง</b> ด้านล่าง (คลิกบิตเพื่อเปิด/ปิด)</li>
  <li>แท็บ <b>เครื่องคิดเลขช่วยคิด</b> ใช้ทดลองคำนวณ IP/prefix หรือ VLSM ได้อิสระ (ไม่นับคะแนน)</li></ol></details>
<div class="nls-subnet-grid">
<aside class="nls-subnet-side">
  <nav aria-label="รายการภารกิจ" data-pane="practice" class="nls-subnet-nav"><ul class="nls-subnet-missions" data-el="mlist"></ul></nav>
  <section class="nls-subnet-box nls-subnet-bin" aria-label="ตัวช่วยเลขฐานสอง">
  <h3>ตัวช่วยเลขฐานสอง (แตะ/คลิกบิตเพื่อเปิด/ปิด)</h3>
  <div class="nls-subnet-binrow" data-el="bits"></div>
  <div class="nls-subnet-binout"><label>ฐานสิบ <input data-el="bdec" type="text" inputmode="numeric" enterkeyhint="done" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="3" value="0" aria-label="ค่าฐานสิบ 0 ถึง 255"></label>
    <span data-el="bsum" class="nls-subnet-mono"></span>
    <button type="button" class="nls-subnet-btn ghost" data-act="bclear">ล้าง</button></div>
</section>
</aside>
<div class="nls-subnet-main">
<section class="nls-subnet-box" data-pane="practice" data-el="work" aria-live="off"></section>
<div data-pane="calc" class="nls-subnet-hide"><section class="nls-subnet-box">
  <div class="nls-subnet-sub" role="group" aria-label="ชนิดการคำนวณ">
    <button type="button" class="nls-subnet-btn ghost" data-calcmode="ip" aria-pressed="true">IP / prefix</button>
    <button type="button" class="nls-subnet-btn ghost" data-calcmode="vlsm" aria-pressed="false">VLSM</button>
  </div>
  <div data-calc="ip"><div class="nls-subnet-calcin">
    <label class="nls-subnet-f"><span>IP Address (พิมพ์ 192.168.1.77/26 ได้)</span><input data-el="cip" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="192.168.10.77/26"></label>
    <label class="nls-subnet-f"><span>Prefix หรือ Subnet mask</span><input data-el="cmask" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="26 หรือ 255.255.255.192"></label>
  </div></div>
  <div data-calc="vlsm" class="nls-subnet-hide"><div class="nls-subnet-calcin">
    <div class="nls-subnet-calcblk"><label class="nls-subnet-f"><span>Block (network)</span><input data-el="vblk" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="192.168.1.0"></label>
    <label class="nls-subnet-f"><span>Prefix</span><input data-el="vpre" type="text" inputmode="numeric" enterkeyhint="next" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="3" value="24" placeholder="24"></label></div>
    <label class="nls-subnet-f"><span>จำนวน host แต่ละห้อง (คั่นด้วย , หรือ . หรือเว้นวรรค)</span><input data-el="vreq" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="60, 28, 12, 2"></label>
  </div></div>
  <div data-el="cout" aria-live="polite"></div>
</section></div>
</div></div>`;
      root.appendChild(el);
      const $ = (sel) => el.querySelector(sel);

      // ---------------- missions
      function statusText(id) {
        const d = done[id]; const m = missions.find((x) => x.id === id);
        if (!d || !d.attempts && d.best == null) return { t: 'ยังไม่ทำ', full: false };
        const max = d.max || (m && m.max) || 10;
        return { t: `คะแนนดีที่สุด ${d.best || 0}/${max}`, full: (d.best || 0) >= max };
      }
      const LV = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
      function renderMissions() {
        $('[data-el="mlist"]').innerHTML = missions.map((m) => {
          const st = statusText(m.id);
          return `<li><button type="button" class="nls-subnet-mbtn" data-mission="${esc(m.id)}" data-level="${esc(m.level)}" aria-current="${m.id === state.cur}">` +
            `<b><span class="nls-subnet-lv ${esc(m.level)}">${LV[m.level] || esc(m.level)}</span>${esc(m.title)}</b><span class="nls-subnet-mstat${st.full ? ' full' : ''}">${esc(st.t)}</span></button></li>`;
        }).join('') || '<li class="nls-subnet-empty">ไม่มีภารกิจ</li>';
      }
      const W = (id) => state.work[id] || (state.work[id] = { problem: null, token: null, hints: 0, result: null, answers: {}, busy: false, err: '' });

      function renderWork() {
        const box = $('[data-el="work"]');
        const m = missions.find((x) => x.id === state.cur);
        if (!m) { box.innerHTML = '<p class="nls-subnet-empty">เลือกภารกิจ</p>'; return; }
        const w = W(m.id); const hints = Array.isArray(m.hints) ? m.hints : [];
        let h = `<h3 class="nls-subnet-mtitle"><span class="nls-subnet-lv ${esc(m.level)}">${LV[m.level] || ''}</span>${esc(m.title)}</h3><p class="nls-subnet-desc">${esc(m.desc)}</p>`;
        h += '<div class="nls-subnet-row">' +
          `<button type="button" class="nls-subnet-btn${w.problem ? ' ghost' : ' go'}" data-act="new"${w.busy ? ' disabled' : ''}>โจทย์ใหม่</button>` +
          (hints.length ? `<button type="button" class="nls-subnet-btn ghost" data-act="hint"${w.hints >= hints.length ? ' disabled' : ''}>คำใบ้ (${w.hints}/${hints.length})</button>` : '') + '</div>';
        if (w.hints) h += '<ol class="nls-subnet-hints">' + hints.slice(0, w.hints).map((t) => `<li>${esc(t)}</li>`).join('') + '</ol>';
        if (w.err) h += `<p class="nls-subnet-msg err" role="alert">${esc(w.err)}</p>`;
        if (!w.problem) {
          h += '<p class="nls-subnet-empty">กด <b>โจทย์ใหม่</b> เพื่อรับโจทย์ (แต่ละครั้งได้ตัวเลขไม่ซ้ำกัน)</p>';
        } else {
          const locked = !!w.result;
          h += `<form data-el="form" novalidate><div class="nls-subnet-q">${statementFor(w.problem)}</div>${fieldsHtml(w.problem)}` +
            `<div class="nls-subnet-row nls-subnet-submitrow"><button type="submit" class="nls-subnet-btn go"${locked || w.busy ? ' disabled' : ''}>${w.busy ? 'กำลังตรวจ…' : 'ตรวจคำตอบ'}</button>` +
            (locked ? '' : '<button type="button" class="nls-subnet-btn ghost" data-act="clear">ล้างคำตอบ</button>') + '</div></form>';
          if (w.result) {
            const r = w.result; const cls = r.score >= r.max ? 'full' : r.score > 0 ? 'part' : 'zero';
            h += `<div class="nls-subnet-result ${cls}" role="status"><p class="nls-subnet-score">คะแนน ${esc(r.score)}/${esc(r.max)}</p>` +
              '<ul>' + (r.feedback || []).map((t) => `<li>${esc(t)}</li>`).join('') + '</ul>' +
              (r.saved === false && !ctx.user ? '<p class="nls-subnet-legend">โหมดผู้เยี่ยมชม: ตรวจได้แต่ไม่บันทึกคะแนน</p>' : '') +
              '<div class="nls-subnet-row" style="margin-top:8px"><button type="button" class="nls-subnet-btn go" data-act="new">ทำโจทย์ใหม่</button></div></div>';
            h += `<details class="nls-subnet-sol" open><summary>วิธีทำทีละขั้น</summary><div class="nls-subnet-stepbar"><button type="button" class="nls-subnet-btn ghost" data-act="stepsall" data-open="1">เปิดทุกขั้น</button><button type="button" class="nls-subnet-btn ghost" data-act="stepsall" data-open="0">ปิดทุกขั้น</button></div>${solutionFor(w.problem)}</details>`;
          }
        }
        box.innerHTML = h;
        // phones: start the step accordion with only the first step open (desktop keeps every step open as before)
        if (narrow()) box.querySelectorAll('.nls-subnet-sol .nls-subnet-stepd').forEach((d, i) => { d.open = i === 0; });
        // restore answers and marks
        box.querySelectorAll('[data-key]').forEach((inp) => {
          const k = inp.getAttribute('data-key');
          if (w.answers[k] != null) inp.value = w.answers[k];
          if (w.result) {
            inp.disabled = true;
            const f = w.result.details && w.result.details.fields;
            if (f && k in f) {
              const lab = inp.closest('.nls-subnet-f'); lab.classList.add(f[k] ? 'ok' : 'bad');
              lab.querySelector('.nls-subnet-mark').textContent = f[k] ? '✔ ถูก' : '✘ ผิด';
            }
          }
        });
      }

      async function newProblem() {
        const id = state.cur; const w = W(id);
        if (w.busy) return;
        if (typeof ctx.newProblem !== 'function') { w.err = 'ไม่สามารถขอโจทย์ได้ในขณะนี้'; renderWork(); return; }
        w.busy = true; w.err = ''; renderWork();
        try {
          const res = await ctx.newProblem(id);
          if (!state.alive) return;
          if (!res || !res.problem) throw new Error('ไม่ได้รับโจทย์');
          Object.assign(w, { problem: res.problem, token: res.token, result: null, answers: {} });
        } catch (e) { w.err = 'ขอโจทย์ไม่สำเร็จ: ' + ((e && e.message) || 'ลองใหม่อีกครั้ง'); }
        w.busy = false;
        if (!state.alive) return;
        renderWork();
        if (state.cur === id) { const first = $('[data-el="work"] [data-key]'); if (first && w.problem && !w.err) first.focus({ preventScroll: true }); }
      }

      async function submit() {
        const id = state.cur; const w = W(id);
        if (!w.problem || w.busy || w.result) return;
        if (typeof ctx.submit !== 'function') { w.err = 'ส่งคำตอบไม่ได้ในขณะนี้'; renderWork(); return; }
        const answers = {};
        $('[data-el="work"]').querySelectorAll('[data-key]').forEach((inp) => { answers[inp.getAttribute('data-key')] = inp.value.trim(); });
        w.answers = answers;
        if (Object.values(answers).every((v) => v === '')) { w.err = 'กรอกคำตอบอย่างน้อย 1 ช่องก่อนกดตรวจ'; renderWork(); return; }
        w.busy = true; w.err = ''; renderWork();
        try {
          const r = await ctx.submit(id, { answers }, { problem: w.problem, token: w.token });
          if (!state.alive) return;
          w.result = r || { score: 0, max: 10, feedback: ['ไม่ได้รับผลการตรวจ'] };
          const d = done[id] || { best: 0, max: w.result.max, attempts: 0 };
          done[id] = { best: Math.max(d.best || 0, Number(w.result.score) || 0), max: w.result.max || d.max, attempts: (d.attempts || 0) + 1 };
          toast(`ได้ ${w.result.score}/${w.result.max} คะแนน`);
        } catch (e) { w.err = 'ส่งคำตอบไม่สำเร็จ: ' + ((e && e.message) || 'ลองใหม่อีกครั้ง'); }
        w.busy = false;
        if (!state.alive) return;
        renderMissions(); renderWork();
        if (w.result) { const r = $('[data-el="work"] .nls-subnet-result'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      }

      // ---------------- calculator
      function renderCalc() {
        el.querySelectorAll('[data-calcmode]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-calcmode') === state.calcMode)));
        el.querySelectorAll('[data-calc]').forEach((d) => d.classList.toggle('nls-subnet-hide', d.getAttribute('data-calc') !== state.calcMode));
        const out = $('[data-el="cout"]');
        const prevOpen = Array.from(out.querySelectorAll('.nls-subnet-stepd')).map((d) => d.open); // keep the student's accordion state while typing
        const keepOpen = () => { if (prevOpen.length) out.querySelectorAll('.nls-subnet-stepd').forEach((d, i) => { if (i < prevOpen.length) d.open = prevOpen[i]; }); };
        const err = (t) => { out.innerHTML = `<p class="nls-subnet-msg err">${esc(t)}</p>`; };
        if (state.calcMode === 'ip') {
          let ipS = $('[data-el="cip"]').value.replace(/\s+/g, ''); let pS = $('[data-el="cmask"]').value;
          const sl = ipS.indexOf('/'); if (sl >= 0) { if (!pS.trim()) pS = ipS.slice(sl); ipS = ipS.slice(0, sl); }
          const ip = ipToInt(ipS);
          if (ip === null) return err('IP ไม่ถูกต้อง: ต้องเป็นเลข 4 ชุด (0–255) คั่นด้วยจุด เช่น 192.168.1.77');
          let p = pS.trim() ? parseMaskOrPrefix(pS) : null; let classful = false;
          if (!pS.trim()) { const c = classOf(ip); if (!{ A: 1, B: 1, C: 1 }[c]) return err('IP Class D/E ไม่มี default mask กรุณาใส่ prefix'); p = { A: 8, B: 16, C: 24 }[c]; classful = true; }
          if (p === null) return err('Prefix/mask ไม่ถูกต้อง: ใส่ /1–/30 หรือ mask ที่บิต 1 ต่อเนื่อง เช่น 255.255.255.192');
          if (p < 1 || p > 30) return err('เครื่องคิดเลขนี้รองรับ /1 ถึง /30 (/31 และ /32 ใช้กรณีพิเศษ)');
          out.innerHTML = (classful ? '<p class="nls-subnet-legend">ไม่ได้ใส่ prefix — ใช้ default mask ตาม Class</p>' : '') +
            hostSteps(ip, p, { classful, maskGiven: !classful && /\./.test(pS) });
          keepOpen();
        } else {
          let bS = $('[data-el="vblk"]').value.replace(/\s+/g, '');
          if (bS.indexOf('/') < 0) bS += '/' + $('[data-el="vpre"]').value.replace(/[\s/]+/g, ''); // separate prefix box (phones have no "/" on the number pad)
          const m = /^([\d.]+)\/(\d{1,2})$/.exec(bS);
          const blk = m ? ipToInt(m[1]) : null; const b = m ? Number(m[2]) : NaN;
          if (blk === null || !(b >= 8 && b <= 29)) return err('Block ต้องเป็น network เช่น 192.168.1.0 และ prefix 8–29 (หรือพิมพ์ 192.168.1.0/24 ในช่องเดียว)');
          const nums = $('[data-el="vreq"]').value.split(/[,.;\s]+/).filter(Boolean);
          if (!nums.length || nums.length > 12 || nums.some((x) => !/^\d{1,8}$/.test(x) || Number(x) < 1)) return err('ใส่จำนวน host เป็นตัวเลข 1 ขึ้นไป คั่นด้วยเครื่องหมาย , (ไม่เกิน 12 ห้อง)');
          const reqs = nums.map((x, i) => ({ name: 'ห้อง ' + String.fromCharCode(65 + i), hosts: Number(x) }));
          out.innerHTML = (netOf(blk, b) !== blk ? `<p class="nls-subnet-legend">ปรับ block เป็น network ที่ถูกต้อง: ${ipStr(netOf(blk, b))}/${b}</p>` : '') + vlsmSteps(blk, b, reqs);
          keepOpen();
        }
      }

      // ---------------- binary helper
      function renderBits() {
        const v = state.bits;
        $('[data-el="bits"]').innerHTML = [128, 64, 32, 16, 8, 4, 2, 1].map((pv) =>
          `<button type="button" class="nls-subnet-bit" data-bit="${pv}" aria-pressed="${(v & pv) ? 'true' : 'false'}" aria-label="บิตค่า ${pv}"><small>${pv}</small><b>${(v & pv) ? 1 : 0}</b></button>`).join('');
        const on = [128, 64, 32, 16, 8, 4, 2, 1].filter((pv) => v & pv);
        $('[data-el="bsum"]').textContent = `${bin8(v)} = ${on.length ? on.join(' + ') : '0'} = ${v}` + (isMaskOctet(v) ? `  (ถ้าเป็น mask: block = ${256 - v})` : '');
        const d = $('[data-el="bdec"]'); if (document.activeElement !== d) d.value = String(v);
      }
      const isMaskOctet = (v) => [128, 192, 224, 240, 248, 252, 254, 255].indexOf(v) >= 0;

      // ---------------- events (delegated; removed in destroy)
      function setTab(t) {
        state.tab = t;
        el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t)));
        el.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('nls-subnet-hide', p.getAttribute('data-pane') !== t));
        if (t === 'calc') renderCalc();
      }
      function onClick(e) {
        const t = e.target.closest('button'); if (!t || !el.contains(t)) return;
        if (t.hasAttribute('data-tab')) return setTab(t.getAttribute('data-tab'));
        if (t.hasAttribute('data-mission')) {
          const w0 = W(state.cur);
          if (w0.problem && !w0.result) { const a = {}; $('[data-el="work"]').querySelectorAll('[data-key]').forEach((i) => { a[i.getAttribute('data-key')] = i.value; }); w0.answers = a; }
          state.cur = t.getAttribute('data-mission'); renderMissions(); renderWork();
          const b = el.querySelector(`[data-mission="${state.cur}"]`); if (b) b.focus({ preventScroll: true });
          return;
        }
        if (t.hasAttribute('data-bit')) { state.bits ^= Number(t.getAttribute('data-bit')); renderBits(); const nb = el.querySelector(`[data-bit="${t.getAttribute('data-bit')}"]`); if (nb) nb.focus(); return; }
        if (t.hasAttribute('data-calcmode')) { state.calcMode = t.getAttribute('data-calcmode'); renderCalc(); return; }
        const act = t.getAttribute('data-act');
        if (act === 'new') newProblem();
        else if (act === 'hint') { const w = W(state.cur); w.hints++; renderWork(); }
        else if (act === 'clear') { W(state.cur).answers = {}; $('[data-el="work"]').querySelectorAll('[data-key]').forEach((i) => { i.value = ''; }); }
        else if (act === 'bclear') { state.bits = 0; renderBits(); }
        else if (act === 'stepsall') { const sol = t.closest('.nls-subnet-sol'); if (sol) sol.querySelectorAll('.nls-subnet-stepd').forEach((d) => { d.open = t.getAttribute('data-open') === '1'; }); }
      }
      function onSubmit(e) { if (e.target && e.target.getAttribute && e.target.getAttribute('data-el') === 'form') { e.preventDefault(); submit(); } }
      function onInput(e) {
        const t = e.target; const k = t.getAttribute && t.getAttribute('data-el');
        if (k === 'cip' || k === 'cmask' || k === 'vblk' || k === 'vpre' || k === 'vreq') renderCalc();
        else if (k === 'bdec') { const s = t.value.replace(/\D/g, ''); if (s !== '' && Number(s) <= 255) { state.bits = Number(s); renderBits(); } }
        else if (t.hasAttribute && t.hasAttribute('data-key')) { const w = W(state.cur); w.answers[t.getAttribute('data-key')] = t.value; }
      }
      function onKey(e) { // arrow keys move between tabs and missions
        const t = e.target; if (!t.closest) return;
        if (e.key === 'Enter' && !e.isComposing && coarse() && t.tagName === 'INPUT' && t.hasAttribute('data-key')) {
          // phone keyboards show "next": jump to the next empty answer; when all are filled Enter submits as on desktop
          const all = Array.from($('[data-el="work"]').querySelectorAll('[data-key]:not([disabled])')); const i = all.indexOf(t);
          const nx = all.slice(i + 1).find((x) => !x.value.trim());
          if (nx) { e.preventDefault(); nx.focus(); }
          return;
        }
        if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && t.hasAttribute('data-tab')) {
          e.preventDefault(); const nt = t.getAttribute('data-tab') === 'practice' ? 'calc' : 'practice'; setTab(nt); el.querySelector(`[data-tab="${nt}"]`).focus();
        } else if (t.hasAttribute('data-mission') && /^Arrow(Up|Down|Left|Right)$/.test(e.key)) {
          const all = Array.from(el.querySelectorAll('[data-mission]')); const i = all.indexOf(t);
          const n = all[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
          if (n) { e.preventDefault(); n.focus(); }
        }
      }
      el.addEventListener('click', onClick);
      el.addEventListener('submit', onSubmit);
      el.addEventListener('input', onInput);
      el.addEventListener('keydown', onKey);
      // on-screen keyboard: keep the focused field in view (visual viewport) and expose its height as --vvh
      const vv = window.visualViewport || null;
      let focused = null;
      const ensureVisible = () => {
        if (!focused || document.activeElement !== focused || !el.contains(focused)) return;
        const r = focused.getBoundingClientRect(); const top = vv ? vv.offsetTop : 0; const h = vv ? vv.height : window.innerHeight;
        if (r.top < top + 8 || r.bottom > top + h - 8) { try { focused.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e2) { focused.scrollIntoView(); } }
      };
      const onVv = () => { if (vv) el.style.setProperty('--vvh', Math.round(vv.height) + 'px'); ensureVisible(); };
      function onFocusIn(e) {
        const t = e.target; if (!t || !/^(INPUT|SELECT)$/.test(t.tagName)) return;
        focused = t; if (coarse()) later(ensureVisible, 300);
      }
      el.addEventListener('focusin', onFocusIn);
      if (vv) { vv.addEventListener('resize', onVv); vv.addEventListener('scroll', onVv); onVv(); }

      renderMissions(); renderWork(); renderBits();
      return {
        destroy() {
          state.alive = false;
          el.removeEventListener('click', onClick); el.removeEventListener('submit', onSubmit);
          el.removeEventListener('input', onInput); el.removeEventListener('keydown', onKey);
          el.removeEventListener('focusin', onFocusIn);
          if (vv) { vv.removeEventListener('resize', onVv); vv.removeEventListener('scroll', onVv); }
          timers.forEach((id) => clearTimeout(id)); timers.clear(); focused = null;
          if (el.parentNode) el.parentNode.removeChild(el);
        }
      };
    }
  };
})();
