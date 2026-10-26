'use strict';
/* 3.0 curriculum plan: every week planned, every reference real, every simulator mission used somewhere */
const { WEEKS } = require('../content/curriculum');
const { MODS } = require('../server/sims-api');
const { SKILLS } = require('../server/skills');
const { LESSONS } = require('../server/lessons');
let bad = 0; const no = m => { bad++; console.log('  x', m); };
const ids = WEEKS.map(w => w.id);
for (let i = 1; i <= 18; i++) if (!ids.includes('w' + i)) no('week w' + i + ' missing');
if (new Set(ids).size !== ids.length) no('duplicate week');
const used = new Set(); const skillIds = SKILLS.map(s => s.id);
for (const w of WEEKS) {
  if (!LESSONS.has(w.id)) no(w.id + ': no lesson');
  if (!w.focus || !Array.isArray(w.can) || !w.can.length) no(w.id + ': focus/can missing');
  for (const k of ['guided', 'independent', 'trouble']) for (const r of w[k]) {
    const [sim, id] = r.split(':');
    if (!MODS[sim] || !MODS[sim].missions.some(m => m.id === id)) no(`${w.id}.${k}: unknown mission ${r}`); else used.add(r);
  }
  if (!w.guided.length && !w.independent.length && !w.trouble.length) no(w.id + ': no hands-on activity');
  w.skills.forEach(s => { if (!skillIds.includes(s)) no(`${w.id}: unknown skill ${s}`); });
  (w.planned || []).forEach(p => { if (![3, 4, 5].includes(p.phase) || !p.what) no(w.id + ': bad planned item'); });
}
/* 3.1 step structure: step 4 has 1-2 main missions (type trouble|analysis); every week practises something of its own in
   step 3 (a Guided mission first listed in that week), so a review-only list can never mark step 3 passed */
const { firstWeekOf } = require('../content/curriculum');
for (const w of WEEKS) {
  if (!Array.isArray(w.solve) || w.solve.length < 1 || w.solve.length > 2) no(w.id + ': step 4 needs 1-2 main missions (solve)');
  if (!['trouble', 'analysis'].includes(w.solveType)) no(w.id + ': solveType must be trouble or analysis');
  if (String([...w.solve, ...w.more]) !== String(w.trouble)) no(w.id + ': trouble must equal solve + more');
  if (!w.guided.some(r => firstWeekOf(r) === w.id)) no(w.id + ': no Guided mission of its own (all are review from earlier weeks)');
  w.solve.forEach(r => { if (w.guided.includes(r)) no(`${w.id}: ${r} is both Guided and the step-4 main mission`); });
}
const mains = WEEKS.flatMap(w => w.solve); mains.filter((r, i) => mains.indexOf(r) !== i).forEach(r => no('same step-4 main mission in two weeks: ' + r));
/* 3.2: one practical session per week (Guided + Independent + Troubleshooting under one timer). No item (hands-on task key
   or 'sim:mission') may be scored in two weeks' sessions, and every session takes 30-100 minutes. */
const P = require('../server/practical');
const owner = new Map();
for (const w of WEEKS) {
  const set = P.setOf(w.id);
  if (!set) { no(w.id + ': no practical session'); continue; }
  if (!(set.minutes >= 30 && set.minutes <= 100)) no(`${w.id}: practical session takes ${set.minutes} min (must be 30-100)`);
  if (!set.items.length) no(w.id + ': practical session has no item');
  for (const it of set.items) {
    if (owner.has(it.key) && owner.get(it.key) !== w.id) no(`${it.key} is in the practical sessions of ${owner.get(it.key)} and ${w.id}`);
    else if (set.items.filter(x => x.key === it.key).length > 1) no(`${w.id}: ${it.key} twice in one session`);
    owner.set(it.key, w.id);
  }
}
try { for (const [k, wid] of owner) if (P.weekOfItem(k) !== wid) no(`weekOfItem(${k}) = ${P.weekOfItem(k)}, expected ${wid}`); }
catch (e) { no('weekOfItem: ' + e.message); }
const all = []; for (const s in MODS) MODS[s].missions.forEach(m => all.push(s + ':' + m.id));
all.filter(x => !used.has(x)).forEach(x => no('mission not used by any week: ' + x));
console.log(`curriculum: ${WEEKS.length} weeks, ${used.size}/${all.length} missions used, ${owner.size} practical items in one week each, ${bad} issue(s)`);
process.exit(bad ? 1 : 0);
