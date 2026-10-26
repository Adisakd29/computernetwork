'use strict';
// Question bank: Unit 3 (week 3) มาตรฐานและโปรโตคอลของระบบเครือข่าย
// Format: docs/BANK-SPEC.md
module.exports = [
  { id: 'u3-001', unit: 3, week: 3, level: 'easy', type: 'match',
    q: 'จับคู่องค์กรมาตรฐานกับผลงานที่เกี่ยวข้องกับเครือข่าย',
    left: ['ISO', 'ITU', 'IEEE', 'EIA/TIA', 'ANSI'],
    right: ['มาตรฐานตระกูล 802 เช่น Ethernet และ Wi-Fi', 'แบบจำลอง OSI 7 ชั้น', 'มาตรฐานการเดินสายในอาคาร TIA-568', 'หน่วยงานของสหประชาชาติด้านโทรคมนาคม', 'สถาบันมาตรฐานแห่งชาติของสหรัฐอเมริกา', 'ผู้พัฒนาชุดโปรโตคอล IPX/SPX'],
    answer: [1, 3, 0, 2, 4],
    explain: 'ISO กำหนด OSI, ITU เป็นหน่วยงานด้านโทรคมนาคมของสหประชาชาติ, IEEE กำหนดมาตรฐาน 802, EIA/TIA กำหนด TIA-568 และ ANSI เป็นสถาบันมาตรฐานแห่งชาติของสหรัฐฯ ส่วน IPX/SPX พัฒนาโดย Novell',
    tags: ['standards'] },

  { id: 'u3-002', unit: 3, week: 3, level: 'easy', type: 'tf',
    q: 'ITU เป็นหน่วยงานของสหประชาชาติที่ดูแลมาตรฐานด้านโทรคมนาคม คลื่นความถี่ และโมเด็ม ข้อความนี้ถูกหรือผิด',
    answer: true,
    explain: 'ITU (International Telecommunication Union) เป็นหน่วยงานของสหประชาชาติ ดูแลมาตรฐานโทรคมนาคม การจัดสรรคลื่นความถี่ และมาตรฐานโมเด็ม',
    tags: ['standards'] },

  { id: 'u3-003', unit: 3, week: 3, level: 'easy', type: 'order',
    q: 'เรียงชั้นของแบบจำลอง OSI จากชั้นบนสุด (ชั้น 7) ลงไปถึงชั้นล่างสุด (ชั้น 1)',
    items: ['Application', 'Presentation', 'Session', 'Transport', 'Network', 'Data Link', 'Physical'],
    explain: 'OSI จากชั้น 7 ถึง 1 คือ Application, Presentation, Session, Transport, Network, Data Link, Physical จำด้วยประโยค All People Seem To Need Data Processing',
    tags: ['osi'] },

  { id: 'u3-004', unit: 3, week: 3, level: 'easy', type: 'choice',
    q: 'นักเรียนเสียบสาย LAN เข้าสวิตช์แล้วไฟที่พอร์ตไม่ติดเลย ควรเริ่มตรวจปัญหาที่ชั้นใดของ OSI',
    options: ['Application', 'Transport', 'Network', 'Physical'],
    correct: 3,
    why: ['Application เป็นชั้นของโปรแกรม ควรตรวจหลังจากชั้นล่างทำงานแล้ว', 'Transport ดูแลพอร์ตและการส่งซ้ำ ไม่เกี่ยวกับไฟพอร์ตที่ไม่ติด', 'Network เกี่ยวกับ IP Address ซึ่งยังใช้ไม่ได้ถ้าไม่มีสัญญาณทางกายภาพ', ''],
    explain: 'ไฟที่พอร์ตไม่ติดแสดงว่าไม่มีสัญญาณทางกายภาพ จึงควรตรวจชั้น Physical ก่อน เช่น สาย หัวต่อ และพอร์ต ไม่ต้องไปตรวจโปรแกรม',
    tags: ['osi', 'troubleshooting'] },

  { id: 'u3-005', unit: 3, week: 3, level: 'medium', type: 'choice',
    q: 'ชั้นใดของ OSI ส่งเฟรมภายในเครือข่ายเดียวกันโดยใช้ MAC Address และตรวจสอบข้อผิดพลาดของเฟรม',
    options: ['Network', 'Data Link', 'Transport', 'Session'],
    correct: 1,
    why: ['Network ใช้ IP Address หาเส้นทางข้ามเครือข่าย', '', 'Transport ใช้หมายเลขพอร์ตและดูแลการส่งจากต้นทางถึงปลายทาง', 'Session เปิด รักษา และปิดการเชื่อมต่อระหว่างสองฝั่ง'],
    explain: 'ชั้น Data Link (ชั้น 2) ส่งเฟรมภายในเครือข่ายเดียวกันด้วย MAC Address และตรวจข้อผิดพลาด อุปกรณ์ที่ทำงานชั้นนี้คือ Switch',
    tags: ['osi'] },

  { id: 'u3-006', unit: 3, week: 3, level: 'easy', type: 'choice',
    q: 'ชั้นใดของ OSI ทำหน้าที่เปิด รักษา และปิดการเชื่อมต่อ (เซสชัน) ระหว่างสองฝั่ง',
    options: ['Session', 'Presentation', 'Physical', 'Network'],
    correct: 0,
    why: ['', 'Presentation แปลงรูปแบบ เข้ารหัส และบีบอัดข้อมูล', 'Physical ส่งบิตเป็นสัญญาณไฟฟ้า แสง หรือคลื่นวิทยุ', 'Network กำหนดที่อยู่ IP และหาเส้นทาง'],
    explain: 'ชั้น Session (ชั้น 5) จัดการการเปิด รักษา และปิดการเชื่อมต่อระหว่างสองฝั่ง',
    tags: ['osi'] },

  { id: 'u3-007', unit: 3, week: 3, level: 'easy', type: 'match',
    q: 'จับคู่ชั้นของ OSI กับอุปกรณ์ที่ทำงานในชั้นนั้น',
    left: ['Physical', 'Data Link', 'Network'],
    right: ['Router', 'Hub / Repeater', 'Switch', 'Gateway ที่แปลงโปรโตคอล'],
    answer: [1, 2, 0],
    explain: 'Hub และ Repeater ทำงานชั้น Physical, Switch ทำงานชั้น Data Link และ Router ทำงานชั้น Network ส่วน Gateway ทำงานได้ถึงชั้นบน',
    tags: ['osi', 'devices'] },

  { id: 'u3-008', unit: 3, week: 3, level: 'medium', type: 'order',
    q: 'เมื่อส่งข้อมูล ข้อมูลถูกห่อหุ้ม (Encapsulation) จากชั้นบนลงล่าง เรียงหน่วยข้อมูล (PDU) ตามลำดับที่เกิดขึ้น',
    items: ['Data', 'Segment', 'Packet', 'Frame', 'Bit'],
    explain: 'ข้อมูลจากชั้นบน (Data) ถูกแบ่งเป็น Segment ที่ชั้น Transport เติม IP กลายเป็น Packet ที่ชั้น Network เติม Header ที่มี MAC และ Trailer (FCS) เป็น Frame ที่ชั้น Data Link แล้วส่งเป็น Bit ที่ชั้น Physical',
    tags: ['osi', 'encapsulation', 'pdu'] },

  { id: 'u3-009', unit: 3, week: 3, level: 'medium', type: 'diagram', diagram: 'encapsulation',
    q: 'จากภาพการห่อหุ้มข้อมูล ส่วนหัว (Header) ที่ชั้น Network เติมเข้าไปมีข้อมูลสำคัญใด',
    answerType: 'choice',
    options: ['หมายเลขพอร์ตต้นทางและปลายทาง', 'IP Address ต้นทางและปลายทาง', 'MAC Address ต้นทางและปลายทาง', 'ชื่อผู้ใช้และรหัสผ่านของเว็บ'],
    correct: 1,
    why: ['หมายเลขพอร์ตเติมที่ชั้น Transport', '', 'MAC Address เติมที่ชั้น Data Link', 'ชื่อผู้ใช้และรหัสผ่านเป็นข้อมูลของชั้น Application'],
    explain: 'ชั้น Network ใส่ IP Address ต้นทางและปลายทาง ทำให้ข้อมูลกลายเป็น Packet ที่ Router ใช้หาเส้นทางข้ามเครือข่าย',
    tags: ['encapsulation', 'osi'] },

  { id: 'u3-010', unit: 3, week: 3, level: 'medium', type: 'tf',
    q: 'ฝั่งผู้รับจะถอดส่วนหัวของข้อมูลทีละชั้นจากชั้นบนลงไปชั้นล่าง เรียกว่า Decapsulation ข้อความนี้ถูกหรือผิด',
    answer: false,
    explain: 'ฝั่งผู้รับถอดส่วนหัวทีละชั้นจากล่างขึ้นบน (เริ่มที่ Physical ไปจนถึง Application) เรียกว่า Decapsulation ซึ่งย้อนกลับกับการห่อหุ้มของผู้ส่ง',
    tags: ['encapsulation'] },

  { id: 'u3-011', unit: 3, week: 3, level: 'medium', type: 'multi',
    q: 'ข้อใดเป็นโปรโตคอลในชั้น Application ของ TCP/IP Model (เลือกได้หลายข้อ)',
    options: ['HTTP', 'DNS', 'TCP', 'Ethernet', 'DHCP'],
    correct: [0, 1, 4],
    explain: 'HTTP, DNS และ DHCP อยู่ในชั้น Application ส่วน TCP อยู่ในชั้น Transport และ Ethernet อยู่ในชั้น Network Access',
    tags: ['tcp-ip', 'protocol'] },

  { id: 'u3-012', unit: 3, week: 3, level: 'medium', type: 'choice',
    q: 'เกมออนไลน์และการโทรผ่านอินเทอร์เน็ต (VoIP) นิยมใช้โปรโตคอลชั้น Transport ใด เพราะส่งเร็วโดยไม่ต้องรอการตอบรับ',
    options: ['TCP', 'IP', 'ARP', 'UDP'],
    correct: 3,
    why: ['TCP มีการตอบรับและส่งซ้ำ จึงเชื่อถือได้แต่ช้ากว่า', 'IP อยู่ในชั้น Internet ทำหน้าที่กำหนดที่อยู่และหาเส้นทาง', 'ARP ใช้หา MAC Address ไม่ใช่โปรโตคอลชั้น Transport', ''],
    explain: 'UDP ส่งข้อมูลโดยไม่รอการตอบรับและไม่ส่งซ้ำ จึงหน่วงน้อยและเหมาะกับงานเวลาจริง เช่น VoIP และเกม ซึ่งข้อมูลที่มาช้าไม่มีประโยชน์แล้ว ส่วน TCP เหมาะกับเว็บและไฟล์ที่ต้องครบถ้วน',
    tags: ['tcp-ip', 'udp', 'tcp'] },

  { id: 'u3-013', unit: 3, week: 3, level: 'easy', type: 'fill',
    q: 'การเปิดเว็บไซต์แบบเข้ารหัสด้วย HTTPS ใช้พอร์ต {{1}} และการแปลงชื่อโดเมนเป็น IP ด้วย DNS ใช้พอร์ต {{2}}',
    blanks: [['443'], ['53']],
    explain: 'HTTPS ใช้พอร์ต 443 (HTTP ใช้ 80) และ DNS ใช้พอร์ต 53',
    tags: ['ports', 'protocol'] },

  { id: 'u3-014', unit: 3, week: 3, level: 'hard', type: 'order',
    q: 'นักเรียนต่อ Wi-Fi ของร้านกาแฟแล้วพิมพ์ชื่อเว็บไซต์ข่าวบนมือถือ เรียงลำดับการทำงานของโปรโตคอลที่เกิดขึ้น',
    items: ['มือถือได้รับ IP Address จากเราเตอร์ของร้านผ่าน DHCP', 'มือถือถาม DNS ว่าชื่อเว็บไซต์นี้มี IP อะไร', 'มือถือเปิดการเชื่อมต่อ TCP ไปยังพอร์ต 443 ของเซิร์ฟเวอร์', 'มือถือส่งคำขอ HTTPS ที่เข้ารหัสไปยังเซิร์ฟเวอร์'],
    explain: 'ต้องมี IP ก่อน (DHCP) จึงถามชื่อได้ (DNS) เมื่อรู้ IP ปลายทางจึงเปิดการเชื่อมต่อ TCP ไปพอร์ต 443 แล้วจึงส่งคำขอ HTTPS',
    tags: ['protocol', 'dhcp', 'dns', 'tcp'] },

  { id: 'u3-015', unit: 3, week: 3, level: 'medium', type: 'match',
    q: 'จับคู่ชุดโปรโตคอลกับระบบที่ใช้หรือลักษณะเด่น',
    left: ['NetBEUI', 'IPX/SPX', 'AppleTalk', 'TCP/IP'],
    right: ['Novell NetWare', 'เครื่อง Macintosh รุ่นเก่า', 'อินเทอร์เน็ตและทุกระบบในปัจจุบัน', 'Windows ยุคเก่าในวงเล็ก ส่งข้ามเราเตอร์ไม่ได้', 'มาตรฐาน Wi-Fi ของ IEEE'],
    answer: [3, 0, 1, 2],
    explain: 'NetBEUI ใช้ใน Windows ยุคเก่าและเป็น Non-routable, IPX/SPX ของ Novell NetWare, AppleTalk ของ Macintosh รุ่นเก่า และ TCP/IP ใช้กับอินเทอร์เน็ตและทุกระบบในปัจจุบัน',
    tags: ['protocol', 'netbeui', 'ipx-spx', 'appletalk'] },

  { id: 'u3-044', unit: 3, week: 3, level: 'medium', type: 'choice',
    q: 'สวิตช์ที่ส่งเฟรมตาม MAC Address และสาย UTP ที่นำสัญญาณ ทำงานอยู่ในชั้นใดของ TCP/IP Model',
    options: ['Application', 'Transport', 'Internet', 'Network Access'],
    correct: 3,
    why: ['Application เป็นชั้นของโปรแกรมและบริการ เช่น HTTP และ DNS', 'Transport ดูแลการส่งระหว่างต้นทางกับปลายทางด้วยหมายเลขพอร์ต (TCP, UDP)', 'Internet ใช้ IP Address หาเส้นทางข้ามเครือข่าย ซึ่งเป็นงานของเราเตอร์', ''],
    explain: 'MAC Address อยู่ในชั้น Data Link และสายสัญญาณอยู่ในชั้น Physical ของ OSI ซึ่ง TCP/IP Model รวมสองชั้นนี้ไว้ในชั้น Network Access (Link) เช่น Ethernet (802.3) และ Wi-Fi (802.11)',
    tags: ['tcp-ip', 'osi'] },

  { id: 'u3-017', unit: 3, week: 3, level: 'easy', type: 'diagram', diagram: 'osi-tcpip',
    q: 'จากภาพเปรียบเทียบ OSI กับ TCP/IP โปรโตคอล ICMP ที่ใช้กับคำสั่ง ping อยู่ในชั้นใดของ TCP/IP',
    answerType: 'choice',
    options: ['Application', 'Transport', 'Internet', 'Network Access'],
    correct: 2,
    why: ['Application มีโปรโตคอลอย่าง HTTP และ DNS', 'Transport มี TCP และ UDP ส่วน ICMP ไม่ได้ใช้หมายเลขพอร์ต', '', 'Network Access ดูแลเฟรมและสัญญาณ เช่น Ethernet และ Wi-Fi'],
    explain: 'ICMP อยู่ในชั้น Internet ร่วมกับ IP ซึ่งตรงกับชั้น Network (ชั้น 3) ของ OSI',
    tags: ['tcp-ip', 'icmp'] },

  { id: 'u3-018', unit: 3, week: 3, level: 'hard', type: 'multi',
    q: 'ข้อใดกล่าวถูกต้องเกี่ยวกับ TCP/IP Model และ OSI Model (เลือกได้หลายข้อ)',
    options: ['TCP/IP Model แบบมาตรฐานมี 4 ชั้น', 'บางตำราแยกชั้นล่างเป็น 2 ชั้น จึงนับเป็น 5 ชั้น', 'ชั้น Internet ตรงกับชั้น Network ของ OSI', 'ชั้น Transport ของ TCP/IP ตรงกับ Session ของ OSI', 'OSI เป็นแบบที่ใช้จริงบนอินเทอร์เน็ต ส่วน TCP/IP เป็นทฤษฎี'],
    correct: [0, 1, 2],
    explain: 'TCP/IP Model ตาม RFC 1122 มี 4 ชั้น (บางตำรานับ 5) ชั้น Internet ตรงกับ Network ของ OSI และ Transport ตรงกับ Transport ของ OSI ส่วน OSI เป็นแบบจำลองอ้างอิงเชิงทฤษฎี ขณะที่ TCP/IP อธิบายโปรโตคอลที่ใช้จริง',
    tags: ['tcp-ip', 'osi'] },

  { id: 'u3-019', unit: 3, week: 3, level: 'easy', type: 'choice',
    q: 'IP Address 200.10.5.1 อยู่ในคลาสใด',
    options: ['Class A', 'Class B', 'Class C', 'Class D'],
    correct: 2,
    why: ['Class A มีออกเตตแรก 1-126', 'Class B มีออกเตตแรก 128-191', '', 'Class D มีออกเตตแรก 224-239 ใช้สำหรับ Multicast'],
    explain: 'ออกเตตแรกคือ 200 อยู่ในช่วง 192-223 จึงเป็น Class C',
    tags: ['ipv4', 'ip-class'] },

  { id: 'u3-020', unit: 3, week: 3, level: 'medium', type: 'choice',
    q: 'อุปกรณ์ส่งข้อมูลไปยังปลายทาง 230.1.1.1 ข้อใดอธิบาย IP Address นี้ได้ถูกต้อง',
    options: ['Class C ใช้กับเครือข่ายขนาดเล็ก', 'Class D ใช้สำหรับ Multicast', 'Class E สงวนไว้สำหรับการทดลอง', 'Class B ใช้กับเครือข่ายขนาดกลาง'],
    correct: 1,
    why: ['Class C มีออกเตตแรก 192-223 แต่ 230 เกินช่วงนี้', '', 'Class E มีออกเตตแรก 240-255', 'Class B มีออกเตตแรก 128-191'],
    explain: 'ออกเตตแรก 230 อยู่ในช่วง 224-239 ซึ่งเป็น Class D ใช้ส่งข้อมูลถึงกลุ่มเครื่อง (Multicast) ไม่ได้ใช้เป็น IP ของเครื่องทั่วไป',
    tags: ['ipv4', 'ip-class'] },

  { id: 'u3-021', unit: 3, week: 3, level: 'medium', type: 'fill',
    q: 'IP Address 150.20.3.4 อยู่ใน Class {{1}} และมี Subnet Mask เริ่มต้นเป็น {{2}}',
    blanks: [['B', 'Class B', 'คลาส B'], ['255.255.0.0', '/16', '16']],
    explain: 'ออกเตตแรก 150 อยู่ในช่วง 128-191 จึงเป็น Class B ซึ่งมี Subnet Mask เริ่มต้น 255.255.0.0 หรือ /16',
    tags: ['ipv4', 'ip-class', 'subnet-mask'] },

  { id: 'u3-022', unit: 3, week: 3, level: 'hard', type: 'multi',
    q: 'ข้อใดเป็น Public IP Address คือไม่อยู่ในช่วง Private (เลือกได้หลายข้อ)',
    options: ['172.32.0.5', '172.24.10.9', '9.255.255.1', '192.167.10.1', '10.255.0.1'],
    correct: [0, 2, 3],
    explain: 'ช่วง Private ตาม RFC 1918 คือ 10.0.0.0/8, 172.16.0.0-172.31.255.255 และ 192.168.0.0/16 ดังนั้น 172.32.0.5 (เกิน 172.31), 9.255.255.1 (ไม่ใช่ 10.x) และ 192.167.10.1 (ไม่ใช่ 192.168) อยู่นอกช่วงจึงเป็น Public ส่วน 172.24.10.9 และ 10.255.0.1 เป็น Private',
    tags: ['ipv4', 'private-ip'] },

  { id: 'u3-023', unit: 3, week: 3, level: 'easy', type: 'tf',
    q: 'IP Address 127.0.0.1 ใช้สำหรับทดสอบการทำงานของเครื่องตัวเอง (Loopback) ไม่ได้ใช้เป็น IP ของเครื่องในเครือข่าย ข้อความนี้ถูกหรือผิด',
    answer: true,
    explain: 'เลข 127 ถูกสงวนไว้สำหรับ Loopback เช่น ping 127.0.0.1 เพื่อทดสอบ TCP/IP ในเครื่องตัวเอง Class A จึงใช้ได้เพียง 1-126',
    tags: ['ipv4', 'loopback'] },

  { id: 'u3-024', unit: 3, week: 3, level: 'easy', type: 'command', os: 'windows',
    q: 'พิมพ์คำสั่งใน Command Prompt เพื่อทดสอบว่า TCP/IP ในเครื่องตัวเองทำงานปกติ โดย ping ไปยังหมายเลข Loopback ที่นิยมใช้ (127.0.0.1)',
    accept: ['^ping(\\.exe)?( [-/]([nl] \\d+|t|4))* 127\\.0\\.0\\.1( [-/]([nl] \\d+|t|4))*$'],
    example: 'ping 127.0.0.1',
    explain: 'ping 127.0.0.1 ส่งข้อมูลทดสอบไปยังตัวเครื่องเอง ถ้าได้ Reply แสดงว่า TCP/IP ในเครื่องทำงานได้',
    tags: ['loopback', 'ping', 'command'] },

  { id: 'u3-025', unit: 3, week: 3, level: 'medium', type: 'choice',
    q: 'นักเรียนตรวจพบว่าเครื่องในห้องแล็บได้ IP Address 169.254.10.20 ข้อใดสรุปได้ถูกต้อง',
    options: ['เครื่องได้ Public IP จากผู้ให้บริการ', 'เป็น IP Class D สำหรับ Multicast', 'ติดต่อ DHCP ไม่ได้จึงตั้ง IP ให้ตัวเอง', 'เป็นหมายเลข Loopback ของเครื่องตัวเอง'],
    correct: 2,
    why: ['169.254 เป็นช่วง Link-local ใช้ได้เฉพาะในวง ไม่ใช่ Public IP', 'Class D คือ 224-239 แต่ 169 อยู่ในช่วง Class B', '', 'Loopback คือช่วง 127.x.x.x เช่น 127.0.0.1'],
    explain: 'ช่วง 169.254.0.0/16 (APIPA หรือ Link-local ตาม RFC 3927) คือ IP ที่ Windows และระบบอื่นหลายระบบตั้งให้ตัวเองเมื่อขอ IP จาก DHCP ไม่สำเร็จ เป็นสัญญาณว่ามีปัญหา ควรตรวจสายหรือพอร์ตสวิตช์',
    tags: ['ipv4', 'apipa', 'dhcp'] },

  { id: 'u3-026', unit: 3, week: 3, level: 'medium', type: 'diagram',
    q: 'จากภาพเครือข่ายห้องแล็บที่ใช้ DHCP แจก IP ในวง 192.168.10.0/24 เครื่องใดน่าจะติดต่อ DHCP ไม่ได้ และควรตรวจสายหรือพอร์ตสวิตช์ก่อน',
    topo: {
      devices: [
        { id: 'pc1', type: 'pc', name: 'PC1', x: 80, y: 80, ifaces: [{ name: 'eth0', ip: '192.168.10.11', prefix: 24, up: true }], gateway: '192.168.10.1' },
        { id: 'pc2', type: 'pc', name: 'PC2', x: 80, y: 180, ifaces: [{ name: 'eth0', ip: '192.168.10.12', prefix: 24, up: true }], gateway: '192.168.10.1' },
        { id: 'pc3', type: 'pc', name: 'PC3', x: 80, y: 280, ifaces: [{ name: 'eth0', ip: '169.254.23.7', prefix: 16, up: true }] },
        { id: 'sw1', type: 'switch', name: 'Switch-Lab', x: 300, y: 180, ports: 24 },
        { id: 'r1', type: 'router', name: 'Router1', x: 520, y: 180,
          ifaces: [{ name: 'g0/0', ip: '192.168.10.1', prefix: 24, up: true }],
          services: { dhcp: { start: '192.168.10.11', end: '192.168.10.50', prefix: 24, gateway: '192.168.10.1', dns: ['8.8.8.8'] } } }
      ],
      links: [
        { id: 'l1', a: { dev: 'pc1', port: 'eth0' }, b: { dev: 'sw1', port: 'p1' }, medium: 'utp', up: true },
        { id: 'l2', a: { dev: 'pc2', port: 'eth0' }, b: { dev: 'sw1', port: 'p2' }, medium: 'utp', up: true },
        { id: 'l3', a: { dev: 'pc3', port: 'eth0' }, b: { dev: 'sw1', port: 'p3' }, medium: 'utp', up: true },
        { id: 'l4', a: { dev: 'sw1', port: 'p24' }, b: { dev: 'r1', port: 'g0/0' }, medium: 'utp', up: true }
      ]
    },
    answerType: 'choice',
    options: ['PC1', 'PC2', 'PC3', 'Router1'],
    correct: 2,
    why: ['PC1 ได้ IP 192.168.10.11 อยู่ในวงที่ DHCP แจก จึงปกติ', 'PC2 ได้ IP 192.168.10.12 อยู่ในวงที่ DHCP แจก จึงปกติ', '', 'Router1 เป็นผู้แจก IP ผ่าน DHCP และมี IP ในวงถูกต้อง'],
    explain: 'PC3 ได้ IP 169.254.23.7 ซึ่งเป็นช่วง APIPA แสดงว่าขอ IP จาก DHCP ไม่สำเร็จ ส่วน PC1 และ PC2 ได้ IP ในวง 192.168.10.0/24 ตามปกติ',
    tags: ['apipa', 'dhcp', 'ipv4'] },

  { id: 'u3-027', unit: 3, week: 3, level: 'easy', type: 'diagram', diagram: 'ip-classes',
    q: 'จากภาพช่วงคลาสของ IPv4 ช่วง Private IP ใดที่อยู่ใน Class B',
    answerType: 'choice',
    options: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'],
    correct: 1,
    why: ['10.0.0.0/8 มีออกเตตแรก 10 จึงอยู่ใน Class A', '', '192.168.0.0/16 มีออกเตตแรก 192 จึงอยู่ใน Class C', '127.0.0.0/8 เป็นช่วง Loopback ไม่ใช่ Private IP'],
    explain: '172.16.0.0/12 (172.16 ถึง 172.31) มีออกเตตแรก 172 อยู่ในช่วง 128-191 จึงอยู่ใน Class B ส่วน 10/8 อยู่ใน Class A, 192.168/16 อยู่ใน Class C และ 127 เป็น Loopback',
    tags: ['ipv4', 'private-ip', 'ip-class'] },

  { id: 'u3-028', unit: 3, week: 3, level: 'easy', type: 'subnet', ip: '192.168.5.130', prefix: 24,
    q: 'เครื่องคิดเงินของร้านค้าใช้ IP 192.168.5.130/24 (Class C ตามค่าเริ่มต้น) จงหา Network Address, Broadcast Address และจำนวนโฮสต์ที่ใช้งานได้',
    ask: ['network', 'broadcast', 'hosts'],
    explain: '/24 ใช้ 3 ออกเตตแรกเป็นส่วนเครือข่าย Network = 192.168.5.0, Broadcast = 192.168.5.255 และโฮสต์ = 2^8 - 2 = 254 เครื่อง',
    tags: ['subnet', 'ipv4', 'class-c'] },

  { id: 'u3-029', unit: 3, week: 3, level: 'medium', type: 'subnet', ip: '172.16.45.9', prefix: 16,
    q: 'เซิร์ฟเวอร์ในสำนักงานใช้ IP 172.16.45.9/16 (Class B ตามค่าเริ่มต้น) จงหา Network Address, Broadcast Address และจำนวนโฮสต์ที่ใช้งานได้',
    ask: ['network', 'broadcast', 'hosts'],
    explain: '/16 ใช้ 2 ออกเตตแรกเป็นส่วนเครือข่าย Network = 172.16.0.0, Broadcast = 172.16.255.255 และโฮสต์ = 2^16 - 2 = 65,534 เครื่อง',
    tags: ['subnet', 'ipv4', 'class-b'] },

  { id: 'u3-030', unit: 3, week: 3, level: 'medium', type: 'subnet', ip: '10.20.30.40', prefix: 8, maskGiven: true,
    q: 'อุปกรณ์ในเครือข่ายขนาดใหญ่ใช้ IP 10.20.30.40 กับ Subnet Mask เริ่มต้นของ Class A จงหา Network Address และ Broadcast Address',
    ask: ['network', 'broadcast'],
    explain: 'Class A มี Mask 255.0.0.0 (/8) ใช้ออกเตตแรกเป็นส่วนเครือข่าย Network = 10.0.0.0 และ Broadcast = 10.255.255.255',
    tags: ['subnet', 'ipv4', 'class-a'] },

  { id: 'u3-031', unit: 3, week: 3, level: 'hard', type: 'subnet', ip: '192.168.10.200', prefix: 25,
    q: 'วิทยาลัยแบ่งวง 192.168.10.0 ออกเป็น /25 เครื่องหนึ่งได้ IP 192.168.10.200/25 จงหา Network Address, โฮสต์แรก, โฮสต์สุดท้าย และ Broadcast Address ของวงนี้',
    ask: ['network', 'first', 'last', 'broadcast'],
    explain: '/25 มีส่วนโฮสต์ 7 บิต แต่ละวงมี 128 หมายเลข (0-127 และ 128-255) 200 อยู่ในวง 128-255 จึงได้ Network = 192.168.10.128, โฮสต์แรก .129, โฮสต์สุดท้าย .254 และ Broadcast = 192.168.10.255',
    tags: ['subnet', 'ipv4', 'cidr'] },

  { id: 'u3-032', unit: 3, week: 3, level: 'hard', type: 'subnet', ip: '192.168.1.77', prefix: 26,
    q: 'ห้องแล็บใช้ IP 192.168.1.77/26 จงหา Network Address, Broadcast Address, จำนวนโฮสต์ที่ใช้งานได้ และ Subnet Mask แบบจุดทศนิยม',
    ask: ['network', 'broadcast', 'hosts', 'mask'],
    explain: '/26 มีส่วนโฮสต์ 6 บิต แต่ละวงมี 64 หมายเลข (0, 64, 128, 192) 77 อยู่ในวง 64-127 จึงได้ Network = 192.168.1.64, Broadcast = 192.168.1.127, โฮสต์ = 2^6 - 2 = 62 และ Mask = 255.255.255.192',
    tags: ['subnet', 'ipv4', 'cidr'] },

  { id: 'u3-033', unit: 3, week: 3, level: 'hard', type: 'subnet', ip: '192.168.20.100', prefix: 27, maskGiven: true,
    q: 'ร้านค้า SME ตั้งเครื่องพิมพ์ไว้ที่ IP 192.168.20.100 Subnet Mask 255.255.255.224 จงหา Network Address, โฮสต์แรก, โฮสต์สุดท้าย, Broadcast Address และจำนวนโฮสต์ที่ใช้งานได้',
    ask: ['network', 'first', 'last', 'broadcast', 'hosts'],
    explain: 'Mask 255.255.255.224 คือ /27 มีส่วนโฮสต์ 5 บิต แต่ละวงมี 32 หมายเลข (0, 32, 64, 96, 128 ...) 100 อยู่ในวง 96-127 จึงได้ Network = 192.168.20.96, โฮสต์แรก .97, โฮสต์สุดท้าย .126, Broadcast = 192.168.20.127 และโฮสต์ = 2^5 - 2 = 30',
    tags: ['subnet', 'ipv4', 'cidr'] },

  { id: 'u3-045', unit: 3, week: 3, level: 'medium', type: 'choice',
    q: 'สเปกโน้ตบุ๊กเขียนว่า "Gigabit Ethernet, Wi-Fi 6 (802.11ax)" และในบ้านมีเซนเซอร์ Zigbee ข้อใดจับคู่กับกลุ่มมาตรฐาน IEEE ได้ถูกต้องทั้งหมด',
    options: ['Gigabit Ethernet = 802.11, Wi-Fi 6 = 802.3, Zigbee = 802.15', 'Gigabit Ethernet = 802.3, Wi-Fi 6 = 802.11, Zigbee = 802.15', 'Gigabit Ethernet = 802.3, Wi-Fi 6 = 802.15, Zigbee = 802.11', 'Gigabit Ethernet = 802.5, Wi-Fi 6 = 802.11, Zigbee = 802.16'],
    correct: 1,
    why: ['สลับกัน Ethernet แบบใช้สายคือ 802.3 ส่วน Wi-Fi คือ 802.11', '', '802.15 คือ Wireless PAN ไม่ใช่ Wi-Fi และ Zigbee ไม่ได้อยู่ใน 802.11', '802.5 คือ Token Ring และ 802.16 คือ WiMAX'],
    explain: 'Ethernet ทุกความเร็วอยู่ในกลุ่ม 802.3 (Gigabit บนสาย UTP คือ 802.3ab) Wi-Fi 6 คือ 802.11ax ในกลุ่ม 802.11 และ Zigbee สร้างบนมาตรฐาน 802.15.4 ในกลุ่ม Wireless PAN (802.15)',
    tags: ['ieee802', 'zigbee'] },

  { id: 'u3-035', unit: 3, week: 3, level: 'easy', type: 'match',
    q: 'จับคู่มาตรฐาน IEEE 802 กับเทคโนโลยี',
    left: ['802.3', '802.11', '802.15', '802.5', '802.16'],
    right: ['Wireless LAN (Wi-Fi)', 'Token Ring', 'Ethernet', 'Wireless PAN', 'Wireless MAN (WiMAX)', 'การเข้าสาย T568A/T568B'],
    answer: [2, 0, 3, 1, 4],
    explain: '802.3 คือ Ethernet, 802.11 คือ Wi-Fi, 802.15 คือ Wireless PAN, 802.5 คือ Token Ring และ 802.16 คือ WiMAX ส่วนการเข้าสาย T568A/B เป็นมาตรฐาน TIA-568 ไม่ใช่ IEEE',
    tags: ['ieee802'] },

  { id: 'u3-036', unit: 3, week: 3, level: 'medium', type: 'choice',
    q: 'เหตุใด Wi-Fi (IEEE 802.11) จึงใช้ CSMA/CA แทน CSMA/CD แบบที่ Ethernet ดั้งเดิมใช้',
    options: ['คลื่นวิทยุไม่มีวันชนกัน จึงไม่ต้องตรวจจับ', 'Wi-Fi ใช้โทเคนแบบเดียวกับ Token Ring', 'CSMA/CD ใช้ได้กับสายใยแก้วนำแสงเท่านั้น', 'ตรวจจับการชนในอากาศไม่ได้ จึงเลี่ยงการชนแต่แรก'],
    correct: 3,
    why: ['คลื่นวิทยุชนกันได้ จึงต้องมีกลไกหลีกเลี่ยง', 'Wi-Fi ไม่ได้ใช้โทเคน', 'CSMA/CD เป็นกลไกของ Ethernet แบบดั้งเดิม ไม่ได้ผูกกับไฟเบอร์', ''],
    explain: 'Wi-Fi ตรวจจับการชนในอากาศไม่ได้ จึงใช้ CSMA/CA ที่พยายามหลีกเลี่ยงการชนตั้งแต่แรก ส่วน Ethernet ดั้งเดิมใช้ CSMA/CD ที่ฟังก่อนส่งและหยุดเมื่อพบการชน',
    tags: ['ieee802', 'csma'] },

  { id: 'u3-037', unit: 3, week: 3, level: 'hard', type: 'scenario',
    q: 'ตรวจการตั้ง IP ของเครื่องคิดเงินในร้านค้า',
    context: 'ร้านค้า SME ใช้วง 192.168.1.0/24 เราเตอร์ใช้ IP 192.168.1.1 นักศึกษาฝึกงานตั้ง IP แบบกำหนดเองให้เครื่องคิดเงินใหม่ 3 เครื่อง ได้แก่ เครื่อง A = 192.168.1.0, เครื่อง B = 192.168.1.255 และเครื่อง C = 192.168.1.20 ปรากฏว่ามีบางเครื่องใช้งานไม่ได้',
    steps: [
      { q: 'IP ของเครื่อง A (192.168.1.0) มีปัญหาอะไร',
        options: ['เป็น Network Address ของวง ใช้ตั้งให้เครื่องไม่ได้', 'เป็น Public IP ต้องขออนุญาตก่อนใช้', 'เป็น Class A จึงอยู่คนละวงกับเราเตอร์', 'ไม่มีปัญหา ใช้งานได้ตามปกติ'],
        correct: 0 },
      { q: 'IP ของเครื่อง B (192.168.1.255) มีปัญหาอะไร',
        options: ['ใช้ได้ เพราะเป็นเลขสุดท้ายของวง', 'เป็น Broadcast Address ใช้ตั้งให้เครื่องไม่ได้', 'เป็นหมายเลข Loopback ของเครื่อง', 'เป็น IP Class D สำหรับ Multicast'],
        correct: 1 },
      { q: 'เมื่อเราเตอร์ใช้ .1 ไปแล้ว ช่วงใดคือ IP ที่ยังตั้งให้เครื่องคิดเงินได้ทั้งหมด',
        options: ['192.168.1.0 ถึง 192.168.1.255', '192.168.1.1 ถึง 192.168.1.255', '192.168.1.0 ถึง 192.168.1.254', '192.168.1.2 ถึง 192.168.1.254'],
        correct: 3 }
    ],
    explain: 'ในวง /24 หมายเลขแรก (.0) เป็น Network Address และหมายเลขสุดท้าย (.255) เป็น Broadcast จึงใช้ตั้งให้เครื่องไม่ได้ โฮสต์ที่ใช้ได้คือ .1 ถึง .254 เมื่อเราเตอร์ใช้ .1 แล้วจึงเหลือ .2 ถึง .254 ส่วนเครื่อง C ตั้งได้ถูกต้อง',
    tags: ['ipv4', 'subnet', 'troubleshooting'] },

  { id: 'u3-038', unit: 3, week: 3, level: 'medium', type: 'scenario',
    q: 'ใช้ OSI และ TCP/IP วิเคราะห์ปัญหาเปิดเว็บไม่ได้',
    context: 'พนักงานสำนักงานแจ้งว่าเปิดเว็บไซต์ด้วยชื่อไม่ได้ ช่างตรวจเครื่องแล้วได้ผลดังนี้',
    pre: 'ไฟที่พอร์ตสวิตช์: ติด\nIP: 192.168.1.25  Mask: 255.255.255.0  Gateway: 192.168.1.1\nping 192.168.1.1 : Reply\nping 8.8.8.8 : Reply\nเปิด www.example.com : ไม่พบเว็บไซต์ (แปลงชื่อเป็น IP ไม่ได้)',
    steps: [
      { q: 'ไฟพอร์ตติดและ ping ไปยังเกตเวย์ได้ แสดงว่าชั้นใดทำงานปกติแล้ว',
        options: ['เฉพาะชั้น Application', 'ชั้น Physical, Data Link และ Network', 'ไม่มีชั้นใดทำงานเลย', 'เฉพาะชั้น Presentation'],
        correct: 1 },
      { q: 'ping 8.8.8.8 ได้ แต่เปิดเว็บด้วยชื่อไม่ได้ โปรโตคอลใดน่าสงสัยที่สุด',
        options: ['DHCP', 'Ethernet', 'ARP', 'DNS'],
        correct: 3 },
      { q: 'โปรโตคอลที่น่าสงสัยนี้ทำงานในชั้นใดของ TCP/IP Model',
        options: ['Application', 'Internet', 'Transport', 'Network Access'],
        correct: 0 }
    ],
    explain: 'การที่ไฟพอร์ตติดและ ping ด้วย IP ได้ แสดงว่าชั้นล่างถึงชั้น Network ปกติ แต่แปลงชื่อเป็น IP ไม่ได้ จึงเป็นปัญหาที่ DNS ซึ่งเป็นโปรโตคอลชั้น Application',
    tags: ['osi', 'tcp-ip', 'dns', 'troubleshooting'] },

  { id: 'u3-039', unit: 3, week: 3, level: 'medium', type: 'label', diagram: 'osi-tcpip',
    q: 'ภาพเทียบ OSI 7 ชั้นกับ TCP/IP 4 ชั้น ระบุชื่อชั้นที่ถูกซ่อนไว้ตามหมายเลข (สังเกตตำแหน่งและตัวอย่างโปรโตคอลในแถวเดียวกัน)',
    hide: ['6 Presentation', '5 Session', '3 Network', 'Internet', 'Network Access'],
    extra: ['5 Presentation', '6 Session'],
    explain: 'OSI ชั้น 6 คือ Presentation (JPEG, การเข้ารหัส) ชั้น 5 คือ Session และชั้น 3 คือ Network (IP, ICMP) ฝั่ง TCP/IP ชั้นที่ตรงกับ OSI ชั้น 3 คือ Internet และชั้นล่างสุดที่รวม Data Link กับ Physical คือ Network Access (Link)',
    tags: ['osi', 'tcp-ip', 'label'] },

  { id: 'u3-040', unit: 3, week: 3, level: 'medium', type: 'label', diagram: 'encapsulation',
    q: 'ภาพการห่อหุ้มข้อมูล (Encapsulation) ระบุชื่อหน่วยข้อมูล (PDU) ของแต่ละชั้น และส่วนหัว/ส่วนท้ายที่ชั้น Data Link เติมเข้าไป ตามหมายเลข',
    hide: ['Segment', 'Packet', 'Frame', 'Bits', 'MAC', 'FCS'],
    explain: 'ชั้น Transport เติม Header ของ TCP ได้ Segment ชั้น Network เติม Header ที่มี IP ได้ Packet ชั้น Data Link เติม Header ที่มี MAC Address ไว้หน้า และ Trailer ชื่อ FCS ไว้ท้ายเพื่อตรวจข้อผิดพลาด ได้ Frame แล้วชั้น Physical ส่งออกเป็น Bits',
    tags: ['encapsulation', 'pdu', 'label'] },

  { id: 'u3-041', unit: 3, week: 3, level: 'medium', type: 'multi',
    q: 'ผลคำสั่ง ipconfig ของเครื่องในห้องแล็บเป็นดังด้านบน ข้อใดสรุปได้ถูกต้อง (เลือกได้หลายข้อ)',
    pre: 'C:\\> ipconfig\n\nWindows IP Configuration\n\nEthernet adapter Ethernet:\n\n   Connection-specific DNS Suffix  . :\n   Link-local IPv6 Address . . . . . : fe80::8d2c:41a7:3b9e:12f4%12\n   IPv4 Address. . . . . . . . . . . : 192.168.10.37\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.10.1',
    options: ['IPv4 ของเครื่องเป็น Private IP ที่อยู่ในช่วง Class C', 'เครื่องนี้อยู่ในวง 192.168.10.0/24', 'บรรทัด fe80:: แสดงว่าขอ IP จาก DHCP ไม่สำเร็จ เหมือน APIPA', 'Default Gateway อยู่ในวงเดียวกับเครื่องนี้', 'IP 192.168.10.37 ใช้บนอินเทอร์เน็ตได้โดยตรงโดยไม่ต้องผ่าน NAT'],
    correct: [0, 1, 3],
    explain: '192.168.10.37 อยู่ในช่วง Private 192.168.0.0/16 และออกเตตแรก 192 อยู่ใน Class C เมื่อ Mask เป็น 255.255.255.0 (/24) วงคือ 192.168.10.0/24 ซึ่ง Gateway 192.168.10.1 ก็อยู่ในวงนี้ ส่วน fe80:: เป็น Link-local IPv6 ที่ทุกการ์ดสร้างเองอัตโนมัติ ไม่ได้แปลว่ามีปัญหาแบบ APIPA และ Private IP ต้องผ่าน NAT ก่อนออกอินเทอร์เน็ต',
    tags: ['ipv4', 'private-ip', 'ipv6', 'ipconfig', 'output'] },

  { id: 'u3-042', unit: 3, week: 3, level: 'hard', type: 'choice',
    q: 'นักเรียนดักข้อมูลด้วย Wireshark ขณะเครื่องตัวเอง (192.168.10.37) เปิดเว็บไซต์ที่ 203.0.113.80 ได้ข้อมูลตามด้านบน MAC ปลายทาง 00:1a:2b:3c:4d:01 ในเฟรมนี้น่าจะเป็นของอุปกรณ์ใด',
    pre: 'Frame 15: 74 bytes on wire (592 bits), 74 bytes captured\nEthernet II, Src: 3c:52:82:1a:7f:10, Dst: 00:1a:2b:3c:4d:01\nInternet Protocol Version 4, Src: 192.168.10.37, Dst: 203.0.113.80\nTransmission Control Protocol, Src Port: 51544, Dst Port: 443',
    options: ['เว็บเซิร์ฟเวอร์ 203.0.113.80 บนอินเทอร์เน็ต', 'เราเตอร์ที่เป็น Default Gateway ของวง', 'สวิตช์ที่เครื่องนี้เสียบสายอยู่', 'การ์ดเครือข่ายของเครื่องผู้ส่งเอง'],
    correct: 1,
    why: ['MAC ใช้ส่งภายในวงเดียวกันเท่านั้น เว็บเซิร์ฟเวอร์อยู่คนละเครือข่าย จึงใช้ IP ระบุ ไม่ใช่ MAC', '', 'สวิตช์ส่งเฟรมต่อโดยไม่เป็นปลายทางของเฟรม จึงไม่ถูกใส่เป็น MAC ปลายทาง', 'MAC ของเครื่องผู้ส่งคือ Src 3c:52:82:1a:7f:10'],
    explain: 'IP ปลายทาง 203.0.113.80 อยู่นอกวง เครื่องจึงส่งเฟรมไปที่ MAC ของ Default Gateway (เราเตอร์) ในชั้น Data Link ขณะที่ชั้น Network ยังใส่ IP ปลายทางเป็นเว็บเซิร์ฟเวอร์ เมื่อเราเตอร์รับแล้วจะห่อเฟรมใหม่ด้วย MAC ชุดใหม่ ส่วนพอร์ต 443 ในชั้น Transport บอกว่าเป็น HTTPS',
    tags: ['encapsulation', 'mac', 'ip', 'wireshark', 'output'] },

  { id: 'u3-043', unit: 3, week: 3, level: 'medium', type: 'scenario',
    q: 'ตรวจแผน IP ของห้องแล็บใหม่',
    context: 'วิทยาลัยเปิดห้องแล็บ 2 มีเครื่องนักเรียน 40 เครื่องและเครื่องครู 1 เครื่องที่รับ IP จาก DHCP ของเราเตอร์ และมีเครื่องพิมพ์ที่ต้องตั้ง IP เอง (Static) ครูให้นักเรียนตรวจแผนต่อไปนี้',
    pre: 'แผน IP ห้องแล็บ 2 (วง 192.168.20.0/24)\nเราเตอร์ (Default Gateway) : 192.168.20.1\nช่วงที่ DHCP แจก          : 192.168.20.100 - 192.168.20.199\nDNS ที่แจก                : 192.168.20.1\nเครื่องที่รับ IP จาก DHCP  : นักเรียน 40 + ครู 1\nตั้ง IP เอง (Static)       : เครื่องพิมพ์ 1 เครื่อง',
    steps: [
      { q: 'ช่วงที่ DHCP แจกมีกี่หมายเลข และพอสำหรับเครื่องที่รับ IP อัตโนมัติหรือไม่',
        options: ['99 หมายเลข ไม่พอ', '100 หมายเลข พอ', '254 หมายเลข พอ', '100 หมายเลข ไม่พอ'],
        correct: 1 },
      { q: 'ควรตั้ง IP ให้เครื่องพิมพ์เป็นหมายเลขใด',
        options: ['192.168.20.150', '192.168.20.255', '192.168.20.10', '192.168.20.1'],
        correct: 2 },
      { q: 'Subnet Mask ที่เครื่องในห้องจะได้รับคือข้อใด',
        options: ['255.255.255.0', '255.255.0.0', '255.0.0.0', '255.255.255.255'],
        correct: 0 }
    ],
    explain: 'ช่วง .100 ถึง .199 มี 199 - 100 + 1 = 100 หมายเลข พอสำหรับ 41 เครื่อง เครื่องพิมพ์ควรใช้หมายเลขนอกช่วง DHCP เพื่อไม่ให้ชนกับเครื่องที่ได้ IP อัตโนมัติ และต้องไม่ใช่ .1 ของเราเตอร์หรือ .255 ซึ่งเป็น Broadcast จึงเลือก .10 ได้ และวง /24 มี Subnet Mask 255.255.255.0',
    tags: ['ipv4', 'dhcp', 'subnet-mask', 'planning'] }
];

/* NetLab 2.6: versions of rewritten questions as they were in 2.5. Kept under their old ids so earlier exam
   attempts still show the question the student actually answered. retired = never drawn for new practice/exams. */
module.exports.push(...[
 {
  "id": "u3-016",
  "unit": 3,
  "week": 3,
  "level": "medium",
  "type": "choice",
  "q": "ชั้น Network Access (Link) ของ TCP/IP Model ตรงกับชั้นใดของ OSI Model",
  "options": [
   "ชั้น 1 Physical และชั้น 2 Data Link",
   "ชั้น 3 Network เพียงชั้นเดียว",
   "ชั้น 4 Transport เพียงชั้นเดียว",
   "ชั้น 5 Session ถึงชั้น 7 Application"
  ],
  "correct": 0,
  "explain": "Network Access ของ TCP/IP รวมชั้น Physical และ Data Link ของ OSI ไว้ด้วยกัน ตัวอย่างโปรโตคอลคือ Ethernet (802.3) และ Wi-Fi (802.11)",
  "tags": [
   "tcp-ip",
   "osi"
  ],
  "retired": true,
  "replacedBy": "u3-044"
 },
 {
  "id": "u3-034",
  "unit": 3,
  "week": 3,
  "level": "easy",
  "type": "choice",
  "q": "หูฟังบลูทูธและอุปกรณ์ Zigbee ในบ้านอัจฉริยะ ใช้เทคโนโลยีที่มีพื้นฐานจากมาตรฐาน IEEE กลุ่มใด",
  "options": [
   "IEEE 802.3",
   "IEEE 802.11",
   "IEEE 802.15",
   "IEEE 802.16"
  ],
  "correct": 2,
  "explain": "IEEE 802.15 คือ Wireless PAN โดย 802.15.1 เป็นพื้นฐานของบลูทูธ และ 802.15.4 เป็นพื้นฐานของ Zigbee",
  "tags": [
   "ieee802",
   "bluetooth"
  ],
  "retired": true,
  "replacedBy": "u3-045"
 }
]);

// NetLab 2.8 supplementary (extra/w3 x1, x2): layering, peer-to-peer processes, IPv6 header
module.exports.push(...[
  { id: 'u3-046', unit: 3, week: 3, level: 'medium', type: 'label', diagram: 'ipv6-header',
    q: 'ภาพส่วนหัวหลักของ IPv6 (RFC 8200) ระบุชื่อฟิลด์ตามหมายเลข',
    hide: ['Traffic Class', 'Flow Label', 'Payload Length', 'Next Header', 'Hop Limit'],
    extra: ['Time to Live', 'Header Checksum', 'Fragment Offset'],
    explain: 'แถวแรกคือ Version (4 บิต), Traffic Class (8 บิต) และ Flow Label (20 บิต) แถวที่สองคือ Payload Length (16 บิต), Next Header (8 บิต) และ Hop Limit (8 บิต) ส่วน Time to Live, Header Checksum และ Fragment Offset เป็นฟิลด์ของ IPv4 ที่ไม่มีในส่วนหัวหลักของ IPv6',
    tags: ['ipv6', 'header', 'label'] },
  { id: 'u3-047', unit: 3, week: 3, level: 'easy', type: 'choice',
    q: 'ข้อใดอธิบาย Peer-to-Peer Process ในสถาปัตยกรรมแบบชั้นได้ถูกต้อง',
    options: ['ชั้นเดียวกันของสองอุปกรณ์สื่อสารกันเชิงตรรกะผ่านส่วนหัวของชั้นนั้น', 'ชั้นที่ติดกันในเครื่องเดียวกันเรียกใช้บริการกันผ่านส่วนต่อประสาน', 'เครื่องทุกเครื่องในเครือข่ายมีสิทธิ์เท่ากันโดยไม่มีเซิร์ฟเวอร์', 'ข้อมูลจริงวิ่งตรงจากชั้นบนของผู้ส่งไปชั้นบนของผู้รับ'],
    correct: 0,
    why: ['', 'นี่คือความหมายของ Interface และ Service ภายในเครื่องเดียว', 'นี่คือสถาปัตยกรรมเครือข่ายแบบ Peer-to-Peer ซึ่งเป็นคนละเรื่องกับ Peer-to-Peer Process', 'ข้อมูลจริงต้องลงทีละชั้นจนเป็นสัญญาณ ข้ามสื่อ แล้วขึ้นทีละชั้น'],
    explain: 'Peer-to-Peer Process คือการที่ชั้นเดียวกันของสองฝั่งคุยกันด้วยโปรโตคอลของชั้นนั้น เช่น TCP ของผู้ส่งเติมส่วนหัวให้ TCP ของผู้รับอ่าน ทั้งที่ข้อมูลจริงเดินลงและขึ้นทีละชั้น',
    tags: ['layering', 'peer-to-peer-process', 'osi'] },
  { id: 'u3-048', unit: 3, week: 3, level: 'medium', type: 'multi',
    q: 'ข้อใดถูกต้องเมื่อเทียบส่วนหัวและการทำงานของ IPv6 กับ IPv4 (เลือกได้หลายข้อ)',
    options: ['ส่วนหัวหลักของ IPv6 ยาวคงที่ 40 ไบต์', 'ส่วนหัวหลักของ IPv6 ไม่มี Header Checksum', 'เราเตอร์ IPv6 แบ่งชิ้นแพ็กเก็ตที่ใหญ่เกินให้เอง', 'IPv6 ใช้ NDP บน ICMPv6 หา MAC ของเพื่อนบ้าน', 'IPv6 ใช้ ARP แบบ Broadcast เหมือน IPv4'],
    correct: [0, 1, 3],
    explain: 'IPv6 มีส่วนหัวหลัก 40 ไบต์คงที่ ไม่มี Checksum ในส่วนหัว ต้นทางเท่านั้นที่แบ่งชิ้น (เราเตอร์ส่ง Packet Too Big กลับ) และใช้ NDP แบบ Multicast แทน ARP เพราะ IPv6 ไม่มี Broadcast',
    tags: ['ipv6', 'header', 'ndp', 'icmpv6'] }
]);

/* 3.2: knowledge questions kept from the retired lab / room tasks after a duplicate check.
   src = the original task key (lab:wN-i or room:rN-i); see docs/BANK-FROM-LABS-3.2.md */
module.exports.push(...[
  { id: 'u3-049', unit: 3, week: 3, level: 'easy', type: 'choice', src: 'room:r4-9',
    q: 'ในชั้น Transport ใช้อะไรระบุว่าข้อมูลต้องส่งถึงโปรแกรมใดในเครื่องปลายทาง',
    options: ['MAC Address', 'Port Number', 'IP Address', 'SSID'],
    correct: 1,
    explain: 'IP Address ระบุเครื่อง แต่ในเครื่องมีหลายโปรแกรม ชั้น Transport จึงใช้ Port Number ระบุโปรเซส เช่น เว็บใช้ 80/443 และ DNS ใช้ 53 ทำให้ส่งจากโปรเซสถึงโปรเซสได้ (Process-to-Process) ส่วน MAC Address ใช้ส่งภายในวงเดียวกัน',
    tags: ['transport', 'port'] },

  { id: 'u3-050', unit: 3, week: 3, level: 'medium', type: 'order', src: 'room:r4-10',
    q: 'เรียงลำดับการจับมือ 3 ครั้ง (3-Way Handshake) ของ TCP ก่อนเริ่มส่งข้อมูล',
    items: ['SYN (ฝั่งที่ขอเริ่มเชื่อมต่อส่งไป)', 'SYN-ACK (ฝั่งผู้รับตอบกลับ)', 'ACK (ฝั่งที่ขอเริ่มยืนยัน)'],
    explain: 'TCP เปิดการเชื่อมต่อด้วย SYN แล้วอีกฝั่งตอบ SYN-ACK และฝั่งแรกยืนยันด้วย ACK จากนั้นจึงเริ่มส่งข้อมูลจริง ส่วน UDP ไม่มีขั้นตอนนี้ จึงส่งได้ทันทีแต่ไม่รับประกันว่าข้อมูลถึง',
    tags: ['tcp', 'handshake'] }
]);
