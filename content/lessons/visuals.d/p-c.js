'use strict';
/* NetLab 2.16 real photos, batch c (helper C1): placements for weeks 1, 3, 6, 7, 8 and 9.
   Photo entries: content/photos.d/c.js. Every block here is added next to text that names the device;
   no drawing is replaced. */
module.exports = [
  {
    lesson: 'w1', section: 's2', anchor: { type: 'p', match: 'อย่าสับสนกับ "อุปกรณ์และส่วนประกอบของระบบเครือข่าย"' }, mode: 'after',
    block: { type: 'photo', name: 'photo-w1-network-hardware', photos: ['nic-pcie-intel', 'switch-8port-hp', 'router-archer-rear', 'ap-ceiling-unifi'], layout: 'grid',
      caption: 'ฮาร์ดแวร์เครือข่ายของจริงที่ต้องซื้อและติดตั้ง: การ์ดเครือข่าย (NIC) มีช่อง RJ-45 ไว้เสียบสาย LAN, Switch มีพอร์ตหลายพอร์ตให้เครื่องในห้องต่อเข้าหากัน, Router มีพอร์ต WAN แยกสีไว้ต่อออกอินเทอร์เน็ต และ Access Point ทรงจานติดเพดานกระจาย Wi-Fi ให้เครื่องไร้สาย' }
  },
  {
    lesson: 'w3', section: 's6', anchor: { type: 'p', match: 'ความแตกต่างสำคัญระหว่าง 802.3 กับ 802.11' }, mode: 'after',
    block: { type: 'photo', name: 'photo-w3-8023-80211-cards', photos: ['nic-pcie-intel', 'wifi-card-m2'], layout: 'grid',
      caption: 'มาตรฐานต่างกันจึงเห็นได้จากตัวการ์ด: การ์ด Ethernet ตามมาตรฐาน IEEE 802.3 มีช่อง RJ-45 ไว้เสียบสาย ส่วนการ์ด Wi-Fi ตามมาตรฐาน IEEE 802.11 ไม่มีช่องเสียบสาย LAN แต่มีขั้วต่อสายอากาศแทน เพราะส่งข้อมูลผ่านคลื่นวิทยุ' }
  },
  {
    lesson: 'w6', section: 's4', anchor: { type: 'list', match: 'Mesh Wi-Fi: ชุดอุปกรณ์หลายตัว' }, mode: 'after',
    block: { type: 'photo', name: 'photo-w6-wireless-devices', photos: ['usb-wifi-stick-open', 'wifi-card-m2', 'router-archer-rear', 'ap-ceiling-unifi', 'range-extender-wall', 'sim-router-4g-rear', 'mesh-node-deco'], layout: 'grid',
      caption: 'อุปกรณ์ไร้สายของจริง: Wi-Fi Adapter แบบ USB และการ์ด M.2 อยู่ฝั่งเครื่องผู้ใช้, Wi-Fi Router มีพอร์ต WAN แยกจากพอร์ต LAN และมีเสาอากาศ, Access Point ติดเพดานรับไฟผ่านสาย LAN ด้วยอแดปเตอร์ PoE, Repeater เสียบเต้ารับไฟได้เลยโดยไม่ต้องเดินสาย, SIM Router มีช่องใส่ซิมการ์ดและขั้วต่อเสาอากาศ 4G แทนพอร์ต WAN และ Mesh Wi-Fi มาเป็นชุด 2 ถึง 3 ตัวหน้าตาเหมือนกัน (ภาพนี้คือ 1 ตัว) ส่วนเสาอากาศของ Wireless Bridge ดูในหัวข้อถัดไป' }
  },
  {
    lesson: 'w6', section: 's5', anchor: { type: 'table', match: 'ชนิดเสาอากาศ' }, mode: 'after',
    block: { type: 'photo', name: 'photo-w6-antenna-types', photos: ['antenna-omni-router', 'wireless-link-grid-dish', 'antenna-yagi-mast', 'antenna-dish-tower'], layout: 'grid',
      caption: 'สังเกตรูปทรงเสาเทียบกับทิศที่คลื่นออกไป: เสาแท่งตั้งตรงบน Router เป็นแบบรอบทิศทาง (Omni), เสาแผงยาวแบบ Sector ครอบคลุมเป็นมุมกว้างด้านหน้า, เสาจานตะแกรงและเสา Yagi ที่มีก้านเรียงบนแกนยาวต้องหันเล็งไปยังปลายทาง ส่วนจานสะท้อน (Dish) บนเสาสื่อสารหันคนละทิศเพราะแต่ละจานเป็นลิงก์จุดต่อจุดกับเสาคนละแห่ง (เสา Yagi ในภาพใช้กับคลื่นวิทยุสมัครเล่น แต่หลักการแบบทิศทางเหมือนกับ Yagi สำหรับ Wi-Fi)' }
  },
  {
    lesson: 'w7', section: 's5', anchor: { type: 'term', match: 'WPS (Wi-Fi Protected Setup)' }, mode: 'after',
    block: { type: 'photo', name: 'photo-w7-wps-button', photos: ['wps-button-router', 'range-extender-wall'], layout: 'grid',
      caption: 'ปุ่ม WPS แบบกด (Push button) มักมีสัญลักษณ์ลูกศรวนสองลูกศร อยู่ด้านหลัง Router หรือด้านหน้า Repeater การกดปุ่มนี้ไม่ต้องใช้รหัส แต่ฟังก์ชัน WPS แบบ PIN ที่อยู่ในหน้าตั้งค่าคือจุดที่มีช่องโหว่ จึงควรปิด WPS ในหน้าตั้งค่าเมื่อไม่ได้ใช้' }
  },
  {
    lesson: 'w7', section: 's6', anchor: { type: 'note', match: 'ถ้าลืมต้องกดปุ่ม Reset' }, mode: 'after',
    block: { type: 'photo', name: 'photo-w7-reset-button', photos: ['sim-router-4g-rear'], layout: 'single',
      caption: 'ปุ่ม Reset (หมายเลข 4) เป็นรูเล็กที่มีคำว่า RESET กำกับ ต้องใช้ปลายคลิปหนีบกระดาษกดค้างไว้ตามเวลาที่คู่มือของรุ่นนั้นกำหนด Router จะล้างทุกค่ากลับเป็นค่าโรงงาน รวมถึงรหัสผู้ดูแลและรหัส Wi-Fi จึงต้องตั้งค่าความปลอดภัยใหม่ทั้งหมด' }
  },
  {
    lesson: 'w8', section: 's5', anchor: { type: 'p', match: 'แสดงค่าโดยย่อของการ์ดเครือข่ายแต่ละตัว' }, mode: 'after',
    block: { type: 'photo', name: 'photo-w8-network-adapters', photos: ['nic-pcie-intel', 'usb-wifi-stick-open'], layout: 'grid',
      caption: 'เครื่องหนึ่งมีการ์ดเครือข่ายได้หลายตัว เช่น การ์ด Ethernet ในเครื่องและ Wi-Fi Adapter แบบ USB ผลของ ipconfig จึงแยกเป็นหัวข้อ Ethernet adapter และ Wireless LAN adapter และแต่ละการ์ดมี Physical Address (MAC) ของตัวเอง สังเกตช่อง MAC บนสติกเกอร์ของ Adapter (ในภาพปิดไว้)' }
  },
  {
    lesson: 'w9', section: 's5', anchor: { type: 'p', match: 'ถ้าเครื่องพิมพ์มีพอร์ต LAN หรือ Wi-Fi ในตัว' }, mode: 'after',
    block: { type: 'photo', name: 'photo-w9-network-printer', photos: ['printer-network-ports'], layout: 'single',
      caption: 'เครื่องพิมพ์ที่มีพอร์ต LAN ในตัว (หมายเลข 2) ต่อสายเข้า Switch ได้โดยตรง เมื่อไฟ Link ติดและตั้ง IP คงที่แล้ว ทุกเครื่องเพิ่มเครื่องพิมพ์ด้วย IP ได้เลยโดยไม่ต้องพึ่งคอมพิวเตอร์ที่เปิดแชร์ไว้ ส่วนเครื่องพิมพ์ที่มีแค่ช่อง USB ต้องต่อกับคอมพิวเตอร์แล้วแชร์ผ่านเครื่องนั้น' }
  }
];
