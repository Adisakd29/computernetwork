// Tests for the IPv6 lab (engine + grader): node tests/sims/ipv6.test.js
'use strict';
const assert = require('assert');
const g = require('../../server/sims/ipv6.js');
const V = require('../../public/js/sim/ipv6.js');

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message); }
}
const W = s => { const p = V.parse(s); assert.ok(p.ok, s + ': ' + p.err); return p.w; };
const comp = s => V.compress(W(s));
const fbHas = (r, re) => r.feedback.some(f => re.test(f));
let seed = 7;
const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const net = (mission, cfg) => V.create(V.applyConfig(V.MT[mission], cfg || {}));

console.log('IPv6 address tools');

it('RFC 5952 examples: leading zeros, longest run, single 0 group, lowercase', () => {
  assert.strictEqual(comp('2001:0db8:0000:0000:0000:ff00:0042:8329'), '2001:db8::ff00:42:8329');
  assert.strictEqual(comp('2001:db8:0:0:1:0:0:1'), '2001:db8::1:0:0:1');            // tie -> first run (4.2.3)
  assert.strictEqual(comp('2001:0:0:1:0:0:0:1'), '2001:0:0:1::1');                // longest run wins
  assert.strictEqual(comp('2001:db8:0:1:1:1:1:1'), '2001:db8:0:1:1:1:1:1');        // single 0 group not compressed (4.2.2)
  assert.strictEqual(comp('2001:DB8::AB:CD'), '2001:db8::ab:cd');                  // lowercase (4.3)
  assert.strictEqual(comp('2001:db8::0001'), '2001:db8::1');
});

it('compression edge cases: all zeros, loopback, run at start and end', () => {
  assert.strictEqual(comp('0:0:0:0:0:0:0:0'), '::');
  assert.strictEqual(comp('0:0:0:0:0:0:0:1'), '::1');
  assert.strictEqual(comp('1:0:0:0:0:0:0:0'), '1::');
  assert.strictEqual(comp('0:0:1:0:0:0:1:0'), '0:0:1::1:0');
  assert.strictEqual(comp('fe80:0000:0000:0000:0214:22ff:fe01:0b11'), 'fe80::214:22ff:fe01:b11');
});

it('expansion to 8 groups x 4 digits', () => {
  assert.strictEqual(V.expand(W('2001:db8::1')), '2001:0db8:0000:0000:0000:0000:0000:0001');
  assert.strictEqual(V.expand(W('::')), '0000:0000:0000:0000:0000:0000:0000:0000');
  assert.strictEqual(V.expand(W('ff02::1:ff00:1')), 'ff02:0000:0000:0000:0000:0001:ff00:0001');
  assert.strictEqual(V.expand(W('1::')), '0001:0000:0000:0000:0000:0000:0000:0000');
});

it('parse accepts uppercase, embedded IPv4 and zone IDs only when allowed', () => {
  assert.deepStrictEqual(W('::ffff:192.0.2.1'), [0, 0, 0, 0, 0, 0xffff, 0xc000, 0x0201]);
  assert.ok(!V.parse('fe80::1%eth0').ok);
  const z = V.parse('fe80::1%eth0', { zone: true });
  assert.ok(z.ok); assert.strictEqual(z.zone, 'eth0');
});

it('validation: precise Thai error messages for bad input', () => {
  const err = s => { const p = V.parse(s); assert.ok(!p.ok, s + ' should be invalid'); return p.err; };
  assert.match(err('2001:db8::1::1'), /:: ได้เพียงครั้งเดียว/);
  assert.match(err('2001:db8:::1'), /:::/);
  assert.match(err('2001:db8::12345'), /"12345" มี 5 หลัก เกิน 4 หลัก/);
  assert.match(err('2001:db8::g1'), /"g" ซึ่งไม่ใช่เลขฐาน 16/);
  assert.match(err('1:2:3:4:5:6:7'), /มีเพียง 7 กลุ่ม/);
  assert.match(err('1:2:3:4:5:6:7:8:9'), /9 กลุ่ม เกิน 8 กลุ่ม/);
  assert.match(err('1:2:3:4:5:6:7::8'), /มี :: แต่กลุ่มที่เขียนไว้มี 8 กลุ่มแล้ว/);
  assert.match(err(':1:2:3:4:5:6:7'), /ขึ้นต้นด้วย : ตัวเดียว/);
  assert.match(err('1:2:3:4:5:6:7:'), /ลงท้ายด้วย : ตัวเดียว/);
  assert.match(err('2001:db8::/64'), /prefix length/);
  assert.match(err(''), /ยังไม่ได้กรอก/);
  assert.match(err('192.168.1.1'), /ไม่มีเครื่องหมาย :/);
  assert.match(err('::1.2.3.400'), /IPv4/);
  assert.match(err('2001:db8 ::1'), /ช่องว่าง/);
  assert.ok(!V.parse(null).ok && !V.parse(42).ok);
});

it('type detection for every class', () => {
  const t = s => V.typeOf(W(s));
  assert.strictEqual(t('2001:db8::1'), 'global');
  assert.strictEqual(t('3fff::1'), 'global');
  assert.strictEqual(t('fe80::1'), 'link-local');
  assert.strictEqual(t('febf::1'), 'link-local');
  assert.strictEqual(t('fec0::1'), 'reserved');      // deprecated site-local is not link-local
  assert.strictEqual(t('fd12:3456::1'), 'unique-local');
  assert.strictEqual(t('fc00::1'), 'unique-local');
  assert.strictEqual(t('ff02::1'), 'multicast');
  assert.strictEqual(t('::1'), 'loopback');
  assert.strictEqual(t('::'), 'unspecified');
  assert.strictEqual(t('::ffff:10.0.0.1'), 'ipv4-mapped');
});

it('prefix / network part for /64, /48 and odd lengths', () => {
  assert.strictEqual(V.compress(V.network(W('2001:db8:acad:1:214:22ff:fe01:b11'), 64)), '2001:db8:acad:1::');
  assert.strictEqual(V.compress(V.network(W('2001:db8:acad:1::20'), 48)), '2001:db8:acad::');
  assert.strictEqual(V.compress(V.network(W('2001:db8:abcd:ffff::1'), 52)), '2001:db8:abcd:f000::');
  assert.ok(V.inPrefix(W('2001:db8:acad:2::10'), W('2001:db8:acad::'), 48));
  assert.ok(!V.inPrefix(W('2001:db8:acad:2::10'), W('2001:db8:acad:1::'), 64));
  const c = V.parseCidr('2001:db8:20::5/64');
  assert.ok(c.ok && c.hostBits && c.len === 64 && V.compress(c.w) === '2001:db8:20::');
  assert.ok(!V.parseCidr('2001:db8::').ok && !V.parseCidr('2001:db8::/129').ok);
});

it('EUI-64: insert fffe and flip the U/L bit (both directions)', () => {
  const ll = m => V.compress(V.linkLocal(V.parseMac(m).b));
  assert.strictEqual(ll('00:1a:2b:3c:4d:5e'), 'fe80::21a:2bff:fe3c:4d5e');     // 00 -> 02
  assert.strictEqual(ll('52:54:00:12:34:56'), 'fe80::5054:ff:fe12:3456');      // 52 -> 50 (bit was 1)
  assert.strictEqual(ll('3C-52-82-4F-61-22'), 'fe80::3e52:82ff:fe4f:6122');    // dash format, uppercase
  assert.strictEqual(ll('0014.22a1.0b11'), 'fe80::214:22ff:fea1:b11');          // Cisco dotted format
  assert.deepStrictEqual(V.eui64([0x02, 0x42, 0xac, 0x11, 0x00, 0x02]), [0x0042, 0xacff, 0xfe11, 0x0002]);
  assert.ok(!V.parseMac('00:1a:2b:3c:4d').ok);
  assert.strictEqual(V.compress(V.solicited(W('2001:db8::abcd:1234'))), 'ff02::1:ffcd:1234');
});

it('canonIssues names the broken RFC 5952 rule', () => {
  const iss = s => V.canonIssues(s, V.parse(s)).join(' | ');
  assert.match(iss('2001:DB8::1'), /ตัวพิมพ์เล็ก/);
  assert.match(iss('2001:0db8::1'), /0 นำหน้า/);
  assert.match(iss('2001:db8:0:0:0:0:0:1'), /ยังไม่ได้ใช้ ::/);
  assert.match(iss('2001:db8::1:1:1:1:1'), /กลุ่มเดียว/);
  assert.match(iss('2001:0:0:1::1'), /^$/);
  assert.match(iss('2001::1:0:0:0:1'), /ยาวที่สุด/);
  assert.match(iss('2001:db8:0:0:1::1'), /ช่วงแรก/);
  assert.match(iss('2001:db8:0::1'), /ทั้งหมดในช่วงนั้น/);
  assert.deepStrictEqual(V.expandIssues('2001:db8:0:0:0:0:0:1', V.parse('2001:db8:0:0:0:0:0:1')).length, 1);
});

console.log('IPv6 network engine');

const V3OK = { R1: { ifaces: { 'g0/0': { addr: '2001:db8:10::1', len: '64', ra: true }, 'g0/1': { addr: '2001:db8:20::1', len: '64', ra: true } } } };

it('every interface gets an EUI-64 link-local; routers may use a manual one', () => {
  const n = net('v3');
  assert.strictEqual(n.iface('PC1').ll, 'fe80::214:22ff:fea1:b11');
  assert.strictEqual(n.iface('R1', 'g0/0').ll, 'fe80::21a:2bff:fe10:1');
  assert.strictEqual(V.create(V.MT.v4).iface('R2', 'g0/1').ll, 'fe80::2');
  assert.strictEqual(n.primary('PC1'), null);
  assert.ok(n.iface('PC1').notes.some(x => x.code === 'no_ra'));
});

it('SLAAC: RA /64 -> prefix + EUI-64, gateway = router link-local', () => {
  const n = net('v3', V3OK);
  const s = n.iface('PC4');
  assert.strictEqual(n.primary('PC4'), '2001:db8:20:0:ba27:ebff:fe12:3444');
  assert.strictEqual(s.gw.addr, 'fe80::21a:2bff:fe10:2'); assert.strictEqual(s.gw.src, 'ra');
  assert.deepStrictEqual(n.iface('R1', 'g0/1').raPrefixes, ['2001:db8:20::/64']);
});

it('SLAAC: RA disabled -> no global address; RA with /48 -> no SLAAC (ra_len)', () => {
  const off = net('v3', { R1: { ifaces: { 'g0/0': { addr: '2001:db8:10::1', len: '64', ra: false } } } });
  assert.strictEqual(off.primary('PC1'), null);
  assert.strictEqual(off.ping('PC1', '2001:db8:10::1').code, 'no_ra');
  const l48 = net('v3', { R1: { ifaces: { 'g0/0': { addr: '2001:db8:10::1', len: '48', ra: true } } } });
  assert.strictEqual(l48.primary('PC1'), null);
  assert.ok(l48.iface('PC1').notes.some(x => x.code === 'ra_len'));
  assert.strictEqual(l48.ping('PC1', '2001:db8:10::1').code, 'ra_len');
});

it('static addressing with prefix length and gateway; host in static mode ignores RA', () => {
  const n = net('v3', Object.assign({}, V3OK, { PC1: { ifaces: { eth0: { mode: 'static', addr: '2001:db8:10::50', len: '64', gw: 'fe80::21a:2bff:fe10:1' } } } }));
  const s = n.iface('PC1');
  assert.deepStrictEqual(s.addrs.filter(a => a.origin !== 'link-local').map(a => a.addr + '/' + a.len + ' ' + a.origin), ['2001:db8:10::50/64 static']);
  assert.ok(n.ping('PC1', n.primary('PC3')).ok);
  const bad = net('v3', { PC1: { ifaces: { eth0: { mode: 'static', addr: '2001:db8:10::zz', len: '64' } } } });
  assert.ok(bad.iface('PC1').notes.some(x => x.code === 'bad_addr' && /"z"/.test(x.text)));
  const ll = net('v3', { PC1: { ifaces: { eth0: { mode: 'static', addr: 'fe80::99', len: '64' } } } });
  assert.ok(ll.iface('PC1').notes.some(x => x.code === 'addr_type'));
});

it('DAD: the later interface loses a duplicate global; Windows shows (Duplicate)', () => {
  const n = V.create(V.MT.v5);
  const pc4 = n.iface('PC4'), srv = n.iface('SRV');
  assert.strictEqual(srv.addrs.find(a => a.origin === 'static').state, 'preferred');
  assert.strictEqual(pc4.addrs.find(a => a.origin === 'static').state, 'duplicate');
  assert.ok(n.show('PC4').lines.some(l => /\(Duplicate\)/.test(l)));
  assert.strictEqual(n.ping('PC4', '2001:db8:acad:2::1').code, 'dad');
  assert.strictEqual(n.dupCount(), 1);
  // reconfiguring SRV later makes SRV the one that fails DAD
  const m = V.create(V.applyConfig(V.MT.v5, { SRV: { ifaces: { eth0: { t: 9 } } } }));
  assert.strictEqual(m.iface('SRV').addrs.find(a => a.origin === 'static').state, 'duplicate');
});

it('DAD on link-local: duplicate manual link-local disables IPv6 on the later interface', () => {
  const topo = V.applyConfig(V.MT.v3, { R1: { ifaces: { 'g0/0': { ll: 'fe80::214:22ff:fea1:b11', addr: '2001:db8:10::1', len: '64', ra: true } } } });
  const n = V.create(topo);
  assert.ok(n.iface('R1', 'g0/0').v6off === false);    // R1 is configured first (device order) -> PC1 loses
  assert.ok(n.iface('PC1').v6off);
  assert.strictEqual(n.ping('PC1', '2001:db8:10::1').code, 'dad_ll');
});

it('ping6 on the same link: NS/NA trace and neighbor cache entries', () => {
  const n = net('v3', V3OK);
  const r = n.ping('PC1', n.primary('PC2'));
  assert.ok(r.ok, r.text);
  assert.ok(r.trace.some(t => t.k === 'ns' && /ff02::1:ff/.test(t.t)));
  assert.ok(r.trace.some(t => t.k === 'na' && /3c:52:82:4f:61:22/.test(t.t)));
  assert.ok(n.neighbors('PC1').some(e => e.state === 'REACHABLE' && e.mac === '3c:52:82:4f:61:22'));
  assert.ok(n.neighbors('PC2').some(e => e.mac === '00:14:22:a1:0b:11'));
  const again = n.ping('PC1', n.primary('PC2'));
  assert.ok(again.trace.some(t => t.k === 'nc'));     // second ping uses the cache, no NS
  assert.ok(n.ping('PC1', n.iface('PC2').ll).ok);       // link-local ping on the same link
  assert.ok(n.ping('PC1', 'fe80::21a:2bff:fe10:1').ok); // router link-local answers on its own interface
});

it('ping6 across the router; output in Windows and Linux style', () => {
  const n = net('v3', V3OK);
  const r = n.ping('PC1', n.primary('PC4'));
  assert.ok(r.ok); assert.deepStrictEqual(r.path, ['PC1', 'R1', 'PC4']);
  assert.ok(r.out.some(l => /^Reply from 2001:db8:20:/.test(l)));
  const l = n.ping('PC4', n.primary('PC1'));
  assert.ok(l.out[0].startsWith('$ ping6') && l.out.some(x => /ttl=63/.test(x)));
});

it('ping6 failure reasons: wrong prefix length, gateway not on link, no route, link-local off-link', () => {
  const n = V.create(V.MT.v5);
  assert.strictEqual(n.ping('PC2', '2001:db8:acad:2::10').code, 'wrong_prefix');
  assert.ok(n.ping('PC2', '2001:db8:acad:2::10').out.some(x => /Destination host unreachable/.test(x)));
  assert.strictEqual(n.ping('PC3', '2001:db8:acad:1::20').code, 'gw_not_onlink');
  const v4 = net('v4', { SRV1: { ifaces: { eth0: { addr: '2001:db8:1::10', len: '64', gw: 'fe80::1' } } } });
  const nr = v4.ping('SRV1', v4.primary('PC2'));
  assert.strictEqual(nr.code, 'no_route'); assert.strictEqual(nr.at, 'R1');
  assert.strictEqual(n.ping('PC3', 'fe80::21a:2bff:fe50:1').code, 'll_offlink');
  assert.strictEqual(n.ping('PC3', 'ff02::1').code, 'bad_target');
  assert.strictEqual(n.ping('PC3', 'hello').code, 'bad_target');
});

it('ping6 failure reasons: gateway unreachable, gateway is a host, reply path broken', () => {
  const gwx = net('v3', Object.assign({}, V3OK, { PC1: { ifaces: { eth0: { mode: 'static', addr: '2001:db8:10::50', len: '64', gw: 'fe80::dead' } } } }));
  assert.strictEqual(gwx.ping('PC1', gwx.primary('PC3')).code, 'gw_unreachable');
  const gwh = net('v3', Object.assign({}, V3OK, { PC1: { ifaces: { eth0: { mode: 'static', addr: '2001:db8:10::50', len: '64', gw: 'fe80::3e52:82ff:fe4f:6122' } } } }));
  assert.strictEqual(gwh.ping('PC1', gwh.primary('PC3')).code, 'gw_not_router');
  // only R1 has a route: request reaches SRV2, reply has no way back
  const one = net('v4', { SRV1: { ifaces: { eth0: { addr: '2001:db8:1::10', len: '64', gw: 'fe80::1' } } }, R1: { routes: [{ prefix: '2001:db8:2::/64', via: '2001:db8:ff::2' }] } });
  const r = one.ping('SRV1', one.primary('PC2'));
  assert.strictEqual(r.code, 'no_route'); assert.strictEqual(r.dir, 'back'); assert.strictEqual(r.at, 'R2');
});

it('static routes: link-local next hop needs an interface; global next hop must be on a connected net', () => {
  const n = net('v4', { R1: { routes: [{ prefix: '2001:db8:2::/64', via: 'fe80::2' }, { prefix: '2001:db8:3::/64', via: '2001:db8:99::1' }, { prefix: 'xx', via: 'fe80::2', iface: 'g0/1' }, { prefix: '2001:db8:4::/64', via: 'fe80::2', iface: 'g9/9' }] } });
  const rt = n.routes('R1').filter(r => r.type === 'S');
  assert.ok(!rt[0].valid && /ต้องระบุ interface/.test(rt[0].why));
  assert.ok(!rt[1].valid && /ไม่อยู่ในวงที่ต่อตรง/.test(rt[1].why));
  assert.ok(!rt[2].valid && /prefix ไม่ถูกต้อง/.test(rt[2].why));
  assert.ok(!rt[3].valid && /ไม่มี interface/.test(rt[3].why));
  const ok = net('v4', { R1: { routes: [{ prefix: '2001:db8:2::/64', via: 'fe80::2', iface: 'g0/1' }] } });
  assert.ok(ok.routes('R1').find(r => r.type === 'S').valid);
});

it('routing loop is stopped by the hop limit', () => {
  const n = net('v4', { SRV1: { ifaces: { eth0: { addr: '2001:db8:1::10', len: '64', gw: 'fe80::1' } } },
    R1: { routes: [{ prefix: '2001:db8:3::/64', via: '2001:db8:ff::2' }] }, R2: { routes: [{ prefix: '2001:db8:3::/64', via: '2001:db8:ff::1' }] } });
  assert.strictEqual(n.ping('SRV1', '2001:db8:3::1').code, 'hop_limit');
});

it('applyConfig accepts only whitelisted fields (no new devices, MACs or links)', () => {
  const t = V.applyConfig(V.MT.v3, { R1: { ifaces: { 'g0/0': { mac: 'aa:aa:aa:aa:aa:aa', link: 'LAN2', addr: '2001:db8:10::1', ra: 'yes' } } }, EVIL: { ifaces: {} }, PC1: { ifaces: { eth0: { mode: 'static', t: -5, addr: 'x'.repeat(500) } } } });
  const r = t.devices.find(d => d.id === 'R1').ifaces[0];
  assert.strictEqual(r.mac, '00:1a:2b:10:00:01'); assert.strictEqual(r.link, 'LAN1'); assert.strictEqual(r.ra, false);
  assert.strictEqual(t.devices.length, 5);
  const p = t.devices.find(d => d.id === 'PC1').ifaces[0];
  assert.strictEqual(p.t, 0); assert.strictEqual(p.addr.length, 64);
  assert.strictEqual(V.MT.v3.devices[0].ifaces[0].addr, '');        // base topology untouched
  assert.doesNotThrow(() => V.create({ devices: 'x', links: 5 }));
  assert.doesNotThrow(() => V.create(null).ping('X', '::1'));
});

it('neighbor cache import keeps only entries that are still true', () => {
  const a = net('v3', V3OK);
  a.ping('PC1', a.primary('PC2'));
  const b = net('v3', Object.assign({}, V3OK, { PC2: { ifaces: { eth0: { up: false } } } }));
  b.importNeighbors(a.exportNeighbors());
  assert.ok(!b.neighbors('PC1').some(e => e.state === 'REACHABLE'));
  const c = net('v3', V3OK); c.importNeighbors(a.exportNeighbors());
  assert.ok(c.neighbors('PC1').some(e => e.state === 'REACHABLE'));
});

console.log('IPv6 grader');

it('module shape follows SIM-SPEC §2', () => {
  assert.strictEqual(g.id, 'ipv6');
  assert.deepStrictEqual(g.missions.map(m => m.id), ['v1', 'v2', 'v3', 'v4', 'v5']);
  assert.deepStrictEqual(g.generatedMissions, ['v1', 'v2']);
  for (const m of g.missions) {
    assert.strictEqual(m.max, 10);
    assert.ok(m.title && m.desc && m.hints.length && ['easy', 'medium', 'hard'].includes(m.level));
    assert.ok(m.start && ['guided', 'independent', 'troubleshooting'].includes(m.start.lab) && m.start.week);
  }
  assert.strictEqual(g.generate('v3', rand), null);
  const v4 = g.missions.find(m => m.id === 'v4').start.topo;   // public start data holds no answers
  assert.strictEqual(v4.devices.find(d => d.id === 'SRV1').ifaces[0].addr, '');
  assert.ok(v4.devices.filter(d => d.type === 'router').every(d => d.routes.length === 0));
});

// ---- v1
const solveV1 = pr => { const a = {}; pr.items.forEach((it, i) => { const w = W(it.show); a['a' + i] = it.task === 'compress' ? V.compress(w) : V.expand(w); a['t' + i] = V.typeOf(w); }); return a; };

it('v1 generation: 4 items, all four types, 2 compress + 2 expand, deterministic per seed', () => {
  for (let k = 0; k < 30; k++) {
    const pr = g.generate('v1', rand);
    assert.strictEqual(pr.items.length, 4);
    assert.deepStrictEqual(pr.items.map(i => V.typeOf(W(i.show))).sort(), ['global', 'link-local', 'multicast', 'unique-local']);
    assert.strictEqual(pr.items.filter(i => i.task === 'compress').length, 2);
    pr.items.filter(i => i.task === 'compress').forEach(i => assert.strictEqual(i.show.toLowerCase(), V.expand(W(i.show))));
  }
  const mk = s => { let x = s; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };
  assert.deepStrictEqual(g.generate('v1', mk(3)), g.generate('v1', mk(3)));
});

it('v1 perfect answers = 10/10 (many random problems)', () => {
  for (let k = 0; k < 25; k++) {
    const pr = g.generate('v1', rand);
    const r = g.grade('v1', { answers: solveV1(pr) }, pr);
    assert.strictEqual(r.score, 10, JSON.stringify(pr) + r.feedback.join('|')); assert.ok(r.ok);
  }
});

it('v1 typical mistakes give partial credit with the RFC rule in Thai', () => {
  const pr = { v: 1, mission: 'v1', items: [
    { task: 'compress', show: '2001:0DB8:0000:0000:0001:0000:0000:0001' },
    { task: 'compress', show: 'fe80:0000:0000:0000:0214:22ff:fe01:0b11' },
    { task: 'expand', show: 'fd12:3456:789a:1::5' },
    { task: 'expand', show: 'ff02::1:ff01:b11' }] };
  const a = solveV1(pr);
  a.a0 = '2001:db8:0:0:1::1';               // compressed the second run instead of the first
  a.a1 = 'FE80::214:22FF:FE01:B11';         // uppercase
  a.a2 = 'fd12:3456:789a:1:0:0:0:5';        // not padded
  a.t3 = 'link-local';                      // wrong type
  const r = g.grade('v1', { answers: a }, pr);
  assert.strictEqual(r.score, 5, r.feedback.join('\n'));
  assert.ok(fbHas(r, /ข้อ 1 .*ช่วงแรก/)); assert.ok(fbHas(r, /ข้อ 2 .*ตัวพิมพ์เล็ก/));
  assert.ok(fbHas(r, /ข้อ 3 .*4 หลัก/)); assert.ok(fbHas(r, /ข้อ 4: ชนิดไม่ถูกต้อง.*ff/));
  assert.deepStrictEqual(r.details.items.map(x => x.notation), [false, false, false, true]);
});

it('v1 wrong values and invalid syntax are explained', () => {
  const pr = { v: 1, mission: 'v1', items: [{ task: 'compress', show: '2001:0db8:0000:0000:0000:ff00:0042:8329' }, { task: 'expand', show: '2001:db8::1' }] };
  const r = g.grade('v1', { answers: { a0: '2001:db8::ff00:42:8329::', t0: 'global', a1: '2001:0db8:0000:0000:0000:0000:0001:0000', t1: 'global' } }, pr);
  assert.ok(fbHas(r, /ข้อ 1 \(ย่อ\): รูปแบบไม่ถูกต้อง/)); assert.ok(fbHas(r, /ข้อ 2 \(ขยาย\): ค่าไม่เท่ากับ.*กลุ่มที่ 7, 8/));
  assert.strictEqual(r.score, 5);
});

it('v1 tampered/missing problem, empty and oversized payloads = 0 (never throws)', () => {
  const pr = g.generate('v1', rand);
  assert.strictEqual(g.grade('v1', { answers: solveV1(pr) }, undefined).score, 0);
  assert.strictEqual(g.grade('v1', { answers: solveV1(pr) }, { v: 1, mission: 'v1', items: [{ task: 'compress', show: 'zz::1' }] }).score, 0);
  assert.strictEqual(g.grade('v1', { answers: solveV1(pr) }, { v: 1, mission: 'v2', items: pr.items }).score, 0);
  assert.strictEqual(g.grade('v1', { answers: {} }, pr).score, 0);
  const big = g.grade('v1', { answers: { a0: 'x'.repeat(5000) } }, pr);
  assert.strictEqual(big.score, 0); assert.ok(fbHas(big, /ใหญ่เกินไป/));
  for (const p of [null, 'x', [], { answers: [] }, { answers: 'a' }, { answers: { a0: 5, t0: {} } }]) assert.strictEqual(g.grade('v1', p, pr).score, 0);
});

// ---- v2
const solveV2 = pr => { const a = {}; pr.macs.forEach((m, i) => { const b = V.parseMac(m).b; a['eui' + i] = V.expand([0, 0, 0, 0].concat(V.eui64(b))).slice(20); a['ll' + i] = V.compress(V.linkLocal(b)); }); return a; };

it('v2 generation: 3 unicast MACs including a locally administered one', () => {
  for (let k = 0; k < 20; k++) {
    const pr = g.generate('v2', rand);
    assert.strictEqual(pr.macs.length, 3);
    const b = pr.macs.map(m => V.parseMac(m).b);
    assert.ok(b.every(x => (x[0] & 1) === 0));
    assert.ok(b.some(x => x[0] & 2) && b.some(x => !(x[0] & 2)));
  }
});

it('v2 perfect answers + verification ping = 10/10; IID accepted in several notations', () => {
  const pr = g.generate('v2', rand);
  const a = solveV2(pr);
  assert.strictEqual(g.grade('v2', { answers: a, verify: a.ll0 }, pr).score, 10);
  const b = Object.assign({}, a, { eui0: '::' + V.compress([0, 0, 0, 0].concat(V.eui64(V.parseMac(pr.macs[0]).b))).replace(/^::/, ''), ll1: V.expand(W(a.ll1)) });
  assert.strictEqual(g.grade('v2', { answers: b, verify: a.ll0 + '%eth0' }, pr).score, 10);
});

it('v2 typical mistakes: forgot U/L flip, missing fffe, wrong prefix, no verification', () => {
  const pr = { v: 1, mission: 'v2', macs: ['00:1a:2b:3c:4d:5e', '52:54:00:12:34:56', 'a4:5e:60:01:02:03'] };
  const a = solveV2(pr);
  a.eui0 = '001a:2bff:fe3c:4d5e';            // forgot to flip
  a.ll1 = 'fe80::5254:ff:fe12:3456';         // set the bit instead of inverting
  a.eui2 = 'a65e:6001:0203';                 // no fffe
  a.ll2 = 'fe90::a65e:60ff:fe01:203';        // wrong prefix
  const r = g.grade('v2', { answers: a }, pr);
  assert.strictEqual(r.score, Math.round(10 * (10 - 6 - 1) / 10), r.feedback.join('\n'));
  assert.ok(fbHas(r, /00:1a:2b:3c:4d:5e: Interface ID ไม่ถูกต้อง — ลืมกลับบิต U\/L/));
  assert.ok(fbHas(r, /52:54:00:12:34:56: link-local ไม่ถูกต้อง — บิต U\/L ของ MAC นี้เป็น 1 อยู่แล้ว/));
  assert.ok(fbHas(r, /3 กลุ่ม \(48 บิต\).*ff:fe/));
  assert.ok(fbHas(r, /ต้องขึ้นต้นด้วย fe80/));
  assert.ok(fbHas(r, /ยังไม่ได้ตรวจในเครื่องจำลอง/));
});

it('v2 verification must ping PC-A (not PC-B itself, not a wrong address)', () => {
  const pr = g.generate('v2', rand); const a = solveV2(pr);
  const self = V.compress(V.linkLocal([0x00, 0x0c, 0x29, 0x5e, 0x7a, 0x01]));
  assert.ok(fbHas(g.grade('v2', { answers: a, verify: self }, pr), /ไม่ใช่ link-local ของ PC-A/));
  assert.ok(fbHas(g.grade('v2', { answers: a, verify: 'fe80::1' }, pr), /ไม่สำเร็จ/));
  assert.strictEqual(g.grade('v2', { answers: a, verify: 'fe80::1' }, pr).score, 9);
});

it('v2 tampered problem / oversized payload = 0', () => {
  const pr = g.generate('v2', rand); const a = solveV2(pr);
  assert.strictEqual(g.grade('v2', { answers: a, verify: a.ll0 }, { v: 1, mission: 'v2', macs: ['01:00:5e:00:00:01', pr.macs[1], pr.macs[2]] }).score, 0);
  assert.strictEqual(g.grade('v2', { answers: a, verify: a.ll0 }, { v: 1, mission: 'v2', macs: pr.macs.slice(0, 2) }).score, 0);
  assert.strictEqual(g.grade('v2', { answers: a, verify: a.ll0 }, null).score, 0);
  assert.strictEqual(g.grade('v2', { answers: a, verify: 'f'.repeat(9000) }, pr).score, 0);
});

// ---- v3
it('v3 perfect: RA on both LANs, hosts SLAAC, full ping matrix = 10/10', () => {
  const r = g.grade('v3', { cfg: V3OK });
  assert.strictEqual(r.score, 10, r.feedback.join('\n')); assert.ok(r.ok);
  assert.strictEqual(r.details.matrix.length, 12); assert.ok(r.details.matrix.every(x => x.ok));
});

it('v3 typical mistakes: RA off on LAN2, /48 prefix, host switched to static', () => {
  const off = g.grade('v3', { cfg: { R1: { ifaces: { 'g0/0': { addr: '2001:db8:10::1', len: '64', ra: true }, 'g0/1': { addr: '2001:db8:20::1', len: '64', ra: false } } } } });
  assert.ok(off.score > 0 && off.score < 10);
  assert.ok(fbHas(off, /G0\/1 ยังไม่ได้เปิดการส่ง RA/)); assert.ok(fbHas(off, /PC3 ยังไม่มี SLAAC address/));
  const l48 = g.grade('v3', { cfg: { R1: { ifaces: { 'g0/0': { addr: '2001:db8:10::1', len: '48', ra: true }, 'g0/1': { addr: '2001:db8:20::1', len: '64', ra: true } } } } });
  assert.ok(fbHas(l48, /ซึ่งไม่ใช่ \/64/)); assert.ok(l48.score < 10);
  const st = g.grade('v3', { cfg: Object.assign({}, V3OK, { PC2: { ifaces: { eth0: { mode: 'static', addr: '2001:db8:10::2', len: '64', gw: 'fe80::21a:2bff:fe10:1' } } } }) });
  assert.strictEqual(st.score, 9); assert.ok(fbHas(st, /PC2 ถูกเปลี่ยนเป็น Static/));
  const none = g.grade('v3', { cfg: {} });
  assert.ok(none.score <= 1); assert.ok(fbHas(none, /ยังไม่มี global address/));
});

it('v3 malformed / oversized payload = 0 with Thai message', () => {
  for (const p of [undefined, null, 'cfg', [], { cfg: 'x' }, { cfg: [] }]) {
    const r = g.grade('v3', p); assert.strictEqual(r.score, 0); assert.ok(/ไม่พบการตั้งค่า/.test(r.feedback[0]));
  }
  const big = g.grade('v3', { cfg: { R1: { routes: new Array(2000).fill({ prefix: '2001:db8::/64', via: 'fe80::1', iface: 'g0/0' }) } } });
  assert.strictEqual(big.score, 0); assert.ok(fbHas(big, /ใหญ่เกินไป/));
  assert.strictEqual(g.grade('v9', {}).score, 0);
});

// ---- v4
const V4OK = { SRV1: { ifaces: { eth0: { mode: 'static', addr: '2001:db8:1::10', len: '64', gw: 'fe80::1' } } }, SRV2: { ifaces: { eth0: { mode: 'static', addr: '2001:db8:2::10', len: '64', gw: '2001:db8:2::1' } } },
  R1: { routes: [{ prefix: '2001:db8:2::/64', via: '2001:db8:ff::2', iface: '' }] }, R2: { routes: [{ prefix: '2001:db8:1::/64', via: 'fe80::1', iface: 'g0/1' }] } };

it('v4 perfect: static servers + routes both ways (global or link-local next hop) = 10/10', () => {
  const r = g.grade('v4', { cfg: V4OK });
  assert.strictEqual(r.score, 10, r.feedback.join('\n'));
  const def = JSON.parse(JSON.stringify(V4OK)); def.R2.routes = [{ prefix: '::/0', via: '2001:db8:ff::1' }];
  assert.strictEqual(g.grade('v4', { cfg: def }).score, 10);   // a default route also covers the remote LAN
});

it('v4 missing return route: partial, explains reply path; wrong server prefix length and gateway', () => {
  const one = JSON.parse(JSON.stringify(V4OK)); one.R2.routes = [];
  const r = g.grade('v4', { cfg: one });
  assert.ok(r.score < 10 && r.score > 0); assert.ok(fbHas(r, /R2 ยังไม่มี static route ไปยัง 2001:db8:1::\/64/)); assert.ok(fbHas(r, /ขากลับ/));
  const bad = JSON.parse(JSON.stringify(V4OK));
  bad.SRV1.ifaces.eth0.len = '48'; bad.SRV2.ifaces.eth0.gw = '2001:db8:1::1';
  const b = g.grade('v4', { cfg: bad });
  assert.ok(fbHas(b, /SRV1 ใช้ prefix length \/48 ต้องเป็น \/64/)); assert.ok(fbHas(b, /SRV2: default gateway 2001:db8:1::1 ไม่อยู่บนลิงก์เดียวกับ SRV2/));
  const ll = JSON.parse(JSON.stringify(V4OK)); ll.R1.routes = [{ prefix: '2001:db8:2::/64', via: 'fe80::2', iface: '' }];
  assert.ok(fbHas(g.grade('v4', { cfg: ll }), /ต้องระบุ interface/));
});

it('v4 untouched start network scores low (servers have no address)', () => {
  const r = g.grade('v4', { cfg: {} });
  assert.ok(r.score <= 2, String(r.score)); assert.ok(fbHas(r, /SRV1 ยังไม่ได้ตั้ง IPv6 address/));
});

// ---- v5
const V5FIX = { R1: { ifaces: { 'g0/0': { ra: true } } }, PC2: { ifaces: { eth0: { len: '64' } } }, PC3: { ifaces: { eth0: { gw: 'fe80::1' } } }, PC4: { ifaces: { eth0: { addr: '2001:db8:acad:2::40', t: 3 } } } };

it('v5 all four faults fixed = 10/10; alternative fixes accepted (SLAAC instead of static)', () => {
  assert.strictEqual(g.grade('v5', { cfg: V5FIX }).score, 10);
  const alt = { R1: V5FIX.R1, PC2: { ifaces: { eth0: { mode: 'slaac' } } }, PC3: { ifaces: { eth0: { gw: '2001:db8:acad:2::1' } } }, PC4: { ifaces: { eth0: { mode: 'slaac' } } } };
  const r = g.grade('v5', { cfg: alt });
  assert.strictEqual(r.score, 10, r.feedback.join('\n'));
});

it('v5 broken start scores low and feedback names each symptom', () => {
  const r = g.grade('v5', { cfg: {} });
  assert.ok(r.score <= 2, String(r.score));
  assert.ok(fbHas(r, /PC2 ยังส่งหาเครื่องใน LAN2 ไม่ได้/)); assert.ok(fbHas(r, /PC3 ยังส่งออกนอกวงไม่ได้/));
  assert.ok(fbHas(r, /PC1 \(SLAAC\) ยังไม่มี global address/)); assert.ok(fbHas(r, /address ซ้ำ/));
  assert.ok(r.details.checks.filter(c => c.id.startsWith('f-')).every(c => !c.ok));
});

it('v5 partial fixes are partial; changing the server address is not accepted', () => {
  const three = JSON.parse(JSON.stringify(V5FIX)); delete three.PC3;
  const r = g.grade('v5', { cfg: three });
  assert.ok(r.score >= 6 && r.score < 10, String(r.score));
  const moved = JSON.parse(JSON.stringify(V5FIX)); delete moved.PC4; moved.SRV = { ifaces: { eth0: { addr: '2001:db8:acad:2::99', t: 4 } } };
  const m = g.grade('v5', { cfg: moved });
  assert.ok(m.score < 10); assert.ok(fbHas(m, /SRV ต้องใช้ 2001:db8:acad:2::10/));
});

it('v5 malformed payloads never throw', () => {
  for (const p of [{ cfg: { R1: { ifaces: 'x', routes: 'y' } } }, { cfg: { PC2: { ifaces: { eth0: null } } } }, { cfg: { PC2: { ifaces: { eth0: { len: { a: 1 }, addr: ['x'] } } } } }]) {
    const r = g.grade('v5', p); assert.ok(typeof r.score === 'number' && r.score < 10);
  }
});

// 6.x browser module (jsdom): while a v1/v2 problem is open the free tools do not compute its answers, and PC-A's
// ipconfig (which shows the link-local of MAC 1) opens only after a successful ping to it or after grading
async function browserTests() {
  let JSDOM;
  try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('  - jsdom not installed: browser checks skipped'); return; }
  const fs = require('fs'), path = require('path'), V6 = V;
  const run = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '\n    ', e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e); } };
  const tick = () => new Promise(r => setTimeout(r, 0));
  console.log('IPv6 browser module (answer leaks)');
  await run('v1/v2 open: tools locked, no PC-A fill button, ipconfig only after Echo Reply from PC-A; practice message shown', async () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body><div id="r"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
    const w = dom.window; w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.eval(fs.readFileSync(path.join(__dirname, '../../public/js/sim/ipv6.js'), 'utf8'));
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const probs = {};
    const ctx = { missions: g.missions, done: {}, user: { name: 'x' },
      newProblem: async id => { probs[id] = g.generate(id, rnd); return { problem: probs[id], token: 't' }; },
      submit: async () => ({ score: 10, max: 10, ok: true, feedback: [], details: { checks: [] }, saved: true, practice: true, message: "โจทย์นี้ส่งไปแล้ว ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน กด 'โจทย์ใหม่' เพื่อทำข้อใหม่" }) };
    const root = w.document.getElementById('r');
    w.NL_SIMS.ipv6.mount(root, ctx);
    const click = sel => { const b = root.querySelector(sel); assert.ok(b, 'missing ' + sel); b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
    const tools = () => { click('[data-act="tools"]'); return root.textContent; };
    // nothing open: both tools work
    tools(); assert.ok(root.querySelector('[data-tool="mac"]') && root.querySelector('[data-tool="addr"]'));
    // v2 open
    click('[data-act="mission"][data-id="v2"]'); await tick(); await tick();
    const mac = probs.v2.macs[0], ll = V6.compress(V6.linkLocal(V6.parseMac(mac).b));
    assert.ok(!root.querySelector('[data-act="fill"]'), 'no fill button carrying PC-A link-local');
    assert.ok(root.querySelector('[data-act="showA"]').disabled, 'ipconfig of PC-A closed before verification');
    assert.ok(!root.innerHTML.includes(ll.split('%')[0].slice(6)), 'PC-A link-local not in the page');
    const t = tools();
    assert.ok(!root.querySelector('[data-tool="mac"]'), 'EUI-64 tool locked while v2 is open'); assert.ok(/ส่งตรวจโจทย์ v2 ก่อน/.test(t));
    assert.ok(root.querySelector('[data-tool="addr"]'), 'address tool still usable (v1 not open)');
    click('[data-act="mission"][data-id="v2"]');
    const ping = target => { const i = root.querySelector('[data-ptarget]'); i.value = target; i.dispatchEvent(new w.Event('input', { bubbles: true })); click('[data-act="ping"]'); };
    ping('fe80::1'); assert.ok(root.querySelector('[data-act="showA"]').disabled, 'a failed ping does not open ipconfig');
    ping(ll); assert.ok(!root.querySelector('[data-act="showA"]').disabled, 'Echo Reply from PC-A opens ipconfig');
    click('[data-act="showA"]'); assert.ok(/Link-local IPv6 Address/.test(root.querySelector('.nls-ipv6-term[aria-label*="PC-A"]').textContent));
    // v1 open: address tool locked
    click('[data-act="mission"][data-id="v1"]'); await tick(); await tick();
    tools(); assert.ok(!root.querySelector('[data-tool="addr"]'), 'address tool locked while v1 is open');
    // submit v1: practice message; tool unlocked after grading
    click('[data-act="mission"][data-id="v1"]'); click('[data-act="submit"]'); await tick(); await tick();
    assert.ok(/ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน/.test(root.textContent), 'practice message shown');
    tools(); assert.ok(root.querySelector('[data-tool="addr"]'), 'address tool back after v1 was graded');
    w.close();
  });
}
browserTests().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
});
