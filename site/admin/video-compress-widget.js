/**
 * Decap CMS custom widget: "video-compress"
 *
 * Wraps the built-in "file" widget (proven to work correctly for this
 * project's menu list — see git history around the "รูปเมนู" widget bug).
 * We do NOT touch how existing files are re-selected from the Media
 * Library — that path is left 100% untouched and keeps using Decap's own
 * working logic.
 *
 * The only thing this widget adds: when someone picks a BRAND NEW video
 * file from their device and it's bigger than ~6MB, it is compressed to a
 * smaller MP4 (H.264/AAC, max width 854px) entirely in the browser using
 * ffmpeg.wasm *before* Decap ever sees it, by swapping the selected file on
 * the native <input type="file"> and re-dispatching the change event. This
 * avoids re-implementing Decap's own upload/persist logic (which is what
 * caused an earlier bug) — we only ever hand Decap a smaller File object,
 * exactly like the editor picked a smaller file themselves.
 *
 * ffmpeg.wasm (~30MB) is only downloaded the first time someone actually
 * picks a large video in a given admin session — it is never loaded just
 * from opening the admin panel.
 */
(function () {
  if (!window.CMS || !window.h || !window.createClass) return;

  var MAX_PASSTHROUGH_BYTES = 6 * 1024 * 1024; // ~6MB: small enough, skip compression
  var MAX_WIDTH = 854; // downscale target

  var ffmpegLoadPromise = null;

  function loadFFmpeg(onProgress) {
    if (ffmpegLoadPromise) return ffmpegLoadPromise;
    ffmpegLoadPromise = new Promise(function (resolve, reject) {
      function addScript(src, onload, onerror) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = onload;
        s.onerror = onerror;
        document.head.appendChild(s);
      }
      addScript(
        'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js',
        function () {
          addScript(
            'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js',
            function () {
              (async function () {
                try {
                  if (onProgress) onProgress('กำลังโหลดตัวบีบอัดวิดีโอ (ครั้งแรกอาจใช้เวลาสักครู่)...');
                  var FFmpeg = window.FFmpegWASM.FFmpeg;
                  var toBlobURL = window.FFmpegUtil.toBlobURL;
                  var ff = new FFmpeg();
                  var baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
                  await ff.load({
                    coreURL: await toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript'),
                    wasmURL: await toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm'),
                  });
                  resolve(ff);
                } catch (e) {
                  reject(e);
                }
              })();
            },
            function () { reject(new Error('โหลดตัวช่วยบีบอัดไม่สำเร็จ (เช็คอินเทอร์เน็ต)')); }
          );
        },
        function () { reject(new Error('โหลดตัวบีบอัดวิดีโอไม่สำเร็จ (เช็คอินเทอร์เน็ต)')); }
      );
    });
    return ffmpegLoadPromise;
  }

  function compressVideo(file, onProgress) {
    return loadFFmpeg(onProgress).then(function (ff) {
      if (onProgress) onProgress('กำลังบีบอัดวิดีโอ... (อาจใช้เวลา 10-60 วินาที)');
      return file.arrayBuffer().then(function (buf) {
        var stamp = Date.now();
        var inputName = 'in_' + stamp + '.mp4';
        var outputName = 'out_' + stamp + '.mp4';
        return ff
          .writeFile(inputName, new Uint8Array(buf))
          .then(function () {
            return ff.exec([
              '-i', inputName,
              '-vf', "scale='min(" + MAX_WIDTH + ",iw)':-2",
              '-c:v', 'libx264',
              '-preset', 'veryfast',
              '-crf', '30',
              '-c:a', 'aac',
              '-b:a', '96k',
              '-movflags', '+faststart',
              outputName,
            ]);
          })
          .then(function () { return ff.readFile(outputName); })
          .then(function (data) {
            try { ff.deleteFile(inputName); } catch (e) {}
            try { ff.deleteFile(outputName); } catch (e) {}
            var blob = new Blob([data.buffer], { type: 'video/mp4' });
            var baseName = file.name.replace(/\.[^.]+$/, '');
            return new File([blob], baseName + '-compressed.mp4', { type: 'video/mp4' });
          });
      });
    });
  }

  var OrigWidget = window.CMS.getWidget('file');
  var OrigControl = OrigWidget.control;
  var OrigPreview = OrigWidget.preview;

  var VideoCompressControl = window.createClass({
    getInitialState: function () {
      return { status: '' };
    },
    captureRef: function (el) {
      this.containerEl = el;
      this.attachInterceptor();
    },
    attachInterceptor: function () {
      if (!this.containerEl) return;
      var input = this.containerEl.querySelector('input[type="file"]');
      if (!input || input.__videoCompressHooked) return;
      input.__videoCompressHooked = true;
      input.addEventListener('change', this.handleNativeChange.bind(this, input), true);
    },
    handleNativeChange: function (input, e) {
      var files = input.files;
      if (!files || !files.length) return;
      var file = files[0];

      if (this._passthroughFile === file) {
        // This is the file we just swapped in ourselves - let it go through.
        this._passthroughFile = null;
        return;
      }
      if (!file.type || file.type.indexOf('video') === -1) return; // not a video, don't touch
      if (file.size <= MAX_PASSTHROUGH_BYTES) return; // already small, don't touch

      // Too big: intercept before Decap/React ever sees the original file.
      e.stopImmediatePropagation();
      e.preventDefault();

      var self = this;
      var originalMB = Math.round((file.size / 1024 / 1024) * 10) / 10;
      this.setState({ status: 'กำลังบีบอัดวิดีโอ (' + originalMB + 'MB)...' });

      compressVideo(file, function (msg) {
        self.setState({ status: msg });
      })
        .then(function (compressedFile) {
          var newMB = Math.round((compressedFile.size / 1024 / 1024) * 10) / 10;
          self.setState({ status: 'บีบอัดเสร็จ: ' + originalMB + 'MB → ' + newMB + 'MB กำลังอัปโหลด...' });
          self._passthroughFile = compressedFile;
          var dt = new DataTransfer();
          dt.items.add(compressedFile);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          setTimeout(function () {
            self.setState({ status: '' });
          }, 5000);
        })
        .catch(function (err) {
          self.setState({
            status:
              'บีบอัดอัตโนมัติไม่สำเร็จ (' +
              (err && err.message ? err.message : 'unknown error') +
              ') — กำลังอัปโหลดไฟล์เดิม ถ้าไฟล์ใหญ่มากอาจอัปไม่สำเร็จ แนะนำบีบอัดเองก่อน',
          });
          self._passthroughFile = file;
          var dt2 = new DataTransfer();
          dt2.items.add(file);
          input.files = dt2.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    },
    componentDidUpdate: function () {
      this.attachInterceptor();
    },
    render: function () {
      var children = [window.h(OrigControl, this.props)];
      if (this.state.status) {
        children.push(
          window.h(
            'div',
            { style: { marginTop: '6px', fontSize: '13px', color: '#5a5a5a' } },
            this.state.status
          )
        );
      }
      return window.h('div', { ref: this.captureRef }, children);
    },
  });

  window.CMS.registerWidget('video-compress', VideoCompressControl, OrigPreview);
})();
