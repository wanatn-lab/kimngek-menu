/**
 * Decap CMS custom widget: "quick-paste"
 *
 * Sits at the very top of the blog article form. The person pastes a whole
 * raw article (title + body together, however messy) into one box, clicks
 * one button, and the AI helper on the kimngek-cms-auth Worker splits it up
 * and fills in: title, slug, category, and meta description directly (these
 * are simple text fields, safe to fill programmatically). The cleaned-up
 * body and a FAQ block are handed back in copy boxes for the person to
 * paste into the body field themselves - the Markdown body editor is a
 * richer component and isn't safe to write into directly from here.
 *
 * This widget's own field value is never actually saved: after a successful
 * run it resets itself to empty, so nothing extra ends up in the article's
 * saved file.
 */
(function () {
  if (!window.CMS || !window.h || !window.createClass) return;

  var ORGANIZE_URL = 'https://kimngek-cms-auth.wanat-n.workers.dev/organize-article';

  function findEntryContainer(el) {
    var node = el;
    for (var i = 0; i < 12 && node; i++) {
      if (node.tagName === 'FORM' || (node.className && String(node.className).indexOf('EditorInterface') !== -1)) {
        return node;
      }
      node = node.parentElement;
    }
    return document.body;
  }

  function setNativeValue(el, value) {
    var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findFieldControlByLabel(root, labelIncludes) {
    var labels = root.querySelectorAll('label, [class*="ControlLabel" i]');
    for (var i = 0; i < labels.length; i++) {
      var text = (labels[i].textContent || '').trim();
      if (text.indexOf(labelIncludes) !== -1) {
        var container = labels[i].parentElement;
        if (container) {
          var field = container.querySelector('input, textarea');
          if (field) return field;
        }
      }
    }
    return null;
  }

  function findMarkdownRawTextarea(root) {
    var labels = root.querySelectorAll('label, [class*="ControlLabel" i]');
    for (var i = 0; i < labels.length; i++) {
      var text = (labels[i].textContent || '').trim();
      if (text.indexOf('เนื้อหาบทความ') !== -1) {
        var container = labels[i].parentElement;
        if (container) {
          return container.querySelector('textarea[class*="markdown" i]') || container.querySelector('.CodeMirror textarea');
        }
      }
    }
    return null;
  }

  var QuickPasteControl = window.createClass({
    getInitialState: function () {
      return { raw: '', status: '', cleanedBody: '', qnaMarkdown: '', filledBody: false };
    },
    captureRef: function (el) {
      this.containerEl = el;
    },
    copyText: function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      }
    },
    handleRawChange: function (e) {
      this.setState({ raw: e.target.value });
    },
    handleOrganize: function () {
      if (!this.containerEl) return;
      var self = this;
      var raw = this.state.raw;
      if (!raw.trim()) {
        this.setState({ status: 'กรุณาวางบทความในกล่องด้านบนก่อนครับ' });
        return;
      }
      this.setState({ status: 'กำลังให้ AI ช่วยจัดข้อมูล... (อาจใช้เวลาสักครู่)', cleanedBody: '', qnaMarkdown: '', filledBody: false });

      fetch(ORGANIZE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw: raw }),
      })
        .then(function (res) {
          return res.json().then(function (json) {
            if (!res.ok) throw new Error(json && json.error ? json.error : 'เรียก AI ไม่สำเร็จ');
            return json;
          });
        })
        .then(function (json) {
          var root = findEntryContainer(self.containerEl);
          var filledNames = [];

          var titleEl = findFieldControlByLabel(root, 'หัวข้อบทความ');
          if (titleEl && json.title) { setNativeValue(titleEl, json.title); filledNames.push('หัวข้อ'); }

          var slugEl = findFieldControlByLabel(root, 'Slug');
          if (slugEl && json.slug) { setNativeValue(slugEl, json.slug); filledNames.push('Slug'); }

          var categoryEl = findFieldControlByLabel(root, 'หมวดหมู่');
          if (categoryEl && json.category) { setNativeValue(categoryEl, json.category); filledNames.push('หมวดหมู่'); }

          var metaEl = findFieldControlByLabel(root, 'Meta description');
          if (metaEl && json.metaDescription) { setNativeValue(metaEl, json.metaDescription); filledNames.push('Meta description'); }

          var bodyFilled = false;
          var bodyEl = findMarkdownRawTextarea(root);
          if (bodyEl && json.cleanedBody) {
            var fullBody = json.cleanedBody + (json.qnaMarkdown ? '\n\n' + json.qnaMarkdown : '');
            setNativeValue(bodyEl, fullBody);
            bodyFilled = true;
            filledNames.push('เนื้อหาบทความ');
          }

          self.setState({
            status: 'เติมให้อัตโนมัติแล้ว: ' + (filledNames.length ? filledNames.join(', ') : 'ไม่พบช่องให้เติม (ลองรีเฟรชหน้าแล้วลองใหม่)') +
              (bodyFilled ? ' — กรุณาเลื่อนลงไปตรวจสอบเนื้อหาบทความอีกครั้งก่อนเผยแพร่' : ''),
            cleanedBody: bodyFilled ? '' : (json.cleanedBody || ''),
            qnaMarkdown: bodyFilled ? '' : (json.qnaMarkdown || ''),
            filledBody: bodyFilled,
            raw: '',
          });
          self.props.onChange('');
        })
        .catch(function (err) {
          self.setState({ status: 'ทำไม่สำเร็จ: ' + (err && err.message ? err.message : 'unknown error') });
        });
    },
    render: function () {
      var self = this;
      var children = [
        window.h('textarea', {
          value: this.state.raw,
          onChange: this.handleRawChange.bind(this),
          placeholder: 'วางบทความทั้งหมดที่นี่ (ชื่อเรื่องบรรทัดแรก ตามด้วยเนื้อหา) แล้วกดปุ่มด้านล่าง ระบบจะแยกและเติมชื่อเรื่อง, Slug, หมวดหมู่, Meta description และเนื้อหาบทความให้อัตโนมัติ',
          style: { width: '100%', minHeight: '160px', fontSize: '13px', padding: '8px', boxSizing: 'border-box' },
        }),
        window.h(
          'button',
          {
            type: 'button',
            onClick: this.handleOrganize.bind(this),
            style: {
              marginTop: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              cursor: 'pointer',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: '#f5f5f5',
              fontWeight: 'bold',
            },
          },
          '✨ จัดข้อมูล SEO / GEO ให้ฉัน'
        ),
      ];

      if (this.state.status) {
        children.push(
          window.h('div', { style: { marginTop: '6px', fontSize: '13px', color: '#5a5a5a' } }, this.state.status)
        );
      }

      if (this.state.cleanedBody) {
        children.push(
          window.h('div', { style: { marginTop: '10px' } }, [
            window.h('div', { style: { fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' } }, 'หาช่องเนื้อหาบทความไม่เจอ กรุณาคัดลอกไปวางเองในช่อง "เนื้อหาบทความ" ด้านล่าง:'),
            window.h('textarea', {
              readOnly: true,
              value: this.state.cleanedBody + (this.state.qnaMarkdown ? '\n\n' + this.state.qnaMarkdown : ''),
              style: { width: '100%', minHeight: '140px', fontFamily: 'monospace', fontSize: '12px' },
              onClick: function (e) { e.target.select(); },
            }),
            window.h(
              'button',
              { type: 'button', onClick: function () { self.copyText(self.state.cleanedBody + (self.state.qnaMarkdown ? '\n\n' + self.state.qnaMarkdown : '')); }, style: { marginTop: '4px', fontSize: '12px' } },
              'คัดลอกเนื้อหา'
            ),
          ])
        );
      }

      return window.h(
        'div',
        { ref: this.captureRef, style: { border: '2px solid #d9a441', borderRadius: '6px', padding: '10px', background: '#fffaf0' } },
        children
      );
    },
  });

  var NoopPreview = function () { return null; };

  window.CMS.registerWidget('quick-paste', QuickPasteControl, NoopPreview);
})();
