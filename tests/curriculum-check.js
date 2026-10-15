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
const all = []; for (const s in MODS) MODS[s].missions.forEach(m => all.push(s + ':' + m.id));
all.filter(x => !used.has(x)).forEach(x => no('mission not used by any week: ' + x));
console.log(`curriculum: ${WEEKS.length} weeks, ${used.size}/${all.length} missions used, ${bad} issue(s)`);
process.exit(bad ? 1 : 0);
