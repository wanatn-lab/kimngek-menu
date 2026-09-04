# กิมเง็ก ข้าวหมูแดงเกรดพิธี

เว็บไซต์เมนูแบบ static สำหรับ Cloudflare Workers Static Assets พร้อม SEO/GEO และ Decap CMS ที่ `/admin`.

## เนื้อหาที่ติดตั้งแล้ว

- ดีไซน์เดิมจากไฟล์ต้นฉบับ: โทนไวน์/ทอง/ครีม, Hero ภาษาไทย และหัวข้อเลขไทย ๐๑–๐๕
- เมนูจริง 6 รายการ พร้อมภาพอาหารที่เลือกจากภาพที่ผู้ใช้ให้มา รองรับหมวดหมู่ วิดีโอ และป้าย "เมนูแนะนำ"
- SEO/GEO: canonical, Open Graph, Twitter Card, Restaurant/FAQ/Menu/BlogPosting/Breadcrumb schema (ฝังแบบ static ทุกหน้า ไม่พึ่ง JavaScript), `robots.txt` (list AI crawler ชัดเจน: GPTBot, ClaudeBot, PerplexityBot ฯลฯ) และ `sitemap.xml`
- Decap CMS ที่ `/admin/` สำหรับแก้ข้อมูลร้าน, แบนเนอร์ประกาศ, Hero หน้าแรก/เกี่ยวกับเรา, เมนู และ**เขียน/แก้/ลบบทความบล็อกได้เต็มรูปแบบ**
- `scripts/build-blog.js` — สร้างหน้าบทความ HTML, `blog/index.html` และ `sitemap.xml` ใหม่จากไฟล์ markdown ใน `site/data/blog/` (ไม่ต้องติดตั้ง dependency เพิ่ม ใช้ Node.js เปล่าๆ)
- `.github/workflows/build-deploy.yml` — เมื่อมีการบันทึกจากหน้า `/admin` (เท่ากับ commit เข้า `main`) ระบบจะรัน build script และ deploy ขึ้น Cloudflare ให้อัตโนมัติ

URL ปัจจุบันใน canonical และ sitemap คือ `https://kimngek-menu.wanat-n.workers.dev/` หากเปลี่ยนเป็น custom domain ให้ปรับ URL เหล่านี้พร้อมกัน (แก้ค่า `SITE_URL` ใน `scripts/build-blog.js` ด้วย)

## เปิดใช้งานระบบ deploy อัตโนมัติ (แนะนำ)

เพื่อให้แก้บทความ/เมนู/ข้อมูลร้านจากหน้า `/admin` แล้วเว็บอัปเดตเองโดยไม่ต้องรันคำสั่งเอง ต้องเพิ่ม secret 2 ตัวใน GitHub repo (Settings → Secrets and variables → Actions):

1. `CLOUDFLARE_API_TOKEN` — สร้างที่ Cloudflare dashboard → My Profile → API Tokens → Create Token → เลือกสิทธิ์ "Edit Cloudflare Workers"
2. `CLOUDFLARE_ACCOUNT_ID` — ดูที่มุมขวาของหน้า Cloudflare dashboard (Workers & Pages)

หลังตั้ง secret แล้ว ทุกครั้งที่บันทึกจากหน้าแอดมิน GitHub Actions จะ build บทความใหม่และ deploy ขึ้น Cloudflare ให้อัตโนมัติภายในไม่กี่นาที ไม่ต้องรัน `wrangler deploy` เองอีก

หากยังไม่ตั้ง secret ไว้ ให้รันด้วยมือแทน:
```
node scripts/build-blog.js
cd site && npx wrangler deploy --name kimngek-menu
```

## Deploy บน Cloudflare Workers

1. สร้าง repository บน GitHub แล้ว push โค้ดชุดนี้ไปยัง branch `main`.
2. จากโฟลเดอร์ `site/` รัน `npx wrangler deploy --name kimngek-menu`.
3. `site/wrangler.toml` จะเผยแพร่ไฟล์ static ทั้งหมดด้วย Workers Static Assets และ `.assetsignore` จะเก็บไฟล์ต้นฉบับ HEIC/ZIP ไว้ใน GitHub แต่ไม่นำขึ้น public assets.
4. ตรวจ URL, `/robots.txt`, `/sitemap.xml` และ `/admin/` หลัง deploy.
5. เพิ่มโดเมนจริงใน Google Search Console และส่ง sitemap ของโดเมนนั้น.

## เปิดใช้งานหลังบ้าน `/admin`

Decap CMS เขียนไฟล์ JSON กลับเข้า GitHub จึงต้องใช้ GitHub OAuth proxy แยกต่างหากบน Cloudflare Worker:

1. สร้าง GitHub OAuth App โดยตั้ง **Homepage URL** เป็น URL ของ Worker และ **Authorization callback URL** เป็น `https://kimngek-cms-auth.wanat-n.workers.dev/callback`.
2. OAuth Worker ถูกตั้งชื่อเป็น `kimngek-cms-auth` ใน `worker/wrangler.toml`; เปลี่ยน `GITHUB_REPO_PRIVATE` เป็น `"1"` เฉพาะเมื่อ repository เป็น private แล้ว deploy Worker.
3. เพิ่ม secrets `GITHUB_OAUTH_ID` และ `GITHUB_OAUTH_SECRET` ให้ Worker ผ่าน Cloudflare Dashboard หรือ `npx wrangler secret put` (ห้ามใส่ secrets ไว้ใน Git).
4. `site/admin/config.yml` ตั้ง `base_url` เป็น `https://kimngek-cms-auth.wanat-n.workers.dev` แล้ว.

เมื่อเจ้าของร้านล็อกอินที่ `/admin` แล้ว จะสามารถแก้ข้อมูลร้าน เมนู ราคา และอัปโหลดรูปเมนูได้ โดยทุกการบันทึกจะเป็น commit ใหม่ใน GitHub; จากนั้น deploy เว็บไซต์หลักด้วย Wrangler ตามขั้นตอนด้านบน.

## ตรวจสอบในเครื่อง

เว็บเป็น static site จึงเปิดโฟลเดอร์ `site` ด้วย static server ใดก็ได้ หรือใช้ `npx serve site` แล้วตรวจ `/`, `/blog/` และ `/admin/`.
