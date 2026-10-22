'use strict';
/* NetLab 2.16 real photos, helper A1 (photos in content/photos.d/a.js; some reuse batch b, c and d photos).
   Inventory A: connectors (w2 s5, w5 s1) and device-ports (w2 s5) are REPLACED by photos; cable-types (w2 s3, w4 s3)
   and dte-dce-console (w4 x2) keep the drawing and get photos after it. Panel 4 of device-ports (RJ-45 plug orientation)
   stays as its own diagram rj45-plug-orient (public/js/figs-a.js), placed right after the port photos.
   Inventory C: devices named in the text of w2 s1-s4 and w4 s3, x2, x5. */
const CONNECTORS = ['conn-rj45', 'conn-bnc', 'conn-sc', 'conn-lc', 'conn-st', 'conn-fc'];
const CONNECTORS_CAP = 'หัวต่อจริง 6 แบบ: RJ-45 มีหน้าสัมผัสทองแดง 8 ขาและขาล็อก BNC เสียบแล้วบิดล็อกหนึ่งในสี่รอบ (ประมาณ 90 องศา) ใช้กับสายโคแอกเชียล ส่วนหัวไฟเบอร์ดูที่วิธีล็อก SC เป็นทรงสี่เหลี่ยมเสียบแล้วดึงออกได้เลย LC เล็กกว่าครึ่งหนึ่งและมีขาล็อกแบบ RJ-45 ST ใช้ปลอกโลหะบิดล็อก และ FC ใช้น็อตเกลียวขันล็อก';
const CABLES = ['cable-coax-stripped', 'cat6-pairs-ripcord', 'cable-sftp-stripped', 'cable-fibre-stripped', 'fibre-patch-cords'];
const CABLES_CAP = 'สายจริงที่ปอกให้เห็นชั้นภายใน: โคแอกเชียลมีตัวนำแกนกลางหนึ่งแกน (ในภาพเป็นลวดตีเกลียวหลายเส้น) ล้อมด้วยฉนวน ฟอยล์ และตาข่ายโลหะ UTP มีสาย 4 คู่บิดเกลียวโดยไม่มีชีลด์ S/FTP เพิ่มฟอยล์หุ้มแต่ละคู่และตาข่ายหุ้มรวม ส่วนสายไฟเบอร์มีเส้นใยอะรามิดรับแรงดึงและใยแก้วเส้นเล็กมากอยู่ตรงกลาง สังเกตสีของสายไฟเบอร์ด้วย สาย Patch Cord สีเหลืองเป็น Single-mode สีฟ้าน้ำทะเลเป็น Multi-mode (สายดร็อปเข้าบ้านมักเป็นสีขาว ต้องดูจากชนิดหัวหรือข้อความบนสาย)';

module.exports = [
  /* ---------- w2 s1 ---------- */
  { lesson: 'w2', section: 's1', anchor: { type: 'term', match: 'การ์ดเครือข่าย (NIC' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-nic', photos: ['nic-pcie-intel'], layout: 'single',
      caption: 'การ์ดเครือข่ายแบบเสียบสล็อต PCI Express: ด้านหนึ่งมีช่อง RJ-45 ให้เสียบสาย LAN อีกด้านมีขาทองเสียบเข้าเมนบอร์ด ปัจจุบันวงจรนี้มักฝังอยู่บนเมนบอร์ดแทนการ์ดแยก' } },
  { lesson: 'w2', section: 's1', anchor: { type: 'p', match: 'ฮับ (Hub) หรือ Share Hub' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-hub', photos: ['hub-10baset-8port'], layout: 'single',
      caption: 'ฮับรุ่นเก่า 8 พอร์ต: หน้าตาคล้ายสวิตช์ แต่ข้างในไม่มีตาราง MAC ข้อมูลที่เข้าพอร์ตหนึ่งจะถูกส่งออกทุกพอร์ต ปัจจุบันจึงแทบไม่มีขายแล้ว' } },
  { lesson: 'w2', section: 's1', anchor: { type: 'p', match: 'สวิตช์ (Switch) หรือ Switch Hub' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-switch', photos: ['switch-8port-hp'], layout: 'single',
      caption: 'สวิตช์ 8 พอร์ต: แต่ละพอร์ตมีไฟ LED บอกว่ามีสายต่ออยู่และกำลังรับส่งข้อมูล สวิตช์จำว่าเครื่องแต่ละ MAC อยู่พอร์ตใด จึงส่งเฟรมไปเฉพาะพอร์ตปลายทาง' } },

  /* ---------- w2 s2 ---------- */
  { lesson: 'w2', section: 's2', anchor: { type: 'p', match: 'บริดจ์ (Bridge) แบ่ง LAN' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-modem-ont', photos: ['modem-adsl', 'ont-fibre-rear'], layout: 'grid',
      caption: 'อุปกรณ์แปลงสัญญาณที่บ้าน: โมเด็ม ADSL รับสัญญาณจากสายโทรศัพท์ทองแดง ส่วน ONT รับสายใยแก้วที่ช่อง SC/APC สีเขียว แล้วแปลงแสงเป็นสัญญาณไฟฟ้าออกทางพอร์ต LAN ไปยัง Router' } },
  { lesson: 'w2', section: 's2', anchor: { type: 'p', match: 'เราเตอร์ (Router) ตัดสินใจ' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-router-gateway', photos: ['router-archer-rear', 'voip-ata-adapter'], layout: 'grid',
      caption: 'ด้านหลังเราเตอร์มีพอร์ต WAN แยกจากพอร์ต LAN อย่างชัดเจน เพราะเราเตอร์เชื่อมสองเครือข่ายเข้าด้วยกัน ส่วนกล่อง VoIP Gateway ขนาดเล็กเป็นตัวอย่างเกตเวย์ที่แปลงโทรศัพท์บ้านแบบแอนะล็อกให้คุยผ่านเครือข่าย IP ได้' } },
  { lesson: 'w2', section: 's2', anchor: { type: 'example', match: 'เราเตอร์ไฟเบอร์' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-access-point', photos: ['access-point-ceiling'], layout: 'single',
      caption: 'Access Point แยกตัวแบบติดเพดาน ใช้ในโรงเรียนและสำนักงานเพื่อกระจาย Wi-Fi ให้ทั่วห้อง ในกล่องของผู้ให้บริการตามบ้าน ส่วนนี้ถูกรวมไว้กับ ONU และเราเตอร์ในกล่องเดียว' } },

  /* ---------- w2 s3 ---------- */
  { lesson: 'w2', section: 's3', anchor: { type: 'diagram', match: 'cable-types' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-cable-types', photos: CABLES, layout: 'grid', caption: CABLES_CAP } },
  { lesson: 'w2', section: 's3', anchor: { type: 'p', match: 'สายโคแอกเชียล (Coaxial) มีแกนทองแดง' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-coax-tv', photos: ['coax-f-connector'], layout: 'single',
      caption: 'สายโคแอกเชียลของเสาอากาศทีวีและจานดาวเทียมใช้หัว F ที่ขันเกลียว สังเกตว่าแกนทองแดงของสายทำหน้าที่เป็นขาของหัวต่อโดยตรง' } },
  { lesson: 'w2', section: 's3', anchor: { type: 'p', match: 'สายใยแก้วนำแสง (Fiber Optic) ส่งข้อมูล' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-fibre-tools', photos: ['fibre-sc-apc-cord', 'fusion-splicer'], layout: 'grid',
      caption: 'ซ้าย: สายไฟเบอร์สำเร็จรูปหัว SC/APC สีเขียวแบบที่ต่อเข้ากล่อง ONT ตามบ้าน ขวา: เครื่อง Fusion Splicer ที่ช่างใช้เชื่อมปลายใยแก้วสองเส้นให้ติดกันด้วยความร้อน งานไฟเบอร์จึงใช้เครื่องมือคนละชุดกับคีมย้ำหัว RJ-45' } },

  /* ---------- w2 s4 ---------- */
  { lesson: 'w2', section: 's4', anchor: { type: 'p', match: 'ไมโครเวฟภาคพื้นดิน' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-microwave-satellite', photos: ['microwave-tower', 'satellite-internet-dish'], layout: 'grid',
      caption: 'ซ้าย: เสาไมโครเวฟที่ติดสายอากาศไว้บนที่สูงและหันไปหาเสาต้นถัดไปโดยตรง ขวา: จานดาวเทียมขนาดเล็กสำหรับรับส่งอินเทอร์เน็ต ชุดรับส่งสัญญาณอยู่ที่จุดโฟกัสของจาน และจานต้องหันไปยังตำแหน่งดาวเทียมอย่างแม่นยำ' } },
  { lesson: 'w2', section: 's4', anchor: { type: 'table', match: 'สื่อไร้สาย' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w2-ir-bluetooth', photos: ['ir-remote-leds', 'bluetooth-headset'], layout: 'grid',
      caption: 'ซ้าย: หลอด LED อินฟราเรดที่หัวรีโมต ตาคนมองไม่เห็นแสงนี้ แต่กล้องถ่ายภาพมองเห็น และต้องหันรีโมตไปทางเครื่องรับเพราะแสงไปแนวตรง ขวา: หูฟัง Bluetooth ใช้คลื่นวิทยุระยะสั้น จึงไม่ต้องหันหาโทรศัพท์ แต่ต้องจับคู่ (Pair) ก่อนใช้' } },

  /* ---------- w2 s5: connectors and device-ports replaced by photos; RJ-45 orientation panel kept ---------- */
  { lesson: 'w2', section: 's5', anchor: { type: 'diagram', match: 'connectors' }, mode: 'replace',
    block: { type: 'photo', name: 'ph-w2-connectors', photos: CONNECTORS, layout: 'grid', caption: CONNECTORS_CAP } },
  { lesson: 'w2', section: 's5', anchor: { type: 'diagram', match: 'device-ports' }, mode: 'replace',
    block: { type: 'photo', name: 'ph-w2-device-ports', photos: ['nic-pcie-intel', 'switch-8port-hp', 'router-rear-ports', 'sfp-module-lc'], layout: 'grid',
      caption: 'พอร์ตจริงที่จะพบบนอุปกรณ์: ช่อง RJ-45 ของการ์ดเครือข่าย พอร์ต 1 ถึง 8 และไฟ LED ของสวิตช์ พอร์ต WAN สีน้ำเงินกับพอร์ต LAN สีส้มของเราเตอร์บ้าน และโมดูล SFP ที่มีช่องรับหัว LC สองช่อง ช่องหนึ่งส่ง (TX) อีกช่องรับ (RX)' } },
  { lesson: 'w2', section: 's5', anchor: { type: 'note', match: 'คำช่วยจำหัวไฟเบอร์' }, mode: 'before',   // = right after the port photos
    block: { type: 'diagram', name: 'rj45-plug-orient',
      caption: 'เวลานับขาหัว RJ-45 ให้หันหน้าสัมผัสทองแดงเข้าหาตัว คลิปล็อกอยู่ด้านหลัง และสายชี้ลง ขา 1 จะอยู่ซ้ายสุด ซึ่งภาพถ่ายบอกได้ไม่ชัดเท่าภาพนี้' } },

  /* ---------- w4 s3 ---------- */
  { lesson: 'w4', section: 's3', anchor: { type: 'diagram', match: 'cable-types' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w4-cable-types', photos: CABLES, layout: 'grid', caption: CABLES_CAP } },
  { lesson: 'w4', section: 's3', anchor: { type: 'p', match: '10BASE5 หรือ Thick Ethernet' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w4-10base5', photos: ['vampire-tap-10base5', 'aui-connector-da15', 'nic-combo-rj45-aui-bnc'], layout: 'grid',
      caption: 'อุปกรณ์ของ 10BASE5: Vampire Tap มีเข็มที่เจาะผ่านเปลือกสายโคแอกเชียลแบบหนาลงไปแตะแกนกลาง Transceiver ต่อกับการ์ดแลนด้วยสาย AUI หัว 15 ขา การ์ดแลนยุคนั้นจึงมักมีทั้งพอร์ต AUI, BNC และ RJ-45 ในใบเดียว' } },
  { lesson: 'w4', section: 's3', anchor: { type: 'p', match: '10BASE2 หรือ Thin Ethernet' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w4-10base2', photos: ['bnc-tee-10base2', 'bnc-terminator-50ohm'], layout: 'grid',
      caption: 'บัส 10BASE2: ทุกเครื่องเสียบตัวต่อรูปตัว T เข้าการ์ดแลน สายจากเครื่องก่อนหน้าและเครื่องถัดไปต่อเข้าสองข้างของตัว T ส่วนเครื่องที่อยู่ปลายบัสต้องปิดข้างที่ว่างด้วยตัวปิดปลาย 50 โอห์ม ถ้าขาดตัวใดตัวหนึ่งทั้งบัสจะใช้งานไม่ได้' } },
  { lesson: 'w4', section: 's3', anchor: { type: 'p', match: '10BASE-T (IEEE 802.3i' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w4-10baset-hub', photos: ['hub-10baset-8port'], layout: 'single',
      caption: 'ฮับ 10BASE-T: สาย UTP จากแต่ละเครื่องเสียบคนละพอร์ต จึงเป็นรูปดาว ฮับรุ่นนี้ยังมีพอร์ต BNC ไว้ต่อเข้าบัส 10BASE2 เดิม แสดงให้เห็นช่วงเปลี่ยนผ่านจากสายโคแอกเชียลมาเป็นสาย UTP' } },

  /* ---------- w4 x2 ---------- */
  { lesson: 'w4', section: 'x2', anchor: { type: 'diagram', match: 'dte-dce-console' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w4-console-kit', photos: ['usb-serial-adapter', 'db9-male-connector', 'firewall-appliance-asa'], layout: 'grid',
      caption: 'ชุดต่อคอนโซลจริง: ตัวแปลง USB-to-Serial มีหัว DB-9 ตัวผู้ 9 ขา ใช้แทนพอร์ตอนุกรมที่พีซีรุ่นใหม่ไม่มีแล้ว ปลาย DB-9 ของสายคอนโซลเสียบที่นี่ ส่วนปลาย RJ-45 เสียบพอร์ตที่มีป้าย CONSOLE บนอุปกรณ์ ไม่ใช่พอร์ต LAN' } },
  { lesson: 'w4', section: 'x2', anchor: { type: 'p', match: 'โมเด็ม (Modem ย่อจาก Modulator-Demodulator)' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w4-modem-dialup', photos: ['modem-dialup-56k'], layout: 'single',
      caption: 'โมเด็ม Dial-up 56K แบบตั้งโต๊ะ ต่อกับคอมพิวเตอร์ทางพอร์ตอนุกรมและต่อกับสายโทรศัพท์ ไฟด้านหน้าบอกสถานะการโทรออกและการรับส่งข้อมูล' } },
  { lesson: 'w4', section: 'x2', anchor: { type: 'p', match: 'ต่อมา DSL ใช้คู่สายโทรศัพท์ทองแดงเดิม' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w4-adsl', photos: ['adsl-splitter', 'modem-adsl'], layout: 'grid',
      caption: 'ซ้าย: Splitter เสียบที่เต้ารับสายโทรศัพท์ แล้วแยกช่อง PHONE สำหรับโทรศัพท์บ้านกับช่อง ADSL สำหรับโมเด็ม ขวา: โมเด็ม ADSL ที่มีไฟ Sync บอกว่าจับสัญญาณ DSL จากชุมสายได้แล้ว' } },
  { lesson: 'w4', section: 'x2', anchor: { type: 'p', match: 'ปัจจุบันผู้ให้บริการในไทยเน้นอินเทอร์เน็ตไฟเบอร์' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w4-ont', photos: ['ont-fibre-rear', 'fibre-sc-apc-cord'], layout: 'grid',
      caption: 'กล่อง ONT ด้านหลังมีช่องเสียบสายใยแก้ว SC/APC สีเขียว และพอร์ต LAN ที่ส่งต่อไปยัง Router สายไฟเบอร์สำเร็จรูปที่ช่างใช้ก็เป็นหัว SC/APC สีเขียวแบบเดียวกัน ไม่ต้องใช้ ADSL Splitter และไม่ใช้สายโทรศัพท์อีกต่อไป' } },

  /* ---------- w4 x5 ---------- */
  { lesson: 'w4', section: 'x5', anchor: { type: 'p', match: 'ระหว่างสองแบบนี้ยังมีสวิตช์กลุ่ม Smart' }, mode: 'after',
    block: { type: 'photo', name: 'ph-w4-managed-switches', photos: ['managed-switch-front', 'switch-8port-hp'], layout: 'grid',
      caption: 'ซ้าย: Managed Switch 24 พอร์ตแบบติดตู้ Rack มีไฟสถานะระบบและปุ่ม MODE ด้านซ้าย และตั้งค่าผ่านพอร์ต Console หรือหน้าเว็บได้ ขวา: สวิตช์ 8 พอร์ตกลุ่ม Web-managed ที่ตั้ง VLAN ผ่านหน้าเว็บได้ หน้าตาภายนอกบอกไม่ได้ว่าจัดการได้แค่ไหน ต้องดูจาก Datasheet' } },

  /* ---------- w5 s1: connectors drawing replaced by the same photo set (different block name) ---------- */
  { lesson: 'w5', section: 's1', anchor: { type: 'diagram', match: 'connectors' }, mode: 'replace',
    block: { type: 'photo', name: 'ph-w5-connectors', photos: CONNECTORS, layout: 'grid', caption: CONNECTORS_CAP } }
];
