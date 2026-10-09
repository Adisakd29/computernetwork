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
  assert.deepStrictEqual(g.missions.map((m) => m.id), ['t1', 't2', 't3', 't4', 't5', 't6', 't7']);
  for (const m of g.missions) {
    assert.strictEqual(m.max, 10);
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
