'use strict';
/* Unit tests for the core logic students' scores depend on: subnet calculation, answer checking (incl. equivalent formats),
   scoring rules. usage: node tests/grading.test.js */
const assert = require('assert');
const { check, pointsLeft } = require('../server/grading');
const { grade, subnetFacts } = require('../server/bank-grade');
const { equivalent } = require('../server/answer-equiv');
let n = 0, failed = 0;
function it(name, fn) { try { fn(); n++; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '\n    ', e.message); } }

console.log('subnet calculation');
it('/24, /26, /30 facts', () => {
  assert.deepStrictEqual(subnetFacts('192.168.10.77', 24), { network: '192.168.10.0', broadcast: '192.168.10.255', mask: '255.255.255.0', first: '192.168.10.1', last: '192.168.10.254', hosts: '254', prefix: '24', wildcard: '0.0.0.255' });
  const f = subnetFacts('192.168.10.77', 26);
  assert.strictEqual(f.network, '192.168.10.64'); assert.strictEqual(f.broadcast, '192.168.10.127'); assert.strictEqual(f.hosts, '62'); assert.strictEqual(f.mask, '255.255.255.192');
  const g = subnetFacts('10.0.0.5', 30); assert.strictEqual(g.hosts, '2'); assert.strictEqual(g.first, '10.0.0.5'); assert.strictEqual(g.last, '10.0.0.6');
});
it('/31 (RFC 3021) has 2 usable addresses and /32 has 1', () => {
  const a = subnetFacts('10.1.1.1', 31); assert.strictEqual(a.hosts, '2'); assert.strictEqual(a.first, '10.1.1.0'); assert.strictEqual(a.last, '10.1.1.1');
  const b = subnetFacts('10.1.1.1', 32); assert.strictEqual(b.hosts, '1'); assert.strictEqual(b.first, '10.1.1.1'); assert.strictEqual(b.network, '10.1.1.1');
});
it('non-octet boundaries: /20 and /12', () => {
  const a = subnetFacts('172.16.37.9', 20); assert.strictEqual(a.network, '172.16.32.0'); assert.strictEqual(a.broadcast, '172.16.47.255'); assert.strictEqual(a.hosts, '4094');
  const b = subnetFacts('172.20.1.1', 12); assert.strictEqual(b.network, '172.16.0.0'); assert.strictEqual(b.mask, '255.240.0.0');
});
it('subnet question grading accepts /n or dotted mask, partial credit per field', () => {
  const q = { type: 'subnet', ip: '192.168.1.130', prefix: 26, ask: ['network', 'mask', 'hosts'] };
  assert.strictEqual(grade(q, { network: '192.168.1.128', mask: '/26', hosts: '62' }).correct, true);
  assert.strictEqual(grade(q, { network: '192.168.1.128', mask: '255.255.255.192', hosts: '62' }).correct, true);
  const p = grade(q, { network: '192.168.1.0', mask: '255.255.255.192', hosts: '64' }); assert.strictEqual(p.correct, false); assert(Math.abs(p.score - 1 / 3) < 1e-9);
  assert.strictEqual(grade(q, {}).empty, true);
});

console.log('equivalent answer formats');
it('mask and prefix are equivalent, but not other numbers', () => {
  assert(equivalent('255.255.255.192', '/26')); assert(equivalent('/26', '26')); assert(equivalent('/26', '255.255.255.192'));
  assert(!equivalent('255.255.255.192', '26'), 'bare number is ambiguous when the key is a dotted mask');
  assert(!equivalent('/26', '/27')); assert(!equivalent('62', '/26')); assert(!equivalent('192.168.1.0', '/24')); assert(!equivalent('255.255.255.1', '/24'));
});
it('thousands separators', () => { assert(equivalent('1024', '1,024')); assert(equivalent('16,777,214', '16777214')); assert(!equivalent('1024', '1023')); });
it('lesson text questions accept equivalent formats; exact questions do not', () => {
  const t = { type: 'text', answers: ['255.255.255.0'] };
  assert.strictEqual(check(t, '/24').correct, true); assert.strictEqual(check(t, '255.255.255.0').correct, true); assert.strictEqual(check(t, '/25').correct, false);
  assert.strictEqual(check({ type: 'text', exact: true, answers: ['255.255.255.0'] }, '/24').correct, false);
  assert.strictEqual(check({ type: 'text', answers: ['ipconfig /all'] }, 'IPCONFIG  /ALL').correct, true);
});
it('bank text and fill accept equivalent formats', () => {
  assert.strictEqual(grade({ type: 'text', answers: ['/27'] }, '255.255.255.224').correct, true);
  assert.strictEqual(grade({ type: 'fill', blanks: [['255.255.255.0'], ['254']] }, ['/24', '254']).correct, true);
  assert.strictEqual(grade({ type: 'fill', blanks: [['255.255.255.0'], ['254']] }, ['/24', '256']).correct, false);
});

console.log('answer checking and scoring rules');
it('choice / multi / tf / order', () => {
  assert.strictEqual(check({ type: 'choice', options: ['a', 'b'], correct: 1 }, 1).correct, true);
  assert.strictEqual(check({ type: 'choice', options: ['a', 'b'], correct: 1 }, 5).empty, true);
  assert.strictEqual(check({ type: 'multi', options: ['a', 'b', 'c'], correct: [0, 2] }, [2, 0, 2]).correct, true);
  assert.strictEqual(check({ type: 'multi', options: ['a', 'b', 'c'], correct: [0, 2] }, [0]).correct, false);
  assert.strictEqual(check({ type: 'tf', answer: false }, 'false').correct, true);
  assert.strictEqual(check({ type: 'order', items: [{ t: 'x' }, { t: 'y' }] }, ['x', 'y']).correct, true);
  assert.strictEqual(check({ type: 'order', items: [{ t: 'x' }, { t: 'y' }] }, ['y', 'x']).correct, false);
});
it('lab score: 10 points, hint -5, each distinct wrong answer -2, minimum 2', () => {
  assert.strictEqual(pointsLeft(0, false), 10); assert.strictEqual(pointsLeft(0, true), 5); assert.strictEqual(pointsLeft(2, false), 6);
  assert.strictEqual(pointsLeft(1, true), 3); assert.strictEqual(pointsLeft(9, true), 2);
});
it('bank match/order/scenario', () => {
  assert.strictEqual(grade({ type: 'match', left: ['a', 'b'], right: ['1', '2'], answer: [1, 0] }, [1, 0]).correct, true);
  assert.strictEqual(grade({ type: 'match', left: ['a', 'b'], right: ['1', '2'], answer: [1, 0] }, [0, 0]).detail.right, 1);
  const sc = grade({ type: 'scenario', steps: [{ correct: 0, options: ['x', 'y'] }, { correct: 1, options: ['x', 'y'] }] }, [0, 0]);
  assert.strictEqual(sc.correct, false); assert.strictEqual(sc.score, 0.5);
  assert.strictEqual(grade({ type: 'command', accept: ['^ping( -n \\d+)? 8\\.8\\.8\\.8$'] }, 'ping  8.8.8.8').correct, true);
});
console.log(`\n${n} passed${failed ? ', ' + failed + ' FAILED' : ''}`);
process.exit(failed ? 1 : 0);
