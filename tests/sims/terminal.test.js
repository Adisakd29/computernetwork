// Tests for the Network Terminal Simulator grader: node tests/sims/terminal.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const g = require('../../server/sims/terminal.js');
const NetSim = require(path.join(__dirname, '../../public/js/sim/netsim.js'));

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', (e && e.stack || String(e)).split('\n').slice(0, 6).join('\n      ')); }
}
const M = id => g.missions.find(m => m.id === id);
const net = id => NetSim.create(JSON.parse(JSON.stringify(M(id).start.topo)));
const fbHas = (r, re) => r.feedback.some(f => re.test(f));
// a command list that satisfies every mission's "appropriate command" bonus
const ALL_CMDS = ['ipconfig /all', 'arp -a', 'ping 10.10.1.1', 'ip a', 'ip route', 'cat /etc/resolv.conf', 'nslookup x', 'tracert 8.8.8.8',
  'netstat -an', 'ip link set eth0 up', 'traceroute 192.168.1.10'];
// m9+ grade from the replayed command log (evidence); these logs are what a student who solved them would have run
const LW = (h, ...cs) => cs.map(c => ({ h, c }));
// 4.0 missions (m12+): state graded after replaying these real command sequences with NL_SYS
const SOL = {
  m12: LW('lab07', 'net share', 'icacls C:\\Share\\Homework', 'net share Homework=C:\\Share\\Homework /grant:Students,CHANGE', 'net share Homework'),
  m13: LW('std12', 'net use', 'net view \\\\LAB-PC07', 'net use Z: \\\\LAB-PC07\\Homework /persistent:yes', 'net use W: \\\\LAB-PC07\\Worksheets', 'net use Y: /delete', 'net use'),
  m14: [].concat(LW('sales03', 'echo test > R:\\test.txt'), LW('srv', 'net share Reports', 'icacls D:\\Reports', 'net user somsak', 'net share Reports /delete',
    'net share Reports=D:\\Reports /grant:Sales,CHANGE /grant:Accounting,READ /grant:Users,READ', 'icacls D:\\Reports /grant Sales:(OI)(CI)M'), LW('sales03', 'echo test > R:\\test.txt', 'dir R:\\')),
  m15: LW('acc01', 'net user', 'net user somchai P@ssw0rd1 /add', 'net user malee * /add', 'net localgroup Accounting /add', 'net localgroup Accounting somchai malee /add', 'net user somchai', 'net localgroup Accounting'),
  m16: LW('off02', 'net user', 'net localgroup Administrators', 'net user kanya', 'net user Guest /active:no', 'net user kanya /active:no', 'net localgroup Administrators kanya /delete',
    'net localgroup "Remote Desktop Users" kanya /delete', 'net localgroup Administrators somchai /delete', 'net localgroup Administrators'),
  m17: LW('files', 'id arthit', 'sudo useradd -m -G staff -s /bin/bash nida', 'sudo passwd nida', 'sudo usermod -aG staff arthit', 'id nida', 'id arthit'),
  m18: LW('proj', 'ls -ld /srv/project', 'sudo chown root:staff /srv/project', 'sudo chmod 750 /srv/project', 'sudo chgrp staff /srv/project/budget.ods', 'sudo chmod 640 /srv/project/budget.ods', 'sudo ls -l /srv/project', 'ls -ld /srv/project'),
  m19: LW('fs01', 'icacls D:\\Projects', 'icacls D:\\Projects /grant Accounting:(OI)(CI)M', 'icacls D:\\Projects /remove Everyone', 'icacls D:\\Projects'),
  m20: [].concat(LW('fs02', 'icacls D:\\Finance\\Reports', 'net user malee', 'icacls D:\\Finance', 'icacls D:\\Finance /grant:r Staff:(OI)(CI)RX', 'icacls D:\\Finance\\Reports'), LW('hr05', 'del F:\\Reports\\q2-summary.xlsx'))
};
const LOGS = {
  m9: [{ h: 'adm01', c: 'ipconfig' }, { h: 'adm01', c: 'ping 192.168.10.50' }, { h: 'adm01', c: 'arp -a' }],
  m10: [{ h: 'srvweb', c: 'ss -tulpn' }, { h: 'srvweb', c: 'sudo ss -tulpn' }, { h: 'pcit', c: 'netstat -ano' }],
  m11: [{ h: 'srvmon', c: 'ping -c 4 8.8.8.8' }, { h: 'srvmon', c: 'ip route' }, { h: 'pcnoc', c: 'ipconfig' }, { h: 'srvmon', c: 'ip route add default via 10.50.0.1' },
    { h: 'srvmon', c: 'ip route' }, { h: 'srvmon', c: 'ping -c 4 8.8.8.8' }]
};
// 6.x: the command bonus comes from the replayed commandLog (commands run on the mission's hosts), not from commandsUsed
const host0 = id => M(id).start.hosts[0].id;
const asLog = (id, cmds) => cmds.map(c => ({ h: host0(id), c }));
const full = id => SOL[id] ? { commandLog: SOL[id] } : ({ answers: Object.assign({}, g._keys[id]), commandLog: (LOGS[id] || []).concat(asLog(id, ALL_CMDS)) });

console.log('terminal grader');

it('module shape follows SIM-SPEC §2 (m1-m8 kept, new missions appended, Windows + Linux, no answers in start)', () => {
  assert.strictEqual(g.id, 'terminal');
  assert.deepStrictEqual(g.missions.map(m => m.id), ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13', 'm14', 'm15', 'm16', 'm17', 'm18', 'm19', 'm20']);
  const oses = new Set();
  for (const m of g.missions) {
    assert.strictEqual(m.max, 10);
    assert.ok(m.title && m.desc && m.hints.length && ['easy', 'medium', 'hard'].includes(m.level));
    assert.ok(m.start.story && m.start.topo && m.start.hosts.length && (m.start.questions.length || m.start.tasks.length));
    m.start.hosts.forEach(h => oses.add(h.os));
    const pub = JSON.stringify(m);
    m.start.questions.forEach(q => { assert.deepStrictEqual(Object.keys(q).sort(), ['id', 'q', 'type']); });
    assert.ok(!/"key"|"tip"|"good"/.test(pub), 'no answer material in public mission ' + m.id);
    assert.deepStrictEqual(NetSim.create(m.start.topo).problems().filter(p => p.level === 'error'), [], m.id + ' topology has errors');
  }
  assert.ok(oses.has('windows') && oses.has('linux'));
  assert.ok(g.missions.some(m => m.start.hosts.length >= 2), 'at least one mission with host switching');
});

it('answer keys are what NetSim shows (independent recomputation)', () => {
  let n = net('m1'); let c = n.config('pc05');
  assert.deepStrictEqual(g._keys.m1, { ip: c.ip, mask: c.mask, gw: c.gateway, dns: c.dns[0] });
  assert.strictEqual(g._keys.m1.ip, '192.168.2.25');
  n = net('m2'); c = n.config('pc12');
  assert.strictEqual(c.dhcp, true); assert.strictEqual(g._keys.m2.mode, 'dhcp');
  assert.strictEqual(g._keys.m2.ip, c.ip); assert.strictEqual(g._keys.m2.dhcpsrv, n.config(c.leaseFrom).ip); assert.strictEqual(g._keys.m2.mac, c.mac);
  n = net('m3'); n.ping('acc07', '10.10.1.1');
  assert.strictEqual(g._keys.m3.gwmac, n.arp('acc07').find(e => e.ip === '10.10.1.1').mac);
  assert.strictEqual(g._keys.m3.prnttl, '64');
  assert.strictEqual(g._keys.m3.netttl, String(net('m3').ping('acc07', '8.8.8.8').ttl));
  n = net('m4');
  assert.strictEqual(g._keys.m4.ip, '172.16.9.20'); assert.strictEqual(NetSim.ip.toPrefix(g._keys.m4.prefix), 26);
  assert.strictEqual(g._keys.m4.gw, n.routes('lab09').find(r => r.prefix === 0).via);
  assert.strictEqual(g._keys.m4.moodle, n.nslookup('lab09', 'moodle.lab.local').ip);
  const tr = net('m5').traceroute('b204', '8.8.8.8');
  assert.strictEqual(g._keys.m5.hop2, tr.hops[1].ip); assert.strictEqual(g._keys.m5.hop2, '10.20.255.1');
  assert.strictEqual(g._keys.m5.hops, String(tr.hops.length));
  assert.strictEqual(g._keys.m6.rdp, '3389'); assert.strictEqual(g._keys.m6.who, '192.168.30.45');
  assert.strictEqual(g._keys.m7.iface, 'eth0');
  assert.ok(net('m7').config('ws07').up === false, 'm7 starts with eth0 down');
  const t7 = JSON.parse(JSON.stringify(M('m7').start.topo)); t7.devices.find(d => d.id === 'ws07').ifaces[0].up = true;
  assert.strictEqual(g._keys.m7.ip, NetSim.create(t7).config('ws07').ip);
  n = net('m8'); n.ping('pca', '192.168.2.20');
  assert.strictEqual(g._keys.m8.arpmac, n.arp('pca').find(e => e.ip === '192.168.1.1').mac);
  assert.strictEqual(g._keys.m8.ttl, '63');
});

it('full-score payload for every mission = 10/10', () => {
  for (const m of g.missions) {
    const r = g.grade(m.id, full(m.id));
    assert.strictEqual(r.score, 10, m.id + ': ' + r.feedback.join(' | '));
    assert.strictEqual(r.ok, true);
  }
});

it('normalises IPs, MACs, masks, ports and commands', () => {
  const r1 = g.grade('m1', { answers: { ip: ' 192.168.002.025/24 ', mask: '/24', gw: '192.168.2.1', dns: '192.168.2.5' }, commandLog: asLog('m1', ['IPCONFIG /ALL']) });
  assert.strictEqual(r1.score, 10, r1.feedback.join('|'));
  const r2 = g.grade('m2', { answers: { mode: 'ใช่', ip: '192.168.5.101(Preferred)', dhcpsrv: '192.168.5.10', mac: 'd4:be:d9:11:05:12' }, commandLog: asLog('m2', ['ipconfig /all']) });
  assert.strictEqual(r2.score, 10, r2.feedback.join('|'));
  const r6 = g.grade('m6', { answers: { rdp: ':3389', who: '192.168.30.45', sql: 'TCP 1433', srcport: '51744' }, commandLog: asLog('m6', ['netstat -an']) });
  assert.strictEqual(r6.score, 10, r6.feedback.join('|'));
  for (const cmd of ['sudo ip link set eth0 up', 'ip link set dev eth0 up', 'IP  LINK SET eth0 UP', 'ifup eth0']) {
    const r = g.grade('m7', { answers: Object.assign({}, g._keys.m7, { cmd }), commandLog: asLog('m7', ALL_CMDS) });
    assert.strictEqual(r.score, 10, cmd);
  }
});

it('wrong answers lose that question only, with a tip but without the answer', () => {
  const p = full('m5'); p.answers.hop2 = '10.20.4.1';
  const r = g.grade('m5', p);
  assert.strictEqual(r.score, 10 - 9 / 4);
  assert.strictEqual(r.details.questions.hop2, false);
  assert.ok(fbHas(r, /ข้อ 2: ยังไม่ถูกต้อง — ใช้ tracert/));
  assert.ok(!r.feedback.join(' ').includes('10.20.255.1'), 'feedback must not reveal the key');
  const p2 = full('m7'); p2.answers.cmd = 'ip link set eth0 down'; p2.answers.ip = '';
  const r2 = g.grade('m7', p2);
  assert.strictEqual(r2.score, 10 - 2 * 9 / 4);
  assert.ok(fbHas(r2, /ข้อ 3: ยังไม่ได้ตอบ/));
  const p3 = full('m2'); p3.answers.mac = 'zz-zz'; const r3 = g.grade('m2', p3);
  assert.ok(fbHas(r3, /รูปแบบคำตอบไม่ถูกต้อง/)); assert.strictEqual(r3.score, 10 - 9 / 4);
});

it('command bonus: none = -1, partial = -0.5', () => {
  const a = { answers: g._keys.m4 };
  assert.strictEqual(g.grade('m4', Object.assign({}, a, { commandLog: [] })).score, 9);
  const r = g.grade('m4', Object.assign({}, a, { commandLog: asLog('m4', ['ip a']) }));
  assert.strictEqual(r.score, 9.5); assert.ok(fbHas(r, /ควรใช้ ip route/));
  assert.strictEqual(g.grade('m4', Object.assign({}, a, { commandLog: asLog('m4', ['ip a', 'ip route', 'dig +short moodle.lab.local']) })).score, 10);
});
it('6.x command bonus is derived from the replayed commandLog: a claimed commandsUsed list earns nothing', () => {
  const a = { answers: g._keys.m4 };
  const claimed = g.grade('m4', Object.assign({}, a, { commandsUsed: ['ip a', 'ip route', 'dig +short moodle.lab.local'] }));
  assert.strictEqual(claimed.score, 9, 'commandsUsed alone gives no bonus');
  assert.ok(claimed.details.commands.every(c => !c.used));
  // commands on a host that is not part of the mission are not replayed, so they do not count either
  const foreign = g.grade('m4', Object.assign({}, a, { commandLog: ['ip a', 'ip route', 'dig +short moodle.lab.local'].map(c => ({ h: 'nope', c })) }));
  assert.strictEqual(foreign.score, 9);
  const real = g.grade('m4', Object.assign({}, a, { commandsUsed: [], commandLog: asLog('m4', ['ip a', 'ip route', 'dig +short moodle.lab.local']) }));
  assert.strictEqual(real.score, 10);
});

it('malformed payloads score 0 and never throw', () => {
  const bad = [null, undefined, 42, 'x', [], {}, { answers: null }, { answers: [] }, { answers: 'x' }, { answers: { ip: { $gt: 1 } }, commandsUsed: 'ipconfig' },
    { answers: { ip: 'a'.repeat(100000) }, commandsUsed: new Array(5000).fill(7) }];
  for (const p of bad) {
    const r = g.grade('m1', p);
    assert.strictEqual(r.score, 0, JSON.stringify(p && p.answers || null).slice(0, 40));
    assert.ok(Array.isArray(r.feedback) && r.feedback.length);
  }
  assert.strictEqual(g.grade('m1', {}).score, 0);
  assert.strictEqual(g.grade('nope', full('m1')).score, 0);
  assert.strictEqual(g.grade('m1', { answers: {}, commandLog: asLog('m1', ['ipconfig /all']) }).score, 0);
});


// ------------------------------------------------------------------ 2.6: guided / challenge modes
it('guided mode is capped at 7/10 inside the same max; challenge and legacy (no mode) reach 10/10', () => {
  assert.strictEqual(g.GUIDED_CAP, 0.7);
  for (const m of g.missions) {
    const gd = g.grade(m.id, Object.assign(full(m.id), { mode: 'guided' }));
    assert.strictEqual(gd.max, 10, m.id); assert.strictEqual(gd.score, 7, m.id); assert.strictEqual(gd.ok, false);
    assert.strictEqual(gd.details.mode, 'guided'); assert.strictEqual(gd.details.rawScore, 10);
    assert.ok(fbHas(gd, /โหมดแนะนำให้คะแนนสูงสุด 7\/10/));
    const ch = g.grade(m.id, Object.assign(full(m.id), { mode: 'challenge' }));
    assert.strictEqual(ch.score, 10, m.id); assert.strictEqual(ch.details.mode, 'challenge'); assert.ok(fbHas(ch, /โหมดท้าทาย/));
    assert.strictEqual(g.grade(m.id, full(m.id)).score, 10, m.id + ' legacy payload');
    assert.strictEqual(g.grade(m.id, Object.assign(full(m.id), { mode: 'weird' })).details.mode, 'challenge');
  }
  // below the cap the guided score is unchanged
  const p = full('m1'); p.answers = { ip: g._keys.m1.ip }; p.mode = 'guided';
  const r = g.grade('m1', p);
  assert.strictEqual(r.score, 9 / 4 + 1); assert.strictEqual(r.details.rawScore, r.score);
});

it('every mission has guided steps with valid regexes and no hidden answer values', () => {
  for (const m of g.missions) {
    const steps = m.start.steps;
    assert.ok(Array.isArray(steps) && steps.length >= 2, m.id + ' steps');
    const hostIds = m.start.hosts.map(h => h.id);
    steps.forEach((st, i) => {
      if (st.self) {   // 6.x: a fixing step of a non-Guided-Lab mission: goal only, no literal command
        assert.ok(m.mode !== 'guided' && st.say && st.why && st.explain && st.cmd === undefined && st.fill === undefined, `${m.id} step ${i} (self)`);
        assert.doesNotThrow(() => new RegExp(st.match, 'i'));
        return;
      }
      assert.ok(st.say && st.why && st.explain && typeof st.cmd === 'string', `${m.id} step ${i}`);
      assert.doesNotThrow(() => new RegExp(st.match, 'i')); assert.doesNotThrow(() => new RegExp(st.mark, 'i'));
      if (st.host) assert.ok(hostIds.includes(st.host), `${m.id} step ${i} host`);
      if (st.after !== undefined) assert.ok(st.after < i, `${m.id} step ${i} after`);
      if (!st.fill) assert.ok(new RegExp(st.match, 'i').test(st.cmd.trim()), `${m.id} step ${i}: its own command must complete it (${st.cmd})`);
    });
    const pub = JSON.stringify(m.start.steps);
    const visible = JSON.stringify([m.hints, m.start.questions, m.start.story, m.desc, m.start.netstat || null, m.start.facts || null]);
    const sc = g._scenarios[m.id];
    sc.questions.forEach(q => {
      const k = g._keys[m.id][q.id];
      if (['ip', 'mac', 'port', 'num'].includes(q.type) && k.length >= 4 && !visible.includes(k)) assert.ok(!pub.includes(k), `${m.id}.${q.id} answer leaked in steps`);
    });
  }
});

it('6.x non-Guided-Lab missions: following the published literal step commands cannot earn full marks; Guided Labs keep them', () => {
  for (const m of g.missions) {
    const steps = m.start.steps;
    if (m.mode === 'guided') {
      assert.ok(steps.every(st => typeof st.cmd === 'string' && !st.self), m.id + ' Guided Lab keeps literal commands');
      continue;
    }
    // replay every published literal command (with fill steps typed as published) on the step's host, no mode sent
    const log = []; let h = host0(m.id);
    steps.forEach(st => { if (st.host) h = st.host; if (typeof st.cmd === 'string') log.push({ h, c: st.cmd.trim() }); });
    const r = g.grade(m.id, { answers: {}, commandLog: log });
    assert.ok(r.score < 10, m.id + ' reached ' + r.score + ' by following the published steps');
    if (m.start.tasks && m.start.tasks.length && m.id !== 'm12') assert.ok(Object.values(r.details.tasks).some(v => !v), m.id + ' tasks completed from steps');
  }
  // the literal fixes are not in the public data of these missions any more (steps or hints)
  const pub = id => JSON.stringify([M(id).start.steps, M(id).hints]);
  assert.ok(!/ip link set eth0 up/.test(pub('m7')), 'm7 answer (iface + command) not in steps');
  assert.ok(!/useradd -m -G staff|passwd nida|usermod -aG staff arthit/.test(pub('m17')), 'm17 literal fix');
  assert.ok(!/grant Accounting|remove Everyone/.test(pub('m19')), 'm19 literal fix');
  assert.ok(!/net use Y: \/delete/.test(pub('m13')), 'm13 literal fix');
  assert.ok(M('m12').start.steps.some(st => st.cmd === 'net share Homework=C:\\Share\\Homework /grant:Students,CHANGE'), 'm12 (Guided Lab) keeps its literal steps');
});
it('6.x m12 step 2 explains (RX,W) accurately and notes that CREATOR OWNER is not simulated', () => {
  const ex = M('m12').start.steps[1].explain;
  assert.ok(/เขียนทับ/.test(ex) && /CREATOR OWNER/.test(ex) && /Modify/.test(ex) && /ไม่ได้จำลองสิทธิ์ CREATOR OWNER/.test(ex), ex);
  assert.ok(!/อ่านและสร้างไฟล์ได้ แต่ลบไม่ได้/.test(ex));
});

// ------------------------------------------------------------------ 2.6: new missions (evidence from the replayed command log)
it('m9 duplicate IP: keys come from NetSim (impostor answers ARP, Windows TTL)', () => {
  const n = net('m9');
  assert.ok(n.problems().some(p => p.code === 'dup_ip'));
  const r = n.ping('adm01', '192.168.10.50');
  assert.strictEqual(String(r.ttl), g._keys.m9.ttl); assert.strictEqual(g._keys.m9.ttl, '128');
  assert.strictEqual(n.arp('adm01').find(e => e.ip === '192.168.10.50').mac, g._keys.m9.mac);
  assert.strictEqual(g._keys.m9.who, 'NB-T07');
  assert.ok(M('m9').start.facts.some(f => f[1] === g._keys.m9.mac), 'impostor MAC is in the public inventory');
});

it('m9 positive variants: lower-case MAC, name without dash, Thai OS answer, ping -n, arp -a <ip>', () => {
  const r = g.grade('m9', { answers: { ttl: 'TTL=128', os: 'วินโดวส์', mac: 'b4:2e:99:5a:07:77', who: 'nb t07' }, mode: 'challenge',
    commandLog: [{ h: 'adm01', c: 'ping -n 2 192.168.10.50' }, { h: 'adm01', c: 'arp -a 192.168.10.50' }] });
  assert.strictEqual(r.score, 10, r.feedback.join(' | '));
});

it('m9 negative: answers without evidence get half, the printer MAC is wrong, arp before ping proves nothing', () => {
  const r = g.grade('m9', { answers: Object.assign({}, g._keys.m9), commandsUsed: [] });
  assert.strictEqual(r.score, 4.5); assert.ok(Object.values(r.details.questions).every(v => v === 'partial'));
  assert.ok(fbHas(r, /ไม่พบหลักฐานจากคำสั่งที่คุณรัน/));
  const r2 = g.grade('m9', { answers: Object.assign({}, g._keys.m9, { mac: '00-80-77-3D-10-50', who: 'PRN-ADM' }), commandLog: LOGS.m9 });
  assert.strictEqual(r2.details.questions.mac, false); assert.strictEqual(r2.details.questions.who, false);
  assert.strictEqual(r2.score, 2 * 9 / 4 + 1);
  assert.ok(!r2.feedback.join(' ').includes('B4-2E-99-5A-07-77'), 'feedback must not reveal the key');
  const r3 = g.grade('m9', { answers: Object.assign({}, g._keys.m9), commandLog: [{ h: 'adm01', c: 'arp -a' }, { h: 'adm01', c: 'ping 192.168.10.50' }] });
  assert.strictEqual(r3.details.questions.mac, 'partial'); assert.strictEqual(r3.details.questions.ttl, true);
  // a ping from another (unknown) host id is ignored
  const r4 = g.grade('m9', { answers: Object.assign({}, g._keys.m9), commandLog: [{ h: 'adm02', c: 'ping 192.168.10.50' }, { h: 'adm02', c: 'arp -a' }] });
  assert.ok(Object.values(r4.details.questions).every(v => v === 'partial'));
  // os answered "linux" (what a real printer would be) is wrong
  const r5 = g.grade('m9', Object.assign(full('m9'), { answers: Object.assign({}, g._keys.m9, { os: 'Linux' }) }));
  assert.strictEqual(r5.details.questions.os, false);
});

it('m10 ss/netstat: keys from the shared socket table; sudo and -o are required evidence', () => {
  assert.deepStrictEqual(g._keys.m10, { port: '8080', bind: '127.0.0.1', pid: '2310', sshpid: '7424' });
  // consistency: the client side of the SSH session on PC-IT45 matches the server side on srv-web
  const ns = M('m10').start.netstat;
  const cli = ns.pcit.find(r => r[3] === 'ESTABLISHED' && /:22$/.test(r[2]));
  const srv = ns.srvweb.find(r => r[3] === 'ESTABLISHED' && r[1] === '{ip}:22');
  assert.strictEqual(srv[2], '10.30.0.45:' + cli[1].split(':')[1]);
  assert.strictEqual(cli[2], NetSim.create(M('m10').start.topo).config('srvweb').ip + ':22');
  const ok = g.grade('m10', { answers: { port: ':8080', bind: '127.0.0.1', pid: 'pid=2310', sshpid: '7424' }, mode: 'challenge',
    commandLog: [{ h: 'srvweb', c: 'sudo ss -tlpn | grep node' }, { h: 'pcit', c: 'netstat -ano | findstr :22' }] });
  assert.strictEqual(ok.score, 10, ok.feedback.join(' | '));
});

it('m10 negative: no sudo -> port/pid half credit; wrong bind / server-side PID are wrong; netstat without -o', () => {
  const r = g.grade('m10', { answers: Object.assign({}, g._keys.m10), commandLog: [{ h: 'srvweb', c: 'ss -tulpn' }, { h: 'pcit', c: 'netstat -an' }] });
  assert.strictEqual(r.details.questions.port, 'partial'); assert.strictEqual(r.details.questions.pid, 'partial');
  assert.strictEqual(r.details.questions.bind, true); assert.strictEqual(r.details.questions.sshpid, 'partial');
  assert.ok(fbHas(r, /sudo/));
  const r2 = g.grade('m10', Object.assign(full('m10'), { answers: { port: '22', bind: '0.0.0.0', pid: '901', sshpid: '3120' } }));
  assert.strictEqual(r2.score, 0); assert.ok(Object.values(r2.details.questions).every(v => v === false));
  // the same commands typed on the wrong host do not count
  const r3 = g.grade('m10', { answers: Object.assign({}, g._keys.m10), commandLog: [{ h: 'pcit', c: 'sudo ss -tulpn' }, { h: 'srvweb', c: 'netstat -ano' }] });
  assert.ok(Object.values(r3.details.questions).every(v => v === 'partial'));
});

it('m11 missing default route: fix verified only by replaying ip route add + a successful ping', () => {
  assert.deepStrictEqual(g._keys.m11, { hasdef: 'no', gw: '10.50.0.1', ttl: '117' });
  const n = net('m11');
  assert.ok(!n.routes('srvmon').some(r => r.prefix === 0));
  assert.deepStrictEqual(n.ping('srvmon', '8.8.8.8').linux, ['ping: connect: Network is unreachable']);
  const r = g.grade('m11', Object.assign(full('m11'), { mode: 'challenge' }));
  assert.strictEqual(r.score, 10, r.feedback.join(' | ')); assert.strictEqual(r.details.tasks.fix, true);
  // Thai yes/no, sudo prefix, 0.0.0.0/0 form
  const r2 = g.grade('m11', { answers: { hasdef: 'ไม่มี', gw: '10.50.0.1', ttl: '117' },
    commandLog: [{ h: 'srvmon', c: 'ip r' }, { h: 'pcnoc', c: 'route print' }, { h: 'srvmon', c: 'sudo ip route add 0.0.0.0/0 via 10.50.0.1 dev eth0' }, { h: 'srvmon', c: 'ping 8.8.8.8' }] });
  assert.strictEqual(r2.score, 10, r2.feedback.join(' | '));
});

it('m11 negative: wrong gateway, off-subnet gateway, ping before fix, reset after fix, answers only', () => {
  const base = { answers: Object.assign({}, g._keys.m11) };
  const wrongGw = g.grade('m11', Object.assign({}, base, { commandLog: [{ h: 'srvmon', c: 'ip route' }, { h: 'srvmon', c: 'ip route add default via 10.50.0.254' }, { h: 'srvmon', c: 'ping -c 4 8.8.8.8' }] }));
  assert.strictEqual(wrongGw.details.tasks.fix, false); assert.strictEqual(wrongGw.details.questions.ttl, 'partial');
  const off = g._replay(g._scenarios.m11, [{ h: 'srvmon', c: 'ip route add default via 10.60.0.1' }]);
  assert.strictEqual(off.routeAdds[0].ok, false);
  const before = g.grade('m11', Object.assign({}, base, { commandLog: [{ h: 'srvmon', c: 'ping -c 4 8.8.8.8' }, { h: 'srvmon', c: 'ip route add default via 10.50.0.1' }] }));
  assert.strictEqual(before.details.tasks.fix, false);
  const reset = g.grade('m11', Object.assign({}, base, { commandLog: [{ h: 'srvmon', c: 'ip route add default via 10.50.0.1' }, { h: '*', c: '#reset' }, { h: 'srvmon', c: 'ping -c 4 8.8.8.8' }] }));
  assert.strictEqual(reset.details.tasks.fix, false);
  const winOnly = g.grade('m11', Object.assign({}, base, { commandLog: [{ h: 'pcnoc', c: 'route add 0.0.0.0 mask 0.0.0.0 10.50.0.1' }, { h: 'pcnoc', c: 'ping 8.8.8.8' }] }));
  assert.strictEqual(winOnly.details.tasks.fix, false, 'fixing another host does not count');
  const none = g.grade('m11', base);
  assert.strictEqual(none.details.tasks.fix, false); assert.ok(fbHas(none, /งานปฏิบัติ: ยังไม่ผ่าน/));
  assert.ok(none.score < 5);
  const wrong = g.grade('m11', Object.assign(full('m11'), { answers: { hasdef: 'มี', gw: '10.50.0.20', ttl: '64' } }));
  assert.ok(['hasdef', 'gw', 'ttl'].every(k => wrong.details.questions[k] === false));
  assert.strictEqual(wrong.score, 9 / 4 + 1, 'only the practical task (and the command bonus) remain');
});

it('replay: pings fill ARP, mutations rebuild the network, #reset restores the start, bad logs never throw', () => {
  const sc = g._scenarios.m3;
  const st = g._replay(sc, [{ h: 'acc07', c: 'arp -a' }, { h: 'acc07', c: 'ping 10.10.1.1' }, { h: 'acc07', c: 'arp -a' }, { h: 'acc07', c: 'ping -t 10.10.1.50' }]);
  assert.strictEqual(st.arp[0].list.length, 0); assert.ok(st.arp[1].list.some(e => e.ip === '10.10.1.1'));
  assert.strictEqual(st.pings.length, 1, 'ping -t is refused by the terminal, so it is not replayed');
  const chk = g._routeAddCheck;
  const n = net('m11');
  assert.deepStrictEqual(chk(n, 'srvmon', 'x', false).err, 'bad');
  assert.deepStrictEqual(chk(n, 'srvmon', '10.50.0.20', false).err, 'nexthop');
  assert.deepStrictEqual(chk(n, 'pcnoc', '10.50.0.1', false).err, 'exists');
  assert.strictEqual(chk(n, 'pcnoc', '10.50.0.1', true).ok, true);
  const weird = [{ h: 'srvmon' }, null, 7, { h: 'srvmon', c: '' }, { h: 'srvmon', c: 'sudo' }, { h: 'srvmon', c: 'ip route add default via' }, { h: 'srvmon', c: 'ip link set dev' }];
  assert.doesNotThrow(() => g._replay(g._scenarios.m11, weird.filter(e => e && typeof e === 'object' && typeof e.c === 'string')));
  const r = g.grade('m11', { answers: {}, commandLog: weird.concat(new Array(400).fill({ h: 'srvmon', c: 'ping 8.8.8.8' })) });
  assert.strictEqual(r.score, 0);
});


// ------------------------------------------------------------------ 4.0: accounts, shares and permissions (m12-m20, NL_SYS)
const SYS = require('../../public/js/sim/terminal.js');
const cl = x => JSON.parse(JSON.stringify(x));
// a terminal session on one mission host: run(line) -> output text ('' when silent); same engine + env the grader uses
function session(id, hostId) {
  const net = NetSim.create(cl(M(id).start.topo));
  const mk = hid => { const h = M(id).start.hosts.find(x => x.id === hid); return line => { const r = SYS.run({ net, hostId: hid, os: h.os, user: h.user, admin: h.os === 'windows' && /^administrator$/i.test(h.user) }, line); r.text = r.out.map(x => typeof x === 'string' ? x : x.t).join('\n'); return r; }; };
  const run = mk(hostId); run.on = mk; run.net = net; run.sys = hid => net.topo.devices.find(d => d.id === (hid || hostId)).sys;
  return run;
}
const T = (r, re) => assert.ok(re.test(r.text), `expected ${re} in:\n${r.text}`);
const grade = (id, log, extra) => g.grade(id, Object.assign({ commandLog: log, mode: 'challenge' }, extra || {}));
const without = (log, re) => log.filter(e => !re.test(e.c));

it('4.0 missions: week, lab mode, level, tasks only (nothing to type), elevated where admin work is needed', () => {
  const want = { m12: [9, 'guided'], m13: [9, 'independent'], m14: [18, 'troubleshooting'], m15: [17, 'guided'], m16: [17, 'troubleshooting'], m17: [17, 'independent'], m18: [18, 'guided'], m19: [18, 'independent'], m20: [18, 'troubleshooting'] };
  for (const [id, [wk, mode]] of Object.entries(want)) {
    const m = M(id);
    assert.strictEqual(m.week, wk, id); assert.strictEqual(m.mode, mode, id);
    assert.deepStrictEqual(m.start.questions, [], id); assert.ok(m.start.tasks.length >= 3, id);
    assert.ok(m.start.steps.length >= 2 && m.hints.length >= 3, id);
  }
  // admin work starts elevated (Administrator = Run as administrator); client PCs are normal users
  assert.deepStrictEqual(['m12', 'm15', 'm16', 'm19'].map(id => M(id).start.hosts[0].user), ['Administrator', 'Administrator', 'Administrator', 'Administrator']);
  assert.deepStrictEqual(M('m14').start.hosts.map(h => h.user), ['somsak', 'Administrator']);
  assert.deepStrictEqual(M('m20').start.hosts.map(h => h.user), ['malee', 'Administrator']);
  assert.strictEqual(M('m13').start.hosts[0].user, 'student');
  assert.ok(['m17', 'm18'].every(id => M(id).start.hosts[0].os === 'linux' && M(id).start.hosts[0].user === 'student'));
});

it('public 4.0 mission data holds no answer: no checks/tips, start state fails every state task, trouble steps do not give the fix', () => {
  for (const id of Object.keys(SOL)) {
    const pub = JSON.stringify(M(id));
    assert.ok(!/"check"|"tip"|"good"|"key"/.test(pub), id);
    assert.deepStrictEqual(Object.keys(M(id).start.tasks[0]).sort(), ['id', 'label'], id);
    const r = grade(id, []);
    assert.ok(Object.values(r.details.tasks).every(v => v === false), id + ' start state already passes a task');
    assert.strictEqual(r.score, 0, id);
  }
  const steps = id => JSON.stringify(M(id).start.steps);
  assert.ok(!/grant:Sales|Sales:\(OI\)|Sales,CHANGE/i.test(steps('m14')), 'm14 steps reveal the fix');
  assert.ok(!/Staff:\(OI\)|grant:r|remove Staff/i.test(steps('m20')), 'm20 steps reveal the fix');
  assert.ok(!/kanya \/active|somchai \/delete|kanya \/delete/i.test(steps('m16')), 'm16 steps reveal the fix');
  assert.ok(!/Homework|Worksheets/.test(steps('m13').replace(/\\\\LAB-PC07\\\\(?=")/g, '')), 'm13 steps reveal the share names');
});

it('every 4.0 mission passes 10/10 from a real command sequence; guided mode is capped at 7', () => {
  for (const id of Object.keys(SOL)) {
    const r = grade(id, SOL[id]);
    assert.strictEqual(r.score, 10, id + ': ' + r.feedback.join(' | '));
    assert.ok(Object.values(r.details.tasks).every(Boolean), id);
    assert.strictEqual(grade(id, SOL[id], { mode: 'guided' }).score, 7, id);
  }
});

it('net share: create (case/quotes/option order), details, errors, elevation', () => {
  let t = session('m12', 'lab07');
  T(t('net share'), /^C\$\s+C:\\\s+Default share$/m); T(t('net share'), /^IPC\$\s+Remote IPC$/m);
  T(t('NET SHARE homework="C:\\share\\Homework" /REMARK:"ส่งงาน" /GRANT:students,change'), /^homework was shared successfully\.$/m);
  const d = t('net share HOMEWORK'); T(d, /^Path\s+C:\\Share\\Homework$/m); T(d, /^Permission\s+LAB-PC07\\Students, CHANGE$/m); T(d, /^Remark\s+ส่งงาน$/m); assert.ok(d.view);
  T(t('net share Homework=C:\\Share\\Homework'), /The name has already been shared\.[\s\S]*HELPMSG 2118/);
  T(t('net share Other=C:\\Share\\Nope'), /The device or directory does not exist\.[\s\S]*HELPMSG 2116/);
  T(t('net share X=C:\\Share\\Homework /grant:Students,MODIFY'), /^The syntax of this command is:/);
  T(t('net share X=C:\\Share\\Homework /grant:Studentz,READ'), /System error 1332 has occurred\.[\s\S]*No mapping between account names and security IDs was done\./);
  T(t('net share X=C:\\Share\\Homework /foo'), /The option \/FOO is unknown\./);
  T(t('net share Nope'), /This shared resource does not exist\.[\s\S]*HELPMSG 2310/);
  T(t('net share Nope /delete'), /HELPMSG 2310/);
  // no /grant = Everyone READ (real default); several /grant give several lines
  T(t('net share Two=C:\\Share'), /Two was shared successfully/); T(t('net share Two'), /^Permission\s+Everyone, READ$/m);
  T(t('net share Three=C:\\Share /grant:Administrators,FULL /grant:Students,READ'), /successfully/);
  T(t('net share Three'), /^Permission\s+BUILTIN\\Administrators, FULL\n\s{18}LAB-PC07\\Students, READ$/m);
  T(t('net share Two /del'), /^Two was deleted successfully\.$/m);
  T(t('net share HOMEWORK /delete'), /^homework was deleted successfully\.$/m);
  // not elevated: a student PC (m13) gets System error 5, the state does not change
  const c = session('m13', 'std12');
  T(c('net share Mine=C:\\Users\\student'), /^System error 5 has occurred\.\n\nAccess is denied\.$/m);
  assert.ok(!c.sys().shares.some(x => x.name === 'Mine'));
  T(c('net share /?'), /NET SHARE\nsharename/);
});

it('net use / net view: map by name or IP, persistent, delete, all error codes', () => {
  const t = session('m13', 'std12');
  T(t('net use'), /^Unavailable\s+Y:\s+\\\\OLD-SRV\\Homework\s+Microsoft Windows Network$/m); T(t('net use'), /^New connections will not be remembered\.$/m);
  const v = t('net view \\\\lab-pc07'); T(v, /^Homework\s+Disk\s+ส่งงาน$/m); T(v, /^LabPrinter\s+Print\s+HP LaserJet/m); assert.ok(!/Answer\$/.test(v.text), 'hidden share listed');
  T(t('net view \\\\LAB-PC07 /all'), /^Answer\$\s+Disk/m); T(t('net view'), /System error 6118/);
  T(t('net use Z: \\\\192.168.20.57\\homework /PERSISTENT:YES'), /^The command completed successfully\.$/m);
  assert.deepStrictEqual(t.sys().drives.find(d => d.local === 'Z:'), { local: 'Z:', remote: '\\\\192.168.20.57\\homework', persistent: true });
  T(t('net use Z: \\\\LAB-PC07\\Worksheets'), /System error 85[\s\S]*The local device name is already in use\./);
  T(t('net use W: \\\\LAB-PC07\\Nope'), /System error 67[\s\S]*The network name cannot be found\./);
  T(t('net use W: \\\\OLD-SRV\\Homework'), /System error 53[\s\S]*The network path was not found\./);
  T(t('net use W: \\\\LAB-PC07\\Answer$'), /System error 5[\s\S]*Access is denied\./);
  T(t('net use P: \\\\LAB-PC07\\LabPrinter'), /System error 66[\s\S]*The network resource type is not correct\./);
  T(t('net use C: \\\\LAB-PC07\\Worksheets'), /System error 85/);
  T(t('net use W: \\\\LAB-PC07\\Worksheets /persistent:maybe'), /invalid value for the \/PERSISTENT option/);
  T(t('net use * \\\\LAB-PC07\\Worksheets'), /^Drive X: is now connected to \\\\LAB-PC07\\Worksheets\.$/m);   // * takes the highest free letter (Z: and Y: are in use)
  T(t('net use Q: /delete'), /The network connection could not be found\.[\s\S]*HELPMSG 2250/);
  T(t('net use y: /DELETE'), /^Y: was deleted successfully\.$/m);
  const l = t('net use'); T(l, /^OK\s+X:\s+\\\\LAB-PC07\\Worksheets/m); T(l, /^OK\s+Z:/m); assert.ok(!/Y:/.test(l.text));
  T(t('dir X:\\'), /ws08-sharing\.pdf/); T(t('echo hack > X:\\x.txt'), /^Access is denied\.$/m);
  T(t('net use * /delete'), /Continue with this operation\? \(Y\/N\) \[N\]:/); assert.strictEqual(t.sys().drives.length, 2, 'without /y nothing is deleted');
  T(t('net use * /delete /y'), /completed successfully/); T(t('net use'), /There are no entries in the list\./);
});

it('net user / net localgroup: add, options, errors, elevation, server password policy', () => {
  const t = session('m15', 'acc01');
  T(t('net user somchai P@ssw0rd1 /add'), /^The command completed successfully\.$/m);
  T(t('NET USER malee * /ADD'), /Type a password for the user:/);
  T(t('net user somchai x /add'), /The account already exists\.[\s\S]*HELPMSG 2224/);
  T(t('net user nobody'), /The user name could not be found\.[\s\S]*HELPMSG 2221/);
  const i = t('net user somchai'); T(i, /^User name\s+somchai$/m); T(i, /^Account active\s+Yes$/m); T(i, /^Local Group Memberships\s+\*Users$/m);
  T(t('net user somchai /active:maybe'), /invalid value for the \/ACTIVE option/);
  T(t('net user somchai /actve:no'), /^The option \/ACTVE is unknown\.$/m);
  T(t('net user somchai /ACTIVE:NO'), /completed successfully/); T(t('net user somchai'), /^Account active\s+No$/m);
  T(t('net user somchai /active:yes /fullname:"Somchai Rakdee"'), /completed/); T(t('net user somchai'), /^Full Name\s+Somchai Rakdee$/m);
  T(t('net user somchai /logonpasswordchg:yes'), /ยังไม่รองรับ/);
  T(t('net localgroup Accounting /add'), /completed successfully/);
  T(t('net localgroup accounting /add'), /System error 1379[\s\S]*already exists/);
  T(t('net localgroup Accounting somchai malee /add'), /completed successfully/);
  T(t('net localgroup Accounting malee /add'), /System error 1378[\s\S]*already a member/);
  T(t('net localgroup Accounting ghost /add'), /There is no such global user or group: ghost\.[\s\S]*HELPMSG 3783/);
  T(t('net localgroup Nope somchai /add'), /System error 1376[\s\S]*does not exist/);
  T(t('net localgroup "Remote Desktop Users" malee /add'), /completed/); T(t('net localgroup "remote desktop users" malee /delete'), /completed/);
  T(t('net localgroup "Remote Desktop Users" malee /delete'), /System error 1377[\s\S]*not a member/);
  const lg = t('net localgroup Accounting'); T(lg, /^Alias name\s+Accounting$/m); T(lg, /^-{79}\nsomchai\nmalee\nThe command completed successfully\.$/m);
  T(t('net localgroup'), /^\*Accounting$/m);
  T(t('net user somchai'), /^Local Group Memberships\s+\*Users\s+\*Accounting$/m);
  T(t('net user ghost /delete'), /HELPMSG 2221/); T(t('net user Guest /delete'), /built-in/);
  // not elevated
  const c = session('m14', 'sales03');
  T(c('net user x P@ss1 /add'), /System error 5[\s\S]*Access is denied\./); T(c('net localgroup Administrators somsak /add'), /System error 5/);
  T(c('net user somsak'), /^Account active\s+Yes$/m);
  // Windows Server enforces password complexity (net user /add)
  const s = session('m14', 'srv');
  T(s('net user test abc /add'), /does not meet the password policy requirements[\s\S]*HELPMSG 2245/);
  T(s('net user test Str0ng!pw /add'), /completed successfully/);
});

it('icacls: display, grant/deny/remove variants in any order, inheritance, errors, elevation', () => {
  const t = session('m19', 'fs01');
  const d = t('icacls D:\\Projects');
  T(d, /^D:\\Projects BUILTIN\\Administrators:\(OI\)\(CI\)\(F\)\n {12}NT AUTHORITY\\SYSTEM:\(OI\)\(CI\)\(F\)\n {12}CREATOR OWNER:\(OI\)\(CI\)\(IO\)\(F\)\n {12}Everyone:\(OI\)\(CI\)\(F\)\n\nSuccessfully processed 1 files; Failed processing 0 files$/);
  T(t('icacls D:\\Projects\\*'), /^D:\\Projects\\2027 .*\(I\)\(OI\)\(CI\)\(F\)/m); T(t('icacls D:\\Projects\\*'), /^D:\\Projects\\plan-2027\.xlsx BUILTIN\\Administrators:\(I\)\(F\)$/m);
  // /remove before /grant in ONE command, lower-case options, quoted path, domain-qualified name, (M) in brackets
  T(t('icacls "d:\\projects" /remove everyone /GRANT FS-01\\Accounting:(OI)(CI)(M)'), /^processed file: d:\\projects\nSuccessfully processed 1 files; Failed processing 0 files$/);
  let acl = t('icacls D:\\Projects').text; assert.ok(!/Everyone/.test(acl)); T({ text: acl }, /FS-01\\Accounting:\(OI\)\(CI\)\(M\)/);
  // merge: a second grant for the same Sid and flags merges rights
  T(t('icacls D:\\Projects /grant Sales:(OI)(CI)R'), /processed/); T(t('icacls D:\\Projects /grant Sales:(OI)(CI)W'), /processed/);
  T(t('icacls D:\\Projects'), /FS-01\\Sales:\(OI\)\(CI\)\(R,W\)/);
  T(t('icacls D:\\Projects /grant:r Sales:(OI)(CI)RX'), /processed/); T(t('icacls D:\\Projects'), /FS-01\\Sales:\(OI\)\(CI\)\(RX\)$/m);
  T(t('icacls D:\\Projects /deny Sales:(OI)(CI)W'), /processed/); T(t('icacls D:\\Projects'), /^D:\\Projects FS-01\\Sales:\(OI\)\(CI\)\(DENY\)\(W\)$/m);   // explicit deny is listed first (canonical order)
  T(t('icacls D:\\Projects /remove:d Sales'), /processed/); assert.ok(!/DENY/.test(t('icacls D:\\Projects').text));
  T(t('icacls D:\\Projects /remove:g Sales'), /processed/); assert.ok(!/Sales/.test(t('icacls D:\\Projects').text));
  // errors
  T(t('icacls D:\\Projects /grant Accounting:MODIFY'), /^Invalid parameter "Accounting:MODIFY"$/m);
  T(t('icacls D:\\Projects /grant Accounting'), /^Invalid parameter "Accounting"$/m);
  T(t('icacls D:\\Projects /grant'), /^Invalid parameter "\/grant"$/m);
  T(t('icacls D:\\Projects /grant Acounting:(OI)(CI)M'), /^Acounting: No mapping between account names and security IDs was done\.\nSuccessfully processed 0 files; Failed processing 1 files$/);
  T(t('icacls D:\\Projectz'), /^D:\\Projectz: The system cannot find the file specified\.\nSuccessfully processed 0 files; Failed processing 1 files$/);
  T(t('icacls /?'), /ICACLS name \/save/);
  // inheritance: /inheritance:d copies inherited ACEs as explicit, :r removes them, :e enables again
  T(t('icacls D:\\Projects\\2027 /inheritance:d'), /processed/); T(t('icacls D:\\Projects\\2027'), /^D:\\Projects\\2027 BUILTIN\\Administrators:\(OI\)\(CI\)\(F\)$/m);
  T(t('icacls D:\\Projects\\2027 /reset'), /processed/); T(t('icacls D:\\Projects\\2027'), /\(I\)\(OI\)\(CI\)\(F\)/);
  T(t('icacls D:\\Projects\\2027 /inheritance:r'), /processed/); T(t('icacls D:\\Projects\\2027'), /^D:\\Projects\\2027 \n\nSuccessfully processed 1 files/);
  // /t applies to every child
  const t2 = session('m19', 'fs01');
  T(t2('icacls D:\\Projects /grant Sales:R /t'), /processed file: D:\\Projects\\2027\\budget\.xlsx/);
  // relative path after cd
  T(t2('cd /d D:\\Projects'), /^$/); T(t2('icacls 2027'), /^2027 FS-01\\Sales:\(R\)\n {5}BUILTIN\\Administrators:\(I\)\(OI\)\(CI\)\(F\)$/m); T(t2('icacls 2027'), /CREATOR OWNER:\(I\)\(OI\)\(CI\)\(IO\)\(F\)/); T(t2('dir'), /plan-2027\.xlsx/);
  // not elevated: change refused, display allowed when the user can read
  const c = session('m20', 'hr05');
  T(c('icacls C:\\Users\\malee /grant Everyone:F'), /^C:\\Users\\malee: Access is denied\.\nSuccessfully processed 0 files; Failed processing 1 files$/);
  T(c('icacls C:\\Users\\malee'), /PC-HR05\\malee:\(OI\)\(CI\)\(F\)/);
});

it('Windows file commands test effective access over the network (Share AND NTFS) and locally', () => {
  const t = session('m14', 'sales03'), s = t.on('srv');
  T(t('dir R:\\'), /sales-2026-09\.xlsx/); T(t('type R:\\sales-2026-09.xlsx'), /^$/);
  T(t('echo test > R:\\test.txt'), /^Access is denied\.$/);
  // NTFS alone is not enough: the share still says Everyone READ
  T(s('icacls D:\\Reports /grant Sales:(OI)(CI)M'), /processed/); T(t('echo test > R:\\test.txt'), /^Access is denied\.$/);
  T(s('net share Reports /delete'), /deleted/); T(t('net use'), /^(Disconnected|Unavailable)\s+R:/m); T(t('dir R:\\'), /The network name cannot be found\./);
  T(s('net share Reports=D:\\Reports /grant:Everyone,CHANGE'), /shared successfully/);
  T(t('echo test > R:\\test.txt'), /^$/); T(t('type R:\\test.txt'), /^test$/m); T(s('dir D:\\Reports'), /test\.txt/);
  T(t('del R:\\nope.txt'), /^Could Not Find R:\\nope\.txt$/);
  T(t('cd \\\\LAB-SRV\\Reports'), /CMD does not support UNC paths/);
  // local admin session: cd / drive letters / dir
  T(s('cd'), /^C:\\Windows\\system32$/); T(s('D:'), /^$/); T(s('cd Reports'), /^$/); T(s('cd'), /^D:\\Reports$/); T(s('cd ..\\Nope'), /The system cannot find the path specified\./);
  T(s('Q:'), /The system cannot find the drive specified\./);
});

it('Linux: useradd/adduser/usermod/passwd/id/groups/getent variants and errors', () => {
  const t = session('m17', 'files');
  T(t('useradd -m nida'), /^useradd: Permission denied\.\nuseradd: cannot lock \/etc\/passwd; try again later\.$/);
  T(t('sudo useradd --create-home --groups=staff --shell /bin/bash nida'), /^$/);
  T(t('sudo useradd nida'), /^useradd: user 'nida' already exists$/);
  T(t('sudo useradd -G stafff x'), /^useradd: group 'stafff' does not exist$/);
  T(t('sudo useradd -z x'), /^useradd: invalid option -- 'z'\nUsage: useradd/);
  T(t('id nida'), /^uid=1003\(nida\) gid=1003\(nida\) groups=1003\(nida\),50\(staff\)$/);
  T(t('groups nida'), /^nida : nida staff$/); T(t('ls -ld /home/nida'), /^drwxr-x--- 2 nida nida 4096 /);
  T(t('sudo passwd -S nida'), /^nida L /); T(t('passwd nida'), /You may not view or modify password information for nida\./);
  T(t('sudo passwd nida'), /passwd: password updated successfully/); T(t('sudo passwd -S nida'), /^nida P /);
  T(t('sudo usermod -a staff arthit'), /usermod: -a flag is ONLY allowed with the -G flag/);
  T(t('usermod -aG staff arthit'), /usermod: Permission denied\./);
  T(t('sudo usermod -aG nope arthit'), /usermod: group 'nope' does not exist/); T(t('sudo usermod -aG staff ghost'), /usermod: user 'ghost' does not exist/);
  // -G without -a REPLACES the supplementary groups (classic mistake), -aG appends
  T(t('sudo usermod -G staff arthit'), /^$/); T(t('id arthit'), /groups=1001\(arthit\),50\(staff\)$/);
  T(t('sudo usermod -aG developers arthit'), /^$/); T(t('id arthit'), /50\(staff\),1100\(developers\)$/);
  T(t('getent group staff'), /^staff:x:50:kanda,nida,arthit$/); T(t('cat /etc/group'), /^developers:x:1100:arthit$/m);
  T(t('cat /etc/passwd'), /^nida:x:1003:1003::\/home\/nida:\/bin\/bash$/m); T(t('cat /etc/shadow'), /Permission denied/);
  T(t('id ghost'), /^id: ‘ghost’: no such user$/);
  T(t('sudo adduser somsri'), /Adding user `somsri' \.\.\.[\s\S]*passwd: password updated successfully/); T(t('sudo adduser somsri staff'), /Adding user somsri to group staff/);
  T(t('sudo adduser somsri staff'), /The user `somsri' is already a member of `staff'\./); T(t('adduser x'), /Only root may add a user or group/);
  T(t('sudo gpasswd -d somsri staff'), /Removing user somsri from group staff/); T(t('sudo userdel -r somsri'), /^$/); T(t('id somsri'), /no such user/);
  T(t('sudo groupadd projectA'), /^$/); T(t('sudo groupadd projectA'), /group 'projectA' already exists/);
  T(t('sudo -u nida id'), /^uid=1003\(nida\)/); T(t('sudo -u ghost id'), /sudo: unknown user ghost/);
});

it('Linux: chmod (octal/symbolic), chown/chgrp, ls -l/-ld and permission checks as another user', () => {
  const t = session('m18', 'proj');
  T(t('ls -ld /srv/project'), /^drwxrwxrwx 2 root root 4096 Sep  1 08:00 \/srv\/project$/);
  T(t('ls -l /srv/project'), /^total 24\n-rw-rw-rw- 1 nida nida 18234 Sep  1 08:00 budget\.ods\n-rw-r--r-- 1 root root    64 Sep  1 08:00 readme\.txt$/);
  T(t('chmod 750 /srv/project'), /^chmod: changing permissions of '\/srv\/project': Operation not permitted$/);
  T(t('chown root:staff /srv/project'), /^chown: changing ownership of '\/srv\/project': Operation not permitted$/);
  T(t('sudo chmod 79 /srv/project'), /^chmod: invalid mode: ‘79’\nTry 'chmod --help' for more information\.$/);
  T(t('sudo chmod 750'), /missing operand after ‘750’/); T(t('sudo chmod 750 /srv/nope'), /cannot access '\/srv\/nope': No such file or directory/);
  T(t('sudo chown nidaa /srv/project'), /^chown: invalid user: ‘nidaa’$/); T(t('sudo chown root:stafff /srv/project'), /^chown: invalid group: ‘root:stafff’$/);
  T(t('sudo chgrp nope /srv/project'), /^chgrp: invalid group: ‘nope’$/);
  T(t('sudo chown :staff /srv/project'), /^$/); T(t('ls -ld /srv/project'), /root staff/);
  T(t('sudo chmod u=rwx,g=rx,o= /srv/project'), /^$/); T(t('ls -ld /srv/project'), /^drwxr-x--- /);
  T(t('sudo chmod o+rx /srv/project'), /^$/); T(t('ls -ld /srv/project'), /^drwxr-xr-x /); T(t('sudo chmod 750 /srv/project'), /^$/);
  T(t('ls -l /srv/project'), /^ls: cannot open directory '\/srv\/project': Permission denied$/);   // student is not in staff
  T(t('sudo -u nida ls /srv/project'), /^budget\.ods  readme\.txt$/); T(t('sudo -u arthit ls /srv/project'), /Permission denied/);
  T(t('sudo -u arthit cat /srv/project/readme.txt'), /cat: \/srv\/project\/readme\.txt: Permission denied/);
  T(t('sudo -u nida cat /srv/project/readme.txt'), /^Project files - staff only$/);
  T(t('sudo chmod g-w,o-rw /srv/project/budget.ods'), /^$/); T(t('sudo ls -l /srv/project'), /^-rw-r----- 1 nida nida/m);
  T(t('sudo chmod 2750 /srv/project'), /^$/); T(t('ls -ld /srv/project'), /^drwxr-s--- /); T(t('sudo chmod g-s /srv/project'), /^$/);
  T(t('cd /srv/project'), /-bash: cd: \/srv\/project: Permission denied/); T(t('sudo cd /srv'), /sudo: cd: command not found/);
  T(t('cd /srv'), /^$/); T(t('pwd'), /^\/srv$/); T(t('mkdir x'), /mkdir: cannot create directory ‘x’: Permission denied/);
  T(t('cd'), /^$/); T(t('touch notes.txt'), /^$/); T(t('ls -l'), /^-rw-rw-r-- 1 student student 0 .* notes\.txt$/m);
  T(t('ls -z'), /ls: invalid option -- 'z'/);
});

it('state grading: wrong or incomplete work fails the right task with a tip (no answer leaked)', () => {
  const fails = (id, log, task, tipRe) => {
    const r = grade(id, log);
    assert.strictEqual(r.details.tasks[task], false, `${id}.${task} should fail: ${r.feedback.join(' | ')}`);
    assert.ok(r.score < 10, id);
    if (tipRe) assert.ok(r.feedback.some(f => tipRe.test(f)), `${id} tip ${tipRe}: ${r.feedback.join(' | ')}`);
    return r;
  };
  // m12: no /grant -> Everyone READ; FULL; checked before the last change; name/path
  fails('m12', LW('lab07', 'net share Homework=C:\\Share\\Homework', 'net share'), 'perm', /Everyone/);
  fails('m12', LW('lab07', 'net share Homework=C:\\Share\\Homework /grant:Students,FULL', 'net share'), 'perm', /FULL/);
  fails('m12', LW('lab07', 'net share', 'net share Homework=C:\\Share\\Homework /grant:Students,CHANGE'), 'verify');
  fails('m12', LW('lab07', 'net share HW=C:\\Share\\Homework /grant:Students,CHANGE', 'net share'), 'share', /ชื่อไม่ใช่ Homework/);
  // m13: not persistent, wrong share, Y: kept, check before the last change; mapping by IP is accepted
  fails('m13', without(SOL.m13, /^net use Z:/).concat(LW('std12', 'net use Z: \\\\LAB-PC07\\Homework', 'net use')), 'z', /persistent/);
  fails('m13', without(SOL.m13, /^net use [ZW]:/).concat(LW('std12', 'net use Z: \\\\LAB-PC07\\Worksheets /persistent:yes', 'net use')), 'z', /แชร์ส่งงาน/);
  fails('m13', without(SOL.m13, /Y: \/delete/), 'y');
  fails('m13', SOL.m13.slice(0, -1), 'verify');
  assert.strictEqual(grade('m13', LW('std12', 'net use Z: \\\\192.168.20.57\\homework /persistent:yes', 'net use W: \\\\192.168.20.57\\worksheets', 'net use y: /delete', 'net view \\\\192.168.20.57', 'net use')).score, 10);
  // m14: NTFS only / share only / no (OI)(CI) / too much (Everyone) / no proof from the client
  fails('m14', without(SOL.m14, /^net share Reports(=| \/delete)/), 'sales', /Share permission/);
  fails('m14', without(SOL.m14, /^icacls D:\\Reports \/grant/), 'sales', /NTFS/);
  fails('m14', without(SOL.m14, /^icacls D:\\Reports \/grant/).concat(LW('srv', 'icacls D:\\Reports /grant Sales:M')), 'sales', /\(OI\)\(CI\)/);
  fails('m14', SOL.m14.concat(LW('srv', 'icacls D:\\Reports /grant Everyone:(OI)(CI)M')), 'least', /Everyone\/Users/);
  fails('m14', SOL.m14.slice(0, -2), 'proof', /echo test/);
  assert.strictEqual(grade('m14', LW('srv', 'net share Reports /d', 'net share Reports=D:\\Reports /grant:Everyone,CHANGE', 'icacls D:\\Reports /grant LAB-SRV\\Sales:(OI)(CI)(M)', 'net share Reports', 'icacls D:\\Reports', 'net user somsak').concat(LW('sales03', 'echo hi > R:\\new.txt'))).score, 10, 'share Everyone CHANGE + NTFS control is also correct');
  // m15: admin rights for staff, a missing member, no check
  fails('m15', SOL.m15.concat(LW('acc01', 'net localgroup Administrators malee /add', 'net localgroup Accounting')), 'least', /Administrators/);
  fails('m15', without(SOL.m15, /Accounting somchai malee/).concat(LW('acc01', 'net localgroup Accounting somchai /add', 'net localgroup Accounting')), 'group', /ไม่ได้อยู่ในกลุ่ม/);
  // m16: deleting kanya, removing itadmin, disabling an active employee, Guest left on
  fails('m16', SOL.m16.concat(LW('off02', 'net user kanya /delete', 'net localgroup Administrators')), 'kanya', /ห้ามลบ|เก็บไว้/);
  fails('m16', SOL.m16.concat(LW('off02', 'net localgroup Administrators itadmin /delete', 'net localgroup Administrators')), 'admins', /itadmin/);
  fails('m16', SOL.m16.concat(LW('off02', 'net user somchai /active:no', 'net localgroup Administrators')), 'admins');
  fails('m16', without(SOL.m16, /Guest/), 'guest');
  fails('m16', without(SOL.m16, /Remote Desktop/), 'kanya', /กลุ่มที่มีสิทธิ์พิเศษ/);
  // m17: usermod -G without -a, useradd without -m, no password
  fails('m17', without(SOL.m17, /usermod/).concat(LW('files', 'sudo usermod -G staff arthit', 'id arthit')), 'arthit', /developers/);
  fails('m17', without(SOL.m17, /useradd/).concat(LW('files', 'sudo useradd -G staff nida', 'sudo passwd nida', 'id nida')), 'nida', /home/);
  fails('m17', without(SOL.m17, /passwd/), 'nida', /รหัสผ่าน/);
  assert.strictEqual(grade('m17', LW('files', 'sudo adduser nida', 'sudo adduser nida staff', 'sudo gpasswd -a arthit staff', 'groups nida arthit', 'id arthit')).score, 10, 'adduser + gpasswd is also correct');
  // m18: 755, owner of the file changed, 2750 accepted
  fails('m18', SOL.m18.concat(LW('proj', 'sudo chmod 755 /srv/project', 'ls -ld /srv/project')), 'mode', /rwxr-xr-x/);
  fails('m18', SOL.m18.concat(LW('proj', 'sudo chown root /srv/project/budget.ods', 'sudo ls -l /srv/project')), 'file', /nida/);
  assert.strictEqual(grade('m18', SOL.m18.concat(LW('proj', 'sudo chmod g+s /srv/project', 'ls -ld /srv/project'))).details.tasks.mode, true);
  // m19: no (OI)(CI), Full instead of Modify, Administrators removed
  fails('m19', LW('fs01', 'icacls D:\\Projects /grant Accounting:M /remove Everyone', 'icacls D:\\Projects'), 'acct', /\(OI\)\(CI\)/);
  fails('m19', LW('fs01', 'icacls D:\\Projects /grant Accounting:(OI)(CI)F /remove Everyone', 'icacls D:\\Projects'), 'acct', /Full control/);
  fails('m19', SOL.m19.concat(LW('fs01', 'icacls D:\\Projects /remove Administrators', 'icacls D:\\Projects')), 'admin');
  fails('m19', LW('fs01', 'icacls D:\\Projects /grant Accounting:(OI)(CI)M /grant Users:(OI)(CI)RX /remove Everyone', 'icacls D:\\Projects'), 'everyone', /Users/);
  // m20: /remove on the child does nothing to inherited ACEs; Deny breaks Accounting; fixing only Reports; proof before the fix
  fails('m20', LW('fs02', 'icacls D:\\Finance\\Reports /remove Staff', 'icacls D:\\Finance\\Reports').concat(LW('hr05', 'del F:\\Reports\\q2-summary.xlsx')), 'staff', /สืบทอด/);
  fails('m20', LW('fs02', 'icacls D:\\Finance /deny Staff:(OI)(CI)(W,D)').concat(LW('hr05', 'del F:\\Reports\\q2-summary.xlsx')), 'acct', /Deny/);
  fails('m20', LW('fs02', 'icacls D:\\Finance\\Reports /inheritance:d', 'icacls D:\\Finance\\Reports /grant:r Staff:(OI)(CI)RX').concat(LW('hr05', 'del F:\\Reports\\q2-summary.xlsx')), 'staff');
  fails('m20', LW('hr05', 'del F:\\Reports\\q2-summary.xlsx').concat(LW('fs02', 'icacls D:\\Finance /grant:r Staff:(OI)(CI)RX')), 'proof');
  assert.strictEqual(grade('m20', LW('fs02', 'icacls D:\\Finance /remove:g Staff', 'icacls D:\\Finance /grant Staff:(OI)(CI)RX', 'net user malee', 'icacls D:\\Finance', 'icacls D:\\Finance\\Reports').concat(LW('hr05', 'echo x > F:\\Reports\\x.txt'))).score, 10, '/remove + /grant (and a refused write) is also correct');
  // a reset wipes earlier work
  const r = grade('m19', SOL.m19.concat([{ h: '*', c: '#reset' }]));
  assert.ok(Object.values(r.details.tasks).every(v => v === false));
});

it('tamper: forged fields, other hosts/users and huge logs cannot pass a 4.0 mission', () => {
  const forged = { answers: { share: 'yes' }, tasks: { share: true, perm: true, verify: true }, state: { shares: [{ name: 'Homework' }] }, topo: M('m12').start.topo, commandsUsed: ['net share Homework=C:\\Share\\Homework /grant:Students,CHANGE', 'net share'] };
  const r = g.grade('m12', Object.assign({}, forged, { mode: 'challenge' }));
  assert.ok(Object.values(r.details.tasks).every(v => v === false)); assert.ok(r.score < 1, String(r.score));
  // commands credited to a host that is not in the mission, or to the '*' pseudo host, are ignored
  assert.strictEqual(grade('m12', SOL.m12.map(e => ({ h: 'pc21', c: e.c }))).score, 0);
  assert.strictEqual(grade('m12', SOL.m12.map(e => ({ h: '*', c: e.c }))).score, 0);
  // the session user comes from the mission, not from the log: an admin command typed on the client PC is refused
  const r2 = grade('m14', SOL.m14.map(e => ({ h: 'sales03', c: e.c, u: 'Administrator' })));
  assert.strictEqual(r2.details.tasks.sales, false); assert.strictEqual(r2.details.tasks.proof, false);
  // malformed entries never throw; logs are capped at 300 commands
  assert.doesNotThrow(() => grade('m19', [{ h: 'fs01' }, { h: 'fs01', c: 'icacls' }, { h: 'fs01', c: 'icacls "' }, { h: 'fs01', c: 'net' }, { h: 'fs01', c: 'net share =' }, { h: 'fs01', c: 'icacls D:\\Projects /grant :M' }]));
  const pad = new Array(300).fill({ h: 'fs01', c: 'icacls D:\\Projects' });
  assert.strictEqual(grade('m19', pad.concat(SOL.m19)).details.tasks.acct, false, 'commands after the 300 cap are not replayed');
  assert.strictEqual(g.grade('m12', null).score, 0); assert.strictEqual(g.grade('m12', 'x').score, 0); assert.strictEqual(g.grade('m12', []).score, 0);
});


// ------------------------------------------------------------------ browser module (jsdom): outputs follow the same network state
async function browserTests() {
  let JSDOM;
  try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('  - jsdom not installed: browser checks skipped'); return; }
  const fs = require('fs');
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="r"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.eval(fs.readFileSync(path.join(__dirname, '../../public/js/sim/netsim.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(__dirname, '../../public/js/sim/terminal.js'), 'utf8'));
  const tests = [];
  const bit = (name, fn) => tests.push([name, fn]);
  const mk = (id, host, extra) => {
    const m = M(id); const dv = m.start.topo.devices.find(x => x.id === host);
    const h = m.start.hosts.find(x => x.id === host) || { id: host, os: dv.os === 'linux' ? 'linux' : 'windows', user: 'student' };
    const box = w.document.createElement('div'); w.document.body.appendChild(box);
    return w.NL_TERM.create(box, Object.assign({ net: w.NetSim.create(m.start.topo), hostId: h.id, os: h.os, user: h.user, netstat: m.start.netstat || null, instant: true }, extra || {}));
  };
  // output of one command without the echoed prompt line
  const out = async (t, cmd) => { t.clear(); await t.run(cmd); return t.getText().split('\n').slice(1).join('\n'); };

  bit('ipconfig / ip a / ip route / route print show the same IP, gateway and DNS as NetSim', async () => {
    const t = mk('m1', 'pc05'); const c = net('m1').config('pc05');
    const a = await out(t, 'ipconfig /all');
    assert.ok(a.includes('IPv4 Address. . . . . . . . . . . : ' + c.ip)); assert.ok(a.includes('Default Gateway . . . . . . . . . : ' + c.gateway));
    assert.ok(a.includes('DNS Servers . . . . . . . . . . . : ' + c.dns[0])); assert.ok(a.includes(c.mac));
    assert.ok(/^\s+0\.0\.0\.0\s+0\.0\.0\.0\s+192\.168\.2\.1\s+192\.168\.2\.25/m.test(await out(t, 'route print')));
    const l = mk('m4', 'lab09');
    assert.ok((await out(l, 'ip a')).includes('inet 172.16.9.20/26 brd 172.16.9.63 scope global eth0'));
    assert.ok((await out(l, 'ip route')).includes('default via 172.16.9.1 dev eth0 proto static'));
    assert.ok((await out(l, 'cat /etc/resolv.conf')).includes('nameserver 172.16.9.53'));
  });
  bit('ping -n / -c, arp -a / ip neigh list only recently contacted hosts (duplicate IP -> impostor MAC)', async () => {
    const t = mk('m9', 'adm01');
    assert.ok((await out(t, 'arp -a')).split('\n').every(x => !/dynamic/.test(x)), 'empty before any traffic');
    const p = await out(t, 'ping -n 2 192.168.10.50');
    assert.ok(/Reply from 192\.168\.10\.50: bytes=32 time<1ms TTL=128/.test(p)); assert.ok(/Sent = 2, Received = 2/.test(p));
    const a = await out(t, 'arp -a');
    assert.ok(/192\.168\.10\.50\s+b4-2e-99-5a-07-77\s+dynamic/.test(a)); assert.ok(!/00-80-77-3d-10-50/.test(a));
    assert.ok(/No ARP Entries Found/.test(await out(t, 'arp -a 192.168.10.99')));
    const l = mk('m4', 'lab09');
    assert.strictEqual((await out(l, 'ip neigh')).trim(), '');
    assert.ok(/64 bytes from 172\.16\.9\.30: icmp_seq=1 ttl=64/.test(await out(l, 'ping -c 1 172.16.9.30')));
    assert.ok(/172\.16\.9\.30 dev eth0 lladdr 52:54:00:9a:09:30 REACHABLE/.test(await out(l, 'ip neigh')));
    assert.ok(/Destination Host Unreachable/.test(await out(l, 'ping -c 2 172.16.9.44')));
  });
  bit('tracert / traceroute hops follow the routing tables', async () => {
    const t = mk('m5', 'b204');
    const tr = await out(t, 'tracert 8.8.8.8');
    const hops = tr.split('\n').filter(x => /^\s+\d+\s/.test(x));
    assert.ok(/10\.20\.4\.1\s*$/.test(hops[0]) && /10\.20\.255\.1\s*$/.test(hops[1]) && /8\.8\.8\.8/.test(hops[hops.length - 1]));
    assert.strictEqual(String(hops.length), g._keys.m5.hops); assert.ok(/Trace complete\./.test(tr));
    const l = mk('m8', 'srvb');
    assert.ok(/^\s*1\s+192\.168\.2\.1 /m.test(await out(l, 'traceroute 192.168.1.10')));
  });
  bit('netstat -ano / -an and ss -tulpn / -tan come from one socket table (PID, sudo, consistent peers)', async () => {
    const w1 = mk('m10', 'pcit');
    const ano = await out(w1, 'netstat -ano');
    assert.ok(/State\s+PID/.test(ano)); assert.ok(/TCP\s+10\.30\.0\.45:52114\s+10\.30\.0\.20:22\s+ESTABLISHED\s+7424/.test(ano));
    assert.ok(/UDP\s+0\.0\.0\.0:5353\s+\*:\*\s+2140/.test(ano));
    assert.ok(!/PID/.test(await out(w1, 'netstat -an')));
    assert.ok(/ESTABLISHED/.test(await out(w1, 'netstat -n')) && !/LISTENING/.test(await out(w1, 'netstat -n')));
    assert.ok(/requires elevation/.test(await out(w1, 'netstat -b')));
    const f = (await out(w1, 'netstat -ano | findstr :22')).split('\n').filter(x => x.trim());
    assert.ok(f.length === 1 && /7424/.test(f[0]), f.join('|'));
    const l = mk('m10', 'srvweb');
    const u = await out(l, 'ss -tulpn');
    assert.ok(/tcp\s+LISTEN\s+0\s+511\s+127\.0\.0\.1:8080\s+0\.0\.0\.0:\*/.test(u), u); assert.ok(!/users:/.test(u)); assert.ok(/sudo/.test(u));
    const su = await out(l, 'sudo ss -tulpn');
    assert.ok(/127\.0\.0\.1:8080 .*users:\(\("node",pid=2310,fd=\d+\)\)/.test(su), su);
    assert.ok(/udp\s+UNCONN/.test(su)); assert.ok(!/ESTAB/.test(su));
    const tan = await out(l, 'ss -tan');
    assert.ok(/^State\s+Recv-Q/m.test(tan), 'single netid: no Netid column'); assert.ok(/ESTAB\s+0\s+0\s+10\.30\.0\.20:22\s+10\.30\.0\.45:52114/.test(tan));
    assert.ok(/LISTEN .*:ssh/.test(await out(l, 'ss -tl')), 'service names without -n');
    assert.ok(/apt install net-tools/.test(await out(l, 'netstat -tulpn')));
    // default table for a scenario without socket data: services decide the listening ports
    const d = mk('m4', 'moodle');
    assert.ok(/0\.0\.0\.0:80\b/.test(await out(d, 'ss -tln')));
  });
  bit('route add / ip route add change the host: ping goes from unreachable to replies, outputs stay consistent', async () => {
    const l = mk('m11', 'srvmon');
    assert.ok(/ping: connect: Network is unreachable/.test(await out(l, 'ping -c 4 8.8.8.8')));
    assert.ok(!/default/.test(await out(l, 'ip route')));
    assert.ok(/Nexthop has invalid gateway/.test(await out(l, 'ip route add default via 10.60.0.1')));
    assert.strictEqual((await out(l, 'ip route add default via 10.50.0.1')).trim(), '');
    assert.ok(/RTNETLINK answers: File exists/.test(await out(l, 'ip route add default via 10.50.0.1')));
    assert.ok(/^default via 10\.50\.0\.1 dev eth0 proto static/m.test(await out(l, 'ip route')));
    assert.ok(/64 bytes from 8\.8\.8\.8: icmp_seq=1 ttl=117/.test(await out(l, 'ping -c 2 8.8.8.8')));
    assert.ok(/^\s*1\s+10\.50\.0\.1 /m.test(await out(l, 'traceroute 8.8.8.8')));
    const u = mk('m4', 'lab09');
    assert.ok(/Operation not permitted/.test(await out(u, 'ip route add default via 172.16.9.1')));
    const w2 = mk('m11', 'pcnoc');
    assert.ok(/requires elevation/.test(await out(w2, 'route add 0.0.0.0 mask 0.0.0.0 10.50.0.1')));
    const adm = mk('m6', 'app01');
    assert.ok(/The route addition failed: The object already exists/.test(await out(adm, 'route add 0.0.0.0 mask 0.0.0.0 192.168.30.1')));
    assert.ok(/OK!/.test(await out(adm, 'route delete 0.0.0.0')));
    assert.ok(/General failure/.test(await out(adm, 'ping -n 1 8.8.8.8')));
    assert.ok(!/^\s+0\.0\.0\.0\s+0\.0\.0\.0/m.test(await out(adm, 'route print')));
    assert.ok(/OK!/.test(await out(adm, 'route add 0.0.0.0 mask 0.0.0.0 192.168.30.1')));
    assert.ok(/Default Gateway . . . . . . . . . : 192\.168\.30\.1/.test(await out(adm, 'ipconfig')));
  });
  bit('unknown commands, /? and --help', async () => {
    const t = mk('m1', 'pc05'), l = mk('m4', 'lab09');
    assert.ok((await out(t, 'xyz')).includes("'xyz' is not recognized as an internal or external command,"));
    assert.ok((await out(l, 'xyz')).includes('xyz: command not found'));
    assert.ok(/บน Windows ใช้ netstat -ano/.test(await out(t, 'ss -tulpn')));
    for (const c of ['ping /?', 'tracert /?', 'ipconfig /?', 'arp /?', 'netstat /?', 'route /?', 'nslookup /?']) assert.ok(/Usage|USAGE|Displays|Manipulates|ROUTE/.test(await out(t, c)), c);
    assert.ok(/not supported by the help utility.  Try "ping \/\?"/.test(await out(t, 'help ping')));
    for (const c of ['ping --help', 'traceroute --help', 'ss --help', 'ip help', 'dig -h']) assert.ok(/Usage/.test(await out(l, c)), c);
    assert.ok(/invalid option -- 'z'/.test(await out(l, 'ss -z')));
  });
  bit('mission UI: guided steps complete from typed commands, highlight + explanation, submit sends mode + commandLog (capped 7/10)', async () => {
    const root = w.document.getElementById('r');
    let sent = null;
    const ctx = { missions: g.missions, done: {}, user: null, toast() {},
      submit: async (id, payload) => { sent = { id, payload: JSON.parse(JSON.stringify(payload)) }; return Object.assign(g.grade(id, sent.payload), { saved: false }); } };
    const inst = w.NL_SIMS.terminal.mount(root, ctx);
    const q = s2 => root.querySelector(s2);
    assert.strictEqual(q('.nls-terminal-mode[data-mode="challenge"]').getAttribute('aria-checked'), 'true', 'challenge by default (same scoring as before 2.6)');
    q('.nls-terminal-mode[data-mode="guided"]').click(); await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(q('.nls-terminal-mode[data-mode="guided"]').getAttribute('aria-checked'), 'true', 'guided is opt-in');
    assert.ok(!q('.nls-terminal-next').hidden && !q('.nls-terminal-stepcard').hidden);
    q('.nls-terminal-nfill').click();
    assert.strictEqual(q('.nls-terminal-in').value, 'ipconfig');
    q('.nls-terminal-run').click(); await new Promise(r => setTimeout(r, 30));
    assert.ok(root.querySelectorAll('.nls-terminal-mark').length >= 3, 'IPv4/Mask/Gateway highlighted');
    assert.ok(/คำอธิบาย \(ขั้นที่ 1\)/.test(q('.nls-terminal-note').textContent));
    assert.ok(/ขั้นที่ 2\/2/.test(q('.nls-terminal-next').textContent));
    // typing via the quick chip
    Array.from(root.querySelectorAll('.nls-terminal-qb')).find(b => b.dataset.cmd === 'ipconfig /all').click(); await new Promise(r => setTimeout(r, 30));
    assert.ok(/ทำครบทุกขั้นตอนแล้ว/.test(q('.nls-terminal-next').textContent));
    const ans = g._keys.m1;
    root.querySelectorAll('.nls-terminal-q').forEach(i => { i.value = ans[i.dataset.q]; i.dispatchEvent(new w.Event('input')); });
    q('.nls-terminal-submit').click(); await new Promise(r => setTimeout(r, 30));
    assert.strictEqual(sent.payload.mode, 'guided');
    assert.deepStrictEqual(sent.payload.commandLog.map(e => e.h + ':' + e.c), ['pc05:ipconfig', 'pc05:ipconfig /all']);
    assert.ok(/คะแนน 7\/10/.test(q('.nls-terminal-result').textContent)); assert.ok(/โหมดแนะนำ/.test(q('.nls-terminal-modebadge').textContent));
    // switch to challenge: asks first, then resets the attempt
    q('.nls-terminal-mode[data-mode="challenge"]').click();
    assert.ok(!q('.nls-terminal-confirm').hidden);
    q('.nls-terminal-cyes').click();
    assert.strictEqual(q('.nls-terminal-mode[data-mode="challenge"]').getAttribute('aria-checked'), 'true');
    assert.ok(q('.nls-terminal-next').hidden && q('.nls-terminal-stepcard').hidden && !q('.nls-terminal-goal').hidden);
    assert.ok(Array.from(root.querySelectorAll('.nls-terminal-q')).every(i => i.value === ''));
    const inp = q('.nls-terminal-in');
    inp.value = 'ipconfig /all'; inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await new Promise(r => setTimeout(r, 30));
    assert.strictEqual(root.querySelectorAll('.nls-terminal-mark').length, 0, 'no highlights in challenge mode');
    assert.ok(!q('.nls-terminal-note'), 'no explanations in challenge mode');
    root.querySelectorAll('.nls-terminal-q').forEach(i => { i.value = ans[i.dataset.q]; i.dispatchEvent(new w.Event('input')); });
    q('.nls-terminal-submit').click(); await new Promise(r => setTimeout(r, 30));
    assert.strictEqual(sent.payload.mode, 'challenge'); assert.deepStrictEqual(sent.payload.commandLog, [{ h: 'pc05', c: 'ipconfig /all' }]);
    assert.ok(/คะแนน 10\/10/.test(q('.nls-terminal-result').textContent));
    inst.destroy();
    assert.strictEqual(root.children.length, 0);
  });
  bit('4.0: the browser terminal and the grader replay reach the same machine state for every new mission', async () => {
    const strip = x => JSON.parse(JSON.stringify(x, (k, v) => ['pwSet', 'mtime', 'chg', 'ctime'].includes(k) ? undefined : v));
    for (const id of Object.keys(SOL)) {
      const m = M(id); const hosts = m.start.hosts;
      const t = mk(id, hosts[0].id);
      let cur = hosts[0].id;
      for (const e of SOL[id]) {
        if (e.h !== cur) { const h = hosts.find(x => x.id === e.h); t.setHost(h.id, h.os, h.user); cur = e.h; }
        await t.run(e.c);
      }
      const st = g._replay(g._scenarios[id], SOL[id]);
      const bySys = net => strip(net.topo.devices.filter(d => d.sys).map(d => [d.id, d.sys]));
      assert.deepStrictEqual(bySys(t.getNet()), bySys(st.net), id + ': browser state differs from the grader replay');
    }
  });
  bit('4.0: outputs, elevated vs normal prompt, cd changes the prompt, sudo asks once, help lists the new commands', async () => {
    const a = mk('m19', 'fs01');
    assert.ok(/^Administrator: Command Prompt/.test(a.el.querySelector('.nls-terminal-title').textContent));
    assert.strictEqual(a.el.querySelector('.nls-terminal-prompt').textContent, 'C:\\Windows\\system32>');
    assert.ok(/processed file: D:\\Projects/.test(await out(a, 'icacls D:\\Projects /grant Accounting:(OI)(CI)M')));
    await a.run('cd /d D:\\Projects');
    assert.strictEqual(a.el.querySelector('.nls-terminal-prompt').textContent, 'D:\\Projects>');
    assert.ok(/FS-01\\Accounting:\(OI\)\(CI\)\(M\)/.test(await out(a, 'icacls . | findstr Accounting')));
    const help = await out(a, 'help');
    for (const c of ['net user', 'net localgroup', 'net share', 'net use', 'net view', 'icacls']) assert.ok(help.includes(c), 'help: ' + c);
    const u = mk('m13', 'std12');
    assert.strictEqual(u.el.querySelector('.nls-terminal-prompt').textContent, 'C:\\Users\\student>');
    assert.ok(/System error 5 has occurred\.\s+Access is denied\./.test(await out(u, 'net user hacker P@ss1 /add')));
    assert.ok(/The command completed successfully\./.test(await out(u, 'net use Z: \\\\LAB-PC07\\Homework')));
    assert.ok(/'chmod' is not recognized[\s\S]*icacls/.test(await out(u, 'chmod 750 x')));
    const l = mk('m18', 'proj');
    const first = await out(l, 'sudo chown root:staff /srv/project');
    assert.ok(/\[sudo\] password for student:/.test(first));
    assert.ok(!/\[sudo\] password/.test(await out(l, 'sudo chmod 750 /srv/project')), 'sudo remembers the password');
    assert.ok(/^drwxr-x--- 2 root staff 4096 /m.test(await out(l, 'ls -ld /srv/project')));
    await l.run('cd /srv');
    assert.strictEqual(l.el.querySelector('.nls-terminal-prompt').textContent, 'student@srv-proj:/srv$ ');
    await l.run('cd');
    assert.strictEqual(l.el.querySelector('.nls-terminal-prompt').textContent, 'student@srv-proj:~$ ');
    assert.ok(/useradd -m -G/.test(await out(l, 'help')));
    assert.ok(/^nida : nida staff$/m.test(await out(l, 'groups nida | grep staff')));
    assert.ok(/net: command not found[\s\S]*useradd/.test(await out(l, 'net user')));
  });
  bit('4.0 mission UI: deep link, task list instead of questions, mission quick chips, check sends the log, 10/10 + tasks marked', async () => {
    const root = w.document.createElement('div'); w.document.body.appendChild(root);
    let sent = null;
    const ctx = { missions: g.missions, done: {}, initial: 'm12', toast() {},
      submit: async (id, payload) => { sent = { id, payload: JSON.parse(JSON.stringify(payload)) }; return Object.assign(g.grade(id, sent.payload), { saved: false }); } };
    const inst = w.NL_SIMS.terminal.mount(root, ctx);
    const q = s2 => root.querySelector(s2);
    assert.ok(/สร้างแชร์ Homework/.test(q('.nls-terminal-card h3').textContent), 'deep link opened m12');
    assert.strictEqual(root.querySelectorAll('.nls-terminal-q').length, 0, 'no answer boxes');
    assert.strictEqual(root.querySelectorAll('.nls-terminal-tasks li').length, 3);
    assert.ok(/ตรวจงาน \(โหมดท้าทาย\)/.test(q('.nls-terminal-submit').textContent));
    const chips = Array.from(root.querySelectorAll('.nls-terminal-qb')).map(b => b.dataset.cmd);
    assert.ok(chips.includes('net share') && !chips.includes('ipconfig'), chips.join('|'));
    assert.ok(!chips.some(c => /grant/i.test(c)), 'quick chips must not contain the answer');
    const inp = q('.nls-terminal-in');
    for (const c of ['net share Homework=C:\\Share\\Homework /grant:Students,CHANGE', 'net share Homework']) {
      inp.value = c; inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await new Promise(r => setTimeout(r, 30));
    }
    assert.ok(/Permission\s+LAB-PC07\\Students, CHANGE/.test(root.querySelector('.nls-terminal-out').textContent));
    for (const c of ['icacls C:\\Share\\Homework', 'net share']) { Array.from(root.querySelectorAll('.nls-terminal-qb')).find(x => x.dataset.cmd === c).click(); await new Promise(r => setTimeout(r, 30)); }
    q('.nls-terminal-submit').click(); await new Promise(r => setTimeout(r, 30));
    assert.strictEqual(sent.id, 'm12'); assert.deepStrictEqual(sent.payload.answers, {});
    assert.deepStrictEqual(sent.payload.commandLog.map(e => e.c), ['net share Homework=C:\\Share\\Homework /grant:Students,CHANGE', 'net share Homework', 'icacls C:\\Share\\Homework', 'net share']);
    assert.ok(/คะแนน 10\/10/.test(q('.nls-terminal-result').textContent), q('.nls-terminal-result').textContent);
    assert.ok(Array.from(root.querySelectorAll('.nls-terminal-tstat')).every(s => /ผ่าน ✓/.test(s.textContent)));
    // a mission with two hosts and a facts table (m14)
    Array.from(root.querySelectorAll('.nls-terminal-mbtn')).find(b => /บันทึกไฟล์ไม่ได้/.test(b.textContent)).click();
    assert.ok(/ความต้องการของแชร์ Reports/.test(q('.nls-terminal-facts').textContent));
    assert.strictEqual(root.querySelectorAll('.nls-terminal-hosts button').length, 2);
    inst.destroy();
  });
  bit('6.x guided mode of an Independent lab (m19): fixing steps show the goal only, no literal command; prompt colours >= 4.5:1', async () => {
    const root = w.document.createElement('div'); w.document.body.appendChild(root);
    const inst = w.NL_SIMS.terminal.mount(root, { missions: g.missions, done: {}, initial: 'm19', toast() {}, submit: async () => ({}) });
    const q = s2 => root.querySelector(s2);
    q('.nls-terminal-mode[data-mode="guided"]').click(); await new Promise(r => setTimeout(r, 10));
    const steps = q('.nls-terminal-steps').textContent;
    assert.ok(!/grant Accounting|remove Everyone/.test(steps), 'no literal fix command in the step list');
    assert.strictEqual(root.querySelectorAll('.nls-terminal-steps .nls-terminal-self').length, 2);
    assert.ok(/เลือกคำสั่งเอง/.test(q('.nls-terminal-mode[data-mode="guided"]').textContent));
    // finish step 1 so the next box shows a self step without a fill button
    const inp = q('.nls-terminal-in'); inp.value = 'icacls D:\\Projects'; inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await new Promise(r => setTimeout(r, 30));
    assert.ok(!q('.nls-terminal-nfill') && q('.nls-terminal-next .nls-terminal-self'));
    inst.destroy();
    // contrast of the Linux prompt user/path colours on the terminal background (both themes use a dark terminal)
    const css = w.document.getElementById('nls-terminal-css') ? w.document.getElementById('nls-terminal-css').textContent : require('fs').readFileSync(path.join(__dirname, '../../public/js/sim/terminal.js'), 'utf8');
    const tok = n => (new RegExp('--nls-terminal-' + n + ':var\\(--[a-z-]+,(#[0-9A-Fa-f]{6})\\)').exec(css) || [])[1];
    assert.ok(/\.nls-terminal-pu\{color:var\(--nls-terminal-tpu\)/.test(css) && /\.nls-terminal-pp\{color:var\(--nls-terminal-tpp\)/.test(css));
    const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    for (const bg of ['#0F1A24', '#0A1118']) for (const n of ['tpu', 'tpp']) assert.ok(cr(tok(n), bg) >= 4.5, n + ' on ' + bg + ' = ' + cr(tok(n), bg).toFixed(2));
  });
  for (const [name, fn] of tests) {
    try { await fn(); passed++; console.log('  ✓ [browser]', name); }
    catch (e) { failed++; console.log('  ✗ [browser]', name, '\n     ', (e && e.stack || String(e)).split('\n').slice(0, 6).join('\n      ')); }
  }
  w.close();
}

browserTests().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
});
