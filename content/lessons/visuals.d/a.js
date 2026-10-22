'use strict';
/* NetLab 2.6 figures batch a (public/js/figs-a.js): placements for weeks 1-3.
   Several entries share one anchor in w3 s3; each is inserted right after the anchor,
   so they are listed in reverse of the order wanted on the page. */
module.exports = [
  {
    lesson: 'w1', section: 's3', anchor: { type: 'p', match: 'นอกจากขนาดแล้ว LAN' }, mode: 'after',
    block: { type: 'diagram', name: 'home-network', caption: 'เครือข่ายในบ้านเป็น LAN ขนาดเล็ก: สายไฟเบอร์จาก ISP เข้ากล่อง ONT แล้วต่อพอร์ต WAN ของ Wi-Fi Router ซึ่งเป็นเส้นแบ่งระหว่างฝั่ง WAN ที่ใช้ Public IP กับฝั่ง LAN ที่ใช้ Private IP 192.168.1.x ภายในเราเตอร์ตัวเดียวมีทั้ง Router, NAT, DHCP, Switch และ Access Point' }
  },
  {
    lesson: 'w1', section: 's5', anchor: { type: 'p', match: 'Full Mesh' }, mode: 'after',
    block: { type: 'widget', name: 'topology-cost', caption: 'เลื่อนจำนวนเครื่องจาก 4 เป็น 30 แล้วเทียบว่าแต่ละโทโพโลยีใช้สายกี่เส้น และเมื่อสายหรืออุปกรณ์เสีย 1 จุด มีคู่เครื่องที่ขาดการติดต่อกี่เปอร์เซ็นต์ จะเห็นว่า Full Mesh ทนทานที่สุดแต่สายเพิ่มตาม n(n-1)/2 ส่วน Star ประหยัดสายแต่สวิตช์เป็นจุดเสียจุดเดียว' }
  },
  {
    lesson: 'w1', section: 's5', anchor: { type: 'example', match: 'อาคารเรียน 3 ชั้น' }, mode: 'after',
    block: { type: 'diagram', name: 'lab-room-network', caption: 'ห้องแล็บ 30 เครื่องจริงใช้ Star: สายแต่ละเส้นวิ่งจาก Patch Panel ในตู้ Rack ไปที่เครื่องเดียว Access Switch 2 ตัวต่อ Uplink ขึ้นไปยัง Core Switch และ Firewall กลายเป็น Extended Star สังเกตว่าสายเส้นหนึ่งเสียกระทบเครื่องเดียว แต่สวิตช์เสียกระทบทั้งกลุ่ม' }
  },
  {
    lesson: 'w2', section: 's5', anchor: { type: 'table', match: 'หัวต่อ' }, mode: 'after',
    block: { type: 'diagram', name: 'device-ports', caption: 'พอร์ตจริงที่จะพบบนอุปกรณ์: ช่อง RJ-45 และไฟ LED ของการ์ดเครือข่าย พอร์ต 1 ถึง 8 และช่อง SFP ของสวิตช์ พอร์ต WAN กับ LAN ของเราเตอร์บ้าน การนับขา 1 ถึง 8 ของหัว RJ-45 และหัว LC Duplex ที่เสียบเข้าโมดูล SFP เทียบขนาดกับหัว SC' }
  },
  {
    lesson: 'w3', section: 's2', anchor: { type: 'diagram', match: 'encapsulation' }, mode: 'after',
    block: { type: 'widget', name: 'packet-journey', caption: 'กดถัดไปทีละขั้นเพื่อตามคำขอ HTTP จาก PC1 ผ่านสวิตช์และเราเตอร์ไปถึงเว็บเซิร์ฟเวอร์ สวิตช์อ่านแค่ MAC และไม่แก้ไขอะไร ส่วนเราเตอร์อ่าน IP ปลายทาง ลด TTL ลง 1 และห่อเฟรมใหม่ด้วย MAC ชุดใหม่ ขณะที่ IP ต้นทางและปลายทางคงเดิมตลอดทาง' }
  },
  {
    lesson: 'w3', section: 's3', anchor: { type: 'p', match: 'ภายในชุด TCP/IP' }, mode: 'after',
    block: { type: 'diagram', name: 'tcp-vs-udp', caption: 'TCP เชื่อมต่อก่อนด้วย SYN, SYN-ACK, ACK แล้วตอบรับทุกข้อมูลและส่งซ้ำเมื่อหาย จึงเหมาะกับเว็บและไฟล์ ส่วน UDP ส่งทันทีไม่รอตอบรับ ข้อมูลที่หายก็หายไป จึงเร็วและเหมาะกับ DNS, VoIP และเกม' }
  },
  {
    lesson: 'w3', section: 's3', anchor: { type: 'example', match: 'เปิดเว็บไซต์ข่าวที่ร้านกาแฟ' }, mode: 'after',
    block: { type: 'diagram', name: 'dns-lookup', caption: 'ขั้นที่สองของตัวอย่างร้านกาแฟ: DNS หาคำตอบจากแคชใกล้ตัวก่อน ถ้าไม่พบ Resolver จะถาม Root, TLD และ Authoritative Server ตามลำดับ แล้วเก็บคำตอบไว้ตาม TTL ทำให้ครั้งต่อไปเร็วขึ้น' }
  },
  {
    lesson: 'w3', section: 's3', anchor: { type: 'example', match: 'เปิดเว็บไซต์ข่าวที่ร้านกาแฟ' }, mode: 'after',
    block: { type: 'diagram', name: 'dhcp-dora', caption: 'ขั้นแรกของตัวอย่างร้านกาแฟ: เครื่องขอ IP ด้วย DHCP 4 ขั้น Discover, Offer, Request, Ack ผ่าน UDP 67/68 แล้วได้ IP, Subnet mask, Gateway, DNS และเวลาเช่า ถ้าไม่มีเซิร์ฟเวอร์ตอบ Windows จะได้ 169.254.x.x ซึ่งออกอินเทอร์เน็ตไม่ได้' }
  }
];
