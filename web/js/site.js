/* แถบเมนูเดียวของทั้งเว็บ: Home · Play · Decks · Cards · Shop  (ต้องล็อกอินก่อน — เซิร์ฟเวอร์ตรวจแล้วจึงส่งหน้านี้มา)
   - Home / Shop = /hub.html ใน iframe เดียวกัน · Play = เกม (#app) · Decks / Cards = /cards/?embed=1 ใน iframe เดียวกัน
   - iframe โหลดตอนกดครั้งแรก · สลับแท็บแล้วเกมที่ค้างอยู่ไม่หาย เพราะเกมยังรันอยู่ในหน้าเดิม
   - ลิงก์ #shop · #play · #decks · #cards · #deck=... (ลิงก์แชร์เด็ค) เปิดแท็บนั้นตรง ๆ · ไม่มี hash = Home
   - องค์ประกอบใดมี data-go="home|play|decks|cards|shop" กดแล้วสลับแท็บ
   - ทุกครั้งที่สลับ หน้าใหม่เลื่อนเข้าจากทิศทางตามลำดับแท็บ (ขวา→ซ้ายเมื่อไปแท็บถัดไป) ด้วยเอฟเฟกต์เดียวกันทุกหน้า
   - iframe คุยกับหน้านี้ผ่าน postMessage:
       afGo {afGo:'shop', deckId?}   ขอสลับแท็บ        afLaunch {mode, deckId?}   ไปหน้า Play พร้อมตั้งโหมด/เด็ค
       afCoins n                      เหรียญเปลี่ยน       afOwned 1                 ซื้อ/ได้การ์ดใหม่ → โหลดข้อมูลการ์ดที่มีใหม่ทุกหน้า
       afHubView 'home'|'shop'        สลับภายใน hub     afDecksChanged 1          Deckbuilder บันทึก/ลบเด็ค */
(function () {
  'use strict';
  var view = document.getElementById('siteView'), sw = document.getElementById('siteSw'), bar = document.getElementById('siteBar');
  var cardsFrame = document.getElementById('cardsFrame'), hubFrame = document.getElementById('hubFrame');
  var panes = { play: document.getElementById('panePlay'), cards: document.getElementById('paneCards'), hub: document.getElementById('paneHub') };
  var btns = [].slice.call(sw.querySelectorAll('button[data-tab]'));
  var ORDER = ['home', 'decks', 'cards', 'shop'];                    // แท็บบนแถบเมนู
  var FLOW = ['home', 'play', 'decks', 'cards', 'shop'];            // ลำดับสำหรับทิศทางเอฟเฟกต์ (play = หน้าเกม/ตั้งค่าแมตช์ ซ้อนอยู่ใต้ Home ไม่มีแท็บของตัวเอง)
  var navOf = function (t) { return t === 'play' ? 'home' : t; };
  var PANE = { home: 'hub', shop: 'hub', play: 'play', cards: 'cards', decks: 'cards' };
  var TITLE = { home: 'Home · AvastFall TCG', play: 'เกม · AvastFall TCG', decks: 'Decks · AvastFall TCG', cards: 'Cards · AvastFall TCG', shop: 'Shop · AvastFall TCG' };
  var HASH = { home: '', play: '#play', decks: '#decks', cards: '#cards', shop: '#shop' };
  var ALIAS = { deck: 'decks', deckbuilder: 'decks', hub: 'home' };
  var scrollAt = { play: 0 };
  var cur = 'home', ready = { cards: false, hub: false };
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  var fit = function () { document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px'); };
  var moveInd = function () {
    var on = sw.querySelector('button[aria-selected="true"]'); if (!on) return;
    sw.style.setProperty('--px', on.offsetLeft + 'px'); sw.style.setProperty('--pw', on.offsetWidth + 'px');
  };
  var layout = function () { moveInd(); fit(); };
  addEventListener('resize', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  layout(); requestAnimationFrame(function () { layout(); sw.classList.add('ready'); });

  /* ---------- ผู้ใช้ + เมนูบัญชี ---------- */
  var U = (window.__AF && window.__AF.user) || {};
  var $ = function (id) { return document.getElementById(id); };
  var nameEl = $('siteName'), coinEl = $('siteCoinNum'), avEl = $('siteAv'), cardsEl = $('siteCardsNum');
  var isAdmin = U.role === 'admin';
  if (nameEl) nameEl.textContent = U.username || 'ผู้เล่น';
  if (avEl) avEl.textContent = String(U.username || '?').charAt(0).toUpperCase();
  if ($('menuName')) $('menuName').textContent = U.username || 'ผู้เล่น';
  if ($('menuRole')) { $('menuRole').textContent = isAdmin ? 'แอดมิน' : 'ผู้เล่น'; $('menuRole').className = 'role' + (isAdmin ? ' admin' : ''); }
  if ($('menuAdmin')) $('menuAdmin').hidden = !isAdmin;
  var fmt = function (n) { return Number(n).toLocaleString('th-TH'); };
  var bump = function (el) { var c = el.closest('.site-chip'); if (!c || reduce) return; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); };
  var setCoin = function (n) { if (coinEl && n != null) { var changed = coinEl.textContent !== fmt(n); coinEl.textContent = fmt(n); if (changed) bump(coinEl); } };
  var setCards = function (own, total) { if (cardsEl && own != null) cardsEl.textContent = own + (total ? '/' + total : ''); };
  setCoin(U.coins);
  var ownUnique = function (map) { return Object.keys(map || {}).filter(function (k) { return map[k] > 0; }).length; };
  var me = $('siteMe'), menu = $('siteMenu');
  var openMenu = function (o) { menu.hidden = !o; me.setAttribute('aria-expanded', String(o)); if (o) { var f = menu.querySelector('button,a:not([hidden])'); if (f) f.focus(); } };
  me.addEventListener('click', function (e) { e.stopPropagation(); openMenu(menu.hidden); });
  menu.addEventListener('click', function () { openMenu(false); });
  document.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('#siteUser')) openMenu(false); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { openMenu(false); me.focus(); } });
  $('siteOut').addEventListener('click', function () { if (window.AF) window.AF.logout(); else location.href = '/'; });
  /* จุดแดง Update Note ที่เกมคุมไว้ → แสดงซ้ำที่ปุ่มชื่อผู้ใช้ด้วย */
  var nd = $('hdrNotesDot'), md = $('siteMeDot');
  if (nd && md && window.MutationObserver) { var sync = function () { md.hidden = nd.hidden; }; new MutationObserver(sync).observe(nd, { attributes: true, attributeFilter: ['hidden'] }); sync(); }

  /* ---------- ข้อมูลการ์ดที่มี (ใช้ร่วมกันทุกหน้า: Deckbuilder ใช้ใส่เด็ค · Play ใช้ตรวจเด็ค) ---------- */
  var totalCards = 0;
  function refreshOwned() {
    if (!window.AF) return;
    return AF.api('GET', '/api/me/collection').then(function (j) {
      window.__AF = window.__AF || {}; window.__AF.owned = j.base || j.owned || {};
      setCards(j.unique, totalCards);
      window.dispatchEvent(new Event('af-owned'));
      post(cardsFrame, { afOwned: window.__AF.owned });
    }).catch(function () { });
  }
  function refreshMe() {
    if (!window.AF) return;
    return AF.api('GET', '/api/me').then(function (j) {
      totalCards = j.stats.totalCards; setCoin(j.user.coins); setCards(j.stats.ownedUnique, totalCards);
    }).catch(function () { });
  }
  setCards(ownUnique(window.__AF && window.__AF.owned), 0);
  refreshMe();

  /* ---------- สื่อสารกับ iframe ---------- */
  function post(frame, msg) { try { if (frame.contentWindow) frame.contentWindow.postMessage(msg, location.origin); } catch (e) { } }
  var tellCards = function (v) { post(cardsFrame, { afView: v }); };
  var pendingDeck = null;
  var sendDeck = function () { if (pendingDeck && ready.cards) { post(cardsFrame, { afDeck: pendingDeck }); pendingDeck = null; } };
  cardsFrame.addEventListener('load', function () { ready.cards = true; tellCards(cur === 'decks' ? 'deck' : 'cards'); sendDeck(); });
  hubFrame.addEventListener('load', function () { ready.hub = true; });

  addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data) return;
    var d = e.data;
    if (d.afDecksChanged) window.dispatchEvent(new Event('af-decks-sync'));          // Deckbuilder บันทึก/ลบเด็ค → เกมโหลดรายการเด็คใหม่
    if (d.afCoins != null) setCoin(d.afCoins);
    if (d.afOwned) { refreshOwned(); refreshMe(); }
    if (d.afHubView && PANE[d.afHubView] === 'hub' && cur !== d.afHubView && PANE[cur] === 'hub') go(d.afHubView, { fromHub: true });
    if (d.afLaunch) launch(d.afLaunch);
    if (d.afSetup) { go('play'); if (window.AFApp && AFApp.setup) AFApp.setup(d.afSetup); }
    if (d.afHdr && window.AFApp && AFApp[d.afHdr]) { go('play'); AFApp[d.afHdr](); }          // วิธีเล่น / Update Note จากปุ่มใน iframe
    if (d.afGo) { var t = ALIAS[d.afGo] || d.afGo; if (TITLE[t]) { if (t === 'decks' && d.deckId) openDeck({ id: d.deckId }); else go(t); } }
  });

  /* เปิด Deckbuilder พร้อมเด็คที่ระบุ: { id } = แก้เด็คที่บันทึกไว้ · { text, name } = ใส่เด็คเป็นเด็คใหม่ */
  function openDeck(p) { pendingDeck = p; go('decks', { force: true }); sendDeck(); }
  /* ไปหน้า Play พร้อมตั้งโหมด (bot/hot/online) และเด็คของผู้เล่น 1 */
  function launch(o) {
    o = o || {};
    if (!o.mode) { try { o.mode = localStorage.getItem('af-lobby-mode') || 'bot'; } catch (e) { o.mode = 'bot'; } }   // โหมดที่เลือกไว้ที่ Home
    go('play');
    if (window.AFApp && AFApp.launch) AFApp.launch(o);
  }
  /* มีเกมค้างอยู่ → แสดงปุ่ม "กลับเข้าเกม" เมื่อผู้เล่นออกไปดูหน้าอื่น */
  var gameBtn = $('siteGame');
  function syncGame() { var g = window.__af && __af.ui && __af.ui.screen === 'game'; if (gameBtn) gameBtn.hidden = !(g && cur !== 'play'); }
  setInterval(syncGame, 700);
  if (gameBtn) gameBtn.addEventListener('click', function () { go('play'); });

  /* ปุ่มบนเมนูบัญชี: วิธีเล่น · Update Note */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-hdr]'); if (!b) return;
    e.preventDefault(); go('play');
    if (window.AFApp && AFApp[b.dataset.hdr]) AFApp[b.dataset.hdr]();
  });

  function go(tab, opts) {
    tab = ALIAS[tab] || tab;
    if (!TITLE[tab]) return;
    opts = opts || {};
    if (tab === cur && !opts.force) return;
    var prev = cur, from = PANE[prev], to = PANE[tab];
    if (to === 'cards') {
      if (!cardsFrame.getAttribute('src')) cardsFrame.src = cardsFrame.dataset.src + (opts.hash || (tab === 'decks' ? '#deckbuilder' : ''));
      else if (ready.cards) tellCards(tab === 'decks' ? 'deck' : 'cards');
    } else if (to === 'hub') {
      if (!hubFrame.getAttribute('src')) hubFrame.src = hubFrame.dataset.src + '#' + tab;
      else if (ready.hub && !opts.fromHub) post(hubFrame, { afView: tab });
    }
    if (from === 'play') scrollAt.play = window.scrollY;
    var dir = reduce || opts.instant ? 0 : Math.sign(FLOW.indexOf(tab) - FLOW.indexOf(prev));
    cur = tab;
    view.dataset.tab = tab; sw.dataset.tab = tab;
    if (from !== to || opts.force) {                              // สลับคนละช่อง: ซ่อนของเก่า แสดงของใหม่พร้อมเอฟเฟกต์เข้า
      view.dataset.dir = String(dir);
      Object.keys(panes).forEach(function (k) { panes[k].classList.toggle('on', k === to); });
      window.scrollTo(0, to === 'play' ? scrollAt.play : 0);
    }
    btns.forEach(function (b) { var on = b.dataset.tab === navOf(tab); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    syncGame();
    moveInd();
    try { history.replaceState(null, '', HASH[tab] ? HASH[tab] : location.pathname + location.search); } catch (e) { }
    document.title = TITLE[tab];
    if (tab === 'play') { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('af-decks-sync')); }   // กลับมาเล่น: โหลดเด็คที่เพิ่งบันทึกใน Deckbuilder
  }

  btns.forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.tab); }); });
  sw.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var i = ORDER.indexOf(navOf(cur));
    var t = ORDER[Math.min(ORDER.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    go(t); btns.filter(function (b) { return b.dataset.tab === t; })[0].focus(); e.preventDefault();
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-go]');
    if (!a) return; e.preventDefault(); go(a.dataset.go);
  }, true);

  var fromHash = function (instant) {
    var h = location.hash, k = h.replace(/^#/, '');
    k = ALIAS[k] || k;
    if (/^#deck=/.test(h)) go('decks', { instant: instant, force: instant, hash: h });
    else if (TITLE[k]) go(k, { instant: instant, force: instant });
  };
  addEventListener('hashchange', function () { fromHash(false); });

  /* เริ่มต้น: Home เป็นหน้าแรก (เกมกับ Cards ซ่อนไว้จนกว่าจะกดแท็บ) */
  var h0 = location.hash.replace(/^#/, ''); h0 = ALIAS[h0] || h0;
  hubFrame.src = hubFrame.dataset.src + (h0 === 'shop' ? '#shop' : '#home');
  if (/^#(deck=|home|shop|play|cards|decks|deckbuilder)/.test(location.hash)) { cur = h0 === 'shop' ? 'shop' : 'home'; fromHash(true); }

  window.AFSite = { go: go, openDeck: openDeck, launch: launch, get tab() { return cur; } };
})();
