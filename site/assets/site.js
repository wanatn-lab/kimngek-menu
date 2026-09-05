document.addEventListener('DOMContentLoaded', function () {
  var b = document.getElementById('burger'), m = document.getElementById('navm');
  if (b && m) {
    b.addEventListener('click', function () {
      var open = m.classList.toggle('open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    m.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { m.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
    });
  }
  document.querySelectorAll('.qa > button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var qa = btn.parentElement, isOpen = qa.classList.contains('open');
      document.querySelectorAll('.qa').forEach(function (o) {
        o.classList.remove('open');
        var ob = o.querySelector('button'); if (ob) ob.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) { qa.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });
  var yr = document.getElementById('yr'); if (yr) yr.textContent = new Date().getFullYear();

  // เมนูอาหาร: กดที่รายการเพื่อขยายดูรูปเต็มและรายละเอียดครบ (สำคัญบนมือถือที่รูปตัวอย่างมีขนาดเล็ก)
  var menuList = document.getElementById('menu-list');
  var modal = document.getElementById('menuModal');
  if (menuList && modal) {
    var mmImage = document.getElementById('mmImage');
    var mmName = document.getElementById('mmName');
    var mmPrice = document.getElementById('mmPrice');
    var mmDesc = document.getElementById('mmDesc');
    var mmTags = document.getElementById('mmTags');
    var mmVideo = document.getElementById('mmVideo');
    var lastFocused = null;

    function openModal(row) {
      var image = row.getAttribute('data-image') || '';
      var name = row.getAttribute('data-name') || '';
      mmImage.src = image;
      mmImage.alt = name;
      mmName.textContent = name;
      mmPrice.textContent = '฿' + (row.getAttribute('data-price') || '');
      mmDesc.textContent = row.getAttribute('data-desc') || '';
      mmTags.innerHTML = '';
      if (row.getAttribute('data-featured') === '1') {
        var star = document.createElement('span');
        star.className = 'badge-star';
        star.textContent = '⭐ เมนูแนะนำ';
        mmTags.appendChild(star);
      }
      var category = row.getAttribute('data-category');
      if (category) {
        var tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = category;
        mmTags.appendChild(tag);
      }
      var video = row.getAttribute('data-video');
      if (video) { mmVideo.href = video; mmVideo.hidden = false; } else { mmVideo.hidden = true; }
      lastFocused = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      modal.querySelector('.menu-modal-close').focus();
    }

    function closeModal() {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    menuList.addEventListener('click', function (e) {
      var row = e.target.closest('.row');
      if (row) openModal(row);
    });
    modal.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
  }
});