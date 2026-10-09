// Validates lesson files against content/lessons/SPEC.md
// usage: node tests/lessons-check.js            (all lessons found)
//        node tests/lessons-check.js w1 w2 w3   (selected)
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'content', 'lessons');
const DIAGRAMS = ['net-components', 'lan-man-wan', 'p2p-vs-cs', 'topologies', 'network-devices', 'cable-types', 'connectors', 'osi-tcpip', 'encapsulation', 'ip-classes', 'utp-pinout', 'straight-cross', 'wifi-modes', 'wifi-bands', 'unc-share', 'nos-services', 'vm-layers', 'lab-network-plan', 'ping-ladder', 'firewall', 'defense-layers', 'users-groups', 'linux-perms',
  'wlan-devices', 'wifi-security-timeline', 'windows-ip-settings', 'nos-vs-os', 'hypervisor-types', 'vm-netmodes', 'rack-layout', 'routing-decision', 'troubleshoot-flow', 'malware-types', 'backup-321', 'firewall-profiles'];
const WIDGETS = ['topology-sim', 'hub-switch-sim', 'osi-explorer', 'encap-stepper', 'ip-calc', 'bandwidth-calc', 'pinout-viewer', 'wifi-security-check', 'ping-ladder', 'firewall-tester', 'caesar', 'perm-calc', 'port-lookup',
  'ipv6-tool', 'subnet-splitter', 'route-lookup', 'nic-config', 'share-ntfs', 'vm-netmode', 'threat-sorter', 'backup-321'];
const BLOCKS = ['p', 'list', 'steps', 'table', 'term', 'diagram', 'widget', 'example', 'note', 'check'];

function checkQ(q, where, errs) {
  const e = m => errs.push(`${where}: ${m}`);
  if (!q || typeof q !== 'object') return e('missing question object');
  if (!['easy', 'medium', 'hard'].includes(q.level)) e('level must be easy|medium|hard');
  if (!q.q || typeof q.q !== 'string') e('missing q text');
  if (!q.explain || q.explain.length < 10) e('missing/short explain');
  switch (q.type) {
    case 'choice':
      if (!Array.isArray(q.options) || q.options.length < 2) e('choice needs options');
      else {
        if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) e('correct index out of range');
        if (new Set(q.options).size !== q.options.length) e('duplicate options');
        if (q.why && q.why.length !== q.options.length) e('why[] length must equal options length');
      }
      break;
    case 'multi':
      if (!Array.isArray(q.options) || q.options.length < 3) e('multi needs >=3 options');
      if (!Array.isArray(q.correct) || !q.correct.length || q.correct.some(i => !Number.isInteger(i) || i < 0 || i >= (q.options || []).length)) e('multi correct must be array of valid indexes');
      if (Array.isArray(q.correct) && q.correct.length === (q.options || []).length) e('multi: not all options may be correct');
      break;
    case 'tf':
      if (typeof q.answer !== 'boolean') e('tf answer must be boolean');
      break;
    case 'text':
      if (!Array.isArray(q.answers) || !q.answers.length) e('text needs answers[]');
      break;
    default: e('unknown type ' + q.type);
  }
}

function checkLesson(id) {
  const errs = [], warns = [];
  const file = path.join(DIR, id + '.js');
  let L;
  try { delete require.cache[require.resolve(file)]; L = require(file); } catch (err) { return { errs: ['cannot load: ' + err.message], warns }; }
  const n = Number(id.slice(1));
  if (L.id !== id) errs.push('id mismatch');
  if (L.week !== n) errs.push('week mismatch');
  if (!Number.isInteger(L.unit)) errs.push('unit missing');
  if (!L.title) errs.push('title missing');
  if (!Array.isArray(L.objectives) || L.objectives.length < 3) errs.push('objectives: need >=3');
  if (!L.competency) errs.push('competency missing');
  if (!Array.isArray(L.keywords) || L.keywords.length < 3) errs.push('keywords: need >=3');
  if (!Array.isArray(L.summary) || L.summary.length < 4) errs.push('summary: need >=4');
  if (!Array.isArray(L.quiz) || L.quiz.length !== 10) errs.push(`quiz must have 10 items (has ${L.quiz ? L.quiz.length : 0})`);
  (L.quiz || []).forEach((q, i) => checkQ(q, `quiz#${i + 1}`, errs));
  const pos = (L.quiz || []).filter(q => q.type === 'choice').map(q => q.correct);
  if (pos.length >= 4 && new Set(pos).size < 3) warns.push('choice correct positions not varied: ' + pos.join(','));
  const longest = (L.quiz || []).filter(q => q.type === 'choice').filter(q => { const l = q.options.map(o => o.length); return q.options[q.correct].length === Math.max(...l) && l.filter(x => x === Math.max(...l)).length === 1; }).length;
  if (pos.length && longest / pos.length > 0.5) warns.push(`correct option is the single longest in ${longest}/${pos.length} choice items`);
  const lv = (L.quiz || []).map(q => q.level);
  ['easy', 'medium', 'hard'].forEach(x => { if (!lv.includes(x)) warns.push('quiz has no ' + x + ' items'); });
  if (!Array.isArray(L.sections) || L.sections.length < 4) errs.push('sections: need >=4');
  let checks = 0, diagrams = 0, examples = 0, notes = 0, widgets = 0, words = 0;
  const ids = new Set();
  (L.sections || []).forEach((s, si) => {
    const w = `section#${si + 1}`;
    if (!s.id || ids.has(s.id)) errs.push(w + ' needs unique id'); ids.add(s.id);
    if (!s.title) errs.push(w + ' title missing');
    if (!Array.isArray(s.blocks) || !s.blocks.length) errs.push(w + ' has no blocks');
    (s.blocks || []).forEach((b, bi) => {
      const bw = `${w} block#${bi + 1}`;
      if (!BLOCKS.includes(b.type)) return errs.push(bw + ' unknown type ' + b.type);
      const txt = [b.text, b.term, b.title, ...(b.items || []), ...((b.rows || []).flat()), ...(b.head || [])].filter(Boolean).join(' ');
      words += txt.length;
      if (/[<>]|\*\*|^#/.test(txt) && b.type !== 'table') warns.push(bw + ' contains markup characters');
      if (b.type === 'p' && !b.text) errs.push(bw + ' p without text');
      if ((b.type === 'list' || b.type === 'steps') && (!Array.isArray(b.items) || !b.items.length)) errs.push(bw + ' list without items');
      if (b.type === 'table' && (!Array.isArray(b.head) || !Array.isArray(b.rows) || b.rows.some(r => r.length !== b.head.length))) errs.push(bw + ' table rows must match head length');
      if (b.type === 'diagram') { diagrams++; if (!DIAGRAMS.includes(b.name)) errs.push(bw + ' unknown diagram ' + b.name); }
      if (b.type === 'widget') { widgets++; if (!WIDGETS.includes(b.name)) errs.push(bw + ' unknown widget ' + b.name); }
      if (b.type === 'example') examples++;
      if (b.type === 'note') { notes++; if (!['tip', 'warn'].includes(b.kind)) errs.push(bw + ' note kind must be tip|warn'); }
      if (b.type === 'check') { checks++; checkQ(b.q, bw + ' check', errs); }
    });
  });
  if (checks < 3) errs.push(`need >=3 check blocks (has ${checks})`);
  if (diagrams < 1) errs.push('need >=1 diagram');
  if (examples < 2) errs.push(`need >=2 example blocks (has ${examples})`);
  if (notes < 1) errs.push('need >=1 note');
  if (words < 3500) warns.push(`theory looks short (${words} characters)`);
  return { errs, warns, stats: { sections: (L.sections || []).length, checks, diagrams, widgets, examples, chars: words } };
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(DIR).filter(f => /^w\d+\.js$/.test(f)).map(f => f.replace('.js', '')).sort((a, b) => a.slice(1) - b.slice(1));
let bad = 0;
for (const id of ids) {
  const r = checkLesson(id);
  console.log(`${id}: ${r.errs.length ? 'FAIL' : 'ok'} ${r.stats ? JSON.stringify(r.stats) : ''}`);
  r.errs.forEach(e => console.log('   ERROR', e));
  r.warns.forEach(w => console.log('   warn ', w));
  if (r.errs.length) bad++;
}
// extra visuals placed at load time (content/lessons/visuals.js): names must exist, anchors must resolve
{
  const V = require('../content/lessons/visuals.js');
  const txt = b => [b.text, b.name, b.term, b.title, (b.items || []).join(' '), (b.head || []).join(' ')].filter(Boolean).join(' ');
  let vbad = 0;
  for (const v of V) {
    const L = require(`../content/lessons/${v.lesson}.js`), S = L.sections.find(x => x.id === v.section);
    const known = v.block.type === 'diagram' ? DIAGRAMS : WIDGETS;
    const problem = !known.includes(v.block.name) ? 'unknown ' + v.block.type : !S ? 'no section' : !S.blocks.some(b => b.type === v.anchor.type && txt(b).includes(v.anchor.match)) ? 'anchor not found' : !v.block.caption ? 'no caption' : null;
    if (problem) { vbad++; console.log(`visuals ${v.lesson} ${v.section} ${v.block.name}: ERROR ${problem}`); }
  }
  console.log(`visuals: ${V.length} placements, ${vbad ? vbad + ' problems' : 'ok'}`);
  if (vbad) bad++;
}
process.exit(bad ? 1 : 0);
