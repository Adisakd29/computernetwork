'use strict';
/*
 * NetLab - Network Troubleshooting Lab (browser module, SIM-SPEC §1 + §4.5)
 * Registers window.NL_SIMS.troubleshoot. Uses window.NL_TERM (public/js/sim/terminal.js, loaded first by the app)
 * for the terminal; falls back to a minimal built-in terminal when it is missing. All network behaviour comes from
 * window.NetSim. Flow: investigate (topology + device settings + terminal) -> choose the cause -> edit settings ->
 * test (re-run the mission's success pings) -> submit { cause, topo } -> score + feedback from the server grader.
 */
(function () {
  const CSS = `
.nls-troubleshoot{--nls-troubleshoot-mono:"JetBrains Mono",Consolas,monospace;color:var(--ink);font-family:inherit;max-width:1200px;margin:0 auto;min-width:0}
.nls-troubleshoot *,.nls-troubleshoot *::before,.nls-troubleshoot *::after{box-sizing:border-box}
.nls-troubleshoot h2{font-size:24px;line-height:1.25;margin:0 0 6px}
.nls-troubleshoot h3{font-size:18px;margin:0 0 8px;line-height:1.35}
.nls-troubleshoot h4{font-size:16px;margin:10px 0 6px}
.nls-troubleshoot p{margin:0 0 8px}
.nls-troubleshoot-muted{color:var(--muted);font-size:15px}
.nls-troubleshoot-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 14px;min-width:0}
.nls-troubleshoot-btn{background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;font-size:15px;cursor:pointer;line-height:1.3;min-height:40px}
.nls-troubleshoot-btn.nls-troubleshoot-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.nls-troubleshoot-btn.nls-troubleshoot-small{min-height:32px;padding:4px 10px;font-size:14px}
.nls-troubleshoot-btn[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:var(--bg)}
.nls-troubleshoot-btn:disabled{opacity:.5;cursor:default}
.nls-troubleshoot :focus-visible,.nls-troubleshoot-ov :focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-troubleshoot-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-troubleshoot-howto summary{cursor:pointer;font-weight:600}
.nls-troubleshoot-howto ol{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-troubleshoot-missions{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin:0 0 14px}
.nls-troubleshoot-mbtn{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer;min-width:0}
.nls-troubleshoot-mbtn b{font-size:15px;line-height:1.3}
.nls-troubleshoot-mbtn span{font-size:13px;color:var(--muted)}
.nls-troubleshoot-mbtn.nls-troubleshoot-on{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-troubleshoot-best{color:var(--ok)!important;font-weight:600}
.nls-troubleshoot-lvl{font:600 11px var(--nls-troubleshoot-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.nls-troubleshoot-step{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--blue);color:var(--bg);font:700 14px var(--nls-troubleshoot-mono);margin-right:6px;vertical-align:2px}
.nls-troubleshoot-symptoms{margin:4px 0 8px;padding-left:22px}
.nls-troubleshoot-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
.nls-troubleshoot-grid>*{min-width:0}
.nls-troubleshoot-mapbox{background:var(--field);border:1px solid var(--line);border-radius:10px;padding:6px;overflow:hidden;touch-action:pan-y;-webkit-user-select:none;user-select:none;position:relative}
.nls-troubleshoot-mapbox.nls-troubleshoot-zoomed{touch-action:none;cursor:grab}
.nls-troubleshoot-mapbox.nls-troubleshoot-dragging{cursor:grabbing}
.nls-troubleshoot-mapbox svg{display:block;width:100%;height:auto;max-height:min(440px,62vh);margin:0 auto}
.nls-troubleshoot-mapbox [data-id]{cursor:pointer}
.nls-troubleshoot-mapbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 6px}
.nls-troubleshoot-mapbar .nls-troubleshoot-zl{font:600 13px var(--nls-troubleshoot-mono);color:var(--muted);min-width:44px;text-align:center}
.nls-troubleshoot-mapbar .nls-troubleshoot-sp{flex:1 1 auto}
.nls-troubleshoot-ib{display:inline-flex;align-items:center;justify-content:center;gap:6px}
.nls-troubleshoot-ib svg{width:18px;height:18px;flex:0 0 auto}
.nls-troubleshoot-maptip{font-size:13px;color:var(--muted);margin:6px 0 0}
.nls-troubleshoot-tipmouse{display:none}
@media (hover:hover) and (pointer:fine){.nls-troubleshoot-tipmouse{display:inline}.nls-troubleshoot-tiptouch{display:none}}
.nls-troubleshoot-devpick{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}
.nls-troubleshoot-devpick .nls-troubleshoot-sel{flex:1 1 200px;min-width:0}
.nls-troubleshoot-chips{display:flex;flex-wrap:wrap;gap:6px;padding:6px 0 2px;margin:2px 0 0;min-width:0;max-width:100%}
.nls-troubleshoot-chip{max-width:100%;overflow:hidden;text-overflow:ellipsis}
.nls-troubleshoot-ov .nls-troubleshoot-chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
.nls-troubleshoot-chip{flex:0 0 auto;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font:inherit;font-size:14px;cursor:pointer;min-height:32px;white-space:nowrap}
.nls-troubleshoot-chip[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:var(--bg)}
.nls-troubleshoot-stepper{list-style:none;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin:0 0 6px;padding:0;counter-reset:none}
.nls-troubleshoot-stepper li{min-width:0;position:relative}
.nls-troubleshoot-stepper li+li::before{content:"";position:absolute;top:19px;right:calc(50% + 18px);width:calc(100% - 32px);height:2px;background:var(--line)}
.nls-troubleshoot-stepper li.nls-troubleshoot-sdone+li::before{background:var(--ok)}
.nls-troubleshoot-sbtn{display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;background:transparent;border:0;color:var(--muted);font:inherit;font-size:14px;cursor:pointer;padding:2px 0;border-radius:8px;min-height:44px}
.nls-troubleshoot-sbtn i{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;border:2px solid var(--line);background:var(--panel);font:700 14px var(--nls-troubleshoot-mono);font-style:normal;color:var(--muted);position:relative;z-index:1}
.nls-troubleshoot-sbtn i svg{width:16px;height:16px}
.nls-troubleshoot-sbtn span{line-height:1.2;text-align:center;overflow-wrap:anywhere}
.nls-troubleshoot-sdone .nls-troubleshoot-sbtn i{background:var(--ok);border-color:var(--ok);color:var(--bg)}
.nls-troubleshoot-scur .nls-troubleshoot-sbtn{color:var(--ink);font-weight:700}
.nls-troubleshoot-scur .nls-troubleshoot-sbtn i{border-color:var(--blue);color:var(--blue);box-shadow:0 0 0 3px color-mix(in srgb,var(--blue) 25%,transparent)}
.nls-troubleshoot-sdone.nls-troubleshoot-scur .nls-troubleshoot-sbtn i{color:var(--bg)}
.nls-troubleshoot-snow{font-size:15px;margin:4px 0 0}
.nls-troubleshoot-step.nls-troubleshoot-stepok{background:var(--ok)}
.nls-troubleshoot-sec{scroll-margin-top:72px;scroll-margin-bottom:calc(var(--nl-bnav,0px) + 16px)}
.nls-troubleshoot-sum{list-style:none;margin:4px 0 10px;padding:0;font-size:15px}
.nls-troubleshoot-sum li{display:flex;gap:8px;align-items:flex-start;padding:3px 0}
.nls-troubleshoot-sum b{flex:0 0 auto}
.nls-troubleshoot-ov{position:fixed;inset:0;z-index:70;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;height:var(--vvh,100dvh);max-height:100dvh;padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));gap:6px;font-family:inherit}
.nls-troubleshoot-ov *,.nls-troubleshoot-ov *::before,.nls-troubleshoot-ov *::after{box-sizing:border-box}
.nls-troubleshoot-ovhead{display:flex;align-items:center;gap:8px}
.nls-troubleshoot-ovhead h3{flex:1 1 auto;min-width:0;margin:0;font-size:17px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nls-troubleshoot-ov .nls-troubleshoot-mapbox{flex:1 1 auto;min-height:0;display:flex}
.nls-troubleshoot-ov .nls-troubleshoot-mapbox svg{width:100%!important;height:100%!important;max-height:none;max-width:none!important}
.nls-troubleshoot-ovinfo{font-size:14px;margin:0;min-height:1.4em;overflow-wrap:anywhere}
.nls-troubleshoot-ovinfo code{font-family:var(--nls-troubleshoot-mono);font-size:13px}
.nls-troubleshoot-ovtip{display:none;font-size:13px;color:var(--muted);margin:0}
@media (orientation:portrait) and (max-width:759px){.nls-troubleshoot-ovtip{display:block}}
@media (max-height:500px){.nls-troubleshoot-ov{gap:4px;padding-top:4px}.nls-troubleshoot-ov .nls-troubleshoot-mapbar{margin:0}.nls-troubleshoot-ov .nls-troubleshoot-chips{padding-top:0}}
html.nls-troubleshoot-noscroll,html.nls-troubleshoot-noscroll body{overflow:hidden}
@media (max-width:759px){
}
@media (prefers-reduced-motion:no-preference){.nls-troubleshoot-sbtn i{transition:background .2s,border-color .2s}}
.nls-troubleshoot-sel{background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 8px;font:inherit;font-size:15px;min-height:40px;max-width:100%}
.nls-troubleshoot-detail{margin-top:10px;border-top:1px solid var(--line);padding-top:8px}
.nls-troubleshoot-kv{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:3px 12px;font-size:15px;margin:0}
.nls-troubleshoot-kv dt{color:var(--muted)}
.nls-troubleshoot-kv dd{margin:0;font-family:var(--nls-troubleshoot-mono);font-size:14px;word-break:break-word}
.nls-troubleshoot-led{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:0;background:var(--line);border:1px solid var(--muted)}
.nls-troubleshoot-led.nls-troubleshoot-up{background:var(--ok);border-color:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 25%,transparent)}
.nls-troubleshoot-led.nls-troubleshoot-down{background:var(--bad);border-color:var(--bad)}
.nls-troubleshoot-table{width:100%;border-collapse:collapse;font-size:14px;margin:4px 0}
.nls-troubleshoot-table th,.nls-troubleshoot-table td{border-bottom:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}
.nls-troubleshoot-table td{font-family:var(--nls-troubleshoot-mono);font-size:13px}
.nls-troubleshoot-tw{overflow-x:auto;max-width:100%}
.nls-troubleshoot-causes{display:grid;gap:6px}
.nls-troubleshoot-causes label{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--line);border-radius:8px;padding:8px 10px;cursor:pointer;font-size:15px;line-height:1.4;background:var(--field)}
.nls-troubleshoot-causes input{margin-top:4px;flex:0 0 auto;width:18px;height:18px;accent-color:var(--blue)}
.nls-troubleshoot-causes label:has(input:checked){border-color:var(--blue);box-shadow:inset 0 0 0 1px var(--blue)}
.nls-troubleshoot-form{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 10px;align-items:center;font-size:15px}
.nls-troubleshoot-form input[type=text]{width:100%;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 9px;font:14px var(--nls-troubleshoot-mono);min-height:38px;min-width:0}
.nls-troubleshoot-form input[type=text]:disabled{opacity:.55}
.nls-troubleshoot-form .nls-troubleshoot-err{grid-column:1/-1;color:var(--bad);font-size:14px;margin:-4px 0 0}
.nls-troubleshoot-check{display:flex;align-items:center;gap:8px;font-size:15px;min-height:34px;cursor:pointer}
.nls-troubleshoot-check input{width:18px;height:18px;accent-color:var(--blue)}
.nls-troubleshoot-route{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:6px;align-items:center;margin:6px 0}
.nls-troubleshoot-route input{width:100%;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 8px;font:13px var(--nls-troubleshoot-mono);min-height:38px;min-width:0}
.nls-troubleshoot-changes{font-size:14px;margin:6px 0 0;padding-left:20px}
.nls-troubleshoot-msg{min-height:1.3em;font-size:15px;margin:6px 0 0}
.nls-troubleshoot-ok{color:var(--ok)}
.nls-troubleshoot-bad{color:var(--bad)}
.nls-troubleshoot-tests{list-style:none;padding:0;margin:8px 0}
.nls-troubleshoot-tests li{padding:6px 0;border-bottom:1px solid var(--line);font-size:15px}
.nls-troubleshoot-tests pre{font:12px/1.4 var(--nls-troubleshoot-mono);background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 8px;overflow-x:auto;margin:6px 0 0;white-space:pre}
.nls-troubleshoot-tests summary{cursor:pointer;color:var(--muted);font-size:14px}
.nls-troubleshoot-score{font-size:22px;font-weight:700;margin:4px 0}
.nls-troubleshoot-fb{margin:6px 0 0;padding-left:22px;font-size:15px}
.nls-troubleshoot-fb li{margin:2px 0}
.nls-troubleshoot-hints{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-troubleshoot-fallback{background:var(--term-bg,#0F1A24);color:var(--term-ink,#CFE3D6);border-radius:10px;padding:8px;font:13px/1.45 var(--nls-troubleshoot-mono)}
.nls-troubleshoot-fallback pre{margin:0;white-space:pre;overflow:auto;height:300px}
.nls-troubleshoot-fallback input{width:100%;background:transparent;border:0;border-top:1px solid var(--term-dim,#7C93A6);color:inherit;font:inherit;padding:6px 0 0}
@media (max-width:980px){.nls-troubleshoot-grid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:520px){
  .nls-troubleshoot-card{padding:12px 10px}
  .nls-troubleshoot h2{font-size:20px}
  .nls-troubleshoot-form{grid-template-columns:minmax(0,1fr)}
  .nls-troubleshoot-missions{grid-template-columns:repeat(2,minmax(0,1fr))}
  .nls-troubleshoot-mbtn{padding:7px 9px}
  .nls-troubleshoot-route{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .nls-troubleshoot-stepper .nls-troubleshoot-sbtn{font-size:13px}
}
@media (pointer:coarse){
  .nls-troubleshoot-btn,.nls-troubleshoot-btn.nls-troubleshoot-small{min-height:44px;min-width:44px}
  .nls-troubleshoot-sel{min-height:44px;font-size:16px}
  .nls-troubleshoot-chip{min-height:44px;padding:6px 14px}
  .nls-troubleshoot-check{min-height:44px;padding:4px 0}
  .nls-troubleshoot-check input,.nls-troubleshoot-causes input{width:22px;height:22px}
  .nls-troubleshoot-causes label{min-height:48px;align-items:center;padding:10px 12px}
  .nls-troubleshoot-causes input{margin-top:0}
  .nls-troubleshoot-form input[type=text],.nls-troubleshoot-route input{min-height:44px;font-size:16px}
  .nls-troubleshoot-howto summary,.nls-troubleshoot-tests summary{min-height:44px;display:flex;align-items:center}
  .nls-troubleshoot-mbtn{min-height:44px}
}
`;
  const injectCss = () => {
    if (document.getElementById('nls-troubleshoot-css')) return;
    const st = document.createElement('style'); st.id = 'nls-troubleshoot-css'; st.textContent = CSS; document.head.appendChild(st);
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = x => JSON.parse(JSON.stringify(x));
  const LV = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
  const TYPE_TH = { pc: 'คอมพิวเตอร์ (PC)', laptop: 'โน้ตบุ๊ก', server: 'Server', printer: 'เครื่องพิมพ์', switch: 'Switch', router: 'Router', ap: 'Access Point', internet: 'อินเทอร์เน็ต (ISP)' };
  const LINK_TH = { ok: 'เชื่อมต่อปกติ', down: 'ไม่มีสัญญาณ: สายไม่ได้เสียบ/ขาด', iface_down: 'ไม่มีสัญญาณ: การ์ดแลนปลายสายถูกปิด', ssid: 'Wi-Fi ไม่ได้เชื่อมต่อ (Not connected)',
    wifi_wrong_end: 'ต่อ Wi-Fi ผิดอุปกรณ์', port_in_use: 'พอร์ตซ้ำ', bad_link: 'สายเสีย' };
  const isHost = t => ['pc', 'laptop', 'server', 'printer'].includes(t);
  const NS = () => window.NetSim;

  // ---------- light-weight change list (same idea as the grader's diff; only for showing the student)
  function fieldsOf(d) {
    if (isHost(d.type)) {
      const f = (d.ifaces && d.ifaces[0]) || {};
      const p = NS().ip.toPrefix(f.prefix);
      return { ip: String(f.ip || ''), prefix: p === null ? String(f.prefix || '') : String(p), gateway: String(d.gateway || ''), dns: (d.dns || []).join(','),
        dhcp: String(!!d.dhcp), up: String(f.up !== false), ssid: String(d.ssid || ''), icmp: String(!(d.firewall && d.firewall.icmp === false)) };
    }
    if (d.type === 'router') return { routes: (d.routes || []).map(r => `${r.net}/${r.prefix} via ${r.via}`).sort().join('; ') };
    return {};
  }
  const FIELD_TH = { ip: 'IP address', prefix: 'Subnet mask', gateway: 'Default gateway', dns: 'DNS server', dhcp: 'DHCP', up: 'Network adapter', ssid: 'SSID', icmp: 'Firewall อนุญาต ping', routes: 'Static routes' };
  function changes(base, work) {
    const out = [];
    base.devices.forEach(b => {
      const w = work.devices.find(x => x.id === b.id); if (!w) return;
      const fa = fieldsOf(b), fb = fieldsOf(w);
      Object.keys(fa).forEach(k => { if (fa[k] !== fb[k]) out.push(`${b.name}: ${FIELD_TH[k]} ${show(k, fa[k])} → ${show(k, fb[k])}`); });
    });
    base.links.forEach(b => {
      const w = work.links.find(x => x.id === b.id); if (!w) return;
      if ((b.up !== false) !== (w.up !== false)) out.push(`สาย ${b.id}: ${w.up !== false ? 'เสียบสายแล้ว' : 'ถอดสาย'}`);
    });
    return out;
  }
  function show(k, v) {
    if (k === 'dhcp') return v === 'true' ? 'เปิด' : 'ปิด';
    if (k === 'up' || k === 'icmp') return v === 'true' ? 'เปิด' : 'ปิด';
    if (k === 'prefix') return v ? '/' + v : '(ว่าง)';
    return v ? v : '(ว่าง)';
  }

  // ---------- minimal fallback terminal (used only when NL_TERM is missing)
  function fallbackTerm(container, o) {
    const box = document.createElement('div'); box.className = 'nls-troubleshoot-fallback';
    box.innerHTML = '<pre aria-live="polite"></pre><input type="text" aria-label="พิมพ์คำสั่ง (ping, tracert, nslookup, ipconfig)" autocomplete="off" spellcheck="false">';
    container.appendChild(box);
    const pre = box.querySelector('pre'), inp = box.querySelector('input');
    let net = o.net, host = o.hostId;
    const print = L => { pre.textContent += L.join('\n') + '\n'; pre.scrollTop = pre.scrollHeight; };
    print(['ระบบ terminal แบบย่อ: ใช้ได้ ipconfig, ping, tracert, nslookup', '']);
    const run = cmd => {
      const t = cmd.trim().split(/\s+/), c = (t[0] || '').toLowerCase(), a = t[1];
      print(['> ' + cmd]);
      if (o.onCommand) o.onCommand(cmd, host);
      if (c === 'ping' && a) print(net.ping(host, a).win);
      else if (c === 'tracert' && a) print(net.traceroute(host, a).win);
      else if (c === 'nslookup' && a) print(net.nslookup(host, a, t[2]).win);
      else if (c === 'ipconfig') { const g = net.config(host) || {}; print(['IPv4 Address: ' + (g.ip || '-'), 'Subnet Mask: ' + (g.mask || '-'), 'Default Gateway: ' + (g.gateway || ''), 'DNS Servers: ' + (g.dns || []).join(', ')]); }
      else print([`'${t[0] || ''}' is not recognized as an internal or external command,`, 'operable program or batch file.']);
      print(['']);
    };
    const onKey = e => { if (e.key === 'Enter') { e.preventDefault(); const v = inp.value; inp.value = ''; run(v); } };
    inp.addEventListener('keydown', onKey);
    return {
      run, focus() { inp.focus(); }, setNet(n) { net = n; }, setHost(h) { host = h; print(['--- ' + h + ' ---']); }, getNet() { return net; },
      destroy() { inp.removeEventListener('keydown', onKey); box.remove(); }
    };
  }

  // ---------- icons (inline SVG, currentColor)
  const IC = {
    plus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
    minus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
    fit: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    full: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3H3v5M12 3h5v5M17 12v5h-5M3 12v5h5M3 3l5 5M17 3l-5 5M17 17l-5-5M3 17l5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    close: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
    check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
  };
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /*
   * Zoom/pan viewer for an SVG rendered into `box` (innerHTML is replaced on every redraw; call refresh() after).
   * View state = zoom z (1 = whole topology) + center (cx, cy) in SVG units, so it survives re-renders.
   * Buttons, one-pointer drag (when zoomed) and two-pointer pinch. A drag/pinch suppresses the following click so
   * tapping a device still selects it but panning does not.
   */
  const ZMAX = 5;
  function makeViewer(box, opt) {
    opt = opt || {};
    const V = { z: 1, cx: null, cy: null, base: null, moved: false };
    const pts = new Map();
    let g = null; // gesture start
    const svg = () => box.querySelector('svg');
    const fitRect = () => {
      const b = V.base, s = svg();
      const r = s ? s.getBoundingClientRect() : null;
      if (!r || r.width < 2 || r.height < 2) return { x: b.x, y: b.y, w: b.w, h: b.h };
      const ea = r.width / r.height, ba = b.w / b.h;
      if (ea > ba) { const w = b.h * ea; return { x: b.x - (w - b.w) / 2, y: b.y, w, h: b.h }; }
      const h = b.w / ea; return { x: b.x, y: b.y - (h - b.h) / 2, w: b.w, h };
    };
    function apply() {
      const s = svg(); if (!s || !V.base) return;
      const f = fitRect();
      V.z = Math.min(ZMAX, Math.max(1, V.z));
      if (V.z <= 1.001) { V.z = 1; V.cx = f.x + f.w / 2; V.cy = f.y + f.h / 2; }
      const w = f.w / V.z, h = f.h / V.z;
      V.cx = Math.min(Math.max(V.cx, f.x + w / 2), f.x + f.w - w / 2);
      V.cy = Math.min(Math.max(V.cy, f.y + h / 2), f.y + f.h - h / 2);
      const r = n => Math.round(n * 100) / 100;
      s.setAttribute('viewBox', `${r(V.cx - w / 2)} ${r(V.cy - h / 2)} ${r(w)} ${r(h)}`);
      s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      box.classList.toggle('nls-troubleshoot-zoomed', V.z > 1);
      box.dataset.zoom = String(Math.round(V.z * 100) / 100);
      if (opt.onZoom) opt.onZoom(V.z);
    }
    function refresh() {
      const s = svg(); if (!s) return;
      const vb = (s.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      if (vb.length === 4 && vb.every(isFinite) && vb[2] > 0 && vb[3] > 0) {
        const nb = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
        if (!V.base || V.base.x !== nb.x || V.base.y !== nb.y || V.base.w !== nb.w || V.base.h !== nb.h) {
          if (!V.base) { V.cx = nb.x + nb.w / 2; V.cy = nb.y + nb.h / 2; }
          V.base = nb;
        }
      }
      if (!V.base) return;
      s.removeAttribute('width'); s.removeAttribute('height');
      if (opt.fill) { s.style.width = '100%'; s.style.height = '100%'; }
      else { s.style.width = '100%'; s.style.height = 'auto'; s.style.aspectRatio = `${V.base.w} / ${V.base.h}`; }
      apply();
    }
    // screen px -> svg units for the current view
    const scale = () => { const s = svg(), r = s && s.getBoundingClientRect(); const f = fitRect(); return r && r.width ? (f.w / V.z) / r.width : 1; };
    function zoomAt(nz, px, py) {
      const s = svg(); if (!s || !V.base) return;
      nz = Math.min(ZMAX, Math.max(1, nz));
      const r = s.getBoundingClientRect();
      if (px === undefined) { px = r.left + r.width / 2; py = r.top + r.height / 2; }
      const k0 = scale();
      const f = fitRect();
      const w0 = f.w / V.z, h0 = f.h / V.z;
      const sx = V.cx - w0 / 2 + (px - r.left) * k0, sy = V.cy - h0 / 2 + (py - r.top) * k0; // svg point under (px,py)
      V.z = nz;
      const k1 = (f.w / nz) / r.width, w1 = f.w / nz, h1 = f.h / nz;
      V.cx = sx - (px - r.left) * k1 + w1 / 2; V.cy = sy - (py - r.top) * k1 + h1 / 2;
      apply();
    }
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    function startGesture() {
      const p = [...pts.values()];
      if (p.length >= 2) {
        const m = mid(p[0], p[1]), s = svg(), r = s.getBoundingClientRect(), k = scale(), f = fitRect();
        g = { pinch: true, d0: Math.max(10, dist(p[0], p[1])), z0: V.z, sx: V.cx - (f.w / V.z) / 2 + (m.x - r.left) * k, sy: V.cy - (f.h / V.z) / 2 + (m.y - r.top) * k };
      } else if (p.length === 1) {
        g = { pinch: false, x: p[0].x, y: p[0].y, cx: V.cx, cy: V.cy, k: scale() };
      } else g = null;
    }
    function down(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!V.base) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      if (pts.size === 1) V.moved = false;
      startGesture();
    }
    function move(e) {
      const p = pts.get(e.pointerId); if (!p || !g) return;
      p.x = e.clientX; p.y = e.clientY;
      if (g.pinch && pts.size >= 2) {
        const a = [...pts.values()], d = dist(a[0], a[1]), m = mid(a[0], a[1]);
        const s = svg(), r = s.getBoundingClientRect(), f = fitRect();
        const nz = Math.min(ZMAX, Math.max(1, g.z0 * d / g.d0));
        const k1 = (f.w / nz) / r.width;
        V.z = nz;
        V.cx = g.sx - (m.x - r.left) * k1 + (f.w / nz) / 2; V.cy = g.sy - (m.y - r.top) * k1 + (f.h / nz) / 2;
        V.moved = true; e.preventDefault(); apply();
      } else if (!g.pinch && V.z > 1) {
        const dx = p.x - g.x, dy = p.y - g.y;
        if (!V.moved && Math.hypot(dx, dy) < 6) return;
        if (!V.moved) { V.moved = true; box.classList.add('nls-troubleshoot-dragging'); if (e.pointerType === 'mouse') { try { box.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } } }
        V.cx = g.cx - dx * g.k; V.cy = g.cy - dy * g.k;
        e.preventDefault(); apply();
      }
    }
    function up(e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      box.classList.remove('nls-troubleshoot-dragging');
      startGesture();
      if (e.type === 'pointercancel' && !pts.size) V.moved = false;
    }
    function click(e) { if (V.moved) { e.stopPropagation(); e.preventDefault(); V.moved = false; } }
    function wheel(e) { // ctrl/cmd + wheel (and trackpad pinch) zooms; plain wheel keeps scrolling the page
      if (!(e.ctrlKey || e.metaKey) || !V.base) return;
      e.preventDefault(); zoomAt(V.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
    }
    box.addEventListener('pointerdown', down);
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
    box.addEventListener('click', click, true);
    box.addEventListener('wheel', wheel, { passive: false });
    return {
      refresh, apply,
      zoomIn() { zoomAt(V.z * 1.5); }, zoomOut() { zoomAt(V.z / 1.5); }, fit() { V.z = 1; apply(); },
      get z() { return V.z; },
      destroy() {
        box.removeEventListener('pointerdown', down); box.removeEventListener('pointermove', move);
        box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up);
        box.removeEventListener('click', click, true); box.removeEventListener('wheel', wheel);
      }
    };
  }
  const mapBar = (extra) => `<div class="nls-troubleshoot-mapbar" role="toolbar" aria-label="ซูมแผนผัง">
<button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-small nls-troubleshoot-ib" data-z="out" aria-label="ซูมออก" title="ซูมออก">${IC.minus}</button>
<span class="nls-troubleshoot-zl" aria-live="polite">100%</span>
<button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-small nls-troubleshoot-ib" data-z="in" aria-label="ซูมเข้า" title="ซูมเข้า">${IC.plus}</button>
<button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-small nls-troubleshoot-ib" data-z="fit" aria-label="พอดีกรอบ (เห็นทั้งแผนผัง)" title="พอดีกรอบ">${IC.fit}<span>พอดี</span></button>
<span class="nls-troubleshoot-sp"></span>${extra || ''}</div>`;

  // ======================================================================== mount
  function mount(root, ctx) {
    injectCss();
    ctx = ctx || {};
    const missions = Array.isArray(ctx.missions) ? ctx.missions.filter(m => m && m.start && m.start.topo) : [];
    const done = Object.assign({}, ctx.done || {});
    const S = { m: null, work: null, net: null, sel: null, edit: null, cause: null, term: null, termHost: null,
      explored: false, test: null, submitted: false, viewer: null, ov: null, ovViewer: null, ovReturn: null };
    const cleanups = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); cleanups.push(() => el.removeEventListener(ev, fn, o)); };

    const wrap = document.createElement('div');
    wrap.className = 'nls-troubleshoot';
    wrap.innerHTML = `
<h2>ห้องปฏิบัติการแก้ไขปัญหาเครือข่าย</h2>
<p class="nls-troubleshoot-muted">สืบหาสาเหตุของปัญหาจากอาการ ทดสอบด้วยคำสั่งจริง แก้ไขให้ตรงจุด แล้วพิสูจน์ด้วยการทดสอบ</p>
<details class="nls-troubleshoot-card nls-troubleshoot-howto"><summary>คำแนะนำการใช้งาน</summary><ol>
<li><b>สำรวจ</b>: อ่านอาการ คลิกอุปกรณ์ในแผนผังเพื่อดูค่าตั้ง (IP, ไฟสถานะสาย, ตาราง route, DNS) และพิมพ์คำสั่งใน terminal (ipconfig /all, ping, tracert, nslookup ...)</li>
<li><b>เลือกสาเหตุ</b> ที่คิดว่าเป็นต้นเหตุจริงจากรายการ</li>
<li><b>แก้ไขการตั้งค่า</b> เฉพาะจุดที่ผิด (แก้เกินจุดจะเสียคะแนน "แก้ไขเกินขอบเขต") — เปลี่ยน IP, mask, gateway, DNS, DHCP, เปิดการ์ดแลน, เสียบสาย, เพิ่ม route, SSID หรือ Firewall</li>
<li><b>ทดสอบ</b>: ระบบ ping ตามเงื่อนไขของภารกิจให้ดูว่าผ่านหรือยัง แล้ว <b>ส่งงาน</b> (สาเหตุ 4 คะแนน + การแก้ไข 6 คะแนน)</li>
<li>กด <b>เริ่มใหม่</b> เพื่อคืนค่าเครือข่ายของภารกิจเป็นแบบเดิม</li>
</ol></details>
<div class="nls-troubleshoot-missions" role="list"></div>
<div class="nls-troubleshoot-main"></div>`;
    root.appendChild(wrap);
    const mlist = wrap.querySelector('.nls-troubleshoot-missions');
    const main = wrap.querySelector('.nls-troubleshoot-main');
    const $ = s => main.querySelector(s);

    function renderList() {
      mlist.innerHTML = '';
      missions.forEach((m, i) => {
        const d = done[m.id];
        const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'listitem');
        b.className = 'nls-troubleshoot-mbtn' + (S.m && S.m.id === m.id ? ' nls-troubleshoot-on' : '');
        b.innerHTML = `<span class="nls-troubleshoot-lvl">${i + 1} · ${esc(LV[m.level] || m.level || '')}</span><b>${esc(m.title)}</b>` +
          `<span${d && typeof d.best === 'number' ? ' class="nls-troubleshoot-best"' : ''}>${d && typeof d.best === 'number' ? `คะแนนดีที่สุด ${esc(d.best)}/${esc(d.max || m.max || 10)}` : 'ยังไม่ทำ'}</span>`;
        b.addEventListener('click', () => open(m));
        mlist.appendChild(b);
      });
    }
    const dev = id => S.work.devices.find(d => d.id === id);
    const devName = id => { const d = dev(id); return d ? d.name : id; };
    const linksOf = id => S.work.links.filter(l => l.a.dev === id || l.b.dev === id);
    const otherEnd = (l, id) => l.a.dev === id ? l.b : l.a;
    const ownEnd = (l, id) => l.a.dev === id ? l.a : l.b;

    function rebuild(opts) {
      S.net = NS().create(S.work);
      drawMap(); drawDetail(); drawChanges();
      if (S.term) S.term.setNet(S.net);
      if (!(opts && opts.keepTests)) { const t = $('.nls-troubleshoot-testres'); if (t) t.innerHTML = ''; S.test = null; }
      drawProgress();
    }

    // ------------------------------------------------------------ stepper (สำรวจ → วิเคราะห์ → แก้ไข → ทดสอบ → ส่งงาน)
    const STAGES = [
      { n: 1, name: 'สำรวจ', todo: 'ดูแผนผัง แตะอุปกรณ์เพื่อดูค่าตั้ง และลองคำสั่งใน Terminal' },
      { n: 2, name: 'วิเคราะห์', todo: 'เลือกสาเหตุที่คิดว่าเป็นต้นเหตุจริง' },
      { n: 3, name: 'แก้ไข', todo: 'แก้การตั้งค่าเฉพาะจุดที่ผิด แล้วกดบันทึก' },
      { n: 4, name: 'ทดสอบ', todo: 'กดปุ่มทดสอบให้ผ่านทุกรายการ' },
      { n: 5, name: 'ส่งงาน', todo: 'ตรวจสรุปแล้วกดส่งงาน' }
    ];
    function stageDone() {
      if (!S.m) return [false, false, false, false, false];
      const fixed = changes(S.m.start.topo, S.work).length > 0;
      const tested = !!(S.test && S.test.all);
      return [S.explored || !!S.cause || fixed, !!S.cause, fixed, tested, S.submitted];
    }
    function curStage() { const d = stageDone(); const i = d.indexOf(false); return i < 0 ? 5 : i + 1; }
    function goStage(n) {
      const sec = main.querySelector(`[data-stage="${n}"]`); if (!sec) return;
      sec.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
      const h = sec.querySelector('h3'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }
    }
    function drawProgress() {
      const st = $('.nls-troubleshoot-stepper'); if (!st) return;
      const d = stageDone(), cur = curStage();
      st.querySelectorAll('li').forEach((li, i) => {
        li.classList.toggle('nls-troubleshoot-sdone', d[i]);
        li.classList.toggle('nls-troubleshoot-scur', cur === i + 1);
        const b = li.querySelector('button');
        b.querySelector('i').innerHTML = d[i] ? IC.check : String(i + 1);
        b.setAttribute('aria-label', `ขั้นที่ ${i + 1} ${STAGES[i].name}: ${d[i] ? 'เสร็จแล้ว' : cur === i + 1 ? 'ขั้นปัจจุบัน' : 'ยังไม่เสร็จ'}`);
        if (cur === i + 1) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      main.querySelectorAll('.nls-troubleshoot-step[data-n]').forEach(x => x.classList.toggle('nls-troubleshoot-stepok', !!d[+x.dataset.n - 1]));
      const s = STAGES[cur - 1];
      const now = $('.nls-troubleshoot-snow');
      if (now) now.innerHTML = S.submitted ? `<b class="nls-troubleshoot-ok">ส่งงานแล้ว</b> — ดูคะแนนในขั้นที่ 5 หรือแก้ไขแล้วส่งใหม่ได้` : `<b>ตอนนี้: ขั้นที่ ${cur} ${esc(s.name)}</b> — ${esc(s.todo)}`;
      // summary inside the submit section
      const sum = $('.nls-troubleshoot-sum');
      if (sum) {
        const cs = (S.m.start.causes || []).find(c => c.id === S.cause);
        const ch = changes(S.m.start.topo, S.work).length;
        sum.innerHTML = `<li><b>${d[1] ? '<span class="nls-troubleshoot-ok">✓</span>' : '<span class="nls-troubleshoot-bad">✗</span>'} สาเหตุ:</b><span>${cs ? esc(cs.text) : 'ยังไม่ได้เลือก (ขั้นที่ 2)'}</span></li>` +
          `<li><b>${ch ? '<span class="nls-troubleshoot-ok">✓</span>' : '<span class="nls-troubleshoot-bad">✗</span>'} การแก้ไข:</b><span>${ch ? ch + ' รายการ' : 'ยังไม่ได้แก้ไข (ขั้นที่ 3)'}</span></li>` +
          `<li><b>${d[3] ? '<span class="nls-troubleshoot-ok">✓</span>' : '<span class="nls-troubleshoot-bad">✗</span>'} ผลทดสอบ:</b><span>${S.test ? `ผ่าน ${S.test.ok}/${S.test.n} รายการ` : 'ยังไม่ได้ทดสอบ (ขั้นที่ 4)'}</span></li>`;
      }
    }
    function open(m) {
      if (S.term) { S.term.destroy(); S.term = null; }
      closeFull();
      S.m = m; S.work = clone(m.start.topo); S.cause = null; S.explored = false; S.test = null; S.submitted = false;
      S.sel = m.start.focusHost || S.work.devices[0].id; S.edit = S.sel;
      const hosts = (m.start.hosts && m.start.hosts.length ? m.start.hosts : [S.sel]).filter(h => S.work.devices.some(d => d.id === h));
      S.termHost = hosts[0] || S.sel;
      renderList();
      const st = m.start;
      const devOpts = S.work.devices.map(d => `<option value="${esc(d.id)}">${esc(d.name)} — ${esc(TYPE_TH[d.type] || d.type)}</option>`).join('');
      main.innerHTML = `
<section class="nls-troubleshoot-card">
  <span class="nls-troubleshoot-lvl">${esc(LV[m.level] || '')}</span>
  <h3>${esc(m.title)}</h3>
  <p>${esc(st.story || m.desc || '')}</p>
  <b>อาการที่พบ</b>
  <ul class="nls-troubleshoot-symptoms">${(st.symptoms || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
  <div class="nls-troubleshoot-row">
    <button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-hintbtn" aria-expanded="false">คำใบ้</button>
    <button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-reset">เริ่มใหม่ (คืนค่าเครือข่าย)</button>
  </div>
  <ul class="nls-troubleshoot-hints" hidden>${(m.hints || []).map(h => `<li>${esc(h)}</li>`).join('')}</ul>
</section>
<nav class="nls-troubleshoot-card nls-troubleshoot-progress" aria-label="ขั้นตอนการแก้ปัญหา">
  <ol class="nls-troubleshoot-stepper">${STAGES.map(s => `<li><button type="button" class="nls-troubleshoot-sbtn" data-go="${s.n}"><i>${s.n}</i><span>${esc(s.name)}</span></button></li>`).join('')}</ol>
  <p class="nls-troubleshoot-snow" aria-live="polite"></p>
</nav>
<div class="nls-troubleshoot-grid">
  <section class="nls-troubleshoot-card nls-troubleshoot-sec" data-stage="1">
    <h3><span class="nls-troubleshoot-step" data-n="1">1</span>สำรวจ: แผนผังเครือข่าย</h3>
    <p class="nls-troubleshoot-muted">แตะ/คลิกอุปกรณ์ในแผนผังเพื่อดูค่าตั้ง (อ่านอย่างเดียว) หรือเลือกจากรายการ</p>
    ${mapBar(`<button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-small nls-troubleshoot-ib nls-troubleshoot-fullbtn" aria-haspopup="dialog">${IC.full}<span>เต็มจอ</span></button>`)}
    <div class="nls-troubleshoot-mapbox" aria-label="แผนผังเครือข่าย"></div>
    <p class="nls-troubleshoot-maptip"><span class="nls-troubleshoot-tiptouch">ซูมด้วยปุ่ม + / − หรือใช้สองนิ้วถ่างจอ เมื่อซูมแล้วลากด้วยนิ้วเดียวเพื่อเลื่อนดู</span><span class="nls-troubleshoot-tipmouse">ซูมด้วยปุ่ม + / − หรือกด Ctrl + หมุนล้อเมาส์ เมื่อซูมแล้วลากด้วยเมาส์เพื่อเลื่อนดู</span></p>
    <div class="nls-troubleshoot-devpick"><label for="nls-troubleshoot-dsel">อุปกรณ์:</label>
      <select id="nls-troubleshoot-dsel" class="nls-troubleshoot-sel nls-troubleshoot-dsel">${devOpts}</select></div>
    <div class="nls-troubleshoot-chips" role="group" aria-label="เลือกอุปกรณ์">${S.work.devices.map(d => `<button type="button" class="nls-troubleshoot-chip" data-dev="${esc(d.id)}" aria-pressed="false">${esc(d.name)}</button>`).join('')}</div>
    <div class="nls-troubleshoot-detail" aria-live="polite"></div>
  </section>
  <section class="nls-troubleshoot-card nls-troubleshoot-sec" data-stage="1t">
    <h3><span class="nls-troubleshoot-step" data-n="1">1</span>สำรวจ: ทดสอบด้วยคำสั่ง (Terminal)</h3>
    <div class="nls-troubleshoot-row nls-troubleshoot-thosts" role="group" aria-label="เลือกเครื่องที่จะใช้ terminal" style="margin-bottom:8px"></div>
    <div class="nls-troubleshoot-termbox"></div>
  </section>
</div>
<div class="nls-troubleshoot-grid">
  <section class="nls-troubleshoot-card nls-troubleshoot-sec" data-stage="2">
    <h3><span class="nls-troubleshoot-step" data-n="2">2</span>วิเคราะห์: เลือกสาเหตุ</h3>
    <div class="nls-troubleshoot-causes" role="radiogroup" aria-label="สาเหตุของปัญหา">${(st.causes || []).map(c => `<label><input type="radio" name="nls-troubleshoot-cause" value="${esc(c.id)}"><span>${esc(c.text)}</span></label>`).join('')}</div>
  </section>
  <section class="nls-troubleshoot-card nls-troubleshoot-sec" data-stage="3">
    <h3><span class="nls-troubleshoot-step" data-n="3">3</span>แก้ไขการตั้งค่า</h3>
    <div class="nls-troubleshoot-row"><label for="nls-troubleshoot-esel">อุปกรณ์ที่จะแก้:</label>
      <select id="nls-troubleshoot-esel" class="nls-troubleshoot-sel nls-troubleshoot-esel">${devOpts}</select></div>
    <div class="nls-troubleshoot-editor"></div>
    <div class="nls-troubleshoot-msg nls-troubleshoot-emsg" role="status"></div>
    <h4>การแก้ไขของคุณ</h4>
    <ul class="nls-troubleshoot-changes"></ul>
  </section>
</div>
<div class="nls-troubleshoot-grid">
<section class="nls-troubleshoot-card nls-troubleshoot-sec" data-stage="4">
  <h3><span class="nls-troubleshoot-step" data-n="4">4</span>ทดสอบ</h3>
  <p class="nls-troubleshoot-muted">เงื่อนไขผ่าน: ${(st.successPings || []).map(p => `ping จาก ${esc(devName(p[0]))} ไป ${esc(p[1])}`).join(' · ')}</p>
  <div class="nls-troubleshoot-row">
    <button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-test">ทดสอบ</button>
  </div>
  <div class="nls-troubleshoot-testres" aria-live="polite"></div>
</section>
<section class="nls-troubleshoot-card nls-troubleshoot-sec nls-troubleshoot-subsec" data-stage="5">
  <h3><span class="nls-troubleshoot-step" data-n="5">5</span>ส่งงาน</h3>
  <ul class="nls-troubleshoot-sum" aria-live="polite"></ul>
  <div class="nls-troubleshoot-row">
    <button type="button" class="nls-troubleshoot-btn nls-troubleshoot-submit">ส่งงาน</button>
  </div>
  <div class="nls-troubleshoot-msg nls-troubleshoot-smsg" role="status"></div>
  <div class="nls-troubleshoot-result" aria-live="polite"></div>
</section>
</div>`;
      // events
      const hb = $('.nls-troubleshoot-hintbtn'), hl = $('.nls-troubleshoot-hints');
      hb.addEventListener('click', () => { hl.hidden = !hl.hidden; hb.setAttribute('aria-expanded', String(!hl.hidden)); });
      $('.nls-troubleshoot-reset').addEventListener('click', () => {
        S.work = clone(m.start.topo);
        rebuild(); drawEditor();
        if (S.term && S.term.setNet) S.term.setNet(S.net, { reset: true });
        $('.nls-troubleshoot-emsg').textContent = 'คืนค่าเครือข่ายเป็นแบบเริ่มต้นแล้ว';
        $('.nls-troubleshoot-result').innerHTML = '';
      });
      const dsel = $('.nls-troubleshoot-dsel'), esel = $('.nls-troubleshoot-esel');
      dsel.value = S.sel; esel.value = S.edit;
      dsel.addEventListener('change', () => selectDev(dsel.value));
      esel.addEventListener('change', () => { S.edit = esel.value; drawEditor(); $('.nls-troubleshoot-emsg').textContent = ''; });
      const mbox = $('.nls-troubleshoot-mapbox');
      if (S.viewer) S.viewer.destroy();
      S.viewer = makeViewer(mbox, { onZoom: z => { const l = main.querySelector('.nls-troubleshoot-mapbar .nls-troubleshoot-zl'); if (l) l.textContent = Math.round(z * 100) + '%'; } });
      wireBar(main.querySelector('.nls-troubleshoot-mapbar'), S.viewer);
      mbox.addEventListener('click', e => {
        const g = e.target.closest && e.target.closest('[data-id]');
        if (!g) return;
        selectDev(g.getAttribute('data-id'));
      });
      $('.nls-troubleshoot-fullbtn').addEventListener('click', openFull);
      $('.nls-troubleshoot-chips').addEventListener('click', e => { const b = e.target.closest('[data-dev]'); if (b) selectDev(b.dataset.dev); });
      $('.nls-troubleshoot-stepper').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goStage(+b.dataset.go); });
      main.querySelectorAll('input[name="nls-troubleshoot-cause"]').forEach(r => r.addEventListener('change', () => { S.cause = r.value; drawProgress(); }));
      $('.nls-troubleshoot-test').addEventListener('click', runTests);
      $('.nls-troubleshoot-submit').addEventListener('click', submit);
      // terminal host buttons
      const th = $('.nls-troubleshoot-thosts');
      hosts.forEach(h => {
        const d = dev(h) || {};
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-small';
        b.textContent = d.name || h; b.setAttribute('aria-pressed', h === S.termHost ? 'true' : 'false'); b.dataset.h = h;
        b.addEventListener('click', () => {
          S.termHost = h;
          th.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.h === h ? 'true' : 'false'));
          const dd = dev(h) || {};
          S.term.setHost(h, dd.os === 'linux' ? 'linux' : 'windows', termUser(dd));
          S.term.focus();
        });
        th.appendChild(b);
      });
      S.net = NS().create(S.work);
      const d0 = dev(S.termHost) || {};
      const topts = { net: S.net, hostId: S.termHost, os: d0.os === 'linux' ? 'linux' : 'windows', user: termUser(d0), height: 320,
        onCommand: () => { if (!S.explored) { S.explored = true; drawProgress(); } },
        onNetChange: () => { /* terminal-only changes (ipconfig /release) */ } };
      S.term = window.NL_TERM && typeof window.NL_TERM.create === 'function' ? window.NL_TERM.create($('.nls-troubleshoot-termbox'), topts) : fallbackTerm($('.nls-troubleshoot-termbox'), topts);
      drawMap(); drawDetail(); drawEditor(); drawChanges(); drawProgress();
    }
    function selectDev(id) {
      if (!dev(id)) return;
      S.sel = id; S.explored = true;
      const dsel = $('.nls-troubleshoot-dsel'); if (dsel) dsel.value = id;
      drawMap(); drawDetail(); drawProgress();
    }
    function wireBar(bar, viewer) {
      bar.querySelector('[data-z="in"]').addEventListener('click', () => viewer.zoomIn());
      bar.querySelector('[data-z="out"]').addEventListener('click', () => viewer.zoomOut());
      bar.querySelector('[data-z="fit"]').addEventListener('click', () => viewer.fit());
    }

    // ------------------------------------------------------------ fullscreen diagram (overlay)
    function ovInfo() {
      const p = S.ov && S.ov.querySelector('.nls-troubleshoot-ovinfo'); if (!p) return;
      const d = dev(S.sel); if (!d) { p.textContent = ''; return; }
      const c = S.net.config(d.id) || {};
      let t = `<b>${esc(d.name)}</b> · ${esc(TYPE_TH[d.type] || d.type)}`;
      if (isHost(d.type)) t += ` · IP <code>${esc(c.ip ? c.ip + '/' + c.prefix : '—')}</code> · GW <code>${esc(c.gateway || '—')}</code> · DNS <code>${esc((c.dns || []).join(', ') || '—')}</code>`;
      const down = linksOf(d.id).filter(l => { const s = S.net.linkState(l.id); return !(s && s.active); }).length;
      if (down) t += ` · <span class="nls-troubleshoot-bad">สายไม่มีสัญญาณ ${down} เส้น</span>`;
      p.innerHTML = t + ' <span class="nls-troubleshoot-muted">(ปิดเพื่อดูค่าตั้งทั้งหมด)</span>';
      S.ov.querySelectorAll('[data-dev]').forEach(b => b.setAttribute('aria-pressed', b.dataset.dev === S.sel ? 'true' : 'false'));
    }
    function setVvh() {
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      if (S.ov) S.ov.style.setProperty('--vvh', Math.round(h) + 'px');
      wrap.style.setProperty('--vvh', Math.round(h) + 'px');
    }
    function openFull() {
      if (S.ov || !S.m) return;
      S.ovReturn = document.activeElement;
      const ov = document.createElement('div');
      ov.className = 'nls-troubleshoot-ov';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'แผนผังเครือข่ายแบบเต็มจอ');
      ov.innerHTML = `<div class="nls-troubleshoot-ovhead"><h3>แผนผังเครือข่าย: ${esc(S.m.title)}</h3>
<button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ib nls-troubleshoot-ovclose" aria-label="ปิดแผนผังเต็มจอ">${IC.close}<span>ปิด</span></button></div>
${mapBar()}
<div class="nls-troubleshoot-mapbox" aria-label="แผนผังเครือข่าย (เต็มจอ)"></div>
<p class="nls-troubleshoot-ovtip">หมุนเครื่องเป็นแนวนอนเพื่อดูแผนผังใหญ่ขึ้น หรือใช้สองนิ้วถ่างเพื่อซูม</p>
<p class="nls-troubleshoot-ovinfo" aria-live="polite"></p>
<div class="nls-troubleshoot-chips" role="group" aria-label="เลือกอุปกรณ์">${S.work.devices.map(d => `<button type="button" class="nls-troubleshoot-chip" data-dev="${esc(d.id)}" aria-pressed="false">${esc(d.name)}</button>`).join('')}</div>`;
      // the overlay lives in <body> (position:fixed must not be trapped by a transformed ancestor); the CSS is global
      ov.classList.add('nls-troubleshoot-ovroot');
      document.body.appendChild(ov);
      S.ov = ov;
      document.documentElement.classList.add('nls-troubleshoot-noscroll');
      setVvh();
      const box = ov.querySelector('.nls-troubleshoot-mapbox');
      S.ovViewer = makeViewer(box, { fill: true, onZoom: z => { const l = ov.querySelector('.nls-troubleshoot-zl'); if (l) l.textContent = Math.round(z * 100) + '%'; } });
      wireBar(ov.querySelector('.nls-troubleshoot-mapbar'), S.ovViewer);
      box.addEventListener('click', e => { const g = e.target.closest && e.target.closest('[data-id]'); if (g) selectDev(g.getAttribute('data-id')); });
      ov.querySelector('.nls-troubleshoot-chips').addEventListener('click', e => { const b = e.target.closest('[data-dev]'); if (b) selectDev(b.dataset.dev); });
      ov.querySelector('.nls-troubleshoot-ovclose').addEventListener('click', closeFull);
      ov.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); closeFull(); return; }
        if (e.key === 'Tab') { // keep focus inside the dialog
          const f = [...ov.querySelectorAll('button,[tabindex="0"]')].filter(x => !x.disabled && x.offsetParent !== null);
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      });
      drawMap();
      requestAnimationFrame(() => { if (S.ovViewer) S.ovViewer.refresh(); });
      ov.querySelector('.nls-troubleshoot-ovclose').focus();
    }
    function closeFull() {
      if (!S.ov) return;
      if (S.ovViewer) { S.ovViewer.destroy(); S.ovViewer = null; }
      S.ov.remove(); S.ov = null;
      document.documentElement.classList.remove('nls-troubleshoot-noscroll');
      const r = S.ovReturn; S.ovReturn = null;
      if (r && document.contains(r)) { try { r.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }
      drawMap();
    }
    function termUser(d) { return d.os === 'linux' ? 'student' : d.type === 'server' ? 'Administrator' : 'student'; }

    // ------------------------------------------------------------ map + detail
    function drawMap() {
      const svgText = NS().render(S.net, { highlight: [S.sel], showIp: true, title: 'แผนผังเครือข่าย (แตะหรือคลิกอุปกรณ์เพื่อดูค่าตั้ง)' });
      const targets = [[$('.nls-troubleshoot-mapbox'), S.viewer], [S.ov && S.ov.querySelector('.nls-troubleshoot-mapbox'), S.ovViewer]];
      targets.forEach(([box, viewer]) => {
        if (!box) return;
        const keepFocus = box.contains(document.activeElement) ? document.activeElement.getAttribute('data-id') : null;
        box.innerHTML = svgText;
        const svgEl = box.querySelector('svg'); if (svgEl) svgEl.setAttribute('role', 'group');   // contains buttons, so not role="img"
        box.querySelectorAll('[data-id]').forEach(g => {
          g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
          g.setAttribute('aria-label', 'ดูค่าตั้งของ ' + devName(g.getAttribute('data-id')));
          g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
        });
        if (viewer) viewer.refresh();
        if (keepFocus) { const g = box.querySelector(`[data-id="${window.CSS && window.CSS.escape ? window.CSS.escape(keepFocus) : keepFocus}"]`); if (g) g.focus({ preventScroll: true }); }
      });
      main.querySelectorAll('.nls-troubleshoot-chips [data-dev]').forEach(b => b.setAttribute('aria-pressed', b.dataset.dev === S.sel ? 'true' : 'false'));
      ovInfo();
    }
    const led = (on, text) => `<span class="nls-troubleshoot-led ${on ? 'nls-troubleshoot-up' : 'nls-troubleshoot-down'}" aria-hidden="true"></span>${esc(text)}`;
    function linkRows(id) {
      const ls = linksOf(id);
      if (!ls.length) return '<p class="nls-troubleshoot-muted">ไม่มีสายเชื่อมต่อ</p>';
      return `<div class="nls-troubleshoot-tw"><table class="nls-troubleshoot-table"><thead><tr><th>พอร์ต</th><th>ต่อไปยัง</th><th>สถานะ</th></tr></thead><tbody>${ls.map(l => {
        const s = S.net.linkState(l.id) || { active: false, reason: 'bad_link' };
        const o = otherEnd(l, id), me = ownEnd(l, id);
        return `<tr><td>${esc(me.port || '-')}</td><td>${esc(devName(o.dev))} (${esc(o.port || '-')})${l.medium === 'wifi' ? ' · Wi-Fi' : l.medium === 'fiber' ? ' · Fiber' : ''}</td><td>${led(s.active, LINK_TH[s.reason] || s.reason)}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    }
    function drawDetail() {
      const box = $('.nls-troubleshoot-detail'); if (!box) return;
      const d = dev(S.sel); if (!d) { box.innerHTML = ''; return; }
      const c = S.net.config(d.id) || {};
      let h = `<h4>${esc(d.name)} <span class="nls-troubleshoot-muted">· ${esc(TYPE_TH[d.type] || d.type)}${isHost(d.type) ? ' · ' + (d.os === 'linux' ? 'Linux' : 'Windows') : ''}</span></h4>`;
      if (isHost(d.type)) {
        const f = (d.ifaces && d.ifaces[0]) || {};
        const lease = c.leaseFrom ? devName(c.leaseFrom) : null;
        const kv = [
          ['Network adapter', led(f.up !== false, (f.name || 'eth0') + (f.up !== false ? ' เปิดใช้งาน (Enabled)' : ' ปิดใช้งาน (Disabled)'))],
          ['การรับ IP', esc(d.dhcp ? 'อัตโนมัติ (DHCP)' + (lease ? ' จาก ' + lease : c.apipa ? ' — ไม่พบ DHCP server' : '') : 'กำหนดเอง (Static)')],
          ['IP address', esc(c.ip ? c.ip + (c.apipa ? ' (APIPA)' : '') : '—')],
          ['Subnet mask', esc(c.mask ? `${c.mask} (/${c.prefix})` : '—')],
          ['Default gateway', esc(c.gateway || '—')],
          ['DNS server', esc((c.dns || []).join(', ') || '—')],
          ['MAC address', esc(c.mac || '—')],
          ['Firewall', esc(d.firewall && d.firewall.icmp === false ? 'บล็อก ping (ICMP Echo)' : 'อนุญาต ping')]
        ];
        if (d.type === 'laptop' || d.ssid !== undefined) kv.splice(1, 0, ['Wi-Fi SSID ที่ตั้งไว้', esc(d.ssid || '(ไม่ได้ตั้ง)')]);
        h += `<dl class="nls-troubleshoot-kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
        h += '<h4>สายสัญญาณ / การเชื่อมต่อ</h4>' + linkRows(d.id);
        const sv = d.services || {};
        if (sv.dns && sv.dns.records) h += `<h4>บริการ DNS (records)</h4><div class="nls-troubleshoot-tw"><table class="nls-troubleshoot-table"><tbody>${Object.keys(sv.dns.records).map(k => `<tr><td>${esc(k)}</td><td>${esc(sv.dns.records[k])}</td></tr>`).join('')}</tbody></table></div>`;
        if (sv.dhcp) h += dhcpBox(sv.dhcp);
        const other = ['web', 'file'].filter(k => sv[k]).map(k => k === 'web' ? 'Web server' : 'File server');
        if (other.length) h += `<p class="nls-troubleshoot-muted">บริการอื่น: ${esc(other.join(', '))}</p>`;
      } else if (d.type === 'router') {
        h += `<h4>Interfaces</h4><div class="nls-troubleshoot-tw"><table class="nls-troubleshoot-table"><thead><tr><th>Interface</th><th>IP/prefix</th><th>สถานะ</th></tr></thead><tbody>${(d.ifaces || []).map(f => {
          const l = linksOf(d.id).find(x => ownEnd(x, d.id).port === f.name);
          const s = l ? S.net.linkState(l.id) : null;
          return `<tr><td>${esc(f.name)}</td><td>${esc(f.ip ? f.ip + '/' + f.prefix : '-')}</td><td>${led(!!(s && s.active), s ? (LINK_TH[s.reason] || s.reason) : 'ไม่มีสาย')}</td></tr>`;
        }).join('')}</tbody></table></div>`;
        const rs = S.net.routes(d.id);
        h += `<h4>Routing table</h4><div class="nls-troubleshoot-tw"><table class="nls-troubleshoot-table"><thead><tr><th>ชนิด</th><th>Network</th><th>Next hop / Interface</th></tr></thead><tbody>${rs.map(r => `<tr><td>${r.type === 'C' ? 'C (ต่อตรง)' : 'S (static)'}</td><td>${esc(r.net + '/' + r.prefix)}</td><td>${esc(r.via ? 'via ' + r.via + ' (' + r.iface + ')' : r.iface)}</td></tr>`).join('') || '<tr><td colspan="3">ไม่มี</td></tr>'}</tbody></table></div>`;
        if (d.services && d.services.dhcp) h += dhcpBox(d.services.dhcp);
      } else if (d.type === 'switch' || d.type === 'ap') {
        if (d.type === 'ap') h += `<dl class="nls-troubleshoot-kv"><dt>SSID</dt><dd>${esc(d.ssid || '-')}</dd><dt>Security</dt><dd>${esc(d.security || 'WPA2')}</dd></dl>`;
        h += '<h4>พอร์ตที่มีสายต่อ (ไฟสถานะ)</h4>' + linkRows(d.id);
      } else {
        h += '<p class="nls-troubleshoot-muted">ผู้ให้บริการอินเทอร์เน็ต (ตรวจสอบไม่ได้จากฝั่งเรา)</p>' + linkRows(d.id);
      }
      box.innerHTML = h;
    }
    function dhcpBox(p) {
      return `<h4>บริการ DHCP</h4><dl class="nls-troubleshoot-kv"><dt>ช่วง IP</dt><dd>${esc(p.start)} – ${esc(p.end)} /${esc(p.prefix)}</dd><dt>Gateway ที่แจก</dt><dd>${esc(p.gateway || '-')}</dd><dt>DNS ที่แจก</dt><dd>${esc((p.dns || []).join(', ') || '-')}</dd></dl>`;
    }

    // ------------------------------------------------------------ editor
    function msg(t, bad) { const e = $('.nls-troubleshoot-emsg'); e.textContent = t; e.className = 'nls-troubleshoot-msg nls-troubleshoot-emsg ' + (bad ? 'nls-troubleshoot-bad' : 'nls-troubleshoot-ok'); }
    function linkToggles(id) {
      const ls = linksOf(id);
      if (!ls.length) return '';
      return '<h4>สายสัญญาณ</h4>' + ls.map(l => {
        const o = otherEnd(l, id);
        return `<label class="nls-troubleshoot-check"><input type="checkbox" data-link="${esc(l.id)}" ${l.up !== false ? 'checked' : ''}>${l.medium === 'wifi' ? 'เชื่อมต่อ Wi-Fi' : 'เสียบสาย'} ${esc(ownEnd(l, id).port || '')} ↔ ${esc(devName(o.dev))} ${esc(o.port || '')}</label>`;
      }).join('');
    }
    function drawEditor() {
      const box = $('.nls-troubleshoot-editor'); if (!box) return;
      const d = dev(S.edit); if (!d) { box.innerHTML = ''; return; }
      let h = '';
      if (isHost(d.type)) {
        const f = d.ifaces[0] || {};
        const wifi = d.type === 'laptop' || /^wl/.test(f.name || '') || d.ssid !== undefined;
        h += `<label class="nls-troubleshoot-check"><input type="checkbox" data-f="up" ${f.up !== false ? 'checked' : ''}>เปิดใช้งาน Network adapter (${esc(f.name || 'eth0')})</label>
<label class="nls-troubleshoot-check"><input type="checkbox" data-f="dhcp" ${d.dhcp ? 'checked' : ''}>รับ IP อัตโนมัติ (DHCP)</label>
<div class="nls-troubleshoot-form">
<label for="nls-troubleshoot-f-ip">IP address</label><input type="text" id="nls-troubleshoot-f-ip" data-f="ip" value="${esc(f.ip || '')}" inputmode="decimal" autocomplete="off" spellcheck="false">
<label for="nls-troubleshoot-f-mask">Subnet mask</label><input type="text" id="nls-troubleshoot-f-mask" data-f="prefix" value="${esc(f.prefix !== undefined && f.prefix !== '' ? NS().ip.mask(f.prefix) || f.prefix : '')}" placeholder="255.255.255.0 หรือ /24" inputmode="decimal" autocomplete="off" spellcheck="false">
<label for="nls-troubleshoot-f-gw">Default gateway</label><input type="text" id="nls-troubleshoot-f-gw" data-f="gateway" value="${esc(d.gateway || '')}" inputmode="decimal" autocomplete="off" spellcheck="false">
<label for="nls-troubleshoot-f-dns">DNS server</label><input type="text" id="nls-troubleshoot-f-dns" data-f="dns" value="${esc((d.dns || []).join(', '))}" placeholder="คั่นหลายค่าด้วย ," inputmode="decimal" autocomplete="off" spellcheck="false">
${wifi ? `<label for="nls-troubleshoot-f-ssid">Wi-Fi SSID</label><input type="text" id="nls-troubleshoot-f-ssid" data-f="ssid" value="${esc(d.ssid || '')}">` : ''}
</div>
<label class="nls-troubleshoot-check"><input type="checkbox" data-f="icmp" ${!(d.firewall && d.firewall.icmp === false) ? 'checked' : ''}>Firewall: อนุญาตให้ ping (ICMP Echo) เข้ามา</label>
<div class="nls-troubleshoot-row" style="margin-top:6px"><button type="button" class="nls-troubleshoot-btn nls-troubleshoot-save">บันทึกการแก้ไข</button></div>`;
      } else if (d.type === 'router') {
        h += `<h4>Static routes</h4><div class="nls-troubleshoot-tw"><table class="nls-troubleshoot-table"><thead><tr><th>Network</th><th>Prefix</th><th>Next hop</th><th></th></tr></thead><tbody>${(d.routes || []).map((r, i) =>
          `<tr><td>${esc(r.net)}</td><td>/${esc(r.prefix)}</td><td>${esc(r.via || r.iface || '')}</td><td><button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-small" data-delroute="${i}">ลบ</button></td></tr>`).join('') || '<tr><td colspan="4">ยังไม่มี static route</td></tr>'}</tbody></table></div>
<p class="nls-troubleshoot-muted" style="margin-top:8px">เพิ่ม route: ปลายทาง (network) / prefix หรือ mask / next hop</p>
<div class="nls-troubleshoot-route"><input type="text" aria-label="Network ปลายทาง" placeholder="192.168.20.0" data-r="net" inputmode="decimal" autocomplete="off"><input type="text" aria-label="Prefix หรือ Subnet mask" placeholder="/24" data-r="prefix"><input type="text" aria-label="Next hop" placeholder="10.0.0.2" data-r="via" inputmode="decimal" autocomplete="off"><button type="button" class="nls-troubleshoot-btn nls-troubleshoot-small nls-troubleshoot-addroute">เพิ่ม</button></div>`;
      } else if (d.type === 'internet') {
        h += '<p class="nls-troubleshoot-muted">อุปกรณ์ของผู้ให้บริการ แก้ไขไม่ได้</p>';
      } else {
        h += `<p class="nls-troubleshoot-muted">${d.type === 'ap' ? 'Access Point' : 'Switch'}: แก้ได้เฉพาะการเสียบสาย</p>`;
      }
      if (d.type !== 'internet') h += linkToggles(d.id);
      box.innerHTML = h;
      const sync = () => {
        const dh = box.querySelector('[data-f="dhcp"]');
        if (!dh) return;
        ['ip', 'prefix', 'gateway', 'dns'].forEach(k => { const x = box.querySelector(`[data-f="${k}"]`); if (x) x.disabled = dh.checked; });
      };
      sync();
      const dh = box.querySelector('[data-f="dhcp"]'); if (dh) dh.addEventListener('change', sync);
      const save = box.querySelector('.nls-troubleshoot-save'); if (save) save.addEventListener('click', saveHost);
      box.querySelectorAll('[data-link]').forEach(cb => cb.addEventListener('change', () => {
        const l = S.work.links.find(x => x.id === cb.dataset.link); if (!l) return;
        l.up = cb.checked; rebuild(); msg(cb.checked ? 'เสียบสายแล้ว' : 'ถอดสายแล้ว');
      }));
      box.querySelectorAll('[data-delroute]').forEach(b => b.addEventListener('click', () => {
        d.routes.splice(+b.dataset.delroute, 1); rebuild(); drawEditor(); msg('ลบ route แล้ว');
      }));
      const add = box.querySelector('.nls-troubleshoot-addroute');
      if (add) add.addEventListener('click', () => {
        const v = k => box.querySelector(`[data-r="${k}"]`).value.trim();
        const n = v('net'), p = NS().ip.toPrefix(v('prefix') || ''), via = v('via');
        if (NS().ip.parse(n) === null) return msg('Network ปลายทางไม่ถูกต้อง (เช่น 192.168.20.0)', true);
        if (p === null) return msg('Prefix/Subnet mask ไม่ถูกต้อง (เช่น /24 หรือ 255.255.255.0)', true);
        if (NS().ip.parse(via) === null) return msg('Next hop ต้องเป็น IP ของ Router ตัวถัดไป', true);
        if (NS().ip.network(n, p) !== n) return msg(`${n}/${p} ไม่ใช่ network address (ควรเป็น ${NS().ip.network(n, p)})`, true);
        d.routes = d.routes || [];
        if (d.routes.length >= 20) return msg('static route มากเกินไป', true);
        d.routes.push({ net: n, prefix: p, via });
        rebuild(); drawEditor(); msg(`เพิ่ม route ${n}/${p} via ${via} แล้ว`);
      });
    }
    function saveHost() {
      const box = $('.nls-troubleshoot-editor');
      const d = dev(S.edit); if (!d) return;
      const g = k => { const x = box.querySelector(`[data-f="${k}"]`); return x ? (x.type === 'checkbox' ? x.checked : x.value.trim()) : undefined; };
      const ip = NS().ip;
      const dhcp = g('dhcp');
      const IPs = g('ip'), M = g('prefix'), GW = g('gateway'), DNS = g('dns');
      const dnsList = String(DNS || '').split(/[\s,;]+/).filter(Boolean);
      if (!dhcp) {
        if (IPs && ip.parse(IPs) === null) return msg('IP address ไม่ถูกต้อง (ต้องเป็นเลข 4 ชุด 0–255 คั่นด้วยจุด)', true);
        if (M && ip.toPrefix(M) === null) return msg('Subnet mask ไม่ถูกต้อง (เช่น 255.255.255.0 หรือ /24)', true);
        if (GW && ip.parse(GW) === null) return msg('Default gateway ไม่ถูกต้อง', true);
        if (dnsList.some(x => ip.parse(x) === null)) return msg('DNS server ต้องเป็น IP address', true);
        if (dnsList.length > 4) return msg('ใส่ DNS server ได้ไม่เกิน 4 ค่า', true);
      }
      const f = d.ifaces[0];
      if (!dhcp) {
        if ((f.ip || '') !== IPs) f.ip = IPs;
        const p = M ? ip.toPrefix(M) : '';
        if (String(ip.toPrefix(f.prefix)) !== String(p)) f.prefix = p;
        if ((d.gateway || '') !== GW) d.gateway = GW;
        if ((d.dns || []).join(',') !== dnsList.join(',')) d.dns = dnsList;
      }
      if (!!d.dhcp !== !!dhcp) d.dhcp = !!dhcp;
      const up = g('up'); if ((f.up !== false) !== up) f.up = up;
      const ss = g('ssid'); if (ss !== undefined && (d.ssid || '') !== ss) d.ssid = ss;
      const icmp = g('icmp'); const cur = !(d.firewall && d.firewall.icmp === false);
      if (cur !== icmp) d.firewall = Object.assign({}, d.firewall || {}, { icmp });
      rebuild();
      msg('บันทึกการตั้งค่าของ ' + d.name + ' แล้ว — ลองทดสอบด้วย ping หรือปุ่มทดสอบ');
    }
    function drawChanges() {
      const ul = $('.nls-troubleshoot-changes'); if (!ul) return;
      const ch = changes(S.m.start.topo, S.work);
      ul.innerHTML = ch.length ? ch.map(c => `<li>${esc(c)}</li>`).join('') : '<li class="nls-troubleshoot-muted">ยังไม่ได้แก้ไข</li>';
    }

    // ------------------------------------------------------------ test + submit
    function runTests() {
      const net = NS().create(S.work);
      const list = S.m.start.successPings || [];
      const res = list.map(([s, t]) => ({ s, t, r: net.ping(s, t) }));
      const ok = res.filter(x => x.r.ok).length;
      $('.nls-troubleshoot-testres').innerHTML = `<p class="${ok === res.length ? 'nls-troubleshoot-ok' : 'nls-troubleshoot-bad'}"><b>ผ่าน ${ok}/${res.length} รายการ</b></p><ul class="nls-troubleshoot-tests">${res.map(x => {
        const d = dev(x.s) || {};
        const lines = d.os === 'linux' ? x.r.linux : x.r.win;
        return `<li>${x.r.ok ? '<span class="nls-troubleshoot-ok">✓</span>' : '<span class="nls-troubleshoot-bad">✗</span>'} ping จาก <b>${esc(d.name || x.s)}</b> ไป <b>${esc(x.t)}</b>: ${esc(x.r.ok ? 'สำเร็จ' : x.r.reasonText || x.r.reason)}
<details><summary>ดูผลลัพธ์</summary><pre>${esc(lines.join('\n'))}</pre></details></li>`;
      }).join('')}</ul>`;
      S.test = { ok, n: res.length, all: res.length > 0 && ok === res.length };
      drawProgress();
      // all tests pass -> bring the submit section (and its button) into view, above the bottom nav
      if (S.test.all) {
        const sub = $('.nls-troubleshoot-subsec');
        if (sub) setTimeout(() => sub.scrollIntoView({ block: 'end', behavior: reduceMotion() ? 'auto' : 'smooth' }), 60);
      }
    }
    async function submit() {
      const btn = $('.nls-troubleshoot-submit'), m = $('.nls-troubleshoot-smsg'), out = $('.nls-troubleshoot-result');
      if (!S.cause) { m.textContent = 'กรุณาเลือกสาเหตุก่อนส่งงาน (ขั้นที่ 2)'; m.className = 'nls-troubleshoot-msg nls-troubleshoot-smsg nls-troubleshoot-bad'; return; }
      if (typeof ctx.submit !== 'function') { m.textContent = 'ระบบส่งงานยังไม่พร้อม'; return; }
      btn.disabled = true; m.className = 'nls-troubleshoot-msg nls-troubleshoot-smsg'; m.textContent = 'กำลังตรวจงาน...';
      const id = S.m.id;
      try {
        const r = await ctx.submit(id, { cause: S.cause, topo: clone(S.work) });
        m.textContent = '';
        out.innerHTML = `<p class="nls-troubleshoot-score ${r.score === r.max ? 'nls-troubleshoot-ok' : ''}">คะแนน ${esc(r.score)}/${esc(r.max)}</p>` +
          (r.saved === false ? '<p class="nls-troubleshoot-muted">(ยังไม่ได้บันทึกคะแนน — เข้าสู่ระบบเพื่อบันทึก)</p>' : '') +
          `<ul class="nls-troubleshoot-fb">${(r.feedback || []).map(f => `<li class="${/✓/.test(f) ? 'nls-troubleshoot-ok' : /ยังไม่|เกินขอบเขต|ไม่ถูก/.test(f) ? 'nls-troubleshoot-bad' : ''}">${esc(f)}</li>`).join('')}</ul>`;
        const prev = done[id];
        if (!prev || typeof prev.best !== 'number' || r.score > prev.best) done[id] = { best: r.score, max: r.max, attempts: ((prev && prev.attempts) || 0) + 1 };
        renderList();
        if (S.m && S.m.id === id) { S.submitted = true; drawProgress(); }
        const sc = out.querySelector('.nls-troubleshoot-score');
        if (sc) { const r2 = sc.getBoundingClientRect(); if (r2.top < 60 || r2.bottom > (window.visualViewport ? window.visualViewport.height : window.innerHeight) - 70) sc.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); }
      } catch (e) {
        m.textContent = 'ส่งงานไม่สำเร็จ: ' + (e && e.message ? e.message : 'เกิดข้อผิดพลาด');
        m.className = 'nls-troubleshoot-msg nls-troubleshoot-smsg nls-troubleshoot-bad';
      } finally { btn.disabled = false; }
    }

    // ------------------------------------------------------------ on-screen keyboard: keep the focused field visible
    const isField = el => !!(el && el.matches && el.matches('input[type=text],input:not([type]),textarea') && wrap.contains(el));
    let kbTimer = 0, vvTimer = 0;
    const reveal = el => { if (el && document.activeElement === el) el.scrollIntoView({ block: 'center', behavior: 'auto' }); };
    on(wrap, 'focusin', e => {
      if (!isField(e.target)) return;
      // the terminal manages its own scrolling; settings / route fields are centred once the keyboard is up
      if (e.target.closest('.nls-troubleshoot-editor')) { clearTimeout(kbTimer); kbTimer = setTimeout(() => reveal(e.target), 300); }
    });
    const onVV = () => {
      setVvh();
      clearTimeout(vvTimer);
      vvTimer = setTimeout(() => {
        const a = document.activeElement;
        if (isField(a) && a.closest('.nls-troubleshoot-editor')) {
          const vv = window.visualViewport, r = a.getBoundingClientRect();
          const top = vv ? vv.offsetTop : 0, h = vv ? vv.height : window.innerHeight;
          if (r.top < top || r.bottom > top + h) reveal(a);
        }
      }, 120);
    };
    if (window.visualViewport) { on(window.visualViewport, 'resize', onVV); on(window.visualViewport, 'scroll', onVV); }
    let rzTimer = 0;
    on(window, 'resize', () => {
      onVV();
      clearTimeout(rzTimer);
      rzTimer = setTimeout(() => { if (S.viewer) S.viewer.apply(); if (S.ovViewer) S.ovViewer.apply(); }, 100);
    });
    setVvh();

    renderList();
    if (missions.length) open(missions[0]);
    else main.innerHTML = '<p class="nls-troubleshoot-muted">ยังไม่มีภารกิจ</p>';
    return {
      destroy() {
        closeFull();
        if (S.viewer) { S.viewer.destroy(); S.viewer = null; }
        clearTimeout(kbTimer); clearTimeout(vvTimer); clearTimeout(rzTimer);
        cleanups.splice(0).forEach(f => f());
        document.documentElement.classList.remove('nls-troubleshoot-noscroll');
        if (S.term) { S.term.destroy(); S.term = null; }
        wrap.remove();
      }
    };
  }

  window.NL_SIMS = window.NL_SIMS || {};
  window.NL_SIMS.troubleshoot = { title: 'ห้องปฏิบัติการแก้ไขปัญหาเครือข่าย', mount };
})();
