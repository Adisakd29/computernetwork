# CURRICULUM-MAP: หนังสืออ้างอิง vs NetLab (ตารางหลักเป็น baseline สถานะก่อนเพิ่ม 2.8 supplementary sections ดูสถานะหลัง 2.8 ที่ท้ายเอกสาร)

ขอบเขต: ตรวจแบบอ่านอย่างเดียว ณ 2026-10-13 เทียบสารบัญหนังสือใน `docs/book-toc.md` (12 บท และทุกหัวข้อย่อย รวม 115 หัวข้อ) กับเนื้อหา NetLab ปัจจุบัน ได้แก่ `content/lessons/w1..w18.js` (sections/blocks), `guide/*.js`, `visuals.js` + `visuals.d/a,b,c.js`, figure ใน `public/js/diagrams*.js`, `widgets*.js`, `figs-a/b/c.js` (figs-d..g ยังว่าง), คลังข้อสอบ `content/bank/unit1..10.js` (ใช้งานได้ 433 ข้อ ไม่นับ 41 ข้อที่ retired), ห้องฝึก 12 ห้องใน `content/labs.js` และ missions ของ simulator 5 ตัว ไม่ได้นับ `content/lessons/extra/*.js`

วิธีตรวจ: ค้นข้อความด้วย regex ผ่าน node ใน section blocks (รวม visual ที่ถูกวางเข้าไป), check blocks, bank (ไม่มี field tag จึงนับตาม keyword ใน q/options/explain), ห้องฝึก และ missions ตัวเลข bank เป็นจำนวนข้อที่มี keyword นั้น (ประมาณการ อาจรวมข้อที่แค่เอ่ยถึง)

เกณฑ์ coverage: **เต็ม** = มีเนื้อหาอธิบายใน section ของบทเรียน · **บางส่วน** = เอ่ยผ่าน ๆ (1-2 ประโยค) หรือมีเฉพาะในห้องฝึก/คลังข้อสอบ · **ไม่มี** = ไม่พบที่ใดเลย

คำย่อ: Wn.sK = สัปดาห์ n section K · chk = check block ในบทเรียน · bank = จำนวนข้อใน bank · r1-r12 = ห้องฝึก · t/s/c/m/x = missions ของ topology/subnet/crimp/terminal/troubleshoot · d: = diagram · w: = widget

แผนการสอนทางการ 21910-2013 (18 สัปดาห์): W1 พื้นฐานเครือข่าย · W2 อุปกรณ์และสื่อ · W3 มาตรฐาน โปรโตคอล OSI/TCP-IP และ IP · W4 LAN แบบใช้สาย · W5 เข้าสาย UTP · W6 WLAN มาตรฐาน · W7 WLAN ความปลอดภัย · W8 Windows: ชื่อเครื่องและ IP · W9 Windows: การแชร์ · W10-12 NOS และ VM · W13 ออกแบบ/ติดตั้ง/ตรวจสอบ · W14 แก้ปัญหา · W15-16 ความปลอดภัย · W17-18 บัญชีผู้ใช้และสิทธิ์

---

## ตาราง mapping รายหัวข้อ

### บทที่ 1 พื้นฐานการสื่อสารข้อมูลและเครือข่าย

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 1.1 | Components of Data Communication System | W1.s2 องค์ประกอบและหลักการทำงาน | เต็ม | ถูกต้อง แยก 5 องค์ประกอบออกจากอุปกรณ์ที่ต้องซื้อชัดเจน | d:net-components, d:lab-room-network | chk W1.s2, bank ~9 | topology t1, r1 | keep |
| 1.2 | Three Fundamental Characteristics (Delivery/Accuracy/Timeliness, Jitter) | ไม่มี | ไม่มี | - | - | 0 | - | add as supplementary section in week 1 |
| 1.3 | Telecommunication | W3.s1 (แถว ITU ในตารางองค์กร) | บางส่วน | ถูกต้อง แต่ไม่มีนิยาม | - | chk W3.s1 (ไม่ตรงหัวข้อ), bank ~4 | - | add as supplementary section in week 1 |
| 1.4 | Computer Networks | W1.s1 | เต็ม | ถูกต้อง | - | chk W1.s1, bank ~10 (ประโยชน์/นิยาม) | r1 | keep |
| 1.5 | ก่อนจะเป็นเครือข่าย (stand-alone, sneakernet) | มีเฉพาะประโยคเปิดใน guide/w1 s1 | บางส่วน | - | - | 0 | - | history-only (ย่อหน้าสั้นใน supplementary week 1) |
| 1.6 | ประโยชน์ของเครือข่าย | W1.s1 (4 ด้าน + ตาราง) | เต็ม | ถูกต้อง มีคำเตือนเรื่องความปลอดภัย | - | chk W1.s1, bank ~10 | r1 | keep |
| 1.7 | Network Criteria (Performance, Reliability, Security) | ไม่มีในบทเรียน มีเฉพาะ r1 (1 ข้อ) | บางส่วน | r1 ถูกต้อง | - | bank 0 | r1 | add as supplementary section in week 1 |
| 1.8 | Network Standard | W3.s1 | เต็ม | ถูกต้อง | - | chk W3.s1 | - | keep |
| 1.9 | Categories of Standards (de facto / de jure) | ไม่มี | ไม่มี | - | - | 0 | - | add as supplementary section in week 3 |
| 1.10 | กระบวนการกำหนดมาตรฐาน | W3.s6 (ที่มาเลข 802), อ้าง RFC ใน W3.s5 | บางส่วน | ถูกต้อง แต่ไม่อธิบายขั้นตอน (IEEE WG, IETF RFC) | - | 0 | - | add as supplementary section in week 3 |
| 1.11 | Standards Organizations | W3.s1 ตาราง ISO/ITU/ANSI/IEEE/EIA-TIA | เต็ม | ถูกต้อง (W5 ระบุว่า "เดิมเรียก EIA/TIA-568") ควรเติม IETF ในตาราง | - | chk W3.s1, bank ~1-3 | - | keep (เติม IETF) |
| 1.12 | Categories of Networks | W1.s3 PAN/LAN/MAN/WAN | เต็ม | ถูกต้อง มีหมายเหตุว่าระยะเป็นค่าประมาณ | d:lan-man-wan, d:home-network | chk W1.s3, bank ~13 | r1 | keep |
| 1.13 | Interconnection of Networks | W2.s2 Router/Gateway, W1.s3 | บางส่วน | ถูกต้อง แต่ไม่มีแนวคิด internetwork | d:home-network | chk W2.s2 | topology t3, t4 | extend in week 2 |
| 1.14 | The Internet | W1.s3 (อินเทอร์เน็ตคือ WAN ใหญ่สุด), W3.s3 (ARPANET ในตาราง) | บางส่วน | ถูกต้อง ไม่มีโครงสร้าง ISP/IXP | d:home-network | 0 | topology t3 | add as supplementary section in week 1 |
| 1.15 | Computer Networks - Basic Configuration | W1.s2, W13.s1 | เต็ม | ถูกต้อง | d:net-components, d:lab-network-plan, d:lab-room-network | chk W1.s2, W13.s1 | topology t1, t2 | keep |

### บทที่ 2 Network Models

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 2.1 | ISO และ OSI | W3.s1, W3.s2 | เต็ม | ถูกต้อง | d:osi-tcpip | chk W3.s2, bank OSI 15 | w:osi-explorer, r4 | keep |
| 2.2 | แนวความคิดในการแบ่งชั้นสื่อสาร | W3.s2 (กล่าวโดยนัย) | บางส่วน | ถูกต้อง แต่ไม่บอกเหตุผลของการแบ่งชั้น | - | 0 | - | extend in week 3 |
| 2.3 | Layered Architecture | W3.s2 (แต่ละชั้นให้บริการชั้นบน) | เต็ม | ถูกต้อง | d:encapsulation | chk W3.s2 | w:osi-explorer | keep |
| 2.4 | Peer-to-Peer Processes | W3.s2 (header/trailer ต่อชั้น) | บางส่วน | ถูกต้อง แต่ไม่อธิบายว่า header ของชั้นหนึ่งอ่านโดยชั้นเดียวกันฝั่งตรงข้าม | d:encapsulation | bank encapsulation ~6 | w:encap-stepper, w:packet-journey | extend in week 3 |
| 2.5 | Organization of the Layers (network-support / user-support) | ไม่มี | ไม่มี | - | - | 0 | - | extend in week 3 (1 ย่อหน้า) |
| 2.6 | Layers in the OSI Model | W3.s2 ตาราง 7 ชั้น + PDU | เต็ม | ถูกต้อง | d:osi-tcpip | chk W3.s2, bank 15 | w:osi-explorer, r4 | keep |
| 2.7 | Internet Model | W3.s4 TCP/IP 4 ชั้น เทียบ OSI | เต็ม | ถูกต้อง ระบุไว้แล้วว่ามีแบบ 5 ชั้นด้วย (หนังสือใช้แบบ 5 ชั้น) | d:osi-tcpip | chk W3.s4, bank ~7 | w:encap-stepper, r4 | keep |

### บทที่ 3 Topologies and LAN Components

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 3.1 | Line Configuration (point-to-point / multipoint) | ไม่มี | ไม่มี | - | - | 0 | - | add as supplementary section in week 1 |
| 3.2 | Topologies | W1.s5 Bus/Ring/Star/Mesh/Hybrid | เต็ม | ถูกต้อง ระบุว่าปัจจุบันใช้ Star/Extended Star | d:topologies, d:lab-room-network | chk W1.s5, bank ~19 (w1) | w:topology-sim, w:topology-cost, topology sim, r1 | keep |
| 3.3 | LAN Components | W1.s2, W2.s1, W6.s4 | เต็ม | ถูกต้อง | d:network-devices, d:device-ports | chk W2.s1 | w:hub-switch-sim | keep |
| 3.4 | Connecting Devices | W2.s1, W2.s2 (ตาราง device ต่อชั้น OSI) | เต็ม | ถูกต้อง | d:network-devices, d:device-ports | chk W2.s1, W2.s2, bank ~95 | w:hub-switch-sim, r2, r4 | keep |
| 3.5 | LAN Technology | W4.s1 Ethernet/Token Passing/FDDI | เต็ม | ถูกต้อง แยกยุคเก่ากับปัจจุบันในตาราง "สถานะปัจจุบัน" | d:ethernet-standards | chk W4.s1 | r6 | keep |
| 3.6 | MAN Technology | W1.s3 (นิยาม), W3.s6 (802.16 WiMAX) | บางส่วน | ถูกต้อง ไม่มี Metro Ethernet / FTTx | d:lan-man-wan | bank ~7 | - | add as supplementary section in week 2 |
| 3.7 | WAN Technology | W1.s3, W2.s2 (Modem/ONU), W4.s5 (802.3ah) | บางส่วน | ถูกต้อง ไม่มี leased line, MPLS, SD-WAN, 4G/5G | d:home-network | 0 | topology t3 | add as supplementary section in week 2 |
| 3.8 | Switching (circuit / packet / message) | ไม่มี | ไม่มี | - | - | 0 | - | add as supplementary section in week 3 |

### บทที่ 4 Fundamental of Data and Signals

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 4.1 | Analog Versus Digital | W2.s2 (โมเด็มแปลงดิจิทัล) เอ่ยผ่าน, r3 (1 ข้อ) | บางส่วน | ถูกต้อง | - | bank ~1 | r3 | add as supplementary section in week 2 |
| 4.2 | Fundamentals of Signals (amplitude, frequency, period, phase, wavelength) | มีเฉพาะ r3 (ความถี่ 1 ข้อ) | ไม่มี | - | - | 0 | r3 | add as supplementary section in week 2 (+ waveform widget) |
| 4.3 | หน่วยวัดความเร็วในการส่งข้อมูล (bps, Bps, baud) | W2.s3, W4.s4 (Mbps, เวลาส่งไฟล์) | บางส่วน | ถูกต้อง ไม่มีเรื่อง baud vs bit rate | - | chk W4.s4, bank ~20 | w:bandwidth-calc, r3 | extend in week 2 |
| 4.4 | Converting Data into Signals (line coding, ASK/FSK/PSK/QAM) | W6.s2 เอ่ย QAM ของ Wi-Fi | ไม่มี | - | - | 0 | - | add as supplementary section in week 2 |
| 4.5 | Transmission Impairment (attenuation, distortion, noise) | W2.s3 (crosstalk/EMI), W5.s5 (100 m), W4.s4 | บางส่วน | ถูกต้อง แต่ไม่ได้แยก 3 ชนิดเป็นหัวข้อ | - | chk W2.s3, bank ~6 | r3 | add as supplementary section in week 2 |
| 4.6 | การป้องกันสัญญาณรบกวน | W2.s3 (บิดเกลียว, STP, ไฟเบอร์), W5.s1 | เต็ม | ถูกต้องระดับปฏิบัติ (ไม่พูดถึง grounding) | d:cable-types, d:utp-anatomy | chk W2.s3, bank ~5 | crimp c6 (QC ระยะคลายเกลียว) | keep |

### บทที่ 5 Transmission of Digital Data and Interfaces

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 5.1 | Digital Data Transmission | ไม่มี | ไม่มี | - | - | 0 | - | add as supplementary section in week 2 |
| 5.2 | Parallel Transmission | มีเฉพาะ r3 | บางส่วน | r3 ถูกต้อง | - | bank ~1 | r3 | add as supplementary section in week 2 |
| 5.3 | Serial Transmission | r3 (USB เป็น serial), W9.s5 เอ่ย USB | บางส่วน | ถูกต้อง | - | bank ~1 | r3 | add as supplementary section in week 2 |
| 5.4 | Transmission Mode (simplex / half / full duplex) | W4.s2 + figure duplex-modes (half vs full), W2.s1; simplex มีเฉพาะ r3 | บางส่วน | ถูกต้อง | - | bank ~4 | w:duplex-modes, r3 | extend in week 4 (เติม simplex และ async/sync) |
| 5.5 | DTE-DCE Interface | ไม่มี | ไม่มี | ล้าสมัยสำหรับงานปัจจุบัน | - | 0 | - | history-only |
| 5.6 | EIA-232 / RS-232 | ไม่มี | ไม่มี | ยังพบใน console port ของ switch/router (ผ่าน USB-serial) | - | 0 | - | history-only (เชื่อมกับ console cable) |
| 5.7 | คุณลักษณะของ EIA-232 | ไม่มี | ไม่มี | ล้าสมัย | - | 0 | - | history-only |
| 5.8 | Null Modem | ไม่มี | ไม่มี | ล้าสมัย (แนวคิดคล้ายสายไขว้ใน W5.s3) | - | 0 | - | history-only |
| 5.9 | High-speed Interface Protocol | W9.s5 เอ่ย USB | บางส่วน | - | - | 0 | - | history-only (ย่อ) |
| 5.10 | Modem | W2.s2 (Modulator-Demodulator, ONU) | บางส่วน | ถูกต้อง เชื่อมกับ ONU/ONT ปัจจุบัน | d:home-network | chk W2.s2, bank ~10 | r3 | keep |
| 5.11 | หลักการทำงานของโมเด็ม | W2.s2 หนึ่งประโยค | บางส่วน | - | - | - | - | history-only |
| 5.12 | อัตราการส่งข้อมูลของโมเด็ม | ไม่มี | ไม่มี | ล้าสมัย | - | 0 | - | history-only |
| 5.13 | Standard Telephone Operations | ไม่มี | ไม่มี | ล้าสมัย | - | 0 | - | history-only |
| 5.14 | Connection Negotiation | ไม่มี | ไม่มี | ล้าสมัย | - | 0 | - | history-only |
| 5.15 | The 56K Digital Modem | ไม่มี | ไม่มี | ล้าสมัย | - | 0 | - | history-only |
| 5.16 | DSL Modems | มีเฉพาะ r3 | บางส่วน | ในไทยถูกแทนด้วย FTTH เกือบหมด | - | bank 0 | r3 | history-only |
| 5.17 | ADSL | r3 (ความหมาย Asymmetric) | บางส่วน | r3 ถูกต้อง แต่ล้าสมัย | - | bank 0 | r3 | history-only |

### บทที่ 6 Transmission Media and Multiplexing

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 6.1 | ปัจจัยที่ส่งผลต่อความเร็วและระยะทาง | W2.s3 ตาราง Category, W4.s3-s5 ระยะต่อมาตรฐาน, W5.s5 100 m | เต็ม | ถูกต้องและทันสมัย (Cat5e-Cat8, 2.5G/5GBASE-T) | d:cable-types, d:ethernet-standards | chk W2.s3, W4.s5, bank ~24 | crimp c5, r6 | keep |
| 6.2 | Conducted Media | W2.s3, W4.s3, W5 | เต็ม | ถูกต้อง มีคำเตือนแสงเลเซอร์ | d:cable-types, d:utp-anatomy, d:connectors | chk W2.s3, W2.s5, bank ~79 | crimp c1-c7, w:pinout-viewer, r2, r6 | keep |
| 6.3 | Wireless Media | W2.s4, W6.s3 | เต็ม | ถูกต้อง | d:wifi-bands | chk W2.s4, bank ~15 | w:wifi-interference, r2 | keep |
| 6.4 | การพิจารณาสื่อกลาง | W2.s3 (โจทย์โรงงาน), W4.s5 note "ถาม 3 ข้อ" | เต็ม | ถูกต้อง | - | chk W2.s3 | ไม่มี widget เลือกสาย | keep (ต้องการ widget เลือกสาย) |
| 6.5 | Multiplexing (FDM, TDM, WDM) | ไม่มีในบทเรียน (W6.s2 เอ่ย OFDMA), r2 มี 3 ข้อ | บางส่วน | r2 ถูกต้อง | - | bank 0 | r2 | add as supplementary section in week 2 (+ animation) |

### บทที่ 7 Error Detection, Flow Control and Error Control

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 7.1 | Types of Errors (single-bit, burst) | มีเฉพาะ r7 | บางส่วน | r7 ถูกต้อง | - | bank 0 | r7 | add as supplementary section in week 4 |
| 7.2 | Error Detection Methods (parity, checksum, CRC) | W4.s1 (FCS/CRC ในเฟรม), W16.s2 (hash/checksum) เอ่ยผ่าน, r7 parity 4 ข้อ | บางส่วน | ถูกต้อง | - | bank ~3 | r7 | add as supplementary section in week 4 (+ parity/CRC widget) |
| 7.3 | Flow Control (stop-and-wait, sliding window) | มีเฉพาะ r7 | บางส่วน | r7 ถูกต้อง | - | bank 0 | r7 | add as supplementary section in week 4 |
| 7.4 | Error Control | W3.s3 (TCP ตอบรับและส่งซ้ำ) หนึ่งประโยค | บางส่วน | ถูกต้อง | - | bank ~2 | r7 | add as supplementary section in week 4 |
| 7.5 | Error Correction via Retransmission (ARQ) | มีเฉพาะ r7 | บางส่วน | r7 ถูกต้อง | - | bank 0 | r7 | add as supplementary section in week 4 |

### บทที่ 8 Wired LANs: Ethernet

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 8.1 | Project 802 | W3.s6 ตาราง 802.x | เต็ม | ถูกต้อง ระบุ 802.5/802.16 ว่าเลิกใช้/พบน้อย | - | chk W3.s6, bank ~24 (802.x) | - | keep |
| 8.2 | IEEE 802 Frame Formats | W4.s1 ตารางเฟรม Ethernet (64-1518 B, 802.1Q) | บางส่วน | ถูกต้อง ไม่มี LLC header / Ethernet II vs 802.3 | - | 0 | - | extend in week 4 |
| 8.3 | MAC Methods | W4.s1 Token Passing, W4.s2 CSMA/CD, note CSMA/CA | เต็ม | ถูกต้อง ระบุว่า full duplex ไม่ใช้ CSMA/CD | d:network-devices | chk W4.s2, bank CSMA/CD ~8 | w:duplex-modes, w:hub-switch-sim | keep |
| 8.4 | NIC and MAC Address | W2.s1 (48 บิต), W8.s5 (Physical Address) | เต็ม | ถูกต้อง | d:network-adapter, d:ipconfig-output | chk W8.s5, bank ~21 | terminal m3, m9, r6 | keep |
| 8.5 | Baseband and Broadband | W4.s2 | เต็ม | ถูกต้อง | - | chk W4.s2, bank ~2 | - | keep |
| 8.6 | ประวัติอีเทอร์เน็ต | W4.s1 (Xerox PARC, DIX) | เต็ม | ถูกต้อง | d:ethernet-standards | - | - | keep |
| 8.7 | IEEE 802.3 | W4.s1-s5 | เต็ม | ถูกต้อง | d:ethernet-standards | chk W4.s4, W4.s5, bank ~24 | r6 | keep |
| 8.8 | How Ethernet works | W4.s2 CSMA/CD, W2.s1 switch MAC learning | เต็ม | ถูกต้อง | d:network-devices | chk W2.s1, W4.s2 | w:hub-switch-sim (ตาราง MAC), w:duplex-modes | keep |
| 8.9 | Implementation of Ethernet (10BASE5/2/T, 100BASE, 1000BASE) | W4.s3-s5 | เต็ม | ถูกต้อง (ระบุ 185 m ของ 10BASE2) | d:cable-types, d:ethernet-standards | chk W4.s3-s5, bank ~24 | r6 | keep |
| 8.10 | Other Ethernet Networks (10G ขึ้นไป) | W4.s5 ย่อหน้าท้าย (2.5G/5G/10G+) | บางส่วน | ถูกต้อง | d:ethernet-standards | 0 | - | keep (อาจเติมตาราง) |
| 8.11 | Token Bus IEEE 802.4 | ไม่มี (มีแค่เป็นตัวลวงใน r6) | ไม่มี | ล้าสมัย | - | 0 | - | history-only |
| 8.12 | Token Ring IEEE 802.5 | W4.s1, W1.s5, W3.s6 | เต็ม | ถูกต้อง ระบุว่าเลิกใช้ | d:topologies | chk W4.s1, W3.s6, bank ~8 | r6 | history-only (คงไว้) |
| 8.13 | FDDI | W4.s1 | เต็ม | ถูกต้อง ระบุว่าเลิกใช้ | - | chk W4.s1, bank ~2 | - | history-only (คงไว้) |

### บทที่ 9 Wireless LANs

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 9.1 | Wireless LAN Networking Basics | W6.s1, W6.s4, W7.s1 (Ad-Hoc/BSS/ESS) | เต็ม | ถูกต้อง | d:wifi-modes, d:wlan-devices | chk W6.s1, W7.s1, bank ~67 (Wi-Fi) | topology t6, w:ap-placement, r8 | keep |
| 9.2 | Wi-Fi | W6.s1-s2 (Wi-Fi Alliance, ชื่อรุ่น) | เต็ม | ถูกต้อง | d:wifi-generations | chk W6.s2, bank ~3 | r8 | keep |
| 9.3 | Wireless LAN Standards | W6.s2-s3 (802.11b ถึง 802.11be, 2.4/5/6 GHz) | เต็ม | ทันสมัย (มี Wi-Fi 7) ควรตรวจตัวเลข "ราว 23 Gbps ต่อย่าน" ของ Wi-Fi 7 (แหล่งทั่วไปอ้างสูงสุดราว 46 Gbps) | d:wifi-bands, d:wifi-generations | chk W6.s2, W6.s3, bank ~17 | w:wifi-interference, w:bandwidth-calc | keep (ตรวจตัวเลข Wi-Fi 7) |
| 9.4 | MAC Sublayer (DCF, RTS/CTS, hidden node) | ไม่มี | ไม่มี | - | - | 0 | - | add as supplementary section in week 6 |
| 9.5 | CSMA/CA | note ใน W3.s6, W4.s2, W6 | บางส่วน | ถูกต้อง แต่มีแค่หนึ่งประโยค | - | bank ~4 | r8 (1 ข้อ) | add as supplementary section in week 6 |

### บทที่ 10 TCP/IP and Internet

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 10.1 | Brief History of Internet | W3.s3 (ARPANET ในตาราง) | บางส่วน | ถูกต้อง | - | 0 | - | history-only (supplementary week 3) |
| 10.2 | Internetworking | W2.s2 Router, W13.s4 routing table | บางส่วน | ถูกต้อง | d:routing-decision | chk W2.s2 | w:route-lookup, topology t3, t4 | extend in week 3 |
| 10.3 | Network Layer | W3.s2, W3.s4, W13.s4 | เต็ม | ถูกต้อง | d:osi-tcpip, d:routing-decision | chk W3.s4 | w:route-lookup, w:packet-journey | keep |
| 10.4 | IPv4 Addressing | W3.s5, W8.s3 | เต็ม | ถูกต้อง | d:ip-classes, d:windows-ip-settings | chk W3.s5, W8.s3, bank ~25 (subnet) | w:ip-calc, w:nic-config, topology t1, subnet s1-s5, r5 | keep |
| 10.5 | Binary and Dotted Decimal Notation | W3.s5 (32 บิต 4 octet) | บางส่วน | ถูกต้อง แต่ไม่มีวิธีแปลงฐาน | - | bank ~3 | r5 (192 เป็นฐานสอง) | add as supplementary section in week 8 (+ binary widget) |
| 10.6 | Classful Addressing | W3.s5 (ระบุว่า "ในอดีต") | เต็ม | ถูกต้อง แยกอดีต/ปัจจุบัน | d:ip-classes | chk W3.s5, bank ~11 | subnet s1, r5 | keep |
| 10.7 | Subnetting | ไม่มีข้อความอธิบาย มีเฉพาะ caption ของ w:subnet-splitter ใน W3.s5, W8.s3 | บางส่วน | - | - | bank ~25 (คำว่า subnet) | w:subnet-splitter, subnet s6-s10 | add as supplementary section in week 8 (ทีละขั้น) |
| 10.8 | Three Levels of Hierarchy (network / subnet / host) | ไม่มี | ไม่มี | - | - | 0 | - | add as supplementary section in week 8 |
| 10.9 | Subnet Mask | W8.s3, W3.s5 | เต็ม | ถูกต้อง | d:windows-ip-settings | chk W8.s3, bank ~19 | w:ip-calc, subnet s4, r5 | keep |
| 10.10 | Classless Addressing | W3.s5 เอ่ย 2 ครั้ง | บางส่วน | ถูกต้อง | - | bank ~3 | subnet s3, s8 | add as supplementary section in week 8 |
| 10.11 | CIDR Notation | W3.s5 (/n ในตัวอย่าง) | บางส่วน | ถูกต้อง | - | bank ~3 | w:ip-calc, subnet s3, s8, r5 | add as supplementary section in week 8 |
| 10.12 | การคำนวณหาแอดเดรสซับเน็ต | W3.s5 (สูตร 2^n-2) | บางส่วน | ถูกต้อง แบบฝึกครบแต่คำอธิบายบาง | - | chk W3.s5 | subnet s1-s10 (สุ่มโจทย์), r5 VM | add as supplementary section in week 8 |
| 10.13 | Software for IP Subnet Calculator | W3.s5, W8.s3 | เต็ม | ถูกต้อง | - | - | w:ip-calc, w:subnet-splitter | keep |
| 10.14 | Private IP Network | W3.s5 RFC 1918 + APIPA | เต็ม | ถูกต้อง | d:home-network | chk W3.s5, bank ~3 | r5 | keep |
| 10.15 | NAT | W3.s5, W2.s2 เอ่ยผ่าน, W12.s4 (NAT mode ของ VM) | บางส่วน | ถูกต้อง ไม่มี PAT / ตารางแปลงพอร์ต | d:home-network, d:vm-netmodes | chk W12.s4 (โหมด VM), bank ~13 | w:vm-netmode, topology t3 (NAT แฝง), r5 | add as supplementary section in week 8 |
| 10.16 | Other Protocols in the Network Layer (ICMP, ARP, IGMP) | W13.s4-s5 (ping/ICMP, arp) | บางส่วน | ถูกต้อง ไม่มี IGMP | d:cmd-outputs | chk W13.s5, bank ~12 | terminal m3, m8, m9, troubleshoot x6, r10 | extend in week 13 |
| 10.17 | IPv6 | W3.s5 สองย่อหน้า | บางส่วน | ถูกต้อง | - | ไม่มี chk, bank 3 | w:ipv6-tool, r5 (2 ข้อ) | add as supplementary section in week 3 |
| 10.18 | IPv6 Datagram Format | ไม่มี | ไม่มี | - | - | 0 | - | add as supplementary section in week 3 |
| 10.19 | IPv6 Base Header Format | ไม่มี | ไม่มี | - | - | 0 | - | add as supplementary section in week 3 |
| 10.20 | IPv6 Addressing | W3.s5 ตารางประเภท (::1, fe80::/10, 2000::/3, fc00::/7, ff00::/8) | เต็ม | ถูกต้องและทันสมัย | - | bank 3 | w:ipv6-tool | keep |
| 10.21 | IPv6 Colon Hexadecimal Notation | W3.s5 (กฎย่อ, :: ใช้ได้ครั้งเดียว) | เต็ม | ถูกต้อง | - | bank ~5 | w:ipv6-tool, r5 | keep |

### บทที่ 11 Transport and Application Layer Protocols

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 11.1 | Transport Layer | W3.s2-s4 | บางส่วน | ถูกต้อง | d:tcp-vs-udp | chk W3.s4 | r4 | add as supplementary section in week 3 |
| 11.2 | Process-to-Process Delivery | W10.s5, W13.s5 (พอร์ต, netstat) | บางส่วน | ถูกต้อง ไม่มีแนวคิด socket (IP+port) | - | bank ~2 | w:port-lookup, terminal m6, m10, r4 | add as supplementary section in week 3 |
| 11.3 | Client/Server Paradigm | W1.s4, W10.s1 | เต็ม | ถูกต้อง | d:p2p-vs-cs | chk W1.s4, bank ~10 | r1 | keep |
| 11.4 | Addressing (port numbers) | W10.s5 ตารางพอร์ต, W13.s5, W16.s6 | บางส่วน | ถูกต้อง ไม่มีช่วง well-known / registered / ephemeral | - | chk W16.s6 | w:port-lookup, w:firewall-tester, r4 | extend in week 13 |
| 11.5 | UDP, TCP and SCTP | W3.s3 หนึ่งย่อหน้า; 3-way handshake มีเฉพาะ r4; ไม่มี SCTP | บางส่วน | ถูกต้อง | d:tcp-vs-udp | bank TCP ~20, UDP ~9 | terminal m6, m10 (สถานะ LISTENING/ESTABLISHED), r4 | add as supplementary section in week 3 (SCTP กล่าวสั้น ๆ, เพิ่ม QUIC) |
| 11.6 | Application Layer | W3.s3, W10.s5 (HTTP/DNS/DHCP/SMTP) | เต็ม | ถูกต้อง | d:dns-lookup, d:dhcp-dora | chk W10.s5, bank DNS ~53, DHCP ~38 | topology t5, t7, terminal m4, m5, troubleshoot x5, x7, x10 | keep |

### บทที่ 12 Network Security and Cryptography

| # | หัวข้อในหนังสือ | ตำแหน่งใน NetLab | coverage | ถูกต้อง/ทันสมัย | figure | แบบฝึก | hands-on | ข้อเสนอแนะ |
|---|---|---|---|---|---|---|---|---|
| 12.1 | Basic Security Measures | W16.s1-s4 (หลายชั้น, ซอฟต์แวร์, นโยบาย, 3-2-1) | เต็ม | ถูกต้องและทันสมัย | d:defense-layers, d:backup-321 | chk W16.s2-s4, bank ~35 | w:control-picker, w:backup-321, r11 | keep |
| 12.2 | System Attacks Method | W15.s1-s5 (malware, phishing, sniffing, MITM, DoS) | เต็ม | ถูกต้อง มีคำเตือน พ.ร.บ.คอมพิวเตอร์ | d:malware-types, d:defense-layers | chk W15.s1-s5, bank ~20 | w:threat-sorter, r11 | keep |
| 12.3 | Basic Encryption and Decryption Techniques | W15.s5 (การเข้ารหัสป้องกัน sniffing), W16.s2 (CIA) | บางส่วน | ถูกต้อง ไม่มีทฤษฎี substitution/transposition หรือ symmetric key | - | bank ~34 (คำว่าเข้ารหัส) | w:caesar, r11 (2 ข้อ) | add as supplementary section in week 16 |
| 12.4 | Public Key Cryptography | มีเฉพาะ r11 (1 ข้อ) | บางส่วน | r11 ถูกต้อง | - | bank 0 | r11 | add as supplementary section in week 16 |
| 12.5 | Digital Signatures | W15.s5 (ใบรับรองใน HTTPS), W16.s2 (hash) เอ่ยผ่าน, r11 (1 ข้อ) | บางส่วน | ถูกต้อง | - | bank ~1 | r11 | add as supplementary section in week 16 |
| 12.6 | PGP | มีเฉพาะ r11 (1 ข้อ) | บางส่วน | ยังใช้ได้แต่เฉพาะกลุ่ม ปัจจุบันนิยม S/MIME และ end-to-end encryption ในแอปแชต | - | bank 0 | r11 | history-only (ย่อในหัวข้อ public key) |
| 12.7 | Firewall | W16.s5-s6 (ฮาร์ดแวร์/ซอฟต์แวร์, Windows Defender Firewall) | เต็ม | ถูกต้องและทันสมัย | d:firewall, d:firewall-profiles | chk W16.s5, W16.s6, bank ~23 | w:firewall-tester, r11 | keep |

---

## 1. สรุปรายบท

coverage % = (เต็ม + 0.5 x บางส่วน) / จำนวนหัวข้อ

| บท | หัวข้อ | เต็ม | บางส่วน | ไม่มี | coverage | ช่องว่างหลัก |
|---|---|---|---|---|---|---|
| 1 พื้นฐาน | 15 | 7 | 6 | 2 | 67% | Three characteristics, Network criteria, de facto/de jure, กระบวนการมาตรฐาน, โครงสร้างอินเทอร์เน็ต |
| 2 Network Models | 7 | 4 | 2 | 1 | 71% | เหตุผลของการแบ่งชั้น, peer-to-peer processes, การจัดกลุ่มชั้น |
| 3 Topologies/LAN | 8 | 4 | 2 | 2 | 63% | Line configuration, Switching (circuit/packet), เทคโนโลยี MAN/WAN ปัจจุบัน |
| 4 Data and Signals | 6 | 1 | 3 | 2 | 42% | ลักษณะสัญญาณ, การแปลงข้อมูลเป็นสัญญาณ, impairment 3 ชนิด, baud |
| 5 Digital Transmission | 17 | 0 | 8 | 9 | 24% | ทั้งบท ส่วนใหญ่ควรเป็น history-only (RS-232, modem, DSL); serial/parallel และ transmission mode ควรมีบทเรียน |
| 6 Media/Multiplexing | 5 | 4 | 1 | 0 | 90% | Multiplexing ไม่มีในบทเรียน (มีแค่ r2) |
| 7 Error/Flow Control | 5 | 0 | 5 | 0 | 50% | ไม่มีบทเรียนเลย มีเฉพาะห้อง r7 |
| 8 Ethernet | 13 | 10 | 2 | 1 | 85% | รูปแบบเฟรม 802.2 LLC, Token Bus |
| 9 Wireless LANs | 5 | 3 | 1 | 1 | 70% | MAC sublayer, กลไก CSMA/CA |
| 10 TCP/IP | 21 | 8 | 10 | 3 | 62% | คำอธิบาย subnetting ทีละขั้น, ลำดับชั้น 3 ระดับ, CIDR, NAT/PAT, IPv6 header |
| 11 Transport/Application | 6 | 2 | 4 | 0 | 67% | TCP vs UDP เชิงลึก, 3-way handshake, ช่วงพอร์ต, SCTP |
| 12 Security | 7 | 3 | 4 | 0 | 71% | การเข้ารหัสแบบ symmetric/public key, digital signature (มีแค่ r11) |
| **รวม** | **115** | **46** | **48** | **21** | **61%** | |

ข้อสังเกต: บท 4, 5, 7 (ชั้น Physical/Data Link เชิงทฤษฎี) ไม่อยู่ในแผน 21910-2013 โดยตรง จึงมีเฉพาะในห้องฝึก r3, r7, r2 ส่วนบท 6, 8 ครอบคลุมดีเพราะตรงกับ W2, W4, W5 ของแผน ไม่พบเนื้อหาที่ผิดทางเทคนิค มีเพียงจุดควรตรวจ คือตัวเลขความเร็ว Wi-Fi 7 ใน W6.s2 และควรเติม IETF ในตารางองค์กรมาตรฐาน W3.s1

## 2. เนื้อหา NetLab ที่หนังสือไม่มี แต่แผน 21910-2013 กำหนด (คงไว้ทั้งหมด)

| เรื่อง | ตำแหน่ง | hands-on ที่มีอยู่ |
|---|---|---|
| การเข้าหัว UTP, T568A/B, สายตรง/ไขว้, Auto MDI-X, การทดสอบสาย, ระยะ 100 m | W5.s1-s5 | crimp c1-c7, w:pinout-viewer, w:crimp-steps, r6 |
| ตั้งค่าความปลอดภัย Wi-Fi (SSID, MAC filter, WEP-WPA3, WPS, Guest) | W7.s2-s6 | w:wifi-security-check, troubleshoot x2, r8 |
| ชื่อเครื่อง, Workgroup/Domain, ตั้ง IP Static/DHCP ใน Windows, ipconfig | W8.s1-s5 | w:nic-config, terminal m1, m2, r9 |
| การแชร์โฟลเดอร์/เครื่องพิมพ์, UNC, Map drive, net share, Share vs NTFS | W9.s1-s6 | w:share-ntfs, troubleshoot x9, x11, r9 |
| ระบบปฏิบัติการเครือข่าย (NOS): ความหมาย บริการ NetWare/UNIX/Linux/Windows Server | W10, W11.s1-s2 | w:port-lookup, r9 |
| Virtual Machine: Hypervisor Type 1/2, VirtualBox/VMware, VT-x, ติดตั้ง NOS, โหมดเครือข่าย VM, Snapshot | W11.s3-s6, W12 | w:vm-netmode, w:snapshot-restore, Linux VM (v86) ใน r5, r9-r12, w11 |
| ออกแบบเครือข่าย, structured cabling, Rack/Patch panel | W13.s1-s3 | topology t2, d:rack-layout, d:structured-cabling |
| เครื่องมือตรวจสอบ: ipconfig, ping, tracert, netstat, nslookup, arp, ip/ss | W13.s4-s5, W14 | terminal m1-m11, w:ping-ladder, w:gateway-dns-fault, r10 |
| วิธีแก้ปัญหา (bottom-up, APIPA, IP ซ้ำ, DNS), ซอฟต์แวร์ remote control | W14.s1-s5 | troubleshoot x1-x13, r10 |
| Antivirus/Defender, backup 3-2-1, นโยบายหน่วยงาน, Windows Defender Firewall profiles/rules | W16 | w:backup-321, w:control-picker, w:firewall-tester |
| บัญชีผู้ใช้และกลุ่ม: Computer Management, net user, net localgroup, Administrator/Guest | W17 | r12 (VM) |
| สิทธิ์: Give access to, Share+NTFS, Least Privilege, การปิดบัญชี, Linux rwx/chmod | W18 | w:share-ntfs, w:perm-calc, r12 |
| มาตรฐานและอุปกรณ์ WLAN ปัจจุบัน (Wi-Fi 6E/7, mesh, เสาอากาศ, กสทช.) | W6 | w:ap-placement, w:wifi-interference |

## 3. แล็บรายสัปดาห์ที่ครูต้องการ เทียบกับสิ่งที่มีอยู่

หมายเหตุ: เลขสัปดาห์ในรายการของครูเรียงตามหนังสือ ไม่ตรงกับเลขสัปดาห์ของแผน 21910-2013 ทุกสัปดาห์

| สัปดาห์ (ตามที่ครูต้องการ) | มีอยู่แล้ว | ยังขาด |
|---|---|---|
| W1 สำรวจอุปกรณ์ในแล็บ, PC 2 เครื่อง + switch, ระบุ sender/receiver/medium/protocol | topology t1, t8 (โหมดทีละขั้น); d:lab-room-network, d:device-ports; chk W1.s2; r1 | กิจกรรมโต้ตอบ "ระบุ 5 องค์ประกอบ" บนภาพหรือ sim (ตอนนี้มีแค่คำถาม) |
| W2 encapsulation ทีละชั้น, คลิกส่วนของ packet, อุปกรณ์ประจำชั้น | w:encap-stepper, w:packet-journey, w:osi-explorer, d:encapsulation; r4 (อุปกรณ์ต่อชั้น) | widget ให้คลิก field ของ header (MAC/IP/port) ในเฟรมจริง |
| W3 canvas ลากวาง, star, ถอดสาย/ปิด switch, hub vs switch | topology sim (ลากวาง ต่อ/ลบสาย), w:topology-sim (ตัดสาย, ปิด switch), w:topology-cost, w:hub-switch-sim | ปิดเครื่อง/ปิด switch ใน topology sim (ตอนนี้ hub ถูกแปลงเป็น switch ใน netsim) |
| W4 waveform amplitude/frequency, analog vs digital, noise, attenuation | ไม่มี (มีแค่คำถามใน r3) | ทั้งหมด: widget waveform, analog/digital, เพิ่ม noise และ attenuation ตามระยะ |
| W5 serial/parallel bits, transmission modes, terminal communication, interface mismatch | w:duplex-modes (half vs full), terminal sim (CLI); r3 | animation serial/parallel, simplex, การสื่อสารแบบ serial terminal/console, สถานการณ์ interface mismatch (เช่น duplex/speed mismatch) |
| W6 เลือกสาย, pinout T568A/B, LAN tester, สัญญาณในสื่อ, animation multiplexing | crimp c1-c7 (pinout, tester c4/c7, QC c6), w:pinout-viewer, w:crimp-steps | widget เลือกสายตามสถานการณ์, ภาพสัญญาณในสื่อ (ไฟฟ้า/แสง/คลื่น), animation FDM/TDM/WDM |
| W7 parity, CRC, bit flip, ACK/ส่งซ้ำ, packet loss | r7 (คำถาม parity, CRC, ARQ) | ทั้งหมดในรูป widget: parity/CRC calculator, จำลอง bit flip, stop-and-wait/ARQ, packet loss |
| W8 switch MAC learning, Ethernet frame, ping, broadcast, hub vs switch | w:hub-switch-sim (ตาราง MAC, flood/forward), w:duplex-modes, topology sim ping, terminal m3 (arp) | ตัวแสดงเฟรม Ethernet แบบโต้ตอบ, แสดง MAC table ใน topology sim (netsim มี macTable() แต่ UI ไม่แสดง) |
| W9 ตำแหน่ง AP, SSID, channel, การยืนยันตัวตนปลอดภัย, การเชื่อมต่อ client | w:ap-placement, w:wifi-interference (channel), w:wifi-security-check, topology t6 (SSID), troubleshoot x2, r8 | จำลองการเลือก WPA2/WPA3 และ 802.1X ใน topology sim (ตอนนี้จับคู่แค่ SSID) |
| W10 binary, ตั้ง IP ให้ PC, mask, ipconfig/ip addr, ping วงเดียวกัน, วิเคราะห์ผิดวง | topology t1, t8, w:nic-config, w:ip-calc, terminal m1, m4, subnet s5, w:gateway-dns-fault, r5, r9 | widget แปลงเลขฐานสองแบบฝึกทีละบิต |
| W11 subnetting ทีละขั้น, โจทย์สุ่ม, แผนหลายแผนก, พิสูจน์บนอุปกรณ์จำลอง | subnet s1-s10 (สุ่มโจทย์, VLSM s7/s9), w:subnet-splitter, r5 VM | โหมดทีละขั้นพร้อมคำอธิบาย และการนำแผนจาก subnet sim ไปตั้งค่าใน topology sim ต่อ |
| W12 หลาย subnet + router + gateway, IPv6, NAT/PAT, เส้นทาง packet | topology t3, t4, t8, w:route-lookup, d:routing-decision, w:packet-journey, terminal m5, m8 (tracert/traceroute) | IPv6 ใน topology sim/netsim, ตาราง NAT/PAT ที่มองเห็นได้ |
| W13 TCP vs UDP, loss/latency, สถานะการเชื่อมต่อ | d:tcp-vs-udp, terminal m6, m10 (netstat/ss), r4 (3-way handshake) | widget TCP vs UDP ภายใต้ loss/latency, ไดอะแกรมสถานะ TCP |
| W14 DNS lookup, DHCP lease, nslookup, ทดสอบ web server, แชร์ไฟล์ | topology t5 (DHCP), t7 (DNS), terminal m2, m4, m5, troubleshoot x5, x7, x10, x11, w:share-ntfs, d:dns-lookup, d:dhcp-dora | ภารกิจทดสอบ web server (HTTP/port 80/443) |
| W15 Linux terminal/VM, IP, routing table, DNS, การวินิจฉัย | terminal m4, m7, m8, m10, m11 (Linux), Linux VM (v86) ใน r5, r9-r12, w11, w:vm-netmode, w:snapshot-restore | ครบโดยรวม |
| W16 sandbox firewall, สิทธิ์, เข้ารหัส/ถอดรหัส, ตรวจ certificate, เลือกมาตรการ | w:firewall-tester, w:share-ntfs, w:perm-calc, w:caesar, w:control-picker, w:threat-sorter, r11, r12 | การเข้ารหัสสมัยใหม่ (symmetric/public key), การตรวจ certificate |
| W17 ความผิดพลาดแบบสุ่ม, คำสั่ง, แก้แล้วทดสอบซ้ำ, รายงาน | troubleshoot x1-x13 (แก้แล้วทดสอบซ้ำ), terminal m1-m11, r10 | ความผิดพลาดแบบสุ่ม (สถานการณ์ใน troubleshoot เป็นแบบตายตัว), แบบฟอร์มรายงานผล |
| W18 capstone พร้อม rubric | ไม่มี (ไม่พบ rubric/capstone ใน content, server, public/js) | ทั้งหมด: โจทย์ capstone (ออกแบบ + ตั้งค่า + ทดสอบ) และ rubric |

---

## 4. สถานะหลังเพิ่มเนื้อหาเสริม 2.8

ขอบเขต: ประเมินใหม่เฉพาะหัวข้อที่ตารางหลัก (baseline) ระบุว่า "ไม่มี" หรือ "บางส่วน" เทียบกับ supplementary sections 15 ส่วนใน `content/lessons/extra/w1.js` (x1-x2), `w2.js` (x1-x3), `w3.js` (x1-x2), `w4.js` (x1-x4), `w10.js` (x1-x2), `w16.js` (x1-x2) และ figure ใน `public/js/figs-d.js`, `figs-e.js`, `figs-f.js`, `figs-g.js` ใช้เกณฑ์เดิม: "เต็ม" เมื่อมีย่อหน้า/ตารางอธิบายหัวข้อนั้นจริงใน section, การเอ่ยผ่าน 1-2 ประโยคยังเป็น "บางส่วน" กรณีไม่แน่ใจคงไว้ที่ "บางส่วน" หัวข้อที่ baseline เป็น "เต็ม" อยู่แล้วไม่ได้ประเมินซ้ำ

คำย่อเพิ่มเติม: Wn.xK = supplementary section K ของสัปดาห์ n (แสดงต่อท้ายบทเรียน แต่ไม่นับใน core progress ตาม `server/lessons.js`)

หมายเหตุ: การเติมแถว IETF ในตารางองค์กรมาตรฐาน W3.s1 ปิดข้อเสนอแนะของแถว 1.11 (เดิมเป็น "เต็ม" อยู่แล้ว) ส่วนการปรับ simulator (hub และ collision domain จริง, firewall rule ของ router, รหัสผ่าน/isolation ของ Wi-Fi, capstone mission t9 และ troubleshoot x14 แบบสุ่ม) เพิ่ม hands-on ให้หัวข้อที่เป็น "เต็ม" อยู่แล้ว (เช่น 8.3, 8.8, 12.7) และงานตามแผน 21910-2013 จึงไม่ทำให้สถานะหัวข้อใดในหนังสือเปลี่ยน

### 4.1 หัวข้อที่สถานะเปลี่ยน (46 หัวข้อ)

| # | หัวข้อ | ก่อน | หลัง | ตำแหน่งใหม่ |
|---|---|---|---|---|
| 1.2 | Three Fundamental Characteristics (Delivery/Accuracy/Timeliness, Jitter) | ไม่มี | เต็ม | W1.x1 (ตาราง 4 คุณสมบัติ + chk) + w:jitter-buffer |
| 1.7 | Network Criteria (Performance, Reliability, Security) | บางส่วน | เต็ม | W1.x1 (ย่อหน้า, ตาราง, Throughput vs Bandwidth, ตัวอย่าง, chk 2 ข้อ) |
| 1.9 | Categories of Standards (de facto / de jure) | ไม่มี | เต็ม | W1.x2 (ย่อหน้านิยามพร้อมตัวอย่างทั้งสองแบบ + note TCP/IP) |
| 2.2 | แนวความคิดในการแบ่งชั้นสื่อสาร | บางส่วน | เต็ม | W3.x1 (เหตุผลของการแบ่งชั้น + ตัวอย่างเปลี่ยน Wi-Fi โดยไม่แก้แอป) |
| 2.4 | Peer-to-Peer Processes | บางส่วน | เต็ม | W3.x1 (Interface/Service/Protocol, chk 3 ข้อ) + d:layer-peer |
| 3.1 | Line Configuration (point-to-point / multipoint) | ไม่มี | เต็ม | W1.x2 + d:line-config, chk |
| 3.8 | Switching (circuit / packet / message) | ไม่มี | เต็ม | W1.x2 (ตารางเทียบ 3 แบบ, Datagram/Virtual Circuit, Store-and-Forward, chk) + w:switching-lab |
| 4.1 | Analog Versus Digital | บางส่วน | เต็ม | W2.x1 (ตารางข้อมูล/สัญญาณ analog-digital 4 แบบ) |
| 4.2 | Fundamentals of Signals | ไม่มี | เต็ม | W2.x1 (amplitude, period, frequency, phase, wavelength, bandwidth) + d:signal-anatomy, w:signal-lab (แท็บแอนะล็อก) |
| 4.3 | หน่วยวัดความเร็วในการส่งข้อมูล (bps, Bps, baud) | บางส่วน | เต็ม | W2.x1 (Bit rate vs Baud rate, ตาราง L ระดับ, chk 2 ข้อ) |
| 4.4 | Converting Data into Signals (line coding, ASK/FSK/PSK/QAM) | ไม่มี | เต็ม | W2.x2 (NRZ-L, NRZ-I, Manchester, ตาราง ASK/FSK/PSK/QAM) + w:signal-lab |
| 4.5 | Transmission Impairment (attenuation, distortion, noise) | บางส่วน | เต็ม | W2.x2 (3 ชนิด, dB, SNR, Shannon, chk) + w:signal-lab (ระยะสาย/noise/repeater) |
| 5.1 | Digital Data Transmission | ไม่มี | เต็ม | W4.x1 + d:serial-parallel |
| 5.2 | Parallel Transmission | บางส่วน | เต็ม | W4.x1 (Skew, Crosstalk, ตารางเทียบ) + d:serial-parallel |
| 5.3 | Serial Transmission | บางส่วน | เต็ม | W4.x1 (Asynchronous 8N1/UART vs Synchronous, chk) + d:serial-parallel, w:serial-terminal |
| 5.4 | Transmission Mode (simplex / half / full duplex) | บางส่วน | เต็ม | W4.x1 (เติม Simplex) ร่วมกับ W4.s2 เดิม + d:serial-parallel |
| 5.5 | DTE-DCE Interface | ไม่มี | เต็ม | W4.x2 (term DTE/DCE) + d:dte-dce-console |
| 5.6 | EIA-232 / RS-232 | ไม่มี | เต็ม | W4.x2 (ประวัติ, พอร์ตคอนโซล, ขั้นตอน PuTTY 9600 8N1, chk) + w:serial-terminal |
| 5.7 | คุณลักษณะของ EIA-232 | ไม่มี | เต็ม | W4.x2 (ตารางหัวต่อ, ระดับแรงดัน, ระยะ, ความเร็ว, ขา DB-9, chk multi) |
| 5.8 | Null Modem | ไม่มี | บางส่วน | W4.x2 (2 ประโยค: ไขว้ TXD/RXD เทียบสายไขว้ Ethernet) |
| 5.10 | Modem | บางส่วน | เต็ม | W4.x2 (ย่อหน้าโมเด็มและ Dial-up) + W2.x2 (Modulation/Demodulation) |
| 5.11 | หลักการทำงานของโมเด็ม | บางส่วน | เต็ม | W2.x2 (ตาราง ASK/FSK/PSK/QAM บนคลื่นพาห์) + W4.x2 |
| 5.12 | อัตราการส่งข้อมูลของโมเด็ม | ไม่มี | บางส่วน | W4.x2 (ตัวเลข 56K/33.6K, ADSL) + W2.x1 (chk โมเด็ม 8 ระดับ 2,400 baud) ยังไม่มีตารางมาตรฐาน V-series |
| 5.13 | Standard Telephone Operations | ไม่มี | บางส่วน | W1.x2 (PSTN แบบ Circuit Switching: setup/teardown) ไม่มีขั้นตอนโทรศัพท์ (dial tone, ringing) |
| 5.14 | Connection Negotiation | ไม่มี | บางส่วน | W4.x2 (1 ประโยค: โมเด็มโทรออกและเจรจาความเร็ว) |
| 5.15 | The 56K Digital Modem | ไม่มี | เต็ม | W4.x2 (V.90/V.92, เหตุที่ขาลง 56K ขาขึ้น 33.6/48K) |
| 5.16 | DSL Modems | บางส่วน | เต็ม | W4.x2 (DSL บนคู่สายเดิม, Splitter, DSLAM, เทียบ FTTH) + d:dte-dce-console (ADSL vs FTTH) |
| 5.17 | ADSL | บางส่วน | เต็ม | W4.x2 (Asymmetric, ADSL/ADSL2+, ระยะชุมสาย, chk) + W2.x3 (ADSL เป็น FDM) |
| 6.5 | Multiplexing (FDM, TDM, WDM) | บางส่วน | เต็ม | W2.x3 (FDM, Synchronous/Statistical TDM, WDM/CWDM/DWDM, GPON, chk 3 ข้อ) + d:mux-types, w:mux-lab |
| 7.1 | Types of Errors (single-bit, burst) | บางส่วน | เต็ม | W4.x3 (term + ย่อหน้า Burst error) |
| 7.2 | Error Detection Methods (parity, checksum, CRC) | บางส่วน | เต็ม | W4.x3 (Parity, 2D parity, Internet checksum, CRC-32, ตารางเทียบ, chk 3 ข้อ) + w:error-lab |
| 7.3 | Flow Control (stop-and-wait, sliding window) | บางส่วน | เต็ม | W4.x4 (ประสิทธิภาพ Tf/(Tf+2Tp), Sliding Window) + w:arq-lab |
| 7.4 | Error Control | บางส่วน | เต็ม | W4.x4 (ACK/NAK/Timer/Sequence number, ชั้นที่ทำจริง: TCP, Wi-Fi, Ethernet) |
| 7.5 | Error Correction via Retransmission (ARQ) | บางส่วน | เต็ม | W4.x4 (Stop-and-Wait, Go-Back-N, Selective Repeat, ตารางเทียบ, chk 3 ข้อ) + w:arq-lab |
| 9.4 | MAC Sublayer (DCF, RTS/CTS, hidden node) | ไม่มี | บางส่วน | W4.x4 (1 ประโยค: Wi-Fi ใช้ ACK ระดับ Data Link และส่งซ้ำ) ไม่มี DCF, RTS/CTS, hidden node |
| 10.17 | IPv6 | บางส่วน | เต็ม | W3.x2 (header, Extension Header, NDP, ICMPv6) ร่วมกับ W3.s5 เดิม |
| 10.18 | IPv6 Datagram Format | ไม่มี | เต็ม | W3.x2 (Base Header + Extension Header chain, ตารางเทียบ IPv4, chk) + d:ipv6-ext-headers |
| 10.19 | IPv6 Base Header Format | ไม่มี | เต็ม | W3.x2 (ตาราง 8 ฟิลด์ 40 ไบต์, chk Hop Limit) + d:ipv6-header |
| 11.1 | Transport Layer | บางส่วน | เต็ม | W10.x1 (Host-to-Host vs Process-to-Process) + W10.x2 |
| 11.2 | Process-to-Process Delivery | บางส่วน | เต็ม | W10.x1 (Socket, Multiplexing/Demultiplexing, ตัวอย่าง ss -tan, chk) + d:socket-demux |
| 11.4 | Addressing (port numbers) | บางส่วน | เต็ม | W10.x1 (ตาราง Well-known/Registered/Ephemeral ตาม RFC 6335, chk 3 ข้อ) |
| 11.5 | UDP, TCP and SCTP | บางส่วน | เต็ม | W10.x2 (ส่วนหัว UDP, seq/ack, Flow/Congestion control, 3-way handshake, สถานะ TCP, SCTP, ตารางเทียบ 3 โปรโตคอล) + d:tcp-states, w:transport-lab |
| 12.3 | Basic Encryption and Decryption Techniques | บางส่วน | เต็ม | W16.x1 (Substitution/Transposition, Symmetric DES/AES, Key Distribution Problem, Hash vs Encryption) + w:crypto-lab |
| 12.4 | Public Key Cryptography | บางส่วน | เต็ม | W16.x2 (Key Pair, RSA/ECC, Hybrid, ตารางการใช้กุญแจ) + d:pki-flow |
| 12.5 | Digital Signatures | บางส่วน | เต็ม | W16.x2 (ขั้นตอนลงนาม/ตรวจ, Integrity/Authentication/Non-repudiation, ใบรับรอง X.509, chk) + d:pki-flow, w:crypto-lab, w:cert-inspector |
| 12.6 | PGP | บางส่วน | เต็ม | W16.x2 (ย่อหน้า PGP/OpenPGP RFC 9580, Web of Trust, เทียบ S/MIME) |

### 4.2 สรุปรายบทหลัง 2.8

coverage % = (เต็ม + 0.5 x บางส่วน) / จำนวนหัวข้อ (สูตรเดียวกับ baseline ปัดเศษ 0.5 ขึ้น)

| บท | หัวข้อ | เต็ม | บางส่วน | ไม่มี | coverage | ช่องว่างหลัก |
|---|---|---|---|---|---|---|
| 1 พื้นฐาน | 15 | 10 | 5 | 0 | 83% (เดิม 67%) | นิยาม Telecommunication ยังสั้น, sneakernet, กระบวนการกำหนดมาตรฐาน, แนวคิด internetwork, โครงสร้าง ISP/IXP |
| 2 Network Models | 7 | 6 | 0 | 1 | 86% (เดิม 71%) | การจัดกลุ่มชั้น network-support / user-support |
| 3 Topologies/LAN | 8 | 6 | 2 | 0 | 88% (เดิม 63%) | เทคโนโลยี MAN/WAN ปัจจุบัน (Metro Ethernet, leased line, MPLS, 4G/5G) |
| 4 Data and Signals | 6 | 6 | 0 | 0 | 100% (เดิม 42%) | - |
| 5 Digital Transmission | 17 | 12 | 5 | 0 | 85% (เดิม 24%) | Null modem, high-speed interface, อัตรามาตรฐานโมเด็ม, การทำงานโทรศัพท์และการเจรจาของโมเด็ม (ส่วนใหญ่ history-only) |
| 6 Media/Multiplexing | 5 | 5 | 0 | 0 | 100% (เดิม 90%) | - |
| 7 Error/Flow Control | 5 | 5 | 0 | 0 | 100% (เดิม 50%) | - |
| 8 Ethernet | 13 | 10 | 2 | 1 | 85% (ไม่เปลี่ยน) | รูปแบบเฟรม 802.2 LLC, ตาราง 10G ขึ้นไป, Token Bus |
| 9 Wireless LANs | 5 | 3 | 2 | 0 | 80% (เดิม 70%) | DCF, RTS/CTS, hidden node, กลไก CSMA/CA |
| 10 TCP/IP | 21 | 11 | 9 | 1 | 74% (เดิม 62%) | คำอธิบาย subnetting ทีละขั้น, ลำดับชั้น 3 ระดับ, CIDR/classless, NAT/PAT, IGMP |
| 11 Transport/Application | 6 | 6 | 0 | 0 | 100% (เดิม 67%) | - |
| 12 Security | 7 | 7 | 0 | 0 | 100% (เดิม 71%) | - |
| **รวม** | **115** | **87** | **25** | **3** | **87%** (เดิม 61%) | |

ข้อสังเกต: เนื้อหาเสริม 2.8 ปิดช่องว่างของบท 4, 5, 7 ซึ่งเดิมมีเฉพาะห้องฝึก r3, r7 ได้เกือบหมด ช่องว่างใหญ่ที่เหลืออยู่ในบท 10 (กลุ่ม subnetting/CIDR/NAT ซึ่ง baseline แนะนำให้เติมเป็น supplementary ของสัปดาห์ 8 แต่ 2.8 ยังไม่มี `extra/w8.js`) และบท 9 (ยังไม่มี `extra/w6.js`)

### 4.3 หัวข้อที่ยังไม่ครอบคลุม

ยัง "ไม่มี" 3 หัวข้อ และ "บางส่วน" 25 หัวข้อ:

- 1.3 Telecommunication (บางส่วน): W1.x1 มีย่อหน้านิยามเทียบกับ Data Communication แต่ยังสั้น ไม่มีองค์ประกอบระบบโทรคมนาคม ถือว่าพอสำหรับระดับ ปวช. ถ้าต้องการเต็มให้ขยายเป็นตาราง/ตัวอย่างใน W1.x1
- 1.5 ก่อนจะเป็นเครือข่าย (บางส่วน): history-only ตั้งใจไม่ขยาย มีประโยคเปิดใน guide/w1 อยู่แล้ว
- 1.10 กระบวนการกำหนดมาตรฐาน (บางส่วน): มีเพียงการอ้าง RFC/IETF (W1.x2 note, แถว IETF ใน W3.s1) ยังไม่อธิบายขั้นตอน IEEE Working Group หรือ Internet-Draft สู่ RFC เติม 1 ย่อหน้าใน W1.x2 ได้
- 1.13 Interconnection of Networks (บางส่วน): ยังไม่มีแนวคิด internetwork อย่างเป็นหัวข้อ ควรรวมกับ 10.2 เป็นย่อหน้าเดียว
- 1.14 The Internet (บางส่วน): W1.x2 เพิ่มเพียง ARPANET 1969 ยังไม่มีโครงสร้าง ISP/IXP/backbone ควรเติมใน supplementary สัปดาห์ 1
- 2.5 Organization of the Layers (ไม่มี): W3.x1 ไม่ได้แบ่งกลุ่ม network-support / user-support เติม 1 ย่อหน้าใน W3.x1 ได้ง่าย
- 3.6 MAN Technology (บางส่วน): W2.x3 เอ่ยถึง DWDM/GPON ของผู้ให้บริการ แต่ยังไม่มี Metro Ethernet/FTTx ในมุม MAN
- 3.7 WAN Technology (บางส่วน): มี DSL/FTTH (W4.x2), E1 (W2.x3), X.25/Frame Relay/ATM (เอ่ยใน W1.x2) แต่ยังไม่มี leased line, MPLS, SD-WAN, 4G/5G เป็นหัวข้อ
- 5.8 Null Modem (บางส่วน): history-only มี 2 ประโยคใน W4.x2 เพียงพอแล้ว ตั้งใจไม่ขยาย
- 5.9 High-speed Interface Protocol (บางส่วน): W4.x1 เอ่ย USB/SATA/PCIe เป็นตัวอย่าง Serial เท่านั้น history-only ตั้งใจไม่ขยาย
- 5.12 อัตราการส่งข้อมูลของโมเด็ม (บางส่วน): ล้าสมัย มีตัวเลข 56K และความสัมพันธ์ baud/bps แล้ว ไม่จำเป็นต้องเติมตาราง V-series
- 5.13 Standard Telephone Operations (บางส่วน): ล้าสมัย มีเพียง Circuit Switching ของ PSTN ตั้งใจไม่ขยาย
- 5.14 Connection Negotiation (บางส่วน): ล้าสมัย มี 1 ประโยค ตั้งใจไม่ขยาย
- 8.2 IEEE 802 Frame Formats (บางส่วน): W4.x1/W4.x3 เติม Preamble/SFD และ FCS CRC-32 แล้ว แต่ยังไม่มี LLC header และ Ethernet II vs 802.3 ควรเติมใน W4.s1 หรือ supplementary สัปดาห์ 4
- 8.10 Other Ethernet Networks (บางส่วน): ยังเป็นย่อหน้าท้าย W4.s5 อาจเติมตาราง 10G/25G/40G/100G
- 8.11 Token Bus IEEE 802.4 (ไม่มี): เทคโนโลยีล้าสมัย ตั้งใจไม่ใส่ (มีเป็นตัวลวงใน r6 เท่านั้น)
- 9.4 MAC Sublayer (บางส่วน): มีเพียง ACK ระดับ Data Link ของ Wi-Fi ใน W4.x4 ควรเพิ่ม supplementary สัปดาห์ 6 เรื่อง DCF, RTS/CTS และ hidden node
- 9.5 CSMA/CA (บางส่วน): ยังเป็นการเอ่ยผ่าน (รวมคำอธิบายใน chk ของ W1.x2) ควรรวมใน supplementary สัปดาห์ 6 เดียวกับ 9.4
- 10.1 Brief History of Internet (บางส่วน): history-only W1.x2 เพิ่มที่มาของ packet switching และ ARPANET แล้ว เพียงพอ
- 10.2 Internetworking (บางส่วน): W3.x1 อธิบายว่าเราเตอร์คุยกันทีละ hop ที่ชั้น Network แต่ยังไม่มีหัวข้อ internetwork โดยตรง
- 10.5 Binary and Dotted Decimal Notation (บางส่วน): ยังไม่มีวิธีแปลงฐาน ควรเพิ่ม supplementary สัปดาห์ 8 พร้อม widget แปลงเลขฐานสอง
- 10.7 Subnetting (บางส่วน): ยังมีแค่ widget และ simulator ไม่มีข้อความอธิบายทีละขั้น ควรอยู่ใน supplementary สัปดาห์ 8
- 10.8 Three Levels of Hierarchy (ไม่มี): ยังไม่มี ควรอยู่ใน supplementary สัปดาห์ 8 คู่กับ 10.7
- 10.10 Classless Addressing (บางส่วน): ยังเอ่ยผ่านใน W3.s5 ควรอยู่ใน supplementary สัปดาห์ 8
- 10.11 CIDR Notation (บางส่วน): ยังเอ่ยผ่าน ควรอยู่ใน supplementary สัปดาห์ 8
- 10.12 การคำนวณหาแอดเดรสซับเน็ต (บางส่วน): แบบฝึกครบแต่คำอธิบายบาง ควรอยู่ใน supplementary สัปดาห์ 8
- 10.15 NAT (บางส่วน): W3.x1 เพิ่มเพียง note ว่า NAT แก้หมายเลขพอร์ต ยังไม่มี PAT/ตารางแปลงพอร์ต
- 10.16 Other Protocols in the Network Layer (บางส่วน): W3.x2 อธิบาย ARP, ICMP (type 0/8/11) และ NDP แล้ว แต่ยังไม่มี IGMP จึงคงไว้ที่บางส่วน เติม 1 ย่อหน้าเรื่อง IGMP/Multicast ใน W3.x2 ก็จะเป็นเต็ม
