// Tests for the UTP crimping grader: node tests/sims/crimp.test.js
'use strict';
const assert = require('assert');
const g = require('../../server/sims/crimp.js');

const A = ['wg', 'g', 'wo', 'bl', 'wb', 'o', 'wbr', 'br'];
const B = ['wo', 'o', 'wg', 'bl', 'wb', 'g', 'wbr', 'br'];
const end = (order, std, over) => Object.assign({ standardChoice: std, order: order.slice(), strip_mm: 25, untwist_mm: 12, jacketInside: true, trimmed: true }, over || {});
const fbHas = (r, re) => r.feedback.some(f => re.test(f));

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message); }
}

console.log('crimp grader');

it('module shape follows SIM-SPEC §2', () => {
  assert.strictEqual(g.id, 'crimp');
  assert.deepStrictEqual(g.missions.map(m => m.id), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']);
  for (const m of g.missions) {
    assert.strictEqual(m.max, m.id === 'c7' ? 12 : 10);
    assert.ok(m.title && m.desc && Array.isArray(m.hints) && m.hints.length);
    assert.ok(['easy', 'medium', 'hard'].includes(m.level));
  }
});

it('c1 correct T568B straight-through = 10/10', () => {
  const r = g.grade('c1', { end1: end(B, 'T568B'), end2: end(B, 'T568B'), tested: 'basic' });
  assert.strictEqual(r.score, 10); assert.strictEqual(r.ok, true); assert.strictEqual(r.max, 10);
  assert.strictEqual(r.details.tester.verdict, 'straight');
});

it('c2 correct T568A straight-through = 10/10', () => {
  const r = g.grade('c2', { end1: end(A, 'T568A'), end2: end(A, 'T568A') });
  assert.strictEqual(r.score, 10);
});

it('c3 crossover A-B and B-A both = 10/10, tester sees 1→3 2→6', () => {
  const r = g.grade('c3', { end1: end(A, 'T568A'), end2: end(B, 'T568B') });
  assert.strictEqual(r.score, 10);
  assert.deepStrictEqual(r.details.tester.map, [3, 6, 1, 4, 5, 2, 7, 8]);
  assert.strictEqual(g.grade('c3', { end1: end(B, 'T568B'), end2: end(A, 'T568A') }).score, 10);
});

it('c5 (6.x): the client-sent `tested` flag never changes the score; the server runs the advanced test itself', () => {
  const p = { end1: end(B, 'T568B', { untwist_mm: 13 }), end2: end(B, 'T568B'), tested: 'advanced' };
  assert.strictEqual(g.grade('c5', p).score, 10);
  const basic = g.grade('c5', Object.assign({}, p, { tested: 'basic' }));
  assert.strictEqual(basic.score, 10); assert.ok(fbHas(basic, /ขั้นสูง/), 'rule 4 reminder');
  assert.strictEqual(g.grade('c5', Object.assign({}, p, { tested: null })).score, 10);
  // a split-pair cable cannot buy the tester point by claiming tested:'advanced'
  const sp = ['wo', 'o', 'wg', 'g', 'bl', 'wb', 'wbr', 'br'];
  const forged = g.grade('c5', { end1: end(sp, 'T568B'), end2: end(sp, 'T568B'), tested: 'advanced' });
  assert.strictEqual(forged.details.testerPoint, 0);
  const noFlag = g.grade('c5', { end1: end(sp, 'T568B'), end2: end(sp, 'T568B') });
  assert.strictEqual(forged.score, noFlag.score, 'claim makes no difference');
});

it('wrong colour order: names the wrong pins and loses order + tester points', () => {
  const bad = ['wo', 'o', 'bl', 'wg', 'wb', 'g', 'wbr', 'br']; // pins 3 and 4 swapped on end 2
  const r = g.grade('c1', { end1: end(B, 'T568B'), end2: end(bad, 'T568B') });
  assert.strictEqual(r.score, 10 - 1.5 - 1);
  assert.ok(fbHas(r, /ปลายที่ 2: ลำดับสีไม่ตรงมาตรฐาน T568B ที่ ขา 3 \(น้ำเงิน\), ขา 4 \(ขาวเขียว\)/), r.feedback.join('\n'));
  assert.ok(fbHas(r, /miswire/));
  assert.strictEqual(r.details.tester.verdict, 'miswire');
  assert.deepStrictEqual(r.details.tester.wrong, [3, 4]);
});

it('long untwist (18 mm) loses untwist + jacket points with crosstalk explanation', () => {
  const r = g.grade('c1', { end1: end(B, 'T568B', { untwist_mm: 18, jacketInside: false }), end2: end(B, 'T568B') });
  assert.strictEqual(r.score, 8);
  assert.ok(fbHas(r, /18 มม\. เกิน 13 มม\..*crosstalk/));
  assert.ok(fbHas(r, /strain relief/));
});

it('untwist 14 mm: only the untwist point is lost (jacket still gripped)', () => {
  const r = g.grade('c1', { end1: end(B, 'T568B', { untwist_mm: 14 }), end2: end(B, 'T568B') });
  assert.strictEqual(r.score, 9);
});

it('jacket outside the plug loses 1 point with explanation', () => {
  const r = g.grade('c2', { end1: end(A, 'T568A'), end2: end(A, 'T568A', { jacketInside: false }) });
  assert.strictEqual(r.score, 9);
  assert.ok(fbHas(r, /ปลายที่ 2: เปลือกนอกไม่ได้อยู่ใต้ตัวล็อกสาย.*หลุด/));
});

it('jacketInside claimed with a 20 mm untwist is not accepted (physically impossible)', () => {
  const r = g.grade('c1', { end1: end(B, 'T568B', { untwist_mm: 20, strip_mm: 30 }), end2: end(B, 'T568B') });
  assert.strictEqual(r.score, 8);
});

it('not trimmed evenly: trim point lost and the tester shows open pins 7, 8', () => {
  const r = g.grade('c1', { end1: end(B, 'T568B', { trimmed: false }), end2: end(B, 'T568B') });
  assert.strictEqual(r.score, 10 - 0.5 - 1);
  assert.deepStrictEqual(r.details.tester.open, [7, 8]);
  assert.ok(fbHas(r, /ไม่ได้ตัดปลายสายให้เสมอกัน/));
  assert.ok(fbHas(r, /ไฟขา 7, 8 ไม่ติด/));
});

it('wrong standard for the mission: T568A both ends in c1 loses standard + half order points', () => {
  const r = g.grade('c1', { end1: end(A, 'T568A'), end2: end(A, 'T568A') });
  // tester still says straight-through (it is a working cable), but the lab asked for T568B
  assert.strictEqual(r.score, 10 - 2 * 0.5 - 2 * 0.75);
  assert.ok(fbHas(r, /ต้องใช้ T568B/));
});

it('crossover built for a straight-through mission is explained', () => {
  const r = g.grade('c1', { end1: end(B, 'T568B'), end2: end(A, 'T568A') });
  assert.ok(r.score < 10);
  assert.strictEqual(r.details.tester.verdict, 'crossover');
  assert.ok(fbHas(r, /ได้สาย crossover แต่ภารกิจต้องการ straight-through/));
});

it('straight-through built for the crossover mission loses the tester point', () => {
  const r = g.grade('c3', { end1: end(B, 'T568B'), end2: end(B, 'T568B') });
  assert.strictEqual(r.details.testerPoint, 0);
  assert.ok(fbHas(r, /ไม่ใช่ crossover/));
  assert.strictEqual(r.score, 10 - 0.5 - 0.75 - 1);
});

it('split pair (pairs laid side by side on both ends) passes continuity but loses order + tester points', () => {
  const sp = ['wo', 'o', 'wg', 'g', 'wb', 'bl', 'wbr', 'br'];
  const r = g.grade('c1', { end1: end(sp, 'T568B'), end2: end(sp, 'T568B'), tested: 'basic' });
  assert.strictEqual(r.details.tester.verdict, 'straight');      // LED tester: 1→1 ... 8→8
  assert.deepStrictEqual(r.details.tester.split, [3, 4, 5, 6]);
  assert.strictEqual(r.score, 10 - 1.5 - 1.5 - 1);
  assert.ok(fbHas(r, /split pair.*ขา 3, 4, 5, 6.*crosstalk/));
});

it('missing wire (empty slot) = open pin', () => {
  const o = B.slice(); o[4] = null;
  const r = g.grade('c1', { end1: end(B, 'T568B'), end2: end(o, 'T568B') });
  assert.deepStrictEqual(r.details.tester.open, [5]);
  assert.ok(fbHas(r, /ขา 5 ไม่มีสาย/));
});

it('reversed end is detected', () => {
  const r = g.grade('c1', { end1: end(B, 'T568B'), end2: end(B.slice().reverse(), 'T568B') });
  assert.strictEqual(r.details.tester.verdict, 'reversed');
  assert.ok(fbHas(r, /กลับลำดับ/));
});

it('c4 correct diagnosis = 10/10', () => {
  const m = g.missions.find(x => x.id === 'c4');
  assert.strictEqual(m.start.cables.length, 4);
  const r = g.grade('c4', { diagnosis: { k1: { fault: 'miswire', pins: [3, 6] }, k2: { fault: 'split' }, k3: { fault: 'reversed' }, k4: { fault: 'open', pins: [4] } } });
  assert.strictEqual(r.score, 10, r.feedback.join('\n'));
});

it('c4 wrong / partial diagnosis', () => {
  const r = g.grade('c4', { diagnosis: { k1: { fault: 'miswire', pins: [3] }, k2: { fault: 'ok' }, k3: { fault: 'reversed' }, k4: { fault: 'open', pins: [4] } } });
  assert.strictEqual(r.score, 10 - 1 - 2.5);
  assert.ok(fbHas(r, /สาย ข: วินิจฉัย "ปกติ.*ยังไม่ถูก.*ขั้นสูง/));
  assert.ok(fbHas(r, /สาย ก: ชนิดปัญหาถูก แต่เลือกขา/));
  const none = g.grade('c4', { diagnosis: {} });
  assert.strictEqual(none.score, 0);
});

it('malformed payloads score 0 without throwing', () => {
  const bads = [undefined, null, 42, 'x', [], {}, { end1: {} }, { end1: end(B, 'T568B') },
    { end1: end(B, 'T568B'), end2: { order: B.slice(0, 7) } },
    { end1: end(B, 'T568B'), end2: end(['wo', 'o', 'wg', 'bl', 'wb', 'g', 'wbr', 'purple'], 'T568B') },
    { end1: end(B, 'T568B'), end2: { order: 'wo,o,wg' } },
    { end1: { order: [{}, 1, 2, 3, 4, 5, 6, 7] }, end2: end(B, 'T568B') }];
  for (const id of ['c1', 'c2', 'c3', 'c5']) for (const p of bads) {
    const r = g.grade(id, p);
    assert.strictEqual(r.score, 0, id + ' ' + JSON.stringify(p));
    assert.strictEqual(r.ok, false);
    assert.ok(r.feedback.length);
  }
  for (const p of [undefined, null, 'x', [], { diagnosis: 'open' }, { diagnosis: [] }]) assert.strictEqual(g.grade('c4', p).score, 0);
  assert.strictEqual(g.grade('zz', {}).score, 0);
  // junk numbers do not throw, they just fail that requirement
  const r = g.grade('c1', { end1: end(B, 'T568B', { untwist_mm: 'abc', strip_mm: {} }), end2: end(B, 'T568B') });
  assert.strictEqual(r.score, 9);
});

/* ---------- T568A / T568B reference (TIA-568) ---------- */
it('T568A/T568B colour tables match TIA-568 (pin 1..8)', () => {
  assert.deepStrictEqual(g._lib.T568A, ['wg', 'g', 'wo', 'bl', 'wb', 'o', 'wbr', 'br']);
  assert.deepStrictEqual(g._lib.T568B, ['wo', 'o', 'wg', 'bl', 'wb', 'g', 'wbr', 'br']);
});

/* ---------- c6: physical steps + QC ---------- */
// raw = what the student did: arrangement, strip length, cut length, how far the wires were pushed, crimped
const raw = (order, over) => Object.assign({ standardChoice: 'T568B', order: order.slice(), stripped: true, strip_mm: 25, cut: true, untwist_mm: 12, depth_mm: 22, crimped: true }, over || {});
const qc = (o1, o2) => g.grade('c6', { end1: raw(B, o1), end2: raw(B, o2) });
const qcOrder = (ord1, o1) => g.grade('c6', { end1: raw(ord1, o1), end2: raw(B) });
const mist = (r, k) => r.details.mistakes[k || 0];

it('c6 correct physical cable = 10/10 (untwist 10..13 mm, pushed fully, jacket under the bar)', () => {
  for (const u of [10, 11, 12, 13]) {
    const r = qc({ untwist_mm: u }, { untwist_mm: u });
    assert.strictEqual(r.score, 10, u + ' ' + r.feedback.join('\n'));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.details.tester.verdict, 'straight');
    assert.deepStrictEqual(r.details.mistakes, [[], []]);
  }
});

it('c6 untwisted too long (16 mm): crosstalk + jacket cannot reach the crimp bar', () => {
  const r = qc({ untwist_mm: 16, strip_mm: 30 });
  assert.deepStrictEqual(mist(r), ['untwist_long', 'jacket_out']);
  assert.strictEqual(r.score, 8);
  assert.ok(fbHas(r, /ปลายที่ 1: ส่วนที่คลายเกลียวยาว 16 มม\. เกิน 13 มม\..*crosstalk/));
  assert.ok(fbHas(r, /ปลายที่ 1: เปลือกนอกเข้าไปเพียง 6 มม\..*หลุด/));
  assert.strictEqual(r.details.tester.verdict, 'straight');   // the LED tester alone would not show it
});

it('c6 untwist 14 mm: only the crosstalk point is lost (jacket still reaches the bar)', () => {
  const r = qc({ untwist_mm: 14 });
  assert.deepStrictEqual(mist(r), ['untwist_long']);
  assert.strictEqual(r.score, 9);
});

it('c6 wires not pushed to the end of the plug: open on all pins of that end', () => {
  const r = qc({}, { depth_mm: 20 });
  assert.deepStrictEqual(mist(r, 1), ['not_pushed']);
  assert.strictEqual(r.score, 9);
  assert.ok(fbHas(r, /ปลายที่ 2: ดันสายไม่สุดหัว ปลายสายห่างผนังด้านหน้า 2 มม\..*ขา 1, 2, 3, 4, 5, 6, 7, 8 วงจรขาด/));
  assert.strictEqual(r.details.tester.verdict, 'open');
  assert.deepStrictEqual(r.details.tester.open, [1, 2, 3, 4, 5, 6, 7, 8]);
  // pushed 21 mm: tips 1 mm short of the blades is still an open
  assert.deepStrictEqual(mist(qc({ depth_mm: 21 })), ['not_pushed']);
});

it('c6 jacket not under the crimp bar (pushed only part way with a long untwist) and jacket outside the plug', () => {
  const r = qc({ untwist_mm: 13, depth_mm: 20 });   // jacket edge 7 mm in (< 8) and tips short
  assert.ok(mist(r).includes('jacket_out') && mist(r).includes('not_pushed'));
  assert.ok(fbHas(r, /เปลือกนอกเข้าไปเพียง 7 มม\. ยังไม่ถึงตัวกดเปลือก/));
  const out = qc({ cut: false, strip_mm: 30, untwist_mm: 30 });   // never trimmed: 30 mm of loose wire
  assert.ok(mist(out).includes('jacket_out'));
  assert.ok(fbHas(out, /เปลือกนอกอยู่นอกหัว \(ห่างท้ายหัว 8 มม\.\)/));
});

it('c6 not trimmed evenly: pins 7, 8 do not reach the contacts and the untwist is too long', () => {
  const r = qc({ cut: false, strip_mm: 13, untwist_mm: 13 });
  assert.deepStrictEqual(mist(r), ['not_trimmed']);
  assert.ok(fbHas(r, /ไม่ได้ตัดปลายสายให้เสมอกัน.*ขา 7, 8/));
  assert.deepStrictEqual(r.details.tester.open, [7, 8]);
  assert.strictEqual(r.score, 9);
});

it('c6 cut too short (8 mm): jacket hits the channels, wires cannot reach', () => {
  const r = qc({ untwist_mm: 8, depth_mm: 22 });   // the depth claim is clamped to what is physically possible
  assert.deepStrictEqual(mist(r), ['too_short']);
  assert.strictEqual(r.details.phys[0].depth_mm, 20);
  assert.ok(fbHas(r, /ตัดสายสั้นเกินไป \(8 มม\.\)/));
  assert.strictEqual(r.score, 9);
});

it('c6 split pair passes continuity but is detected and explained', () => {
  const sp = ['wo', 'o', 'wg', 'g', 'wb', 'bl', 'wbr', 'br'];
  const r = g.grade('c6', { end1: raw(sp), end2: raw(sp) });
  assert.deepStrictEqual(r.details.mistakes, [['split'], ['split']]);
  assert.strictEqual(r.details.tester.verdict, 'straight');
  assert.deepStrictEqual(r.details.tester.split, [3, 4, 5, 6]);
  assert.strictEqual(r.score, 6);
  assert.ok(fbHas(r, /split pair\) ที่ขา 3, 4, 5, 6.*crosstalk.*ไฟติดครบ/));
});

it('c6 wrong order names the pins; wrong standard (T568A) gets half the order points', () => {
  const r = qcOrder(['wo', 'o', 'bl', 'wg', 'wb', 'g', 'wbr', 'br']);
  assert.deepStrictEqual(mist(r), ['order']);
  assert.ok(fbHas(r, /ขา 3 \(น้ำเงิน\), ขา 4 \(ขาวเขียว\)/));
  assert.strictEqual(r.details.tester.verdict, 'miswire');
  assert.strictEqual(r.score, 8);
  const a = qcOrder(A);
  assert.deepStrictEqual(mist(a), ['wrong_standard']);
  assert.strictEqual(a.score, 9);
  assert.strictEqual(a.details.tester.verdict, 'crossed');
});

it('c6 not crimped / not stripped / empty slot', () => {
  const r = qc({ crimped: false });
  assert.deepStrictEqual(mist(r), ['not_crimped']);
  assert.strictEqual(r.score, 8);
  const ns = qc({ stripped: false });
  assert.deepStrictEqual(mist(ns), ['not_stripped']);
  assert.strictEqual(ns.score, 5);
  const o = B.slice(); o[4] = null;
  const e = qcOrder(o);
  assert.ok(mist(e).includes('order') && mist(e).includes('empty_slot'));
  assert.ok(fbHas(e, /ขา 5 ไม่มีสาย/));
});

it('c6 derived flags from the browser are ignored (jacketInside/pushed cannot be faked)', () => {
  const r = qc({ untwist_mm: 20, strip_mm: 30, jacketInside: true, pushed: true, depth_mm: 999 });
  assert.ok(mist(r).includes('jacket_out') && mist(r).includes('untwist_long'));
  assert.strictEqual(r.details.phys[0].depth_mm, 22);
});

it('c6 malformed payloads score 0 without throwing', () => {
  for (const p of [undefined, null, 42, 'x', [], {}, { end1: raw(B) }, { end1: raw(B), end2: { order: B.slice(0, 7) } },
    { end1: raw(['x', 'o', 'wg', 'bl', 'wb', 'g', 'wbr', 'br']), end2: raw(B) }]) {
    const r = g.grade('c6', p);
    assert.strictEqual(r.score, 0, JSON.stringify(p)); assert.ok(r.feedback.length);
  }
  const junk = g.grade('c6', { end1: raw(B, { untwist_mm: 'abc', depth_mm: {}, strip_mm: null }), end2: raw(B) });
  assert.ok(junk.score < 10 && junk.score >= 5);
});

/* ---------- c7: reading the LED tester ---------- */
const W = g._lib.wiremap;
const te = (order, over) => Object.assign({ order: order.slice(), contact: order.map(c => !!c), bridge: [] }, over || {});
const step = (w, i) => (w.seq[i].main ? 'M' : '-') + (w.seq[i].remote.map(x => x + 1).join('') || 'x');

it('wiremap: straight / open / short / reversed pair / crossed / split behave like a two-piece LED tester', () => {
  const ok = W(te(B), te(B));
  assert.strictEqual(ok.verdict, 'straight'); assert.strictEqual(ok.seq.length, 9);
  assert.deepStrictEqual(ok.seq[8], { main: false, remote: [], g: true });   // G dark on UTP
  const open = W(te(B), te(B, { contact: [1, 1, 1, 0, 1, 1, 1, 1].map(Boolean) }));
  assert.strictEqual(open.verdict, 'open'); assert.deepStrictEqual(open.pins, [3]);
  assert.strictEqual(step(open, 3), '-x');                                   // main and remote both dark
  const sh = W(te(B, { bridge: [[0, 1]] }), te(B));
  assert.strictEqual(sh.verdict, 'short'); assert.deepStrictEqual(sh.pins, [0, 1]);
  assert.strictEqual(step(sh, 0), 'Mx'); assert.strictEqual(step(sh, 2), 'M3');  // main lights, remote dark
  const pr = W(te(B), te(['o', 'wo', 'wg', 'bl', 'wb', 'g', 'wbr', 'br']));
  assert.strictEqual(pr.verdict, 'pairrev'); assert.deepStrictEqual(pr.pins, [0, 1]);
  assert.strictEqual(W(te(B), te(A)).verdict, 'crossed');
  const sp = ['wo', 'o', 'wg', 'g', 'wb', 'bl', 'wbr', 'br'];
  const s = W(te(sp), te(sp));
  assert.strictEqual(s.verdict, 'straight'); assert.deepStrictEqual(s.split, [2, 3, 4, 5]);
  assert.strictEqual(W(te(B), te(B.slice().reverse())).verdict, 'reversed');
});

it('c7 publishes only the LED sequence, not the wiring (answers stay on the server)', () => {
  const m = g.missions.find(x => x.id === 'c7');
  assert.strictEqual(m.start.cables.length, 6);
  for (const c of m.start.cables) {
    assert.ok(Array.isArray(c.seq) && c.seq.length === 9);
    assert.ok(!('e1' in c) && !('end1' in c) && !('order' in c));
  }
  assert.ok(!/wbr|"bridge"|"contact"/.test(JSON.stringify(m.start.cables)));
});

const C7 = { r1: { fault: 'open', pins: [7] }, r2: { fault: 'short', pins: [2, 3] }, r3: { fault: 'pairrev', pins: [1, 2] },
  r4: { fault: 'ok' }, r5: { fault: 'crossed', pins: [1, 2, 3, 6] }, r6: { fault: 'split' } };

it('c7 correct diagnosis of all six cables = 12/12', () => {
  const r = g.grade('c7', { diagnosis: C7 });
  assert.strictEqual(r.score, 12, r.feedback.join('\n')); assert.strictEqual(r.ok, true);
  assert.ok(fbHas(r, /สาย 6: ถูกต้อง.*split pair.*เครื่องทดสอบพื้นฐาน/));
});

it('c7 wrong fault type, wrong pins, split read as ok (partial + explanation), missing', () => {
  const d = JSON.parse(JSON.stringify(C7));
  d.r1 = { fault: 'short', pins: [7] };     // open read as short -> 0
  d.r2.pins = [2];                          // right type, wrong pins -> 1
  d.r6 = { fault: 'ok' };                   // split read as ok -> 1 + explanation
  delete d.r4;                              // not answered -> 0
  const r = g.grade('c7', { diagnosis: d });
  assert.strictEqual(r.score, 12 - 2 - 1 - 1 - 2);
  assert.ok(fbHas(r, /สาย 1: วินิจฉัย "สายลัดวงจร.*ไม่ติด/));
  assert.ok(fbHas(r, /สาย 2: ชนิดปัญหาถูก แต่ขาที่เลือก \(2\)/));
  assert.ok(fbHas(r, /สาย 6: อ่านไฟถูก.*ตรวจไม่พบ/));
  assert.ok(fbHas(r, /สาย 4: ยังไม่ได้เลือก/));
  assert.strictEqual(g.grade('c7', { diagnosis: { r5: { fault: 'miswire', pins: [1, 2, 3, 6] } } }).score, 0);
});

it('c7 malformed payloads score 0 without throwing', () => {
  for (const p of [undefined, null, 'x', [], {}, { diagnosis: 'open' }, { diagnosis: [] }, { diagnosis: { r1: 'open' } },
    { diagnosis: { r1: { fault: 'boom', pins: 'x' } } }, { diagnosis: { r1: { fault: 'open', pins: [{}, -1, 99] } } }]) {
    const r = g.grade('c7', p);
    assert.ok(r.score <= 1, JSON.stringify(p)); assert.strictEqual(r.ok, false);
  }
  assert.strictEqual(g.grade('c7', { diagnosis: { r1: { fault: 'open', pins: [{}, -1, 99] } } }).score, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
