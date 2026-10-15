'use strict';
/* NetLab 2.6 figures batch b (public/js/figs-b.js): placements for weeks 4-9. Same shape as ../visuals.js */
module.exports = [
  {
    lesson: 'w4', section: 's2', anchor: { type: 'widget', match: 'hub-switch-sim' }, mode: 'after',
    block: { type: 'widget', name: 'duplex-modes', caption: 'Hub ทำให้ทุกเครื่องใช้สื่อร่วมกันแบบ Half-duplex จึงต้องใช้ CSMA/CD และสุ่มรอเมื่อชน ส่วนพอร์ต Switch เป็น Full-duplex ส่งและรับพร้อมกันได้ ลองรันงานชุดเดียวกันทั้งสองโหมดแล้วเทียบเวลาและจำนวนการชน' }
  },
  {
    lesson: 'w4', section: 's5', anchor: { type: 'p', match: '2.5GBASE-T และ 5GBASE-T' }, mode: 'after',
    block: { type: 'diagram', name: 'ethernet-standards', caption: 'อ่านชื่อมาตรฐานเป็นสามส่วน ความเร็ว + BASE + ชนิดสื่อ แล้วเทียบความเร็ว สื่อ และระยะสูงสุดของ Ethernet แต่ละแบบ สายทองแดงทุกความเร็วไปได้ไม่เกิน 100 เมตร ระยะไกลกว่านั้นต้องใช้ใยแก้ว' }
  },
  {
    lesson: 'w5', section: 's1', anchor: { type: 'term', match: 'Unshielded Twisted Pair' }, mode: 'after',
    block: { type: 'diagram', name: 'utp-anatomy', caption: 'ภายในสาย UTP มีทองแดง 4 คู่ บิดเกลียวด้วยระยะต่างกันเพื่อลดสัญญาณรบกวนและ Crosstalk สาย Cat6 มักมีแกนกากบาทแยกคู่สาย ตารางช่วยเลือกเกรดสาย เช่น 10GBASE-T ต้องใช้ Cat6a จึงได้ 100 เมตร' }
  },
  {
    lesson: 'w5', section: 's1', anchor: { type: 'list', match: 'คีมย้ำหัว (Crimping Tool)' }, mode: 'after',
    block: { type: 'diagram', name: 'crimp-tools', caption: 'รู้จักส่วนต่าง ๆ ของคีมย้ำหัว หัว RJ-45 ปลอกหุ้มหัว และ LAN Tester โดยเฉพาะวิธีจับหัว RJ-45 ให้หน้าสัมผัสหันขึ้น ตัวล็อกคว่ำลง ขา 1 จึงอยู่ซ้ายสุด' }
  },
  {
    lesson: 'w5', section: 's4', anchor: { type: 'steps', match: 'สวมปลอกหุ้ม (Boot)' }, mode: 'after',
    block: { type: 'widget', name: 'crimp-steps', caption: 'ดูขั้นตอนเข้าหัว RJ-45 ทีละขั้นพร้อมภาพ แล้วกดดูตัวอย่างที่ผิดของแต่ละขั้น เช่น ลืมสวม Boot เรียงสีแบบ Split pair หรือดันสายไม่สุด ขั้นสุดท้ายลองทดสอบด้วย LAN Tester' }
  },
  {
    lesson: 'w6', section: 's2', anchor: { type: 'p', match: 'เทคโนโลยีที่ทำให้แต่ละรุ่นเร็วขึ้น' }, mode: 'after',
    block: { type: 'diagram', name: 'wifi-generations', caption: 'เทียบ Wi-Fi 4 ถึง Wi-Fi 7 ด้านย่านความถี่ ความกว้างช่อง Modulation จำนวนสตรีม และเทคโนโลยีเด่น ความเร็วในภาพเป็นค่าทฤษฎีสูงสุด ความเร็วที่ใช้จริงต่ำกว่ามาก' }
  },
  {
    lesson: 'w6', section: 's3', anchor: { type: 'p', match: 'ในอาคารชุดหรือหอพัก' }, mode: 'after',
    block: { type: 'widget', name: 'wifi-interference', caption: 'ลองเลือกช่องสัญญาณให้ AP สามตัวที่อยู่ติดกัน แล้วดูว่าทำไมชุด 1, 6, 11 จึงไม่ทับกัน ช่องที่เหลื่อมกันรบกวนมากกว่าการใช้ช่องเดียวกัน และย่าน 5 GHz มีช่องที่ไม่ทับกันมากกว่า' }
  },
  {
    lesson: 'w6', section: 's5', anchor: { type: 'table', match: 'ชนิดเสาอากาศ' }, mode: 'after',
    block: { type: 'widget', name: 'ap-placement', caption: 'ลองวาง AP ในแผนผังอาคารเรียนแล้วดูพื้นที่สัญญาณโดยประมาณ เทียบการวางมุมอาคารกับกลางอาคาร ติดสูงกับวางต่ำ ย่าน 2.4 กับ 5 GHz และผลของผนัง ตู้เหล็ก และไมโครเวฟ' }
  },
  {
    lesson: 'w8', section: 's4', anchor: { type: 'steps', match: 'ncpa.cpl' }, mode: 'after',
    block: { type: 'diagram', name: 'network-adapter', caption: 'หน้าต่าง Network Connections บอกสถานะการ์ดแต่ละตัว เชื่อมต่อแล้ว ไม่ได้เสียบสาย หรือถูกปิดใช้งาน และหน้าต่าง Properties คือที่เลือก TCP/IPv4 เพื่อตั้งค่า IP' }
  },
  {
    lesson: 'w8', section: 's5', anchor: { type: 'list', match: 'DHCP Enabled: No' }, mode: 'after',
    block: { type: 'diagram', name: 'ipconfig-output', caption: 'อ่านผล ipconfig /all ทีละบรรทัดว่าแต่ละค่าคืออะไร และสังเกตอาการผิดปกติ เช่น IP 169.254.x.x แปลว่าไม่ได้ IP จาก DHCP, Default Gateway ว่าง หรือ Media disconnected' }
  }
];
