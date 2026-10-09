'use strict';
/*
 * NetLab - Network Terminal Simulator (browser module, SIM-SPEC §1 + §4.4)
 *
 * Registers window.NL_SIMS.terminal (missions UI) and exposes a reusable terminal component:
 *   window.NL_TERM.create(container, { net, hostId, os, user, onCommand, onNetChange, netstat, quick, instant, height })
 *     -> { run(cmd) -> Promise, focus(), destroy(), setNet(net), setHost(hostId, os, user), getNet(), clear(), el }
 *   net      : a NetSim instance (window.NetSim.create(topo)); every network answer comes from it
 *   os       : 'windows' | 'linux' (default: the host's os in the topology)
 *   user     : login name ('student', 'root', 'Administrator', ...)
 *   onCommand(cmdLine, hostId)   called for every command the student runs
 *   onNetChange(newNet)          called when a command changes the network (ipconfig /release|/renew, ip link set, dhclient)
 *   netstat  : { [hostId]: [[proto, local, foreign, state], ...] } ('{ip}' in an address = the host's current IP)
 * Commands that change the host rebuild the NetSim instance from a modified copy of net.topo.
 */
(function () {
  const CSS = `
.nls-terminal{--nls-terminal-mono:"JetBrains Mono",Consolas,monospace;color:var(--ink);font-family:inherit;max-width:1200px;margin:0 auto;min-width:0}
.nls-terminal *,.nls-terminal *::before,.nls-terminal *::after{box-sizing:border-box}
.nls-terminal h2{font-size:24px;line-height:1.25;margin:0 0 6px}
.nls-terminal h3{font-size:18px;margin:0 0 8px;line-height:1.35}
.nls-terminal p{margin:0 0 8px}
.nls-terminal-muted{color:var(--muted);font-size:15px}
.nls-terminal-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 14px;min-width:0}
.nls-terminal-btn{background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;font-size:15px;cursor:pointer;line-height:1.3;min-height:40px}
.nls-terminal-btn.nls-terminal-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.nls-terminal-btn[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:var(--bg)}
.nls-terminal-btn:disabled{opacity:.5;cursor:default}
.nls-terminal-btn:focus-visible,.nls-terminal-mbtn:focus-visible,.nls-terminal-q:focus-visible,.nls-terminal-in:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-terminal-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-terminal-howto summary,.nls-terminal-map summary{cursor:pointer;font-weight:600}
.nls-terminal-howto ol{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-terminal-missions{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin:0 0 14px}
.nls-terminal-mbtn{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer;min-width:0}
.nls-terminal-mbtn b{font-size:15px;line-height:1.3}
.nls-terminal-mbtn span{font-size:13px;color:var(--muted)}
.nls-terminal-mbtn.nls-terminal-on{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-terminal-mbtn .nls-terminal-best{color:var(--ok);font-weight:600}
.nls-terminal-lvl{font:600 11px var(--nls-terminal-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.nls-terminal-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:14px;align-items:start}
.nls-terminal-layout>*{min-width:0}
.nls-terminal-hosts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.nls-terminal-os{font:600 11px var(--nls-terminal-mono);border:1px solid currentColor;border-radius:6px;padding:1px 6px;margin-left:6px;color:inherit}
.nls-terminal-map svg{display:block;width:100%;height:auto;max-height:300px}
.nls-terminal-mapbox{background:var(--field);border:1px solid var(--line);border-radius:10px;padding:6px;margin-top:8px;overflow:auto}
.nls-terminal-qs{list-style:none;margin:0;padding:0;counter-reset:q}
.nls-terminal-qs li{margin:0 0 12px}
.nls-terminal-qs label{display:block;font-size:15px;line-height:1.45;margin-bottom:4px}
.nls-terminal-qs label b{font-family:var(--nls-terminal-mono);color:var(--muted);margin-right:4px}
.nls-terminal-q{width:100%;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:15px var(--nls-terminal-mono);min-height:40px}
.nls-terminal-q.nls-terminal-right{border-color:var(--ok);box-shadow:inset 0 0 0 1px var(--ok)}
.nls-terminal-q.nls-terminal-wrong{border-color:var(--bad);box-shadow:inset 0 0 0 1px var(--bad)}
.nls-terminal-hints{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-terminal-score{font-size:22px;font-weight:700;margin:4px 0}
.nls-terminal-fb{margin:6px 0 0;padding-left:22px;font-size:15px}
.nls-terminal-fb li{margin:2px 0}
.nls-terminal-msg{min-height:1.3em;font-size:15px;margin:6px 0 0}
.nls-terminal-ok{color:var(--ok)}
.nls-terminal-bad{color:var(--bad)}
.nls-terminal-cmds{font:13px var(--nls-terminal-mono);color:var(--muted);word-break:break-word}
/* ---- terminal component ---- */
.nls-terminal-term,.nls-terminal-term *,.nls-terminal-term *::before,.nls-terminal-term *::after{box-sizing:border-box}
.nls-terminal-term{--nls-terminal-mono:"JetBrains Mono",Consolas,monospace;--nls-terminal-tbg:var(--term-bg,#0F1A24);--nls-terminal-tink:var(--term-ink,#CFE3D6);--nls-terminal-tdim:var(--term-dim,#7C93A6);
  border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--nls-terminal-tbg);min-width:0;display:flex;flex-direction:column}
.nls-terminal-bar{display:flex;align-items:center;gap:8px;background:var(--panel);border-bottom:1px solid var(--line);padding:5px 10px;font-size:13px;color:var(--ink);min-width:0}
.nls-terminal-bar span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--nls-terminal-mono)}
.nls-terminal-dots{display:flex;gap:5px}
.nls-terminal-dots i{width:10px;height:10px;border-radius:50%;background:var(--line);display:block}
.nls-terminal-linux .nls-terminal-dots i:nth-child(1){background:var(--bad)}
.nls-terminal-linux .nls-terminal-dots i:nth-child(2){background:var(--orange)}
.nls-terminal-linux .nls-terminal-dots i:nth-child(3){background:var(--green)}
.nls-terminal-win .nls-terminal-dots{order:2}
.nls-terminal-win .nls-terminal-dots i{border-radius:1px;width:11px;height:2px;background:var(--muted)}
.nls-terminal-screen{flex:0 0 auto;overflow:auto;padding:8px 10px 10px;font:14px/1.45 var(--nls-terminal-mono);color:var(--nls-terminal-tink);cursor:text;min-height:200px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.nls-terminal-out{white-space:pre;tab-size:8;margin:0;min-width:max-content}
.nls-terminal-out div{min-height:1.45em}
.nls-terminal-out .nls-terminal-hint{color:var(--nls-terminal-tdim);white-space:pre-wrap;min-width:0;max-width:60ch}
.nls-terminal-out .nls-terminal-echo{color:var(--nls-terminal-tink)}
.nls-terminal-linux .nls-terminal-pu{color:var(--green);font-weight:600}
.nls-terminal-linux .nls-terminal-pp{color:var(--blue);font-weight:600}
.nls-terminal-inrow{display:flex;align-items:baseline;white-space:pre;min-width:0}
.nls-terminal-inrow[hidden]{display:none}
.nls-terminal-prompt{flex:0 0 auto}
.nls-terminal-in{flex:1;min-width:4ch;background:transparent;border:0;outline:0;color:var(--nls-terminal-tink);font:inherit;padding:0;margin:0;caret-color:var(--nls-terminal-tink);border-radius:2px}
.nls-terminal-quick{display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:var(--panel);border-top:1px solid var(--line)}
.nls-terminal-qb{background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:5px 9px;font:13px var(--nls-terminal-mono);cursor:pointer;min-height:34px;white-space:nowrap;flex:0 0 auto;touch-action:manipulation}
.nls-terminal-qb.nls-terminal-arg::after{content:"…";color:var(--muted);margin-left:1px}
.nls-terminal-qb:focus-visible,.nls-terminal-tb:focus-visible{outline:3px solid var(--blue);outline-offset:1px}
.nls-terminal-qb:disabled,.nls-terminal-tb:disabled{opacity:.5;cursor:default}
.nls-terminal-tools{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;background:var(--panel);border-top:1px solid var(--line);min-width:0}
.nls-terminal-tb{display:inline-flex;align-items:center;justify-content:center;gap:5px;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:4px 10px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;min-height:32px;min-width:36px;white-space:nowrap;touch-action:manipulation}
.nls-terminal-tb svg{width:16px;height:16px;flex:0 0 auto}
.nls-terminal-tb.nls-terminal-run{background:var(--green);border-color:var(--green);color:var(--on-accent,#fff)}
.nls-terminal-tb.nls-terminal-copied{border-color:var(--ok);color:var(--ok)}
.nls-terminal-tsp{flex:1 1 auto}
.nls-terminal-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:980px){.nls-terminal-layout{grid-template-columns:minmax(0,1fr)}}
@media (max-width:760px){
  .nls-terminal{padding-bottom:calc(var(--nl-bnav, 0px) + 8px)}
  .nls-terminal-screen{min-height:140px;max-height:calc(var(--vvh, 100dvh) - 170px)}
  .nls-terminal-out{white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}
  .nls-terminal-quick{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scroll-padding:0 8px}
}
@media (max-width:520px){
  .nls-terminal-card{padding:12px 10px}
  .nls-terminal h2{font-size:20px}
  .nls-terminal-screen{font-size:13px;line-height:1.45;padding:6px 8px}
  .nls-terminal-missions{grid-template-columns:repeat(2,minmax(0,1fr))}
  .nls-terminal-mbtn{padding:7px 9px}
  .nls-terminal-in{font-size:16px}
}
@media (pointer:coarse){
  .nls-terminal-screen{max-height:calc(var(--vvh, 100dvh) - 170px);min-height:140px}
  .nls-terminal-in{font-size:16px}
  .nls-terminal-qb,.nls-terminal-tb{min-height:44px;min-width:44px}
  .nls-terminal-qb{padding:6px 12px;font-size:14px}
  .nls-terminal-btn,.nls-terminal-mbtn{min-height:44px}
  .nls-terminal-q{min-height:44px;font-size:16px}
  .nls-terminal-howto summary,.nls-terminal-map summary{min-height:44px;display:flex;align-items:center}
  .nls-terminal-quick{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain}
}
@media (prefers-reduced-motion:reduce){.nls-terminal-screen{scroll-behavior:auto}}
`;
  const injectCss = () => {
    if (document.getElementById('nls-terminal-css')) return;
    const st = document.createElement('style'); st.id = 'nls-terminal-css'; st.textContent = CSS; document.head.appendChild(st);
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  const clone = x => JSON.parse(JSON.stringify(x));
  const padE = (s, n) => { s = String(s); return s.length >= n ? s + ' ' : s + ' '.repeat(n - s.length); };
  const padS = (s, n) => { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; };
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ------------------------------------------------------------------ host facts
  function NS() { return window.NetSim; }
  function topoDev(net, id) { return net && net.topo ? net.topo.devices.find(d => d.id === id) : null; }
  function hostInfo(net, id) {
    const c = net.config(id) || {};
    const d = topoDev(net, id) || {};
    const released = d._released === true;
    const wifi = /^wl/.test(c.iface || '') || d.type === 'laptop';
    return { c, d, released, dhcp: !!c.dhcp || released, wifi, name: d.name || id, type: d.type };
  }
  function leaseServerIp(net, c) {
    if (!c || !c.leaseFrom) return null;
    const s = net.config(c.leaseFrom); if (!s) return null;
    if (s.ifaces) { const f = s.ifaces.find(x => x.ip && NS().ip.inSubnet(c.ip, x.ip, x.prefix)); return f ? f.ip : s.ip; }
    return s.ip;
  }
  function ll6(mac) {
    const b = String(mac || '00-00-00-00-00-00').split(/[-:]/).map(h => parseInt(h, 16) || 0);
    b[0] ^= 2;
    const h = (x, y) => ((x << 8) | y).toString(16);
    return `fe80::${h(b[0], b[1])}:${h(b[2], 0xff)}:${h(0xfe, b[3])}:${h(b[4], b[5])}`;
  }
  const WDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function winDate(d) {
    let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    const p2 = n => ('0' + n).slice(-2);
    return `${WDAY[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${ap}`;
  }
  function linuxDate(d) {
    const p2 = n => ('0' + n).slice(-2);
    return `${WDAY[d.getDay()].slice(0, 3)} ${MON[d.getMonth()].slice(0, 3)} ${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} +07 ${d.getFullYear()}`;
  }
  function nicDesc(info) {
    const mac = String(info.c.mac || '');
    if (info.wifi) return 'Intel(R) Wi-Fi 6 AX201 160MHz';
    if (/^00-15-5D/i.test(mac)) return 'Microsoft Hyper-V Network Adapter';
    if (info.type === 'server') return 'Intel(R) Ethernet Server Adapter I350-T2';
    return 'Intel(R) Ethernet Connection (7) I219-V';
  }

  // ------------------------------------------------------------------ Windows commands
  const WL = {
    host: 'Host Name . . . . . . . . . . . . :', pdns: 'Primary Dns Suffix  . . . . . . . :', node: 'Node Type . . . . . . . . . . . . :',
    iprout: 'IP Routing Enabled. . . . . . . . :', wins: 'WINS Proxy Enabled. . . . . . . . :', media: 'Media State . . . . . . . . . . . :',
    suffix: 'Connection-specific DNS Suffix  . :', desc: 'Description . . . . . . . . . . . :', phys: 'Physical Address. . . . . . . . . :',
    dhcpEn: 'DHCP Enabled. . . . . . . . . . . :', autoEn: 'Autoconfiguration Enabled . . . . :', ll6: 'Link-local IPv6 Address . . . . . :',
    ipv4: 'IPv4 Address. . . . . . . . . . . :', apipa: 'Autoconfiguration IPv4 Address. . :', mask: 'Subnet Mask . . . . . . . . . . . :',
    leaseO: 'Lease Obtained. . . . . . . . . . :', leaseE: 'Lease Expires . . . . . . . . . . :', gw: 'Default Gateway . . . . . . . . . :',
    dhcpSrv: 'DHCP Server . . . . . . . . . . . :', dns: 'DNS Servers . . . . . . . . . . . :', netbios: 'NetBIOS over Tcpip. . . . . . . . :'
  };
  const wl = (k, v) => '   ' + WL[k] + ' ' + (v == null ? '' : v);
  const DNS_IND = ' '.repeat(39);

  function winAdapterBlock(T, info, all) {
    const { c } = info;
    const out = ['', (info.wifi ? 'Wireless LAN adapter Wi-Fi:' : 'Ethernet adapter Ethernet:'), ''];
    if (!c.linked) {
      out.push(wl('media', 'Media disconnected'), wl('suffix', ''));
      if (all) out.push(wl('desc', nicDesc(info)), wl('phys', c.mac), wl('dhcpEn', info.dhcp ? 'Yes' : 'No'), wl('autoEn', 'Yes'));
      return out;
    }
    const idx = info.wifi ? 18 : 12;
    out.push(wl('suffix', info.dhcp && c.ip && !c.apipa ? 'lab.local' : ''));
    if (all) out.push(wl('desc', nicDesc(info)), wl('phys', c.mac), wl('dhcpEn', info.dhcp ? 'Yes' : 'No'), wl('autoEn', 'Yes'));
    out.push(wl('ll6', ll6(c.mac) + '%' + idx + (all ? '(Preferred) ' : '')));
    if (c.ip) {
      if (c.apipa) out.push(wl('apipa', c.ip + (all ? '(Preferred) ' : '')));
      else out.push(wl('ipv4', c.ip + (all ? '(Preferred) ' : '')));
      out.push(wl('mask', c.mask));
      if (all && info.dhcp && !c.apipa && c.leaseFrom) {
        const o = new Date(T.t0 - 72 * 60000);
        out.push(wl('leaseO', winDate(o)), wl('leaseE', winDate(new Date(o.getTime() + 8 * 86400000))));
      }
    }
    out.push(wl('gw', c.gateway || ''));
    if (all) {
      if (info.dhcp && c.ip && !c.apipa) { const s = leaseServerIp(T.net, c); if (s) out.push(wl('dhcpSrv', s)); }
      const dns = (c.dns || []).length ? c.dns : ['fec0:0:0:ffff::1%1', 'fec0:0:0:ffff::2%1', 'fec0:0:0:ffff::3%1'];
      out.push(wl('dns', dns[0])); dns.slice(1).forEach(x => out.push(DNS_IND + x));
      out.push(wl('netbios', 'Enabled'));
    }
    return out;
  }
  function winIpconfig(T, args) {
    const net = T.net, info = hostInfo(net, T.hostId);
    const a = (args[0] || '').toLowerCase();
    const head = ['', 'Windows IP Configuration', ''];
    const adapterPresent = info.c.up !== false;
    const block = (all, inf) => adapterPresent ? winAdapterBlock(T, inf || info, all) : [];
    if (!a) return head.concat([''], block(false).slice(1));
    if (a === '/all') {
      const L = head.concat([wl('host', info.name), wl('pdns', ''), wl('node', 'Hybrid'), wl('iprout', 'No'), wl('wins', 'No')]);
      return L.concat(block(true));
    }
    if (a === '/flushdns') return head.concat(['Successfully flushed the DNS Resolver Cache.']);
    if (a === '/displaydns') return head.concat(['Could not display the DNS Resolver Cache.']);
    const nm = info.wifi ? 'Wi-Fi' : 'Ethernet';
    if (a === '/release' || a === '/renew') {
      if (!adapterPresent || !info.dhcp) return head.concat(['The operation failed as no adapter is in the state permissible for', 'this operation.']);
      if (!info.c.linked) return head.concat([`No operation can be performed on ${nm} while it has its media disconnected.`]);
      if (a === '/release') {
        T.mutate(d => { d._released = true; d.dhcp = false; d.ifaces[0].ip = ''; d.ifaces[0].prefix = ''; });
        return head.concat([''], block(false, hostInfo(T.net, T.hostId)).slice(1)).concat(T.hint('(ระบบจำลอง: คืน IP ให้ DHCP server แล้ว เครื่องนี้ไม่มี IPv4 จนกว่าจะสั่ง ipconfig /renew)'));
      }
      T.mutate(d => { if (d._released) { delete d._released; } d.dhcp = true; d.ifaces[0].ip = ''; d.ifaces[0].prefix = 24; });
      T.net.clearArp(T.hostId);
      const ni = hostInfo(T.net, T.hostId);
      const L = head.slice();
      if (ni.c.apipa || !ni.c.ip) L.push(`An error occurred while renewing interface ${nm} : unable to contact your DHCP server. Request has timed out.`);
      return L.concat(winAdapterBlock(T, ni, false));
    }
    if (a === '/?' || a === '-?') return ['', 'USAGE:', '    ipconfig [/allcompartments] [/? | /all | /renew [adapter] | /release [adapter] |', '              /flushdns | /displaydns | /registerdns ]', '', 'Options:', '    /?               Display this help message', '    /all             Display full configuration information.', '    /release         Release the IPv4 address for the specified adapter.', '    /renew           Renew the IPv4 address for the specified adapter.', '    /flushdns        Purges the DNS Resolver cache.'];
    return ['', 'Error: unrecognized or incomplete command line.', '', 'USAGE:', '    ipconfig [/? | /all | /renew [adapter] | /release [adapter] | /flushdns]'];
  }
  function winPing(T, args) {
    let count = 4, target = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i], al = a.toLowerCase();
      if (al === '-t' || al === '/t') return T.hint('ระบบจำลองไม่รองรับ ping -t (ping ต่อเนื่องไม่หยุด) — ใช้ ping -n <จำนวนครั้ง> <ปลายทาง> แทน เช่น ping -n 10 8.8.8.8');
      if (al === '-n' || al === '/n') {
        const v = args[++i];
        if (!/^\d+$/.test(v || '') || +v < 1) return [`Bad value for option -n, valid range is from 1 to 4294967295.`];
        count = +v; continue;
      }
      if (/^[-/](l|w|i|v|r|s|j|k|S|c)$/i.test(a)) { i++; continue; }
      if (/^[-/]/.test(a)) continue;
      if (!target) target = a;
    }
    if (!target) return ['', 'Usage: ping [-t] [-a] [-n count] [-l size] [-f] [-i TTL] [-v TOS]', '            [-r count] [-s count] [[-j host-list] | [-k host-list]]', '            [-w timeout] [-R] [-S srcaddr] [-c compartment] [-p]', '            [-4] [-6] target_name'];
    const extra = [];
    if (count > 10) { extra.push(...T.hint('(ระบบจำลองส่งได้สูงสุด 10 ครั้ง)')); count = 10; }
    const r = T.net.ping(T.hostId, target, { count });
    return extra.concat(r.win.map(l => ({ t: l, d: /^Reply from|^PING: transmit/.test(l) ? 320 : /^Request timed out/.test(l) ? 700 : 0 })));
  }
  function winTracert(T, args) {
    let target = null, max = 30;
    for (let i = 0; i < args.length; i++) {
      const al = args[i].toLowerCase();
      if (al === '-h') { const v = +args[++i]; if (v >= 1 && v <= 255) max = Math.min(30, v); continue; }
      if (al === '-w' || al === '-j' || al === '-s') { i++; continue; }
      if (/^[-/]/.test(al)) continue;
      if (!target) target = args[i];
    }
    if (!target) return ['', 'Usage: tracert [-d] [-h maximum_hops] [-j host-list] [-w timeout]', '               [-R] [-S srcaddr] [-4] [-6] target_name'];
    const r = T.net.traceroute(T.hostId, target, { maxHops: max });
    return r.win.map(l => ({ t: l, d: /^\s+\d+\s+\*\s+\*/.test(l) ? 800 : /^\s+\d+ /.test(l) ? 380 : 0 }));
  }
  function nsDefaultServer(T) {
    const c = T.net.config(T.hostId) || {};
    const s = (c.dns || [])[0];
    if (!s) return null;
    const r = T.net.nslookup(T.hostId, s, s);
    return { ip: s, name: r.ok && r.name ? r.name : (r.serverName || 'UnKnown') };
  }
  function winNslookup(T, args) {
    const a = args.filter(x => !/^-/.test(x));
    if (!a.length) {
      const d = nsDefaultServer(T);
      const L = d ? [`Default Server:  ${d.name}`, `Address:  ${d.ip}`] : ['*** Default servers are not available', 'Default Server:  UnKnown', 'Address:  127.0.0.1'];
      return L.concat(T.hint('(ระบบจำลองไม่รองรับโหมดโต้ตอบของ nslookup — พิมพ์ nslookup <ชื่อ> [server] ในบรรทัดเดียว)'));
    }
    const r = T.net.nslookup(T.hostId, a[0], a[1]);
    return r.win.map(l => ({ t: l, d: /timed out/.test(l) ? 500 : 0 }));
  }
  function winArp(T, args) {
    const a = (args[0] || '').toLowerCase();
    if (a === '-a' || a === '/a' || a === '-g') {
      const c = T.net.config(T.hostId) || {};
      if (!c.ip || c.up === false || !c.linked) return ['No ARP Entries Found.'];
      const rows = T.net.arp(T.hostId).map(e => [e.ip, e.mac.toLowerCase(), 'dynamic']);
      rows.push([c.broadcast, 'ff-ff-ff-ff-ff-ff', 'static'], ['224.0.0.22', '01-00-5e-00-00-16', 'static'], ['224.0.0.251', '01-00-5e-00-00-fb', 'static'],
        ['239.255.255.250', '01-00-5e-7f-ff-fa', 'static'], ['255.255.255.255', 'ff-ff-ff-ff-ff-ff', 'static']);
      return ['', `Interface: ${c.ip} --- 0x${(hostInfo(T.net, T.hostId).wifi ? 18 : 12).toString(16)}`, '  Internet Address      Physical Address      Type']
        .concat(rows.map(r => '  ' + padE(r[0], 22) + padE(r[1], 22) + r[2]));
    }
    if (a === '-d' || a === '/d') {
      if (!T.admin()) return ['The ARP entry deletion failed: The requested operation requires elevation.'];
      T.net.clearArp(T.hostId); return [];
    }
    return ['', 'Displays and modifies the IP-to-Physical address translation tables used by', 'address resolution protocol (ARP).', '', 'ARP -s inet_addr eth_addr [if_addr]', 'ARP -d inet_addr [if_addr]', 'ARP -a [inet_addr] [-N if_addr] [-v]', '',
      '  -a            Displays current ARP entries by interrogating the current', '                protocol data.'];
  }
  function winRoute(T, args) {
    const a = (args[0] || '').toLowerCase();
    if (a === 'add' || a === 'delete' || a === 'change') return ['The requested operation requires elevation.'];
    if (a !== 'print') return ['', 'Manipulates network routing tables.', '', 'ROUTE [-f] [-p] [-4|-6] command [destination]', '                  [MASK netmask]  [gateway] [METRIC metric]  [IF interface]', '', '  command      One of these:', '                 PRINT     Prints  a route', '                 ADD       Adds    a route', '                 DELETE    Deletes a route'];
    const info = hostInfo(T.net, T.hostId), c = info.c;
    const sep = '='.repeat(75);
    const L = [sep, 'Interface List'];
    if (c.up !== false) L.push(` ${info.wifi ? 18 : 12}...${String(c.mac || '').toLowerCase().replace(/-/g, ' ')} ......${nicDesc(info)}`);
    L.push('  1...........................Software Loopback Interface 1', sep, '', 'IPv4 Route Table', sep, 'Active Routes:',
      'Network Destination        Netmask          Gateway       Interface  Metric');
    const row = (d, m, g, i, met) => padS(d, 17) + padS(m, 17) + padS(g, 17) + padS(i, 17) + padS(met, 7);
    const rs = T.net.routes(T.hostId);
    const ip = c.ip;
    const def = rs.find(r => r.prefix === 0);
    if (def && ip) L.push(row('0.0.0.0', '0.0.0.0', def.via, ip, 25));
    L.push(row('127.0.0.0', '255.0.0.0', 'On-link', '127.0.0.1', 331), row('127.0.0.1', '255.255.255.255', 'On-link', '127.0.0.1', 331),
      row('127.255.255.255', '255.255.255.255', 'On-link', '127.0.0.1', 331));
    if (ip && rs.length) {
      L.push(row(c.network, c.mask, 'On-link', ip, 281), row(ip, '255.255.255.255', 'On-link', ip, 281), row(c.broadcast, '255.255.255.255', 'On-link', ip, 281));
    }
    L.push(row('224.0.0.0', '240.0.0.0', 'On-link', '127.0.0.1', 331));
    if (ip && rs.length) L.push(row('224.0.0.0', '240.0.0.0', 'On-link', ip, 281));
    L.push(row('255.255.255.255', '255.255.255.255', 'On-link', '127.0.0.1', 331));
    if (ip && rs.length) L.push(row('255.255.255.255', '255.255.255.255', 'On-link', ip, 281));
    L.push(sep, 'Persistent Routes:', '  None');
    return L;
  }
  const DEFAULT_NETSTAT = [['TCP', '0.0.0.0:135', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:445', '0.0.0.0:0', 'LISTENING'],
    ['TCP', '0.0.0.0:5040', '0.0.0.0:0', 'LISTENING'], ['TCP', '0.0.0.0:49664', '0.0.0.0:0', 'LISTENING'], ['TCP', '{ip}:139', '0.0.0.0:0', 'LISTENING'],
    ['UDP', '0.0.0.0:5353', '*:*', ''], ['UDP', '{ip}:137', '*:*', '']];
  function winNetstat(T, args) {
    const flags = args.join('').toLowerCase().replace(/[-/]/g, '');
    if (/[^anobefoprstx0-9]/.test(flags)) return ['', 'Displays protocol statistics and current TCP/IP network connections.', '', 'NETSTAT [-a] [-b] [-e] [-f] [-n] [-o] [-p proto] [-r] [-s] [-x] [-t] [interval]'];
    if (flags.includes('r')) return winRoute(T, ['print']);
    const c = T.net.config(T.hostId) || {};
    const ip = c.up !== false && c.linked ? c.ip : null;
    const rows = (T.netstat && T.netstat[T.hostId]) || DEFAULT_NETSTAT;
    const all = flags.includes('a');
    const L = ['', 'Active Connections', '', '  Proto  Local Address          Foreign Address        State'];
    rows.forEach(r => {
      if (!Array.isArray(r) || r.length < 3) return;
      if (/\{ip\}/.test(r[1] + r[2]) && !ip) return;
      if (!ip && /ESTABLISHED|TIME_WAIT|SYN/.test(r[3] || '')) return;
      if (!all && (r[3] === 'LISTENING' || r[0] === 'UDP')) return;
      const f = s => String(s).replace(/\{ip\}/g, ip || '0.0.0.0');
      L.push('  ' + padE(r[0], 7) + padE(f(r[1]), 23) + padE(f(r[2]), 23) + (r[3] || '').trim());
    });
    return L;
  }
  function winGetmac(T) {
    const info = hostInfo(T.net, T.hostId), c = info.c;
    const tn = c.up === false ? 'Disabled' : !c.linked ? 'Media disconnected' : '\\Device\\Tcpip_{' + ((hashStr(c.mac || '') >>> 0).toString(16).toUpperCase() + '0000000').slice(0, 8) + '-6D2C-4E7A-9B3F-1C2D' + String(c.mac || '').replace(/-/g, '').slice(4) + '}';
    return ['', 'Physical Address    Transport Name', '=================== ==========================================================', padE(c.mac || 'N/A', 20) + tn];
  }
  const WIN_HELP = [
    'คำสั่งที่ใช้ได้ในระบบจำลอง (Windows Command Prompt):',
    '  ipconfig                 ดู IPv4 / Subnet mask / Default gateway',
    '  ipconfig /all            ดูข้อมูลเต็ม: MAC, DHCP, DNS Servers',
    '  ipconfig /release        คืน IP ที่ได้จาก DHCP',
    '  ipconfig /renew          ขอ IP ใหม่จาก DHCP',
    '  ipconfig /flushdns       ล้าง DNS cache',
    '  ping [-n N] ปลายทาง       ทดสอบการติดต่อ (IP หรือชื่อ)',
    '  tracert ปลายทาง           ดูเส้นทาง (Router ที่ผ่าน)',
    '  nslookup ชื่อ [server]     แปลงชื่อเป็น IP ผ่าน DNS',
    '  arp -a                   ดูตาราง ARP (IP ↔ MAC)',
    '  route print              ดูตารางเส้นทาง',
    '  netstat -an              ดูพอร์ตที่เปิดและการเชื่อมต่อ',
    '  hostname / getmac / whoami / cls / help'
  ];

  // ------------------------------------------------------------------ Linux commands
  function lnxIface(T) {
    const info = hostInfo(T.net, T.hostId), c = info.c;
    return { info, c, name: c.iface || (info.wifi ? 'wlan0' : 'eth0') };
  }
  function lnxFlags(c) { return c.up === false ? ['<BROADCAST,MULTICAST>', 'DOWN'] : !c.linked ? ['<NO-CARRIER,BROADCAST,MULTICAST,UP>', 'DOWN'] : ['<BROADCAST,MULTICAST,UP,LOWER_UP>', 'UP']; }
  const lmac = m => String(m || '00-00-00-00-00-00').toLowerCase().replace(/-/g, ':');
  function lnxIpAddr(T, opts) {
    const { info, c, name } = lnxIface(T);
    const [fl, st] = lnxFlags(c);
    const qd = info.wifi ? 'noqueue' : 'fq_codel';
    if (opts.brief) {
      const ip = c.ip ? `${c.ip}/${c.prefix}` : '';
      return [padE('lo', 16) + padE('UNKNOWN', 14) + '127.0.0.1/8 ::1/128', padE(name, 16) + padE(st, 14) + (ip + (c.ip && c.linked && c.up !== false ? ' ' + ll6(c.mac) + '/64' : '')).trim()];
    }
    const L = ['1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000',
      '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00', '    inet 127.0.0.1/8 scope host lo', '       valid_lft forever preferred_lft forever'];
    if (!opts.v4) L.push('    inet6 ::1/128 scope host noprefixroute', '       valid_lft forever preferred_lft forever');
    L.push(`2: ${name}: ${fl} mtu 1500 qdisc ${qd} state ${st} group default qlen 1000`, `    link/ether ${lmac(c.mac)} brd ff:ff:ff:ff:ff:ff`);
    if (c.ip) {
      if (c.apipa) L.push(`    inet ${c.ip}/16 brd 169.254.255.255 scope link ${name}`, '       valid_lft forever preferred_lft forever');
      else if (info.dhcp) L.push(`    inet ${c.ip}/${c.prefix} brd ${c.broadcast} scope global dynamic noprefixroute ${name}`, `       valid_lft ${86400 - 4317}sec preferred_lft ${86400 - 4317}sec`);
      else L.push(`    inet ${c.ip}/${c.prefix} brd ${c.broadcast} scope global ${name}`, '       valid_lft forever preferred_lft forever');
    }
    if (!opts.v4 && c.up !== false && c.linked) L.push(`    inet6 ${ll6(c.mac)}/64 scope link`, '       valid_lft forever preferred_lft forever');
    return L;
  }
  function lnxIpLink(T) {
    const { c, name, info } = lnxIface(T);
    const [fl, st] = lnxFlags(c);
    return ['1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000', '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00',
      `2: ${name}: ${fl} mtu 1500 qdisc ${info.wifi ? 'noqueue' : 'fq_codel'} state ${st} mode DEFAULT group default qlen 1000`, `    link/ether ${lmac(c.mac)} brd ff:ff:ff:ff:ff:ff`];
  }
  function lnxIpRoute(T) {
    const { c, name, info } = lnxIface(T);
    const rs = T.net.routes(T.hostId);
    const L = [];
    rs.filter(r => r.prefix === 0).forEach(r => L.push(info.dhcp ? `default via ${r.via} dev ${name} proto dhcp src ${c.ip} metric 100` : `default via ${r.via} dev ${name} proto static`));
    rs.filter(r => r.prefix !== 0).forEach(r => L.push(`${r.net}/${r.prefix} dev ${name} proto ${info.dhcp && !c.apipa ? 'dhcp' : 'kernel'} scope link src ${c.ip}${info.dhcp && !c.apipa ? ' metric 100' : ''}`));
    return L;
  }
  function lnxIp(T, args) {
    const opts = { v4: false, brief: false };
    const a = [];
    args.forEach(x => { if (x === '-4') opts.v4 = true; else if (x === '-br' || x === '-brief') opts.brief = true; else if (x === '-6' || x === '-c' || x === '-color') { /* ignore */ } else a.push(x); });
    const obj = (a[0] || '').toLowerCase();
    const sub = (a[1] || 'show').toLowerCase();
    const is = (w, full) => w.length >= 1 && full.startsWith(w);
    if (!obj) return ['Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }', '       ip [ -force ] -batch filename', 'where  OBJECT := { address | link | neigh | route | rule | ... }', '       OPTIONS := { -4 | -6 | -br[ief] | -c[olor] | ... }'];
    if (is(obj, 'address') || obj === 'addr') {
      if (is(sub, 'show') || is(sub, 'list')) {
        const dev = a[2] === 'dev' ? a[3] : a[2];
        if (dev && dev !== lnxIface(T).name && dev !== 'lo') return [`Device "${dev}" does not exist.`];
        return lnxIpAddr(T, opts);
      }
      if (sub === 'add' || sub === 'del' || sub === 'flush') return T.root() ? T.hint('(ระบบจำลองไม่รองรับการเปลี่ยน IP ด้วยคำสั่ง — ใช้เพื่อการตรวจสอบเท่านั้น)') : ['RTNETLINK answers: Operation not permitted'];
      return [`Command "${a[1]}" is unknown, try "ip address help".`];
    }
    if (is(obj, 'route') || obj === 'r') {
      if (is(sub, 'show') || is(sub, 'list')) return lnxIpRoute(T);
      if (sub === 'add' || sub === 'del') return T.root() ? T.hint('(ระบบจำลองไม่รองรับการแก้ route บนเครื่องลูกข่าย)') : ['RTNETLINK answers: Operation not permitted'];
      return [`Command "${a[1]}" is unknown, try "ip route help".`];
    }
    if (is(obj, 'link')) {
      if (sub === 'set') {
        let i = 2; if (a[i] === 'dev') i++;
        const dev = a[i], st = (a[i + 1] || '').toLowerCase();
        const { name } = lnxIface(T);
        if (!dev) return ['Not enough information: "dev" argument is required.'];
        if (dev !== name && dev !== 'lo') return [`Cannot find device "${dev}"`];
        if (st !== 'up' && st !== 'down') return st ? [`Error: either "dev" is duplicate, or "${st}" is a garbage.`] : [];
        if (!T.root()) return ['RTNETLINK answers: Operation not permitted'];
        if (dev === 'lo') return [];
        T.mutate(d => { d.ifaces.forEach(f => { if (f.name === name) f.up = st === 'up'; }); });
        return [];
      }
      if (is(sub, 'show') || is(sub, 'list')) return lnxIpLink(T);
      return [`Command "${a[1]}" is unknown, try "ip link help".`];
    }
    if (is(obj, 'neighbour') || is(obj, 'neighbor')) {
      const { name } = lnxIface(T);
      return T.net.arp(T.hostId).map(e => `${e.ip} dev ${name} lladdr ${lmac(e.mac)} REACHABLE`);
    }
    return [`Object "${a[0]}" is unknown, try "ip help".`];
  }
  function lnxPing(T, args) {
    let count = null, target = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-c') { const v = args[++i]; if (!/^\d+$/.test(v || '') || +v < 1) return [`ping: invalid argument: '${v === undefined ? '' : v}'`]; count = +v; continue; }
      const m = /^-c(\d+)$/.exec(a); if (m) { count = +m[1]; continue; }
      if (/^-(i|W|w|s|t|I)$/.test(a)) { i++; continue; }
      if (/^-/.test(a)) continue;
      if (!target) target = a;
    }
    if (!target) return ['ping: usage error: Destination address required'];
    const extra = [];
    if (count === null) { count = 4; extra.push(...T.hint('(ระบบจำลอง: ไม่ได้ใส่ -c จึงส่ง 4 ครั้งแล้วหยุดให้ — บน Linux จริงต้องกด Ctrl+C)')); }
    if (count > 10) { extra.push(...T.hint('(ระบบจำลองส่งได้สูงสุด 10 ครั้ง)')); count = 10; }
    const r = T.net.ping(T.hostId, target, { count });
    const silent = !r.linux.some(l => /^64 bytes|^From /.test(l));
    return r.linux.map((l, i) => ({ t: l, d: /^64 bytes|^From /.test(l) ? 320 : (silent && i === 1 && l === '' ? 300 * count : 0) })).concat(extra);
  }
  function lnxTraceroute(T, args) {
    let target = null, max = 30;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-m') { const v = +args[++i]; if (v >= 1) max = Math.min(30, v); continue; }
      if (/^-/.test(args[i])) continue;
      if (!target) target = args[i];
    }
    if (!target) return ['Usage:', '  traceroute [ -46dFITnreAUDV ] [ -f first_ttl ] [ -m max_ttl ] host [ packetlen ]'];
    const r = T.net.traceroute(T.hostId, target, { maxHops: max });
    return r.linux.map(l => ({ t: l, d: /^\s*\d+\s+\*/.test(l) ? 800 : /^\s*\d+\s/.test(l) ? 380 : 0 }));
  }
  function lnxNslookup(T, args) {
    const a = args.filter(x => !/^-/.test(x));
    if (!a.length) return T.hint('(ระบบจำลองไม่รองรับโหมดโต้ตอบ — พิมพ์ nslookup <ชื่อ> [server])');
    return T.net.nslookup(T.hostId, a[0], a[1]).linux.map(l => ({ t: l, d: /timed out/.test(l) ? 500 : 0 }));
  }
  function lnxDig(T, args) {
    let name = null, server, short = false;
    args.forEach(x => { if (x === '+short') short = true; else if (/^@/.test(x)) server = x.slice(1); else if (/^[+-]/.test(x) || /^(A|IN)$/i.test(x)) { /* ignore */ } else if (!name) name = x; });
    if (!name) name = '.';
    const r = T.net.nslookup(T.hostId, name === '.' ? '' : name, server);
    const timeout = /timed out|no servers/.test((r.linux || []).join(' '));
    const srv = r.server || '127.0.0.53';
    if (timeout) return [{ t: `;; communications error to ${srv}#53: timed out`, d: 600 }, { t: `;; communications error to ${srv}#53: timed out`, d: 600 }, ';; no servers could be reached'];
    if (short) return r.ok ? [r.ip] : [];
    const st = r.ok ? 'NOERROR' : /SERVFAIL/.test(r.linux.join(' ')) ? 'SERVFAIL' : 'NXDOMAIN';
    const id = (hashStr(name) % 60000) + 1000;
    const q = name.replace(/\.$/, '') + '.';
    const L = ['', `; <<>> DiG 9.18.28-0ubuntu0.22.04.1-Ubuntu <<>> ${args.join(' ')}`, ';; global options: +cmd', ';; Got answer:',
      `;; ->>HEADER<<- opcode: QUERY, status: ${st}, id: ${id}`, `;; flags: qr${r.authoritative ? ' aa' : ''} rd ra; QUERY: 1, ANSWER: ${r.ok ? 1 : 0}, AUTHORITY: 0, ADDITIONAL: 1`, '',
      ';; QUESTION SECTION:', `;${q}\t\t\tIN\tA`, ''];
    if (r.ok) L.push(';; ANSWER SECTION:', `${q}\t\t${r.authoritative ? 3600 : 300}\tIN\tA\t${r.ip}`, '');
    L.push(';; Query time: ' + (r.authoritative ? 0 : 24) + ' msec', `;; SERVER: ${srv}#53(${srv}) (UDP)`, `;; WHEN: ${linuxDate(new Date())}`, `;; MSG SIZE  rcvd: ${r.ok ? 46 + q.length : 30 + q.length}`, '');
    return L;
  }
  function lnxHost(T, args) {
    const name = args.find(x => !/^-/.test(x));
    if (!name) return ['Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time]', '            [-R number] [-m flag] [-p port] hostname [server]'];
    const r = T.net.nslookup(T.hostId, name, args[args.indexOf(name) + 1]);
    if (r.ok) return [r.name ? `${r.ip.split('.').reverse().join('.')}.in-addr.arpa domain name pointer ${r.name}.` : `${name} has address ${r.ip}`];
    if (/timed out|no servers/.test(r.linux.join(' '))) return [{ t: ';; connection timed out; no servers could be reached', d: 600 }];
    return [`Host ${name} not found: ${/SERVFAIL/.test(r.linux.join(' ')) ? '2(SERVFAIL)' : '3(NXDOMAIN)'}`];
  }
  function lnxCat(T, args) {
    if (!args.length) return [];
    const out = [];
    const { c, info } = lnxIface(T);
    args.forEach(f => {
      if (f === '/etc/resolv.conf') {
        out.push('# Generated by NetworkManager');
        if (info.dhcp && c.ip && !c.apipa) out.push('search lab.local');
        (c.dns || []).forEach(s => out.push('nameserver ' + s));
      } else if (f === '/etc/hostname') out.push(T.hostname());
      else if (f === '/etc/hosts') out.push('127.0.0.1\tlocalhost', `127.0.1.1\t${T.hostname()}`, '', '# The following lines are desirable for IPv6 capable hosts', '::1     ip6-localhost ip6-loopback');
      else out.push(`cat: ${f}: No such file or directory`);
    });
    return out;
  }
  function lnxDhclient(T, args) {
    if (!T.root()) return ['dhclient: Operation not permitted'];
    const info = hostInfo(T.net, T.hostId);
    if (!info.dhcp) return T.hint('(เครื่องนี้ตั้ง IP แบบ Static ไม่ได้ใช้ DHCP)');
    if (args.includes('-r')) { T.mutate(d => { d._released = true; d.dhcp = false; d.ifaces[0].ip = ''; d.ifaces[0].prefix = ''; }); return []; }
    T.mutate(d => { delete d._released; d.dhcp = true; d.ifaces[0].ip = ''; d.ifaces[0].prefix = 24; });
    const c = T.net.config(T.hostId);
    return c && c.ip && !c.apipa ? [] : [{ t: 'No DHCPOFFERS received.', d: 900 }];
  }
  const LNX_HELP = [
    'คำสั่งที่ใช้ได้ในระบบจำลอง (Linux bash):',
    '  ip a | ip addr            ดู IP address ของแต่ละ interface',
    '  ip -br a                  ดูแบบย่อ',
    '  ip route                  ดูตารางเส้นทาง / default gateway',
    '  ip link                   ดูสถานะ interface (UP/DOWN)',
    '  ip link set eth0 up|down  เปิด/ปิด interface (ต้องเป็น root หรือใช้ sudo)',
    '  ip neigh                  ดูตาราง ARP',
    '  ping -c N ปลายทาง          ทดสอบการติดต่อ',
    '  traceroute ปลายทาง         ดูเส้นทาง',
    '  nslookup ชื่อ | dig ชื่อ | dig +short ชื่อ | host ชื่อ',
    '  cat /etc/resolv.conf      ดู DNS server (nameserver)',
    '  hostname / whoami / clear / help'
  ];
  const NOT_INSTALLED = { ifconfig: 'net-tools', arp: 'net-tools', route: 'net-tools', netstat: 'net-tools', nmap: 'nmap', tracepath: 'iputils-tracepath' };

  // ------------------------------------------------------------------ terminal component
  const WIN_CMDS = ['ipconfig', 'ping', 'tracert', 'nslookup', 'arp', 'route', 'netstat', 'hostname', 'getmac', 'cls', 'help', 'whoami', 'ver', 'echo', 'exit'];
  const LNX_CMDS = ['ip', 'ping', 'traceroute', 'nslookup', 'dig', 'host', 'cat', 'hostname', 'whoami', 'clear', 'help', 'sudo', 'pwd', 'ls', 'echo', 'exit', 'dhclient'];
  const OPTS = {
    ipconfig: ['/all', '/release', '/renew', '/flushdns'], arp: ['-a', '-d'], route: ['print'], netstat: ['-an', '-ano', '-a'],
    ip: ['addr', 'address', 'route', 'link', 'neigh'], cat: ['/etc/resolv.conf', '/etc/hosts', '/etc/hostname'], dig: ['+short'], ping: ['-n', '-c']
  };
  const WIN_CONFUSE = { traceroute: 'บน Windows ใช้ tracert', ifconfig: 'บน Windows ใช้ ipconfig', clear: 'บน Windows ใช้ cls', ip: 'บน Windows ใช้ ipconfig', dig: 'บน Windows ใช้ nslookup', ls: 'บน Windows ใช้ dir (ไม่จำเป็นในงานนี้)' };
  const LNX_CONFUSE = { ipconfig: 'บน Linux ใช้ ip a', tracert: 'บน Linux ใช้ traceroute', cls: 'บน Linux ใช้ clear', getmac: 'บน Linux ดู MAC ด้วย ip link', ifconfig: 'ใช้ ip a แทน' };

  function createTerminal(container, opts) {
    injectCss();
    opts = opts || {};
    const T = {
      net: opts.net, hostId: opts.hostId, os: null, user: opts.user || 'student', netstat: opts.netstat || null,
      t0: Date.now(), history: [], hIdx: -1, draft: '', busy: false, cancel: null, timers: new Set(), destroyed: false, saved: new Map()
    };
    // optional per-session history (opts.historyKey): one list per host, kept in sessionStorage so a reload in the same tab keeps it
    const HKEY = opts.historyKey ? 'nl-term-hist|' + String(opts.historyKey) : null;
    const loadHist = hostId => {
      if (!HKEY) return null;
      try { const a = JSON.parse(sessionStorage.getItem(HKEY + '|' + hostId) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string').slice(-200) : []; } catch (e) { return []; }
    };
    const saveHist = () => { if (!HKEY) return; try { sessionStorage.setItem(HKEY + '|' + T.hostId, JSON.stringify(T.history.slice(-200))); } catch (e) { /* ignore */ } };
    const coarse = () => { try { return !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches); } catch (e) { return false; } };
    const ICON = {
      up: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
      down: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
      run: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>',
      copy: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
    };
    const instant = () => !!opts.instant || reduced();
    const el = document.createElement('div');
    el.className = 'nls-terminal-term';
    el.innerHTML = `<div class="nls-terminal-bar"><span class="nls-terminal-title"></span><div class="nls-terminal-dots" aria-hidden="true"><i></i><i></i><i></i></div></div>
<div class="nls-terminal-screen"><div class="nls-terminal-out" role="log" aria-live="polite" aria-label="ผลลัพธ์ของคำสั่ง"></div>
<div class="nls-terminal-inrow"><span class="nls-terminal-prompt"></span><input class="nls-terminal-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="พิมพ์คำสั่ง แล้วกด Enter"></div></div>
<div class="nls-terminal-tools" role="toolbar" aria-label="เครื่องมือ terminal">
<button type="button" class="nls-terminal-tb nls-terminal-hup" aria-label="คำสั่งก่อนหน้า" title="คำสั่งก่อนหน้า (↑)">${ICON.up}</button>
<button type="button" class="nls-terminal-tb nls-terminal-hdown" aria-label="คำสั่งถัดไป" title="คำสั่งถัดไป (↓)">${ICON.down}</button>
<button type="button" class="nls-terminal-tb nls-terminal-run" aria-label="รันคำสั่ง">${ICON.run}<span>รัน</span></button>
<span class="nls-terminal-tsp"></span>
<button type="button" class="nls-terminal-tb nls-terminal-copy">${ICON.copy}<span class="nls-terminal-copylbl">คัดลอกผลลัพธ์</span></button>
<span class="nls-terminal-sr" role="status" aria-live="polite"></span>
</div>
<div class="nls-terminal-quick" role="group" aria-label="ปุ่มคำสั่งด่วน"></div>`;
    container.appendChild(el);
    const $ = s => el.querySelector(s);
    const screen = $('.nls-terminal-screen'), out = $('.nls-terminal-out'), input = $('.nls-terminal-in'), promptEl = $('.nls-terminal-prompt'),
      inrow = $('.nls-terminal-inrow'), quick = $('.nls-terminal-quick'), title = $('.nls-terminal-title'),
      tools = $('.nls-terminal-tools'), bUp = $('.nls-terminal-hup'), bDown = $('.nls-terminal-hdown'), bRun = $('.nls-terminal-run'),
      bCopy = $('.nls-terminal-copy'), copyLbl = $('.nls-terminal-copylbl'), live = tools.querySelector('[role="status"]');
    if (opts.height) screen.style.height = typeof opts.height === 'number' ? opts.height + 'px' : opts.height;
    else screen.style.height = '420px';
    if (opts.quick === false) quick.remove();

    T.root = () => T.user === 'root' || T.sudo === true;
    T.admin = () => /^administrator$/i.test(T.user);
    T.hostname = () => { const d = topoDev(T.net, T.hostId); return String(d ? d.name : T.hostId).replace(/\s+/g, '-'); };
    T.hint = text => [{ t: text, cls: 'nls-terminal-hint' }];
    T.mutate = fn => {
      const topo = clone(T.net.topo);
      const d = topo.devices.find(x => x.id === T.hostId);
      if (!d) return;
      fn(d);
      T.net = NS().create(topo);
      if (typeof opts.onNetChange === 'function') { try { opts.onNetChange(T.net); } catch (e) { /* ignore */ } }
    };

    function promptParts() {
      if (T.os === 'windows') return [{ t: T.admin() ? 'C:\\Windows\\system32>' : `C:\\Users\\${T.user}>` }];
      const r = T.user === 'root';
      return [{ t: `${T.user}@${T.hostname()}`, c: 'nls-terminal-pu' }, { t: ':' }, { t: r ? '~' : '~', c: 'nls-terminal-pp' }, { t: r ? '# ' : '$ ' }];
    }
    function renderPrompt(target) {
      target.textContent = '';
      promptParts().forEach(p => { const s = document.createElement('span'); s.textContent = p.t; if (p.c) s.className = p.c; target.appendChild(s); });
    }
    function line(text, cls) {
      const d = document.createElement('div');
      d.textContent = text === '' ? '' : text;
      if (cls) d.className = cls;
      out.appendChild(d);
      while (out.childNodes.length > 1500) out.removeChild(out.firstChild);
      screen.scrollTop = screen.scrollHeight;
      return d;
    }
    function echo(cmd) {
      const d = document.createElement('div'); d.className = 'nls-terminal-echo';
      renderPrompt(d);
      d.appendChild(document.createTextNode(cmd));
      out.appendChild(d);
    }
    function banner() {
      const d = topoDev(T.net, T.hostId) || {};
      if (T.os === 'windows') {
        title.textContent = (T.admin() ? 'Administrator: ' : '') + 'Command Prompt — ' + (d.name || T.hostId);
        line(d.type === 'server' ? 'Microsoft Windows [Version 10.0.20348.2582]' : 'Microsoft Windows [Version 10.0.19045.4651]');
        line('(c) Microsoft Corporation. All rights reserved.'); line('');
      } else {
        title.textContent = `${T.user}@${T.hostname()}: ~`;
        line(`Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-112-generic x86_64)`); line('');
        line(`Last login: ${linuxDate(new Date(T.t0 - 3600 * 1000 * 3)).replace(' +07', '')} from 10.0.0.5`);
      }
      line('พิมพ์ help เพื่อดูคำสั่งที่ใช้ได้', 'nls-terminal-hint');
      if (T.os === 'windows') line('');
    }
    function quickButtons() {
      if (opts.quick === false) return;
      const c = T.net && T.net.config(T.hostId) || {};
      const gw = c.gateway || '';
      // [command, runs immediately?]  commands that still need an argument only fill the input
      const list = T.os === 'windows'
        ? [['ipconfig', 1], ['ipconfig /all', 1], ['ping ' + (gw || ''), !!gw], ['ping 8.8.8.8', 1], ['ping ', 0], ['tracert 8.8.8.8', 1], ['nslookup ', 0], ['arp -a', 1], ['netstat -an', 1], ['route print', 1], ['cls', 1]]
        : [['ip a', 1], ['ip route', 1], ['cat /etc/resolv.conf', 1], ['ping -c 4 ' + (gw || ''), !!gw], ['ping -c 4 8.8.8.8', 1], ['ping -c 4 ', 0], ['traceroute 8.8.8.8', 1], ['nslookup ', 0], ['dig +short ', 0], ['ip link', 1], ['clear', 1]];
      const keep = quick.scrollLeft;
      quick.innerHTML = '';
      const seen = new Set();
      list.forEach(([cmd, run]) => {
        if (seen.has(cmd)) return; seen.add(cmd);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nls-terminal-qb' + (run ? '' : ' nls-terminal-arg'); b.textContent = cmd.trim() || cmd;
        b.dataset.cmd = cmd;
        if (!run) b.setAttribute('aria-label', cmd.trim() + ' (ใส่ปลายทางต่อเอง)');
        b.addEventListener('click', () => {
          if (T.busy) return;
          if (run) api.run(cmd);
          else { input.value = cmd; input.focus(); try { input.setSelectionRange(cmd.length, cmd.length); } catch (e) { /* ignore */ } }
        });
        quick.appendChild(b);
      });
      quick.scrollLeft = keep;
    }
    function setBusy(b) {
      if (b) T.refocus = document.activeElement === input; // hiding the input row drops focus; give it back afterwards
      T.busy = b; inrow.hidden = b;
      quick.querySelectorAll('button').forEach(x => { x.disabled = b; });
      [bUp, bDown, bRun].forEach(x => { x.disabled = b; });
      if (!b) {
        renderPrompt(promptEl); screen.scrollTop = screen.scrollHeight;
        if (T.refocus && !T.destroyed) { T.refocus = false; try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } }
      }
    }
    function wait(ms) {
      return new Promise(res => {
        if (ms <= 0 || instant()) return res(true);
        const id = setTimeout(() => { T.timers.delete(id); res(true); }, ms);
        T.timers.add(id);
        T.cancel = () => { clearTimeout(id); T.timers.delete(id); res(false); };
      });
    }
    function tokenize(s) {
      const out = []; const re = /"([^"]*)"|'([^']*)'|(\S+)/g; let m;
      while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
      return out;
    }
    function execWin(cmdLine) {
      const tok = tokenize(cmdLine);
      let cmd = (tok[0] || '').toLowerCase().replace(/\.exe$/, '');
      const args = tok.slice(1);
      switch (cmd) {
        case 'ipconfig': return winIpconfig(T, args);
        case 'ping': return winPing(T, args);
        case 'tracert': return winTracert(T, args);
        case 'nslookup': return winNslookup(T, args);
        case 'arp': return winArp(T, args);
        case 'route': return winRoute(T, args);
        case 'netstat': return winNetstat(T, args);
        case 'hostname': return [T.hostname()];
        case 'getmac': return winGetmac(T);
        case 'whoami': return [`${T.hostname().toLowerCase()}\\${T.user.toLowerCase()}`];
        case 'ver': return ['', (topoDev(T.net, T.hostId) || {}).type === 'server' ? 'Microsoft Windows [Version 10.0.20348.2582]' : 'Microsoft Windows [Version 10.0.19045.4651]'];
        case 'echo': return [args.length ? cmdLine.replace(/^\s*echo\s?/i, '') : 'ECHO is on.'];
        case 'help': return WIN_HELP.map(t => ({ t, cls: 'nls-terminal-hint' }));
        case 'exit': return T.hint('(ระบบจำลอง: ไม่สามารถปิดหน้าต่างนี้ได้)');
        case 'cls': out.textContent = ''; return [];
        default: {
          const L = [`'${tok[0]}' is not recognized as an internal or external command,`, 'operable program or batch file.'];
          if (WIN_CONFUSE[cmd]) L.push(...T.hint('(คำใบ้: ' + WIN_CONFUSE[cmd] + ')'));
          return L;
        }
      }
    }
    function execLinux(cmdLine) {
      let tok = tokenize(cmdLine);
      T.sudo = false;
      const pre = [];
      if (tok[0] === 'sudo') {
        tok = tok.slice(1);
        if (!tok.length) return ['usage: sudo -h | -K | -k | -V', 'usage: sudo [-u user] command'];
        if (T.user !== 'root') { pre.push(`[sudo] password for ${T.user}: `); pre.push(...T.hint('(ระบบจำลอง: ยอมรับรหัสผ่านอัตโนมัติ)')); }
        T.sudo = true;
      }
      const cmd = tok[0] || '', args = tok.slice(1);
      let r;
      switch (cmd) {
        case 'ip': r = lnxIp(T, args); break;
        case 'ping': r = lnxPing(T, args); break;
        case 'traceroute': r = lnxTraceroute(T, args); break;
        case 'nslookup': r = lnxNslookup(T, args); break;
        case 'dig': r = lnxDig(T, args); break;
        case 'host': r = lnxHost(T, args); break;
        case 'cat': r = lnxCat(T, args); break;
        case 'dhclient': r = lnxDhclient(T, args); break;
        case 'hostname': {
          if (args[0] === '-I') { const c = T.net.config(T.hostId) || {}; r = [c.ip && c.linked && c.up !== false ? c.ip + ' ' : '']; }
          else r = [T.hostname()];
          break;
        }
        case 'whoami': r = [T.sudo ? 'root' : T.user]; break;
        case 'pwd': r = [T.user === 'root' ? '/root' : '/home/' + T.user]; break;
        case 'ls': case 'cd': r = []; break;
        case 'echo': r = [args.join(' ')]; break;
        case 'help': r = LNX_HELP.map(t => ({ t, cls: 'nls-terminal-hint' })); break;
        case 'exit': case 'logout': r = T.hint('(ระบบจำลอง: ไม่สามารถออกจากระบบได้)'); break;
        case 'clear': out.textContent = ''; r = []; break;
        default: {
          if (NOT_INSTALLED[cmd]) r = [`Command '${cmd}' not found, but can be installed with:`, '', `${T.root() ? '' : 'sudo '}apt install ${NOT_INSTALLED[cmd]}`, ''];
          else r = [`${cmd}: command not found`];
          if (LNX_CONFUSE[cmd]) r.push(...T.hint('(คำใบ้: ' + LNX_CONFUSE[cmd] + ')'));
        }
      }
      T.sudo = false;
      return pre.concat(r);
    }
    async function run(cmdLine) {
      if (T.destroyed) return;
      if (T.busy) return;
      cmdLine = String(cmdLine == null ? '' : cmdLine).replace(/[\r\n]+/g, ' ').slice(0, 300);
      input.value = '';
      echo(cmdLine);
      const trimmed = cmdLine.trim();
      if (!trimmed) { if (T.os === 'windows') { /* real cmd just reprints the prompt */ } screen.scrollTop = screen.scrollHeight; return; }
      if (T.history[T.history.length - 1] !== trimmed) T.history.push(trimmed);
      if (T.history.length > 200) T.history.shift();
      T.hIdx = -1; T.draft = '';
      saveHist();
      if (typeof opts.onCommand === 'function') { try { opts.onCommand(trimmed, T.hostId); } catch (e) { /* ignore */ } }
      let items;
      try { items = T.os === 'windows' ? execWin(trimmed) : execLinux(trimmed); }
      catch (e) { items = ['(ระบบจำลองเกิดข้อผิดพลาด: ' + (e && e.message) + ')']; }
      setBusy(true);
      try {
        for (const it of items || []) {
          if (T.destroyed) return;
          const o = typeof it === 'string' ? { t: it } : it;
          if (o.d) { const go = await wait(o.d); if (!go) { line('^C'); break; } }
          line(o.t, o.cls);
        }
        if (T.os === 'windows' && trimmed.toLowerCase() !== 'cls') line('');
      } finally {
        T.cancel = null;
        if (!T.destroyed) { setBusy(false); quickButtons(); }
      }
    }
    function histMove(dir) {
      if (!T.history.length) return;
      if (T.hIdx === -1) { if (dir > 0) return; T.draft = input.value; T.hIdx = T.history.length - 1; }
      else T.hIdx += dir;
      if (T.hIdx < 0) T.hIdx = 0;
      if (T.hIdx >= T.history.length) { T.hIdx = -1; input.value = T.draft; return; }
      input.value = T.history[T.hIdx];
      requestAnimationFrame(() => { try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* ignore */ } });
    }
    function complete() {
      const v = input.value;
      const parts = v.split(/\s+/);
      const cmds = T.os === 'windows' ? WIN_CMDS : LNX_CMDS;
      let pool, cur, base;
      if (parts.length <= 1) { cur = parts[0] || ''; pool = cmds; base = ''; }
      else {
        const c0 = (parts[0] === 'sudo' ? parts[1] : parts[0] || '').toLowerCase();
        if (parts[0] === 'sudo' && parts.length === 2) { cur = parts[1]; pool = cmds; base = 'sudo '; }
        else { cur = parts[parts.length - 1]; pool = OPTS[c0] || []; base = v.slice(0, v.length - cur.length); }
      }
      if (!cur && parts.length <= 1) return;
      const m = pool.filter(x => x.toLowerCase().startsWith(cur.toLowerCase()));
      if (!m.length) return;
      if (m.length === 1) { input.value = base + m[0] + ' '; return; }
      let pre = m[0];
      m.forEach(x => { while (!x.toLowerCase().startsWith(pre.toLowerCase())) pre = pre.slice(0, -1); });
      if (pre.length > cur.length) input.value = base + pre;
      else { echo(v); line(m.join('  ')); }
    }
    const onKey = e => {
      if (e.key === 'Enter') { e.preventDefault(); run(input.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); histMove(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); histMove(1); }
      else if (e.key === 'Tab') { if (input.value.trim()) { e.preventDefault(); complete(); } }
      else if ((e.key === 'l' || e.key === 'L') && e.ctrlKey && T.os === 'linux') { e.preventDefault(); out.textContent = ''; }
      else if ((e.key === 'c' || e.key === 'C') && e.ctrlKey && !window.getSelection().toString()) { e.preventDefault(); echo(input.value + '^C'); input.value = ''; }
    };
    const onDocKey = e => { if (T.busy && e.ctrlKey && (e.key === 'c' || e.key === 'C') && T.cancel && el.contains(document.activeElement || el)) { e.preventDefault(); T.cancel(); } };
    const onScreenClick = () => { const sel = window.getSelection && window.getSelection(); if (sel && sel.toString()) return; if (!T.busy) input.focus({ preventScroll: true }); };
    // ---- copy output (Clipboard API with a hidden-textarea fallback)
    function outputText() {
      return Array.from(out.childNodes).map(n => n.textContent).join('\n').replace(/\s+$/, '') + '\n';
    }
    function legacyCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;font-size:16px';
      document.body.appendChild(ta);
      const prev = document.activeElement;
      ta.select(); try { ta.setSelectionRange(0, text.length); } catch (e) { /* ignore */ }
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (prev && prev !== document.body && typeof prev.focus === 'function') { try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      return ok;
    }
    let copyTimer = null;
    function copyFeedback(ok) {
      copyLbl.textContent = ok ? 'คัดลอกแล้ว' : 'คัดลอกไม่ได้';
      bCopy.classList.toggle('nls-terminal-copied', ok);
      live.textContent = ok ? 'คัดลอกผลลัพธ์แล้ว' : 'คัดลอกไม่ได้ ลองเลือกข้อความแล้วคัดลอกเอง';
      if (copyTimer) { clearTimeout(copyTimer); T.timers.delete(copyTimer); }
      copyTimer = setTimeout(() => { T.timers.delete(copyTimer); copyTimer = null; if (T.destroyed) return; copyLbl.textContent = 'คัดลอกผลลัพธ์'; bCopy.classList.remove('nls-terminal-copied'); }, 1800);
      T.timers.add(copyTimer);
    }
    async function copyOutput() {
      const text = outputText();
      let ok = false;
      try { if (navigator.clipboard && window.isSecureContext !== false && typeof navigator.clipboard.writeText === 'function') { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
      if (!ok) ok = legacyCopy(text);
      if (!T.destroyed) copyFeedback(ok);
      return ok;
    }
    // tool buttons: keep the focus where it is (so the phone keyboard does not close/open on every tap)
    const keepFocus = e => { if (e.button === 0 || e.pointerType === 'touch') e.preventDefault(); };
    [bUp, bDown, bRun].forEach(b => b.addEventListener('mousedown', keepFocus));
    const onUp = () => { histMove(-1); if (!coarse()) input.focus(); };
    const onDown = () => { histMove(1); if (!coarse()) input.focus(); };
    const onRun = () => { if (!T.busy) run(input.value); };
    bUp.addEventListener('click', onUp);
    bDown.addEventListener('click', onDown);
    bRun.addEventListener('click', onRun);
    bCopy.addEventListener('click', copyOutput);
    // ---- on-screen keyboard: follow the visual viewport and keep the input line visible
    const vv = window.visualViewport || null;
    let focusTimer = null;
    const setVvh = () => { if (vv) el.style.setProperty('--vvh', Math.round(vv.height) + 'px'); };
    const keepInputVisible = () => {
      if (T.destroyed || document.activeElement !== input) return;
      screen.scrollTop = screen.scrollHeight;
      const r = input.getBoundingClientRect();
      const top = vv ? vv.offsetTop : 0, h = vv ? vv.height : window.innerHeight;
      if (r.bottom > top + h - 8 || r.top < top + 8) { try { input.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { input.scrollIntoView(); } }
    };
    const onVv = () => { setVvh(); keepInputVisible(); };
    const onFocus = () => {
      if (!coarse()) return;
      if (focusTimer) { clearTimeout(focusTimer); T.timers.delete(focusTimer); }
      focusTimer = setTimeout(() => { T.timers.delete(focusTimer); focusTimer = null; setVvh(); keepInputVisible(); }, 300);
      T.timers.add(focusTimer);
    };
    if (vv) { vv.addEventListener('resize', onVv); vv.addEventListener('scroll', onVv); setVvh(); }
    input.addEventListener('focus', onFocus);
    input.addEventListener('keydown', onKey);
    el.addEventListener('keydown', onDocKey);
    screen.addEventListener('click', onScreenClick);
    el.tabIndex = -1;

    function applyHost(hostId, os, user, fresh) {
      T.hostId = hostId;
      if (HKEY) { T.history = loadHist(hostId); T.hIdx = -1; T.draft = ''; }
      const c = T.net && T.net.config(hostId);
      T.os = os === 'linux' || os === 'windows' ? os : (c && c.os === 'linux' ? 'linux' : 'windows');
      if (user) T.user = user; else if (!T.user) T.user = 'student';
      el.classList.toggle('nls-terminal-win', T.os === 'windows');
      el.classList.toggle('nls-terminal-linux', T.os === 'linux');
      out.textContent = '';
      const saved = !fresh && T.saved.get(hostId + '|' + T.user);
      if (saved) { out.appendChild(saved.frag); title.textContent = saved.title; }
      else banner();
      renderPrompt(promptEl);
      quickButtons();
      screen.scrollTop = screen.scrollHeight;
    }
    const api = {
      el,
      run(cmd) { return run(cmd); },
      focus() { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } },
      clear() { out.textContent = ''; },
      getNet() { return T.net; },
      setNet(net, o) {
        T.net = net;
        if (o && o.reset) { T.saved.clear(); applyHost(T.hostId, T.os, T.user, true); }
        else { renderPrompt(promptEl); quickButtons(); }
      },
      setHost(hostId, os, user) {
        if (T.busy && T.cancel) T.cancel();
        const frag = document.createDocumentFragment();
        while (out.firstChild) frag.appendChild(out.firstChild);
        T.saved.set(T.hostId + '|' + T.user, { frag, title: title.textContent });
        applyHost(hostId, os, user || T.user, false);
      },
      setNetstat(ns) { T.netstat = ns || null; },
      copy() { return copyOutput(); },
      getText() { return outputText(); },
      getHistory() { return T.history.slice(); },
      destroy() {
        T.destroyed = true;
        T.timers.forEach(id => clearTimeout(id)); T.timers.clear();
        input.removeEventListener('keydown', onKey);
        input.removeEventListener('focus', onFocus);
        el.removeEventListener('keydown', onDocKey);
        screen.removeEventListener('click', onScreenClick);
        bUp.removeEventListener('click', onUp); bDown.removeEventListener('click', onDown);
        bRun.removeEventListener('click', onRun); bCopy.removeEventListener('click', copyOutput);
        if (vv) { vv.removeEventListener('resize', onVv); vv.removeEventListener('scroll', onVv); }
        el.remove();
      }
    };
    applyHost(T.hostId, opts.os, opts.user, true);
    return api;
  }
  window.NL_TERM = { create: createTerminal, version: '1.1.0' };

  // ------------------------------------------------------------------ simulator (missions UI)
  const DRAFT_KEY = 'nl-sim-terminal-draft';
  // phone keyboard per answer type: dotted values -> decimal keypad (has "."), counts/ports -> digits
  const QMODE = { ip: 'decimal', mask: 'decimal', num: 'numeric', port: 'numeric' };
  const LV = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
  const L2 = (id, a, ap, b, bp, x) => Object.assign({ id, a: { dev: a, port: ap }, b: { dev: b, port: bp }, medium: 'utp', up: true }, x || {});
  const FREE = {
    id: '__free', title: 'ฝึกอิสระ', level: 'easy', desc: 'ทดลองพิมพ์คำสั่งได้อย่างอิสระ (ไม่มีคะแนน)',
    hints: ['ลอง ipconfig /all, ping 192.168.1.1, tracert 8.8.8.8, nslookup srv.lab.local บน PC-01', 'สลับไป srv-lab (Linux) แล้วลอง ip a, ip route, dig +short www.netlab.test'],
    start: {
      story: 'ห้องปฏิบัติการจำลองสำหรับฝึกคำสั่ง: PC-01 (Windows, Static), NB-02 (Windows notebook, Wi-Fi + DHCP), srv-lab (Ubuntu, DNS server), เครื่องพิมพ์ และ Router ที่ต่ออินเทอร์เน็ต',
      hosts: [{ id: 'pc1', os: 'windows', user: 'student' }, { id: 'nb2', os: 'windows', user: 'student' }, { id: 'srv', os: 'linux', user: 'student' }],
      questions: [],
      topo: {
        devices: [
          { id: 'pc1', type: 'pc', name: 'PC-01', x: 80, y: 330, ifaces: [{ name: 'eth0', ip: '192.168.1.21', prefix: 24, mac: '3C-52-82-01-00-21' }], gateway: '192.168.1.1', dns: ['192.168.1.5'] },
          { id: 'nb2', type: 'laptop', name: 'NB-02', x: 120, y: 120, ifaces: [{ name: 'wlan0', mac: 'F4-8C-50-01-00-02' }], dhcp: true, ssid: 'NETLAB' },
          { id: 'ap1', type: 'ap', name: 'AP-LAB', x: 250, y: 120, ssid: 'NETLAB' },
          { id: 'srv', type: 'server', name: 'srv-lab', os: 'linux', x: 300, y: 340, ifaces: [{ name: 'eth0', ip: '192.168.1.5', prefix: 24, mac: '52-54-00-01-00-05' }], gateway: '192.168.1.1', dns: ['8.8.8.8'],
            services: { dns: { records: { 'srv.lab.local': '192.168.1.5', 'dns.lab.local': '192.168.1.5', 'printer.lab.local': '192.168.1.50' } }, web: true } },
          { id: 'prn', type: 'printer', name: 'PRN-01', x: 420, y: 340, ifaces: [{ name: 'eth0', ip: '192.168.1.50', prefix: 24 }], gateway: '192.168.1.1' },
          { id: 'sw1', type: 'switch', name: 'SW-LAB', x: 260, y: 230 },
          { id: 'r1', type: 'router', name: 'R-LAB', x: 460, y: 200, ifaces: [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24 }, { name: 'g0/1', ip: '203.0.113.2', prefix: 30 }],
            routes: [{ net: '0.0.0.0', prefix: 0, via: '203.0.113.1' }],
            services: { dhcp: { start: '192.168.1.100', end: '192.168.1.150', prefix: 24, gateway: '192.168.1.1', dns: ['192.168.1.5'] } } },
          { id: 'net', type: 'internet', name: 'Internet', x: 630, y: 200, ifaces: [{ name: 'wan', ip: '203.0.113.1', prefix: 30 }],
            hosts: { '8.8.8.8': 'dns.google', '1.1.1.1': 'one.one.one.one', '203.0.113.80': 'www.netlab.test' } }
        ],
        links: [L2('l1', 'pc1', 'eth0', 'sw1', 'p1'), L2('l2', 'nb2', 'wlan0', 'ap1', 'wifi', { medium: 'wifi' }), L2('l3', 'ap1', 'p1', 'sw1', 'p2'),
          L2('l4', 'srv', 'eth0', 'sw1', 'p3'), L2('l5', 'prn', 'eth0', 'sw1', 'p4'), L2('l6', 'r1', 'g0/0', 'sw1', 'p24'), L2('l7', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })]
      }
    }
  };

  const coarse = () => { try { return !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches); } catch (e) { return false; } };
  function mount(root, ctx) {
    injectCss();
    ctx = ctx || {};
    const missions = Array.isArray(ctx.missions) ? ctx.missions.filter(m => m && m.start && m.start.topo) : [];
    const done = Object.assign({}, ctx.done || {});
    const S = { mission: null, hostIdx: 0, term: null, net: null, cmds: {}, answers: {}, results: {} };
    let draft = {};
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch (e) { draft = {}; }
    const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* ignore */ } };

    const wrap = document.createElement('div');
    wrap.className = 'nls-terminal';
    wrap.innerHTML = `
<h2>จำลองการใช้คำสั่งเครือข่าย (Terminal)</h2>
<p class="nls-terminal-muted">นั่งที่เครื่องในสถานการณ์จำลอง พิมพ์คำสั่งจริงของ Windows / Linux เพื่อตรวจสอบเครือข่าย แล้วตอบคำถาม</p>
<details class="nls-terminal-card nls-terminal-howto"><summary>คำแนะนำการใช้งาน</summary><ol>
<li>เลือกภารกิจ (หรือ "ฝึกอิสระ") อ่านสถานการณ์ และดูว่าคุณนั่งที่เครื่องใด (บางภารกิจสลับเครื่องได้)</li>
<li>คลิกในหน้าจอ terminal แล้วพิมพ์คำสั่ง กด Enter — พิมพ์ <b>help</b> เพื่อดูคำสั่งที่ใช้ได้ ปุ่ม ↑/↓ เรียกคำสั่งเก่า ปุ่ม Tab เติมชื่อคำสั่ง</li>
<li>บนมือถือใช้ปุ่มคำสั่งด่วนใต้ terminal ได้ ผลลัพธ์ทั้งหมดคำนวณจากเครือข่ายจำลองจริง (ไม่ได้เขียนตายตัว)</li>
<li>กรอกคำตอบในช่องด้านขวา แล้วกด <b>ส่งคำตอบ</b> ระบบให้คะแนนรายข้อ และมีคะแนนพิเศษเมื่อใช้คำสั่งที่เหมาะสม</li>
</ol></details>
<div class="nls-terminal-missions" role="list"></div>
<div class="nls-terminal-main"></div>`;
    root.appendChild(wrap);
    const mlist = wrap.querySelector('.nls-terminal-missions');
    const main = wrap.querySelector('.nls-terminal-main');

    function statusText(m) {
      if (m.id === FREE.id) return 'ไม่มีคะแนน';
      const d = done[m.id];
      return d && typeof d.best === 'number' ? `<span class="nls-terminal-best">คะแนนดีที่สุด ${d.best}/${d.max || m.max || 10}</span>` : 'ยังไม่ทำ';
    }
    function renderList() {
      mlist.innerHTML = '';
      missions.concat([FREE]).forEach((m, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'nls-terminal-mbtn' + (S.mission && S.mission.id === m.id ? ' nls-terminal-on' : '');
        b.setAttribute('role', 'listitem');
        b.innerHTML = `<span class="nls-terminal-lvl">${m.id === FREE.id ? 'FREE' : esc((i + 1) + ' · ' + (LV[m.level] || m.level || ''))}</span><b>${esc(m.title)}</b><span>${statusText(m)}</span>`;
        b.addEventListener('click', () => openMission(m));
        mlist.appendChild(b);
      });
    }
    function destroyTerm() { if (S.term) { S.term.destroy(); S.term = null; } }
    function openMission(m) {
      destroyTerm();
      S.mission = m; S.hostIdx = 0;
      S.net = window.NetSim.create(m.start.topo);
      S.cmds[m.id] = S.cmds[m.id] || [];
      renderList();
      const st = m.start, hosts = st.hosts && st.hosts.length ? st.hosts : [{ id: st.topo.devices[0].id }];
      const qs = Array.isArray(st.questions) ? st.questions : [];
      const isFree = m.id === FREE.id;
      const a = (draft[m.id] && draft[m.id].answers) || {};
      main.innerHTML = `
<section class="nls-terminal-card">
  <span class="nls-terminal-lvl">${esc(LV[m.level] || '')}</span>
  <h3>${esc(m.title)}</h3>
  <p>${esc(st.story || m.desc || '')}</p>
  <details class="nls-terminal-map"><summary>ดูแผนผังเครือข่าย</summary><div class="nls-terminal-mapbox"></div></details>
</section>
<div class="nls-terminal-layout">
  <section class="nls-terminal-card nls-terminal-tcard">
    <div class="nls-terminal-row" style="justify-content:space-between;margin-bottom:6px"><h3 style="margin:0">เครื่องที่คุณนั่ง</h3>
      <button type="button" class="nls-terminal-btn nls-terminal-ghost nls-terminal-reset">เริ่มใหม่ (รีเซ็ตเครือข่าย)</button></div>
    <div class="nls-terminal-hosts" role="group" aria-label="เลือกเครื่อง"></div>
    <div class="nls-terminal-termbox"></div>
  </section>
  <section class="nls-terminal-card nls-terminal-qcard">
    <h3>${isFree ? 'โหมดฝึกอิสระ' : 'คำถาม'}</h3>
    ${isFree ? '<p class="nls-terminal-muted">ไม่มีคำถามและไม่มีคะแนน ลองคำสั่งต่าง ๆ ได้ตามสบาย</p>' : `<ol class="nls-terminal-qs">${qs.map((q, i) => `<li><label for="nls-terminal-q-${esc(q.id)}"><b>${i + 1}.</b>${esc(q.q)}</label><input class="nls-terminal-q" id="nls-terminal-q-${esc(q.id)}" data-q="${esc(q.id)}" type="text" autocomplete="off" spellcheck="false" autocapitalize="off" autocorrect="off"${QMODE[q.type] ? ` inputmode="${QMODE[q.type]}"` : ''} enterkeyhint="${i < qs.length - 1 ? 'next' : 'send'}" value="${esc(a[q.id] || '')}"></li>`).join('')}</ol>`}
    <div class="nls-terminal-row"><button type="button" class="nls-terminal-btn nls-terminal-ghost nls-terminal-hintbtn" aria-expanded="false">คำใบ้</button>
    ${isFree ? '' : '<button type="button" class="nls-terminal-btn nls-terminal-submit">ส่งคำตอบ</button>'}</div>
    <ul class="nls-terminal-hints" hidden>${(m.hints || []).map(h => `<li>${esc(h)}</li>`).join('')}</ul>
    <p class="nls-terminal-cmds" aria-live="polite"></p>
    <div class="nls-terminal-msg" role="status"></div>
    <div class="nls-terminal-result" aria-live="polite"></div>
  </section>
</div>`;
      const $ = s => main.querySelector(s);
      // map (names only, so it does not give answers away)
      const mapDet = $('.nls-terminal-map');
      mapDet.addEventListener('toggle', () => { if (mapDet.open) drawMap(); });
      const hostBox = $('.nls-terminal-hosts');
      hosts.forEach((h, i) => {
        const d = st.topo.devices.find(x => x.id === h.id) || {};
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nls-terminal-btn nls-terminal-ghost';
        b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
        b.innerHTML = `${esc(d.name || h.id)}<span class="nls-terminal-os">${h.os === 'linux' ? 'Linux' : 'Windows'}</span>`;
        if (hosts.length === 1) b.disabled = false;
        b.addEventListener('click', () => {
          S.hostIdx = i;
          hostBox.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
          S.term.setHost(h.id, h.os, h.user || 'student');
          if (mapDet.open) drawMap();
          S.term.focus();
        });
        hostBox.appendChild(b);
      });
      const h0 = hosts[0];
      S.term = createTerminal($('.nls-terminal-termbox'), {
        net: S.net, hostId: h0.id, os: h0.os, user: h0.user || 'student', netstat: st.netstat || null, historyKey: m.id,
        onCommand: (cmd, hostId) => {
          const list = S.cmds[m.id];
          if (list.length < 300) list.push(cmd);
          showCmds();
        },
        onNetChange: n => { S.net = n; }
      });
      function drawMap() {
        const h = hosts[S.hostIdx];
        $('.nls-terminal-mapbox').innerHTML = window.NetSim.render(st.topo, { showIp: isFree, highlight: [h.id], title: 'แผนผังเครือข่าย (วงสีส้ม = เครื่องที่คุณนั่ง)' });
      }
      function showCmds() {
        const list = S.cmds[m.id] || [];
        $('.nls-terminal-cmds').textContent = list.length ? `คำสั่งที่ใช้แล้ว ${list.length} ครั้ง: ` + Array.from(new Set(list)).slice(-8).join(' · ') : '';
      }
      showCmds();
      $('.nls-terminal-reset').addEventListener('click', () => {
        S.net = window.NetSim.create(st.topo);
        S.term.setNet(S.net, { reset: true });
        $('.nls-terminal-msg').textContent = 'รีเซ็ตเครือข่ายกลับเป็นค่าเริ่มต้นแล้ว';
      });
      const hb = $('.nls-terminal-hintbtn'), hl = $('.nls-terminal-hints');
      hb.addEventListener('click', () => { hl.hidden = !hl.hidden; hb.setAttribute('aria-expanded', String(!hl.hidden)); });
      main.querySelectorAll('.nls-terminal-q').forEach(inp => {
        inp.addEventListener('input', () => {
          draft[m.id] = draft[m.id] || { answers: {} };
          draft[m.id].answers[inp.dataset.q] = inp.value.slice(0, 120);
          inp.classList.remove('nls-terminal-right', 'nls-terminal-wrong');
          saveDraft();
        });
        inp.addEventListener('keydown', e => {
          if (e.key !== 'Enter' || e.isComposing) return;
          e.preventDefault();
          // phones: the keyboard's "next" key moves to the next empty answer; desktop (and the last field) submits as before
          if (coarse()) {
            const all = Array.from(main.querySelectorAll('.nls-terminal-q')); const i = all.indexOf(inp);
            const nx = all.slice(i + 1).find(x => !x.value.trim());
            if (nx) { nx.focus(); return; }
          }
          const sb = $('.nls-terminal-submit'); if (sb) sb.click();
        });
        inp.addEventListener('focus', () => { if (coarse()) setTimeout(() => { if (document.activeElement === inp) inp.scrollIntoView({ block: 'center', inline: 'nearest' }); }, 300); });
      });
      const sb = $('.nls-terminal-submit');
      if (sb) sb.addEventListener('click', async () => {
        const answers = {};
        main.querySelectorAll('.nls-terminal-q').forEach(inp => { answers[inp.dataset.q] = inp.value.trim().slice(0, 120); });
        const msg = $('.nls-terminal-msg'), res = $('.nls-terminal-result');
        if (typeof ctx.submit !== 'function') { msg.textContent = 'ระบบส่งงานยังไม่พร้อม'; return; }
        sb.disabled = true; msg.textContent = 'กำลังตรวจคำตอบ...';
        try {
          const r = await ctx.submit(m.id, { answers, commandsUsed: (S.cmds[m.id] || []).slice(-300) });
          msg.textContent = '';
          const q = (r && r.details && r.details.questions) || {};
          main.querySelectorAll('.nls-terminal-q').forEach(inp => {
            inp.classList.toggle('nls-terminal-right', q[inp.dataset.q] === true);
            inp.classList.toggle('nls-terminal-wrong', q[inp.dataset.q] === false);
          });
          res.innerHTML = `<p class="nls-terminal-score ${r.score === r.max ? 'nls-terminal-ok' : ''}">คะแนน ${esc(r.score)}/${esc(r.max)}</p>` +
            (r.saved === false ? '<p class="nls-terminal-muted">(ยังไม่ได้บันทึกคะแนน — เข้าสู่ระบบเพื่อบันทึก)</p>' : '') +
            `<ul class="nls-terminal-fb">${(r.feedback || []).map(f => `<li class="${/✓/.test(f) ? 'nls-terminal-ok' : ''}">${esc(f)}</li>`).join('')}</ul>`;
          const prev = done[m.id];
          if (!prev || typeof prev.best !== 'number' || r.score > prev.best) done[m.id] = { best: r.score, max: r.max, attempts: ((prev && prev.attempts) || 0) + 1 };
          renderList();
        } catch (e) {
          msg.textContent = 'ส่งคำตอบไม่สำเร็จ: ' + (e && e.message ? e.message : 'เกิดข้อผิดพลาด');
        } finally { sb.disabled = false; }
      });
    }
    renderList();
    if (missions.length) openMission(missions[0]); else openMission(FREE);
    return {
      destroy() { destroyTerm(); wrap.remove(); }
    };
  }

  window.NL_SIMS = window.NL_SIMS || {};
  window.NL_SIMS.terminal = { title: 'จำลองการใช้คำสั่งเครือข่าย (Terminal)', mount };
})();
