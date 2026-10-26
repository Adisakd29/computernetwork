'use strict';
/*
 * NetLab - ห้องวิเคราะห์แพ็กเก็ต (Packet Analysis lab)
 *
 * ONE file shared by the browser and the server (UMD):
 *   - browser: window.NL_PACKETS (library) + window.NL_SIMS.packets (UI, mount(root, ctx))
 *   - server : require('public/js/sim/packets.js') returns the library only (server/sims/packets.js)
 *
 * Every capture is SIMULATED: a pure function of a seed (no live traffic is ever read). The server signs
 * the problem {v, mission, seed}; on submit it rebuilds exactly the same capture from the signed seed and
 * grades the answers against answers it derives from that capture on the server only
 * (server/sims/packets-answers.js). This file never computes or holds an expected answer.
 *
 * Library parts: seeded PRNG, packet builders + byte encoder (Ethernet II, ARP, IPv4, TCP, UDP, ICMP, DNS,
 * DHCP, HTTP, NTP), analysis pass (frame numbers, TCP stream index, relative seq/ack, retransmissions,
 * DNS/ICMP request-response links), Wireshark-like columns and detail tree, display-filter engine,
 * Follow TCP Stream, encapsulation layers, scenario + mission builders.
 */
(function () {
  const LIB = (function () {
    /* ------------------------------------------------------------------ seeded PRNG */
    function xmur3(str) {
      let h = 1779033703 ^ str.length;
      for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
      return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
    }
    function sfc32(a, b, c, d) {
      return function () {
        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
        let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
      };
    }
    function makeR(seed) {
      const h = xmur3('netlab-packets:' + seed);
      const f = sfc32(h(), h(), h(), h());
      for (let i = 0; i < 15; i++) f();
      return {
        f,
        int: (a, b) => a + Math.floor(f() * (b - a + 1)),
        pick: (arr) => arr[Math.floor(f() * arr.length)],
        chance: (p) => f() < p,
        u16: () => Math.floor(f() * 65536),
        u32: () => ((Math.floor(f() * 65536) * 65536) + Math.floor(f() * 65536)) >>> 0,
        shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
      };
    }

    /* ------------------------------------------------------------------ address helpers */
    const ipToInt = (s) => {
      const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s));
      if (!m) return null;
      let n = 0;
      for (let i = 1; i <= 4; i++) { const o = Number(m[i]); if (o > 255) return null; n = n * 256 + o; }
      return n;
    };
    const intToIp = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    /* aa:bb:cc:dd:ee:ff, aa-bb-cc-dd-ee-ff, aabb.ccdd.eeff or aabbccddeeff -> "aa:bb:cc:dd:ee:ff" (null when not a MAC) */
    const normMac = (s) => {
      if (typeof s !== 'string' || s.length > 40) return null;
      const t = s.trim().toLowerCase();
      if (!/^[0-9a-f:.\- ]+$/.test(t)) return null;
      const h = t.replace(/[:.\- ]/g, '');
      if (!/^[0-9a-f]{12}$/.test(h)) return null;
      return h.match(/../g).join(':');
    };
    const BCAST = 'ff:ff:ff:ff:ff:ff';
    const hex = (n, w) => '0x' + (n >>> 0).toString(16).padStart(w || 4, '0');

    /* ------------------------------------------------------------------ byte writer */
    function Buf() { this.a = []; }
    Buf.prototype.u8 = function (v) { this.a.push(v & 255); return this; };
    Buf.prototype.u16 = function (v) { this.a.push((v >>> 8) & 255, v & 255); return this; };
    Buf.prototype.u32 = function (v) { v >>>= 0; this.u16(v >>> 16); this.u16(v & 65535); return this; };
    Buf.prototype.ip = function (s) { return this.u32(ipToInt(s)); };
    Buf.prototype.mac = function (s) { s.split(':').forEach((x) => this.a.push(parseInt(x, 16))); return this; };
    Buf.prototype.bytes = function (b) { for (let i = 0; i < b.length; i++) this.a.push(b[i] & 255); return this; };
    Buf.prototype.zero = function (n) { for (let i = 0; i < n; i++) this.a.push(0); return this; };
    const ascii = (s) => { const o = []; for (let i = 0; i < s.length; i++) o.push(s.charCodeAt(i) & 127); return o; };
    function csum(arr) {
      let s = 0;
      for (let i = 0; i < arr.length; i += 2) s += (arr[i] << 8) + (i + 1 < arr.length ? arr[i + 1] : 0);
      while (s >>> 16) s = (s & 65535) + (s >>> 16);
      return (~s) & 65535;
    }
    const pseudo = (src, dst, proto, len) => new Buf().ip(src).ip(dst).u8(0).u8(proto).u16(len).a;

    /* ------------------------------------------------------------------ application encoders */
    const encName = (name) => { const o = []; name.split('.').forEach((l) => { o.push(l.length); ascii(l).forEach((c) => o.push(c)); }); o.push(0); return o; };
    function encDns(d) {
      let fl = 0;
      if (d.qr) fl |= 0x8000;
      fl |= 0x0100;                       // recursion desired
      if (d.qr) fl |= 0x0080;             // recursion available
      fl |= (d.rcode || 0);
      d.flags = fl;
      const b = new Buf().u16(d.id).u16(fl).u16(1).u16(d.answers.length).u16(0).u16(0).bytes(encName(d.qname)).u16(d.qtype).u16(1);
      d.answers.forEach((a) => { b.u16(0xc00c).u16(1).u16(1).u32(a.ttl).u16(4).ip(a.addr); });
      return b.a;
    }
    const DHCP_T = { 1: 'Discover', 2: 'Offer', 3: 'Request', 4: 'Decline', 5: 'ACK', 6: 'NAK', 7: 'Release', 8: 'Inform' };
    const PRL = [1, 3, 6, 15, 31, 33, 43, 44, 46, 47, 119, 121, 249, 252];
    function dhcpOptions(d) {
      const o = [[53, [d.type]]];
      const ipb = (s) => new Buf().ip(s).a;
      if (d.op === 1) {
        o.push([61, [1].concat(d.chaddr.split(':').map((x) => parseInt(x, 16)))]);
        if (d.reqIp) o.push([50, ipb(d.reqIp)]);
        if (d.serverId) o.push([54, ipb(d.serverId)]);
        if (d.hostname) o.push([12, ascii(d.hostname)]);
        o.push([55, PRL.slice()]);
      } else {
        o.push([54, ipb(d.serverId)]);
        o.push([51, new Buf().u32(d.lease).a]);
        o.push([58, new Buf().u32(Math.floor(d.lease / 2)).a]);
        o.push([59, new Buf().u32(Math.floor(d.lease * 7 / 8)).a]);
        o.push([1, ipb(d.mask)]);
        o.push([3, ipb(d.router)]);
        o.push([6, d.dns.reduce((a, x) => a.concat(ipb(x)), [])]);
      }
      return o;
    }
    function encDhcp(d) {
      const b = new Buf().u8(d.op).u8(1).u8(6).u8(0).u32(d.xid).u16(d.secs || 0).u16(d.bflag ? 0x8000 : 0)
        .ip(d.ciaddr).ip(d.yiaddr).ip(d.siaddr).ip('0.0.0.0').mac(d.chaddr).zero(10).zero(64).zero(128).u32(0x63825363);
      d.opts = dhcpOptions(d);
      d.opts.forEach(([c, v]) => { b.u8(c).u8(v.length).bytes(v); });
      b.u8(255);
      while (b.a.length < 300) b.u8(0);
      return b.a;
    }
    const NTP_EPOCH = 2208988800;
    function encNtp(n) {
      const b = new Buf();
      const client = n.mode === 3;
      b.u8(client ? 0x23 : 0x24).u8(client ? 0 : n.stratum).u8(10).u8(client ? 0xe9 : 0xe7);
      b.u32(client ? 0 : 0x00000a3d).u32(client ? 0 : 0x00000e14);
      if (client) b.u32(0); else b.ip(n.refId);
      const ts = (sec) => { const s = Math.floor(sec); b.u32(s + NTP_EPOCH).u32(Math.floor((sec - s) * 4294967296)); };
      if (client) { b.zero(24); ts(n.xmit); }
      else { ts(n.xmit - 37.25); ts(n.orig); ts(n.recv); ts(n.xmit); }
      return b.a;
    }

    /* ------------------------------------------------------------------ frame encoder */
    const FLAG_BITS = { fin: 1, syn: 2, rst: 4, psh: 8, ack: 16 };
    const flagByte = (F) => Object.keys(FLAG_BITS).reduce((n, k) => n | (F[k] ? FLAG_BITS[k] : 0), 0);
    const parseFlags = (s) => ({ syn: s.includes('S'), ack: s.includes('A'), fin: s.includes('F'), rst: s.includes('R'), psh: s.includes('P') });
    function encode(p) {
      let app = [];
      if (p.dns) app = encDns(p.dns);
      else if (p.dhcp) app = encDhcp(p.dhcp);
      else if (p.http) app = ascii(p.http.raw);
      else if (p.ntp) app = encNtp(p.ntp);
      else if (p.data) app = p.data.slice();
      let l4 = [], l4h = 0;
      if (p.tcp) {
        const o = p.tcp, opt = o.optBytes || [];
        const hl = 20 + opt.length;
        o.hdrLen = hl; o.len = app.length;
        const b = new Buf().u16(o.sport).u16(o.dport).u32(o.seq).u32(o.ack).u8((hl / 4) << 4).u8(flagByte(o.flags)).u16(o.win).u16(0).u16(0).bytes(opt).bytes(app);
        const c = csum(pseudo(p.ip.src, p.ip.dst, 6, b.a.length).concat(b.a));
        b.a[16] = c >>> 8; b.a[17] = c & 255; o.checksum = c;
        l4 = b.a; l4h = hl;
      } else if (p.udp) {
        const o = p.udp;
        o.len = 8 + app.length;
        const b = new Buf().u16(o.sport).u16(o.dport).u16(o.len).u16(0).bytes(app);
        let c = csum(pseudo(p.ip.src, p.ip.dst, 17, b.a.length).concat(b.a)); if (c === 0) c = 0xffff;
        b.a[6] = c >>> 8; b.a[7] = c & 255; o.checksum = c;
        l4 = b.a; l4h = 8;
      } else if (p.icmp) {
        const o = p.icmp;
        const b = new Buf().u8(o.type).u8(o.code).u16(0);
        if (o.type === 8 || o.type === 0) b.u16(o.id).u16(o.seq).bytes(o.data);
        else b.u32(0).bytes(o.inner);
        const c = csum(b.a); b.a[2] = c >>> 8; b.a[3] = c & 255; o.checksum = c;
        l4 = b.a; l4h = 8;
      }
      let l3 = [];
      if (p.ip) {
        const o = p.ip;
        o.len = 20 + l4.length;
        const b = new Buf().u8(0x45).u8(0).u16(o.len).u16(o.id).u16(o.df ? 0x4000 : 0).u8(o.ttl).u8(o.proto).u16(0).ip(o.src).ip(o.dst);
        const c = csum(b.a); b.a[10] = c >>> 8; b.a[11] = c & 255; o.checksum = c;
        l3 = b.a.concat(l4);
      } else if (p.arp) {
        const o = p.arp;
        l3 = new Buf().u16(1).u16(0x0800).u8(6).u8(4).u16(o.op).mac(o.sha).ip(o.spa).mac(o.tha).ip(o.tpa).a;
      }
      const e = new Buf().mac(p.eth.dst).mac(p.eth.src).u16(p.eth.type);
      let bytes = e.a.concat(l3);
      const used = bytes.length;
      p.padLen = 0;
      if (p.pad && bytes.length < 60) { p.padLen = 60 - bytes.length; bytes = bytes.concat(new Array(p.padLen).fill(0)); }
      p.bytes = bytes; p.len = bytes.length;
      p.ranges = { frame: [0, p.len], eth: [0, 14] };
      if (p.arp) p.ranges.arp = [14, 42];
      if (p.ip) {
        p.ranges.ip = [14, 34];
        const k = p.tcp ? 'tcp' : p.udp ? 'udp' : 'icmp';
        p.ranges[k] = [34, p.icmp ? used : 34 + l4h];
        if (app.length) p.ranges.app = [34 + l4h, used];
      }
      if (p.padLen) p.ranges.pad = [used, p.len];
      p.appLen = app.length;
      return p;
    }

    /* ------------------------------------------------------------------ simulated network */
    const OUI = {
      pc: ['3c:52:82', 'f4:8e:38', 'a4:bb:6d', '8c:16:45', '00:e0:4c', 'b4:2e:99', '54:bf:64'],
      router: ['d8:07:b6', '00:1e:58', 'c8:3a:35', '00:0c:42', 'e4:8d:8c', '18:a6:f7'],
      srv: ['00:0c:29', '52:54:00', '00:15:5d'],
      printer: ['00:80:77', '30:05:5c', '00:1b:a9']
    };
    const WEB_NAMES = ['www.netlab.test', 'elearning.college.test', 'library.school.test', 'news.example.com', 'shop.example.net', 'portal.vec.test', 'grades.college.test', 'www.example.org', 'wiki.lab.test', 'register.school.test'];
    const CDN_NAMES = ['static.cdn-example.net', 'img.example.com', 'fonts.example.net', 'api.example.org', 'cdn.lab.test'];
    const PC_NAMES = ['LAB-PC-07', 'LAB-PC-12', 'ROOM3-PC21', 'STUDENT-15', 'NET-LAB-04', 'COM2-PC09'];

    function makeEnv(R, opt) {
      opt = opt || {};
      const k = R.int(0, 2);
      const pre = k === 0 ? [192, 168, R.int(0, 254)] : k === 1 ? [10, R.int(0, 254), R.int(0, 254)] : [172, R.int(16, 31), R.int(0, 254)];
      const net = pre.join('.');
      const used = new Set();
      const macs = new Set();
      const mac = (kind) => { let m; do { m = R.pick(OUI[kind]) + ':' + [0, 0, 0].map(() => R.int(0, 255).toString(16).padStart(2, '0')).join(':'); } while (macs.has(m)); macs.add(m); return m; };
      const last = (lo, hi) => { let x; do { x = R.int(lo, hi); } while (used.has(x)); used.add(x); return x; };
      const gwLast = R.pick([1, 254]); used.add(gwLast);
      const local = (name, kind, lo, hi, ttl) => ({ name, ip: net + '.' + last(lo, hi), mac: mac(kind), local: true, ttl });
      const env = { net: net + '.0', prefix: 24, mask: '255.255.255.0', epoch: 1790000000 + R.int(0, 9000000) };
      env.gw = { name: 'gateway', ip: net + '.' + gwLast, mac: mac('router'), local: true, ttl: R.pick([64, 255]) };
      env.pc = local('PC', 'pc', 20, 199, 128);
      env.other = local('PC2', 'pc', 20, 199, 128);
      env.printer = local('printer', 'printer', 200, 240, 64);
      env.dhcpSrv = R.chance(0.6) ? env.gw : local('server', 'srv', 2, 9, 64);
      const pub = R.chance(0.7) || opt.publicDns;
      env.dns = pub ? { name: 'dns', ip: R.pick(['8.8.8.8', '1.1.1.1', '9.9.9.9', '8.8.4.4']), local: false, ttl: R.pick([64, 128]), hops: R.int(7, 13) } : env.gw;
      env.dns2 = { name: 'dns2', ip: env.dns.ip === '1.1.1.1' ? '8.8.8.8' : '1.1.1.1', local: false, ttl: 64, hops: R.int(7, 13) };
      const names = R.shuffle(WEB_NAMES), cdns = R.shuffle(CDN_NAMES);
      const ipUsed = new Set();
      const remoteIp = () => { let ip; do { ip = R.pick(['203.0.113', '198.51.100', '192.0.2']) + '.' + R.int(10, 250); } while (ipUsed.has(ip)); ipUsed.add(ip); return ip; };
      env.web = names.slice(0, 4).map((n) => ({ name: n, ip: remoteIp(), local: false, ttl: R.pick([64, 64, 128]), hops: R.int(6, 16) }));
      env.cdn = cdns.slice(0, 2).map((n) => ({ name: n, ip: remoteIp(), local: false, ttl: 64, hops: R.int(5, 12) }));
      env.pcName = R.pick(PC_NAMES);
      return env;
    }

    /* capture under construction: packets are encoded as soon as they are created */
    function Cap(R, env) { this.R = R; this.env = env; this.pk = []; }
    Cap.prototype.add = function (t, p) { p.t = t; p.pad = p.eth.src !== this.env.pc.mac; encode(p); this.pk.push(p); return p; };
    Cap.prototype.ipv4 = function (from, to, proto) {
      const env = this.env;
      const eth = { src: from.local ? from.mac : env.gw.mac, dst: to.bcast ? BCAST : to.local ? to.mac : env.gw.mac, type: 0x0800 };
      if (from._ipid == null) from._ipid = this.R.u16();
      from._ipid = (from._ipid + 1) & 65535;
      const ttl = from.local ? from.ttl : from.ttl - from.hops;
      return { eth, ip: { src: from.ip, dst: to.ip, ttl, id: from._ipid, df: proto === 6 || (proto === 17 && !from.local), proto } };
    };
    Cap.prototype.arpReq = function (t, from, tip) {
      return this.add(t, { eth: { src: from.mac, dst: BCAST, type: 0x0806 }, arp: { op: 1, sha: from.mac, spa: from.ip, tha: '00:00:00:00:00:00', tpa: tip } });
    };
    Cap.prototype.arpRep = function (t, from, to) {
      return this.add(t, { eth: { src: from.mac, dst: to.mac, type: 0x0806 }, arp: { op: 2, sha: from.mac, spa: from.ip, tha: to.mac, tpa: to.ip } });
    };
    Cap.prototype.udp = function (t, from, to, sport, dport, app) {
      const p = this.ipv4(from, to, 17);
      p.udp = { sport, dport };
      Object.assign(p, app || {});
      return this.add(t, p);
    };
    Cap.prototype.dnsQ = function (t, cli, srv, sport, id, qname, qtype) {
      return this.udp(t, cli, srv, sport, 53, { dns: { id, qr: 0, rcode: 0, qname, qtype: qtype || 1, answers: [] } });
    };
    Cap.prototype.dnsR = function (t, srv, cli, sport, id, qname, addrs, rcode, qtype) {
      const ttl = this.R.int(60, 3600);
      return this.udp(t, srv, cli, 53, sport, { dns: { id, qr: 1, rcode: rcode || 0, qname, qtype: qtype || 1, answers: (addrs || []).map((a) => ({ name: qname, ttl, addr: a })) } });
    };
    Cap.prototype.echo = function (t, from, to, type, id, seq) {
      const p = this.ipv4(from, to, 1);
      p.ip.df = false;
      p.icmp = { type, code: 0, id, seq, data: ascii('abcdefghijklmnopqrstuvwabcdefghi') };
      return this.add(t, p);
    };
    Cap.prototype.unreach = function (t, from, to, code, orig) {
      const p = this.ipv4(from, to, 1);
      p.ip.df = false;
      const o = orig.ip, l4 = orig.tcp || orig.udp;
      p.icmp = { type: 3, code, inner: orig.bytes.slice(14, 14 + 28), innerInfo: { src: o.src, dst: o.dst, proto: o.proto, ttl: o.ttl, sport: l4.sport, dport: l4.dport, seq: orig.tcp ? orig.tcp.seq : undefined } };
      return this.add(t, p);
    };
    Cap.prototype.ntp = function (t, cli, srv, sport) {
      const env = this.env;
      const x = env.epoch + t;
      const q = this.udp(t, cli, srv, sport, 123, { ntp: { mode: 3, xmit: x } });
      const rtt = 0.012 + this.R.f() * 0.02;
      const r = this.udp(t + rtt, srv, cli, 123, sport, { ntp: { mode: 4, stratum: 2, refId: '10.10.10.10', orig: x, recv: x + rtt / 2, xmit: x + rtt / 2 + 0.0001 } });
      return [q, r];
    };
    /* TCP connection: tracks next sequence numbers per direction ('c' client, 's' server) */
    const SYN_OPTS_C = [2, 4, 5, 180, 1, 3, 3, 8, 1, 1, 4, 2];   // MSS=1460, NOP, WS=8 (x256), NOP, NOP, SACK_PERM
    const SYN_OPTS_S = [2, 4, 5, 180, 1, 1, 4, 2, 1, 3, 3, 7];   // MSS=1460, NOP, NOP, SACK_PERM, NOP, WS=7 (x128)
    Cap.prototype.conn = function (cli, srv, sport, dport) {
      const cap = this, R = this.R;
      const c = { cli, srv, sport, dport, isn: { c: R.u32(), s: R.u32() }, last: {} };
      c.nxt = { c: c.isn.c, s: c.isn.s };
      c.seg = function (t, dir, flags, o) {
        o = o || {};
        const from = dir === 'c' ? cli : srv, to = dir === 'c' ? srv : cli, other = dir === 'c' ? 's' : 'c';
        const p = cap.ipv4(from, to, 6);
        const F = parseFlags(flags);
        const data = o.http ? o.http.raw.length : 0;
        const seq = o.seq != null ? o.seq : o.retrans ? c.last[dir] : c.nxt[dir];
        const syn = F.syn ? (dir === 'c' ? SYN_OPTS_C : SYN_OPTS_S) : [];
        p.tcp = {
          sport: dir === 'c' ? sport : dport, dport: dir === 'c' ? dport : sport, seq: seq >>> 0,
          ack: F.ack ? (o.ack != null ? o.ack : c.nxt[other]) >>> 0 : 0, flags: F,
          win: o.win != null ? o.win : F.rst ? 0 : dir === 'c' ? (F.syn ? 64240 : 1026) : (F.syn ? 65160 : 501), optBytes: syn
        };
        if (o.http) p.http = o.http;
        if (!o.retrans && o.seq == null) { c.last[dir] = seq; c.nxt[dir] = (seq + data + (F.syn ? 1 : 0) + (F.fin ? 1 : 0)) >>> 0; }
        return cap.add(t, p);
      };
      return c;
    };
    const rtt = (R, host) => host.local ? 0.0003 + R.f() * 0.0009 : 0.008 + host.hops * 0.0018 + R.f() * 0.01;
    const eport = (R) => R.int(49200, 65200);

    /* HTTP messages */
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
    function httpGet(host, path, port) {
      const h = port && port !== 80 ? host + ':' + port : host;
      const raw = `GET ${path} HTTP/1.1\r\nHost: ${h}\r\nUser-Agent: ${UA}\r\nAccept: text/html,application/xhtml+xml,*/*;q=0.8\r\nAccept-Language: th-TH,th;q=0.9,en;q=0.8\r\nConnection: keep-alive\r\n\r\n`;
      return { request: true, method: 'GET', uri: path, host: h, raw };
    }
    function http200(R, title) {
      const body = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${title}</title></head>\n<body><h1>${title}</h1>\n<p>Simulated page from NetLab packet lab.</p>\n<p>Request id ${R.int(100000, 999999)}</p>\n</body></html>\n`;
      const raw = `HTTP/1.1 200 OK\r\nServer: nginx\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${body.length}\r\nCache-Control: max-age=60\r\nConnection: keep-alive\r\n\r\n` + body;
      return { response: true, code: 200, phrase: 'OK', ctype: 'text/html', raw };
    }
    const PATHS = ['/', '/index.html', '/login', '/news/today', '/course/net101', '/schedule.html'];

    /* ------------------------------------------------------------------ reusable traffic blocks */
    function bArp(cap, t, from, target) {
      const R = cap.R;
      const q = cap.arpReq(t, from, target.ip);
      const r = cap.arpRep(t + 0.0002 + R.f() * 0.0008, target, from);
      return { q, r, t: r.t };
    }
    function bDns(cap, t, name, addr, opt) {
      opt = opt || {};
      const R = cap.R, env = cap.env, srv = opt.server || env.dns;
      const sport = opt.sport || eport(R), id = opt.id != null ? opt.id : R.u16();
      const q = cap.dnsQ(t, env.pc, srv, sport, id, name, opt.qtype);
      const res = { q, sport, id, srv, name, addr };
      if (opt.noReply) { res.t = q.t; return res; }
      res.r = cap.dnsR(t + rtt(R, srv), srv, env.pc, sport, id, name, addr ? [addr] : [], opt.rcode, opt.qtype);
      res.t = res.r.t;
      return res;
    }
    /* full web visit over TCP: handshake, GET, 200, close (opt.stopAfterGet ends after the GET) */
    function bWeb(cap, t, srv, opt) {
      opt = opt || {};
      const R = cap.R, env = cap.env, d = rtt(R, srv);
      const port = opt.port || 80, sport = opt.sport || eport(R);
      const c = cap.conn(env.pc, srv, sport, port);
      const out = { c, sport, port };
      out.syn = c.seg(t, 'c', 'S');
      out.synack = c.seg(t + d, 's', 'SA');
      out.ack = c.seg(t + d + 0.0003, 'c', 'A');
      if (opt.handshakeOnly) { out.t = out.ack.t; return out; }
      const get = httpGet(srv.name, opt.path || R.pick(PATHS), port);
      out.get = c.seg(t + d + 0.0009, 'c', 'PA', { http: get });
      out.getLen = get.raw.length;
      if (opt.stopAfterGet) { out.t = out.get.t; return out; }
      out.getAck = c.seg(out.get.t + d, 's', 'A');
      out.resp = c.seg(out.getAck.t + 0.002 + R.f() * 0.01, 's', 'PA', { http: http200(R, opt.title || srv.name) });
      out.respAck = c.seg(out.resp.t + 0.0004, 'c', 'A');
      if (opt.noClose) { out.t = out.respAck.t; return out; }
      const tc = out.respAck.t + 0.5 + R.f() * 1.5;
      out.fin1 = c.seg(tc, 'c', 'FA');
      out.fin2 = c.seg(tc + d, 's', 'FA');
      out.fin3 = c.seg(tc + d + 0.0003, 'c', 'A');
      out.t = out.fin3.t;
      return out;
    }
    function bPing(cap, t, target, count) {
      const R = cap.R, env = cap.env;
      const id = 1, seq0 = R.int(1, 400), out = [];
      for (let i = 0; i < count; i++) {
        const tt = t + i * (1 + R.f() * 0.01);
        const q = cap.echo(tt, env.pc, target, 8, id, seq0 + i);
        const r = cap.echo(tt + rtt(R, target), target, env.pc, 0, id, seq0 + i);
        out.push(q, r);
      }
      return { pk: out, t: out[out.length - 1].t };
    }
    /* DHCP DORA for client host h (h.ip is the address the server will offer) */
    function bDora(cap, t, h, opt) {
      opt = opt || {};
      const R = cap.R, env = cap.env, srv = env.dhcpSrv;
      const xid = R.u32(), lease = opt.lease || R.pick([3600, 7200, 28800, 86400, 691200]);
      const bflag = opt.bflag != null ? opt.bflag : R.chance(0.5);
      const zero = { ip: '0.0.0.0', mac: h.mac, local: true, ttl: 128 };
      const all = { ip: '255.255.255.255', bcast: true };
      const dst = bflag ? all : { ip: h.ip, mac: h.mac, local: true };
      const base = { xid, chaddr: h.mac, ciaddr: '0.0.0.0', siaddr: '0.0.0.0', bflag };
      const reply = { serverId: srv.ip, lease, mask: env.mask, router: env.gw.ip, dns: env.dns.ip === env.gw.ip ? [env.gw.ip] : [env.dns.ip, env.dns2.ip] };
      const D = cap.udp(t, zero, all, 68, 67, { dhcp: Object.assign({}, base, { op: 1, type: 1, yiaddr: '0.0.0.0', hostname: opt.hostname, secs: 0 }) });
      const tO = t + 0.002 + R.f() * 0.6;
      const offer = { ip: srv.ip, mac: srv.mac, local: true, ttl: srv.ttl, _ipid: srv._ipid };
      const O = cap.udp(tO, offer, dst, 67, 68, { dhcp: Object.assign({}, base, reply, { op: 2, type: 2, yiaddr: h.ip, siaddr: srv === env.gw ? '0.0.0.0' : srv.ip }) });
      srv._ipid = offer._ipid;
      const Q = cap.udp(tO + 0.001 + R.f() * 0.05, zero, all, 68, 67, { dhcp: Object.assign({}, base, { op: 1, type: 3, yiaddr: '0.0.0.0', reqIp: h.ip, serverId: srv.ip, hostname: opt.hostname, secs: 0 }) });
      const ack = { ip: srv.ip, mac: srv.mac, local: true, ttl: srv.ttl, _ipid: srv._ipid };
      const A = cap.udp(Q.t + 0.002 + R.f() * 0.3, ack, dst, 67, 68, { dhcp: Object.assign({}, base, reply, { op: 2, type: 5, yiaddr: h.ip, siaddr: srv === env.gw ? '0.0.0.0' : srv.ip }) });
      srv._ipid = ack._ipid;
      return { D, O, Q, A, xid, lease, server: srv.ip, yiaddr: h.ip, t: A.t };
    }

    /* ------------------------------------------------------------------ analysis pass */
    function finalize(pk) {
      pk.sort((a, b) => a.t - b.t);
      const t0 = pk.length ? pk[0].t : 0;
      pk.forEach((p, i) => { p.no = i + 1; p.t = Math.round((p.t - t0) * 1e6) / 1e6; });
      const streams = new Map();
      let sIdx = 0;
      const dnsQ = new Map(), echoQ = new Map();
      for (const p of pk) {
        if (p.tcp) {
          const o = p.tcp;
          const a = p.ip.src + ':' + o.sport, b = p.ip.dst + ':' + o.dport;
          const key = a < b ? a + '|' + b : b + '|' + a;
          let s = streams.get(key);
          if (!s) { s = { idx: sIdx++, base: {}, seen: new Set(), first: a }; streams.set(key, s); }
          o.stream = s.idx;
          if (s.base[a] == null) s.base[a] = o.flags.syn ? o.seq : (o.seq - 1) >>> 0;
          o.relSeq = (o.seq - s.base[a]) >>> 0;
          if (o.flags.ack) { if (s.base[b] == null) s.base[b] = (o.ack - 1) >>> 0; o.relAck = (o.ack - s.base[b]) >>> 0; }
          o.nextRel = (o.relSeq + o.len + (o.flags.syn ? 1 : 0) + (o.flags.fin ? 1 : 0)) >>> 0;
          if (o.len > 0 || o.flags.syn || o.flags.fin) {
            const sig = a + '|' + o.seq + '|' + flagByte(o.flags) + '|' + o.len;
            if (s.seen.has(sig)) o.retrans = true;
            s.seen.add(sig);
          }
        }
        if (p.dns) {
          const k = p.dns.id + '|' + (p.dns.qr ? p.ip.dst + ':' + p.udp.dport : p.ip.src + ':' + p.udp.sport);
          if (!p.dns.qr) { if (!dnsQ.has(k)) dnsQ.set(k, p); }
          else { const q = dnsQ.get(k); if (q) { p.dns.reqIn = q.no; p.dns.time = Math.round((p.t - q.t) * 1e6) / 1e6; if (!q.dns.respIn) q.dns.respIn = p.no; } }
        }
        if (p.icmp && (p.icmp.type === 8 || p.icmp.type === 0)) {
          const k = p.icmp.id + '|' + p.icmp.seq;
          if (p.icmp.type === 8) echoQ.set(k, p);
          else { const q = echoQ.get(k); if (q) { q.icmp.replyIn = p.no; p.icmp.reqIn = q.no; } }
        }
      }
      pk.forEach(columns);
      return pk;
    }
    const flagNames = (F) => {
      const n = [];
      if (F.fin) n.push('FIN'); if (F.syn) n.push('SYN'); if (F.rst) n.push('RST'); if (F.psh) n.push('PSH'); if (F.ack) n.push('ACK');
      return n.join(', ');
    };
    const RCODE = { 0: 'No error', 2: 'Server failure', 3: 'No such name', 5: 'Refused' };
    const QTYPE = { 1: 'A', 28: 'AAAA' };
    const UNREACH = { 0: 'Network unreachable', 1: 'Host unreachable', 3: 'Port unreachable', 13: 'Communication administratively filtered' };
    function columns(p) {
      p.src = p.ip ? p.ip.src : p.eth.src;
      p.dst = p.ip ? p.ip.dst : (p.eth.dst === BCAST ? 'Broadcast' : p.eth.dst);
      if (p.arp) {
        p.proto = 'ARP';
        const a = p.arp;
        p.info = a.op === 1 ? (a.spa === '0.0.0.0' ? `Who has ${a.tpa}? (ARP Probe)` : a.spa === a.tpa ? `Gratuitous ARP for ${a.spa} (Request)` : `Who has ${a.tpa}? Tell ${a.spa}`) : `${a.spa} is at ${a.sha}`;
      } else if (p.dhcp) {
        p.proto = 'DHCP'; p.info = `DHCP ${DHCP_T[p.dhcp.type]} - Transaction ID ${hex(p.dhcp.xid, 8)}`;
      } else if (p.dns) {
        const d = p.dns, qt = QTYPE[d.qtype] || d.qtype;
        p.proto = 'DNS';
        p.info = !d.qr ? `Standard query ${hex(d.id)} ${qt} ${d.qname}`
          : `Standard query response ${hex(d.id)}${d.rcode ? ' ' + RCODE[d.rcode] : ''} ${qt} ${d.qname}` + d.answers.map((a) => ` A ${a.addr}`).join('');
      } else if (p.ntp) {
        p.proto = 'NTP'; p.info = `NTP Version 4, ${p.ntp.mode === 3 ? 'client' : 'server'}`;
      } else if (p.http) {
        p.proto = 'HTTP';
        p.info = p.http.request ? `${p.http.method} ${p.http.uri} HTTP/1.1` : `HTTP/1.1 ${p.http.code} ${p.http.phrase}  (${p.http.ctype})`;
      } else if (p.tcp) {
        const o = p.tcp;
        p.proto = 'TCP';
        let s = `${o.sport} → ${o.dport} [${flagNames(o.flags)}] Seq=${o.relSeq}`;
        if (o.flags.ack) s += ` Ack=${o.relAck}`;
        s += ` Win=${o.win} Len=${o.len}`;
        if (o.flags.syn) s += o.optBytes === SYN_OPTS_C ? ' MSS=1460 WS=256 SACK_PERM' : ' MSS=1460 SACK_PERM WS=128';
        p.info = (o.retrans ? '[TCP Retransmission] ' : '') + s;
      } else if (p.icmp) {
        const o = p.icmp;
        p.proto = 'ICMP';
        if (o.type === 8) p.info = `Echo (ping) request  id=${hex(o.id)}, seq=${o.seq}, ttl=${p.ip.ttl}` + (o.replyIn ? ` (reply in ${o.replyIn})` : ' (no response found!)');
        else if (o.type === 0) p.info = `Echo (ping) reply    id=${hex(o.id)}, seq=${o.seq}, ttl=${p.ip.ttl}` + (o.reqIn ? ` (request in ${o.reqIn})` : '');
        else p.info = `Destination unreachable (${UNREACH[o.code] || 'code ' + o.code})`;
      } else if (p.udp) {
        p.proto = 'UDP'; p.info = `${p.udp.sport} → ${p.udp.dport} Len=${p.udp.len - 8}`;
      } else { p.proto = 'Ethernet'; p.info = ''; }
    }

    /* ------------------------------------------------------------------ detail tree (Wireshark-like) */
    const F_ = (l, f, v, k) => { const o = { l }; if (f) o.f = f; if (v !== undefined) o.v = v; if (k && k.length) o.k = k; return o; };
    const q = (s) => '"' + s + '"';
    const durTxt = (s) => s % 86400 === 0 ? (s / 86400) + (s === 86400 ? ' day' : ' days') : s % 3600 === 0 ? (s / 3600) + (s === 3600 ? ' hour' : ' hours') : s + ' seconds';
    function protoStack(p) {
      const s = ['eth', 'ethertype'];
      if (p.arp) s.push('arp');
      if (p.ip) s.push('ip');
      if (p.tcp) s.push('tcp'); if (p.udp) s.push('udp'); if (p.icmp) s.push('icmp');
      if (p.dns) s.push('dns'); if (p.dhcp) s.push('dhcp'); if (p.http) s.push('http'); if (p.ntp) s.push('ntp'); if (p.data) s.push('data');
      return s.join(':');
    }
    const ipProtoName = (n) => ({ 1: 'ICMP', 6: 'TCP', 17: 'UDP' })[n] || String(n);
    function tree(p) {
      const L = [];
      L.push({ key: 'frame', title: `Frame ${p.no}: ${p.len} bytes on wire (${p.len * 8} bits), ${p.len} bytes captured (${p.len * 8} bits)`, fields: [
        F_(`Frame Number: ${p.no}`, 'frame.number', String(p.no)),
        F_(`[Time since reference or first frame: ${p.t.toFixed(6)} seconds]`),
        F_(`Frame Length: ${p.len} bytes (${p.len * 8} bits)`, 'frame.len', String(p.len)),
        F_(`[Protocols in frame: ${protoStack(p)}]`),
        F_('[Simulated capture: สร้างโดยโปรแกรมจำลอง NetLab ไม่ใช่ข้อมูลจริง]')
      ] });
      const e = p.eth;
      const ef = [
        F_(`Destination: ${e.dst}${e.dst === BCAST ? ' (Broadcast)' : ''}`, 'eth.dst', e.dst),
        F_(`Source: ${e.src}`, 'eth.src', e.src),
        F_(`Type: ${e.type === 0x0806 ? 'ARP' : 'IPv4'} (${hex(e.type)})`, 'eth.type', hex(e.type))
      ];
      if (p.padLen) ef.push(F_(`Padding: ${'00'.repeat(p.padLen)}`));
      L.push({ key: 'eth', title: `Ethernet II, Src: ${e.src}, Dst: ${e.dst}${e.dst === BCAST ? ' (Broadcast)' : ''}`, fields: ef });
      if (p.arp) {
        const a = p.arp;
        L.push({ key: 'arp', title: `Address Resolution Protocol (${a.op === 1 ? 'request' : 'reply'})`, fields: [
          F_('Hardware type: Ethernet (1)'), F_('Protocol type: IPv4 (0x0800)'), F_('Hardware size: 6'), F_('Protocol size: 4'),
          F_(`Opcode: ${a.op === 1 ? 'request' : 'reply'} (${a.op})`, 'arp.opcode', String(a.op)),
          F_(`Sender MAC address: ${a.sha}`, 'arp.src.hw_mac', a.sha),
          F_(`Sender IP address: ${a.spa}`, 'arp.src.proto_ipv4', a.spa),
          F_(`Target MAC address: ${a.tha}`, 'arp.dst.hw_mac', a.tha),
          F_(`Target IP address: ${a.tpa}`, 'arp.dst.proto_ipv4', a.tpa)
        ] });
      }
      if (p.ip) {
        const o = p.ip;
        L.push({ key: 'ip', title: `Internet Protocol Version 4, Src: ${o.src}, Dst: ${o.dst}`, fields: [
          F_('0100 .... = Version: 4'), F_('.... 0101 = Header Length: 20 bytes (5)'),
          F_('Differentiated Services Field: 0x00 (DSCP: CS0, ECN: Not-ECT)'),
          F_(`Total Length: ${o.len}`, 'ip.len', String(o.len)),
          F_(`Identification: ${hex(o.id)} (${o.id})`, 'ip.id', hex(o.id)),
          F_(`Flags: ${o.df ? "0x2, Don't fragment" : '0x0'}`, null, undefined, [F_('0... .... = Reserved bit: Not set'), F_(`.${o.df ? 1 : 0}.. .... = Don't fragment: ${o.df ? 'Set' : 'Not set'}`), F_('..0. .... = More fragments: Not set')]),
          F_('...0 0000 0000 0000 = Fragment Offset: 0'),
          F_(`Time to Live: ${o.ttl}`, 'ip.ttl', String(o.ttl)),
          F_(`Protocol: ${ipProtoName(o.proto)} (${o.proto})`, 'ip.proto', String(o.proto)),
          F_(`Header Checksum: ${hex(o.checksum)} [validation disabled]`),
          F_(`Source Address: ${o.src}`, 'ip.src', o.src),
          F_(`Destination Address: ${o.dst}`, 'ip.dst', o.dst)
        ] });
      }
      if (p.tcp) {
        const o = p.tcp, F = o.flags;
        const fl = flagByte(F);
        const opts = [];
        if (o.optBytes.length) {
          const isC = o.optBytes === SYN_OPTS_C;
          opts.push(F_('TCP Option - Maximum segment size: 1460 bytes'));
          if (isC) opts.push(F_('TCP Option - No-Operation (NOP)'), F_('TCP Option - Window scale: 8 (multiply by 256)'), F_('TCP Option - No-Operation (NOP)'), F_('TCP Option - No-Operation (NOP)'), F_('TCP Option - SACK permitted'));
          else opts.push(F_('TCP Option - No-Operation (NOP)'), F_('TCP Option - No-Operation (NOP)'), F_('TCP Option - SACK permitted'), F_('TCP Option - No-Operation (NOP)'), F_('TCP Option - Window scale: 7 (multiply by 128)'));
        }
        const fields = [
          F_(`Source Port: ${o.sport}`, 'tcp.srcport', String(o.sport)),
          F_(`Destination Port: ${o.dport}`, 'tcp.dstport', String(o.dport)),
          F_(`[Stream index: ${o.stream}]`, 'tcp.stream', String(o.stream)),
          F_(`[TCP Segment Len: ${o.len}]`, 'tcp.len', String(o.len)),
          F_(`Sequence Number: ${o.relSeq}    (relative sequence number)`, 'tcp.seq', String(o.relSeq)),
          F_(`Sequence Number (raw): ${o.seq}`, 'tcp.seq_raw', String(o.seq)),
          F_(`[Next Sequence Number: ${o.nextRel}    (relative sequence number)]`),
          F_(`Acknowledgment Number: ${F.ack ? o.relAck + '    (relative ack number)' : 0}`, 'tcp.ack', String(F.ack ? o.relAck : 0)),
          F_(`Acknowledgment number (raw): ${o.ack}`, 'tcp.ack_raw', String(o.ack)),
          F_(`${(o.hdrLen / 4).toString(2).padStart(4, '0')} .... = Header Length: ${o.hdrLen} bytes (${o.hdrLen / 4})`),
          F_(`Flags: ${hex(fl, 3)} (${flagNames(F)})`, null, undefined, [
            F_('.... ..0. .... = Urgent: Not set'),
            F_(`.... ...${F.ack ? 1 : 0} .... = Acknowledgment: ${F.ack ? 'Set' : 'Not set'}`, 'tcp.flags.ack', F.ack ? '1' : '0'),
            F_(`.... .... ${F.psh ? 1 : 0}... = Push: ${F.psh ? 'Set' : 'Not set'}`, 'tcp.flags.push', F.psh ? '1' : '0'),
            F_(`.... .... .${F.rst ? 1 : 0}.. = Reset: ${F.rst ? 'Set' : 'Not set'}`, 'tcp.flags.reset', F.rst ? '1' : '0'),
            F_(`.... .... ..${F.syn ? 1 : 0}. = Syn: ${F.syn ? 'Set' : 'Not set'}`, 'tcp.flags.syn', F.syn ? '1' : '0'),
            F_(`.... .... ...${F.fin ? 1 : 0} = Fin: ${F.fin ? 'Set' : 'Not set'}`, 'tcp.flags.fin', F.fin ? '1' : '0'),
            F_(`[TCP Flags: ${['F', 'S', 'R', 'P', 'A'].map((c, i) => (fl >> i) & 1 ? c : '·').reverse().join('')}]`)
          ]),
          F_(`Window: ${o.win}`, 'tcp.window_size_value', String(o.win)),
          F_(`Checksum: ${hex(o.checksum)} [unverified]`),
          F_('Urgent Pointer: 0')
        ];
        if (opts.length) fields.push(F_(`Options: (${o.optBytes.length} bytes), Maximum segment size, ...`, null, undefined, opts));
        if (o.retrans) fields.push(F_('[SEQ/ACK analysis]', null, undefined, [F_('[TCP Analysis Flags]', null, undefined, [F_('[This frame is a (suspected) retransmission]', 'tcp.analysis.retransmission')])]));
        if (o.len) fields.push(F_(`TCP payload (${o.len} bytes)`));
        L.push({ key: 'tcp', title: `Transmission Control Protocol, Src Port: ${o.sport}, Dst Port: ${o.dport}, Seq: ${o.relSeq}${F.ack ? ', Ack: ' + o.relAck : ''}, Len: ${o.len}`, fields });
      }
      if (p.udp) {
        const o = p.udp;
        L.push({ key: 'udp', title: `User Datagram Protocol, Src Port: ${o.sport}, Dst Port: ${o.dport}`, fields: [
          F_(`Source Port: ${o.sport}`, 'udp.srcport', String(o.sport)),
          F_(`Destination Port: ${o.dport}`, 'udp.dstport', String(o.dport)),
          F_(`Length: ${o.len}`, 'udp.length', String(o.len)),
          F_(`Checksum: ${hex(o.checksum)} [unverified]`),
          F_(`UDP payload (${o.len - 8} bytes)`)
        ] });
      }
      if (p.icmp) {
        const o = p.icmp;
        const fields = [];
        if (o.type === 8 || o.type === 0) {
          fields.push(F_(`Type: ${o.type} (Echo (ping) ${o.type === 8 ? 'request' : 'reply'})`, 'icmp.type', String(o.type)), F_('Code: 0', 'icmp.code', '0'),
            F_(`Checksum: ${hex(o.checksum)} [correct]`), F_(`Identifier (BE): ${o.id} (${hex(o.id)})`, 'icmp.ident', String(o.id)),
            F_(`Sequence Number (BE): ${o.seq} (${hex(o.seq)})`, 'icmp.seq', String(o.seq)));
          if (o.replyIn) fields.push(F_(`[Response frame: ${o.replyIn}]`));
          if (o.reqIn) fields.push(F_(`[Request frame: ${o.reqIn}]`));
          fields.push(F_('Data (32 bytes): 6162636465666768696a6b6c6d6e6f707172737475767761...'));
        } else {
          const i = o.innerInfo;
          fields.push(F_(`Type: 3 (Destination unreachable)`, 'icmp.type', '3'), F_(`Code: ${o.code} (${UNREACH[o.code]})`, 'icmp.code', String(o.code)),
            F_(`Checksum: ${hex(o.checksum)} [correct]`), F_('Unused: 00000000'),
            F_(`Internet Protocol Version 4, Src: ${i.src}, Dst: ${i.dst}  (ส่วนหัวของแพ็กเก็ตต้นฉบับที่ส่งไม่ถึง)`, null, undefined, [F_(`Time to Live: ${i.ttl}`), F_(`Protocol: ${ipProtoName(i.proto)} (${i.proto})`), F_(`Source Address: ${i.src}`), F_(`Destination Address: ${i.dst}`)]),
            F_(`${i.proto === 6 ? 'Transmission Control Protocol' : 'User Datagram Protocol'}, Src Port: ${i.sport}, Dst Port: ${i.dport}`, null, undefined, [F_(`Source Port: ${i.sport}`), F_(`Destination Port: ${i.dport}`)]));
        }
        L.push({ key: 'icmp', title: 'Internet Control Message Protocol', fields });
      }
      if (p.dns) {
        const d = p.dns, qt = QTYPE[d.qtype] || String(d.qtype);
        const flagsTxt = d.qr ? `Standard query response, ${RCODE[d.rcode] || 'rcode ' + d.rcode}` : 'Standard query';
        const fields = [
          F_(`Transaction ID: ${hex(d.id)}`, 'dns.id', hex(d.id)),
          F_(`Flags: ${hex(d.flags)} ${flagsTxt}`, null, undefined, [
            F_(`${d.qr ? 1 : 0}... .... .... .... = Response: Message is a ${d.qr ? 'response' : 'query'}`, 'dns.flags.response', d.qr ? '1' : '0'),
            F_('.000 0... .... .... = Opcode: Standard query (0)'),
            F_('.... ...1 .... .... = Recursion desired: Do query recursively')
          ].concat(d.qr ? [F_('.... .... 1... .... = Recursion available: Server can do recursive queries'),
            F_(`.... .... .... ${(d.rcode || 0).toString(2).padStart(4, '0')} = Reply code: ${RCODE[d.rcode] || d.rcode} (${d.rcode})`, 'dns.flags.rcode', String(d.rcode))] : [])),
          F_('Questions: 1'), F_(`Answer RRs: ${d.answers.length}`, 'dns.count.answers', String(d.answers.length)), F_('Authority RRs: 0'), F_('Additional RRs: 0'),
          F_('Queries', null, undefined, [F_(`${d.qname}: type ${qt}, class IN`, null, undefined, [F_(`Name: ${d.qname}`, 'dns.qry.name', q(d.qname)), F_(`Type: ${qt} (${d.qtype})`, 'dns.qry.type', String(d.qtype)), F_('Class: IN (0x0001)')])])
        ];
        if (d.answers.length) fields.push(F_('Answers', null, undefined, d.answers.map((a) => F_(`${a.name}: type A, class IN, addr ${a.addr}`, null, undefined, [
          F_(`Name: ${a.name}`), F_('Type: A (1) (Host Address)'), F_('Class: IN (0x0001)'), F_(`Time to live: ${a.ttl} (${a.ttl} seconds)`), F_('Data length: 4'), F_(`Address: ${a.addr}`, 'dns.a', a.addr)]))));
        if (d.respIn) fields.push(F_(`[Response In: ${d.respIn}]`));
        if (d.reqIn) fields.push(F_(`[Request In: ${d.reqIn}]`), F_(`[Time: ${d.time.toFixed(6)} seconds]`));
        L.push({ key: 'app', title: `Domain Name System (${d.qr ? 'response' : 'query'})`, fields });
      }
      if (p.dhcp) {
        const d = p.dhcp;
        const names = { 53: 'DHCP Message Type', 61: 'Client identifier', 50: 'Requested IP Address', 54: 'DHCP Server Identifier', 51: 'IP Address Lease Time', 58: 'Renewal Time Value', 59: 'Rebinding Time Value', 1: 'Subnet Mask', 3: 'Router', 6: 'Domain Name Server', 12: 'Host Name', 55: 'Parameter Request List' };
        const ipOf = (v, i) => v.slice(i || 0, (i || 0) + 4).join('.');
        const u32 = (v) => ((v[0] << 24) | (v[1] << 16) | (v[2] << 8) | v[3]) >>> 0;
        const optF = d.opts.map(([c, v]) => {
          let s = '', f = null, val, kids = [];
          if (c === 53) { s = `(${DHCP_T[d.type]})`; kids = [F_(`DHCP: ${DHCP_T[d.type]} (${d.type})`, 'dhcp.option.dhcp', String(d.type))]; }
          else if (c === 61) { s = ''; kids = [F_('Hardware type: Ethernet (0x01)'), F_(`Client MAC address: ${d.chaddr}`)]; }
          else if (c === 50) { s = ''; kids = [F_(`Requested IP Address: ${ipOf(v)}`, 'dhcp.option.requested_ip_address', ipOf(v))]; }
          else if (c === 54) { kids = [F_(`DHCP Server Identifier: ${ipOf(v)}`, 'dhcp.option.dhcp_server_id', ipOf(v))]; }
          else if (c === 51 || c === 58 || c === 59) { const n = u32(v); kids = [F_(`${c === 51 ? 'IP Address Lease Time' : c === 58 ? 'Renewal Time Value' : 'Rebinding Time Value'}: (${n}s) ${durTxt(n)}`, c === 51 ? 'dhcp.option.ip_address_lease_time' : null, c === 51 ? String(n) : undefined)]; }
          else if (c === 1) kids = [F_(`Subnet Mask: ${ipOf(v)}`, 'dhcp.option.subnet_mask', ipOf(v))];
          else if (c === 3) kids = [F_(`Router: ${ipOf(v)}`, 'dhcp.option.router', ipOf(v))];
          else if (c === 6) { for (let i = 0; i < v.length; i += 4) kids.push(F_(`Domain Name Server: ${ipOf(v, i)}`, 'dhcp.option.domain_name_server', ipOf(v, i))); }
          else if (c === 12) kids = [F_(`Host Name: ${String.fromCharCode.apply(null, v)}`)];
          else if (c === 55) kids = [F_(`Parameter Request List Item: ${v.join(', ')}`)];
          kids.unshift(F_(`Length: ${v.length}`));
          return F_(`Option: (${c}) ${names[c] || 'Option'}${s ? ' ' + s : ''}`, f, val, kids);
        });
        optF.push(F_('Option: (255) End'));
        L.push({ key: 'app', title: `Dynamic Host Configuration Protocol (${DHCP_T[d.type]})`, fields: [
          F_(`Message type: Boot ${d.op === 1 ? 'Request' : 'Reply'} (${d.op})`),
          F_('Hardware type: Ethernet (0x01)'), F_('Hardware address length: 6'), F_('Hops: 0'),
          F_(`Transaction ID: ${hex(d.xid, 8)}`, 'dhcp.id', hex(d.xid, 8)),
          F_(`Seconds elapsed: ${d.secs || 0}`),
          F_(`Bootp flags: ${d.bflag ? '0x8000, Broadcast flag (Broadcast)' : '0x0000 (Unicast)'}`),
          F_(`Client IP address: ${d.ciaddr}`, 'dhcp.ip.client', d.ciaddr),
          F_(`Your (client) IP address: ${d.yiaddr}`, 'dhcp.ip.your', d.yiaddr),
          F_(`Next server IP address: ${d.siaddr}`, 'dhcp.ip.server', d.siaddr),
          F_('Relay agent IP address: 0.0.0.0'),
          F_(`Client MAC address: ${d.chaddr}`, 'dhcp.hw.mac_addr', d.chaddr),
          F_('Client hardware address padding: 00000000000000000000'),
          F_('Server host name not given'), F_('Boot file name not given'), F_('Magic cookie: DHCP')
        ].concat(optF) });
      }
      if (p.http) {
        const lines = p.http.raw.split('\r\n');
        const blank = lines.indexOf('');
        const head = lines.slice(0, blank);
        const fields = head.map((ln, i) => {
          if (i === 0 && p.http.request) return F_(`${ln}\\r\\n`, null, undefined, [F_(`Request Method: ${p.http.method}`, 'http.request.method', q(p.http.method)), F_(`Request URI: ${p.http.uri}`, 'http.request.uri', q(p.http.uri)), F_('Request Version: HTTP/1.1')]);
          if (i === 0) return F_(`${ln}\\r\\n`, null, undefined, [F_('Response Version: HTTP/1.1'), F_(`Status Code: ${p.http.code}`, 'http.response.code', String(p.http.code)), F_(`Response Phrase: ${p.http.phrase}`)]);
          if (/^Host:/i.test(ln)) return F_(`${ln}\\r\\n`, 'http.host', q(p.http.host));
          return F_(`${ln}\\r\\n`);
        });
        fields.push(F_('\\r\\n'));
        if (p.http.request) fields.push(F_(`[Full request URI: http://${p.http.host}${p.http.uri}]`));
        else { const body = lines.slice(blank + 1).join('\r\n'); fields.push(F_(`Line-based text data: text/html (${body.split('\n').filter(Boolean).length} lines)`)); }
        L.push({ key: 'app', title: 'Hypertext Transfer Protocol', fields });
      }
      if (p.ntp) {
        const n = p.ntp, c = n.mode === 3;
        const iso = (s) => new Date(s * 1000).toISOString().replace('T', ' ').replace('Z', ' UTC');
        L.push({ key: 'app', title: `Network Time Protocol (NTP Version 4, ${c ? 'client' : 'server'})`, fields: [
          F_(`Flags: ${c ? '0x23' : '0x24'}, Leap Indicator: no warning, Version number: NTP Version 4, Mode: ${c ? 'client' : 'server'}`),
          F_(`Peer Clock Stratum: ${c ? 'unspecified or invalid (0)' : 'secondary reference (2)'}`),
          F_(`Transmit Timestamp: ${iso(n.xmit)}`)
        ] });
      }
      if (p.data) L.push({ key: 'app', title: `Data (${p.data.length} bytes)`, fields: [F_(`Data: ${p.data.map((x) => x.toString(16).padStart(2, '0')).join('')}`), F_(`[Length: ${p.data.length}]`)] });
      return L;
    }

    /* which header belongs to which layer (OSI / TCP-IP) */
    function encapLayers(p) {
      const out = [{ key: 'eth', name: 'Ethernet II', unit: 'Frame', osi: 2, osiName: 'Data Link', tcpip: 'Network Access (Link)', bytes: 14 }];
      if (p.arp) { out.push({ key: 'arp', name: 'ARP', unit: 'ARP message', osi: 2, osiName: 'Data Link (ARP เชื่อม IP กับ MAC ไม่มี IP header)', tcpip: 'Network Access (Link)', bytes: 28 }); return out; }
      out.push({ key: 'ip', name: 'IPv4', unit: 'Packet', osi: 3, osiName: 'Network', tcpip: 'Internet', bytes: 20 });
      if (p.tcp) out.push({ key: 'tcp', name: 'TCP', unit: 'Segment', osi: 4, osiName: 'Transport', tcpip: 'Transport', bytes: p.tcp.hdrLen });
      if (p.udp) out.push({ key: 'udp', name: 'UDP', unit: 'Datagram', osi: 4, osiName: 'Transport', tcpip: 'Transport', bytes: 8 });
      if (p.icmp) out.push({ key: 'icmp', name: 'ICMP', unit: 'ICMP message (อยู่ใน IP)', osi: 3, osiName: 'Network', tcpip: 'Internet', bytes: p.len - 34 - p.padLen });
      const app = p.dns ? 'DNS' : p.dhcp ? 'DHCP' : p.http ? 'HTTP' : p.ntp ? 'NTP' : p.data ? 'Data' : null;
      if (app) out.push({ key: 'app', name: app, unit: 'Data', osi: 7, osiName: 'Application', tcpip: 'Application', bytes: p.appLen });
      return out;
    }

    function hexDump(bytes) {
      const out = [];
      for (let i = 0; i < bytes.length; i += 16) out.push({ off: i, bytes: bytes.slice(i, i + 16) });
      return out;
    }

    function followStream(cap, idx) {
      const segs = cap.filter((p) => p.tcp && p.tcp.stream === idx);
      if (!segs.length) return null;
      const first = segs[0];
      const cli = { ip: first.ip.src, port: first.tcp.sport }, srv = { ip: first.ip.dst, port: first.tcp.dport };
      const parts = [];
      segs.forEach((p) => {
        if (!p.tcp.len || p.tcp.retrans) return;
        const dir = p.ip.src === cli.ip && p.tcp.sport === cli.port ? 'c' : 's';
        const text = p.http ? p.http.raw : '';
        parts.push({ dir, frame: p.no, text: text.replace(/[^\n\r\t\x20-\x7e]/g, '.') });
      });
      const flags = segs.map((p) => ({ no: p.no, dir: p.ip.src === cli.ip && p.tcp.sport === cli.port ? 'c' : 's', flags: flagNames(p.tcp.flags), len: p.tcp.len, retrans: !!p.tcp.retrans }));
      return { idx, cli, srv, parts, segs: flags, filter: 'tcp.stream eq ' + idx };
    }

    /* ------------------------------------------------------------------ display filter engine */
    const T = { ip: 'ip', mac: 'mac', num: 'num', bool: 'bool', str: 'str', none: 'none' };
    const one = (v) => (v === undefined || v === null ? [] : [v]);
    const FIELDS = {
      'frame.number': [T.num, (p) => [p.no]], 'frame.len': [T.num, (p) => [p.len]],
      'eth.src': [T.mac, (p) => [p.eth.src]], 'eth.dst': [T.mac, (p) => [p.eth.dst]], 'eth.addr': [T.mac, (p) => [p.eth.src, p.eth.dst]], 'eth.type': [T.num, (p) => [p.eth.type]],
      'arp.opcode': [T.num, (p) => p.arp ? [p.arp.op] : []],
      'arp.src.proto_ipv4': [T.ip, (p) => p.arp ? [ipToInt(p.arp.spa)] : []], 'arp.dst.proto_ipv4': [T.ip, (p) => p.arp ? [ipToInt(p.arp.tpa)] : []],
      'arp.src.hw_mac': [T.mac, (p) => p.arp ? [p.arp.sha] : []], 'arp.dst.hw_mac': [T.mac, (p) => p.arp ? [p.arp.tha] : []],
      'ip.src': [T.ip, (p) => p.ip ? [ipToInt(p.ip.src)] : []], 'ip.dst': [T.ip, (p) => p.ip ? [ipToInt(p.ip.dst)] : []],
      'ip.addr': [T.ip, (p) => p.ip ? [ipToInt(p.ip.src), ipToInt(p.ip.dst)] : []],
      'ip.ttl': [T.num, (p) => p.ip ? [p.ip.ttl] : []], 'ip.proto': [T.num, (p) => p.ip ? [p.ip.proto] : []], 'ip.id': [T.num, (p) => p.ip ? [p.ip.id] : []], 'ip.len': [T.num, (p) => p.ip ? [p.ip.len] : []],
      'tcp.port': [T.num, (p) => p.tcp ? [p.tcp.sport, p.tcp.dport] : []], 'tcp.srcport': [T.num, (p) => p.tcp ? [p.tcp.sport] : []], 'tcp.dstport': [T.num, (p) => p.tcp ? [p.tcp.dport] : []],
      'tcp.seq': [T.num, (p) => p.tcp ? [p.tcp.relSeq] : []], 'tcp.ack': [T.num, (p) => p.tcp ? [p.tcp.flags.ack ? p.tcp.relAck : 0] : []],
      'tcp.seq_raw': [T.num, (p) => p.tcp ? [p.tcp.seq] : []], 'tcp.ack_raw': [T.num, (p) => p.tcp ? [p.tcp.ack] : []],
      'tcp.len': [T.num, (p) => p.tcp ? [p.tcp.len] : []], 'tcp.stream': [T.num, (p) => p.tcp ? [p.tcp.stream] : []], 'tcp.window_size_value': [T.num, (p) => p.tcp ? [p.tcp.win] : []],
      'tcp.flags.syn': [T.bool, (p) => p.tcp ? [p.tcp.flags.syn ? 1 : 0] : []], 'tcp.flags.ack': [T.bool, (p) => p.tcp ? [p.tcp.flags.ack ? 1 : 0] : []],
      'tcp.flags.fin': [T.bool, (p) => p.tcp ? [p.tcp.flags.fin ? 1 : 0] : []], 'tcp.flags.reset': [T.bool, (p) => p.tcp ? [p.tcp.flags.rst ? 1 : 0] : []],
      'tcp.flags.push': [T.bool, (p) => p.tcp ? [p.tcp.flags.psh ? 1 : 0] : []],
      'tcp.analysis.retransmission': [T.none, (p) => p.tcp && p.tcp.retrans ? [1] : []],
      'udp.port': [T.num, (p) => p.udp ? [p.udp.sport, p.udp.dport] : []], 'udp.srcport': [T.num, (p) => p.udp ? [p.udp.sport] : []], 'udp.dstport': [T.num, (p) => p.udp ? [p.udp.dport] : []],
      'udp.length': [T.num, (p) => p.udp ? [p.udp.len] : []],
      'icmp.type': [T.num, (p) => p.icmp ? [p.icmp.type] : []], 'icmp.code': [T.num, (p) => p.icmp ? [p.icmp.code] : []],
      'icmp.ident': [T.num, (p) => p.icmp && p.icmp.id != null ? [p.icmp.id] : []], 'icmp.seq': [T.num, (p) => p.icmp && p.icmp.seq != null ? [p.icmp.seq] : []],
      'dns.id': [T.num, (p) => p.dns ? [p.dns.id] : []], 'dns.flags.response': [T.bool, (p) => p.dns ? [p.dns.qr ? 1 : 0] : []],
      'dns.flags.rcode': [T.num, (p) => p.dns && p.dns.qr ? [p.dns.rcode] : []], 'dns.qry.name': [T.str, (p) => p.dns ? [p.dns.qname] : []],
      'dns.qry.type': [T.num, (p) => p.dns ? [p.dns.qtype] : []],
      'dns.a': [T.ip, (p) => p.dns ? p.dns.answers.map((a) => ipToInt(a.addr)) : []], 'dns.count.answers': [T.num, (p) => p.dns ? [p.dns.answers.length] : []],
      'dhcp.id': [T.num, (p) => p.dhcp ? [p.dhcp.xid] : []], 'dhcp.option.dhcp': [T.num, (p) => p.dhcp ? [p.dhcp.type] : []],
      'dhcp.ip.your': [T.ip, (p) => p.dhcp ? [ipToInt(p.dhcp.yiaddr)] : []], 'dhcp.ip.client': [T.ip, (p) => p.dhcp ? [ipToInt(p.dhcp.ciaddr)] : []],
      'dhcp.ip.server': [T.ip, (p) => p.dhcp ? [ipToInt(p.dhcp.siaddr)] : []], 'dhcp.hw.mac_addr': [T.mac, (p) => p.dhcp ? [p.dhcp.chaddr] : []],
      'dhcp.option.dhcp_server_id': [T.ip, (p) => p.dhcp && p.dhcp.serverId ? [ipToInt(p.dhcp.serverId)] : []],
      'dhcp.option.requested_ip_address': [T.ip, (p) => p.dhcp && p.dhcp.reqIp ? [ipToInt(p.dhcp.reqIp)] : []],
      'dhcp.option.ip_address_lease_time': [T.num, (p) => p.dhcp && p.dhcp.op === 2 ? [p.dhcp.lease] : []],
      'dhcp.option.subnet_mask': [T.ip, (p) => p.dhcp && p.dhcp.op === 2 ? [ipToInt(p.dhcp.mask)] : []],
      'dhcp.option.router': [T.ip, (p) => p.dhcp && p.dhcp.op === 2 ? [ipToInt(p.dhcp.router)] : []],
      'dhcp.option.domain_name_server': [T.ip, (p) => p.dhcp && p.dhcp.op === 2 ? p.dhcp.dns.map(ipToInt) : []],
      'http.request': [T.none, (p) => p.http && p.http.request ? [1] : []], 'http.response': [T.none, (p) => p.http && p.http.response ? [1] : []],
      'http.request.method': [T.str, (p) => p.http && p.http.request ? [p.http.method] : []], 'http.request.uri': [T.str, (p) => p.http && p.http.request ? [p.http.uri] : []],
      'http.host': [T.str, (p) => p.http && p.http.request ? [p.http.host] : []], 'http.response.code': [T.num, (p) => p.http && p.http.response ? [p.http.code] : []]
    };
    ['dhcp.id', 'dhcp.option.dhcp', 'dhcp.ip.your', 'dhcp.ip.client', 'dhcp.ip.server', 'dhcp.hw.mac_addr'].forEach((k) => { FIELDS['bootp' + k.slice(4)] = FIELDS[k]; });
    const PROTOS = {
      frame: () => true, eth: (p) => !!p.eth, arp: (p) => !!p.arp, ip: (p) => !!p.ip, tcp: (p) => !!p.tcp, udp: (p) => !!p.udp, icmp: (p) => !!p.icmp,
      dns: (p) => !!p.dns, dhcp: (p) => !!p.dhcp, bootp: (p) => !!p.dhcp, http: (p) => !!p.http, ntp: (p) => !!p.ntp, data: (p) => !!p.data
    };
    const SUGGEST = {
      'ip.source': 'ip.src', 'ip.destination': 'ip.dst', 'ip.dest': 'ip.dst', 'ip.address': 'ip.addr', 'ip.ip': 'ip.addr', 'ipaddr': 'ip.addr', 'ip.add': 'ip.addr',
      'port': 'tcp.port หรือ udp.port', 'tcp.syn': 'tcp.flags.syn', 'tcp.rst': 'tcp.flags.reset', 'tcp.flags.rst': 'tcp.flags.reset', 'tcp.reset': 'tcp.flags.reset',
      'tcp.fin': 'tcp.flags.fin', 'tcp.ack.flag': 'tcp.flags.ack', 'syn': 'tcp.flags.syn == 1', 'rst': 'tcp.flags.reset == 1', 'ping': 'icmp', 'mac': 'eth.addr',
      'eth.mac': 'eth.addr', 'src': 'ip.src', 'dst': 'ip.dst', 'ipv4': 'ip', 'tcp.src': 'tcp.srcport', 'tcp.dst': 'tcp.dstport', 'udp.src': 'udp.srcport', 'udp.dst': 'udp.dstport',
      'frame.no': 'frame.number', 'frame.num': 'frame.number', 'no': 'frame.number', 'dhcpv4': 'dhcp', 'web': 'http', 'tcp.flag.syn': 'tcp.flags.syn', 'dns.name': 'dns.qry.name'
    };
    function lev(a, b) {
      if (Math.abs(a.length - b.length) > 2) return 9;
      const d = []; for (let i = 0; i <= a.length; i++) d.push([i]);
      for (let j = 1; j <= b.length; j++) d[0][j] = j;
      for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return d[a.length][b.length];
    }
    const KW = { and: '&&', or: '||', not: '!', eq: '==', ne: '!=', gt: '>', lt: '<', ge: '>=', le: '<=', contains: 'contains', in: 'in' };
    function FErr(msg, pos) { this.msg = msg; this.pos = pos; }
    function tokenize(s) {
      const toks = []; let i = 0;
      while (i < s.length) {
        const c = s[i];
        if (/\s/.test(c)) { i++; continue; }
        const two = s.slice(i, i + 2);
        if (['&&', '||', '==', '!=', '>=', '<='].includes(two)) { toks.push({ k: 'op', v: two, pos: i }); i += 2; continue; }
        if ('(){},'.includes(c)) { toks.push({ k: c, v: c, pos: i }); i++; continue; }
        if (c === '!' || c === '>' || c === '<') { toks.push({ k: 'op', v: c, pos: i }); i++; continue; }
        if (c === '=') throw new FErr('ใช้ == (เท่ากับสองตัว) ในการเปรียบเทียบ ไม่ใช่ = ตัวเดียว เช่น ip.addr == 192.168.1.10', i);
        if (c === '&') throw new FErr('"และ" ต้องเขียน && (สองตัว) หรือ and', i);
        if (c === '|') throw new FErr('"หรือ" ต้องเขียน || (สองตัว) หรือ or', i);
        if (c === '"') {
          const j = s.indexOf('"', i + 1);
          if (j < 0) throw new FErr('เครื่องหมายคำพูด " ไม่ครบคู่', i);
          toks.push({ k: 'str', v: s.slice(i + 1, j), pos: i }); i = j + 1; continue;
        }
        const m = /^[A-Za-z0-9_.:\-/]+/.exec(s.slice(i));
        if (!m) throw new FErr(`ไม่รู้จักอักขระ '${c}'`, i);
        const w = m[0], lw = w.toLowerCase();
        if (KW[lw]) toks.push({ k: KW[lw] === 'contains' || KW[lw] === 'in' ? KW[lw] : 'op', v: KW[lw], pos: i, word: true });
        else toks.push({ k: 'word', v: w, pos: i });
        i += w.length;
      }
      return toks;
    }
    const REL = ['==', '!=', '>', '<', '>=', '<='];
    function parseValue(field, type, tok) {
      if (!tok || (tok.k !== 'word' && tok.k !== 'str')) throw new FErr(`ต้องมีค่าหลังเครื่องหมายเปรียบเทียบของ ${field} เช่น ${type === T.ip ? '192.168.1.10' : type === T.mac ? 'aa:bb:cc:dd:ee:ff' : type === T.str ? '"www.netlab.test"' : '80'}`, tok ? tok.pos : -1);
      const v = tok.v;
      if (type === T.ip) {
        const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/.exec(v);
        const n = m ? ipToInt(m[1]) : null;
        if (n === null || (m[2] != null && Number(m[2]) > 32)) throw new FErr(`'${v}' ไม่ใช่ IPv4 address ที่ถูกต้อง (เช่น 192.168.1.10 หรือ 192.168.1.0/24)`, tok.pos);
        const pre = m[2] != null ? Number(m[2]) : 32;
        const mask = pre === 0 ? 0 : (0xffffffff << (32 - pre)) >>> 0;
        return { ip: (n & mask) >>> 0, mask };
      }
      if (type === T.mac) { const mm = normMac(v); if (!mm) throw new FErr(`'${v}' ไม่ใช่ MAC address ที่ถูกต้อง (เช่น aa:bb:cc:dd:ee:ff)`, tok.pos); return mm; }
      if (type === T.num || type === T.bool) {
        if (type === T.bool && /^(true|false)$/i.test(v)) return /^true$/i.test(v) ? 1 : 0;
        if (/^\d{1,10}$/.test(v)) return Number(v);
        if (/^0x[0-9a-f]{1,8}$/i.test(v)) return parseInt(v, 16);
        throw new FErr(`'${v}' ไม่ใช่ตัวเลข (${field} ต้องเปรียบเทียบกับตัวเลข เช่น ${type === T.bool ? '1 หรือ 0' : '80'})`, tok.pos);
      }
      return v;
    }
    function compileFilter(text) {
      const s = typeof text === 'string' ? text : '';
      if (s.length > 300) return { ok: false, error: 'ตัวกรองยาวเกินไป (ไม่เกิน 300 ตัวอักษร)', pos: 300 };
      if (!s.trim()) return { ok: true, empty: true, test: () => true, text: '' };
      let toks;
      try { toks = tokenize(s); } catch (e) { if (e instanceof FErr) return { ok: false, error: e.msg, pos: e.pos }; throw e; }
      if (toks.length > 120) return { ok: false, error: 'ตัวกรองซับซ้อนเกินไป', pos: 0 };
      let i = 0;
      const peek = () => toks[i];
      const isOp = (t, v) => t && t.k === 'op' && t.v === v;
      function pOr() { let a = pAnd(); while (isOp(peek(), '||')) { i++; const b = pAnd(); a = { t: 'or', a, b }; } return a; }
      function pAnd() { let a = pNot(); while (isOp(peek(), '&&')) { i++; const b = pNot(); a = { t: 'and', a, b }; } return a; }
      function pNot() { if (isOp(peek(), '!')) { i++; return { t: 'not', a: pNot() }; } return pPrim(); }
      function pPrim() {
        const t = peek();
        if (!t) throw new FErr('ตัวกรองจบไม่สมบูรณ์: ต้องมีชื่อฟิลด์หรือโปรโตคอลต่อท้าย (เช่น หลัง && หรือ !)', s.length);
        if (t.k === '(') {
          i++;
          const e = pOr();
          if (!peek() || peek().k !== ')') throw new FErr('วงเล็บไม่ครบ: ขาดวงเล็บปิด )', peek() ? peek().pos : s.length);
          i++;
          return e;
        }
        if (t.k === ')') throw new FErr('มีวงเล็บปิด ) เกินมา หรือในวงเล็บว่างเปล่า', t.pos);
        if (t.k !== 'word') throw new FErr(t.k === 'str' ? `ค่า "${t.v}" อยู่ผิดตำแหน่ง: ต้องเขียนชื่อฟิลด์ก่อน เช่น dns.qry.name == "${t.v}"` : `ไม่คาดว่าจะเจอ '${t.v}' ตรงนี้ ต้องเป็นชื่อฟิลด์หรือโปรโตคอล`, t.pos);
        const name = t.v.toLowerCase();
        const fd = FIELDS[name], pr = PROTOS[name];
        if (!fd && !pr) {
          if (/^[\d.:/\-]+$/.test(t.v) || /^0x/i.test(t.v)) throw new FErr(`'${t.v}' อยู่ผิดตำแหน่ง: ต้องเขียนชื่อฟิลด์ก่อนค่าทุกครั้ง เช่น ip.addr == ${t.v} หรือ tcp.port == ${t.v} (ถ้าต้องการหลายค่า เขียน tcp.port == 80 || tcp.port == 443)`, t.pos);
          let sug = SUGGEST[name];
          if (!sug) { const all = Object.keys(FIELDS).concat(Object.keys(PROTOS)); let best = null, bd = 3; all.forEach((k) => { const d = lev(name, k); if (d < bd) { bd = d; best = k; } }); sug = best; }
          throw new FErr(`ไม่รู้จักชื่อฟิลด์หรือโปรโตคอล '${t.v}'` + (sug ? ` (หมายถึง ${sug} หรือไม่?)` : ''), t.pos);
        }
        i++;
        const nx = peek();
        const rel = nx && ((nx.k === 'op' && REL.includes(nx.v)) || nx.k === 'contains' || nx.k === 'in');
        if (!rel) return { t: 'has', name, g: fd ? fd[1] : null, pr };
        if (!fd) throw new FErr(`'${name}' เป็นชื่อโปรโตคอล ใช้เปรียบเทียบค่าไม่ได้ ใช้ชื่อฟิลด์แทน เช่น ${name === 'tcp' || name === 'udp' ? name + '.port == 80' : name === 'ip' ? 'ip.addr == 192.168.1.10' : name + ' (ไม่ต้องมีค่า)'}`, nx.pos);
        const type = fd[0];
        if (type === T.none) throw new FErr(`${name} เป็นฟิลด์แบบ "มีหรือไม่มี" ใช้ชื่อฟิลด์อย่างเดียว ไม่ต้องเปรียบเทียบค่า`, nx.pos);
        i++;
        if (nx.k === 'in') {
          if (!peek() || peek().k !== '{') throw new FErr('หลัง in ต้องเป็นชุดค่าในวงเล็บปีกกา เช่น tcp.port in {80 443}', peek() ? peek().pos : s.length);
          i++;
          const vals = [];
          while (peek() && peek().k !== '}') { if (peek().k === ',') { i++; continue; } vals.push(parseValue(name, type, peek())); i++; }
          if (!peek()) throw new FErr('ขาดวงเล็บปีกกาปิด }', s.length);
          i++;
          if (!vals.length) throw new FErr('ชุดค่าใน { } ว่างเปล่า', nx.pos);
          return { t: 'in', name, type, g: fd[1], vals };
        }
        const op = nx.v;
        if (op === 'contains' && type !== T.str) throw new FErr(`contains ใช้ได้กับฟิลด์ข้อความ (เช่น dns.qry.name, http.host) เท่านั้น`, nx.pos);
        if ((type === T.ip || type === T.mac || type === T.bool || type === T.str) && !['==', '!=', 'contains'].includes(op)) throw new FErr(`${name} ใช้ได้เฉพาะ == หรือ != (เปรียบเทียบมากกว่า/น้อยกว่าไม่ได้)`, nx.pos);
        const val = parseValue(name, type, peek());
        if (type === T.bool && val !== 0 && val !== 1) throw new FErr(`${name} มีค่าได้แค่ 1 (Set) หรือ 0 (Not set)`, peek().pos);
        i++;
        return { t: 'cmp', name, type, op, val, g: fd[1] };
      }
      let ast;
      try {
        ast = pOr();
        if (i < toks.length) {
          const t = toks[i];
          if (t.k === ')') throw new FErr('มีวงเล็บปิด ) เกินมา', t.pos);
          if (t.k === 'op' && REL.includes(t.v)) throw new FErr(`ใช้ ${t.v} ต่อจากชื่อโปรโตคอลหรือค่าไม่ได้ ต้องเป็นชื่อฟิลด์ เช่น tcp.port ${t.v} 80`, t.pos);
          throw new FErr(`ขาด && หรือ || ก่อน '${t.v}' (ต้องเชื่อมเงื่อนไขด้วย && หรือ ||)`, t.pos);
        }
      } catch (e) { if (e instanceof FErr) return { ok: false, error: e.msg, pos: e.pos }; throw e; }
      const eq = (type, v, x) => type === T.ip ? ((v & x.mask) >>> 0) === x.ip : type === T.str ? String(v).toLowerCase() === String(x).toLowerCase() : v === x;
      function ev(n, p) {
        switch (n.t) {
          case 'or': return ev(n.a, p) || ev(n.b, p);
          case 'and': return ev(n.a, p) && ev(n.b, p);
          case 'not': return !ev(n.a, p);
          case 'has': return n.g ? n.g(p).length > 0 : n.pr(p);
          case 'in': { const vs = n.g(p); return vs.some((v) => n.vals.some((x) => eq(n.type, v, x))); }
          case 'cmp': {
            const vs = n.g(p);
            if (!vs.length) return false;
            switch (n.op) {
              case '==': return vs.some((v) => eq(n.type, v, n.val));
              case '!=': return vs.every((v) => !eq(n.type, v, n.val));
              case '>': return vs.some((v) => v > n.val);
              case '<': return vs.some((v) => v < n.val);
              case '>=': return vs.some((v) => v >= n.val);
              case '<=': return vs.some((v) => v <= n.val);
              case 'contains': return vs.some((v) => String(v).toLowerCase().includes(String(n.val).toLowerCase()));
            }
          }
        }
        return false;
      }
      return { ok: true, test: (p) => ev(ast, p), text: s };
    }
    /* frame numbers matched by a filter, or the parse error */
    function runFilter(cap, text) {
      const c = compileFilter(text);
      if (!c.ok) return c;
      return { ok: true, empty: !!c.empty, set: cap.filter((p) => c.test(p)).map((p) => p.no) };
    }

    /* ------------------------------------------------------------------ explore scenarios */
    const SCEN = [
      { id: 'arp', title: 'ARP: Request / Reply', about: 'เครื่อง PC ถาม MAC ของ gateway ด้วย ARP Request แบบ Broadcast (ff:ff:ff:ff:ff:ff) แล้ว gateway ตอบ ARP Reply แบบ Unicast สังเกตว่า ARP ไม่มี IP header เลย และ Target MAC ใน Request เป็น 00:00:00:00:00:00',
        build(cap) { const env = cap.env; bArp(cap, 0, env.pc, env.gw); bArp(cap, 1.3, env.other, env.printer); cap.arpReq(2.1, env.pc, env.printer.ip); cap.arpRep(2.1006, env.printer, env.pc); } },
      { id: 'dhcp', title: 'DHCP: DORA', about: 'Discover → Offer → Request → ACK ใช้ UDP พอร์ต 68 (client) และ 67 (server) client ยังไม่มี IP จึงส่งจาก 0.0.0.0 ไป 255.255.255.255 ทุกข้อความในรอบเดียวกันมี Transaction ID เดียวกัน',
        build(cap) { const env = cap.env; const d = bDora(cap, 0, env.pc, { hostname: env.pcName }); cap.arpReq(d.t + 0.3, { mac: env.pc.mac, ip: '0.0.0.0' }, env.pc.ip); cap.add(d.t + 1.4, { eth: { src: env.pc.mac, dst: BCAST, type: 0x0806 }, arp: { op: 1, sha: env.pc.mac, spa: env.pc.ip, tha: '00:00:00:00:00:00', tpa: env.pc.ip } }); } },
      { id: 'dns', title: 'DNS: Query / Response (UDP 53)', about: 'เครื่อง PC ถาม DNS server ว่าชื่อเว็บมี IP อะไร (record A) ผ่าน UDP พอร์ต 53 response มี Transaction ID ตรงกับ query เสมอ',
        build(cap) { const env = cap.env; bArp(cap, 0, env.pc, env.gw); bDns(cap, 0.01, env.web[0].name, env.web[0].ip); bDns(cap, 0.05, env.cdn[0].name, env.cdn[0].ip); } },
      { id: 'tcp', title: 'TCP 3-way handshake + HTTP + ปิดการเชื่อมต่อ', about: 'SYN → SYN-ACK → ACK แล้วส่ง HTTP GET ได้ 200 OK จากนั้นปิดด้วย FIN/ACK ลองดู Seq/Ack แบบ relative และ raw และลอง Follow TCP Stream',
        build(cap) { const env = cap.env; const d = bDns(cap, 0, env.web[0].name, env.web[0].ip); bWeb(cap, d.t + 0.001, env.web[0]); } },
      { id: 'rst', title: 'TCP RST: พอร์ตปิด', about: 'เมื่อส่ง SYN ไปพอร์ตที่ไม่มีโปรแกรมรอรับ เครื่องปลายทางตอบ RST, ACK ทันที (Connection refused) แปลว่าเครื่องปลายทางยังทำงานและติดต่อได้ แต่พอร์ตนั้นปิด',
        build(cap) { const env = cap.env, R = cap.R; const s = env.web[1]; const port = R.pick([8080, 8443, 3000, 81]); for (let k = 0; k < 2; k++) { const c = cap.conn(env.pc, s, eport(R), port); const t = k * 0.6; c.seg(t, 'c', 'S'); c.seg(t + rtt(R, s), 's', 'RA', { seq: 0 }); } } },
      { id: 'ping', title: 'ICMP Echo (ping) และ TTL', about: 'ping ส่ง ICMP Echo request (type 8) และได้ Echo reply (type 0) สังเกต TTL ของ reply จาก gateway (ในวง LAN) เทียบกับจากเครื่องในอินเทอร์เน็ต TTL ลดลง 1 ทุกครั้งที่ผ่าน router',
        build(cap) { const env = cap.env; bPing(cap, 0, env.gw, 2); bPing(cap, 2.2, env.web[0], 3); } },
      { id: 'unreach', title: 'ICMP Destination unreachable', about: 'เมื่อส่ง UDP ไปพอร์ตที่ปิด เครื่องปลายทางตอบ ICMP type 3 code 3 (Port unreachable) และ router/firewall อาจตอบ code 13 (administratively filtered) ภายในข้อความ ICMP มีส่วนหัวของแพ็กเก็ตต้นฉบับแนบมา',
        build(cap) { const env = cap.env, R = cap.R; const u = cap.udp(0, env.pc, env.printer, eport(R), 9999, { data: ascii('hello netlab') }); cap.unreach(0.0007, env.printer, env.pc, 3, u); const c = cap.conn(env.pc, env.web[2], eport(R), 23); const s = c.seg(1.2, 'c', 'S'); cap.unreach(1.2 + rtt(R, env.gw), env.gw, env.pc, 13, s); } },
      { id: 'udptcp', title: 'เปรียบเทียบ UDP กับ TCP', about: 'DNS และ NTP ใช้ UDP: ถาม 1 ครั้ง ตอบ 1 ครั้ง ไม่มีการจับมือ ส่วน HTTP ใช้ TCP: ต้อง SYN/SYN-ACK/ACK ก่อน มี Seq/Ack ยืนยันการรับ และต้องปิดการเชื่อมต่อ ลองกรอง udp กับ tcp แล้วเทียบจำนวนแพ็กเก็ตและขนาด header (UDP 8 ไบต์, TCP 20 ไบต์ขึ้นไป)',
        build(cap) { const env = cap.env, R = cap.R; const d = bDns(cap, 0, env.web[0].name, env.web[0].ip); cap.ntp(0.4, env.pc, env.dns2.ip === '1.1.1.1' ? { name: 'ntp', ip: '162.159.200.1', local: false, ttl: 64, hops: 9 } : { name: 'ntp', ip: '216.239.35.0', local: false, ttl: 64, hops: 10 }, eport(R)); bWeb(cap, d.t + 0.002, env.web[0]); } },
      { id: 'wf-dns', title: 'เปิดเว็บไม่ได้: DNS ล้มเหลว', about: 'DNS ตอบกลับว่า No such name (NXDOMAIN, rcode 3) จึงไม่รู้ IP ของเว็บ และไม่มี TCP SYN ถูกส่งออกไปเลย',
        build(cap) { webfail(cap, 'dns-nx'); } },
      { id: 'wf-rst', title: 'เปิดเว็บไม่ได้: พอร์ตปิด (RST)', about: 'DNS ได้ IP แล้ว แต่ SYN ทุกครั้งได้ RST, ACK กลับมา: เครื่องปลายทางติดต่อได้ แต่ไม่มีบริการเว็บที่พอร์ตนั้น',
        build(cap) { webfail(cap, 'closed'); } },
      { id: 'wf-drop', title: 'เปิดเว็บไม่ได้: Firewall ทิ้งแพ็กเก็ต', about: 'DNS ได้ IP แล้ว แต่ SYN ไม่ได้รับคำตอบเลย เครื่องจึงส่งซ้ำ (TCP Retransmission) โดยรอนานขึ้นเรื่อย ๆ อาการแบบนี้มักเกิดจาก firewall ที่ทิ้งแพ็กเก็ตเงียบ ๆ (drop)',
        build(cap) { webfail(cap, 'filtered'); } },
      { id: 'mixed', title: 'ทราฟฟิกผสม (ฝึกใช้ตัวกรอง)', about: 'มีทุกโปรโตคอลปนกัน: DHCP, ARP, DNS, TCP/HTTP, RST, ICMP, NTP ลองพิมพ์ตัวกรอง เช่น dns, tcp.flags.syn == 1, ip.addr == ... && !arp',
        build(cap) { mixed(cap); } }
    ];

    /* the "web fails" capture (variant: dns-nx | dns-timeout | closed | filtered | filtered-icmp). It only draws the
       frames: the expected conclusion and evidence frames are derived on the server (server/sims/packets-answers.js) */
    function webfail(cap, variant) {
      const env = cap.env, R = cap.R;
      const web = env.web[0];
      let t = 0;
      const a = bArp(cap, t, env.pc, env.gw);
      const ping = bPing(cap, a.t + 0.2, env.gw, 2);
      cap.ntp(0.9 + R.f() * 2, env.pc, { name: 'ntp', ip: R.pick(['162.159.200.1', '216.239.35.4']), local: false, ttl: 64, hops: R.int(7, 12) }, eport(R));
      t = ping.pk[1].t + 0.05;
      if (variant === 'dns-nx') {
        const d1 = bDns(cap, t, web.name, null, { rcode: 3 });
        const d2 = bDns(cap, d1.t + 0.01, web.name, null, { rcode: 3, qtype: 28 });
        bDns(cap, d2.t + 1.2, web.name, null, { rcode: 3, id: R.u16(), sport: eport(R) });
      } else if (variant === 'dns-timeout') {
        const sp = eport(R), id = R.u16();
        cap.dnsQ(t, env.pc, env.dns, sp, id, web.name);
        cap.dnsQ(t + 1.0, env.pc, env.dns, sp, id, web.name);
        cap.dnsQ(t + 2.0, env.pc, env.dns2, sp, id, web.name);
        cap.dnsQ(t + 4.0, env.pc, env.dns, sp, id, web.name);
      } else {
        const d = bDns(cap, t, web.name, web.ip);
        const port = 80;
        let tt = d.t + 0.002;
        for (let k = 0; k < 2; k++) {
          const c = cap.conn(env.pc, web, eport(R), port);
          if (variant === 'closed') {
            c.seg(tt, 'c', 'S'); c.seg(tt + rtt(R, web), 's', 'RA', { seq: 0 });
            c.seg(tt + 0.5, 'c', 'S', { retrans: true }); c.seg(tt + 0.5 + rtt(R, web), 's', 'RA', { seq: 0 });
          } else if (variant === 'filtered') {
            c.seg(tt, 'c', 'S');
            [1, 3, 7].forEach((dt) => c.seg(tt + dt + R.f() * 0.01, 'c', 'S', { retrans: true }));
          } else {
            const s1 = c.seg(tt, 'c', 'S'); cap.unreach(tt + rtt(R, env.gw), env.gw, env.pc, 13, s1);
            const s2 = c.seg(tt + 1, 'c', 'S', { retrans: true }); cap.unreach(tt + 1 + rtt(R, env.gw), env.gw, env.pc, 13, s2);
          }
          tt += 0.25 + R.f() * 0.05;
        }
      }
    }

    /* mixed traffic used by the filter challenge */
    function mixed(cap) {
      const env = cap.env, R = cap.R;
      const f = {};
      const d = bDora(cap, 0, env.pc, { hostname: env.pcName });
      f.dora = d;
      let t = d.t + 0.4;
      f.arp = bArp(cap, t, env.pc, env.gw);
      f.dns1 = bDns(cap, f.arp.t + 0.01, env.web[0].name, env.web[0].ip);
      f.web = bWeb(cap, f.dns1.t + 0.002, env.web[0]);
      f.ping = bPing(cap, f.dns1.t + 0.3, env.web[1], 2);
      f.ntp = cap.ntp(f.dns1.t + 0.15, env.pc, { name: 'ntp', ip: R.pick(['162.159.200.1', '216.239.35.4']), local: false, ttl: 64, hops: R.int(7, 12) }, eport(R));
      f.dns2 = bDns(cap, f.ping.t + 0.2, env.web[2].name, env.web[2].ip);
      f.rstPort = R.pick([8080, 8443, 3000]);
      const c = cap.conn(env.pc, env.web[2], eport(R), f.rstPort);
      f.syn2 = c.seg(f.dns2.t + 0.002, 'c', 'S'); f.rst = c.seg(f.syn2.t + rtt(R, env.web[2]), 's', 'RA', { seq: 0 });
      f.udpPort = R.pick([9999, 5000, 7000]);
      f.udp = cap.udp(f.rst.t + 0.4, env.pc, env.printer, eport(R), f.udpPort, { data: ascii('status?') });
      f.arpP = bArp(cap, f.udp.t - 0.001, env.pc, env.printer);
      f.unreach = cap.unreach(f.udp.t + 0.0006, env.printer, env.pc, 3, f.udp);
      f.otherArp = cap.arpReq(f.dns1.t + 0.08, env.other, env.gw.ip);
      return f;
    }

    /* ------------------------------------------------------------------ missions */
    const LAYER_OPTS = [
      { v: '2', t: 'ชั้น 2 Data Link (TCP/IP: Network Access)' },
      { v: '3', t: 'ชั้น 3 Network (TCP/IP: Internet)' },
      { v: '4', t: 'ชั้น 4 Transport' },
      { v: '7', t: 'ชั้น 7 Application' }
    ];
    const MISSION_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const GUIDE = {
      p1: ['กดปุ่ม "ไปที่ #..." ในโจทย์เพื่อเลือกแพ็กเก็ต แล้วดูแผงรายละเอียด (Packet Details) ใต้รายการ',
        'header แต่ละชั้นซ้อนกันจากนอกเข้าใน: Ethernet II → IPv4 → TCP/UDP → ข้อมูลของแอปพลิเคชัน กดหัวข้อเพื่อขยายดูฟิลด์',
        'MAC address อยู่ใน Ethernet II, IP address อยู่ใน IPv4, หมายเลขพอร์ตอยู่ใน TCP หรือ UDP',
        'สังเกตว่า MAC ปลายทางของแพ็กเก็ตที่ออกไปอินเทอร์เน็ตเป็นของ gateway ไม่ใช่ของเครื่องปลายทาง'],
      p2: ['พิมพ์ตัวกรอง tcp.flags.syn == 1 แล้วกด Apply เพื่อดูเฉพาะแพ็กเก็ตที่มีบิต SYN',
        'ดู DNS response ก่อนว่าชื่อเว็บในโจทย์มี IP อะไร แล้วเลือกเฉพาะการเชื่อมต่อไปยัง IP นั้น (เช่น ip.addr == IP นั้น && tcp)',
        'SYN = บิต SYN อย่างเดียว, SYN-ACK = SYN และ ACK, ACK = บิต ACK อย่างเดียว (Len=0) จากฝั่ง client',
        'ค่า raw อยู่ในบรรทัด "Sequence Number (raw)" และ "Acknowledgment number (raw)" ของ TCP',
        'ACK ที่ server จะตอบ = Seq (raw) ของแพ็กเก็ต GET + ความยาวข้อมูล (TCP Segment Len)']
    };

    function fieldsFor(mission, b) {
      const fr = (key, label) => ({ key, label, type: 'frame', ph: 'หมายเลขแพ็กเก็ต' });
      const tx = (key, label, ph, mode) => ({ key, label, type: 'text', ph, mode: mode || 'text' });
      const sel = (key, label, options) => ({ key, label, type: 'select', options });
      const L4 = [{ v: 'udp', t: 'UDP' }, { v: 'tcp', t: 'TCP' }];
      if (mission === 'p1') {
        const a = b.targets.a, bb = b.targets.b;
        return [
          sel('a_eth', `#${a}: Ethernet II header อยู่ชั้นใดของ OSI`, LAYER_OPTS), sel('a_ip', `#${a}: IPv4 header อยู่ชั้นใด`, LAYER_OPTS),
          sel('a_tcp', `#${a}: TCP header อยู่ชั้นใด`, LAYER_OPTS), sel('a_http', `#${a}: ข้อมูล HTTP อยู่ชั้นใด`, LAYER_OPTS),
          tx('a_smac', `#${a}: Source MAC address`, 'aa:bb:cc:dd:ee:ff'), tx('a_dip', `#${a}: Destination IP address`, 'x.x.x.x', 'decimal'),
          tx('a_dport', `#${a}: Destination port`, 'ตัวเลข', 'numeric'),
          sel('b_l4', `#${bb}: DNS query นี้ใช้ Transport protocol ใด`, L4), tx('b_sport', `#${bb}: Source port`, 'ตัวเลข', 'numeric'),
          tx('b_dmac', `#${bb}: Destination MAC address`, 'aa:bb:cc:dd:ee:ff')
        ];
      }
      if (mission === 'p2') return [fr('syn', 'แพ็กเก็ต SYN'), fr('synack', 'แพ็กเก็ต SYN-ACK'), fr('ack', 'แพ็กเก็ต ACK (ขั้นที่ 3)'),
        tx('cport', 'Client port (พอร์ตของ PC)', 'ตัวเลข', 'numeric'), tx('sport', 'Server port', 'ตัวเลข', 'numeric'),
        tx('ack3', 'Acknowledgment number (raw) ในแพ็กเก็ต ACK ขั้นที่ 3', 'ตัวเลข', 'numeric'),
        tx('nextack', 'ACK (raw) ที่ server ต้องตอบเมื่อได้รับ HTTP GET ครบ (คำนวณ)', 'ตัวเลข', 'numeric')];
      if (mission === 'p3') return [fr('q', 'แพ็กเก็ต DNS query ของชื่อนี้'), fr('r', 'แพ็กเก็ต DNS response ที่ตอบ query นี้'),
        tx('id', 'Transaction ID', '0x1234'), tx('addr', 'IP address ที่ได้ (record A)', 'x.x.x.x', 'decimal'),
        sel('l4', 'Transport protocol ที่ DNS ใช้ในครั้งนี้', L4), tx('port', 'พอร์ตของ DNS server', 'ตัวเลข', 'numeric')];
      if (mission === 'p4') return [fr('d', 'DHCP Discover'), fr('o', 'DHCP Offer'), fr('r', 'DHCP Request'), fr('a', 'DHCP ACK'),
        tx('yiaddr', 'IP address ที่ได้รับ (offered IP)', 'x.x.x.x', 'decimal'), tx('server', 'IP ของ DHCP server (Server Identifier)', 'x.x.x.x', 'decimal'),
        tx('lease', 'Lease time (วินาที)', 'ตัวเลข', 'numeric'), tx('xid', 'Transaction ID', '0x12345678')];
      if (mission === 'p5') return [sel('conclusion', 'สาเหตุที่เปิดเว็บไม่ได้', [
        { v: 'dns', t: 'DNS ล้มเหลว: แปลงชื่อเป็น IP ไม่ได้' },
        { v: 'closed', t: 'พอร์ตปิด: เครื่องปลายทางตอบ TCP RST' },
        { v: 'filtered', t: 'ถูกกรอง (Firewall): SYN ไม่ได้รับคำตอบ/ถูกส่งซ้ำ หรือได้ ICMP filtered' }]),
        { key: 'evidence', label: 'หลักฐาน: หมายเลขแพ็กเก็ตที่ยืนยันข้อสรุป (คั่นด้วย , )', type: 'frames', ph: 'เช่น 12, 15' }];
      if (mission === 'p6') return b.tasks.map((x, i) => ({ key: 'f' + i, label: x.text, type: 'filter', ph: 'display filter' }));
      return [];
    }

    const P6_TASKS = {
      dns: () => ({ text: 'แพ็กเก็ต DNS ทั้งหมด (ทั้ง query และ response)' }),
      icmp: () => ({ text: 'แพ็กเก็ต ICMP ทั้งหมด' }),
      rst: () => ({ text: 'แพ็กเก็ต TCP ที่ตั้งบิต RST (reset)' }),
      http: () => ({ text: 'แพ็กเก็ต HTTP ทั้งหมด (request และ response)' }),
      dhcp: () => ({ text: 'แพ็กเก็ต DHCP ทั้งหมด' }),
      synall: () => ({ text: 'แพ็กเก็ต TCP ทุกตัวที่ตั้งบิต SYN (รวม SYN-ACK)' }),
      synonly: () => ({ text: 'เฉพาะ TCP SYN ที่เริ่มการเชื่อมต่อ (บิต SYN = 1 แต่ไม่ใช่ SYN-ACK)' }),
      host: (env) => ({ text: `แพ็กเก็ต IPv4 ทั้งหมดที่ส่งจากหรือส่งถึง ${env.web[0].ip}`, ip: env.web[0].ip }),
      udpnodns: () => ({ text: 'แพ็กเก็ต UDP ทั้งหมดที่ไม่ใช่ DNS' }),
      notarp: () => ({ text: 'ทุกแพ็กเก็ต ยกเว้น ARP' }),
      tcpport: (env, f) => ({ text: `แพ็กเก็ตทั้งหมดของการเชื่อมต่อ TCP ที่ใช้พอร์ต ${f.webSport}`, port: f.webSport }),
      pcweb: (env) => ({ text: `แพ็กเก็ต TCP ที่ส่งจาก ${env.pc.ip} ไปยังพอร์ต 80 ของเซิร์ฟเวอร์`, ip: env.pc.ip }),
      echoreq: () => ({ text: 'เฉพาะ ICMP Echo request (ping ขาไป ไม่รวม reply)' }),
      frames: (env, f, R, n) => { const a = R.int(1, Math.floor(n / 2)), b = R.int(Math.floor(n / 2) + 1, n); return { text: `แพ็กเก็ตหมายเลข ${a} และ ${b} เท่านั้น`, a, b }; },
      todns: (env) => ({ text: `แพ็กเก็ต UDP ที่ส่งไปยัง DNS server ${env.dns.ip}`, ip: env.dns.ip })
    };

    function buildMission(problem) {
      if (!problem || typeof problem !== 'object' || problem.v !== 1 || !MISSION_IDS.includes(problem.mission) || typeof problem.seed !== 'string' || !/^[0-9a-f]{16}$/.test(problem.seed)) return null;
      const m = problem.mission;
      const R = makeR(m + ':' + problem.seed);
      const env = makeEnv(R, { publicDns: m === 'p1' });
      const cap = new Cap(R, env);
      // public data only: the frames, the story and what the task points at. No expected answer is computed here;
      // the server derives the answers from the regenerated capture (server/sims/packets-answers.js).
      const story = [], pub = {}, targets = {};
      let tasks = null, p6 = null;
      const env0 = env;
      if (m === 'p1') {
        const a = bArp(cap, 0, env.pc, env.gw);
        const d = bDns(cap, a.t + 0.01, env.web[0].name, env.web[0].ip);
        const w = bWeb(cap, d.t + 0.002, env.web[0]);
        if (R.chance(0.5)) bDns(cap, w.resp.t + 0.05, env.cdn[0].name, env.cdn[0].ip);
        targets.a = w.get; targets.b = d.q;
        story.push(`นักเรียนเปิดเว็บ http://${env.web[0].name}/ จากเครื่อง PC (${env.pc.ip}) แล้วบันทึกแพ็กเก็ตไว้ (capture จำลอง)`, '{a}', '{b}');
      } else if (m === 'p2') {
        const tgt = env.web[0], cdn = env.cdn[0];
        const port = R.chance(0.7) ? 80 : 8080;
        const a = bArp(cap, 0, env.pc, env.gw);
        const d1 = bDns(cap, a.t + 0.01, tgt.name, tgt.ip);
        const d2 = bDns(cap, a.t + 0.012, cdn.name, cdn.ip);
        const t0 = Math.max(d1.t, d2.t) + 0.001;
        const first = R.chance(0.5);
        const w2 = bWeb(cap, t0 + (first ? 0.0004 : 0), cdn, { port: 443, handshakeOnly: true });
        bWeb(cap, t0 + (first ? 0 : 0.0004), tgt, { port, stopAfterGet: true });
        void w2;
        pub.name = tgt.name;
        story.push(`เบราว์เซอร์บนเครื่อง PC (${env.pc.ip}) เปิด http://${tgt.name}${port === 80 ? '' : ':' + port}/ และพร้อมกันนั้นก็เชื่อมต่อไปยัง ${cdn.name} ด้วย capture หยุดทันทีหลังส่ง HTTP GET`,
          `หา 3-way handshake ของการเชื่อมต่อไปยัง ${tgt.name} เท่านั้น แล้วคำนวณค่า ACK`);
      } else if (m === 'p3') {
        const a = bArp(cap, 0, env.pc, env.gw);
        const names = [env.web[0], env.web[1], env.cdn[0]];
        let t = a.t + 0.01;
        const qs = R.shuffle(names).map((h, i) => {
          const sport = eport(R), id = R.u16();
          const qq = cap.dnsQ(t + i * 0.0015, env.pc, env.dns, sport, id, h.name);
          return { h, sport, id, q: qq };
        });
        const rs = R.shuffle(qs).map((x, i) => ({ x, r: cap.dnsR(t + 0.02 + rtt(R, env.dns) + i * 0.003, env.dns, env.pc, x.sport, x.id, x.h.name, [x.h.ip]) }));
        const tgt = R.pick(qs);
        const tr = rs.find((y) => y.x === tgt).r;
        const w = bWeb(cap, tr.t + 0.002, tgt.h, { handshakeOnly: true });
        pub.name = tgt.h.name;
        story.push(`เครื่อง PC (${env.pc.ip}) ถาม DNS หลายชื่อพร้อมกัน ภารกิจนี้สนใจเฉพาะชื่อ ${tgt.h.name}`, 'หา query และ response ของชื่อนี้ (ดูว่า Transaction ID ตรงกัน) IP ที่ได้ และ DNS ใช้ transport/พอร์ตใด');
        void w;
      } else if (m === 'p4') {
        const ip = env.pc.ip, oth = env.other;
        const lease = R.pick([3600, 7200, 28800, 86400, 691200]);
        const n1 = cap.arpReq(0, oth, env.gw.ip);
        const otherFirst = R.chance(0.5);
        const dmine = bDora(cap, otherFirst ? 0.35 : 0.1, env.pc, { hostname: env.pcName, lease });
        const doth = bDora(cap, otherFirst ? 0.2 : 0.25, oth, { lease: R.pick([3600, 86400]), bflag: true });
        cap.add(dmine.t + 0.25, { eth: { src: env.pc.mac, dst: BCAST, type: 0x0806 }, arp: { op: 1, sha: env.pc.mac, spa: '0.0.0.0', tha: '00:00:00:00:00:00', tpa: ip } });
        cap.add(dmine.t + 1.3, { eth: { src: env.pc.mac, dst: BCAST, type: 0x0806 }, arp: { op: 1, sha: env.pc.mac, spa: ip, tha: '00:00:00:00:00:00', tpa: ip } });
        bArp(cap, dmine.t + 1.5, env.pc, env.gw);
        void doth;
        story.push(`เปิดเครื่อง PC ที่มี MAC address ${env.pc.mac} (ชื่อ ${env.pcName}) แล้วเครื่องขอ IP ด้วย DHCP ในเวลาเดียวกันมีอีกเครื่องหนึ่ง (MAC ${oth.mac}) ขอ IP ด้วย`,
          `ตอบเฉพาะ DORA ของเครื่อง ${env.pc.mac} เท่านั้น`);
        void n1;
      } else if (m === 'p5') {
        const c = R.pick(['dns', 'closed', 'filtered']);
        const variant = c === 'dns' ? R.pick(['dns-nx', 'dns-timeout']) : c === 'filtered' ? R.pick(['filtered', 'filtered', 'filtered-icmp']) : 'closed';
        webfail(cap, variant);
        story.push(`ผู้ใช้เครื่อง PC (${env.pc.ip}) แจ้งว่า "เปิดเว็บ http://${env.web[0].name}/ ไม่ได้" ช่างจึงบันทึกแพ็กเก็ตขณะลองเปิดเว็บ (capture จำลอง)`,
          'วิเคราะห์ว่าปัญหาเกิดจาก DNS, พอร์ตปิด (RST) หรือถูก firewall กรอง แล้วอ้างหมายเลขแพ็กเก็ตที่เป็นหลักฐาน');
      } else if (m === 'p6') {
        const mx = mixed(cap);
        p6 = { webSport: mx.web.sport };   // task parameter shown in the task text (not an answer)
      }
      finalize(cap.pk);
      const b = { mission: m, capture: cap.pk, env: { pc: env0.pc.ip, pcMac: env0.pc.mac, gw: env0.gw.ip, dns: env0.dns.ip }, story, targets: {}, target: pub };
      if (m === 'p1') {
        b.targets = { a: targets.a.no, b: targets.b.no };
        b.story = [story[0], `แพ็กเก็ต #${b.targets.a} คือ HTTP GET: ระบุว่า header แต่ละชั้นอยู่ชั้นใดของ OSI และอ่านค่า MAC, IP, พอร์ต`, `แพ็กเก็ต #${b.targets.b} คือ DNS query ไปยัง DNS server ${env0.dns.ip}: อ่าน transport, source port และ destination MAC`];
      }
      if (m === 'p6') {
        const simple = R.shuffle(['dns', 'icmp', 'rst', 'http', 'dhcp', 'synall']).slice(0, 2);
        const combo = R.shuffle(['synonly', 'host', 'udpnodns', 'notarp', 'tcpport', 'pcweb', 'echoreq', 'frames', 'todns']).slice(0, 3);
        tasks = simple.concat(combo).map((kind) => Object.assign({ kind }, P6_TASKS[kind](env0, p6, R, cap.pk.length)));
        b.tasks = tasks;
        b.story = ['capture ผสมหลายโปรโตคอล (จำลอง) เขียน display filter ให้แสดง "เฉพาะ" แพ็กเก็ตที่โจทย์ต้องการ ไม่ขาดและไม่เกิน', 'ระบบตรวจโดยรันตัวกรองของนักเรียนกับ capture นี้ที่เซิร์ฟเวอร์ ตัวกรองที่เขียนต่างกันแต่ได้ผลเหมือนกันถือว่าถูก'];
      }
      b.fields = fieldsFor(m, b);
      b.guide = GUIDE[m] || null;
      return b;
    }

    function buildScenario(id, seed) {
      const sc = SCEN.find((x) => x.id === id);
      if (!sc) return null;
      const R = makeR('explore:' + id + ':' + seed);
      const env = makeEnv(R);
      const cap = new Cap(R, env);
      sc.build(cap);
      finalize(cap.pk);
      return { id, title: sc.title, about: sc.about, capture: cap.pk, env: { pc: env.pc.ip, gw: env.gw.ip, dns: env.dns.ip } };
    }

    return {
      version: 1, MISSION_IDS, LAYER_OPTS, GUIDE,
      SCENARIOS: SCEN.map((s) => ({ id: s.id, title: s.title, about: s.about })),
      makeR, buildMission, buildScenario, compileFilter, runFilter, tree, encapLayers, hexDump, followStream,
      ipToInt, intToIp, normMac, csum, FIELD_NAMES: Object.keys(FIELDS), PROTO_NAMES: Object.keys(PROTOS)
    };
  })();

  if (typeof module === 'object' && module && module.exports) module.exports = LIB;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.NL_PACKETS = LIB;
  /* =================================================================== browser UI */
  const CSS = `
.nls-packets{--pk-mono:"JetBrains Mono",Consolas,monospace;color:var(--ink);max-width:100%;min-width:0}
.nls-packets *{box-sizing:border-box}
.nls-packets button,.nls-packets input,.nls-packets select{font:inherit;color:inherit}
.nls-packets code{font-family:var(--pk-mono);font-size:.9em}
.nls-packets-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-bottom:10px}
.nls-packets-head h2{margin:0;font-size:1.3em;line-height:1.3;flex:1 1 240px}
.nls-packets-tabs{display:flex;gap:4px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:4px;flex:0 1 360px}
.nls-packets-tab{flex:1;border:0;background:transparent;border-radius:8px;padding:9px 10px;font-weight:600;color:var(--muted);cursor:pointer;min-height:44px}
.nls-packets-tab[aria-selected="true"]{background:var(--ink);color:var(--bg)}
.nls-packets-sim{margin:0 0 12px;padding:10px 14px;border:1px dashed var(--orange);border-radius:10px;background:var(--panel);font-size:.92em;line-height:1.55}
.nls-packets-sim b{color:var(--orange)}
.nls-packets-box{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:14px;min-width:0}
.nls-packets-help summary,.nls-packets-guide summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
.nls-packets-help ol,.nls-packets-guide ol{margin:6px 0 0;padding-left:22px;font-size:.93em}
.nls-packets-help li,.nls-packets-guide li{margin:3px 0}
.nls-packets-help p{font-size:.88em;color:var(--muted);margin:8px 0 0;overflow-wrap:anywhere}
.nls-packets-grid{display:grid;grid-template-columns:minmax(200px,250px) minmax(0,1fr);gap:14px;align-items:start}
.nls-packets-grid.solo{grid-template-columns:minmax(0,1fr)}
.nls-packets-main{min-width:0}
.nls-packets-wide{grid-column:1/-1;min-width:0}
.nls-packets-grid>.nls-packets-main>.nls-packets-box:last-child{margin-bottom:0}
.nls-packets-missions{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.nls-packets-mbtn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--line);border-radius:10px;padding:9px 12px;cursor:pointer;min-height:44px}
.nls-packets-mbtn[data-level="easy"]{border-left-color:var(--green)}
.nls-packets-mbtn[data-level="medium"]{border-left-color:var(--orange)}
.nls-packets-mbtn[data-level="hard"]{border-left-color:var(--bad)}
.nls-packets-mbtn[aria-current="true"]{outline:2px solid var(--blue);outline-offset:-1px;background:var(--field)}
.nls-packets-mbtn b{font-size:.95em;line-height:1.35}
.nls-packets-mstat{font-size:.8em;color:var(--muted)}
.nls-packets-mstat.full{color:var(--ok);font-weight:600}
.nls-packets-lv{display:inline-block;font-size:.75em;font-weight:700;border-radius:4px;padding:0 6px;border:1px solid currentColor;margin-right:6px;vertical-align:1px}
.nls-packets-lv.easy{color:var(--green)}.nls-packets-lv.medium{color:var(--orange)}.nls-packets-lv.hard{color:var(--bad)}
.nls-packets-mtitle{margin:0 0 4px;font-size:1.1em;line-height:1.4}
.nls-packets-desc{margin:0 0 10px;color:var(--muted);font-size:.93em}
.nls-packets-row2{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-packets-btn{background:var(--ink);color:var(--bg);border:0;border-radius:8px;padding:9px 16px;font-weight:600;cursor:pointer;min-height:44px;min-width:44px}
.nls-packets-btn.go{background:var(--green);color:var(--on-accent,#fff)}
.nls-packets-btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.nls-packets-btn.sm{padding:6px 12px;font-size:.9em}
.nls-packets-btn:disabled{opacity:.5;cursor:default}
.nls-packets button:focus-visible,.nls-packets input:focus-visible,.nls-packets select:focus-visible,.nls-packets summary:focus-visible,.nls-packets [tabindex]:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-packets-hints{margin:10px 0 0;padding-left:22px;font-size:.93em}
.nls-packets-hints li{margin:4px 0;background:var(--field);border-radius:6px;padding:4px 8px}
.nls-packets-guide{margin:10px 0 0;border:1px solid var(--line);border-radius:10px;padding:2px 12px 8px;background:var(--field)}
.nls-packets-story{background:var(--field);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:12px 0 0}
.nls-packets-story p{margin:4px 0;overflow-wrap:anywhere}
.nls-packets-jump{font-family:var(--pk-mono);font-weight:700;background:var(--panel);border:1px solid var(--blue);color:var(--blue);border-radius:8px;padding:2px 10px;cursor:pointer;min-height:44px;margin:0 2px}
.nls-packets-msg{margin:8px 0 0;font-size:.93em}
.nls-packets-msg.err{color:var(--bad);font-weight:600}
.nls-packets-empty{color:var(--muted);font-size:.93em;margin:8px 0}
.nls-packets-flab{display:block;font-weight:700;margin:0 0 6px}
.nls-packets-frow{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch}
.nls-packets-frow input{flex:1 1 220px;min-width:0;font-family:var(--pk-mono);font-size:15px;min-height:44px;border:2px solid var(--line);border-radius:8px;background:var(--field);padding:8px 10px}
.nls-packets-frow input.ok{border-color:var(--ok)}
.nls-packets-frow input.bad{border-color:var(--bad)}
.nls-packets-fmsg{margin:6px 0 0;font-size:.9em;min-height:1.5em;overflow-wrap:anywhere}
.nls-packets-fmsg.err{color:var(--bad);font-weight:600}
.nls-packets-fmsg.okm{color:var(--ok)}
.nls-packets-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
.nls-packets-chip{font-family:var(--pk-mono);font-size:.82em;border:1px solid var(--line);background:var(--field);border-radius:999px;padding:4px 12px;min-height:44px;cursor:pointer}
.nls-packets-chip:hover{border-color:var(--blue)}
.nls-packets-listwrap{border:1px solid var(--line);border-radius:10px;max-height:330px;overflow:auto;background:var(--panel);-webkit-overflow-scrolling:touch;overscroll-behavior:contain;max-width:100%}
.nls-packets-lhead,.nls-packets-row{display:grid;grid-template-columns:44px 82px 124px 124px 60px 52px minmax(300px,1fr);min-width:830px;column-gap:8px;padding:0 10px}
.nls-packets-lhead span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nls-packets-lhead{position:sticky;top:0;z-index:1;background:var(--field);border-bottom:1px solid var(--line);font-weight:700;font-size:.8em;padding-top:6px;padding-bottom:6px}
.nls-packets-list{outline:none}
.nls-packets-list:focus-visible{outline:3px solid var(--blue);outline-offset:-3px}
.nls-packets-row{font-family:var(--pk-mono);font-size:12.5px;line-height:1.3;align-items:center;min-height:30px;cursor:pointer;border-bottom:1px solid var(--line)}
.nls-packets-row span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nls-packets-row.p-tcp{background:color-mix(in srgb,var(--blue) 10%,transparent)}
.nls-packets-row.p-udp{background:color-mix(in srgb,var(--green) 10%,transparent)}
.nls-packets-row.p-arp{background:color-mix(in srgb,var(--orange) 12%,transparent)}
.nls-packets-row.p-icmp{background:color-mix(in srgb,var(--brown) 15%,transparent)}
.nls-packets-row.bad{color:var(--bad);font-weight:700;background:var(--panel);box-shadow:inset 4px 0 0 var(--bad)}
.nls-packets-row[aria-selected="true"]{background:var(--ink);color:var(--bg)}
.nls-packets-row:hover{box-shadow:inset 3px 0 0 var(--blue)}
.nls-packets-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.78em;color:var(--muted);margin:6px 0 0}
.nls-packets-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--line);vertical-align:-1px;margin-right:4px}
.nls-packets-legend i.t{background:color-mix(in srgb,var(--blue) 25%,transparent)}.nls-packets-legend i.u{background:color-mix(in srgb,var(--green) 25%,transparent)}
.nls-packets-legend i.a{background:color-mix(in srgb,var(--orange) 30%,transparent)}.nls-packets-legend i.c{background:color-mix(in srgb,var(--brown) 35%,transparent)}
.nls-packets-legend b{color:var(--bad)}
.nls-packets-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 0}
.nls-packets-self{font-size:.85em;color:var(--muted);overflow-wrap:anywhere;flex:1 1 200px}
.nls-packets-panes{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:12px;margin-top:12px}
.nls-packets-pane{min-width:0;border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--field)}
.nls-packets-pane h4{margin:2px 0 6px;font-size:.95em}
.nls-packets-tree>details{border-bottom:1px solid var(--line)}
.nls-packets-tree>details:last-child{border-bottom:0}
.nls-packets-tree summary{cursor:pointer;font-weight:600;padding:5px 4px;min-height:36px;font-size:.88em;overflow-wrap:anywhere;font-family:var(--pk-mono)}
.nls-packets-tree summary.sel{background:var(--panel);box-shadow:inset 3px 0 0 var(--orange)}
.nls-packets-tree ul{list-style:none;margin:0 0 6px;padding-left:16px;font-family:var(--pk-mono);font-size:12.5px;line-height:1.4}
.nls-packets-tree li{margin:0}
.nls-packets-tree li details>summary{font-weight:400;font-size:12.5px;min-height:28px;padding:3px 6px}
.nls-packets-fld{display:block;width:100%;text-align:left;background:none;border:0;padding:3px 6px;border-radius:6px;cursor:pointer;overflow-wrap:anywhere;font-family:var(--pk-mono);font-size:12.5px;min-height:28px}
.nls-packets-fld:hover{background:var(--panel)}
.nls-packets-fld code{font-size:.85em;color:var(--blue);margin-left:6px;white-space:nowrap}
.nls-packets-fld[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.nls-packets-fld[aria-pressed="true"] code{color:inherit}
.nls-packets-tx{display:block;padding:3px 6px;overflow-wrap:anywhere}
.nls-packets-wire{display:flex;gap:2px;margin:6px 0 10px;min-width:0}
.nls-packets-seg{min-width:0;flex:1 1 0;border-radius:4px;padding:4px 4px;font-size:.72em;font-weight:700;text-align:center;color:var(--on-accent,#fff);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nls-packets-seg.l2{background:var(--brown)}.nls-packets-seg.l3{background:var(--blue)}.nls-packets-seg.l4{background:var(--green)}.nls-packets-seg.l7{background:var(--orange)}
.nls-packets-enc{border:2px solid var(--c,var(--line));border-radius:10px;padding:4px 6px 6px;margin-top:6px;background:var(--panel)}
.nls-packets-enc.l2{--c:var(--brown)}.nls-packets-enc.l3{--c:var(--blue)}.nls-packets-enc.l4{--c:var(--green)}.nls-packets-enc.l7{--c:var(--orange)}
.nls-packets-enchd{display:block;width:100%;text-align:left;background:none;border:0;border-radius:6px;padding:4px 4px;cursor:pointer;min-height:44px;line-height:1.35}
.nls-packets-enchd b{color:var(--c)}
.nls-packets-enchd small{display:block;color:var(--muted);font-size:.8em}
.nls-packets-enchd .lay{display:inline-block;margin-top:2px;font-size:.78em;font-weight:700;border:1px solid var(--c);color:var(--c);border-radius:4px;padding:0 6px}
.nls-packets-enchd .lay.hidden{border-style:dashed;color:var(--muted);border-color:var(--muted)}
.nls-packets-fcs{font-size:.78em;color:var(--muted);margin:4px 2px 0}
.nls-packets-bytes{margin-top:12px}
.nls-packets-bytes summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
.nls-packets-hex{overflow-x:auto;max-width:100%;border:1px solid var(--line);border-radius:8px;background:var(--field)}
.nls-packets-hex pre{margin:0;padding:8px 10px;font-family:var(--pk-mono);font-size:12px;line-height:1.5}
.nls-packets-hex mark{background:var(--orange);color:var(--on-accent,#fff);border-radius:2px}
.nls-packets-follow{border:2px solid var(--blue);border-radius:10px;padding:10px 12px;margin-top:10px;background:var(--panel)}
.nls-packets-follow h4{margin:0;font-size:1em;flex:1 1 200px}
.nls-packets-follow p{margin:6px 0;font-size:.88em;overflow-wrap:anywhere}
.nls-packets-conv pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--pk-mono);font-size:12px;margin:0 0 6px;padding:6px 8px;border-radius:6px;border-left:4px solid var(--line);background:var(--field);max-height:260px;overflow:auto}
.nls-packets-conv pre.c{border-left-color:var(--blue)}.nls-packets-conv pre.s{border-left-color:var(--orange)}
.nls-packets-conv .who{font-size:.78em;font-weight:700;margin:6px 0 2px}
.nls-packets-conv .who.c{color:var(--blue)}.nls-packets-conv .who.s{color:var(--orange)}
.nls-packets-segl{font-family:var(--pk-mono);font-size:12px;margin:4px 0 0;padding-left:18px}
.nls-packets-ans h3{margin:0 0 8px;font-size:1.05em}
.nls-packets-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px 14px;margin:6px 0 12px}
.nls-packets-f{display:flex;flex-direction:column;gap:4px;min-width:0}
.nls-packets-f.wide{grid-column:1/-1}
.nls-packets-f>label{font-size:.88em;font-weight:600;overflow-wrap:anywhere}
.nls-packets-f input,.nls-packets-f select{width:100%;min-width:0;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:9px 10px;font-size:15px;min-height:44px}
.nls-packets-f input{font-family:var(--pk-mono)}
.nls-packets-f .nls-packets-frow input{width:auto}
.nls-packets-f.ok input,.nls-packets-f.ok select{border:2px solid var(--ok)}
.nls-packets-f.bad input,.nls-packets-f.bad select{border:2px solid var(--bad)}
.nls-packets-mark{font-size:.8em;font-weight:700}
.nls-packets-f.ok .nls-packets-mark{color:var(--ok)}.nls-packets-f.bad .nls-packets-mark{color:var(--bad)}
.nls-packets-tno{display:inline-block;background:var(--ink);color:var(--bg);border-radius:4px;padding:0 6px;margin-right:6px;font-size:.85em}
.nls-packets-result{border:2px solid var(--line);border-radius:12px;padding:12px 14px;margin:12px 0 0}
.nls-packets-result.full{border-color:var(--ok)}.nls-packets-result.part{border-color:var(--orange)}.nls-packets-result.zero{border-color:var(--bad)}
.nls-packets-score{font-size:1.5em;font-weight:800;margin:0}
.nls-packets-result ul{margin:6px 0 0;padding-left:20px;font-size:.93em}
.nls-packets-result li{margin:3px 0;overflow-wrap:anywhere}
.nls-packets-exrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-packets-exrow select{flex:1 1 240px;min-width:0;min-height:44px;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:15px}
.nls-packets-about{margin:10px 0 0;font-size:.93em;background:var(--field);border-radius:8px;padding:8px 12px}
.nls-packets-hide{display:none!important}
.nls-packets-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (pointer:coarse){.nls-packets-row{min-height:44px}.nls-packets-fld,.nls-packets-tree summary,.nls-packets-tree li details>summary{min-height:44px;display:flex;align-items:center}}
@media (max-width:1100px){.nls-packets-panes{grid-template-columns:minmax(0,1fr)}}
@media (max-width:760px){
  .nls-packets-grid{grid-template-columns:minmax(0,1fr)}
  .nls-packets-missions{flex-direction:row;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
  .nls-packets-missions li{flex:0 0 210px;scroll-snap-align:start}
  .nls-packets-mbtn{height:100%}
  .nls-packets-box{padding:12px}
  .nls-packets-listwrap{max-height:290px}
}
@media (max-width:600px){
  .nls-packets-chips{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}
  .nls-packets-chip{flex:0 0 auto}
  .nls-packets-lhead,.nls-packets-row{min-width:0;grid-template-columns:34px minmax(0,1fr) minmax(0,1fr) 50px;grid-template-areas:"n s d p" "n i i i";column-gap:6px;padding:0 8px}
  .nls-packets-row{padding-top:4px;padding-bottom:4px;min-height:44px}
  .nls-packets-lhead .c-i,.nls-packets-lhead .c-t,.nls-packets-lhead .c-l,.nls-packets-row .c-t,.nls-packets-row .c-l{display:none}
  .nls-packets-lhead{grid-template-areas:"n s d p"}
  .c-n{grid-area:n;align-self:start}.c-s{grid-area:s}.c-d{grid-area:d}.c-p{grid-area:p}
  .nls-packets-row .c-i{grid-area:i;white-space:normal;overflow-wrap:anywhere;font-size:12px}
  .nls-packets-fields{grid-template-columns:minmax(0,1fr)}
  .nls-packets-f input,.nls-packets-f select,.nls-packets-frow input{font-size:16px}
}`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const LV = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
  const rowClass = (p) => (p.arp ? 'p-arp' : p.icmp ? 'p-icmp' : p.tcp ? 'p-tcp' : p.udp ? 'p-udp' : '') +
    (((p.tcp && (p.tcp.flags.rst || p.tcp.retrans)) || (p.icmp && p.icmp.type === 3) || (p.dns && p.dns.qr && p.dns.rcode)) ? ' bad' : '');
  const LAYER_LABEL = { 2: 'ชั้น 2 Data Link', 3: 'ชั้น 3 Network', 4: 'ชั้น 4 Transport', 7: 'ชั้น 7 Application' };
  const FILTER_HELP = 'ฟิลด์ที่รองรับ: ip.addr, ip.src, ip.dst, ip.ttl, eth.addr, eth.src, eth.dst, tcp.port, tcp.srcport, tcp.dstport, tcp.stream, tcp.seq, tcp.ack, tcp.len, tcp.flags.syn, tcp.flags.ack, tcp.flags.fin, tcp.flags.reset, tcp.analysis.retransmission, udp.port, udp.srcport, udp.dstport, icmp.type, icmp.code, dns.id, dns.qry.name, dns.a, dns.flags.response, dns.flags.rcode, dhcp.id, dhcp.option.dhcp, http.request, http.response, http.request.method, http.host, frame.number, frame.len และชื่อโปรโตคอล arp, ip, tcp, udp, icmp, dns, dhcp (bootp), http, ntp · ตัวดำเนินการ ==, !=, >, <, >=, <=, contains, in {..}, && (and), || (or), ! (not) และวงเล็บ';
  let UID = 0;

  window.NL_SIMS = window.NL_SIMS || {};
  window.NL_SIMS.packets = {
    title: 'ห้องวิเคราะห์แพ็กเก็ต (Packet Analysis)',
    mount(root, ctx) {
      ctx = ctx || {};
      if (!document.getElementById('nls-packets-css')) {
        const st = document.createElement('style'); st.id = 'nls-packets-css'; st.textContent = CSS; document.head.appendChild(st);
      }
      const missions = Array.isArray(ctx.missions) ? ctx.missions : [];
      const done = Object.assign({}, ctx.done || {});
      // 3.3 embedded mode (practical page): only the given mission, no mission list, no free exploration tab
      const EMB = !!ctx.embedded && missions.length > 0;
      const EMB_ID = EMB ? (missions.some((m) => m.id === ctx.initial) ? ctx.initial : missions[0].id) : null;
      const uid = 'nlspk' + (++UID);
      const state = { tab: 'missions', cur: null, work: {}, ex: null, alive: true };
      const toast = (t) => { try { if (typeof ctx.toast === 'function') ctx.toast(t); } catch (e) { /* ignore */ } };
      const newView = () => ({ filter: '', applied: '', visible: null, sel: null, field: null, layer: null, follow: null, prevFilter: '', open: { frame: false, eth: true, arp: true, ip: true, tcp: true, udp: true, icmp: true, app: true }, sub: {} });

      const el = document.createElement('div');
      el.className = 'nls-packets' + (EMB ? ' nls-embedded' : '');
      el.innerHTML = `
<div class="nls-packets-head"><h2>ห้องวิเคราะห์แพ็กเก็ต (Packet Analysis)</h2>
  ${EMB ? '' : `<div class="nls-packets-tabs" role="tablist" aria-label="โหมด">
    <button type="button" class="nls-packets-tab" role="tab" id="${uid}-t1" data-tab="missions" aria-selected="true" aria-controls="${uid}-grid">ภารกิจ</button>
    <button type="button" class="nls-packets-tab" role="tab" id="${uid}-t2" data-tab="explore" aria-selected="false" aria-controls="${uid}-grid">สำรวจอิสระ</button>
  </div>`}</div>
<p class="nls-packets-sim" role="note"><b>Capture จำลอง:</b> แพ็กเก็ตทุกตัวในห้องนี้สร้างขึ้นโดยโปรแกรมจำลองของ NetLab (simulated capture) ไม่ได้ดักจับข้อมูลจริงจากเครือข่ายใด ๆ หมายเลข IP, MAC, พอร์ต และ Seq สุ่มใหม่สำหรับแต่ละโจทย์</p>
<details class="nls-packets-box nls-packets-help"><summary>วิธีใช้ห้องวิเคราะห์แพ็กเก็ต</summary><ol>
  <li>${EMB ? 'ภารกิจนี้' : 'เลือกภารกิจ'} ระบบสร้าง capture ให้แต่ละคนไม่ซ้ำกัน (กด <b>โจทย์ใหม่</b> เพื่อสุ่มใหม่)</li>
  <li><b>รายการแพ็กเก็ต</b>: คลิกแถว หรือคลิกในรายการแล้วกดลูกศรขึ้น/ลง (Home/End) เพื่อเลือกแพ็กเก็ต บนมือถือเลื่อนตารางไปทางขวาเพื่อดูคอลัมน์ Info</li>
  <li><b>รายละเอียด (Packet Details)</b>: header แต่ละชั้นพับ/ขยายได้ ฟิลด์ที่มีชื่อฟิลด์ (เช่น <code>ip.src</code>) คลิกเลือกแล้วกด <b>ใช้เป็นตัวกรอง</b> ได้</li>
  <li><b>Display filter</b>: พิมพ์ เช่น <code>dns</code>, <code>ip.addr == 192.168.1.10</code>, <code>tcp.flags.syn == 1 &amp;&amp; tcp.flags.ack == 0</code>, <code>udp &amp;&amp; !dns</code> แล้วกด Enter หรือ Apply ช่องเป็นสีเขียว = ถูกรูปแบบ สีแดง = ผิดรูปแบบ</li>
  <li><b>Follow TCP Stream</b>: เลือกแพ็กเก็ต TCP แล้วกดเพื่อดูข้อมูลที่ client กับ server คุยกันทั้งการเชื่อมต่อ</li>
  <li><b>Encapsulation</b>: แผนภาพแสดงว่า header ใดอยู่ชั้นใดของ OSI / TCP/IP (ภารกิจ Encapsulation จะแสดงชั้นหลังตรวจคำตอบ)</li>
  ${EMB ? '' : '<li>แท็บ <b>สำรวจอิสระ</b> มี capture ตัวอย่าง: ARP, DHCP, DNS, TCP/HTTP, RST, ICMP, UDP เทียบ TCP และกรณีเปิดเว็บไม่ได้ (ไม่นับคะแนน)</li>'}</ol>
  <p>${esc(FILTER_HELP)}</p></details>
<div class="nls-packets-grid${EMB ? ' solo' : ''}" id="${uid}-grid" data-el="grid">
  ${EMB ? '' : '<nav class="nls-packets-nav" aria-label="รายการภารกิจ" data-pane="missions"><ul class="nls-packets-missions" data-el="mlist"></ul></nav>'}
  <div class="nls-packets-main">
    <section class="nls-packets-box" data-pane="missions" data-el="work" aria-label="โจทย์"></section>
    ${EMB ? '' : '<section class="nls-packets-box nls-packets-hide" data-pane="explore" data-el="explore" aria-label="สำรวจอิสระ"></section>'}
  </div>
  <div class="nls-packets-wide">
    <section class="nls-packets-box nls-packets-an nls-packets-hide" data-el="an" aria-label="ตัววิเคราะห์แพ็กเก็ต">
      <form class="nls-packets-fbar" data-el="fform" role="search" novalidate>
        <label for="${uid}-f" class="nls-packets-flab">Display filter</label>
        <div class="nls-packets-frow"><input id="${uid}-f" data-el="finput" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" enterkeyhint="search" placeholder="เช่น dns หรือ ip.addr == 192.168.1.10 && tcp" aria-describedby="${uid}-fmsg">
          <button type="submit" class="nls-packets-btn go">Apply</button><button type="button" class="nls-packets-btn ghost" data-act="fclear">ล้างตัวกรอง</button></div>
        <p id="${uid}-fmsg" class="nls-packets-fmsg" data-el="fmsg" aria-live="polite"></p>
      </form>
      <div class="nls-packets-chips" data-el="chips" role="group" aria-label="ตัวอย่างตัวกรอง (กดเพื่อใช้)"></div>
      <div class="nls-packets-listwrap" data-el="lwrap">
        <div class="nls-packets-lhead" aria-hidden="true"><span class="c-n">No.</span><span class="c-t">Time</span><span class="c-s">Source</span><span class="c-d">Destination</span><span class="c-p">Protocol</span><span class="c-l">Length</span><span class="c-i">Info</span></div>
        <div class="nls-packets-list" data-el="list" role="listbox" tabindex="0" aria-label="รายการแพ็กเก็ต: ใช้ลูกศรขึ้น/ลงเพื่อเลือก"></div>
      </div>
      <p class="nls-packets-legend" aria-hidden="true"><span><i class="t"></i>TCP</span><span><i class="u"></i>UDP</span><span><i class="a"></i>ARP</span><span><i class="c"></i>ICMP</span><span><b>ตัวหนาสีแดง มีแถบแดงซ้าย</b> = RST, ส่งซ้ำ, ICMP unreachable, DNS error</span></p>
      <div class="nls-packets-tools" data-el="tools"></div>
      <div data-el="follow"></div>
      <div class="nls-packets-panes"><div class="nls-packets-pane" data-el="tree"></div><div class="nls-packets-pane" data-el="encap"></div></div>
      <details class="nls-packets-bytes" data-el="bytesd"><summary>ไบต์ดิบ (Hex dump) ของแพ็กเก็ตที่เลือก</summary><div data-el="bytes"></div></details>
    </section>
    <section class="nls-packets-box nls-packets-ans nls-packets-hide" data-pane="missions" data-el="ans" aria-label="คำตอบ"></section>
  </div>
</div>`;
      root.appendChild(el);
      const $ = (s) => el.querySelector(s);
      const W = (id) => state.work[id] || (state.work[id] = { problem: null, token: null, built: null, answers: {}, result: null, busy: false, err: '', hints: 0, view: newView() });

      /* ---------------- missions */
      function statusText(id) {
        const d = done[id]; const m = missions.find((x) => x.id === id);
        if (!d || (!d.attempts && d.best == null)) return { t: 'ยังไม่ทำ', full: false };
        const max = d.max || (m && m.max) || 10;
        return { t: `คะแนนดีที่สุด ${d.best || 0}/${max}`, full: (d.best || 0) >= max };
      }
      function renderMissions() {
        if (EMB) return;   // embedded: no mission list
        $('[data-el="mlist"]').innerHTML = missions.map((m) => {
          const st = statusText(m.id);
          return `<li><button type="button" class="nls-packets-mbtn" data-mission="${esc(m.id)}" data-level="${esc(m.level)}" aria-current="${m.id === state.cur}">` +
            `<b><span class="nls-packets-lv ${esc(m.level)}">${LV[m.level] || esc(m.level)}</span>${esc(m.title)}</b><span class="nls-packets-mstat${st.full ? ' full' : ''}">${esc(st.t)}</span></button></li>`;
        }).join('') || '<li class="nls-packets-empty">ไม่มีภารกิจ</li>';
      }
      const storyHtml = (t) => esc(t).replace(/#(\d{1,4})/g, (m0, n) => `<button type="button" class="nls-packets-jump" data-jump="${n}" aria-label="ไปที่แพ็กเก็ตหมายเลข ${n}">#${n}</button>`);
      function renderWork() {
        const box = $('[data-el="work"]');
        const m = missions.find((x) => x.id === state.cur);
        if (!m) { box.innerHTML = '<p class="nls-packets-empty">เลือกภารกิจ</p>'; return; }
        const w = W(m.id), hints = Array.isArray(m.hints) ? m.hints : [];
        let h = `<h3 class="nls-packets-mtitle"><span class="nls-packets-lv ${esc(m.level)}">${LV[m.level] || ''}</span>${esc(m.title)}</h3><p class="nls-packets-desc">${esc(m.desc)}</p>`;
        h += '<div class="nls-packets-row2">' +
          `<button type="button" class="nls-packets-btn${w.built ? ' ghost' : ' go'}" data-act="new"${w.busy ? ' disabled' : ''}>${w.busy && !w.built ? 'กำลังสร้าง capture…' : 'โจทย์ใหม่'}</button>` +
          (hints.length ? `<button type="button" class="nls-packets-btn ghost" data-act="hint"${w.hints >= hints.length ? ' disabled' : ''}>คำใบ้ (${w.hints}/${hints.length})</button>` : '') + '</div>';
        if (w.hints) h += '<ol class="nls-packets-hints">' + hints.slice(0, w.hints).map((t) => `<li>${esc(t)}</li>`).join('') + '</ol>';
        if (w.err) h += `<p class="nls-packets-msg err" role="alert">${esc(w.err)}</p>`;
        if (!w.built) h += `<p class="nls-packets-empty">${w.busy ? 'กำลังขอโจทย์จากเซิร์ฟเวอร์…' : 'กด <b>โจทย์ใหม่</b> เพื่อรับ capture ของคุณ'}</p>`;
        else {
          if (w.built.guide) h += `<details class="nls-packets-guide" open><summary>ขั้นตอนแนะนำ (Guided)</summary><ol>${w.built.guide.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></details>`;
          h += '<div class="nls-packets-story">' + w.built.story.map((t) => `<p>${storyHtml(t)}</p>`).join('') + `<p class="nls-packets-desc" style="margin:6px 0 0">capture นี้มี ${w.built.capture.length} แพ็กเก็ต · เครื่อง PC: ${esc(w.built.env.pc)}${w.built.mission === 'p4' ? ' (ก่อนได้ IP ยังไม่มี)' : ''}</p></div>`;
        }
        box.innerHTML = h;
      }
      function selectMission(id) {
        if (!missions.some((m) => m.id === id)) return;
        if (EMB && id !== EMB_ID) return;
        state.cur = id;
        renderMissions(); renderWork(); renderAnalyzer(); renderAnswers();
        const w = W(id);
        if (!w.built && !w.busy) newProblem();
      }
      async function newProblem() {
        const id = state.cur, w = W(id);
        if (w.busy) return;
        if (typeof ctx.newProblem !== 'function') { w.err = 'ไม่สามารถขอโจทย์ได้ในขณะนี้'; renderWork(); return; }
        w.busy = true; w.err = ''; renderWork();
        try {
          const res = await ctx.newProblem(id);
          if (!state.alive) return;
          const built = res && res.problem ? LIB.buildMission(res.problem) : null;
          if (!built) throw new Error('ได้รับโจทย์ที่ไม่ถูกต้อง');
          Object.assign(w, { problem: res.problem, token: res.token, built, result: null, answers: {}, view: newView() });
          w.view.sel = 1;
        } catch (e) { w.err = 'ขอโจทย์ไม่สำเร็จ: ' + ((e && e.message) || 'ลองใหม่อีกครั้ง'); }
        w.busy = false;
        if (!state.alive || state.cur !== id) return;
        renderWork(); renderAnalyzer(); renderAnswers();
      }

      /* ---------------- explore */
      const rseed = () => { let s = ''; for (let i = 0; i < 16; i++) s += Math.floor(Math.random() * 16).toString(16); return s; };
      function exploreLoad(scen) {
        const built = LIB.buildScenario(scen, rseed());
        state.ex = { scen, built, view: newView() };
        state.ex.view.sel = 1;
      }
      function renderExplore() {
        const box = $('[data-el="explore"]');
        if (!state.ex) exploreLoad('tcp');
        const x = state.ex;
        box.innerHTML = `<h3 class="nls-packets-mtitle">สำรวจอิสระ (ไม่นับคะแนน)</h3>
<div class="nls-packets-exrow"><label for="${uid}-sc" class="nls-packets-sr">สถานการณ์</label><select id="${uid}-sc" data-el="scen">${LIB.SCENARIOS.map((s) => `<option value="${esc(s.id)}"${s.id === x.scen ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select>
<button type="button" class="nls-packets-btn ghost" data-act="exnew">สุ่ม capture ใหม่</button></div>
<p class="nls-packets-about">${esc(x.built.about)}</p>`;
      }

      /* ---------------- analyzer */
      function A() {
        if (state.tab === 'explore') return state.ex;
        const w = state.cur ? W(state.cur) : null;
        return w && w.built ? w : null;
      }
      const capOf = (a) => a.built.capture;
      const pkt = (a, no) => capOf(a)[no - 1] || null;
      function applyFilter(a, text) {
        const r = LIB.runFilter(capOf(a), text);
        if (!r.ok) return r;
        a.view.filter = text; a.view.applied = r.empty ? '' : text.trim(); a.view.visible = r.set;
        return r;
      }
      function renderAnalyzer() {
        const an = $('[data-el="an"]'), a = A();
        if (!a) { an.classList.add('nls-packets-hide'); return; }
        an.classList.remove('nls-packets-hide');
        const inp = $('[data-el="finput"]');
        inp.value = a.view.filter;
        if (!a.view.visible) a.view.visible = capOf(a).map((p) => p.no);
        liveCheck();
        renderChips(a); renderList(a); renderTools(a); renderFollow(a); renderDetail(a);
      }
      function statusMsg(a, extra) {
        const m = $('[data-el="fmsg"]');
        m.className = 'nls-packets-fmsg' + (extra && extra.err ? ' err' : '');
        if (extra && extra.err) { m.setAttribute('role', 'alert'); m.textContent = 'ตัวกรองผิดรูปแบบ: ' + extra.err; return; }
        m.removeAttribute('role');
        const n = a.view.visible.length, tot = capOf(a).length;
        m.textContent = `แสดง ${n} จาก ${tot} แพ็กเก็ต` + (a.view.applied ? ` · ตัวกรอง: ${a.view.applied}` : ' (ยังไม่ได้กรอง)');
      }
      function liveCheck() {
        const inp = $('[data-el="finput"]');
        const v = inp.value;
        inp.classList.remove('ok', 'bad');
        if (!v.trim()) return null;
        const c = LIB.compileFilter(v);
        inp.classList.add(c.ok ? 'ok' : 'bad');
        inp.setAttribute('aria-invalid', c.ok ? 'false' : 'true');
        return c;
      }
      function renderChips(a) {
        const env = a.built.env;
        const ex = ['tcp', 'udp', 'arp', 'icmp', 'dns', 'dhcp', 'http', 'tcp.flags.syn == 1', 'tcp.flags.reset == 1', 'tcp.analysis.retransmission', `ip.addr == ${env.pc}`, '!arp'];
        $('[data-el="chips"]').innerHTML = ex.map((f) => `<button type="button" class="nls-packets-chip" data-chip="${esc(f)}">${esc(f)}</button>`).join('');
      }
      function rowHtml(p, sel) {
        const label = `แพ็กเก็ต ${p.no}, ${p.proto}, จาก ${p.src} ถึง ${p.dst}, ${p.len} ไบต์, ${p.info}`;
        return `<div class="nls-packets-row ${rowClass(p)}" role="option" id="${uid}-r${p.no}" data-no="${p.no}" aria-selected="${p.no === sel}" aria-label="${esc(label)}" title="${esc(p.info)}">` +
          `<span class="c-n">${p.no}</span><span class="c-t">${p.t.toFixed(6)}</span><span class="c-s">${esc(p.src)}</span><span class="c-d">${esc(p.dst)}</span><span class="c-p">${esc(p.proto)}</span><span class="c-l">${p.len}</span><span class="c-i">${esc(p.info)}</span></div>`;
      }
      function renderList(a) {
        const list = $('[data-el="list"]');
        const vis = new Set(a.view.visible);
        const rows = capOf(a).filter((p) => vis.has(p.no));
        list.innerHTML = rows.length ? rows.map((p) => rowHtml(p, a.view.sel)).join('') : '<p class="nls-packets-empty" style="padding:8px 12px">ไม่มีแพ็กเก็ตที่ตรงกับตัวกรอง</p>';
        if (a.view.sel && vis.has(a.view.sel)) list.setAttribute('aria-activedescendant', `${uid}-r${a.view.sel}`); else list.removeAttribute('aria-activedescendant');
        statusMsg(a);
      }
      function scrollRow(no) {
        const r = el.querySelector(`#${uid}-r${no}`), wrap = $('[data-el="lwrap"]');
        if (!r || !wrap) return;
        const top = r.offsetTop, hd = 30;
        if (top - hd < wrap.scrollTop) wrap.scrollTop = Math.max(0, top - hd - 4);
        else if (top + r.offsetHeight > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = top + r.offsetHeight - wrap.clientHeight + 4;
      }
      function select(no, opt) {
        const a = A(); if (!a || !pkt(a, no)) return;
        const prev = a.view.sel;
        a.view.sel = no; a.view.field = null; a.view.layer = null;
        const list = $('[data-el="list"]');
        if (prev) { const r = el.querySelector(`#${uid}-r${prev}`); if (r) r.setAttribute('aria-selected', 'false'); }
        const r = el.querySelector(`#${uid}-r${no}`);
        if (r) { r.setAttribute('aria-selected', 'true'); list.setAttribute('aria-activedescendant', r.id); scrollRow(no); }
        renderTools(a); renderDetail(a); updateUseSel();
        if (opt && opt.focus) list.focus({ preventScroll: true });
      }
      function jump(no) {
        const a = A(); if (!a || !pkt(a, no)) return;
        if (!a.view.visible.includes(no)) { applyFilter(a, ''); a.view.follow = null; renderAnalyzer(); }
        select(no, { focus: true });
        const wrap = $('[data-el="lwrap"]');
        if (wrap && wrap.scrollIntoView) wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      function renderTools(a) {
        const p = a.view.sel ? pkt(a, a.view.sel) : null;
        const f = a.view.field;
        const expr = f ? (f.v != null && f.v !== '' ? `${f.f} == ${f.v}` : f.f) : '';
        const isP5 = state.tab === 'missions' && state.cur === 'p5' && !(W('p5').result);
        $('[data-el="tools"]').innerHTML =
          `<button type="button" class="nls-packets-btn ghost sm" data-act="follow"${p && p.tcp ? '' : ' disabled'}>Follow TCP Stream</button>` +
          `<button type="button" class="nls-packets-btn ghost sm" data-act="usefield"${f ? '' : ' disabled'}>ใช้ฟิลด์ที่เลือกเป็นตัวกรอง</button>` +
          (isP5 ? `<button type="button" class="nls-packets-btn sm" data-act="addev"${p ? '' : ' disabled'}>เพิ่ม #${p ? p.no : ''} เป็นหลักฐาน</button>` : '') +
          `<span class="nls-packets-self">${f ? 'ฟิลด์ที่เลือก: <code>' + esc(expr) + '</code>' : p ? 'คลิกฟิลด์ที่มีชื่อฟิลด์ในแผงรายละเอียดเพื่อสร้างตัวกรอง' : 'ยังไม่ได้เลือกแพ็กเก็ต'}</span>`;
      }
      function fieldHtml(f, lkey, a, path) {
        if (f.k) {
          const k = lkey + ':' + path;
          const open = !!a.view.sub[k];
          return `<li><details data-sub="${esc(k)}"${open ? ' open' : ''}><summary>${esc(f.l)}</summary><ul>${f.k.map((c, i) => fieldHtml(c, lkey, a, path + '.' + i)).join('')}</ul></details></li>`;
        }
        if (!f.f) return `<li><span class="nls-packets-tx">${esc(f.l)}</span></li>`;
        const pressed = a.view.field && a.view.field.f === f.f && a.view.field.v === (f.v == null ? '' : f.v) && a.view.field.path === lkey + ':' + path;
        return `<li><button type="button" class="nls-packets-fld" data-fld="${esc(f.f)}" data-val="${esc(f.v == null ? '' : f.v)}" data-layer="${lkey}" data-path="${esc(lkey + ':' + path)}" aria-pressed="${!!pressed}">${esc(f.l)}<code>${esc(f.f)}</code></button></li>`;
      }
      function hideLayers() { return state.tab === 'missions' && state.cur === 'p1' && !W('p1').result; }
      function renderDetail(a) {
        const p = a.view.sel ? pkt(a, a.view.sel) : null;
        const tree = $('[data-el="tree"]'), enc = $('[data-el="encap"]'), bytes = $('[data-el="bytes"]');
        if (!p) { tree.innerHTML = '<p class="nls-packets-empty">เลือกแพ็กเก็ตจากรายการเพื่อดูรายละเอียด</p>'; enc.innerHTML = ''; bytes.innerHTML = ''; return; }
        const T = LIB.tree(p);
        tree.innerHTML = `<h4>รายละเอียดแพ็กเก็ต #${p.no} (Packet Details)</h4><div class="nls-packets-tree">` + T.map((L) =>
          `<details data-layer="${L.key}"${a.view.open[L.key] ? ' open' : ''}><summary${a.view.layer === L.key ? ' class="sel"' : ''}>${esc(L.title)}</summary><ul>${L.fields.map((f, i) => fieldHtml(f, L.key, a, String(i))).join('')}</ul></details>`).join('') + '</div>';
        const E = LIB.encapLayers(p), hide = hideLayers();
        let inner = '';
        for (let i = E.length - 1; i >= 0; i--) {
          const x = E[i];
          const lay = hide ? '<span class="lay hidden">ชั้น ? (ตอบในแบบฟอร์มด้านล่าง)</span>' : `<span class="lay">${esc(x.osi === 2 && x.key === 'arp' ? 'ชั้น 2–3 (ARP)' : LAYER_LABEL[x.osi])} · TCP/IP: ${esc(x.tcpip)}</span>`;
          inner = `<div class="nls-packets-enc l${x.osi}"><button type="button" class="nls-packets-enchd" data-enc="${x.key}"><b>${esc(x.name)} ${x.key === 'app' ? 'data' : 'header'}</b> · ${x.bytes} ไบต์<small>หน่วยข้อมูล: ${esc(x.unit)}</small>${lay}</button>${inner}</div>`;
        }
        const total = E.reduce((s, x) => s + x.bytes, 0) || 1;
        enc.innerHTML = `<h4>Encapsulation ของแพ็กเก็ต #${p.no}</h4><p class="nls-packets-desc" style="margin:0">ลำดับไบต์บนสาย (ซ้าย = ส่งก่อน):</p><div class="nls-packets-wire" aria-hidden="true">` +
          E.map((x) => `<span class="nls-packets-seg l${x.osi}" style="flex-grow:${Math.max(6, Math.round(x.bytes / total * 100))}" title="${esc(x.name)} ${x.bytes} B">${esc(x.name)}</span>`).join('') + '</div>' +
          `<p class="nls-packets-desc" style="margin:0">header ชั้นล่างห่อชั้นบนไว้ข้างใน:</p>${inner}<p class="nls-packets-fcs">Ethernet ยังมี FCS 4 ไบต์ท้ายเฟรม ซึ่งการ์ดแลนตัดออกก่อนถึงโปรแกรม capture${p.padLen ? ` · padding ${p.padLen} ไบต์ทำให้เฟรมยาวครบ 60 ไบต์` : ''}</p>`;
        renderBytes(a, p);
      }
      function renderBytes(a, p) {
        const box = $('[data-el="bytes"]');
        const rng = a.view.layer && p.ranges[a.view.layer] ? p.ranges[a.view.layer] : null;
        const lines = LIB.hexDump(p.bytes).map((ln) => {
          const hx = [], as = [];
          ln.bytes.forEach((b, j) => {
            const i = ln.off + j, on = rng && i >= rng[0] && i < rng[1];
            const h = b.toString(16).padStart(2, '0'), c = b >= 32 && b < 127 ? esc(String.fromCharCode(b)) : '.';
            hx.push(on ? `<mark>${h}</mark>` : h); as.push(on ? `<mark>${c}</mark>` : c);
          });
          while (hx.length < 16) { hx.push('  '); }
          return ln.off.toString(16).padStart(4, '0') + '  ' + hx.slice(0, 8).join(' ') + '  ' + hx.slice(8).join(' ') + '  ' + as.join('');
        });
        box.innerHTML = `<p class="nls-packets-desc" style="margin:6px 0">${rng ? `ส่วนที่ไฮไลต์ = ${esc(a.view.layer === 'app' ? 'ข้อมูลแอปพลิเคชัน' : a.view.layer.toUpperCase() + ' header')} (ไบต์ที่ ${rng[0]}–${rng[1] - 1})` : 'คลิกหัวข้อหรือฟิลด์ในรายละเอียด / กล่อง encapsulation เพื่อไฮไลต์ไบต์ของชั้นนั้น'}</p><div class="nls-packets-hex" tabindex="0" role="region" aria-label="ไบต์ดิบของแพ็กเก็ต #${p.no}"><pre>${lines.join('\n')}</pre></div>`;
      }
      function renderFollow(a) {
        const box = $('[data-el="follow"]');
        if (a.view.follow == null) { box.innerHTML = ''; return; }
        const fs = LIB.followStream(capOf(a), a.view.follow);
        if (!fs) { box.innerHTML = ''; return; }
        let conv = '';
        if (fs.parts.length) conv = fs.parts.map((x) => `<p class="who ${x.dir}">${x.dir === 'c' ? 'Client' : 'Server'} (#${x.frame})</p><pre class="${x.dir}" tabindex="0" aria-label="ข้อมูลที่ ${x.dir === 'c' ? 'client' : 'server'} ส่ง (แพ็กเก็ต #${x.frame})">${esc(x.text)}</pre>`).join('');
        else conv = '<p>การเชื่อมต่อนี้ไม่มีข้อมูลของแอปพลิเคชัน มีแต่แพ็กเก็ตควบคุม:</p>';
        box.innerHTML = `<section class="nls-packets-follow" aria-label="Follow TCP Stream"><div class="nls-packets-row2"><h4>Follow TCP Stream (tcp.stream eq ${fs.idx})</h4><button type="button" class="nls-packets-btn ghost sm" data-act="unfollow">ปิด Follow Stream</button></div>
<p>Client <code>${esc(fs.cli.ip)}:${fs.cli.port}</code> ↔ Server <code>${esc(fs.srv.ip)}:${fs.srv.port}</code> · ข้อความสีน้ำเงิน = client ส่ง, สีส้ม = server ส่ง</p>
<div class="nls-packets-conv">${conv}</div>
<ol class="nls-packets-segl">${fs.segs.map((s) => `<li>#${s.no} ${s.dir === 'c' ? 'client → server' : 'server → client'} [${esc(s.flags)}] Len=${s.len}${s.retrans ? ' (ส่งซ้ำ)' : ''}</li>`).join('')}</ol></section>`;
      }
      function updateUseSel() {
        const a = A(); const n = a && a.view.sel;
        el.querySelectorAll('[data-act="usesel"]').forEach((b) => { b.textContent = n ? `ใช้ #${n}` : 'ใช้ที่เลือก'; b.disabled = !n || b.hasAttribute('data-locked'); });
      }

      /* ---------------- answers */
      function fieldInput(w, f) {
        const id = `${uid}-a-${f.key}`, v = w.answers[f.key] != null ? w.answers[f.key] : '';
        const locked = !!w.result;
        const dis = locked ? ' disabled' : '';
        const mark = '<span class="nls-packets-mark" aria-live="off"></span>';
        if (f.type === 'select') {
          return `<div class="nls-packets-f" data-fkey="${esc(f.key)}"><label for="${id}">${esc(f.label)}</label><select id="${id}" data-key="${esc(f.key)}"${dis}><option value="">— เลือก —</option>${f.options.map((o) => `<option value="${esc(o.v)}"${o.v === v ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select>${mark}</div>`;
        }
        if (f.type === 'frame' || f.type === 'frames') {
          return `<div class="nls-packets-f${f.type === 'frames' ? ' wide' : ''}" data-fkey="${esc(f.key)}"><label for="${id}">${esc(f.label)}</label><div class="nls-packets-frow"><input id="${id}" data-key="${esc(f.key)}" type="text" inputmode="${f.type === 'frame' ? 'numeric' : 'text'}" autocomplete="off" spellcheck="false" placeholder="${esc(f.ph || '')}" value="${esc(v)}"${dis}>` +
            `<button type="button" class="nls-packets-btn ghost sm" data-act="${f.type === 'frame' ? 'usesel' : 'addsel'}" data-key="${esc(f.key)}"${locked ? ' disabled data-locked' : ''}>${f.type === 'frame' ? 'ใช้ที่เลือก' : 'เพิ่มที่เลือก'}</button></div>${mark}</div>`;
        }
        if (f.type === 'filter') {
          const no = Number(f.key.slice(1)) + 1;
          return `<div class="nls-packets-f wide" data-fkey="${esc(f.key)}"><label for="${id}"><span class="nls-packets-tno">ข้อ ${no}</span>${esc(f.label)}</label><div class="nls-packets-frow"><input id="${id}" data-key="${esc(f.key)}" data-filter="1" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="display filter" value="${esc(v)}" aria-describedby="${id}-m"${dis}>` +
            `<button type="button" class="nls-packets-btn ghost sm" data-act="try" data-key="${esc(f.key)}">ทดลองกับ capture</button></div><p class="nls-packets-fmsg" id="${id}-m" data-tmsg="${esc(f.key)}" aria-live="polite"></p>${mark}</div>`;
        }
        return `<div class="nls-packets-f" data-fkey="${esc(f.key)}"><label for="${id}">${esc(f.label)}</label><input id="${id}" data-key="${esc(f.key)}" type="text" inputmode="${f.mode === 'numeric' ? 'numeric' : f.mode === 'decimal' ? 'decimal' : 'text'}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(f.ph || '')}" value="${esc(v)}"${dis}>${mark}</div>`;
      }
      function renderAnswers() {
        const box = $('[data-el="ans"]');
        const show = state.tab === 'missions' && state.cur && W(state.cur).built;
        box.classList.toggle('nls-packets-hide', !show);
        if (!show) { box.innerHTML = ''; return; }
        const w = W(state.cur), b = w.built;
        let h = `<h3>คำตอบ (ส่งตรวจที่เซิร์ฟเวอร์)</h3><form data-el="aform" novalidate><div class="nls-packets-fields">${b.fields.map((f) => fieldInput(w, f)).join('')}</div>` +
          `<div class="nls-packets-row2"><button type="submit" class="nls-packets-btn go"${w.result || w.busy ? ' disabled' : ''}>${w.busy ? 'กำลังตรวจ…' : 'ตรวจคำตอบ'}</button>` +
          (w.result ? '' : '<button type="button" class="nls-packets-btn ghost" data-act="aclear">ล้างคำตอบ</button>') + '</div></form>';
        if (w.err && w.built) h += `<p class="nls-packets-msg err" role="alert">${esc(w.err)}</p>`;
        if (w.result) {
          const r = w.result, cls = r.score >= r.max ? 'full' : r.score > 0 ? 'part' : 'zero';
          h += `<div class="nls-packets-result ${cls}" role="status" tabindex="-1"><p class="nls-packets-score">คะแนน ${esc(r.score)}/${esc(r.max)}</p><ul>${(r.feedback || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` +
            (r.saved === false && !ctx.user ? '<p class="nls-packets-desc">โหมดผู้เยี่ยมชม: ตรวจได้แต่ไม่บันทึกคะแนน</p>' : '') +
            '<div class="nls-packets-row2" style="margin-top:8px"><button type="button" class="nls-packets-btn go" data-act="new">ทำโจทย์ใหม่</button></div></div>';
        }
        box.innerHTML = h;
        if (w.result && w.result.details && w.result.details.fields) {
          const F = w.result.details.fields;
          box.querySelectorAll('[data-fkey]').forEach((d) => {
            const k = d.getAttribute('data-fkey');
            if (!(k in F)) return;
            d.classList.add(F[k] ? 'ok' : 'bad');
            const mk = d.querySelector('.nls-packets-mark'); if (mk) mk.textContent = F[k] ? 'ถูก' : 'ยังไม่ถูก';
          });
        }
        box.querySelectorAll('[data-filter]').forEach((inp) => tryMsg(inp.getAttribute('data-key'), false));
        updateUseSel();
      }
      function tryMsg(key, apply) {
        const w = W(state.cur); if (!w.built) return;
        const inp = el.querySelector(`input[data-key="${key}"]`), msg = el.querySelector(`[data-tmsg="${key}"]`);
        if (!inp || !msg) return;
        const v = inp.value;
        if (!v.trim()) { msg.textContent = ''; msg.className = 'nls-packets-fmsg'; return; }
        const r = LIB.runFilter(w.built.capture, v);
        if (!r.ok) { msg.textContent = 'ผิดรูปแบบ: ' + r.error; msg.className = 'nls-packets-fmsg err'; }
        else { msg.textContent = `รูปแบบถูกต้อง · ได้ ${r.set.length} แพ็กเก็ต` + (r.set.length && r.set.length <= 12 ? ` (#${r.set.join(', #')})` : ''); msg.className = 'nls-packets-fmsg okm'; }
        if (apply && r.ok) {
          applyFilter(w, v); w.view.follow = null;
          renderList(w); renderFollow(w);
          if (r.set.length && !r.set.includes(w.view.sel)) select(r.set[0]);
          const wrap = $('[data-el="an"]'); if (wrap.scrollIntoView) wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }
      function collect() {
        const w = W(state.cur), out = {};
        $('[data-el="ans"]').querySelectorAll('input[data-key],select[data-key]').forEach((inp) => { out[inp.getAttribute('data-key')] = inp.value.trim(); });
        w.answers = out;
        return out;
      }
      async function submit() {
        const id = state.cur, w = W(id);
        if (!w.built || w.busy || w.result) return;
        const answers = collect();
        if (Object.values(answers).every((v) => v === '')) { w.err = 'กรอกคำตอบอย่างน้อย 1 ข้อก่อนกดตรวจ'; renderAnswers(); return; }
        if (typeof ctx.submit !== 'function') { w.err = 'ส่งคำตอบไม่ได้ในขณะนี้'; renderAnswers(); return; }
        w.busy = true; w.err = ''; renderAnswers();
        try {
          const r = await ctx.submit(id, { answers }, { problem: w.problem, token: w.token });
          if (!state.alive) return;
          w.result = r || { score: 0, max: 10, feedback: ['ไม่ได้รับผลการตรวจ'] };
          const d = done[id] || { best: 0, max: w.result.max, attempts: 0 };
          done[id] = { best: w.result.practice ? (d.best || 0) : Math.max(d.best || 0, Number(w.result.score) || 0), max: w.result.max || d.max, attempts: (d.attempts || 0) + 1 };   // practice = a reused problem (3.0 P6)
          toast(`ได้ ${w.result.score}/${w.result.max} คะแนน`);
        } catch (e) { w.err = 'ส่งคำตอบไม่สำเร็จ: ' + ((e && e.message) || 'ลองใหม่อีกครั้ง'); }
        w.busy = false;
        if (!state.alive) return;
        renderMissions(); renderAnswers();
        if (state.cur === id) { const a = A(); if (a) { renderTools(a); renderDetail(a); } }
        const res = $('[data-el="ans"] .nls-packets-result');
        if (res) { res.focus({ preventScroll: true }); if (res.scrollIntoView) res.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      }

      /* ---------------- tabs */
      function setTab(t) {
        if (EMB && t !== 'missions') return;   // embedded: no free exploration
        state.tab = t;
        el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t)));
        el.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('nls-packets-hide', p.getAttribute('data-pane') !== t));
        $('[data-el="grid"]').classList.toggle('solo', t === 'explore');
        if (t === 'explore') renderExplore(); else { renderWork(); renderAnswers(); }
        renderAnalyzer();
      }

      /* ---------------- events */
      function onClick(e) {
        const t = e.target.closest('button,[data-no]');
        if (!t || !el.contains(t)) return;
        if (t.hasAttribute('data-tab')) { setTab(t.getAttribute('data-tab')); return; }
        if (t.hasAttribute('data-mission')) { selectMission(t.getAttribute('data-mission')); return; }
        if (t.hasAttribute('data-no') && t.classList.contains('nls-packets-row')) { select(Number(t.getAttribute('data-no')), { focus: true }); return; }
        if (t.hasAttribute('data-jump')) { jump(Number(t.getAttribute('data-jump'))); return; }
        if (t.hasAttribute('data-chip')) { const a = A(); if (!a) return; $('[data-el="finput"]').value = t.getAttribute('data-chip'); doApply(); return; }
        if (t.hasAttribute('data-fld')) {
          const a = A(); if (!a) return;
          const path = t.getAttribute('data-path');
          const same = a.view.field && a.view.field.path === path;
          a.view.field = same ? null : { f: t.getAttribute('data-fld'), v: t.getAttribute('data-val'), path };
          a.view.layer = t.getAttribute('data-layer');
          el.querySelectorAll('.nls-packets-fld[aria-pressed="true"]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          if (!same) t.setAttribute('aria-pressed', 'true');
          el.querySelectorAll('.nls-packets-tree>details>summary').forEach((s) => s.classList.toggle('sel', s.parentNode.getAttribute('data-layer') === a.view.layer));
          renderTools(a); renderBytes(a, pkt(a, a.view.sel));
          return;
        }
        if (t.hasAttribute('data-enc')) {
          const a = A(); if (!a) return;
          const k = t.getAttribute('data-enc');
          a.view.layer = k; a.view.open[k] = true;
          renderDetail(a);
          const d = el.querySelector(`.nls-packets-tree details[data-layer="${k}"]`); if (d) { d.open = true; const s = d.querySelector('summary'); if (s) s.focus({ preventScroll: false }); }
          return;
        }
        const act = t.getAttribute('data-act');
        if (!act) return;
        const a = A();
        if (act === 'new') { newProblem(); return; }
        if (act === 'hint') { const w = W(state.cur); const m = missions.find((x) => x.id === state.cur); if (m && w.hints < (m.hints || []).length) { w.hints++; renderWork(); } return; }
        if (act === 'fclear' && a) { $('[data-el="finput"]').value = ''; a.view.follow = null; doApply(); return; }
        if (act === 'follow' && a) {
          const p = pkt(a, a.view.sel); if (!p || !p.tcp) return;
          if (a.view.follow == null) a.view.prevFilter = a.view.applied;
          a.view.follow = p.tcp.stream;
          applyFilter(a, 'tcp.stream eq ' + p.tcp.stream);
          $('[data-el="finput"]').value = a.view.filter; liveCheck();
          renderList(a); renderFollow(a);
          const fb = $('[data-el="follow"] section'); if (fb) { fb.setAttribute('tabindex', '-1'); fb.focus({ preventScroll: true }); if (fb.scrollIntoView) fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
          return;
        }
        if (act === 'unfollow' && a) {
          a.view.follow = null;
          applyFilter(a, a.view.prevFilter || '');
          $('[data-el="finput"]').value = a.view.filter; liveCheck();
          renderList(a); renderFollow(a);
          const fbtn = $('[data-act="follow"]'); if (fbtn) fbtn.focus();
          return;
        }
        if (act === 'usefield' && a && a.view.field) {
          const f = a.view.field;
          $('[data-el="finput"]').value = f.v != null && f.v !== '' ? `${f.f} == ${f.v}` : f.f;
          doApply(); return;
        }
        if (act === 'addev' && a) { addEvidence(a.view.sel); return; }
        if (act === 'usesel' && a && a.view.sel) {
          const inp = el.querySelector(`input[data-key="${t.getAttribute('data-key')}"]`);
          if (inp && !inp.disabled) { inp.value = String(a.view.sel); collect(); inp.focus(); }
          return;
        }
        if (act === 'addsel' && a && a.view.sel) { addEvidence(a.view.sel); return; }
        if (act === 'try') { tryMsg(t.getAttribute('data-key'), true); return; }
        if (act === 'aclear') { const w = W(state.cur); w.answers = {}; w.err = ''; renderAnswers(); return; }
        if (act === 'exnew' && state.ex) { exploreLoad(state.ex.scen); renderExplore(); renderAnalyzer(); return; }
      }
      function addEvidence(no) {
        if (!no) return;
        const inp = el.querySelector('input[data-key="evidence"]'); if (!inp || inp.disabled) return;
        const cur = inp.value.split(/[\s,;]+/).map((x) => x.replace(/^#/, '')).filter((x) => /^\d+$/.test(x)).map(Number);
        if (!cur.includes(no)) cur.push(no);
        inp.value = cur.sort((x, y) => x - y).join(', ');
        collect();
        toast(`เพิ่มแพ็กเก็ต #${no} เป็นหลักฐานแล้ว`);
      }
      function doApply() {
        const a = A(); if (!a) return;
        const inp = $('[data-el="finput"]');
        const r = applyFilter(a, inp.value);
        liveCheck();
        if (!r.ok) { statusMsg(a, { err: r.error }); return; }
        if (a.view.follow != null && a.view.applied !== 'tcp.stream eq ' + a.view.follow) { a.view.follow = null; renderFollow(a); }
        renderList(a);
        if (a.view.visible.length && !a.view.visible.includes(a.view.sel)) select(a.view.visible[0]);
      }
      function onSubmit(e) {
        const f = e.target;
        if (f.getAttribute('data-el') === 'fform') { e.preventDefault(); doApply(); return; }
        if (f.getAttribute('data-el') === 'aform') { e.preventDefault(); submit(); }
      }
      function onInput(e) {
        const t = e.target;
        if (t.getAttribute('data-el') === 'finput') { liveCheck(); return; }
        if (t.hasAttribute('data-key') && /^(INPUT|SELECT)$/.test(t.tagName)) {
          const w = state.cur ? W(state.cur) : null; if (w && !w.result) w.answers[t.getAttribute('data-key')] = t.value;
          if (t.hasAttribute('data-filter')) tryMsg(t.getAttribute('data-key'), false);
        }
      }
      function onChange(e) {
        const t = e.target;
        if (t.getAttribute('data-el') === 'scen') { exploreLoad(t.value); renderExplore(); renderAnalyzer(); const s = $('[data-el="scen"]'); if (s) s.focus(); return; }
        if (t.hasAttribute('data-key')) { const w = state.cur ? W(state.cur) : null; if (w && !w.result) w.answers[t.getAttribute('data-key')] = t.value; }
      }
      function onKey(e) {
        const t = e.target;
        if (t.getAttribute && t.getAttribute('data-el') === 'list') {
          const a = A(); if (!a) return;
          const vis = a.view.visible; if (!vis.length) return;
          let i = vis.indexOf(a.view.sel);
          const k = e.key;
          if (k === 'ArrowDown') i = i < 0 ? 0 : Math.min(vis.length - 1, i + 1);
          else if (k === 'ArrowUp') i = i < 0 ? 0 : Math.max(0, i - 1);
          else if (k === 'Home') i = 0;
          else if (k === 'End') i = vis.length - 1;
          else if (k === 'PageDown') i = Math.min(vis.length - 1, (i < 0 ? 0 : i) + 10);
          else if (k === 'PageUp') i = Math.max(0, (i < 0 ? 0 : i) - 10);
          else return;
          e.preventDefault();
          select(vis[i]);
          return;
        }
        if (t.getAttribute && t.getAttribute('role') === 'tab' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
          e.preventDefault();
          const nt = state.tab === 'missions' ? 'explore' : 'missions';
          setTab(nt); const b = el.querySelector(`[data-tab="${nt}"]`); if (b) b.focus();
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-filter') && e.key === 'Enter') { e.preventDefault(); tryMsg(t.getAttribute('data-key'), true); }
      }
      function onToggle(e) {
        const d = e.target; if (!d || d.tagName !== 'DETAILS') return;
        const a = A(); if (!a) return;
        if (d.hasAttribute('data-layer')) a.view.open[d.getAttribute('data-layer')] = d.open;
        else if (d.hasAttribute('data-sub')) a.view.sub[d.getAttribute('data-sub')] = d.open;
      }
      el.addEventListener('click', onClick);
      el.addEventListener('submit', onSubmit);
      el.addEventListener('input', onInput);
      el.addEventListener('change', onChange);
      el.addEventListener('keydown', onKey);
      el.addEventListener('toggle', onToggle, true);

      state.cur = missions[0] ? missions[0].id : null;
      renderMissions(); renderWork(); renderAnswers();
      const first = EMB ? EMB_ID : ctx.initial && missions.some((m) => m.id === ctx.initial) ? ctx.initial : null;
      if (first || state.cur) selectMission(first || state.cur);
      return {
        destroy() {
          state.alive = false;
          el.removeEventListener('click', onClick); el.removeEventListener('submit', onSubmit);
          el.removeEventListener('input', onInput); el.removeEventListener('change', onChange);
          el.removeEventListener('keydown', onKey); el.removeEventListener('toggle', onToggle, true);
          if (el.parentNode) el.parentNode.removeChild(el);
        }
      };
    }
  };
})();
