'use strict';
// Question bank: Unit 7 (weeks 10-12) ระบบปฏิบัติการเครือข่าย (NOS) และเครื่องจำลอง
module.exports = [
  // ---------------- Week 10: ความหมายและบริการของ NOS ----------------
  {
    id: 'u7-001', unit: 7, week: 10, level: 'easy', type: 'choice',
    q: 'คำว่า NOS ในวิชาเครือข่ายคอมพิวเตอร์ย่อมาจากข้อใด',
    options: ['Network Organization Software', 'Node Operating Service', 'Network Operating System', 'Network Online Security System'],
    correct: 2,
    why: ['ไม่ใช่ชื่อเต็มของ NOS และไม่มีซอฟต์แวร์ชื่อนี้', 'Node หมายถึงจุดเชื่อมต่อ ไม่ใช่ชื่อเต็มของ NOS', '', 'ความปลอดภัยเป็นเพียงบริการหนึ่งของ NOS'],
    explain: 'NOS ย่อมาจาก Network Operating System คือระบบปฏิบัติการที่ติดตั้งบนเซิร์ฟเวอร์เพื่อให้บริการและจัดการทรัพยากรแก่เครื่องลูกข่ายจำนวนมาก',
    tags: ['nos', 'definition']
  },
  {
    id: 'u7-002', unit: 7, week: 10, level: 'easy', type: 'tf',
    q: 'เซิร์ฟเวอร์ที่ใช้งานจริงในองค์กรมักเลือกฮาร์ดแวร์ที่ทนทานกว่าเครื่องลูกข่าย เช่น มีพาวเวอร์ซัพพลายสำรองและใช้ RAM แบบ ECC เพราะต้องให้บริการต่อเนื่องตลอดเวลา',
    answer: true,
    explain: 'ในทางหลักการ บทบาทเซิร์ฟเวอร์กำหนดโดยระบบปฏิบัติการและบริการที่ติดตั้ง แต่เซิร์ฟเวอร์จริงต้องทำงานต่อเนื่องและให้บริการหลายคน จึงนิยมฮาร์ดแวร์ที่ทนทาน เช่น พาวเวอร์ซัพพลายสำรองและ RAM แบบ ECC ที่ตรวจและแก้บิตผิดพลาดได้',
    tags: ['nos', 'server', 'hardware']
  },
  {
    id: 'u7-003', unit: 7, week: 10, level: 'medium', type: 'match',
    q: 'จับคู่บริการของ NOS กับตัวอย่างงานที่บริการนั้นทำ',
    left: ['File & Print Sharing', 'Management Services', 'Security Services', 'Internet/Intranet Services'],
    right: [
      'ยืนยันตัวตน กำหนดสิทธิ์ และบันทึกการเข้าใช้',
      'ให้บริการเว็บภายใน อีเมล DNS และ DHCP',
      'เก็บไฟล์ไว้ที่เดียวและจัดคิวงานพิมพ์ร่วมกัน',
      'จัดการบัญชีผู้ใช้ กลุ่ม และนโยบายจากจุดเดียว',
      'เร่งความเร็ว CPU ด้วยการโอเวอร์คล็อก'
    ],
    answer: [2, 3, 0, 1],
    explain: 'File & Print ให้ใช้ไฟล์และเครื่องพิมพ์ร่วมกัน Management จัดการผู้ใช้และนโยบายจากส่วนกลาง Security ทำ Authentication, Authorization, Auditing ส่วน Internet/Intranet ให้บริการเว็บ อีเมล DNS DHCP',
    tags: ['nos', 'services']
  },
  {
    id: 'u7-004', unit: 7, week: 10, level: 'easy', type: 'match',
    q: 'จับคู่บริการที่เซิร์ฟเวอร์ NOS ให้บริการกับหมายเลขพอร์ตที่ใช้บ่อย',
    left: ['HTTPS', 'DNS', 'DHCP', 'SSH'],
    right: ['22', '53', '67 / 68', '443', '3389'],
    answer: [3, 1, 2, 0],
    explain: 'HTTPS ใช้พอร์ต 443, DNS ใช้ 53 (UDP และ TCP), DHCP ใช้ UDP 67/68 และ SSH ใช้ 22 ส่วน 3389 เป็นพอร์ตของ Remote Desktop (RDP)',
    tags: ['ports', 'services']
  },
  {
    id: 'u7-005', unit: 7, week: 10, level: 'easy', type: 'choice',
    q: 'บริการไดเรกทอรี (Directory Service) ที่ใช้เก็บบัญชีผู้ใช้ กลุ่ม และนโยบายใน Windows Server มีชื่อว่าอะไร',
    options: ['Network File System', 'Active Directory', 'Print Spooler', 'Hyper-V Manager'],
    correct: 1,
    why: ['NFS เป็นโปรโตคอลแชร์ไฟล์ของ Linux/UNIX', '', 'Print Spooler คือคิวงานพิมพ์', 'Hyper-V ใช้สร้างเครื่องจำลอง'],
    explain: 'Windows Server ใช้ Active Directory เป็นฐานข้อมูลกลางของบัญชีผู้ใช้ กลุ่ม เครื่อง และนโยบาย ส่วนฝั่ง Linux นิยมใช้บริการไดเรกทอรีที่ทำงานด้วยโปรโตคอล LDAP เช่น OpenLDAP',
    tags: ['directory', 'active-directory', 'management']
  },
  {
    id: 'u7-006', unit: 7, week: 10, level: 'medium', type: 'fill',
    q: 'เครือข่ายวินโดวส์แชร์ไฟล์ด้วยโปรโตคอล {{1}} ส่วนระบบ Linux/UNIX นิยมใช้ {{2}} และ Linux ให้บริการแชร์ไฟล์แก่เครื่องวินโดวส์ได้ด้วยโปรแกรม {{3}}',
    blanks: [['SMB', 'Server Message Block', 'CIFS'], ['NFS', 'Network File System'], ['Samba']],
    explain: 'Windows ใช้ SMB (Server Message Block) พอร์ต TCP 445, Linux/UNIX นิยม NFS และโปรแกรม Samba ทำให้ Linux ให้บริการ SMB แก่ Windows ได้',
    tags: ['file-sharing', 'smb', 'nfs', 'samba']
  },
  {
    id: 'u7-007', unit: 7, week: 10, level: 'medium', type: 'multi',
    q: 'ข้อใดเป็นงานของบริการด้านการจัดการ (Management Services) ของ NOS (เลือกได้หลายข้อ)',
    options: [
      'สร้าง แก้ไข และระงับบัญชีผู้ใช้จากส่วนกลาง',
      'แปลงชื่อโดเมนเป็น IP Address ให้เครื่องลูกข่าย',
      'บังคับความยาวรหัสผ่านทุกเครื่องด้วย Group Policy',
      'ติดตั้งซอฟต์แวร์และอัปเดตให้หลายเครื่องพร้อมกัน',
      'แบ่งคำขอไปยังเว็บเซิร์ฟเวอร์หลายเครื่องพร้อมกัน'
    ],
    correct: [0, 2, 3],
    explain: 'Management Services ได้แก่ จัดการบัญชีและกลุ่ม กำหนดนโยบาย (Group Policy) และติดตั้งซอฟต์แวร์/อัปเดตหลายเครื่อง ส่วนการแปลงชื่อเป็นงานของ DNS และการแบ่งคำขอเป็น Load Balancing',
    tags: ['management', 'group-policy']
  },
  {
    id: 'u7-008', unit: 7, week: 10, level: 'hard', type: 'choice',
    q: 'บริษัทมีไฟล์เซิร์ฟเวอร์แบบ Failover Cluster 2 โหนด วันหนึ่งพนักงานลบโฟลเดอร์ใบแจ้งหนี้ทิ้งโดยไม่ตั้งใจ ข้อใดถูกต้อง',
    options: [
      'โหนดสำรองยังมีโฟลเดอร์เดิม จึงเปิดจากโหนดนั้นได้ทันที',
      'ทุกโหนดใช้ข้อมูลชุดเดียวกัน ต้องกู้จากข้อมูลสำรอง',
      'ตัวกระจายโหลดจะกู้โฟลเดอร์คืนให้เองภายในไม่กี่วินาที',
      'ต้องเพิ่ม CPU ให้โหนดหลักเพื่อให้ระบบสร้างไฟล์กลับมา'
    ],
    correct: 1,
    why: ['ทุกโหนดใช้ข้อมูลชุดเดียวกัน การลบจึงมีผลทั้งคลัสเตอร์', '', 'Load Balancing แบ่งงาน ไม่ได้เก็บสำเนาไฟล์ที่ถูกลบ', 'จำนวน CPU ไม่เกี่ยวกับการกู้ไฟล์'],
    explain: 'Clustering ช่วยให้บริการไม่หยุดเมื่อเครื่องเสีย แต่ไม่ใช่การสำรองข้อมูล การลบหรือการถูกเข้ารหัสจะเกิดกับข้อมูลที่ทุกโหนดใช้ร่วมกัน จึงต้องมี Backup แยกไว้เสมอ',
    tags: ['clustering', 'backup', 'failover']
  },
  {
    id: 'u7-009', unit: 7, week: 10, level: 'medium', type: 'choice',
    q: 'พนักงานบัญชีล็อกอินเข้าไฟล์เซิร์ฟเวอร์แล้วเปิดโฟลเดอร์ฝ่ายบัญชี ข้อใดเรียงลำดับบริการความปลอดภัยของ NOS ที่เกิดขึ้นได้ถูกต้อง',
    options: ['Authorization → Authentication → Auditing', 'Auditing → Authentication → Authorization', 'Authentication → Auditing → Authorization', 'Authentication → Authorization → Auditing'],
    correct: 3,
    why: ['ต้องรู้ก่อนว่าเป็นใคร (Authentication) จึงจะตัดสินสิทธิ์ได้', 'Auditing คือการบันทึกและตรวจย้อนหลังสิ่งที่ทำไปแล้ว จึงไม่ได้มาก่อน', 'ต้องตัดสินสิทธิ์ก่อนจึงจะมีการกระทำให้บันทึกและตรวจสอบ', ''],
    explain: 'ขั้นแรกพิสูจน์ว่าเป็นใคร (Authentication) ด้วยชื่อผู้ใช้และรหัสผ่าน จากนั้นตัดสินว่าเปิดโฟลเดอร์ใดได้ (Authorization) และระบบบันทึกการเข้าใช้ไว้ตรวจย้อนหลัง (Auditing)',
    tags: ['security', 'aaa']
  },
  {
    id: 'u7-010', unit: 7, week: 10, level: 'medium', type: 'choice',
    q: 'ข้อใดอธิบายความแตกต่างระหว่าง Multiprocessing กับ Clustering ได้ถูกต้อง',
    options: [
      'Multiprocessing ใช้หลายเซิร์ฟเวอร์ ส่วน Clustering ใช้หลาย CPU ในเครื่องเดียว',
      'ทั้งสองแบบใช้ CPU ตัวเดียว แต่ Clustering แบ่งเวลาให้แต่ละโปรแกรม',
      'Multiprocessing ใช้หลาย CPU ในเครื่องเดียว ส่วน Clustering ใช้หลายเครื่องร่วมกัน',
      'Clustering คือการสำรองข้อมูล ส่วน Multiprocessing คือการเข้ารหัสข้อมูล'
    ],
    correct: 2,
    why: ['สลับกัน Multiprocessing อยู่ในเครื่องเดียว ส่วน Clustering ใช้หลายเครื่อง', 'ทั้งสองแบบใช้ CPU หลายตัว ไม่ใช่ตัวเดียว', '', 'ทั้งสองไม่ใช่การสำรองข้อมูลหรือการเข้ารหัส แต่เป็นการเพิ่มกำลังและความต่อเนื่องของบริการ'],
    explain: 'Multiprocessing (เช่น SMP) ใช้ CPU หลายตัวหรือหลายคอร์ภายในเครื่องเดียว ส่วน Clustering นำเซิร์ฟเวอร์หลายเครื่อง (โหนด) มาทำงานร่วมกันเพื่อ Failover หรือ Load Balancing',
    tags: ['multiprocessing', 'clustering']
  },
  {
    id: 'u7-011', unit: 7, week: 10, level: 'easy', type: 'tf',
    q: 'เซิร์ฟเวอร์ที่ใช้ Linux หรือ Windows Server Core มักติดตั้งแบบไม่มีหน้าจอกราฟิก เพื่อประหยัดทรัพยากรและลดช่องโหว่',
    answer: true,
    explain: 'การไม่มีหน้าจอกราฟิกทำให้ใช้ RAM น้อยและมีโปรแกรมที่อาจเป็นช่องโหว่น้อยลง ผู้ดูแลสั่งงานผ่านบรรทัดคำสั่งหรือเชื่อมต่อระยะไกลแทน',
    tags: ['nos', 'server-core']
  },
  {
    id: 'u7-012', unit: 7, week: 10, level: 'hard', type: 'scenario',
    context: 'คลินิกทันตกรรมมีคอมพิวเตอร์ 12 เครื่อง แต่ละเครื่องเก็บแฟ้มคนไข้ไว้ในเครื่องตัวเองและแชร์โฟลเดอร์กันแบบเพียร์ทูเพียร์ เมื่อหลายคนสั่งพิมพ์ใบนัดพร้อมกัน งานพิมพ์มักหายหรือออกสลับกัน และทุกครั้งที่พนักงานใหม่เข้ามา ต้องสร้างบัญชีให้ทีละเครื่อง',
    steps: [
      { q: 'คลินิกควรเปลี่ยนเป็นสถาปัตยกรรมแบบใด', options: ['Peer-to-Peer ที่เพิ่มเครื่องให้มากขึ้น', 'Client-Server ที่มีเซิร์ฟเวอร์ใช้ NOS', 'Ad-Hoc แบบไร้สายทุกเครื่อง', 'Bus ที่ต่อทุกเครื่องด้วยสายเส้นเดียว'], correct: 1 },
      { q: 'ปัญหางานพิมพ์ชนกัน ควรแก้ด้วยบริการใดของ NOS', options: ['Print Server ที่มีคิวงานพิมพ์ (Spooler)', 'DNS Server ที่แปลงชื่อเป็น IP', 'Disk Quota ที่จำกัดพื้นที่ผู้ใช้', 'Load Balancer ที่แบ่งงานเว็บ'], correct: 0 },
      { q: 'ต้องการให้พนักงานใช้บัญชีเดียวเข้าสู่ระบบได้ทุกเครื่อง ควรใช้สิ่งใด', options: ['สร้างบัญชี Guest ร่วมกันทั้งคลินิก', 'แชร์รหัสผ่าน Administrator ให้ทุกคน', 'คัดลอกบัญชีไปทุกเครื่องด้วยแฟลชไดรฟ์', 'บริการไดเรกทอรี เช่น Active Directory'], correct: 3 }
    ],
    explain: 'เมื่อเครื่องและผู้ใช้มากขึ้น ควรใช้ Client-Server ที่มี NOS: Print Server จัดคิวงานพิมพ์ทีละงาน และ Directory Service อย่าง Active Directory ให้ผู้ใช้มีบัญชีเดียวจากส่วนกลาง',
    tags: ['nos', 'client-server', 'print-server', 'directory']
  },

  // ---------------- Week 11: ซอฟต์แวร์ NOS และเครื่องจำลอง ----------------
  {
    id: 'u7-013', unit: 7, week: 11, level: 'easy', type: 'choice',
    q: 'Ubuntu Server, Debian, Red Hat Enterprise Linux และ Rocky Linux มีความสัมพันธ์กับ Linux อย่างไร',
    options: ['เป็น UNIX เชิงพาณิชย์ที่พัฒนาโดย Sun', 'เป็น Hypervisor แบบ Type 1 สำหรับศูนย์ข้อมูล', 'เป็นรุ่นย่อยของ Windows Server สาย NT', 'เป็นดิสทริบิวชันที่ใช้เคอร์เนล Linux'],
    correct: 3,
    why: ['UNIX เชิงพาณิชย์ของ Sun คือ Solaris', 'ทั้งหมดเป็นระบบปฏิบัติการ ไม่ใช่ Hypervisor แม้ Linux จะรัน KVM ได้', 'Windows Server มาจากสาย Windows NT ของ Microsoft ไม่เกี่ยวกับ Linux', ''],
    explain: 'ดิสทริบิวชัน (Distribution) คือชุดระบบปฏิบัติการที่รวมเคอร์เนล Linux กับโปรแกรมและเครื่องมือติดตั้ง สำหรับเซิร์ฟเวอร์ที่นิยม เช่น Ubuntu Server, Debian, RHEL และ Rocky Linux ส่วนเคอร์เนล Linux เผยแพร่ครั้งแรกโดย Linus Torvalds ในปี 1991',
    tags: ['linux', 'distribution']
  },
  {
    id: 'u7-014', unit: 7, week: 11, level: 'medium', type: 'match',
    q: 'จับคู่ระบบปฏิบัติการเครือข่ายกับผู้พัฒนาหรือแหล่งกำเนิด',
    left: ['NetWare', 'UNIX', 'Solaris', 'Windows Server'],
    right: ['Microsoft (สาย Windows NT)', 'Novell', 'Bell Labs ของ AT&T', 'Sun Microsystems (ปัจจุบัน Oracle)', 'Innotek'],
    answer: [1, 2, 3, 0],
    explain: 'NetWare เป็นของ Novell, UNIX กำเนิดที่ Bell Labs ของ AT&T, Solaris พัฒนาโดย Sun Microsystems ซึ่ง Oracle ซื้อกิจการในปี 2010 และ Windows Server ของ Microsoft สืบทอดจาก Windows NT (Innotek คือผู้พัฒนา VirtualBox รุ่นแรก)',
    tags: ['nos', 'history', 'vendors']
  },
  {
    id: 'u7-015', unit: 7, week: 11, level: 'hard', type: 'order',
    q: 'เรียงเหตุการณ์ของระบบปฏิบัติการเครือข่ายจากเก่าที่สุดไปใหม่ที่สุด',
    items: [
      'UNIX ถือกำเนิดที่ Bell Labs',
      'Novell ออก NetWare รุ่นแรก',
      'Linus Torvalds เผยแพร่เคอร์เนล Linux',
      'Windows 2000 Server มาพร้อม Active Directory',
      'Oracle ซื้อกิจการ Sun และใช้ชื่อ Oracle Solaris'
    ],
    explain: 'UNIX ราวปี 1969, NetWare ปี 1983, Linux ปี 1991, Windows 2000 Server (มี Active Directory) ปี 2000 และ Oracle ซื้อ Sun ในปี 2010',
    tags: ['history', 'unix', 'netware', 'linux']
  },
  {
    id: 'u7-016', unit: 7, week: 11, level: 'easy', type: 'tf',
    q: 'ปัจจุบัน Novell NetWare ยังเป็น NOS ที่นิยมติดตั้งใหม่ในสำนักงานมากที่สุด',
    answer: false,
    explain: 'NetWare เคยครองตลาดช่วงทศวรรษ 1980 ถึงกลาง 1990 แต่เมื่อ TCP/IP และ Windows Server แพร่หลายก็ค่อย ๆ หายไป ปัจจุบันเลิกพัฒนาแล้ว',
    tags: ['netware', 'history']
  },
  {
    id: 'u7-017', unit: 7, week: 11, level: 'easy', type: 'choice',
    q: 'ซอฟต์แวร์ที่สร้างและควบคุมเครื่องจำลอง คอยแบ่ง CPU, RAM และอุปกรณ์ของเครื่องจริงให้แต่ละ Guest เรียกว่าอะไร',
    options: ['Hypervisor', 'Guest Additions', 'Device Driver', 'BIOS/UEFI'],
    correct: 0,
    why: ['', 'Guest Additions เป็นส่วนเสริมที่ติดตั้งใน Guest', 'ไดรเวอร์ควบคุมอุปกรณ์ชิ้นเดียว ไม่ได้สร้างเครื่องจำลอง', 'BIOS/UEFI เป็นเฟิร์มแวร์เริ่มต้นเครื่อง'],
    explain: 'Hypervisor หรือ Virtual Machine Monitor (VMM) คือซอฟต์แวร์ที่สร้างเครื่องจำลอง แบ่งทรัพยากรจริงให้แต่ละ Guest และแยกแต่ละเครื่องออกจากกัน',
    tags: ['hypervisor', 'vm']
  },
  {
    id: 'u7-018', unit: 7, week: 11, level: 'medium', type: 'multi',
    q: 'ซอฟต์แวร์ใดเป็น Hypervisor แบบ Type 1 (Bare-metal) (เลือกได้หลายข้อ)',
    options: ['VMware ESXi', 'Oracle VirtualBox', 'Microsoft Hyper-V', 'Parallels Desktop', 'Proxmox VE'],
    correct: [0, 2, 4],
    explain: 'Type 1 ทำงานบนฮาร์ดแวร์โดยตรง เช่น VMware ESXi, Hyper-V, Xen และ Proxmox VE ส่วน VirtualBox และ Parallels Desktop เป็น Type 2 ที่ติดตั้งบน Host OS',
    tags: ['hypervisor', 'type1']
  },
  {
    id: 'u7-019', unit: 7, week: 11, level: 'hard', type: 'choice',
    q: 'นักเรียนเปิดใช้ Hyper-V จากหน้าต่าง Windows 11 Pro ข้อใดจัดประเภทได้ถูกต้องพร้อมเหตุผล',
    options: [
      'Type 2 เพราะเปิดใช้จากในหน้าต่างของ Windows',
      'Type 2 เพราะต้องมี Windows อยู่ก่อนจึงเปิดใช้ได้',
      'ไม่ใช่ Hypervisor เพราะเป็นเพียงคุณสมบัติของ Windows',
      'Type 1 เพราะ Hypervisor ทำงานอยู่ใต้ Windows โดยตรง'
    ],
    correct: 3,
    why: ['การเปิดจากหน้าต่าง Windows ไม่ได้ทำให้เป็น Type 2', 'เมื่อเปิดแล้ว Windows กลายเป็นเครื่องพิเศษเครื่องหนึ่งบน Hypervisor', 'Hyper-V เป็น Hypervisor จริง ใช้ในศูนย์ข้อมูลด้วย', ''],
    explain: 'เมื่อเปิด Hyper-V ตัว Hypervisor จะทำงานบนฮาร์ดแวร์ใต้ Windows และ Windows กลายเป็นเหมือนเครื่องพิเศษเครื่องหนึ่ง จึงจัดเป็น Type 1',
    tags: ['hyper-v', 'hypervisor', 'type1']
  },
  {
    id: 'u7-020', unit: 7, week: 11, level: 'medium', type: 'fill',
    q: 'ใน Windows ตรวจว่าเปิด VT-x หรือ AMD-V แล้วหรือยัง โดยเปิดโปรแกรม {{1}} ไปที่แท็บ {{2}} เลือก CPU แล้วดูบรรทัด Virtualization',
    blanks: [['Task Manager', 'ตัวจัดการงาน', 'taskmgr', 'taskmgr.exe'], ['Performance', 'ประสิทธิภาพ']],
    explain: 'Task Manager แท็บ Performance หน้า CPU มีบรรทัด Virtualization บอกว่า Enabled หรือ Disabled ถ้าปิดอยู่ต้องเข้าไปเปิดใน BIOS/UEFI',
    tags: ['vt-x', 'amd-v', 'task-manager']
  },
  {
    id: 'u7-021', unit: 7, week: 11, level: 'easy', type: 'choice',
    q: 'การติดตั้ง Guest Additions ลงในเครื่องจำลอง VirtualBox มีประโยชน์ข้อใด',
    options: [
      'ปรับขนาดจอ แชร์โฟลเดอร์ และใช้คลิปบอร์ดร่วมกัน',
      'เปิด VT-x ใน BIOS ของ Host ให้อัตโนมัติ',
      'เพิ่ม RAM จริงให้เครื่อง Host โดยไม่ต้องซื้อ',
      'แปลงไฟล์ดิสก์ VDI ให้เป็นไฟล์ ISO สำหรับติดตั้ง'
    ],
    correct: 0,
    why: ['', 'VT-x ต้องเปิดเองใน BIOS/UEFI ของเครื่องจริง Guest Additions ทำแทนไม่ได้', 'Guest Additions ไม่ได้เพิ่ม RAM จริงให้ Host', 'Guest Additions ไม่ได้แปลงไฟล์ดิสก์ และ ISO ใช้สำหรับติดตั้ง ไม่ใช่ดิสก์เสมือน'],
    explain: 'Guest Additions ติดตั้งใน Guest เพื่อให้ปรับขนาดจอ แชร์โฟลเดอร์ และคัดลอกข้อความระหว่าง Host กับ Guest ได้ ฝั่ง VMware มี VMware Tools ทำหน้าที่คล้ายกัน',
    tags: ['virtualbox', 'guest-additions']
  },
  {
    id: 'u7-022', unit: 7, week: 11, level: 'easy', type: 'tf',
    q: 'Hypervisor แบบ Type 2 มีประสิทธิภาพสูงกว่า Type 1 เพราะติดตั้งบนระบบปฏิบัติการที่ผู้ใช้คุ้นเคย',
    answer: false,
    explain: 'Type 2 ต้องทำงานผ่าน Host OS อีกชั้นจึงเสียประสิทธิภาพมากกว่า ส่วน Type 1 ติดตั้งบนฮาร์ดแวร์โดยตรง สูญเสียน้อยและเหมาะกับศูนย์ข้อมูล',
    tags: ['hypervisor', 'type1', 'type2']
  },
  {
    id: 'u7-023', unit: 7, week: 11, level: 'hard', type: 'scenario',
    context: 'นักเรียนใช้โน้ตบุ๊ก CPU ยี่ห้อ AMD ติดตั้ง VirtualBox แล้วเปิดเครื่องจำลอง Ubuntu Server 64 บิตไม่ได้ เมื่อเปิด Task Manager แท็บ Performance หน้า CPU พบบรรทัด Virtualization: Disabled',
    steps: [
      { q: 'ผลใน Task Manager บอกอะไร', options: ['ไฟล์ ISO ของ Ubuntu เสียหาย', 'RAM ของเครื่องไม่พอสำหรับ Guest', 'ความสามารถช่วยจำลองเครื่องใน CPU ถูกปิดอยู่', 'การ์ดแลนไม่รองรับโหมด Bridged'], correct: 2 },
      { q: 'เมื่อเข้า BIOS/UEFI ของเครื่อง AMD ควรเปิดตัวเลือกใด', options: ['Secure Boot', 'SVM Mode (AMD-V)', 'Fast Boot', 'Wake on LAN'], correct: 1 },
      { q: 'หลังเปิดแล้ว เครื่องจำลองทำงานได้แต่ช้ามากและมีไอคอนรูปเต่าที่มุมจอ สาเหตุที่เป็นไปได้คือข้อใด', options: ['Windows เปิดคุณสมบัติที่ใช้ Hyper-V อยู่ เช่น WSL2', 'ไฟล์ดิสก์เสมือนเป็นแบบ Dynamically allocated', 'ตั้งโหมดเครือข่ายเป็น NAT แทน Bridged', 'ยังไม่ได้สร้าง Snapshot ของเครื่องจำลอง'], correct: 0 }
    ],
    explain: 'Virtualization: Disabled แปลว่า AMD-V ถูกปิด ต้องเปิด SVM Mode ใน BIOS/UEFI ส่วนอาการช้าพร้อมไอคอนเต่าเกิดเมื่อ VirtualBox ต้องทำงานผ่าน Hyper-V เพราะ Windows เปิด Hyper-V, WSL2 หรือ Memory Integrity อยู่ ควรปรึกษาครูก่อนปิดคุณสมบัติใด ๆ',
    tags: ['amd-v', 'svm', 'virtualbox', 'troubleshooting']
  },
  {
    id: 'u7-024', unit: 7, week: 11, level: 'easy', type: 'choice',
    q: 'ข้อใดเป็นความต้องการฮาร์ดแวร์ที่จำเป็นที่สุดสำหรับรัน Guest แบบ 64 บิตใน VirtualBox รุ่นใหม่',
    options: ['การ์ดจอแยกที่มีหน่วยความจำ 4 GB', 'CPU 64 บิตที่เปิด VT-x หรือ AMD-V', 'ฮาร์ดดิสก์แบบ HDD แทน SSD', 'อินเทอร์เน็ตความเร็ว 1 Gbps ขึ้นไป'],
    correct: 1,
    why: ['Ubuntu Server และงานฝึกเครือข่ายไม่ต้องใช้การ์ดจอแยก', '', 'SSD ทำงานได้และเร็วกว่า HDD ไม่ใช่ข้อห้าม', 'ความเร็วอินเทอร์เน็ตไม่เกี่ยวกับการรันเครื่องจำลอง'],
    explain: 'การจำลองเครื่องต้องพึ่ง Hardware-assisted Virtualization ใน CPU (VT-x ของ Intel หรือ AMD-V ของ AMD) ถ้าปิดอยู่จะรัน Guest 64 บิตไม่ได้ ส่วน SSD ยิ่งช่วยให้เร็วกว่า HDD',
    tags: ['vt-x', 'amd-v', 'hardware']
  },
  {
    id: 'u7-025', unit: 7, week: 11, level: 'medium', type: 'diagram', diagram: 'vm-layers',
    q: 'จากภาพชั้นของระบบเครื่องจำลอง ถ้าห้องเซิร์ฟเวอร์เปลี่ยนจาก VirtualBox มาใช้ VMware ESXi ซึ่งเป็น Type 1 ชั้นใดในภาพจะไม่มีอีกต่อไป',
    answerType: 'choice',
    options: ['ฮาร์ดแวร์จริง (CPU, RAM, ดิสก์)', 'Host OS', 'Hypervisor', 'Guest OS'],
    correct: 1,
    why: ['Hypervisor ทุกแบบยังต้องมีฮาร์ดแวร์จริงรองรับ', '', 'ESXi เองก็คือ Hypervisor จึงยังมีชั้นนี้อยู่', 'Guest OS ยังอยู่ เพราะเป็นระบบที่รันในเครื่องจำลอง'],
    explain: 'Hypervisor แบบ Type 1 ติดตั้งลงบนฮาร์ดแวร์โดยตรงแทนระบบปฏิบัติการ จึงไม่มี Host OS คั่นกลาง ส่วนฮาร์ดแวร์ Hypervisor และ Guest OS ยังมีอยู่',
    tags: ['hypervisor', 'type1', 'vm-layers']
  },
  {
    id: 'u7-026', unit: 7, week: 11, level: 'medium', type: 'choice',
    q: 'Solaris เป็นระบบ UNIX เชิงพาณิชย์ที่ขึ้นชื่อเรื่องระบบไฟล์ที่ทนทาน ระบบไฟล์นั้นชื่ออะไร',
    options: ['NTFS', 'FAT32', 'ZFS', 'exFAT'],
    correct: 2,
    why: ['NTFS เป็นระบบไฟล์หลักของ Windows', 'FAT32 เป็นระบบไฟล์รุ่นเก่าที่ใช้กับแฟลชไดรฟ์และ Windows', '', 'exFAT เป็นระบบไฟล์สำหรับแฟลชไดรฟ์และการ์ดหน่วยความจำ'],
    explain: 'Solaris ของ Sun Microsystems (ปัจจุบัน Oracle) มีระบบไฟล์ ZFS ที่ทนทาน นิยมในองค์กรใหญ่ ธนาคาร และโทรคมนาคม ส่วน NTFS, FAT32, exFAT เป็นระบบไฟล์ที่ใช้กับ Windows',
    tags: ['solaris', 'zfs']
  },

  // ---------------- Week 12: การติดตั้งบนเครื่องจำลอง ----------------
  {
    id: 'u7-027', unit: 7, week: 12, level: 'easy', type: 'fill',
    q: 'ในโหมด NAT ค่าเริ่มต้นของ VirtualBox เครื่องจำลองจะได้ IP {{1}} และใช้เกตเวย์ {{2}}',
    blanks: [['10.0.2.15'], ['10.0.2.2']],
    explain: 'VirtualBox ทำตัวเป็นเราเตอร์ขนาดเล็กในโหมด NAT แจก IP 10.0.2.15 ให้ Guest และใช้ 10.0.2.2 เป็นเกตเวย์ แล้วแปลงเป็น IP ของ Host เมื่อออกภายนอก',
    tags: ['virtualbox', 'nat']
  },
  {
    id: 'u7-028', unit: 7, week: 12, level: 'medium', type: 'match',
    q: 'จับคู่โหมดเครือข่ายของ VirtualBox กับลักษณะการทำงาน',
    left: ['NAT', 'Bridged Adapter', 'Host-only Adapter', 'Internal Network'],
    right: [
      'เชื่อมเฉพาะ Host กับเครื่องจำลอง วงเริ่มต้น 192.168.56.0/24',
      'เครื่องจำลองที่ใช้ชื่อเครือข่ายเดียวกันคุยกันเองเท่านั้น',
      'Guest ออกเน็ตได้ทันที แต่เครื่องอื่นเข้ามาหาโดยตรงไม่ได้',
      'Guest ใช้ IP เดียวกับ Host ทุกประการโดยไม่แปลงที่อยู่',
      'Guest อยู่วงเดียวกับเครือข่ายจริงเหมือนอีกเครื่องหนึ่ง'
    ],
    answer: [2, 4, 0, 1],
    explain: 'NAT ให้ Guest ออกเน็ตผ่าน IP ของ Host, Bridged ผูกกับการ์ดจริงจึงได้ IP วงเดียวกับเครือข่ายจริง, Host-only เชื่อม Host กับ Guest (192.168.56.0/24) และ Internal Network ให้เครื่องจำลองคุยกันเองเท่านั้น',
    tags: ['virtualbox', 'network-modes']
  },
  {
    id: 'u7-029', unit: 7, week: 12, level: 'medium', type: 'order',
    q: 'เรียงขั้นตอนการสร้างเครื่องจำลองใน VirtualBox ให้ถูกต้อง',
    items: [
      'กดปุ่ม New เพื่อเริ่มสร้างเครื่องจำลอง',
      'ตั้งชื่อเครื่อง เลือกไฟล์ ISO และตรวจ Type/Version',
      'กำหนด Base Memory และจำนวนโปรเซสเซอร์',
      'สร้างฮาร์ดดิสก์เสมือนชนิด VDI',
      'ตรวจสรุปค่าแล้วกด Finish',
      'กด Start เพื่อบูตจาก ISO และติดตั้งระบบ'
    ],
    explain: 'ลำดับใน VirtualBox คือ New, ตั้งชื่อและเลือก ISO, กำหนด RAM/CPU, สร้างดิสก์เสมือน, ตรวจสรุปแล้ว Finish จากนั้นจึง Start เพื่อบูตเข้าตัวติดตั้ง',
    tags: ['virtualbox', 'create-vm']
  },
  {
    id: 'u7-030', unit: 7, week: 12, level: 'easy', type: 'choice',
    q: 'เว็บไซต์ทางการของ Ubuntu แสดงค่า SHA256 ไว้คู่กับไฟล์ ISO ค่านี้มีไว้เพื่ออะไร',
    options: [
      'ใช้ตรวจว่าไฟล์ที่ได้ตรงกับต้นฉบับ',
      'ใช้เป็นรหัสผ่านในขั้นตอนติดตั้งระบบ',
      'ใช้เป็นหมายเลขสิทธิ์การใช้งาน (License)',
      'ใช้กำหนดขนาดดิสก์เสมือนให้พอดี'
    ],
    correct: 0,
    why: ['', 'Ubuntu ไม่ได้ใช้ค่า SHA256 เป็นรหัสผ่าน ผู้ใช้ตั้งรหัสผ่านเองตอนติดตั้ง', 'Ubuntu เป็นโอเพนซอร์ส ไม่ต้องใช้หมายเลขสิทธิ์การใช้งาน', 'ขนาดดิสก์เสมือนกำหนดตอนสร้างเครื่องจำลอง ไม่เกี่ยวกับ Checksum'],
    explain: 'ค่า Checksum เช่น SHA256 ใช้เทียบว่าไฟล์ ISO ที่ดาวน์โหลดมาตรงกับต้นฉบับ ไม่เสียหายหรือถูกดัดแปลงฝังมัลแวร์',
    tags: ['iso', 'checksum', 'security']
  },
  {
    id: 'u7-031', unit: 7, week: 12, level: 'medium', type: 'choice',
    q: 'หลังกด Take Snapshot แล้ว การเปลี่ยนแปลงข้อมูลในดิสก์ของเครื่องจำลองจะถูกเขียนลงที่ใด',
    options: [
      'ไฟล์ ISO ที่ใช้ติดตั้งระบบ',
      'ฮาร์ดดิสก์จริงของ Host โดยตรง',
      'หน่วยความจำ RAM ของ Guest เท่านั้น',
      'ไฟล์ดิสก์ส่วนต่าง (Differencing Image)'
    ],
    correct: 3,
    why: ['ISO เป็นสื่อติดตั้งแบบอ่านอย่างเดียว ไม่ได้รับการเขียนข้อมูลของ Guest', 'Guest เขียนลงไฟล์ดิสก์เสมือน ไม่ได้เขียนลงดิสก์ของ Host โดยตรง', 'ข้อมูลในดิสก์ถูกเก็บถาวรในไฟล์ ไม่ได้อยู่แค่ใน RAM', ''],
    explain: 'เมื่อสร้าง Snapshot โปรแกรมจะหยุดเขียนลงไฟล์ดิสก์เดิม แล้วเขียนการเปลี่ยนแปลงลงไฟล์ดิสก์ส่วนต่าง การกู้คืนจึงเร็วเพราะแค่ทิ้งการเปลี่ยนแปลงหลังจุดนั้น',
    tags: ['snapshot', 'differencing-image']
  },
  {
    id: 'u7-032', unit: 7, week: 12, level: 'hard', type: 'tf',
    q: 'ถ้าไฟล์ดิสก์ต้นฉบับ (VDI) ของเครื่องจำลองเสียหาย ยังกู้เครื่องจากสแนปช็อตได้ตามปกติ เพราะ Snapshot เก็บสำเนาดิสก์ทั้งลูกแยกไว้',
    answer: false,
    explain: 'Snapshot เก็บเฉพาะการเปลี่ยนแปลงในไฟล์ส่วนต่างและยังพึ่งไฟล์ดิสก์ต้นฉบับ ถ้าต้นฉบับเสียหาย Snapshot ก็ใช้ไม่ได้ จึงไม่ใช่การสำรองข้อมูล ควร Export เป็น OVA หรือสำรองไฟล์ไว้อีกที่',
    tags: ['snapshot', 'backup']
  },
  {
    id: 'u7-033', unit: 7, week: 12, level: 'hard', type: 'scenario',
    context: 'ระหว่างคาบเรียน เครื่องหลายเครื่องในห้องแล็บ (วงปกติ 192.168.20.0/24) เริ่มได้ IP 192.168.100.x และเข้าอินเทอร์เน็ตไม่ได้ ครูพบว่านักเรียนคนหนึ่งตั้งเครื่องจำลองเป็นโหมด Bridged Adapter และกำลังทดลองติดตั้ง DHCP Server แจก IP วง 192.168.100.0/24',
    steps: [
      { q: 'เกิดอะไรขึ้นกับเครือข่ายห้องแล็บ', options: ['เราเตอร์ของห้องแล็บถูกไวรัสเปลี่ยนวง IP', 'สาย UTP ของห้องยาวเกิน 100 เมตร', 'Host ของนักเรียนติด APIPA จึงแจก IP ผิด', 'เครื่องอื่นรับ IP จาก DHCP ในเครื่องจำลอง'], correct: 3 },
      { q: 'ควรแก้ไขเฉพาะหน้าอย่างไร', options: ['ปิด DHCP ในเครื่องจำลองหรือเปลี่ยนเป็น Host-only/Internal', 'สั่งทุกเครื่องให้ตั้ง IP วง 192.168.100.x ตาม', 'รีสตาร์ท Switch ของห้องแล็บทุกตัว', 'เปลี่ยนการ์ดแลนของเครื่อง Host ใหม่'], correct: 0 },
      { q: 'หลังแก้แล้ว เครื่องที่ได้ IP ผิดควรทำอย่างไร', options: ['ใช้ ipconfig /flushdns เพื่อล้างแคช', 'ใช้ ipconfig /release แล้ว ipconfig /renew', 'ตั้ง IP 192.168.100.x แบบ Static', 'ถอนการติดตั้ง VirtualBox ทุกเครื่อง'], correct: 1 }
    ],
    explain: 'โหมด Bridged ทำให้เครื่องจำลองอยู่วงเดียวกับเครือข่ายจริง DHCP ที่เปิดในนั้นจึงแจก IP แข่งกับเราเตอร์ การทดลอง DHCP ควรทำใน Host-only หรือ Internal Network แล้วให้เครื่องที่ได้ IP ผิดขอใหม่ด้วย ipconfig /release และ /renew',
    tags: ['bridged', 'dhcp', 'rogue-dhcp', 'troubleshooting']
  },
  {
    id: 'u7-034', unit: 7, week: 12, level: 'medium', type: 'multi',
    q: 'เครื่องจำลองสองเครื่องบน Host เดียวกันตั้งการ์ดเป็นโหมดเดียวกัน และแต่ละเครื่องมี IP ที่ใช้งานได้แล้ว (Internal Network ตั้ง IP เองในวงเดียวกัน) โหมดใดที่ทั้งสองเครื่องส่งข้อมูลหากันเองได้โดยตรง (เลือกได้หลายข้อ)',
    options: ['NAT', 'Bridged Adapter', 'Host-only Adapter', 'Internal Network', 'NAT Network'],
    correct: [1, 2, 3, 4],
    explain: 'ในโหมด NAT แต่ละเครื่องจำลองมีเราเตอร์ NAT ของตัวเองและได้ IP 10.0.2.15 เหมือนกัน จึงคุยกันเองไม่ได้ ส่วน NAT Network ให้เครื่องจำลองอยู่วงเดียวกันและยังออกเน็ตได้ Bridged อยู่วงเดียวกับเครือข่ายจริง Host-only อยู่วงเดียวกับ Host และ Internal Network ให้เครื่องที่ใช้ชื่อเครือข่ายเดียวกันคุยกันเอง (แต่ต้องตั้ง IP เองเพราะไม่มี DHCP)',
    tags: ['virtualbox', 'network-modes', 'nat']
  },
  {
    id: 'u7-035', unit: 7, week: 12, level: 'hard', type: 'scenario',
    context: 'นักเรียนตั้งเครื่องจำลอง Ubuntu Server เป็นโหมด NAT อย่างเดียว เครื่องจำลองอัปเดตระบบผ่านอินเทอร์เน็ตได้ แต่เมื่อสั่ง SSH จาก Host ไปยัง 10.0.2.15 กลับเชื่อมต่อไม่ได้ นักเรียนต้องการทั้งอัปเดตระบบได้และ SSH จาก Host ได้',
    steps: [
      { q: 'ถ้ายังใช้การ์ด NAT ใบเดียว ต้องตั้งค่าสิ่งใดเพิ่มจึงจะ SSH เข้าได้', options: ['ติดตั้ง Guest Additions ใน Guest', 'สร้าง Snapshot ก่อนเชื่อมต่อ', 'ตั้ง Port Forwarding ไปพอร์ต 22 ของ Guest', 'เปลี่ยนดิสก์เป็นแบบ Fixed size'], correct: 2 },
      { q: 'รูปแบบที่นิยมในการฝึกเพื่อให้ได้ทั้งสองอย่างคือข้อใด', options: ['การ์ดใบที่ 1 เป็น Internal ใบที่ 2 เป็น Internal', 'การ์ดใบที่ 1 เป็น NAT ใบที่ 2 เป็น Host-only', 'การ์ดใบเดียวเป็น Internal Network', 'ปิดการ์ดเครือข่ายทั้งหมดของเครื่องจำลอง'], correct: 1 },
      { q: 'หลังเพิ่มการ์ด Host-only แล้ว Host ควร SSH ไปยัง IP วงใดของ Guest', options: ['10.0.2.x', '169.254.x.x', '127.0.0.x', '192.168.56.x'], correct: 3 }
    ],
    explain: 'ในโหมด NAT ภายนอกรวมถึง Host เชื่อมเข้าหา Guest โดยตรงไม่ได้ ต้องตั้ง Port Forwarding (เช่น พอร์ต 2222 ของ Host ไปพอร์ต 22 ของ Guest) หรือเพิ่มการ์ดใบที่ 2 แบบ Host-only ซึ่งค่าเริ่มต้นอยู่วง 192.168.56.0/24 แล้วดู IP ด้วย ip addr ใน Guest',
    tags: ['virtualbox', 'nat', 'host-only', 'ssh', 'port-forwarding']
  },
  {
    id: 'u7-036', unit: 7, week: 12, level: 'easy', type: 'tf',
    q: 'เมื่อเมาส์และแป้นพิมพ์ถูกจับไว้ในหน้าต่างเครื่องจำลอง VirtualBox บน Windows ให้กดปุ่ม Ctrl ด้านขวา (Host Key) เพื่อกลับมาใช้ Host',
    answer: true,
    explain: 'Host Key ค่าเริ่มต้นของ VirtualBox บน Windows คือ Ctrl ด้านขวา กดเพื่อปล่อยเมาส์และแป้นพิมพ์กลับมาที่ Host',
    tags: ['virtualbox', 'host-key']
  },
  {
    id: 'u7-037', unit: 7, week: 12, level: 'easy', type: 'command', os: 'linux',
    q: 'หลังติดตั้ง Ubuntu Server เสร็จ ควรอัปเดตรายการแพ็กเกจก่อนเป็นอันดับแรก จงพิมพ์คำสั่งนั้น (ใช้สิทธิ์ผู้ดูแลด้วย sudo)',
    accept: ['^sudo apt(-get)? update$'],
    example: 'sudo apt update',
    explain: 'sudo apt update ดึงรายการแพ็กเกจล่าสุด จากนั้นจึงใช้ sudo apt upgrade เพื่อติดตั้งการอัปเดต ต้องใช้ sudo เพราะเป็นงานของผู้ดูแลระบบ',
    tags: ['ubuntu', 'apt', 'update']
  },
  {
    id: 'u7-038', unit: 7, week: 12, level: 'medium', type: 'command', os: 'linux',
    q: 'เครื่องจำลอง Ubuntu Server ใช้โหมด NAT ค่าเริ่มต้นของ VirtualBox ต้องการทดสอบว่าติดต่อเกตเวย์ของวง NAT ได้หรือไม่ โดย ping ไปที่เกตเวย์นั้น 3 ครั้งแล้วหยุดเอง จงพิมพ์คำสั่ง',
    accept: ['^ping -c ?3 10\\.0\\.2\\.2$', '^ping 10\\.0\\.2\\.2 -c ?3$'],
    example: 'ping -c 3 10.0.2.2',
    explain: 'เกตเวย์ของวง NAT ค่าเริ่มต้นใน VirtualBox คือ 10.0.2.2 และ ping บน Linux ส่งต่อเนื่องจนกด Ctrl + C จึงต้องใช้ -c 3 เพื่อกำหนดจำนวนครั้ง (Windows ใช้ -n)',
    tags: ['linux', 'ping']
  },
  {
    id: 'u7-039', unit: 7, week: 12, level: 'medium', type: 'subnet',
    q: 'เครื่องจำลองในโหมด Host-only ได้ IP 192.168.56.101/24 จงหาค่าของวงเครือข่ายนี้',
    ip: '192.168.56.101', prefix: 24,
    ask: ['network', 'broadcast', 'hosts'],
    explain: '/24 คือ Subnet Mask 255.255.255.0 วงนี้คือ 192.168.56.0 Broadcast 192.168.56.255 มีโฮสต์ใช้งานได้ 2^8 - 2 = 254 เครื่อง โดย Host ใช้ 192.168.56.1',
    tags: ['host-only', 'subnet']
  },
  {
    id: 'u7-040', unit: 7, week: 12, level: 'easy', type: 'diagram', diagram: 'nos-services',
    q: 'จากภาพบริการของ NOS ถ้านักเรียนพิมพ์ \\\\SERVER\\Share เพื่อเปิดโฟลเดอร์ส่งงานบนเซิร์ฟเวอร์ ถือเป็นการใช้บริการกลุ่มใด',
    answerType: 'choice',
    options: ['Security Services', 'Internet/Intranet Services', 'File & Print Sharing', 'Management Services'],
    correct: 2,
    why: ['Security ดูแลการยืนยันตัวตนและสิทธิ์ แต่การเปิดโฟลเดอร์แชร์เป็นบริการไฟล์', 'Internet/Intranet คือบริการเว็บ อีเมล DNS และ DHCP', '', 'Management คือการจัดการผู้ใช้ กลุ่ม และนโยบายจากส่วนกลาง'],
    explain: 'การเปิดโฟลเดอร์ที่แชร์ผ่านเครือข่ายด้วย UNC path เป็นบริการแบ่งปันไฟล์และเครื่องพิมพ์ (File & Print Sharing) ซึ่งเครือข่ายวินโดวส์ใช้โปรโตคอล SMB',
    tags: ['file-sharing', 'unc', 'nos-services']
  },
  {
    id: 'u7-041', unit: 7, week: 12, level: 'medium', type: 'choice',
    q: 'ต้องการสำรองเครื่องจำลองทั้งเครื่องไว้ในแฟลชไดรฟ์ เพื่อนำไปเปิดที่คอมพิวเตอร์เครื่องอื่นได้ ควรทำอย่างไร',
    options: [
      'Export Appliance เป็นไฟล์ OVA',
      'คัดลอกเฉพาะไฟล์ ISO ที่ใช้ติดตั้ง',
      'กด Take Snapshot แล้วปิดโปรแกรม',
      'เปลี่ยนโหมดเครือข่ายเป็น Bridged'
    ],
    correct: 0,
    why: ['', 'ISO มีแค่ตัวติดตั้ง ไม่มีระบบและข้อมูลที่ตั้งค่าไว้แล้ว', 'Snapshot อยู่ในเครื่องเดิมและพึ่งไฟล์ดิสก์ต้นฉบับ จึงนำไปเปิดที่อื่นไม่ได้', 'โหมดเครือข่ายไม่เกี่ยวกับการสำรองเครื่องจำลอง'],
    explain: 'Export Appliance รวมการตั้งค่าและดิสก์เสมือนเป็นไฟล์ OVA ไฟล์เดียว นำไป Import ที่เครื่องอื่นได้ ส่วน Snapshot อยู่ในเครื่องเดิมและพึ่งไฟล์ดิสก์ต้นฉบับ จึงไม่ใช่การสำรองข้อมูล',
    tags: ['export', 'ova', 'backup']
  },

  // ---------------- Phase 4 additions: label, command output, performance scenario ----------------
  {
    id: 'u7-042', unit: 7, week: 11, level: 'easy', type: 'label', diagram: 'hypervisor-types',
    q: 'ระบุตัวอย่างซอฟต์แวร์และงานที่เหมาะกับ Hypervisor แต่ละประเภทตามหมายเลข',
    hide: ['VMware ESXi', 'Microsoft Hyper-V', 'ศูนย์ข้อมูล', 'Oracle VirtualBox', 'VMware Workstation', 'การเรียน ทดสอบ'],
    extra: ['Guest Additions', 'BIOS/UEFI'],
    explain: 'Type 1 (Bare-metal) ติดตั้งบนฮาร์ดแวร์โดยตรง เช่น VMware ESXi, Microsoft Hyper-V และ Proxmox VE เหมาะกับศูนย์ข้อมูลและเซิร์ฟเวอร์จริง ส่วน Type 2 (Hosted) ติดตั้งเป็นโปรแกรมบน Host OS เช่น Oracle VirtualBox และ VMware Workstation เหมาะกับการเรียน ทดสอบ และพัฒนาโปรแกรม',
    tags: ['hypervisor', 'type1', 'type2']
  },
  {
    id: 'u7-043', unit: 7, week: 12, level: 'medium', type: 'label', diagram: 'vm-netmodes',
    q: 'เติมผลการเชื่อมต่อที่หายไปของโหมดเครือข่าย VirtualBox แต่ละแบบตามหมายเลข',
    hide: ['Host → VM ต้อง Port Forward', 'LAN → VM ต้อง Port Forward', 'VM ↔ VM ไม่ได้', 'LAN ↔ VM ได้', 'Host ↔ VM ไม่ได้'],
    extra: ['LAN → VM ได้ทันที'],
    explain: 'NAT ออกเน็ตได้แต่การเชื่อมต่อเข้ามาจาก Host หรือ LAN ต้องตั้ง Port Forwarding และแต่ละ VM มี NAT ของตัวเองจึงคุยกันไม่ได้ Bridged ทำให้ VM เป็นอีกเครื่องใน LAN จึงเข้าถึงจาก LAN ได้ ส่วน Internal Network แยกจาก Host และ LAN โดยสิ้นเชิง Host จึงเข้าถึง VM ไม่ได้',
    tags: ['virtualbox', 'network-modes']
  },
  {
    id: 'u7-044', unit: 7, week: 12, level: 'medium', type: 'multi',
    q: 'เครื่องจำลอง Ubuntu Server มีการ์ดเครือข่าย 2 ใบ (ใบที่ 1 เป็น NAT ใบที่ 2 เป็น Host-only ค่าเริ่มต้น) สั่ง ip a ได้ผลดังด้านบน ข้อใดสรุปได้ถูกต้อง (เลือกได้หลายข้อ)',
    pre: '$ ip a   (แสดงบางส่วน)\n1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN\n    inet 127.0.0.1/8 scope host lo\n2: enp0s3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n    link/ether 08:00:27:3a:5b:7c brd ff:ff:ff:ff:ff:ff\n    inet 10.0.2.15/24 brd 10.0.2.255 scope global dynamic\n3: enp0s8: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n    link/ether 08:00:27:9d:41:e2 brd ff:ff:ff:ff:ff:ff\n    inet 192.168.56.101/24 brd 192.168.56.255 scope global dynamic',
    options: ['enp0s3 ได้ IP วง NAT ค่าเริ่มต้นของ VirtualBox', 'enp0s8 เป็นการ์ด Host-only ที่ Host ติดต่อได้โดยตรง', 'Host ควร SSH ไปที่ 192.168.56.101 โดยไม่ต้องตั้ง Port Forwarding', 'เครื่องอื่นในห้องแล็บใช้ 127.0.0.1 เพื่อติดต่อเครื่องจำลองนี้', 'การ์ดทั้งสองยังไม่ได้ IP จึงต้องใช้ APIPA'],
    correct: [0, 1, 2],
    explain: 'enp0s3 ได้ 10.0.2.15/24 จาก DHCP ของ NAT (ออกเน็ตได้ แต่รับการเชื่อมต่อเข้าไม่ได้) enp0s8 ได้ 192.168.56.101/24 จาก DHCP ของวง Host-only ซึ่ง Host อยู่ที่ 192.168.56.1 จึง SSH ไปที่ 192.168.56.101 ได้ทันที ส่วน 127.0.0.1 (lo) คือตัวเครื่องเอง ใช้ติดต่อจากเครื่องอื่นไม่ได้ และการ์ดทั้งสองได้ IP แล้ว (scope global dynamic)',
    tags: ['ip-addr', 'nat', 'host-only', 'ssh']
  },
  {
    id: 'u7-045', unit: 7, week: 12, level: 'medium', type: 'choice',
    q: 'เครื่องจำลอง SRV01 ตั้งการ์ดใบเดียวเป็น Internal Network ชื่อ intnet และกำหนด IP เอง จากผลคำสั่งด้านบน ข้อใดอธิบายได้ถูกต้องที่สุด',
    pre: '$ ip a   (แสดงบางส่วน)\n2: enp0s3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n    inet 192.168.100.10/24 brd 192.168.100.255 scope global enp0s3\n$ ping -c 4 8.8.8.8\nping: connect: Network is unreachable\n$ ping -c 4 192.168.100.11\n64 bytes from 192.168.100.11: icmp_seq=1 ttl=64 time=0.61 ms\n...\n--- 192.168.100.11 ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss, time 3005ms',
    options: ['สาย LAN ของเครื่อง Host หลุด เครื่องจำลองจึงออกเน็ตไม่ได้', 'IP 192.168.100.10 ชนกับเครื่องจำลองอีกเครื่อง', 'ต้องติดตั้ง Guest Additions ก่อนจึงจะ ping ออกภายนอกได้', 'คุยกับเครื่องจำลองใน intnet ได้ แต่ Internal Network ไม่มีทางออกภายนอก'],
    correct: 3,
    why: ['Internal Network ไม่ได้ใช้การ์ดแลนจริงของ Host อยู่แล้ว ปัญหาจึงไม่ใช่สายของ Host', 'ping 192.168.100.11 ได้ 0% packet loss แสดงว่าในวงสื่อสารได้ปกติ', 'Guest Additions เกี่ยวกับหน้าจอและคลิปบอร์ด ไม่เกี่ยวกับการออกเครือข่าย', ''],
    explain: 'Internal Network เชื่อมเฉพาะเครื่องจำลองที่ใช้ชื่อเครือข่ายเดียวกัน ไม่มีเราเตอร์หรือเกตเวย์ออกภายนอก เมื่อไม่มีเส้นทางไป 8.8.8.8 Linux จึงแจ้ง Network is unreachable ทันที แต่ ping เครื่องในวง 192.168.100.0/24 ได้ปกติ ถ้าต้องการออกเน็ตให้เพิ่มการ์ดใบที่ 2 แบบ NAT',
    tags: ['internal-network', 'ping', 'troubleshooting']
  },
  {
    id: 'u7-046', unit: 7, week: 12, level: 'hard', type: 'scenario',
    context: 'ครูให้นักเรียนติดตั้ง Ubuntu Server ในเครื่องจำลอง VirtualBox บนเครื่อง Host ที่ต่อสาย LAN ในห้องแล็บ (วง 192.168.20.0/24) เพื่อทำเว็บเซิร์ฟเวอร์ ต้องอัปเดตระบบผ่านอินเทอร์เน็ตได้ และเพื่อนเครื่องอื่นในห้องต้องเปิดเว็บบนเครื่องจำลองได้ สัปดาห์ถัดไปจะใช้เครื่องจำลองเดียวกันทดลองติดตั้ง DHCP Server',
    steps: [
      { q: 'ตอนทำเว็บเซิร์ฟเวอร์ ควรตั้งการ์ดเครือข่ายของเครื่องจำลองเป็นโหมดใด', options: ['NAT', 'Internal Network', 'Bridged Adapter', 'Host-only Adapter'], correct: 2 },
      { q: 'หลังตั้งค่าแล้ว ip a ในเครื่องจำลองแสดง inet 192.168.20.140/24 เพื่อนเครื่องอื่นควรเปิดเว็บที่ใด', options: ['http://10.0.2.15', 'http://192.168.20.140', 'http://127.0.0.1', 'http://192.168.56.1'], correct: 1 },
      { q: 'ก่อนเริ่มทดลอง DHCP Server ในสัปดาห์ถัดไป ควรเปลี่ยนโหมดเครือข่ายเป็นแบบใด', options: ['Internal Network เพื่อไม่ให้แจก IP ให้เครื่องในห้อง', 'คง Bridged ไว้ เพราะ DHCP ต้องอยู่วงจริง', 'NAT เพราะเพื่อนจะได้รับ IP ด้วย', 'ปิดไฟร์วอลล์ของ Host แทน'], correct: 0 },
      { q: 'ก่อนแก้ไฟล์ตั้งค่าที่เสี่ยงทำให้ระบบเสีย ควรทำสิ่งใดเพื่อย้อนกลับได้เร็ว', options: ['ถอดไฟล์ ISO ออก', 'เพิ่ม RAM เป็นสองเท่า', 'เปลี่ยนเป็น NAT ก่อนทุกครั้ง', 'Take Snapshot'], correct: 3 }
    ],
    explain: 'Bridged ทำให้เครื่องจำลองได้ IP จากวงจริง (192.168.20.140) เพื่อนจึงเปิดเว็บได้และยังออกเน็ตผ่านเราเตอร์จริง ส่วน 10.0.2.15 เป็น IP ภายใน NAT การทดลอง DHCP Server ต้องย้ายไป Internal Network (หรือ Host-only ที่ปิด DHCP ของ VirtualBox) เพื่อไม่ให้แจก IP แข่งกับเราเตอร์ของห้อง และควร Take Snapshot ก่อนแก้ค่าที่เสี่ยง',
    tags: ['bridged', 'internal-network', 'snapshot', 'performance']
  }
];

/* NetLab 2.6: these questions were rewritten (new content), so they get new ids */
const RENAMED_26 = {"u7-002":"u7-047","u7-009":"u7-048","u7-013":"u7-049","u7-034":"u7-050","u7-038":"u7-051"};
module.exports.forEach(q => { if (RENAMED_26[q.id]) q.id = RENAMED_26[q.id]; });

/* NetLab 2.6: versions of rewritten questions as they were in 2.5. Kept under their old ids so earlier exam
   attempts still show the question the student actually answered. retired = never drawn for new practice/exams. */
module.exports.push(...[
 {
  "id": "u7-002",
  "unit": 7,
  "week": 10,
  "level": "easy",
  "type": "tf",
  "q": "ฮาร์ดแวร์คอมพิวเตอร์เครื่องเดียวกันอาจทำหน้าที่เป็นเครื่องลูกข่ายหรือเซิร์ฟเวอร์ก็ได้ ขึ้นกับระบบปฏิบัติการและบริการที่ติดตั้ง",
  "answer": true,
  "explain": "บทบาทของเครื่องถูกกำหนดโดยระบบปฏิบัติการและบริการที่ติดตั้ง แม้เซิร์ฟเวอร์จริงในองค์กรมักใช้ฮาร์ดแวร์ที่ทนทานกว่า เช่น พาวเวอร์ซัพพลายสำรองและ RAM แบบ ECC",
  "tags": [
   "nos",
   "server",
   "client"
  ],
  "retired": true,
  "replacedBy": "u7-047"
 },
 {
  "id": "u7-009",
  "unit": 7,
  "week": 10,
  "level": "medium",
  "type": "choice",
  "q": "วิทยาลัยเปิดระบบดูผลการเรียนบางส่วนให้ผู้ปกครองที่มีบัญชีเข้าใช้จากภายนอกวิทยาลัยได้ ลักษณะนี้เรียกว่าอะไร",
  "options": [
   "Intranet",
   "Peer-to-Peer",
   "Load Balancing",
   "Extranet"
  ],
  "correct": 3,
  "why": [
   "Intranet เปิดเฉพาะบุคลากรภายใน",
   "Peer-to-Peer คือสถาปัตยกรรมที่ทุกเครื่องเท่ากัน",
   "Load Balancing คือการแบ่งงานไปหลายเซิร์ฟเวอร์",
   ""
  ],
  "explain": "Extranet คือการเปิดบริการภายในบางส่วนให้บุคคลภายนอกที่ได้รับอนุญาต เช่น คู่ค้าหรือผู้ปกครอง ส่วน Intranet เปิดเฉพาะคนในองค์กร",
  "tags": [
   "intranet",
   "extranet"
  ],
  "retired": true,
  "replacedBy": "u7-048"
 },
 {
  "id": "u7-013",
  "unit": 7,
  "week": 11,
  "level": "easy",
  "type": "choice",
  "q": "เคอร์เนล Linux ถูกเผยแพร่ครั้งแรกโดยใครและในปีใด",
  "options": [
   "Ken Thompson ปี 1969",
   "Bill Gates ปี 1985",
   "Richard Stallman ปี 1983",
   "Linus Torvalds ปี 1991"
  ],
  "correct": 3,
  "explain": "Linus Torvalds นักศึกษาชาวฟินแลนด์เผยแพร่เคอร์เนล Linux ในปี 1991 เป็นซอฟต์แวร์โอเพนซอร์ส ส่วน Ken Thompson เป็นผู้ร่วมสร้าง UNIX ราวปี 1969",
  "tags": [
   "linux",
   "history"
  ],
  "retired": true,
  "replacedBy": "u7-049"
 },
 {
  "id": "u7-034",
  "unit": 7,
  "week": 12,
  "level": "medium",
  "type": "multi",
  "q": "โหมดเครือข่ายใดของ VirtualBox ที่เครื่องจำลองออกอินเทอร์เน็ตได้โดยไม่ต้องตั้งค่าเพิ่มเติม (เลือกได้หลายข้อ)",
  "options": [
   "NAT",
   "Bridged Adapter",
   "Host-only Adapter",
   "Internal Network",
   "NAT Network"
  ],
  "correct": [
   0,
   1,
   4
  ],
  "explain": "NAT และ NAT Network ออกเน็ตผ่าน IP ของ Host ส่วน Bridged ออกผ่านเราเตอร์จริงของเครือข่าย ขณะที่ Host-only และ Internal Network ไม่ออกภายนอก",
  "tags": [
   "virtualbox",
   "network-modes",
   "nat"
  ],
  "retired": true,
  "replacedBy": "u7-050"
 },
 {
  "id": "u7-038",
  "unit": 7,
  "week": 12,
  "level": "medium",
  "type": "command",
  "os": "linux",
  "q": "ในเครื่องจำลอง Ubuntu Server ต้องการทดสอบการออกภายนอกโดย ping ไปที่ 8.8.8.8 จำนวน 4 ครั้งแล้วหยุดเอง จงพิมพ์คำสั่ง",
  "accept": [
   "^ping -c ?4 8\\.8\\.8\\.8$",
   "^ping 8\\.8\\.8\\.8 -c ?4$"
  ],
  "example": "ping -c 4 8.8.8.8",
  "explain": "ping บน Linux ส่งต่อเนื่องจนกด Ctrl + C ต้องใช้ตัวเลือก -c 4 เพื่อกำหนดจำนวนครั้ง (ต่างจาก Windows ที่ใช้ -n)",
  "tags": [
   "linux",
   "ping"
  ],
  "retired": true,
  "replacedBy": "u7-051"
 }
]);

// NetLab 2.8 supplementary (extra/w10 x1, x2): ports, sockets, TCP/UDP/SCTP
module.exports.push(...[
  { id: 'u7-052', unit: 7, week: 10, level: 'medium', type: 'choice',
    q: 'จากผลคำสั่ง ss -tan บน Ubuntu Server ด้านบน ข้อใดสรุปได้ถูกต้อง',
    pre: '$ ss -tan\nState     Recv-Q Send-Q  Local Address:Port   Peer Address:Port\nLISTEN    0      4096        0.0.0.0:22          0.0.0.0:*\nLISTEN    0      511         0.0.0.0:80          0.0.0.0:*\nESTAB     0      0      192.168.56.10:22    192.168.56.1:52814\nESTAB     0      0      192.168.56.10:80   192.168.56.21:50432\nTIME-WAIT 0      0      192.168.56.10:80   192.168.56.22:49718',
    options: ['เซิร์ฟเวอร์เป็นฝ่ายเริ่มเชื่อมต่อไปยังพอร์ต 52814 ของ 192.168.56.1', 'LISTEN 0.0.0.0:80 แปลว่ารับได้เฉพาะเครื่องที่มี IP 0.0.0.0', 'เครื่อง 192.168.56.1 ใช้ SSH อยู่ โดยฝั่งลูกข่ายใช้พอร์ตชั่วคราว 52814', 'บรรทัด TIME-WAIT แสดงว่าเว็บเซิร์ฟเวอร์ล่มและต้องรีสตาร์ต'],
    correct: 2,
    why: ['พอร์ต 22 ของเซิร์ฟเวอร์อยู่ในสถานะ LISTEN แสดงว่าลูกข่ายเป็นฝ่ายเริ่ม พอร์ต 52814 คือพอร์ตชั่วคราวของลูกข่าย', '0.0.0.0 ในคอลัมน์ Local หมายถึงรอรับทุกการ์ดเครือข่ายของเครื่อง', '', 'TIME-WAIT เป็นสถานะปกติหลังปิดการเชื่อมต่อ ฝั่งที่ปิดก่อนรอ 2 x MSL'],
    explain: 'บรรทัด ESTAB 192.168.56.10:22 กับ 192.168.56.1:52814 คือการเชื่อมต่อ SSH ที่ยังเปิดอยู่ ฝั่งเซิร์ฟเวอร์ใช้พอร์ต 22 ที่เปิดรอไว้ ฝั่งลูกข่ายใช้พอร์ตชั่วคราวที่ระบบสุ่มให้',
    tags: ['ss', 'socket', 'ports', 'tcp-states'] },
  { id: 'u7-053', unit: 7, week: 10, level: 'hard', type: 'scenario',
    context: 'วิทยาลัยจะติดตั้งเซิร์ฟเวอร์ใหม่ 3 บริการ ได้แก่ ระบบส่งไฟล์งานของนักเรียน ระบบประกาศเสียงตามสายผ่านเครือข่ายไปลำโพง IP ทุกอาคารแบบสด และ DNS ภายในสำหรับชื่อ intranet.college.internal ครูให้นักเรียนเลือกโปรโตคอลชั้น Transport ให้แต่ละบริการ',
    steps: [
      { q: 'ระบบส่งไฟล์งาน ควรใช้โปรโตคอลใดและเพราะอะไร', options: ['UDP เพราะส่งเร็วและไฟล์ขาดบางส่วนก็ยังเปิดได้', 'TCP เพราะต้องได้ไฟล์ครบทุกไบต์และเรียงลำดับถูกต้อง', 'UDP เพราะไม่ต้องเปิดการเชื่อมต่อจึงปลอดภัยกว่า', 'TCP เพราะส่วนหัวเล็กที่สุดในชั้น Transport'], correct: 1 },
      { q: 'ระบบประกาศเสียงสด ถ้าบางแพ็กเก็ตหาย ควรเลือกแบบใด', options: ['TCP เพื่อรอส่งซ้ำจนครบก่อนเล่นเสียง', 'TCP เพราะเสียงต้องเรียงลำดับเหมือนไฟล์', 'UDP เพราะเสียงที่มาช้ากว่าจังหวะเล่นก็ไร้ประโยชน์', 'UDP เพราะรับประกันว่าแพ็กเก็ตจะไม่หาย'], correct: 2 },
      { q: 'DNS ภายในส่วนใหญ่ตอบคำถามผ่านอะไร', options: ['UDP พอร์ต 53 และใช้ TCP 53 เมื่อคำตอบใหญ่หรือโอนโซน', 'TCP พอร์ต 443 เพราะต้องเข้ารหัสทุกครั้ง', 'UDP พอร์ต 67 เพราะใช้ร่วมกับ DHCP', 'SCTP เพราะต้องมีหลายเส้นทางสำรอง'], correct: 0 }
    ],
    explain: 'งานที่ข้อมูลต้องครบถูกต้องอย่างไฟล์ใช้ TCP งานสดที่ต้องตรงเวลาอย่างเสียงใช้ UDP (เช่น RTP บน UDP) ส่วน DNS เป็นคำถามสั้นจึงใช้ UDP 53 และสลับไปใช้ TCP 53 เมื่อคำตอบใหญ่เกินหรือโอนข้อมูลทั้งโซน',
    tags: ['tcp', 'udp', 'dns', 'voip', 'scenario'] },
  { id: 'u7-054', unit: 7, week: 10, level: 'medium', type: 'order',
    q: 'เรียงสถานะของฝั่ง Client ที่เปิดการเชื่อมต่อ TCP ส่งข้อมูล แล้วเป็นฝ่ายปิดก่อน ตั้งแต่ต้นจนจบ',
    items: ['CLOSED (ก่อนเริ่มเชื่อมต่อ)', 'SYN-SENT', 'ESTABLISHED', 'FIN-WAIT-1', 'FIN-WAIT-2', 'TIME-WAIT', 'CLOSED (หลังรอ 2 x MSL)'],
    explain: 'Client ส่ง SYN เข้าสู่ SYN-SENT ได้ SYN-ACK แล้วเป็น ESTABLISHED เมื่อปิดก่อนจะส่ง FIN เป็น FIN-WAIT-1 ได้ ACK เป็น FIN-WAIT-2 ได้ FIN ของอีกฝั่งแล้วตอบ ACK เข้าสู่ TIME-WAIT และรอ 2 x MSL ก่อนกลับเป็น CLOSED',
    tags: ['tcp', 'states', 'handshake'] }
]);

/* 3.2: knowledge questions kept from the retired lab / room tasks after a duplicate check.
   src = the original task key (lab:wN-i or room:rN-i); see docs/BANK-FROM-LABS-3.2.md */
module.exports.push(...[
  { id: 'u7-055', unit: 7, week: 11, level: 'easy', type: 'choice', src: 'lab:w11-1',
    q: 'ซอฟต์แวร์จำลองเครื่อง (Hypervisor) ใดเป็นโอเพนซอร์สและใช้ได้ฟรี',
    options: ['VMware Workstation Pro', 'Microsoft Hyper-V', 'VirtualBox', 'Parallels Desktop'],
    correct: 2,
    explain: 'VirtualBox ของ Oracle เป็นโอเพนซอร์สและใช้ฟรี จึงนิยมใช้ในห้องเรียน VMware Workstation Pro ใช้ฟรีสำหรับใช้ส่วนตัวแล้วแต่ไม่ใช่โอเพนซอร์ส Hyper-V มากับ Windows บางรุ่น และ Parallels Desktop เป็นโปรแกรมเสียเงินบน Mac',
    tags: ['virtualization', 'virtualbox'] }
]);
