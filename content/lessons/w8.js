'use strict';
module.exports = {
  id: 'w8', week: 8, unit: 6,
  title: 'เครือข่ายในวินโดวส์: ชื่อเครื่อง ชื่อเครือข่าย และ IP Address',
  minutes: 50,
  objectives: [
    'ตรวจสอบชื่อเครื่องด้วยคำสั่ง hostname และจากหน้า About ของ Windows ได้',
    'เปลี่ยนชื่อเครื่องใน Windows 10/11 ตามกฎการตั้งชื่อได้ถูกต้อง',
    'อธิบายความแตกต่างระหว่าง Workgroup และ Domain ได้',
    'อธิบายความหมายของ IP Address, Subnet mask, Default gateway และ DNS server ได้',
    'ตั้งค่า IPv4 แบบ Static และแบบ DHCP ใน Windows 10/11 ได้ถูกต้อง',
    'ใช้คำสั่ง ipconfig และ ipconfig /all ตรวจสอบผลการตั้งค่าได้'
  ],
  competency: 'กำหนดชื่อเครื่อง ชื่อเครือข่าย และค่า IP Address ของเครื่องคอมพิวเตอร์ในระบบปฏิบัติการวินโดวส์ได้ถูกต้อง',
  keywords: ['hostname', 'Computer name', 'Workgroup', 'Domain', 'Static IP', 'DHCP', 'Subnet mask', 'Default gateway', 'DNS', 'ipconfig'],
  quiz: [
    { type: 'choice', level: 'easy',
      q: 'ต้องการทราบชื่อเครื่องคอมพิวเตอร์อย่างรวดเร็วจาก Command Prompt ควรพิมพ์คำสั่งใด',
      options: ['ipconfig /renew', 'hostname', 'net share', 'tracert'], correct: 1,
      explain: 'คำสั่ง hostname แสดงชื่อเครื่อง (Computer name) ของเครื่องที่ใช้อยู่ทันที',
      why: ['ipconfig /renew ใช้ขอ IP ใหม่จาก DHCP Server', '', 'net share แสดงโฟลเดอร์ที่แชร์', 'tracert ใช้ดูเส้นทางที่แพ็กเก็ตเดินทาง'] },
    { type: 'choice', level: 'easy',
      q: 'ชื่อเครื่องใดตั้งเป็นชื่อคอมพิวเตอร์ใน Windows ได้ถูกต้องตามกฎ',
      options: ['LAB PC 12', 'LAB_PC#12', 'LAB-PC12', 'LAB.PC.12'], correct: 2,
      explain: 'ชื่อเครื่องควรใช้ตัวอักษรภาษาอังกฤษ ตัวเลข และขีดกลาง (-) เท่านั้น ห้ามมีช่องว่างและอักขระพิเศษ และไม่ควรยาวเกิน 15 ตัวอักษร',
      why: ['มีช่องว่าง ซึ่ง Windows ไม่อนุญาต', 'มีเครื่องหมาย # ซึ่งเป็นอักขระต้องห้าม', '', 'จุด (.) ใช้คั่นชื่อโดเมน จึงใช้ในชื่อเครื่องไม่ได้'] },
    { type: 'choice', level: 'medium',
      q: 'เครื่องในห้องแล็บใช้วง 192.168.20.0/24 และ Router อยู่ที่ 192.168.20.1 ข้อใดเป็นค่าที่ใช้ตั้ง Static IP ให้เครื่องเลขที่ 30 ได้ถูกต้อง',
      options: ['IP 192.168.20.30 / Mask 255.255.0.0 / Gateway 192.168.20.30', 'IP 192.168.20.30 / Mask 255.255.255.0 / Gateway 192.168.20.255', 'IP 192.168.30.20 / Mask 255.255.255.0 / Gateway 192.168.20.1', 'IP 192.168.20.30 / Mask 255.255.255.0 / Gateway 192.168.20.1'], correct: 3,
      explain: '/24 คือ 255.255.255.0 เครื่องต้องอยู่วง 192.168.20.x และ Gateway ต้องเป็น IP ของ Router คือ 192.168.20.1',
      why: ['Mask ผิดและ Gateway เป็น IP ของตัวเอง', 'Gateway 192.168.20.255 เป็นที่อยู่ Broadcast ใช้กับเครื่องใดไม่ได้', 'IP อยู่คนละวง (192.168.30.x) จึงคุยกับ Gateway ไม่ได้', ''] },
    { type: 'choice', level: 'medium',
      q: 'เครื่องหนึ่ง ping 8.8.8.8 ได้ แต่เปิดเว็บด้วยชื่อ เช่น www.moe.go.th ไม่ได้ ค่าใดน่าจะตั้งผิดมากที่สุด',
      options: ['DNS server', 'Subnet mask', 'Default gateway', 'ชื่อ Workgroup'], correct: 0,
      explain: 'ping ไป IP ภายนอกได้แสดงว่า IP, Mask และ Gateway ใช้งานได้ ปัญหาอยู่ที่การแปลงชื่อเป็น IP ซึ่งเป็นหน้าที่ของ DNS server',
      why: ['', 'Mask ผิดทำให้แยกในวงกับนอกวงผิด ไม่ได้ทำให้เกิดอาการเฉพาะกับชื่อโดเมน', 'ถ้า Gateway ผิดจะ ping 8.8.8.8 ไม่ได้', 'ชื่อ Workgroup ไม่เกี่ยวกับการออกอินเทอร์เน็ต'] },
    { type: 'multi', level: 'medium',
      q: 'อุปกรณ์ใดในสำนักงานที่ควรตั้ง IP แบบ Static หรือจองไว้ไม่ให้เปลี่ยน (เลือกได้หลายข้อ)',
      options: ['เครื่องพิมพ์เครือข่ายที่ทุกคนสั่งพิมพ์', 'เครื่องเซิร์ฟเวอร์เก็บไฟล์ของบริษัท', 'มือถือของลูกค้าที่มาติดต่อ', 'Router ที่เป็น Default gateway'], correct: [0, 1, 3],
      explain: 'อุปกรณ์ที่เครื่องอื่นต้องเรียกหาตามที่อยู่เดิมตลอด เช่น เครื่องพิมพ์ เซิร์ฟเวอร์ และ Gateway ต้องมี IP คงที่ ส่วนมือถือลูกค้าเปลี่ยนไปเรื่อย ๆ ให้ DHCP แจกเหมาะกว่า' },
    { type: 'tf', level: 'easy',
      q: 'เมื่อเลือก Obtain an IP address automatically เครื่องจะขอ IP Address, Subnet mask, Gateway และ DNS จาก DHCP Server ข้อความนี้ถูกหรือผิด',
      answer: true,
      explain: 'ถูก DHCP Server (ในบ้านและร้านค้ามักเป็น Router) จะแจกค่าเหล่านี้ให้ครบในครั้งเดียว ผู้ใช้ไม่ต้องพิมพ์เอง' },
    { type: 'choice', level: 'hard',
      q: 'ผลของ ipconfig แสดง IPv4 Address เป็น 169.254.37.12 และไม่มี Default Gateway ข้อใดสรุปได้ถูกต้องที่สุด',
      options: ['เครื่องได้ IP จาก DHCP Server ของ ISP เรียบร้อยแล้ว', 'เครื่องตั้ง Static IP ไว้ในวง Class B ซึ่งผิดวง', 'เครื่องขอ IP จาก DHCP ไม่สำเร็จ จึงตั้ง APIPA เอง', 'เครื่องเชื่อมต่ออินเทอร์เน็ตผ่าน IPv6 อยู่แทน'], correct: 2,
      explain: '169.254.x.x คือ APIPA ที่ Windows ตั้งให้ตัวเองเมื่อติดต่อ DHCP Server ไม่ได้ ควรตรวจสาย Router หรือบริการ DHCP แล้วสั่ง ipconfig /renew',
      why: ['DHCP ไม่แจก 169.254.x.x และจะมี Gateway ให้ด้วย', 'แม้ 169.254 จะอยู่ช่วง Class B แต่เป็นช่วง APIPA ที่ระบบตั้งเอง ไม่ใช่ค่าที่ผู้ใช้ตั้ง', '', 'ผลลัพธ์นี้เป็นเรื่องของ IPv4 และบอกว่าเครื่องไม่ได้ IP ที่ใช้งานได้'] },
    { type: 'multi', level: 'hard',
      q: 'ข้อใดเป็นความแตกต่างระหว่าง Workgroup กับ Domain ที่ถูกต้อง (เลือกได้หลายข้อ)',
      options: ['Workgroup แต่ละเครื่องเก็บบัญชีผู้ใช้ของตัวเอง', 'Domain มี Domain Controller จัดการบัญชีผู้ใช้จากศูนย์กลาง', 'Domain เข้าร่วมได้จาก Windows ทุกรุ่นรวมถึง Home', 'Workgroup เหมาะกับเครือข่ายขนาดเล็กไม่เกินราว 20 เครื่อง'], correct: [0, 1, 3],
      explain: 'Workgroup เป็นแบบ Peer-to-Peer บัญชีอยู่ในแต่ละเครื่อง เหมาะกับเครือข่ายเล็ก ส่วน Domain ใช้ Domain Controller (Active Directory) จัดการรวม และ Windows รุ่น Home เข้าร่วม Domain ไม่ได้ ต้องเป็น Pro, Enterprise หรือ Education' },
    { type: 'choice', level: 'medium',
      q: 'ใน Windows 10/11 ต้องการเปลี่ยนชื่อ Workgroup ของเครื่อง ควรเข้าที่ใด',
      options: ['System Properties → Computer Name → Change...', 'Settings → Personalization → Themes', 'Device Manager → Network adapters', 'Control Panel → Sound → Recording'], correct: 0,
      explain: 'การเปลี่ยน Workgroup หรือเข้าร่วม Domain ทำในหน้าต่าง System Properties แท็บ Computer Name ปุ่ม Change... (เปิดเร็วได้ด้วยคำสั่ง sysdm.cpl)',
      why: ['', 'Personalization ใช้ตั้งธีมและพื้นหลัง', 'Device Manager ใช้จัดการไดรเวอร์ ไม่ใช่ชื่อเครือข่าย', 'เป็นการตั้งค่าไมโครโฟน'] },
    { type: 'text', level: 'medium',
      q: 'Prefix /24 ต้องกรอกเป็น Subnet mask แบบเลขฐานสิบว่าอะไร',
      answers: ['255.255.255.0'],
      explain: '/24 หมายถึงบิตแรก 24 บิตเป็น 1 คือ 11111111.11111111.11111111.00000000 = 255.255.255.0' }
  ],
  sections: [
    {
      id: 's1',
      title: '1. ชื่อเครื่อง (Computer name) และการตรวจสอบ',
      blocks: [
        { type: 'p', text: 'คอมพิวเตอร์ทุกเครื่องในเครือข่ายวินโดวส์มีชื่อเครื่อง (Computer name หรือ Hostname) ใช้ระบุตัวเครื่องให้คนจำได้ง่ายกว่าตัวเลข IP เช่น เวลาเปิดโฟลเดอร์แชร์ เราพิมพ์ \\\\LAB-PC07 ได้แทน \\\\192.168.20.57 ชื่อเครื่องจึงต้องไม่ซ้ำกันในเครือข่ายเดียวกัน ถ้าซ้ำ Windows จะแจ้งเตือนชื่อชนกัน และการแชร์ไฟล์จะสับสนว่าหมายถึงเครื่องใด' },
        { type: 'p', text: 'Windows ที่เพิ่งติดตั้งมักตั้งชื่อแบบสุ่ม เช่น DESKTOP-7K2F9QJ ซึ่งไม่สื่อความหมาย ในห้องแล็บหรือสำนักงานควรตั้งชื่อตามระบบเดียวกันทั้งหมด เช่น LAB2-PC01 ถึง LAB2-PC30 เมื่อเครื่องมีปัญหาครูหรือช่างจะรู้ทันทีว่าอยู่ห้องไหนโต๊ะใด' },
        { type: 'list', items: [
          'คำสั่ง hostname ใน Command Prompt หรือ PowerShell แสดงชื่อเครื่องทันที',
          'คำสั่ง ipconfig /all แสดงชื่อเครื่องในบรรทัด Host Name พร้อมข้อมูลเครือข่ายอื่น',
          'Windows 10/11: Settings → System → About ดูที่ Device name',
          'กด Windows + R พิมพ์ sysdm.cpl เปิด System Properties แท็บ Computer Name จะเห็นทั้งชื่อเครื่องและ Workgroup หรือ Domain'
        ] },
        { type: 'table', head: ['กฎการตั้งชื่อ', 'ตัวอย่างที่ใช้ได้', 'ตัวอย่างที่ใช้ไม่ได้'], rows: [
          ['ใช้ A-Z, a-z, 0-9 และขีดกลาง (-)', 'LAB-PC08', 'LAB_PC#08'],
          ['ห้ามมีช่องว่าง', 'ACCOUNT01', 'ACCOUNT 01'],
          ['ไม่ควรยาวเกิน 15 ตัวอักษร (ข้อจำกัดของชื่อ NetBIOS หน้า Rename this PC จะไม่ยอมให้ยาวเกินนี้)', 'SHOP-CASHIER1', 'SHOP-CASHIER-COUNTER-1'],
          ['ห้ามเป็นตัวเลขล้วน และห้ามมีจุด', 'PC2025', '2025 หรือ PC.2025']
        ] },
        { type: 'check', q: { type: 'choice', level: 'easy', q: 'ทำไมคอมพิวเตอร์ในเครือข่ายเดียวกันจึงต้องมีชื่อไม่ซ้ำกัน',
          options: ['เพื่อให้เครื่องเปิดเร็วขึ้น', 'เพื่อให้ระบุเครื่องได้ถูกตัว', 'เพื่อให้ได้ IP เดียวกัน', 'เพื่อให้ Windows อัปเดตได้'], correct: 1,
          explain: 'ชื่อเครื่องใช้อ้างถึงเครื่องในเครือข่าย ถ้าซ้ำกันระบบจะไม่รู้ว่าหมายถึงเครื่องใดและเกิดข้อผิดพลาดชื่อชนกัน' } }
      ]
    },
    {
      id: 's2',
      title: '2. การเปลี่ยนชื่อเครื่อง และ Workgroup กับ Domain',
      blocks: [
        { type: 'p', text: 'การเปลี่ยนชื่อเครื่องต้องใช้บัญชีที่มีสิทธิ์ผู้ดูแลระบบ (Administrator) และต้องรีสตาร์ทเครื่องก่อนชื่อใหม่จะมีผล ใน Windows 10 และ Windows 11 เมนูอยู่ในตำแหน่งเดียวกัน คือ Settings → System → About → Rename this PC ส่วนวิธีแบบดั้งเดิมที่ใช้ได้ทุกรุ่นคือหน้าต่าง System Properties' },
        { type: 'steps', items: [
          'เปิด Settings (กด Windows + I) แล้วเลือก System',
          'เลื่อนลงล่างสุดเลือก About',
          'กด Rename this PC (Windows 11 ปุ่มอยู่ด้านบนข้างชื่อเครื่อง ส่วน Windows 10 อยู่ใต้หัวข้อ Device specifications)',
          'พิมพ์ชื่อใหม่ตามกฎการตั้งชื่อ แล้วกด Next',
          'เลือก Restart now เพื่อรีสตาร์ท แล้วตรวจสอบด้วยคำสั่ง hostname'
        ] },
        { type: 'term', term: 'Workgroup', text: 'กลุ่มเครื่องในเครือข่ายแบบเพียร์ทูเพียร์ (Peer-to-Peer) ทุกเครื่องเท่าเทียมกัน แต่ละเครื่องเก็บบัญชีผู้ใช้ของตัวเอง ไม่มีเครื่องกลางควบคุม ชื่อเริ่มต้นคือ WORKGROUP เหมาะกับบ้าน ร้านค้า และสำนักงานเล็กที่มีไม่เกินราว 10 ถึง 20 เครื่อง' },
        { type: 'term', term: 'Domain', text: 'เครือข่ายแบบไคลเอนต์-เซิร์ฟเวอร์ที่มีเครื่อง Domain Controller (Windows Server ที่ติดตั้ง Active Directory) เก็บบัญชีผู้ใช้และนโยบายไว้ที่ศูนย์กลาง ผู้ใช้ล็อกอินด้วยบัญชีเดียวได้ทุกเครื่อง เหมาะกับองค์กรขนาดกลางขึ้นไป เครื่องที่จะเข้าร่วม Domain ต้องเป็น Windows รุ่น Pro, Enterprise หรือ Education รุ่น Home เข้าร่วมไม่ได้' },
        { type: 'p', text: 'การเปลี่ยนชื่อ Workgroup หรือเข้าร่วม Domain ทำที่ System Properties แท็บ Computer Name กดปุ่ม Change... แล้วเลือก Member of: Workgroup หรือ Domain ใน Windows 11 เปิดได้จาก Settings → System → About → Domain or workgroup ส่วน Windows 10 เปิดจากลิงก์ Advanced system settings หรือพิมพ์ sysdm.cpl ได้ทั้งสองรุ่น เครื่องที่จะแชร์ไฟล์กันแบบ Workgroup ควรใช้ชื่อ Workgroup เดียวกันเพื่อให้แสดงเป็นกลุ่มเดียวกันใน Network' },
        { type: 'example', title: 'ตัวอย่างร้านค้า SME', text: 'ร้านวัสดุก่อสร้างมีคอมพิวเตอร์ 4 เครื่อง คือ เครื่องแคชเชียร์ 2 เครื่อง เครื่องบัญชี และเครื่องเจ้าของ ช่างตั้งชื่อเป็น SHOP-POS1, SHOP-POS2, SHOP-ACC และ SHOP-OWNER และตั้ง Workgroup เป็น SHOPNET ทุกเครื่อง ไม่จำเป็นต้องลงทุน Windows Server ทำ Domain เพราะเครื่องน้อยและพนักงานใช้เครื่องประจำตัว เมื่อเจ้าของต้องการเปิดไฟล์ยอดขาย ก็พิมพ์ \\\\SHOP-ACC ได้ทันที' },
        { type: 'check', q: { type: 'tf', level: 'easy', q: 'หลังเปลี่ยนชื่อเครื่องใน Windows ต้องรีสตาร์ทเครื่องก่อน ชื่อใหม่จึงจะมีผล ข้อความนี้ถูกหรือผิด', answer: true,
          explain: 'ถูก Windows จะใช้ชื่อใหม่หลังรีสตาร์ท ถ้าสั่ง hostname ก่อนรีสตาร์ทจะยังเห็นชื่อเดิม' } }
      ]
    },
    {
      id: 's3',
      title: '3. ค่าที่ต้องกำหนดให้ IPv4: IP, Subnet mask, Gateway และ DNS',
      blocks: [
        { type: 'p', text: 'การให้คอมพิวเตอร์สื่อสารในเครือข่าย TCP/IP ได้ ต้องมีค่าสี่อย่างทำงานคู่กัน เปรียบเหมือนการส่งพัสดุ IP Address คือบ้านเลขที่ Subnet mask บอกว่าหมู่บ้านเราครอบคลุมบ้านเลขไหนบ้าง Default gateway คือป้อมยามทางออกหมู่บ้าน และ DNS server คือสมุดโทรศัพท์ที่แปลงชื่อเป็นเลขที่บ้าน ถ้าค่าใดผิด อาการที่เห็นจะต่างกัน ซึ่งช่วยให้เราวิเคราะห์ปัญหาได้' },
        { type: 'table', head: ['ค่า', 'หน้าที่', 'ตัวอย่างในวง 192.168.20.0/24', 'ถ้าตั้งผิดจะเป็นอย่างไร'], rows: [
          ['IP Address', 'ที่อยู่เฉพาะของเครื่อง ห้ามซ้ำในวง', '192.168.20.30', 'ถ้าซ้ำ Windows แจ้ง IP conflict และใช้งานไม่ได้'],
          ['Subnet mask', 'แบ่งส่วน Network กับ Host บอกว่าเครื่องใดอยู่วงเดียวกัน', '255.255.255.0 (/24)', 'คุยกับเครื่องในวงหรือนอกวงผิดพลาด'],
          ['Default gateway', 'IP ของ Router ในวงเดียวกัน ที่เครื่องส่งข้อมูลไปให้เมื่อปลายทางอยู่นอกวง', '192.168.20.1', 'คุยในวงได้ แต่ไปเครือข่ายอื่นรวมถึงอินเทอร์เน็ตไม่ได้'],
          ['DNS server', 'แปลงชื่อโดเมนเป็น IP Address', '192.168.20.10 หรือ 8.8.8.8', 'ping IP ได้ แต่เปิดเว็บด้วยชื่อไม่ได้']
        ] },
        { type: 'p', text: 'ทุกครั้งที่จะส่งข้อมูล เครื่องจะนำ Subnet mask มาเทียบว่า IP ปลายทางอยู่วงเดียวกับตัวเองหรือไม่ ถ้าอยู่วงเดียวกันจะส่งถึงเครื่องนั้นโดยตรงผ่านสวิตช์ ถ้าอยู่นอกวง เช่น เว็บไซต์บนอินเทอร์เน็ตหรือเครือข่ายของอีกอาคาร จะส่งไปให้ Default gateway แล้ว Router จะเลือกเส้นทาง (Routing) ส่งต่อไปยังเครือข่ายปลายทาง ดังนั้นถ้าไม่มี Gateway เครื่องจะคุยได้เฉพาะเครื่องในวงเดียวกัน' },
        { type: 'p', text: 'กฎสำคัญในการตั้งค่าเองคือ IP ของเครื่องและ Default gateway ต้องอยู่ในวงเดียวกันตาม Subnet mask เช่น วง /24 สามส่วนแรกต้องตรงกัน (192.168.20) ส่วนเลขท้ายใช้ได้ตั้งแต่ 1 ถึง 254 เพราะ .0 เป็นที่อยู่ของวง (Network address) และ .255 เป็นที่อยู่ Broadcast ใช้กับเครื่องไม่ได้ ในวงส่วนตัวทั่วไปนิยมใช้ IP Private เช่น 192.168.x.x หรือ 10.x.x.x' },
        { type: 'diagram', name: 'ip-classes', caption: 'ช่วง IPv4 แต่ละคลาส ช่วง Private ที่ใช้ในเครือข่ายภายใน และช่วง APIPA 169.254.0.0/16' },
        { type: 'widget', name: 'ip-calc', caption: 'ลองพิมพ์ 192.168.20.30/24 แล้วดู Subnet mask, Network, Broadcast และช่วง IP ที่ใช้ตั้งให้เครื่องได้' },
        { type: 'check', q: { type: 'choice', level: 'medium', q: 'เครื่องหนึ่ง ping เครื่องข้าง ๆ ในห้องได้ แต่ออกอินเทอร์เน็ตไม่ได้เลย ค่าใดน่าตรวจเป็นอันดับแรก',
          options: ['ชื่อเครื่อง', 'Default gateway', 'ชื่อ Workgroup', 'ความละเอียดหน้าจอ'], correct: 1,
          explain: 'การคุยภายในวงได้แต่ออกนอกวงไม่ได้ เป็นอาการเด่นของ Default gateway ที่ว่างหรือตั้งผิด' } }
      ]
    },
    {
      id: 's4',
      title: '4. ตั้งค่า IP แบบ Static และ DHCP ใน Windows 10/11',
      blocks: [
        { type: 'p', text: 'IP แบบอัตโนมัติ (DHCP) คือเครื่องขอค่าจาก DHCP Server ซึ่งในบ้านและร้านค้ามักเป็น Router เอง เหมาะกับเครื่องลูกข่ายทั่วไปเพราะไม่ต้องตั้งทีละเครื่องและไม่เสี่ยง IP ซ้ำ ส่วน IP แบบคงที่ (Static) คือผู้ดูแลพิมพ์ค่าเอง เหมาะกับอุปกรณ์ที่เครื่องอื่นต้องเรียกหาด้วยที่อยู่เดิมเสมอ เช่น เซิร์ฟเวอร์ เครื่องพิมพ์เครือข่าย กล้องวงจรปิด และ Router อีกทางเลือกหนึ่งคือการจอง IP (DHCP reservation) บน Router ตาม MAC Address ซึ่งได้ IP คงที่โดยยังจัดการจากศูนย์กลาง' },
        { type: 'p', text: 'วิธีที่ 1 ผ่านหน้าต่าง Network Connections ใช้ได้ทั้ง Windows 10 และ 11 และเป็นวิธีที่ครูนิยมใช้สอนเพราะหน้าตาเหมือนกันทุกรุ่น' },
        { type: 'steps', items: [
          'กด Windows + R พิมพ์ ncpa.cpl แล้ว Enter (หรือ Control Panel → Network and Sharing Center → Change adapter settings ใน Windows 11 ยังเข้าได้จาก Settings → Network & internet → Advanced network settings → More network adapter options)',
          'คลิกขวาการ์ดเครือข่ายที่ใช้อยู่ เช่น Ethernet หรือ Wi-Fi แล้วเลือก Properties',
          'เลือก Internet Protocol Version 4 (TCP/IPv4) แล้วกด Properties',
          'เลือก Use the following IP address แล้วกรอก IP address, Subnet mask และ Default gateway',
          'เลือก Use the following DNS server addresses แล้วกรอก Preferred และ Alternate DNS server',
          'กด OK และ Close แล้วตรวจสอบด้วย ipconfig /all'
        ] },
        { type: 'p', text: 'วิธีที่ 2 ผ่านแอป Settings ใน Windows 11 ไปที่ Settings → Network & internet → Ethernet (ถ้าเป็น Wi-Fi ให้เข้า Wi-Fi → ชื่อเครือข่าย properties) ที่หัวข้อ IP assignment กด Edit เลือก Manual เปิดสวิตช์ IPv4 แล้วกรอกค่า ส่วน Windows 10 ไปที่ Settings → Network & Internet → Ethernet คลิกชื่อเครือข่าย แล้วกด Edit ใต้ IP settings ข้อสังเกตคือหน้า Settings บางรุ่นให้กรอก Subnet prefix length เป็นตัวเลข เช่น 24 แทน 255.255.255.0 ซึ่งมีความหมายเท่ากัน' },
        { type: 'p', text: 'การกลับไปใช้ DHCP ทำได้โดยเลือก Obtain an IP address automatically และ Obtain DNS server address automatically ในหน้าต่าง TCP/IPv4 หรือเลือก Automatic (DHCP) ในหน้า Settings จากนั้นสั่ง ipconfig /renew เพื่อขอค่าใหม่ทันที' },
        { type: 'note', kind: 'warn', text: 'ก่อนตั้ง Static IP ต้องรู้ว่าช่วง IP ใดที่ DHCP ของ Router แจกอยู่ เช่น 192.168.20.100 ถึง 192.168.20.200 แล้วเลือก IP นอกช่วงนั้น มิฉะนั้นวันหนึ่ง DHCP อาจแจก IP เดียวกันให้เครื่องอื่น ทำให้เกิด IP ชนกัน (IP conflict) และทั้งสองเครื่องใช้งานเครือข่ายไม่ได้' },
        { type: 'example', title: 'ตัวอย่างจากห้องแล็บ', text: 'ห้องแล็บคอมพิวเตอร์ 2 ใช้วง 192.168.20.0/24 Router อยู่ที่ 192.168.20.1 เครื่องเซิร์ฟเวอร์ห้องแล็บที่เป็น DNS อยู่ที่ 192.168.20.10 และ DHCP แจกช่วง .100 ถึง .200 ครูให้นักเรียนตั้งเครื่องโต๊ะที่ 30 เป็น Static ด้วยค่า IP 192.168.20.30, Mask 255.255.255.0, Gateway 192.168.20.1 และ DNS 192.168.20.10 เลข 30 อยู่นอกช่วง DHCP จึงไม่ชนกับใคร และจำง่ายเพราะตรงกับหมายเลขโต๊ะ' },
        { type: 'diagram', name: 'lab-network-plan', caption: 'ผังเครือข่ายห้องแล็บ: Router เป็น Default gateway เชื่อมสวิตช์ไปยังเครื่องในห้อง เครื่องพิมพ์ และ Access Point' }
      ]
    },
    {
      id: 's5',
      title: '5. ตรวจสอบการตั้งค่าด้วย ipconfig',
      blocks: [
        { type: 'p', text: 'หลังตั้งค่าทุกครั้งต้องตรวจสอบว่าค่าที่ใช้งานจริงตรงกับที่ตั้งใจ คำสั่ง ipconfig ใน Command Prompt แสดงค่าโดยย่อของการ์ดเครือข่ายแต่ละตัว ส่วน ipconfig /all แสดงละเอียดกว่า เช่น ชื่อเครื่อง MAC Address สถานะ DHCP และ DNS server' },
        { type: 'table', head: ['คำสั่ง', 'ใช้ทำอะไร'], rows: [
          ['hostname', 'แสดงชื่อเครื่อง'],
          ['ipconfig', 'แสดง IPv4 Address, Subnet Mask และ Default Gateway'],
          ['ipconfig /all', 'แสดง Host Name, Physical Address (MAC), DHCP Enabled, DHCP Server, DNS Servers และระยะเวลาเช่า IP'],
          ['ipconfig /release', 'คืน IP ที่ได้จาก DHCP'],
          ['ipconfig /renew', 'ขอ IP ใหม่จาก DHCP Server'],
          ['ipconfig /flushdns', 'ล้างแคช DNS ในเครื่อง ใช้เมื่อเปลี่ยน DNS แล้วชื่อเว็บยังชี้ไปที่เดิม']
        ] },
        { type: 'list', items: [
          'DHCP Enabled: No แปลว่าเครื่องตั้ง Static อยู่ ถ้าเป็น Yes แปลว่ารับค่าจาก DHCP และจะมีบรรทัด DHCP Server กับ Lease Obtained',
          'IPv4 Address ที่ขึ้นต้น 169.254 คือ APIPA หมายถึงเครื่องขอ IP จาก DHCP ไม่สำเร็จ ให้ตรวจสายและ Router',
          'ถ้ามีคำว่า (Duplicate) ต่อท้าย IPv4 Address แปลว่า IP ชนกับเครื่องอื่น',
          'Default Gateway ว่าง เครื่องจะคุยได้เฉพาะในวงเดียวกัน'
        ] },
        { type: 'example', title: 'ตัวอย่างการอ่านผลที่บ้าน', text: 'น้องปอสั่ง ipconfig /all บนโน้ตบุ๊กที่บ้าน เห็น Host Name เป็น PO-LAPTOP, IPv4 Address 192.168.1.35, Default Gateway 192.168.1.1, DHCP Enabled เป็น Yes และ DHCP Server เป็น 192.168.1.1 จึงสรุปได้ว่า Router บ้านทำหน้าที่ทั้งเป็น Gateway และแจก IP ให้อัตโนมัติ ถ้าวันหนึ่งเปลี่ยนเป็น 169.254.x.x ก็รู้ได้ทันทีว่าเครื่องติดต่อ Router ไม่ได้' },
        { type: 'check', q: { type: 'choice', level: 'medium', q: 'ต้องการดู MAC Address และ DNS server ของการ์ดเครือข่าย ควรใช้คำสั่งใด',
          options: ['hostname', 'ipconfig', 'ipconfig /all', 'ipconfig /renew'], correct: 2,
          explain: 'ipconfig /all แสดงข้อมูลละเอียด รวมถึง Physical Address (MAC) และ DNS Servers ซึ่ง ipconfig แบบธรรมดาไม่แสดง' } }
      ]
    }
  ],
  summary: [
    'ชื่อเครื่องต้องไม่ซ้ำในเครือข่าย ใช้ตัวอักษร ตัวเลข และขีดกลาง ห้ามมีช่องว่าง และไม่ควรเกิน 15 ตัวอักษร',
    'ตรวจชื่อเครื่องด้วย hostname และเปลี่ยนได้ที่ Settings → System → About → Rename this PC ทั้ง Windows 10 และ 11 จากนั้นต้องรีสตาร์ท',
    'Workgroup เป็นแบบ Peer-to-Peer เก็บบัญชีในแต่ละเครื่อง ส่วน Domain ใช้ Domain Controller จัดการรวมศูนย์และต้องใช้ Windows รุ่น Pro ขึ้นไป',
    'IPv4 ต้องมี IP Address, Subnet mask, Default gateway และ DNS server ทำงานคู่กัน และ IP กับ Gateway ต้องอยู่วงเดียวกัน',
    'DHCP แจกค่าอัตโนมัติเหมาะกับเครื่องทั่วไป ส่วน Static เหมาะกับเซิร์ฟเวอร์ เครื่องพิมพ์ และ Router โดยต้องเลือก IP นอกช่วง DHCP',
    'ตั้งค่า IP ได้ที่ ncpa.cpl → Properties → TCP/IPv4 หรือผ่านหน้า Settings ของ Windows 10/11',
    'ใช้ ipconfig และ ipconfig /all ตรวจผล ถ้าพบ 169.254.x.x แสดงว่าเครื่องขอ IP จาก DHCP ไม่สำเร็จ'
  ]
};
