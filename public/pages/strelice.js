/* Strelice lijevo/desno na sredini ekrana: vode kroz stranice sajta redom, od prve do zadnje. */
(function(){
  var order = [
    ['pocetna.html','Početna'], ['hrvatska.html','Hrvatska'], ['bosna.html','Bosna i Hercegovina'], ['srbija.html','Srbija'],
    ['video.html','Video pozivi'], ['galerija.html','Galerija'], ['oglasnik.html','Oglasnik'], ['profil.html','Profil'],
    ['chat.html','Poruke'], ['settings.html','Postavke'], ['upute.html','Upute']
  ];
  var file = (location.pathname.split('/').pop() || '').toLowerCase();
  var idx = -1;
  if (!location.search) { for (var k = 0; k < order.length; k++) if (order[k][0] === file) idx = k; }

  var css = document.createElement('style');
  css.textContent =
    '.exyu-arrow{position:fixed;top:50%;transform:translateY(-50%);z-index:900;width:46px;height:84px;display:flex;align-items:center;justify-content:center;' +
    'font-size:30px;font-weight:800;line-height:1;color:#fff;text-decoration:none;background:rgba(122,40,200,0.85);border:2px solid rgba(255,255,255,0.55);' +
    'box-shadow:0 4px 18px rgba(0,0,0,0.45);cursor:pointer;transition:background .15s,width .15s;-webkit-tap-highlight-color:transparent;}' +
    '.exyu-arrow:hover,.exyu-arrow:focus{background:#a23cff;width:54px;outline:none;}' +
    '.exyu-arrow.left{left:0;border-left:0;border-radius:0 16px 16px 0;}' +
    '.exyu-arrow.right{right:0;border-right:0;border-radius:16px 0 0 16px;}' +
    '@media(max-width:600px){.exyu-arrow{width:34px;height:64px;font-size:22px;}.exyu-arrow:hover,.exyu-arrow:focus{width:38px;}}';
  document.head.appendChild(css);

  function add(side, sign, href, label, onclick){
    var a = document.createElement('a');
    a.className = 'exyu-arrow ' + side;
    a.href = href;
    a.textContent = sign;
    a.title = label;
    a.setAttribute('aria-label', label);
    if (onclick) a.addEventListener('click', onclick);
    document.body.appendChild(a);
  }

  if (idx > 0) add('left', '‹', order[idx-1][0], 'Nazad: ' + order[idx-1][1]);
  if (idx === -1) add('left', '‹', 'pocetna.html', 'Nazad', function(e){ if (history.length > 1) { e.preventDefault(); history.back(); } });
  if (idx >= 0 && idx < order.length - 1) add('right', '›', order[idx+1][0], 'Dalje: ' + order[idx+1][1]);
})();
