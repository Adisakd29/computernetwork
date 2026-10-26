'use strict';
/* Learning plan (2.6, Phase 7): what a student finished, which lesson topics to review, strong/weak topics and pending work;
   and for teachers, the topics and post-test items most of a class gets wrong (aggregated, no names).
   Questions are linked to the lesson section that teaches them by text similarity within the question's week(s). */
const db = require('./db');
const { LESSONS } = require('./lessons');
const bank = require('./bank');

/* ---------- question -> section map (built once) ---------- */
const grams = s => { const t = String(s || '').toLowerCase().replace(/\s+/g, ' '); const g = new Set(); for (let i = 0; i < t.length - 2; i++) g.add(t.slice(i, i + 3)); return g; };
let SEC = null;            // [{lesson, week, section, title, ltitle, g}]
const QSEC = new Map();    // key -> {lesson, section}
function sections() {
  if (SEC) return SEC;
  SEC = [];
  for (const L of LESSONS.values()) for (const s of L.sections) {
    const text = [s.title, ...s.blocks.map(b => [b.title, b.term, b.text, b.caption, (b.items || []).join(' '), b.type === 'table' ? [(b.head || []).join(' '), ...(b.rows || []).map(r => r.join(' '))].join(' ') : '', b.type === 'check' && b.q ? b.q.q : ''].join(' '))].join(' ');
    SEC.push({ lesson: L.id, week: L.week, section: s.id, title: s.title.replace(/^\d+\.\s*/, ''), ltitle: L.title, g: grams(text) });
  }
  return SEC;
}
function bestSection(text, weeks) {
  const q = grams(text); if (!q.size) return null;
  let best = null, bs = -1;
  for (const s of sections()) {
    if (weeks && !weeks.includes(s.week)) continue;
    let hit = 0; q.forEach(x => { if (s.g.has(x)) hit++; });
    const sc = hit / q.size; if (sc > bs) { bs = sc; best = s; }
  }
  return best;
}
const qText = q => [q.q, q.context, (q.options || []).join(' '), (q.left || []).join(' '), (q.right || []).join(' '), (q.items || []).join(' '), (q.hide || []).join(' '), (q.tags || []).join(' '), q.explain].filter(Boolean).join(' ');
function sectionOfBank(id) {
  const k = 'B:' + id; if (QSEC.has(k)) return QSEC.get(k);
  const q = bank.Q.get(id); const s = q ? bestSection(qText(q), [q.week]) : null;
  QSEC.set(k, s); return s;
}
function sectionOfQuiz(L, form, i) {
  const k = `Q:${L.id}:${form}:${i}`; if (QSEC.has(k)) return QSEC.get(k);
  const items = form === 'B' && L.quizB ? L.quizB : L.quiz; const q = items[i];
  const s = q ? bestSection(qText(q), [L.week]) : null;
  QSEC.set(k, s); return s;
}

/* ---------- per-topic evidence ---------- */
function addEv(map, s, ok, src) {
  if (!s) return;
  const k = s.lesson + '/' + s.section;
  const e = map.get(k) || { lesson: s.lesson, week: s.week, section: s.section, title: s.title, ltitle: s.ltitle, n: 0, ok: 0, postWrong: 0, bankN: 0, bankOk: 0 };
  e.n++; if (ok) e.ok++;
  if (src === 'post' && !ok) e.postWrong++;
  if (src === 'bank') { e.bankN++; if (ok) e.bankOk++; }
  map.set(k, e);
}
async function evidenceOf(userIds) {
  const per = new Map(userIds.map(u => [u, new Map()]));
  const quiz = (await db.q(`SELECT user_id, lesson_id, results, form FROM quiz_attempts WHERE kind='post' AND user_id = ANY($1)`, [userIds])).rows;
  for (const r of quiz) {
    const L = LESSONS.get(r.lesson_id); if (!L) continue;
    (r.results || []).forEach((x, i) => addEv(per.get(r.user_id), sectionOfQuiz(L, r.form || 'A', i), !!(x && x.correct), 'post'));
  }
  // latest answer per bank question (practice or exam)
  const last = new Map();
  (await db.q('SELECT user_id, qid, correct, created_at FROM bank_log WHERE user_id = ANY($1) ORDER BY created_at', [userIds])).rows
    .forEach(r => last.set(r.user_id + '|' + r.qid, { u: r.user_id, id: r.qid, ok: r.correct, t: +r.created_at }));
  (await db.q('SELECT user_id, results, submitted_at FROM exam_attempts WHERE submitted_at IS NOT NULL AND user_id = ANY($1)', [userIds])).rows
    .forEach(a => (a.results || []).forEach(x => { const k = a.user_id + '|' + x.id; const p = last.get(k); if (!p || p.t < +a.submitted_at) last.set(k, { u: a.user_id, id: x.id, ok: !!x.correct, t: +a.submitted_at }); }));
  for (const v of last.values()) if (per.has(v.u)) addEv(per.get(v.u), sectionOfBank(v.id), v.ok, 'bank');
  return per;
}

/* ---------- student plan ---------- */
async function planOf(user, lessonState) {
  const ev = (await evidenceOf([user.id])).get(user.id);
  const topics = [...ev.values()].map(e => ({ ...e, pct: Math.round(e.ok / e.n * 100) }));
  const weak = topics.filter(t => (t.n >= 2 && t.pct < 60) || t.postWrong >= 1).sort((a, b) => (a.pct - b.pct) || (b.postWrong - a.postWrong) || (b.n - a.n));
  const strong = topics.filter(t => t.n >= 3 && t.pct >= 80).sort((a, b) => b.pct - a.pct || b.n - a.n);
  const reason = t => [t.postWrong ? `ตอบผิดในแบบทดสอบหลังเรียน ${t.postWrong} ข้อ` : null, t.bankN ? `ฝึก/สอบถูก ${t.bankOk} จาก ${t.bankN} ข้อ` : null].filter(Boolean).join(' · ');
  const pick = t => ({ lesson: t.lesson, week: t.week, section: t.section, title: t.title, ltitle: t.ltitle, pct: t.pct, n: t.n, why: reason(t) });
  // lessons: finished / in progress / not started (from the same step logic the app uses)
  const lessons = [...LESSONS.values()].map(L => {
    const p = lessonState[L.id] || {};
    const core = L.sections.filter(s => !s.extra).map(s => s.id);
    const read = (p.visited || []).filter(v => core.includes(v)).length, total = core.length;
    const steps = { pre: !!p.pre, content: read >= total, post: !!p.post };
    const done = steps.pre && steps.content && steps.post;
    const started = !!(p.pre || read || p.post);
    return { id: L.id, week: L.week, title: L.title, status: done ? 'done' : started ? 'doing' : 'todo', read, total,
      missing: [steps.pre ? null : 'แบบทดสอบก่อนเรียน', steps.content ? null : `อ่านเนื้อหา (${read}/${total})`, steps.post ? null : 'แบบทดสอบหลังเรียน'].filter(Boolean) };
  });
  // pending work
  const pending = [];
  if (user.class_id) {
    /* 3.2: an assigned week is done when its practical step has a finished attempt (or the old end-of-class lab was
       finished); assignments of retired review sets are history only and no longer listed as pending */
    const asg = (await db.q(`SELECT a.lab_id, a.due_at, r.status,
                               EXISTS (SELECT 1 FROM practical_sessions p WHERE p.user_id=$2 AND p.lesson_id=a.lab_id AND p.voided_at IS NULL
                                        AND p.status IN ('submitted','timeout','legacy')) AS prdone
                             FROM assignments a LEFT JOIN lab_runs r ON r.lab_id=a.lab_id AND r.user_id=$2
                             WHERE a.class_id=$1 AND a.lab_id LIKE 'w%' ORDER BY a.due_at NULLS LAST, a.id`, [user.class_id, user.id])).rows;
    asg.filter(a => !a.prdone && (!a.status || a.status === 'running')).forEach(a => pending.push({ kind: 'lab', id: a.lab_id, due: a.due_at ? +a.due_at : null, overdue: !!(a.due_at && +a.due_at < Date.now()) }));
    const ex = (await db.q(`SELECT e.id, e.title, e.close_at FROM exams e LEFT JOIN exam_attempts a ON a.exam_id=e.id AND a.user_id=$2
        WHERE e.class_id=$1 AND (e.open_at IS NULL OR e.open_at <= now()) AND (e.close_at IS NULL OR e.close_at > now())
          AND (a.user_id IS NULL OR (a.submitted_at IS NULL AND a.deadline > now())) ORDER BY e.close_at NULLS LAST`, [user.class_id, user.id])).rows;
    ex.forEach(e => pending.push({ kind: 'exam', id: e.id, title: e.title, due: e.close_at ? +e.close_at : null }));
  }
  lessons.filter(l => l.status === 'doing').forEach(l => pending.push({ kind: 'lesson', id: l.id, title: `สัปดาห์ ${l.week} ${l.title}`, missing: l.missing }));
  /* 3.5: simulator missions are reached through the practical step of their week (missions outside the 18 sessions are not listed) */
  const PR = require('./practical');
  const simsPartial = (await db.q('SELECT sim, mission, best, max FROM sim_results WHERE user_id=$1 AND best < max ORDER BY updated_at DESC LIMIT 12', [user.id])).rows;
  simsPartial.map(s => Object.assign(s, { week: PR.weekOfItem(s.sim + ':' + s.mission) })).filter(s => s.week).slice(0, 5)
    .forEach(s => pending.push({ kind: 'sim', id: s.sim, mission: s.mission, best: s.best, max: s.max, week: s.week, href: `#/lesson/${s.week}/lab` }));
  return { lessons, review: weak.slice(0, 8).map(pick), strong: strong.slice(0, 6).map(pick), weakCount: weak.length, pending };
}

/* ---------- teacher: what most of the class does not understand (aggregated; shown only with >= MIN students) ---------- */
const MIN = 3;
async function classInsights(studentIds) {
  if (!studentIds.length) return { students: 0, topics: [], postItems: [], min: MIN };
  const ev = await evidenceOf(studentIds);
  const agg = new Map();
  for (const m of ev.values()) for (const e of m.values()) {
    const k = e.lesson + '/' + e.section;
    const a = agg.get(k) || { lesson: e.lesson, week: e.week, section: e.section, title: e.title, ltitle: e.ltitle, students: 0, n: 0, ok: 0, weakStudents: 0 };
    a.students++; a.n += e.n; a.ok += e.ok; if (e.ok / e.n < 0.6) a.weakStudents++;
    agg.set(k, a);
  }
  const topics = [...agg.values()].filter(a => a.students >= MIN).map(a => ({ ...a, pct: Math.round(a.ok / a.n * 100), weakPct: Math.round(a.weakStudents / a.students * 100) })).filter(a => a.pct < 70 || a.weakPct >= 50)
    .sort((a, b) => a.pct - b.pct || b.students - a.students).slice(0, 12);
  // post-test items: % correct and the most common wrong answer (text only, no names)
  const rows = (await db.q(`SELECT lesson_id, results, form FROM quiz_attempts WHERE kind='post' AND user_id = ANY($1)`, [studentIds])).rows;
  const items = new Map();
  for (const r of rows) {
    const L = LESSONS.get(r.lesson_id); if (!L) continue; const form = r.form || 'A';
    const qs = form === 'B' && L.quizB ? L.quizB : L.quiz;
    (r.results || []).forEach((x, i) => {
      const k = `${L.id}:${form}:${i}`;
      const it = items.get(k) || { lesson: L.id, week: L.week, form, index: i, q: qs[i] ? qs[i].q : '', n: 0, ok: 0, wrong: {} };
      it.n++; if (x && x.correct) it.ok++; else if (x && x.given) it.wrong[x.given] = (it.wrong[x.given] || 0) + 1;
      items.set(k, it);
    });
  }
  const postItems = [...items.values()].filter(i => i.n >= MIN).map(i => {
    const w = Object.entries(i.wrong).sort((a, b) => b[1] - a[1])[0];
    const s = sectionOfQuiz(LESSONS.get(i.lesson), i.form, i.index);
    return { lesson: i.lesson, week: i.week, form: i.form, no: i.index + 1, q: i.q, n: i.n, pct: Math.round(i.ok / i.n * 100), commonWrong: w ? { text: String(w[0]).slice(0, 120), count: w[1] } : null, section: s ? { id: s.section, title: s.title } : null };
  }).filter(i => i.pct < 70).sort((a, b) => a.pct - b.pct || b.n - a.n).slice(0, 12);
  return { students: studentIds.length, topics, postItems, min: MIN };
}

module.exports = { planOf, classInsights, sectionOfBank, sectionOfQuiz, bestSection };
