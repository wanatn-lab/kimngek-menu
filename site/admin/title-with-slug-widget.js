/**
 * Decap CMS custom widget: "title-with-slug"
 *
 * Wraps the built-in "string" widget for the blog "title" field. Whenever
 * the person types a title directly (not using the "quick paste" box),
 * this quietly fills in the Slug field too - but only if Slug is still
 * empty, so it never overwrites a slug someone already typed or edited.
 *
 * Debounced: it waits until typing pauses for a moment before asking the
 * AI helper for a slug, rather than firing on every keystroke.
 */
(function () {
  if (!window.CMS || !window.h || !window.createClass) return;

  var SLUGIFY_URL = 'https://kimngek-cms-auth.wanat-n.workers.dev/slugify-title';
  var DEBOUNCE_MS = 900;

  var OrigWidget = window.CMS.getWidget('string');
  var OrigControl = OrigWidget.control;
  var OrigPreview = OrigWidget.preview;

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

  function findFieldContainerByLabel(root, labelIncludes) {
    var labels = root.querySelectorAll('label, [class*="ControlLabel" i]');
    for (var i = 0; i < labels.length; i++) {
      var text = (labels[i].textContent || '').trim();
      if (text.indexOf(labelIncludes) !== -1) {
        var node = labels[i].parentElement;
        for (var d = 0; d < 8 && node; d++) {
          if (node.querySelector('input, textarea')) return node;
          node = node.parentElement;
        }
      }
    }
    return null;
  }

  function setNativeValue(el, value) {
    var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) { descriptor.set.call(el, value); } else { el.value = value; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  var TitleWithSlugControl = window.createClass({
    getInitialState: function () {
      return { status: '' };
    },
    captureRef: function (el) {
      this.containerEl = el;
    },
    componentWillUnmount: function () {
      if (this.timer) clearTimeout(this.timer);
    },
    scheduleSlugify: function (title) {
      var self = this;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(function () {
        self.maybeSlugify(title);
      }, DEBOUNCE_MS);
    },
    maybeSlugify: function (title) {
      if (!this.containerEl || !title.trim()) return;
      var root = findEntryContainer(this.containerEl);
      var slugContainer = findFieldContainerByLabel(root, 'Slug');
      var slugEl = slugContainer && slugContainer.querySelector('input, textarea');
      if (!slugEl || slugEl.value.trim()) return; // already has a slug - don't touch it

      var self = this;
      this.setState({ status: 'กำลังสร้าง slug...' });
      fetch(SLUGIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title }),
      })
        .then(function (res) { return res.json(); })
        .then(function (json) {
          // Re-check: title may have changed again, or the person may have
          // typed a slug themselves while we were waiting.
          if (self.props.value !== title) return;
          var stillEmpty = slugEl && !slugEl.value.trim();
          if (stillEmpty && json.slug) {
            setNativeValue(slugEl, json.slug);
          }
          self.setState({ status: '' });
        })
        .catch(function () {
          self.setState({ status: '' });
        });
    },
    handleChange: function (value) {
      this.props.onChange(value);
      this.scheduleSlugify(value);
    },
    render: function () {
      var origProps = Object.assign({}, this.props, { onChange: this.handleChange.bind(this) });
      var children = [window.h(OrigControl, origProps)];
      if (this.state.status) {
        children.push(
          window.h('div', { style: { marginTop: '4px', fontSize: '12px', color: '#999' } }, this.state.status)
        );
      }
      return window.h('div', { ref: this.captureRef }, children);
    },
  });

  window.CMS.registerWidget('title-with-slug', TitleWithSlugControl, OrigPreview);
})();
