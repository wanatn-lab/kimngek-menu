/**
 * Decap CMS custom widget: "seo-assist"
 *
 * Wraps the built-in "text" widget for the blog "meta_description" field and
 * adds a button that sends the article's title + body to a small AI helper
 * (running on the same kimngek-cms-auth Cloudflare Worker used for login) to:
 *   1. Write an SEO-friendly meta description (filled in automatically here).
 *   2. Clean up the pasted article body into tidy Markdown.
 *   3. Write a short "คำถามที่พบบ่อย" (FAQ) block for GEO (so AI answer
 *      engines can lift clear answers from the page).
 *
 * Only the meta description is filled in directly (this widget owns that
 * field). The cleaned body + FAQ block are shown in a copy box below the
 * button, since a widget can't safely reach into the separate Markdown body
 * field's editor - the person pastes it in themselves, in the place they
 * want it.
 */
(function () {
  if (!window.CMS || !window.h || !window.createClass) return;

  var SEO_ASSIST_URL = 'https://kimngek-cms-auth.wanat-n.workers.dev/seo-assist';

  var OrigWidget = window.CMS.getWidget('text');
  var OrigControl = OrigWidget.control;
  var OrigPreview = OrigWidget.preview;

  function findEntryContainer(el) {
    // Walk up far enough to reach the whole entry-editor form, so we can
    // read the title + body fields that live outside this widget.
    var node = el;
    for (var i = 0; i < 12 && node; i++) {
      if (node.tagName === 'FORM' || (node.className && String(node.className).indexOf('EditorInterface') !== -1)) {
        return node;
      }
      node = node.parentElement;
    }
    return document.body;
  }

  function readTitleAndBody(containerEl) {
    var root = findEntryContainer(containerEl);
    var title = '';
    var body = '';

    var labels = root.querySelectorAll('label, [class*="ControlLabel" i]');
    for (var i = 0; i < labels.length; i++) {
      var text = (labels[i].textContent || '').trim();
      if (!title && text.indexOf('หัวข้อบทความ') !== -1) {
        var field = labels[i].parentElement && labels[i].parentElement.querySelector('input, textarea');
        if (field) title = field.value || '';
      }
    }

    // Markdown body editor: try the raw textarea (raw mode) first, then fall
    // back to the visible rich-text editor's plain text.
    var textarea = root.querySelector('textarea[class*="markdown" i]') || root.querySelector('.CodeMirror textarea');
    if (textarea && textarea.value) {
      body = textarea.value;
    } else {
      var proseMirror = root.querySelector('[data-slate-editor="true"]') || root.querySelector('[class*="markdown" i] [contenteditable="true"]');
      if (proseMirror) body = proseMirror.innerText || '';
    }
    return { title: title, body: body };
  }

  var SeoAssistControl = window.createClass({
    getInitialState: function () {
      return { status: '', cleanedBody: '', qnaMarkdown: '' };
    },
    captureRef: function (el) {
      this.containerEl = el;
    },
    copyText: function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      }
    },
    handleAssist: function () {
      if (!this.containerEl) return;
      var self = this;
      var data = readTitleAndBody(this.containerEl);
      if (!data.body.trim()) {
        this.setState({ status: 'ยังไม่มีเนื้อหาบทความ กรุณาวางบทความในช่อง "เนื้อหาบทความ" ก่อน' });
        return;
      }
      this.setState({ status: 'กำลังให้ AI ช่วยอ่านบทความ... (อาจใช้เวลาสักครู่)', cleanedBody: '', qnaMarkdown: '' });

      fetch(SEO_ASSIST_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: data.title, body: data.body }),
      })
        .then(function (res) {
          return res.json().then(function (json) {
            if (!res.ok) throw new Error(json && json.error ? json.error : 'เรียก AI ไม่สำเร็จ');
            return json;
          });
        })
        .then(function (json) {
          if (json.metaDescription) {
            self.props.onChange(json.metaDescription);
          }
          self.setState({
            status: 'เสร็จแล้ว — เติม Meta description ให้อัตโนมัติแล้ว ส่วนเนื้อหาที่จัดใหม่กับคำถามท้ายบทความ กดคัดลอกไปวางในช่องเนื้อหาบทความเองอีกทีนะครับ',
            cleanedBody: json.cleanedBody || '',
            qnaMarkdown: json.qnaMarkdown || '',
          });
        })
        .catch(function (err) {
          self.setState({ status: 'ทำไม่สำเร็จ: ' + (err && err.message ? err.message : 'unknown error') });
        });
    },
    render: function () {
      var self = this;
      var children = [window.h(OrigControl, this.props)];

      children.push(
        window.h(
          'button',
          {
            type: 'button',
            onClick: this.handleAssist.bind(this),
            style: {
              marginTop: '8px',
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: '#f5f5f5',
            },
          },
          '✨ ให้ AI ช่วยเขียน Meta Description + จัดบทความให้เหมาะกับ SEO/GEO'
        )
      );

      if (this.state.status) {
        children.push(
          window.h('div', { style: { marginTop: '6px', fontSize: '13px', color: '#5a5a5a' } }, this.state.status)
        );
      }

      if (this.state.cleanedBody) {
        children.push(
          window.h('div', { style: { marginTop: '10px' } }, [
            window.h('div', { style: { fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' } }, 'เนื้อหาที่จัดรูปแบบใหม่ (คัดลอกไปวางแทนของเดิม):'),
            window.h('textarea', {
              readOnly: true,
              value: this.state.cleanedBody,
              style: { width: '100%', minHeight: '140px', fontFamily: 'monospace', fontSize: '12px' },
              onClick: function (e) { e.target.select(); },
            }),
            window.h(
              'button',
              { type: 'button', onClick: function () { self.copyText(self.state.cleanedBody); }, style: { marginTop: '4px', fontSize: '12px' } },
              'คัดลอกเนื้อหาที่จัดใหม่'
            ),
          ])
        );
      }

      if (this.state.qnaMarkdown) {
        children.push(
          window.h('div', { style: { marginTop: '10px' } }, [
            window.h('div', { style: { fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' } }, 'คำถามท้ายบทความ (คัดลอกไปวางท้ายบทความ):'),
            window.h('textarea', {
              readOnly: true,
              value: this.state.qnaMarkdown,
              style: { width: '100%', minHeight: '100px', fontFamily: 'monospace', fontSize: '12px' },
              onClick: function (e) { e.target.select(); },
            }),
            window.h(
              'button',
              { type: 'button', onClick: function () { self.copyText(self.state.qnaMarkdown); }, style: { marginTop: '4px', fontSize: '12px' } },
              'คัดลอกคำถามท้ายบทความ'
            ),
          ])
        );
      }

      return window.h('div', { ref: this.captureRef }, children);
    },
  });

  window.CMS.registerWidget('seo-assist', SeoAssistControl, OrigPreview);
})();
