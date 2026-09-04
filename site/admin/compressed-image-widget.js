/*
 * วิดเจ็ตรูปภาพแบบบีบอัดอัตโนมัติ สำหรับ Decap CMS
 * ------------------------------------------------
 * ทำงานเหมือนช่องอัปโหลดรูปปกติของ Decap CMS ทุกอย่าง (คลิกเลือกไฟล์ / ลากไฟล์มาวาง /
 * ดูตัวอย่างรูป / ลบรูป) เพียงแต่ก่อนจะบันทึกรูปเข้า GitHub จะทำการ "ย่อขนาด + บีบอัด"
 * ไฟล์ภาพในเบราว์เซอร์ก่อนเสมอ (ด้วย Canvas API) เพื่อไม่ให้เว็บโหลดช้าจากรูปที่ถ่ายจาก
 * มือถือแล้วไฟล์ใหญ่เกินจำเป็น (มักหลายเมกะไบต์ต่อรูป)
 *
 * กติกาการบีบอัด:
 *  - ย่อด้านที่ยาวที่สุดให้ไม่เกิน 1600px (คงสัดส่วนเดิม)
 *  - แปลงเป็น JPEG คุณภาพ 82%
 *  - ถ้าไฟล์บีบอัดแล้วมีขนาดใหญ่กว่าไฟล์ต้นฉบับ (เกิดขึ้นได้กับไฟล์ที่บีบอัดมาดีอยู่แล้ว)
 *    จะใช้ไฟล์ต้นฉบับแทน ไม่มีทางทำให้ไฟล์ใหญ่ขึ้น
 *  - ไฟล์ที่ไม่ใช่รูปภาพ (หรือเป็น SVG/GIF ที่อาจมีแอนิเมชัน) จะไม่ถูกแตะต้อง ส่งเข้าระบบตามปกติ
 */
(function () {
  if (!window.CMS || !window.h || !window.createClass) return;

  var MAX_DIMENSION = 1600;
  var JPEG_QUALITY = 0.82;

  function shouldCompress(file) {
    if (!(file instanceof File)) return false;
    if (!file.type || file.type.indexOf("image/") !== 0) return false;
    if (file.type === "image/svg+xml" || file.type === "image/gif") return false;
    return true;
  }

  function compressFile(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width;
          var h2 = img.height;
          if (w > MAX_DIMENSION || h2 > MAX_DIMENSION) {
            if (w > h2) {
              h2 = Math.round((h2 * MAX_DIMENSION) / w);
              w = MAX_DIMENSION;
            } else {
              w = Math.round((w * MAX_DIMENSION) / h2);
              h2 = MAX_DIMENSION;
            }
          }
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h2;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h2);
          canvas.toBlob(
            function (blob) {
              if (!blob || blob.size >= file.size) {
                resolve(file);
                return;
              }
              var newName = file.name.replace(/\.\w+$/, "") + ".jpg";
              try {
                resolve(new File([blob], newName, { type: "image/jpeg" }));
              } catch (err) {
                // เบราว์เซอร์เก่าบางตัวสร้าง File จาก Blob ตรงๆ ไม่ได้ ใช้ไฟล์เดิมแทน
                resolve(file);
              }
            },
            "image/jpeg",
            JPEG_QUALITY
          );
        };
        img.onerror = function () {
          resolve(file);
        };
        img.src = e.target.result;
      };
      reader.onerror = function () {
        resolve(file);
      };
      reader.readAsDataURL(file);
    });
  }

  var Original = window.CMS.getWidget("image");

  var CompressedImageControl = window.createClass({
    getInitialState: function () {
      return { compressing: false };
    },
    handleChange: function (value) {
      var onChange = this.props.onChange;
      var self = this;
      if (shouldCompress(value)) {
        this.setState({ compressing: true });
        compressFile(value).then(function (result) {
          self.setState({ compressing: false });
          onChange(result);
        });
      } else {
        onChange(value);
      }
    },
    render: function () {
      var props = Object.assign({}, this.props, { onChange: this.handleChange });
      return window.h(
        "div",
        {},
        this.state.compressing
          ? window.h(
              "div",
              { style: { fontSize: 12, color: "#8a6d3b", marginBottom: 4 } },
              "กำลังย่อขนาดรูป..."
            )
          : null,
        window.h(Original.control, props)
      );
    }
  });

  window.CMS.registerWidget("compressed-image", CompressedImageControl, Original.preview, Original.schema);
})();
