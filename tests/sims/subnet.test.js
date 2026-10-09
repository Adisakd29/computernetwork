// Tests for the Subnetting Simulator grader: node tests/sims/subnet.test.js
'use strict';
const assert = require('assert');
const sim = require('../../server/sims/subnet');

let passed = 0; let failed = 0;
const it = (name, fn) => {
  try { fn(); passed++; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '\n    ', e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e); }
};

// Seeded PRNG (mulberry32) — same kind of rand() the app passes to generate()
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// Independent reference implementation: works on octet arrays and the "block size" method
// (the way students learn it), not on 32-bit integers like the grader.
const toOct = (s) => s.split('.').map(Number);
const ostr = (o) => o.join('.');
const maskOct = (p) => [0, 1, 2, 3].map((i) => { const bits = Math.max(0, Math.min(8, p - i * 8)); return 256 - Math.pow(2, 8 - bits); });
const maskBits = (s) => toOct(s).reduce((n, o) => n + o.toString(2).split('').filter((c) => c === '1').length, 0);
function ref(ipS, p) {
  const ip = toOct(ipS); const mk = maskOct(p);
  const net = ip.map((o, i) => { const block = 256 - mk[i]; return Math.floor(o / block) * block; });
  const bc = net.map((o, i) => o + (255 - mk[i]));
  const first = net.slice(); first[3] += 1;
  const last = bc.slice(); last[3] -= 1;
  return { mask: ostr(mk), network: ostr(net), broadcast: ostr(bc), first: ostr(first), last: ostr(last), hosts: Math.pow(2, 32 - p) - 2 };
}
const cls = (ipS) => { const f = toOct(ipS)[0]; return f <= 126 ? 'A' : f <= 191 ? 'B' : 'C'; };
const addAddrs = (ipS, n) => { // add n addresses to dotted ip with carries
  const o = toOct(ipS); let carry = n;
  for (let i = 3; i >= 0; i--) { const v = o[i] + carry; o[i] = v % 256; carry = Math.floor(v / 256); }
  return ostr(o);
};
const needBits = (n) => { let h = 0; while (Math.pow(2, h) - 2 < n) h++; return Math.max(h, 2); };

function correctAnswers(id, pr) {
  if (pr.kind === 'host') {
    const p = id === 's1' ? { A: 8, B: 16, C: 24 }[cls(pr.ip)] : id === 's4' ? maskBits(pr.mask) : pr.prefix;
    const r = ref(pr.ip, p);
    const a = { network: r.network, broadcast: r.broadcast, first: r.first, last: r.last, hosts: String(r.hosts) };
    if (id === 's1') a.cls = cls(pr.ip);
    if (id === 's4') a.prefix = '/' + p; else a.mask = r.mask;
    return a;
  }
  if (pr.kind === 'same') {
    const A = ref(pr.ipA, pr.prefix).network, B = ref(pr.ipB, pr.prefix).network;
    return { netA: A, netB: B, same: A === B ? 'ใช่' : 'ไม่ใช่' };
  }
  if (pr.kind === 'count') {
    return {
      count: String(Math.pow(2, pr.x - pr.prefix)), hostsPer: String(Math.pow(2, 32 - pr.x) - 2),
      nth: addAddrs(pr.block, (pr.k - 1) * Math.pow(2, 32 - pr.x)), forN: '/' + (32 - needBits(pr.n))
    };
  }
  if (pr.kind === 'vlsm') {
    const idx = pr.reqs.map((r, i) => i).sort((a, b) => pr.reqs[b].hosts - pr.reqs[a].hosts || a - b);
    let cur = pr.block; const a = {};
    for (const i of idx) { const h = needBits(pr.reqs[i].hosts); a['net' + i] = cur; a['pre' + i] = '/' + (32 - h); cur = addAddrs(cur, Math.pow(2, h)); }
    return a;
  }
  throw new Error('unknown kind ' + pr.kind);
}

// alternative but equivalent spellings the grader must also accept
function altSpelling(id, pr, ans) {
  const a = Object.assign({}, ans);
  for (const k of Object.keys(a)) {
    if (/^(network|broadcast|first|last|netA|netB|nth|net\d)$/.test(k)) a[k] = ' ' + a[k].split('.').join(' . ') + ' ';
    if (k === 'mask' || /^pre\d$/.test(k) || k === 'forN') {
      const p = /^\//.test(a[k]) ? Number(a[k].slice(1)) : maskBits(a[k]);
      a[k] = k === 'mask' ? '/ ' + p : ostr(maskOct(p));
    }
    if (k === 'prefix') a[k] = a[k].slice(1);
    if (k === 'hosts' || k === 'hostsPer' || k === 'count') a[k] = Number(a[k]).toLocaleString('en-US');
    if (k === 'cls') a[k] = 'class ' + a[k].toLowerCase();
    if (k === 'same') a[k] = a[k] === 'ใช่' ? 'yes' : 'no';
  }
  return a;
}

// a deliberately wrong value of the same format
function wrongValue(k, v) {
  if (/^\d+$/.test(v)) return String(Number(v) + 2);
  if (/^\/\d+$/.test(v)) return '/' + (Number(v.slice(1)) === 30 ? 29 : Number(v.slice(1)) + 1);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
    if (k === 'mask') return v === '255.255.255.252' ? '255.255.255.248' : ostr(maskOct(maskBits(v) + 1));
    return addAddrs(v, 1);
  }
  if (/^[ABC]$/.test(v)) return v === 'A' ? 'B' : 'A';
  if (v === 'ใช่') return 'ไม่ใช่';
  if (v === 'ไม่ใช่') return 'ใช่';
  return 'x';
}

const ALLOWED_KEYS = new Set(['v', 'mission', 'kind', 'ip', 'prefix', 'mask', 'ipA', 'ipB', 'block', 'x', 'k', 'n', 'reqs', 'fields']);
const N = 200;

console.log('subnet grader');

it('exports the contract (id, title, 5–8 missions with max 10, generate, grade)', () => {
  assert.strictEqual(sim.id, 'subnet');
  assert.ok(typeof sim.title === 'string' && sim.title.length > 0);
  assert.ok(sim.missions.length >= 5 && sim.missions.length <= 8);
  for (const m of sim.missions) {
    assert.ok(m.id && m.title && m.desc && ['easy', 'medium', 'hard'].includes(m.level), m.id);
    assert.strictEqual(m.max, 10);
    assert.ok(Array.isArray(m.hints) && m.hints.length > 0);
  }
  assert.strictEqual(typeof sim.generate, 'function');
  assert.strictEqual(typeof sim.grade, 'function');
});

for (const m of sim.missions) {
  it(`${m.id}: ${N} seeded problems — correct answers (and alternative spellings) score 10/10`, () => {
    for (let s = 1; s <= N; s++) {
      const pr = sim.generate(m.id, seeded(s * 7919 + m.id.charCodeAt(1)));
      assert.ok(pr && pr.mission === m.id, 'problem generated');
      const ans = correctAnswers(m.id, pr);
      const g = sim.grade(m.id, { answers: ans }, pr);
      assert.strictEqual(g.score, 10, `seed ${s} ${JSON.stringify(pr)} ${JSON.stringify(ans)} → ${JSON.stringify(g.feedback)}`);
      assert.strictEqual(g.ok, true); assert.strictEqual(g.max, 10);
      assert.ok(g.feedback.length > 0);
      const g2 = sim.grade(m.id, { answers: altSpelling(m.id, pr, ans) }, pr);
      assert.strictEqual(g2.score, 10, `alt spelling seed ${s} ${JSON.stringify(altSpelling(m.id, pr, ans))} → ${JSON.stringify(g2.feedback)}`);
    }
  });

  it(`${m.id}: generation is reproducible with the same seed and varies between seeds`, () => {
    const a = JSON.stringify(sim.generate(m.id, seeded(42)));
    const b = JSON.stringify(sim.generate(m.id, seeded(42)));
    assert.strictEqual(a, b);
    const set = new Set(); for (let s = 0; s < 30; s++) set.add(JSON.stringify(sim.generate(m.id, seeded(s))));
    assert.ok(set.size > 20, 'problems vary');
  });

  it(`${m.id}: problems contain no answer fields`, () => {
    for (let s = 1; s <= N; s++) {
      const pr = sim.generate(m.id, seeded(s * 31 + 5));
      for (const k of Object.keys(pr)) assert.ok(ALLOWED_KEYS.has(k), 'unexpected key ' + k);
      for (const f of pr.fields) assert.deepStrictEqual(Object.keys(f).filter((k) => !['key', 'label', 'type', 'ph', 'row'].includes(k)), []);
      const json = JSON.stringify(pr);
      const ans = correctAnswers(m.id, pr);
      for (const [k, v] of Object.entries(ans)) {
        if (!/^\d+\.\d+\.\d+\.\d+$/.test(v) || k === 'mask') continue;
        if (v === pr.ip) continue; // the given IP may itself be the first/last host
        if (pr.kind === 'vlsm' && v === pr.block) continue; // first VLSM subnet starts at the given block by definition
        assert.ok(!json.includes('"' + v + '"'), `answer ${k}=${v} leaked in ${json}`);
      }
      assert.ok(!/"(network|broadcast|first|last|answer|answers|solution|netA|netB|same|count|nth|alloc)"\s*:/.test(json), 'answer key in ' + json);
    }
  });

  it(`${m.id}: each wrong field loses points with feedback naming the field`, () => {
    for (let s = 1; s <= 40; s++) {
      const pr = sim.generate(m.id, seeded(s * 101));
      const ans = correctAnswers(m.id, pr);
      for (const k of Object.keys(ans)) {
        const bad = Object.assign({}, ans, { [k]: wrongValue(k, ans[k]) });
        const g = sim.grade(m.id, { answers: bad }, pr);
        assert.ok(g.score < 10 && g.score > 0, `${k}: ${ans[k]} → ${bad[k]} score ${g.score}`);
        assert.strictEqual(g.ok, false);
        assert.strictEqual(g.details.fields[k], false);
        const label = pr.fields.find((f) => f.key === k).label;
        assert.ok(g.feedback.some((t) => t.includes(label)), `feedback names ${label}: ${JSON.stringify(g.feedback)}`);
        assert.ok(g.feedback.every((t) => typeof t === 'string' && t.length > 0));
      }
      // all wrong → 0, half → partial
      const allWrong = {}; for (const k of Object.keys(ans)) allWrong[k] = wrongValue(k, ans[k]);
      assert.strictEqual(sim.grade(m.id, { answers: allWrong }, pr).score, 0);
    }
  });

  it(`${m.id}: malformed payloads score 0 without throwing`, () => {
    const pr = sim.generate(m.id, seeded(9));
    const bads = [undefined, null, 0, 'x', [], {}, { answers: null }, { answers: 'abc' }, { answers: [] }, { answers: {} },
      { answers: { network: { $gt: 1 }, hosts: [1, 2], mask: 1e309, net0: '9'.repeat(100000) } },
      { answers: Object.fromEntries(pr.fields.map((f) => [f.key, '999.1.1.1'])) },
      { answers: Object.fromEntries(pr.fields.map((f) => [f.key, '   '])) }];
    for (const p of bads) {
      let g; assert.doesNotThrow(() => { g = sim.grade(m.id, p, pr); });
      assert.strictEqual(g.score, 0, String(JSON.stringify(p)).slice(0, 80));
      assert.ok(Array.isArray(g.feedback) && g.feedback.length > 0);
    }
    // broken / foreign problems
    for (const badPr of [null, undefined, 'x', {}, { mission: m.id }, Object.assign({}, pr, { mission: 'zz' }), Object.assign({}, pr, { ip: '1.2.3', ipA: 5, block: '300.1.1.1', reqs: 'x', prefix: 99, mask: '255.0.255.0' })]) {
      let g; assert.doesNotThrow(() => { g = sim.grade(m.id, { answers: correctAnswers(m.id, pr) }, badPr); });
      assert.strictEqual(g.score, 0); assert.ok(g.feedback.length > 0);
    }
  });
}

it('unknown mission → score 0, generate returns null', () => {
  assert.strictEqual(sim.grade('nope', { answers: {} }, {}).score, 0);
  assert.strictEqual(sim.generate('nope', Math.random), null);
});

it('hosts answer off by 2 gets the "อย่าลืมลบ 2" hint', () => {
  const pr = sim.generate('s2', seeded(3));
  const ans = correctAnswers('s2', pr);
  ans.hosts = String(Number(ans.hosts) + 2);
  const g = sim.grade('s2', { answers: ans }, pr);
  assert.ok(g.feedback.some((t) => t.includes('ลบ 2')));
});

it('known example: 192.168.10.77/26', () => {
  const pr = { v: 1, mission: 's3', kind: 'host', ip: '192.168.10.77', prefix: 26 };
  const g = sim.grade('s3', { answers: { mask: '255.255.255.192', network: '192.168.10.64', broadcast: '192.168.10.127', first: '192.168.10.65', last: '192.168.10.126', hosts: '62' } }, pr);
  assert.strictEqual(g.score, 10);
  const g2 = sim.grade('s3', { answers: { mask: '/26', network: '192.168.10.64', broadcast: '192.168.10.128', first: '192.168.10.65', last: '192.168.10.126', hosts: '64' } }, pr);
  assert.strictEqual(g2.details.correct, 4); assert.ok(g2.score === 7, String(g2.score));
});

it('known example: VLSM 192.168.1.0/24 with 100, 50, 20, 2 hosts', () => {
  const pr = { v: 1, mission: 's7', kind: 'vlsm', block: '192.168.1.0', prefix: 24, reqs: [{ name: 'A', hosts: 20 }, { name: 'B', hosts: 100 }, { name: 'C', hosts: 2 }, { name: 'D', hosts: 50 }] };
  const g = sim.grade('s7', { answers: { net1: '192.168.1.0', pre1: '/25', net3: '192.168.1.128', pre3: '255.255.255.192', net0: '192.168.1.192', pre0: '27', net2: '192.168.1.224', pre2: '/30' } }, pr);
  assert.strictEqual(g.score, 10, JSON.stringify(g.feedback));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
