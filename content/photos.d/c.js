'use strict';
/* NetLab 2.16 real photos, batch c (helper C1): devices named in lesson text for weeks 1, 3, 6, 7, 8 and 9.
   Placements: content/lessons/visuals.d/p-c.js */
module.exports = {
  'usb-wifi-stick-open': {
    file: 'usb-wifi-stick-open.jpg', w: 1316, h: 1600,
    title: 'Wi-Fi Adapter แบบ USB เมื่อแกะฝาออก',
    alt: 'อแดปเตอร์ Wi-Fi แบบเสียบพอร์ต USB ถูกแกะออกเป็นสามส่วน ด้านบนคือฝาครอบสีดำ ตรงกลางคือแผงวงจรสีเขียวที่มีชิปและหัว USB ด้านล่างคือฝาอีกด้านที่มีสติกเกอร์ซึ่งช่อง S/N และ MAC ถูกปิดไว้',
    labels: [
      { x: 60, y: 14, text: 'ฝาครอบพลาสติก' },
      { x: 12, y: 54, text: 'เสาอากาศแบบลายวงจรบนแผ่น PCB' },
      { x: 32, y: 51, text: 'ชิปรับส่งสัญญาณ Wi-Fi' },
      { x: 85, y: 50, text: 'หัว USB เสียบเข้าคอมพิวเตอร์' }
    ],
    credit: { source: 'commons', file: 'File:US54SE wireless usb stick.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'wifi-card-m2': {
    file: 'wifi-card-m2.jpg', w: 819, h: 1600,
    title: 'การ์ด Wi-Fi แบบ M.2 สำหรับติดตั้งในเครื่อง',
    alt: 'การ์ด Wi-Fi ขนาดเล็กแบบ M.2 แผ่นสีเขียวมีฝาโลหะปิดชิป ด้านบนมีขั้วต่อสายอากาศกลมเล็กสองจุด และด้านล่างเป็นขาทองแดงเรียงกันสำหรับเสียบเข้าช่อง M.2 บนเมนบอร์ดหรือโน้ตบุ๊ก',
    labels: [
      { x: 72, y: 8, text: 'ขั้วต่อสายอากาศ 2 จุด (Main และ Aux)' },
      { x: 30, y: 94, text: 'ขาเสียบช่อง M.2 บนเมนบอร์ด' }
    ],
    credit: { source: 'commons', file: 'File:M.2 1630 and M.2 2230 WiFi cards side by side.jpg' }, changes: 'ครอปเฉพาะการ์ดด้านขวาและย่อขนาด'
  },
  'router-archer-rear': {
    file: 'router-archer-rear.jpg', w: 1600, h: 1563,
    title: 'Wi-Fi Router ด้านหลัง',
    alt: 'ด้านหลังของ Wi-Fi Router สีดำที่มีเสาอากาศ 4 ต้น ด้านล่างเรียงจากซ้ายเป็นปุ่มเปิดปิด ช่องเสียบไฟ พอร์ต WAN สีน้ำเงิน 1 พอร์ต และพอร์ต LAN สีเหลือง 4 พอร์ต',
    labels: [
      { x: 9, y: 40, text: 'เสาอากาศส่วนที่เป็น Access Point' },
      { x: 22, y: 96, text: 'ช่องเสียบอแดปเตอร์ไฟ' },
      { x: 29, y: 82, text: 'พอร์ต WAN ต่อไปยังโมเด็มหรือ ONT ของผู้ให้บริการ' },
      { x: 51, y: 82, text: 'พอร์ต LAN 4 พอร์ต คือส่วนที่เป็น Switch' }
    ],
    credit: { source: 'commons', file: 'File:TP-Link Archer A6 Router (v4) - Back Side.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'ap-ceiling-unifi': {
    file: 'ap-ceiling-unifi.jpg', w: 1123, h: 1600,
    title: 'Access Point แบบติดเพดานพร้อมอแดปเตอร์ PoE',
    alt: 'Access Point ทรงจานกลมสีขาวสำหรับติดเพดานวางบนโต๊ะ ด้านบนมีอแดปเตอร์จ่ายไฟผ่านสาย LAN (PoE) กล่องสีดำ และสายไฟ AC ที่มาในกล่องเดียวกัน',
    labels: [
      { x: 55, y: 62, text: 'Access Point ทรงจานสำหรับติดเพดาน' },
      { x: 45, y: 20, text: 'อแดปเตอร์ PoE จ่ายไฟไปตามสาย LAN' },
      { x: 80, y: 25, text: 'สายไฟ AC ของอแดปเตอร์' }
    ],
    credit: { source: 'commons', file: 'File:Ubiquiti Unifi AP.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'range-extender-wall': {
    file: 'range-extender-wall.jpg', w: 1546, h: 1600,
    title: 'Wi-Fi Repeater (Range Extender) เสียบเต้ารับ',
    alt: 'อุปกรณ์ขยายสัญญาณ Wi-Fi สีขาวขนาดเท่าฝ่ามือเสียบอยู่กับเต้ารับไฟบนผนัง ด้านหน้ามีปุ่ม WPS ด้านข้างมีพอร์ต LAN และรู Reset และมีไฟสถานะสีเขียว 3 ดวง',
    labels: [
      { x: 34, y: 52, text: 'พอร์ต LAN' },
      { x: 36, y: 67, text: 'รูปุ่ม Reset' },
      { x: 72, y: 68, text: 'ปุ่ม WPS' },
      { x: 81, y: 40, text: 'ไฟสถานะ: ไฟเลี้ยง, การเชื่อมต่อ และสัญญาณ Wi-Fi' }
    ],
    credit: { source: 'commons', file: 'File:Wifi Range Extender.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'sim-router-4g-rear': {
    file: 'sim-router-4g-rear.jpg', w: 1342, h: 934,
    title: 'SIM Router (4G Router) ด้านหลัง',
    alt: 'ด้านหลังของเราเตอร์ 4G สีขาว มีฝาปิดช่องใส่ซิมการ์ด ขั้วต่อเสาอากาศ 4G สีทองสองจุด พอร์ต LAN สีเหลือง 4 พอร์ต พอร์ต USB ช่องโทรศัพท์ และรูปุ่ม Reset สติกเกอร์ข้อมูลเครื่องถูกทำให้เบลอ',
    labels: [
      { x: 19, y: 42, text: 'ฝาปิดช่องใส่ซิมการ์ด' },
      { x: 34, y: 30, text: 'ขั้วต่อเสาอากาศ 4G ภายนอก' },
      { x: 52, y: 80, text: 'พอร์ต LAN' },
      { x: 22, y: 86, text: 'รูปุ่ม Reset' }
    ],
    credit: { source: 'commons', file: 'File:Router 4G-LTE movi.jpg' }, changes: 'ครอป ย่อขนาด และเบลอสติกเกอร์ข้อมูลเครื่อง'
  },
  'mesh-node-deco': {
    file: 'mesh-node-deco.jpg', w: 1600, h: 1494,
    title: 'อุปกรณ์ Mesh Wi-Fi หนึ่งตัว (Node)',
    alt: 'อุปกรณ์ Mesh Wi-Fi ทรงกระบอกเตี้ยสีขาววางบนโต๊ะ ด้านบนมีไฟสถานะสีฟ้าดวงเล็ก และมีสายต่ออยู่ด้านหลัง',
    labels: [
      { x: 44, y: 34, text: 'ไฟสถานะ บอกว่าเชื่อมกับ Node อื่นได้หรือไม่' }
    ],
    credit: { source: 'commons', file: 'File:Wi-Fi mesh system Deco M9 Plus.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'antenna-omni-router': {
    file: 'antenna-omni-router.jpg', w: 1025, h: 1600,
    title: 'เสาอากาศรอบทิศทาง (Omni) บน Router',
    alt: 'Wi-Fi Router สีน้ำเงินดำที่มีเสาอากาศแบบแท่งสีดำตั้งตรง 2 ต้น ยึดไว้ด้วยแถบพลาสติกกลางเสา',
    labels: [
      { x: 17, y: 30, text: 'เสาแท่งตั้งตรง กระจายคลื่นรอบตัว 360 องศา' },
      { x: 50, y: 85, text: 'ตัว Wi-Fi Router' }
    ],
    credit: { source: 'commons', file: 'File:WRT54G Linksys Router with 7 dBi Antennas Digon3.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'wireless-link-grid-dish': {
    file: 'wireless-link-grid-dish.jpg', w: 960, h: 1600,
    title: 'เสาจานตะแกรงแบบทิศทางและเสาแผงแบบ Sector',
    alt: 'เสาโลหะติดข้างอาคารทรงกลม ด้านบนมีเสาอากาศจานตะแกรงโค้งหันออกไปทิศเดียว ด้านล่างซ้ายมีเสาอากาศแผงยาวสีขาวของเครือข่ายมือถือ',
    labels: [
      { x: 52, y: 22, text: 'เสาจานตะแกรง (Grid) แบบทิศทาง สำหรับลิงก์ Wi-Fi 5 GHz' },
      { x: 13, y: 70, text: 'เสาแผง (Sector/Panel) ของเครือข่ายมือถือ' }
    ],
    credit: { source: 'commons', file: 'File:Antennen Mobilfunk Wlan5GHz Richtfunk.JPG' }, changes: 'ครอปและย่อขนาด'
  },
  'antenna-yagi-mast': {
    file: 'antenna-yagi-mast.jpg', w: 1600, h: 735,
    title: 'เสาอากาศ Yagi บนเสาสูง',
    alt: 'เสาอากาศ Yagi สองชุดติดบนเสาโลหะกลางท้องฟ้า แต่ละชุดเป็นแกนยาวที่มีก้านโลหะสั้นเรียงตั้งฉากเป็นระยะ',
    labels: [
      { x: 30, y: 20, text: 'แกน (Boom) กับก้านเรียงหลายก้าน' },
      { x: 60, y: 75, text: 'เสา Yagi อีกชุดที่สั้นกว่า' }
    ],
    credit: { source: 'commons', file: 'File:Antenna-178969.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'antenna-dish-tower': {
    file: 'antenna-dish-tower.jpg', w: 936, h: 1600,
    title: 'เสาอากาศจานบนเสาสื่อสาร',
    alt: 'เสาโครงเหล็กสูงที่มีเสาอากาศจานสีขาวหลายขนาดติดอยู่ แต่ละจานหันไปคนละทิศเพื่อเชื่อมกับเสาปลายทางแต่ละแห่ง',
    labels: [
      { x: 66, y: 54, text: 'จานสะท้อน (Dish) หันตรงไปหาเสาปลายทาง' }
    ],
    credit: { source: 'pexels', page: 'https://www.pexels.com/photo/a-cell-tower-9290873/' }, changes: 'ครอปและย่อขนาด'
  },
  'wps-button-router': {
    file: 'wps-button-router.jpg', w: 1585, h: 953,
    title: 'ปุ่ม WPS ด้านหลัง Router',
    alt: 'ภาพใกล้ด้านหลังของ Router มีปุ่มกดสีน้ำเงิน ใต้ปุ่มมีสัญลักษณ์ลูกศรวนสองลูกศรของ WPS ถัดไปเป็นไฟสถานะสีเขียวและช่องเสียบไฟ 12VDC',
    labels: [
      { x: 20, y: 30, text: 'ปุ่ม WPS แบบกด (Push button)' },
      { x: 19, y: 75, text: 'สัญลักษณ์ WPS ลูกศรวน' }
    ],
    credit: { source: 'commons', file: 'File:Cisco router WPS button.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'printer-network-ports': {
    file: 'printer-network-ports.jpg', w: 600, h: 1552,
    title: 'พอร์ตด้านหลังเครื่องพิมพ์เครือข่าย',
    alt: 'ด้านหลังเครื่องพิมพ์เลเซอร์สีเทา มีพอร์ตขนานขนาดใหญ่ ด้านล่างมีสาย LAN สีเหลืองเสียบพอร์ต RJ-45 พร้อมไฟ Link สีเขียว และด้านบนมีสติกเกอร์ปิดช่อง USB',
    labels: [
      { x: 60, y: 45, text: 'พอร์ตขนาน (Parallel) รุ่นเก่า' },
      { x: 60, y: 70, text: 'พอร์ต LAN พร้อมไฟ Link สีเขียว' },
      { x: 80, y: 10, text: 'ช่อง USB (มีสติกเกอร์ปิดอยู่)' }
    ],
    credit: { source: 'commons', file: 'File:Brother HL-2070N Network Laser Printer ports.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'nic-pcie-intel': {
    file: 'nic-pcie-intel.jpg', w: 1024, h: 528,
    title: 'การ์ดเครือข่าย (NIC) แบบ PCI Express',
    alt: 'การ์ดเครือข่ายแผ่นสีเขียวแบบ PCI Express x1 วางในถาดพลาสติก ด้านซ้ายมีช่อง RJ-45 ด้านล่างมีขาทองแดงสำหรับเสียบสล็อต PCIe และกลางแผ่นมีชิปควบคุม Ethernet',
    labels: [
      { x: 7, y: 30, text: 'ช่อง RJ-45 สำหรับสาย LAN' },
      { x: 45, y: 85, text: 'ขาเสียบสล็อต PCIe x1 บนเมนบอร์ด' },
      { x: 55, y: 45, text: 'ชิปควบคุม Ethernet' }
    ],
    credit: { source: 'commons', file: 'File:An Intel 82574L Gigabit Ethernet NIC, PCI Express x1 card.jpg' }, changes: 'ครอปและย่อขนาด'
  },
  'switch-8port-hp': {
    file: 'switch-8port-hp.jpg', w: 1600, h: 1012,
    title: 'Switch 8 พอร์ต',
    alt: 'สวิตช์เครือข่ายขนาดตั้งโต๊ะสีดำเทา ด้านหน้ามีพอร์ต RJ-45 เรียงกัน 8 พอร์ต พร้อมหมายเลขพอร์ตกำกับ และไฟสถานะทางซ้าย',
    labels: [
      { x: 64, y: 74, text: 'พอร์ต RJ-45 หมายเลข 1 ถึง 8' }
    ],
    credit: { source: 'commons', file: 'File:8-Port Gigabit Switch HP 1810G-8.jpg' }, changes: 'ครอปและย่อขนาด'
  }
};
