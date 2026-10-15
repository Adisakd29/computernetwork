// Tests for the Network Topology grader: node tests/sims/topology.test.js
'use strict';
const assert = require('assert');
const g = require('../../server/sims/topology.js');

const clone = (x) => JSON.parse(JSON.stringify(x));
const start = (id) => clone(g.missions.find((m) => m.id === id).start);
const dev = (t, id) => t.devices.find((d) => d.id === id);
const fbHas = (r, re) => r.feedback.some((f) => re.test(f));
const check = (r, label) => r.details.checks.find((c) => label.test(c.label));
const show = (r) => `score ${r.score}\n  ` + r.feedback.join('\n  ');

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message); }
}

const host = (type, id, name, ip, prefix, extra) => Object.assign({ id, type, name, x: 0, y: 0,
  ifaces: [{ name: type === 'laptop' ? 'wlan0' : 'eth0', ip: ip || '', prefix: prefix === undefined ? 24 : prefix }], gateway: '', dns: [], dhcp: false }, extra || {});
const L = (id, a, ap, b, bp, medium) => ({ id, a: { dev: a, port: ap }, b: { dev: b, port: bp }, medium: medium || 'utp', up: true });
const router = (id, ifs, routes) => ({ id, type: 'router', name: 'Router1', x: 0, y: 0,
  ifaces: ['g0/0', 'g0/1', 'g0/2', 'g0/3'].map((n, i) => ({ name: n, ip: (ifs[i] || [])[0] || '', prefix: (ifs[i] || [])[1] === undefined ? '' : ifs[i][1] })), routes: routes || [] });

// ---------------------------------------------------------------- correct solutions
function solT1() {
  return { devices: [
    { id: 'sw1', type: 'switch', name: 'Switch1', x: 300, y: 200, ports: 24 },
    host('pc', 'pc1', 'PC1', '192.168.1.10'), host('pc', 'pc2', 'PC2', '192.168.1.11', '255.255.255.0')
  ], links: [L('l1', 'pc1', 'eth0', 'sw1', 'p1'), L('l2', 'pc2', 'eth0', 'sw1', 'p2')] };
}
function solT2() {
  const t = start('t2');
  for (let i = 1; i <= 4; i++) { t.devices.push(host('pc', 'pc' + i, 'PC' + i, '192.168.10.1' + i)); t.links.push(L('l' + i, 'pc' + i, 'eth0', 'sw1', 'p' + i)); }
  t.devices.push(host('printer', 'prn1', 'Printer1', '192.168.10.50')); t.links.push(L('l5', 'prn1', 'eth0', 'sw1', 'p5'));
  return t;
}
function solT3() {
  const t = start('t3');
  t.devices.push(router('r1', [['192.168.1.1', 24], ['100.64.0.2', 30]], [{ net: '0.0.0.0', prefix: 0, via: '100.64.0.1' }]));
  t.links.push(L('l3', 'r1', 'g0/0', 'sw1', 'p3'), L('l4', 'r1', 'g0/1', 'net1', 'wan'));
  dev(t, 'pc1').gateway = '192.168.1.1'; dev(t, 'pc2').gateway = '192.168.1.1';
  return t;
}
function solT4() {
  const t = start('t4');
  t.devices.push(router('r1', [['192.168.10.1', 24], ['192.168.20.1', '255.255.255.0']]));
  t.links.push(L('l5', 'r1', 'g0/0', 'sw1', 'p3'), L('l6', 'r1', 'g0/1', 'sw2', 'p3'));
  ['pc1', 'pc2'].forEach((id) => { dev(t, id).gateway = '192.168.10.1'; });
  ['pc3', 'pc4'].forEach((id) => { dev(t, id).gateway = '192.168.20.1'; });
  return t;
}
function solT5() {
  const t = start('t5');
  dev(t, 'srv1').services = { dhcp: { start: '192.168.1.100', end: '192.168.1.150', prefix: 24, gateway: '', dns: [] } };
  ['pc1', 'pc2', 'pc3'].forEach((id) => { dev(t, id).dhcp = true; });
  return t;
}
function solT6() {
  const t = start('t6');
  t.devices.push(host('laptop', 'lap1', 'Laptop1', '192.168.1.21', 24, { ssid: 'NETLAB-ROOM3' }),
    host('laptop', 'lap2', 'Laptop2', '192.168.1.22', 24, { ssid: 'NETLAB-ROOM3' }));
  t.links.push(L('l2', 'ap1', 'p1', 'sw1', 'p2'), L('l3', 'lap1', 'wlan0', 'ap1', 'wifi', 'wifi'), L('l4', 'lap2', 'wlan0', 'ap1', 'wifi', 'wifi'));
  return t;
}
function solT7() {
  const t = start('t7');
  dev(t, 'srv1').services = { dns: { records: { 'srv.lab.local': '192.168.1.5' } } };
  dev(t, 'pc1').dns = ['192.168.1.5']; dev(t, 'pc2').dns = ['192.168.1.5'];
  return t;
}
const SOL = { t1: solT1, t2: solT2, t3: solT3, t4: solT4, t5: solT5, t6: solT6, t7: solT7 };

console.log('topology grader');

it('module shape follows SIM-SPEC §2', () => {
  assert.strictEqual(g.id, 'topology');
  assert.strictEqual(g.title, 'จำลองการออกแบบเครือข่าย');
  assert.deepStrictEqual(g.missions.slice(0, 8).map((m) => m.id), ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']);
  for (const m of g.missions) {
    assert.strictEqual(m.max, m.id === 't9' ? 40 : 10);
    assert.ok(m.title && m.desc && Array.isArray(m.hints) && m.hints.length >= 2, m.id);
    assert.ok(['easy', 'medium', 'hard'].includes(m.level));
    assert.ok(m.start && Array.isArray(m.start.devices) && Array.isArray(m.start.links), m.id + ' start');
  }
});

for (const id of Object.keys(SOL)) {
  it(`${id}: correct topology scores 10/10`, () => {
    const r = g.grade(id, { topo: SOL[id]() });
    assert.strictEqual(r.score, 10, show(r));
    assert.strictEqual(r.ok, true); assert.strictEqual(r.max, 10);
    assert.ok(r.details.checks.every((c) => c.ok));
  });
}

it('mission starts alone do not pass (no answers inside start)', () => {
  for (const m of g.missions) {
    const r = g.grade(m.id, { topo: clone(m.start) });
    assert.ok(r.score < 10, m.id + ' ' + show(r));
  }
});

it('t1: different subnets lose the IP plan points and the ping points', () => {
  const t = solT1(); dev(t, 'pc2').ifaces[0].ip = '192.168.2.11';
  const r = g.grade('t1', { topo: t });
  assert.strictEqual(check(r, /IP ถูกต้อง/).score, 1.5, show(r));
  assert.strictEqual(check(r, /ping/).score, 0);
  assert.ok(fbHas(r, /คนละวงเครือข่าย/));
  assert.ok(fbHas(r, /PC1 ping 192\.168\.2\.11|PC1 ping PC2/), show(r));
});

it('t1: unplugged cable is named and ping fails with no_link explanation', () => {
  const t = solT1(); t.links[1].up = false;
  const r = g.grade('t1', { topo: t });
  assert.strictEqual(check(r, /ต่อสาย/).score, 1);
  assert.ok(fbHas(r, /สายของ PC2 .*ถอด/), show(r));
  assert.ok(fbHas(r, /สายสัญญาณ.*ไม่ได้เชื่อมต่อ/), show(r));
});

it('t2: duplicate IP loses the IP plan points with a dup message', () => {
  const t = solT2(); dev(t, 'pc4').ifaces[0].ip = '192.168.10.13';
  const r = g.grade('t2', { topo: t });
  assert.ok(check(r, /IP ถูกต้อง/).score <= 1, show(r));
  assert.ok(fbHas(r, /ซ้ำ/));
  assert.ok(r.score < 10);
});

it('t2: missing printer loses count points', () => {
  const t = solT2(); t.devices = t.devices.filter((d) => d.type !== 'printer'); t.links = t.links.filter((l) => l.a.dev !== 'prn1');
  const r = g.grade('t2', { topo: t });
  assert.ok(check(r, /Printer/).score < 2);
  assert.ok(fbHas(r, /Printer อย่างน้อย 1/), show(r));
});

it('t3: wrong gateway on one PC loses gateway + ping points with field-specific feedback', () => {
  const t = solT3(); dev(t, 'pc2').gateway = '192.168.1.254';
  const r = g.grade('t3', { topo: t });
  assert.strictEqual(check(r, /Default gateway/).score, 1, show(r));
  assert.strictEqual(check(r, /8\.8\.8\.8/).score, 1);
  assert.ok(fbHas(r, /Default gateway 192\.168\.1\.254 ของ PC2 ไม่ใช่ IP ของ Router/), show(r));
  assert.ok(fbHas(r, /PC2 ping 8\.8\.8\.8 ไม่สำเร็จ: ติดต่อ Default gateway ไม่ได้/), show(r));
});

it('t3: missing default route loses the route points and pings fail with no_route', () => {
  const t = solT3(); dev(t, 'r1').routes = [];
  const r = g.grade('t3', { topo: t });
  assert.strictEqual(check(r, /Default route/).score, 0);
  assert.strictEqual(check(r, /8\.8\.8\.8/).score, 0);
  assert.strictEqual(r.score, 6, show(r));
  assert.ok(fbHas(r, /ยังไม่มี Default route \(0\.0\.0\.0\/0\)/));
  assert.ok(fbHas(r, /Router ไม่มีเส้นทาง/), show(r));
});

it('t3: gateway outside the PC subnet is reported as such', () => {
  const t = solT3(); dev(t, 'pc1').gateway = '10.0.0.1';
  const r = g.grade('t3', { topo: t });
  assert.ok(fbHas(r, /Default gateway 10\.0\.0\.1 ของ PC1 ไม่อยู่ในวงเดียวกับ IP/), show(r));
});

it('t4: same subnet on both router interfaces loses router + ping points', () => {
  const t = solT4(); dev(t, 'r1').ifaces[1].ip = '192.168.10.2'; dev(t, 'r1').ifaces[1].prefix = 24;
  const r = g.grade('t4', { topo: t });
  assert.strictEqual(check(r, /ขา LAN 2 ขา/).score, 0, show(r));
  assert.ok(fbHas(r, /ซ้อนทับกัน/));
  assert.ok(check(r, /ข้ามวง/).score < 3);
  assert.ok(r.score <= 5, show(r));
});

it('t4: one side with wrong gateway -> timeouts (reply cannot return), half the cross pings', () => {
  const t = solT4(); dev(t, 'pc3').gateway = '192.168.20.254';
  const r = g.grade('t4', { topo: t });
  assert.strictEqual(check(r, /Default gateway/).score, 1.5, show(r));
  assert.ok(fbHas(r, /ไม่ได้รับคำตอบ|ติดต่อ Default gateway ไม่ได้/), show(r));
  assert.ok(check(r, /ข้ามวง/).score >= 1 && check(r, /ข้ามวง/).score < 3, show(r));
});

it('t4: PCs without gateways get the no_gateway explanation', () => {
  const t = solT4(); ['pc1', 'pc2', 'pc3', 'pc4'].forEach((id) => { dev(t, id).gateway = ''; });
  const r = g.grade('t4', { topo: t });
  assert.strictEqual(check(r, /ข้ามวง/).score, 0);
  assert.ok(fbHas(r, /ยังไม่ได้ตั้ง Default gateway/));
  assert.ok(fbHas(r, /ไม่มี Default gateway ที่ใช้ได้/), show(r));
});

it('t5: DHCP server unplugged -> APIPA, lease and ping points lost', () => {
  const t = solT5(); t.links.find((l) => l.a.dev === 'srv1').up = false;
  const r = g.grade('t5', { topo: t });
  assert.strictEqual(check(r, /ได้ IP จาก DHCP/).score, 0, show(r));
  assert.strictEqual(check(r, /ping Server/).score, 0);
  assert.strictEqual(r.score, 5, show(r));
  assert.ok(fbHas(r, /APIPA \(169\.254/));
});

it('t5: PCs left static and pool including the server IP lose points', () => {
  const t = solT5(); dev(t, 'pc3').dhcp = false; dev(t, 'srv1').services.dhcp.start = '192.168.1.1';
  const r = g.grade('t5', { topo: t });
  assert.ok(fbHas(r, /PC3 ยังตั้ง IP แบบ Static/), show(r));
  assert.ok(fbHas(r, /รวม IP ของตัว Server เอง/), show(r));
  assert.ok(r.score < 10);
});

it('t5: no DHCP service at all', () => {
  const t = start('t5'); ['pc1', 'pc2', 'pc3'].forEach((id) => { dev(t, id).dhcp = true; });
  const r = g.grade('t5', { topo: t });
  assert.strictEqual(check(r, /เปิดบริการ DHCP/).score, 0);
  assert.ok(fbHas(r, /ยังไม่มี Server ที่เปิดบริการ DHCP/));
});

it('t6: wrong SSID on a laptop loses SSID + ping points and explains', () => {
  const t = solT6(); dev(t, 'lap2').ssid = 'NETLAB-ROOM4';
  const r = g.grade('t6', { topo: t });
  assert.strictEqual(check(r, /SSID/).score, 1, show(r));
  assert.strictEqual(check(r, /FileServer/).score, 2);
  assert.ok(fbHas(r, /SSID ของ Laptop2 คือ "NETLAB-ROOM4" ไม่ตรงกับ AP/), show(r));
  assert.ok(fbHas(r, /Laptop2 ping .*ไม่สำเร็จ: สายสัญญาณ.*Wi-Fi ไม่ได้เชื่อมต่อ/), show(r));
});

it('t6: changing the AP SSID instead is not accepted; AP not cabled loses points', () => {
  const t = solT6(); dev(t, 'ap1').ssid = 'MYWIFI'; dev(t, 'lap1').ssid = 'MYWIFI'; dev(t, 'lap2').ssid = 'MYWIFI';
  const r = g.grade('t6', { topo: t });
  assert.strictEqual(check(r, /SSID/).score, 0);
  assert.ok(fbHas(r, /ห้ามเปลี่ยน SSID/));
  const t2 = solT6(); t2.links = t2.links.filter((l) => l.id !== 'l2');
  const r2 = g.grade('t6', { topo: t2 });
  assert.strictEqual(check(r2, /Access Point ต่อสาย/).score, 0);
  assert.strictEqual(check(r2, /FileServer/).score, 0, show(r2));
});

it('t7: missing DNS record loses record + srv.lab.local points', () => {
  const t = solT7(); dev(t, 'srv1').services.dns.records = {};
  const r = g.grade('t7', { topo: t });
  assert.strictEqual(check(r, /ระเบียน/).score, 1, show(r));
  assert.strictEqual(check(r, /ping srv\.lab\.local/).score, 0);
  assert.strictEqual(check(r, /www\.netlab\.test/).score, 2.5);
  assert.ok(fbHas(r, /ยังไม่มีระเบียน srv\.lab\.local/));
  assert.ok(fbHas(r, /แปลงชื่อ srv\.lab\.local เป็น IP ไม่ได้/), show(r));
});

it('t7: PCs without DNS server cannot resolve (dns_fail explanation)', () => {
  const t = solT7(); dev(t, 'pc1').dns = [];
  const r = g.grade('t7', { topo: t });
  assert.strictEqual(check(r, /DNS server ภายใน/).score, 1);
  assert.ok(fbHas(r, /PC1 ยังไม่ได้ตั้ง DNS server/));
  assert.ok(fbHas(r, /PC1 แปลงชื่อ www\.netlab\.test เป็น IP ไม่ได้: ติดต่อ DNS server ไม่ได้/), show(r));
  assert.strictEqual(r.score, 6, show(r)); // 2 + 1 + 1.5 + 1.5
});

it('t7: server without gateway cannot forward internet names', () => {
  const t = solT7(); dev(t, 'srv1').gateway = '';
  const r = g.grade('t7', { topo: t });
  assert.strictEqual(check(r, /www\.netlab\.test/).score, 0, show(r));
  assert.strictEqual(check(r, /ping srv\.lab\.local/).score, 2.5);
});

it('malformed payloads score 0 without throwing', () => {
  const bad = [undefined, null, 42, 'x', [], {}, { topo: null }, { topo: [] }, { topo: { devices: 'a', links: [] } },
    { topo: { devices: [], links: [] } }, { topo: { devices: [null, 1, 'x', []], links: [null, 'q'] } },
    { topo: { devices: [{ id: {}, type: { a: 1 }, ifaces: 'no', services: { dns: { records: { __proto__: { x: 1 } } } } }], links: [{ a: 5, b: null }] } }];
  bad.forEach((p, i) => {
    const r = g.grade('t1', p);
    assert.strictEqual(r.max, 10); assert.ok(r.score >= 0 && r.score < 10, 'case ' + i);
    assert.ok(Array.isArray(r.feedback) && r.feedback.length, 'case ' + i);
  });
  assert.strictEqual(g.grade('t1', null).score, 0);
  assert.strictEqual(g.grade('nope', { topo: solT1() }).score, 0);
  assert.strictEqual(g.grade(undefined, undefined).score, 0);
});

it('huge payloads are rejected (devices, links, string size)', () => {
  const many = { devices: Array.from({ length: 61 }, (_, i) => host('pc', 'pc' + i, 'PC' + i, '10.0.0.' + (i + 1))), links: [] };
  let r = g.grade('t1', { topo: many });
  assert.strictEqual(r.score, 0); assert.ok(fbHas(r, /มากเกินไป/));
  r = g.grade('t1', { topo: { devices: [], links: Array.from({ length: 151 }, () => ({})) } });
  assert.strictEqual(r.score, 0);
  const big = solT1(); big.devices[0].name = 'x'.repeat(400000);
  r = g.grade('t1', { topo: big });
  assert.strictEqual(r.score, 0); assert.ok(fbHas(r, /ใหญ่เกิน/));
  const cyc = solT1(); cyc.devices[0].self = cyc;
  r = g.grade('t1', { topo: cyc });
  assert.strictEqual(r.score, 0);
});

it('long strings are truncated and records with __proto__ keys are ignored', () => {
  const t = solT7();
  t.devices.find((d) => d.id === 'srv1').services.dns.records = JSON.parse('{"__proto__":"1.2.3.4","srv.lab.local":"192.168.1.5"}');
  const r = g.grade('t7', { topo: t });
  assert.strictEqual(r.score, 10, show(r));
  const sz = g._lib.sanitize({ topo: { devices: [{ id: 'a', type: 'pc', name: 'n'.repeat(5000) }], links: [] } });
  assert.ok(sz.topo.devices[0].name.length <= 80);
});


// ---------------------------------------------------------------- t8 guided tutorial (graded from the final topology)
function solT8(opt) {
  opt = opt || {};
  const t = { devices: [
    { id: 'sw1', type: 'switch', name: 'Switch1', x: 300, y: 200, ports: 24 },
    host('pc', 'pc1', 'PC1', '192.168.1.10', 24, { gateway: '192.168.1.1' }),
    host('pc', 'pc2', 'PC2', '192.168.1.11', 24, { gateway: '192.168.1.1' }),
    router('r1', [['192.168.1.1', 24], ['192.168.2.1', 24]]),
    host('pc', 'pc3', 'PC3', '192.168.2.10', 24, { gateway: '192.168.2.1' })
  ], links: [L('l1', 'pc1', 'eth0', 'sw1', 'p1'), L('l2', 'pc2', 'eth0', 'sw1', 'p2'), L('l3', 'r1', 'g0/0', 'sw1', 'p3')] };
  if (opt.sw2) { t.devices.push({ id: 'sw2', type: 'switch', name: 'Switch2', x: 0, y: 0, ports: 24 }); t.links.push(L('l4', 'r1', 'g0/1', 'sw2', 'p1'), L('l5', 'pc3', 'eth0', 'sw2', 'p2')); }
  else t.links.push(L('l4', 'r1', 'g0/1', 'pc3', 'eth0'));
  return t;
}
it('t8 exists after t1-t7 with max 10 and empty start; t1-t7 ids unchanged', () => {
  assert.deepStrictEqual(g.missions.slice(0, 8).map((m) => m.id), ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']);
  const m = g.missions.find((x) => x.id === 't8');
  assert.strictEqual(m.max, 10); assert.deepStrictEqual(m.start, { devices: [], links: [] });
});
it('t8 full score: PC3 straight into the router, and via a second switch', () => {
  let r = g.grade('t8', { topo: solT8() });
  assert.strictEqual(r.score, 10, show(r)); assert.ok(r.ok);
  r = g.grade('t8', { topo: solT8({ sw2: true }) });
  assert.strictEqual(r.score, 10, show(r));
});
it('t8 only the first network done (tutorial step 5) = partial credit, asks for router + network 2', () => {
  const t = solT8(); t.devices = t.devices.filter((d) => d.id !== 'r1' && d.id !== 'pc3'); t.links = t.links.slice(0, 2);
  t.devices.forEach((d) => { if (d.gateway) d.gateway = ''; });
  const r = g.grade('t8', { topo: t });
  assert.strictEqual(r.score, 4.5, show(r));
  assert.ok(fbHas(r, /ยังไม่มี Router/), show(r));
});
it('t8 PC2 left in the wrong network (tutorial fault not fixed) loses IP + ping points', () => {
  const t = solT8(); dev(t, 'pc2').ifaces[0].ip = '192.168.3.11'; dev(t, 'pc2').gateway = '';
  const r = g.grade('t8', { topo: t });
  assert.ok(r.score < 10, show(r));
  assert.strictEqual(check(r, /^IP\/Subnet/).ok, false);
  assert.strictEqual(check(r, /PC วงที่ 1 ping/).ok, false);
  assert.ok(fbHas(r, /คนละวง|ต่างวง|Default gateway|gateway/), show(r));
});
it('t8 missing gateway on PC3 = cross-network ping fails (computed on the server)', () => {
  const t = solT8(); dev(t, 'pc3').gateway = '';
  const r = g.grade('t8', { topo: t });
  assert.strictEqual(check(r, /Default gateway/).ok, false);
  assert.strictEqual(check(r, /ข้ามวง/).ok, false);
  assert.ok(fbHas(r, /PC3 ยังไม่ได้ตั้ง Default gateway/), show(r));
});
it('t8 router legs in the same network / PC3 not cabled are reported', () => {
  let t = solT8(); dev(t, 'r1').ifaces[1].ip = '192.168.1.2';
  let r = g.grade('t8', { topo: t });
  assert.strictEqual(check(r, /Router ตั้ง IP/).score, 0, show(r));
  t = solT8(); t.links = t.links.filter((l) => l.id !== 'l4');
  r = g.grade('t8', { topo: t });
  assert.strictEqual(check(r, /PC วงที่ 2 ต่อสาย/).ok, false);
  assert.ok(fbHas(r, /PC3.*ยังไม่ได้ต่อสายถึง Router/), show(r));
});
it('t8 bad payloads give 0 without throwing', () => {
  assert.strictEqual(g.grade('t8', null).score, 0);
  assert.strictEqual(g.grade('t8', { topo: { devices: 'x', links: [] } }).score, 0);
  assert.strictEqual(g.grade('t8', { topo: { devices: [], links: [] } }).score, 0);
});


// ---------------------------------------------------------------- 2.8: t9 Final Network Capstone
console.log('t9 capstone');
const NetSim = require('../../public/js/sim/netsim.js');
const CAPS = NetSim.capstone;
const CP = (id, type, name, ip, prefix, gw, extra) => Object.assign({ id, type, name, x: 0, y: 0, ifaces: [{ name: type === 'laptop' ? 'wlan0' : 'eth0', ip, prefix }], gateway: gw, dns: type === 'printer' ? [] : ['8.8.8.8'], dhcp: false }, extra || {});
function capSol() {
  const t = start('t9');
  t.devices.push(
    { id: 'r1', type: 'router', name: 'R-College', x: 600, y: 120, ifaces: [
      { name: 'g0/0', ip: '172.16.10.1', prefix: 26 }, { name: 'g0/1', ip: '172.16.10.65', prefix: 27 }, { name: 'g0/2', ip: '172.16.10.97', prefix: 28 }, { name: 'g0/3', ip: '100.64.0.2', prefix: 30 }],
      routes: [{ net: '0.0.0.0', prefix: 0, via: '100.64.0.1' }], filters: [{ action: 'deny', src: '172.16.10.0/26', dst: '172.16.10.96/28', proto: 'any' }] },
    { id: 'sw1', type: 'switch', name: 'SW-Lab', x: 200, y: 300, ports: 24 },
    { id: 'sw2', type: 'switch', name: 'SW-Teach', x: 600, y: 300, ports: 24 },
    { id: 'sw3', type: 'switch', name: 'SW-Office', x: 1000, y: 300, ports: 24 },
    CP('pc1', 'pc', 'LAB-PC1', '172.16.10.10', 26, '172.16.10.1'), CP('pc2', 'pc', 'LAB-PC2', '172.16.10.11', '255.255.255.192', '172.16.10.1'),
    CP('pc3', 'pc', 'T-PC1', '172.16.10.70', 27, '172.16.10.65'), CP('pc4', 'pc', 'T-PC2', '172.16.10.71', 27, '172.16.10.65'),
    CP('prn1', 'printer', 'T-Printer', '172.16.10.90', 27, '172.16.10.65'),
    { id: 'ap1', type: 'ap', name: 'AP-Teachers', x: 600, y: 450, ssid: 'KRU-WIFI', security: 'WPA2', passphrase: 'Kru#Net2026!', ports: 1 },
    CP('laptop1', 'laptop', 'T-Laptop1', '172.16.10.80', 27, '172.16.10.65', { ssid: 'KRU-WIFI', wifiKey: 'Kru#Net2026!' }),
    CP('pc5', 'pc', 'OF-PC1', '172.16.10.100', 28, '172.16.10.97'), CP('pc6', 'pc', 'OF-PC2', '172.16.10.101', 28, '172.16.10.97'),
    CP('srv1', 'server', 'FileServer', '172.16.10.110', 28, '172.16.10.97', { services: { file: true } }));
  t.links.push(
    L('l1', 'r1', 'g0/0', 'sw1', 'p1'), L('l2', 'r1', 'g0/1', 'sw2', 'p1'), L('l3', 'r1', 'g0/2', 'sw3', 'p1'), L('l4', 'r1', 'g0/3', 'net1', 'wan'),
    L('l5', 'pc1', 'eth0', 'sw1', 'p2'), L('l6', 'pc2', 'eth0', 'sw1', 'p3'),
    L('l7', 'pc3', 'eth0', 'sw2', 'p2'), L('l8', 'pc4', 'eth0', 'sw2', 'p3'), L('l9', 'prn1', 'eth0', 'sw2', 'p4'), L('l10', 'ap1', 'p1', 'sw2', 'p5'),
    L('l11', 'laptop1', 'wlan0', 'ap1', 'wifi', 'wifi'),
    L('l12', 'pc5', 'eth0', 'sw3', 'p2'), L('l13', 'pc6', 'eth0', 'sw3', 'p3'), L('l14', 'srv1', 'eth0', 'sw3', 'p4'));
  return t;
}
const PLAN = { lab: { net: '172.16.10.0', prefix: '26', gateway: '172.16.10.1' }, teachers: { net: '172.16.10.64', prefix: '/27', gateway: '172.16.10.65' }, office: { net: '172.16.10.96/28', gateway: '172.16.10.97' } };
const REPORT = ['1) แนวคิดการออกแบบ', 'ใช้ Router หนึ่งตัวเชื่อมสามห้องที่แยก Switch ห้องละตัว เพื่อแยก Broadcast domain และควบคุมการเข้าถึงด้วยกฎไฟร์วอลล์',
  '2) แผนการแจก IP', 'ห้องแล็บ 172.16.10.0/26 ห้องครู 172.16.10.64/27 สำนักงาน 172.16.10.96/28 จัดวงใหญ่ก่อนตามหลัก VLSM ไม่ซ้อนทับกัน',
  '3) ผลการทดสอบ', 'ping จาก LAB-PC1 ไป 8.8.8.8 สำเร็จ Reply ครบ 4 ครั้ง ping จาก T-PC1 ไป 172.16.10.110 สำเร็จ ping จากห้องแล็บไปสำนักงานไม่สำเร็จตามนโยบาย',
  '4) การแก้ปัญหา', 'ผู้ใช้แจ้งว่าใช้งานไม่ได้ ตรวจด้วย ping และ ipconfig พบสาเหตุแล้วแก้การตั้งค่า ทดสอบซ้ำจนใช้งานได้ปกติทุกเครื่อง'].join('\n');
function capPayload(topo, extra) {
  const base = capSol();
  const f = CAPS.pickFault(base, PLAN);
  return Object.assign({ topo, plan: PLAN, report: REPORT, fault: Object.assign({}, f, { plan: PLAN, baseline: base }) }, extra || {});
}
const rub = (r, id) => r.rubric.find((x) => x.id === id);

it('t9: mission is public with review.teacher criteria, max 40; t1–t8 unchanged', () => {
  assert.deepStrictEqual(g.missions.slice(0, 9).map((m) => m.id), ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9']);
  g.missions.slice(0, 8).forEach((m) => assert.strictEqual(m.max, 10));
  const m = g.missions.find((x) => x.id === 't9');
  assert.strictEqual(m.max, 40); assert.strictEqual(m.level, 'hard');
  assert.deepStrictEqual(m.review.teacher.map((c) => [c.id, c.max]), [['rationale', 5], ['clarity', 5]]);
  assert.ok(m.start.devices.some((d) => d.type === 'internet'));
});
it('t9: complete correct design incl. fixed fault and report = 40/40 with rubric summing to the score', () => {
  const r = g.grade('t9', capPayload(capSol()));
  assert.strictEqual(r.score, 40, show(r)); assert.strictEqual(r.max, 40); assert.ok(r.ok);
  assert.strictEqual(r.rubric.length, 10);
  assert.strictEqual(r.rubric.reduce((a, x) => a + x.score, 0), r.score);
  assert.ok(r.details.matrix.find((c) => c.id === 'lab-office').blocked);
  assert.ok(r.details.buildOk);
});
it('t9: each injectable fault breaks the build and is detected until fixed', () => {
  const base = capSol();
  const cand = [{ kind: 'wrong_gateway', dev: 'pc3' }, { kind: 'wrong_mask', dev: 'pc5' }, { kind: 'unplugged', dev: 'pc2', link: 'l6' }, { kind: 'power_off', dev: 'sw2', area: 'teachers' }];
  cand.forEach((f) => {
    const a = CAPS.applyFault(base, f, PLAN);
    assert.ok(a.fault.symptom, f.kind);
    const r = CAPS.evaluate(a.topo, { plan: PLAN });
    assert.strictEqual(r.buildOk, false, f.kind);
  });
  // the fault picked for this design: unfixed => fault item 0, fixed => 3
  const f = CAPS.pickFault(base, PLAN);
  const broken = CAPS.applyFault(base, f, PLAN).topo;
  const r0 = g.grade('t9', capPayload(broken));
  assert.strictEqual(rub(r0, 'fault').score, 0); assert.ok(fbHas(r0, /เหตุขัดข้อง/));
  assert.strictEqual(rub(g.grade('t9', capPayload(clone(base))), 'fault').score, 3);
  // deleting the broken device is not a fix
  const del = clone(base); del.devices = del.devices.filter((d) => d.id !== f.dev); del.links = del.links.filter((l) => l.a.dev !== f.dev && l.b.dev !== f.dev);
  assert.strictEqual(rub(g.grade('t9', capPayload(del)), 'fault').score, 0);
});
it('t9: fault data that does not match the server-computed fault (tampered) or no fault stage => 0 for that item', () => {
  const p = capPayload(capSol());
  p.fault.kind = p.fault.kind === 'power_off' ? 'wrong_mask' : 'power_off'; p.fault.dev = 'sw1';
  const r = g.grade('t9', p);
  assert.strictEqual(rub(r, 'fault').score, 0); assert.ok(fbHas(r, /ไม่ตรงกับที่ระบบสร้าง/));
  const r2 = g.grade('t9', capPayload(capSol(), { fault: undefined }));
  assert.strictEqual(rub(r2, 'fault').score, 0); assert.strictEqual(r2.score, 37);
  // a baseline that never worked cannot unlock the fault stage
  const p3 = capPayload(capSol()); p3.fault.baseline = start('t9');
  assert.strictEqual(rub(g.grade('t9', p3), 'fault').score, 0);
});
it('t9: partial design — oversized /24 subnets overlap, open Wi-Fi, no firewall, no report', () => {
  const t = capSol();
  const plan = { lab: { net: '172.16.10.0', prefix: 24, gateway: '172.16.10.1' }, teachers: { net: '172.16.10.64', prefix: 26, gateway: '172.16.10.65' }, office: PLAN.office };
  const ap = dev(t, 'ap1'); ap.security = 'Open'; delete ap.passphrase;
  delete dev(t, 'r1').filters;
  const r = g.grade('t9', { topo: t, plan, report: '' });
  assert.ok(r.score > 10 && r.score < 32, show(r));
  assert.ok(rub(r, 'plan').score < 6); assert.ok(fbHas(r, /ซ้อนทับ/)); assert.ok(fbHas(r, /ใหญ่เกินความจำเป็น/));
  assert.ok(rub(r, 'wifi').score < 4); assert.ok(fbHas(r, /Open|WPA2/));
  assert.strictEqual(rub(r, 'security').score, 0); assert.ok(fbHas(r, /ยังติดต่อได้/));
  assert.strictEqual(rub(r, 'report').score, 0);
  assert.strictEqual(rub(r, 'fault').score, 0);
});
it('t9: common mistakes give targeted feedback (wrong gateway, weak key, lab and office on one switch, VLSM misaligned)', () => {
  let t = capSol(); dev(t, 'pc4').gateway = '172.16.10.1';
  let r = g.grade('t9', capPayload(t));
  assert.ok(rub(r, 'gwdns').score < 4); assert.ok(fbHas(r, /T-PC2/)); assert.ok(rub(r, 'matrix').score < 6);
  t = capSol(); dev(t, 'ap1').passphrase = '12345678'; dev(t, 'laptop1').wifiKey = '12345678';
  r = g.grade('t9', capPayload(t));
  assert.strictEqual(rub(r, 'wifi').score, 3.5); assert.ok(fbHas(r, /เดาง่าย/));
  t = capSol(); t.links.push(L('l99', 'sw1', 'p20', 'sw3', 'p20'));
  r = g.grade('t9', capPayload(t));
  assert.ok(rub(r, 'cabling').score < 4); assert.ok(fbHas(r, /Broadcast domain/));
  r = g.grade('t9', capPayload(capSol(), { plan: Object.assign({}, PLAN, { office: { net: '172.16.10.100', prefix: 28, gateway: '172.16.10.97' } }) }));
  assert.ok(fbHas(r, /ไม่ใช่ Network address/));
  t = capSol(); dev(t, 'laptop1').wifiKey = 'nope';
  r = g.grade('t9', capPayload(t));
  assert.ok(rub(r, 'wifi').score < 4); assert.ok(rub(r, 'matrix').score < 6);
});
it('t9: report needs the four sections with content and test evidence', () => {
  const noTests = REPORT.replace(/3\) ผลการทดสอบ\n[^\n]+/, '3) ผลการทดสอบ\nทำแล้วผ่านทั้งหมดดีมากครับผมทดสอบแล้วไม่มีปัญหาอะไรเลยใช้ได้ทุกห้องเรียบร้อย');
  let r = g.grade('t9', capPayload(capSol(), { report: noTests }));
  assert.strictEqual(rub(r, 'report').score, 1.5); assert.ok(fbHas(r, /หลักฐาน/));
  r = g.grade('t9', capPayload(capSol(), { report: 'สร้างเครือข่ายเสร็จแล้ว' }));
  assert.strictEqual(rub(r, 'report').score, 0);
});
it('t9: bad payloads never throw and score 0 with max 40', () => {
  [null, 5, {}, { topo: 3 }, { topo: { devices: [], links: [] } }, { topo: { devices: [{}], links: [{}] }, plan: 'x', fault: 'y', report: 7 },
    { topo: capSol(), plan: { lab: { net: { a: 1 } } }, fault: { baseline: { devices: 'no' } } }].forEach((p) => {
    const r = g.grade('t9', p);
    assert.strictEqual(r.max, 40); assert.ok(r.score >= 0 && r.score < 30); assert.ok(Array.isArray(r.feedback));
  });
  const big = capSol(); for (let i = 0; i < 60; i++) big.devices.push({ id: 'x' + i, type: 'pc' });
  assert.strictEqual(g.grade('t9', { topo: big }).score, 0);
});
it('2.8 fields survive sanitising (power off, hub, filters, Wi-Fi key)', () => {
  const t = capSol(); dev(t, 'sw1').power = false;
  const r = g.grade('t9', capPayload(t));
  assert.ok(rub(r, 'matrix').score < 6); assert.ok(fbHas(r, /ปิด/));
  const st = g._lib.sanitize({ topo: { devices: [{ id: 'h', type: 'hub', power: false, filters: [{ action: 'deny', src: 'any', dst: 'any' }] }], links: [] } }).topo.devices[0];
  assert.strictEqual(st.power, false); assert.strictEqual(st.filters.length, 1);
  // t1 with a hub instead of a switch still grades (a hub is a switch for t1–t8 counting, as before 2.8)
  const t1 = solT1(); dev(t1, 'sw1').type = 'hub';
  assert.strictEqual(g.grade('t1', { topo: t1 }).score, 10);
});

// ---------------------------------------------------------------- 3.1 NAT/PAT + ACL missions t10–t13
const rt = (t) => dev(t, 'r1');
function solT10() { const t = start('t10'); rt(t).ifaces[0].nat = 'inside'; rt(t).ifaces[1].nat = 'outside'; rt(t).nat = { pat: { iface: 'g0/1', src: '192.168.1.0/24' } }; return t; }
function solT11() {
  const t = start('t11'); rt(t).ifaces[0].nat = 'inside'; rt(t).ifaces[1].nat = 'outside';
  rt(t).nat = { pat: { iface: 'g0/1', src: '192.168.1.0 0.0.0.255' }, statics: [{ proto: 'tcp', local: '192.168.1.10', lport: '443', global: '198.51.100.2', gport: '443' }, { proto: 'tcp', local: '192.168.1.10', lport: '80', global: '198.51.100.2', gport: '80' }] };
  dev(t, 'srv1').gateway = '192.168.1.1';
  return t;
}
const T12_RULES = () => [
  { action: 'permit', proto: 'tcp', src: '192.168.10.0 0.0.0.255', dst: 'host 192.168.30.10', port: '80' },
  { action: 'permit', proto: 'tcp', src: '192.168.10.0 0.0.0.255', dst: 'host 192.168.30.10', port: '443' },
  { action: 'permit', proto: 'udp', src: '192.168.10.0 0.0.0.255', dst: 'host 192.168.30.53', port: '53' }];
function solT12(rules, dir) { const t = start('t12'); rt(t).acls = [{ name: 'STUDENT-IN', iface: 'g0/0', dir: dir || 'in', rules: rules || T12_RULES() }]; return t; }
function solT13() {
  const t = start('t13'); const r = rt(t);
  r.ifaces[0].nat = 'inside'; r.ifaces[2].nat = 'outside';
  const a = r.acls[0]; a.dir = 'in';
  const deny = a.rules.shift(); a.rules.splice(3, 0, deny);         // broad deny after the specific permits
  a.rules[2].src = '192.168.10.0 0.0.0.255';                       // wildcard, not subnet mask
  return t;
}
const NAT_SOL = { t10: solT10, t11: solT11, t12: () => solT12(), t13: solT13 };

it('3.1: missions t10–t13 are appended after t9 (no renumbering), public fields only, max 10', () => {
  assert.deepStrictEqual(g.missions.slice(0, 13).map((m) => m.id), ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 't13']);
  ['t10', 't11', 't12', 't13'].forEach((id) => {
    const m = g.missions.find((x) => x.id === id);
    assert.strictEqual(m.max, 10); assert.ok(m.hints.length >= 3 && /[ก-๙]/.test(m.desc));
    assert.strictEqual(m.level, id === 't13' ? 'hard' : 'medium');
  });
  assert.ok(start('t11').devices.some((d) => d.id === 'opc1' && d.locked) && start('t10').devices.some((d) => d.type === 'internet' && d.requireNat === true));
});
for (const id of Object.keys(NAT_SOL)) {
  it(`${id}: correct configuration scores 10/10 (engine re-runs the test matrix)`, () => {
    const r = g.grade(id, { topo: NAT_SOL[id]() });
    assert.strictEqual(r.score, 10, show(r)); assert.ok(r.ok);
    assert.ok(r.details.checks.every((c) => c.ok)); assert.ok(r.details.matrix.length >= 3 && r.details.matrix.every((c) => c.pass));
  });
}
it('t3 and t9 keep their full score next to the new missions', () => {
  assert.strictEqual(g.grade('t3', { topo: solT3() }).score, 10);
  assert.strictEqual(g.grade('t9', capPayload(capSol())).score, 40);
});
it('t10: swapped inside/outside, an unnecessary static NAT, a too-narrow PAT network give partial credit with Thai reasons', () => {
  let t = solT10(); rt(t).ifaces[0].nat = 'outside'; rt(t).ifaces[1].nat = 'inside';
  let r = g.grade('t10', { topo: t });
  assert.ok(r.score > 0 && r.score < 5, show(r)); assert.ok(fbHas(r, /inside|outside/)); assert.ok(fbHas(r, /ISP ทิ้งแพ็กเก็ต.*สลับกัน/), show(r));
  t = solT10(); rt(t).nat.statics = [{ proto: 'tcp', local: '192.168.1.11', lport: '3389', global: '198.51.100.2', gport: '3389' }];
  r = g.grade('t10', { topo: t });
  assert.strictEqual(r.score, 9, show(r)); assert.ok(fbHas(r, /Static NAT.*ไม่จำเป็น/));
  t = solT10(); rt(t).nat.pat.src = '192.168.1.0/30';      // covers .1–.3 only (no PC)
  r = g.grade('t10', { topo: t });
  assert.ok(r.score < 6, show(r)); assert.ok(fbHas(r, /ไม่ครอบคลุม/));
});
it('t11: 1:1 static NAT exposes RDP/SSH, missing server gateway, no port forward at all', () => {
  let t = solT11(); rt(t).nat.statics = [{ proto: 'ip', local: '192.168.1.10', global: '198.51.100.2' }];
  let r = g.grade('t11', { topo: t });
  assert.ok(r.score >= 5 && r.score < 10, show(r)); assert.ok(!check(r, /พอร์ตอื่น/).ok); assert.ok(fbHas(r, /3389/)); assert.ok(fbHas(r, /Least privilege/));
  t = solT11(); dev(t, 'srv1').gateway = '';
  r = g.grade('t11', { topo: t });
  assert.ok(r.score < 7, show(r)); assert.ok(fbHas(r, /Default Gateway/)); assert.strictEqual(check(r, /3389/).score, 0);
  t = solT11(); delete rt(t).nat.statics;
  r = g.grade('t11', { topo: t });
  assert.strictEqual(check(r, /ออกอินเทอร์เน็ต/).ok, true); assert.ok(r.score <= 3, show(r)); assert.ok(fbHas(r, /ปฏิเสธ|Port forwarding/));
});
it('t12: wrong rule order, outbound direction, subnet mask as wildcard, deny-everything — partial with the matched rule named', () => {
  let r = g.grade('t12', { topo: solT12([{ action: 'deny', proto: 'ip', src: '192.168.10.0/24', dst: '192.168.30.0/24' }].concat(T12_RULES())) });
  assert.ok(r.score >= 5 && r.score < 10, show(r)); assert.ok(fbHas(r, /ข้อที่ 1/)); assert.strictEqual(check(r, /ใช้เว็บและ DNS/).score, 0);
  r = g.grade('t12', { topo: solT12(null, 'out') });
  assert.ok(r.score < 8, show(r)); assert.ok(fbHas(r, /ตอบกลับ|ขาออก/));
  const bad = T12_RULES(); bad.forEach((x) => { x.src = '192.168.10.0 255.255.255.0'; });
  r = g.grade('t12', { topo: solT12(bad) });
  assert.ok(r.score < 10, show(r)); assert.strictEqual(check(r, /ใช้เว็บและ DNS/).score, 0);
  r = g.grade('t12', { topo: solT12([{ action: 'deny', proto: 'ip', src: 'any', dst: 'any' }]) });
  assert.ok(r.score > 0 && r.score < 8, show(r)); assert.ok(fbHas(r, /implicit deny|ข้อที่ 1/));
  // a matrix entry carries the deciding ACL rule
  r = g.grade('t12', { topo: solT12() });
  assert.ok(r.details.matrix.find((c) => c.id === 's-ssh').tests[0].acl.includes('implicit deny'));
});
it('t13: the broken start, partial repairs and the "permit ip any any" shortcut (penalised)', () => {
  let r = g.grade('t13', { topo: start('t13') });
  assert.ok(r.score <= 1, show(r)); assert.ok(fbHas(r, /ISP ทิ้งแพ็กเก็ต/));
  let t = start('t13'); rt(t).ifaces[0].nat = 'inside'; rt(t).ifaces[2].nat = 'outside';     // NAT fixed, ACL still broken
  r = g.grade('t13', { topo: t });
  assert.ok(r.score > 1 && r.score < 7, show(r)); assert.ok(fbHas(r, /ACL/));
  t = solT13(); rt(t).acls[0].rules.unshift({ action: 'permit', proto: 'ip', src: 'any', dst: 'any' });
  r = g.grade('t13', { topo: t });
  assert.ok(r.score <= 5, show(r)); assert.ok(fbHas(r, /หักคะแนน.*permit ip any any/)); assert.ok(r.details.checks.some((c) => c.score < 0));
  t = solT13(); delete rt(t).acls;                                                          // deleting the ACL is not a fix
  r = g.grade('t13', { topo: t });
  assert.ok(r.score <= 7, show(r)); assert.ok(fbHas(r, /ลบ/));
});
it('3.1 grader: tampering with the ISP / outside host does not help; bad or oversized payloads score 0 without throwing', () => {
  let t = start('t10'); const isp = dev(t, 'net1'); delete isp.requireNat; isp.hosts = { '192.168.1.11': 'x' };
  let r = g.grade('t10', { topo: t });
  assert.ok(r.score < 2, show(r));
  t = solT11(); const o = dev(t, 'opc1'); o.ifaces[0].ip = '192.168.1.99'; o.gateway = '192.168.1.1';
  t.links.find((l) => l.id === 'lo1').b = { dev: 'sw1', port: 'p9' };
  assert.strictEqual(g.grade('t11', { topo: t }).score, 10);
  [null, 5, {}, { topo: 3 }, { topo: { devices: [], links: [] } }, { topo: { devices: [{}], links: [{}] } },
    { topo: { devices: [{ id: 'r1', type: 'router', nat: 'x', acls: { a: 1 } }], links: [] } },
    { topo: { devices: [{ id: 'r1', type: 'router', acls: [{ rules: [{ action: { x: 1 } }] }], nat: { pat: 7, statics: [null, 'x', { proto: 9 }] } }], links: 'no' } }].forEach((p) => {
    ['t10', 't11', 't12', 't13'].forEach((id) => {
      const x = g.grade(id, p);
      assert.strictEqual(x.max, 10); assert.ok(x.score >= 0 && x.score < 10, id); assert.ok(Array.isArray(x.feedback));
    });
  });
  const big = solT12(); for (let i = 0; i < 70; i++) big.devices.push({ id: 'x' + i, type: 'pc' });
  assert.strictEqual(g.grade('t12', { topo: big }).score, 0);
  const huge = solT12(); rt(huge).acls[0].rules[0].src = 'x'.repeat(300000);
  assert.strictEqual(g.grade('t12', { topo: huge }).score, 0);
});
it('3.1 fields survive sanitising (interface NAT role, PAT, statics, ACL rules with ports, ssh/rdp services)', () => {
  const st = g._lib.sanitize({ topo: solT11() }).topo;
  const r = st.devices.find((d) => d.id === 'r1');
  assert.strictEqual(r.ifaces[0].nat, 'inside'); assert.strictEqual(r.nat.pat.iface, 'g0/1'); assert.strictEqual(r.nat.statics.length, 2);
  assert.deepStrictEqual(st.devices.find((d) => d.id === 'srv1').services, { web: true, ssh: true, rdp: true });
  const a = g._lib.sanitize({ topo: solT12() }).topo.devices.find((d) => d.id === 'r1').acls[0];
  assert.strictEqual(a.dir, 'in'); assert.strictEqual(a.rules[1].port, '443');
});

// ---------------------------------------------------------------- Phase 4: t14–t19 (w1–w3 practice)
console.log('Phase 4: t14–t19');
const NEW_IDS = ['t14', 't15', 't16', 't17', 't18', 't19'];
const sw = (id, name, extra) => Object.assign({ id, type: 'switch', name, x: 0, y: 0, ports: 24 }, extra || {});
const rtr = (id, name, ifs, routes) => Object.assign(router(id, ifs, routes), { name });
function solT14() {
  const t = start('t14');
  Object.assign(dev(t, 'srv1'), { ifaces: [{ name: 'eth0', ip: '192.168.1.5', prefix: 24 }], services: { file: true } });
  t.links.push(L('l1', 'srv1', 'eth0', 'sw1', 'p1'));
  for (let i = 1; i <= 3; i++) { t.devices.push(host('pc', 'pc' + i, 'PC' + i, '192.168.1.1' + i)); t.links.push(L('l' + (i + 1), 'pc' + i, 'eth0', 'sw1', 'p' + (i + 1))); }
  return t;
}
function solT15() {
  const t = start('t15');
  t.devices.push(rtr('rA', 'R-BKK', [['192.168.10.1', 24], ['10.0.0.1', 30]], [{ net: '192.168.20.0', prefix: 24, via: '10.0.0.2' }]));
  t.devices.push(rtr('rB', 'R-CNX', [['192.168.20.1', 24], ['10.0.0.2', 30]], [{ net: '192.168.10.0', prefix: 24, via: '10.0.0.1' }]));
  t.links.push(L('l5', 'rA', 'g0/0', 'swA', 'p3'), L('l6', 'rB', 'g0/0', 'swB', 'p3'), L('l7', 'rA', 'g0/1', 'rB', 'g0/1', 'fiber'));
  ['pcA1', 'pcA2'].forEach((id) => { dev(t, id).gateway = '192.168.10.1'; });
  ['pcB1', 'pcB2'].forEach((id) => { dev(t, id).gateway = '192.168.20.1'; });
  return t;
}
const T15_ANS = { q1: 1, q2: 3 };
function solT16() {
  const t = start('t16');
  t.devices = t.devices.filter((d) => d.id !== 'hub1');
  t.devices.push(sw('sw1', 'Switch1'));
  t.links = ['pc1', 'pc2', 'pc3', 'pc4'].map((id, i) => L('n' + i, id, 'eth0', 'sw1', 'p' + (i + 1)));
  return t;
}
const T16_ANS = { q1: 1, q2: 2, q3: 0 };
function solT17() {
  const t = start('t17');
  t.devices.push(sw('swA', 'SW-ACC'), sw('swS', 'SW-SALES'), { id: 'ap1', type: 'ap', name: 'AP-SALES', x: 0, y: 0, ssid: 'SALES', security: 'WPA2', ports: 1 },
    rtr('r1', 'Router1', [['192.168.10.1', 24], ['192.168.20.1', 24]]));
  ['lt1', 'lt2'].forEach((id) => { dev(t, id).ssid = 'SALES'; });
  t.links.push(L('a1', 'pcA1', 'eth0', 'swA', 'p1'), L('a2', 'pcA2', 'eth0', 'swA', 'p2'), L('a3', 'prn1', 'eth0', 'swA', 'p3'),
    L('s1', 'pcS1', 'eth0', 'swS', 'p1'), L('s2', 'ap1', 'eth0', 'swS', 'p2'), L('w1', 'lt1', 'wlan0', 'ap1', 'wifi', 'wifi'), L('w2', 'lt2', 'wlan0', 'ap1', 'wifi', 'wifi'),
    L('r1', 'r1', 'g0/0', 'swA', 'p4'), L('r2', 'r1', 'g0/1', 'swS', 'p3'));
  return t;
}
function solT18() {
  const t = start('t18');
  const l = (id) => t.links.find((x) => x.id === id);
  l('l2').medium = 'fiber';
  l('l5').b = { dev: 'swA', port: 'p5' };
  l('l7').b = { dev: 'swB', port: 'p3' };
  return t;
}
function solT19() {
  const t = start('t19');
  const set = (id, ip, p, gw) => { const d = dev(t, id); d.ifaces[0].ip = ip; d.ifaces[0].prefix = p; d.gateway = gw; };
  const r = dev(t, 'r1');
  r.ifaces[0].ip = '10.0.0.1'; r.ifaces[0].prefix = 8; r.ifaces[1].ip = '172.16.0.1'; r.ifaces[1].prefix = '255.255.0.0'; r.ifaces[2].ip = '192.168.1.1'; r.ifaces[2].prefix = 24;
  set('pcA1', '10.0.0.10', 8, '10.0.0.1'); set('pcA2', '10.0.0.11', '255.0.0.0', '10.0.0.1');
  set('pcB1', '172.16.0.10', 16, '172.16.0.1'); set('pcB2', '172.16.1.20', 16, '172.16.0.1');
  set('pcC1', '192.168.1.10', 24, '192.168.1.1'); set('prnC1', '192.168.1.50', 24, '192.168.1.1');
  return t;
}
const NEW_SOL = { t14: () => ({ topo: solT14() }), t15: () => ({ topo: solT15(), answers: T15_ANS }), t16: () => ({ topo: solT16(), answers: T16_ANS }),
  t17: () => ({ topo: solT17() }), t18: () => ({ topo: solT18() }), t19: () => ({ topo: solT19() }) };

it('Phase 4: t14–t19 are appended after t13 with week, mode, Thai text, hints and max 10', () => {
  assert.deepStrictEqual(g.missions.map((m) => m.id), ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 't13'].concat(NEW_IDS));
  const want = { t14: [1, 'guided', 'easy'], t15: [1, 'independent', 'medium'], t16: [2, 'guided', 'easy'], t17: [2, 'independent', 'medium'], t18: [2, 'trouble', 'medium'], t19: [3, 'independent', 'medium'] };
  NEW_IDS.forEach((id) => {
    const m = g.missions.find((x) => x.id === id);
    assert.deepStrictEqual([m.week, m.mode, m.level], want[id], id);
    assert.strictEqual(m.max, 10); assert.ok(/[ก-๙]/.test(m.title) && /[ก-๙]/.test(m.desc) && m.hints.length >= 4, id);
  });
  ['t14', 't16'].forEach((id) => assert.ok(g.missions.find((x) => x.id === id).hints.every((h, i) => h.startsWith(`ขั้นที่ ${i + 1}:`)), id + ' step hints'));
  g.missions.slice(0, 13).forEach((m) => assert.ok(m.week === undefined && m.mode === undefined, m.id + ' untouched'));
});
for (const id of NEW_IDS) {
  it(`${id}: correct solution scores 10/10 (checks run in the engine on the server)`, () => {
    const r = g.grade(id, NEW_SOL[id]());
    assert.strictEqual(r.score, 10, show(r));
    assert.ok(r.ok && r.details.checks.every((c) => c.ok));
  });
}
it('Phase 4: no answer in the public data (start, quiz, hints) and the untouched start fails', () => {
  NEW_IDS.forEach((id) => {
    const m = g.missions.find((x) => x.id === id);
    const pub = JSON.stringify({ start: m.start, desc: m.desc, hints: m.hints });
    assert.ok(!/correct|answer|QUIZ_KEY/i.test(pub), id);
    (m.start.quiz || []).forEach((q) => assert.deepStrictEqual(Object.keys(q).sort(), ['id', 'options', 'q'], id + ' quiz keys'));
    assert.ok(g.grade(id, { topo: clone(m.start) }).score <= 3, id);
  });
  const t14 = start('t14'); assert.ok(!dev(t14, 'srv1').services.file && !dev(t14, 'srv1').ifaces[0].ip);
  assert.ok(!start('t19').devices.some((d) => (d.ifaces || []).some((f) => f.ip)), 't19 has no addresses');
  assert.ok(!start('t15').devices.some((d) => d.type === 'router') && !start('t17').devices.some((d) => ['router', 'switch', 'ap', 'hub'].includes(d.type)));
});
it('t14: fails without the file service, with a daisy chain instead of a star, or with a hub as centre', () => {
  let t = solT14(); dev(t, 'srv1').services = {};
  let r = g.grade('t14', { topo: t });
  assert.strictEqual(check(r, /SMB/).score, 0, show(r)); assert.ok(check(r, /Static และเปิดบริการ/).score < 1.5);
  t = solT14(); t.links = t.links.filter((l) => l.a.dev !== 'pc3'); t.links.push(L('d1', 'pc3', 'eth0', 'pc2', 'eth1'));
  r = g.grade('t14', { topo: t });
  assert.ok(check(r, /Star/).score < 2 && r.score < 10, show(r));
  t = solT14(); dev(t, 'sw1').type = 'hub';
  r = g.grade('t14', { topo: t });
  assert.ok(check(r, /มี Switch เป็นศูนย์กลาง/).score < 1.5 && check(r, /Star/).score === 0 && fbHas(r, /Hub/), show(r));
  t = solT14(); t.devices = t.devices.filter((d) => d.id !== 'pc3'); t.links = t.links.filter((l) => l.a.dev !== 'pc3');
  r = g.grade('t14', { topo: t });
  assert.ok(r.score < 10 && fbHas(r, /PC อย่างน้อย 3/), show(r));
});
it('t15: switch-to-switch, one router for both sites, UTP WAN, missing routes and wrong quiz lose points', () => {
  let t = start('t15'); t.links.push(L('x', 'swA', 'p9', 'swB', 'p9'));
  let r = g.grade('t15', { topo: t, answers: T15_ANS });
  assert.strictEqual(check(r, /Router ของตัวเอง/).score, 0); assert.ok(fbHas(r, /วงสายเดียวกัน/), show(r));
  t = start('t15'); t.devices.push(rtr('r1', 'R-ONE', [['192.168.10.1', 24], ['192.168.20.1', 24]]));
  t.links.push(L('a', 'r1', 'g0/0', 'swA', 'p3'), L('b', 'r1', 'g0/1', 'swB', 'p3'));
  ['pcA1', 'pcA2'].forEach((id) => { dev(t, id).gateway = '192.168.10.1'; }); ['pcB1', 'pcB2'].forEach((id) => { dev(t, id).gateway = '192.168.20.1'; });
  r = g.grade('t15', { topo: t, answers: T15_ANS });
  assert.ok(r.score < 10 && check(r, /ลิงก์ WAN/).score === 0 && fbHas(r, /ประจำสาขา/), show(r));
  t = solT15(); t.links.find((l) => l.id === 'l7').medium = 'utp';
  r = g.grade('t15', { topo: t, answers: T15_ANS });
  assert.strictEqual(check(r, /ลิงก์ WAN/).score, 1); assert.ok(fbHas(r, /100 เมตร/));
  t = solT15(); dev(t, 'rB').routes = [];
  r = g.grade('t15', { topo: t, answers: T15_ANS });
  assert.strictEqual(check(r, /เส้นทาง/).score, 0.5); assert.strictEqual(check(r, /ping ข้ามสาขา/).score, 0, show(r));
  r = g.grade('t15', { topo: solT15(), answers: { q1: 2, q2: 2 } });
  assert.strictEqual(r.score, 9); assert.ok(!fbHas(r, /LAN คือ|WAN คือ/), 'feedback does not give the key');
  r = g.grade('t15', { topo: solT15() });
  assert.strictEqual(check(r, /LAN และส่วนใดเป็น WAN/).score, 0); assert.ok(fbHas(r, /ยังไม่ได้ตอบ/));
  t = solT15(); dev(t, 'rA').routes = [{ net: '0.0.0.0', prefix: 0, via: '10.0.0.2' }];
  assert.strictEqual(g.grade('t15', { topo: t, answers: T15_ANS }).score, 10, 'a default route to the other branch is also valid');
});
it('t16: a hub left in place, a switch behind the hub, and wrong observations lose points', () => {
  let r = g.grade('t16', { topo: start('t16'), answers: T16_ANS });
  assert.strictEqual(check(r, /ถอด Hub/).score, 0); assert.strictEqual(check(r, /Collision/).score, 0); assert.strictEqual(check(r, /ping/).score, 2);
  let t = solT16(); t.devices.push({ id: 'hub1', type: 'hub', name: 'Hub1', x: 0, y: 0, ports: 8 });
  r = g.grade('t16', { topo: t, answers: T16_ANS });
  assert.strictEqual(check(r, /ถอด Hub/).score, 1); assert.strictEqual(r.score, 9);
  t = start('t16'); t.devices.push(sw('sw1', 'Switch1')); t.links.push(L('u', 'hub1', 'p8', 'sw1', 'p1'));
  r = g.grade('t16', { topo: t, answers: T16_ANS });
  assert.ok(check(r, /ต่อสายเข้า Switch/).score === 0 && check(r, /Collision/).score === 0, show(r));
  r = g.grade('t16', { topo: solT16(), answers: { q1: 0, q2: 0, q3: 1 } });
  assert.strictEqual(check(r, /คำถาม/).score, 0); assert.strictEqual(r.score, 8.5);
  r = g.grade('t16', { topo: solT16(), answers: { q1: 1, q2: 2, q3: 3 } });
  assert.strictEqual(check(r, /คำถาม/).score, 1);
});
it('t17: hub as centre, switch-to-switch instead of a router, AP on the wrong LAN lose points', () => {
  let t = solT17(); dev(t, 'swA').type = 'hub';
  let r = g.grade('t17', { topo: t });
  assert.strictEqual(check(r, /Switch เป็นศูนย์กลาง/).score, 0.5); assert.ok(fbHas(r, /Hub/), show(r));
  t = solT17(); t.devices = t.devices.filter((d) => d.id !== 'r1'); t.links = t.links.filter((l) => l.a.dev !== 'r1'); t.links.push(L('x', 'swA', 'p9', 'swS', 'p9'));
  r = g.grade('t17', { topo: t });
  assert.strictEqual(check(r, /Broadcast domain/).score, 0); assert.ok(fbHas(r, /Switch ไม่ส่งข้ามวง/)); assert.ok(check(r, /ping/).score < 2.5, show(r));
  t = solT17(); t.links.find((l) => l.id === 's2').b = { dev: 'swA', port: 'p9' };
  r = g.grade('t17', { topo: t });
  assert.strictEqual(check(r, /Access Point/).score, 1); assert.ok(fbHas(r, /LAN ฝ่ายขาย/), show(r));
  t = solT17(); dev(t, 'lt2').ssid = 'OTHER';
  r = g.grade('t17', { topo: t });
  assert.ok(check(r, /Access Point/).score < 2 && r.score < 10, show(r));
});
it('t18: each of the three faults is found separately; changing IPs instead of cables is not accepted', () => {
  const fix = (f) => { const t = solT18(); f(t); return g.grade('t18', { topo: t }); };
  let r = fix((t) => { t.links.find((l) => l.id === 'l2').medium = 'utp'; });
  assert.strictEqual(check(r, /ไฟเบอร์/).score, 0); assert.strictEqual(r.score, 7.5); assert.ok(fbHas(r, /100 เมตร/));
  r = fix((t) => { t.links.find((l) => l.id === 'l7').b = { dev: 'swA', port: 'p4' }; });
  assert.strictEqual(check(r, /อาคาร 2 ต่อเข้า/).score, 1); assert.ok(check(r, /ping/).score < 2.5, show(r));
  r = fix((t) => { t.links.find((l) => l.id === 'l5').b = { dev: 'r1', port: 'g0/2' }; });
  assert.strictEqual(check(r, /Printer-Office/).score, 0); assert.ok(fbHas(r, /g0\/2/));
  // "fix" PC-Workshop2 by moving it into the office network instead of moving its cable
  r = fix((t) => { t.links.find((l) => l.id === 'l7').b = { dev: 'swA', port: 'p4' }; const d = dev(t, 'pcW2'); d.ifaces[0].ip = '192.168.10.99'; d.gateway = '192.168.10.1'; });
  assert.ok(r.score < 10 && fbHas(r, /วงเดิม/), show(r));
  // a new switch in building 1 between the router and SW-Workshop: the long run is still the SW-Workshop link
  r = fix((t) => { t.devices.push(sw('swX', 'SW-X')); t.links.find((l) => l.id === 'l2').b = { dev: 'swX', port: 'p1' }; t.links.push(L('x', 'swX', 'p2', 'swB', 'p9', 'utp')); });
  assert.strictEqual(check(r, /ไฟเบอร์/).score, 0, show(r));
  r = fix((t) => { t.devices = t.devices.filter((d) => d.id !== 'swB'); });
  assert.ok(r.score < 5 && fbHas(r, /SW-Workshop/), show(r));
});
it('t19: classless masks, wrong network, network/broadcast address and a missing router leg lose points', () => {
  const mod = (f) => { const t = solT19(); f(t); return g.grade('t19', { topo: t }); };
  let r = mod((t) => { dev(t, 'pcA1').ifaces[0].prefix = 24; dev(t, 'pcA2').ifaces[0].prefix = 24; dev(t, 'r1').ifaces[0].prefix = 24; });
  assert.ok(check(r, /Default mask/).score < 3 && fbHas(r, /Class A ซึ่ง Default mask คือ 255\.0\.0\.0/), show(r));
  assert.strictEqual(check(r, /ping/).score, 3, 'still works, but the mask is not the classful default');
  r = mod((t) => { dev(t, 'pcB2').ifaces[0].ip = '172.17.0.20'; });
  assert.ok(check(r, /เครือข่ายที่กำหนด/).score < 2 && fbHas(r, /172\.16\.0\.0/), show(r));
  r = mod((t) => { dev(t, 'pcB2').ifaces[0].ip = '172.16.255.255'; });
  assert.ok(check(r, /เครือข่ายที่กำหนด/).score < 2 && r.score < 10, show(r));
  r = mod((t) => { const f = dev(t, 'r1').ifaces[2]; f.ip = ''; f.prefix = ''; });
  assert.ok(check(r, /Router มีขา/).score < 2 && fbHas(r, /192\.168\.1\.0\/24/), show(r));
});
it('Phase 4 tamper: client results, extra fields, renamed/retyped fixed devices and bad answers are ignored or rejected', () => {
  // fake result fields in the payload change nothing
  let p = NEW_SOL.t18(); p.topo = start('t18'); Object.assign(p, { score: 10, ok: true, details: { checks: [] } });
  assert.ok(g.grade('t18', p).score < 10);
  // building membership is pinned by id: relabelling SW-Office as "SW-Workshop" does not make the UTP run legal
  p = NEW_SOL.t18(); p.topo.links.find((l) => l.id === 'l2').medium = 'utp'; dev(p.topo, 'swA').name = 'SW-Workshop'; dev(p.topo, 'swB').site = 'office'; dev(p.topo, 'swB').name = 'SW-Office';
  assert.strictEqual(check(g.grade('t18', p), /ไฟเบอร์/).score, 0);
  // a switch renamed "Router" is still a switch
  p = NEW_SOL.t17(); dev(p.topo, 'r1').type = 'switch'; dev(p.topo, 'r1').name = 'Router1';
  assert.ok(g.grade('t17', p).score < 10);
  // quiz answers: out of range, wrong type, prototype keys and answers for other missions are ignored
  [{ q1: 9, q2: -1 }, { q1: '1; drop', q2: [3] }, JSON.parse('{"__proto__":{"q1":1},"constructor":1}'), 'q1=1', [1, 3], { q1: 1.5, q2: 3.0000001 }].forEach((a) => {
    const r = g.grade('t15', { topo: solT15(), answers: a });
    assert.strictEqual(check(r, /LAN และส่วนใดเป็น WAN/).score, 0, JSON.stringify(a));
  });
  assert.strictEqual(check(g.grade('t15', { topo: solT15(), answers: { q1: '1', q2: '3' } }), /LAN และส่วนใดเป็น WAN/).score, 1, 'numeric strings from a form are accepted');
  assert.strictEqual(g.grade('t14', { topo: solT14(), answers: T16_ANS }).score, 10, 'answers are not needed and cannot hurt where there is no quiz');
  // garbage payloads never throw and never pass
  [null, 5, {}, { topo: 3 }, { topo: { devices: [], links: [] } }, { topo: { devices: [{}], links: [{}] }, answers: 7 }].forEach((x) => NEW_IDS.forEach((id) => {
    const r = g.grade(id, x);
    assert.ok(r.max === 10 && r.score >= 0 && r.score < 10 && Array.isArray(r.feedback), id);
  }));
});
it('Phase 4: old missions t1–t13 give the same scores as before for their reference solutions and starts', () => {
  Object.keys(SOL).forEach((id) => assert.strictEqual(g.grade(id, { topo: SOL[id](), answers: { q1: 1 } }).score, 10, id));
  assert.strictEqual(g.grade('t1', { topo: start('t1') }).score, 0);
  assert.strictEqual(g.grade('t3', { topo: start('t3') }).score, g.grade('t3', { topo: start('t3'), answers: T15_ANS }).score);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
