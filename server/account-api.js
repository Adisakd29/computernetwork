'use strict';
/* 2.4: "forgot password" requests (resolved by the teacher) and linking guest progress into an account */
const express = require('express');
const db = require('./db');
const auth = require('./auth');
const { TASKS } = require('./content');
const { check, pointsLeft, logAnswer } = require('./grading');
const { LESSONS, QKEYS } = require('./lessons');

const ok = (res, d) => res.json(d);
const fail = (res, code, error, message) => res.status(code).json({ error, message });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const router = express.Router();

/* The reply is the same whether or not the username exists, so it cannot be used to find accounts. */
router.post('/auth/forgot', auth.requireDb, auth.rateLimit(5, 40), wrap(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase().slice(0, 60);
  const note = String(req.body.note || '').trim().slice(0, 200) || null;
  const generic = { ok: true, message: 'ส่งคำขอแล้ว ถ้าชื่อผู้ใช้นี้มีอยู่ ครูผู้สอนจะเห็นคำขอในแดชบอร์ดและตั้งรหัสผ่านชั่วคราวให้ ติดต่อครูเพื่อรับรหัสใหม่' };
  if (!username) return fail(res, 400, 'bad', 'กรอกชื่อผู้ใช้');
  const u = (await db.q("SELECT id, role FROM users WHERE username=$1 AND NOT disabled", [username])).rows[0];
  if (u && u.role !== 'admin') {
    const open = (await db.q('SELECT 1 FROM reset_requests WHERE user_id=$1 AND resolved_at IS NULL', [u.id])).rowCount;
    if (!open) await db.q('INSERT INTO reset_requests(user_id, note) VALUES($1,$2)', [u.id, note]);
  }
  ok(res, generic);
}));

/* answer text kept by older guest versions -> answer format the grader expects */
function fromGiven(task, g) {
  if (g == null) return null;
  const s = String(g);
  switch (task.type) {
    case 'text': return s;
    case 'choice': { const i = task.options.indexOf(s); return i >= 0 ? i : null; }
    case 'multi': { const ix = s.split(' + ').map(x => task.options.indexOf(x)); return ix.every(i => i >= 0) ? ix : null; }
    case 'tf': return s === 'ถูก' ? true : s === 'ผิด' ? false : null;
    case 'order': return s.split(' | ');
    case 'form': { try { const a = JSON.parse(s); return Array.isArray(a) && !a.includes('***') ? a : null; } catch (e) { return null; } }
  }
  return null;
}

/* Link progress made as a guest on this browser. Every answer is graded again here; labs the student already
   started in the account are skipped; imported runs are flagged for the teacher. Pre/post-tests are never imported. */
router.post('/account/import-guest', auth.requireDb, auth.requireUser, auth.rateLimit(5, 50), wrap(async (req, res) => {
  const u = req.user;
  if (u.role !== 'student') return fail(res, 403, 'role', 'นำเข้าได้เฉพาะบัญชีนักเรียน');
  if (JSON.stringify(req.body || {}).length > 200000) return fail(res, 413, 'too_big', 'ข้อมูลใหญ่เกินไป');
  const labsIn = req.body.labs && typeof req.body.labs === 'object' ? req.body.labs : {};
  const out = { labs: 0, tasks: 0, skippedLabs: [], sections: 0, checks: 0, rejected: 0 };
  const byLab = {};
  for (const [key, v] of Object.entries(labsIn).slice(0, 600)) {
    const t = TASKS.get(key); if (!t || !v || typeof v !== 'object') continue;
    (byLab[t.lab.id] = byLab[t.lab.id] || []).push([key, t, v]);
  }
  for (const [labId, items] of Object.entries(byLab)) {
    const has = (await db.q('SELECT 1 FROM lab_runs WHERE user_id=$1 AND lab_id=$2', [u.id, labId])).rowCount;
    if (has) { out.skippedLabs.push(labId); continue; }
    const graded = [];
    for (const [key, t, v] of items) {
      const ans = v.a !== undefined ? v.a : fromGiven(t.task, v.given);
      if (ans == null) { out.rejected++; continue; }
      const c = check(t.task, ans);
      if (!c.correct) { out.rejected++; continue; }
      const att = Math.max(0, Math.min(4, Number(v.att) | 0)), hint = !!v.hint;
      graded.push({ key, t, ans, att, hint, pts: pointsLeft(att, hint) });
    }
    if (!graded.length) continue;
    await db.tx(async cx => {
      await cx.query(`INSERT INTO lab_runs(user_id,lab_id,started_at,deadline,ended_at,status,imported) VALUES($1,$2,now(),now(),now(),'finished',true) ON CONFLICT DO NOTHING`, [u.id, labId]);
      for (const g of graded) {
        await cx.query(`INSERT INTO task_progress(user_id,task_key,lab_id,attempts,hint_used,solved,points,solved_at) VALUES($1,$2,$3,$4,$5,true,$6,now()) ON CONFLICT (user_id,task_key) DO NOTHING`, [u.id, g.key, labId, g.att, g.hint, g.pts]);
        await cx.query('INSERT INTO attempt_log(user_id,task_key,lab_id,correct,answer) VALUES($1,$2,$3,true,$4)', [u.id, g.key, labId, logAnswer(g.t.task, g.ans)]);
      }
    });
    out.labs++; out.tasks += graded.length;
  }
  // lesson reading progress (section ids are checked) and in-lesson exercises (answers graded again)
  const visited = req.body.visited && typeof req.body.visited === 'object' ? req.body.visited : {};
  for (const [lid, list] of Object.entries(visited).slice(0, 30)) {
    const L = LESSONS.get(lid); if (!L || !Array.isArray(list)) continue;
    const ok2 = [...new Set(list.map(String))].filter(s => L.sections.some(x => x.id === s));
    if (!ok2.length) continue;
    await db.q(`INSERT INTO lesson_progress(user_id,lesson_id,visited) VALUES($1,$2,$3::jsonb)
                ON CONFLICT (user_id,lesson_id) DO UPDATE SET visited = (SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements(lesson_progress.visited || $3::jsonb) AS e(v)), updated_at=now()`, [u.id, lid, JSON.stringify(ok2)]);
    out.sections += ok2.length;
  }
  const checks = req.body.checks && typeof req.body.checks === 'object' ? req.body.checks : {};
  for (const [lid, map] of Object.entries(checks).slice(0, 30)) {
    if (!LESSONS.has(lid) || !map || typeof map !== 'object') continue;
    const good = [];
    for (const [idx, a] of Object.entries(map).slice(0, 40)) {
      const k = QKEYS.get(`L:${lid}:c:${Number(idx)}`); if (!k) continue;
      if (check(k.q, a).correct) good.push(Number(idx)); else out.rejected++;
    }
    if (!good.length) continue;
    await db.q(`INSERT INTO lesson_progress(user_id,lesson_id,checks) VALUES($1,$2,$3::jsonb)
                ON CONFLICT (user_id,lesson_id) DO UPDATE SET checks = (SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements(lesson_progress.checks || $3::jsonb) AS e(v)), updated_at=now()`, [u.id, lid, JSON.stringify(good)]);
    out.checks += good.length;
  }
  ok(res, out);
}));

module.exports = { router, fromGiven };
