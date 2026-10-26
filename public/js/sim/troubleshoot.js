'use strict';
/*
 * NetLab - Network Troubleshooting Lab (browser module, SIM-SPEC §1 + §4.5)
 * Registers window.NL_SIMS.troubleshoot. Uses window.NL_TERM (public/js/sim/terminal.js, loaded first by the app)
 * for the terminal; falls back to a minimal built-in terminal when it is missing. All network behaviour comes from
 * window.NetSim. Flow: investigate (topology + device settings + terminal) -> choose the cause -> edit settings ->
 * test (re-run the mission's success pings) -> submit { cause, topo } -> score + feedback from the server grader.
 *
 * Evidence missions (start.mode === 'evidence', x9 onwards) have NO list of causes: every command, device inspection,
 * service test and test run is logged as an action { k:'cmd'|'inspect'|'svc'|'test', host?, cmd?, dev?, target?, port?,
 * ph:'b'|'a' } (ph = before/after the first change to the network). Submit { topo, actions }. The server replays the
 * actions with the same DOM-free helpers below (TS: service/port test, command parser, replay), so the evidence the
 * grader sees is what the student really saw.
 *
 * Under Node (require) this file exports only the DOM-free helpers TS.
 */
(function () {
  // ======================================================================== shared helpers (browser + server)
  const TS = (function () {
    const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
    const clone = x => JSON.parse(JSON.stringify(x));
    const HOSTT = ['pc', 'laptop', 'server', 'printer'];
    const sv = v => (typeof v === 'string' || typeof v === 'number') ? String(v).trim() : '';
    // TCP services that the service test knows. listen(d): is the service running on device d; fw: host-firewall rule key
    const SVC = {
      53: { name: 'DNS', fw: 'dns', listen: d => !!(d.services && isObj(d.services.dns) && d.services.dns.enabled !== false) },
      80: { name: 'HTTP', fw: 'web', listen: d => !!(d.services && d.services.web) },
      443: { name: 'HTTPS', fw: 'web', listen: d => !!(d.services && d.services.web) },
      445: { name: 'SMB (File and Printer Sharing)', fw: 'smb', listen: d => !!(d.services && d.services.file) },
      9100: { name: 'RAW printing (JetDirect)', fw: 'print', listen: d => d.type === 'printer' || !!(d.services && d.services.print) }
    };
    const LNX_SVC = { 53: 'domain', 80: 'http', 443: 'https', 445: 'microsoft-ds', 9100: 'jetdirect' };
    const fwOn = d => !(isObj(d.firewall) && (d.firewall.enabled === false || d.firewall.enabled === 'false'));
    function fwAllows(d, port) {
      if (!fwOn(d)) return true;
      const k = SVC[port] && SVC[port].fw; const v = isObj(d.firewall) ? d.firewall[k] : undefined;
      return !(v === false || v === 'false');
    }
    // a host whose firewall is switched off entirely answers ping as well (NetSim only knows firewall.icmp)
    function effTopo(t) {
      const c = clone(t);
      (c.devices || []).forEach(d => { if (isObj(d) && isObj(d.firewall) && !fwOn(d)) d.firewall = Object.assign({}, d.firewall, { icmp: true }); });
      return c;
    }
    const lastDev = r => r && Array.isArray(r.path) && r.path.length ? r.path[r.path.length - 1] : null;
    /* TCP connect test (Test-NetConnection -Port / nc -zv). Layer 3 reachability comes from NetSim (ping with every host's
       ICMP rule opened, so only routing/ARP/links decide); the answering device is the last device on the packet path;
       then the service must be running there and allowed by that device's host firewall. */
    function tcpTest(NetSim, topo, src, target, port) {
      port = Math.floor(+port);
      const T = effTopo(topo);
      const net = NetSim.create(T);
      const real = net.ping(src, target, { count: 1 });
      const open = clone(T);
      open.devices.forEach(d => { if (isObj(d) && HOSTT.includes(d.type)) d.firewall = Object.assign({}, isObj(d.firewall) ? d.firewall : {}, { icmp: true }); });
      const r = NetSim.create(open).ping(src, target, { count: 1 });
      const c = net.config(src) || {};
      const res = { port, target: sv(target), resolved: r.resolved || real.resolved || null, srcIp: c.ip || null, pingOk: !!real.ok, pingReason: real.reason,
        l3: !!r.ok, l3Reason: r.reason, responder: null, listening: false, allowed: false, tcp: false, why: '' };
      if (!SVC[port]) { res.why = 'unknown_port'; return res; }
      if (r.ok) {
        const id = lastDev(r); const d = T.devices.find(x => isObj(x) && x.id === id);
        res.responder = id;
        if (d && d.type === 'internet') { res.listening = [53, 80, 443].includes(port); res.allowed = true; }
        else if (d) { res.listening = !!SVC[port].listen(d); res.allowed = fwAllows(d, port); }
        res.tcp = res.listening && res.allowed;
        res.why = res.tcp ? 'ok' : !res.allowed ? 'filtered' : 'refused';
      } else res.why = r.reason === 'bad_target' || r.reason === 'dns_fail' ? 'name' : 'unreachable';
      return res;
    }
    function tcpLines(res, os, name) {
      const tgt = res.target, ip = res.resolved || '';
      if (os === 'linux') {
        if (res.why === 'name') return [`nc: getaddrinfo for host "${tgt}" port ${res.port}: Name or service not known`];
        if (res.tcp) return [`Connection to ${tgt} (${ip}) ${res.port} port [tcp/${LNX_SVC[res.port] || '*'}] succeeded!`];
        if (res.why === 'refused') return [`nc: connect to ${tgt} (${ip}) port ${res.port} (tcp) failed: Connection refused`];
        if (res.why === 'unreachable' && /no_link|no_gateway|no_ip|iface_down/.test(res.l3Reason)) return [`nc: connect to ${tgt} (${ip}) port ${res.port} (tcp) failed: Network is unreachable`];
        return [`nc: connect to ${tgt} (${ip}) port ${res.port} (tcp) failed: Connection timed out`];
      }
      const pad = (k, w) => (k + ' '.repeat(w)).slice(0, w) + ': ';
      if (res.why === 'name') return [`WARNING: Name resolution of ${tgt} failed`, '', pad('ComputerName', 14) + tgt, pad('RemoteAddress', 14), pad('InterfaceAlias', 14), pad('SourceAddress', 14), pad('PingSucceeded', 14) + 'False'];
      const L = [];
      if (!res.tcp) {
        L.push(`WARNING: TCP connect to (${ip} : ${res.port}) failed`);
        if (!res.pingOk) L.push(`WARNING: Ping to ${ip} failed with status: ${res.pingReason === 'timeout' ? 'TimedOut' : 'DestinationHostUnreachable'}`);
        L.push('', '');
        L.push(pad('ComputerName', 23) + tgt, pad('RemoteAddress', 23) + ip, pad('RemotePort', 23) + res.port, pad('InterfaceAlias', 23) + (name || 'Ethernet'),
          pad('SourceAddress', 23) + (res.srcIp || ''), pad('PingSucceeded', 23) + (res.pingOk ? 'True' : 'False'));
        if (res.pingOk) L.push(pad('PingReplyDetails (RTT)', 23) + '0 ms');
        L.push(pad('TcpTestSucceeded', 23) + 'False');
        return L;
      }
      return [pad('ComputerName', 16) + tgt, pad('RemoteAddress', 16) + ip, pad('RemotePort', 16) + res.port, pad('InterfaceAlias', 16) + (name || 'Ethernet'),
        pad('SourceAddress', 16) + (res.srcIp || ''), pad('TcpTestSucceeded', 16) + 'True'];
    }
    // ---------- command parser (Windows cmd + Linux shell; same commands as the terminal)
    function parseCmd(line) {
      let tok = String(line || '').slice(0, 300).trim().split(/\s+/).filter(Boolean);
      if (tok[0] === 'sudo') tok = tok.slice(1);
      const c = (tok[0] || '').toLowerCase().replace(/\.exe$/, ''), a = tok.slice(1);
      const lower = a.map(x => x.toLowerCase());
      const plain = (skipVal) => { const out = []; for (let i = 0; i < a.length; i++) { const x = a[i]; if (/^[-/]/.test(x)) { if (skipVal.includes(x.toLowerCase().replace(/^\//, '-'))) i++; continue; } out.push(x); } return out; };
      if (c === 'ping') { const p = plain(['-n', '-c', '-w', '-l', '-i', '-s']); return p.length ? { type: 'ping', target: p[p.length - 1] } : { type: 'other' }; }
      if (c === 'tracert' || c === 'traceroute' || c === 'pathping') { const p = plain(['-h', '-w', '-m', '-q']); return p.length ? { type: 'tracert', target: p[p.length - 1] } : { type: 'other' }; }
      if (c === 'nslookup') { const p = plain([]); return p.length ? { type: 'nslookup', name: p[0], server: p[1] || '' } : { type: 'other' }; }
      if (c === 'dig') { const p = a.filter(x => !/^[+-]/.test(x)); const s = p.find(x => x[0] === '@'); const n = p.find(x => x[0] !== '@'); return n ? { type: 'nslookup', name: n, server: s ? s.slice(1) : '' } : { type: 'other' }; }
      if (c === 'host') { const p = plain([]); return p.length ? { type: 'nslookup', name: p[0], server: p[1] || '' } : { type: 'other' }; }
      if (c === 'ipconfig') { if (lower.some(x => /^\/(release|renew|flushdns)/.test(x))) return { type: 'other' }; return { type: 'ipconfig', all: lower.includes('/all') }; }
      if (c === 'ifconfig' || (c === 'ip' && /^(a|addr|address)$/.test(lower[0] || '')) || (c === 'hostname' && lower[0] === '-i') || c === 'getmac') return { type: 'ipconfig', all: true };
      if (c === 'cat' && /resolv\.conf$/.test(lower[0] || '')) return { type: 'ipconfig', all: true };
      if ((c === 'arp' && (lower.includes('-a') || lower.includes('-g') || !a.length)) || (c === 'ip' && /^(n|neigh|neighbor|neighbour)$/.test(lower[0] || ''))) return { type: 'arp' };
      if ((c === 'route' && (lower[0] === 'print' || !a.length || lower[0] === '-n')) || (c === 'ip' && /^(r|ro|route)$/.test(lower[0] || '')) || (c === 'netstat' && lower.includes('-r'))) return { type: 'route' };
      return { type: 'other' };
    }
    /* Replay logged actions on a topology. One NetSim instance for the whole run so ARP caches build up exactly as in the
       browser terminal. Returns [{ k, host|dev, type, ...result }]. */
    function replay(NetSim, topo, actions, opts) {
      opts = opts || {};
      const T = effTopo(topo);
      const net = NetSim.create(T);
      const hostOk = h => typeof h === 'string' && (!opts.hosts || opts.hosts.includes(h));
      const out = [];
      (Array.isArray(actions) ? actions : []).forEach(x => {
        if (!isObj(x)) return;
        try {
          if (x.k === 'inspect' && typeof x.dev === 'string' && T.devices.some(d => d.id === x.dev)) out.push({ k: 'inspect', dev: x.dev });
          else if (x.k === 'test') out.push({ k: 'test' });
          else if (x.k === 'svc' && hostOk(x.host) && SVC[Math.floor(+x.port)]) {
            const r = tcpTest(NetSim, topo, x.host, sv(x.target).slice(0, 80), x.port);
            out.push(Object.assign({ k: 'svc', host: x.host, type: 'svc' }, r));
          } else if (x.k === 'cmd' && hostOk(x.host) && typeof x.cmd === 'string') {
            const p = parseCmd(x.cmd);
            const rec = { k: 'cmd', host: x.host, type: p.type, cmd: x.cmd.slice(0, 200) };
            if (p.type === 'ping') {
              const r = net.ping(x.host, p.target.slice(0, 80), { count: 1 });
              Object.assign(rec, { target: p.target, ok: r.ok, reason: r.reason, resolved: r.resolved, responder: r.ok ? lastDev(r) : null, ttl: r.ttl });
            } else if (p.type === 'tracert') {
              const r = net.traceroute(x.host, p.target.slice(0, 80));
              Object.assign(rec, { target: p.target, ok: r.ok, reason: r.reason, hops: r.hops.map(h => h.timeout ? '*' : h.ip) });
            } else if (p.type === 'nslookup') {
              const r = net.nslookup(x.host, p.name.slice(0, 80), p.server ? p.server.slice(0, 40) : undefined);
              Object.assign(rec, { name: p.name, ok: r.ok, reason: r.reason, ip: r.ip, server: r.server });
            } else if (p.type === 'ipconfig') rec.cfg = net.config(x.host);
            else if (p.type === 'arp') rec.arp = net.arp(x.host);
            else if (p.type === 'route') rec.routes = net.routes(x.host);
            out.push(rec);
          }
        } catch (e) { /* ignore a broken action */ }
      });
      return out;
    }
    // checks used by evidence missions: { kind:'ping', src, target } | { kind:'tcp', src, target, port }
    function runCheck(NetSim, topo, ch, net) {
      if (ch.kind === 'tcp') { const r = tcpTest(NetSim, topo, ch.src, ch.target, ch.port); return { ok: r.tcp, why: r.why, reason: r.l3Reason, res: r }; }
      const n = net || NetSim.create(effTopo(topo));
      const r = n.ping(ch.src, ch.target, { count: 1 });
      return { ok: r.ok, reason: r.reason, reasonText: r.reasonText, res: r };
    }
    const TCP_WHY = { filtered: 'พอร์ตถูก Firewall ปลายทางบล็อก (TcpTestSucceeded : False แต่ ping ได้)', refused: 'ปลายทางไม่ได้เปิดบริการนี้ (เครื่องที่ตอบไม่ใช่เครื่องที่ให้บริการ หรือบริการหยุดอยู่)',
      name: 'แปลงชื่อเป็น IP ไม่ได้ (DNS)', unreachable: 'ติดต่อปลายทางไม่ได้ในระดับเครือข่าย (IP/route/สาย)', unknown_port: 'ไม่รู้จักพอร์ตนี้' };
    return { SVC, fwOn, fwAllows, effTopo, tcpTest, tcpLines, parseCmd, replay, runCheck, TCP_WHY };
  })();
  if (typeof module === 'object' && module.exports) { module.exports = TS; return; }

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
.nls-troubleshoot-symptoms{margin:4px 0 8px;padding-left:22px;overflow-wrap:anywhere}
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
.nls-troubleshoot-tag{display:inline-block;font:600 11px var(--nls-troubleshoot-mono);border:1px solid var(--blue);color:var(--blue);border-radius:6px;padding:0 5px;margin-left:4px;vertical-align:1px}
.nls-troubleshoot-note{border-left:4px solid var(--blue);background:var(--field);border-radius:6px;padding:8px 10px;font-size:15px;margin:8px 0 0}
.nls-troubleshoot-log{list-style:none;margin:6px 0 0;padding:0;max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--field)}
.nls-troubleshoot-log li{display:flex;gap:8px;align-items:baseline;padding:5px 8px;border-bottom:1px solid var(--line);font-size:14px;min-width:0}
.nls-troubleshoot-log li:last-child{border-bottom:0}
.nls-troubleshoot-log code{font-family:var(--nls-troubleshoot-mono);font-size:13px;overflow-wrap:anywhere;min-width:0}
.nls-troubleshoot-ph{flex:0 0 auto;font:600 11px var(--nls-troubleshoot-mono);border-radius:6px;padding:1px 5px;border:1px solid var(--line);color:var(--muted)}
.nls-troubleshoot-ph.nls-troubleshoot-phb{border-color:var(--blue);color:var(--blue)}
.nls-troubleshoot-svc{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}
.nls-troubleshoot-svcrow{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) auto;gap:8px;align-items:end}
.nls-troubleshoot-svcrow label{display:flex;flex-direction:column;gap:3px;font-size:14px;min-width:0}
.nls-troubleshoot-svcrow input{width:100%;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 9px;font:14px var(--nls-troubleshoot-mono);min-height:40px;min-width:0}
.nls-troubleshoot-svcout{font:12px/1.45 var(--nls-troubleshoot-mono);background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 8px;overflow-x:auto;margin:8px 0 0;white-space:pre}
.nls-troubleshoot-svcout:empty{display:none}
.nls-troubleshoot-ifrow{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr);gap:6px;align-items:center;margin:6px 0}
.nls-troubleshoot-ifrow input{width:100%;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 8px;font:13px var(--nls-troubleshoot-mono);min-height:38px;min-width:0}
.nls-troubleshoot-ifrow b{font:600 13px var(--nls-troubleshoot-mono)}
.nls-troubleshoot-explain{margin-top:12px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--field)}
.nls-troubleshoot-explain h4{margin:4px 0}
.nls-troubleshoot-explain ul{margin:2px 0 6px;padding-left:20px;font-size:15px}
.nls-troubleshoot-explain p{font-size:15px}
.nls-troubleshoot-evl{list-style:none;padding:0!important}
.nls-troubleshoot-evl li{display:flex;gap:6px;align-items:flex-start}
.nls-troubleshoot-evl li b{flex:0 0 auto}
@media (max-width:520px){.nls-troubleshoot-svcrow{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.nls-troubleshoot-svcrow .nls-troubleshoot-btn{grid-column:1/-1}.nls-troubleshoot-ifrow{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.nls-troubleshoot-ifrow b{grid-column:1/-1}}
@media (pointer:coarse){.nls-troubleshoot-svcrow input,.nls-troubleshoot-ifrow input{min-height:44px;font-size:16px}}
.nls-troubleshoot-tag.nls-troubleshoot-tgen{border-color:var(--orange);color:var(--orange)}
.nls-troubleshoot-rpt{display:grid;gap:10px;margin:8px 0 12px}
.nls-troubleshoot-rpt label,.nls-troubleshoot-rpt fieldset{display:flex;flex-direction:column;gap:4px;font-size:15px;font-weight:600;min-width:0}
.nls-troubleshoot-rpt fieldset{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:0}
.nls-troubleshoot-rpt legend{padding:0 4px}
.nls-troubleshoot-rpt small{font-weight:400;color:var(--muted);font-size:13px}
.nls-troubleshoot-rpt textarea{width:100%;min-width:0;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 9px;font:inherit;font-size:15px;font-weight:400;line-height:1.45;resize:vertical;min-height:64px}
.nls-troubleshoot-rcrow{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) auto;gap:6px;align-items:center}
.nls-troubleshoot-rcrow .nls-troubleshoot-sel{width:100%;font-weight:400}
.nls-troubleshoot-rub{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}
.nls-troubleshoot-rub th,.nls-troubleshoot-rub td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}
.nls-troubleshoot-rub td.nls-troubleshoot-num{font-family:var(--nls-troubleshoot-mono);white-space:nowrap;text-align:right}
.nls-troubleshoot-rub small{display:block;color:var(--muted)}
.nls-troubleshoot-review{margin-top:12px;border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.nls-troubleshoot-review h4{margin:0 0 6px}
.nls-troubleshoot-genbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 0}
@media (max-width:520px){.nls-troubleshoot-rcrow{grid-template-columns:minmax(0,1fr)}.nls-troubleshoot-rcrow .nls-troubleshoot-btn{justify-self:start}.nls-troubleshoot-rcrow+.nls-troubleshoot-rcrow{border-top:1px solid var(--line);padding-top:8px;margin-top:4px}}
.nls-troubleshoot-rpt .nls-troubleshoot-rchint{font-weight:400;color:var(--muted);font-size:13px;margin:0}
@media (pointer:coarse){.nls-troubleshoot-rpt textarea{font-size:16px}}
@media (max-width:520px){.nls-troubleshoot-btn,.nls-troubleshoot-btn.nls-troubleshoot-small{min-height:44px;min-width:44px}.nls-troubleshoot-check{min-height:44px}.nls-troubleshoot-check input{width:22px;height:22px}.nls-troubleshoot-sel,.nls-troubleshoot-svcrow input,.nls-troubleshoot-ifrow input,.nls-troubleshoot-form input[type=text]{min-height:44px;font-size:16px}}
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
      const o = { ip: String(f.ip || ''), prefix: p === null ? String(f.prefix || '') : String(p), gateway: String(d.gateway || ''), dns: (d.dns || []).join(','),
        dhcp: String(!!d.dhcp), up: String(f.up !== false), ssid: String(d.ssid || ''), icmp: String(!(d.firewall && d.firewall.icmp === false)),
        fw: String(TS.fwOn(d)), smb: String(!(d.firewall && d.firewall.smb === false)) };
      if (d.services && d.services.dns) o.dnsSvc = String(d.services.dns.enabled !== false);
      o.fwweb = String(!(d.firewall && d.firewall.web === false));
      if (d.services && d.services.dhcp) o.dhcpSvc = String(d.services.dhcp.enabled !== false);
      return o;
    }
    if (d.type === 'router') {
      const o = { routes: (d.routes || []).map(r => `${r.net}/${r.prefix} via ${r.via}`).sort().join('; ') };
      (d.ifaces || []).forEach(f => { const p = NS().ip.toPrefix(f.prefix); o['if:' + f.name] = `${f.ip || ''}/${p === null ? '' : p}`; });
      return o;
    }
    return {};
  }
  const FIELD_TH = { ip: 'IP address', prefix: 'Subnet mask', gateway: 'Default gateway', dns: 'DNS server', dhcp: 'DHCP', up: 'Network adapter', ssid: 'SSID', icmp: 'Firewall อนุญาต ping',
    routes: 'Static routes', fw: 'Firewall ทั้งเครื่อง', smb: 'Firewall อนุญาต SMB (445)', dnsSvc: 'บริการ DNS Server', fwweb: 'Firewall อนุญาต HTTP (80/443)', dhcpSvc: 'บริการ DHCP Server' };
  const fieldName = k => k.startsWith('if:') ? 'IP ของ interface ' + k.slice(3) : (FIELD_TH[k] || k);
  function changes(base, work) {
    const out = [];
    base.devices.forEach(b => {
      const w = work.devices.find(x => x.id === b.id); if (!w) return;
      const fa = fieldsOf(b), fb = fieldsOf(w);
      Object.keys(fa).forEach(k => { if (fa[k] !== fb[k]) out.push(`${b.name}: ${fieldName(k)} ${show(k, fa[k])} → ${show(k, fb[k])}`); });
    });
    base.links.forEach(b => {
      const w = work.links.find(x => x.id === b.id); if (!w) return;
      if ((b.up !== false) !== (w.up !== false)) out.push(`สาย ${b.id}: ${w.up !== false ? 'เสียบสายแล้ว' : 'ถอดสาย'}`);
    });
    return out;
  }
  function show(k, v) {
    if (k === 'dhcp') return v === 'true' ? 'เปิด' : 'ปิด';
    if (k === 'up' || k === 'icmp' || k === 'fw' || k === 'smb' || k === 'fwweb') return v === 'true' ? 'เปิด' : 'ปิด';
    if (k === 'dnsSvc' || k === 'dhcpSvc') return v === 'true' ? 'ทำงาน' : 'หยุด';
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
    const missions = Array.isArray(ctx.missions) ? ctx.missions.filter(m => m && m.start && (m.start.topo || m.start.gen)) : [];
    const done = Object.assign({}, ctx.done || {});
    // 3.3 embedded mode (practical page): only the given mission, no mission list
    const EMB = !!ctx.embedded && missions.length > 0;
    const EMB_M = EMB ? (missions.find(m => m.id === ctx.initial) || missions[0]) : null;
    let alive = true;
    const S = { m: null, work: null, net: null, sel: null, edit: null, cause: null, term: null, termHost: null, log: [],
      explored: false, test: null, submitted: false, viewer: null, ov: null, ovViewer: null, ovReturn: null,
      gen: null /* x14: { problem, token, at } */, rpt: null, genBusy: false, newArmed: false };
    const cleanups = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); cleanups.push(() => el.removeEventListener(ev, fn, o)); };

    const wrap = document.createElement('div');
    wrap.className = 'nls-troubleshoot' + (EMB ? ' nls-embedded' : '');
    wrap.innerHTML = `
<h2>ห้องปฏิบัติการแก้ไขปัญหาเครือข่าย</h2>
<p class="nls-troubleshoot-muted">สืบหาสาเหตุของปัญหาจากอาการ ทดสอบด้วยคำสั่งจริง แก้ไขให้ตรงจุด แล้วพิสูจน์ด้วยการทดสอบ</p>
<details class="nls-troubleshoot-card nls-troubleshoot-howto"><summary>คำแนะนำการใช้งาน</summary><ol>
<li><b>สำรวจ</b>: อ่านอาการ คลิกอุปกรณ์ในแผนผังเพื่อดูค่าตั้ง (IP, ไฟสถานะสาย, ตาราง route, DNS) และพิมพ์คำสั่งใน terminal (ipconfig /all, ping, tracert, nslookup ...)</li>
<li><b>เลือกสาเหตุ</b> ที่คิดว่าเป็นต้นเหตุจริงจากรายการ</li>
<li><b>แก้ไขการตั้งค่า</b> เฉพาะจุดที่ผิด (แก้เกินจุดจะเสียคะแนน "แก้ไขเกินขอบเขต") — เปลี่ยน IP, mask, gateway, DNS, DHCP, เปิดการ์ดแลน, เสียบสาย, เพิ่ม route, SSID หรือ Firewall</li>
<li><b>ทดสอบ</b>: ระบบ ping ตามเงื่อนไขของภารกิจให้ดูว่าผ่านหรือยัง แล้ว <b>ส่งงาน</b> (สาเหตุ 4 คะแนน + การแก้ไข 6 คะแนน)</li>
<li>กด <b>เริ่มใหม่</b> เพื่อคืนค่าเครือข่ายของภารกิจเป็นแบบเดิม</li>
<li>ภารกิจที่มีป้าย <b>สืบจากหลักฐาน</b> (ข้อ 9 เป็นต้นไป) <b>ไม่มีตัวเลือกสาเหตุ</b>: ระบบบันทึกคำสั่ง การตรวจค่าตั้ง และการทดสอบบริการของคุณโดยอัตโนมัติ
คะแนนมาจากผลจริงของเครือข่ายหลังแก้ (4) + แก้ที่ต้นเหตุ (2) + หลักฐานที่เก็บ<b>ก่อน</b>แก้ไข (3) + ทดสอบยืนยันหลังแก้ (1) และถูกหักถ้าทำส่วนอื่นเสียหรือแก้เกินจำเป็น หลังส่งงานจะเห็นคำอธิบายสาเหตุและวิธีแก้</li>
<li>ภารกิจ <b>สุ่มเหตุขัดข้อง</b> (ข้อสุดท้าย): ระบบสุ่มเครือข่ายและเหตุขัดข้อง 1–2 จุดให้ทุกครั้งที่กด <b>สุ่มสถานการณ์ใหม่</b> สืบหาด้วยเครื่องมือเดียวกัน แก้ไข ทดสอบ แล้ว<b>เขียนรายงานการแก้ปัญหา</b>ในขั้นที่ 5 (คะแนนอัตโนมัติ 20 + ครูตรวจรายงานเพิ่ม) คำอธิบายสาเหตุจะแสดงเมื่อแก้ที่ต้นเหตุได้ครบทุกจุดแล้ว</li>
</ol></details>
${EMB ? '' : '<div class="nls-troubleshoot-missions" role="list"></div>'}
<div class="nls-troubleshoot-main"></div>`;
    root.appendChild(wrap);
    const mlist = wrap.querySelector('.nls-troubleshoot-missions');
    const main = wrap.querySelector('.nls-troubleshoot-main');
    const $ = s => main.querySelector(s);

    function renderList() {
      if (!mlist) return;   // embedded: no mission list
      mlist.innerHTML = '';
      missions.forEach((m, i) => {
        const d = done[m.id];
        const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'listitem');
        b.className = 'nls-troubleshoot-mbtn' + (S.m && S.m.id === m.id ? ' nls-troubleshoot-on' : '');
        b.innerHTML = `<span class="nls-troubleshoot-lvl">${i + 1} · ${esc(LV[m.level] || m.level || '')}${m.start.gen ? '<span class="nls-troubleshoot-tag nls-troubleshoot-tgen">สุ่ม + รายงาน</span>' : m.start.mode === 'evidence' ? '<span class="nls-troubleshoot-tag">สืบจากหลักฐาน</span>' : ''}</span><b>${esc(m.title)}</b>` +
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

    const isEv = () => !!(S.m && S.m.start.mode === 'evidence');
    const phase = () => (S.m && changes(S.m.start.topo, S.work).length ? 'a' : 'b');
    function logAct(o) {
      if (!isEv()) return;
      const e = Object.assign({}, o, { ph: phase() });
      const last = S.log[S.log.length - 1];
      if (e.k === 'inspect' && last && last.k === 'inspect' && last.dev === e.dev && last.ph === e.ph) return;
      S.log.push(e);
      if (S.log.length > 300) S.log.splice(0, S.log.length - 300);
      drawLog(); drawProgress(); saveDraft();
    }
    const logText = e => e.k === 'cmd' ? `${devName(e.host)}> ${e.cmd}` : e.k === 'inspect' ? `ตรวจค่าตั้งของ ${devName(e.dev)}` :
      e.k === 'svc' ? `${devName(e.host)}> Test-NetConnection ${e.target} -Port ${e.port}` : 'กดปุ่มทดสอบเงื่อนไขภารกิจ';
    function drawLog() {
      const ul = $('.nls-troubleshoot-log'); if (!ul) return;
      const nb = S.log.filter(e => e.ph === 'b' && e.k !== 'test').length, na = S.log.filter(e => e.ph === 'a').length;
      const c = $('.nls-troubleshoot-logcount'); if (c) c.textContent = `ก่อนแก้ไข ${nb} รายการ · หลังแก้ไข ${na} รายการ`;
      ul.innerHTML = S.log.length ? S.log.slice().reverse().slice(0, 60).map(e => `<li><span class="nls-troubleshoot-ph${e.ph === 'b' ? ' nls-troubleshoot-phb' : ''}">${e.ph === 'b' ? 'ก่อนแก้' : 'หลังแก้'}</span><code>${esc(logText(e))}</code></li>`).join('')
        : '<li class="nls-troubleshoot-muted">ยังไม่มีบันทึก — เริ่มจากพิมพ์คำสั่งใน Terminal หรือแตะอุปกรณ์เพื่อดูค่าตั้ง</li>';
    }
    function rebuild(opts) {
      S.net = NS().create(TS.effTopo(S.work));
      drawMap(); drawDetail(); drawChanges();
      if (S.term) S.term.setNet(S.net);
      if (!(opts && opts.keepTests)) { const t = $('.nls-troubleshoot-testres'); if (t) t.innerHTML = ''; S.test = null; }
      drawProgress(); saveDraft();
    }

    // ------------------------------------------------------------ stepper (สำรวจ → วิเคราะห์ → แก้ไข → ทดสอบ → ส่งงาน)
    const STAGES = [
      { n: 1, name: 'สำรวจ', todo: 'ดูแผนผัง แตะอุปกรณ์เพื่อดูค่าตั้ง และลองคำสั่งใน Terminal' },
      { n: 2, name: 'วิเคราะห์', todo: 'เลือกสาเหตุที่คิดว่าเป็นต้นเหตุจริง' },
      { n: 3, name: 'แก้ไข', todo: 'แก้การตั้งค่าเฉพาะจุดที่ผิด แล้วกดบันทึก' },
      { n: 4, name: 'ทดสอบ', todo: 'กดปุ่มทดสอบให้ผ่านทุกรายการ' },
      { n: 5, name: 'ส่งงาน', todo: 'ตรวจสรุปแล้วกดส่งงาน' }
    ];
    const STAGES_EV = [
      { n: 1, name: 'สำรวจ', todo: 'ดูแผนผัง แตะอุปกรณ์เพื่อดูค่าตั้ง และลองคำสั่งใน Terminal' },
      { n: 2, name: 'หลักฐาน', todo: 'ทดสอบให้เห็นว่าขั้นไหนล้มเหลว (ping, nslookup, arp, ทดสอบบริการ) ก่อนแก้ไขอะไร' },
      { n: 3, name: 'แก้ไข', todo: 'แก้ที่ต้นเหตุเพียงจุดเดียว แล้วกดบันทึก' },
      { n: 4, name: 'ทดสอบ', todo: 'ทดสอบยืนยันหลังแก้ (คำสั่งเดิมหรือปุ่มทดสอบ)' },
      { n: 5, name: 'ส่งงาน', todo: 'ตรวจสรุปแล้วกดส่งงาน' }
    ];
    const STAGES_GEN = STAGES_EV.slice(0, 4).concat([{ n: 5, name: 'รายงาน', todo: 'เขียนรายงานการแก้ปัญหาให้ครบทุกหัวข้อ แล้วกดส่งงาน' }]);
    const isGen = () => !!(S.m && S.m.start.gen);
    const isBasic = () => !!(S.m && S.m.start && S.m.start.basic);
    /* 3.1 basic missions speak in device names ("ทดสอบการเชื่อมต่อ จาก PC3 ไป FileServer"), never in IP addresses or "ping" */
    const ipName = (ip, topo) => { const ds = ((topo || S.work || (S.m && S.m.start.topo)) || {}).devices || []; const d = ds.find(x => (x.ifaces || []).some(f => f.ip === ip)); return d ? d.name : ip; };
    const pingLabel = (src, ip, basic, topo) => basic ? `ทดสอบการเชื่อมต่อ จาก ${devName(src)} ไป ${ipName(ip, topo)}` : `ping จาก ${devName(src)} ไป ${ip}`;
    /* 3.1 basic (week 1) missions: explore the map and the status lights only, no terminal */
    const STAGES_BASIC = STAGES.map(x => x.n === 1 ? Object.assign({}, x, { todo: 'ดูแผนผัง แตะอุปกรณ์เพื่อดูสถานะสายและไฟสถานะที่พอร์ต' }) : x.n === 3 ? Object.assign({}, x, { todo: 'เสียบสายที่หลุดให้ถูกจุด (ภารกิจนี้แก้ได้เฉพาะสาย)' }) : x);
    const stages = () => (isGen() ? STAGES_GEN : isEv() ? STAGES_EV : S.m && S.m.start.basic ? STAGES_BASIC : STAGES);
    function stageDone() {
      if (!S.m) return [false, false, false, false, false];
      const fixed = changes(S.m.start.topo, S.work).length > 0;
      const tested = !!(S.test && S.test.all);
      if (isEv()) {
        const nb = S.log.filter(e => e.ph === 'b' && (e.k === 'cmd' || e.k === 'svc')).length;
        return [S.explored || nb > 0 || fixed, nb >= 2, fixed, tested || (fixed && S.log.some(e => e.ph === 'a' && e.k !== 'inspect')), S.submitted];
      }
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
        b.setAttribute('aria-label', `ขั้นที่ ${i + 1} ${stages()[i].name}: ${d[i] ? 'เสร็จแล้ว' : cur === i + 1 ? 'ขั้นปัจจุบัน' : 'ยังไม่เสร็จ'}`);
        if (cur === i + 1) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      main.querySelectorAll('.nls-troubleshoot-step[data-n]').forEach(x => x.classList.toggle('nls-troubleshoot-stepok', !!d[+x.dataset.n - 1]));
      const s = stages()[cur - 1];
      const now = $('.nls-troubleshoot-snow');
      if (now) now.innerHTML = S.submitted ? `<b class="nls-troubleshoot-ok">ส่งงานแล้ว</b> — ดูคะแนนในขั้นที่ 5 หรือแก้ไขแล้วส่งใหม่ได้` : `<b>ตอนนี้: ขั้นที่ ${cur} ${esc(s.name)}</b> — ${esc(s.todo)}`;
      // summary inside the submit section
      const sum = $('.nls-troubleshoot-sum');
      const mk = ok => ok ? '<span class="nls-troubleshoot-ok">✓</span>' : '<span class="nls-troubleshoot-bad">✗</span>';
      if (sum && isEv()) {
        const ch = changes(S.m.start.topo, S.work).length;
        const nb = S.log.filter(e => e.ph === 'b' && e.k !== 'test').length;
        sum.innerHTML = `<li><b>${mk(nb > 0)} หลักฐานก่อนแก้:</b><span>${nb ? nb + ' รายการ' : 'ยังไม่มี (ขั้นที่ 1–2)'}</span></li>` +
          `<li><b>${mk(ch)} การแก้ไข:</b><span>${ch ? ch + ' รายการ' : 'ยังไม่ได้แก้ไข (ขั้นที่ 3)'}</span></li>` +
          `<li><b>${mk(d[3])} ทดสอบหลังแก้:</b><span>${S.test ? `ผ่าน ${S.test.ok}/${S.test.n} เงื่อนไข` : d[3] ? 'ทดสอบด้วยคำสั่งแล้ว' : 'ยังไม่ได้ทดสอบ (ขั้นที่ 4)'}</span></li>`;
      } else if (sum) {
        const cs = (S.m.start.causes || []).find(c => c.id === S.cause);
        const ch = changes(S.m.start.topo, S.work).length;
        sum.innerHTML = `<li><b>${d[1] ? '<span class="nls-troubleshoot-ok">✓</span>' : '<span class="nls-troubleshoot-bad">✗</span>'} สาเหตุ:</b><span>${cs ? esc(cs.text) : 'ยังไม่ได้เลือก (ขั้นที่ 2)'}</span></li>` +
          `<li><b>${ch ? '<span class="nls-troubleshoot-ok">✓</span>' : '<span class="nls-troubleshoot-bad">✗</span>'} การแก้ไข:</b><span>${ch ? ch + ' รายการ' : 'ยังไม่ได้แก้ไข (ขั้นที่ 3)'}</span></li>` +
          `<li><b>${d[3] ? '<span class="nls-troubleshoot-ok">✓</span>' : '<span class="nls-troubleshoot-bad">✗</span>'} ผลทดสอบ:</b><span>${S.test ? `ผ่าน ${S.test.ok}/${S.test.n} รายการ` : 'ยังไม่ได้ทดสอบ (ขั้นที่ 4)'}</span></li>`;
      }
    }
    // ------------------------------------------------------------ x14: generated scenario (problem + signed token)
    const DRAFT = 'nl-sim-troubleshoot-draft', TTL = 5 * 3600e3;
    function readDraft() { try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); return d && d.v === 1 && d.problem && d.token && Date.now() - d.at < TTL ? d : null; } catch (_) { return null; } }
    let draftTimer = 0;
    function saveDraft() {
      if (!isGen() || !S.gen) return;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        try { localStorage.setItem(DRAFT, JSON.stringify({ v: 1, at: S.gen.at, problem: S.gen.problem, token: S.gen.token, work: S.work, log: S.log, rpt: readReport() })); } catch (_) { /* storage full or blocked */ }
      }, 400);
    }
    function clearDraft() { try { localStorage.removeItem(DRAFT); } catch (_) { /* ignore */ } }
    const genMission = (m, problem) => Object.assign({}, m, { start: Object.assign({}, m.start, problem, { mode: 'evidence', gen: true }) });
    function open(m) {
      if (!m.start.gen) { openBody(m); return; }
      const d = readDraft();
      if (d) { S.gen = { problem: d.problem, token: d.token, at: d.at }; openBody(genMission(m, d.problem), d); return; }
      newScenario(m);
    }
    async function newScenario(m) {
      if (S.genBusy) return;
      if (S.term) { S.term.destroy(); S.term = null; }
      closeFull();
      S.genBusy = true; S.m = null;
      renderList();
      const host = document.createElement('section'); host.className = 'nls-troubleshoot-card';
      host.innerHTML = `<span class="nls-troubleshoot-lvl">${esc(LV[m.level] || '')}<span class="nls-troubleshoot-tag nls-troubleshoot-tgen">สุ่ม + รายงาน</span></span><h3>${esc(m.title)}</h3><p>${esc(m.desc || '')}</p><p class="nls-troubleshoot-msg" role="status">กำลังสุ่มสถานการณ์...</p>`;
      main.innerHTML = ''; main.appendChild(host);
      try {
        if (typeof ctx.newProblem !== 'function') throw new Error('ระบบสุ่มโจทย์ยังไม่พร้อม');
        const r = await ctx.newProblem(m.id);
        if (!alive) return;   // closed while the server was generating
        if (!r || !r.problem || !r.problem.topo || !r.token) throw new Error('ได้รับโจทย์ไม่ครบ');
        S.gen = { problem: r.problem, token: r.token, at: Date.now() };
        S.genBusy = false;
        openBody(genMission(m, r.problem));
        saveDraft();
      } catch (e) {
        S.genBusy = false;
        if (!alive) return;
        const msgEl = host.querySelector('.nls-troubleshoot-msg');
        msgEl.className = 'nls-troubleshoot-msg nls-troubleshoot-bad';
        msgEl.textContent = 'สุ่มสถานการณ์ไม่สำเร็จ: ' + (e && e.message ? e.message : 'เกิดข้อผิดพลาด');
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nls-troubleshoot-btn'; b.textContent = 'ลองอีกครั้ง';
        b.addEventListener('click', () => newScenario(m)); host.appendChild(b);
      }
    }
    function openBody(m, draft) {
      if (S.term) { S.term.destroy(); S.term = null; }
      closeFull();
      S.m = m; S.work = clone(m.start.topo); S.cause = null; S.explored = false; S.test = null; S.submitted = false; S.log = []; S.newArmed = false;
      if (draft && draft.work && Array.isArray(draft.work.devices)) { S.work = clone(draft.work); S.log = Array.isArray(draft.log) ? draft.log.slice(-300) : []; S.explored = S.log.length > 0; }
      const ev = m.start.mode === 'evidence', gen = !!m.start.gen;
      S.sel = m.start.focusHost || S.work.devices[0].id; S.edit = S.sel;
      const hosts = (m.start.hosts && m.start.hosts.length ? m.start.hosts : [S.sel]).filter(h => S.work.devices.some(d => d.id === h));
      S.termHost = hosts[0] || S.sel;
      renderList();
      const st = m.start;
      const devOpts = S.work.devices.map(d => `<option value="${esc(d.id)}">${esc(d.name)} — ${esc(TYPE_TH[d.type] || d.type)}</option>`).join('');
      main.innerHTML = `
<section class="nls-troubleshoot-card">
  <span class="nls-troubleshoot-lvl">${esc(LV[m.level] || '')}${gen ? '<span class="nls-troubleshoot-tag nls-troubleshoot-tgen">สุ่ม + รายงาน</span>' : ev ? '<span class="nls-troubleshoot-tag">สืบจากหลักฐาน</span>' : ''}</span>
  <h3>${esc(m.title)}</h3>
  <p>${esc(st.story || m.desc || '')}</p>
  <b>อาการที่พบ</b>
  <ul class="nls-troubleshoot-symptoms">${(st.symptoms || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
  <div class="nls-troubleshoot-row">
    <button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-hintbtn" aria-expanded="false">คำใบ้</button>
    <button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-reset">เริ่มใหม่ (คืนค่าเครือข่าย)</button>
  </div>
  <ul class="nls-troubleshoot-hints" hidden>${(m.hints || []).map(h => `<li>${esc(h)}</li>`).join('')}</ul>
  ${gen ? `<div class="nls-troubleshoot-genbar"><button type="button" class="nls-troubleshoot-btn nls-troubleshoot-newgen">สุ่มสถานการณ์ใหม่</button><span class="nls-troubleshoot-muted">${esc(st.title || '')} · รหัสโจทย์ ${esc(String(st.n || '').slice(0, 8))}</span></div><p class="nls-troubleshoot-msg nls-troubleshoot-genmsg" role="status"></p>` : ''}
  ${ev ? '<p class="nls-troubleshoot-note">ภารกิจนี้ไม่มีตัวเลือกสาเหตุ: พิสูจน์ด้วยการทดสอบและตรวจค่าตั้ง ระบบบันทึกหลักฐานให้อัตโนมัติ หลักฐานที่นับคะแนนต้องเก็บ<b>ก่อน</b>แก้ไขเครือข่าย แล้วแก้ที่ต้นเหตุให้ใช้งานได้จริงโดยไม่ทำส่วนอื่นเสีย</p>' : ''}
</section>
<nav class="nls-troubleshoot-card nls-troubleshoot-progress" aria-label="ขั้นตอนการแก้ปัญหา">
  <ol class="nls-troubleshoot-stepper">${(gen ? STAGES_GEN : ev ? STAGES_EV : st.basic ? STAGES_BASIC : STAGES).map(s => `<li><button type="button" class="nls-troubleshoot-sbtn" data-go="${s.n}"><i>${s.n}</i><span>${esc(s.name)}</span></button></li>`).join('')}</ol>
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
    ${ev ? `<div class="nls-troubleshoot-svc">
      <h4>ทดสอบบริการ (Test-NetConnection)</h4>
      <p class="nls-troubleshoot-muted">ping ทดสอบได้แค่ ICMP ส่วนเครื่องมือนี้ทดสอบว่าเชื่อมต่อพอร์ตของบริการได้จริงหรือไม่ จากเครื่องที่เลือกใน Terminal</p>
      <div class="nls-troubleshoot-svcrow">
        <label>ปลายทาง (ชื่อหรือ IP)<input type="text" class="nls-troubleshoot-svct" autocomplete="off" spellcheck="false" autocapitalize="off" inputmode="url"></label>
        <label>พอร์ต<select class="nls-troubleshoot-sel nls-troubleshoot-svcp">${(st.svcPorts || []).map(p => `<option value="${esc(p)}">${esc(p)} · ${esc(({ 53: 'DNS', 80: 'HTTP', 443: 'HTTPS', 445: 'SMB', 9100: 'พิมพ์' })[p] || '')}</option>`).join('')}</select></label>
        <button type="button" class="nls-troubleshoot-btn nls-troubleshoot-svcgo">ทดสอบพอร์ต</button>
      </div>
      <pre class="nls-troubleshoot-svcout" aria-live="polite"></pre>
    </div>` : ''}
  </section>
</div>
<div class="nls-troubleshoot-grid">
  ${ev ? `<section class="nls-troubleshoot-card nls-troubleshoot-sec" data-stage="2">
    <h3><span class="nls-troubleshoot-step" data-n="2">2</span>หลักฐานที่เก็บได้</h3>
    <p class="nls-troubleshoot-muted">บันทึกอัตโนมัติจากคำสั่ง การตรวจค่าตั้ง และการทดสอบบริการ (ใหม่สุดอยู่บน) ป้าย <b>ก่อนแก้</b> = ทำก่อนเปลี่ยนค่าใด ๆ ในเครือข่าย ใช้เป็นหลักฐานการวินิจฉัย ป้าย <b>หลังแก้</b> = การทดสอบยืนยันผล</p>
    <p class="nls-troubleshoot-logcount" aria-live="polite"></p>
    <ul class="nls-troubleshoot-log" aria-label="บันทึกหลักฐาน"></ul>
  </section>` : `<section class="nls-troubleshoot-card nls-troubleshoot-sec" data-stage="2">
    <h3><span class="nls-troubleshoot-step" data-n="2">2</span>วิเคราะห์: เลือกสาเหตุ</h3>
    <div class="nls-troubleshoot-causes" role="radiogroup" aria-label="สาเหตุของปัญหา">${(st.causes || []).map(c => `<label><input type="radio" name="nls-troubleshoot-cause" value="${esc(c.id)}"><span>${esc(c.text)}</span></label>`).join('')}</div>
  </section>`}
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
  <p class="nls-troubleshoot-muted">เงื่อนไขผ่าน: ${ev ? (st.checks || []).map(c => esc(checkLabel(c))).join(' · ') : (st.successPings || []).map(p => esc(pingLabel(p[0], p[1], !!st.basic, st.topo))).join(' · ')}</p>
  <div class="nls-troubleshoot-row">
    <button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-test">ทดสอบ</button>
  </div>
  <div class="nls-troubleshoot-testres" aria-live="polite"></div>
</section>
<section class="nls-troubleshoot-card nls-troubleshoot-sec nls-troubleshoot-subsec" data-stage="5">
  <h3><span class="nls-troubleshoot-step" data-n="5">5</span>${gen ? 'รายงานการแก้ปัญหาและส่งงาน' : 'ส่งงาน'}</h3>
  <ul class="nls-troubleshoot-sum" aria-live="polite"></ul>
  ${gen ? reportForm(st) : ''}
  <div class="nls-troubleshoot-row">
    <button type="button" class="nls-troubleshoot-btn nls-troubleshoot-submit">ส่งงาน</button>
  </div>
  <div class="nls-troubleshoot-msg nls-troubleshoot-smsg" role="status"></div>
  <div class="nls-troubleshoot-result" aria-live="polite"></div>
  ${gen ? '<div class="nls-troubleshoot-review" aria-live="polite"></div>' : ''}
</section>
</div>`;
      /* 3.1: a basic (week 1) mission is solved by looking at the network map and the status lights; the command terminal
         is hidden so students are not asked to use commands they have not learned yet */
      if (st.basic) {
        const tsec = main.querySelector('[data-stage="1t"]'); if (tsec) tsec.hidden = true;
        const card = main.querySelector('.nls-troubleshoot-card');
        if (card) { const p = document.createElement('p'); p.className = 'nls-troubleshoot-note';
          p.textContent = 'ภารกิจพื้นฐาน: สังเกตแผนผังและไฟสถานะที่พอร์ตของแต่ละเครื่อง ไม่ต้องใช้คำสั่ง'; card.appendChild(p); }
      }
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
      if (gen) wireGen(m, draft);
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
      S.net = NS().create(TS.effTopo(S.work));
      const d0 = dev(S.termHost) || {};
      const topts = { net: S.net, hostId: S.termHost, os: d0.os === 'linux' ? 'linux' : 'windows', user: termUser(d0), height: 320, quick: EMB ? false : undefined,   // 3.6: students type commands themselves
        onCommand: (cmd, h) => { logAct({ k: 'cmd', host: h || S.termHost, cmd: String(cmd).slice(0, 200) }); if (!S.explored) { S.explored = true; drawProgress(); } },
        onNetChange: () => { /* terminal-only changes (ipconfig /release) */ } };
      S.term = window.NL_TERM && typeof window.NL_TERM.create === 'function' ? window.NL_TERM.create($('.nls-troubleshoot-termbox'), topts) : fallbackTerm($('.nls-troubleshoot-termbox'), topts);
      if (ev) {
        const go = $('.nls-troubleshoot-svcgo'), ti = $('.nls-troubleshoot-svct');
        go.addEventListener('click', svcTest);
        ti.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); svcTest(); } });
      }
      drawMap(); drawDetail(); drawEditor(); drawChanges(); drawLog(); drawProgress();
    }
    // ------------------------------------------------------------ x14 report form (structured fields -> payload.rpt + payload.report)
    const RPT_PH = {
      symptom: 'ใครใช้อะไรไม่ได้ ส่วนไหนยังใช้ได้ (เช่น LAB3-PC05 เปิดเว็บ www.netlab.test ไม่ได้ แต่ ping 8.8.8.8 ได้)',
      evidence: 'คำสั่ง/การทดสอบที่ใช้และผลที่ได้ ก่อนแก้ไข (เช่น nslookup ... ได้ DNS request timed out)',
      cause: 'อธิบายว่าหลักฐานใดชี้ไปที่สาเหตุนี้ และตัดสาเหตุอื่นออกได้อย่างไร',
      fix: 'แก้ค่าอะไร บนอุปกรณ์ใด จากค่าเดิมเป็นค่าใด',
      verify: 'ทดสอบอะไรซ้ำหลังแก้ไข ผลเป็นอย่างไร และส่วนอื่นยังใช้ได้'
    };
    function rcRow(st, i, cat, devId) {
      return `<div class="nls-troubleshoot-rcrow" data-rc="${i}">
<select class="nls-troubleshoot-sel" data-rcat aria-label="หมวดสาเหตุที่ ${i + 1}"><option value="">— เลือกหมวดสาเหตุ —</option>${(st.cats || []).map(c => `<option value="${esc(c.id)}"${c.id === cat ? ' selected' : ''}>${esc(c.text)}</option>`).join('')}</select>
<select class="nls-troubleshoot-sel" data-rdev aria-label="อุปกรณ์ต้นเหตุที่ ${i + 1}"><option value="">— อุปกรณ์ต้นเหตุ —</option>${(st.topo.devices || []).filter(d => d.type !== 'internet').map(d => `<option value="${esc(d.id)}"${d.id === devId ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
${i > 0 ? '<button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-small" data-rcdel>ลบ</button>' : '<span></span>'}</div>`;
    }
    function reportForm(st) {
      const rf = (st.report || []).length ? st.report : [{ id: 'symptom', title: 'อาการที่พบ' }, { id: 'evidence', title: 'หลักฐาน/คำสั่งที่ใช้' }, { id: 'cause', title: 'สาเหตุ (อธิบาย)' }, { id: 'fix', title: 'วิธีแก้ไข' }, { id: 'verify', title: 'การทดสอบยืนยัน' }];
      const ta = (f, n) => `<label for="nls-troubleshoot-r-${f.id}">${n}. ${esc(f.title)}<textarea id="nls-troubleshoot-r-${f.id}" data-rf="${esc(f.id)}" rows="3" maxlength="1100" placeholder="${esc(RPT_PH[f.id] || '')}"></textarea></label>`;
      const by = id => rf.find(f => f.id === id) || { id, title: id };
      return `<h4>รายงานการแก้ปัญหา (Troubleshooting report)</h4>
<p class="nls-troubleshoot-muted">เขียนเหมือนรายงานส่งหัวหน้างาน: อาการ → หลักฐาน → สาเหตุ → วิธีแก้ → การทดสอบยืนยัน ระบบตรวจว่าครบทุกหัวข้อและหมวดสาเหตุตรงกับเหตุขัดข้องจริงหรือไม่ ครูจะตรวจคุณภาพของเหตุผลและการสื่อสารภายหลัง</p>
<div class="nls-troubleshoot-rpt">
${ta(by('symptom'), 1)}
${ta(by('evidence'), 2)}
<div class="nls-troubleshoot-row"><button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-small nls-troubleshoot-rfill">เติมรายการคำสั่งจากบันทึกหลักฐาน</button></div>
<fieldset><legend>3. สาเหตุ (Root cause)</legend>
<p class="nls-troubleshoot-rchint">เลือกหมวดและอุปกรณ์ต้นเหตุ ถ้าพบเหตุขัดข้องมากกว่าหนึ่งจุดให้เพิ่มสาเหตุที่ 2 แล้วอธิบายเหตุผลในช่องด้านล่าง</p>
<div class="nls-troubleshoot-rcs">${rcRow(st, 0, '', '')}</div>
<div class="nls-troubleshoot-row"><button type="button" class="nls-troubleshoot-btn nls-troubleshoot-ghost nls-troubleshoot-small nls-troubleshoot-rcadd">+ เพิ่มสาเหตุที่ 2</button></div>
<textarea id="nls-troubleshoot-r-cause" data-rf="cause" rows="3" maxlength="1100" aria-label="${esc(by('cause').title)}" placeholder="${esc(RPT_PH.cause)}"></textarea></fieldset>
${ta(by('fix'), 4)}
${ta(by('verify'), 5)}
</div>`;
    }
    function readReport() {
      const box = $('.nls-troubleshoot-rpt'); if (!box) return S.rpt;
      const o = { causes: [] };
      box.querySelectorAll('[data-rf]').forEach(x => { o[x.dataset.rf] = x.value.slice(0, 1100); });
      box.querySelectorAll('[data-rc]').forEach(r => { const c = r.querySelector('[data-rcat]').value, d = r.querySelector('[data-rdev]').value; if (c || d) o.causes.push({ cat: c, dev: d }); });
      return o;
    }
    function fillReport(o) {
      const box = $('.nls-troubleshoot-rpt'); if (!box || !o) return;
      box.querySelectorAll('[data-rf]').forEach(x => { if (typeof o[x.dataset.rf] === 'string') x.value = o[x.dataset.rf]; });
      const rows = Array.isArray(o.causes) && o.causes.length ? o.causes.slice(0, 2) : [{ cat: '', dev: '' }];
      box.querySelector('.nls-troubleshoot-rcs').innerHTML = rows.map((c, i) => rcRow(S.m.start, i, c.cat, c.dev)).join('');
      syncRcAdd();
    }
    function syncRcAdd() { const b = $('.nls-troubleshoot-rcadd'); if (b) b.hidden = main.querySelectorAll('[data-rc]').length >= 2; }
    function reportText(o) {
      const cat = id => ((S.m.start.cats || []).find(c => c.id === id) || {}).text || '-';
      const causes = (o.causes || []).map((c, i) => `   ${i + 1}) ${cat(c.cat)} — อุปกรณ์: ${c.dev ? devName(c.dev) : '-'}`).join('\n');
      return [`รายงานการแก้ปัญหาเครือข่าย: ${S.m.start.title || S.m.title} (รหัสโจทย์ ${String(S.m.start.n || '').slice(0, 8)})`,
        '1) อาการที่พบ: ' + (o.symptom || '').trim(), '2) หลักฐาน/คำสั่งที่ใช้: ' + (o.evidence || '').trim(),
        '3) สาเหตุ (Root cause):\n' + (causes || '   -') + '\n   คำอธิบาย: ' + (o.cause || '').trim(),
        '4) วิธีแก้ไข: ' + (o.fix || '').trim(), '5) การทดสอบยืนยัน: ' + (o.verify || '').trim()].join('\n').slice(0, 6000);
    }
    function wireGen(m, draft) {
      const nb = $('.nls-troubleshoot-newgen'), gm = $('.nls-troubleshoot-genmsg');
      nb.addEventListener('click', () => {
        const busy = S.log.length || changes(S.m.start.topo, S.work).length || Object.values(readReport() || {}).some(v => typeof v === 'string' && v.trim());
        if (busy && !S.newArmed) {
          S.newArmed = true; nb.textContent = 'ยืนยันสุ่มใหม่ (งานปัจจุบันจะหายไป)';
          gm.className = 'nls-troubleshoot-msg nls-troubleshoot-genmsg nls-troubleshoot-bad'; gm.textContent = 'กดอีกครั้งเพื่อยืนยัน: บันทึกหลักฐาน การแก้ไข และรายงานของโจทย์นี้จะถูกล้าง';
          return;
        }
        clearDraft();
        const base = missions.find(x => x.id === m.id) || m;
        newScenario(base);
      });
      const rp = $('.nls-troubleshoot-rpt');
      rp.addEventListener('input', saveDraft);
      rp.addEventListener('change', saveDraft);
      rp.addEventListener('click', e => {
        if (e.target.closest('[data-rcdel]')) { e.target.closest('[data-rc]').remove(); syncRcAdd(); saveDraft(); }
      });
      $('.nls-troubleshoot-rcadd').addEventListener('click', () => {
        const box = $('.nls-troubleshoot-rcs'); if (box.querySelectorAll('[data-rc]').length >= 2) return;
        box.insertAdjacentHTML('beforeend', rcRow(S.m.start, 1, '', '')); syncRcAdd();
        const sel = box.querySelector('[data-rc="1"] [data-rcat]'); if (sel) sel.focus();
      });
      $('.nls-troubleshoot-rfill').addEventListener('click', () => {
        const ta = $('[data-rf="evidence"]');
        const lines = S.log.filter(e => e.ph === 'b' && e.k !== 'test').slice(-15).map(e => '- ' + logText(e));
        if (!lines.length) { ta.focus(); return; }
        ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + lines.join('\n') + '\n(ผลที่ได้: )';
        ta.focus(); saveDraft();
      });
      if (draft && draft.rpt) fillReport(draft.rpt);
      syncRcAdd();
      drawReview(m.id);
    }
    // teacher feedback (2.8): latest stored submission + rubric criteria the teacher scores
    async function drawReview(id, auto) {
      const box = $('.nls-troubleshoot-review'); if (!box) return;
      const crit = (S.m.review && S.m.review.teacher) || [];
      const critList = crit.length ? `<ul class="nls-troubleshoot-fb">${crit.map(c => `<li><b>${esc(c.title)}</b> (${esc(c.max)} คะแนน): ${esc(c.desc || '')}</li>`).join('')}</ul>` : '';
      box.innerHTML = `<h4>ครูตรวจรายงาน</h4><p class="nls-troubleshoot-muted">${ctx.user ? 'กำลังโหลดผลการตรวจ...' : 'เข้าสู่ระบบเพื่อส่งรายงานให้ครูตรวจ (ผู้เยี่ยมชมตรวจคะแนนอัตโนมัติได้แต่ไม่บันทึก)'}</p>${critList}`;
      if (typeof ctx.review !== 'function' || !ctx.user) return;
      let r = null;
      try { r = await ctx.review(id); } catch (_) { r = null; }
      if (!S.m || S.m.id !== id || !box.isConnected) return;
      const sub = r && r.submission;
      const cr = (r && r.review && r.review.teacher) || crit;
      if (!sub) { box.innerHTML = `<h4>ครูตรวจรายงาน</h4><p class="nls-troubleshoot-muted">ยังไม่มีงานที่ส่ง เมื่อส่งงานแล้วครูจะให้คะแนนเพิ่มตามเกณฑ์นี้</p>${critList}`; return; }
      const when = x => { try { return new Date(x).toLocaleString('th-TH'); } catch (_) { return ''; } };
      if (!sub.reviewed_at) {
        box.innerHTML = `<h4>ครูตรวจรายงาน</h4><p>ส่งล่าสุด${sub.created_at ? ' ' + esc(when(sub.created_at)) : ''}: คะแนนอัตโนมัติ ${esc(sub.auto_score)}/${esc(sub.auto_max)} · <b>รอครูตรวจ</b></p>${critList}`;
        return;
      }
      const ts = sub.teacher_scores || {};
      const tot = cr.reduce((a, c) => a + (Number(ts[c.id]) || 0), 0), tmax = cr.reduce((a, c) => a + (Number(c.max) || 0), 0);
      box.innerHTML = `<h4>ผลการตรวจจากครู</h4><p class="nls-troubleshoot-muted">ตรวจเมื่อ ${esc(when(sub.reviewed_at))} (งานที่ส่งล่าสุด คะแนนอัตโนมัติ ${esc(sub.auto_score)}/${esc(sub.auto_max)})</p>
<table class="nls-troubleshoot-rub"><thead><tr><th>เกณฑ์ของครู</th><th>คะแนน</th></tr></thead><tbody>${cr.map(c => `<tr><td>${esc(c.title)}<small>${esc(c.desc || '')}</small></td><td class="nls-troubleshoot-num">${esc(ts[c.id] !== undefined ? ts[c.id] : '-')}/${esc(c.max)}</td></tr>`).join('')}
<tr><th>รวม</th><th class="nls-troubleshoot-num">${esc(tot)}/${esc(tmax)}</th></tr></tbody></table>
${sub.teacher_comment ? `<p><b>ความเห็นของครู:</b> ${esc(sub.teacher_comment)}</p>` : ''}`;
    }
    function rubricBox(rub) {
      if (!Array.isArray(rub) || !rub.length) return '';
      return `<table class="nls-troubleshoot-rub"><thead><tr><th>เกณฑ์ (ตรวจอัตโนมัติ)</th><th>คะแนน</th></tr></thead><tbody>${rub.map(x => `<tr><td>${esc(x.title)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</td><td class="nls-troubleshoot-num">${esc(x.score)}${x.max ? '/' + esc(x.max) : ''}</td></tr>`).join('')}</tbody></table>`;
    }
    function checkLabel(c) {
      return c.kind === 'tcp' ? `เชื่อมต่อ ${TS.SVC[c.port] ? TS.SVC[c.port].name : 'TCP'} (พอร์ต ${c.port}) จาก ${devName(c.src)} ไป ${c.target}` : `ping จาก ${devName(c.src)} ไป ${c.target}`;
    }
    function svcTest() {
      const ti = $('.nls-troubleshoot-svct'), ps = $('.nls-troubleshoot-svcp'), out = $('.nls-troubleshoot-svcout');
      const target = ti.value.trim().slice(0, 80), port = +ps.value;
      const h = S.termHost, d = dev(h) || {};
      if (!target) { out.textContent = 'ใส่ชื่อหรือ IP ของเครื่องปลายทางก่อน'; ti.focus(); return; }
      const r = TS.tcpTest(NS(), S.work, h, target, port);
      const lin = d.os === 'linux';
      out.textContent = (lin ? `${termUser(d)}@${d.name}:~$ nc -zv -w 3 ${target} ${port}` : `PS C:\\Users\\${termUser(d)}> Test-NetConnection ${target} -Port ${port}`) + '\n' + TS.tcpLines(r, lin ? 'linux' : 'windows').join('\n');
      logAct({ k: 'svc', host: h, target, port });
      S.explored = true; drawProgress();
    }
    function selectDev(id) {
      if (!dev(id)) return;
      S.sel = id; S.explored = true;
      logAct({ k: 'inspect', dev: id });
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
          ['Firewall', esc(!TS.fwOn(d) ? 'ปิดใช้งานทั้งเครื่อง (ไม่มีการกรองใด ๆ)' : d.firewall && d.firewall.icmp === false ? 'เปิดอยู่ · บล็อก ping (ICMP Echo)' : 'เปิดอยู่ · อนุญาต ping')]
        ];
        if (isEv() && TS.fwOn(d)) kv.push(['กฎ Firewall ขาเข้า', esc('File and Printer Sharing (SMB-In, TCP 445): ' + (TS.fwAllows(d, 445) ? 'อนุญาต' : 'บล็อก'))]);
        if (isGen() && TS.fwOn(d)) kv.push(['กฎ Firewall ขาเข้า (เว็บ)', esc('World Wide Web Services (HTTP-In, TCP 80/443): ' + (TS.fwAllows(d, 80) ? 'อนุญาต' : 'บล็อก'))]);
        if (d.type === 'laptop' || d.ssid !== undefined) kv.splice(1, 0, ['Wi-Fi SSID ที่ตั้งไว้', esc(d.ssid || '(ไม่ได้ตั้ง)')]);
        h += `<dl class="nls-troubleshoot-kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
        const evs = conflictEvents(d);
        if (evs.length) h += `<h4>Event log (System)</h4><ul class="nls-troubleshoot-fb">${evs.map(x => `<li class="nls-troubleshoot-bad">${esc(x)}</li>`).join('')}</ul>`;
        h += '<h4>สายสัญญาณ / การเชื่อมต่อ</h4>' + linkRows(d.id);
        const sv = d.services || {};
        if (sv.dns) h += `<p><b>บริการ DNS Server:</b> ${led(sv.dns.enabled !== false, sv.dns.enabled !== false ? 'Running (ทำงาน)' : 'Stopped (หยุดทำงาน)')}</p>`;
        if (sv.dhcp && isGen()) h += `<p><b>บริการ DHCP Server:</b> ${led(sv.dhcp.enabled !== false, sv.dhcp.enabled !== false ? 'Running (ทำงาน)' : 'Stopped (หยุดทำงาน)')}</p>`;
        if (d.type === 'printer') h += `<p class="nls-troubleshoot-muted">บริการพิมพ์: RAW/JetDirect พอร์ต 9100 · MAC บนฉลากเครื่อง: <code>${esc(c.mac || '')}</code></p>`;
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
    // Windows-style IP conflict event (System log, Tcpip 4199): names only the other device's MAC, like the real one
    function conflictEvents(d) {
      if (!isEv() || d.type === 'printer' || d.os === 'linux') return [];
      return S.net.problems().filter(p => p.code === 'dup_ip' && p.dev === d.id).map(() => {
        const c = S.net.config(d.id) || {};
        const other = S.work.devices.find(x => x.id !== d.id && isHost(x.type) && (S.net.config(x.id) || {}).ip === c.ip);
        const om = other ? (S.net.config(other.id) || {}).mac : '';
        return `Tcpip 4199: The system detected an address conflict for IP address ${c.ip} with the system having network hardware address ${om}. Network operations on this system may be disrupted as a result.`;
      });
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
      if (isBasic() && d.type !== 'internet') {
        /* 3.1 basic (week 1) missions: only the cables can be changed (week 1 has not taught IP settings, DHCP or firewalls) */
        h += '<p class="nls-troubleshoot-muted">ภารกิจพื้นฐาน: แก้ได้เฉพาะการเสียบสาย</p>';
      } else if (isHost(d.type)) {
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
${isEv() ? `<label class="nls-troubleshoot-check"><input type="checkbox" data-f="smb" ${!(d.firewall && d.firewall.smb === false) ? 'checked' : ''}>Firewall: อนุญาต File and Printer Sharing (SMB-In, TCP 445)</label>
<label class="nls-troubleshoot-check"><input type="checkbox" data-f="fw" ${TS.fwOn(d) ? 'checked' : ''}>เปิดใช้งาน Firewall ของเครื่องนี้</label>` : ''}
${isGen() ? `<label class="nls-troubleshoot-check"><input type="checkbox" data-f="fwweb" ${!(d.firewall && d.firewall.web === false) ? 'checked' : ''}>Firewall: อนุญาต World Wide Web Services (HTTP-In, TCP 80/443)</label>` : ''}
${isEv() && d.services && d.services.dns ? `<label class="nls-troubleshoot-check"><input type="checkbox" data-f="dnsSvc" ${d.services.dns.enabled !== false ? 'checked' : ''}>บริการ DNS Server ทำงาน (Running)</label>` : ''}
${isGen() && d.services && d.services.dhcp ? `<label class="nls-troubleshoot-check"><input type="checkbox" data-f="dhcpSvc" ${d.services.dhcp.enabled !== false ? 'checked' : ''}>บริการ DHCP Server ทำงาน (Running)</label>` : ''}
<div class="nls-troubleshoot-row" style="margin-top:6px"><button type="button" class="nls-troubleshoot-btn nls-troubleshoot-save">บันทึกการแก้ไข</button></div>`;
      } else if (d.type === 'router') {
        if (isEv()) h += `<h4>Interfaces</h4>${(d.ifaces || []).map((f, i) => `<div class="nls-troubleshoot-ifrow"><b>${esc(f.name)}</b><input type="text" aria-label="IP address ของ ${esc(f.name)}" data-ifip="${i}" value="${esc(f.ip || '')}" inputmode="decimal" autocomplete="off" spellcheck="false"><input type="text" aria-label="Subnet mask ของ ${esc(f.name)}" data-ifpf="${i}" value="${esc(f.prefix !== undefined && f.prefix !== '' ? NS().ip.mask(f.prefix) || f.prefix : '')}" inputmode="decimal" autocomplete="off" spellcheck="false"></div>`).join('')}
<div class="nls-troubleshoot-row"><button type="button" class="nls-troubleshoot-btn nls-troubleshoot-small nls-troubleshoot-saveif">บันทึก Interfaces</button></div>`;
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
      const sif = box.querySelector('.nls-troubleshoot-saveif');
      if (sif) sif.addEventListener('click', () => {
        const ip = NS().ip; const list = [];
        for (const f of d.ifaces || []) {
          const i = d.ifaces.indexOf(f);
          const a = box.querySelector(`[data-ifip="${i}"]`).value.trim(), m = box.querySelector(`[data-ifpf="${i}"]`).value.trim();
          if (a && ip.parse(a) === null) return msg(`IP ของ ${f.name} ไม่ถูกต้อง`, true);
          const p = m ? ip.toPrefix(m) : null;
          if (m && p === null) return msg(`Subnet mask ของ ${f.name} ไม่ถูกต้อง (เช่น 255.255.255.0 หรือ /24)`, true);
          list.push([f, a, p]);
        }
        list.forEach(([f, a, p]) => { if ((f.ip || '') !== a) f.ip = a; if (p !== null && String(ip.toPrefix(f.prefix)) !== String(p)) f.prefix = p; });
        rebuild(); drawEditor(); msg('บันทึก Interfaces ของ ' + d.name + ' แล้ว');
      });
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
      const smb = g('smb'); if (smb !== undefined && smb !== !(d.firewall && d.firewall.smb === false)) d.firewall = Object.assign({}, d.firewall || {}, { smb });
      const fw = g('fw'); if (fw !== undefined && fw !== TS.fwOn(d)) d.firewall = Object.assign({}, d.firewall || {}, { enabled: fw });
      const ds = g('dnsSvc'); if (ds !== undefined && d.services && d.services.dns && ds !== (d.services.dns.enabled !== false)) d.services.dns.enabled = ds;
      const fwweb = g('fwweb'); if (fwweb !== undefined && fwweb !== !(d.firewall && d.firewall.web === false)) d.firewall = Object.assign({}, d.firewall || {}, { web: fwweb });
      const dh2 = g('dhcpSvc'); if (dh2 !== undefined && d.services && d.services.dhcp && dh2 !== (d.services.dhcp.enabled !== false)) d.services.dhcp.enabled = dh2;
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
      const net = NS().create(TS.effTopo(S.work));
      let res;
      if (isEv()) {
        res = (S.m.start.checks || []).map(c => {
          const d = dev(c.src) || {}, lin = d.os === 'linux';
          if (c.kind === 'tcp') {
            const r = TS.tcpTest(NS(), S.work, c.src, c.target, c.port);
            return { ok: r.tcp, label: checkLabel(c), why: r.tcp ? 'สำเร็จ' : (TS.TCP_WHY[r.why] || r.why), lines: TS.tcpLines(r, lin ? 'linux' : 'windows') };
          }
          const r = net.ping(c.src, c.target);
          return { ok: r.ok, label: checkLabel(c), why: r.ok ? 'สำเร็จ' : r.reasonText || r.reason, lines: lin ? r.linux : r.win };
        });
        logAct({ k: 'test' });
      } else {
        res = (S.m.start.successPings || []).map(([s, t]) => {
          const r = net.ping(s, t), d = dev(s) || {};
          return { ok: r.ok, label: pingLabel(s, t, isBasic()), why: r.ok ? 'สำเร็จ' : isBasic() ? 'ยังเชื่อมต่อไม่ได้ ดูไฟสถานะที่พอร์ตและสายของเครื่องนี้' : r.reasonText || r.reason, lines: isBasic() ? null : d.os === 'linux' ? r.linux : r.win };
        });
      }
      const ok = res.filter(x => x.ok).length;
      $('.nls-troubleshoot-testres').innerHTML = `<p class="${ok === res.length ? 'nls-troubleshoot-ok' : 'nls-troubleshoot-bad'}"><b>ผ่าน ${ok}/${res.length} รายการ</b></p><ul class="nls-troubleshoot-tests">${res.map(x =>
        `<li>${x.ok ? '<span class="nls-troubleshoot-ok">✓</span>' : '<span class="nls-troubleshoot-bad">✗</span>'} ${esc(x.label)}: ${esc(x.why)}
${x.lines ? `<details><summary>ดูผลลัพธ์</summary><pre>${esc(x.lines.join('\n'))}</pre></details>` : ''}</li>`).join('')}</ul>`;
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
      if (!isEv() && !S.cause) { m.textContent = 'กรุณาเลือกสาเหตุก่อนส่งงาน (ขั้นที่ 2)'; m.className = 'nls-troubleshoot-msg nls-troubleshoot-smsg nls-troubleshoot-bad'; return; }
      if (typeof ctx.submit !== 'function') { m.textContent = 'ระบบส่งงานยังไม่พร้อม'; return; }
      btn.disabled = true; m.className = 'nls-troubleshoot-msg nls-troubleshoot-smsg'; m.textContent = 'กำลังตรวจงาน...';
      const id = S.m.id, gen = isGen();
      try {
        let payload, extra;
        if (gen) {
          const rp = readReport() || { causes: [] };
          payload = { topo: clone(S.work), actions: S.log.slice(-300), rpt: rp, report: reportText(rp) };
          extra = { problem: S.gen.problem, token: S.gen.token };
        } else {
          payload = isEv() ? { topo: clone(S.work), actions: S.log.slice(-300) } : { cause: S.cause, topo: clone(S.work) };
        }
        const r = await ctx.submit(id, payload, extra);
        m.textContent = '';
        out.innerHTML = `<p class="nls-troubleshoot-score ${r.score === r.max ? 'nls-troubleshoot-ok' : ''}">คะแนน${gen ? 'อัตโนมัติ' : ''} ${esc(r.score)}/${esc(r.max)}</p>` +
          (r.saved === false ? '<p class="nls-troubleshoot-muted">(ยังไม่ได้บันทึกคะแนน — เข้าสู่ระบบเพื่อบันทึก)</p>' : '') +
          (gen ? rubricBox(r.rubric) : '') +
          `<ul class="nls-troubleshoot-fb">${(r.feedback || []).map(f => `<li class="${/✓/.test(f) ? 'nls-troubleshoot-ok' : /ยังไม่|ยังขาด|เกินขอบเขต|เกินจำเป็น|ไม่ถูก|ไม่ตรง|เสีย|หัก|ไม่ใช่ต้นเหตุ/.test(f) ? 'nls-troubleshoot-bad' : ''}">${esc(f)}</li>`).join('')}</ul>` +
          explainBox(r.details);
        if (gen) drawReview(id);
        const prev = done[id];
        if (!r.practice && (!prev || typeof prev.best !== 'number' || r.score > prev.best)) done[id] = { best: r.score, max: r.max, attempts: ((prev && prev.attempts) || 0) + 1 };
        renderList();
        if (S.m && S.m.id === id) { S.submitted = true; drawProgress(); }
        const sc = out.querySelector('.nls-troubleshoot-score');
        if (sc) { const r2 = sc.getBoundingClientRect(); if (r2.top < 60 || r2.bottom > (window.visualViewport ? window.visualViewport.height : window.innerHeight) - 70) sc.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); }
      } catch (e) {
        m.textContent = 'ส่งงานไม่สำเร็จ: ' + (e && e.message ? e.message : 'เกิดข้อผิดพลาด');
        m.className = 'nls-troubleshoot-msg nls-troubleshoot-smsg nls-troubleshoot-bad';
      } finally { btn.disabled = false; }
    }

    function explainBox(det) {
      const x = det && det.explain;
      if (!x || typeof x !== 'object') return '';
      const ev = Array.isArray(det.evidence) ? det.evidence : [];
      return `<div class="nls-troubleshoot-explain"><h4>คำอธิบายหลังส่งงาน</h4>
<p><b>สาเหตุที่แท้จริง:</b> ${esc(x.cause)}</p>
${(x.evidence || []).length ? `<b>หลักฐานที่ชี้ไปที่สาเหตุ</b><ul>${x.evidence.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
${ev.length ? `<b>หลักฐานที่คุณเก็บได้ก่อนแก้ไข</b><ul class="nls-troubleshoot-evl">${ev.map(e => `<li><b class="${e.got ? 'nls-troubleshoot-ok' : 'nls-troubleshoot-bad'}">${e.got ? '✓' : '✗'}</b><span>${esc(e.text || (e.area ? 'ยังขาดหลักฐานด้าน' + e.area : 'ยังขาดหลักฐาน'))}</span></li>`).join('')}</ul>` : ''}
<p><b>วิธีแก้ที่ถูกต้อง:</b> ${esc(x.fix)}</p></div>`;
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
    const first = EMB ? EMB_M : missions.find(m => m.id === ctx.initial) || missions[0];   // deep link #/sim/troubleshoot/<id> opens that mission, as if clicked
    if (first) open(first);
    else main.innerHTML = '<p class="nls-troubleshoot-muted">ยังไม่มีภารกิจ</p>';
    return {
      destroy() {
        alive = false;
        closeFull();
        if (S.viewer) { S.viewer.destroy(); S.viewer = null; }
        clearTimeout(kbTimer); clearTimeout(vvTimer); clearTimeout(rzTimer); clearTimeout(draftTimer);
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
