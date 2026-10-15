// Tests for the Network Monitoring & Automation lab: node tests/sims/netops.test.js
'use strict';
const assert = require('assert');
const N = require('../../public/js/sim/netops.js');
const g = require('../../server/sims/netops.js');
const ANS = require('../../server/sims/netops-answers.js');   // server-only answer key
const KEY = (S) => ANS.answerFor(S.mission, S.seed);
const REL = (S, sim) => ANS.incidentLogIds(S.mission, S.seed, sim);

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n      ') : e); }
}
const fbHas = (r, re) => r.feedback.some((f) => re.test(f));
const seedN = (i) => (0x1000a3f + i * 7919).toString(16).padStart(12, '0');
const prob = (m, i) => ({ v: 1, mission: m, seed: seedN(i) });
const MON_OK = [
  { type: 'icmp', target: 'R1', interval: 30, latWarn: 50, lossWarn: 20 },
  { type: 'tcp', target: 'SRV-WEB', port: 443, interval: 60, latWarn: 500 },
  { type: 'tcp', target: 'SRV-FILE', port: 445, interval: 60, latWarn: 500 },
  { type: 'tcp', target: 'SRV-DNS', port: 53, interval: 60, latWarn: 300 },
  { type: 'icmp', target: 'AP-1', interval: 60, latWarn: 100, lossWarn: 20 },
  { type: 'snmp', target: 'R1', iface: 'Gi0/0', interval: 60, utilWarn: 80 }
];
const A1_INV = 'hostname,mgmt_ip,role,vlans\n' + [1, 2, 3, 4, 5].map((k) => `ACC-SW${k},10.10.99.${10 + k},access,10;20;99`).join('\n');
const A1_TPL = [
  'hostname {{ hostname }}',
  '{% for v in vlans %}',
  'vlan {{ v }}',
  '{% if v == 10 %}',
  ' name STUDENT',
  '{% elif v == 20 %}',
  ' name TEACHER',
  '{% elif v == 99 %}',
  ' name MGMT',
  '{% endif %}',
  '{% endfor %}',
  'interface Vlan99',
  ' description Management',
  ' ip address {{ mgmt_ip }} {{ mgmt_mask }}',
  ' no shutdown',
  'interface Gi0/24',
  ' description Uplink to CORE-SW1',
  ' switchport mode trunk',
  ' switchport trunk allowed vlan {{ vlan_list }}',
  'ip default-gateway {{ gateway }}'
].join('\n');
const PB_OK = { tasks: [{ action: 'backup' }, { action: 'apply' }, { action: 'verify_ping', target: 'mgmt' }, { action: 'verify_port', port: 22 }, { action: 'save' }, { action: 'rollback', when: 'failure' }], anyErrorsFatal: false };
function o2Answer(seed) {
  const S = N.scenario('o2', seed), sim = N.simulate(S), k = KEY(S);
  const ids = [...REL(S, sim)].sort((a, b) => a - b).slice(0, 4);
  return { device: k.devs[0], cause: k.cause, time: N.fmtTime(k.t0, true), evidence: ids };
}
function o3Answer(seed) {
  const S = N.scenario('o3', seed), sim = N.simulate(S), k = KEY(S);
  const t = k.t0 + 300, ser = N.ifaceSeries(sim, k.bottleneck[0][0], k.bottleneck[0][1]), s = N.stepOf(t);
  return { bottleneck: { dev: k.bottleneck[0][0], iface: k.bottleneck[0][1] }, talker: { dev: k.talker[0][0], iface: k.talker[0][1] }, time: N.fmtTime(t, true), util: Math.round(Math.max(ser.inPct[s], ser.outPct[s])) };
}

console.log('netops: module + clock');

it('module shape follows SIM-SPEC §2 (public fields only, generated missions declared)', () => {
  assert.strictEqual(g.id, 'netops');
  assert.deepStrictEqual(g.missions.map((m) => m.id), ['o1', 'o2', 'o3', 'a1', 'a2']);
  assert.deepStrictEqual(g.generatedMissions, ['o2', 'o3', 'a2']);
  for (const m of g.missions) {
    assert.strictEqual(m.max, 10);
    assert.ok(m.title && m.desc && m.hints.length && ['easy', 'medium', 'hard'].includes(m.level));
    assert.ok(m.start && [12, 14].includes(m.start.week) && m.start.mode);
  }
  assert.deepStrictEqual(g.missions.map((m) => m.level), ['easy', 'medium', 'medium', 'medium', 'hard']);
  // o1 does not publish the expected check type/port
  assert.ok(!JSON.stringify(g.missions[0].start).includes('443'));
});

it('generate returns only a seed (no answer) and only for o2/o3/a2', () => {
  let c = 0; const rand = () => ((c++ * 0.37) % 1);
  const p = g.generate('o2', rand);
  assert.deepStrictEqual(Object.keys(p).sort(), ['mission', 'seed', 'v']);
  assert.ok(/^[0-9a-f]{12}$/.test(p.seed));
  assert.strictEqual(g.generate('o1', rand), null);
  assert.strictEqual(g.generate('zz', rand), null);
});

it('fmtTime / parseTime round trip on the 08:00–09:00 simulated clock', () => {
  assert.strictEqual(N.fmtTime(0), '08:00:00');
  assert.strictEqual(N.fmtTime(1830), '08:30:30');
  assert.strictEqual(N.fmtTime(1830, true), '08:30');
  assert.strictEqual(N.parseTime('08:30'), 1800);
  assert.strictEqual(N.parseTime('8.30.30'), 1830);
  assert.strictEqual(N.parseTime('25:00'), null);
  assert.strictEqual(N.parseTime('abc'), null);
  assert.strictEqual(N.parseTime({}), null);
});

console.log('netops: simulation, poller, thresholds');

it('scenario + simulation are deterministic per seed', () => {
  const a = N.simulate(N.scenario('o2', 'abc123')), b = N.simulate(N.scenario('o2', 'abc123'));
  assert.deepStrictEqual(a.logs, b.logs);
  assert.deepStrictEqual(Array.from(a.inB['R1|Gi0/0']), Array.from(b.inB['R1|Gi0/0']));
  const c = N.simulate(N.scenario('o2', 'abc124'));
  assert.notDeepStrictEqual(a.logs.map((x) => x.msg), c.logs.map((x) => x.msg));
});

it('poller is deterministic and samples exactly at every poll interval', () => {
  const sim = N.simulate(N.scenario('o1', 'x'));
  const m = N.validateMonitor({ type: 'icmp', target: 'R1', interval: 45, latWarn: 50, lossWarn: 20 }).monitor;
  const p1 = N.poll(sim, m), p2 = N.poll(sim, m);
  assert.deepStrictEqual(p1, p2);
  assert.strictEqual(p1.length, Math.floor((N.DURATION - 1) / 45) + 1);
  assert.ok(p1.every((x, i) => x.t === i * 45));
  assert.strictEqual(N.poll(sim, m, 600).length, Math.floor(600 / 45) + 1);
});

it('all o2 outage kinds appear across seeds', () => {
  const kinds = new Set();
  for (let i = 0; i < 40; i++) kinds.add(KEY(N.scenario('o2', seedN(i))).cause);
  assert.deepStrictEqual([...kinds].sort(), ['bad_cable', 'device_down', 'flapping', 'service_down']);
});

it('threshold evaluation: ICMP down / warn on loss / warn on latency / up', () => {
  const m = { type: 'icmp', latWarn: 50, lossWarn: 20 };
  assert.strictEqual(N.evaluate(m, { loss: 100, lat: null }), 'down');
  assert.strictEqual(N.evaluate(m, { loss: 20, lat: 1 }), 'warn');
  assert.strictEqual(N.evaluate(m, { loss: 0, lat: 50 }), 'warn');
  assert.strictEqual(N.evaluate(m, { loss: 0, lat: 49.9 }), 'up');
});

it('threshold evaluation: TCP refused = down, slow = warn; SNMP oper down / util / errors', () => {
  assert.strictEqual(N.evaluate({ type: 'tcp', latWarn: 100 }, { open: false }), 'down');
  assert.strictEqual(N.evaluate({ type: 'tcp', latWarn: 100 }, { open: true, lat: 1001 }), 'warn');
  assert.strictEqual(N.evaluate({ type: 'tcp', latWarn: 100 }, { open: true, lat: 2 }), 'up');
  const s = { type: 'snmp', utilWarn: 80 };
  assert.strictEqual(N.evaluate(s, { reach: false }), 'down');
  assert.strictEqual(N.evaluate(s, { reach: true, oper: 0, util: 0, errDelta: 0 }), 'down');
  assert.strictEqual(N.evaluate(s, { reach: true, oper: 1, util: 80, errDelta: 0 }), 'warn');
  assert.strictEqual(N.evaluate(s, { reach: true, oper: 1, util: 10, errDelta: 3 }), 'warn');
  assert.strictEqual(N.evaluate(s, { reach: true, oper: 1, util: 10, errDelta: 0 }), 'up');
});

it('validateMonitor rejects bad monitors with Thai messages and sanitises names', () => {
  const bad = [{ type: 'x', target: 'R1' }, { type: 'icmp', target: 'NOPE', interval: 30 }, { type: 'tcp', target: 'SRV-WEB', port: 70000, interval: 30, latWarn: 10 },
    { type: 'snmp', target: 'R1', iface: 'Gi9/9', interval: 60, utilWarn: 80 }, { type: 'icmp', target: 'R1', interval: 2, latWarn: 10, lossWarn: 10 },
    { type: 'icmp', target: 'R1', interval: 30, latWarn: '', lossWarn: 10 }, { type: 'snmp', target: 'R1', iface: 'Gi0/0', interval: 60, utilWarn: 150 }, null, { type: 'icmp', target: '__proto__', interval: 30 }];
  for (const b of bad) { const v = N.validateMonitor(b); assert.strictEqual(v.ok, false, JSON.stringify(b)); assert.ok(/[\u0E00-\u0E7F]/.test(v.error)); }
  const v = N.validateMonitor({ type: 'tcp', target: 'SRV-WEB', port: '443', interval: '60', latWarn: '200', name: 'web\nhttps' });
  assert.ok(v.ok); assert.strictEqual(v.monitor.port, 443); assert.strictEqual(v.monitor.name, 'web https');
});

it('device down: ping monitor is Down exactly during the outage and the neighbour logs the link loss', () => {
  for (let i = 0; i < 40; i++) {
    const S = N.scenario('o2', seedN(i)); if (KEY(S).cause !== 'device_down') continue;
    const inc = S.incidents[0], sim = N.simulate(S);
    const m = N.validateMonitor({ type: 'icmp', target: inc.dev, interval: 10, latWarn: 100, lossWarn: 30 }).monitor;
    for (const x of N.poll(sim, m)) {
      const inside = x.t >= inc.t0 && x.t < inc.t1;
      assert.strictEqual(x.status === 'down', inside, `t=${x.t} ${inc.dev}`);
    }
    const relIds = REL(S, sim), rel = sim.logs.filter((x) => relIds.has(x.id));
    assert.ok(rel.some((x) => x.t === inc.t0 && /changed state to down/.test(x.msg)));
    // a dead device logs nothing while it is down
    assert.ok(!sim.logs.some((x) => x.dev === inc.dev && x.t >= inc.t0 && x.t < inc.t1));
    return;
  }
  throw new Error('no device_down seed found');
});

it('syslog lines match interface status (LINK-3-UPDOWN down/up agrees with oper state) for 30 scenarios', () => {
  let checked = 0;
  for (let i = 0; i < 30; i++) {
    const sim = N.simulate(N.scenario(i % 3 === 0 ? 'o3' : 'o2', seedN(i)));
    for (const x of sim.logs) {
      if (x.fac !== 'LINK-3-UPDOWN') continue;
      const m = /Interface GigabitEthernet(\S+), changed state to (up|down)/.exec(x.msg);
      const s = N.stepOf(x.t);
      assert.strictEqual(N.ifaceOper(sim, x.dev, 'Gi' + m[1], s), m[2] === 'up' ? 1 : 0, `${x.dev} ${x.msg} @${x.t}`);
      checked++;
    }
  }
  assert.ok(checked > 100);
});

it('service down: ping stays Up while the TCP check is Down, and the server logs the crash', () => {
  for (let i = 0; i < 60; i++) {
    const S = N.scenario('o2', seedN(i)); if (KEY(S).cause !== 'service_down') continue;
    const inc = S.incidents[0], sim = N.simulate(S);
    const ping = N.poll(sim, N.validateMonitor({ type: 'icmp', target: inc.dev, interval: 30, latWarn: 100, lossWarn: 30 }).monitor);
    const tcp = N.poll(sim, N.validateMonitor({ type: 'tcp', target: inc.dev, port: inc.ports[0], interval: 30, latWarn: 2000 }).monitor);
    assert.ok(ping.every((x) => x.status === 'up'));
    tcp.forEach((x) => assert.strictEqual(x.status === 'down', x.t >= inc.t0 && x.t < inc.t1));
    assert.ok(sim.logs.some((x) => REL(S, sim).has(x.id) && x.dev === inc.dev && /Killed process/.test(x.msg)));
    return;
  }
  throw new Error('no service_down seed found');
});

it('flapping: several separate down periods, each with matching log lines', () => {
  for (let i = 0; i < 60; i++) {
    const S = N.scenario('o2', seedN(i)); if (KEY(S).cause !== 'flapping') continue;
    const inc = S.incidents[0], sim = N.simulate(S);
    const rel = REL(S, sim), downs = sim.logs.filter((x) => rel.has(x.id) && x.fac === 'LINK-3-UPDOWN' && /down$/.test(x.msg));
    assert.ok(downs.length >= inc.downs.length);
    assert.ok(inc.downs.length >= 6);
    const ping = N.poll(sim, N.validateMonitor({ type: 'icmp', target: inc.dev, interval: 10, latWarn: 100, lossWarn: 30 }).monitor);
    let runs = 0; ping.forEach((x, k) => { if (x.status === 'down' && (k === 0 || ping[k - 1].status !== 'down')) runs++; });
    assert.ok(runs >= 4, 'runs ' + runs);
    return;
  }
  throw new Error('no flapping seed found');
});

it('bad cable: input errors grow only on that link and the SNMP monitor turns Warning', () => {
  for (let i = 0; i < 60; i++) {
    const S = N.scenario('o2', seedN(i)); if (KEY(S).cause !== 'bad_cable') continue;
    const inc = S.incidents[0], sim = N.simulate(S), [dev] = KEY(S).devs;
    const l = N.network().links[inc.link];
    const before = N.ifaceRows(sim, dev, inc.t0 - 20).find((r) => r.name === l.ib).inErr;
    const after = N.ifaceRows(sim, dev, inc.t0 + 600).find((r) => r.name === l.ib).inErr;
    assert.strictEqual(before, 0); assert.ok(after > 100);
    assert.ok(N.ifaceRows(sim, 'R1', 3000).every((r) => r.inErr === 0));
    const sn = N.poll(sim, N.validateMonitor({ type: 'snmp', target: l.a, iface: l.ia, interval: 60, utilWarn: 90 }).monitor);
    assert.ok(sn.filter((x) => x.t > inc.t0 + 200).every((x) => x.status !== 'up'));
    return;
  }
  throw new Error('no bad_cable seed found');
});

it('top talker: the bottleneck interface is near 100% in the window and the talker port is the busiest edge port', () => {
  const variants = new Set();
  for (let i = 0; i < 12; i++) {
    const S = N.scenario('o3', seedN(i)), sim = N.simulate(S), k = KEY(S);
    variants.add(k.bottleneck[0][0] === 'R1' ? 'wan' : 'uplink');
    const t = Math.floor((k.t0 + k.t1) / 2);
    const row = N.ifaceRows(sim, k.bottleneck[0][0], t).find((r) => r.name === k.bottleneck[0][1]);
    assert.ok(row.util > 90, 'util ' + row.util);
    const edges = N.ifaceRows(sim, k.talker[0][0], t).filter((r) => r.name !== 'Gi0/24');
    const top = edges.reduce((a, b) => (Math.max(b.inBps, b.outBps) > Math.max(a.inBps, a.outBps) ? b : a));
    assert.strictEqual(top.name, k.talker[0][1]);
    const before = N.ifaceRows(sim, k.bottleneck[0][0], k.t0 - 120).find((r) => r.name === k.bottleneck[0][1]);
    assert.ok(before.util < 70, 'before ' + before.util);
  }
  assert.strictEqual(variants.size, 2);
});

it('syslog ids are sequential in time order and the filters work', () => {
  const sim = N.simulate(N.scenario('o2', seedN(3)));
  sim.logs.forEach((x, i) => { assert.strictEqual(x.id, i + 1); if (i) assert.ok(x.t >= sim.logs[i - 1].t); });
  const f = N.filterLogs(sim, { dev: 'R1', sev: 5, from: 600, to: 2400 });
  assert.ok(f.every((x) => x.dev === 'R1' && x.sev <= 5 && x.t >= 600 && x.t <= 2400));
  assert.ok(N.filterLogs(sim, { until: 300 }).every((x) => x.t <= 300));
  assert.ok(N.filterLogs(sim, { text: 'toner' }).length >= 1);
  assert.ok(/^08:\d\d:\d\d \S+ /.test(N.logLine(sim.logs[0])));
});

console.log('netops: template engine');

it('variables, filters and globals', () => {
  const r = N.tpl.render('hostname {{ hostname }} {{ role | upper }} {{ x | default("none") }} {{ vlans | join(";") }} {{ vlans | length }} {{ name | replace("-", "_") | lower }}',
    { hostname: 'ACC-SW1', role: 'access', vlans: [10, 20], name: 'A-B' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(r.text, 'hostname ACC-SW1 ACCESS none 10;20 2 a_b');
  const v = N.varsFor({ hostname: 'h', mgmt_ip: '1.2.3.4', vlans: [10] });
  assert.strictEqual(N.tpl.render('{{ gateway }} {{ mgmt_mask }}', v).text, '10.10.99.1 255.255.255.0');
});

it('for loops (loop.index, loop.last, nested) and block lines are removed cleanly', () => {
  const r = N.tpl.render('{% for v in vlans %}\nvlan {{ v }}{% if not loop.last %},{% endif %} #{{ loop.index }}\n{% for p in ports %}\n  {{ v }}-{{ p }}\n{% endfor %}\n{% endfor %}\nend', { vlans: [10, 20], ports: ['a', 'b'] });
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(r.text, 'vlan 10, #1\n  10-a\n  10-b\nvlan 20 #2\n  20-a\n  20-b\nend');
});

it('conditionals: if/elif/else, ==, !=, in, not in, and/or, numeric vs string compare', () => {
  const T = '{% if role == "access" and 99 in vlans %}A{% elif role != "core" or x %}B{% else %}C{% endif %}{% if 30 not in vlans %}-no30{% endif %}{% if "10" == 10 %}-eq{% endif %}{% if n > 9 %}-big{% endif %}';
  assert.strictEqual(N.tpl.render(T, { role: 'access', vlans: [10, 99], x: 0, n: '10' }).text, 'A-no30-eq-big');
  assert.strictEqual(N.tpl.render(T, { role: 'dist', vlans: [10], x: 0, n: 2 }).text, 'B-no30-eq');
  assert.strictEqual(N.tpl.render(T, { role: 'core', vlans: [30], x: '', n: 2 }).text, 'C-eq');
});

it('escaping: values cannot inject extra config lines or control characters; raw blocks stay literal', () => {
  const r = N.tpl.render('description {{ d }}\nhostname X', { d: 'Lab\nno vlan 99\r\nshutdown\u0007' });
  assert.strictEqual(r.text, 'description Lab no vlan 99 shutdown\nhostname X');
  const st = N.dev.apply(N.dev.blank('ACC-SW1'), 'interface Gi0/1\n' + r.text).state;
  assert.strictEqual(st.vlans[1], 'default'); assert.strictEqual(st.ifaces['Gi0/1'].shutdown, false);
  assert.strictEqual(N.tpl.render('{% raw %}{{ hostname }} {% for %}{% endraw %}', {}).text, '{{ hostname }} {% for %}');
  assert.strictEqual(N.tpl.render('{{ s }}', { s: '<b>&"' }).text, '<b>&"');   // config text is not HTML; the UI shows it with textContent
});

it('error messages are Thai and carry the right line number', () => {
  const cases = [
    ['a\n{% for v in vlans %}\nx', 2, /ไม่ได้ปิด \{% for %\}/],
    ['a\nb\n{{ hostnme }}', 3, /ไม่พบตัวแปร "hostnme"/],
    ['{% endfor %}', 1, /โดยไม่มีคำสั่งเปิด/],
    ['x\n{% loop v %}', 2, /ไม่รู้จักคำสั่ง/],
    ['{{ hostname', 1, /ไม่มี \}\} ปิด/],
    ['{{ hostname | shout }}', 1, /ไม่รู้จัก filter "shout"/],
    ['{% if %}x{% endif %}', 1, /นิพจน์ว่างเปล่า/],
    ['{% for v vlans %}{% endfor %}', 1, /รูปแบบ for ไม่ถูกต้อง/],
    ['{{ }}', 1, /ว่างเปล่า/],
    ['{{ a + b }}', 1, /ใช้ตัวอักษร "\+"/],
    ['{% if x %}a{% else %}b{% elif y %}c{% endif %}', 1, /หลัง \{% else %\}/]
  ];
  for (const [src, line, re] of cases) {
    const r = N.tpl.render(src, { hostname: 'h', vlans: [1], x: 1, y: 1 });
    assert.strictEqual(r.ok, false, src); assert.strictEqual(r.error.line, line, src + ' -> ' + JSON.stringify(r.error)); assert.ok(re.test(r.error.msg), src + ' -> ' + r.error.msg);
  }
});

it('no code execution: no function calls, no prototype access, no globals', () => {
  const evil = ['{{ constructor.constructor("return process")() }}', '{{ __proto__ }}', '{{ hostname.constructor }}', '{{ process.exit }}', '{% for x in __proto__ %}{% endfor %}',
    '{{ hostname.toString }}', '{{ this }}', '{{ globalThis }}', '{{ require }}', '{% for constructor in vlans %}{% endfor %}', '{{ hostname["constructor"] }}', '{{ `x` }}'];
  for (const e of evil) { const r = N.tpl.render(e, { hostname: 'h', vlans: [1] }); assert.strictEqual(r.ok, false, e); }
  N.tpl.render('{{ hostname }}', JSON.parse('{"__proto__":{"polluted":1},"hostname":"x"}'));
  assert.strictEqual({}.polluted, undefined);
  assert.strictEqual(N.tpl.render('{{ toString }}', {}).ok, false);
  assert.ok(!/\beval\s*\(|new Function|\bFunction\s*\(/.test(require('fs').readFileSync(require.resolve('../../public/js/sim/netops.js'), 'utf8')));
});

it('size, iteration and depth limits stop runaway templates with a Thai error', () => {
  assert.ok(/ยาวเกิน/.test(N.tpl.render('x'.repeat(8001), {}).error.msg));
  const big = Array.from({ length: 40 }, (_, i) => i);
  assert.ok(/วนลูปรวมเกิน/.test(N.tpl.render('{% for a in l %}{% for b in l %}{{ a }}{% endfor %}{% endfor %}', { l: big }).error.msg));
  const long = Array.from({ length: 500 }, (_, i) => 'x'.repeat(30) + i);
  assert.ok(/ผลลัพธ์ของ template ยาวเกิน/.test(N.tpl.render('{% for a in l %}{{ a }}{{ a }}{% endfor %}', { l: long }).error.msg));
  const deep = '{% if 1 %}'.repeat(7) + 'x' + '{% endif %}'.repeat(7);
  assert.ok(/ลึกเกิน/.test(N.tpl.render(deep, {}).error.msg));
  assert.strictEqual(N.tpl.render('{% if 1 %}'.repeat(6) + 'x' + '{% endif %}'.repeat(6), {}).text, 'x');
});

console.log('netops: inventory, device config, push');

it('inventory CSV: vlans list, quoted cells, ; lists, errors with line numbers', () => {
  const inv = N.parseInventory('# comment\nhostname,mgmt_ip,role,vlans,descr,ports\nACC-SW1,10.10.99.11,access,10;20;99,"Lab 1, floor 2",Gi0/3;Gi0/4\n\nACC-SW2,10.10.99.12,access,10 20,x,y');
  assert.ok(inv.ok, JSON.stringify(inv.errors));
  assert.deepStrictEqual(inv.rows[0].vlans, [10, 20, 99]); assert.strictEqual(inv.rows[0].vlan_list, '10,20,99');
  assert.strictEqual(inv.rows[0].descr, 'Lab 1, floor 2'); assert.deepStrictEqual(inv.rows[0].ports, ['Gi0/3', 'Gi0/4']);
  assert.deepStrictEqual(inv.rows[1].vlans, [10, 20]);
  const bad = N.parseInventory('hostname,role\nA,x');
  assert.ok(bad.errors.some((e) => e.line === 1 && /mgmt_ip/.test(e.msg)));
  const bad2 = N.parseInventory('hostname,mgmt_ip,vlans\nA,10.0.0.1,10\nB,10.0.0.2\nA,10.0.0.3,10;5000\nC,999,10');
  assert.deepStrictEqual(bad2.errors.map((e) => e.line), [3, 4, 4, 5]);
  assert.ok(/ซ้ำ/.test(bad2.errors[2].msg) && /5000/.test(bad2.errors[1].msg));
  assert.ok(N.parseInventory('x'.repeat(4001)).errors[0].msg.includes('ยาวเกิน'));
  assert.ok(N.parseInventory('hostname,mgmt_ip,__proto__\na,1.1.1.1,x').errors.length >= 1);
});

it('device config: apply builds state, rejects unknown commands with line numbers, show commands render', () => {
  const a = N.dev.apply(N.dev.blank('ACC-SW1'), 'hostname LAB1\nvlan 10\n name STUDENT\ninterface gi0/24\n switchport mode trunk\n switchport trunk allowed vlan 10,99\n switchport trunk allowed vlan add 20\ninterface vlan 99\n ip address 10.10.99.11 255.255.255.0\nflibble\ninterface Gi0/1\n ip address 1.1.1.1 255.255.255.0\ninterface Gi7/7');
  assert.strictEqual(a.state.hostname, 'LAB1');
  assert.deepStrictEqual(a.state.ifaces['Gi0/24'].allowed, [10, 20, 99]);
  assert.deepStrictEqual(a.errors.map((e) => e.line), [10, 12, 13]);
  const run = N.dev.show(a.state, 'run');
  assert.ok(/switchport trunk allowed vlan 10,20,99/.test(run) && /ip address 10.10.99.11 255.255.255.0/.test(run));
  assert.ok(/^10\s+STUDENT/m.test(N.dev.show(a.state, 'vlan')));
  assert.ok(/Vlan99\s+10.10.99.11/.test(N.dev.show(a.state, 'ipint')));
  assert.strictEqual(N.dev.reachable(a.state, '10.10.99.11'), false);   // vlan 99 not created yet
  N.dev.apply(a.state, 'vlan 99');
  assert.strictEqual(N.dev.reachable(a.state, '10.10.99.11'), true);
  N.dev.apply(a.state, 'interface Gi0/24\n switchport trunk allowed vlan remove 99');
  assert.strictEqual(N.dev.reachable(a.state, '10.10.99.11'), false);
});

it('push (a1) renders per device and applies to fresh simulated switches', () => {
  const r = N.push(A1_INV, A1_TPL);
  assert.strictEqual(r.devices.length, 5); assert.deepStrictEqual(r.missing, []);
  r.devices.forEach((d, i) => { assert.ok(d.ok, JSON.stringify(d.errors)); assert.ok(N.dev.reachable(d.state, '10.10.99.' + (11 + i))); assert.strictEqual(d.state.vlans[20], 'TEACHER'); });
  const r2 = N.push(A1_INV + '\nSW-X,10.0.0.9,access,10', A1_TPL);
  assert.ok(r2.errors.some((e) => /ไม่พบอุปกรณ์ "SW-X"/.test(e.msg)));
});

console.log('netops: playbook');

it('playbook: good devices get the change, the failing device is rolled back (both fault types)', () => {
  for (const type of ['mgmt_lost', 'cmd_reject']) {
    const setup = N.a2Setup('s', { dev: 'ACC-SW3', type });
    const rep = N.runPlaybook(setup, PB_OK);
    for (const d of rep.devices) {
      if (d.id === 'ACC-SW3') { assert.strictEqual(d.status, 'rolled_back', type); assert.ok(d.sameAsOriginal && d.reachable && d.startupOriginal); assert.strictEqual(d.tasks[5].result, 'changed'); }
      else { assert.strictEqual(d.status, 'ok'); assert.ok(d.hasChange && d.reachable && d.startupSaved); assert.strictEqual(d.tasks[5].result, 'skipped'); }
    }
  }
});

it('playbook mistakes: no backup / no verify / rollback always / any_errors_fatal / save before verify', () => {
  const setup = N.a2Setup('s', { dev: 'ACC-SW1', type: 'mgmt_lost' });
  const noBackup = N.runPlaybook(setup, { tasks: [{ action: 'apply' }, { action: 'verify_ping' }, { action: 'rollback', when: 'failure' }] });
  assert.strictEqual(noBackup.devices[0].status, 'failed'); assert.ok(/ไม่มี backup/.test(noBackup.devices[0].tasks[2].msg));
  const noVerify = N.runPlaybook(setup, { tasks: [{ action: 'backup' }, { action: 'apply' }, { action: 'rollback', when: 'failure' }] });
  assert.strictEqual(noVerify.devices[0].status, 'ok'); assert.strictEqual(noVerify.devices[0].reachable, false);   // "ok" but the switch is lost
  const always = N.runPlaybook(setup, { tasks: [{ action: 'backup' }, { action: 'apply' }, { action: 'verify_ping' }, { action: 'rollback', when: 'always' }] });
  assert.ok(always.devices.slice(1).every((d) => !d.hasChange));
  const fatal = N.runPlaybook(setup, { tasks: [{ action: 'apply' }, { action: 'verify_ping' }], anyErrorsFatal: true });
  assert.strictEqual(fatal.stopped, true); assert.ok(fatal.devices.slice(1).every((d) => d.status === 'skipped'));
  const saveFirst = N.runPlaybook(setup, { tasks: [{ action: 'backup' }, { action: 'apply' }, { action: 'save' }, { action: 'verify_ping' }, { action: 'rollback', when: 'failure' }] });
  assert.strictEqual(saveFirst.devices[0].status, 'rolled_back'); assert.strictEqual(saveFirst.devices[0].startupOriginal, false);
  assert.strictEqual(N.runPlaybook(setup, { tasks: [{ action: 'rm -rf' }] }).ok, false);
  assert.strictEqual(N.runPlaybook(setup, { tasks: new Array(16).fill({ action: 'backup' }) }).ok, false);
});

console.log('netops: graders');

it('o1 perfect monitor set = 10/10 (extra monitors are fine)', () => {
  const r = g.grade('o1', { monitors: MON_OK.concat([{ type: 'icmp', target: 'PRN-1', interval: 60, latWarn: 100, lossWarn: 20 }]) });
  assert.strictEqual(r.score, 10, r.feedback.join('\n')); assert.strictEqual(r.ok, true);
});

it('o1 typical mistakes give partial credit with Thai feedback', () => {
  const m = MON_OK.map((x) => Object.assign({}, x));
  m[1] = { type: 'icmp', target: 'SRV-WEB', interval: 60, latWarn: 50, lossWarn: 20 };   // ping instead of TCP 443
  m[2].port = 139;                                                                    // NetBIOS instead of SMB 445
  m[3].interval = 5;                                                                  // too frequent
  m[5].utilWarn = 99;                                                                 // warns only when the link is already full
  const r = g.grade('o1', { monitors: m });
  assert.ok(r.score > 0 && r.score < 10, r.score);
  assert.ok(fbHas(r, /ใช้ ping อย่างเดียวไม่พอ/)); assert.ok(fbHas(r, /139/)); assert.ok(fbHas(r, /poll interval 5/)); assert.ok(fbHas(r, /utilization 99%/));
  const r2 = g.grade('o1', { monitors: MON_OK.slice(0, 3) });
  assert.strictEqual(r2.score, 5); assert.ok(fbHas(r2, /ยังไม่ได้ monitor/));
});

it('o1 empty / invalid / oversized payloads = 0 with Thai message', () => {
  for (const p of [null, {}, { monitors: [] }, { monitors: 'x' }, { monitors: [{ type: 'bad' }] }, { monitors: new Array(41).fill(MON_OK[0]) }, { monitors: [{ x: 'y'.repeat(70000) }] }, [1, 2]]) {
    const r = g.grade('o1', p);
    assert.strictEqual(r.score, 0, JSON.stringify(p).slice(0, 60)); assert.ok(/[\u0E00-\u0E7F]/.test(r.feedback[0]));
  }
});

it('o2 perfect analysis = 10/10 for every outage kind', () => {
  const kinds = new Set();
  for (let i = 0; i < 24; i++) {
    const p = prob('o2', i); const a = o2Answer(p.seed);
    kinds.add(a.cause);
    const r = g.grade('o2', { answer: a }, p);
    assert.strictEqual(r.score, 10, p.seed + ' ' + r.feedback.join(' | '));
  }
  assert.strictEqual(kinds.size, 4);
});

it('o2 typical mistakes: wrong cause, neighbour switch blamed, late time, noise evidence', () => {
  for (let i = 0; i < 60; i++) {
    const p = prob('o2', i); const S = N.scenario('o2', p.seed);
    if (KEY(S).cause !== 'device_down' || /^AP/.test(KEY(S).devs[0])) continue;
    const a = o2Answer(p.seed), sim = N.simulate(S);
    const rel = REL(S, sim), noise = sim.logs.filter((x) => !rel.has(x.id)).slice(0, 4).map((x) => x.id);
    const r = g.grade('o2', { answer: Object.assign({}, a, { cause: 'flapping', device: 'CORE-SW1', time: N.fmtTime(KEY(S).t0 + 900, true), evidence: noise }) }, p);
    assert.strictEqual(r.score, 0);
    assert.ok(fbHas(r, /สาเหตุยังไม่ถูก: ถ้าเป็น flapping/) && fbHas(r, /อาจเป็นแค่ฝั่งที่ "เห็น" ปัญหา/) && fbHas(r, /ไม่ใช่หลักฐาน/), r.feedback.join('|'));
    assert.ok(!fbHas(r, /อุปกรณ์ดับทั้งตัว/), 'the real cause is not described');
    const half = g.grade('o2', { answer: Object.assign({}, a, { evidence: a.evidence.slice(0, 2).concat(noise) }) }, p);
    assert.strictEqual(half.score, 9); assert.ok(fbHas(half, /ไม่เกี่ยวข้องมากเกินไป/));
    const one = g.grade('o2', { answer: Object.assign({}, a, { evidence: a.evidence.slice(0, 1) }) }, p);
    assert.strictEqual(one.score, 9); assert.ok(fbHas(one, /หลักฐานยังน้อยไป/));
    return;
  }
  throw new Error('no switch device_down seed found');
});

it('o2/o3/a2 forged or mismatched problems and oversized payloads score 0', () => {
  const a = o2Answer(seedN(1));
  for (const bad of [null, {}, { v: 1, mission: 'o3', seed: seedN(1) }, { v: 1, mission: 'o2', seed: 'zz' }, { v: 2, mission: 'o2', seed: seedN(1) }, { v: 1, mission: 'o2', seed: { x: 1 } }]) {
    const r = g.grade('o2', { answer: a }, bad); assert.strictEqual(r.score, 0); assert.ok(/โจทย์/.test(r.feedback[0]));
  }
  assert.strictEqual(g.grade('o3', { answer: {} }, prob('o2', 1)).score, 0);
  assert.strictEqual(g.grade('a2', { playbook: PB_OK }, prob('o2', 1)).score, 0);
  const big = g.grade('o2', { answer: a, junk: 'x'.repeat(61000) }, prob('o2', 1));
  assert.strictEqual(big.score, 0); assert.ok(/ใหญ่เกินไป/.test(big.feedback[0]));
});

it('o3 perfect answer = 10/10 for both variants; the other end of the bottleneck link is accepted', () => {
  let other = 0;
  for (let i = 0; i < 10; i++) {
    const p = prob('o3', i), a = o3Answer(p.seed);
    const r = g.grade('o3', { answer: a }, p);
    assert.strictEqual(r.score, 10, p.seed + ' ' + r.feedback.join(' | '));
    const k = ANS.answerFor('o3', p.seed);
    if (k.bottleneck.length > 1) {
      other++;
      const a2 = Object.assign({}, a, { bottleneck: { dev: k.bottleneck[1][0], iface: k.bottleneck[1][1] } });
      assert.strictEqual(g.grade('o3', { answer: a2 }, p).score, 10);
    }
  }
  assert.ok(other > 0);
});

it('o3 typical mistakes: talker port given as bottleneck, wrong time, wrong utilisation', () => {
  const p = prob('o3', 2), a = o3Answer(p.seed);
  const r = g.grade('o3', { answer: Object.assign({}, a, { bottleneck: a.talker }) }, p);
  assert.strictEqual(r.score, 6); assert.ok(fbHas(r, /เป็นพอร์ตที่ต่อกับเครื่องผู้ใช้/) && !fbHas(r, /คือพอร์ตของเครื่องต้นเหตุ/), r.feedback.join('|'));
  const k = ANS.answerFor('o3', p.seed);
  const r2 = g.grade('o3', { answer: Object.assign({}, a, { time: N.fmtTime(Math.max(0, k.t0 - 400), true) }) }, p);
  assert.strictEqual(r2.score, 7); assert.ok(fbHas(r2, /ไม่อยู่ในช่วง/));
  const r3 = g.grade('o3', { answer: Object.assign({}, a, { util: 12 }) }, p);
  assert.strictEqual(r3.score, 9); assert.ok(fbHas(r3, /ไม่ตรงกับที่/));
  assert.strictEqual(g.grade('o3', { answer: 'x' }, p).score, 0);
});

/* ---------------- Phase 6: no answer key in the browser engine, no answer in wrong-submit feedback, log accuracy */
it('leak: the browser engine builds no answer object (scenario.answer, log.inc, sim.scn) for o1/o2/o3', () => {
  for (let i = 0; i < 30; i++) for (const m of ['o1', 'o2', 'o3']) {
    const S = N.scenario(m, seedN(i)), sim = N.simulate(S);
    assert.ok(!('answer' in S), m + ': scenario.answer');
    assert.ok(!('scn' in sim), m + ': sim.scn');
    assert.ok(sim.logs.every((x) => !('inc' in x)), m + ': log.inc marks the evidence lines');
  }
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../public/js/sim/netops.js'), 'utf8');
  assert.ok(!/S\.answer\s*=|\binc:\s*inc|bottleneck:\s*\[|talker:\s*\[\[/.test(src), 'no answer bookkeeping in public/js/sim/netops.js');
  assert.ok(!require('fs').existsSync(require('path').join(__dirname, '../../public/js/sim/netops-answers.js')));
});
it('leak: o2 wrong / empty / fabricated submits do not describe the real cause or name the real device', () => {
  const kinds = new Set();
  for (let i = 0; i < 60; i++) {
    const p = prob('o2', i), k = ANS.answerFor('o2', p.seed); kinds.add(k.cause);
    const realWhy = { device_down: /อุปกรณ์ดับทั้งตัว/, flapping: /ถ้าเป็น flapping/, service_down: /ถ้าเป็น service down/, bad_cable: /ถ้าเป็นสายเสีย/ }[k.cause];
    const subs = [{ answer: {} }, { answer: { cause: 'zzz', device: 'R1', time: '23:59', evidence: [1, 2, 3] } }]
      .concat(['device_down', 'flapping', 'service_down', 'bad_cable'].filter((c) => c !== k.cause).map((c) => ({ answer: { cause: c, device: 'R1', time: '08:00', evidence: [1] } })));
    subs.forEach((pl) => {
      const r = g.grade('o2', pl, p), js = JSON.stringify(r);
      assert.ok(!r.feedback.some((f) => realWhy.test(f)), p.seed + ' ' + k.cause + ': ' + r.feedback.join('|'));
      k.devs.forEach((d) => assert.ok(d === 'R1' || !js.includes(d), p.seed + ': names ' + d));
      assert.ok(!js.replace('เช่น 08:25', '').includes(N.fmtTime(k.t0, true)) || pl.answer.time === N.fmtTime(k.t0, true), 'reveals the start time');
    });
    assert.strictEqual(g.grade('o2', { answer: o2Answer(p.seed) }, p).score, 10);
  }
  assert.strictEqual(kinds.size, 4);
});
it('leak: o3 wrong picks do not name the real bottleneck or talker', () => {
  for (let i = 0; i < 16; i++) {
    const p = prob('o3', i), k = ANS.answerFor('o3', p.seed), a = o3Answer(p.seed);
    const wrongB = k.bottleneck[0][0] === 'R1' ? { dev: 'ACC-SW2', iface: 'Gi0/24' } : { dev: 'R1', iface: 'Gi0/0' };
    const subs = [{ bottleneck: a.talker, talker: a.bottleneck, time: a.time, util: 3 }, { bottleneck: wrongB, talker: { dev: 'ACC-SW2', iface: 'Gi0/1' }, time: a.time, util: 1 }];
    subs.forEach((ans) => {
      const r = g.grade('o3', { answer: ans }, p);
      r.feedback.forEach((f) => {
        k.bottleneck.forEach(([d, x]) => assert.ok(!f.includes(d + ' ' + x) || (ans.bottleneck.dev === d && ans.bottleneck.iface === x) || (ans.talker.dev === d && ans.talker.iface === x), p.seed + ' names bottleneck: ' + f));
        assert.ok(!/คือพอร์ตของเครื่องต้นเหตุ/.test(f));
      });
    });
    assert.strictEqual(g.grade('o3', { answer: a }, p).score, 10);
  }
});
it('accuracy: o1 explains that DNS normally uses UDP 53 (TCP check = simplification); realistic syslog lines only', () => {
  const o1 = g.missions.find((m) => m.id === 'o1');
  assert.ok(o1.hints.some((h) => /UDP พอร์ต 53/.test(h) && /DNS query/.test(h) && /แบบง่าย/.test(h)));
  assert.ok(o1.start.rules.some((h) => /UDP 53/.test(h)));
  let boots = 0, leases = 0;
  for (let i = 0; i < 80; i++) {
    const S = N.scenario('o2', seedN(i)), sim = N.simulate(S);
    assert.ok(!sim.logs.some((x) => /DHCPD-6-ADDRESS_ASSIGN|SYS-4-POWER|Power supply restored/.test(x.fac + ' ' + x.msg)));
    sim.logs.forEach((x) => {
      if (x.fac === 'SYS-6-LOGGINGHOST_STARTSTOP') { boots++; assert.strictEqual(x.msg, 'Logging to host 10.10.20.50 port 514 started - reconnection'); }
      if (/^dhcpd\[/.test(x.fac)) { leases++; assert.strictEqual(x.dev, 'SRV-DNS'); assert.ok(/^DHCPACK on 10\.10\.10\.\d+ to 3c:22:fb(:[0-9a-f]{2}){3} \(PC-\d+\) via 10\.10\.10\.1$/.test(x.msg), x.msg); }
    });
  }
  assert.ok(boots > 0 && leases > 0);
});

it('a1 perfect template + inventory = 10/10, and an equivalent template written differently also scores 10', () => {
  assert.strictEqual(g.grade('a1', { inventory: A1_INV, template: A1_TPL }).score, 10);
  const alt = [
    '{# same result, different text #}', 'hostname {{ inventory_hostname }}', 'ip default-gateway 10.10.99.1',
    'vlan 10', ' name student', 'vlan 20', ' name teacher', 'vlan 99', ' name mgmt',
    'interface Gi0/24', ' switchport mode trunk', ' description uplink to core-sw1', ' switchport trunk allowed vlan 1-4094',
    'interface vlan 99', ' ip address {{ mgmt_ip }} 255.255.255.0'
  ].join('\n');
  const inv = 'hostname,mgmt_ip\n' + [1, 2, 3, 4, 5].map((k) => `ACC-SW${k},10.10.99.${10 + k}`).join('\n');
  const r = g.grade('a1', { inventory: inv, template: alt });
  assert.strictEqual(r.score, 10, r.feedback.join('\n'));
});

it('a1 typical mistakes: missing gateway + wrong description, wrong IP, template error, missing rows', () => {
  const t = A1_TPL.replace('ip default-gateway {{ gateway }}', '').replace('Uplink to CORE-SW1', 'to core');
  const r = g.grade('a1', { inventory: A1_INV, template: t });
  assert.strictEqual(r.score, 8); assert.ok(fbHas(r, /default-gateway/) && fbHas(r, /description/));
  const r2 = g.grade('a1', { inventory: A1_INV.replace('10.10.99.13', '10.10.99.31'), template: A1_TPL });
  assert.strictEqual(r2.score, 9); assert.ok(fbHas(r2, /ACC-SW3: management IP เป็น 10.10.99.31/));
  const r3 = g.grade('a1', { inventory: A1_INV, template: A1_TPL.replace('{% endif %}', '') });
  assert.strictEqual(r3.score, 0); assert.ok(fbHas(r3, /ไม่ได้ปิด \{% if %\}/));
  const r4 = g.grade('a1', { inventory: A1_INV.split('\n').slice(0, 3).join('\n'), template: A1_TPL });
  assert.strictEqual(r4.score, 4); assert.ok(fbHas(r4, /ยังไม่มีอุปกรณ์: ACC-SW3, ACC-SW4, ACC-SW5/));
  assert.strictEqual(g.grade('a1', { inventory: 'x'.repeat(5000), template: A1_TPL }).score, 0);
  assert.strictEqual(g.grade('a1', { inventory: A1_INV }).score, 0);
});

it('a2 good playbook = 10/10 for many seeds (server executes it, incl. the hidden alternate fault)', () => {
  const fails = new Set();
  for (let i = 0; i < 12; i++) {
    const p = prob('a2', i); fails.add(N.a2Setup(p.seed).fail.type);
    const r = g.grade('a2', { playbook: PB_OK }, p);
    assert.strictEqual(r.score, 10, p.seed + ' ' + r.feedback.join(' | '));
  }
  assert.strictEqual(fails.size, 2);
  // also fine: verify the gateway, rescue verify after rollback, no save at all
  const pb = { tasks: [{ action: 'backup' }, { action: 'apply' }, { action: 'verify_ping', target: 'gateway' }, { action: 'rollback', when: 'failure' }, { action: 'verify_ping', when: 'always' }] };
  assert.strictEqual(g.grade('a2', { playbook: pb }, prob('a2', 3)).score, 10);
});

it('a2 typical mistakes give partial credit with Thai feedback', () => {
  let sawNoVerify = false;
  for (let i = 0; i < 12; i++) {
    const p = prob('a2', i), setup = N.a2Setup(p.seed);
    const noVerify = g.grade('a2', { playbook: { tasks: [{ action: 'backup' }, { action: 'apply' }, { action: 'rollback', when: 'failure' }] } }, p);
    assert.ok(noVerify.score < 10 && noVerify.score >= 6, String(noVerify.score)); assert.ok(fbHas(noVerify, /ไม่มีขั้น verify/));
    if (setup.fail.type === 'mgmt_lost') { sawNoVerify = true; assert.ok(fbHas(noVerify, /หลุดจาก management/)); }
  }
  assert.ok(sawNoVerify);
  const p = prob('a2', 1);
  const always = g.grade('a2', { playbook: { tasks: [{ action: 'backup' }, { action: 'apply' }, { action: 'verify_ping' }, { action: 'rollback', when: 'always' }] } }, p);
  assert.ok(always.score <= 4); assert.ok(fbHas(always, /when = failure/));
  const fatal = g.grade('a2', { playbook: Object.assign({}, PB_OK, { anyErrorsFatal: true, tasks: [{ action: 'apply' }, { action: 'verify_ping' }] }) }, p);
  assert.ok(fatal.score < 6); assert.ok(fbHas(fatal, /ต้อง backup ก่อน apply/));
  const saveFirst = g.grade('a2', { playbook: { tasks: [{ action: 'backup' }, { action: 'apply' }, { action: 'save' }, { action: 'verify_ping' }, { action: 'rollback', when: 'failure' }] } }, p);
  assert.ok(saveFirst.score >= 7 && saveFirst.score < 10); assert.ok(fbHas(saveFirst, /save ก่อน verify/));
  const empty = g.grade('a2', { playbook: { tasks: [] } }, p);
  assert.strictEqual(empty.score, 0);
  assert.strictEqual(g.grade('a2', { playbook: { tasks: [{ action: 'shell', cmd: 'reload' }] } }, p).score, 0);
});

it('grade never throws on garbage input and unknown missions', () => {
  const junk = [undefined, null, 0, 'x', [], {}, { answer: null }, { answer: { evidence: 'x', time: {} } }, { monitors: [null, 1, 'a'] }, { playbook: { tasks: 'x' } },
    { inventory: 1, template: {} }, { answer: { bottleneck: 'x', talker: [], time: 5, util: {} } }];
  for (const m of ['o1', 'o2', 'o3', 'a1', 'a2', 'zz']) for (const j of junk) {
    const r = g.grade(m, j, prob(m, 1));
    assert.strictEqual(typeof r.score, 'number'); assert.ok(r.score >= 0 && r.score <= 10); assert.ok(Array.isArray(r.feedback));
  }
  const cyc = {}; cyc.self = cyc;
  assert.strictEqual(g.grade('o1', cyc).score, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
