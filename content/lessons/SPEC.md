# NetLab lesson content specification

You are writing lesson content for **NetLab**, a learning platform for the Thai vocational course
**"ระบบเครือข่ายคอมพิวเตอร์" (ปวช. 2567, 21910-2013 / 20105-2014)**, 18 weeks, 10 units.
Readers are ปวช./ปวส. students (age 16–19). Teachers will use this in real classes, so
**technical accuracy is the top priority**, then clarity.

Each week = one lesson file: `content/lessons/wN.js` (N = 1..18), a CommonJS module.
The file is server-side only; question answers in it are never sent to the browser before grading.

## File format (exact)

```js
'use strict';
module.exports = {
  id: 'w1', week: 1, unit: 1,
  title: 'ความรู้เกี่ยวกับระบบเครือข่ายคอมพิวเตอร์',   // use the week title given below
  minutes: 45,                                       // estimated reading time for the content part
  objectives: ['บอกประโยชน์ของเครือข่ายคอมพิวเตอร์ได้ถูกต้อง', ...],  // จุดประสงค์เชิงพฤติกรรม, 4–7 items, start with a verb
  competency: 'แสดงความรู้ทั่วไปเกี่ยวกับระบบเครือข่ายคอมพิวเตอร์',     // สมรรถนะที่คาดหวัง, 1 sentence
  keywords: ['LAN', 'WAN', 'Topology'],              // 4–10 search keywords (Thai or English)
  quiz: [ /* 10 questions: the pre-test (form A); the post-test uses the parallel form B in content/lessons/forms/wN.js */ ],
  sections: [
    {
      id: 's1',
      title: '1. ประโยชน์ของเครือข่ายคอมพิวเตอร์',
      blocks: [
        { type: 'p', text: '...' },
        { type: 'list', items: ['...', '...'] },                       // bullet list
        { type: 'steps', items: ['...', '...'] },                      // numbered procedure
        { type: 'table', head: ['มาตรฐาน', 'ความถี่'], rows: [['802.11b', '2.4 GHz']] },
        { type: 'term', term: 'Protocol', text: 'ข้อตกลงในการสื่อสาร ...' },   // key term definition
        { type: 'diagram', name: 'topologies', caption: '...' },      // ONLY names from the catalog below
        { type: 'widget', name: 'topology-sim', caption: '...' },     // ONLY names from the catalog below
        { type: 'example', title: 'ตัวอย่างจากห้องแล็บของวิทยาลัย', text: '...' },  // real-world example
        { type: 'note', kind: 'tip' | 'warn', text: '...' },           // tip = เกร็ดความรู้, warn = ข้อควรระวัง
        { type: 'check', q: { /* one question, same format as quiz items */ } }  // แบบฝึกหัดระหว่างเรียน
      ]
    }
  ],
  summary: ['...', '...']   // สรุปบทเรียน, 5–8 bullet sentences
};
```

### Question formats (quiz items and `check` blocks)

Every question MUST have `level` ('easy' | 'medium' | 'hard') and `explain` (why the correct answer is right, 1–3 sentences).

```js
{ type: 'choice', level: 'easy', q: 'คำถาม', options: ['ก', 'ข', 'ค', 'ง'], correct: 2,
  explain: 'เหตุผลที่ข้อ ค ถูก',
  why: ['ทำไมข้อ ก ผิด', 'ทำไมข้อ ข ผิด', '', 'ทำไมข้อ ง ผิด'] }   // optional per-option feedback; '' for the correct one
{ type: 'multi', level: 'medium', q: 'ข้อใดเป็น ... (เลือกได้หลายข้อ)', options: ['...','...','...','...'], correct: [0, 2], explain: '...' }
{ type: 'tf', level: 'easy', q: 'ข้อความ ... ถูกหรือผิด', answer: true, explain: '...' }
{ type: 'text', level: 'medium', q: 'คำถามเติมคำ/คำนวณ เช่น /26 มีโฮสต์ใช้งานได้กี่เครื่อง', answers: ['62'], explain: '...' }  // answers: all accepted spellings; compared case-insensitive, spaces, ':', '-', '_' ignored
```

Quiz rules (10 items per lesson):
- Mix: about 6 `choice`, 2 `multi`, 1 `tf`, 1 `text` (text may be 0–2 when the topic has calculations).
- Difficulty mix: about 4 easy, 4 medium, 2 hard.
- **Spread the correct option position** (do not always put it first; vary 0–3 across the quiz).
- **Distractors must be plausible and similar in length to the correct answer.** The correct option must not be noticeably the longest.
- Test understanding and application, not only recall. Scenario questions are encouraged ("ในห้องแล็บมี 30 เครื่อง ควร...").
- Questions must be answerable from the lesson content.

`check` blocks: 3–5 per lesson, placed right after the content they test. Easier than the quiz, practice only.

## Writing rules

- Thai language, clear and friendly for ปวช. Use English technical terms in parentheses the first time, e.g. "เราเตอร์ (Router)".
- Content depth: **4–6 sections**, each 2–6 blocks of real explanation. Total theory roughly 1,500–2,500 Thai words per lesson. Explain *why* and *how*, not just lists.
- Each lesson needs: at least 1 `diagram`, at least 1 `widget` when a catalog widget fits the topic, at least 2 `example` blocks set in Thai contexts (ห้องแล็บวิทยาลัย, ร้านกาแฟ, บ้าน, ร้านค้า SME, สำนักงาน), at least 1 `note`.
- Cover every topic listed for your week (from the official lesson plan below). You may add closely related essentials.
- Keep each `p` block to 1 paragraph (≤ 90 words). Do not use Markdown, HTML, or emoji inside text.
- Do not invent brand-new standards, numbers or product claims. If a number differs between sources (e.g. 10BASE2 = 185 m, often rounded to 200 m), state the standard value and mention the common rounding.
- Prefer current practice: WPA2/WPA3 (WEP is insecure), Windows 10/11 UI paths, Cat5e/Cat6, Wi-Fi 6/6E/7 mention as context.
- Do not copy text from any book; write original explanations.

## Technical accuracy checklist (verify your facts)

- OSI: 7 Application, 6 Presentation, 5 Session, 4 Transport, 3 Network, 2 Data Link, 1 Physical. PDUs: Data, Segment(TCP)/Datagram(UDP), Packet, Frame, Bit.
- TCP/IP model: 4 layers (Application, Transport, Internet, Network Access/Link). Some books use 5 — mention if relevant.
- IPv4 classes: A 1–126 (127 loopback), B 128–191, C 192–223, D 224–239 multicast, E 240–255. Private: 10/8, 172.16/12, 192.168/16. APIPA 169.254/16.
- Hosts per subnet = 2^(32−prefix) − 2 (except /31, /32 special cases; skip for ปวช. or note briefly).
- Ethernet: 10BASE5 500 m thick coax, 10BASE2 185 m thin coax, 10BASE-T/100BASE-TX/1000BASE-T 100 m UTP; 100BASE-TX Cat5, 1000BASE-T Cat5e+, 10GBASE-T Cat6a 100 m (Cat6 ≈55 m). 1000BASE-SX MMF up to ~220–550 m depending on fiber, 1000BASE-LX SMF 5 km (10 km for LX10).
- T568A: ขาวเขียว เขียว ขาวส้ม น้ำเงิน ขาวน้ำเงิน ส้ม ขาวน้ำตาล น้ำตาล. T568B: ขาวส้ม ส้ม ขาวเขียว น้ำเงิน ขาวน้ำเงิน เขียว ขาวน้ำตาล น้ำตาล.
- Wi-Fi: 802.11b 2.4 GHz 11 Mbps; a 5 GHz 54; g 2.4 GHz 54; n (Wi-Fi 4) 2.4/5 GHz up to 600 Mbps; ac (Wi-Fi 5) 5 GHz Gbps-class; ax (Wi-Fi 6) 2.4/5 GHz, 6E adds 6 GHz; be (Wi-Fi 7) 2.4/5/6 GHz. Wi-Fi uses CSMA/CA; classic Ethernet CSMA/CD.
- Ports: HTTP 80, HTTPS 443, DNS 53, FTP 20/21, SSH 22, Telnet 23, SMTP 25, DHCP 67/68, RDP 3389, SMB 445.
- Windows: `ipconfig`, `ipconfig /all`, `ping`, `tracert`, `netstat -an`, `nslookup`, `hostname`, `net user`, `net localgroup`, `net share`. Linux: `ip addr`, `ip route`, `ping -c 4`, `traceroute`, `chmod`, `chown`, `useradd`/`adduser`.
- Linux permissions: r=4 w=2 x=1, e.g. 750 = rwxr-x---.
- Windows share vs NTFS permissions: effective access over the network = the more restrictive of share and NTFS permissions.

## Catalog: diagrams (`{type:'diagram', name}`)

| name | shows |
|---|---|
| net-components | sender, receiver, message, transmission medium, protocol |
| lan-man-wan | coverage scale: PAN < LAN < MAN < WAN |
| p2p-vs-cs | peer-to-peer vs client–server |
| topologies | bus, ring, star, mesh side by side |
| network-devices | hub (floods) vs switch (forwards by MAC) vs router (between networks by IP) |
| cable-types | cross-sections: coaxial, UTP, STP, fiber (single/multi-mode) |
| connectors | RJ-45, BNC, fiber SC / LC / ST / FC shapes |
| osi-tcpip | OSI 7 layers mapped to TCP/IP 4 layers, with example protocols |
| encapsulation | data → segment → packet → frame → bits, headers added |
| ip-classes | IPv4 class ranges and private ranges on a number line |
| utp-pinout | T568A and T568B pin colors 1–8 |
| straight-cross | straight-through vs crossover cable wiring |
| wifi-modes | ad-hoc vs infrastructure vs multiple APs (roaming) |
| wifi-bands | 2.4 GHz (longer range) vs 5 GHz (faster, shorter) vs 6 GHz |
| unc-share | client opens \\\\SERVER\\Share via the network, share + NTFS permission check |
| nos-services | NOS server providing file/print, management, security, web/intranet services to clients |
| vm-layers | hardware → host OS → hypervisor (VirtualBox/VMware) → guest OS VMs |
| lab-network-plan | internet → router → switch (rack, patch panel) → lab PCs, printer, AP |
| ping-ladder | troubleshooting order: 127.0.0.1 → own IP → gateway → external IP → domain name |
| firewall | inbound/outbound traffic filtered by rules between internet and LAN |
| defense-layers | layered security: physical, network, host, application, user |
| users-groups | users → groups → permissions on a shared folder |
| linux-perms | rwx bits for owner/group/others with octal values |
| wlan-devices | Wi-Fi router, access point, repeater/extender, mesh nodes, SIM (4G/5G) router, wireless bridge, USB adapter: wired uplink vs wireless backhaul |
| wifi-security-timeline | WEP → WPA/TKIP → WPA2/AES-CCMP → WPA3/SAE with status, what to choose today, WPS PIN risk (~11,000 guesses) |
| windows-ip-settings | Windows TCP/IPv4 dialog fields (IP, mask, gateway, DNS) mapped to PC, switch, router and DNS server in a small LAN |
| nos-vs-os | client OS vs network OS side by side: users, services, accounts, scale, examples |
| hypervisor-types | Type 1 bare-metal (ESXi, Hyper-V, Proxmox/KVM) vs Type 2 hosted (VirtualBox, VMware Workstation) layer stacks |
| vm-netmodes | VirtualBox NAT, Bridged, Host-only, Internal network: which paths VM, host, LAN and Internet have |
| rack-layout | network rack (patch panel, cable manager, switch, router/firewall, UPS) and wall jack → permanent link ≤ 90 m → patch panel → switch, channel ≤ 100 m |
| routing-decision | host compares destination AND mask: same network → ARP + switch, else → default gateway; router longest prefix match and default route 0.0.0.0/0 |
| troubleshoot-flow | bottom-up troubleshooting: link light/cable → ipconfig (APIPA, duplicate IP) → ping gateway → ping external IP → nslookup → application |
| malware-types | virus, worm, trojan, ransomware, spyware, rootkit compared: needs host file, spreads by itself, main harm |
| backup-321 | 3 copies, 2 media, 1 off-site, plus extension: 1 offline/immutable copy (3-2-1-1-0) |
| firewall-profiles | Windows Defender Firewall Domain / Private / Public profiles; default inbound blocked unless allowed, outbound allowed |

## Catalog: interactive widgets (`{type:'widget', name}`)

| name | what the student does (real logic, no fake UI) |
|---|---|
| topology-sim | pick bus/ring/star/mesh, click links to cut them, see which computers lose connection |
| hub-switch-sim | send frames between PCs; hub floods all ports, switch learns MAC table then forwards to one port |
| osi-explorer | click each OSI layer to see function, PDU, devices, protocols |
| encap-stepper | step through encapsulation/decapsulation of a web request |
| ip-calc | type an IPv4 address/prefix: shows class, binary, mask, network, broadcast, host range, private/public |
| bandwidth-calc | file size + link speed → transfer time; explains bits vs bytes |
| pinout-viewer | switch T568A/T568B and straight/cross to see each pin's color and pairing |
| wifi-security-check | choose Wi-Fi settings (security mode, password, SSID, WPS, admin password) and get a security score with reasons |
| ping-ladder | choose where a fault is, then run the ping steps and see which step fails |
| firewall-tester | edit an ordered rule list and test packets; first matching rule wins, default deny |
| caesar | encrypt/decrypt with a Caesar shift (encryption concept) |
| perm-calc | tick rwx boxes ↔ octal number ↔ `ls -l` string |
| port-lookup | search common port numbers/protocols |
| ipv6-tool | type an IPv6 address: validates it, shows full and RFC 5952 shortest form, address type (loopback, link-local, ULA, multicast, global, IPv4-mapped...) and the 8 groups of 16 bits |
| subnet-splitter | split a network (e.g. 192.168.10.0/24) into N equal subnets or by hosts per subnet; lists network, first/last host, broadcast, usable hosts with an address-block bar |
| route-lookup | edit a small routing table (destination/prefix, next hop or directly connected, interface) and look up a destination IP; highlights all matches and picks the longest prefix match with the reason |
| nic-config | fill a Windows TCP/IPv4 Properties form (DHCP or static IP, mask, gateway, DNS) and get precise problems: invalid mask, network/broadcast IP, gateway in another subnet, APIPA, missing/duplicate DNS |
| share-ntfs | tick group membership and set Share and NTFS Allow/Deny per group; computes effective share, effective NTFS, network access (more restrictive) and local access with reasoning steps |
| vm-netmode | pick VirtualBox network mode NAT / Bridged / Host-only / Internal: see who can reach the VM, what the VM can reach, and the IP it gets |
| threat-sorter | classify 10 shuffled incident scenarios as Virus, Worm, Trojan, Ransomware, Spyware, Phishing, Rootkit, Backdoor, Sniffing or DoS with instant feedback and score |
| backup-321 | plan backup copies (medium, on/off-site, versioned or sync, online or offline); checks the 3-2-1 rule and shows which disasters (disk failure, ransomware, fire, accidental delete) lose data and why |

## Week topics (from the official lesson plan; the exit lab for the same week already exists)

| week | unit | title (use as `title`) | topics to cover |
|---|---|---|---|
| 1 | 1 | ความรู้เกี่ยวกับระบบเครือข่ายคอมพิวเตอร์ | ประโยชน์ (ประหยัด สะดวก รวดเร็ว ปลอดภัย), องค์ประกอบ (Workstation, Network Device, Data, Transmission Media, Protocol) และหลักการทำงาน, ประเภท LAN/MAN/WAN/PAN, สถาปัตยกรรม Peer-to-Peer / Client-Server, Topology Bus/Ring/Star (+Mesh/Hybrid) ข้อดีข้อเสีย |
| 2 | 2 | อุปกรณ์และสื่อนำสัญญาณ | NIC, Share Hub/Switch Hub, Repeater, Bridge, Modem, Router, Gateway; สาย Coaxial, Twisted pair STP/UTP (Category), Fiber single/multi-mode; สื่อไร้สาย Radio, Microwave, Satellite, Infrared, Bluetooth; หัวต่อ BNC, RJ-45, FC, ST, SC, LC |
| 3 | 3 | มาตรฐานและโปรโตคอลของระบบเครือข่าย | องค์กรมาตรฐาน ISO ITU ANSI IEEE EIA/TIA; OSI 7 ชั้นและหน้าที่; ความหมายโปรโตคอล; TCP/IP, NetBEUI, AppleTalk, IPX/SPX; TCP/IP เทียบ OSI; IP Address และการแบ่งคลาส; IEEE 802 (802.3, 802.11, 802.15 ฯลฯ) |
| 4 | 4 | เครือข่าย LAN แบบใช้สาย: เทคโนโลยีและมาตรฐาน | เทคโนโลยี LAN: Ethernet, Token Passing, FDDI; Ethernet ยุคเก่า 10BASE5/10BASE2/10BASE-T; Fast Ethernet 802.3u 100BASE-TX/FX; Gigabit 802.3z (SX/LX/CX), 802.3ab 1000BASE-T, 802.3ah LX10/BX10; CSMA/CD; Baseband |
| 5 | 4 | เครือข่าย LAN แบบใช้สาย: การเข้าสาย UTP กับ RJ-45 | อุปกรณ์: Switch, สาย UTP, RJ-45, ปลอกหุ้ม (boot), คีมย้ำ, LAN tester; T568A/T568B; สายตรง/สายไขว้ และ Auto MDI/MDIX; ขั้นตอนเข้าหัวและตรวจสอบ, ข้อผิดพลาดที่พบบ่อย, การเดินสาย (ระยะ 100 m) |
| 6 | 5 | เครือข่าย LAN ไร้สาย: มาตรฐานและอุปกรณ์ | ข้อดีของ WLAN, การประยุกต์ใช้ (บ้าน องค์กร สถานศึกษา สาธารณะ), มาตรฐาน 802.11a/b/g/n/ac/ax, อุปกรณ์ Wi-Fi card/adapter, Wi-Fi router, Access Point, Repeater/Range extender, SIM router, Mesh Wi-Fi, Wireless bridge, Antenna |
| 7 | 5 | เครือข่าย LAN ไร้สาย: การเชื่อมต่อและความปลอดภัย | รูปแบบ Ad-Hoc, Infrastructure, Multiple Access Points (roaming); ความปลอดภัย: SSID (ซ่อน SSID), MAC Address Filtering, รหัสผ่าน/การเข้ารหัส WEP/WPA/WPA2/WPA3, รหัสผ่านผู้ดูแล router, WPS, Guest network; ขั้นตอนตั้งค่าความปลอดภัย |
| 8 | 6 | เครือข่ายในวินโดวส์: ชื่อเครื่อง ชื่อเครือข่าย และ IP Address | ตรวจสอบ/เปลี่ยนชื่อเครื่อง, Workgroup/Domain, เปลี่ยน IP แบบ Static และ DHCP (IP, Subnet mask, Gateway, DNS) ใน Windows 10/11, คำสั่ง hostname/ipconfig |
| 9 | 6 | เครือข่ายในวินโดวส์: การแชร์และเชื่อมต่อ | แชร์โฟลเดอร์ (share permission vs NTFS), แชร์เครื่องพิมพ์, เชื่อมต่อโฟลเดอร์/เครื่องพิมพ์ที่แชร์ (UNC path, Map network drive), Network discovery, Public/Private network profile, เชื่อมต่อ Wi-Fi |
| 10 | 7 | ระบบปฏิบัติการเครือข่าย: ความหมายและบริการ | ความหมาย NOS, ต่างจาก OS ส่วนบุคคล, บริการ File & Print sharing, Management, Security, Internet/Intranet, Multiprocessing & Clustering |
| 11 | 7 | ระบบปฏิบัติการเครือข่าย: ซอฟต์แวร์ NOS และเครื่องจำลอง | NetWare, UNIX, Linux, Solaris, Windows Server; ซอฟต์แวร์จำลองเครื่อง VMware, VirtualBox; Host/Guest; Hypervisor type 1/2; ความต้องการฮาร์ดแวร์ VT-x/AMD-V |
| 12 | 7 | ระบบปฏิบัติการเครือข่าย: การติดตั้งบนเครื่องจำลอง | ขั้นตอนสร้างเครื่องจำลอง, กำหนด RAM/CPU/ดิสก์, ไฟล์ ISO, ติดตั้ง NOS, network mode NAT/Bridged/Host-only/Internal, Snapshot, ข้อควรระวัง |
| 13 | 8 | ออกแบบ ติดตั้ง และตรวจสอบเครือข่าย | แผนผังเครือข่ายขนาดเล็ก/กลาง, การเดินสาย, ตู้ Rack/Patch panel, คำสั่งตรวจสอบ ipconfig, ping, tracert, netstat, nslookup (อ่านผลลัพธ์) |
| 14 | 8 | วิเคราะห์และแก้ปัญหาเครือข่าย | ปัญหาจากสายสัญญาณ อุปกรณ์ ระบบปฏิบัติการและไดรเวอร์; วิธีวิเคราะห์จากชั้นล่างขึ้นบน; ลำดับ ping; อาการ APIPA, IP ซ้ำ, DNS; ซอฟต์แวร์ช่วยงาน (วิเคราะห์ เช่น Wireshark, สแกน IP, โอนย้ายข้อมูล, ความปลอดภัย); ซอฟต์แวร์ควบคุมระยะไกล TeamViewer/AnyDesk และความปลอดภัยในการใช้ |
| 15 | 9 | ความปลอดภัย: ภัยคุกคามในระบบคอมพิวเตอร์ | ประเภทภัยคุกคาม (กายภาพ ซอฟต์แวร์ ข้อมูล), Virus, Trojan, Worm, Spyware, Ransomware, Rootkit, Backdoor, Spam, Phishing, Sniffing (+Social engineering, DoS) |
| 16 | 9 | ความปลอดภัย: การป้องกันและ Windows Firewall | ป้องกันทางกายภาพ ซอฟต์แวร์และข้อมูล, มาตรการสำหรับหน่วยงานและพนักงาน, โปรแกรมป้องกันไวรัส (Microsoft Defender), สำรองข้อมูล 3-2-1, Firewall ฮาร์ดแวร์/ซอฟต์แวร์ หลักการทำงาน, Windows Defender Firewall: profiles, inbound/outbound rules, ขั้นตอนสร้างกฎ |
| 17 | 10 | บัญชีผู้ใช้: การสร้างผู้ใช้และกลุ่มผู้ใช้ | ประโยชน์ของบัญชีผู้ใช้, Computer Management > Local Users and Groups, สร้างผู้ใช้ (ตัวเลือกรหัสผ่าน), สร้างกลุ่มและเพิ่มสมาชิก (ชื่อเครื่อง\ผู้ใช้), บัญชี built-in Administrator/Guest, คำสั่ง net user / net localgroup |
| 18 | 10 | บัญชีผู้ใช้: การกำหนดสิทธิ์และการใช้งาน | กำหนดสิทธิ์การใช้งาน (Give access to > Specific people, Read / Read/Write), Share vs NTFS permission, หลัก Least Privilege, การใช้งานตามบัญชีผู้ใช้ในเครือข่ายวินโดวส์, จัดการบัญชีเมื่อเลิกใช้งาน, เทียบสิทธิ์ใน Linux (rwx) |

## Self-check before you finish

1. `node -e "const L=require('./content/lessons/wN.js'); console.log(L.sections.length, L.quiz.length)"` runs without errors for every file you wrote.
2. 10 quiz items, every item has level + explain, choice `correct` index valid, multi `correct` array valid, correct positions varied.
3. Only catalog diagram/widget names are used.
4. All facts checked against the accuracy checklist.

## Parallel post-test (form B) and extra visuals (NetLab 2.4)

- `content/lessons/forms/wN.js` exports the post-test: an array index-aligned with `quiz` (same type and level per item, same objective, different stem/numbers/options). Check with `node tests/forms-check.js`.
- `content/lessons/visuals.js` places extra diagrams/widgets into lessons at load time by anchor (block type + text), so lesson text can be edited independently. `node tests/lessons-check.js` verifies the anchors.
