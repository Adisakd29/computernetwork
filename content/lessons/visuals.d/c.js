'use strict';
/* NetLab 2.6 figures batch c (public/js/figs-c.js) placed into weeks 12-18. Same format as content/lessons/visuals.js. */
module.exports = [
  { lesson: 'w12', section: 's2', anchor: { type: 'steps', match: 'เปิด VirtualBox กดปุ่ม New' }, mode: 'after',
    block: { type: 'diagram', name: 'vm-create-steps', caption: 'ภาพจำลองหน้าจอทีละขั้นของการสร้างเครื่องจำลอง ช่วยให้เห็นว่าแต่ละขั้นต้องกรอกค่าใดและควรตั้งเท่าไร เช่น RAM 2048 MB, CPU 2, ดิสก์ VDI แบบ Dynamically allocated 25 GB สำหรับเครื่องแล็บ RAM 16 GB' } },
  { lesson: 'w12', section: 's5', anchor: { type: 'p', match: 'หลักการทำงานคือ เมื่อสร้าง Snapshot' }, mode: 'after',
    block: { type: 'widget', name: 'snapshot-restore', caption: 'ลองสร้าง Snapshot เปลี่ยนเครื่อง แล้ว Restore เพื่อดูว่าสถานะและไฟล์ส่วนต่างเปลี่ยนอย่างไร และทดลองให้ดิสก์ของ Host เสีย เพื่อเข้าใจว่าทำไม Snapshot ไม่ใช่ Backup' } },
  { lesson: 'w13', section: 's2', anchor: { type: 'p', match: 'สาย UTP ตามมาตรฐาน 10BASE-T' }, mode: 'after',
    block: { type: 'diagram', name: 'structured-cabling', caption: 'ผังสำนักงานแสดงเส้นทางสายจากเต้ารับที่โต๊ะผ่านรางในฝ้าถึง Patch Panel และ Switch ในตู้ Rack ช่วยให้เข้าใจกฎสายถาวรไม่เกิน 90 เมตร รวม Patch Cord ไม่เกิน 100 เมตร และการติดป้ายสายให้ตรงกันทั้งสองปลาย' } },
  { lesson: 'w14', section: 's2', anchor: { type: 'p', match: 'หลักการอ่านผลคือ ถ้าขั้นใดไม่ผ่าน' }, mode: 'after',
    block: { type: 'diagram', name: 'cmd-outputs', caption: 'ตัวอย่างผล ping, tracert และ nslookup พร้อมหมายเลขอธิบายแต่ละบรรทัด ช่วยให้อ่านผลจริงแล้วสรุปได้ว่าปัญหาอยู่ที่ใด เช่น Destination host unreachable ที่ตอบจาก IP ของเครื่องเราเอง หรือ * * * ที่ไม่ใช่ปัญหาเสมอไป' } },
  { lesson: 'w14', section: 's3', anchor: { type: 'p', match: 'ปัญหา DNS มีอาการเด่นคือ' }, mode: 'after',
    block: { type: 'widget', name: 'gateway-dns-fault', caption: 'เปรียบเทียบเครื่องที่ตั้งค่าปกติ ตั้ง Default Gateway ผิด และตั้ง DNS ผิด ดูว่าการเปิดเว็บล้มที่ขั้นใด และคำสั่ง ping Gateway, ping 8.8.8.8 หรือ nslookup ตัวใดบอกสาเหตุได้' } },
  { lesson: 'w16', section: 's3', anchor: { type: 'table', match: 'ตัวอย่างมาตรการ' }, mode: 'after',
    block: { type: 'widget', name: 'control-picker', caption: 'ฝึกเลือกมาตรการให้ตรงกับเหตุการณ์จริง 5 แบบ แล้วดูว่าแต่ละมาตรการอยู่ชั้นกายภาพ เทคนิค หรือบริหารจัดการ และทำหน้าที่ป้องกัน ตรวจจับ หรือแก้ไข เพื่อวางการป้องกันเชิงลึกให้ครบ' } },
  { lesson: 'w17', section: 's3', anchor: { type: 'table', match: 'ตัวเลือก' }, mode: 'after',
    block: { type: 'diagram', name: 'user-mgmt-screen', caption: 'ภาพจำลองหน้าจอ Local Users and Groups และหน้าต่าง New User ช่วยให้จำตำแหน่งช่องและตัวเลือกรหัสผ่าน พร้อมเทียบคำสั่ง net user และ net localgroup ของ Windows กับ useradd, passwd และ usermod -aG ของ Linux' } },
  { lesson: 'w17', section: 's4', anchor: { type: 'p', match: 'กลุ่มผู้ใช้ (Group) คือการรวมบัญชี' }, mode: 'after',
    block: { type: 'diagram', name: 'group-permissions', caption: 'เทียบการให้สิทธิ์ทีละคนที่ยุ่งและมีสิทธิ์ค้าง กับการให้สิทธิ์ผ่านกลุ่มฝ่ายบัญชี ฝ่ายขาย และ IT ช่วยให้เข้าใจว่าทำไมควรกำหนดสิทธิ์ให้กลุ่มตามหลัก Least Privilege' } },
  { lesson: 'w18', section: 's2', anchor: { type: 'p', match: 'ลองนึกภาพอาคารที่มียามหน้าประตู' }, mode: 'after',
    block: { type: 'diagram', name: 'ntfs-inheritance', caption: 'ต้นไม้โฟลเดอร์แสดงสิทธิ์ที่สืบทอดกับสิทธิ์ที่ตั้งเอง และ Deny หนึ่งรายการ ช่วยให้หาสิทธิ์ที่มีผลจริงของผู้ใช้ที่อยู่หลายกลุ่มได้ ตามลำดับ Explicit Deny, Explicit Allow, Inherited Deny, Inherited Allow' } }
];
