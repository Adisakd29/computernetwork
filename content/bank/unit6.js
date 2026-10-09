'use strict';
// Question bank: Unit 6 (weeks 8-9) เครือข่ายในวินโดวส์: ชื่อเครื่อง Workgroup/Domain, IP Address, การแชร์และเชื่อมต่อ
let n = 0;
const Q = (week, level, type, o) => Object.assign({ id: 'u6-' + String(++n).padStart(3, '0'), unit: 6, week, level, type }, o);

module.exports = [
  // ---------- Week 8: ชื่อเครื่อง ชื่อเครือข่าย และ IP Address ----------
  Q(8, 'easy', 'fill', {
    q: 'ชื่อเครื่อง (Computer name) ใน Windows ไม่ควรยาวเกิน {{1}} ตัวอักษร เพราะเป็นข้อจำกัดของชื่อแบบ {{2}}',
    blanks: [['15', 'สิบห้า'], ['NetBIOS']],
    explain: 'ชื่อ NetBIOS ยาวได้ไม่เกิน 15 ตัวอักษร หน้า Rename this PC จึงไม่ยอมให้ตั้งชื่อยาวเกินนี้',
    tags: ['computer-name', 'netbios']
  }),
  Q(8, 'medium', 'multi', {
    q: 'ชื่อใดตั้งเป็นชื่อเครื่องใน Windows ไม่ได้หรือไม่ควรใช้ตามกฎการตั้งชื่อ (เลือกได้หลายข้อ)',
    options: ['ACCOUNT 01', 'LAB2-PC05', 'PC.2026', 'SHOP-POS1', 'OFFICE-RECEPTION-01'],
    correct: [0, 2, 4],
    explain: 'ชื่อเครื่องใช้ได้เฉพาะ A-Z, a-z, 0-9 และขีดกลาง ห้ามมีช่องว่างหรือจุด ห้ามเป็นตัวเลขล้วน และไม่ควรยาวเกิน 15 ตัวอักษร OFFICE-RECEPTION-01 ยาว 19 ตัวจึงใช้ไม่ได้',
    tags: ['computer-name', 'naming-rules']
  }),
  Q(8, 'easy', 'tf', {
    q: 'คอมพิวเตอร์ที่ติดตั้ง Windows 11 Home สามารถเข้าร่วม Domain ขององค์กรได้เหมือนรุ่น Pro',
    answer: false,
    explain: 'เครื่องที่จะเข้าร่วม Domain ต้องเป็น Windows รุ่น Pro, Enterprise หรือ Education รุ่น Home เข้าร่วม Domain ไม่ได้',
    tags: ['domain', 'windows-edition']
  }),
  Q(8, 'easy', 'choice', {
    q: 'ใน Windows 10 และ Windows 11 การเปลี่ยนชื่อเครื่องผ่านแอป Settings อยู่ที่เมนูใด',
    options: ['Settings → Accounts → Your info → Rename', 'Settings → Network & internet → Properties → Rename', 'Settings → System → About → Rename this PC', 'Settings → Personalization → Device name'],
    correct: 2,
    explain: 'ทั้ง Windows 10 และ 11 อยู่ที่ Settings → System → About → Rename this PC (Windows 11 ปุ่มอยู่ด้านบนข้างชื่อเครื่อง) และต้องรีสตาร์ทก่อนชื่อใหม่จะมีผล',
    tags: ['computer-name', 'windows-settings']
  }),
  Q(8, 'medium', 'choice', {
    q: 'พิมพ์คำสั่งใดในหน้าต่าง Run (Windows + R) เพื่อเปิด System Properties ที่มีแท็บ Computer Name สำหรับเปลี่ยน Workgroup',
    options: ['ncpa.cpl', 'sysdm.cpl', 'devmgmt.msc', 'msconfig'],
    correct: 1,
    why: ['ncpa.cpl เปิดหน้าต่าง Network Connections', '', 'devmgmt.msc เปิด Device Manager', 'msconfig เปิด System Configuration'],
    explain: 'sysdm.cpl เปิด System Properties แท็บ Computer Name กด Change... เพื่อเปลี่ยนชื่อเครื่องหรือเลือก Member of: Workgroup/Domain ใช้ได้ทั้ง Windows 10 และ 11',
    tags: ['workgroup', 'sysdm']
  }),
  Q(8, 'easy', 'command', {
    q: 'พิมพ์คำสั่งใน Command Prompt ที่แสดงเฉพาะชื่อเครื่องคอมพิวเตอร์นี้ทันที',
    os: 'windows',
    accept: ['^hostname(\\.exe)?$'],
    example: 'hostname',
    explain: 'คำสั่ง hostname แสดงชื่อเครื่องใน Command Prompt หรือ PowerShell ทันที ใช้ตรวจหลังเปลี่ยนชื่อเครื่องและรีสตาร์ทแล้ว',
    tags: ['hostname', 'cmd']
  }),
  Q(8, 'medium', 'command', {
    q: 'พิมพ์คำสั่งที่แสดงข้อมูลการ์ดเครือข่ายแบบละเอียด ได้แก่ Host Name, Physical Address (MAC), DHCP Enabled, DHCP Server และ DNS Servers',
    os: 'windows',
    accept: ['^ipconfig(\\.exe)? ?[/-]all$'],
    example: 'ipconfig /all',
    explain: 'ipconfig แบบไม่มีพารามิเตอร์แสดงเพียง IPv4 Address, Subnet Mask และ Default Gateway ส่วน ipconfig /all แสดงรายละเอียดทั้งหมดรวมถึง MAC และ DNS server',
    tags: ['ipconfig', 'cmd']
  }),
  Q(8, 'medium', 'command', {
    q: 'เพิ่งเปลี่ยนการตั้งค่าการ์ดเครือข่ายกลับเป็น Obtain an IP address automatically ต้องการให้เครื่องขอ IP ใหม่จาก DHCP Server ทันที ต้องพิมพ์คำสั่งใด',
    os: 'windows',
    accept: ['^ipconfig(\\.exe)? ?[/-]renew( [^ ]+)?$'],
    example: 'ipconfig /renew',
    explain: 'ipconfig /renew ขอ IP ใหม่จาก DHCP Server (ใส่ชื่อการ์ดต่อท้ายได้ถ้าต้องการเฉพาะการ์ด) ส่วน ipconfig /release ใช้คืน IP ที่ได้จาก DHCP',
    tags: ['ipconfig', 'dhcp', 'cmd']
  }),
  Q(8, 'easy', 'subnet', {
    q: 'เครื่องโต๊ะที่ 30 ในห้องแล็บตั้ง Static IP เป็น 192.168.20.30/24 จงหา Network Address, Subnet Mask และ Broadcast Address ของวงนี้',
    ip: '192.168.20.30', prefix: 24,
    ask: ['network', 'mask', 'broadcast'],
    explain: '/24 คือ Subnet mask 255.255.255.0 สามส่วนแรกเป็นส่วน Network จึงได้ Network 192.168.20.0 และ Broadcast 192.168.20.255',
    tags: ['subnet', 'static-ip']
  }),
  Q(8, 'medium', 'subnet', {
    q: 'โน้ตบุ๊กที่บ้านได้ IP 192.168.1.35/24 จาก Router จงหาโฮสต์แรกที่ใช้ได้ โฮสต์สุดท้ายที่ใช้ได้ และจำนวนโฮสต์ที่ใช้ได้ในวงนี้',
    ip: '192.168.1.35', prefix: 24,
    ask: ['first', 'last', 'hosts'],
    explain: 'วง 192.168.1.0/24 ใช้ .0 เป็น Network และ .255 เป็น Broadcast โฮสต์ที่ใช้ได้จึงเป็น .1 ถึง .254 รวม 2^8 − 2 = 254 เครื่อง',
    tags: ['subnet', 'host-range']
  }),
  Q(8, 'medium', 'subnet', {
    q: 'สำนักงานใช้วง Private 10.10.0.0 กำหนด IP ให้เครื่องบัญชีเป็น 10.10.5.20/16 จงหา Network Address, Subnet Mask และ Broadcast Address',
    ip: '10.10.5.20', prefix: 16,
    ask: ['network', 'mask', 'broadcast'],
    explain: '/16 คือ 255.255.0.0 สองส่วนแรกเป็น Network จึงได้ Network 10.10.0.0 และ Broadcast 10.10.255.255',
    tags: ['subnet', 'private-ip']
  }),
  Q(8, 'hard', 'subnet', {
    q: 'เครื่องพิมพ์เครือข่ายตั้ง IP เป็น 172.16.8.130/25 จงหา Network Address, โฮสต์แรก, โฮสต์สุดท้าย และ Broadcast Address ของวงที่เครื่องพิมพ์อยู่',
    ip: '172.16.8.130', prefix: 25,
    ask: ['network', 'first', 'last', 'broadcast'],
    explain: '/25 คือ 255.255.255.128 แบ่งส่วนสุดท้ายเป็นช่วงละ 128 ค่า .130 อยู่ในช่วง .128–.255 จึงได้ Network 172.16.8.128 โฮสต์ .129–.254 และ Broadcast 172.16.8.255',
    tags: ['subnet', 'host-range']
  }),
  Q(8, 'hard', 'subnet', {
    q: 'หน้าต่าง TCP/IPv4 ของเครื่องหนึ่งกรอก IP 192.168.50.70 และ Subnet mask ตามที่แสดง จงหา Network Address, Broadcast Address และจำนวนโฮสต์ที่ใช้ได้',
    ip: '192.168.50.70', prefix: 26, maskGiven: true,
    ask: ['network', 'broadcast', 'hosts'],
    explain: '255.255.255.192 คือ /26 ช่วงละ 64 ค่า .70 อยู่ในช่วง .64–.127 จึงได้ Network 192.168.50.64 Broadcast 192.168.50.127 และโฮสต์ใช้ได้ 2^6 − 2 = 62 เครื่อง',
    tags: ['subnet', 'mask']
  }),
  Q(8, 'medium', 'choice', {
    q: 'ห้องแล็บใช้วง 192.168.1.0/24 Router อยู่ที่ 192.168.1.1 และ DHCP แจกช่วง 192.168.1.100 ถึง 192.168.1.199 ควรตั้ง Static IP ให้เครื่องเซิร์ฟเวอร์เป็นค่าใด',
    options: ['192.168.1.150', '192.168.1.1', '192.168.1.255', '192.168.1.20'],
    correct: 3,
    why: ['อยู่ในช่วงที่ DHCP แจก อาจเกิด IP conflict', 'ซ้ำกับ IP ของ Router (Default gateway)', 'เป็น Broadcast Address ของวง ใช้กับเครื่องไม่ได้', ''],
    explain: 'Static IP ต้องอยู่ในวงเดียวกัน ไม่ซ้ำกับ Gateway ไม่ใช่ Network/Broadcast และต้องอยู่นอกช่วงที่ DHCP แจก 192.168.1.20 จึงเหมาะสม',
    tags: ['static-ip', 'dhcp']
  }),
  Q(8, 'medium', 'choice', {
    q: 'ผลของ ipconfig /all แสดง IPv4 Address เป็น 192.168.20.30(Duplicate) ข้อใดสรุปได้ถูกต้อง',
    options: ['ได้ IP จาก DHCP สำเร็จสองครั้งติดกัน', 'เครื่องตั้ง DNS server ไว้สองตัวพร้อมกัน', 'การ์ดเครือข่ายมี MAC Address สองค่า', 'IP นี้ชนกับเครื่องอื่นในวงเดียวกัน'],
    correct: 3,
    explain: 'คำว่า (Duplicate) ต่อท้าย IPv4 Address แปลว่า IP ชนกับเครื่องอื่น (IP conflict) ทำให้ใช้งานเครือข่ายไม่ได้ ต้องเปลี่ยน IP ให้ไม่ซ้ำ',
    tags: ['ipconfig', 'ip-conflict']
  }),
  Q(8, 'medium', 'match', {
    q: 'จับคู่สิ่งที่เห็นในผลคำสั่ง ipconfig /all กับความหมายที่ถูกต้อง',
    left: ['DHCP Enabled . . . : No', 'IPv4 Address 169.254.x.x', 'Physical Address', 'Default Gateway ว่างเปล่า'],
    right: ['คุยได้เฉพาะเครื่องในวงเดียวกัน', 'MAC Address ของการ์ดเครือข่าย', 'เครื่องตั้ง IP แบบ Static อยู่', 'ล้างแคช DNS สำเร็จแล้ว', 'ขอ IP จาก DHCP ไม่สำเร็จ (APIPA)'],
    answer: [2, 4, 1, 0],
    explain: 'DHCP Enabled: No คือ Static, 169.254.x.x คือ APIPA เมื่อขอ IP จาก DHCP ไม่สำเร็จ, Physical Address คือ MAC และถ้าไม่มี Default Gateway จะคุยได้เฉพาะในวง',
    tags: ['ipconfig', 'apipa']
  }),
  Q(8, 'hard', 'order', {
    q: 'เรียงขั้นตอนตั้งค่า Static IP ผ่านหน้าต่าง Network Connections ใน Windows 10/11 ให้ถูกต้อง',
    items: [
      'กด Windows + R พิมพ์ ncpa.cpl แล้วกด Enter',
      'คลิกขวาการ์ดเครือข่ายที่ใช้ เช่น Ethernet แล้วเลือก Properties',
      'เลือก Internet Protocol Version 4 (TCP/IPv4) แล้วกด Properties',
      'เลือก Use the following IP address แล้วกรอก IP, Subnet mask และ Default gateway',
      'เลือก Use the following DNS server addresses แล้วกรอก DNS',
      'กด OK และ Close แล้วตรวจสอบด้วย ipconfig /all'
    ],
    explain: 'ncpa.cpl เปิด Network Connections ได้ทั้ง Windows 10 และ 11 จากนั้นเข้า Properties ของการ์ด เลือก TCP/IPv4 กรอก IP, Mask, Gateway และ DNS แล้วตรวจผลด้วย ipconfig /all',
    tags: ['static-ip', 'procedure']
  }),
  Q(8, 'easy', 'choice', {
    q: 'เครื่องที่ติดตั้ง Windows ใหม่และยังไม่ได้เปลี่ยนการตั้งค่า จะอยู่ใน Workgroup ชื่อใด',
    options: ['MSHOME', 'DOMAIN', 'WORKGROUP', 'LOCALHOST'],
    correct: 2,
    explain: 'ชื่อ Workgroup เริ่มต้นของ Windows คือ WORKGROUP เครื่องที่จะแชร์ไฟล์กันแบบ Workgroup ควรใช้ชื่อ Workgroup เดียวกัน',
    tags: ['workgroup']
  }),
  Q(8, 'hard', 'scenario', {
    context: 'นักเรียนตั้ง Static IP ให้เครื่องในห้องแล็บ (วง 192.168.20.0/24, Router 192.168.20.1, DNS 192.168.20.10) แล้วพบว่า ping เครื่องข้าง ๆ ได้ แต่เปิดเว็บไม่ได้เลย',
    pre: 'C:\\> ipconfig\nEthernet adapter Ethernet:\n   IPv4 Address. . . . . . . . . . . : 192.168.20.31\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.2.1',
    steps: [
      { q: 'จากผลคำสั่ง ค่าใดตั้งผิด', options: ['IPv4 Address อยู่นอกวง', 'Subnet Mask ผิด ต้องเป็น 255.255.0.0', 'Default Gateway ไม่อยู่ในวงเดียวกับเครื่อง', 'ค่าทั้งหมดถูกต้อง ปัญหาอยู่ที่สาย LAN'], correct: 2 },
      { q: 'ทำไมจึงยัง ping เครื่องข้าง ๆ ได้', options: ['เครื่องข้าง ๆ อยู่ในวงเดียวกัน ไม่ต้องผ่าน Gateway', 'ping ใช้ DNS แทน Gateway', 'Switch แก้ค่า Gateway ให้เองอัตโนมัติ', 'เครื่องข้าง ๆ ตั้ง Gateway เดียวกันผิด'], correct: 0 },
      { q: 'ควรแก้ Default Gateway เป็นค่าใด', options: ['192.168.20.255', '192.168.20.10', '192.168.2.20', '192.168.20.1'], correct: 3 }
    ],
    explain: 'Default gateway ต้องเป็น IP ของ Router ในวงเดียวกับเครื่อง (192.168.20.1) ถ้าตั้งผิดจะคุยในวงได้แต่ออกนอกวงไม่ได้ ส่วน .10 คือ DNS และ .255 คือ Broadcast',
    tags: ['troubleshooting', 'gateway', 'static-ip']
  }),

  // ---------- Week 9: การแชร์และเชื่อมต่อ ----------
  Q(9, 'easy', 'choice', {
    q: 'ข้อใดไม่ใช่ระดับของ Share permission ในหน้าต่าง Advanced Sharing',
    options: ['Read', 'Change', 'Full Control', 'Modify'],
    correct: 3,
    explain: 'Share permission มีเพียง 3 ระดับคือ Read, Change และ Full Control ส่วน Modify เป็นสิทธิ์ของ NTFS permission (แท็บ Security) ซึ่งละเอียดกว่า',
    tags: ['share-permission', 'ntfs']
  }),
  Q(9, 'hard', 'match', {
    q: 'จับคู่ Share permission กับ NTFS permission ที่ผู้ใช้ได้รับ กับสิทธิ์ที่มีผลจริงเมื่อเปิดผ่านเครือข่าย',
    left: ['Share: Change / NTFS: Read', 'Share: Full Control / NTFS: Modify', 'Share: Change / NTFS: Full control', 'Share: Full Control / NTFS: ไม่มีสิทธิ์'],
    right: ['Change', 'เข้าไม่ได้', 'Read', 'Modify', 'Full Control'],
    answer: [2, 3, 0, 1],
    explain: 'เมื่อเข้าผ่านเครือข่าย Windows ใช้สิทธิ์ที่จำกัดกว่าระหว่าง Share กับ NTFS เสมอ จึงได้ Read, Modify, Change และเข้าไม่ได้ตามลำดับ ไม่มีกรณีใดได้ Full Control',
    tags: ['share-permission', 'ntfs', 'effective-permission']
  }),
  Q(9, 'medium', 'order', {
    q: 'เรียงขั้นตอนแชร์เครื่องพิมพ์ที่ต่อ USB กับคอมพิวเตอร์ Windows 11 ให้เครื่องอื่นใช้งาน',
    items: [
      'เปิด Settings → Bluetooth & devices → Printers & scanners',
      'เลือกเครื่องพิมพ์ แล้วเลือก Printer properties',
      'แท็บ Sharing ติ๊ก Share this printer และตั้ง Share name ไม่มีช่องว่าง',
      'กด OK เพื่อบันทึก แล้วตรวจว่าโปรไฟล์เครือข่ายเป็น Private และเปิด File and printer sharing',
      'เครื่องลูกข่ายพิมพ์ \\\\ชื่อเครื่อง ใน File Explorer แล้วดับเบิลคลิกเครื่องพิมพ์',
      'สั่งพิมพ์หน้าทดสอบ (Print test page)'
    ],
    explain: 'แชร์ที่เครื่องที่ต่อเครื่องพิมพ์ผ่าน Printer properties แท็บ Sharing ต้องใช้โปรไฟล์ Private และเปิด File and printer sharing แล้วเชื่อมต่อจากเครื่องลูกข่ายผ่าน \\\\ชื่อเครื่อง และพิมพ์หน้าทดสอบ',
    tags: ['printer-sharing', 'procedure']
  }),
  Q(9, 'easy', 'tf', {
    q: 'แชร์อัตโนมัติอย่าง C$ และ D$ (Administrative share) ใช้ได้เฉพาะผู้ดูแลระบบ',
    answer: true,
    explain: 'C$, D$ เป็น Administrative share ที่ Windows แชร์ทั้งไดรฟ์ไว้อัตโนมัติ ใช้ได้เฉพาะผู้ดูแลระบบ และเป็นแชร์ซ่อนเพราะลงท้ายด้วย $',
    tags: ['hidden-share', 'admin-share']
  }),
  Q(9, 'easy', 'fill', {
    q: 'เซิร์ฟเวอร์ในห้องแล็บมี IP 192.168.20.10 และแชร์โฟลเดอร์ชื่อ Docs ถ้าจะเปิดด้วย IP แทนชื่อเครื่อง ต้องพิมพ์ UNC path ว่า {{1}}',
    blanks: [['\\\\192.168.20.10\\Docs', '\\\\192.168.20.10\\Docs\\']],
    explain: 'UNC path เขียนว่า \\\\ชื่อเครื่องหรือIP\\ชื่อแชร์ ใช้ IP แทนชื่อเครื่องได้ จึงเป็น \\\\192.168.20.10\\Docs',
    tags: ['unc', 'file-sharing']
  }),
  Q(9, 'easy', 'diagram', {
    diagram: 'unc-share',
    q: 'จากภาพ ผู้ใช้เปิด \\\\SERVER\\Share ผ่านเครือข่าย Windows ตรวจทั้ง Share permission และ NTFS permission สิทธิ์ที่ผู้ใช้ได้จริงเป็นอย่างไร',
    answerType: 'choice',
    options: ['ใช้สิทธิ์ที่กว้างกว่าของทั้งสองชั้น', 'ใช้เฉพาะ Share permission อย่างเดียว', 'ใช้สิทธิ์ที่จำกัดกว่าของทั้งสองชั้น', 'ใช้เฉพาะ NTFS permission อย่างเดียว'],
    correct: 2,
    explain: 'เมื่อเข้าผ่านเครือข่าย Windows คำนวณสิทธิ์จาก Share และ NTFS แยกกัน แล้วใช้สิทธิ์ที่จำกัดกว่า (more restrictive) เป็นสิทธิ์ที่มีผลจริง',
    tags: ['unc', 'effective-permission']
  }),
  Q(9, 'medium', 'diagram', {
    topo: {
      devices: [
        { id: 'srv1', type: 'server', name: 'LAB-SRV', x: 320, y: 60, ifaces: [{ name: 'eth0', ip: '192.168.20.10', prefix: 24, up: true }], gateway: '192.168.20.1', services: { file: true } },
        { id: 'sw1', type: 'switch', name: 'Switch1', x: 320, y: 170, ports: 8 },
        { id: 'pc1', type: 'pc', name: 'LAB-PC01', x: 100, y: 280, ifaces: [{ name: 'eth0', ip: '192.168.20.31', prefix: 24, up: true }], gateway: '192.168.20.1' },
        { id: 'pc2', type: 'pc', name: 'LAB-PC02', x: 320, y: 280, ifaces: [{ name: 'eth0', ip: '192.168.2.32', prefix: 24, up: true }], gateway: '192.168.20.1' },
        { id: 'pc3', type: 'pc', name: 'LAB-PC03', x: 540, y: 280, ifaces: [{ name: 'eth0', ip: '192.168.20.33', prefix: 24, up: true }], gateway: '192.168.20.1' }
      ],
      links: [
        { id: 'l1', a: { dev: 'srv1', port: 'eth0' }, b: { dev: 'sw1', port: 'p1' }, medium: 'utp', up: true },
        { id: 'l2', a: { dev: 'pc1', port: 'eth0' }, b: { dev: 'sw1', port: 'p2' }, medium: 'utp', up: true },
        { id: 'l3', a: { dev: 'pc2', port: 'eth0' }, b: { dev: 'sw1', port: 'p3' }, medium: 'utp', up: true },
        { id: 'l4', a: { dev: 'pc3', port: 'eth0' }, b: { dev: 'sw1', port: 'p4' }, medium: 'utp', up: true }
      ]
    },
    q: 'จากแผนภาพ ทุกเครื่องต่อ Switch ตัวเดียวกันและใช้ Subnet mask 255.255.255.0 เครื่องใดจะเปิด \\\\192.168.20.10\\homework ไม่ได้เพราะตั้ง IP ผิดวง',
    answerType: 'choice',
    options: ['LAB-PC01 (192.168.20.31)', 'LAB-PC02 (192.168.2.32)', 'LAB-PC03 (192.168.20.33)', 'ทุกเครื่องเปิดได้ตามปกติ'],
    correct: 1,
    explain: 'เซิร์ฟเวอร์อยู่วง 192.168.20.0/24 LAB-PC02 ตั้งเป็น 192.168.2.32 ซึ่งเป็นคนละวงและ Gateway ก็อยู่นอกวงของตัวเอง จึงคุยกับเซิร์ฟเวอร์ไม่ได้ ต้องแก้เป็น 192.168.20.x',
    tags: ['unc', 'ip-addressing', 'troubleshooting']
  }),
  Q(9, 'medium', 'choice', {
    q: 'แชร์ซ่อนชื่อ print$ ที่พบในเครื่องที่แชร์เครื่องพิมพ์ มีไว้เพื่ออะไร',
    options: ['เก็บงานพิมพ์ที่ค้างอยู่ในคิวของเครื่อง', 'เก็บไดรเวอร์ให้เครื่องลูกข่ายดาวน์โหลด', 'แชร์ทั้งไดรฟ์ C: ให้ผู้ดูแลระบบใช้งาน', 'สื่อสารระหว่างโปรแกรมต่าง ๆ ผ่านเครือข่าย'],
    correct: 1,
    explain: 'print$ เก็บไดรเวอร์ของเครื่องพิมพ์ที่แชร์ไว้ให้เครื่องลูกข่ายดาวน์โหลดตอนเชื่อมต่อ ส่วน C$ คือแชร์ทั้งไดรฟ์ และ IPC$ ใช้สื่อสารระหว่างโปรแกรม',
    tags: ['hidden-share', 'printer-sharing']
  }),
  Q(9, 'medium', 'choice', {
    q: 'ใน Windows 11 ต้องการเปลี่ยนโปรไฟล์ของ Wi-Fi ที่บ้านจาก Public เป็น Private ต้องเข้าที่ใด',
    options: ['Settings → System → About → Domain or workgroup', 'Settings → Network & internet → Wi-Fi → ชื่อเครือข่าย → Network profile type', 'Control Panel → Devices and Printers → Wi-Fi', 'Settings → Accounts → Sign-in options → Network'],
    correct: 1,
    explain: 'Windows 11 เปลี่ยนที่ Settings → Network & internet → Wi-Fi (หรือ Ethernet) → คลิกชื่อเครือข่าย แล้วเลือก Network profile type ส่วน Windows 10 อยู่ที่ Network & Internet → Status → Properties',
    tags: ['network-profile', 'windows-settings']
  }),
  Q(9, 'medium', 'tf', {
    q: 'การสร้างแชร์ใหม่หรือยกเลิกแชร์ด้วยคำสั่ง net share ต้องเปิด Command Prompt แบบ Run as administrator',
    answer: true,
    explain: 'การสร้างหรือลบแชร์เป็นการเปลี่ยนการตั้งค่าของระบบ จึงต้องใช้สิทธิ์ผู้ดูแลระบบ ถ้าเปิด Command Prompt แบบธรรมดาจะขึ้น Access is denied',
    tags: ['net-share', 'cmd']
  }),
  Q(9, 'hard', 'command', {
    q: 'พิมพ์คำสั่งผูกโฟลเดอร์แชร์ homework บนเครื่อง LAB-PC07 เป็นไดรฟ์ Z: (จะใส่ตัวเลือกให้เชื่อมต่อใหม่ทุกครั้งที่ล็อกอินด้วยก็ได้)',
    os: 'windows',
    accept: ['^net(\\.exe)? use z: \\\\\\\\lab-pc07\\\\homework\\\\?( /persistent:(yes|no))?$'],
    example: 'net use Z: \\\\LAB-PC07\\homework /persistent:yes',
    explain: 'net use ตามด้วยตัวอักษรไดรฟ์และ UNC path ใช้ผูกไดรฟ์เครือข่าย และ /persistent:yes ทำให้ไดรฟ์กลับมาทุกครั้งที่ล็อกอิน ส่วน net use Z: /delete ใช้ยกเลิก',
    tags: ['net-use', 'map-drive', 'cmd']
  }),
  Q(9, 'medium', 'command', {
    q: 'ครูต้องการยกเลิกการแชร์ชื่อ homework บนเครื่องนี้ด้วยคำสั่ง (ไฟล์ในโฟลเดอร์ต้องไม่ถูกลบ) ต้องพิมพ์คำสั่งใดใน Command Prompt แบบ Run as administrator',
    os: 'windows',
    accept: ['^net(\\.exe)? share homework /delete$'],
    example: 'net share homework /delete',
    explain: 'net share ชื่อแชร์ /delete ยกเลิกการแชร์โดยไม่ลบไฟล์ในโฟลเดอร์ และต้องใช้สิทธิ์ผู้ดูแลระบบ ส่วน net share อย่างเดียวใช้ดูรายการแชร์',
    tags: ['net-share', 'cmd']
  }),
  Q(9, 'hard', 'command', {
    q: 'โน้ตบุ๊กต่อ Wi-Fi แล้วช้า ต้องการดู SSID ที่ต่ออยู่ ความแรงสัญญาณ (Signal) และ Receive/Transmit rate ด้วยคำสั่ง ต้องพิมพ์คำสั่งใด',
    os: 'windows',
    accept: ['^netsh wlan show interfaces?$'],
    example: 'netsh wlan show interfaces',
    explain: 'netsh wlan show interfaces แสดง SSID ความแรงสัญญาณ และความเร็วรับส่งของการ์ด Wi-Fi ช่วยแยกว่าความช้ามาจากสัญญาณอ่อนหรือไม่',
    tags: ['netsh', 'wifi', 'cmd']
  }),
  Q(9, 'easy', 'choice', {
    q: 'ข้อใดเป็นประโยชน์ของการติ๊ก Reconnect at sign-in ตอน Map network drive',
    options: ['ไดรฟ์จะกลับมาเองทุกครั้งที่ล็อกอิน', 'ไฟล์จะถูกคัดลอกมาเก็บในเครื่องทั้งหมด', 'ได้สิทธิ์ Full Control บนโฟลเดอร์แชร์', 'ไม่ต้องใช้ชื่อผู้ใช้และรหัสผ่านอีกต่อไป'],
    correct: 0,
    explain: 'Reconnect at sign-in ทำให้ Windows ผูกไดรฟ์เครือข่ายให้ใหม่ทุกครั้งที่ล็อกอิน ไม่ได้เพิ่มสิทธิ์และไม่ได้คัดลอกไฟล์มาไว้ในเครื่อง',
    tags: ['map-drive']
  }),
  Q(9, 'easy', 'choice', {
    q: 'การแชร์โฟลเดอร์แบบละเอียดซึ่งตั้งชื่อแชร์และกำหนด Share permission เองได้ อยู่ที่ปุ่มใดในแท็บ Sharing',
    options: ['Share...', 'Network and Sharing Center', 'Advanced Sharing...', 'Security → Edit'],
    correct: 2,
    explain: 'ปุ่ม Advanced Sharing... ในแท็บ Sharing ให้ติ๊ก Share this folder ตั้ง Share name จำกัดจำนวนผู้ใช้ และกด Permissions เพื่อกำหนด Share permission ส่วนแท็บ Security คือ NTFS permission',
    tags: ['folder-sharing', 'share-permission']
  }),
  Q(9, 'hard', 'scenario', {
    context: 'นักเรียนในห้องแล็บพิมพ์ \\\\LAB-PC07\\homework ใน File Explorer แล้วขึ้นข้อความว่าหาเครื่องไม่พบ แต่เมื่อพิมพ์ \\\\192.168.20.57\\homework กลับเปิดโฟลเดอร์ได้ตามปกติ',
    steps: [
      { q: 'ผลนี้บอกว่าปัญหาอยู่ที่ใด', options: ['การแปลงชื่อเครื่องเป็น IP', 'Share permission ของโฟลเดอร์', 'NTFS permission ของโฟลเดอร์', 'สาย LAN ของเครื่องนักเรียน'], correct: 0 },
      { q: 'ข้อใดยืนยันได้ว่าการแชร์และสิทธิ์ของโฟลเดอร์ทำงานปกติ', options: ['เครื่องนักเรียนได้ IP แบบ APIPA', 'โฟลเดอร์ถูกซ่อนด้วยเครื่องหมาย $', 'การเปิดด้วย IP ใช้แชร์และสิทธิ์ชุดเดียวกันและเปิดได้', 'ping ชื่อเครื่องไม่ได้'], correct: 2 },
      { q: 'ระหว่างแก้ปัญหา วิธีใดให้นักเรียนส่งงานต่อได้ทันที', options: ['เปลี่ยนโปรไฟล์เครือข่ายเป็น Public', 'Map ไดรฟ์ Z: ไปที่ \\\\192.168.20.57\\homework', 'ลบแชร์แล้วสร้างใหม่ชื่อ homework$', 'ให้ NTFS permission เป็น Everyone Full Control'], correct: 1 }
    ],
    explain: 'ถ้าเปิดด้วยชื่อไม่ได้แต่เปิดด้วย IP ได้ แสดงว่าปัญหาอยู่ที่การหาชื่อ ไม่ใช่การแชร์หรือสิทธิ์ ระหว่างแก้สามารถใช้ UNC path แบบ IP หรือ Map ไดรฟ์ด้วย IP ได้',
    tags: ['troubleshooting', 'unc', 'name-resolution']
  }),
  Q(9, 'medium', 'scenario', {
    context: 'ครูแชร์โฟลเดอร์ D:\\Homework โดยตั้ง Share permission ให้ Authenticated Users เป็น Change แต่นักเรียนที่ Map ไดรฟ์ Z: แล้วบันทึกไฟล์ไม่ได้ ขึ้นข้อความว่าไม่มีสิทธิ์ เมื่อตรวจแท็บ Security พบว่ากลุ่ม Users มีเพียงสิทธิ์ Read',
    steps: [
      { q: 'สิทธิ์ที่นักเรียนได้จริงเมื่อเข้าผ่านเครือข่ายคือข้อใด', options: ['Change เพราะ Share permission ให้ไว้', 'Full Control เพราะรวมสองชั้นเข้าด้วยกัน', 'Read เพราะใช้สิทธิ์ที่จำกัดกว่า', 'เข้าไม่ได้เลยเพราะสิทธิ์ไม่ตรงกัน'], correct: 2 },
      { q: 'ควรแก้ไขที่ใดเพื่อให้นักเรียนส่งงานได้ตามหลักสิทธิ์น้อยที่สุด', options: ['ตั้ง Share permission เป็น Everyone Full Control', 'แท็บ Security เพิ่มสิทธิ์ให้สร้างไฟล์ได้', 'เปลี่ยนโปรไฟล์เครือข่ายเป็น Public', 'แชร์ไดรฟ์ D: ทั้งไดรฟ์แทน'], correct: 1 }
    ],
    explain: 'สิทธิ์จริงผ่านเครือข่ายคือสิทธิ์ที่จำกัดกว่าระหว่าง Share (Change) กับ NTFS (Read) จึงได้ Read ต้องแก้ NTFS ในแท็บ Security ให้สร้างไฟล์ได้ตามจำเป็น ไม่ควรให้ Full Control หรือแชร์ทั้งไดรฟ์',
    tags: ['ntfs', 'share-permission', 'least-privilege']
  }),
  Q(9, 'easy', 'choice', {
    q: 'เครื่องพิมพ์ที่มีพอร์ต LAN ในตัว วิธีใดที่ทำให้ทุกเครื่องสั่งพิมพ์ได้โดยไม่ต้องพึ่งคอมพิวเตอร์เครื่องใดเปิดอยู่',
    options: ['ตั้ง IP คงที่ให้เครื่องพิมพ์ แล้วเพิ่มเครื่องพิมพ์ด้วย IP', 'แชร์ผ่านคอมพิวเตอร์ที่ต่อสาย USB กับเครื่องพิมพ์ไว้', 'ตั้งโปรไฟล์เครือข่ายของทุกเครื่องให้เป็น Public', 'Map ไดรฟ์ Z: ไปที่แชร์ print$ ของเครื่องพิมพ์'],
    correct: 0,
    explain: 'เครื่องพิมพ์ที่มีพอร์ต LAN หรือ Wi-Fi ควรตั้ง IP คงที่ แล้วให้ทุกเครื่องเพิ่มเครื่องพิมพ์ด้วย IP โดยตรง จึงไม่ต้องพึ่งคอมพิวเตอร์ที่ทำหน้าที่ Print server',
    tags: ['printer-sharing', 'static-ip']
  }),
  Q(9, 'easy', 'choice', {
    q: 'การตั้งค่าใดทำให้เครื่องเราค้นหาเครื่องอื่นได้ และให้เครื่องอื่นมองเห็นเครื่องเราในหน้า Network ของ File Explorer',
    options: ['Network discovery', 'Remote management', 'MAC Address Filtering', 'Client isolation'],
    correct: 0,
    explain: 'Network discovery ทำให้เครื่องค้นหาและถูกมองเห็นในเครือข่าย เปิดได้ที่ Advanced sharing settings ในส่วน Private พร้อมกับ File and printer sharing',
    tags: ['network-discovery']
  })
];
