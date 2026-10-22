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
 *
 * 2.8 ADDITIONS (additive: topologies that do not use these fields behave exactly as before)
 *   - Device power: `power:false` on any device = switched off. Every link touching it is inactive (linkState reason
 *     'off'), a powered-off source cannot send (ping reason 'device_off'), and trace() explains failures caused by an
 *     off device with code 'device_off' ("อุปกรณ์ปิดอยู่"). net.config(id).power tells the state.
 *   - Hub: type 'hub' (or a switch with hub:true) is normalised to { type:'switch', hub:true }. A hub is a layer-1
 *     repeater: it never learns MAC addresses (macTable() stays empty) and repeats every frame out of all other ports,
 *     so all its ports share ONE collision domain. trace() hops carry `flood: [devIds]` = end devices that also got a
 *     copy of the frame (and dropped it because the destination MAC was not theirs). net.collisionDomains() lists them.
 *   - trace() hops carry `frame`: the Ethernet frame of that hop { type:'IPv4 (0x0800)'|'ARP (0x0806)', srcMac, dstMac,
 *     srcIp, dstIp, ttl, proto } (ARP: dstMac FF-FF-FF-FF-FF-FF, senderIp, targetIp, replyMac).
 *   - Router packet filter `filters:[{ action:'deny'|'permit', src:'net/prefix'|'any', dst:..., proto:'any'|'icmp'|'udp'|'tcp' }]`:
 *     a simple STATELESS firewall checked in order for packets the router forwards (first match wins, no match = permit;
 *     this is NOT Cisco ACL semantics, which end with an implicit deny). A denied packet is dropped silently
 *     (ping: Request timed out; trace code 'blocked'). Replies are filtered too (stateless).
 *   - Access point: `passphrase` (WPA2/WPA3-Personal key). When set and security is not Open, a Wi-Fi client must set the
 *     same `wifiKey` or it is not associated (linkState reason 'auth', problem code 'wifi_auth').
 *     `isolation:true` = client (guest) isolation: Wi-Fi clients of that AP cannot reach each other (ARP between them is
 *     not relayed, trace code 'ap_isolation'); they still reach wired devices such as the gateway.
 *   - NetSim.capstone: requirements, fault injection and evaluation of the "Final Network Capstone" mission, shared by the
 *     browser (live checklist) and the server grader.
 *
 * 3.1 ADDITIONS: NAT/PAT, interface ACLs, TCP/UDP port tests (additive: a topology without the fields below behaves
 * exactly as before — no new field = no new code path; every old ping/trace/DNS result is unchanged)
 *   - Packets carry ports: tcp/udp sport+dport, ICMP echo identifier (Windows id 1, others a fixed per-device id).
 *   - Router interface `nat:'inside'|'outside'` + router `nat:{ pat:{ iface, src }, statics:[{ proto:'tcp'|'udp'|'ip',
 *     local, lport, global, gport }] }`. Inside->outside (ingress inside, egress outside): static entry of the source
 *     first, else PAT (overload) on the interface address when `pat.iface` is the egress and `pat.src` (network/prefix,
 *     "net wildcard", "host x", any) matches the source. Port kept when free, otherwise the next free one. Outside->inside
 *     (ingress outside): static match on (global, proto, gport) or the dynamic table. Static globals other than the
 *     interface address are answered by proxy ARP. Each router keeps a translation table (net.natTable(id)).
 *     Order like Cisco IOS: inbound ACL -> NAT outside->inside -> routing -> NAT inside->outside -> outbound ACL.
 *     Router-originated traffic is not translated and not checked by outbound ACLs.
 *   - Internet device `requireNat:true` (opt-in, used by missions t10–t13 only): it drops packets whose source is a
 *     private (RFC 1918) address (trace code nat_missing, with the router-side cause), does not route to private
 *     destinations (private_dst), and routes between its own connected subnets (an "outside" test host can sit behind
 *     it). Without the flag the Internet keeps the old implicit NAT behaviour.
 *   - Router `acls:[{ name, iface, dir:'in'|'out', rules:[{ action:'permit'|'deny', proto:'ip'|'icmp'|'tcp'|'udp',
 *     src, dst, port }] }]`: ordered, first match wins, implicit "deny ip any any" at the end, stateless (replies are
 *     checked too), one ACL per interface and direction, an empty ACL is not applied. src/dst accept any, host A, A/p
 *     or Cisco "A wildcard" (a subnet mask typed as wildcard is matched literally and reported, as on real gear).
 *     Port = destination port (number or http/https/ssh/dns/rdp …) and needs tcp/udp. trace code acl_denied; every
 *     ACL decision on the path is returned in trace().acl. The 2.8 `filters` list keeps its semantics (default
 *     permit) and shares the rule matcher (it may now also use `port`).
 *   - trace(src, target, { proto:'tcp'|'udp', port }) tests a service: success needs a listening service
 *     (host services web -> tcp 80/443, dns -> udp/tcp 53, file -> tcp 445, ssh -> tcp 22, rdp -> tcp 3389; Internet
 *     hosts tcp 80/443, public resolvers 53); a closed port gives code refused (TCP RST) / port_unreachable (UDP).
 *     trace() also returns proto, port, acl:[decisions], nat:[translations] and hops with tcp/udp frames + ports.
 *   - net.natTable(routerId), net.acls(routerId); NetSim.acl { parseAddr, parseRule, parsePort, match };
 *     NetSim.natlab: start topologies, pinning and evaluation of missions t10–t13 (shared by browser and grader).
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
    ttl_expired: 'แพ็กเก็ตวนลูประหว่าง Router จนค่า TTL หมด (Routing loop)',
    device_off: 'เครื่องต้นทางปิดอยู่ (Power off) จึงส่งอะไรออกไปไม่ได้'
  };
  const REASONS = Object.keys(REASON_TEXT);
  // trace() failure codes: short Thai title + how to fix (reply_* = the request arrived but the answer could not come back)
  const REPLY_T = 'ปลายทางไม่ตอบกลับ (ไม่มีเส้นทางกลับ)';
  const TRACE_TEXT = {
    ok: { title: 'สำเร็จ', hint: '' },
    src_no_link: { title: 'ไม่มีสายต่อ', hint: 'ต่อสายจากเครื่องต้นทางเข้า Switch/Router หรือเสียบสายที่ถูกถอดกลับ' },
    no_link: { title: 'ไม่มีสายต่อ', hint: 'ตรวจสายที่มีกากบาทสีแดง เสียบสายกลับหรือต่อสายให้ครบ' },
    src_port_down: { title: 'พอร์ตปิด', hint: 'เปิดใช้งาน Network adapter ของเครื่องต้นทาง' },
    port_down: { title: 'พอร์ตปิด', hint: 'เปิดใช้งานพอร์ต/ขาที่ถูกปิด (Router: ติ๊ก "เปิดใช้งาน (no shutdown)")' },
    no_ip: { title: 'ยังไม่มี IP address', hint: 'ตั้ง IP address และ Subnet mask ให้เครื่อง' },
    bad_target: { title: 'หาปลายทางไม่พบ', hint: 'ตรวจการสะกด IP หรือชื่อปลายทาง' },
    dns_fail: { title: 'ติดต่อ DNS ไม่ได้', hint: 'ตั้ง DNS server ให้เครื่อง และตรวจว่าติดต่อ DNS server ได้' },
    no_gateway: { title: 'อยู่ต่างวงและไม่ได้ตั้ง Default Gateway', hint: 'ถ้าต้องคุยข้ามวง ให้ตั้ง Default Gateway เป็น IP ของ Router ขาที่อยู่วงเดียวกับเครื่อง ถ้าอยู่ Switch เดียวกันให้ตั้ง IP ให้อยู่วงเดียวกัน' },
    gw_not_in_subnet: { title: 'Gateway ไม่อยู่ในวงเดียวกับเครื่อง', hint: 'Default Gateway ต้องอยู่วงเดียวกับ IP ของเครื่อง (ตรวจทั้ง IP และ Subnet mask)' },
    gw_self: { title: 'ตั้ง Gateway เป็น IP ของตัวเอง', hint: 'Default Gateway ต้องเป็น IP ของ Router ไม่ใช่ของเครื่องเอง' },
    gateway_not_found: { title: 'หา Default Gateway ไม่พบ', hint: 'ตรวจว่า Default Gateway ตรงกับ IP ของ Router ขาที่ต่อกับวงนี้ และ Router ตั้ง IP ขานั้นแล้ว' },
    next_hop_not_found: { title: 'หา Next hop ไม่พบ', hint: 'ตรวจ Next hop ของ static route ให้เป็น IP ของ Router ถัดไป' },
    gw_not_router: { title: 'Default Gateway ไม่ใช่ Router', hint: 'Default Gateway ต้องเป็น IP ของ Router ไม่ใช่ของ PC หรือ Server' },
    host_not_found: { title: 'ไม่พบเครื่องปลายทางในวงนี้', hint: 'ตรวจ IP ปลายทาง และตรวจว่าเครื่องปลายทางตั้ง IP อยู่วงเดียวกันจริง' },
    not_connected: { title: 'ไม่มีเส้นทางสายถึงกัน', hint: 'ต่อสายให้สองเครื่องอยู่ในเครือข่ายเดียวกัน (Switch เดียวกันหรือ Switch ที่ต่อถึงกัน)' },
    no_route: { title: 'Router ไม่มีเส้นทางไปวงปลายทาง', hint: 'ต่อขาของ Router เข้ากับวงปลายทาง หรือเพิ่ม static route / default route' },
    ttl_expired: { title: 'แพ็กเก็ตวนลูป (TTL หมด)', hint: 'แก้ static route ที่ชี้วนไปมาระหว่าง Router' },
    internet_unknown: { title: 'ไม่มีปลายทางนี้บนอินเทอร์เน็ต', hint: 'ตรวจ IP ปลายทาง' },
    firewall: { title: 'ปลายทางบล็อก Ping (ไฟร์วอลล์)', hint: 'อนุญาต ICMP ที่ไฟร์วอลล์ของเครื่องปลายทาง (ping ไม่ได้ไม่ได้แปลว่าเครือข่ายเสียเสมอไป)' },
    dup_ip: { title: 'IP ซ้ำ', hint: 'แก้ IP ของเครื่องใดเครื่องหนึ่งไม่ให้ซ้ำกัน (ดูแผง "ปัญหาที่พบ")' },
    timeout: { title: 'ปลายทางไม่ตอบกลับ', hint: 'ตรวจการตั้งค่าตลอดเส้นทาง' },
    reply_no_gateway: { title: REPLY_T, hint: 'ตั้ง Default Gateway ของเครื่องปลายทางเป็น IP ของ Router ขาในวงของเครื่องปลายทาง' },
    reply_gw_not_in_subnet: { title: REPLY_T, hint: 'แก้ Default Gateway ของเครื่องปลายทางให้อยู่วงเดียวกับ IP ของมัน' },
    reply_no_route: { title: REPLY_T, hint: 'เพิ่มเส้นทางกลับไปวงของต้นทางบน Router (static route)' },
    device_off: { title: 'อุปกรณ์ปิดอยู่ (Power off)', hint: 'เปิดเครื่องอุปกรณ์ที่ปิดอยู่ (ตรวจปลั๊กไฟ/สวิตช์ไฟ) แล้วทดสอบอีกครั้ง' },
    blocked: { title: 'ถูกกฎไฟร์วอลล์บล็อก', hint: 'ตรวจกฎไฟร์วอลล์ (Packet filter) บน Router ถ้าการสื่อสารนี้ต้องได้ ให้แก้กฎที่ deny ไว้' },
    ap_isolation: { title: 'Wi-Fi แยกเครื่องลูกข่าย (Client isolation)', hint: 'AP เปิด Client/Guest isolation ไว้ เครื่อง Wi-Fi จึงคุยกันเองไม่ได้ (ตั้งใจเพื่อความปลอดภัย) แต่ยังออกเน็ตและคุยกับเครื่องสาย LAN ได้' },
    wifi_auth: { title: 'รหัสผ่าน Wi-Fi ไม่ถูกต้อง', hint: 'ใส่รหัสผ่าน Wi-Fi (Pre-shared key) ของเครื่องลูกข่ายให้ตรงกับ Access Point' },
    // 3.1
    nat_missing: { title: 'ไม่ได้ทำ NAT (ISP ทิ้งแพ็กเก็ตจาก Private IP)', hint: 'ตั้ง ip nat inside ที่ขา LAN, ip nat outside ที่ขาที่ต่อ ISP และเปิด PAT (overload) บนขา outside ให้ครอบคลุมเครือข่ายภายใน' },
    private_dst: { title: 'Private IP ใช้บนอินเทอร์เน็ตไม่ได้', hint: 'คนภายนอกต้องเชื่อมต่อมาที่ Public IP ของ Router แล้วให้ Router ส่งต่อเข้าเครื่องภายในด้วย Port forwarding (Static NAT)' },
    acl_denied: { title: 'ถูก ACL บล็อก', hint: 'ตรวจ ACL บน Router: ลำดับกฎ (ข้อแรกที่ตรงจะถูกใช้), ทิศ in/out, Network/Wildcard ของต้นทาง-ปลายทาง และพอร์ต — แพ็กเก็ตที่ไม่ตรงกฎข้อใดจะโดน implicit deny ท้าย ACL เสมอ' },
    refused: { title: 'ปลายทางปฏิเสธการเชื่อมต่อ (พอร์ตปิด)', hint: 'ไปถึงเครื่องแล้วแต่ไม่มีบริการเปิดที่พอร์ตนี้ ตรวจว่าเครื่องปลายทางเปิดบริการนั้น หรือถ้าเชื่อมต่อจากภายนอกมาที่ Public IP ต้องตั้ง Port forwarding พอร์ตนี้ที่ Router' },
    port_unreachable: { title: 'ปลายทางไม่มีบริการ UDP ที่พอร์ตนี้', hint: 'ไปถึงเครื่องแล้วแต่ไม่มีบริการที่พอร์ตนี้ (ICMP Port unreachable) ตรวจว่าเครื่องปลายทางเปิดบริการนั้นจริง' }
  };
  ['no_link', 'port_down', 'no_ip', 'gateway_not_found', 'next_hop_not_found', 'gw_not_router', 'host_not_found', 'not_connected', 'ttl_expired', 'internet_unknown', 'timeout', 'device_off', 'blocked', 'ap_isolation', 'wifi_auth', 'nat_missing', 'private_dst', 'acl_denied']
    .forEach(k => { TRACE_TEXT['reply_' + k] = { title: REPLY_T, hint: TRACE_TEXT[k].hint }; });

  // ------------------------------------------------------------------ 3.1: ACL / packet filter rules (shared)
  const PORT_NAMES = { ftp: 21, ssh: 22, telnet: 23, smtp: 25, dns: 53, domain: 53, dhcp: 67, http: 80, www: 80, pop3: 110, ntp: 123,
    imap: 143, https: 443, smb: 445, rdp: 3389 };
  const isPriv = (a) => a !== null && a !== undefined && (inSub(a, 0x0a000000, 8) || inSub(a, 0xac100000, 12) || inSub(a, 0xc0a80000, 16));
  // address part of a rule -> { net, wild, any?, maskLike?, text } | null
  //   any | host A | A (= host) | A/p | "A W" (Cisco wildcard; a subnet mask typed here is matched literally, maskLike:true)
  function aclAddr(a, w) {
    const net = (a & ~w) >>> 0;
    if (w === 0xffffffff) return { net: 0, wild: w, any: true, text: 'any' };
    if (w === 0) return { net, wild: 0, text: 'host ' + ipStr(net) };
    const inv = (~w) >>> 0, p = prefixFromMask(ipStr(inv));
    return { net, wild: w, text: ipStr(net) + ' ' + ipStr(w), cidr: p !== null ? ipStr(net) + '/' + p : null };
  }
  function parseAddr(v) {
    const s = str(v).toLowerCase().replace(/\s+/g, ' ');
    if (!s || s === 'any' || s === '*' || s === '0.0.0.0/0' || s === '0.0.0.0 255.255.255.255') return { net: 0, wild: 0xffffffff, any: true, text: 'any' };
    let m = /^host (\S+)$/.exec(s);
    if (m) { const a = parseIp(m[1]); return a === null ? null : aclAddr(a, 0); }
    m = /^(\S+)\/(\d{1,2})$/.exec(s);
    if (m) { const a = parseIp(m[1]), p = toPrefix(+m[2]); return a === null || p === null ? null : aclAddr(a, (~maskInt(p)) >>> 0); }
    m = /^(\S+) (\S+)$/.exec(s);
    if (m) {
      const a = parseIp(m[1]), w = parseIp(m[2]); if (a === null || w === null) return null;
      const o = aclAddr(a, w);
      if (w !== 0 && w !== 0xffffffff && (w >>> 31) === 1 && prefixFromMask(m[2]) !== null) { o.maskLike = true; o.raw = m[1] + ' ' + m[2]; }
      return o;
    }
    const a = parseIp(s); return a === null ? null : aclAddr(a, 0);
  }
  function addrMatch(ipn, A) { return ipn !== null && ipn !== undefined && (((ipn ^ A.net) & ~A.wild) >>> 0) === 0; }
  // -> { port: int|null } | { err }
  function parsePort(v) {
    const s = str(v).toLowerCase();
    if (!s) return { port: null };
    if (/^\d{1,5}$/.test(s)) { const n = +s; return n >= 1 && n <= 65535 ? { port: n } : { err: 'พอร์ตต้องอยู่ระหว่าง 1–65535' }; }
    const k = s.replace(/^eq\s+/, '');
    if (PORT_NAMES[k]) return { port: PORT_NAMES[k] };
    if (/^eq\s+\d+$/.test(s)) return parsePort(k);
    return { err: `ไม่รู้จักพอร์ต "${str(v)}" (ใส่ตัวเลข เช่น 80, 443 หรือชื่อ http, https, ssh, dns, rdp)` };
  }
  // one rule -> { deny, proto:'any'|'icmp'|'tcp'|'udp', src, dst, port, text } | { err (Thai) }
  function parseRule(r) {
    if (!isObj(r)) return { err: 'ข้อมูลกฎไม่ถูกต้อง' };
    const act = str(r.action).toLowerCase();
    if (act !== 'deny' && act !== 'permit' && act !== 'allow') return { err: 'ต้องเลือก permit หรือ deny' };
    let proto = (str(r.proto) || 'any').toLowerCase(); if (proto === 'ip') proto = 'any';
    if (!/^(any|icmp|udp|tcp)$/.test(proto)) return { err: `ไม่รู้จักโปรโตคอล "${str(r.proto)}" (ip, icmp, tcp, udp)` };
    const src = parseAddr(r.src), dst = parseAddr(r.dst);
    if (!src) return { err: `ต้นทาง "${str(r.src)}" ไม่ถูกต้อง (ใช้ any, host 192.168.1.10, 192.168.1.0/24 หรือ 192.168.1.0 0.0.0.255)` };
    if (!dst) return { err: `ปลายทาง "${str(r.dst)}" ไม่ถูกต้อง (ใช้ any, host 192.168.1.10, 192.168.1.0/24 หรือ 192.168.1.0 0.0.0.255)` };
    const pp = parsePort(r.port);
    if (pp.err) return { err: pp.err };
    if (pp.port !== null && proto !== 'tcp' && proto !== 'udp') return { err: 'ระบุพอร์ตได้เฉพาะโปรโตคอล tcp หรือ udp' };
    const deny = act === 'deny';
    return { deny, proto, src, dst, port: pp.port, text: `${deny ? 'deny' : 'permit'} ${proto === 'any' ? 'ip' : proto} ${src.text} ${dst.text}${pp.port !== null ? ' eq ' + pp.port : ''}` };
  }
  // packet P = { src, dst, proto, dport }
  function ruleMatch(r, P) {
    if (r.proto !== 'any' && r.proto !== P.proto) return false;
    if (!addrMatch(P.src, r.src) || !addrMatch(P.dst, r.dst)) return false;
    if (r.port !== null && r.port !== undefined && !((P.proto === 'tcp' || P.proto === 'udp') && P.dport === r.port)) return false;
    return true;
  }
  const PROTO_UP = { icmp: 'ICMP', tcp: 'TCP', udp: 'UDP', any: 'IP' };

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
      // 2.8: hub = switch that repeats frames (layer 1); power:false = switched off (kept only when off)
      if (type === 'switch' && (tRaw === 'hub' || d.hub === true || d.hub === 'true')) d.hub = true; else delete d.hub;
      if (d.power === false || d.power === 'off' || d.power === 'false' || d.power === 0) d.power = false; else delete d.power;
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
        if (d.wifiKey !== undefined) d.wifiKey = typeof d.wifiKey === 'string' || typeof d.wifiKey === 'number' ? String(d.wifiKey) : '';
      } else if (type === 'router' || type === 'internet') {
        if (!Array.isArray(d.ifaces)) d.ifaces = [];
        d.ifaces = d.ifaces.filter(isObj);
        if (type === 'router') {
          d.routes = Array.isArray(d.routes) ? d.routes.filter(isObj) : [];
          d.services = isObj(d.services) ? d.services : {};
          if (d.filters !== undefined) d.filters = Array.isArray(d.filters) ? d.filters.filter(isObj).slice(0, 50) : [];
          // 3.1: NAT and interface ACLs (kept only when present)
          if (d.nat !== undefined) d.nat = isObj(d.nat) ? d.nat : {};
          if (d.acls !== undefined) d.acls = Array.isArray(d.acls) ? d.acls.filter(isObj).slice(0, 12) : [];
        } else {
          if (d.requireNat === true || d.requireNat === 'true') d.requireNat = true; else delete d.requireNat;
          const hosts = {};
          if (isObj(d.hosts)) Object.keys(d.hosts).forEach(k => { const ip = parseIp(k); if (ip !== null) hosts[ipStr(ip)] = str(d.hosts[k]).toLowerCase().replace(/\.$/, ''); });
          d.hosts = hosts;
        }
      } else {
        const def = type === 'ap' ? 1 : 24;
        const n = Math.floor(+d.ports);
        d.ports = Number.isFinite(n) && n >= 1 && n <= 96 ? n : def;
        if (type === 'ap') {
          d.ssid = str(d.ssid); d.security = str(d.security) || 'WPA2';
          if (d.passphrase !== undefined) d.passphrase = typeof d.passphrase === 'string' || typeof d.passphrase === 'number' ? String(d.passphrase) : '';
          if (d.isolation !== undefined) d.isolation = d.isolation === true || d.isolation === 'true';
        }
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
        os: kind === 'host' ? t.os : 'ios', gw: null, dnsServers: [], hosted: new Map(), rt: [],
        off: t.power === false, hub: t.hub === true, filters: [],
        natc: null, natT: { flows: new Map(), ports: new Map(), rev: new Map(), any: new Map() }, acl: { list: [], on: new Map() } };
      if (t.ifaces) t.ifaces.forEach((f, j) => {
        d.ifs.push({ dev: d, t: f, name: f.name, idx: j, mac: f.mac, up: f.up, ip: f._ip, prefix: f._prefix, link: null, linked: false,
          nat: t.type === 'router' && (f.nat === 'inside' || f.nat === 'outside') ? f.nat : null,
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
            } else if (ap.t.passphrase && !/^(open|none|ไม่เข้ารหัส)/i.test(ap.t.security || '') && str(host.t.wifiKey) !== ap.t.passphrase) {
              // 2.8: WPA2/WPA3-Personal: the client must know the pre-shared key
              reason = 'auth';
              P.add('error', 'wifi_auth', host.t.wifiKey ? `${host.name} ใส่รหัสผ่าน Wi-Fi ของ ${ap.name} ไม่ถูกต้อง จึงเชื่อมต่อไม่ได้ (Authentication failed)` : `${host.name} ยังไม่ได้ใส่รหัสผ่าน Wi-Fi ของ ${ap.name} (${ap.t.security}) จึงเชื่อมต่อไม่ได้`, host.id, l.id);
            }
          }
        }
      }
      if (!reason && (da.off || db.off)) reason = 'off';   // 2.8: a powered-off device has no link light
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

    devList.forEach(d => { if (d.off) P.add('warn', 'device_off', `${d.name} ปิดเครื่องอยู่ (Power off) — สายทุกเส้นที่ต่อกับ ${d.name} ไม่มีสัญญาณ`, d.id); });

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
      // 2.8: packet filter rules (stateless, first match wins, default permit)
      (d.t.filters || []).forEach((r, i) => {
        const act = str(r.action).toLowerCase();
        // 2.8 syntax (any or network[/prefix]); 3.1 shares the matcher with interface ACLs
        const side = v => {
          const s = str(v).toLowerCase();
          if (!s || s === 'any' || s === '*' || s === '0.0.0.0/0') return { net: 0, wild: 0xffffffff, any: true };
          const k = s.indexOf('/');
          const n = parseIp(k > 0 ? s.slice(0, k) : s), p = k > 0 ? toPrefix(s.slice(k + 1)) : 32;
          return n === null || p === null ? null : aclAddr(n, (~maskInt(p)) >>> 0);
        };
        const src = side(r.src), dst = side(r.dst);
        const proto = (str(r.proto) || 'any').toLowerCase();
        const pp = parsePort(r.port);
        if ((act !== 'deny' && act !== 'permit' && act !== 'allow') || !src || !dst || !/^(any|ip|icmp|udp|tcp)$/.test(proto) || pp.err || (pp.port !== null && proto !== 'tcp' && proto !== 'udp')) {
          P.add('warn', 'filter_bad', `กฎไฟร์วอลล์ข้อที่ ${i + 1} ของ ${d.name} ไม่ถูกต้อง (ต้องมี action deny/permit และ network ต้นทาง/ปลายทาง เช่น 172.16.10.0/26 หรือ any) ระบบข้ามกฎนี้`, d.id);
          return;
        }
        d.filters.push({ n: i + 1, deny: act === 'deny', src, dst, proto: proto === 'ip' ? 'any' : proto, port: pp.port,
          text: `${act === 'deny' ? 'deny' : 'permit'} ${proto} ${str(r.src) || 'any'} → ${str(r.dst) || 'any'}${pp.port !== null ? ' port ' + pp.port : ''}` });
      });
      // 3.1: interface ACLs (ordered, first match, implicit deny) and NAT configuration
      parseAcls(d);
      parseNat(d);
    });
    // 3.1: a static NAT global address that is not an interface address is answered by the router (proxy ARP)
    devList.forEach(d => {
      if (!d.natc) return;
      d.natc.statics.forEach(s => {
        const f = d.ifs.find(x => x.nat === 'outside' && op(x) && x.eff.ip !== null && x.eff.ip !== s.global && inSub(s.global, x.eff.ip, x.eff.prefix));
        if (f && !arpIdx.has(f.comp + '|' + s.global)) arpIdx.set(f.comp + '|' + s.global, [f]);
      });
    });
    // first matching filter rule of router d for a packet, or null
    function filterHit(d, sip, dip, proto, dport) {
      if (!d.filters.length || sip === null || sip === undefined) return null;
      const pk = { src: sip, dst: dip, proto, dport };
      for (const r of d.filters) if (ruleMatch(r, pk)) return r;
      return null;
    }
    function parseAcls(d) {
      const who = d.name;
      (d.t.acls || []).forEach((a, ai) => {
        const name = str(a.name).slice(0, 32) || ('ACL' + (ai + 1));
        const ifName = str(a.iface), dir = str(a.dir).toLowerCase() === 'out' ? 'out' : 'in';
        const ifc = ifName ? d.ifs.find(f => f.name === ifName) || null : null;
        const rules = [];
        (Array.isArray(a.rules) ? a.rules : []).slice(0, 40).forEach((r, i) => {
          const p = parseRule(r);
          if (p.err) { P.add('warn', 'acl_bad', `ACL "${name}" ของ ${who} กฎข้อที่ ${i + 1} ไม่ถูกต้อง: ${p.err} (ระบบข้ามกฎนี้)`, d.id); return; }
          p.n = i + 1; rules.push(p);
          [['ต้นทาง', p.src], ['ปลายทาง', p.dst]].forEach(([w, x]) => {
            if (x.maskLike) P.add('warn', 'acl_wildcard', `ACL "${name}" ของ ${who} ข้อที่ ${i + 1}: ${w} "${x.raw}" ใช้ Subnet mask ในช่อง Wildcard — Wildcard ต้องกลับบิตจาก mask (เช่น /24 = 0.0.0.255) ไม่อย่างนั้นจะเทียบผิดเครื่อง (Router ตีความเป็น ${x.text})`, d.id);
          });
        });
        const acl = { name, ifc, ifName, dir, rules, idx: ai, applied: false };
        d.acl.list.push(acl);
        const key = ifName + '|' + dir;
        if (!ifName) P.add('warn', 'acl_unbound', `ACL "${name}" ของ ${who} ยังไม่ได้ผูกกับขา (interface) ใด จึงยังไม่มีผล`, d.id);
        else if (!ifc) P.add('warn', 'acl_unbound', `ACL "${name}" ของ ${who} อ้างถึงขา "${ifName}" ที่ไม่มีอยู่`, d.id);
        else if (d.acl.on.has(key)) P.add('warn', 'acl_dup', `ขา ${ifName} ของ ${who} มี ACL ทิศ ${dir} อยู่แล้ว ("${d.acl.on.get(key).name}") — ใช้ได้ทิศละ 1 ACL ระบบไม่ใช้ "${name}"`, d.id);
        else if (!rules.length) P.add('warn', 'acl_empty', `ACL "${name}" ของ ${who} ยังไม่มีกฎ จึงยังไม่มีผล (ACL ที่มีกฎจะจบด้วย implicit deny เสมอ)`, d.id);
        else { d.acl.on.set(key, acl); acl.applied = true; }
      });
    }
    function parseNat(d) {
      const nt = d.t.nat; if (!isObj(nt)) return;
      const who = d.name;
      const N = { pat: null, statics: [] };
      const outs = d.ifs.filter(f => f.nat === 'outside');
      if (isObj(nt.pat) && nt.pat.enabled !== false && str(nt.pat.iface)) {
        const ifName = str(nt.pat.iface), ifc = d.ifs.find(f => f.name === ifName) || null;
        const src = str(nt.pat.src) ? parseAddr(nt.pat.src) : null;
        if (!ifc) P.add('warn', 'nat_bad', `PAT ของ ${who} อ้างถึงขา "${ifName}" ที่ไม่มีอยู่`, d.id);
        else if (!src) P.add('warn', 'nat_bad', str(nt.pat.src) ? `เครือข่ายภายในที่ให้ PAT แปลงของ ${who} ไม่ถูกต้อง: "${str(nt.pat.src)}"` : `PAT ของ ${who} ยังไม่ได้ระบุเครือข่ายภายในที่ให้แปลง (เช่น 192.168.1.0/24) จึงยังไม่แปลงใคร`, d.id);
        else {
          N.pat = { ifc, ifName, src };
          if (ifc.nat !== 'outside') P.add('warn', 'nat_bad', `PAT ของ ${who} ใช้ขา ${ifName} ซึ่งยังไม่ได้ตั้งเป็น ip nat outside`, d.id);
          if (src.maskLike) P.add('warn', 'acl_wildcard', `เครือข่ายที่ให้ PAT แปลงของ ${who} ("${src.raw}") ใช้ Subnet mask ในช่อง Wildcard — Wildcard ต้องกลับบิตจาก mask`, d.id);
        }
      }
      (Array.isArray(nt.statics) ? nt.statics : []).filter(isObj).slice(0, 20).forEach((s, i) => {
        const proto = (str(s.proto) || 'tcp').toLowerCase();
        const local = parseIp(str(s.local));
        let global = str(s.global) ? parseIp(str(s.global)) : null;
        if (!str(s.global) && outs[0] && outs[0].eff.ip !== null) global = outs[0].eff.ip;
        const lp = parsePort(s.lport), gp0 = parsePort(s.gport);
        const gp = { port: gp0.port !== null ? gp0.port : lp.port, err: gp0.err };
        const bad = !/^(tcp|udp|ip)$/.test(proto) ? 'โปรโตคอลต้องเป็น tcp, udp หรือ ip (ทุกพอร์ต)' : local === null ? 'IP ภายใน (inside local) ไม่ถูกต้อง' : global === null ? 'IP ภายนอก (inside global) ไม่ถูกต้อง' :
          proto !== 'ip' && (lp.err || lp.port === null) ? 'ต้องระบุพอร์ตภายใน เช่น 443' : proto !== 'ip' && gp.err ? gp.err : null;
        if (bad) { P.add('warn', 'nat_bad', `Static NAT/Port forwarding ข้อที่ ${i + 1} ของ ${who}: ${bad} (ระบบข้ามข้อนี้)`, d.id); return; }
        const dup = N.statics.find(x => x.global === global && (x.proto === 'ip' || proto === 'ip' || (x.proto === proto && x.gport === gp.port)));
        if (dup) { P.add('warn', 'nat_bad', `Static NAT ข้อที่ ${i + 1} ของ ${who} ซ้ำกับข้อที่ ${dup.n} (IP/พอร์ตภายนอกเดียวกัน) ระบบข้ามข้อนี้`, d.id); return; }
        if (!d.ifs.some(f => f.nat === 'outside' && f.eff.ip !== null && inSub(global, f.eff.ip, f.eff.prefix)))
          P.add('warn', 'nat_bad', `Static NAT ข้อที่ ${i + 1} ของ ${who}: IP ภายนอก ${ipStr(global)} ไม่อยู่ในวงของขา outside ใดเลย คนภายนอกจะส่งมาไม่ถึง`, d.id);
        N.statics.push({ n: i + 1, proto, local, lport: proto === 'ip' ? null : lp.port, global, gport: proto === 'ip' ? null : gp.port });
      });
      if (!N.pat && !N.statics.length && !d.ifs.some(f => f.nat)) return;
      d.natc = N;
      if ((N.pat || N.statics.length) && !d.ifs.some(f => f.nat === 'inside')) P.add('warn', 'nat_bad', `${who} ตั้ง NAT แล้วแต่ยังไม่มีขาใดเป็น ip nat inside จึงยังไม่แปลงแพ็กเก็ต`, d.id);
      if ((N.pat || N.statics.length) && !outs.length) P.add('warn', 'nat_bad', `${who} ตั้ง NAT แล้วแต่ยังไม่มีขาใดเป็น ip nat outside จึงยังไม่แปลงแพ็กเก็ต`, d.id);
    }

    // ================================================================ packet engine
    function learnAll(fromIfc) {
      const m = bfs(fromIfc.node);
      m.forEach((v, node) => { const b = nodeDev.get(node); if (b && b.kind === 'bridge' && !b.hub && v.inPort) b.mac.set(fromIfc.mac, v.inPort); });
    }
    function walk(fromIfc, toIfc, path) {
      const m = bfs(fromIfc.node);
      const seq = [];
      let x = toIfc.node;
      while (x !== null && x !== undefined && x !== fromIfc.node) { seq.push(x); const v = m.get(x); x = v ? v.prev : null; }
      seq.reverse();
      seq.forEach(node => {
        const b = nodeDev.get(node);
        if (b && b.kind === 'bridge') { if (!b.hub) b.mac.set(fromIfc.mac, m.get(node).inPort); path.push(b.id); }   // a hub learns nothing
      });
      path.push(toIfc.dev.id);
    }
    // 2.8: which end devices receive a copy of a unicast frame from fromIfc to dstMac (switch: known MAC -> one port,
    // unknown -> flood; hub: always every other port). Uses the MAC tables as they are now (before this frame is learned).
    function floodSet(fromIfc, dstMac, toIfc, learn) {
      const got = new Set();
      const seen = new Set([fromIfc.node]);
      const q = [];
      (adj.get(fromIfc.node) || []).forEach(e => q.push({ node: e.to, prev: fromIfc.node }));
      while (q.length) {
        const { node, prev } = q.shift();
        if (seen.has(node)) continue; seen.add(node);
        const dv = nodeDev.get(node); if (!dv) continue;
        if (dv.kind !== 'bridge') { if (node !== toIfc.node && dv !== fromIfc.dev) got.add(dv.id); continue; }
        const edges = adj.get(node) || [];
        const back = edges.find(z => z.to === prev);
        const inPort = back ? back.port : null;
        if (learn && !dv.hub && inPort) dv.mac.set(fromIfc.mac, inPort);   // a switch behind a hub learns from the repeated copy
        let outs = edges.filter(z => z.to !== prev);
        if (!dv.hub && dstMac) {
          const known = dv.mac.get(dstMac);
          if (known !== undefined) outs = known === inPort && inPort !== 'wifi' ? [] : outs.filter(z => z.port === known);
        }
        outs.forEach(z => q.push({ node: z.to, prev: node }));
      }
      return Array.from(got).sort(natCmp);
    }
    function compMembers(ifc) {
      const out = new Set();
      devList.forEach(x => { if (x.kind !== 'bridge' && x !== ifc.dev && x.ifs.some(f => op(f) && f.comp === ifc.comp)) out.add(x.id); });
      return Array.from(out).sort(natCmp);
    }
    // 2.8: AP client isolation: both ends are Wi-Fi clients of the same AP that isolates its clients
    function isolatedPair(a, b) {
      const apOf = f => { const l = f.link; if (!l || l.medium !== 'wifi') return null; const o = devs.get(l.a.dev === f.dev.id ? l.b.dev : l.a.dev); return o && o.type === 'ap' ? o : null; };
      const x = apOf(a), y = apOf(b);
      return !!x && x === y && x.t.isolation === true;
    }
    function arpResolve(fromIfc, ipn) {
      const d = fromIfc.dev;
      const list = arpIdx.get(fromIfc.comp + '|' + ipn) || [];
      let tgt = list.find(x => x !== fromIfc) || null;
      if (tgt && isolatedPair(fromIfc, tgt)) tgt = null;
      const key = ipStr(ipn);
      if (tgt && d.arp.get(key) === tgt.mac) return tgt;
      learnAll(fromIfc); // ARP request is a broadcast
      if (!tgt) return null;
      d.arp.set(key, tgt.mac);
      if (fromIfc.eff.ip !== null) tgt.dev.arp.set(ipStr(fromIfc.eff.ip), fromIfc.mac);
      const tmp = []; walk(tgt, fromIfc, tmp); // unicast ARP reply teaches switches the target's MAC
      if (tmp.some(id => { const b = devs.get(id); return b && b.hub; })) floodSet(tgt, fromIfc.mac, fromIfc, true);
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
        if (d.t.requireNat && isPriv(dst)) return { fail: 'no_route' };   // 3.1: no route back to a private address
        if (prevIfc && prevIfc.eff.ip !== null) {
          const g = d.ifs.find(x => op(x) && x.comp === prevIfc.comp);
          if (g) return { egress: g, nh: prevIfc.eff.ip };
        }
        return { fail: 'no_route' };
      }
      return { fail: 'no_ip' };
    }
    // ARP entry already cached (used only by trace() to decide whether an ARP exchange is shown)
    function arpCached(fromIfc, ipn) {
      const list = arpIdx.get(fromIfc.comp + '|' + ipn) || [];
      const tgt = list.find(x => x !== fromIfc) || null;
      return !!tgt && fromIfc.dev.arp.get(ipStr(ipn)) === tgt.mac;
    }
    // ---- 3.1: NAT (per router translation table) and interface ACLs. P = { src, dst, sport, dport, proto } (mutable)
    const apS = (ip, port) => port === null || port === undefined ? ipStr(ip) : ipStr(ip) + ':' + port;
    function natFlow(d, type, P, local, lport, global, gport, out, oport) {
      const key = P.proto + '|' + apS(local, lport) + '|' + apS(out, oport);
      if (!d.natT.flows.has(key)) d.natT.flows.set(key, { type, proto: P.proto, insideGlobal: apS(global, gport), insideLocal: apS(local, lport), outsideLocal: apS(out, oport), outsideGlobal: apS(out, oport) });
    }
    // inside -> outside (source translation); returns a translation note or null
    function natOut(d, egress, P) {
      const N = d.natc; if (!N || P.src === null) return null;
      const before = apS(P.src, P.sport);
      const s = N.statics.find(x => x.local === P.src && (x.proto === 'ip' || (x.proto === P.proto && x.lport === P.sport)));
      if (s) {
        const local = P.src, lport = P.sport;
        P.src = s.global; if (s.proto !== 'ip') P.sport = s.gport;
        natFlow(d, 'static', P, local, lport, P.src, P.sport, P.dst, P.dport);
        return { dev: d.id, kind: 'static', dir: 'out', field: 'src', from: before, to: apS(P.src, P.sport) };
      }
      if (!N.pat || N.pat.ifc !== egress || egress.eff.ip === null || !addrMatch(P.src, N.pat.src)) return null;
      const T = d.natT, g = egress.eff.ip;
      const pk = P.proto + '|' + P.src + '|' + P.sport;
      let gp = T.ports.get(pk);
      if (gp === undefined) {
        const lo = P.proto === 'icmp' ? 1 : 1024;
        const taken = p => { const e = T.rev.get(P.proto + '|' + g + '|' + p); return !!e || N.statics.some(x => x.global === g && (x.proto === 'ip' || (x.proto === P.proto && x.gport === p))); };
        gp = P.sport === null || P.sport === undefined ? lo : P.sport;
        for (let k = 0; k < 70000 && taken(gp); k++) { gp++; if (gp > 65535) gp = lo; }
        const e = { local: P.src, lport: P.sport };
        T.ports.set(pk, gp); T.rev.set(P.proto + '|' + g + '|' + gp, e); T.any.set(g + '|' + gp, e);
      }
      const local = P.src, lport = P.sport;
      P.src = g; P.sport = gp;
      natFlow(d, 'PAT', P, local, lport, g, gp, P.dst, P.dport);
      return { dev: d.id, kind: 'PAT', dir: 'out', field: 'src', from: before, to: apS(P.src, P.sport) };
    }
    // outside -> inside (destination translation)
    function natIn(d, P, err) {
      const N = d.natc; if (!N) return null;
      const before = apS(P.dst, P.dport);
      const s = err ? null : N.statics.find(x => x.global === P.dst && (x.proto === 'ip' || (x.proto === P.proto && x.gport === P.dport)));
      if (s) {
        P.dst = s.local; if (s.proto !== 'ip') P.dport = s.lport;
        natFlow(d, 'static', P, P.dst, P.dport, s.global, s.proto === 'ip' ? P.dport : s.gport, P.src, P.sport);
        return { dev: d.id, kind: 'static', dir: 'in', field: 'dst', from: before, to: apS(P.dst, P.dport) };
      }
      const e = err ? d.natT.any.get(P.dst + '|' + P.dport) : d.natT.rev.get(P.proto + '|' + P.dst + '|' + P.dport);
      if (!e) return null;
      P.dst = e.local; P.dport = e.lport;
      return { dev: d.id, kind: 'PAT', dir: 'in', field: 'dst', from: before, to: apS(P.dst, P.dport) };
    }
    // ACL bound to ifc/dir: null (none) or the decision { permit, implicit, n, text, acl, iface, dir, pkt }
    function aclCheck(d, ifc, dir, P) {
      const a = d.acl.on.get(ifc.name + '|' + dir); if (!a) return null;
      const pkt = `${PROTO_UP[P.proto] || P.proto} ${ipStr(P.src)} → ${ipStr(P.dst)}${(P.proto === 'tcp' || P.proto === 'udp') && P.dport ? ':' + P.dport : ''}`;
      const base = { dev: d.id, devName: d.name, acl: a.name, iface: ifc.name, dir, pkt };
      for (const r of a.rules) if (ruleMatch(r, P)) return Object.assign(base, { permit: !r.deny, implicit: false, n: r.n, text: r.text });
      return Object.assign(base, { permit: false, implicit: true, n: null, text: 'deny ip any any (implicit deny)' });
    }
    function natRole(d) { return d.kind === 'router' && d.ifs.some(f => f.nat); }

    // rec (optional, used by trace()): { phase, list } receives one entry per ARP exchange / frame hop
    // meta (optional, 2.8): { src: source IP of the packet (int), proto: 'icmp'|'udp'|'tcp' } for router filters and frame info
    //   3.1: sport/dport (ICMP: echo id in both), err:true = ICMP error (NAT matches on address+port only)
    // The result carries the packet as it arrived: src/dst/sport/dport (after NAT), xl:[translations], acl:[decisions]
    function forward(origin, dst, ttl, prevIfc0, rec, meta) {
      meta = meta || {};
      const path = [origin.id];
      const proto = meta.proto ? meta.proto : 'icmp';
      const P = { src: null, dst, sport: meta.sport === undefined ? null : meta.sport, dport: meta.dport === undefined ? null : meta.dport, proto };
      const xl = [], acl = [];
      let lastIn = null;
      const out = o => Object.assign(o, { src: P.src, dst: P.dst, sport: P.sport, dport: P.dport, xl, acl, lastIn });
      const hostIp = () => (hostIfc(origin) || { eff: { ip: null } }).eff.ip;
      if (owns(origin, dst)) { P.src = meta.src !== undefined && meta.src !== null ? meta.src : origin.kind === 'host' ? hostIp() : dst; return out({ kind: 'delivered', dev: origin, path, routers: 0, ttl, prevIfc: null, firstEgress: null, local: true }); }
      let step = originStep(origin, dst, prevIfc0);
      if (step.fail) { P.src = meta.src !== undefined && meta.src !== null ? meta.src : origin.kind === 'host' ? hostIp() : null; return out({ kind: step.fail, dev: origin, path, routers: 0, atOrigin: true }); }
      const firstEgress = step.egress;
      P.src = meta.src !== undefined && meta.src !== null ? meta.src : (origin.kind === 'host' ? hostIp() : firstEgress.eff.ip);
      let cur = origin, routers = 0;
      for (let guard = 0; guard < 400; guard++) {
        const dst = P.dst, pktSrc = P.src;
        const cached = rec ? arpCached(step.egress, step.nh) : true;
        const arpFlood = rec && !cached ? compMembers(step.egress) : null;
        const tgt = arpResolve(step.egress, step.nh);
        if (!tgt) {
          if (rec) rec.list.push({ phase: rec.phase, proto: 'arp', from: cur.id, to: null, path: [cur.id], ip: ipStr(step.nh), egress: step.egress.name, ok: false,
            frame: { type: 'ARP (0x0806)', srcMac: step.egress.mac, dstMac: 'FF-FF-FF-FF-FF-FF', senderIp: ipStr(step.egress.eff.ip), targetIp: ipStr(step.nh), replyMac: null },
            flood: arpFlood || compMembers(step.egress) });
          return out({ kind: 'arp_fail', dev: cur, atOrigin: cur === origin, onlink: step.nh === dst, nh: step.nh, path, routers, firstEgress, egress: step.egress });
        }
        const fl = rec ? floodSet(step.egress, tgt.mac, tgt) : null;
        const L0 = path.length;
        walk(step.egress, tgt, path);
        if (path.slice(L0).some(id => { const b = devs.get(id); return b && b.hub; })) floodSet(step.egress, tgt.mac, tgt, true);
        if (rec) {
          const seg = [cur.id].concat(path.slice(L0));
          if (!cached) rec.list.push({ phase: rec.phase, proto: 'arp', from: cur.id, to: tgt.dev.id, path: seg, ip: ipStr(step.nh), mac: tgt.mac, egress: step.egress.name, ok: true,
            frame: { type: 'ARP (0x0806)', srcMac: step.egress.mac, dstMac: 'FF-FF-FF-FF-FF-FF', senderIp: ipStr(step.egress.eff.ip), targetIp: ipStr(step.nh), replyMac: tgt.mac },
            flood: (arpFlood || []).filter(x => x !== tgt.dev.id) });
          const frame = { type: 'IPv4 (0x0800)', srcMac: step.egress.mac, dstMac: tgt.mac, srcIp: ipStr(pktSrc), dstIp: ipStr(dst), ttl, proto: proto === 'udp' ? 'UDP' : proto === 'tcp' ? 'TCP' : 'ICMP' };
          if (proto === 'tcp' || proto === 'udp') { frame.srcPort = P.sport; frame.dstPort = P.dport; }
          rec.list.push({ phase: rec.phase, proto: proto === 'tcp' || proto === 'udp' ? proto : 'icmp', from: cur.id, to: tgt.dev.id, path: seg, ip: ipStr(step.nh), egress: step.egress.name, ingress: tgt.name, ok: true,
            frame, flood: fl });
        }
        const d = tgt.dev;
        const base = { dev: d, inIfc: tgt, prevIfc: step.egress, path, routers, firstEgress, ttl };
        if (d.kind === 'host') return out(owns(d, dst) ? Object.assign(base, { kind: 'delivered' }) : Object.assign(base, { kind: 'drop', detail: 'not_router' }));
        if (d.kind === 'bridge') return out(Object.assign(base, { kind: 'drop', detail: 'bridge' }));
        if (d.kind === 'router') {
          // 3.1: inbound ACL, then NAT outside -> inside (both only when configured)
          lastIn = tgt;
          const a = aclCheck(d, tgt, 'in', P);
          if (a) { acl.push(a); if (!a.permit) return out(Object.assign(base, { kind: 'drop', detail: 'acl2', aclHit: a })); }
          if (tgt.nat === 'outside') { const x = natIn(d, P, meta.err); if (x) xl.push(x); }
        }
        // 3.1: an ISP that requires NAT drops private source addresses (RFC 1918 cannot be routed back)
        if (d.kind === 'internet' && d.t.requireNat && isPriv(P.src)) return out(Object.assign(base, { kind: 'drop', detail: 'private_src' }));
        if (owns(d, P.dst)) return out(Object.assign(base, { kind: 'delivered' }));
        if (d.kind === 'router') {
          const fr = filterHit(d, P.src, P.dst, proto, P.dport);
          if (fr && fr.deny) return out(Object.assign(base, { kind: 'drop', detail: 'acl', rule: fr }));
        }
        if (d.kind === 'internet') {
          if (d.hosted.has(P.dst)) {
            if (ttl <= 1) return out(Object.assign(base, { kind: 'ttl', from: tgt.eff.ip }));
            return out(Object.assign(base, { kind: 'delivered', virtual: true, ttl: ttl - 1, routers: routers + 1 }));
          }
          if (d.t.requireNat) {
            if (isPriv(P.dst)) return out(Object.assign(base, { kind: 'drop', detail: 'private_dst' }));
            // routes between its own connected networks (e.g. an outside test host behind the ISP)
            const f = d.ifs.find(x => op(x) && x.eff.ip !== null && inSub(P.dst, x.eff.ip, x.eff.prefix));
            if (f) {
              if (ttl <= 1) return out(Object.assign(base, { kind: 'ttl', from: tgt.eff.ip }));
              ttl--; routers++;
              step = { egress: f, nh: P.dst }; cur = d;
              continue;
            }
          }
          return out(Object.assign(base, { kind: 'drop', detail: 'internet_unknown' }));
        }
        if (ttl <= 1) return out(Object.assign(base, { kind: 'ttl', from: tgt.eff.ip }));
        ttl--; routers++;
        const r = lookup(d, P.dst);
        if (!r) return out(Object.assign(base, { kind: 'no_route', from: tgt.eff.ip, routers }));
        // 3.1: NAT inside -> outside, then outbound ACL
        if (tgt.nat === 'inside' && r.egress.nat === 'outside') { const x = natOut(d, r.egress, P); if (x) xl.push(x); }
        const ao = aclCheck(d, r.egress, 'out', P);
        if (ao) { acl.push(ao); if (!ao.permit) return out(Object.assign(base, { kind: 'drop', detail: 'acl2', aclHit: ao })); }
        step = r; cur = d;
      }
      return out({ kind: 'drop', detail: 'loop_guard', dev: cur, path, routers });
    }
    function initTTL(d, virtual) { if (virtual) return INTERNET_HOST_TTL; if (d.kind === 'host') return d.os === 'linux' ? 64 : 128; return 255; }
    function srcIpOf(d, fwd) { if (d.kind === 'host') { const f = hostIfc(d); return f ? f.eff.ip : null; } return fwd && fwd.firstEgress ? fwd.firstEgress.eff.ip : null; }
    // 3.1: source port / ICMP echo identifier of a probe (deterministic)
    function srcPort(d, dst, proto, port) {
      if (proto === 'icmp') return d.kind === 'host' && d.os !== 'linux' ? 1 : 1 + (hashStr(d.id) % 30000);
      return 49152 + (hashStr(d.id + '|' + dst + '|' + port) % 16000);
    }
    // 3.1: is a service listening on (device, address, proto, port)?
    function listens(r, ipn, proto, port, virtual) {
      if (virtual) return proto === 'tcp' && (port === 80 || port === 443) || (port === 53 && PUBLIC_DNS.has(ipn));
      if (r.kind !== 'host') return false;
      const sv = isObj(r.t.services) ? r.t.services : {};
      if (proto === 'tcp' && (port === 80 || port === 443) && sv.web) return true;
      if (port === 53 && isObj(sv.dns) && sv.dns.enabled !== false) return true;
      if (proto === 'tcp' && port === 445 && sv.file) return true;
      if (proto === 'tcp' && port === 22 && sv.ssh) return true;
      if (proto === 'tcp' && port === 3389 && sv.rdp) return true;
      if (proto === 'udp' && port === 67 && sv.dhcp) return true;
      return false;
    }
    // one probe: forward + reply. proto 'icmp' (echo, honours host firewall), 'udp' or 'tcp' (port = destination port)
    function probe(src, dst, ttl, proto, port) {
      const sport = srcPort(src, dst, proto, port);
      const fwd = forward(src, dst, ttl, null, null, { proto, sport, dport: proto === 'icmp' ? sport : (port || null) });
      const res = { fwd, path: fwd.path };
      if (fwd.kind === 'no_gateway' || fwd.kind === 'no_ip') return Object.assign(res, { status: fwd.kind });
      if (fwd.kind === 'arp_fail' && fwd.atOrigin) return Object.assign(res, { status: 'arp_fail', onlink: fwd.onlink, nh: fwd.nh });
      if (fwd.kind === 'no_route' && fwd.atOrigin) return Object.assign(res, { status: 'no_route', from: null, delivered: false, root: 'no_route', detail: 'origin_no_route' });
      if (fwd.kind === 'delivered') {
        const r = fwd.dev;
        if (proto === 'icmp' && r.kind === 'host' && r.t.firewall.icmp === false) return Object.assign(res, { status: 'timeout', detail: 'firewall', failAt: r.id });
        const back = forward(r, fwd.src, initTTL(r, fwd.virtual), fwd.prevIfc, null, { src: fwd.dst, proto, sport: fwd.dport, dport: fwd.sport });
        if (back.kind === 'delivered' && back.dev === src) {
          return Object.assign(res, { status: 'ok', responder: r, virtual: !!fwd.virtual, ttl: back.ttl, routers: fwd.routers, backRouters: back.routers });
        }
        return Object.assign(res, { status: 'timeout', detail: 'reply_failed', failAt: back.dev ? back.dev.id : r.id, back });
      }
      if (fwd.kind === 'ttl' || fwd.kind === 'no_route') {
        const R = fwd.dev;
        const err = forward(R, fwd.src, 255, fwd.prevIfc, null, { proto: 'icmp', err: true, dport: fwd.sport });
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
      return probe(d, target, 255, 'udp', 53).status === 'ok';
    }
    // returns { status:'answer'|'nx'|'servfail'|'timeout', ip, authoritative, serverName }
    function dnsQuery(src, server, name, reverse) {
      const pr = probe(src, server, initTTL(src), 'udp', 53);
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
      if (d.off) return Object.assign(out, { fail: 'device_off' });   // 2.8: a switched-off machine runs nothing
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

    // ================================================================ public: trace (hop-by-hop path + precise reason)
    // trace(srcId, target, { expect: devId }) follows ONE ping packet like ping() does (same engine, same reason code)
    // and records every step for animation: ARP exchanges, Ethernet/IP hops (through switches) and the Echo Reply.
    // When it fails it says exactly where the packet stopped (stopAt) and why (code + Thai msg, see TRACE_TEXT).
    // Like ping(), it updates ARP caches and switch MAC tables of this net instance.
    function ownersOf(ipn) { const out = []; devList.forEach(d => d.ifs.forEach(f => { if (f.eff.ip === ipn) out.push(f); })); return out; }
    function netLabel(ipn, prefix) { return ipStr(netInt(ipn, prefix)) + '/' + prefix; }
    function ifLabel(f) { return f.dev.kind === 'router' ? `${f.dev.name} ขา ${f.name}` : f.dev.name; }
    function endNode(e) { const d = devs.get(e.dev); if (!d) return null; if (d.kind === 'bridge') return d.node; const f = ifcOf(d, e.port); return f ? f.node : null; }
    function linkWhy(l) {
      const s = linkState.get(l.id) || {};
      const a = devs.get(l.a.dev), b = devs.get(l.b.dev);
      const nm = `${l.id} (${a ? a.name : l.a.dev}–${b ? b.name : l.b.dev})`;
      if (s.reason === 'ssid') return { code: 'no_link', link: l.id, msg: `Wi-Fi ${nm} ไม่ได้เชื่อมต่อ เพราะ SSID ไม่ตรงกับ Access Point` };
      if (s.reason === 'iface_down') return { code: 'port_down', link: l.id, msg: `สาย ${nm} ใช้งานไม่ได้ เพราะพอร์ตปลายสายถูกปิด (shutdown/disabled)` };
      if (s.reason === 'off') {
        const off = [a, b].filter(x => x && x.off).map(x => x.name).join(' และ ');
        return { code: 'device_off', link: l.id, dev: (a && a.off ? a : b).id, msg: `${off} ปิดเครื่องอยู่ (Power off) สาย ${nm} จึงไม่มีสัญญาณ` };
      }
      if (s.reason === 'auth') return { code: 'wifi_auth', link: l.id, msg: `Wi-Fi ${nm} ไม่ได้เชื่อมต่อ เพราะรหัสผ่าน Wi-Fi ไม่ถูกต้อง (Authentication failed)` };
      return { code: 'no_link', link: l.id, msg: `สาย ${nm} ถูกถอดหรือขาด (link down)` };
    }
    // why did an ARP request for nh (sent out of egress by cur) get no answer?
    function explainArp(cur, egress, nh, onlink) {
      const owners = ownersOf(nh).filter(f => f.dev !== cur);
      const lan = egress.eff.ip !== null ? netLabel(egress.eff.ip, egress.eff.prefix) : '';
      if (!owners.length) {
        if (cur.kind === 'host' && !onlink) return { code: 'gateway_not_found', msg: `${cur.name} ถามหา Default gateway ${ipStr(nh)} (ARP) แต่ไม่มีอุปกรณ์ใดในวง ${lan} ใช้ IP นี้ — Gateway ต้องเป็น IP ของ Router ขาที่ต่อกับวงนี้` };
        if (!onlink) return { code: 'next_hop_not_found', msg: `${cur.name} ส่งต่อไปยัง Next hop ${ipStr(nh)} ไม่ได้ เพราะไม่มีอุปกรณ์ใดในวง ${lan} ใช้ IP นี้` };
        return { code: 'host_not_found', msg: `${cur.name} ถามหา ${ipStr(nh)} (ARP) ในวง ${lan} แต่ไม่มีเครื่องใดใช้ IP นี้ จึงไม่มีใครตอบ` };
      }
      const o = owners.find(f => op(f)) || owners.find(f => f.up) || owners[0];
      if (o.dev.off) return { code: 'device_off', dev: o.dev.id, msg: `${o.dev.name} (${ipStr(nh)}) ปิดเครื่องอยู่ (Power off) จึงไม่ตอบ ARP` };
      if (op(o) && o.comp === egress.comp && isolatedPair(egress, o)) return { code: 'ap_isolation', dev: o.dev.id, msg: `${cur.name} กับ ${o.dev.name} เป็นเครื่อง Wi-Fi ของ AP เดียวกันที่เปิด Client isolation ไว้ AP จึงไม่ส่งต่อเฟรมระหว่างกัน` };
      if (!o.up) return { code: 'port_down', dev: o.dev.id, msg: `${ifLabel(o)} (${ipStr(nh)}) ถูกปิดใช้งาน (พอร์ตปิด / shutdown) จึงไม่ตอบ ARP` };
      if (!o.linked) {
        if (o.link) { const w = linkWhy(o.link); w.dev = o.dev.id; w.msg = `${ifLabel(o)} (${ipStr(nh)}) ติดต่อไม่ได้: ` + w.msg; return w; }
        return { code: 'no_link', dev: o.dev.id, msg: `${ifLabel(o)} (${ipStr(nh)}) ไม่มีสายต่อ จึงติดต่อไม่ได้` };
      }
      // 2.8: a switched-off device (e.g. a switch) sitting between the two parts of the network
      const offMid = devList.find(x => {
        if (!x.off) return false;
        const cs = new Set();
        topo.links.forEach(l => { if (l.a.dev === x.id) cs.add(compOf.get(endNode(l.b))); if (l.b.dev === x.id) cs.add(compOf.get(endNode(l.a))); });
        return cs.has(egress.comp) && cs.has(o.comp);
      });
      if (offMid) return { code: 'device_off', dev: offMid.id, msg: `${offMid.name} ปิดเครื่องอยู่ (Power off) ทำให้ ${cur.name} ไปไม่ถึง ${ifLabel(o)}` };
      const between = topo.links.find(l => {
        const s = linkState.get(l.id); if (!s || s.active || s.reason === 'port_in_use') return false;
        const ca = compOf.get(endNode(l.a)), cb = compOf.get(endNode(l.b));
        return (ca === egress.comp && cb === o.comp) || (cb === egress.comp && ca === o.comp);
      });
      if (between) { const w = linkWhy(between); w.msg += ` ทำให้ ${cur.name} ไปไม่ถึง ${ifLabel(o)}`; return w; }
      return { code: 'not_connected', dev: o.dev.id, msg: `${ifLabel(o)} ใช้ IP ${ipStr(nh)} แต่ไม่ได้อยู่ในเครือข่ายสายเดียวกับ ${cur.name} (ต่อคนละ Switch หรือไม่มีสายเชื่อมถึงกัน)` };
    }
    function explainNoGw(d, dst, reply) {
      const f = hostIfc(d), gw = f ? f.eff.gw : null;
      const lan = f ? netLabel(f.eff.ip, f.eff.prefix) : '';
      if (gw === null) {
        let msg = reply
          ? `${d.name} ไม่ได้ตั้ง Default Gateway จึงส่งคำตอบกลับไปหา ${ipStr(dst)} ซึ่งอยู่ต่างวงไม่ได้`
          : `${ipStr(dst)} อยู่ต่างวงกับ ${d.name} (วง ${lan}) และ ${d.name} ไม่ได้ตั้ง Default Gateway จึงไม่รู้ว่าจะส่งออกนอกวงทางไหน`;
        const same = f && ownersOf(dst).some(o => op(o) && o.comp === f.comp);
        if (same) msg += ' — สองเครื่องนี้ต่ออยู่ในเครือข่ายสายเดียวกัน ถ้าไม่มี Router ต้องตั้ง IP ให้อยู่วงเดียวกัน';
        return { code: reply ? 'reply_no_gateway' : 'no_gateway', msg };
      }
      if (f && gw === f.eff.ip) return { code: reply ? 'reply_gw_not_in_subnet' : 'gw_self', msg: `${d.name} ตั้ง Default Gateway เป็น IP ของตัวเอง (${ipStr(gw)}) ต้องเป็น IP ของ Router` };
      return { code: reply ? 'reply_gw_not_in_subnet' : 'gw_not_in_subnet', msg: `Default Gateway ${ipStr(gw)} ของ ${d.name} ไม่อยู่ในวงเดียวกับเครื่อง (วง ${lan}) จึงใช้ส่ง${reply ? 'คำตอบกลับ' : 'ออกนอกวง'}ไม่ได้` };
    }
    function explainNoRoute(R, dst, reply) {
      if (R.kind === 'internet' && R.t.requireNat && isPriv(dst)) return { code: reply ? 'reply_nat_missing' : 'private_dst', dev: R.id, msg: `${R.name} (อินเทอร์เน็ต) ไม่มีเส้นทางไปยัง Private IP ${ipStr(dst)} — บนอินเทอร์เน็ตใช้ได้เฉพาะ Public IP${reply ? ' แพ็กเก็ตขาไปจึงต้องถูกแปลงเป็น Public IP ด้วย NAT ก่อนออกจาก Router' : ''}` };
      const owner = ownersOf(dst).find(o => o.eff.prefix !== null && o.dev !== R);
      const dn = owner ? 'วง ' + netLabel(dst, owner.eff.prefix) : ipStr(dst);
      const dead = R.ifs.find(f => f.eff.ip !== null && inSub(dst, f.eff.ip, f.eff.prefix) && !op(f));
      if (dead) return { code: !dead.up ? 'port_down' : 'no_link', dev: R.id, msg: `${R.name} ขา ${dead.name} (วง ${netLabel(dead.eff.ip, dead.eff.prefix)}) ${!dead.up ? 'ถูกปิด (shutdown)' : 'ไม่มีสายต่อ/สายถูกถอด'} จึงไม่มีเส้นทาง${reply ? 'กลับ' : ''}ไปยัง ${dn}` };
      return { code: reply ? 'reply_no_route' : 'no_route', dev: R.id, msg: `${R.name} ไม่มีเส้นทาง${reply ? 'กลับ' : ''}ไปยัง ${dn} (ไม่มีขาที่ต่อตรงกับวงปลายทาง และไม่มี static/default route ที่ตรงกัน)` };
    }
    // failure of one forward() leg -> { code, msg, stop }
    function explainLeg(fw, dst, reply) {
      const pre = (x) => { if (reply && !/^reply_/.test(x.code) && x.code !== 'dup_ip') { x.code = 'reply_' + x.code; } return x; };
      if (fw.kind === 'no_gateway') return Object.assign(explainNoGw(fw.dev, dst, reply), { stop: fw.dev.id });
      if (fw.kind === 'no_ip') return pre({ code: 'no_ip', msg: `${fw.dev.name} ยังไม่มี IP address ที่ใช้งานได้`, stop: fw.dev.id });
      if (fw.kind === 'arp_fail') return Object.assign(pre(explainArp(fw.dev, fw.egress, fw.nh, fw.onlink)), { stop: fw.dev.id });
      if (fw.kind === 'no_route') return Object.assign(explainNoRoute(fw.dev, dst, reply), { stop: fw.dev.id });
      if (fw.kind === 'ttl') return pre({ code: 'ttl_expired', msg: `แพ็กเก็ตวนไปมาระหว่าง Router จน TTL หมดที่ ${fw.dev.name} (Routing loop) ตรวจ static route ที่ชี้วนกัน`, stop: fw.dev.id });
      if (fw.kind === 'drop' && fw.detail === 'not_router') {
        const s = fw.prevIfc ? fw.prevIfc.dev : null;
        return pre({ code: 'gw_not_router', msg: `${s ? s.name : 'ต้นทาง'} ส่งแพ็กเก็ตให้ ${fw.dev.name} (${ipStr(fw.inIfc.eff.ip)}) ในฐานะ ${s && s.kind === 'host' ? 'Default gateway' : 'Next hop'} แต่ ${fw.dev.name} ไม่ใช่ Router จึงไม่ส่งต่อ`, stop: fw.dev.id });
      }
      if (fw.kind === 'drop' && fw.detail === 'acl') {
        const s0 = fw.prevIfc ? fw.prevIfc.dev : null;
        return { code: reply ? 'reply_blocked' : 'blocked', dev: fw.dev.id, rule: fw.rule ? fw.rule.n : null,
          msg: `${fw.dev.name} บล็อกแพ็กเก็ต${reply ? 'ตอบกลับ' : ''}ที่ไป ${ipStr(dst)} ตามกฎไฟร์วอลล์ข้อที่ ${fw.rule ? fw.rule.n : '?'} (${fw.rule ? fw.rule.text : 'deny'})${s0 ? ` ที่ได้รับจาก ${s0.name}` : ''}`, stop: fw.dev.id };
      }
      if (fw.kind === 'drop' && fw.detail === 'acl2') {
        const a = fw.aclHit, R = fw.dev;
        const dirTh = a.dir === 'in' ? 'ขาเข้า (in)' : 'ขาออก (out)';
        return { code: reply ? 'reply_acl_denied' : 'acl_denied', dev: R.id, rule: a.n, acl: a, stop: R.id,
          msg: `${R.name} บล็อกแพ็กเก็ต${reply ? 'ตอบกลับ' : ''} ${a.pkt} ด้วย ACL "${a.acl}" ที่ขา ${a.iface} ${dirTh}: ` +
            (a.implicit ? 'ไม่ตรงกับกฎข้อใดเลย จึงโดน implicit deny (กฎ "deny ip any any" ที่ซ่อนอยู่ท้าย ACL ทุกอัน)' : `ตรงกับกฎข้อที่ ${a.n} "${a.text}" ก่อน (ข้อแรกที่ตรงจะถูกใช้ ข้อถัดไปไม่ถูกตรวจ)`) };
      }
      if (fw.kind === 'drop' && fw.detail === 'private_src') {
        const isp = fw.dev, R = fw.prevIfc ? fw.prevIfc.dev : null, eg = fw.prevIfc, src = fw.src;
        let why = '';
        if (R && R.kind === 'router') {
          const N = R.natc, li = fw.lastIn;
          if (!N && !natRole(R)) why = `${R.name} ยังไม่ได้ตั้งค่า NAT เลย`;
          else if (eg.nat !== 'outside') why = `ขา ${eg.name} ของ ${R.name} (ขาที่ต่อ ISP) ยังไม่ได้ตั้งเป็น ip nat outside${eg.nat === 'inside' ? ' — ตั้งเป็น inside ไว้ (inside/outside สลับกัน)' : ''}`;
          else if (li && li.dev === R && li.nat !== 'inside') why = `ขา ${li.name} ของ ${R.name} (ขาที่รับแพ็กเก็ตจากเครือข่ายภายใน) ยังไม่ได้ตั้งเป็น ip nat inside${li.nat === 'outside' ? ' — ตั้งเป็น outside ไว้ (inside/outside สลับกัน)' : ''}`;
          else if (!N || !N.pat) why = `${R.name} ยังไม่ได้เปิด PAT (NAT overload) และไม่มี Static NAT ของ ${ipStr(src)}`;
          else if (N.pat.ifc !== eg) why = `PAT ของ ${R.name} ใช้ขา ${N.pat.ifName} ไม่ใช่ขา ${eg.name} ที่ต่อ ISP`;
          else if (!addrMatch(src, N.pat.src)) why = `เครือข่ายที่ให้ PAT แปลง (${N.pat.src.raw || N.pat.src.text}) ไม่ครอบคลุม ${ipStr(src)} — ตรวจ Network และ Wildcard/Prefix`;
        }
        return pre({ code: 'nat_missing', dev: R ? R.id : isp.id, stop: isp.id,
          msg: `${isp.name} ทิ้งแพ็กเก็ตที่ IP ต้นทางเป็น Private IP ${ipStr(src)} (RFC 1918 ใช้บนอินเทอร์เน็ตไม่ได้ และคำตอบกลับมาหา IP นี้ไม่ได้) — ต้องแปลงเป็น Public IP ด้วย NAT/PAT ที่ Router ก่อนออก ISP` + (why ? `: ${why}` : '') });
      }
      if (fw.kind === 'drop' && fw.detail === 'private_dst') {
        return pre({ code: 'private_dst', stop: fw.dev.id, msg: `${fw.dev.name} ไม่ส่งต่อแพ็กเก็ตไปยัง Private IP ${ipStr(fw.dst)} — จากอินเทอร์เน็ตต้องเชื่อมต่อมาที่ Public IP ของ Router และ Router ต้องมี Port forwarding (Static NAT) ไปยังเครื่องภายใน` });
      }
      if (fw.kind === 'drop' && fw.detail === 'internet_unknown') {
        // 2.8: the packet left via the default route because the router's interface for that subnet is dead
        for (const R of devList) {
          if (R.kind !== 'router') continue;
          const f = R.ifs.find(x => x.eff.ip !== null && inSub(dst, x.eff.ip, x.eff.prefix) && !op(x));
          if (f && f.link && (linkState.get(f.link.id) || {}).reason === 'off') {
            const w = linkWhy(f.link);
            return pre({ code: 'device_off', dev: w.dev, msg: `${R.name} ขา ${f.name} (วง ${netLabel(f.eff.ip, f.eff.prefix)}) ไม่มีสัญญาณ: ${w.msg} — Router จึงส่งแพ็กเก็ตออก Default route ไปอินเทอร์เน็ตแทนและไม่มีใครตอบ`, stop: fw.dev.id });
          }
        }
      }
      if (fw.kind === 'drop' && fw.detail === 'internet_unknown') return pre({ code: 'internet_unknown', msg: `ไม่มีเครื่องที่ใช้ IP ${ipStr(dst)} บนอินเทอร์เน็ต (จำลอง) จึงไม่มีใครตอบ`, stop: fw.dev.id });
      return pre({ code: 'timeout', msg: 'แพ็กเก็ตถูกทิ้งระหว่างทาง', stop: fw.dev ? fw.dev.id : null });
    }
    function hopText(h) {
      const nm = id => { const d = devs.get(id); return d ? d.name : id; };
      const via = h.path.slice(1, -1).map(nm);
      const route = [nm(h.from)].concat(via, h.to ? [nm(h.to)] : []).join(' → ');
      if (h.proto === 'arp') return h.ok ? `ARP: ${nm(h.from)} ถามหา MAC ของ ${h.ip} (broadcast) — ${nm(h.to)} ตอบกลับ (${h.mac})` : `ARP: ${nm(h.from)} ถามหา MAC ของ ${h.ip} (broadcast) แต่ไม่มีใครตอบ`;
      const f = h.frame || {};
      const what = h.proto === 'tcp' ? (h.phase === 'reply' ? `TCP ตอบกลับ (SYN-ACK/RST) จากพอร์ต ${f.srcPort}` : `TCP SYN ไปพอร์ต ${f.dstPort}`)
        : h.proto === 'udp' ? (h.phase === 'reply' ? `UDP ตอบกลับจากพอร์ต ${f.srcPort}` : `UDP ไปพอร์ต ${f.dstPort}`)
          : h.phase === 'reply' ? 'ICMP Echo Reply' : 'ICMP Echo Request';
      const d = devs.get(h.to);
      const fwd = d && d.kind === 'router' && h.final !== true ? ` (${nm(h.to)} รับแล้วส่งต่อ)` : '';
      return `${what}: ${route}${fwd}${h.natNote ? ' — ' + h.natNote : ''}`;
    }
    // 3.1: mark the hop where NAT changed the IP/port compared to the previous IP hop of the same phase
    function natNotes(hops) {
      const nm = id => { const d = devs.get(id); return d ? d.name : id; };
      const last = {};
      hops.forEach(h => {
        if (h.proto === 'arp' || !h.frame) return;
        const f = h.frame, k = h.phase;
        const a = { s: f.srcIp + (f.srcPort ? ':' + f.srcPort : ''), d: f.dstIp + (f.dstPort ? ':' + f.dstPort : '') };
        const p = last[k];
        if (p && (p.s !== a.s || p.d !== a.d)) {
          const parts = [];
          if (p.s !== a.s) parts.push(`ต้นทาง ${p.s} → ${a.s}`);
          if (p.d !== a.d) parts.push(`ปลายทาง ${p.d} → ${a.d}`);
          h.natNote = `${nm(h.from)} แปลง${parts.join(', ')} (NAT)`;
        }
        last[k] = a;
      });
    }
    function trace(srcId, target, opts) {
      opts = isObj(opts) ? opts : {};
      const pr = prepare(srcId, target);
      const d = pr.d;
      // 3.1: service test (tcp/udp + destination port); default = ICMP echo like ping
      const proto = opts.proto === 'tcp' || opts.proto === 'udp' ? opts.proto : 'icmp';
      const pp = proto === 'icmp' ? { port: null } : parsePort(opts.port);
      const port = pp.port;
      const res = { ok: false, target: pr.tstr, resolved: pr.dst !== null ? ipStr(pr.dst) : null, src: d ? d.id : null, reason: 'timeout', code: 'timeout',
        msg: '', title: '', hint: '', hops: [], stopAt: d ? d.id : null, failAt: null, failHop: -1, responder: null, warn: null, wrongResponder: false,
        proto, port, acl: [], nat: [] };
      const done = (x) => {
        res.reasonText = REASON_TEXT[res.reason] || '';
        const t = TRACE_TEXT[res.code] || TRACE_TEXT.timeout;
        res.title = t.title; res.hint = t.hint;
        natNotes(res.hops);
        res.hops.forEach(h => { h.text = hopText(h); });
        return x || res;
      };
      try {
        if (proto !== 'icmp' && (pp.err || port === null)) { res.code = 'bad_target'; res.reason = 'bad_target'; res.msg = pp.err || 'ต้องระบุพอร์ตปลายทาง (1–65535)'; return done(); }
        if (pr.fail) {
          res.reason = pr.fail; res.failAt = d ? d.id : null;
          if (pr.fail === 'device_off') { res.code = 'device_off'; res.msg = `${d.name} ปิดเครื่องอยู่ (Power off) จึงส่งแพ็กเก็ตไม่ได้ — เปิดเครื่องก่อน`; }
          else if (pr.fail === 'iface_down') { res.code = 'src_port_down'; res.msg = d.kind === 'host' ? `Network adapter ของ ${d.name} ถูกปิด (พอร์ตปิด) แพ็กเก็ตจึงไม่ออกจากเครื่อง` : `ทุกขาของ ${d.name} ถูกปิด (shutdown)`; }
          else if (pr.fail === 'no_link') {
            res.code = 'src_no_link';
            const l = d && d.kind === 'host' && d.pri ? d.pri.link : null;
            res.msg = l ? `${d.name} ส่งออกไม่ได้: ` + linkWhy(l).msg : `${d ? d.name : 'ต้นทาง'} ไม่มีสายต่อ แพ็กเก็ตจึงออกจากเครื่องไม่ได้`;
            const lr = l ? (linkState.get(l.id) || {}).reason : null;
            if (lr === 'iface_down') res.code = 'src_port_down';
            else if (lr === 'off') res.code = 'device_off';
            else if (lr === 'auth') res.code = 'wifi_auth';
          } else if (pr.fail === 'no_ip') { res.code = 'no_ip'; res.msg = `${d ? d.name : 'ต้นทาง'} ยังไม่มี IP address ที่ใช้งานได้`; }
          else if (pr.fail === 'bad_target') { res.code = 'bad_target'; res.msg = `หาชื่อหรือที่อยู่ "${pr.tstr}" ไม่พบ`; }
          else { res.code = 'dns_fail'; res.msg = `${d.name} ติดต่อ DNS server ไม่ได้ จึงแปลงชื่อ "${pr.tstr}" เป็น IP ไม่ได้`; }
          return done();
        }
        if (pr.loopback || pr.self) { res.ok = true; res.reason = 'ok'; res.code = 'ok'; res.responder = d.id; res.stopAt = d.id; res.msg = `${d.name} ping ที่อยู่ของตัวเอง ไม่ต้องส่งออกสาย`; return done(); }
        const dst = pr.dst;
        const hops = res.hops;
        const sport = srcPort(d, dst, proto, port);
        const fwd = forward(d, dst, initTTL(d), null, { phase: 'request', list: hops }, { proto, sport, dport: proto === 'icmp' ? sport : port });
        const sip = srcIpOf(d, fwd);
        const collect = (fw, phase) => { fw.acl.forEach(a => res.acl.push(Object.assign({ phase }, a))); fw.xl.forEach(x => res.nat.push(Object.assign({ phase }, x))); };
        collect(fwd, 'request');
        const isIpHop = h => h.proto !== 'arp';
        const markFinal = () => { for (let i = hops.length - 1; i >= 0; i--) if (isIpHop(hops[i]) && hops[i].phase === 'request') { hops[i].final = true; break; } };
        const what = proto === 'icmp' ? 'Ping' : `การเชื่อมต่อ ${PROTO_UP[proto]} พอร์ต ${port}`;
        if (fwd.kind !== 'delivered') {
          const ex = explainLeg(fwd, dst, false);
          res.code = ex.code; res.msg = ex.msg; res.stopAt = ex.stop; res.failAt = ex.stop;
          if (fwd.kind === 'no_gateway' || fwd.kind === 'no_ip') res.reason = fwd.kind;
          else if (fwd.kind === 'arp_fail') res.reason = fwd.atOrigin ? (fwd.onlink ? 'same_subnet_unreachable' : 'gateway_unreachable') : 'timeout';
          else if (fwd.kind === 'no_route') res.reason = 'no_route';
          else if (fwd.kind === 'ttl') res.reason = 'ttl_expired';
          else res.reason = 'timeout';
          res.failHop = hops.length - 1;
          return done();
        }
        markFinal();
        const r = fwd.dev;
        res.responder = r.id; res.stopAt = r.id;
        if (proto === 'icmp' && r.kind === 'host' && r.t.firewall.icmp === false) {
          res.reason = 'timeout'; res.code = 'firewall'; res.failAt = r.id; res.failHop = hops.length - 1;
          res.msg = `${r.name} ได้รับ Ping แล้ว แต่ไฟร์วอลล์ของ ${r.name} ไม่อนุญาตให้ตอบ ICMP (ปิดการตอบ Ping)`;
          return done();
        }
        // 3.1: TCP/UDP — is the service listening? (a closed port still answers: TCP RST / ICMP port unreachable)
        const closed = proto !== 'icmp' && !listens(r, fwd.dst, proto, fwd.dport, fwd.virtual);
        const back = forward(r, fwd.src, initTTL(r, fwd.virtual), fwd.prevIfc, { phase: 'reply', list: hops }, { src: fwd.dst, proto, sport: fwd.dport, dport: fwd.sport });
        collect(back, 'reply');
        if (!(back.kind === 'delivered' && back.dev === d)) {
          res.reason = 'timeout'; res.failHop = hops.length - 1;
          if (back.kind === 'delivered') {
            res.code = 'dup_ip'; res.stopAt = back.dev.id; res.failAt = back.dev.id;
            res.msg = `${r.name} ตอบกลับแล้ว แต่คำตอบไปถึง ${back.dev.name} ซึ่งใช้ IP ${ipStr(sip)} ซ้ำกับ ${d.name} (IP ซ้ำ) ${d.name} จึงไม่ได้รับคำตอบ`;
          } else {
            const ex = explainLeg(back, fwd.src, true);
            res.code = ex.code; res.stopAt = ex.stop; res.failAt = ex.stop;
            res.msg = `${r.name} ได้รับ${what}${what === 'Ping' ? '' : ' '}แล้วแต่ตอบกลับไม่ถึง ${d.name}: ${ex.msg}`;
          }
          return done();
        }
        for (let i = hops.length - 1; i >= 0; i--) if (isIpHop(hops[i])) { hops[i].final = true; break; }
        if (closed) {
          res.reason = 'timeout'; res.code = proto === 'tcp' ? 'refused' : 'port_unreachable'; res.stopAt = r.id; res.failAt = r.id; res.failHop = -1;
          const nm = fwd.virtual ? `${ipStr(fwd.dst)} บนอินเทอร์เน็ต` : r.name;
          res.msg = `${nm} ได้รับ${what} แล้ว แต่ไม่มีบริการเปิดที่พอร์ต ${fwd.dport} จึงตอบ${proto === 'tcp' ? 'ปฏิเสธ (TCP RST — Connection refused)' : ' ICMP Port unreachable'}` +
            (r.kind === 'router' && natRole(r) ? ` — ${r.name} ไม่มี Port forwarding (Static NAT) ของ ${PROTO_UP[proto]} พอร์ต ${fwd.dport} ไปยังเครื่องภายใน` : '');
          return done();
        }
        res.ok = true; res.reason = 'ok'; res.code = 'ok'; res.stopAt = d.id;
        if (proto === 'icmp') res.msg = fwd.virtual ? `${ipStr(dst)} บนอินเทอร์เน็ต (ผ่าน ${r.name}) ตอบกลับ (Echo Reply) ถึง ${d.name} สำเร็จ` : `${r.name} ตอบกลับ (Echo Reply) ถึง ${d.name} สำเร็จ`;
        else res.msg = `${fwd.virtual ? ipStr(fwd.dst) + ' บนอินเทอร์เน็ต' : r.name}${fwd.dst !== dst ? ` (${ipStr(dst)}:${port} ถูกส่งต่อเป็น ${ipStr(fwd.dst)}:${fwd.dport})` : ''} ตอบรับ${proto === 'tcp' ? 'การเชื่อมต่อ TCP (SYN → SYN-ACK)' : ' UDP'} พอร์ต ${fwd.dport} ถึง ${d.name} สำเร็จ`;
        // duplicate addresses: the reply may come from the wrong machine
        const exp = opts.expect !== undefined && opts.expect !== null ? devs.get(str(opts.expect)) : null;
        const dupDst = Array.from(new Set(ownersOf(dst).map(f => f.dev)));
        const dupSrc = Array.from(new Set(ownersOf(sip).map(f => f.dev)));
        if (exp && exp !== r && exp.ifs.some(f => f.eff.ip === dst)) {
          res.code = 'dup_ip'; res.wrongResponder = true; res.failAt = r.id; res.stopAt = r.id;
          res.msg = `IP ${ipStr(dst)} ซ้ำกัน: ${exp.name} กับ ${r.name} ใช้ IP เดียวกัน คำตอบจึงมาจาก ${r.name} ไม่ใช่ ${exp.name}`;
        } else if (dupDst.length > 1 || dupSrc.length > 1) {
          const arr = dupDst.length > 1 ? dupDst : dupSrc;
          res.warn = `IP ${ipStr(dupDst.length > 1 ? dst : sip)} ถูกใช้ซ้ำโดย ${arr.map(x => x.name).join(', ')} — ผลอาจมาจากเครื่องที่ไม่ได้ตั้งใจ`;
        }
        return done();
      } catch (e) {
        res.reason = 'timeout'; res.code = 'timeout'; res.msg = 'ระบบจำลองติดตามแพ็กเก็ตไม่ได้'; res.detail = 'internal: ' + (e && e.message);
        return done();
      }
    }

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
          leaseFrom: e.leaseFrom, os: d.os, type: d.type, name: d.name, power: !d.off });
      }
      const ifs = d.ifs.map(x => { const c = cfgOf(x); if (x.nat) c.nat = x.nat; return c; });
      const f = d.ifs.find(x => op(x) && x.eff.ip !== null) || d.ifs.find(x => x.eff.ip !== null) || d.ifs[0] || null;
      return Object.assign(cfgOf(f), { gateway: null, dns: [], dhcp: false, apipa: false, leaseFrom: null, os: d.os, type: d.type, name: d.name,
        up: d.kind === 'bridge' ? true : !!(f && f.up), ifaces: ifs, power: !d.off, hub: d.hub || undefined });
    }
    // 2.8: collision domains. A hub repeats to every port (one shared domain for all its links), a Wi-Fi radio is one
    // shared half-duplex medium per AP; every other active link (switch/router port, full duplex) is its own domain.
    function collisionDomains() {
      const act = topo.links.filter(l => { const s = linkState.get(l.id); return s && s.active && !s.blocked; });
      const key = new Map(); // link id -> group key
      const par = new Map();
      const root = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
      const join = (a, b) => { const ra = root(a), rb = root(b); if (ra !== rb) par.set(ra, rb); };
      act.forEach(l => { par.set(l.id, l.id); });
      const byShared = new Map();
      act.forEach(l => {
        [[l.a, devs.get(l.a.dev)], [l.b, devs.get(l.b.dev)]].forEach(([e, dv]) => {
          const shared = dv && ((dv.hub) || (dv.type === 'ap' && e.port === 'wifi')) ? dv.id + (dv.hub ? '' : '|wifi') : null;
          if (!shared) return;
          if (byShared.has(shared)) join(l.id, byShared.get(shared)); else byShared.set(shared, l.id);
        });
      });
      const groups = new Map();
      act.forEach(l => { const r = root(l.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(l); key.set(l.id, r); });
      const out = [];
      groups.forEach(ls => {
        const ids = new Set(); let via = null, kind = 'port';
        ls.forEach(l => {
          [devs.get(l.a.dev), devs.get(l.b.dev)].forEach((dv, i) => {
            const e = i ? l.b : l.a;
            if (dv.hub) { via = dv.id; kind = 'hub'; return; }
            if (dv.type === 'ap' && e.port === 'wifi') { via = dv.id; kind = 'wifi'; }
            ids.add(dv.id);
          });
        });
        out.push({ devs: Array.from(ids).sort(natCmp), via, kind, links: ls.map(l => l.id).sort(natCmp) });
      });
      return out.sort((a, b) => natCmp(a.links[0], b.links[0]));
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

    // 3.1: NAT translation table (show ip nat translations): static entries first, then flows seen by this instance
    function natTable(devId) {
      const d = devs.get(str(devId)); if (!d || !d.natc) return [];
      const rows = d.natc.statics.map(s => ({ type: 'static', proto: s.proto === 'ip' ? 'ip' : s.proto, insideGlobal: apS(s.global, s.gport), insideLocal: apS(s.local, s.lport), outsideLocal: null, outsideGlobal: null }));
      d.natT.flows.forEach(r => rows.push(Object.assign({}, r)));
      return rows;
    }
    // 3.1: interface ACLs as parsed (with the implicit deny made visible)
    function acls(devId) {
      const d = devs.get(str(devId)); if (!d || d.kind !== 'router') return [];
      return d.acl.list.map(a => ({ name: a.name, iface: a.ifName, dir: a.dir, applied: a.applied,
        rules: a.rules.map(r => ({ n: r.n, permit: !r.deny, text: r.text })), implicit: 'deny ip any any (implicit deny)' }));
    }

    const api = {
      topo, natTable, acls,
      _P: P,
      problems() { return P.list.map(p => Object.assign({}, p)); },
      config, ping, traceroute, nslookup, arp, routes, macTable, l2Domain, trace, collisionDomains,
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
    hub: () => `<rect x="-32" y="-13" width="64" height="26" rx="4" fill="var(--field)" ${S}/>` +
      [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${-26 + i * 6.6}" y="-1" width="4.4" height="5" rx="0.8" fill="var(--panel)" stroke="var(--muted)" stroke-width="0.8"/>`).join('') +
      `<text x="0" y="-4" text-anchor="middle" font-size="8.5" font-weight="700" fill="var(--ink)" font-family="inherit">HUB</text>` +
      `<circle cx="26" cy="7.5" r="1.6" fill="var(--orange)"/>`,
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
  const ICON_BOTTOM = { pc: 20, laptop: 13, server: 24, printer: 19, switch: 14, hub: 14, router: 22, ap: 17, internet: 14 };
  const RING = { pc: 30, laptop: 29, server: 30, printer: 28, switch: 38, hub: 38, router: 29, ap: 28, internet: 36 };

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
      const ik = d.hub ? 'hub' : d.type;
      const icon = (ICON[ik] || ICON.pc)();
      const lines = labelsOf(d);
      const by = (ICON_BOTTOM[ik] || 20) + 18;
      let g = `<g transform="translate(${r1(d.x)} ${r1(d.y)})" data-id="${esc(d.id)}"><title>${esc(d.name)}${d.power === false ? ' (ปิดเครื่อง)' : ''}</title>`;
      if (hl.has(d.id)) g += `<circle r="${RING[ik] || 30}" fill="none" stroke="var(--orange)" stroke-width="3.2" stroke-dasharray="none" opacity="0.95"/><circle r="${(RING[ik] || 30) + 4}" fill="none" stroke="var(--orange)" stroke-width="1.2" opacity="0.45"/>`;
      g += d.power === false ? `<g opacity="0.38">${icon}</g>` +
        `<g transform="translate(${(RING[ik] || 30) - 10} -18)"><circle r="9" fill="var(--panel)" stroke="var(--bad)" stroke-width="1.6"/><path d="M0 -5 V-0.5 M-3.4 -3.2 A4.6 4.6 0 1 0 3.4 -3.2" fill="none" stroke="var(--bad)" stroke-width="1.7" stroke-linecap="round"/></g>` : icon;
      g += `<text y="${by}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)" stroke="var(--panel)" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${esc(d.name)}</text>`;
      lines.forEach((s, i) => { g += `<text y="${by + 15 * (i + 1)}" text-anchor="middle" font-size="12" fill="var(--muted)" stroke="var(--panel)" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${esc(s)}</text>`; });
      g += '</g>';
      out.push(g);
    });
    out.push('</g></svg>');
    return out.join('');
  }

  // ------------------------------------------------------------------ 2.8: Final Network Capstone (mission t9)
  // Shared by the browser (live requirements checklist, fault injection) and the server grader (score + rubric).
  // evaluate(topo, { plan, report, fault }) never throws; everything is computed with the engine above.
  const CAP = {
    block: '172.16.10.0', blockPrefix: 24,
    isp: '100.64.0.1', wan: '100.64.0.2', wanPrefix: 30,
    publicName: 'www.netlab.test',
    areas: [
      { id: 'lab', th: 'ห้องปฏิบัติการคอมพิวเตอร์', short: 'ห้องแล็บ', hosts: 30, detail: 'PC นักเรียน 30 เครื่อง' },
      { id: 'teachers', th: 'ห้องพักครู', short: 'ห้องครู', hosts: 23, detail: 'PC ครู 12 เครื่อง + เครื่องพิมพ์ 1 เครื่อง + อุปกรณ์ Wi-Fi ของครู 10 เครื่อง' },
      { id: 'office', th: 'สำนักงาน', short: 'สำนักงาน', hosts: 9, detail: 'PC 8 เครื่อง + File server 1 เครื่อง' }
    ],
    WIFI_OK: ['WPA2', 'WPA3', 'WPA2/WPA3'],
    WEAK_KEYS: ['12345678', '123456789', '1234567890', '87654321', 'password', 'password1', 'qwertyui', '11111111', '00000000', 'abcdefgh', 'iloveyou', 'netlab123'],
    MAX: { devices: 4, cabling: 4, plan: 6, impl: 4, gwdns: 4, matrix: 6, security: 3, wifi: 4, fault: 3, report: 2 },
    TITLES: {
      devices: 'อุปกรณ์และการวางผัง', cabling: 'การต่อสาย', plan: 'แผนการแจก IP (VLSM)', impl: 'ตั้งค่า IP ตามแผน',
      gwdns: 'Default gateway และ DNS', matrix: 'ผลทดสอบการเชื่อมต่อ (Connectivity matrix)', security: 'มาตรการความปลอดภัย (Firewall)',
      wifi: 'ความปลอดภัย Wi-Fi', fault: 'แก้เหตุขัดข้องที่ระบบจำลอง', report: 'รายงานการออกแบบ'
    },
    REPORT_SECTIONS: [
      { id: 'design', title: '1) แนวคิดการออกแบบ', re: /แนวคิด|เหตุผล/ },
      { id: 'plan', title: '2) แผนการแจก IP', re: /แผน|แจก\s*IP|Subnet/i },
      { id: 'tests', title: '3) ผลการทดสอบ', re: /ทดสอบ/ },
      { id: 'fix', title: '4) การแก้ปัญหา', re: /แก้ปัญหา|แก้ไข|เหตุขัดข้อง/ }
    ]
  };
  CAP.areas.forEach(a => { a.prefix = needPrefix(a.hosts + 1); });
  // smallest prefix whose subnet holds n usable addresses
  function needPrefix(n) { let h = 2; while (Math.pow(2, h) - 2 < n) h++; return 32 - h; }
  function capPlanRow(row) {
    const o = { raw: row, net: null, prefix: null, gw: null };
    if (!isObj(row)) return o;
    let netS = str(row.net !== undefined ? row.net : row.network), p = row.prefix !== undefined ? row.prefix : row.mask;
    const k = netS.indexOf('/');
    if (k > 0 && (p === undefined || p === '' || p === null)) { p = netS.slice(k + 1); netS = netS.slice(0, k); }
    else if (k > 0) netS = netS.slice(0, k);
    o.net = parseIp(netS);
    o.prefix = toPrefix(typeof p === 'number' ? p : str(p));
    o.gw = parseIp(str(row.gateway !== undefined ? row.gateway : row.gw));
    return o;
  }
  function capPlan(plan) { const out = {}; CAP.areas.forEach(a => { out[a.id] = capPlanRow(isObj(plan) ? plan[a.id] : null); }); return out; }
  function rowUsable(r) { return r.net !== null && r.prefix !== null && r.prefix >= 8 && r.prefix <= 30; }

  // shared view of a built network for the capstone checks
  function capContext(topo, planIn) {
    const net = create(topo);
    const T = net.topo;
    const plan = capPlan(planIn);
    const byId = new Map(T.devices.map(d => [d.id, d]));
    const cfg = new Map();
    const config = id => { if (!cfg.has(id)) cfg.set(id, net.config(id)); return cfg.get(id); };
    const hosts = T.devices.filter(d => HOST[d.type]).sort((a, b) => natCmp(a.id, b.id));
    const areaOf = d => {
      const c = config(d.id); if (!c || !c.ip || c.apipa) return null;
      const ipn = parseIp(c.ip);
      // overlapping plans: the most specific (longest prefix) row wins
      const hit = CAP.areas.filter(a => { const r = plan[a.id]; return rowUsable(r) && inSub(ipn, r.net, r.prefix); }).sort((a, b) => plan[b.id].prefix - plan[a.id].prefix)[0];
      return hit ? hit.id : null;
    };
    const members = {}; CAP.areas.forEach(a => { members[a.id] = []; });
    hosts.forEach(d => { const a = areaOf(d); if (a) members[a].push(d); });
    const ofType = (list, t) => list.filter(d => d.type === t);
    const routers = T.devices.filter(d => d.type === 'router').sort((a, b) => natCmp(a.id, b.id));
    const router = routers.find(r => T.links.some(l => (l.a.dev === r.id && (byId.get(l.b.dev) || {}).type === 'internet') || (l.b.dev === r.id && (byId.get(l.a.dev) || {}).type === 'internet'))) || routers[0] || null;
    const problems = net.problems();
    const traceCache = new Map();
    const trace = (src, target) => { const k = src + '>' + target; if (!traceCache.has(k)) traceCache.set(k, net.trace(src, target)); return traceCache.get(k); };
    return { net, T, plan, byId, config, hosts, members, ofType, routers, router, problems, trace, areaOf };
  }
  const areaTh = id => (CAP.areas.find(a => a.id === id) || {}).short || id;
  function itemFrom(id, subs) {
    const max = CAP.MAX[id];
    const W = subs.reduce((s, x) => s + (x.w || 1), 0) || 1;
    const got = subs.reduce((s, x) => s + (x.w || 1) * (x.ok ? 1 : (x.part || 0)), 0);
    const raw = got / W;
    const score = raw >= 1 - 1e-9 ? max : Math.floor(raw * max * 2 + 1e-9) / 2;
    return { id, title: CAP.TITLES[id], score, max, checks: subs.map(x => ({ label: x.label, ok: !!x.ok, msg: x.ok ? '' : (x.msg || '') })) };
  }
  const repOf = (C, area, types) => { for (const t of types) { const d = C.members[area].filter(x => x.type === t)[0]; if (d) return d; } return null; };

  function capDevices(C) {
    const sw = C.T.devices.filter(d => d.type === 'switch' && !d.hub);
    const hubs = C.T.devices.filter(d => d.type === 'switch' && d.hub);
    const M = C.members, n = (a, t) => C.ofType(M[a], t).length;
    const fileSrv = M.office.filter(d => d.type === 'server' && d.services && d.services.file === true);
    return itemFrom('devices', [
      { label: 'มี Router 1 ตัวเป็นจุดเชื่อมทุกห้องกับอินเทอร์เน็ต', ok: C.routers.length >= 1, msg: 'ยังไม่มี Router (ต้องใช้ Router เชื่อมแต่ละห้องซึ่งเป็นคนละวงเครือข่าย และออกอินเทอร์เน็ต)' },
      { label: 'ใช้ Switch แยกห้องละตัว (อย่างน้อย 3 ตัว)', ok: sw.length >= 3, part: Math.min(sw.length, 3) / 3,
        msg: `มี Switch ${sw.length} ตัว ต้องมีอย่างน้อย 3 ตัว (ห้องละ 1 ตัว)${hubs.length ? ' — Hub ไม่นับ เพราะ Hub ส่งเฟรมไปทุกพอร์ตและทุกเครื่องแย่งกันใช้สาย (collision domain เดียว) ไม่เหมาะกับเครือข่ายจริงในปัจจุบัน' : ''}` },
      { label: 'มี Access Point สำหรับ Wi-Fi ของครู', ok: C.T.devices.some(d => d.type === 'ap'), msg: 'ยังไม่มี Access Point' },
      { label: 'มีการเชื่อมต่ออินเทอร์เน็ต (ISP) 1 จุด', w: 0.5, ok: C.T.devices.some(d => d.type === 'internet'), msg: 'ไม่พบอุปกรณ์ ISP/Internet (กด "เริ่มภารกิจใหม่" เพื่อเอาคืน)' },
      { label: 'ห้องแล็บ: วาง PC ตัวแทนอย่างน้อย 2 เครื่องในวงของห้องแล็บ', ok: n('lab', 'pc') >= 2, part: Math.min(n('lab', 'pc'), 2) / 2,
        msg: `พบ PC ในวงของห้องแล็บ ${n('lab', 'pc')} เครื่อง (ต้องมีอย่างน้อย 2 เครื่องและ IP ต้องอยู่ในวงตามแผน)` },
      { label: 'ห้องครู: PC 2 เครื่อง + เครื่องพิมพ์ + Laptop ครู (Wi-Fi)', ok: n('teachers', 'pc') >= 2 && n('teachers', 'printer') >= 1 && n('teachers', 'laptop') >= 1,
        part: (Math.min(n('teachers', 'pc'), 2) / 2 + Math.min(n('teachers', 'printer'), 1) + Math.min(n('teachers', 'laptop'), 1)) / 3,
        msg: `ในวงของห้องครูพบ PC ${n('teachers', 'pc')}, Printer ${n('teachers', 'printer')}, Laptop ${n('teachers', 'laptop')} (ต้องมี PC ≥ 2, Printer ≥ 1, Laptop ที่ต่อ Wi-Fi ≥ 1)` },
      { label: 'สำนักงาน: PC 2 เครื่อง + File server', ok: n('office', 'pc') >= 2 && fileSrv.length >= 1,
        part: (Math.min(n('office', 'pc'), 2) / 2 + (fileSrv.length ? 1 : n('office', 'server') ? 0.5 : 0)) / 2,
        msg: `ในวงของสำนักงานพบ PC ${n('office', 'pc')} เครื่อง, Server ${n('office', 'server')} เครื่อง${n('office', 'server') && !fileSrv.length ? ' (Server ยังไม่ได้เปิดบริการแชร์ไฟล์ File server)' : ''}` }
    ]);
  }

  function capCabling(C) {
    const net = C.net, R = C.router;
    const unl = C.hosts.filter(h => { const c = C.config(h.id); return !(c && c.linked); });
    const subs = [{ label: 'ทุกเครื่องต่อสาย/เชื่อม Wi-Fi และใช้งานได้', w: 1.5, ok: C.hosts.length > 0 && !unl.length, part: C.hosts.length ? 1 - unl.length / C.hosts.length : 0,
      msg: C.hosts.length ? `${unl.slice(0, 4).map(h => h.name).join(', ')}${unl.length > 4 ? ' …' : ''} ยังไม่ได้ต่อสาย หรือสาย/Wi-Fi ใช้งานไม่ได้` : 'ยังไม่มีเครื่องลูกข่าย' }];
    let toR = 0, tot = 0; const miss = [];
    CAP.areas.forEach(a => C.members[a.id].forEach(h => { tot++; if (R && net.l2Domain(h.id).includes(R.id)) toR++; else miss.push(h.name); }));
    subs.push({ label: 'ทุกห้องต่อถึง Router ผ่าน Switch ของห้อง', w: 1.5, ok: tot > 0 && toR === tot, part: tot ? toR / tot : 0,
      msg: !R ? 'ยังไม่มี Router' : tot ? `${miss.slice(0, 4).join(', ')} ต่อไม่ถึง Router (ตรวจสายระหว่าง Switch ของห้องกับ Router)` : 'ยังไม่มีเครื่องที่อยู่ในวงตามแผน IP' });
    const mixed = [];
    CAP.areas.forEach((a, i) => CAP.areas.slice(i + 1).forEach(b => {
      const A = C.members[a.id][0], B = C.members[b.id];
      if (A && B.some(x => net.l2Domain(A.id).includes(x.id))) mixed.push(`${a.short}–${b.short}`);
    }));
    const allIn = CAP.areas.every(a => C.members[a.id].length);
    subs.push({ label: 'แต่ละห้องเป็น Broadcast domain แยกกัน (ไม่ต่อ Switch ของสองห้องถึงกันโดยตรง)', ok: allIn && !mixed.length,
      msg: mixed.length ? `${mixed.join(', ')} อยู่ใน Broadcast domain เดียวกัน (Switch ของสองห้องต่อถึงกันโดยไม่ผ่าน Router) ทำให้ Broadcast ข้ามห้องและแยกนโยบายความปลอดภัยไม่ได้` : 'ยังตรวจไม่ได้ ต้องมีเครื่องในทุกห้องก่อน' });
    const aps = C.T.devices.filter(d => d.type === 'ap');
    const apOk = aps.some(ap => C.members.teachers.filter(h => h.type !== 'laptop').some(h => wiredSameDomain(C, ap, h)));
    subs.push({ label: 'Access Point ต่อสายเข้า Switch ของห้องครู', w: 0.5, ok: apOk, msg: aps.length ? 'Access Point ยังไม่ได้ต่อสาย UTP เข้า Switch ของห้องครู (เครื่อง Wi-Fi จะอยู่คนละวงกับห้องครู)' : 'ยังไม่มี Access Point' });
    const wanL = R && C.T.links.find(l => (l.a.dev === R.id && (C.byId.get(l.b.dev) || {}).type === 'internet') || (l.b.dev === R.id && (C.byId.get(l.a.dev) || {}).type === 'internet'));
    subs.push({ label: 'Router ต่อสายกับ ISP (ขา WAN)', w: 0.5, ok: !!wanL && (net.linkState(wanL.id) || {}).active, msg: R ? `${R.name} ยังไม่ได้ต่อสายที่ใช้งานได้ไปยัง ISP` : 'ยังไม่มี Router' });
    return itemFrom('cabling', subs);
  }
  // AP and a wired host of the teachers' room share the same switch fabric (AP wired side)
  function wiredSameDomain(C, ap, h) {
    const T = C.T, net = C.net;
    const seen = new Set([ap.id]), q = [ap.id];
    while (q.length) {
      const x = q.shift();
      for (const l of T.links) {
        if (l.medium === 'wifi') continue;
        const st = net.linkState(l.id); if (!st || !st.active) continue;
        const o = l.a.dev === x ? l.b.dev : l.b.dev === x ? l.a.dev : null;
        if (!o || seen.has(o)) continue;
        if (o === h.id) return true;
        const od = C.byId.get(o);
        if (od && (od.type === 'switch' || od.type === 'ap')) { seen.add(o); q.push(o); }
      }
    }
    return false;
  }

  function capPlanCheck(C) {
    const subs = [];
    const blk = parseIp(CAP.block);
    CAP.areas.forEach(a => {
      const r = C.plan[a.id];
      const nm = `${a.short} (${a.hosts} เครื่อง + Gateway = ${a.hosts + 1} IP)`;
      if (r.net === null || r.prefix === null) { subs.push({ label: `${nm}: กรอก Network/Prefix`, w: 4, ok: false, msg: `แผน IP ของ${a.short} ยังไม่ครบ (ต้องกรอก Network address และ Prefix เช่น 172.16.10.0 /26)` }); return; }
      const label = `${a.short}: ${ipStr(r.net)}/${r.prefix}`;
      const aligned = netInt(r.net, r.prefix) === r.net;
      subs.push({ label: `${label} เป็น Network address ที่ถูกต้อง`, ok: aligned, msg: `${ipStr(r.net)} ไม่ใช่ Network address ของ /${r.prefix} (ควรเป็น ${ipStr(netInt(r.net, r.prefix))}) — Subnet ต้องเริ่มที่ผลคูณของขนาดบล็อก ${Math.pow(2, 32 - r.prefix)}` });
      const inBlk = r.prefix >= CAP.blockPrefix && inSub(r.net, blk, CAP.blockPrefix);
      subs.push({ label: `${label} อยู่ในบล็อก ${CAP.block}/${CAP.blockPrefix}`, ok: inBlk, msg: `วงของ${a.short} (${ipStr(r.net)}/${r.prefix}) อยู่นอกบล็อกที่ได้รับ ${CAP.block}/${CAP.blockPrefix}` });
      const cap = hostsInPrefix(r.prefix);
      const fits = cap >= a.hosts + 1;
      subs.push({ label: `${label} รองรับ ${a.hosts + 1} IP ได้`, ok: fits, msg: `/${r.prefix} ใช้ได้ ${cap} IP ไม่พอสำหรับ${a.short}ที่ต้องการ ${a.hosts + 1} IP (รวม Gateway)` });
      subs.push({ label: `${label} ขนาดพอดีตามหลัก VLSM`, ok: fits && r.prefix === a.prefix, part: fits ? 0.5 : 0,
        msg: fits ? `${a.short} ใช้ /${r.prefix} (${cap} IP) ใหญ่เกินความจำเป็น ควรเลือก prefix ที่เล็กที่สุดที่ยังพอ เพื่อเหลือ IP ไว้ใช้วงอื่น` : `${a.short} ต้องการ ${a.hosts + 1} IP` });
      const gwOk = r.gw !== null && inSub(r.gw, r.net, r.prefix) && r.gw !== netInt(r.net, r.prefix) && r.gw !== bcastInt(r.net, r.prefix);
      subs.push({ label: `${label} Gateway เป็น IP ที่ใช้ได้ในวง`, ok: gwOk, msg: r.gw === null ? `ยังไม่ได้กรอก Gateway ของ${a.short}` : `Gateway ${ipStr(r.gw)} ของ${a.short} ไม่ใช่ IP ที่ใช้ได้ในวง ${ipStr(netInt(r.net, r.prefix))}/${r.prefix}` });
    });
    const rows = CAP.areas.map(a => [a, C.plan[a.id]]).filter(([, r]) => rowUsable(r));
    const ov = [];
    rows.forEach(([a, r], i) => rows.slice(i + 1).forEach(([b, s]) => { const p = Math.min(r.prefix, s.prefix); if (inSub(r.net, s.net, p)) ov.push(`${a.short} กับ ${b.short}`); }));
    subs.push({ label: 'Subnet ของแต่ละห้องไม่ซ้อนทับกัน', w: 3, ok: rows.length === CAP.areas.length && !ov.length,
      msg: ov.length ? `วงของ ${ov.join(', ')} ซ้อนทับกัน (IP ช่วงเดียวกันถูกใช้สองห้อง Router จะไม่รู้ว่าจะส่งไปห้องไหน)` : 'กรอกแผน IP ให้ครบทุกห้องก่อน' });
    return itemFrom('plan', subs);
  }
  function hostsInPrefix(p) { return p >= 31 ? 0 : Math.pow(2, 32 - p) - 2; }

  function capImpl(C) {
    const subs = [];
    const R = C.router;
    const rc = R ? C.config(R.id) : null;
    CAP.areas.forEach(a => {
      const r = C.plan[a.id];
      if (!rowUsable(r) || r.gw === null) { subs.push({ label: `Router มีขาของ${a.short}ตามแผน`, ok: false, msg: `กรอกแผน IP และ Gateway ของ${a.short}ก่อน` }); return; }
      const f = rc && (rc.ifaces || []).find(x => x.ip === ipStr(r.gw));
      subs.push({ label: `Router มีขา ${ipStr(r.gw)}/${r.prefix} ของ${a.short}`, ok: !!f && f.prefix === r.prefix && f.up && f.linked,
        msg: !R ? 'ยังไม่มี Router' : !f ? `${R.name} ยังไม่มีขาที่ตั้ง IP ${ipStr(r.gw)} (Gateway ของ${a.short}ตามแผน)` : f.prefix !== r.prefix ? `ขา ${f.iface} ของ ${R.name} ใช้ /${f.prefix} ไม่ตรงกับแผน /${r.prefix}` : `ขา ${f.iface} ของ ${R.name} ยังไม่ได้ต่อสายหรือถูกปิด` });
    });
    let ok = 0, tot = 0; const bad = [];
    C.hosts.forEach(h => {
      const c = C.config(h.id); if (!c || !c.ip) return;
      tot++;
      const a = C.areaOf(h);
      const r = a ? C.plan[a] : null;
      if (r && c.prefix === r.prefix) ok++;
      else bad.push(a ? `${h.name} ใช้ Subnet mask /${c.prefix} ไม่ตรงกับแผน /${r.prefix} ของ${areaTh(a)}` : `${h.name} (${c.ip}${c.apipa ? ' APIPA' : ''}) ไม่อยู่ในวงใดตามแผน IP`);
    });
    subs.push({ label: 'ทุกเครื่องใช้ IP และ Subnet mask ตามแผนของห้องตัวเอง', w: 2, ok: tot > 0 && ok === tot, part: tot ? ok / tot : 0, msg: bad.slice(0, 3).join(' • ') || 'ยังไม่มีเครื่องที่ตั้ง IP' });
    const dup = C.problems.filter(p => p.code === 'dup_ip');
    const err = C.problems.filter(p => p.level === 'error' && p.code !== 'wifi_auth' && p.code !== 'ssid_mismatch');
    subs.push({ label: 'ไม่มี IP ซ้ำและไม่มีข้อผิดพลาดการตั้งค่า', ok: tot > 0 && !dup.length && !err.length, msg: (dup[0] || err[0] || {}).msg || 'ยังไม่มีเครื่องที่ตั้ง IP' });
    const wf = rc && (rc.ifaces || []).find(x => x.ip === CAP.wan);
    const def = R ? C.net.routes(R.id).find(x => x.prefix === 0) : null;
    subs.push({ label: `ขา WAN ${CAP.wan}/${CAP.wanPrefix} และ Default route ไปยัง ISP ${CAP.isp}`, ok: !!wf && wf.prefix === CAP.wanPrefix && !!def && def.via === CAP.isp,
      part: (wf ? 0.5 : 0) + (def && def.via === CAP.isp ? 0.5 : 0),
      msg: !R ? 'ยังไม่มี Router' : !wf ? `${R.name} ยังไม่มีขา WAN ที่ตั้ง IP ${CAP.wan}/${CAP.wanPrefix} (ISP ใช้ ${CAP.isp})` : `${R.name} ยังไม่มี Default route 0.0.0.0/0 ที่มี Next hop เป็น ${CAP.isp}` });
    return itemFrom('impl', subs);
  }

  function capGwDns(C) {
    let gOk = 0, gTot = 0; const gBad = [];
    let dOk = 0, dTot = 0; const dBad = [];
    CAP.areas.forEach(a => {
      const r = C.plan[a.id];
      C.members[a.id].forEach(h => {
        const c = C.config(h.id);
        gTot++;
        if (r.gw !== null && c.gateway === ipStr(r.gw)) gOk++;
        else gBad.push(c.gateway ? `Default gateway ของ ${h.name} คือ ${c.gateway} ไม่ใช่ Gateway ของ${a.short}` : `${h.name} ยังไม่ได้ตั้ง Default gateway`);
        if (h.type === 'printer') return;
        dTot++;
        const rs = C.net.resolve(h.id, CAP.publicName);
        if (rs.ok) dOk++;
        else dBad.push(c.dns && c.dns.length ? `${h.name} แปลงชื่อ ${CAP.publicName} ไม่ได้ (${REASON_TEXT[rs.reason] || rs.reason})` : `${h.name} ยังไม่ได้ตั้ง DNS server`);
      });
    });
    return itemFrom('gwdns', [
      { label: 'ทุกเครื่องตั้ง Default gateway เป็นขา Router ของห้องตัวเอง', w: 2, ok: gTot > 0 && gOk === gTot, part: gTot ? gOk / gTot : 0, msg: gBad.slice(0, 3).join(' • ') || 'ยังไม่มีเครื่องในวงตามแผน' },
      { label: `ทุกเครื่อง (ยกเว้นเครื่องพิมพ์) ตั้ง DNS และแปลงชื่อ ${CAP.publicName} ได้`, w: 2, ok: dTot > 0 && dOk === dTot, part: dTot ? dOk / dTot : 0, msg: dBad.slice(0, 3).join(' • ') || 'ยังไม่มีเครื่องในวงตามแผน' }
    ]);
  }

  // matrix cells: required (must work) and policy (must be blocked)
  function capMatrix(C) {
    const M = C.members;
    const srcs = (area, types) => M[area].filter(d => types.includes(d.type)).slice(0, 6);
    const rep = (area, types) => repOf(C, area, types);
    const ipOf = d => d ? C.config(d.id).ip : null;
    const fileSrv = M.office.find(d => d.type === 'server') || null;
    const pcT = ['pc'], anyT = ['pc', 'laptop', 'server'];
    const defs = [
      { id: 'lab-teachers', from: 'lab', to: 'teachers', src: srcs('lab', pcT), dst: rep('teachers', pcT), want: true },
      { id: 'lab-office', from: 'lab', to: 'office', src: srcs('lab', pcT), dst: fileSrv, want: false },
      { id: 'lab-internet', from: 'lab', to: 'internet', src: srcs('lab', pcT), target: '8.8.8.8', want: true },
      { id: 'lab-dns', from: 'lab', to: 'dns', src: srcs('lab', pcT), target: CAP.publicName, want: true },
      { id: 'teachers-lab', from: 'teachers', to: 'lab', src: srcs('teachers', pcT), dst: rep('lab', pcT), want: true },
      { id: 'teachers-office', from: 'teachers', to: 'office', src: srcs('teachers', pcT), dst: fileSrv, want: true },
      { id: 'teachers-printer', from: 'teachers', to: 'printer', src: srcs('teachers', pcT), dst: rep('teachers', ['printer']), want: true },
      { id: 'teachers-internet', from: 'teachers', to: 'internet', src: srcs('teachers', pcT), target: '8.8.8.8', want: true },
      { id: 'teachers-dns', from: 'teachers', to: 'dns', src: srcs('teachers', pcT), target: CAP.publicName, want: true },
      { id: 'wifi-office', from: 'wifi', to: 'office', src: srcs('teachers', ['laptop']), dst: fileSrv, want: true },
      { id: 'wifi-internet', from: 'wifi', to: 'internet', src: srcs('teachers', ['laptop']), target: '8.8.8.8', want: true },
      { id: 'office-teachers', from: 'office', to: 'teachers', src: srcs('office', anyT), dst: rep('teachers', pcT), want: true },
      { id: 'office-lab', from: 'office', to: 'lab', src: srcs('office', pcT), dst: rep('lab', pcT), want: false },
      { id: 'office-internet', from: 'office', to: 'internet', src: srcs('office', anyT), target: '8.8.8.8', want: true },
      { id: 'office-dns', from: 'office', to: 'dns', src: srcs('office', anyT), target: CAP.publicName, want: true }
    ];
    return defs.map(c => {
      const target = c.target || ipOf(c.dst);
      const cell = { id: c.id, from: c.from, to: c.to, want: c.want, target: target || null, tests: [], ok: false, pass: false, blocked: false };
      if (!c.src.length || !target) { cell.msg = !c.src.length ? `ยังไม่มีเครื่องต้นทางใน${c.from === 'wifi' ? 'เครื่อง Wi-Fi ของห้องครู' : areaTh(c.from)}` : 'ยังไม่มีเครื่องปลายทาง (หรือปลายทางยังไม่มี IP)'; return cell; }
      c.src.forEach(s => {
        const t = C.trace(s.id, target);
        cell.tests.push({ src: s.id, srcName: s.name, ok: t.ok && t.code === 'ok', code: t.code, title: t.title, msg: t.msg, stopAt: t.stopAt });
      });
      cell.ok = cell.tests.every(t => t.ok);
      cell.blocked = cell.tests.every(t => !t.ok && /^(reply_)?blocked$/.test(t.code));
      cell.pass = c.want ? cell.ok : cell.blocked;
      const bad = cell.tests.find(t => c.want ? !t.ok : !(!t.ok && /blocked/.test(t.code)));
      if (bad) cell.msg = c.want ? `${bad.srcName} → ${c.target || (c.dst && c.dst.name)}: ${bad.title} — ${bad.msg}` :
        bad.ok ? `${bad.srcName} → ${c.target || (c.dst && c.dst.name)} ยังติดต่อได้ (นโยบายกำหนดให้ห้องแล็บกับสำนักงานติดต่อกันไม่ได้)` : `${bad.srcName} → ${c.dst ? c.dst.name : target} ล้มเหลวเพราะ "${bad.title}" ไม่ใช่เพราะกฎไฟร์วอลล์`;
      return cell;
    });
  }
  const CELL_TH = { teachers: 'ห้องครู', lab: 'ห้องแล็บ', office: 'สำนักงาน', internet: 'อินเทอร์เน็ต (8.8.8.8)', dns: 'ชื่อเว็บ www.netlab.test', printer: 'เครื่องพิมพ์', wifi: 'Wi-Fi ครู' };
  function capMatrixItem(cells) {
    const req = cells.filter(c => c.want);
    return itemFrom('matrix', req.map(c => ({ label: `${CELL_TH[c.from]} → ${CELL_TH[c.to]}`, ok: c.pass, msg: c.msg || '' })));
  }
  function capSecurity(C, cells) {
    const lo = cells.find(c => c.id === 'lab-office'), ol = cells.find(c => c.id === 'office-lab');
    const R = C.router;
    const rules = R && Array.isArray(R.filters) ? R.filters.filter(r => /deny/i.test(str(r.action))) : [];
    return itemFrom('security', [
      { label: 'มีกฎไฟร์วอลล์ (deny) บน Router', w: 0.5, ok: rules.length > 0, msg: R ? `${R.name} ยังไม่มีกฎไฟร์วอลล์แบบ deny` : 'ยังไม่มี Router' },
      { label: 'ห้องแล็บเข้าถึงสำนักงาน (File server) ไม่ได้ เพราะกฎไฟร์วอลล์', w: 1.5, ok: lo.pass, msg: lo.msg || 'ยังทดสอบไม่ได้' },
      { label: 'สำนักงานติดต่อห้องแล็บไม่ได้ (แยกกันทั้งสองทาง)', ok: ol.pass, msg: ol.msg || 'ยังทดสอบไม่ได้' }
    ]);
  }
  function capWifi(C) {
    const aps = C.T.devices.filter(d => d.type === 'ap');
    const ap = aps.find(a => C.T.links.some(l => l.medium === 'wifi' && (l.a.dev === a.id || l.b.dev === a.id))) || aps[0] || null;
    const sec = ap ? str(ap.security) : '';
    const key = ap ? String(ap.passphrase || '') : '';
    const weak = CAP.WEAK_KEYS.includes(key.toLowerCase()) || /^(.)\1+$/.test(key) || (ap && key && key.toLowerCase() === str(ap.ssid).toLowerCase());
    const lts = C.members.teachers.filter(d => d.type === 'laptop');
    const ltOk = lts.filter(l => { const c = C.config(l.id); return c && c.linked && C.T.links.some(k => k.medium === 'wifi' && (k.a.dev === l.id || k.b.dev === l.id)); });
    const laps = C.T.devices.filter(d => d.type === 'laptop');
    return itemFrom('wifi', [
      { label: 'ตั้ง SSID ของ Wi-Fi ครู', ok: !!ap && !!str(ap.ssid), msg: ap ? 'ยังไม่ได้ตั้ง SSID' : 'ยังไม่มี Access Point' },
      { label: 'เข้ารหัสแบบ WPA2 หรือ WPA3 (ไม่ใช่ Open)', ok: CAP.WIFI_OK.includes(sec), msg: ap ? `การเข้ารหัส "${sec || 'Open'}" ไม่ปลอดภัยพอ ต้องใช้ WPA2-Personal ขึ้นไป (แนะนำ WPA3)` : 'ยังไม่มี Access Point' },
      { label: 'รหัสผ่าน Wi-Fi ยาวอย่างน้อย 8 ตัว และไม่เดาง่าย', ok: !!ap && key.length >= 8 && key.length <= 63 && !weak, part: key.length >= 8 ? 0.5 : 0,
        msg: !ap ? 'ยังไม่มี Access Point' : !key ? 'ยังไม่ได้ตั้งรหัสผ่าน Wi-Fi (Pre-shared key)' : key.length < 8 ? 'รหัสผ่าน WPA2/WPA3-Personal ต้องยาว 8–63 ตัวอักษร' : key.length > 63 ? 'รหัสผ่านยาวเกิน 63 ตัวอักษร' : 'รหัสผ่านนี้เดาง่าย (ตัวเลขเรียง คำทั่วไป หรือเหมือน SSID) ควรยาว 12 ตัวขึ้นไปและผสมตัวอักษร/ตัวเลข' },
      { label: 'Laptop ครูเชื่อม Wi-Fi ด้วยรหัสผ่านที่ถูกต้องและได้ IP ในวงห้องครู', ok: ltOk.length > 0, part: lts.length ? 0.5 : 0,
        msg: !laps.length ? 'ยังไม่มี Laptop' : !lts.length ? 'Laptop ยังไม่ได้ IP ในวงของห้องครูตามแผน' : 'Laptop ยังเชื่อม Wi-Fi ไม่สำเร็จ (ตรวจ SSID และรหัสผ่าน)' }
    ]);
  }

  // ---- fault injection (deterministic from the first successful build)
  function capCanon(topo) {
    const T = create(topo).topo;
    return T.devices.map(d => [d.id, d.type, (d.ifaces || []).map(f => f.ip + '/' + f.prefix).join(','), d.gateway || ''].join('|')).sort().join(';') + '#' + T.links.map(l => l.id).sort().join(',');
  }
  function capFaultCandidates(topo, planIn) {
    const C = capContext(topo, planIn);
    const pcs = [];
    CAP.areas.forEach(a => C.members[a.id].filter(d => d.type === 'pc').forEach(d => pcs.push(d)));
    pcs.sort((a, b) => natCmp(a.id, b.id));
    const stat = pcs.filter(d => !d.dhcp);
    const out = { wrong_gateway: stat.filter(d => d.gateway).map(d => ({ kind: 'wrong_gateway', dev: d.id })),
      wrong_mask: stat.map(d => ({ kind: 'wrong_mask', dev: d.id })),
      unplugged: [], power_off: [] };
    pcs.forEach(d => { const l = C.T.links.find(k => k.medium !== 'wifi' && (k.a.dev === d.id || k.b.dev === d.id)); if (l) out.unplugged.push({ kind: 'unplugged', dev: d.id, link: l.id }); });
    C.T.devices.filter(d => d.type === 'switch' && !d.hub).sort((a, b) => natCmp(a.id, b.id)).forEach(sw => {
      const area = CAP.areas.find(a => C.members[a.id].some(h => C.T.links.some(l => (l.a.dev === sw.id && l.b.dev === h.id) || (l.b.dev === sw.id && l.a.dev === h.id))));
      if (area) out.power_off.push({ kind: 'power_off', dev: sw.id, area: area.id });
    });
    return out;
  }
  function capPickFault(topo, planIn) {
    const cand = capFaultCandidates(topo, planIn);
    const kinds = ['wrong_gateway', 'wrong_mask', 'unplugged', 'power_off'].filter(k => cand[k].length);
    if (!kinds.length) return null;
    const h = hashStr(capCanon(topo));
    const k = kinds[h % kinds.length];
    const list = cand[k];
    return Object.assign({}, list[(h >>> 8) % list.length]);
  }
  // returns { topo, fault (with value/symptom) } — the faulted copy of topo
  function capApplyFault(topo, f, planIn) {
    const t = clone(topo) || { devices: [], links: [] };
    const d = (t.devices || []).find(x => x && x.id === f.dev);
    const out = Object.assign({}, f);
    if (!d) return { topo: t, fault: out };
    const C = capContext(topo, planIn);
    const area = C.areaOf(C.byId.get(d.id) || {}) || f.area || null;
    const where = area ? areaTh(area) : '';
    if (f.kind === 'wrong_gateway') {
      const c = C.config(d.id);
      const n = parseIp(c.ip), p = c.prefix;
      const used = new Set(); C.T.devices.forEach(x => (x.ifaces || []).forEach(i => { const v = parseIp(i.ip); if (v !== null) used.add(v); }));
      let g = bcastInt(n, p) - 1; while (used.has(g) && g > netInt(n, p) + 1) g--;
      out.value = ipStr(g); out.was = d.gateway; d.gateway = out.value;
      out.symptom = `${d.name} (${where}) แจ้งว่า "เข้าอินเทอร์เน็ตไม่ได้ และเปิดเครื่องของห้องอื่นไม่ได้ แต่คุยกับเครื่องในห้องเดียวกันได้"`;
    } else if (f.kind === 'wrong_mask') {
      const ifc = (d.ifaces || [])[0] || {};
      const p = toPrefix(typeof ifc.prefix === 'number' ? ifc.prefix : str(ifc.prefix));
      out.was = p; out.value = p !== null && p > 24 ? 24 : Math.min(30, (p || 24) + 4);
      ifc.prefix = out.value;
      out.symptom = `${d.name} (${where}) แจ้งว่า "ติดต่อเครื่องในห้องอื่นไม่ได้ ทั้งที่เมื่อวานยังใช้ได้"`;
    } else if (f.kind === 'unplugged') {
      const l = (t.links || []).find(x => x && x.id === f.link);
      if (l) l.up = false;
      out.symptom = `${d.name} (${where}) แจ้งว่า "ใช้งานเครือข่ายไม่ได้เลย ไอคอนเครือข่ายขึ้นกากบาท"`;
    } else if (f.kind === 'power_off') {
      d.power = false;
      out.symptom = `ทุกเครื่องใน${where || 'ห้องหนึ่ง'}แจ้งว่า "ใช้งานเครือข่ายไม่ได้พร้อมกันทั้งห้อง" (เครื่องอื่นห้องอื่นใช้ได้ปกติ)`;
    }
    return { topo: t, fault: out };
  }
  // is fault f (computed from baseline) repaired in C (the final network)?
  function capFaultFixed(C, f, base) {
    const d = C.byId.get(f.dev);
    const nameOf = id => { const x = base && base.byId.get(id); return x ? x.name : id; };
    if (!d) return { ok: false, msg: `ไม่พบ ${nameOf(f.dev)} ในแผนผังสุดท้าย (การลบอุปกรณ์ที่มีปัญหาไม่ใช่การแก้ปัญหา)` };
    const reach = (x) => { const t = C.trace(x.id, '8.8.8.8'); return t.ok && t.code === 'ok'; };
    if (f.kind === 'wrong_gateway') {
      const c = C.config(d.id), a = C.areaOf(d), r = a ? C.plan[a] : null;
      if (!r || r.gw === null || c.gateway !== ipStr(r.gw)) return { ok: false, msg: `${d.name} ยังใช้งานไม่ได้ตามปกติ — ตรวจค่า IP ของเครื่องนี้ทีละช่อง` };
      return reach(d) ? { ok: true } : { ok: false, msg: `${d.name} ยังออกอินเทอร์เน็ตไม่ได้` };
    }
    if (f.kind === 'wrong_mask') {
      const c = C.config(d.id), a = C.areaOf(d), r = a ? C.plan[a] : null;
      if (!r || c.prefix !== r.prefix) return { ok: false, msg: `${d.name} ยังติดต่อห้องอื่นไม่ได้ — ตรวจค่า IP ของเครื่องนี้ทีละช่องเทียบกับแผน` };
      return { ok: true };
    }
    if (f.kind === 'unplugged') {
      const c = C.config(d.id);
      if (!c || !c.linked) return { ok: false, msg: `${d.name} ยังไม่มีการเชื่อมต่อ (ดูสถานะสายของเครื่องนี้)` };
      return reach(d) ? { ok: true } : { ok: false, msg: `${d.name} ต่อสายแล้วแต่ยังออกอินเทอร์เน็ตไม่ได้` };
    }
    if (f.kind === 'power_off') {
      if (d.power === false) return { ok: false, msg: `เครื่องใน${f.area ? areaTh(f.area) : 'ห้องที่แจ้งปัญหา'}ยังใช้งานไม่ได้ทั้งห้อง — ตรวจอุปกรณ์ที่ทุกเครื่องในห้องใช้ร่วมกัน` };
      const hs = f.area ? C.members[f.area] : [];
      return hs.length && hs.filter(h => h.type !== 'printer').every(reach) ? { ok: true } : { ok: false, msg: `บางเครื่องใน${areaTh(f.area)}ยังออกอินเทอร์เน็ตไม่ได้` };
    }
    return { ok: false, msg: 'ไม่รู้จักชนิดเหตุขัดข้อง' };
  }
  const FAULT_TH = { wrong_gateway: 'Default gateway ผิด', wrong_mask: 'Subnet mask ผิด', unplugged: 'สายหลุด/ถูกถอด', power_off: 'อุปกรณ์ปิดอยู่ (Power off)' };

  function capReport(text) {
    const s = typeof text === 'string' ? text.slice(0, 6000) : '';
    const lines = s.split(/\r?\n/);
    // heading line: optional #, a number 1-4 with ) or . , then text
    const heads = [];
    lines.forEach((ln, i) => { const m = /^\s*#*\s*([1-4])\s*[).:]/.exec(ln); if (m) heads.push({ i, n: +m[1], text: ln }); });
    const subs = [];
    let okN = 0;
    CAP.REPORT_SECTIONS.forEach((sec, k) => {
      const h = heads.find(x => x.n === k + 1 && sec.re.test(x.text)) || heads.find(x => x.n === k + 1);
      let body = '';
      if (h) { const nx = heads.find(x => x.i > h.i); body = lines.slice(h.i + 1, nx ? nx.i : lines.length).join(' ').replace(/\s+/g, ' ').trim(); }
      const len = body.replace(/\s/g, '').length;
      let ok = !!h && len >= 40;
      let msg = !h ? `ไม่พบหัวข้อ "${sec.title}"` : `หัวข้อ "${sec.title}" ยังสั้นเกินไป (${len} ตัวอักษร ควรเขียนอย่างน้อย 40 ตัวอักษร)`;
      if (ok && sec.id === 'tests' && !/\d+\.\d+\.\d+\.\d+|ping|tracert|traceroute|reply|สำเร็จ/i.test(body)) { ok = false; msg = 'หัวข้อผลการทดสอบควรมีหลักฐาน เช่น คำสั่ง ping/tracert, IP ปลายทาง และผลที่ได้'; }
      if (ok) okN++;
      subs.push({ label: `รายงานมีหัวข้อ ${sec.title} พร้อมเนื้อหา`, ok, msg });
    });
    return itemFrom('report', subs);
  }

  // main entry: { score, max, rubric:[{id,title,score,max,note}], items:[...with checks], matrix, buildOk, fault }
  function capEvaluate(topo, input) {
    input = isObj(input) ? input : {};
    const C = capContext(topo, input.plan);
    const cells = capMatrix(C);
    const items = [capDevices(C), capCabling(C), capPlanCheck(C), capImpl(C), capGwDns(C), capMatrixItem(cells), capSecurity(C, cells), capWifi(C)];
    const buildOk = items[1].score === items[1].max && items[5].score === items[5].max;
    // fault stage
    let faultItem, faultInfo = null;
    const F = isObj(input.fault) ? input.fault : null;
    if (!F || !isObj(F.baseline)) {
      faultItem = itemFrom('fault', [{ label: 'แก้เหตุขัดข้องที่ระบบจำลองหลังสร้างเครือข่ายสำเร็จ', ok: false,
        msg: buildOk ? 'เครือข่ายใช้งานได้แล้ว รอระบบแจ้งเหตุขัดข้อง (เปิดภารกิจนี้ในห้องจำลองแล้วทำตามกล่อง "แจ้งปัญหา")' : 'ต้องสร้างเครือข่ายให้ผ่านการทดสอบการเชื่อมต่อทั้งหมดก่อน ระบบจึงจะจำลองเหตุขัดข้องให้แก้' }]);
    } else {
      const basePlan = isObj(F.plan) ? F.plan : input.plan;
      const B = capContext(F.baseline, basePlan);
      const bCells = capMatrix(B);
      const bOk = capMatrixItem(bCells).score === CAP.MAX.matrix && capCabling(B).score === CAP.MAX.cabling;
      const want = bOk ? capPickFault(F.baseline, basePlan) : null;
      const same = want && want.kind === F.kind && want.dev === F.dev && (want.kind !== 'unplugged' || want.link === F.link);
      if (!bOk) faultItem = itemFrom('fault', [{ label: 'แก้เหตุขัดข้องที่ระบบจำลอง', ok: false, msg: 'ข้อมูลเครือข่ายก่อนเกิดเหตุขัดข้องไม่ผ่านการทดสอบ จึงตรวจขั้นนี้ไม่ได้' }]);
      else if (!same) faultItem = itemFrom('fault', [{ label: 'แก้เหตุขัดข้องที่ระบบจำลอง', ok: false, msg: 'ข้อมูลเหตุขัดข้องไม่ตรงกับที่ระบบสร้างจากเครือข่ายของคุณ (กด "เริ่มสถานการณ์ใหม่" ในห้องจำลอง)' }]);
      else {
        const fx = capFaultFixed(C, Object.assign({}, want, { area: want.area }), B);
        faultInfo = { kind: want.kind, dev: want.dev, fixed: fx.ok, title: FAULT_TH[want.kind] };
        faultItem = itemFrom('fault', [{ label: 'แก้เหตุขัดข้องที่ระบบจำลองจนใช้งานได้', ok: fx.ok, msg: fx.msg }]);
      }
    }
    items.push(faultItem);
    items.push(capReport(input.report));
    const score = Math.round(items.reduce((s, x) => s + x.score, 0) * 10) / 10;
    const max = items.reduce((s, x) => s + x.max, 0);
    const rubric = items.map(x => ({ id: x.id, title: x.title, score: x.score, max: x.max, note: x.score < x.max ? (x.checks.find(c => !c.ok) || {}).msg || '' : 'ผ่าน' }));
    return { score, max, rubric, items, matrix: cells.map(c => ({ id: c.id, from: c.from, to: c.to, want: c.want, pass: c.pass, ok: c.ok, blocked: c.blocked, target: c.target, msg: c.msg || '', tests: c.tests.map(t => ({ src: t.src, srcName: t.srcName, ok: t.ok, code: t.code, title: t.title })) })), buildOk, fault: faultInfo };
  }
  const capstone = {
    CAP, needPrefix, evaluate: capEvaluate, pickFault: capPickFault, applyFault: capApplyFault, faultTitle: FAULT_TH, cellTitle: CELL_TH,
    areaOf(topo, plan) { const C = capContext(topo, plan); const o = {}; CAP.areas.forEach(a => { o[a.id] = C.members[a.id].map(d => d.id); }); return o; }
  };

  // ------------------------------------------------------------------ 3.1: NAT/PAT + ACL missions (t10–t13)
  // Start topologies, pinning of the provider-side devices and evaluation (test matrix computed with the engine).
  // Shared by the browser (live checklist) and the server grader. evaluate() never throws.
  const NLC = { wan: '198.51.100.2', isp: '198.51.100.1', wanPrefix: 30, opc: '192.0.2.50', web: '203.0.113.80', webName: 'www.netlab.test',
    lan: '192.168.1.0/24', students: '192.168.10.0/24', teachers: '192.168.20.0/24', servers: '192.168.30.0/24', srvWeb: '192.168.30.10', srvDns: '192.168.30.53', lanWeb: '192.168.1.10' };
  const NL_IDS = ['t10', 't11', 't12', 't13'];
  const nlLink = (id, a, ap, b, bp) => ({ id, a: { dev: a, port: ap }, b: { dev: b, port: bp }, medium: 'utp', up: true });
  const nlPc = (id, name, x, y, ip, gw, dns) => ({ id, type: 'pc', name, x, y, ifaces: [{ name: 'eth0', ip, prefix: 24 }], gateway: gw || '', dns: dns || [], dhcp: false });
  const nlSrv = (id, name, x, y, ip, gw, services, dns) => ({ id, type: 'server', name, x, y, os: 'linux', ifaces: [{ name: 'eth0', ip, prefix: 24 }], gateway: gw || '', dns: dns || [], dhcp: false, services });
  const nlIsp = (x, y) => ({ id: 'net1', type: 'internet', name: 'ISP', x, y, requireNat: true, locked: true,
    ifaces: [{ name: 'wan', ip: NLC.isp, prefix: 30 }, { name: 'out', ip: '192.0.2.1', prefix: 24 }],
    hosts: { '8.8.8.8': 'dns.google', '1.1.1.1': 'one.one.one.one', '203.0.113.80': NLC.webName } });
  const nlOpc = (x, y) => Object.assign(nlPc('opc1', 'Outside-PC', x, y, NLC.opc, '192.0.2.1', ['8.8.8.8']), { locked: true });
  const nlRouter = (name, x, y, ifs, routes, extra) => Object.assign({ id: 'r1', type: 'router', name, x, y,
    ifaces: ['g0/0', 'g0/1', 'g0/2', 'g0/3'].map((n, i) => { const f = ifs[i] || []; const o = { name: n, ip: f[0] || '', prefix: f[1] === undefined ? '' : f[1] }; if (f[2]) o.nat = f[2]; return o; }),
    routes: routes || [] }, extra || {});
  const defRoute = () => [{ net: '0.0.0.0', prefix: 0, via: NLC.isp }];
  function nlStart(mid) {
    if (mid === 't10') return { devices: [
      nlIsp(1040, 140),
      nlRouter('Router1', 700, 140, [['192.168.1.1', 24], [NLC.wan, 30]], defRoute()),
      { id: 'sw1', type: 'switch', name: 'Switch1', x: 700, y: 320, ports: 24 },
      nlPc('pc1', 'PC1', 470, 500, '192.168.1.11', '192.168.1.1', ['8.8.8.8']), nlPc('pc2', 'PC2', 700, 500, '192.168.1.12', '192.168.1.1', ['8.8.8.8']),
      nlPc('pc3', 'PC3', 930, 500, '192.168.1.13', '192.168.1.1', ['8.8.8.8'])
    ], links: [nlLink('l1', 'r1', 'g0/0', 'sw1', 'p1'), nlLink('l2', 'r1', 'g0/1', 'net1', 'wan'),
      nlLink('l3', 'pc1', 'eth0', 'sw1', 'p2'), nlLink('l4', 'pc2', 'eth0', 'sw1', 'p3'), nlLink('l5', 'pc3', 'eth0', 'sw1', 'p4')] };
    if (mid === 't11') return { devices: [
      nlIsp(1040, 140), nlOpc(1300, 140),
      nlRouter('Router1', 700, 140, [['192.168.1.1', 24], [NLC.wan, 30]], defRoute()),
      { id: 'sw1', type: 'switch', name: 'Switch1', x: 700, y: 320, ports: 24 },
      nlPc('pc1', 'PC1', 470, 500, '192.168.1.11', '192.168.1.1', ['8.8.8.8']), nlPc('pc2', 'PC2', 680, 500, '192.168.1.12', '192.168.1.1', ['8.8.8.8']),
      nlSrv('srv1', 'WebServer', 900, 500, NLC.lanWeb, '', { web: true, ssh: true, rdp: true }, ['8.8.8.8'])
    ], links: [nlLink('l1', 'r1', 'g0/0', 'sw1', 'p1'), nlLink('l2', 'r1', 'g0/1', 'net1', 'wan'),
      nlLink('l3', 'pc1', 'eth0', 'sw1', 'p2'), nlLink('l4', 'pc2', 'eth0', 'sw1', 'p3'), nlLink('l5', 'srv1', 'eth0', 'sw1', 'p4'),
      nlLink('lo1', 'net1', 'out', 'opc1', 'eth0')] };
    if (mid === 't12') return { devices: [
      nlRouter('R1', 620, 130, [['192.168.10.1', 24], ['192.168.20.1', 24], ['192.168.30.1', 24]]),
      { id: 'sw1', type: 'switch', name: 'SW-Student', x: 280, y: 320, ports: 24 },
      { id: 'sw2', type: 'switch', name: 'SW-Teacher', x: 620, y: 320, ports: 24 },
      { id: 'sw3', type: 'switch', name: 'SW-Server', x: 960, y: 320, ports: 24 },
      nlPc('spc1', 'S-PC1', 160, 500, '192.168.10.11', '192.168.10.1', [NLC.srvDns]), nlPc('spc2', 'S-PC2', 400, 500, '192.168.10.12', '192.168.10.1', [NLC.srvDns]),
      nlPc('tpc1', 'T-PC1', 620, 500, '192.168.20.11', '192.168.20.1', [NLC.srvDns]),
      nlSrv('web1', 'WebServer', 860, 500, NLC.srvWeb, '192.168.30.1', { web: true, ssh: true, rdp: true }),
      nlSrv('dns1', 'DNS-Server', 1080, 500, NLC.srvDns, '192.168.30.1', { dns: { records: { 'www.college.local': NLC.srvWeb, 'dns.college.local': NLC.srvDns } } })
    ], links: [nlLink('l1', 'r1', 'g0/0', 'sw1', 'p1'), nlLink('l2', 'r1', 'g0/1', 'sw2', 'p1'), nlLink('l3', 'r1', 'g0/2', 'sw3', 'p1'),
      nlLink('l4', 'spc1', 'eth0', 'sw1', 'p2'), nlLink('l5', 'spc2', 'eth0', 'sw1', 'p3'), nlLink('l6', 'tpc1', 'eth0', 'sw2', 'p2'),
      nlLink('l7', 'web1', 'eth0', 'sw3', 'p2'), nlLink('l8', 'dns1', 'eth0', 'sw3', 'p3')] };
    if (mid === 't13') return { devices: [
      nlIsp(1100, 130), nlOpc(1340, 130),
      nlRouter('R1', 760, 130, [['192.168.10.1', 24, 'outside'], ['192.168.30.1', 24, 'inside'], [NLC.wan, 30, 'inside']], defRoute(), {
        nat: { pat: { iface: 'g0/2', src: '192.168.0.0/16' }, statics: [{ proto: 'tcp', local: NLC.srvWeb, lport: 443, global: NLC.wan, gport: 443 }] },
        acls: [{ name: 'STUDENT-IN', iface: 'g0/0', dir: 'out', rules: [
          { action: 'deny', proto: 'ip', src: '192.168.10.0/24', dst: '192.168.30.0/24', port: '' },
          { action: 'permit', proto: 'tcp', src: '192.168.10.0/24', dst: 'host ' + NLC.srvWeb, port: '80' },
          { action: 'permit', proto: 'tcp', src: '192.168.10.0/24', dst: 'host ' + NLC.srvWeb, port: '443' },
          { action: 'permit', proto: 'udp', src: '192.168.10.0 255.255.255.0', dst: 'host ' + NLC.srvDns, port: '53' },
          { action: 'permit', proto: 'ip', src: '192.168.10.0/24', dst: 'any', port: '' }] }] }),
      { id: 'sw1', type: 'switch', name: 'SW-Student', x: 440, y: 320, ports: 24 },
      { id: 'sw2', type: 'switch', name: 'SW-Server', x: 900, y: 320, ports: 24 },
      nlPc('spc1', 'S-PC1', 320, 500, '192.168.10.11', '192.168.10.1', [NLC.srvDns]), nlPc('spc2', 'S-PC2', 560, 500, '192.168.10.12', '192.168.10.1', [NLC.srvDns]),
      nlSrv('web1', 'WebServer', 800, 500, NLC.srvWeb, '192.168.30.1', { web: true, ssh: true }, ['8.8.8.8']),
      nlSrv('dns1', 'DNS-Server', 1010, 500, NLC.srvDns, '192.168.30.1', { dns: { records: { 'www.college.local': NLC.srvWeb } } }, ['8.8.8.8'])
    ], links: [nlLink('l1', 'r1', 'g0/0', 'sw1', 'p1'), nlLink('l2', 'r1', 'g0/1', 'sw2', 'p1'), nlLink('l3', 'r1', 'g0/2', 'net1', 'wan'),
      nlLink('l4', 'spc1', 'eth0', 'sw1', 'p2'), nlLink('l5', 'spc2', 'eth0', 'sw1', 'p3'),
      nlLink('l6', 'web1', 'eth0', 'sw2', 'p2'), nlLink('l7', 'dns1', 'eth0', 'sw2', 'p3'), nlLink('lo1', 'net1', 'out', 'opc1', 'eth0')] };
    return null;
  }
  // provider-side devices are part of the scenario: the grader always uses the original ones
  const NL_FIXED = { t10: { devs: ['net1'], links: [] }, t11: { devs: ['net1', 'opc1'], links: ['lo1'] }, t12: { devs: [], links: [] }, t13: { devs: ['net1', 'opc1'], links: ['lo1'] } };
  function nlEnd(e) {
    if (typeof e === 'string') { const k = e.indexOf(':'); return k > 0 ? { dev: e.slice(0, k).trim(), port: e.slice(k + 1).trim() } : { dev: e.trim(), port: '' }; }
    return isObj(e) ? { dev: str(e.dev !== undefined ? e.dev : e.device), port: str(e.port) } : { dev: '', port: '' };
  }
  function nlPin(mid, topo) {
    let t = clone(topo);
    if (!isObj(t)) t = {};
    t.devices = Array.isArray(t.devices) ? t.devices.slice(0, MAX_DEVICES) : [];
    t.links = Array.isArray(t.links) ? t.links.slice(0, MAX_LINKS) : [];
    const st = nlStart(mid), fx = NL_FIXED[mid];
    if (st && fx) {
      fx.devs.forEach(id => {
        const def = clone(st.devices.find(d => d.id === id));
        const i = t.devices.findIndex(d => isObj(d) && str(d.id) === id);
        const cur = i >= 0 ? t.devices[i] : null;
        if (cur && Number.isFinite(+cur.x) && Number.isFinite(+cur.y)) { def.x = +cur.x; def.y = +cur.y; }
        if (i >= 0) t.devices[i] = def; else t.devices.push(def);
      });
      fx.links.forEach(id => {
        const def = st.links.find(l => l.id === id);
        const hostEnds = [def.a, def.b].filter(e => (st.devices.find(d => d.id === e.dev) || {}).type === 'pc').map(e => e.dev);
        t.links = t.links.filter(l => {
          if (!isObj(l)) return true;
          if (str(l.id) === id) return false;
          return ![nlEnd(l.a), nlEnd(l.b)].some(e => hostEnds.includes(e.dev) || [def.a, def.b].some(x => x.dev === e.dev && x.port === e.port));
        });
        t.links.push(clone(def));
      });
    }
    t.devices.forEach(d => { if (isObj(d) && TYPE_ALIAS[str(d.type).toLowerCase().replace(/\s+/g, '')] === 'internet') d.requireNat = true; });
    return t;
  }
  function nlCtx(mid, topo) {
    const t = nlPin(mid, topo);
    const net = create(t);
    const T = net.topo;
    const byId = new Map(T.devices.map(d => [d.id, d]));
    const cfgC = new Map();
    const cfg = id => { if (!cfgC.has(id)) cfgC.set(id, net.config(id)); return cfgC.get(id); };
    const inNet = (ip, cidr) => { const k = cidr.indexOf('/'); return IP.inSubnet(ip, cidr.slice(0, k), +cidr.slice(k + 1)); };
    const hostsIn = (cidr, types) => T.devices.filter(d => (types || ['pc']).includes(d.type) && d.id !== 'opc1')
      .filter(d => { const c = cfg(d.id); return c && c.ip && !c.apipa && inNet(c.ip, cidr); }).sort((a, b) => natCmp(a.id, b.id)).slice(0, 6);
    const ownerOf = ip => T.devices.filter(d => HOST[d.type]).find(d => { const c = cfg(d.id); return c && c.ip === ip; }) || null;
    const routers = T.devices.filter(d => d.type === 'router').sort((a, b) => natCmp(a.id, b.id));
    const linkedTo = (r, type) => T.links.find(l => (l.a.dev === r.id && (byId.get(l.b.dev) || {}).type === type) || (l.b.dev === r.id && (byId.get(l.a.dev) || {}).type === type));
    const router = routers.find(r => linkedTo(r, 'internet')) || routers[0] || null;
    const wanIf = () => { if (!router) return null; const l = linkedTo(router, 'internet'); if (!l) return null; const port = l.a.dev === router.id ? l.a.port : l.b.port; return router.ifaces.find(f => f.name === port) || null; };
    const ifIn = cidr => router ? router.ifaces.find(f => f.ip && IP.parse(f.ip) !== null && inNet(f.ip, cidr)) || null : null;
    const cache = new Map();
    const run = (src, target, proto, port) => {
      const k = src.id + '>' + target + '/' + proto + '/' + (port || '');
      if (!cache.has(k)) cache.set(k, net.trace(src.id, target, { proto, port }));
      return cache.get(k);
    };
    return { net, T, byId, cfg, hostsIn, ownerOf, router, wanIf, ifIn, run, inNet };
  }
  const PT = (proto, port) => proto === 'icmp' ? 'Ping (ICMP)' : `${PROTO_UP[proto]} ${port}`;
  // def: { id, label, srcs:[devs], target, proto, port, want:'ok'|'deny'|'noreach', expectIp }
  function nlCell(C, def) {
    const cell = { id: def.id, label: def.label, want: def.want, target: def.target, proto: def.proto, port: def.port || null, tests: [], pass: false, part: 0, msg: '' };
    if (!def.srcs.length) { cell.msg = def.noSrc || 'ยังไม่มีเครื่องต้นทางสำหรับทดสอบข้อนี้ (ตรวจ IP ของเครื่อง)'; return cell; }
    let ok = 0;
    def.srcs.forEach(s => {
      const t = C.run(s, def.target, def.proto, def.port);
      const resp = t.responder ? C.byId.get(t.responder) : null;
      const reached = t.ok && (!def.expectIp || (resp && (C.cfg(resp.id) || {}).ip === def.expectIp));
      const denied = !t.ok && /acl_denied$/.test(t.code);
      const pass = def.want === 'ok' ? reached : def.want === 'deny' ? denied : !reached;
      const aclHit = t.acl.filter(a => !a.permit).concat(t.acl.filter(a => a.permit)).slice(0, 1)[0] || null;
      cell.tests.push({ src: s.id, srcName: s.name, ok: t.ok, pass, code: t.code, title: t.title, msg: t.msg, responder: resp ? resp.name : null,
        acl: aclHit ? `${aclHit.devName} ACL ${aclHit.acl} (${aclHit.iface} ${aclHit.dir}) ${aclHit.implicit ? 'implicit deny' : 'ข้อ ' + aclHit.n + ': ' + aclHit.text}` : null });
      if (pass) ok++;
      else if (!cell.msg) {
        const head = `${s.name} → ${def.target} ${PT(def.proto, def.port)}`;
        cell.msg = def.want === 'ok' ? (t.ok ? `${head}: ตอบกลับจาก ${resp ? resp.name : '?'} ไม่ใช่เครื่องที่ต้องการ` : `${head} ไม่สำเร็จ: ${t.title} — ${t.msg}`)
          : def.want === 'deny' ? (t.ok ? `${head} ยังเชื่อมต่อได้ ต้องถูก ACL บล็อก` : `${head} ล้มเหลวเพราะ "${t.title}" ไม่ใช่เพราะ ACL (ต้องบล็อกด้วย ACL โดยเครือข่ายยังทำงานปกติ)`)
            : `${head} ยังเข้าถึง ${resp ? resp.name : 'เครื่องภายใน'} ได้ — ต้องไม่เปิดพอร์ตนี้ให้คนภายนอก`;
      }
    });
    cell.part = ok / def.srcs.length;
    cell.pass = ok === def.srcs.length;
    return cell;
  }
  function nlItem(id, title, max, subs) {
    const W = subs.reduce((s, x) => s + (x.w || 1), 0) || 1;
    const got = subs.reduce((s, x) => s + (x.w || 1) * (x.ok ? 1 : (x.part || 0)), 0);
    const raw = got / W;
    const score = raw >= 1 - 1e-9 ? max : Math.floor(raw * max * 2 + 1e-9) / 2;
    return { id, title, score, max, checks: subs.map(x => ({ label: x.label, ok: !!x.ok, msg: x.ok ? '' : (x.msg || '') })) };
  }
  const cellSub = (c) => ({ label: c.label, ok: c.pass, part: c.part, msg: c.msg });
  function roleSub(C, f, want, what) {
    const R = C.router;
    if (!R) return { label: `${what} เป็น ip nat ${want}`, ok: false, msg: 'ยังไม่มี Router' };
    if (!f) return { label: `${what} เป็น ip nat ${want}`, ok: false, msg: `${R.name} ยังไม่มี${what}ที่ตั้ง IP และต่อสายไว้` };
    const label = `ขา ${f.name} (${what}) เป็น ip nat ${want}`;
    return { label, ok: f.nat === want, msg: f.nat ? `ขา ${f.name} ตั้งเป็น ${f.nat} — ${what}ต้องเป็น ${want} (inside = ฝั่งเครือข่ายภายใน, outside = ฝั่งที่ต่อ ISP)` : `ขา ${f.name} ยังไม่ได้กำหนด ip nat ${want}` };
  }
  const natCfg = R => R && isObj(R.nat) ? R.nat : {};
  const staticsOf = R => (Array.isArray(natCfg(R).statics) ? natCfg(R).statics : []).filter(isObj);
  function appliedAcls(C) { return C.router ? C.net.acls(C.router.id).filter(a => a.applied) : []; }
  function anyAnyRules(C) {
    const out = [];
    if (C.router) (C.router.acls || []).forEach(a => (Array.isArray(a.rules) ? a.rules : []).forEach((r, i) => {
      const p = parseRule(r);
      if (!p.err && !p.deny && p.proto === 'any' && p.src.any && p.dst.any) out.push(`ACL "${str(a.name) || '?'}" ข้อที่ ${i + 1}`);
    }));
    return out;
  }
  const NL_TITLE = {
    roles: 'กำหนดขา NAT inside / outside', pat: 'เปิด PAT (NAT overload)', ping: 'ทุกเครื่อง ping อินเทอร์เน็ต (8.8.8.8) ได้', web: `ทุกเครื่องเปิดเว็บ ${NLC.webName} ได้`,
    table: 'ตาราง NAT และ Static NAT', internet: 'เครื่องภายในออกอินเทอร์เน็ตได้ (PAT)', fwd443: 'คนภายนอกเข้าเว็บ HTTPS (443) ได้', fwd80: 'คนภายนอกเข้าเว็บ HTTP (80) ได้',
    closed: 'พอร์ตอื่นไม่เปิดให้คนภายนอก (3389, 22)', cfg: 'การตั้งค่าตรงตามหลัก', allow: 'นักเรียนใช้เว็บและ DNS ของเซิร์ฟเวอร์ได้',
    deny: 'นักเรียนเข้าบริการอื่นของเซิร์ฟเวอร์ไม่ได้ (ACL)', teacher: 'ห้องครูใช้งานเซิร์ฟเวอร์ได้ทุกบริการ', acl: 'ACL ผูกกับ Router และระบุพอร์ตเฉพาะ',
    servers: 'นักเรียนใช้เว็บและ DNS ภายในได้', outside: 'คนภายนอกเข้าเว็บ HTTPS ได้ แต่ SSH ไม่ได้'
  };
  function nlEval(mid, topo) {
    const C = nlCtx(mid, topo);
    const R = C.router;
    const cells = [], items = [];
    const cell = def => { const c = nlCell(C, def); cells.push(c); return c; };
    const item = (id, max, subs) => { const it = nlItem(id, NL_TITLE[id], max, subs); items.push(it); return it; };
    let penalty = null;
    if (mid === 't10' || mid === 't11') {
      const pcs = C.hostsIn(NLC.lan);
      const lan = C.ifIn(NLC.lan), wan = C.wanIf();
      if (mid === 't10') {
        item('roles', 2, [roleSub(C, lan, 'inside', 'ขา LAN'), roleSub(C, wan, 'outside', 'ขา WAN (ต่อ ISP)')]);
        const pat = natCfg(R).pat, src = isObj(pat) ? parseAddr(pat.src) : null;
        const covered = pcs.filter(p => src && str(pat.src) && addrMatch(IP.parse(C.cfg(p.id).ip), src));
        item('pat', 2, [
          { label: 'เปิด PAT (overload) โดยใช้ IP ของขา WAN', ok: !!(isObj(pat) && wan && str(pat.iface) === wan.name), msg: !isObj(pat) || !str(pat.iface) ? `${R ? R.name : 'Router'} ยังไม่ได้เปิด PAT (ip nat inside source list … interface … overload)` : `PAT ใช้ขา ${str(pat.iface)} ต้องใช้ขา WAN ${wan ? wan.name : ''} ที่ต่อ ISP (Public IP ${NLC.wan})` },
          { label: 'เครือข่ายที่ให้แปลงครอบคลุม PC ทุกเครื่อง', ok: pcs.length > 0 && covered.length === pcs.length, part: pcs.length ? covered.length / pcs.length : 0,
            msg: !isObj(pat) || !str(pat.src) ? 'ยังไม่ได้ระบุเครือข่ายภายในที่ให้แปลง เช่น 192.168.1.0/24' : !src ? `"${str(pat.src)}" ไม่ใช่เครือข่ายที่ถูกต้อง` : `เครือข่ายที่ให้แปลง ${src.text} ไม่ครอบคลุม ${pcs.filter(p => !covered.includes(p)).map(p => p.name).join(', ')}` }]);
        item('ping', 2, [cellSub(cell({ id: 'ping', label: 'PC → 8.8.8.8 (Ping)', srcs: pcs, target: '8.8.8.8', proto: 'icmp', want: 'ok' }))]);
        item('web', 2, [cellSub(cell({ id: 'web443', label: `PC → ${NLC.web} (${NLC.webName}) TCP 443`, srcs: pcs, target: NLC.web, proto: 'tcp', port: 443, want: 'ok' })),
          cellSub(cell({ id: 'web80', label: `PC → ${NLC.web} TCP 80`, srcs: pcs, target: NLC.web, proto: 'tcp', port: 80, want: 'ok' }))]);
        const rows = R ? C.net.natTable(R.id) : [];
        const withRow = pcs.filter(p => rows.some(r => r.type === 'PAT' && r.insideLocal.split(':')[0] === C.cfg(p.id).ip));
        const st = staticsOf(R);
        item('table', 2, [
          { label: 'ตาราง NAT มีรายการแปลง (PAT) ของ PC ทุกเครื่อง', ok: pcs.length > 0 && withRow.length === pcs.length, part: pcs.length ? withRow.length / pcs.length : 0,
            msg: `ยังไม่มีรายการแปลงของ ${pcs.filter(p => !withRow.includes(p)).map(p => p.name).join(', ') || 'PC'} ในตาราง NAT (แพ็กเก็ตยังไม่ถูกแปลงที่ Router)` },
          { label: 'ไม่มี Static NAT / Port forwarding ที่ไม่จำเป็น', ok: st.length === 0 && withRow.length > 0, msg: !withRow.length && !st.length ? 'ข้อนี้นับเมื่อ PAT ทำงานแล้ว (มีรายการแปลงในตาราง NAT)' : `มี Static NAT/Port forwarding ${st.length} รายการ — ภารกิจนี้ไม่มีเครื่องที่ต้องให้คนภายนอกเข้าถึง Static NAT ที่ไม่จำเป็นเปิดช่องให้คนนอกเข้ามาถึงเครื่องภายในได้` }]);
      } else {
        const webIp = NLC.lanWeb;
        const opc = C.byId.get('opc1');
        item('roles', 1.5, [roleSub(C, lan, 'inside', 'ขา LAN'), roleSub(C, wan, 'outside', 'ขา WAN (ต่อ ISP)')]);
        item('internet', 1.5, [cellSub(cell({ id: 'ping', label: 'PC → 8.8.8.8 (Ping)', srcs: pcs, target: '8.8.8.8', proto: 'icmp', want: 'ok' }))]);
        const f443 = cell({ id: 'fwd443', label: `Outside-PC → ${NLC.wan} TCP 443 (ถึง WebServer)`, srcs: opc ? [opc] : [], target: NLC.wan, proto: 'tcp', port: 443, want: 'ok', expectIp: webIp });
        item('fwd443', 2, [cellSub(f443)]);
        item('fwd80', 1, [cellSub(cell({ id: 'fwd80', label: `Outside-PC → ${NLC.wan} TCP 80 (ถึง WebServer)`, srcs: opc ? [opc] : [], target: NLC.wan, proto: 'tcp', port: 80, want: 'ok', expectIp: webIp }))]);
        const gate = (c) => f443.pass ? cellSub(c) : { label: c.label, ok: false, msg: 'ต้องเปิดเว็บ HTTPS (443) ให้คนภายนอกเข้าถึง WebServer ได้ก่อน จึงตรวจข้อนี้' };
        item('closed', 2, [gate(cell({ id: 'rdp', label: `Outside-PC → ${NLC.wan} TCP 3389 (ต้องเข้าไม่ถึง)`, srcs: opc ? [opc] : [], target: NLC.wan, proto: 'tcp', port: 3389, want: 'noreach', expectIp: webIp })),
          gate(cell({ id: 'ssh', label: `Outside-PC → ${NLC.wan} TCP 22 (ต้องเข้าไม่ถึง)`, srcs: opc ? [opc] : [], target: NLC.wan, proto: 'tcp', port: 22, want: 'noreach', expectIp: webIp }))]);
        const st = staticsOf(R), toWeb = st.filter(x => str(x.local) === webIp);
        const extra = st.filter(x => !(/^(tcp)$/i.test(str(x.proto) || 'tcp') && [80, 443].includes(+x.lport) && [80, 443].includes(+(str(x.gport) || x.lport))));
        item('cfg', 2, [
          { label: 'มี Port forwarding ไปยัง WebServer', ok: toWeb.length > 0, msg: `ยังไม่มี Static NAT/Port forwarding ไปยัง WebServer (${webIp})` },
          { label: 'เปิดเฉพาะ TCP 80/443 (ไม่ใช้ Static NAT แบบทุกพอร์ต และไม่เปิดพอร์ตอื่น)', ok: toWeb.length > 0 && extra.length === 0,
            msg: extra.length ? `มีการส่งต่อที่ไม่จำเป็น: ${extra.map(x => `${str(x.proto) || 'tcp'} ${str(x.gport) || str(x.lport) || 'ทุกพอร์ต'} → ${str(x.local)}${str(x.lport) ? ':' + str(x.lport) : ''}`).join(', ')} — เปิดเท่าที่จำเป็นเท่านั้น (Least privilege)` : 'ยังไม่มี Port forwarding' }]);
      }
    } else if (mid === 't12') {
      const st = C.hostsIn(NLC.students), te = C.hostsIn(NLC.teachers);
      const S = (id, label, target, proto, port, want, srcs) => cell({ id, label, srcs: srcs || st, target, proto, port, want });
      const ap = appliedAcls(C);
      // without any ACL everything is open: "allowed" traffic only counts once a policy is in place
      const gA = sub => ap.length ? sub : { label: sub.label, ok: false, msg: 'ยังไม่มี ACL ที่ใช้งาน — ตอนนี้ทุกบริการเปิดหมด ข้อนี้นับเมื่อมีนโยบาย ACL แล้ว' };
      item('allow', 3, [
        gA(cellSub(S('s-web80', `นักเรียน → WebServer TCP 80`, NLC.srvWeb, 'tcp', 80, 'ok'))),
        gA(cellSub(S('s-web443', `นักเรียน → WebServer TCP 443`, NLC.srvWeb, 'tcp', 443, 'ok'))),
        gA(cellSub(S('s-dns', `นักเรียน → DNS-Server UDP 53`, NLC.srvDns, 'udp', 53, 'ok')))]);
      item('deny', 3, [
        cellSub(S('s-ssh', `นักเรียน → WebServer TCP 22 (ต้องถูกบล็อก)`, NLC.srvWeb, 'tcp', 22, 'deny')),
        cellSub(S('s-rdp', `นักเรียน → WebServer TCP 3389 (ต้องถูกบล็อก)`, NLC.srvWeb, 'tcp', 3389, 'deny')),
        cellSub(S('s-ping', `นักเรียน → WebServer Ping (ต้องถูกบล็อก)`, NLC.srvWeb, 'icmp', null, 'deny'))]);
      item('teacher', 2, [
        gA(cellSub(S('t-ssh', 'ห้องครู → WebServer TCP 22', NLC.srvWeb, 'tcp', 22, 'ok', te))),
        gA(cellSub(S('t-rdp', 'ห้องครู → WebServer TCP 3389', NLC.srvWeb, 'tcp', 3389, 'ok', te))),
        gA(cellSub(S('t-web', 'ห้องครู → WebServer TCP 443', NLC.srvWeb, 'tcp', 443, 'ok', te))),
        gA(cellSub(S('t-ping', 'ห้องครู → WebServer Ping', NLC.srvWeb, 'icmp', null, 'ok', te))),
        gA(cellSub(S('t-dns', 'ห้องครู → DNS-Server UDP 53', NLC.srvDns, 'udp', 53, 'ok', te)))]);
      const portRule = R && (R.acls || []).some(a => (Array.isArray(a.rules) ? a.rules : []).some(r => { const p = parseRule(r); return !p.err && !p.deny && p.port !== null; }));
      item('acl', 2, [
        { label: 'มี ACL ที่ผูกกับขาของ Router (ip access-group … in/out)', ok: ap.length > 0, msg: R ? `${R.name} ยังไม่มี ACL ที่มีกฎและผูกกับขา (interface) พร้อมทิศ in/out` : 'ยังไม่มี Router' },
        { label: 'กฎ permit ระบุโปรโตคอลและพอร์ตของบริการที่อนุญาต (เช่น tcp eq 443)', ok: !!portRule && ap.length > 0, msg: 'ยังไม่มีกฎ permit ที่ระบุพอร์ต — ACL แบบ Extended ต้องระบุโปรโตคอลและพอร์ต เช่น permit tcp 192.168.10.0 0.0.0.255 host 192.168.30.10 eq 443' }]);
    } else if (mid === 't13') {
      const st = C.hostsIn(NLC.students);
      const web = C.ownerOf(NLC.srvWeb);
      const opc = C.byId.get('opc1');
      const S = (id, label, target, proto, port, want, srcs, expectIp) => cell({ id, label, srcs: srcs || st, target, proto, port, want, expectIp });
      item('internet', 2, [
        cellSub(S('s-inet', 'นักเรียน → 8.8.8.8 (Ping)', '8.8.8.8', 'icmp', null, 'ok')),
        cellSub(S('s-www', `นักเรียน → ${NLC.web} TCP 443`, NLC.web, 'tcp', 443, 'ok')),
        cellSub(S('w-inet', 'WebServer → 8.8.8.8 (Ping)', '8.8.8.8', 'icmp', null, 'ok', web ? [web] : []))]);
      const w443 = S('s-web443', 'นักเรียน → WebServer TCP 443', NLC.srvWeb, 'tcp', 443, 'ok');
      item('servers', 2, [cellSub(S('s-web80', 'นักเรียน → WebServer TCP 80', NLC.srvWeb, 'tcp', 80, 'ok')), cellSub(w443),
        cellSub(S('s-dns', 'นักเรียน → DNS-Server UDP 53', NLC.srvDns, 'udp', 53, 'ok'))]);
      const gateW = c => w443.pass ? cellSub(c) : { label: c.label, ok: false, msg: 'ต้องให้นักเรียนเข้าเว็บ (TCP 443) ของ WebServer ได้ก่อน จึงตรวจข้อนี้ (ACL ต้องบล็อกเฉพาะสิ่งที่ไม่อนุญาต)' };
      item('deny', 2, [gateW(S('s-ssh', 'นักเรียน → WebServer TCP 22 (ต้องถูกบล็อก)', NLC.srvWeb, 'tcp', 22, 'deny')),
        gateW(S('s-ping', 'นักเรียน → WebServer Ping (ต้องถูกบล็อก)', NLC.srvWeb, 'icmp', null, 'deny'))]);
      const o443 = S('o-443', `Outside-PC → ${NLC.wan} TCP 443 (ถึง WebServer)`, NLC.wan, 'tcp', 443, 'ok', opc ? [opc] : [], NLC.srvWeb);
      const o22 = S('o-22', `Outside-PC → ${NLC.wan} TCP 22 (ต้องเข้าไม่ถึง)`, NLC.wan, 'tcp', 22, 'noreach', opc ? [opc] : [], NLC.srvWeb);
      item('outside', 2, [cellSub(o443), o443.pass ? cellSub(o22) : { label: o22.label, ok: false, msg: 'ต้องให้คนภายนอกเข้าเว็บ HTTPS ได้ก่อน จึงตรวจข้อนี้' }]);
      const sIf = C.ifIn(NLC.students), vIf = C.ifIn(NLC.servers), wan = C.wanIf();
      const ap = appliedAcls(C);
      const onStudent = sIf && ap.some(a => a.iface === sIf.name);
      item('cfg', 2, [
        { label: 'ACL ของห้องนักเรียนยังผูกกับขาของห้องนักเรียน (แก้กฎ ไม่ใช่ลบ ACL)', ok: !!onStudent, msg: sIf ? `ไม่มี ACL ที่ใช้งานอยู่บนขา ${sIf.name} (ห้องนักเรียน) — การลบ/ถอด ACL ทำให้นโยบายความปลอดภัยหายไป` : 'Router ไม่มีขาในวงของห้องนักเรียน' },
        { label: 'NAT: ขา LAN ทั้งสองเป็น inside และขา WAN เป็น outside', ok: !!(sIf && vIf && wan && sIf.nat === 'inside' && vIf.nat === 'inside' && wan.nat === 'outside'),
          part: [sIf && sIf.nat === 'inside', vIf && vIf.nat === 'inside', wan && wan.nat === 'outside'].filter(Boolean).length / 3,
          msg: [sIf && sIf.nat !== 'inside' ? `ขา ${sIf.name} (ห้องนักเรียน) เป็น ${sIf.nat || 'ไม่ได้ตั้ง'} ต้องเป็น inside` : '', vIf && vIf.nat !== 'inside' ? `ขา ${vIf.name} (เซิร์ฟเวอร์) เป็น ${vIf.nat || 'ไม่ได้ตั้ง'} ต้องเป็น inside` : '', wan && wan.nat !== 'outside' ? `ขา ${wan.name} (WAN) เป็น ${wan.nat || 'ไม่ได้ตั้ง'} ต้องเป็น outside` : ''].filter(Boolean).join(' • ') || 'ตรวจ NAT inside/outside' }]);
      const aa = anyAnyRules(C);
      if (aa.length) penalty = { points: 3, msg: `หักคะแนน: ใช้กฎ "permit ip any any" (${aa.join(', ')}) ซึ่งเปิดทุกอย่างแทนที่จะแก้กฎที่ผิด — ทางลัดนี้ทำให้ ACL ไม่ปกป้องอะไรเลย` };
    } else return { mission: mid, score: 0, max: 10, items: [], cells: [], penalty: null };
    const sum = items.reduce((s, x) => s + x.score, 0);
    const score = Math.max(0, Math.round((sum - (penalty ? penalty.points : 0)) * 10) / 10);
    const max = items.reduce((s, x) => s + x.max, 0);
    return { mission: mid, score, max, items, cells, penalty, router: R ? R.id : null, natTable: R ? C.net.natTable(R.id) : [] };
  }
  const natlab = {
    C: NLC, missions: NL_IDS.slice(),
    start(mid) { const s = nlStart(mid); return s ? clone(s) : null; },
    pin: nlPin,
    evaluate(mid, topo) {
      try { return nlEval(mid, topo); }
      catch (e) { return { mission: mid, score: 0, max: 10, items: [], cells: [], penalty: null, error: 'internal: ' + (e && e.message) }; }
    }
  };

  const acl = { parseAddr, parseRule, parsePort, match: addrMatch, PORTS: PORT_NAMES, isPrivate: (ip) => isPriv(asInt(ip)) };
  const NetSim = { version: VERSION, create, render, ip: IP, reasonText: REASON_TEXT, REASONS, traceText: TRACE_TEXT, capstone, acl, natlab };
  return NetSim;
});
