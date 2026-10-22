# Master P4 question review: units 4 to 7 (w4 to w12)

Scope: content/bank/unit4.js to unit7.js; the `quiz` arrays and `check` blocks in content/lessons/w4.js to w12.js; content/lessons/forms/w4.js to w12.js.

Rules followed:
- No `id` was changed and no bank item was deleted.
- No lesson quiz or form item was added, removed or reordered.
- New bank items were appended at the end of each unit file, so their ids continue the numbering.
- Earlier logs (master-p0-w1-w5.md, master-p0-w6-w12.md, w1-w6.md, w7-w12.md) were read first, and the current lesson text was taken as the reference.

## Unit 4 (w4, w5)

### Bank fixes (content/bank/unit4.js)

| id | Problem | Fix |
|---|---|---|
| u4-002, 003, 011, 016, 022, 030, 032, 033, 036 | `why` was missing. | Added `why[]`. |
| u4-006 | Near-duplicate of form w4 #10, which also asks for the 10BASE5 500 m segment. | Now asks for 10BASE-T (100 m) and 100BASE-FX full duplex (2 km). Both values come from lesson w4 s3 and s4. |
| u4-012 | Level was too high. Telling BX10 from LX10 is understanding, not multi-step analysis. One distractor (UTP Cat6a) was off-topic. | Level changed from hard to medium. The UTP distractor was replaced with "two fibres, 40 km". Added `why`. |
| u4-013 | The correct option "สาย Cat6a" was the only option without the "UTP" prefix, which was a wording cue. | Changed to "UTP Cat6a". |
| u4-017 | Hub collision domain was already tested by u4-004 and by the w4 s2 check. The distractor "all three are equal" was weak. | Rewritten. On the same `network-devices` figure, it now asks how a switch forwards the first frame to an unknown MAC (flooding, taught in w2). The key index stays at 1. Added `why`. |
| u4-019 | Near-duplicate of quiz w4 #9 and form w4 #9 (definition of Broadband/Baseband). It was easy recall. | Rewritten as a medium item: why a shared Baseband medium needs a media-access rule. The key index stays at 0. Added `why`. |
| u4-021 | In step 2, three of the four options were copper, so the answer was obvious. | Distractors are now 1000BASE-CX, 1000BASE-SX and 100BASE-FX. The explain says why SX and FX do not fit. |
| u4-023 | Exact duplicate of form w5 #10 (T568B pin 6 = green). | Now asks which pin carries white-blue in T568B (pin 5). The key index stays at 1. Added `why`. |
| u4-024 | Duplicate of form w5 #1 (T568A pins 1 and 2). | Now asks T568A pin 3 (white-orange) and pin 7 (white-brown). |
| u4-028 | Same fact as form w5 #4 (one side with Auto MDI/MDIX is enough). | Restated as a different false claim: that an Auto MDI/MDIX port accepts only straight-through cables. The answer is still `false`. |
| u4-029 | Duplicate of form w5 #2 (Router to PC needs a crossover cable). | Now asks which pair of devices uses a straight-through cable (Router and Switch). The key index stays at 0. Added `why`. |
| u4-031 | Duplicate of form w5 #3 (3-6/6-3 miswire). | Now gives a 1-8 … 8-1 readout, which means the connector was held upside down at one end. The Gigabit crossover pattern is a distractor. The key index stays at 3. Added `why`. |
| u4-038 | Step 1 duplicated form w5 #5 (the connector pulls off because the jacket was stripped too long). | The context is now an open pin 7 (white-brown wire too short), following the lesson w5 s4 example. The steps are now: meaning, fix, then what to check before crimping. |
| u4-039 | Close to form w5 #6 (a channel that is too long in total). | Now tests the second rule: a 94 m permanent link with a 98 m total fails, because the permanent link must be 90 m or less. The key index stays at 1. Added `why`. |

### Lesson and form fixes

| File | Item | Problem | Fix |
|---|---|---|---|
| lessons/w4.js | quiz #6 why[2] | "สาย UTP ทุกมาตรฐาน BASE-T จำกัดที่ 100 เมตร" is over-general. 25G/40GBASE-T reach only 30 m, and lesson w5 s5 says so. | Now reads "1000BASE-T บนสาย UTP ยาวได้ไม่เกิน 100 เมตร ส่วน 185 เมตรเป็นระยะของ 10BASE2". |

Every choice item in the w4 and w5 quizzes, forms and checks already had `why`. No other change was needed.

### New items

| id | Type | Level | Content |
|---|---|---|---|
| u4-040 | label `straight-cross` | easy | Label the cable names, the pinout standard at each end, and an example use. The footer hint is blanked. |
| u4-041 | label `ethernet-standards` | medium | Fill the missing medium and pair-usage cells: Cat3, Cat5, 4 pairs, Cat6a 100 m, and 850 nm. The Cat6/Cat6a range cell is blanked. |
| u4-042 | multi + `pre` | medium | Read LAN-tester results for 5 cables and pick the straight-through cables that pass. |
| u4-043 | choice + `pre` | medium | Read `Get-NetAdapter` output (100 Mbps, FullDuplex False, connected to a hub). Conclude half duplex, CSMA/CD and collisions. |
| u4-044 | scenario (4 steps) | hard | Wire a lab: cable type, the 90/100 m check, linking a switch to an old non-MDIX switch, and confirming 1 Gbps after the tester. |

## Unit 5 (w6, w7)

### Bank fixes (content/bank/unit5.js)

| id | Problem | Fix |
|---|---|---|
| u5-001, 008, 011, 014, 016, 025, 033, 035, 036, 038 | `why` was missing. | Added `why[]`. |
| u5-002 | Duplicate of form w6 #2 (802.11a = 5 GHz / 54 Mbps). | Now asks the same thing about 802.11g (2.4 GHz / 54 Mbps). The options were reordered so the key stays at index 1. `why` was updated. |
| u5-009 | Duplicate of form w6 #4 (three-storey house needs Mesh). | Now asks how Mesh differs from a single-band Repeater. Level changed from easy to medium. The key stays at 1. Added `why`. |
| u5-012 | Same idea as quiz w6 #3 and form w6 #3 (2.4 GHz reaches farthest). | Now asks which band to use for a Wi-Fi 5 laptop close to a tri-band AP: 5 GHz, because 6 GHz needs 6E or 7. Level changed from easy to medium. The key stays at 3. Added `why`. |
| u5-022 | Same item as form w7 #3 (choose WPA2 AES). | Now asks which security mode is required for an SSID on 6 GHz: WPA3-Personal, because WPA2 and transition mode are not allowed there. The key stays at 2. Added `why`. Source: lesson w7 s4 table and the WPA3 rule recorded in master-p0-w6-w12 row 10. |
| u5-024 | Same idea as form w7 #4 (hidden SSID means no encryption is needed). | Now asks about the mechanism: the name is still sent in Probe Request and Association Request frames. The answer is still `false`. |
| u5-026 | Duplicate of form w7 #7 (what happens once the WPS PIN is cracked). | Now asks the best WPS setting if WPS must stay on: turn off PIN and use push button only. This follows lesson w7 s5. The key stays at 2. Added `why`. |
| u5-029 | Same idea as quiz w7 #1 (Ad-Hoc has no AP). | Now asks for a comparison of all three modes in the `wifi-modes` figure. The key stays at 3. Added `why`. |
| u5-030 | Same idea as form w7 #2 (SSIDs differ, so roaming fails). | The topology now uses one SSID on both APs. The question is now about overlapping APs on the same 2.4 GHz channel, fixed by using 1/6/11. Level changed from hard to medium. The key stays at 1. Added `why`. |
| u5-039 | Duplicate of form w7 #1 and the w7 s1 check (Infrastructure has an AP at the centre). | Now asks why an Infrastructure AP is usually wired to the LAN. Level changed from easy to medium. The key stays at 0. Added `why`. |

Not changed, noted: u5-032, the random-MAC scenario, covers the same idea as form w7 #6 (tf). It was kept because it is a two-step troubleshooting item and does more than recall.

### Lesson and form fixes

| File | Item | Problem | Fix |
|---|---|---|---|
| lessons/w7.js | check s1 | `why` was missing. "Peer-to-Peer" was a second name for the Ad-Hoc option, so two distractors were the same answer. | "Peer-to-Peer" was replaced with "Wireless Bridge". Added `why`. |
| lessons/w7.js | checks s4, s5, s6 | `why` was missing. | Added `why`. |

### New items

| id | Type | Level | Content |
|---|---|---|---|
| u5-040 | label `wlan-devices` | medium | Match the role description to the device panel: AP, Repeater, Mesh, SIM Router, Wireless Bridge, USB adapter. |
| u5-041 | label `wifi-security-timeline` | medium | WEP RC4+IV24, WPA TKIP, WPA2 AES-CCMP, WPA3 SAE, and the WPS PIN count of about 11,000. The "10,000 + 1,000" hint is blanked. |
| u5-042 | multi + `pre` | medium | Read `netsh wlan show interfaces`: band and channel, CCMP, WPA2 rather than WPA3, the link rate, and that hidden SSID cannot be read from it. |
| u5-043 | choice + `pre` | hard | From a Wi-Fi Analyzer scan, pick the 2.4 GHz channel for a new AP (11; 3 and 9 overlap two groups). |
| u5-044 | scenario (4 steps) | hard | Three APs in a long building: same SSID for roaming, channels 1/6/11, Enterprise + RADIUS for teachers, Guest network with isolation for visitors. |

## Unit 6 (w8, w9)

### Bank fixes (content/bank/unit6.js)

| id | Problem | Fix |
|---|---|---|
| u6-018, 020, 027, 028, 033, 034 | `why` was missing. | Added `why[]`. |
| u6-004 | Same as form w8 #1 (Settings → System → About). | Now asks where to set a static IP in the Windows 11 Settings app (Ethernet → IP assignment → Edit, as in lesson w8 s4). The key stays at 2. Added `why`. |
| u6-005 | Duplicate of form w8 #9 (`sysdm.cpl`). | Now asks for `ncpa.cpl` (Network Connections). The options were reordered so the key stays at 1. `why` was updated. |
| u6-006 | Same as quiz w8 #1 (`hostname`). | The command item now asks for `ipconfig /flushdns` (lesson w8 s5 table). The regex is `^ipconfig(\.exe)? ?[/-]flushdns$`. |
| u6-015 | Duplicate of form w8 #7 (`(Duplicate)` in ipconfig). | Now an `ipconfig /all` reading item with `pre`: DHCP Enabled Yes, Lease, and the DHCP Server/Gateway/DNS all at the router. The key stays at 3. Added `why`. |
| u6-024 | Duplicate of form w9 #1 (UNC path by IP). | Now asks for the UNC path of the hidden share `\\LAB-PC07\answer$` (lesson w9 s4). |
| u6-025 | The "more restrictive wins" rule was already tested by quiz w9 #4, u6-021 and u6-036. | On the same `unc-share` figure, it now asks for the protocol, port and firewall profile: SMB, TCP 445, Private. Level changed from easy to medium. The key stays at 2. Added `why`. |
| u6-037 | Duplicate of form w9 #7 (network printer with a static IP). | Now asks for the UNC path that connects to a shared printer, `\\ACC-PC\HP-OFFICE` (lesson w9 s5 example). The key stays at 0. Added `why`. |
| u6-038 | Same as quiz w9 #3 (profile and Network discovery). The distractors (MAC filtering, Client isolation) were router features and too easy to rule out. | Now: discovery is on but the share will not open, so File and printer sharing is needed. The distractors were replaced with Windows settings. Level changed from easy to medium. The key stays at 0. Added `why`. |

### Lesson and form fixes

| File | Item | Fix |
|---|---|---|
| lessons/w8.js | checks s1, s3, s5 | Added `why`. |
| lessons/w9.js | checks s1, s2, s3, s6 | Added `why`. The s1 why explains that Windows 10/11 has no "Guest" profile, only Public, Private and Domain. |

### New items

| id | Type | Level | Content |
|---|---|---|---|
| u6-039 | label `windows-ip-settings` | easy | Fill the TCP/IPv4 dialog (IP, mask, gateway, DNS) by reading the LAN diagram (PC .30, Router .1, DNS .10). |
| u6-040 | label `ipconfig-output` | medium | Match the meanings to the ipconfig /all lines: MAC, DHCP Enabled, Gateway, DHCP Server, DNS, and the APIPA problem line. |
| u6-041 | multi + `pre` | medium | Read `net share`: a hidden share is not listed, Resource is the real path, a USB printer is shared, and C$ is an admin share. |
| u6-042 | choice + `pre` | medium | Read `net use`: Z: is OK, and Y: is "Unavailable" (remembered, but the server cannot be reached). Lines were shortened to 70 characters. |
| u6-043 | scenario (4 steps) | hard | Share D:\Exam: Private profile with discovery and sharing on, Share and NTFS settings that give Students Read and Teachers Modify, `net use X: … /persistent:yes`, then read "Access is denied" as the intended result. |

## Unit 7 (w10, w11, w12)

### Bank fixes (content/bank/unit7.js)

| id | Problem | Fix |
|---|---|---|
| u7-010, 021, 024, 025, 026, 030, 031, 040, 041 | `why` was missing. | Added `why[]`. |
| u7-002 | Duplicate of form w10 #9 (tf: the same hardware can be a server if a NOS is installed). | The statement is now about why real servers use more durable hardware (redundant PSU, ECC RAM). The answer is still `true`. |
| u7-009 | Duplicate of form w10 #4 (parents viewing grades = Extranet). | Now asks for the order Authentication → Authorization → Auditing when a staff member opens a folder. The key stays at 3. Added `why`. |
| u7-013 | Duplicate of form w11 #1 (Linus Torvalds, 1991). | Now asks how Ubuntu Server, Debian, RHEL and Rocky relate to Linux: they are distributions of the Linux kernel. The key stays at 3. Added `why`. |
| u7-034 | Nearly the same item as form w12 #7 (which modes reach the internet by default). | Now asks which modes let two VMs on the same host reach each other: Bridged, Host-only, Internal (with manual IPs) and NAT Network, but not plain NAT, because each VM gets its own NAT engine. The stem says Internal Network needs manual IPs. |
| u7-038 | Same as form w12 #10 (`ping -c 4 8.8.8.8`). | The command item now asks to ping the NAT gateway 3 times: `ping -c 3 10.0.2.2`. Both argument orders are accepted. |

### Lesson and form fixes

| File | Item | Fix |
|---|---|---|
| lessons/w10.js | checks s2, s3, s4, s6 | Added `why`. |
| lessons/w11.js | checks s1, s2, s4, s6 | Added `why`. |
| lessons/w12.js | checks s2, s4, s5, s6 | Added `why`. |

### New items

| id | Type | Level | Content |
|---|---|---|---|
| u7-042 | label `hypervisor-types` | easy | Example products (ESXi, Hyper-V, VirtualBox, Workstation) and the intended use (data centre, or learning and testing) for Type 1 and Type 2. |
| u7-043 | label `vm-netmodes` | medium | The missing reachability results: NAT Host→VM and LAN→VM need port forwarding, NAT VM↔VM does not work, Bridged LAN↔VM works, Internal Host↔VM does not work. |
| u7-044 | multi + `pre` | medium | `ip a` in a VM with NAT and Host-only NICs (10.0.2.15 and 192.168.56.101). Pick the address to SSH to, and recognise that lo is not reachable from other machines. VirtualBox MAC prefix 08:00:27 and names enp0s3/enp0s8 are used. Lines are trimmed and marked "(แสดงบางส่วน)". |
| u7-045 | choice + `pre` | medium | An Internal Network VM: `ping: connect: Network is unreachable` to 8.8.8.8, but 0% loss to a peer. Conclusion: Internal Network has no way out. |
| u7-046 | scenario (4 steps) | hard | Web server VM: Bridged mode, the URL with the LAN IP, moving to Internal Network before a DHCP lab, and taking a snapshot before risky changes. |

## Answer-key changes

No existing key in a lesson `quiz`, a form, or a `check` was changed. A script compared type, correct, answer, answers, blanks, accept, option count and steps against a backup and found 0 differences.

No bank key was changed because it was wrong. These bank items had their question replaced to remove duplicates, so their keys changed along with the new content:
- u4-006 (fill): the blanks are now 100 / 2.
- u4-024 (fill): the blanks are now ขาวส้ม / ขาวน้ำตาล.
- u4-038 (scenario): the step keys are now [0, 1, 0]; they were [2, 1, 0].
- u6-006 (command): the command is now `ipconfig /flushdns`.
- u6-024 (fill): the answer is now `\\LAB-PC07\answer$`.
- u7-034 (multi): the key is now [1, 2, 3, 4]; it was [0, 1, 4].
- u7-038 (command): the command is now `ping -c 3 10.0.2.2`.

Every other rewritten choice item kept its key index. Where needed, the options were reordered to do this. Stored exam attempts on these ids were graded against the old content.

## Level changes (bank only)

- Lowered: u4-012 (hard to medium) and u5-030 (hard to medium). Both only need understanding.
- Raised: u4-019, u5-009, u5-012, u5-039, u6-025 and u6-038 (easy to medium). After the rewrite, each needs application rather than recall.
- Not changed: lesson quiz and form levels. They must stay identical, item by item, between quiz and form. A few multi items marked "hard" are closer to medium, for example w4 #8, w10 #8 and w12 #9 (tf). They were noted and left alone.

## Accuracy notes and sources

- 802.3 values follow the lesson tables: LX 5 km, LX10/BX10 10 km, BX 1310/1490 nm, 10GBASE-T at 55 m on Cat6 and 100 m on Cat6a, and channel 100 m = permanent link 90 m + patch 10 m (TIA-568).
- Auto MDI-X only needs to be supported at one end (IEEE 802.3 clause 40.4.4).
- 6 GHz requires WPA3 or OWE, with no WPA2 or transition mode (Wi-Fi Alliance WPA3 specification). This matches master-p0-w6-w12 row 10.
- The `netsh wlan show interfaces` fields (Band, Radio type, Cipher CCMP) and the 144.4 Mb/s rate (802.11n, 2 streams, 20 MHz, short GI) are consistent with each other.
- VirtualBox: NAT gives 10.0.2.15 with gateway .2, and each VM gets its own NAT engine (VirtualBox manual, chapter 6). The Host-only DHCP default range starts at 192.168.56.101. Internal Network has no DHCP by default.
- `Get-NetAdapter` exposes `LinkSpeed` and `FullDuplex`. A hub link is always half duplex.

## Counts

- Items reviewed: 381. That is 157 bank items (unit4 39, unit5 39, unit6 38, unit7 41), 90 lesson quiz items, 90 form items and 44 checks.
- Items fixed, not counting `why`-only additions: 37. Of these, 35 are bank items (unit4 13, unit5 9, unit6 8, unit7 5). The other 2 are lesson items: w4 quiz #6 why text, and the w7 check s1 option.
- `why` arrays added: 78. Of these, 55 are on bank choice and diagram-choice items (unit4 16, unit5 17, unit6 12, unit7 10) and 23 are on choice checks (w7 4, w8 3, w9 4, w10 4, w11 4, w12 4). Every lesson quiz and form choice item already had `why`. Every bank choice item now has `why` too, including the new ones.
- New bank items: 20. Each unit got 2 `label`, 2 `pre` (choice or multi) and 1 `scenario`:
  - unit4: u4-040 to u4-044
  - unit5: u5-040 to u5-044
  - unit6: u6-039 to u6-043
  - unit7: u7-042 to u7-046

## Checks

- `node tests/bank-check.js`: unit1 to unit10 all "ok", exit 0, no warnings. Unit stats are unit4 44 questions (15 easy / 21 medium / 8 hard), unit5 44 (13/23/8), unit6 43 (13/21/9) and unit7 46 (17/20/9).
- `node tests/lessons-check.js`: w1 to w18 ok, "visuals: 52 placements, ok", exit 0.
- `node tests/forms-check.js`: w1 to w18 ok, exit 0.
