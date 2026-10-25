/* EX YU DATE - tipke kao na FIND ME:
   "‹ Nazad" dolje lijevo i "Naprijed ›" dolje desno (vode kroz stranice sajta redom),
   za admina jos "☰ Admin", "🛠️ Admin panel" i "🆕 Novi", i poruke u prozorcicu sa strane. */
(function(){
  if (window.__exyuNav) return; window.__exyuNav = true;
  var order = [
    ['pocetna.html','Početna'], ['hrvatska.html','Hrvatska'], ['bosna.html','Bosna i Hercegovina'], ['srbija.html','Srbija'],
    ['video.html','Video pozivi'], ['galerija.html','Galerija'], ['oglasnik.html','Oglasnik'], ['profil.html','Profil'],
    ['chat.html','Poruke'], ['settings.html','Postavke'], ['upute.html','Upute']
  ];
  var groups = [
    ['Glavno', [['🏠 Početna','pocetna.html'],['🛠️ Admin panel','admin.html'],['👤 Moj profil','profil.html'],['⚙️ Postavke','settings.html'],['📝 Registracija','../index.html']]],
    ['Zemlje', [['🇭🇷 Hrvatska','hrvatska.html'],['🇧🇦 Bosna i Hercegovina','bosna.html'],['🇷🇸 Srbija','srbija.html']]],
    ['Korisnici i chat', [['👥 Svi korisnici','svi-korisnici.html'],['🟢 Na mreži','na-mrezi.html'],['✉️ Poruke','chat.html'],['💬 Prošireni chat','prosireni-chat.html'],['📹 Video pozivi','video.html']]],
    ['Ostalo', [['🖼️ Galerija','galerija.html'],['📢 Oglasnik','oglasnik.html'],['📖 Upute','upute.html'],['💰 Naplata','naplata.html']]]
  ];
  var file = (location.pathname.split('/').pop() || '').toLowerCase();
  var idx = -1;
  for (var k = 0; k < order.length; k++) if (order[k][0] === file) idx = k;
  var isPhone = Math.min(screen.width, screen.height) < 768;
  var Z = isPhone ? Math.max(1, Math.min(3, window.innerWidth / Math.max(1, screen.width))) : 1;
  var B = Math.round(14 * Z);

  var css = document.createElement('style');
  css.id = 'exyuNavCss';
  css.textContent =
    // slova gore preko videa: bijela, deblja, s tamnom sjenom (kao na FIND ME)
    '.top .corner-links a,.top .right-of-title>a{color:#fff !important;font-weight:700 !important;text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,.95),0 0 12px rgba(0,0,0,.7) !important;}' +
    '.top .corner-links a:hover,.top .right-of-title>a:hover{color:#ffd700 !important;}' +
    '#adminQuickButtons a{text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,.95),0 0 12px rgba(0,0,0,.7) !important;}' +
    '.exyuNav{position:fixed;bottom:' + B + 'px;z-index:2147482500;background:#6a2bc4;color:#fff;border:2px solid #fff;border-radius:999px;' +
    'padding:' + (11*Z) + 'px ' + (19*Z) + 'px;font:800 ' + (17*Z) + 'px/1 Inter,system-ui,Arial,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);text-decoration:none;}' +
    '.exyuNav:hover{background:#8a3ff0;color:#fff;}#exyuNavPrev{left:' + (14*Z) + 'px}#exyuNavNext{right:' + (14*Z) + 'px}' +
    '#exyuAdmRow{position:fixed;bottom:' + B + 'px;z-index:2147483000;display:flex;gap:' + (10*Z) + 'px;align-items:center}' +
    '#exyuAdmRow>*{border:2px solid #fff;border-radius:999px;padding:' + (11*Z) + 'px ' + (19*Z) + 'px;font:800 ' + (17*Z) + 'px/1 Inter,system-ui,Segoe UI,Arial,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);text-decoration:none;white-space:nowrap}' +
    '#exyuAdmBtn,#exyuAdmPanel{background:#ffb300;color:#1b0033}#exyuAdmBtn:hover,#exyuAdmPanel:hover{background:#ffd24d}' +
    '#exyuNewBadge{background:#00a884;color:#fff}#exyuNewBadge.on{background:#e0001b;color:#fff;animation:exyuPulse 1.6s infinite}' +
    '@keyframes exyuPulse{0%,100%{box-shadow:0 0 0 0 rgba(224,0,27,.7)}50%{box-shadow:0 0 0 8px rgba(224,0,27,0)}}' +
    '#exyuAdmBox{position:fixed;left:14px;bottom:' + (B + 66*Z) + 'px;z-index:2147483000;width:270px;max-height:70vh;overflow:auto;background:#1b0033;' +
    'color:#fff;border:2px solid #ffb300;border-radius:14px;padding:10px 12px;font:14px/1.3 system-ui,Segoe UI,Arial,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.6);display:none}' +
    '#exyuAdmBox.open{display:block}#exyuAdmBox h4{margin:10px 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#ffb300}' +
    '#exyuAdmBox h4:first-child{margin-top:2px}#exyuAdmBox a{display:block;padding:7px 8px;border-radius:8px;color:#fff;text-decoration:none}' +
    '#exyuAdmBox a:hover{background:#4a1a8a}#exyuAdmBox a.here{background:#6a2bc4;font-weight:700}';
  document.head.appendChild(css);

  function mk(id, txt, href, onclick){
    var a = document.createElement('a');
    a.id = id; a.className = 'exyuNav'; a.href = href; a.textContent = txt;
    if (onclick) a.addEventListener('click', onclick);
    document.body.appendChild(a);
    return a;
  }
  function start(){
    if (document.getElementById('exyuNavPrev') || document.getElementById('exyuNavNext')) return;
    // prazan prostor na dnu, da tipke ne prekriju zadnji sadrzaj
    var sp = document.createElement('div'); sp.style.cssText = 'height:' + (B + 70) + 'px;width:1px;pointer-events:none'; document.body.appendChild(sp);
    if (idx > 0) mk('exyuNavPrev', '‹ Nazad', order[idx-1][0]);
    else if (idx === -1) mk('exyuNavPrev', '‹ Nazad', 'pocetna.html', function(e){ if (history.length > 1) { e.preventDefault(); history.back(); } });
    if (idx === -1 || idx < order.length - 1) mk('exyuNavNext', 'Naprijed ›', idx === -1 ? 'pocetna.html' : order[idx+1][0]);
    fetch('/api/auth/me', { credentials: 'same-origin' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(me){
      if (me && me.loggedIn && me.isAdmin) adminRow();
    }).catch(function(){});
  }
  function adminRow(){
    var row = document.createElement('div'); row.id = 'exyuAdmRow';
    var btn = document.createElement('button'); btn.id = 'exyuAdmBtn'; btn.type = 'button'; btn.textContent = '☰ Admin'; btn.title = 'Izbornik svih stranica';
    var box = document.createElement('div'); box.id = 'exyuAdmBox';
    groups.forEach(function(g){
      var h = document.createElement('h4'); h.textContent = g[0]; box.appendChild(h);
      g[1].forEach(function(l){
        var a = document.createElement('a'); a.href = l[1]; a.textContent = l[0];
        if (l[1] === file) a.className = 'here';
        if (l[1] === 'chat.html') a.setAttribute('data-fm-full', '1');
        box.appendChild(a);
      });
    });
    btn.addEventListener('click', function(e){ e.stopPropagation(); box.classList.toggle('open'); });
    document.addEventListener('click', function(e){ if (!box.contains(e.target)) box.classList.remove('open'); });
    document.body.appendChild(box);
    var pan = document.createElement('a'); pan.id = 'exyuAdmPanel'; pan.href = 'admin.html'; pan.textContent = '🛠️ Admin panel';
    var nb = document.createElement('a'); nb.id = 'exyuNewBadge'; nb.href = 'admin.html?open=accNewUsers'; nb.title = 'Novi korisnici koji čekaju odobrenje'; nb.textContent = '🆕 Novi: …';
    row.appendChild(btn); row.appendChild(pan); row.appendChild(nb);
    document.body.appendChild(row);
    function place(){
      var prev = document.getElementById('exyuNavPrev'), next = document.getElementById('exyuNavNext');
      var left = prev ? Math.round(prev.getBoundingClientRect().right + 10*Z) : Math.round(14*Z);
      row.style.left = left + 'px'; row.style.bottom = B + 'px'; row.style.flexWrap = 'nowrap'; row.style.maxWidth = '';
      var limit = (next ? next.getBoundingClientRect().left : window.innerWidth) - 8*Z;
      if (row.getBoundingClientRect().right > limit) {
        left = Math.round(14*Z);
        row.style.left = left + 'px'; row.style.bottom = (B + 58*Z) + 'px';
        row.style.flexWrap = 'wrap'; row.style.maxWidth = (window.innerWidth - 28*Z) + 'px';
        box.style.bottom = (B + 58*Z + row.getBoundingClientRect().height + 8*Z) + 'px';
      } else box.style.bottom = (B + 66*Z) + 'px';
      box.style.left = left + 'px';
    }
    place(); setTimeout(place, 300); window.addEventListener('resize', place);
    function countNew(){
      fetch('/api/admin/users', { credentials: 'same-origin' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
        if (!d) return;
        var n = (d.users || []).filter(function(u){ return u.status === 'pending' && !u.suspended; }).length;
        nb.textContent = '🆕 Novi: ' + n; nb.classList.toggle('on', n > 0);
      }).catch(function(){});
    }
    countNew(); setInterval(countNew, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

// ===== Poruke u prozorčiću sa strane, kao na FIND ME (ne otvara se posebna stranica) =====
(function () {
  if (window.__fmChatPanel) return; window.__fmChatPanel = true;
  if (/\/chat\.html$/.test(location.pathname)) return; // na stranici Poruke ostaje kako je
  var who = null, timer = null, lastSig = '';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function zoomF() { return Math.min(screen.width, screen.height) < 768 ? Math.max(1, window.innerWidth / Math.max(1, screen.width)) : 1; }
  function el(id) { return document.getElementById(id); }
  function build() {
    if (el('fmChatPanel')) return;
    var st = document.createElement('style');
    st.textContent =
      '#fmChatPanel{position:fixed;top:0;right:0;bottom:auto;max-height:100vh;width:380px;max-width:100vw;border-bottom-left-radius:16px;border-bottom:2px solid #a23cff;z-index:2147483300;display:flex;flex-direction:column;' +
      'background:#1e0a3c;color:#fff;box-shadow:-8px 0 30px rgba(0,0,0,.55);border-left:2px solid #a23cff;font-family:Inter,system-ui,Arial,sans-serif;' +
      'transform:translateX(105%);transition:transform .25s ease;}' +
      '#fmChatPanel.open{transform:translateX(0);}' +
      '#fmChatPanel .fc-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#6a1fc9,#a23cff);}' +
      '#fmChatPanel .fc-nick{flex:1;font-weight:800;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '#fmChatPanel .fc-x{background:rgba(0,0,0,.25);border:0;color:#fff;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;}' +
      '#fmChatPanel .fc-all{color:#ffd84d;font-size:12px;font-weight:700;text-decoration:underline;white-space:nowrap;}' +
      '#fmChatPanel .fc-body::-webkit-scrollbar{width:8px;}#fmChatPanel .fc-body::-webkit-scrollbar-thumb{background:#a23cff;border-radius:8px;}' +
      '#fmChatPanel .fc-body{flex:0 1 auto;min-height:60px;max-height:min(360px,calc(100vh - 170px));overflow-y:auto;scrollbar-color:#a23cff transparent;padding:12px;display:flex;flex-direction:column;gap:8px;}' +
      '#fmChatPanel .fc-m{max-width:80%;padding:8px 12px;border-radius:14px;font-size:15px;line-height:1.35;white-space:pre-wrap;word-wrap:break-word;}' +
      '#fmChatPanel .fc-m.own{align-self:flex-end;background:#a23cff;border-bottom-right-radius:4px;}' +
      '#fmChatPanel .fc-m.oth{align-self:flex-start;background:#3a1d66;border-bottom-left-radius:4px;}' +
      '#fmChatPanel .fc-t{display:block;font-size:10px;opacity:.85;margin-top:3px;text-align:right;}' +
      '#fmChatPanel .fc-del{background:rgba(0,0,0,.25);border:0;border-radius:8px;cursor:pointer;font-size:12px;padding:2px 6px;margin-left:6px;vertical-align:middle;}' +
      '#fmChatPanel .fc-del:hover{background:#dc2626;}' +
      '#fmChatPanel .fc-del.sure{background:#dc2626;color:#fff;font-weight:700;}' +
      '#fmChatPanel .fc-info{color:#cbb6ef;text-align:center;font-size:13px;padding:20px 6px;}' +
      '#fmChatPanel .fc-err{color:#ffb4b4;font-size:13px;padding:0 14px 6px;min-height:0;}' +
      '#fmChatPanel .fc-foot{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(162,60,255,.4);background:#170630;border-bottom-left-radius:14px;}' +
      '#fmChatPanel textarea{flex:1;resize:none;height:46px;border-radius:12px;border:1px solid #7b4fc0;background:#2a1050;color:#fff;padding:10px;font:15px Inter,system-ui,Arial,sans-serif;outline:none;}' +
      '#fmChatPanel .fc-conv{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;cursor:pointer;}' +
      '#fmChatPanel .fc-conv:hover{background:rgba(162,60,255,.18);}' +
      '#fmChatPanel .fc-conv .n{font-weight:800;font-size:15px;}' +
      '#fmChatPanel .fc-conv .l{font-size:12px;color:#cbb6ef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '#fmChatPanel .fc-conv .u{margin-left:auto;background:#e0001b;color:#fff;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:800;}' +
      '#fmChatPanel.list .fc-foot{display:none;}' +
      '#fmChatPanel .fc-send{background:linear-gradient(45deg,#a23cff,#ec4899);color:#fff;border:0;border-radius:12px;padding:0 16px;font-weight:800;font-size:15px;cursor:pointer;}';
    document.head.appendChild(st);
    var p = document.createElement('div');
    p.id = 'fmChatPanel';
    p.innerHTML =
      '<div class="fc-head"><button type="button" class="fc-x" id="fmChatBack" title="Svi razgovori" style="display:none">‹</button><span style="font-size:22px">💬</span><div class="fc-nick" id="fmChatNick"></div>' +
      '<a class="fc-all" data-fm-full="1" href="/pages/chat.html">Sve poruke</a><button type="button" class="fc-x" id="fmChatX" title="Zatvori">✕</button></div>' +
      '<div class="fc-body" id="fmChatBody"></div><div class="fc-err" id="fmChatErr"></div>' +
      '<div class="fc-foot"><textarea id="fmChatTxt" placeholder="Napišite poruku..." maxlength="2000"></textarea>' +
      '<button type="button" class="fc-send" id="fmChatSend">Pošalji</button></div>';
    document.body.appendChild(p);
    el('fmChatX').onclick = close;
    el('fmChatBack').onclick = function () { openList(); };
    el('fmChatSend').onclick = send;
    // brisanje vlastite poruke: prvi klik pita "Obriši?", drugi klik briše
    el('fmChatBody').addEventListener('click', function (e) {
      var b = e.target.closest('.fc-del'); if (!b) return;
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'Obriši?'; setTimeout(function () { if (b.isConnected) { b.classList.remove('sure'); b.textContent = '🗑️'; } }, 4000); return; }
      b.disabled = true;
      fetch('/api/messages/' + encodeURIComponent(b.getAttribute('data-id')), { method: 'DELETE', credentials: 'include' })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) { if (!x.ok) { el('fmChatErr').textContent = (x.d && x.d.error) || 'Poruku nije moguće obrisati.'; b.disabled = false; return; } lastSig = ''; load(false); })
        .catch(function () { b.disabled = false; el('fmChatErr').textContent = 'Poruku nije moguće obrisati.'; });
    });
    el('fmChatTxt').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && who) close(); });
  }
  function fmt(d) { try { var x = new Date(d); return ('0' + x.getHours()).slice(-2) + ':' + ('0' + x.getMinutes()).slice(-2) + ' ' + x.getDate() + '.' + (x.getMonth() + 1) + '.'; } catch (e) { return ''; } }
  function load(scroll) {
    if (!who) return;
    var nick = who;
    fetch('/api/messages/thread/' + encodeURIComponent(nick), { credentials: 'include' })
      .then(function (r) { if (r.status === 401) throw new Error('login'); return r.json(); })
      .then(function (d) {
        if (who !== nick) return;
        var ms = (d && d.messages) || [];
        var sig = ms.length + ':' + (ms.length ? ms[ms.length - 1].id : '');
        if (sig === lastSig) return; lastSig = sig;
        var b = el('fmChatBody');
        b.innerHTML = ms.length ? ms.map(function (m) {
          return '<div class="fc-m ' + (m.own ? 'own' : 'oth') + '">' + esc(m.body) + '<span class="fc-t">' + fmt(m.created_at) +
            (m.own ? ' <button type="button" class="fc-del" data-id="' + m.id + '" title="Obriši poruku">🗑️</button>' : '') + '</span></div>';
        }).join('') : '<div class="fc-info">Još nema poruka. Napišite prvu poruku za ' + esc(nick) + ' 🙂</div>';
        b.scrollTop = b.scrollHeight;
      })
      .catch(function (e) {
        if (String(e && e.message) === 'login') el('fmChatBody').innerHTML = '<div class="fc-info">Za slanje poruka morate biti prijavljeni.</div>';
      });
  }
  function send() {
    var t = el('fmChatTxt'), body = t.value.trim();
    if (!body || !who) return;
    el('fmChatErr').textContent = '';
    el('fmChatSend').disabled = true;
    fetch('/api/messages', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toNick: who, body: body }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        el('fmChatSend').disabled = false;
        if (!x.ok) { el('fmChatErr').textContent = (x.d && x.d.error) || 'Poruku nije moguće poslati.'; return; }
        t.value = ''; lastSig = ''; load(true); t.focus();
      })
      .catch(function () { el('fmChatSend').disabled = false; el('fmChatErr').textContent = 'Poruku nije moguće poslati. Pokušajte ponovo.'; });
  }
  function open(nick) {
    if (!nick) return;
    build();
    who = nick; lastSig = '';
    var p = el('fmChatPanel'); p.classList.remove('list'); el('fmChatBack').style.display = '';
    p.style.zoom = zoomF();
    el('fmChatNick').textContent = nick;
    el('fmChatErr').textContent = '';
    el('fmChatBody').innerHTML = '<div class="fc-info">⏳ Učitavam poruke...</div>';
    el('fmChatTxt').value = '';
    p.classList.add('open');
    setTimeout(function () { try { el('fmChatTxt').focus(); } catch (e) {} }, 300);
    load(true);
    clearInterval(timer); timer = setInterval(function () { load(false); }, 4000);
  }
  function close() {
    who = null; clearInterval(timer);
    var p = el('fmChatPanel'); if (p) p.classList.remove('open');
  }
  // popis razgovora (kad se stisne "Poruke")
  function openList() {
    build();
    who = null; clearInterval(timer);
    var p = el('fmChatPanel');
    p.style.zoom = zoomF(); p.classList.add('list'); p.classList.add('open');
    el('fmChatBack').style.display = 'none';
    el('fmChatNick').textContent = 'Poruke';
    el('fmChatErr').textContent = '';
    el('fmChatBody').innerHTML = '<div class="fc-info">⏳ Učitavam razgovore...</div>';
    fetch('/api/messages/conversations', { credentials: 'include' })
      .then(function (r) { if (r.status === 401) throw new Error('login'); return r.json(); })
      .then(function (d) {
        if (who) return;
        var cs = (d && d.conversations) || [];
        el('fmChatBody').innerHTML = cs.length ? cs.map(function (c) {
          return '<div class="fc-conv" data-nick="' + esc(c.nick) + '"><div style="min-width:0"><div class="n">' + esc(c.nick) + '</div><div class="l">' + esc(c.last_body || '') + '</div></div>' +
            (Number(c.unread) > 0 ? '<span class="u">' + Number(c.unread) + '</span>' : '') + '</div>';
        }).join('') : '<div class="fc-info">Još nemate poruka. Stisnite 💬 uz nekog korisnika da mu pišete.</div>';
      })
      .catch(function (e) { el('fmChatBody').innerHTML = '<div class="fc-info">' + (String(e && e.message) === 'login' ? 'Za poruke morate biti prijavljeni.' : 'Poruke trenutno ne mogu učitati.') + '</div>'; });
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('#fmChatPanel .fc-conv'); if (!c) return;
    open(c.getAttribute('data-nick'));
  });
  // kad stigne nova poruka: prozorčić se sam otvori sa strane (ne cijela stranica)
  var lastUnread = null;
  function checkNew() {
    if (document.hidden || document.body.classList.contains('fm-incall')) return;
    fetch('/api/messages/unread-count', { credentials: 'include' })
      .then(function (r) { if (r.status === 401) { clearInterval(newTimer); throw 0; } return r.json(); })
      .then(function (d) {
        var n = Number(d && d.count) || 0, before = lastUnread; lastUnread = n;
        if (n <= 0 || (before !== null && n <= before)) return;
        var p = el('fmChatPanel');
        if (p && p.classList.contains('open') && who) { lastSig = ''; load(false); return; } // vec dopisuje - samo osvjezi
        return fetch('/api/messages/conversations', { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (x) {
          var c = ((x && x.conversations) || []).filter(function (k) { return Number(k.unread) > 0; })[0];
          if (c) { open(c.nick); lastUnread = 0; }
        });
      })
      .catch(function () {});
  }
  var newTimer = null;
  fetch('/api/auth/me', { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (me) {
    if (!me || !me.loggedIn) return;
    checkNew(); newTimer = setInterval(checkNew, 8000);
  }).catch(function () {});
  window.fmOpenChatList = openList;
  window.fmOpenChat = open;
  window.fmCloseChat = close;
  // svaki link "chat.html?user=..." na sajtu otvara prozorčić sa strane umjesto nove stranice
  document.addEventListener('click', function (e) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    // obican link "Poruke" (chat.html bez korisnika) otvara popis razgovora sa strane
    var al = e.target.closest && e.target.closest('a[href]');
    if (al && !al.hasAttribute('data-fm-full') && /(^|\/)chat\.html(#.*)?$/.test(al.getAttribute('href'))) { e.preventDefault(); e.stopPropagation(); openList(); return; }
    var a = e.target.closest && e.target.closest('a[href*="chat.html?user="]');
    if (!a) return;
    var m = /[?&]user=([^&#]+)/.exec(a.getAttribute('href'));
    if (!m) return;
    e.preventDefault(); e.stopPropagation();
    open(decodeURIComponent(m[1]));
  }, true);
})();

