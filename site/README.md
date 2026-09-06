# กิมเง็ก ข้าวหมูแดงเกรดพิธี — เว็บไซต์พร้อมนำไปวางโครงสร้าง

## โครงสร้างไฟล์
```
site/
  index.html                                  หน้าเดียวครบทุกเซคชัน (#menu #about #blog #faq #contact)
  blog/index.html                             หน้ารวมบทความ
  blog/khao-moo-dang-suphanburi-where-to-eat.html
  blog/overnight-smoked-khao-moo-dang.html
  assets/style.css                            สไตล์ทั้งเว็บ (ที่เดียว)
  assets/site.js                              เมนูมือถือ + FAQ + ปีใน footer
  images/                                     วางรูปจริงตามชื่อไฟล์ด้านล่าง
  robots.txt  sitemap.xml
```

## รูปที่ใช้ใน images/
| ไฟล์ | ใช้ที่ | แนะนำขนาด |
|---|---|---|
| `hero-khao-moo-dang.jpg` | Hero | 900×1125 (แนวตั้ง 4:5) |
| `about-grilling.jpg` | About | 1200×900 |
| `khao-moo-dang.jpg` ถึง `moo-dang-kilo.jpg` | เมนู 6 รายการ | สี่เหลี่ยมจัตุรัส |
| `blog-where-to-eat.jpg`, `blog-overnight-smoked.jpg` | ภาพบทความ | 1200×675 |
| `og-kimngek.jpg` | OG/Twitter | 1200×630 |

## แก้ข้อมูลหลังบ้าน

เปิด `/admin/` แล้วเข้าสู่ระบบ GitHub เพื่อแก้ข้อมูลร้านจาก `data/site.json` และเมนูจาก `data/menu.json` ได้โดยไม่ต้องแก้ HTML โดยตรง รูปใหม่จะถูกเก็บใน `images/` และเมนูรองรับราคาแบบ `60` หรือ `280/กก.`

ก่อนใช้หลังบ้าน ให้เปลี่ยน `base_url: "[WORKER_URL]"` ใน `admin/config.yml` เป็น URL ของ OAuth Worker ที่ติดตั้งไว้

## NAP (ต้องเขียนเหมือนกันทุกที่ รวม Google Maps + Facebook)
กิมเง็ก ข้าวหมูแดงเกรดพิธี
21/9 ถนนขุนช้าง ตำบลท่าพี่เลี้ยง อำเภอเมืองสุพรรณบุรี จังหวัดสุพรรณบุรี 72000
085-529-8799 · เปิดอังคาร–อาทิตย์ 07:30 – 14:00 น. (ปิดทุกวันจันทร์)

## เพิ่มบทความใหม่
ก๊อป `blog/overnight-smoked-khao-moo-dang.html` เป็นไฟล์ใหม่ → แก้ title/description/canonical/เนื้อหา → เพิ่มลิงก์ใน `blog/index.html` และในบล็อกการ์ดของ `index.html` → เพิ่ม `<url>` ใน sitemap.xml

## Deploy บน Cloudflare

จากโฟลเดอร์นี้รัน `npx wrangler deploy --name kimngek-khaomoodang` โดยมี `wrangler.toml` สำหรับ Workers Static Assets อยู่แล้ว หลัง deploy ให้ตรวจ `https://kimngek-khaomoodang.wanat-n.workers.dev/` และแก้ canonical/OG/sitemap เป็นโดเมนจริงหากมี custom domain
