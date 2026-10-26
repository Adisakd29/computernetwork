'use strict';
/* NetLab 2.16 real photos, batch b (helper A2): UTP cable, crimping tools, RJ-45 plug, LAN tester (w5) and the network rack (w13).
   Same entry format as content/photos.js. Commons author/license are filled later by scripts/photo-credits.js. */
module.exports = {
  'pdu-rack': {
    file: 'pdu-rack.jpg', w: 1600, h: 1215,
    title: 'รางปลั๊กไฟสำหรับตู้ Rack (PDU: Power Distribution Unit)',
    alt: 'รางปลั๊กไฟสำหรับตู้ Rack หลายแถววางซ้อนกัน มีเต้ารับแบบ IEC C13 และ C19 เต้ารับแบบบ้าน เบรกเกอร์ และหน้าจอแสดงค่ากระแสไฟ',
    labels: [
      { x: 29, y: 32, text: 'เต้ารับ IEC C13 สำหรับสายไฟของ Switch, Router และ Server ทั่วไป' },
      { x: 38.5, y: 32, text: 'เต้ารับ IEC C19 สำหรับอุปกรณ์ที่กินไฟสูง' },
      { x: 43, y: 82, text: 'เบรกเกอร์ (Circuit Breaker) ตัดไฟเมื่อใช้กระแสเกิน' },
      { x: 78.5, y: 80, text: 'จอแสดงค่ากระแสไฟที่ใช้อยู่ (PDU แบบวัดค่าได้)' }
    ],
    credit: { source: 'commons', file: 'File:PDU.jpg' },
    changes: 'ย่อขนาด'
  },
  'crimper-rj45': {
    file: 'crimper-rj45.jpg', w: 1600, h: 597,
    title: 'คีมย้ำหัว (Crimping Tool)',
    alt: 'คีมย้ำหัวด้ามสีแดง ปลายคีมมีช่องย้ำสามขนาด 4P 8P และ 6P ตรงกลางมีใบมีดปอกเปลือกสาย',
    labels: [
      { x: 12, y: 36, text: 'ช่องย้ำ 4P (หัวขนาดเล็ก)' },
      { x: 13, y: 50, text: 'ช่องย้ำ 8P สำหรับหัว RJ-45' },
      { x: 12, y: 68, text: 'ช่องย้ำ 6P สำหรับหัว RJ-11' },
      { x: 45, y: 49, text: 'ใบมีดปอกเปลือกสาย (Stripper)' },
      { x: 80, y: 22, text: 'ด้ามคีม บีบให้สุดจนคีมคลายเอง' }
    ],
    credit: { source: 'commons', file: 'File:Crimpzange RJ45 - RJ11 - RJ12 - IMGP1079.JPG' },
    changes: 'ครอป ย่อขนาด และเบลอสติกเกอร์ชื่อบนคีม'
  },
  'cat6-pairs-ripcord': {
    file: 'cat6-pairs-ripcord.jpg', w: 1600, h: 1226,
    title: 'สาย UTP ที่ปอกเปลือกนอกออกแล้ว',
    alt: 'ปลายสาย UTP เปลือกสีเหลืองที่ปอกออก เห็นคู่สายบิดเกลียวสีส้ม เขียว น้ำเงิน น้ำตาล และเชือกไนลอนสีขาวตรงกลาง',
    labels: [
      { x: 52, y: 90, text: 'เปลือกนอก (Jacket)' },
      { x: 56, y: 42, text: 'เชือกไนลอนสำหรับฉีกเปลือก (Rip cord)' },
      { x: 66, y: 28, text: 'คู่สีส้ม: เส้นส้มบิดกับเส้นขาวส้ม' },
      { x: 22, y: 48, text: 'คู่สีน้ำตาล: ระยะบิดต่างจากคู่อื่น' }
    ],
    credit: { source: 'commons', file: 'File:CAT6 twisted pair.JPG' },
    changes: 'ครอปและย่อขนาด'
  },
  'cat6-cross-section': {
    file: 'cat6-cross-section.jpg', w: 1600, h: 1594,
    title: 'ภาคตัดขวางสาย Cat6',
    alt: 'ภาพขยายหน้าตัดสาย Cat6 เปลือกสีเหลือง ภายในมีสายทองแดงหุ้มฉนวน 8 เส้น แยกเป็นสี่ช่องด้วยแกนพลาสติกรูปกากบาท',
    labels: [
      { x: 50, y: 50, text: 'แกนกากบาท (Cross spline) แยกคู่สาย' },
      { x: 9, y: 55, text: 'เปลือกนอก (Jacket)' },
      { x: 27, y: 64, text: 'ทองแดงหุ้มฉนวนสี 1 เส้นใน 8 เส้น' }
    ],
    credit: { source: 'commons', file: 'File:Cross section of a Cat6 patch cable.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'lan-tester-master-remote': {
    file: 'lan-tester-master-remote.jpg', w: 1380, h: 1403,
    title: 'เครื่องทดสอบสาย (LAN Tester)',
    alt: 'เครื่องทดสอบสายแลนสีขาวหน้าแผงสีเขียวสองชิ้น ตัวแม่ (Master) ทางซ้ายและตัวลูก (Remote) ทางขวา แต่ละตัวมีไฟ LED 1 ถึง 8 และ G',
    labels: [
      { x: 15, y: 72, text: 'ตัวแม่ (Master) มีสวิตช์และแบตเตอรี่' },
      { x: 82, y: 84, text: 'ตัวลูก (Remote) เสียบอีกปลายสาย' },
      { x: 40, y: 42, text: 'ไฟ 1 ถึง 8 และ G วิ่งทีละดวง' }
    ],
    credit: { source: 'commons', file: 'File:Cable tester SY-468.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'rj45-plug-t568b': {
    file: 'rj45-plug-t568b.jpg', w: 1600, h: 592,
    title: 'หัว RJ-45 ที่เข้าสายแบบ T568B',
    alt: 'หัว RJ-45 ใสมองจากด้านหน้าสัมผัส เห็นสายเรียงจากบนลงล่าง ขาวส้ม ส้ม ขาวเขียว น้ำเงิน ขาวน้ำเงิน เขียว ขาวน้ำตาล น้ำตาล',
    labels: [
      { x: 82, y: 30, text: 'ขา 1 ขาวส้ม' },
      { x: 82, y: 75, text: 'ขา 8 น้ำตาล' },
      { x: 20, y: 50, text: 'ปลอกหุ้มหัว (Boot)' },
      { x: 94, y: 50, text: 'หน้าสัมผัสทองแดง 8 ขา' }
    ],
    credit: { source: 'commons', file: 'File:Stecker RJ45 568B.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'utp-step-stripped': {
    file: 'utp-step-stripped.jpg', w: 1236, h: 1600,
    title: 'ปอกเปลือกนอกแล้ว คู่สายยังบิดเกลียว',
    alt: 'ปลายสาย UTP ที่ปอกเปลือกนอกออกแล้ว เห็นคู่สายสีส้ม เขียว น้ำเงิน และน้ำตาลยังบิดเกลียวอยู่',
    labels: [],
    credit: { source: 'commons', file: 'File:Utp diy02 sequenceInCable.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'utp-step-untwisted': {
    file: 'utp-step-untwisted.jpg', w: 1320, h: 1600,
    title: 'คลายเกลียวและรีดสายให้ตรง',
    alt: 'สาย UTP ที่คลายเกลียวแต่ละคู่ออกแล้ว สายแปดเส้นถูกรีดเป็นเส้นตรง ยังอยู่เป็นคู่ตามสี ก่อนนำไปเรียงตาม T568B',
    labels: [],
    credit: { source: 'commons', file: 'File:Utp diy02 untwist.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'utp-step-inserted': {
    file: 'utp-step-inserted.jpg', w: 990, h: 648,
    title: 'สอดสายเข้าหัว RJ-45 จนสุด',
    alt: 'หัว RJ-45 ใสที่สอดสายเข้าไปจนสุด สายแปดเส้นชนปลายหัว เรียงสีแบบ T568B และเปลือกนอกเข้าไปอยู่ในหัว',
    labels: [
      { x: 62, y: 28, text: 'ขา 1 ขาวส้ม ตามแบบ T568B' },
      { x: 22, y: 48, text: 'เปลือกนอกเข้าไปอยู่ใต้ตัวกดล็อก' },
      { x: 73, y: 65, text: 'ปลายสายชนสุดใต้หน้าสัมผัส' }
    ],
    credit: { source: 'commons', file: 'File:Utp diy07 rj45.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'rack-small-network': {
    file: 'rack-small-network.jpg', w: 1076, h: 883,
    title: 'ตู้ Rack เครือข่ายขนาดเล็ก',
    alt: 'ภายในตู้ Rack 19 นิ้ว ด้านบนมี Patch Panel สามแถวสลับกับรางจัดสาย ตามด้วย Switch สองตัว และเราเตอร์วางบนถาดด้านล่าง',
    labels: [
      { x: 50, y: 13, text: 'Patch Panel' },
      { x: 50, y: 22, text: 'รางจัดสาย (Cable Manager)' },
      { x: 54, y: 47, text: 'ป้ายชื่อพอร์ตบน Patch Panel' },
      { x: 30, y: 61, text: 'Switch' },
      { x: 50, y: 90, text: 'Router วางบนถาด' }
    ],
    credit: { source: 'commons', file: 'File:19-inch rackmount Ethernet switches and patch panels.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'keystone-jack-rj45': {
    file: 'keystone-jack-rj45.jpg', w: 1229, h: 888,
    title: 'Keystone Jack (ตัวสีส้ม)',
    alt: 'โมดูล Keystone สองตัว ตัวสีส้มทางขวาเป็นเต้ารับ RJ-45 ด้านบนมีขั้วกดสายพร้อมแถบรหัสสี',
    labels: [
      { x: 80, y: 66, text: 'ช่องเสียบหัว RJ-45 ด้านหน้า' },
      { x: 67, y: 15, text: 'ขั้วกดสาย (IDC) ด้านหลัง' },
      { x: 77, y: 32, text: 'แถบรหัสสีบอกตำแหน่งสาย' }
    ],
    credit: { source: 'commons', file: 'File:Assortment of keystone modules.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'wall-plate-rj45-labelled': {
    file: 'wall-plate-rj45-labelled.jpg', w: 1546, h: 1031,
    title: 'เต้ารับแลนบนผนัง (Wall Plate)',
    alt: 'หน้ากากเต้ารับแลนบนผนังมีช่อง RJ-45 หกช่อง แต่ละช่องติดป้ายหมายเลข 3/7 ถึง 3/12',
    labels: [
      { x: 38, y: 32, text: 'เต้ารับ RJ-45 (Outlet)' },
      { x: 39, y: 81, text: 'ป้ายหมายเลขตรงกับพอร์ตบน Patch Panel' }
    ],
    credit: { source: 'commons', file: 'File:Australian Dual Socket Outlet and LAN Wall Plate.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'poe-injector': {
    file: 'poe-injector.jpg', w: 1348, h: 1394,
    title: 'ตัวจ่ายไฟผ่านสายแลน (PoE Injector)',
    alt: 'อุปกรณ์ PoE Injector สีดำ มีพอร์ต RJ-45 สองช่อง ช่อง Data In รับข้อมูล และช่อง Data & Power Out ส่งข้อมูลพร้อมไฟ',
    labels: [
      { x: 32, y: 58, text: 'Data In: สายจาก Switch' },
      { x: 55, y: 36, text: 'Data & Power Out: ไปยังอุปกรณ์ PoE' }
    ],
    credit: { source: 'commons', file: 'File:Power over Ethernet injector.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'patch-cord-rj45': {
    file: 'patch-cord-rj45.jpg', w: 1588, h: 1600,
    title: 'สายเชื่อมต่อ (Patch Cord)',
    alt: 'สาย Patch Cord สีแดงขดเป็นวง ปลายสายเป็นหัว RJ-45 พร้อมปลอกหุ้มหัวแบบขึ้นรูปจากโรงงาน',
    labels: [
      { x: 40, y: 45, text: 'ปลอกหุ้มหัว (Boot)' },
      { x: 40, y: 75, text: 'หัว RJ-45' }
    ],
    credit: { source: 'commons', file: 'File:Patch cable with RJ45 connector.jpg' },
    changes: 'ครอปและย่อขนาด'
  },
  'ups-small-office': {
    file: 'ups-small-office.jpg', w: 688, h: 1368,
    title: 'เครื่องสำรองไฟ (UPS) ขนาดเล็ก',
    alt: 'เครื่องสำรองไฟ UPS สีขาวขนาดเล็ก ด้านหน้ามีไฟแสดงสถานะ Power on, On Battery, Overload, Replace Battery และปุ่มเปิดปิด',
    labels: [
      { x: 52, y: 44, text: 'ไฟสถานะ เช่น On Battery เมื่อไฟดับ' },
      { x: 50, y: 60, text: 'ปุ่มเปิดปิด' }
    ],
    credit: { source: 'commons', file: 'File:Apc ups rs500 01.jpg' },
    changes: 'ครอปและย่อขนาด'
  }
};
