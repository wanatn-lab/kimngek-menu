/**
 * Decap CMS custom widget: "video-compress"
 *
 * Menu videos used to go through Decap's own "file" widget, which uploads
 * new files to GitHub. That path turned out to be unreliable: Decap's
 * GitHub backend has a long-standing, unresolved bug where files bigger
 * than roughly 900KB can fail to upload with a generic "input was too
 * large to process" error - well below GitHub's own real size limits, and
 * far too small for a usable video even after heavy compression.
 *
 * Video is a bad fit for a git repository anyway, so this widget instead:
 *  1. Wraps the built-in "string" widget - the field's value is now a
 *     plain URL (Cloudinary's), not a repo-relative path. The frontend
 *     doesn't care: an absolute https:// URL works exactly the same as a
 *     relative path in a <video src="...">.
 *  2. Provides its own file picker (not Decap's Media Library - that flow
 *     is for GitHub-hosted files and isn't used here).
 *  3. Compresses videos over ~6MB in the browser with ffmpeg.wasm before
 *     upload, purely to save the visitor's mobile data and speed up page
 *     loads - Cloudinary itself comfortably handles files up to 100MB, so
 *     this is an optimization, not a workaround for a size limit.
 *  4. Uploads the (possibly compressed) file to the kimngek-cms-auth
 *     Worker's /upload-video endpoint, which forwards it to Cloudinary
 *     with a signed request and returns the resulting playable URL.
 *
 * ffmpeg.wasm (~30MB) is only downloaded the first time someone actually
 * picks a large video in a given admin session - never just from opening
 * the admin panel.
 */
(function () {
  if (!window.CMS || !window.h || !window.createClass) return;

  var UPLOAD_URL = 'https://kimngek-cms-auth.wanat-n.workers.dev/upload-video';
  var MAX_PASSTHROUGH_BYTES = 6 * 1024 * 1024; // ~6MB: small enough, skip compression
  var MAX_WIDTH = 854; // downscale target for compression

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
            return blob;
          });
      });
    });
  }

  function uploadToCloudinary(blob) {
    return fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { 'content-type': blob.type || 'video/mp4' },
      body: blob,
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) throw new Error(json && json.error ? json.error : 'อัปโหลดวิดีโอไม่สำเร็จ');
        return json.url;
      });
    });
  }

  var OrigWidget = window.CMS.getWidget('string');
  var OrigControl = OrigWidget.control;
  var OrigPreview = OrigWidget.preview;

  var VideoUploadControl = window.createClass({
    getInitialState: function () {
      return { status: '' };
    },
    handleFileChange: function (e) {
      var files = e.target.files;
      if (!files || !files.length) return;
      var file = files[0];
      var self = this;

      if (!file.type || file.type.indexOf('video') === -1) {
        this.setState({ status: 'กรุณาเลือกไฟล์วิดีโอเท่านั้น' });
        e.target.value = '';
        return;
      }

      var originalMB = Math.round((file.size / 1024 / 1024) * 10) / 10;

      var prepared;
      if (file.size > MAX_PASSTHROUGH_BYTES) {
        this.setState({ status: 'กำลังบีบอัดวิดีโอ (' + originalMB + 'MB)...' });
        prepared = compressVideo(file, function (msg) {
          self.setState({ status: msg });
        }).then(function (blob) {
          var newMB = Math.round((blob.size / 1024 / 1024) * 10) / 10;
          self.setState({ status: 'บีบอัดเสร็จ: ' + originalMB + 'MB → ' + newMB + 'MB กำลังอัปโหลด...' });
          return blob;
        }).catch(function (err) {
          self.setState({
            status:
              'บีบอัดอัตโนมัติไม่สำเร็จ (' +
              (err && err.message ? err.message : 'unknown error') +
              ') — กำลังอัปโหลดไฟล์เดิมแทน',
          });
          return file;
        });
      } else {
        this.setState({ status: 'กำลังอัปโหลด...' });
        prepared = Promise.resolve(file);
      }

      prepared
        .then(function (blob) {
          return uploadToCloudinary(blob);
        })
        .then(function (url) {
          self.setState({ status: 'อัปโหลดสำเร็จ' });
          self.props.onChange(url);
          setTimeout(function () { self.setState({ status: '' }); }, 4000);
        })
        .catch(function (err) {
          self.setState({ status: 'อัปโหลดไม่สำเร็จ: ' + (err && err.message ? err.message : 'unknown error') });
        });

      e.target.value = '';
    },
    handleRemove: function () {
      this.props.onChange('');
    },
    render: function () {
      var self = this;
      var children = [];

      if (this.props.value) {
        children.push(
          window.h('div', { style: { marginBottom: '8px' } }, [
            window.h('video', {
              src: this.props.value,
              controls: true,
              style: { maxWidth: '240px', maxHeight: '240px', display: 'block', marginBottom: '6px' },
            }),
            window.h(
              'button',
              { type: 'button', onClick: this.handleRemove.bind(this), style: { fontSize: '12px' } },
              'ลบวิดีโอ'
            ),
          ])
        );
      }

      children.push(
        window.h('input', {
          type: 'file',
          accept: 'video/*',
          onChange: this.handleFileChange.bind(this),
        })
      );

      if (this.state.status) {
        children.push(
          window.h('div', { style: { marginTop: '6px', fontSize: '13px', color: '#5a5a5a' } }, this.state.status)
        );
      }

      // Keep the underlying string control mounted (hidden) so Decap's own
      // validation/required-field logic keeps working against this.props.value.
      children.push(window.h('div', { style: { display: 'none' } }, [window.h(OrigControl, this.props)]));

      return window.h('div', {}, children);
    },
  });

  window.CMS.registerWidget('video-compress', VideoUploadControl, OrigPreview);
})();
