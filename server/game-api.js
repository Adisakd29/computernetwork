'use strict';
/* Phase 5 API: student progress (XP, level, streak, badges, weekly challenge, mastery), leaderboard, teacher analytics */
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const bank = require('./bank');
const G = require('./game');

const ok = (res, d) => res.json(d);
const fail = (res, code, error, message) => res.status(code).json({ error, message });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const UNIT_NAMES = ['ความรู้เกี่ยวกับระบบเครือข่าย', 'อุปกรณ์และสื่อนำสัญญาณ', 'มาตรฐานและโปรโตคอล', 'LAN แบบใช้สาย', 'LAN แบบไร้สาย',
  'เครือข่ายในวินโดวส์', 'ระบบปฏิบัติการเครือข่าย', 'ออกแบบ ติดตั้ง แก้ปัญหา', 'ความปลอดภัย', 'บัญชีผู้ใช้และสิทธิ์'];
const TYPES = ['choice', 'multi', 'tf', 'match', 'order', 'fill', 'subnet', 'diagram', 'command', 'scenario'];
const BANK_UNITS = new Set([...bank.Q.values()].map(q => q.unit));

/* ---------- personal suggestions ("ภารกิจแนะนำ") ---------- */
async function suggestionsOf(user, mastery) {
  const out = [];
  const units = Object.entries(mastery.units).map(([u, v]) => ({ unit: +u, ...v })).filter(x => x.n >= 3).sort((a, b) => a.pct - b.pct);
  const weak = units.find(x => x.pct < 70);
  if (weak) out.push({ kind: 'weak', title: `ทบทวนหน่วยที่ ${weak.unit} ${UNIT_NAMES[weak.unit - 1]}`, why: `ความเข้าใจตอนนี้ ${weak.pct}% ลองฝึก 10 ข้อของหน่วยนี้`, href: `#/practice/u${weak.unit}` });
  const untouched = [...BANK_UNITS].sort((a, b) => a - b).find(u => !mastery.units[u]);
  if (untouched && out.length < 3) out.push({ kind: 'new', title: `เริ่มฝึกหน่วยที่ ${untouched} ${UNIT_NAMES[untouched - 1]}`, why: 'ยังไม่มีข้อมูลของหน่วยนี้', href: `#/practice/u${untouched}` });
  if (user.class_id) {
    const ex = (await db.q(`SELECT e.id, e.title FROM exams e LEFT JOIN exam_attempts a ON a.exam_id=e.id AND a.user_id=$2
        WHERE e.class_id=$1 AND (e.open_at IS NULL OR e.open_at <= now()) AND (e.close_at IS NULL OR e.close_at > now()) AND (a.user_id IS NULL OR (a.submitted_at IS NULL AND a.deadline > now()))
        ORDER BY e.close_at NULLS LAST LIMIT 1`, [user.class_id, user.id])).rows[0];
    if (ex) out.unshift({ kind: 'exam', title: `การสอบ: ${ex.title}`, why: 'เปิดสอบอยู่และคุณยังไม่ได้ส่ง', href: `#/exam/${ex.id}` });
  }
  const { PUBLIC } = require('./sims-api');
  const done = new Set((await db.q('SELECT sim||\':\'||mission k FROM sim_results WHERE user_id=$1 AND best >= max', [user.id])).rows.map(r => r.k));
  const order = ['subnet', 'topology', 'crimp', 'terminal', 'troubleshoot'];
  for (const sid of order) {
    const m = PUBLIC[sid].missions.find(x => !done.has(sid + ':' + x.id));
    if (m) { out.push({ kind: 'sim', title: `${PUBLIC[sid].title}: ${m.title}`, why: 'ภารกิจถัดไปที่ยังไม่ได้คะแนนเต็ม', href: `#/sim/${sid}` }); break; }
  }
  return out.slice(0, 4);
}

/* ---------- student ---------- */
const router = express.Router();
router.use(auth.requireDb, auth.requireUser);

router.get('/me', wrap(async (req, res) => {
  const u = req.user;
  const challenge = await G.challengeOf(u.id);           // stores newly completed goals first, so XP below includes them
  const week = await G.weekInfo(0);
  const [xpAll, xpWeek, days, today, mastery] = await Promise.all([G.xpOf(u.id), G.xpOf(u.id, week.start), G.daysOf(u.id, 400), G.todayStr(), G.masteryOf(u.id)]);
  const streak = G.streakOf(days[u.id], today);
  const badges = await G.badgesOf(u.id, streak.longest);
  const newBadges = badges.filter(b => b.isNew).map(b => b.id);
  if (newBadges.length) await db.q('UPDATE user_badges SET seen=true WHERE user_id=$1 AND badge = ANY($2)', [u.id, newBadges]);
  const cls = u.class_id ? (await db.q('SELECT leaderboard FROM classes WHERE id=$1', [u.class_id])).rows[0] : null;
  const xp = xpAll[u.id];
  ok(res, {
    xp, weekXp: xpWeek[u.id].total, level: G.levelOf(xp.total), rules: G.XP_RULES,
    streak, today, days: days[u.id].filter(d => G.dayNum(d) > G.dayNum(today) - 84),
    badges: badges.map(({ isNew, ...b }) => b), newBadges,
    challenge,
    mastery: Object.entries(mastery[u.id].units).map(([unit, v]) => ({ unit: +unit, name: UNIT_NAMES[unit - 1], ...v })).sort((a, b) => a.unit - b.unit),
    types: TYPES.filter(t => mastery[u.id].types[t]).map(t => ({ type: t, ...mastery[u.id].types[t] })),
    suggestions: await suggestionsOf(u, mastery[u.id]),
    leaderboard: { enabled: !!(cls && cls.leaderboard), public: !!u.lb_public }
  });
}));

router.post('/prefs', wrap(async (req, res) => {
  if (typeof req.body.lbPublic !== 'boolean') return fail(res, 400, 'bad', 'ข้อมูลไม่ถูกต้อง');
  await db.q('UPDATE users SET lb_public=$2 WHERE id=$1', [req.user.id, req.body.lbPublic]);
  ok(res, { ok: true, public: req.body.lbPublic });
}));

/* class leaderboard: only when the teacher turned it on; names only for students who agreed; no ids or scores other than XP */
router.get('/leaderboard', wrap(async (req, res) => {
  const u = req.user;
  if (!u.class_id) return fail(res, 404, 'no_class', 'บัญชีนี้ไม่ได้อยู่ในห้องเรียน');
  const c = (await db.q('SELECT leaderboard FROM classes WHERE id=$1', [u.class_id])).rows[0];
  if (!c || !c.leaderboard) return fail(res, 403, 'off', 'ครูยังไม่ได้เปิดกระดานคะแนนของห้องนี้');
  const scope = req.query.scope === 'all' ? 'all' : 'week';
  const studs = (await db.q(`SELECT id, display_name, lb_public FROM users WHERE class_id=$1 AND role='student' AND NOT disabled`, [u.class_id])).rows;
  const since = scope === 'week' ? (await G.weekInfo(0)).start : null;
  const xp = await G.xpOf(studs.map(s => s.id), since);
  const xpAll = since ? await G.xpOf(studs.map(s => s.id)) : xp;
  const rows = studs.map(s => ({ s, xp: xp[s.id].total })).sort((a, b) => b.xp - a.xp);
  let rank = 0, prev = null;
  const ranked = rows.map((r, i) => { if (r.xp !== prev) { rank = i + 1; prev = r.xp; } return { rank, xp: r.xp, me: r.s.id === u.id,
    name: r.s.id === u.id ? r.s.display_name : r.s.lb_public ? r.s.display_name : 'ไม่เปิดเผยชื่อ', level: G.levelOf(xpAll[r.s.id].total).level, hidden: r.s.id !== u.id && !r.s.lb_public }; });
  const top = ranked.slice(0, 10); const mine = ranked.find(r => r.me);
  ok(res, { scope, total: ranked.length, rows: top, me: mine && !top.includes(mine) ? mine : null });
}));

/* ---------- teacher analytics ---------- */
const teacher = express.Router();
async function ownClass(req, res, id) {
  const c = (await db.q('SELECT * FROM classes WHERE id=$1', [Number(id) || 0])).rows[0];
  if (!c || (req.user.role !== 'admin' && c.teacher_id !== req.user.id)) { fail(res, 404, 'no_class', 'ไม่พบห้องเรียนนี้'); return null; }
  return c;
}
async function classAnalytics(c) {
  const studs = (await db.q(`SELECT id, display_name AS name, student_no AS no, lb_public, last_login_at FROM users WHERE class_id=$1 AND role='student' AND NOT disabled
      ORDER BY NULLIF(regexp_replace(student_no,'\\D','','g'),'')::int NULLS LAST, display_name`, [c.id])).rows;
  const sid = studs.map(s => s.id);
  const week = await G.weekInfo(0);
  const [xp, xpW, days, today, mastery] = await Promise.all([G.xpOf(sid), G.xpOf(sid, week.start), G.daysOf(sid, 120), G.todayStr(), G.masteryOf(sid)]);
  const badgeN = {}; if (sid.length) (await db.q('SELECT user_id, count(*)::int n FROM user_badges WHERE user_id = ANY($1) GROUP BY user_id', [sid])).rows.forEach(r => { badgeN[r.user_id] = r.n; });
  // overdue assignments not submitted
  const asg = (await db.q('SELECT lab_id, due_at FROM assignments WHERE class_id=$1 AND due_at IS NOT NULL AND due_at < now()', [c.id])).rows;
  const runs = {}; if (sid.length && asg.length) (await db.q(`SELECT user_id, lab_id FROM lab_runs WHERE user_id = ANY($1) AND status IN ('finished','timeout')`, [sid])).rows.forEach(r => { (runs[r.user_id] = runs[r.user_id] || new Set()).add(r.lab_id); });
  const T = G.dayNum(today);
  const students = studs.map(s => {
    const d = days[s.id], last = d.length ? d[d.length - 1] : null, st = G.streakOf(d, today);
    const m = mastery[s.id].units;
    const flags = [];
    const idle = last ? T - G.dayNum(last) : null;
    if (idle == null) flags.push('ยังไม่เคยเข้าเรียนในระบบ'); else if (idle >= 7) flags.push(`ไม่ได้เข้าเรียน ${idle} วัน`);
    const weak = Object.entries(m).filter(([, v]) => v.n >= 5 && v.pct < 50).map(([u]) => u);
    if (weak.length) flags.push('ความเข้าใจต่ำกว่า 50% ในหน่วย ' + weak.join(', '));
    const over = asg.filter(a => !(runs[s.id] && runs[s.id].has(a.lab_id))).length;
    if (over) flags.push(`ค้างส่งงานที่เลยกำหนด ${over} งาน`);
    return { id: s.id, no: s.no, name: s.name, xp: xp[s.id].total, xpParts: xp[s.id], weekXp: xpW[s.id].total, level: G.levelOf(xp[s.id].total).level,
      streak: st.current, longest: st.longest, lastActive: last, activeDays7: d.filter(x => G.dayNum(x) > T - 7).length, badges: badgeN[s.id] || 0,
      lbPublic: s.lb_public, mastery: m, flags };
  });
  const agg = key => { const o = {}; sid.forEach(id => Object.entries(mastery[id][key]).forEach(([k, v]) => { const x = (o[k] = o[k] || { s: 0, n: 0, students: 0 }); x.s += v.pct * v.n; x.n += v.n; x.students++; })); return o; };
  const U = agg('units'), TY = agg('types');
  const daily = [];
  for (let i = 27; i >= 0; i--) { const n = T - i; daily.push({ day: new Date(n * 86400e3).toISOString().slice(0, 10), active: sid.filter(id => days[id].some(x => G.dayNum(x) === n)).length }); }
  return {
    class: { id: c.id, name: c.name, leaderboard: c.leaderboard }, today, week: week.key,
    summary: { students: studs.length, active7: students.filter(s => s.activeDays7 > 0).length, avgXp: studs.length ? Math.round(students.reduce((a, s) => a + s.xp, 0) / studs.length) : 0,
      flagged: students.filter(s => s.flags.length).length, badges: Object.values(badgeN).reduce((a, n) => a + n, 0) },
    units: Array.from({ length: 10 }, (_, i) => i + 1).map(u => ({ unit: u, name: UNIT_NAMES[u - 1], pct: U[u] ? Math.round(U[u].s / U[u].n) : null, n: U[u] ? U[u].n : 0, students: U[u] ? U[u].students : 0 })),
    types: TYPES.map(t => ({ type: t, pct: TY[t] ? Math.round(TY[t].s / TY[t].n) : null, n: TY[t] ? TY[t].n : 0 })),
    daily, students
  };
}
teacher.get('/classes/:id/analytics', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  ok(res, await classAnalytics(c));
}));
teacher.get('/classes/:id/analytics.xlsx', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const a = await classAnalytics(c);
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook(); wb.creator = 'NetLab';
  const ws = wb.addWorksheet('ภาพรวมรายคน');
  ws.addRow([`วิเคราะห์ผลการเรียน ${c.name}`]).font = { bold: true, size: 14 };
  ws.addRow([`ข้อมูล ณ ${a.today} · ความเข้าใจรายหน่วย (%) คำนวณจากโหมดฝึก การสอบ แบบทดสอบหลังเรียน และแล็บท้ายคาบ`]);
  ws.addRow([]);
  ws.addRow(['เลขที่', 'ชื่อ–สกุล', 'XP', 'เลเวล', 'XP สัปดาห์นี้', 'วันต่อเนื่อง', 'เข้าเรียนล่าสุด', 'วันที่เข้าเรียนใน 7 วัน', 'เหรียญ', ...a.units.map(u => 'หน่วย ' + u.unit), 'ข้อควรดูแล']).font = { bold: true };
  a.students.forEach(s => ws.addRow([Number(s.no) || s.no, s.name, s.xp, s.level, s.weekXp, s.streak, s.lastActive || '-', s.activeDays7, s.badges,
    ...a.units.map(u => s.mastery[u.unit] ? s.mastery[u.unit].pct : ''), s.flags.join(' ; ')]));
  ws.columns.forEach((col, i) => { col.width = i === 1 ? 28 : i === 9 + a.units.length ? 50 : 10; });
  const w2 = wb.addWorksheet('รายหน่วยและรูปแบบ');
  w2.addRow(['หน่วย', 'ชื่อหน่วย', 'ความเข้าใจเฉลี่ย (%)', 'จำนวนหลักฐาน (ข้อ)', 'จำนวนนักเรียนที่มีข้อมูล']).font = { bold: true };
  a.units.forEach(u => w2.addRow([u.unit, u.name, u.pct ?? '', u.n, u.students]));
  w2.addRow([]);
  w2.addRow(['รูปแบบข้อสอบ', '', 'ตอบถูกเฉลี่ย (%)', 'จำนวนข้อ']).font = { bold: true };
  a.types.forEach(t => w2.addRow([t.type, '', t.pct ?? '', t.n]));
  w2.columns.forEach((col, i) => { col.width = [10, 32, 20, 20, 24][i]; });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="netlab-analytics-${c.id}.xlsx"`);
  await wb.xlsx.write(res); res.end();
}));
teacher.patch('/classes/:id/leaderboard', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  if (typeof req.body.enabled !== 'boolean') return fail(res, 400, 'bad', 'ข้อมูลไม่ถูกต้อง');
  await db.q('UPDATE classes SET leaderboard=$2 WHERE id=$1', [c.id, req.body.enabled]);
  ok(res, { ok: true, enabled: req.body.enabled });
}));

/* records an active day after any successful learning action by a student (POST/PUT, not auth) */
function activityTracker(req, res, next) {
  if (req.method !== 'POST' && req.method !== 'PUT') return next();
  res.on('finish', () => {
    if (res.statusCode < 400 && req.user && req.user.role === 'student' && db.enabled() && !req.path.startsWith('/auth') && !req.path.startsWith('/game'))
      G.touch(req.user.id).catch(e => console.error('activity', e.message));
  });
  next();
}

module.exports = { router, teacher, activityTracker, classAnalytics };
