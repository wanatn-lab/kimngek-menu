#!/usr/bin/env node
/**
 * สร้างหน้าบทความ blog/*.html, blog/index.html และ sitemap.xml
 * จากไฟล์ markdown ใน site/data/blog/*.md (แก้ไขได้จากหน้าแอดมิน /admin)
 *
 * รันด้วย: node scripts/build-blog.js
 * ไม่ต้องติดตั้ง dependency ใด ๆ เพิ่ม (ใช้แค่ Node.js มาตรฐาน)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const BLOG_SRC = path.join(SITE, 'data', 'blog');
const BLOG_OUT = path.join(SITE, 'blog');
const SITE_URL = 'https://kimngek-khaomoodang.wanat-n.workers.dev';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  m[1].split(/\r?\n/).forEach(function (line) {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    data[key] = val;
  });
  return { data: data, body: m[2] };
}

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
    return '<a href="' + escapeHtml(url) + '">' + label + '</a>';
  });
  return out;
}

// รองรับ markdown แบบง่าย: ## หัวข้อย่อย, - รายการ, ย่อหน้าปกติ, **ตัวหนา**, [ลิงก์](url)
function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  function isBullet(l) { return /^[-*+]\s/.test(l.trim()); }
  function isHeading(l) { return /^#{1,3}\s/.test(l); }
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('### ')) { html.push('<h3>' + inline(line.slice(4).trim()) + '</h3>'); i++; continue; }
    if (line.startsWith('## ')) { html.push('<h2>' + inline(line.slice(3).trim()) + '</h2>'); i++; continue; }
    if (line.startsWith('# ')) { html.push('<h2>' + inline(line.slice(2).trim()) + '</h2>'); i++; continue; }
    if (isBullet(line)) {
      const items = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push('<li>' + inline(lines[i].trim().slice(2).trim()) + '</li>');
        i++;
      }
      html.push('<ul>' + items.join('') + '</ul>');
      continue;
    }
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isHeading(lines[i]) && !isBullet(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    html.push('<p>' + inline(para.join(' ').trim()) + '</p>');
  }
  return html.join('\n  ');
}

function loadPosts() {
  if (!fs.existsSync(BLOG_SRC)) return [];
  return fs.readdirSync(BLOG_SRC)
    .filter(function (f) { return f.endsWith('.md'); })
    .map(function (f) {
      const raw = fs.readFileSync(path.join(BLOG_SRC, f), 'utf8');
      const parsed = parseFrontmatter(raw);
      const data = parsed.data;
      if (!data.slug) data.slug = f.replace(/\.md$/, '');
      return { data: data, bodyHtml: markdownToHtml(parsed.body) };
    })
    .filter(function (p) { return p.data.published !== false; })
    .sort(function (a, b) {
      const pinDiff = (b.data.pinned ? 1 : 0) - (a.data.pinned ? 1 : 0);
      if (pinDiff !== 0) return pinDiff;
      return String(b.data.date || '').localeCompare(String(a.data.date || ''));
    });
}

function restaurantSchema(site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': SITE_URL + '/#restaurant',
    name: site.name,
    image: SITE_URL + '/images/og-kimngek.jpg',
    logo: SITE_URL + '/images/og-kimngek.jpg',
    servesCuisine: 'ข้าวหมูแดง / อาหารไทย-จีน',
    priceRange: '฿฿',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '21/9 ถนนขุนช้าง ตำบลท่าพี่เลี้ยง',
      addressLocality: 'อำเภอเมืองสุพรรณบุรี',
      addressRegion: 'สุพรรณบุรี',
      postalCode: '72000',
      addressCountry: 'TH'
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.gps_lat, longitude: site.gps_lng },
    telephone: '+66' + String(site.phone_raw || '').replace(/^0/, ''),
    url: SITE_URL + '/',
    sameAs: [site.facebook_url, site.instagram_url, site.tiktok_url, site.gbp_url].filter(Boolean),
    hasMap: 'https://share.google/WnN6dRmrsV8P9isHG',
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: site.open_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: site.hours_open,
      closes: site.hours_close
    }]
  };
}

function headTags(site, opts) {
  // opts: title, description, canonical, ogType, image, extraSchemas: [obj,...]
  const lines = [];
  lines.push('<meta charset="utf-8">');
  lines.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  lines.push('<title>' + escapeHtml(opts.title) + '</title>');
  lines.push('<meta name="description" content="' + escapeHtml(opts.description) + '">');
  lines.push('<link rel="canonical" href="' + opts.canonical + '">');
  lines.push('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
  lines.push('<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">');
  lines.push('<link rel="apple-touch-icon" href="/favicon-180.png">');
  lines.push('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">');
  lines.push('<meta name="theme-color" content="#57120C">');
  lines.push('<meta name="geo.placename" content="Suphan Buri">');
  lines.push('<meta name="geo.region" content="TH-72">');
  lines.push('<meta name="geo.position" content="' + site.gps_lat + ';' + site.gps_lng + '">');
  lines.push('<meta name="ICBM" content="' + site.gps_lat + ', ' + site.gps_lng + '">');
  lines.push('<meta property="og:type" content="' + opts.ogType + '">');
  lines.push('<meta property="og:locale" content="th_TH">');
  lines.push('<meta property="og:site_name" content="' + escapeHtml(site.name) + '">');
  lines.push('<meta property="og:title" content="' + escapeHtml(opts.title) + '">');
  lines.push('<meta property="og:description" content="' + escapeHtml(opts.description) + '">');
  lines.push('<meta property="og:url" content="' + opts.canonical + '">');
  lines.push('<meta property="og:image" content="' + opts.image + '">');
  lines.push('<meta property="og:image:alt" content="' + escapeHtml(site.name) + '">');
  lines.push('<meta property="og:image:width" content="1200">');
  lines.push('<meta property="og:image:height" content="630">');
  lines.push('<meta property="og:image:type" content="image/jpeg">');
  lines.push('<meta name="twitter:card" content="summary_large_image">');
  lines.push('<meta name="twitter:title" content="' + escapeHtml(opts.title) + '">');
  lines.push('<meta name="twitter:description" content="' + escapeHtml(opts.description) + '">');
  lines.push('<meta name="twitter:image" content="' + opts.image + '">');
  lines.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
  lines.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
  lines.push('<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Noto+Serif+Thai:wght@500;600;700&display=swap" onload="this.onload=null;this.rel=\'stylesheet\'">');
  lines.push('<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Noto+Serif+Thai:wght@500;600;700&display=swap"></noscript>');
  lines.push('<link rel="stylesheet" href="../assets/style.css">');
  lines.push('<script type="application/ld+json">' + JSON.stringify(restaurantSchema(site)) + '</script>');
  (opts.extraSchemas || []).forEach(function (s) {
    lines.push('<script type="application/ld+json">' + JSON.stringify(s) + '</script>');
  });
  return lines.join('\n');
}

function headerFooter(site) {
  const header =
    '<header class="hdr">\n' +
    '  <div class="hdr-in">\n' +
    '    <a class="brand" href="/">\n' +
    '      <span class="seal">ก</span>\n' +
    '      <span style="display:flex;flex-direction:column;min-width:0">\n' +
    '        <span class="bname">กิมเง็ก</span>\n' +
    '        <span class="bsub">ข้าวหมูแดงเกรดพิธี · สุพรรณบุรี</span>\n' +
    '      </span>\n' +
    '    </a>\n' +
    '    <nav class="nav-d">\n' +
    '      <a href="/#menu">เมนูอาหาร</a>\n' +
    '      <a href="/#about">เกี่ยวกับเรา</a>\n' +
    '      <a href="/blog/">บทความ</a>\n' +
    '      <a href="/#contact">แผนที่ &amp; ติดต่อ</a>\n' +
    '    </nav>\n' +
    '    <a class="btn-call" href="tel:' + escapeHtml(site.phone_raw) + '">📞 โทรสั่ง</a>\n' +
    '    <button class="burger" id="burger" aria-label="เปิดเมนู" aria-expanded="false">☰</button>\n' +
    '  </div>\n' +
    '  <div class="nav-m" id="navm">\n' +
    '    <nav>\n' +
    '      <a href="/#menu">เมนูอาหาร</a>\n' +
    '      <a href="/#about">เกี่ยวกับเรา</a>\n' +
    '      <a href="/blog/">บทความ</a>\n' +
    '      <a href="/#faq">คำถามที่พบบ่อย</a>\n' +
    '      <a href="/#contact">แผนที่ &amp; ติดต่อ</a>\n' +
    '    </nav>\n' +
    '  </div>\n' +
    '</header>';
  const footer =
    '<footer>\n' +
    '  <div class="wrap" style="padding:0">\n' +
    '    <div class="ft">' + escapeHtml(site.name) + '</div>\n' +
    '    <p class="sl">รมควันข้ามคืน ราดซอสสูตรเฉพาะ · ' + escapeHtml(site.hours_display) + '</p>\n' +
    '    <nav>\n' +
    '      <a href="/#menu">เมนูอาหาร</a>\n' +
    '      <a href="/#about">เกี่ยวกับเรา</a>\n' +
    '      <a href="/blog/">บทความ</a>\n' +
    '      <a href="/#faq">คำถามที่พบบ่อย</a>\n' +
    '      <a href="/#contact">แผนที่ &amp; ติดต่อ</a>\n' +
    '      <a href="' + escapeHtml(site.facebook_url) + '" target="_blank" rel="noopener">เฟซบุ๊ก</a>\n' +
    '    </nav>\n' +
    '    <div class="nap">\n' +
    '      <div>' + escapeHtml(site.name) + '</div>\n' +
    '      <div>' + escapeHtml(site.address) + '</div>\n' +
    '      <div>โทร. <a href="tel:' + escapeHtml(site.phone_raw) + '">' + escapeHtml(site.phone_display) + '</a> · ' + escapeHtml(site.hours_display) + '</div>\n' +
    '      <div class="copy">© <span id="yr">' + new Date().getFullYear() + '</span> ' + escapeHtml(site.name) + ' สุพรรณบุรี</div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</footer>\n' +
    '<div class="callbar"><a href="tel:' + escapeHtml(site.phone_raw) + '">📞 โทรสั่ง ' + escapeHtml(site.phone_display) + '</a></div>';
  return { header: header, footer: footer };
}

function renderPostPage(site, post, allPosts) {
  const url = SITE_URL + '/blog/' + post.data.slug;
  const coverImage = SITE_URL + post.data.cover_image;
  const ogImage = SITE_URL + '/images/og-kimngek.jpg'; // การ์ดแชร์ใช้รูปกลางของร้าน ขนาด 1200x630 คงที่เสมอ
  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: url,
    headline: post.data.title,
    description: post.data.meta_description,
    image: coverImage,
    datePublished: post.data.date,
    author: { '@type': 'Organization', name: site.name },
    publisher: { '@type': 'Organization', name: site.name }
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'บทความ', item: SITE_URL + '/blog/' },
      { '@type': 'ListItem', position: 3, name: post.data.title, item: url }
    ]
  };
  const hf = headerFooter(site);
  const head = headTags(site, {
    title: post.data.title + ' | ' + site.name,
    description: post.data.meta_description,
    canonical: url,
    ogType: 'article',
    image: ogImage,
    extraSchemas: [blogSchema, breadcrumb]
  });
  return '<!DOCTYPE html>\n<html lang="th">\n<head>\n' + head + '\n</head>\n<body>' + hf.header + '\n<main class="article">\n' +
    '  <p class="meta">' + escapeHtml(post.data.category || '') + '</p>\n' +
    '  <h1>' + escapeHtml(post.data.title) + '</h1>\n' +
    '  <img src="..' + post.data.cover_image + '" alt="' + escapeHtml(post.data.title) + '">\n' +
    '  ' + post.bodyHtml + '\n' +
    '  <p><a class="backlink" href="/blog/">← ดูบทความทั้งหมด</a></p>\n' +
    '  <p class="note"><a href="/#menu">ดูเมนูและราคา</a> · <a href="/#contact">แผนที่ &amp; ติดต่อ</a> · โทร <a href="tel:' + escapeHtml(site.phone_raw) + '">' + escapeHtml(site.phone_display) + '</a></p>\n' +
    '</main>\n' + hf.footer + '\n<script src="../assets/site.js" defer></script>\n</body>\n</html>\n';
}

function renderBlogIndex(site, posts) {
  const url = SITE_URL + '/blog/';
  const hf = headerFooter(site);
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'บทความ', item: url }
    ]
  };
  const head = headTags(site, {
    title: 'บทความ ความรู้เรื่องข้าวหมูแดง | ' + site.name,
    description: 'รวมบทความเรื่องข้าวหมูแดงสุพรรณบุรี วิธีรมควันข้ามคืน และเรื่องเล่าจากครัวร้าน' + site.name,
    canonical: url,
    ogType: 'website',
    image: SITE_URL + '/images/og-kimngek.jpg',
    extraSchemas: [breadcrumb]
  });
  const rows = posts.map(function (p) {
    return '      <a class="brow" href="/blog/' + p.data.slug + '">\n' +
      '        <img src="..' + p.data.cover_image + '" alt="' + escapeHtml(p.data.title) + '" loading="lazy" width="74" height="74">\n' +
      '        <div style="flex:1;min-width:0"><span class="k">' + escapeHtml(p.data.category || '') + '</span><h3>' + escapeHtml(p.data.title) + '</h3></div>\n' +
      '        <span class="arw" aria-hidden="true">→</span>\n' +
      '      </a>';
  }).join('\n');
  return '<!DOCTYPE html>\n<html lang="th">\n<head>\n' + head + '\n</head>\n<body>' + hf.header + '\n<main class="sec" style="padding-top:32px">\n' +
    '  <div class="shead"><span class="num">๐๓</span><span class="kicker">บทความทั้งหมด</span></div>\n' +
    '  <h2>ความรู้เรื่องข้าวหมูแดง</h2>\n' +
    '  <div class="rule"></div>\n' +
    '  <div class="list bloglist">\n' + rows + '\n  </div>\n' +
    '</main>\n' + hf.footer + '\n<script src="../assets/site.js" defer></script>\n</body>\n</html>\n';
}

function renderSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: SITE_URL + '/', changefreq: 'weekly', priority: '1.0' },
    { loc: SITE_URL + '/blog/', changefreq: 'weekly', priority: '0.7' }
  ].concat(posts.map(function (p) {
    return { loc: SITE_URL + '/blog/' + p.data.slug, changefreq: 'monthly', priority: '0.6' };
  }));
  const body = urls.map(function (u) {
    return '  <url><loc>' + u.loc + '</loc><lastmod>' + today + '</lastmod><changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority + '</priority></url>';
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>\n';
}

// สร้างไฟล์ _redirects เพื่อบังคับให้ URL แบบ .html เก่า redirect แบบ 301 (ถาวร)
// ไปหา URL แบบสะอาด (ไม่มี .html) แทนที่จะปล่อยให้ Cloudflare ใช้ 307 (ชั่วคราว) อัตโนมัติ
// - Google แนะนำให้สัญญาณ canonical/sitemap/redirect ชี้ไป URL เดียวกันแบบถาวร
function renderRedirects(posts) {
  const lines = [
    '/index.html / 301',
    '/blog/index.html /blog/ 301'
  ].concat(posts.map(function (p) {
    return '/blog/' + p.data.slug + '.html /blog/' + p.data.slug + ' 301';
  }));
  return lines.join('\n') + '\n';
}

function main() {
  const site = readJson(path.join(SITE, 'data', 'site.json'));
  const posts = loadPosts();

  if (!fs.existsSync(BLOG_OUT)) fs.mkdirSync(BLOG_OUT, { recursive: true });

  // ลบไฟล์ .html เก่าที่ไม่ตรงกับบทความปัจจุบัน (กัน slug ที่ลบไปแล้วค้างอยู่)
  const keepFiles = new Set(posts.map(function (p) { return p.data.slug + '.html'; }).concat(['index.html']));
  fs.readdirSync(BLOG_OUT).forEach(function (f) {
    if (f.endsWith('.html') && !keepFiles.has(f)) fs.unlinkSync(path.join(BLOG_OUT, f));
  });

  posts.forEach(function (post) {
    const html = renderPostPage(site, post, posts);
    fs.writeFileSync(path.join(BLOG_OUT, post.data.slug + '.html'), html, 'utf8');
    console.log('เขียนแล้ว: site/blog/' + post.data.slug + '.html');
  });

  fs.writeFileSync(path.join(BLOG_OUT, 'index.html'), renderBlogIndex(site, posts), 'utf8');
  console.log('เขียนแล้ว: site/blog/index.html');

  fs.writeFileSync(path.join(SITE, 'sitemap.xml'), renderSitemap(posts), 'utf8');
  console.log('เขียนแล้ว: site/sitemap.xml');

  fs.writeFileSync(path.join(SITE, '_redirects'), renderRedirects(posts), 'utf8');
  console.log('เขียนแล้ว: site/_redirects');

  console.log('เสร็จสิ้น: สร้างบทความทั้งหมด ' + posts.length + ' รายการ');
}

main();
