'use strict';
const crypto = require('crypto');
const { ALL, ROOMS, WEEKS, DUP, VM_SHARED } = require('../content/labs');

/* task index: key -> { lab, task, i, vm } ; keys match the client (lab-i, lab-vmi) */
const TASKS = new Map();
const LABS = new Map();
for (const lab of ALL) {
  LABS.set(lab.id, lab);
  lab.tasks.forEach((t, i) => TASKS.set(`${lab.id}-${i}`, { lab, task: t, i, vm: false }));
  (lab.vmTasks || []).forEach((t, i) => TASKS.set(`${lab.id}-vm${i}`, { lab, task: t, i, vm: true }));
}
/* 2.9: keys that are still answered in this lab. Hidden room copies (task.dupOf) and room VM missions that are done in
   the week lab (lab.vmShared) stay in TASKS for history, but are not part of the lab any more. */
const mainKeys = lab => lab.tasks.map((t, i) => t.dupOf ? null : `${lab.id}-${i}`).filter(Boolean);
const vmKeys = lab => lab.vmShared ? [] : (lab.vmTasks || []).map((t, i) => `${lab.id}-vm${i}`);
const labKeys = lab => [...mainKeys(lab), ...vmKeys(lab)];
/* hidden key -> the kept copy { key, lab } */
const TWINS = new Map();
for (const [from, to] of Object.entries(DUP)) TWINS.set(from, { key: to, lab: to.split('-')[0] });
for (const [room, week] of Object.entries(VM_SHARED)) {
  const r = LABS.get(room);
  (r.vmTasks || []).forEach((t, i) => TWINS.set(`${room}-vm${i}`, { key: `${week}-vm${i}`, lab: week }));
}
const ACTIVE = new Set([...LABS.values()].flatMap(labKeys));
const isActive = key => ACTIVE.has(key);
/* number shown to people: position among the tasks still in the lab (VM missions numbered separately) */
function taskNo(key) {
  const t = TASKS.get(key); if (!t) return '';
  if (!isActive(key)) return 'รวมแล้ว';
  const list = t.vm ? vmKeys(t.lab) : mainKeys(t.lab);
  return (t.vm ? 'VM' : '') + (list.indexOf(key) + 1);
}

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
  const keep = ['id', 'title', 'label', 'ref', 'intro', 'blurb', 'color', 'minutes', 'terminal', 'quick', 'exit', 'week', 'unit', 'challengeRoom', 'host', 'also', 'vmShared', 'oldLabel'];
  const o = {};
  keep.forEach(k => { if (lab[k] !== undefined) o[k] = lab[k]; });
  // every task carries its own key: hidden copies are left out, so the browser must never rebuild keys from positions
  o.tasks = lab.tasks.map((t, i) => t.dupOf ? null : Object.assign(publicTask(t, `${lab.id}-${i}`), { key: `${lab.id}-${i}` })).filter(Boolean);
  const merged = lab.tasks.map((t, i) => t.dupOf ? { key: `${lab.id}-${i}`, into: t.dupOf } : null).filter(Boolean);
  if (merged.length) o.merged = merged;
  // 3.0 P6: vmSetup (it plants the files the VM tasks ask about, flags included) is fetched only when the student presses
  // "เตรียมโจทย์" (GET /api/labs/:id/vmsetup), so it is not sitting in the course data every page downloads
  if (lab.vmTasks && !lab.vmShared) { o.vmSetup = true; o.vmTasks = lab.vmTasks.map((t, i) => Object.assign(publicTask(t, `${lab.id}-vm${i}`), { key: `${lab.id}-vm${i}` })); }
  if (lab.vmShared) o.vmMoved = (lab.vmTasks || []).map((t, i) => ({ key: `${lab.id}-vm${i}`, into: `${lab.vmShared}-vm${i}` }));
  return o;
}
const PUBLIC = JSON.stringify({ v: 29, rooms: ROOMS.map(publicLab), weeks: WEEKS.map(publicLab) });
/* 2.8 browsers (old cached scripts on the first load after a deploy) build keys from array positions: they get the old
   shape with every task in place, so an answer can never land on another question's key. Merged copies then answer 410. */
function legacyLab(lab) {
  const keep = ['id', 'title', 'label', 'ref', 'intro', 'blurb', 'color', 'minutes', 'terminal', 'quick', 'exit', 'week', 'unit', 'challengeRoom'];
  const out = {}; keep.forEach(k => { if (lab[k] !== undefined) out[k] = lab[k]; });
  out.tasks = lab.tasks.map((t, i) => publicTask(t, `${lab.id}-${i}`));
  if (lab.vmTasks) out.vmTasks = lab.vmTasks.map((t, i) => publicTask(t, `${lab.id}-vm${i}`));
  return out;
}
const PUBLIC_LEGACY = JSON.stringify({ rooms: ROOMS.map(legacyLab), weeks: WEEKS.map(legacyLab) });

module.exports = { TASKS, LABS, labKeys, mainKeys, PUBLIC, PUBLIC_LEGACY, ALL, TWINS, ACTIVE, isActive, taskNo };
