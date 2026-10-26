'use strict';
/*
 * NetLab - IPv6 Lab "ห้องปฏิบัติการ IPv6" (browser module + shared engine)
 * Registers window.NL_SIMS.ipv6 in the browser. Under Node (require) this file exports only the DOM-free engine V6,
 * which the server grader (server/sims/ipv6.js) re-runs on the student's submitted configuration.
 *
 * ENGINE (V6)
 *   Address tools (RFC 4291 / RFC 5952):
 *     V6.parse(str, { zone }) -> { ok, w:[8 x 16-bit], zone, dc, groups } | { ok:false, err (Thai) }
 *     V6.compress(w) canonical RFC 5952 text; V6.expand(w) full 8 x 4-digit text
 *     V6.typeOf(w) -> 'unspecified'|'loopback'|'multicast'|'link-local'|'unique-local'|'global'|'ipv4-mapped'|'reserved'
 *     V6.network(w, len), V6.inPrefix(w, net, len), V6.parseCidr('2001:db8::/64'), V6.parseLen('/64'|'64')
 *     V6.parseMac(str) -> { ok, b:[6 bytes] }, V6.eui64(bytes) -> [4 words], V6.linkLocal(bytes) -> [8 words]
 *     V6.solicited(w) solicited-node multicast ff02::1:ffXX:XXXX
 *     V6.canonIssues(text, parsed) Thai list of RFC 5952 rules a correct-valued answer breaks
 *     V6.expandIssues(text, parsed) Thai list of why a text is not the full (expanded) form
 *   Network (hosts + routers on links = switch segments):
 *     V6.create(topo) -> net:
 *       net.iface(devId[, ifId]) state: addresses (link-local EUI-64 or manual, static, SLAAC) with DAD state,
 *                                 on-link prefixes, default gateway, RA, notes (Thai)
 *       net.ping(srcId, target) -> { ok, code, text, dir:'go'|'back', at, path, trace:[{k,t}], out:[lines], src, dst }
 *       net.matrix([hostIds]) -> [{ from, to, target, ok, code, text }]
 *       net.routes(devId), net.neighbors(devId), net.show(devId) (ipconfig / ip -6 addr / show ipv6 interface)
 *       net.primary(devId) first usable global/ULA address text or null
 *     V6.applyConfig(baseTopo, cfg) whitelisted student edits (shared by browser and grader)
 *     V6.MT mission topologies, V6.v2Topo(problem)
 *   Model: every active interface gets a link-local address (EUI-64 from its MAC, or a manual one on routers).
 *   DAD (RFC 4862): on each link the interface that configured an address first keeps it (order: iface.t, then device
 *   order); later ones mark it duplicate and do not use it; a duplicate link-local disables IPv6 on that interface.
 *   Routers send RA from their link-local address advertising the prefixes of their global addresses on that interface;
 *   hosts in SLAAC mode build prefix(/64) + EUI-64 and use the RA source (router link-local) as default gateway.
 *   A prefix that is not /64 is on-link only (SLAAC impossible). Hosts in static mode ignore RA.
 */
(function () {
  const V6 = (function () {
    const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
    const clone = x => JSON.parse(JSON.stringify(x));
    const sv = (v, n) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).slice(0, n || 64);
    const h4 = n => n.toString(16);
    const pad4 = n => ('000' + n.toString(16)).slice(-4);
    const bad = err => ({ ok: false, err });

    /* ------------------------------------------------------------------ address parsing */
    function parse(s, opts) {
      opts = opts || {};
      if (typeof s !== 'string') return bad('ยังไม่ได้กรอก IPv6 address');
      let t = s.trim();
      if (!t) return bad('ยังไม่ได้กรอก IPv6 address');
      if (t.length > 60) return bad('ข้อความยาวเกินไป (IPv6 address แบบเขียนเต็มยาวที่สุด 39 ตัวอักษร)');
      if (/\s/.test(t)) return bad('มีช่องว่างอยู่กลาง address');
      let zone = null;
      const pc = t.indexOf('%');
      if (pc >= 0) {
        if (!opts.zone) return bad('มีเครื่องหมาย % (zone ID เช่น %eth0) ช่องนี้ให้กรอกเฉพาะ address');
        zone = t.slice(pc + 1); t = t.slice(0, pc);
        if (!/^[A-Za-z0-9._/-]{1,16}$/.test(zone)) return bad('zone ID หลังเครื่องหมาย % ไม่ถูกต้อง (เช่น %eth0 หรือ %12)');
        if (!t) return bad('ยังไม่ได้กรอก IPv6 address หน้าเครื่องหมาย %');
      }
      if (t.includes('/')) return bad('มี prefix length (/n) ติดมาด้วย ช่องนี้ให้กรอกเฉพาะ address (prefix length กรอกแยกช่อง)');
      const m = /[^0-9A-Fa-f:.]/.exec(t);
      if (m) return bad(`มีตัวอักษร "${m[0]}" ซึ่งไม่ใช่เลขฐาน 16 (ใช้ได้เฉพาะ 0–9, a–f และเครื่องหมาย :)`);
      if (!t.includes(':')) return bad('ไม่มีเครื่องหมาย : คั่นกลุ่ม (IPv6 เขียนเป็น 8 กลุ่ม กลุ่มละ 16 บิต คั่นด้วย :)');
      if (t.includes(':::')) return bad('มีเครื่องหมาย : ติดกัน 3 ตัว (:::) ใช้ติดกันได้มากที่สุด 2 ตัว (::)');
      const dc = t.split('::').length - 1;
      if (dc > 1) return bad('ใช้ :: ได้เพียงครั้งเดียวใน address (ถ้ามี 2 ที่ จะไม่รู้ว่าแต่ละที่แทนกลุ่ม 0 กี่กลุ่ม)');
      if (t[0] === ':' && t[1] !== ':') return bad('ขึ้นต้นด้วย : ตัวเดียวไม่ได้ (ต้องเป็น :: หรือขึ้นต้นด้วยเลขฐาน 16)');
      if (t[t.length - 1] === ':' && t[t.length - 2] !== ':') return bad('ลงท้ายด้วย : ตัวเดียวไม่ได้ (ต้องเป็น :: หรือลงท้ายด้วยเลขฐาน 16)');
      let left, right;
      if (dc) { const p = t.split('::'); left = p[0] ? p[0].split(':') : []; right = p[1] ? p[1].split(':') : []; }
      else { left = t.split(':'); right = []; }
      const all = left.concat(right);
      for (let i = 0; i < all.length; i++) if (all[i].includes('.') && i !== all.length - 1) return bad('ส่วน IPv4 (ตัวเลขมีจุด) ต้องอยู่ท้ายสุดของ address');
      let v4 = null;
      const last = all[all.length - 1];
      if (last && last.includes('.')) {
        const q = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(last);
        if (!q || q.slice(1).some(x => Number(x) > 255)) return bad('ส่วน IPv4 ท้าย address ไม่ถูกต้อง (ต้องเป็นเลข 4 ชุด 0–255 เช่น 192.0.2.1)');
        v4 = q.slice(1).map(Number);
      }
      for (const g of all) {
        if (g.includes('.')) continue;
        if (g === '') return bad('มีกลุ่มว่างระหว่างเครื่องหมาย : (กลุ่มที่เป็น 0 ให้เขียน 0 หรือใช้ :: แทน)');
        if (g.length > 4) return bad(`กลุ่ม "${g}" มี ${g.length} หลัก เกิน 4 หลัก (แต่ละกลุ่มคือ 16 บิต = เลขฐาน 16 ไม่เกิน 4 หลัก)`);
      }
      const count = all.length + (v4 ? 1 : 0);
      if (dc && count > 7) return bad(`มี :: แต่กลุ่มที่เขียนไว้มี ${count} กลุ่มแล้ว (:: ต้องแทนกลุ่ม 0 อย่างน้อย 1 กลุ่ม รวมทั้งหมดต้องได้ 8 กลุ่มพอดี)`);
      if (!dc && count < 8) return bad(`มีเพียง ${count} กลุ่ม (ต้องมีครบ 8 กลุ่ม หรือใช้ :: แทนกลุ่ม 0 ที่ต่อกัน)`);
      if (!dc && count > 8) return bad(`มี ${count} กลุ่ม เกิน 8 กลุ่ม (IPv6 ยาว 128 บิต = 8 กลุ่ม × 16 บิต)`);
      const toW = arr => {
        const out = [];
        for (const g of arr) {
          if (g.includes('.')) { out.push(v4[0] * 256 + v4[1], v4[2] * 256 + v4[3]); } else out.push(parseInt(g, 16));
        }
        return out;
      };
      const L = toW(left), R = toW(right);
      const w = dc ? L.concat(new Array(8 - L.length - R.length).fill(0), R) : L;
      return { ok: true, w, zone, dc, groups: all, gap: dc ? { start: L.length, len: 8 - L.length - R.length } : null };
    }

    // longest run of >= 2 zero groups (first one when tied) -> { start, len } | null
    function zeroRun(w) {
      let best = null;
      for (let i = 0; i < 8;) {
        if (w[i] !== 0) { i++; continue; }
        let j = i; while (j < 8 && w[j] === 0) j++;
        if (j - i >= 2 && (!best || j - i > best.len)) best = { start: i, len: j - i };
        i = j;
      }
      return best;
    }
    function compress(w) {
      const r = zeroRun(w);
      if (!r) return w.map(h4).join(':');
      const a = w.slice(0, r.start).map(h4).join(':'), b = w.slice(r.start + r.len).map(h4).join(':');
      return a + '::' + b;
    }
    const expand = w => w.map(pad4).join(':');
    const eq = (a, b) => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);
    const key = w => w.join(',');

    const TYPE_TH = {
      unspecified: 'Unspecified (::)', loopback: 'Loopback (::1)', multicast: 'Multicast (ff00::/8)',
      'link-local': 'Link-local unicast (fe80::/10)', 'unique-local': 'Unique local (fc00::/7)',
      global: 'Global unicast (2000::/3)', 'ipv4-mapped': 'IPv4-mapped (::ffff:0:0/96)', reserved: 'สงวนไว้/ยังไม่กำหนดใช้'
    };
    function typeOf(w) {
      if (w.every(x => x === 0)) return 'unspecified';
      if (w.slice(0, 7).every(x => x === 0) && w[7] === 1) return 'loopback';
      if ((w[0] & 0xff00) === 0xff00) return 'multicast';
      if ((w[0] & 0xffc0) === 0xfe80) return 'link-local';
      if ((w[0] & 0xfe00) === 0xfc00) return 'unique-local';
      if ((w[0] & 0xe000) === 0x2000) return 'global';
      if (w.slice(0, 5).every(x => x === 0) && w[5] === 0xffff) return 'ipv4-mapped';
      return 'reserved';
    }
    const isUnicastGlobal = w => { const t = typeOf(w); return t === 'global' || t === 'unique-local'; };

    function network(w, len) {
      const out = [];
      for (let i = 0; i < 8; i++) {
        const bits = Math.max(0, Math.min(16, len - i * 16));
        const mask = bits === 0 ? 0 : (0xffff << (16 - bits)) & 0xffff;
        out.push(w[i] & mask);
      }
      return out;
    }
    const inPrefix = (w, net, len) => eq(network(w, len), network(net, len));
    function parseLen(v) {
      const s = sv(v, 8).trim().replace(/^\//, '');
      if (!/^\d{1,3}$/.test(s)) return null;
      const n = Number(s); return n >= 0 && n <= 128 ? n : null;
    }
    function parseCidr(s) {
      const t = sv(s, 70).trim();
      if (!t) return bad('ยังไม่ได้กรอก prefix');
      const i = t.indexOf('/');
      if (i < 0) return bad('prefix ต้องมี /ความยาว ต่อท้าย เช่น 2001:db8:20::/64');
      const p = parse(t.slice(0, i));
      if (!p.ok) return p;
      const len = parseLen(t.slice(i + 1));
      if (len === null) return bad('prefix length ต้องเป็นตัวเลข 0–128 เช่น /64');
      return { ok: true, w: network(p.w, len), len, hostBits: !eq(network(p.w, len), p.w) };
    }

    /* ------------------------------------------------------------------ MAC / EUI-64 */
    function parseMac(s) {
      const t = sv(s, 40).trim().toLowerCase();
      let hex = null;
      if (/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/.test(t)) hex = t.replace(/[:-]/g, '');
      else if (/^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/.test(t)) hex = t.replace(/\./g, '');
      else if (/^[0-9a-f]{12}$/.test(t)) hex = t;
      if (!hex) return bad('รูปแบบ MAC address ไม่ถูกต้อง (เช่น 00:1a:2b:3c:4d:5e)');
      const b = []; for (let i = 0; i < 12; i += 2) b.push(parseInt(hex.slice(i, i + 2), 16));
      return { ok: true, b };
    }
    const macStr = (b, sep) => b.map(x => ('0' + x.toString(16)).slice(-2)).join(sep || ':');
    // modified EUI-64 (RFC 4291 2.5.1 / appendix A): insert ff:fe in the middle, invert the U/L bit (0x02 of byte 0)
    const eui64 = b => [((b[0] ^ 0x02) << 8) | b[1], (b[2] << 8) | 0xff, 0xfe00 | b[3], (b[4] << 8) | b[5]];
    const linkLocal = b => [0xfe80, 0, 0, 0].concat(eui64(b));
    const solicited = w => [0xff02, 0, 0, 0, 0, 1, 0xff00 | (w[6] & 0xff), w[7]];

    /* ------------------------------------------------------------------ notation feedback */
    // RFC 5952 rules broken by `text` (whose value is already known to be right)
    function canonIssues(text, p) {
      const out = [];
      if (!p || !p.ok) return out;
      if (/[A-F]/.test(text)) out.push('ใช้ตัวพิมพ์ใหญ่ RFC 5952 กำหนดให้เขียนเลขฐาน 16 ด้วยตัวพิมพ์เล็ก (a–f)');
      const lz = p.groups.filter(g => !g.includes('.') && g.length > 1 && g[0] === '0');
      if (lz.length) out.push(`ยังมีเลข 0 นำหน้าในกลุ่ม ${lz.slice(0, 3).map(g => '"' + g + '"').join(', ')} ต้องตัด 0 นำหน้าออก (เช่น 0db8 → db8, 0000 → 0)`);
      const want = zeroRun(p.w), got = p.gap;
      if (got && got.len === 1) out.push('ใช้ :: แทนกลุ่ม 0 เพียงกลุ่มเดียว ซึ่ง RFC 5952 ไม่อนุญาต กลุ่ม 0 กลุ่มเดียวให้เขียนเป็น 0');
      else if (want && !got) out.push(`ยังไม่ได้ใช้ :: ย่อกลุ่ม 0 ที่ต่อกัน ${want.len} กลุ่ม`);
      else if (want && got) {
        let s = got.start, e = got.start + got.len;
        const extend = (s > 0 && p.w[s - 1] === 0) || (e < 8 && p.w[e] === 0);
        if (extend) out.push(':: ต้องแทนกลุ่ม 0 ที่ต่อกันทั้งหมดในช่วงนั้น (ยังเหลือกลุ่ม 0 ติดกับ :: เขียนไว้)');
        else if (got.len < want.len) out.push(`ต้องใช้ :: กับช่วงกลุ่ม 0 ที่ยาวที่สุด (${want.len} กลุ่ม) ไม่ใช่ช่วงที่สั้นกว่า`);
        else if (got.start !== want.start) out.push('มีช่วงกลุ่ม 0 ยาวเท่ากันสองช่วง RFC 5952 ให้ย่อช่วงแรก (ด้านซ้าย)');
      }
      if (!out.length && text !== compress(p.w)) out.push('ยังไม่อยู่ในรูปแบบมาตรฐาน RFC 5952');
      return out;
    }
    function expandIssues(text, p) {
      const out = [];
      if (!p || !p.ok) return out;
      if (p.dc) out.push('ยังมี :: อยู่ รูปเต็มต้องเขียนครบ 8 กลุ่มโดยไม่ย่อ');
      const short = p.groups.filter(g => g.length < 4);
      if (short.length) out.push(`กลุ่ม ${short.slice(0, 3).map(g => '"' + g + '"').join(', ')} ต้องเติม 0 ด้านหน้าให้ครบ 4 หลัก`);
      if (p.groups.some(g => g.includes('.'))) out.push('รูปเต็มต้องเขียนเป็นเลขฐาน 16 ทั้ง 8 กลุ่ม (ไม่ใช้ส่วน IPv4 แบบมีจุด)');
      return out;
    }

    /* ------------------------------------------------------------------ network engine */
    const NOTE = {
      bad_addr: 'IPv6 address ที่ตั้งไว้ไม่ถูกต้อง', bad_len: 'prefix length ต้องเป็นตัวเลข 1–128 (LAN ใช้ /64)',
      addr_type: 'address แบบ static ต้องเป็น global unicast (2000::/3) หรือ unique local (fc00::/7)',
      bad_gw: 'default gateway ไม่ใช่ IPv6 address ที่ถูกต้อง', ll_bad: 'link-local ที่ตั้งเองต้องอยู่ในช่วง fe80::/10 จึงใช้ EUI-64 แทน',
      no_ra: 'ไม่ได้รับ Router Advertisement (RA) บนลิงก์นี้ จึงสร้าง global address ด้วย SLAAC ไม่ได้และไม่มี default gateway',
      ra_len: 'RA ประกาศ prefix ที่ไม่ใช่ /64 ใช้ทำ SLAAC ไม่ได้ (prefix 64 บิต + interface ID 64 บิต ต้องรวมได้ 128 บิต)',
      dad: 'DAD พบว่ามีเครื่องอื่นบนลิงก์ใช้ address นี้อยู่แล้ว (duplicate) จึงไม่นำมาใช้',
      dad_ll: 'link-local address ซ้ำกับเครื่องอื่นบนลิงก์ (DAD ล้มเหลว) IPv6 บน interface นี้จึงถูกปิด',
      down: 'interface ถูกปิด (shutdown) หรือไม่ได้ต่อสาย', len_not64: 'LAN ที่มีโฮสต์ควรใช้ prefix length /64'
    };
    const REASON = {
      ok: 'สำเร็จ ได้รับ Echo Reply กลับมา',
      bad_target: 'ปลายทางไม่ใช่ IPv6 unicast address ที่ ping ได้',
      iface_down: 'interface ของเครื่องต้นทางปิดอยู่ หรือไม่ได้ต่อสาย',
      dad_ll: 'link-local address ซ้ำ (DAD ล้มเหลว) IPv6 บน interface ถูกปิด',
      no_src: 'เครื่องต้นทางไม่มี global address ที่ใช้งานได้',
      no_ra: 'เครื่องต้นทางใช้ SLAAC แต่ลิงก์นี้ไม่มี Router Advertisement (RA ถูกปิด) จึงไม่มี global address และไม่มี default gateway',
      ra_len: 'RA ประกาศ prefix ที่ไม่ใช่ /64 จึงทำ SLAAC ไม่ได้ เครื่องต้นทางไม่มี global address',
      dad: 'global address ของเครื่องต้นทางซ้ำกับเครื่องอื่น (DAD ล้มเหลว) จึงไม่ถูกใช้งาน',
      no_gateway: 'ปลายทางอยู่ต่างวง แต่ไม่มี default gateway',
      gw_not_onlink: 'default gateway ไม่อยู่บนลิงก์เดียวกับเครื่อง (gateway ต้องเป็น address ของ router ฝั่งที่เครื่องต่ออยู่ ปกติใช้ link-local ของ router)',
      gw_unreachable: 'ส่ง Neighbor Solicitation หา default gateway แล้วไม่มีใครตอบ (ไม่มีอุปกรณ์ที่ใช้ address นี้บนลิงก์)',
      gw_not_router: 'default gateway ที่ตั้งไว้เป็นโฮสต์ ไม่ใช่ router จึงไม่ส่งต่อแพ็กเก็ต',
      ndp_fail: 'ส่ง Neighbor Solicitation หาปลายทางบนลิงก์แล้วไม่มีใครตอบ (Address unreachable)',
      wrong_prefix: 'prefix length สั้นเกินไป (เช่น /48 แทน /64) ทำให้เครื่องเข้าใจว่าปลายทางอยู่บนลิงก์เดียวกัน จึงถาม NDP แทนที่จะส่งผ่าน gateway และไม่มีใครตอบ',
      ll_offlink: 'link-local address ใช้ได้เฉพาะภายในลิงก์เดียวกัน ไม่ผ่าน router และไม่พบ address นี้บนลิงก์ของเครื่องต้นทาง',
      no_route: 'router ไม่มีเส้นทาง (route) ไปยัง prefix ของปลายทาง',
      not_router: 'แพ็กเก็ตไปถึงโฮสต์ที่ไม่ใช่ปลายทาง โฮสต์ไม่ส่งต่อแพ็กเก็ต',
      hop_limit: 'แพ็กเก็ตวนซ้ำจน Hop Limit หมด (routing loop)',
      target_no_addr: 'ปลายทางไม่มี global address ที่ใช้งานได้'
    };

    const DTYPES = ['pc', 'server', 'router'];
    function normalize(input) {
      const T = isObj(input) ? clone(input) : {};
      const links = (Array.isArray(T.links) ? T.links : []).filter(isObj).slice(0, 12).map((l, i) => ({
        id: sv(l.id, 16) || 'L' + i, name: sv(l.name, 24) || sv(l.id, 16) || 'L' + i, x: Number(l.x) || 0, y: Number(l.y) || 0, p2p: !!l.p2p
      }));
      const lids = new Set(links.map(l => l.id));
      const devices = (Array.isArray(T.devices) ? T.devices : []).filter(isObj).slice(0, 16).map((d, di) => {
        const type = DTYPES.includes(d.type) ? d.type : 'pc';
        const ifs = (Array.isArray(d.ifaces) ? d.ifaces : []).filter(isObj).slice(0, type === 'router' ? 4 : 1).map((f, fi) => {
          const mp = parseMac(f.mac);
          const o = {
            id: sv(f.id, 12) || 'eth' + fi, name: sv(f.name, 24) || sv(f.id, 12) || 'eth' + fi,
            mac: mp.ok ? mp.b : [0x02, 0, 0, 0, di, fi], link: lids.has(f.link) ? f.link : null, up: f.up !== false,
            addr: sv(f.addr, 64), len: sv(f.len, 8), t: Number.isInteger(f.t) && f.t >= 0 && f.t <= 1e6 ? f.t : 0
          };
          if (type === 'router') { o.ll = sv(f.ll, 64); o.ra = f.ra === true; }
          else { o.mode = f.mode === 'static' ? 'static' : 'slaac'; o.gw = sv(f.gw, 64); }
          return o;
        });
        const o = { id: sv(d.id, 16) || 'D' + di, name: sv(d.name, 24) || sv(d.id, 16) || 'D' + di, type, os: d.os === 'linux' ? 'linux' : type === 'router' ? 'ios' : 'win',
          x: Number(d.x) || 0, y: Number(d.y) || 0, ifaces: ifs };
        if (type === 'router') o.routes = (Array.isArray(d.routes) ? d.routes : []).filter(isObj).slice(0, 16).map(r => ({ prefix: sv(r.prefix, 70), via: sv(r.via, 64), iface: sv(r.iface, 16) }));
        return o;
      });
      return { links, devices };
    }

    function create(input) {
      const topo = normalize(input);
      const DEV = {}, IF = [], onLink = {};
      topo.links.forEach(l => { onLink[l.id] = []; });
      topo.devices.forEach((d, di) => {
        DEV[d.id] = d; d.idx = di;
        d.ifaces.forEach((f, fi) => {
          f.dev = d; f.fi = fi; f.notes = []; f.addrs = []; f.onlink = []; f.gwInfo = null; f.raPrefixes = []; f.v6off = false;
          f.active = !!f.link && f.up;
          if (!f.active) f.notes.push('down');
          IF.push(f); if (f.link) onLink[f.link].push(f);
        });
      });
      const order = (a, b) => (a.f.t - b.f.t) || (a.f.dev.idx - b.f.dev.idx) || (a.f.fi - b.f.fi);
      const runDad = list => {   // list of { f, a } candidate addresses; earliest keeps each address per link
        const groups = {};
        list.forEach(x => { const k = x.f.link + '|' + key(x.a.w); (groups[k] = groups[k] || []).push(x); });
        Object.values(groups).forEach(g => { g.sort(order); g.slice(1).forEach(x => { x.a.state = 'duplicate'; }); });
      };
      // 1. link-local addresses
      const llc = [];
      IF.forEach(f => {
        if (!f.active) return;
        let w = linkLocal(f.mac), manual = false;
        if (f.dev.type === 'router' && f.ll) {
          const p = parse(f.ll);
          if (p.ok && typeOf(p.w) === 'link-local') { w = p.w; manual = true; } else f.notes.push('ll_bad');
        }
        const a = { w, len: 64, origin: 'link-local', manual, state: 'preferred' };
        f.addrs.push(a); f.llA = a; llc.push({ f, a });
      });
      runDad(llc);
      IF.forEach(f => { if (f.llA && f.llA.state === 'duplicate') { f.v6off = true; f.notes.push('dad_ll'); } });
      const usable = f => f.active && !f.v6off;
      // 2. static global addresses (routers, hosts in static mode)
      const stc = [];
      IF.forEach(f => {
        if (!usable(f)) return;
        const isStatic = f.dev.type === 'router' || f.mode === 'static';
        if (!isStatic || !f.addr) return;
        const p = parse(f.addr), len = parseLen(f.len);
        if (!p.ok) { f.notes.push('bad_addr'); f.addrErr = p.err; return; }
        if (!isUnicastGlobal(p.w)) { f.notes.push('addr_type'); return; }
        if (len === null || len === 0) { f.notes.push('bad_len'); return; }
        if (f.dev.type !== 'router' && len !== 64) f.notes.push('len_not64');
        const a = { w: p.w, len, origin: 'static', state: 'preferred' };
        f.addrs.push(a); stc.push({ f, a });
      });
      runDad(stc);
      // 3. router advertisements
      IF.forEach(f => {
        if (f.dev.type !== 'router' || !usable(f) || !f.ra) return;
        f.raPrefixes = f.addrs.filter(a => a.origin === 'static' && a.state === 'preferred').map(a => ({ w: network(a.w, a.len), len: a.len }));
      });
      // 4. hosts: SLAAC / static on-link + gateway
      const slc = [];
      IF.forEach(f => {
        if (f.dev.type === 'router' || !usable(f)) return;
        if (f.mode === 'slaac') {
          const ras = onLink[f.link].filter(r => r !== f && r.dev.type === 'router' && usable(r) && r.ra);
          if (!ras.length) { f.notes.push('no_ra'); return; }
          f.gwInfo = { w: ras[0].llA.w, src: 'ra', router: ras[0] };
          const seen = {};
          ras.forEach(r => r.raPrefixes.forEach(px => {
            const k = key(px.w) + '/' + px.len; if (seen[k]) return; seen[k] = 1;
            f.onlink.push({ w: px.w, len: px.len, src: 'ra' });
            if (px.len !== 64) { if (!f.notes.includes('ra_len')) f.notes.push('ra_len'); return; }
            const a = { w: px.w.slice(0, 4).concat(eui64(f.mac)), len: 64, origin: 'slaac', state: 'preferred' };
            f.addrs.push(a); slc.push({ f, a });
          }));
        } else {
          f.addrs.filter(a => a.origin === 'static' && a.state === 'preferred').forEach(a => f.onlink.push({ w: network(a.w, a.len), len: a.len, src: 'static' }));
          if (f.gw) {
            const p = parse(f.gw, { zone: true });
            if (p.ok && typeOf(p.w) !== 'multicast' && typeOf(p.w) !== 'unspecified') f.gwInfo = { w: p.w, src: 'static' };
            else f.notes.push('bad_gw');
          }
        }
      });
      // SLAAC addresses lose DAD against any address already on the link
      slc.forEach(x => {
        const taken = onLink[x.f.link].some(o => o !== x.f && usable(o) && o.addrs.some(b => b !== x.a && b.state === 'preferred' && b.origin !== 'slaac' && eq(b.w, x.a.w)));
        if (taken) x.a.state = 'duplicate';
      });
      runDad(slc.filter(x => x.a.state === 'preferred'));
      IF.forEach(f => { if (f.addrs.some(a => a.state === 'duplicate' && a.origin !== 'link-local')) f.notes.push('dad'); });

      // router routing tables
      const RT = {};
      topo.devices.forEach(d => {
        if (d.type !== 'router') return;
        const rt = [];
        d.ifaces.forEach(f => {
          if (!usable(f)) return;
          f.addrs.filter(a => a.origin === 'static' && a.state === 'preferred').forEach(a => {
            rt.push({ type: 'C', w: network(a.w, a.len), len: a.len, iface: f, nh: null, valid: true });
          });
        });
        const conn = rt.slice();
        d.routes.forEach((r, ri) => {
          const e = { type: 'S', idx: ri, raw: r, valid: false, why: '' };
          const c = parseCidr(r.prefix);
          if (!c.ok) { e.why = 'prefix ไม่ถูกต้อง: ' + c.err; rt.push(e); return; }
          e.w = c.w; e.len = c.len;
          const via = parse(r.via, { zone: true });
          if (!via.ok) { e.why = 'next hop ไม่ถูกต้อง: ' + via.err; rt.push(e); return; }
          e.nh = via.w;
          const ifName = (r.iface || via.zone || '').toLowerCase();
          const fi = ifName ? d.ifaces.find(f => f.id.toLowerCase() === ifName || f.name.toLowerCase() === ifName) : null;
          if (ifName && !fi) { e.why = `ไม่มี interface ชื่อ ${r.iface || via.zone} บน ${d.name}`; rt.push(e); return; }
          if (d.ifaces.some(f => f.addrs.some(a => eq(a.w, via.w)))) { e.why = 'next hop เป็น address ของ router ตัวนี้เอง'; rt.push(e); return; }
          if (typeOf(via.w) === 'link-local') {
            if (!fi) { e.why = 'next hop เป็น link-local ต้องระบุ interface ขาออกด้วย (link-local ซ้ำกันได้ในต่างลิงก์)'; rt.push(e); return; }
            if (!usable(fi)) { e.why = `interface ${fi.name} ใช้งานไม่ได้`; rt.push(e); return; }
            e.iface = fi;
          } else if (isUnicastGlobal(via.w)) {
            const hit = lpm(conn, via.w);
            if (!hit) { e.why = 'next hop ไม่อยู่ในวงที่ต่อตรงกับ router ตัวนี้'; rt.push(e); return; }
            if (fi && hit.iface !== fi) { e.why = `next hop ไม่ได้อยู่ฝั่ง interface ${fi.name}`; rt.push(e); return; }
            e.iface = hit.iface;
          } else { e.why = 'next hop ต้องเป็น link-local หรือ global unicast ของ router ข้างเคียง'; rt.push(e); return; }
          e.valid = true; rt.push(e);
        });
        RT[d.id] = rt;
      });
      function lpm(list, w) {
        let best = null;
        list.forEach(r => { if (r.valid && inPrefix(w, r.w, r.len) && (!best || r.len > best.len || (r.len === best.len && r.type === 'C' && best.type !== 'C'))) best = r; });
        return best;
      }

      /* ---- neighbor caches (learned by pings on this instance) */
      const NC = {};
      const learn = (dev, f, w, mac, state, router) => {
        const list = NC[dev.id] = NC[dev.id] || [];
        const i = list.findIndex(e => e.iface === f.id && eq(e.w, w));
        const e = { w, mac, state, iface: f.id, router: !!router };
        if (i >= 0) { if (list[i].state === 'REACHABLE' && state === 'STALE') return; list[i] = e; } else list.push(e);
      };
      const owner = (linkId, w) => (onLink[linkId] || []).find(o => usable(o) && o.addrs.some(a => a.state === 'preferred' && eq(a.w, w))) || null;
      const ownsDev = (d, w) => d.ifaces.find(f => usable(f) && f.addrs.some(a => a.state === 'preferred' && eq(a.w, w))) || null;
      const C = w => compress(w);

      // one-way delivery from device `start` (source address srcW) to dstW; trace pushed into tr
      function forward(start, srcW, dstW, tr, dir, outIf) {
        let cur = start, hops = 0;
        const path = [cur.id];
        for (;;) {
          if (ownsDev(cur, dstW)) return { ok: true, path, at: cur.id, hops };
          if (hops > 0 && cur.type !== 'router') return { ok: false, code: 'not_router', at: cur.id, path, hops };
          if (hops > 30) return { ok: false, code: 'hop_limit', at: cur.id, path, hops };
          let f = null, nh = null, viaGw = false, onp = null;
          if (cur.type !== 'router') {
            f = cur.ifaces.find(usable);
            if (!f) return { ok: false, code: 'iface_down', at: cur.id, path, hops };
            if (typeOf(dstW) === 'link-local') nh = dstW;
            else {
              onp = f.onlink.filter(p => inPrefix(dstW, p.w, p.len)).sort((a, b) => b.len - a.len)[0] || null;
              if (onp) nh = dstW;
              else if (f.gwInfo) {
                const g = f.gwInfo.w;
                if (typeOf(g) !== 'link-local' && !f.onlink.some(p => inPrefix(g, p.w, p.len))) return { ok: false, code: 'gw_not_onlink', at: cur.id, path, hops };
                nh = g; viaGw = true;
              } else return { ok: false, code: f.mode === 'slaac' && f.notes.includes('no_ra') ? 'no_ra' : 'no_gateway', at: cur.id, path, hops };
            }
          } else {
            if (typeOf(dstW) === 'link-local') {
              if (hops > 0 || !outIf || !usable(outIf)) return { ok: false, code: 'll_offlink', at: cur.id, path, hops };
              f = outIf; nh = dstW;
            } else {
            const r = lpm(RT[cur.id] || [], dstW);
            if (!r) return { ok: false, code: 'no_route', at: cur.id, path, hops };
            f = r.iface; nh = r.type === 'C' ? dstW : r.nh; viaGw = r.type !== 'C';
            }
          }
          // neighbor discovery on f.link for nh
          const o = owner(f.link, nh);
          const cached = (NC[cur.id] || []).find(e => e.iface === f.id && eq(e.w, nh) && e.state === 'REACHABLE');
          if (o && cached) tr.push({ k: 'nc', t: `${cur.name}: มี ${C(nh)} ใน neighbor cache แล้ว (MAC ${macStr(o.mac)}) ไม่ต้องส่ง NS` });
          else {
            tr.push({ k: 'ns', t: `NS  ${cur.name} → ${C(solicited(nh))} (solicited-node multicast): ใครใช้ ${C(nh)}?` });
            if (!o) {
              tr.push({ k: 'fail', t: `ไม่มี NA ตอบกลับจากลิงก์ ${f.link} (ส่ง NS ซ้ำ 3 ครั้ง)` });
              learn(cur, f, nh, null, 'INCOMPLETE');
              let code;
              if (typeOf(nh) === 'link-local' && !viaGw && cur.type !== 'router') code = 'll_offlink';
              else if (viaGw) code = cur.type === 'router' ? 'ndp_fail' : 'gw_unreachable';
              else code = onp && onp.len < 64 ? 'wrong_prefix' : 'ndp_fail';
              return { ok: false, code, at: cur.id, path, hops, nh: C(nh) };
            }
            tr.push({ k: 'na', t: `NA  ${o.dev.name} → ${cur.name}: ${C(nh)} อยู่ที่ MAC ${macStr(o.mac)}` });
            learn(cur, f, nh, macStr(o.mac), 'REACHABLE', o.dev.type === 'router');
            if (f.llA) learn(o.dev, o, f.llA.w, macStr(f.mac), 'STALE', cur.type === 'router');
          }
          if (viaGw && o.dev.type !== 'router') return { ok: false, code: cur.type === 'router' ? 'not_router' : 'gw_not_router', at: o.dev.id, path: path.concat(o.dev.id), hops };
          tr.push({ k: 'fwd', t: `${dir === 'back' ? 'Echo Reply' : 'Echo Request'}: ${cur.name} → ${o.dev.name} (ลิงก์ ${f.link})` });
          cur = o.dev; hops++; path.push(cur.id);
        }
      }

      function ping(srcId, target) {
        const tr = [];
        const d = DEV[srcId];
        const res = (o) => Object.assign({ ok: false, src: null, dst: null, path: [srcId], trace: tr, dir: 'go', at: srcId }, o, { text: REASON[o.code] || '' });
        if (!d) return res({ code: 'bad_target' });
        const p = parse(sv(target, 80), { zone: true });
        if (!p.ok) return Object.assign(res({ code: 'bad_target' }), { text: 'ปลายทางไม่ถูกต้อง: ' + p.err });
        const t = typeOf(p.w);
        if (t === 'loopback') return res({ ok: true, code: 'ok', src: '::1', dst: '::1' });
        if (t === 'multicast' || t === 'unspecified' || t === 'ipv4-mapped' || t === 'reserved') return res({ code: 'bad_target' });
        const f0 = d.type === 'router' ? (p.zone ? d.ifaces.find(f => f.id.toLowerCase() === p.zone.toLowerCase()) : null) || d.ifaces.find(usable) : d.ifaces[0];
        if (!f0 || !f0.active) return res({ code: 'iface_down' });
        if (f0.v6off) return res({ code: 'dad_ll' });
        if (ownsDev(d, p.w)) return res({ ok: true, code: 'ok', src: C(p.w), dst: C(p.w) });
        let srcW;
        if (t === 'link-local') srcW = f0.llA.w;
        else {
          const g = d.ifaces.filter(usable).flatMap(f => f.addrs.filter(a => a.origin !== 'link-local' && a.state === 'preferred'));
          const best = g.find(a => inPrefix(p.w, a.w, 64)) || g[0];
          if (!best) {
            const code = f0.notes.includes('dad') ? 'dad' : f0.notes.includes('ra_len') ? 'ra_len' : f0.notes.includes('no_ra') ? 'no_ra' : 'no_src';
            return res({ code });
          }
          srcW = best.w;
        }
        tr.push({ k: 'info', t: `ต้นทาง ${C(srcW)} → ปลายทาง ${C(p.w)}` });
        const go = forward(d, srcW, p.w, tr, 'go');
        if (!go.ok) return res({ code: go.code, at: go.at, path: go.path, src: C(srcW), dst: C(p.w), nh: go.nh });
        const td = DEV[go.at];
        tr.push({ k: 'ok', t: `${td.name} ได้รับ Echo Request แล้วส่ง Echo Reply กลับ` });
        const back = forward(td, p.w, srcW, tr, 'back', ownsDev(td, p.w));
        if (!back.ok) return res({ code: back.code, dir: 'back', at: back.at, path: go.path.concat(back.path.slice(1)), src: C(srcW), dst: C(p.w), reached: td.id });
        tr.push({ k: 'ok', t: `${d.name} ได้รับ Echo Reply` });
        return res({ ok: true, code: 'ok', path: go.path, src: C(srcW), dst: C(p.w), reached: td.id, hops: go.hops });
      }

      function primary(id) {
        const d = DEV[id]; if (!d) return null;
        for (const f of d.ifaces) { if (!usable(f)) continue; const a = f.addrs.find(x => x.origin !== 'link-local' && x.state === 'preferred'); if (a) return C(a.w); }
        return null;
      }
      function matrix(ids) {
        const out = [];
        ids.forEach(a => ids.forEach(b => {
          if (a === b) return;
          const tgt = primary(b);
          if (!tgt) { out.push({ from: a, to: b, target: null, ok: false, code: 'target_no_addr', text: REASON.target_no_addr }); return; }
          const r = ping(a, tgt);
          out.push({ from: a, to: b, target: tgt, ok: r.ok, code: r.code, text: r.text, dir: r.dir, at: r.at });
        }));
        return out;
      }

      /* ---- views */
      function ifState(f) {
        return {
          id: f.id, name: f.name, mac: macStr(f.mac), link: f.link, active: f.active, v6off: f.v6off, mode: f.mode, ra: !!f.ra,
          addrs: f.addrs.map(a => ({ addr: C(a.w), len: a.len, origin: a.origin, state: a.state, manual: !!a.manual })),
          ll: f.llA ? C(f.llA.w) : null, gw: f.gwInfo ? { addr: C(f.gwInfo.w), src: f.gwInfo.src } : null,
          onlink: f.onlink.map(p => ({ prefix: C(p.w) + '/' + p.len, src: p.src })),
          raPrefixes: f.raPrefixes.map(p => C(p.w) + '/' + p.len),
          notes: f.notes.map(n => ({ code: n, text: n === 'bad_addr' && f.addrErr ? NOTE.bad_addr + ': ' + f.addrErr : NOTE[n] }))
        };
      }
      function iface(id, ifId) {
        const d = DEV[id]; if (!d) return null;
        const f = ifId ? d.ifaces.find(x => x.id === ifId) : d.ifaces[0];
        return f ? ifState(f) : null;
      }
      function routes(id) {
        const d = DEV[id]; if (!d) return [];
        if (d.type === 'router') return (RT[id] || []).map(r => ({ type: r.type, prefix: r.w ? C(r.w) + '/' + r.len : sv(r.raw && r.raw.prefix), via: r.nh ? C(r.nh) : null,
          iface: r.iface ? r.iface.id : (r.raw && r.raw.iface) || null, valid: r.valid, why: r.why || '' }));
        const f = d.ifaces[0]; if (!f || !usable(f)) return [];
        const out = f.onlink.map(p => ({ type: 'C', prefix: C(p.w) + '/' + p.len, via: null, iface: f.id, valid: true, src: p.src }));
        out.push({ type: 'C', prefix: 'fe80::/64', via: null, iface: f.id, valid: true });
        if (f.gwInfo) out.push({ type: f.gwInfo.src === 'ra' ? 'RA' : 'S', prefix: '::/0', via: C(f.gwInfo.w), iface: f.id, valid: true });
        return out;
      }
      const neighbors = id => (NC[id] || []).map(e => ({ addr: C(e.w), mac: e.mac, state: e.state, iface: e.iface, router: e.router }));
      function importNeighbors(old) {   // keep entries that are still true in this topology
        if (!isObj(old)) return;
        Object.keys(old).forEach(id => {
          const d = DEV[id]; if (!d || !Array.isArray(old[id])) return;
          old[id].forEach(e => {
            const f = d.ifaces.find(x => x.id === e.iface); const p = parse(e.addr);
            if (!f || !usable(f) || !p.ok) return;
            const o = owner(f.link, p.w);
            if (e.state === 'INCOMPLETE') { if (!o) learn(d, f, p.w, null, 'INCOMPLETE'); return; }
            if (o && macStr(o.mac) === e.mac) learn(d, f, p.w, e.mac, e.state, e.router);
          });
        });
      }
      const exportNeighbors = () => { const o = {}; Object.keys(NC).forEach(id => { o[id] = neighbors(id); }); return o; };

      function show(id) {
        const d = DEV[id]; if (!d) return { cmd: '', lines: [] };
        const L = [];
        if (d.type === 'router') {
          d.ifaces.forEach(f => {
            L.push(`GigabitEthernet${f.id.replace(/^g/i, '')}  [${f.active ? 'up/up' : 'administratively down/down'}]`);
            if (!f.active) { L.push('    unassigned'); return; }
            f.addrs.forEach(a => L.push('    ' + C(a.w).toUpperCase() + (a.origin === 'static' ? '/' + a.len : '') + (a.state === 'duplicate' ? ' [DUP]' : '')));
            L.push('    RA: ' + (f.ra && f.raPrefixes.length ? 'ส่ง (prefix ' + f.raPrefixes.map(p => C(p.w) + '/' + p.len).join(', ') + ')' : f.ra ? 'เปิด แต่ยังไม่มี prefix ให้ประกาศ' : 'ปิด (ipv6 nd ra suppress)'));
          });
          return { cmd: 'R# show ipv6 interface brief', lines: L };
        }
        const f = d.ifaces[0];
        if (d.os === 'linux') {
          L.push(`2: eth0: <BROADCAST,MULTICAST${f && f.active ? ',UP,LOWER_UP' : ''}> mtu 1500 state ${f && f.active ? 'UP' : 'DOWN'}`);
          L.push(`    link/ether ${f ? macStr(f.mac) : ''}`);
          if (f && f.active) {
            f.addrs.filter(a => a.origin !== 'link-local').forEach(a => L.push(`    inet6 ${C(a.w)}/${a.len} scope global${a.origin === 'slaac' ? ' dynamic mngtmpaddr' : ''}${a.state === 'duplicate' ? ' tentative dadfailed' : ''}`));
            if (f.llA) L.push(`    inet6 ${C(f.llA.w)}/64 scope link${f.llA.state === 'duplicate' ? ' tentative dadfailed' : ''}`);
            const gw = f.gwInfo;
            L.push('', '$ ip -6 route');
            routes(id).forEach(r => L.push(r.prefix === '::/0' ? `default via ${r.via} dev eth0 proto ${r.type === 'RA' ? 'ra' : 'static'} metric 1024` : `${r.prefix} dev eth0 proto ${r.src === 'ra' ? 'ra' : 'kernel'} metric 256`));
            if (!gw) L.push('(ไม่มี default route)');
          }
          return { cmd: '$ ip -6 addr show dev eth0', lines: L };
        }
        L.push('Ethernet adapter Ethernet:', '');
        if (!f || !f.active) { L.push('   Media State . . . . . . . . . . . : Media disconnected'); return { cmd: 'C:\\> ipconfig', lines: L }; }
        const z = '%' + (11 + d.idx);
        f.addrs.filter(a => a.origin !== 'link-local').forEach(a => L.push(`   IPv6 Address. . . . . . . . . . . : ${C(a.w)}${a.state === 'duplicate' ? '(Duplicate)' : '(Preferred)'}`));
        if (f.llA) L.push(`   Link-local IPv6 Address . . . . . : ${C(f.llA.w)}${z}${f.llA.state === 'duplicate' ? '(Duplicate)' : ''}`);
        L.push(`   Default Gateway . . . . . . . . . : ${f.gwInfo ? C(f.gwInfo.w) + (typeOf(f.gwInfo.w) === 'link-local' ? z : '') : ''}`);
        L.push('', `   Physical Address. . . . . . . . . : ${macStr(f.mac, '-').toUpperCase()}`);
        L.push(`   การกำหนด address : ${f.mode === 'static' ? 'Static (ตั้งเอง, ไม่รับ RA)' : 'SLAAC (อัตโนมัติจาก RA)'}${f.addrs.some(a => a.origin === 'static') ? ' · prefix length /' + f.addrs.find(a => a.origin === 'static').len : ''}`);
        return { cmd: 'C:\\> ipconfig', lines: L };
      }
      function pingOut(d, target, r) {
        const lin = d && d.os === 'linux';
        const tgt = sv(target, 60).trim();
        const L = [lin ? `$ ping6 -c 4 ${tgt}` : `C:\\> ping -6 ${tgt}`];
        if (r.code === 'bad_target' && !r.dst) { L.push(lin ? `ping6: ${tgt}: Name or service not known` : `Ping request could not find host ${tgt}. Please check the name and try again.`); return L; }
        const dst = r.dst || tgt;
        if (!lin) L.push('', `Pinging ${dst} with 32 bytes of data:`);
        else L.push(`PING ${dst}(${dst}) 56 data bytes`);
        const at = DEV[r.at];
        const rAddr = at ? (primary(at.id) || (at.ifaces[0] && at.ifaces[0].llA ? C(at.ifaces[0].llA.w) : '')) : '';
        for (let i = 1; i <= 4; i++) {
          if (r.ok) L.push(lin ? `64 bytes from ${dst}: icmp_seq=${i} ttl=${64 - (r.hops ? r.hops - 1 : 0)} time=0.${4 + i} ms` : `Reply from ${dst}: time<1ms`);
          else if (['no_src', 'no_ra', 'ra_len', 'dad', 'dad_ll', 'iface_down', 'no_gateway', 'gw_not_onlink'].includes(r.code)) { L.push(lin ? 'connect: Network is unreachable' : 'PING: transmit failed. General failure.'); if (lin) break; }
          else if (r.dir === 'go' && ['ndp_fail', 'wrong_prefix', 'gw_unreachable', 'll_offlink'].includes(r.code)) L.push(lin ? `From ${r.at === d.id ? (r.src || '') : rAddr} icmp_seq=${i} Destination unreachable: Address unreachable` : `Reply from ${r.at === d.id ? (r.src || '') : rAddr}: Destination host unreachable.`);
          else if (r.dir === 'go' && r.code === 'no_route') L.push(lin ? `From ${rAddr} icmp_seq=${i} Destination unreachable: No route` : `Reply from ${rAddr}: Destination net unreachable.`);
          else L.push(lin ? `(icmp_seq=${i} ไม่มีคำตอบ)` : 'Request timed out.');
        }
        const okN = r.ok ? 4 : 0;
        L.push('', lin ? `4 packets transmitted, ${okN} received, ${100 - okN * 25}% packet loss` : `Ping statistics for ${dst}:`, lin ? '' : `    Packets: Sent = 4, Received = ${okN}, Lost = ${4 - okN} (${100 - okN * 25}% loss),`);
        return L.filter((x, i, a) => !(x === '' && i === a.length - 1));
      }
      function pingFull(srcId, target) { const r = ping(srcId, target); r.out = pingOut(DEV[srcId], target, r); return r; }

      return {
        topo, ping: pingFull, matrix, primary, iface, routes, neighbors, importNeighbors, exportNeighbors, show,
        hosts: () => topo.devices.filter(d => d.type !== 'router').map(d => d.id),
        dev: id => DEV[id] ? { id, name: DEV[id].name, type: DEV[id].type, os: DEV[id].os, ifaces: DEV[id].ifaces.map(f => f.id) } : null,
        dupCount: () => IF.reduce((n, f) => n + f.addrs.filter(a => a.state === 'duplicate').length, 0)
      };
    }

    /* ------------------------------------------------------------------ student edits (whitelist) */
    const HOST_F = ['mode', 'addr', 'len', 'gw', 'up', 't'], ROUTER_F = ['addr', 'len', 'll', 'ra', 'up', 't'];
    function applyConfig(base, cfg) {
      const topo = clone(base);
      if (!isObj(cfg)) return topo;
      topo.devices.forEach(d => {
        const c = cfg[d.id]; if (!isObj(c)) return;
        const F = d.type === 'router' ? ROUTER_F : HOST_F;
        if (isObj(c.ifaces)) d.ifaces.forEach(f => {
          const ci = c.ifaces[f.id]; if (!isObj(ci)) return;
          F.forEach(k => {
            if (!(k in ci)) return;
            const v = ci[k];
            if (k === 'mode') f.mode = v === 'static' ? 'static' : 'slaac';
            else if (k === 'ra' || k === 'up') f[k] = v === true;
            else if (k === 't') f.t = Number.isInteger(v) && v >= 0 && v <= 1e6 ? v : 0;
            else f[k] = sv(v, k === 'len' ? 8 : 64);
          });
        });
        if (d.type === 'router' && Array.isArray(c.routes)) d.routes = c.routes.slice(0, 16).filter(isObj).map(r => ({ prefix: sv(r.prefix, 70), via: sv(r.via, 64), iface: sv(r.iface, 16) }));
      });
      return topo;
    }

    /* ------------------------------------------------------------------ mission topologies */
    const H = (id, name, type, os, link, mac, x, y, extra) => ({ id, name, type, os, x, y, ifaces: [Object.assign({ id: 'eth0', link, mac, mode: 'slaac' }, extra || {})] });
    const MT = {
      v3: {
        links: [{ id: 'LAN1', name: 'LAN1', x: 165, y: 150 }, { id: 'LAN2', name: 'LAN2', x: 475, y: 150 }],
        devices: [
          { id: 'R1', name: 'R1', type: 'router', x: 320, y: 50, ifaces: [
            { id: 'g0/0', name: 'G0/0', link: 'LAN1', mac: '00:1a:2b:10:00:01', addr: '', len: '', ra: false },
            { id: 'g0/1', name: 'G0/1', link: 'LAN2', mac: '00:1a:2b:10:00:02', addr: '', len: '', ra: false }], routes: [] },
          H('PC1', 'PC1', 'pc', 'win', 'LAN1', '00:14:22:a1:0b:11', 90, 255),
          H('PC2', 'PC2', 'pc', 'win', 'LAN1', '3c:52:82:4f:61:22', 240, 255),
          H('PC3', 'PC3', 'pc', 'win', 'LAN2', '00:50:56:c0:00:33', 400, 255),
          H('PC4', 'PC4', 'pc', 'linux', 'LAN2', 'b8:27:eb:12:34:44', 550, 255)
        ]
      },
      v4: {
        links: [{ id: 'LAN1', name: 'LAN1', x: 165, y: 160 }, { id: 'WAN', name: 'WAN', x: 320, y: 50, p2p: true }, { id: 'LAN2', name: 'LAN2', x: 475, y: 160 }],
        devices: [
          { id: 'R1', name: 'R1', type: 'router', x: 165, y: 50, ifaces: [
            { id: 'g0/0', name: 'G0/0', link: 'LAN1', mac: '00:1a:2b:20:00:01', addr: '2001:db8:1::1', len: '64', ll: 'fe80::1', ra: true },
            { id: 'g0/1', name: 'G0/1', link: 'WAN', mac: '00:1a:2b:20:00:02', addr: '2001:db8:ff::1', len: '64', ll: 'fe80::1', ra: false }], routes: [] },
          { id: 'R2', name: 'R2', type: 'router', x: 475, y: 50, ifaces: [
            { id: 'g0/0', name: 'G0/0', link: 'LAN2', mac: '00:1a:2b:30:00:01', addr: '2001:db8:2::1', len: '64', ll: 'fe80::2', ra: true },
            { id: 'g0/1', name: 'G0/1', link: 'WAN', mac: '00:1a:2b:30:00:02', addr: '2001:db8:ff::2', len: '64', ll: 'fe80::2', ra: false }], routes: [] },
          H('PC1', 'PC1', 'pc', 'win', 'LAN1', '00:14:22:b2:0c:11', 90, 260),
          H('SRV1', 'SRV1', 'server', 'linux', 'LAN1', '52:54:00:ab:10:01', 240, 260, { mode: 'static', addr: '', len: '', gw: '' }),
          H('PC2', 'PC2', 'pc', 'win', 'LAN2', '00:50:56:c0:22:22', 400, 260),
          H('SRV2', 'SRV2', 'server', 'linux', 'LAN2', '52:54:00:ab:20:02', 550, 260, { mode: 'static', addr: '', len: '', gw: '' })
        ]
      },
      v5: {
        links: [{ id: 'LAN1', name: 'LAN1', x: 165, y: 150 }, { id: 'LAN2', name: 'LAN2', x: 470, y: 150 }],
        devices: [
          { id: 'R1', name: 'R1', type: 'router', x: 320, y: 50, ifaces: [
            { id: 'g0/0', name: 'G0/0', link: 'LAN1', mac: '00:1a:2b:50:00:01', addr: '2001:db8:acad:1::1', len: '64', ll: 'fe80::1', ra: false },
            { id: 'g0/1', name: 'G0/1', link: 'LAN2', mac: '00:1a:2b:50:00:02', addr: '2001:db8:acad:2::1', len: '64', ll: 'fe80::1', ra: true }], routes: [] },
          H('PC1', 'PC1', 'pc', 'win', 'LAN1', '00:14:22:c3:0d:11', 90, 255),
          H('PC2', 'PC2', 'pc', 'win', 'LAN1', '00:14:22:c3:0d:22', 240, 255, { mode: 'static', addr: '2001:db8:acad:1::20', len: '48', gw: 'fe80::1' }),
          H('PC3', 'PC3', 'pc', 'win', 'LAN2', '00:50:56:c0:55:33', 370, 255, { mode: 'static', addr: '2001:db8:acad:2::30', len: '64', gw: '2001:db8:acad:1::1' }),
          H('SRV', 'SRV', 'server', 'linux', 'LAN2', '52:54:00:ab:50:10', 470, 255, { mode: 'static', addr: '2001:db8:acad:2::10', len: '64', gw: 'fe80::1', t: 1 }),
          H('PC4', 'PC4', 'pc', 'win', 'LAN2', '00:50:56:c0:55:44', 570, 255, { mode: 'static', addr: '2001:db8:acad:2::10', len: '64', gw: 'fe80::1', t: 2 })
        ]
      }
    };
    // v2: the generated MAC of PC-A goes into a small LAN to verify its link-local with ping
    function v2Topo(problem) {
      const mac = problem && Array.isArray(problem.macs) && parseMac(problem.macs[0]).ok ? problem.macs[0] : '00:00:00:00:00:01';
      return {
        links: [{ id: 'LAN1', name: 'LAN1', x: 320, y: 70 }],
        devices: [H('PCA', 'PC-A', 'pc', 'win', 'LAN1', mac, 170, 200), H('PCB', 'PC-B', 'pc', 'linux', 'LAN1', '00:0c:29:5e:7a:01', 470, 200)]
      };
    }

    return {
      parse, compress, expand, typeOf, TYPE_TH, network, inPrefix, parseLen, parseCidr, parseMac, macStr, eui64, linkLocal, solicited,
      zeroRun, canonIssues, expandIssues, eq, isUnicastGlobal, create, applyConfig, MT, v2Topo, REASON, NOTE,
      fmtW: w => compress(w)
    };
  })();

  if (typeof module === 'object' && module.exports) { module.exports = V6; return; }
  /* ====================================================================== browser UI */
  const CSS = `
.nls-ipv6{--nls-ipv6-mono:"JetBrains Mono",Consolas,monospace;color:var(--ink);font-family:inherit;max-width:1100px;margin:0 auto;min-width:0}
.nls-ipv6 *,.nls-ipv6 *::before,.nls-ipv6 *::after{box-sizing:border-box}
.nls-ipv6 h2{font-size:24px;line-height:1.25;margin:0 0 6px}
.nls-ipv6 h3{font-size:18px;margin:0 0 8px;line-height:1.35}
.nls-ipv6 h4{font-size:16px;margin:0 0 6px}
.nls-ipv6 p{margin:0 0 8px}
.nls-ipv6-muted{color:var(--muted);font-size:15px}
.nls-ipv6-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 14px;min-width:0}
.nls-ipv6-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;font-size:15px;cursor:pointer;line-height:1.3;min-height:44px}
.nls-ipv6-btn.nls-ipv6-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.nls-ipv6-btn.nls-ipv6-sm{min-height:44px;padding:4px 10px;font-size:14px}
.nls-ipv6-btn[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:var(--on-accent)}
.nls-ipv6-btn:disabled{opacity:.45;cursor:default}
.nls-ipv6 :focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.nls-ipv6-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nls-ipv6-howto summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
.nls-ipv6-howto ol{margin:4px 0 0;padding-left:22px;font-size:15px}
.nls-ipv6-missions{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin:0 0 14px}
.nls-ipv6-mbtn{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer;min-width:0;min-height:48px}
.nls-ipv6-mbtn b{font-size:15px;line-height:1.3}
.nls-ipv6-mbtn span{font-size:13px;color:var(--muted)}
.nls-ipv6-mbtn.nls-ipv6-on{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-ipv6-mbtn .nls-ipv6-best{color:var(--ok);font-weight:600}
.nls-ipv6-lvl{font:600 11px var(--nls-ipv6-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.nls-ipv6-tag{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:1px 10px;font-size:13px;color:var(--muted);margin:0 6px 6px 0}
.nls-ipv6-hints{margin:8px 0 0;padding-left:22px;font-size:15px}
.nls-ipv6-mono{font-family:var(--nls-ipv6-mono);overflow-wrap:anywhere;word-break:break-word}
.nls-ipv6-addr{font:600 17px var(--nls-ipv6-mono);overflow-wrap:anywhere;background:var(--field);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:4px 0 8px}
.nls-ipv6-items{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
@media (min-width:900px){.nls-ipv6-items{grid-template-columns:repeat(2,minmax(0,1fr))}}
.nls-ipv6-item{border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-width:0;background:var(--panel)}
.nls-ipv6-item.nls-ipv6-good{border-color:var(--ok);box-shadow:inset 4px 0 0 var(--ok)}
.nls-ipv6-item.nls-ipv6-wrong{border-color:var(--bad);box-shadow:inset 4px 0 0 var(--bad)}
.nls-ipv6-f{display:flex;flex-direction:column;gap:3px;margin:0 0 8px;min-width:0}
.nls-ipv6-f>span{font-size:14px;font-weight:600}
.nls-ipv6-f small{font-size:13px;color:var(--muted)}
.nls-ipv6 input[type=text],.nls-ipv6 select{font:inherit;font-size:16px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:44px;width:100%;min-width:0}
.nls-ipv6 input[type=text]{font-family:var(--nls-ipv6-mono);font-size:15px}
.nls-ipv6 input[type=text]:disabled{opacity:.6}
.nls-ipv6-2col{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:8px}
.nls-ipv6-check{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-weight:600;cursor:pointer}
.nls-ipv6-check input{width:22px;height:22px;accent-color:var(--blue)}
.nls-ipv6-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:0 0 8px}
.nls-ipv6-seg label{display:inline-flex;align-items:center;gap:6px;padding:0 14px;min-height:44px;cursor:pointer;font-weight:600}
.nls-ipv6-seg label+label{border-left:1px solid var(--line)}
.nls-ipv6-seg input{accent-color:var(--blue);width:18px;height:18px}
.nls-ipv6-seg label:has(input:checked){background:color-mix(in srgb,var(--blue) 14%,var(--panel))}
.nls-ipv6-lab{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:start}
@media (min-width:900px){.nls-ipv6-lab{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.nls-ipv6-lab>.nls-ipv6-card{margin:0}
.nls-ipv6-svg{display:block;width:100%;height:auto;max-height:360px}
.nls-ipv6-svg text{font-family:inherit;fill:var(--ink)}
.nls-ipv6-svg .nls-ipv6-wire{stroke:var(--muted);stroke-width:2.5}
.nls-ipv6-svg .nls-ipv6-wire.nls-ipv6-hot{stroke:var(--ok);stroke-width:4}
.nls-ipv6-svg .nls-ipv6-wire.nls-ipv6-cold{stroke:var(--bad);stroke-width:4;stroke-dasharray:6 4}
.nls-ipv6-svg .nls-ipv6-sw{fill:var(--field);stroke:var(--ink);stroke-width:1.5}
.nls-ipv6-svg .nls-ipv6-body{fill:var(--panel);stroke:var(--ink);stroke-width:1.8}
.nls-ipv6-svg .nls-ipv6-node{cursor:pointer;outline:none}
.nls-ipv6-svg .nls-ipv6-node:focus-visible .nls-ipv6-ring,.nls-ipv6-svg .nls-ipv6-node.nls-ipv6-sel .nls-ipv6-ring{stroke:var(--blue);stroke-width:3;fill:color-mix(in srgb,var(--blue) 10%,transparent)}
.nls-ipv6-svg .nls-ipv6-ring{fill:transparent;stroke:transparent}
.nls-ipv6-svg .nls-ipv6-badge{fill:var(--bad)}
.nls-ipv6-svg .nls-ipv6-badget{fill:var(--panel);font-weight:700}
.nls-ipv6-devs{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;margin-top:8px}
.nls-ipv6-dev{display:flex;flex-direction:column;align-items:flex-start;gap:1px;text-align:left;background:var(--field);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font:inherit;cursor:pointer;min-height:48px;min-width:0}
.nls-ipv6-dev b{font-size:15px}
.nls-ipv6-dev span{font:12px var(--nls-ipv6-mono);color:var(--muted);overflow-wrap:anywhere;max-width:100%}
.nls-ipv6-dev[aria-pressed="true"]{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue)}
.nls-ipv6-dev .nls-ipv6-warn{color:var(--bad);font-family:inherit;font-size:12px;font-weight:600}
.nls-ipv6-ifbox{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:0 0 10px;min-width:0}
.nls-ipv6-ifbox legend{font-weight:700;padding:0 4px}
.nls-ipv6-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 10px;font-size:14px;margin:0 0 8px}
.nls-ipv6-kv dt{color:var(--muted)}
.nls-ipv6-kv dd{margin:0;font-family:var(--nls-ipv6-mono);overflow-wrap:anywhere}
.nls-ipv6-notes{list-style:none;margin:0;padding:0;font-size:14px}
.nls-ipv6-notes li{color:var(--bad);margin:2px 0}
.nls-ipv6-notes li.nls-ipv6-info{color:var(--muted)}
.nls-ipv6-route{border-top:1px dashed var(--line);padding:8px 0 4px}
.nls-ipv6-route-g{display:grid;grid-template-columns:minmax(0,1fr);gap:6px}
@media (min-width:560px){.nls-ipv6-route-g{grid-template-columns:minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,.8fr) auto;align-items:end}}
.nls-ipv6-route-g .nls-ipv6-f{margin:0}
.nls-ipv6-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.nls-ipv6-term{background:var(--term-bg);color:var(--term-ink);border-radius:8px;padding:10px 12px;font:13px/1.5 var(--nls-ipv6-mono);white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 8px;min-height:60px;max-height:420px;overflow:auto}
.nls-ipv6-term b{color:var(--term-ink)}
.nls-ipv6-term .nls-ipv6-dim{color:var(--term-dim)}
.nls-ipv6-table{width:100%;border-collapse:collapse;font-size:14px}
.nls-ipv6-table th,.nls-ipv6-table td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}
.nls-ipv6-table td{font-family:var(--nls-ipv6-mono);overflow-wrap:anywhere}
.nls-ipv6-tablewrap{overflow-x:auto;max-width:100%}
.nls-ipv6-mx td,.nls-ipv6-mx th{text-align:center;font-family:inherit;min-width:44px}
.nls-ipv6-mx th[scope=row]{text-align:left}
.nls-ipv6-yes{color:var(--ok);font-weight:700}
.nls-ipv6-no{color:var(--bad);font-weight:700}
.nls-ipv6-trace{margin:6px 0 8px;padding-left:22px;font-size:14px}
.nls-ipv6-trace li{margin:2px 0;overflow-wrap:anywhere}
.nls-ipv6-trace .nls-ipv6-k{display:inline-block;min-width:34px;font:700 12px var(--nls-ipv6-mono);border-radius:4px;padding:0 4px;margin-right:4px;background:var(--field);border:1px solid var(--line)}
.nls-ipv6-reason{border-left:5px solid var(--line);background:var(--field);border-radius:8px;padding:8px 10px;margin:6px 0;font-size:15px}
.nls-ipv6-reason.nls-ipv6-good{border-left-color:var(--ok)}
.nls-ipv6-reason.nls-ipv6-wrong{border-left-color:var(--bad)}
.nls-ipv6-fills{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.nls-ipv6-ok{color:var(--ok)}
.nls-ipv6-bad{color:var(--bad)}
.nls-ipv6-score{font-size:22px;font-weight:700;margin:6px 0}
.nls-ipv6-fb{margin:6px 0 0;padding-left:22px}
.nls-ipv6-fb li{margin:3px 0}
.nls-ipv6-checks{list-style:none;padding:0;margin:8px 0;font-size:15px}
.nls-ipv6-checks li{padding:2px 0}
.nls-ipv6-stale{font-size:13px;color:var(--muted);font-style:italic}
.nls-ipv6-note{border-left:4px solid var(--orange);background:var(--panel);padding:8px 10px;border-radius:8px;margin:8px 0;font-size:15px}
.nls-ipv6-tool{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
@media (min-width:900px){.nls-ipv6-tool{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.nls-ipv6-tool>.nls-ipv6-card{margin:0}
.nls-ipv6-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:520px){.nls-ipv6-svg text{font-size:21px}.nls-ipv6-card{padding:12px 10px}.nls-ipv6 h2{font-size:20px}.nls-ipv6-addr{font-size:15px}.nls-ipv6-devs{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
`;

  const DRAFT_KEY = 'nl-sim-ipv6-draft';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LAB_TH = { guided: 'ฝึกตามขั้นตอน (Guided Lab)', independent: 'ฝึกเอง (Independent Lab)', troubleshooting: 'ฝึกแก้ปัญหา (Troubleshooting)' };
  const LVL_TH = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };
  const TYPE_OPTS = [['', '— เลือกชนิด —'], ['global', 'Global unicast (2000::/3)'], ['link-local', 'Link-local (fe80::/10)'], ['unique-local', 'Unique local (fc00::/7)'],
    ['multicast', 'Multicast (ff00::/8)'], ['loopback', 'Loopback (::1)'], ['unspecified', 'Unspecified (::)']];
  const KIND = { ns: 'NS', na: 'NA', nc: 'NC', fwd: 'ICMP', ok: 'OK', fail: '!', info: 'i' };
  const ADDR_FIELDS = ['addr', 'len', 'mode', 'll'];

  function mount(root, ctx) {
    if (!document.getElementById('nls-ipv6-css')) {
      const st = document.createElement('style'); st.id = 'nls-ipv6-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    ctx = ctx || {};
    const missions = Array.isArray(ctx.missions) ? ctx.missions : [];
    const best = {};
    Object.keys(ctx.done || {}).forEach(k => { best[k] = Object.assign({}, ctx.done[k]); });
    let alive = true;
    const S = { mid: null, W: {}, tool: { addr: '2001:0db8:0000:0000:0000:ff00:0042:8329', len: '64', mac: '00:1a:2b:3c:4d:5e' }, nets: {} };
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d && d.v === 1 && d.W && typeof d.W === 'object') {
        Object.keys(d.W).forEach(k => {
          if (!missions.some(m => m.id === k)) return;
          const w = d.W[k] || {};
          S.W[k] = { cfg: w.cfg && typeof w.cfg === 'object' ? w.cfg : {}, problem: w.problem || null, token: typeof w.token === 'string' ? w.token : null,
            answers: w.answers && typeof w.answers === 'object' ? w.answers : {}, verify: typeof w.verify === 'string' ? w.verify : '', nc: w.nc && typeof w.nc === 'object' ? w.nc : null,
            graded: w.graded === true, pingedA: w.pingedA === true };
        });
        if (d.mid === null || missions.some(m => m.id === d.mid)) S.mid = d.mid;
      }
    } catch (e) { /* ignore broken drafts */ }
    if (ctx.initial && missions.some(m => m.id === ctx.initial)) S.mid = ctx.initial;
    else if (S.mid === undefined) S.mid = null;
    // 3.3 embedded mode (practical page): only the given mission, no mission list, no free IPv6 tools
    const EMB = !!ctx.embedded && missions.length > 0;
    if (EMB) S.mid = missions.some(m => m.id === ctx.initial) ? ctx.initial : missions[0].id;
    const EMB_ID = EMB ? S.mid : null;

    const mission = () => missions.find(m => m.id === S.mid) || null;
    const kind = () => { const m = mission(); return m && m.start ? m.start.kind : null; };
    function W(id) {
      id = id || S.mid;
      if (!S.W[id]) S.W[id] = {};
      const w = S.W[id];
      if (!w.cfg) w.cfg = {};
      if (!w.answers) w.answers = {};
      if (w.sel === undefined) w.sel = null;
      if (!w.tab) w.tab = 'cfg';
      if (!w.hints) w.hints = 0;
      return w;
    }
    function save() {
      try {
        let o = { v: 1, mid: S.mid, W: {} };
        if (EMB) {   // merge only this mission's work; keep the standalone's current mission and the other missions' work
          let d = null; try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { d = null; }
          o = d && d.v === 1 && d.W && typeof d.W === 'object' ? d : { v: 1, mid: S.mid, W: {} };
        }
        Object.keys(S.W).forEach(k => { const w = S.W[k]; o.W[k] = { cfg: w.cfg, problem: w.problem || null, token: w.token || null, answers: w.answers, verify: w.verify || '', nc: S.nets[k] ? S.nets[k].exportNeighbors() : w.nc || null, graded: !!w.graded, pingedA: !!w.pingedA }; });
        localStorage.setItem(DRAFT_KEY, JSON.stringify(o));
      } catch (e) { /* storage unavailable */ }
    }

    /* ---------- network state for the current lab ---------- */
    function baseTopo() {
      const m = mission(); if (!m) return null;
      if (kind() === 'eui') return W().problem ? V6.v2Topo(W().problem) : null;
      return m.start && m.start.topo ? m.start.topo : null;
    }
    const curTopo = () => { const b = baseTopo(); return b ? V6.applyConfig(b, W().cfg) : null; };
    function rebuild() {
      const t = curTopo(); if (!t) { delete S.nets[S.mid]; return null; }
      const old = S.nets[S.mid];
      const n = V6.create(t);
      if (old) n.importNeighbors(old.exportNeighbors()); else if (W().nc) n.importNeighbors(W().nc);
      S.nets[S.mid] = n;
      return n;
    }
    const NET = () => S.nets[S.mid] || rebuild();

    /* ---------- rendering ---------- */
    function render() {
      if (!alive) return;
      const fk = document.activeElement && root.contains(document.activeElement) ? document.activeElement.getAttribute('data-fk') : null;
      const k = kind();
      let body = '';
      if (!mission()) body = toolsView();
      else if (k === 'notation') body = brief() + notationView() + submitCard();
      else if (k === 'eui') body = brief() + euiView() + submitCard();
      else body = brief() + labView() + submitCard();
      pending = false;
      root.innerHTML = `<div class="nls-ipv6${EMB ? ' nls-embedded' : ''}">${head()}${missionList()}${body}</div>`;
      if (fk) { const el = root.querySelector(`[data-fk="${CSS_ESC(fk)}"]`); if (el && !el.disabled) el.focus({ preventScroll: true }); }
      save();
    }
    const CSS_ESC = s => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'));
    const setPart = (name, html) => { const el = root.querySelector(`[data-part="${CSS_ESC(name)}"]`); if (el) el.innerHTML = html; };

    function head() {
      return `<div class="nls-ipv6-card"><h2>ห้องปฏิบัติการ IPv6</h2>
<p class="nls-ipv6-muted">ฝึกเขียน IPv6 address ตาม RFC 5952 คำนวณ EUI-64 และตั้งค่าเครือข่าย IPv6 จริง: link-local, Router Advertisement, SLAAC, DAD, static route และ ping6 ที่คำนวณจากการตั้งค่าของคุณ</p>
<details class="nls-ipv6-howto"><summary>คำแนะนำการใช้งาน</summary><ol>
${EMB ? '' : '<li>เลือกภารกิจด้านล่าง หรือ "เครื่องมือ IPv6" เพื่อทดลองย่อ/ขยาย address และคำนวณ EUI-64 ได้อิสระ</li>'}
<li>ภารกิจ v1–v2 เป็นโจทย์สุ่ม กด "โจทย์ใหม่" เพื่อเปลี่ยนโจทย์ กรอกคำตอบแล้วกด "ตรวจคำตอบ"</li>
<li>ภารกิจ v3–v5: แตะอุปกรณ์ในแผนภาพ (หรือปุ่มรายชื่ออุปกรณ์) เพื่อตั้งค่า ค่าที่แก้จะมีผลเมื่อออกจากช่องหรือกด Enter ดูผลที่แท็บ ipconfig, Neighbor cache และ Routing table</li>
<li>ทดสอบด้วย ping6 ระหว่างเครื่อง ดูขั้นตอน Neighbor Discovery (NS/NA) และเหตุผลเมื่อไม่สำเร็จ หรือกด "ping ทุกคู่" เพื่อดูตารางผล</li>
<li>กด "ตรวจงาน" เซิร์ฟเวอร์จะสร้างเครือข่ายจากค่าที่คุณตั้งแล้วทดสอบใหม่ทั้งหมด</li></ol></details></div>`;
    }
    function missionList() {
      if (EMB) return '';   // embedded: no mission list, no free tools
      let s = '<nav class="nls-ipv6-missions" aria-label="รายการภารกิจ">';
      for (const m of missions) {
        const b = best[m.id], on = S.mid === m.id;
        const st = b && b.attempts !== 0 && b.best != null ? `<span class="nls-ipv6-best">คะแนนดีที่สุด ${b.best}/${b.max || m.max}</span>` : `<span>${esc(LAB_TH[(m.start || {}).lab] || '')}</span>`;
        s += `<button type="button" class="nls-ipv6-mbtn${on ? ' nls-ipv6-on' : ''}" data-act="mission" data-id="${esc(m.id)}" data-fk="m-${esc(m.id)}" aria-current="${on ? 'true' : 'false'}">
<span class="nls-ipv6-lvl">${esc(m.id)} · ${esc(LVL_TH[m.level] || m.level)}</span><b>${esc(m.title)}</b>${st}</button>`;
      }
      s += `<button type="button" class="nls-ipv6-mbtn${!mission() ? ' nls-ipv6-on' : ''}" data-act="tools" data-fk="m-tools" aria-current="${!mission() ? 'true' : 'false'}"><span class="nls-ipv6-lvl">tools</span><b>เครื่องมือ IPv6</b><span>ย่อ/ขยาย ชนิด prefix และ EUI-64</span></button>`;
      return s + '</nav>';
    }
    function brief() {
      const m = mission(), w = W(), st = m.start || {};
      const hints = Array.isArray(m.hints) ? m.hints : [];
      let s = `<section class="nls-ipv6-card" aria-label="รายละเอียดภารกิจ"><h3>${esc(m.id)}: ${esc(m.title)}</h3>
<p><span class="nls-ipv6-tag">${esc(LAB_TH[st.lab] || '')}</span><span class="nls-ipv6-tag">สัปดาห์ ${esc(st.week || '-')}</span><span class="nls-ipv6-tag">ระดับ${esc(LVL_TH[m.level] || '')}</span><span class="nls-ipv6-tag">เต็ม ${esc(m.max)} คะแนน</span></p>
<p>${esc(m.desc)}</p>`;
      if (hints.length) {
        if (w.hints) s += `<ol class="nls-ipv6-hints">${hints.slice(0, w.hints).map(h => `<li>${esc(h)}</li>`).join('')}</ol>`;
        s += `<div class="nls-ipv6-row" style="margin-top:8px">`;
        if (w.hints < hints.length) s += `<button type="button" class="nls-ipv6-btn nls-ipv6-ghost nls-ipv6-sm" data-act="hint" data-fk="hint">แสดงคำใบ้ (${w.hints}/${hints.length})</button>`;
        if (st.kind === 'lab') s += `<button type="button" class="nls-ipv6-btn nls-ipv6-ghost nls-ipv6-sm" data-act="reset" data-fk="reset">${w.confirmReset ? 'กดอีกครั้งเพื่อยืนยันการเริ่มใหม่' : 'เริ่มใหม่ (คืนค่าเริ่มต้น)'}</button>`;
        s += '</div>';
      }
      return s + '</section>';
    }

    /* ---------- v1: notation ---------- */
    function problemBar(w) {
      return `<div class="nls-ipv6-row" style="margin-bottom:10px"><button type="button" class="nls-ipv6-btn nls-ipv6-ghost" data-act="new" data-fk="new" ${w.busy ? 'disabled' : ''}>${w.problem ? 'โจทย์ใหม่' : 'ขอโจทย์'}</button>
${w.busy ? '<span class="nls-ipv6-muted" role="status">กำลังโหลด…</span>' : ''}${w.err ? `<span class="nls-ipv6-bad" role="alert">${esc(w.err)}</span>` : ''}</div>`;
    }
    function notationView() {
      const w = W();
      let s = `<section class="nls-ipv6-card" aria-label="โจทย์"><h3>โจทย์</h3>${problemBar(w)}`;
      if (!w.problem) return s + '<p class="nls-ipv6-muted">กด "ขอโจทย์" เพื่อเริ่ม</p></section>';
      const det = w.result && w.result.details && Array.isArray(w.result.details.items) ? w.result.details.items : null;
      s += '<div class="nls-ipv6-items">';
      w.problem.items.forEach((it, i) => {
        const d = det && det[i];
        const cls = d ? (d.notation && d.type ? ' nls-ipv6-good' : ' nls-ipv6-wrong') : '';
        s += `<div class="nls-ipv6-item${cls}"><h4>ข้อ ${i + 1} · ${it.task === 'compress' ? 'ย่อให้เป็นรูปสั้นตาม RFC 5952' : 'ขยายเป็นรูปเต็ม 8 กลุ่ม กลุ่มละ 4 หลัก'}</h4>
<div class="nls-ipv6-addr" id="nls-ipv6-q${i}">${esc(it.show)}</div>
<label class="nls-ipv6-f"><span>${it.task === 'compress' ? 'รูปย่อ' : 'รูปเต็ม'}${d ? ` <span class="${d.notation ? 'nls-ipv6-ok' : 'nls-ipv6-bad'}">${d.notation ? '✓ ถูก' : '✗ ผิด'}</span>` : ''}</span>
<input type="text" data-ans="a${i}" data-fk="a${i}" value="${esc(w.answers['a' + i] || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text" aria-describedby="nls-ipv6-q${i}" placeholder="${it.task === 'compress' ? 'เช่น 2001:db8::1' : 'เช่น 2001:0db8:0000:…'}"></label>
<label class="nls-ipv6-f"><span>ชนิดของ address${d ? ` <span class="${d.type ? 'nls-ipv6-ok' : 'nls-ipv6-bad'}">${d.type ? '✓ ถูก' : '✗ ผิด'}</span>` : ''}</span>
<select data-ans="t${i}" data-fk="t${i}">${TYPE_OPTS.map(([v, t]) => `<option value="${v}"${(w.answers['t' + i] || '') === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>`;
      });
      return s + '</div></section>';
    }

    /* ---------- v2: EUI-64 ---------- */
    function euiView() {
      const w = W();
      let s = `<section class="nls-ipv6-card" aria-label="โจทย์"><h3>คำนวณ Interface ID (EUI-64) และ link-local</h3>${problemBar(w)}`;
      if (!w.problem) return s + '<p class="nls-ipv6-muted">กด "ขอโจทย์" เพื่อเริ่ม</p></section>';
      const fields = w.result && w.result.details && Array.isArray(w.result.details.checks) ? w.result.details.checks : [];
      const mark = id => { const c = fields.find(x => x.id === id); return c ? ` <span class="${c.ok ? 'nls-ipv6-ok' : 'nls-ipv6-bad'}">${c.ok ? '✓ ถูก' : '✗ ผิด'}</span>` : ''; };
      s += '<div class="nls-ipv6-items">';
      w.problem.macs.forEach((mac, i) => {
        s += `<div class="nls-ipv6-item"><h4>MAC ${i + 1}${i === 0 ? ' (PC-A ในเครื่องจำลอง)' : ''}</h4><div class="nls-ipv6-addr" id="nls-ipv6-mac${i}">${esc(mac)}</div>
<label class="nls-ipv6-f"><span>Interface ID (64 บิต)${mark('eui' + i)}</span><input type="text" data-ans="eui${i}" data-fk="eui${i}" value="${esc(w.answers['eui' + i] || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="nls-ipv6-mac${i}" placeholder="xxxx:xxff:fexx:xxxx"></label>
<label class="nls-ipv6-f"><span>Link-local address${mark('ll' + i)}</span><input type="text" data-ans="ll${i}" data-fk="ll${i}" value="${esc(w.answers['ll' + i] || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="nls-ipv6-mac${i}" placeholder="fe80::…"></label></div>`;
      });
      s += '</div></section>';
      const n = NET();
      // a real PC-A shows its link-local in ipconfig, but here that is the graded answer: it opens only after the student's
      // own address got an Echo Reply from PC-A (they already know it), or after the answers were sent for grading
      const canShowA = !!(w.graded || w.pingedA);
      const show = w.showA && canShowA ? n.show('PCA') : null;
      s += `<section class="nls-ipv6-card" aria-label="ตรวจในเครื่องจำลอง"><h3>ตรวจในเครื่องจำลอง</h3>
<p class="nls-ipv6-muted">PC-A ใช้ MAC ตัวแรก (${esc(w.problem.macs[0])}) อยู่ใน LAN เดียวกับ PC-B ไม่มี router จึงมีแค่ link-local ให้ ping link-local ที่คุณคำนวณได้จาก PC-B ถ้าได้รับ Echo Reply แปลว่าถูกต้อง</p>
<div data-part="topo">${topoSVG(n)}</div>
${pingPanel(['PCB'], true)}
<div class="nls-ipv6-row"><button type="button" class="nls-ipv6-btn nls-ipv6-ghost nls-ipv6-sm" data-act="showA" data-fk="showA" ${canShowA ? '' : 'disabled'}>${w.showA && canShowA ? 'ซ่อน ipconfig ของ PC-A' : 'เปิด ipconfig ของ PC-A เพื่อเทียบคำตอบ'}</button>
${canShowA ? '' : '<span class="nls-ipv6-muted">(เปิดได้เมื่อ ping link-local ที่คุณคำนวณจาก PC-B แล้วได้ Echo Reply จาก PC-A หรือหลังส่งตรวจคำตอบ เพราะ ipconfig แสดงคำตอบของ MAC 1)</span>'}</div>
${show ? `<pre class="nls-ipv6-term" aria-label="ผลคำสั่ง ipconfig ของ PC-A">${esc(show.cmd)}\n${esc(show.lines.join('\n'))}</pre>` : ''}</section>`;
      return s;
    }

    /* ---------- topology drawing ---------- */
    function devIcon(d) {
      if (d.type === 'router') return `<circle cx="0" cy="0" r="22" class="nls-ipv6-body"/><path d="M-12 -5h18l-5-5M12 5h-18l5 5" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>`;
      if (d.type === 'server') return `<rect x="-15" y="-24" width="30" height="46" rx="3" class="nls-ipv6-body"/><path d="M-9 -14h18M-9 -6h18M-9 2h18" stroke="var(--ink)" stroke-width="1.6"/><circle cx="7" cy="13" r="2.4" fill="var(--ok)"/>`;
      return `<rect x="-22" y="-20" width="44" height="30" rx="3" class="nls-ipv6-body"/><path d="M-8 18h16M0 10v8" stroke="var(--ink)" stroke-width="2"/>`;
    }
    function topoSVG(n, path) {
      const t = n.topo, P = {};
      t.devices.forEach(d => { P[d.id] = d; });
      const hot = new Set(), on = path && path.ids ? path.ids : [];
      for (let i = 0; i + 1 < on.length; i++) hot.add(on[i] + '>' + on[i + 1]).add(on[i + 1] + '>' + on[i]);
      const xs = t.devices.map(d => d.x).concat(t.links.map(l => l.x)), x0 = Math.max(0, Math.min(...xs) - 50), x1 = Math.max(...xs) + 50;
      const ys = t.devices.map(d => d.y).concat(t.links.map(l => l.y)), y0 = Math.max(0, Math.min(...ys) - 40), h = Math.max(...ys) + 56 - y0;
      let s = `<svg class="nls-ipv6-svg" viewBox="${x0} ${y0} ${x1 - x0} ${h}" role="group" aria-label="แผนภาพเครือข่าย: ${esc(t.devices.map(d => d.name).join(', '))}">`;
      t.links.forEach(l => {
        const mem = t.devices.filter(d => d.ifaces.some(f => f.link === l.id));
        const pairHot = (a, b) => hot.has(a + '>' + b);
        if (l.p2p && mem.length === 2) {
          const [a, b] = mem, c = pairHot(a.id, b.id) ? (path.ok ? ' nls-ipv6-hot' : ' nls-ipv6-cold') : '';
          s += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="nls-ipv6-wire${c}"/><text x="${l.x}" y="${l.y - 10}" text-anchor="middle" font-size="13" fill="var(--muted)">${esc(l.name)}</text>`;
          return;
        }
        mem.forEach(d => {
          const c = mem.some(o => o !== d && pairHot(d.id, o.id)) ? (path.ok ? ' nls-ipv6-hot' : ' nls-ipv6-cold') : '';
          s += `<line x1="${d.x}" y1="${d.y}" x2="${l.x}" y2="${l.y}" class="nls-ipv6-wire${c}"/>`;
        });
        s += `<g><rect x="${l.x - 40}" y="${l.y - 14}" width="80" height="28" rx="6" class="nls-ipv6-sw"/><text x="${l.x}" y="${l.y + 5}" text-anchor="middle" font-size="14" font-weight="600">${esc(l.name)}</text></g>`;
      });
      const w6 = W();
      t.devices.forEach(d => {
        const sel = w6.sel === d.id;
        const st = d.ifaces.map(f => n.iface(d.id, f.id)).filter(Boolean);
        const problem = st.some(x => x.notes.some(no => no.code !== 'len_not64' && no.code !== 'down'));
        const lab = `${d.name}${problem ? ' (มีปัญหา)' : ''}`;
        s += `<g class="nls-ipv6-node${sel ? ' nls-ipv6-sel' : ''}" transform="translate(${d.x},${d.y})" tabindex="0" role="button" aria-pressed="${sel}" aria-label="${esc(lab)}" data-act="sel" data-id="${esc(d.id)}" data-fk="node-${esc(d.id)}">
<rect x="-34" y="-32" width="68" height="64" rx="10" class="nls-ipv6-ring"/>${devIcon(d)}
<text x="0" y="44" text-anchor="middle" font-size="15" font-weight="700">${esc(d.name)}</text>
${problem ? '<circle cx="24" cy="-24" r="9" class="nls-ipv6-badge"/><text x="24" y="-19" text-anchor="middle" font-size="13" class="nls-ipv6-badget">!</text>' : ''}</g>`;
      });
      return s + '</svg>';
    }
    function devList(n) {
      const w = W();
      return `<div class="nls-ipv6-devs" role="group" aria-label="เลือกอุปกรณ์">${n.topo.devices.map(d => {
        const st = d.ifaces.map(f => n.iface(d.id, f.id)).filter(Boolean);
        const warn = st.some(x => x.notes.some(no => no.code !== 'len_not64' && no.code !== 'down'));
        const sub = d.type === 'router' ? st.map(x => `${x.name}: ${x.addrs.filter(a => a.origin === 'static').map(a => a.addr + '/' + a.len).join(', ') || '-'}`).join(' · ') : (n.primary(d.id) || 'ไม่มี global address');
        return `<button type="button" class="nls-ipv6-dev" data-act="sel" data-id="${esc(d.id)}" data-fk="dev-${esc(d.id)}" aria-pressed="${w.sel === d.id}"><b>${esc(d.name)}</b><span>${esc(sub)}</span>${warn ? '<span class="nls-ipv6-warn">มีข้อสังเกต</span>' : ''}</button>`;
      }).join('')}</div>`;
    }

    /* ---------- lab (v3-v5) ---------- */
    function labView() {
      const n = NET(), w = W();
      if (!w.sel || !n.dev(w.sel)) w.sel = n.topo.devices[0].id;
      return `<section class="nls-ipv6-card" aria-label="แผนภาพเครือข่าย"><h3>เครือข่าย</h3><div data-part="topo">${topoSVG(n, w.ping && !w.ping.stale ? { ids: w.ping.r.path, ok: w.ping.r.ok } : null)}</div><div data-part="devs">${devList(n)}</div></section>
<div class="nls-ipv6-lab"><section class="nls-ipv6-card" aria-label="ตั้งค่าอุปกรณ์">${propsView(n)}</section>
<section class="nls-ipv6-card" aria-label="สถานะอุปกรณ์"><div data-part="status">${statusView(n)}</div></section></div>
<section class="nls-ipv6-card" aria-label="ทดสอบ ping6"><h3>ทดสอบ ping6</h3>${pingPanel(n.hosts(), false)}</section>
<section class="nls-ipv6-card" aria-label="ping ทุกคู่"><div class="nls-ipv6-row" style="justify-content:space-between"><h3 style="margin:0">ping6 ทุกคู่ (ping matrix)</h3>
<button type="button" class="nls-ipv6-btn nls-ipv6-ghost nls-ipv6-sm" data-act="matrix" data-fk="matrix" aria-expanded="${!!w.showMx}">${w.showMx ? 'ซ่อนตาราง' : 'ทดสอบทุกคู่'}</button></div>
<div data-part="matrix">${w.showMx ? matrixView() : ''}</div></section>`;
    }
    const cur = (d, f, k) => { const v = f[k]; return v == null ? '' : String(v); };
    function notesHTML(st) {
      const list = st ? st.notes : [];
      return list.length ? `<ul class="nls-ipv6-notes">${list.map(x => `<li class="${x.code === 'len_not64' ? 'nls-ipv6-info' : ''}">${esc(x.text)}</li>`).join('')}</ul>` : '';
    }
    function ifFacts(st) {
      if (!st) return '';
      const rows = [['MAC', st.mac], ['ลิงก์', st.link || '-'], ['Link-local', st.ll ? st.ll + (st.addrs[0] && st.addrs[0].state === 'duplicate' ? ' (Duplicate)' : '') : '-']];
      st.addrs.filter(a => a.origin !== 'link-local').forEach(a => rows.push([a.origin === 'slaac' ? 'SLAAC' : 'Global', `${a.addr}/${a.len}${a.state === 'duplicate' ? ' (Duplicate)' : ''}`]));
      if (st.gw) rows.push(['Gateway', st.gw.addr + (st.gw.src === 'ra' ? ' (จาก RA)' : '')]);
      if (st.raPrefixes && st.raPrefixes.length) rows.push(['RA ประกาศ', st.raPrefixes.join(', ')]);
      return `<dl class="nls-ipv6-kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
    }
    function propsView(n) {
      const w = W(), t = curTopo(), d = t.devices.find(x => x.id === w.sel);
      if (!d) return '<p>เลือกอุปกรณ์</p>';
      let s = `<h3>ตั้งค่า ${esc(d.name)} <span class="nls-ipv6-muted">(${d.type === 'router' ? 'Router' : d.type === 'server' ? 'Server ' + (d.os === 'linux' ? 'Linux' : '') : 'PC ' + (d.os === 'linux' ? 'Linux' : 'Windows')})</span></h3>`;
      const key = f => `${d.id}|${f.id}`;
      d.ifaces.forEach(f => {
        const st = n.iface(d.id, f.id), k = key(f), idb = `nls-ipv6-${d.id}-${f.id}`.replace(/[^\w-]/g, '_');
        s += `<fieldset class="nls-ipv6-ifbox"><legend>${esc(f.name)} → ${esc(f.link || '-')}</legend><div data-part="facts-${esc(k)}">${ifFacts(st)}</div>`;
        if (d.type === 'router') {
          s += `<label class="nls-ipv6-f"><span>Link-local (เว้นว่าง = EUI-64 อัตโนมัติ)</span><input type="text" data-cfg="${esc(k)}|ll" data-fk="${esc(k)}|ll" value="${esc(cur(d, f, 'll'))}" placeholder="fe80::1" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
<div class="nls-ipv6-2col"><label class="nls-ipv6-f"><span>IPv6 address (global)</span><input type="text" data-cfg="${esc(k)}|addr" data-fk="${esc(k)}|addr" value="${esc(cur(d, f, 'addr'))}" placeholder="2001:db8:10::1" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
<label class="nls-ipv6-f"><span>Prefix length</span><input type="text" data-cfg="${esc(k)}|len" data-fk="${esc(k)}|len" value="${esc(cur(d, f, 'len'))}" placeholder="64" inputmode="numeric" autocomplete="off"></label></div>
<label class="nls-ipv6-check"><input type="checkbox" data-cfg="${esc(k)}|ra" data-fk="${esc(k)}|ra" ${f.ra ? 'checked' : ''}> ส่ง Router Advertisement (RA)</label>`;
        } else {
          s += `<div class="nls-ipv6-seg" role="radiogroup" aria-label="วิธีกำหนด address ของ ${esc(d.name)}">
<label><input type="radio" name="${idb}-mode" value="slaac" data-cfg="${esc(k)}|mode" data-fk="${esc(k)}|mode-slaac" ${f.mode !== 'static' ? 'checked' : ''}> SLAAC</label>
<label><input type="radio" name="${idb}-mode" value="static" data-cfg="${esc(k)}|mode" data-fk="${esc(k)}|mode-static" ${f.mode === 'static' ? 'checked' : ''}> Static</label></div>`;
          if (f.mode === 'static') {
            s += `<div class="nls-ipv6-2col"><label class="nls-ipv6-f"><span>IPv6 address</span><input type="text" data-cfg="${esc(k)}|addr" data-fk="${esc(k)}|addr" value="${esc(cur(d, f, 'addr'))}" placeholder="2001:db8:1::10" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
<label class="nls-ipv6-f"><span>Prefix length</span><input type="text" data-cfg="${esc(k)}|len" data-fk="${esc(k)}|len" value="${esc(cur(d, f, 'len'))}" placeholder="64" inputmode="numeric" autocomplete="off"></label></div>
<label class="nls-ipv6-f"><span>Default gateway</span><input type="text" data-cfg="${esc(k)}|gw" data-fk="${esc(k)}|gw" value="${esc(cur(d, f, 'gw'))}" placeholder="fe80::1" autocomplete="off" autocapitalize="off" spellcheck="false"></label>`;
          } else s += '<p class="nls-ipv6-muted">SLAAC: รับ prefix และ default gateway จาก Router Advertisement แล้วสร้าง Interface ID ด้วย EUI-64 เอง</p>';
        }
        s += `<div data-part="notes-${esc(k)}">${notesHTML(st)}</div></fieldset>`;
      });
      if (d.type === 'router') {
        const rt = n.routes(d.id).filter(r => r.type === 'S');
        s += `<h4>Static route (ipv6 route)</h4>`;
        (d.routes || []).forEach((r, i) => {
          const k = `${d.id}|${i}`;
          s += `<div class="nls-ipv6-route"><div class="nls-ipv6-route-g">
<label class="nls-ipv6-f"><span>Prefix ปลายทาง</span><input type="text" data-route="${esc(k)}|prefix" data-fk="r${esc(k)}|prefix" value="${esc(r.prefix)}" placeholder="2001:db8:2::/64" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
<label class="nls-ipv6-f"><span>Next hop</span><input type="text" data-route="${esc(k)}|via" data-fk="r${esc(k)}|via" value="${esc(r.via)}" placeholder="2001:db8:ff::2" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
<label class="nls-ipv6-f"><span>Interface</span><select data-route="${esc(k)}|iface" data-fk="r${esc(k)}|iface"><option value="">(อัตโนมัติ)</option>${d.ifaces.map(f => `<option value="${esc(f.id)}"${r.iface === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
<button type="button" class="nls-ipv6-btn nls-ipv6-ghost nls-ipv6-sm" data-act="delroute" data-dev="${esc(d.id)}" data-i="${i}" data-fk="rdel${esc(k)}" aria-label="ลบ route ที่ ${i + 1}">ลบ</button></div>
<div data-part="rwhy-${esc(k)}">${routeWhy(rt[i])}</div></div>`;
        });
        s += `<button type="button" class="nls-ipv6-btn nls-ipv6-ghost nls-ipv6-sm" data-act="addroute" data-dev="${esc(d.id)}" data-fk="raddr-${esc(d.id)}" ${(d.routes || []).length >= 8 ? 'disabled' : ''}>เพิ่ม static route</button>`;
      }
      return s;
    }
    const routeWhy = r => !r ? '' : r.valid ? `<p class="nls-ipv6-ok" style="font-size:14px;margin:4px 0 0">✓ ใช้งานได้: ${esc(r.prefix)} via ${esc(r.via)} (${esc(r.iface)})</p>` : `<p class="nls-ipv6-bad" style="font-size:14px;margin:4px 0 0">✗ ${esc(r.why)}</p>`;
    function statusView(n) {
      const w = W(), d = n.dev(w.sel);
      if (!d) return '';
      const router = d.type === 'router';
      const tabs = [['cfg', router ? 'show ipv6 interface' : d.os === 'linux' ? 'ip -6 addr' : 'ipconfig'], ['nc', 'Neighbor cache'], ['rt', 'Routing table']];
      let s = `<h3>สถานะ ${esc(d.name)}</h3><div class="nls-ipv6-tabs" role="group" aria-label="มุมมองสถานะ">${tabs.map(([k, t]) => `<button type="button" class="nls-ipv6-btn nls-ipv6-ghost nls-ipv6-sm" data-act="tab" data-v="${k}" data-fk="tab-${k}" aria-pressed="${w.tab === k}">${esc(t)}</button>`).join('')}</div>`;
      if (w.tab === 'nc') {
        const nc = n.neighbors(d.id);
        const cmd = router ? 'R# show ipv6 neighbors' : d.os === 'linux' ? '$ ip -6 neigh' : 'C:\\> netsh interface ipv6 show neighbors';
        s += `<p class="nls-ipv6-mono nls-ipv6-muted" style="font-size:13px">${esc(cmd)}</p>`;
        s += nc.length ? `<div class="nls-ipv6-tablewrap"><table class="nls-ipv6-table"><thead><tr><th>IPv6 address</th><th>MAC</th><th>สถานะ</th></tr></thead><tbody>${nc.map(e => `<tr><td>${esc(e.addr)}</td><td>${esc(e.mac || '(ไม่ทราบ)')}</td><td>${esc(e.state)}${e.router ? ' · router' : ''}${router ? ' · ' + esc(e.iface) : ''}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="nls-ipv6-muted">ยังว่าง: neighbor cache จะมีรายการเมื่อเครื่องนี้ส่งหรือรับแพ็กเก็ต (ลอง ping6) โดยเรียนรู้จาก Neighbor Solicitation / Advertisement</p>';
        s += '<p class="nls-ipv6-muted" style="font-size:13px">REACHABLE = เพิ่งยืนยันด้วย NA · STALE = เรียนรู้จาก NS ของอีกฝั่ง ยังไม่ยืนยัน · INCOMPLETE = ส่ง NS แล้วไม่มีใครตอบ</p>';
      } else if (w.tab === 'rt') {
        const rt = n.routes(d.id);
        s += `<p class="nls-ipv6-mono nls-ipv6-muted" style="font-size:13px">${esc(router ? 'R# show ipv6 route' : d.os === 'linux' ? '$ ip -6 route' : 'C:\\> route print -6')}</p>`;
        s += rt.length ? `<div class="nls-ipv6-tablewrap"><table class="nls-ipv6-table"><thead><tr><th>ชนิด</th><th>Prefix</th><th>Next hop / Interface</th></tr></thead><tbody>${rt.map(r => `<tr><td>${esc(r.type === 'C' ? 'C (ต่อตรง)' : r.type === 'RA' ? 'Default (จาก RA)' : r.prefix === '::/0' ? 'Default (static)' : 'S (static)')}${r.valid ? '' : ' <span class="nls-ipv6-bad">ใช้ไม่ได้</span>'}</td><td>${esc(r.prefix)}</td><td>${esc(r.via ? r.via + ' ' : 'on-link ')}${esc(r.iface || '')}${r.why ? '<br><span class="nls-ipv6-bad">' + esc(r.why) + '</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="nls-ipv6-muted">ยังไม่มีเส้นทาง (interface ยังไม่มี IPv6 ที่ใช้ได้)</p>';
      } else {
        const sh = n.show(d.id);
        s += `<pre class="nls-ipv6-term" aria-label="ผลคำสั่ง">${esc(sh.cmd)}\n${esc(sh.lines.join('\n'))}</pre>`;
      }
      return s;
    }
    function pingPanel(srcs, fixed) {
      const w = W(), n = NET();
      if (!w.psrc || !srcs.includes(w.psrc)) w.psrc = srcs[0];
      const fills = [];
      if (kind() !== 'eui') n.topo.devices.forEach(d => {
        if (d.id === w.psrc && fixed) return;
        const p = n.primary(d.id);
        if (p && d.type !== 'router') fills.push([d.name, p]);
        if (d.type === 'router') d.ifaces.forEach(f => { const st = n.iface(d.id, f.id); const g = st && st.addrs.find(a => a.origin === 'static' && a.state === 'preferred'); if (g) fills.push([`${d.name} ${f.name}`, g.addr]); });
      });
      let s = `<div class="nls-ipv6-2col" style="grid-template-columns:minmax(0,150px) minmax(0,1fr)">
<label class="nls-ipv6-f"><span>ต้นทาง</span>${fixed ? `<input type="text" value="${esc(n.dev(srcs[0]).name)}" disabled>` : `<select data-psrc data-fk="psrc">${srcs.map(id => `<option value="${esc(id)}"${w.psrc === id ? ' selected' : ''}>${esc(n.dev(id).name)}</option>`).join('')}</select>`}</label>
<label class="nls-ipv6-f"><span>ping6 ไปยัง (IPv6 address)</span><input type="text" data-ptarget data-fk="ptarget" value="${esc(w.ptarget || '')}" placeholder="${fixed ? 'fe80::…' : '2001:db8:…'}" autocomplete="off" autocapitalize="off" spellcheck="false"></label></div>`;
      if (fills.length) s += `<div class="nls-ipv6-fills" role="group" aria-label="เติม address ปลายทาง">${fills.slice(0, 10).map(([lab, a], i) => `<button type="button" class="nls-ipv6-btn nls-ipv6-ghost nls-ipv6-sm" data-act="fill" data-v="${esc(a)}" data-fk="fill${i}">${esc(lab)}</button>`).join('')}</div>`;
      s += `<div class="nls-ipv6-row"><button type="button" class="nls-ipv6-btn" data-act="ping" data-fk="ping">ping6</button></div>`;
      s += `<div data-part="pingres" aria-live="polite">${pingResult()}</div>`;
      return s;
    }
    function pingResult() {
      const w = W(), p = w.ping;
      if (!p) return '';
      const r = p.r;
      let s = p.stale ? '<p class="nls-ipv6-stale">ผลนี้มาจากการตั้งค่าก่อนหน้า กด ping6 อีกครั้งเพื่อทดสอบค่าปัจจุบัน</p>' : '';
      s += `<pre class="nls-ipv6-term">${esc(r.out.join('\n'))}</pre>`;
      s += `<div class="nls-ipv6-reason ${r.ok ? 'nls-ipv6-good' : 'nls-ipv6-wrong'}"><b>${r.ok ? 'สำเร็จ' : 'ไม่สำเร็จ'}${!r.ok && r.dir === 'back' ? ' (Echo Request ถึงปลายทางแล้ว แต่ Echo Reply กลับไม่ได้)' : ''}${!r.ok && r.at ? ' · จุดที่ล้มเหลว: ' + esc((NET().dev(r.at) || {}).name || r.at) : ''}</b><br>${esc(r.text)}</div>`;
      if (r.trace && r.trace.length) s += `<details open><summary style="min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:600">ขั้นตอน Neighbor Discovery และการส่งต่อ</summary><ol class="nls-ipv6-trace">${r.trace.map(x => `<li><span class="nls-ipv6-k">${esc(KIND[x.k] || x.k)}</span>${esc(x.t)}</li>`).join('')}</ol></details>`;
      return s;
    }
    function matrixView() {
      const t = curTopo(); if (!t) return '';
      const n = V6.create(t), hosts = n.hosts(), m = n.matrix(hosts);
      const name = id => n.dev(id).name;
      let s = `<div class="nls-ipv6-tablewrap"><table class="nls-ipv6-table nls-ipv6-mx"><caption class="nls-ipv6-sr">ผล ping6 จากแถว (ต้นทาง) ไปคอลัมน์ (ปลายทาง)</caption><thead><tr><th scope="col">จาก \\ ถึง</th>${hosts.map(h => `<th scope="col">${esc(name(h))}</th>`).join('')}</tr></thead><tbody>`;
      hosts.forEach(a => {
        s += `<tr><th scope="row">${esc(name(a))}</th>${hosts.map(b => {
          if (a === b) return '<td aria-label="ตัวเอง">-</td>';
          const c = m.find(x => x.from === a && x.to === b);
          return `<td class="${c.ok ? 'nls-ipv6-yes' : 'nls-ipv6-no'}" title="${esc(c.text)}" aria-label="${esc(name(a))} ถึง ${esc(name(b))}: ${c.ok ? 'ได้' : 'ไม่ได้'}">${c.ok ? '✓' : '✗'}</td>`;
        }).join('')}</tr>`;
      });
      s += '</tbody></table></div>';
      const okN = m.filter(x => x.ok).length;
      s += `<p style="margin-top:8px"><b>ผ่าน ${okN}/${m.length} คู่</b> (ทดสอบบนเครือข่ายใหม่ ไม่เปลี่ยน neighbor cache ที่คุณดูอยู่)</p>`;
      const bad = m.filter(x => !x.ok);
      if (bad.length) s += `<ul class="nls-ipv6-fb">${bad.slice(0, 8).map(x => `<li>${esc(name(x.from))} → ${esc(name(x.to))}${x.dir === 'back' ? ' (ขากลับ)' : ''}: ${esc(x.text)}</li>`).join('')}${bad.length > 8 ? `<li>และอีก ${bad.length - 8} คู่</li>` : ''}</ul>`;
      return s;
    }

    /* ---------- submit ---------- */
    function submitCard() {
      const w = W(), k = kind();
      const ready = k === 'lab' || !!w.problem;
      let s = `<section class="nls-ipv6-card" aria-label="ส่งงาน"><h3>${k === 'lab' ? 'ตรวจงาน / ส่งงาน' : 'ตรวจคำตอบ / ส่งงาน'}</h3>`;
      if (!ctx.user) s += '<p class="nls-ipv6-muted">ยังไม่ได้เข้าสู่ระบบ: ตรวจคะแนนได้แต่จะไม่บันทึก</p>';
      if (k === 'eui') s += `<p class="nls-ipv6-muted">ผลตรวจในเครื่องจำลองที่จะส่ง: ${w.verify ? 'ping6 ' + esc(w.verify) + ' จาก PC-B' : 'ยังไม่ได้ ping'}</p>`;
      s += `<button type="button" class="nls-ipv6-btn" data-act="submit" data-fk="submit" ${ready && !w.sending ? '' : 'disabled'}>${w.sending ? 'กำลังตรวจ…' : k === 'lab' ? 'ตรวจงาน / ส่งงาน' : 'ตรวจคำตอบ / ส่งงาน'}</button>`;
      s += '<div role="status" aria-live="polite">';
      const r = w.result;
      if (r) {
        if (r.error) s += `<p class="nls-ipv6-bad">${esc(r.error)}</p>`;
        else {
          s += `<p class="nls-ipv6-score ${r.ok ? 'nls-ipv6-ok' : ''}">คะแนน ${esc(r.score)}/${esc(r.max)}${r.saved && !r.practice ? ' · บันทึกแล้ว' : ''}</p>`;
          if (r.practice) s += `<p class="nls-ipv6-note" role="alert">${esc(r.message || 'โจทย์นี้ส่งไปแล้ว ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน')}</p>`;
          else if (k !== 'lab' && ctx.user) s += '<p class="nls-ipv6-muted">คะแนนของโจทย์สุ่มนับเฉพาะการส่งครั้งแรก ส่งซ้ำได้เพื่อฝึก ถ้าต้องการคะแนนใหม่ให้กด "โจทย์ใหม่"</p>';
          const ch = r.details && Array.isArray(r.details.checks) ? r.details.checks : [];
          if (ch.length && k === 'lab') s += `<ul class="nls-ipv6-checks">${ch.map(c => `<li class="${c.ok ? 'nls-ipv6-ok' : 'nls-ipv6-bad'}">${c.ok ? '✓' : '✗'} ${esc(c.label)} (${esc(c.pts)}/${esc(c.max)})</li>`).join('')}</ul>`;
          if (Array.isArray(r.feedback) && r.feedback.length) s += `<ul class="nls-ipv6-fb">${r.feedback.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`;
        }
      }
      return s + '</div></section>';
    }
    async function submit() {
      const m = mission(), w = W(), k = kind();
      if (!m || w.sending || typeof ctx.submit !== 'function') return;
      let payload, extra;
      if (k === 'lab') payload = { cfg: JSON.parse(JSON.stringify(w.cfg)) };
      else {
        if (!w.problem) return;
        payload = { answers: Object.assign({}, w.answers) };
        if (k === 'eui') payload.verify = w.verify || '';
        extra = { token: w.token };
      }
      w.sending = true; render();
      try {
        const r = await ctx.submit(m.id, payload, extra);
        if (!alive) return;
        w.result = r || { error: 'ไม่ได้รับผลการตรวจ' };
        if (r && typeof r.score === 'number') {
          if (k !== 'lab') w.graded = true;
          const b = best[m.id] || { best: 0, max: r.max, attempts: 0 };
          b.attempts = (b.attempts || 0) + 1; if (!r.practice) b.best = Math.max(b.best || 0, r.score); b.max = r.max; best[m.id] = b;
          if (typeof ctx.toast === 'function') ctx.toast(r.practice ? (r.message || 'ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน') : `ได้ ${r.score}/${r.max} คะแนน`);
        }
      } catch (err) {
        if (!alive) return;
        w.result = { error: 'ส่งงานไม่สำเร็จ: ' + (err && err.message ? err.message : 'เกิดข้อผิดพลาด') };
      }
      w.sending = false; render();
      const el = root.querySelector('.nls-ipv6-score') || root.querySelector('[data-act="submit"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    async function newProblem() {
      const id = S.mid, w = W(id);
      if (w.busy) return;
      if (typeof ctx.newProblem !== 'function') { w.err = 'ขอโจทย์ไม่ได้ในขณะนี้'; render(); return; }
      w.busy = true; w.err = ''; render();
      try {
        const res = await ctx.newProblem(id);
        if (!alive) return;
        if (!res || !res.problem) throw new Error('ไม่ได้รับโจทย์');
        Object.assign(w, { problem: res.problem, token: res.token, answers: {}, result: null, verify: '', ping: null, showA: false, cfg: {}, graded: false, pingedA: false, ptarget: '' });
        delete S.nets[id]; w.nc = null;
      } catch (e) { w.err = 'ขอโจทย์ไม่สำเร็จ: ' + ((e && e.message) || 'ลองใหม่อีกครั้ง'); }
      w.busy = false;
      if (!alive) return;
      if (S.mid === id) { render(); const f = root.querySelector('[data-ans]'); if (f && w.problem) f.focus({ preventScroll: true }); }
    }

    /* ---------- tools ---------- */
    // 6.x: the free tools would answer an open v1/v2 problem, so each tool is off while its problem is open (not yet sent)
    const openGen = id => { const w = S.W[id]; return !!(w && w.problem && !w.graded); };
    const lockNote = (id, what) => `<p class="nls-ipv6-note" role="note">ปิด${what}ชั่วคราว เพราะคุณมีโจทย์ ${id} ที่ยังไม่ได้ส่งตรวจ (เครื่องมือนี้จะคำนวณคำตอบให้) ส่งตรวจโจทย์ ${id} ก่อน แล้วเครื่องมือจะใช้ได้อีกครั้ง</p>`;
    function toolsView() {
      const lockA = openGen('v1'), lockM = openGen('v2');
      const addr = lockA ? lockNote('v1', 'เครื่องมือย่อ/ขยายและระบุชนิด address ')
        : `<div class="nls-ipv6-2col"><label class="nls-ipv6-f"><span>IPv6 address</span><input type="text" data-tool="addr" data-fk="tool-addr" value="${esc(S.tool.addr)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
<label class="nls-ipv6-f"><span>Prefix length</span><input type="text" data-tool="len" data-fk="tool-len" value="${esc(S.tool.len)}" inputmode="numeric" autocomplete="off"></label></div>
<div data-part="tool-addr" aria-live="polite">${toolAddr()}</div>`;
      const mac = lockM ? lockNote('v2', 'เครื่องมือคำนวณ EUI-64 ')
        : `<label class="nls-ipv6-f"><span>MAC address</span><input type="text" data-tool="mac" data-fk="tool-mac" value="${esc(S.tool.mac)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
<div data-part="tool-mac" aria-live="polite">${toolMac()}</div>`;
      return `<div class="nls-ipv6-tool"><section class="nls-ipv6-card" aria-label="วิเคราะห์ IPv6 address"><h3>วิเคราะห์ IPv6 address</h3>${addr}</section>
<section class="nls-ipv6-card" aria-label="คำนวณ EUI-64"><h3>MAC → EUI-64 → link-local</h3>${mac}</section></div>`;
    }
    function toolAddr() {
      const p = V6.parse(S.tool.addr, { zone: true });
      if (!p.ok) return `<p class="nls-ipv6-bad">${esc(p.err)}</p>`;
      const len = V6.parseLen(S.tool.len);
      const rows = [['รูปย่อ (RFC 5952)', V6.compress(p.w)], ['รูปเต็ม', V6.expand(p.w)], ['ชนิด', V6.TYPE_TH[V6.typeOf(p.w)]]];
      if (len !== null) rows.push([`Prefix (ส่วน network /${len})`, V6.compress(V6.network(p.w, len)) + '/' + len], ['Interface ID (64 บิตหลัง)', V6.expand(p.w).split(':').slice(4).join(':')]);
      else if (S.tool.len.trim()) rows.push(['Prefix', 'prefix length ต้องเป็นตัวเลข 0–128']);
      if (V6.typeOf(p.w) !== 'multicast') rows.push(['Solicited-node multicast', V6.compress(V6.solicited(p.w))]);
      const iss = V6.canonIssues(S.tool.addr.trim().split('%')[0], p);
      return `<dl class="nls-ipv6-kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` +
        (iss.length ? `<p class="nls-ipv6-muted">สิ่งที่พิมพ์ยังไม่ใช่รูปมาตรฐาน: ${esc(iss.join('; '))}</p>` : '<p class="nls-ipv6-ok">สิ่งที่พิมพ์อยู่ในรูปมาตรฐาน RFC 5952 แล้ว</p>');
    }
    function toolMac() {
      const m = V6.parseMac(S.tool.mac);
      if (!m.ok) return `<p class="nls-ipv6-bad">${esc(m.err)}</p>`;
      const b = m.b, hx = x => ('0' + x.toString(16)).slice(-2);
      const bits = x => ('0000000' + x.toString(2)).slice(-8);
      const rows = [['1. แบ่งครึ่ง MAC', `${hx(b[0])}:${hx(b[1])}:${hx(b[2])} | ${hx(b[3])}:${hx(b[4])}:${hx(b[5])}`],
        ['2. แทรก ff:fe ตรงกลาง', `${hx(b[0])}${hx(b[1])}:${hx(b[2])}ff:fe${hx(b[3])}:${hx(b[4])}${hx(b[5])}`],
        ['3. กลับบิต U/L (บิตที่ 7)', `${hx(b[0])} = ${bits(b[0])} → ${bits(b[0] ^ 2)} = ${hx(b[0] ^ 2)}`],
        ['Interface ID', V6.expand([0, 0, 0, 0].concat(V6.eui64(b))).split(':').slice(4).join(':')],
        ['Link-local', V6.compress(V6.linkLocal(b))]];
      if (b[0] & 1) rows.push(['หมายเหตุ', 'บิต I/G = 1 คือ MAC แบบ multicast ใช้กับ interface ไม่ได้']);
      return `<dl class="nls-ipv6-kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
    }

    /* ---------- actions ---------- */
    function setCfg(spec, value) {
      const [dev, ifId, field] = spec.split('|');
      const w = W();
      const c = w.cfg[dev] = w.cfg[dev] || {};
      c.ifaces = c.ifaces || {};
      const ci = c.ifaces[ifId] = c.ifaces[ifId] || {};
      ci[field] = value;
      if (ADDR_FIELDS.includes(field)) {   // reconfigured addresses run DAD again: this interface is now the newest
        const t = curTopo(); let mx = 0;
        t.devices.forEach(d => d.ifaces.forEach(f => { if (f.t > mx) mx = f.t; }));
        const self = t.devices.find(d => d.id === dev).ifaces.find(f => f.id === ifId);
        if (!self || self.t < mx || mx === 0) ci.t = mx + 1;
      }
    }
    function routesOf(dev) {
      const w = W(), c = w.cfg[dev] = w.cfg[dev] || {};
      if (!Array.isArray(c.routes)) { const d = curTopo().devices.find(x => x.id === dev); c.routes = (d && d.routes || []).map(r => Object.assign({}, r)); }
      return c.routes;
    }
    // A field's "change" fires on blur, i.e. on the mousedown of whatever the student clicks next. Replacing parts of the
    // page at that moment would remove the element under the pointer and swallow the click, so while a pointer is down
    // the view update waits until the click has been handled.
    let pressing = false, pending = false;
    function refresh() {   // config changed: rebuild the network now, update the views (not the form fields) when safe
      const n = rebuild(); const w = W();
      if (!n) return;
      if (w.ping) w.ping.stale = true;
      save();
      if (pressing) { pending = true; return; }
      refreshParts();
    }
    function refreshParts() {
      pending = false;
      const n = NET(), w = W();
      if (!n || !alive) return;
      const ae = document.activeElement, fk = ae && root.contains(ae) ? ae.getAttribute('data-fk') : null;
      if (kind() === 'lab') {
        setPart('topo', topoSVG(n, null)); setPart('devs', devList(n)); setPart('status', statusView(n)); setPart('pingres', pingResult());
        if (w.showMx) setPart('matrix', matrixView());
        const t = curTopo(), d = t.devices.find(x => x.id === w.sel);
        if (d) {
          d.ifaces.forEach(f => { const st = n.iface(d.id, f.id); setPart(`notes-${d.id}|${f.id}`, notesHTML(st)); setPart(`facts-${d.id}|${f.id}`, ifFacts(st)); });
          if (d.type === 'router') { const rt = n.routes(d.id).filter(r => r.type === 'S'); (d.routes || []).forEach((r, i) => setPart(`rwhy-${d.id}|${i}`, routeWhy(rt[i]))); }
        }
      }
      if (fk && !root.contains(ae)) { const el = root.querySelector(`[data-fk="${CSS_ESC(fk)}"]`); if (el) el.focus({ preventScroll: true }); }
    }
    const onDown = () => { pressing = true; };
    const onUp = () => { setTimeout(() => { pressing = false; if (pending && alive) refreshParts(); }, 0); };
    function doPing() {
      const w = W(), n = NET();
      const src = kind() === 'eui' ? 'PCB' : w.psrc;
      const tgt = (w.ptarget || '').trim();
      if (!tgt) { w.ping = { r: { ok: false, out: ['(ยังไม่ได้กรอก address ปลายทาง)'], text: 'กรอก IPv6 address ปลายทาง หรือกดปุ่มชื่อเครื่องเพื่อเติม', trace: [] } }; setPart('pingres', pingResult()); return; }
      const r = n.ping(src, tgt);
      w.ping = { r, src, target: tgt };
      if (kind() === 'eui') { w.verify = tgt; if (r.ok && (r.reached === 'PCA' || (Array.isArray(r.path) && r.path[r.path.length - 1] === 'PCA'))) w.pingedA = true; }
      if (kind() === 'lab') { setPart('topo', topoSVG(n, { ids: r.path, ok: r.ok })); setPart('status', statusView(n)); }
      setPart('pingres', pingResult());
      if (kind() === 'eui') render();   // the submit card shows which ping will be sent as verification
      save();
    }

    function onClick(ev) {
      const b = ev.target.closest('[data-act]');
      if (!b || !root.contains(b) || b.disabled) return;
      const act = b.getAttribute('data-act'), w = mission() ? W() : null;
      if (act !== 'reset' && w) w.confirmReset = false;
      if (EMB && (act === 'mission' || act === 'tools')) return;
      if (act === 'mission') { S.mid = b.getAttribute('data-id'); const k = kind(); render(); if ((k === 'notation' || k === 'eui') && !W().problem && !W().busy) newProblem(); return; }
      if (act === 'tools') { S.mid = null; render(); return; }
      if (act === 'hint') { w.hints = Math.min((mission().hints || []).length, w.hints + 1); render(); return; }
      if (act === 'new') { newProblem(); return; }
      if (act === 'submit') { submit(); return; }
      if (act === 'reset') {
        if (!w.confirmReset) { w.confirmReset = true; render(); return; }
        w.confirmReset = false; w.cfg = {}; w.ping = null; w.result = null; w.nc = null; delete S.nets[S.mid]; render(); return;
      }
      if (act === 'sel') { w.sel = b.getAttribute('data-id'); render(); return; }
      if (act === 'tab') { w.tab = b.getAttribute('data-v'); setPart('status', statusView(NET())); const f = root.querySelector(`[data-fk="tab-${w.tab}"]`); if (f) f.focus({ preventScroll: true }); return; }
      if (act === 'addroute') { routesOf(b.getAttribute('data-dev')).push({ prefix: '', via: '', iface: '' }); rebuild(); render(); const f = root.querySelectorAll('[data-route$="|prefix"]'); if (f.length) f[f.length - 1].focus(); return; }
      if (act === 'delroute') { routesOf(b.getAttribute('data-dev')).splice(Number(b.getAttribute('data-i')), 1); rebuild(); if (w.ping) w.ping.stale = true; render(); return; }
      if (act === 'fill') { w.ptarget = b.getAttribute('data-v'); const t = root.querySelector('[data-ptarget]'); if (t) { t.value = w.ptarget; t.focus(); } return; }
      if (act === 'ping') { doPing(); return; }
      if (act === 'matrix') { w.showMx = !w.showMx; render(); return; }
      if (act === 'showA') { w.showA = !w.showA; render(); return; }
    }
    function onInput(ev) {
      const t = ev.target;
      if (t.hasAttribute('data-ans')) { W().answers[t.getAttribute('data-ans')] = t.value.slice(0, 80); save(); return; }
      if (t.hasAttribute('data-ptarget')) { W().ptarget = t.value.slice(0, 80); return; }
      if (t.hasAttribute('data-tool')) { S.tool[t.getAttribute('data-tool')] = t.value.slice(0, 80); if (t.getAttribute('data-tool') === 'mac') setPart('tool-mac', toolMac()); else setPart('tool-addr', toolAddr()); return; }
      if (t.hasAttribute('data-cfg') && t.type === 'text') { const [dev, ifId, field] = t.getAttribute('data-cfg').split('|'); const w = W(); const c = w.cfg[dev] = w.cfg[dev] || {}; c.ifaces = c.ifaces || {}; (c.ifaces[ifId] = c.ifaces[ifId] || {})[field] = t.value.slice(0, 64); return; }
      if (t.hasAttribute('data-route') && t.tagName === 'INPUT') { const [dev, i, field] = t.getAttribute('data-route').split('|'); const r = routesOf(dev)[Number(i)]; if (r) r[field] = t.value.slice(0, 70); return; }
    }
    function onChange(ev) {
      const t = ev.target;
      if (t.hasAttribute('data-ans')) { W().answers[t.getAttribute('data-ans')] = t.value.slice(0, 80); save(); return; }
      if (t.hasAttribute('data-psrc')) { W().psrc = t.value; return; }
      if (t.hasAttribute('data-cfg')) {
        const spec = t.getAttribute('data-cfg');
        if (t.type === 'checkbox') { setCfg(spec, t.checked); refresh(); return; }
        if (t.type === 'radio') { setCfg(spec, t.value); rebuild(); if (W().ping) W().ping.stale = true; render(); return; }
        setCfg(spec, t.value.trim().slice(0, 64)); refresh(); return;
      }
      if (t.hasAttribute('data-route')) { const [dev, i, field] = t.getAttribute('data-route').split('|'); const r = routesOf(dev)[Number(i)]; if (r) r[field] = t.value.trim().slice(0, 70); refresh(); return; }
    }
    function onKey(ev) {
      const t = ev.target;
      if ((ev.key === 'Enter' || ev.key === ' ') && t.getAttribute && t.getAttribute('role') === 'button' && t.hasAttribute('data-act')) { ev.preventDefault(); onClick({ target: t }); return; }
      if (ev.key === 'Enter' && t.hasAttribute && t.hasAttribute('data-ptarget')) { ev.preventDefault(); doPing(); return; }
      if (ev.key === 'Enter' && t.tagName === 'INPUT' && (t.hasAttribute('data-cfg') || t.hasAttribute('data-route')) && t.type === 'text') { ev.preventDefault(); onChange({ target: t }); }
    }

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKey);
    root.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    render();
    { const k = kind(); if ((k === 'notation' || k === 'eui') && !W().problem) newProblem(); }

    return {
      destroy() {
        alive = false; save();
        root.removeEventListener('click', onClick);
        root.removeEventListener('input', onInput);
        root.removeEventListener('change', onChange);
        root.removeEventListener('keydown', onKey);
        root.removeEventListener('pointerdown', onDown);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        root.innerHTML = '';
      }
    };
  }

  window.NL_SIMS = window.NL_SIMS || {};
  window.NL_SIMS.ipv6 = { title: 'ห้องปฏิบัติการ IPv6', mount };
})();
