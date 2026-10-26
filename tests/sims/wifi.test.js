// Tests for the Wi-Fi Planning lab engine and grader: node tests/sims/wifi.test.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const WF = require('../../public/js/sim/wifi.js');
const g = require('../../server/sims/wifi.js');

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message); }
}
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= (eps || 1e-6), `${msg || ''} expected ${b}, got ${a}`);
const clone = o => JSON.parse(JSON.stringify(o));
const M = id => g.missions.find(m => m.id === id);
const aps = id => clone(M(id).start.aps);
const seeded = seed => { let c = 0; return () => { const h = crypto.createHash('sha256').update(seed + ':' + (c++)).digest(); return h.readUInt32BE(0) / 4294967296; }; };
const empty = (W, H) => ({ id: 't', name: 't', W, H, walls: [], rooms: [{ n: 'all', x: 0, y: 0, w: W, h: H, req: true }] });
const AP = (id, x, y, band, ch, width, tx) => ({ id, name: id.toUpperCase(), x, y, band, ch, width, tx });

console.log('wifi engine: path loss');
it('log-distance path loss matches hand-computed values (PL0 40/47 dB, n = 3)', () => {
  near(WF.pathLoss('2.4', 1), 40); near(WF.pathLoss('5', 1), 47);
  near(WF.pathLoss('2.4', 10), 70);                 // 40 + 30*log10(10)
  near(WF.pathLoss('5', 100), 107);                 // 47 + 30*2
  near(WF.pathLoss('2.4', 0.3), 40, 1e-9, 'distance clamps at 1 m');
  near(WF.pathLoss('5', 20), 47 + 30 * Math.log10(20));
});
it('RSSI = tx + 3 dBi - PL - walls (free space and through walls)', () => {
  const f = empty(30, 10);
  near(WF.rssiAt(f, AP('a', 0.5, 0.5, '2.4', 1, 20, 17), 10.5, 0.5).rssi, 17 + 3 - 70);          // -50 dBm at 10 m
  near(WF.rssiAt(f, AP('a', 0.5, 0.5, '5', 36, 20, 17), 10.5, 0.5).rssi, 17 + 3 - 77);            // -57 dBm
  f.walls = [[5, 0, 5, 10, 'concrete'], [8, 0, 8, 10, 'brick']];
  const r = WF.rssiAt(f, AP('a', 0.5, 0.5, '5', 36, 20, 17), 10.5, 0.5);
  near(r.rssi, 20 - 77 - 12 - 8); assert.strictEqual(r.wallLoss, 20); assert.deepStrictEqual(r.walls.map(h => h.mat), ['concrete', 'brick']);
  // another AP listening uses its own 3 dBi antenna
  near(WF.rssiAt(f, AP('a', 0.5, 0.5, '5', 36, 20, 17), 10.5, 0.5, WF.AP_GAIN).rssi, r.rssi + 3);
});
it('material table uses the teaching ranges (drywall 3-5, glass 2-4, brick 6-10, concrete 10-15, metal 20+)', () => {
  const inR = (v, a, b) => v >= a && v <= b;
  assert.ok(inR(WF.MAT.drywall.db, 3, 5) && inR(WF.MAT.glass.db, 2, 4) && inR(WF.MAT.brick.db, 6, 10) && inR(WF.MAT.concrete.db, 10, 15) && WF.MAT.metal.db >= 20);
});
it('SNR uses a -95 dBm noise floor at 20 MHz (+3 dB per doubling)', () => {
  near(WF.snr(-65, 20), 30); near(WF.snr(-65, 40), 30 - 10 * Math.log10(2)); near(WF.snr(-65, 80), 30 - 10 * Math.log10(4));
});

console.log('wifi engine: wall counting');
it('counts each wall crossed once, ignores walls the path does not reach', () => {
  const f = empty(20, 10);
  f.walls = [[5, 0, 5, 10, 'drywall'], [10, 0, 10, 4, 'brick'], [15, 0, 15, 10, 'glass']];
  assert.strictEqual(WF.wallsCrossed(f, 0.5, 5.5, 19.5, 5.5).length, 2, 'brick wall ends at y=4');
  assert.strictEqual(WF.wallsCrossed(f, 0.5, 2.5, 19.5, 2.5).length, 3);
  assert.strictEqual(WF.wallsCrossed(f, 0.5, 2.5, 4.5, 8.5).length, 0, 'path stays left of every wall');
});
it('a path through a wall junction counts one wall (the stronger), parallel paths count none', () => {
  const f = empty(20, 20);
  f.walls = [[10, 0, 10, 10, 'drywall'], [10, 10, 10, 20, 'concrete'], [0, 10, 10, 10, 'brick']];
  const h = WF.wallsCrossed(f, 5, 5, 15, 15);        // passes exactly through (10,10)
  assert.strictEqual(h.length, 1); assert.strictEqual(h[0].mat, 'concrete');
  assert.strictEqual(WF.wallsCrossed(f, 2, 10, 8, 10).length, 0, 'collinear with the wall');
  assert.strictEqual(WF.wallsCrossed(f, 12.5, 2.5, 12.5, 18.5).length, 0);
});
it('door gaps (hwall/vwall) let the signal through without loss', () => {
  const f = WF.FLOORS.corridor;   // brick wall at y=6 with a door at x 11..12
  assert.strictEqual(WF.wallsCrossed(f, 11.5, 7.5, 11.5, 3.5).length, 0);
  assert.strictEqual(WF.wallsCrossed(f, 7.5, 7.5, 7.5, 3.5).length, 1);
});

console.log('wifi engine: channels');
it('2.4 GHz: channels 1-13, 20 MHz only, overlap when fewer than 5 apart', () => {
  assert.deepStrictEqual(WF.channelsFor('2.4', 20), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.strictEqual(WF.bonded('2.4', 14, 20), null); assert.strictEqual(WF.bonded('2.4', 6, 40), null);
  const o = (a, b) => WF.overlap({ band: '2.4', ch: a, width: 20 }, { band: '2.4', ch: b, width: 20 });
  assert.deepStrictEqual([o(1, 6).overlap, o(6, 11).overlap, o(1, 11).overlap], [false, false, false]);
  assert.strictEqual(o(1, 5).overlap, true); assert.strictEqual(o(1, 5).kind, 'overlap');
  assert.strictEqual(o(1, 3).overlap, true); assert.strictEqual(o(3, 6).overlap, true);
  assert.strictEqual(o(6, 6).kind, 'co'); assert.strictEqual(o(2, 7).overlap, false); assert.strictEqual(o(13, 9).overlap, true);
  assert.strictEqual(WF.freq('2.4', 1), 2412); assert.strictEqual(WF.freq('2.4', 13), 2472);
});
it('5 GHz: realistic list, DFS set, 40/80 MHz bonding groups', () => {
  assert.ok(!WF.CH5.includes(144) && !WF.CH5.includes(32) && WF.CH5.includes(165));
  assert.deepStrictEqual(WF.bonded('5', 44, 40), [44, 48]);
  assert.deepStrictEqual(WF.bonded('5', 40, 80), [36, 40, 44, 48]);
  assert.deepStrictEqual(WF.bonded('5', 157, 80), [149, 153, 157, 161]);
  assert.strictEqual(WF.bonded('5', 140, 40), null, '140 has no 40 MHz partner without 144');
  assert.strictEqual(WF.bonded('5', 165, 40), null);
  assert.strictEqual(WF.bonded('5', 132, 80), null);
  assert.strictEqual(WF.isDfs('5', 36, 20), false); assert.strictEqual(WF.isDfs('5', 52, 20), true); assert.strictEqual(WF.isDfs('5', 100, 80), true);
  assert.strictEqual(WF.isDfs('5', 149, 80), false);
});
it('5 GHz overlap: bonded ranges that share a 20 MHz channel overlap', () => {
  const o = (a, aw, b, bw) => WF.overlap({ band: '5', ch: a, width: aw }, { band: '5', ch: b, width: bw });
  assert.strictEqual(o(36, 80, 44, 20).overlap, true); assert.strictEqual(o(36, 80, 44, 20).kind, 'overlap');
  assert.strictEqual(o(36, 40, 44, 40).overlap, false);
  assert.strictEqual(o(36, 40, 40, 40).kind, 'co', 'same bonded pair, different primary still same channel set');
  assert.strictEqual(o(149, 40, 157, 80).overlap, true);
  assert.strictEqual(o(157, 20, 161, 20).overlap, false);
  assert.strictEqual(WF.overlap({ band: '2.4', ch: 1, width: 20 }, { band: '5', ch: 36, width: 20 }).overlap, false, 'different bands never overlap');
});

console.log('wifi engine: interference and coverage');
it('co-channel detection uses the -82 dBm threshold with AP antennas on both ends', () => {
  const f = empty(60, 4);
  // 5 GHz, 17 dBm: AP-to-AP RSSI = 23 - 47 - 30 log10(d). -82 dBm at d = 10^(58/30) = 85 m; use a concrete wall to cross the threshold
  const a = AP('a', 0.5, 1.5, '5', 36, 20, 17), b = AP('b', 40.5, 1.5, '5', 36, 20, 17);
  let c = WF.conflicts(f, [a, b])[0];
  near(c.hearAB, Math.round((23 - 47 - 30 * Math.log10(40)) * 10) / 10, 0.05);
  assert.strictEqual(c.conflict, true);
  f.walls = [[20, 0, 20, 4, 'concrete'], [25, 0, 25, 4, 'concrete']];
  c = WF.conflicts(f, [a, b])[0];
  assert.ok(c.hearAB < -82); assert.strictEqual(c.conflict, false, 'below -82 dBm: no interference');
  b.ch = 44; f.walls = [];
  assert.strictEqual(WF.conflicts(f, [a, b])[0].conflict, false, 'non-overlapping channels never conflict');
  // either side hearing above the threshold counts (asymmetric power)
  const x = AP('x', 0.5, 1.5, '5', 36, 20, 5), y = AP('y', 30.5, 1.5, '5', 36, 20, 17);
  f.walls = [[15, 0, 15, 4, 'brick']];
  c = WF.conflicts(f, [x, y])[0];
  assert.ok(c.hearAB < -82 && c.hearBA >= -82 && c.conflict);
});
it('neighbour APs only conflict with own APs, never with each other', () => {
  const f = empty(20, 10);
  const nb = [AP('n1', 1.5, 1.5, '2.4', 1, 20, 17), AP('n2', 2.5, 1.5, '2.4', 1, 20, 17)];
  const cf = WF.conflicts(f, [AP('a', 10.5, 5.5, '5', 36, 20, 17)], nb);
  assert.strictEqual(cf.length, 2); assert.ok(cf.every(c => c.neighbour && !c.conflict));
});
it('coverage counts only required cells and rounds down to 0.1 %', () => {
  const f = empty(10, 1); f.rooms = [{ n: 'r', x: 0, y: 0, w: 10, h: 1, req: true, skip: { x: 8, y: 0, w: 2, h: 1 } }];
  assert.strictEqual(WF.requiredMask(f).reduce((s, v) => s + v, 0), 8);
  // 2.4 GHz 5 dBm: -67 needs 8 - 40 - 30 log d >= -67 -> d <= 10^(35/30) = 14.7 m, so all 8 cells pass
  let c = WF.coverage(f, [AP('a', 0.5, 0.5, '2.4', 1, 20, 5)], -67);
  assert.strictEqual(c.total, 8); assert.strictEqual(c.pct, 100);
  f.walls = [[4, 0, 4, 1, 'metal']];
  c = WF.coverage(f, [AP('a', 0.5, 0.5, '2.4', 1, 20, 5)], -60);
  assert.strictEqual(c.ok, 4); assert.strictEqual(c.pct, 50);
});
it('applyConfig: locked fields come from the mission start, illegal values are rejected', () => {
  const m = M('wf1'), st = { floor: WF.FLOORS.corridor, aps: m.start.aps, rules: m.start.rules };
  const cfg = aps('wf1'); cfg[0].x = 30.5; cfg[0].tx = 5; cfg[0].band = '5'; cfg[0].ch = 11;
  const r = WF.applyConfig(st, { aps: cfg });
  assert.ok(r.ok); assert.strictEqual(r.aps[0].x, 7.5); assert.strictEqual(r.aps[0].tx, 17); assert.strictEqual(r.aps[0].band, '2.4'); assert.strictEqual(r.aps[0].ch, 11);
  assert.strictEqual(WF.applyConfig(st, { aps: cfg.slice(0, 2) }).ok, false, 'lockSet: cannot remove');
  const c2 = aps('wf1'); c2[1].ch = 14; assert.strictEqual(WF.applyConfig(st, { aps: c2 }).ok, false);
  const s2 = { floor: WF.FLOORS.wing, aps: M('wf5').start.aps, rules: M('wf5').start.rules };
  const c3 = aps('wf5'); c3[3].x = 35.2; c3[3].y = 13.1;   // inside the lift shaft
  assert.strictEqual(WF.applyConfig(s2, { aps: c3 }).ok, false);
  const c4 = aps('wf5'); c4[0].x = 6.9; c4[0].y = 3.2;
  const r4 = WF.applyConfig(s2, { aps: c4 }); assert.deepStrictEqual([r4.aps[0].x, r4.aps[0].y], [6.5, 3.5], 'snaps to the cell centre');
  const c5 = aps('wf5'); c5[0].tx = 20; assert.strictEqual(WF.applyConfig(s2, { aps: c5 }).ok, false, 'tx list is 5..17 dBm');
});

/* ---------------- grading ---------------- */
console.log('wifi grading');
const ok = (r, msg) => assert.strictEqual(r.score, r.max, (msg || '') + ' ' + r.feedback.join(' | '));
it('wf1: 1/6/11 passes, the start (6/6/9) and 1/3/6 fail with the conflicting pairs named', () => {
  const a = aps('wf1');
  assert.strictEqual(g.grade('wf1', { aps: a }).score, 0);
  a[0].ch = 1; a[1].ch = 6; a[2].ch = 11; ok(g.grade('wf1', { aps: a }));
  a[0].ch = 3; a[1].ch = 8; a[2].ch = 13; ok(g.grade('wf1', { aps: a }), '3/8/13 is also non-overlapping');
  a[0].ch = 1; a[1].ch = 3; a[2].ch = 6;
  const r = g.grade('wf1', { aps: a });
  assert.ok(r.score < 5 && r.feedback.some(f => /AP-1.*AP-2.*ห่างกัน 2 ช่อง/.test(f)));
});
it('wf2: APs in the corridor fail (concrete), one AP per lab on different channels passes; same channel loses 3', () => {
  const a = aps('wf2');
  const r0 = g.grade('wf2', { aps: a }); assert.ok(r0.score < 4); assert.ok(r0.details.coverage.pct < 60);
  a[0].x = 8.5; a[0].y = 6.5; a[1].x = 24.5; a[1].y = 6.5; a[1].ch = 44;
  ok(g.grade('wf2', { aps: a }));
  a[1].ch = 36; assert.strictEqual(g.grade('wf2', { aps: a }).score, 7);
  a[1].ch = 40; a[1].width = 20; a[0].width = 40; assert.strictEqual(g.grade('wf2', { aps: a }).score, 7, '36/40 MHz overlaps 40');
  const b = aps('wf2'); b[0].band = '2.4'; b[0].ch = 1;
  const rb = g.grade('wf2', { aps: b }); assert.strictEqual(rb.score, 0, 'band is locked to 5 GHz, channel 1 does not exist there'); assert.ok(rb.feedback.some(f => /ช่อง 1/.test(f)));
});
const wf3good = () => ({ aps: [AP('ap1', 11.5, 7.5, '5', 157, 20, 17), AP('ap2', 19.5, 7.5, '5', 161, 20, 17)], answers: { band: 'b', width: 'c' }, report: 'r' });
it('wf3: two 5 GHz APs on free non-DFS 20/40 MHz channels pass; 2.4 GHz, 80 MHz, DFS and one AP do not', () => {
  const r = g.grade('wf3', wf3good()); ok(r); assert.ok(Array.isArray(r.rubric) && r.rubric.reduce((s, x) => s + x.score, 0) === 10);
  const p40 = wf3good(); p40.aps[0].ch = 157; p40.aps[0].width = 40; p40.aps[1].ch = 165; ok(g.grade('wf3', p40), '157-161/40 + 165/20');
  const s0 = g.grade('wf3', { aps: aps('wf3') }); assert.ok(s0.score <= 3, String(s0.score));
  for (const ch of [1, 4, 6, 9, 11, 13]) {
    const p = wf3good(); p.aps[0] = AP('ap1', 11.5, 7.5, '2.4', ch, 20, 17);
    assert.ok(g.grade('wf3', p).score <= 7, '2.4 GHz channel ' + ch + ' always meets a neighbour');
  }
  const p80 = wf3good(); p80.aps[0].ch = 149; p80.aps[0].width = 80; assert.ok(g.grade('wf3', p80).score <= 7);
  const pd = wf3good(); pd.aps[0].ch = 100; const rd = g.grade('wf3', pd); assert.strictEqual(rd.score, 9); assert.ok(rd.feedback.some(f => /DFS/.test(f)));
  const p1 = wf3good(); p1.aps = [p1.aps[0]]; p1.aps[0].x = 15.5; p1.aps[0].y = 6.5;
  const r1 = g.grade('wf3', p1); assert.strictEqual(r1.score, 8); assert.ok(r1.feedback.some(f => /48 เครื่อง/.test(f)));
  const pq = wf3good(); pq.answers = { band: 'a', width: 'c' }; assert.strictEqual(g.grade('wf3', pq).score, 9);
  const p4 = wf3good(); p4.aps.push(AP('ap3', 15.5, 3.5, '5', 165, 20, 17), AP('ap4', 15.5, 10.5, '5', 157, 20, 17));
  assert.strictEqual(g.grade('wf3', p4).score, 0, 'more than 3 APs is rejected');
});
it('wf3: neighbour APs from the client are ignored (server uses its own list)', () => {
  const p = wf3good(); p.neighbours = []; p.aps[0].ch = 149; p.aps[0].width = 40;
  assert.ok(g.grade('wf3', p).score < 10);
});
it('wf5: the fix (1/6/11/1, AP-4 out from behind the lift) plus both true causes passes', () => {
  const a = aps('wf5');
  const r0 = g.grade('wf5', { aps: a, answers: { causes: [] } });
  assert.ok(r0.score < 2 && r0.details.coverage.pct < 95 && r0.details.conflicts.filter(c => c.conflict).length === 2);
  a[1].ch = 6; a[2].ch = 11; a[3].ch = 1; a[3].x = 43.5; a[3].y = 14.5;
  ok(g.grade('wf5', { aps: a, answers: { causes: ['overlap', 'elevator'] } }));
  assert.strictEqual(g.grade('wf5', { aps: a, answers: { causes: ['overlap', 'elevator', 'power'] } }).score, 9, 'a wrong cause costs a point');
  assert.strictEqual(g.grade('wf5', { aps: a, answers: { causes: ['overlap'] } }).score, 8);
  assert.strictEqual(g.grade('wf5', { aps: a, answers: { causes: ['overlap', 'overlap', 'elevator', 'zzz', 5] } }).score, 10, 'duplicates and junk ignored');
  const b = clone(a); b[3].x = 32.5; b[3].y = 15.5;     // channels fixed but AP-4 still behind the lift
  const rb = g.grade('wf5', { aps: b, answers: { causes: ['overlap', 'elevator'] } });
  assert.ok(rb.score < 10 && rb.feedback.some(f => /ฝ่ายบริการลูกค้า/.test(f)));
  const c = clone(a); c[0].x = 6.5; c[0].y = 9.5; c[3].x = 42.5; c[3].y = 9.5;   // reuse of ch 1 down the open corridor
  const rc = g.grade('wf5', { aps: c, answers: { causes: ['overlap', 'elevator'] } });
  assert.ok(rc.feedback.some(f => /AP-1.*AP-4.*co-channel/.test(f)), rc.feedback.join('|'));
  const d = clone(a); d.push(AP('ap5', 40.5, 3.5, '2.4', 6, 20, 17));
  assert.strictEqual(g.grade('wf5', { aps: d, answers: { causes: ['overlap', 'elevator'] } }).score, 0, 'cannot add APs');
  const e = clone(a); e[0].band = '5'; e[0].ch = 36;
  assert.strictEqual(g.grade('wf5', { aps: e }).score, 0, '5 GHz channel on a 2.4-only AP is rejected (band locked)');
});
const goodSec = () => ({ sec: { staff: { ssid: 'KafeDee-Staff', sec: 'mixed', pass: 'Brew!ng-Beans-2024' },
  guest: { on: true, ssid: 'KafeDee-Guest', sec: 'mixed', pass: 'Latte#Free-Wifi99', isolation: true, lan: false }, wps: false, adminPass: 'R0uter-Admin!Key77', remote: false } });
it('wf6: the secure configuration passes; each weakness is graded from the settings', () => {
  ok(g.grade('wf6', goodSec()));
  assert.strictEqual(g.grade('wf6', { sec: clone(M('wf6').start.sec) }).score, 0, 'factory settings score 0');
  const t = (fn, want, re) => { const p = goodSec(); fn(p.sec); const r = g.grade('wf6', p); assert.strictEqual(r.score, want, r.feedback.join('|')); if (re) assert.ok(r.feedback.some(f => re.test(f))); };
  t(s => { s.wps = true; }, 9, /WPS/);
  t(s => { s.remote = true; }, 9.5);
  t(s => { s.adminPass = 'admin'; }, 9, /ค่าเริ่มต้น/);
  t(s => { s.adminPass = s.staff.pass; }, 9, /ไม่ซ้ำ/);
  t(s => { s.guest.lan = true; }, 9.3);
  t(s => { s.guest.isolation = false; }, 9.3, /Client isolation/);
  t(s => { s.guest.on = false; }, 5.5, /Guest network/);
  t(s => { s.guest.ssid = s.staff.ssid; }, 9, /SSID แยก/);
  t(s => { s.staff.sec = 'wpa3'; }, 8.5, /เครื่องพิมพ์/);
  t(s => { s.staff.sec = 'wpa2'; }, 9.5);
  t(s => { s.staff.sec = 'wpa2-tkip'; }, 8.5, /TKIP/);
  t(s => { s.guest.sec = 'open'; }, 8);
  t(s => { s.staff.pass = '0812345678'; }, 9, /เบอร์โทร|ตัวเลขล้วน/);
  t(s => { s.guest.pass = 'KafeDee2024!!'; }, 9, /ชื่อร้าน/);
  t(s => { s.guest.pass = s.staff.pass; }, 9, /ซ้ำกับรหัสพนักงาน/);
  t(s => { s.staff.pass = 'Abc!2345'; }, 9, /อย่างน้อย 12/);
  t(s => { s.staff.ssid = 'TP-Link_8A2C'; }, 9.5, /ยี่ห้อ/);
  t(s => { s.staff.hidden = true; }, 10, /ซ่อน SSID/);
});

console.log('wifi: malformed and tampered payloads');
it('every mission rejects junk without throwing; client-sent scores are ignored', () => {
  const big = { aps: new Array(5000).fill({ id: 'x' }) };
  const bads = [undefined, null, 5, 'x', [], {}, { aps: 'x' }, { aps: [null] }, { aps: [{ id: '<script>', x: 1, y: 1 }] }, big,
    { aps: [{ id: 'ap1', x: NaN, y: 1, band: '5', ch: 36, width: 20, tx: 17 }] }, { aps: [{ id: 'ap1', x: 1e9, y: 1, band: '5', ch: 36, width: 20, tx: 17 }] },
    { aps: [{ id: 'ap1', x: 3.5, y: 3.5, band: '6', ch: 1, width: 20, tx: 17 }] }, { aps: [{ id: 'ap1', x: 3.5, y: 3.5, band: '5', ch: 38, width: 20, tx: 17 }] },
    { aps: [{ id: 'ap1', x: 3.5, y: 3.5, band: '5', ch: 36, width: 160, tx: 17 }] }, { aps: [{ id: 'ap1', x: 3.5, y: 3.5, band: '5', ch: 36, width: 20, tx: '17' }] },
    { aps: [{ id: 'ap1', x: 3.5, y: 3.5, band: '5', ch: 36, width: 20, tx: 17 }, { id: 'ap1', x: 4.5, y: 3.5, band: '5', ch: 44, width: 20, tx: 17 }] },
    { sec: 'x' }, { sec: { staff: { sec: 'wpa9' } } }, { sec: { staff: { sec: 'mixed' }, guest: { on: true, sec: 'zzz' } } }];
  const prob = g.generate('wf4', seeded('t'));
  for (const m of g.missions) for (const p of bads) {
    let r;
    assert.doesNotThrow(() => { r = g.grade(m.id, p, prob); });
    assert.strictEqual(r.score, 0, m.id + ' ' + String(JSON.stringify(p)).slice(0, 80) + ' -> ' + r.feedback.join('|'));
    assert.ok(r.feedback.length && typeof r.feedback[0] === 'string');
  }
  assert.strictEqual(g.grade('nope', {}).score, 0);
  const p = { aps: aps('wf1'), score: 10, ok: true, coverage: 100, conflicts: [] };
  assert.strictEqual(g.grade('wf1', p).score, 0, 'claimed numbers are ignored');
  const s = goodSec(); s.sec.staff.pass = 'x'.repeat(7000);
  assert.strictEqual(g.grade('wf6', s).score, 0, 'oversized payload');
});
it('public mission data does not contain the answers', () => {
  const pubs = JSON.stringify(g.missions.map(m => { const o = {}; ['id', 'title', 'level', 'desc', 'max', 'hints', 'start', 'review', 'week', 'mode'].forEach(k => { if (m[k] !== undefined) o[k] = m[k]; }); return o; }));
  assert.ok(!/WF5_TRUE|"correct"|"answer"/.test(pubs));
  const w5 = M('wf5').start; assert.ok(w5.causes.every(c => Object.keys(c).sort().join() === 'id,th'));
  const w3 = M('wf3').start.questions; assert.ok(Object.values(w3).every(q => q.options.every(o => Object.keys(o).sort().join() === 'id,th')));
  for (const m of g.missions) {
    assert.ok(['guided', 'independent', 'trouble'].includes(m.mode) && [6, 7].includes(m.week) && m.max === 10 && /^wf\d$/.test(m.id), m.id);
    if (m.mode === 'guided') assert.ok(m.hints.length >= 3);
  }
  // the starting configurations are not already solved
  for (const id of ['wf1', 'wf2', 'wf5']) assert.ok(g.grade(id, { aps: aps(id), answers: { causes: [] } }).score < 5, id);
  assert.ok(g.grade('wf6', { sec: clone(M('wf6').start.sec) }).score < 5);
});

console.log('wifi: generated problems (wf4)');
it('generate() is deterministic for a seed and produces valid, varied floors', () => {
  const a = g.generate('wf4', seeded('s1')), b = g.generate('wf4', seeded('s1')), c = g.generate('wf4', seeded('s2'));
  assert.deepStrictEqual(a, b); assert.notDeepStrictEqual(a, c);
  const seen = new Set();
  for (let k = 0; k < 8; k++) {
    const p = g.generate('wf4', seeded('v' + k));
    assert.ok(g._lib.checkWf4Problem(p), 'valid problem');
    assert.ok(p.budget >= 2 && p.budget <= 8, 'budget ' + p.budget);
    seen.add(p.floor.W + 'x' + p.floor.H + ':' + p.target + ':' + p.minWidth);
    assert.ok(!('picks' in p) && !JSON.stringify(p).includes('"tx"'), 'no AP positions in the public problem');
  }
  assert.ok(seen.size >= 4);
  assert.strictEqual(g.generate('wf1', seeded('x')), null);
});
it('wf4: the greedy plan the generator verified is gradable to full marks; over budget, wrong width and DFS lose points', () => {
  for (let k = 0; k < 4; k++) {
    const p = g.generate('wf4', seeded('sol' + k));
    const plan = g._lib.greedyPlan(p.floor, p.target);
    assert.strictEqual(plan.picks.length, p.budget);
    // colour like the generator does
    const list = p.minWidth === 80 ? WF.G80 : p.minWidth === 40 ? WF.G40 : WF.CH5.map(c => [c]);
    const blocks = list.filter(bk => p.dfs || !bk.some(c => WF.DFS.includes(c)));
    const sol = [];
    for (const q of plan.picks) {
      const ap = { id: 'ap' + (sol.length + 1), x: q.x, y: q.y, band: '5', width: p.minWidth, tx: 17 };
      const blk = blocks.find(bk => { ap.ch = bk[0]; return !WF.conflicts(p.floor, sol.concat([ap])).some(c => c.conflict); });
      assert.ok(blk, 'colourable'); ap.ch = blk[0]; sol.push(ap);
    }
    ok(g.grade('wf4', { aps: sol }, p), 'seed ' + k);
    const over = sol.concat([{ id: 'apx', x: 0.5, y: 0.5, band: '5', ch: 36, width: p.minWidth, tx: 5 }, { id: 'apy', x: p.floor.W - 0.5, y: 0.5, band: '5', ch: 36, width: p.minWidth, tx: 5 }]);
    const ro = g.grade('wf4', { aps: over }, p); assert.ok(ro.score <= 8 && ro.feedback.some(f => /เกินงบ/.test(f)));
    if (p.minWidth > 20) { const nw = clone(sol); nw[0].width = 20; nw[0].ch = 36; const rn = g.grade('wf4', { aps: nw }, p); assert.ok(rn.feedback.some(f => /ช่องกว้างน้อยกว่า/.test(f))); }
    if (!p.dfs) { const nd = clone(sol); nd[0].ch = p.minWidth === 80 ? 52 : p.minWidth === 40 ? 52 : 100; const rd = g.grade('wf4', { aps: nd }, p); assert.ok(rd.feedback.some(f => /DFS/.test(f))); }
    const same = sol.map(a => Object.assign({}, a, { ch: blocks[0][0] }));
    if (WF.conflicts(p.floor, same).some(c => c.conflict)) assert.ok(g.grade('wf4', { aps: same }, p).score <= 8.5);
  }
});
it('wf4: missing or tampered problem is rejected', () => {
  const p = g.generate('wf4', seeded('tp'));
  const sol = { aps: [{ id: 'ap1', x: 10.5, y: 10.5, band: '5', ch: 36, width: p.minWidth, tx: 17 }] };
  for (const bad of [undefined, null, {}, Object.assign(clone(p), { mission: 'wf3' }), Object.assign(clone(p), { budget: 99 }), Object.assign(clone(p), { target: -10 }),
    Object.assign(clone(p), { floor: Object.assign(clone(p.floor), { walls: [[0, 0, 1, 1, 'unobtainium']] }) }), Object.assign(clone(p), { floor: Object.assign(clone(p.floor), { W: 500 }) })]) {
    assert.strictEqual(g.grade('wf4', sol, bad).score, 0);
  }
});

/* ---------------- the real API: HMAC-signed tokens ---------------- */
async function apiTests() {
  process.env.APP_SECRET = process.env.APP_SECRET || 'wifi-test-secret';
  const express = require('express');
  const api = require('../../server/sims-api');
  const app = express(); app.use(express.json({ limit: '2mb' })); app.use('/api/sims', api.router);
  const srv = await new Promise(res => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const base = `http://127.0.0.1:${srv.address().port}/api/sims/wifi`;
  const post = async (u, body) => { const r = await fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  const tests = [];
  const at = (name, fn) => tests.push([name, fn]);
  at('API: lab listed with 6 missions; only public fields', async () => {
    const r = await (await fetch(base)).json();
    assert.deepStrictEqual(r.missions.map(m => m.id), ['wf1', 'wf2', 'wf3', 'wf4', 'wf5', 'wf6']);
    assert.ok(r.generated === true && r.missions.every(m => m.week && m.mode));
  });
  at('API wf4: token is HMAC-signed, tampering and missing tokens are rejected, a forged problem is ignored', async () => {
    const { body: { problem, token } } = await post('/new', { mission: 'wf4' });
    const tb = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    assert.deepStrictEqual(Object.keys(tb).sort(), ['exp', 'm', 'n', 'p', 's', 'u']);   // 6.x: n = one-time nonce
    assert.ok(typeof tb.n === 'string' && tb.n.length >= 12);
    assert.deepStrictEqual(tb.p, problem);
    const plan = g._lib.greedyPlan(problem.floor, problem.target);
    const list = problem.minWidth === 80 ? WF.G80 : problem.minWidth === 40 ? WF.G40 : WF.CH5.map(c => [c]);
    const blocks = list.filter(bk => problem.dfs || !bk.some(c => WF.DFS.includes(c)));
    const sol = [];
    for (const q of plan.picks) { const ap = { id: 'ap' + (sol.length + 1), x: q.x, y: q.y, band: '5', width: problem.minWidth, tx: 17 }; ap.ch = blocks.find(bk => { ap.ch = bk[0]; return !WF.conflicts(problem.floor, sol.concat([ap])).some(c => c.conflict); })[0]; sol.push(ap); }
    const good = await post('/submit', { mission: 'wf4', payload: { aps: sol }, token });
    assert.strictEqual(good.status, 200); assert.strictEqual(good.body.score, 10, good.body.feedback.join('|'));
    const tb2 = Object.assign({}, tb, { p: Object.assign({}, tb.p, { budget: 12 }) });
    const forged = Buffer.from(JSON.stringify(tb2)).toString('base64url') + '.' + token.split('.')[1];
    assert.strictEqual((await post('/submit', { mission: 'wf4', payload: { aps: sol }, token: forged })).status, 400);
    assert.strictEqual((await post('/submit', { mission: 'wf4', payload: { aps: sol }, token: token.slice(0, -2) + 'AA' })).status, 400);
    assert.strictEqual((await post('/submit', { mission: 'wf4', payload: { aps: sol } })).status, 400);
    const other = await post('/submit', { mission: 'wf4', payload: { aps: sol }, problem: Object.assign({}, problem, { budget: 1 }), token });
    assert.strictEqual(other.body.score, 10, 'the problem sent next to the token is ignored');
    assert.strictEqual((await post('/new', { mission: 'wf1' })).status, 404);
  });
  at('API: non-generated missions need no token', async () => {
    const a = aps('wf1'); a[0].ch = 1; a[1].ch = 6; a[2].ch = 11;
    const r = await post('/submit', { mission: 'wf1', payload: { aps: a } });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.score, 10);
    const r6 = await post('/submit', { mission: 'wf6', payload: goodSec() });
    assert.strictEqual(r6.body.score, 10);
  });
  at('6.x wording: wf5 overlap cause, wf1 hint 2 (22 MHz DSSS, 5 channels apart), Thai + English lab labels', async () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../server/sims/wifi.js'), 'utf8');
    const ov = /\{ id: 'overlap', th: '([^']+)'/.exec(src)[1];
    assert.ok(/ช่อง 1 กับ 6 ไม่เหลื่อมกัน/.test(ov) && /ช่อง 3/.test(ov), ov);
    const h = g.missions.find(m => m.id === 'wf1').hints[1];
    assert.ok(/22 MHz/.test(h) && /802\.11b/.test(h) && /DSSS/.test(h) && /5 ช่อง/.test(h) && !/20 MHz/.test(h), h);
    g.missions.forEach(m => assert.ok(!/^(Guided|Independent|Troubleshooting) \(/.test(m.desc), m.id + ' untranslated label'));
    const bsrc = require('fs').readFileSync(require('path').join(__dirname, '../../public/js/sim/wifi.js'), 'utf8');
    assert.ok(/independent: 'ฝึกเอง \(Independent Lab\)'/.test(bsrc));
  });
  at('6.x browser: a replayed wf4 token shows the practice message and does not raise the best score', async () => {
    let JSDOM, VirtualConsole; try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { return; }
    const vc = new VirtualConsole(); vc.on('jsdomError', () => {});   // jsdom has no canvas: the heat map is skipped
    const fs = require('fs'), path = require('path');
    const dom = new JSDOM('<!doctype html><html><head></head><body><div id="r"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc });
    const w = dom.window; w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.eval(fs.readFileSync(path.join(__dirname, '../../public/js/sim/wifi.js'), 'utf8'));
    const pub = (await (await fetch(base)).json()).missions;
    const msg = "โจทย์นี้ส่งไปแล้ว ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน กด 'โจทย์ใหม่' เพื่อทำข้อใหม่";
    const ctx = { missions: pub, done: { wf4: { best: 3, max: 10, attempts: 1 } }, user: { name: 'x' }, initial: 'wf4', toast() {},
      newProblem: async id => (await post('/new', { mission: id })).body,
      submit: async () => ({ score: 10, max: 10, ok: true, feedback: ['ok'], saved: true, practice: true, message: msg }) };
    const root = w.document.getElementById('r');
    w.NL_SIMS.wifi.mount(root, ctx);
    for (let i = 0; i < 20 && !root.querySelector('[data-act="submit"]:not([disabled])'); i++) {
      const nb = root.querySelector('[data-act="new"]'); if (nb && i === 3) nb.click();
      await new Promise(r => setTimeout(r, 20));
    }
    root.querySelector('[data-act="submit"]').click(); await new Promise(r => setTimeout(r, 30));
    assert.ok(root.textContent.includes('ผลครั้งนี้เป็นการฝึก ไม่นับคะแนน'), 'practice message shown');
    assert.ok(!/บันทึกแล้ว/.test(root.querySelector('.nls-wifi-score').textContent));
    assert.ok(/คะแนนดีที่สุด 3\/10|3\/10/.test(root.querySelector('[data-id="wf4"]').textContent), 'best score not raised by a practice result');
    w.close();
  });
  for (const [name, fn] of tests) {
    try { await fn(); passed++; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '\n     ', (e && e.stack || String(e)).split('\n').slice(0, 5).join('\n      ')); }
  }
  srv.close();
}

apiTests().catch(e => { failed++; console.log('  ✗ API tests crashed', e); }).then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
