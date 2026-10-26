'use strict';
/*
 * UTP Crimping Simulator - server grader (NetLab, SIM-SPEC §2 + §4.3)
 *
 * Payload for build missions (c1, c2, c3, c5):
 *   { end1: End, end2: End, tested?: 'basic'|'advanced'|null }
 *   End = { standardChoice: 'T568A'|'T568B', order: [8 color codes or null], strip_mm, untwist_mm,
 *           jacketInside: bool, trimmed: bool, pushed?: bool, crimped?: bool }
 *   color codes: wo o wg bl wb g wbr br  (null = slot left empty -> open pin)
 * Payload for c4 (find the fault):
 *   { diagnosis: { [cableId]: { fault: 'ok'|'open'|'miswire'|'split'|'reversed', pins: [1..8] } } }
 *
 * Plug model shared with the browser module (public/js/sim/crimp.js):
 *   inner length 22 mm from the rear opening to the contacts; the strain-relief wedge grips the jacket when
 *   the jacket edge is >= 8 mm inside; the jacket cannot go deeper than 12 mm (wire channels are too narrow).
 *   With the wires pushed fully (tips at 22 mm) the jacket edge is at 22 - untwist, so it is gripped only
 *   when untwist <= 14 mm, and the wires reach the contacts only when untwist >= 10 mm.
 *   The lab rule (TIA/EIA-568) is untwisted length <= 13 mm (0.5 in).
 */

const CODES = ['wo', 'o', 'wg', 'bl', 'wb', 'g', 'wbr', 'br'];
const T568A = ['wg', 'g', 'wo', 'bl', 'wb', 'o', 'wbr', 'br'];
const T568B = ['wo', 'o', 'wg', 'bl', 'wb', 'g', 'wbr', 'br'];
const STD = { T568A, T568B };
const NAME = { wo: 'ขาวส้ม', o: 'ส้ม', wg: 'ขาวเขียว', g: 'เขียว', bl: 'น้ำเงิน', wb: 'ขาวน้ำเงิน', wbr: 'ขาวน้ำตาล', br: 'น้ำตาล' };
const FAMILY = { wo: 'o', o: 'o', wg: 'g', g: 'g', bl: 'b', wb: 'b', wbr: 'n', br: 'n' };
const PAIRS = [[0, 1], [2, 5], [3, 4], [6, 7]];          // pin pairs 1-2, 3-6, 4-5, 7-8 (0-based)
const CROSS = [2, 5, 0, 3, 4, 1, 6, 7];                  // 1->3, 2->6, 3->1, 6->2
const UNTRIM_SHORT = [6, 7];                             // untrimmed: the uneven wires at pins 7, 8 do not reach the contacts
const UNTWIST_MAX = 13, UNTWIST_MIN = 10, JACKET_MAX_UNTWIST = 14;
const END_TH = ['ปลายที่ 1', 'ปลายที่ 2'];

const pinList = arr => arr.map(i => i + 1).join(', ');
const num = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && isFinite(Number(v)) ? Number(v) : NaN;
const r2 = x => Math.round(x * 100) / 100;

/* ---------- normalising an end (returns null when malformed) ---------- */
function normEnd(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  if (!Array.isArray(e.order) || e.order.length !== 8) return null;
  const order = [];
  for (const c of e.order) {
    if (c === null || c === '' || c === undefined) order.push(null);
    else if (typeof c === 'string' && CODES.includes(c)) order.push(c);
    else return null;
  }
  const sc = typeof e.standardChoice === 'string' ? e.standardChoice.toUpperCase().replace(/\s|-/g, '') : '';
  const standardChoice = sc === 'T568A' || sc === 'A' ? 'T568A' : sc === 'T568B' || sc === 'B' ? 'T568B' : null;
  const short = Array.isArray(e.short) ? e.short.map(Number).filter(p => Number.isInteger(p) && p >= 1 && p <= 8).map(p => p - 1) : [];
  return {
    standardChoice, order, short,
    strip_mm: num(e.strip_mm), untwist_mm: num(e.untwist_mm),
    jacketInside: e.jacketInside === true, trimmed: e.trimmed === true,
    pushed: e.pushed !== false, crimped: e.crimped !== false
  };
}

/* pins (0-based) whose wire does not touch a contact at this end */
function openPinsOf(e) {
  const s = new Set();
  if (!e.pushed || !e.crimped) { for (let i = 0; i < 8; i++) s.add(i); return s; }
  e.order.forEach((c, i) => { if (!c) s.add(i); });
  if (!e.trimmed) UNTRIM_SHORT.forEach(i => s.add(i));
  e.short.forEach(i => s.add(i));
  return s;
}

/* what an LED tester sees: map[i] = remote pin (0-based) or -1 (no light) */
function testCable(e1, e2) {
  const o1 = openPinsOf(e1), o2 = openPinsOf(e2);
  const map = [];
  for (let i = 0; i < 8; i++) {
    const c = e1.order[i];
    if (!c || o1.has(i)) { map.push(-1); continue; }
    const j = e2.order.indexOf(c);
    map.push(j < 0 || o2.has(j) ? -1 : j);
  }
  const open = [], wrong = [];
  map.forEach((j, i) => { if (j < 0) open.push(i); });
  const isStraight = map.every((j, i) => j === i);
  const isCross = map.every((j, i) => j === CROSS[i]);
  const isRev = map.every((j, i) => j === 7 - i);
  let verdict;
  if (open.length) verdict = 'open';
  else if (isStraight) verdict = 'straight';
  else if (isCross) verdict = 'crossover';
  else if (isRev) verdict = 'reversed';
  else verdict = 'miswire';
  // pins that are neither straight nor crossover-correct (relative to the closer pattern)
  if (verdict === 'miswire' || verdict === 'open') {
    const ds = map.filter((j, i) => j >= 0 && j !== i).length, dc = map.filter((j, i) => j >= 0 && j !== CROSS[i]).length;
    const ref = dc < ds ? CROSS : null;
    map.forEach((j, i) => { if (j >= 0 && j !== (ref ? ref[i] : i)) wrong.push(i); });
  }
  // split pair: continuity is fine but the twisted pairs are not on pins 1-2, 3-6, 4-5, 7-8
  const split = [];
  if (verdict === 'straight' || verdict === 'crossover') {
    for (const e of [e1, e2]) for (const [a, b] of PAIRS) {
      if (FAMILY[e.order[a]] !== FAMILY[e.order[b]]) { if (!split.includes(a)) split.push(a); if (!split.includes(b)) split.push(b); }
    }
    split.sort((a, b) => a - b);
  }
  return { map, open, wrong, verdict, split };
}

/* ---------- missions ---------- */
const BUILD_HINTS = [
  'ลำดับสี T568B ขา 1–8: ขาวส้ม ส้ม ขาวเขียว น้ำเงิน ขาวน้ำเงิน เขียว ขาวน้ำตาล น้ำตาล',
  'ลำดับสี T568A ขา 1–8: ขาวเขียว เขียว ขาวส้ม น้ำเงิน ขาวน้ำเงิน ส้ม ขาวน้ำตาล น้ำตาล (สลับคู่ส้มกับคู่เขียวจาก T568B)',
  'ถือหัว RJ-45 ให้ตัวล็อก (clip) คว่ำลง หน้าสัมผัสทองแดงหงายขึ้น ปลายหัวชี้ออกจากตัว ขา 1 จะอยู่ซ้ายมือ',
  'ปอกเปลือกยาวพอจัดสายได้ง่าย (ประมาณ 25–30 มม.) แล้วค่อยตัดให้เหลือส่วนที่คลายเกลียวไม่เกิน 13 มม. (ครึ่งนิ้ว)',
  'ดันสายจนปลายทองแดงทุกเส้นชนหัวด้านหน้า และเปลือกนอกต้องเข้าไปอยู่ใต้ตัวล็อกสาย (strain relief) ก่อนย้ำ'
];

const FAULT_CABLES = [
  { id: 'k1', label: 'สาย ก', note: 'สายแพทช์จากโต๊ะ 3',
    end1: { standardChoice: 'T568B', order: T568B.slice(), strip_mm: 25, untwist_mm: 12, jacketInside: true, trimmed: true },
    end2: { standardChoice: 'T568B', order: ['wo', 'o', 'g', 'bl', 'wb', 'wg', 'wbr', 'br'], strip_mm: 25, untwist_mm: 12, jacketInside: true, trimmed: true } },
  { id: 'k2', label: 'สาย ข', note: 'สายที่นักเรียนรุ่นก่อนทำ "เรียงตามคู่"',
    end1: { standardChoice: 'T568B', order: ['wo', 'o', 'wg', 'g', 'wb', 'bl', 'wbr', 'br'], strip_mm: 25, untwist_mm: 12, jacketInside: true, trimmed: true },
    end2: { standardChoice: 'T568B', order: ['wo', 'o', 'wg', 'g', 'wb', 'bl', 'wbr', 'br'], strip_mm: 25, untwist_mm: 12, jacketInside: true, trimmed: true } },
  { id: 'k3', label: 'สาย ค', note: 'สายที่ใส่หัวด้านหนึ่งกลับด้าน',
    end1: { standardChoice: 'T568B', order: T568B.slice(), strip_mm: 25, untwist_mm: 12, jacketInside: true, trimmed: true },
    end2: { standardChoice: 'T568B', order: T568B.slice().reverse(), strip_mm: 25, untwist_mm: 12, jacketInside: true, trimmed: true } },
  { id: 'k4', label: 'สาย ง', note: 'สายที่ใช้งานแล้วติด ๆ ดับ ๆ',
    end1: { standardChoice: 'T568B', order: T568B.slice(), strip_mm: 25, untwist_mm: 12, jacketInside: true, trimmed: true, short: [4] },
    end2: { standardChoice: 'T568B', order: T568B.slice(), strip_mm: 25, untwist_mm: 12, jacketInside: true, trimmed: true } }
];
/* ---------- physical plug model (c6) ----------
 * Distances in mm measured from the rear opening of the plug (0) to the front wall (PLUG = 22).
 * A wire touches its contact blade only when its tip is within 0.5 mm of the front wall (>= CONTACT_MIN).
 * Untrimmed wires are uneven (UNEVEN offsets): pins 7 and 8 end up 3-3.5 mm short (same as the older missions).
 * The jacket can enter at most JSTOP mm (the wire channels are narrower than the jacket); the crimp bar /
 * strain-relief wedge presses the jacket only when the jacket edge is at least WEDGE mm inside. */
const PLUG = 22, WEDGE = 8, JSTOP = 12, CONTACT_MIN = 21.5;
const UNEVEN = [0, -0.5, 0, -0.5, -0.5, 0, -3, -3.5];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function normRaw(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  if (!Array.isArray(e.order) || e.order.length !== 8) return null;
  const order = [];
  for (const c of e.order) {
    if (c === null || c === '' || c === undefined) order.push(null);
    else if (typeof c === 'string' && CODES.includes(c)) order.push(c);
    else return null;
  }
  const sc = typeof e.standardChoice === 'string' ? e.standardChoice.toUpperCase().replace(/\s|-/g, '') : '';
  const strip = num(e.strip_mm), cutLen = num(e.untwist_mm), depth = num(e.depth_mm);
  return {
    standardChoice: sc === 'T568A' || sc === 'A' ? 'T568A' : sc === 'T568B' || sc === 'B' ? 'T568B' : null,
    order, stripped: e.stripped === true, cut: e.cut === true, crimped: e.crimped === true,
    strip: isFinite(strip) ? clamp(strip, 0, 60) : NaN,
    cutLen: isFinite(cutLen) ? clamp(cutLen, 0, 60) : NaN,
    depth: isFinite(depth) ? depth : NaN
  };
}

/* what the plug looks like after the student's actions (pure physics, never trusts derived flags) */
function physEnd(r) {
  const cutOk = r.cut && isFinite(r.cutLen) && isFinite(r.strip) && r.cutLen <= r.strip;
  const L = cutOk ? r.cutLen : r.strip;                      // length of untwisted wire beyond the jacket
  const maxDepth = isFinite(L) ? Math.min(PLUG, L + JSTOP) : 0;
  const depth = isFinite(r.depth) ? clamp(r.depth, 0, maxDepth) : 0;
  const tips = r.order.map((c, i) => depth + (cutOk ? 0 : UNEVEN[i]));
  const contact = r.order.map((c, i) => !!c && r.crimped && tips[i] >= CONTACT_MIN);
  const jacketEdge = isFinite(L) ? depth - L : -99;          // mm of jacket inside the plug (negative = outside)
  return { L, cutOk, maxDepth, depth, tips, contact, jacketEdge, underBar: jacketEdge >= WEDGE, gap: r2(PLUG - depth) };
}

/* ---------- wire map as seen by a basic LED tester (c7 and the browser's own-cable test) ----------
 * end = { order: [8 codes|null], contact: [8 bool], bridge: [[a, b]] (0-based pins shorted together at that end) }
 * Behaviour of the common two-piece tester (MAIN + REMOTE, LEDs 1-8 and G), from its manual:
 *   normal -> MAIN LED n and the REMOTE LED of the pin the wire reaches light together;
 *   open   -> neither the MAIN nor the REMOTE LED of that wire lights;
 *   short  -> the MAIN LED lights but the REMOTE LEDs of the shorted wires stay dark;
 *   G      -> lights only on shielded (STP) cable with shielded plugs; dark on UTP (normal). */
function wiremap(a, b) {
  const parent = {};
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const uni = (x, y) => { parent[find(x)] = find(y); };
  for (let i = 0; i < 8; i++) { parent['a' + i] = 'a' + i; parent['b' + i] = 'b' + i; }
  for (let i = 0; i < 8; i++) {
    const c = a.order[i];
    if (!c || !a.contact[i]) continue;
    const j = b.order.indexOf(c);
    if (j >= 0 && b.contact[j]) uni('a' + i, 'b' + j);
  }
  for (const [x, y] of a.bridge || []) uni('a' + x, 'a' + y);
  for (const [x, y] of b.bridge || []) uni('b' + x, 'b' + y);
  const seq = [], map = [], open = [], shorted = [];
  for (let i = 0; i < 8; i++) {
    const root = find('a' + i);
    const rem = [], mas = [];
    for (let k = 0; k < 8; k++) { if (find('b' + k) === root) rem.push(k); if (find('a' + k) === root) mas.push(k); }
    if (!rem.length && mas.length === 1) { seq.push({ main: false, remote: [] }); map.push(-1); open.push(i); }
    else if (rem.length > 1 || mas.length > 1) { seq.push({ main: true, remote: [] }); map.push(-1); shorted.push(i); }
    else { seq.push({ main: true, remote: [rem[0]] }); map.push(rem[0]); }
  }
  seq.push({ main: false, remote: [], g: true });              // G step: UTP has no shield
  let verdict, pins = [];
  const straight = map.every((j, i) => j === i);
  if (shorted.length) { verdict = 'short'; pins = shorted.slice(); }
  else if (open.length) { verdict = 'open'; pins = open.slice(); }
  else if (straight) verdict = 'straight';
  else if (map.every((j, i) => j === CROSS[i])) { verdict = 'crossed'; pins = [0, 1, 2, 5]; }
  else if (map.every((j, i) => j === 7 - i)) { verdict = 'reversed'; pins = [0, 1, 2, 3, 4, 5, 6, 7]; }
  else {
    const wrong = [];
    map.forEach((j, i) => { if (j !== i) wrong.push(i); });
    // every wrong pin is swapped with its partner inside the same twisted pair -> reversed pair
    const inPair = wrong.every(i => { const p = PAIRS.find(pp => pp.includes(i)); const o = p[0] === i ? p[1] : p[0]; return map[i] === o && map[o] === i; });
    verdict = inPair ? 'pairrev' : 'miswire'; pins = wrong;
  }
  const split = [];
  if (verdict === 'straight') {
    for (const e of [a, b]) for (const [x, y] of PAIRS) {
      if (FAMILY[e.order[x]] !== FAMILY[e.order[y]]) { if (!split.includes(x)) split.push(x); if (!split.includes(y)) split.push(y); }
    }
    split.sort((x, y) => x - y);
  }
  return { seq, map, open, shorted, verdict, pins, split };
}
/* simple cable end description (fixed cables): { order, cut?: pins (1-based) with a wire too short, bridge?: [[a,b]] 1-based } */
const tEnd = e => ({ order: e.order.slice(), contact: e.order.map((c, i) => !!c && !(e.cut || []).includes(i + 1)),
  bridge: (e.bridge || []).map(([x, y]) => [x - 1, y - 1]) });

const TFAULTS = ['ok', 'open', 'short', 'pairrev', 'crossed', 'miswire', 'split'];
const TFAULT_TH = { ok: 'ปกติ (ไฟติดตรงกันครบ 1–8)', open: 'วงจรขาด (open)', short: 'สายลัดวงจร / แตะกัน (short)', pairrev: 'สายในคู่สลับกัน (reversed pair)',
  crossed: 'คู่สายสลับคู่ (crossed pairs)', miswire: 'ต่อสลับขาแบบอื่น (miswire)', split: 'ไฟผ่านครบ แต่เป็นสายคู่ถูกแยก (split pair)' };
const SP = ['wo', 'o', 'wg', 'g', 'wb', 'bl', 'wbr', 'br'];   // "pairs side by side" -> split pair
const TESTER_CABLES = [
  { id: 'r1', label: 'สาย 1', note: 'สายจากโต๊ะครู ต่อแล้ว Windows ขึ้นว่า "Network cable unplugged" เป็นบางครั้ง',
    a: { order: T568B }, b: { order: T568B, cut: [7] } },
  { id: 'r2', label: 'สาย 2', note: 'สายที่ถูกเก้าอี้ทับ ฉนวนสายด้านในฉีกขาด',
    a: { order: T568B, bridge: [[2, 3]] }, b: { order: T568B } },
  { id: 'r3', label: 'สาย 3', note: 'สายที่นักเรียนเข้าหัวเอง ใช้งานได้ช้ามากหรือไม่ได้เลย',
    a: { order: T568B }, b: { order: ['o', 'wo', 'wg', 'bl', 'wb', 'g', 'wbr', 'br'] } },
  { id: 'r4', label: 'สาย 4', note: 'สายใหม่ ใช้งานปกติ ต่อ PC เข้ากับ Switch ได้',
    a: { order: T568B }, b: { order: T568B } },
  { id: 'r5', label: 'สาย 5', note: 'สายที่ยืมมาจากห้องอื่น ห้องนี้ต้องการใช้เป็นสายตรง (straight-through) ตามมาตรฐาน T568B',
    a: { order: T568B }, b: { order: T568A } },
  { id: 'r6', label: 'สาย 6', note: 'ต่อ PC ได้ แต่ที่ 1 Gbps หลุดบ่อยและมี error มาก ต้องลดเหลือ 100 Mbps ผู้ทำบอกว่า "เรียงสีเป็นคู่ ๆ ให้ดูง่าย"',
    a: { order: SP }, b: { order: SP } }
].map(c => {
  const e1 = tEnd(c.a), e2 = tEnd(c.b);
  // only the LED sequence is public (what the student observes); the wiring stays on the server
  return { id: c.id, label: c.label, note: c.note, e1, e2, seq: wiremap(e1, e2).seq };
});

const FAULTS = ['ok', 'open', 'miswire', 'split', 'reversed'];
const FAULT_TH = { ok: 'ปกติ (straight-through ใช้งานได้)', open: 'วงจรขาด (open)', miswire: 'ต่อสลับขา (miswire)', split: 'สายคู่ถูกแยก (split pair)', reversed: 'เรียงกลับด้าน (reversed)' };

const missions = [
  { id: 'c1', title: 'สาย LAN แบบตรง (straight-through) มาตรฐาน T568B', level: 'easy', max: 10,
    desc: 'เข้าหัว RJ-45 ทั้งสองปลายด้วยมาตรฐาน T568B ให้ได้สายแบบตรง (straight-through) ใช้ต่อ PC เข้ากับ Switch ' +
      'ส่วนที่คลายเกลียวไม่เกิน 13 มม. เปลือกนอกอยู่ใต้ตัวล็อกสาย แล้วทดสอบด้วยเครื่องทดสอบสาย LAN ก่อนส่ง',
    hints: [BUILD_HINTS[0], BUILD_HINTS[2], BUILD_HINTS[3], BUILD_HINTS[4]],
    start: { kind: 'build', target: 'straight', standards: ['T568B', 'T568B'] } },
  { id: 'c2', title: 'สาย LAN แบบตรง มาตรฐาน T568A', level: 'easy', max: 10,
    desc: 'เข้าหัวทั้งสองปลายด้วยมาตรฐาน T568A ให้ได้สายแบบตรง (straight-through) ' +
      'ระวังลำดับคู่สีเขียวและคู่สีส้มซึ่งต่างจาก T568B',
    hints: [BUILD_HINTS[1], 'ขา 3 และขา 6 เป็นสายคู่เดียวกัน (คู่ส้มใน T568A) แม้จะไม่อยู่ติดกัน', BUILD_HINTS[3], BUILD_HINTS[4]],
    start: { kind: 'build', target: 'straight', standards: ['T568A', 'T568A'] } },
  { id: 'c3', title: 'สาย LAN แบบไขว้ (crossover)', level: 'medium', max: 10,
    desc: 'ทำสายแบบไขว้ (crossover): ปลายหนึ่ง T568A อีกปลายหนึ่ง T568B แล้วทดสอบ ไฟ LED ที่เครื่องปลายทางต้องติดเป็น ' +
      '1→3, 2→6, 3→1, 6→2 (ขา 4, 5, 7, 8 ตรงกัน) สายแบบนี้ใช้ต่ออุปกรณ์ชนิดเดียวกันโดยตรง (เช่น PC–PC) ' +
      'กับอุปกรณ์รุ่นเก่า อุปกรณ์รุ่นใหม่ส่วนใหญ่มี Auto MDI/MDIX จึงใช้สายตรงได้เลย',
    hints: ['ปลายหนึ่งใช้ T568A อีกปลายใช้ T568B (จะเริ่มด้านไหนก่อนก็ได้)', BUILD_HINTS[0], BUILD_HINTS[1],
      'ถ้าทดสอบแล้วไฟติด 1→1, 2→2 ... แปลว่าทั้งสองปลายใช้มาตรฐานเดียวกัน ยังไม่ใช่สายไขว้'],
    start: { kind: 'build', target: 'crossover', standards: ['T568A', 'T568B'] } },
  { id: 'c4', title: 'หาจุดเสียของสาย LAN', level: 'medium', max: 10,
    desc: 'ครูนำสาย LAN ที่มีปัญหามา 4 เส้น ให้ทดสอบทีละเส้นด้วยเครื่องทดสอบ แล้ววินิจฉัยว่าแต่ละเส้นเป็นแบบใด ' +
      '(ปกติ / วงจรขาด / ต่อสลับขา / สายคู่ถูกแยก / เรียงกลับด้าน) ถ้าเป็นวงจรขาดหรือต่อสลับขา ให้เลือกขาที่มีปัญหาด้วย',
    hints: ['ไฟ LED ขาใดไม่ติดเลย = วงจรขาด (open) ที่ขานั้น',
      'ไฟติดครบแต่ลำดับที่เครื่องปลายทางไม่ตรงกัน เช่น 3→6 = ต่อสลับขา (miswire)',
      'ไฟปลายทางติด 8,7,6,…,1 กลับลำดับทั้งหมด = เรียงสีกลับด้าน (reversed) มักเกิดจากถือหัวกลับด้าน',
      'เครื่องทดสอบแบบพื้นฐานตรวจแค่ความต่อเนื่องทีละขา ตรวจไม่พบสายคู่ถูกแยก (split pair) ต้องใช้เครื่องทดสอบขั้นสูง'],
    start: { kind: 'diagnose', cables: FAULT_CABLES, faults: FAULTS.map(f => ({ id: f, label: FAULT_TH[f] })) } },
  { id: 'c5', title: 'สายแพทช์ตามกฎห้องแล็บ', level: 'hard', max: 10,
    desc: 'ห้องแล็บกำหนดกฎการทำสายแพทช์ (patch cable) ให้ทำสายตามกฎทุกข้อ แล้วส่งงาน',
    hints: [BUILD_HINTS[0], 'ตั้งค่าตัดสายให้ส่วนที่คลายเกลียวอยู่ระหว่าง 10–13 มม. ถ้าสั้นกว่านี้สายจะไม่ถึงหน้าสัมผัส',
      'เครื่องทดสอบแบบพื้นฐานบอกว่า "ผ่าน" ไม่ได้แปลว่าสายดีเสมอไป ต้องตรวจด้วยเครื่องทดสอบขั้นสูงตามกฎข้อ 4'],
    start: { kind: 'build', target: 'straight', standards: ['T568B', 'T568B'], requireTester: 'advanced',
      rules: ['ใช้มาตรฐาน T568B ทั้งสองปลาย (straight-through)', 'ส่วนที่คลายเกลียวไม่เกิน 13 มม.',
        'เปลือกนอกต้องอยู่ในหัวและถูกตัวล็อกสาย (strain relief) กดไว้ ตัดปลายสายเสมอกัน',
        'ทดสอบด้วยเครื่องทดสอบขั้นสูงก่อนส่ง'] } },
  { id: 'c6', title: 'เข้าหัวตามขั้นตอนจริง + ตรวจคุณภาพ (QC)', level: 'hard', max: 10,
    desc: 'ทำสาย straight-through มาตรฐาน T568B ทั้งสองปลายตามขั้นตอนจริง: ปอกสาย → คลายเกลียวและเรียงสาย → ตัดความยาว → ดันสายเข้าหัว → ย้ำหัว ' +
      'ผู้ตรวจ (QC) จะคำนวณจากสิ่งที่คุณทำจริง (ลำดับสี ความยาวที่ตัด ระยะที่ดันสายเข้าหัว) ว่ามีจุดพลาดใดบ้าง: ' +
      'คลายเกลียวยาวเกิน 13 มม. (crosstalk), ดันสายไม่สุด (วงจรขาด), เปลือกนอกไม่อยู่ใต้ตัวกดเปลือก (สายหลุดเมื่อถูกดึง), สายคู่ถูกแยก (split pair) และเรียงสีผิด',
    hints: [BUILD_HINTS[0], BUILD_HINTS[2],
      'ตัดให้เหลือส่วนที่คลายเกลียว 10–13 มม. ถ้ายาวกว่านี้เปลือกนอกจะไปไม่ถึงตัวกดเปลือก ถ้าสั้นกว่านี้ปลายสายจะไปไม่ถึงหน้าสัมผัส',
      'ดูภาพด้านข้างของหัว: ปลายทองแดงต้องชนผนังด้านหน้า และขอบเปลือกนอกต้องเลยแนวตัวกดเปลือก (crimp bar) เข้าไป',
      'สายคู่เดียวกันต้องอยู่ขา 1-2, 3-6, 4-5, 7-8 การเรียงแบบ "คู่ติดกันทั้งหมด" ไฟเครื่องทดสอบติดครบแต่เป็น split pair'],
    start: { kind: 'qc', target: 'straight', standards: ['T568B', 'T568B'],
      rules: ['T568B ทั้งสองปลาย', 'ส่วนที่คลายเกลียว 10–13 มม.', 'ปลายสายทุกเส้นชนหน้าสัมผัส', 'เปลือกนอกอยู่ใต้ตัวกดเปลือก (strain relief / crimp bar)'] } },
  { id: 'c7', title: 'อ่านไฟเครื่องทดสอบสาย LAN', level: 'medium', max: 12,
    desc: 'เครื่องทดสอบแบบพื้นฐานมี 2 ชิ้น: เครื่องหลัก (MAIN) ไล่ส่งสัญญาณทีละขา 1, 2, … 8 แล้ว G และเครื่องปลายทาง (REMOTE) จะติดไฟที่ขาที่สัญญาณไปถึง ' +
      'ให้ทดสอบสาย 6 เส้น (ทุกเส้นควรเป็นสาย straight-through T568B) ดูไฟทีละขั้น แล้ววินิจฉัยชนิดปัญหาและขาที่มีปัญหา',
    hints: ['ขั้นใดไฟเครื่องหลักและเครื่องปลายทางไม่ติดทั้งคู่ = วงจรขาด (open) ที่ขานั้น',
      'ขั้นใดไฟเครื่องหลักติด แต่เครื่องปลายทางไม่ติดเลย = สายสองเส้นแตะกัน (short) — ดูว่ามีกี่ขาที่เป็นแบบนี้',
      'ไฟปลายทางติด 2 แล้ว 1 (สลับกันภายในคู่เดียว) = สายในคู่สลับกัน (reversed pair)',
      'ไฟติด 1→3, 2→6, 3→1, 6→2 = คู่สายสลับคู่ (crossed pairs) ซึ่งก็คือสาย crossover ถ้าต้องการสายตรงถือว่าผิด',
      'ไฟ G ไม่ติดเป็นเรื่องปกติของสาย UTP เพราะไม่มีชีลด์ (G ใช้กับสาย STP/FTP ที่มีชีลด์และหัวโลหะ)',
      'เครื่องพื้นฐานตรวจได้แค่ความต่อเนื่องทีละขา สาย split pair จึงไฟติดครบเหมือนสายดี ต้องดูอาการใช้งานหรือใช้เครื่องทดสอบขั้นสูง'],
    start: { kind: 'tester', cables: TESTER_CABLES.map(c => ({ id: c.id, label: c.label, note: c.note, seq: c.seq })),
      faults: TFAULTS.map(f => ({ id: f, label: TFAULT_TH[f] })) } }
];

/* ---------- grading helpers ---------- */
function orderIssues(order, want) {
  const parts = [];
  order.forEach((c, i) => {
    if (!c) parts.push(`ขา ${i + 1} ไม่มีสาย`);
    else if (c !== want[i]) parts.push(`ขา ${i + 1} (${NAME[c]})`);
  });
  return parts;
}
function dupColors(order) {
  const seen = {}, d = [];
  order.forEach(c => { if (c) { if (seen[c]) d.push(NAME[c]); seen[c] = 1; } });
  return d;
}
const same = (a, b) => a.every((c, i) => c === b[i]);

/* grades one end against the required standard; returns { pts, fb[] } */
function gradeEnd(e, k, want, W) {
  const fb = [];
  let pts = 0;
  const other = want === 'T568A' ? 'T568B' : 'T568A';
  const who = END_TH[k];
  // standard declared
  if (e.standardChoice === want) pts += W.std;
  else fb.push(`${who}: เลือกมาตรฐาน ${e.standardChoice || '(ไม่ได้เลือก)'} แต่ภารกิจนี้ปลายนี้ต้องเป็น ${want}`);
  // colour order
  if (same(e.order, STD[want])) {
    pts += W.order;
    if (e.standardChoice && e.standardChoice !== want) fb.push(`${who}: เรียงสีเป็น ${want} ถูกแล้ว แต่เลือกมาตรฐานไว้ไม่ตรงกับที่เรียง`);
  } else if (same(e.order, STD[other])) {
    pts += W.order / 2;
    fb.push(`${who}: เรียงสีครบตามมาตรฐาน ${other} (คู่สายถูก) แต่ภารกิจนี้ต้องใช้ ${want} — ลำดับคู่ส้มกับคู่เขียวสลับกัน`);
  } else {
    const d = dupColors(e.order);
    const issues = orderIssues(e.order, STD[want]);
    fb.push(`${who}: ลำดับสีไม่ตรงมาตรฐาน ${want} ที่ ${issues.join(', ')}` + (d.length ? ` (มีสีซ้ำ: ${d.join(', ')})` : ''));
  }
  // untwist length
  const u = e.untwist_mm, s = e.strip_mm;
  if (!isFinite(u)) fb.push(`${who}: ไม่มีข้อมูลความยาวส่วนที่คลายเกลียว`);
  else if (isFinite(s) && s < u) fb.push(`${who}: ความยาวส่วนที่คลายเกลียว (${u} มม.) ยาวกว่าที่ปอกเปลือกไว้ (${s} มม.) ซึ่งเป็นไปไม่ได้`);
  else if (u > UNTWIST_MAX) fb.push(`${who}: ส่วนที่คลายเกลียวยาว ${u} มม. เกิน 13 มม. (ครึ่งนิ้ว) ตามมาตรฐาน — สายคลายเกลียวนาน ๆ เกิดสัญญาณรบกวนข้ามคู่ (crosstalk)`);
  else if (u < UNTWIST_MIN) fb.push(`${who}: ตัดสายสั้นเกินไป (${u} มม.) เปลือกนอกจะชนช่องสายก่อน ทำให้ปลายสายไม่ถึงหน้าสัมผัส`);
  else pts += W.untwist;
  // jacket under the strain relief
  if (!e.jacketInside) fb.push(`${who}: เปลือกนอกไม่ได้อยู่ใต้ตัวล็อกสาย (strain relief) ในหัว RJ-45 — เมื่อดึงสาย สายทองแดงจะรับแรงเองและหลุดหรือขาดได้`);
  else if (isFinite(u) && u > JACKET_MAX_UNTWIST) fb.push(`${who}: ส่วนที่ปอกยาว ${u} มม. ทำให้เปลือกนอกเข้าไม่ถึงตัวล็อกสาย (สายจะหลุดง่าย)`);
  else pts += W.jacket;
  // trimmed + pushed
  if (!e.trimmed) fb.push(`${who}: ไม่ได้ตัดปลายสายให้เสมอกัน สายบางเส้นสั้นกว่าเส้นอื่นจึงไม่ถึงหน้าสัมผัสทองแดง (ขา ${pinList(UNTRIM_SHORT)} วงจรขาด)`);
  else if (!e.pushed) fb.push(`${who}: ดันสายไม่สุดหัว ปลายสายไม่ถึงหน้าสัมผัสทองแดง`);
  else pts += W.trim;
  if (!e.crimped) fb.push(`${who}: ยังไม่ได้ย้ำหัว (crimp) หน้าสัมผัสจึงยังไม่กดลงบนสาย`);
  return { pts, fb };
}

function testerFeedback(t, target) {
  const fb = [];
  const want = target === 'crossover' ? 'crossover (1→3, 2→6, 3→1, 6→2)' : 'straight-through (1→1 … 8→8)';
  if (t.verdict === 'open') {
    fb.push(`เครื่องทดสอบ: ไฟขา ${pinList(t.open)} ไม่ติด (วงจรขาด) — ตรวจว่ามีสายครบทุกช่อง ตัดเสมอกัน และดันสุดหัวหรือไม่`);
    if (t.wrong.length) fb.push(`เครื่องทดสอบ: ขา ${t.wrong.map(i => `${i + 1}→${t.map[i] + 1}`).join(', ')} ไปออกผิดขาที่ปลายทาง`);
  } else if (t.verdict === 'straight' && target === 'crossover') {
    fb.push('เครื่องทดสอบ: ไฟติดตรงกัน 1→1 … 8→8 ได้สาย straight-through แต่ภารกิจต้องการ crossover (ปลายหนึ่ง T568A อีกปลาย T568B)');
  } else if (t.verdict === 'crossover' && target === 'straight') {
    fb.push('เครื่องทดสอบ: ไฟติดแบบ 1→3, 2→6 ได้สาย crossover แต่ภารกิจต้องการ straight-through (ใช้มาตรฐานเดียวกันทั้งสองปลาย)');
  } else if (t.verdict === 'reversed') {
    fb.push('เครื่องทดสอบ: ไฟปลายทางติดกลับลำดับ (1→8, 2→7 …) เรียงสีกลับด้าน — ตรวจการถือหัว (clip คว่ำลง ขา 1 อยู่ซ้าย)');
  } else if (t.verdict === 'miswire') {
    fb.push(`เครื่องทดสอบ: ต่อสลับขา (miswire) ขา ${t.wrong.map(i => `${i + 1}→${t.map[i] + 1}`).join(', ')} ไม่ได้ผลแบบ ${want}`);
  }
  if (t.split.length) {
    fb.push(`เครื่องทดสอบขั้นสูง: สายคู่ถูกแยก (split pair) ที่ขา ${pinList(t.split)} — ไฟ LED ติดครบตามลำดับจึงดูเหมือนผ่าน ` +
      'แต่สายคู่บิดเกลียวไม่ได้อยู่ที่ขา 1-2, 3-6, 4-5, 7-8 ทำให้เกิด crosstalk ใช้ความเร็วสูงไม่ได้ (เครื่องทดสอบแบบพื้นฐานตรวจไม่พบ)');
  }
  return fb;
}

function zero(max, msg) {
  return { score: 0, max, ok: false, feedback: [msg], details: {} };
}

function gradeBuild(m, p) {
  const max = m.max;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return zero(max, 'ข้อมูลที่ส่งมาไม่ถูกต้อง (ไม่มีข้อมูลสายทั้งสองปลาย)');
  const e1 = normEnd(p.end1), e2 = normEnd(p.end2);
  if (!e1 || !e2) return zero(max, 'ข้อมูลที่ส่งมาไม่ถูกต้อง: ต้องมีข้อมูลปลายที่ 1 และปลายที่ 2 พร้อมลำดับสาย 8 ช่อง (รหัสสี wo o wg bl wb g wbr br)');
  const st = m.start;
  const advanced = st.requireTester === 'advanced';
  // per end: standard 0.5 + order 1.5 + untwist 1 + jacket 1 + trim 0.5 = 4.5; x2 = 9; tester verdict 1 -> 10
  const W = { std: 0.5, order: 1.5, untwist: 1, jacket: 1, trim: 0.5 };
  // which standard each end must use (crossover: either A-B or B-A, pick the better fit)
  let wants = st.standards.slice();
  if (st.target === 'crossover') {
    const fit = (w) => (same(e1.order, STD[w[0]]) ? 2 : 0) + (same(e2.order, STD[w[1]]) ? 2 : 0) + (e1.standardChoice === w[0] ? 1 : 0) + (e2.standardChoice === w[1] ? 1 : 0);
    if (fit(['T568B', 'T568A']) > fit(['T568A', 'T568B'])) wants = ['T568B', 'T568A'];
  }
  const g1 = gradeEnd(e1, 0, wants[0], W), g2 = gradeEnd(e2, 1, wants[1], W);
  let score = g1.pts + g2.pts;
  const feedback = [...g1.fb, ...g2.fb];
  if (st.target === 'crossover' && same(e1.order, e2.order) && (same(e1.order, T568A) || same(e1.order, T568B))) {
    feedback.push(`ทั้งสองปลายใช้ ${same(e1.order, T568A) ? 'T568A' : 'T568B'} เหมือนกัน ได้สาย straight-through ไม่ใช่ crossover`);
  }
  if (st.target === 'straight' && (same(e1.order, T568A) && same(e2.order, T568B) || same(e1.order, T568B) && same(e2.order, T568A))) {
    feedback.push('สองปลายใช้มาตรฐานต่างกัน (A กับ B) ได้สาย crossover แต่ภารกิจต้องการ straight-through');
  }
  // tester verdict computed from the real wiring
  const t = testCable(e1, e2);
  const tfb = testerFeedback(t, st.target);
  feedback.push(...tfb);
  const verdictOk = t.verdict === st.target && !t.split.length;
  /* 6.x: `tested` is only the browser's claim, so it never changes the score. For c5 (rule 4: advanced tester) the
     server runs the advanced test itself on the submitted wiring (verdictOk already includes the split-pair check). */
  const tested = p.tested === 'advanced' || p.tested === 'basic' ? p.tested : null;
  const testOk = verdictOk;
  if (advanced && tested !== 'advanced') {
    feedback.push('กฎห้องแล็บข้อ 4: ระบบทดสอบสายของคุณด้วยเครื่องทดสอบขั้นสูงให้ตอนส่งงาน (คะแนนข้อนี้มาจากผลทดสอบจริงของสาย) ' +
      'แต่ในงานจริงต้องทดสอบด้วยเครื่องทดสอบขั้นสูงเองก่อนส่งทุกครั้ง เพราะเครื่องพื้นฐานตรวจ split pair ไม่ได้');
  }
  if (testOk) score += 1;
  score = r2(score);
  if (score === max) feedback.unshift(st.target === 'crossover' ? 'ยอดเยี่ยม! สาย crossover ถูกต้องครบทุกข้อ ไฟติด 1→3, 2→6, 3→1, 6→2' : 'ยอดเยี่ยม! สายถูกต้องครบทุกข้อ เครื่องทดสอบแสดงผล straight-through');
  return {
    score, max, ok: score === max, feedback,
    details: { tester: { verdict: t.verdict, map: t.map.map(j => j + 1), open: t.open.map(i => i + 1), wrong: t.wrong.map(i => i + 1), split: t.split.map(i => i + 1) },
      ends: [g1.pts, g2.pts], testerPoint: testOk ? 1 : 0, standards: wants }
  };
}

function gradeDiagnose(m, p) {
  const max = m.max;
  if (!p || typeof p !== 'object' || Array.isArray(p) || !p.diagnosis || typeof p.diagnosis !== 'object' || Array.isArray(p.diagnosis)) {
    return zero(max, 'ข้อมูลที่ส่งมาไม่ถูกต้อง: ยังไม่ได้เลือกผลวินิจฉัยของสาย');
  }
  const cables = m.start.cables;
  const per = max / cables.length;
  let score = 0;
  const feedback = [], details = {};
  for (const c of cables) {
    const t = testCable(normEnd(c.end1), normEnd(c.end2));
    const truth = t.verdict === 'open' ? 'open' : t.verdict === 'miswire' ? 'miswire' : t.verdict === 'reversed' ? 'reversed' : t.split.length ? 'split' : 'ok';
    const truthPins = truth === 'open' ? t.open : truth === 'miswire' ? t.wrong : [];
    const d = p.diagnosis[c.id];
    const fault = d && typeof d === 'object' && typeof d.fault === 'string' ? d.fault : null;
    const pins = d && Array.isArray(d.pins) ? [...new Set(d.pins.slice(0, 8).map(Number).filter(x => Number.isInteger(x) && x >= 1 && x <= 8))].sort((a, b) => a - b) : [];
    let pts = 0;
    if (!fault || !FAULTS.includes(fault)) {
      feedback.push(`${c.label}: ยังไม่ได้เลือกผลวินิจฉัย`);
    } else if (fault !== truth) {
      const tip = truth === 'split' ? 'ไฟติดครบตามลำดับ แต่ลองใช้เครื่องทดสอบขั้นสูงดูอีกครั้ง'
        : truth === 'reversed' ? 'สังเกตลำดับไฟที่เครื่องปลายทางทั้งหมด'
          : truth === 'open' ? 'สังเกตว่ามีไฟ LED ขาใดไม่ติดบ้าง' : 'เทียบหมายเลขไฟที่ติดบนเครื่องหลักกับเครื่องปลายทาง';
      feedback.push(`${c.label}: วินิจฉัย "${FAULT_TH[fault]}" ยังไม่ถูก — ${tip}`);
    } else {
      if (truthPins.length) {
        pts += per * 0.6;
        const want = truthPins.map(i => i + 1);
        if (pins.length === want.length && pins.every((x, i) => x === want[i])) pts += per * 0.4;
        else feedback.push(`${c.label}: ชนิดปัญหาถูก แต่เลือกขาที่มีปัญหายังไม่ถูก (ดูว่าไฟขาใดผิดปกติ)`);
      } else pts += per;
      if (pts === per) feedback.push(`${c.label}: ถูกต้อง — ${FAULT_TH[truth]}`);
    }
    score += pts;
    details[c.id] = { points: r2(pts), max: per };
  }
  score = r2(score);
  if (score === max) feedback.unshift('ยอดเยี่ยม! วินิจฉัยสายได้ถูกต้องทุกเส้น');
  return { score, max, ok: score === max, feedback, details };
}

/* ---------- c6: physical steps + QC ---------- */
const QC_W = { order: 2, untwist: 1, reach: 1, jacket: 1 };    // per end = 5, two ends = 10 (integers: the API rounds)

function qcEnd(r, k, want, mirrored) {
  const who = END_TH[k];
  const fb = [], mistakes = [];
  let pts = 0;
  if (!r.stripped) {
    fb.push(`${who}: ยังไม่ได้ปอกเปลือกนอก จึงยังเข้าหัวไม่ได้`);
    return { pts: 0, fb, mistakes: ['not_stripped'], ph: physEnd(Object.assign({}, r, { depth: 0 })) };
  }
  const ph = physEnd(r);
  // 1) colour order / pair grouping
  const missing = r.order.map((c, i) => c ? -1 : i).filter(i => i >= 0);
  const dup = dupColors(r.order);
  if (same(r.order, STD[want])) pts += QC_W.order;
  // split pair = both ends wired the same way (every pin has continuity 1→1 … 8→8) but the twisted pairs are not on 1-2, 3-6, 4-5, 7-8
  else if (mirrored && !missing.length && !dup.length && PAIRS.some(([x, y]) => FAMILY[r.order[x]] !== FAMILY[r.order[y]])) {
    const bad = [];
    PAIRS.forEach(([x, y]) => { if (FAMILY[r.order[x]] !== FAMILY[r.order[y]]) bad.push(x, y); });
    bad.sort((x, y) => x - y);
    mistakes.push('split');
    fb.push(`${who}: สายคู่ถูกแยก (split pair) ที่ขา ${pinList(bad)} — สายสองเส้นที่บิดเกลียวเป็นคู่เดียวกันต้องอยู่ที่ขา 1-2, 3-6, 4-5, 7-8 ` +
      'ถ้าเรียงผิดคู่ สัญญาณหนึ่งคู่จะวิ่งบนสายต่างคู่ เกิด crosstalk ความเร็วสูงใช้ไม่ได้ ทั้งที่เครื่องทดสอบพื้นฐานไฟติดครบ');
  } else if (same(r.order, STD[want === 'T568A' ? 'T568B' : 'T568A'])) {
    pts += QC_W.order / 2;
    mistakes.push('wrong_standard');
    fb.push(`${who}: เรียงสีตาม ${want === 'T568A' ? 'T568B' : 'T568A'} (คู่สายถูก) แต่งานนี้ต้องใช้ ${want} — สองปลายต่างมาตรฐานกันจะได้สาย crossover`);
  } else {
    mistakes.push('order');
    fb.push(`${who}: ลำดับสีไม่ตรงมาตรฐาน ${want} ที่ ${orderIssues(r.order, STD[want]).join(', ')}` + (dup.length ? ` (มีสีซ้ำ: ${dup.join(', ')})` : ''));
  }
  // 2) untwisted length (crosstalk)
  if (!isFinite(ph.L)) { mistakes.push('no_length'); fb.push(`${who}: ไม่มีข้อมูลความยาวสาย`); }
  else if (ph.L > UNTWIST_MAX) {
    mistakes.push('untwist_long');
    fb.push(`${who}: ส่วนที่คลายเกลียวยาว ${r2(ph.L)} มม. เกิน 13 มม. (ครึ่งนิ้ว) — ` + (ph.cutOk ? '' : 'เพราะยังไม่ได้ตัดสายหลังเรียง ') +
      'ช่วงที่ไม่บิดเกลียวยาวทำให้สัญญาณรบกวนข้ามคู่ (crosstalk/NEXT) สูง สายอาจสอบผ่านไฟ LED แต่ไม่ผ่านมาตรฐาน Cat 5e/6');
  } else pts += QC_W.untwist;
  // 3) every wire tip on its contact (open circuit otherwise)
  const noContact = r.order.map((c, i) => (c && !ph.contact[i]) ? i : -1).filter(i => i >= 0);
  if (!r.crimped) {
    mistakes.push('not_crimped');
    fb.push(`${who}: ยังไม่ได้ย้ำหัว (crimp) หน้าสัมผัสทองแดงจึงยังไม่กดทะลุฉนวนลงบนสาย และตัวกดเปลือกยังไม่ล็อกสาย`);
  } else if (!noContact.length && !missing.length) pts += QC_W.reach;
  else if (noContact.length) {
    if (!ph.cutOk) {
      mistakes.push('not_trimmed');
      fb.push(`${who}: ไม่ได้ตัดปลายสายให้เสมอกัน สายบางเส้นสั้นกว่าเส้นอื่น ขา ${pinList(noContact)} ไม่ถึงหน้าสัมผัส (วงจรขาด)`);
    } else if (ph.maxDepth < PLUG) {
      mistakes.push('too_short');
      fb.push(`${who}: ตัดสายสั้นเกินไป (${r2(ph.L)} มม.) เปลือกนอกชนช่องสายก่อน ปลายสายจึงขาดอีก ${r2(PLUG - ph.maxDepth)} มม. ไม่ถึงหน้าสัมผัส ขา ${pinList(noContact)} วงจรขาด (open)`);
    } else {
      mistakes.push('not_pushed');
      fb.push(`${who}: ดันสายไม่สุดหัว ปลายสายห่างผนังด้านหน้า ${ph.gap} มม. หน้าสัมผัสจึงกดไม่โดนสาย ขา ${pinList(noContact)} วงจรขาด (open) — ดูจากด้านหน้าหัวต้องเห็นปลายทองแดงทุกเส้นชนผนัง`);
    }
  } else {
    mistakes.push('empty_slot');
    fb.push(`${who}: ช่องขา ${pinList(missing)} ไม่มีสาย (วงจรขาด)`);
  }
  // 4) jacket under the crimp bar / strain relief
  if (!r.crimped) { /* already reported */ }
  else if (ph.underBar) pts += QC_W.jacket;
  else {
    mistakes.push('jacket_out');
    fb.push(`${who}: ` + (ph.jacketEdge <= 0 ? `เปลือกนอกอยู่นอกหัว (ห่างท้ายหัว ${r2(-ph.jacketEdge)} มม.)` : `เปลือกนอกเข้าไปเพียง ${r2(ph.jacketEdge)} มม. ยังไม่ถึงตัวกดเปลือก (ต้องเข้าไปอย่างน้อย ${WEDGE} มม.)`) +
      ' — ตัวกดเปลือก (crimp bar / strain relief) จึงกดลงบนสายทองแดงแทนเปลือก เมื่อสายถูกดึง แรงดึงจะไปที่สายทองแดงที่หน้าสัมผัส สายหลุดหรือขาดได้ง่าย');
  }
  return { pts, fb, mistakes, ph };
}

function gradeQC(m, p) {
  const max = m.max;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return zero(max, 'ข้อมูลที่ส่งมาไม่ถูกต้อง (ไม่มีข้อมูลสายทั้งสองปลาย)');
  const r1 = normRaw(p.end1), r2_ = normRaw(p.end2);
  if (!r1 || !r2_) return zero(max, 'ข้อมูลที่ส่งมาไม่ถูกต้อง: ต้องมีข้อมูลปลายที่ 1 และปลายที่ 2 พร้อมลำดับสาย 8 ช่อง (รหัสสี wo o wg bl wb g wbr br)');
  const want = m.start.standards;
  const mirrored = want[0] === want[1] && same(r1.order, r2_.order);
  const q1 = qcEnd(r1, 0, want[0], mirrored), q2 = qcEnd(r2_, 1, want[1], mirrored);
  const score = q1.pts + q2.pts;
  const feedback = [...q1.fb, ...q2.fb];
  // what the LED tester would show for this physical cable (information, not scored separately)
  const w = wiremap({ order: r1.order, contact: q1.ph.contact, bridge: [] }, { order: r2_.order, contact: q2.ph.contact, bridge: [] });
  const T = {
    straight: w.split.length ? 'ไฟติด 1→1 … 8→8 ครบ (เครื่องพื้นฐานบอกว่าผ่าน แต่มี split pair)' : 'ไฟติด 1→1 … 8→8 ครบ',
    open: `ไฟขา ${pinList(w.open)} ไม่ติด (วงจรขาด)`, short: `ขา ${pinList(w.shorted)} ลัดวงจร`,
    crossed: 'ไฟติด 1→3, 2→6, 3→1, 6→2 (ได้สาย crossover ไม่ใช่สายตรง)', reversed: 'ไฟปลายทางติดกลับลำดับ 8…1',
    pairrev: `สายในคู่สลับกันที่ขา ${pinList(w.pins)}`, miswire: `ต่อสลับขา ${w.pins.map(i => `${i + 1}→${w.map[i] + 1}`).join(', ')}`
  };
  feedback.push('ถ้านำสายนี้ไปเสียบเครื่องทดสอบ LAN: ' + T[w.verdict]);
  if (score === max) feedback.unshift('ผ่าน QC ทุกข้อ! ลำดับสีถูก คลายเกลียวไม่เกิน 13 มม. ปลายสายชนหน้าสัมผัสทุกเส้น และเปลือกนอกอยู่ใต้ตัวกดเปลือกทั้งสองปลาย');
  return {
    score, max, ok: score === max, feedback,
    details: { ends: [q1.pts, q2.pts], mistakes: [q1.mistakes, q2.mistakes],
      phys: [q1.ph, q2.ph].map(ph => ({ untwist_mm: ph.L, depth_mm: ph.depth, jacket_in_mm: r2(ph.jacketEdge), underBar: ph.underBar, contact: ph.contact })),
      tester: { verdict: w.verdict, map: w.map.map(j => j + 1), open: w.open.map(i => i + 1), split: w.split.map(i => i + 1) } }
  };
}

/* ---------- c7: reading the LED tester ---------- */
const truthOf = w => w.verdict === 'straight' ? (w.split.length ? 'split' : 'ok') : w.verdict === 'reversed' ? 'miswire' : w.verdict;
const TPIN = { open: 1, short: 1, pairrev: 1, crossed: 1, miswire: 1 };

function gradeTester(m, p) {
  const max = m.max;
  if (!p || typeof p !== 'object' || Array.isArray(p) || !p.diagnosis || typeof p.diagnosis !== 'object' || Array.isArray(p.diagnosis)) {
    return zero(max, 'ข้อมูลที่ส่งมาไม่ถูกต้อง: ยังไม่ได้เลือกผลวินิจฉัยของสาย');
  }
  const per = max / TESTER_CABLES.length;           // 2 = fault 1 + pins 1
  let score = 0;
  const feedback = [], details = {};
  for (const c of TESTER_CABLES) {
    const w = wiremap(c.e1, c.e2);
    const truth = truthOf(w);
    const want = TPIN[truth] ? w.pins.map(i => i + 1) : [];
    const d = p.diagnosis[c.id];
    const fault = d && typeof d === 'object' && typeof d.fault === 'string' && TFAULTS.includes(d.fault) ? d.fault : null;
    const pins = d && Array.isArray(d.pins) ? [...new Set(d.pins.slice(0, 8).map(Number).filter(x => Number.isInteger(x) && x >= 1 && x <= 8))].sort((a, b) => a - b) : [];
    let pts = 0;
    if (!fault) feedback.push(`${c.label}: ยังไม่ได้เลือกผลวินิจฉัย`);
    else if (fault === truth) {
      if (TPIN[truth]) {
        pts += per / 2;
        if (pins.length === want.length && pins.every((x, i) => x === want[i])) { pts += per / 2; feedback.push(`${c.label}: ถูกต้อง — ${TFAULT_TH[truth]} ที่ขา ${want.join(', ')}`); }
        else feedback.push(`${c.label}: ชนิดปัญหาถูก แต่ขาที่เลือก (${pins.join(', ') || 'ไม่ได้เลือก'}) ยังไม่ตรง — ดูว่าขั้นใดของไฟที่ผิดปกติ`);
      } else {
        pts += per;
        feedback.push(`${c.label}: ถูกต้อง — ${TFAULT_TH[truth]}` + (truth === 'split'
          ? ' เครื่องทดสอบพื้นฐานไฟติดครบ 1→1 … 8→8 เพราะตรวจแค่ว่าแต่ละขาต่อถึงกัน ไม่ได้วัดว่าสายสองเส้นของสัญญาณคู่หนึ่งบิดเกลียวด้วยกันหรือไม่ ต้องใช้เครื่องทดสอบขั้นสูง (วัด NEXT/crosstalk) หรือเปิดดูลำดับสีที่หัว'
          : ' ไฟ G ไม่ติดเพราะสาย UTP ไม่มีชีลด์ ถือว่าปกติ'));
      }
    } else if (truth === 'split' && fault === 'ok') {
      pts += per / 2;
      feedback.push(`${c.label}: อ่านไฟถูก (ติดครบตรงกัน) แต่อาการใช้งานบอกว่ามีปัญหา — นี่คือ split pair ซึ่งเครื่องทดสอบพื้นฐานตรวจไม่พบ เพราะตรวจแค่ความต่อเนื่องทีละขา ไม่ได้ตรวจการจับคู่บิดเกลียว`);
    } else {
      const tip = { open: 'สังเกตขั้นที่ไฟทั้งเครื่องหลักและเครื่องปลายทางไม่ติด', short: 'สังเกตขั้นที่ไฟเครื่องหลักติด แต่เครื่องปลายทางไม่ติดเลย',
        pairrev: 'เทียบหมายเลขไฟเครื่องหลักกับเครื่องปลายทางในแต่ละขั้น บางคู่สลับกันเอง', crossed: 'ดูว่าขา 1, 2 ไปติดที่ขาใดของเครื่องปลายทาง',
        miswire: 'เทียบหมายเลขไฟเครื่องหลักกับเครื่องปลายทางทีละขั้น', ok: 'ไฟติดตรงกันครบทุกขา และไฟ G ไม่ติดเป็นเรื่องปกติของสาย UTP',
        split: 'ไฟติดครบ แต่ลองอ่านอาการใช้งานของสายนี้อีกครั้ง' }[truth];
      feedback.push(`${c.label}: วินิจฉัย "${TFAULT_TH[fault]}" ยังไม่ถูก — ${tip}`);
    }
    score += pts;
    details[c.id] = { points: pts, max: per };
  }
  if (score === max) feedback.unshift('ยอดเยี่ยม! อ่านไฟเครื่องทดสอบและวินิจฉัยสายได้ถูกต้องทุกเส้น');
  return { score, max, ok: score === max, feedback, details };
}

function grade(missionId, payload) {
  try {
    const m = missions.find(x => x.id === missionId);
    if (!m) return zero(10, 'ไม่พบภารกิจนี้');
    const k = m.start.kind;
    return k === 'diagnose' ? gradeDiagnose(m, payload) : k === 'qc' ? gradeQC(m, payload) : k === 'tester' ? gradeTester(m, payload) : gradeBuild(m, payload);
  } catch (e) {
    return zero(10, 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
  }
}

module.exports = {
  id: 'crimp',
  title: 'จำลองการเข้าหัวสาย UTP (RJ-45)',
  missions,
  grade,
  // exposed for tests / tooling (not used by the app shell)
  _lib: { T568A, T568B, CODES, testCable, normEnd, normRaw, physEnd, wiremap, TESTER_CABLES, PLUG, WEDGE, JSTOP, CONTACT_MIN, UNEVEN }
};
