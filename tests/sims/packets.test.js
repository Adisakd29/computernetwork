// Tests for the Packet Analysis lab (generator, dissector, display filters, graders): node tests/sims/packets.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const g = require('../../server/sims/packets.js');
const PK = require('../../public/js/sim/packets.js');

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n      ') : e); }
}
// mulberry32: the same kind of rand() the API passes to generate()
function seeded(seed) {
  let a = seed >>> 0;
  return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const prob = (m, n) => g.generate(m, seeded(n));
// server-side build: the public build + the answers derived on the server only (server/sims/packets-answers.js)
const build = (m, n) => g._build(prob(m, n));
const fbHas = (r, re) => r.feedback.some((f) => re.test(f));
const set = (cap, f) => { const r = PK.runFilter(cap, f); assert.ok(r.ok, f + ' -> ' + r.error); return r.set; };
const u16 = (b, i) => (b[i] << 8) | b[i + 1];
const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const ipb = (s) => s.split('.').map(Number);
const SEEDS = Array.from({ length: 120 }, (_, i) => i * 7919 + 13);

/* a correct answer for every mission, computed from the regenerated capture's facts */
function perfect(m, b) {
  const F = b.facts;
  if (m === 'p1') return { a_eth: '2', a_ip: '3', a_tcp: '4', a_http: '7', a_smac: F.a_smac, a_dip: F.a_dip, a_dport: '80', b_l4: 'udp', b_sport: String(F.b_sport), b_dmac: F.b_dmac };
  if (m === 'p2') return { syn: F.syn, synack: F.synack, ack: F.ack, cport: F.cport, sport: F.sport, ack3: F.ack3, nextack: F.nextack };
  if (m === 'p3') return { q: F.q, r: F.r, id: '0x' + F.id.toString(16).padStart(4, '0'), addr: F.addr, l4: 'udp', port: 53 };
  if (m === 'p4') return { d: F.d, o: F.o, r: F.r, a: F.a, yiaddr: F.yiaddr, server: F.server, lease: F.lease, xid: '0x' + F.xid.toString(16) };
  if (m === 'p5') return { conclusion: F.conclusion, evidence: F.key.join(', ') };
  const o = {}; b.tasks.forEach((t, i) => { o['f' + i] = g._ref[t.kind](t); }); return o;
}

console.log('packets lab');

/* ---------------- module shape + generate */
it('module shape: 6 missions p1..p6, max 10, Thai titles/desc/hints, levels', () => {
  assert.strictEqual(g.id, 'packets');
  assert.deepStrictEqual(g.missions.map((m) => m.id), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  assert.deepStrictEqual(g.missions.map((m) => m.level), ['easy', 'medium', 'easy', 'medium', 'medium', 'medium']);
  for (const m of g.missions) { assert.strictEqual(m.max, 10); assert.ok(m.title && m.desc && m.hints.length >= 3); }
  assert.ok(typeof g.generate === 'function' && typeof g.grade === 'function');
});
it('server grades with the SAME shared library the browser loads (public/js/sim/packets.js)', () => {
  assert.strictEqual(g._lib, require(path.join(__dirname, '../../public/js/sim/packets.js')));
});
it('generate(): public problem {v, mission, seed(16 hex)} only, deterministic per rand, unknown mission -> null', () => {
  const p = g.generate('p2', seeded(5));
  assert.deepStrictEqual(Object.keys(p).sort(), ['mission', 'seed', 'v']);
  assert.ok(/^[0-9a-f]{16}$/.test(p.seed));
  assert.deepStrictEqual(g.generate('p2', seeded(5)), p);
  assert.notStrictEqual(g.generate('p2', seeded(6)).seed, p.seed);
  assert.strictEqual(g.generate('zz', seeded(1)), null);
});

/* ---------------- generator determinism + byte-level consistency */
it('determinism: same signed seed -> identical capture (bytes, times, info, facts); different seed -> different', () => {
  for (const m of PK.MISSION_IDS) {
    const a = build(m, 77), b = build(m, 77), c = build(m, 78);
    assert.deepStrictEqual(a.capture.map((p) => [p.t, p.info, p.bytes.join(',')]), b.capture.map((p) => [p.t, p.info, p.bytes.join(',')]));
    assert.deepStrictEqual(a.facts, b.facts);
    assert.notDeepStrictEqual(a.capture.map((p) => p.bytes.join(',')), c.capture.map((p) => p.bytes.join(',')));
  }
});
it('frames numbered 1..n in time order starting at 0.000000; frame length = encoded bytes', () => {
  for (const m of PK.MISSION_IDS) for (const s of SEEDS.slice(0, 40)) {
    const cap = build(m, s).capture;
    assert.strictEqual(cap[0].t, 0);
    cap.forEach((p, i) => { assert.strictEqual(p.no, i + 1); assert.strictEqual(p.len, p.bytes.length); if (i) assert.ok(p.t >= cap[i - 1].t); });
  }
});
it('IPv4 header: version/IHL, total length, protocol, addresses and a valid header checksum in every packet', () => {
  for (const m of PK.MISSION_IDS) for (const s of SEEDS.slice(0, 30)) for (const p of build(m, s).capture) {
    if (!p.ip) continue;
    const b = p.bytes;
    assert.strictEqual(u16(b, 12), 0x0800);
    assert.strictEqual(b[14], 0x45);
    assert.strictEqual(u16(b, 16), p.ip.len);
    assert.strictEqual(p.ip.len, p.len - 14 - p.padLen);
    assert.deepStrictEqual(Array.from(b.slice(26, 30)), ipb(p.ip.src));
    assert.deepStrictEqual(Array.from(b.slice(30, 34)), ipb(p.ip.dst));
    assert.strictEqual(PK.csum(b.slice(14, 34)), 0, 'IP checksum of frame ' + p.no);
  }
});
it('TCP/UDP checksums verify over the pseudo header; UDP length and TCP data offset are consistent', () => {
  for (const m of PK.MISSION_IDS) for (const s of SEEDS.slice(0, 20)) for (const p of build(m, s).capture) {
    if (!p.tcp && !p.udp) continue;
    const seg = p.bytes.slice(34, 14 + p.ip.len);
    const ph = ipb(p.ip.src).concat(ipb(p.ip.dst), [0, p.tcp ? 6 : 17, seg.length >> 8, seg.length & 255]);
    assert.strictEqual(PK.csum(ph.concat(seg)), 0, 'L4 checksum of frame ' + p.no);
    if (p.udp) assert.strictEqual(u16(p.bytes, 38), seg.length);
    if (p.tcp) { assert.strictEqual((p.bytes[46] >> 4) * 4, p.tcp.hdrLen); assert.strictEqual(seg.length - p.tcp.hdrLen, p.tcp.len); }
  }
});
it('Ethernet: received frames shorter than 60 bytes are padded; frames sent by the PC are not', () => {
  const b = build('p1', 3);
  const rep = b.capture.find((p) => p.arp && p.arp.op === 2);
  assert.strictEqual(rep.len, 60); assert.strictEqual(rep.padLen, 18);
  const req = b.capture.find((p) => p.arp && p.arp.op === 1);
  assert.strictEqual(req.len, 42);
});

/* ---------------- protocol consistency */
it('ARP: request is broadcast with target MAC 00:..:00; reply is unicast back, sender MAC = Ethernet source', () => {
  for (const s of SEEDS.slice(0, 40)) for (const p of build('p1', s).capture.filter((x) => x.arp)) {
    if (p.arp.op === 1) { assert.strictEqual(p.eth.dst, 'ff:ff:ff:ff:ff:ff'); assert.strictEqual(p.arp.tha, '00:00:00:00:00:00'); assert.ok(/^Who has/.test(p.info)); }
    else { assert.strictEqual(p.arp.sha, p.eth.src); assert.strictEqual(p.arp.tha, p.eth.dst); assert.ok(/ is at /.test(p.info)); }
    assert.strictEqual(u16(p.bytes, 20), p.arp.op);
  }
});
it('TCP 3-way handshake arithmetic: SYN-ACK.ack = ISN_c+1, ACK.seq = ISN_c+1, ACK.ack = ISN_s+1; relative 0/1', () => {
  for (const s of SEEDS) {
    const b = build('p2', s), F = b.facts, c = b.capture;
    const syn = c[F.syn - 1].tcp, sa = c[F.synack - 1].tcp, ack = c[F.ack - 1].tcp;
    assert.ok(syn.flags.syn && !syn.flags.ack && sa.flags.syn && sa.flags.ack && ack.flags.ack && !ack.flags.syn);
    assert.strictEqual(sa.ack, (syn.seq + 1) >>> 0);
    assert.strictEqual(ack.seq, (syn.seq + 1) >>> 0);
    assert.strictEqual(ack.ack, (sa.seq + 1) >>> 0);
    assert.strictEqual(F.ack3, ack.ack);
    assert.deepStrictEqual([syn.relSeq, sa.relSeq, sa.relAck, ack.relSeq, ack.relAck], [0, 0, 1, 1, 1]);
    assert.strictEqual(syn.sport, F.cport); assert.strictEqual(syn.dport, F.sport);
    assert.strictEqual(u32(c[F.ack - 1].bytes, 42), F.ack3, 'raw ack in bytes');
  }
});
it('TCP data + close: server ACK of GET = GET.seq + Len, response ACKed, FIN consumes one sequence number', () => {
  for (const s of SEEDS.slice(0, 50)) {
    const c = build('p1', s).capture.filter((p) => p.tcp && p.tcp.stream === 0);
    const get = c.find((p) => p.http && p.http.request), gAck = c[c.indexOf(get) + 1];
    assert.strictEqual(gAck.tcp.ack, (get.tcp.seq + get.tcp.len) >>> 0);
    const resp = c.find((p) => p.http && p.http.response), rAck = c[c.indexOf(resp) + 1];
    assert.strictEqual(rAck.tcp.ack, (resp.tcp.seq + resp.tcp.len) >>> 0);
    const fins = c.filter((p) => p.tcp.flags.fin), last = c[c.length - 1];
    assert.strictEqual(fins.length, 2);
    assert.strictEqual(fins[1].tcp.ack, (fins[0].tcp.seq + 1) >>> 0);
    assert.strictEqual(last.tcp.ack, (fins[1].tcp.seq + 1) >>> 0);
    assert.strictEqual(new Set(c.map((p) => p.tcp.stream)).size, 1);
  }
});
it('p2 fact "nextack" = client ISN + 1 + GET length (the GET is the last packet of its connection)', () => {
  for (const s of SEEDS) {
    const b = build('p2', s), F = b.facts;
    assert.strictEqual(F.nextack, (F.isnC + 1 + F.getLen) >>> 0);
    assert.strictEqual(b.capture[F.get - 1].tcp.len, F.getLen);
    assert.strictEqual(Math.max(...b.capture.filter((p) => p.tcp && p.tcp.stream === b.capture[F.get - 1].tcp.stream).map((p) => p.no)), F.get);
  }
});
it('DNS: every response has the query transaction id, swapped UDP ports (53), QR bit set; A record = facts', () => {
  for (const s of SEEDS) {
    const b = build('p3', s), c = b.capture, F = b.facts;
    const q = c[F.q - 1], r = c[F.r - 1];
    assert.ok(!q.dns.qr && r.dns.qr);
    assert.strictEqual(q.dns.id, r.dns.id); assert.strictEqual(q.dns.id, F.id);
    assert.strictEqual(u16(q.bytes, 42), F.id);
    assert.strictEqual(q.udp.dport, 53); assert.strictEqual(r.udp.sport, 53); assert.strictEqual(r.udp.dport, q.udp.sport);
    assert.strictEqual(r.dns.answers[0].addr, F.addr);
    assert.strictEqual(q.dns.respIn, r.no); assert.strictEqual(r.dns.reqIn, q.no);
    assert.strictEqual(u16(r.bytes, 44) & 0x8000, 0x8000);
    assert.strictEqual(new Set(c.filter((p) => p.dns && !p.dns.qr).map((p) => p.dns.id)).size >= 2, true);
  }
});
it('DHCP DORA: same xid, D-O-R-A order, 0.0.0.0:68 -> 255.255.255.255:67, yiaddr/option 50/option 54/lease consistent', () => {
  for (const s of SEEDS) {
    const b = build('p4', s), c = b.capture, F = b.facts;
    const [D, O, Q, A] = [F.d, F.o, F.r, F.a].map((n) => c[n - 1]);
    assert.ok(F.d < F.o && F.o < F.r && F.r < F.a);
    assert.deepStrictEqual([D, O, Q, A].map((p) => p.dhcp.type), [1, 2, 3, 5]);
    [D, O, Q, A].forEach((p) => { assert.strictEqual(p.dhcp.xid, F.xid); assert.strictEqual(u32(p.bytes, 46), F.xid); assert.strictEqual(p.dhcp.chaddr, b.env.pcMac); });
    assert.strictEqual(D.ip.src, '0.0.0.0'); assert.strictEqual(D.ip.dst, '255.255.255.255'); assert.strictEqual(D.udp.sport, 68); assert.strictEqual(D.udp.dport, 67);
    assert.strictEqual(D.eth.dst, 'ff:ff:ff:ff:ff:ff');
    assert.strictEqual(O.dhcp.yiaddr, F.yiaddr); assert.strictEqual(A.dhcp.yiaddr, F.yiaddr); assert.strictEqual(Q.dhcp.reqIp, F.yiaddr);
    assert.strictEqual(O.dhcp.serverId, F.server); assert.strictEqual(Q.dhcp.serverId, F.server); assert.strictEqual(O.ip.src, F.server);
    assert.strictEqual(A.dhcp.lease, F.lease);
    assert.notStrictEqual(F.otherXid, F.xid);
    assert.strictEqual(set(c, 'dhcp.id == ' + F.xid).join(), [F.d, F.o, F.r, F.a].join());
  }
});
it('ICMP: echo replies match id/seq of requests; remote reply TTL < initial TTL; unreachable carries the original IP header', () => {
  for (const s of SEEDS.slice(0, 40)) {
    const c = build('p6', s).capture;
    const reps = c.filter((p) => p.icmp && p.icmp.type === 0);
    assert.ok(reps.length >= 2);
    reps.forEach((r) => { const q = c[r.icmp.reqIn - 1]; assert.strictEqual(q.icmp.type, 8); assert.strictEqual(q.icmp.seq, r.icmp.seq); assert.ok(r.ip.ttl < 128 && r.ip.ttl !== 64 && r.ip.ttl !== 128); });
    const un = c.find((p) => p.icmp && p.icmp.type === 3);
    assert.strictEqual(un.icmp.code, 3);
    const orig = c.find((p) => p.udp && p.data);
    assert.deepStrictEqual(Array.from(un.bytes.slice(42, 70)), Array.from(orig.bytes.slice(14, 42)));
  }
});
it('p5 "web fails" variants are internally consistent (DNS NX/timeout, RST, silent drop, ICMP filtered)', () => {
  const seen = new Set();
  for (const s of SEEDS) {
    const b = build('p5', s), F = b.facts, c = b.capture;
    seen.add(F.variant);
    const toWeb = c.filter((p) => p.tcp && p.ip.dst === F.ip);
    if (F.conclusion === 'dns') {
      assert.strictEqual(toWeb.length, 0);
      if (F.variant === 'dns-nx') assert.ok(F.key.every((n) => c[n - 1].dns.qr && c[n - 1].dns.rcode === 3));
      else assert.ok(F.key.length >= 3 && c.filter((p) => p.dns && p.dns.qr).length === 0);
    } else {
      const dr = c.find((p) => p.dns && p.dns.qr);
      assert.strictEqual(dr.dns.answers[0].addr, F.ip);
      if (F.variant === 'closed') F.key.forEach((n) => { const t = c[n - 1].tcp; assert.ok(t.flags.rst && t.flags.ack && t.seq === 0); assert.strictEqual(c[n - 1].ip.src, F.ip); });
      if (F.variant === 'filtered') { assert.strictEqual(c.filter((p) => p.ip && p.ip.src === F.ip).length, 0); assert.ok(set(c, 'tcp.analysis.retransmission').length >= 4); }
      if (F.variant === 'filtered-icmp') F.key.forEach((n) => { assert.strictEqual(c[n - 1].icmp.type, 3); assert.strictEqual(c[n - 1].icmp.code, 13); });
    }
    F.key.forEach((n) => assert.ok(F.allowed.includes(n)));
  }
  assert.deepStrictEqual([...seen].sort(), ['closed', 'dns-nx', 'dns-timeout', 'filtered', 'filtered-icmp']);
});
it('explore scenarios all build; Follow TCP Stream returns the HTTP request and response text', () => {
  for (const sc of PK.SCENARIOS) { const x = PK.buildScenario(sc.id, 'abc'); assert.ok(x.capture.length >= 4, sc.id); }
  assert.strictEqual(PK.buildScenario('nope', 'a'), null);
  assert.strictEqual(set(PK.buildScenario('wf-dns', 'q').capture, 'tcp').length, 0);
  const b = build('p1', 9);
  const fs = PK.followStream(b.capture, 0);
  assert.ok(/^GET \//.test(fs.parts[0].text) && fs.parts[0].dir === 'c');
  assert.ok(/^HTTP\/1\.1 200 OK/.test(fs.parts[1].text) && fs.parts[1].dir === 's');
  assert.strictEqual(fs.filter, 'tcp.stream eq 0');
});
it('detail tree + encapsulation: HTTP GET has Frame, Ethernet II, IPv4, TCP, HTTP; layers 2/3/4/7', () => {
  const b = build('p1', 11), p = b.capture[b.facts.a - 1];
  const t = PK.tree(p);
  assert.deepStrictEqual(t.map((l) => l.key), ['frame', 'eth', 'ip', 'tcp', 'app']);
  assert.ok(/^Ethernet II, Src: /.test(t[1].title) && /^Internet Protocol Version 4/.test(t[2].title) && /^Transmission Control Protocol/.test(t[3].title) && t[4].title === 'Hypertext Transfer Protocol');
  assert.deepStrictEqual(PK.encapLayers(p).map((x) => x.osi), [2, 3, 4, 7]);
  assert.deepStrictEqual(PK.encapLayers(b.capture.find((x) => x.arp)).map((x) => x.key), ['eth', 'arp']);
  const flat = JSON.stringify(t);
  assert.ok(flat.includes('"f":"ip.src"') && flat.includes('"f":"tcp.flags.syn"') && flat.includes('Sequence Number (raw)'));
});

/* ---------------- display filter engine */
it('filters: protocol names, ip.addr/ip.src/ip.dst, tcp.port/udp.port, frame.number select the right packets', () => {
  const b = build('p6', 21), c = b.capture, pc = b.env.pc;
  assert.deepStrictEqual(set(c, 'arp'), c.filter((p) => p.arp).map((p) => p.no));
  assert.deepStrictEqual(set(c, 'dhcp'), set(c, 'bootp'));
  assert.deepStrictEqual(set(c, 'dns'), c.filter((p) => p.dns).map((p) => p.no));
  assert.deepStrictEqual(set(c, 'ip.addr==' + pc), c.filter((p) => p.ip && (p.ip.src === pc || p.ip.dst === pc)).map((p) => p.no));
  assert.deepStrictEqual(set(c, 'ip.src == ' + pc), c.filter((p) => p.ip && p.ip.src === pc).map((p) => p.no));
  assert.deepStrictEqual(set(c, 'ip.dst eq ' + pc), c.filter((p) => p.ip && p.ip.dst === pc).map((p) => p.no));
  assert.deepStrictEqual(set(c, 'udp.port == 53'), set(c, 'dns'));
  assert.deepStrictEqual(set(c, 'tcp.port == 80'), set(c, 'tcp.srcport == 80 || tcp.dstport == 80'));
  assert.deepStrictEqual(set(c, 'frame.number == 3'), [3]);
  assert.deepStrictEqual(set(c, 'frame.number >= 30'), c.filter((p) => p.no >= 30).map((p) => p.no));
  assert.strictEqual(set(c, '').length, c.length);
});
it('filters: tcp.flags.syn==1 / reset==1, &&, ||, !, parentheses, and/or/not keywords, precedence', () => {
  const c = build('p6', 22).capture;
  const syn = c.filter((p) => p.tcp && p.tcp.flags.syn).map((p) => p.no);
  assert.deepStrictEqual(set(c, 'tcp.flags.syn==1'), syn);
  assert.deepStrictEqual(set(c, 'tcp.flags.syn == 1 && tcp.flags.ack == 0'), c.filter((p) => p.tcp && p.tcp.flags.syn && !p.tcp.flags.ack).map((p) => p.no));
  assert.deepStrictEqual(set(c, 'tcp.flags.reset == 1'), c.filter((p) => p.tcp && p.tcp.flags.rst).map((p) => p.no));
  assert.deepStrictEqual(set(c, 'udp && !dns'), c.filter((p) => p.udp && !p.dns).map((p) => p.no));
  assert.deepStrictEqual(set(c, 'udp and not dns'), set(c, 'udp && !dns'));
  assert.deepStrictEqual(set(c, '!(arp || icmp)'), c.filter((p) => !p.arp && !p.icmp).map((p) => p.no));
  assert.deepStrictEqual(set(c, 'arp || icmp && ip.ttl > 100'), set(c, 'arp || (icmp && ip.ttl > 100)'));
  assert.deepStrictEqual(set(c, '!!dns'), set(c, 'dns'));
  assert.deepStrictEqual(set(c, 'tcp.flags.syn == true'), syn);
});
it('filters: ip.addr != x excludes a packet when either address matches (Wireshark semantics); CIDR, in {}, contains', () => {
  const b = build('p6', 23), c = b.capture, pc = b.env.pc;
  assert.deepStrictEqual(set(c, 'ip.addr != ' + pc), c.filter((p) => p.ip && p.ip.src !== pc && p.ip.dst !== pc).map((p) => p.no));
  assert.deepStrictEqual(set(c, '!(ip.addr == ' + pc + ')'), c.filter((p) => !(p.ip && (p.ip.src === pc || p.ip.dst === pc))).map((p) => p.no));
  const net = pc.split('.').slice(0, 3).join('.') + '.0/24';
  assert.deepStrictEqual(set(c, 'ip.dst == ' + net), c.filter((p) => p.ip && p.ip.dst.startsWith(pc.split('.').slice(0, 3).join('.') + '.')).map((p) => p.no));
  assert.deepStrictEqual(set(c, 'tcp.port in {80 8080 8443 3000}'), c.filter((p) => p.tcp).map((p) => p.no));
  const host = c.find((p) => p.http && p.http.request).http.host;
  assert.deepStrictEqual(set(c, 'http.host contains "' + host.split('.')[0] + '"'), [c.find((p) => p.http && p.http.request).no]);
  assert.deepStrictEqual(set(c, 'eth.addr == ff-ff-ff-ff-ff-ff'), c.filter((p) => p.eth.dst === 'ff:ff:ff:ff:ff:ff').map((p) => p.no));
});
it('filters: invalid syntax gives a clear Thai error (never throws)', () => {
  const cases = [
    ['ip.addr = 10.0.0.1', /==/], ['ip.addr ==', /ต้องมีค่า/], ['ip.addr == 999.1.1.1', /IPv4/], ['tcp.port == 80 || 443', /ผิดตำแหน่ง/],
    ['foo', /ไม่รู้จัก/], ['ip.source == 1.2.3.4', /ip\.src/], ['(tcp', /วงเล็บ/], ['tcp)', /วงเล็บ/], ['tcp udp', /&& หรือ \|\|/],
    ['tcp & udp', /&&/], ['tcp | udp', /\|\|/], ['tcp == 1', /โปรโตคอล/], ['tcp.flags.syn == 2', /1/], ['tcp.port == abc', /ตัวเลข/],
    ['ip.ttl contains "x"', /contains/], ['tcp &&', /ไม่สมบูรณ์/], ['"x"', /ผิดตำแหน่ง/], ['dns.qry.name == "abc', /คู่/], ['x'.repeat(301), /ยาวเกินไป/],
    ['ip.addr > 10.0.0.1', /==/], ['tcp.analysis.retransmission == 1', /มีหรือไม่มี/], ['tcp.port in 80', /\{/]
  ];
  for (const [f, re] of cases) {
    const r = PK.compileFilter(f);
    assert.strictEqual(r.ok, false, f);
    assert.ok(re.test(r.error), f + ' -> ' + r.error);
    assert.ok(/[฀-๿]/.test(r.error), 'Thai: ' + r.error);
  }
  assert.strictEqual(PK.compileFilter(null).ok, true);
  assert.strictEqual(PK.compileFilter({}).ok, true);
});

/* ---------------- graders: perfect */
it('every mission: a perfect answer from the regenerated capture = 10/10 (30 seeds each)', () => {
  for (const m of PK.MISSION_IDS) for (const s of SEEDS.slice(0, 30)) {
    const p = prob(m, s), b = g._build(p);
    const r = g.grade(m, { answers: perfect(m, b) }, p);
    assert.strictEqual(r.score, 10, m + ' ' + s + ' ' + r.feedback.join(' | ')); assert.strictEqual(r.ok, true);
  }
});

/* ---------------- p1 */
it('p1: swapped MAC / IP / port and TCP labelled Application give partial credit with Thai feedback', () => {
  const p = prob('p1', 31), b = g._build(p), F = b.facts;
  const a = Object.assign(perfect('p1', b), { a_smac: F.a_dmac, a_dip: F.a_sip, a_tcp: '7', b_dmac: F.b_smac });
  const r = g.grade('p1', { answers: a }, p);
  assert.strictEqual(r.score, 6);
  assert.ok(fbHas(r, /Destination MAC \(MAC ของ gateway\)/) && fbHas(r, /นั่นคือ Source IP/) && fbHas(r, /TCP ไม่ใช่ข้อมูลของแอปพลิเคชัน/) && fbHas(r, /นั่นคือ Source MAC/));
  assert.strictEqual(r.details.fields.a_eth, true); assert.strictEqual(r.details.fields.a_smac, false);
});
it('p1: MAC accepted with -, . or no separators and any case; destination port 53 and ephemeral port explained', () => {
  const p = prob('p1', 32), b = g._build(p), F = b.facts;
  const a = Object.assign(perfect('p1', b), { a_smac: F.a_smac.toUpperCase().replace(/:/g, '-'), b_dmac: F.b_dmac.replace(/:/g, '') });
  assert.strictEqual(g.grade('p1', { answers: a }, p).score, 10);
  const r = g.grade('p1', { answers: Object.assign(perfect('p1', b), { a_dport: '53', b_sport: '53' }) }, p);
  assert.strictEqual(r.score, 8);
  assert.ok(fbHas(r, /พอร์ต 53 คือ DNS/) && fbHas(r, /53 คือ Destination port/));
  assert.ok(fbHas(g.grade('p1', { answers: Object.assign(perfect('p1', b), { a_dport: String(F.b_sport) }) }, p), /ephemeral/));
});
it('p1: empty answers = 0; bad formats reported', () => {
  const p = prob('p1', 33);
  assert.strictEqual(g.grade('p1', { answers: {} }, p).score, 0);
  const r = g.grade('p1', { answers: { a_smac: 'zz:zz', a_dip: '1.2.3', a_eth: '9' } }, p);
  assert.strictEqual(r.score, 0);
  assert.ok(fbHas(r, /Source MAC: รูปแบบไม่ถูกต้อง/) && fbHas(r, /Destination IP: รูปแบบไม่ถูกต้อง/));
});

/* ---------------- p2 */
it('p2: relative ACK, forgotten +1, and the other (443) connection give specific Thai feedback', () => {
  const p = prob('p2', 41), b = g._build(p), F = b.facts;
  let r = g.grade('p2', { answers: Object.assign(perfect('p2', b), { ack3: '1' }) }, p);
  assert.strictEqual(r.score, 9); assert.ok(fbHas(r, /relative ack number/));
  r = g.grade('p2', { answers: Object.assign(perfect('p2', b), { ack3: String(F.isnS) }) }, p);
  assert.ok(fbHas(r, /ลืม \+1/));
  r = g.grade('p2', { answers: Object.assign(perfect('p2', b), { syn: F.other.syn, cport: F.other.cport }) }, p);
  assert.strictEqual(r.score, 7); assert.ok(fbHas(r, /พอร์ต 443/) && fbHas(r, /การเชื่อมต่ออีกอัน/));
});
it('p2: next ACK mistakes (relative, no +Len, extra +1, swapped ports) are explained', () => {
  const p = prob('p2', 42), b = g._build(p), F = b.facts;
  const one = (o, re) => { const r = g.grade('p2', { answers: Object.assign(perfect('p2', b), o) }, p); assert.ok(r.score < 10 && fbHas(r, re), JSON.stringify(o) + r.feedback.join('|')); };
  one({ nextack: String(F.getLen + 1) }, /ค่า relative/);
  one({ nextack: String((F.isnC + 1) >>> 0) }, /ยังไม่ได้บวก/);
  one({ nextack: String((F.nextack + 1) >>> 0) }, /บวกเกินมา 1/);
  one({ cport: String(F.sport), sport: String(F.cport) }, /สลับกัน/);
  one({ ack: String(F.get) }, /HTTP GET/);
});

/* ---------------- p3 */
it('p3: transaction id accepted as 0x.., hex without 0x, or decimal; swapped query/response and DNS-server IP explained', () => {
  const p = prob('p3', 51), b = g._build(p), F = b.facts;
  for (const id of [F.id.toString(16), String(F.id), '0X' + F.id.toString(16).toUpperCase()]) assert.strictEqual(g.grade('p3', { answers: Object.assign(perfect('p3', b), { id }) }, p).score, 10, id);
  const r = g.grade('p3', { answers: Object.assign(perfect('p3', b), { q: F.r, r: F.q, addr: F.dnsIp, l4: 'tcp' }) }, p);
  assert.strictEqual(r.score, 3);
  assert.ok(fbHas(r, /สลับกัน/) && fbHas(r, /IP ของ DNS server/) && fbHas(r, /UDP/));
});
it('p3: answering about another name (its query, id or IP) is pointed out', () => {
  const p = prob('p3', 52), b = g._build(p), F = b.facts;
  const other = b.capture.find((x) => x.dns && !x.dns.qr && x.dns.qname !== F.name);
  const otherR = b.capture.find((x) => x.dns && x.dns.qr && x.dns.qname !== F.name);
  const r = g.grade('p3', { answers: Object.assign(perfect('p3', b), { q: other.no, id: '0x' + other.dns.id.toString(16), addr: otherR.dns.answers[0].addr }) }, p);
  assert.strictEqual(r.score, 5);
  assert.ok(fbHas(r, /query ของชื่ออื่น/) && fbHas(r, /Transaction ID ของชื่ออื่น/) && fbHas(r, /IP ของชื่ออื่น/));
});

/* ---------------- p4 */
it('p4: the other client\'s DORA, renewal time and swapped IPs give partial credit with Thai feedback', () => {
  const p = prob('p4', 61), b = g._build(p), F = b.facts;
  const oth = b.capture.find((x) => x.dhcp && x.dhcp.xid === F.otherXid && x.dhcp.type === 1);
  const r = g.grade('p4', { answers: Object.assign(perfect('p4', b), { d: oth.no, lease: String(F.lease / 2), yiaddr: F.server, server: F.yiaddr, xid: '0x' + F.otherXid.toString(16) }) }, p);
  assert.strictEqual(r.score, 4);
  assert.ok(fbHas(r, /ของอีกเครื่อง/) && fbHas(r, /Renewal Time/) && fbHas(r, /IP ของ DHCP server/) && fbHas(r, /IP ที่ client ได้รับ/) && fbHas(r, /Transaction ID ของอีกเครื่อง/));
});
it('p4: Offer/Request swapped -> message-type hint; lease with thousands separator accepted', () => {
  const p = prob('p4', 62), b = g._build(p), F = b.facts;
  const r = g.grade('p4', { answers: Object.assign(perfect('p4', b), { o: F.r, r: F.o, lease: F.lease.toLocaleString('en-US') }) }, p);
  assert.strictEqual(r.score, 8);
  assert.ok(fbHas(r, /DHCP Request ดู Option \(53\)/) && fbHas(r, /DHCP Offer ดู Option \(53\)/));
});

/* ---------------- p5 */
const p5Seed = (variant) => SEEDS.find((s) => build('p5', s).facts.variant === variant);
it('p5: correct conclusion + exact evidence = 10 for every variant', () => {
  for (const v of ['dns-nx', 'dns-timeout', 'closed', 'filtered', 'filtered-icmp']) {
    const p = prob('p5', p5Seed(v)), b = g._build(p);
    assert.strictEqual(g.grade('p5', { answers: { conclusion: b.facts.conclusion, evidence: b.facts.key.slice(0, 2).join(',') } }, p).score, 10, v);
  }
});
it('p5: wrong conclusion explains the CHOSEN cause (never names the real one) and still grades evidence', () => {
  const p = prob('p5', p5Seed('closed')), b = g._build(p), F = b.facts;
  let r = g.grade('p5', { answers: { conclusion: 'filtered', evidence: F.key.join(' ') } }, p);
  assert.strictEqual(r.score, 4); assert.ok(fbHas(r, /ถ้าถูก firewall กรอง/) && !fbHas(r, /RST, ACK ทันที แปลว่า/), r.feedback.join('|'));
  r = g.grade('p5', { answers: { conclusion: 'dns', evidence: '' } }, p);
  assert.strictEqual(r.score, 0); assert.ok(fbHas(r, /ถ้าเป็นปัญหา DNS/) && !fbHas(r, /ได้ IP ของเว็บแล้ว/));
  const pf = prob('p5', p5Seed('filtered')), bf = g._build(pf);
  r = g.grade('p5', { answers: { conclusion: 'closed', evidence: bf.facts.key.join(',') } }, pf);
  assert.ok(fbHas(r, /ถ้าพอร์ตปิด/) && !fbHas(r, /ไม่มี RST/));
});
it('p5 leak: a wrong conclusion + wrong evidence never names the real cause or its evidence packets', () => {
  const what = /No such name|ส่งซ้ำ \(TCP Retransmission\) โดยไม่มีคำตอบ|RST, ACK ที่ตอบกลับ|administratively filtered\) ที่ตอบกลับ|query ที่ถูกส่งซ้ำ/;
  for (const v of ['dns-nx', 'dns-timeout', 'closed', 'filtered', 'filtered-icmp']) {
    const p = prob('p5', p5Seed(v)), F = g._build(p).facts;
    const noise = g._build(p).capture.find((x) => x.arp).no;
    for (const c of ['dns', 'closed', 'filtered'].filter((c) => c !== F.conclusion)) {
      for (const ev of [String(noise), String(F.key[0]), '']) {
        const r = g.grade('p5', { answers: { conclusion: c, evidence: ev } }, p);
        assert.ok(!r.feedback.some((f) => what.test(f) && !/ — ถ้า/.test(f)), v + '/' + c + '/' + ev + ': ' + r.feedback.join('|'));
        assert.ok(!r.feedback.some((f) => f.includes(F.key.join(', #'))), 'no evidence frame list');
      }
    }
    // correct conclusion + exact evidence still 10
    assert.strictEqual(g.grade('p5', { answers: { conclusion: F.conclusion, evidence: F.key.join(',') } }, p).score, 10, v);
  }
});
it('leak: the browser library builds no answer object (no facts, no conclusion/evidence) for p1-p6', () => {
  const ANSWER_KEYS = ['facts', 'conclusion', 'key', 'allowed', 'variant', 'syn', 'synack', 'ack3', 'nextack', 'yiaddr', 'xid', 'a_smac', 'b_sport'];
  for (const m of PK.MISSION_IDS) for (const s of SEEDS.slice(0, 20)) {
    const b = PK.buildMission(prob(m, s));
    ANSWER_KEYS.forEach((k) => assert.ok(!(k in b), m + ': browser build has ' + k));
    if (b.target) assert.deepStrictEqual(Object.keys(b.target).filter((k) => k !== 'name'), [], m + ': target holds only the public name');
  }
  // the source of the browser module contains no answer bookkeeping either
  const src = require('fs').readFileSync(path.join(__dirname, '../../public/js/sim/packets.js'), 'utf8');
  assert.ok(!/\bfacts\b\s*[.=[]/.test(src) && !/conclusion\s*:/.test(src) && !/\.key\s*=[^=]|allowed\.push|key\.push/.test(src), 'no facts/conclusion/key in public/js/sim/packets.js');
  // and the answers module is server-only (not under public/)
  assert.ok(!require('fs').existsSync(path.join(__dirname, '../../public/js/sim/packets-answers.js')));
});
it('p5: evidence with unrelated packets, a single SYN, or garbage is partial/0 with Thai feedback', () => {
  const p = prob('p5', p5Seed('filtered')), b = g._build(p), F = b.facts;
  const noise = b.capture.find((x) => x.icmp || x.arp).no;
  let r = g.grade('p5', { answers: { conclusion: 'filtered', evidence: F.key.concat([noise]).join(',') } }, p);
  assert.strictEqual(r.score, 9); assert.ok(fbHas(r, /ไม่เกี่ยวกับการเปิดเว็บนี้/));
  r = g.grade('p5', { answers: { conclusion: 'filtered', evidence: String(F.key[0]) } }, p);
  assert.strictEqual(r.score, 8); assert.ok(fbHas(r, /แพ็กเก็ตเดียวยืนยันไม่ได้/));
  r = g.grade('p5', { answers: { conclusion: 'filtered', evidence: 'abc; drop table' } }, p);
  assert.strictEqual(r.score, 6); assert.ok(fbHas(r, /รูปแบบไม่ถูกต้อง/));
  assert.strictEqual(g.grade('p5', { answers: { conclusion: '', evidence: '' } }, p).score, 0);
  r = g.grade('p5', { answers: { conclusion: 'filtered', evidence: Array.from({ length: 50 }, (_, i) => i + 1).join(',') } }, p);
  assert.strictEqual(r.score, 6);
});

/* ---------------- p6 */
it('p6: every generated task has a non-empty expected set that is not the whole capture (100 seeds)', () => {
  const kinds = new Set();
  for (const s of SEEDS.slice(0, 100)) {
    const b = build('p6', s);
    assert.strictEqual(b.tasks.length, 5);
    b.tasks.forEach((t) => { kinds.add(t.kind); const e = g._expectedSet(b, t); assert.ok(e && e.length > 0 && e.length < b.capture.length, t.kind); });
  }
  assert.strictEqual(kinds.size, 15);
});
it('p6: equivalent filters written differently score full (graded by evaluating on the server)', () => {
  const EQ = { dns: 'udp.port == 53', icmp: 'ip.proto == 1', rst: 'tcp.flags.reset == 1 && tcp', http: 'http.request || http.response', dhcp: 'bootp',
    synall: 'tcp.flags.syn eq 1', synonly: 'tcp.flags.syn == 1 and not tcp.flags.ack == 1', udpnodns: 'udp and !(udp.port == 53)', notarp: 'ip',
    echoreq: 'icmp.type == 8 && icmp.code == 0', todns: 'dns.flags.response == 0' };
  let checked = 0;
  for (const s of SEEDS.slice(0, 60)) {
    const p = prob('p6', s), b = g._build(p);
    const a = perfect('p6', b);
    b.tasks.forEach((t, i) => { if (EQ[t.kind]) a['f' + i] = EQ[t.kind]; if (t.kind === 'host') a['f' + i] = `ip.src == ${t.ip} || ip.dst == ${t.ip}`; if (t.kind === 'frames') a['f' + i] = `frame.number in {${t.a} ${t.b}}`; });
    const r = g.grade('p6', { answers: a }, p);
    assert.strictEqual(r.score, 10, s + ' ' + r.feedback.join(' | '));
    checked++;
  }
  assert.ok(checked === 60);
});
it('p6: superset/subset = half credit, syntax error = 0 for that task with the parser message, empty = 0', () => {
  const p = prob('p6', 71), b = g._build(p);
  const a = perfect('p6', b);
  a.f0 = 'ip.addr = 1.2.3.4';
  a.f1 = '';
  const r = g.grade('p6', { answers: a }, p);
  assert.strictEqual(r.score, 6);
  assert.ok(fbHas(r, /ข้อ 1: ตัวกรองผิดรูปแบบ — ใช้ ==/) && fbHas(r, /ข้อ 2: ยังไม่ได้เขียนตัวกรอง/));
  const t = b.tasks.findIndex((x) => x.kind === 'synonly' || x.kind === 'udpnodns' || x.kind === 'echoreq' || x.kind === 'pcweb' || x.kind === 'tcpport' || x.kind === 'todns');
  if (t >= 0) {
    const sup = { synonly: 'tcp.flags.syn == 1', udpnodns: 'udp', echoreq: 'icmp.type == 8 || icmp.type == 0', pcweb: 'tcp.dstport == 80 || tcp.srcport == 80', tcpport: 'tcp', todns: 'udp' }[b.tasks[t].kind];
    const a2 = perfect('p6', b); a2['f' + t] = sup;
    const r2 = g.grade('p6', { answers: a2 }, p);
    assert.ok(r2.score === 9 || r2.score === 8, r2.score + r2.feedback.join('|'));
    assert.ok(fbHas(r2, new RegExp(`ข้อ ${t + 1}: ได้ \\d+ แพ็กเก็ต เกิน`)));
  }
  assert.strictEqual(g.grade('p6', { answers: { f0: '', f1: '  ' } }, p).score, 0);
  const all = {}; b.tasks.forEach((x, i) => { all['f' + i] = 'frame'; });
  assert.strictEqual(g.grade('p6', { answers: all }, p).score, 0);
});

/* ---------------- forged / malformed */
it('forged or tampered problems score 0 (wrong mission, bad seed, wrong version, missing)', () => {
  const p = prob('p2', 81), a = perfect('p2', g._build(p));
  for (const bad of [null, undefined, 'x', {}, Object.assign({}, p, { mission: 'p3' }), Object.assign({}, p, { seed: 'XYZ' }), Object.assign({}, p, { seed: p.seed + '00' }), Object.assign({}, p, { v: 2 }), { v: 1, mission: 'p2' }]) {
    const r = g.grade('p2', { answers: a }, bad);
    assert.strictEqual(r.score, 0); assert.ok(fbHas(r, /โจทย์ไม่ถูกต้องหรือหมดอายุ/));
  }
  const other = Object.assign({}, p, { seed: g.generate('p2', seeded(82)).seed });
  assert.ok(g.grade('p2', { answers: a }, other).score < 10, 'answers belong to a different capture');
  assert.ok(fbHas(g.grade('p9', { answers: a }, p), /ไม่พบภารกิจ/));
});
it('oversized and malformed payloads score 0 with a Thai message and never throw', () => {
  const p = prob('p6', 91);
  assert.ok(fbHas(g.grade('p6', { answers: { f0: 'x'.repeat(25000) } }, p), /ใหญ่เกินไป/));
  assert.strictEqual(g.grade('p6', { answers: { f0: 'x'.repeat(25000) } }, p).score, 0);
  const cyc = { answers: {} }; cyc.answers.self = cyc;
  for (const m of PK.MISSION_IDS) {
    const pm = prob(m, 92);
    for (const pl of [undefined, null, 1, 'x', [], {}, { answers: [] }, { answers: 'abc' }, { answers: null }, cyc,
      { answers: { a_eth: {}, syn: [], q: { x: 1 }, d: true, conclusion: ['dns'], evidence: { a: 1 }, f0: 42, f1: ['tcp'] } }]) {
      const r = g.grade(m, pl, pm);
      assert.ok(r && typeof r.score === 'number' && r.score >= 0 && r.score <= 10, m);
      assert.ok(Array.isArray(r.feedback) && r.feedback.every((f) => typeof f === 'string'));
      if (pl === undefined || pl === null || pl === cyc || typeof pl !== 'object' || Array.isArray(pl) || !pl.answers || typeof pl.answers !== 'object' || Array.isArray(pl.answers)) assert.strictEqual(r.score, 0, m + ' ' + JSON.stringify(pl === cyc ? 'cyc' : pl));
    }
  }
});
it('random junk fuzz: 300 payloads across missions never throw and stay within 0..10', () => {
  const R = seeded(999), junk = () => { const k = Math.floor(R() * 6); return [String(Math.floor(R() * 1e6)), '0x' + Math.floor(R() * 1e5).toString(16), '((', 'tcp.port == ' + Math.floor(R() * 70000), '', '#' + Math.floor(R() * 40)][k]; };
  for (let i = 0; i < 300; i++) {
    const m = PK.MISSION_IDS[i % 6], p = prob(m, i), b = g._build(p);
    const a = {}; b.fields.forEach((f) => { a[f.key] = junk(); });
    const r = g.grade(m, { answers: a }, p);
    assert.ok(r.score >= 0 && r.score <= 10);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
