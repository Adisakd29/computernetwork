'use strict';
/* Extra visuals (NetLab 2.4 part 4) placed into lessons when they load: after the first block of `anchor.type`
   whose text/name contains `anchor.match`, or replacing it (mode 'replace'). Unknown anchors append to the section end. */
module.exports = [
 {
  "lesson": "w3",
  "section": "s5",
  "anchor": {
   "type": "table",
   "match": "ประเภท IPv6"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "ipv6-tool",
   "caption": "IPv4 มี 32 บิตซึ่งไม่พอใช้ IPv6 จึงขยายเป็น 128 บิต เขียนเป็นเลขฐานสิบหก 8 กลุ่ม ลองพิมพ์ 2001:0db8:0000:0000:0000:ff00:0042:8329 แล้วดูรูปย่อ จากนั้นลอง fe80::1 และ ::1 เพื่อดูประเภทที่อยู่"
  }
 },
 {
  "lesson": "w3",
  "section": "s5",
  "anchor": {
   "type": "widget",
   "match": "ip-calc"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "subnet-splitter",
   "caption": "ลองแบ่ง 192.168.10.0/24 เป็น 4 ซับเน็ต แล้วดูว่าได้ /26 วงละ 62 โฮสต์ จากนั้นสลับไปแบ่งตามจำนวนโฮสต์ เช่น 50 เครื่องต่อวง"
  }
 },
 {
  "lesson": "w8",
  "section": "s3",
  "anchor": {
   "type": "widget",
   "match": "ip-calc"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "subnet-splitter",
   "caption": "ถ้าห้องแล็บต้องแยกวงเครื่องครูกับเครื่องนักเรียน ลองแบ่ง 192.168.20.0/24 เป็น 2 หรือ 4 ซับเน็ต แล้วดูว่าแต่ละวงตั้ง IP และ Gateway ได้ช่วงใด"
  }
 },
 {
  "lesson": "w13",
  "section": "s4",
  "anchor": {
   "type": "table",
   "match": "Network Destination"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "route-lookup",
   "caption": "เครื่องและเราเตอร์เลือกเส้นทางจากตาราง Routing ลองตาราง PC ในห้องแล็บกับปลายทาง 192.168.10.25 และ 8.8.8.8 แล้วสลับเป็นเราเตอร์สาขา ดูว่าเส้นทาง /24 ชนะ /16 และ Default route อย่างไร"
  }
 },
 {
  "lesson": "w14",
  "section": "s2",
  "anchor": {
   "type": "widget",
   "match": "ping-ladder"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "route-lookup",
   "caption": "ขั้น ping Gateway ผ่านแต่ IP ภายนอกไม่ผ่าน มักเกี่ยวกับเส้นทาง ลองลบ Default route 0.0.0.0/0 ออกจากตาราง PC แล้วค้นหา 8.8.8.8 เพื่อดูว่าแพ็กเก็ตถูกทิ้งเพราะอะไร"
  }
 },
 {
  "lesson": "w8",
  "section": "s4",
  "anchor": {
   "type": "example",
   "match": "ห้องแล็บคอมพิวเตอร์ 2"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "nic-config",
   "caption": "กรอกค่าเหมือนหน้าต่าง TCP/IPv4 Properties แล้วดูผลตรวจ ลองกดสถานการณ์ Gateway ผิดวง, IP เป็น Broadcast และ Mask ผิด เพื่อดูว่า Windows จะใช้งานไม่ได้เพราะอะไร"
  }
 },
 {
  "lesson": "w14",
  "section": "s3",
  "anchor": {
   "type": "table",
   "match": "บรรทัดในผลลัพธ์ ipconfig"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "nic-config",
   "caption": "กดสถานการณ์ APIPA และ ค่าซ้ำกัน เพื่อฝึกวิเคราะห์ว่าค่าใดผิดและควรแก้อย่างไร แล้วสลับเป็นรับอัตโนมัติ (DHCP) เพื่อทบทวนว่า DHCP แจกค่าอะไรให้บ้าง"
  }
 },
 {
  "lesson": "w9",
  "section": "s2",
  "anchor": {
   "type": "table",
   "match": "Share permission"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "share-ntfs",
   "caption": "ตั้งสิทธิ์ Share และ NTFS ให้แต่ละกลุ่ม แล้วดูสิทธิ์จริงเมื่อเข้าผ่านเครือข่ายเทียบกับเมื่อนั่งที่เครื่อง ลองสถานการณ์ Share Read + NTFS Modify ซึ่งได้ผลเป็น Read"
  }
 },
 {
  "lesson": "w18",
  "section": "s2",
  "anchor": {
   "type": "term",
   "match": "เมื่อเข้าผ่านเครือข่าย"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "share-ntfs",
   "caption": "ลองสถานการณ์ ลืมให้สิทธิ์ Write และ Deny ชนะ Allow แล้วอ่านขั้นตอนการคิดว่าสิทธิ์จากหลายกลุ่มสะสมกันอย่างไร และชั้นใดเป็นตัวจำกัด"
  }
 },
 {
  "lesson": "w12",
  "section": "s4",
  "anchor": {
   "type": "widget",
   "match": "ip-calc"
  },
  "mode": "replace",
  "block": {
   "type": "widget",
   "name": "vm-netmode",
   "caption": "เลือกโหมด NAT, Bridged, Host-only และ Internal แล้วดูว่าใครเชื่อมต่อถึง VM ได้ และ VM ได้ IP แบบใด ในโหมด NAT ลองติ๊ก Port Forwarding เพื่อดูว่าเครื่องอื่นเข้าถึงได้เฉพาะพอร์ตที่ส่งต่อ"
  }
 },
 {
  "lesson": "w15",
  "section": "s5",
  "anchor": {
   "type": "note",
   "match": "การดักข้อมูล"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "threat-sorter",
   "caption": "ทบทวนทั้งบท: อ่านสถานการณ์ 10 ข้อแล้วแตะประเภทภัยคุกคามที่ตรงที่สุด สังเกตจุดที่ใช้แยกประเภท เช่น ไวรัสต้องอาศัยไฟล์ แต่เวิร์มแพร่เองผ่านเครือข่าย"
  }
 },
 {
  "lesson": "w16",
  "section": "s4",
  "anchor": {
   "type": "p",
   "match": "สำหรับแรนซัมแวร์"
  },
  "mode": "after",
  "block": {
   "type": "widget",
   "name": "backup-321",
   "caption": "หลักสำรองข้อมูล 3-2-1 และส่วนขยายที่นิยม คือมีสำเนาออฟไลน์หรือแก้ไขไม่ได้อีก 1 ชุดเพื่อป้องกันแรนซัมแวร์"
  }
 },
 {
  "lesson": "w6",
  "section": "s4",
  "anchor": {
   "type": "list",
   "match": "Repeater / Range Extender"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "wlan-devices",
   "caption": "อุปกรณ์ไร้สายแต่ละชนิดต่อขาเข้าต่างกัน: Router และ AP ใช้สาย, Repeater และ SIM Router รับแบบไร้สาย, Mesh ใช้ Backhaul ได้ทั้งสองแบบ"
  }
 },
 {
  "lesson": "w7",
  "section": "s4",
  "anchor": {
   "type": "table",
   "match": "มาตรฐาน"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "wifi-security-timeline",
   "caption": "มาตรฐานความปลอดภัย Wi-Fi จาก WEP ถึง WPA3 ปัจจุบันควรใช้ WPA3 หรืออย่างน้อย WPA2-AES และปิด WPS แบบ PIN"
  }
 },
 {
  "lesson": "w8",
  "section": "s3",
  "anchor": {
   "type": "diagram",
   "match": "ip-classes"
  },
  "mode": "replace",
  "block": {
   "type": "diagram",
   "name": "windows-ip-settings",
   "caption": "ช่องในหน้าต่าง TCP/IPv4 ของ Windows แต่ละช่องถูกใช้ที่ใดในเครือข่าย: เครื่องเรา วงเดียวกัน Router และ DNS Server"
  }
 },
 {
  "lesson": "w10",
  "section": "s2",
  "anchor": {
   "type": "table",
   "match": "ประเด็น"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "nos-vs-os",
   "caption": "OS ส่วนบุคคลเน้นผู้ใช้คนเดียวหน้าเครื่อง ส่วน NOS เน้นให้บริการผู้ใช้จำนวนมากผ่านเครือข่ายอย่างต่อเนื่อง"
  }
 },
 {
  "lesson": "w11",
  "section": "s4",
  "anchor": {
   "type": "p",
   "match": "Hypervisor แบบที่ 2"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "hypervisor-types",
   "caption": "Type 1 ติดตั้งบนฮาร์ดแวร์โดยตรง ส่วน Type 2 ทำงานเป็นโปรแกรมบน Host OS จึงมีชั้นคั่นเพิ่มอีกหนึ่งชั้น"
  }
 },
 {
  "lesson": "w12",
  "section": "s4",
  "anchor": {
   "type": "table",
   "match": "โหมด"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "vm-netmodes",
   "caption": "โหมดเครือข่ายของ VirtualBox: เส้นสีเขียวคือเส้นทางที่เครื่องจำลองเข้าถึงได้ในแต่ละโหมด"
  }
 },
 {
  "lesson": "w13",
  "section": "s3",
  "anchor": {
   "type": "p",
   "match": "การจัดวางที่นิยม"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "rack-layout",
   "caption": "การจัดอุปกรณ์ในตู้ Rack และเส้นทางสายจากเต้ารับถึง Switch: สายถาวรไม่เกิน 90 m รวมสายพ่วงแล้วไม่เกิน 100 m"
  }
 },
 {
  "lesson": "w13",
  "section": "s4",
  "anchor": {
   "type": "p",
   "match": "เครื่องใช้ค่าเหล่านี้ตัดสินใจ"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "routing-decision",
   "caption": "เครื่องตัดสินใจส่งตรงหรือส่งให้ Default Gateway ด้วย Subnet Mask แล้ว Router เลือกเส้นทางที่ prefix ยาวที่สุดจากตาราง Routing"
  }
 },
 {
  "lesson": "w14",
  "section": "s2",
  "anchor": {
   "type": "p",
   "match": "วิธีวิเคราะห์ที่ช่างเครือข่ายนิยมใช้"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "troubleshoot-flow",
   "caption": "แก้ปัญหาจากชั้นล่างขึ้นบน ตรวจทีละขั้นและหยุดแก้ที่ขั้นแรกที่ไม่ผ่าน"
  }
 },
 {
  "lesson": "w15",
  "section": "s3",
  "anchor": {
   "type": "table",
   "match": "ภัยคุกคาม"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "malware-types",
   "caption": "เปรียบเทียบมัลแวร์หลัก 6 ชนิด: ต้องอาศัยไฟล์โฮสต์หรือไม่ แพร่เองได้หรือไม่ และอันตรายหลัก"
  }
 },
 {
  "lesson": "w16",
  "section": "s4",
  "anchor": {
   "type": "list",
   "match": "3 ชุด"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "backup-321",
   "caption": "หลักสำรองข้อมูล 3-2-1 และส่วนขยายที่นิยม คือมีสำเนาออฟไลน์หรือแก้ไขไม่ได้อีก 1 ชุดเพื่อป้องกันแรนซัมแวร์"
  }
 },
 {
  "lesson": "w16",
  "section": "s6",
  "anchor": {
   "type": "p",
   "match": "แต่ละโปรไฟล์มีสถานะ"
  },
  "mode": "after",
  "block": {
   "type": "diagram",
   "name": "firewall-profiles",
   "caption": "Windows Defender Firewall มีโปรไฟล์ Domain, Private และ Public โดยค่าเริ่มต้นบล็อกขาเข้าที่ไม่มีกฎอนุญาตและอนุญาตขาออก"
  }
 }
,
 {"lesson": "w17", "section": "s4", "anchor": {"type": "example", "match": "สำนักงานบัญชีขนาดเล็ก"}, "mode": "after",
  "block": {"type": "widget", "name": "share-ntfs", "caption": "ลองเป็นผู้ดูแลระบบ: ใส่ผู้ใช้ไว้ในกลุ่มต่าง ๆ แล้วกำหนดสิทธิ์ให้กลุ่ม ดูว่าสิทธิ์จากหลายกลุ่มรวมกันอย่างไร และ Deny มีผลอย่างไร (สิทธิ์ Share/NTFS จะเรียนละเอียดในสัปดาห์ที่ 18)"}}
];
