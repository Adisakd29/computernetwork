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
      link('l4', 'pc1', 'eth0', 'sw1', 'p3'), link('l5', 'pc2', 'eth0', 'sw1', 'p4')] } }
];

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
  ]
};

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

function grade(missionId, payload) {
  try {
    const m = MISSIONS.find((x) => x.id === missionId);
    if (!m) return zero('ไม่พบภารกิจนี้');
    const sz = sanitize(payload);
    if (sz.err) return zero(sz.err);
    if (!sz.topo.devices.length) return zero('แผนผังยังว่างอยู่ ยังไม่มีอุปกรณ์ให้ตรวจ');
    const net = NetSim.create(sz.topo);
    const C = makeCtx(net);
    const checks = [];
    const feedback = [];
    let score = 0;
    CHECKS[m.id].forEach((ck) => {
      let r;
      try { r = ck.run(C); } catch (e) { r = { frac: 0, fb: ['ตรวจข้อนี้ไม่ได้ เพราะข้อมูลไม่สมบูรณ์'] }; }
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
