'use strict';
module.exports = {
  id: 'w11', week: 11, unit: 7,
  title: 'ระบบปฏิบัติการเครือข่าย: ซอฟต์แวร์ NOS และเครื่องจำลอง',
  minutes: 50,
  objectives: [
    'บอกที่มาและลักษณะเด่นของ NetWare, UNIX, Linux, Solaris และ Windows Server ได้ถูกต้อง',
    'เลือกระบบปฏิบัติการเครือข่ายให้เหมาะกับสถานการณ์ขององค์กรได้',
    'อธิบายความหมายของเครื่องจำลอง (Virtual Machine) และความสัมพันธ์ระหว่าง Host กับ Guest ได้',
    'จำแนก Hypervisor แบบ Type 1 และ Type 2 พร้อมยกตัวอย่างซอฟต์แวร์ได้',
    'เปรียบเทียบซอฟต์แวร์จำลองเครื่อง VMware และ VirtualBox ได้',
    'ตรวจสอบความพร้อมของฮาร์ดแวร์และเปิดใช้ VT-x หรือ AMD-V ก่อนใช้เครื่องจำลองได้'
  ],
  competency: 'แสดงความรู้เกี่ยวกับซอฟต์แวร์ระบบปฏิบัติการเครือข่ายและซอฟต์แวร์จำลองเครื่องคอมพิวเตอร์',
  keywords: ['NetWare', 'UNIX', 'Linux', 'Solaris', 'Windows Server', 'Virtual Machine', 'Hypervisor', 'VirtualBox', 'VMware', 'VT-x'],
  quiz: [
    {
      type: 'choice', level: 'easy',
      q: 'ระบบปฏิบัติการ UNIX ถูกพัฒนาขึ้นครั้งแรกที่ใด',
      options: ['ศูนย์วิจัยของ Novell', 'Bell Labs ของ AT&T', 'Microsoft Research', 'Sun Microsystems'],
      correct: 1,
      explain: 'UNIX พัฒนาขึ้นที่ Bell Labs ของ AT&T ราวปี 1969 โดย Ken Thompson และ Dennis Ritchie และกลายเป็นต้นแบบของระบบตระกูล UNIX จำนวนมาก',
      why: ['Novell เป็นเจ้าของ NetWare', '', 'Microsoft พัฒนา Windows Server', 'Sun นำแนวคิด UNIX มาพัฒนาเป็น Solaris ภายหลัง']
    },
    {
      type: 'choice', level: 'easy',
      q: 'ในการใช้โปรแกรม VirtualBox บนโน้ตบุ๊ก Windows 11 แล้วติดตั้ง Ubuntu Server ในเครื่องจำลอง ข้อใดถูกต้อง',
      options: [
        'Windows 11 เป็น Guest และ Ubuntu Server เป็น Host',
        'ทั้ง Windows 11 และ Ubuntu Server เป็น Host',
        'VirtualBox เป็น Guest และ Windows 11 เป็น Host',
        'Windows 11 เป็น Host และ Ubuntu Server เป็น Guest'
      ],
      correct: 3,
      explain: 'เครื่องจริงและระบบปฏิบัติการที่ติดตั้งโปรแกรมจำลองคือ Host ส่วนระบบปฏิบัติการที่รันอยู่ภายในเครื่องจำลองคือ Guest',
      why: ['สลับกัน เครื่องจริงต้องเป็น Host', 'Ubuntu รันอยู่ในเครื่องจำลองจึงเป็น Guest', 'VirtualBox คือ Hypervisor ไม่ใช่ Guest', '']
    },
    {
      type: 'choice', level: 'medium',
      q: 'ข้อใดจับคู่ประเภท Hypervisor กับตัวอย่างซอฟต์แวร์ได้ถูกต้องทั้งหมด',
      options: [
        'Type 1: VMware ESXi, Hyper-V / Type 2: VirtualBox',
        'Type 1: VirtualBox, ESXi / Type 2: VMware Workstation',
        'Type 1: VMware Workstation / Type 2: VMware ESXi',
        'Type 1: VirtualBox / Type 2: Microsoft Hyper-V'
      ],
      correct: 0,
      explain: 'Type 1 (Bare-metal) ทำงานบนฮาร์ดแวร์โดยตรง เช่น VMware ESXi, Microsoft Hyper-V, Xen ส่วน Type 2 (Hosted) ติดตั้งเป็นโปรแกรมบน OS เช่น VirtualBox และ VMware Workstation',
      why: ['', 'VirtualBox เป็นแบบ Type 2 เพราะต้องติดตั้งบน OS', 'สลับกัน Workstation เป็น Type 2 และ ESXi เป็น Type 1', 'สลับกัน VirtualBox เป็น Type 2 และ Hyper-V เป็น Type 1']
    },
    {
      type: 'choice', level: 'medium',
      q: 'นักเรียนเปิด VirtualBox สร้างเครื่องจำลองแล้วขึ้นข้อความว่า VT-x is disabled in the BIOS ควรแก้ไขอย่างไร',
      options: [
        'เพิ่ม RAM ให้เครื่องจำลองเป็นสองเท่า',
        'เปลี่ยนโหมดเครือข่ายเป็น Bridged Adapter',
        'เข้า BIOS/UEFI แล้วเปิด Intel VT-x ให้เป็น Enabled',
        'ดาวน์โหลดไฟล์ ISO ใหม่แล้วติดตั้งอีกครั้ง'
      ],
      correct: 2,
      explain: 'VT-x (Intel) และ AMD-V (AMD) เป็นความสามารถช่วยจำลองเครื่องใน CPU ที่ต้องเปิดใน BIOS/UEFI ก่อน เครื่องจำลองแบบ 64 บิตจึงทำงานได้',
      why: ['RAM ไม่เกี่ยวกับการเปิด VT-x', 'โหมดเครือข่ายไม่เกี่ยวกับความสามารถของ CPU', '', 'ไฟล์ ISO ไม่ได้เป็นสาเหตุของข้อความนี้']
    },
    {
      type: 'choice', level: 'medium',
      q: 'บริษัทสตาร์ตอัปมีงบจำกัด ต้องการเว็บเซิร์ฟเวอร์ที่เสถียร ไม่ต้องจ่ายค่าลิขสิทธิ์ระบบปฏิบัติการ และหาคู่มือภาษาไทยได้มาก ควรเลือก NOS ใด',
      options: ['Linux เช่น Ubuntu Server', 'Novell NetWare 6.5', 'Windows Server Datacenter', 'Solaris บนเครื่อง SPARC'],
      correct: 0,
      explain: 'Linux เป็นโอเพนซอร์ส ดาวน์โหลดและใช้งานได้โดยไม่ต้องซื้อลิขสิทธิ์ (มีแบบจ่ายค่าบริการสนับสนุนเป็นทางเลือก) นิยมใช้ทำเว็บเซิร์ฟเวอร์และมีชุมชนผู้ใช้ใหญ่',
      why: ['', 'NetWare เลิกพัฒนาแล้ว และไม่เหมาะกับระบบใหม่', 'Windows Server เป็นซอฟต์แวร์เชิงพาณิชย์ที่ต้องมีสิทธิ์การใช้งาน', 'Solaris เน้นองค์กรขนาดใหญ่และฮาร์ดแวร์เฉพาะ ไม่ตรงกับงบจำกัด']
    },
    {
      type: 'choice', level: 'hard',
      q: 'ศูนย์ข้อมูลของมหาวิทยาลัยต้องการรันเซิร์ฟเวอร์เสมือน 40 เครื่องบนเซิร์ฟเวอร์จริง 3 เครื่อง โดยต้องการประสิทธิภาพสูงสุดและไม่มี OS อื่นคั่นกลาง ควรเลือกแนวทางใด',
      options: [
        'ติดตั้ง Windows 11 แล้วใช้ VirtualBox บนทุกเครื่อง',
        'ติดตั้ง Hypervisor Type 1 เช่น ESXi ลงบนเครื่องโดยตรง',
        'ใช้ VMware Workstation บนเครื่องลูกข่ายของอาจารย์',
        'ติดตั้ง Linux Desktop แล้วใช้โปรแกรม Hypervisor Type 2'
      ],
      correct: 1,
      explain: 'Hypervisor Type 1 ติดตั้งบนฮาร์ดแวร์โดยตรง ไม่มี Host OS คั่น จึงเสียทรัพยากรน้อย เสถียร และเหมาะกับงานเซิร์ฟเวอร์ในศูนย์ข้อมูล',
      why: ['VirtualBox เป็น Type 2 มี Host OS คั่นกลาง', '', 'เครื่องลูกข่ายไม่เหมาะเป็นฐานของเซิร์ฟเวอร์ 40 เครื่อง', 'Type 2 ยังต้องพึ่ง Host OS จึงไม่ตรงตามความต้องการ']
    },
    {
      type: 'multi', level: 'easy',
      q: 'ข้อใดเป็นระบบในตระกูล UNIX หรือคล้าย UNIX (UNIX-like) (เลือกได้หลายข้อ)',
      options: ['Solaris', 'Novell NetWare', 'Linux', 'Windows Server'],
      correct: [0, 2],
      explain: 'Solaris เป็น UNIX เชิงพาณิชย์ของ Sun (ปัจจุบันเป็นของ Oracle) และ Linux เป็นระบบคล้าย UNIX ส่วน NetWare และ Windows Server ไม่ได้อยู่ในตระกูล UNIX'
    },
    {
      type: 'multi', level: 'hard',
      q: 'ข้อใดเป็นประโยชน์ของการใช้เครื่องจำลองในห้องเรียนเครือข่าย (เลือกได้หลายข้อ)',
      options: [
        'ทดลองติดตั้งเซิร์ฟเวอร์ได้หลายระบบบนคอมพิวเตอร์เครื่องเดียว',
        'ทำให้เครื่องจำลองเร็วกว่าเครื่องจริงที่เป็น Host เสมอ',
        'ตั้งค่าผิดพลาดก็ไม่กระทบระบบปฏิบัติการของเครื่องจริง',
        'ไม่ต้องใช้ RAM หรือพื้นที่ดิสก์ของเครื่องจริงเลย'
      ],
      correct: [0, 2],
      explain: 'เครื่องจำลองช่วยให้ทดลองได้หลายระบบและแยกจาก Host แต่ทรัพยากรทั้ง CPU, RAM และดิสก์ยังแบ่งมาจากเครื่องจริง จึงไม่มีทางเร็วกว่า Host'
    },
    {
      type: 'tf', level: 'easy',
      q: 'Solaris เดิมพัฒนาโดยบริษัท Sun Microsystems และปัจจุบันอยู่ภายใต้บริษัท Oracle ถูกหรือผิด',
      answer: true,
      explain: 'ถูก Oracle ซื้อกิจการ Sun Microsystems ในปี 2010 Solaris จึงกลายเป็น Oracle Solaris เช่นเดียวกับ VirtualBox ที่เดิมอยู่กับ Sun'
    },
    {
      type: 'text', level: 'medium',
      q: 'เทคโนโลยีช่วยจำลองเครื่องใน CPU ของ Intel เรียกว่า VT-x ส่วนของ AMD เรียกว่าอะไร',
      answers: ['AMD-V', 'AMDV', 'AMD V', 'SVM', 'AMD SVM'],
      explain: 'AMD เรียกเทคโนโลยีนี้ว่า AMD-V (ใน BIOS บางรุ่นใช้ชื่อ SVM Mode) ทำหน้าที่เหมือน VT-x ของ Intel'
    }
  ],
  sections: [
    {
      id: 's1',
      title: '1. NOS ยุคบุกเบิก: Novell NetWare และ UNIX',
      blocks: [
        { type: 'p', text: 'ในช่วงทศวรรษ 1980 ถึงกลาง 1990 ระบบที่ครองตลาดเครือข่ายสำนักงานคือ NetWare ของบริษัท Novell ออกรุ่นแรกในปี 1983 เด่นเรื่องบริการไฟล์และเครื่องพิมพ์ที่เร็วและเสถียร ใช้ชุดโปรโตคอลของตนเองคือ IPX/SPX และตั้งแต่ NetWare 4 มีบริการไดเรกทอรี NDS (Novell Directory Services) ซึ่งเป็นแนวคิดต้นแบบของการจัดการผู้ใช้จากส่วนกลาง' },
        { type: 'p', text: 'เมื่ออินเทอร์เน็ตแพร่หลาย TCP/IP กลายเป็นมาตรฐาน และ Windows Server เข้ามาแย่งตลาด NetWare จึงค่อย ๆ หายไป Novell หันไปพัฒนาระบบบนพื้นฐาน Linux แทน ปัจจุบัน NetWare ไม่มีการพัฒนาต่อแล้ว เราเรียนเพื่อเข้าใจประวัติและแนวคิด ไม่ใช่เพื่อนำไปติดตั้งใช้งานจริง' },
        { type: 'p', text: 'UNIX ถือกำเนิดที่ Bell Labs ของบริษัท AT&T ราวปี 1969 โดย Ken Thompson และ Dennis Ritchie ต่อมาเขียนใหม่ด้วยภาษา C ทำให้ย้ายไปใช้กับเครื่องรุ่นอื่นได้ง่าย UNIX เป็นระบบหลายผู้ใช้ (Multi-user) และหลายงาน (Multitasking) ตั้งแต่แรก มีระบบสิทธิ์ไฟล์ rwx และแนวคิดใช้โปรแกรมเล็ก ๆ ต่อกันผ่านคำสั่ง ซึ่งยังใช้อยู่ใน Linux และ macOS ทุกวันนี้' },
        { type: 'p', text: 'แนวคิดสิทธิ์ไฟล์ของ UNIX แบ่งผู้ใช้เป็นสามกลุ่ม คือเจ้าของไฟล์ (Owner) กลุ่ม (Group) และคนอื่น (Others) แต่ละกลุ่มมีสิทธิ์อ่าน (r = 4) เขียน (w = 2) และรัน (x = 1) รวมเป็นตัวเลขฐานแปด เช่น 750 คือ rwxr-x--- หลักการนี้ยังใช้ใน Linux ทุกวันนี้ และนักเรียนจะได้เห็นจริงเมื่อใช้เซิร์ฟเวอร์ Linux ในส่วนแล็บ' },
        { type: 'widget', name: 'perm-calc', caption: 'ลองติ๊กสิทธิ์ rwx ของ Owner, Group และ Others แล้วดูตัวเลขฐานแปดและรูปแบบที่คำสั่ง ls -l แสดง' },
        { type: 'note', kind: 'tip', text: 'UNIX มีหลายสายพันธุ์ที่บริษัทต่าง ๆ นำไปพัฒนาต่อ เช่น Solaris (Sun), AIX (IBM), HP-UX (HP) และสาย BSD เช่น FreeBSD ระบบเหล่านี้จึงมีคำสั่งและแนวคิดคล้ายกันมาก' },
        { type: 'check', q: { type: 'choice', level: 'easy', q: 'NetWare เป็นระบบปฏิบัติการเครือข่ายของบริษัทใด', options: ['Microsoft', 'Novell', 'Oracle', 'IBM'], correct: 1, explain: 'NetWare เป็นของ Novell ใช้โปรโตคอล IPX/SPX และเคยครองตลาดเครือข่ายสำนักงานในยุค 1980 ถึง 1990' } }
      ]
    },
    {
      id: 's2',
      title: '2. NOS ที่ใช้ในปัจจุบัน: Linux, Solaris และ Windows Server',
      blocks: [
        { type: 'p', text: 'Linux เริ่มจากเคอร์เนล (Kernel) ที่ Linus Torvalds นักศึกษาชาวฟินแลนด์เผยแพร่ในปี 1991 เป็นซอฟต์แวร์โอเพนซอร์ส (Open Source) ใครก็ดาวน์โหลด ศึกษา และแก้ไขได้ เมื่อรวมเคอร์เนลกับโปรแกรมอื่นจะได้ดิสทริบิวชัน (Distribution) เช่น Ubuntu Server, Debian, Red Hat Enterprise Linux (RHEL), Rocky Linux ปัจจุบันเว็บเซิร์ฟเวอร์และระบบคลาวด์ส่วนใหญ่ของโลกทำงานบน Linux' },
        { type: 'p', text: 'Solaris เป็น UNIX เชิงพาณิชย์ที่ Sun Microsystems พัฒนาต่อจาก SunOS นิยมในองค์กรใหญ่ ธนาคาร และโทรคมนาคม เพราะเสถียรสูงและมีระบบไฟล์ ZFS ที่ทนทาน ทำงานบน CPU สถาปัตยกรรม SPARC และ x86 ในปี 2010 Oracle ซื้อกิจการ Sun จึงเปลี่ยนชื่อเป็น Oracle Solaris' },
        { type: 'p', text: 'Windows Server ของ Microsoft สืบทอดมาจากสาย Windows NT และตั้งแต่ Windows 2000 Server เป็นต้นมามีบริการ Active Directory สำหรับจัดการผู้ใช้และเครื่องในโดเมน รุ่นที่พบในองค์กรปัจจุบันเช่น 2019, 2022 และ 2025 จุดเด่นคือหน้าจอคุ้นเคย ทำงานร่วมกับเครื่องลูกข่าย Windows ได้ดี มีบริการ DNS, DHCP, File Server, IIS และ Hyper-V ครบ เป็นซอฟต์แวร์เชิงพาณิชย์ที่ต้องมีสิทธิ์การใช้งาน (License) แต่มีรุ่นทดลองใช้ (Evaluation) ให้ฝึกได้' },
        { type: 'table', head: ['NOS', 'ผู้พัฒนา/ที่มา', 'จุดเด่น', 'สถานะ'], rows: [
          ['NetWare', 'Novell (1983)', 'File & Print เร็ว, IPX/SPX, NDS', 'เลิกพัฒนาแล้ว'],
          ['UNIX', 'Bell Labs ของ AT&T (1969)', 'หลายผู้ใช้ หลายงาน ต้นแบบระบบอื่น', 'มีหลายสายพันธุ์'],
          ['Linux', 'Linus Torvalds (1991) และชุมชน', 'โอเพนซอร์ส เสถียร นิยมทำเว็บและคลาวด์', 'ใช้มากที่สุดในเซิร์ฟเวอร์'],
          ['Solaris', 'Sun Microsystems, ปัจจุบัน Oracle', 'UNIX เชิงพาณิชย์ ZFS องค์กรใหญ่', 'ใช้เฉพาะกลุ่ม'],
          ['Windows Server', 'Microsoft (สาย Windows NT)', 'Active Directory ใช้ง่าย เข้ากับ Windows', 'นิยมในสำนักงาน']
        ] },
        { type: 'example', title: 'ตัวอย่างการเลือก NOS ในองค์กรไทย', text: 'โรงพยาบาลจังหวัดแห่งหนึ่งใช้ Windows Server ทำ Active Directory ให้เจ้าหน้าที่หลายร้อยคนเข้าสู่ระบบด้วยบัญชีเดียว และแชร์ไฟล์ระหว่างแผนก ขณะเดียวกันเว็บไซต์โรงพยาบาลและระบบนัดหมายออนไลน์ทำงานบนเซิร์ฟเวอร์ Linux องค์กรจริงจึงมักใช้ NOS หลายตัวร่วมกันตามความเหมาะสมของงาน' },
        { type: 'check', q: { type: 'choice', level: 'easy', q: 'NOS ใดเป็นซอฟต์แวร์โอเพนซอร์สที่นิยมใช้ทำเว็บเซิร์ฟเวอร์มากที่สุด', options: ['Windows Server', 'Novell NetWare', 'Oracle Solaris', 'Linux'], correct: 3, explain: 'Linux เป็นโอเพนซอร์ส มีหลายดิสทริบิวชัน และเป็นระบบหลักของเว็บเซิร์ฟเวอร์และคลาวด์' } }
      ]
    },
    {
      id: 's3',
      title: '3. เครื่องจำลอง (Virtual Machine): Host และ Guest',
      blocks: [
        { type: 'p', text: 'การจำลองเครื่อง (Virtualization) คือการใช้ซอฟต์แวร์สร้างคอมพิวเตอร์เสมือนขึ้นภายในคอมพิวเตอร์จริง คอมพิวเตอร์เสมือนนี้เรียกว่าเครื่องจำลอง (Virtual Machine: VM) มี CPU, RAM, ฮาร์ดดิสก์, การ์ดแลน และไดรฟ์ DVD เสมือนเป็นของตนเอง ติดตั้งระบบปฏิบัติการได้เหมือนเครื่องจริง แต่ทรัพยากรทั้งหมดแบ่งมาจากเครื่องจริง' },
        { type: 'term', term: 'Host', text: 'เครื่องคอมพิวเตอร์จริงและระบบปฏิบัติการที่ติดตั้งโปรแกรมจำลองเครื่อง เป็นเจ้าของทรัพยากรจริงที่แบ่งให้เครื่องจำลอง' },
        { type: 'term', term: 'Guest', text: 'ระบบปฏิบัติการที่ติดตั้งและทำงานอยู่ภายในเครื่องจำลอง เช่น Ubuntu Server ที่รันอยู่ใน VirtualBox บน Windows 11' },
        { type: 'term', term: 'Hypervisor', text: 'ซอฟต์แวร์ที่สร้างและควบคุมเครื่องจำลอง คอยแบ่ง CPU, RAM และอุปกรณ์ของเครื่องจริงให้แต่ละ Guest และแยกแต่ละเครื่องออกจากกัน บางครั้งเรียกว่า Virtual Machine Monitor (VMM)' },
        { type: 'diagram', name: 'vm-layers', caption: 'ชั้นของระบบเครื่องจำลอง: ฮาร์ดแวร์จริง, Host OS, Hypervisor (VirtualBox/VMware) และ Guest OS หลายเครื่อง' },
        { type: 'p', text: 'ทำไมงานเครือข่ายจึงต้องใช้เครื่องจำลอง เหตุผลหลักคือประหยัด เครื่องเดียวทดลองเซิร์ฟเวอร์ได้หลายตัว ปลอดภัย เพราะตั้งค่าผิดหรือเจอไวรัสใน Guest ก็ไม่กระทบ Host และย้อนกลับได้ด้วย Snapshot ในโลกจริง องค์กรใช้ Virtualization รวมเซิร์ฟเวอร์หลายตัวไว้บนเครื่องแรง ๆ ไม่กี่เครื่อง ลดค่าไฟ พื้นที่ และค่าฮาร์ดแวร์ ระบบคลาวด์ก็ทำงานบนหลักการนี้เช่นกัน' },
        { type: 'check', q: { type: 'tf', level: 'easy', q: 'RAM ที่กำหนดให้เครื่องจำลองเป็น RAM เพิ่มเติมที่โปรแกรมสร้างขึ้นใหม่ ไม่ได้แบ่งจากเครื่องจริง ถูกหรือผิด', answer: false, explain: 'ผิด ทรัพยากรของเครื่องจำลองทั้ง CPU, RAM และดิสก์ แบ่งมาจากเครื่อง Host ทั้งหมด' } }
      ]
    },
    {
      id: 's4',
      title: '4. Hypervisor แบบ Type 1 และ Type 2',
      blocks: [
        { type: 'p', text: 'Hypervisor แบบที่ 1 (Type 1 หรือ Bare-metal) ติดตั้งลงบนฮาร์ดแวร์ของเซิร์ฟเวอร์โดยตรงแทนระบบปฏิบัติการ ไม่มี Host OS คั่นกลาง จึงสิ้นเปลืองทรัพยากรน้อยและเสถียร เหมาะกับศูนย์ข้อมูล ตัวอย่างเช่น VMware ESXi, Microsoft Hyper-V, Xen และ Proxmox VE ที่ใช้ KVM ของ Linux ผู้ดูแลมักจัดการผ่านหน้าเว็บหรือโปรแกรมจากเครื่องอื่น' },
        { type: 'p', text: 'Hypervisor แบบที่ 2 (Type 2 หรือ Hosted) ติดตั้งเป็นโปรแกรมธรรมดาบน Host OS เช่น Windows, macOS หรือ Linux ใช้งานง่าย เปิดปิดได้เหมือนโปรแกรมทั่วไป เหมาะกับการเรียน การทดสอบ และนักพัฒนา แต่ต้องผ่าน Host OS อีกชั้นจึงเสียประสิทธิภาพมากกว่า ตัวอย่างเช่น Oracle VirtualBox, VMware Workstation (Windows/Linux), VMware Fusion และ Parallels Desktop (macOS)' },
        { type: 'table', head: ['หัวข้อ', 'Type 1 (Bare-metal)', 'Type 2 (Hosted)'], rows: [
          ['ติดตั้งบน', 'ฮาร์ดแวร์โดยตรง', 'ระบบปฏิบัติการ Host'],
          ['ประสิทธิภาพ', 'สูง สูญเสียน้อย', 'ต่ำกว่า เพราะมี Host OS คั่น'],
          ['งานที่เหมาะ', 'ศูนย์ข้อมูล เซิร์ฟเวอร์จริง คลาวด์', 'การเรียน ทดสอบ พัฒนาโปรแกรม'],
          ['ตัวอย่าง', 'VMware ESXi, Hyper-V, Xen, Proxmox VE', 'VirtualBox, VMware Workstation, Parallels']
        ] },
        { type: 'note', kind: 'tip', text: 'Hyper-V เป็นกรณีที่ชวนสับสน แม้จะเปิดใช้จากในหน้าต่าง Windows แต่เมื่อเปิด Hyper-V ตัว Hypervisor จะทำงานอยู่ใต้ Windows โดยตรง และ Windows กลายเป็นเหมือนเครื่องพิเศษเครื่องหนึ่ง จึงจัดเป็น Type 1' },
        { type: 'check', q: { type: 'choice', level: 'medium', q: 'ซอฟต์แวร์ใดเป็น Hypervisor แบบ Type 2', options: ['VMware ESXi', 'Xen', 'Microsoft Hyper-V', 'Oracle VirtualBox'], correct: 3, explain: 'VirtualBox ติดตั้งเป็นโปรแกรมบน Host OS จึงเป็น Type 2 ส่วนตัวเลือกอื่นทำงานบนฮาร์ดแวร์โดยตรง' } }
      ]
    },
    {
      id: 's5',
      title: '5. ซอฟต์แวร์จำลองเครื่อง VMware และ VirtualBox',
      blocks: [
        { type: 'p', text: 'VirtualBox เดิมพัฒนาโดยบริษัท Innotek ต่อมาเป็นของ Sun Microsystems และอยู่กับ Oracle ตั้งแต่ปี 2010 ตัวโปรแกรมหลักเป็นโอเพนซอร์ส ดาวน์โหลดได้ฟรี ทำงานบน Windows, Linux และ macOS (ทั้ง Mac ชิป Intel และรุ่นใหม่ ๆ ของ VirtualBox ที่รองรับ Mac ชิป Apple Silicon) มีส่วนเสริม Guest Additions ที่ติดตั้งใน Guest เพื่อให้ปรับขนาดจอ แชร์โฟลเดอร์ และคัดลอกข้อความระหว่าง Host กับ Guest ได้' },
        { type: 'p', text: 'VMware มีผลิตภัณฑ์หลายระดับ ฝั่งเดสก์ท็อปคือ VMware Workstation Pro (Windows/Linux) และ VMware Fusion (macOS) ซึ่งเป็น Type 2 ส่วนฝั่งศูนย์ข้อมูลคือ VMware ESXi และ vSphere ซึ่งเป็น Type 1 ใน Guest ของ VMware จะติดตั้ง VMware Tools เพื่อเพิ่มความสามารถคล้าย Guest Additions ทั้ง VMware และ VirtualBox ไม่ใช่โปรแกรมเดียวกัน แต่ทำงานบนหลักการเดียวกัน' },
        { type: 'table', head: ['หัวข้อ', 'Oracle VirtualBox', 'VMware Workstation / Fusion'], rows: [
          ['ประเภท', 'Type 2', 'Type 2'],
          ['สัญญาอนุญาต', 'ตัวหลักเป็นโอเพนซอร์ส', 'ซอฟต์แวร์ปิด (Proprietary) ไม่ใช่โอเพนซอร์ส'],
          ['ส่วนเสริมใน Guest', 'Guest Additions', 'VMware Tools'],
          ['ไฟล์ดิสก์เสมือนหลัก', 'VDI (เปิด VMDK, VHD ได้)', 'VMDK'],
          ['เหมาะกับ', 'การเรียนการสอน ทดลองทั่วไป', 'งานทดสอบระดับมืออาชีพ']
        ] },
        { type: 'note', kind: 'warn', text: 'เงื่อนไขการใช้งานฟรีและราคาของซอฟต์แวร์จำลองเครื่องเปลี่ยนแปลงบ่อย เช่น ตั้งแต่ปลายปี 2024 Broadcom (เจ้าของ VMware ปัจจุบัน) ให้ใช้ VMware Workstation Pro และ Fusion Pro ได้ฟรีทั้งส่วนตัวและในองค์กร ซึ่งต่างจากเดิมที่ต้องซื้อสิทธิ์ ก่อนนำไปใช้ในงานจริงหรือในองค์กร ควรตรวจสอบเงื่อนไขล่าสุดจากเว็บไซต์ผู้ผลิตเสมอ และดาวน์โหลดจากแหล่งทางการเท่านั้น' },
        { type: 'example', title: 'ตัวอย่างจากห้องแล็บของวิทยาลัย', text: 'แผนกคอมพิวเตอร์ติดตั้ง VirtualBox ในเครื่องนักเรียนทุกเครื่อง แต่ละคนสร้างเครื่องจำลอง Ubuntu Server เพื่อฝึกตั้งค่าเซิร์ฟเวอร์ ถ้าใครพิมพ์คำสั่งผิดจนระบบเสีย ก็ลบเครื่องจำลองแล้วสร้างใหม่ได้ภายในไม่กี่นาที โดยไม่ต้องเรียกช่างมาติดตั้ง Windows ของเครื่องจริงใหม่ ในส่วนแล็บของสัปดาห์นี้ นักเรียนจะได้ลองใช้เซิร์ฟเวอร์ Linux จริงที่รันอยู่ในเครื่องจำลองผ่านเบราว์เซอร์ด้วย' },
      ]
    },
    {
      id: 's6',
      title: '6. ความต้องการฮาร์ดแวร์และการเปิด VT-x / AMD-V',
      blocks: [
        { type: 'p', text: 'การจำลองเครื่องให้เร็วต้องพึ่งความสามารถพิเศษใน CPU เรียกว่า Hardware-assisted Virtualization ของ Intel ชื่อ VT-x (Intel Virtualization Technology) ของ AMD ชื่อ AMD-V (ใน BIOS บางรุ่นใช้ชื่อ SVM Mode) ความสามารถนี้ทำให้ Guest รันคำสั่งบน CPU ได้เกือบโดยตรง ถ้าปิดอยู่ Hypervisor จะติดตั้ง Guest แบบ 64 บิตไม่ได้ และ VirtualBox รุ่นใหม่จะไม่ยอมเปิดเครื่องจำลองเลย' },
        { type: 'steps', items: [
          'ตรวจสอบก่อนว่าเปิดอยู่หรือไม่: ใน Windows เปิด Task Manager แท็บ Performance เลือก CPU ดูบรรทัด Virtualization ว่า Enabled หรือ Disabled',
          'ถ้าปิดอยู่ ให้รีสตาร์ตเครื่องแล้วกดปุ่มเข้า BIOS/UEFI (มักเป็น F2, Del, F10 หรือ F1 ขึ้นกับยี่ห้อ ส่วน F12 มักเป็นเมนูเลือกอุปกรณ์บูต)',
          'หาเมนู Advanced หรือ CPU Configuration แล้วเปิด Intel Virtualization Technology หรือ SVM Mode ให้เป็น Enabled',
          'บันทึกค่าแล้วออก (Save and Exit) จากนั้นตรวจใน Task Manager อีกครั้ง'
        ] },
        { type: 'p', text: 'นอกจาก CPU แล้ว ต้องวางแผนทรัพยากรด้วย เพราะ Host และ Guest ใช้ของชุดเดียวกัน RAM ควรมีพอทั้งสองฝั่ง เช่น เครื่อง 16 GB ให้ Guest ราว 2 ถึง 4 GB ได้สบาย ดิสก์ควรมีที่ว่างหลายสิบ GB และถ้าเป็น SSD จะเร็วกว่ามาก จำนวน CPU เสมือนไม่ควรเกินจำนวนคอร์จริงของเครื่อง' },
        { type: 'table', head: ['ทรัพยากร', 'ข้อแนะนำสำหรับห้องแล็บ'], rows: [
          ['CPU', '64 บิต รองรับและเปิด VT-x หรือ AMD-V แล้ว'],
          ['RAM ของ Host', 'อย่างน้อย 8 GB ถ้ามี 16 GB จะรันหลาย Guest ได้สะดวก'],
          ['ดิสก์', 'ที่ว่างอย่างน้อย 30 ถึง 50 GB ต่อการทดลอง SSD จะเร็วกว่า HDD มาก'],
          ['ระบบปฏิบัติการ Host', 'รุ่นที่โปรแกรมจำลองเครื่องรองรับ และอัปเดตแล้ว']
        ] },
        { type: 'note', kind: 'warn', text: 'ใน Windows ถ้าเปิดคุณสมบัติที่ใช้ Hyper-V อยู่ เช่น Hyper-V, Windows Subsystem for Linux 2 หรือ Memory Integrity อาจทำให้ VirtualBox ต้องทำงานผ่าน Hyper-V และช้าลงมาก (บางรุ่นแสดงไอคอนรูปเต่าที่มุมจอ) ถ้าพบอาการนี้ให้ปรึกษาครูก่อนปิดคุณสมบัติใด ๆ' },
        { type: 'check', q: { type: 'choice', level: 'medium', q: 'วิธีใดใช้ตรวจสอบได้เร็วที่สุดว่าเครื่อง Windows เปิดใช้ VT-x แล้วหรือยัง', options: ['พิมพ์คำสั่ง ping 127.0.0.1', 'เปิด Device Manager ดูการ์ดแลน', 'Task Manager แท็บ Performance หน้า CPU', 'เปิด Control Panel หน้า Sound'], correct: 2, explain: 'Task Manager แท็บ Performance หน้า CPU มีบรรทัด Virtualization บอกสถานะ Enabled หรือ Disabled' } }
      ]
    }
  ],
  summary: [
    'NetWare ของ Novell เคยครองตลาดเครือข่ายสำนักงาน ใช้ IPX/SPX และ NDS แต่ปัจจุบันเลิกพัฒนาแล้ว',
    'UNIX กำเนิดที่ Bell Labs ของ AT&T ราวปี 1969 เป็นระบบหลายผู้ใช้หลายงาน และเป็นต้นแบบของ Solaris, Linux และระบบอื่น',
    'Linux เป็นโอเพนซอร์สเริ่มโดย Linus Torvalds ปี 1991 นิยมที่สุดในเว็บเซิร์ฟเวอร์และคลาวด์ ส่วน Solaris เป็น UNIX ของ Sun ซึ่งปัจจุบันเป็นของ Oracle',
    'Windows Server ของ Microsoft มี Active Directory และบริการครบ นิยมในสำนักงานที่ใช้เครื่องลูกข่าย Windows',
    'เครื่องจำลองแบ่ง CPU, RAM และดิสก์จากเครื่องจริง เครื่องจริงเรียกว่า Host ส่วนระบบที่รันในเครื่องจำลองเรียกว่า Guest',
    'Hypervisor Type 1 ติดตั้งบนฮาร์ดแวร์โดยตรง เช่น ESXi, Hyper-V ส่วน Type 2 ติดตั้งบน Host OS เช่น VirtualBox, VMware Workstation',
    'ก่อนใช้เครื่องจำลองต้องเปิด VT-x (Intel) หรือ AMD-V (AMD) ใน BIOS/UEFI และวางแผน RAM ดิสก์ให้พอทั้ง Host และ Guest'
  ]
};
