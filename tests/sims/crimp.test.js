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
  assert.deepStrictEqual(g.missions.map(m => m.id), ['c1', 'c2', 'c3', 'c4', 'c5']);
  for (const m of g.missions) {
    assert.strictEqual(m.max, 10);
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

it('c5 correct + advanced tester = 10/10; basic tester or none loses 1', () => {
  const p = { end1: end(B, 'T568B', { untwist_mm: 13 }), end2: end(B, 'T568B'), tested: 'advanced' };
  assert.strictEqual(g.grade('c5', p).score, 10);
  const basic = g.grade('c5', Object.assign({}, p, { tested: 'basic' }));
  assert.strictEqual(basic.score, 9); assert.ok(fbHas(basic, /ขั้นสูง/));
  assert.strictEqual(g.grade('c5', Object.assign({}, p, { tested: null })).score, 9);
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
