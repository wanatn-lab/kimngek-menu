# กิมเง็ก ข้าวหมูแดงเกรดพิธี

เว็บไซต์เมนูแบบ static สำหรับ Cloudflare Pages พร้อม SEO/GEO และ Decap CMS ที่ `/admin`.

## ข้อมูลที่ต้องเติมก่อนเผยแพร่จริง

เอกสารต้นทางไม่มีเว็บไซต์เดิมหรือรูปเมนูมาให้ จึงมีเฉพาะรายการเมนูที่ระบุรายละเอียดจริงในบรีฟ 1 รายการ และไฟล์รูป `images/khao-moo-dang.jpg` รอให้อัปโหลดผ่าน CMS หรือเพิ่มลงโฟลเดอร์นั้นโดยตรงก่อนเผยแพร่จริง

แก้ placeholder เหล่านี้ก่อนใช้งานจริง:

- `[DOMAIN_จริง]` ใน canonical, schema, sitemap และไฟล์บทความ
- `[WORKER_URL]` ใน `site/admin/config.yml`
- `WORKER_NAME` และ `GITHUB_REPO_PRIVATE` ใน `worker/wrangler.toml`

## Deploy บน Cloudflare Pages

1. สร้าง repository บน GitHub แล้ว push โค้ดชุดนี้ไปยัง branch `main`.
2. ใน Cloudflare Dashboard เลือก **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. เลือก repository นี้ ตั้งค่า **Production branch** เป็น `main`, **Build command** เป็นค่าว่าง และ **Build output directory** เป็น `site`.
4. Deploy ครั้งแรก แล้วคัดลอกโดเมน Pages จริงมาแทน `[DOMAIN_จริง]` ในไฟล์ที่ระบุข้างต้น จากนั้น push อีกครั้ง.
5. เพิ่มโดเมนจริงใน Google Search Console และส่ง `https://[DOMAIN_จริง]/sitemap.xml`.

## เปิดใช้งานหลังบ้าน `/admin`

Decap CMS เขียนไฟล์ JSON กลับเข้า GitHub จึงต้องใช้ GitHub OAuth proxy แยกต่างหากบน Cloudflare Worker:

1. สร้าง GitHub OAuth App โดยตั้ง **Homepage URL** เป็น URL ของ Worker และ **Authorization callback URL** เป็น `[WORKER_URL]/callback`.
2. ใน `worker/` ตั้งชื่อ Worker ให้เหมาะสมใน `wrangler.toml`, เลือก `GITHUB_REPO_PRIVATE = "1"` หาก repository เป็น private แล้ว deploy Worker.
3. เพิ่ม secrets `GITHUB_OAUTH_ID` และ `GITHUB_OAUTH_SECRET` ให้ Worker ผ่าน Cloudflare Dashboard หรือ `npx wrangler secret put` (ห้ามใส่ secrets ไว้ใน Git).
4. นำ URL ของ Worker ไปแทน `[WORKER_URL]` และใส่ชื่อเจ้าของ/ชื่อ repository ใน `site/admin/config.yml` แล้ว push อีกครั้ง.

เมื่อเจ้าของร้านล็อกอินที่ `/admin` แล้ว จะสามารถแก้ข้อมูลร้าน เมนู ราคา และอัปโหลดรูปเมนูได้ โดยทุกการบันทึกจะเป็น commit ใหม่ใน GitHub และ Cloudflare Pages จะ deploy ตาม branch `main`.

## ตรวจสอบในเครื่อง

เว็บเป็น static site จึงเปิดโฟลเดอร์ `site` ด้วย static server ใดก็ได้ หรือใช้ `npx serve site` แล้วตรวจ `/`, `/blog/` และ `/admin/`.
