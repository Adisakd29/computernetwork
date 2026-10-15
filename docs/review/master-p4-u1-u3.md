# Master P4 question review and extension: units 1-3 (weeks 1-3)

Scope: content/bank/unit1.js, unit2.js and unit3.js. Also content/lessons/w1.js to w3.js (the `quiz` arrays and `check` blocks only) and content/lessons/forms/w1.js to w3.js.
Rules followed: docs/AGENT-RULES.md and docs/BANK-SPEC.md (2.6 additions).

- No bank `id` was changed and no bank item was deleted.
- No item in a lesson quiz or form was added, removed or reordered.
- Lesson theory text was not touched. Items were checked against the current lesson text and the earlier accuracy logs (docs/review/master-p0-w1-w5.md, w1-w6.md).

## Counts

| | Unit 1 / w1 | Unit 2 / w2 | Unit 3 / w3 | Total |
|---|---|---|---|---|
| Existing bank items reviewed | 37 | 37 | 38 | 112 |
| Lesson quiz items reviewed | 10 | 10 | 10 | 30 |
| Form B items reviewed | 10 | 10 | 10 | 30 |
| Check blocks reviewed | 5 | 5 | 6 | 16 |
| **Items reviewed** | | | | **188** |
| Items fixed (content or level, not counting why-only additions) | 6 bank + 4 lesson-side | 6 bank + 4 lesson-side | 5 bank + 2 lesson-side | **27** |
| why[] arrays added to existing items | 12 bank + 4 checks | 16 bank + 4 checks | 11 bank + 4 checks | **51** |
| New bank items | 5 | 5 | 5 | 15 |

New items in each unit:

| Unit | label | Command output / data (`pre`) | scenario |
|---|---|---|---|
| 1 | u1-038 lab-room-network (medium), u1-039 topologies (easy) | u1-040 choice: systeminfo + net view, Workgroup (medium); u1-041 multi: ping in the LAN vs over the WAN (medium) | u1-042 plan a 2-floor office: architecture, topology, switch port count, WAN (hard, 4 steps) |
| 2 | u2-038 device-ports, router rear panel (easy); u2-039 connectors, identify by shape (medium) | u2-040 multi: ipconfig /all with two NICs and their MACs, Media disconnected (medium); u2-041 choice: `show mac address-table` and flooding of an unknown MAC (hard) | u2-042 lab upgrade: hub to switch, UTP Cat6, 260 m fiber with SFP, Access Point (hard, 4 steps) |
| 3 | u3-039 osi-tcpip (medium), u3-040 encapsulation PDUs + MAC/FCS (medium) | u3-041 multi: ipconfig with IPv4/24 and fe80:: link-local (medium); u3-042 choice: Wireshark summary, destination MAC is the gateway (hard) | u3-043 check a lab IP plan: DHCP pool size, static IP for the printer, mask (medium, 3 steps) |

Level mix after the changes:

| Unit | Easy | Medium | Hard |
|---|---|---|---|
| 1 | 15 | 21 | 6 |
| 2 | 15 | 19 | 8 |
| 3 | 14 | 21 | 8 |

Every unit keeps at least 12% hard items.

### Label item design

- Every `hide` label is one whole `<text>` element. This was checked with `figures.texts()` and `marksFor`, and bank-check runs the leak check.
- Descriptive texts that would give an answer away are in `blank`:
  - topologies and connectors: the one-line descriptions.
  - device-ports: the "WAN (บางรุ่นเขียน Internet)..." and "Reset: กดค้าง..." notes.
  - lab-room-network: the "Uplink (ไฟเบอร์/Cat6A)" legend.
- Each hidden position teaches something:
  - which rear port is WAN and how it differs from LAN1, DC and Reset;
  - where the Firewall and Core Switch sit, and which part is Star versus Extended Star;
  - which OSI layer is 5, 6 or 3, and which TCP/IP layers are Internet and Network Access;
  - which PDU each layer creates, and which header and trailer (MAC, FCS) the Data Link layer adds.
- Distractor `extra` labels test common mix-ups: '5 Presentation' and '6 Session' (numbering), RJ-11, Tree, Hub, Bus, SFP and Console.

### Command-output items

- All output follows real Windows, Cisco IOS or Wireshark formats.
- Only documentation and private addresses are used: 192.168.x.x, 10.x, 203.0.113.x.
- Every line is at most 70 characters, which a script checked.
- Values agree with each other within each item. For example:
  - TTL 126 on the routed WAN ping, and TTL 128 inside the LAN.
  - The Wireshark source MAC equals the NIC MAC used in u2-040.
  - The DHCP pool of 100 addresses fits 41 clients.
- Output is shortened in places: some lines are cut, and the `net view` dashes are shorter. No values were invented that the real command would not show.

## Changes to existing items

| # | File | Item | Problem | Fix | Source |
|---|---|---|---|---|---|
| 1 | bank/unit1 | u1-001 | Distractor "ด้านการลดสัญญาณรบกวน" was not one of the 4 benefits, so it was obviously wrong | Replaced with "ด้านความรวดเร็วในการส่งไฟล์" plus why[]. The lesson table puts cloud co-editing under สะดวก, so the item is not ambiguous | w1 s1 table |
| 2 | bank/unit1 | u1-002 | Near-duplicate of form B w1 #1 (sending a file instead of copying to a flash drive = speed). Two silly distractors (บันเทิง, ประหยัดไฟ) | Reversed the item: "which example shows the cost-saving benefit". The 4 options are one example of each benefit. Added why[] | w1 s1 table |
| 3 | bank/unit1 | u1-014, u1-035 | Labelled hard, but they need one step of understanding | Level changed to medium | |
| 4 | bank/unit1 | u1-034 | Weak distractors ("signal twice as fast", "medium becomes wireless") | New plausible distractors (same cable, same brand, receiver converts by itself) plus why[] | w1 s2 |
| 5 | bank/unit1 | u1-037 | Too close to form B w1 #10 (8-router Full Mesh = 28). The 28 answer appeared as a distractor and the explain gave it away | Now 4 to 9 devices, answer 30 added. Distractors: 9 (device count), 36 (total), 72 (forgot ÷2). why[] and explain rewritten | n(n-1)/2 |
| 6 | bank/unit2 | u2-012, u2-033 | Recall items labelled hard | Level changed to medium | |
| 7 | bank/unit2 | u2-017 | "Order by speed" was ambiguous: Cat5e and Cat6 both carry 1 Gbps at 100 m | Stem now orders by bandwidth (MHz) and speed at 100 m. This gives one defensible order (100/100/250/500 MHz) | TIA-568.2-D |
| 8 | bank/unit2 | u2-022 | Distractor "ฝังจานไว้ใต้ดิน" was silly | Replaced with "ติดตรงไหนก็ได้ เพราะคลื่นทะลุอาคารได้" (a real misconception) plus why[] | |
| 9 | bank/unit2 | u2-024 | Distractor "ต้องเข้าหัว BNC ทุกจุด" was silly | Replaced with a pairing misconception plus why[] | |
| 10 | bank/unit2 | u2-032 | "ราว 100 เมตร" could be defended: Bluetooth Class 1 reaches about 100 m. "36,000 กม." was silly | Options are now about 4 cm (NFC), about 1 km, tens of km, and about 10 m (key). The key stays at index 3 | Bluetooth Core Spec power classes; w2 s4 table |
| 11 | bank/unit3 | u3-012 | "การถ่ายทอดวิดีโอสด" is imprecise: most live streaming platforms deliver over TCP (HLS/DASH) | Stem is now "เกมออนไลน์และการโทรผ่านอินเทอร์เน็ต (VoIP)", which matches the tcp-vs-udp figure in w3. Explain refined | RFC 3550 (RTP over UDP); w3 tcp-vs-udp figure |
| 12 | bank/unit3 | u3-016 | Same question as form B w3 #3 (Network Access maps to OSI 1-2) | Rewritten: "switch (MAC) and UTP cable work in which TCP/IP layer" (key: Network Access). why[] added | RFC 1122 |
| 13 | bank/unit3 | u3-022 | Options 172.15.x, 172.31.200.x and 11.0.0.1 repeated form B w3 #7 | New addresses: 172.32.0.5, 172.24.10.9, 9.255.255.1, 192.167.10.1, 10.255.0.1. The key indexes stay [0,2,3] | RFC 1918 |
| 14 | bank/unit3 | u3-034 | Same question as form B w3 #4 (Bluetooth = 802.15, with identical options) | Rewritten as a spec-sheet item: Gigabit Ethernet = 802.3, Wi-Fi 6 = 802.11, Zigbee = 802.15. Level medium, why[] added | IEEE 802.3ab, 802.11ax, 802.15.4 |
| 15 | bank/unit3 | u3-036 | Restates the lesson explanation of CSMA/CA, labelled hard | Level changed to medium | |
| 16 | lessons/w1 + forms/w1 | quiz #5 / form #5 | "Switch fails" and "ring cut" are one-step understanding, labelled hard | Both changed to medium (form B level must match A). Quiz still has a hard item (#10) | |
| 17 | lessons/w1 | check s1 | Distractors "ประหยัดไฟฟ้า", "บันเทิง" | Now ประหยัดค่าใช้จ่าย and "ลดจำนวนสายสัญญาณ" plus why[]. Key unchanged (1) | |
| 18 | lessons/w1 | check s4 | Options "Mainframe" (not taught) and "WAN" (not an architecture) | Now "Client-Server แบบมีเซิร์ฟเวอร์สำรอง" and "WAN แบบเช่าวงจร" plus why[]. Key unchanged (1) | |
| 19 | lessons/w2 + forms/w2 | quiz #8 / form #8 | Recognising fiber connectors is recall, labelled hard | Both changed to medium. Quiz keeps a hard item (#6) | |
| 20 | lessons/w2 | check s1 | Distractor "เก็บไว้จนกว่าจะมีคนขอ" was weak | Options are now switch behaviour, router behaviour, flood (key) and send-back, plus why[]. Key unchanged (2) | |
| 21 | lessons/w2 | check s3 | "สายโทรศัพท์ 2 คู่" and "สายลำโพง" were non-network distractors | Now UTP Cat5e, STP (key), UTP Cat6, thin coax, plus why[]. Key unchanged (1) | |
| 22 | lessons/w3 + forms/w3 | quiz #8 / form #8 | Matching PDUs is recall, labelled hard | Both changed to medium. Quiz keeps a hard item (#5) | |

why[] arrays were added to the following existing items. Each array has the same length as the options, with '' for the key.

- **Bank unit 1:** u1-002, 008, 012, 016, 017, 018, 022, 023, 024, 025, 031, 034.
- **Bank unit 2:** u2-001, 005, 006, 010, 011, 013, 014, 015, 018, 020, 022, 024, 027, 028, 032, 037.
- **Bank unit 3:** u3-004, 005, 006, 016, 017, 019, 020, 025, 026, 027, 034.
- **Check blocks:** w1 s1, s2, s4, s5; w2 s1, s2, s3, s5; w3 s1, s2, s3, s6.

This covers the `diagram` items with answerType choice, because the grader returns why for them too. Every choice item in the lesson quizzes and form B already had why[].

The near-duplicate check (bank versus quiz and form) found the overlaps fixed in #2, #5, #12, #13 and #14. The other overlaps share a topic but ask a different question, so they were kept:
- u2-031 and w2 quiz #2 (hub to switch);
- u3-025/026 and the w3 example (APIPA);
- u3-018 and the w3 s4 check (4 layers).

## Answer-key changes

**No lesson quiz or form B answer key changed.** Old stored attempts are therefore unaffected. The check blocks also keep their original keys.

No existing key was found to be wrong. Four bank items were rewritten into different questions, so their stored key changed with them. Bank items are graded at answer time, and no stored index-aligned attempts exist for them:

| Item | Old key | New key | Reason |
|---|---|---|---|
| u1-002 | 0 | 1 | New question (it was a near-duplicate of form B w1 #1) |
| u1-037 | 2 (22 lines) | 1 (30 lines) | New numbers (4 to 9 devices) to separate it from form B w1 #10 |
| u3-016 | 0 | 3 | New question (it was identical to form B w3 #3) |
| u3-034 | 2 | 1 | New question (it was identical to form B w3 #4) |

u3-022 got new option texts, but its key indexes are unchanged ([0,2,3]).

## Accuracy notes for the new items (sources)

- Windows `systeminfo` shows the workgroup name in the "Domain:" field for workgroup machines. `net view` lists the machines that share resources under "Server Name" (Microsoft Learn: net view, systeminfo).
- In ping output, Windows' default TTL is 128. Each router hop decreases it by 1, so 126 means two routed hops. WAN latency is higher than LAN latency (w1 s3).
- In ipconfig /all, "Media disconnected" means there is no physical link. Each adapter has its own 48-bit Physical Address (IEEE 802, EUI-48).
- In `show mac address-table`, a frame to an unknown unicast MAC is flooded out every port in the VLAN except the ingress port (Cisco IOS switching docs; IEEE 802.1D learning bridge; w2 s1).
- A frame sent to an off-subnet IP carries the default gateway's MAC as the destination, while the IP header keeps the final destination (RFC 1122 s3.3.1; w3 packet-journey caption). Port 443 is HTTPS.
- fe80::/10 link-local addresses are created automatically and do not mean a failure, unlike 169.254/16 (RFC 4291, RFC 3927; w3 s5 table).
- Multi-mode fiber over 260 m at 1 Gb/s is within 1000BASE-SX range (about 550 m on OM2 and above, IEEE 802.3z). Copper is limited to 100 m per channel (TIA-568).

## Check output (final run)

```
node tests/bank-check.js
unit1: ok {"questions":42,"types":{"choice":15,"match":3,"tf":5,"order":2,"multi":4,"fill":3,"diagram":4,"scenario":4,"label":2},"levels":{"easy":15,"medium":21,"hard":6}}
unit2: ok {"questions":42,"types":{"choice":15,"tf":4,"match":3,"order":2,"multi":5,"diagram":4,"fill":3,"scenario":4,"label":2},"levels":{"easy":15,"medium":19,"hard":8}}
unit3: ok {"questions":43,"types":{"match":4,"tf":3,"order":3,"choice":11,"diagram":4,"multi":4,"fill":2,"command":1,"subnet":6,"scenario":3,"label":2},"levels":{"easy":14,"medium":21,"hard":8}}
(unit4-unit10: ok, not edited)

node tests/lessons-check.js   -> w1..w18 ok, visuals: 52 placements, ok (no warnings)
node tests/forms-check.js     -> w1..w18 ok (no warnings)
```
