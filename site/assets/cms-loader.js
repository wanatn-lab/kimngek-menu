(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
    });
  }

  function setText(el, text) {
    if (!el || text == null) return;
    el.textContent = text;
  }

  function applySiteData(site) {
    document.querySelectorAll("[data-cms]").forEach(function (el) {
      var key = el.getAttribute("data-cms");
      if (site[key] != null && site[key] !== "") setText(el, site[key]);
    });
    document.querySelectorAll("[data-cms-href]").forEach(function (el) {
      var key = el.getAttribute("data-cms-href");
      if (site[key] != null && el.tagName === "A" && (el.getAttribute("href") || "").indexOf("tel:") === 0) {
        el.setAttribute("href", "tel:" + site[key]);
      }
    });
    document.querySelectorAll("[data-cms-src]").forEach(function (el) {
      var key = el.getAttribute("data-cms-src");
      if (site[key]) el.setAttribute("src", site[key]);
    });
    document.querySelectorAll("[data-cms-facebook]").forEach(function (el) {
      if (site.facebook_url) el.setAttribute("href", site.facebook_url);
    });
    var mapFrame = document.querySelector("[data-cms-map]");
    if (mapFrame && site.gps_lat && site.gps_lng) {
      mapFrame.src = "https://maps.google.com/maps?q=" + site.gps_lat + "," + site.gps_lng + "&z=16&output=embed";
    }
    var banner = document.getElementById("cmsBanner");
    if (banner) {
      if (site.banner_text && String(site.banner_text).trim() !== "") {
        banner.hidden = false;
      } else {
        banner.hidden = true;
      }
    }
  }

  function renderMenu(items) {
    var container = document.getElementById("menu-list");
    if (!container || !Array.isArray(items)) return;
    var html = items.map(function (item) {
      var name = escapeHtml(item.name);
      var desc = escapeHtml(item.desc);
      var image = escapeHtml(item.image);
      var price = escapeHtml(item.price);
      var category = item.category ? '<span class="tag">' + escapeHtml(item.category) + '</span>' : '';
      var featured = item.featured ? '<span class="badge-star">⭐ เมนูแนะนำ</span>' : '';
      var video = item.video ? '<a class="video-link" href="' + escapeHtml(item.video) + '" target="_blank" rel="noopener">▶ ดูวิดีโอเมนู</a>' : '';
      return "" +
        '<article class="row" data-image="' + image + '" data-name="' + name + '" data-price="' + price + '" data-desc="' + desc + '" data-category="' + escapeHtml(item.category || "") + '" data-featured="' + (item.featured ? "1" : "") + '" data-video="' + escapeHtml(item.video || "") + '">' +
        '<img class="thumb" src="' + image + '" alt="' + name + ' — ข้าวหมูแดงเกรดพิธี ร้านกิมเง็ก สุพรรณบุรี" loading="lazy" width="78" height="78">' +
        '<div class="body">' +
        '<div class="priceline"><h3>' + name + '</h3><span class="dots"></span><span class="price">฿' + price + '</span></div>' +
        (featured || category ? '<div class="tagrow">' + featured + category + '</div>' : '') +
        '<p>' + desc + '</p>' +
        video +
        '</div>' +
        '</article>';
    }).join("");
    container.innerHTML = html || '<p class="empty-menu">กำลังอัปเดตรายการเมนู</p>';
  }

  function injectMenuSchema(items) {
    if (!Array.isArray(items) || !items.length) return;
    var schema = {
      "@context": "https://schema.org",
      "@type": "Menu",
      "name": "เมนูข้าวหมูแดงเกรดพิธี ร้านกิมเง็ก สุพรรณบุรี",
      "hasMenuSection": [{
        "@type": "MenuSection",
        "name": "เมนูหลัก",
        "hasMenuItem": items.map(function (item) {
          var priceMatch = String(item.price || "").match(/\d+(?:\.\d+)?/);
          return {
            "@type": "MenuItem",
            "name": item.name,
            "description": item.desc,
            "offers": { "@type": "Offer", "price": priceMatch ? priceMatch[0] : "", "priceCurrency": "THB" }
          };
        })
      }]
    };
    var existing = document.getElementById("menu-schema");
    if (existing) {
      existing.textContent = JSON.stringify(schema);
    } else {
      var script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "menu-schema";
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }

  var SITE_URL = "https://kimngek-khaomoodang.wanat-n.workers.dev";
  var ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // สร้าง Restaurant schema จากข้อมูล site.json สดๆ แล้วเขียนทับก้อน JSON-LD ที่ฝังไว้ในหน้า
  // เพื่อให้เวลาเปิด-ปิด, sameAs และข้อมูลร้านตรงกับที่ตั้งค่าไว้ในหน้าแอดมินเสมอ
  // ไม่ต้องแก้ไฟล์ index.html เองทุกครั้งที่เปลี่ยนเวลาเปิด-ปิดหรือลิงก์โซเชียล
  function buildRestaurantSchema(site) {
    var days = Array.isArray(site.open_days) && site.open_days.length ? site.open_days : ALL_DAYS;
    return {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      "@id": SITE_URL + "/#restaurant",
      "name": site.name,
      "image": SITE_URL + "/images/og-kimngek.jpg",
      "logo": SITE_URL + "/images/og-kimngek.jpg",
      "servesCuisine": "ข้าวหมูแดง / อาหารไทย-จีน",
      "priceRange": "฿฿",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "21/9 ถนนขุนช้าง ตำบลท่าพี่เลี้ยง",
        "addressLocality": "อำเภอเมืองสุพรรณบุรี",
        "addressRegion": "สุพรรณบุรี",
        "postalCode": "72000",
        "addressCountry": "TH"
      },
      "geo": { "@type": "GeoCoordinates", "latitude": site.gps_lat, "longitude": site.gps_lng },
      "telephone": "+66" + String(site.phone_raw || "").replace(/^0/, ""),
      "url": SITE_URL + "/",
      "sameAs": [site.facebook_url, site.instagram_url, site.tiktok_url, site.gbp_url].filter(Boolean),
      "hasMap": "https://share.google/WnN6dRmrsV8P9isHG",
      "openingHoursSpecification": [{
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": days,
        "opens": site.hours_open,
        "closes": site.hours_close
      }]
    };
  }

  function injectRestaurantSchema(site) {
    var existing = document.getElementById("restaurant-schema");
    if (existing) existing.textContent = JSON.stringify(buildRestaurantSchema(site));
  }

  // คำตอบ FAQ ข้อแรก (เวลาเปิด-ปิด) ต้องอ้างอิงจาก hours_display เดียวกับที่แสดงบนหน้าเว็บ
  // ข้ออื่นเป็นข้อมูลคงที่ไม่เกี่ยวกับเวลาเปิด-ปิด
  function injectFaqSchema(site) {
    var existing = document.getElementById("faq-schema");
    if (!existing) return;
    var hoursText = (site.hours_display || "") + " วันหยุดหมูแดงมักหมดก่อนเวลาปิด แนะนำโทรถามก่อนที่ " + (site.phone_display || "");
    var schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "ร้านเปิดกี่โมง ปิดกี่โมง", "acceptedAnswer": { "@type": "Answer", "text": hoursText } },
        { "@type": "Question", "name": "มีที่จอดรถไหม", "acceptedAnswer": { "@type": "Answer", "text": "มีที่จอดหน้าร้านริมถนนขุนช้าง และจอดเพิ่มได้ข้างร้าน ช่วง 11:00–13:00 น. จะแน่นที่สุด" } },
        { "@type": "Question", "name": "สั่งกลับบ้านได้ไหม", "acceptedAnswer": { "@type": "Answer", "text": "ได้ทุกเมนู แยกซอสและน้ำซุปให้ หากสั่งจำนวนมากโทรแจ้งล่วงหน้าอย่างน้อย 1 ชั่วโมง" } },
        { "@type": "Question", "name": "จองโต๊ะล่วงหน้าได้ไหม", "acceptedAnswer": { "@type": "Answer", "text": "รับจองสำหรับกลุ่ม 6 คนขึ้นไป โทรหรือทักไลน์ " + (site.phone_display || "") + " ล่วงหน้า 1 วัน" } }
      ]
    };
    existing.textContent = JSON.stringify(schema);
  }

  function fetchJson(url) {
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  // ข้อมูลร้านตอนนี้แยกเป็นหลายไฟล์ (site.json, banner.json, hero.json, about.json)
  // เพื่อให้หน้าแอดมินแบ่งเป็นหมวดย่อยที่หาง่ายขึ้น — โค้ดฝั่งนี้รวมทุกไฟล์เป็นก้อนเดียวก่อนใช้งาน
  Promise.all([
    fetchJson("/data/site.json"),
    fetchJson("/data/banner.json"),
    fetchJson("/data/hero.json"),
    fetchJson("/data/about.json"),
    fetchJson("/data/menu.json")
  ]).then(function (results) {
    var site = Object.assign({}, results[0] || {}, results[1] || {}, results[2] || {}, results[3] || {});
    var menuData = results[4];
    var items = menuData && Array.isArray(menuData.items) ? menuData.items : null;
    if (results[0] || results[1] || results[2] || results[3]) applySiteData(site);
    if (results[0]) {
      injectRestaurantSchema(site);
      injectFaqSchema(site);
    }
    if (items) {
      renderMenu(items);
      injectMenuSchema(items);
    }
  });
})();
