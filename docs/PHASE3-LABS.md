# Phase 3: Network Lab Engine และกิจกรรมปฏิบัติ (NetLab 3.0)

เพิ่มห้องปฏิบัติการ 4 ห้องใหม่ และขยายห้องจำลองการออกแบบเครือข่าย (NetSim)

ทุกภารกิจใช้หลักการเดียวกัน:
- เซิร์ฟเวอร์ตรวจผลจาก "สิ่งที่นักเรียนตั้งค่าหรือทำจริง" โดยรันเอนจินจำลองตัวเดียวกับหน้าเว็บซ้ำบนเซิร์ฟเวอร์
- ไม่เชื่อคะแนนจากเบราว์เซอร์
- ทุกห้องเป็นระบบจำลอง (Simulator) และหน้าเว็บบอกไว้ชัดเจน ไม่ใช่เครื่องจริงหรือ VM

## 1. ภารกิจใหม่ 27 ภารกิจ

| ห้อง | ภารกิจ | สัปดาห์และประเภท | สิ่งที่ตรวจ |
|---|---|---|---|
| **Switching และ VLAN** (`switching`) | sw1 Switch เรียนรู้ MAC | w4 Guided | ping ตามลำดับจริง + ตาราง MAC ที่นักเรียนกรอกเทียบกับผลจากการกระทำของนักเรียนเอง |
| | sw2 ARP ทีละขั้น | w4 Guided | คำตอบจาก trace ของการ ping ที่นักเรียนทำ |
| | sw7 Hub vs Switch | w4 Guided | จำนวน Collision domain และเครื่องที่ได้รับเฟรม จากการทดลองจริง |
| | sw3 VLAN บน Switch เดียว | w4 Independent | ชื่อ VLAN, พอร์ต, ping ในวง VLAN เดียวกันได้ ข้าม VLAN ไม่ได้ |
| | sw4 Trunk 802.1Q | w4 Independent | Allowed list เท่าที่จำเป็น, Native VLAN 99 ตรงกันทั้งสองฝั่ง, ping ข้าม Switch |
| | sw5 STP | w4 Independent | Root bridge ตามโจทย์, พอร์ตที่ถูก Block, ไม่เกิด Broadcast storm |
| | sw6 แก้ VLAN/Trunk เสีย | w4 Troubleshooting | ผล ping หลังแก้ และหักคะแนนถ้าแก้ด้วยการย้ายทุกเครื่องไป VLAN 1 |
| **NetSim** (ห้องเดิม `topology`) | t10 ออกอินเทอร์เน็ตด้วย NAT/PAT | w10 Guided | inside/outside, PAT, ping/เว็บออกนอกได้, ตาราง NAT |
| | t11 เปิดเว็บเซิร์ฟเวอร์ให้คนนอก | w10 Independent | Port forward 80/443 เท่านั้น พอร์ต 22/3389 ต้องเข้าไม่ได้ |
| | t12 ACL เฉพาะเว็บและ DNS | w16 Independent | ชุดทดสอบ protocol/port ว่าถูกบล็อกโดย ACL จริง |
| | t13 แก้ ACL และ NAT ที่ตั้งผิด | w16 Troubleshooting | ชุดทดสอบเดียวกัน และหักคะแนนถ้าใช้ `permit ip any any` |
| **IPv6** (`ipv6`) | v1 ย่อ/ขยาย IPv6 (สุ่มรายคน) | w8 Guided | ตามกฎ RFC 5952 และชนิดที่อยู่ |
| | v2 EUI-64 และ Link-local (สุ่มรายคน) | w8 Guided | ค่าที่คำนวณ + ping link-local ในระบบจำลอง |
| | v3 SLAAC สองวง | w8 Independent | RA, ที่อยู่ที่เครื่องได้รับ, Gateway, ping6 ครบ 12 คู่ |
| | v4 Static IPv6 และ Static route | w13 Independent | ที่อยู่ เส้นทาง และ ping6 |
| | v5 แก้ IPv6 เสีย 4 จุด | w8 Troubleshooting | /48, Gateway ผิดวง, RA ปิด, ที่อยู่ซ้ำ (DAD) |
| **วิเคราะห์แพ็กเก็ต** (`packets`) | p1 Encapsulation (สุ่มรายคน) | w3 Guided | ชั้นและค่าของแต่ละ header |
| | p2 TCP 3-way handshake | w10 Guided | หมายเลข SYN/SYN-ACK/ACK, พอร์ต, ค่า ACK |
| | p3 DNS over UDP | w10 Independent | Query/Response, Transaction ID, IP ที่ได้ |
| | p4 DHCP DORA | w10 Independent | ลำดับ 4 ข้อความ, IP ที่เสนอ, Lease |
| | p6 เขียน Display filter | w14 Independent | เซิร์ฟเวอร์รันตัวกรองของนักเรียนกับแพ็กเก็ตชุดเดิม ตัวกรองที่เขียนต่างกันแต่ได้ผลเท่ากันก็ได้คะแนน |
| | p5 เปิดเว็บไม่ได้เพราะอะไร | w14 Troubleshooting | ข้อสรุป (DNS / พอร์ตปิด / ถูกกรอง) + หมายเลขแพ็กเก็ตที่เป็นหลักฐาน |
| **Monitoring และ Automation** (`netops`) | o1 ตั้ง Monitoring 6 บริการ | w14 Guided | ชนิดการตรวจ, พอร์ต, รอบตรวจ, เกณฑ์แจ้งเตือน |
| | o3 หาจุดคอขวดและ Top talker | w14 Independent | อินเทอร์เฟซ, พอร์ต, ช่วงเวลา, ค่า Utilization |
| | o2 สืบเหตุขัดข้องจาก Dashboard + Syslog (สุ่มรายคน) | w14 Troubleshooting | สาเหตุ อุปกรณ์ เวลาเริ่ม และ log ที่อ้างเป็นหลักฐาน |
| | a1 Template + Inventory ตั้งค่า Switch 5 ตัว | w12 Guided | สถานะของอุปกรณ์หลังนำไปใช้ ไม่เทียบข้อความ เทมเพลตที่ต่างกันแต่ได้ผลเท่ากันก็ได้คะแนน |
| | a2 Playbook: Backup, Apply, Verify, Rollback | w12 Independent | รันบนเครือข่ายจำลองที่มีสวิตช์เสีย 1 ตัว ต้องย้อนกลับได้และตัวอื่นสำเร็จ |

**ภาพรวมห้องจำลอง:** 9 ห้อง 78 ภารกิจ (เดิม 5 ห้อง 51 ภารกิจ) ทุกภารกิจถูกจัดเข้าสัปดาห์ใน `content/curriculum.js` และตรวจด้วย `tests/curriculum-check.js`

## 2. ความสามารถของเอนจินที่เพิ่ม

**Switching**
- ตาราง MAC แยกตาม VLAN และพอร์ต, การ Flood ภายใน VLAN
- Hub กับ Collision domain
- ARP พร้อม Frame trace ทีละขั้น
- VLAN และ Access/Trunk 802.1Q: Allowed list, Native VLAN และผลของ Native mismatch
- STP แบบ PVST+: เลือก Root, Root port, Designated port, Alternate port
- Broadcast storm เมื่อปิด STP
- กล่องพิมพ์คำสั่งแบบ Cisco ชุดย่อย (`switchport`, `show vlan brief`, `show spanning-tree` ฯลฯ)

**NetSim**
- NAT/PAT และ Port forward พร้อมตาราง Translation
- ACL ตามอินเทอร์เฟซและทิศทาง: First match และ Implicit deny ที่มองเห็นได้
- ทดสอบพอร์ต TCP/UDP นอกเหนือจาก ping
- **การบังคับใช้ NAT เปิดเฉพาะภารกิจใหม่** (`requireNat`) ภารกิจเดิม t1–t9, x1–x14 และเทอร์มินัลทำงานเหมือนเดิม และชุดทดสอบเดิมผ่านทั้งหมด

**IPv6**
- RFC 5952 และการตรวจรูปแบบที่อยู่พร้อมข้อความไทยที่ระบุจุดผิด
- EUI-64, Link-local, SLAAC จาก RA, DAD
- Static route และ ping6 พร้อม NS/NA trace
- สาเหตุที่ ping ไม่ผ่าน 17 แบบ

**Packets**
- สร้างแพ็กเก็ตเป็นไบต์จริงจาก seed: ARP, DHCP, DNS, TCP/HTTP, ICMP, UDP พร้อม checksum
- Display filter ชุดย่อยของ Wireshark
- Follow TCP Stream และแผนภาพ Encapsulation

**NetOps**
- นาฬิกาจำลอง, Ping/TCP/SNMP-like polling, กราฟ SVG และ Syslog
- Template engine ที่ปลอดภัย (ไม่มี eval) และ Playbook ที่มี rollback

## 3. ไฟล์

**ไฟล์ใหม่**
- `public/js/sim/{switching,ipv6,packets,netops}.js`
- `server/sims/{switching,ipv6,packets,netops}.js`
- `tests/sims/{switching,ipv6,packets,netops}.test.js`
- `tests/e2e/part12.py`

**ไฟล์ที่ขยาย**
- `public/js/sim/netsim.js`, `public/js/sim/topology.js`, `server/sims/topology.js`
- `tests/sims/netsim.test.js`, `tests/sims/topology.test.js`

**ไฟล์ที่ผูกระบบ**
- `server/sims-api.js`: ลงทะเบียนห้องใหม่ และส่งช่อง week/mode
- `server.js`: ไฟล์ออฟไลน์ของ PWA
- `public/js/practice.js`: ไอคอนและคำอธิบายของห้อง
- `public/js/app.js`: ลิงก์ตรงไปภารกิจที่มีรหัสหลายตัวอักษร เช่น `sw3`
- `content/curriculum.js` และ `server/skills.js`: ภารกิจใหม่นับเป็นหลักฐานของทักษะ
- `tests/api.test.js`

## 4. ผลทดสอบ

**ชุดทดสอบห้องจำลอง: ผ่าน 463 กรณี ไม่มีล้มเหลว**

| ชุด | ผ่าน |
|---|---|
| crimp | 38 |
| ipv6 | 44 |
| netops | 41 |
| netsim | 71 |
| packets | 41 |
| subnet | 61 |
| switching | 52 |
| terminal | 24 |
| topology | 58 |
| troubleshoot | 33 |

ครอบคลุม:
- พฤติกรรมของเอนจิน เช่น ตั้ง Gateway/VLAN/NAT ผิดแล้ว ping ล้มเหลวอย่างสอดคล้อง และแก้ถูกแล้วสำเร็จ
- ทุกภารกิจตรวจกรณีทำถูกต้องได้เต็ม ทำผิดแบบที่พบบ่อยได้คะแนนบางส่วนพร้อมคำอธิบายภาษาไทย และข้อมูลปลอมหรือใหญ่เกินได้ 0 โดยระบบไม่ล่ม

**ทดสอบผ่านเบราว์เซอร์จริง (Chromium)**
- ผู้พัฒนาแต่ละห้องทำทุกภารกิจผ่านหน้าจอแบบนักเรียน ได้คะแนนเต็มทุกภารกิจ
- ตรวจที่ 360px และ 1366px ไม่มีหน้าล้นแนวนอน และตรวจโหมดมืดแล้ว
- e2e part12:
  - ทั้ง 27 ภารกิจเปิดด้วยลิงก์ตรงได้ทั้งมือถือและเดสก์ท็อป
  - ผลที่บันทึกขึ้นเป็น "ผ่านแล้ว" ในแผนของสัปดาห์
  - ทักษะ Switching นับห้องใหม่เป็นหลักฐาน
  - ครูเห็นทั้ง 9 ห้องในรายงาน

**ชุดทดสอบรวม:** ผลอยู่ท้ายเอกสารนี้

## 5. สัดส่วนปฏิบัติหลัง Phase 3 (ประมาณจากเวลา วิธีคิดเดียวกับ Phase 2)

| | สัดส่วนปฏิบัติ |
|---|---|
| ภาพรวม 18 สัปดาห์ | Phase 2 ประมาณ 45% → Phase 3 ประมาณ 51% |
| w4 | 29% → 52% |
| w8 | 60% → 66% |
| w10 | 54% → 66% |
| w12 | 49% → 58% |
| w14 | 59% → 68% |
| w16 | 46% → 55% |

**ยังต่ำกว่า 35%:** w1, w2, w6, w7, w9, w17, w18 เพราะยังเป็นแล็บแบบเลือกตอบเป็นหลัก แผน Phase 4–5 คือ
- เปลี่ยนข้อเลือกตอบในแล็บท้ายคาบเป็นงานตั้งค่าหรืออ่านผลจริง
- สร้างแล็บวางแผนช่องสัญญาณ Wi-Fi ซึ่ง**ยังไม่ได้สร้าง**ในรอบนี้
- เพิ่มภารกิจบัญชีผู้ใช้/สิทธิ์ในเทอร์มินัล

**ยังไม่ถึงเป้า 70%**

## 6. ข้อจำกัดที่ทราบ (แจ้งตามจริง)

**Switching**
- STP แสดงเฉพาะผลสุดท้าย ไม่มีตัวจับเวลา Listening/Learning
- ไม่มี DTP และ MAC aging
- เปลี่ยนค่าแล้วตาราง MAC และ ARP ล้างใหม่ทุกครั้ง เพื่อให้การตรวจย้อนรอยได้แน่นอน

**NetSim**
- ACL 1 ชุดต่ออินเทอร์เฟซต่อทิศทาง
- ไม่มี `established` และไม่มี hairpin NAT
- แท็บ "ปัญหา" ของ t13 ใบ้ค่อนข้างชัด

**IPv6**
- ไม่มี DHCPv6 และ Temporary address
- ข้อผิด 4 จุดของ v5 กำหนดตายตัว ไม่สุ่ม

**Packets และ NetOps**
- ตัวสร้างข้อมูลรันในเบราว์เซอร์ นักเรียนที่เปิดดูโค้ดอาจคำนวณคำตอบได้ แต่ปลอมโจทย์หรือคะแนนไม่ได้
- คำตอบส่วนใหญ่เห็นได้จากข้อมูลที่จับอยู่แล้ว

**ทั้งหมด**
- ยังไม่ได้ทดสอบบนมือถือจริงและด้วยโปรแกรมอ่านหน้าจอ
- การบันทึกผลแบบล็อกอินทดสอบผ่าน API และ e2e ส่วนการทำภารกิจครบทุกข้อผ่านหน้าจอทดสอบในโหมดผู้เยี่ยมชม

## 7. ผลการทดสอบ (รันจริง 14 ต.ค. 2026)

| ชุดทดสอบ | ผล |
|---|---|
| `npm test` (audit เนื้อหา/คลังข้อสอบ) | 0 issue |
| `test:content` (curriculum-check, globals-check) | 78/78, ชื่อชนกัน 0 |
| `tests/api.test.js` | 65 ผ่าน |
| ทดสอบเอนจินจำลอง 10 ไฟล์ (`tests/sims/*`) | 463 ผ่าน |
| `tests/accounts.test.js` | 21 ผ่าน |
| `tests/merge-rooms.test.js` (migration + rollback) | 7 ผ่าน |
| e2e เบราว์เซอร์ทั้งชุด (`tests/e2e/run.sh`, 15 สคริปต์ รวม part12 ใหม่) | 442 ✓, 2 ✗ ในรอบแรก ดูด้านล่าง |

e2e รอบแรกมีข้อไม่ผ่าน 2 ข้อ
- `phase4.py` ยังคาดว่ามีเครื่องจำลอง 5 ตัว ซึ่งเป็นค่าเก่าจากก่อน Phase 3 แก้เป็น 9 แล้ว รันซ้ำได้ 0 issue
- `part3.py` "ครูตั้งรหัสชั่วคราวแล้วคำขอหายไป" ไม่ผ่านเพราะนับการ์ดก่อนหน้าจอรีเฟรชเสร็จ ข้อถัดไป (นักเรียนล็อกอินด้วยรหัสชั่วคราว) ผ่าน รันซ้ำแยก 3 รอบผ่านทั้ง 3 รอบ จึงเพิ่มให้รอการ์ดหายก่อนนับ
