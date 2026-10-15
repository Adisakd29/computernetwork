# Shared rules for content/figure work on NetLab 2.6 (read fully before editing)

Project: /home/claude/netlab (Node/Express SPA for a Thai vocational course "ระบบเครือข่ายคอมพิวเตอร์", 18 weeks).
Readers: Thai ปวช./ปวส. students aged 16-19. Thai is the main language; keep English technical terms where standard.

Hard rules
- Technical accuracy first. Verify against IEEE 802, IETF RFCs, Cisco NetAcad/Cisco docs, Microsoft Learn, man pages. Use WebSearch/WebFetch when unsure; record sources.
- Do not delete lessons, questions or features. Fix only real errors or imprecise/over-general wording; keep good content.
- Do NOT reorder, add or remove items in any `quiz` array (content/lessons/wN.js) or forms (content/lessons/forms/wN.js): stored student attempts are index-aligned. You may fix wording, options, answer keys, explanations in place. If you change an answer key, log it clearly (it changes how future attempts are graded; old stored scores are not re-graded).
- Bank files content/bank/unitN.js: you may fix items in place; do not change item `id`s; do not delete items.
- No emoji anywhere. No placeholders.
- Only edit the files your task names. Other agents are editing other files at the same time.
- Never use `pkill -f` (it kills the shell). Do not restart the shared server on :3990 unless your task says so.
- Run the checks your task lists before finishing and report exact results honestly. Do not claim something works without testing it.
- Separate history from current technology explicitly in wording when relevant (e.g. "ในอดีต ... ปัจจุบัน ...").

Useful commands
- node tests/lessons-check.js ; node tests/forms-check.js ; node tests/bank-check.js ; node tests/guide-check.js
- Server for previews: http://localhost:3990 (guest mode works; e2e accounts s1/Stud1234). Python Playwright (Chromium only) is installed: `from playwright.sync_api import sync_playwright`.
