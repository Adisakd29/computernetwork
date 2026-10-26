'use strict';
/* NetLab 2.16 real photos, batch d (helper C2): devices named in lesson text for weeks 10, 14, 15 and 16.
   Placements: content/lessons/visuals.d/p-d.js */
module.exports = {
  'nvr-ip-cameras': {
    file: 'nvr-ip-cameras.jpg', w: 1600, h: 876,
    title: 'เครื่องบันทึกภาพ NVR กับกล้อง IP และสวิตช์ PoE',
    alt: 'ชุดระบบกล้องวงจรปิดแบบ IP วางบนโต๊ะ: กล่องเครื่องบันทึก NVR สีดำด้านหน้า กล้อง IP แบบกล่องทางซ้าย กล้องหมุนส่ายได้ด้านหลัง กล้อง IP ขนาดเล็กสีขาวด้านขวา และสวิตช์ PoE ที่มีสาย LAN หลายเส้นต่ออยู่',
    labels: [
      { x: 24, y: 56, text: 'เครื่องบันทึกภาพ (NVR: Network Video Recorder)' },
      { x: 18, y: 38, text: 'กล้อง IP แบบกล่อง (Box Camera)' },
      { x: 74, y: 17, text: 'กล้อง IP แบบหมุนส่ายได้ (PTZ Camera)' },
      { x: 73, y: 72, text: 'กล้อง IP ขนาดเล็ก' },
      { x: 87, y: 55, text: 'สวิตช์ PoE จ่ายไฟและข้อมูลให้กล้องทางสาย LAN' }
    ],
    credit: { source: 'commons', file: 'File:IPCorder NVR with cameras.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'poe-switch-link-led': {
    file: 'poe-switch-link-led.jpg', w: 1600, h: 898,
    title: 'ไฟ Link ที่พอร์ตสวิตช์',
    alt: 'สวิตช์ 8 พอร์ตสีน้ำเงิน พอร์ต 1 ถึง 4 เสียบสาย LAN และมีไฟสีเขียวติดที่พอร์ต ส่วนพอร์ต 5 ถึง 8 ยังว่างและไฟดับ เหนือพอร์ต 7 และ 8 มีข้อความ On = Link, Blink = Act',
    labels: [
      { x: 31, y: 45, text: 'พอร์ตที่เสียบสายแล้ว ไฟ Link ติดสีเขียว' },
      { x: 58, y: 73, text: 'พอร์ตว่าง ไม่มีสาย ไฟดับ' },
      { x: 76, y: 67, text: 'ข้อความ On = Link, Blink = Act (ติดค้างคือเชื่อมต่อแล้ว กะพริบคือมีข้อมูลวิ่ง)' },
      { x: 12, y: 27, text: 'ไฟสถานะ PoE ของพอร์ต 1 ถึง 4' }
    ],
    credit: { source: 'commons', file: 'File:IPCorder NVR with cameras.jpg' }, changes: 'ครอปเฉพาะส่วนสวิตช์และย่อขนาด'
  },
  'rack-server-front': {
    file: 'rack-server-front.jpg', w: 1126, h: 568,
    title: 'เซิร์ฟเวอร์แบบติดตั้งในตู้ Rack (Rack Server)',
    alt: 'ด้านหน้าของเซิร์ฟเวอร์สองเครื่องที่ยึดอยู่ในตู้ Rack เครื่องบนสูง 1U เครื่องล่างสูง 2U มีถาดฮาร์ดดิสก์สีดำพร้อมคันปลดสีเขียวเรียงเต็มหน้าเครื่อง',
    labels: [
      { x: 9, y: 21, text: 'เซิร์ฟเวอร์สูง 1U' },
      { x: 9, y: 79, text: 'เซิร์ฟเวอร์สูง 2U' },
      { x: 31, y: 62, text: 'ถาดฮาร์ดดิสก์แบบถอดเปลี่ยนขณะเครื่องเปิด (Hot-swap) ใช้ทำ RAID' }
    ],
    credit: { source: 'commons', file: 'File:Rack Servers Fujitsu Primergy.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'ups-front-leds': {
    file: 'ups-front-leds.jpg', w: 645, h: 1030,
    title: 'เครื่องสำรองไฟ (UPS)',
    alt: 'ด้านหน้าของเครื่องสำรองไฟ UPS ขนาดเล็กสีขาว มีไฟแสดงสถานะ 4 ดวง ได้แก่ Power on, On Battery, Overload และ Replace Battery และปุ่มเปิดปิดทรงกลมอยู่ใต้ไฟสถานะ',
    labels: [
      { x: 33, y: 13, text: 'Power on: มีไฟจ่ายให้อุปกรณ์ตามปกติ' },
      { x: 33, y: 20, text: 'On Battery: ไฟบ้านดับ กำลังจ่ายไฟจากแบตเตอรี่' },
      { x: 33, y: 33, text: 'Replace Battery: แบตเตอรี่เสื่อม ควรเปลี่ยน' },
      { x: 33, y: 43, text: 'ปุ่มเปิด/ปิดเครื่อง' }
    ],
    credit: { source: 'commons', file: 'File:Apc ups rs500 01.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'server-cabinet-doors': {
    file: 'server-cabinet-doors.jpg', w: 1160, h: 1600,
    title: 'ตู้ Rack แบบมีประตูล็อกกุญแจได้',
    alt: 'ตู้ Rack สีดำหลายตู้เรียงเป็นแถวในห้องเซิร์ฟเวอร์ ประตูหน้าตู้เป็นแผ่นโลหะเจาะรูระบายอากาศ แต่ละบานมีมือจับประตูสีดำ มองเห็นสายและอุปกรณ์ข้างในผ่านรูเล็ก ๆ',
    labels: [
      { x: 72, y: 49, text: 'มือจับประตูตู้' },
      { x: 59, y: 23, text: 'ประตูเหล็กเจาะรู ระบายอากาศได้แต่กันคนเอื้อมถึงอุปกรณ์' },
      { x: 24, y: 49, text: 'ตู้ Rack เรียงเป็นแถวในห้องเซิร์ฟเวอร์' }
    ],
    credit: { source: 'pexels', page: 'https://www.pexels.com/photo/black-server-racks-5203849/' }, changes: 'ครอปและย่อขนาด'
  },
  'cctv-dome-camera': {
    file: 'cctv-dome-camera.jpg', w: 976, h: 1089,
    title: 'กล้องวงจรปิดแบบโดม (Dome Camera)',
    alt: 'กล้องวงจรปิดแบบโดมติดอยู่ใต้เพดาน มีฐานทรงกระบอกสีครีมยึดกับเพดานและโดมใสทรงครึ่งวงกลมครอบเลนส์อยู่ด้านล่าง',
    labels: [
      { x: 62, y: 78, text: 'โดมใสครอบเลนส์ กันฝุ่นและกันการปัดกล้อง' },
      { x: 70, y: 42, text: 'ฐานยึดกับเพดาน' }
    ],
    credit: { source: 'commons', file: 'File:CCTV dome camera subway Rotterdam.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'laptop-cable-lock': {
    file: 'laptop-cable-lock.jpg', w: 1152, h: 864,
    title: 'สายล็อกโน้ตบุ๊ก (Cable Lock)',
    alt: 'หัวล็อกโลหะทรงกระบอกเสียบอยู่ในช่องล็อกด้านข้างของโน้ตบุ๊กสีเงิน ต่อกับสายสลิงเหล็กถักที่ใช้คล้องกับโต๊ะ',
    labels: [
      { x: 30, y: 66, text: 'หัวล็อกเสียบเข้าช่องล็อกของเครื่อง ไขด้วยกุญแจ' },
      { x: 15, y: 15, text: 'สายสลิงเหล็ก คล้องกับโต๊ะหรือขาโต๊ะ' }
    ],
    credit: { source: 'commons', file: 'File:Kensington-lock-connected.jpg' }, changes: 'ย่อขนาด'
  },
  'nas-4bay': {
    file: 'nas-4bay.jpg', w: 1380, h: 1600,
    title: 'อุปกรณ์จัดเก็บข้อมูลบนเครือข่าย (NAS)',
    alt: 'อุปกรณ์ NAS ตัวเครื่องสีดำ ด้านหน้ามีถาดฮาร์ดดิสก์ 4 ถาดติดป้าย HD1 ถึง HD4 ด้านล่างมีไฟสถานะพอร์ต LAN 2 พอร์ตและไฟสถานะดิสก์กับระบบติดสีเขียว',
    labels: [
      { x: 31, y: 30, text: 'ถาดใส่ฮาร์ดดิสก์ 4 ลูก (HD1 ถึง HD4)' },
      { x: 48, y: 86, text: 'ไฟสถานะพอร์ต LAN: ต่อเครือข่ายแทนการเสียบตรงกับคอมพิวเตอร์' },
      { x: 70, y: 86, text: 'ไฟสถานะดิสก์ การแจ้งเตือน และระบบ' }
    ],
    credit: { source: 'commons', file: 'File:Intel NAS.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'external-hdd-usb': {
    file: 'external-hdd-usb.jpg', w: 1600, h: 1057,
    title: 'ฮาร์ดดิสก์ภายนอก (External HDD)',
    alt: 'ฮาร์ดดิสก์ภายนอกแบบพกพาสีดำวางบนโต๊ะไม้ ต่อกับสาย USB โดยปลายสายอีกด้านเป็นหัว USB สำหรับเสียบคอมพิวเตอร์',
    labels: [
      { x: 34, y: 46, text: 'ตัวฮาร์ดดิสก์ภายนอก ขนาดพกพา' },
      { x: 49, y: 7, text: 'หัว USB เสียบคอมพิวเตอร์' },
      { x: 72, y: 33, text: 'ขั้วต่อสายที่ตัวไดรฟ์ ถอดสายออกได้เมื่อสำรองเสร็จ' }
    ],
    credit: { source: 'commons', file: 'File:Toshiba 1 TB External USB Hard Drive.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'firewall-appliance-asa': {
    file: 'firewall-appliance-asa.jpg', w: 1600, h: 1001,
    title: 'ไฟร์วอลล์แบบฮาร์ดแวร์ Cisco ASA 5510',
    alt: 'ด้านหลังของไฟร์วอลล์แบบฮาร์ดแวร์ Cisco ASA 5510 ที่ติดตั้งในตู้ Rack มีพอร์ต Console และ AUX ช่องการ์ด Flash และมีสาย LAN สีน้ำเงินกับสีเขียวเสียบอยู่ ด้านล่างเป็นเราเตอร์อีกเครื่อง',
    labels: [
      { x: 80, y: 33, text: 'พอร์ต Console สำหรับตั้งค่าครั้งแรก' },
      { x: 24, y: 74, text: 'สาย LAN ต่อเข้าพอร์ตเครือข่ายฝั่งต่าง ๆ' }
    ],
    credit: { source: 'commons', file: 'File:Cisco ASA 5510.jpg' }, changes: 'ครอปและย่อขนาด'
  }
};
