'use strict';
/* NetLab 2.16 real photos, placements of batch b (helper A2): weeks 5 and 13. Runs after a.js-d.js, so anchors can
   name the drawings those files place (utp-anatomy, crimp-tools, crimp-steps). Photos: content/photos.d/b.js.
   Order matters: a kept part of a drawing (rj45-plug-views, cable-path-strip) is placed after the drawing first,
   then the drawing is replaced by the photos, so the result reads photos -> kept drawing. */
module.exports = [
  // w5 s1: UTP cable, PHOTO+KEEP (the drawing keeps the cross-sections, shield types and the category table)
  { lesson: 'w5', section: 's1', anchor: { type: 'diagram', match: 'utp-anatomy' }, mode: 'before',
    block: { type: 'photo', name: 'photo-utp-cable', photos: ['cat6-pairs-ripcord', 'cat6-cross-section'], layout: 'grid',
      caption: 'สาย UTP ของจริงเมื่อปอกเปลือกนอกออก จะเห็นสายทองแดง 4 คู่ แต่ละคู่บิดเกลียวด้วยระยะต่างกัน และมีเชือกไนลอนไว้ช่วยฉีกเปลือก ภาพหน้าตัดของสาย Cat6 แสดงแกนกากบาท (Cross spline) ที่แยกคู่สายออกจากกันเพื่อลด Crosstalk' } },

  // w5 s1: crimp-tools -> real photos of the tools, keep only the plug front/side views as a new drawing
  { lesson: 'w5', section: 's1', anchor: { type: 'diagram', match: 'crimp-tools' }, mode: 'after',
    block: { type: 'diagram', name: 'rj45-plug-views', caption: 'วิธีจับหัว RJ-45 ให้หน้าสัมผัสทองแดงหันขึ้น ตัวล็อกคว่ำลง สายเข้าหาตัว ขา 1 จะอยู่ซ้ายสุด ภาพด้านข้างแสดงตัวกดล็อกภายในหัวที่ต้องกดทับเปลือกนอกของสาย' } },
  { lesson: 'w5', section: 's1', anchor: { type: 'diagram', match: 'crimp-tools' }, mode: 'replace',
    block: { type: 'photo', name: 'photo-crimp-tools', photos: ['crimper-rj45', 'lan-tester-master-remote', 'rj45-plug-t568b'], layout: 'grid',
      caption: 'เครื่องมือเข้าหัวสายของจริง คีมย้ำหัวมีช่องย้ำหลายขนาด หัว RJ-45 ต้องใส่ช่อง 8P และคีมรุ่นนี้มีใบมีดปอกเปลือกในตัว LAN Tester มีตัวแม่และตัวลูกที่มีไฟ 1 ถึง 8 และ G ส่วนหัว RJ-45 ที่เข้าหัวเสร็จแล้วมีปลอกหุ้มหัว (Boot) ครอบโคนหัวไว้' } },

  // w5 s2: patch panel, keystone jack and wall plate named in the T568A/B tip
  { lesson: 'w5', section: 's2', anchor: { type: 'note', match: 'แผงกระจายสาย (Patch Panel)' }, mode: 'after',
    block: { type: 'photo', name: 'photo-jacks-panels', photos: ['keystone-jack-rj45', 'wall-plate-rj45-labelled', 'rack-small-network'], layout: 'grid',
      caption: 'ปลายสายถาวรไม่ได้เข้าหัว RJ-45 แต่กดลงขั้วของ Keystone Jack ที่เต้ารับและด้านหลัง Patch Panel แถบรหัสสีบน Keystone Jack บอกตำแหน่งสายของแต่ละมาตรฐาน ต้องเลือกแบบเดียวกันทั้งอาคาร เช่น T568B ทั้งที่เต้ารับและ Patch Panel' } },

  // w5 s3: pinout-viewer widget, PHOTO+KEEP with a real T568B plug
  { lesson: 'w5', section: 's3', anchor: { type: 'widget', match: 'pinout-viewer' }, mode: 'after',
    block: { type: 'photo', name: 'photo-t568b-plug', photos: ['rj45-plug-t568b'], layout: 'single',
      caption: 'หัว RJ-45 ของจริงที่เข้าสายแบบ T568B มองจากด้านหน้าสัมผัส ไล่จากขา 1 ถึงขา 8 จะเห็นสี ขาวส้ม ส้ม ขาวเขียว น้ำเงิน ขาวน้ำเงิน เขียว ขาวน้ำตาล น้ำตาล ตรงกับตารางและตัวจำลองด้านบน' } },

  // w5 s4: crimp-steps widget, PHOTO+KEEP with the real step photos that exist
  { lesson: 'w5', section: 's4', anchor: { type: 'widget', match: 'crimp-steps' }, mode: 'after',
    block: { type: 'photo', name: 'photo-crimp-steps', photos: ['utp-step-stripped', 'utp-step-untwisted', 'utp-step-inserted', 'lan-tester-master-remote'], layout: 'grid',
      caption: 'ภาพจริงของขั้นตอนเข้าหัว ปอกเปลือกนอก คลายเกลียวและรีดสายให้ตรง สอดสายที่เรียงสีแบบ T568B เข้าหัวจนปลายสายชนสุดและเปลือกนอกเข้าไปใต้ตัวกดล็อก แล้วจึงย้ำหัวและทดสอบด้วย LAN Tester' } },

  // w5 s5: patch cord and PoE device named in the text
  { lesson: 'w5', section: 's5', anchor: { type: 'note', match: '(PoE)' }, mode: 'after',
    block: { type: 'photo', name: 'photo-patchcord-poe', photos: ['patch-cord-rj45', 'poe-injector'], layout: 'grid',
      caption: 'Patch Cord คือสายสั้นที่เข้าหัวสำเร็จจากโรงงาน ใช้สายฝอยจึงขยับได้บ่อย PoE Injector รับข้อมูลจาก Switch ทางช่อง Data In แล้วส่งทั้งข้อมูลและไฟออกทางช่อง Data & Power Out ไปยังอุปกรณ์ เช่น Access Point หรือกล้อง IP' } },

  // w13 s2: wall outlet, patch cord and cable labels
  { lesson: 'w13', section: 's2', anchor: { type: 'list', match: 'ติดป้ายหมายเลขที่ปลายสาย' }, mode: 'after',
    block: { type: 'photo', name: 'photo-outlet-labels', photos: ['wall-plate-rj45-labelled', 'patch-cord-rj45'], layout: 'grid',
      caption: 'เต้ารับแลนบนผนังที่ติดป้ายหมายเลขทุกช่อง เช่น 3/7 ถึง 3/12 ช่างใช้หมายเลขนี้หาพอร์ตที่ตรงกันบน Patch Panel ได้ทันที ส่วน Patch Cord ใช้ต่อจากเต้ารับเข้าเครื่องและจาก Patch Panel เข้า Switch' } },

  // w13 s3: rack-layout -> real rack photo, keep only the cable-path strip
  { lesson: 'w13', section: 's3', anchor: { type: 'diagram', match: 'rack-layout' }, mode: 'after',
    block: { type: 'diagram', name: 'cable-path-strip', caption: 'เส้นทางสายจากโต๊ะถึง Switch: สายถาวรจากเต้ารับถึงด้านหลัง Patch Panel ไม่เกิน 90 m และเมื่อรวมสายพ่วงทั้งสองฝั่งแล้วทั้งช่องสัญญาณไม่เกิน 100 m' } },
  { lesson: 'w13', section: 's3', anchor: { type: 'diagram', match: 'rack-layout' }, mode: 'replace',
    block: { type: 'photo', name: 'photo-rack', photos: ['rack-small-network', 'ups-small-office', 'pdu-rack'], layout: 'grid',
      caption: 'ตู้ Rack ของจริงจัด Patch Panel ไว้ด้านบนสลับกับรางจัดสาย (Cable Manager) แล้วตามด้วย Switch สาย Patch Cord จึงสั้นและเป็นระเบียบ สังเกตป้ายชื่อพอร์ตบน Patch Panel เราเตอร์วางบนถาดด้านล่าง ส่วนอุปกรณ์หนักอย่าง UPS ควรวางไว้ล่างสุดของตู้ (ภาพที่สองเป็น UPS แบบตั้งโต๊ะสำหรับสำนักงานขนาดเล็ก ในตู้ Rack จะใช้ UPS แบบติดตู้) ภาพที่สามคือรางปลั๊กไฟ (PDU) ที่ติดในตู้เพื่อจ่ายไฟให้ทุกอุปกรณ์ โดยรับไฟต่อจาก UPS' } }
];
