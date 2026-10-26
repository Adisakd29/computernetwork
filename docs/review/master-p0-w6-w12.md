# Master P0 accuracy pass: w6 to w12

Scope: content/lessons/w6.js to w12.js, content/lessons/forms/w6.js to w12.js, and content/bank/unit5.js, unit6.js and unit7.js.

This pass covers the teacher's focus list and over-general statements. Earlier passes are in docs/review/w1-w6.md and w7-w12.md, and this pass does not redo their work. Every quiz, form and bank item is checked in the same way.

Guarantees for this pass:
- No item was added, removed or reordered.
- No `id` was changed.
- No answer key was changed. A script compared type, correct, answer, answers, blanks, accept, option count and id against a backup, and found 0 differences.

## Changes

| # | File | Location | What was wrong | What changed | Source |
|---|---|---|---|---|---|
| 1 | lessons/w6.js | s2, first `p` | a/b/g were not called historical. Wi-Fi 6E was missing from the naming list. There was no status for Wi-Fi 7 certification or for the IEEE standard. "PHY rate" was not linked to best-case conditions. | a/b/g are now framed as older standards taught as history. Added "Wi-Fi 6E (802.11ax บนย่าน 6 GHz)". Added that Wi-Fi Alliance began certifying Wi-Fi 7 in Jan 2024 and that IEEE published the full 802.11be standard in 2025. The maximum rate is now tied to using the most antennas and the widest channel, and the text says real throughput is much lower. | Wi-Fi Alliance, "Wi-Fi CERTIFIED 7" launch (8 Jan 2024). IEEE 802.11be-2024 (RevCom approval Sep 2024, published 22 Jul 2025, per en.wikipedia.org/wiki/IEEE_802.11be-2024). |
| 2 | lessons/w6.js | s2 table, 802.11ac row | "ระดับ Gbps (อุปกรณ์ทั่วไปราว 1.3–3.5 Gbps)" left out the standard's maximum. | "ราว 6.9 Gbps (Wave 2) แต่ Router ทั่วไปราว 0.9–3.5 Gbps" | 802.11ac maximum is 8 SS x 160 MHz x 256-QAM = 6.93 Gb/s. Common products run from AC1200 (867 Mb/s on 5 GHz) to about 3.47 Gb/s (4x4 at 160 MHz). |
| 3 | lessons/w6.js | s2 table, 802.11ax row, year | "2019 / 2020". Wi-Fi 6E certification started in Jan 2021. In 2020 the FCC only opened the band, and certification had not begun. | "2019 / 2021" | Wi-Fi Alliance Wi-Fi 6E certification launch, 7 Jan 2021 |
| 4 | lessons/w6.js | s2 table, 802.11be row, speed | "หลายสิบ Gbps ตามทฤษฎี" overstated the maximum. The final 802.11be allows 8 spatial streams, because 16 was dropped. | "ราว 23 Gbps ต่อย่าน" (the column header already says it is a theoretical maximum) | en.wikipedia.org/wiki/Wi-Fi_7: 8 SS, 320 MHz, 4096-QAM gives 23,059 Mb/s |
| 5 | lessons/w6.js | s2, technology `p` | MU-MIMO in 802.11ac was not limited to downlink or to Wave 2. 1024-QAM for ax was missing. Nothing was said about Wi-Fi 7 features. | Now says "MU-MIMO ขาลง ... (ใช้ได้จริงในอุปกรณ์รุ่น Wave 2)". Added 1024-QAM to ax. Added one sentence on 802.11be: 320 MHz (6 GHz only), 4096-QAM and MLO. | IEEE 802.11ac-2013 (DL MU-MIMO only). IEEE 802.11ax-2021. IEEE 802.11be-2024. |
| 6 | lessons/w6.js | s3 table, 6 GHz row, limitations | It did not say that 6 GHz requires WPA3, and gave no Thai regulatory status. | Added "และ WPA3". Added "(ไทย กสทช. เปิดเฉพาะช่วงล่าง 5925–6425 MHz ราวปี 2565)". This is worded as approximate on purpose (see Unsure). | NBTC slides for the US-Thailand 6 GHz meeting (ANSI share): NBTC decided in Jan 2022 that the lower band would be used for unlicensed RLAN. NBTC public consultation on the 5925–6425 MHz technical standard, Aug–Oct 2022. Wi-Fi Alliance requires WPA3 or OWE on 6 GHz. |
| 7 | lessons/w6.js | summary bullet 3 | Wi-Fi 7 was missing, and the bullet did not say the speeds were theoretical. | Added "และ be หรือ Wi-Fi 7 (2.4/5/6 GHz) ตัวเลขเหล่านี้เป็นความเร็วสูงสุดตามทฤษฎี" | As in row 1 |
| 8 | lessons/w7.js | s4 table, WPA2 row | KRACK was not mentioned. | Added "ส่วนช่องโหว่ KRACK (2017) แก้แล้วด้วยการอัปเดตอุปกรณ์" | Vanhoef and Piessens, KRACK (CCS 2017). Vendor patches followed in Oct 2017. |
| 9 | lessons/w7.js | s4 table, WPA3 row | "ปลอดภัยที่สุดในปัจจุบัน" was an over-claim with no caveat. | "แนะนำให้ใช้ในปัจจุบัน ... แต่ไม่ได้แปลว่าเจาะไม่ได้ เคยพบช่องโหว่ที่ต้องแก้ด้วยการอัปเดต และรหัสผ่านที่เดาง่ายก็ยังเสี่ยง". The SAE, PMF and 6 GHz facts were kept. | Dragonblood (Vanhoef and Ronen, 2019) affected early SAE implementations and was patched. SAE stops offline guessing, but weak passwords can still be guessed online. |
| 10 | lessons/w7.js | s4 list, Transition mode item | It implied that transition mode is simply safe. | Added that clients joined with WPA2 keep the WPA2 weaknesses, and that 6 GHz cannot use transition mode (WPA3 only). | Wi-Fi Alliance WPA3 Specification v3.x (transition mode). The 6 GHz rules forbid WPA2 and transition mode. |
| 11 | lessons/w8.js | quiz #7 why[0] | "DHCP ... จะมี Gateway ให้ด้วย" was stated absolutely. The router (option 3) is optional in DHCP. | "และโดยปกติจะให้ค่า Gateway มาด้วย" | RFC 2132 option 3 |
| 12 | lessons/w8.js | s2 `p` (Workgroup) | It implied that the Workgroup name controls visibility and sharing. Modern Windows reaches shares by name or IP no matter what the workgroup is. | It now keeps the advice to use the same name for tidiness, and says the name is not a permission control: `\\ชื่อเครื่อง` still works when names differ, given an account and rights on the target. | Microsoft Learn, workgroup and file sharing behaviour. Network discovery uses WS-Discovery/FDRP and does not depend on the workgroup name. |
| 13 | lessons/w8.js | s3 `p` (private IP) | Only 192.168.x.x and 10.x.x.x were listed. RFC 1918, the 172.16/12 range, and NAT/PAT were never explained. | Lists RFC 1918 10/8, 172.16/12 and 192.168/16. Adds that these cannot be used on the internet directly, so the router translates them to its public IP (NAT). Home and shop routers use PAT, which separates hosts by port number. | RFC 1918. RFC 3022 (NAPT). |
| 14 | lessons/w8.js | s4 first `p` (DHCP) | DORA, the UDP ports and the lease were missing. | One sentence added: DORA (Discover, Offer, Request, Acknowledge), UDP 67 for the server and 68 for the client, and a lease that the client renews periodically. | RFC 2131 |
| 15 | lessons/w9.js | s2 `p` (effective permission) | Deny precedence and how permissions combine within one layer were missing. | Added that Allow entries from several groups add up within a layer, and that an explicit Deny overrides Allow. | Microsoft Learn, "How permissions work" (explicit Deny before Allow). Share and NTFS effective access is the more restrictive of the two. |
| 16 | lessons/w9.js | s4 table, `net view \\LAB-PC07` row | It did not say that plain `net view` usually fails on Windows 10/11. | Added: plain `net view` (to list computers) usually returns error 6118 on Windows 10/11, because it relies on the SMB1 Computer Browser service, which newer Windows does not install by default. | Microsoft Learn: SMB1 is not installed by default from Windows 10 1709 and Server 1709, and Computer Browser depends on SMB1. Error 6118 reports are widespread. |
| 17 | lessons/w10.js | s5 port table, DNS and DHCP rows | "53" and "67 / 68" gave no transport. | "UDP และ TCP 53" and "UDP 67 (Server) / 68 (Client)" | RFC 1035 and RFC 7766 (DNS over TCP). RFC 2131. |
| 18 | lessons/w10.js | s5 first `p` | It did not distinguish resolver from authoritative and did not mention the hosts file. | One sentence added: an org DNS server often acts both as a resolver (asks onward for internet names) and as authoritative for internal names. The local hosts file sets names for that one machine only. | RFC 1034 (resolver and authoritative roles) |
| 19 | lessons/w10.js | s4 `p` (directory) | "ฝั่ง Linux นิยมใช้ LDAP" mixed up a protocol with a product. | Now says Linux uses directory services built on LDAP, such as OpenLDAP or FreeIPA, and that AD also supports LDAP. | RFC 4511. Microsoft AD DS documentation. |
| 20 | lessons/w10.js | s5 example | `intranet.hotel.local` was used as a unicast DNS name. `.local` is reserved for mDNS, and Microsoft advises against it. This item was left open in docs/review/w7-w12.md. | Changed to `intranet.hotel.internal`, with a short note on why not `.local` and that `.internal` is reserved for private use. | RFC 6762 (.local is reserved for mDNS). ICANN Board resolution, 29 Jul 2024, reserving .INTERNAL. |
| 21 | lessons/w11.js | s4 Hyper-V tip | It did not say that Hyper-V stays Type 1 when enabled on client Windows, or which editions have it. | Added "แม้จะเปิดบน Windows 10/11 รุ่น Pro, Enterprise หรือ Education (รุ่น Home ไม่มี Hyper-V)" | Microsoft Learn, "Install Hyper-V" (system requirements) |
| 22 | lessons/w11.js | s5 licensing warning | "ตั้งแต่ปลายปี 2024 ... ฟรีทั้งส่วนตัวและในองค์กร" merged two separate dates. | Personal use free since May 2024. Free for all use, including commercial, since November 2024. | VMware blog (13 May 2024, 11 Nov 2024). en.wikipedia.org/wiki/VMware_Workstation. |
| 23 | lessons/w11.js | s2 Windows Server `p` | Editions were not mentioned. | Added "(แต่ละรุ่นมี Edition หลัก คือ Standard และ Datacenter)" | Microsoft Learn, Windows Server 2022 and 2025 editions comparison |
| 24 | lessons/w12.js | quiz #10 explain | `ip` was not contrasted with the deprecated `ifconfig`. | Added that `ifconfig` belongs to net-tools, which is no longer developed, and that current Ubuntu Server does not install it by default. | Ubuntu Server docs (iproute2). net-tools is not in the default server seed since 18.04. |
| 25 | lessons/w12.js | s4 Bridged `p` | It implied Bridged always works. Many enterprise and Wi-Fi networks block extra MACs. | Added "(แต่บางเครือข่าย เช่น Wi-Fi องค์กรที่จำกัดอุปกรณ์ อาจไม่ยอมให้ Guest ต่อแบบ Bridged)" | VirtualBox manual 6.5 (bridging over wireless rewrites MACs, and some APs and NAC reject it) |
| 26 | lessons/w12.js | s2 example | It used Windows 10 as a new test client. Windows 10 support ended on 14 Oct 2025. | "Windows 11" (4 GB and 2 CPU still meet Win11 minimums) | Microsoft lifecycle, Windows 10 end of support |
| 27 | forms/w10.js | item #8 option A | `intranet.hotel.local` | `intranet.hotel.internal` (kept consistent with row 20) | As in row 20 |
| 28 | forms/w10.js | item #10 explain | "DNS ใช้พอร์ต 53" gave no transport. | Now says port 53 over both UDP (normal queries) and TCP (large responses, zone transfer). The accepted answers are unchanged. | RFC 1035, RFC 7766 |
| 29 | bank/unit5.js | u5-007 explain | It said MU-MIMO in 802.11ac without saying it is downlink only or Wave 2. | "MU-MIMO ขาลง ... (ใช้ได้จริงในอุปกรณ์ Wave 2)" | IEEE 802.11ac-2013 |
| 30 | bank/unit6.js | u6-018 explain | The same workgroup over-statement as row 12. | Same nuance as row 12 | As in row 12 |
| 31 | bank/unit7.js | u7-004 explain | It gave no transports for DNS or DHCP. | "DNS ใช้ 53 (UDP และ TCP), DHCP ใช้ UDP 67/68" | RFC 1035, 7766, 2131 |
| 32 | bank/unit7.js | u7-005 explain | "ฝั่ง Linux นิยมใช้ LDAP" (protocol confused with product) | "...บริการไดเรกทอรีที่ทำงานด้วยโปรโตคอล LDAP เช่น OpenLDAP" | As in row 19 |

Answer-key changes: none.

## Checked against the focus list and found correct (no change)

- **Wi-Fi bands and rates:**
  - b at 2.4 GHz and 11 Mb/s, and a at 5 GHz and 54 Mb/s.
  - g at 2.4 GHz and 54 Mb/s.
  - n (Wi-Fi 4) at 2.4 and 5 GHz, up to 600 Mb/s with 4 streams.
  - ac at 5 GHz only.
  - ax (Wi-Fi 6) at 2.4 and 5 GHz, about 9.6 Gb/s, with OFDMA and TWT.
  - 6E means 6 GHz.
  - be at 2.4, 5 and 6 GHz, with 320 MHz channels.
  - These values appear in lesson w6, form w6 and bank u5-002/003/004/007/013. The quiz and form keys involved were w6 #2/#5/#7/#9/#10 and form w6 #2/#5/#7/#9/#10.
- **Security:**
  - The WPA2 4-way handshake allows offline dictionary attacks, while SAE does not, and SAE gives forward secrecy.
  - WPA3 is required on 6 GHz.
  - Enterprise uses 802.1X with RADIUS.
  - WEP and TKIP are obsolete, and TKIP drops the link to 54 Mb/s.
  - The WPS PIN space is about 11,000 tries.
  - These facts appear in w7, form w7 and u5-019 to 039.
- **IP and Windows tools:**
  - APIPA is 169.254/16.
  - Default gateway behaviour is described correctly.
  - ipconfig /all, /release, /renew and /flushdns are correct.
  - The 15-character NetBIOS limit is correct.
  - Domain join needs Pro, Enterprise or Education.
  - Public, Private and Domain profiles are described correctly.
  - The share levels Read, Change and Full Control are correct, and the effective-access table is right.
  - SMB uses TCP 445.
  - `net share` (create and delete need elevation), `net use /persistent` and `net use /delete` are correct.
- **Virtualization:**
  - Type 1 examples (ESXi, Hyper-V, Xen, Proxmox VE/KVM) and Type 2 examples (VirtualBox, Workstation, Fusion, Parallels) are correct.
  - The VirtualBox NAT defaults 10.0.2.15 and .2 are correct.
  - NAT VMs are isolated from each other, and NAT Network is a separate mode.
  - Host-only uses 192.168.56.0/24 with the host at .1.
  - Internal Network has no DHCP.
  - Snapshots are not backups and depend on the base disk.
  - VT-x and AMD-V (SVM) are correct.
  - These facts appear in w11, w12, forms w11 and w12, and u7-017 to 041.
- **NOS:**
  - Windows Server 2019, 2022 and 2025 are correct.
  - AD appeared with Windows 2000 Server.
  - Server distributions (Ubuntu Server, Debian, RHEL, Rocky) are correct.
  - The NetWare, UNIX, Solaris and Linux history is correct.
  - File, print, DHCP, DNS, web and directory services are described correctly.
- **Linux:** Only `ip addr` and `ping -c` are used. The files contain no ifconfig, netstat or ss commands, so nothing else needed changing.

## Unsure, not changed

- The date of Thailand's 6 GHz rule. Sources confirm an NBTC decision in Jan 2022 to open 5925–6425 MHz for unlicensed RLAN, and a technical-standard consultation from Aug to Oct 2022. I could not fetch the final Royal Gazette announcement date, so the text says "ราวปี 2565" and gives no exact date. If the teacher has the gazette reference, the wording can be made exact.
- w9 s4 tip "Run as administrator ... เพื่อให้เห็นรายการแชร์ครบถ้วน". This is still not verified, as noted in w7-w12.md. It is harmless and was left as is.
- w11 quiz #8 explain "จึงไม่มีทางเร็วกว่า Host" is strong wording. It holds for the same hardware, so it was left as is.
- form w9 #10 accepts "CIFS" as an answer. Strictly, CIFS is the SMB1 dialect, but it is a common synonym, so it was left as is.

## Checks

- `node tests/lessons-check.js` reports ok for w1 to w18 and "visuals: 25 placements, ok" (exit 0).
- `node tests/forms-check.js` reports ok for w1 to w18 (exit 0).
- `node tests/bank-check.js` reports ok for unit1 to unit10, with unit5 at 39, unit6 at 38 and unit7 at 41 questions (exit 0).
