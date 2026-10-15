# NetLab 2.8: supplementary sections ("เนื้อหาเสริม") + labs — rules for content/lab builders

The teacher keeps the official 18-week plan (21910-2013). Topics from the reference book (docs/book-toc.md) that NetLab lacks
are added as SUPPLEMENTARY sections at the end of the closest week. They do not count towards "content finished".

## Files you write
- content/lessons/extra/wN.js — `module.exports = [ { id: 'x1', title: 'ชื่อหัวข้อ', blocks: [...] }, { id: 'x2', ... } ]`
  Block types and rules are exactly those in content/lessons/SPEC.md (p, list, steps, table, term, diagram, widget, example, note, check).
  Titles: no leading numbers. Each section: 2–4 `check` blocks (with explain and why[] for choice), at least one diagram or widget,
  one realistic `example`, no paragraph longer than ~90 words, Thai with standard English terms.
- content/lessons/guide/wN.js — ADD entries for x1, x2… (lead, goals, gloss, keys; see tests/guide-check.js). Do not change existing entries.
  Glossary `en` terms must be unique across all weeks (`node tests/guide-check.js` tells you about clashes).
- Your figs file (public/js/figs-<letter>.js; header already there) — diagrams/widgets registered with NL_FIG, used in your sections
  as { type:'diagram'|'widget', name, caption }. Conventions: see docs/AGENT-RULES.md and existing public/js/figs-a.js / widgets2.js
  (CSS variables only, light+dark, <title> alt text, >=44px touch targets, keyboard, prefers-reduced-motion = step buttons, no storage/network,
  REAL computation — e.g. CRC must really divide polynomials, noise must really flip decoded bits).
- Bank items (optional but wanted: 4–6 per topic area) in the unit file named in your task. IMPORTANT: append them at the VERY END of the file as
  `module.exports.push(...[ { id: 'uN-0XX', unit, week, level, type, ... } ]);` with explicit ids greater than the current maximum id of that unit
  (find it with: node -e "console.log(require('./content/bank/unitN.js').map(q=>q.id).sort().pop())"). Follow docs/BANK-SPEC.md (incl. `pre`, `label`).

## Do not
- Do not copy or paraphrase text from the reference book or other copyrighted sources. Write original explanations; verify facts with
  standards/RFCs/vendor docs; mark history as history ("ในอดีต", "ปัจจุบัน").
- Do not edit lesson core files (content/lessons/wN.js), app.js, index.html, other agents' figs files, or the server.
- Never use pkill; never touch port 3990. For a browser preview run your own server: `PORT=<yours> node server.js &` and kill only that PID.

## Verify before finishing
node tests/lessons-check.js ; node tests/guide-check.js ; node tests/bank-check.js — all must pass.
Render each new widget/diagram with Playwright at 390 and 1280, light and dark, exercise every control, check console errors and
horizontal overflow, look at the screenshots (save to /mnt/user-data/outputs/screenshots/extra28/). Report honestly what was verified.
