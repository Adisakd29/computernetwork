// Tests for the Network Troubleshooting Lab grader: node tests/sims/troubleshoot.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const g = require('../../server/sims/troubleshoot.js');
const NetSim = require(path.join(__dirname, '../../public/js/sim/netsim.js'));

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', (e && e.stack || String(e)).split('\n').slice(0, 6).join('\n      ')); }
}
const clone = x => JSON.parse(JSON.stringify(x));
const M = id => g.missions.find(m => m.id === id);
const topo = id => clone(M(id).start.topo);
const dev = (t, id) => t.devices.find(d => d.id === id);
const lnk = (t, id) => t.links.find(l => l.id === id);
const CAUSE = id => g._scenarios[id].cause; // server-only key
const fbHas = (r, re) => r.feedback.some(f => re.test(f));

// the intended fix for every scenario (independent from the grader's fault checks)
const FIX = {
  x1: t => { lnk(t, 'l1').up = true; },
  x2: t => { dev(t, 'nb4').ssid = 'NETLAB-LIB'; },
  x3: t => { dev(t, 'pc21').gateway = '192.168.3.1'; },
  x4: t => { dev(t, 't05').ifaces[0].prefix = 24; },
  x5: t => { dev(t, 'pc15').dns = ['192.168.3.5']; },
  x6: t => { dev(t, 'srv').firewall = { icmp: true }; },
  x7: t => { dev(t, 'dhcp').ifaces[0].up = true; },
  x8: t => { dev(t, 'pc12').ifaces[0].ip = '192.168.1.112'; dev(t, 'r1').routes.push({ net: '192.168.20.0', prefix: 24, via: '10.0.0.2' }); }
};
const fixed = id => { const t = topo(id); FIX[id](t); return t; };
const pings = (t, list) => { const n = NetSim.create(t); return list.map(([s, d]) => n.ping(s, d)); };

console.log('troubleshoot grader');

it('module shape: 7-8 missions, 5-7 causes, success pings, no server secrets in public data', () => {
  assert.strictEqual(g.id, 'troubleshoot');
  assert.ok(g.missions.length >= 7 && g.missions.length <= 8);
  for (const m of g.missions) {
    assert.strictEqual(m.max, 10);
    assert.ok(m.title && m.desc && m.hints.length && ['easy', 'medium', 'hard'].includes(m.level));
    const st = m.start;
    assert.ok(st.story && st.symptoms.length && st.topo && st.focusHost && st.successPings.length);
    assert.ok(st.causes.length >= 5 && st.causes.length <= 7, m.id);
    assert.ok(st.causes.some(c => c.id === CAUSE(m.id)));
    const pub = JSON.stringify(m);
    assert.ok(!/"allowed"|"faults"|"cause"\s*:/.test(pub), 'no secrets in ' + m.id);
    st.hosts.forEach(h => assert.ok(dev(st.topo, h), h));
  }
  assert.ok(g.missions.some(m => g._scenarios[m.id].faults.length >= 2), 'at least one two-fault scenario');
});

it('every success ping FAILS in the original scenario', () => {
  for (const m of g.missions) {
    const r = pings(topo(m.id), m.start.successPings);
    r.forEach((x, i) => assert.strictEqual(x.ok, false, `${m.id} ping ${m.start.successPings[i].join('->')} should fail originally (${x.reason})`));
  }
});

it('the intended fix makes every success ping pass', () => {
  for (const m of g.missions) {
    const r = pings(fixed(m.id), m.start.successPings);
    r.forEach((x, i) => assert.strictEqual(x.ok, true, `${m.id} ping ${m.start.successPings[i].join('->')} after fix: ${x.reason}`));
  }
});

it('scenarios inject the faults listed in SIM-SPEC §4.5', () => {
  const reason = (id, s, d) => NetSim.create(topo(id)).ping(s, d).reason;
  assert.strictEqual(reason('x1', 'pc7', '192.168.3.5'), 'no_link');
  assert.strictEqual(reason('x2', 'nb4', '192.168.40.5'), 'no_link');
  assert.ok(NetSim.create(topo('x2')).problems().some(p => p.code === 'ssid_mismatch'));
  assert.strictEqual(reason('x3', 'pc21', '8.8.8.8'), 'gateway_unreachable');
  assert.strictEqual(reason('x4', 't05', '192.168.20.10'), 'same_subnet_unreachable');
  assert.strictEqual(reason('x5', 'pc15', 'www.netlab.test'), 'dns_fail');
  assert.strictEqual(reason('x5', 'pc15', '8.8.8.8'), 'ok');
  assert.strictEqual(reason('x6', 'pc8', '192.168.3.5'), 'timeout');
  assert.ok(NetSim.create(topo('x6')).nslookup('pc8', 'srv.lab.local').ok, 'x6: DNS on the server still works');
  assert.strictEqual(NetSim.create(topo('x7')).config('pc1').apipa, true);
  assert.ok(NetSim.create(topo('x8')).problems().some(p => p.code === 'dup_ip'));
  assert.strictEqual(reason('x8', 'pc3', '192.168.20.10'), 'no_route');
});

it('correct cause + intended fix = 10/10 for every mission', () => {
  for (const m of g.missions) {
    const r = g.grade(m.id, { cause: CAUSE(m.id), topo: fixed(m.id) });
    assert.strictEqual(r.score, 10, m.id + ': ' + r.feedback.join(' | '));
    assert.strictEqual(r.ok, true);
  }
});

it('wrong cause loses 4 points with feedback; positions of devices are ignored', () => {
  const t = fixed('x3'); t.devices.forEach(d => { d.x += 13; });
  const r = g.grade('x3', { cause: 'dns', topo: t });
  assert.strictEqual(r.score, 6); assert.ok(fbHas(r, /ยังไม่ใช่สาเหตุหลัก/));
  assert.strictEqual(g.grade('x3', { cause: 'zzz', topo: fixed('x3') }).score, 6);
});

it('no fix / partial fix lose the fix points', () => {
  const r0 = g.grade('x1', { cause: 'cable', topo: topo('x1') });
  assert.strictEqual(r0.score, 4); assert.ok(fbHas(r0, /ยังไม่ได้แก้ไข/));
  // two-fault scenario: only the route fixed
  const t = topo('x8'); dev(t, 'r1').routes.push({ net: '192.168.20.0', prefix: 24, via: '10.0.0.2' });
  const r = g.grade('x8', { cause: 'both', topo: t });
  assert.ok(r.score > 4 && r.score < 10, String(r.score));
  assert.ok(fbHas(r, /IP ของ PC12 ยังซ้ำ/), r.feedback.join('|'));
  // DNS: wrong entry left in the list -> pings pass but fault not fully fixed
  const t5 = topo('x5'); dev(t5, 'pc15').dns = ['192.168.3.5', '192.168.3.50'];
  const r5 = g.grade('x5', { cause: 'dns', topo: t5 });
  assert.strictEqual(r5.score, 7); assert.ok(fbHas(r5, /workaround|ค้างอยู่/));
});

it('workarounds are not accepted (wrong mask "fixed" with /23, static IPs instead of DHCP)', () => {
  const t = topo('x4'); dev(t, 't05').ifaces[0].prefix = 23;
  const r = g.grade('x4', { cause: 'mask', topo: t });
  assert.ok(pings(t, M('x4').start.successPings).every(x => x.ok), '/23 makes the pings pass');
  assert.strictEqual(r.score, 7); assert.ok(fbHas(r, /Subnet mask ของ PC-T05 ยังไม่ตรง/));
  const t7 = topo('x7'); ['pc1', 'pc2', 'pc3'].forEach((id, i) => Object.assign(dev(t7, id), { dhcp: false, gateway: '192.168.4.1', dns: ['8.8.8.8'] }, {}) && Object.assign(dev(t7, id).ifaces[0], { ip: '192.168.4.' + (50 + i), prefix: 24 }));
  const r7 = g.grade('x7', { cause: 'dhcpdown', topo: t7 });
  assert.strictEqual(r7.score, 4); assert.ok(fbHas(r7, /แก้ไขเกินขอบเขต: .*PC4-01/), r7.feedback.join('|'));
  // moving PC21 into another subnet to dodge the gateway problem is out of scope
  const t3 = topo('x3'); Object.assign(dev(t3, 'pc21').ifaces[0], { ip: '10.9.9.9' }); dev(t3, 'pc21').gateway = '192.168.3.1';
  const r3 = g.grade('x3', { cause: 'gw', topo: t3 });
  assert.strictEqual(r3.score, 4); assert.ok(fbHas(r3, /แก้ไขเกินขอบเขต: IP address ของ PC21/));
});

it('out-of-scope / structural edits: "แก้ไขเกินขอบเขต"', () => {
  const a = fixed('x1'); dev(a, 'pc8').gateway = '192.168.3.254';
  let r = g.grade('x1', { cause: 'cable', topo: a });
  assert.strictEqual(r.score, 4); assert.ok(fbHas(r, /แก้ไขเกินขอบเขต: Default gateway ของ PC8/));
  const b = fixed('x1'); b.devices.push({ id: 'pc99', type: 'pc', name: 'PC99' });
  r = g.grade('x1', { cause: 'cable', topo: b }); assert.strictEqual(r.score, 4); assert.ok(fbHas(r, /เพิ่มหรือลบอุปกรณ์/));
  const c = fixed('x1'); c.links.pop();
  r = g.grade('x1', { cause: 'cable', topo: c }); assert.strictEqual(r.score, 4); assert.ok(fbHas(r, /เพิ่มหรือลบสาย/));
  const d = fixed('x1'); lnk(d, 'l1').b.port = 'p9';
  r = g.grade('x1', { cause: 'cable', topo: d }); assert.ok(fbHas(r, /ปลายสาย/));
  const e = fixed('x6'); dev(e, 'srv').services.web = false;
  r = g.grade('x6', { cause: 'fw', topo: e }); assert.strictEqual(r.score, 4); assert.ok(fbHas(r, /ไม่ใช่การตั้งค่าที่แก้ได้/));
  const f = fixed('x8'); dev(f, 'r2').routes = [];
  r = g.grade('x8', { cause: 'both', topo: f }); assert.ok(fbHas(r, /Static route ของ R-BLD2/));
});

it('equivalent value spellings are not counted as changes (mask string, firewall object, ssid absent)', () => {
  const t = fixed('x4'); dev(t, 't01').ifaces[0].prefix = '255.255.255.0'; dev(t, 't01').firewall = { icmp: true }; dev(t, 't01').ssid = '';
  assert.strictEqual(g.grade('x4', { cause: 'mask', topo: t }).score, 10);
});

it('malformed payloads score 0 (or only cause points) and never throw', () => {
  const bad = [null, undefined, 1, 'x', [], {}, { cause: 7 }, { cause: 'cable', topo: 'x' }, { cause: 'cable', topo: { devices: 'a', links: [] } },
    { cause: 'cable', topo: { devices: [null, 1], links: [] } }, { cause: 'cable', topo: { devices: new Array(500).fill({}), links: [] } },
    { cause: 'cable', topo: { devices: [{ id: 'pc7', routes: new Array(100).fill({}) }], links: [] } }];
  for (const p of bad) {
    const r = g.grade('x1', p);
    assert.ok(typeof r.score === 'number' && r.score <= 4 && r.feedback.length, JSON.stringify(p) && String(r.score));
  }
  assert.strictEqual(g.grade('x1', {}).score, 0);
  assert.strictEqual(g.grade('x1', { topo: fixed('x1') }).score, 6);
  assert.strictEqual(g.grade('nope', { cause: 'cable', topo: fixed('x1') }).score, 0);
  const t = fixed('x1'); t.devices[0] = { id: t.devices[0].id, type: 'pc', ifaces: 'zz' };
  assert.doesNotThrow(() => g.grade('x1', { cause: 'cable', topo: t }));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
