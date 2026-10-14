# Planfin HC10909 · รพ.พลับพลาชัย

แดชบอร์ดการเงินสำหรับโรงพยาบาลพลับพลาชัย (รหัส 10909) จ.บุรีรัมย์ รวม 2 แดชบอร์ดไว้ในหน้าเดียว เลือกดูด้วยปุ่มด้านบน และมีระบบแจ้งเตือนเงินโอนเข้ากลุ่ม LINE ผ่าน MOPH Notify ไม่ต้องล็อกอิน

| ปุ่ม | เนื้อหา | ไฟล์ |
| --- | --- | --- |
| เงินโอน สปสช. | การโอนเงินกองทุนรายหน่วยบริการ จากระบบ Smart Money Transfer (smt.nhso.go.th) | `public/dashboards/smt/` (`data.json`) |
| ผลงาน MIS | ผลงานบริการและการชดเชย จาก NHSO-MIS for Hospital (mishos.nhso.go.th) | `public/dashboards/mis/` (`mis.json`) |
| แจ้งเตือน LINE | สถานะระบบแจ้งเตือน ตัวอย่างข้อความ และขั้นตอนตั้งค่า | `app/notify-panel.tsx` |

ลิงก์ตรงไปแต่ละหน้า: `/?view=smt`, `/?view=mis`, `/?view=notify`

## รันบนเครื่อง

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## ระบบแจ้งเตือนเงินโอน (MOPH Notify)

ทุกครั้งที่ สปสช. โอนเงินเข้า รพ. 10909 ไม่ว่าจะมาจากกองทุนไหน สคริปต์ `scripts/smt-notify.mjs` จะส่งข้อความ Flex เข้ากลุ่ม LINE **Planfin HC10909**:
ยอดโอนสุทธิ วันที่โอน ยอดชะลอ/หัก และรายการว่าเงินมาจากกองทุนย่อยไหน สิทธิอะไร

### ตั้งค่า (ครั้งเดียว)

1. สร้างกลุ่ม LINE ชื่อ `Planfin HC10909` (ต้องตั้งชื่อก่อนเพิ่มบอท)
2. เชิญบัญชี LINE **หมอพร้อม** เข้ากลุ่ม
3. Admin หน่วยบริการเข้า CMS MOPH Notify → กลุ่มบอท → จัดการ → อนุมัติ
4. กดรูปตาที่ช่อง API Key แล้วนำ Client_ID และ Secret ไปใส่เป็น GitHub secrets
   (Settings → Secrets and variables → Actions):
   - `MOPH_NOTIFY_CLIENT_KEY` = Client_ID
   - `MOPH_NOTIFY_SECRET_KEY` = Secret
   - (ไม่บังคับ) ตัวแปร `DASHBOARD_URL` ใน Variables จะแสดงปุ่ม "ดูรายละเอียดในแดชบอร์ด" ใต้ข้อความ
5. Actions → **แจ้งเตือนเงินโอน สปสช. (MOPH Notify)** → Run workflow → mode `test` ถ้าข้อความเข้ากลุ่มแสดงว่าใช้งานได้

หลังจากนั้น workflow จะตรวจทุก 30 นาทีเอง ครั้งแรกระบบจะจำรายการที่มีอยู่แล้วไว้ (ไม่ส่งย้อนหลัง) และส่งข้อความ "เริ่มระบบแจ้งเตือน" เข้ากลุ่ม
รายการที่แจ้งแล้วเก็บใน `public/notify/state.json` (workflow commit กลับเข้า repo) และแสดงในหน้า "แจ้งเตือน LINE"

> GitHub รันงานตามเวลาเฉพาะบน default branch เท่านั้น ต้อง merge เข้า branch หลักก่อน

### รันบนเครื่องเซิร์ฟเวอร์ รพ. แทน GitHub Actions

ถ้าเว็บ SMT ไม่ตอบ request จากเครื่องของ GitHub (อยู่ต่างประเทศ) ให้รันบนเครื่องใน รพ. ที่มี Node.js 20 ขึ้นไป:

```bash
# .env.local
MOPH_NOTIFY_CLIENT_KEY=...
MOPH_NOTIFY_SECRET_KEY=...

node --env-file=.env.local scripts/smt-notify.mjs --test     # ทดสอบส่งข้อความ
node --env-file=.env.local scripts/smt-notify.mjs            # ตรวจและแจ้งเตือน 1 รอบ
```

ตั้ง cron ทุก 30 นาที: `*/30 * * * * cd /path/to/repo && node --env-file=.env.local scripts/smt-notify.mjs >> notify.log 2>&1`
(Windows ใช้ Task Scheduler รันคำสั่งเดียวกัน)

ตัวเลือกอื่น: `--dry-run` แสดงข้อความที่จะส่งโดยไม่ส่งจริง, `--seed` จำรายการปัจจุบันทั้งหมดโดยไม่แจ้ง

## อัปเดตข้อมูลแดชบอร์ด

- **เงินโอน (SMT):** workflow **อัปเดตข้อมูลเงินโอน SMT** รัน `node scripts/fetch-smt-data.mjs` ทุกวัน 07:10 น. แล้ว commit `public/dashboards/smt/data.json` (สั่งรันเองได้จากแท็บ Actions)
- **ผลงาน MIS:** ระบบ MIS ต้องล็อกอิน จึงยังเป็นข้อมูล ณ 12 ต.ค. 2569 ถ้ามีไฟล์ใหม่ให้แทนที่ `public/dashboards/mis/mis.json` (รูปแบบเดิม)

## ที่มา

แดชบอร์ดทั้งสองคัดลอกมาจากต้นฉบับ Design by Moveon · Orapat Viriyaudomsiri ปรับธีมเป็นสีเขียวมิ้นต์ใน `public/dashboards/mint.css`
