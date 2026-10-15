'use strict';
/* 2.8 skill-based assessment. Each skill is judged from EVIDENCE of real work, never from page visits:
     hands-on  = simulator missions (graded on the server from the network state / commands / actions) and timed lab rooms
     knowledge = question-bank answers (practice + exams, latest answer per question)
     3.0 Phase 5: evidence a teacher recorded in class (skill_observations, level 1-4) counts as hands-on evidence too;
     every item keeps its source, title, date and kind so the Skills Portfolio can list it
   Levels (shown with the reasons that produced them):
     Beginner    any evidence
     Developing  >= 50 % overall AND at least 1 hands-on item >= 70 %
     Proficient  >= 70 % overall AND at least 2 hands-on items fully passed (>= 90 %) AND knowledge >= 60 % when there is knowledge evidence
     Advanced    Proficient AND a hard hands-on item (or the capstone) passed >= 90 % AND >= 80 % overall */
const db = require('./db');
const bank = require('./bank');

const SKILLS = [
  { id: 'design', name: 'Network Design', th: 'ออกแบบเครือข่าย' },
  { id: 'cabling', name: 'Cabling', th: 'สายสัญญาณและการเข้าหัว' },
  { id: 'ipconfig', name: 'IP Configuration', th: 'ตั้งค่า IP' },
  { id: 'subnetting', name: 'Subnetting', th: 'คำนวณ Subnet' },
  { id: 'switching', name: 'Switching', th: 'Switching และ LAN' },
  { id: 'routing', name: 'Routing', th: 'Routing และ Gateway' },
  { id: 'wireless', name: 'Wireless Networking', th: 'เครือข่ายไร้สาย' },
  { id: 'terminal', name: 'Terminal Usage', th: 'ใช้คำสั่งเครือข่าย' },
  { id: 'security', name: 'Security Configuration', th: 'ความปลอดภัย' },
  { id: 'troubleshooting', name: 'Troubleshooting', th: 'วิเคราะห์และแก้ปัญหา' }
];
/* simulator missions -> skills (first skill = main). Missions not listed count for nothing. */
const SIM_MAP = {
  topology: { t1: ['switching', 'design'], t2: ['switching', 'design'], t3: ['routing', 'ipconfig'], t4: ['routing', 'ipconfig'], t5: ['ipconfig'], t6: ['wireless'], t7: ['ipconfig', 'routing'], t8: ['switching', 'routing', 'ipconfig'], t9: ['design', 'routing', 'subnetting', 'wireless', 'security'], t10: ['routing'], t11: ['routing', 'security'], t12: ['security'], t13: ['security', 'troubleshooting'],
    t14: ['design', 'switching'], t15: ['design', 'routing'], t16: ['switching', 'design'], t17: ['design', 'routing', 'wireless'], t18: ['troubleshooting', 'cabling'], t19: ['ipconfig', 'subnetting'] },
  subnet: { s1: ['subnetting'], s2: ['subnetting'], s3: ['subnetting'], s4: ['subnetting'], s5: ['subnetting', 'ipconfig'], s6: ['subnetting'], s7: ['subnetting', 'design'], s8: ['subnetting'], s9: ['subnetting', 'design'], s10: ['subnetting', 'routing'] },
  crimp: { c1: ['cabling'], c2: ['cabling'], c3: ['cabling'], c4: ['cabling', 'troubleshooting'], c5: ['cabling'], c6: ['cabling'], c7: ['cabling', 'troubleshooting'] },
  terminal: { m1: ['terminal', 'ipconfig'], m2: ['terminal', 'ipconfig'], m3: ['terminal', 'switching'], m4: ['terminal'], m5: ['terminal', 'routing'], m6: ['terminal', 'security'], m7: ['terminal', 'troubleshooting'], m8: ['terminal', 'routing'], m9: ['terminal', 'troubleshooting'], m10: ['terminal', 'security'], m11: ['terminal', 'routing'],
    m12: ['security', 'terminal'], m13: ['terminal', 'security'], m14: ['troubleshooting', 'security', 'terminal'], m15: ['security', 'terminal'], m16: ['security', 'troubleshooting'], m17: ['security', 'terminal'], m18: ['security', 'terminal'], m19: ['security', 'terminal'], m20: ['troubleshooting', 'security'] },
  switching: { sw1: ['switching'], sw2: ['switching', 'ipconfig'], sw3: ['switching', 'design'], sw4: ['switching'], sw5: ['switching', 'design'], sw6: ['switching', 'troubleshooting'], sw7: ['switching'] },
  ipv6: { v1: ['ipconfig', 'subnetting'], v2: ['ipconfig'], v3: ['ipconfig', 'routing'], v4: ['routing', 'ipconfig'], v5: ['troubleshooting', 'ipconfig'] },
  packets: { p1: ['troubleshooting'], p2: ['troubleshooting'], p3: ['ipconfig', 'troubleshooting'], p4: ['ipconfig'], p5: ['troubleshooting'], p6: ['troubleshooting'] },
  netops: { o1: ['troubleshooting'], o2: ['troubleshooting'], o3: ['troubleshooting'], a1: ['switching', 'terminal'], a2: ['terminal', 'troubleshooting'] },
  wifi: { wf1: ['wireless'], wf2: ['wireless', 'design'], wf3: ['wireless', 'design'], wf4: ['wireless', 'design'], wf5: ['wireless', 'troubleshooting'], wf6: ['wireless', 'security'] },
  troubleshoot: { x1: ['troubleshooting', 'cabling'], x2: ['troubleshooting', 'wireless'], x3: ['troubleshooting', 'routing'], x4: ['troubleshooting', 'subnetting'], x5: ['troubleshooting', 'ipconfig'], x6: ['troubleshooting', 'security'], x7: ['troubleshooting', 'ipconfig'], x8: ['troubleshooting', 'routing'], x9: ['troubleshooting', 'ipconfig'], x10: ['troubleshooting', 'ipconfig'], x11: ['troubleshooting', 'security'], x12: ['troubleshooting', 'routing'], x13: ['troubleshooting', 'subnetting'], x14: ['troubleshooting'] }
};
/* lab rooms (timed, graded per task) */
const ROOM_MAP = { r1: ['design'], r2: ['cabling'], r5: ['subnetting', 'ipconfig'], r6: ['cabling', 'switching'], r8: ['wireless'], r9: ['ipconfig'], r10: ['troubleshooting', 'design'], r11: ['security'], r12: ['security'],
  w1: ['design'], w2: ['design'], w3: ['ipconfig'], w4: ['switching'], w5: ['cabling'], w6: ['wireless'], w7: ['wireless', 'security'], w8: ['ipconfig'], w9: ['ipconfig'], w13: ['design', 'terminal'], w14: ['troubleshooting', 'terminal'], w10: ['ipconfig'], w15: ['security'], w16: ['security'], w17: ['security'], w18: ['security'] };   // w1-w4, w10, w15: 3.0 P4 added hands-on tasks
/* question bank -> skills: by type first, then by unit */
function bankSkills(q) {
  const s = new Set();
  if (q.type === 'subnet') s.add('subnetting');
  if (q.type === 'command') s.add('terminal');
  const tags = (q.tags || []).join(' ').toLowerCase();
  if (/subnet|cidr|vlsm|prefix/.test(tags)) s.add('subnetting');
  if (/rout|gateway|nat/.test(tags)) s.add('routing');
  if (/dhcp|dns|ip-?address|ipconfig|apipa/.test(tags)) s.add('ipconfig');
  if (/firewall|permission|ntfs|security|malware|encrypt|wpa/.test(tags)) s.add('security');
  if (/troubleshoot|ping|tracert|diagnos/.test(tags)) s.add('troubleshooting');
  const byUnit = { 1: 'design', 2: 'cabling', 3: 'ipconfig', 4: 'cabling', 5: 'wireless', 6: 'ipconfig', 7: 'terminal', 8: 'troubleshooting', 9: 'security', 10: 'security' };
  if (!s.size && byUnit[q.unit]) s.add(byUnit[q.unit]);
  return [...s];
}
const LEVELS = ['Beginner', 'Developing', 'Proficient', 'Advanced'];
const LEVEL_TH = { Beginner: 'เริ่มต้น', Developing: 'กำลังพัฒนา', Proficient: 'ทำได้ดี', Advanced: 'เชี่ยวชาญ' };

async function evidence(userIds) {
  const { MODS } = require('./sims-api');
  const { LABS, ACTIVE } = require('./content');
  const per = new Map(userIds.map(u => [u, Object.fromEntries(SKILLS.map(s => [s.id, { hands: [], know: [] }]))]));
  const add = (u, skills, kind, item) => { const m = per.get(u); if (m) skills.forEach(s => m[s] && m[s][kind].push(item)); };
  for (const r of (await db.q('SELECT user_id, sim, mission, best, max, attempts, updated_at FROM sim_results WHERE user_id = ANY($1)', [userIds])).rows) {
    const sk = (SIM_MAP[r.sim] || {})[r.mission]; if (!sk) continue;
    const ms = MODS[r.sim] && MODS[r.sim].missions.find(m => m.id === r.mission);
    add(r.user_id, sk, 'hands', { kind: 'sim', src: `${r.sim}:${r.mission}`, title: ms ? ms.title : r.mission, sim: MODS[r.sim] ? MODS[r.sim].title : r.sim, level: ms ? ms.level : null,
      pct: r.max ? r.best / r.max : 0, best: r.best, max: r.max, attempts: r.attempts, at: +r.updated_at, hard: !!(ms && (ms.level === 'hard' || ms.review)) });
  }
  /* lab rooms: share of tasks solved, only for rooms that were started */
  const tasks = (await db.q('SELECT user_id, lab_id, count(*) FILTER (WHERE solved)::int s, max(solved_at) AS at FROM task_progress WHERE user_id = ANY($1) AND task_key = ANY($2) GROUP BY user_id, lab_id', [userIds, [...ACTIVE]])).rows;
  for (const t of tasks) {
    const sk = ROOM_MAP[t.lab_id]; const lab = LABS.get(t.lab_id); if (!sk || !lab) continue;
    const n = require('./content').labKeys(lab).length || 1;
    add(t.user_id, sk, 'hands', { kind: 'lab', src: 'lab:' + t.lab_id, title: (lab.label ? lab.label + ' · ' : '') + lab.title, pct: Math.min(1, t.s / n), solved: t.s, total: n, at: t.at ? +t.at : null, hard: !!lab.challengeRoom });
  }
  /* 3.0 P5: evidence the teacher observed in class (real equipment, oral checks) */
  const { OBS_LEVELS } = require('../content/rubrics');
  for (const o of (await db.q(`SELECT o.id, o.user_id, o.skill, o.level, o.title, o.note, o.week, o.observed_on, t.display_name AS teacher FROM skill_observations o
      LEFT JOIN users t ON t.id=o.teacher_id WHERE o.user_id = ANY($1) ORDER BY o.observed_on, o.id`, [userIds])).rows) {
    const L = OBS_LEVELS.find(x => x.level === o.level); if (!L) continue;
    add(o.user_id, [o.skill], 'hands', { kind: 'teacher', src: 'obs:' + o.id, id: o.id, title: o.title, note: o.note, week: o.week, teacher: o.teacher, obsLevel: o.level,
      pct: L.pct, at: +new Date(o.observed_on), hard: o.level === 4 });
  }
  /* bank: latest answer per question */
  const last = new Map();
  (await db.q('SELECT user_id, qid, score, created_at FROM bank_log WHERE user_id = ANY($1) ORDER BY created_at', [userIds])).rows.forEach(r => last.set(r.user_id + '|' + r.qid, { u: r.user_id, id: r.qid, s: Number(r.score), t: +r.created_at }));
  (await db.q('SELECT user_id, results, submitted_at FROM exam_attempts WHERE submitted_at IS NOT NULL AND user_id = ANY($1)', [userIds])).rows
    .forEach(a => (a.results || []).forEach(x => { const k = a.user_id + '|' + x.id, p = last.get(k); if (!p || p.t < +a.submitted_at) last.set(k, { u: a.user_id, id: x.id, s: Number(x.score) || 0, t: +a.submitted_at }); }));
  for (const v of last.values()) { const q = bank.Q.get(v.id); if (q) add(v.u, bankSkills(q), 'know', { pct: v.s }); }
  return per;
}
function judge(ev) {
  const hands = ev.hands, know = ev.know;
  if (!hands.length && !know.length) return { level: null, reasons: ['ยังไม่มีหลักฐาน: ทำภารกิจในห้องจำลองหรือภารกิจท้าทายที่เกี่ยวข้อง'] };
  const avg = a => a.length ? a.reduce((x, y) => x + y.pct, 0) / a.length : null;
  const h = avg(hands), k = avg(know);
  const overall = h != null && k != null ? h * 0.7 + k * 0.3 : (h != null ? h : k);   // hands-on weighs more
  const passed70 = hands.filter(x => x.pct >= 0.7).length, full = hands.filter(x => x.pct >= 0.9).length, hardFull = hands.filter(x => x.pct >= 0.9 && x.hard).length;
  let level = 'Beginner';
  if (overall >= 0.5 && passed70 >= 1) level = 'Developing';
  if (level === 'Developing' && overall >= 0.7 && full >= 2 && (k == null || k >= 0.6)) level = 'Proficient';
  if (level === 'Proficient' && hardFull >= 1 && overall >= 0.8) level = 'Advanced';
  const obs = hands.filter(x => x.kind === 'teacher').length;
  const reasons = [`ภารกิจลงมือทำ ${hands.length} รายการ (ผ่านเต็ม ${full}${hardFull ? `, ระดับยาก ${hardFull}` : ''}${obs ? `, ครูบันทึกจากการปฏิบัติจริง ${obs}` : ''})`, know.length ? `ข้อสอบ ${know.length} ข้อ ถูก ${Math.round(k * 100)}%` : 'ยังไม่มีผลข้อสอบของทักษะนี้'];
  const next = { Beginner: 'ทำภารกิจลงมือทำของทักษะนี้ให้ได้อย่างน้อย 70% สักภารกิจ', Developing: 'ผ่านภารกิจลงมือทำเต็มอย่างน้อย 2 ภารกิจ และรักษาคะแนนรวม 70% ขึ้นไป', Proficient: 'ผ่านภารกิจระดับยากหรือโครงงานให้ได้ 90% ขึ้นไป', Advanced: null }[level];
  return { level, pct: Math.round(overall * 100), hands: hands.length, handsFull: full, know: know.length, reasons, next, best: hands.slice().sort((a, b) => b.pct - a.pct).slice(0, 3).map(x => ({ title: x.title, pct: Math.round(x.pct * 100) })) };
}
async function skillsOf(userIds) {
  const ev = await evidence(userIds);
  const out = {};
  for (const [u, m] of ev) out[u] = SKILLS.map(s => ({ ...s, ...judge(m[s.id]) }));
  return out;
}
module.exports = { SKILLS, SIM_MAP, ROOM_MAP, LEVELS, LEVEL_TH, skillsOf, judge, bankSkills, evidence };
