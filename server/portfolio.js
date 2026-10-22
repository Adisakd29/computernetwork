'use strict';
/* NetLab 3.0 Phase 5: Student Network Skills Portfolio.
   Everything shown is built from records the system already keeps (simulator results graded on the server, lab tasks,
   quizzes, the capstone submission) plus three additive tables: skill_observations (evidence a teacher saw in class),
   portfolio_notes (student reflection + teacher comment per skill) and capstone_reviews (presentation/defense rubric).
   Routes
     student  GET  /api/portfolio                          own portfolio
              PUT  /api/portfolio/notes/:skill             own reflection
              GET  /api/lessons/:id/gate                   (lessons-api) whether the post-test is open when the class requires practice
     teacher  GET  /api/teacher/students/:uid/portfolio
              POST /api/teacher/students/:uid/observations     DELETE /api/teacher/observations/:oid
              PUT  /api/teacher/students/:uid/notes/:skill     PUT /api/teacher/students/:uid/capstone
              PATCH /api/teacher/classes/:id/require-practice  GET /api/teacher/classes/:id/portfolio  (class summary) */
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const S = require('./skills');
const { SKILL_RUBRIC, CAPSTONE, OBS_LEVELS } = require('../content/rubrics');
const { WEEKS } = require('../content/curriculum');

const ok = (res, d) => res.json(d);
const fail = (res, code, error, message) => res.status(code).json({ error, message });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const NOTE_KEYS = new Set([...S.SKILLS.map(s => s.id), 'capstone', 'overall']);
const CAP_REF = { sim: 'topology', mission: 't9' };
const clip = (v, n) => String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, n);

const weekRefs = W => [...new Set([...W.guided, ...W.independent, ...W.trouble])];

/* 3.2: what is still missing before the post-test when the class requires practice = the week's combined practical
   result ("ฝึกปฏิบัติ": Guided + Independent + Troubleshooting under one timer) has not reached the class pass mark.
   Returns [] when passed, otherwise one entry describing the best result so far (kept as a list for older callers). */
async function guidedMissing(userId, lessonId) {
  const W = WEEKS.find(w => w.id === lessonId); if (!W) return [];
  const P = require('./practical');
  const u = (await db.q('SELECT id, class_id FROM users WHERE id=$1', [userId])).rows[0] || { id: userId };
  const S = (await require('./path').settingsFor(u)).settings, policy = P.policyOf(S);
  const f = (await P.factsOf(userId, policy)).get(lessonId);
  if (!f || f.passed) return [];
  return [{ ref: 'practical', title: 'ฝึกปฏิบัติรวมของสัปดาห์', best: f.best, max: 100, passPct: policy.passPct, href: `#/lesson/${lessonId}/lab`, passed: false }];
}
/* does this student's class require the week's practical step before the post-test? */
async function practiceGate(user, lessonId) {
  if (!user || user.role !== 'student' || !user.class_id || !db.enabled()) return { required: false, missing: [] };
  const c = (await db.q('SELECT require_practice FROM classes WHERE id=$1', [user.class_id])).rows[0];
  if (!c || !c.require_practice) return { required: false, missing: [] };
  return { required: true, missing: await guidedMissing(user.id, lessonId) };
}

async function build(userId) {
  const u = (await db.q(`SELECT u.id, u.display_name AS name, u.username, u.student_no AS no, u.role, c.name AS class, c.id AS class_id
                           FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.id=$1`, [userId])).rows[0];
  if (!u) return null;
  const { MODS } = require('./sims-api');
  const { LESSONS } = require('./lessons');
  const { LABS, labKeys } = require('./content');
  const ev = (await S.evidence([userId])).get(userId);
  const notes = Object.fromEntries((await db.q('SELECT skill, reflection, reflected_at, teacher_comment, commented_at FROM portfolio_notes WHERE user_id=$1', [userId])).rows
    .map(r => [r.skill, { reflection: r.reflection, reflectedAt: r.reflected_at ? +r.reflected_at : null, comment: r.teacher_comment, commentedAt: r.commented_at ? +r.commented_at : null }]));
  const skills = S.SKILLS.map(s => {
    const e = ev[s.id], j = S.judge(e);
    const hands = e.hands.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    const missions = Object.entries(S.SIM_MAP).flatMap(([sim, m]) => Object.entries(m).filter(([, sk]) => sk[0] === s.id).map(([id]) => `${sim}:${id}`));
    return { id: s.id, name: s.name, th: s.th, level: j.level, pct: j.pct ?? null, reasons: j.reasons, next: j.next,
      rubric: SKILL_RUBRIC[s.id], hands, know: { n: e.know.length, pct: e.know.length ? Math.round(100 * e.know.reduce((a, x) => a + x.pct, 0) / e.know.length) : null },
      missionsMain: missions.length, note: notes[s.id] || null };
  });
  /* capstone: the t9 mission (auto + report rubric) and the teacher's presentation/defense rubric */
  const t9 = MODS[CAP_REF.sim] && MODS[CAP_REF.sim].missions.find(m => m.id === CAP_REF.mission);
  const sub = (await db.q(`SELECT id, auto_score, auto_max, rubric, report, teacher_scores, teacher_comment, reviewed_at, created_at FROM sim_submissions
                            WHERE user_id=$1 AND sim=$2 AND mission=$3 ORDER BY created_at DESC LIMIT 1`, [userId, CAP_REF.sim, CAP_REF.mission])).rows[0];
  const best = (await db.q('SELECT best, max, attempts, updated_at FROM sim_results WHERE user_id=$1 AND sim=$2 AND mission=$3', [userId, CAP_REF.sim, CAP_REF.mission])).rows[0];
  const rev = (await db.q('SELECT r.scores, r.comment, r.updated_at, t.display_name AS teacher FROM capstone_reviews r LEFT JOIN users t ON t.id=r.teacher_id WHERE r.user_id=$1', [userId])).rows[0];
  const reportCrit = (t9 && t9.review && t9.review.teacher) || [];
  const reportScore = sub && sub.teacher_scores ? reportCrit.reduce((a, c) => a + (Number(sub.teacher_scores[c.id]) || 0), 0) : null;
  const defense = rev ? CAPSTONE.criteria.reduce((a, c) => a + (Number(rev.scores[c.id]) || 0), 0) : null;
  const capstone = {
    title: t9 ? t9.title : 'โครงงานปิดท้าย', ref: `${CAP_REF.sim}/${CAP_REF.mission}`,
    auto: sub ? { score: sub.auto_score, max: sub.auto_max, rubric: sub.rubric, at: +sub.created_at } : null,
    best: best ? { best: best.best, max: best.max, attempts: best.attempts, at: +best.updated_at } : null,
    report: sub ? { text: sub.report || '', score: reportScore, max: reportCrit.reduce((a, c) => a + c.max, 0), criteria: reportCrit, scores: sub.teacher_scores || null, comment: sub.teacher_comment || '', reviewedAt: sub.reviewed_at ? +sub.reviewed_at : null } : null,
    defense: { rubric: CAPSTONE, scores: rev ? rev.scores : null, comment: rev ? rev.comment : '', teacher: rev ? rev.teacher : null, at: rev ? +rev.updated_at : null, score: defense, max: CAPSTONE.criteria.length * 4 },
    note: notes.capstone || null
  };
  /* week by week: pre/post test, end-of-class lab, simulator plan */
  const quiz = (await db.q('SELECT lesson_id, kind, score, max FROM quiz_attempts WHERE user_id=$1', [userId])).rows;
  const tp = (await db.q('SELECT task_key, solved, points FROM task_progress WHERE user_id=$1', [userId])).rows;
  const tpm = new Map(tp.map(r => [r.task_key, r]));
  const simr = (await db.q('SELECT sim, mission, best, max FROM sim_results WHERE user_id=$1', [userId])).rows;
  const PR = require('./practical');
  const pf = await PR.factsOf(userId, PR.policyOf((await require('./path').settingsFor({ id: u.id, class_id: u.class_id })).settings));
  const weeks = WEEKS.map(W => {
    const L = LESSONS.get(W.id), lab = LABS.get(W.id), pr = pf.get(W.id) || {};
    const q = k => { const r = quiz.find(x => x.lesson_id === W.id && x.kind === k); return r ? { score: r.score, max: r.max } : null; };
    const keys = lab ? labKeys(lab) : [];
    const solved = keys.filter(k => tpm.get(k) && tpm.get(k).solved).length, pts = keys.reduce((a, k) => a + ((tpm.get(k) || {}).points || 0), 0);
    /* 3.1: main missions (Guided + the step-4 main mission) are reported apart from optional ones (Independent + extra
       step-4 practice); a mission listed in several weeks is one stored result, shown in each week that lists it */
    const ok = ref => { const [sim, id] = ref.split(':'); const r = simr.find(x => x.sim === sim && x.mission === id); return !!(r && r.max && r.best / r.max >= 0.7); };
    const mainRefs = [...new Set([...W.guided, ...W.independent, ...(W.solve || [])])], optRefs = [...new Set(W.more || [])].filter(r => !mainRefs.includes(r));
    const passed = mainRefs.filter(ok);
    return { id: W.id, week: Number(W.id.slice(1)), title: L ? L.title : W.focus, pre: q('pre'), post: q('post'),
      lab: { solved, total: keys.length, points: pts, max: keys.length * 10 }, practice: { passed: passed.length, total: mainRefs.length, guided: W.guided.length, optional: { passed: optRefs.filter(ok).length, total: optRefs.length } },
      practical: { best: pr.best == null ? null : pr.best, passed: !!pr.passed, legacy: !!pr.bestLegacy, attempts: pr.attempts || 0 } };
  });
  return { generatedAt: Date.now(), student: u, levels: S.LEVELS, levelTh: S.LEVEL_TH, obsLevels: OBS_LEVELS, skills, capstone, weeks, overall: notes.overall || null };
}

/* ---------- student ---------- */
const router = express.Router();
router.get('/', auth.requireDb, auth.requireUser, wrap(async (req, res) => ok(res, await build(req.user.id))));
router.put('/notes/:skill', auth.requireDb, auth.requireUser, wrap(async (req, res) => {
  const k = req.params.skill; if (!NOTE_KEYS.has(k)) return fail(res, 404, 'no_skill', 'ไม่พบทักษะนี้');
  const text = clip(req.body.reflection, 2000);
  await db.q(`INSERT INTO portfolio_notes(user_id,skill,reflection,reflected_at) VALUES($1,$2,$3,now())
              ON CONFLICT (user_id,skill) DO UPDATE SET reflection=EXCLUDED.reflection, reflected_at=now()`, [req.user.id, k, text]);
  ok(res, { ok: true, reflection: text });
}));

/* ---------- teacher ---------- */
const teacher = express.Router();
async function ownStudent(req, res, uid) {
  const s = (await db.q("SELECT u.id, u.class_id, c.teacher_id FROM users u JOIN classes c ON c.id=u.class_id WHERE u.id=$1 AND u.role='student'", [Number(uid) || 0])).rows[0];
  if (!s || (req.user.role !== 'admin' && s.teacher_id !== req.user.id)) { fail(res, 404, 'no_student', 'ไม่พบนักเรียนคนนี้'); return null; }
  return s;
}
async function ownClass(req, res, id) {
  const c = (await db.q('SELECT * FROM classes WHERE id=$1', [Number(id) || 0])).rows[0];
  if (!c || (req.user.role !== 'admin' && c.teacher_id !== req.user.id)) { fail(res, 404, 'no_class', 'ไม่พบห้องเรียนนี้'); return null; }
  return c;
}
teacher.get('/students/:uid/portfolio', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  ok(res, await build(s.id));
}));
teacher.post('/students/:uid/observations', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  const b = req.body || {};
  if (!S.SKILLS.some(x => x.id === b.skill)) return fail(res, 400, 'bad_skill', 'เลือกทักษะ');
  const level = Number(b.level); if (![1, 2, 3, 4].includes(level)) return fail(res, 400, 'bad_level', 'เลือกระดับ 1–4');
  const title = clip(b.title, 200); if (title.length < 3) return fail(res, 400, 'bad_title', 'บอกสิ่งที่นักเรียนทำ เช่น เข้าหัวสาย RJ-45 จริง 2 เส้น ผ่านเครื่องทดสอบ');
  const week = b.week == null || b.week === '' ? null : Number(b.week);
  if (week !== null && !(Number.isInteger(week) && week >= 1 && week <= 18)) return fail(res, 400, 'bad_week', 'สัปดาห์ต้องเป็น 1–18');
  let on = b.observed_on ? String(b.observed_on) : null;
  if (on && !/^\d{4}-\d{2}-\d{2}$/.test(on)) return fail(res, 400, 'bad_date', 'วันที่ไม่ถูกต้อง');
  if (on && (new Date(on) > new Date(Date.now() + 864e5) || new Date(on) < new Date('2020-01-01'))) return fail(res, 400, 'bad_date', 'วันที่ไม่ถูกต้อง');
  const r = await db.q(`INSERT INTO skill_observations(user_id,skill,level,title,note,week,observed_on,teacher_id) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7::date,CURRENT_DATE),$8) RETURNING id`,
    [s.id, b.skill, level, title, clip(b.note, 1000), week, on, req.user.id]);
  ok(res, { ok: true, id: r.rows[0].id });
}));
teacher.delete('/observations/:oid', wrap(async (req, res) => {
  const o = (await db.q('SELECT id, user_id FROM skill_observations WHERE id=$1', [Number(req.params.oid) || 0])).rows[0];
  if (!o) return fail(res, 404, 'no_obs', 'ไม่พบหลักฐานนี้');
  const s = await ownStudent(req, res, o.user_id); if (!s) return;
  await db.q('DELETE FROM skill_observations WHERE id=$1', [o.id]);
  ok(res, { ok: true });
}));
teacher.put('/students/:uid/notes/:skill', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  const k = req.params.skill; if (!NOTE_KEYS.has(k)) return fail(res, 404, 'no_skill', 'ไม่พบทักษะนี้');
  const text = clip(req.body.comment, 2000);
  await db.q(`INSERT INTO portfolio_notes(user_id,skill,teacher_comment,commented_by,commented_at) VALUES($1,$2,$3,$4,now())
              ON CONFLICT (user_id,skill) DO UPDATE SET teacher_comment=EXCLUDED.teacher_comment, commented_by=EXCLUDED.commented_by, commented_at=now()`, [s.id, k, text, req.user.id]);
  ok(res, { ok: true, comment: text });
}));
teacher.put('/students/:uid/capstone', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  const scores = {};
  for (const c of CAPSTONE.criteria) {
    const v = (req.body.scores || {})[c.id];
    if (v == null || v === '') continue;                          // a criterion may be left unscored
    const n = Number(v); if (![1, 2, 3, 4].includes(n)) return fail(res, 400, 'bad_score', `ระดับของ "${c.title}" ต้องเป็น 1–4`);
    scores[c.id] = n;
  }
  await db.q(`INSERT INTO capstone_reviews(user_id,scores,comment,teacher_id,updated_at) VALUES($1,$2,$3,$4,now())
              ON CONFLICT (user_id) DO UPDATE SET scores=EXCLUDED.scores, comment=EXCLUDED.comment, teacher_id=EXCLUDED.teacher_id, updated_at=now()`,
    [s.id, JSON.stringify(scores), clip(req.body.comment, 2000), req.user.id]);
  ok(res, { ok: true, scores });
}));
teacher.patch('/classes/:id/require-practice', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  if (typeof req.body.enabled !== 'boolean') return fail(res, 400, 'bad', 'ข้อมูลไม่ถูกต้อง');
  await db.q('UPDATE classes SET require_practice=$2 WHERE id=$1', [c.id, req.body.enabled]);
  ok(res, { ok: true, enabled: req.body.enabled });
}));
/* class overview: skill levels, evidence counts, capstone totals (one row per student) */
teacher.get('/classes/:id/portfolio', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const studs = (await db.q(`SELECT id, display_name AS name, student_no AS no FROM users WHERE class_id=$1 AND role='student' AND NOT disabled
      ORDER BY NULLIF(regexp_replace(student_no,'\\D','','g'),'')::int NULLS LAST, display_name`, [c.id])).rows;
  const ids = studs.map(s => s.id);
  const ev = ids.length ? await S.evidence(ids) : new Map();
  const obs = ids.length ? (await db.q('SELECT user_id, count(*)::int n FROM skill_observations WHERE user_id = ANY($1) GROUP BY user_id', [ids])).rows : [];
  const refl = ids.length ? (await db.q("SELECT user_id, count(*) FILTER (WHERE reflection<>'')::int n FROM portfolio_notes WHERE user_id = ANY($1) GROUP BY user_id", [ids])).rows : [];
  const cap = ids.length ? (await db.q(`SELECT DISTINCT ON (user_id) user_id, auto_score, auto_max, teacher_scores FROM sim_submissions WHERE user_id = ANY($1) AND sim=$2 AND mission=$3 ORDER BY user_id, created_at DESC`, [ids, CAP_REF.sim, CAP_REF.mission])).rows : [];
  const rev = ids.length ? (await db.q('SELECT user_id, scores FROM capstone_reviews WHERE user_id = ANY($1)', [ids])).rows : [];
  ok(res, { requirePractice: !!c.require_practice, skills: S.SKILLS, levelTh: S.LEVEL_TH, capstoneMax: CAPSTONE.criteria.length * 4, students: studs.map(s => {
    const m = ev.get(s.id) || {}; const cp = cap.find(x => x.user_id === s.id); const rv = rev.find(x => x.user_id === s.id);
    return { ...s, skills: S.SKILLS.map(k => ({ id: k.id, level: m[k.id] ? S.judge(m[k.id]).level : null })),
      observations: (obs.find(x => x.user_id === s.id) || {}).n || 0, reflections: (refl.find(x => x.user_id === s.id) || {}).n || 0,
      capstone: cp ? { auto: cp.auto_score, autoMax: cp.auto_max, reviewed: !!cp.teacher_scores } : null,
      defense: rv ? CAPSTONE.criteria.reduce((a, k) => a + (Number(rv.scores[k.id]) || 0), 0) : null };
  }) });
}));

module.exports = { router, teacher, build, practiceGate, guidedMissing };
