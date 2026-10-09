'use strict';
// Question bank: Unit 8 (weeks 13-14) ออกแบบ ติดตั้ง ตรวจสอบ วิเคราะห์และแก้ปัญหาเครือข่าย

const host = (id, type, name, x, y, ip, prefix, gateway, extra) => Object.assign({
  id, type, name, x, y,
  ifaces: [{ name: 'eth0', ip, prefix, up: true }],
  gateway, dns: ['8.8.8.8'], dhcp: false
}, extra || {});
const dhcpHost = (id, name, x, y) => ({ id, type: 'pc', name, x, y, ifaces: [{ name: 'eth0', up: true }], dhcp: true });
const link = (id, a, ap, b, bp, up) => ({ id, a: { dev: a, port: ap }, b: { dev: b, port: bp }, medium: 'utp', up: up !== false });

// T1: small lab design, one LAN + router + internet
const TOPO_DESIGN = {
  devices: [
    { id: 'r1', type: 'router', name: 'Router1', x: 320, y: 60,
      ifaces: [{ name: 'g0/0', ip: '192.168.20.1', prefix: 24, up: true }, { name: 'g0/1', ip: '10.0.0.1', prefix: 30, up: true }],
      routes: [{ net: '0.0.0.0', prefix: 0, via: '10.0.0.2' }] },
    { id: 'net', type: 'internet', name: 'Internet', x: 540, y: 60,
      ifaces: [{ name: 'wan', ip: '10.0.0.2', prefix: 30, up: true }], hosts: { '8.8.8.8': 'dns.google' } },
    { id: 'sw1', type: 'switch', name: 'Switch1', x: 320, y: 170, ports: 24 },
    host('srv', 'server', 'Server', 100, 170, '192.168.20.10', 24, '192.168.20.1'),
    host('prn', 'printer', 'Printer', 540, 170, '192.168.20.20', 24, '192.168.20.1'),
    host('pc1', 'pc', 'PC1', 160, 280, '192.168.20.101', 24, '192.168.20.1'),
    host('pc2', 'pc', 'PC2', 320, 280, '192.168.20.102', 24, '192.168.20.1'),
    host('pc3', 'pc', 'PC3', 480, 280, '192.168.20.103', 24, '192.168.20.1')
  ],
  links: [
    link('l1', 'r1', 'g0/1', 'net', 'wan'),
    link('l2', 'r1', 'g0/0', 'sw1', 'p1'),
    link('l3', 'srv', 'eth0', 'sw1', 'p2'),
    link('l4', 'prn', 'eth0', 'sw1', 'p3'),
    link('l5', 'pc1', 'eth0', 'sw1', 'p4'),
    link('l6', 'pc2', 'eth0', 'sw1', 'p5'),
    link('l7', 'pc3', 'eth0', 'sw1', 'p6')
  ]
};

// T2: PC3 has an IP in another network
const TOPO_WRONG_NET = {
  devices: [
    { id: 'r1', type: 'router', name: 'Router1', x: 320, y: 50,
      ifaces: [{ name: 'g0/0', ip: '192.168.10.1', prefix: 24, up: true }] },
    { id: 'sw1', type: 'switch', name: 'Switch1', x: 320, y: 160, ports: 24 },
    host('srv', 'server', 'Server', 100, 160, '192.168.10.5', 24, '192.168.10.1'),
    host('pc1', 'pc', 'PC1', 160, 280, '192.168.10.11', 24, '192.168.10.1'),
    host('pc2', 'pc', 'PC2', 320, 280, '192.168.10.12', 24, '192.168.10.1'),
    host('pc3', 'pc', 'PC3', 480, 280, '192.168.11.13', 24, '192.168.10.1')
  ],
  links: [
    link('l1', 'r1', 'g0/0', 'sw1', 'p1'),
    link('l2', 'srv', 'eth0', 'sw1', 'p2'),
    link('l3', 'pc1', 'eth0', 'sw1', 'p3'),
    link('l4', 'pc2', 'eth0', 'sw1', 'p4'),
    link('l5', 'pc3', 'eth0', 'sw1', 'p5')
  ]
};

// T3: two LANs, PC3 has a wrong prefix (/25)
const TOPO_WRONG_MASK = {
  devices: [
    { id: 'r1', type: 'router', name: 'Router1', x: 320, y: 60,
      ifaces: [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24, up: true }, { name: 'g0/1', ip: '192.168.2.1', prefix: 24, up: true }] },
    { id: 'sw1', type: 'switch', name: 'Switch1', x: 160, y: 170, ports: 24 },
    { id: 'sw2', type: 'switch', name: 'Switch2', x: 480, y: 170, ports: 24 },
    host('pc1', 'pc', 'PC1', 60, 280, '192.168.1.10', 24, '192.168.1.1'),
    host('pc2', 'pc', 'PC2', 160, 280, '192.168.1.20', 24, '192.168.1.1'),
    host('pc3', 'pc', 'PC3', 260, 280, '192.168.1.130', 25, '192.168.1.1'),
    host('srv', 'server', 'Server', 480, 280, '192.168.2.10', 24, '192.168.2.1')
  ],
  links: [
    link('l1', 'r1', 'g0/0', 'sw1', 'p1'),
    link('l2', 'r1', 'g0/1', 'sw2', 'p1'),
    link('l3', 'pc1', 'eth0', 'sw1', 'p2'),
    link('l4', 'pc2', 'eth0', 'sw1', 'p3'),
    link('l5', 'pc3', 'eth0', 'sw1', 'p4'),
    link('l6', 'srv', 'eth0', 'sw2', 'p2')
  ]
};

// T4: PC3 has a wrong default gateway (given in the question text)
const TOPO_WRONG_GW = {
  devices: [
    { id: 'r1', type: 'router', name: 'Router1', x: 320, y: 60,
      ifaces: [{ name: 'g0/0', ip: '192.168.50.1', prefix: 24, up: true }, { name: 'g0/1', ip: '10.0.0.1', prefix: 30, up: true }],
      routes: [{ net: '0.0.0.0', prefix: 0, via: '10.0.0.2' }] },
    { id: 'net', type: 'internet', name: 'Internet', x: 540, y: 60,
      ifaces: [{ name: 'wan', ip: '10.0.0.2', prefix: 30, up: true }], hosts: { '8.8.8.8': 'dns.google' } },
    { id: 'sw1', type: 'switch', name: 'Switch1', x: 320, y: 170, ports: 24 },
    host('srv', 'server', 'Server', 100, 170, '192.168.50.5', 24, '192.168.50.1'),
    host('pc1', 'pc', 'PC1', 160, 280, '192.168.50.11', 24, '192.168.50.1'),
    host('pc2', 'pc', 'PC2', 320, 280, '192.168.50.12', 24, '192.168.50.1'),
    host('pc3', 'pc', 'PC3', 480, 280, '192.168.50.13', 24, '192.168.50.254')
  ],
  links: [
    link('l1', 'r1', 'g0/1', 'net', 'wan'),
    link('l2', 'r1', 'g0/0', 'sw1', 'p1'),
    link('l3', 'srv', 'eth0', 'sw1', 'p2'),
    link('l4', 'pc1', 'eth0', 'sw1', 'p3'),
    link('l5', 'pc2', 'eth0', 'sw1', 'p4'),
    link('l6', 'pc3', 'eth0', 'sw1', 'p5')
  ]
};

// T5: the DHCP server's cable is broken; PCs use DHCP
const TOPO_DHCP_DOWN = {
  devices: [
    { id: 'r1', type: 'router', name: 'Router1', x: 320, y: 50,
      ifaces: [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24, up: true }] },
    { id: 'sw1', type: 'switch', name: 'Switch1', x: 320, y: 160, ports: 24 },
    host('srv', 'server', 'DHCP-SRV', 100, 160, '192.168.1.5', 24, '192.168.1.1', {
      services: { dhcp: { start: '192.168.1.100', end: '192.168.1.199', prefix: 24, gateway: '192.168.1.1', dns: ['192.168.1.5'] } }
    }),
    dhcpHost('pc1', 'PC1', 160, 280),
    dhcpHost('pc2', 'PC2', 320, 280),
    dhcpHost('pc3', 'PC3', 480, 280)
  ],
  links: [
    link('l1', 'r1', 'g0/0', 'sw1', 'p1'),
    link('l2', 'srv', 'eth0', 'sw1', 'p2', false),
    link('l3', 'pc1', 'eth0', 'sw1', 'p3'),
    link('l4', 'pc2', 'eth0', 'sw1', 'p4'),
    link('l5', 'pc3', 'eth0', 'sw1', 'p5')
  ]
};

// T6: duplicate IP between PC2 and the printer
const TOPO_DUP_IP = {
  devices: [
    { id: 'r1', type: 'router', name: 'Router1', x: 320, y: 50,
      ifaces: [{ name: 'g0/0', ip: '192.168.1.1', prefix: 24, up: true }] },
    { id: 'sw1', type: 'switch', name: 'Switch1', x: 320, y: 160, ports: 24 },
    host('prn', 'printer', 'Printer', 540, 160, '192.168.1.12', 24, '192.168.1.1'),
    host('pc1', 'pc', 'PC1', 160, 280, '192.168.1.11', 24, '192.168.1.1'),
    host('pc2', 'pc', 'PC2', 320, 280, '192.168.1.12', 24, '192.168.1.1'),
    host('pc3', 'pc', 'PC3', 480, 280, '192.168.1.13', 24, '192.168.1.1')
  ],
  links: [
    link('l1', 'r1', 'g0/0', 'sw1', 'p1'),
    link('l2', 'prn', 'eth0', 'sw1', 'p2'),
    link('l3', 'pc1', 'eth0', 'sw1', 'p3'),
    link('l4', 'pc2', 'eth0', 'sw1', 'p4'),
    link('l5', 'pc3', 'eth0', 'sw1', 'p5')
  ]
};

module.exports = [
  // ---------------- Week 13: ออกแบบ ติดตั้ง และตรวจสอบเครือข่าย ----------------
  {
    id: 'u8-001', unit: 8, week: 13, level: 'easy', type: 'choice',
    q: 'ความสูงของอุปกรณ์ในตู้ Rack วัดเป็นหน่วย U โดย 1U มีความสูงเท่าใด',
    options: ['1.25 นิ้ว (ประมาณ 3.18 ซม.)', '1.75 นิ้ว (ประมาณ 4.45 ซม.)', '19 นิ้ว (ประมาณ 48.3 ซม.)', '3.5 นิ้ว (ประมาณ 8.89 ซม.)'],
    correct: 1,
    why: ['ไม่ใช่ค่ามาตรฐานของหน่วย U', '', '19 นิ้วคือความกว้างมาตรฐานของตู้ ไม่ใช่ความสูง 1U', '3.5 นิ้วคือความสูงของอุปกรณ์ขนาด 2U'],
    explain: 'ตู้ Rack มาตรฐานกว้าง 19 นิ้ว และวัดความสูงเป็นหน่วย U โดย 1U = 1.75 นิ้ว หรือประมาณ 4.45 เซนติเมตร',
    tags: ['rack', 'rack-unit']
  },
  {
    id: 'u8-002', unit: 8, week: 13, level: 'medium', type: 'fill',
    q: 'ในการเดินสาย UTP จริง สายถาวรจาก Patch Panel ถึงเต้ารับ (Permanent Link) ควรยาวไม่เกิน {{1}} เมตร และความยาวช่องสัญญาณทั้งหมดรวมสาย Patch Cord (Channel) ไม่เกิน {{2}} เมตร',
    blanks: [['90'], ['100']],
    explain: 'มาตรฐาน 10BASE-T ถึง 1000BASE-T กำหนด Channel ไม่เกิน 100 เมตร จึงนิยมให้ Permanent Link ไม่เกิน 90 เมตร และเผื่อประมาณ 10 เมตรสำหรับ Patch Cord ทั้งสองฝั่ง',
    tags: ['cabling', 'utp', 'distance']
  },
  {
    id: 'u8-003', unit: 8, week: 13, level: 'easy', type: 'match',
    q: 'จับคู่อุปกรณ์ในตู้ Rack กับหน้าที่ของอุปกรณ์',
    left: ['Patch Panel', 'Cable Manager', 'PDU', 'UPS'],
    right: [
      'จ่ายไฟให้อุปกรณ์ในตู้ (รางปลั๊กไฟ)',
      'สำรองไฟเมื่อไฟดับ ป้องกันอุปกรณ์ดับกะทันหัน',
      'รวมปลายสายถาวรจากทุกจุดให้เป็นระเบียบ',
      'แปลงชื่อโดเมนเป็น IP Address',
      'จัดแนวสาย Patch Cord ระหว่างแผงกับ Switch'
    ],
    answer: [2, 4, 0, 1],
    explain: 'Patch Panel รวมปลายสายถาวร Cable Manager จัดแนวสาย Patch Cord, PDU เป็นรางปลั๊กจ่ายไฟ และ UPS สำรองไฟเมื่อไฟดับ ส่วนการแปลงชื่อเป็นงานของ DNS',
    tags: ['rack', 'patch-panel', 'ups', 'pdu']
  },
  {
    id: 'u8-004', unit: 8, week: 13, level: 'medium', type: 'multi',
    q: 'ข้อมูลใดควรแสดงในแผนผังเครือข่ายเชิงตรรกะ (Logical Diagram) (เลือกได้หลายข้อ)',
    options: [
      'วง IP ของเครือข่าย เช่น 192.168.20.0/24',
      'ตำแหน่งโต๊ะและแนวเดินรางสายในฝ้า',
      'IP ของ Default Gateway',
      'เส้นทางที่ข้อมูลออกไปยังอินเทอร์เน็ต',
      'ความยาวสายจริงของแต่ละจุด'
    ],
    correct: [0, 2, 3],
    explain: 'แผนผังเชิงตรรกะบอกวง IP, Gateway และเส้นทางข้อมูล ส่วนตำแหน่งจริง แนวเดินสาย และความยาวสายเป็นข้อมูลของแผนผังเชิงกายภาพ (Physical)',
    tags: ['design', 'network-diagram', 'logical']
  },
  {
    id: 'u8-005', unit: 8, week: 13, level: 'medium', type: 'choice',
    q: 'อาคารเรียน 4 ชั้น ชั้นละ 2 ห้องแล็บ มีห้องเซิร์ฟเวอร์อยู่ชั้น 1 ควรออกแบบโครงสร้างเครือข่ายแบบใด',
    options: [
      'Bus โดยเดินสายโคแอกเชียลเส้นเดียวผ่านทุกชั้นเรียน',
      'Ring โดยต่อห้องแล็บทุกห้องเป็นวงกลมรอบอาคาร',
      'Peer-to-Peer โดยต่อเครื่องถึงกันโดยตรงทุกคู่',
      'Extended Star มี Switch หลักและ Switch ประจำชั้น'
    ],
    correct: 3,
    explain: 'เครือข่ายขนาดกลาง เช่น อาคารหลายชั้น นิยมใช้ Extended Star คือมี Switch หลัก (Core) ในห้องเซิร์ฟเวอร์ แล้วเดินสายไปยัง Switch ประจำชั้นหรือประจำห้อง ดูแลและขยายง่าย',
    tags: ['design', 'extended-star', 'topology']
  },
  {
    id: 'u8-006', unit: 8, week: 13, level: 'medium', type: 'choice',
    q: 'วง 192.168.20.0/24 ตั้งให้ DHCP แจก IP ช่วง 192.168.20.100 ถึง 192.168.20.200 ช่างต้องการตั้ง IP คงที่ให้เครื่องพิมพ์ใหม่ ข้อใดเหมาะสมที่สุด',
    options: ['192.168.20.150', '192.168.20.21', '192.168.20.255', '192.168.21.20'],
    correct: 1,
    why: ['อยู่ในช่วงที่ DHCP แจก อาจเกิด IP ซ้ำ', '', 'เป็น Broadcast Address ของวง ใช้กับเครื่องไม่ได้', 'อยู่คนละวงกับเครื่องอื่น ติดต่อกันโดยตรงไม่ได้'],
    explain: 'IP คงที่ควรอยู่ในวงเดียวกันและอยู่นอกช่วงที่ DHCP แจก การแยกช่วง Static กับ DHCP ไม่ให้ทับกันช่วยป้องกันปัญหา IP ซ้ำ',
    tags: ['ip-plan', 'static', 'dhcp']
  },
  {
    id: 'u8-007', unit: 8, week: 13, level: 'easy', type: 'diagram', topo: TOPO_DESIGN,
    q: 'ภาพแสดงแผนผังเครือข่ายห้องแล็บที่ออกแบบไว้ เครื่อง PC1 ถึง PC3 ควรตั้ง Default Gateway เป็นค่าใด',
    answerType: 'choice',
    options: ['192.168.20.1', '10.0.0.2', '192.168.20.10', '10.0.0.1'],
    correct: 0,
    explain: 'Default Gateway ต้องเป็น IP ของเราเตอร์ที่อยู่ในวงเดียวกับเครื่อง คือขา g0/0 ของ Router1 = 192.168.20.1 ส่วน 10.0.0.x เป็นวงฝั่งอินเทอร์เน็ต และ 192.168.20.10 เป็นเซิร์ฟเวอร์',
    tags: ['design', 'gateway', 'diagram']
  },
  {
    id: 'u8-008', unit: 8, week: 13, level: 'medium', type: 'order',
    q: 'เรียงขั้นตอนการเดินสายและติดตั้งเครือข่ายในห้องแล็บให้ถูกต้อง',
    items: [
      'สำรวจพื้นที่และกำหนดตำแหน่งตู้ Rack',
      'วัดระยะจากตู้ถึงแต่ละจุดและคำนวณความยาวสาย',
      'เดินสายในรางแล้วเข้าหัวที่ Patch Panel และเต้ารับ',
      'ทดสอบสายทุกเส้นด้วย LAN Tester และบันทึกผล',
      'ต่อ Patch Cord เข้า Switch และเข้าเครื่อง',
      'เปิดเครื่องและตรวจด้วย ipconfig และ ping'
    ],
    explain: 'ต้องวางตำแหน่งตู้และวัดระยะก่อนเดินสาย เข้าหัวแล้วจึงทดสอบสายด้วย LAN Tester ก่อนต่อ Patch Cord และสุดท้ายตรวจการตั้งค่าด้วย ipconfig และ ping',
    tags: ['cabling', 'installation']
  },
  {
    id: 'u8-009', unit: 8, week: 13, level: 'easy', type: 'tf',
    q: 'ในผลคำสั่ง netstat -an บรรทัดที่เป็น UDP จะไม่มีค่าในคอลัมน์ State เพราะ UDP ไม่มีการสร้างการเชื่อมต่อ',
    answer: true,
    explain: 'คอลัมน์ State เช่น LISTENING หรือ ESTABLISHED ใช้กับ TCP เท่านั้น UDP ไม่มีการเชื่อมต่อจึงไม่มีสถานะ และช่อง Foreign Address มักแสดงเป็น *:*',
    tags: ['netstat', 'udp']
  },
  {
    id: 'u8-010', unit: 8, week: 13, level: 'medium', type: 'choice',
    q: 'ผล nslookup แสดงบรรทัด Non-authoritative answer: ก่อนคำตอบ ข้อใดอธิบายได้ถูกต้อง',
    options: [
      'DNS Server ตอบไม่ได้ ต้องเปลี่ยน DNS Server ทันที',
      'ชื่อโดเมนนี้ไม่มีอยู่ในระบบ DNS ต้องตรวจการสะกด',
      'คำตอบมาจาก DNS ที่ไม่ใช่เจ้าของโดเมน ถือว่าปกติ',
      'เครื่องยังไม่ได้ตั้งค่า DNS Server ใด ๆ เลย'
    ],
    correct: 2,
    why: ['ถ้าตอบไม่ได้จะขึ้น DNS request timed out', 'ชื่อที่ไม่มีจะขึ้น Non-existent domain', '', 'ถ้าไม่มี DNS Server จะถามไม่ได้ตั้งแต่ต้น'],
    explain: 'Non-authoritative answer แปลว่าได้คำตอบจาก DNS Server ที่ไม่ได้เป็นเจ้าของโดเมนนั้นโดยตรง (เช่น DNS ของ ISP ที่จำคำตอบไว้) ซึ่งเป็นเรื่องปกติ',
    tags: ['nslookup', 'dns']
  },
  {
    id: 'u8-011', unit: 8, week: 13, level: 'medium', type: 'command', os: 'windows',
    q: 'บน Windows ต้องการ ping เราเตอร์ 192.168.20.1 จำนวน 10 ครั้งเพื่อดูว่าสายมีข้อมูลสูญหายหรือไม่ จงพิมพ์คำสั่ง',
    accept: ['^ping(\\.exe)? [-/]n 10 192\\.168\\.20\\.1$', '^ping(\\.exe)? 192\\.168\\.20\\.1 [-/]n 10$'],
    example: 'ping -n 10 192.168.20.1',
    explain: 'ping บน Windows ส่ง 4 ครั้งตามค่าเริ่มต้น ตัวเลือก -n ใช้กำหนดจำนวนครั้ง ส่วน -t ส่งต่อเนื่องจนกด Ctrl + C (Linux ใช้ -c แทน)',
    tags: ['ping', 'windows', 'command']
  },
  {
    id: 'u8-012', unit: 8, week: 13, level: 'medium', type: 'command', os: 'windows',
    q: 'DNS Server ของสำนักงานตอบผิดปกติ จงพิมพ์คำสั่ง nslookup เพื่อถามชื่อ www.netlab.test จาก DNS Server 8.8.8.8 โดยตรง',
    accept: ['^nslookup www\\.netlab\\.test\\.? 8\\.8\\.8\\.8$'],
    example: 'nslookup www.netlab.test 8.8.8.8',
    explain: 'รูปแบบ nslookup ชื่อ DNS-Server ใช้ถาม DNS Server ตัวที่ระบุแทนตัวที่ตั้งไว้ในเครื่อง ถ้าตัวอื่นตอบได้แต่ตัวเดิมตอบไม่ได้ แสดงว่าปัญหาอยู่ที่ DNS Server เดิม',
    tags: ['nslookup', 'dns', 'command']
  },
  {
    id: 'u8-013', unit: 8, week: 13, level: 'easy', type: 'command', os: 'windows',
    q: 'จงพิมพ์คำสั่งบน Windows ที่แสดงการเชื่อมต่อและพอร์ตที่รอรับการเชื่อมต่อทั้งหมด โดยแสดงเป็นตัวเลขไม่แปลงเป็นชื่อ',
    accept: ['^netstat(\\.exe)? (-an|-na|-a -n|-n -a)$'],
    example: 'netstat -an',
    explain: 'netstat -an แสดงทั้งหมด (-a) รวมพอร์ตสถานะ LISTENING และแสดงเป็นตัวเลข (-n) ถ้าเพิ่ม -o จะเห็นหมายเลขโปรเซส (PID) ด้วย',
    tags: ['netstat', 'windows', 'command']
  },
  {
    id: 'u8-014', unit: 8, week: 13, level: 'hard', type: 'scenario',
    context: 'ผู้ใช้ในวิทยาลัยบ่นว่าเปิดเว็บไซต์ภายนอกช้ามาก ช่างจึงใช้ tracert ไปยังเว็บเซิร์ฟเวอร์ปลายทาง ได้ผลดังนี้ (192.168.30.1 คือเราเตอร์ของอาคาร 10.10.0.1 คือเราเตอร์หลักของวิทยาลัย)',
    pre: [
      'C:\\>tracert -d 203.0.113.80',
      '',
      'Tracing route to 203.0.113.80 over a maximum of 30 hops',
      '',
      '  1    <1 ms    <1 ms    <1 ms  192.168.30.1',
      '  2     2 ms     2 ms     3 ms  10.10.0.1',
      '  3   245 ms   251 ms   248 ms  198.51.100.1',
      '  4   249 ms   252 ms   250 ms  198.51.100.77',
      '  5   251 ms   250 ms   253 ms  203.0.113.80',
      '',
      'Trace complete.'
    ].join('\n'),
    steps: [
      { q: 'ข้อมูลไปถึงปลายทางหรือไม่', options: ['ไม่ถึง เพราะเวลาเกิน 200 ms', 'ไม่ถึง เพราะหยุดที่ hop 3', 'ถึง เพราะ hop สุดท้ายคือ 203.0.113.80', 'บอกไม่ได้ เพราะใช้ตัวเลือก -d'], correct: 2 },
      { q: 'ความช้าเริ่มเกิดที่ช่วงใด', options: ['ระหว่างเครื่องผู้ใช้กับเราเตอร์อาคาร', 'ระหว่าง hop 2 (เราเตอร์หลัก) กับ hop 3', 'ระหว่าง hop 4 กับเว็บเซิร์ฟเวอร์ปลายทาง', 'ทุก hop ช้าเท่ากันตั้งแต่ hop 1'], correct: 1 },
      { q: 'ควรทำอย่างไรต่อ', options: ['เปลี่ยนสาย LAN ของเครื่องผู้ใช้ทุกเครื่อง', 'ล้างแคช DNS ด้วย ipconfig /flushdns', 'รีสตาร์ท Switch ในห้องแล็บ', 'ตรวจลิงก์ไป ISP และแจ้ง ISP พร้อมผล tracert'], correct: 3 }
    ],
    explain: 'tracert จบด้วย Trace complete. และ hop สุดท้ายคือปลายทางจึงไปถึง เวลาเพิ่มจากราว 2 ms เป็นราว 250 ms ที่ hop 3 และคงที่หลังจากนั้น แสดงว่าช่วงที่ช้าคือลิงก์จากเราเตอร์หลักไปยังเครือข่ายของ ISP ไม่ใช่ที่เครื่องผู้ใช้',
    tags: ['tracert', 'latency', 'isp']
  },
  {
    id: 'u8-015', unit: 8, week: 13, level: 'hard', type: 'scenario',
    context: 'เจ้าของร้านค้า SME สังเกตว่าตอนกลางคืนเมาส์ในเครื่องสำนักงาน (192.168.1.25) ขยับเองและมีหน้าต่างเปิดขึ้นมา ทั้งที่ไม่เคยเปิดใช้การควบคุมระยะไกล ช่างจึงสั่ง netstat -an ได้ผลบางส่วนดังนี้',
    pre: [
      'C:\\>netstat -an',
      '',
      'Active Connections',
      '',
      '  Proto  Local Address          Foreign Address        State',
      '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING',
      '  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING',
      '  TCP    0.0.0.0:3389           0.0.0.0:0              LISTENING',
      '  TCP    192.168.1.25:3389      203.0.113.45:51022     ESTABLISHED',
      '  TCP    192.168.1.25:52344     203.0.113.80:443       ESTABLISHED',
      '  UDP    0.0.0.0:5353           *:*'
    ].join('\n'),
    steps: [
      { q: 'พอร์ต 3389 ที่เปิดรอรับอยู่เป็นของบริการใด', options: ['แชร์ไฟล์ (SMB)', 'เว็บ (HTTPS)', 'Remote Desktop (RDP)', 'แปลงชื่อ (DNS)'], correct: 2 },
      { q: 'บรรทัดใดบ่งชี้ว่ามีคนจากภายนอกกำลังควบคุมเครื่องอยู่ตอนนี้', options: ['0.0.0.0:445 สถานะ LISTENING', '192.168.1.25:3389 กับ 203.0.113.45 สถานะ ESTABLISHED', '192.168.1.25:52344 กับ 203.0.113.80:443 สถานะ ESTABLISHED', 'UDP 0.0.0.0:5353 ที่ไม่มีสถานะ'], correct: 1 },
      { q: 'ควรทำอย่างไรเป็นอันดับแรก', options: ['ตัดเครื่องออกจากเครือข่าย ปิด RDP แล้วเปลี่ยนรหัสผ่าน', 'ปล่อยไว้ เพราะเป็นการเชื่อมต่อเว็บตามปกติของเครื่อง', 'ล้างแคช DNS แล้วรีสตาร์ทเครื่องหนึ่งครั้ง', 'เปิดพอร์ต 3389 ที่เราเตอร์เพิ่มให้เชื่อมต่อเร็วขึ้น'], correct: 0 }
    ],
    explain: 'พอร์ต 3389 คือ RDP บรรทัด Local 192.168.1.25:3389 กับ Foreign 203.0.113.45 สถานะ ESTABLISHED แปลว่ามีเครื่องภายนอกเชื่อมต่อ Remote Desktop เข้ามาอยู่ ส่วนบรรทัดพอร์ต 443 คือเครื่องเราเปิดเว็บ HTTPS ตามปกติ ต้องตัดการเชื่อมต่อ ปิดการเข้าถึงระยะไกล เปลี่ยนรหัสผ่าน และแจ้งผู้ดูแล',
    tags: ['netstat', 'rdp', 'remote-access', 'security']
  },
  {
    id: 'u8-016', unit: 8, week: 13, level: 'medium', type: 'diagram', topo: TOPO_WRONG_NET,
    q: 'PC1 และ PC2 ping Server (192.168.10.5) ผ่าน แต่ PC3 ping ไม่ผ่าน ทุกเครื่องต่อ Switch ตัวเดียวกันและตั้ง Gateway 192.168.10.1 จากค่าในภาพ สาเหตุคือข้อใด',
    answerType: 'choice',
    options: [
      'Server ใช้ /24 ซึ่งรองรับจำนวนเครื่องได้ไม่พอ',
      'Router1 ต้องเปลี่ยนไปใช้ IP 192.168.10.254',
      'IP ของ PC3 อยู่คนละวงกับเครื่องอื่น',
      'PC3 ต้องต่อสายเข้า Router1 โดยตรงเท่านั้น'
    ],
    correct: 2,
    explain: 'PC3 ใช้ 192.168.11.13/24 ซึ่งอยู่คนละวงกับ 192.168.10.0/24 และ Gateway 192.168.10.1 ก็อยู่นอกวงของ PC3 จึงส่งข้อมูลไม่ได้ ต้องแก้ IP ของ PC3 ให้อยู่ในวง 192.168.10.x',
    tags: ['ip-config', 'wrong-network', 'diagram']
  },
  {
    id: 'u8-017', unit: 8, week: 13, level: 'easy', type: 'tf',
    q: 'ใน ipconfig /all ถ้าบรรทัด DHCP Enabled เป็น No แสดงว่าเครื่องนี้ตั้ง IP แบบคงที่ (Static) ด้วยตนเอง',
    answer: true,
    explain: 'DHCP Enabled: Yes แปลว่ารับ IP อัตโนมัติจาก DHCP ส่วน No แปลว่าผู้ดูแลกำหนด IP เอง (Static)',
    tags: ['ipconfig', 'dhcp', 'static']
  },

  // ---------------- Week 14: วิเคราะห์และแก้ปัญหาเครือข่าย ----------------
  {
    id: 'u8-018', unit: 8, week: 14, level: 'easy', type: 'order',
    q: 'เรียงลำดับการ ping เพื่อหาจุดที่เกิดปัญหา จากใกล้ที่สุดไปไกลที่สุด',
    items: [
      'ping 127.0.0.1 (Loopback)',
      'ping IP ของเครื่องตัวเอง',
      'ping Default Gateway',
      'ping IP ภายนอก เช่น 8.8.8.8',
      'ping ชื่อโดเมน เช่น www.google.com'
    ],
    explain: 'ลำดับ ping จากใกล้ไปไกลคือ Loopback, IP ตัวเอง, Gateway, IP ภายนอก และชื่อโดเมน ปัญหาอยู่ระหว่างขั้นที่ไม่ผ่านกับขั้นสุดท้ายที่ผ่าน',
    tags: ['ping-ladder', 'troubleshooting']
  },
  {
    id: 'u8-019', unit: 8, week: 14, level: 'medium', type: 'match',
    q: 'จับคู่ผลการ ping ตามลำดับขั้น กับตำแหน่งที่น่าจะเป็นต้นเหตุของปัญหา',
    left: ['ping 127.0.0.1 ไม่ผ่าน', 'ping Gateway ไม่ผ่าน (ขั้นก่อนหน้าผ่าน)', 'ping 8.8.8.8 ไม่ผ่าน (Gateway ผ่าน)', 'ping ชื่อโดเมนไม่ผ่าน (8.8.8.8 ผ่าน)'],
    right: [
      'เราเตอร์หรือการเชื่อมต่อของ ISP',
      'ซอฟต์แวร์ TCP/IP ภายในเครื่อง',
      'การแปลงชื่อ (DNS)',
      'สาย Switch หรือวง IP ระหว่างเครื่องกับเราเตอร์',
      'ไดรเวอร์ของเครื่องพิมพ์'
    ],
    answer: [1, 3, 0, 2],
    explain: 'Loopback ไม่ผ่านแปลว่า TCP/IP ในเครื่องผิดปกติ, Gateway ไม่ผ่านคือช่วงเครื่องถึงเราเตอร์, 8.8.8.8 ไม่ผ่านคือเราเตอร์หรือ ISP และชื่อไม่ผ่านแต่ IP ผ่านคือปัญหา DNS',
    tags: ['ping-ladder', 'troubleshooting']
  },
  {
    id: 'u8-020', unit: 8, week: 14, level: 'medium', type: 'multi',
    q: 'อาการใดบ่งบอกว่าปัญหาน่าจะมาจากสายสัญญาณ (เลือกได้หลายข้อ)',
    options: [
      'ไฟ Link ที่การ์ดแลนและพอร์ต Switch ไม่ติด',
      'การ์ดแลนมีเครื่องหมายตกใจใน Device Manager',
      'ipconfig ขึ้น Media disconnected',
      'ความเร็วการเชื่อมต่อตกเหลือ 100 Mbps',
      'ping IP ได้แต่ใช้ชื่อโดเมนไม่ได้'
    ],
    correct: [0, 2, 3],
    explain: 'สายขาด เข้าหัวผิด หรือยาวเกินทำให้ไฟ Link ไม่ติด Media disconnected หรือความเร็วตกเหลือ 100 Mbps ส่วนเครื่องหมายตกใจเป็นปัญหาไดรเวอร์ และใช้ IP ได้แต่ใช้ชื่อไม่ได้เป็นปัญหา DNS',
    tags: ['cabling', 'troubleshooting', 'symptoms']
  },
  {
    id: 'u8-021', unit: 8, week: 14, level: 'easy', type: 'fill',
    q: 'หลังแก้ไขให้ติดต่อ DHCP Server ได้แล้ว ใช้คำสั่ง ipconfig {{1}} เพื่อคืน IP เดิม แล้วใช้ ipconfig {{2}} เพื่อขอ IP ใหม่',
    blanks: [['/release', 'release'], ['/renew', 'renew']],
    explain: 'ipconfig /release คืน IP ที่ได้จาก DHCP และ ipconfig /renew ขอ IP ใหม่ ทำได้โดยไม่ต้องรีสตาร์ทเครื่อง',
    tags: ['ipconfig', 'dhcp', 'apipa']
  },
  {
    id: 'u8-022', unit: 8, week: 14, level: 'easy', type: 'command', os: 'windows',
    q: 'บริษัทเพิ่งย้ายเว็บเซิร์ฟเวอร์ไปใช้ IP ใหม่ แต่เครื่องผู้ใช้ยังจำ IP เก่าไว้ จงพิมพ์คำสั่ง Windows ที่ใช้ล้างแคช DNS ในเครื่อง',
    accept: ['^ipconfig(\\.exe)? ?[/-]flushdns$'],
    example: 'ipconfig /flushdns',
    explain: 'ipconfig /flushdns ล้างคำตอบ DNS ที่เครื่องจำไว้ ครั้งต่อไปเครื่องจะถาม DNS Server ใหม่และได้ IP ปัจจุบัน',
    tags: ['ipconfig', 'dns', 'flushdns', 'command']
  },
  {
    id: 'u8-023', unit: 8, week: 14, level: 'easy', type: 'command', os: 'linux',
    q: 'บนเซิร์ฟเวอร์ Ubuntu ต้องการ ping Default Gateway 192.168.20.1 จำนวน 3 ครั้งแล้วหยุดเอง จงพิมพ์คำสั่ง',
    accept: ['^ping -c ?3 192\\.168\\.20\\.1$', '^ping 192\\.168\\.20\\.1 -c ?3$'],
    example: 'ping -c 3 192.168.20.1',
    explain: 'ping บน Linux ส่งไม่หยุดจนกด Ctrl + C ต้องใช้ -c ตามด้วยจำนวนครั้ง ตัวเลือก -n ของ Windows ใช้แทนไม่ได้',
    tags: ['ping', 'linux', 'command']
  },
  {
    id: 'u8-024', unit: 8, week: 14, level: 'easy', type: 'command', os: 'linux',
    q: 'บนเครื่อง Linux ต้องการดูว่าข้อมูลที่ส่งไป 8.8.8.8 ผ่านเราเตอร์ตัวใดบ้าง (คำสั่งที่เทียบเท่า tracert ของ Windows) จงพิมพ์คำสั่ง',
    accept: ['^traceroute (-n )?8\\.8\\.8\\.8$'],
    example: 'traceroute 8.8.8.8',
    explain: 'Linux ใช้ traceroute (ใส่ -n เพื่อไม่แปลง IP เป็นชื่อ เหมือน tracert -d) ส่วน tracert เป็นคำสั่งของ Windows ใน Ubuntu บางรุ่นต้องติดตั้งก่อนด้วย sudo apt install traceroute',
    tags: ['traceroute', 'linux', 'command']
  },
  {
    id: 'u8-025', unit: 8, week: 14, level: 'medium', type: 'command', os: 'windows',
    q: 'เครื่องในสำนักงานแจ้งเตือนว่ามี IP conflict ช่างต้องการดูตาราง ARP ของเครื่องเพื่อดูว่า IP แต่ละตัวในวงจับคู่กับ MAC Address ใด จงพิมพ์คำสั่งที่แสดงตาราง ARP ทั้งหมด',
    accept: ['^arp(\\.exe)? -[ag]$'],
    example: 'arp -a',
    explain: 'arp -a แสดงตาราง ARP คือรายการ IP คู่กับ MAC Address (Physical Address) ที่เครื่องรู้จัก ช่วยระบุว่าอุปกรณ์ใดกำลังใช้ IP ที่ชนกัน แล้วนำ MAC ไปเทียบกับรายการ DHCP ในเราเตอร์',
    tags: ['arp', 'ip-conflict', 'windows', 'command']
  },
  {
    id: 'u8-026', unit: 8, week: 14, level: 'medium', type: 'scenario',
    context: 'หลังไฟดับ เครื่องคิดเงินในร้านค้าเปิดระบบขายออนไลน์ไม่ได้ ไฟ Link ที่การ์ดแลนติดปกติ และเครื่องอื่นในร้านก็มีอาการเหมือนกัน ช่างสั่ง ipconfig ที่เครื่องคิดเงินได้ผลดังนี้',
    pre: [
      'C:\\>ipconfig',
      '',
      'Windows IP Configuration',
      '',
      '',
      'Ethernet adapter Ethernet:',
      '',
      '   Connection-specific DNS Suffix  . :',
      '   Link-local IPv6 Address . . . . . : fe80::5d1c:8a2f:3b7e:1a44%12',
      '   Autoconfiguration IPv4 Address. . : 169.254.201.17',
      '   Subnet Mask . . . . . . . . . . . : 255.255.0.0',
      '   Default Gateway . . . . . . . . . :'
    ].join('\n'),
    steps: [
      { q: 'ผลนี้บอกอะไร', options: ['เครื่องได้ IP จาก ISP โดยตรง', 'เครื่องขอ IP จาก DHCP ไม่สำเร็จ จึงตั้ง APIPA เอง', 'เครื่องตั้ง IP แบบ Static ไว้ถูกต้องแล้ว', 'DNS Server ของร้านแปลงชื่อผิด'], correct: 1 },
      { q: 'ไฟ Link ติดและทุกเครื่องเป็นเหมือนกัน ควรตรวจสิ่งใดก่อน', options: ['ไดรเวอร์การ์ดแลนของเครื่องคิดเงิน', 'เปลี่ยนสาย LAN ทุกเส้นในร้าน', 'ค่า DNS Server ในเครื่องคิดเงิน', 'เราเตอร์ที่เป็น DHCP Server ของร้าน'], correct: 3 },
      { q: 'เมื่อเราเตอร์กลับมาทำงานแล้ว ควรสั่งคำสั่งใดที่เครื่องคิดเงิน', options: ['ipconfig /release แล้ว /renew', 'ipconfig /flushdns อย่างเดียว', 'netstat -an แล้วรีสตาร์ท', 'tracert 169.254.201.17'], correct: 0 }
    ],
    explain: 'Autoconfiguration IPv4 Address 169.254.x.x กับ Mask 255.255.0.0 และไม่มี Gateway คือ APIPA เกิดเมื่อขอ IP จาก DHCP ไม่สำเร็จ เมื่อทุกเครื่องเป็นพร้อมกันและสายปกติ ต้นเหตุน่าจะอยู่ที่เราเตอร์ซึ่งเป็น DHCP Server แก้แล้วจึงสั่ง ipconfig /release และ /renew',
    tags: ['apipa', 'dhcp', 'ipconfig']
  },
  {
    id: 'u8-027', unit: 8, week: 14, level: 'hard', type: 'scenario',
    context: 'เครื่องครูในห้องแล็บ (10.1.5.40/24) ต้องการเปิดไฟล์จากเครื่อง NAS ที่ตั้ง IP 10.1.5.23 ในห้องเดียวกัน จึงทดสอบด้วย ping ได้ผลดังนี้',
    pre: [
      'C:\\>ping 10.1.5.23',
      '',
      'Pinging 10.1.5.23 with 32 bytes of data:',
      'Reply from 10.1.5.40: Destination host unreachable.',
      'Reply from 10.1.5.40: Destination host unreachable.',
      'Reply from 10.1.5.40: Destination host unreachable.',
      'Reply from 10.1.5.40: Destination host unreachable.',
      '',
      'Ping statistics for 10.1.5.23:',
      '    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),'
    ].join('\n'),
    steps: [
      { q: 'เครื่องครูติดต่อ NAS ได้หรือไม่', options: ['ได้ เพราะบรรทัดสรุปแสดง 0% loss', 'ได้ เพราะทุกบรรทัดขึ้นคำว่า Reply from', 'ไม่ได้ แม้บรรทัดสรุปจะแสดง 0% loss', 'บอกไม่ได้จนกว่าจะ ping ด้วย -t'], correct: 2 },
      { q: 'ใครเป็นผู้ส่งข้อความ Destination host unreachable', options: ['เครื่องครูเอง เพราะหา NAS ในวงไม่พบ', 'NAS ตอบกลับมาว่าปฏิเสธการเชื่อมต่อ', 'เราเตอร์ของ ISP ที่อยู่นอกวิทยาลัย', 'DNS Server ที่แปลงชื่อ NAS ไม่ได้'], correct: 0 },
      { q: 'ควรทำอย่างไรต่อ', options: ['เปลี่ยน DNS Server ของเครื่องครู', 'ตรวจว่า NAS เปิดอยู่ ต่อสาย และตั้ง IP ถูก', 'ตั้ง Default Gateway ของเครื่องครูเป็น 10.1.5.23', 'ล้างแคช DNS แล้ว ping ซ้ำ'], correct: 1 }
    ],
    explain: 'Reply from IP ของตัวเองพร้อม Destination host unreachable แปลว่าเครื่องครูหาเครื่องปลายทางในวงเดียวกันไม่พบ (ส่ง ARP แล้วไม่มีใครตอบ) Windows นับบรรทัดนี้เป็น Received จึงขึ้น 0% loss ทั้งที่ติดต่อไม่ได้ ต้องตรวจว่า NAS เปิด ต่อสาย และตั้ง IP ถูกต้อง',
    tags: ['ping', 'destination-host-unreachable', 'arp']
  },
  {
    id: 'u8-028', unit: 8, week: 14, level: 'medium', type: 'scenario',
    context: 'พนักงานในสำนักงานเปิดเว็บระบบงานภายใน www.netlab.test ไม่ได้ ตามแผนผังเครือข่าย DNS Server ของสำนักงานคือ 192.168.5.10 ช่างทดสอบที่เครื่องพนักงานได้ผลดังนี้',
    pre: [
      'C:\\>ping 8.8.8.8',
      '',
      'Pinging 8.8.8.8 with 32 bytes of data:',
      'Reply from 8.8.8.8: bytes=32 time=21ms TTL=117',
      'Reply from 8.8.8.8: bytes=32 time=20ms TTL=117',
      'Reply from 8.8.8.8: bytes=32 time=22ms TTL=117',
      'Reply from 8.8.8.8: bytes=32 time=21ms TTL=117',
      '',
      'Ping statistics for 8.8.8.8:',
      '    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),',
      'Approximate round trip times in milli-seconds:',
      '    Minimum = 20ms, Maximum = 22ms, Average = 21ms',
      '',
      'C:\\>ping www.netlab.test',
      'Ping request could not find host www.netlab.test. Please check the name and try again.',
      '',
      'C:\\>ipconfig /all | findstr "DNS Servers"',
      '   DNS Servers . . . . . . . . . . . : 192.168.5.100'
    ].join('\n'),
    steps: [
      { q: 'ตามลำดับ ping ปัญหาอยู่ที่ใด', options: ['สายแลนของเครื่องพนักงาน', 'การเชื่อมต่อของ ISP', 'การแปลงชื่อเป็น IP (DNS)', 'ซอฟต์แวร์ TCP/IP ในเครื่อง'], correct: 2 },
      { q: 'จากผล ipconfig /all สาเหตุที่น่าจะเป็นคือข้อใด', options: ['ตั้ง DNS เป็น .100 ผิดจากแผน', 'เครื่องได้ IP แบบ APIPA', 'Default Gateway ตั้งผิดวง', 'เว็บเซิร์ฟเวอร์ปิดพอร์ต 443'], correct: 0 },
      { q: 'ควรแก้ไขอย่างไร', options: ['สั่ง ipconfig /release แล้ว ipconfig /renew', 'แก้ DNS เป็น 192.168.5.10 แล้ว flushdns', 'เปลี่ยนสาย LAN ของเครื่องเป็น Cat6', 'ตั้ง Default Gateway เป็น 8.8.8.8 แทน'], correct: 1 }
    ],
    explain: 'ping 8.8.8.8 ผ่านแสดงว่าออกอินเทอร์เน็ตได้ แต่ใช้ชื่อไม่ได้คือปัญหา DNS ค่า DNS Servers 192.168.5.100 ไม่ตรงกับ DNS ของสำนักงาน (192.168.5.10) ต้องแก้ค่าแล้วล้างแคชด้วย ipconfig /flushdns ตรวจซ้ำได้ด้วย nslookup www.netlab.test 192.168.5.10',
    tags: ['dns', 'ping', 'ipconfig']
  },
  {
    id: 'u8-029', unit: 8, week: 14, level: 'hard', type: 'scenario',
    context: 'สำนักงานบัญชีตั้ง DHCP บนเราเตอร์ให้แจก IP 192.168.20.100 ถึง 192.168.20.200 เดือนก่อนช่างตั้ง IP คงที่ให้เครื่อง PC-ACC05 เป็น 192.168.20.130 วันนี้ติดตั้งเครื่องพิมพ์ใหม่แบบรับ IP อัตโนมัติ หลังจากนั้น PC-ACC05 แจ้งเตือนว่ามี IP conflict และใช้เครือข่ายได้บ้างไม่ได้บ้าง',
    pre: [
      'C:\\>ipconfig /all',
      '',
      'Ethernet adapter Ethernet:',
      '',
      '   Physical Address. . . . . . . . . : 3C-52-82-1A-7F-09',
      '   DHCP Enabled. . . . . . . . . . . : No',
      '   IPv4 Address. . . . . . . . . . . : 192.168.20.130(Duplicate)',
      '   Subnet Mask . . . . . . . . . . . : 255.255.255.0',
      '   Default Gateway . . . . . . . . . : 192.168.20.1',
      '   DNS Servers . . . . . . . . . . . : 192.168.20.1'
    ].join('\n'),
    steps: [
      { q: 'สาเหตุของปัญหาคือข้อใด', options: ['DNS Server ตั้งผิดค่า', 'ตั้ง IP คงที่ทับช่วงที่ DHCP แจก', 'สาย UTP ยาวเกิน 100 เมตร', 'การ์ดแลนถูกปิดใช้งานใน Device Manager'], correct: 1 },
      { q: 'ช่างจะหาว่าอุปกรณ์ใดใช้ IP เดียวกันอยู่ได้อย่างไร', options: ['ใช้ tracert ไปที่ 8.8.8.8', 'ใช้ ipconfig /flushdns', 'ดู MAC ด้วย arp -a หรือรายการ DHCP', 'ใช้ nslookup ถามชื่อ PC-ACC05'], correct: 2 },
      { q: 'วิธีแก้ที่ถูกต้องและไม่ให้เกิดซ้ำคือข้อใด', options: ['ย้าย PC-ACC05 ไปใช้ IP คงที่นอกช่วง DHCP', 'รีสตาร์ทเครื่องพิมพ์ทุกเช้าก่อนเริ่มงาน', 'ปิด DHCP แล้วตั้งทุกเครื่องเป็น .130', 'ขยาย Subnet Mask เป็น 255.255.0.0 ทุกเครื่อง'], correct: 0 }
    ],
    explain: '(Duplicate) ต่อท้าย IP แสดงว่ามี IP ซ้ำ เกิดเพราะ IP คงที่ .130 อยู่ในช่วงที่ DHCP แจก เมื่อ DHCP แจก .130 ให้เครื่องพิมพ์จึงชนกัน หาอุปกรณ์ที่ชนได้จาก MAC ใน arp -a หรือรายการ DHCP และแก้โดยย้าย IP คงที่ออกนอกช่วง DHCP เช่น 192.168.20.30',
    tags: ['ip-conflict', 'dhcp', 'static', 'arp']
  },
  {
    id: 'u8-030', unit: 8, week: 14, level: 'hard', type: 'diagram', topo: TOPO_WRONG_MASK,
    q: 'ทุกเครื่องในวง 192.168.1.x ตั้ง Default Gateway เป็น 192.168.1.1 PC1 และ PC2 ping Server (192.168.2.10) ผ่าน แต่ PC3 ping ไม่ผ่าน จากค่าในภาพ สิ่งใดผิด',
    answerType: 'choice',
    options: [
      'Mask /25 ของ PC3 ทำให้ Gateway อยู่นอกวง',
      'Server ต้องอยู่วง 192.168.1.x เดียวกับ PC ทุกเครื่อง',
      'Router1 ต้องมี IP วงเดียวกันทั้งสองขาจึงจะส่งต่อได้',
      'PC3 ใช้ IP .130 ซึ่งเป็น Broadcast Address ของวง /24'
    ],
    correct: 0,
    why: ['', 'เราเตอร์มีหน้าที่เชื่อมสองวงอยู่แล้ว PC1 จึง ping ได้', 'แต่ละขาของเราเตอร์ต้องอยู่คนละวง', 'Broadcast ของ 192.168.1.0/24 คือ .255 ไม่ใช่ .130'],
    explain: 'ด้วย /25 PC3 (192.168.1.130) เห็นวงของตัวเองเป็น 192.168.1.128 ถึง 192.168.1.255 Gateway 192.168.1.1 จึงอยู่นอกวง PC3 ส่งข้อมูลออกไปวงอื่นไม่ได้ ต้องแก้ Subnet Mask เป็น /24 (255.255.255.0) เหมือนเครื่องอื่น',
    tags: ['subnet-mask', 'gateway', 'diagram']
  },
  {
    id: 'u8-031', unit: 8, week: 14, level: 'medium', type: 'diagram', topo: TOPO_WRONG_GW,
    q: 'ค่า Default Gateway ที่ตั้งไว้: Server, PC1, PC2 = 192.168.50.1 และ PC3 = 192.168.50.254 PC3 ping Server ผ่าน แต่ ping 8.8.8.8 ไม่ผ่าน ขณะที่ PC1 และ PC2 ผ่านทั้งคู่ ข้อใดถูกต้อง',
    answerType: 'choice',
    options: [
      'Router1 ไม่มีเส้นทางออกไปยังอินเทอร์เน็ต',
      'สายของ PC3 ขาด ต้องเปลี่ยนสายเส้นใหม่',
      'Subnet Mask /24 ของ PC3 ตั้งไม่ถูกต้อง',
      'Gateway ของ PC3 ผิด ควรเป็น 192.168.50.1'
    ],
    correct: 3,
    why: ['PC1 และ PC2 ออกอินเทอร์เน็ตได้ แสดงว่าเราเตอร์มีเส้นทาง', 'PC3 ping Server ในวงได้ แสดงว่าสายปกติ', 'PC3 ใช้ /24 เหมือนเครื่องอื่นและคุยในวงได้', ''],
    explain: 'PC3 คุยในวงได้จึงไม่ใช่ปัญหาสายหรือ Mask แต่ส่งออกนอกวงไม่ได้เพราะ Gateway 192.168.50.254 ไม่มีอยู่จริง ไม่ใช่ IP ของ Router1 ต้องแก้เป็น 192.168.50.1',
    tags: ['gateway', 'diagram', 'troubleshooting']
  },
  {
    id: 'u8-032', unit: 8, week: 14, level: 'medium', type: 'diagram', topo: TOPO_DHCP_DOWN,
    q: 'ในภาพ สายระหว่าง DHCP-SRV กับ Switch1 ขาด (กากบาท) Router1 ไม่ได้เปิดบริการ DHCP ส่วน PC1 ถึง PC3 เป็นเครื่องใหม่ที่ตั้งรับ IP อัตโนมัติและเพิ่งต่อเข้าเครือข่ายครั้งแรก จะเกิดอะไรขึ้น',
    answerType: 'choice',
    options: [
      'PC1 ถึง PC3 ได้ IP 192.168.1.x จาก Router1 แทน',
      'PC1 ถึง PC3 ได้ IP 169.254.x.x และไม่มี Gateway',
      'PC1 ถึง PC3 ได้ IP ถูกต้องแต่ใช้ชื่อโดเมนไม่ได้',
      'PC1 ถึง PC3 ได้ IP ซ้ำกันทั้งหมดเป็น 192.168.1.100'
    ],
    correct: 1,
    explain: 'เมื่อติดต่อ DHCP Server ไม่ได้ Windows จะตั้ง APIPA ในช่วง 169.254.0.0/16 Mask 255.255.0.0 และไม่มี Gateway เครื่องเหล่านี้คุยได้เฉพาะเครื่อง APIPA ด้วยกันและออกนอกวงไม่ได้',
    tags: ['apipa', 'dhcp', 'diagram']
  },
  {
    id: 'u8-033', unit: 8, week: 14, level: 'easy', type: 'diagram', topo: TOPO_DUP_IP,
    q: 'จาก IP ที่แสดงในภาพ อุปกรณ์ใดจะเกิดปัญหา IP ซ้ำ (IP Address Conflict) (เลือกได้หลายข้อ)',
    answerType: 'multi',
    options: ['PC1', 'PC2', 'PC3', 'Printer', 'Router1'],
    correct: [1, 3],
    explain: 'PC2 และ Printer ใช้ IP 192.168.1.12 เหมือนกัน จะเกิด IP conflict ทำให้ทั้งคู่หลุดสลับกัน ต้องเปลี่ยนเครื่องใดเครื่องหนึ่งเป็น IP ที่ยังว่าง',
    tags: ['ip-conflict', 'diagram']
  },
  {
    id: 'u8-034', unit: 8, week: 14, level: 'medium', type: 'match',
    q: 'จับคู่ซอฟต์แวร์ช่วยงานเครือข่ายกับงานที่ใช้',
    left: ['Wireshark', 'Angry IP Scanner', 'FileZilla', 'Microsoft Defender'],
    right: [
      'ตรวจจับและกำจัดมัลแวร์',
      'จับแพ็กเก็ตแล้วแสดงรายละเอียดทีละชั้น',
      'ล้างแคช DNS ในเครื่อง',
      'โอนย้ายไฟล์ผ่าน FTP/SFTP',
      'ค้นหาอุปกรณ์และ IP ที่ใช้อยู่ในวง'
    ],
    answer: [1, 4, 3, 0],
    explain: 'Wireshark วิเคราะห์แพ็กเก็ต, Angry IP Scanner สแกนหาอุปกรณ์และ IP, FileZilla โอนย้ายไฟล์ FTP/SFTP และ Microsoft Defender ตรวจจับมัลแวร์ ส่วนการล้างแคช DNS ใช้ ipconfig /flushdns',
    tags: ['tools', 'wireshark', 'ip-scanner']
  },
  {
    id: 'u8-035', unit: 8, week: 14, level: 'hard', type: 'choice',
    q: 'เครื่องลูกได้ IP 169.254.x.x ทั้งที่สายปกติ ช่างใช้ Wireshark ใส่ตัวกรอง dhcp พบว่าเครื่องส่ง DHCP Discover ออกไปซ้ำหลายครั้ง แต่ไม่มี DHCP Offer ตอบกลับเลย ควรสรุปอย่างไร',
    options: [
      'ปัญหาอยู่ที่ DHCP Server หรือเส้นทางไปถึง',
      'ไดรเวอร์การ์ดแลนของเครื่องลูกเสียหายแล้ว',
      'DNS Server ตอบชื่อโดเมนผิดพลาด',
      'ต้องลง Windows ของเครื่องลูกใหม่'
    ],
    correct: 0,
    why: ['', 'เครื่องลูกส่ง Discover ออกได้ แสดงว่าการ์ดและไดรเวอร์ทำงาน', 'DHCP ไม่เกี่ยวกับการแปลงชื่อ', 'เครื่องลูกทำงานถูกต้องแล้ว ไม่จำเป็นต้องลงใหม่'],
    explain: 'การที่เครื่องลูกส่ง DHCP Discover ได้แต่ไม่มี Offer กลับมา แสดงว่าเครื่องลูกทำงานปกติ ปัญหาอยู่ที่ฝั่ง DHCP Server หรือเส้นทางระหว่างเครื่องลูกกับเซิร์ฟเวอร์',
    tags: ['wireshark', 'dhcp', 'apipa']
  },
  {
    id: 'u8-036', unit: 8, week: 14, level: 'easy', type: 'choice',
    q: 'ผู้ใช้แจ้งว่าเครื่องเปิดเว็บไม่ได้ ตามหลักการวิเคราะห์แบบล่างขึ้นบน (Bottom-Up) ควรตรวจสิ่งใดเป็นอันดับแรก',
    options: [
      'ค่า DNS Server ในเครื่อง',
      'กฎไฟร์วอลล์ของเว็บเบราว์เซอร์',
      'ไฟ Link และสายแลนของเครื่อง',
      'พอร์ต 443 ของเว็บเซิร์ฟเวอร์'
    ],
    correct: 2,
    explain: 'Bottom-Up เริ่มจากชั้น Physical ก่อน เพราะชั้นบนทุกชั้นต้องพึ่งชั้นล่าง ถ้าสายไม่มีสัญญาณ การตั้งค่า DNS หรือไฟร์วอลล์ให้ถูกแค่ไหนก็ไม่ช่วย',
    tags: ['bottom-up', 'troubleshooting', 'osi']
  },
  {
    id: 'u8-037', unit: 8, week: 14, level: 'medium', type: 'choice',
    q: 'ช่างทดสอบตามลำดับ ping 127.0.0.1 ผ่าน แต่ ping IP ของเครื่องตัวเองไม่ผ่าน ปัญหาน่าจะอยู่ที่ใด',
    options: [
      'เราเตอร์หรือการเชื่อมต่อของ ISP ภายนอก',
      'DNS Server ที่ใช้แปลงชื่อโดเมน',
      'Switch ที่อยู่ระหว่างทางไปเราเตอร์',
      'การ์ดแลนหรือการตั้งค่า IP ของเครื่อง'
    ],
    correct: 3,
    explain: 'Loopback ผ่านแปลว่า TCP/IP ในเครื่องปกติ แต่ ping IP ตัวเองไม่ผ่านแปลว่าการ์ดแลนหรือการตั้งค่า IP ของเครื่องมีปัญหา ขั้นนี้ข้อมูลยังไม่ออกจากเครื่อง จึงยังไม่เกี่ยวกับ Switch หรือเราเตอร์',
    tags: ['ping-ladder', 'troubleshooting']
  },
  {
    id: 'u8-038', unit: 8, week: 14, level: 'easy', type: 'tf',
    q: 'การบอก ID และรหัสผ่านที่แสดงบนหน้าจอ TeamViewer ให้ผู้อื่น เท่ากับยินยอมให้ผู้นั้นเข้าควบคุมเครื่องของเราได้ทันที',
    answer: true,
    explain: 'TeamViewer ใช้ ID คู่กับรหัสผ่านที่แสดงบนจอ ผู้ที่ได้ทั้งสองค่าเชื่อมต่อและควบคุมเครื่องได้ทันที จึงต้องบอกเฉพาะช่างที่รู้จักและยืนยันตัวตนแล้วเท่านั้น',
    tags: ['remote-control', 'teamviewer', 'security']
  }
];
