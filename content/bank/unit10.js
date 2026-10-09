'use strict';
// Unit 10: บัญชีผู้ใช้ (w17 การสร้างผู้ใช้และกลุ่มผู้ใช้, w18 การกำหนดสิทธิ์และการใช้งาน)
module.exports = [
  // ---------- week 17: users and groups ----------
  { id: 'u10-001', unit: 10, week: 17, level: 'easy', type: 'choice',
    q: 'ขั้นตอนที่ Windows ตรวจชื่อผู้ใช้และรหัสผ่านตอนเข้าสู่ระบบ เพื่อพิสูจน์ว่าผู้ใช้เป็นใคร เรียกว่าอะไร',
    options: ['Authorization (การให้สิทธิ์ใช้งาน)', 'Encryption (การเข้ารหัสข้อมูล)', 'Authentication (การยืนยันตัวตน)', 'Backup (การสำรองข้อมูลไว้ก่อน)'],
    correct: 2,
    why: ['Authorization คือการตัดสินว่าบัญชีนั้นทำอะไรได้ หลังยืนยันตัวตนแล้ว', 'Encryption คือการแปลงข้อมูลให้อ่านไม่ออก', '', 'Backup คือการทำสำเนาข้อมูล'],
    explain: 'การตรวจชื่อและรหัสผ่านเพื่อพิสูจน์ตัวตนคือ Authentication จากนั้น Windows จึงใช้บัญชีนั้นตัดสินว่าทำอะไรได้บ้าง ซึ่งเรียกว่า Authorization',
    tags: ['user-account', 'authentication'] },

  { id: 'u10-002', unit: 10, week: 17, level: 'medium', type: 'multi',
    q: 'การให้ผู้ใช้แต่ละคนมีบัญชีของตัวเอง แทนการใช้บัญชีร่วมกัน มีประโยชน์ข้อใดบ้าง (เลือกได้หลายข้อ)',
    options: [
      'แต่ละคนมีโปรไฟล์และไฟล์ส่วนตัวแยกกันใน C:\\Users',
      'ดูบันทึกเหตุการณ์ย้อนหลังได้ว่าใครเข้าระบบเมื่อไร',
      'ทำให้เครื่องทำงานเร็วขึ้นเพราะใช้หน่วยความจำน้อยลง',
      'ปิดบัญชีของคนที่ลาออกได้โดยไม่กระทบคนอื่น',
      'ไม่จำเป็นต้องตั้งรหัสผ่านให้บัญชีใดอีกต่อไป'
    ],
    correct: [0, 1, 3],
    explain: 'บัญชีรายคนช่วยแยกข้อมูลส่วนตัว ตรวจสอบย้อนหลังผ่าน Event Log ได้ และจัดการเมื่อคนเข้าออกได้ง่าย แต่ไม่ได้ทำให้เครื่องเร็วขึ้น และทุกบัญชียังต้องมีรหัสผ่าน',
    tags: ['user-account', 'benefits'] },

  { id: 'u10-003', unit: 10, week: 17, level: 'easy', type: 'tf',
    q: 'Windows 11 รุ่น Pro สามารถเปิดใช้ Local Users and Groups ใน Computer Management ได้',
    answer: true,
    explain: 'ถูก Local Users and Groups มีในรุ่น Pro ขึ้นไป แต่ไม่มีในรุ่น Home ซึ่งต้องจัดการบัญชีผ่าน Settings → Accounts หรือคำสั่ง net user และ net localgroup',
    tags: ['local-users-groups', 'windows-edition'] },

  { id: 'u10-004', unit: 10, week: 17, level: 'medium', type: 'order',
    q: 'เรียงลำดับขั้นตอนการสร้างบัญชีผู้ใช้ std01 ด้วย Computer Management ให้ถูกต้อง',
    items: [
      'คลิกขวาที่ปุ่ม Start แล้วเลือก Computer Management',
      'ขยาย System Tools แล้วคลิก Local Users and Groups',
      'คลิกขวาที่โฟลเดอร์ Users แล้วเลือก New User...',
      'กรอก User name เป็น std01 พร้อม Full name และ Description',
      'กรอก Password และ Confirm password แล้วเลือกตัวเลือกรหัสผ่าน',
      'กด Create แล้วกด Close'
    ],
    explain: 'เปิด Computer Management → Local Users and Groups → Users → New User... กรอกชื่อ รหัสผ่าน และตัวเลือก แล้วกด Create บัญชีใหม่จะเป็นสมาชิกกลุ่ม Users โดยอัตโนมัติ',
    tags: ['local-users-groups', 'create-user'] },

  { id: 'u10-005', unit: 10, week: 17, level: 'medium', type: 'match',
    q: 'จับคู่ตัวเลือกรหัสผ่านในหน้าต่าง New User กับสถานการณ์ที่เหมาะสม',
    left: ['User must change password at next logon', 'User cannot change password', 'Password never expires', 'Account is disabled'],
    right: [
      'สร้างบัญชีรอไว้ให้นักศึกษาฝึกงานที่จะมาสัปดาห์หน้า',
      'บัญชีบริการที่ไม่ต้องการให้รหัสหมดอายุตามนโยบาย',
      'ผู้ดูแลตั้งรหัสชั่วคราวให้ผู้ใช้ใหม่ตั้งรหัสเองภายหลัง',
      'บัญชีใช้ร่วมที่ผู้ดูแลต้องคุมรหัสเอง',
      'บัญชีที่ต้องการให้เป็นสมาชิกกลุ่ม Administrators'
    ],
    answer: [2, 3, 1, 0],
    explain: 'ตัวเลือกแต่ละข้อใช้ต่างกัน: บังคับเปลี่ยนรหัสครั้งถัดไปใช้กับรหัสชั่วคราว ห้ามเปลี่ยนรหัสใช้กับบัญชีร่วม รหัสไม่หมดอายุใช้กับบัญชีบริการ และ Account is disabled ใช้พักบัญชีหรือสร้างรอไว้ การเป็นสมาชิกกลุ่มไม่ได้กำหนดในตัวเลือกเหล่านี้',
    tags: ['create-user', 'password-options'] },

  { id: 'u10-006', unit: 10, week: 17, level: 'hard', type: 'choice',
    q: 'ขณะสร้างบัญชี ผู้ดูแลติ๊ก User must change password at next logon ไว้ แล้วติ๊ก Password never expires เพิ่ม จะเกิดอะไรขึ้น',
    options: [
      'บัญชีถูกปิดใช้งานอัตโนมัติจนกว่าจะแก้ไข',
      'รหัสผ่านหมดอายุทันทีและเข้าระบบไม่ได้เลย',
      'Windows แจ้งเตือนทันทีเพราะสองตัวเลือกขัดกัน',
      'ผู้ใช้ต้องเปลี่ยนรหัสผ่านใหม่ทุกครั้งที่เข้าระบบ'
    ],
    correct: 2,
    why: ['Windows ไม่ได้ปิดบัญชีให้เอง', 'ตัวเลือกเหล่านี้ไม่ได้ทำให้รหัสหมดอายุหรือล็อกบัญชี', '', 'ไม่มีตัวเลือกให้เปลี่ยนรหัสทุกครั้งที่เข้าระบบ'],
    explain: 'การบังคับเปลี่ยนรหัสครั้งถัดไปขัดกับ Password never expires และ User cannot change password จึงให้มีผลพร้อมกันไม่ได้ Windows จะแสดงข้อความเตือนทันทีที่ติ๊กตัวเลือกที่ขัดกัน',
    tags: ['create-user', 'password-options'] },

  { id: 'u10-007', unit: 10, week: 17, level: 'easy', type: 'choice',
    q: 'ต้องการดูว่าบัญชี std01 สังกัดกลุ่มใดบ้าง โดยดับเบิลคลิกบัญชีใน Local Users and Groups ควรเปิดแท็บใด',
    options: ['Member Of', 'General', 'Profile', 'Security'],
    correct: 0,
    why: ['', 'General แสดงชื่อและตัวเลือกบัญชี', 'Profile ใช้กำหนดโปรไฟล์และโฟลเดอร์ Home', 'Properties ของบัญชีผู้ใช้ไม่ได้ใช้แท็บ Security ดูกลุ่ม'],
    explain: 'แท็บ Member Of แสดงกลุ่มที่บัญชีสังกัด และกด Add เพื่อเพิ่มบัญชีเข้ากลุ่มอื่นได้จากหน้านี้',
    tags: ['local-users-groups', 'groups'] },

  { id: 'u10-008', unit: 10, week: 17, level: 'easy', type: 'fill',
    q: 'ในหน้าต่าง Select Users ถ้าต้องการพิมพ์หลายชื่อพร้อมกันในช่อง Enter the object names ให้คั่นแต่ละชื่อด้วยเครื่องหมาย {{1}} แล้วกดปุ่ม {{2}} เพื่อตรวจว่าชื่อมีอยู่จริง',
    blanks: [[';', 'semicolon', 'อัฒภาค'], ['Check Names', 'CheckNames']],
    explain: 'คั่นหลายชื่อด้วยเครื่องหมาย ; เช่น LAB-PC07\\std01; LAB-PC07\\std02 แล้วกด Check Names ถ้าชื่อถูกต้องจะถูกขีดเส้นใต้',
    tags: ['groups', 'add-member'] },

  { id: 'u10-009', unit: 10, week: 17, level: 'easy', type: 'match',
    q: 'จับคู่กลุ่มสำเร็จรูป (Built-in Groups) ของ Windows กับสิทธิ์โดยสรุป',
    left: ['Administrators', 'Users', 'Guests', 'Remote Desktop Users', 'Backup Operators'],
    right: [
      'สิทธิ์จำกัดมาก สำหรับผู้ใช้ชั่วคราว',
      'ควบคุมเครื่องได้ทั้งหมด รวมถึงจัดการผู้ใช้',
      'สำรองและกู้คืนไฟล์ได้แม้ไม่มีสิทธิ์เปิดไฟล์',
      'ใช้โปรแกรมทั่วไปได้ แต่แก้ค่าระบบไม่ได้',
      'เข้าใช้เครื่องจากระยะไกลผ่าน Remote Desktop'
    ],
    answer: [1, 3, 0, 4, 2],
    explain: 'Administrators ควบคุมเครื่องทั้งหมด Users ใช้งานทั่วไป Guests สิทธิ์ต่ำสุดสำหรับผู้ใช้ชั่วคราว Remote Desktop Users เข้าเครื่องระยะไกลได้ และ Backup Operators สำรองและกู้คืนไฟล์ได้',
    tags: ['groups', 'built-in-groups'] },

  { id: 'u10-010', unit: 10, week: 17, level: 'medium', type: 'choice',
    q: 'บัญชี std03 เป็นสมาชิกทั้งกลุ่ม Students และกลุ่ม ClubIT ซึ่งได้สิทธิ์บนโฟลเดอร์ต่างกัน (ไม่มีการตั้ง Deny) std03 จะได้สิทธิ์อย่างไร',
    options: [
      'ได้สิทธิ์ของกลุ่มที่ถูกสร้างก่อนเท่านั้น',
      'ได้สิทธิ์ที่น้อยกว่าระหว่างสองกลุ่ม',
      'ไม่ได้สิทธิ์ เพราะอยู่สองกลุ่มไม่ได้',
      'ได้สิทธิ์รวมของทุกกลุ่มที่สังกัด'
    ],
    correct: 3,
    why: ['ลำดับการสร้างกลุ่มไม่มีผลต่อสิทธิ์', 'การเลือกค่าที่เข้มงวดกว่าใช้เทียบระหว่าง Share กับ NTFS ไม่ใช่ระหว่างกลุ่ม', 'ผู้ใช้หนึ่งคนอยู่ได้หลายกลุ่ม', ''],
    explain: 'ถ้าผู้ใช้อยู่หลายกลุ่ม จะได้สิทธิ์รวมของทุกกลุ่มที่สังกัด เว้นแต่มี Deny ที่ตั้งไว้ชัดเจน ซึ่งจะชนะ Allow',
    tags: ['groups', 'permissions'] },

  { id: 'u10-011', unit: 10, week: 17, level: 'medium', type: 'multi',
    q: 'เหตุใดจึงควรปิดบัญชี built-in Administrator ไว้ และไม่ใช้ทำงานประจำวัน (เลือกได้หลายข้อ)',
    options: [
      'โดยค่าเริ่มต้นไม่ถูก UAC ถามยืนยัน โปรแกรมที่เปิดได้สิทธิ์เต็มทันที',
      'ชื่อบัญชีเป็นที่รู้กันทั่วไป ผู้โจมตีจึงรู้ชื่อบัญชีอยู่แล้ว',
      'บัญชีนี้ไม่สามารถตั้งรหัสผ่านได้ตั้งแต่ติดตั้ง Windows',
      'ถ้าเผลอเปิดมัลแวร์ ความเสียหายจะสูงมาก',
      'บัญชีนี้เปิดไฟล์ในโฟลเดอร์ของตัวเองไม่ได้'
    ],
    correct: [0, 1, 3],
    explain: 'built-in Administrator มีสิทธิ์สูงสุดและไม่ถูก UAC ถามโดยค่าเริ่มต้น ชื่อบัญชีก็เดาง่าย ถ้าเปิดมัลแวร์จะเสียหายมาก จึงควรปิดไว้และใช้เฉพาะงานกู้ระบบ ส่วนบัญชีนี้ตั้งรหัสผ่านได้และเปิดไฟล์ของตัวเองได้ตามปกติ',
    tags: ['built-in-accounts', 'administrator', 'uac'] },

  { id: 'u10-012', unit: 10, week: 17, level: 'easy', type: 'tf',
    q: 'ใน Windows 10/11 บัญชี built-in Guest ถูกเปิดใช้งานไว้เป็นค่าเริ่มต้น เพื่อให้ผู้ใช้ชั่วคราวเข้าใช้ได้ทันที',
    answer: false,
    explain: 'ผิด ทั้ง Administrator และ Guest ถูกปิดใช้งาน (Disabled) เป็นค่าเริ่มต้น ในรายการ Users จะเห็นไอคอนมีลูกศรชี้ลงกำกับไว้',
    tags: ['built-in-accounts', 'guest'] },

  { id: 'u10-013', unit: 10, week: 17, level: 'easy', type: 'command', os: 'windows',
    q: 'ช่างเคยเปิดบัญชี Guest ไว้ทดสอบ ตอนนี้ต้องการปิดใช้งานบัญชี Guest กลับเหมือนเดิมด้วยคำสั่ง net (เปิด Command Prompt แบบ Run as administrator แล้ว) ต้องพิมพ์คำสั่งใด',
    accept: ['^net(\\.exe)? user guest /active:no$'],
    example: 'net user Guest /active:no',
    explain: 'net user ชื่อบัญชี /active:no ใช้ปิดใช้งานบัญชี (ใช้ /active:yes เพื่อเปิด) คำสั่งใน Windows ไม่สนตัวพิมพ์เล็กหรือใหญ่',
    tags: ['net-user', 'guest', 'command'] },

  { id: 'u10-014', unit: 10, week: 17, level: 'medium', type: 'command', os: 'windows',
    q: 'ต้องการสร้างบัญชีชื่อ std02 ด้วยคำสั่ง net user โดยให้ระบบถามรหัสผ่านแบบไม่แสดงบนหน้าจอ (ไม่พิมพ์รหัสต่อท้ายคำสั่ง) ต้องพิมพ์คำสั่งใด',
    accept: ['^net(\\.exe)? user std02 \\* /add$', '^net(\\.exe)? user /add std02 \\*$'],
    example: 'net user std02 * /add',
    explain: 'เครื่องหมาย * ทำให้ระบบถามรหัสผ่านโดยไม่แสดงบนจอ ปลอดภัยกว่าการพิมพ์รหัสต่อท้ายคำสั่งซึ่งจะค้างอยู่บนหน้าจอและในประวัติคำสั่ง',
    tags: ['net-user', 'create-user', 'command'] },

  { id: 'u10-015', unit: 10, week: 17, level: 'medium', type: 'command', os: 'windows',
    q: 'มีกลุ่ม Students อยู่แล้วในเครื่อง ต้องการเพิ่มบัญชี std01 เข้าเป็นสมาชิกของกลุ่มนี้ด้วยคำสั่ง net ต้องพิมพ์คำสั่งใด',
    accept: [
      '^net(\\.exe)? localgroup "?students"? ([\\w.-]+\\\\)?std01 /add$',
      '^net(\\.exe)? localgroup "?students"? /add ([\\w.-]+\\\\)?std01$'
    ],
    example: 'net localgroup Students std01 /add',
    explain: 'รูปแบบคือ net localgroup ชื่อกลุ่ม ชื่อผู้ใช้ /add ถ้าใช้ /delete จะเป็นการเอาสมาชิกออก ระวังอย่าสลับตำแหน่งชื่อกลุ่มกับชื่อผู้ใช้',
    tags: ['net-localgroup', 'groups', 'command'] },

  { id: 'u10-016', unit: 10, week: 17, level: 'easy', type: 'command', os: 'windows',
    q: 'ต้องการดูรายละเอียดของบัญชี std01 เช่น บรรทัด Account active และ Local Group Memberships ต้องพิมพ์คำสั่งใด',
    accept: ['^net(\\.exe)? user std01$'],
    example: 'net user std01',
    explain: 'net user ตามด้วยชื่อบัญชีจะแสดงรายละเอียดของบัญชีนั้น ส่วน net user อย่างเดียวแสดงรายชื่อบัญชีทั้งหมดในเครื่อง',
    tags: ['net-user', 'command'] },

  { id: 'u10-017', unit: 10, week: 17, level: 'medium', type: 'scenario',
    context: 'นักเรียนแจ้งครูว่าเข้าสู่ระบบด้วยบัญชี std07 ไม่ได้ ทั้งที่มั่นใจว่ารหัสผ่านถูก ครูเปิด Command Prompt แบบผู้ดูแลแล้วสั่งดูข้อมูลบัญชี',
    pre: 'C:\\> net user std07\nUser name                    std07\nFull name                    Somchai Jaidee\nAccount active               No\nPassword expires             Never\nLocal Group Memberships      *Users\nThe command completed successfully.',
    steps: [
      { q: 'จากผลคำสั่ง สาเหตุที่ std07 เข้าระบบไม่ได้คือข้อใด',
        options: ['บัญชียังไม่ได้อยู่ในกลุ่มใดเลย', 'รหัสผ่านของบัญชีหมดอายุแล้ว', 'บัญชีถูกปิดใช้งาน (Disabled) อยู่', 'ชื่อเต็มของบัญชีพิมพ์ผิด'],
        correct: 2 },
      { q: 'ครูควรใช้คำสั่งใดเพื่อแก้ไข',
        options: ['net user std07 /active:yes', 'net user std07 /delete', 'net localgroup Users std07 /add', 'net user std07 /active:no'],
        correct: 0 },
      { q: 'บรรทัด Local Group Memberships ที่แสดง *Users หมายความว่าอย่างไร',
        options: ['std07 เป็นผู้ดูแลเครื่อง', 'std07 อยู่ในกลุ่ม Users', 'std07 ใช้ได้ทุกกลุ่มในเครื่อง', 'std07 ถูกลบออกจากกลุ่ม Users'],
        correct: 1 }
    ],
    explain: 'Account active เป็น No แสดงว่าบัญชีถูกปิดอยู่ จึงเข้าระบบไม่ได้แม้รหัสถูก แก้ด้วย net user std07 /active:yes ส่วนชื่อกลุ่มในผลคำสั่งจะมีเครื่องหมาย * นำหน้า เช่น *Users',
    tags: ['net-user', 'troubleshooting', 'disabled-account'] },

  { id: 'u10-018', unit: 10, week: 17, level: 'medium', type: 'diagram', diagram: 'users-groups',
    q: 'จากแผนภาพ ผู้ใช้ถูกจัดเข้ากลุ่ม แล้วกำหนดสิทธิ์โฟลเดอร์ที่กลุ่ม ข้อใดเป็นข้อดีหลักของวิธีนี้เมื่อเทียบกับการกำหนดสิทธิ์ทีละคน',
    answerType: 'choice',
    options: [
      'ผู้ใช้ไม่ต้องตั้งรหัสผ่านเพราะใช้รหัสของกลุ่ม',
      'สิทธิ์ของกลุ่มจะชนะ Deny ที่ตั้งไว้ทุกกรณี',
      'กลุ่มทำให้แชร์โฟลเดอร์ได้โดยไม่ต้องใช้ NTFS',
      'มีคนใหม่ก็แค่เพิ่มเข้ากลุ่มแล้วได้สิทธิ์ทันที'
    ],
    correct: 3,
    why: ['ผู้ใช้แต่ละคนยังมีรหัสผ่านของตัวเอง กลุ่มไม่มีรหัสผ่าน', 'Deny ชนะ Allow เสมอ ไม่ว่าจะมาจากกลุ่มหรือรายคน', 'สิทธิ์ NTFS ยังทำงานตามปกติ และกำหนดให้กลุ่มได้', ''],
    explain: 'การกำหนดสิทธิ์ให้กลุ่มทำครั้งเดียว เมื่อมีผู้ใช้ใหม่ก็เพิ่มเข้ากลุ่มแล้วได้สิทธิ์ทันที ไม่ต้องแก้สิทธิ์ทีละโฟลเดอร์ จัดการง่ายและลดความผิดพลาด',
    tags: ['groups', 'permissions'] },

  { id: 'u10-019', unit: 10, week: 17, level: 'easy', type: 'choice',
    q: 'นักเรียนพิมพ์คำสั่ง whoami แล้วได้ผลเป็น lab-pc07\\teacher ผลนี้บอกอะไร',
    options: [
      'กำลังใช้บัญชี teacher ของเครื่อง lab-pc07',
      'เครื่อง teacher เชื่อมต่ออยู่กับ lab-pc07',
      'บัญชี lab-pc07 อยู่ในกลุ่มชื่อ teacher',
      'แชร์ชื่อ teacher อยู่บนเครื่อง lab-pc07'
    ],
    correct: 0,
    why: ['', 'ผลของ whoami ไม่ได้แสดงการเชื่อมต่อระหว่างเครื่อง', 'ส่วนหน้า \\ คือชื่อเครื่อง ไม่ใช่ชื่อบัญชี', 'ที่อยู่ของแชร์จะขึ้นต้นด้วย \\\\ เช่น \\\\LAB-PC07\\teacher'],
    explain: 'whoami แสดงชื่อเครื่องและบัญชีที่กำลังใช้ในรูปแบบ ชื่อเครื่อง\\ชื่อผู้ใช้ จึงหมายถึงบัญชีภายในเครื่อง teacher บนเครื่อง lab-pc07',
    tags: ['whoami', 'user-account'] },

  { id: 'u10-020', unit: 10, week: 17, level: 'hard', type: 'match',
    q: 'จับคู่งานจัดการบัญชีใน Windows กับคำสั่งหรือแนวคิดที่ใช้แทนกันใน Linux',
    left: ['บัญชีผู้ดูแลสูงสุด (Administrator)', 'สร้างผู้ใช้ใหม่ (net user ชื่อ /add)', 'เพิ่มผู้ใช้เข้ากลุ่ม (net localgroup)', 'ปิดบัญชี (/active:no)'],
    right: ['usermod -aG กลุ่ม ผู้ใช้', 'root', 'usermod -L หรือ passwd -l', 'adduser หรือ useradd', 'chmod 777'],
    answer: [1, 3, 0, 2],
    explain: 'Linux ใช้ root เป็นผู้ดูแลสูงสุด สร้างผู้ใช้ด้วย adduser/useradd เพิ่มเข้ากลุ่มด้วย usermod -aG และล็อกบัญชีด้วย usermod -L หรือ passwd -l ส่วน chmod 777 เป็นการให้สิทธิ์ทุกคนเต็มที่ ซึ่งไม่ควรทำ',
    tags: ['linux', 'user-account', 'comparison'] },

  // ---------- week 18: permissions ----------
  { id: 'u10-021', unit: 10, week: 18, level: 'easy', type: 'choice',
    q: 'ในหน้า Give access to → Specific people ระดับสิทธิ์ Read/Write ทำให้ผู้ใช้ทำอะไรได้',
    options: [
      'เปิดดูและคัดลอกได้อย่างเดียว',
      'เปลี่ยนสิทธิ์ของคนอื่นได้ทั้งหมด',
      'สร้างไฟล์ได้แต่เปิดไฟล์คนอื่นไม่ได้',
      'อ่าน แก้ไข สร้าง และลบไฟล์ได้'
    ],
    correct: 3,
    why: ['เป็นความหมายของระดับ Read', 'การจัดการสิทธิ์ทั้งหมดเป็นของ Owner', 'Read/Write เปิดอ่านไฟล์ในแชร์ได้ด้วย', ''],
    explain: 'Read/Write ให้อ่าน แก้ไข สร้างไฟล์ใหม่ และลบไฟล์ได้ เหมาะกับโฟลเดอร์งานกลุ่ม ส่วน Read ทำได้แค่เปิดดู คัดลอก และรันไฟล์',
    tags: ['sharing', 'give-access-to', 'read-write'] },

  { id: 'u10-022', unit: 10, week: 18, level: 'medium', type: 'tf',
    q: 'ในหน้า Give access to ผู้ดูแลสามารถเลือกระดับสิทธิ์ Owner ให้ผู้ใช้คนอื่นได้ เช่นเดียวกับ Read และ Read/Write',
    answer: false,
    explain: 'ผิด Owner เป็นระดับที่แสดงให้เห็นสำหรับบัญชีที่สร้างแชร์เท่านั้น เลือกให้คนอื่นไม่ได้ ระดับที่เลือกให้ผู้อื่นได้คือ Read และ Read/Write',
    tags: ['sharing', 'give-access-to'] },

  { id: 'u10-023', unit: 10, week: 18, level: 'hard', type: 'choice',
    q: 'โฟลเดอร์ Project แชร์ให้ Everyone มีสิทธิ์ Share เป็น Full Control ส่วนแท็บ Security ให้กลุ่ม Students ได้ Read และกลุ่ม TeamA ได้ Modify ถ้า std05 อยู่ทั้งสองกลุ่มและเปิดผ่านเครือข่าย จะได้สิทธิ์จริงแบบใด',
    options: ['Read', 'Full Control', 'Modify', 'ไม่มีสิทธิ์'],
    correct: 2,
    why: ['สิทธิ์ NTFS จากหลายกลุ่มนำมารวมกัน จึงได้ Modify ไม่ใช่แค่ Read', 'NTFS ให้สูงสุดแค่ Modify จึงจำกัดไม่ให้ถึง Full Control', '', 'มีทั้งสิทธิ์ Share และ NTFS และไม่มี Deny จึงยังเข้าถึงได้'],
    explain: 'ขั้นแรกรวมสิทธิ์ NTFS จากทุกกลุ่มได้ Modify จากนั้นเทียบกับสิทธิ์ Share (Full Control) แล้วเลือกค่าที่เข้มงวดกว่า สิทธิ์จริงจึงเป็น Modify',
    tags: ['ntfs', 'share-permission', 'effective-permission'] },

  { id: 'u10-024', unit: 10, week: 18, level: 'hard', type: 'choice',
    q: 'โฟลเดอร์คะแนนให้กลุ่ม Teachers ได้ Allow Modify แต่ผู้ดูแลตั้ง Deny Read ให้กลุ่ม Interns ครูฝึกสอนชื่อ t09 อยู่ทั้งสองกลุ่ม t09 จะเปิดอ่านไฟล์คะแนนได้หรือไม่',
    options: [
      'ได้ เพราะสิทธิ์ของกลุ่ม Teachers สูงกว่า',
      'ไม่ได้ เพราะ Deny ที่ตั้งชัดเจนชนะ Allow',
      'ได้ เพราะ Modify รวมสิทธิ์ Read ไว้แล้ว',
      'ไม่ได้ เพราะอยู่สองกลุ่มพร้อมกันไม่ได้'
    ],
    correct: 1,
    why: ['สิทธิ์ที่สูงกว่าไม่ได้ชนะ Deny', '', 'แม้ Modify จะรวม Read แต่ Deny Read ที่ตั้งไว้ชัดเจนยังชนะ', 'ผู้ใช้หนึ่งคนอยู่หลายกลุ่มได้ตามปกติ'],
    explain: 'ถ้ามี Deny ที่ตั้งไว้ชัดเจน Deny จะชนะ Allow จึงต้องระวังการใช้ Deny เพราะอาจตัดสิทธิ์คนที่ไม่ได้ตั้งใจ ถ้าไม่ต้องการให้สิทธิ์ ปกติเพียงไม่ใส่ Allow ก็พอ',
    tags: ['ntfs', 'deny', 'effective-permission'] },

  { id: 'u10-025', unit: 10, week: 18, level: 'easy', type: 'diagram', diagram: 'unc-share',
    q: 'จากแผนภาพ เครื่องลูกข่ายเปิด \\\\SERVER\\Share ผ่านเครือข่ายต้องผ่านการตรวจสิทธิ์สองชั้น ชั้นใดที่มีผล "เฉพาะ" ผู้ที่เข้ามาทางเครือข่ายเท่านั้น',
    answerType: 'choice',
    options: ['สิทธิ์ NTFS ในแท็บ Security', 'สิทธิ์ Share ใน Advanced Sharing', 'สิทธิ์ของไฟล์ใน Credential Manager', 'สิทธิ์จาก Windows Defender Firewall'],
    correct: 1,
    why: ['สิทธิ์ NTFS มีผลทุกกรณี ทั้งในเครื่องและผ่านเครือข่าย', '', 'Credential Manager ใช้เก็บชื่อและรหัสผ่านที่จำไว้ ไม่ได้กำหนดสิทธิ์ไฟล์', 'ไฟร์วอลล์ไม่ได้กำหนดสิทธิ์อ่านเขียนไฟล์'],
    explain: 'สิทธิ์ Share เป็นด่านหน้าประตูที่ตรวจเฉพาะคนที่เข้ามาทางเครือข่าย ส่วนสิทธิ์ NTFS ติดอยู่กับไฟล์บนดิสก์และตรวจทุกครั้ง',
    tags: ['share-permission', 'ntfs', 'unc'] },

  { id: 'u10-026', unit: 10, week: 18, level: 'medium', type: 'match',
    q: 'จับคู่เครื่องมือหรือแนวคิดกับหน้าที่ให้ถูกต้อง',
    left: ['Share Permission', 'NTFS Permission', 'Effective Access', 'Credential Manager'],
    right: [
      'ดูสิทธิ์จริงของผู้ใช้ที่เลือกบนโฟลเดอร์',
      'ตั้งที่ Advanced Sharing มีผลเฉพาะทางเครือข่าย',
      'เก็บชื่อและรหัสผ่านที่สั่งให้ Windows จำไว้',
      'ตั้งที่แท็บ Security มีผลทั้งในเครื่องและเครือข่าย',
      'แปลงชื่อเครื่องเป็น IP Address'
    ],
    answer: [1, 3, 0, 2],
    explain: 'Share Permission ตั้งที่ Advanced Sharing NTFS ตั้งที่แท็บ Security Effective Access (Security → Advanced) ใช้ตรวจสิทธิ์จริง และ Credential Manager เก็บข้อมูลเข้าระบบที่จำไว้ ส่วนการแปลงชื่อเป็น IP เป็นงานของ DNS',
    tags: ['share-permission', 'ntfs', 'credential-manager'] },

  { id: 'u10-027', unit: 10, week: 18, level: 'medium', type: 'choice',
    q: 'ข้อใดขัดกับหลักให้สิทธิ์เท่าที่จำเป็น (Principle of Least Privilege) มากที่สุด',
    options: [
      'ให้นักเรียนอยู่กลุ่ม Users และให้ Read ในโฟลเดอร์ใบงาน',
      'ให้นักเรียนทุกคนเป็น Administrators เพื่อติดตั้งเกม',
      'ครูใช้บัญชีมาตรฐานทำงานทุกวัน และยืนยัน UAC เมื่อจำเป็น',
      'ทบทวนสิทธิ์และเอาสิทธิ์ที่ไม่ใช้ออกทุกภาคเรียน'
    ],
    correct: 1,
    why: ['เป็นการให้สิทธิ์เท่าที่งานต้องใช้ ตรงตามหลัก', '', 'การใช้สิทธิ์ผู้ดูแลเฉพาะเมื่อจำเป็นตรงตามหลัก', 'การทบทวนสิทธิ์เป็นระยะตรงตามหลัก'],
    explain: 'Least Privilege คือให้สิทธิ์เพียงพอต่องานเท่านั้น การให้ทุกคนเป็น Administrators ทำให้มัลแวร์หรือความผิดพลาดสร้างความเสียหายได้ทั้งเครื่อง',
    tags: ['least-privilege'] },

  { id: 'u10-028', unit: 10, week: 18, level: 'hard', type: 'choice',
    q: 'ทำไมจึงแนะนำให้ Disable บัญชีของพนักงานที่ลาออกก่อน แทนการลบ (Delete) ทันที',
    options: [
      'บัญชีที่ลบแล้วจะกลับมาเปิดใช้เองหลัง 30 วัน',
      'Windows ไม่อนุญาตให้ลบบัญชีที่เคยเข้าระบบมาแล้ว',
      'ลบแล้วสร้างชื่อเดิมใหม่จะได้ SID ใหม่ สิทธิ์เดิมหาย',
      'บัญชีที่ Disable ยังเข้าระบบได้ในฐานะผู้ใช้ Guest'
    ],
    correct: 2,
    why: ['บัญชีที่ลบแล้วไม่กลับมาเอง', 'ผู้ดูแลลบบัญชีที่เคยใช้งานได้ตามปกติ', '', 'บัญชีที่ Disable เข้าระบบไม่ได้เลย'],
    explain: 'Windows อ้างอิงบัญชีด้วย SID ไม่ใช่ชื่อ ถ้าลบแล้วสร้างใหม่ชื่อเดิมจะได้ SID ใหม่ สิทธิ์บนโฟลเดอร์เดิมจึงไม่กลับมา การ Disable ก่อนจึงย้อนกลับได้และมีเวลาโอนไฟล์งาน',
    tags: ['account-lifecycle', 'sid', 'disable'] },

  { id: 'u10-029', unit: 10, week: 18, level: 'medium', type: 'order',
    q: 'นักเรียนรุ่นพี่จบการศึกษาแล้ว เรียงลำดับการจัดการบัญชีของนักเรียนคนนั้นให้ถูกต้อง',
    items: [
      'ปิดใช้งานบัญชีทันที (Account is disabled หรือ /active:no)',
      'โอนหรือสำรองไฟล์งานที่จำเป็นไปให้ครูผู้รับผิดชอบ',
      'เมื่อพ้นระยะที่กำหนด เช่น 30 วัน ให้ลบบัญชี',
      'ลบโปรไฟล์ที่ค้างอยู่ในเครื่องเพื่อคืนพื้นที่ดิสก์'
    ],
    explain: 'ต้องปิดบัญชีทันทีเพื่อปิดช่องโหว่ แล้วโอนไฟล์งานที่จำเป็นก่อนลบ เมื่อพ้นระยะที่กำหนดจึงลบบัญชี และลบโปรไฟล์ที่ค้างเพื่อคืนพื้นที่ ควรบันทึกการดำเนินการทุกครั้ง',
    tags: ['account-lifecycle', 'disable', 'delete'] },

  { id: 'u10-030', unit: 10, week: 18, level: 'medium', type: 'command', os: 'windows',
    q: 'บัญชี somchai ถูกปิดใช้งานมาครบ 30 วันและโอนไฟล์งานเรียบร้อยแล้ว ต้องการลบบัญชีนี้ออกจากเครื่องด้วยคำสั่ง net ต้องพิมพ์คำสั่งใด',
    accept: ['^net(\\.exe)? user somchai /delete$', '^net(\\.exe)? user /delete somchai$'],
    example: 'net user somchai /delete',
    explain: 'net user ชื่อผู้ใช้ /delete ใช้ลบบัญชี ต้องเปิด Command Prompt แบบ Run as administrator และควรลบหลังปิดบัญชีและโอนไฟล์แล้วเท่านั้น',
    tags: ['net-user', 'account-lifecycle', 'command'] },

  { id: 'u10-031', unit: 10, week: 18, level: 'hard', type: 'scenario',
    context: 'ห้องแล็บใช้เครือข่ายแบบ Workgroup นักเรียนนั่งที่เครื่อง LAB-PC12 แล้วเปิด \\\\LAB-SERVER\\ส่งงาน จากนั้นมีหน้าต่าง Enter network credentials ขึ้นมา บนเครื่อง LAB-SERVER มีบัญชี std01 ของนักเรียนคนนี้อยู่แล้ว',
    steps: [
      { q: 'ควรกรอกชื่อผู้ใช้ในรูปแบบใด',
        options: ['LAB-PC12\\std01', 'std01@LAB-PC12', 'LAB-SERVER\\std01', '\\\\LAB-SERVER\\std01'],
        correct: 2 },
      { q: 'เข้าแชร์ได้แล้ว แต่บันทึกไฟล์ไม่ได้และขึ้น Access is denied ทั้งที่สิทธิ์ Share ของกลุ่ม Students เป็น Change ควรตรวจสิ่งใดต่อ',
        options: ['ค่า DNS ของเครื่อง LAB-PC12', 'สิทธิ์ Write ในแท็บ Security', 'โปรไฟล์ไฟร์วอลล์ของ LAB-PC12', 'ชื่อ Workgroup ของทั้งสองเครื่อง'],
        correct: 1 },
      { q: 'เครื่อง LAB-PC12 ใช้ร่วมกันหลายคน นักเรียนควรทำอย่างไรกับตัวเลือก Remember my credentials',
        options: ['ติ๊กไว้ จะได้ไม่ต้องกรอกรหัสอีก', 'ติ๊กไว้ แล้วแจ้งรหัสให้เพื่อนรู้ด้วย', 'ติ๊กไว้ แล้วล็อกหน้าจอทุกครั้ง', 'ไม่ติ๊ก เพราะคนถัดไปจะใช้บัญชีเราได้'],
        correct: 3 }
    ],
    explain: 'ใน Workgroup เซิร์ฟเวอร์ตรวจเฉพาะบัญชีของตัวเอง จึงต้องกรอก LAB-SERVER\\std01 การเข้าผ่านเครือข่ายต้องผ่านทั้งสิทธิ์ Share และ NTFS ถ้า Share เป็น Change แต่บันทึกไม่ได้ ต้องเพิ่มสิทธิ์ Write ในแท็บ Security และไม่ควรจำรหัสไว้บนเครื่องที่ใช้ร่วมกัน',
    tags: ['workgroup', 'unc', 'ntfs', 'credentials'] },

  { id: 'u10-032', unit: 10, week: 18, level: 'medium', type: 'tf',
    q: 'ในเครือข่ายแบบ Workgroup เมื่อเปิดแชร์บนเครื่องอื่นแล้วมีหน้าต่าง Enter network credentials ขึ้นมา ต้องกรอกบัญชีที่มีอยู่ในเครื่องปลายทาง ไม่ใช่บัญชีของเครื่องที่เรานั่งอยู่',
    answer: true,
    explain: 'ถูก ใน Workgroup แต่ละเครื่องเก็บบัญชีของตัวเอง เครื่องปลายทางไม่รู้จักบัญชีของเครื่องเรา จึงต้องกรอกบัญชีของเครื่องปลายทาง เช่น LAB-SERVER\\std01 พร้อมรหัสผ่านของบัญชีนั้น',
    tags: ['workgroup', 'credentials'] },

  { id: 'u10-033', unit: 10, week: 18, level: 'easy', type: 'choice',
    q: 'ต้องการ Map network drive ไปยังแชร์บนเซิร์ฟเวอร์โดยใช้บัญชีอื่นที่ไม่ใช่บัญชีที่ล็อกอินอยู่ ต้องติ๊กตัวเลือกใด',
    options: ['Reconnect at sign-in', 'Connect using different credentials', 'Remember my credentials', 'Account is disabled'],
    correct: 1,
    why: ['ตัวเลือกนี้ทำให้เชื่อมต่อไดรฟ์อีกครั้งเมื่อเข้าระบบ แต่ไม่ได้เปลี่ยนบัญชี', '', 'เป็นตัวเลือกในหน้าต่างกรอกรหัส ใช้จำรหัส ไม่ได้ใช้เลือกบัญชีอื่น', 'เป็นตัวเลือกปิดบัญชีใน Local Users and Groups'],
    explain: 'ในหน้าต่าง Map network drive ติ๊ก Connect using different credentials แล้ว Windows จะให้กรอกชื่อและรหัสผ่านของบัญชีอื่นสำหรับแชร์นั้น',
    tags: ['map-network-drive', 'credentials'] },

  { id: 'u10-034', unit: 10, week: 18, level: 'medium', type: 'command', os: 'linux',
    q: 'ใน Linux ต้องการตั้งสิทธิ์โฟลเดอร์ project ให้เจ้าของอ่าน เขียน และเข้าโฟลเดอร์ได้ สมาชิกกลุ่มอ่านและเข้าโฟลเดอร์ได้แต่แก้ไม่ได้ ส่วนคนอื่นไม่มีสิทธิ์เลย ต้องพิมพ์คำสั่งใด (ใช้ chmod)',
    accept: [
      '^(sudo )?chmod 0?750 (\\./)?project/?$',
      '^(sudo )?chmod u=rwx,g=rx,o= (\\./)?project/?$',
      '^(sudo )?chmod u=rwx,g=rx,o-rwx (\\./)?project/?$'
    ],
    example: 'chmod 750 project',
    explain: 'เจ้าของ rwx = 4+2+1 = 7 กลุ่ม r-x = 4+1 = 5 คนอื่น --- = 0 จึงเป็น chmod 750 project (ได้ drwxr-x---) หรือเขียนแบบตัวอักษร chmod u=rwx,g=rx,o= project ก็ได้',
    tags: ['linux', 'chmod', 'permissions', 'command'] },

  { id: 'u10-035', unit: 10, week: 18, level: 'easy', type: 'fill',
    q: 'ใน Linux สิทธิ์ rwxr-xr-x เขียนเป็นเลขฐานแปดได้ {{1}} และสิทธิ์ rw-r----- เขียนได้ {{2}}',
    blanks: [['755', '0755'], ['640', '0640']],
    explain: 'ใช้ r=4 w=2 x=1 แล้วบวกในแต่ละชุด rwx=7 r-x=5 r-x=5 จึงเป็น 755 และ rw-=6 r--=4 ---=0 จึงเป็น 640',
    tags: ['linux', 'octal', 'permissions'] },

  { id: 'u10-036', unit: 10, week: 18, level: 'hard', type: 'diagram', diagram: 'linux-perms',
    q: 'ไฟล์ notes.txt แสดงสิทธิ์ -r--rw-r-- เจ้าของคือ teacher และกลุ่มคือ staff ถ้าผู้ใช้ teacher (ซึ่งเป็นสมาชิกกลุ่ม staff ด้วย) พยายามแก้ไขไฟล์นี้ จะเกิดอะไรขึ้น',
    answerType: 'choice',
    options: [
      'แก้ได้ เพราะใช้สิทธิ์ rw- ของกลุ่ม staff แทน',
      'แก้ได้ เพราะเจ้าของไฟล์แก้ได้ทุกกรณี',
      'แก้ไม่ได้ เพราะ others มีแค่สิทธิ์ r--',
      'แก้ไม่ได้ เพราะใช้แค่สิทธิ์ r-- ของเจ้าของ'
    ],
    correct: 3,
    why: ['Linux ไม่ใช้ชุดของกลุ่มกับเจ้าของไฟล์ แม้เจ้าของจะอยู่ในกลุ่มนั้น', 'เจ้าของไฟล์ถูกจำกัดตามชุดสิทธิ์แรก (ยกเว้น root)', 'ชุด others ใช้กับคนที่ไม่ใช่เจ้าของและไม่อยู่กลุ่มเท่านั้น', ''],
    explain: 'Linux ตรวจตามลำดับ ถ้าเป็นเจ้าของจะใช้ชุดแรกเท่านั้น teacher เป็นเจ้าของจึงได้แค่ r-- แก้ไขไม่ได้ แม้กลุ่ม staff จะมี rw- ก็ตาม',
    tags: ['linux', 'permissions', 'owner'] },

  { id: 'u10-037', unit: 10, week: 18, level: 'easy', type: 'choice',
    q: 'ใน Linux สิทธิ์ x ที่ตั้งให้กับไดเรกทอรี (โฟลเดอร์) มีความหมายว่าอย่างไร',
    options: [
      'เข้าไปในโฟลเดอร์นั้นได้ (เช่น cd เข้าไป)',
      'ลบโฟลเดอร์นั้นทิ้งได้ทันทีโดยไม่ถาม',
      'แก้ไขไฟล์ทุกไฟล์ในโฟลเดอร์นั้นได้ทั้งหมด',
      'ซ่อนโฟลเดอร์ไม่ให้แสดงในผลของคำสั่ง ls'
    ],
    correct: 0,
    why: ['', 'การลบไม่ได้มาจากสิทธิ์ x เพียงอย่างเดียว', 'การแก้ไขไฟล์ขึ้นกับสิทธิ์ w ของแต่ละไฟล์', 'สิทธิ์ x ไม่ได้ทำให้โฟลเดอร์ถูกซ่อน'],
    explain: 'สำหรับไฟล์ x หมายถึงรันเป็นโปรแกรมได้ แต่สำหรับโฟลเดอร์ x หมายถึงเข้าไปในโฟลเดอร์นั้นได้',
    tags: ['linux', 'permissions', 'directory'] },

  { id: 'u10-038', unit: 10, week: 18, level: 'easy', type: 'choice',
    q: 'ผลของคำสั่ง ls -l บรรทัดหนึ่งขึ้นต้นด้วย drwxr-xr-x ตัวอักษร d ตัวแรกบอกอะไร',
    options: [
      'ไฟล์นี้ถูกลบ (deleted) ไปแล้ว',
      'รายการนี้เป็นไดเรกทอรี (โฟลเดอร์)',
      'เจ้าของปิดสิทธิ์ (disabled) ไว้',
      'เป็นไฟล์ที่ดาวน์โหลด (download) มา'
    ],
    correct: 1,
    why: ['ls -l ไม่แสดงไฟล์ที่ถูกลบแล้ว', '', 'สิทธิ์อยู่ใน 9 ตัวถัดไป ไม่ใช่ตัวแรก', 'ตัวแรกบอกชนิดของรายการ ไม่ได้บอกที่มา'],
    explain: 'ตัวอักษรแรกบอกชนิด - คือไฟล์ธรรมดา d คือไดเรกทอรี ส่วน 9 ตัวถัดไปคือสิทธิ์ของเจ้าของ กลุ่ม และคนอื่น ชุดละ 3 ตัว',
    tags: ['linux', 'ls', 'permissions'] }
];
