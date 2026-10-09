/*!
 * NetSim — NetLab network simulation engine (UMD, no dependencies, deterministic, ES2019)
 *
 * PUBLIC API
 * ----------
 *   const net = NetSim.create(topo)      deep-copies + normalises topology JSON (SIM-SPEC §3.1); never throws
 *   net.topo                             normalised topology (generated MACs, port names, coordinates, prefixes)
 *   net.problems()                       -> [{ level:'error'|'warn', code, msg (Thai), dev?, link? }]
 *   net.config(devId)                    -> { ip, prefix, mask, network, broadcast, gateway, dns:[], mac, dhcp, apipa, up,
 *                                             linked, iface, leaseFrom, os, type, name, ifaces? } | null
 *   net.ping(srcId, target, { count:4 }) -> { ok, target, resolved, reason, replies, path:[devId], win:[], linux:[],
 *                                             (extra) from, failAt, detail, ttl, rtts:[ms], reasonText }
 *   net.traceroute(srcId, target, { maxHops:30 })
 *                                        -> { ok, hops:[{ip,devId,rttMs,rtts,unreachable?}|{timeout:true}], win:[], linux:[],
 *                                             (extra) reason, resolved }
 *   net.nslookup(srcId, name, serverIp?) -> { ok, ip, server, lines:[] (in the source host's OS style),
 *                                             (extra) win:[], linux:[], serverName, reason, authoritative }
 *   net.arp(devId)                       -> [{ ip, mac, type:'dynamic' }]   learned from traffic on this instance
 *   net.routes(devId)                    -> [{ net, prefix, via|null, iface, type:'C'|'S'|'D' }]
 *   net.macTable(switchOrApId)           -> [{ mac, port }]                 learned from traffic on this instance
 *   net.l2Domain(devId)                  -> [devIds] L3 devices (hosts/routers/internet, the device itself included)
 *                                           sharing a broadcast domain with the device (for a switch/AP: its domain)
 *   (extra) net.linkState(linkId)        -> { active, reason: 'ok'|'down'|'iface_down'|'ssid'|'wifi_wrong_end'|
 *                                             'port_in_use'|'bad_link' } | null
 *   (extra) net.links()                  -> [{ id, active, reason }]
 *   (extra) net.clearArp(devId?)         clears learned ARP entries (one device or all), e.g. "arp -d" / "ipconfig /renew"
 *   (extra) net.clearMac(switchId?)      clears learned MAC tables
 *   (extra) net.resolve(srcId, name)     -> { ok, ip, reason } using the host's resolver (all DNS servers in order)
 *
 *   NetSim.ip: parse(str)->int|null, str(int), mask(prefix)->'255.255.255.0'|null, maskInt(prefix),
 *              prefixFromMask(str)->int|null, toPrefix(24|'/24'|'255.255.255.0')->int|null, inSubnet(ip,net,prefix),
 *              network(ip,prefix), broadcast(ip,prefix), firstHost, lastHost, wildcard(prefix), isPrivate(ip),
 *              classOf(ip)->'A'..'E'|null, hostsIn(prefix), defaultPrefix(ip)
 *   NetSim.render(topo|net, { width, height, highlight:[devIds], showIp:true, showPorts:false, title }) -> SVG string
 *   NetSim.reasonText  { code: Thai explanation } for ping reason codes;  NetSim.REASONS  [codes]
 *   NetSim.version
 *
 * PING REASON CODES (first failure that applies, evaluated like a real stack)
 *   ok, iface_down, no_link, no_ip, bad_target, dns_fail, same_subnet_unreachable, no_gateway,
 *   gateway_unreachable, no_route, timeout, ttl_expired
 *
 * MODELLING NOTES / SIMPLIFICATIONS
 *   - Ping/traceroute check order: loopback (127.x / "localhost": always succeeds, as in a real OS) -> adapter
 *     disabled -> no link -> no IP -> name resolution -> own IP -> on-link vs gateway -> ARP -> routers -> reply path.
 *   - Every packet of a ping behaves identically (deterministic); RTTs follow a fixed jitter pattern.
 *   - `replies` counts echo replies only. Windows still counts "Destination host unreachable"/"TTL expired" replies
 *     as Received in its statistics (real behaviour), Linux counts them as errors.
 *   - If a router's ICMP error (net unreachable / TTL expired) cannot travel back, `reason` stays the root cause
 *     (no_route / ttl_expired) but the outputs show "Request timed out." (what the user would really see).
 *   - Duplicate IPs: both devices get a dup_ip warning. ARP is answered by the device with the lowest id
 *     (natural order, e.g. pc2 < pc10), so behaviour is deterministic; the other device's replies may get lost.
 *   - A gateway outside the host's own subnet is unusable (reason no_gateway).
 *   - Switching loops are reported (code loop) and treated as if STP blocked the redundant link (first links win).
 *   - DHCP: clients (natural id order) take the next free address of the first reachable pool (servers in natural
 *     id order). A pool serves the broadcast domain of the server/router interface whose subnet contains the pool
 *     start. Addresses statically used anywhere in the topology are skipped. No reachable pool -> APIPA
 *     169.254.x.y/16 derived from the MAC, no gateway/DNS. A DHCP client whose adapter is down/unplugged has no IP.
 *   - DNS: the first server answering is used. A local DNS service answers its records (authoritative); unknown
 *     names are forwarded to the internet only if that server can itself reach 8.8.8.8 (else SERVFAIL).
 *     Public resolvers (8.8.8.8, 8.8.4.4, 1.1.1.1, 1.0.0.1, 9.9.9.9 when listed in an internet device's hosts)
 *     resolve every name listed in internet devices' `hosts`. Same-LAN NetBIOS/LLMNR name lookup is not modelled.
 *   - The Internet device answers its own interface IPs and IPs listed in `hosts` (modelled one hop behind it,
 *     initial TTL 118 like a distant server). It sends replies back to the neighbour that delivered the packet
 *     (implicit NAT/ISP behaviour) and routes nothing else.
 *   - Initial TTL: Windows 128, Linux 64 (servers may set os:'linux'; printers default to linux), routers 255.
 *   - MAC tables and ARP caches start empty and learn from ping/traceroute/nslookup traffic (DHCP is not replayed).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NetSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const MAX_DEVICES = 300;
  const MAX_LINKS = 600;

  // ------------------------------------------------------------------ IP helpers
  function parseIp(s) {
    if (typeof s === 'number') return (Number.isInteger(s) && s >= 0 && s <= 0xffffffff) ? s >>> 0 : null;
    if (typeof s !== 'string') return null;
    const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*$/.exec(s);
    if (!m) return null;
    let v = 0;
    for (let i = 1; i <= 4; i++) { const o = +m[i]; if (o > 255) return null; v = v * 256 + o; }
    return v >>> 0;
  }
  function ipStr(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return null;
    n = n >>> 0;
    return (n >>> 24) + '.' + ((n >>> 16) & 255) + '.' + ((n >>> 8) & 255) + '.' + (n & 255);
  }
  function maskInt(p) { p = toPrefix(p); if (p === null) return null; return p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0; }
  function prefixFromMask(s) {
    const v = parseIp(s); if (v === null) return null;
    const inv = (~v) >>> 0;
    if ((inv & (inv + 1)) !== 0) return null; // not contiguous
    let p = 0; for (let i = 31; i >= 0; i--) { if ((v >>> i) & 1) p++; else break; }
    return p;
  }
  function toPrefix(v) {
    if (typeof v === 'number') return (Number.isInteger(v) && v >= 0 && v <= 32) ? v : null;
    if (typeof v !== 'string') return null;
    const s = v.trim().replace(/^\//, '');
    if (/^\d{1,2}$/.test(s)) { const n = +s; return n <= 32 ? n : null; }
    return prefixFromMask(s);
  }
  function asInt(x) { return typeof x === 'number' ? parseIp(x) : parseIp(String(x === undefined || x === null ? '' : x)); }
  function netInt(ipn, p) { const m = maskInt(p); return (ipn & m) >>> 0; }
  function bcastInt(ipn, p) { const m = maskInt(p); return ((ipn & m) | (~m)) >>> 0; }
  function inSub(a, n, p) { const m = maskInt(p); return ((a & m) >>> 0) === ((n & m) >>> 0); }
  function defaultPrefix(ipn) {
    if (ipn === null) return null; const o = ipn >>> 24;
    return o < 128 ? 8 : o < 192 ? 16 : o < 224 ? 24 : null;
  }
  const IP = {
    parse: parseIp,
    str: ipStr,
    mask(p) { const m = maskInt(p); return m === null ? null : ipStr(m); },
    maskInt,
    prefixFromMask,
    toPrefix,
    inSubnet(ip, net, prefix) {
      const a = asInt(ip), n = asInt(net), p = toPrefix(prefix);
      if (a === null || n === null || p === null) return false;
      return inSub(a, n, p);
    },
    network(ip, prefix) { const a = asInt(ip), p = toPrefix(prefix); return a === null || p === null ? null : ipStr(netInt(a, p)); },
    broadcast(ip, prefix) { const a = asInt(ip), p = toPrefix(prefix); return a === null || p === null ? null : ipStr(bcastInt(a, p)); },
    firstHost(ip, prefix) {
      const a = asInt(ip), p = toPrefix(prefix); if (a === null || p === null) return null;
      return p >= 31 ? ipStr(netInt(a, p)) : ipStr(netInt(a, p) + 1);
    },
    lastHost(ip, prefix) {
      const a = asInt(ip), p = toPrefix(prefix); if (a === null || p === null) return null;
      return p >= 31 ? ipStr(bcastInt(a, p)) : ipStr(bcastInt(a, p) - 1);
    },
    wildcard(prefix) { const m = maskInt(prefix); return m === null ? null : ipStr((~m) >>> 0); },
    isPrivate(ip) {
      const a = asInt(ip); if (a === null) return false;
      return inSub(a, 0x0a000000, 8) || inSub(a, 0xac100000, 12) || inSub(a, 0xc0a80000, 16);
    },
    classOf(ip) {
      const a = asInt(ip); if (a === null) return null; const o = a >>> 24;
      return o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D' : 'E';
    },
    hostsIn(prefix) {
      const p = toPrefix(prefix); if (p === null) return null;
      return p === 32 ? 1 : p === 31 ? 2 : Math.pow(2, 32 - p) - 2;
    },
    defaultPrefix(ip) { return defaultPrefix(asInt(ip)); }
  };

  // ------------------------------------------------------------------ small utils
  function natCmp(a, b) {
    a = String(a); b = String(b);
    const re = /(\d+)|(\D+)/g;
    const ax = a.match(re) || [], bx = b.match(re) || [];
    for (let i = 0; i < Math.min(ax.length, bx.length); i++) {
      const x = ax[i], y = bx[i];
      const dx = /^\d/.test(x), dy = /^\d/.test(y);
      if (dx && dy) { const d = parseInt(x, 10) - parseInt(y, 10); if (d) return d; }
      else if (x !== y) return x < y ? -1 : 1;
    }
    if (ax.length !== bx.length) return ax.length - bx.length;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return null; } }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function str(x) { return (typeof x === 'string' || typeof x === 'number') ? String(x).trim() : ''; }
  function hex2(n) { return ('0' + (n & 255).toString(16).toUpperCase()).slice(-2); }
  function normMac(m) {
    if (typeof m !== 'string') return null;
    const h = m.replace(/[^0-9a-fA-F]/g, '');
    if (h.length !== 12 || !/^[0-9a-fA-F:\-. ]+$/.test(m.trim())) return null;
    return h.toUpperCase().match(/../g).join('-');
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  const HOST = { pc: 1, laptop: 1, server: 1, printer: 1 };
  const TYPE_ALIAS = {
    pc: 'pc', computer: 'pc', desktop: 'pc', workstation: 'pc', host: 'pc',
    laptop: 'laptop', notebook: 'laptop',
    server: 'server', printer: 'printer',
    switch: 'switch', hub: 'switch', l2switch: 'switch',
    router: 'router', gateway: 'router',
    ap: 'ap', accesspoint: 'ap', access_point: 'ap', 'access-point': 'ap', wap: 'ap',
    internet: 'internet', cloud: 'internet', isp: 'internet', wan: 'internet'
  };
  const MEDIUM_ALIAS = { utp: 'utp', copper: 'utp', ethernet: 'utp', cat5: 'utp', cat5e: 'utp', cat6: 'utp', lan: 'utp',
    fiber: 'fiber', fibre: 'fiber', optic: 'fiber', 'fiber-optic': 'fiber', wifi: 'wifi', 'wi-fi': 'wifi', wireless: 'wifi', wlan: 'wifi' };
  const PUBLIC_DNS = new Set(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9', '208.67.222.222'].map(parseIp));
  const INTERNET_HOST_TTL = 118;

  const REASON_TEXT = {
    ok: 'สำเร็จ: ปลายทางตอบกลับ (Reply) ครบ',
    iface_down: 'Network adapter ของเครื่องต้นทางถูกปิด (disabled)',
    no_link: 'สายสัญญาณของเครื่องต้นทางไม่ได้เชื่อมต่อหรือขาด / Wi-Fi ไม่ได้เชื่อมต่อ',
    no_ip: 'เครื่องต้นทางยังไม่มี IP address ที่ใช้งานได้',
    bad_target: 'หาชื่อหรือที่อยู่ปลายทางไม่พบ (ชื่อไม่มีอยู่ หรือพิมพ์ผิด)',
    dns_fail: 'ติดต่อ DNS server ไม่ได้ จึงแปลงชื่อเป็น IP ไม่ได้',
    same_subnet_unreachable: 'ปลายทางอยู่วงเดียวกันแต่ไม่พบเครื่องนั้น (ARP ไม่ได้รับคำตอบ)',
    no_gateway: 'ปลายทางอยู่ต่างวงเครือข่าย แต่ไม่มี Default gateway ที่ใช้ได้',
    gateway_unreachable: 'ติดต่อ Default gateway ไม่ได้ (ARP หา gateway ไม่พบ)',
    no_route: 'Router ไม่มีเส้นทาง (route) ไปยังวงเครือข่ายปลายทาง',
    timeout: 'ส่งออกไปแล้วแต่ไม่ได้รับคำตอบ (ปลายทางไม่มี/ไม่ตอบ, ทางกลับผิด หรือไฟร์วอลล์บล็อก ICMP)',
    ttl_expired: 'แพ็กเก็ตวนลูประหว่าง Router จนค่า TTL หมด (Routing loop)'
  };
  const REASONS = Object.keys(REASON_TEXT);

  // ------------------------------------------------------------------ normalisation
  function Problems() {
    const list = [];
    const keys = new Set();
    return {
      list,
      add(level, code, msg, dev, link) {
        const k = level + '|' + code + '|' + (dev || '') + '|' + (link || '') + '|' + msg;
        if (keys.has(k)) return; keys.add(k);
        const p = { level, code, msg };
        if (dev !== undefined && dev !== null) p.dev = dev;
        if (link !== undefined && link !== null) p.link = link;
        list.push(p);
      }
    };
  }

  function normalize(input, P) {
    let t = clone(input);
    if (!isObj(t)) t = {};
    let rawDevs = Array.isArray(t.devices) ? t.devices : [];
    let rawLinks = Array.isArray(t.links) ? t.links : [];
    if (rawDevs.length > MAX_DEVICES) { P.add('warn', 'too_big', `มีอุปกรณ์มากเกิน ${MAX_DEVICES} เครื่อง ระบบจำลองใช้เฉพาะ ${MAX_DEVICES} เครื่องแรก`); rawDevs = rawDevs.slice(0, MAX_DEVICES); }
    if (rawLinks.length > MAX_LINKS) { P.add('warn', 'too_big', `มีสายมากเกิน ${MAX_LINKS} เส้น ระบบจำลองใช้เฉพาะ ${MAX_LINKS} เส้นแรก`); rawLinks = rawLinks.slice(0, MAX_LINKS); }
    const out = Object.assign({}, t, { devices: [], links: [] });
    const ids = new Set();

    rawDevs.forEach((d, i) => {
      if (!isObj(d)) { P.add('error', 'bad_device', `ข้อมูลอุปกรณ์ลำดับที่ ${i + 1} ไม่ถูกต้อง (ข้ามไป)`); return; }
      let id = str(d.id);
      if (!id) { id = 'dev' + (i + 1); while (ids.has(id)) id += '_'; P.add('warn', 'bad_id', `อุปกรณ์ลำดับที่ ${i + 1} ไม่มี id ระบบตั้งให้เป็น "${id}"`, id); }
      if (ids.has(id)) {
        let n = 2; while (ids.has(id + '_' + n)) n++;
        const nid = id + '_' + n;
        P.add('error', 'dup_id', `id อุปกรณ์ "${id}" ซ้ำกัน ระบบเปลี่ยนตัวที่ซ้ำเป็น "${nid}"`, nid);
        id = nid;
      }
      ids.add(id);
      d.id = id;
      const tRaw = str(d.type).toLowerCase().replace(/\s+/g, '');
      let type = TYPE_ALIAS[tRaw];
      if (!type) { type = 'pc'; P.add('error', 'bad_type', `ไม่รู้จักชนิดอุปกรณ์ "${str(d.type)}" ของ ${id} (ถือเป็น PC)`, id); }
      d.type = type;
      d.name = str(d.name) || id;
      d.x = Number.isFinite(+d.x) && d.x !== null && d.x !== '' ? +d.x : 100 + (i % 6) * 150;
      d.y = Number.isFinite(+d.y) && d.y !== null && d.y !== '' ? +d.y : 100 + Math.floor(i / 6) * 140;
      d._idx = i;
      if (HOST[type]) {
        if (!Array.isArray(d.ifaces)) d.ifaces = [];
        d.ifaces = d.ifaces.filter(isObj);
        if (!d.ifaces.length && (d.ip !== undefined || d.prefix !== undefined || d.mask !== undefined)) {
          d.ifaces.push({ name: type === 'laptop' ? 'wlan0' : 'eth0', ip: d.ip, prefix: d.prefix !== undefined ? d.prefix : d.mask, mac: d.mac, up: d.up });
          delete d.ip; delete d.prefix; delete d.mask;
        }
        d.gateway = str(d.gateway !== undefined ? d.gateway : d.gw);
        if (d.gw !== undefined) delete d.gw;
        let dns = d.dns;
        if (typeof dns === 'string') dns = dns.split(/[\s,;]+/);
        d.dns = Array.isArray(dns) ? dns.map(str).filter(Boolean) : [];
        d.dhcp = d.dhcp === true || d.dhcp === 'true' || d.dhcp === 1;
        const fw = d.firewall;
        d.firewall = Object.assign({}, isObj(fw) ? fw : {}, { icmp: !(isObj(fw) && (fw.icmp === false || fw.icmp === 'false')) });
        d.services = isObj(d.services) ? d.services : {};
        const os = str(d.os).toLowerCase();
        d.os = /linux|ubuntu|debian|centos|unix|bsd|mac/.test(os) ? 'linux' : /win/.test(os) ? 'windows' : (type === 'printer' ? 'linux' : 'windows');
        if (d.ssid !== undefined) d.ssid = str(d.ssid);
      } else if (type === 'router' || type === 'internet') {
        if (!Array.isArray(d.ifaces)) d.ifaces = [];
        d.ifaces = d.ifaces.filter(isObj);
        if (type === 'router') {
          d.routes = Array.isArray(d.routes) ? d.routes.filter(isObj) : [];
          d.services = isObj(d.services) ? d.services : {};
        } else {
          const hosts = {};
          if (isObj(d.hosts)) Object.keys(d.hosts).forEach(k => { const ip = parseIp(k); if (ip !== null) hosts[ipStr(ip)] = str(d.hosts[k]).toLowerCase().replace(/\.$/, ''); });
          d.hosts = hosts;
        }
      } else {
        const def = type === 'ap' ? 1 : 24;
        const n = Math.floor(+d.ports);
        d.ports = Number.isFinite(n) && n >= 1 && n <= 96 ? n : def;
        if (type === 'ap') { d.ssid = str(d.ssid); d.security = str(d.security) || 'WPA2'; }
        delete d.ifaces;
      }
      if (d.ifaces) d.ifaces.forEach((f, j) => normIface(d, f, j, P));
      out.devices.push(d);
    });

    const byId = new Map(out.devices.map(d => [d.id, d]));
    const linkIds = new Set();
    // pass 1: basic shape
    const links = [];
    rawLinks.forEach((l, i) => {
      if (!isObj(l)) { P.add('error', 'bad_link', `ข้อมูลสายลำดับที่ ${i + 1} ไม่ถูกต้อง (ข้ามไป)`); return; }
      let id = str(l.id) || 'l' + (i + 1);
      while (linkIds.has(id)) id = id + '_' + (i + 1);
      linkIds.add(id); l.id = id;
      const end = e => {
        if (typeof e === 'string') { const k = e.indexOf(':'); return k > 0 ? { dev: e.slice(0, k).trim(), port: e.slice(k + 1).trim() } : { dev: e.trim(), port: '' }; }
        if (isObj(e)) return Object.assign({}, e, { dev: str(e.dev !== undefined ? e.dev : e.device), port: str(e.port) });
        return { dev: '', port: '' };
      };
      l.a = end(l.a); l.b = end(l.b);
      const m = MEDIUM_ALIAS[str(l.medium).toLowerCase()];
      if (!m && l.medium !== undefined && l.medium !== '') P.add('warn', 'bad_link', `ไม่รู้จักชนิดสาย "${str(l.medium)}" ของสาย ${id} (ถือเป็น UTP)`, null, id);
      l.medium = m || 'utp';
      l.up = !(l.up === false || l.up === 'false' || l.up === 0);
      l._bad = null;
      const da = byId.get(l.a.dev), db = byId.get(l.b.dev);
      if (!da || !db) {
        l._bad = 'bad_link';
        P.add('error', 'bad_link', `สาย ${id} อ้างถึงอุปกรณ์ที่ไม่มีอยู่ (${!da ? (l.a.dev || '?') : (l.b.dev || '?')})`, null, id);
      } else if (da === db) {
        l._bad = 'bad_link';
        P.add('error', 'bad_link', `สาย ${id} ต่อจาก ${da.name} เข้าหาตัวเอง`, da.id, id);
      }
      links.push(l);
      out.links.push(l);
    });
    // pass 2: explicit ports reserve, pass 3: auto ports
    const used = new Map(); // devId -> Map(port -> linkId)
    const use = (dev, port) => { if (!used.has(dev)) used.set(dev, new Map()); return used.get(dev); };
    const ensureIface = (d, name) => {
      let f = d.ifaces.find(x => x.name === name);
      if (!f) { f = { name }; d.ifaces.push(f); normIface(d, f, d.ifaces.length - 1, P); }
      return f;
    };
    const fixPort = (l, e, other, explicitPass) => {
      const d = byId.get(e.dev); if (!d) return;
      const u = use(d.id);
      const wifi = l.medium === 'wifi';
      if (explicitPass && !e.port) return;
      if (!explicitPass && e.port) return;
      if (HOST[d.type]) {
        if (e.port) {
          if (!d.ifaces.length) ensureIface(d, e.port);
          else if (!d.ifaces.some(f => f.name === e.port)) {
            const free = d.ifaces.find(f => !u.has(f.name)) || d.ifaces[0];
            P.add('warn', 'bad_port', `${d.name} ไม่มีพอร์ต "${e.port}" ระบบใช้ ${free.name} แทน`, d.id, l.id);
            e.port = free.name;
          }
        } else {
          if (!d.ifaces.length) ensureIface(d, wifi || d.type === 'laptop' ? 'wlan0' : 'eth0');
          const pref = d.ifaces.find(f => !u.has(f.name) && (wifi ? /^wl/.test(f.name) : !/^wl/.test(f.name)));
          e.port = (pref || d.ifaces.find(f => !u.has(f.name)) || d.ifaces[0]).name;
        }
      } else if (d.type === 'router' || d.type === 'internet') {
        if (e.port) ensureIface(d, e.port);
        else {
          let f = d.ifaces.find(x => !u.has(x.name));
          if (!f) {
            let n = d.ifaces.length; let name = d.type === 'router' ? 'g0/' + n : (n ? 'wan' + n : 'wan');
            while (d.ifaces.some(x => x.name === name)) { n++; name = d.type === 'router' ? 'g0/' + n : 'wan' + n; }
            f = ensureIface(d, name);
          }
          e.port = f.name;
        }
      } else { // switch / ap
        if (e.port) {
          const m = /^p(\d+)$/.exec(e.port);
          if (!(d.type === 'ap' && e.port === 'wifi') && !(m && +m[1] >= 1 && +m[1] <= d.ports)) {
            P.add('warn', 'bad_port', `${d.name} ไม่มีพอร์ต "${e.port}" (มี p1–p${d.ports}${d.type === 'ap' ? ' และ wifi' : ''})`, d.id, l.id);
          }
        } else if (d.type === 'ap' && wifi) e.port = 'wifi';
        else {
          let k = 1; while (u.has('p' + k)) k++;
          if (k > d.ports) P.add('warn', 'bad_port', `${d.name} พอร์ตเต็มแล้ว (${d.ports} พอร์ต)`, d.id, l.id);
          e.port = 'p' + k;
        }
      }
      if (!(d.type === 'ap' && e.port === 'wifi') && !l._bad) {
        if (u.has(e.port)) {
          l._bad = 'port_in_use';
          P.add('error', 'port_in_use', `พอร์ต ${e.port} ของ ${d.name} มีสายเสียบอยู่แล้ว (สาย ${u.get(e.port)}) — 1 พอร์ตต่อสายได้เส้นเดียว`, d.id, l.id);
        } else u.set(e.port, l.id);
      }
    };
    links.forEach(l => { if (l._bad !== 'bad_link') { fixPort(l, l.a, l.b, true); fixPort(l, l.b, l.a, true); } });
    links.forEach(l => { if (l._bad !== 'bad_link') { fixPort(l, l.a, l.b, false); fixPort(l, l.b, l.a, false); } });
    // hosts must have one interface
    out.devices.forEach(d => { if (HOST[d.type] && !d.ifaces.length) ensureIface(d, d.type === 'laptop' ? 'wlan0' : 'eth0'); });
    return out;
  }

  function normIface(d, f, j, P) {
    const isHost = !!HOST[d.type];
    f.name = str(f.name) || (isHost ? (d.type === 'laptop' ? 'wlan0' : 'eth' + j) : d.type === 'router' ? 'g0/' + j : (j ? 'wan' + j : 'wan'));
    f.ip = str(f.ip);
    const hasPrefix = !(f.prefix === undefined || f.prefix === null || f.prefix === '');
    const rawPrefix = hasPrefix ? f.prefix : f.mask !== undefined ? f.mask : f.netmask;
    let p = toPrefix(rawPrefix);
    const ipn = parseIp(f.ip);
    f._ip = null; f._prefix = null;
    const who = `${d.name} (${f.name})`;
    if (f.ip && ipn === null) P.add('error', 'bad_ip', `IP address ของ ${who} ไม่ถูกต้อง: "${f.ip}" (ต้องเป็นเลข 4 ชุด 0–255 คั่นด้วยจุด)`, d.id);
    if (rawPrefix !== undefined && rawPrefix !== null && rawPrefix !== '' && p === null) {
      P.add('error', 'bad_prefix', `Subnet mask/prefix ของ ${who} ไม่ถูกต้อง: "${String(rawPrefix)}"`, d.id);
    } else if (p === null && ipn !== null) {
      p = defaultPrefix(ipn);
      if (p !== null) P.add('warn', 'bad_prefix', `${who} ไม่ได้กำหนด Subnet mask ระบบใช้ค่าตาม Class คือ /${p}`, d.id);
      else P.add('error', 'bad_prefix', `${who} ไม่ได้กำหนด Subnet mask`, d.id);
    }
    if (p !== null) f.prefix = p;
    delete f.mask; delete f.netmask;
    if (ipn !== null) {
      const o = ipn >>> 24;
      if (o === 0 || o === 127 || o >= 224) { P.add('error', 'bad_ip', `IP ${f.ip} ของ ${who} ใช้กับเครื่องไม่ได้ (เป็นที่อยู่สงวน/loopback/multicast)`, d.id); }
      else if (p !== null) {
        if (p <= 30 && ipn === netInt(ipn, p)) P.add('error', 'ip_is_network', `IP ${f.ip}/${p} ของ ${who} เป็น Network address ใช้กำหนดให้เครื่องไม่ได้`, d.id);
        else if (p <= 30 && ipn === bcastInt(ipn, p)) P.add('error', 'ip_is_broadcast', `IP ${f.ip}/${p} ของ ${who} เป็น Broadcast address ใช้กำหนดให้เครื่องไม่ได้`, d.id);
        else { f._ip = ipn; f._prefix = p; }
      }
    }
    const mac = normMac(f.mac);
    if (f.mac !== undefined && f.mac !== '' && f.mac !== null && !mac) P.add('warn', 'bad_mac', `MAC address ของ ${who} ไม่ถูกต้อง ระบบสร้างให้ใหม่`, d.id);
    f.mac = mac || ['02', '4E', '4C', hex2(d._idx >> 8), hex2(d._idx), hex2(j + 1)].join('-');
    f.up = !(f.up === false || f.up === 'false' || f.up === 0);
  }

  // ------------------------------------------------------------------ engine
  function create(input) {
    let net;
    try { net = build(input); }
    catch (e) {
      net = build({});
      net._P.add('error', 'internal', 'ข้อมูลเครือข่ายเสียหาย ระบบจำลองอ่านไม่ได้: ' + (e && e.message));
    }
    return net;
  }

  function build(input) {
    const P = Problems();
    const topo = normalize(input, P);
    const devs = new Map();
    const devList = [];
    topo.devices.forEach(t => {
      const kind = HOST[t.type] ? 'host' : (t.type === 'switch' || t.type === 'ap') ? 'bridge' : t.type;
      const d = { id: t.id, t, type: t.type, kind, name: t.name, ifs: [], arp: new Map(), mac: new Map(), node: null,
        os: kind === 'host' ? t.os : 'ios', gw: null, dnsServers: [], hosted: new Map(), rt: [] };
      if (t.ifaces) t.ifaces.forEach((f, j) => {
        d.ifs.push({ dev: d, t: f, name: f.name, idx: j, mac: f.mac, up: f.up, ip: f._ip, prefix: f._prefix, link: null, linked: false,
          node: d.id + '|' + f.name, comp: null, eff: { ip: null, prefix: null, gw: null, dns: [], apipa: false, dhcp: false, leaseFrom: null } });
        delete f._ip; delete f._prefix;
      });
      if (kind === 'bridge') d.node = d.id;
      if (t.type === 'internet') Object.keys(t.hosts).forEach(k => d.hosted.set(parseIp(k), t.hosts[k]));
      delete t._idx;
      devs.set(d.id, d); devList.push(d);
    });
    const ifcOf = (d, port) => d.ifs.find(f => f.name === port) || null;

    // ---- link state
    const linkState = new Map();
    const edges = [];
    topo.links.forEach(l => {
      let reason = l._bad || null;
      delete l._bad;
      const da = devs.get(l.a.dev), db = devs.get(l.b.dev);
      let fa = null, fb = null;
      if (!reason) {
        fa = da.kind === 'bridge' ? null : ifcOf(da, l.a.port);
        fb = db.kind === 'bridge' ? null : ifcOf(db, l.b.port);
        const apWifiA = da.type === 'ap' && l.a.port === 'wifi', apWifiB = db.type === 'ap' && l.b.port === 'wifi';
        if (l.medium === 'wifi' || apWifiA || apWifiB) {
          const ok = l.medium === 'wifi' && ((da.kind === 'host' && apWifiB) || (db.kind === 'host' && apWifiA));
          if (!ok) {
            reason = 'wifi_wrong_end';
            P.add('error', 'wifi_wrong_end', l.medium === 'wifi'
              ? `สาย Wi-Fi ${l.id} (${da.name}–${db.name}) ใช้ได้เฉพาะระหว่างเครื่องลูกข่าย (wlan0) กับพอร์ต wifi ของ Access Point`
              : `สาย ${l.id} ต่อเข้าพอร์ต wifi ของ AP ได้เฉพาะการเชื่อมต่อแบบ Wi-Fi`, da.kind === 'host' ? da.id : db.id, l.id);
          } else {
            const host = da.kind === 'host' ? da : db, ap = da.kind === 'host' ? db : da;
            const hf = ifcOf(host, host === da ? l.a.port : l.b.port);
            const want = str(host.t.ssid !== undefined ? host.t.ssid : (hf && hf.t.ssid));
            if (want && want !== ap.t.ssid) {
              reason = 'ssid';
              P.add('error', 'ssid_mismatch', `${host.name} ตั้งค่า SSID "${want}" ไม่ตรงกับ ${ap.name} ("${ap.t.ssid}") จึงเชื่อมต่อ Wi-Fi ไม่ได้`, host.id, l.id);
            }
          }
        }
      }
      if (!reason && !l.up) reason = 'down';
      if (!reason && ((fa && !fa.up) || (fb && !fb.up))) reason = 'iface_down';
      const active = !reason;
      linkState.set(l.id, { active, reason: reason || 'ok' });
      if (fa && !fa.link && reason !== 'port_in_use') fa.link = l;
      if (fb && !fb.link && reason !== 'port_in_use') fb.link = l;
      if (active) {
        if (fa) fa.linked = true;
        if (fb) fb.linked = true;
        edges.push({ l, na: fa ? fa.node : da.node, nb: fb ? fb.node : db.node, pa: l.a.port, pb: l.b.port, da, db });
      }
      if (reason === 'down') {
        P.add('warn', 'no_link', `สาย ${l.id} ระหว่าง ${da.name} กับ ${db.name} ถูกถอดหรือขาด (link down)`, da.kind !== 'bridge' ? da.id : db.id, l.id);
      }
    });

    // ---- L2 graph with STP-like loop blocking (first links win)
    const nodeDev = new Map();
    devList.forEach(d => { if (d.node) nodeDev.set(d.node, d); d.ifs.forEach(f => nodeDev.set(f.node, d)); });
    const ifcByNode = new Map();
    devList.forEach(d => d.ifs.forEach(f => ifcByNode.set(f.node, f)));
    const uf = new Map();
    const find = x => { while (uf.has(x) && uf.get(x) !== x) { uf.set(x, uf.get(uf.get(x)) || uf.get(x)); x = uf.get(x); } return x; };
    const adj = new Map();
    const addAdj = (n, e) => { if (!adj.has(n)) adj.set(n, []); adj.get(n).push(e); };
    edges.forEach(e => {
      if (!uf.has(e.na)) uf.set(e.na, e.na);
      if (!uf.has(e.nb)) uf.set(e.nb, e.nb);
      const ra = find(e.na), rb = find(e.nb);
      if (ra === rb) {
        P.add('warn', 'loop', `พบการต่อสายเป็นวงวน (Switching loop) ที่สาย ${e.l.id} (${e.da.name}–${e.db.name}) — ของจริงจะเกิด Broadcast storm ถ้าไม่มี STP (ระบบจำลองถือว่า STP ปิดสายเส้นนี้ไว้)`, e.da.id, e.l.id);
        linkState.get(e.l.id).blocked = true;
        return;
      }
      uf.set(ra, rb);
      addAdj(e.na, { to: e.nb, port: e.pa });
      addAdj(e.nb, { to: e.na, port: e.pb });
    });
    // components
    let compN = 0;
    const compOf = new Map();
    const allNodes = [];
    devList.forEach(d => { if (d.node) allNodes.push(d.node); d.ifs.forEach(f => allNodes.push(f.node)); });
    allNodes.forEach(n => {
      if (compOf.has(n)) return;
      const c = ++compN; const q = [n]; compOf.set(n, c);
      while (q.length) { const x = q.pop(); (adj.get(x) || []).forEach(e => { if (!compOf.has(e.to)) { compOf.set(e.to, c); q.push(e.to); } }); }
    });
    devList.forEach(d => d.ifs.forEach(f => { f.comp = compOf.get(f.node); }));
    const bfsCache = new Map();
    function bfs(src) {
      let m = bfsCache.get(src); if (m) return m;
      m = new Map(); m.set(src, { prev: null, inPort: null });
      const q = [src];
      for (let i = 0; i < q.length; i++) {
        const x = q[i];
        (adj.get(x) || []).forEach(e => { if (!m.has(e.to)) { m.set(e.to, { prev: x, inPort: null }); q.push(e.to); } });
      }
      // inPort on node = port of that node on the edge towards prev
      m.forEach((v, node) => { if (v.prev !== null) { const e = (adj.get(node) || []).find(z => z.to === v.prev); v.inPort = e ? e.port : null; } });
      bfsCache.set(src, m);
      return m;
    }

    // ---- per-device static effective config
    const op = f => f.up && f.linked;
    devList.forEach(d => {
      d.ifs.forEach(f => { if (f.ip !== null && f.prefix !== null) { f.eff.ip = f.ip; f.eff.prefix = f.prefix; } });
      if (d.kind === 'host') {
        const t = d.t;
        const g = t.gateway ? parseIp(t.gateway) : null;
        if (t.gateway && g === null) P.add('error', 'bad_ip', `Default gateway ของ ${d.name} ไม่ถูกต้อง: "${t.gateway}"`, d.id);
        d.gw = g;
        d.dnsServers = [];
        t.dns.forEach(s => { const v = parseIp(s); if (v === null) P.add('warn', 'bad_ip', `DNS server ของ ${d.name} ไม่ถูกต้อง: "${s}"`, d.id); else d.dnsServers.push(v); });
      }
    });
    const primary = d => d.ifs.find(f => f.linked) || d.ifs.find(f => f.link) || d.ifs[0] || null;
    devList.forEach(d => { d.pri = d.kind === 'host' ? primary(d) : null; });
    devList.forEach(d => {
      if (d.kind !== 'host') return;
      const f = d.pri;
      if (!f) return;
      if (d.t.dhcp) { f.eff.ip = null; f.eff.prefix = null; f.eff.dhcp = true; return; }
      f.eff.gw = d.gw; f.eff.dns = d.dnsServers.slice();
    });

    // ---- DHCP
    const staticUsed = new Set();
    devList.forEach(d => d.ifs.forEach(f => { if (!(d.kind === 'host' && d.t.dhcp && f === d.pri) && f.ip !== null) staticUsed.add(f.ip); }));
    const pools = [];
    devList.slice().sort((a, b) => natCmp(a.id, b.id)).forEach(d => {
      const svc = d.t.services && d.t.services.dhcp;
      if (!svc || (d.kind !== 'host' && d.kind !== 'router') || svc.enabled === false) return;
      (Array.isArray(svc) ? svc : [svc]).forEach(pl => {
        if (!isObj(pl) || pl.enabled === false) return;
        const s = parseIp(pl.start), e = parseIp(pl.end);
        if (s === null || e === null || e < s) { P.add('warn', 'dhcp_pool_bad', `ช่วง IP ของ DHCP pool บน ${d.name} ไม่ถูกต้อง (start/end)`, d.id); return; }
        if (d.kind === 'host' && d.t.dhcp) { P.add('warn', 'dhcp_pool_bad', `${d.name} เป็น DHCP server แต่ตัวเองตั้งรับ IP แบบ DHCP — server ต้องใช้ IP แบบ Static`, d.id); return; }
        const f = d.ifs.find(x => op(x) && x.eff.ip !== null && inSub(s, x.eff.ip, x.eff.prefix));
        const anyF = d.ifs.find(x => x.eff.ip !== null && inSub(s, x.eff.ip, x.eff.prefix));
        if (!anyF) { P.add('warn', 'dhcp_pool_bad', `DHCP pool ${ipStr(s)}–${ipStr(e)} บน ${d.name} ไม่อยู่ในวงเครือข่ายของ interface ใดของอุปกรณ์นี้`, d.id); return; }
        if (!f) return; // server interface down/unplugged: pool not reachable by anyone
        const p = toPrefix(pl.prefix !== undefined ? pl.prefix : pl.mask);
        const gw = parseIp(pl.gateway !== undefined ? pl.gateway : pl.router);
        let dns = pl.dns; if (typeof dns === 'string') dns = dns.split(/[\s,;]+/);
        dns = (Array.isArray(dns) ? dns : []).map(parseIp).filter(x => x !== null);
        pools.push({ dev: d, comp: f.comp, start: s, end: e, prefix: p !== null ? p : f.eff.prefix, gw, dns, next: s, given: 0 });
      });
    });
    devList.filter(d => d.kind === 'host' && d.t.dhcp).sort((a, b) => natCmp(a.id, b.id)).forEach(d => {
      const f = d.pri; if (!f || !op(f)) return; // no link: no address at all (Windows: media disconnected)
      const cands = pools.filter(p => p.comp === f.comp);
      for (const p of cands) {
        let a = p.next;
        while (a <= p.end && (staticUsed.has(a) || a === netInt(a, p.prefix) || a === bcastInt(a, p.prefix))) a++;
        if (a <= p.end) {
          p.next = a + 1; staticUsed.add(a);
          Object.assign(f.eff, { ip: a, prefix: p.prefix, gw: p.gw, dns: p.dns.slice(), apipa: false, leaseFrom: p.dev.id });
          return;
        }
      }
      const b = f.mac.split('-').map(h => parseInt(h, 16));
      const apipa = ((169 << 24) | (254 << 16) | (((b[4] % 254) + 1) << 8) | b[5]) >>> 0;
      Object.assign(f.eff, { ip: apipa, prefix: 16, gw: null, dns: [], apipa: true, leaseFrom: null });
      P.add('warn', 'dhcp_none', cands.length
        ? `${d.name} ขอ IP จาก DHCP แต่ DHCP pool เต็ม จึงได้ IP แบบ APIPA ${ipStr(apipa)} (169.254.x.x)`
        : `${d.name} ตั้งค่า DHCP แต่ไม่พบ DHCP server ในวงเครือข่ายเดียวกัน จึงได้ IP แบบ APIPA ${ipStr(apipa)} (ใช้งานนอกวงไม่ได้)`, d.id);
    });

    // ---- validation of host settings / links / routers
    const hasRouter = devList.some(d => d.kind === 'router' || d.kind === 'internet');
    const hasDnsSvc = devList.some(d => d.t.services && d.t.services.dns) || devList.some(d => d.kind === 'internet');
    devList.forEach(d => {
      const hasAnyLink = d.kind === 'bridge'
        ? topo.links.some(l => l.a.dev === d.id || l.b.dev === d.id)
        : d.ifs.some(f => f.link);
      if (!hasAnyLink) P.add('warn', 'no_link', `${d.name} ยังไม่ได้ต่อสายเข้ากับอุปกรณ์ใด`, d.id);
      d.ifs.forEach(f => { if (!f.up && (d.kind === 'host' ? f === d.pri : f.link || f.ip !== null)) P.add('warn', 'iface_down', `Network adapter ${f.name} ของ ${d.name} ถูกปิดใช้งาน (disabled)`, d.id); });
      if (d.kind === 'host') {
        const f = d.pri;
        if (!d.t.dhcp) {
          if (!f.t.ip) P.add('warn', 'no_ip', `${d.name} ยังไม่ได้กำหนด IP address`, d.id);
          if (f.eff.ip !== null) {
            if (d.gw !== null) {
              if (d.gw === f.eff.ip) P.add('error', 'gw_self', `Default gateway ของ ${d.name} เป็น IP ของตัวเอง ต้องเป็น IP ของ Router`, d.id);
              else if (!inSub(d.gw, f.eff.ip, f.eff.prefix)) P.add('error', 'gw_not_in_subnet', `Default gateway ${ipStr(d.gw)} ของ ${d.name} ไม่อยู่ในวงเดียวกับ IP ${ipStr(f.eff.ip)}/${f.eff.prefix}`, d.id);
            } else if (!d.t.gateway && hasRouter) P.add('warn', 'gw_missing', `${d.name} ยังไม่ได้กำหนด Default gateway (ติดต่อนอกวงเครือข่ายไม่ได้)`, d.id);
            if (!d.dnsServers.length && hasDnsSvc && d.type !== 'printer') P.add('warn', 'dns_missing', `${d.name} ยังไม่ได้กำหนด DNS server (เรียกเว็บ/เครื่องด้วยชื่อไม่ได้)`, d.id);
          }
        } else if (f.eff.ip !== null && !f.eff.apipa && !f.eff.dns.length && hasDnsSvc && d.type !== 'printer') {
          P.add('warn', 'dns_missing', `${d.name} ได้ IP จาก DHCP แต่ DHCP ไม่ได้แจก DNS server`, d.id);
        }
      }
      if (d.kind === 'router') {
        const fs = d.ifs.filter(f => f.eff.ip !== null);
        for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
          const a = fs[i], b = fs[j], p = Math.min(a.eff.prefix, b.eff.prefix);
          if (inSub(a.eff.ip, b.eff.ip, p)) P.add('error', 'router_overlap', `${d.name}: interface ${a.name} (${ipStr(netInt(a.eff.ip, a.eff.prefix))}/${a.eff.prefix}) กับ ${b.name} (${ipStr(netInt(b.eff.ip, b.eff.prefix))}/${b.eff.prefix}) อยู่ในวงเครือข่ายซ้อนทับกัน`, d.id);
        }
        d.ifs.forEach(f => { if (f.link && !f.t.ip) P.add('warn', 'no_ip', `${d.name} interface ${f.name} มีสายต่ออยู่แต่ยังไม่ได้กำหนด IP address`, d.id); });
      }
    });
    // duplicate IPs (effective) and MACs
    const byIp = new Map();
    devList.forEach(d => d.ifs.forEach(f => { if (f.eff.ip !== null) { const k = f.eff.ip; if (!byIp.has(k)) byIp.set(k, new Set()); byIp.get(k).add(d); } }));
    byIp.forEach((set, ipn) => {
      if (set.size < 2) return;
      const arr = Array.from(set).sort((a, b) => natCmp(a.id, b.id));
      arr.forEach(d => P.add('warn', 'dup_ip', `IP ${ipStr(ipn)} ของ ${d.name} ซ้ำกับ ${arr.filter(x => x !== d).map(x => x.name).join(', ')} (IP ชนกัน ทำให้ติดต่อผิดเครื่องหรือใช้งานไม่ได้)`, d.id));
    });
    const byMac = new Map();
    devList.forEach(d => d.ifs.forEach(f => { if (!byMac.has(f.mac)) byMac.set(f.mac, []); byMac.get(f.mac).push(d); }));
    byMac.forEach((arr, mac) => { if (arr.length > 1 && new Set(arr).size > 1) arr.forEach(d => P.add('warn', 'dup_mac', `MAC address ${mac} ของ ${d.name} ซ้ำกับอุปกรณ์อื่น`, d.id)); });

    // ---- ARP index: comp|ip -> [ifc] (lowest device id first)
    const arpIdx = new Map();
    devList.forEach(d => d.ifs.forEach(f => {
      if (!op(f) || f.eff.ip === null) return;
      const k = f.comp + '|' + f.eff.ip;
      if (!arpIdx.has(k)) arpIdx.set(k, []);
      arpIdx.get(k).push(f);
    }));
    arpIdx.forEach(a => a.sort((x, y) => natCmp(x.dev.id, y.dev.id) || x.idx - y.idx));

    // ---- router tables
    devList.forEach(d => {
      if (d.kind !== 'router') return;
      const rt = [];
      d.ifs.forEach(f => { if (op(f) && f.eff.ip !== null) rt.push({ net: netInt(f.eff.ip, f.eff.prefix), prefix: f.eff.prefix, via: null, ifc: f, type: 'C', ord: 0 }); });
      const conn = rt.slice();
      d.t.routes.forEach((r, i) => {
        const n = parseIp(r.net !== undefined ? r.net : r.network), p = toPrefix(r.prefix !== undefined ? r.prefix : r.mask);
        const via = r.via !== undefined && r.via !== null && r.via !== '' ? parseIp(r.via) : null;
        const ifName = str(r.iface);
        if (n === null || p === null || (r.via && via === null) || (via === null && !ifName)) {
          P.add('warn', 'route_bad', `Static route ลำดับที่ ${i + 1} ของ ${d.name} ไม่ถูกต้อง (ต้องมี network, prefix และ next hop)`, d.id); return;
        }
        if (netInt(n, p) !== n) P.add('warn', 'route_bad', `Static route ${ipStr(n)}/${p} ของ ${d.name} ไม่ใช่ network address (ใช้ ${ipStr(netInt(n, p))}/${p})`, d.id);
        let egress = null;
        if (via !== null) {
          if (d.ifs.some(f => f.eff.ip === via)) { P.add('warn', 'route_bad', `Next hop ${ipStr(via)} ของ static route บน ${d.name} เป็น IP ของตัวเอง`, d.id); return; }
          const c = conn.filter(x => inSub(via, x.net, x.prefix)).sort((a, b) => b.prefix - a.prefix)[0];
          if (!c) {
            if (!d.ifs.some(f => f.eff.ip !== null && inSub(via, f.eff.ip, f.eff.prefix)))
              P.add('warn', 'route_bad', `Next hop ${ipStr(via)} ของ static route ${ipStr(netInt(n, p))}/${p} บน ${d.name} ไม่อยู่ในวงเครือข่ายใดที่ต่อตรงกับ Router`, d.id);
            return;
          }
          egress = c.ifc;
        } else {
          const f = d.ifs.find(x => x.name === ifName);
          if (!f) { P.add('warn', 'route_bad', `Static route บน ${d.name} อ้างถึง interface "${ifName}" ที่ไม่มีอยู่`, d.id); return; }
          if (!op(f)) return;
          egress = f;
        }
        rt.push({ net: netInt(n, p), prefix: p, via, ifc: egress, type: n === 0 && p === 0 ? 'S*' : 'S', ord: 1 + i });
      });
      rt.sort((a, b) => b.prefix - a.prefix || a.ord - b.ord);
      d.rt = rt;
    });

    // ================================================================ packet engine
    function learnAll(fromIfc) {
      const m = bfs(fromIfc.node);
      m.forEach((v, node) => { const b = nodeDev.get(node); if (b && b.kind === 'bridge' && v.inPort) b.mac.set(fromIfc.mac, v.inPort); });
    }
    function walk(fromIfc, toIfc, path) {
      const m = bfs(fromIfc.node);
      const seq = [];
      let x = toIfc.node;
      while (x !== null && x !== undefined && x !== fromIfc.node) { seq.push(x); const v = m.get(x); x = v ? v.prev : null; }
      seq.reverse();
      seq.forEach(node => {
        const b = nodeDev.get(node);
        if (b && b.kind === 'bridge') { b.mac.set(fromIfc.mac, m.get(node).inPort); path.push(b.id); }
      });
      path.push(toIfc.dev.id);
    }
    function arpResolve(fromIfc, ipn) {
      const d = fromIfc.dev;
      const list = arpIdx.get(fromIfc.comp + '|' + ipn) || [];
      const tgt = list.find(x => x !== fromIfc) || null;
      const key = ipStr(ipn);
      if (tgt && d.arp.get(key) === tgt.mac) return tgt;
      learnAll(fromIfc); // ARP request is a broadcast
      if (!tgt) return null;
      d.arp.set(key, tgt.mac);
      if (fromIfc.eff.ip !== null) tgt.dev.arp.set(ipStr(fromIfc.eff.ip), fromIfc.mac);
      const tmp = []; walk(tgt, fromIfc, tmp); // unicast ARP reply teaches switches the target's MAC
      return tgt;
    }
    function lookup(d, dst) {
      for (const r of d.rt) if (inSub(dst, r.net, r.prefix)) return { egress: r.ifc, nh: r.via === null ? dst : r.via };
      return null;
    }
    function hostIfc(d) { const f = d.pri; return f && op(f) && f.eff.ip !== null ? f : null; }
    function owns(d, dst) {
      if (d.kind === 'host') { const f = hostIfc(d); return !!f && f.eff.ip === dst; }
      return d.ifs.some(f => op(f) && f.eff.ip === dst);
    }
    function originStep(d, dst, prevIfc) {
      if (d.kind === 'host') {
        const f = hostIfc(d); if (!f) return { fail: 'no_ip' };
        if (inSub(dst, f.eff.ip, f.eff.prefix)) return { egress: f, nh: dst };
        const gw = f.eff.gw;
        if (gw === null || !inSub(gw, f.eff.ip, f.eff.prefix) || gw === f.eff.ip) return { fail: 'no_gateway' };
        return { egress: f, nh: gw };
      }
      if (d.kind === 'router') { const r = lookup(d, dst); return r || { fail: 'no_route' }; }
      if (d.kind === 'internet') {
        const f = d.ifs.find(x => op(x) && x.eff.ip !== null && inSub(dst, x.eff.ip, x.eff.prefix));
        if (f) return { egress: f, nh: dst };
        if (prevIfc && prevIfc.eff.ip !== null) {
          const g = d.ifs.find(x => op(x) && x.comp === prevIfc.comp);
          if (g) return { egress: g, nh: prevIfc.eff.ip };
        }
        return { fail: 'no_route' };
      }
      return { fail: 'no_ip' };
    }
    function forward(origin, dst, ttl, prevIfc0) {
      const path = [origin.id];
      if (owns(origin, dst)) return { kind: 'delivered', dev: origin, path, routers: 0, ttl, prevIfc: null, firstEgress: null, local: true };
      let step = originStep(origin, dst, prevIfc0);
      if (step.fail) return { kind: step.fail, dev: origin, path, routers: 0, atOrigin: true };
      const firstEgress = step.egress;
      let cur = origin, routers = 0;
      for (let guard = 0; guard < 400; guard++) {
        const tgt = arpResolve(step.egress, step.nh);
        if (!tgt) return { kind: 'arp_fail', dev: cur, atOrigin: cur === origin, onlink: step.nh === dst, nh: step.nh, path, routers, firstEgress };
        walk(step.egress, tgt, path);
        const d = tgt.dev;
        const base = { dev: d, inIfc: tgt, prevIfc: step.egress, path, routers, firstEgress, ttl };
        if (d.kind === 'host') return owns(d, dst) ? Object.assign(base, { kind: 'delivered' }) : Object.assign(base, { kind: 'drop', detail: 'not_router' });
        if (d.kind === 'bridge') return Object.assign(base, { kind: 'drop', detail: 'bridge' });
        if (owns(d, dst)) return Object.assign(base, { kind: 'delivered' });
        if (d.kind === 'internet') {
          if (d.hosted.has(dst)) {
            if (ttl <= 1) return Object.assign(base, { kind: 'ttl', from: tgt.eff.ip });
            return Object.assign(base, { kind: 'delivered', virtual: true, ttl: ttl - 1, routers: routers + 1 });
          }
          return Object.assign(base, { kind: 'drop', detail: 'internet_unknown' });
        }
        if (ttl <= 1) return Object.assign(base, { kind: 'ttl', from: tgt.eff.ip });
        ttl--; routers++;
        const r = lookup(d, dst);
        if (!r) return Object.assign(base, { kind: 'no_route', from: tgt.eff.ip, routers });
        step = r; cur = d;
      }
      return { kind: 'drop', detail: 'loop_guard', dev: cur, path, routers };
    }
    function initTTL(d, virtual) { if (virtual) return INTERNET_HOST_TTL; if (d.kind === 'host') return d.os === 'linux' ? 64 : 128; return 255; }
    function srcIpOf(d, fwd) { if (d.kind === 'host') { const f = hostIfc(d); return f ? f.eff.ip : null; } return fwd && fwd.firstEgress ? fwd.firstEgress.eff.ip : null; }
    // one probe: forward + reply. proto 'icmp' (echo, honours host firewall) or 'udp'
    function probe(src, dst, ttl, proto) {
      const fwd = forward(src, dst, ttl, null);
      const sip = srcIpOf(src, fwd);
      const res = { fwd, path: fwd.path };
      if (fwd.kind === 'no_gateway' || fwd.kind === 'no_ip') return Object.assign(res, { status: fwd.kind });
      if (fwd.kind === 'arp_fail' && fwd.atOrigin) return Object.assign(res, { status: 'arp_fail', onlink: fwd.onlink, nh: fwd.nh });
      if (fwd.kind === 'no_route' && fwd.atOrigin) return Object.assign(res, { status: 'no_route', from: null, delivered: false, root: 'no_route', detail: 'origin_no_route' });
      if (fwd.kind === 'delivered') {
        const r = fwd.dev;
        if (proto === 'icmp' && r.kind === 'host' && r.t.firewall.icmp === false) return Object.assign(res, { status: 'timeout', detail: 'firewall', failAt: r.id });
        const back = forward(r, sip, initTTL(r, fwd.virtual), fwd.prevIfc);
        if (back.kind === 'delivered' && back.dev === src) {
          return Object.assign(res, { status: 'ok', responder: r, virtual: !!fwd.virtual, ttl: back.ttl, routers: fwd.routers, backRouters: back.routers });
        }
        return Object.assign(res, { status: 'timeout', detail: 'reply_failed', failAt: back.dev ? back.dev.id : r.id, back });
      }
      if (fwd.kind === 'ttl' || fwd.kind === 'no_route') {
        const R = fwd.dev;
        const err = forward(R, sip, 255, fwd.prevIfc);
        const delivered = err.kind === 'delivered' && err.dev === src;
        return Object.assign(res, { status: delivered ? fwd.kind : 'timeout', root: fwd.kind, from: fwd.from, fromDev: R, routers: fwd.routers, failAt: R.id, detail: delivered ? null : 'icmp_error_lost', errTtl: err.ttl });
      }
      return Object.assign(res, { status: 'timeout', detail: fwd.detail || (fwd.kind === 'arp_fail' ? 'remote_arp_fail' : fwd.kind), failAt: fwd.dev ? fwd.dev.id : null });
    }

    // ---- DNS
    function dnsName(d, ipn) {
      if (d && d.kind === 'internet') return d.hosted.get(ipn) || null;
      const rec = d && d.t.services && d.t.services.dns && d.t.services.dns.records;
      if (isObj(rec)) {
        const names = Object.keys(rec).filter(k => parseIp(rec[k]) === ipn).map(k => k.toLowerCase()).sort(natCmp);
        return names.find(n => /^(dns|ns)\d*\./.test(n)) || names[0] || null;
      }
      return null;
    }
    function publicLookup(name) {
      for (const d of devList) if (d.kind === 'internet') for (const [ip, n] of d.hosted) if (n === name) return ip;
      return null;
    }
    function publicReverse(ipn) {
      for (const d of devList) if (d.kind === 'internet' && d.hosted.has(ipn)) return d.hosted.get(ipn);
      return null;
    }
    function canReachPublicDns(d) {
      const target = parseIp('8.8.8.8');
      if (!devList.some(x => x.kind === 'internet' && x.hosted.has(target))) return false;
      return probe(d, target, 255, 'udp').status === 'ok';
    }
    // returns { status:'answer'|'nx'|'servfail'|'timeout', ip, authoritative, serverName }
    function dnsQuery(src, server, name, reverse) {
      const pr = probe(src, server, initTTL(src), 'udp');
      if (pr.status !== 'ok') return { status: 'timeout', serverName: null };
      const r = pr.responder;
      const local = r.kind !== 'internet' && r.t.services && isObj(r.t.services.dns) && r.t.services.dns.enabled !== false;
      const pub = r.kind === 'internet' && PUBLIC_DNS.has(server) && pr.virtual;
      if (!local && !pub) return { status: 'timeout', serverName: null };
      const serverName = local ? dnsName(r, server) : publicReverse(server);
      if (reverse !== undefined) {
        let n = local ? dnsName(r, reverse) : null;
        if (!n && (pub || canReachPublicDns(r))) n = publicReverse(reverse);
        return n ? { status: 'answer', name: n, authoritative: local && !!dnsName(r, reverse), serverName } : { status: 'nx', serverName };
      }
      if (local) {
        const rec = isObj(r.t.services.dns.records) ? r.t.services.dns.records : {};
        const key = Object.keys(rec).find(k => k.toLowerCase().replace(/\.$/, '') === name);
        if (key !== undefined) {
          const v = parseIp(rec[key]);
          return v !== null ? { status: 'answer', ip: v, authoritative: true, serverName } : { status: 'servfail', serverName };
        }
        if (!canReachPublicDns(r)) return { status: 'servfail', serverName };
      }
      const v = publicLookup(name);
      return v !== null ? { status: 'answer', ip: v, authoritative: false, serverName } : { status: 'nx', serverName };
    }
    function validName(n) { return /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?)*$/.test(n) && n.length <= 253; }
    function resolveName(d, name) {
      name = String(name).trim().toLowerCase().replace(/\.$/, '');
      if (name === 'localhost') return { ok: true, ip: parseIp('127.0.0.1') };
      if (!name || !validName(name) || /^[\d.]+$/.test(name)) return { ok: false, reason: 'bad_target' };
      if (name === String(d.name).toLowerCase() || name === d.id.toLowerCase()) {
        const f = d.kind === 'host' ? hostIfc(d) : d.ifs.find(x => op(x) && x.eff.ip !== null);
        if (f) return { ok: true, ip: f.eff.ip };
      }
      const servers = d.kind === 'host' && d.pri ? d.pri.eff.dns : [];
      if (!servers.length) return { ok: false, reason: 'dns_fail' };
      for (const s of servers) {
        const q = dnsQuery(d, s, name);
        if (q.status === 'answer') return { ok: true, ip: q.ip, server: s };
        if (q.status === 'nx') return { ok: false, reason: 'bad_target', server: s };
      }
      return { ok: false, reason: 'dns_fail' };
    }

    // ---- preparation shared by ping/traceroute
    function prepare(srcId, target) {
      const d = devs.get(str(srcId));
      const tstr = str(target);
      const out = { d, tstr, name: null, dst: null };
      if (!d || d.kind === 'bridge') return Object.assign(out, { fail: 'no_ip', detail: 'bad_source' });
      let ipn = parseIp(tstr);
      const lower = tstr.toLowerCase();
      if (ipn !== null && (ipn >>> 24) === 127) return Object.assign(out, { dst: ipn, loopback: true });
      if (ipn === null && lower === 'localhost') return Object.assign(out, { dst: parseIp('127.0.0.1'), name: 'localhost', loopback: true });
      let f;
      if (d.kind === 'host') {
        f = d.pri;
        if (!f) return Object.assign(out, { fail: 'no_ip' });
        if (!f.up) return Object.assign(out, { fail: 'iface_down' });
        if (!f.linked) return Object.assign(out, { fail: 'no_link' });
        if (f.eff.ip === null) return Object.assign(out, { fail: 'no_ip' });
      } else {
        const opf = d.ifs.filter(x => op(x));
        if (!opf.length) return Object.assign(out, { fail: d.ifs.some(x => x.up) || !d.ifs.length ? 'no_link' : 'iface_down' });
        if (!opf.some(x => x.eff.ip !== null)) return Object.assign(out, { fail: 'no_ip' });
      }
      if (ipn === null) {
        if (!tstr) return Object.assign(out, { fail: 'bad_target' });
        const r = resolveName(d, tstr);
        if (!r.ok) return Object.assign(out, { fail: r.reason });
        ipn = r.ip; out.name = tstr;
        if ((ipn >>> 24) === 127) return Object.assign(out, { dst: ipn, loopback: true });
      }
      out.dst = ipn;
      if (owns(d, ipn)) out.self = true;
      return out;
    }

    // RTT model: deterministic jitter + 1 ms per router hop + ~20 ms when crossing the internet
    const JIT = [0.412, 0.538, 0.371, 0.466, 0.395, 0.502, 0.443, 0.389, 0.517, 0.428];
    function rtt(seq, dst, routers, virtual) {
      const j = JIT[(seq + (dst % 7)) % JIT.length];
      return Math.round((j + routers * 1.0 + (virtual ? 19.6 : 0) + (virtual ? j * 2 : 0)) * 1000) / 1000;
    }
    function fmtLinuxMs(v) { return v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3); }
    function linuxTime(n, h, extra) { return n <= 1 ? (extra || 0) : (n - 1) * 1000 + (h % 9) + 2 + (extra || 0); }

    // ================================================================ public: ping
    function ping(srcId, target, opts) {
      opts = isObj(opts) ? opts : {};
      let count = Math.floor(+opts.count); if (!Number.isFinite(count) || count < 1) count = 4; if (count > 100) count = 100;
      const pr = prepare(srcId, target);
      const tstr = pr.tstr;
      const res = { ok: false, target: tstr, resolved: pr.dst !== null ? ipStr(pr.dst) : null, reason: 'timeout', replies: 0,
        path: pr.d ? [pr.d.id] : [], win: [], linux: [], from: null, failAt: null, detail: null, ttl: null, rtts: [] };
      const d = pr.d;
      const hsh = hashStr(tstr);
      const ipS = res.resolved;
      const winHead = pr.name ? `Pinging ${pr.name} [${ipS}] with 32 bytes of data:` : `Pinging ${ipS || tstr} with 32 bytes of data:`;
      const linHead = `PING ${pr.name || ipS || tstr} (${ipS || tstr}) 56(84) bytes of data.`;
      const linName = pr.name ? `${pr.name} (${ipS})` : ipS;
      const winStats = (rcv, rtts) => {
        const lost = count - rcv;
        const L = ['', `Ping statistics for ${ipS || tstr}:`, `    Packets: Sent = ${count}, Received = ${rcv}, Lost = ${lost} (${Math.floor(lost * 100 / count)}% loss),`];
        if (rtts && rtts.length) {
          const ms = rtts.map(Math.floor);
          L.push('Approximate round trip times in milli-seconds:', `    Minimum = ${Math.min.apply(null, ms)}ms, Maximum = ${Math.max.apply(null, ms)}ms, Average = ${Math.floor(ms.reduce((a, b) => a + b, 0) / ms.length)}ms`);
        }
        return L;
      };
      const linStats = (kind, rtts, errs) => {
        const L = ['', `--- ${pr.name || ipS} ping statistics ---`];
        if (kind === 'ok') {
          const tot = linuxTime(count, hsh);
          L.push(`${count} packets transmitted, ${count} received, 0% packet loss, time ${tot}ms`);
          const mn = Math.min.apply(null, rtts), mx = Math.max.apply(null, rtts), av = rtts.reduce((a, b) => a + b, 0) / rtts.length;
          const md = Math.sqrt(rtts.reduce((a, b) => a + (b - av) * (b - av), 0) / rtts.length);
          L.push(`rtt min/avg/max/mdev = ${mn.toFixed(3)}/${av.toFixed(3)}/${mx.toFixed(3)}/${md.toFixed(3)} ms`);
        } else if (errs) L.push(`${count} packets transmitted, 0 received, +${count} errors, 100% packet loss, time ${linuxTime(count, hsh, 40)}ms`);
        else L.push(`${count} packets transmitted, 0 received, 100% packet loss, time ${linuxTime(count, hsh, 60)}ms`);
        return L;
      };
      const general = () => {
        res.win = [winHead]; for (let i = 0; i < count; i++) res.win.push('PING: transmit failed. General failure.');
        res.win = res.win.concat(winStats(0));
        res.linux = ['ping: connect: Network is unreachable'];
      };
      try {
        if (pr.fail) {
          res.reason = pr.fail; res.detail = pr.detail || null; res.failAt = d ? d.id : null;
          if (pr.fail === 'bad_target' || pr.fail === 'dns_fail') {
            res.win = [`Ping request could not find host ${tstr}. Please check the name and try again.`];
            res.linux = [pr.fail === 'dns_fail' ? `ping: ${tstr}: Temporary failure in name resolution` : `ping: ${tstr}: Name or service not known`];
          } else general();
          return finish(res);
        }
        if (pr.loopback || pr.self) {
          const ttl = initTTL(d);
          res.ok = true; res.reason = 'ok'; res.replies = count; res.ttl = ttl;
          for (let i = 0; i < count; i++) res.rtts.push(Math.round((0.031 + ((i + hsh) % 4) * 0.007) * 1000) / 1000);
          res.win = [winHead].concat(res.rtts.map(() => `Reply from ${ipS}: bytes=32 time<1ms TTL=${ttl}`), winStats(count, res.rtts));
          res.linux = [linHead].concat(res.rtts.map((v, i) => `64 bytes from ${linName}: icmp_seq=${i + 1} ttl=${ttl === 128 ? 128 : 64} time=${fmtLinuxMs(v)} ms`), linStats('ok', res.rtts));
          return finish(res);
        }
        const p = probe(d, pr.dst, initTTL(d), 'icmp');
        res.path = p.path.slice(0, 400);
        res.failAt = p.failAt || null; res.detail = p.detail || null;
        const ownIp = ipStr(srcIpOf(d, p.fwd)) || '0.0.0.0';
        if (p.status === 'ok') {
          res.ok = true; res.reason = 'ok'; res.replies = count; res.ttl = p.ttl;
          for (let i = 0; i < count; i++) res.rtts.push(rtt(i, pr.dst, p.routers, p.virtual));
          res.win = [winHead].concat(res.rtts.map(v => `Reply from ${ipS}: bytes=32 ${v < 1 ? 'time<1ms' : 'time=' + Math.floor(v) + 'ms'} TTL=${p.ttl}`), winStats(count, res.rtts));
          res.linux = [linHead].concat(res.rtts.map((v, i) => `64 bytes from ${linName}: icmp_seq=${i + 1} ttl=${p.ttl} time=${fmtLinuxMs(v)} ms`), linStats('ok', res.rtts));
          return finish(res);
        }
        if (p.status === 'no_gateway' || p.status === 'no_ip') { res.reason = p.status; res.failAt = d.id; general(); return finish(res); }
        if (p.status === 'arp_fail') {
          res.reason = p.onlink ? 'same_subnet_unreachable' : 'gateway_unreachable'; res.from = ownIp; res.failAt = d.id;
          res.win = [winHead]; for (let i = 0; i < count; i++) res.win.push(`Reply from ${ownIp}: Destination host unreachable.`);
          res.win = res.win.concat(winStats(count));
          res.linux = [linHead]; for (let i = 0; i < count; i++) res.linux.push(`From ${ownIp} icmp_seq=${i + 1} Destination Host Unreachable`);
          res.linux = res.linux.concat(linStats('err', null, true));
          return finish(res);
        }
        if (p.status === 'no_route' || p.status === 'ttl') {
          res.reason = p.status === 'ttl' ? 'ttl_expired' : 'no_route';
          if (p.detail === 'origin_no_route') { general(); return finish(res); }
          const from = ipStr(p.from); res.from = from;
          const wmsg = p.status === 'ttl' ? 'TTL expired in transit.' : 'Destination net unreachable.';
          const lmsg = p.status === 'ttl' ? 'Time to live exceeded' : 'Destination Net Unreachable';
          res.win = [winHead]; for (let i = 0; i < count; i++) res.win.push(`Reply from ${from}: ${wmsg}`);
          res.win = res.win.concat(winStats(count));
          res.linux = [linHead]; for (let i = 0; i < count; i++) res.linux.push(`From ${from} icmp_seq=${i + 1} ${lmsg}`);
          res.linux = res.linux.concat(linStats('err', null, true));
          return finish(res);
        }
        // timeout (incl. lost ICMP errors: keep the root cause as reason)
        res.reason = p.root === 'ttl' ? 'ttl_expired' : (p.root || 'timeout');
        res.win = [winHead]; for (let i = 0; i < count; i++) res.win.push('Request timed out.');
        res.win = res.win.concat(winStats(0));
        res.linux = [linHead].concat(linStats('timeout'));
        return finish(res);
      } catch (e) {
        res.reason = 'timeout'; res.detail = 'internal: ' + (e && e.message);
        return finish(res);
      }
    }
    function finish(res) { res.reasonText = REASON_TEXT[res.reason] || ''; return res; }

    // ================================================================ public: traceroute
    function traceroute(srcId, target, opts) {
      opts = isObj(opts) ? opts : {};
      let maxHops = Math.floor(+opts.maxHops); if (!Number.isFinite(maxHops) || maxHops < 1 || maxHops > 30) maxHops = 30;
      const pr = prepare(srcId, target);
      const tstr = pr.tstr, ipS = pr.dst !== null ? ipStr(pr.dst) : null;
      const res = { ok: false, target: tstr, resolved: ipS, reason: 'timeout', hops: [], win: [], linux: [] };
      const d = pr.d;
      const headW = pr.name ? `Tracing route to ${pr.name} [${ipS}]` : `Tracing route to ${ipS || tstr}`;
      const headL = `traceroute to ${pr.name || ipS || tstr} (${ipS || tstr}), ${maxHops} hops max, 60 byte packets`;
      const wf = v => v === null ? '     *  ' : (v < 1 ? '    <1' : ('      ' + Math.floor(v)).slice(-6)) + ' ms';
      const winHop = (n, h) => {
        const num = ('   ' + n).slice(-3);
        if (h.timeout) return `${num}     *        *        *     Request timed out.`;
        const host = h.unreachable ? `${h.ip}  reports: Destination ${h.unreachable === 'net' ? 'net' : 'host'} unreachable.` : h.ip;
        return `${num}${h.rtts.map(wf).join('')}  ${host}`;
      };
      const linHop = (n, h) => {
        const num = ('  ' + n).slice(-2);
        if (h.timeout) return `${num}  * * *`;
        const flag = h.unreachable === 'net' ? ' !N' : h.unreachable === 'host' ? ' !H' : '';
        return `${num}  ${h.ip} (${h.ip})  ${h.rtts.map(v => fmtLinuxMs(v) + ' ms' + flag).join('  ')}`;
      };
      try {
        if (pr.fail) {
          res.reason = pr.fail;
          if (pr.fail === 'bad_target' || pr.fail === 'dns_fail') {
            res.win = [`Unable to resolve target system name ${tstr}.`];
            res.linux = [`${tstr}: ${pr.fail === 'dns_fail' ? 'Temporary failure in name resolution' : 'Name or service not known'}`, `Cannot handle "host" cmdline arg \`${tstr}' on position 1 (argc 1)`];
          } else {
            res.win = [headW + ` over a maximum of ${maxHops} hops`, '', '  1  Transmit error: code 1231.'];
            res.linux = [headL, 'connect: Network is unreachable'];
          }
          return finish(res);
        }
        const hops = [];
        if (pr.loopback || pr.self) {
          hops.push({ ip: ipS, devId: d.id, rttMs: 0.04, rtts: [0.041, 0.035, 0.033] });
          res.ok = true; res.reason = 'ok';
        } else {
          let consecutive = 0;
          for (let ttl = 1; ttl <= maxHops; ttl++) {
            const p = probe(d, pr.dst, ttl, 'icmp');
            const own = ipStr(srcIpOf(d, p.fwd));
            if (p.status === 'no_gateway' || p.status === 'no_ip' || (p.status === 'no_route' && p.detail === 'origin_no_route')) {
              res.reason = p.status === 'no_ip' ? 'no_ip' : p.status === 'no_route' ? 'no_route' : 'no_gateway';
              res.win = [headW + ` over a maximum of ${maxHops} hops`, '', '  1  Transmit error: code 1231.'];
              res.linux = [headL, 'connect: Network is unreachable'];
              res.hops = hops;
              return finish(res);
            }
            if (p.status === 'ok') {
              const base = rtt(0, pr.dst, p.routers, p.virtual);
              hops.push({ ip: ipS, devId: p.responder.id, rttMs: base, rtts: [base, rtt(1, pr.dst, p.routers, p.virtual), rtt(2, pr.dst, p.routers, p.virtual)] });
              res.ok = true; res.reason = 'ok'; break;
            }
            if (p.status === 'ttl') {
              const base = rtt(ttl, p.from, p.routers, false);
              hops.push({ ip: ipStr(p.from), devId: p.fromDev.id, rttMs: base, rtts: [base, rtt(ttl + 1, p.from, p.routers, false), rtt(ttl + 2, p.from, p.routers, false)] });
              consecutive = 0; continue;
            }
            if (p.status === 'arp_fail') {
              res.reason = p.onlink ? 'same_subnet_unreachable' : 'gateway_unreachable';
              hops.push({ ip: own, devId: d.id, rttMs: 3006.2, rtts: [3006.2, 3005.9, 3006.1], unreachable: 'host' });
              break;
            }
            if (p.status === 'no_route') {
              res.reason = 'no_route';
              const base = rtt(ttl, p.from, p.routers, false);
              hops.push({ ip: ipStr(p.from), devId: p.fromDev.id, rttMs: base, rtts: [base, rtt(ttl + 1, p.from, p.routers, false), rtt(ttl + 2, p.from, p.routers, false)], unreachable: 'net' });
              break;
            }
            hops.push({ timeout: true });
            res.reason = p.root === 'ttl' ? 'ttl_expired' : (p.root || 'timeout');
            if (++consecutive >= 4) break;
          }
          if (!res.ok && hops.length && !hops.some(h => h.timeout) && res.reason === 'timeout') res.reason = 'ttl_expired';
          if (!res.ok && hops.length >= maxHops && hops.every(h => !h.timeout && !h.unreachable)) res.reason = 'ttl_expired';
        }
        res.hops = hops;
        res.win = [headW + ` over a maximum of ${maxHops} hops`, ''].concat(hops.map((h, i) => winHop(i + 1, h)));
        if (res.ok) res.win.push('', 'Trace complete.');
        res.linux = [headL].concat(hops.map((h, i) => linHop(i + 1, h)));
        return finish(res);
      } catch (e) {
        res.reason = 'timeout'; res.detail = 'internal: ' + (e && e.message);
        return finish(res);
      }
    }

    // ================================================================ public: nslookup
    function nslookup(srcId, name, serverArg) {
      const d = devs.get(str(srcId));
      const q = str(name).toLowerCase().replace(/\.$/, '');
      const res = { ok: false, ip: null, server: null, serverName: null, authoritative: false, reason: 'dns_fail', lines: [], win: [], linux: [] };
      try {
        const isLinux = d && d.kind === 'host' && d.os === 'linux';
        let server = serverArg !== undefined && serverArg !== null && serverArg !== '' ? parseIp(serverArg) : null;
        if (server === null && serverArg) {
          res.win = [`*** Can't find address for server ${str(serverArg)}: Non-existent domain`];
          res.linux = [`;; Couldn't get address for '${str(serverArg)}': not found`];
          res.reason = 'bad_target';
          res.lines = isLinux ? res.linux : res.win; return res;
        }
        const servers = d && d.kind === 'host' && d.pri ? d.pri.eff.dns : [];
        if (server === null) server = servers.length ? servers[0] : null;
        if (!d || server === null) {
          res.win = ['*** Default servers are not available', 'Server:  UnKnown', 'Address:  127.0.0.1', '', `*** UnKnown can't find ${q}: No response from server`];
          res.linux = [';; connection timed out; no servers could be reached'];
          res.lines = isLinux ? res.linux : res.win; return res;
        }
        res.server = ipStr(server);
        const usable = d.kind === 'host' ? !!hostIfc(d) : d.ifs.some(x => op(x) && x.eff.ip !== null);
        const rev = parseIp(q);
        let r = usable ? dnsQuery(d, server, q, rev !== null ? rev : undefined) : { status: 'timeout' };
        if (!q) r = { status: 'nx', serverName: r.serverName };
        const sName = r.serverName || 'UnKnown';
        res.serverName = r.serverName || null;
        const hdrW = ['Server:  ' + sName, 'Address:  ' + res.server, ''];
        const hdrL = ['Server:\t\t' + res.server, 'Address:\t' + res.server + '#53', ''];
        if (r.status === 'timeout') {
          res.reason = 'dns_fail';
          res.win = ['DNS request timed out.', '    timeout was 2 seconds.', 'Server:  UnKnown', 'Address:  ' + res.server, '',
            'DNS request timed out.', '    timeout was 2 seconds.', 'DNS request timed out.', '    timeout was 2 seconds.', '*** Request to UnKnown timed-out'];
          res.linux = [';; connection timed out; no servers could be reached'];
        } else if (r.status === 'answer') {
          res.ok = true; res.reason = 'ok'; res.authoritative = !!r.authoritative;
          if (rev !== null) {
            res.ip = ipStr(rev); res.name = r.name;
            res.win = hdrW.concat(r.authoritative ? [] : ['Non-authoritative answer:'], ['Name:    ' + r.name, 'Address:  ' + res.ip]);
            res.linux = hdrL.concat(r.authoritative ? [] : ['Non-authoritative answer:'], [`${res.ip.split('.').reverse().join('.')}.in-addr.arpa\tname = ${r.name}.`]);
          } else {
            res.ip = ipStr(r.ip);
            res.win = hdrW.concat(r.authoritative ? [] : ['Non-authoritative answer:'], ['Name:    ' + q, 'Address:  ' + res.ip]);
            res.linux = hdrL.concat(r.authoritative ? [] : ['Non-authoritative answer:'], ['Name:\t' + q, 'Address: ' + res.ip]);
          }
        } else {
          res.reason = r.status === 'nx' ? 'bad_target' : 'dns_fail';
          const why = r.status === 'nx' ? 'Non-existent domain' : 'Server failed';
          res.win = hdrW.concat([`*** ${sName} can't find ${q}: ${why}`]);
          res.linux = hdrL.concat([`** server can't find ${q}: ${r.status === 'nx' ? 'NXDOMAIN' : 'SERVFAIL'}`]);
        }
        res.lines = isLinux ? res.linux : res.win;
        return res;
      } catch (e) {
        res.lines = ['DNS request timed out.']; res.detail = 'internal: ' + (e && e.message);
        return res;
      }
    }

    // ================================================================ public: tables & config
    function cfgOf(f) {
      if (!f) return { ip: null, prefix: null, mask: null, network: null, broadcast: null, mac: null, up: false, linked: false, iface: null };
      const e = f.eff;
      return {
        ip: ipStr(e.ip), prefix: e.ip !== null ? e.prefix : null, mask: e.ip !== null ? ipStr(maskInt(e.prefix)) : null,
        network: e.ip !== null ? ipStr(netInt(e.ip, e.prefix)) : null, broadcast: e.ip !== null ? ipStr(bcastInt(e.ip, e.prefix)) : null,
        mac: f.mac, up: f.up, linked: f.linked, iface: f.name
      };
    }
    function config(devId) {
      const d = devs.get(str(devId)); if (!d) return null;
      if (d.kind === 'host') {
        const f = d.pri, e = f.eff;
        return Object.assign(cfgOf(f), { gateway: ipStr(e.gw), dns: e.dns.map(ipStr), dhcp: !!d.t.dhcp, apipa: !!e.apipa,
          leaseFrom: e.leaseFrom, os: d.os, type: d.type, name: d.name });
      }
      const ifs = d.ifs.map(cfgOf);
      const f = d.ifs.find(x => op(x) && x.eff.ip !== null) || d.ifs.find(x => x.eff.ip !== null) || d.ifs[0] || null;
      return Object.assign(cfgOf(f), { gateway: null, dns: [], dhcp: false, apipa: false, leaseFrom: null, os: d.os, type: d.type, name: d.name,
        up: d.kind === 'bridge' ? true : !!(f && f.up), ifaces: ifs });
    }
    function routes(devId) {
      const d = devs.get(str(devId)); if (!d) return [];
      if (d.kind === 'host') {
        const f = hostIfc(d); if (!f) return [];
        const out = [{ net: ipStr(netInt(f.eff.ip, f.eff.prefix)), prefix: f.eff.prefix, via: null, iface: f.name, type: 'C' }];
        const gw = f.eff.gw;
        if (gw !== null && gw !== f.eff.ip && inSub(gw, f.eff.ip, f.eff.prefix)) out.push({ net: '0.0.0.0', prefix: 0, via: ipStr(gw), iface: f.name, type: 'D' });
        return out;
      }
      if (d.kind === 'router') return d.rt.map(r => ({ net: ipStr(r.net), prefix: r.prefix, via: r.via === null ? null : ipStr(r.via), iface: r.ifc.name, type: r.type === 'S*' ? 'S' : r.type }));
      if (d.kind === 'internet') return d.ifs.filter(f => op(f) && f.eff.ip !== null).map(f => ({ net: ipStr(netInt(f.eff.ip, f.eff.prefix)), prefix: f.eff.prefix, via: null, iface: f.name, type: 'C' }));
      return [];
    }
    function arp(devId) {
      const d = devs.get(str(devId)); if (!d) return [];
      return Array.from(d.arp.entries()).map(([ip, mac]) => ({ ip, mac, type: 'dynamic' })).sort((a, b) => parseIp(a.ip) - parseIp(b.ip));
    }
    function macTable(id) {
      const d = devs.get(str(id)); if (!d || d.kind !== 'bridge') return [];
      return Array.from(d.mac.entries()).map(([mac, port]) => ({ mac, port })).sort((a, b) => natCmp(a.port, b.port) || natCmp(a.mac, b.mac));
    }
    function l2Domain(devId) {
      const d = devs.get(str(devId)); if (!d) return [];
      const comps = new Set();
      if (d.kind === 'bridge') comps.add(compOf.get(d.node));
      else d.ifs.forEach(f => { if (op(f)) comps.add(f.comp); });
      const out = new Set();
      devList.forEach(x => { if (x.kind !== 'bridge' && x.ifs.some(f => op(f) && comps.has(f.comp))) out.add(x.id); });
      return Array.from(out).sort(natCmp);
    }

    const api = {
      topo,
      _P: P,
      problems() { return P.list.map(p => Object.assign({}, p)); },
      config, ping, traceroute, nslookup, arp, routes, macTable, l2Domain,
      resolve(srcId, name) {
        const d = devs.get(str(srcId)); if (!d) return { ok: false, ip: null, reason: 'no_ip' };
        try { const r = resolveName(d, name); return { ok: r.ok, ip: r.ok ? ipStr(r.ip) : null, reason: r.ok ? 'ok' : r.reason }; }
        catch (e) { return { ok: false, ip: null, reason: 'dns_fail' }; }
      },
      linkState(id) { const s = linkState.get(str(id)); return s ? { active: s.active, reason: s.reason, blocked: !!s.blocked } : null; },
      links() { return topo.links.map(l => { const s = linkState.get(l.id); return { id: l.id, active: s.active, reason: s.reason, blocked: !!s.blocked }; }); },
      clearArp(devId) { if (devId === undefined) devList.forEach(d => d.arp.clear()); else { const d = devs.get(str(devId)); if (d) d.arp.clear(); } },
      clearMac(id) { if (id === undefined) devList.forEach(d => d.mac.clear()); else { const d = devs.get(str(id)); if (d) d.mac.clear(); } }
    };
    return api;
  }

  // ------------------------------------------------------------------ render (static SVG)
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function arrow(x1, y1, x2, y2, col) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, h = 4.2;
    const ax = x2 - ux * h - uy * h * 0.9, ay = y2 - uy * h + ux * h * 0.9;
    const bx = x2 - ux * h + uy * h * 0.9, by = y2 - uy * h - ux * h * 0.9;
    const f = n => Math.round(n * 10) / 10;
    return `<path d="M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} M${f(ax)} ${f(ay)} L${f(x2)} ${f(y2)} L${f(bx)} ${f(by)}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const S = 'stroke="var(--ink)" stroke-width="1.6"';
  const ICON = {
    pc: () => `<rect x="-21" y="-21" width="42" height="29" rx="3" fill="var(--panel)" ${S}/>` +
      `<rect x="-17" y="-17" width="34" height="21" rx="1.5" fill="var(--blue)" opacity="0.22"/>` +
      `<path d="M-4 8 L-5.5 15 H5.5 L4 8" fill="var(--panel)" ${S} stroke-linejoin="round"/>` +
      `<rect x="-12" y="15" width="24" height="4" rx="2" fill="var(--field)" ${S}/>`,
    laptop: () => `<rect x="-16" y="-18" width="32" height="22" rx="2.5" fill="var(--panel)" ${S}/>` +
      `<rect x="-12.5" y="-14.5" width="25" height="15" rx="1" fill="var(--blue)" opacity="0.22"/>` +
      `<path d="M-23 5 H23 L19.5 12 H-19.5 Z" fill="var(--field)" ${S} stroke-linejoin="round"/>` +
      `<line x1="-5" y1="8.5" x2="5" y2="8.5" stroke="var(--muted)" stroke-width="1.6" stroke-linecap="round"/>`,
    server: () => `<rect x="-14" y="-23" width="28" height="46" rx="3" fill="var(--panel)" ${S}/>` +
      [-15, -8, -1].map(y => `<rect x="-9" y="${y}" width="18" height="4" rx="1" fill="var(--field)" stroke="var(--muted)" stroke-width="1"/>`).join('') +
      `<circle cx="-6" cy="14" r="2.2" fill="var(--green)"/><circle cx="1" cy="14" r="2.2" fill="var(--blue)"/>` +
      `<line x1="6" y1="14" x2="9" y2="14" stroke="var(--muted)" stroke-width="1.6" stroke-linecap="round"/>`,
    printer: () => `<rect x="-12" y="-20" width="24" height="13" rx="1" fill="var(--panel)" ${S}/>` +
      `<rect x="-21" y="-9" width="42" height="18" rx="3" fill="var(--field)" ${S}/>` +
      `<rect x="-13" y="4" width="26" height="14" rx="1" fill="var(--panel)" ${S}/>` +
      `<line x1="-8" y1="9" x2="8" y2="9" stroke="var(--muted)" stroke-width="1.3"/><line x1="-8" y1="13" x2="4" y2="13" stroke="var(--muted)" stroke-width="1.3"/>` +
      `<circle cx="15" cy="-3" r="2" fill="var(--green)"/>`,
    switch: () => `<rect x="-32" y="-13" width="64" height="26" rx="4" fill="var(--blue)" ${S}/>` +
      [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${-26 + i * 6.6}" y="-1" width="4.4" height="5" rx="0.8" fill="var(--panel)"/>`).join('') +
      arrow(-20, -6.5, -4, -6.5, 'var(--panel)') + arrow(20, -6.5, 4, -6.5, 'var(--panel)') +
      `<circle cx="26" cy="7.5" r="1.6" fill="var(--green)"/>`,
    router: () => `<circle r="21" fill="var(--green)" ${S}/>` +
      arrow(-14, -14, -5, -5, 'var(--panel)') + arrow(14, 14, 5, 5, 'var(--panel)') +
      arrow(4, -4, 14, -14, 'var(--panel)') + arrow(-4, 4, -14, 14, 'var(--panel)'),
    ap: () => `<rect x="-19" y="3" width="38" height="13" rx="5" fill="var(--panel)" ${S}/>` +
      `<circle cx="-11" cy="9.5" r="1.8" fill="var(--green)"/><circle cx="-5" cy="9.5" r="1.8" fill="var(--blue)"/>` +
      `<line x1="0" y1="3" x2="0" y2="-6" ${S}/><circle cx="0" cy="-7" r="2.4" fill="var(--blue)"/>` +
      `<path d="M-5.7 -12.7 A8 8 0 0 1 5.7 -12.7" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M-10 -17 A14 14 0 0 1 10 -17" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M-14.2 -21.2 A20 20 0 0 1 14.2 -21.2" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`,
    internet: () => `<path d="M-19 13 C-31 13 -31 -3 -20 -3 C-21 -16 -4 -21 2 -11 C7 -21 25 -17 22 -3 C33 -2 32 13 21 13 Z" fill="var(--field)" stroke="var(--muted)" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<ellipse cx="0" cy="3" rx="8.5" ry="8.5" fill="none" stroke="var(--blue)" stroke-width="1.4"/>` +
      `<ellipse cx="0" cy="3" rx="3.6" ry="8.5" fill="none" stroke="var(--blue)" stroke-width="1.2"/>` +
      `<line x1="-8.5" y1="3" x2="8.5" y2="3" stroke="var(--blue)" stroke-width="1.2"/>`
  };
  const ICON_BOTTOM = { pc: 20, laptop: 13, server: 24, printer: 19, switch: 14, router: 22, ap: 17, internet: 14 };
  const RING = { pc: 30, laptop: 29, server: 30, printer: 28, switch: 38, router: 29, ap: 28, internet: 36 };

  function render(topoOrNet, opts) {
    opts = isObj(opts) ? opts : {};
    let net;
    try { net = topoOrNet && typeof topoOrNet.ping === 'function' && topoOrNet.topo ? topoOrNet : create(topoOrNet); }
    catch (e) { net = create({}); }
    const T = net.topo;
    const showIp = opts.showIp !== false;
    const hl = new Set(Array.isArray(opts.highlight) ? opts.highlight.map(String) : []);
    const r1 = n => Math.round(n * 10) / 10;
    const devs = T.devices;
    const byId = new Map(devs.map(d => [d.id, d]));
    const labelsOf = d => {
      const L = [];
      if (d.type === 'ap' && d.ssid) L.push('SSID: ' + d.ssid);
      if (!showIp) return L;
      if (HOST[d.type]) {
        if (d.dhcp) L.push('DHCP');
        else { const f = d.ifaces[0]; if (f && f.ip) L.push(f.ip + (f.prefix !== undefined && f.prefix !== null ? '/' + f.prefix : '')); }
      } else if (d.type === 'router' || d.type === 'internet') {
        d.ifaces.forEach(f => { if (f.ip) L.push((d.ifaces.length > 1 ? f.name + ' ' : '') + f.ip + (f.prefix !== undefined && f.prefix !== null ? '/' + f.prefix : '')); });
      }
      return L;
    };
    // bounds (and label boxes used to place link-down markers)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const boxes = [];
    devs.forEach(d => {
      const lines = labelsOf(d);
      const hw = Math.max(26, 3.6 * Math.max(String(d.name).length, ...lines.map(s => s.length), 0));
      boxes.push([d.x - hw, d.y - 24, d.x + hw, d.y + (ICON_BOTTOM[d.type] || 20) + 22 + lines.length * 15]);
      const w = Math.max(64, 7.2 * Math.max(String(d.name).length, ...lines.map(s => s.length), 0)) / 2 + 8;
      minX = Math.min(minX, d.x - Math.max(w, 44)); maxX = Math.max(maxX, d.x + Math.max(w, 44));
      minY = Math.min(minY, d.y - 40);
      maxY = Math.max(maxY, d.y + (ICON_BOTTOM[d.type] || 20) + 22 + lines.length * 15 + 8);
    });
    if (!devs.length) { minX = 0; minY = 0; maxX = 320; maxY = 120; }
    const pad = 12;
    minX = Math.floor(minX - pad); minY = Math.floor(minY - pad); maxX = Math.ceil(maxX + pad); maxY = Math.ceil(maxY + pad);
    const vw = maxX - minX, vh = maxY - minY;
    const out = [];
    const W = opts.width ? ` width="${esc(opts.width)}"` : ` width="${vw}"`;
    const H = opts.height ? ` height="${esc(opts.height)}"` : ` height="${vh}"`;
    const title = str(opts.title) || 'แผนผังเครือข่าย';
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${vw} ${vh}"${W}${H} role="img" aria-label="${esc(title)}" font-family="inherit" style="font-family:inherit;max-width:100%;height:auto">`);
    out.push(`<title>${esc(title)}</title>`);
    if (!devs.length) out.push(`<text x="160" y="64" text-anchor="middle" font-size="14" fill="var(--muted)">ไม่มีอุปกรณ์</text>`);
    // links
    out.push('<g class="netsim-links">');
    T.links.forEach(l => {
      const a = byId.get(l.a.dev), b = byId.get(l.b.dev);
      if (!a || !b || a === b) return;
      const st = net.linkState(l.id) || { active: false, reason: 'bad_link' };
      let style;
      if (l.medium === 'wifi') style = 'stroke="var(--blue)" stroke-width="2.2" stroke-dasharray="7 6" stroke-linecap="round"';
      else if (l.medium === 'fiber') style = 'stroke="var(--orange)" stroke-width="4.5" stroke-linecap="round"';
      else style = 'stroke="var(--muted)" stroke-width="2.2" stroke-linecap="round"';
      const dim = st.active ? '' : ' opacity="0.55"';
      out.push(`<line x1="${r1(a.x)}" y1="${r1(a.y)}" x2="${r1(b.x)}" y2="${r1(b.y)}" ${style}${dim}><title>${esc(l.id + ': ' + a.name + ' ' + l.a.port + ' — ' + b.name + ' ' + l.b.port + ' (' + l.medium.toUpperCase() + (st.active ? '' : ', ' + st.reason) + ')')}</title></line>`);
      if (opts.showPorts) {
        const pl = (p, q, port) => {
          const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
          // keep clear of the icon and, for links leaving downwards, of the label block under the device
          const bottom = (ICON_BOTTOM[p.type] || 20) + 18 + 15 * labelsOf(p).length + 8;
          let k = uy > 0.4 ? Math.max(40, bottom / uy) : 40;
          k = Math.min(k, L * 0.45);
          const px = p.x + ux * k + (-uy) * 8, py = p.y + uy * k + ux * 8 + 4;
          const anchor = Math.abs(uy) > 0.6 ? (uy > 0 ? 'end' : 'start') : 'middle';
          return `<text x="${r1(px)}" y="${r1(Math.abs(uy) > 0.6 ? py : p.y + uy * k - 6)}" text-anchor="${anchor}" font-size="12" fill="var(--muted)" stroke="var(--panel)" stroke-width="3" paint-order="stroke">${esc(port)}</text>`;
        };
        out.push(pl(a, b, l.a.port), pl(b, a, l.b.port));
      }
      if (!st.active && !st.blocked) {
        // put the X on the cable where it does not cover an icon or a label
        let fr = 0.5;
        for (const f of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) {
          const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
          if (!boxes.some(bx => x > bx[0] - 10 && x < bx[2] + 10 && y > bx[1] - 10 && y < bx[3] + 10)) { fr = f; break; }
        }
        const mx = r1(a.x + (b.x - a.x) * fr), my = r1(a.y + (b.y - a.y) * fr);
        out.push(`<g transform="translate(${mx} ${my})"><circle r="10" fill="var(--panel)" stroke="var(--bad)" stroke-width="1.5"/><path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="var(--bad)" stroke-width="2.8" stroke-linecap="round"/></g>`);
      }
    });
    out.push('</g>');
    // devices
    out.push('<g class="netsim-devices">');
    devs.forEach(d => {
      const icon = (ICON[d.type] || ICON.pc)();
      const lines = labelsOf(d);
      const by = (ICON_BOTTOM[d.type] || 20) + 18;
      let g = `<g transform="translate(${r1(d.x)} ${r1(d.y)})" data-id="${esc(d.id)}"><title>${esc(d.name)}</title>`;
      if (hl.has(d.id)) g += `<circle r="${RING[d.type] || 30}" fill="none" stroke="var(--orange)" stroke-width="3.2" stroke-dasharray="none" opacity="0.95"/><circle r="${(RING[d.type] || 30) + 4}" fill="none" stroke="var(--orange)" stroke-width="1.2" opacity="0.45"/>`;
      g += icon;
      g += `<text y="${by}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)" stroke="var(--panel)" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${esc(d.name)}</text>`;
      lines.forEach((s, i) => { g += `<text y="${by + 15 * (i + 1)}" text-anchor="middle" font-size="12" fill="var(--muted)" stroke="var(--panel)" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${esc(s)}</text>`; });
      g += '</g>';
      out.push(g);
    });
    out.push('</g></svg>');
    return out.join('');
  }

  const NetSim = { version: VERSION, create, render, ip: IP, reasonText: REASON_TEXT, REASONS };
  return NetSim;
});
