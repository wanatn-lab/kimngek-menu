/*
 * ตัวอย่างหน้าเว็บจริงในแผงแก้ไขของ Decap CMS (Live Preview)
 * เพื่อให้ผู้ใช้เห็นว่าสิ่งที่กำลังแก้จะออกมาหน้าตาแบบไหนบนเว็บจริง
 * โดยไม่ต้องกดบันทึกแล้วไปดูที่เว็บก่อน
 */
(function () {
  if (!window.CMS || !window.h || !window.createClass) return;
  var h = window.h;
  var createClass = window.createClass;
  var CMS = window.CMS;

  CMS.registerPreviewStyle("/assets/style.css");
  CMS.registerPreviewStyle(
    "https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Noto+Serif+Thai:wght@500;600;700&display=swap"
  );
  // ครอบพื้นหลัง + ฟอนต์เริ่มต้นให้ตรงกับเว็บจริง (ไฟล์ style.css จริงตั้งค่าไว้ที่ body)
  CMS.registerPreviewStyle(
    "body{font-family:'Noto Sans Thai',sans-serif;background:#FBF4E7;margin:0}" +
      "h1,h2,h3,blockquote{font-family:'Noto Serif Thai',serif}",
    { raw: true }
  );

  function get(entry, key, fallback) {
    var v = entry.getIn(["data", key]);
    return v == null || v === "" ? fallback : v;
  }

  // ---------- เมนูอาหาร ----------
  var MenuPreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var getAsset = this.props.getAsset;
      var items = entry.getIn(["data", "items"]);
      if (!items || !items.size) {
        return h("div", { style: { padding: 24 } }, "ยังไม่มีรายการเมนู");
      }
      var rows = items
        .map(function (item, i) {
          var imgPath = item.get("image");
          var imgSrc = imgPath ? getAsset(imgPath) : null;
          var name = item.get("name") || "";
          var price = item.get("price") || "";
          var desc = item.get("desc") || "";
          var category = item.get("category");
          var featured = item.get("featured");
          var video = item.get("video");
          return h(
            "article",
            { className: "row", key: i, style: { display: "flex", gap: 14, padding: "16px 0", borderBottom: "1px solid #e7d9bd" } },
            imgSrc
              ? h("img", { className: "thumb", src: imgSrc, width: 78, height: 78, style: { borderRadius: 10, objectFit: "cover", width: 78, height: 78, flex: "0 0 auto" } })
              : null,
            h(
              "div",
              { className: "body", style: { flex: 1 } },
              h(
                "div",
                { className: "priceline", style: { display: "flex", alignItems: "baseline", gap: 8 } },
                h("h3", { style: { margin: 0 } }, name),
                h("span", { className: "dots", style: { flex: 1, borderBottom: "1px dotted #b99" } }),
                h("span", { className: "price", style: { fontWeight: 700, color: "#57120C" } }, "฿" + price)
              ),
              featured || category
                ? h(
                    "div",
                    { className: "tagrow", style: { margin: "4px 0" } },
                    featured ? h("span", { className: "badge-star", style: { marginRight: 8 } }, "⭐ เมนูแนะนำ") : null,
                    category ? h("span", { className: "tag", style: { fontSize: 12, background: "#f0e2c0", padding: "2px 8px", borderRadius: 999 } }, category) : null
                  )
                : null,
              h("p", { style: { margin: "4px 0 0", color: "#5a4a3a" } }, desc),
              video ? h("a", { href: video, target: "_blank", style: { fontSize: 13 } }, "▶ ดูวิดีโอเมนู") : null
            )
          );
        })
        .toArray();
      return h("div", { style: { padding: 24 } }, h("div", {}, rows));
    }
  });
  CMS.registerPreviewTemplate("menu", MenuPreview);

  // ---------- หน้าแรก (Hero) ----------
  var HeroPreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var getAsset = this.props.getAsset;
      var imgPath = entry.getIn(["data", "hero_image"]);
      var imgSrc = imgPath ? getAsset(imgPath) : null;
      return h(
        "div",
        { style: { padding: 24, background: "#57120C", color: "#fff" } },
        h("h1", { style: { fontSize: 32, margin: "0 0 12px" } }, [
          h("span", { key: "l1" }, get(entry, "hero_title_line1", "")),
          h("br", { key: "br" }),
          h("em", { key: "l2", style: { color: "#E8B84B" } }, get(entry, "hero_title_line2", ""))
        ]),
        h("p", { style: { fontSize: 16, opacity: 0.9, maxWidth: 480 } }, get(entry, "hero_subtitle", "")),
        imgSrc
          ? h("img", { src: imgSrc, style: { maxWidth: "100%", borderRadius: 14, marginTop: 16, display: "block" } })
          : h("div", { style: { marginTop: 16, opacity: 0.6 } }, "(ยังไม่ได้เลือกรูป Hero)")
      );
    }
  });
  CMS.registerPreviewTemplate("hero", HeroPreview);

  // ---------- เกี่ยวกับเรา ----------
  var AboutPreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var getAsset = this.props.getAsset;
      var imgPath = entry.getIn(["data", "about_image"]);
      var imgSrc = imgPath ? getAsset(imgPath) : null;
      return h(
        "div",
        { style: { padding: 24 } },
        h("h2", { style: { color: "#57120C" } }, get(entry, "about_title", "")),
        imgSrc ? h("img", { src: imgSrc, style: { maxWidth: "100%", borderRadius: 14, margin: "12px 0" } }) : null,
        h("p", {}, get(entry, "about_p1", "")),
        h("p", {}, get(entry, "about_p2", ""))
      );
    }
  });
  CMS.registerPreviewTemplate("about", AboutPreview);

  // ---------- บทความบล็อก ----------
  var BlogPreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var widgetFor = this.props.widgetFor;
      var getAsset = this.props.getAsset;
      var imgPath = entry.getIn(["data", "cover_image"]);
      var imgSrc = imgPath ? getAsset(imgPath) : null;
      var category = get(entry, "category", "");
      var published = entry.getIn(["data", "published"]);
      return h(
        "div",
        { style: { padding: 24, maxWidth: 720 } },
        published === false ? h("div", { style: { background: "#f7d6d6", padding: "6px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 } }, "ยังไม่เผยแพร่ (ปิดอยู่)") : null,
        category ? h("span", { style: { fontSize: 12, background: "#f0e2c0", padding: "2px 10px", borderRadius: 999 } }, category) : null,
        h("h1", { style: { color: "#57120C", margin: "10px 0" } }, get(entry, "title", "(ยังไม่ได้ตั้งชื่อบทความ)")),
        imgSrc ? h("img", { src: imgSrc, style: { maxWidth: "100%", borderRadius: 14, marginBottom: 16 } }) : null,
        h("div", {}, widgetFor("body"))
      );
    }
  });
  CMS.registerPreviewTemplate("blog", BlogPreview);
})();
