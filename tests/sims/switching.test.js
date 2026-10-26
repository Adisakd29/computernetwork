// Tests for the Switching & VLAN lab engine and grader: node tests/sims/switching.test.js
'use strict';
const assert = require('assert');
const SW = require('../../public/js/sim/switching.js');
const g = require('../../server/sims/switching.js');

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message); }
}
const fbHas = (r, re) => r.feedback.some(f => re.test(f));
const clone = o => JSON.parse(JSON.stringify(o));
const M = id => g.missions.find(m => m.id === id);
const pc = (id, ip, mac) => ({ id, type: 'pc', name: id.toUpperCase(), ip, prefix: 24, mac });
const swd = (id, mac, extra) => Object.assign({ id, type: 'switch', name: id.toUpperCase(), mac, ports: { fa: 8, gi: 2 } }, extra || {});
const L = (a, ap, b, bp) => ({ a, ap, b, bp });
const ping = (net, a, ip) => net.ping(a, ip);
/* config helpers on the exported (submitted) form */
const cfgOf = id => SW.exportConfig(M(id).start.topo);

/* small reference topologies */
function oneSwitch(hub) {
  const t = { devices: [swd('s1', '0019.0000.0001'), pc('a', '10.0.0.1', '0000.0000.000a'), pc('b', '10.0.0.2', '0000.0000.000b'), pc('c', '10.0.0.3', '0000.0000.000c')],
    links: [L('a', 'eth0', 's1', 'fa0/1'), L('b', 'eth0', 's1', 'fa0/2'), L('c', 'eth0', 's1', 'fa0/3')] };
  if (hub) { t.devices.push({ id: 'h', type: 'hub', name: 'H', ports: 4 }, pc('d', '10.0.0.4', '0000.0000.000d')); t.links.push(L('h', 'p1', 's1', 'fa0/4'), L('d', 'eth0', 'h', 'p2')); }
  return t;
}
function twoSwitch(o1, o2) {
  return { devices: [swd('s1', '0019.0000.0001', o1), swd('s2', '0019.0000.0002', o2),
    pc('a', '10.0.10.1', '0000.0000.000a'), pc('b', '10.0.10.2', '0000.0000.000b'), pc('c', '10.0.20.1', '0000.0000.000c'), pc('d', '10.0.20.2', '0000.0000.000d')],
  links: [L('a', 'eth0', 's1', 'fa0/1'), L('c', 'eth0', 's1', 'fa0/2'), L('b', 'eth0', 's2', 'fa0/1'), L('d', 'eth0', 's2', 'fa0/2'), L('s1', 'gi0/1', 's2', 'gi0/1')] };
}
const V = { 10: 'TEN', 20: 'TWENTY', 99: 'NAT' };
const trunk = (allowed, native) => ({ mode: 'trunk', allowed, native });
const accIfs = { 'fa0/1': { mode: 'access', vlan: 10 }, 'fa0/2': { mode: 'access', vlan: 20 } };
function triangle(stpOff, prio3) {
  const st = { off: stpOff ? [1] : [], prio: prio3 ? { 1: prio3 } : {} };
  return { devices: [swd('s1', '0019.0000.0001', { stp: { off: st.off } }), swd('s2', '0019.0000.0002', { stp: { off: st.off } }), swd('s3', '0019.0000.0003', { stp: st }),
    pc('a', '10.0.0.1', '0000.0000.000a'), pc('b', '10.0.0.2', '0000.0000.000b')],
  links: [L('s1', 'gi0/1', 's2', 'gi0/1'), L('s2', 'gi0/2', 's3', 'gi0/2'), L('s3', 'gi0/1', 's1', 'gi0/2'), L('a', 'eth0', 's1', 'fa0/1'), L('b', 'eth0', 's2', 'fa0/1')] };
}

console.log('switching engine');

it('MAC learning: source MAC learned on the ingress port, destination not learned', () => {
  const net = SW.create(oneSwitch());
  const r = ping(net, 'a', '10.0.0.2');
  assert.ok(r.ok);
  const t = net.macTable('s1');
  assert.deepStrictEqual(t.map(e => [e.mac, e.port]), [['0000.0000.000a', 'fa0/1'], ['0000.0000.000b', 'fa0/2']]);
  assert.ok(!t.some(e => e.mac === '0000.0000.000c'), 'C never sent a frame');
});

it('broadcast is flooded out every port of the VLAN except the ingress port', () => {
  const net = SW.create(oneSwitch());
  const r = ping(net, 'a', '10.0.0.2');
  const e = r.entries.find(x => x.dev === 's1' && x.frame.kind === 'arp-req');
  assert.strictEqual(e.action, 'flood');
  assert.deepStrictEqual(e.out, ['fa0/2', 'fa0/3']);
});

it('unknown unicast is flooded, known unicast goes out one port', () => {
  const net = SW.create(oneSwitch());
  ping(net, 'a', '10.0.0.2');
  net.clear('mac');   // ARP caches stay -> next ping sends unicast to an unknown MAC
  const r = ping(net, 'a', '10.0.0.2');
  assert.strictEqual(r.arp, false);
  const e = r.entries.find(x => x.dev === 's1' && x.frame.kind === 'icmp-req');
  assert.strictEqual(e.action, 'flood_unknown'); assert.deepStrictEqual(e.out, ['fa0/2', 'fa0/3']);
  const e2 = r.entries.find(x => x.dev === 's1' && x.frame.kind === 'icmp-rep');
  assert.strictEqual(e2.action, 'forward'); assert.deepStrictEqual(e2.out, ['fa0/1']);
  const ign = r.entries.find(x => x.dev === 'c' && x.frame.kind === 'icmp-req');
  assert.strictEqual(ign.action, 'ignore', 'C NIC drops a frame that is not for it');
});

it('hub repeats to all ports; the switch filters a frame whose destination is on the ingress port', () => {
  const t = oneSwitch(true);
  t.devices.push(pc('e', '10.0.0.5', '0000.0000.000e')); t.links.push(L('e', 'eth0', 'h', 'p3'));
  const net = SW.create(t);
  const r = ping(net, 'd', '10.0.0.5');
  assert.ok(r.ok);
  const hubE = r.entries.find(x => x.dev === 'h' && x.frame.kind === 'arp-rep');
  assert.deepStrictEqual(hubE.out.sort(), ['p1', 'p2']);
  const f = r.entries.find(x => x.dev === 's1' && x.frame.kind === 'arp-rep');
  assert.strictEqual(f.action, 'filter');
  assert.deepStrictEqual(net.macTable('s1').map(e => e.port), ['fa0/4', 'fa0/4']);
});

it('ARP: request broadcast, reply unicast, both ARP caches filled, second ping needs no ARP', () => {
  const net = SW.create(oneSwitch());
  const r = ping(net, 'a', '10.0.0.2');
  const kinds = r.entries.filter(e => e.action === 'send').map(e => e.frame.kind);
  assert.deepStrictEqual(kinds, ['arp-req', 'arp-rep', 'icmp-req', 'icmp-rep']);
  assert.strictEqual(r.entries[0].frame.dst, SW.BCAST);
  assert.strictEqual(r.entries.find(e => e.frame.kind === 'arp-rep').frame.dst, '0000.0000.000a');
  assert.deepStrictEqual(net.arp('a'), [{ ip: '10.0.0.2', mac: '0000.0000.000b' }]);
  assert.deepStrictEqual(net.arp('b'), [{ ip: '10.0.0.1', mac: '0000.0000.000a' }]);
  assert.deepStrictEqual(net.arp('c'), [], 'C ignores an ARP request that is not for its IP');
  const r2 = ping(net, 'a', '10.0.0.2');
  assert.ok(r2.ok); assert.strictEqual(r2.arp, false);
});

it('ping to another subnet fails at the source with no frames (no router in this lab)', () => {
  const net = SW.create(oneSwitch());
  const r = ping(net, 'a', '10.0.1.9');
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'diff_subnet');
  assert.strictEqual(r.entries.length, 0); assert.ok(/Router/.test(r.reasonText));
  assert.strictEqual(ping(net, 'a', '10.0.0.77').reason, 'arp_fail');
});

it('VLAN isolation: same subnet but different access VLANs cannot ARP each other', () => {
  const t = oneSwitch();
  t.devices[0].vlans = { 10: 'A', 20: 'B' };
  t.devices[0].ifs = { 'fa0/1': { mode: 'access', vlan: 10 }, 'fa0/2': { mode: 'access', vlan: 20 }, 'fa0/3': { mode: 'access', vlan: 10 } };
  const net = SW.create(t);
  const r = ping(net, 'a', '10.0.0.2');
  assert.strictEqual(r.reason, 'arp_fail');
  assert.deepStrictEqual(r.entries.find(e => e.dev === 's1').out, ['fa0/3'], 'flood stays inside VLAN 10');
  assert.ok(ping(net, 'a', '10.0.0.3').ok);
  assert.deepStrictEqual(SW.create(t).broadcast('a').reached, ['c']);
});

it('access port in a VLAN that is not created is inactive', () => {
  const t = oneSwitch();
  t.devices[0].ifs = { 'fa0/1': { mode: 'access', vlan: 30 }, 'fa0/2': { mode: 'access', vlan: 30 } };
  const r = ping(SW.create(t), 'a', '10.0.0.2');
  assert.strictEqual(r.reason, 'arp_fail');
  assert.strictEqual(r.entries.find(e => e.dev === 's1').reason, 'vlan_missing');
});

it('trunk: frames carry an 802.1Q tag, native VLAN goes untagged', () => {
  const t = twoSwitch({ vlans: V, ifs: Object.assign({ 'gi0/1': trunk([10, 20, 99], 99) }, accIfs) }, { vlans: V, ifs: Object.assign({ 'gi0/1': trunk([10, 20, 99], 99) }, accIfs) });
  const net = SW.create(t);
  const r = ping(net, 'a', '10.0.10.2');
  assert.ok(r.ok, r.reasonText);
  const e = r.entries.find(x => x.dev === 's1' && x.frame.kind === 'arp-req');
  assert.deepStrictEqual(e.out, ['gi0/1']); assert.strictEqual(e.outTags['gi0/1'], 10);
  const in2 = r.entries.find(x => x.dev === 's2' && x.frame.kind === 'arp-req');
  assert.strictEqual(in2.tag, 10); assert.strictEqual(in2.vlan, 10);
  assert.strictEqual(r.entries.find(x => x.dev === 'b' && x.frame.kind === 'arp-req').tag, null, 'access port sends untagged');
  assert.ok(ping(net, 'c', '10.0.20.2').ok);
  // native VLAN 10 -> VLAN 10 crosses untagged
  const t2 = twoSwitch({ vlans: V, ifs: Object.assign({ 'gi0/1': trunk(null, 10) }, accIfs) }, { vlans: V, ifs: Object.assign({ 'gi0/1': trunk(null, 10) }, accIfs) });
  const r2 = ping(SW.create(t2), 'a', '10.0.10.2');
  assert.ok(r2.ok); assert.strictEqual(r2.entries.find(x => x.dev === 's2' && x.frame.kind === 'arp-req').tag, null);
});

it('VLAN missing from the allowed list (or not created on the far switch) is dropped at the trunk', () => {
  const t = twoSwitch({ vlans: V, ifs: Object.assign({ 'gi0/1': trunk([10, 20, 99], 99) }, accIfs) }, { vlans: V, ifs: Object.assign({ 'gi0/1': trunk([10, 99], 99) }, accIfs) });
  const net = SW.create(t);
  assert.ok(ping(net, 'a', '10.0.10.2').ok);
  const r = ping(net, 'c', '10.0.20.2');
  assert.strictEqual(r.reason, 'arp_fail');
  const d = r.entries.find(x => x.dev === 's2' && x.action === 'drop');
  assert.strictEqual(d.reason, 'not_allowed'); assert.strictEqual(d.port, 'gi0/1');
  // VLAN 20 not created on s2
  const t2 = twoSwitch({ vlans: V, ifs: Object.assign({ 'gi0/1': trunk(null, 99) }, accIfs) }, { vlans: { 10: 'TEN', 99: 'NAT' }, ifs: Object.assign({ 'gi0/1': trunk(null, 99) }, accIfs) });
  const r2 = ping(SW.create(t2), 'c', '10.0.20.2');
  assert.strictEqual(r2.reason, 'arp_fail');
  assert.strictEqual(r2.entries.find(x => x.dev === 's2' && x.action === 'drop').reason, 'vlan_missing');
});

it('native VLAN mismatch: with STP off untagged frames leak between VLANs; with PVST+ the port is blocked (PVID_Inc)', () => {
  const o1 = { vlans: { 10: 'A', 20: 'B' }, ifs: { 'fa0/1': { mode: 'access', vlan: 10 }, 'fa0/2': { mode: 'access', vlan: 20 }, 'gi0/1': trunk(null, 10) } };
  const o2 = { vlans: { 10: 'A', 20: 'B' }, ifs: { 'fa0/1': { mode: 'access', vlan: 20 }, 'fa0/2': { mode: 'access', vlan: 10 }, 'gi0/1': trunk(null, 20) } };
  const t = twoSwitch(Object.assign({ stp: { off: [10, 20] } }, o1), Object.assign({ stp: { off: [10, 20] } }, o2));
  // a (VLAN 10 on s1) and b (VLAN 20 on s2) share 10.0.10.0/24: the mismatch bridges VLAN 10 and VLAN 20
  const net = SW.create(t);
  assert.ok(ping(net, 'a', '10.0.10.2').ok, 'leak across native VLANs without STP');
  assert.strictEqual(net.nativeMismatches().length, 1);
  const net2 = SW.create(twoSwitch(o1, o2));
  const r = ping(net2, 'a', '10.0.10.2');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(net2.stp(10).ports['s1|gi0/1'].inc, 'PVID_Inc');
  assert.strictEqual(net2.stp(20).ports['s2|gi0/1'].inc, 'PVID_Inc');
  const out = SW.cli(net2.topo, 's1', SW.newSession(), 'show interfaces trunk', net2).out.join('\n');
  assert.ok(/NATIVE_VLAN_MISMATCH/.test(out));
});

it('native mismatch does not break tagged VLANs (realistic): VLAN 10 still crosses', () => {
  const t = twoSwitch({ vlans: V, ifs: Object.assign({ 'gi0/1': trunk([10, 20, 99], 99) }, accIfs) }, { vlans: V, ifs: Object.assign({ 'gi0/1': trunk([10, 20, 99], 1) }, accIfs) });
  assert.ok(ping(SW.create(t), 'a', '10.0.10.2').ok);
});

it('trunk facing an access port: tagged frames dropped on the access side (Type_Inc with STP)', () => {
  const t = twoSwitch({ vlans: V, ifs: Object.assign({ 'gi0/1': trunk(null, 1) }, accIfs) }, { vlans: V, ifs: Object.assign({ 'gi0/1': { mode: 'access', vlan: 1 } }, accIfs) });
  const net = SW.create(t);
  assert.strictEqual(ping(net, 'a', '10.0.10.2').reason, 'arp_fail');
  assert.strictEqual(net.stp(1).ports['s2|gi0/1'].inc, 'Type_Inc');
  const t2 = clone(t); t2.devices[0].stp = { off: [1, 10, 20] }; t2.devices[1].stp = { off: [1, 10, 20] };
  const r = ping(SW.create(t2), 'a', '10.0.10.2');
  assert.strictEqual(r.entries.find(x => x.dev === 's2' && x.action === 'drop').reason, 'tagged_on_access');
});

it('STP: lowest bridge ID (MAC tie-break) is root; alternate port on the higher-BID side', () => {
  const net = SW.create(triangle(false));
  const s = net.stp(1);
  assert.deepStrictEqual(s.roots, ['s1']);
  assert.strictEqual(s.ports['s2|gi0/1'].role, 'root'); assert.strictEqual(s.ports['s3|gi0/1'].role, 'root');
  assert.strictEqual(s.ports['s2|gi0/2'].role, 'designated'); assert.strictEqual(s.ports['s3|gi0/2'].role, 'alternate');
  assert.strictEqual(Object.values(s.ports).filter(p => p.state === 'BLK').length, 1);
  assert.strictEqual(s.bridges.s1.bid.prio, 32769, 'priority + sys-id-ext');
});

it('STP: priority 4096 makes s3 root and moves the blocked port', () => {
  const s = SW.create(triangle(false, 4096)).stp(1);
  assert.deepStrictEqual(s.roots, ['s3']);
  assert.strictEqual(s.ports['s1|gi0/2'].role, 'root'); assert.strictEqual(s.ports['s2|gi0/2'].role, 'root');
  assert.strictEqual(s.ports['s2|gi0/1'].role, 'alternate'); assert.strictEqual(s.ports['s1|gi0/1'].role, 'designated');
});

it('STP: port cost changes the root port (lowest root path cost wins)', () => {
  const t = triangle(false);
  t.devices[2].ifs = { 'gi0/1': { cost: 100 } };   // s3 direct uplink to root becomes expensive: 4+4 via s2 is cheaper
  const s = SW.create(t).stp(1);
  assert.strictEqual(s.ports['s3|gi0/2'].role, 'root'); assert.strictEqual(s.bridges.s3.cost, 8);
  assert.strictEqual(s.ports['s3|gi0/1'].role, 'alternate');
});

it('STP tie-breaker: two parallel links -> lowest sender port ID chooses the root port', () => {
  const t = { devices: [swd('s1', '0019.0000.0001'), swd('s2', '0019.0000.0002')], links: [L('s1', 'gi0/2', 's2', 'gi0/1'), L('s1', 'gi0/1', 's2', 'gi0/2')] };
  const s = SW.create(t).stp(1);
  assert.strictEqual(s.ports['s2|gi0/2'].role, 'root', 'gi0/2 of s2 faces s1 gi0/1 (lower sender port ID)');
  assert.strictEqual(s.ports['s2|gi0/1'].role, 'alternate');
});

it('loop without STP -> broadcast storm, network unusable until the config changes', () => {
  const net = SW.create(triangle(true));
  const r = ping(net, 'a', '10.0.0.2');
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'storm'); assert.ok(r.storm);
  assert.ok(net.totalFrames >= SW.MAX_EVENTS);
  assert.ok(r.entries.some(e => e.learned && e.learned.moved), 'MAC table flapping during the storm');
  assert.strictEqual(ping(net, 'a', '10.0.0.2').reason, 'storm');
  const ok = ping(SW.create(triangle(false)), 'a', '10.0.0.2');
  assert.ok(ok.ok); assert.ok(ok.events < 60);
});

it('STP-disabled switch is transparent to BPDUs: the others still break the loop', () => {
  const t = triangle(false); t.devices[2].stp = { off: [1] };
  const net = SW.create(t);
  assert.ok(ping(net, 'a', '10.0.0.2').ok);
  assert.strictEqual(Object.values(net.stp(1).ports).filter(p => p.state === 'BLK').length, 1);
});

it('collision domains: hub ports share one, each switch link is its own', () => {
  const net = SW.create(M('sw7').start.topo);
  assert.strictEqual(net.collisionDomains('hub1').length, 1);
  assert.strictEqual(net.collisionDomains('sw1').length, 4);
  assert.strictEqual(SW.create(oneSwitch(true)).collisionDomains().length, 4, 'a, b, c + the hub segment');
});

it('applyConfig rejects malformed values and unsafe priorities', () => {
  const st = M('sw3').start.topo;
  assert.strictEqual(SW.applyConfig(st, { sw1: { stp: { prio: { 1: 1000 } } } }).ok, false);
  assert.strictEqual(SW.applyConfig(st, { sw1: { ifs: { 'fa0/1': { vlan: 'x' } } } }).ok, false);
  assert.strictEqual(SW.applyConfig(st, { sw1: { vlans: [{ id: 5000, name: 'X' }] } }).ok, false);
  assert.strictEqual(SW.applyConfig(st, { sw1: { vlans: [{ id: 10, name: 'ห้องแล็บ' }] } }).ok, false);
  assert.strictEqual(SW.applyConfig(st, 'x').ok, false);
  const ok = SW.applyConfig(st, { sw1: { vlans: [{ id: 10, name: 'LAB' }], ifs: { 'fa0/1': { vlan: 10 }, 'zz9': { vlan: 3 } } }, __proto__: { x: 1 }, nope: {} });
  assert.strictEqual(ok.ok, true); assert.strictEqual(ok.topo.devices[0].ifs['fa0/1'].vlan, 10); assert.strictEqual(ok.topo.devices[0].vlans[1], 'default');
});

it('CLI: vlan/name/interface range/switchport commands change the same state as the panel', () => {
  const T = clone(M('sw3').start.topo), ses = SW.newSession();
  const run = l => SW.cli(T, 'sw1', ses, l, SW.create(T));
  ['conf t', 'vlan 10', 'name LAB', 'exit', 'vlan 20', 'name OFFICE', 'interface range fa0/1 - 3', 'switchport mode access', 'switchport access vlan 10',
    'int range f0/4-6', 'sw acc vlan 20', 'end'].forEach(l => { const o = run(l); assert.ok(!o.out.some(x => /Invalid|Incomplete/.test(x)), l + ': ' + o.out.join('|')); });
  assert.strictEqual(T.devices[0].vlans[10], 'LAB'); assert.strictEqual(T.devices[0].ifs['fa0/6'].vlan, 20);
  const r = g.grade('sw3', { config: SW.exportConfig(T) });
  assert.strictEqual(r.score, 10, r.feedback.join('\n'));
  assert.ok(/LAB/.test(run('show vlan brief').out.join('\n')));
});

it('CLI: trunk allowed add/remove, native, priority validation, show spanning-tree / mac table', () => {
  const T = SW.normalize(triangle(false)), ses = SW.newSession();
  const run = l => SW.cli(T, 's3', ses, l, SW.create(T));
  run('configure terminal');
  assert.ok(/increments of 4096/.test(run('spanning-tree vlan 1 priority 5000').out.join(' ')));
  assert.ok(run('spanning-tree vlan 1 priority 4096').changed);
  run('interface gi0/1'); run('switchport mode trunk'); run('switchport trunk allowed vlan 10,20'); run('switchport trunk allowed vlan add 30-31');
  run('switchport trunk allowed vlan remove 20'); run('switchport trunk native vlan 99');
  const f = T.devices[2].ifs['gi0/1'];
  assert.deepStrictEqual(f.allowed, [10, 30, 31]); assert.strictEqual(f.native, 99); assert.strictEqual(f.mode, 'trunk');
  assert.ok(/Invalid input/.test(run('switchport banana').out.join('')));
  assert.strictEqual(SW.prompt(T.devices[2], ses), 'S3(config-if)#');
  const T2 = SW.normalize(triangle(false, 4096)), net = SW.create(T2);
  const o = SW.cli(T2, 's2', SW.newSession(), 'show spanning-tree', net).out.join('\n');
  assert.ok(/Gi0\/1\s+Altn BLK/.test(o), o);
  ping(net, 'a', '10.0.0.2');
  assert.ok(/0000\.0000\.000a\s+DYNAMIC\s+Fa0\/1/.test(SW.cli(T2, 's1', SW.newSession(), 'show mac address-table', net).out.join('\n')));
  assert.ok(/does not exist/.test(SW.cli(SW.normalize(triangle(true)), 's1', SW.newSession(), 'show spanning-tree vlan 1', SW.create(triangle(true))).out.join('')));
});

it('describe() gives Thai text for every trace entry kind', () => {
  const net = SW.create(oneSwitch(true));
  const r = ping(net, 'a', '10.0.0.4');
  assert.ok(r.ok);
  r.entries.forEach(e => assert.ok(SW.describe(e, net).length > 10));
});

console.log('switching grader');

it('module shape: id, 7 missions, public fields, levels, hints', () => {
  assert.strictEqual(g.id, 'switching');
  assert.deepStrictEqual(g.missions.map(m => m.id), ['sw1', 'sw2', 'sw3', 'sw4', 'sw5', 'sw6', 'sw7']);
  for (const m of g.missions) {
    assert.strictEqual(m.max, 10); assert.ok(['easy', 'medium', 'hard'].includes(m.level));
    assert.ok(m.title && m.desc && m.hints.length >= 2 && m.hints.length <= 4, m.id);
    assert.ok(m.start && m.start.topo && m.start.kind);
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(JSON.stringify(m)), 'no emoji');
  }
  assert.deepStrictEqual(g.missions.map(m => m.level), ['easy', 'easy', 'medium', 'medium', 'hard', 'medium', 'easy']);
});

const ip = (mid, id) => M(mid).start.topo.devices.find(d => d.id === id).ip;
const pingA = (mid, s, d) => ({ op: 'ping', src: s, dst: ip(mid, d) });
const SW1_ACTIONS = [pingA('sw1', 'pc1', 'pc2'), pingA('sw1', 'pc4', 'pc1'), pingA('sw1', 'pc5', 'pc4')];
const SW1_TABLE = { pc1: 'fa0/1', pc2: 'fa0/2', pc3: 'none', pc4: 'fa0/4', pc5: 'fa0/4' };

it('sw1 perfect: required pings in order + correct table = 10', () => {
  const r = g.grade('sw1', { actions: SW1_ACTIONS, answers: { table: SW1_TABLE } });
  assert.strictEqual(r.score, 10, r.feedback.join('\n')); assert.ok(r.ok);
});
it('sw1 wrong rows get Thai feedback naming the device and the wrong answer, never the right port (6.x)', () => {
  const r = g.grade('sw1', { actions: SW1_ACTIONS, answers: { table: Object.assign({}, SW1_TABLE, { pc3: 'fa0/3', pc5: 'none' }) } });
  assert.ok(r.score > 5 && r.score < 10, String(r.score));
  assert.ok(fbHas(r, /PC3 .*คุณตอบ Fa0\/3 ซึ่งไม่ถูกต้อง/)); assert.ok(fbHas(r, /PC5 .*"ไม่อยู่ในตาราง" ซึ่งไม่ถูกต้อง/));
  assert.ok(!fbHas(r, /PC5 .*Fa0\/4/), 'right port of PC5 not revealed');
  assert.ok(!r.details.macTable, 'no engine MAC table'); assert.deepStrictEqual(r.details.table.pc5, { got: 'none', ok: false });
  assert.ok(!JSON.stringify(r.details).includes('"want"'), 'no answer key in details');
  const full = g.grade('sw1', { actions: SW1_ACTIONS, answers: { table: SW1_TABLE } });
  assert.ok(full.details.macTable && full.details.table.pc5.want === 'fa0/4', 'key returned on full marks');
});
it('sw1 table without doing the pings scores 0 for the table', () => {
  const r = g.grade('sw1', { actions: [], answers: { table: { pc1: 'none', pc2: 'none', pc3: 'none', pc4: 'none', pc5: 'none' } } });
  assert.strictEqual(r.score, 0); assert.ok(fbHas(r, /ยังไม่ได้ทำขั้นที่ 1/));
  const wrongOrder = g.grade('sw1', { actions: [SW1_ACTIONS[1], SW1_ACTIONS[0]], answers: { table: SW1_TABLE } });
  assert.ok(wrongOrder.score <= 2, String(wrongOrder.score));
});
it('sw1 answers are compared with the engine table of the student run (extra ping changes it)', () => {
  const acts = SW1_ACTIONS.concat([pingA('sw1', 'pc3', 'pc1')]);
  assert.strictEqual(g.grade('sw1', { actions: acts, answers: { table: SW1_TABLE } }).score < 10, true);
  assert.strictEqual(g.grade('sw1', { actions: acts, answers: { table: Object.assign({}, SW1_TABLE, { pc3: 'fa0/3' }) } }).score, 10);
});

const SW2_OK = { reqPorts: ['fa0/2', 'fa0/3', 'gi0/1'], reqHosts: ['pcb', 'pcc', 'pcd'], repPort: 'fa0/1', arpMac: '0050.7966.0b0b', bHasA: true };
it('sw2 perfect = 10', () => {
  const r = g.grade('sw2', { actions: [pingA('sw2', 'pca', 'pcb')], answers: SW2_OK });
  assert.strictEqual(r.score, 10, r.feedback.join('\n'));
});
it('sw2 typical mistakes: broadcast "only to PC-B", reply flooded, ARP cache = broadcast MAC', () => {
  const r = g.grade('sw2', { actions: [pingA('sw2', 'pca', 'pcb')], answers: { reqPorts: ['fa0/2'], reqHosts: ['pcb'], repPort: 'gi0/1', arpMac: 'ffff.ffff.ffff', bHasA: false } });
  assert.strictEqual(r.score, 2);
  assert.ok(fbHas(r, /ข้อ 1: พอร์ตที่คุณเลือก \(Fa0\/2\) ไม่ถูกต้อง/)); assert.ok(fbHas(r, /ข้อ 4/));
  // 6.x: no answer key below full marks (feedback or details)
  const txt = JSON.stringify(r);
  assert.ok(!/Fa0\/3|fa0\/3/.test(txt), 'request flood ports not revealed'); assert.ok(!/PC-C|PC-D/.test(txt), 'receivers not revealed');
  assert.ok(!txt.includes('0050.7966.0b0b'), 'PC-B MAC (answer 4) not revealed'); assert.ok(!fbHas(r, /Fa0\/1/), 'reply port not revealed');
  assert.deepStrictEqual(r.details, { found: true, ok: { reqPorts: false, reqHosts: false, repPort: false, arpMac: false, bHasA: false } });
  const full = g.grade('sw2', { actions: [pingA('sw2', 'pca', 'pcb')], answers: SW2_OK });
  assert.strictEqual(full.details.arpMac, '0050.7966.0b0b', 'key returned on full marks');
});
it('sw2 without the ping = 0; ping with ARP already cached is not counted', () => {
  assert.strictEqual(g.grade('sw2', { actions: [], answers: SW2_OK }).score, 0);
  const r = g.grade('sw2', { actions: [pingA('sw2', 'pcb', 'pca'), pingA('sw2', 'pca', 'pcb')], answers: SW2_OK });
  assert.strictEqual(r.score, 0); assert.ok(fbHas(r, /ล้างตาราง/));
});

function sw3Good() {
  const c = cfgOf('sw3');
  c.sw1.vlans.push({ id: 10, name: 'LAB' }, { id: 20, name: 'OFFICE' });
  ['fa0/1', 'fa0/2', 'fa0/3'].forEach(p => { c.sw1.ifs[p].vlan = 10; });
  ['fa0/4', 'fa0/5', 'fa0/6'].forEach(p => { c.sw1.ifs[p].vlan = 20; });
  return c;
}
it('sw3 perfect = 10', () => { const r = g.grade('sw3', { config: sw3Good() }); assert.strictEqual(r.score, 10, r.feedback.join('\n')); });
it('sw3 untouched start = partial (pings work but broadcast leaks)', () => {
  const r = g.grade('sw3', { config: cfgOf('sw3') });
  assert.strictEqual(r.score, 3); assert.ok(fbHas(r, /broadcast จาก LAB1 ยังไปถึง/)); assert.ok(fbHas(r, /ยังไม่มี VLAN 10/));
});
it('sw3 one port in the wrong VLAN + wrong name: feedback names SW1 Fa0/3', () => {
  const c = sw3Good(); c.sw1.ifs['fa0/3'].vlan = 20; c.sw1.vlans.find(v => v.id === 20).name = 'Admin';
  const r = g.grade('sw3', { config: c });
  assert.ok(r.score >= 6 && r.score < 10, String(r.score));
  assert.ok(fbHas(r, /SW1 Fa0\/3 \(ต่อ LAB3\) อยู่ VLAN 20/)); assert.ok(fbHas(r, /ชื่อ "Admin"/)); assert.ok(fbHas(r, /LAB1 ping LAB3 ไม่ได้/));
});

function sw4Good() {
  const c = cfgOf('sw4');
  for (const s of ['sw1', 'sw2']) { c[s].vlans.push({ id: 99, name: 'NATIVE' }); Object.assign(c[s].ifs['gi0/1'], { mode: 'trunk', allowed: [10, 20, 99], native: 99 }); }
  return c;
}
it('sw4 perfect = 10 (allowed 10,20 or 10,20,99)', () => {
  assert.strictEqual(g.grade('sw4', { config: sw4Good() }).score, 10);
  const c = sw4Good(); c.sw1.ifs['gi0/1'].allowed = [10, 20]; c.sw2.ifs['gi0/1'].allowed = [10, 20];
  assert.strictEqual(g.grade('sw4', { config: c }).score, 10);
});
it('sw4 allowed all + native 1 mismatch: partial with Thai hygiene feedback', () => {
  const c = sw4Good(); c.sw1.ifs['gi0/1'].allowed = 'all'; c.sw2.ifs['gi0/1'].native = 1;
  const r = g.grade('sw4', { config: c });
  assert.ok(r.score >= 5 && r.score < 10, String(r.score));
  assert.ok(fbHas(r, /SW1 Gi0\/1 อนุญาตทุก VLAN/)); assert.ok(fbHas(r, /native VLAN ไม่ตรงกัน: SW1 Gi0\/1 = 99 แต่ SW2 Gi0\/1 = 1/));
});
it('sw4 only one side trunk: connectivity fails, explains the access side', () => {
  const c = sw4Good(); c.sw2.ifs['gi0/1'].mode = 'access';
  const r = g.grade('sw4', { config: c });
  assert.ok(r.score < 6, String(r.score)); assert.ok(fbHas(r, /SW2 Gi0\/1 ยังเป็น access/)); assert.ok(fbHas(r, /LAB1 ping LAB2 ไม่ได้/));
});
it('sw4 untouched = low score', () => { assert.ok(g.grade('sw4', { config: cfgOf('sw4') }).score <= 2); });

function sw5Good() {
  const c = cfgOf('sw5');
  for (const s of ['sw1', 'sw2', 'sw3']) c[s].stp.off = [];
  c.sw3.stp.prio = { 1: 4096 };
  return c;
}
const SW5_ACT = [pingA('sw5', 'pc1', 'pc2')];
it('sw5 perfect: STP on, SW3 root, blocked SW2 Gi0/1, ping ok = 10', () => {
  const r = g.grade('sw5', { config: sw5Good(), actions: SW5_ACT, answers: { blocked: 'sw2|gi0/1' } });
  assert.strictEqual(r.score, 10, r.feedback.join('\n')); assert.deepStrictEqual(r.details.blocked, ['sw2|gi0/1']);
});
it('sw5 STP on but default root (SW1): partial, names the real root and the real blocked port', () => {
  const c = sw5Good(); c.sw3.stp.prio = {};
  const r = g.grade('sw5', { config: c, actions: SW5_ACT, answers: { blocked: 'sw2|gi0/1' } });
  assert.strictEqual(r.score, 4.5);
  assert.ok(fbHas(r, /Root Bridge ตอนนี้คือ SW1/)); assert.ok(fbHas(r, /พอร์ตที่คุณระบุ \(SW2 Gi0\/1\) ไม่ใช่พอร์ตที่ถูก block/));
  assert.ok(!fbHas(r, /SW3 Gi0\/2/), '6.x: the real blocked port is not revealed'); assert.ok(r.details.blocked === undefined && r.details.blockedOk === false);
});
it('sw5 STP still off: storm, low score', () => {
  const r = g.grade('sw5', { config: cfgOf('sw5'), actions: SW5_ACT, answers: { blocked: 'sw2|gi0/1' } });
  assert.strictEqual(r.score, 0); assert.ok(fbHas(r, /broadcast storm/)); assert.ok(fbHas(r, /ยังปิด Spanning Tree/));
});
it('sw5 no proof ping after the change loses the proof points', () => {
  const r = g.grade('sw5', { config: sw5Good(), actions: [], answers: { blocked: 'sw2|gi0/1' } });
  assert.strictEqual(r.score, 7); assert.ok(fbHas(r, /ยังไม่มีหลักฐาน/));
});
it('sw5 priority that is not a multiple of 4096 is rejected', () => {
  const c = sw5Good(); c.sw3.stp.prio = { 1: 100 };
  const r = g.grade('sw5', { config: c, actions: SW5_ACT, answers: { blocked: 'sw2|gi0/1' } });
  assert.strictEqual(r.score, 0); assert.ok(fbHas(r, /ผลคูณของ 4096/));
});

function sw6Good() {
  const c = cfgOf('sw6');
  c.sw1.ifs['fa0/2'].vlan = 10; c.sw2.ifs['gi0/1'].allowed = [10, 20, 99]; c.sw2.ifs['gi0/1'].native = 99;
  return c;
}
it('sw6 perfect fix = 10', () => { const r = g.grade('sw6', { config: sw6Good() }); assert.strictEqual(r.score, 10, r.feedback.join('\n')); });
it('sw6 untouched: partial, feedback names the drops and the wrong port', () => {
  const r = g.grade('sw6', { config: cfgOf('sw6') });
  assert.ok(r.score < 5, String(r.score));
  assert.ok(fbHas(r, /SW1 Fa0\/2 \(ต่อ LAB2\) อยู่ VLAN 20/));
  assert.ok(fbHas(r, /SW2 Gi0\/1 ทิ้งเฟรม VLAN 20: VLAN นี้ไม่อยู่ใน allowed VLAN list/));
  assert.ok(fbHas(r, /native VLAN ไม่ตรงกัน/));
});
it('sw6 two of three fixed (native still mismatched) = 8.5', () => {
  const c = sw6Good(); c.sw2.ifs['gi0/1'].native = 1;
  assert.strictEqual(g.grade('sw6', { config: c }).score, 8.5);
});
it('sw6 "fix" by moving everything to VLAN 1 is penalised', () => {
  const c = cfgOf('sw6');
  for (const s of ['sw1', 'sw2']) { ['fa0/1', 'fa0/2', 'fa0/3'].forEach(p => { c[s].ifs[p].vlan = 1; }); c[s].ifs['gi0/1'] = Object.assign(c[s].ifs['gi0/1'], { allowed: 'all', native: 1 }); }
  const r = g.grade('sw6', { config: c });
  assert.ok(r.score <= 4, String(r.score)); assert.ok(fbHas(r, /ห้ามแก้ด้วยการย้ายเครื่องไป VLAN 1/));
});

const SW7 = { actions: [pingA('sw7', 'pc1', 'pc2'), pingA('sw7', 'pc5', 'pc6')], answers: { cdHub: 1, cdSw: 4, recvHub: ['pc2', 'pc3', 'pc4'], recvSw: ['pc6'] } };
it('sw7 perfect = 10', () => { const r = g.grade('sw7', SW7); assert.strictEqual(r.score, 10, r.feedback.join('\n')); });
it('sw7 typical misconceptions (hub = switch) get partial with explanation', () => {
  const r = g.grade('sw7', { actions: SW7.actions, answers: { cdHub: 4, cdSw: 1, recvHub: ['pc2'], recvSw: ['pc6', 'pc7', 'pc8'] } });
  assert.strictEqual(r.score, 2);
  assert.ok(fbHas(r, /ฝั่ง Hub: เครื่องที่คุณเลือก.*\(PC2\) ไม่ถูกต้อง/)); assert.ok(fbHas(r, /collision domain ฝั่ง Switch ที่คุณตอบ \(1\) ไม่ถูกต้อง/));
  // 6.x: no counts or receiver lists from the answer key below full marks
  assert.ok(!fbHas(r, /PC3|PC4/) && !fbHas(r, /คือ [14]\b/));
  assert.deepStrictEqual(r.details, { ok: { cdHub: false, cdSw: false, recvHub: false, recvSw: false } });
  assert.strictEqual(g.grade('sw7', SW7).details.cdSw, 4, 'key returned on full marks');
});
it('sw4 hint 3: native VLANs come from show interfaces trunk, the CDP mismatch text is a console log (6.x)', () => {
  const h = M('sw4').hints[2];
  assert.ok(/show interfaces trunk/.test(h) && /%CDP-4-NATIVE_VLAN_MISMATCH/.test(h) && /console/.test(h));
});
it('sw7 answers without pinging cannot reach full score', () => {
  const r = g.grade('sw7', { actions: [], answers: SW7.answers });
  assert.ok(r.score <= 2, String(r.score));
});

it('tampered / oversized / malformed payloads = 0 without throwing (every mission)', () => {
  const big = { actions: Array.from({ length: 81 }, () => ({ op: 'ping', src: 'pc1', dst: '1.1.1.1' })) };
  const huge = { answers: { x: 'a'.repeat(70000) } };
  const bads = [undefined, null, 5, 'x', [], { actions: 'x' }, { answers: [] }, big, huge, { config: 'x' },
    { config: { sw1: { ifs: { 'fa0/1': { mode: 'router' } } } } }, { config: { sw1: { stp: { prio: { 1: -4096 } } } } },
    { config: { sw1: { vlans: [{ id: 10, name: '<script>' + 'x'.repeat(40) }] } } }];
  for (const m of g.missions) for (const p of bads) {
    let r;
    assert.doesNotThrow(() => { r = g.grade(m.id, p); });
    if (m.start.lock && p && p.config !== undefined && !Array.isArray(p) && typeof p === 'object' && p.actions === undefined && p.answers === undefined) continue;   // locked missions ignore config
    assert.strictEqual(r.score, 0, m.id + ' ' + String(JSON.stringify(p)).slice(0, 80));
    assert.ok(r.feedback.length && typeof r.feedback[0] === 'string');
  }
  assert.strictEqual(g.grade('nope', {}).score, 0);
  // a client-claimed score is ignored
  assert.strictEqual(g.grade('sw3', { score: 10, ok: true, config: cfgOf('sw3') }).score, 3);
  // junk actions and answers types do not throw
  const r = g.grade('sw1', { actions: [null, 5, { op: 'ping', src: { x: 1 }, dst: ['a'] }, { op: 'rm -rf' }], answers: { table: { pc1: { a: 1 }, __proto__: 'x' } } });
  assert.strictEqual(r.score, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
