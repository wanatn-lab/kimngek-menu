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
        '<article class="row">' +
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
    if (items) {
      renderMenu(items);
      injectMenuSchema(items);
    }
  });
})();
