'use strict';
/* NetLab 2.16 real photos, placements batch d (helper C2): weeks 10, 14, 15 and 16.
   Photo entries: content/photos.d/d.js. All are new photos placed after the block whose text names the device;
   no drawing is replaced. */
module.exports = [
  {
    lesson: 'w10', section: 's2', anchor: { type: 'note', match: 'พาวเวอร์ซัพพลายสำรอง' }, mode: 'after',
    block: { type: 'photo', name: 'photo-rack-server', photos: ['rack-server-front'], layout: 'single',
      caption: 'เซิร์ฟเวอร์จริงในองค์กรมักเป็นแบบติดตั้งในตู้ Rack (Rack Server) ความสูงนับเป็นหน่วย U สังเกตว่าหน้าเครื่องเต็มไปด้วยถาดฮาร์ดดิสก์ที่ดึงออกได้ทีละลูก ใช้กับ RAID เมื่อดิสก์ลูกหนึ่งเสียก็ถอดเปลี่ยนได้โดยไม่ต้องปิดเครื่อง ต่างจากคอมพิวเตอร์ตั้งโต๊ะที่ต้องปิดเครื่องและเปิดฝาก่อน' }
  },
  {
    lesson: 'w10', section: 'x4', anchor: { type: 'example', match: 'เครื่องบันทึกกล้องวงจรปิด (NVR)' }, mode: 'after',
    block: { type: 'photo', name: 'photo-nvr-ip-cameras', photos: ['nvr-ip-cameras'], layout: 'single',
      caption: 'NVR คือคอมพิวเตอร์ขนาดเล็กที่มีฮาร์ดดิสก์ไว้บันทึกภาพ ส่วนกล้อง IP แต่ละตัวเป็นอุปกรณ์เครือข่ายที่มี IP ของตัวเอง มักต่อเข้าสวิตช์ PoE ด้วยสาย LAN เส้นเดียวที่ส่งทั้งไฟและข้อมูล ทุกตัวจึงอยู่ใน LAN วงเดียวกับเครื่อง POS และใช้ PAT ออกอินเทอร์เน็ต ถ้าจะดูภาพจากนอกร้านต้องทำ Port Forwarding ไปที่ IP ของ NVR' }
  },
  {
    lesson: 'w14', section: 's1', anchor: { type: 'table', match: 'อาการที่สังเกตได้' }, mode: 'after',
    block: { type: 'photo', name: 'photo-link-led', photos: ['poe-switch-link-led'], layout: 'single',
      caption: 'ตรวจชั้น Physical ด้วยตาก่อนเสมอ พอร์ตที่เสียบสายและเชื่อมต่อได้จะมีไฟ Link ติด ส่วนพอร์ตที่ไม่มีสายไฟดับ ถ้าเสียบสายแล้วไฟยังดับ ให้สงสัยสาย หัว RJ-45 หรือพอร์ตก่อนไปตรวจ IP หรือ DNS การ์ดแลนในเครื่องก็มีไฟลักษณะนี้ข้างช่องเสียบ' }
  },
  {
    lesson: 'w15', section: 's1', anchor: { type: 'p', match: 'ติดตั้ง UPS' }, mode: 'after',
    block: { type: 'photo', name: 'photo-ups-w15', photos: ['ups-front-leds'], layout: 'single',
      caption: 'เครื่องสำรองไฟ (UPS) ป้องกันภัยทางกายภาพจากไฟดับกะทันหันและไฟตก สังเกตไฟ On Battery ที่ติดเมื่อไฟบ้านดับ เป็นสัญญาณว่าต้องบันทึกงานและปิดเครื่องอย่างถูกวิธีก่อนแบตเตอรี่หมด' }
  },
  {
    lesson: 'w16', section: 's1', anchor: { type: 'list', match: 'ตู้ Rack ที่ล็อกได้' }, mode: 'after',
    block: { type: 'photo', name: 'photo-physical-security', photos: ['server-cabinet-doors', 'ups-front-leds', 'cctv-dome-camera', 'laptop-cable-lock'], layout: 'grid',
      caption: 'อุปกรณ์ป้องกันทางกายภาพของจริง: ตู้ Rack มีประตูที่ล็อกกุญแจได้ เมื่อล็อกแล้วจึงไม่มีใครเอื้อมไปถอดสายหรือยกอุปกรณ์ออกได้ UPS บอกสถานะด้วยไฟหน้าเครื่อง กล้องวงจรปิดแบบโดมติดเพดานเพื่อบันทึกว่าใครเข้าออก และสายล็อกโน้ตบุ๊กคล้องเครื่องไว้กับโต๊ะในพื้นที่สาธารณะ' }
  },
  {
    lesson: 'w16', section: 's4', anchor: { type: 'list', match: 'NAS หรือฮาร์ดดิสก์ภายนอก' }, mode: 'after',
    block: { type: 'photo', name: 'photo-backup-media', photos: ['nas-4bay', 'external-hdd-usb'], layout: 'grid',
      caption: 'สื่อสำรองข้อมูล 2 ชนิดที่ต่างกัน: NAS ต่อกับเครือข่ายตลอดเวลาและมีดิสก์หลายลูก เหมาะสำรองอัตโนมัติทุกคืน ส่วนฮาร์ดดิสก์ภายนอกเสียบ USB เฉพาะตอนสำรอง แล้วถอดเก็บได้ จึงใช้เป็นชุด Offline ที่แรนซัมแวร์มองไม่เห็น หรือนำไปเก็บนอกสถานที่ได้' }
  },
  {
    lesson: 'w16', section: 's5', anchor: { type: 'table', match: 'ไฟร์วอลล์แบบฮาร์ดแวร์' }, mode: 'after',
    block: { type: 'photo', name: 'photo-hardware-firewall', photos: ['firewall-appliance-asa'], layout: 'single',
      caption: 'ไฟร์วอลล์แบบฮาร์ดแวร์เป็นอุปกรณ์แยกต่างหาก ติดตั้งในตู้ Rack ตรงขอบเครือข่าย สายจากฝั่งอินเทอร์เน็ตและฝั่ง LAN ต่อเข้าคนละพอร์ต ข้อมูลทุกแพ็กเก็ตจึงต้องผ่านกฎของไฟร์วอลล์ก่อน และตั้งค่าครั้งแรกผ่านพอร์ต Console เหมือนเราเตอร์และสวิตช์' }
  }
];
