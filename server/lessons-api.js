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
  for (const r of q) {
    const L = LESSONS.get(r.lesson_id);
    const x = { score: r.score, max: r.max, at: +r.submitted_at };
    if (r.kind === 'post' && L) x.review = reviewFor(L, r.results, r.form);
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
router.get('/:id', (req, res) => {
  const s = PUBLIC.get(req.params.id);
  if (!s) return fail(res, 404, 'no_lesson', 'ไม่พบบทเรียนนี้');
  res.type('json').set('Cache-Control', 'no-cache').send(s);
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
router.post('/:id/quiz', auth.rateLimit(30, 600), wrap(async (req, res) => {
  const L = LESSONS.get(req.params.id); if (!L) return fail(res, 404, 'no_lesson', 'ไม่พบบทเรียนนี้');
  const kind = req.body.kind;
  if (!['pre', 'post'].includes(kind)) return fail(res, 400, 'bad_kind', 'ประเภทแบบทดสอบไม่ถูกต้อง');
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const items = formOf(L, kind), form = items === L.quiz ? 'A' : 'B';
  if (answers.length !== items.length) return fail(res, 400, 'incomplete', 'ตอบให้ครบทุกข้อก่อนส่ง');
  const results = items.map((q, i) => {
    const c = check(q, answers[i]);
    return { correct: !c.empty && c.correct, given: c.empty ? '' : logAnswer(q, answers[i]) };
  });
  const score = results.filter(r => r.correct).length;
  if (req.user && db.enabled()) {
    if (kind === 'pre') {
      const post = await db.q("SELECT 1 FROM quiz_attempts WHERE user_id=$1 AND lesson_id=$2 AND kind='post'", [req.user.id, L.id]);
      if (post.rowCount) return fail(res, 409, 'post_done', 'ทำแบบทดสอบหลังเรียนไปแล้ว จึงทำแบบทดสอบก่อนเรียนไม่ได้');
    }
    const r = await db.q(`INSERT INTO quiz_attempts(user_id,lesson_id,kind,answers,results,score,max,form) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
                          ON CONFLICT DO NOTHING RETURNING score`, [req.user.id, L.id, kind, JSON.stringify(answers), JSON.stringify(results), score, items.length, form]);
    if (!r.rowCount) return fail(res, 409, 'done', kind === 'pre' ? 'ทำแบบทดสอบก่อนเรียนไปแล้ว' : 'ทำแบบทดสอบหลังเรียนไปแล้ว ถ้าต้องการทำใหม่ให้ครูรีเซ็ตให้');
  }
  const out = { kind, form, score, max: items.length, at: Date.now() };
  // the pre-test does not reveal answers; the post-test uses a parallel form B testing the same objectives
  if (kind === 'post') out.review = reviewFor(L, results, form);
  else out.results = results.map(r => ({ correct: r.correct }));
  ok(res, out);
}));

module.exports = { router, lessonProgressOf };
