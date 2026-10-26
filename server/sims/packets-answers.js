'use strict';
/*
 * Packet Analysis lab - SERVER-ONLY answer derivation (Phase 6 leak fix).
 *
 * The shared library (public/js/sim/packets.js) regenerates the simulated capture from the HMAC-signed problem and
 * returns only what the browser needs to draw it: the frames, the public story, the frame numbers the task points at
 * (p1) and the name the task asks about (p2/p3). It no longer records any expected answer.
 *
 * factsFor(b) reads the regenerated capture the way a student does (follow the DNS answer, the TCP stream, the DHCP
 * transaction of the given MAC, the reply to the SYN ...) and returns the expected answers that the grader in
 * server/sims/packets.js compares against. This file is never sent to the browser.
 */

const ipOf = (p) => (p && p.ip ? p.ip : null);
const isSyn = (p) => !!(p.tcp && p.tcp.flags.syn && !p.tcp.flags.ack);
const isSynAck = (p) => !!(p.tcp && p.tcp.flags.syn && p.tcp.flags.ack);
const segLen = (p) => (p.http && p.http.raw ? p.http.raw.length : p.tcp && p.tcp.len ? p.tcp.len : 0);
const pureAck = (p) => !!(p.tcp && p.tcp.flags.ack && !p.tcp.flags.syn && !p.tcp.flags.fin && !p.tcp.flags.rst && segLen(p) === 0);
const nos = (arr) => arr.map((p) => p.no).sort((a, b) => a - b);

/* the three handshake frames (+ first data segment) of the connection that starts with SYN `syn` */
function handshake(cap, syn) {
  const cli = syn.ip.src, srv = syn.ip.dst, cp = syn.tcp.sport, sp = syn.tcp.dport;
  const fromCli = (p) => p.tcp && p.ip.src === cli && p.ip.dst === srv && p.tcp.sport === cp && p.tcp.dport === sp;
  const fromSrv = (p) => p.tcp && p.ip.src === srv && p.ip.dst === cli && p.tcp.sport === sp && p.tcp.dport === cp;
  const synack = cap.find((p) => p.no > syn.no && fromSrv(p) && isSynAck(p));
  const ack = synack && cap.find((p) => p.no > synack.no && fromCli(p) && pureAck(p));
  const data = ack && cap.find((p) => p.no > ack.no && fromCli(p) && segLen(p) > 0);
  return { syn, synack, ack, data };
}

function p1(b) {
  const cap = b.capture, A = cap[b.targets.a - 1], B = cap[b.targets.b - 1];
  const l4b = B.udp || B.tcp;
  return {
    a: A.no, b: B.no,
    a_smac: A.eth.src, a_dip: A.ip.dst, a_dport: A.tcp.dport, a_sip: A.ip.src, a_dmac: A.eth.dst,
    b_l4: B.udp ? 'udp' : 'tcp', b_sport: l4b.sport, b_dmac: B.eth.dst, b_smac: B.eth.src, b_dport: l4b.dport
  };
}

function p2(b) {
  const cap = b.capture, name = b.target.name, pc = b.env.pc;
  const resp = cap.find((p) => p.dns && p.dns.qr && p.dns.qname === name && p.dns.answers.length);
  const ip = resp.dns.answers[0].addr;
  const mine = handshake(cap, cap.find((p) => isSyn(p) && p.ip.src === pc && p.ip.dst === ip));
  const oSyn = cap.find((p) => isSyn(p) && p.ip.src === pc && p.ip.dst !== ip);
  const other = oSyn ? handshake(cap, oSyn) : { syn: null, synack: null, ack: null };
  const get = mine.data, getLen = segLen(get);
  const no = (p) => (p ? p.no : undefined);
  return {
    syn: mine.syn.no, synack: mine.synack.no, ack: mine.ack.no, cport: mine.syn.tcp.sport, sport: mine.syn.tcp.dport,
    ack3: mine.ack.tcp.ack, nextack: (get.tcp.seq + getLen) >>> 0, isnC: mine.syn.tcp.seq, isnS: mine.synack.tcp.seq, getLen, get: get.no,
    other: { syn: no(other.syn), synack: no(other.synack), ack: no(other.ack), cport: other.syn ? other.syn.tcp.sport : undefined }
  };
}

function p3(b) {
  const cap = b.capture, name = b.target.name;
  const q = cap.find((p) => p.dns && !p.dns.qr && p.dns.qname === name);
  const r = cap.find((p) => p.dns && p.dns.qr && p.dns.qname === name && p.dns.id === q.dns.id);
  return { q: q.no, r: r.no, id: q.dns.id, addr: r.dns.answers[0].addr, l4: q.udp ? 'udp' : 'tcp', port: q.udp.dport, name, cport: q.udp.sport, dnsIp: q.ip.dst };
}

function p4(b) {
  const cap = b.capture, mac = b.env.pcMac;
  const dh = cap.filter((p) => p.dhcp);
  const mine = dh.filter((p) => p.dhcp.chaddr === mac);
  const byType = (list, t) => list.find((p) => p.dhcp.type === t);
  const D = byType(mine, 1), O = byType(mine, 2), Q = byType(mine, 3), A = byType(mine, 5);
  const others = dh.filter((p) => p.dhcp.chaddr !== mac);
  const oOffer = byType(others, 2) || byType(others, 5);
  return {
    d: D.no, o: O.no, r: Q.no, a: A.no, yiaddr: O.dhcp.yiaddr, server: O.dhcp.serverId, lease: O.dhcp.lease, xid: O.dhcp.xid,
    otherXid: others.length ? others[0].dhcp.xid : undefined, otherIp: oOffer ? oOffer.dhcp.yiaddr : undefined,
    gw: O.dhcp.router, mask: O.dhcp.mask
  };
}

/* "the web page does not open": decide from the capture, in the order a technician checks it */
function p5(b) {
  const cap = b.capture;
  const dns = cap.filter((p) => p.dns);
  const q = dns.filter((p) => !p.dns.qr), r = dns.filter((p) => p.dns.qr);
  const name = q.length ? q[0].dns.qname : '';
  const f = { key: [], allowed: [], name, ip: '' };
  const nx = r.filter((p) => p.dns.rcode === 3);
  if (nx.length) return Object.assign(f, { variant: 'dns-nx', conclusion: 'dns', key: nos(nx), allowed: nos(dns) });
  if (!r.length) return Object.assign(f, { variant: 'dns-timeout', conclusion: 'dns', key: nos(q), allowed: nos(q), need: 2 });
  const ans = r.find((p) => p.dns.answers.length);
  f.ip = ans ? ans.dns.answers[0].addr : '';
  const tcp = cap.filter((p) => p.tcp && (ipOf(p).dst === f.ip || ipOf(p).src === f.ip));
  const syns = tcp.filter(isSyn);
  const rst = tcp.filter((p) => p.tcp.flags.rst);
  if (rst.length) return Object.assign(f, { variant: 'closed', conclusion: 'closed', key: nos(rst), allowed: nos(dns.concat(syns, rst)) });
  const filt = cap.filter((p) => p.icmp && p.icmp.type === 3 && p.icmp.code === 13);
  if (filt.length) return Object.assign(f, { variant: 'filtered-icmp', conclusion: 'filtered', key: nos(filt), allowed: nos(dns.concat(syns, filt)) });
  return Object.assign(f, { variant: 'filtered', conclusion: 'filtered', key: nos(syns), allowed: nos(dns.concat(syns)), need: 2 });
}

const BY = { p1, p2, p3, p4, p5 };
/* b = PK.buildMission(problem) (already verified/HMAC-checked by the API). Returns {} for p6 (graded by filters). */
function factsFor(b) {
  const fn = b && BY[b.mission];
  return fn ? fn(b) : {};
}

module.exports = { factsFor };
