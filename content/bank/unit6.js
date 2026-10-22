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
    q: 'ใน Windows 11 ถ้าจะตั้ง Static IP ให้การ์ด Ethernet ผ่านแอป Settings ต้องเข้าที่ใด',
    options: ['Settings → System → About → Rename this PC', 'Settings → Network & internet → Ethernet → Network profile type', 'Settings → Network & internet → Ethernet → IP assignment → Edit', 'Settings → Accounts → Your info → Edit'],
    correct: 2,
    why: ['หน้านี้ใช้เปลี่ยนชื่อเครื่อง ไม่ใช่ตั้ง IP', 'Network profile type ใช้เลือก Public หรือ Private ไม่ใช่ตั้ง IP', '', 'หน้านี้เป็นข้อมูลบัญชีผู้ใช้ ไม่เกี่ยวกับเครือข่าย'],
    explain: 'Windows 11 ตั้ง Static IP ได้ที่ Settings → Network & internet → Ethernet หัวข้อ IP assignment กด Edit แล้วเลือก Manual เปิด IPv4 และกรอกค่า หรือใช้วิธีดั้งเดิมผ่าน ncpa.cpl ก็ได้',
    tags: ['static-ip', 'windows-settings']
  }),
  Q(8, 'medium', 'choice', {
    q: 'พิมพ์คำสั่งใดในหน้าต่าง Run (Windows + R) เพื่อเปิดหน้าต่าง Network Connections สำหรับเข้า Properties ของการ์ดเครือข่ายและตั้งค่า TCP/IPv4',
    options: ['sysdm.cpl', 'ncpa.cpl', 'devmgmt.msc', 'msconfig'],
    correct: 1,
    why: ['sysdm.cpl เปิด System Properties สำหรับชื่อเครื่องและ Workgroup', '', 'devmgmt.msc เปิด Device Manager สำหรับจัดการไดรเวอร์', 'msconfig เปิด System Configuration สำหรับตั้งค่าการบูต'],
    explain: 'ncpa.cpl เปิด Network Connections ได้ทั้ง Windows 10 และ 11 จากนั้นคลิกขวาการ์ด เลือก Properties แล้วเลือก Internet Protocol Version 4 (TCP/IPv4) เพื่อกรอก IP, Mask, Gateway และ DNS',
    tags: ['static-ip', 'ncpa']
  }),
  Q(8, 'easy', 'command', {
    q: 'ผู้ดูแลย้ายเว็บภายในไปเครื่องใหม่และแก้ DNS แล้ว แต่เครื่องนี้ยังเปิดชื่อเว็บไปที่ IP เดิม ต้องการล้างแคช DNS ในเครื่อง ต้องพิมพ์คำสั่งใด',
    os: 'windows',
    accept: ['^ipconfig(\\.exe)? ?[/-]flushdns$'],
    example: 'ipconfig /flushdns',
    explain: 'ipconfig /flushdns ล้างแคช DNS ในเครื่อง เครื่องจะถาม DNS server ใหม่และได้ IP ปัจจุบันของชื่อนั้น ใช้เมื่อเปลี่ยน DNS แล้วชื่อเว็บยังชี้ไปที่เดิม',
    tags: ['ipconfig', 'dns', 'cmd']
  }),
  Q(8, 'medium', 'command', {
    q: 'พิมพ์คำสั่งที่แสดงข้อมูลการ์ดเครือข่ายแบบละเอียด ได้แก่ Host Name, Physical Address (MAC), DHCP Enabled, DHCP Server และ DNS Servers',
    os: 'windows',
    accept: ['^ipconfig(\\.exe)? ?[/-]all$'],
    example: 'ipconfig /all',
    explain: 'ipconfig แบบไม่มีพารามิเตอร์แสดงเฉพาะค่าพื้นฐาน เช่น IP Address, Subnet Mask และ Default Gateway ส่วน ipconfig /all แสดงรายละเอียดทั้งหมดรวมถึง MAC และ DNS server',
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
    q: 'จากผล ipconfig /all ของโน้ตบุ๊กที่บ้านด้านบน ข้อใดสรุปได้ถูกต้อง',
    pre: 'C:\\> ipconfig /all\n   Host Name . . . . . . . . . . . . : PO-LAPTOP\nWireless LAN adapter Wi-Fi:\n   Physical Address. . . . . . . . . : 3C-52-82-1A-9F-07\n   DHCP Enabled. . . . . . . . . . . : Yes\n   IPv4 Address. . . . . . . . . . . : 192.168.1.35(Preferred)\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Lease Obtained. . . . . . . . . . : 12 October 2026 08:05:13\n   Lease Expires . . . . . . . . . . : 13 October 2026 08:05:13\n   Default Gateway . . . . . . . . . : 192.168.1.1\n   DHCP Server . . . . . . . . . . . : 192.168.1.1\n   DNS Servers . . . . . . . . . . . : 192.168.1.1',
    options: ['เครื่องตั้ง Static IP ไว้ และ Router ไม่ได้แจก IP', 'IP ชนกับเครื่องอื่น เพราะ Gateway กับ DHCP Server ซ้ำกัน', 'เครื่องได้ APIPA เพราะติดต่อ DHCP ไม่สำเร็จ', 'ได้ IP จาก DHCP โดย Router 192.168.1.1 เป็นผู้แจก'],
    correct: 3,
    why: ['DHCP Enabled เป็น Yes และมีบรรทัด Lease แปลว่ารับค่าอัตโนมัติ ไม่ใช่ Static', 'Router ตัวเดียวทำได้หลายหน้าที่ และ IPv4 ขึ้น (Preferred) ไม่ใช่ (Duplicate)', 'APIPA ต้องขึ้นต้นด้วย 169.254 แต่เครื่องนี้ได้ 192.168.1.35', ''],
    explain: 'DHCP Enabled: Yes พร้อม Lease Obtained/Expires และ DHCP Server 192.168.1.1 แสดงว่าเครื่องรับ IP จาก DHCP และ Router บ้านเป็นทั้ง Default gateway, DHCP Server และ DNS ที่เครื่องถาม ซึ่งพบได้ทั่วไป IPv4 ที่ขึ้น (Preferred) หมายถึงใช้งานได้ ไม่ชนกับใคร',
    tags: ['ipconfig', 'dhcp']
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
    why: ['MSHOME เคยเป็นชื่อที่ตัวช่วยตั้งค่าเครือข่ายบ้านของ Windows XP บางรุ่นใช้ ไม่ใช่ค่าเริ่มต้นปัจจุบัน', 'DOMAIN ไม่ใช่ชื่อ Workgroup เริ่มต้น และเครื่องใหม่ไม่ได้อยู่ใน Domain', '', 'localhost คือชื่อที่หมายถึงเครื่องตัวเอง (127.0.0.1) ไม่ใช่ชื่อ Workgroup'],
    explain: 'ชื่อ Workgroup เริ่มต้นของ Windows คือ WORKGROUP เครื่องที่จะแชร์ไฟล์กันแบบ Workgroup ควรใช้ชื่อเดียวกันเพื่อความเป็นระเบียบ แต่ชื่อ Workgroup ไม่ได้กำหนดสิทธิ์ ถึงต่างกันก็ยังเปิดแชร์ด้วย \\\\ชื่อเครื่อง ได้',
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
    why: ['Read เป็นระดับหนึ่งของ Share permission', 'Change เป็นระดับหนึ่งของ Share permission', 'Full Control เป็นระดับหนึ่งของ Share permission', ''],
    explain: 'Share permission มีเพียง 3 ระดับคือ Read, Change และ Full Control ส่วน Modify เป็นสิทธิ์ของ NTFS permission (แท็บ Security) ซึ่งละเอียดกว่า',
    tags: ['share-permission', 'ntfs']
  }),
  Q(9, 'hard', 'match', {
    q: 'จับคู่ Share permission กับ NTFS permission ที่ผู้ใช้ได้รับ กับสิทธิ์ที่มีผลจริงเมื่อเปิดผ่านเครือข่าย',
    left: ['Share: Change / NTFS: Read', 'Share: Full Control / NTFS: Modify', 'Share: Full Control / NTFS: Full control', 'Share: Full Control / NTFS: ไม่มีสิทธิ์'],
    right: ['Change', 'เข้าไม่ได้', 'Read', 'Modify', 'Full Control'],
    answer: [2, 3, 4, 1],
    explain: 'เมื่อเข้าผ่านเครือข่าย Windows ใช้สิทธิ์ที่จำกัดกว่าระหว่าง Share กับ NTFS เสมอ จึงได้ Read, Modify, Full Control (เมื่อทั้งสองฝั่งให้เต็ม) และเข้าไม่ได้ตามลำดับ',
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
    q: 'ครูแชร์โฟลเดอร์เฉลยแบบซ่อนไว้ในชื่อ answer$ บนเครื่อง LAB-PC07 ครูจะเปิดแชร์นี้จากเครื่องอื่นต้องพิมพ์ UNC path ว่า {{1}}',
    blanks: [['\\\\LAB-PC07\\answer$', '\\\\LAB-PC07\\answer$\\']],
    explain: 'แชร์ซ่อนไม่แสดงในรายการเมื่อเปิด \\\\LAB-PC07 แต่เปิดได้ถ้าพิมพ์ชื่อเต็มรวมเครื่องหมาย $ คือ \\\\LAB-PC07\\answer$ และผู้เปิดยังต้องมีสิทธิ์ตาม Share และ NTFS permission',
    tags: ['unc', 'hidden-share']
  }),
  Q(9, 'medium', 'diagram', {
    diagram: 'unc-share',
    q: 'จากภาพการเปิด \\\\SERVER\\Share ผ่านเครือข่าย การสื่อสารระหว่างเครื่องลูกข่ายกับ SERVER ใช้โปรโตคอลและพอร์ตใด และไฟร์วอลล์ของ SERVER ต้องอนุญาตพอร์ตนี้ในโปรไฟล์ใด',
    answerType: 'choice',
    options: ['HTTP พอร์ต TCP 80 ในโปรไฟล์ Public', 'FTP พอร์ต TCP 21 ในโปรไฟล์ Private', 'SMB พอร์ต TCP 445 ในโปรไฟล์ Private', 'DNS พอร์ต UDP 53 ในโปรไฟล์ Public'],
    correct: 2,
    why: ['HTTP ใช้เปิดเว็บ ไม่ใช่โฟลเดอร์แชร์ของ Windows', 'FTP เป็นโปรโตคอลโอนไฟล์อีกแบบ ไม่ใช่ที่ UNC path ใช้', '', 'DNS ใช้แปลงชื่อเป็น IP ไม่ได้ใช้ส่งไฟล์ในโฟลเดอร์แชร์'],
    explain: 'การเปิด UNC path ใช้โปรโตคอล SMB บนพอร์ต TCP 445 ซึ่ง Windows เปิดให้ผ่านไฟร์วอลล์เมื่อเครือข่ายเป็น Private และเปิด File and printer sharing ส่วนโปรไฟล์ Public จะปิดการแชร์ และไม่ควรเปิดพอร์ต 445 ออกสู่อินเทอร์เน็ต',
    tags: ['unc', 'smb', 'network-profile']
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
    why: ['192.168.20.31 อยู่วงเดียวกับเซิร์ฟเวอร์ 192.168.20.0/24 จึงเปิดได้', '', '192.168.20.33 อยู่วงเดียวกับเซิร์ฟเวอร์ จึงเปิดได้', 'LAB-PC02 ตั้งเป็น 192.168.2.32 ซึ่งอยู่คนละวงกับเซิร์ฟเวอร์'],
    explain: 'เซิร์ฟเวอร์อยู่วง 192.168.20.0/24 LAB-PC02 ตั้งเป็น 192.168.2.32 ซึ่งเป็นคนละวงและ Gateway ก็อยู่นอกวงของตัวเอง จึงคุยกับเซิร์ฟเวอร์ไม่ได้ ต้องแก้เป็น 192.168.20.x',
    tags: ['unc', 'ip-addressing', 'troubleshooting']
  }),
  Q(9, 'medium', 'choice', {
    q: 'แชร์ซ่อนชื่อ print$ ที่พบในเครื่องที่แชร์เครื่องพิมพ์ มีไว้เพื่ออะไร',
    options: ['เก็บงานพิมพ์ที่ค้างอยู่ในคิวของเครื่อง', 'เก็บไดรเวอร์ให้เครื่องลูกข่ายดาวน์โหลด', 'แชร์ทั้งไดรฟ์ C: ให้ผู้ดูแลระบบใช้งาน', 'สื่อสารระหว่างโปรแกรมต่าง ๆ ผ่านเครือข่าย'],
    correct: 1,
    why: ['งานพิมพ์ที่รอคิวอยู่ใน Spooler ไม่ได้แชร์ผ่าน print$', '', 'แชร์ทั้งไดรฟ์ C: คือ C$', 'การสื่อสารระหว่างโปรแกรมคือ IPC$'],
    explain: 'print$ เก็บไดรเวอร์ของเครื่องพิมพ์ที่แชร์ไว้ให้เครื่องลูกข่ายดาวน์โหลดตอนเชื่อมต่อ ส่วน C$ คือแชร์ทั้งไดรฟ์ และ IPC$ ใช้สื่อสารระหว่างโปรแกรม',
    tags: ['hidden-share', 'printer-sharing']
  }),
  Q(9, 'medium', 'choice', {
    q: 'ใน Windows 11 ต้องการเปลี่ยนโปรไฟล์ของ Wi-Fi ที่บ้านจาก Public เป็น Private ต้องเข้าที่ใด',
    options: ['Settings → System → About → Domain or workgroup', 'Settings → Network & internet → Wi-Fi → ชื่อเครือข่าย → Network profile type', 'Control Panel → Devices and Printers → Wi-Fi', 'Settings → Accounts → Sign-in options → Network'],
    correct: 1,
    why: ['Domain or workgroup ใช้เปลี่ยน Workgroup หรือเข้าร่วม Domain', '', 'Devices and Printers ใช้จัดการอุปกรณ์และเครื่องพิมพ์', 'Sign-in options ใช้ตั้งวิธีล็อกอิน เช่น PIN หรือรหัสผ่าน'],
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
    accept: ['^net(\\.exe)? use z: \\\\\\\\lab-pc07\\\\homework\\\\?( /p(ersistent)?:(yes|no))?$'],
    example: 'net use Z: \\\\LAB-PC07\\homework /persistent:yes',
    explain: 'net use ตามด้วยตัวอักษรไดรฟ์และ UNC path ใช้ผูกไดรฟ์เครือข่าย และ /persistent:yes ทำให้ไดรฟ์กลับมาทุกครั้งที่ล็อกอิน ส่วน net use Z: /delete ใช้ยกเลิก',
    tags: ['net-use', 'map-drive', 'cmd']
  }),
  Q(9, 'medium', 'command', {
    q: 'ครูต้องการยกเลิกการแชร์ชื่อ homework บนเครื่องนี้ด้วยคำสั่ง (ไฟล์ในโฟลเดอร์ต้องไม่ถูกลบ) ต้องพิมพ์คำสั่งใดใน Command Prompt แบบ Run as administrator',
    os: 'windows',
    accept: ['^net(\\.exe)? share (homework|d:\\\\homework\\\\?) /del(ete)?$'],
    example: 'net share homework /delete',
    explain: 'net share ชื่อแชร์ /delete (ย่อเป็น /del ได้) ยกเลิกการแชร์โดยไม่ลบไฟล์ในโฟลเดอร์ และต้องใช้สิทธิ์ผู้ดูแลระบบ ส่วน net share อย่างเดียวใช้ดูรายการแชร์',
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
    why: ['', 'Map network drive ไม่ได้คัดลอกไฟล์มาไว้ในเครื่อง ไฟล์ยังอยู่บนเครื่องที่แชร์', 'สิทธิ์ยังเป็นไปตาม Share และ NTFS permission เดิม', 'ถ้าเครื่องปลายทางต้องการล็อกอิน ก็ยังต้องใช้บัญชีที่มีสิทธิ์'],
    explain: 'Reconnect at sign-in ทำให้ Windows ผูกไดรฟ์เครือข่ายให้ใหม่ทุกครั้งที่ล็อกอิน ไม่ได้เพิ่มสิทธิ์และไม่ได้คัดลอกไฟล์มาไว้ในเครื่อง',
    tags: ['map-drive']
  }),
  Q(9, 'easy', 'choice', {
    q: 'การแชร์โฟลเดอร์แบบละเอียดซึ่งตั้งชื่อแชร์และกำหนด Share permission เองได้ อยู่ที่ปุ่มใดในแท็บ Sharing',
    options: ['Share...', 'Network and Sharing Center', 'Advanced Sharing...', 'Security → Edit'],
    correct: 2,
    why: ['ปุ่ม Share... เป็นการแชร์แบบง่าย เลือกได้แค่ผู้ใช้กับ Read หรือ Read/Write', 'Network and Sharing Center ใช้ดูสถานะและตั้งค่าเครือข่าย ไม่ได้แชร์โฟลเดอร์ใดโดยตรง', '', 'แท็บ Security ใช้กำหนด NTFS permission ไม่ใช่ Share permission'],
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
    q: 'เครื่อง ACC-PC แชร์เครื่องพิมพ์ USB ไว้ในชื่อ HP-OFFICE พนักงานเครื่องอื่นจะเชื่อมต่อเครื่องพิมพ์นี้ ควรพิมพ์สิ่งใดใน File Explorer',
    options: ['\\\\ACC-PC\\HP-OFFICE', 'http://ACC-PC/HP-OFFICE', 'ACC-PC:\\HP-OFFICE', '\\\\HP-OFFICE\\ACC-PC'],
    correct: 0,
    why: ['', 'http ใช้เปิดเว็บ ไม่ใช่เครื่องพิมพ์ที่แชร์ผ่าน SMB', 'รูปแบบนี้คล้ายชื่อไดรฟ์ ซึ่ง Windows ไม่รู้จักเป็นทรัพยากรเครือข่าย', 'สลับกัน ต้องเป็นชื่อเครื่องก่อน แล้วจึงตามด้วยชื่อแชร์'],
    explain: 'เครื่องพิมพ์ที่แชร์เปิดได้ด้วย UNC path แบบเดียวกับโฟลเดอร์ คือ \\\\ชื่อเครื่อง\\ชื่อแชร์ จึงเป็น \\\\ACC-PC\\HP-OFFICE เมื่อดับเบิลคลิก Windows จะดาวน์โหลดไดรเวอร์จาก print$ และเพิ่มเครื่องพิมพ์ให้ (หรือพิมพ์ \\\\ACC-PC แล้วดับเบิลคลิกเครื่องพิมพ์ก็ได้)',
    tags: ['printer-sharing', 'unc']
  }),
  Q(9, 'medium', 'choice', {
    q: 'เครื่องครูตั้งโปรไฟล์ Private และเปิด Network discovery แล้ว นักเรียนเห็นเครื่องครูในหน้า Network แต่เปิดเข้าไปดูโฟลเดอร์แชร์ไม่ได้ ควรเปิดการตั้งค่าใดเพิ่มใน Advanced sharing settings',
    options: ['File and printer sharing', 'Metered connection', 'Random hardware addresses', 'Remote Desktop'],
    correct: 0,
    why: ['', 'Metered connection ใช้จำกัดปริมาณข้อมูล ไม่ได้เปิดการแชร์', 'การสุ่ม MAC เป็นเรื่องความเป็นส่วนตัวของ Wi-Fi ไม่ได้เปิดการแชร์', 'Remote Desktop ใช้ควบคุมหน้าจอจากระยะไกล ไม่ได้เปิดโฟลเดอร์แชร์'],
    explain: 'Network discovery ทำให้เครื่องค้นหาและถูกมองเห็น ส่วน File and printer sharing ทำให้ไฟร์วอลล์ยอมให้เครื่องอื่นเข้าโฟลเดอร์แชร์และเครื่องพิมพ์ได้ ต้องเปิดทั้งสองอย่างในส่วน Private',
    tags: ['network-discovery', 'file-sharing']
  }),

  // ---------- Phase 4 additions: label, command output, performance scenario ----------
  Q(8, 'easy', 'label', {
    diagram: 'windows-ip-settings',
    q: 'ดูผังเครือข่ายด้านล่างของภาพ แล้วกรอกค่าที่ถูกต้องลงในช่องของหน้าต่าง TCP/IPv4 ตามหมายเลข',
    hide: ['192.168.20.30', '255.255.255.0', '192.168.20.1', '192.168.20.10'],
    extra: ['192.168.20.255', '255.255.0.0'],
    explain: 'PC เครื่องนี้คือ .30 จึงกรอก IP 192.168.20.30 วง /24 ใช้ Mask 255.255.255.0 Default gateway คือ Router .1 (192.168.20.1) และ Preferred DNS คือ DNS Server .10 (192.168.20.10) ส่วน .255 เป็น Broadcast ใช้กับเครื่องไม่ได้',
    tags: ['static-ip', 'gateway', 'dns']
  }),
  Q(8, 'medium', 'label', {
    diagram: 'ipconfig-output',
    q: 'วางความหมายให้ตรงกับบรรทัดในผล ipconfig /all ตามหมายเลข',
    hide: ['MAC Address 48 บิตของการ์ดตัวนี้ ใช้ทำ MAC filtering หรือจอง IP ใน DHCP', 'Yes = รับค่าอัตโนมัติจาก DHCP · No = ตั้ง Static เอง (ไม่มีบรรทัด Lease)', 'Router สำหรับออกนอกวง ต้องอยู่วงเดียวกับ IPv4 ถ้าว่างจะคุยได้แค่ในวง', 'เครื่องที่แจก IP ให้ ในบ้านมักเป็น Router ตัวเดียวกับ Gateway', 'ตัวแปลงชื่อเป็น IP ถ้าผิด จะ ping ด้วย IP ได้ แต่เปิดเว็บด้วยชื่อไม่ได้', 'ขอ IP จาก DHCP ไม่สำเร็จ ตรวจสาย ไฟพอร์ต Switch และ Router/DHCP'],
    extra: ['ล้างแคช DNS ในเครื่อง ใช้เมื่อชื่อเว็บยังชี้ไปที่เดิม'],
    explain: 'Physical Address คือ MAC, DHCP Enabled บอกว่ารับค่าอัตโนมัติหรือ Static, Default Gateway คือ Router ทางออกนอกวง, DHCP Server คือเครื่องที่แจก IP, DNS Servers คือตัวแปลงชื่อเป็น IP และ IPv4 แบบ 169.254.x.x (APIPA) แปลว่าขอ IP จาก DHCP ไม่สำเร็จ',
    tags: ['ipconfig', 'dhcp', 'apipa']
  }),
  Q(9, 'medium', 'multi', {
    q: 'ครูสั่ง net share บนเครื่อง LAB-PC07 ได้ผลดังด้านบน ข้อใดสรุปได้ถูกต้อง (เลือกได้หลายข้อ)',
    pre: 'C:\\> net share\n\nShare name   Resource                        Remark\n\n------------------------------------------------------------------\nC$           C:\\                             Default share\nIPC$                                         Remote IPC\nADMIN$       C:\\Windows                      Remote Admin\nanswer$      D:\\Teacher\\Answers\nhomework     D:\\Homework\nHP-OFFICE    USB001                          Spooled\nprint$       C:\\Windows\\system32\\spool\\drivers\n                                             Printer Drivers\nThe command completed successfully.',
    options: ['นักเรียนที่เปิด \\\\LAB-PC07 จะเห็น homework แต่ไม่เห็น answer$', 'แชร์ homework เก็บไฟล์จริงอยู่ที่ D:\\Homework', 'เครื่องนี้แชร์เครื่องพิมพ์ที่ต่อทาง USB ในชื่อ HP-OFFICE', 'ใครรู้ชื่อ answer$ ก็เปิดได้ทันทีโดยไม่ต้องมีสิทธิ์', 'C$ เป็นแชร์ที่ครูสร้างให้นักเรียนเก็บงาน'],
    correct: [0, 1, 2],
    explain: 'แชร์ที่ลงท้ายด้วย $ เป็นแชร์ซ่อน ไม่แสดงในรายการแต่ยังต้องมีสิทธิ์จึงเปิดได้ คอลัมน์ Resource บอก path จริงบนดิสก์ แชร์ HP-OFFICE ชี้ไปที่พอร์ต USB001 คือเครื่องพิมพ์ USB ที่แชร์ไว้ และ print$ เก็บไดรเวอร์ให้เครื่องลูกข่าย ส่วน C$ เป็น Administrative share ที่ Windows สร้างเองและใช้ได้เฉพาะผู้ดูแลระบบ',
    tags: ['net-share', 'hidden-share', 'printer-sharing']
  }),
  Q(9, 'medium', 'choice', {
    q: 'พนักงานบัญชีสั่ง net use ตอนเช้าได้ผลดังด้านบน ข้อใดสรุปได้ถูกต้อง',
    pre: 'C:\\> net use\nNew connections will be remembered.\n\nStatus       Local     Remote                Network\n\n------------------------------------------------------------------\nOK           Z:        \\\\LAB-PC07\\homework   Microsoft Windows Network\nUnavailable  Y:        \\\\ACC-PC\\Finance      Microsoft Windows Network\nThe command completed successfully.',
    options: ['Z: และ Y: ใช้งานได้ปกติทั้งคู่', 'Y: ถูกลบไปแล้วด้วย net use Y: /delete', 'Y: ยังจำการผูกไว้ แต่ติดต่อแชร์ของ ACC-PC ไม่ได้ขณะนี้', 'Z: เป็นแชร์ที่เครื่องนี้เปิดให้เครื่องอื่นใช้'],
    correct: 2,
    why: ['Y: มีสถานะ Unavailable จึงยังใช้ไม่ได้', 'ถ้าลบแล้ว Y: จะไม่อยู่ในรายการ net use เลย', '', 'net use แสดงไดรฟ์ที่เครื่องนี้ไปเชื่อมต่อแชร์ของเครื่องอื่น ส่วนแชร์ของเครื่องนี้ดูด้วย net share'],
    explain: 'net use แสดงไดรฟ์เครือข่ายที่เครื่องนี้ผูกไว้ Z: สถานะ OK ใช้งานได้ ส่วน Y: สถานะ Unavailable แปลว่ายังจำการผูกไว้ แต่ติดต่อ \\\\ACC-PC\\Finance ไม่ได้ในขณะนี้ เช่น เครื่อง ACC-PC ยังปิดหรือ Sleep อยู่ ควรตรวจว่าเครื่องนั้นเปิดและ ping ได้ ส่วนบรรทัด New connections will be remembered บอกว่าไดรฟ์ที่ผูกใหม่จะถูกจำไว้ใช้ครั้งต่อไป',
    tags: ['net-use', 'map-drive', 'troubleshooting']
  }),
  Q(9, 'hard', 'scenario', {
    context: 'ครูต้องการแชร์โฟลเดอร์ D:\\Exam บนเครื่อง LAB-PC07 (Windows 11 ในเครือข่ายห้องแล็บ) ในชื่อแชร์ exam ให้กลุ่ม Students เปิดอ่านไฟล์โจทย์ได้อย่างเดียว กลุ่ม Teachers แก้ไขไฟล์ได้ และเครื่องนักเรียนต้องเห็นเป็นไดรฟ์ X: ทุกครั้งที่ล็อกอิน',
    steps: [
      { q: 'ก่อนแชร์ เครือข่ายของเครื่อง LAB-PC07 ควรตั้งอย่างไร', options: ['Public และปิด Network discovery', 'Private เปิด Network discovery และ File and printer sharing', 'Public แต่เปิด File and printer sharing อย่างเดียว', 'Private และปิด File and printer sharing'], correct: 1 },
      { q: 'ควรกำหนดสิทธิ์อย่างไรจึงตรงตามที่ต้องการ', options: ['Share: Students Change / NTFS: Students Modify', 'Share: Teachers Read / NTFS: Teachers Modify', 'NTFS: Students Read โดยไม่ต้องแชร์โฟลเดอร์', 'Share: Students Read, Teachers Change / NTFS: Students Read, Teachers Modify'], correct: 3 },
      { q: 'คำสั่งใดใช้ผูกไดรฟ์ X: บนเครื่องนักเรียนให้กลับมาทุกครั้งที่ล็อกอิน', options: ['net use X: \\\\LAB-PC07\\exam /persistent:yes', 'net share X: \\\\LAB-PC07\\exam', 'net use X: /delete', 'net view X: \\\\LAB-PC07\\exam'], correct: 0 },
      { q: 'นักเรียนลองบันทึกไฟล์ลงไดรฟ์ X: แล้วขึ้น Access is denied ข้อใดถูกต้อง', options: ['ต้องแก้ Share เป็น Everyone Full Control ทันที', 'เป็นไปตามที่ออกแบบ เพราะสิทธิ์จริงของนักเรียนคือ Read', 'แสดงว่า Map ไดรฟ์ผิด ต้องใช้ IP แทนชื่อ', 'เครือข่ายเป็น Public จึงเขียนไม่ได้'], correct: 1 }
    ],
    explain: 'การแชร์ต้องใช้โปรไฟล์ Private ที่เปิด Network discovery และ File and printer sharing สิทธิ์จริงผ่านเครือข่ายคือสิทธิ์ที่จำกัดกว่าระหว่าง Share กับ NTFS นักเรียนจึงได้ Read และครูได้ Change/Modify ส่วน net use X: \\\\LAB-PC07\\exam /persistent:yes ผูกไดรฟ์แบบถาวร และ Access is denied ตอนนักเรียนบันทึกไฟล์คือผลที่ถูกต้องตามหลักสิทธิ์น้อยที่สุด',
    tags: ['file-sharing', 'ntfs', 'net-use', 'performance']
  })
];

/* NetLab 2.6: these questions were rewritten (new content), so they get new ids */
const RENAMED_26 = {"u6-004":"u6-044","u6-005":"u6-045","u6-006":"u6-046","u6-015":"u6-047","u6-024":"u6-048","u6-025":"u6-049","u6-037":"u6-050","u6-038":"u6-051"};
module.exports.forEach(q => { if (RENAMED_26[q.id]) q.id = RENAMED_26[q.id]; });

/* NetLab 2.6: versions of rewritten questions as they were in 2.5. Kept under their old ids so earlier exam
   attempts still show the question the student actually answered. retired = never drawn for new practice/exams. */
module.exports.push(...[
 {
  "id": "u6-004",
  "unit": 6,
  "week": 8,
  "level": "easy",
  "type": "choice",
  "q": "ใน Windows 10 และ Windows 11 การเปลี่ยนชื่อเครื่องผ่านแอป Settings อยู่ที่เมนูใด",
  "options": [
   "Settings → Accounts → Your info → Rename",
   "Settings → Network & internet → Properties → Rename",
   "Settings → System → About → Rename this PC",
   "Settings → Personalization → Device name"
  ],
  "correct": 2,
  "explain": "ทั้ง Windows 10 และ 11 อยู่ที่ Settings → System → About → Rename this PC (Windows 11 ปุ่มอยู่ด้านบนข้างชื่อเครื่อง) และต้องรีสตาร์ทก่อนชื่อใหม่จะมีผล",
  "tags": [
   "computer-name",
   "windows-settings"
  ],
  "retired": true,
  "replacedBy": "u6-044"
 },
 {
  "id": "u6-005",
  "unit": 6,
  "week": 8,
  "level": "medium",
  "type": "choice",
  "q": "พิมพ์คำสั่งใดในหน้าต่าง Run (Windows + R) เพื่อเปิด System Properties ที่มีแท็บ Computer Name สำหรับเปลี่ยน Workgroup",
  "options": [
   "ncpa.cpl",
   "sysdm.cpl",
   "devmgmt.msc",
   "msconfig"
  ],
  "correct": 1,
  "why": [
   "ncpa.cpl เปิดหน้าต่าง Network Connections",
   "",
   "devmgmt.msc เปิด Device Manager",
   "msconfig เปิด System Configuration"
  ],
  "explain": "sysdm.cpl เปิด System Properties แท็บ Computer Name กด Change... เพื่อเปลี่ยนชื่อเครื่องหรือเลือก Member of: Workgroup/Domain ใช้ได้ทั้ง Windows 10 และ 11",
  "tags": [
   "workgroup",
   "sysdm"
  ],
  "retired": true,
  "replacedBy": "u6-045"
 },
 {
  "id": "u6-006",
  "unit": 6,
  "week": 8,
  "level": "easy",
  "type": "command",
  "q": "พิมพ์คำสั่งใน Command Prompt ที่แสดงเฉพาะชื่อเครื่องคอมพิวเตอร์นี้ทันที",
  "os": "windows",
  "accept": [
   "^hostname(\\.exe)?$"
  ],
  "example": "hostname",
  "explain": "คำสั่ง hostname แสดงชื่อเครื่องใน Command Prompt หรือ PowerShell ทันที ใช้ตรวจหลังเปลี่ยนชื่อเครื่องและรีสตาร์ทแล้ว",
  "tags": [
   "hostname",
   "cmd"
  ],
  "retired": true,
  "replacedBy": "u6-046"
 },
 {
  "id": "u6-015",
  "unit": 6,
  "week": 8,
  "level": "medium",
  "type": "choice",
  "q": "ผลของ ipconfig /all แสดง IPv4 Address เป็น 192.168.20.30(Duplicate) ข้อใดสรุปได้ถูกต้อง",
  "options": [
   "ได้ IP จาก DHCP สำเร็จสองครั้งติดกัน",
   "เครื่องตั้ง DNS server ไว้สองตัวพร้อมกัน",
   "การ์ดเครือข่ายมี MAC Address สองค่า",
   "IP นี้ชนกับเครื่องอื่นในวงเดียวกัน"
  ],
  "correct": 3,
  "explain": "คำว่า (Duplicate) ต่อท้าย IPv4 Address แปลว่า IP ชนกับเครื่องอื่น (IP conflict) ทำให้ใช้งานเครือข่ายไม่ได้ ต้องเปลี่ยน IP ให้ไม่ซ้ำ",
  "tags": [
   "ipconfig",
   "ip-conflict"
  ],
  "retired": true,
  "replacedBy": "u6-047"
 },
 {
  "id": "u6-024",
  "unit": 6,
  "week": 9,
  "level": "easy",
  "type": "fill",
  "q": "เซิร์ฟเวอร์ในห้องแล็บมี IP 192.168.20.10 และแชร์โฟลเดอร์ชื่อ Docs ถ้าจะเปิดด้วย IP แทนชื่อเครื่อง ต้องพิมพ์ UNC path ว่า {{1}}",
  "blanks": [
   [
    "\\\\192.168.20.10\\Docs",
    "\\\\192.168.20.10\\Docs\\"
   ]
  ],
  "explain": "UNC path เขียนว่า \\\\ชื่อเครื่องหรือIP\\ชื่อแชร์ ใช้ IP แทนชื่อเครื่องได้ จึงเป็น \\\\192.168.20.10\\Docs",
  "tags": [
   "unc",
   "file-sharing"
  ],
  "retired": true,
  "replacedBy": "u6-048"
 },
 {
  "id": "u6-025",
  "unit": 6,
  "week": 9,
  "level": "easy",
  "type": "diagram",
  "diagram": "unc-share",
  "q": "จากภาพ ผู้ใช้เปิด \\\\SERVER\\Share ผ่านเครือข่าย Windows ตรวจทั้ง Share permission และ NTFS permission สิทธิ์ที่ผู้ใช้ได้จริงเป็นอย่างไร",
  "answerType": "choice",
  "options": [
   "ใช้สิทธิ์ที่กว้างกว่าของทั้งสองชั้น",
   "ใช้เฉพาะ Share permission อย่างเดียว",
   "ใช้สิทธิ์ที่จำกัดกว่าของทั้งสองชั้น",
   "ใช้เฉพาะ NTFS permission อย่างเดียว"
  ],
  "correct": 2,
  "explain": "เมื่อเข้าผ่านเครือข่าย Windows คำนวณสิทธิ์จาก Share และ NTFS แยกกัน แล้วใช้สิทธิ์ที่จำกัดกว่า (more restrictive) เป็นสิทธิ์ที่มีผลจริง",
  "tags": [
   "unc",
   "effective-permission"
  ],
  "retired": true,
  "replacedBy": "u6-049"
 },
 {
  "id": "u6-037",
  "unit": 6,
  "week": 9,
  "level": "easy",
  "type": "choice",
  "q": "เครื่องพิมพ์ที่มีพอร์ต LAN ในตัว วิธีใดที่ทำให้ทุกเครื่องสั่งพิมพ์ได้โดยไม่ต้องพึ่งคอมพิวเตอร์เครื่องใดเปิดอยู่",
  "options": [
   "ตั้ง IP คงที่ให้เครื่องพิมพ์ แล้วเพิ่มเครื่องพิมพ์ด้วย IP",
   "แชร์ผ่านคอมพิวเตอร์ที่ต่อสาย USB กับเครื่องพิมพ์ไว้",
   "ตั้งโปรไฟล์เครือข่ายของทุกเครื่องให้เป็น Public",
   "Map ไดรฟ์ Z: ไปที่แชร์ print$ ของเครื่องพิมพ์"
  ],
  "correct": 0,
  "explain": "เครื่องพิมพ์ที่มีพอร์ต LAN หรือ Wi-Fi ควรตั้ง IP คงที่ แล้วให้ทุกเครื่องเพิ่มเครื่องพิมพ์ด้วย IP โดยตรง จึงไม่ต้องพึ่งคอมพิวเตอร์ที่ทำหน้าที่ Print server",
  "tags": [
   "printer-sharing",
   "static-ip"
  ],
  "retired": true,
  "replacedBy": "u6-050"
 },
 {
  "id": "u6-038",
  "unit": 6,
  "week": 9,
  "level": "easy",
  "type": "choice",
  "q": "การตั้งค่าใดทำให้เครื่องเราค้นหาเครื่องอื่นได้ และให้เครื่องอื่นมองเห็นเครื่องเราในหน้า Network ของ File Explorer",
  "options": [
   "Network discovery",
   "Remote management",
   "MAC Address Filtering",
   "Client isolation"
  ],
  "correct": 0,
  "explain": "Network discovery ทำให้เครื่องค้นหาและถูกมองเห็นในเครือข่าย เปิดได้ที่ Advanced sharing settings ในส่วน Private พร้อมกับ File and printer sharing",
  "tags": [
   "network-discovery"
  ],
  "retired": true,
  "replacedBy": "u6-051"
 }
]);

/* 3.2: knowledge questions kept from the retired lab / room tasks after a duplicate check.
   src = the original task key (lab:wN-i or room:rN-i); see docs/BANK-FROM-LABS-3.2.md */
module.exports.push(...[
  { id: 'u6-052', unit: 6, week: 8, level: 'easy', type: 'choice', src: 'lab:w8-4',
    q: 'ต้องการเปลี่ยนชื่อเครื่องใน Windows 10/11 ผ่านแอป Settings ต้องเข้าที่ใด',
    options: ['Settings > Accounts > Your info > Rename', 'Settings > System > About > Rename this PC', 'Control Panel > Network and Sharing > Change adapter settings', 'Settings > Personalization > Themes'],
    correct: 1,
    explain: 'ใน Windows 10/11 เปลี่ยนชื่อเครื่องได้ที่ Settings > System > About > Rename this PC (หรือ System Properties แท็บ Computer Name) หลังเปลี่ยนชื่อต้องรีสตาร์ทเครื่องก่อน ชื่อใหม่จึงจะมีผล',
    tags: ['computer-name', 'windows'] },

  { id: 'u6-053', unit: 6, week: 9, level: 'easy', type: 'order', src: 'lab:w9-6',
    q: 'เรียงขั้นตอนการเชื่อมต่อเครือข่ายไร้สายใน Windows ให้ถูกต้อง',
    items: ['คลิกไอคอนเครือข่ายที่ Taskbar', 'เลือกชื่อเครือข่าย (SSID)', 'กด Connect', 'ใส่รหัสผ่าน (Security key)', 'ตรวจว่าขึ้นสถานะ Connected'],
    explain: 'คลิกไอคอนเครือข่ายที่ Taskbar แล้วเลือกชื่อเครือข่าย (SSID) กด Connect ใส่รหัสผ่าน (Security key) และตรวจว่าขึ้น Connected ถ้าเพิ่งเปลี่ยนรหัสที่ Router แล้วต่อไม่ได้ ให้ Forget เครือข่ายนั้นแล้วต่อใหม่',
    tags: ['wifi', 'windows'] },

  { id: 'u6-054', unit: 6, week: 8, level: 'medium', type: 'fill', src: 'room:r5-9',
    q: 'เลข 192 เขียนเป็นเลขฐานสอง 8 บิตได้เป็น {{1}}',
    blanks: [['11000000']],
    explain: 'ค่าประจำหลักของ 8 บิตคือ 128 64 32 16 8 4 2 1 และ 192 = 128 + 64 จึงเป็น 11000000 การแปลงนี้ใช้ทุกครั้งที่หา Subnet Mask หรือ Network Address',
    tags: ['binary', 'ip-address'] },

  { id: 'u6-055', unit: 6, week: 8, level: 'medium', type: 'fill', src: 'room:r5-10',
    q: 'Subnet Mask 255.255.240.0 เขียนแบบ CIDR ได้เป็น / {{1}} (ตอบเป็นตัวเลข)',
    blanks: [['20', '/20']],
    explain: '255 คือบิต 1 จำนวน 8 บิต สองส่วนแรกจึงได้ 16 บิต และ 240 = 11110000 มีบิต 1 อีก 4 บิต รวม 8 + 8 + 4 = 20 จึงเขียนเป็น /20',
    tags: ['cidr', 'subnet-mask', 'prefix'] },

  { id: 'u6-056', unit: 6, week: 8, level: 'easy', type: 'choice', src: 'room:r5-12',
    q: 'NAT (Network Address Translation) ในเราเตอร์ทำหน้าที่อะไร',
    options: ['แปลงชื่อโดเมนเป็น IP Address ให้เครื่องลูกข่าย', 'แจก IP Address ให้เครื่องลูกข่ายในวงแลนโดยอัตโนมัติ', 'แปลง Private IP เป็น Public IP เพื่อออกอินเทอร์เน็ต', 'เข้ารหัสข้อมูลก่อนส่งออกไปยังอินเทอร์เน็ต'],
    correct: 2,
    explain: 'NAT แปลง Private IP ของเครื่องในวงเป็น Public IP เพื่อออกอินเทอร์เน็ต ทำให้หลายเครื่องใช้ Public IP เดียวกันได้และช่วยประหยัด IPv4 ส่วนการแปลงชื่อเป็นงานของ DNS และการแจก IP เป็นงานของ DHCP',
    tags: ['nat', 'private-ip'] },

  { id: 'u6-057', unit: 6, week: 8, level: 'easy', type: 'fill', src: 'room:r5-13',
    q: 'IPv4 Address มีความยาว 32 บิต ส่วน IPv6 Address มีความยาว {{1}} บิต',
    blanks: [['128']],
    explain: 'IPv6 ยาว 128 บิต (มากกว่า IPv4 สี่เท่า) เขียนเป็นเลขฐานสิบหก 8 กลุ่ม กลุ่มละ 16 บิต คั่นด้วยเครื่องหมาย : จึงมีหมายเลขเพียงพอสำหรับอุปกรณ์จำนวนมหาศาล',
    tags: ['ipv6'] }
]);
