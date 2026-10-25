// EX YU DATE - crveni brojač NOVIH korisnika (status "pending") pored Admin tipke.
// Vidi ga samo admin. Klik vodi u admin panel. Osvježava se svake minute.
(function () {
  if (window.__exyuNoviBrojac) return; window.__exyuNoviBrojac = true;

  function makeBadge() {
    var a = document.createElement('a');
    a.id = 'exyuNoviBadge';
    a.href = 'admin.html';
    a.title = 'Novi korisnici koji čekaju odobrenje';
    a.textContent = '🆕 Novi: …';
    a.style.cssText = 'display:inline-block;background:#fff;color:#e0001b;border:2px solid #e0001b;' +
      'border-radius:999px;padding:4px 11px;font:800 13px/1.2 system-ui,Segoe UI,Arial,sans-serif;' +
      'text-decoration:none;letter-spacing:0;text-shadow:none;box-shadow:0 2px 8px rgba(0,0,0,.35)';
    return a;
  }

  function place(badge) {
    var box = document.getElementById('adminQuickButtons');
    var adminLink = box ? box.querySelector('a[href="admin.html"]') : null;
    if (box && adminLink) {
      // u istom redu kao "Admin panel": brojač lijevo, Admin panel desno
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:wrap';
      adminLink.parentNode.insertBefore(row, adminLink);
      row.appendChild(badge);
      row.appendChild(adminLink);
    } else {
      // stranice bez admin izbornika: brojač je već dolje u redu s admin tipkama (strelice.js) - ovdje se ne prikazuje
      return;
    }
  }

  function count(badge) {
    fetch('/api/admin/users', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var n = (d.users || []).filter(function (u) { return u.status === 'pending' && !u.suspended; }).length;
        badge.textContent = '🆕 Novi: ' + n;
        badge.style.background = n > 0 ? '#e0001b' : '#fff';
        badge.style.color = n > 0 ? '#fff' : '#e0001b';
      })
      .catch(function () {});
  }

  function start() {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) {
        if (!me || !me.isAdmin) return;
        var badge = makeBadge();
        place(badge);
        count(badge);
        setInterval(function () { count(badge); }, 60000);
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
