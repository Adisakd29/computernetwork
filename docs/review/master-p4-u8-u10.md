# Master P4 question review and extension: units 8-10 (w13-w18)

Scope: bank units 8, 9 and 10, the lesson `quiz` arrays and `check` blocks in content/lessons/w13.js to w18.js, and the forms in content/lessons/forms/w13.js to w18.js.
Read first: docs/AGENT-RULES.md, docs/BANK-SPEC.md (including "2.6 additions"), and the earlier logs docs/review/w13-w18.md and docs/review/master-p0-w13-w18.md. Nothing those logs fixed was undone, and the wording here follows the current lesson text (for example: Block wins over Allow in Windows Defender Firewall except for IPsec "Override block rules", the explicit/inherited NTFS order, and first-match ordering for network firewalls).

Structure rules kept: no quiz or form item was added, removed or reordered. No bank id changed. No bank item was deleted. New bank items were added only at the end of each unit file.

## Counts

| | Unit 8 / w13-w14 | Unit 9 / w15-w16 | Unit 10 / w17-w18 | Total |
|---|---|---|---|---|
| Existing bank items reviewed | 38 | 38 | 38 | 114 |
| Lesson quiz items reviewed | 20 | 20 | 20 | 60 |
| Form items reviewed | 20 | 20 | 20 | 60 |
| Lesson checks reviewed | 10 | 10 | 10 | 30 |
| Items with a content fix (wording, options, level, regex, rewrite) | 5 (u8-005, u8-013, u8-028, u8-036, w13 quiz #2) | 3 (u9-008, u9-032, w15 check #0) | 1 (u10-005) | 9 |
| `why` arrays added to existing items | 6 bank + 6 checks | 1 bank + 6 checks | 0 bank + 8 checks | 27 |
| New bank items | 5 | 5 | 5 | 15 |

Every `choice` item in scope (bank `choice`, bank `diagram` with answerType choice, lesson quiz, forms and checks) now has a `why` array with the same length as `options` and `''` for the correct option. All lesson quiz and form `choice` items already had one. Scenario steps have no `why` field in the schema (the grader does not return per-step feedback), so the per-step reasoning stays in each scenario's `explain`.

New items per unit:

| Unit | label | command output (`pre`) | performance scenario |
|---|---|---|---|
| 8 | u8-039 structured-cabling (medium), u8-040 troubleshoot-flow (medium) | u8-041 choice: `netstat -ano` and PID (medium); u8-042 multi: `route print -4`, longest-prefix match (hard) | u8-043: whole lab offline. tracert stops after hop 1, router status shows WAN Link Down. Four steps: locate, confirm, fix, verify (hard) |
| 9 | u9-039 defense-layers (easy), u9-040 backup-321 (medium) | u9-041 choice: `netstat -ano` shows SYN_SENT to many hosts on 445, which looks like a worm (hard); u9-042 choice: Windows Security firewall page, Private (active) is off (medium) | u9-043: first-match edge firewall with Deny-all on top. Four steps: why it fails, correct order, where a 3389 attempt from another IP ends up, how to test with Test-NetConnection -Port 443 (hard) |
| 10 | u10-039 user-mgmt-screen command table, Windows vs Linux (medium), u10-040 ntfs-inheritance precedence order (medium) | u10-041 choice: `net user std12` shows Account expires in the past (medium); u10-042 multi: `id` + `ls -l` group/others permissions (hard) | u10-043: department share. Share Everyone Read blocks saving. Four steps: cause, least-privilege fix, temporary intern via group, verify with Effective Access (hard) |

Label items: every `hide` entry is one whole `<text>` element (checked with `server/figures.texts()`), and texts that would give the answer away are in `blank`:
- u8-039: blank `เต้ารับ` (it sits right above `Outlet`).
- u9-040: blank `3`, `2`, `1`, `+1` (the large digits next to each rule).
- u10-040: blank `Allow ที่ตั้งเองชนะ Deny ที่สืบทอดมาได้` (it states the order of markers 2 and 3).

Labels were chosen so that their position teaches something:
- channel vs permanent link brackets
- the Bottom-Up order
- the measure for each defence layer
- the 3-2-1-1 rules beside their pictures
- Windows/Linux command rows
- the NTFS precedence ranks

Repeated texts such as `Patch Panel`, `Switch` and `Cable Manager` cannot be hidden (they are not unique), so rack-layout was not used. Every `pre` line is 70 characters or shorter, and all addresses are private or documentation ranges.

Level mix after the changes: unit 8 has 14 easy, 21 medium, 8 hard (43 items). Unit 9 has 16/19/8 (43). Unit 10 has 15/19/9 (43).

## Changes to existing items

| # | File | Item | Problem | Change | Source |
|---|---|---|---|---|---|
| 1 | content/bank/unit8.js | u8-005 | Distractor "Peer-to-Peer, every pair wired directly" mixed up an architecture (P2P) with a topology. No `why` | The distractor is now "Full Mesh, cabled directly between every lab pair". Added `why` | Topology definitions in w13 lesson |
| 2 | content/bank/unit8.js | u8-007, u8-016, u8-032, u8-037 | No `why` | Added `why` | - |
| 3 | content/bank/unit8.js | u8-013 | `netstat -ano` also meets the task ("all connections and listening ports, numeric") but was marked wrong | `accept` widened with `^netstat(\.exe)? -(ano\|aon\|nao\|noa\|oan\|ona)$`. Explain says -ano is also accepted. Tested: `netstat -an`, `NETSTAT -ano` and `netstat -a -n` are accepted. `netstat -o`, `netstat -anb` and `ipconfig` are rejected | Microsoft Learn: netstat |
| 4 | content/bank/unit8.js | u8-028 `pre` | One line was 86 characters (over the 70 limit) | Split "Ping request could not find host ... Please check the name ..." into two lines (the text is unchanged) | BANK-SPEC 2.6 |
| 5 | content/bank/unit8.js | u8-036 | Distractor "firewall rules of the web browser" (browsers have no firewall). No `why` | Distractor is now "Proxy setting in the web browser". Added `why` (each wrong option is placed in its OSI layer) | Bottom-Up method, w14 |
| 6 | content/bank/unit9.js | u9-008 | Labelled `hard` but it is a single-step understanding item | Level changed to `medium` | BANK-SPEC level guide |
| 7 | content/bank/unit9.js | u9-018 | No `why` | Added `why` that names each defence layer | defense-layers diagram |
| 8 | content/bank/unit9.js | u9-032 | Near-duplicate of forms/w16 #5 and the w16 quiz #5 (Allow in Private, later Block on all profiles, connect from Private) | Rewritten with the same diagram, same id and same correct index (2). The Block rule is now scoped to Remote IP 192.168.1.50, so the student has to combine "a rule applies only if all its conditions match" with "Block wins over Allow". Correct answer: only 192.168.1.50 is blocked. New `why` and explain, plus the IPsec exception. Tag `scope` added | Microsoft Learn cc755191 (rule evaluation order); w16 Custom rule with remote IP range |
| 9 | content/bank/unit10.js | u10-005 | The right-side item "account created for an intern starting next week" was the same scenario as w17 check #1 | Replaced with "pause the account of an employee on three months' maternity leave so it can be used again later" (still maps to Account is disabled; `answer` unchanged). Explain adjusted | - |
| 10 | content/lessons/w13.js | quiz #2 | The stem never said 192.168.1.1 is the gateway, but the key and explain depend on it | Stem now says "ping 192.168.1.1 (Default Gateway ของเครื่อง)". Key unchanged | - |
| 11 | content/lessons/w15.js | check #0 | Weak distractors "threat from electricity" and "threat from heat" are not categories the lesson teaches | Options 2 and 3 are now "ภัยคุกคามทางซอฟต์แวร์" and "การโจมตีแบบ DoS". Key unchanged (1) | w15 threat categories |
| 12 | content/lessons/w13-w18.js | 20 choice checks (w13 #0 #2 #3, w14 #0 #1 #3, w15 #0 #1 #4, w16 #1 #2 #3, w17 #0 #1 #2 #3, w18 #0 #1 #2 #3) | No `why` | Added `why` to each one | - |

## Reviewed and kept (no change needed)

- Answer keys: every key in the bank, quiz, forms and checks in scope was re-derived and is correct. Examples:
  - u8-030: /25 puts the gateway outside the subnet.
  - u8-042: 10.60.1.1 does not match 10.50.0.0/16, so it uses the default route.
  - u9-023: Full + latest Differential.
  - u10-023: NTFS union is Modify; the stricter of Share and NTFS is Modify.
  - u10-036: the owner class only.
  - w18 forms #5: the group class r-x.
- Facts checked:
  - 1U = 1.75 in.
  - Permanent link 90 m / channel 100 m.
  - netstat states. UDP has no state.
  - Non-authoritative answer.
  - Destination host unreachable from your own IP counts as Received.
  - WannaCry used SMB 445.
  - Defender goes passive when a third-party AV is registered.
  - Windows Firewall defaults: inbound block, outbound allow.
  - Wizard page order.
  - Built-in Administrator is not subject to UAC by default.
  - Built-in Administrator and Guest are disabled by default.
  - lusrmgr is not in Home editions.
  - "User must change password" conflicts with the other two options.
  - Share Read + NTFS Full control = Read.
  - Linux owner-class rule.
  - Directory x/r/w.
- Accepted overlaps (different format or skill, so kept):
  - u10-031 step 1 and u10-032 (tf) both cover workgroup credentials. One is a step inside a troubleshooting story, the other is a stand-alone fact.
  - u10-034 (type the chmod command from a written requirement) and w18 quiz #9 (number from a symbolic string) both give 750.
  - u9-020 (meaning of "2") and w16 check #2 (meaning of "1").
  - The forms are post-test twins of the quizzes by design.
- Distractor quality: the remaining weak ones are kept because they are used for easy recall items (for example w17 check #0 "faster internet"). Their `why` now says why they are wrong.

## Answer-key changes

None. No `correct`, `answer`, `answers`, `blanks`, `items` order or `hide` value changed in any existing lesson quiz, check, form or bank item.

Grading-related notes (not key changes):
- u8-013: the `accept` regex was widened. Everything accepted before is still accepted, and `netstat -ano` (and its flag permutations) is now accepted too. Old attempts are not re-graded.
- u9-032: the stem, options and why were rewritten to remove a near-duplicate of forms/w16 #5. The id and correct index (2) are unchanged, but the meaning of option 2 changed. Old attempts and exam reviews of this item show the new text. Teachers who already used u9-032 in an exam should know the wording changed.
- w15 check #0: two wrong options were reworded. Checks are not stored as scored attempts beyond the instant feedback, and the key is unchanged.

## Observations outside my files (not edited)

- The diagram `user-mgmt-screen` (public/js figs) still says "ยาวอย่างน้อย 12 ตัว" next to the password fields. The w17 lesson tip now follows NIST SP 800-63B rev 4 (at least 15 characters when the password is the only factor, 8 with MFA). The figure owner may want to align it.

## Check output (final run)

```
node tests/bank-check.js
unit8: ok {"questions":43,"types":{"choice":8,"fill":2,"match":3,"multi":3,"diagram":6,"order":2,"tf":3,"command":7,"scenario":7,"label":2},"levels":{"easy":14,"medium":21,"hard":8}}
unit9: ok {"questions":43,"types":{"choice":18,"tf":4,"match":6,"multi":3,"fill":2,"order":2,"scenario":3,"diagram":2,"command":1,"label":2},"levels":{"easy":16,"medium":19,"hard":8}}
unit10: ok {"questions":43,"types":{"choice":14,"multi":3,"tf":4,"order":2,"match":4,"fill":2,"command":6,"scenario":3,"diagram":3,"label":2},"levels":{"easy":15,"medium":19,"hard":9}}
(units 1-7 also ok; no warnings printed for any unit)
node tests/lessons-check.js   -> w1..w18 ok, visuals: 52 placements, ok
node tests/forms-check.js     -> w1..w18 ok
```

## Sources

- Microsoft Learn: netstat (-a, -n, -o / PID); route print (-4); net user (/active, /expires); net localgroup.
- Microsoft Learn: Order of Windows Firewall with Advanced Security rule evaluation (cc755191), where Block wins over Allow except for authenticated bypass. Windows Security "Firewall & network protection" page shows the active profile.
- Microsoft (TechNet cc773031): "Users cannot write to a shared folder" — the default share permission for Everyone is Read since Windows Server 2003, so Share Read restricts NTFS Modify over the network.
- Microsoft Learn: Microsoft Defender Antivirus compatibility with other antivirus products (passive or disabled mode).
- NIST SP 800-41 rev 1 (firewall rule sets: ordered evaluation, default deny last); NIST SP 800-63B-4 (password length).
- ANSI/TIA-568 (90 m permanent link, 100 m channel).
- man ls, man chmod, man id (owner/group/others class selection; directory r/w/x).
