'use strict';
/* Practice : theory mix per week, estimated from time (3.0). Same method as docs/CURRICULUM-PLAN.md section 3:
   theory   = pre-test 10 + post-test 10 + lesson reading (lesson.minutes) + in-lesson checks (1 min each)
              + the end-of-class lab's choice/order items (their share of the lab time)
   practice = the end-of-class lab's terminal/form/VM items (their share of the lab time) + hands-on items added in Phase 4 (3 min each)
              + simulator missions planned for the week (easy 10, medium 15, hard 25 minutes; content/curriculum.js)
   The timed challenge rooms are left out (as in Phase 2). Supplementary sections (เนื้อหาเสริม) are optional reading; the
   "with supplements" column adds their reading time (same characters-per-minute as the core lesson) and their checks.
   usage: node scripts/practice-mix.js [--md] [--before-p4]   (--before-p4 leaves out what Phase 4 added, for comparison) */
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.APP_SECRET = process.env.APP_SECRET || 'mix';
const { WEEKS: LABS } = require(path.join(ROOT, 'content', 'labs.js'));
const { WEEKS, MINUTES } = require(path.join(ROOT, 'content', 'curriculum.js'));
const { MODS } = require(path.join(ROOT, 'server', 'sims-api.js'));
const fs = require('fs');

const chars = secs => secs.reduce((a, s) => a + JSON.stringify(s.blocks.filter(b => b.type !== 'check')).length, 0);
const checks = secs => secs.reduce((a, s) => a + s.blocks.filter(b => b.type === 'check').length, 0);
const level = ref => { const [sim, id] = ref.split(':'); const m = MODS[sim] && MODS[sim].missions.find(x => x.id === id); return m ? m.level : null; };

const BEFORE = process.argv.includes('--before-p4');
const P4 = /^(topology:t(1[4-9])|terminal:m(1[2-9]|20)|wifi:wf\d+)$/;   // missions added in Phase 4
const rows = [];
for (const W of WEEKS) {
  const les = require(path.join(ROOT, 'content', 'lessons', W.id + '.js'));
  const xf = path.join(ROOT, 'content', 'lessons', 'extra', W.id + '.js');
  const extra = fs.existsSync(xf) ? require(xf) : [];
  const lab = LABS.find(l => l.id === W.id);
  const old = lab.tasks.filter(t => !t.hands), hands = BEFORE ? [] : lab.tasks.filter(t => t.hands);
  const n = old.length + (lab.vmTasks || []).length;
  const base = lab.minutes - 3 * lab.tasks.filter(t => t.hands).length;
  const pracItems = old.filter(t => t.type === 'text' || t.type === 'form').length + (lab.vmTasks || []).length;
  const labPrac = base * pracItems / n, labTheory = base - labPrac;
  const sims = [...new Set([...W.guided, ...W.independent, ...W.trouble])].filter(r => !(BEFORE && P4.test(r)));
  const simMin = sims.reduce((a, r) => a + (MINUTES[level(r)] || 0), 0);
  const theory = 20 + les.minutes + checks(les.sections) + labTheory;
  const practice = labPrac + 3 * hands.length + simMin;
  const xRead = extra.length ? les.minutes * chars(extra) / chars(les.sections) : 0;
  const theoryX = theory + xRead + checks(extra);
  rows.push({ id: W.id, theory, practice, sims: sims.length, simMin, hands: hands.length, pct: 100 * practice / (theory + practice), theoryX, pctX: 100 * practice / (theoryX + practice) });
}
const sum = k => rows.reduce((a, r) => a + r[k], 0);
const total = { theory: sum('theory'), practice: sum('practice'), theoryX: sum('theoryX') };
total.pct = 100 * total.practice / (total.theory + total.practice);
total.pctX = 100 * total.practice / (total.theoryX + total.practice);
const r0 = x => Math.round(x);
if (process.argv.includes('--md')) {
  console.log('| สัปดาห์ | นาทีทฤษฎี | นาทีปฏิบัติ | ภารกิจห้องจำลอง | ข้อลงมือในแล็บท้ายคาบ | % ปฏิบัติ | % ปฏิบัติ (รวมเนื้อหาเสริม) |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.id} | ${r0(r.theory)} | ${r0(r.practice)} | ${r.sims} | ${r.hands} | ${r0(r.pct)} | ${r0(r.pctX)} |`);
  console.log(`| รวม | ${r0(total.theory)} | ${r0(total.practice)} | | | **${r0(total.pct)}** | **${r0(total.pctX)}** |`);
} else {
  for (const r of rows) console.log(r.id.padEnd(4), 'theory', r0(r.theory), 'practice', r0(r.practice), 'sims', r.sims, 'hands', r.hands, `→ ${r0(r.pct)}%`, `(with supplements ${r0(r.pctX)}%)`);
  console.log(`overall ${r0(total.pct)}% practice (with supplements ${r0(total.pctX)}%)`);
}
module.exports = { rows, total };
