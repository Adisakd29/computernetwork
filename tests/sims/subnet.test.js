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
  if (pr.kind === 'special') {
    const o = toOct(pr.ip30); const n30 = o.slice(); n30[3] = Math.floor(o[3] / 4) * 4;
    const peer30 = n30.slice(); peer30[3] += (o[3] - n30[3] === 1 ? 2 : 1);
    const bc30 = n30.slice(); bc30[3] += 3;
    const q = toOct(pr.ip31); const peer31 = q.slice(); peer31[3] = q[3] % 2 === 0 ? q[3] + 1 : q[3] - 1;
    return { linkPre: pr.variant === 'legacy' ? '/30' : '/31', loopPre: '/32', net30: ostr(n30), bc30: ostr(bc30), peer30: ostr(peer30), peer31: ostr(peer31), hosts31: '2', hosts32: '1' };
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
    if (k === 'mask' || /^pre\d$/.test(k) || k === 'forN' || k === 'linkPre' || k === 'loopPre') {
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
  if (/^\/\d+$/.test(v)) { const p = Number(v.slice(1)); return '/' + (p >= 30 ? p - 1 : p + 1); }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
    if (k === 'mask') return v === '255.255.255.252' ? '255.255.255.248' : ostr(maskOct(maskBits(v) + 1));
    return addAddrs(v, 1);
  }
  if (/^[ABC]$/.test(v)) return v === 'A' ? 'B' : 'A';
  if (v === 'ใช่') return 'ไม่ใช่';
  if (v === 'ไม่ใช่') return 'ใช่';
  return 'x';
}

const ALLOWED_KEYS = new Set(['v', 'mission', 'kind', 'ip', 'prefix', 'mask', 'ipA', 'ipB', 'block', 'x', 'k', 'n', 'reqs', 'fields', 'variant', 'ip30', 'ip31']);
const N = 200;

console.log('subnet grader');

it('exports the contract (id, title, missions s1–s10 in order with max 10, generate, grade)', () => {
  assert.strictEqual(sim.id, 'subnet');
  assert.ok(typeof sim.title === 'string' && sim.title.length > 0);
  // NetLab 2.6: s1–s7 must keep their ids/order (stored results); s8–s10 are appended
  assert.deepStrictEqual(sim.missions.map((m) => m.id), ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10']);
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
        // s9 is graded by rules per subnet: feedback names the room/link instead of the exact field
        const label = m.id === 's9' ? pr.reqs[Number(k.slice(3))].name : pr.fields.find((f) => f.key === k).label;
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
    for (const badPr of [null, undefined, 'x', {}, { mission: m.id }, Object.assign({}, pr, { mission: 'zz' }), Object.assign({}, pr, { ip: '1.2.3', ipA: 5, block: '300.1.1.1', reqs: 'x', prefix: 99, mask: '255.0.255.0', ip30: '1.2', ip31: 7, variant: 'zz' })]) {
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


// ---------------------------------------------------------------------------------------------
// NetLab 2.6 missions s8–s10
it('s8: prefixes are /9–/15 or /17–/23 and include the private ranges 10/8, 172.16/12, 192.168/16', () => {
  const seen = { p10: 0, p172: 0, p192: 0, low: 0, high: 0, supernet172: 0 };
  for (let s = 1; s <= 400; s++) {
    const pr = sim.generate('s8', seeded(s));
    assert.ok((pr.prefix >= 9 && pr.prefix <= 15) || (pr.prefix >= 17 && pr.prefix <= 23), 'prefix ' + pr.prefix);
    const o = toOct(pr.ip);
    if (o[0] === 10) seen.p10++;
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) { seen.p172++; if (pr.prefix <= 15) seen.supernet172++; }
    if (o[0] === 192 && o[1] === 168) seen.p192++;
    if (pr.prefix < 16) seen.low++; else seen.high++;
  }
  for (const [k, v] of Object.entries(seen)) assert.ok(v > 10, k + ' ' + v);
});

it('s8: known examples 10.37.200.5/13 and 172.20.5.9/12 (multi-octet host part)', () => {
  const pr = { v: 1, mission: 's8', kind: 'host', ip: '10.37.200.5', prefix: 13 };
  const g = sim.grade('s8', { answers: { mask: '255.248.0.0', network: '10.32.0.0', broadcast: '10.39.255.255', first: '10.32.0.1', last: '10.39.255.254', hosts: '524,286' } }, pr);
  assert.strictEqual(g.score, 10, JSON.stringify(g.feedback));
  const g1 = sim.grade('s8', { answers: { mask: ' /13 ', network: ' 10.32.0.0', broadcast: '10.39.255.255 ', first: '10.32.0.1', last: '10.39.255.254', hosts: '524286' } }, pr);
  assert.strictEqual(g1.score, 10);
  // typical mistake: treating it like /24 (only zeroing the last octet)
  const g2 = sim.grade('s8', { answers: { mask: '255.248.0.0', network: '10.32.200.0', broadcast: '10.39.200.255', first: '10.32.0.1', last: '10.39.255.254', hosts: '524288' } }, pr);
  assert.strictEqual(g2.details.correct, 3); assert.ok(g2.score < 10 && g2.score > 0);
  assert.ok(g2.feedback.some((t) => t.includes('ลบ 2')));
  const pr2 = { v: 1, mission: 's8', kind: 'host', ip: '172.20.5.9', prefix: 12 };
  const g3 = sim.grade('s8', { answers: { mask: '255.240.0.0', network: '172.16.0.0', broadcast: '172.31.255.255', first: '172.16.0.1', last: '172.31.255.254', hosts: '1048574' } }, pr2);
  assert.strictEqual(g3.score, 10, JSON.stringify(g3.feedback));
  const g4 = sim.grade('s8', { answers: { mask: '255.255.0.0', network: '172.20.0.0', broadcast: '172.20.255.255', first: '172.20.0.1', last: '172.20.255.254', hosts: '65534' } }, pr2);
  assert.strictEqual(g4.score, 0); // classful thinking on a /12 is wrong in every field
});

// alternative valid VLSM layout: largest-first packed from the TOP of the block downwards
function topDown(pr, opts) {
  opts = opts || {};
  const idx = pr.reqs.map((r, i) => i).sort((a, b) => pr.reqs[b].hosts - pr.reqs[a].hosts || a - b);
  let cur = Math.pow(2, 32 - pr.prefix); const a = {};
  for (const i of idx) {
    const link = pr.reqs[i].link && opts.use31;
    const h = link ? 1 : needBits(pr.reqs[i].hosts);
    cur -= Math.pow(2, h);
    a['net' + i] = addAddrs(pr.block, cur); a['pre' + i] = opts.dotted ? ostr(maskOct(32 - h)) : '/' + (32 - h);
  }
  return a;
}

it('s9: blocks are /22 or /23 with 5–6 varied requirements that fit, not already sorted', () => {
  let unsorted = 0; const blocks = new Set(); let links = 0;
  for (let s = 1; s <= 300; s++) {
    const pr = sim.generate('s9', seeded(s));
    assert.ok(pr.prefix === 22 || pr.prefix === 23); blocks.add(pr.prefix);
    assert.ok(pr.reqs.length >= 5 && pr.reqs.length <= 6);
    assert.ok(new Set(pr.reqs.map((r) => needBits(r.hosts))).size >= 4, 'varied sizes');
    assert.ok(new Set(pr.reqs.map((r) => r.name)).size === pr.reqs.length, 'unique names');
    const sum = pr.reqs.reduce((t, r) => t + Math.pow(2, needBits(r.hosts)), 0);
    assert.ok(sum <= Math.pow(2, 32 - pr.prefix), 'fits');
    const bo = toOct(pr.block); assert.strictEqual((bo[2] * 256 + bo[3]) % Math.pow(2, 32 - pr.prefix), 0, 'block aligned');
    const hs = pr.reqs.map((r) => r.hosts); if (hs.some((h, i) => i && h > hs[i - 1])) unsorted++;
    if (pr.reqs.some((r) => r.link)) links++;
  }
  assert.strictEqual(blocks.size, 2); assert.ok(unsorted > 200, 'mostly shuffled ' + unsorted); assert.ok(links > 100);
});

it('s9: any valid layout scores 10 (top-down placement, /31 on the router link, dotted masks)', () => {
  for (let s = 1; s <= 150; s++) {
    const pr = sim.generate('s9', seeded(s * 13));
    for (const opts of [{}, { use31: true }, { dotted: true, use31: true }]) {
      const g = sim.grade('s9', { answers: topDown(pr, opts) }, pr);
      assert.strictEqual(g.score, 10, JSON.stringify(opts) + JSON.stringify(pr.reqs) + JSON.stringify(g.feedback));
      assert.ok(Array.isArray(g.details.subnets) && g.details.subnets.every((x) => Object.values(x.checks).every(Boolean)));
    }
  }
});

it('s9: rule violations each lose points with a specific message', () => {
  const pr = { v: 1, mission: 's9', kind: 'vlsm', block: '10.1.4.0', prefix: 22,
    reqs: [{ name: 'ห้องคอม 1', hosts: 200 }, { name: 'ห้องคอม 2', hosts: 100 }, { name: 'ห้องธุรการ', hosts: 50 },
      { name: 'ห้อง Server', hosts: 20 }, { name: 'ลิงก์ WAN (Router–Router)', hosts: 2, link: true }, { name: 'ห้องสมุด', hosts: 300 }] };
  const good = { net5: '10.1.4.0', pre5: '/23', net0: '10.1.6.0', pre0: '/24', net1: '10.1.7.0', pre1: '/25', net2: '10.1.7.128', pre2: '/26', net3: '10.1.7.192', pre3: '/27', net4: '10.1.7.224', pre4: '/30' };
  assert.strictEqual(sim.grade('s9', { answers: good }, pr).score, 10);
  assert.strictEqual(sim.grade('s9', { answers: Object.assign({}, good, { pre4: '255.255.255.254' }) }, pr).score, 10, '/31 on link ok');
  const cases = [
    [{ net2: '10.1.7.96' }, 2, 'alignment'],                       // /26 must start at a multiple of 64
    [{ net3: '10.1.8.0' }, 3, 'นอก block'],                       // outside 10.1.4.0/22
    [{ pre2: '/27' }, 2, 'ไม่พอ'],                                  // 30 hosts < 50
    [{ pre3: '/26', net3: '10.1.7.192' }, 3, 'เปลือง'],              // 62 hosts for 20 = waste
    [{ net1: '10.1.6.128' }, 1, 'ทับ'],                             // overlaps ห้องคอม 1 (10.1.6.0/24)
    [{ pre0: '/31', net0: '10.1.6.0' }, 0, 'point-to-point'],        // /31 only for links
    [{ pre4: '/32' }, 4, 'ไม่พอ']
  ];
  for (const [chg, i, word] of cases) {
    const g = sim.grade('s9', { answers: Object.assign({}, good, chg) }, pr);
    assert.ok(g.score > 0 && g.score < 10, JSON.stringify(chg) + ' ' + g.score);
    assert.strictEqual(g.details.fields['net' + i], false, JSON.stringify(chg));
    assert.ok(g.feedback.some((t) => t.includes(pr.reqs[i].name) && t.includes(word)), JSON.stringify(chg) + JSON.stringify(g.feedback));
  }
  // overlap marks both subnets
  const ov = sim.grade('s9', { answers: Object.assign({}, good, { net1: '10.1.6.128' }) }, pr);
  assert.strictEqual(ov.details.fields.net0, false); assert.strictEqual(ov.details.fields.net1, false);
  // the "exact answer key" is not required, but feedback never prints a full allocation
  assert.ok(!ov.feedback.join(' ').includes('10.1.7.0/25'));
  // half empty
  const half = sim.grade('s9', { answers: { net5: '10.1.4.0', pre5: '/23', net0: '10.1.6.0', pre0: '/24' } }, pr);
  assert.ok(half.score > 0 && half.score < 10); assert.ok(half.feedback.some((t) => t.includes('ยังไม่ได้กรอก')));
  // forged / inconsistent problems are refused
  for (const bad of [Object.assign({}, pr, { block: '10.1.5.0' }), Object.assign({}, pr, { reqs: pr.reqs.concat([{ name: 'x', hosts: 900 }]) }), Object.assign({}, pr, { mission: 's7' })]) {
    assert.strictEqual(sim.grade('s9', { answers: good }, bad).score, 0);
  }
});

it('s10: both variants, equivalent spellings, /31 and /32 explanations', () => {
  const base = { v: 1, mission: 's10', kind: 'special', ip30: '10.0.5.9', ip31: '10.9.9.7' };
  const ans = { linkPre: '/30', loopPre: '/32', net30: '10.0.5.8', bc30: '10.0.5.11', peer30: '10.0.5.10', peer31: '10.9.9.6', hosts31: '2', hosts32: '1' };
  assert.strictEqual(sim.grade('s10', { answers: ans }, Object.assign({ variant: 'legacy' }, base)).score, 10);
  const alt = Object.assign({}, ans, { linkPre: '255.255.255.254', loopPre: ' 255.255.255.255 ', peer31: ' 10.9.9.6 ', hosts32: ' 1 ' });
  assert.strictEqual(sim.grade('s10', { answers: alt }, Object.assign({ variant: 'rfc3021' }, base)).score, 10);
  // /30 on an RFC 3021 link is not the most address-efficient choice
  const g = sim.grade('s10', { answers: ans }, Object.assign({ variant: 'rfc3021' }, base));
  assert.strictEqual(g.score, 9); assert.strictEqual(g.details.fields.linkPre, false);
  assert.ok(g.feedback.some((t) => t.includes('RFC 3021')));
  // classic mistakes
  const w = sim.grade('s10', { answers: Object.assign({}, ans, { hosts31: '0', hosts32: '0', peer31: '10.9.9.8', loopPre: '/31' }) }, Object.assign({ variant: 'legacy' }, base));
  assert.strictEqual(w.details.correct, 4);
  assert.ok(w.feedback.some((t) => t.includes('point-to-point')));
  assert.ok(w.feedback.some((t) => t.includes('loopback')));
  // R2 given as the network address is not a valid problem
  assert.strictEqual(sim.grade('s10', { answers: ans }, Object.assign({ variant: 'legacy' }, base, { ip30: '10.0.5.8' })).score, 0);
  // generated problems: R2 is always a usable /30 host and the /31 pair is separate from the /30
  for (let s = 1; s <= 200; s++) {
    const pr = sim.generate('s10', seeded(s));
    const last = toOct(pr.ip30)[3] % 4; assert.ok(last === 1 || last === 2, pr.ip30);
    assert.ok(['legacy', 'rfc3021'].includes(pr.variant));
  }
});

// ---------------------------------------------------------------------------------------------
// 6.x browser module (jsdom): before submission the AND/OR visualiser and the teaching mode use a practice
// example, never the live problem; after submission the worked solution of the live problem is shown
async function browserTests() {
  let JSDOM;
  try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('  - jsdom not installed: browser checks skipped'); return; }
  const fs = require('fs'), path = require('path');
  const I = sim._internal;
  const run = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '\n    ', e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e); } };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const ipRe = (ip) => new RegExp('(^|[^\\d.])' + ip.replace(/\./g, '\\.') + '(?![\\d.]*\\d)');
  for (const mid of ['s1', 's2', 's3', 's4', 's5', 's6', 's8', 's10']) {
    await run(mid + ': visualiser + teaching mode before submit never show the live answer; labelled practice example', async () => {
      for (let seed = 1; seed <= 6; seed++) {
        const dom = new JSDOM('<!doctype html><html><head></head><body><div id="r"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
        const w = dom.window; w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
        w.eval(fs.readFileSync(path.join(__dirname, '../../public/js/sim/subnet.js'), 'utf8'));
        const problem = sim.generate(mid, seeded(seed * 97 + mid.length));
        const key = I.solve(mid, problem);
        const liveIps = Object.keys(key).filter((k) => key[k].type === 'ip').map((k) => I.intToIp(key[k].value));
        let submitted = null;
        const ctx = { missions: sim.missions, done: {}, user: { name: 'x' }, initial: mid,
          newProblem: async () => ({ problem, token: 't' }),
          submit: async (m, payload) => { submitted = payload; return { score: 10, max: 10, ok: true, feedback: ['ok'], details: { fields: {} }, saved: true, practice: true, message: "โจทย์นี้ส่งไปแล้ว ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน กด 'โจทย์ใหม่' เพื่อทำข้อใหม่" }; } };
        w.NL_SIMS.subnet.mount(w.document.getElementById('r'), ctx);
        const work = () => w.document.querySelector('[data-el="work"]');
        work().querySelector('[data-act="new"]').click(); await tick(); await tick();
        assert.ok(work().textContent.includes('ตัวอย่างฝึก (ไม่ใช่โจทย์ที่ส่งตรวจ)'), 'practice example is labelled');
        // press every revealing control: AND/OR, then "ดูเฉลยขั้นนี้" through all steps
        const rv = work().querySelector('[data-act="vizreveal"]'); if (rv) rv.click();
        const srcSel = work().querySelector('[data-el="vizsrc"]');
        const texts = [];
        const grab = () => { const c = work().cloneNode(true); c.querySelectorAll('.nls-subnet-q,form').forEach((x) => x.remove()); texts.push(c.textContent); };
        grab();
        if (srcSel) for (let i = 1; i < srcSel.options.length; i++) { const s2 = work().querySelector('[data-el="vizsrc"]'); s2.value = String(i); s2.dispatchEvent(new w.Event('input', { bubbles: true })); grab(); }
        for (let i = 0; i < 12; i++) {
          const chk = work().querySelector('[data-act="tcheck"]'); if (!chk) break;
          work().querySelectorAll('[data-el="teach"] input[data-ti="' + chk.getAttribute('data-ti') + '"]').forEach((x) => { x.value = 'zz'; x.dispatchEvent(new w.Event('input', { bubbles: true })); });
          chk.click(); const sh = work().querySelector('[data-act="tshow"]'); if (sh) sh.click(); grab();
        }
        const all = texts.join('\n');
        liveIps.forEach((ip) => assert.ok(!ipRe(ip).test(all), mid + ' seed ' + seed + ': live answer ' + ip + ' shown before submit'));
        // the example itself differs from the live problem
        ['ip', 'ipA', 'block', 'ip30'].forEach((k) => { if (problem[k]) assert.ok(!ipRe(problem[k]).test(work().querySelector('.nls-subnet-ex').textContent), 'example equals live ' + k); });
        // after submission: live worked solution is shown, and the practice message from the server
        work().querySelectorAll('[data-key]').forEach((x) => { x.value = '1'; });
        work().querySelector('form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await tick(); await tick();
        assert.ok(submitted, 'submitted');
        assert.ok(work().textContent.includes('ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน'), 'practice message shown');
        assert.ok(!work().querySelector('.nls-subnet-ex'), 'after submit the helpers use the graded problem');
        if (liveIps.length) assert.ok(liveIps.some((ip) => ipRe(ip).test(work().textContent)), 'worked solution of the live problem after submit');
        w.close();
      }
    });
  }
}

browserTests().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
});
