# Planfin HC10909 · รพ.พลับพลาชัย

แดชบอร์ดการเงินสำหรับโรงพยาบาลพลับพลาชัย (รหัส 10909) จ.บุรีรัมย์ รวม 2 แดชบอร์ดไว้ในหน้าเดียว เลือกดูด้วยปุ่มด้านบน และมีระบบแจ้งเตือนเงินโอนเข้ากลุ่ม LINE ผ่าน MOPH Notify ไม่ต้องล็อกอิน

| ปุ่ม | เนื้อหา | ไฟล์ |
| --- | --- | --- |
| เงินโอน สปสช. | การโอนเงินกองทุนรายหน่วยบริการ จากระบบ Smart Money Transfer (smt.nhso.go.th) | `public/dashboards/smt/` + `data/smt.json` |
| ผลงาน MIS | ผลงานบริการและการชดเชย จาก NHSO-MIS for Hospital (mishos.nhso.go.th) | `public/dashboards/mis/` + `data/mis.json` |
| แจ้งเตือน LINE | สถานะระบบแจ้งเตือน ตัวอย่างข้อความ และขั้นตอนตั้งค่า | `app/notify-panel.tsx` |

ลิงก์ตรงไปแต่ละหน้า: `/?view=smt`, `/?view=mis`, `/?view=notify`

## ติดตั้งด้วย Docker (port 5200)

ต้องรันบนเครื่องที่อยู่ในประเทศไทย เพราะเว็บ smt.nhso.go.th และ mishos.nhso.go.th ไม่รับการเชื่อมต่อจากต่างประเทศ

```bash
git clone https://github.com/Jacob-SSR/NHSO-MIS-for-Hospital.git
cd NHSO-MIS-for-Hospital
cp .env.example .env          # ใส่ MOPH_NOTIFY_CLIENT_KEY / MOPH_NOTIFY_SECRET_KEY
docker compose up -d --build  # เปิด http://<ip เครื่อง>:5200
```

มี 2 container ใช้ image เดียวกัน และใช้ volume `planfin-data` ร่วมกัน:

| service | หน้าที่ |
| --- | --- |
| `web` | เว็บแดชบอร์ดที่ port 5200 อ่านไฟล์ข้อมูลจาก volume ทุกครั้งที่มีคนเปิด จึงเห็นข้อมูลใหม่ทันทีโดยไม่ต้อง build ใหม่ |
| `worker` | `scripts/scheduler.mjs` เช็กเงินโอนและแจ้งเตือนทุก 30 นาที, อัปเดตข้อมูล SMT ทุกวัน 07:10 น. และ MIS 07:25 น. (เวลาไทย) ถ้าเครื่องปิดอยู่ตอนนั้น จะอัปเดตทันทีที่เปิดเครื่อง |

คำสั่งที่ใช้บ่อย:

```bash
docker compose logs -f worker                                        # ดูการทำงานของงานตามเวลา
docker compose exec worker node scripts/smt-notify.mjs --test        # ทดสอบส่งข้อความเข้ากลุ่ม LINE
docker compose exec worker node scripts/fetch-smt-data.mjs           # อัปเดตข้อมูลเงินโอนเดี๋ยวนี้
docker compose exec worker node scripts/fetch-mis-data.mjs           # อัปเดตข้อมูล MIS เดี๋ยวนี้
git pull && docker compose up -d --build                             # อัปเดตโปรแกรม (ข้อมูลใน volume ไม่หาย)
```

ตั้งค่าเพิ่มเติมใน `.env` ได้ (ดู `.env.example`): `DASHBOARD_URL` (ปุ่มลิงก์ใต้ข้อความ LINE เช่น `http://192.168.1.10:5200/?view=smt`),
`NOTIFY_INTERVAL_MINUTES`, `SMT_DATA_TIME`, `MIS_DATA_TIME` แก้แล้วสั่ง `docker compose up -d` อีกครั้ง

## พัฒนาบนเครื่อง (ไม่ใช้ Docker)

```bash
npm install
npm run dev        # http://localhost:3000 (อ่านข้อมูลจากโฟลเดอร์ data/)
```

## ระบบแจ้งเตือนเงินโอน (MOPH Notify)

ทุกครั้งที่ สปสช. โอนเงินเข้า รพ. 10909 ไม่ว่าจะมาจากกองทุนไหน `scripts/smt-notify.mjs` จะส่งข้อความ Flex เข้ากลุ่ม LINE **Planfin HC10909**:
ยอดโอนสุทธิ วันที่โอน ยอดชะลอ/หัก และรายการว่าเงินมาจากกองทุนย่อยไหน สิทธิอะไร

ตั้งค่าครั้งเดียว:

1. สร้างกลุ่ม LINE ชื่อ `Planfin HC10909` (ต้องตั้งชื่อก่อนเพิ่มบอท)
2. เชิญบัญชี LINE **หมอพร้อม** เข้ากลุ่ม
3. Admin หน่วยบริการเข้า CMS MOPH Notify → กลุ่มบอท → จัดการ → อนุมัติ
4. กดรูปตาที่ช่อง API Key แล้วนำ Client_ID / Secret ไปใส่ใน `.env` เป็น `MOPH_NOTIFY_CLIENT_KEY` / `MOPH_NOTIFY_SECRET_KEY` แล้วสั่ง `docker compose up -d`
5. `docker compose exec worker node scripts/smt-notify.mjs --test` ถ้าข้อความเข้ากลุ่มแสดงว่าใช้งานได้

ครั้งแรกระบบจะจำรายการที่มีอยู่แล้วไว้ (ไม่ส่งย้อนหลัง) และส่งข้อความ "เริ่มระบบแจ้งเตือน" เข้ากลุ่ม ถ้ายังไม่ได้ใส่ key รายการใหม่จะรอไว้และส่งเมื่อใส่ key แล้ว
รายการที่แจ้งแล้วเก็บใน `notify-state.json` ใน volume และแสดงในหน้า "แจ้งเตือน LINE"
ตัวเลือกอื่นของสคริปต์: `--dry-run` แสดงข้อความที่จะส่งโดยไม่ส่งจริง, `--seed` จำรายการปัจจุบันทั้งหมดโดยไม่แจ้ง

## แหล่งข้อมูล

- **เงินโอน (SMT):** `scripts/fetch-smt-data.mjs` ดึงรายงานการโอนเงินแยกตามหน่วยบริการของทุก รพ. ในจังหวัด ย้อนหลัง 3 ปีงบ
- **ผลงาน MIS:** `scripts/fetch-mis-data.mjs` ดึงจากรายงานเดียวกับที่หน้าเว็บ mishos.nhso.go.th ใช้ (ไม่ต้องล็อกอิน) ได้แก่ 9.1 กรมบัญชีกลาง, 9.2 อปท., 1.1 OPAE, 1.4 Walk-in, 0.1 รายรับแยกกองทุน, 0.2 Statement UC, 4.1–4.5 ค่าใช้จ่ายสูง/อุปกรณ์, 8.2 MOPH-Claim, 8.3 KTP

ถ้าดึงข้อมูลได้น้อยผิดปกติ สคริปต์จะไม่เขียนทับไฟล์เดิม

## ที่มา

แดชบอร์ดทั้งสองคัดลอกมาจากต้นฉบับ Design by Moveon · Orapat Viriyaudomsiri ปรับธีมเป็นสีเขียวมิ้นต์ใน `public/dashboards/mint.css`
