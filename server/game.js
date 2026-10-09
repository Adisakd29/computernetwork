'use strict';
/* Phase 5: XP, levels, streaks, badges, weekly challenges, mastery analytics.
   Everything is derived from server-graded tables, so nothing the browser sends can raise XP directly. */
const db = require('./db');
const bank = require('./bank');
const { LABS, labKeys } = require('./content');
const { LESSONS } = require('./lessons');

const TZ = process.env.APP_TZ || 'Asia/Bangkok';
const DAY_MS = 86400e3;

/* ---------- levels ---------- */
const LEVEL_TITLES = ['มือใหม่หัดต่อสาย', 'ผู้ช่วยช่างเครือข่าย', 'ช่างเข้าหัวสาย', 'ผู้ดูแล LAN', 'นักแก้ปัญหาเครือข่าย',
  'ผู้ดูแลระบบเครือข่าย', 'นักออกแบบเครือข่าย', 'ผู้เชี่ยวชาญ Subnet', 'วิศวกรเครือข่ายฝึกหัด', 'ผู้เชี่ยวชาญเครือข่าย'];
const levelStart = L => 50 * (L - 1) * L;               // L2 = 100, L3 = 300, L4 = 600, L5 = 1000 ...
function levelOf(xp) {
  let L = 1; while (xp >= levelStart(L + 1)) L++;
  return { level: L, title: LEVEL_TITLES[Math.min(L, LEVEL_TITLES.length) - 1], from: levelStart(L), to: levelStart(L + 1) };
}

/* ---------- XP rules (shown to students on the progress page) ---------- */
const XP_RULES = [
  ['labs', 'แล็บและห้องฝึก', 'คะแนนที่ได้จากแต่ละข้อ (สูงสุด 10 XP ต่อข้อ)'],
  ['lessons', 'อ่านเนื้อหาและแบบฝึกหัดในบทเรียน', 'อ่านหัวข้อละ 2 XP, ทำแบบฝึกหัดถูกข้อละ 5 XP'],
  ['quizzes', 'แบบทดสอบก่อน/หลังเรียน', 'ก่อนเรียน 10 XP, หลังเรียน 10 XP + สูงสุด 30 XP ตามคะแนน'],
  ['sims', 'ห้องปฏิบัติการจำลอง', 'คะแนนดีที่สุดของแต่ละภารกิจ'],
  ['practice', 'ฝึกทำข้อสอบ', 'ข้อที่เคยตอบถูกครั้งแรก ข้อละ 3 XP (ทำข้อเดิมซ้ำไม่ได้ XP เพิ่ม)'],
  ['exams', 'การสอบ', 'สูงสุด 50 XP ต่อการสอบตามร้อยละที่ได้'],
  ['challenges', 'ภารกิจประจำสัปดาห์', 'เป้าหมายละ 20 XP ทำครบทุกเป้าหมายรับเพิ่ม 40 XP']
];

const ids = a => (Array.isArray(a) ? a : [a]).map(Number);
const add = (m, uid, k, v) => { const o = (m[uid] = m[uid] || { labs: 0, lessons: 0, quizzes: 0, sims: 0, practice: 0, exams: 0, challenges: 0 }); o[k] += Number(v) || 0; };

/* XP per user; with `since` only XP earned after that time (lesson reading has no timestamp and is left out) */
async function xpOf(userIds, since = null) {
  const u = ids(userIds), out = {};
  u.forEach(id => add(out, id, 'labs', 0));
  if (!u.length) return out;
  const S = since ? new Date(since) : null;
  const P = S ? [u, S] : [u];
  const w = col => (S ? ` AND ${col} >= $2` : '');
  const rows = async (sql, k) => (await db.q(sql, P)).rows.forEach(r => add(out, r.user_id, k, r.v));
  await rows(`SELECT user_id, sum(points) v FROM task_progress WHERE user_id = ANY($1) AND solved${w('solved_at')} GROUP BY user_id`, 'labs');
  if (!S) await rows(`SELECT user_id, sum(jsonb_array_length(visited))*2 + sum(jsonb_array_length(checks))*5 v FROM lesson_progress WHERE user_id = ANY($1) GROUP BY user_id`, 'lessons');
  await rows(`SELECT user_id, sum(CASE kind WHEN 'pre' THEN 10 ELSE 10 + round(30.0*score/NULLIF(max,0)) END) v FROM quiz_attempts WHERE user_id = ANY($1)${w('submitted_at')} GROUP BY user_id`, 'quizzes');
  await rows(S ? `SELECT user_id, sum(max) v FROM sim_results WHERE user_id = ANY($1) AND first_full_at >= $2 GROUP BY user_id`
    : `SELECT user_id, sum(best) v FROM sim_results WHERE user_id = ANY($1) GROUP BY user_id`, 'sims');
  await rows(`SELECT user_id, count(*)*3 v FROM (SELECT user_id, qid, min(created_at) f FROM bank_log WHERE user_id = ANY($1) AND correct GROUP BY user_id, qid) t ${S ? 'WHERE f >= $2' : ''} GROUP BY user_id`, 'practice');
  await rows(`SELECT user_id, sum(round(50.0*score/NULLIF(max,0))) v FROM exam_attempts WHERE user_id = ANY($1) AND submitted_at IS NOT NULL${w('submitted_at')} GROUP BY user_id`, 'exams');
  await rows(`SELECT user_id, sum(xp) v FROM challenge_done WHERE user_id = ANY($1)${w('done_at')} GROUP BY user_id`, 'challenges');
  for (const k in out) out[k].total = Object.entries(out[k]).reduce((a, [, v]) => a + v, 0);
  return out;
}

/* ---------- activity days & streaks ---------- */
async function todayStr() { return (await db.q(`SELECT to_char((now() AT TIME ZONE $1)::date,'YYYY-MM-DD') d`, [TZ])).rows[0].d; }
async function touch(userId) {
  await db.q(`INSERT INTO activity(user_id, day) VALUES($1, (now() AT TIME ZONE $2)::date)
              ON CONFLICT (user_id, day) DO UPDATE SET actions = activity.actions + 1`, [userId, TZ]);
}
/* local days with any learning activity (activity table + timestamps already stored elsewhere) */
async function daysOf(userIds, sinceDays = 400) {
  const u = ids(userIds), out = {}; u.forEach(id => { out[id] = []; });
  if (!u.length) return out;
  const d = col => `(${col} AT TIME ZONE $2)::date`;
  const r = await db.q(`SELECT user_id, to_char(d,'YYYY-MM-DD') d FROM (
      SELECT user_id, day d FROM activity WHERE user_id = ANY($1)
      UNION SELECT user_id, ${d('created_at')} FROM attempt_log WHERE user_id = ANY($1)
      UNION SELECT user_id, ${d('created_at')} FROM bank_log WHERE user_id = ANY($1)
      UNION SELECT user_id, ${d('submitted_at')} FROM quiz_attempts WHERE user_id = ANY($1)
      UNION SELECT user_id, ${d('started_at')} FROM exam_attempts WHERE user_id = ANY($1)
      UNION SELECT user_id, ${d('updated_at')} FROM sim_results WHERE user_id = ANY($1)
      UNION SELECT user_id, ${d('updated_at')} FROM lesson_progress WHERE user_id = ANY($1)
      UNION SELECT user_id, ${d('solved_at')} FROM task_progress WHERE user_id = ANY($1) AND solved_at IS NOT NULL
    ) t WHERE d >= (now() AT TIME ZONE $2)::date - $3::int ORDER BY user_id, d`, [u, TZ, sinceDays]);
  r.rows.forEach(x => out[x.user_id].push(x.d));
  return out;
}
const dayNum = s => Math.round(Date.parse(s + 'T00:00:00Z') / DAY_MS);
function streakOf(days, today) {
  const set = new Set(days.map(dayNum)), t = dayNum(today);
  let cur = 0, start = set.has(t) ? t : set.has(t - 1) ? t - 1 : null;
  if (start != null) while (set.has(start - cur)) cur++;
  let longest = 0, run = 0, prev = null;
  [...set].sort((a, b) => a - b).forEach(n => { run = prev === n - 1 ? run + 1 : 1; prev = n; longest = Math.max(longest, run); });
  return { current: cur, longest, activeToday: set.has(t) };
}

/* ---------- mastery by unit and accuracy by question type ---------- */
const UNIT_OF_LESSON = id => (LESSONS.get(id) || {}).unit || null;
async function masteryOf(userIds) {
  const u = ids(userIds), out = {};
  u.forEach(id => { out[id] = { units: {}, types: {} }; });
  if (!u.length) return out;
  const put = (uid, unit, type, score, w = 1) => {
    const o = out[uid]; if (!o) return;
    if (unit) { const x = (o.units[unit] = o.units[unit] || { s: 0, n: 0 }); x.s += score * w; x.n += w; }
    if (type) { const y = (o.types[type] = o.types[type] || { s: 0, n: 0 }); y.s += score * w; y.n += w; }
  };
  // practice: latest attempt per question
  (await db.q(`SELECT DISTINCT ON (user_id, qid) user_id, qid, score FROM bank_log WHERE user_id = ANY($1) ORDER BY user_id, qid, created_at DESC`, [u])).rows
    .forEach(r => { const q = bank.Q.get(r.qid); if (q) put(r.user_id, q.unit, q.type, Number(r.score)); });
  // exams: every graded item
  (await db.q(`SELECT user_id, results FROM exam_attempts WHERE user_id = ANY($1) AND submitted_at IS NOT NULL`, [u])).rows
    .forEach(r => (r.results || []).forEach(x => { const q = bank.Q.get(x.id); if (q) put(r.user_id, q.unit, q.type, Number(x.score) || 0); }));
  // post-tests: each question counts once
  (await db.q(`SELECT user_id, lesson_id, score, max FROM quiz_attempts WHERE user_id = ANY($1) AND kind='post'`, [u])).rows
    .forEach(r => { if (r.max) put(r.user_id, UNIT_OF_LESSON(r.lesson_id), null, r.score / r.max, r.max); });
  // end-of-class labs: solved tasks by points, attempted-but-unsolved tasks count as 0
  (await db.q(`SELECT user_id, lab_id, solved, points FROM task_progress WHERE user_id = ANY($1) AND lab_id LIKE 'w%' AND (solved OR attempts > 0)`, [u])).rows
    .forEach(r => put(r.user_id, UNIT_OF_LESSON(r.lab_id), null, r.solved ? Math.min(1, r.points / 10) : 0));
  const fin = m => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { pct: Math.round(v.s / v.n * 100), n: Math.round(v.n) }]));
  for (const id of u) { out[id].units = fin(out[id].units); out[id].types = fin(out[id].types); }
  return out;
}

/* ---------- badges ---------- */
async function statsOf(uid) {
  const q = (sql, p = [uid]) => db.q(sql, p).then(r => r.rows);
  const runs = await q(`SELECT lab_id, status FROM lab_runs WHERE user_id=$1 AND status IN ('finished','timeout')`);
  const tasks = await q(`SELECT lab_id, task_key, solved, points FROM task_progress WHERE user_id=$1`);
  const byLab = {}; tasks.forEach(t => { (byLab[t.lab_id] = byLab[t.lab_id] || []).push(t); });
  const perfectLab = Object.entries(byLab).some(([lab, ts]) => { const L = LABS.get(lab); if (!L) return false;
    const keys = labKeys(L); return keys.length > 0 && keys.every(k => ts.some(t => t.task_key === k && t.solved && t.points >= 10)); });
  const lp = await q(`SELECT lesson_id, visited FROM lesson_progress WHERE user_id=$1`);
  const lessonsRead = lp.filter(r => { const L = LESSONS.get(r.lesson_id); return L && L.sections.every(s => (r.visited || []).includes(s.id)); }).length;
  const quiz = await q(`SELECT lesson_id, kind, score, max FROM quiz_attempts WHERE user_id=$1`);
  const pre = {}; quiz.filter(x => x.kind === 'pre').forEach(x => { pre[x.lesson_id] = x.score / (x.max || 1); });
  const posts = quiz.filter(x => x.kind === 'post');
  const sims = await q(`SELECT sim, count(*) FILTER (WHERE best >= max)::int full FROM sim_results WHERE user_id=$1 GROUP BY sim`);
  const simFull = Object.fromEntries(sims.map(s => [s.sim, s.full]));
  const correct = await q(`SELECT DISTINCT qid FROM bank_log WHERE user_id=$1 AND correct`);
  const types = new Set(correct.map(r => (bank.Q.get(r.qid) || {}).type).filter(Boolean));
  const exams = await q(`SELECT score, max FROM exam_attempts WHERE user_id=$1 AND submitted_at IS NOT NULL`);
  const weeksAll = (await q(`SELECT count(*)::int n FROM challenge_done WHERE user_id=$1 AND goal='all'`))[0].n;
  return {
    labsDone: runs.filter(r => r.lab_id.startsWith('w')).length, roomsDone: runs.filter(r => r.lab_id.startsWith('r')).length, perfectLab,
    lessonsRead, improved: posts.filter(p => pre[p.lesson_id] != null && p.score / (p.max || 1) > pre[p.lesson_id]).length,
    postPerfect: posts.filter(p => p.max && p.score >= p.max).length, simFull,
    practice: correct.length, types: types.size, examBest: exams.reduce((a, e) => Math.max(a, e.max ? e.score / e.max : 0), 0), weeksAll
  };
}
const SIM_N = () => { const { PUBLIC } = require('./sims-api'); return Object.fromEntries(Object.values(PUBLIC).map(s => [s.id, s.missions.length])); };
const BADGES = [
  { id: 'first-lab', title: 'แล็บแรก', desc: 'ส่งแล็บท้ายคาบครั้งแรก', group: 'แล็บ', p: s => [s.labsDone, 1] },
  { id: 'labs-5', title: 'นักปฏิบัติ', desc: 'ส่งแล็บท้ายคาบ 5 สัปดาห์', group: 'แล็บ', p: s => [s.labsDone, 5] },
  { id: 'labs-18', title: 'ครบทุกสัปดาห์', desc: 'ส่งแล็บท้ายคาบครบ 18 สัปดาห์', group: 'แล็บ', p: s => [s.labsDone, 18] },
  { id: 'rooms-12', title: 'ผ่านห้องฝึกครบ', desc: 'ส่งห้องฝึกครบ 12 ห้อง', group: 'แล็บ', p: s => [s.roomsDone, 12] },
  { id: 'perfect-lab', title: 'ไร้ที่ติ', desc: 'ได้คะแนนเต็มทุกข้อในแล็บใดแล็บหนึ่ง', group: 'แล็บ', p: s => [s.perfectLab ? 1 : 0, 1] },
  { id: 'reader', title: 'นักอ่าน', desc: 'อ่านเนื้อหาครบทุกหัวข้อ 5 สัปดาห์', group: 'บทเรียน', p: s => [s.lessonsRead, 5] },
  { id: 'improver', title: 'ก้าวหน้า', desc: 'คะแนนหลังเรียนสูงกว่าก่อนเรียน 5 สัปดาห์', group: 'บทเรียน', p: s => [s.improved, 5] },
  { id: 'post-perfect', title: 'เข้าใจถ่องแท้', desc: 'แบบทดสอบหลังเรียนได้คะแนนเต็ม 3 สัปดาห์', group: 'บทเรียน', p: s => [s.postPerfect, 3] },
  { id: 'architect', title: 'นักออกแบบเครือข่าย', desc: 'ผ่านภารกิจออกแบบเครือข่ายครบทุกภารกิจ', group: 'ห้องจำลอง', p: s => [s.simFull.topology || 0, SIM_N().topology] },
  { id: 'subnet-master', title: 'เซียน Subnet', desc: 'ผ่านภารกิจคำนวณ Subnet ครบทุกภารกิจ', group: 'ห้องจำลอง', p: s => [s.simFull.subnet || 0, SIM_N().subnet] },
  { id: 'crimper', title: 'มือเข้าหัวสาย', desc: 'ผ่านภารกิจเข้าหัวสาย RJ-45 ครบทุกภารกิจ', group: 'ห้องจำลอง', p: s => [s.simFull.crimp || 0, SIM_N().crimp] },
  { id: 'cli', title: 'คล่องคำสั่ง', desc: 'ผ่านภารกิจใช้คำสั่งเครือข่ายครบทุกภารกิจ', group: 'ห้องจำลอง', p: s => [s.simFull.terminal || 0, SIM_N().terminal] },
  { id: 'troubleshooter', title: 'นักแก้ปัญหา', desc: 'ผ่านภารกิจแก้ปัญหาเครือข่ายครบทุกภารกิจ', group: 'ห้องจำลอง', p: s => [s.simFull.troubleshoot || 0, SIM_N().troubleshoot] },
  { id: 'practice-50', title: 'ขยันฝึก', desc: 'ตอบถูกในโหมดฝึก 50 ข้อ (ไม่นับข้อซ้ำ)', group: 'ข้อสอบ', p: s => [s.practice, 50] },
  { id: 'practice-150', title: 'คลังความรู้', desc: 'ตอบถูกในโหมดฝึก 150 ข้อ (ไม่นับข้อซ้ำ)', group: 'ข้อสอบ', p: s => [s.practice, 150] },
  { id: 'all-types', title: 'รอบด้าน', desc: 'ตอบถูกครบทั้ง 10 รูปแบบข้อสอบ', group: 'ข้อสอบ', p: s => [s.types, 10] },
  { id: 'exam-80', title: 'สอบผ่านฉลุย', desc: 'ได้คะแนนสอบตั้งแต่ร้อยละ 80 ขึ้นไป', group: 'ข้อสอบ', p: s => [Math.floor(s.examBest * 100), 80] },
  { id: 'streak-3', title: 'ต่อเนื่อง 3 วัน', desc: 'เข้ามาเรียนรู้ติดต่อกัน 3 วัน', group: 'ความสม่ำเสมอ', p: s => [s.longest, 3] },
  { id: 'streak-7', title: 'ต่อเนื่อง 7 วัน', desc: 'เข้ามาเรียนรู้ติดต่อกัน 7 วัน', group: 'ความสม่ำเสมอ', p: s => [s.longest, 7] },
  { id: 'weekly-1', title: 'พิชิตภารกิจสัปดาห์', desc: 'ทำภารกิจประจำสัปดาห์ครบทุกเป้าหมาย 1 ครั้ง', group: 'ความสม่ำเสมอ', p: s => [s.weeksAll, 1] },
  { id: 'weekly-4', title: 'นักล่าภารกิจ', desc: 'ทำภารกิจประจำสัปดาห์ครบทุกเป้าหมาย 4 สัปดาห์', group: 'ความสม่ำเสมอ', p: s => [s.weeksAll, 4] }
];
async function badgesOf(uid, longest) {
  const s = await statsOf(uid); s.longest = longest;
  const have = new Map((await db.q('SELECT badge, earned_at, seen FROM user_badges WHERE user_id=$1', [uid])).rows.map(r => [r.badge, r]));
  const list = [];
  for (const b of BADGES) {
    const [cur, n] = b.p(s);
    let row = have.get(b.id);
    if (!row && n > 0 && cur >= n) {
      const r = await db.q('INSERT INTO user_badges(user_id,badge) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING earned_at, seen', [uid, b.id]);
      row = r.rows[0] || (await db.q('SELECT earned_at, seen FROM user_badges WHERE user_id=$1 AND badge=$2', [uid, b.id])).rows[0];
    }
    list.push({ id: b.id, title: b.title, desc: b.desc, group: b.group, cur: Math.min(cur, n), n, earned: !!row, earnedAt: row ? +row.earned_at : null, isNew: !!row && !row.seen });
  }
  return list;
}

/* ---------- weekly challenge ---------- */
const GOALS = {
  practice: { title: 'ตอบถูกในโหมดฝึกทำข้อสอบ', n: 15, unit: 'ข้อ', href: '#/practice' },
  hard: { title: 'ตอบข้อระดับยากถูกในโหมดฝึก', n: 5, unit: 'ข้อ', href: '#/practice' },
  sim: { title: 'ผ่านภารกิจห้องจำลองแบบได้คะแนนเต็ม', n: 2, unit: 'ภารกิจ', href: '#/sims' },
  lab: { title: 'ตอบโจทย์แล็บหรือห้องฝึกถูก', n: 10, unit: 'ข้อ', href: '#/rooms' },
  days: { title: 'เข้ามาเรียนรู้', n: 3, unit: 'วัน', href: '#/learn' },
  post: { title: 'ทำแบบทดสอบหลังเรียน', n: 1, unit: 'บท', href: '#/learn' }
};
const SETS = [['practice', 'sim', 'days'], ['lab', 'hard', 'days'], ['practice', 'post', 'sim'], ['lab', 'practice', 'days']];
const GOAL_XP = 20, ALL_XP = 40;
async function weekInfo(back = 0) {
  const r = (await db.q(`SELECT ws AT TIME ZONE $1 AS start, (ws + interval '7 days') AT TIME ZONE $1 AS "end", to_char(ws,'IYYY-"W"IW') AS key, to_char(ws,'YYYY-MM-DD') AS day, extract(week FROM ws)::int AS wk
      FROM (SELECT date_trunc('week', now() AT TIME ZONE $1) - make_interval(weeks => $2) AS ws) t`, [TZ, back])).rows[0];
  return { key: r.key, day: r.day, start: +r.start, end: +r.end, goals: SETS[r.wk % SETS.length] };
}
async function goalProgress(uid, g, w) {
  const s = w.start, e = w.end;
  const one = async (sql) => Number((await db.q(sql, [uid, new Date(s), new Date(e)])).rows[0].n) || 0;
  switch (g) {
    case 'practice': return one(`SELECT count(DISTINCT qid) n FROM bank_log WHERE user_id=$1 AND correct AND created_at >= $2 AND created_at < $3`);
    case 'hard': return (await db.q(`SELECT DISTINCT qid FROM bank_log WHERE user_id=$1 AND correct AND created_at >= $2 AND created_at < $3`, [uid, new Date(s), new Date(e)])).rows
      .filter(r => (bank.Q.get(r.qid) || {}).level === 'hard').length;
    case 'sim': return one(`SELECT count(*) n FROM sim_results WHERE user_id=$1 AND first_full_at >= $2 AND first_full_at < $3`);
    case 'lab': return one(`SELECT count(*) n FROM task_progress WHERE user_id=$1 AND solved AND solved_at >= $2 AND solved_at < $3`);
    case 'post': return one(`SELECT count(*) n FROM quiz_attempts WHERE user_id=$1 AND kind='post' AND submitted_at >= $2 AND submitted_at < $3`);
    case 'days': {
      const d = (await daysOf(uid, 14))[uid]; const lo = dayNum(w.day);
      return d.map(dayNum).filter(n => n >= lo && n < lo + 7).length;
    }
  }
  return 0;
}
/* checks this week and the previous one (so a goal finished late on Sunday is not lost), stores completions */
async function challengeOf(uid) {
  let current = null;
  for (const back of [1, 0]) {
    const w = await weekInfo(back);
    const done = new Set((await db.q('SELECT goal FROM challenge_done WHERE user_id=$1 AND week=$2', [uid, w.key])).rows.map(r => r.goal));
    const goals = [];
    for (const g of w.goals) {
      const cur = await goalProgress(uid, g, w);
      if (cur >= GOALS[g].n && !done.has(g)) { await db.q('INSERT INTO challenge_done(user_id,week,goal,xp) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [uid, w.key, g, GOAL_XP]); done.add(g); }
      goals.push({ id: g, ...GOALS[g], cur: Math.min(cur, GOALS[g].n), done: done.has(g), xp: GOAL_XP });
    }
    if (goals.every(x => x.done) && !done.has('all')) { await db.q('INSERT INTO challenge_done(user_id,week,goal,xp) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [uid, w.key, 'all', ALL_XP]); done.add('all'); }
    if (back === 0) current = { week: w.key, start: w.start, end: w.end, goals, allDone: done.has('all'), bonus: ALL_XP };
  }
  return current;
}

module.exports = { TZ, levelOf, LEVEL_TITLES, XP_RULES, xpOf, touch, daysOf, streakOf, todayStr, masteryOf, badgesOf, BADGES, challengeOf, weekInfo, GOALS, dayNum };
