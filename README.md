# กิมเง็ก ข้าวหมูแดงเกรดพิธี

เว็บไซต์เมนูแบบ static สำหรับ Cloudflare Workers Static Assets พร้อม SEO/GEO และ Decap CMS ที่ `/admin`.

## เนื้อหาที่ติดตั้งแล้ว

- ดีไซน์เดิมจากไฟล์ต้นฉบับ: โทนไวน์/ทอง/ครีม, Hero ภาษาไทย และหัวข้อเลขไทย ๐๑–๐๕
- เมนูจริง 6 รายการ พร้อมภาพอาหารที่เลือกจากภาพที่ผู้ใช้ให้มา
- SEO/GEO: canonical, Open Graph, Twitter Card, Restaurant/FAQ/Menu/BlogPosting/Breadcrumb schema, `robots.txt` และ `sitemap.xml`
- Decap CMS ที่ `/admin/` สำหรับแก้ข้อมูลร้านและเมนูใน GitHub

URL ปัจจุบันใน canonical และ sitemap คือ `https://kimngek-menu.wanat-n.workers.dev/` หากเปลี่ยนเป็น custom domain ให้ปรับ URL เหล่านี้พร้อมกัน

## Deploy บน Cloudflare Workers

1. สร้าง repository บน GitHub แล้ว push โค้ดชุดนี้ไปยัง branch `main`.
2. จากโฟลเดอร์ `site/` รัน `npx wrangler deploy --name kimngek-menu`.
3. `site/wrangler.toml` จะเผยแพร่ไฟล์ static ทั้งหมดด้วย Workers Static Assets และ `.assetsignore` จะเก็บไฟล์ต้นฉบับ HEIC/ZIP ไว้ใน GitHub แต่ไม่นำขึ้น public assets.
4. ตรวจ URL, `/robots.txt`, `/sitemap.xml` และ `/admin/` หลัง deploy.
5. เพิ่มโดเมนจริงใน Google Search Console และส่ง sitemap ของโดเมนนั้น.

## เปิดใช้งานหลังบ้าน `/admin`

Decap CMS เขียนไฟล์ JSON กลับเข้า GitHub จึงต้องใช้ GitHub OAuth proxy แยกต่างหากบน Cloudflare Worker:

1. สร้าง GitHub OAuth App โดยตั้ง **Homepage URL** เป็น URL ของ Worker และ **Authorization callback URL** เป็น `https://kimngek-cms-auth.wanat-n.workers.dev/callback?provider=github`.
2. OAuth Worker ถูกตั้งชื่อเป็น `kimngek-cms-auth` ใน `worker/wrangler.toml`; เปลี่ยน `GITHUB_REPO_PRIVATE` เป็น `"1"` เฉพาะเมื่อ repository เป็น private แล้ว deploy Worker.
3. เพิ่ม secrets `GITHUB_OAUTH_ID` และ `GITHUB_OAUTH_SECRET` ให้ Worker ผ่าน Cloudflare Dashboard หรือ `npx wrangler secret put` (ห้ามใส่ secrets ไว้ใน Git).
4. `site/admin/config.yml` ตั้ง `base_url` เป็น `https://kimngek-cms-auth.wanat-n.workers.dev` แล้ว.

เมื่อเจ้าของร้านล็อกอินที่ `/admin` แล้ว จะสามารถแก้ข้อมูลร้าน เมนู ราคา และอัปโหลดรูปเมนูได้ โดยทุกการบันทึกจะเป็น commit ใหม่ใน GitHub; จากนั้น deploy เว็บไซต์หลักด้วย Wrangler ตามขั้นตอนด้านบน.

## ตรวจสอบในเครื่อง

เว็บเป็น static site จึงเปิดโฟลเดอร์ `site` ด้วย static server ใดก็ได้ หรือใช้ `npx serve site` แล้วตรวจ `/`, `/blog/` และ `/admin/`.
