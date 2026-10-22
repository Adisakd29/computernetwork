// Tests for the Network Troubleshooting Lab grader: node tests/sims/troubleshoot.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const g = require('../../server/sims/troubleshoot.js');
const NetSim = require(path.join(__dirname, '../../public/js/sim/netsim.js'));
const TS = require(path.join(__dirname, '../../public/js/sim/troubleshoot.js'));

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', (e && e.stack || String(e)).split('\n').slice(0, 6).join('\n      ')); }
}
const clone = x => JSON.parse(JSON.stringify(x));
const stable = x => Array.isArray(x) ? '[' + x.map(stable).join(',') + ']' : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}' : JSON.stringify(x);
const M = id => g.missions.find(m => m.id === id);
const LEGACY = g.missions.filter(m => !m.start.mode);
const EVID = g.missions.filter(m => m.start.mode === 'evidence' && !m.start.gen);
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
  x15: t => { lnk(t, 'l3').up = true; },
  x8: t => { dev(t, 'pc12').ifaces[0].ip = '192.168.1.112'; dev(t, 'r1').routes.push({ net: '192.168.20.0', prefix: 24, via: '10.0.0.2' }); }
};
const fixed = id => { const t = topo(id); FIX[id](t); return t; };
const pings = (t, list) => { const n = NetSim.create(t); return list.map(([s, d]) => n.ping(s, d)); };

console.log('troubleshoot grader');

it('module shape: x1-x8 kept, 5-7 causes for legacy missions, success pings, no server secrets in public data', () => {
  assert.strictEqual(g.id, 'troubleshoot');
  assert.deepStrictEqual(LEGACY.map(m => m.id), ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x15']);
  for (const m of LEGACY) {
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
  for (const m of LEGACY) {
    const r = pings(topo(m.id), m.start.successPings);
    r.forEach((x, i) => assert.strictEqual(x.ok, false, `${m.id} ping ${m.start.successPings[i].join('->')} should fail originally (${x.reason})`));
  }
});

it('the intended fix makes every success ping pass', () => {
  for (const m of LEGACY) {
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
  for (const m of LEGACY) {
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

it('3.1 x15 (week 1): Star office, PC3 cable unplugged; only week-1 ideas, no command terminal, full score after plugging in', () => {
  const m = g.missions.find(x => x.id === 'x15'); assert.ok(m, 'x15 exists');
  assert.strictEqual(m.level, 'easy'); assert.strictEqual(m.start.basic, true);
  assert.ok(!/"allowed"|"faults"|"cause"\s*:/.test(JSON.stringify(m)), 'no secrets in x15');
  const words = JSON.stringify([m.title, m.desc, m.start.story, m.start.symptoms, m.hints, m.start.causes]);
  for (const w of ['ipconfig', 'nslookup', 'Gateway', 'gateway', 'DNS', 'DHCP', 'Subnet', 'ping']) assert.ok(!words.includes(w), 'x15 must not need ' + w);
  assert.ok(!m.start.topo.devices.some(d => d.type === 'router'), 'no router in week 1');
  assert.strictEqual(pings(topo('x15'), m.start.successPings)[0].ok, false);
  assert.strictEqual(pings(topo('x15'), [['pc2', '192.168.1.5']])[0].ok, true, 'PC2 works (only PC3 is affected)');
  const f = topo('x15'); lnk(f, 'l3').up = true;
  assert.ok(pings(f, m.start.successPings).every(x => x.ok));
  assert.strictEqual(g.grade('x15', { cause: 'cable', topo: f }).score, 10);
  assert.strictEqual(g.grade('x15', { cause: 'switch', topo: f }).score, 6);
  assert.strictEqual(g.grade('x15', { cause: 'cable', topo: topo('x15') }).score, 4);
  const over = topo('x15'); lnk(over, 'l3').up = true; lnk(over, 'l1').up = false;
  assert.ok(g.grade('x15', { cause: 'cable', topo: over }).score < 10, 'unplugging another cable is outside the fault');
});

it('no fix / partial fix lose the fix points', () => {
  const r0 = g.grade('x1', { cause: 'cable', topo: topo('x1') });
  assert.strictEqual(r0.score, 4); assert.ok(fbHas(r0, /ยังไม่ได้แก้ไข/));
  // two-fault scenario: only the route fixed
  const t = topo('x8'); dev(t, 'r1').routes.push({ net: '192.168.20.0', prefix: 24, via: '10.0.0.2' });
  const r = g.grade('x8', { cause: 'both', topo: t });
  assert.ok(r.score > 4 && r.score < 10, String(r.score));
  // PC12 untouched -> its fault is NOT named (generic hint only, Phase 6 leak fix); a wrong PC12 IP names it
  assert.ok(!fbHas(r, /PC12 ยังซ้ำ|PC12 ต้องอยู่/) && fbHas(r, /ยังมีต้นเหตุที่ยังไม่ได้แก้/), r.feedback.join('|'));
  const t8 = clone(t); dev(t8, 'pc12').ifaces[0].ip = '192.168.1.20';
  assert.ok(fbHas(g.grade('x8', { cause: 'both', topo: t8 }), /IP ของ PC12 ยังซ้ำ/));
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

// ===================================================================== evidence missions (x9 onwards)
const b = (o) => Object.assign({ ph: 'b' }, o);
const a = (o) => Object.assign({ ph: 'a' }, o);
const cmd = (host, c, ph) => ({ k: 'cmd', host, cmd: c, ph: ph || 'b' });
// diagnostic evidence a careful student collects BEFORE changing anything (one action list per mission)
const EV = {
  x9: [cmd('pc1', 'ping 192.168.5.20'), cmd('pc1', 'arp -a'), b({ k: 'inspect', dev: 'prn' }), cmd('pc9', 'ipconfig /all')],
  x10: [cmd('pc1', 'ping 8.8.8.8'), cmd('pc1', 'nslookup www.netlab.test'), cmd('pc2', 'ping 192.168.8.10'), b({ k: 'inspect', dev: 'srv' })],
  x11: [cmd('pc1', 'ping fs.acc.local'), b({ k: 'svc', host: 'pc1', target: 'fs.acc.local', port: 445 }), b({ k: 'inspect', dev: 'fs' })],
  x12: [cmd('b1', 'ping 192.168.20.1'), cmd('b1', 'ping 192.168.20.22'), b({ k: 'inspect', dev: 'r1' })],
  x13: [cmd('p7', 'ping 192.168.30.210'), cmd('p7', 'ping 192.168.30.10'), cmd('p7', 'ipconfig'), cmd('p8', 'ipconfig')]
};
const VERIFY = [a({ k: 'test' })];
const r1if = (t, name) => dev(t, 'r1').ifaces.find(f => f.name === name);
const EFIX = {
  x9: t => { dev(t, 'pc9').ifaces[0].ip = '192.168.5.29'; },
  x10: t => { dev(t, 'srv').services.dns.enabled = true; },
  x11: t => { dev(t, 'fs').firewall.smb = true; },
  x12: t => { r1if(t, 'g0/1').ip = '192.168.20.1'; },
  x13: t => { dev(t, 'p7').ifaces[0].prefix = 24; }
};
const efixed = id => { const t = topo(id); EFIX[id](t); return t; };
const run = (id, t, actions) => g.grade(id, { topo: t, actions });
const checkAll = (t, list) => list.map(c => TS.runCheck(NetSim, t, c).ok);

it('evidence missions: x9-x13 appended, levels varied, no cause list, no secrets in public data', () => {
  assert.deepStrictEqual(EVID.map(m => m.id), ['x9', 'x10', 'x11', 'x12', 'x13']);
  assert.ok(new Set(EVID.map(m => m.level)).size >= 3, 'easy + medium + hard');
  for (const m of EVID) {
    assert.strictEqual(m.max, 10);
    const st = m.start;
    assert.ok(!st.causes && !st.successPings, m.id + ': not multiple choice');
    assert.ok(st.story && st.symptoms.length && st.topo && st.checks.length && st.svcPorts.length && m.hints.length >= 2);
    st.hosts.forEach(h => assert.ok(dev(st.topo, h), h));
    st.checks.forEach(c => { assert.ok(dev(st.topo, c.src), c.src); if (c.kind === 'tcp') assert.ok(TS.SVC[c.port], 'port ' + c.port); });
    const pub = JSON.stringify(m);
    assert.ok(!/"(allowed|faults|keep|evidence|explainFull|cause)"\s*:/.test(pub), 'no secrets in ' + m.id);
    const sc = g._scenarios[m.id];
    assert.strictEqual(sc.evidence.length, 3, m.id);
    assert.ok(sc.explainFull.cause && sc.explainFull.evidence.length && sc.explainFull.fix, m.id);
  }
});

it('evidence missions: at least one check fails originally, every keep check works originally, the fix makes all pass', () => {
  for (const m of EVID) {
    const sc = g._scenarios[m.id];
    assert.ok(checkAll(topo(m.id), sc.checks).some(x => !x), m.id + ' must start broken');
    assert.ok(checkAll(topo(m.id), sc.checks).every(x => !x), m.id + ': every mission check fails before the fix');
    assert.ok(checkAll(topo(m.id), sc.keep).every(Boolean), m.id + ': keep checks work in the original network');
    assert.ok(checkAll(efixed(m.id), sc.checks).every(Boolean), m.id + ': checks pass after the fix');
    assert.ok(checkAll(efixed(m.id), sc.keep).every(Boolean), m.id + ': keep checks still pass after the fix');
  }
});

it('fault types are really injected (dup IP, DNS service down, SMB blocked, router interface IP, narrow mask)', () => {
  const n9 = NetSim.create(topo('x9'));
  assert.ok(n9.problems().some(p => p.code === 'dup_ip' && p.dev === 'pc9'));
  const p9 = n9.ping('pc1', '192.168.5.20'); assert.ok(p9.ok && p9.ttl === 128, 'answered by the Windows PC, not the printer');
  assert.strictEqual(NetSim.create(topo('x10')).nslookup('pc1', 'www.netlab.test').reason, 'dns_fail');
  assert.ok(NetSim.create(topo('x10')).ping('pc1', '192.168.8.10').ok, 'x10: the server itself is up');
  const t11 = TS.tcpTest(NetSim, topo('x11'), 'pc1', 'fs.acc.local', 445);
  assert.ok(t11.pingOk && !t11.tcp && t11.why === 'filtered', JSON.stringify(t11));
  assert.ok(/TcpTestSucceeded\s+: False/.test(TS.tcpLines(t11, 'windows').join('\n')));
  assert.ok(/PingSucceeded\s+: True/.test(TS.tcpLines(t11, 'windows').join('\n')));
  assert.ok(/Connection timed out/.test(TS.tcpLines(t11, 'linux')[0]));
  assert.ok(/succeeded!/.test(TS.tcpLines(TS.tcpTest(NetSim, efixed('x11'), 'pc1', 'fs.acc.local', 445), 'linux')[0]));
  assert.strictEqual(NetSim.create(topo('x12')).ping('b1', '192.168.20.1').reason, 'same_subnet_unreachable');
  assert.ok(NetSim.create(topo('x13')).problems().some(p => p.code === 'gw_not_in_subnet' && p.dev === 'p7'));
  assert.strictEqual(NetSim.create(topo('x13')).ping('p7', '192.168.30.10').reason, 'no_gateway');
  assert.ok(NetSim.create(topo('x13')).ping('p7', '192.168.30.210').ok, 'x13: partial reachability');
});

it('solved with evidence and verification = 10/10 for every evidence mission', () => {
  for (const m of EVID) {
    const r = run(m.id, efixed(m.id), EV[m.id].concat(VERIFY));
    assert.strictEqual(r.score, 10, m.id + ': ' + r.feedback.join(' | '));
    assert.ok(r.ok && r.details.evidence.every(x => x.got) && r.details.verified);
    assert.ok(r.details.explain && r.details.explain.cause && r.details.explain.fix, m.id + ': explanation after submission');
  }
});

it('solved WITHOUT evidence = partial credit (7), and evidence collected after the change does not count', () => {
  for (const m of EVID) {
    const r = run(m.id, efixed(m.id), VERIFY);
    assert.strictEqual(r.score, 7, m.id + ': ' + r.feedback.join(' | '));
    assert.ok(fbHas(r, /ไม่มีหลักฐาน/), m.id);
    const late = EV[m.id].map(x => Object.assign({}, x, { ph: 'a' }));
    assert.strictEqual(run(m.id, efixed(m.id), late.concat(VERIFY)).score, 7, m.id + ': after-fix commands are verification, not diagnosis');
  }
  // no verification at all: 6
  assert.strictEqual(run('x9', efixed('x9'), []).score, 6);
  // own verification command instead of the test button
  assert.strictEqual(run('x13', efixed('x13'), EV.x13.concat([cmd('p7', 'ping -n 2 192.168.30.10', 'a')])).score, 10);
  assert.strictEqual(run('x11', efixed('x11'), EV.x11.concat([a({ k: 'svc', host: 'pc2', target: '192.168.12.10', port: 445 })])).score, 10);
});

it('unsolved: evidence only (no change), or a wrong change', () => {
  for (const m of EVID) {
    const r = run(m.id, topo(m.id), EV[m.id].concat(VERIFY));
    assert.strictEqual(r.score, 3, m.id + ': ' + r.feedback.join(' | '));
    assert.ok(fbHas(r, /ยังไม่ได้แก้ไขเครือข่าย/));
    assert.strictEqual(run(m.id, topo(m.id), []).score, 0, m.id);
  }
  // x9: moving the printer instead of the new PC -> printing to 192.168.5.20 still fails
  const t9 = topo('x9'); dev(t9, 'prn').ifaces[0].ip = '192.168.5.21';
  const r9 = run('x9', t9, EV.x9.concat(VERIFY));
  assert.strictEqual(r9.score, 3 - 1, String(r9.score)); assert.strictEqual(r9.details.root, 0); assert.ok(fbHas(r9, /ยังไม่ผ่าน/) && fbHas(r9, /แก้ไขเกินจำเป็น: IP address ของ PRN-ADMIN/), r9.feedback.join('|'));
  // x12: fixing every PC's gateway to the wrong router IP does not help (gateway outside the PC's subnet)
  const t12 = topo('x12'); ['b1', 'b2'].forEach(id => { dev(t12, id).gateway = '192.168.21.1'; });
  const r12 = run('x12', t12, EV.x12.concat(VERIFY));
  assert.ok(r12.score <= 1, r12.score + ' ' + r12.feedback.join('|'));
});

// ---- Phase 6 leak fix: an empty or fabricated submit must not reveal the cause, the fix, or the missing evidence
const secretsOf = sc => [sc.explainFull.cause, sc.explainFull.fix].concat(sc.explainFull.evidence, sc.evidence.map(e => e.text));
const faultMsgsOf = (id, t) => { const sc = g._scenarios[id]; const net = NetSim.create(TS.effTopo(t)); return sc.faults.map(f => f(t, net)).filter(Boolean); };
it('leak: x9-x13 empty / fabricated submits reveal no cause, fix, fault text or missing evidence text', () => {
  for (const m of EVID) {
    const sc = g._scenarios[m.id];
    // a fabricated "change" that touches something harmless (a host's DNS list order) and an empty submit
    const fab = topo(m.id); const h = dev(fab, m.start.focusHost); h.dns = (h.dns || []).concat(['9.9.9.9']);
    const subs = [g.grade(m.id, {}), run(m.id, topo(m.id), []), run(m.id, fab, [b({ k: 'test' }), a({ k: 'test' })]), run(m.id, fab, EV[m.id].slice(0, 1).concat(VERIFY))];
    const banned = secretsOf(sc).concat(faultMsgsOf(m.id, topo(m.id)));
    subs.forEach((r, i) => {
      const js = JSON.stringify(r);
      assert.strictEqual(r.details.explain || null, null, m.id + '#' + i + ': no explanation before the fix');
      banned.forEach(x => assert.ok(!js.includes(x) || r.details.evidence.some(e => e.got && e.text === x), m.id + '#' + i + ' leaks: ' + x));
      (r.details.evidence || []).forEach(e => { if (!e.got) assert.ok(!('text' in e) && e.area, m.id + ': missing evidence shows its area only'); });
    });
    // missing evidence -> generic area guidance in the feedback
    assert.ok(fbHas(subs[1], /^ยังขาดหลักฐานด้าน/), m.id);
    // the correct solution still scores full and then shows the explanation with all evidence
    const ok = run(m.id, efixed(m.id), EV[m.id].concat(VERIFY));
    assert.strictEqual(ok.score, 10, m.id);
    assert.ok(ok.details.explain.cause === sc.explainFull.cause && ok.details.explain.evidence.length && ok.details.evidence.every(e => e.text));
    // fixed but without the evidence: explanation of cause/fix, but the evidence list stays hidden
    const noEv = run(m.id, efixed(m.id), VERIFY);
    assert.ok(noEv.details.explain && noEv.details.explain.evidence.length === 0 && noEv.details.evidence.every(e => !('text' in e)), m.id);
  }
});

it('leak: x1-x8 a wrong cause + a change elsewhere in scope does not name the fault', () => {
  const wrongCause = id => M(id).start.causes.find(c => c.id !== CAUSE(id)).id;
  for (const m of LEGACY) {
    const t = topo(m.id); const sc = g._scenarios[m.id];
    const banned = faultMsgsOf(m.id, t).concat([sc.explain]);
    [g.grade(m.id, {}), g.grade(m.id, { cause: wrongCause(m.id), topo: t })].forEach(r => {
      const js = JSON.stringify(r);
      banned.forEach(x => assert.ok(!js.includes(x), m.id + ' leaks: ' + x));
    });
  }
  // x3: allowed fields are gateway + dns; changing only the DNS must not reveal that the gateway is wrong
  const t3 = topo('x3'); dev(t3, 'pc21').dns = ['8.8.4.4'];
  const r3 = g.grade('x3', { cause: 'zzz', topo: t3 });
  assert.ok(!fbHas(r3, /Default gateway ของ PC21/) && fbHas(r3, /ยังมีต้นเหตุที่ยังไม่ได้แก้/), r3.feedback.join('|'));
  // and the correct answer still scores full
  for (const m of LEGACY) assert.strictEqual(g.grade(m.id, { cause: CAUSE(m.id), topo: fixed(m.id) }).score, 10, m.id);
});

it('workarounds: checks may pass but the root cause is not fixed (no root points, extra changes cost points)', () => {
  // x10: point every PC at 8.8.8.8 -> public names work, the school intranet name does not
  const t10 = topo('x10'); ['pc1', 'pc2', 'pc3'].forEach(id => { dev(t10, id).dns = ['8.8.8.8']; });
  const r10 = run('x10', t10, EV.x10.concat(VERIFY));
  assert.deepStrictEqual(r10.details.checks.map(c => c.ok), [false, true, false]);
  assert.strictEqual(r10.details.root, 0); assert.ok(r10.score <= 3, String(r10.score)); assert.ok(!fbHas(r10, /SRV-DC01 ยังหยุด/) && fbHas(r10, /ยังมีต้นเหตุที่ยังไม่ได้แก้/), r10.feedback.join('|'));
  // x11: switching the whole firewall off: works, but unsafe -> half the root points and a destructive-change deduction
  const t11 = topo('x11'); dev(t11, 'fs').firewall.enabled = false;
  const r11 = run('x11', t11, EV.x11.concat(VERIFY));
  assert.ok(r11.details.checks.every(c => c.ok));
  assert.strictEqual(r11.details.root, 1); assert.ok(fbHas(r11, /ปิดทั้งเครื่อง/));
  assert.strictEqual(r11.score, 10 - 1 - 2, r11.feedback.join('|')); // -1 root, -1 extra change, -1 destructive
  // x13: moving LIB-07 to the lower half (.100/25) makes every ping pass, the mask is still wrong
  const t13 = topo('x13'); dev(t13, 'p7').ifaces[0].ip = '192.168.30.100';
  const r13 = run('x13', t13, EV.x13.concat(VERIFY));
  assert.ok(r13.details.checks.every(c => c.ok), JSON.stringify(r13.details.checks));
  assert.strictEqual(r13.details.root, 0); assert.strictEqual(r13.score, 10 - 2 - 1, r13.feedback.join('|'));
  assert.ok(fbHas(r13, /workaround/));
  // x12: moving room 2 into the router's wrong subnet: room 1 still cannot reach 192.168.20.21
  const t12 = topo('x12'); [['b1', 21], ['b2', 22]].forEach(([id, n]) => { dev(t12, id).ifaces[0].ip = '192.168.21.' + n; dev(t12, id).gateway = '192.168.21.1'; });
  const r12 = run('x12', t12, EV.x12.concat(VERIFY));
  assert.strictEqual(r12.details.checks[2].ok, false); assert.strictEqual(r12.details.root, 0); assert.ok(r12.score <= 4, String(r12.score));
});

it('solved but broke something else: regressions and destructive extra changes are deducted', () => {
  // x9: right fix, but ADM-02 gateway changed on the way -> ADM-02 loses the internet
  const t9 = efixed('x9'); dev(t9, 'pc2').gateway = '192.168.5.254';
  const r9 = run('x9', t9, EV.x9.concat(VERIFY));
  assert.ok(r9.details.checks.every(c => c.ok));
  assert.deepStrictEqual(r9.details.regressions, ['ping จาก ADM-02 ไป www.netlab.test']);
  assert.strictEqual(r9.score, 10 - 2 - 1, r9.feedback.join('|')); assert.ok(fbHas(r9, /ทำให้ส่วนที่เคยใช้งานได้เสีย/));
  // x9: "fixing" by giving ADM-09 the server's address: printing works again, file server now answered by ADM-09
  const t9b = topo('x9'); dev(t9b, 'pc9').ifaces[0].ip = '192.168.5.5';
  const r9b = run('x9', t9b, EV.x9.concat(VERIFY));
  assert.ok(r9b.details.checks.every(c => c.ok) && r9b.details.root === 0 && r9b.details.regressions.length >= 1, JSON.stringify(r9b.details));
  assert.ok(r9b.score <= 6, String(r9b.score));
  // x10: DNS started, but the default route deleted -> internet gone (check + regression + destructive)
  const t10 = efixed('x10'); dev(t10, 'r1').routes = [];
  const r10 = run('x10', t10, EV.x10.concat(VERIFY));
  assert.ok(r10.details.regressions.includes('ping จาก OFF-01 ไป 8.8.8.8'), JSON.stringify(r10.details.regressions));
  assert.ok(r10.details.destructive.includes('r1.routes'));
  assert.ok(r10.score <= 4, r10.score + ' ' + r10.feedback.join('|'));
  // x11: SMB allowed but ICMP blocked on the way -> monitoring ping broken
  const t11 = efixed('x11'); dev(t11, 'fs').firewall.icmp = false;
  const r11 = run('x11', t11, EV.x11.concat(VERIFY));
  assert.ok(r11.details.checks.every(c => c.ok)); assert.deepStrictEqual(r11.details.regressions, ['ping จาก ACC-01 ไป 192.168.12.10']);
  assert.strictEqual(r11.score, 10 - 2 - 2, r11.feedback.join('|'));
  // x12: router interface fixed but LAB1-01 cable unplugged
  const t12 = efixed('x12'); lnk(t12, 'l1').up = false;
  const r12 = run('x12', t12, EV.x12.concat(VERIFY));
  assert.strictEqual(r12.details.checks[2].ok, false); assert.ok(r12.details.regressions.length >= 2);
  assert.ok(r12.details.destructive.includes('link.l1.up')); assert.ok(r12.score <= 4, String(r12.score));
  // x13: mask fixed but LIB-08 gateway broken
  const t13 = efixed('x13'); dev(t13, 'p8').gateway = '192.168.30.254';
  const r13 = run('x13', t13, EV.x13.concat(VERIFY));
  assert.strictEqual(r13.score, 7, r13.feedback.join('|'));
});

it('evidence items are judged from the replayed results, not from the command text', () => {
  // the same commands run on the wrong host, or commands whose result does not show the fault, earn nothing
  const r = run('x12', efixed('x12'), [cmd('a1', 'ping 192.168.20.1'), cmd('b1', 'ping 192.168.10.1'), cmd('zz', 'ping 192.168.20.22'), b({ k: 'inspect', dev: 'nope' })].concat(VERIFY));
  assert.strictEqual(r.details.evidence.filter(x => x.got).length, 0, JSON.stringify(r.details.evidence));
  // arp -a BEFORE any ping shows nothing -> no arp evidence; after the ping it does
  const e1 = run('x9', efixed('x9'), [cmd('pc1', 'arp -a'), cmd('pc1', 'ping 192.168.5.20')]);
  assert.deepStrictEqual(e1.details.evidence.map(x => x.got), [true, false, false]);
  const e2 = run('x9', efixed('x9'), [cmd('pc2', 'ping -n 1 192.168.5.20'), cmd('pc2', 'arp -a')]);
  assert.deepStrictEqual(e2.details.evidence.map(x => x.got), [true, true, false]);
  // Linux syntax works too
  const rs = TS.replay(NetSim, topo('x11'), [cmd('pc1', 'sudo ping -c 4 fs.acc.local'), cmd('pc1', 'dig +short fs.acc.local @192.168.12.5'), cmd('pc1', 'ip route'), cmd('pc1', 'ip neigh')]);
  assert.deepStrictEqual(rs.map(x => x.type), ['ping', 'nslookup', 'route', 'arp']);
  assert.ok(rs[0].ok && rs[1].ok && rs[1].ip === '192.168.12.10' && rs[3].arp.length >= 1);
});

it('parseCmd understands the terminal commands', () => {
  const P = TS.parseCmd;
  assert.deepStrictEqual(P('ping -n 2 www.netlab.test'), { type: 'ping', target: 'www.netlab.test' });
  assert.deepStrictEqual(P('PING /n 2 8.8.8.8'), { type: 'ping', target: '8.8.8.8' });
  assert.deepStrictEqual(P('tracert -d 8.8.8.8'), { type: 'tracert', target: '8.8.8.8' });
  assert.deepStrictEqual(P('nslookup srv.lab.local 192.168.3.5'), { type: 'nslookup', name: 'srv.lab.local', server: '192.168.3.5' });
  assert.deepStrictEqual(P('ipconfig /all'), { type: 'ipconfig', all: true });
  assert.strictEqual(P('ipconfig /renew').type, 'other');
  assert.strictEqual(P('arp -a').type, 'arp'); assert.strictEqual(P('route print').type, 'route');
  assert.strictEqual(P('ip a').type, 'ipconfig'); assert.strictEqual(P('cat /etc/resolv.conf').type, 'ipconfig');
  assert.strictEqual(P('hello').type, 'other'); assert.strictEqual(P('').type, 'other'); assert.strictEqual(P(null).type, 'other');
});

it('evidence missions: structural / malformed payloads never throw', () => {
  const bad = [null, undefined, 1, 'x', [], {}, { topo: 'x' }, { topo: { devices: 'a', links: [] } }, { topo: { devices: [null, 1], links: [] } },
    { topo: topo('x10'), actions: 'zz' }, { topo: topo('x10'), actions: [null, 1, 'a', { k: 'cmd' }, { k: 'cmd', host: 'pc1', cmd: 42 }, { k: 'svc', host: 'pc1', port: 'x' }] },
    { topo: topo('x10'), actions: new Array(5000).fill({ k: 'cmd', host: 'pc1', cmd: 'ping 8.8.8.8', ph: 'b' }) }];
  for (const p of bad) {
    const r = g.grade('x10', p);
    assert.ok(typeof r.score === 'number' && r.score >= 0 && r.score <= 3 && r.feedback.length, JSON.stringify(p && p.actions && p.actions.length) + ' ' + r.score);
  }
  const t = efixed('x10'); t.devices.push({ id: 'pc99', type: 'pc', name: 'PC99' });
  const r = run('x10', t, EV.x10.concat(VERIFY)); assert.strictEqual(r.score, 3); assert.ok(fbHas(r, /เพิ่มหรือลบอุปกรณ์/));
  const t2 = efixed('x11'); dev(t2, 'fs').services.web = true;
  assert.ok(fbHas(run('x11', t2, []), /ไม่ใช่การตั้งค่าที่แก้ได้/));
});

it('legacy missions are unaffected by the new editable fields (firewall on/off, SMB, DNS service, router interface IP)', () => {
  const t = fixed('x6'); dev(t, 'srv').firewall.enabled = false;
  const r = g.grade('x6', { cause: 'fw', topo: t }); assert.strictEqual(r.score, 4); assert.ok(fbHas(r, /แก้ไขเกินขอบเขต/));
  const t8 = fixed('x8'); dev(t8, 'r2').ifaces[0].ip = '10.0.0.6';
  assert.strictEqual(g.grade('x8', { cause: 'both', topo: t8 }).score, 4);
  const t5 = fixed('x5'); dev(t5, 'srv').services.dns.enabled = true; // explicit default value = no change
  assert.strictEqual(g.grade('x5', { cause: 'dns', topo: t5 }).score, 10);
});

// ===================================================================== x14: random faults + report (generated)
const crypto = require('crypto');
const X = g._x14;
const M14 = M('x14');
const nonceOf = i => crypto.createHash('sha256').update('x14-test-' + i).digest('hex').slice(0, 32);
const probOf = n => X.publicProblem(n);
const scOf = p => X.scenarioFor(p.n);
// the known fix, applied programmatically to the problem topology
const fixAll = (p, except) => { const sc = scOf(p); const t = clone(p.topo); sc.faults.slice().reverse().forEach(f => { if (f !== except) X.FT[f.type].fix(t, f); }); return t; };
// evidence a careful student collects before changing anything: run every mission check by hand + inspect the faulty devices
const evidenceOf = (p, opts) => {
  const sc = scOf(p), acts = [];
  if (!(opts && opts.noTests)) sc.checks.forEach(c => acts.push(c.kind === 'tcp' ? { k: 'svc', host: c.src, target: c.target, port: c.port, ph: 'b' } : { k: 'cmd', host: c.src, cmd: 'ping ' + c.target, ph: 'b' }));
  if (!(opts && opts.noInspect)) sc.faults.forEach(f => acts.push({ k: 'inspect', dev: f.dev, ph: 'b' }));
  return acts;
};
const goodReport = (p, causes) => ({
  symptom: 'ผู้ใช้หลายเครื่องใช้งานบางบริการไม่ได้ ตามรายการอาการที่ helpdesk ได้รับ',
  evidence: 'ping ทุกเงื่อนไข, Test-NetConnection พอร์ตบริการ และตรวจค่าตั้งของอุปกรณ์ที่สงสัย',
  cause: 'จากหลักฐาน ผลทดสอบล้มเหลวตรงจุดที่ตั้งค่าผิดบนอุปกรณ์ต้นเหตุ',
  fix: 'แก้ค่าที่ผิดบนอุปกรณ์ต้นเหตุให้ถูกต้องแล้วบันทึก',
  verify: 'ทดสอบซ้ำทุกเงื่อนไขผ่านครบ และส่วนอื่นยังใช้งานได้',
  causes: causes || scOf(p).faults.map(f => ({ cat: f.cat, dev: f.dev }))
});
const fullPayload = p => ({ topo: fixAll(p), actions: evidenceOf(p).concat([{ k: 'test', ph: 'a' }]), rpt: goodReport(p), report: 'รายงาน' });
const g14 = (payload, p) => g.grade('x14', payload, p);
const rubSum = r => Math.round(r.rubric.reduce((a, x) => a + x.score, 0) * 100) / 100;
// find generated problems with a given property (deterministic nonces)
function findProblem(pred, from) { for (let i = from || 0; i < 3000; i++) { const p = probOf(nonceOf(i)); if (pred(scOf(p), p)) return p; } throw new Error('no such scenario'); }
const hasType = ty => sc => sc.faults.some(f => f.type === ty);

it('x14: appended after x13, hard, max 20, teacher rubric criteria, public start without answers', () => {
  assert.deepStrictEqual(g.missions.map(m => m.id).slice(-3), ['x13', 'x14', 'x15'], 'x14 right after x13; the week-1 mission x15 is appended last');
  assert.ok(M14 && M14.level === 'hard' && M14.max === 20 && M14.title === 'สุ่มเหตุขัดข้อง' && M14.hints.length >= 2);
  assert.deepStrictEqual(M14.review.teacher.map(c => [c.id, c.max]), [['quality', 5], ['comm', 3]]);
  M14.review.teacher.forEach(c => assert.ok(c.title && c.desc));
  assert.ok(M14.start.gen && M14.start.mode === 'evidence' && M14.start.cats.length === 7 && M14.start.report.length === 5);
  assert.ok(!M14.start.topo && !/"(faults|allowed|cause|explain)"\s*:/.test(JSON.stringify(M14)));
  assert.strictEqual(typeof g.generate, 'function');
  assert.deepStrictEqual(g.generatedMissions, ['x14'], 'only x14 is generated');
  assert.strictEqual(g.generate('x3', Math.random), null);
  assert.strictEqual(g.grade('x1', { cause: 'cable', topo: fixed('x1') }).score, 10);
  assert.strictEqual(run('x13', efixed('x13'), EV.x13.concat(VERIFY)).score, 10);
});

it('x14: 150 random seeds -> valid, solvable problems; the known fix + evidence + report = 20/20', () => {
  const tpl = new Set(), types = new Set(), nf = new Set();
  for (let i = 0; i < 150; i++) {
    const p = g.generate('x14', () => crypto.randomBytes(4).readUInt32BE(0) / 4294967296);
    const sc = scOf(p);
    tpl.add(sc.key); nf.add(sc.faults.length); sc.faults.forEach(f => types.add(f.type));
    assert.ok(sc.faults.length >= 1 && sc.faults.length <= 2);
    assert.ok(p.symptoms.length >= 1 && p.checks.length === 6 && p.hosts.every(h => dev(p.topo, h)));
    const before = checkAll(p.topo, p.checks);
    assert.ok(before.some(x => !x), 'something is broken');
    assert.ok(checkAll(fixAll(p), p.checks).every(Boolean), 'the fix repairs every check');
    const r = g14(fullPayload(p), p);
    assert.strictEqual(r.score, 20, sc.key + ' ' + sc.faults.map(f => f.type) + ': ' + r.feedback.join(' | '));
    assert.ok(r.ok && rubSum(r) === r.score, 'rubric sums to the score');
    assert.ok(r.details.explain && r.details.explain.cause && r.details.explain.fix, 'explanation once solved');
  }
  assert.strictEqual(tpl.size, 3, 'all three base networks');
  assert.ok(nf.has(1) && nf.has(2), 'one and two faults');
  assert.ok(types.size >= 11, 'fault catalogue coverage: ' + [...types].join(','));
});

it('x14: catalogue covers every category; every fault is observable before any change and needed after the others are fixed', () => {
  const cats = new Set();
  for (let i = 0; i < 120; i++) {
    const p = probOf(nonceOf(i)), sc = scOf(p);
    const base = checkAll(p.topo, p.checks);
    sc.faults.forEach(f => {
      cats.add(f.cat);
      assert.ok(!X.FT[f.type].ok(p.topo, f, sc), 'fault present');
      const only = X.withoutFault(sc.healthy, sc.faults, f);
      assert.ok(checkAll(only, p.checks).some((x, j) => x !== base[j]), 'observable: ' + f.type);
      const rest = fixAll(p, f);
      assert.ok(checkAll(rest, p.checks).some(x => !x), 'still needed: ' + f.type);
    });
    if (sc.faults.length === 2) assert.notStrictEqual(sc.faults[0].cat, sc.faults[1].cat);
  }
  assert.deepStrictEqual([...cats].sort(), X.CATS.map(c => c[0]).sort());
});

it('x14: unsolved -> low score; partial fix -> partial credit without revealing the answer', () => {
  for (let i = 0; i < 40; i++) {
    const p = probOf(nonceOf(i));
    assert.strictEqual(g14({ topo: clone(p.topo), actions: [] }, p).score, 0, 'nothing done');
    const r = g14({ topo: clone(p.topo), actions: evidenceOf(p), rpt: goodReport(p) }, p);   // diagnosis + report, no repair
    assert.ok(r.score <= 8, String(r.score));
    assert.ok(r.details.explain === null && !r.details.faults && r.details.evidence.every(x => !('text' in x)), 'no answer before it is fixed');
    const sc = scOf(p);
    const leak = sc.faults.map(f => X.FT[f.type].cause(p.topo, f, sc));
    assert.ok(!leak.some(t => JSON.stringify(r).includes(t)), 'fault description not in the result');
    assert.ok(rubSum(r) === r.score);
  }
  const p = findProblem(sc => sc.faults.length === 2);
  const sc = scOf(p);
  const r = g14({ topo: fixAll(p, sc.faults[1]), actions: evidenceOf(p).concat([{ k: 'test', ph: 'a' }]), rpt: goodReport(p) }, p);
  assert.ok(r.score > 8 && r.score < 20, String(r.score));
  assert.strictEqual(r.details.root, 2); assert.strictEqual(r.details.explain, null);
  assert.ok(fbHas(r, /แก้ที่ต้นเหตุแล้ว 1 จาก 2 จุด/), r.feedback.join('|'));
});

it('x14: evidence counts only before the change; report fields and root-cause categories are graded', () => {
  const p = findProblem(sc => sc.faults.length === 2);
  const late = evidenceOf(p).map(x => Object.assign({}, x, { ph: 'a' }));
  const r1 = g14({ topo: fixAll(p), actions: late.concat([{ k: 'test', ph: 'a' }]), rpt: goodReport(p) }, p);
  assert.strictEqual(r1.score, 16, r1.feedback.join('|'));                    // evidence 0/4
  const r2 = g14({ topo: fixAll(p), actions: evidenceOf(p, { noInspect: true }).concat([{ k: 'test', ph: 'a' }]), rpt: goodReport(p) }, p);
  assert.ok(r2.score >= 17 && r2.score < 20, String(r2.score));               // symptoms seen, faulty devices not located
  const empty = g14({ topo: fixAll(p), actions: evidenceOf(p).concat([{ k: 'test', ph: 'a' }]), rpt: { causes: goodReport(p).causes } }, p);
  assert.strictEqual(empty.score, 18); assert.ok(fbHas(empty, /กรอกครบ 0\/5/));
  const wrongCats = X.CATS.map(c => c[0]).filter(c => !scOf(p).faults.some(f => f.cat === c)).slice(0, 2);
  const rw = g14({ topo: fixAll(p), actions: evidenceOf(p).concat([{ k: 'test', ph: 'a' }]), rpt: goodReport(p, wrongCats.map(c => ({ cat: c, dev: 'sw1' }))) }, p);
  assert.strictEqual(rw.score, 16); assert.ok(fbHas(rw, /ไม่ตรง 2 รายการ/));
  const sc = scOf(p);
  const rd = g14({ topo: fixAll(p), actions: evidenceOf(p).concat([{ k: 'test', ph: 'a' }]), rpt: goodReport(p, sc.faults.map(f => ({ cat: f.cat, dev: 'net' }))) }, p);
  assert.strictEqual(rd.score, 19, 'right categories, wrong devices: -1');
  const none = g14({ topo: fixAll(p), actions: evidenceOf(p) }, p);
  assert.strictEqual(none.score, 13); assert.ok(fbHas(none, /ยังไม่ได้เลือกหมวดสาเหตุ/) && fbHas(none, /ยังไม่ได้ทดสอบยืนยัน/));   // 5 + 4 + 4, no verification
});

it('x14: workarounds and collateral damage are deducted', () => {
  // firewall switched off entirely instead of allowing the blocked service
  const p = findProblem(sc => sc.faults.length === 1 && sc.faults[0].type === 'fw');
  const f = scOf(p).faults[0], t = clone(p.topo); dev(t, f.dev).firewall.enabled = false;
  const r = g14({ topo: t, actions: evidenceOf(p).concat([{ k: 'test', ph: 'a' }]), rpt: goodReport(p) }, p);
  assert.ok(checkAll(t, p.checks).every(Boolean), 'works...');
  assert.strictEqual(r.details.root, 0); assert.ok(r.details.destructive.length === 1 && r.score <= 12, r.score + ' ' + r.feedback.join('|'));
  // DNS fault worked around by pointing the client at 8.8.8.8 -> internal names still fail or root not fixed
  const pd = findProblem(sc => sc.faults.length === 1 && sc.faults[0].type === 'dnsw');
  const fd = scOf(pd).faults[0], td = clone(pd.topo); dev(td, fd.dev).dns = ['8.8.8.8'];
  const rdn = g14({ topo: td, actions: evidenceOf(pd), rpt: goodReport(pd) }, pd);
  assert.strictEqual(rdn.details.root, 0); assert.ok(rdn.score < 14, String(rdn.score));
  // fixed, but a cable that worked is unplugged on the way -> regression + destructive extra change
  const pr = findProblem(sc => sc.faults.length === 1 && sc.faults[0].type !== 'cable');
  const tr = fixAll(pr); const l = tr.links.find(x => x.a.dev === pr.checks[0].src || x.b.dev === pr.checks[0].src); l.up = false;
  const rr = g14({ topo: tr, actions: evidenceOf(pr).concat([{ k: 'test', ph: 'a' }]), rpt: goodReport(pr) }, pr);
  assert.ok(rr.details.regressions.length >= 1 && rr.details.destructive.includes('link.' + l.id + '.up'), JSON.stringify(rr.details));
  assert.ok(rr.score <= 14 && rubSum(rr) === rr.score, String(rr.score));
});

it('x14: secrecy - problem/token carry only public data; the faults need the server secret', () => {
  const ALLOWED = ['v', 'n', 'title', 'story', 'symptoms', 'topo', 'focusHost', 'hosts', 'checks', 'svcPorts'];
  let differ = 0;
  const otherKey = crypto.createHash('sha256').update('some other secret').digest();
  for (let i = 0; i < 60; i++) {
    const p = probOf(nonceOf(i)), sc = scOf(p);
    assert.deepStrictEqual(Object.keys(p).sort(), ALLOWED.slice().sort());
    const js = JSON.stringify(p);
    assert.ok(!/"(faults|fault|cat|allowed|healthy|explain|orig|bad|victim|keys)"\s*:/.test(js), 'no answer fields');
    sc.faults.forEach(f => assert.ok(!js.includes(X.FT[f.type].cause(p.topo, f, sc)), 'no fault text'));
    // same nonce with a different server secret -> a different scenario (the nonce alone does not give the answer)
    const o = X.scenarioFor(p.n, otherKey);
    if (stable(o.topo) !== stable(sc.topo) || o.faults.map(f => f.type + f.dev).join() !== sc.faults.map(f => f.type + f.dev).join()) differ++;
  }
  assert.ok(differ >= 55, 'faults depend on the secret: ' + differ + '/60');
  // a problem rebuilt with another key is rejected by the grader (does not match the server's own derivation)
  const n = nonceOf(1), forged = Object.assign(probOf(n), { topo: X.scenarioFor(n, otherKey).topo });
  if (stable(forged.topo) !== stable(probOf(n).topo)) assert.strictEqual(g14({ topo: forged.topo, actions: [] }, forged).score, 0);
  const t2 = probOf(nonceOf(2)); const tampered = clone(t2); tampered.topo.devices[0].name = 'HACK';
  const rt = g14(fullPayload(t2), tampered); assert.strictEqual(rt.score, 0); assert.ok(fbHas(rt, /ไม่ตรงกับที่ระบบสร้าง/));
  assert.strictEqual(g14(fullPayload(t2), null).score, 0);
  assert.strictEqual(g14(fullPayload(t2), { n: 'zz' }).score, 0);
});

it('x14: malformed payloads never throw', () => {
  const p = probOf(nonceOf(5));
  const bad = [null, undefined, 1, 'x', [], {}, { topo: 'x' }, { topo: { devices: 'a', links: [] } }, { topo: { devices: [null, 1], links: [] } },
    { topo: clone(p.topo), actions: 'zz', rpt: 'x' }, { topo: clone(p.topo), actions: [null, 1, { k: 'cmd' }], rpt: { causes: 'x', symptom: 5 } },
    { topo: clone(p.topo), rpt: { causes: [null, 1, { cat: 'dns', dev: { a: 1 } }, { cat: 'zzz' }] } },
    { topo: clone(p.topo), actions: new Array(5000).fill({ k: 'cmd', host: p.focusHost, cmd: 'ping 8.8.8.8', ph: 'b' }) }];
  for (const x of bad) {
    const r = g14(x, p);
    assert.ok(typeof r.score === 'number' && r.score >= 0 && r.score <= 6 && r.feedback.length, String(r.score));
  }
});

// ---- the real API: signed tokens (server/sims-api.js) with the grader
async function apiTests() {
  process.env.APP_SECRET = process.env.APP_SECRET || 'troubleshoot-test-secret';
  const express = require('express');
  const api = require('../../server/sims-api');
  const app = express(); app.use(express.json({ limit: '2mb' })); app.use('/api/sims', api.router);
  const srv = await new Promise(res => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const base = `http://127.0.0.1:${srv.address().port}/api/sims/troubleshoot`;
  const post = async (u, body) => { const r = await fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  const tests = [];
  const at = (name, fn) => tests.push([name, fn]);
  at('API x14: token is HMAC-signed; its readable body holds only the public problem; tampering is rejected', async () => {
    const { body: { problem, token } } = await post('/new', { mission: 'x14' });
    const tb = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    assert.deepStrictEqual(Object.keys(tb).filter(k => k !== 'n').sort(), ['exp', 'm', 'p', 's', 'u']);   // n = optional random token id
    assert.strictEqual(stable(tb.p), stable(problem), 'token body = the problem the browser already has');
    const sc = X.scenarioFor(problem.n);   // same process -> same secret
    const tjs = JSON.stringify(tb);
    assert.ok(!/"(faults|fault|cat|allowed|healthy|orig|bad|victim)"\s*:/.test(tjs) && !sc.faults.some(f => tjs.includes(X.FT[f.type].cause(problem.topo, f, sc))));
    const good = { topo: fixAll(problem), actions: evidenceOf(problem).concat([{ k: 'test', ph: 'a' }]), rpt: goodReport(problem), report: 'r' };
    const ok = await post('/submit', { mission: 'x14', payload: good, problem, token });
    assert.strictEqual(ok.status, 200); assert.strictEqual(ok.body.score, 20, ok.body.feedback.join('|'));
    assert.ok(Array.isArray(ok.body.rubric) && ok.body.rubric.length >= 6);
    // tampered body (another nonce) with the old signature
    const tb2 = Object.assign({}, tb, { p: Object.assign({}, tb.p, { n: nonceOf(77) }) });
    const forged = Buffer.from(JSON.stringify(tb2)).toString('base64url') + '.' + token.split('.')[1];
    assert.strictEqual((await post('/submit', { mission: 'x14', payload: good, token: forged })).status, 400);
    assert.strictEqual((await post('/submit', { mission: 'x14', payload: good, token: token.slice(0, -2) + 'AA' })).status, 400);
    assert.strictEqual((await post('/submit', { mission: 'x14', payload: good })).status, 400);
    // a problem object sent next to a valid token is ignored: the server grades the signed one
    const other = probOf(nonceOf(9));
    const r = await post('/submit', { mission: 'x14', payload: good, problem: other, token });
    assert.strictEqual(r.body.score, 20);
    // x1-x13 cannot be generated, and x14 without a valid token is rejected
    assert.strictEqual((await post('/new', { mission: 'x3' })).status, 404);
    assert.strictEqual((await post('/submit', { mission: 'x14', payload: good, token: 'x.y' })).status, 400);
  });
  at('API x1-x13: submissions need no token (only x14 is generated)', async () => {
    const r = await post('/submit', { mission: 'x1', payload: { cause: 'cable', topo: fixed('x1') } });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.score, 10);
    const r2 = await post('/submit', { mission: 'x13', payload: { topo: efixed('x13'), actions: EV.x13.concat(VERIFY) } });
    assert.strictEqual(r2.body.score, 10);
  });
  for (const [name, fn] of tests) {
    try { await fn(); passed++; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '\n     ', (e && e.stack || String(e)).split('\n').slice(0, 6).join('\n      ')); }
  }
  srv.close();
}

apiTests().catch(e => { failed++; console.log('  ✗ API tests crashed', e); }).then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
