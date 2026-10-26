'use strict';
/*
 * IPv6 Lab "ห้องปฏิบัติการ IPv6" - server grader (NetLab, SIM-SPEC §2)
 * The engine is shared with the browser: public/js/sim/ipv6.js (UMD; under Node it exports only the engine V6).
 *
 * v1 notation (generated, signed): problem { v:1, mission:'v1', items:[{ task:'compress'|'expand', show }] }
 *    payload { answers: { a0..aN: text, t0..tN: type code } }
 * v2 EUI-64 (generated, signed):   problem { v:1, mission:'v2', macs:[3 MAC strings] }
 *    payload { answers: { eui0..2, ll0..2 }, verify: 'fe80::...' (target the student pinged from PC-B) }
 * v3-v5 network labs:              payload { cfg: { [devId]: { ifaces: { [ifId]: {...} }, routes:[...] } } }
 *    The grader applies ONLY whitelisted fields (V6.applyConfig) onto the mission's own topology, rebuilds the
 *    network with the engine (SLAAC, DAD, RA, routing, NDP) and runs every ping itself. Client scores are never used.
 */
const path = require('path');
const V6 = require(path.join(__dirname, '../../public/js/sim/ipv6.js'));

const MAX = 10;
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const sv = (v, n) => (typeof v === 'string' ? v : '').slice(0, n || 64);
const fail = (msg, max) => ({ score: 0, max: max || MAX, ok: false, feedback: [msg], details: {} });
const tooBig = (p, n) => { try { return JSON.stringify(p === undefined ? null : p).length > n; } catch (e) { return true; } };
const C = w => V6.compress(w);
const P = s => V6.parse(s);

const LAB_TH = { guided: 'ฝึกตามขั้นตอน (Guided Lab)', independent: 'ฝึกเอง (Independent Lab)', troubleshooting: 'ฝึกแก้ปัญหา (Troubleshooting)' };
const TYPES = ['global', 'link-local', 'unique-local', 'multicast', 'loopback', 'unspecified'];

const missions = [
  { id: 'v1', level: 'easy', title: 'ย่อและขยาย IPv6 address พร้อมระบุชนิด',
    desc: 'ฝึกตามขั้นตอน (Guided Lab) สัปดาห์ 8: ได้ IPv6 address แบบสุ่ม 4 ข้อ ให้ย่อ (compress) ตามกฎ RFC 5952 หรือขยาย (expand) เป็นรูปเต็ม 8 กลุ่ม กลุ่มละ 4 หลัก แล้วระบุชนิดของ address แต่ละข้อ ตรวจทีละข้อ',
    hints: ['ย่อ: ตัด 0 นำหน้าในแต่ละกลุ่ม (0db8 → db8, 0000 → 0) และเขียนด้วยตัวพิมพ์เล็ก',
      'ใช้ :: แทนกลุ่ม 0 ที่ต่อกันตั้งแต่ 2 กลุ่มขึ้นไปได้ครั้งเดียว เลือกช่วงที่ยาวที่สุด ถ้ายาวเท่ากันให้เลือกช่วงแรก กลุ่ม 0 กลุ่มเดียวห้ามใช้ ::',
      'ขยาย: นับกลุ่มที่เห็นแล้ว :: แทนกลุ่ม 0 ที่ขาดไปจนครบ 8 กลุ่ม แต่ละกลุ่มเติม 0 ด้านหน้าให้ครบ 4 หลัก',
      'ชนิด: 2000::/3 (ขึ้นต้น 2 หรือ 3) = global unicast, fe80::/10 = link-local, fc00::/7 (fc หรือ fd) = unique local, ff00::/8 (ff) = multicast'],
    start: { kind: 'notation', lab: 'guided', week: 8, generated: true } },
  { id: 'v2', level: 'easy', title: 'EUI-64 และ Link-local จาก MAC address',
    desc: 'ฝึกตามขั้นตอน (Guided Lab) สัปดาห์ 8: ได้ MAC address แบบสุ่ม 3 ตัว ให้คำนวณ Interface ID แบบ Modified EUI-64 และ link-local address (fe80::/64) ของแต่ละตัว จากนั้นตรวจในเครื่องจำลองว่า link-local ของ PC-A (MAC ตัวแรก) ตรงกับที่คำนวณ โดย ping จาก PC-B',
    hints: ['แบ่ง MAC เป็นสองครึ่ง ครึ่งละ 3 ไบต์ แล้วแทรก ff:fe ตรงกลาง จะได้ 8 ไบต์ = 64 บิต',
      'กลับบิต U/L (บิตที่ 7 นับจากซ้าย ค่า 0x02) ของไบต์แรก: 00 → 02, 3c → 3e, 52 → 50 (กลับค่า ไม่ใช่ตั้งเป็น 1 เสมอ)',
      'link-local = fe80:0:0:0 ตามด้วย Interface ID 64 บิต เขียนย่อเป็น fe80::xxxx:xxff:fexx:xxxx',
      'ตรวจในเครื่องจำลอง: เลือกต้นทาง PC-B แล้ว ping link-local ที่คำนวณได้ ถ้าตอบกลับแสดงว่าถูก'],
    start: { kind: 'eui', lab: 'guided', week: 8, generated: true } },
  { id: 'v3', level: 'medium', title: 'SLAAC: เปิด RA ให้โฮสต์ตั้งค่าเอง',
    desc: 'ฝึกเอง (Independent Lab) สัปดาห์ 8: ตั้ง R1 G0/0 เป็น 2001:db8:10::1/64 และ G0/1 เป็น 2001:db8:20::1/64 แล้วเปิดการส่ง Router Advertisement (RA) ทั้งสองฝั่ง ให้ PC ทุกเครื่อง (โหมด SLAAC) สร้าง global address ด้วย EUI-64 และได้ default gateway เป็น link-local ของ R1 เอง จากนั้นทดสอบ ping6 ข้ามวงให้ได้ทุกคู่',
    hints: ['RA ประกาศ prefix ของ address ที่ตั้งบน interface ของ router (เช่น 2001:db8:10::1/64 → ประกาศ 2001:db8:10::/64)',
      'SLAAC ใช้ได้เฉพาะ prefix /64 เท่านั้น เพราะ Interface ID แบบ EUI-64 ยาว 64 บิต',
      'อย่าเปลี่ยน PC เป็น Static: ภารกิจนี้ต้องการให้โฮสต์ได้ address อัตโนมัติ',
      'ดูผลที่ ipconfig ของแต่ละ PC: ต้องมี IPv6 Address ขึ้นต้น 2001:db8:10 หรือ 2001:db8:20 และ Default Gateway เป็น fe80::...'],
    start: { kind: 'lab', lab: 'independent', week: 8, topo: V6.MT.v3 } },
  { id: 'v4', level: 'medium', title: 'Static IPv6 ให้ Server และ Static route ระหว่าง 2 Router',
    desc: 'ฝึกเอง (Independent Lab) สัปดาห์ 13: ตั้ง SRV1 เป็น 2001:db8:1::10/64 และ SRV2 เป็น 2001:db8:2::10/64 แบบ Static พร้อม default gateway ให้ถูกต้อง แล้วเพิ่ม static route บน R1 ไปยัง 2001:db8:2::/64 และบน R2 ไปยัง 2001:db8:1::/64 ผ่านลิงก์ WAN (2001:db8:ff::/64) ให้ทุกเครื่องทั้งสองวง ping6 ถึงกันได้',
    hints: ['default gateway ของ server ใช้ link-local ของ router ฝั่งตัวเองได้ (R1 = fe80::1, R2 = fe80::2) หรือ global ของ router ในวงเดียวกัน',
      'route ของ R1: prefix 2001:db8:2::/64 next hop 2001:db8:ff::2 (global ของ R2 บนลิงก์ WAN)',
      'ถ้า next hop เป็น link-local (เช่น fe80::2) ต้องเลือก interface ขาออกด้วย เพราะ link-local ซ้ำกันได้ในต่างลิงก์',
      'ต้องมี route ทั้งขาไปและขากลับ ถ้ามีแค่ฝั่งเดียว Echo Request ไปถึงแต่ Echo Reply กลับไม่ได้'],
    start: { kind: 'lab', lab: 'independent', week: 13, topo: V6.MT.v4 } },
  { id: 'v5', level: 'medium', title: 'แก้ปัญหาเครือข่าย IPv6 ที่เสีย 4 จุด',
    desc: 'ฝึกแก้ปัญหาเพิ่มเติม สัปดาห์ 8: เครือข่ายนี้มีปัญหา ทุกเครื่องควร ping6 ถึงกันได้ทุกคู่ ใช้ ipconfig, neighbor cache และ ping6 หาสาเหตุ แล้วแก้ไขการตั้งค่าให้ถูกต้อง ห้ามเปลี่ยน address ของ SRV (2001:db8:acad:2::10) เพราะผู้ใช้ทั้งหมดอ้างถึง',
    hints: ['เริ่มจาก ping matrix ดูว่าเครื่องไหนเสีย แล้วเปิด ipconfig ของเครื่องนั้น',
      'โฮสต์ที่ใช้ SLAAC แต่ไม่มี global address แปลว่าลิงก์นั้นไม่มี RA',
      'คำว่า (Duplicate) ใน ipconfig หมายถึง DAD พบว่ามีเครื่องอื่นใช้ address เดียวกัน',
      'prefix length ของโฮสต์ใน LAN ต้องเป็น /64 และ default gateway ต้องอยู่บนลิงก์เดียวกับโฮสต์'],
    start: { kind: 'lab', lab: 'troubleshooting', week: 14, topo: V6.MT.v5 } }
].map(m => Object.assign({ max: MAX }, m));

/* ============================================================== generation */
const ri = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
function shuffle(rand, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const nz = (rand, small) => small ? ri(rand, 1, 0xff) : ri(rand, 0x100, 0xffff);      // nonzero group (small = has leading zeros)

function genWords(rand, type) {
  const N = () => nz(rand, rand() < 0.5);
  if (type === 'global') {
    const head = pick(rand, [[0x2001, 0x0db8], [0x2001, 0x0db8], [0x2404, 0x6800], [0x2400, 0xcb00], [0x2a03, 0x2880], [0x2001, 0x0044]]);
    const tpl = pick(rand, ['longest', 'tie', 'single', 'leading', 'end']);
    const T = { longest: ['Z', 'Z', 'N', 'Z', 'Z', 'Z'], tie: ['N', 'Z', 'Z', 'N', 'Z', 'Z'], single: ['N', 'Z', 'N', 'N', 'N', 'N'],
      leading: ['S', 'Z', 'Z', 'Z', 'S', 'S'], end: ['N', 'S', 'Z', 'Z', 'Z', 'Z'] }[tpl];
    return head.concat(T.map(c => c === 'Z' ? 0 : c === 'S' ? nz(rand, true) : N()));
  }
  if (type === 'link-local') {
    const iid = rand() < 0.7 ? [ri(rand, 0, 0xff) * 256 + ri(rand, 0, 0xff) | 0x0200, (ri(rand, 0, 0xff) << 8) | 0xff, 0xfe00 | ri(rand, 0, 0xff), ri(rand, 0, 0xffff)]
      : pick(rand, [[0, 0, 0, ri(rand, 1, 0xff)], [0, 0, ri(rand, 1, 0xff), ri(rand, 1, 0xffff)]]);
    return [0xfe80, 0, 0, 0].concat(iid);
  }
  if (type === 'unique-local') {
    const g = [0xfd00 | ri(rand, 0, 0xff), ri(rand, 1, 0xffff), ri(rand, 1, 0xffff), ri(rand, 1, 0x00ff)];
    return g.concat(pick(rand, [[0, 0, 0, N()], [N(), 0, 0, N()], [0, 0, N(), N()]]));
  }
  // multicast
  return pick(rand, [
    [0xff02, 0, 0, 0, 0, 1, 0xff00 | ri(rand, 0, 0xff), ri(rand, 0, 0xffff)],
    [0xff02, 0, 0, 0, 0, 0, 0, pick(rand, [1, 2, 0xfb, 0x16, 0x1a])],
    [0xff05, 0, 0, 0, 0, 0, 1, 3],
    [0xff0e, 0, 0, 0, 0, 0, ri(rand, 1, 0xff), ri(rand, 1, 0xffff)]
  ]);
}
function genV1(rand) {
  const types = shuffle(rand, ['global', 'link-local', 'unique-local', 'multicast']);
  const tasks = shuffle(rand, ['compress', 'compress', 'expand', 'expand']);
  // the global address is always a "compress" item: it carries the RFC 5952 traps
  const gi = types.indexOf('global');
  if (tasks[gi] !== 'compress') { const j = tasks.indexOf('compress'); [tasks[gi], tasks[j]] = [tasks[j], tasks[gi]]; }
  return { v: 1, mission: 'v1', items: types.map((t, i) => {
    const w = genWords(rand, t);
    const full = V6.expand(w);
    return { task: tasks[i], show: tasks[i] === 'compress' ? (rand() < 0.35 ? full.toUpperCase() : full) : C(w) };
  }) };
}
function genV2(rand) {
  const b = () => ri(rand, 0, 255);
  const oui = pick(rand, [[0x00, 0x14, 0x22], [0x3c, 0x52, 0x82], [0x00, 0x50, 0x56], [0xb8, 0x27, 0xeb], [0xf0, 0x1f, 0xaf], [0x00, 0x1a, 0x2b], [0xa4, 0x5e, 0x60]]);
  const local = pick(rand, [[0x52, 0x54, 0x00], [0x02, 0x42, 0xac], [0x0a, 0x00, 0x27], [0x06, b(), b()]]);
  const randFirst = (b() & 0xfc);                                  // unicast, universally administered
  const macs = [oui.concat([b(), b(), b()]), local.concat([b(), b(), b()]), [randFirst, b(), b(), b(), b(), b()]];
  return { v: 1, mission: 'v2', macs: shuffle(rand, macs).map(m => V6.macStr(m)) };
}
function generate(missionId, rand) {
  if (typeof rand !== 'function') rand = Math.random;
  if (missionId === 'v1') return genV1(rand);
  if (missionId === 'v2') return genV2(rand);
  return null;
}

/* ============================================================== helpers */
function finish(checks, extraFb, details) {
  const total = checks.reduce((s, c) => s + c.pts, 0);
  const max = checks.reduce((s, c) => s + c.max, 0) || MAX;
  const perfect = checks.every(c => c.pts >= c.max - 1e-9);
  const score = perfect ? MAX : Math.min(MAX - 1, Math.round((total / max) * MAX));
  const feedback = [];
  checks.forEach(c => { if (c.msg) feedback.push(c.msg); });
  feedback.push(...(extraFb || []));
  feedback.unshift(perfect ? 'ถูกต้องครบทุกข้อ เยี่ยมมาก!' : `ได้ ${Math.round(total * 10) / 10} จาก ${max} คะแนนย่อย ดูรายละเอียดด้านล่าง`);
  return { score, max: MAX, ok: perfect, feedback, details: Object.assign({ checks: checks.map(c => ({ id: c.id, label: c.label, pts: Math.round(c.pts * 100) / 100, max: c.max, ok: c.pts >= c.max - 1e-9 })) }, details || {}) };
}
const answersOf = p => (isObj(p) && isObj(p.answers) ? p.answers : null);
const ans = (A, k) => (Object.prototype.hasOwnProperty.call(A, k) && typeof A[k] === 'string' ? A[k].slice(0, 80) : '');

/* ============================================================== v1 */
function checkV1Problem(pr) {
  if (!isObj(pr) || pr.mission !== 'v1' || !Array.isArray(pr.items) || pr.items.length < 1 || pr.items.length > 6) return null;
  const items = [];
  for (const it of pr.items) {
    if (!isObj(it) || !['compress', 'expand'].includes(it.task) || typeof it.show !== 'string') return null;
    const p = P(it.show); if (!p.ok) return null;
    items.push({ task: it.task, show: it.show, w: p.w });
  }
  return items;
}
function gradeV1(payload, problem) {
  const items = checkV1Problem(problem);
  if (!items) return fail('โจทย์ไม่ถูกต้องหรือหมดอายุ กด "โจทย์ใหม่" แล้วลองอีกครั้ง');
  if (tooBig(payload, 4000)) return fail('ข้อมูลที่ส่งมาใหญ่เกินไป');
  const A = answersOf(payload);
  if (!A) return fail('ไม่พบคำตอบที่ส่งมา กรอกคำตอบแล้วกด "ตรวจคำตอบ"');
  const checks = [], perItem = [];
  let empty = 0;
  items.forEach((it, i) => {
    const n = i + 1, raw = ans(A, 'a' + i).trim(), tAns = ans(A, 't' + i);
    const want = it.task === 'compress' ? C(it.w) : V6.expand(it.w);
    const lab = `ข้อ ${n} (${it.task === 'compress' ? 'ย่อ' : 'ขยาย'})`;
    let ok = false, msg = '';
    if (!raw) { empty++; msg = `${lab}: ยังไม่ได้กรอกคำตอบ`; }
    else {
      const p = P(raw);
      if (!p.ok) msg = `${lab}: รูปแบบไม่ถูกต้อง — ${p.err}`;
      else if (!V6.eq(p.w, it.w)) {
        const diff = []; for (let g = 0; g < 8; g++) if (p.w[g] !== it.w[g]) diff.push(g + 1);
        let why = `ค่าไม่เท่ากับ address ในโจทย์ (กลุ่มที่ ${diff.slice(0, 4).join(', ')} ไม่ตรง)`;
        if (p.dc && p.gap) {
          const zr = V6.zeroRun(it.w);
          if (zr && p.gap.len !== zr.len && it.task === 'compress') why += ' ตรวจว่า :: แทนกลุ่ม 0 ได้ครบจำนวนหรือไม่';
        }
        if (it.task === 'expand' && it.show.includes('::')) why += ' นับว่า :: ต้องแทนกลุ่ม 0 กี่กลุ่มจึงรวมได้ 8 กลุ่ม';
        if (p.groups.some((g, gi) => g.length === 4 && /0$/.test(g))) why += ' (ตัด 0 ได้เฉพาะเลข 0 ด้านหน้าของกลุ่ม ห้ามตัดด้านหลัง)';
        msg = `${lab}: ${why}`;
      } else if (it.task === 'compress') {
        const iss = V6.canonIssues(raw, p);
        if (iss.length) msg = `${lab}: ค่าถูกต้องแต่ยังไม่ใช่รูปมาตรฐาน RFC 5952 — ${iss.join('; ')}`; else ok = true;
      } else {
        const iss = V6.expandIssues(raw, p);
        if (iss.length) msg = `${lab}: ค่าถูกต้องแต่ยังไม่ใช่รูปเต็ม — ${iss.join('; ')}`; else ok = true;
      }
    }
    checks.push({ id: 'a' + i, label: lab, pts: ok ? 1 : 0, max: 1, msg });
    const tw = V6.typeOf(it.w);
    let tok = false, tmsg = '';
    if (!tAns) { empty++; tmsg = `ข้อ ${n}: ยังไม่ได้เลือกชนิดของ address`; }
    else if (!TYPES.includes(tAns)) tmsg = `ข้อ ${n}: ชนิดที่เลือกไม่อยู่ในตัวเลือก`;
    else if (tAns === tw) tok = true;
    else tmsg = `ข้อ ${n}: ชนิดไม่ถูกต้อง — ดูจากกลุ่มแรก ${V6.expand(it.w).slice(0, 4)}: ${{ global: 'ขึ้นต้นด้วยบิต 001 (2xxx หรือ 3xxx) คือ global unicast 2000::/3', 'link-local': 'fe80 ถึง febf คือ link-local fe80::/10', 'unique-local': 'fc หรือ fd คือ unique local fc00::/7', multicast: 'ff คือ multicast ff00::/8' }[tw] || V6.TYPE_TH[tw]}`;
    checks.push({ id: 't' + i, label: `ข้อ ${n} ชนิด`, pts: tok ? 1 : 0, max: 1, msg: tmsg });
    perItem.push({ notation: ok, type: tok, want: ok ? want : undefined });
  });
  const r = finish(checks, [], { items: perItem });
  if (empty === items.length * 2) { r.score = 0; r.feedback.unshift('ยังไม่ได้กรอกคำตอบเลย'); }
  return r;
}

/* ============================================================== v2 */
function checkV2Problem(pr) {
  if (!isObj(pr) || pr.mission !== 'v2' || !Array.isArray(pr.macs) || pr.macs.length !== 3) return null;
  const out = [];
  for (const m of pr.macs) { const p = V6.parseMac(m); if (!p.ok || (p.b[0] & 1)) return null; out.push(p.b); }
  return out;
}
// interface ID answer: 4 groups ("0214:22ff:fe01:0b11"), or an address whose first 64 bits are 0 ("::214:22ff:fe01:b11")
function parseIid(s) {
  const t = sv(s, 60).trim();
  if (!t) return { ok: false, empty: true };
  if (t.includes('::') || t.split(':').length === 8) {
    const p = P(t); if (!p.ok) return { ok: false, err: p.err };
    if (p.w.slice(0, 4).some(x => x)) return { ok: false, err: 'Interface ID คือ 64 บิตหลังเท่านั้น ไม่ต้องใส่ prefix (ใส่ 4 กลุ่ม เช่น 0214:22ff:fe01:0b11)' };
    return { ok: true, w: p.w.slice(4) };
  }
  const g = t.split(':');
  if (g.some(x => !/^[0-9a-fA-F]{1,4}$/.test(x))) return { ok: false, err: 'แต่ละกลุ่มต้องเป็นเลขฐาน 16 ไม่เกิน 4 หลัก คั่นด้วย : (เช่น 0214:22ff:fe01:0b11)' };
  if (g.length === 3) return { ok: false, err: 'มีเพียง 3 กลุ่ม (48 บิต) เท่ากับ MAC เดิม — EUI-64 ต้องแทรก ff:fe ตรงกลางให้ได้ 64 บิต (4 กลุ่ม)' };
  if (g.length !== 4) return { ok: false, err: `Interface ID ต้องมี 4 กลุ่ม (64 บิต) แต่มี ${g.length} กลุ่ม` };
  return { ok: true, w: g.map(x => parseInt(x, 16)) };
}
function euiWhy(got, mac) {
  const want = V6.eui64(mac);
  const tail = got[1] === want[1] && got[2] === want[2] && got[3] === want[3] && (got[0] & 0xff) === mac[1];
  if (tail && (got[0] >> 8) === mac[0]) {
    return (mac[0] & 0x02) ? 'บิต U/L ของ MAC นี้เป็น 1 อยู่แล้ว การกลับบิตจึงต้องเปลี่ยนเป็น 0 (กลับค่า ไม่ใช่ตั้งเป็น 1 เสมอ)'
      : 'ลืมกลับบิต U/L: ต้องกลับบิตที่ 7 (ค่า 0x02) ของไบต์แรกของ MAC';
  }
  if (tail) return 'กลับบิตผิดตำแหน่ง: ต้องกลับเฉพาะบิตที่ 7 นับจากซ้าย (ค่า 0x02) ของไบต์แรก';
  const hex = got.map(x => ('000' + x.toString(16)).slice(-4)).join('');
  if (!hex.includes('fffe')) return 'ยังไม่ได้แทรก ff:fe ตรงกลาง MAC (ระหว่างไบต์ที่ 3 และ 4)';
  if (hex.indexOf('fffe') !== 6) return 'ต้องแทรก ff:fe ระหว่างครึ่งแรก (3 ไบต์) กับครึ่งหลัง (3 ไบต์) ของ MAC ไม่ใช่ตำแหน่งอื่น';
  return 'ค่าไม่ถูกต้อง ตรวจการแปลง MAC ทีละไบต์อีกครั้ง';
}
function gradeV2(payload, problem) {
  const macs = checkV2Problem(problem);
  if (!macs) return fail('โจทย์ไม่ถูกต้องหรือหมดอายุ กด "โจทย์ใหม่" แล้วลองอีกครั้ง');
  if (tooBig(payload, 4000)) return fail('ข้อมูลที่ส่งมาใหญ่เกินไป');
  const A = answersOf(payload);
  if (!A) return fail('ไม่พบคำตอบที่ส่งมา กรอกคำตอบแล้วกด "ตรวจคำตอบ"');
  const checks = [];
  let empty = 0;
  macs.forEach((mac, i) => {
    const ms = V6.macStr(mac), want = V6.eui64(mac), wantLL = V6.linkLocal(mac);
    const e = parseIid(ans(A, 'eui' + i));
    let msg = '';
    if (e.empty) { empty++; msg = `MAC ${ms}: ยังไม่ได้กรอก Interface ID`; }
    else if (!e.ok) msg = `MAC ${ms}: Interface ID รูปแบบไม่ถูกต้อง — ${e.err}`;
    else if (!V6.eq(e.w, want)) msg = `MAC ${ms}: Interface ID ไม่ถูกต้อง — ${euiWhy(e.w, mac)}`;
    checks.push({ id: 'eui' + i, label: `Interface ID ของ ${ms}`, pts: msg ? 0 : 1.5, max: 1.5, msg });
    const raw = ans(A, 'll' + i).trim();
    let lmsg = '';
    if (!raw) { empty++; lmsg = `MAC ${ms}: ยังไม่ได้กรอก link-local address`; }
    else {
      const p = V6.parse(raw, { zone: true });
      if (!p.ok) lmsg = `MAC ${ms}: link-local รูปแบบไม่ถูกต้อง — ${p.err}`;
      else if (!V6.eq(p.w.slice(0, 4), [0xfe80, 0, 0, 0])) lmsg = `MAC ${ms}: link-local ต้องขึ้นต้นด้วย fe80:0:0:0 (fe80::/64) แล้วตามด้วย Interface ID`;
      else if (!V6.eq(p.w, wantLL)) lmsg = `MAC ${ms}: link-local ไม่ถูกต้อง — ${euiWhy(p.w.slice(4), mac)}`;
    }
    checks.push({ id: 'll' + i, label: `Link-local ของ ${ms}`, pts: lmsg ? 0 : 1.5, max: 1.5, msg: lmsg });
  });
  // verification in the simulated LAN: ping from PC-B must reach PC-A
  const vt = isObj(payload) && typeof payload.verify === 'string' ? payload.verify.slice(0, 80) : '';
  let vmsg = '';
  if (!vt) vmsg = 'ยังไม่ได้ตรวจในเครื่องจำลอง: ping link-local ของ PC-A จาก PC-B';
  else {
    const net = V6.create(V6.v2Topo(problem));
    const r = net.ping('PCB', vt);
    if (!r.ok) vmsg = `ping ${vt} จาก PC-B ไม่สำเร็จ — ${r.text}`;
    else if (r.reached !== 'PCA') vmsg = 'address ที่ ping ไม่ใช่ link-local ของ PC-A';
  }
  checks.push({ id: 'verify', label: 'ตรวจ link-local ของ PC-A ด้วย ping6 ในเครื่องจำลอง', pts: vmsg ? 0 : 1, max: 1, msg: vmsg });
  const r = finish(checks);
  if (empty === 6 && vmsg) { r.score = 0; r.feedback.unshift('ยังไม่ได้กรอกคำตอบเลย'); }
  return r;
}

/* ============================================================== network labs */
function labNet(mission, payload) {
  if (!isObj(payload) || !isObj(payload.cfg)) return { err: 'ไม่พบการตั้งค่าเครือข่ายที่ส่งมา กรุณาตั้งค่าในเครื่องจำลองแล้วกด "ตรวจงาน"' };
  if (tooBig(payload, 20000)) return { err: 'ข้อมูลที่ส่งมาใหญ่เกินไป' };
  const topo = V6.applyConfig(V6.MT[mission], payload.cfg);
  return { net: V6.create(topo), topo };
}
function matrixCheck(net, hosts, max, id) {
  const m = net.matrix(hosts);
  const okN = m.filter(x => x.ok).length;
  const name = idd => (net.dev(idd) || {}).name || idd;
  const fb = m.filter(x => !x.ok).slice(0, 6).map(x => `ping6 ${name(x.from)} → ${name(x.to)} ไม่สำเร็จ${x.dir === 'back' ? ' (ขากลับ)' : ''}: ${x.text}`);
  if (m.length - okN > 6) fb.push(`... และอีก ${m.length - okN - 6} คู่ที่ ping ไม่ได้`);
  return { check: { id: id || 'matrix', label: `ping6 ระหว่างโฮสต์ทุกคู่ (${okN}/${m.length})`, pts: max * okN / m.length, max, msg: okN === m.length ? '' : `ping6 ผ่าน ${okN} จาก ${m.length} คู่` }, fb,
    matrix: m.map(x => ({ from: x.from, to: x.to, ok: x.ok, code: x.code, dir: x.dir })) };
}
const notesOf = (st) => (st && st.notes || []).filter(n => n.code !== 'len_not64').map(n => n.text);
const hasAddr = (st, prefix, origin) => {
  const c = V6.parseCidr(prefix);
  return !!st && st.addrs.some(a => a.state === 'preferred' && (!origin || a.origin === origin) && a.origin !== 'link-local' && V6.inPrefix(P(a.addr).w, c.w, c.len));
};
// which device owns the host's default gateway on its link (null when none)
function gwOwner(net, topo, hostId) {
  const st = net.iface(hostId); if (!st || !st.gw) return null;
  const gw = P(st.gw.addr.split('%')[0]); if (!gw.ok) return null;
  for (const d of topo.devices) for (const f of d.ifaces) {
    if (f.link !== st.link) continue;
    const s = net.iface(d.id, f.id);
    if (s && !s.v6off && s.addrs.some(a => a.state === 'preferred' && V6.eq(P(a.addr).w, gw.w))) return d.id;
  }
  return null;
}
function raCheck(net, id, dev, ifId, prefix, max) {
  const st = net.iface(dev, ifId);
  const lab = `${dev} ${ifId.toUpperCase()} ส่ง RA ประกาศ ${prefix}`;
  let msg = '';
  if (!st.raPrefixes.includes(prefix)) {
    const g = st.addrs.filter(a => a.origin === 'static');
    if (st.notes.some(n => n.code === 'bad_addr' || n.code === 'addr_type' || n.code === 'bad_len')) msg = `${dev} ${ifId.toUpperCase()}: ${notesOf(st).join(' ')}`;
    else if (!g.length) msg = `${dev} ${ifId.toUpperCase()} ยังไม่มี global address จึงไม่มี prefix ให้ RA ประกาศ`;
    else if (!st.ra) msg = `${dev} ${ifId.toUpperCase()} ยังไม่ได้เปิดการส่ง RA โฮสต์ในลิงก์นี้จึงทำ SLAAC ไม่ได้`;
    else if (st.raPrefixes.some(p => !/\/64$/.test(p))) msg = `${dev} ${ifId.toUpperCase()} ประกาศ prefix ${st.raPrefixes.join(', ')} ซึ่งไม่ใช่ /64 โฮสต์จึงสร้าง address ด้วย SLAAC ไม่ได้`;
    else msg = `${dev} ${ifId.toUpperCase()} ประกาศ prefix ${st.raPrefixes.join(', ') || '(ไม่มี)'} แต่ภารกิจต้องการ ${prefix}`;
  }
  return { id, label: lab, pts: msg ? 0 : max, max, msg };
}

function gradeV3(payload) {
  const L = labNet('v3', payload); if (L.err) return fail(L.err);
  const { net } = L;
  const checks = [raCheck(net, 'ra1', 'R1', 'g0/0', '2001:db8:10::/64', 1.5), raCheck(net, 'ra2', 'R1', 'g0/1', '2001:db8:20::/64', 1.5)];
  const want = { PC1: ['2001:db8:10::/64', 'g0/0'], PC2: ['2001:db8:10::/64', 'g0/0'], PC3: ['2001:db8:20::/64', 'g0/1'], PC4: ['2001:db8:20::/64', 'g0/1'] };
  Object.keys(want).forEach(h => {
    const st = net.iface(h), [px, rif] = want[h];
    const rll = net.iface('R1', rif).ll;
    let msg = '';
    if (st.mode !== 'slaac') msg = `${h} ถูกเปลี่ยนเป็น Static ภารกิจนี้ต้องใช้ SLAAC (รับค่าจาก RA)`;
    else if (!hasAddr(st, px, 'slaac')) msg = `${h} ยังไม่มี SLAAC address ใน ${px}` + (notesOf(st).length ? ' — ' + notesOf(st).join(' ') : '');
    else if (!st.gw || st.gw.addr !== rll) msg = `${h} ยังไม่ได้ default gateway เป็น link-local ของ R1 (${rll})`;
    checks.push({ id: 'slaac-' + h, label: `${h} ได้ address ด้วย SLAAC และ gateway จาก RA`, pts: msg ? 0 : 0.5, max: 0.5, msg });
  });
  const M = matrixCheck(net, ['PC1', 'PC2', 'PC3', 'PC4'], 5);
  checks.push(M.check);
  return finish(checks, M.fb, { matrix: M.matrix });
}

function serverCheck(net, topo, id, dev, addr, router) {
  const st = net.iface(dev), out = [];
  const want = P(addr).w;
  let msg = '';
  const mine = st.addrs.filter(a => a.origin === 'static');
  if (st.mode !== 'static') msg = `${dev} ต้องตั้งแบบ Static (server ควรมี address คงที่)`;
  else if (st.notes.some(n => ['bad_addr', 'addr_type', 'bad_len'].includes(n.code))) msg = `${dev}: ${notesOf(st).join(' ')}`;
  else if (!mine.length) msg = `${dev} ยังไม่ได้ตั้ง IPv6 address`;
  else if (!V6.eq(P(mine[0].addr).w, want)) msg = `${dev} ใช้ ${mine[0].addr} แต่ภารกิจกำหนด ${addr}`;
  else if (mine[0].len !== 64) msg = `${dev} ใช้ prefix length /${mine[0].len} ต้องเป็น /64`;
  else if (mine[0].state !== 'preferred') msg = `${dev}: ${V6.NOTE.dad}`;
  out.push({ id: id + '-addr', label: `${dev} ใช้ ${addr}/64 แบบ Static`, pts: msg ? 0 : 1, max: 1, msg });
  let gmsg = '';
  if (!st.gw) gmsg = `${dev} ยังไม่ได้ตั้ง default gateway` + (st.notes.some(n => n.code === 'bad_gw') ? ' ที่ถูกต้อง (' + V6.NOTE.bad_gw + ')' : '');
  else if (gwOwner(net, topo, dev) !== router) {
    const g = P(st.gw.addr.split('%')[0]);
    const onl = g.ok && (V6.typeOf(g.w) === 'link-local' || st.onlink.some(o => { const c = V6.parseCidr(o.prefix); return V6.inPrefix(g.w, c.w, c.len); }));
    gmsg = `${dev}: default gateway ${st.gw.addr} ` + (onl ? `ไม่ใช่ address ของ ${router} บนลิงก์นี้ (NS ไม่มีใครตอบ)` : `ไม่อยู่บนลิงก์เดียวกับ ${dev} — ใช้ link-local หรือ global ของ ${router} ฝั่งที่ ${dev} ต่ออยู่`);
  }
  out.push({ id: id + '-gw', label: `${dev} มี default gateway เป็น ${router}`, pts: gmsg ? 0 : 1, max: 1, msg: gmsg });
  return out;
}
function routeCheck(net, topo, id, rid, peer, remote, max) {
  const rt = net.routes(rid);
  const c = V6.parseCidr(remote);
  const peerAddrs = [];
  topo.devices.find(d => d.id === peer).ifaces.forEach(f => { const s = net.iface(peer, f.id); if (s && s.link === 'WAN') s.addrs.forEach(a => peerAddrs.push(a.addr)); });
  const cand = rt.filter(r => r.type === 'S' && r.valid && (() => { const x = V6.parseCidr(r.prefix); return x.ok && V6.inPrefix(c.w, x.w, x.len) && x.len <= c.len; })());
  const good = cand.find(r => peerAddrs.includes(r.via));
  let msg = '';
  if (!good) {
    const inval = rt.filter(r => r.type === 'S' && !r.valid);
    if (cand.length) msg = `${rid}: route ไป ${remote} มี next hop ${cand[0].via} ซึ่งไม่ใช่ address ของ ${peer} บนลิงก์ WAN`;
    else if (inval.length) msg = `${rid}: static route ใช้ไม่ได้ — ${inval[0].prefix || '(ไม่มี prefix)'}: ${inval[0].why}`;
    else msg = `${rid} ยังไม่มี static route ไปยัง ${remote}`;
  }
  return { id, label: `${rid} มี static route ไปยัง ${remote} ผ่าน ${peer}`, pts: msg ? 0 : max, max, msg };
}
function gradeV4(payload) {
  const L = labNet('v4', payload); if (L.err) return fail(L.err);
  const { net, topo } = L;
  const checks = [].concat(serverCheck(net, topo, 'srv1', 'SRV1', '2001:db8:1::10', 'R1'), serverCheck(net, topo, 'srv2', 'SRV2', '2001:db8:2::10', 'R2'),
    [routeCheck(net, topo, 'r1', 'R1', 'R2', '2001:db8:2::/64', 1), routeCheck(net, topo, 'r2', 'R2', 'R1', '2001:db8:1::/64', 1)]);
  const M = matrixCheck(net, ['PC1', 'SRV1', 'PC2', 'SRV2'], 4);
  checks.push(M.check);
  return finish(checks, M.fb, { matrix: M.matrix });
}

function gradeV5(payload) {
  const L = labNet('v5', payload); if (L.err) return fail(L.err);
  const { net, topo } = L;
  const checks = [];
  // fault 1: PC2 prefix length
  const s2 = net.iface('PC2');
  const pc2ok = s2.addrs.some(a => a.origin !== 'link-local' && a.state === 'preferred' && a.len === 64 && hasAddr({ addrs: [a] }, '2001:db8:acad:1::/64'));
  checks.push({ id: 'f-prefix', label: 'PC2 ใช้ prefix length ที่ถูกต้อง', pts: pc2ok ? 1 : 0, max: 1,
    msg: pc2ok ? '' : 'PC2 ยังส่งหาเครื่องใน LAN2 ไม่ได้: ดู prefix length ใน ipconfig/การตั้งค่า เครื่องคิดว่าปลายทางอยู่ลิงก์เดียวกันจึงถาม NDP เอง (ต้องเป็น /64 แบบเดียวกับ router)' });
  // fault 2: PC3 default gateway
  const pc3ok = gwOwner(net, topo, 'PC3') === 'R1';
  checks.push({ id: 'f-gw', label: 'PC3 มี default gateway ที่ใช้ได้', pts: pc3ok ? 1 : 0, max: 1,
    msg: pc3ok ? '' : 'PC3 ยังส่งออกนอกวงไม่ได้: default gateway ต้องเป็น address ของ R1 ฝั่ง LAN2 (เช่น link-local ของ R1 G0/1) ไม่ใช่ address ของ router ฝั่งลิงก์อื่น' });
  // fault 3: RA on LAN1
  const g00 = net.iface('R1', 'g0/0');
  const raOk = g00.raPrefixes.includes('2001:db8:acad:1::/64') && hasAddr(net.iface('PC1'), '2001:db8:acad:1::/64', 'slaac');
  checks.push({ id: 'f-ra', label: 'LAN1 มี Router Advertisement ให้ PC1 ทำ SLAAC', pts: raOk ? 1 : 0, max: 1,
    msg: raOk ? '' : 'PC1 (SLAAC) ยังไม่มี global address: ตรวจว่า router ฝั่ง LAN1 ส่ง RA ประกาศ prefix /64 หรือไม่' });
  // fault 4: duplicate address, SRV keeps its address
  const srv = net.iface('SRV');
  const srvKeep = srv.addrs.some(a => a.state === 'preferred' && a.origin === 'static' && V6.eq(P(a.addr).w, P('2001:db8:acad:2::10').w));
  const dup = net.dupCount();
  const dupOk = srvKeep && dup === 0;
  checks.push({ id: 'f-dad', label: 'ไม่มี address ซ้ำ และ SRV ยังใช้ 2001:db8:acad:2::10', pts: dupOk ? 1 : 0, max: 1,
    msg: dupOk ? '' : !srvKeep ? 'SRV ต้องใช้ 2001:db8:acad:2::10 ได้ตามเดิม (ห้ามเปลี่ยน address ของ SRV และต้องไม่มีเครื่องอื่นแย่ง address นี้ก่อน)' : `ยังมี address ซ้ำในเครือข่าย ${dup} รายการ (ดูคำว่า Duplicate ใน ipconfig) ให้เปลี่ยน address ของเครื่องที่ตั้งซ้ำ` });
  const M = matrixCheck(net, ['PC1', 'PC2', 'PC3', 'SRV', 'PC4'], 6);
  checks.push(M.check);
  return finish(checks, M.fb, { matrix: M.matrix });
}

function grade(missionId, payload, problem) {
  try {
    if (missionId === 'v1') return gradeV1(payload, problem);
    if (missionId === 'v2') return gradeV2(payload, problem);
    if (missionId === 'v3') return gradeV3(payload);
    if (missionId === 'v4') return gradeV4(payload);
    if (missionId === 'v5') return gradeV5(payload);
    return fail('ไม่พบภารกิจนี้');
  } catch (e) {
    return fail('ตรวจงานไม่ได้ ข้อมูลที่ส่งมาไม่ถูกต้อง');
  }
}

module.exports = {
  id: 'ipv6',
  title: 'ห้องปฏิบัติการ IPv6',
  missions: missions.map(m => ({ id: m.id, title: m.title, level: m.level, desc: m.desc, max: m.max, hints: m.hints, start: m.start })),
  generatedMissions: ['v1', 'v2'],
  generate,
  grade,
  // exposed for tests / tooling only
  _lib: { V6, parseIid, LAB_TH, checkV1Problem, checkV2Problem }
};
