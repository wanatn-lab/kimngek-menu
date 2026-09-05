/**
 * Fixes a Decap CMS quirk: when AI-generated Markdown (headings like "##",
 * bold "**text**", table pipes "|") is pasted into the rich-text body
 * editor, Decap's editor treats it as plain text rather than real
 * Markdown syntax. When it saves the entry, its own Markdown serializer
 * then escapes those characters with a backslash so they don't get
 * misread later - so "## Heading" is saved as "\## Heading" and shows up
 * literally on the live site instead of rendering as a heading.
 *
 * This runs automatically on every save (CMS.registerEventListener,
 * "preSave") and strips that backslash back off, on any entry that has a
 * "body" field - currently only the blog collection. No manual fix or
 * copy-paste care needed going forward.
 */
(function () {
  if (!window.CMS || !window.CMS.registerEventListener) return;

  function unescapeMarkdown(text) {
    return String(text || '').replace(/\\([#*_|>`~-])/g, '$1');
  }

  window.CMS.registerEventListener({
    name: 'preSave',
    handler: function (args) {
      var entry = args.entry;
      var data = entry.get('data');
      var body = data.get('body');
      if (typeof body === 'string' && body.indexOf('\\') !== -1) {
        data = data.set('body', unescapeMarkdown(body));
      }
      return data;
    },
  });
})();
