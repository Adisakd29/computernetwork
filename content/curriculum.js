'use strict';
/* NetLab 3.0 curriculum plan (Phase 2). The official 18-week order of 21910-2013 is kept (the teacher's choice); every week
   gets the same 8 parts. This file only REFERENCES activities that exist (lesson ids, lab ids, simulator missions) and lists
   what later phases will add (`planned`), so no stored score changes meaning.

   Per week:
     focus        what the week is about, in the CCNA-style strand it belongs to (strands 1-18 of the 3.0 brief)
     can          "after this week the student can ..." (observable, used for the skill assessment)
     guided       Guided Lab: the week's end-of-class lab (labs.js, timed, hints) + simulator missions with step hints
     independent  Independent Lab: simulator missions the student does alone (graded on the server from the network state)
     trouble      Troubleshooting Challenge: fault-finding missions; the former practice room of the week is shown with them
     skills       skill ids judged this week (server/skills.js)
     planned      activities later phases add to this week ({ phase, what }) - shown to teachers only, never as a fake button
   Mission refs are 'sim:missionId'. */
const W = (id, o) => Object.assign({ id }, o);
const WEEKS = [
  W('w1', { strand: [1, 2], focus: 'พื้นฐานเครือข่าย องค์ประกอบ ประเภท และ Topology',
    can: ['ระบุองค์ประกอบการสื่อสารข้อมูลจากสถานการณ์จริง', 'ต่อ PC 2 เครื่องผ่าน Switch และทดสอบด้วย ping'],
    guided: ['topology:t8', 'topology:t14'], independent: ['topology:t1'], solve: ['troubleshoot:x15'], solveType: 'trouble', more: ['topology:t15'], skills: ['design', 'switching'] }),
  W('w2', { strand: [2, 3], focus: 'อุปกรณ์เครือข่าย สื่อนำสัญญาณ และหัวต่อ',
    can: ['เลือกอุปกรณ์และสื่อให้เหมาะกับงาน', 'อ่านผลเครื่องทดสอบสาย LAN'],
    guided: ['topology:t2', 'topology:t16'], independent: ['topology:t17'], solve: ['topology:t18'], solveType: 'trouble', more: [], skills: ['design', 'cabling'] }),
  W('w3', { strand: [1, 6], focus: 'มาตรฐาน OSI/TCP-IP โปรโตคอล และ IPv4 แบบ Classful',
    can: ['ระบุชั้น OSI ของอุปกรณ์และโปรโตคอล', 'บอก Class, Mask และช่วง IP ได้'],
    guided: ['subnet:s1', 'packets:p1'], independent: [], solve: ['topology:t19'], solveType: 'analysis', more: [], skills: ['ipconfig', 'subnetting'] }),
  W('w4', { strand: [4, 5], focus: 'Ethernet, Switching, ตาราง MAC และ ARP',
    can: ['อธิบายการเรียนรู้ MAC ของ Switch จากผลจริง', 'แยก Collision domain ของ Hub กับ Switch'],
    guided: ['switching:sw1', 'switching:sw2', 'switching:sw7'], independent: ['switching:sw3'], solve: ['switching:sw6'], solveType: 'trouble', more: ['switching:sw4', 'switching:sw5'], skills: ['switching'] }),
  W('w5', { strand: [3], focus: 'เข้าหัว UTP/RJ-45 และทดสอบสาย',
    can: ['เข้าหัว T568A/B ตามขั้นตอนและตรวจคุณภาพ', 'หาจุดเสียของสายจากผลเครื่องทดสอบ'],
    guided: ['crimp:c6'], independent: ['crimp:c1'], solve: ['crimp:c4'], solveType: 'trouble', more: ['crimp:c2', 'crimp:c3', 'crimp:c5', 'crimp:c7'], skills: ['cabling'] }),
  W('w6', { strand: [10], focus: 'มาตรฐานและอุปกรณ์ Wi-Fi',
    can: ['เลือกมาตรฐานและย่านความถี่ให้เหมาะกับพื้นที่', 'ต่อ Laptop เข้า Access Point ในเครือข่ายจำลอง'],
    guided: ['topology:t6', 'wifi:wf1', 'wifi:wf2'], independent: ['wifi:wf3'], solve: ['wifi:wf5'], solveType: 'trouble', more: ['wifi:wf4'], skills: ['wireless', 'design'] }),
  W('w7', { strand: [10, 14], focus: 'การเชื่อมต่อและความปลอดภัย Wi-Fi',
    can: ['ตั้งค่า WPA2/WPA3 และ Client isolation ได้ถูกต้อง', 'วิเคราะห์สาเหตุที่เครื่องต่อ Wi-Fi ไม่ได้'],
    guided: ['wifi:wf6'], independent: [], solve: ['troubleshoot:x2'], solveType: 'trouble', more: ['topology:t6', 'wifi:wf5'], skills: ['wireless', 'security'] }),
  W('w8', { strand: [6, 9, 12], focus: 'ชื่อเครื่อง Workgroup และการกำหนด IP (IPv4/CIDR/Subnet)',
    can: ['ตั้งค่า IP แบบ Static และตรวจด้วย ipconfig', 'คำนวณ Network, Broadcast และจำนวน Host จาก CIDR'],
    guided: ['terminal:m1', 'subnet:s2', 'ipv6:v1'], independent: ['subnet:s3'], solve: ['troubleshoot:x5', 'troubleshoot:x9'], solveType: 'trouble', more: ['ipv6:v2', 'subnet:s4', 'subnet:s5', 'subnet:s8', 'topology:t5', 'ipv6:v3', 'ipv6:v5'], skills: ['ipconfig', 'subnetting'] }),
  W('w9', { strand: [12], focus: 'การแชร์โฟลเดอร์ เครื่องพิมพ์ และการเชื่อมต่อใน Windows',
    can: ['แชร์และเชื่อมต่อโฟลเดอร์ด้วย UNC path', 'หาสาเหตุที่เปิดแชร์ไม่ได้'],
    guided: ['terminal:m2', 'terminal:m12'], independent: ['terminal:m13'], solve: ['troubleshoot:x11'], solveType: 'trouble', more: ['troubleshoot:x4'], skills: ['ipconfig', 'troubleshooting'] }),
  W('w10', { strand: [8, 11], focus: 'บริการของ NOS: DHCP, DNS, เว็บ และพอร์ต TCP/UDP',
    can: ['ตั้ง DHCP และ DNS ให้เครือข่ายใช้งานได้', 'อ่านพอร์ตที่เปิดรอการเชื่อมต่อด้วย netstat/ss'],
    guided: ['topology:t5', 'topology:t10'], independent: ['packets:p3'], solve: ['troubleshoot:x10', 'troubleshoot:x7'], solveType: 'trouble', more: ['packets:p2', 'topology:t7', 'topology:t11', 'packets:p4', 'terminal:m10'], skills: ['ipconfig', 'routing', 'terminal'] }),
  W('w11', { strand: [12, 13], focus: 'ซอฟต์แวร์ NOS, Linux และเครื่องจำลอง',
    can: ['ใช้คำสั่ง Linux พื้นฐานตรวจเครือข่าย', 'เลือกชนิด Hypervisor ให้เหมาะกับงาน'],
    guided: ['terminal:m4'], independent: [], solve: ['terminal:m7'], solveType: 'trouble', more: [], skills: ['terminal'] }),
  W('w12', { strand: [13, 16], focus: 'ติดตั้ง NOS บนเครื่องจำลองและโหมดเครือข่ายของ VM',
    can: ['ตั้งค่า IP และ Default route บน Linux', 'เลือกโหมดเครือข่ายของ VM (NAT/Bridged/Host-only)'],
    guided: ['netops:a1'], independent: ['terminal:m8'], solve: ['terminal:m11'], solveType: 'trouble', more: ['netops:a2', 'terminal:m7'], skills: ['terminal', 'routing'] }),
  W('w13', { strand: [2, 7, 17], focus: 'ออกแบบ ติดตั้ง ตรวจสอบเครือข่าย, VLSM และ Static routing',
    can: ['ออกแบบแผน IP ด้วย VLSM', 'ตั้ง Static/Default route ให้หลายวงคุยกันได้', 'ยืนยันการทำงานด้วย ping/tracert'],
    guided: ['topology:t3', 'topology:t4'], independent: ['subnet:s7'], solve: ['troubleshoot:x12'], solveType: 'trouble', more: ['subnet:s6', 'subnet:s9', 'subnet:s10', 'terminal:m5', 'ipv6:v4', 'troubleshoot:x8'], skills: ['design', 'routing', 'subnetting'] }),
  W('w14', { strand: [15], focus: 'วิเคราะห์และแก้ปัญหาเครือข่ายอย่างเป็นขั้นตอน',
    can: ['ไล่ปัญหาจากชั้นล่างขึ้นบนพร้อมหลักฐาน', 'แก้ที่ต้นเหตุและทดสอบยืนยัน'],
    guided: ['troubleshoot:x3', 'netops:o1'], independent: ['troubleshoot:x1'], solve: ['troubleshoot:x13'], solveType: 'trouble', more: ['troubleshoot:x5', 'terminal:m9', 'netops:o3', 'packets:p6', 'packets:p5', 'netops:o2', 'troubleshoot:x7', 'troubleshoot:x8'], skills: ['troubleshooting'] }),
  W('w15', { strand: [14], focus: 'ภัยคุกคามและการสังเกตการเชื่อมต่อที่ผิดปกติ',
    can: ['จำแนกภัยคุกคามจากอาการ', 'ใช้ netstat ดูการเชื่อมต่อที่น่าสงสัย'],
    guided: ['terminal:m6'], independent: ['terminal:m10'], solve: ['terminal:m3'], solveType: 'analysis', more: [], skills: ['security'] }),
  W('w16', { strand: [14], focus: 'การป้องกันหลายชั้นและ Firewall',
    can: ['ตั้งกฎ Firewall ให้เปิดเฉพาะบริการที่จำเป็น', 'แยกปัญหา Firewall ออกจากปัญหาเส้นทาง'],
    guided: ['troubleshoot:x6'], independent: ['topology:t12'], solve: ['topology:t13'], solveType: 'trouble', more: ['troubleshoot:x11', 'terminal:m6'], skills: ['security', 'troubleshooting'] }),
  W('w17', { strand: [17], focus: 'บัญชีผู้ใช้และกลุ่ม + บูรณาการแก้ปัญหา',
    can: ['สร้างและตรวจบัญชี/กลุ่มด้วยคำสั่ง net', 'แก้เหตุขัดข้องแบบสุ่มและเขียนรายงาน'],
    guided: ['terminal:m15'], independent: ['terminal:m17'], solve: ['terminal:m16'], solveType: 'analysis', more: ['troubleshoot:x14'], skills: ['security', 'troubleshooting'] }),
  W('w18', { strand: [18], focus: 'สิทธิ์การเข้าถึง + โครงงานปิดท้าย (Capstone)',
    can: ['กำหนดสิทธิ์ตามหลัก Least Privilege', 'ออกแบบ ตั้งค่า ทดสอบ และแก้ปัญหาเครือข่ายวิทยาลัยแบบครบวงจร'],
    guided: ['terminal:m18'], independent: ['terminal:m19'], solve: ['terminal:m20'], solveType: 'trouble', more: ['topology:t9', 'terminal:m14'], skills: ['design', 'routing', 'subnetting', 'wireless', 'security'] })
];
/* 3.1: step 4 "ฝึกแก้ปัญหา". solve = the week's main activity (1-2 missions that use only what weeks <= this one teach),
   solveType 'trouble' (find and fix a fault) or 'analysis' (analyse / solve a practical problem), more = optional extra practice.
   trouble is kept as solve + more for older readers (unlock checks for simulator submits, portfolio, practice mix). */
for (const w of WEEKS) w.trouble = [...w.solve, ...w.more];
/* a mission listed in an earlier week is shown as review ("ทบทวนจากสัปดาห์ X") in later weeks; its result is stored once */
const FIRST = new Map();
for (const w of WEEKS) for (const ref of [...w.guided, ...w.independent, ...w.solve, ...w.more]) if (!FIRST.has(ref)) FIRST.set(ref, w.id);
const firstWeekOf = ref => FIRST.get(ref) || null;
/* minutes a mission usually takes, by level (shown to students as an estimate) */
const MINUTES = { easy: 10, medium: 15, hard: 25 };
module.exports = { WEEKS, MINUTES, firstWeekOf };
