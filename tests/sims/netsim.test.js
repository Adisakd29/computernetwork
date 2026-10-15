// Tests for the NetSim engine (public/js/sim/netsim.js). Plain Node + assert:
//   node tests/sims/netsim.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const NetSim = require(path.join(__dirname, '../../public/js/sim/netsim.js'));

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', (e && e.stack || String(e)).split('\n').slice(0, 14).join('\n      ')); }
}
const clone = x => JSON.parse(JSON.stringify(x));
const codes = (net, dev) => net.problems().filter(p => !dev || p.dev === dev).map(p => p.code);
const link = (id, a, ap, b, bp, extra) => Object.assign({ id, a: { dev: a, port: ap }, b: { dev: b, port: bp }, medium: 'utp', up: true }, extra || {});
const pc = (id, ip, prefix, gw, extra) => Object.assign({ id, type: 'pc', name: id.toUpperCase(), x: 100, y: 100,
  ifaces: [{ name: 'eth0', ip, prefix, up: true }], gateway: gw || '', dns: [] }, extra || {});

// ---------------------------------------------------------------- base topologies
// LAN 192.168.1.0/24 (pc1, pc2, srv1 DNS) -- sw1 -- r1 -- internet (10.0.0.0/30)
function lab() {
  return {
    devices: [
      pc('pc1', '192.168.1.10', 24, '192.168.1.1', { dns: ['192.168.1.5'], x: 100, y: 260 }),
      pc('pc2', '192.168.1.20', 24, '192.168.1.1', { dns: ['192.168.1.5'], x: 220, y: 330 }),
      { id: 'srv1', type: 'server', name: 'SRV1', os: 'linux', x: 360, y: 330,
        ifaces: [{ name: 'eth0', ip: '192.168.1.5', prefix: 24, up: true }], gateway: '192.168.1.1', dns: ['192.168.1.5'],
        services: { dns: { records: { 'dns.lab.local': '192.168.1.5', 'srv.lab.local': '192.168.1.5', 'www.netlab.test': '203.0.113.80' } }, web: true } },
      { id: 'sw1', type: 'switch', name: 'Switch1', x: 240, y: 200, ports: 24 },
      { id: 'r1', type: 'router', name: 'Router1', x: 420, y: 200,
        ifaces: [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24, up: true }, { name: 'g0/1', ip: '10.0.0.1', prefix: 30, up: true }],
        routes: [{ net: '0.0.0.0', prefix: 0, via: '10.0.0.2' }] },
      { id: 'net', type: 'internet', name: 'Internet', x: 600, y: 200,
        ifaces: [{ name: 'wan', ip: '10.0.0.2', prefix: 30, up: true }],
        hosts: { '8.8.8.8': 'dns.google', '1.1.1.1': 'one.one.one.one', '203.0.113.80': 'www.netlab.test' } }
    ],
    links: [
      link('l1', 'pc1', 'eth0', 'sw1', 'p1'),
      link('l2', 'pc2', 'eth0', 'sw1', 'p2'),
      link('l3', 'srv1', 'eth0', 'sw1', 'p3'),
      link('l4', 'r1', 'g0/0', 'sw1', 'p24'),
      link('l5', 'r1', 'g0/1', 'net', 'wan', { medium: 'fiber' })
    ]
  };
}
// 192.168.1.0/24 -- r1 -- 10.0.0.0/30 -- r2 -- 192.168.2.0/24 -- r2 g0/2 -- 10.0.1.0/30 -- r3 -- 192.168.3.0/24
function threeNets() {
  return {
    devices: [
      pc('pcA', '192.168.1.10', 24, '192.168.1.1'),
      pc('pcB', '192.168.2.10', 24, '192.168.2.1'),
      pc('pcC', '192.168.3.10', 24, '192.168.3.1'),
      { id: 'swA', type: 'switch', name: 'SwA' }, { id: 'swB', type: 'switch', name: 'SwB' }, { id: 'swC', type: 'switch', name: 'SwC' },
      { id: 'r1', type: 'router', name: 'R1', ifaces: [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24 }, { name: 'g0/1', ip: '10.0.0.1', prefix: 30 }],
        routes: [{ net: '192.168.2.0', prefix: 24, via: '10.0.0.2' }, { net: '192.168.3.0', prefix: 24, via: '10.0.0.2' }] },
      { id: 'r2', type: 'router', name: 'R2', ifaces: [{ name: 'g0/0', ip: '192.168.2.1', prefix: 24 }, { name: 'g0/1', ip: '10.0.0.2', prefix: 30 }, { name: 'g0/2', ip: '10.0.1.1', prefix: 30 }],
        routes: [{ net: '192.168.1.0', prefix: 24, via: '10.0.0.1' }, { net: '192.168.3.0', prefix: 24, via: '10.0.1.2' }] },
      { id: 'r3', type: 'router', name: 'R3', ifaces: [{ name: 'g0/0', ip: '192.168.3.1', prefix: 24 }, { name: 'g0/1', ip: '10.0.1.2', prefix: 30 }],
        routes: [{ net: '0.0.0.0', prefix: 0, via: '10.0.1.1' }] }
    ],
    links: [
      link('a1', 'pcA', 'eth0', 'swA', 'p1'), link('a2', 'r1', 'g0/0', 'swA', 'p2'),
      link('b1', 'pcB', 'eth0', 'swB', 'p1'), link('b2', 'r2', 'g0/0', 'swB', 'p2'),
      link('c1', 'pcC', 'eth0', 'swC', 'p1'), link('c2', 'r3', 'g0/0', 'swC', 'p2'),
      link('w1', 'r1', 'g0/1', 'r2', 'g0/1', { medium: 'fiber' }), link('w2', 'r2', 'g0/2', 'r3', 'g0/1')
    ]
  };
}

console.log('NetSim engine');

// ---------------------------------------------------------------- IP helpers
it('ip helpers', () => {
  const ip = NetSim.ip;
  assert.strictEqual(ip.parse('192.168.1.10'), 3232235786);
  assert.strictEqual(ip.parse('256.1.1.1'), null);
  assert.strictEqual(ip.parse('1.2.3'), null);
  assert.strictEqual(ip.parse(' 10.0.0.1 '), 167772161);
  assert.strictEqual(ip.str(3232235786), '192.168.1.10');
  assert.strictEqual(ip.mask(24), '255.255.255.0');
  assert.strictEqual(ip.mask(0), '0.0.0.0');
  assert.strictEqual(ip.mask(32), '255.255.255.255');
  assert.strictEqual(ip.prefixFromMask('255.255.255.192'), 26);
  assert.strictEqual(ip.prefixFromMask('255.0.255.0'), null);
  assert.strictEqual(ip.toPrefix('/27'), 27);
  assert.strictEqual(ip.toPrefix('255.255.0.0'), 16);
  assert.strictEqual(ip.toPrefix(33), null);
  assert.ok(ip.inSubnet('192.168.1.77', '192.168.1.0', 24));
  assert.ok(!ip.inSubnet('192.168.2.77', '192.168.1.0', 24));
  assert.strictEqual(ip.network('172.16.5.130', 25), '172.16.5.128');
  assert.strictEqual(ip.broadcast('172.16.5.130', 25), '172.16.5.255');
  assert.strictEqual(ip.firstHost('10.1.2.3', 30), '10.1.2.1');
  assert.strictEqual(ip.lastHost('10.1.2.3', 30), '10.1.2.2');
  assert.ok(ip.isPrivate('172.20.1.1') && ip.isPrivate('10.9.9.9') && !ip.isPrivate('8.8.8.8') && !ip.isPrivate('172.32.0.1'));
  assert.strictEqual(ip.classOf('150.1.1.1'), 'B');
  assert.strictEqual(ip.classOf('224.0.0.5'), 'D');
  assert.strictEqual(ip.hostsIn(24), 254);
  assert.strictEqual(ip.hostsIn(30), 2);
  assert.strictEqual(ip.hostsIn(32), 1);
  assert.strictEqual(ip.wildcard(24), '0.0.0.255');
});

// ---------------------------------------------------------------- normalisation / robustness
it('create never throws on garbage and reports problems', () => {
  for (const bad of [null, undefined, 42, 'x', [], { devices: 'x' }, { devices: [null, 5, {}], links: [null, {}, { a: 'zz', b: 'yy' }] },
    { devices: [{ id: 'a', type: 'toaster', ifaces: [{ ip: '999.1.1.1', prefix: 'abc', mac: 'zz' }] }], links: [{ a: { dev: 'a' }, b: { dev: 'nope' } }] }]) {
    const net = NetSim.create(bad);
    assert.ok(Array.isArray(net.problems()));
    net.ping('a', '1.2.3.4'); net.traceroute('a', 'x'); net.nslookup('a', 'x'); net.config('a'); net.routes('a'); net.arp('zz'); net.macTable('a'); net.l2Domain('q');
    assert.ok(NetSim.render(bad).startsWith('<svg'));
  }
  const net = NetSim.create({ devices: [{ id: 'a', type: 'toaster', ifaces: [{ ip: '999.1.1.1', prefix: 'abc' }] }], links: [{ a: { dev: 'a' }, b: { dev: 'nope' } }] });
  const c = codes(net);
  assert.ok(c.includes('bad_type') && c.includes('bad_ip') && c.includes('bad_prefix') && c.includes('bad_link'), c.join());
  assert.strictEqual(net.ping('nobody', '1.1.1.1').ok, false);
  assert.strictEqual(net.config('nobody'), null);
});

it('input is deep-copied; topo normalised with MACs, ports, prefixes', () => {
  const t = lab();
  delete t.devices[0].ifaces[0].mac;
  t.links[0].b.port = '';
  t.devices[1].ifaces[0].prefix = '255.255.255.0';
  const before = JSON.stringify(t);
  const net = NetSim.create(t);
  assert.strictEqual(JSON.stringify(t), before);
  assert.ok(/^([0-9A-F]{2}-){5}[0-9A-F]{2}$/.test(net.topo.devices[0].ifaces[0].mac));
  assert.strictEqual(net.topo.devices[1].ifaces[0].prefix, 24);
  assert.ok(/^p\d+$/.test(net.topo.links[0].b.port));
  // deterministic
  assert.strictEqual(JSON.stringify(NetSim.create(t).topo), JSON.stringify(net.topo));
  assert.strictEqual(net.problems().filter(p => p.level === 'error').length, 0, JSON.stringify(net.problems()));
});

it('missing ports get assigned, bad values reported, every message is Thai', () => {
  const net = NetSim.create({
    devices: [pc('pc1', '192.168.1.0', 24), pc('pc2', '192.168.1.255', 24), pc('pc3', '192.168.1.30', 24, '10.0.0.1'),
      pc('pc4', '192.168.1.40', 24), { id: 'sw', type: 'switch', ports: 2 }],
    links: [{ a: { dev: 'pc1' }, b: { dev: 'sw' } }, { a: { dev: 'pc2' }, b: { dev: 'sw' } }, { a: { dev: 'pc3', port: 'eth0' }, b: { dev: 'sw', port: 'p1' } },
      { a: { dev: 'pc4', port: 'eth0' }, b: { dev: 'sw', port: 'p1' } }]
  });
  const c = codes(net);
  assert.ok(c.includes('ip_is_network'));
  assert.ok(c.includes('ip_is_broadcast'));
  assert.ok(c.includes('gw_not_in_subnet'));
  assert.ok(c.includes('port_in_use'));
  net.problems().forEach(p => { assert.ok(/[฀-๿]/.test(p.msg), 'Thai: ' + p.msg); assert.ok(p.level === 'error' || p.level === 'warn'); });
  const pi = net.problems().find(p => p.code === 'port_in_use');
  assert.ok(pi.link && pi.dev === 'sw');
  assert.ok(codes(net).includes('bad_port'), 'switch full');
});

it('dotted mask accepted, missing prefix uses classful default (warn)', () => {
  const t = lab();
  t.devices[0].ifaces[0].prefix = undefined; t.devices[0].ifaces[0].mask = '255.255.255.0';
  delete t.devices[1].ifaces[0].prefix;
  const net = NetSim.create(t);
  assert.strictEqual(net.config('pc1').prefix, 24);
  assert.strictEqual(net.config('pc2').prefix, 24);
  assert.ok(net.problems().some(p => p.code === 'bad_prefix' && p.dev === 'pc2' && p.level === 'warn'));
  assert.ok(net.ping('pc1', '192.168.1.20').ok);
});

// ---------------------------------------------------------------- config
it('config returns effective settings', () => {
  const net = NetSim.create(lab());
  const c = net.config('pc1');
  assert.deepStrictEqual(
    { ip: c.ip, prefix: c.prefix, mask: c.mask, network: c.network, broadcast: c.broadcast, gateway: c.gateway, dns: c.dns, dhcp: c.dhcp, apipa: c.apipa, up: c.up },
    { ip: '192.168.1.10', prefix: 24, mask: '255.255.255.0', network: '192.168.1.0', broadcast: '192.168.1.255', gateway: '192.168.1.1', dns: ['192.168.1.5'], dhcp: false, apipa: false, up: true });
  assert.ok(/^([0-9A-F]{2}-){5}[0-9A-F]{2}$/.test(c.mac));
  const r = net.config('r1');
  assert.strictEqual(r.ifaces.length, 2);
  assert.strictEqual(r.ifaces[1].ip, '10.0.0.1');
});

// ---------------------------------------------------------------- ping basics
it('same-subnet ping succeeds with realistic Windows + Linux output', () => {
  const net = NetSim.create(lab());
  const r = net.ping('pc1', '192.168.1.20');
  assert.strictEqual(r.ok, true); assert.strictEqual(r.reason, 'ok'); assert.strictEqual(r.replies, 4);
  assert.deepStrictEqual(r.path, ['pc1', 'sw1', 'pc2']);
  assert.strictEqual(r.win[0], 'Pinging 192.168.1.20 with 32 bytes of data:');
  assert.ok(/^Reply from 192\.168\.1\.20: bytes=32 time<1ms TTL=128$/.test(r.win[1]), r.win[1]);
  assert.ok(r.win.includes('Ping statistics for 192.168.1.20:'));
  assert.ok(r.win.includes('    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),'));
  assert.ok(r.win.includes('Approximate round trip times in milli-seconds:'));
  assert.ok(/^    Minimum = \dms, Maximum = \dms, Average = \dms$/.test(r.win[r.win.length - 1]));
  assert.strictEqual(r.linux[0], 'PING 192.168.1.20 (192.168.1.20) 56(84) bytes of data.');
  assert.ok(/^64 bytes from 192\.168\.1\.20: icmp_seq=1 ttl=128 time=0\.\d{3} ms$/.test(r.linux[1]), r.linux[1]);
  assert.ok(r.linux.includes('--- 192.168.1.20 ping statistics ---'));
  assert.ok(r.linux.includes('4 packets transmitted, 4 received, 0% packet loss, time 3004ms') || /4 packets transmitted, 4 received, 0% packet loss, time 30\d\dms/.test(r.linux.join('\n')));
  assert.ok(/^rtt min\/avg\/max\/mdev = [\d.]+\/[\d.]+\/[\d.]+\/[\d.]+ ms$/.test(r.linux[r.linux.length - 1]));
  // Linux server answers with TTL 64
  const s = net.ping('pc1', '192.168.1.5');
  assert.ok(s.win[1].endsWith('TTL=64'), s.win[1]);
  // count option
  const one = net.ping('pc1', '192.168.1.20', { count: 2 });
  assert.strictEqual(one.win.filter(l => l.startsWith('Reply')).length, 2);
  assert.ok(one.win.includes('    Packets: Sent = 2, Received = 2, Lost = 0 (0% loss),'));
  // deterministic
  assert.deepStrictEqual(NetSim.create(lab()).ping('pc1', '192.168.1.20'), NetSim.create(lab()).ping('pc1', '192.168.1.20'));
});

it('ping own IP and loopback', () => {
  const t = lab(); t.links[0].up = false;
  const net = NetSim.create(t);
  const lo = net.ping('pc1', '127.0.0.1');
  assert.ok(lo.ok); assert.strictEqual(lo.win[1], 'Reply from 127.0.0.1: bytes=32 time<1ms TTL=128');
  assert.ok(net.ping('pc1', 'localhost').ok);
  const own = NetSim.create(lab()).ping('pc2', '192.168.1.20');
  assert.ok(own.ok); assert.deepStrictEqual(own.path, ['pc2']);
});

it('routed ping through 1 router (to the router and to the internet IP of the router)', () => {
  const net = NetSim.create(lab());
  const g = net.ping('pc1', '192.168.1.1');
  assert.ok(g.ok); assert.ok(g.win[1].endsWith('TTL=255'), g.win[1]);
  const far = net.ping('pc1', '10.0.0.1');
  assert.ok(far.ok, far.reason);
  const wan = net.ping('pc1', '10.0.0.2');
  assert.ok(wan.ok, wan.reason);
  assert.deepStrictEqual(wan.path, ['pc1', 'sw1', 'r1', 'net']);
  assert.ok(/TTL=254$/.test(wan.win[1]), wan.win[1]);
});

it('routed ping through 2 routers both ways, TTL decremented per hop', () => {
  const net = NetSim.create(threeNets());
  const ab = net.ping('pcA', '192.168.2.10');
  assert.ok(ab.ok, ab.reason); assert.deepStrictEqual(ab.path, ['pcA', 'swA', 'r1', 'r2', 'swB', 'pcB']);
  assert.ok(/TTL=126$/.test(ab.win[1]), ab.win[1]);
  const ac = net.ping('pcA', '192.168.3.10');
  assert.ok(ac.ok, ac.reason); assert.deepStrictEqual(ac.path, ['pcA', 'swA', 'r1', 'r2', 'r3', 'swC', 'pcC']);
  assert.ok(/TTL=125 *$/.test(ac.win[1]), ac.win[1]);
  assert.ok(/time=\dms/.test(ac.win[1]), 'routers add ms: ' + ac.win[1]);
  assert.ok(net.ping('pcC', '192.168.1.10').ok);
  assert.ok(net.ping('pcB', '192.168.3.10').ok);
});

it('internet reachability via default route; and without default route => no_route', () => {
  const net = NetSim.create(lab());
  const r = net.ping('pc1', '8.8.8.8');
  assert.ok(r.ok, r.reason);
  assert.deepStrictEqual(r.path, ['pc1', 'sw1', 'r1', 'net']);
  assert.ok(/time=(19|2\d)ms TTL=117$/.test(r.win[1]), r.win[1]);
  assert.strictEqual(net.ping('pc1', '9.9.9.9').reason, 'timeout'); // internet does not know that IP
  const t = lab(); t.devices[4].routes = [];
  const n2 = NetSim.create(t);
  const nr = n2.ping('pc1', '8.8.8.8');
  assert.strictEqual(nr.reason, 'no_route'); assert.strictEqual(nr.from, '192.168.1.1');
  assert.strictEqual(nr.win[1], 'Reply from 192.168.1.1: Destination net unreachable.');
  assert.ok(nr.win.includes('    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),'), 'Windows counts unreachable replies as received');
  assert.ok(!nr.win.includes('Approximate round trip times in milli-seconds:'));
  assert.strictEqual(nr.linux[1], 'From 192.168.1.1 icmp_seq=1 Destination Net Unreachable');
  assert.ok(/4 packets transmitted, 0 received, \+4 errors, 100% packet loss/.test(nr.linux.join('\n')));
  assert.strictEqual(nr.replies, 0);
});

it('missing route on a middle router => no_route from that router', () => {
  const t = threeNets();
  t.devices.find(d => d.id === 'r2').routes = [{ net: '192.168.1.0', prefix: 24, via: '10.0.0.1' }]; // no route to .3
  const net = NetSim.create(t);
  const r = net.ping('pcA', '192.168.3.10');
  assert.strictEqual(r.reason, 'no_route'); assert.strictEqual(r.from, '10.0.0.2'); assert.strictEqual(r.failAt, 'r2');
  // return route missing => request reaches pcC but reply cannot come back => timeout
  const t2 = threeNets();
  t2.devices.find(d => d.id === 'r3').routes = [{ net: '192.168.2.0', prefix: 24, via: '10.0.1.1' }];
  const r2 = NetSim.create(t2).ping('pcA', '192.168.3.10');
  assert.strictEqual(r2.reason, 'timeout');
  assert.deepStrictEqual(r2.win.slice(1, 5), Array(4).fill('Request timed out.'));
  assert.ok(r2.win.includes('    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),'));
  assert.ok(/4 packets transmitted, 0 received, 100% packet loss, time \d+ms/.test(r2.linux.join('\n')));
});

// ---------------------------------------------------------------- faults
it('wrong gateway: unreachable gateway IP => gateway_unreachable; gateway is a PC => timeout', () => {
  const t = lab(); t.devices[0].gateway = '192.168.1.254';
  const net = NetSim.create(t);
  const r = net.ping('pc1', '8.8.8.8');
  assert.strictEqual(r.reason, 'gateway_unreachable');
  assert.strictEqual(r.win[1], 'Reply from 192.168.1.10: Destination host unreachable.');
  assert.strictEqual(r.linux[1], 'From 192.168.1.10 icmp_seq=1 Destination Host Unreachable');
  assert.ok(net.ping('pc1', '192.168.1.20').ok, 'local traffic still works');
  const t2 = lab(); t2.devices[0].gateway = '192.168.1.20';
  assert.strictEqual(NetSim.create(t2).ping('pc1', '8.8.8.8').reason, 'timeout');
  // destination's gateway wrong => reply cannot come back => timeout
  const t3 = threeNets(); t3.devices[1].gateway = '192.168.2.99';
  assert.strictEqual(NetSim.create(t3).ping('pcA', '192.168.2.10').reason, 'timeout');
  // gateway outside own subnet / missing => no_gateway (General failure)
  const t4 = lab(); t4.devices[0].gateway = '10.9.9.9';
  const n4 = NetSim.create(t4);
  assert.ok(codes(n4, 'pc1').includes('gw_not_in_subnet'));
  const r4 = n4.ping('pc1', '8.8.8.8');
  assert.strictEqual(r4.reason, 'no_gateway');
  assert.strictEqual(r4.win[1], 'PING: transmit failed. General failure.');
  assert.deepStrictEqual(r4.linux, ['ping: connect: Network is unreachable']);
  const t5 = lab(); t5.devices[0].gateway = '';
  const n5 = NetSim.create(t5);
  assert.ok(codes(n5, 'pc1').includes('gw_missing'));
  assert.strictEqual(n5.ping('pc1', '8.8.8.8').reason, 'no_gateway');
});

it('wrong subnet mask', () => {
  // /16 on a /24 network: remote 192.168.2.x is believed on-link => ARP fails
  const t = threeNets(); t.devices[0].ifaces[0].prefix = 16;
  const net = NetSim.create(t);
  const r = net.ping('pcA', '192.168.2.10');
  assert.strictEqual(r.reason, 'same_subnet_unreachable');
  assert.strictEqual(r.win[1], 'Reply from 192.168.1.10: Destination host unreachable.');
  assert.ok(net.ping('pcA', '192.168.1.1').ok);
  // mask too small in the other direction: pc thinks the gateway is not in its subnet
  const t2 = lab(); t2.devices[0].ifaces[0].prefix = 30; // 192.168.1.8/30
  const n2 = NetSim.create(t2);
  assert.ok(codes(n2, 'pc1').includes('gw_not_in_subnet'));
  assert.strictEqual(n2.ping('pc1', '192.168.1.20').reason, 'no_gateway');
  // pc2 with /24 can reach pc1 one way but pc1's reply (no usable gateway) is lost
  assert.strictEqual(n2.ping('pc2', '192.168.1.10').reason, 'timeout');
});

it('duplicate IP: warning on both devices, deterministic answer from lower id', () => {
  const t = lab();
  t.devices.push(pc('pc10', '192.168.1.20', 24, '192.168.1.1', { x: 50, y: 400 }));
  t.links.push(link('l9', 'pc10', 'eth0', 'sw1', 'p9'));
  const net = NetSim.create(t);
  const dups = net.problems().filter(p => p.code === 'dup_ip');
  assert.deepStrictEqual(dups.map(p => p.dev).sort(), ['pc10', 'pc2']);
  assert.ok(dups.every(p => p.level === 'warn'));
  const r = net.ping('pc1', '192.168.1.20');
  assert.ok(r.ok); assert.strictEqual(r.path[r.path.length - 1], 'pc2', 'pc2 < pc10 in natural order');
  assert.strictEqual(JSON.stringify(net.ping('pc1', '192.168.1.20')), JSON.stringify(NetSim.create(t).ping('pc1', '192.168.1.20')));
});

it('unplugged cable => no_link (General failure), problems no_link', () => {
  const t = lab(); t.links[0].up = false;
  const net = NetSim.create(t);
  const r = net.ping('pc1', '192.168.1.20');
  assert.strictEqual(r.reason, 'no_link');
  assert.strictEqual(r.win[1], 'PING: transmit failed. General failure.');
  assert.ok(r.win.includes('    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),'));
  assert.deepStrictEqual(r.linux, ['ping: connect: Network is unreachable']);
  assert.ok(net.problems().some(p => p.code === 'no_link' && p.link === 'l1'));
  assert.strictEqual(net.config('pc1').linked, false);
  // others cannot reach pc1 either
  assert.strictEqual(net.ping('pc2', '192.168.1.10').reason, 'same_subnet_unreachable');
  // unconnected host
  const t2 = lab(); t2.links.shift();
  const n2 = NetSim.create(t2);
  assert.ok(n2.problems().some(p => p.code === 'no_link' && p.dev === 'pc1'));
  assert.strictEqual(n2.ping('pc1', '192.168.1.20').reason, 'no_link');
});

it('disabled adapter => iface_down; loopback still works', () => {
  const t = lab(); t.devices[1].ifaces[0].up = false;
  const net = NetSim.create(t);
  const r = net.ping('pc2', '192.168.1.10');
  assert.strictEqual(r.reason, 'iface_down');
  assert.strictEqual(r.win[1], 'PING: transmit failed. General failure.');
  assert.ok(codes(net, 'pc2').includes('iface_down'));
  assert.strictEqual(net.ping('pc1', '192.168.1.20').reason, 'same_subnet_unreachable');
  assert.ok(net.ping('pc2', '127.0.0.1').ok);
  assert.strictEqual(net.linkState('l2').reason, 'iface_down');
});

it('no IP configured => no_ip', () => {
  const t = lab(); t.devices[0].ifaces[0].ip = '';
  const net = NetSim.create(t);
  assert.strictEqual(net.ping('pc1', '192.168.1.20').reason, 'no_ip');
  assert.ok(codes(net, 'pc1').includes('no_ip'));
});

it('host firewall drops ICMP => timeout (but DNS/other services still work)', () => {
  const t = lab(); t.devices[2].firewall = { icmp: false };
  const net = NetSim.create(t);
  const r = net.ping('pc1', '192.168.1.5');
  assert.strictEqual(r.reason, 'timeout'); assert.strictEqual(r.detail, 'firewall');
  assert.deepStrictEqual(r.path, ['pc1', 'sw1', 'srv1'], 'packet did reach the server');
  assert.strictEqual(r.win[1], 'Request timed out.');
  assert.ok(net.nslookup('pc1', 'srv.lab.local').ok, 'DNS (UDP) is not blocked');
  assert.ok(net.arp('pc1').some(e => e.ip === '192.168.1.5'), 'ARP worked, only ICMP was dropped');
});

it('routing loop => ttl_expired', () => {
  const t = threeNets();
  // r2 sends 192.168.3.0/24 back to r1, r1 sends it to r2
  t.devices.find(d => d.id === 'r2').routes = [{ net: '192.168.1.0', prefix: 24, via: '10.0.0.1' }, { net: '192.168.3.0', prefix: 24, via: '10.0.0.1' }];
  const net = NetSim.create(t);
  const r = net.ping('pcA', '192.168.3.10');
  assert.strictEqual(r.reason, 'ttl_expired');
  assert.ok(/^Reply from 10\.0\.0\.[12]: TTL expired in transit\.$/.test(r.win[1]), r.win[1]);
  assert.ok(/^From 10\.0\.0\.[12] icmp_seq=1 Time to live exceeded$/.test(r.linux[1]), r.linux[1]);
  assert.ok(r.path.length > 20 && r.path.length <= 400);
  const tr = net.traceroute('pcA', '192.168.3.10');
  assert.strictEqual(tr.ok, false);
  assert.strictEqual(tr.hops.length, 30);
  assert.deepStrictEqual(tr.hops.slice(0, 4).map(h => h.ip), ['192.168.1.1', '10.0.0.2', '10.0.0.1', '10.0.0.2']);
  assert.ok(!tr.win.includes('Trace complete.'));
});

it('Wi-Fi association by SSID; mismatch => link down', () => {
  const t = lab();
  t.devices.push({ id: 'ap1', type: 'ap', name: 'AP-Lab', ssid: 'NETLAB', x: 240, y: 80 });
  t.devices.push({ id: 'lap1', type: 'laptop', name: 'Laptop1', ssid: 'NETLAB', x: 120, y: 60, ifaces: [{ name: 'wlan0', ip: '192.168.1.50', prefix: 24 }], gateway: '192.168.1.1', dns: ['192.168.1.5'] });
  t.devices.push({ id: 'lap2', type: 'laptop', name: 'Laptop2', ssid: 'netlab-guest', x: 360, y: 60, ifaces: [{ name: 'wlan0', ip: '192.168.1.51', prefix: 24 }], gateway: '192.168.1.1' });
  t.links.push(link('w1', 'lap1', 'wlan0', 'ap1', 'wifi', { medium: 'wifi' }), link('w2', 'lap2', 'wlan0', 'ap1', 'wifi', { medium: 'wifi' }), link('w3', 'ap1', 'p1', 'sw1', 'p10'));
  const net = NetSim.create(t);
  const ok = net.ping('lap1', '192.168.1.5');
  assert.ok(ok.ok, ok.reason); assert.deepStrictEqual(ok.path, ['lap1', 'ap1', 'sw1', 'srv1']);
  assert.ok(net.ping('lap1', '8.8.8.8').ok);
  const bad = net.ping('lap2', '192.168.1.5');
  assert.strictEqual(bad.reason, 'no_link');
  assert.ok(net.problems().some(p => p.code === 'ssid_mismatch' && p.dev === 'lap2'));
  assert.strictEqual(net.linkState('w2').reason, 'ssid');
  assert.ok(!net.l2Domain('pc1').includes('lap2') && net.l2Domain('pc1').includes('lap1'));
  // wifi link to a switch is invalid
  const t2 = lab();
  t2.devices.push({ id: 'lap3', type: 'laptop', ifaces: [{ name: 'wlan0', ip: '192.168.1.52', prefix: 24 }] });
  t2.links.push(link('w9', 'lap3', 'wlan0', 'sw1', 'p11', { medium: 'wifi' }));
  const n2 = NetSim.create(t2);
  assert.ok(codes(n2).includes('wifi_wrong_end'));
  assert.strictEqual(n2.ping('lap3', '192.168.1.5').reason, 'no_link');
});

// ---------------------------------------------------------------- DHCP
function dhcpLab() {
  const t = lab();
  t.devices[2].services.dhcp = { start: '192.168.1.100', end: '192.168.1.102', prefix: 24, gateway: '192.168.1.1', dns: ['192.168.1.5'] };
  t.devices[0] = { id: 'pc1', type: 'pc', name: 'PC1', ifaces: [{ name: 'eth0' }], dhcp: true };
  t.devices[1] = { id: 'pc2', type: 'pc', name: 'PC2', ifaces: [{ name: 'eth0', ip: '', prefix: '' }], dhcp: true };
  return t;
}
it('DHCP lease from a reachable server, deterministic order, then ping by name works', () => {
  const net = NetSim.create(dhcpLab());
  const c1 = net.config('pc1'), c2 = net.config('pc2');
  assert.strictEqual(c1.ip, '192.168.1.100'); assert.strictEqual(c2.ip, '192.168.1.101');
  assert.strictEqual(c1.gateway, '192.168.1.1'); assert.deepStrictEqual(c1.dns, ['192.168.1.5']);
  assert.strictEqual(c1.dhcp, true); assert.strictEqual(c1.apipa, false); assert.strictEqual(c1.leaseFrom, 'srv1');
  assert.ok(net.ping('pc1', 'srv.lab.local').ok);
  assert.ok(net.ping('pc2', '8.8.8.8').ok);
  // static IP inside the pool is skipped
  const t = dhcpLab(); t.devices.push(pc('pc9', '192.168.1.100', 24, '192.168.1.1')); t.links.push(link('lx', 'pc9', 'eth0', 'sw1', 'p20'));
  const n2 = NetSim.create(t);
  assert.strictEqual(n2.config('pc1').ip, '192.168.1.101');
  assert.ok(!codes(n2).includes('dup_ip'));
  // pool exhausted => APIPA for the last client
  const t3 = dhcpLab(); t3.devices[2].services.dhcp.end = '192.168.1.100';
  const n3 = NetSim.create(t3);
  assert.strictEqual(n3.config('pc1').ip, '192.168.1.100'); assert.ok(n3.config('pc2').apipa);
});

it('APIPA when the DHCP server is unplugged', () => {
  const t = dhcpLab(); t.links[2].up = false; // srv1 cable
  const net = NetSim.create(t);
  const c = net.config('pc1');
  assert.ok(c.apipa); assert.ok(/^169\.254\.\d+\.\d+$/.test(c.ip)); assert.strictEqual(c.prefix, 16); assert.strictEqual(c.gateway, null);
  assert.notStrictEqual(c.ip, net.config('pc2').ip);
  assert.strictEqual(c.ip, NetSim.create(t).config('pc1').ip, 'deterministic');
  assert.ok(net.problems().some(p => p.code === 'dhcp_none' && p.dev === 'pc1'));
  assert.strictEqual(net.ping('pc1', '8.8.8.8').reason, 'no_gateway');
  assert.ok(net.ping('pc1', net.config('pc2').ip).ok, 'APIPA hosts on the same LAN reach each other');
  assert.strictEqual(net.ping('pc1', 'srv.lab.local').reason, 'dns_fail');
});

it('DHCP from a router pool only serves the matching LAN', () => {
  const t = threeNets();
  t.devices[0] = { id: 'pcA', type: 'pc', dhcp: true };
  t.devices[1] = { id: 'pcB', type: 'pc', dhcp: true };
  t.devices.find(d => d.id === 'r1').services = { dhcp: { start: '192.168.1.50', end: '192.168.1.60', gateway: '192.168.1.1' } };
  const net = NetSim.create(t);
  assert.strictEqual(net.config('pcA').ip, '192.168.1.50'); assert.strictEqual(net.config('pcA').prefix, 24);
  assert.ok(net.config('pcB').apipa);
  assert.ok(net.ping('pcA', '192.168.3.10').ok);
});

// ---------------------------------------------------------------- DNS
it('DNS success: local record (authoritative) and forwarded public name', () => {
  const net = NetSim.create(lab());
  const a = net.nslookup('pc1', 'srv.lab.local');
  assert.ok(a.ok); assert.strictEqual(a.ip, '192.168.1.5'); assert.strictEqual(a.server, '192.168.1.5');
  assert.deepStrictEqual(a.lines, ['Server:  dns.lab.local', 'Address:  192.168.1.5', '', 'Name:    srv.lab.local', 'Address:  192.168.1.5']);
  const b = net.nslookup('pc1', 'one.one.one.one');
  assert.ok(b.ok); assert.strictEqual(b.ip, '1.1.1.1');
  assert.ok(b.lines.includes('Non-authoritative answer:'));
  const p = net.ping('pc1', 'www.netlab.test');
  assert.ok(p.ok); assert.strictEqual(p.resolved, '203.0.113.80');
  assert.strictEqual(p.win[0], 'Pinging www.netlab.test [203.0.113.80] with 32 bytes of data:');
  assert.strictEqual(p.linux[0], 'PING www.netlab.test (203.0.113.80) 56(84) bytes of data.');
  // Linux host gets Linux-style lines
  const l = net.nslookup('srv1', 'srv.lab.local');
  assert.deepStrictEqual(l.lines, ['Server:\t\t192.168.1.5', 'Address:\t192.168.1.5#53', '', 'Name:\tsrv.lab.local', 'Address: 192.168.1.5']);
  // public resolver directly
  const t = lab(); t.devices[0].dns = ['8.8.8.8'];
  const g = NetSim.create(t).nslookup('pc1', 'www.netlab.test');
  assert.ok(g.ok); assert.strictEqual(g.lines[0], 'Server:  dns.google'); assert.ok(g.lines.includes('Non-authoritative answer:'));
  assert.strictEqual(NetSim.create(t).nslookup('pc1', 'srv.lab.local').ok, false, 'public DNS does not know local names');
  // explicit server argument
  assert.ok(net.nslookup('pc1', 'www.netlab.test', '8.8.8.8').ok);
  // reverse lookup
  assert.strictEqual(net.nslookup('pc1', '192.168.1.5').name, 'dns.lab.local');
});

it('DNS failures: NXDOMAIN, unreachable server, no forwarding without internet, no DNS configured', () => {
  const net = NetSim.create(lab());
  const nx = net.nslookup('pc1', 'nothing.netlab.test');
  assert.strictEqual(nx.ok, false);
  assert.strictEqual(nx.lines[nx.lines.length - 1], "*** dns.lab.local can't find nothing.netlab.test: Non-existent domain");
  const p = net.ping('pc1', 'nothing.netlab.test');
  assert.strictEqual(p.reason, 'bad_target');
  assert.deepStrictEqual(p.win, ['Ping request could not find host nothing.netlab.test. Please check the name and try again.']);
  assert.deepStrictEqual(p.linux, ['ping: nothing.netlab.test: Name or service not known']);
  // wrong DNS server IP
  const t = lab(); t.devices[0].dns = ['192.168.1.99'];
  const n2 = NetSim.create(t);
  const to = n2.nslookup('pc1', 'srv.lab.local');
  assert.strictEqual(to.ok, false); assert.strictEqual(to.lines[0], 'DNS request timed out.');
  assert.ok(to.lines.includes('*** Request to UnKnown timed-out'));
  assert.strictEqual(n2.ping('pc1', 'srv.lab.local').reason, 'dns_fail');
  assert.deepStrictEqual(n2.ping('pc1', 'srv.lab.local').linux, ['ping: srv.lab.local: Temporary failure in name resolution']);
  // DNS server IP of a host without a DNS service
  const t3 = lab(); t3.devices[0].dns = ['192.168.1.20'];
  assert.strictEqual(NetSim.create(t3).ping('pc1', 'srv.lab.local').reason, 'dns_fail');
  // local DNS without internet: local names ok, public names SERVFAIL
  const t4 = lab(); t4.links[4].up = false;
  const n4 = NetSim.create(t4);
  assert.ok(n4.nslookup('pc1', 'srv.lab.local').ok);
  assert.ok(n4.nslookup('pc1', 'www.netlab.test').ok, 'record exists locally');
  const sf = n4.nslookup('pc1', 'dns.google');
  assert.strictEqual(sf.ok, false); assert.ok(/Server failed$/.test(sf.lines[sf.lines.length - 1]));
  // no DNS configured
  const t5 = lab(); t5.devices[0].dns = [];
  const n5 = NetSim.create(t5);
  assert.ok(codes(n5, 'pc1').includes('dns_missing'));
  assert.strictEqual(n5.ping('pc1', 'srv.lab.local').reason, 'dns_fail');
  assert.strictEqual(n5.nslookup('pc1', 'srv.lab.local').lines[0], '*** Default servers are not available');
  // DNS server reachable only through a router
  const t6 = threeNets();
  t6.devices[1].type = 'server'; t6.devices[1].services = { dns: { records: { 'b.lab': '192.168.2.10' } } };
  t6.devices[0].dns = ['192.168.2.10'];
  assert.ok(NetSim.create(t6).ping('pcA', 'b.lab').ok);
});

// ---------------------------------------------------------------- traceroute
it('traceroute hop list (Windows + Linux format)', () => {
  const net = NetSim.create(lab());
  const tr = net.traceroute('pc1', '8.8.8.8');
  assert.ok(tr.ok);
  assert.deepStrictEqual(tr.hops.map(h => h.ip), ['192.168.1.1', '10.0.0.2', '8.8.8.8']);
  assert.deepStrictEqual(tr.hops.map(h => h.devId), ['r1', 'net', 'net']);
  assert.ok(tr.hops.every(h => typeof h.rttMs === 'number'));
  assert.strictEqual(tr.win[0], 'Tracing route to 8.8.8.8 over a maximum of 30 hops');
  assert.strictEqual(tr.win[1], '');
  assert.ok(/^  1    <1 ms    <1 ms    <1 ms  192\.168\.1\.1$/.test(tr.win[2]) || /^  1     1 ms/.test(tr.win[2]), JSON.stringify(tr.win[2]));
  assert.ok(/^  3    \d\d ms    \d\d ms    \d\d ms  8\.8\.8\.8$/.test(tr.win[4]), JSON.stringify(tr.win[4]));
  assert.deepStrictEqual(tr.win.slice(-2), ['', 'Trace complete.']);
  assert.strictEqual(tr.linux[0], 'traceroute to 8.8.8.8 (8.8.8.8), 30 hops max, 60 byte packets');
  assert.ok(/^ 1  192\.168\.1\.1 \(192\.168\.1\.1\)  [\d.]+ ms  [\d.]+ ms  [\d.]+ ms$/.test(tr.linux[1]), tr.linux[1]);
  const t2 = NetSim.create(threeNets()).traceroute('pcA', '192.168.3.10');
  assert.deepStrictEqual(t2.hops.map(h => h.ip), ['192.168.1.1', '10.0.0.2', '10.0.1.2', '192.168.3.10']);
  // name target
  const tn = net.traceroute('pc1', 'www.netlab.test');
  assert.strictEqual(tn.win[0], 'Tracing route to www.netlab.test [203.0.113.80] over a maximum of 30 hops');
});

it('traceroute timeouts stop after 4 and no Trace complete; unreachable reports', () => {
  const t = lab(); t.devices[2].firewall = { icmp: false };
  const tr = NetSim.create(t).traceroute('pc1', '192.168.1.5');
  assert.strictEqual(tr.ok, false);
  assert.strictEqual(tr.hops.length, 4); assert.ok(tr.hops.every(h => h.timeout));
  assert.strictEqual(tr.win[2], '  1     *        *        *     Request timed out.');
  assert.strictEqual(tr.linux[1], ' 1  * * *');
  assert.ok(!tr.win.includes('Trace complete.'));
  const t2 = lab(); t2.devices[4].routes = [];
  const nr = NetSim.create(t2).traceroute('pc1', '8.8.8.8');
  assert.strictEqual(nr.reason, 'no_route');
  // TTL=1 probe expires at r1 first (TTL is checked before the route lookup), the TTL=2 probe gets net unreachable
  assert.deepStrictEqual(nr.hops.map(h => h.ip), ['192.168.1.1', '192.168.1.1']);
  assert.strictEqual(nr.hops[1].unreachable, 'net');
  assert.ok(/^  2 .*192\.168\.1\.1  reports: Destination net unreachable\.$/.test(nr.win[3]), nr.win[3]);
  assert.ok(/!N/.test(nr.linux[2]));
  const bad = NetSim.create(lab()).traceroute('pc1', 'nope.invalid');
  assert.deepStrictEqual(bad.win, ['Unable to resolve target system name nope.invalid.']);
  const t3 = lab(); t3.links[0].up = false;
  assert.strictEqual(NetSim.create(t3).traceroute('pc1', '8.8.8.8').reason, 'no_link');
});

// ---------------------------------------------------------------- learning tables
it('switch MAC learning and ARP caches reflect traffic so far', () => {
  const net = NetSim.create(lab());
  assert.deepStrictEqual(net.macTable('sw1'), []);
  assert.deepStrictEqual(net.arp('pc1'), []);
  net.ping('pc1', '192.168.1.20');
  const mt = net.macTable('sw1');
  const mac1 = net.config('pc1').mac, mac2 = net.config('pc2').mac;
  assert.deepStrictEqual(mt, [{ mac: mac1, port: 'p1' }, { mac: mac2, port: 'p2' }]);
  assert.deepStrictEqual(net.arp('pc1'), [{ ip: '192.168.1.20', mac: mac2, type: 'dynamic' }]);
  assert.deepStrictEqual(net.arp('pc2'), [{ ip: '192.168.1.10', mac: mac1, type: 'dynamic' }]);
  net.ping('pc1', '8.8.8.8');
  assert.ok(net.arp('pc1').some(e => e.ip === '192.168.1.1'));
  assert.ok(net.macTable('sw1').some(e => e.port === 'p24'));
  assert.ok(net.arp('r1').some(e => e.ip === '10.0.0.2'));
  net.clearArp('pc1'); assert.deepStrictEqual(net.arp('pc1'), []);
  // a failed ARP still floods the request so switches learn the sender
  const n2 = NetSim.create(lab());
  n2.ping('pc2', '192.168.1.77');
  assert.deepStrictEqual(n2.macTable('sw1'), [{ mac: n2.config('pc2').mac, port: 'p2' }]);
});

it('routes() for hosts and routers', () => {
  const net = NetSim.create(lab());
  assert.deepStrictEqual(net.routes('pc1'), [
    { net: '192.168.1.0', prefix: 24, via: null, iface: 'eth0', type: 'C' },
    { net: '0.0.0.0', prefix: 0, via: '192.168.1.1', iface: 'eth0', type: 'D' }]);
  const r = net.routes('r1');
  assert.deepStrictEqual(r.map(x => [x.net, x.prefix, x.via, x.iface]), [
    ['10.0.0.0', 30, null, 'g0/1'], ['192.168.1.0', 24, null, 'g0/0'], ['0.0.0.0', 0, '10.0.0.2', 'g0/1']]);
  const t = lab(); t.links[3].up = false;
  assert.ok(!NetSim.create(t).routes('r1').some(x => x.iface === 'g0/0'), 'connected route disappears when the link is down');
});

it('l2Domain follows switches and APs, stops at routers', () => {
  const net = NetSim.create(threeNets());
  assert.deepStrictEqual(net.l2Domain('pcA'), ['pcA', 'r1']);
  assert.deepStrictEqual(net.l2Domain('swB'), ['pcB', 'r2']);
  assert.deepStrictEqual(net.l2Domain('r2'), ['pcB', 'r1', 'r2', 'r3']);
  const lab1 = NetSim.create(lab());
  assert.deepStrictEqual(lab1.l2Domain('pc1'), ['pc1', 'pc2', 'r1', 'srv1']);
});

it('router interface overlap and switching loop are reported, loop still forwards (STP)', () => {
  const t = lab();
  t.devices[4].ifaces.push({ name: 'g0/2', ip: '192.168.1.129', prefix: 25 });
  t.devices.push({ id: 'sw2', type: 'switch', name: 'Switch2' });
  t.links.push(link('x1', 'sw1', 'p5', 'sw2', 'p1'), link('x2', 'sw1', 'p6', 'sw2', 'p2'));
  const net = NetSim.create(t);
  assert.ok(codes(net).includes('router_overlap'));
  assert.ok(net.problems().some(p => p.code === 'loop' && p.link === 'x2' && p.level === 'warn'));
  assert.ok(net.ping('pc1', '192.168.1.20').ok);
});

// ---------------------------------------------------------------- render
it('render() returns valid SVG using only CSS variables', () => {
  const t = lab();
  t.devices.push({ id: 'ap1', type: 'ap', name: 'AP-Lab', ssid: 'NETLAB', x: 240, y: 60 },
    { id: 'lap1', type: 'laptop', name: 'Laptop1', ssid: 'NETLAB', x: 100, y: 60, ifaces: [{ name: 'wlan0', ip: '192.168.1.50', prefix: 24 }] },
    { id: 'prn', type: 'printer', name: 'Printer<&>', x: 480, y: 330, ifaces: [{ name: 'eth0', ip: '192.168.1.30', prefix: 24 }] });
  t.links.push(link('w1', 'lap1', 'wlan0', 'ap1', 'wifi', { medium: 'wifi' }), link('w2', 'ap1', 'p1', 'sw1', 'p12'), link('w3', 'prn', 'eth0', 'sw1', 'p13', { up: false }));
  const svg = NetSim.render(t, { highlight: ['pc1'], showIp: true });
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && svg.endsWith('</svg>'));
  assert.ok(/viewBox="-?\d+ -?\d+ \d+ \d+"/.test(svg));
  // balanced tags
  const open = (svg.match(/<(?!\/)[a-zA-Z][^>]*[^/]>/g) || []).filter(s => !s.startsWith('<?')).length;
  const close = (svg.match(/<\/[a-zA-Z]+>/g) || []).length;
  assert.strictEqual(open, close, 'balanced tags');
  assert.ok(svg.includes('192.168.1.10/24') && svg.includes('PC1'));
  assert.ok(svg.includes('Printer&lt;&amp;&gt;'), 'escaped');
  assert.ok(svg.includes('stroke-dasharray="7 6"'), 'wifi dashed');
  assert.ok(svg.includes('var(--orange)') && svg.includes('var(--bad)'));
  assert.ok(!/#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(/.test(svg), 'no hard-coded colours');
  const colours = (svg.match(/(?:fill|stroke)="([^"]+)"/g) || []).map(s => s.replace(/^[a-z]+="|"$/g, ''));
  const allowed = new Set(['none', 'var(--ink)', 'var(--muted)', 'var(--line)', 'var(--panel)', 'var(--field)', 'var(--blue)', 'var(--green)', 'var(--orange)', 'var(--bad)', 'var(--ok)']);
  colours.forEach(c => assert.ok(allowed.has(c), 'colour ' + c));
  (svg.match(/font-size="(\d+)"/g) || []).forEach(s => assert.ok(+s.match(/\d+/)[0] >= 12, s));
  assert.ok(!/ id="/.test(svg), 'no ids needed');
  assert.ok(!NetSim.render(t, { showIp: false }).includes('192.168.1.10'));
  assert.ok(NetSim.render({}).includes('ไม่มีอุปกรณ์'));
  assert.ok(NetSim.render(NetSim.create(t), { width: 600 }).includes('width="600"'));
});

// ---------------------------------------------------------------- misc behaviour
it('router as ping source, unknown/odd targets', () => {
  const net = NetSim.create(threeNets());
  assert.ok(net.ping('r1', '192.168.3.10').ok);
  assert.strictEqual(net.ping('pcA', '').reason, 'bad_target');
  assert.strictEqual(net.ping('pcA', '192.168.1.300').reason, 'bad_target');
  assert.strictEqual(net.ping('swA', '192.168.1.1').reason, 'no_ip');
  const r = net.ping('pcA', '192.168.1.99');
  assert.strictEqual(r.reason, 'same_subnet_unreachable'); assert.strictEqual(r.from, '192.168.1.10');
  // remote host missing behind a router: router ARP fails silently => timeout
  assert.strictEqual(net.ping('pcA', '192.168.2.99').reason, 'timeout');
  assert.ok(Object.keys(NetSim.reasonText).length >= 12);
  net.problems().forEach(p => assert.ok(p.msg));
});

it('performance: ping on a 60-device topology < 20 ms', () => {
  const devices = [], links = [];
  devices.push({ id: 'core', type: 'router', name: 'Core', ifaces: [] });
  for (let s = 0; s < 4; s++) {
    devices.push({ id: 'sw' + s, type: 'switch', name: 'SW' + s });
    devices[0].ifaces.push({ name: 'g0/' + s, ip: `10.${s}.0.1`, prefix: 24 });
    links.push(link('u' + s, 'core', 'g0/' + s, 'sw' + s, 'p24'));
    for (let h = 0; h < 13; h++) {
      const id = `h${s}_${h}`;
      devices.push(pc(id, `10.${s}.0.${10 + h}`, 24, `10.${s}.0.1`));
      links.push(link('k' + id, id, 'eth0', 'sw' + s, 'p' + (h + 1)));
    }
  }
  for (let i = devices.length; i < 60; i++) devices.push({ id: 'x' + i, type: 'printer' });
  assert.ok(devices.length >= 60);
  const net = NetSim.create({ devices, links });
  const t0 = process.hrtime.bigint();
  const r = net.ping('h0_0', '10.3.0.22');
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(r.ok, r.reason);
  assert.ok(ms < 20, 'ping took ' + ms.toFixed(2) + ' ms');
  const t1 = process.hrtime.bigint();
  const fresh = NetSim.create({ devices, links }); fresh.ping('h3_12', '10.1.0.15'); fresh.traceroute('h3_12', '10.1.0.15');
  const ms2 = Number(process.hrtime.bigint() - t1) / 1e6;
  assert.ok(ms2 < 100, 'create+ping+traceroute took ' + ms2.toFixed(2) + ' ms');
});


// ---------------------------------------------------------------- trace(): hop-by-hop path + precise failure reasons
function twoNets() {
  // 192.168.1.0/24 (pc1, pc2 on swA) -- r1 -- 192.168.2.0/24 (pc3 on swB)
  return {
    devices: [
      pc('pc1', '192.168.1.10', 24, '192.168.1.1'), pc('pc2', '192.168.1.11', 24, '192.168.1.1'),
      pc('pc3', '192.168.2.10', 24, '192.168.2.1'),
      { id: 'swA', type: 'switch', name: 'SwA' }, { id: 'swB', type: 'switch', name: 'SwB' },
      { id: 'r1', type: 'router', name: 'R1', ifaces: [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24 }, { name: 'g0/1', ip: '192.168.2.1', prefix: 24 }], routes: [] }
    ],
    links: [link('l1', 'pc1', 'eth0', 'swA', 'p1'), link('l2', 'pc2', 'eth0', 'swA', 'p2'), link('l3', 'r1', 'g0/0', 'swA', 'p24'),
      link('l4', 'r1', 'g0/1', 'swB', 'p24'), link('l5', 'pc3', 'eth0', 'swB', 'p1')]
  };
}
const tr = (t, s, d, o) => NetSim.create(t).trace(s, d, o);
const sameReason = (t, s, d) => { const a = NetSim.create(t).ping(s, d), b = NetSim.create(t).trace(s, d); assert.strictEqual(b.reason, a.reason, `trace ${b.reason} vs ping ${a.reason}`); assert.strictEqual(b.ok, a.ok); return b; };

it('trace: same subnet = ARP + Echo Request through the switch + Echo Reply (no 2nd ARP)', () => {
  const r = sameReason(twoNets(), 'pc1', '192.168.1.11');
  assert.ok(r.ok); assert.strictEqual(r.code, 'ok'); assert.strictEqual(r.responder, 'pc2');
  assert.deepStrictEqual(r.hops.map(h => h.phase + ':' + h.proto), ['request:arp', 'request:icmp', 'reply:icmp']);
  assert.deepStrictEqual(r.hops[1].path, ['pc1', 'swA', 'pc2']);
  assert.deepStrictEqual(r.hops[2].path, ['pc2', 'swA', 'pc1']);
  assert.ok(/ARP/.test(r.hops[0].text) && /SwA/.test(r.hops[1].text));
  assert.strictEqual(r.failHop, -1);
});
it('trace: routed ping lists each L3 hop and ARP for the gateway and for the far host', () => {
  const r = sameReason(twoNets(), 'pc1', '192.168.2.10');
  assert.ok(r.ok);
  const icmp = r.hops.filter(h => h.proto === 'icmp' && h.phase === 'request');
  assert.deepStrictEqual(icmp.map(h => h.from + '>' + h.to), ['pc1>r1', 'r1>pc3']);
  assert.strictEqual(r.hops.filter(h => h.proto === 'arp').length, 2);
  assert.ok(/R1 รับแล้วส่งต่อ/.test(icmp[0].text));
  const rep = r.hops.filter(h => h.phase === 'reply').map(h => h.from + '>' + h.to);
  assert.deepStrictEqual(rep, ['pc3>r1', 'r1>pc1']);
});
it('trace: unplugged source cable = ไม่มีสายต่อ (no hops, stops at the source)', () => {
  const t = twoNets(); t.links[0].up = false;
  const r = sameReason(t, 'pc1', '192.168.1.11');
  assert.strictEqual(r.code, 'src_no_link'); assert.strictEqual(r.title, 'ไม่มีสายต่อ');
  assert.strictEqual(r.hops.length, 0); assert.strictEqual(r.stopAt, 'pc1'); assert.ok(/l1/.test(r.msg));
});
it('trace: disabled source adapter = พอร์ตปิด', () => {
  const t = twoNets(); t.devices[0].ifaces[0].up = false;
  const r = sameReason(t, 'pc1', '192.168.1.11');
  assert.strictEqual(r.code, 'src_port_down'); assert.strictEqual(r.title, 'พอร์ตปิด');
});
it('trace: destination adapter disabled = พอร์ตปิด at the ARP hop', () => {
  const t = twoNets(); t.devices[1].ifaces[0].up = false;
  const r = sameReason(t, 'pc1', '192.168.1.11');
  assert.strictEqual(r.reason, 'same_subnet_unreachable');
  assert.strictEqual(r.code, 'port_down'); assert.ok(/PC2/.test(r.msg));
  const last = r.hops[r.failHop]; assert.strictEqual(last.proto, 'arp'); assert.strictEqual(last.ok, false);
  assert.strictEqual(r.stopAt, 'pc1');
});
it('trace: destination cable unplugged = ไม่มีสายต่อ naming the link', () => {
  const t = twoNets(); t.links[1].up = false;
  const r = sameReason(t, 'pc1', '192.168.1.11');
  assert.strictEqual(r.code, 'no_link'); assert.ok(/l2/.test(r.msg), r.msg);
});
it('trace: different subnet without gateway = อยู่ต่างวงและไม่ได้ตั้ง Default Gateway (+ same LAN tip)', () => {
  const t = twoNets(); t.devices[0].gateway = ''; t.devices[1].ifaces[0].ip = '192.168.5.11';
  const r = sameReason(t, 'pc1', '192.168.5.11');
  assert.strictEqual(r.reason, 'no_gateway'); assert.strictEqual(r.code, 'no_gateway');
  assert.strictEqual(r.title, 'อยู่ต่างวงและไม่ได้ตั้ง Default Gateway');
  assert.ok(/เครือข่ายสายเดียวกัน/.test(r.msg), r.msg);
  assert.strictEqual(r.hops.length, 0);
});
it('trace: gateway outside own subnet = Gateway ไม่อยู่ในวงเดียวกับเครื่อง', () => {
  const t = twoNets(); t.devices[0].gateway = '192.168.9.1';
  const r = sameReason(t, 'pc1', '192.168.2.10');
  assert.strictEqual(r.code, 'gw_not_in_subnet'); assert.strictEqual(r.title, 'Gateway ไม่อยู่ในวงเดียวกับเครื่อง');
});
it('trace: wrong gateway IP in own subnet = หา Default Gateway ไม่พบ', () => {
  const t = twoNets(); t.devices[0].gateway = '192.168.1.254';
  const r = sameReason(t, 'pc1', '192.168.2.10');
  assert.strictEqual(r.reason, 'gateway_unreachable'); assert.strictEqual(r.code, 'gateway_not_found');
});
it('trace: router without route = Router ไม่มีเส้นทางไปวงปลายทาง, packet stops at the router', () => {
  const r = sameReason(twoNets(), 'pc1', '10.9.9.9');
  assert.strictEqual(r.code, 'no_route'); assert.strictEqual(r.stopAt, 'r1');
  assert.ok(r.hops.some(h => h.proto === 'icmp' && h.to === 'r1'));
  assert.strictEqual(r.title, 'Router ไม่มีเส้นทางไปวงปลายทาง');
});
it('trace: router interface shut down = พอร์ตปิด on that router leg', () => {
  const t = twoNets(); t.devices[5].ifaces[1].up = false;
  const r = sameReason(t, 'pc1', '192.168.2.10');
  assert.strictEqual(r.code, 'port_down'); assert.ok(/g0\/1/.test(r.msg), r.msg);
});
it('trace: destination without gateway = ปลายทางไม่ตอบกลับ (reply leg stops at the destination)', () => {
  const t = twoNets(); t.devices[2].gateway = '';
  const r = sameReason(t, 'pc1', '192.168.2.10');
  assert.strictEqual(r.reason, 'timeout'); assert.strictEqual(r.code, 'reply_no_gateway');
  assert.ok(/ไม่ตอบกลับ/.test(r.title)); assert.strictEqual(r.stopAt, 'pc3');
  assert.ok(r.hops.some(h => h.to === 'pc3'));
});
it('trace: duplicate IP — expected device differs from the one that answered', () => {
  const t = twoNets(); t.devices.push(pc('pc0', '192.168.1.11', 24, '192.168.1.1')); t.links.push(link('l6', 'pc0', 'eth0', 'swA', 'p3'));
  const r = tr(t, 'pc1', '192.168.1.11', { expect: 'pc2' });
  assert.ok(r.ok); assert.strictEqual(r.code, 'dup_ip'); assert.ok(r.wrongResponder); assert.strictEqual(r.responder, 'pc0');
  assert.strictEqual(r.title, 'IP ซ้ำ');
  const r2 = tr(t, 'pc1', '192.168.1.11');
  assert.ok(r2.warn && /ซ้ำ/.test(r2.warn));
});
it('trace: duplicate source IP — reply goes to the other machine', () => {
  const t = twoNets(); t.devices.push(pc('pc0', '192.168.1.10', 24, '192.168.1.1')); t.links.push(link('l6', 'pc0', 'eth0', 'swA', 'p3'));
  const r = sameReason(t, 'pc1', '192.168.1.11');
  assert.strictEqual(r.code, 'dup_ip'); assert.strictEqual(r.stopAt, 'pc0');
});
it('trace: firewall drops ICMP at the destination', () => {
  const t = twoNets(); t.devices[1].firewall = { icmp: false };
  const r = sameReason(t, 'pc1', '192.168.1.11');
  assert.strictEqual(r.code, 'firewall'); assert.strictEqual(r.stopAt, 'pc2');
});
it('trace: no host with that IP = ไม่พบเครื่องปลายทางในวงนี้; routing loop = TTL', () => {
  assert.strictEqual(sameReason(twoNets(), 'pc1', '192.168.1.99').code, 'host_not_found');
  const t = threeNets(); t.devices.find(d => d.id === 'r3').routes = [{ net: '0.0.0.0', prefix: 0, via: '10.0.1.1' }];
  t.devices.find(d => d.id === 'r2').routes = [{ net: '0.0.0.0', prefix: 0, via: '10.0.1.2' }];
  const r = sameReason(t, 'pcC', '172.16.0.1');
  assert.strictEqual(r.code, 'ttl_expired');
});
it('trace: never throws on bad input and is deterministic', () => {
  const n = NetSim.create({});
  assert.strictEqual(n.trace('nope', '1.2.3.4').ok, false);
  assert.strictEqual(NetSim.create(twoNets()).trace('swA', '192.168.1.10').ok, false);
  assert.deepStrictEqual(tr(twoNets(), 'pc1', '192.168.2.10'), tr(twoNets(), 'pc1', '192.168.2.10'));
  Object.keys(NetSim.traceText).forEach(k => assert.ok(NetSim.traceText[k].title, k));
});


// ---------------------------------------------------------------- 2.8 additions (power, hub, frames, filters, Wi-Fi key, isolation)
it('2.8 power off: source off => device_off; target off / switch off => trace code device_off', () => {
  let t = lab(); t.devices.find(d => d.id === 'pc1').power = false;
  let n = NetSim.create(t);
  assert.ok(codes(n, 'pc1').includes('device_off'));
  assert.strictEqual(n.config('pc1').power, false);
  assert.strictEqual(n.linkState('l1').reason, 'off');
  const p = n.ping('pc1', '192.168.1.20');
  assert.strictEqual(p.ok, false); assert.strictEqual(p.reason, 'device_off');
  assert.strictEqual(n.trace('pc1', '192.168.1.20').code, 'device_off');
  const r = n.trace('pc2', '192.168.1.10');
  assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'device_off'); assert.ok(/ปิดเครื่อง/.test(r.msg));
  assert.strictEqual(r.title, NetSim.traceText.device_off.title);
  // the switch is off: every PC loses its link, the trace names the switch
  t = lab(); t.devices.find(d => d.id === 'sw1').power = false; n = NetSim.create(t);
  assert.strictEqual(n.ping('pc1', '192.168.1.20').reason, 'no_link');
  const r2 = n.trace('pc1', '192.168.1.20');
  assert.strictEqual(r2.code, 'device_off'); assert.ok(/Switch1/.test(r2.msg));
  // power back on = same as before
  t.devices.find(d => d.id === 'sw1').power = true;
  assert.ok(NetSim.create(t).ping('pc1', '192.168.1.20').ok);
  assert.strictEqual(NetSim.create(t).topo.devices.find(d => d.id === 'sw1').power, undefined);
});
it('2.8 power off: router off => gateway unreachable explained as device_off; middle switch off => device_off', () => {
  let t = lab(); t.devices.find(d => d.id === 'r1').power = false;
  let n = NetSim.create(t);
  assert.strictEqual(n.ping('pc1', '8.8.8.8').reason, 'gateway_unreachable');
  const r = n.trace('pc1', '8.8.8.8');
  assert.strictEqual(r.code, 'device_off'); assert.ok(/Router1/.test(r.msg));
  // pc1 - swA - swB(off) - swC - pc2
  t = { devices: [pc('pc1', '10.1.1.1', 24), pc('pc2', '10.1.1.2', 24), { id: 'swA', type: 'switch' }, { id: 'swB', type: 'switch', name: 'SW-MID', power: 'off' }, { id: 'swC', type: 'switch' }],
    links: [link('l1', 'pc1', 'eth0', 'swA', 'p1'), link('l2', 'swA', 'p2', 'swB', 'p1'), link('l3', 'swB', 'p2', 'swC', 'p1'), link('l4', 'pc2', 'eth0', 'swC', 'p2')] };
  n = NetSim.create(t);
  assert.strictEqual(n.ping('pc1', '10.1.1.2').reason, 'same_subnet_unreachable');
  const m = n.trace('pc1', '10.1.1.2');
  assert.strictEqual(m.code, 'device_off'); assert.ok(/SW-MID/.test(m.msg));
});
function hubLan(type) {
  return { devices: [pc('pc1', '10.0.0.1', 24), pc('pc2', '10.0.0.2', 24), pc('pc3', '10.0.0.3', 24), pc('pc4', '10.0.0.4', 24), { id: 'h1', type, name: 'H1' }],
    links: [link('l1', 'pc1', 'eth0', 'h1', 'p1'), link('l2', 'pc2', 'eth0', 'h1', 'p2'), link('l3', 'pc3', 'eth0', 'h1', 'p3'), link('l4', 'pc4', 'eth0', 'h1', 'p4')] };
}
it('2.8 hub: normalised as switch+hub, no MAC learning, every frame flooded, one collision domain', () => {
  const n = NetSim.create(hubLan('hub'));
  const h = n.topo.devices.find(d => d.id === 'h1');
  assert.strictEqual(h.type, 'switch'); assert.strictEqual(h.hub, true);
  assert.ok(n.ping('pc1', '10.0.0.2').ok);
  assert.deepStrictEqual(n.macTable('h1'), []);
  const t = n.trace('pc1', '10.0.0.2');
  const req = t.hops.find(x => x.proto === 'icmp' && x.phase === 'request');
  assert.deepStrictEqual(req.flood, ['pc3', 'pc4']);     // the hub repeats the unicast to everybody
  const cd = n.collisionDomains();
  assert.strictEqual(cd.length, 1); assert.strictEqual(cd[0].kind, 'hub'); assert.deepStrictEqual(cd[0].devs, ['pc1', 'pc2', 'pc3', 'pc4']);
  assert.ok(NetSim.render(hubLan('hub')).includes('>HUB<'));
  // a switch behind the hub learns from the repeated copies and filters frames that stay on the hub side
  const t2 = hubLan('hub'); t2.devices.push({ id: 'sw9', type: 'switch' }, pc('pc9', '10.0.0.9', 24));
  t2.links.push(link('l8', 'h1', 'p8', 'sw9', 'p1'), link('l9', 'pc9', 'eth0', 'sw9', 'p2'));
  const n2 = NetSim.create(t2);
  const r2 = n2.trace('pc1', '10.0.0.2');
  assert.deepStrictEqual(r2.hops.find(x => x.proto === 'icmp').flood, ['pc3', 'pc4']);   // not pc9: the switch filters it
  assert.ok(n2.macTable('sw9').some(e => e.port === 'p1'));
});
it('2.8 switch: learns MACs, floods only unknown unicast, one collision domain per port', () => {
  const n = NetSim.create(hubLan('switch'));
  const t = n.trace('pc1', '10.0.0.2');
  const arp = t.hops.find(x => x.proto === 'arp');
  assert.deepStrictEqual(arp.flood, ['pc3', 'pc4']);       // ARP request is a broadcast
  assert.strictEqual(arp.frame.dstMac, 'FF-FF-FF-FF-FF-FF'); assert.strictEqual(arp.frame.type, 'ARP (0x0806)');
  const req = t.hops.find(x => x.proto === 'icmp' && x.phase === 'request');
  assert.deepStrictEqual(req.flood, []);                    // learned from the ARP reply: forwarded to one port only
  assert.strictEqual(n.macTable('sw1').length, 0);
  assert.strictEqual(n.macTable('h1').length, 2);
  assert.strictEqual(n.collisionDomains().length, 4);
  assert.ok(n.collisionDomains().every(c => c.kind === 'port'));
  // unknown destination MAC (table cleared, ARP cached) => flood
  n.clearMac('h1');
  const t2 = n.trace('pc1', '10.0.0.2');
  assert.ok(!t2.hops.some(x => x.proto === 'arp'));
  assert.deepStrictEqual(t2.hops.find(x => x.proto === 'icmp').flood, ['pc3', 'pc4']);
});
it('2.8 frame inspector data: MACs rewritten per hop, TTL decremented by the router', () => {
  const n = NetSim.create(lab());
  const t = n.trace('pc1', '8.8.8.8');
  const req = t.hops.filter(x => x.proto === 'icmp' && x.phase === 'request');
  assert.strictEqual(req[0].frame.type, 'IPv4 (0x0800)');
  assert.strictEqual(req[0].frame.srcIp, '192.168.1.10'); assert.strictEqual(req[0].frame.dstIp, '8.8.8.8');
  assert.strictEqual(req[0].frame.ttl, 128); assert.strictEqual(req[1].frame.ttl, 127);
  assert.strictEqual(req[0].frame.srcMac, n.config('pc1').mac);
  assert.strictEqual(req[0].frame.dstMac, n.config('r1').ifaces[0].mac);
  assert.strictEqual(req[1].frame.srcMac, n.config('r1').ifaces[1].mac);
  const rep = t.hops.filter(x => x.proto === 'icmp' && x.phase === 'reply');
  assert.strictEqual(rep[rep.length - 1].frame.dstIp, '192.168.1.10'); assert.strictEqual(rep[rep.length - 1].frame.srcIp, '8.8.8.8');
});
function filtered(rules) {
  const t = clone(threeNetsNoLoop());
  t.devices.find(d => d.id === 'r1').filters = rules;
  return t;
}
function threeNetsNoLoop() { return threeNets(); }
it('2.8 router filter: deny blocks forwarded traffic (stateless, replies too), permit/order/proto respected', () => {
  let n = NetSim.create(filtered([{ action: 'deny', src: '192.168.1.0/24', dst: '192.168.3.0/24', proto: 'any' }]));
  const p = n.ping('pcA', '192.168.3.10');
  assert.strictEqual(p.ok, false); assert.strictEqual(p.reason, 'timeout'); assert.ok(p.win.some(l => /Request timed out/.test(l)));
  let t = n.trace('pcA', '192.168.3.10');
  assert.strictEqual(t.code, 'blocked'); assert.strictEqual(t.stopAt, 'r1'); assert.ok(/ข้อที่ 1/.test(t.msg));
  assert.strictEqual(n.trace('pcC', '192.168.1.10').code, 'reply_blocked');   // request passes, reply is denied
  assert.ok(n.ping('pcA', '192.168.2.10').ok);                               // other networks still work
  // permit before deny wins; protocol filter
  n = NetSim.create(filtered([{ action: 'permit', src: '192.168.1.10', dst: 'any' }, { action: 'deny', src: 'any', dst: 'any' }]));
  assert.strictEqual(n.trace('pcA', '192.168.3.10').code, 'reply_blocked');   // stateless: the reply needs its own permit
  n = NetSim.create(filtered([{ action: 'permit', src: '192.168.1.10', dst: 'any' }, { action: 'permit', src: 'any', dst: '192.168.1.10/32' }, { action: 'deny', src: 'any', dst: 'any' }]));
  assert.ok(n.ping('pcA', '192.168.3.10').ok);
  n = NetSim.create(filtered([{ action: 'deny', src: 'any', dst: '192.168.3.0/24', proto: 'udp' }]));
  assert.ok(n.ping('pcA', '192.168.3.10').ok);
  // bad rule reported and skipped
  n = NetSim.create(filtered([{ action: 'drop', src: 'x', dst: 'any' }]));
  assert.ok(codes(n, 'r1').includes('filter_bad')); assert.ok(n.ping('pcA', '192.168.3.10').ok);
});
it('2.8 Wi-Fi passphrase and client isolation', () => {
  const base = () => ({ devices: [
    { id: 'ap1', type: 'ap', name: 'AP1', ssid: 'KRU', security: 'WPA2', passphrase: 'Secret#2026' },
    { id: 'sw1', type: 'switch' }, pc('pc1', '10.0.0.1', 24),
    { id: 'lt1', type: 'laptop', name: 'LT1', ifaces: [{ name: 'wlan0', ip: '10.0.0.11', prefix: 24 }], ssid: 'KRU', wifiKey: 'Secret#2026' },
    { id: 'lt2', type: 'laptop', name: 'LT2', ifaces: [{ name: 'wlan0', ip: '10.0.0.12', prefix: 24 }], ssid: 'KRU', wifiKey: 'wrong' }],
    links: [link('l1', 'ap1', 'p1', 'sw1', 'p1'), link('l2', 'pc1', 'eth0', 'sw1', 'p2'), link('l3', 'lt1', 'wlan0', 'ap1', 'wifi', { medium: 'wifi' }), link('l4', 'lt2', 'wlan0', 'ap1', 'wifi', { medium: 'wifi' })] });
  let n = NetSim.create(base());
  assert.strictEqual(n.linkState('l3').active, true);
  assert.strictEqual(n.linkState('l4').reason, 'auth');
  assert.ok(codes(n, 'lt2').includes('wifi_auth'));
  assert.strictEqual(n.trace('lt2', '10.0.0.1').code, 'wifi_auth');
  assert.ok(n.ping('lt1', '10.0.0.1').ok);
  let t = base(); t.devices[0].security = 'Open'; assert.strictEqual(NetSim.create(t).linkState('l4').active, true);
  // isolation: Wi-Fi clients cannot reach each other, wired is fine; collision domain of the radio is shared
  t = base(); t.devices[4].wifiKey = 'Secret#2026'; t.devices[0].isolation = true;
  n = NetSim.create(t);
  assert.ok(n.ping('lt1', '10.0.0.1').ok);
  assert.strictEqual(n.ping('lt1', '10.0.0.12').reason, 'same_subnet_unreachable');
  assert.strictEqual(n.trace('lt1', '10.0.0.12').code, 'ap_isolation');
  t.devices[0].isolation = false; n = NetSim.create(t);
  assert.ok(n.ping('lt1', '10.0.0.12').ok);
  assert.ok(n.collisionDomains().some(c => c.kind === 'wifi' && c.devs.includes('lt1') && c.devs.includes('lt2')));
});
it('2.8 capstone helpers: VLSM sizes, empty topology scores 0, never throws', () => {
  const C = NetSim.capstone;
  assert.deepStrictEqual(C.CAP.areas.map(a => a.prefix), [26, 27, 28]);
  assert.strictEqual(C.needPrefix(31), 26); assert.strictEqual(C.needPrefix(30), 27); assert.strictEqual(C.needPrefix(10), 28);
  assert.strictEqual(C.evaluate({ devices: [], links: [] }, {}).score, 0);
  assert.strictEqual(C.evaluate(null, null).score, 0);
  assert.strictEqual(C.evaluate({ devices: 'x' }, { plan: 5, fault: { baseline: 7 } }).score, 0);
  assert.strictEqual(C.pickFault({ devices: [], links: [] }, {}), null);
});

// ---------------------------------------------------------------- 3.1 NAT/PAT, ACL, port tests
const NL = NetSim.natlab;
const dv = (t, id) => t.devices.find(d => d.id === id);
function natSol10() { const t = NL.start('t10'); const r = dv(t, 'r1'); r.ifaces[0].nat = 'inside'; r.ifaces[1].nat = 'outside'; r.nat = { pat: { iface: 'g0/1', src: '192.168.1.0/24' } }; return t; }
function natSol11() {
  const t = NL.start('t11'); const r = dv(t, 'r1'); r.ifaces[0].nat = 'inside'; r.ifaces[1].nat = 'outside';
  r.nat = { pat: { iface: 'g0/1', src: '192.168.1.0 0.0.0.255' }, statics: [{ proto: 'tcp', local: '192.168.1.10', lport: 443, global: '198.51.100.2', gport: 443 }, { proto: 'tcp', local: '192.168.1.10', lport: 80, global: '198.51.100.2', gport: 80 }] };
  dv(t, 'srv1').gateway = '192.168.1.1'; return t;
}
function aclT12(rules, iface, dir) { const t = NL.start('t12'); dv(t, 'r1').acls = [{ name: 'STUDENT-IN', iface: iface === undefined ? 'g0/0' : iface, dir: dir || 'in', rules }]; return t; }
const WEB_RULES = () => [
  { action: 'permit', proto: 'tcp', src: '192.168.10.0 0.0.0.255', dst: 'host 192.168.30.10', port: '80' },
  { action: 'permit', proto: 'tcp', src: '192.168.10.0 0.0.0.255', dst: 'host 192.168.30.10', port: 'https' },
  { action: 'permit', proto: 'udp', src: '192.168.10.0/24', dst: 'host 192.168.30.53', port: 'dns' }];

it('3.1 opt-in: an old topology (no NAT fields) still reaches the Internet with private addresses, nothing new appears', () => {
  const n = NetSim.create(lab());
  assert.ok(n.ping('pc1', '8.8.8.8').ok);
  const t = n.trace('pc1', '8.8.8.8');
  assert.strictEqual(t.code, 'ok'); assert.deepStrictEqual(t.acl, []); assert.deepStrictEqual(t.nat, []); assert.strictEqual(t.proto, 'icmp');
  assert.ok(t.hops.every(h => !h.natNote));
  assert.deepStrictEqual(n.natTable('r1'), []); assert.deepStrictEqual(n.acls('r1'), []);
  assert.ok(n.config('r1').ifaces.every(f => !('nat' in f)));
  assert.ok(!codes(n).some(c => /^(nat_|acl_)/.test(c)));
  assert.strictEqual(n.traceroute('pc1', '8.8.8.8').ok, true);
  assert.strictEqual(n.nslookup('pc1', 'www.netlab.test').ip, '203.0.113.80');
});
it('3.1 opt-in: requireNat on the ISP drops private sources with a Thai reason that names the router-side cause', () => {
  const t = lab(); t.devices.find(d => d.id === 'net').requireNat = true;
  const n = NetSim.create(t);
  const p = n.ping('pc1', '8.8.8.8');
  assert.strictEqual(p.ok, false); assert.ok(p.win.some(l => /Request timed out/.test(l)));
  const tr = n.trace('pc1', '8.8.8.8');
  assert.strictEqual(tr.code, 'nat_missing'); assert.strictEqual(tr.stopAt, 'net');
  assert.ok(/Private IP 192\.168\.1\.10/.test(tr.msg) && /ยังไม่ได้ตั้งค่า NAT/.test(tr.msg), tr.msg);
  assert.ok(tr.hint && /nat inside/.test(tr.hint));
  // lab() uses a private WAN (10.0.0.0/30): even the router is dropped; a router with a public WAN needs no NAT
  assert.strictEqual(n.ping('r1', '8.8.8.8').ok, false);
  assert.ok(NetSim.create(NL.start('t10')).ping('r1', '8.8.8.8').ok);
  // DNS through the Internet fails the same way
  assert.strictEqual(n.resolve('pc2', 'www.google.test').ok, false);
});
it('3.1 PAT: every PC reaches 8.8.8.8 and the web; one public IP, ICMP ids / ports translated; table and hop notes', () => {
  const n = NetSim.create(natSol10());
  ['pc1', 'pc2', 'pc3'].forEach(id => assert.ok(n.ping(id, '8.8.8.8').ok, id));
  const w = n.trace('pc1', '203.0.113.80', { proto: 'tcp', port: 443 });
  assert.strictEqual(w.code, 'ok', w.msg); assert.ok(/TCP/.test(w.msg));
  assert.ok(w.nat.some(x => x.kind === 'PAT' && x.dir === 'out' && /^192\.168\.1\.11:/.test(x.from) && /^198\.51\.100\.2:/.test(x.to)));
  assert.ok(w.nat.some(x => x.dir === 'in' && x.field === 'dst'));
  const after = w.hops.find(h => h.proto === 'tcp' && h.phase === 'request' && h.from === 'r1');
  assert.strictEqual(after.frame.srcIp, '198.51.100.2'); assert.strictEqual(after.frame.dstPort, 443); assert.ok(/NAT/.test(after.text));
  const rows = n.natTable('r1');
  const icmp = rows.filter(r => r.proto === 'icmp' && r.type === 'PAT');
  assert.strictEqual(icmp.length, 3);
  assert.deepStrictEqual(icmp.map(r => r.insideGlobal), ['198.51.100.2:1', '198.51.100.2:2', '198.51.100.2:3']);   // same Windows echo id 1 -> unique ports
  assert.ok(icmp.every(r => r.outsideGlobal === '8.8.8.8:1'));
  // name resolution through PAT (DNS 8.8.8.8, UDP 53) and a traceroute across the ISP
  assert.strictEqual(n.resolve('pc2', 'www.netlab.test').ip, '203.0.113.80');
  const tr = n.traceroute('pc3', '8.8.8.8');
  assert.strictEqual(tr.ok, true); assert.deepStrictEqual(tr.hops.map(h => h.ip), ['192.168.1.1', '198.51.100.1', '8.8.8.8']);
  assert.ok(n.config('r1').ifaces[0].nat === 'inside' && n.config('r1').ifaces[1].nat === 'outside');
});
it('3.1 PAT mistakes: swapped inside/outside, PAT on the wrong interface, mask typed as wildcard, no PAT', () => {
  let t = natSol10(); dv(t, 'r1').ifaces[0].nat = 'outside'; dv(t, 'r1').ifaces[1].nat = 'inside';
  let tr = NetSim.create(t).trace('pc1', '8.8.8.8');
  assert.strictEqual(tr.code, 'nat_missing'); assert.ok(/สลับกัน/.test(tr.msg), tr.msg);
  t = natSol10(); dv(t, 'r1').nat.pat.iface = 'g0/0';
  let n = NetSim.create(t);
  assert.ok(codes(n, 'r1').includes('nat_bad')); assert.strictEqual(n.trace('pc1', '8.8.8.8').code, 'nat_missing');
  t = natSol10(); dv(t, 'r1').nat.pat.src = '192.168.1.0 255.255.255.0';
  n = NetSim.create(t);
  assert.ok(codes(n, 'r1').includes('acl_wildcard'));
  tr = n.trace('pc1', '8.8.8.8'); assert.ok(/ไม่ครอบคลุม/.test(tr.msg) && /255\.255\.255\.0/.test(tr.msg), tr.msg);
  t = natSol10(); delete dv(t, 'r1').nat;
  assert.ok(/ยังไม่ได้เปิด PAT/.test(NetSim.create(t).trace('pc2', '8.8.8.8').msg));
  // wildcard and prefix forms are equivalent
  t = natSol10(); dv(t, 'r1').nat.pat.src = '192.168.1.0 0.0.0.255';
  assert.ok(NetSim.create(t).ping('pc3', '8.8.8.8').ok);
});
it('3.1 port forwarding: outside -> public IP:443 reaches the web server; other ports are refused; private IP is not routable', () => {
  const n = NetSim.create(natSol11());
  const ok = n.trace('opc1', '198.51.100.2', { proto: 'tcp', port: 443 });
  assert.strictEqual(ok.code, 'ok', ok.msg); assert.strictEqual(ok.responder, 'srv1'); assert.ok(/192\.168\.1\.10:443/.test(ok.msg));
  assert.ok(ok.nat.some(x => x.kind === 'static' && x.dir === 'in') && ok.nat.some(x => x.kind === 'static' && x.dir === 'out'));
  assert.ok(n.natTable('r1').some(r => r.type === 'static' && r.insideGlobal === '198.51.100.2:443' && r.insideLocal === '192.168.1.10:443' && r.outsideGlobal === null));
  assert.ok(n.natTable('r1').some(r => r.type === 'static' && r.outsideGlobal === '192.0.2.50:' + ok.hops.find(h => h.phase === 'request' && h.proto === 'tcp').frame.srcPort));
  const rdp = n.trace('opc1', '198.51.100.2', { proto: 'tcp', port: 3389 });
  assert.strictEqual(rdp.code, 'refused'); assert.strictEqual(rdp.responder, 'r1'); assert.ok(/Port forwarding/.test(rdp.msg));
  assert.strictEqual(n.trace('opc1', '192.168.1.10', { proto: 'tcp', port: 443 }).code, 'private_dst');
  assert.ok(n.ping('pc1', '8.8.8.8').ok);                                  // PAT still works next to the static entries
  assert.strictEqual(n.trace('pc1', '192.168.1.10', { proto: 'tcp', port: 3389 }).code, 'ok');   // inside users are not affected
  // 1:1 static NAT (all ports) exposes RDP too
  let t = natSol11(); dv(t, 'r1').nat.statics = [{ proto: 'ip', local: '192.168.1.10', global: '198.51.100.2' }];
  assert.strictEqual(NetSim.create(t).trace('opc1', '198.51.100.2', { proto: 'tcp', port: 3389 }).responder, 'srv1');
  // the server without a gateway receives the request but cannot answer
  t = natSol11(); dv(t, 'srv1').gateway = '';
  const ng = NetSim.create(t).trace('opc1', '198.51.100.2', { proto: 'tcp', port: 443 });
  assert.strictEqual(ng.code, 'reply_no_gateway'); assert.ok(/WebServer/.test(ng.msg));
});
it('3.1 static NAT to another public address uses proxy ARP; a static global outside every outside subnet is reported', () => {
  const t = natSol11();
  dv(t, 'net1').ifaces[0].prefix = 29; dv(t, 'r1').ifaces[1].prefix = 29;
  dv(t, 'r1').nat.statics = [{ proto: 'ip', local: '192.168.1.10', global: '198.51.100.5' }];
  const n = NetSim.create(t);
  const r = n.trace('opc1', '198.51.100.5', { proto: 'tcp', port: 22 });
  assert.strictEqual(r.code, 'ok', r.msg); assert.strictEqual(r.responder, 'srv1');
  assert.ok(r.hops.some(h => h.proto === 'arp' && h.ip === '198.51.100.5' && h.to === 'r1'));
  dv(t, 'r1').nat.statics[0].global = '203.0.113.9';
  assert.ok(NetSim.create(t).problems().some(p => p.code === 'nat_bad' && /203\.0\.113\.9/.test(p.msg)));
});
it('3.1 ACL: first match wins, implicit deny is visible, wildcard and port names work, matched rule reported', () => {
  let n = NetSim.create(aclT12(WEB_RULES()));
  const w = n.trace('spc1', '192.168.30.10', { proto: 'tcp', port: 443 });
  assert.strictEqual(w.code, 'ok', w.msg);
  assert.ok(w.acl.some(a => a.permit && a.n === 2 && a.acl === 'STUDENT-IN' && a.iface === 'g0/0' && a.dir === 'in' && /eq 443/.test(a.text)));
  assert.strictEqual(n.trace('spc2', '192.168.30.53', { proto: 'udp', port: 53 }).code, 'ok');
  const ssh = n.trace('spc1', '192.168.30.10', { proto: 'tcp', port: 22 });
  assert.strictEqual(ssh.code, 'acl_denied'); assert.strictEqual(ssh.stopAt, 'r1');
  assert.ok(ssh.acl[0].implicit && /implicit deny/.test(ssh.msg), ssh.msg);
  assert.strictEqual(n.trace('spc1', '192.168.30.10').code, 'acl_denied');                    // ping: implicit deny too
  assert.strictEqual(n.trace('tpc1', '192.168.30.10', { proto: 'tcp', port: 3389 }).code, 'ok'); // teachers unrestricted
  assert.deepStrictEqual(n.acls('r1')[0].rules.map(r => r.n), [1, 2, 3]);
  assert.strictEqual(n.acls('r1')[0].implicit, 'deny ip any any (implicit deny)');
  // order: a broad deny first shadows the permits
  n = NetSim.create(aclT12([{ action: 'deny', proto: 'ip', src: '192.168.10.0/24', dst: '192.168.30.0/24' }].concat(WEB_RULES())));
  const sh = n.trace('spc1', '192.168.30.10', { proto: 'tcp', port: 80 });
  assert.strictEqual(sh.code, 'acl_denied'); assert.strictEqual(sh.acl[0].n, 1); assert.ok(/ข้อที่ 1/.test(sh.msg));
  // a subnet mask in the wildcard field matches the wrong hosts and is reported
  const bad = WEB_RULES(); bad[2].src = '192.168.10.0 255.255.255.0';
  n = NetSim.create(aclT12(bad));
  assert.ok(codes(n, 'r1').includes('acl_wildcard'));
  assert.strictEqual(n.trace('spc1', '192.168.30.53', { proto: 'udp', port: 53 }).code, 'acl_denied');
});
it('3.1 ACL direction: outbound on the student side filters the replies (stateless); empty or unbound ACLs are not applied', () => {
  let n = NetSim.create(aclT12(WEB_RULES(), 'g0/0', 'out'));
  const r = n.trace('spc1', '192.168.30.10', { proto: 'tcp', port: 443 });
  assert.strictEqual(r.code, 'reply_acl_denied'); assert.ok(/ตอบกลับ/.test(r.msg) && /ขาออก \(out\)/.test(r.msg), r.msg);
  // outbound on the server side works for the students and restricts the teachers too (placement matters)
  n = NetSim.create(aclT12(WEB_RULES(), 'g0/2', 'out'));
  assert.strictEqual(n.trace('spc1', '192.168.30.10', { proto: 'tcp', port: 443 }).code, 'ok');
  assert.strictEqual(n.trace('tpc1', '192.168.30.10', { proto: 'tcp', port: 22 }).code, 'acl_denied');
  n = NetSim.create(aclT12([], 'g0/0', 'in'));
  assert.ok(codes(n, 'r1').includes('acl_empty')); assert.ok(n.ping('spc1', '192.168.30.10').ok);
  n = NetSim.create(aclT12(WEB_RULES(), '', 'in'));
  assert.ok(codes(n, 'r1').includes('acl_unbound')); assert.ok(n.ping('spc1', '192.168.30.10').ok);
  n = NetSim.create(aclT12([{ action: 'permit', proto: 'icmp', src: 'any', dst: 'any', port: '80' }, { action: 'nope' }]));
  assert.strictEqual(codes(n, 'r1').filter(c => c === 'acl_bad').length, 2);
});
it('3.1 service tests: open/closed TCP and UDP ports, bad port input, legacy filters can use ports', () => {
  const n = NetSim.create(aclT12([]));
  assert.strictEqual(n.trace('tpc1', '192.168.30.10', { proto: 'tcp', port: 80 }).code, 'ok');
  const c = n.trace('tpc1', '192.168.30.53', { proto: 'tcp', port: 80 });
  assert.strictEqual(c.code, 'refused'); assert.strictEqual(c.ok, false); assert.ok(/RST/.test(c.msg));
  assert.strictEqual(n.trace('tpc1', '192.168.30.10', { proto: 'udp', port: 53 }).code, 'port_unreachable');
  assert.strictEqual(n.trace('tpc1', '192.168.30.10', { proto: 'tcp', port: 'abc' }).code, 'bad_target');
  assert.strictEqual(n.trace('tpc1', '192.168.30.10', { proto: 'tcp', port: 70000 }).code, 'bad_target');
  const r = n.trace('tpc1', '192.168.30.10', { proto: 'tcp', port: 'ssh' });
  assert.strictEqual(r.code, 'ok'); assert.strictEqual(r.port, 22); assert.ok(r.hops.some(h => /TCP SYN ไปพอร์ต 22/.test(h.text)));
  const t = NL.start('t12'); dv(t, 'r1').filters = [{ action: 'deny', src: 'any', dst: '192.168.30.10', proto: 'tcp', port: '22' }];
  const m = NetSim.create(t);
  assert.strictEqual(m.trace('tpc1', '192.168.30.10', { proto: 'tcp', port: 22 }).code, 'blocked');
  assert.strictEqual(m.trace('tpc1', '192.168.30.10', { proto: 'tcp', port: 443 }).code, 'ok');
  assert.ok(m.ping('tpc1', '192.168.30.10').ok);
});
it('3.1 NetSim.acl helpers parse any/host/prefix/wildcard forms', () => {
  const A = NetSim.acl;
  assert.ok(A.parseAddr('any').any); assert.ok(A.parseAddr('').any);
  assert.strictEqual(A.parseAddr('host 10.1.1.1').text, 'host 10.1.1.1');
  assert.strictEqual(A.parseAddr('192.168.10.0/24').text, '192.168.10.0 0.0.0.255');
  assert.ok(A.match(NetSim.ip.parse('192.168.10.77'), A.parseAddr('192.168.10.0 0.0.0.255')));
  assert.ok(!A.match(NetSim.ip.parse('192.168.11.77'), A.parseAddr('192.168.10.5/24')));
  assert.ok(A.parseAddr('192.168.10.0 255.255.255.0').maskLike);
  assert.strictEqual(A.parseAddr('300.1.1.1/24'), null);
  assert.strictEqual(A.parsePort('https').port, 443); assert.ok(A.parsePort('0').err);
  assert.ok(A.parseRule({ action: 'permit', proto: 'ip', src: 'any', dst: 'any', port: '80' }).err);
  assert.strictEqual(A.parseRule({ action: 'deny', proto: 'tcp', src: '10.0.0.0/8', dst: 'host 10.1.1.1', port: 'ssh' }).text, 'deny tcp 10.0.0.0 0.255.255.255 host 10.1.1.1 eq 22');
  assert.ok(A.isPrivate('172.20.1.1') && !A.isPrivate('198.51.100.2'));
});
it('3.1 natlab: starts are public and broken, pinned provider devices, evaluate never throws', () => {
  NL.missions.forEach(m => {
    const s = NL.start(m);
    assert.ok(s && s.devices.length > 3, m);
    const e = NL.evaluate(m, s);
    assert.ok(e.score < e.max, m + ' ' + e.score); assert.strictEqual(e.max, 10);
  });
  // the student cannot "fix" the ISP: requireNat and its addresses are restored
  const t = NL.start('t10'); delete dv(t, 'net1').requireNat; dv(t, 'net1').ifaces[0].ip = '192.168.1.200';
  const p = NL.pin('t10', t);
  assert.strictEqual(dv(p, 'net1').requireNat, true); assert.strictEqual(dv(p, 'net1').ifaces[0].ip, '198.51.100.1');
  const t11 = NL.start('t11'); t11.links = t11.links.filter(l => l.id !== 'lo1'); t11.devices = t11.devices.filter(d => d.id !== 'opc1');
  const p11 = NL.pin('t11', t11);
  assert.ok(dv(p11, 'opc1') && p11.links.some(l => l.id === 'lo1'));
  [null, 7, 'x', { devices: 'no' }, { devices: [{}], links: [{}] }].forEach(x => NL.missions.forEach(m => {
    const e = NL.evaluate(m, x); assert.ok(e.score >= 0 && e.score < 10);
  }));
  assert.strictEqual(NL.evaluate('t99', NL.start('t10')).score, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
