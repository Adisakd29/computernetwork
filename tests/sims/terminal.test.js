// Tests for the Network Terminal Simulator grader: node tests/sims/terminal.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const g = require('../../server/sims/terminal.js');
const NetSim = require(path.join(__dirname, '../../public/js/sim/netsim.js'));

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', (e && e.stack || String(e)).split('\n').slice(0, 6).join('\n      ')); }
}
const M = id => g.missions.find(m => m.id === id);
const net = id => NetSim.create(JSON.parse(JSON.stringify(M(id).start.topo)));
const fbHas = (r, re) => r.feedback.some(f => re.test(f));
// a command list that satisfies every mission's "appropriate command" bonus
const ALL_CMDS = ['ipconfig /all', 'arp -a', 'ping 10.10.1.1', 'ip a', 'ip route', 'cat /etc/resolv.conf', 'nslookup x', 'tracert 8.8.8.8',
  'netstat -an', 'ip link set eth0 up', 'traceroute 192.168.1.10'];
const full = id => ({ answers: Object.assign({}, g._keys[id]), commandsUsed: ALL_CMDS });

console.log('terminal grader');

it('module shape follows SIM-SPEC §2 (6-8 missions, Windows + Linux, no answers in start)', () => {
  assert.strictEqual(g.id, 'terminal');
  assert.ok(g.missions.length >= 6 && g.missions.length <= 8);
  const oses = new Set();
  for (const m of g.missions) {
    assert.strictEqual(m.max, 10);
    assert.ok(m.title && m.desc && m.hints.length && ['easy', 'medium', 'hard'].includes(m.level));
    assert.ok(m.start.story && m.start.topo && m.start.hosts.length && m.start.questions.length);
    m.start.hosts.forEach(h => oses.add(h.os));
    const pub = JSON.stringify(m);
    m.start.questions.forEach(q => { assert.deepStrictEqual(Object.keys(q).sort(), ['id', 'q', 'type']); });
    assert.ok(!/"key"|"tip"|"good"/.test(pub), 'no answer material in public mission ' + m.id);
    assert.deepStrictEqual(NetSim.create(m.start.topo).problems().filter(p => p.level === 'error'), [], m.id + ' topology has errors');
  }
  assert.ok(oses.has('windows') && oses.has('linux'));
  assert.ok(g.missions.some(m => m.start.hosts.length >= 2), 'at least one mission with host switching');
});

it('answer keys are what NetSim shows (independent recomputation)', () => {
  let n = net('m1'); let c = n.config('pc05');
  assert.deepStrictEqual(g._keys.m1, { ip: c.ip, mask: c.mask, gw: c.gateway, dns: c.dns[0] });
  assert.strictEqual(g._keys.m1.ip, '192.168.2.25');
  n = net('m2'); c = n.config('pc12');
  assert.strictEqual(c.dhcp, true); assert.strictEqual(g._keys.m2.mode, 'dhcp');
  assert.strictEqual(g._keys.m2.ip, c.ip); assert.strictEqual(g._keys.m2.dhcpsrv, n.config(c.leaseFrom).ip); assert.strictEqual(g._keys.m2.mac, c.mac);
  n = net('m3'); n.ping('acc07', '10.10.1.1');
  assert.strictEqual(g._keys.m3.gwmac, n.arp('acc07').find(e => e.ip === '10.10.1.1').mac);
  assert.strictEqual(g._keys.m3.prnttl, '64');
  assert.strictEqual(g._keys.m3.netttl, String(net('m3').ping('acc07', '8.8.8.8').ttl));
  n = net('m4');
  assert.strictEqual(g._keys.m4.ip, '172.16.9.20'); assert.strictEqual(NetSim.ip.toPrefix(g._keys.m4.prefix), 26);
  assert.strictEqual(g._keys.m4.gw, n.routes('lab09').find(r => r.prefix === 0).via);
  assert.strictEqual(g._keys.m4.moodle, n.nslookup('lab09', 'moodle.lab.local').ip);
  const tr = net('m5').traceroute('b204', '8.8.8.8');
  assert.strictEqual(g._keys.m5.hop2, tr.hops[1].ip); assert.strictEqual(g._keys.m5.hop2, '10.20.255.1');
  assert.strictEqual(g._keys.m5.hops, String(tr.hops.length));
  assert.strictEqual(g._keys.m6.rdp, '3389'); assert.strictEqual(g._keys.m6.who, '192.168.30.45');
  assert.strictEqual(g._keys.m7.iface, 'eth0');
  assert.ok(net('m7').config('ws07').up === false, 'm7 starts with eth0 down');
  const t7 = JSON.parse(JSON.stringify(M('m7').start.topo)); t7.devices.find(d => d.id === 'ws07').ifaces[0].up = true;
  assert.strictEqual(g._keys.m7.ip, NetSim.create(t7).config('ws07').ip);
  n = net('m8'); n.ping('pca', '192.168.2.20');
  assert.strictEqual(g._keys.m8.arpmac, n.arp('pca').find(e => e.ip === '192.168.1.1').mac);
  assert.strictEqual(g._keys.m8.ttl, '63');
});

it('full-score payload for every mission = 10/10', () => {
  for (const m of g.missions) {
    const r = g.grade(m.id, full(m.id));
    assert.strictEqual(r.score, 10, m.id + ': ' + r.feedback.join(' | '));
    assert.strictEqual(r.ok, true);
  }
});

it('normalises IPs, MACs, masks, ports and commands', () => {
  const r1 = g.grade('m1', { answers: { ip: ' 192.168.002.025/24 ', mask: '/24', gw: '192.168.2.1', dns: '192.168.2.5' }, commandsUsed: ['IPCONFIG /ALL'] });
  assert.strictEqual(r1.score, 10, r1.feedback.join('|'));
  const r2 = g.grade('m2', { answers: { mode: 'ใช่', ip: '192.168.5.101(Preferred)', dhcpsrv: '192.168.5.10', mac: 'd4:be:d9:11:05:12' }, commandsUsed: ['ipconfig /all'] });
  assert.strictEqual(r2.score, 10, r2.feedback.join('|'));
  const r6 = g.grade('m6', { answers: { rdp: ':3389', who: '192.168.30.45', sql: 'TCP 1433', srcport: '51744' }, commandsUsed: ['netstat -an'] });
  assert.strictEqual(r6.score, 10, r6.feedback.join('|'));
  for (const cmd of ['sudo ip link set eth0 up', 'ip link set dev eth0 up', 'IP  LINK SET eth0 UP', 'ifup eth0']) {
    const r = g.grade('m7', { answers: Object.assign({}, g._keys.m7, { cmd }), commandsUsed: ALL_CMDS });
    assert.strictEqual(r.score, 10, cmd);
  }
});

it('wrong answers lose that question only, with a tip but without the answer', () => {
  const p = full('m5'); p.answers.hop2 = '10.20.4.1';
  const r = g.grade('m5', p);
  assert.strictEqual(r.score, 10 - 9 / 4);
  assert.strictEqual(r.details.questions.hop2, false);
  assert.ok(fbHas(r, /ข้อ 2: ยังไม่ถูกต้อง — ใช้ tracert/));
  assert.ok(!r.feedback.join(' ').includes('10.20.255.1'), 'feedback must not reveal the key');
  const p2 = full('m7'); p2.answers.cmd = 'ip link set eth0 down'; p2.answers.ip = '';
  const r2 = g.grade('m7', p2);
  assert.strictEqual(r2.score, 10 - 2 * 9 / 4);
  assert.ok(fbHas(r2, /ข้อ 3: ยังไม่ได้ตอบ/));
  const p3 = full('m2'); p3.answers.mac = 'zz-zz'; const r3 = g.grade('m2', p3);
  assert.ok(fbHas(r3, /รูปแบบคำตอบไม่ถูกต้อง/)); assert.strictEqual(r3.score, 10 - 9 / 4);
});

it('command bonus: none = -1, partial = -0.5', () => {
  const a = { answers: g._keys.m4 };
  assert.strictEqual(g.grade('m4', Object.assign({}, a, { commandsUsed: [] })).score, 9);
  const r = g.grade('m4', Object.assign({}, a, { commandsUsed: ['ip a'] }));
  assert.strictEqual(r.score, 9.5); assert.ok(fbHas(r, /ควรใช้ ip route/));
  assert.strictEqual(g.grade('m4', Object.assign({}, a, { commandsUsed: ['ip a', 'ip route', 'dig +short moodle.lab.local'] })).score, 10);
});

it('malformed payloads score 0 and never throw', () => {
  const bad = [null, undefined, 42, 'x', [], {}, { answers: null }, { answers: [] }, { answers: 'x' }, { answers: { ip: { $gt: 1 } }, commandsUsed: 'ipconfig' },
    { answers: { ip: 'a'.repeat(100000) }, commandsUsed: new Array(5000).fill(7) }];
  for (const p of bad) {
    const r = g.grade('m1', p);
    assert.strictEqual(r.score, 0, JSON.stringify(p && p.answers || null).slice(0, 40));
    assert.ok(Array.isArray(r.feedback) && r.feedback.length);
  }
  assert.strictEqual(g.grade('m1', {}).score, 0);
  assert.strictEqual(g.grade('nope', full('m1')).score, 0);
  assert.strictEqual(g.grade('m1', { answers: {}, commandsUsed: ['ipconfig /all'] }).score, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
