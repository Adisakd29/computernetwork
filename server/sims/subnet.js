'use strict';
// Subnetting Simulator — server grader (see docs/SIM-SPEC.md §2 and §4.2).
// generate(missionId, rand) builds a problem WITHOUT answers; grade() recomputes the answers from the
// (HMAC-signed) problem and compares field by field, giving partial credit and Thai feedback.

const MAX = 10;
const MAX_STR = 40;

// ---------------------------------------------------------------------------------------------
// IPv4 helpers (unsigned 32-bit ints)
const ipToInt = (s) => {
  if (typeof s !== 'string') return null;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  let n = 0;
  for (let i = 1; i <= 4; i++) { const o = Number(m[i]); if (o > 255) return null; n = n * 256 + o; }
  return n;
};
const intToIp = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
const maskInt = (p) => (p <= 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0);
const netOf = (ip, p) => (ip & maskInt(p)) >>> 0;
const bcastOf = (ip, p) => (netOf(ip, p) + Math.pow(2, 32 - p) - 1) >>> 0;
const hostsIn = (p) => (p >= 31 ? 0 : Math.pow(2, 32 - p) - 2);
const prefixFromMaskInt = (m) => {
  const inv = (~m) >>> 0;
  if ((inv & (inv + 1)) !== 0) return null; // not contiguous
  let p = 0; for (let i = 31; i >= 0; i--) { if ((m >>> i) & 1) p++; else break; }
  return p;
};
const classOf = (ip) => { const o = ip >>> 24; return o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D' : 'E'; };
const classPrefix = { A: 8, B: 16, C: 24 };

// ---------------------------------------------------------------------------------------------
// Answer parsing (all ignore spaces; return undefined for empty, null for bad format)
const clean = (v) => (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, MAX_STR).replace(/\s+/g, '') : '';
const parse = {
  ip(v) { const s = clean(v); return s === '' ? undefined : ipToInt(s); },
  // prefix: "/27" or "27"; mask: also "255.255.255.224"
  prefix(v) { const s = clean(v); if (s === '') return undefined; const m = /^\/?(\d{1,2})$/.exec(s); if (!m) return null; const p = Number(m[1]); return p <= 32 ? p : null; },
  mask(v) {
    const s = clean(v); if (s === '') return undefined;
    const p = parse.prefix(s); if (p !== null && p !== undefined) return p;
    const m = ipToInt(s); return m === null ? null : prefixFromMaskInt(m);
  },
  num(v) { const s = clean(v).replace(/,/g, ''); if (s === '') return undefined; return /^\d{1,10}$/.test(s) ? Number(s) : null; },
  cls(v) { const s = clean(v).toUpperCase().replace(/^(CLASS|คลาส)/, ''); if (s === '') return undefined; return /^[ABCDE]$/.test(s) ? s : null; },
  yesno(v) {
    const s = clean(v).toLowerCase(); if (s === '') return undefined;
    if (['yes', 'y', 'true', 'ใช่', 'same'].includes(s)) return true;
    if (['no', 'n', 'false', 'ไม่ใช่', 'ไม่', 'different'].includes(s)) return false;
    return null;
  }
};

// ---------------------------------------------------------------------------------------------
// Field definitions: label (Thai/English), type (parser), reason shown when wrong (no answer key)
const FIELD = {
  cls: { label: 'Class ของ IP', type: 'cls', ph: 'A / B / C', why: 'ดูจาก octet แรก: Class A = 1–126, B = 128–191, C = 192–223' },
  mask: { label: 'Subnet mask', type: 'mask', ph: 'x.x.x.x หรือ /n', why: 'เขียนบิต 1 ให้ครบตามจำนวน prefix แล้วแปลงทีละ octet (11100000 = 224)' },
  prefix: { label: 'Prefix length', type: 'prefix', ph: '/n', why: 'นับจำนวนบิต 1 ใน subnet mask (255 = 8 บิต, 240 = 4 บิต, 224 = 3 บิต ...)' },
  network: { label: 'Network address', type: 'ip', ph: 'x.x.x.x', why: 'หา block size = 256 − ค่า mask ใน octet ที่สนใจ แล้วปัดค่า octet ของ IP ลงเป็นพหุคูณของ block size และ octet ถัดไปเป็น 0' },
  broadcast: { label: 'Broadcast address', type: 'ip', ph: 'x.x.x.x', why: 'broadcast = network ถัดไป − 1 (บิตส่วน host เป็น 1 ทั้งหมด)' },
  first: { label: 'First usable host', type: 'ip', ph: 'x.x.x.x', why: 'host แรก = network address + 1' },
  last: { label: 'Last usable host', type: 'ip', ph: 'x.x.x.x', why: 'host สุดท้าย = broadcast address − 1' },
  hosts: { label: 'จำนวน host ที่ใช้ได้', type: 'num', ph: 'ตัวเลข', why: 'ใช้สูตร 2^h − 2 โดย h = จำนวนบิต host = 32 − prefix' },
  netA: { label: 'Network address ของ IP A', type: 'ip', ph: 'x.x.x.x', why: 'ใช้ mask เดียวกัน หา block size แล้วปัดค่า octet ที่สนใจของ IP A ลง' },
  netB: { label: 'Network address ของ IP B', type: 'ip', ph: 'x.x.x.x', why: 'ใช้ mask เดียวกัน หา block size แล้วปัดค่า octet ที่สนใจของ IP B ลง' },
  same: { label: 'อยู่ subnet เดียวกันหรือไม่', type: 'yesno', ph: 'ใช่ / ไม่ใช่', why: 'สอง IP อยู่วงเดียวกันก็ต่อเมื่อ network address ที่คำนวณได้เท่ากัน' },
  count: { label: 'จำนวน subnet ที่แบ่งได้', type: 'num', ph: 'ตัวเลข', why: 'จำนวน subnet = 2^(prefix ใหม่ − prefix เดิม) (นับ subnet แรกด้วย)' },
  hostsPer: { label: 'จำนวน host ต่อ subnet', type: 'num', ph: 'ตัวเลข', why: 'ใช้สูตร 2^h − 2 โดย h = 32 − prefix ใหม่' },
  nth: { label: 'Network address ของ subnet ลำดับที่ k', type: 'ip', ph: 'x.x.x.x', why: 'network ลำดับที่ k = network แรก + (k − 1) × ขนาด block (อย่าลืมทดไป octet ซ้าย เมื่อเกิน 255)' },
  forN: { label: 'Prefix ที่เล็กที่สุดที่รองรับ N hosts', type: 'mask', ph: '/n หรือ x.x.x.x', why: 'หาค่า h ที่น้อยที่สุดที่ 2^h − 2 ≥ N แล้ว prefix = 32 − h' }
};

const MISSIONS = [
  { id: 's1', level: 'easy', title: 'Classful: หา Class, Mask และช่วง IP',
    desc: 'ได้ IP มา 1 ตัว (ไม่บอก mask) ให้ระบุ Class และใช้ default mask ของ Class นั้น (/8, /16, /24) หา network, broadcast, host แรก/สุดท้าย และจำนวน host',
    hints: ['Class A: octet แรก 1–126 → /8 (255.0.0.0), Class B: 128–191 → /16, Class C: 192–223 → /24',
      'แบบ classful ส่วน host คือ octet ที่ไม่ใช่ network ทั้งก้อน: network ให้เป็น 0 ทั้งหมด, broadcast ให้เป็น 255 ทั้งหมด',
      'จำนวน host = 2^h − 2 เช่น /24 → 2^8 − 2 = 254'],
    fields: ['cls', 'mask', 'network', 'broadcast', 'first', 'last', 'hosts'] },
  { id: 's2', level: 'easy', title: 'แบ่ง Class C ด้วย /25 และ /26',
    desc: 'IP Class C ที่ใช้ prefix /25 หรือ /26 ให้หา subnet mask, network, broadcast, host แรก/สุดท้าย และจำนวน host',
    hints: ['/25 → mask octet สุดท้าย = 128 (10000000), /26 → 192 (11000000)',
      'block size = 256 − ค่า mask ใน octet สุดท้าย เช่น 256 − 192 = 64 → วงคือ 0, 64, 128, 192',
      'ดูว่า octet สุดท้ายของ IP อยู่ในวงไหน เช่น .77 อยู่ในวง 64–127 → network .64, broadcast .127'],
    fields: ['mask', 'network', 'broadcast', 'first', 'last', 'hosts'] },
  { id: 's3', level: 'medium', title: 'หาค่าทุกช่องจาก IP/prefix (ทุก Class)',
    desc: 'IP พร้อม prefix ระหว่าง /17 ถึง /30 (Class A, B หรือ C) ให้หาทุกค่า: mask, network, broadcast, host แรก/สุดท้าย, จำนวน host',
    hints: ['หา "octet ที่สนใจ" ก่อน: /17–/24 คือ octet ที่ 3, /25–/30 คือ octet ที่ 4',
      'block size = 256 − ค่า mask ใน octet ที่สนใจ; octet ทางขวาของ octet ที่สนใจ: network = 0, broadcast = 255',
      'เช่น 172.16.77.9/20: mask 255.255.240.0, block 16 → 77 อยู่ในวง 64–79 → network 172.16.64.0, broadcast 172.16.79.255'],
    fields: ['mask', 'network', 'broadcast', 'first', 'last', 'hosts'] },
  { id: 's4', level: 'medium', title: 'โจทย์ให้ Subnet mask แบบจุดทศนิยม',
    desc: 'ได้ IP และ subnet mask แบบ 255.255.x.x ให้แปลงเป็น prefix (/n) แล้วหา network, broadcast, host แรก/สุดท้าย และจำนวน host',
    hints: ['แปลง mask ทีละ octet: 255 = 8 บิต, 254 = 7, 252 = 6, 248 = 5, 240 = 4, 224 = 3, 192 = 2, 128 = 1',
      'prefix = ผลรวมจำนวนบิต 1 ทุก octet เช่น 255.255.255.240 = 8+8+8+4 = /28',
      'block size = 256 − ค่า mask ใน octet ที่ไม่ใช่ 255 และไม่ใช่ 0'],
    fields: ['prefix', 'network', 'broadcast', 'first', 'last', 'hosts'] },
  { id: 's5', level: 'medium', title: 'สอง IP อยู่วงเดียวกันหรือไม่?',
    desc: 'ได้ IP A และ IP B ที่ใช้ prefix เดียวกัน ให้หา network address ของแต่ละตัว แล้วตอบว่าอยู่ subnet เดียวกันหรือไม่ (ถ้าไม่ใช่ จะ ping หากันตรง ๆ ไม่ได้ ต้องผ่าน router)',
    hints: ['ใช้ block size เดียวกันกับทั้งสอง IP', 'ถ้า network address เท่ากัน = อยู่วงเดียวกัน'],
    fields: ['netA', 'netB', 'same'] },
  { id: 's6', level: 'hard', title: 'แบ่ง Subnet: กี่วง กี่ host และเลือก prefix',
    desc: 'ได้ block ใหญ่ /y ให้แบ่งเป็น subnet ย่อยขนาด /x: หาจำนวน subnet, จำนวน host ต่อ subnet, network ของ subnet ลำดับที่ k และเลือก prefix ที่เล็กที่สุดที่รองรับ N hosts',
    hints: ['จำนวน subnet = 2^(x − y) เช่น /24 แบ่งเป็น /27 ได้ 2^3 = 8 วง (นับ subnet แรกด้วย)',
      'ขนาด block ของ /x = 2^(32 − x) addresses เช่น /27 = 32 → subnet ที่ k เริ่มที่ (k − 1) × 32',
      'N hosts: หา h ที่น้อยที่สุดที่ 2^h − 2 ≥ N เช่น 50 hosts → h = 6 (62 hosts) → /26'],
    fields: ['count', 'hostsPer', 'nth', 'forN'] },
  { id: 's7', level: 'hard', title: 'VLSM: จัดสรร 3–5 subnet ให้พอดีความต้องการ',
    desc: 'ได้ block และความต้องการ host ของแต่ละห้อง ให้จัดสรรแบบ VLSM โดยเรียงจาก subnet ที่ต้องการ host มากที่สุดก่อน (largest-first) เริ่มจากต้น block แล้วต่อกันไปเรื่อย ๆ ตอบ network และ prefix ของแต่ละห้อง',
    hints: ['ขั้นที่ 1: เรียงห้องจาก host มาก → น้อย', 'ขั้นที่ 2: แต่ละห้องเลือก h ที่น้อยที่สุดที่ 2^h − 2 ≥ จำนวน host → prefix = 32 − h, ขนาด block = 2^h',
      'ขั้นที่ 3: ห้องแรกเริ่มที่ network ของ block, ห้องถัดไปเริ่มที่ network ก่อนหน้า + ขนาด block ก่อนหน้า',
      'ลิงก์ WAN ระหว่าง router 2 ตัวต้องการ 2 hosts → /30'],
    fields: null }
].map((m) => Object.assign({ max: MAX }, m));

// ---------------------------------------------------------------------------------------------
// Generation
const ri = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const octs = (a, b, c, d) => ((a * 256 + b) * 256 + c) * 256 + d;

function randomBase(rand, cls) {
  const o = () => ri(rand, 0, 255);
  if (cls === 'A') return rand() < 0.5 ? octs(10, o(), o(), o()) : octs(pick(rand, [ri(rand, 1, 9), ri(rand, 11, 126)]), o(), o(), o());
  if (cls === 'B') return rand() < 0.5 ? octs(172, ri(rand, 16, 31), o(), o()) : octs(ri(rand, 128, 191), o(), o(), o());
  return rand() < 0.5 ? octs(192, 168, o(), o()) : octs(ri(rand, 192, 223), o(), o(), o());
}
// a usable host (not network, not broadcast) inside the subnet of `base`
function hostIn(rand, base, p) {
  const size = Math.pow(2, 32 - p);
  return netOf(base, p) + 1 + Math.floor(rand() * (size - 2));
}
const fieldList = (keys) => keys.map((k) => ({ key: k, label: FIELD[k].label, type: FIELD[k].type, ph: FIELD[k].ph }));
const VLSM_NAMES = ['ห้องคอม 1', 'ห้องคอม 2', 'ห้องคอม 3', 'ห้องธุรการ', 'ห้องพักครู', 'ห้อง Server', 'Wi-Fi นักเรียน', 'ห้องสมุด'];

function generate(missionId, rand) {
  if (typeof rand !== 'function') rand = Math.random;
  const m = MISSIONS.find((x) => x.id === missionId);
  if (!m) return null;
  const base = { v: 1, mission: m.id };
  if (m.id === 's1') {
    const cls = pick(rand, ['A', 'B', 'C']);
    const p = classPrefix[cls];
    return Object.assign(base, { kind: 'host', ip: intToIp(hostIn(rand, randomBase(rand, cls), p)), fields: fieldList(m.fields) });
  }
  if (m.id === 's2') {
    const p = pick(rand, [25, 26]);
    return Object.assign(base, { kind: 'host', ip: intToIp(hostIn(rand, randomBase(rand, 'C'), p)), prefix: p, fields: fieldList(m.fields) });
  }
  if (m.id === 's3' || m.id === 's4') {
    const cls = pick(rand, ['A', 'B', 'C']);
    const p = cls === 'C' ? ri(rand, 25, 30) : ri(rand, 17, 30);
    const ip = intToIp(hostIn(rand, randomBase(rand, cls), p));
    return Object.assign(base, m.id === 's3' ? { kind: 'host', ip, prefix: p } : { kind: 'host', ip, mask: intToIp(maskInt(p)) }, { fields: fieldList(m.fields) });
  }
  if (m.id === 's5') {
    const cls = pick(rand, ['A', 'B', 'C']);
    const p = cls === 'C' ? ri(rand, 25, 29) : ri(rand, 18, 29);
    const a = hostIn(rand, randomBase(rand, cls), p);
    const size = Math.pow(2, 32 - p);
    const net = netOf(a, p);
    let b;
    if (rand() < 0.5) { // same subnet, different host when possible
      b = hostIn(rand, net, p);
      for (let i = 0; i < 5 && b === a; i++) b = hostIn(rand, net, p);
    } else { // neighbouring subnet (tricky: numbers look close)
      const up = rand() < 0.5;
      const nb = up ? net + size : net - size;
      b = hostIn(rand, (nb >= 0 && nb + size <= 0x100000000) ? nb : net + (up ? -size : size), p);
    }
    return Object.assign(base, { kind: 'same', ipA: intToIp(a), ipB: intToIp(b), prefix: p, fields: fieldList(m.fields) });
  }
  if (m.id === 's6') {
    const y = ri(rand, 16, 26);
    const x = y + ri(rand, 1, Math.min(6, 30 - y));
    const block = netOf(randomBase(rand, y >= 24 ? 'C' : pick(rand, ['A', 'B'])), y);
    const count = Math.pow(2, x - y);
    const k = ri(rand, 2, count);
    const h = ri(rand, 3, 12);
    const n = ri(rand, Math.pow(2, h - 1) - 1, Math.pow(2, h) - 2);
    const fields = fieldList(m.fields).map((f) => f.key === 'nth' ? Object.assign(f, { label: 'Network address ของ subnet ลำดับที่ ' + k })
      : f.key === 'forN' ? Object.assign(f, { label: 'Prefix ที่เล็กที่สุดที่รองรับ ' + n + ' hosts' }) : f);
    return Object.assign(base, { kind: 'count', block: intToIp(block), prefix: y, x, k, n, fields });
  }
  if (m.id === 's7') {
    const b = pick(rand, [24, 24, 24, 23, 22]);
    const H = 32 - b;
    const k = ri(rand, 3, 5);
    const pool = []; for (let h = 2; h <= H - 1; h++) pool.push(h);
    const hs = [];
    while (hs.length < k) hs.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    const names = VLSM_NAMES.slice();
    const reqs = hs.map((h) => {
      if (h === 2) return { name: 'ลิงก์ WAN (Router–Router)', hosts: 2 };
      return { name: names.splice(Math.floor(rand() * names.length), 1)[0], hosts: ri(rand, Math.pow(2, h - 1) - 1, Math.pow(2, h) - 2) };
    });
    const block = netOf(randomBase(rand, b === 24 ? 'C' : pick(rand, ['A', 'B'])), b);
    const fields = [];
    reqs.forEach((r, i) => {
      fields.push({ key: 'net' + i, label: 'Network ของ ' + r.name, type: 'ip', ph: 'x.x.x.x', row: i });
      fields.push({ key: 'pre' + i, label: 'Prefix ของ ' + r.name, type: 'mask', ph: '/n', row: i });
    });
    return Object.assign(base, { kind: 'vlsm', block: intToIp(block), prefix: b, reqs, fields });
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Solving (from the problem only) → { key: { type, value, label, why } }
const isInt = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const prefixForHosts = (n) => { let h = 2; while (Math.pow(2, h) - 2 < n) h++; return 32 - h; };

function vlsmPlan(blockInt, b, reqs) {
  const order = reqs.map((r, i) => ({ i, hosts: r.hosts })).sort((x, y) => y.hosts - x.hosts || x.i - y.i);
  let next = blockInt; const out = [];
  for (const o of order) {
    const p = prefixForHosts(o.hosts); const size = Math.pow(2, 32 - p);
    out[o.i] = { net: next, prefix: p };
    next += size;
  }
  return { alloc: out, end: next, fits: next <= blockInt + Math.pow(2, 32 - b) };
}

function solve(missionId, problem) {
  const m = MISSIONS.find((x) => x.id === missionId);
  if (!m || !problem || typeof problem !== 'object' || problem.mission !== missionId) return null;
  const F = (key, value, extra) => Object.assign({ type: FIELD[key].type, value, label: FIELD[key].label, why: FIELD[key].why }, extra || {});
  const pr = problem;
  if (m.id === 's1' || m.id === 's2' || m.id === 's3' || m.id === 's4') {
    const ip = ipToInt(pr.ip); if (ip === null) return null;
    let p;
    if (m.id === 's1') { const c = classOf(ip); p = classPrefix[c]; if (!p) return null; }
    else if (m.id === 's4') { const mk = ipToInt(pr.mask); p = mk === null ? null : prefixFromMaskInt(mk); }
    else p = pr.prefix;
    if (!isInt(p, 8, 30)) return null;
    const net = netOf(ip, p), bc = bcastOf(ip, p);
    const r = {
      network: F('network', net), broadcast: F('broadcast', bc), first: F('first', net + 1), last: F('last', bc - 1), hosts: F('hosts', hostsIn(p))
    };
    if (m.id === 's1') r.cls = F('cls', classOf(ip));
    if (m.id === 's4') r.prefix = F('prefix', p); else r.mask = F('mask', p);
    return r;
  }
  if (m.id === 's5') {
    const a = ipToInt(pr.ipA), b = ipToInt(pr.ipB), p = pr.prefix;
    if (a === null || b === null || !isInt(p, 8, 30)) return null;
    return { netA: F('netA', netOf(a, p)), netB: F('netB', netOf(b, p)), same: F('same', netOf(a, p) === netOf(b, p)) };
  }
  if (m.id === 's6') {
    const blk = ipToInt(pr.block), y = pr.prefix, x = pr.x, k = pr.k, n = pr.n;
    if (blk === null || !isInt(y, 8, 29) || !isInt(x, y + 1, 30) || !isInt(k, 1, Math.pow(2, x - y)) || !isInt(n, 1, 1 << 24)) return null;
    const size = Math.pow(2, 32 - x);
    return {
      count: F('count', Math.pow(2, x - y)), hostsPer: F('hostsPer', hostsIn(x)),
      nth: F('nth', netOf(blk, y) + (k - 1) * size, { label: 'Network address ของ subnet ลำดับที่ ' + k }),
      forN: F('forN', prefixForHosts(n), { label: 'Prefix ที่เล็กที่สุดที่รองรับ ' + n + ' hosts' })
    };
  }
  if (m.id === 's7') {
    const blk = ipToInt(pr.block), b = pr.prefix;
    if (blk === null || !isInt(b, 8, 29) || !Array.isArray(pr.reqs) || pr.reqs.length < 1 || pr.reqs.length > 8) return null;
    if (!pr.reqs.every((r) => r && typeof r.name === 'string' && isInt(r.hosts, 1, 1 << 22))) return null;
    const plan = vlsmPlan(netOf(blk, b), b, pr.reqs);
    if (!plan.fits) return null;
    const r = {};
    pr.reqs.forEach((q, i) => {
      const name = String(q.name).slice(0, 60);
      r['net' + i] = { type: 'ip', value: plan.alloc[i].net, label: 'Network ของ ' + name,
        why: 'เรียงห้องจาก host มากไปน้อย แล้ววางต่อกันตั้งแต่ต้น block (network ถัดไป = network ก่อนหน้า + ขนาด block ก่อนหน้า)' };
      r['pre' + i] = { type: 'mask', value: plan.alloc[i].prefix, label: 'Prefix ของ ' + name,
        why: 'เลือก h ที่น้อยที่สุดที่ 2^h − 2 ≥ ' + q.hosts + ' hosts แล้ว prefix = 32 − h' };
    });
    return r;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Grading
function fail(msg) { return { score: 0, max: MAX, ok: false, feedback: [msg], details: { fields: {}, correct: 0, total: 0 } }; }

function grade(missionId, payload, problem) {
  try {
    if (!MISSIONS.some((m) => m.id === missionId)) return fail('ไม่พบภารกิจนี้');
    const key = solve(missionId, problem);
    if (!key) return fail('โจทย์ไม่ถูกต้องหรือหมดอายุ กรุณากด "โจทย์ใหม่" แล้วลองอีกครั้ง');
    const answers = payload && typeof payload === 'object' && payload.answers && typeof payload.answers === 'object' && !Array.isArray(payload.answers) ? payload.answers : null;
    if (!answers) return fail('ไม่พบคำตอบที่ส่งมา กรุณากรอกคำตอบในช่องแล้วกด "ตรวจคำตอบ"');
    const fields = {}; const feedback = []; let correct = 0; let empty = 0;
    const keys = Object.keys(key);
    for (const k of keys) {
      const exp = key[k];
      const raw = Object.prototype.hasOwnProperty.call(answers, k) ? answers[k] : undefined;
      const got = parse[exp.type](raw);
      let ok = false;
      if (got === undefined) { empty++; feedback.push('ยังไม่ได้กรอก ' + exp.label); }
      else if (got === null) {
        const fmt = exp.type === 'ip' ? 'เช่น 192.168.1.64' : exp.type === 'mask' ? 'เช่น 255.255.255.192 หรือ /26' : exp.type === 'prefix' ? 'เช่น /26' : exp.type === 'num' ? 'ใส่เป็นตัวเลข เช่น 62' : exp.type === 'cls' ? 'ตอบ A, B หรือ C' : 'ตอบ ใช่ หรือ ไม่ใช่';
        feedback.push(exp.label + ': รูปแบบไม่ถูกต้อง (' + fmt + ')');
      } else if (got === exp.value) { ok = true; correct++; }
      else {
        let msg = exp.label + ' ไม่ถูกต้อง — ' + exp.why;
        if ((k === 'hosts' || k === 'hostsPer') && got === exp.value + 2) msg = exp.label + ' ไม่ถูกต้อง — เกือบแล้ว! อย่าลืมลบ 2 (network address และ broadcast address ใช้กับเครื่องไม่ได้)';
        else if (exp.type === 'ip' && key.broadcast && k === 'network' && got === key.broadcast.value) msg = exp.label + ' ไม่ถูกต้อง — ค่าที่ตอบคือ broadcast ของวงนี้ network ต้องเป็นค่าแรกของวง';
        else if (exp.type === 'ip' && (got >>> 8) === (exp.value >>> 8) && k !== 'nth' && /^(network|netA|netB|broadcast)$/.test(k)) msg += ' (3 octet แรกถูกแล้ว ตรวจ octet สุดท้ายอีกครั้ง)';
        feedback.push(msg);
      }
      fields[k] = ok;
    }
    const total = keys.length;
    let score = correct === total ? MAX : Math.min(MAX - 1, Math.round((MAX * correct) / total));
    if (empty === total) { score = 0; feedback.unshift('ยังไม่ได้กรอกคำตอบเลย'); }
    if (correct === total) feedback.unshift('ถูกต้องทุกช่อง เยี่ยมมาก!');
    else feedback.unshift('ถูก ' + correct + ' จาก ' + total + ' ช่อง ดูคำอธิบายช่องที่ผิดด้านล่าง แล้วลองดูวิธีทำทีละขั้น');
    return { score, max: MAX, ok: score === MAX, feedback, details: { fields, correct, total } };
  } catch (e) {
    return fail('ตรวจคำตอบไม่ได้ (ข้อมูลไม่ถูกต้อง)');
  }
}

module.exports = {
  id: 'subnet',
  title: 'จำลองการคำนวณ Subnet',
  missions: MISSIONS.map((m) => ({ id: m.id, title: m.title, level: m.level, desc: m.desc, max: m.max, hints: m.hints })),
  generate,
  grade,
  // exported for tests/tools only (not used by the app)
  _internal: { ipToInt, intToIp, prefixFromMaskInt, parse }
};
