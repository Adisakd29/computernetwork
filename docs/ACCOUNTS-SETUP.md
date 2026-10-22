# ตั้งค่าระบบสมาชิก: อีเมล และ Google Sign-in (NetLab 2.7)

ระบบสมาชิกใช้ฐานข้อมูล PostgreSQL ตัวเดิมบน Railway ไม่ต้องติดตั้งบริการใหม่
ตารางและคอลัมน์ที่เพิ่มจะถูกสร้างอัตโนมัติตอนเซิร์ฟเวอร์เริ่มทำงาน การเปลี่ยนแปลงเป็นแบบเพิ่มอย่างเดียว บัญชีและคะแนนเดิมจึงอยู่ครบ

ถ้ายังไม่ตั้งค่าส่วนใด ปุ่มหรือฟอร์มของส่วนนั้นจะไม่แสดง ส่วนอื่นยังใช้งานได้ตามปกติ

## 1. ตัวแปรบน Railway (Service → Variables)

| ตัวแปร | ตัวอย่าง | จำเป็น |
|---|---|---|
| `PUBLIC_URL` | `https://computernetwork.up.railway.app` | ใช่ ลิงก์ในอีเมลและ Redirect URI ของ Google สร้างจากค่านี้ |
| `APP_SECRET` | สตริงสุ่มยาว 40 ตัวขึ้นไป | ใช่ ใช้เซ็นข้อมูลชั่วคราวระหว่างเข้าสู่ระบบด้วย Google |
| `NODE_ENV` | `production` | ใช่ ปิดค่าทดสอบทั้งหมด และบังคับใช้ `PUBLIC_URL` |
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | สำหรับ Google |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | สำหรับ Google เก็บบนเซิร์ฟเวอร์เท่านั้น ห้ามใส่ในโค้ด |
| `SMTP_URL` | `smtps://netlab.school%40gmail.com:abcdabcdabcdabcd@smtp.gmail.com:465` | สำหรับอีเมล (เลือกอย่างใดอย่างหนึ่งกับ `RESEND_API_KEY`) |
| `RESEND_API_KEY` | `re_...` | สำหรับอีเมลผ่าน Resend |
| `MAIL_FROM` | `NetLab <netlab.school@gmail.com>` | สำหรับอีเมล |

ตัวแปร `GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_JWKS_URL`, `GOOGLE_ISSUER`, `MAIL_DEV_DIR` และ `EMAIL_MX_CHECK` ใช้เฉพาะการทดสอบอัตโนมัติ
เมื่อ `NODE_ENV=production` ระบบจะไม่สนใจตัวแปรเหล่านี้ ห้ามตั้งบน Railway

## 2. สร้าง Google OAuth Client

หน้าจอ Google Cloud อาจเปลี่ยนชื่อเมนูได้ แต่ขั้นตอนหลักเหมือนเดิม

1. **สร้างโปรเจกต์:** เปิด https://console.cloud.google.com แล้วสร้างโปรเจกต์ใหม่ เช่น `NetLab`
2. **ตั้งค่าหน้าขอสิทธิ์:** ไปที่ **Google Auth Platform** (หรือ APIs & Services → OAuth consent screen)
   - **Branding:** ชื่อแอป `NetLab`, อีเมลสำหรับติดต่อ, ลิงก์ Privacy policy `https://computernetwork.up.railway.app/#/privacy` และลิงก์ Terms `https://computernetwork.up.railway.app/#/terms`
   - **Audience:** เลือก External
     - ระหว่างทดสอบ (Testing) จะเข้าสู่ระบบได้เฉพาะอีเมลที่เพิ่มใน Test users
     - เมื่อพร้อมใช้กับทั้งห้องให้กด **Publish app**
     - แอปนี้ขอเฉพาะ openid, email และ profile ซึ่งเป็นสิทธิ์พื้นฐาน
   - **Data Access:** เพิ่ม scope `openid`, `.../auth/userinfo.email` และ `.../auth/userinfo.profile`
3. **สร้าง Client:** ไปที่ **Clients → Create client** แล้วเลือก Application type เป็น **Web application**
   - **Authorized JavaScript origins:** `https://computernetwork.up.railway.app`
   - **Authorized redirect URIs:** `https://computernetwork.up.railway.app/api/auth/google/callback`
4. **ใส่ค่าใน Railway:** คัดลอก Client ID และ Client secret ไปใส่ใน Railway (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) แล้ว Redeploy
5. **ทดสอบ:** เปิด `/#/login` แล้วกด "ดำเนินการต่อด้วย Google" ถ้า Google แจ้ง `redirect_uri_mismatch` ให้ตรวจว่า `PUBLIC_URL` และ Redirect URI ตรงกันทุกตัวอักษร (https, ไม่มี / ท้าย origin)

ถ้าภายหลังเปลี่ยนไปใช้โดเมนของสถานศึกษา ต้องแก้ทั้ง `PUBLIC_URL` และค่าในข้อ 3

## 3. ตั้งค่าการส่งอีเมล

**ทางเลือก A: Gmail ของสถานศึกษาหรือของครู**
1. เปิด 2-Step Verification ของบัญชี Gmail นั้น
2. สร้าง App password ที่ https://myaccount.google.com/apppasswords จะได้รหัส 16 ตัว (ไม่ต้องใส่ช่องว่าง)
3. ตั้งค่า `SMTP_URL=smtps://อีเมล:รหัสแอป@smtp.gmail.com:465` โดยเปลี่ยน `@` ในอีเมลเป็น `%40` เช่น `smtps://netlab.school%40gmail.com:abcdabcdabcdabcd@smtp.gmail.com:465`
4. ตั้งค่า `MAIL_FROM=NetLab <netlab.school@gmail.com>`

Gmail ส่งได้ประมาณ 500 ฉบับต่อวัน ซึ่งพอสำหรับการยืนยันอีเมลและลืมรหัสผ่านของหลายห้อง

**ทางเลือก B: Resend** (ต้องมีโดเมนของตัวเองที่ยืนยันใน Resend แล้ว) ตั้งค่า `RESEND_API_KEY` และ `MAIL_FROM=NetLab <no-reply@โดเมนของคุณ>`

**ตรวจผล:** สมัครด้วยอีเมลจริงหนึ่งบัญชี แล้วดูว่าได้รับอีเมล "ยืนยันอีเมลเพื่อเริ่มใช้ NetLab" ถ้าไม่ได้รับ ให้ดู log ของ Railway ที่ขึ้นต้นด้วย `verify mail failed`

## 4. สิ่งที่ระบบทำให้อัตโนมัติ

- **รหัสผ่าน:** รหัสผ่านใหม่เข้ารหัสด้วย Argon2id ส่วนรหัสผ่านเดิมแบบ scrypt จะอัปเกรดเป็น Argon2id ให้เองเมื่อเข้าสู่ระบบครั้งถัดไป
- **บัญชีที่ไม่ยืนยันอีเมล:** ถูกลบหลัง 7 วัน และไม่มีข้อมูลการเรียนอยู่แล้ว
- **ลิงก์ในอีเมล:** ใช้ได้ครั้งเดียว ลิงก์ยืนยันอีเมลหมดอายุใน 24 ชั่วโมง ลิงก์ตั้งรหัสผ่านใหม่หมดอายุใน 30 นาที เมื่อตั้งรหัสผ่านใหม่ อุปกรณ์อื่นทั้งหมดจะถูกออกจากระบบ
- **Google:** ระบบไม่รวมบัญชีด้วยการเทียบอีเมล การเชื่อม Google เข้ากับบัญชีเดิมต้องเข้าสู่ระบบบัญชีเดิมก่อน แล้วกด "เชื่อมบัญชี Google" ในหน้าโปรไฟล์
- **บัญชีครู:** นักเรียนสมัครเป็นครูเองไม่ได้ ผู้ดูแลระบบเป็นผู้สร้างบัญชีครูเหมือนเดิม
