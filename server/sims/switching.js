'use strict';
/*
 * Switching & VLAN lab - server grader (NetLab).
 * The engine lives in public/js/sim/switching.js (UMD) so the browser and this grader run the same code.
 * grade(missionId, payload) never trusts a client score: it rebuilds the network from the mission's trusted start
 * topology + the student's submitted switch configuration, replays the student's action log, and checks the result.
 *
 * Payload (all missions): { config?: { [switchId]: { vlans:[{id,name}], ifs:{ [port]: {mode,vlan,allowed,native,cost,shutdown} },
 *                                                    stp:{ off:[vlan], prio:{ [vlan]: priority } } } },
 *                           actions?: [ { op:'ping', src:pcId, dst:ip } | { op:'clear', what:'mac'|'arp'|'both' } ],
 *                           answers?: { ...mission specific } }
 * Missions with start.lock === true ignore config (the topology is fixed); the others ignore actions unless stated.
 * Pure, no I/O, never throws.
 */
const SW = require('../../public/js/sim/switching.js');

const MAX_JSON = 60000;
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const r1 = x => Math.round(x * 10) / 10;
const P = SW.shortPort;

/* ---------- topology helpers ---------- */
const pc = (id, name, ip, mac, x, y, group) => ({ id, type: 'pc', name, ip, prefix: 24, mac, x, y, group });
const sw = (id, name, mac, x, y, extra) => Object.assign({ id, type: 'switch', name, mac, x, y, ports: { fa: 8, gi: 2 } }, extra || {});
const L = (a, ap, b, bp) => ({ a, ap, b, bp });
const acc = v => ({ mode: 'access', vlan: v });
function withIds(t) { t.links.forEach((l, i) => { l.id = 'l' + (i + 1); }); return t; }

/* ---------- missions ---------- */
const T1 = withIds({
  devices: [
    sw('sw1', 'SW1', '0019.e8a1.1100', 320, 70),
    pc('pc1', 'PC1', '192.168.1.11', '0050.7966.0a01', 70, 300), pc('pc2', 'PC2', '192.168.1.12', '0050.7966.0a02', 200, 300),
    pc('pc3', 'PC3', '192.168.1.13', '0050.7966.0a03', 330, 300),
    { id: 'hub1', type: 'hub', name: 'HUB1', ports: 4, x: 510, y: 190 },
    pc('pc4', 'PC4', '192.168.1.14', '0050.7966.0a04', 450, 320), pc('pc5', 'PC5', '192.168.1.15', '0050.7966.0a05', 580, 320)
  ],
  links: [L('pc1', 'eth0', 'sw1', 'fa0/1'), L('pc2', 'eth0', 'sw1', 'fa0/2'), L('pc3', 'eth0', 'sw1', 'fa0/3'), L('hub1', 'p1', 'sw1', 'fa0/4'),
    L('pc4', 'eth0', 'hub1', 'p2'), L('pc5', 'eth0', 'hub1', 'p3')]
});
const T2 = withIds({
  devices: [
    sw('sw1', 'SW1', '0019.e8b1.1100', 220, 70), sw('sw2', 'SW2', '0019.e8b2.2200', 530, 70),
    pc('pca', 'PC-A', '192.168.1.11', '0050.7966.0b0a', 70, 300), pc('pcb', 'PC-B', '192.168.1.12', '0050.7966.0b0b', 220, 300),
    pc('pcc', 'PC-C', '192.168.1.13', '0050.7966.0b0c', 370, 300), pc('pcd', 'PC-D', '192.168.1.14', '0050.7966.0b0d', 560, 300)
  ],
  links: [L('pca', 'eth0', 'sw1', 'fa0/1'), L('pcb', 'eth0', 'sw1', 'fa0/2'), L('pcc', 'eth0', 'sw1', 'fa0/3'), L('sw1', 'gi0/1', 'sw2', 'gi0/1'), L('pcd', 'eth0', 'sw2', 'fa0/1')]
});
const T3 = withIds({
  devices: [
    sw('sw1', 'SW1', '0019.e8c1.1100', 320, 70),
    pc('lab1', 'LAB1', '192.168.10.11', '0050.7966.0c11', 50, 300, 'LAB'), pc('lab2', 'LAB2', '192.168.10.12', '0050.7966.0c12', 150, 300, 'LAB'),
    pc('lab3', 'LAB3', '192.168.10.13', '0050.7966.0c13', 250, 300, 'LAB'),
    pc('off1', 'OFF1', '192.168.20.11', '0050.7966.0c21', 390, 300, 'OFFICE'), pc('off2', 'OFF2', '192.168.20.12', '0050.7966.0c22', 490, 300, 'OFFICE'),
    pc('off3', 'OFF3', '192.168.20.13', '0050.7966.0c23', 590, 300, 'OFFICE')
  ],
  links: [L('lab1', 'eth0', 'sw1', 'fa0/1'), L('lab2', 'eth0', 'sw1', 'fa0/2'), L('lab3', 'eth0', 'sw1', 'fa0/3'),
    L('off1', 'eth0', 'sw1', 'fa0/4'), L('off2', 'eth0', 'sw1', 'fa0/5'), L('off3', 'eth0', 'sw1', 'fa0/6')]
});
const VL = { 10: 'LAB', 20: 'OFFICE' };
const T4 = withIds({
  devices: [
    sw('sw1', 'SW1', '0019.e8d1.1100', 170, 80, { vlans: VL, ifs: { 'fa0/1': acc(10), 'fa0/2': acc(20) } }),
    sw('sw2', 'SW2', '0019.e8d2.2200', 470, 80, { vlans: VL, ifs: { 'fa0/1': acc(10), 'fa0/2': acc(20) } }),
    pc('l1', 'LAB1', '192.168.10.11', '0050.7966.0d11', 70, 300, 'LAB'), pc('o1', 'OFF1', '192.168.20.11', '0050.7966.0d21', 240, 300, 'OFFICE'),
    pc('l2', 'LAB2', '192.168.10.12', '0050.7966.0d12', 400, 300, 'LAB'), pc('o2', 'OFF2', '192.168.20.12', '0050.7966.0d22', 570, 300, 'OFFICE')
  ],
  links: [L('l1', 'eth0', 'sw1', 'fa0/1'), L('o1', 'eth0', 'sw1', 'fa0/2'), L('l2', 'eth0', 'sw2', 'fa0/1'), L('o2', 'eth0', 'sw2', 'fa0/2'), L('sw1', 'gi0/1', 'sw2', 'gi0/1')]
});
const T5 = withIds({
  devices: [
    sw('sw1', 'SW1', '0019.e8a1.1100', 120, 90, { stp: { off: [1] } }), sw('sw2', 'SW2', '0019.e8a2.2200', 520, 90, { stp: { off: [1] } }),
    sw('sw3', 'SW3', '0019.e8a3.3300', 320, 270, { stp: { off: [1] } }),
    pc('pc1', 'PC1', '192.168.1.11', '0050.7966.0e01', 50, 250), pc('pc2', 'PC2', '192.168.1.12', '0050.7966.0e02', 590, 250),
    pc('pc3', 'PC3', '192.168.1.13', '0050.7966.0e03', 320, 370)
  ],
  links: [L('sw1', 'gi0/1', 'sw2', 'gi0/1'), L('sw2', 'gi0/2', 'sw3', 'gi0/2'), L('sw3', 'gi0/1', 'sw1', 'gi0/2'),
    L('pc1', 'eth0', 'sw1', 'fa0/1'), L('pc2', 'eth0', 'sw2', 'fa0/1'), L('pc3', 'eth0', 'sw3', 'fa0/1')]
});
const VL6 = { 10: 'LAB', 20: 'OFFICE', 99: 'NATIVE' };
const T6 = withIds({
  devices: [
    sw('sw1', 'SW1', '0019.e8f1.1100', 170, 80, { vlans: VL6, ifs: { 'fa0/1': acc(10), 'fa0/2': acc(20), 'fa0/3': acc(20), 'gi0/1': { mode: 'trunk', allowed: [10, 20, 99], native: 99 } } }),
    sw('sw2', 'SW2', '0019.e8f2.2200', 470, 80, { vlans: VL6, ifs: { 'fa0/1': acc(10), 'fa0/2': acc(20), 'fa0/3': acc(20), 'gi0/1': { mode: 'trunk', allowed: [10, 99], native: 1 } } }),
    pc('a1', 'LAB1', '192.168.10.11', '0050.7966.0f11', 40, 300, 'LAB'), pc('a2', 'LAB2', '192.168.10.12', '0050.7966.0f12', 150, 300, 'LAB'),
    pc('b1', 'OFF1', '192.168.20.11', '0050.7966.0f21', 260, 300, 'OFFICE'),
    pc('a3', 'LAB3', '192.168.10.13', '0050.7966.0f13', 380, 300, 'LAB'), pc('b2', 'OFF2', '192.168.20.12', '0050.7966.0f22', 490, 300, 'OFFICE'),
    pc('b3', 'OFF3', '192.168.20.13', '0050.7966.0f23', 600, 300, 'OFFICE')
  ],
  links: [L('a1', 'eth0', 'sw1', 'fa0/1'), L('a2', 'eth0', 'sw1', 'fa0/2'), L('b1', 'eth0', 'sw1', 'fa0/3'),
    L('a3', 'eth0', 'sw2', 'fa0/1'), L('b2', 'eth0', 'sw2', 'fa0/2'), L('b3', 'eth0', 'sw2', 'fa0/3'), L('sw1', 'gi0/1', 'sw2', 'gi0/1')]
});
const T7 = withIds({
  devices: [
    { id: 'hub1', type: 'hub', name: 'HUB1', ports: 4, x: 160, y: 80 },
    pc('pc1', 'PC1', '192.168.1.11', '0050.7966.0701', 40, 290), pc('pc2', 'PC2', '192.168.1.12', '0050.7966.0702', 120, 290),
    pc('pc3', 'PC3', '192.168.1.13', '0050.7966.0703', 200, 290), pc('pc4', 'PC4', '192.168.1.14', '0050.7966.0704', 280, 290),
    sw('sw1', 'SW1', '0019.e8a7.7700', 480, 80, { ports: { fa: 8, gi: 0 } }),
    pc('pc5', 'PC5', '192.168.2.11', '0050.7966.0705', 360, 290), pc('pc6', 'PC6', '192.168.2.12', '0050.7966.0706', 440, 290),
    pc('pc7', 'PC7', '192.168.2.13', '0050.7966.0707', 520, 290), pc('pc8', 'PC8', '192.168.2.14', '0050.7966.0708', 600, 290)
  ],
  links: [L('pc1', 'eth0', 'hub1', 'p1'), L('pc2', 'eth0', 'hub1', 'p2'), L('pc3', 'eth0', 'hub1', 'p3'), L('pc4', 'eth0', 'hub1', 'p4'),
    L('pc5', 'eth0', 'sw1', 'fa0/1'), L('pc6', 'eth0', 'sw1', 'fa0/2'), L('pc7', 'eth0', 'sw1', 'fa0/3'), L('pc8', 'eth0', 'sw1', 'fa0/4')]
});

const missions = [
  {
    id: 'sw1', level: 'easy', max: 10, title: 'Switch เรียนรู้ MAC อย่างไร',
    desc: 'ฝึกตามขั้นตอน (Guided Lab) สัปดาห์ที่ 4: สวิตช์ SW1 เพิ่งเปิดเครื่อง ตาราง MAC ยังว่าง ให้ ping ตามลำดับนี้ 1) PC1 ping PC2  2) PC4 ping PC1  3) PC5 ping PC4 ' +
      'ดูเส้นทางเฟรมทีละขั้นในแผง "ติดตามเฟรม" แล้วกรอกว่าตาราง MAC ของ SW1 มี MAC ของแต่ละเครื่องอยู่ที่พอร์ตใด (หรือไม่มีในตาราง) ตาราง MAC จริงจะซ่อนไว้จนกว่าจะส่งงาน',
    hints: [
      'สวิตช์เรียนรู้จาก MAC ต้นทาง (source MAC) ของเฟรมที่ "รับเข้ามา" ที่พอร์ตนั้น ไม่ใช่จาก MAC ปลายทาง',
      'เครื่องที่ไม่เคยส่งเฟรมออกมาเลย สวิตช์จะไม่รู้จัก MAC ของเครื่องนั้น',
      'Hub ไม่มีตาราง MAC มันทวนสัญญาณออกทุกพอร์ต ดังนั้นทุกเครื่องหลัง Hub จะไปโผล่ที่พอร์ตเดียวกันของ SW1',
      'ใน ping ที่ 3 ลองสังเกตว่า SW1 ทำอย่างไรกับ ARP reply ที่ปลายทางอยู่พอร์ตเดียวกับที่รับเข้ามา (filter)'
    ],
    start: { kind: 'mac', lock: true, hideMac: true, topo: T1, focus: 'sw1',
      required: [{ src: 'pc1', dst: 'pc2' }, { src: 'pc4', dst: 'pc1' }, { src: 'pc5', dst: 'pc4' }] }
  },
  {
    id: 'sw2', level: 'easy', max: 10, title: 'ARP ทีละขั้น',
    desc: 'ฝึกตามขั้นตอน (Guided Lab): PC-A ยังไม่รู้ MAC ของ PC-B ให้สั่ง PC-A ping PC-B (192.168.1.12) แล้วกด "ขั้นถัดไป" ไล่ดูทุกเฟรม: ARP request (broadcast) → ARP reply (unicast) → ICMP echo request → echo reply ' +
      'จากนั้นตอบคำถามจากสิ่งที่เห็นใน trace ของคุณเอง',
    hints: [
      'ARP request ส่งถึง MAC ปลายทาง ffff.ffff.ffff (broadcast) สวิตช์จึง flood ออกทุกพอร์ตใน VLAN ยกเว้นพอร์ตที่รับเข้ามา',
      'Broadcast ข้ามไปถึงสวิตช์ตัวอื่นที่ต่อกันด้วย ทุกเครื่องใน broadcast domain จึงได้รับ แต่ตอบเฉพาะเครื่องที่มี IP ตรง',
      'ARP reply เป็น unicast ถึง PC-A และ SW1 รู้แล้วว่า PC-A อยู่พอร์ตไหน (เรียนรู้ตอนรับ ARP request)',
      'เครื่องปลายทาง (PC-B) บันทึก IP/MAC ของผู้ถามลง ARP cache ด้วยตอนได้รับ ARP request'
    ],
    start: { kind: 'arp', lock: true, topo: T2, focus: 'sw1', required: [{ src: 'pca', dst: 'pcb' }], ask: { sw: 'sw1', from: 'pca', to: 'pcb' } }
  },
  {
    id: 'sw3', level: 'medium', max: 10, title: 'แยกห้อง LAB กับ Office ด้วย VLAN',
    desc: 'ฝึกเอง (Independent Lab): สวิตช์ SW1 ต่อเครื่องห้องแล็บ LAB1–LAB3 (Fa0/1–Fa0/3, 192.168.10.0/24) และเครื่องห้องธุรการ OFF1–OFF3 (Fa0/4–Fa0/6, 192.168.20.0/24) ' +
      'ตอนนี้ทุกพอร์ตอยู่ VLAN 1 จึงเห็น broadcast ของกันและกัน ให้สร้าง VLAN 10 ชื่อ LAB และ VLAN 20 ชื่อ OFFICE แล้วกำหนดพอร์ตเป็น access ให้ถูก VLAN ' +
      'ตรวจด้วย ping: เครื่องในห้องเดียวกันต้อง ping กันได้ ข้าม VLAN ต้องไม่ได้ (แล็บนี้ไม่มี Router จึงไม่มี inter-VLAN routing)',
    hints: [
      'สร้าง VLAN: vlan 10 แล้ว name LAB (ทำแบบเดียวกันกับ VLAN 20 ชื่อ OFFICE) หรือใช้แผงตั้งค่าของ SW1',
      'กำหนดพอร์ต: interface range fa0/1 - 3 แล้ว switchport mode access และ switchport access vlan 10',
      'ตรวจด้วย show vlan brief ว่าพอร์ตอยู่ใต้ VLAN ที่ถูกต้อง'
    ],
    start: { kind: 'vlan', topo: T3, focus: 'sw1', groups: { LAB: 10, OFFICE: 20 } }
  },
  {
    id: 'sw4', level: 'medium', max: 10, title: 'Trunk 802.1Q ระหว่างสองสวิตช์',
    desc: 'ฝึกเอง (Independent Lab): SW1 และ SW2 มี VLAN 10 (LAB) และ VLAN 20 (OFFICE) และกำหนดพอร์ตเครื่องไว้แล้ว แต่สาย Gi0/1 ที่เชื่อมสองสวิตช์ยังเป็น access VLAN 1 ' +
      'ให้ตั้ง Gi0/1 ทั้งสองฝั่งเป็น trunk อนุญาตเฉพาะ VLAN ที่จำเป็น (10, 20 และ native 99) ตั้ง native VLAN 99 ให้ตรงกันทั้งสองฝั่ง และสร้าง VLAN 99 ชื่อ NATIVE บนทั้งสองสวิตช์ ' +
      'เป้าหมาย: LAB1 ping LAB2 ได้ OFF1 ping OFF2 ได้ และ broadcast ของ VLAN หนึ่งต้องไม่ข้ามไปอีก VLAN',
    hints: [
      'interface gi0/1 → switchport mode trunk → switchport trunk native vlan 99 → switchport trunk allowed vlan 10,20,99',
      'ตั้งค่าให้ครบทั้งสองฝั่งของสาย ถ้าฝั่งหนึ่งเป็น trunk อีกฝั่งเป็น access จะใช้งานไม่ได้',
      'ใช้ show interfaces trunk ดู allowed VLAN และ native VLAN ของแต่ละฝั่ง ถ้า native ไม่ตรงกัน หน้าจอ console ของสวิตช์จะแสดงข้อความ %CDP-4-NATIVE_VLAN_MISMATCH (เป็นข้อความ log ไม่ได้อยู่ในผล show interfaces trunk)',
      'เฟรมบน trunk จะมี 802.1Q tag ยกเว้น VLAN ที่เป็น native ซึ่งส่งแบบไม่มี tag'
    ],
    start: { kind: 'trunk', topo: T4, focus: 'sw1', groups: { LAB: 10, OFFICE: 20 }, trunk: { a: 'sw1', b: 'sw2', port: 'gi0/1', native: 99, need: [10, 20] } }
  },
  {
    id: 'sw5', level: 'hard', max: 10, title: 'Spanning Tree: เลือก Root Bridge และหยุด Loop',
    desc: 'ฝึกเอง (Independent Lab): สวิตช์สามตัวต่อกันเป็นสามเหลี่ยมเพื่อสำรองเส้นทาง แต่ช่างคนก่อนปิด Spanning Tree ไว้ (no spanning-tree vlan 1) ลอง ping ดูก่อนว่าเกิดอะไรขึ้น ' +
      'จากนั้น 1) เปิด STP ของ VLAN 1 บนทุกสวิตช์ 2) ทำให้ SW3 (core switch ในห้อง server) เป็น Root Bridge ของ VLAN 1 โดยตั้ง bridge priority (ผลคูณของ 4096) ' +
      '3) ระบุว่าพอร์ตใดถูก block (Alternate) 4) ping PC1 → PC2 ให้สำเร็จหลังตั้งค่าเสร็จ เพื่อยืนยันว่าไม่มี broadcast storm',
    hints: [
      'Bridge ID = priority + MAC ตัวที่ค่าน้อยที่สุดเป็น Root ค่าเริ่มต้นเท่ากันหมด (32768) จึงตัดสินด้วย MAC ที่น้อยที่สุด',
      'คำสั่ง: spanning-tree vlan 1 (เปิด STP) และ spanning-tree vlan 1 priority 4096 บน SW3',
      'สวิตช์ที่ไม่ใช่ Root เลือก Root port ที่ cost ไปถึง Root ต่ำสุด ลิงก์ที่เหลือฝั่งที่ Bridge ID สูงกว่าจะเป็น Alternate (BLK)',
      'ใช้ show spanning-tree ดู Role/Sts ของแต่ละพอร์ต (Altn BLK คือพอร์ตที่ถูก block)'
    ],
    start: { kind: 'stp', topo: T5, focus: 'sw3', root: 'sw3', vlan: 1, required: [{ src: 'pc1', dst: 'pc2' }] }
  },
  {
    id: 'sw6', level: 'medium', max: 10, title: 'แก้ปัญหา VLAN และ Trunk',
    desc: 'แก้ปัญหา (Troubleshooting Challenge): ผู้ใช้แจ้งว่า "LAB2 ใช้งานกับเพื่อนในห้องแล็บไม่ได้" และ "OFF1 คุยกับ OFF2, OFF3 ที่อาคารอีกฝั่งไม่ได้" ' +
      'แผนเครือข่ายที่ถูกต้อง: เครื่อง LAB ทุกเครื่องอยู่ VLAN 10 (192.168.10.0/24) เครื่อง OFF อยู่ VLAN 20 (192.168.20.0/24) trunk Gi0/1 ระหว่าง SW1–SW2 อนุญาต VLAN 10,20,99 และ native VLAN 99 ทั้งสองฝั่ง ' +
      'ใช้ ping, trace และคำสั่ง show หาจุดที่ตั้งค่าผิดแล้วแก้ให้ตรงตามแผน (ห้ามแก้ด้วยการย้ายทุกเครื่องไป VLAN 1)',
    hints: [
      'เริ่มจาก show vlan brief บนทั้งสองสวิตช์ เทียบกับแผน ว่าพอร์ตของเครื่องใดอยู่ผิด VLAN',
      'show interfaces trunk ดูคอลัมน์ "Vlans allowed on trunk" ของทั้งสองฝั่ง',
      'ถ้าเห็น %CDP-4-NATIVE_VLAN_MISMATCH แปลว่า native VLAN สองฝั่งไม่ตรงกัน',
      'ใน trace ให้ดูว่าเฟรมถูกทิ้งที่สวิตช์ใด พอร์ตใด และเพราะอะไร'
    ],
    start: { kind: 'fix', topo: T6, focus: 'sw1', groups: { LAB: 10, OFFICE: 20 }, trunk: { a: 'sw1', b: 'sw2', port: 'gi0/1', native: 99, need: [10, 20], plan: [10, 20, 99] } }
  },
  {
    id: 'sw7', level: 'easy', max: 10, title: 'Hub กับ Switch ต่างกันอย่างไร',
    desc: 'ทางซ้ายเป็นเครือข่ายที่ใช้ Hub (PC1–PC4) ทางขวาใช้ Switch (PC5–PC8) ให้ 1) PC1 ping PC2 และ 2) PC5 ping PC6 ' +
      'แล้วดู trace ว่าเฟรม ICMP Echo Request ไปถึงการ์ดแลนของเครื่องใดบ้าง (แม้เครื่องนั้นจะทิ้งเพราะไม่ใช่ของตัวเอง) และนับจำนวน collision domain ของแต่ละฝั่ง',
    hints: [
      'Hub ทำงานที่ Layer 1 ทวนสัญญาณออกทุกพอร์ต ทุกพอร์ตของ Hub จึงอยู่ใน collision domain เดียวกัน',
      'แต่ละพอร์ตของสวิตช์เป็น collision domain ของตัวเอง',
      'หลัง ARP สวิตช์รู้แล้วว่าเครื่องปลายทางอยู่พอร์ตใด จึงส่ง Echo Request ออกพอร์ตเดียว'
    ],
    start: { kind: 'hub', lock: true, topo: T7, focus: 'sw1', required: [{ src: 'pc1', dst: 'pc2' }, { src: 'pc5', dst: 'pc6' }], hub: 'hub1', sw: 'sw1' }
  }
];
missions.forEach(m => { m.start.topo = SW.normalize(m.start.topo); });

/* ---------- shared grading helpers ---------- */
function zero(max, msg) { return { score: 0, max, ok: false, feedback: [msg], details: { error: true } }; }
function done(score, max, feedback, details, good, partial) {
  score = Math.max(0, Math.min(max, r1(score)));
  if (score >= max) feedback.unshift(good);
  /* 6.x: missions that ask for observed values (sw1, sw2, sw5, sw7) pass `partial`: below full marks only which of the
     student's own answers are wrong is returned, never the right values (the answer key) */
  return { score, max, ok: score >= max, feedback, details: score >= max || partial === undefined ? details : partial };
}
const devOf = (topo, id) => topo.devices.find(d => d.id === id);
const nameOf = (topo, id) => { const d = devOf(topo, id); return d ? d.name : id; };
/* the switch port a PC plugs into (direct link) */
function hostPort(topo, pcId) {
  for (const l of topo.links) {
    if (l.a === pcId && devOf(topo, l.b).type === 'switch') return { sw: l.b, port: l.bp };
    if (l.b === pcId && devOf(topo, l.a).type === 'switch') return { sw: l.a, port: l.ap };
  }
  return null;
}
function checkPayload(p, max) {
  if (!isObj(p)) return zero(max, 'ข้อมูลที่ส่งมาไม่ถูกต้อง (ต้องเป็น object ที่มี config / actions / answers)');
  let size = 0;
  try { size = JSON.stringify(p).length; } catch (e) { return zero(max, 'ข้อมูลที่ส่งมาไม่ถูกต้อง'); }
  if (size > MAX_JSON) return zero(max, 'ข้อมูลที่ส่งมาใหญ่เกินไป');
  if (p.actions !== undefined && (!Array.isArray(p.actions) || p.actions.length > SW.MAX_ACTIONS)) return zero(max, `รายการการกระทำ (actions) ไม่ถูกต้อง หรือมีมากเกิน ${SW.MAX_ACTIONS} รายการ`);
  if (p.answers !== undefined && !isObj(p.answers)) return zero(max, 'คำตอบที่ส่งมาไม่ถูกต้อง');
  return null;
}
/* the trusted topology for this submission */
function buildTopo(m, p) {
  if (m.start.lock) return { ok: true, topo: m.start.topo };
  return SW.applyConfig(m.start.topo, p.config);
}
const ipOf = (topo, id) => { const d = devOf(topo, id); return d ? d.ip : ''; };
/* index of each required ping in the action log (in order); -1 if missing */
function requiredDone(m, actions, results) {
  const topo = m.start.topo;
  let from = 0;
  return m.start.required.map(rq => {
    for (let i = from; i < results.length; i++) {
      const a = actions[i], r = results[i];
      if (r && r.op === 'ping' && a.src === rq.src && a.dst === ipOf(topo, rq.dst)) { from = i + 1; return { i, ok: r.ok, r }; }
    }
    return { i: -1, ok: false };
  });
}
const pingLabel = (topo, rq) => `${nameOf(topo, rq.src)} ping ${nameOf(topo, rq.dst)}`;
/* switch-side drop reasons in a ping trace, in Thai, with exact device/port */
function dropNotes(net, res) {
  const out = [];
  for (const e of res.entries || []) {
    if (e.action !== 'drop') continue;
    const d = net.dev(e.dev);
    if (!d || d.type !== 'switch') continue;
    const s = `${d.name} ${P(e.port)} ทิ้งเฟรม${e.vlan ? ' VLAN ' + e.vlan : ''}: ${SW.DROP_TEXT[e.reason] || e.reason}`;
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, 3);
}
const sortU = a => [...new Set(a)].sort();
const sameSet = (a, b) => { const x = sortU(a), y = sortU(b); return x.length === y.length && x.every((v, i) => v === y[i]); };
const strList = (v, allowed, max) => Array.isArray(v) ? v.slice(0, max || 32).filter(x => typeof x === 'string' && allowed.includes(x)) : [];

/* connectivity matrix + broadcast isolation for group missions (sw3, sw4, sw6) */
function matrix(m, topo, intended) {
  const net = SW.create(topo);
  const hosts = topo.devices.filter(d => d.type === 'pc');
  const pairs = [];
  for (let i = 0; i < hosts.length; i++) for (let j = i + 1; j < hosts.length; j++) {
    const a = hosts[i], b = hosts[j];
    if (a.group !== b.group) continue;
    const r = net.ping(a.id, b.ip);
    pairs.push({ a: a.id, b: b.id, ok: r.ok, reason: r.reason, notes: r.ok ? [] : dropNotes(net, r) });
  }
  const iso = hosts.map(h => {
    const n2 = SW.create(topo);
    const r = n2.broadcast(h.id);
    const want = hosts.filter(x => x.id !== h.id && x.group === h.group).map(x => x.id);
    const extra = r.reached.filter(x => !want.includes(x)), missing = want.filter(x => !r.reached.includes(x));
    return { id: h.id, ok: !r.storm && !extra.length && !missing.length, extra, missing, storm: r.storm };
  });
  // port check: each host's switch port is an access port in its intended VLAN
  const ports = hosts.map(h => {
    const hp = hostPort(topo, h.id), want = intended[h.group];
    const swd = devOf(topo, hp.sw), f = swd.ifs[hp.port];
    return { id: h.id, sw: hp.sw, port: hp.port, want, mode: f.mode, vlan: f.vlan, ok: f.mode === 'access' && f.vlan === want && swd.vlans[want] !== undefined };
  });
  return { pairs, iso, ports, net };
}
function pairFeedback(topo, pairs, fb, limit) {
  let n = 0;
  for (const p of pairs) {
    if (p.ok) continue;
    if (n++ >= (limit || 4)) { fb.push('…และยังมีคู่อื่นที่ ping ไม่ได้'); break; }
    fb.push(`${nameOf(topo, p.a)} ping ${nameOf(topo, p.b)} ไม่ได้ (อยู่กลุ่มเดียวกันต้อง ping ได้): ${SW.REASON_TEXT[p.reason] || p.reason}` + (p.notes.length ? ' — พบว่า ' + p.notes.join('; ') : ''));
  }
}
function isoFeedback(topo, iso, fb) {
  const leak = iso.filter(x => x.extra.length);
  if (leak.length) {
    const x = leak[0];
    fb.push(`broadcast จาก ${nameOf(topo, x.id)} ยังไปถึง ${x.extra.map(id => nameOf(topo, id)).join(', ')} ซึ่งอยู่อีกกลุ่ม: แต่ละ VLAN ต้องเป็น broadcast domain แยกกัน` + (leak.length > 1 ? ` (มีอีก ${leak.length - 1} เครื่องที่ broadcast รั่วข้ามกลุ่ม)` : ''));
  }
  if (iso.some(x => x.storm)) fb.push('ทดสอบ broadcast แล้วเกิด broadcast storm (มี loop และ STP ถูกปิด)');
}
function portFeedback(topo, ports, fb) {
  for (const p of ports) {
    if (p.ok) continue;
    const swd = devOf(topo, p.sw);
    if (p.mode !== 'access') fb.push(`${swd.name} ${P(p.port)} (ต่อ ${nameOf(topo, p.id)}) เป็น ${p.mode} แต่พอร์ตที่ต่อ PC ควรเป็น access VLAN ${p.want}`);
    else if (swd.vlans[p.want] === undefined && p.vlan === p.want) fb.push(`${swd.name} ${P(p.port)} อยู่ VLAN ${p.want} แต่ยังไม่ได้สร้าง VLAN ${p.want} บน ${swd.name} พอร์ตจึง inactive`);
    else fb.push(`${swd.name} ${P(p.port)} (ต่อ ${nameOf(topo, p.id)}) อยู่ VLAN ${p.vlan} แต่ตามแผนต้องอยู่ VLAN ${p.want}`);
  }
}

/* ---------- sw1: MAC learning ---------- */
function gradeMac(m, p) {
  const max = m.max, topo = m.start.topo, fb = [];
  const { net, results } = SW.run(topo, p.actions || []);
  const req = requiredDone(m, p.actions || [], results);
  let score = 0;
  req.forEach((x, k) => {
    if (x.i < 0) fb.push(`ยังไม่ได้ทำขั้นที่ ${k + 1}: ${pingLabel(topo, m.start.required[k])} (ต้องทำตามลำดับ)`);
    else if (!x.ok) fb.push(`ขั้นที่ ${k + 1} ${pingLabel(topo, m.start.required[k])} ไม่สำเร็จ: ${x.r.reasonText}`);
    else score += 1;
  });
  const allDone = req.every(x => x.i >= 0 && x.ok);
  const a = p.answers || {};
  const table = isObj(a.table) ? a.table : {};
  const swd = devOf(topo, 'sw1');
  const ports = swd.portList.map(x => x.name);
  const real = net.macTable('sw1');
  const hosts = topo.devices.filter(d => d.type === 'pc');
  const per = 7 / hosts.length;
  let tpts = 0;
  const rows = {};
  for (const h of hosts) {
    const e = real.find(x => x.mac === h.mac && x.vlan === 1);
    const want = e ? e.port : 'none';
    const got = typeof table[h.id] === 'string' && (table[h.id] === 'none' || ports.includes(table[h.id])) ? table[h.id] : null;
    rows[h.id] = { want, got };
    if (got === want) tpts += per;
    else if (got === null) fb.push(`ยังไม่ได้กรอกแถวของ ${h.name} (${h.mac})`);
    else if (got === 'none') fb.push(`แถวของ ${h.name} (${h.mac}): คุณตอบว่า "ไม่อยู่ในตาราง" ซึ่งไม่ถูกต้อง — ทบทวนว่าในการ ping ที่ทำ เครื่องนี้เคยส่งเฟรม (เช่น ARP หรือ echo reply) เข้า SW1 หรือยัง`);
    else fb.push(`แถวของ ${h.name} (${h.mac}): คุณตอบ ${P(got)} ซึ่งไม่ถูกต้อง — สวิตช์บันทึก source MAC กับพอร์ตที่ "รับ" เฟรมนั้นเข้ามา และบันทึกเฉพาะเครื่องที่เคยส่งเฟรมเข้าสวิตช์แล้ว` + (devOf(topo, 'hub1') ? ' (เครื่องที่อยู่หลัง Hub เข้าสวิตช์ทางพอร์ตเดียวกับที่ Hub ต่ออยู่)' : '') + ' ดูได้ด้วย show mac address-table');
  }
  if (!allDone) { if (tpts > 0) fb.push('คะแนนตาราง MAC จะนับเมื่อ ping ครบทั้ง 3 ขั้นตามลำดับแล้วเท่านั้น (ต้องสร้างทราฟฟิกจริงก่อน)'); tpts = 0; }
  score += tpts;
  const mine = {}; Object.keys(rows).forEach(k => { mine[k] = { got: rows[k].got, ok: rows[k].got === rows[k].want }; });
  return done(score, max, fb, { required: req.map(x => x.i), table: rows, macTable: real }, 'ยอดเยี่ยม! ตาราง MAC ที่กรอกตรงกับที่ SW1 เรียนรู้จริงทุกแถว',
    { required: req.map(x => x.i), table: mine });
}

/* ---------- sw2: ARP step by step ---------- */
function gradeArp(m, p) {
  const max = m.max, topo = m.start.topo, fb = [], ask = m.start.ask;
  const { net, results } = SW.run(topo, p.actions || []);
  const A = devOf(topo, ask.from), B = devOf(topo, ask.to);
  const idx = results.findIndex((r, i) => r && r.op === 'ping' && p.actions[i].src === A.id && p.actions[i].dst === B.ip && r.arp);
  if (idx < 0) return done(0, max, [`ยังไม่พบการ ${A.name} ping ${B.name} (${B.ip}) ที่มีการส่ง ARP ในงานของคุณ: กด Ping ก่อนแล้วไล่ดู trace` + (results.some((r, i) => r && r.op === 'ping' && p.actions[i].src === A.id && p.actions[i].dst === B.ip) ? ' (ping ที่ทำไปไม่ได้ส่ง ARP เพราะมี entry ใน ARP cache อยู่แล้ว ลองกด "ล้างตาราง MAC/ARP" แล้ว ping ใหม่)' : '')], { found: false }, '');
  const res = results[idx];
  let score = 2;
  const E = res.entries;
  const reqE = E.find(e => e.action === 'send' && e.dev === A.id && e.frame.kind === 'arp-req');
  const swEntry = E.find(e => e.dev === ask.sw && reqE && e.frame.id === reqE.frame.id);
  const wantOut = swEntry ? swEntry.out.slice() : [];
  const recv = reqE ? sortU(E.filter(e => e.frame.id === reqE.frame.id && net.dev(e.dev).type === 'pc' && e.dev !== A.id && e.action !== 'send').map(e => e.dev)) : [];
  const repE = E.find(e => e.action === 'send' && e.frame.kind === 'arp-rep' && e.frame.dst === A.mac);
  const swRep = repE ? E.find(e => e.dev === ask.sw && e.frame.id === repE.frame.id) : null;
  const wantRep = swRep && swRep.out.length === 1 ? swRep.out[0] : 'none';
  const arpA = net.arp(A.id).find(x => x.ip === B.ip);
  const wantMac = arpA ? arpA.mac : 'none';
  const wantBhasA = net.arp(B.id).some(x => x.ip === A.ip && x.mac === A.mac);
  const a = p.answers || {};
  const swd = devOf(topo, ask.sw), swPorts = swd.portList.map(x => x.name);
  const pcs = topo.devices.filter(d => d.type === 'pc').map(d => d.id);
  const q1 = strList(a.reqPorts, swPorts, 20), q2 = strList(a.reqHosts, pcs, 20);
  const q3 = typeof a.repPort === 'string' ? a.repPort : '';
  const q4 = typeof a.arpMac === 'string' ? a.arpMac : '', q5 = a.bHasA === true ? true : a.bHasA === false ? false : null;
  if (sameSet(q1, wantOut)) score += 2;
  else fb.push(`ข้อ 1: พอร์ตที่คุณเลือก (${q1.map(P).join(', ') || 'ไม่ได้เลือก'}) ไม่ถูกต้อง — ARP request เป็น broadcast: ${swd.name} flood ออกทุกพอร์ตใน VLAN เดียวกัน ยกเว้นพอร์ตที่รับเฟรมเข้ามา ไล่ดู trace ของเฟรมนี้ที่ ${swd.name} อีกครั้ง`);
  if (sameSet(q2, recv)) score += 2;
  else fb.push(`ข้อ 2: เครื่องที่คุณเลือก (${q2.map(id => nameOf(topo, id)).join(', ') || 'ไม่ได้เลือก'}) ไม่ถูกต้อง — broadcast ไปถึงทุกเครื่องใน broadcast domain เดียวกัน รวมถึงเครื่องที่อยู่หลังสวิตช์ตัวอื่น`);
  if (q3 === wantRep) score += 2;
  else fb.push(`ข้อ 3: คุณตอบ ${q3 ? (q3 === 'none' ? '(ไม่ได้ส่งออก)' : P(q3)) : '(ไม่ได้ตอบ)'} ซึ่งไม่ถูกต้อง — ARP reply เป็น unicast ถึง ${A.name} ${swd.name} ส่งออกพอร์ตเดียว คือพอร์ตที่เรียนรู้ MAC ของ ${A.name} ไว้ตอนรับ ARP request`);
  let p4 = 0;
  if (q4 === wantMac) p4 += 1;
  else fb.push(`ข้อ 4: MAC ที่คุณตอบ (${q4 || 'ไม่ได้ตอบ'}) ไม่ถูกต้อง — ARP cache ของ ${A.name} เก็บ MAC ที่ได้จาก ARP reply (ไม่ใช่ ffff.ffff.ffff และไม่ใช่ MAC ของสวิตช์) เปิด ARP cache ของ ${A.name} ดูอีกครั้ง`);
  if (q5 === wantBhasA) p4 += 1;
  else fb.push(`ข้อ 5: คำตอบไม่ถูกต้อง — ทบทวนว่า ${B.name} ได้ข้อมูล IP/MAC ของผู้ถามจาก ARP request ที่ได้รับหรือไม่ แล้วเปิด ARP cache ของ ${B.name} ตรวจ`);
  score += p4;
  return done(score, max, fb, { found: true, reqPorts: wantOut, reqHosts: recv, repPort: wantRep, arpMac: wantMac, bHasA: wantBhasA }, 'ยอดเยี่ยม! อ่าน trace ของ ARP และ ping ได้ถูกต้องทุกข้อ',
    { found: true, ok: { reqPorts: sameSet(q1, wantOut), reqHosts: sameSet(q2, recv), repPort: q3 === wantRep, arpMac: q4 === wantMac, bHasA: q5 === wantBhasA } });
}

/* ---------- sw3: VLANs on one switch ---------- */
function gradeVlan(m, p) {
  const max = m.max, fb = [];
  const b = buildTopo(m, p);
  if (!b.ok) return zero(max, b.error);
  const topo = b.topo, s = devOf(topo, 'sw1');
  let score = 0;
  for (const [name, id] of Object.entries(m.start.groups)) {
    if (s.vlans[id] === undefined) fb.push(`SW1 ยังไม่มี VLAN ${id} (สร้างด้วย vlan ${id} แล้ว name ${name})`);
    else if (String(s.vlans[id]).toUpperCase() !== name) { score += 0.5; fb.push(`VLAN ${id} บน SW1 ชื่อ "${s.vlans[id]}" แต่ต้องชื่อ ${name}`); }
    else score += 1;
  }
  const M = matrix(m, topo, m.start.groups);
  score += M.ports.filter(x => x.ok).length * 0.5;
  portFeedback(topo, M.ports, fb);
  score += M.pairs.filter(x => x.ok).length * (3 / M.pairs.length);
  pairFeedback(topo, M.pairs, fb);
  score += M.iso.filter(x => x.ok).length * (2 / M.iso.length);
  isoFeedback(topo, M.iso, fb);
  return done(score, max, fb, { pairs: M.pairs.map(x => ({ a: x.a, b: x.b, ok: x.ok })), iso: M.iso, ports: M.ports },
    'ยอดเยี่ยม! VLAN 10 (LAB) และ VLAN 20 (OFFICE) แยก broadcast domain กันแล้ว เครื่องในห้องเดียวกัน ping กันได้ ข้าม VLAN ไม่ได้เพราะไม่มี Router');
}

/* trunk hygiene shared by sw4 / sw6 */
function trunkCheck(m, topo, fb, opts) {
  const t = m.start.trunk, A = devOf(topo, t.a), B = devOf(topo, t.b);
  const fa = A.ifs[t.port], fbb = B.ifs[t.port];
  const res = { modePts: 0, allowPts: 0, nativePts: 0, vlanPts: 0 };
  const okSet = [t.need.slice(), t.need.concat([t.native])].map(a => a.sort((x, y) => x - y).join(','));
  for (const [S, f] of [[A, fa], [B, fbb]]) {
    if (f.mode !== 'trunk') { fb.push(`${S.name} ${P(t.port)} ยังเป็น access (VLAN ${f.vlan}) ต้องตั้ง switchport mode trunk`); continue; }
    res.modePts += 0.5;
    if (f.allowed == null) fb.push(`${S.name} ${P(t.port)} อนุญาตทุก VLAN (all) บน trunk: ควรอนุญาตเฉพาะที่จำเป็น (${t.need.join(',')},${t.native}) เพื่อไม่ให้ broadcast ของ VLAN อื่นวิ่งข้ามสายโดยไม่จำเป็น`);
    else if (okSet.includes(f.allowed.join(','))) res.allowPts += 1;
    else {
      const miss = t.need.filter(v => !f.allowed.includes(v)), extra = f.allowed.filter(v => !t.need.includes(v) && v !== t.native);
      fb.push(`${S.name} ${P(t.port)} allowed VLAN = ${SW.vlanListStr(f.allowed)}` + (miss.length ? ` ขาด VLAN ${miss.join(',')} (เฟรมของ VLAN นี้จะถูกทิ้งที่ trunk)` : '') + (extra.length ? ` มี VLAN ${extra.join(',')} เกินมา` : ''));
      if (!miss.length) res.allowPts += 0.5;
    }
    if (S.vlans[t.native] === undefined) fb.push(`${S.name} ยังไม่มี VLAN ${t.native} ใน VLAN database (native VLAN ควรสร้างไว้และตั้งชื่อ เช่น NATIVE)`);
    else res.vlanPts += 0.5;
  }
  if (fa.mode === 'trunk' && fbb.mode === 'trunk') {
    if (fa.native !== fbb.native) fb.push(`native VLAN ไม่ตรงกัน: ${A.name} ${P(t.port)} = ${fa.native} แต่ ${B.name} ${P(t.port)} = ${fbb.native} (CDP แจ้ง NATIVE_VLAN_MISMATCH และ PVST+ จะ block พอร์ตใน VLAN ${fa.native} และ ${fbb.native}; ถ้าไม่มี STP เฟรมไม่มี tag จะรั่วข้าม VLAN)`);
    else if (fa.native !== t.native) { res.nativePts += 0.75; fb.push(`native VLAN ตรงกันทั้งสองฝั่ง (${fa.native}) แต่ตามแผนต้องเป็น VLAN ${t.native} ไม่ใช้ VLAN 1 เป็น native`); }
    else res.nativePts += 1.5;
  } else if (opts && opts.nativeOnlyIfTrunk) { /* reported above */ }
  return res;
}

/* ---------- sw4: trunk ---------- */
function gradeTrunk(m, p) {
  const max = m.max, fb = [];
  const b = buildTopo(m, p);
  if (!b.ok) return zero(max, b.error);
  const topo = b.topo;
  const M = matrix(m, topo, m.start.groups);
  let score = 0;
  // pairs that cross the trunk
  score += M.pairs.filter(x => x.ok).length * (3 / M.pairs.length);
  pairFeedback(topo, M.pairs, fb);
  score += M.iso.filter(x => x.ok).length * (1.5 / M.iso.length);
  isoFeedback(topo, M.iso, fb);
  const bad = M.ports.filter(x => !x.ok);
  if (bad.length) { portFeedback(topo, M.ports, fb); score -= Math.min(2, bad.length); }
  const t = trunkCheck(m, topo, fb);
  score += t.modePts + t.allowPts + t.nativePts + t.vlanPts;
  return done(score, max, fb, { pairs: M.pairs.map(x => ({ a: x.a, b: x.b, ok: x.ok })), iso: M.iso, trunk: t },
    'ยอดเยี่ยม! trunk 802.1Q ทำงานถูกต้อง: VLAN 10 และ 20 ข้ามสวิตช์ได้ด้วย tag, allowed list มีเฉพาะที่จำเป็น และ native VLAN 99 ตรงกันทั้งสองฝั่ง');
}

/* ---------- sw5: STP ---------- */
function gradeStp(m, p) {
  const max = m.max, fb = [], v = m.start.vlan;
  const b = buildTopo(m, p);
  if (!b.ok) return zero(max, b.error);
  const topo = b.topo;
  const net = SW.create(topo);
  const sws = topo.devices.filter(d => d.type === 'switch');
  let score = 0;
  const on = sws.filter(s => net.stpOn(s.id, v));
  score += on.length * 0.5;
  sws.filter(s => !net.stpOn(s.id, v)).forEach(s => fb.push(`${s.name} ยังปิด Spanning Tree ของ VLAN ${v} อยู่ (ใช้คำสั่ง spanning-tree vlan ${v})`));
  const st = net.stp(v);
  const rootSw = devOf(topo, m.start.root);
  const isRoot = on.length === sws.length && st.roots.length === 1 && st.roots[0] === rootSw.id;
  if (isRoot) score += 2.5;
  else if (on.length === sws.length) {
    const cur = devOf(topo, st.roots[0]);
    fb.push(`Root Bridge ตอนนี้คือ ${cur ? cur.name : '?'} (priority ${st.bridges[st.roots[0]].bid.prio}, MAC ${st.bridges[st.roots[0]].bid.mac}) ไม่ใช่ ${rootSw.name}: ตั้ง priority ของ ${rootSw.name} ให้ต่ำกว่าตัวอื่น เช่น spanning-tree vlan ${v} priority 4096`);
  } else fb.push(`ยังเลือก Root Bridge ไม่ได้จนกว่าจะเปิด STP บนทุกสวิตช์`);
  // blocked port answer vs the engine's state
  const blocked = Object.values(st.ports).filter(x => x.state === 'BLK').map(x => x.sw + '|' + x.port).sort();
  const a = p.answers || {};
  const ans = typeof a.blocked === 'string' ? a.blocked : '';
  if (on.length < sws.length) fb.push('ข้อ "พอร์ตที่ถูก block" จะตรวจได้เมื่อเปิด STP ครบทุกสวิตช์');
  else if (blocked.length === 1 && ans === blocked[0]) score += 3;
  else if (!ans) fb.push('ยังไม่ได้ระบุพอร์ตที่ถูก block');
  else {
    const [ad, ap] = ans.split('|');
    fb.push(`พอร์ตที่คุณระบุ (${nameOf(topo, ad)} ${P(ap || '')}) ไม่ใช่พอร์ตที่ถูก block (Alternate, BLK) ในเครือข่ายของคุณ — บนลิงก์ที่ไม่ได้ไป Root ฝั่งที่มี root path cost สูงกว่า (ถ้าเท่ากัน ฝั่งที่ Bridge ID สูงกว่า) จะถูก block ตรวจด้วย show spanning-tree`);
  }
  // proof: a successful ping after the final configuration, with no storm in the replay
  const { results } = SW.run(topo, p.actions || []);
  const rq = m.start.required[0];
  const okPing = results.some((r, i) => r && r.op === 'ping' && r.ok && p.actions[i].src === rq.src && p.actions[i].dst === ipOf(topo, rq.dst));
  const storm = results.some(r => r && r.storm);
  if (okPing && !storm) score += 3;
  else if (storm) fb.push('การทดสอบของคุณยังเกิด broadcast storm: เปิด STP ให้ครบแล้ว ping ใหม่ (การเปลี่ยนการตั้งค่าจะล้างประวัติการ ping)');
  else fb.push(`ยังไม่มีหลักฐานว่า ${pingLabel(topo, rq)} สำเร็จหลังตั้งค่าเสร็จ: กด Ping อีกครั้งหลังเปลี่ยนการตั้งค่าครั้งสุดท้าย`);
  return done(score, max, fb, { roots: st.roots, blocked, okPing, storm, stpOn: on.map(s => s.id) },
    `ยอดเยี่ยม! ${rootSw.name} เป็น Root Bridge, STP block พอร์ตเดียวเพื่อตัด loop และ ping ผ่านโดยไม่มี broadcast storm`,
    { roots: st.roots, okPing, storm, stpOn: on.map(s => s.id), blockedOk: on.length === sws.length && blocked.length === 1 && ans === blocked[0] });
}

/* ---------- sw6: troubleshooting ---------- */
function gradeFix(m, p) {
  const max = m.max, fb = [];
  const b = buildTopo(m, p);
  if (!b.ok) return zero(max, b.error);
  const topo = b.topo;
  const M = matrix(m, topo, m.start.groups);
  let score = M.pairs.filter(x => x.ok).length * (6 / M.pairs.length);
  pairFeedback(topo, M.pairs, fb, 3);
  if (M.iso.every(x => x.ok)) score += 1; else isoFeedback(topo, M.iso, fb);
  const t = trunkCheck(m, topo, fb);
  score += t.nativePts + t.allowPts * 0.75;   // allowed list both sides = 1.5
  // penalties: "fixing" by moving hosts to VLAN 1 / out of their planned VLAN
  const inV1 = M.ports.filter(x => x.vlan === 1 && x.mode === 'access');
  let pen = 0;
  if (inV1.length) { pen = 4; fb.push(`ห้ามแก้ด้วยการย้ายเครื่องไป VLAN 1: ${inV1.map(x => nameOf(topo, x.sw) + ' ' + P(x.port) + ' (' + nameOf(topo, x.id) + ')').join(', ')} อยู่ VLAN 1 ทำให้แผน VLAN เสียและทุกเครื่องเห็น broadcast ของกันหมด (หัก 4 คะแนน)`); }
  else {
    const wrong = M.ports.filter(x => !x.ok);
    if (wrong.length) { pen = Math.min(3, wrong.length); portFeedback(topo, wrong, fb); }
  }
  if (t.modePts < 1) pen += 1;
  score -= pen;
  return done(score, max, fb, { pairs: M.pairs.map(x => ({ a: x.a, b: x.b, ok: x.ok })), iso: M.iso, trunk: t, penalty: pen },
    'ยอดเยี่ยม! แก้ครบทั้งสามจุด: LAB2 กลับมาอยู่ VLAN 10, trunk ฝั่ง SW2 อนุญาต VLAN 20 แล้ว และ native VLAN 99 ตรงกันทั้งสองฝั่ง');
}

/* ---------- sw7: hub vs switch ---------- */
function gradeHub(m, p) {
  const max = m.max, topo = m.start.topo, fb = [];
  const { net, results } = SW.run(topo, p.actions || []);
  const req = requiredDone(m, p.actions || [], results);
  let score = 0;
  const a = p.answers || {};
  const recvOf = x => {
    if (!x || x.i < 0 || !x.ok) return null;
    const E = x.r.entries;
    const s = E.find(e => e.action === 'send' && e.frame.kind === 'icmp-req');
    return s ? sortU(E.filter(e => e.frame.id === s.frame.id && net.dev(e.dev).type === 'pc' && e.action !== 'send').map(e => e.dev)) : null;
  };
  const cdHub = net.collisionDomains(m.start.hub).length, cdSw = net.collisionDomains(m.start.sw).length;
  const pcs = topo.devices.filter(d => d.type === 'pc').map(d => d.id);
  const sides = [['hub', req[0], a.recvHub, 'ฝั่ง Hub'], ['sw', req[1], a.recvSw, 'ฝั่ง Switch']];
  const okAns = { hub: false, sw: false }, sideTh = k => (k === 'hub' ? 'ฝั่ง Hub' : 'ฝั่ง Switch');
  sides.forEach(([k, x, ans], i) => {
    const rq = m.start.required[i];
    if (x.i < 0) { fb.push(`ยังไม่ได้ ${pingLabel(topo, rq)}`); return; }
    if (!x.ok) { fb.push(`${pingLabel(topo, rq)} ไม่สำเร็จ: ${x.r.reasonText}`); return; }
    score += 1;
    const want = recvOf(x), got = sortU(strList(ans, pcs, 20));
    if (want && sameSet(got, want)) { score += 2; okAns[k] = true; }
    else fb.push(`${sideTh(k)}: เครื่องที่คุณเลือกว่าได้รับ Echo Request ของ ${pingLabel(topo, rq)} (${got.map(id => nameOf(topo, id)).join(', ') || 'ไม่ได้เลือก'}) ไม่ถูกต้อง — ` + (k === 'hub'
      ? 'ทบทวน: Hub ทำงานที่ Layer 1 ไม่อ่าน MAC address สัญญาณที่รับเข้ามาจะถูกส่งออกพอร์ตใดบ้าง (เครื่องที่ได้รับเฟรมแต่ MAC ไม่ตรงจะทิ้งเฟรมเอง)'
      : 'ทบทวน: เมื่อสวิตช์รู้แล้วว่า MAC ปลายทางอยู่พอร์ตไหน (เรียนรู้ตอน ARP) เฟรม unicast จะถูกส่งออกกี่พอร์ต'));
  });
  const nHub = Number(a.cdHub), nSw = Number(a.cdSw);
  if (nHub === cdHub) score += 2; else fb.push(`จำนวน collision domain ฝั่ง Hub ที่คุณตอบ (${isFinite(nHub) && a.cdHub !== '' && a.cdHub != null ? nHub : '-'}) ไม่ถูกต้อง — ทบทวน: เครื่องทุกเครื่องที่ต่อ Hub ใช้สื่อร่วมกันหรือไม่ ถ้าสองเครื่องส่งพร้อมกันจะชนกันหรือไม่`);
  if (nSw === cdSw) score += 2; else fb.push(`จำนวน collision domain ฝั่ง Switch ที่คุณตอบ (${isFinite(nSw) && a.cdSw !== '' && a.cdSw != null ? nSw : '-'}) ไม่ถูกต้อง — ทบทวน: สายแต่ละเส้นที่ต่อพอร์ตสวิตช์แยกเป็น collision domain ของตัวเองหรือไม่ แล้วนับพอร์ตที่มีสายต่ออยู่ฝั่ง Switch`);
  if (req.some(x => x.i < 0 || !x.ok)) { const cd = (nHub === cdHub ? 2 : 0) + (nSw === cdSw ? 2 : 0); if (cd) { score -= cd / 2; fb.push('คะแนนข้อ collision domain ได้ครึ่งเดียวจนกว่าจะ ping ครบทั้งสองฝั่ง'); } }
  return done(score, max, fb, { cdHub, cdSw, recvHub: recvOf(req[0]), recvSw: recvOf(req[1]) },
    'ยอดเยี่ยม! Hub: 1 collision domain และทุกเครื่องได้รับเฟรม · Switch: 1 collision domain ต่อพอร์ต และเฟรม unicast ไปถึงเฉพาะปลายทาง',
    { ok: { cdHub: nHub === cdHub, cdSw: nSw === cdSw, recvHub: okAns.hub, recvSw: okAns.sw } });
}

const GRADERS = { mac: gradeMac, arp: gradeArp, vlan: gradeVlan, trunk: gradeTrunk, stp: gradeStp, fix: gradeFix, hub: gradeHub };
function grade(missionId, payload) {
  const m = missions.find(x => x.id === missionId);
  if (!m) return zero(10, 'ไม่พบภารกิจนี้');
  try {
    const bad = checkPayload(payload, m.max);
    if (bad) return bad;
    return GRADERS[m.start.kind](m, payload);
  } catch (e) {
    return zero(m.max, 'ข้อมูลที่ส่งมาไม่ถูกต้อง ตรวจงานไม่ได้');
  }
}

module.exports = { id: 'switching', title: 'ห้องปฏิบัติการ Switching และ VLAN', missions, grade, _lib: { SW, hostPort } };
