# Simulator upgrade rules (NetLab 2.6) — read with docs/SIM-SPEC.md and docs/AGENT-RULES.md

- Own ONLY the files your task names (public/js/sim/<sim>.js, server/sims/<sim>.js, tests/sims/<sim>.test.js).
  Do NOT edit public/js/sim/netsim.js unless your task explicitly gives it to you (only the topology task may, and only additively:
  existing exports and behaviour must not change because terminal/troubleshoot depend on it).
- Keep every existing mission id, its grading, its max score and its payload format working (student results are stored by mission id).
  New missions get new ids appended after the existing ones. Existing stored best scores must remain meaningful.
- Real logic only: grading happens on the server from what the student actually did (state/commands/actions), never from a
  "which is the answer" pick. New missions need server grading + unit tests in tests/sims/<sim>.test.js (positive AND negative cases).
- Generated problems (if any) must use the existing HMAC token mechanism of that grader.
- Thai UI text, English technical terms. No emoji. Colours via CSS variables. Touch + mouse + keyboard. No horizontal overflow at 360px.
  Touch targets >= 44px for primary controls. Respect prefers-reduced-motion (animations must have a step/instant alternative).
- Browser check: start your OWN server (never port 3990, never pkill):
    cd /home/claude/netlab && PORT=<your port> APP_SECRET=x node server.js > /tmp/<sim>-srv.log 2>&1 & echo $!
  Guest mode (no DATABASE_URL) still grades through the API. Open http://127.0.0.1:<port>/#/sim/<sim>. Use Python Playwright (Chromium)
  at 390x844 (has_touch, is_mobile) and 1366x768; take screenshots to /mnt/user-data/outputs/screenshots/sims26/<sim>-*.png,
  view them, fix problems. Exercise new flows end to end including a correct and an incorrect submission. Check console errors.
  Kill only your own server PID when done.
- Run: node tests/sims/<sim>.test.js and node tests/sims/netsim.test.js (must pass). Report honestly what was and was not verified.

## 2.8 additions: rubric-reviewed missions
- A mission may declare `review: { teacher: [{ id, title, max, desc }] }` — criteria the TEACHER scores later (public, shown to students).
- Its grade() may return `rubric: [{ id, title, score, max, note }]` — the automatic criteria (sum = score). The payload may carry
  `report` (string, the student's written report, max 6000 chars). The server stores the latest 5 submissions per student+mission
  in `sim_submissions`; teachers score `review.teacher` criteria in teacher.html ("ตรวจงานโครงงาน").
- In the browser: `ctx.review(missionId)` -> `{ submission: { auto_score, auto_max, rubric, report, teacher_scores, teacher_comment, reviewed_at } | null, review }`
  so the sim can show the teacher's feedback.
