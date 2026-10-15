'use strict';
// Network Topology Simulator — server grader (see docs/SIM-SPEC.md §2 and §4.1).
// grade(missionId, { topo }) sanitises the student's topology, builds it with NetSim, then checks each
// mission requirement (device types/counts, cabling, addressing, DHCP/DNS/Wi-Fi settings and real pings run
// in the engine). Every requirement gives partial credit and failed ones get Thai feedback explaining why.
// Pure function, no I/O, never throws.

const NetSim = require('../../public/js/sim/netsim.js');

const IP = NetSim.ip;
const MAX = 10;
const MAX_DEV = 60;
const MAX_LINK = 150;
const MAX_JSON = 250000;
const MAX_STR = 80;
const MAX_FB_PINGS = 3;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// ---------------------------------------------------------------------------------------------
// small utils
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const s = (v) => (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, MAX_STR) : '';
const natCmp = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });
const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : (typeof v === 'string' ? v.slice(0, MAX_STR) : undefined);
const bool = (v) => v === true || v === 'true' || v === 1 ? true : v === false || v === 'false' || v === 0 ? false : undefined;
const half = (x) => Math.floor(x * 2 + 1e-9) / 2;

// ---------------------------------------------------------------------------------------------
// payload sanitising: whitelist the fields NetSim uses, cap sizes and string lengths
function cleanIface(f) {
  if (!isObj(f)) return null;
  const o = { name: s(f.name), ip: s(f.ip) };
  const p = num(f.prefix); if (p !== undefined && p !== '') o.prefix = p;
  const m = num(f.mask); if (m !== undefined && m !== '' && o.prefix === undefined) o.mask = m;
  if (typeof f.mac === 'string') o.mac = s(f.mac);
  const up = bool(f.up); if (up !== undefined) o.up = up;
  if (f.ssid !== undefined) o.ssid = s(f.ssid);
  if (f.nat === 'inside' || f.nat === 'outside') o.nat = f.nat;   // 3.1 NAT role of a router interface
  return o;
}
function cleanDnsList(v) {
  if (typeof v === 'string') return v.slice(0, 200).split(/[\s,;]+/).filter(Boolean).slice(0, 4).map(s);
  return Array.isArray(v) ? v.slice(0, 4).map(s).filter(Boolean) : [];
}
function cleanPool(pl) {
  if (!isObj(pl)) return null;
  const o = { start: s(pl.start), end: s(pl.end), gateway: s(pl.gateway !== undefined ? pl.gateway : pl.router), dns: cleanDnsList(pl.dns) };
  const p = num(pl.prefix !== undefined ? pl.prefix : pl.mask); if (p !== undefined && p !== '') o.prefix = p;
  if (bool(pl.enabled) === false) o.enabled = false;
  return o;
}
function cleanServices(sv) {
  const o = {};
  if (!isObj(sv)) return o;
  if (Array.isArray(sv.dhcp)) { const a = sv.dhcp.slice(0, 4).map(cleanPool).filter(Boolean); if (a.length) o.dhcp = a; }
  else if (isObj(sv.dhcp)) { const p = cleanPool(sv.dhcp); if (p) o.dhcp = p; }
  if (isObj(sv.dns)) {
    const rec = {};
    const src = isObj(sv.dns.records) ? sv.dns.records : {};
    Object.keys(src).slice(0, 100).forEach((k) => {
      const key = s(k).trim();
      if (!key || BAD_KEYS.has(key)) return;
      rec[key] = s(src[k]);
    });
    o.dns = { records: rec };
    if (bool(sv.dns.enabled) === false) o.dns.enabled = false;
  }
  if (sv.web !== undefined) o.web = !!sv.web;
  if (sv.file !== undefined) o.file = !!sv.file;
  if (sv.ssh !== undefined) o.ssh = !!sv.ssh;   // 3.1 services tested by TCP port tests
  if (sv.rdp !== undefined) o.rdp = !!sv.rdp;
  return o;
}
function cleanDevice(d) {
  if (!isObj(d)) return null;
  const o = { id: s(d.id), type: s(d.type), name: s(d.name) };
  const x = Number(d.x), y = Number(d.y);
  if (Number.isFinite(x)) o.x = Math.max(-1e5, Math.min(1e5, x));
  if (Number.isFinite(y)) o.y = Math.max(-1e5, Math.min(1e5, y));
  if (Array.isArray(d.ifaces)) o.ifaces = d.ifaces.slice(0, 8).map(cleanIface).filter(Boolean);
  if (d.gateway !== undefined) o.gateway = s(d.gateway);
  if (d.dns !== undefined) o.dns = cleanDnsList(d.dns);
  const dh = bool(d.dhcp); if (dh !== undefined) o.dhcp = dh;
  if (isObj(d.firewall)) o.firewall = { icmp: bool(d.firewall.icmp) !== false };
  if (d.services !== undefined) o.services = cleanServices(d.services);
  if (d.os !== undefined) o.os = s(d.os);
  if (d.ssid !== undefined) o.ssid = s(d.ssid);
  if (d.security !== undefined) o.security = s(d.security);
  // 2.8 fields (power, hub, AP passphrase/isolation, client Wi-Fi key, router packet filter)
  if (bool(d.power) === false || d.power === 'off') o.power = false;
  if (bool(d.hub) === true) o.hub = true;
  if (d.passphrase !== undefined) o.passphrase = s(d.passphrase);
  if (bool(d.isolation) !== undefined) o.isolation = bool(d.isolation);
  if (d.wifiKey !== undefined) o.wifiKey = s(d.wifiKey);
  if (Array.isArray(d.filters)) o.filters = d.filters.slice(0, 30).filter(isObj).map((r) => Object.assign({ action: s(r.action), src: s(r.src), dst: s(r.dst), proto: s(r.proto) || 'any' }, r.port !== undefined && r.port !== '' ? { port: s(r.port) } : {}));
  // 3.1: NAT (PAT + static/port forwarding) and interface ACLs; provider flags (the grader re-pins them anyway)
  if (isObj(d.nat)) {
    const n = {};
    if (isObj(d.nat.pat)) n.pat = { iface: s(d.nat.pat.iface), src: s(d.nat.pat.src) };
    if (Array.isArray(d.nat.statics)) n.statics = d.nat.statics.slice(0, 20).filter(isObj).map((x) => ({ proto: s(x.proto), local: s(x.local), lport: s(x.lport), global: s(x.global), gport: s(x.gport) }));
    o.nat = n;
  }
  if (Array.isArray(d.acls)) {
    o.acls = d.acls.slice(0, 10).filter(isObj).map((a) => ({ name: s(a.name), iface: s(a.iface), dir: s(a.dir),
      rules: (Array.isArray(a.rules) ? a.rules : []).slice(0, 30).filter(isObj).map((r) => ({ action: s(r.action), proto: s(r.proto), src: s(r.src), dst: s(r.dst), port: s(r.port) })) }));
  }
  if (bool(d.requireNat) === true) o.requireNat = true;
  if (bool(d.locked) === true) o.locked = true;
  if (d.ports !== undefined) { const n = Number(d.ports); if (Number.isFinite(n)) o.ports = n; }
  if (Array.isArray(d.routes)) {
    o.routes = d.routes.slice(0, 30).filter(isObj).map((r) => {
      const ro = { net: s(r.net !== undefined ? r.net : r.network), via: s(r.via) };
      const p = num(r.prefix !== undefined ? r.prefix : r.mask); if (p !== undefined) ro.prefix = p;
      if (r.iface !== undefined) ro.iface = s(r.iface);
      return ro;
    });
  }
  if (isObj(d.hosts)) {
    const h = {};
    Object.keys(d.hosts).slice(0, 60).forEach((k) => { if (!BAD_KEYS.has(k)) h[s(k)] = s(d.hosts[k]); });
    o.hosts = h;
  }
  return o;
}
function cleanEnd(e) {
  if (typeof e === 'string') return s(e);
  if (!isObj(e)) return { dev: '', port: '' };
  return { dev: s(e.dev !== undefined ? e.dev : e.device), port: s(e.port) };
}
function cleanLink(l) {
  if (!isObj(l)) return null;
  const o = { id: s(l.id), a: cleanEnd(l.a), b: cleanEnd(l.b), medium: s(l.medium) || 'utp' };
  const up = bool(l.up); if (up !== undefined) o.up = up;
  return o;
}
// -> { topo } or { err: Thai message }
function sanitize(payload) {
  if (!isObj(payload) || !isObj(payload.topo)) return { err: 'ไม่พบแผนผังเครือข่ายในงานที่ส่ง (ต้องส่งข้อมูล topo)' };
  const t = payload.topo;
  if (!Array.isArray(t.devices) || !Array.isArray(t.links)) return { err: 'รูปแบบแผนผังเครือข่ายไม่ถูกต้อง (ต้องมีรายการอุปกรณ์และสาย)' };
  if (t.devices.length > MAX_DEV) return { err: `มีอุปกรณ์มากเกินไป (สูงสุด ${MAX_DEV} ชิ้น)` };
  if (t.links.length > MAX_LINK) return { err: `มีสายมากเกินไป (สูงสุด ${MAX_LINK} เส้น)` };
  let json;
  try { json = JSON.stringify(t); } catch (e) { return { err: 'ข้อมูลแผนผังเครือข่ายเสียหาย อ่านไม่ได้' }; }
  if (typeof json !== 'string' || json.length > MAX_JSON) return { err: 'ข้อมูลแผนผังเครือข่ายมีขนาดใหญ่เกินกำหนด' };
  const parsed = JSON.parse(json);
  return {
    topo: {
      devices: parsed.devices.map(cleanDevice).filter(Boolean),
      links: parsed.links.map(cleanLink).filter(Boolean)
    }
  };
}

// ---------------------------------------------------------------------------------------------
// helpers over a built net
const PING_HINT = {
  iface_down: 'ให้เปิดใช้งาน Network adapter ของเครื่องต้นทาง',
  no_link: 'ตรวจว่าต่อสายครบและสายไม่ได้ถูกถอด (สายที่มีกากบาทสีแดงคือสายที่ใช้งานไม่ได้)',
  no_ip: 'กำหนด IP address ให้เครื่อง หรือเปิด DHCP ถ้ามี DHCP server',
  bad_target: 'ตรวจการสะกดชื่อ และระเบียน (record) บน DNS server',
  dns_fail: 'ตั้งค่า DNS server ให้เครื่อง และตรวจว่าติดต่อ DNS server ได้',
  same_subnet_unreachable: 'ตรวจว่าเครื่องปลายทางต่อสายอยู่ในเครือข่ายเดียวกันจริง และ IP ปลายทางถูกต้อง',
  no_gateway: 'ปลายทางอยู่ต่างวง ต้องตั้ง Default gateway เป็น IP ของ Router ขาที่อยู่วงเดียวกับเครื่อง',
  gateway_unreachable: 'Default gateway ที่ตั้งไว้ไม่มีอยู่ในวงนี้ ตรวจ IP ของ Router ขาที่ต่อกับวงนี้',
  no_route: 'Router ต้องมีเส้นทางไปยังปลายทาง (static route หรือ default route)',
  timeout: 'แพ็กเก็ตไปถึงแต่คำตอบกลับไม่ได้ ตรวจ Default gateway ของเครื่องปลายทาง และไฟร์วอลล์ของปลายทาง',
  ttl_expired: 'ตรวจ static route ของ Router ไม่ให้ชี้วนกันไปมา'
};

function makeCtx(net) {
  const devs = net.topo.devices;
  const byId = new Map(devs.map((d) => [d.id, d]));
  const ofType = (t) => devs.filter((d) => d.type === t).sort((a, b) => natCmp(a.id, b.id));
  const problems = net.problems();
  const cfg = new Map();
  const config = (id) => { if (!cfg.has(id)) cfg.set(id, net.config(id)); return cfg.get(id); };
  // links touching a device: [{ link, port, other, otherPort, active, reason, medium }]
  const adj = (id) => net.topo.links.filter((l) => l.a.dev === id || l.b.dev === id).map((l) => {
    const mine = l.a.dev === id ? l.a : l.b, oth = l.a.dev === id ? l.b : l.a;
    const st = net.linkState(l.id) || { active: false, reason: 'bad_link' };
    return { link: l, port: mine.port, other: byId.get(oth.dev), otherPort: oth.port, active: st.active, reason: st.reason, medium: l.medium };
  }).filter((x) => x.other && x.other.id !== id);
  const linkedTo = (id, type, opt) => adj(id).filter((x) => x.other.type === type && (!opt || !opt.wired || x.medium !== 'wifi'));
  const errorsOf = (id) => problems.filter((p) => p.level === 'error' && p.dev === id);
  const ip = (id) => { const c = config(id); return c && c.ip ? c.ip : null; };
  const netOf = (id) => { const c = config(id); return c && c.ip ? c.network + '/' + c.prefix : null; };
  return { net, devs, byId, ofType, problems, config, adj, linkedTo, errorsOf, ip, netOf };
}

const LINK_REASON = {
  off: 'อุปกรณ์ปลายสายปิดอยู่ (Power off)', auth: 'รหัสผ่าน Wi-Fi ไม่ถูกต้อง',
  down: 'สายถูกถอดหรือขาด', iface_down: 'Network adapter ถูกปิด', ssid: 'SSID ไม่ตรงกับ Access Point',
  wifi_wrong_end: 'สาย Wi-Fi ต่อผิดปลาย', port_in_use: 'พอร์ตมีสายอื่นเสียบอยู่แล้ว', bad_link: 'สายต่อผิด'
};

// Run a ping and turn a failure into a short Thai explanation
function pingMsg(C, src, target, label) {
  const r = C.net.ping(src.id, target, { count: 4 });
  if (r.ok) return { ok: true };
  const where = r.failAt && C.byId.get(r.failAt) && r.failAt !== src.id ? ` (ติดที่ ${C.byId.get(r.failAt).name})` : '';
  const hint = PING_HINT[r.reason] ? ` — ${PING_HINT[r.reason]}` : '';
  return { ok: false, reason: r.reason, msg: `${src.name} ping ${label || target} ไม่สำเร็จ: ${r.reasonText || r.reason}${where}${hint}` };
}

// pairs: [{ src, target, label }] -> { frac, fb }
function pingSet(C, pairs, emptyMsg) {
  if (!pairs.length) return { frac: 0, fb: [emptyMsg || 'ยังไม่มีเครื่องให้ทดสอบ ping'] };
  let ok = 0; const fails = [];
  pairs.forEach((p) => {
    if (!p.target) { fails.push(`${p.src.name} ping ${p.label} ไม่ได้ เพราะเครื่องปลายทางยังไม่มี IP address`); return; }
    const r = pingMsg(C, p.src, p.target, p.label);
    if (r.ok) ok++; else fails.push(r.msg);
  });
  const fb = fails.slice(0, MAX_FB_PINGS);
  if (fails.length > MAX_FB_PINGS) fb.push(`…และ ping ไม่สำเร็จอีก ${fails.length - MAX_FB_PINGS} คู่`);
  return { frac: ok / pairs.length, fb };
}
const hostLabel = (C, d) => { const ip = C.ip(d.id); return ip ? `${d.name} (${ip})` : d.name; };
const allPairs = (C, srcs, dsts) => {
  const out = [];
  srcs.forEach((a) => dsts.forEach((b) => { if (a !== b) out.push({ src: a, target: C.ip(b.id), label: hostLabel(C, b) }); }));
  return out;
};

// Static IP sanity for one host: valid address, not APIPA, no error-level problem on the device
function staticOk(C, d) {
  const c = C.config(d.id);
  const errs = C.errorsOf(d.id).filter((p) => p.code !== 'port_in_use' && p.code !== 'wifi_wrong_end' && p.code !== 'ssid_mismatch');
  if (errs.length) return { ok: false, msg: errs[0].msg };
  if (!c || !c.ip) return { ok: false, msg: `${d.name} ยังไม่มี IP address ที่ใช้งานได้` };
  if (c.apipa) return { ok: false, msg: `${d.name} ได้ IP ${c.ip} แบบ APIPA (169.254.x.x) ซึ่งใช้งานจริงไม่ได้` };
  return { ok: true };
}
function dupMsgs(C) { return C.problems.filter((p) => p.code === 'dup_ip'); }

// cabling: every host has an active link straight to a switch
function cabledToSwitch(C, hosts) {
  if (!hosts.length) return { frac: 0, fb: ['ยังไม่มีเครื่องให้ตรวจการต่อสาย'] };
  let ok = 0; const fb = [];
  hosts.forEach((h) => {
    const l = C.linkedTo(h.id, 'switch');
    if (l.some((x) => x.active)) ok++;
    else if (l.length) fb.push(`สายของ ${h.name} ที่ต่อกับ ${l[0].other.name} ใช้งานไม่ได้ (${LINK_REASON[l[0].reason] || l[0].reason})`);
    else fb.push(`${h.name} ยังไม่ได้ต่อสายเข้า Switch`);
  });
  return { frac: ok / hosts.length, fb };
}

// gateway check: host gateway must be an operational router interface in the host's own subnet
function gatewayCheck(C, hosts, routers) {
  if (!hosts.length) return { frac: 0, fb: ['ยังไม่มีเครื่องให้ตรวจ Default gateway'] };
  const rIfs = [];
  routers.forEach((r) => { const c = C.config(r.id); (c && c.ifaces || []).forEach((f) => { if (f.ip && f.up && f.linked) rIfs.push({ r, f }); }); });
  let ok = 0; const fb = [];
  hosts.forEach((h) => {
    const c = C.config(h.id);
    if (!c || !c.ip || c.apipa) { fb.push(`${h.name} ยังไม่มี IP ที่ใช้งานได้ จึงตรวจ Default gateway ไม่ได้`); return; }
    if (!c.gateway) { fb.push(`${h.name} ยังไม่ได้ตั้ง Default gateway จึงส่งข้อมูลออกนอกวงไม่ได้`); return; }
    if (!IP.inSubnet(c.gateway, c.ip, c.prefix)) { fb.push(`Default gateway ${c.gateway} ของ ${h.name} ไม่อยู่ในวงเดียวกับ IP ${c.ip}/${c.prefix}`); return; }
    const hit = rIfs.find((x) => x.f.ip === c.gateway);
    if (!hit) { fb.push(`Default gateway ${c.gateway} ของ ${h.name} ไม่ใช่ IP ของ Router ขาที่ต่อกับวงนี้`); return; }
    ok++;
  });
  return { frac: ok / hosts.length, fb };
}

function countMsg(have, need, what) { return have >= need ? null : `ต้องมี ${what} อย่างน้อย ${need} ${what === 'Switch' || what === 'Router' || what === 'Access Point' ? 'ตัว' : 'เครื่อง'} (ตอนนี้มี ${have})`; }
function countsCheck(C, req) {
  const fb = []; let sum = 0;
  req.forEach(([type, need, what]) => {
    const have = C.ofType(type).length;
    sum += Math.min(have, need) / need;
    const m = countMsg(have, need, what); if (m) fb.push(m);
  });
  return { frac: sum / req.length, fb };
}
function sameNetwork(C, hosts) {
  const nets = new Set(hosts.map((h) => C.netOf(h.id)).filter(Boolean));
  return nets.size <= 1;
}

// ---------------------------------------------------------------------------------------------
// mission start topologies (public; no answers inside)
const pc = (id, name, x, y, ip, prefix, extra) => Object.assign({ id, type: 'pc', name, x, y,
  ifaces: [{ name: 'eth0', ip: ip || '', prefix: prefix === undefined ? (ip ? 24 : '') : prefix }], gateway: '', dns: [], dhcp: false }, extra || {});
const link = (id, a, ap, b, bp, medium) => ({ id, a: { dev: a, port: ap }, b: { dev: b, port: bp }, medium: medium || 'utp', up: true });
const ISP = (x, y) => ({ id: 'net1', type: 'internet', name: 'ISP', x, y, ifaces: [{ name: 'wan', ip: '100.64.0.1', prefix: 30 }],
  hosts: { '8.8.8.8': 'dns.google', '1.1.1.1': 'one.one.one.one', '203.0.113.80': 'www.netlab.test' } });

const MISSIONS = [
  { id: 't1', max: MAX, level: 'easy', title: 'PC 2 เครื่องคุยกันผ่าน Switch',
    desc: 'วาง PC 2 เครื่องและ Switch 1 ตัว ต่อสาย UTP จาก PC แต่ละเครื่องเข้า Switch แล้วตั้ง IP ให้อยู่วงเครือข่ายเดียวกัน (เช่น 192.168.1.x ซับเน็ตมาสก์ 255.255.255.0) จากนั้นทดลอง ส่ง Ping หากันให้สำเร็จทั้งไปและกลับ',
    hints: ['ลาก PC และ Switch จากแถบอุปกรณ์มาวาง แล้วเลือกเครื่องมือ "สาย UTP" คลิก PC แล้วคลิก Switch',
      'IP สองเครื่องต้องไม่ซ้ำกันแต่อยู่ Network เดียวกัน เช่น 192.168.1.10/24 กับ 192.168.1.11/24',
      'Subnet mask ต้องเหมือนกันทั้งสองเครื่อง และไม่จำเป็นต้องใส่ Default gateway เพราะคุยกันภายในวงเดียวกัน'],
    start: { devices: [], links: [] } },
  { id: 't2', max: MAX, level: 'easy', title: 'ห้องแล็บเล็ก: PC 4 เครื่อง + เครื่องพิมพ์',
    desc: 'จัดห้องแล็บขนาดเล็ก: Switch 1 ตัว PC 4 เครื่อง และ Printer 1 เครื่อง ต่อทุกเครื่องเข้า Switch ตั้ง IP วงเดียวกันโดยห้ามซ้ำกัน PC ทุกเครื่องต้อง ping ถึงกันและถึงเครื่องพิมพ์ได้',
    hints: ['Switch มีหลายพอร์ต ต่อทุกเครื่องเข้า Switch ตัวเดียวกันได้เลย',
      'วางแผน IP ก่อนตั้ง เช่น PC1–PC4 = 192.168.10.11–14 และ Printer = 192.168.10.50 ทั้งหมดใช้ /24',
      'ดูช่อง "ปัญหาที่พบ" ถ้ามีข้อความ IP ซ้ำ ให้แก้ก่อนส่งงาน'],
    start: { devices: [{ id: 'sw1', type: 'switch', name: 'Switch1', x: 520, y: 300, ports: 24 }], links: [] } },
  { id: 't3', max: MAX, level: 'medium', title: 'ออกอินเทอร์เน็ตผ่าน Router',
    desc: 'LAN 192.168.1.0/24 มี PC 2 เครื่องแล้ว ให้เพิ่ม Router ต่อเข้ากับ Switch และ ISP ตั้ง IP ขา LAN ของ Router (เช่น 192.168.1.1/24) ตั้ง IP ขา WAN เป็น 100.64.0.2/30 (ฝั่ง ISP คือ 100.64.0.1) เพิ่ม Default route บน Router และตั้ง Default gateway ให้ PC จน PC ทุกเครื่อง ping 8.8.8.8 ได้',
    hints: ['Router ต้องมีสายสองเส้น: ขาหนึ่งเข้า Switch (LAN) อีกขาเข้า ISP (WAN) แต่ละขาเป็นคนละวงเครือข่าย',
      'Default gateway ของ PC = IP ของ Router ขาที่ต่อกับ LAN',
      'Default route คือเส้นทาง 0.0.0.0/0 (mask 0.0.0.0) โดยมี Next hop เป็น IP ของ ISP 100.64.0.1'],
    start: { devices: [
      { id: 'sw1', type: 'switch', name: 'Switch1', x: 420, y: 320, ports: 24 },
      pc('pc1', 'PC1', 260, 500, '192.168.1.10', 24), pc('pc2', 'PC2', 580, 500, '192.168.1.11', 24),
      ISP(1000, 320)
    ], links: [link('l1', 'pc1', 'eth0', 'sw1', 'p1'), link('l2', 'pc2', 'eth0', 'sw1', 'p2')] } },
  { id: 't4', max: MAX, level: 'medium', title: 'เชื่อม 2 วงเครือข่ายด้วย Router',
    desc: 'มี LAN 2 วง: วง A 192.168.10.0/24 (Switch-A) และวง B 192.168.20.0/24 (Switch-B) ให้เพิ่ม Router ต่อสายเข้า Switch ทั้งสองตัว ตั้ง IP ของ Router ขาละวง และตั้ง Default gateway ของ PC ทุกเครื่อง ให้ PC ping ข้ามวงได้ทั้งไปและกลับ',
    hints: ['Router หนึ่งขา (interface) ต่อได้หนึ่งวงเครือข่าย ขา g0/0 ใช้วง A ขา g0/1 ใช้วง B',
      'ห้ามตั้ง IP ของสองขาให้อยู่วงเดียวกัน เช่น 192.168.10.1 กับ 192.168.10.2 — Router จะสับสนว่าจะส่งออกขาไหน',
      'PC วง A ใช้ gateway = IP ของ Router ขาวง A ส่วน PC วง B ใช้ IP ขาวง B ถ้าตั้งผิดฝั่งเดียว ping จะไปถึงแต่ตอบกลับไม่ได้ (Request timed out)'],
    start: { devices: [
      { id: 'sw1', type: 'switch', name: 'Switch-A', x: 300, y: 330, ports: 24 },
      { id: 'sw2', type: 'switch', name: 'Switch-B', x: 900, y: 330, ports: 24 },
      pc('pc1', 'PC-A1', 180, 520, '192.168.10.10', 24), pc('pc2', 'PC-A2', 420, 520, '192.168.10.11', 24),
      pc('pc3', 'PC-B1', 780, 520, '192.168.20.10', 24), pc('pc4', 'PC-B2', 1020, 520, '192.168.20.11', 24)
    ], links: [link('l1', 'pc1', 'eth0', 'sw1', 'p1'), link('l2', 'pc2', 'eth0', 'sw1', 'p2'),
      link('l3', 'pc3', 'eth0', 'sw2', 'p1'), link('l4', 'pc4', 'eth0', 'sw2', 'p2')] } },
  { id: 't5', max: MAX, level: 'medium', title: 'แจก IP อัตโนมัติด้วย DHCP',
    desc: 'เปิดบริการ DHCP บน Server1 (IP 192.168.1.5/24) กำหนดช่วงแจก IP (DHCP pool) เช่น 192.168.1.100 ถึง 192.168.1.150 แล้วตั้ง PC ทุกเครื่องให้รับ IP อัตโนมัติ (DHCP) PC ทุกเครื่องต้องได้ IP จาก Server1 และ ping Server1 ได้',
    hints: ['เลือก Server1 แล้วติ๊ก "เปิดบริการ DHCP" กรอกช่วงเริ่ม–สิ้นสุด และ Subnet mask ของ pool',
      'ช่วงแจก IP ต้องอยู่วงเดียวกับ IP ของ Server และไม่ควรรวม IP ที่ใช้อยู่แล้ว',
      'ถ้า PC ได้ IP 169.254.x.x (APIPA) แปลว่าติดต่อ DHCP server ไม่ได้ ตรวจสายและการตั้งค่า pool'],
    start: { devices: [
      { id: 'sw1', type: 'switch', name: 'Switch1', x: 560, y: 300, ports: 24 },
      { id: 'srv1', type: 'server', name: 'Server1', x: 560, y: 110, ifaces: [{ name: 'eth0', ip: '192.168.1.5', prefix: 24 }], gateway: '', dns: [], dhcp: false, services: {} },
      pc('pc1', 'PC1', 340, 490), pc('pc2', 'PC2', 560, 490), pc('pc3', 'PC3', 780, 490)
    ], links: [link('l1', 'srv1', 'eth0', 'sw1', 'p1'), link('l2', 'pc1', 'eth0', 'sw1', 'p2'),
      link('l3', 'pc2', 'eth0', 'sw1', 'p3'), link('l4', 'pc3', 'eth0', 'sw1', 'p4')] } },
  { id: 't6', max: MAX, level: 'medium', title: 'Wi-Fi: Laptop เชื่อมต่อ Access Point',
    desc: 'ต่อ Access Point "AP-Lab" เข้ากับ Switch ด้วยสาย UTP วาง Laptop 2 เครื่อง เชื่อมต่อ Wi-Fi เข้ากับ AP โดยตั้ง SSID ของ Laptop ให้ตรงกับ AP (NETLAB-ROOM3) ห้ามเปลี่ยน SSID ของ AP ตั้ง IP วง 192.168.1.0/24 แล้วให้ Laptop ทั้งสองเครื่อง ping FileServer ได้',
    hints: ['ใช้เครื่องมือ "Wi-Fi" คลิก Laptop แล้วคลิก AP (Wi-Fi ต่อได้เฉพาะเครื่องลูกข่ายกับ Access Point)',
      'SSID ต้องสะกดตรงกันทุกตัวอักษร ตัวพิมพ์เล็ก/ใหญ่ก็มีผล',
      'AP ทำหน้าที่เหมือน Switch: Laptop กับ FileServer อยู่วงเดียวกัน จึงไม่ต้องใช้ Router'],
    start: { devices: [
      { id: 'sw1', type: 'switch', name: 'Switch1', x: 380, y: 300, ports: 24 },
      { id: 'srv1', type: 'server', name: 'FileServer', x: 160, y: 300, ifaces: [{ name: 'eth0', ip: '192.168.1.10', prefix: 24 }], gateway: '', dns: [], dhcp: false, services: { file: true } },
      { id: 'ap1', type: 'ap', name: 'AP-Lab', x: 700, y: 300, ssid: 'NETLAB-ROOM3', security: 'WPA2', ports: 1 }
    ], links: [link('l1', 'srv1', 'eth0', 'sw1', 'p1')] } },
  { id: 't7', max: MAX, level: 'hard', title: 'DNS: เรียกเครื่องด้วยชื่อ',
    desc: 'เครือข่ายนี้ออกอินเทอร์เน็ตได้แล้ว ให้เปิดบริการ DNS บน Server1 (192.168.1.5) เพิ่มระเบียน srv.lab.local ให้ชี้ไปที่ IP ของ Server1 และตั้ง DNS server ของ PC ทุกเครื่อง ให้ PC ping ด้วยชื่อ srv.lab.local และ www.netlab.test (เว็บบนอินเทอร์เน็ต) ได้',
    hints: ['DNS ทำหน้าที่แปลงชื่อเป็น IP: เลือก Server1 ติ๊ก "เปิดบริการ DNS" แล้วเพิ่มระเบียน ชื่อ → IP',
      'PC ต้องรู้ว่าจะถามชื่อจากใคร: ตั้ง DNS server ของ PC เป็น IP ของ Server1',
      'ชื่อบนอินเทอร์เน็ต (www.netlab.test) DNS ภายในจะส่งต่อไปถามอินเทอร์เน็ตให้ ถ้า Server1 ออกอินเทอร์เน็ตได้ (มี Default gateway)'],
    start: { devices: [
      { id: 'r1', type: 'router', name: 'Router1', x: 700, y: 140,
        ifaces: [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24 }, { name: 'g0/1', ip: '100.64.0.2', prefix: 30 }, { name: 'g0/2', ip: '', prefix: '' }, { name: 'g0/3', ip: '', prefix: '' }],
        routes: [{ net: '0.0.0.0', prefix: 0, via: '100.64.0.1' }] },
      ISP(1040, 140),
      { id: 'sw1', type: 'switch', name: 'Switch1', x: 700, y: 330, ports: 24 },
      { id: 'srv1', type: 'server', name: 'Server1', x: 420, y: 330, ifaces: [{ name: 'eth0', ip: '192.168.1.5', prefix: 24 }], gateway: '192.168.1.1', dns: [], dhcp: false, services: {} },
      pc('pc1', 'PC1', 560, 520, '192.168.1.10', 24, { gateway: '192.168.1.1' }),
      pc('pc2', 'PC2', 840, 520, '192.168.1.11', 24, { gateway: '192.168.1.1' })
    ], links: [link('l1', 'r1', 'g0/1', 'net1', 'wan'), link('l2', 'r1', 'g0/0', 'sw1', 'p1'), link('l3', 'srv1', 'eth0', 'sw1', 'p2'),
      link('l4', 'pc1', 'eth0', 'sw1', 'p3'), link('l5', 'pc2', 'eth0', 'sw1', 'p4')] } },
  // guided tutorial (browser coaches step by step; the grade comes only from the final topology + pings run here)
  { id: 't8', max: MAX, level: 'easy', title: 'โหมดฝึกทีละขั้น: จาก 2 เครื่องสู่ 2 วงเครือข่าย',
    desc: 'ฝึกทีละขั้นสำหรับผู้เริ่มต้น: วาง PC 2 เครื่องกับ Switch ต่อสาย ตั้ง IP ให้อยู่วงเดียวกัน แล้ว ping ให้สำเร็จ จากนั้นหาสาเหตุเมื่อ IP ผิดวง และขยายเป็น 2 วงเครือข่ายด้วย Router (เพิ่ม PC อีกเครื่องในวงที่ 2 ตั้ง IP ขา Router และ Default gateway) จน ping ข้ามวงได้ ระบบตรวจจากแผนผังสุดท้ายและผล ping ที่คำนวณบนเซิร์ฟเวอร์',
    hints: ['ทำตามขั้นในกล่อง "โหมดฝึกทีละขั้น" ทีละข้อ ระบบจะติ๊กให้เองเมื่อเครือข่ายจริงถูกต้อง',
      'PC สองเครื่องแรกเป็นวงที่ 1 (เช่น 192.168.1.0/24) PC เครื่องที่ 3 อยู่วงที่ 2 (เช่น 192.168.2.0/24) ต่อเข้ากับ Router อีกขาหนึ่ง',
      'Default gateway ของแต่ละเครื่อง = IP ของ Router ขาที่อยู่วงเดียวกับเครื่องนั้น'],
    start: { devices: [], links: [] } },
  // 2.8 Final Network Capstone: auto rubric (NetSim.capstone.evaluate) + teacher-scored criteria
  { id: 't9', max: 40, level: 'hard', title: 'โครงงานปิดท้าย: ออกแบบเครือข่ายวิทยาลัย',
    desc: 'วิทยาลัยต้องการเครือข่ายเดียวสำหรับ 3 ส่วน: (1) ห้องปฏิบัติการคอมพิวเตอร์ PC นักเรียน 30 เครื่อง (2) ห้องพักครู PC 12 เครื่อง + เครื่องพิมพ์ 1 เครื่อง + Wi-Fi สำหรับอุปกรณ์ของครู 10 เครื่อง (3) สำนักงาน PC 8 เครื่อง + File server ทุกส่วนใช้อินเทอร์เน็ตร่วมกันผ่าน ISP จุดเดียว ' +
      'ให้เลือกและวางอุปกรณ์ (Router, Switch ห้องละตัว, Access Point, Server) ต่อสาย วางแผน IP จากบล็อก 172.16.10.0/24 แบ่ง Subnet ห้องละวงด้วย VLSM (ขนาดพอดี ไม่ซ้อนทับ) ตั้ง Gateway และ DNS ตั้งค่า Wi-Fi ให้ปลอดภัย (WPA2/WPA3 พร้อมรหัสผ่าน) ' +
      'ตั้งกฎไฟร์วอลล์บน Router ตามนโยบาย "ห้องแล็บนักเรียนกับสำนักงานติดต่อกันไม่ได้" (ห้องอื่นติดต่อกันได้และออกอินเทอร์เน็ตได้ทุกห้อง) ทดสอบการเชื่อมต่อ แล้วแก้เหตุขัดข้องที่ระบบจำลองให้หลังสร้างเสร็จ สุดท้ายเขียนรายงานเหตุผลการออกแบบและผลการทดสอบ ' +
      'ในแผนผังวางเครื่องตัวแทนก็พอ (เช่น ห้องละ 2 PC) แต่แผน IP ต้องรองรับจำนวนเครื่องจริงทั้งหมด',
    hints: ['เริ่มจากวางแผน IP ก่อน: นับ IP ที่ต้องใช้ของแต่ละห้อง (รวม Gateway 1 IP) แล้วจัดห้องที่ใหญ่ที่สุดก่อน (largest first) จะได้ไม่ซ้อนทับ',
      'ห้องแล็บต้องการ 31 IP จึงใช้ /26 (62 IP) ห้องครูต้องการ 24 IP ใช้ /27 (30 IP) สำนักงานต้องการ 10 IP ใช้ /28 (14 IP) — Network address ของแต่ละวงต้องเป็นผลคูณของขนาดบล็อก',
      'Router 1 ตัวมี 4 ขา: ใช้ 3 ขาต่อ Switch ของแต่ละห้อง อีก 1 ขาต่อ ISP (WAN 100.64.0.2/30 ฝั่ง ISP คือ 100.64.0.1) แล้วเพิ่ม Default route',
      'กฎไฟร์วอลล์ deny จาก Network ของห้องแล็บ ไปยัง Network ของสำนักงาน ก็พอ เพราะไฟร์วอลล์ในระบบจำลองเป็นแบบ stateless คำตอบกลับก็ถูกบล็อกด้วย',
      'เมื่อเครือข่ายผ่านการทดสอบทั้งหมด ระบบจะแจ้งปัญหาจากผู้ใช้ 1 เรื่อง ให้ใช้ ping/traceroute และดูการตั้งค่าเพื่อหาสาเหตุแล้วแก้'],
    review: { teacher: [
      { id: 'rationale', title: 'คุณภาพเหตุผลการออกแบบ', max: 5, desc: 'อธิบายได้ว่าทำไมเลือกอุปกรณ์/โครงสร้างนี้ ทำไมแบ่ง Subnet ขนาดนี้ (VLSM) และมาตรการความปลอดภัยที่เลือกป้องกันอะไร' },
      { id: 'clarity', title: 'ความชัดเจนของรายงานและหลักฐานการทดสอบ', max: 5, desc: 'รายงานเป็นลำดับ อ่านเข้าใจง่าย มีผลการทดสอบ (ping/traceroute) ที่ตรงกับเครือข่ายจริง และอธิบายการหาสาเหตุ/แก้เหตุขัดข้อง' }
    ] },
    start: { devices: [ISP(1100, 120)], links: [] } },
  // 3.1 NAT/PAT + ACL missions: start topologies and the test matrix live in NetSim.natlab (shared with the browser)
  { id: 't10', max: MAX, level: 'medium', title: 'ออกอินเทอร์เน็ตด้วย NAT/PAT',
    desc: 'ห้องแล็บใช้ LAN 192.168.1.0/24 (Private IP) และได้ Public IP จาก ISP มา 1 ชุดคือวง 198.51.100.0/30 (Router ขา WAN = 198.51.100.2, ISP = 198.51.100.1) ' +
      'ISP นี้ไม่รับแพ็กเก็ตที่ IP ต้นทางเป็น Private IP ตอนนี้ PC จึงออกอินเทอร์เน็ตไม่ได้ ให้ตั้งค่า NAT บน Router1: กำหนดขา LAN เป็น ip nat inside ขา WAN เป็น ip nat outside ' +
      'และเปิด PAT (NAT overload) ใช้ IP ของขา WAN แปลงให้ทั้งวง 192.168.1.0/24 จน PC ทุกเครื่อง ping 8.8.8.8 และเปิดเว็บ www.netlab.test (203.0.113.80) ได้ ' +
      'แล้วดูตาราง NAT (show ip nat translations) ว่ามีรายการแปลงของทุกเครื่อง ภารกิจนี้ไม่ต้องใช้ Static NAT',
    hints: ['ลอง ping 8.8.8.8 จาก PC ก่อนแก้ ระบบจะบอกว่า ISP ทิ้งแพ็กเก็ตเพราะ IP ต้นทางเป็น Private IP',
      'เลือก Router1 → ในกล่องของแต่ละขา ตั้ง "NAT" ของขาที่ต่อ Switch เป็น inside และขาที่ต่อ ISP เป็น outside',
      'ส่วน NAT/PAT: ติ๊ก "เปิด PAT (overload)" เลือกขา WAN และใส่เครือข่ายภายใน 192.168.1.0/24 (หรือ 192.168.1.0 0.0.0.255 แบบ Wildcard)',
      'หลังทดสอบ ดูตาราง NAT: PC หลายเครื่องใช้ Public IP เดียวกันได้เพราะ Router แยกกันด้วยหมายเลขพอร์ต (Port Address Translation)'],
    start: NetSim.natlab.start('t10') },
  { id: 't11', max: MAX, level: 'medium', title: 'เปิดเว็บเซิร์ฟเวอร์ในวิทยาลัยให้คนนอกเข้าได้',
    desc: 'วิทยาลัยมี WebServer (192.168.1.10) ใน LAN ต้องการให้คนภายนอก (ทดสอบจากเครื่อง Outside-PC บนอินเทอร์เน็ต) เปิดเว็บของวิทยาลัยได้ทาง Public IP 198.51.100.2 พอร์ต 443 (HTTPS) และ 80 (HTTP) ' +
      'แต่ต้องไม่เปิดบริการอื่นของเครื่องนี้ (Remote Desktop 3389, SSH 22) ให้คนภายนอก ในขณะเดียวกัน PC ใน LAN ต้องออกอินเทอร์เน็ตได้ ' +
      'ตั้งค่า NAT inside/outside, PAT สำหรับ PC และ Port forwarding (Static NAT แบบระบุพอร์ต) บน Router1 แล้วทดสอบพอร์ตจาก Outside-PC',
    hints: ['Port forwarding = Static NAT แบบระบุพอร์ต: TCP 198.51.100.2:443 → 192.168.1.10:443 (เพิ่มอีกข้อสำหรับพอร์ต 80)',
      'ห้ามใช้ Static NAT แบบทุกพอร์ต (ip) เพราะจะเปิด 3389 และ 22 ให้คนทั้งอินเทอร์เน็ตด้วย — เปิดเท่าที่จำเป็น (Least privilege)',
      'ถ้า Outside-PC ส่งไปถึง WebServer แล้วแต่ไม่ได้คำตอบ ให้ตรวจ Default gateway ของ WebServer (คำตอบต้องกลับออกทาง Router)',
      'ทดสอบด้วยแผงทดสอบ: เลือกต้นทาง Outside-PC ปลายทาง 198.51.100.2 แล้วเลือก "HTTPS (TCP 443)" เทียบกับ "RDP (TCP 3389)"'],
    start: NetSim.natlab.start('t11') },
  { id: 't12', max: MAX, level: 'medium', title: 'ACL: ห้องนักเรียนเข้าเซิร์ฟเวอร์ได้เฉพาะเว็บ',
    desc: 'R1 เชื่อม 3 วง: ห้องนักเรียน 192.168.10.0/24, ห้องครู 192.168.20.0/24 และห้องเซิร์ฟเวอร์ 192.168.30.0/24 (WebServer 192.168.30.10 เปิด Web/SSH/Remote Desktop, DNS-Server 192.168.30.53) ' +
      'นโยบาย: เครื่องห้องนักเรียนใช้ได้เฉพาะเว็บ (TCP 80 และ 443) ของ WebServer และ DNS (UDP 53) ของ DNS-Server เท่านั้น — SSH, Remote Desktop และ Ping ไปเซิร์ฟเวอร์ต้องถูกบล็อก ' +
      'ส่วนห้องครูใช้งานเซิร์ฟเวอร์ได้ทุกบริการ ให้สร้าง Extended ACL บน R1 และผูกกับขาที่เหมาะสม (ทิศ in/out) แล้วทดสอบด้วยการทดสอบพอร์ต',
    hints: ['Extended ACL ควรวางใกล้ต้นทาง: ผูกกับขา g0/0 (ห้องนักเรียน) ทิศ in',
      'กฎตรวจจากบนลงล่าง ข้อแรกที่ตรงจะถูกใช้ และท้าย ACL มี implicit deny (deny ip any any) ซ่อนอยู่เสมอ — permit เฉพาะสิ่งที่อนุญาตก็พอ',
      'ตัวอย่างกฎ: permit tcp 192.168.10.0 0.0.0.255 host 192.168.30.10 eq 443 (Wildcard 0.0.0.255 = /24)',
      'ACL ไม่จำสถานะ (stateless) ถ้าผูกทิศ out ที่ขาห้องนักเรียน คำตอบจากเซิร์ฟเวอร์จะถูกตรวจแทนคำขอ'],
    start: NetSim.natlab.start('t12') },
  { id: 't13', max: MAX, level: 'hard', title: 'แก้ปัญหา: ACL และ NAT ตั้งค่าผิด',
    desc: 'ผู้ดูแลคนเดิมตั้งค่า R1 ไว้แล้วแต่ผู้ใช้แจ้งปัญหา: (1) นักเรียนเปิดเว็บและใช้ DNS ของวิทยาลัยไม่ได้เลย (2) ทุกเครื่องออกอินเทอร์เน็ตไม่ได้ (3) คนภายนอกเข้าเว็บ https://198.51.100.2 ไม่ได้ ' +
      'นโยบายที่ต้องการ: นักเรียน (192.168.10.0/24) ใช้เว็บ TCP 80/443 ของ WebServer 192.168.30.10 และ DNS UDP 53 ของ 192.168.30.53 ได้ ออกอินเทอร์เน็ตได้ แต่ SSH และ Ping ไปห้องเซิร์ฟเวอร์ต้องถูกบล็อก; ' +
      'เซิร์ฟเวอร์ออกอินเทอร์เน็ตได้; คนภายนอกเข้าได้เฉพาะ HTTPS ของ WebServer ' +
      'ให้หาสาเหตุด้วยการทดสอบ (Ping/ทดสอบพอร์ต ดูกฎ ACL ที่ตรงและตาราง NAT) แล้วแก้ ACL (ลำดับกฎ ทิศ Wildcard) และ NAT inside/outside ให้ถูก — ห้ามลบ ACL และห้ามใช้ทางลัด permit ip any any (ถูกหักคะแนน)',
    hints: ['เริ่มจาก ping 8.8.8.8 จาก S-PC1 แล้วอ่านสาเหตุ: ISP ทิ้งแพ็กเก็ตที่ยังเป็น Private IP แปลว่า NAT ยังไม่ทำงาน — ตรวจว่าขาไหนควรเป็น inside/outside',
      'ทดสอบ S-PC1 → 192.168.30.10 HTTPS แล้วดู "กฎ ACL ที่ตรง" ว่าถูกบล็อกตอนขาไปหรือขากลับ ถ้าขากลับแปลว่าผูก ACL ผิดทิศ',
      'กฎ deny ที่กว้างต้องอยู่หลังกฎ permit ที่เจาะจง (ข้อแรกที่ตรงชนะ) ใช้ปุ่มเลื่อนขึ้น/ลงเพื่อจัดลำดับ',
      'Wildcard ไม่ใช่ Subnet mask: /24 เขียนเป็น 0.0.0.255 ไม่ใช่ 255.255.255.0 (ดูแท็บ "ปัญหา")'],
    start: NetSim.natlab.start('t13') },
  // ---- Phase 4: early-week practice (w1–w3). Graded by CHECKS below from the submitted topology only; `week`/`mode` are
  // public metadata. A mission may carry a short observation quiz in start.quiz (questions + options only, the key is
  // QUIZ_KEY on the server and the student's choice travels as payload.answers).
  { id: 't14', max: MAX, level: 'easy', week: 1, mode: 'guided', title: 'Client-Server: แชร์ไฟล์จาก File Server ใน LAN แบบ Star',
    desc: 'สำนักงานเล็กต้องการเก็บไฟล์งานไว้ที่เครื่องแม่ข่ายเครื่องเดียว (สถาปัตยกรรม Client-Server) แทนการแชร์จากเครื่องใครเครื่องมัน ' +
      'ให้วาง PC (Client) อย่างน้อย 3 เครื่อง ต่อสายจากทุกเครื่องและ FileServer เข้า Switch1 คนละเส้น (รูปแบบ Star topology) ตั้ง IP ให้ทุกเครื่องอยู่วงเครือข่ายเดียวกัน ' +
      'เปิดบริการแชร์ไฟล์บน FileServer แล้วทดสอบว่า Client ทุกเครื่องเปิดแชร์ไฟล์ (SMB TCP 445) บน FileServer ได้',
    hints: ['ขั้นที่ 1: วาง PC 3 เครื่องรอบ Switch1 (แตะปุ่ม PC แล้วแตะบนพื้นที่วาด) เครื่องเหล่านี้คือ Client ที่มาขอใช้บริการ',
      'ขั้นที่ 2: เลือกเครื่องมือ "สาย UTP" ต่อ PC ทุกเครื่องและ FileServer เข้า Switch1 เครื่องละ 1 เส้น ห้ามต่อ PC ต่อกันเป็นทอด ๆ — ทุกเครื่องมีสายของตัวเองเข้าอุปกรณ์ศูนย์กลางคือลักษณะของ Star',
      'ขั้นที่ 3: ตั้ง IP ให้ทุกเครื่องอยู่วงเดียวกันและไม่ซ้ำกัน เช่น FileServer 192.168.1.5/24 และ PC 192.168.1.11–13/24 (ไม่ต้องใช้ Default gateway เพราะอยู่วงเดียวกัน)',
      'ขั้นที่ 4: เลือก FileServer แล้วติ๊ก "แชร์ไฟล์ (File server, SMB TCP 445)" — Server คือเครื่องที่ให้บริการ ส่วน PC เป็นผู้ขอใช้บริการ',
      'ขั้นที่ 5: ในแผงทดสอบ เลือกต้นทางเป็น PC ใส่ปลายทางเป็น IP ของ FileServer แล้วเลือก "แชร์ไฟล์ SMB (TCP 445)" ทำให้ครบทุก Client แล้วกดตรวจงาน'],
    start: { devices: [
      { id: 'sw1', type: 'switch', name: 'Switch1', x: 600, y: 320, ports: 24 },
      { id: 'srv1', type: 'server', name: 'FileServer', x: 600, y: 120, ifaces: [{ name: 'eth0', ip: '', prefix: '' }], gateway: '', dns: [], dhcp: false, services: {} }
    ], links: [] } },
  { id: 't15', max: MAX, level: 'medium', week: 1, mode: 'independent', title: 'เชื่อม LAN ของ 2 สาขาผ่าน WAN',
    desc: 'บริษัทมีสาขากรุงเทพฯ (LAN 192.168.10.0/24) และสาขาเชียงใหม่ (LAN 192.168.20.0/24) ซึ่งอยู่ห่างกันหลายร้อยกิโลเมตร แต่ละสาขามี Switch และ PC พร้อมแล้ว ' +
      'ให้ออกแบบการเชื่อมต่อให้ PC ทุกเครื่องของสองสาขาติดต่อกันได้: แต่ละสาขาต้องมี Router ของตัวเองต่อกับ LAN ของสาขา และ Router สองสาขาเชื่อมกันด้วยลิงก์ WAN ' +
      '(ของจริงเป็นวงจรที่เช่าจากผู้ให้บริการ ในระบบจำลองให้ใช้สายไฟเบอร์แทน และใช้วง IP ของลิงก์ WAN แยกจาก LAN ทั้งสอง) ' +
      'ตั้ง IP ขา Router, Default gateway และเส้นทาง (static route) ให้ครบ แล้วตอบคำถามว่าส่วนใดเป็น LAN ส่วนใดเป็น WAN',
    hints: ['LAN คือเครือข่ายภายในสาขาที่เป็นของบริษัทเอง ส่วนเส้นทางระหว่างสาขาที่ไกลข้ามจังหวัดคือ WAN ซึ่งต้องเชื่อมผ่าน Router ห้ามต่อ Switch ของสองสาขาเข้าหากันตรง ๆ',
      'ลิงก์ WAN ระหว่าง Router สองตัวเป็นวงเครือข่ายเล็ก ๆ ของมันเอง เช่น 10.0.0.0/30 (Router กรุงเทพฯ 10.0.0.1, Router เชียงใหม่ 10.0.0.2)',
      'Router แต่ละตัวรู้จักเฉพาะวงที่ต่ออยู่ ต้องเพิ่ม static route ไปยัง LAN ของอีกสาขา โดยใช้ Next hop เป็น IP ของ Router อีกฝั่งในวง WAN',
      'Default gateway ของ PC แต่ละสาขา = IP ของ Router สาขาตัวเองขาที่ต่อกับ LAN'],
    start: { devices: [
      { id: 'swA', type: 'switch', name: 'Switch-BKK', x: 260, y: 330, ports: 24 },
      pc('pcA1', 'PC-BKK1', 140, 510, '192.168.10.10', 24), pc('pcA2', 'PC-BKK2', 380, 510, '192.168.10.11', 24),
      { id: 'swB', type: 'switch', name: 'Switch-CNX', x: 940, y: 330, ports: 24 },
      pc('pcB1', 'PC-CNX1', 820, 510, '192.168.20.10', 24), pc('pcB2', 'PC-CNX2', 1060, 510, '192.168.20.11', 24)
    ], links: [link('l1', 'pcA1', 'eth0', 'swA', 'p1'), link('l2', 'pcA2', 'eth0', 'swA', 'p2'),
      link('l3', 'pcB1', 'eth0', 'swB', 'p1'), link('l4', 'pcB2', 'eth0', 'swB', 'p2')],
    quiz: [
      { id: 'q1', q: 'เครือข่ายภายในสาขากรุงเทพฯ (Switch-BKK กับ PC ในสาขา) เป็นเครือข่ายประเภทใด', options: ['PAN', 'LAN', 'MAN', 'WAN'] },
      { id: 'q2', q: 'ลิงก์ระหว่าง Router สาขากรุงเทพฯ กับ Router สาขาเชียงใหม่ (ข้ามจังหวัด เช่าวงจรจากผู้ให้บริการ) เป็นเครือข่ายประเภทใด', options: ['PAN', 'LAN', 'MAN', 'WAN'] }
    ] } },
  { id: 't16', max: MAX, level: 'easy', week: 2, mode: 'guided', title: 'เปลี่ยน Hub เป็น Switch แล้วสังเกตความต่าง',
    desc: 'ห้องแล็บเก่ายังใช้ Hub1 เป็นศูนย์กลางของ PC 4 เครื่อง (ใช้งานได้แต่ช้าเมื่อหลายเครื่องส่งข้อมูลพร้อมกัน) ' +
      'ให้ทดลอง Ping จาก PC1 ไป PC3 แล้วดูในตัวตรวจเฟรมว่าเครื่องใดได้รับเฟรมบ้าง จากนั้นเปลี่ยนศูนย์กลางเป็น Switch: วาง Switch ย้ายสายของ PC ทุกเครื่องไปเข้า Switch ลบ Hub ออก ' +
      'Ping อีกครั้งเพื่อเทียบผล ดู Collision domain ของ Switch แล้วตอบคำถามจากสิ่งที่สังเกตได้ (IP ของ PC ตั้งไว้ถูกต้องแล้ว)',
    hints: ['ขั้นที่ 1: เลือกเครื่องมือ "ส่ง Ping" แตะ PC1 แล้วแตะ PC3 ดูจุดสีจาง ๆ ที่เครื่องอื่น และเปิดดูรายละเอียดแต่ละขั้นในแผงผลลัพธ์ (ตัวตรวจเฟรม)',
      'ขั้นที่ 2: เลือก Hub1 แล้วดูส่วน Collision domain: ทุกพอร์ตของ Hub อยู่ในโดเมนเดียวกัน จึงส่งพร้อมกันได้ทีละเครื่อง (Half-duplex)',
      'ขั้นที่ 3: วาง Switch แล้วต่อสาย UTP จาก PC แต่ละเครื่องเข้า Switch (เลือกสายเดิมที่ต่อกับ Hub แล้วลบ หรือลบ Hub ทีเดียว สายของ Hub จะหายไปด้วย)',
      'ขั้นที่ 4: Ping PC1 ไป PC3 อีกครั้ง 2 รอบ: รอบแรก Switch ยังไม่รู้ MAC จึงส่งออกทุกพอร์ต (Flood) รอบถัดไปส่งตรงพอร์ตปลายทางตามตาราง MAC',
      'ขั้นที่ 5: เลือก Switch ดูตาราง MAC และจำนวน Collision domain แล้วตอบคำถามท้ายภารกิจก่อนกดตรวจงาน'],
    start: { devices: [
      { id: 'hub1', type: 'hub', name: 'Hub1', x: 600, y: 300, ports: 8 },
      pc('pc1', 'PC1', 300, 140, '192.168.1.11', 24), pc('pc2', 'PC2', 900, 140, '192.168.1.12', 24),
      pc('pc3', 'PC3', 300, 480, '192.168.1.13', 24), pc('pc4', 'PC4', 900, 480, '192.168.1.14', 24)
    ], links: [link('l1', 'pc1', 'eth0', 'hub1', 'p1'), link('l2', 'pc2', 'eth0', 'hub1', 'p2'),
      link('l3', 'pc3', 'eth0', 'hub1', 'p3'), link('l4', 'pc4', 'eth0', 'hub1', 'p4')],
    quiz: [
      { id: 'q1', q: 'ตอนที่ยังใช้ Hub1: เมื่อ PC1 ส่ง Ping ไปหา PC3 เครื่องใดได้รับเฟรมนั้นบ้าง', options: ['เฉพาะ PC3', 'PC2, PC3 และ PC4', 'ไม่มีเครื่องใดได้รับนอกจาก Hub1', 'เฉพาะ PC1 และ PC3'] },
      { id: 'q2', q: 'หลังเปลี่ยนเป็น Switch ที่มี PC 4 เครื่องต่ออยู่ (พอร์ตละเครื่อง) จะมี Collision domain กี่โดเมน', options: ['1 โดเมน', '2 โดเมน', '4 โดเมน', '8 โดเมน'] },
      { id: 'q3', q: 'Hub และ Switch ทำงานในชั้นใดของแบบจำลอง OSI ตามลำดับ', options: ['ชั้น 1 (Physical) และชั้น 2 (Data Link)', 'ชั้น 2 (Data Link) และชั้น 3 (Network)', 'ชั้น 1 (Physical) ทั้งคู่', 'ชั้น 3 (Network) และชั้น 2 (Data Link)'] }
    ] } },
  { id: 't17', max: MAX, level: 'medium', week: 2, mode: 'independent', title: 'เลือกอุปกรณ์ให้ตรงงาน: Switch, Access Point และ Router',
    desc: 'สำนักงานมี 2 แผนกที่ใช้คนละวงเครือข่าย: ฝ่ายบัญชี 192.168.10.0/24 (PC-ACC1, PC-ACC2 และ Printer-ACC ใช้สาย) และฝ่ายขาย 192.168.20.0/24 (PC-SALES1 ใช้สาย, Laptop-SALES1 และ Laptop-SALES2 ใช้ Wi-Fi) ' +
      'ทุกเครื่องตั้ง IP และ Default gateway (.1 ของวงตัวเอง) ไว้แล้ว ให้เลือกอุปกรณ์เครือข่ายที่เหมาะสมมาวางและต่อสายเอง: ' +
      'อุปกรณ์ศูนย์กลางของแต่ละแผนก อุปกรณ์ให้ Laptop ฝ่ายขายเข้าเครือข่ายแบบไร้สาย และอุปกรณ์ที่เชื่อมสองแผนกซึ่งอยู่คนละวงให้คุยกันได้ (แต่ละแผนกต้องเป็น Broadcast domain แยกกัน) ' +
      'สุดท้ายทุกเครื่องต้อง Ping หากันได้ทั้งในแผนกและข้ามแผนก และ Ping ถึง Printer-ACC ได้',
    hints: ['อุปกรณ์ศูนย์กลางของ LAN ปัจจุบันคือ Switch ซึ่งส่งเฟรมตรงพอร์ตปลายทางตาม MAC ส่วน Hub กระจายทุกพอร์ตและเป็นอุปกรณ์รุ่นเก่า',
      'Access Point เชื่อมเครื่อง Wi-Fi เข้ากับ LAN แบบมีสายในวงเดียวกัน (ทำงานคล้าย Bridge) ต้องต่อสาย UTP เข้า Switch ของฝ่ายขาย และตั้ง SSID ของ Laptop ให้ตรงกับ AP',
      'Switch ไม่ส่งแพ็กเก็ตข้ามวงเครือข่าย ถ้าต่อ Switch สองแผนกเข้าหากันตรง ๆ ทั้งสองแผนกจะกลายเป็น Broadcast domain เดียวกันแต่ IP ยังคนละวง — อุปกรณ์ที่ส่งข้ามวงด้วย IP คือ Router',
      'Router ต้องตั้ง IP ขาละวงให้ตรงกับ Default gateway ที่เครื่องในแผนกนั้นใช้อยู่'],
    start: { devices: [
      pc('pcA1', 'PC-ACC1', 140, 470, '192.168.10.11', 24, { gateway: '192.168.10.1' }),
      pc('pcA2', 'PC-ACC2', 330, 520, '192.168.10.12', 24, { gateway: '192.168.10.1' }),
      { id: 'prn1', type: 'printer', name: 'Printer-ACC', x: 120, y: 260, ifaces: [{ name: 'eth0', ip: '192.168.10.50', prefix: 24 }], gateway: '192.168.10.1', dns: [], dhcp: false },
      pc('pcS1', 'PC-SALES1', 820, 520, '192.168.20.11', 24, { gateway: '192.168.20.1' }),
      { id: 'lt1', type: 'laptop', name: 'Laptop-SALES1', x: 980, y: 470, ifaces: [{ name: 'wlan0', ip: '192.168.20.21', prefix: 24 }], gateway: '192.168.20.1', dns: [], dhcp: false, ssid: '' },
      { id: 'lt2', type: 'laptop', name: 'Laptop-SALES2', x: 1100, y: 330, ifaces: [{ name: 'wlan0', ip: '192.168.20.22', prefix: 24 }], gateway: '192.168.20.1', dns: [], dhcp: false, ssid: '' }
    ], links: [] } },
  { id: 't18', max: MAX, level: 'medium', week: 2, mode: 'trouble', title: 'แก้ปัญหา: สายระหว่างอาคารและเครื่องที่ต่อผิดที่',
    desc: 'วิทยาลัยมีอาคารสำนักงาน (อาคาร 1: Router1, SW-Office, PC-Office1, PC-Office2, Printer-Office วง 192.168.10.0/24) และโรงฝึกงาน (อาคาร 2: SW-Workshop, PC-Workshop1, PC-Workshop2 วง 192.168.20.0/24) ' +
      'สองอาคารห่างกันประมาณ 300 เมตร ช่างคนเดิมเดินสายไว้แล้ว แต่ผู้ใช้แจ้งปัญหา: (1) โรงฝึกงานใช้เครือข่ายไม่ได้เป็นระยะ ๆ (2) PC-Workshop2 ใช้งานไม่ได้เลย (3) ไม่มีใครสั่งพิมพ์ไปที่ Printer-Office ได้ ' +
      'ให้ใช้ Ping และตรวจการต่อสายของแต่ละเครื่องเพื่อหาสาเหตุ แล้วแก้ที่สายและตำแหน่งที่ต่อ — ห้ามแก้ด้วยการเปลี่ยน IP ของเครื่องไปวงอื่น ' +
      '(ระบบจำลองไม่ได้จำลองความยาวสาย สายที่ยาวเกินมาตรฐานจึงยังแสดงว่าใช้งานได้ ต้องตรวจชนิดสายเทียบกับระยะทางเอง)',
    hints: ['เริ่มจาก Ping จาก PC-Workshop2 ไป Router1 (192.168.20.1) แล้วดูว่าสายของเครื่องนี้ต่อไปที่ Switch ของอาคารไหน',
      'Printer ต้องอยู่ใน LAN เดียวกับเครื่องที่ใช้งาน คือเสียบเข้า Switch ของวงนั้น ไม่ใช่เสียบเข้าขาของ Router ที่ไม่ได้ตั้ง IP',
      'Ethernet บนสาย UTP กำหนดระยะไว้ไม่เกิน 100 เมตรต่อช่วง ระยะ 300 เมตรระหว่างอาคารต้องใช้สายไฟเบอร์ (เลือกสายเดิมแล้วลบ จากนั้นใช้เครื่องมือ "ไฟเบอร์" ต่อใหม่)',
      'สายไฟเบอร์ไม่นำไฟฟ้า จึงเหมาะกับการเดินระหว่างอาคารเพราะไม่ถูกรบกวนจากคลื่นแม่เหล็กไฟฟ้าและลดความเสี่ยงจากไฟกระชากเมื่อฟ้าผ่า'],
    start: { devices: [
      { id: 'r1', type: 'router', name: 'Router1', x: 520, y: 110,
        ifaces: [{ name: 'g0/0', ip: '192.168.10.1', prefix: 24 }, { name: 'g0/1', ip: '192.168.20.1', prefix: 24 }, { name: 'g0/2', ip: '', prefix: '' }, { name: 'g0/3', ip: '', prefix: '' }], routes: [] },
      { id: 'swA', type: 'switch', name: 'SW-Office', x: 260, y: 300, ports: 24 },
      pc('pcO1', 'PC-Office1', 120, 500, '192.168.10.11', 24, { gateway: '192.168.10.1' }),
      pc('pcO2', 'PC-Office2', 330, 520, '192.168.10.12', 24, { gateway: '192.168.10.1' }),
      { id: 'prn1', type: 'printer', name: 'Printer-Office', x: 520, y: 300, ifaces: [{ name: 'eth0', ip: '192.168.10.50', prefix: 24 }], gateway: '192.168.10.1', dns: [], dhcp: false },
      { id: 'swB', type: 'switch', name: 'SW-Workshop', x: 940, y: 300, ports: 24 },
      pc('pcW1', 'PC-Workshop1', 820, 510, '192.168.20.11', 24, { gateway: '192.168.20.1' }),
      pc('pcW2', 'PC-Workshop2', 1070, 510, '192.168.20.12', 24, { gateway: '192.168.20.1' })
    ], links: [link('l1', 'r1', 'g0/0', 'swA', 'p1'), link('l2', 'r1', 'g0/1', 'swB', 'p1'),
      link('l3', 'pcO1', 'eth0', 'swA', 'p2'), link('l4', 'pcO2', 'eth0', 'swA', 'p3'), link('l5', 'prn1', 'eth0', 'r1', 'g0/2'),
      link('l6', 'pcW1', 'eth0', 'swB', 'p2'), link('l7', 'pcW2', 'eth0', 'swA', 'p4')] } },
  { id: 't19', max: MAX, level: 'medium', week: 3, mode: 'independent', title: 'ตั้ง IP ตามคลาส (Classful) ให้ 3 เครือข่าย',
    desc: 'Router1 ต่อกับ 3 วงเครือข่ายไว้แล้ว ให้ตั้ง IP ตามหมายเลขเครือข่ายแบบมีคลาส (Classful) ที่กำหนด: LAN-A ใช้เครือข่าย 10.0.0.0, LAN-B ใช้ 172.16.0.0 และ LAN-C ใช้ 192.168.1.0 ' +
      'โดยใช้ Subnet mask เริ่มต้น (Default mask) ตามคลาสของแต่ละเครือข่าย ให้ทุกเครื่องและขาของ Router ใช้ IP ที่อยู่ในเครือข่ายนั้น ห้ามใช้หมายเลขเครือข่าย (Network address) หรือหมายเลขกระจาย (Broadcast) เป็น IP ของเครื่อง ' +
      'ตั้ง Default gateway แล้วทำให้ทุกเครื่อง Ping ข้ามเครือข่ายได้ (ปัจจุบันใช้ CIDR แบ่งขนาดได้อิสระ แต่ภารกิจนี้ฝึกอ่านคลาสและ Default mask ที่ยังพบในตำราและโปรแกรม)',
    hints: ['ดูออกเตตแรกเพื่อบอกคลาส: 1–126 = Class A, 128–191 = Class B, 192–223 = Class C',
      'Default mask: Class A = 255.0.0.0 (/8), Class B = 255.255.0.0 (/16), Class C = 255.255.255.0 (/24)',
      'หมายเลขแรกของวงคือ Network address และหมายเลขสุดท้ายคือ Broadcast ใช้เป็น IP ของเครื่องไม่ได้ เช่น 172.16.0.0 และ 172.16.255.255 ในวง /16',
      'Router หนึ่งขาต่อหนึ่งเครือข่าย ตั้ง IP ขาละวง แล้วใช้ IP ขานั้นเป็น Default gateway ของเครื่องในวงเดียวกัน'],
    start: { devices: [
      { id: 'r1', type: 'router', name: 'Router1', x: 600, y: 110,
        ifaces: [{ name: 'g0/0', ip: '', prefix: '' }, { name: 'g0/1', ip: '', prefix: '' }, { name: 'g0/2', ip: '', prefix: '' }, { name: 'g0/3', ip: '', prefix: '' }], routes: [] },
      { id: 'swA', type: 'switch', name: 'Switch-A', x: 220, y: 300, ports: 24 },
      { id: 'swB', type: 'switch', name: 'Switch-B', x: 600, y: 330, ports: 24 },
      { id: 'swC', type: 'switch', name: 'Switch-C', x: 980, y: 300, ports: 24 },
      pc('pcA1', 'PC-A1', 110, 500), pc('pcA2', 'PC-A2', 320, 520),
      pc('pcB1', 'PC-B1', 500, 520), pc('pcB2', 'PC-B2', 700, 520),
      pc('pcC1', 'PC-C1', 880, 520),
      { id: 'prnC1', type: 'printer', name: 'Printer-C', x: 1090, y: 500, ifaces: [{ name: 'eth0', ip: '', prefix: '' }], gateway: '', dns: [], dhcp: false }
    ], links: [link('l1', 'r1', 'g0/0', 'swA', 'p1'), link('l2', 'r1', 'g0/1', 'swB', 'p1'), link('l3', 'r1', 'g0/2', 'swC', 'p1'),
      link('l4', 'pcA1', 'eth0', 'swA', 'p2'), link('l5', 'pcA2', 'eth0', 'swA', 'p3'), link('l6', 'pcB1', 'eth0', 'swB', 'p2'),
      link('l7', 'pcB2', 'eth0', 'swB', 'p3'), link('l8', 'pcC1', 'eth0', 'swC', 'p2'), link('l9', 'prnC1', 'eth0', 'swC', 'p3')] } }
];
const NL_IDS = new Set(NetSim.natlab.missions);

// ---------------------------------------------------------------------------------------------
// requirement checks per mission: [{ label, max, run(C) -> { frac, fb } }]
const CHECKS = {
  t1: [
    { label: 'มี PC อย่างน้อย 2 เครื่องและ Switch 1 ตัว', max: 2,
      run: (C) => countsCheck(C, [['pc', 2, 'PC'], ['switch', 1, 'Switch']]) },
    { label: 'PC ทุกเครื่องต่อสายเข้า Switch และสายใช้งานได้', max: 2,
      run: (C) => cabledToSwitch(C, C.ofType('pc')) },
    { label: 'IP ถูกต้อง ไม่ซ้ำ และอยู่วงเดียวกัน', max: 3, run: (C) => ipPlan(C, C.ofType('pc'), 2) },
    { label: 'PC ping หากันได้ทั้งไปและกลับ', max: 3,
      run: (C) => { const p = C.ofType('pc').slice(0, 6); return p.length < 2 ? { frac: 0, fb: ['ต้องมี PC อย่างน้อย 2 เครื่องจึงทดสอบ ping ได้'] } : pingSet(C, allPairs(C, p, p)); } }
  ],
  t2: [
    { label: 'มี Switch 1 ตัว PC 4 เครื่อง และ Printer 1 เครื่อง', max: 2,
      run: (C) => countsCheck(C, [['switch', 1, 'Switch'], ['pc', 4, 'PC'], ['printer', 1, 'Printer']]) },
    { label: 'ทุกเครื่องต่อสายเข้า Switch และสายใช้งานได้', max: 2,
      run: (C) => cabledToSwitch(C, C.ofType('pc').concat(C.ofType('printer'))) },
    { label: 'IP ถูกต้อง ไม่ซ้ำ และอยู่วงเดียวกัน', max: 2,
      run: (C) => ipPlan(C, C.ofType('pc').concat(C.ofType('printer')), 5) },
    { label: 'PC ทุกเครื่อง ping ถึงกันและถึงเครื่องพิมพ์', max: 4,
      run: (C) => {
        const pcs = C.ofType('pc').slice(0, 8), all = pcs.concat(C.ofType('printer').slice(0, 2));
        return pcs.length < 2 ? { frac: 0, fb: ['ต้องมี PC อย่างน้อย 2 เครื่องจึงทดสอบ ping ได้'] } : pingSet(C, allPairs(C, pcs, all));
      } }
  ],
  t3: [
    { label: 'มี Router ต่อสายกับ Switch และ ISP (Internet)', max: 2, run: (C) => routerCabling(C, ['switch', 'internet']) },
    { label: 'IP ของ Router ขา LAN และขา WAN ถูกต้อง', max: 2, run: (C) => t3RouterIps(C) },
    { label: 'Default gateway ของ PC ถูกต้อง', max: 2, run: (C) => gatewayCheck(C, C.ofType('pc'), C.ofType('router')) },
    { label: 'Router มี Default route ไปยัง ISP', max: 2, run: (C) => defaultRoute(C) },
    { label: 'PC ทุกเครื่อง ping 8.8.8.8 ได้', max: 2,
      run: (C) => pingSet(C, C.ofType('pc').slice(0, 8).map((p) => ({ src: p, target: '8.8.8.8', label: '8.8.8.8' })), 'ยังไม่มี PC ให้ทดสอบ') }
  ],
  t4: [
    { label: 'มี Switch 2 ตัว Router 1 ตัว และ PC อยู่ 2 วงเครือข่าย', max: 2, run: (C) => {
      const r = countsCheck(C, [['switch', 2, 'Switch'], ['router', 1, 'Router']]);
      const nets = new Set(C.ofType('pc').map((p) => C.netOf(p.id)).filter(Boolean));
      if (nets.size < 2) r.fb.push('PC ทุกเครื่องอยู่วงเครือข่ายเดียวกัน ภารกิจนี้ต้องมี 2 วง (วง A และวง B)');
      return { frac: (r.frac * 2 + (nets.size >= 2 ? 1 : 0)) / 3, fb: r.fb };
    } },
    { label: 'Router มีขา LAN 2 ขา อยู่คนละวง ครอบคลุมทุกวงของ PC', max: 3, run: (C) => routerCoversLans(C) },
    { label: 'Default gateway ของ PC ทุกเครื่องถูกต้อง', max: 2, run: (C) => gatewayCheck(C, C.ofType('pc'), C.ofType('router')) },
    { label: 'PC ping ข้ามวงได้ทั้งไปและกลับ', max: 3, run: (C) => {
      const pcs = C.ofType('pc').slice(0, 8);
      const pairs = [];
      pcs.forEach((a) => pcs.forEach((b) => { const na = C.netOf(a.id), nb = C.netOf(b.id); if (a !== b && na && nb && na !== nb) pairs.push({ src: a, target: C.ip(b.id), label: hostLabel(C, b) }); }));
      return pingSet(C, pairs, 'ยังไม่มี PC ที่อยู่คนละวงให้ทดสอบ ping ข้ามวง (ตรวจ IP ของ PC วง A และวง B)');
    } }
  ],
  t5: [
    { label: 'Server เปิดบริการ DHCP ใช้ IP แบบ Static และ pool ถูกต้อง', max: 3, run: (C) => dhcpServer(C) },
    { label: 'PC ทุกเครื่องตั้งค่ารับ IP แบบ DHCP', max: 2, run: (C) => {
      const pcs = C.ofType('pc'), need = Math.max(3, pcs.length), on = pcs.filter((p) => p.dhcp);
      const fb = pcs.filter((p) => !p.dhcp).map((p) => `${p.name} ยังตั้ง IP แบบ Static อยู่ ต้องเปลี่ยนเป็นรับ IP อัตโนมัติ (DHCP)`);
      if (pcs.length < 3) fb.push(countMsg(pcs.length, 3, 'PC'));
      return { frac: on.length / need, fb };
    } },
    { label: 'PC ได้ IP จาก DHCP server (ไม่ใช่ APIPA)', max: 3, run: (C) => {
      const pcs = C.ofType('pc'), need = Math.max(3, pcs.length);
      const servers = new Set(C.devs.filter((d) => d.services && d.services.dhcp).map((d) => d.id));
      let ok = 0; const fb = [];
      pcs.forEach((p) => {
        const c = C.config(p.id);
        if (!p.dhcp) return;
        if (!c || !c.ip) fb.push(`${p.name} ยังไม่ได้ IP เลย (สายไม่ได้ต่อหรือ adapter ถูกปิด)`);
        else if (c.apipa) fb.push(`${p.name} ได้ IP ${c.ip} แบบ APIPA (169.254.x.x) แปลว่าขอ IP จาก DHCP server ไม่สำเร็จ — ตรวจว่า DHCP server เปิดบริการ ต่อสายอยู่ และอยู่วงเดียวกัน`);
        else if (!servers.has(c.leaseFrom)) fb.push(`${p.name} ได้ IP จากอุปกรณ์อื่นที่ไม่ใช่ DHCP server ของภารกิจ`);
        else ok++;
      });
      return { frac: ok / need, fb };
    } },
    { label: 'PC ทุกเครื่อง ping Server ได้', max: 2, run: (C) => {
      const srv = dhcpServerDev(C) || C.ofType('server')[0];
      if (!srv) return { frac: 0, fb: ['ยังไม่มี Server ให้ทดสอบ ping'] };
      const pcs = C.ofType('pc').slice(0, 8);
      const r = pingSet(C, pcs.map((p) => ({ src: p, target: C.ip(srv.id), label: hostLabel(C, srv) })), 'ยังไม่มี PC ให้ทดสอบ');
      r.frac = r.frac * Math.min(1, pcs.length / 3);
      return r;
    } }
  ],
  t6: [
    { label: 'Access Point ต่อสายเข้า Switch', max: 2, run: (C) => {
      const aps = C.ofType('ap');
      if (!aps.length) return { frac: 0, fb: ['ยังไม่มี Access Point'] };
      const ok = aps.some((a) => C.linkedTo(a.id, 'switch', { wired: true }).some((x) => x.active));
      return ok ? { frac: 1, fb: [] } : { frac: 0, fb: [`${aps[0].name} ยังไม่ได้ต่อสาย UTP/Fiber เข้า Switch (Laptop จะคุยกับเครื่องที่ใช้สาย LAN ไม่ได้)`] };
    } },
    { label: 'Laptop 2 เครื่องเชื่อมต่อ Wi-Fi กับ Access Point', max: 2, run: (C) => {
      const lts = C.ofType('laptop'), need = Math.max(2, lts.length);
      let ok = 0; const fb = [];
      lts.forEach((l) => {
        const w = C.adj(l.id).filter((x) => x.medium === 'wifi' && x.other.type === 'ap');
        if (w.length) ok++; else fb.push(`${l.name} ยังไม่ได้เชื่อมต่อ Wi-Fi กับ Access Point (ใช้เครื่องมือ Wi-Fi)`);
      });
      if (lts.length < 2) fb.push(countMsg(lts.length, 2, 'Laptop'));
      return { frac: ok / need, fb };
    } },
    { label: 'SSID ของ Laptop ตรงกับ AP (NETLAB-ROOM3)', max: 2, run: (C) => {
      const lts = C.ofType('laptop'), need = Math.max(2, lts.length);
      const fb = [];
      const apOk = C.ofType('ap').some((a) => a.ssid === 'NETLAB-ROOM3');
      if (!apOk) return { frac: 0, fb: ['SSID ของ Access Point ต้องเป็น NETLAB-ROOM3 ตามที่ห้องแล็บกำหนด (ห้ามเปลี่ยน SSID ของ AP)'] };
      let ok = 0;
      lts.forEach((l) => {
        const w = C.adj(l.id).find((x) => x.medium === 'wifi' && x.other.type === 'ap');
        const want = w ? w.other.ssid : 'NETLAB-ROOM3';
        if (!l.ssid) fb.push(`${l.name} ยังไม่ได้เลือก SSID (ต้องเลือกเครือข่าย ${want})`);
        else if (l.ssid !== want) fb.push(`SSID ของ ${l.name} คือ "${l.ssid}" ไม่ตรงกับ AP ("${want}") จึงเชื่อมต่อ Wi-Fi ไม่ได้`);
        else ok++;
      });
      return { frac: ok / need, fb };
    } },
    { label: 'Laptop ทั้งสองเครื่อง ping FileServer ได้', max: 4, run: (C) => {
      const srv = C.ofType('server')[0];
      if (!srv) return { frac: 0, fb: ['ไม่พบ FileServer'] };
      const lts = C.ofType('laptop').slice(0, 6);
      const r = pingSet(C, lts.map((l) => ({ src: l, target: C.ip(srv.id), label: hostLabel(C, srv) })), 'ยังไม่มี Laptop ให้ทดสอบ ping');
      r.frac = r.frac * Math.min(1, lts.length / 2);
      return r;
    } }
  ],
  t7: [
    { label: 'Server เปิดบริการ DNS และมีระเบียน srv.lab.local ชี้ไปที่ Server', max: 3, run: (C) => dnsServer(C) },
    { label: 'PC ทุกเครื่องตั้ง DNS server ภายใน', max: 2, run: (C) => {
      const pcs = C.ofType('pc');
      if (!pcs.length) return { frac: 0, fb: ['ไม่พบ PC'] };
      const dnsIps = new Set(C.devs.filter((d) => d.services && d.services.dns && d.services.dns.enabled !== false).map((d) => C.ip(d.id)).filter(Boolean));
      let ok = 0; const fb = [];
      pcs.forEach((p) => {
        const c = C.config(p.id);
        const list = c && c.dns ? c.dns : [];
        if (!list.length) fb.push(`${p.name} ยังไม่ได้ตั้ง DNS server จึงแปลงชื่อเป็น IP ไม่ได้`);
        else if (!list.some((x) => dnsIps.has(x))) fb.push(`DNS server ของ ${p.name} (${list.join(', ')}) ไม่ใช่ DNS server ภายในที่รู้จักชื่อ srv.lab.local`);
        else ok++;
      });
      return { frac: ok / pcs.length, fb };
    } },
    { label: 'PC แปลงชื่อและ ping srv.lab.local ได้', max: 2.5, run: (C) => nameCheck(C, 'srv.lab.local') },
    { label: 'PC แปลงชื่อและ ping www.netlab.test ได้', max: 2.5, run: (C) => nameCheck(C, 'www.netlab.test') }
  ],
  t8: [
    { label: 'วงที่ 1: PC 2 เครื่องต่อสายเข้า Switch เดียวกัน', max: 1.5, run: (C) => {
      const { lan1 } = t8Groups(C);
      const r = countsCheck(C, [['pc', 2, 'PC'], ['switch', 1, 'Switch']]);
      if (lan1.length < 2) return r;
      const cab = cabledToSwitch(C, lan1);
      const same = C.net.l2Domain(lan1[0].id).includes(lan1[1].id);
      const fb = r.fb.concat(cab.fb);
      if (cab.frac >= 1 && !same) fb.push(`${lan1[0].name} กับ ${lan1[1].name} ต่อคนละ Switch ที่ไม่ได้เชื่อมถึงกัน`);
      return { frac: (r.frac + cab.frac + (same ? 1 : 0)) / 3, fb };
    } },
    { label: 'IP/Subnet mask ของ PC วงที่ 1 ถูกต้อง ไม่ซ้ำ และอยู่วงเดียวกัน', max: 1.5, run: (C) => {
      const { lan1 } = t8Groups(C);
      return lan1.length ? ipPlan(C, lan1, 2) : { frac: 0, fb: ['ยังไม่มี PC'] };
    } },
    { label: 'PC วงที่ 1 ping หากันได้', max: 1.5, run: (C) => {
      const { lan1 } = t8Groups(C);
      return lan1.length < 2 ? { frac: 0, fb: ['ต้องมี PC อย่างน้อย 2 เครื่องจึงทดสอบ ping ได้'] } : pingSet(C, allPairs(C, lan1, lan1));
    } },
    { label: 'มี Router และ PC วงที่ 2 ต่อสายเข้ากับ Router', max: 1.5, run: (C) => {
      const { lan1, lan2, others } = t8Groups(C);
      const rs = C.ofType('router');
      const fb = [];
      if (!rs.length) return { frac: 0, fb: ['ยังไม่มี Router (ต้องใช้ Router เชื่อม 2 วงเครือข่าย)'] };
      let ok = 1;
      const r1 = lan1.length && rs.find((r) => C.net.l2Domain(lan1[0].id).includes(r.id));
      if (r1) ok++; else fb.push('Router ยังไม่ได้ต่อสายเข้ากับ Switch ของวงที่ 1');
      const r2 = lan2.find((p) => rs.some((r) => C.net.l2Domain(p.id).includes(r.id)));
      if (r2) ok++;
      else if (!others.length) fb.push('ยังไม่มี PC เครื่องที่ 3 สำหรับวงที่ 2');
      else if (!lan2.length) fb.push(`${others[0].name} ยังอยู่วงเดียวกับวงที่ 1 หรือยังไม่มี IP — PC วงที่ 2 ต้องใช้ IP อีกวงหนึ่ง`);
      else fb.push(`${lan2[0].name} (วงที่ 2) ยังไม่ได้ต่อสายถึง Router (ต่อเข้าขาอื่นของ Router ตรง ๆ หรือผ่าน Switch ตัวที่ 2)`);
      return { frac: ok / 3, fb };
    } },
    { label: 'Router ตั้ง IP 2 ขา คนละวง ตรงกับวงของ PC', max: 1.5, run: (C) => {
      const { lan2 } = t8Groups(C);
      const r = routerCoversLans(C);
      if (!lan2.length) return { frac: Math.min(r.frac, 0.5), fb: r.fb.concat(['ยังไม่มี PC ในวงที่ 2']) };
      return r;
    } },
    { label: 'Default gateway ของ PC ทุกเครื่องถูกต้อง', max: 1, run: (C) => gatewayCheck(C, C.ofType('pc').slice(0, 12), C.ofType('router')) },
    { label: 'Ping ข้ามวงได้ทั้งไปและกลับ', max: 1.5, run: (C) => {
      const { lan1, lan2 } = t8Groups(C);
      const pairs = [];
      lan1.forEach((a) => lan2.slice(0, 4).forEach((b) => {
        pairs.push({ src: a, target: C.ip(b.id), label: hostLabel(C, b) });
        pairs.push({ src: b, target: C.ip(a.id), label: hostLabel(C, a) });
      }));
      return pingSet(C, pairs, 'ยังไม่มี PC ที่อยู่คนละวงให้ทดสอบ ping ข้ามวง');
    } }
  ]
};

// t8: the first two PCs (by id) form network 1; other PCs with an address in a different network form network 2
function t8Groups(C) {
  const pcs = C.ofType('pc').slice(0, 12);
  const lan1 = pcs.slice(0, 2);
  const others = pcs.slice(2);
  const n1 = lan1.length ? C.netOf(lan1[0].id) : null;
  const lan2 = others.filter((p) => { const n = C.netOf(p.id); return n && n !== n1 && !C.config(p.id).apipa; });
  return { lan1, lan2, others };
}

// ---------------------------------------------------------------------------------------------
// Phase 4 missions t14–t19 (w1–w3). Fixed devices of a mission are found by the ids of its start topology (the grader
// never trusts names, types or extra fields sent by the browser for that); the observation quiz key stays here.
const QUIZ_KEY = { t15: { q1: 1, q2: 3 }, t16: { q1: 1, q2: 2, q3: 0 } };
function quizOf(mid) { const m = MISSIONS.find((x) => x.id === mid); return m && m.start && Array.isArray(m.start.quiz) ? m.start.quiz : []; }
// payload.answers -> { qid: option index } for the questions of this mission only
function cleanAnswers(mid, a) {
  const out = {};
  if (!isObj(a)) return out;
  quizOf(mid).forEach((q) => {
    const v = a[q.id];
    const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d{1,2}$/.test(v) ? Number(v) : NaN);
    if (Number.isInteger(n) && n >= 0 && n < q.options.length) out[q.id] = n;
  });
  return out;
}
function quizCheck(mid) {
  return (C, X) => {
    const qs = quizOf(mid), key = QUIZ_KEY[mid] || {}, ans = (X && X.answers) || {};
    if (!qs.length) return { frac: 0, fb: [] };
    let ok = 0; const fb = [];
    qs.forEach((q, i) => {
      if (ans[q.id] === undefined) fb.push(`ยังไม่ได้ตอบคำถามข้อ ${i + 1}`);
      else if (ans[q.id] === key[q.id]) ok++;
      else fb.push(`คำถามข้อ ${i + 1} ยังไม่ถูก: ทบทวนจากสิ่งที่สังเกตในระบบจำลองและบทเรียน แล้วลองตอบใหม่`);
    });
    return { frac: ok / qs.length, fb };
  };
}
// fixed devices of the mission by id (and expected type); missing ones are reported
function fixedDevs(C, ids, type) {
  const have = [], fb = [];
  ids.forEach((id) => {
    const d = C.byId.get(id);
    if (d && (!type || d.type === type)) have.push(d);
    else fb.push(`ไม่พบ ${id} ของโจทย์ (อย่าลบหรือเปลี่ยนชนิดเครื่องของโจทย์ ให้ย้ายสายแทน)`);
  });
  return { have, fb };
}
const isHub = (d) => !!d && d.type === 'switch' && d.hub === true;
const realSwitches = (C) => C.ofType('switch').filter((d) => !d.hub);
const wiredActive = (C, id) => C.adj(id).filter((x) => x.active && x.medium !== 'wifi');
// every host has an active cable straight to a real switch (not a hub)
function onSwitch(C, hosts, need) {
  if (!hosts.length) return { frac: 0, fb: ['ยังไม่มีเครื่องให้ตรวจการต่อสาย'] };
  let ok = 0; const fb = [];
  hosts.forEach((h) => {
    const w = wiredActive(C, h.id);
    if (w.some((x) => x.other.type === 'switch' && !x.other.hub)) ok++;
    else if (w.some((x) => isHub(x.other))) fb.push(`${h.name} ยังต่ออยู่กับ ${w.find((x) => isHub(x.other)).other.name} ซึ่งเป็น Hub — ย้ายสายไปเข้า Switch`);
    else if (w.length) fb.push(`${h.name} ต่อสายเข้า ${w[0].other.name} ไม่ใช่ Switch`);
    else {
      const l = C.adj(h.id).find((x) => x.medium !== 'wifi');
      fb.push(l ? `สายของ ${h.name} ใช้งานไม่ได้ (${LINK_REASON[l.reason] || l.reason})` : `${h.name} ยังไม่ได้ต่อสาย`);
    }
  });
  return { frac: ok / Math.max(need || 0, hosts.length), fb };
}
// a service test (TCP/UDP port) run in the engine, like pingSet
function serviceSet(C, pairs, proto, port, what, emptyMsg) {
  if (!pairs.length) return { frac: 0, fb: [emptyMsg || 'ยังไม่มีเครื่องให้ทดสอบ'] };
  let ok = 0; const fails = [];
  pairs.forEach((p) => {
    if (!p.target) { fails.push(`${p.src.name} ทดสอบ ${what} ไม่ได้ เพราะปลายทางยังไม่มี IP address`); return; }
    const r = C.net.trace(p.src.id, p.target, { proto, port });
    if (r.ok) ok++;
    else fails.push(`${p.src.name} เปิด ${what} บน ${p.label} ไม่สำเร็จ: ${r.title || r.reasonText || r.code}${r.hint ? ' — ' + r.hint : ''}`);
  });
  const fb = fails.slice(0, MAX_FB_PINGS);
  if (fails.length > MAX_FB_PINGS) fb.push(`…และไม่สำเร็จอีก ${fails.length - MAX_FB_PINGS} เครื่อง`);
  return { frac: ok / pairs.length, fb };
}
const inDom = (C, a, b) => !!a && !!b && C.net.l2Domain(a.id).includes(b.id);
const routersIn = (C, hosts) => {
  const out = [];
  hosts.forEach((h) => C.net.l2Domain(h.id).forEach((id) => { const d = C.byId.get(id); if (d && d.type === 'router' && !out.includes(d)) out.push(d); }));
  return out.sort((a, b) => natCmp(a.id, b.id));
};
const ifCfgOf = (C, r, port) => { const c = C.config(r.id); return (c && c.ifaces || []).find((f) => f.iface === port) || null; };
// pairs from every host of one group to every host of the other group (both directions)
function crossPairs(C, ga, gb) {
  const out = [];
  ga.forEach((a) => gb.forEach((b) => { out.push({ src: a, target: C.ip(b.id), label: hostLabel(C, b) }); out.push({ src: b, target: C.ip(a.id), label: hostLabel(C, a) }); }));
  return out;
}

// t15
function t15Ctx(C) {
  const A = fixedDevs(C, ['pcA1', 'pcA2'], 'pc'), B = fixedDevs(C, ['pcB1', 'pcB2'], 'pc');
  const mixed = A.have.some((a) => B.have.some((b) => inDom(C, a, b)));
  const rA = routersIn(C, A.have), rB = routersIn(C, B.have);
  const RA = rA.find((r) => !rB.includes(r)) || rA[0] || null;
  const RB = rB.find((r) => r !== RA) || null;
  return { A: A.have, B: B.have, missing: A.fb.concat(B.fb), mixed, RA, RB, rA, rB };
}
// t17
function t17Ctx(C) {
  const acc = fixedDevs(C, ['pcA1', 'pcA2'], 'pc'), prn = fixedDevs(C, ['prn1'], 'printer');
  const sal = fixedDevs(C, ['pcS1'], 'pc'), lts = fixedDevs(C, ['lt1', 'lt2'], 'laptop');
  return { acc: acc.have, prn: prn.have, sal: sal.have, lts: lts.have, missing: acc.fb.concat(prn.fb, sal.fb, lts.fb) };
}
// t18: building 2 = SW-Workshop and its PCs (fixed ids); everything else is building 1 or new
const T18_B2 = new Set(['swB', 'pcW1', 'pcW2']);
const T18_PLAN = { pcO1: '192.168.10.0', pcO2: '192.168.10.0', prn1: '192.168.10.0', pcW1: '192.168.20.0', pcW2: '192.168.20.0' };
// t19: the classful network assigned to each LAN
const T19_NETS = [
  { lan: 'LAN-A', net: '10.0.0.0', prefix: 8, cls: 'A', ids: ['pcA1', 'pcA2'] },
  { lan: 'LAN-B', net: '172.16.0.0', prefix: 16, cls: 'B', ids: ['pcB1', 'pcB2'] },
  { lan: 'LAN-C', net: '192.168.1.0', prefix: 24, cls: 'C', ids: ['pcC1', 'prnC1'] }
];
const t19Hosts = (C) => T19_NETS.map((n) => ({ n, hosts: n.ids.map((id) => C.byId.get(id)).filter((d) => d && ['pc', 'printer'].includes(d.type)) }));

Object.assign(CHECKS, {
  t14: [
    { label: 'มี Switch เป็นศูนย์กลาง, File Server 1 เครื่อง และ PC (Client) อย่างน้อย 3 เครื่อง', max: 1.5, run: (C) => {
      const sw = realSwitches(C).length, srv = C.ofType('server').length, pcs = C.ofType('pc').length;
      const fb = [countMsg(sw, 1, 'Switch'), countMsg(srv, 1, 'Server'), countMsg(pcs, 3, 'PC')].filter(Boolean);
      if (!sw && C.ofType('switch').some(isHub)) fb.push('ศูนย์กลางที่ใช้เป็น Hub ภารกิจนี้ให้ใช้ Switch ซึ่งเป็นอุปกรณ์ศูนย์กลางมาตรฐานของ LAN ปัจจุบัน');
      return { frac: (Math.min(sw, 1) + Math.min(srv, 1) + Math.min(pcs, 3) / 3) / 3, fb };
    } },
    { label: 'Star topology: ทุกเครื่องมีสายของตัวเองเส้นเดียวต่อเข้า Switch ตัวเดียวกัน', max: 2, run: (C) => {
      const hosts = C.ofType('server').concat(C.ofType('pc'));
      const sws = realSwitches(C);
      if (!sws.length) return { frac: 0, fb: ['ยังไม่มี Switch เป็นอุปกรณ์ศูนย์กลาง'] };
      const cnt = (s) => hosts.filter((h) => wiredActive(C, h.id).some((x) => x.other.id === s.id)).length;
      const center = sws.slice().sort((a, b) => cnt(b) - cnt(a) || natCmp(a.id, b.id))[0];
      let ok = 0; const fb = [];
      hosts.forEach((h) => {
        const w = wiredActive(C, h.id);
        if (w.length === 1 && w[0].other.id === center.id) ok++;
        else if (!w.length) fb.push(`${h.name} ยังไม่มีสายที่ใช้งานได้เข้า ${center.name}`);
        else if (w.length > 1) fb.push(`${h.name} มีสายมากกว่า 1 เส้น แบบ Star แต่ละเครื่องมีสายเส้นเดียวเข้าอุปกรณ์ศูนย์กลาง`);
        else fb.push(`${h.name} ต่อสายเข้า ${w[0].other.name} แทนที่จะเข้า ${center.name} (ศูนย์กลางของ Star)`);
      });
      return { frac: ok / Math.max(4, hosts.length), fb };
    } },
    { label: 'IP ถูกต้อง ไม่ซ้ำ และอยู่วงเดียวกัน', max: 2, run: (C) => ipPlan(C, C.ofType('server').concat(C.ofType('pc')), 4) },
    { label: 'FileServer ใช้ IP แบบ Static และเปิดบริการแชร์ไฟล์ (เป็นเครื่องแม่ข่าย)', max: 1.5, run: (C) => {
      const srv = C.ofType('server')[0];
      if (!srv) return { frac: 0, fb: ['ไม่พบ FileServer'] };
      let ok = 0; const fb = [];
      if (srv.services && srv.services.file) ok++; else fb.push(`${srv.name} ยังไม่ได้เปิดบริการแชร์ไฟล์ (ติ๊ก "แชร์ไฟล์ (File server, SMB TCP 445)") จึงยังไม่ได้ทำหน้าที่ Server`);
      const st = staticOk(C, srv);
      if (srv.dhcp) fb.push(`${srv.name} เป็นเครื่องแม่ข่ายควรใช้ IP แบบ Static ให้ Client หาเจอที่เดิมเสมอ`);
      else if (!st.ok) fb.push(st.msg); else ok++;
      return { frac: ok / 2, fb };
    } },
    { label: 'Client ทุกเครื่องเปิดแชร์ไฟล์ (SMB TCP 445) บน FileServer ได้', max: 3, run: (C) => {
      const srv = C.ofType('server')[0];
      if (!srv) return { frac: 0, fb: ['ไม่พบ FileServer'] };
      const pcs = C.ofType('pc').slice(0, 8);
      const r = serviceSet(C, pcs.map((p) => ({ src: p, target: C.ip(srv.id), label: hostLabel(C, srv) })), 'tcp', 445, 'แชร์ไฟล์ (SMB TCP 445)', 'ยังไม่มี PC (Client) ให้ทดสอบ');
      r.frac = r.frac * Math.min(1, pcs.length / 3);
      if (pcs.length < 3) r.fb.push(countMsg(pcs.length, 3, 'PC'));
      return r;
    } }
  ],
  t15: [
    { label: 'แต่ละสาขามี Router ของตัวเองต่อกับ LAN ของสาขา (LAN สองสาขาไม่ต่อถึงกันตรง ๆ)', max: 2, run: (C) => {
      const T = t15Ctx(C);
      if (T.mixed) return { frac: 0, fb: ['LAN ของสาขากรุงเทพฯ และเชียงใหม่ถูกต่อเป็นวงสายเดียวกัน (Switch ถึง Switch) ซึ่งทำไม่ได้กับระยะหลายร้อยกิโลเมตร และ IP ก็อยู่คนละวง — ให้เชื่อมผ่าน Router ของแต่ละสาขาและลิงก์ WAN'] };
      const fb = T.missing.slice();
      if (!T.rA.length) fb.push('LAN สาขากรุงเทพฯ ยังไม่มี Router ต่ออยู่ (ต่อ Router ขาหนึ่งเข้า Switch-BKK)');
      if (!T.rB.length) fb.push('LAN สาขาเชียงใหม่ยังไม่มี Router ต่ออยู่ (ต่อ Router ขาหนึ่งเข้า Switch-CNX)');
      if (T.rA.length && T.rB.length && !T.RB) { fb.push(`${T.RA.name} ตัวเดียวต่อกับทั้งสองสาขา แต่ละสาขาต้องมี Router ประจำสาขาของตัวเอง แล้วให้ Router สองตัวเชื่อมกันด้วยลิงก์ WAN`); return { frac: 0.5, fb }; }
      return { frac: ((T.rA.length ? 1 : 0) + (T.rB.length ? 1 : 0)) / 2 * (T.missing.length ? 0.5 : 1), fb };
    } },
    { label: 'ลิงก์ WAN: Router สองสาขาต่อกันด้วยสายไฟเบอร์ และตั้ง IP วงเดียวกันที่แยกจาก LAN', max: 2, run: (C) => {
      const T = t15Ctx(C);
      if (!T.RA || !T.RB || T.mixed) return { frac: 0, fb: ['ยังไม่มี Router ประจำสาขาครบทั้งสองสาขา จึงยังไม่มีลิงก์ WAN ให้ตรวจ'] };
      const ls = C.adj(T.RA.id).filter((x) => x.other.id === T.RB.id);
      if (!ls.length) return { frac: 0, fb: [`${T.RA.name} กับ ${T.RB.name} ยังไม่ได้ต่อสายถึงกันโดยตรง (ลิงก์ WAN ระหว่างสาขา)`] };
      const x = ls.find((y) => y.active) || ls[0];
      let pts = 0; const fb = [];
      if (!x.active) fb.push(`ลิงก์ระหว่าง ${T.RA.name} กับ ${T.RB.name} ใช้งานไม่ได้ (${LINK_REASON[x.reason] || x.reason})`);
      else if (x.medium !== 'fiber') { fb.push(`ลิงก์ WAN ระหว่างสาขาใช้สาย ${x.medium === 'utp' ? 'UTP' : x.medium} ซึ่งส่งได้ไม่เกิน 100 เมตรต่อช่วง ภารกิจนี้ให้ใช้สายไฟเบอร์แทนวงจรระยะไกลของผู้ให้บริการ`); }
      else pts += 1;
      const f = ifCfgOf(C, T.RA, x.port), g2 = ifCfgOf(C, T.RB, x.otherPort);
      const lanNets = new Set(T.A.concat(T.B).map((h) => C.netOf(h.id)).filter(Boolean));
      if (!f || !f.ip || !g2 || !g2.ip) fb.push(`ขาที่ใช้ลิงก์ WAN ของ ${T.RA.name} (${x.port}) และ ${T.RB.name} (${x.otherPort}) ต้องตั้ง IP ทั้งสองฝั่ง`);
      else if (f.network !== g2.network || f.prefix !== g2.prefix) fb.push(`IP ขา WAN ${f.ip}/${f.prefix} กับ ${g2.ip}/${g2.prefix} ไม่อยู่วงเดียวกัน Router สองฝั่งจึงคุยกันไม่ได้`);
      else if (lanNets.has(f.network + '/' + f.prefix)) fb.push(`วง ${f.network}/${f.prefix} ของลิงก์ WAN ซ้ำกับวงของ LAN ให้ใช้วงแยก เช่น 10.0.0.0/30`);
      else if (C.errorsOf(T.RA.id).concat(C.errorsOf(T.RB.id)).some((p) => p.code === 'router_overlap')) fb.push('ขาของ Router ตั้ง IP ซ้อนวงกัน แต่ละขาต้องอยู่คนละวง');
      else pts += 1;
      return { frac: pts / 2, fb };
    } },
    { label: 'Default gateway ของ PC ทุกเครื่องถูกต้อง', max: 1.5, run: (C) => {
      const T = t15Ctx(C);
      const r = gatewayCheck(C, T.A.concat(T.B), C.ofType('router'));
      r.frac = r.frac * T.A.concat(T.B).length / 4; r.fb = T.missing.concat(r.fb);
      return r;
    } },
    { label: 'Router แต่ละสาขามีเส้นทางไปยัง LAN ของอีกสาขา', max: 1.5, run: (C) => {
      const T = t15Ctx(C);
      if (!T.RA || !T.RB || T.mixed) return { frac: 0, fb: ['ต้องมี Router ประจำสาขาครบทั้งสองสาขาก่อน'] };
      let ok = 0; const fb = [];
      [[T.RA, T.B, 'เชียงใหม่'], [T.RB, T.A, 'กรุงเทพฯ']].forEach(([r, far, nm]) => {
        const target = far.map((h) => C.ip(h.id)).find(Boolean);
        if (!target) { fb.push(`PC สาขา${nm} ยังไม่มี IP จึงตรวจเส้นทางไม่ได้`); return; }
        const hit = C.net.routes(r.id).find((x) => x.type !== 'C' && IP.inSubnet(target, x.net, x.prefix));
        if (hit) ok++;
        else fb.push(`${r.name} ยังไม่มีเส้นทางที่ใช้ได้ไปยัง LAN สาขา${nm} (${C.netOf(far[0].id) || target}) — เพิ่ม static route โดยใช้ Next hop เป็น IP ของ Router อีกฝั่งในวง WAN`);
      });
      return { frac: ok / 2, fb };
    } },
    { label: 'PC ping ข้ามสาขาได้ทั้งไปและกลับ', max: 2, run: (C) => {
      const T = t15Ctx(C);
      const r = pingSet(C, crossPairs(C, T.A, T.B), 'ยังไม่มี PC ครบทั้งสองสาขาให้ทดสอบ');
      r.frac = r.frac * Math.min(1, (T.A.length * T.B.length) / 4);
      return r;
    } },
    { label: 'ระบุได้ว่าส่วนใดเป็น LAN และส่วนใดเป็น WAN', max: 1, run: quizCheck('t15') }
  ],
  t16: [
    { label: 'ถอด Hub ออกจากเครือข่ายแล้ว', max: 2, run: (C) => {
      const hubs = C.ofType('switch').filter(isHub);
      if (!hubs.length) return { frac: 1, fb: [] };
      const live = hubs.filter((h) => C.adj(h.id).some((x) => x.active));
      if (live.length) return { frac: 0, fb: [`${live[0].name} ยังมีเครื่องต่ออยู่ ย้ายสายทุกเส้นไปเข้า Switch แล้วลบ Hub ออก`] };
      return { frac: 0.5, fb: [`ยังมี ${hubs[0].name} วางอยู่ในแผนผัง (ไม่มีสายต่อแล้ว) ให้ลบออก`] };
    } },
    { label: 'PC ทั้ง 4 เครื่องต่อสายเข้า Switch และสายใช้งานได้', max: 2, run: (C) => {
      const P = fixedDevs(C, ['pc1', 'pc2', 'pc3', 'pc4'], 'pc');
      const r = onSwitch(C, P.have, 4); r.fb = P.fb.concat(r.fb);
      if (!realSwitches(C).length) r.fb.unshift('ยังไม่มี Switch ในแผนผัง');
      return r;
    } },
    { label: 'แต่ละพอร์ตเป็น Collision domain ของตัวเอง (ไม่มีโดเมนที่ใช้ร่วมกันผ่าน Hub)', max: 1.5, run: (C) => {
      const P = fixedDevs(C, ['pc1', 'pc2', 'pc3', 'pc4'], 'pc');
      const cds = C.net.collisionDomains();
      let ok = 0; const fb = [];
      P.have.forEach((p) => {
        const d = cds.find((x) => x.devs.includes(p.id));
        if (!d) fb.push(`${p.name} ยังไม่มีสายที่ใช้งานได้ จึงยังไม่อยู่ใน Collision domain ใด`);
        else if (d.kind === 'hub' || d.devs.length > 2) fb.push(`${p.name} ยังใช้ Collision domain ร่วมกับ ${d.devs.filter((x) => x !== p.id).map((x) => (C.byId.get(x) || {}).name || x).join(', ')}`);
        else ok++;
      });
      return { frac: ok / 4, fb: P.fb.concat(fb).slice(0, 4) };
    } },
    { label: 'IP ของ PC ยังถูกต้อง ไม่ซ้ำ และอยู่วงเดียวกัน', max: 1, run: (C) => ipPlan(C, fixedDevs(C, ['pc1', 'pc2', 'pc3', 'pc4'], 'pc').have, 4) },
    { label: 'PC ทุกคู่ ping กันได้', max: 2, run: (C) => {
      const P = fixedDevs(C, ['pc1', 'pc2', 'pc3', 'pc4'], 'pc').have;
      const r = pingSet(C, allPairs(C, P, P), 'ไม่พบ PC ของโจทย์');
      r.frac = r.frac * P.length / 4;
      return r;
    } },
    { label: 'ตอบคำถามจากการสังเกต (Hub/Switch, Collision domain, ชั้น OSI)', max: 1.5, run: quizCheck('t16') }
  ],
  t17: [
    { label: 'แต่ละแผนกใช้ Switch เป็นศูนย์กลางของเครื่องที่ใช้สาย (ไม่ใช้ Hub)', max: 2, run: (C) => {
      const T = t17Ctx(C);
      const r = onSwitch(C, T.acc.concat(T.prn, T.sal), 4);
      r.fb = T.missing.concat(r.fb);
      return r;
    } },
    { label: 'Laptop ฝ่ายขายเชื่อมต่อ Wi-Fi ผ่าน Access Point ที่อยู่ใน LAN ฝ่ายขาย', max: 2, run: (C) => {
      const T = t17Ctx(C);
      let pts = 0; const fb = [];
      T.lts.forEach((l) => {
        const w = C.adj(l.id).find((x) => x.medium === 'wifi' && x.other.type === 'ap');
        if (!w) { fb.push(`${l.name} ยังไม่ได้เชื่อมต่อ Wi-Fi กับ Access Point (ใช้เครื่องมือ Wi-Fi และตั้ง SSID ให้ตรงกับ AP)`); return; }
        if (!w.active) { fb.push(`${l.name} เชื่อมต่อ ${w.other.name} ไม่สำเร็จ (${LINK_REASON[w.reason] || w.reason})`); return; }
        pts += 0.5;
        if (T.sal.length && inDom(C, l, T.sal[0])) pts += 0.5;
        else fb.push(`${w.other.name} ยังไม่ได้ต่อสายเข้า LAN ฝ่ายขาย (Switch เดียวกับ PC-SALES1) Laptop จึงอยู่คนละเครือข่ายกับฝ่ายขาย`);
      });
      return { frac: pts / 2, fb: T.missing.concat(fb) };
    } },
    { label: 'ใช้ Router เชื่อมสองแผนก และแต่ละแผนกเป็น Broadcast domain แยกกัน', max: 2, run: (C) => {
      const T = t17Ctx(C);
      const accH = T.acc.concat(T.prn), salH = T.sal.concat(T.lts);
      if (!accH.length || !salH.length) return { frac: 0, fb: T.missing };
      const mixed = accH.some((a) => salH.some((b) => inDom(C, a, b)));
      const rs = routersIn(C, accH).filter((r) => routersIn(C, salH).includes(r));
      const fb = [];
      if (mixed) fb.push('สองแผนกถูกต่อเป็น Broadcast domain เดียวกัน (เช่น ต่อ Switch ถึง Switch) แต่ IP อยู่คนละวง Switch ไม่ส่งข้ามวงเครือข่าย ต้องใช้ Router เชื่อมและแยกแต่ละแผนกไว้คนละขา');
      if (!rs.length) fb.push(C.ofType('router').length ? 'Router ยังไม่ได้ต่อเข้า LAN ของทั้งสองแผนก (ขาหนึ่งเข้า Switch ฝ่ายบัญชี อีกขาเข้า Switch ฝ่ายขาย)' : 'ยังไม่มี Router ซึ่งเป็นอุปกรณ์ที่ส่งข้อมูลข้ามวงเครือข่ายด้วย IP address');
      return { frac: ((mixed ? 0 : 1) + (rs.length ? 1 : 0)) / 2, fb };
    } },
    { label: 'Router ตั้ง IP ขาละวงตรงกับ Default gateway ของทุกเครื่อง', max: 1.5, run: (C) => {
      const T = t17Ctx(C);
      const hosts = T.acc.concat(T.prn, T.sal, T.lts);
      const r = gatewayCheck(C, hosts, C.ofType('router'));
      r.frac = r.frac * hosts.length / 6;
      return r;
    } },
    { label: 'ทุกเครื่อง ping กันได้ทั้งในแผนกและข้ามแผนก รวมถึง Printer-ACC', max: 2.5, run: (C) => {
      const T = t17Ctx(C);
      const src = T.acc.concat(T.sal, T.lts);
      const r = pingSet(C, allPairs(C, src, src.concat(T.prn)), 'ไม่พบเครื่องของโจทย์');
      r.frac = r.frac * (src.length + T.prn.length) / 6;
      return r;
    } }
  ],
  t18: [
    { label: 'สายระหว่างอาคาร (ประมาณ 300 เมตร) เป็นสายไฟเบอร์', max: 2.5, run: (C) => {
      const sw = C.byId.get('swB');
      if (!sw || sw.type !== 'switch' || sw.hub) return { frac: 0, fb: ['ไม่พบ SW-Workshop ของอาคาร 2 (อย่าลบหรือเปลี่ยนชนิด Switch ของโจทย์)'] };
      const cross = C.adj('swB').filter((x) => !T18_B2.has(x.other.id) && x.medium !== 'wifi');
      const act = cross.filter((x) => x.active);
      if (!act.length) return { frac: 0, fb: ['SW-Workshop (อาคาร 2) ยังไม่มีสายที่ใช้งานได้เชื่อมไปยังอาคาร 1'] };
      const fb = act.filter((x) => x.medium !== 'fiber').map((x) => `สาย ${x.link.id} จาก SW-Workshop ไปยัง ${x.other.name} (อาคาร 1) เป็น UTP แต่ระยะประมาณ 300 เมตรเกินระยะ 100 เมตรต่อช่วงของ Ethernet บนสาย UTP — เปลี่ยนเป็นสายไฟเบอร์`);
      return { frac: act.filter((x) => x.medium === 'fiber').length / act.length, fb };
    } },
    { label: 'PC ของอาคาร 2 ต่อเข้ากับ SW-Workshop ในอาคารเดียวกัน', max: 2, run: (C) => {
      const P = fixedDevs(C, ['pcW1', 'pcW2'], 'pc');
      let ok = 0; const fb = P.fb.slice();
      P.have.forEach((p) => {
        const w = wiredActive(C, p.id);
        if (w.some((x) => x.other.id === 'swB')) ok++;
        else if (w.length) fb.push(`${p.name} อยู่ในอาคาร 2 แต่สายต่อไปที่ ${w[0].other.name} — ย้ายสายไปเข้า SW-Workshop`);
        else fb.push(`${p.name} ยังไม่มีสายที่ใช้งานได้`);
      });
      return { frac: ok / 2, fb };
    } },
    { label: 'Printer-Office อยู่ใน LAN สำนักงาน (ต่อเข้า Switch ของวง 192.168.10.0/24)', max: 1.5, run: (C) => {
      const p = C.byId.get('prn1'), o = C.byId.get('pcO1') || C.byId.get('pcO2');
      if (!p || p.type !== 'printer') return { frac: 0, fb: ['ไม่พบ Printer-Office ของโจทย์'] };
      const w = wiredActive(C, p.id);
      const toSw = w.some((x) => x.other.type === 'switch' && !x.other.hub);
      if (toSw && inDom(C, p, o)) return { frac: 1, fb: [] };
      const r = w.find((x) => x.other.type === 'router');
      if (r) return { frac: 0, fb: [`Printer-Office เสียบอยู่ที่ขา ${r.otherPort} ของ ${r.other.name} ซึ่งเป็นอีกวงหนึ่ง (Router แยกแต่ละขาเป็นคนละเครือข่าย) — ย้ายสายไปเข้า SW-Office`] };
      return { frac: toSw ? 0.5 : 0, fb: [toSw ? 'Printer-Office ต่อเข้า Switch ที่ไม่ได้อยู่วงเดียวกับ PC สำนักงาน' : 'Printer-Office ยังไม่มีสายที่ใช้งานได้เข้า Switch'] };
    } },
    { label: 'IP และ Default gateway ของทุกเครื่องยังเป็นวงเดิมและถูกต้อง', max: 1.5, run: (C) => {
      const ids = Object.keys(T18_PLAN), hosts = ids.map((id) => C.byId.get(id)).filter(Boolean);
      let ok = 0; const fb = [];
      ids.forEach((id) => {
        const d = C.byId.get(id); const c = d && C.config(id);
        if (!d) return;
        if (c && c.ip && IP.inSubnet(c.ip, T18_PLAN[id], 24) && c.prefix === 24) ok++;
        else fb.push(`${d.name} ต้องใช้ IP ในวงเดิม ${T18_PLAN[id]}/24 (แก้ปัญหาที่สาย ไม่ใช่ย้ายเครื่องไปวงอื่น)`);
      });
      const gw = gatewayCheck(C, hosts, C.ofType('router'));
      return { frac: (ok / ids.length + gw.frac * hosts.length / ids.length) / 2, fb: fb.concat(gw.fb) };
    } },
    { label: 'ทุก PC ping กันได้และ ping Printer-Office ได้', max: 2.5, run: (C) => {
      const pcs = ['pcO1', 'pcO2', 'pcW1', 'pcW2'].map((id) => C.byId.get(id)).filter(Boolean);
      const prn = C.byId.get('prn1') ? [C.byId.get('prn1')] : [];
      const r = pingSet(C, allPairs(C, pcs, pcs.concat(prn)), 'ไม่พบเครื่องของโจทย์');
      r.frac = r.frac * (pcs.length + prn.length) / 5;
      return r;
    } }
  ],
  t19: [
    { label: 'Subnet mask ของทุกเครื่องและทุกขาของ Router เป็น Default mask ตามคลาส', max: 3, run: (C) => {
      let ok = 0, n = 0; const fb = [];
      const judge = (name, ip, prefix) => {
        n++;
        const dp = IP.defaultPrefix(ip);
        if (dp === null) { fb.push(`${name}: ${ip} ไม่ใช่ IP ของ Class A, B หรือ C`); return; }
        if (prefix === dp) ok++;
        else fb.push(`${name} ใช้ ${ip}/${prefix} แต่ ${ip.split('.')[0]}.x เป็น Class ${IP.classOf(ip)} ซึ่ง Default mask คือ ${IP.mask(dp)} (/${dp})`);
      };
      t19Hosts(C).forEach((g) => g.hosts.forEach((h) => { const c = C.config(h.id); if (c && c.ip && !c.apipa) judge(h.name, c.ip, c.prefix); else { n++; fb.push(`${h.name} ยังไม่มี IP address`); } }));
      const r = C.byId.get('r1');
      const legs = r ? ((C.config('r1') || {}).ifaces || []).filter((f) => f.ip) : [];
      legs.forEach((f) => judge(`${r.name} ขา ${f.iface}`, f.ip, f.prefix));
      n += Math.max(0, 3 - legs.length);
      if (legs.length < 3) fb.push(`${r ? r.name : 'Router1'} ตั้ง IP แล้ว ${legs.length} ขา ต้องมีขาละเครือข่ายครบ 3 ขา`);
      return { frac: n ? ok / n : 0, fb: fb.slice(0, 5) };
    } },
    { label: 'IP อยู่ในเครือข่ายที่กำหนดของแต่ละ LAN ไม่ซ้ำ และไม่ใช่ Network/Broadcast address', max: 2, run: (C) => {
      let ok = 0, n = 0; const fb = [];
      t19Hosts(C).forEach(({ n: N, hosts }) => {
        n += N.ids.length;
        hosts.forEach((h) => {
          const c = C.config(h.id);
          if (!c || !c.ip || c.apipa) { fb.push(`${h.name} ยังไม่มี IP address ที่ใช้งานได้ (${N.lan} ใช้เครือข่าย ${N.net})`); return; }
          if (!IP.inSubnet(c.ip, N.net, N.prefix)) { fb.push(`${h.name} อยู่ ${N.lan} ต้องใช้ IP ในเครือข่าย ${N.net} (Class ${N.cls}) แต่ตั้งเป็น ${c.ip}`); return; }
          if (c.ip === IP.network(N.net, N.prefix) || c.ip === IP.broadcast(N.net, N.prefix)) { fb.push(`${h.name} ใช้ ${c.ip} ซึ่งเป็น ${c.ip === IP.network(N.net, N.prefix) ? 'Network address' : 'Broadcast address'} ของเครือข่าย ใช้เป็น IP ของเครื่องไม่ได้`); return; }
          const st = staticOk(C, h);
          if (!st.ok) { fb.push(st.msg); return; }
          ok++;
        });
      });
      const dups = dupMsgs(C);
      if (dups.length) fb.push(dups[0].msg);
      return { frac: (ok / n) * (dups.length ? 0.5 : 1), fb: fb.slice(0, 5) };
    } },
    { label: 'Router มีขาในทั้ง 3 เครือข่าย และ Default gateway ถูกต้อง', max: 2, run: (C) => {
      const r = C.byId.get('r1');
      const fb = [];
      const legs = r && r.type === 'router' ? ((C.config('r1') || {}).ifaces || []).filter((f) => f.ip && f.up && f.linked) : [];
      let cov = 0;
      T19_NETS.forEach((N) => {
        if (legs.some((f) => f.network === N.net && f.prefix === N.prefix)) cov++;
        else fb.push(`Router1 ยังไม่มีขาที่ใช้งานได้ในเครือข่าย ${N.net}/${N.prefix} (${N.lan})`);
      });
      const hosts = [].concat(...t19Hosts(C).map((g) => g.hosts));
      const gw = gatewayCheck(C, hosts, C.ofType('router'));
      return { frac: (cov / 3 + gw.frac * hosts.length / 6) / 2, fb: fb.concat(gw.fb) };
    } },
    { label: 'ทุกเครื่อง ping ข้ามเครือข่ายได้', max: 3, run: (C) => {
      const groups = t19Hosts(C);
      const pairs = [];
      groups.forEach((g, i) => groups.forEach((h, j) => { if (i !== j) g.hosts.forEach((a) => h.hosts.forEach((b) => pairs.push({ src: a, target: C.ip(b.id), label: hostLabel(C, b) }))); }));
      const r = pingSet(C, pairs, 'ไม่พบเครื่องของโจทย์');
      r.frac = r.frac * pairs.length / 24;
      return r;
    } }
  ]
});

// --- shared check bodies
function ipPlan(C, hosts, need) {
  if (!hosts.length) return { frac: 0, fb: ['ยังไม่มีเครื่องให้ตรวจ IP'] };
  let ok = 0; const fb = [];
  hosts.forEach((h) => {
    if (h.dhcp) { fb.push(`${h.name} ตั้งเป็น DHCP แต่ภารกิจนี้ไม่มี DHCP server ให้ตั้ง IP แบบ Static`); return; }
    const r = staticOk(C, h); if (r.ok) ok++; else fb.push(r.msg);
  });
  const dups = dupMsgs(C);
  const same = sameNetwork(C, hosts);
  if (dups.length) fb.push(dups[0].msg);
  if (!same) fb.push('IP ของแต่ละเครื่องอยู่คนละวงเครือข่าย (Network address ไม่เท่ากัน) ตรวจทั้ง IP และ Subnet mask ให้เป็นวงเดียวกัน');
  const valid = ok / Math.max(need, hosts.length);
  return { frac: valid * 0.5 + (same && !dups.length && ok > 0 ? 0.5 : 0), fb };
}

function mainRouter(C) {
  const rs = C.ofType('router');
  return rs.find((r) => C.linkedTo(r.id, 'internet').length) || rs[0] || null;
}
function routerCabling(C, types) {
  const r = mainRouter(C);
  if (!r) return { frac: 0, fb: ['ยังไม่มี Router ในแผนผัง'] };
  let ok = 1; const fb = [];
  types.forEach((t) => {
    const l = C.linkedTo(r.id, t);
    const what = t === 'internet' ? 'ISP (Internet)' : 'Switch';
    if (l.some((x) => x.active)) ok++;
    else if (l.length) fb.push(`สายระหว่าง ${r.name} กับ ${what} ใช้งานไม่ได้ (${LINK_REASON[l[0].reason] || l[0].reason})`);
    else fb.push(`${r.name} ยังไม่ได้ต่อสายกับ ${what}`);
  });
  return { frac: ok / (types.length + 1), fb };
}
function t3RouterIps(C) {
  const r = mainRouter(C);
  if (!r) return { frac: 0, fb: ['ยังไม่มี Router จึงตรวจ IP ของ Router ไม่ได้'] };
  const fb = []; let ok = 0;
  const overlap = C.errorsOf(r.id).find((p) => p.code === 'router_overlap');
  const ifaceErr = C.errorsOf(r.id).find((p) => p.code !== 'router_overlap');
  if (ifaceErr) fb.push(ifaceErr.msg);
  // LAN: interface linked to the switch must be in the PCs' subnet
  const pcNets = new Set(C.ofType('pc').map((p) => C.netOf(p.id)).filter(Boolean));
  const lan = C.linkedTo(r.id, 'switch')[0];
  const ifCfg = (port) => { const c = C.config(r.id); return (c && c.ifaces || []).find((f) => f.iface === port) || null; };
  if (!lan) fb.push(`${r.name} ยังไม่มีขาที่ต่อกับ Switch (LAN)`);
  else {
    const f = ifCfg(lan.port);
    if (!f || !f.ip) fb.push(`${r.name} ขา ${lan.port} (ฝั่ง LAN) ยังไม่ได้ตั้ง IP address`);
    else if (!pcNets.has(f.network + '/' + f.prefix)) fb.push(`IP ${f.ip}/${f.prefix} ของ ${r.name} ขา ${lan.port} ไม่อยู่วงเดียวกับ PC (${Array.from(pcNets).join(', ') || 'PC ยังไม่มี IP'})`);
    else ok++;
  }
  const wan = C.linkedTo(r.id, 'internet')[0];
  if (!wan) fb.push(`${r.name} ยังไม่มีขาที่ต่อกับ ISP (WAN)`);
  else {
    const f = ifCfg(wan.port);
    const ispIf = (wan.other.ifaces || []).find((x) => x.name === wan.otherPort);
    const ispIp = ispIf && ispIf.ip;
    if (!f || !f.ip) fb.push(`${r.name} ขา ${wan.port} (ฝั่ง WAN) ยังไม่ได้ตั้ง IP address`);
    else if (ispIp && !IP.inSubnet(ispIp, f.ip, f.prefix)) fb.push(`IP ${f.ip}/${f.prefix} ของ ${r.name} ขา ${wan.port} ไม่อยู่วงเดียวกับ ISP (${ispIp}) จึงคุยกับ ISP ไม่ได้`);
    else ok++;
  }
  if (overlap) { fb.push(overlap.msg); ok = Math.min(ok, 1); }
  return { frac: ok / 2, fb };
}
function defaultRoute(C) {
  const r = mainRouter(C);
  if (!r) return { frac: 0, fb: ['ยังไม่มี Router จึงยังไม่มีเส้นทางออกอินเทอร์เน็ต'] };
  const rt = C.net.routes(r.id);
  const def = rt.find((x) => x.prefix === 0);
  if (!def) {
    const raw = (r.routes || []).find((x) => String(x.net) === '0.0.0.0');
    if (raw) return { frac: 0, fb: [`Default route บน ${r.name} ใช้งานไม่ได้: Next hop ${raw.via || '(ว่าง)'} ต้องเป็น IP ของ ISP ที่อยู่วงเดียวกับขา WAN`] };
    return { frac: 0, fb: [`${r.name} ยังไม่มี Default route (0.0.0.0/0) จึงไม่รู้ว่าจะส่งแพ็กเก็ตที่ไปอินเทอร์เน็ตออกทางไหน`] };
  }
  const ispIps = new Set();
  C.ofType('internet').forEach((n) => (n.ifaces || []).forEach((f) => { if (f.ip) ispIps.add(f.ip); }));
  if (!ispIps.has(def.via)) return { frac: 0.5, fb: [`Default route ของ ${r.name} ชี้ไปที่ ${def.via || def.iface} ซึ่งไม่ใช่ IP ของ ISP`] };
  return { frac: 1, fb: [] };
}
function routerCoversLans(C) {
  const rs = C.ofType('router');
  if (!rs.length) return { frac: 0, fb: ['ยังไม่มี Router'] };
  const fb = [];
  const pcNets = Array.from(new Set(C.ofType('pc').map((p) => C.netOf(p.id)).filter(Boolean)));
  // pick the router covering the most PC subnets
  let best = null, bestCov = -1, bestNets = [];
  rs.forEach((r) => {
    const c = C.config(r.id);
    const nets = (c && c.ifaces || []).filter((f) => f.ip && f.up && f.linked).map((f) => ({ net: f.network + '/' + f.prefix, f }));
    const cov = pcNets.filter((n) => nets.some((x) => x.net === n)).length;
    if (cov > bestCov) { best = r; bestCov = cov; bestNets = nets; }
  });
  const overlap = C.errorsOf(best.id).find((p) => p.code === 'router_overlap');
  if (overlap) return { frac: 0, fb: [overlap.msg + ' — แต่ละขาของ Router ต้องเป็นคนละวงเครือข่าย'] };
  const errs = C.errorsOf(best.id);
  if (errs.length) fb.push(errs[0].msg);
  const distinct = new Set(bestNets.map((x) => x.net));
  if (distinct.size < 2) fb.push(`${best.name} มีขาที่ตั้ง IP และต่อสายใช้งานได้ ${distinct.size} ขา ต้องมีอย่างน้อย 2 ขา (ขาละวง)`);
  pcNets.forEach((n) => { if (!bestNets.some((x) => x.net === n)) fb.push(`${best.name} ยังไม่มีขาที่อยู่ในวง ${n} ของ PC (ตรวจ IP/Subnet mask ของขา Router และสายที่ต่อกับ Switch วงนั้น)`); });
  const need = Math.max(2, pcNets.length);
  return { frac: errs.length ? Math.min(0.5, bestCov / need) : bestCov / need, fb };
}
function dhcpServerDev(C) {
  return C.devs.filter((d) => (d.type === 'server' || d.type === 'pc') && d.services && d.services.dhcp).sort((a, b) => natCmp(a.id, b.id))[0] || null;
}
function dhcpServer(C) {
  const srv = dhcpServerDev(C);
  if (!srv) return { frac: 0, fb: ['ยังไม่มี Server ที่เปิดบริการ DHCP (เลือก Server แล้วติ๊ก "เปิดบริการ DHCP")'] };
  let ok = 1; const fb = [];
  const st = staticOk(C, srv);
  if (srv.dhcp) fb.push(`${srv.name} เป็น DHCP server ต้องใช้ IP แบบ Static ไม่ใช่รับ IP จาก DHCP`);
  else if (!st.ok) fb.push(st.msg);
  else ok++;
  const poolErr = C.problems.find((p) => p.code === 'dhcp_pool_bad' && p.dev === srv.id);
  const pool = Array.isArray(srv.services.dhcp) ? srv.services.dhcp[0] : srv.services.dhcp;
  const c = C.config(srv.id);
  const sI = IP.parse(pool && pool.start), eI = IP.parse(pool && pool.end);
  if (poolErr) fb.push(poolErr.msg);
  else if (sI === null || eI === null) fb.push(`ช่วงแจก IP ของ ${srv.name} ไม่ถูกต้อง (ต้องกรอก IP เริ่มต้นและสิ้นสุด)`);
  else if (c && c.ip && IP.parse(c.ip) >= sI && IP.parse(c.ip) <= eI) fb.push(`ช่วงแจก IP ของ ${srv.name} รวม IP ของตัว Server เอง (${c.ip}) ไว้ด้วย ควรเริ่มช่วงหลังจาก IP ที่ใช้แบบ Static`);
  else ok++;
  return { frac: ok / 3, fb };
}
function dnsServer(C) {
  const hosts = C.devs.filter((d) => ['server', 'pc', 'laptop'].includes(d.type) && d.services && d.services.dns && d.services.dns.enabled !== false);
  if (!hosts.length) return { frac: 0, fb: ['ยังไม่มี Server ที่เปิดบริการ DNS (เลือก Server1 แล้วติ๊ก "เปิดบริการ DNS")'] };
  const serverIps = new Set(C.ofType('server').map((d) => C.ip(d.id)).filter(Boolean));
  let best = 1 / 3; let fb = ['ยังไม่มีระเบียน srv.lab.local ใน DNS server (เพิ่มระเบียน ชื่อ srv.lab.local → IP ของ Server)'];
  hosts.forEach((h) => {
    const rec = h.services.dns.records || {};
    const key = Object.keys(rec).find((k) => k.trim().toLowerCase().replace(/\.$/, '') === 'srv.lab.local');
    if (key === undefined) return;
    const v = String(rec[key]).trim();
    if (serverIps.has(v)) { best = 1; fb = []; }
    else if (best < 1) { best = 2 / 3; fb = [`ระเบียน srv.lab.local บน ${h.name} ชี้ไปที่ ${v || '(ว่าง)'} ซึ่งไม่ใช่ IP ของ Server`]; }
  });
  return { frac: best, fb };
}
function nameCheck(C, name) {
  const pcs = C.ofType('pc').slice(0, 8);
  if (!pcs.length) return { frac: 0, fb: ['ไม่พบ PC'] };
  let pts = 0; const fb = [];
  pcs.forEach((p) => {
    const r = C.net.resolve(p.id, name);
    if (!r.ok) {
      fb.push(`${p.name} แปลงชื่อ ${name} เป็น IP ไม่ได้: ${NetSim.reasonText[r.reason] || r.reason}` + (PING_HINT[r.reason] ? ` — ${PING_HINT[r.reason]}` : ''));
      return;
    }
    pts += 0.5;
    const pr = pingMsg(C, p, name, `${name} (${r.ip})`);
    if (pr.ok) pts += 0.5; else fb.push(pr.msg);
  });
  return { frac: pts / pcs.length, fb: fb.slice(0, 4) };
}

// ---------------------------------------------------------------------------------------------
function zero(msg) { return { score: 0, max: MAX, ok: false, feedback: [msg], details: { checks: [] } }; }

// ---------------------------------------------------------------------------------------------
// t9 capstone: payload { topo, plan:{lab|teachers|office:{net,prefix,gateway}}, report, fault:{kind,dev,link,plan,baseline} }
const CAP = NetSim.capstone;
function cleanPlan(p) {
  const o = {};
  if (!isObj(p)) return o;
  CAP.CAP.areas.forEach((a) => { const r = p[a.id]; if (isObj(r)) o[a.id] = { net: s(r.net), prefix: s(r.prefix), gateway: s(r.gateway) }; });
  return o;
}
function gradeCapstone(payload) {
  const max = 40;
  const z = (msg) => ({ score: 0, max, ok: false, feedback: [msg], details: { checks: [] }, rubric: [] });
  const sz = sanitize(payload);
  if (sz.err) return z(sz.err);
  if (!sz.topo.devices.length) return z('แผนผังยังว่างอยู่ ยังไม่มีอุปกรณ์ให้ตรวจ');
  const input = { plan: cleanPlan(payload.plan), report: typeof payload.report === 'string' ? payload.report.slice(0, 6000) : '' };
  if (isObj(payload.fault)) {
    const f = payload.fault;
    const bz = isObj(f.baseline) ? sanitize({ topo: f.baseline }) : { err: 1 };
    input.fault = { kind: s(f.kind), dev: s(f.dev), link: s(f.link), plan: cleanPlan(f.plan), baseline: bz.err ? null : bz.topo };
  }
  const r = CAP.evaluate(sz.topo, input);
  const feedback = [];
  r.items.forEach((it) => {
    if (it.score >= it.max) return;
    it.checks.filter((c) => !c.ok && c.msg).slice(0, 3).forEach((c) => feedback.push(`${it.title}: ${c.msg}`));
  });
  if (r.score >= r.max) feedback.unshift('ยอดเยี่ยม! เครือข่ายของวิทยาลัยผ่านทุกเกณฑ์อัตโนมัติ ครูจะตรวจรายงานและเหตุผลการออกแบบเพิ่มเติม');
  else feedback.unshift(`คะแนนอัตโนมัติ ${r.score}/${r.max} — ดูรายละเอียดแต่ละเกณฑ์ด้านล่าง (ครูจะตรวจรายงานอีก 2 เกณฑ์)`);
  return {
    score: r.score, max: r.max, ok: r.score >= r.max, feedback: feedback.slice(0, 30),
    rubric: r.rubric,
    details: { checks: r.items.map((it) => ({ label: it.title, score: it.score, max: it.max, ok: it.score >= it.max })),
      items: r.items, matrix: r.matrix, buildOk: r.buildOk, fault: r.fault }
  };
}

// ---------------------------------------------------------------------------------------------
// t10–t13: NAT/PAT + ACL. The engine re-runs the whole test matrix on the submitted topology (provider-side devices
// are restored from the mission and the ISP always requires NAT), see NetSim.natlab.evaluate.
function gradeNatLab(m, payload) {
  const sz = sanitize(payload);
  if (sz.err) return zero(sz.err);
  if (!sz.topo.devices.length) return zero('แผนผังยังว่างอยู่ ยังไม่มีอุปกรณ์ให้ตรวจ');
  const r = NetSim.natlab.evaluate(m.id, sz.topo);
  if (r.error || !Array.isArray(r.items) || !r.items.length) return zero('ตรวจงานไม่ได้ เพราะข้อมูลเครือข่ายไม่สมบูรณ์');
  const checks = r.items.map((it) => ({ label: it.title, score: it.score, max: it.max, ok: it.score >= it.max }));
  const feedback = [];
  r.items.forEach((it) => {
    if (it.score >= it.max) return;
    it.checks.filter((c) => !c.ok && c.msg).slice(0, 2).forEach((c) => { const f = `${it.title}: ${c.msg}`; if (!feedback.includes(f)) feedback.push(f); });
  });
  if (r.penalty) { checks.push({ label: 'หักคะแนน: ใช้ permit ip any any', score: -r.penalty.points, max: 0, ok: false }); feedback.unshift(r.penalty.msg); }
  const score = Math.max(0, Math.min(MAX, r.score));
  if (score >= MAX) feedback.unshift('ยอดเยี่ยม! ผลทดสอบทุกข้อเป็นไปตามข้อกำหนด (คำนวณใหม่บนเซิร์ฟเวอร์จากแผนผังที่ส่ง)');
  else feedback.unshift(`ผ่าน ${checks.filter((c) => c.ok).length}/${r.items.length} เกณฑ์ — ดูรายละเอียดด้านล่าง`);
  return { score, max: MAX, ok: score >= MAX, feedback: feedback.slice(0, 20),
    details: { checks, matrix: r.cells.map((c) => ({ id: c.id, label: c.label, want: c.want, pass: c.pass, tests: c.tests.slice(0, 6).map((t) => ({ src: t.srcName, ok: t.ok, code: t.code, title: t.title, acl: t.acl })) })),
      natTable: (r.natTable || []).slice(0, 40) } };
}

function grade(missionId, payload) {
  try {
    const m = MISSIONS.find((x) => x.id === missionId);
    if (!m) return zero('ไม่พบภารกิจนี้');
    if (NL_IDS.has(m.id)) { try { return gradeNatLab(m, payload); } catch (e) { return zero('ข้อมูลที่ส่งมาไม่ถูกต้อง ตรวจงานไม่ได้'); } }
    if (m.id === 't9') { try { return gradeCapstone(payload); } catch (e) { return Object.assign(zero('ข้อมูลที่ส่งมาไม่ถูกต้อง ตรวจงานไม่ได้'), { max: m.max, rubric: [] }); } }
    const sz = sanitize(payload);
    if (sz.err) return zero(sz.err);
    if (!sz.topo.devices.length) return zero('แผนผังยังว่างอยู่ ยังไม่มีอุปกรณ์ให้ตรวจ');
    const net = NetSim.create(sz.topo);
    const C = makeCtx(net);
    const X = { answers: cleanAnswers(m.id, payload.answers) };   // only the quiz choices of this mission; anything else is ignored
    const checks = [];
    const feedback = [];
    let score = 0;
    CHECKS[m.id].forEach((ck) => {
      let r;
      try { r = ck.run(C, X); } catch (e) { r = { frac: 0, fb: ['ตรวจข้อนี้ไม่ได้ เพราะข้อมูลไม่สมบูรณ์'] }; }
      const frac = Math.max(0, Math.min(1, Number(r.frac) || 0));
      const pts = frac >= 1 ? ck.max : half(frac * ck.max);
      score += pts;
      const fb = (r.fb || []).filter(Boolean);
      checks.push({ label: ck.label, score: pts, max: ck.max, ok: pts === ck.max });
      if (pts < ck.max) {
        if (!fb.length) fb.push('ยังไม่ผ่านข้อนี้');
        fb.forEach((f) => feedback.push(`${ck.label}: ${f}`));
      }
    });
    score = Math.round(score * 10) / 10;
    if (score >= MAX) feedback.unshift('ยอดเยี่ยม! เครือข่ายทำงานได้ครบทุกข้อของภารกิจ');
    else {
      const errs = C.problems.filter((p) => p.level === 'error' && !feedback.some((f) => f.includes(p.msg))).slice(0, 2);
      errs.forEach((p) => feedback.push('ข้อผิดพลาดอื่นที่ระบบพบ: ' + p.msg));
    }
    return { score, max: MAX, ok: score >= MAX, feedback: feedback.slice(0, 20), details: { checks, errors: C.problems.filter((p) => p.level === 'error').length } };
  } catch (e) {
    return zero('ข้อมูลที่ส่งมาไม่ถูกต้อง ตรวจงานไม่ได้');
  }
}

module.exports = {
  id: 'topology',
  title: 'จำลองการออกแบบเครือข่าย',
  missions: MISSIONS,
  grade,
  _lib: { sanitize }
};
