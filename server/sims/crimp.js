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
        'ทดสอบด้วยเครื่องทดสอบขั้นสูงก่อนส่ง'] } }
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
  const tested = p.tested === 'advanced' || p.tested === 'basic' ? p.tested : null;
  let testOk = verdictOk;
  if (advanced && verdictOk && tested !== 'advanced') {
    testOk = false;
    feedback.push(tested ? 'กฎห้องแล็บข้อ 4: ต้องทดสอบด้วยเครื่องทดสอบขั้นสูง (เครื่องพื้นฐานตรวจ split pair ไม่ได้)' : 'กฎห้องแล็บข้อ 4: ยังไม่ได้ทดสอบสายก่อนส่ง');
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

function grade(missionId, payload) {
  try {
    const m = missions.find(x => x.id === missionId);
    if (!m) return zero(10, 'ไม่พบภารกิจนี้');
    return m.start.kind === 'diagnose' ? gradeDiagnose(m, payload) : gradeBuild(m, payload);
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
  _lib: { T568A, T568B, CODES, testCable, normEnd }
};
