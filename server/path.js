'use strict';
/* NetLab Progressive Unlock (sequential learning path over the 18 weeks).
   Rules: content/learning-path.js (DEFAULTS) merged with classes.path. Everything is decided here on the server; the
   browser only displays the result of GET /api/path and is refused (403 'locked') by the APIs of a locked week.

   Status of a week for a student
     completed    a row in week_completions (sticky: later rule changes never undo it)
     locked       sequential rules on, and neither: week 1 / previous week completed / a teacher or legacy unlock;
                  or its open date (classes.path.openDates) has not come yet and no teacher unlock exists
     in_progress  open, not completed, some work recorded
     available    open, nothing done yet
   A week is marked completed the first time all required conditions hold while it is open. Completing week N can only
   open week N+1: nothing is ever opened two steps ahead.

   Earlier work: the first time sequential rules apply to a student (deploy for students without a class, or the teacher
   turning it on for the class), weeks the student had already started but that would now be locked get a 'legacy'
   unlock, so nobody is pushed back. The teacher sees these in the class report and can revoke them. */
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const { DEFAULTS, LEGACY_CLASS, LIMITS, REQUIRE_LABEL } = require('../content/learning-path');
const { WEEKS } = require('../content/curriculum');

const ok = (res, d) => res.json(d);
const fail = (res, code, error, message, extra) => res.status(code).json(Object.assign({ error, message }, extra || {}));
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const IDS = WEEKS.map(w => w.id);                       // w1..w18 in order
const weekNo = id => Number(String(id).slice(1));
const isWeek = id => IDS.includes(id);

/* ---------- rules ---------- */
function merge(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const rq = Object.assign({}, raw.require || {});
  /* 3.2: guided (Guided missions) and solve (step-4 main missions) became one condition: the practical session */
  if (!('practice' in rq) && ('guided' in rq || 'solve' in rq)) rq.practice = rq.guided !== false || rq.solve === true;
  delete rq.guided; delete rq.solve;
  const pr = raw.practical && typeof raw.practical === 'object' ? raw.practical : {};
  return {
    sequential: typeof raw.sequential === 'boolean' ? raw.sequential : DEFAULTS.sequential,
    stepOrder: typeof raw.stepOrder === 'boolean' ? raw.stepOrder : process.env.STEP_ORDER === 'off' ? false : DEFAULTS.stepOrder,   // STEP_ORDER=off: test databases (a class setting still wins)
    passPct: Number.isFinite(raw.passPct) ? raw.passPct : DEFAULTS.passPct,
    require: Object.assign({}, DEFAULTS.require, rq),
    practical: Object.assign({}, DEFAULTS.practical, pr, { weights: Object.assign({}, DEFAULTS.practical.weights, pr.weights || {}) }),
    post: Object.assign({}, DEFAULTS.post, raw.post || {}),
    openDates: Object.assign({}, raw.openDates || {})
  };
}
/* validates a teacher's edit; returns { settings } or { error } */
function validate(input, current) {
  const cur = merge(current), inp = input || {};
  const s = merge(Object.assign({}, cur, inp, {
    require: Object.assign({}, cur.require, inp.require),
    practical: Object.assign({}, cur.practical, inp.practical, { weights: Object.assign({}, cur.practical.weights, (inp.practical || {}).weights) }),
    post: Object.assign({}, cur.post, inp.post),
    openDates: Object.assign({}, cur.openDates, inp.openDates) }));   // 3.4: only the weeks sent change (null clears one)
  const inRange = (v, [a, b]) => Number.isInteger(v) && v >= a && v <= b;
  if (inp.require) for (const k of Object.keys(inp.require)) if (!(k in DEFAULTS.require) && k !== 'guided' && k !== 'solve') return { error: 'เงื่อนไขการผ่านไม่ถูกต้อง' };
  if (!inRange(s.passPct, LIMITS.passPct)) return { error: `เกณฑ์แบบทดสอบหลังเรียนต้องเป็น ${LIMITS.passPct[0]}–${LIMITS.passPct[1]}%` };
  if (!inRange(s.practical.passPct, LIMITS.practicalPct)) return { error: `เกณฑ์ผ่านฝึกปฏิบัติต้องเป็น ${LIMITS.practicalPct[0]}–${LIMITS.practicalPct[1]}%` };
  const W = s.practical.weights;
  for (const k of Object.keys(W)) if (!['guided', 'independent', 'trouble'].includes(k) || !inRange(W[k], LIMITS.weight)) return { error: 'สัดส่วนคะแนนฝึกปฏิบัติแต่ละส่วนต้องเป็นจำนวนเต็ม 0–100' };
  if (W.guided + W.independent + W.trouble !== 100) return { error: 'สัดส่วนคะแนน Guided + Independent + Troubleshooting ต้องรวมกันได้ 100%' };
  if (!inRange(s.practical.maxAttempts, LIMITS.maxAttempts)) return { error: `จำนวนรอบฝึกปฏิบัติต้องเป็น ${LIMITS.maxAttempts[0]}–${LIMITS.maxAttempts[1]}` };
  if (!inRange(s.practical.cooldownMin, LIMITS.cooldownMin)) return { error: `เวลารอระหว่างรอบฝึกปฏิบัติต้องเป็น ${LIMITS.cooldownMin[0]}–${LIMITS.cooldownMin[1]} นาที` };
  if (!inRange(s.post.maxAttempts, LIMITS.maxAttempts)) return { error: `จำนวนครั้งที่ทำแบบทดสอบหลังเรียนได้ต้องเป็น ${LIMITS.maxAttempts[0]}–${LIMITS.maxAttempts[1]}` };
  if (!inRange(s.post.cooldownMin, LIMITS.cooldownMin)) return { error: `เวลารอระหว่างครั้งต้องเป็น ${LIMITS.cooldownMin[0]}–${LIMITS.cooldownMin[1]} นาที` };
  if (!['pass-or-last', 'always'].includes(s.post.review)) return { error: 'นโยบายการแสดงเฉลยไม่ถูกต้อง' };
  for (const k of Object.keys(s.require)) if (!(k in DEFAULTS.require) || typeof s.require[k] !== 'boolean') return { error: 'เงื่อนไขการผ่านไม่ถูกต้อง' };
  if (!Object.values(s.require).some(Boolean)) return { error: 'ต้องเลือกเงื่อนไขการผ่านอย่างน้อย 1 ข้อ' };
  for (const [k, v] of Object.entries(s.openDates)) {
    if (!isWeek(k)) return { error: 'สัปดาห์ในวันเปิดบทเรียนไม่ถูกต้อง' };
    if (v === null || v === '') { delete s.openDates[k]; continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v + 'T00:00:00+07:00'))) return { error: `วันเปิดของสัปดาห์ ${weekNo(k)} ไม่ถูกต้อง` };
  }
  return { settings: s };
}
async function settingsFor(user) {
  if (!user || !user.class_id) return { settings: merge(null), classId: null };
  const c = (await db.q('SELECT id, path FROM classes WHERE id=$1', [user.class_id])).rows[0];
  return { settings: merge(c ? c.path : null), classId: c ? c.id : null };
}
const openDateReached = d => !d || Date.now() >= +new Date(d + 'T00:00:00+07:00');   // dates are Thai local days

/* ---------- facts about one student (all weeks at once) ---------- */
let LESSONS_ = null, LABS_ = null;
function lessonsMod() { if (!LESSONS_) LESSONS_ = require('./lessons').LESSONS; return LESSONS_; }
function coreOf(L) {   // core sections and the indexes of their in-lesson exercises (supplementary sections come after)
  if (L._core) return L._core;
  let n = 0; const sections = [], checks = [];
  for (const s of L.sections) for (const b of s.blocks) if (b.type === 'check') { if (!s.extra) checks.push(n); n++; }
  for (const s of L.sections) if (!s.extra) sections.push(s.id);
  return (L._core = { sections, checks });
}
function labWeek(labId) {   // which week a lab belongs to: the week lab itself, or the week hosting a challenge room
  if (isWeek(labId)) return labId;
  const { ROOM_HOST } = require('../content/labs');
  return ROOM_HOST[labId] || null;
}
function weekLabKeys(wid) {
  if (!LABS_) LABS_ = require('./content');
  const { ROOM_HOST } = require('../content/labs');
  const ids = [wid, ...Object.keys(ROOM_HOST).filter(r => ROOM_HOST[r] === wid)];
  return ids.flatMap(id => { const lab = LABS_.LABS.get(id); return lab ? LABS_.labKeys(lab) : []; });
}
function labKeysOfWeekOnly(wid) {
  if (!LABS_) LABS_ = require('./content');
  const lab = LABS_.LABS.get(wid); return lab ? LABS_.labKeys(lab) : [];
}
async function factsOf(userId, S) {
  const q = s => db.q(s, [userId]).then(r => r.rows);
  const [quiz, lp, sims, tasks, comp, logs, runs] = await Promise.all([
    q('SELECT lesson_id, kind, score, max, submitted_at FROM quiz_attempts WHERE user_id=$1'),
    q('SELECT lesson_id, visited, checks FROM lesson_progress WHERE user_id=$1'),
    q('SELECT sim, mission, best, max FROM sim_results WHERE user_id=$1'),
    q('SELECT task_key FROM task_progress WHERE user_id=$1'),
    q('SELECT lesson_id, completed_at FROM week_completions WHERE user_id=$1'),
    q("SELECT lesson_id, count(*)::int n, max(created_at) last FROM quiz_attempt_log WHERE user_id=$1 AND kind='post' AND voided_at IS NULL GROUP BY lesson_id"),
    q('SELECT lab_id FROM lab_runs WHERE user_id=$1')
  ]);
  return { quiz, lp, sims, tasks: new Set(tasks.map(t => t.task_key)), comp: new Map(comp.map(c => [c.lesson_id, +c.completed_at])), logs: new Map(logs.map(l => [l.lesson_id, l])), runs: new Set(runs.map(r => r.lab_id)),
    practical: S ? await require('./practical').factsOf(userId, S.practical) : null };
}
async function unlocksOf(userId, classId) {
  return (await db.q(`SELECT u.id, u.class_id, u.user_id, u.lesson_id, u.kind, u.reason, u.created_at, a.display_name AS actor
      FROM path_unlocks u LEFT JOIN users a ON a.id=u.actor_id
     WHERE u.revoked_at IS NULL AND u.kind <> 'settings' AND (u.user_id=$1 OR ($2::int IS NOT NULL AND u.class_id=$2 AND u.user_id IS NULL))`, [userId, classId])).rows;
}

/* conditions of one week (no database access) */
function criteriaOf(W, F, S) {
  const L = lessonsMod().get(W.id), core = L ? coreOf(L) : { sections: [], checks: [] };
  const lp = F.lp.find(r => r.lesson_id === W.id) || { visited: [], checks: [] };
  const pre = F.quiz.find(r => r.lesson_id === W.id && r.kind === 'pre');
  const post = F.quiz.find(r => r.lesson_id === W.id && r.kind === 'post');
  const visited = core.sections.filter(s => (lp.visited || []).includes(s));
  const checks = core.checks.filter(i => (lp.checks || []).includes(i));
  /* 3.2: practice = the best practical session of the week (server/practical.js), scored with the class weights */
  const pr = (F.practical && F.practical.get(W.id)) || { best: null, passed: false, running: null, attempts: 0, tried: false };
  const PP = S.practical;
  const postPct = post && post.max ? Math.round(100 * post.score / post.max) : null;
  const firstUnread = core.sections.find(s => !(lp.visited || []).includes(s));
  const all = {
    pre: { done: !!pre, detail: pre ? `ทำแล้ว ${pre.score}/${pre.max} (ไม่ใช้เป็นเกณฑ์)` : 'ยังไม่ได้ทำ', link: `#/lesson/${W.id}/pre` },
    content: { done: visited.length >= core.sections.length, detail: `อ่านแล้ว ${visited.length}/${core.sections.length} หัวข้อ`, link: `#/lesson/${W.id}/content${firstUnread ? '/' + firstUnread : ''}` },
    checks: { done: checks.length >= core.checks.length, detail: `ถูก ${checks.length}/${core.checks.length} ข้อ`, link: `#/lesson/${W.id}/content` },
    practice: { done: pr.passed, pct: pr.best, legacy: pr.bestLegacy || false, link: `#/lesson/${W.id}/lab`,
      detail: pr.running ? 'กำลังฝึกปฏิบัติ (จับเวลาอยู่)' : pr.best == null ? `ยังไม่ได้ฝึกปฏิบัติ (เกณฑ์ ${PP.passPct}%)`
        : `คะแนนรวมดีที่สุด ${pr.best}% เกณฑ์ ${PP.passPct}%${pr.bestLegacy ? ' (จากงานที่ทำก่อนปรับระบบ)' : ''} · ใช้ไป ${pr.attempts}/${PP.maxAttempts} รอบ` },
    post: { done: postPct != null && postPct >= S.passPct, detail: postPct == null ? `ยังไม่ได้ทำ (เกณฑ์ ${S.passPct}%)` : `คะแนนดีที่สุด ${post.score}/${post.max} (${postPct}%) เกณฑ์ ${S.passPct}%`, link: `#/lesson/${W.id}/post`, pct: postPct }
  };
  const list = Object.keys(DEFAULTS.require).filter(k => S.require[k]).map(k => Object.assign({ key: k, label: REQUIRE_LABEL[k] }, all[k]));
  /* started: required work only (3.1: the optional review sets stay neutral, so they never make a week "กำลังเรียน");
     startedAny also counts the optional sets and is used only by activate(), so earlier work in them stays reachable */
  const started = !!pre || !!post || visited.length > 0 || (lp.checks || []).length > 0 || pr.tried || !!pr.running;
  const startedAny = started || weekLabKeys(W.id).some(k => F.tasks.has(k));
  /* 3.1: the real state of each lesson step, whether or not the class requires it for unlocking
     todo = not started, doing = started, done = its pass condition holds, review = tried but below the pass mark */
  const learnDone = all.content.done && all.checks.done;
  const steps = {
    pre: pre ? 'done' : 'todo',
    learn: learnDone ? 'done' : (visited.length || (lp.checks || []).length) ? 'doing' : 'todo',
    practice: pr.passed ? 'done' : pr.running ? 'doing' : pr.tried ? 'review' : 'todo',
    post: postPct == null ? 'todo' : postPct >= S.passPct ? 'done' : 'review'
  };
  /* 3.6 step order inside a week: the practical step opens after the earlier required steps (pre-test, content, in-lesson
     exercises) and the post-test after those and the practical step (passed, or every attempt used so nobody is stuck).
     Work already started stays open (a running/tried practical, a post-test already taken); a completed week is all open. */
  const before = { practice: ['pre', 'content', 'checks'], post: ['pre', 'content', 'checks', 'practice'] };
  const prOk = pr.passed || (!pr.running && pr.attempts >= PP.maxAttempts);
  const okOf = k => k === 'practice' ? prOk : all[k].done;
  const order = {};
  for (const step of ['practice', 'post']) {
    const missing = S.stepOrder === false ? [] : before[step].filter(k => S.require[k] && !okOf(k)).map(k => ({ key: k, label: REQUIRE_LABEL[k], link: all[k].link, detail: all[k].detail }));
    const already = step === 'practice' ? (pr.tried || !!pr.running) : !!post;
    order[step] = { ok: already || !missing.length, missing: already ? [] : missing };
  }
  return { list, met: list.every(c => c.done), started, startedAny, postPct, steps, all, order };
}

/* the whole path of a student; records new completions (sticky) as a side effect */
async function evaluate(user, opts = {}) {
  const { settings: S, classId } = opts.settings ? opts : await settingsFor(user);
  if (S.sequential && !opts.noActivate) await activate(user.id, classId, S);
  const [F, U] = await Promise.all([factsOf(user.id, S), unlocksOf(user.id, classId)]);
  const weeks = []; let prevDone = true;
  for (const W of WEEKS) {
    const c = criteriaOf(W, F, S);
    const unlock = U.find(u => u.lesson_id === W.id && u.kind === 'teacher') || U.find(u => u.lesson_id === W.id);
    const date = S.openDates[W.id] || null;
    let open = !S.sequential || W.id === IDS[0] || prevDone || !!unlock;
    let lockReason = null;
    if (!open) lockReason = { needWeek: weekNo(W.id) - 1, message: `ต้องผ่านสัปดาห์ที่ ${weekNo(W.id) - 1} ก่อน จึงจะสามารถเรียนบทเรียนนี้ได้` };
    /* 3.4: an open date locks the week whether or not the class learns in order (a teacher unlock skips it; a week
       already completed stays open below) */
    if (open && date && !openDateReached(date) && !(unlock && unlock.kind === 'teacher')) {
      open = false; lockReason = { openDate: date, message: `บทเรียนนี้เปิดวันที่ ${new Date(date + 'T00:00:00+07:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}` };
    }
    let completedAt = F.comp.get(W.id) || null;
    if (!completedAt && open && c.met) {   // first time all conditions hold while the week is open: record it once
      const r = await db.q(`INSERT INTO week_completions(user_id,lesson_id,criteria) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING completed_at`,
        [user.id, W.id, JSON.stringify({ rules: { passPct: S.passPct, practical: S.practical, require: S.require }, results: c.list.map(x => ({ key: x.key, done: x.done, detail: x.detail })) })]);
      completedAt = r.rows[0] ? +r.rows[0].completed_at : Date.now();
      if (r.rows[0]) F.comp.set(W.id, completedAt);
    }
    const status = completedAt ? 'completed' : !open ? 'locked' : c.started ? 'in_progress' : 'available';
    const log = F.logs.get(W.id);
    const legacyAttempt = F.quiz.some(r => r.lesson_id === W.id && r.kind === 'post') ? 1 : 0;   // a post-test taken before attempts were logged
    weeks.push({ id: W.id, week: weekNo(W.id), status, open: open || !!completedAt, completedAt, lock: completedAt ? null : lockReason,
      unlockedBy: unlock && !prevDone && W.id !== IDS[0] ? { kind: unlock.kind, reason: unlock.reason, by: unlock.actor, at: +unlock.created_at, classWide: !unlock.user_id } : null,
      openDate: date, criteria: c.list, missing: c.list.filter(x => !x.done).map(x => x.key),
      post: { bestPct: c.postPct, attempts: log ? log.n : legacyAttempt, maxAttempts: S.post.maxAttempts, last: log ? +log.last : null },
      /* 3.1: real state of every lesson step (also the steps the class does not require) and the step-4 missions */
      steps: Object.assign({}, c.steps, { summary: completedAt ? 'done' : 'todo' }),
      order: completedAt ? { practice: { ok: true, missing: [] }, post: { ok: true, missing: [] } } : c.order,   // 3.6
      required: Object.keys(DEFAULTS.require).filter(k => S.require[k]),
      practice: { best: c.all.practice.pct, passed: c.all.practice.done, legacy: c.all.practice.legacy, passPct: S.practical.passPct, required: !!S.require.practice } });
    prevDone = !!completedAt;
  }
  const done = weeks.filter(w => w.status === 'completed').length;
  const current = weeks.find(w => w.status !== 'completed' && w.status !== 'locked') || null;
  const next = current ? weeks.find(w => w.week === current.week + 1) || null : null;
  return { sequential: S.sequential, rules: { passPct: S.passPct, practical: S.practical, require: S.require, post: S.post }, weeks, summary: {
    completed: done, remaining: weeks.length - done, current: current ? current.id : null,
    next: next && next.status === 'locked' ? next.id : null, total: weeks.length } };
}

/* earlier work: once per student and class, weeks already started but now locked stay open ('legacy') */
async function activate(userId, classId, S, force) {
  const a = (await db.q('SELECT class_id FROM path_activation WHERE user_id=$1', [userId])).rows[0];
  if (!force && a && (a.class_id || null) === (classId || null)) return null;
  const F = await factsOf(userId, S);
  const legacy = []; let prevDone = true;
  for (const W of WEEKS) {   // walk the chain as evaluate() will: a kept-open week counts as open
    const c = criteriaOf(W, F, S);
    let open = W.id === IDS[0] || prevDone;
    if (!open && c.startedAny) { legacy.push(W.id); open = true; }
    prevDone = F.comp.has(W.id) || (open && c.met);
  }
  const existing = new Set((await unlocksOf(userId, classId)).map(u => u.lesson_id));
  for (const wid of legacy) if (!existing.has(wid))
    await db.q(`INSERT INTO path_unlocks(user_id,lesson_id,kind,reason) VALUES($1,$2,'legacy','เคยเรียนสัปดาห์นี้ก่อนเปิดระบบเรียนตามลำดับ')`, [userId, wid]);
  const report = { legacy, at: Date.now() };
  await db.q(`INSERT INTO path_activation(user_id,class_id,report) VALUES($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET class_id=EXCLUDED.class_id, activated_at=now(), report=EXCLUDED.report`,
    [userId, classId, JSON.stringify(report)]);
  return report;
}

/* ---------- access checks used by the other APIs ---------- */
/* is this lesson week open for this request? guests and teachers are never limited (guests save nothing) */
async function weekAccess(req, wid) {
  if (!req.user || req.user.role !== 'student' || !db.enabled() || !isWeek(wid)) return { ok: true };
  if (!req._path) req._path = await evaluate(req.user);
  const w = req._path.weeks.find(x => x.id === wid);
  return w && w.open ? { ok: true, week: w } : { ok: false, week: w };
}
function lockedReply(res, w) {
  return fail(res, 403, 'locked', (w && w.lock && w.lock.message) || 'บทเรียนนี้ยังไม่เปิด', { lock: w ? w.lock : null, week: w ? w.id : null });
}
/* express middleware factory: wid(req) gives the week id, or null when the request is not about a week */
const guard = wid => wrap(async (req, res, next) => {
  const id = wid(req); if (!id) return next();
  const a = await weekAccess(req, id);
  if (!a.ok) return lockedReply(res, a.week);
  next();
});
/* weeks whose plan uses a simulator mission (a mission can serve several weeks) */
const MISSION_WEEKS = new Map();
for (const W of WEEKS) for (const ref of [...W.guided, ...W.independent, ...W.trouble]) MISSION_WEEKS.set(ref, [...(MISSION_WEEKS.get(ref) || []), W.id]);
/* 3.6: may this student open the practical step / the post-test of week wid now (week open and earlier steps done)? */
async function stepAccess(req, wid, step) {
  const a = await weekAccess(req, wid);
  if (!a.ok || !a.week) return a;
  const o = a.week.order && a.week.order[step];
  return !o || o.ok ? { ok: true, week: a.week } : { ok: false, step: true, week: a.week, missing: o.missing };
}
function stepLockedReply(res, step, missing) {
  const what = step === 'post' ? 'แบบทดสอบหลังเรียน' : 'ฝึกปฏิบัติ';
  return res.status(409).json({ error: 'step_locked', step, missing,
    message: `ยังเปิด${what}ไม่ได้ ทำขั้นก่อนหน้าให้ครบก่อน: ${missing.map(m => m.label).join(', ')}` });
}
async function missionAccess(req, sim, mission) {
  const weeks = MISSION_WEEKS.get(`${sim}:${mission}`) || [];
  if (!weeks.length) return { ok: true };
  for (const w of weeks) { const a = await weekAccess(req, w); if (a.ok) return a; }
  return weekAccess(req, weeks[0]);
}

/* post-test policy for a student and lesson: may another attempt start, and may the answer key be shown */
async function postPolicy(user, lessonId) {
  const { settings: S } = await settingsFor(user);
  const best = (await db.q("SELECT score, max FROM quiz_attempts WHERE user_id=$1 AND lesson_id=$2 AND kind='post'", [user.id, lessonId])).rows[0];
  const log = (await db.q("SELECT count(*)::int n, max(created_at) last FROM quiz_attempt_log WHERE user_id=$1 AND lesson_id=$2 AND kind='post' AND voided_at IS NULL", [user.id, lessonId])).rows[0];
  const attempts = log.n || (best ? 1 : 0);
  const bestPct = best && best.max ? 100 * best.score / best.max : null;
  const passed = bestPct != null && bestPct >= S.passPct;
  const left = Math.max(0, S.post.maxAttempts - attempts);
  const nextAt = log.last && S.post.cooldownMin ? +log.last + S.post.cooldownMin * 60000 : null;
  return { S, attempts, left, passed, bestPct, nextAt: nextAt && nextAt > Date.now() ? nextAt : null,
    showReview: S.post.review === 'always' || passed || left === 0 };
}

/* ---------- student API ---------- */
const router = express.Router();
router.get('/', wrap(async (req, res) => {
  if (!req.user || !db.enabled()) return ok(res, { guest: true, sequential: false, message: 'โหมดผู้เยี่ยมชม: อ่านบทเรียนได้ทุกสัปดาห์ แต่ความก้าวหน้าจะไม่ถูกบันทึกและไม่มีการปลดล็อก เข้าสู่ระบบเพื่อเรียนตามลำดับ' });
  if (req.user.role !== 'student') return ok(res, { teacher: true, sequential: false, message: 'บัญชีครูเปิดได้ทุกสัปดาห์' });
  ok(res, await evaluate(req.user));
}));

/* ---------- teacher API ---------- */
const teacher = express.Router();
async function ownClass(req, res, id) {
  const c = (await db.q('SELECT * FROM classes WHERE id=$1', [Number(id) || 0])).rows[0];
  if (!c || (req.user.role !== 'admin' && c.teacher_id !== req.user.id)) { fail(res, 404, 'no_class', 'ไม่พบห้องเรียนนี้'); return null; }
  return c;
}
async function ownStudent(req, res, uid) {
  const s = (await db.q("SELECT u.id, u.display_name AS name, u.student_no AS no, u.class_id, u.role, c.teacher_id, c.path FROM users u JOIN classes c ON c.id=u.class_id WHERE u.id=$1 AND u.role='student'", [Number(uid) || 0])).rows[0];
  if (!s || (req.user.role !== 'admin' && s.teacher_id !== req.user.id)) { fail(res, 404, 'no_student', 'ไม่พบนักเรียนคนนี้'); return null; }
  return s;
}
const studentsOf = async cid => (await db.q(`SELECT id, display_name AS name, student_no AS no, class_id, 'student' AS role FROM users WHERE class_id=$1 AND role='student' AND NOT disabled
  ORDER BY NULLIF(regexp_replace(student_no,'\\D','','g'),'')::int NULLS LAST, display_name`, [cid])).rows;
const CODE = { completed: 'C', in_progress: 'P', available: 'A', locked: 'L' };

/* class overview: rules, then one row per student (status of every week, current week, what is missing there) */
teacher.get('/classes/:id/path', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const S = merge(c.path), studs = await studentsOf(c.id);
  const rows = [];
  for (const s of studs) {
    const p = await evaluate(s, { settings: S, classId: c.id });
    const cur = p.weeks.find(w => w.id === p.summary.current);
    rows.push({ id: s.id, name: s.name, no: s.no, weeks: p.weeks.map(w => CODE[w.status]), completed: p.summary.completed, current: p.summary.current,
      missing: cur ? cur.missing : [], legacy: p.weeks.filter(w => w.unlockedBy && w.unlockedBy.kind === 'legacy').map(w => w.id),
      teacherUnlocks: p.weeks.filter(w => w.unlockedBy && w.unlockedBy.kind === 'teacher').map(w => w.id) });
  }
  ok(res, { settings: S, raw: c.path, defaults: DEFAULTS, limits: LIMITS, labels: REQUIRE_LABEL, weeks: IDS, students: rows });
}));
/* change the rules (turning sequential learning on checks every student's earlier work first) */
teacher.put('/classes/:id/path', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const v = validate(req.body && req.body.settings, merge(c.path)); if (v.error) return fail(res, 400, 'bad_settings', v.error);
  const before = merge(c.path);
  await db.q('UPDATE classes SET path=$2 WHERE id=$1', [c.id, JSON.stringify(v.settings)]);
  await db.q(`INSERT INTO path_unlocks(class_id,lesson_id,kind,reason,actor_id) VALUES($1,'*','settings',$2,$3)`,
    [c.id, 'เปลี่ยนกติกา: ' + summarize(before, v.settings), req.user.id]);   // history only: kind 'settings' never opens a week
  let report = null;
  if (v.settings.sequential) {
    report = [];
    // turning it on (again) re-checks earlier work: weeks started while it was off stay open
    for (const s of await studentsOf(c.id)) { const r = await activate(s.id, c.id, v.settings, !before.sequential); if (r && r.legacy.length) report.push({ id: s.id, name: s.name, no: s.no, legacy: r.legacy }); }
  }
  ok(res, { ok: true, settings: v.settings, report });
}));
function summarize(a, b) {
  const out = [];
  if (a.sequential !== b.sequential) out.push(b.sequential ? 'เปิดเรียนตามลำดับ' : 'ปิดเรียนตามลำดับ');
  if (a.stepOrder !== b.stepOrder) out.push(b.stepOrder ? 'เปิดล็อกลำดับขั้นในสัปดาห์' : 'ปิดล็อกลำดับขั้นในสัปดาห์');
  if (a.passPct !== b.passPct) out.push(`เกณฑ์หลังเรียน ${a.passPct}% → ${b.passPct}%`);
  const pa = a.practical || {}, pb = b.practical || {};
  if (pa.passPct !== pb.passPct) out.push(`เกณฑ์ผ่านฝึกปฏิบัติ ${pa.passPct}% → ${pb.passPct}%`);
  if (JSON.stringify(pa.weights) !== JSON.stringify(pb.weights)) out.push(`สัดส่วนคะแนน Guided/Independent/Troubleshooting ${pa.weights ? [pa.weights.guided, pa.weights.independent, pa.weights.trouble].join('/') : '-'} → ${[pb.weights.guided, pb.weights.independent, pb.weights.trouble].join('/')}`);
  if (pa.maxAttempts !== pb.maxAttempts || pa.cooldownMin !== pb.cooldownMin) out.push(`ฝึกปฏิบัติได้ ${pb.maxAttempts} รอบ เว้น ${pb.cooldownMin} นาที`);
  if (JSON.stringify(a.require) !== JSON.stringify(b.require)) out.push('เงื่อนไขการผ่าน');
  if (JSON.stringify(a.post) !== JSON.stringify(b.post)) out.push(`สอบหลังเรียน ${b.post.maxAttempts} ครั้ง รอ ${b.post.cooldownMin} นาที`);
  if (JSON.stringify(a.openDates) !== JSON.stringify(b.openDates)) out.push('วันเปิดบทเรียน');
  return out.join(', ') || 'ไม่มีการเปลี่ยน';
}
/* one student: every week with its conditions, post-test attempts and unlock history */
teacher.get('/students/:uid/path', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  const p = await evaluate(s, { settings: merge(s.path), classId: s.class_id });
  const attempts = (await db.q(`SELECT lesson_id, score, max, created_at, voided_at FROM quiz_attempt_log WHERE user_id=$1 AND kind='post' ORDER BY created_at`, [s.id])).rows
    .map(r => ({ lesson: r.lesson_id, score: r.score, max: r.max, at: +r.created_at, voided: !!r.voided_at }));
  ok(res, { student: { id: s.id, name: s.name, no: s.no }, path: p, attempts, history: await historyOf({ userId: s.id, classId: s.class_id }) });
}));
async function historyOf({ userId, classId }) {
  const r = (await db.q(`SELECT u.id, u.lesson_id, u.kind, u.reason, u.created_at, u.revoked_at, u.user_id, u.class_id, a.display_name AS actor, rv.display_name AS revoker, st.display_name AS student
      FROM path_unlocks u LEFT JOIN users a ON a.id=u.actor_id LEFT JOIN users rv ON rv.id=u.revoked_by LEFT JOIN users st ON st.id=u.user_id
     WHERE ${userId ? '(u.user_id=$1::int OR (u.class_id=$2 AND u.user_id IS NULL))' : '($1::int = 0 AND (u.class_id=$2 OR u.user_id IN (SELECT id FROM users WHERE class_id=$2)))'}
     ORDER BY u.created_at DESC LIMIT 500`, [userId || 0, classId])).rows;
  return r.map(x => ({ id: x.id, lesson: x.lesson_id, kind: x.kind, reason: x.reason, at: +x.created_at, revokedAt: x.revoked_at ? +x.revoked_at : null,
    actor: x.actor, revoker: x.revoker, student: x.student, classWide: !x.user_id }));
}
teacher.get('/classes/:id/path/history', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  ok(res, { history: await historyOf({ classId: c.id }) });
}));
const reasonOf = b => String((b && b.reason) || '').trim().slice(0, 300);
teacher.post('/students/:uid/unlock', wrap(async (req, res) => {
  const s = await ownStudent(req, res, req.params.uid); if (!s) return;
  const wid = String(req.body.lesson || ''); if (!isWeek(wid)) return fail(res, 400, 'bad_week', 'เลือกสัปดาห์');
  const r = await db.q(`INSERT INTO path_unlocks(user_id,lesson_id,kind,reason,actor_id) VALUES($1,$2,'teacher',$3,$4) RETURNING id`, [s.id, wid, reasonOf(req.body), req.user.id]);
  ok(res, { ok: true, id: r.rows[0].id });
}));
teacher.post('/classes/:id/unlock', wrap(async (req, res) => {
  const c = await ownClass(req, res, req.params.id); if (!c) return;
  const wid = String(req.body.lesson || ''); if (!isWeek(wid)) return fail(res, 400, 'bad_week', 'เลือกสัปดาห์');
  const r = await db.q(`INSERT INTO path_unlocks(class_id,lesson_id,kind,reason,actor_id) VALUES($1,$2,'teacher',$3,$4) RETURNING id`, [c.id, wid, reasonOf(req.body), req.user.id]);
  ok(res, { ok: true, id: r.rows[0].id });
}));
teacher.post('/unlocks/:id/revoke', wrap(async (req, res) => {
  const u = (await db.q('SELECT * FROM path_unlocks WHERE id=$1 AND revoked_at IS NULL', [Number(req.params.id) || 0])).rows[0];
  if (!u) return fail(res, 404, 'no_unlock', 'ไม่พบการปลดล็อกนี้');
  if (u.user_id ? !(await ownStudent(req, res, u.user_id)) : !(await ownClass(req, res, u.class_id))) return;
  await db.q('UPDATE path_unlocks SET revoked_at=now(), revoked_by=$2 WHERE id=$1', [u.id, req.user.id]);
  ok(res, { ok: true });   // completed weeks stay completed; only the extra opening is removed
}));

/* ---------- one-time migration: classes that existed before keep their behaviour until the teacher turns it on ---------- */
async function migrate() {
  const ID = 'path-1';
  if ((await db.q('SELECT 1 FROM app_migrations WHERE id=$1', [ID])).rowCount) return;
  const r = await db.q('UPDATE classes SET path=$1 WHERE path IS NULL RETURNING id', [JSON.stringify(merge(LEGACY_CLASS))]);
  await db.q('INSERT INTO app_migrations(id,info) VALUES($1,$2) ON CONFLICT DO NOTHING', [ID, JSON.stringify({ legacyClasses: r.rows.map(x => x.id) })]);
  if (r.rowCount) console.log(`Progressive Unlock: ${r.rowCount} existing class(es) keep their previous behaviour until the teacher turns sequential learning on`);
}

/* 3.4: the class timetable (content/learning-path.js SCHEDULE) written once into every class: only weeks without an open
   date get one (a date the teacher already set is kept); recorded in each class's rule history */
async function migrateSchedule() {
  const { SCHEDULE, scheduleDates } = require('../content/learning-path');
  if (process.env.TIMETABLE === 'off') return;   // test databases: no timetable unless a test asks for it
  if ((await db.q('SELECT 1 FROM app_migrations WHERE id=$1', [SCHEDULE.id])).rowCount) return;
  const dates = scheduleDates(SCHEDULE.start, SCHEDULE.everyDays, IDS), done = [];
  for (const c of (await db.q('SELECT id, path FROM classes ORDER BY id')).rows) {
    const raw = c.path && typeof c.path === 'object' ? c.path : {};
    const od = Object.assign({}, raw.openDates || {}), added = [];
    for (const w of IDS) if (!(w in od)) { od[w] = dates[w]; added.push(w); }
    if (!added.length) continue;
    await db.q('UPDATE classes SET path=$2 WHERE id=$1', [c.id, JSON.stringify(Object.assign({}, raw, { openDates: od }))]);
    await db.q(`INSERT INTO path_unlocks(class_id,lesson_id,kind,reason) VALUES($1,'*','settings',$2)`,
      [c.id, `ตั้งวันเปิดบทเรียนตามตารางเรียน${SCHEDULE.term} (${SCHEDULE.weekday} เริ่ม ${dates[IDS[0]]}) ${added.length} สัปดาห์`]);
    done.push({ id: c.id, weeks: added });
  }
  await db.q('INSERT INTO app_migrations(id,info) VALUES($1,$2) ON CONFLICT DO NOTHING', [SCHEDULE.id, JSON.stringify({ dates, classes: done })]);
  if (done.length) console.log(`Class timetable: open dates set for ${done.length} class(es), week 1 opens ${dates[IDS[0]]}`);
}
/* a class created while the term runs starts with the timetable (empty when the term is over) */
function scheduleForNewClass() {
  const { SCHEDULE, scheduleDates } = require('../content/learning-path');
  if (process.env.TIMETABLE === 'off') return null;
  const dates = scheduleDates(SCHEDULE.start, SCHEDULE.everyDays, IDS);
  return openDateReached(dates[IDS[IDS.length - 1]]) ? null : { openDates: dates };
}
module.exports = { router, teacher, evaluate, weekAccess, missionAccess, guard, lockedReply, labWeek, postPolicy, settingsFor, merge, validate, stepAccess, stepLockedReply, migrate, migrateSchedule, scheduleForNewClass, activate, IDS };
