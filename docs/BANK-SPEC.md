# NetLab question bank specification (Phase 4)

The question bank feeds **Practice mode** (students pick units/levels, get instant feedback) and **Exam mode**
(teacher-made exams drawn at random per student, timed, graded on the server). Students are Thai vocational
students (ปวช./ปวส.) in the course "ระบบเครือข่ายคอมพิวเตอร์" (10 units, 18 weeks). Technical accuracy is the top priority.

Files: `content/bank/unit1.js` … `content/bank/unit10.js`, each `module.exports = [ ...questions ]` (CommonJS, server only).
Read for context: `content/lessons/SPEC.md` (week topics + accuracy checklist) and the lesson files
`content/lessons/wN.js` for the weeks of your units (the bank must be answerable from what those lessons teach).
**Do not copy questions from the lessons' `quiz` arrays** (those are the pre/post-tests and must stay separate).

Units and weeks: U1 = w1, U2 = w2, U3 = w3, U4 = w4–w5, U5 = w6–w7, U6 = w8–w9, U7 = w10–w12, U8 = w13–w14, U9 = w15–w16, U10 = w17–w18.

## Common fields (every question)

```js
{ id: 'u3-017',          // 'u<unit>-<3 digits>', unique
  unit: 3, week: 3,      // week the topic belongs to
  level: 'easy' | 'medium' | 'hard',
  type: '...',           // one of the 10 types below
  q: 'คำถาม ภาษาไทย',
  explain: 'ทำไมคำตอบนี้ถูก 1–3 ประโยค',   // shown after answering in practice, and in exam review
  tags: ['osi', 'tcp-ip'] }               // short English tags for search/statistics
```

## The 10 types

```js
// 1 Multiple choice (one answer). `why` optional: per-option feedback for wrong picks ('' for the correct one)
{ type: 'choice', options: ['...', '...', '...', '...'], correct: 2, why: ['...', '...', '', '...'] }

// 2 Multiple select (all correct options must be ticked, no extras)
{ type: 'multi', options: ['...', '...', '...', '...', '...'], correct: [0, 3] }

// 3 True/False
{ type: 'tf', answer: false }

// 4 Matching: each left item matches exactly one right item; right may contain 1–2 extra distractors
{ type: 'match', left: ['Hub', 'Switch', 'Router'], right: ['ส่งตาม IP ระหว่างเครือข่าย', 'กระจายทุกพอร์ต', 'ส่งตาม MAC ไปพอร์ตเดียว', 'แปลงสัญญาณดิจิทัล/แอนะล็อก'],
  answer: [1, 2, 0] }                 // answer[i] = index in right[] for left[i]

// 5 Drag and drop ordering: `items` written in the CORRECT order; the app shuffles them
{ type: 'order', items: ['ขั้นที่ 1 ...', 'ขั้นที่ 2 ...', 'ขั้นที่ 3 ...', 'ขั้นที่ 4 ...'] }

// 6 Fill in the blank(s): {{1}}, {{2}} ... in q; blanks[i] = accepted answers for blank i+1
{ type: 'fill', q: 'มาตรฐานสาย UTP กำหนดความยาวสูงสุด {{1}} เมตร และหัวต่อที่ใช้คือ {{2}}',
  blanks: [['100'], ['RJ-45', 'RJ45']] }      // compared case-insensitive, spaces/-/_/: ignored

// 7 Subnet calculation: the grader computes the answers from ip/prefix itself
{ type: 'subnet', ip: '192.168.10.77', prefix: 27,
  ask: ['network', 'broadcast', 'first', 'last', 'hosts', 'mask'] }   // any subset, in display order
  // optional: maskGiven: true -> the question shows a dotted mask instead of /prefix

// 8 Network diagram analysis: a topology (NetSim JSON, see docs/SIM-SPEC.md §3.1) rendered as a picture
//   OR a catalog diagram name from content/lessons/SPEC.md, plus a choice/multi question about it
{ type: 'diagram', topo: { devices: [...], links: [...] },   // or: diagram: 'topologies'
  answerType: 'choice', options: ['...'], correct: 1 }        // answerType 'multi' -> correct: [..]

// 9 Command-based: the student types a command; accepted if it matches any regex (case-insensitive,
//   whitespace collapsed, trimmed). Give the canonical form in `example` (shown in review).
{ type: 'command', os: 'windows' | 'linux',
  accept: ['^ipconfig /all$'], example: 'ipconfig /all' }

// 10 Scenario-based troubleshooting: a story + evidence, then 2–4 steps; partial credit per step
{ type: 'scenario', context: 'เรื่องราวสั้น ๆ', pre: 'ผลคำสั่ง (optional, plain text)',
  steps: [ { q: 'อาการนี้บอกอะไร', options: ['...','...','...','...'], correct: 0 },
           { q: 'ควรแก้อย่างไร',    options: ['...','...','...','...'], correct: 2 } ] }
```

## Quantity and quality

- Per unit file: **at least 32 questions**, using **at least 8 of the 10 types** (subnet only where it fits:
  U3 and U6 must have ≥ 4 subnet items; U8 must have ≥ 3 diagram items with `topo`; U6, U8 and U10 must have ≥ 3
  command items; every unit ≥ 2 scenario items). Level mix ≈ 40% easy, 40% medium, 20% hard.
- Distractors plausible and of similar length; the correct choice must not usually be the longest; vary correct positions.
- `multi` must have 2+ correct and 1+ wrong options. `match` 3–6 left items. `order` 3–7 items with one defensible order.
- Command regexes must accept common equivalent forms (e.g. `ipconfig /all`, `ipconfig/all`, `IPCONFIG /ALL`;
  `ping -c 4 8.8.8.8` vs `ping 8.8.8.8 -c 4` if both work in reality) and reject wrong ones.
- `diagram` topologies must be valid NetSim JSON (ids, ifaces with ip/prefix, links with ports `eth0`, `p1..`, `g0/0..`);
  keep them small (≤ 8 devices) and set x/y so the picture is readable (x 40–600, y 40–300).
- No Markdown/HTML in text. Thai language natural for ปวช.; English terms in parentheses where helpful.
- Facts must follow the accuracy checklist in `content/lessons/SPEC.md`.

## Self-check

Run `node tests/bank-check.js unitN` (validates schema, types, ids, answer indexes, subnet math, regex compile,
topology shape, counts). Fix every ERROR and warnings about answer position/length.
