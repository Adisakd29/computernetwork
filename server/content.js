'use strict';
const crypto = require('crypto');
const { ALL, ROOMS, WEEKS } = require('../content/labs');

/* task index: key -> { lab, task, i, vm } ; keys match the client (lab-i, lab-vmi) */
const TASKS = new Map();
const LABS = new Map();
for (const lab of ALL) {
  LABS.set(lab.id, lab);
  lab.tasks.forEach((t, i) => TASKS.set(`${lab.id}-${i}`, { lab, task: t, i, vm: false }));
  (lab.vmTasks || []).forEach((t, i) => TASKS.set(`${lab.id}-vm${i}`, { lab, task: t, i, vm: true }));
}
const labKeys = lab => [
  ...lab.tasks.map((t, i) => `${lab.id}-${i}`),
  ...(lab.vmTasks || []).map((t, i) => `${lab.id}-vm${i}`)
];
const mainKeys = lab => lab.tasks.map((t, i) => `${lab.id}-${i}`);

function seeded(n, key) {
  const h = crypto.createHash('sha256').update(key).digest();
  const a = [...Array(n).keys()];
  for (let i = n - 1, k = 0; i > 0; i--, k++) { const j = h[k % 32] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  if (n > 1 && a.every((v, i) => v === i)) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

/* strip everything that reveals an answer */
function publicTask(t, key) {
  const o = { type: t.type, q: t.q };
  if (t.pre) o.pre = t.pre;
  if (t.c) o.c = true;
  if (t.type === 'choice') o.options = t.options.slice();
  if (t.type === 'order') {
    o.labels = t.labels.slice();
    o.wide = !!t.wide;
    o.items = seeded(t.items.length, key).map(i => ({ t: t.items[i].t, ...(t.items[i].sw ? { sw: t.items[i].sw } : {}) }));
  }
  if (t.type === 'form') o.fields = t.fields.map(f => ({ label: f.label, type: f.type || 'text', options: f.options, ph: f.ph }));
  return o;
}
function publicLab(lab) {
  const keep = ['id', 'title', 'label', 'ref', 'intro', 'blurb', 'color', 'minutes', 'terminal', 'quick', 'exit', 'week', 'unit', 'challengeRoom', 'vmSetup'];
  const o = {};
  keep.forEach(k => { if (lab[k] !== undefined) o[k] = lab[k]; });
  o.tasks = lab.tasks.map((t, i) => publicTask(t, `${lab.id}-${i}`));
  if (lab.vmTasks) o.vmTasks = lab.vmTasks.map((t, i) => publicTask(t, `${lab.id}-vm${i}`));
  return o;
}
const PUBLIC = JSON.stringify({ rooms: ROOMS.map(publicLab), weeks: WEEKS.map(publicLab) });

module.exports = { TASKS, LABS, labKeys, mainKeys, PUBLIC, ALL };
