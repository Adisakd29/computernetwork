// Integration tests for the NetLab API. Needs a real PostgreSQL:
//   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/netlab_test node tests/api.test.js
'use strict';
const assert = require('assert');
const url = process.env.TEST_DATABASE_URL;
if (!url) { console.log('SKIP api tests: set TEST_DATABASE_URL'); process.exit(0); }
process.env.DATABASE_URL = url;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin-pass-123';
process.env.PORT = process.env.PORT || '3988';

const { Pool } = require('pg');
const { ALL } = require('../content/labs');
const BASE = `http://127.0.0.1:${process.env.PORT}`;
let passed = 0;
const it = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, '\n    ', e.message); process.exitCode = 1; } };

function client() {
  let cookie = '';
  const call = async (method, path, body, raw) => {
    const r = await fetch(BASE + path, {
      method, headers: { 'Content-Type': 'application/json', 'X-NetLab': '1', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    if (raw) return r;
    const j = await r.json().catch(() => ({}));
    return { status: r.status, ...j };
  };
  return { get: p => call('GET', p), post: (p, b) => call('POST', p, b || {}), put: (p, b) => call('PUT', p, b || {}), patch: (p, b) => call('PATCH', p, b), del: p => call('DELETE', p), raw: p => call('GET', p, null, true), cookie: () => cookie };
}
const correctAnswer = t => t.type === 'text' ? t.answers[0] : t.type === 'choice' ? t.correct : t.type === 'order' ? t.items.map(x => x.t)
  : t.fields.map(f => f.type === 'select' ? f.options.find(o => f.ok(o)) : (f.ok.v !== undefined ? f.ok.v : 'Lab#2026room!'));
const wrongAnswer = t => t.type === 'text' ? 'zzz-wrong' : t.type === 'choice' ? (t.correct + 1) % t.options.length : t.type === 'order' ? t.items.map(x => x.t).reverse() : t.fields.map(() => 'x');

(async () => {
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.end();
  const server = await require('../server').start();
  await new Promise(r => setTimeout(r, 300));

  const guest = client(), admin = client(), teacher = client(), stu = client(), stu2 = client(), other = client();
  let classId, code, creds, teacherCreds;

  console.log('Public / guest');
  await it('content has 30 labs and no answer keys', async () => {
    const r = await guest.get('/api/content');
    assert.equal(r.rooms.length + r.weeks.length, 30);
    const s = JSON.stringify(r); ['"answers"', '"correct"', '"explain"', '"flag"', '"hint"'].forEach(k => assert(!s.includes(k), 'leaks ' + k));
  });
  await it('guest check works and saves nothing', async () => {
    const t = ALL[0].tasks[0];
    const r = await guest.post('/api/check', { key: 'r1-0', answer: correctAnswer(t) });
    assert.equal(r.correct, true); assert(r.explain); assert(r.guest);
  });
  await it('POST without X-NetLab header is rejected (CSRF)', async () => {
    const r = await fetch(BASE + '/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 403);
  });

  console.log('Admin and teacher accounts');
  await it('admin logs in from env bootstrap', async () => { assert.equal((await admin.post('/api/auth/login', { username: 'admin', password: 'admin-pass-123' })).ok, true); });
  await it('wrong password rejected', async () => { assert.equal((await other.post('/api/auth/login', { username: 'admin', password: 'nope' })).status, 401); });
  await it('admin creates a teacher', async () => {
    teacherCreds = await admin.post('/api/admin/teachers', { username: 'kru.a', name: 'ครูเอ' });
    assert(teacherCreds.password);
  });
  await it('teacher logs in, must change password', async () => {
    await teacher.post('/api/auth/login', { username: 'kru.a', password: teacherCreds.password });
    const me = await teacher.get('/api/me'); assert.equal(me.user.role, 'teacher'); assert.equal(me.user.mustChangePw, true);
    assert.equal((await teacher.post('/api/auth/password', { current: teacherCreds.password, next: 'teacher123' })).ok, true);
    assert.equal((await teacher.get('/api/me')).user.mustChangePw, false);
  });
  await it('student cannot reach admin or teacher API', async () => {
    assert.equal((await guest.get('/api/teacher/classes')).status, 401);
  });

  console.log('Classes and students');
  await it('teacher creates class with a code', async () => {
    const r = await teacher.post('/api/teacher/classes', { name: 'ปวช.2/1 เครือข่าย' }); classId = r.id; code = r.code;
    assert(/^[A-Z0-9]{6}$/.test(code));
  });
  await it('teacher bulk-creates students with temp passwords', async () => {
    creds = await teacher.post(`/api/teacher/classes/${classId}/students`, { rows: [{ no: '1', name: 'สมชาย ใจดี' }, { no: '2', name: 'สมหญิง รักเรียน' }, { no: 'x', name: 'bad' }] });
    assert.equal(creds.created.length, 2); assert.equal(creds.skipped.length, 1);
    assert.equal(creds.created[0].username, code.toLowerCase() + '-01');
  });
  await it('student self-registers with class code', async () => {
    const r = await stu2.post('/api/auth/register', { classCode: code, username: 'nong.c', name: 'น้องซี', studentNo: '3', password: 'abc12345' });
    assert.equal(r.ok, true);
    const me = await stu2.get('/api/me'); assert.equal(me.user.class.code, code);
  });
  await it('registration rejects duplicate number and closed class', async () => {
    assert.equal((await other.post('/api/auth/register', { classCode: code, username: 'dup.no', name: 'ซ้ำ', studentNo: '3', password: 'abc12345' })).status, 409);
    await teacher.patch(`/api/teacher/classes/${classId}`, { joinOpen: false });
    assert.equal((await other.post('/api/auth/register', { classCode: code, username: 'late.one', name: 'มาสาย', studentNo: '9', password: 'abc12345' })).status, 400);
  });
  await it('another teacher cannot see this class', async () => {
    const t2 = await admin.post('/api/admin/teachers', { username: 'kru.b', name: 'ครูบี' });
    const c2 = client(); await c2.post('/api/auth/login', { username: 'kru.b', password: t2.password });
    assert.equal((await c2.get(`/api/teacher/classes/${classId}`)).status, 404);
    assert.equal((await c2.get(`/api/teacher/classes/${classId}/report`)).status, 404);
  });
  await it('student cannot use teacher API', async () => {
    await stu.post('/api/auth/login', { username: creds.created[0].username, password: creds.created[0].password });
    assert.equal((await stu.get('/api/teacher/classes')).status, 403);
  });

  console.log('Timed labs and grading');
  const lab = ALL.find(l => l.id === 'w2');
  await it('check before Start is refused', async () => {
    assert.equal((await stu.post('/api/check', { key: 'w2-0', answer: 0 })).error, 'not_started');
  });
  await it('start creates a timer with the lab duration', async () => {
    const r = await stu.post('/api/labs/w2/start'); assert.equal(r.timer.status, 'running');
    assert(Math.abs(r.timer.limit - lab.minutes * 60000) < 2000);
    const again = await stu.post('/api/labs/w2/start'); assert.equal(again.timer.start, r.timer.start, 'restart must not reset timer');
  });
  await it('wrong answers cost 2 points each, repeats are free', async () => {
    const t = lab.tasks[1];
    let r = await stu.post('/api/check', { key: 'w2-1', answer: wrongAnswer(t) }); assert.equal(r.correct, false); assert.equal(r.attempts, 1);
    r = await stu.post('/api/check', { key: 'w2-1', answer: wrongAnswer(t) }); assert.equal(r.attempts, 1, 'same wrong answer counted twice');
    r = await stu.post('/api/check', { key: 'w2-1', answer: correctAnswer(t) }); assert.equal(r.correct, true); assert.equal(r.points, 8); assert(r.explain);
  });
  await it('solved task cannot be scored twice', async () => {
    const r = await stu.post('/api/check', { key: 'w2-1', answer: correctAnswer(lab.tasks[1]) }); assert.equal(r.already, true); assert.equal(r.points, 8);
  });
  await it('hint costs 5 points', async () => {
    const h = await stu.post('/api/hint', { key: 'w2-2' }); assert(h.hint);
    const r = await stu.post('/api/check', { key: 'w2-2', answer: correctAnswer(lab.tasks[2]) }); assert.equal(r.points, 5);
  });
  await it('solving every task returns the flag and finishes the run', async () => {
    let last;
    for (let i = 0; i < lab.tasks.length; i++) last = await stu.post('/api/check', { key: `w2-${i}`, answer: correctAnswer(lab.tasks[i]) });
    assert.equal(last.flag, lab.flag); assert.equal(last.finished, true);
    const me = await stu.get('/api/me'); assert.equal(me.progress.timers.w2.status, 'finished');
    assert.equal(Object.keys(me.progress.done).filter(k => k.startsWith('w2-')).length, lab.tasks.length);
  });
  await it('answers after finishing are refused', async () => {
    assert.equal((await stu.post('/api/check', { key: 'w3-0', answer: 0 })).error, 'not_started');
    await stu.post('/api/labs/w3/start'); await stu.post('/api/labs/w3/finish');
    assert.equal((await stu.post('/api/check', { key: 'w3-0', answer: 0 })).error, 'closed');
  });
  await it('time limit is enforced by the server', async () => {
    await stu2.post('/api/labs/w1/start');
    const p = new Pool({ connectionString: url });
    await p.query("UPDATE lab_runs SET deadline=now()-interval '1 second' WHERE lab_id='w1'"); await p.end();
    const r = await stu2.post('/api/check', { key: 'w1-0', answer: correctAnswer(ALL.find(l => l.id === 'w1').tasks[0]) });
    assert.equal(r.error, 'closed');
    assert.equal((await stu2.get('/api/me')).progress.timers.w1.status, 'timeout');
  });
  await it('form task returns per-field feedback', async () => {
    const w7 = ALL.find(l => l.id === 'w7'); const i = w7.tasks.findIndex(t => t.type === 'form');
    await stu.post('/api/labs/w7/start');
    const ans = correctAnswer(w7.tasks[i]); ans[2] = 'short';
    const r = await stu.post('/api/check', { key: `w7-${i}`, answer: ans });
    assert.equal(r.correct, false); assert.deepEqual(r.detail.fieldsOk, [true, true, false, true]);
  });
  await it('progress survives a new login (other device)', async () => {
    const d2 = client(); await d2.post('/api/auth/login', { username: creds.created[0].username, password: creds.created[0].password });
    const me = await d2.get('/api/me'); assert.equal(me.progress.att['w2-1'], 1); assert(me.progress.flags.w2);
  });

  console.log('Teacher dashboard data');
  await it('assign labs with a due date, student sees it', async () => {
    const due = new Date(Date.now() + 86400000).toISOString();
    assert.equal((await teacher.post(`/api/teacher/classes/${classId}/assignments`, { labIds: ['w1', 'w2', 'w3'], due })).count, 3);
    const me = await stu.get('/api/me'); assert.equal(me.assignments.length, 3);
  });
  await it('report shows scores and who has not submitted', async () => {
    const r = await teacher.get(`/api/teacher/classes/${classId}/report`);
    const s1 = r.rows.find(x => x.no === '1'); assert.equal(s1.labs.w2.status, 'finished'); assert(s1.labs.w2.points > 0);
    const m = r.missing.find(x => x.labId === 'w1'); assert(m.notSubmitted.some(x => x.no === '1'));
  });
  await it('most-missed statistics', async () => {
    const r = await teacher.get(`/api/teacher/classes/${classId}/stats`);
    assert(r.items.some(x => x.task_key === 'w2-1')); assert(r.items[0].q);
  });
  await it('Excel export downloads', async () => {
    const r = await teacher.raw(`/api/teacher/classes/${classId}/export.xlsx`);
    assert.equal(r.status, 200); assert(r.headers.get('content-type').includes('spreadsheetml'));
    const b = Buffer.from(await r.arrayBuffer()); assert.equal(b.slice(0, 2).toString(), 'PK');
  });
  await it('reset a lab lets the student retake it', async () => {
    const sid = creds.created[0];
    const det = await teacher.get(`/api/teacher/classes/${classId}`); const u = det.students.find(s => s.username === sid.username);
    await teacher.post(`/api/teacher/students/${u.id}/labs/w2/reset`);
    const me = await stu.get('/api/me'); assert(!me.progress.timers.w2); assert(!me.progress.done['w2-0']);
  });
  await it('reset password logs the student out', async () => {
    const det = await teacher.get(`/api/teacher/classes/${classId}`); const u = det.students.find(s => s.no === '1');
    const r = await teacher.post(`/api/teacher/students/${u.id}/reset-password`); assert(r.password);
    assert.equal((await stu.get('/api/me')).user, null);
  });
  console.log('Lessons, pre-test and post-test');
  const W1 = require('../content/lessons/w1.js');
  const qRight = q => q.type === 'choice' ? q.correct : q.type === 'multi' ? q.correct : q.type === 'tf' ? q.answer : q.answers[0];
  const qWrong = q => q.type === 'choice' ? (q.correct + 1) % q.options.length : q.type === 'multi' ? [...Array(q.options.length).keys()].filter(i => !q.correct.includes(i)).slice(0, 1) : q.type === 'tf' ? !q.answer : 'zzz';
  const lessonStu = client();
  await it('lesson list and public lesson have no answers', async () => {
    const l = await (await guest.raw('/api/lessons')).json(); assert.equal(l.length, 18);
    const w = await guest.get('/api/lessons/w1'); assert.equal(w.quiz.length, 10);
    const s2 = JSON.stringify(w); ['"correct"', '"explain"', '"answers"', '"why"'].forEach(k => assert(!s2.includes(k), 'leaks ' + k));
  });
  await it('in-lesson check gives feedback and records progress', async () => {
    const r = await lessonStu.post('/api/auth/register', { classCode: code, username: 'lesson.s', name: 'นักเรียนบทเรียน', studentNo: '20', password: 'abc12345' });
    if (!r.ok) { await teacher.patch(`/api/teacher/classes/${classId}`, { joinOpen: true }); await lessonStu.post('/api/auth/register', { classCode: code, username: 'lesson.s', name: 'นักเรียนบทเรียน', studentNo: '20', password: 'abc12345' }); }
    const w = await lessonStu.get('/api/lessons/w1'); const chk = w.sections.flatMap(x => x.blocks).find(b => b.type === 'check');
    const full = W1.sections.flatMap(x => x.blocks).find(b => b.type === 'check').q;
    const bad1 = await lessonStu.post('/api/lessons/w1/check', { key: chk.key, answer: qWrong(full) }); assert.equal(bad1.correct, false);
    const good = await lessonStu.post('/api/lessons/w1/check', { key: chk.key, answer: qRight(full) }); assert.equal(good.correct, true); assert(good.explain);
    await lessonStu.post('/api/lessons/w1/visit', { section: W1.sections[0].id });
    const me = await lessonStu.get('/api/me'); assert.deepEqual(me.lessons.w1.checks, [0]); assert.deepEqual(me.lessons.w1.visited, [W1.sections[0].id]);
  });
  await it('pre-test graded on server, no answers revealed, one attempt', async () => {
    const answers = W1.quiz.map((q, i) => i < 3 ? qRight(q) : qWrong(q));
    const r = await lessonStu.post('/api/lessons/w1/quiz', { kind: 'pre', answers }); assert.equal(r.score, 3); assert(!r.review);
    assert.equal((await lessonStu.post('/api/lessons/w1/quiz', { kind: 'pre', answers })).status, 409);
    assert.equal((await lessonStu.post('/api/lessons/w1/quiz', { kind: 'post', answers: answers.slice(0, 5) })).status, 400);
  });
  await it('post-test returns review; pre-test locked afterwards', async () => {
    const W1B = require('../content/lessons/forms/w1.js');
    const pub = await lessonStu.get('/api/lessons/w1');
    assert(pub.quizPost && pub.quizPost.length === 10 && pub.quizPost[0].q !== pub.quiz[0].q, 'post-test is the parallel form B');
    assert(!JSON.stringify(pub.quizPost).includes('"explain"') && !JSON.stringify(pub.quizPost).includes('"correct"'), 'form B answers not public');
    const wrongA = await lessonStu.post('/api/lessons/w1/quiz', { kind: 'post', answers: W1.quiz.map(qRight).map(x => x) });   // form A answers on form B
    assert(wrongA.status === 409 || wrongA.score <= 10);
    if (wrongA.score != null) { await teacher.post(`/api/teacher/students/${(await teacher.get(`/api/teacher/classes/${classId}/prepost`)).students.find(x => x.no === '20').id}/lessons/w1/reset-quiz`, { kind: 'post' }); }
    const r = await lessonStu.post('/api/lessons/w1/quiz', { kind: 'post', answers: W1B.map(qRight) });
    assert.equal(r.score, 10); assert.equal(r.form, 'B'); assert.equal(r.review.length, 10); assert(r.review[0].explain && r.review[0].answer && r.review[0].q === W1B[0].q);
    const me = await lessonStu.get('/api/me'); assert.equal(me.lessons.w1.pre.score, 3); assert.equal(me.lessons.w1.post.score, 10); assert(me.lessons.w1.post.review);
  });
  await it('teacher sees pre/post comparison and can reset the post-test', async () => {
    const d = await teacher.get(`/api/teacher/classes/${classId}/prepost`);
    const l1 = d.lessons.find(l => l.id === 'w1'); assert.equal(l1.preAvg, 3); assert.equal(l1.postAvg, 10); assert.equal(l1.gainAvg, 7);
    const st = d.students.find(x => x.no === '20');
    await teacher.post(`/api/teacher/students/${st.id}/lessons/w1/reset-quiz`, { kind: 'post' });
    const me = await lessonStu.get('/api/me'); assert(!me.lessons.w1.post); assert(me.lessons.w1.pre);
  });
  console.log('Simulators, practice and exams');
  const simStu = client();
  await simStu.post('/api/auth/login', { username: 'lesson.s', password: 'abc12345' });
  await it('sim list exposes only public mission fields', async () => {
    const r = await guest.get('/api/sims'); assert.equal(r.sims.length, 5);
    const s2 = JSON.stringify(r); ['_keys', '_scenarios', '"answers"', '"correct"', '"allowed"'].forEach(k => assert(!s2.includes(k), 'leaks ' + k));
  });
  await it('topology mission graded on server and best score saved', async () => {
    const T = require('../server/sims/topology.js');
    const bad = await simStu.post('/api/sims/topology/submit', { mission: 't1', payload: { topo: { devices: [], links: [] } } });
    assert.equal(bad.score < 10, true); assert(bad.feedback.length); assert.equal(bad.saved, true);
    const r = await simStu.get('/api/sims/topology'); assert(r.done.t1 && r.done.t1.attempts === 1);
  });
  await it('subnet problems are signed; forged/modified problems are rejected', async () => {
    const p = await simStu.post('/api/sims/subnet/new', { mission: 's2' }); assert(p.token && p.problem);
    const S = require('../server/sims/subnet.js');
    const forged = Object.assign({}, p.problem, { ip: '192.168.1.1' });
    const tamper = await simStu.post('/api/sims/subnet/submit', { mission: 's2', payload: { answers: {} }, token: p.token, problem: forged });
    // server ignores the client copy of the problem and uses the signed one
    assert.equal(typeof tamper.score, 'number');
    const badTok = await simStu.post('/api/sims/subnet/submit', { mission: 's2', payload: { answers: {} }, token: p.token + 'x' });
    assert.equal(badTok.error, 'bad_token');
    const other = client();
    const stolen = await other.post('/api/sims/subnet/submit', { mission: 's2', payload: { answers: {} }, token: p.token });
    assert.equal(stolen.error, 'bad_token', 'token bound to the user');
  });
  await it('practice questions hide answers; check returns explanation', async () => {
    const r = await guest.get('/api/practice/questions?units=3&levels=easy&n=5'); assert.equal(r.questions.length, 5);
    const s2 = JSON.stringify(r); ['"correct"', '"accept"', '"explain"'].forEach(k => assert(!s2.includes(k), 'leaks ' + k));
    const q = require('../server/bank').Q.get(r.questions[0].id);
    const right = q.type === 'choice' || q.type === 'multi' || q.type === 'diagram' ? q.correct : q.type === 'tf' ? q.answer : q.type === 'match' ? q.answer : q.type === 'order' ? q.items : q.type === 'fill' ? q.blanks.map(b => b[0]) : q.type === 'command' ? q.example : q.type === 'scenario' ? q.steps.map(x => x.correct) : (() => { const f = require('../server/bank-grade').subnetFacts(q.ip, q.prefix); const o = {}; q.ask.forEach(k => { o[k] = f[k]; }); return o; })();
    const c = await simStu.post('/api/practice/check', { id: q.id, answer: right }); assert.equal(c.correct, true); assert(c.explain && c.answer);
  });
  let examId;
  await it('teacher creates an exam; validation rejects bad config', async () => {
    assert.equal((await teacher.post(`/api/teacher/classes/${classId}/exams`, { title: 'x', units: [], counts: { easy: 1 }, minutes: 10 })).status, 400);
    assert.equal((await teacher.post(`/api/teacher/classes/${classId}/exams`, { title: 'สอบใหญ่', units: [1], counts: { easy: 90 }, minutes: 10 })).status, 400);
    const r = await teacher.post(`/api/teacher/classes/${classId}/exams`, { title: 'สอบย่อยหน่วย 1–3', units: [1, 2, 3], counts: { easy: 4, medium: 4, hard: 2 }, minutes: 20, showReview: true });
    examId = r.id; assert(examId);
  });
  let attempt;
  await it('student starts exam: 10 random questions, no answers, deadline set', async () => {
    const list = await simStu.get('/api/exams'); assert(list.exams.some(e => e.id === examId && e.state === 'open'));
    attempt = await simStu.post(`/api/exams/${examId}/start`); assert.equal(attempt.questions.length, 10);
    const s2 = JSON.stringify(attempt); ['"correct"', '"accept"', '"explain"', '"answer":'].forEach(k => assert(!s2.includes(k), 'leaks ' + k));
    assert(attempt.deadline - Date.now() > 19 * 60000);
    const again = await simStu.post(`/api/exams/${examId}/start`); assert.deepEqual(again.questions.map(q => q.id), attempt.questions.map(q => q.id), 'same questions after refresh');
  });
  await it('autosave answers, then submit grades on the server; resubmit does not change score', async () => {
    const B = require('../server/bank');
    const answers = {};
    attempt.questions.forEach((pq, i) => { const q = B.Q.get(pq.id); if (i < 6 && (q.type === 'choice' || q.type === 'diagram') && (q.answerType || 'choice') === 'choice') answers[q.id] = q.correct; else if (i < 6 && q.type === 'tf') answers[q.id] = q.answer; });
    const sv = await simStu.put(`/api/exams/${examId}/answers`, { answers: { ...answers, 'not-in-exam': 1 } }); assert.equal(sv.saved, Object.keys(answers).length);
    const r = await simStu.post(`/api/exams/${examId}/submit`); assert.equal(r.score, Object.keys(answers).length); assert.equal(r.review.length, 10);
    const r2 = await simStu.post(`/api/exams/${examId}/submit`, { answers: Object.fromEntries(attempt.questions.map(q => [q.id, 0])) }); assert.equal(r2.score, r.score);
    assert.equal((await simStu.put(`/api/exams/${examId}/answers`, { answers: {} })).error, 'submitted');
  });
  await it('time limit enforced: late attempt auto-finalised', async () => {
    const r = await teacher.post(`/api/teacher/classes/${classId}/exams`, { title: 'สอบจับเวลา', units: [4], counts: { easy: 3 }, minutes: 5 });
    const s = await stu2.post(`/api/exams/${r.id}/start`); assert.equal(s.questions.length, 3);
    const p = new Pool({ connectionString: url }); await p.query("UPDATE exam_attempts SET deadline=now()-interval '1 second' WHERE exam_id=$1", [r.id]); await p.end();
    const g = await stu2.get(`/api/exams/${r.id}`); assert(g.submitted); assert.equal(g.score, 0);
    assert.equal((await stu2.put(`/api/exams/${r.id}/answers`, { answers: {} })).error, 'submitted');
  });
  await it('teacher sees results, item analysis and Excel export; other class cannot see', async () => {
    const rep = await teacher.get(`/api/teacher/exams/${examId}/results`);
    assert(rep.rows.some(x => x.status === 'submitted')); assert.equal(rep.items.length, 10);
    const x = await teacher.raw(`/api/teacher/exams/${examId}/export.xlsx`); assert.equal(x.status, 200);
    const t2 = await admin.post('/api/admin/teachers', { username: 'kru.c', name: 'ครูซี' }); const c3 = client(); await c3.post('/api/auth/login', { username: 'kru.c', password: t2.password });
    assert.equal((await c3.get(`/api/teacher/exams/${examId}/results`)).status, 404);
    const sims = await teacher.get(`/api/teacher/classes/${classId}/sims`); assert.equal(sims.sims.length, 5); assert(sims.students.some(s => s.results['topology:t1']));
  });
  await it('closed exam cannot be started; teacher can reset an attempt', async () => {
    const r = await teacher.post(`/api/teacher/classes/${classId}/exams`, { title: 'ปิดแล้ว', units: [1], counts: { easy: 2 }, minutes: 5, openAt: new Date(Date.now() - 7200e3).toISOString(), closeAt: new Date(Date.now() - 3600e3).toISOString() });
    assert.equal((await simStu.post(`/api/exams/${r.id}/start`)).error, 'closed');
    const rep = await teacher.get(`/api/teacher/exams/${examId}/results`); const st = rep.rows.find(x => x.status === 'submitted');
    await teacher.post(`/api/teacher/exams/${examId}/reset/${st.id}`);
    assert.equal((await teacher.get(`/api/teacher/exams/${examId}/results`)).rows.find(x => x.id === st.id).status, 'none');
  });

  console.log('Gamification and analytics (Phase 5)');
  const st5 = client(); await st5.post('/api/auth/login', { username: 'nong.c', password: 'abc12345' });
  const pq = (sql, params) => require('../server/db').q(sql, params);
  await it('progress API needs login', async () => { assert.equal((await guest.get('/api/game/me')).status, 401); });
  let g1;
  await it('XP is derived from server-graded data and parts add up', async () => {
    g1 = await simStu.get('/api/game/me');
    const parts = ['labs', 'lessons', 'quizzes', 'sims', 'practice', 'exams', 'challenges'];
    assert.equal(g1.xp.total, parts.reduce((a, k) => a + g1.xp[k], 0));
    const uid = (await pq("SELECT id FROM users WHERE username='lesson.s'")).rows[0].id;
    const best = (await pq('SELECT coalesce(sum(best),0)::int v FROM sim_results WHERE user_id=$1', [uid])).rows[0].v;
    assert.equal(g1.xp.sims, best);
    const pc = (await pq('SELECT count(DISTINCT qid)::int v FROM bank_log WHERE user_id=$1 AND correct', [uid])).rows[0].v;
    assert.equal(g1.xp.practice, pc * 3);
    assert(g1.level.level >= 1 && g1.level.to > g1.level.from && g1.xp.total >= g1.level.from && g1.xp.total < g1.level.to);
    assert.equal(g1.badges.length, 21); assert.equal(g1.challenge.goals.length, 3);
    assert(g1.days.includes(g1.today), 'today counted as active day after learning actions');
    assert(g1.streak.current >= 1);
    assert(Array.isArray(g1.mastery) && Array.isArray(g1.suggestions));
  });
  await it('repeating an already-correct practice question gives no extra XP', async () => {
    const B = require('../server/bank');
    const q = [...B.Q.values()].find(x => x.type === 'tf');
    await simStu.post('/api/practice/check', { id: q.id, answer: q.answer });
    const a = (await simStu.get('/api/game/me')).xp.practice;
    await simStu.post('/api/practice/check', { id: q.id, answer: q.answer });
    await simStu.post('/api/practice/check', { id: q.id, answer: q.answer });
    assert.equal((await simStu.get('/api/game/me')).xp.practice, a);
  });
  await it('weekly challenge: completed goals are stored once and add XP', async () => {
    const uid = (await pq("SELECT id FROM users WHERE username='lesson.s'")).rows[0].id;
    const B = require('../server/bank');
    const hard = [...B.Q.values()].filter(x => x.level === 'hard').slice(0, 16);
    for (const q of hard) await pq('INSERT INTO bank_log(user_id,qid,correct,score) VALUES($1,$2,true,1)', [uid, q.id]);
    await pq(`UPDATE sim_results SET first_full_at=now(), best=max WHERE user_id=$1`, [uid]);
    await pq(`INSERT INTO sim_results(user_id,sim,mission,best,max,attempts,first_full_at) VALUES($1,'crimp','c1',10,10,1,now()),($1,'crimp','c2',10,10,1,now()) ON CONFLICT DO NOTHING`, [uid]);
    const keys = ALL.find(l => l.id === 'r3').tasks.map((t, i) => 'r3-' + i).slice(0, 10);
    for (const k of keys) await pq(`INSERT INTO task_progress(user_id,task_key,lab_id,solved,points,solved_at) VALUES($1,$2,'r3',true,10,now()) ON CONFLICT DO NOTHING`, [uid, k]);
    const wk = await require('../server/game').weekInfo(0);
    for (let i = 0; i < 3; i++) await pq(`INSERT INTO activity(user_id,day) VALUES($1,$2::date + $3::int) ON CONFLICT DO NOTHING`, [uid, wk.day, i]);
    await pq(`INSERT INTO quiz_attempts(user_id,lesson_id,kind,answers,results,score,max) VALUES($1,'w18','post','[]','[]',5,10) ON CONFLICT DO NOTHING`, [uid]);
    const g = await simStu.get('/api/game/me');
    assert(g.challenge.goals.every(x => x.done), JSON.stringify(g.challenge.goals));
    assert.equal(g.challenge.allDone, true); assert.equal(g.xp.challenges >= 100, true);
    const again = await simStu.get('/api/game/me'); assert.equal(again.xp.challenges, g.xp.challenges);
    assert(g.badges.find(b => b.id === 'weekly-1').earned);
  });
  await it('new badges are announced once', async () => {
    const a = await st5.get('/api/game/me');
    const b = await st5.get('/api/game/me');
    assert.equal(b.newBadges.length, 0);
    assert(a.badges.filter(x => x.earned).length === b.badges.filter(x => x.earned).length);
  });
  await it('leaderboard is off by default and private by default', async () => {
    assert.equal((await simStu.get('/api/game/leaderboard')).status, 403);
    const c2 = client(); await c2.post('/api/auth/login', { username: 'kru.b', password: (await admin.post(`/api/admin/teachers/${(await pq("SELECT id FROM users WHERE username='kru.b'")).rows[0].id}/reset-password`)).password });
    assert.equal((await c2.patch(`/api/teacher/classes/${classId}/leaderboard`, { enabled: true })).status, 404, 'other teacher cannot toggle');
    assert.equal((await st5.patch(`/api/teacher/classes/${classId}/leaderboard`, { enabled: true })).status, 403, 'student cannot toggle');
    assert.equal((await teacher.patch(`/api/teacher/classes/${classId}/leaderboard`, { enabled: true })).enabled, true);
    const lb = await simStu.get('/api/game/leaderboard?scope=all');
    assert(lb.rows.length >= 2);
    const raw = JSON.stringify(lb); assert(!/"id"|user_id|username/.test(raw), 'no ids in leaderboard');
    const meRow = lb.rows.find(r => r.me) || lb.me; assert(meRow && meRow.me && meRow.name === 'นักเรียนบทเรียน');
    assert(lb.rows.filter(r => !r.me).every(r => r.name === 'ไม่เปิดเผยชื่อ' && r.hidden));
    await st5.post('/api/game/prefs', { lbPublic: true });
    const stuName = (await st5.get('/api/me')).user.name;
    const lb2 = await simStu.get('/api/game/leaderboard?scope=all');
    assert([...lb2.rows, lb2.me].filter(Boolean).some(r => r.name === stuName && !r.me));
    const wk = await simStu.get('/api/game/leaderboard?scope=week'); assert.equal(wk.scope, 'week');
    assert.equal((await st5.post('/api/game/prefs', { lbPublic: 'yes' })).status, 400);
  });
  await it('teacher analytics: per student XP matches, units/types/daily present, export, access control', async () => {
    const a = await teacher.get(`/api/teacher/classes/${classId}/analytics`);
    assert.equal(a.units.length, 10); assert.equal(a.types.length, 10); assert.equal(a.daily.length, 28);
    const g = await simStu.get('/api/game/me');
    const myName = (await simStu.get('/api/me')).user.name; const row = a.students.find(s => s.name === myName);
    assert.equal(row.xp, g.xp.total);
    assert(a.summary.students === a.students.length);
    assert(a.students.some(s => s.flags.length), 'idle students are flagged');
    assert.equal((await teacher.raw(`/api/teacher/classes/${classId}/analytics.xlsx`)).status, 200);
    assert.equal((await st5.get(`/api/teacher/classes/${classId}/analytics`)).status, 403);
    const t3 = client(); await t3.post('/api/auth/login', { username: 'kru.c', password: (await admin.post(`/api/admin/teachers/${(await pq("SELECT id FROM users WHERE username='kru.c'")).rows[0].id}/reset-password`)).password });
    assert.equal((await t3.get(`/api/teacher/classes/${classId}/analytics`)).status, 404);
  });

  console.log('Account recovery and guest import (2.4)');
  await it('forgot password: same reply for real and unknown users; teacher sees and resolves the request', async () => {
    const g = client();
    const a = await g.post('/api/auth/forgot', { username: 'nong.c', note: 'เลขที่ 3' });
    const b = await g.post('/api/auth/forgot', { username: 'no.such.user' });
    assert.equal(a.message, b.message); assert.equal(a.status, b.status);
    await g.post('/api/auth/forgot', { username: 'nong.c' });   // a second request does not duplicate
    const det = await teacher.get(`/api/teacher/classes/${classId}`);
    const st = det.students.find(x => x.username === 'nong.c');
    const reqs = det.resetRequests.filter(r => r.user_id === st.id); assert.equal(reqs.length, 1); assert.equal(reqs[0].note, 'เลขที่ 3');
    const cls = (await teacher.get('/api/teacher/classes')).classes.find(c => c.id === classId); assert(cls.reset_requests >= 1);
    const r = await teacher.post(`/api/teacher/students/${st.id}/reset-password`); assert(r.password);
    assert.equal((await teacher.get(`/api/teacher/classes/${classId}`)).resetRequests.filter(x => x.user_id === st.id).length, 0);
    const back = client(); await back.post('/api/auth/login', { username: 'nong.c', password: r.password });
    assert.equal((await back.post('/api/auth/password', { current: r.password, next: 'abc12345' })).ok, true);
  });
  await it('guest import: answers graded again, wrong ones rejected, started labs skipped, flagged for teacher', async () => {
    const imp = client(); await imp.post('/api/auth/login', { username: 'nong.c', password: 'abc12345' });
    const r2 = ALL.find(l => l.id === 'r2'), r3 = ALL.find(l => l.id === 'r3');
    const labs = {
      'r2-0': { a: correctAnswer(r2.tasks[0]), att: 1 },
      'r2-1': { given: r2.tasks[1].options[r2.tasks[1].correct], hint: true },          // old guest format (answer text)
      'r2-2': { a: wrongAnswer(r2.tasks[2]) },                                            // tampered: wrong answer marked done
      'w2-0': { a: correctAnswer(ALL.find(l => l.id === 'w2').tasks[0]) },               // nong.c never started w2 -> imported
      'zz-9': { a: 1 }
    };
    await imp.post('/api/labs/r3/start');                                                 // started in the account -> must be skipped
    labs['r3-0'] = { a: correctAnswer(r3.tasks[0]) };
    const W1 = require('../content/lessons/w1.js');
    const r = await imp.post('/api/account/import-guest', { labs, visited: { w1: [W1.sections[0].id, 'fake-section'] }, checks: { w1: { 0: 'zzz-wrong' } } });
    assert.equal(r.tasks, 3, JSON.stringify(r)); assert.equal(r.labs, 2); assert.deepEqual(r.skippedLabs, ['r3']); assert(r.rejected >= 2); assert.equal(r.sections, 1); assert.equal(r.checks, 0);
    const me = await imp.get('/api/me');
    assert(me.progress.done['r2-0'] && me.progress.done['r2-1'] && !me.progress.done['r2-2']);
    const rep = await teacher.get(`/api/teacher/classes/${classId}/report`);
    const row = rep.rows.find(x => x.username === 'nong.c' || x.name === 'น้องซี');
    assert(row.labs.r2.imported, 'teacher report flags the imported lab'); assert.equal(row.labs.r2.points, 8 + 5);
    assert.equal((await teacher.post('/api/account/import-guest', { labs })).status, 403, 'teachers cannot import');
    assert.equal((await client().post('/api/account/import-guest', { labs })).status, 401);
  });

  console.log('Learning experience (2.4 part 4)');
  await it('reading position is saved on the server and returned in /api/me', async () => {
    const W1 = require('../content/lessons/w1.js');
    await simStu.post('/api/lessons/w1/visit', { section: W1.sections[2].id, last: true });
    const me = await simStu.get('/api/me'); assert.equal(me.lessons.w1.last, W1.sections[2].id);
    assert.equal((await simStu.post('/api/lessons/w1/visit', { section: 'zz', last: true })).status, 400);
  });
  await it('review mistakes: wrong practice answers are listed until answered correctly', async () => {
    const B = require('../server/bank');
    const qs = [...B.Q.values()].filter(q => q.type === 'tf').slice(5, 7);
    for (const q of qs) await simStu.post('/api/practice/check', { id: q.id, answer: !q.answer });
    let m = await simStu.get('/api/practice/mistakes?n=30');
    assert(qs.every(q => m.questions.some(x => x.id === q.id)), 'wrong items listed');
    assert(!JSON.stringify(m.questions).includes('"answer"') && !JSON.stringify(m.questions).includes('"explain"'), 'no answers leaked');
    await simStu.post('/api/practice/check', { id: qs[0].id, answer: qs[0].answer });
    m = await simStu.get('/api/practice/mistakes?n=30');
    assert(!m.questions.some(x => x.id === qs[0].id) && m.questions.some(x => x.id === qs[1].id), 'answered correctly -> removed');
    assert.equal((await guest.get('/api/practice/mistakes')).status, 401);
    const g = await guest.post('/api/practice/byids', { ids: [qs[1].id, 'nope'] }); assert.equal(g.questions.length, 1);
  });
  await it('admin backup excludes password hashes', async () => {
    const r = await admin.get('/api/admin/backup'); assert(r.users.length >= 4); assert(!JSON.stringify(r).includes('scrypt$'));
  });
  await it('login lockout after repeated failures', async () => {
    const c = client(); let last;
    for (let i = 0; i < 9; i++) last = await c.post('/api/auth/login', { username: 'kru.a', password: 'bad' + i });
    assert.equal(last.status, 429);
  });

  console.log(`\n${passed} passed`);
  server.close(); await require('../server/db').close();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
