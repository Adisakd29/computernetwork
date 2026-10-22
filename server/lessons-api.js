'use strict';
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const { LESSONS, QKEYS, PUBLIC, answerText, formOf } = require('./lessons');
const lessonsMod = require('./lessons');
const { check, logAnswer } = require('./grading');

const router = express.Router();
const ok = (res, d) => res.json(d);
const fail = (res, code, error, message) => res.status(code).json({ error, message });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* progress summary for /api/me */
async function lessonProgressOf(userId) {
  const out = {};
  const get = id => (out[id] = out[id] || { visited: [], checks: [] });
  const q = (await db.q('SELECT lesson_id,kind,score,max,results,submitted_at,form FROM quiz_attempts WHERE user_id=$1', [userId])).rows;
  // Progressive Unlock: the post-test answer key is part of the progress only when the class rules allow it
  const u = (await db.q('SELECT id, class_id FROM users WHERE id=$1', [userId])).rows[0];
  const { settings: S } = await require('./path').settingsFor(u);
  const logs = new Map((await db.q("SELECT lesson_id, count(*)::int n FROM quiz_attempt_log WHERE user_id=$1 AND kind='post' AND voided_at IS NULL GROUP BY lesson_id", [userId])).rows.map(r => [r.lesson_id, r.n]));
  for (const r of q) {
    const L = LESSONS.get(r.lesson_id);
    const x = { score: r.score, max: r.max, at: +r.submitted_at };
    if (r.kind === 'post' && L) {
      const attempts = logs.get(r.lesson_id) || 1, passed = r.max && 100 * r.score / r.max >= S.passPct;
      Object.assign(x, { form: r.form || 'A', attempts, maxAttempts: S.post.maxAttempts, passPct: S.passPct, passed: !!passed });
      if (S.post.review === 'always' || passed || attempts >= S.post.maxAttempts) x.review = reviewFor(L, r.results, r.form); else x.reviewLocked = true;
    }
    get(r.lesson_id)[r.kind] = x;
  }
  const p = (await db.q('SELECT lesson_id,visited,checks,last_section FROM lesson_progress WHERE user_id=$1', [userId])).rows;
  for (const r of p) { const x = get(r.lesson_id); x.visited = r.visited; x.checks = r.checks; if (r.last_section) x.last = r.last_section; }
  return out;
}
/* form 'B' = parallel post-test; attempts made before forms existed are 'A' */
function reviewFor(L, results, form) {
  const items = form === 'B' && L.quizB ? L.quizB : L.quiz;
  return items.map((q, i) => ({ q: q.q, correct: !!(results[i] && results[i].correct), given: results[i] && results[i].given, answer: answerText(q), explain: q.explain,
    why: !(results[i] && results[i].correct) && q.type === 'choice' && Array.isArray(q.why) && results[i] && results[i].given ? (q.why[q.options.indexOf(results[i].given)] || undefined) : undefined }));
}

router.get('/', (req, res) => res.type('json').set('Cache-Control', 'no-cache').send(lessonsMod.META));
/* full-text search over lesson sections; t = terms separated by | (the client expands synonyms) */
router.get('/search', (req, res) => {
  const terms = String(req.query.t || '').toLowerCase().split('|').map(x => x.trim()).filter(x => x.length >= 2).slice(0, 12);
  if (!terms.length) return res.json({ hits: [] });
  const hits = [];
  for (const x of lessonsMod.SEARCH) {
    let best = -1, score = 0;
    for (const t of terms) { const i = x.low.indexOf(t); if (i >= 0) { score += (x.stitle.toLowerCase().includes(t) ? 5 : 1) + (t === terms[0] ? 2 : 0); if (best < 0 || i < best) best = i; } }
    if (best < 0) continue;
    const a = Math.max(0, best - 60), snippet = (a ? '…' : '') + x.text.slice(a, best + 120) + (best + 120 < x.text.length ? '…' : '');
    hits.push({ lesson: x.lesson, week: x.week, ltitle: x.ltitle, section: x.section, stitle: x.stitle, snippet, score });
  }
  hits.sort((p, q) => q.score - p.score || p.week - q.week);
  res.json({ hits: hits.slice(0, 40), total: hits.length });
});
router.get('/glossary', (req, res) => res.type('json').set('Cache-Control', 'no-cache').send(lessonsMod.GLOSSARY));
/* Progressive Unlock: a logged-in student cannot open, practise in, or be scored on a locked week (server-side) */
router.use('/:id', (req, res, next) => require('./path').guard(r => (/^w\d+$/.test(r.params.id) ? r.params.id : null))(req, res, next));
router.get('/:id', (req, res) => {
  const s = PUBLIC.get(req.params.id);
  if (!s) return fail(res, 404, 'no_lesson', 'ไม่พบบทเรียนนี้');
  res.type('json').set('Cache-Control', req.user ? 'private, no-cache' : 'no-cache').send(s);
});

/* in-lesson exercise: practice, unlimited tries, immediate feedback */
router.post('/:id/check', auth.rateLimit(120, 2400), wrap(async (req, res) => {
  const k = QKEYS.get(String(req.body.key || ''));
  if (!k || k.kind !== 'check' || k.lesson.id !== req.params.id) return fail(res, 404, 'no_q', 'ไม่พบแบบฝึกหัด');
  const c = check(k.q, req.body.answer);
  if (c.empty) return fail(res, 400, 'empty', 'ยังไม่ได้ตอบ');
  let why;
  if (!c.correct && k.q.type === 'choice' && Array.isArray(k.q.why)) why = k.q.why[Number(req.body.answer)] || undefined;
  if (c.correct && req.user && db.enabled()) {
    await db.q(`INSERT INTO lesson_progress(user_id,lesson_id,checks) VALUES($1,$2,$3::jsonb)
                ON CONFLICT (user_id,lesson_id) DO UPDATE SET checks = (SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements(lesson_progress.checks || $3::jsonb) AS e(v)), updated_at=now()`,
      [req.user.id, k.lesson.id, JSON.stringify([k.index])]);
  }
  ok(res, { correct: c.correct, explain: c.correct ? k.q.explain : undefined, why });
}));

/* mark a section as read */
router.post('/:id/visit', auth.rateLimit(120, 2400), wrap(async (req, res) => {
  const L = LESSONS.get(req.params.id); if (!L) return fail(res, 404, 'no_lesson', 'ไม่พบบทเรียนนี้');
  const sid = String(req.body.section || '');
  if (!L.sections.some(s => s.id === sid)) return fail(res, 400, 'bad_section', 'ไม่พบหัวข้อนี้');
  if (req.user && db.enabled()) {
    if (req.body.last === true) {   // reading position only (does not mark the section as read)
      await db.q(`INSERT INTO lesson_progress(user_id,lesson_id,last_section) VALUES($1,$2,$3)
                  ON CONFLICT (user_id,lesson_id) DO UPDATE SET last_section=$3, updated_at=now()`, [req.user.id, L.id, sid]);
    } else {
      await db.q(`INSERT INTO lesson_progress(user_id,lesson_id,visited,last_section) VALUES($1,$2,$3::jsonb,$4)
                  ON CONFLICT (user_id,lesson_id) DO UPDATE SET visited = (SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements(lesson_progress.visited || $3::jsonb) AS e(v)), updated_at=now()`,
        [req.user.id, L.id, JSON.stringify([sid]), sid]);
    }
  }
  ok(res, { ok: true });
}));

/* pre-test / post-test: whole quiz submitted at once, graded on the server, one official attempt each */
/* 3.0 P5: when the class requires practice, the post-test opens only after the week's Guided Lab missions are passed */
router.get('/:id/gate', wrap(async (req, res) => {
  if (!LESSONS.get(req.params.id)) return fail(res, 404, 'no_lesson', 'ไม่พบบทเรียนนี้');
  ok(res, await require('./portfolio').practiceGate(req.user, req.params.id));
}));
router.post('/:id/quiz', auth.rateLimit(30, 600), wrap(async (req, res) => {
  const L = LESSONS.get(req.params.id); if (!L) return fail(res, 404, 'no_lesson', 'ไม่พบบทเรียนนี้');
  const kind = req.body.kind;
  if (!['pre', 'post'].includes(kind)) return fail(res, 400, 'bad_kind', 'ประเภทแบบทดสอบไม่ถูกต้อง');
  // 3.0 P6: the post-test returns the full answer key, so with accounts available it is for logged-in students only
  // (a guest could otherwise read form B's answers and then score 10/10 in their one official attempt)
  if (kind === 'post' && db.enabled() && !req.user) return fail(res, 401, 'login_required', 'เข้าสู่ระบบก่อนทำแบบทดสอบหลังเรียน เพราะผลและเฉลยผูกกับบัญชีของนักเรียน');
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const items = formOf(L, kind), form = items === L.quiz ? 'A' : 'B';
  if (answers.length !== items.length) return fail(res, 400, 'incomplete', 'ตอบให้ครบทุกข้อก่อนส่ง');
  const results = items.map((q, i) => {
    const c = check(q, answers[i]);
    return { correct: !c.empty && c.correct, given: c.empty ? '' : logAnswer(q, answers[i]) };
  });
  const score = results.filter(r => r.correct).length;
  if (req.user && db.enabled() && kind === 'post') {
    const g = await require('./portfolio').practiceGate(req.user, L.id);
    if (g.required && g.missing.length) return res.status(409).json({ error: 'practice_required', message: 'ครูกำหนดให้ผ่านขั้นฝึกปฏิบัติของสัปดาห์นี้ก่อนทำแบบทดสอบหลังเรียน' + g.missing.map(m => ` (ผลดีที่สุดตอนนี้ ${m.best == null ? 'ยังไม่ได้ทำ' : m.best + '%'} ต้องได้อย่างน้อย ${m.passPct}%)`).join(''), missing: g.missing });
  }
  if (req.user && db.enabled() && kind === 'pre') {
    const post = await db.q("SELECT 1 FROM quiz_attempts WHERE user_id=$1 AND lesson_id=$2 AND kind='post'", [req.user.id, L.id]);
    if (post.rowCount) return fail(res, 409, 'post_done', 'ทำแบบทดสอบหลังเรียนไปแล้ว จึงทำแบบทดสอบก่อนเรียนไม่ได้');
    const r = await db.q(`INSERT INTO quiz_attempts(user_id,lesson_id,kind,answers,results,score,max,form) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
                          ON CONFLICT DO NOTHING RETURNING score`, [req.user.id, L.id, kind, JSON.stringify(answers), JSON.stringify(results), score, items.length, form]);
    if (!r.rowCount) return fail(res, 409, 'done', 'ทำแบบทดสอบก่อนเรียนไปแล้ว');
  }
  const out = { kind, form, score, max: items.length, at: Date.now() };
  if (kind === 'pre') { out.results = results.map(r => ({ correct: r.correct })); return ok(res, out); }   // the pre-test never reveals answers
  if (!req.user || !db.enabled()) { out.review = reviewFor(L, results, form); return ok(res, out); }   // guest-only install (no accounts)
  /* Progressive Unlock: post-test attempts follow the class rules (content/learning-path.js); every attempt is logged,
     quiz_attempts keeps the best one; the answer key is shown after passing, after the last attempt, or always (rule) */
  const path = require('./path');
  const P0 = await path.postPolicy(req.user, L.id), S = P0.S;
  const pct = 100 * score / items.length;
  const result = await db.tx(async cx => {
    await cx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`post:${req.user.id}:${L.id}`]);   // one attempt at a time
    const best = (await cx.query("SELECT score, max FROM quiz_attempts WHERE user_id=$1 AND lesson_id=$2 AND kind='post'", [req.user.id, L.id])).rows[0];
    const log = (await cx.query("SELECT count(*)::int n, max(created_at) last FROM quiz_attempt_log WHERE user_id=$1 AND lesson_id=$2 AND kind='post' AND voided_at IS NULL", [req.user.id, L.id])).rows[0];
    const attempts = log.n || (best ? 1 : 0);
    if (best && best.max && 100 * best.score / best.max >= S.passPct) return { err: [409, 'passed', 'ผ่านแบบทดสอบหลังเรียนของบทนี้แล้ว ไม่ต้องทำซ้ำ'] };
    if (attempts >= S.post.maxAttempts) return { err: S.post.maxAttempts === 1 ? [409, 'done', 'ทำแบบทดสอบหลังเรียนไปแล้ว ถ้าต้องการทำใหม่ให้ครูรีเซ็ตให้']
      : [409, 'no_attempts', `ใช้สิทธิ์ทำแบบทดสอบหลังเรียนครบ ${S.post.maxAttempts} ครั้งแล้ว ติดต่อครูเพื่อขอรีเซ็ตหรือปลดล็อก`] };
    const nextAt = log.last && S.post.cooldownMin ? +log.last + S.post.cooldownMin * 60000 : 0;
    if (nextAt > Date.now()) return { err: [429, 'cooldown', `ทำใหม่ได้หลังเวลา ${new Date(nextAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} น. ระหว่างนี้ทบทวนเนื้อหาและแบบฝึกหัด`], nextAt };
    if (best && !log.n) await cx.query(`INSERT INTO quiz_attempt_log(user_id,lesson_id,kind,answers,results,score,max,form,created_at)
        SELECT user_id,lesson_id,kind,answers,results,score,max,form,submitted_at FROM quiz_attempts WHERE user_id=$1 AND lesson_id=$2 AND kind='post'`, [req.user.id, L.id]);   // the attempt made before logging existed
    await cx.query(`INSERT INTO quiz_attempt_log(user_id,lesson_id,kind,answers,results,score,max,form) VALUES($1,$2,'post',$3,$4,$5,$6,$7)`,
      [req.user.id, L.id, JSON.stringify(answers), JSON.stringify(results), score, items.length, form]);
    if (!best) await cx.query(`INSERT INTO quiz_attempts(user_id,lesson_id,kind,answers,results,score,max,form) VALUES($1,$2,'post',$3,$4,$5,$6,$7)`,
      [req.user.id, L.id, JSON.stringify(answers), JSON.stringify(results), score, items.length, form]);
    else if (score > best.score) await cx.query(`UPDATE quiz_attempts SET answers=$3, results=$4, score=$5, max=$6, form=$7, submitted_at=now() WHERE user_id=$1 AND lesson_id=$2 AND kind='post'`,
      [req.user.id, L.id, JSON.stringify(answers), JSON.stringify(results), score, items.length, form]);
    return { attempt: attempts + 1, best: Math.max(score, best ? best.score : 0) };
  });
  if (result.err) return res.status(result.err[0]).json({ error: result.err[1], message: result.err[2], ...(result.nextAt ? { nextAt: result.nextAt } : {}) });
  const passed = pct >= S.passPct, left = Math.max(0, S.post.maxAttempts - result.attempt);
  Object.assign(out, { attempt: result.attempt, attemptsLeft: left, maxAttempts: S.post.maxAttempts, passPct: S.passPct, passed, best: result.best,
    nextAt: !passed && left && S.post.cooldownMin ? Date.now() + S.post.cooldownMin * 60000 : null });
  if (S.post.review === 'always' || passed || left === 0) out.review = reviewFor(L, results, form);
  else {
    out.reviewLocked = true;
    out.message = `ยังไม่ถึงเกณฑ์ ${S.passPct}% (ได้ ${score}/${items.length}) ทบทวนเนื้อหาและแบบฝึกหัดของบทนี้ แล้วทำใหม่ได้อีก ${left} ครั้ง` +
      (S.post.cooldownMin ? ` หลังรอ ${S.post.cooldownMin} นาที` : '') + ' เฉลยจะแสดงเมื่อผ่านเกณฑ์หรือใช้สิทธิ์ครบ';
  }
  ok(res, out);
}));

module.exports = { router, lessonProgressOf };
