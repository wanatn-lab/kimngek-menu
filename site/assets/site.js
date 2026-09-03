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
});