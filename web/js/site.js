/* แถบเมนูเดียวของทั้งเว็บ: Home · Shop · Playtest · Card List · Deckbuilder  (ต้องล็อกอินก่อน — เซิร์ฟเวอร์ตรวจแล้วจึงส่งหน้านี้มา)
   - Home / Shop = /hub.html ใน iframe (Home, ร้านค้า, คอลเลกชัน) · Playtest = เกม (#app) · Card List / Deckbuilder = /cards/?embed=1 ใน iframe
   - iframe โหลดตอนกดครั้งแรก · สลับแท็บแล้วเกมที่ค้างอยู่ไม่หาย เพราะเกมยังรันอยู่ในหน้าเดิม
   - ลิงก์ #shop · #play · #cards · #deckbuilder · #deck=... (ลิงก์แชร์เด็ค) เปิดแท็บนั้นตรง ๆ · ไม่มี hash = Home
   - องค์ประกอบใดมี data-go="home|shop|play|cards|deck" กดแล้วสลับแท็บ
   - iframe คุยกับหน้านี้ผ่าน postMessage: afGo (ขอสลับแท็บ) · afCoins (เหรียญเปลี่ยน) · afHubView (Home↔Shop ภายใน hub) · afDecksChanged */
(function () {
  'use strict';
  var view = document.getElementById('siteView'), sw = document.getElementById('siteSw'), bar = document.getElementById('siteBar');
  var cardsFrame = document.getElementById('cardsFrame'), hubFrame = document.getElementById('hubFrame');
  var panes = { play: document.getElementById('panePlay'), cards: document.getElementById('paneCards'), hub: document.getElementById('paneHub') };
  var btns = [].slice.call(sw.querySelectorAll('button[data-tab]'));
  var PANE = { home: 'hub', shop: 'hub', play: 'play', cards: 'cards', deck: 'cards' };
  var TITLE = { home: 'Home · AvastFall TCG', shop: 'ร้านค้า · AvastFall TCG', play: 'AvastFall TCG · Open Test ทดลองเล่น', cards: 'Card List · AvastFall TCG', deck: 'Deckbuilder · AvastFall TCG' };
  var HASH = { home: '', shop: '#shop', play: '#play', cards: '#cards', deck: '#deckbuilder' };
  var scrollAt = { play: 0 };
  var cur = 'home', timer = 0, ready = { cards: false, hub: false };
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  var fit = function () { document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px'); };
  fit(); addEventListener('resize', fit);

  /* ---------- ผู้ใช้ ---------- */
  var U = (window.__AF && window.__AF.user) || {};
  var nameEl = document.getElementById('siteName'), coinEl = document.getElementById('siteCoinNum');
  if (nameEl) nameEl.textContent = U.username || 'ผู้เล่น';
  var setCoin = function (n) { if (coinEl && n != null) coinEl.textContent = Number(n).toLocaleString('th-TH'); };
  setCoin(U.coins);
  document.getElementById('siteOut').addEventListener('click', function () { if (window.AF) window.AF.logout(); else location.href = '/'; });

  /* ---------- สื่อสารกับ iframe ---------- */
  var post = function (frame, msg) { try { frame.contentWindow.postMessage(msg, location.origin); } catch (e) { } };
  var tellCards = function (v) { post(cardsFrame, { afView: v }); };
  var pendingDeck = null;
  var sendDeck = function () { if (pendingDeck && ready.cards) { post(cardsFrame, { afDeck: pendingDeck }); pendingDeck = null; } };
  cardsFrame.addEventListener('load', function () { ready.cards = true; tellCards(cur === 'deck' ? 'deck' : 'cards'); sendDeck(); });
  hubFrame.addEventListener('load', function () { ready.hub = true; });

  addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data) return;
    var d = e.data;
    if (d.afDecksChanged) window.dispatchEvent(new Event('af-decks-sync'));          // Deckbuilder บันทึก/ลบเด็ค → เกมโหลดรายการเด็คใหม่
    if (d.afCoins != null) setCoin(d.afCoins);
    if (d.afHubView && PANE[d.afHubView] === 'hub' && cur !== d.afHubView && PANE[cur] === 'hub') go(d.afHubView, { fromHub: true });
    if (d.afGo && TITLE[d.afGo]) { if (d.afGo === 'deck' && d.deckId) openDeck({ id: d.deckId }); else go(d.afGo); }
  });

  /* เปิด Deckbuilder พร้อมเด็คที่ระบุ: { id } = แก้เด็คที่บันทึกไว้ · { text, name } = ใส่เด็ค (เช่นเด็คตัวอย่าง) เป็นเด็คใหม่ */
  function openDeck(p) { pendingDeck = p; go('deck', { force: true }); sendDeck(); }

  /* ปุ่มบนแถบเมนู: วิธีเล่น · Update Note */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-hdr]'); if (!b) return;
    e.preventDefault(); go('play');
    if (window.AFApp && AFApp[b.dataset.hdr]) AFApp[b.dataset.hdr]();
  });

  function go(tab, opts) {
    if (!TITLE[tab]) return;
    opts = opts || {};
    if (tab === cur && !opts.force) return;
    var prev = cur, from = PANE[prev], to = PANE[tab];
    if (to === 'cards') {
      if (!cardsFrame.getAttribute('src')) cardsFrame.src = cardsFrame.dataset.src + (opts.hash || (tab === 'deck' ? '#deckbuilder' : ''));
      else if (ready.cards) tellCards(tab === 'deck' ? 'deck' : 'cards');
    } else if (to === 'hub') {
      if (!hubFrame.getAttribute('src')) hubFrame.src = hubFrame.dataset.src + '#' + tab;
      else if (ready.hub && !opts.fromHub) post(hubFrame, { afView: tab });
    }
    if (from === 'play') scrollAt.play = window.scrollY;
    cur = tab;
    panes[to].classList.remove('off');                          // แสดงทั้งสองฝั่งระหว่างเลื่อน
    sw.dataset.tab = tab; view.dataset.tab = tab; view.dataset.pane = to;
    btns.forEach(function (b) { var on = b.dataset.tab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    clearTimeout(timer);
    var done = function () {
      if (from !== to) panes[from].classList.add('off');
      if (from !== to) window.scrollTo(0, to === 'play' ? scrollAt.play : 0);
    };
    if (reduce || opts.instant) done(); else timer = setTimeout(done, 400);
    try { history.replaceState(null, '', HASH[tab] ? HASH[tab] : location.pathname + location.search); } catch (e) { }
    document.title = TITLE[tab];
    if (tab === 'play') { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('af-decks-sync')); }   // กลับมาเล่น: โหลดเด็คที่เพิ่งบันทึกใน Deckbuilder
  }

  btns.forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.tab); }); });
  sw.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var order = btns.map(function (b) { return b.dataset.tab; }), i = order.indexOf(cur);
    var t = order[Math.min(order.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    go(t); btns.filter(function (b) { return b.dataset.tab === t; })[0].focus(); e.preventDefault();
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-go]');
    if (!a) return; e.preventDefault(); go(a.dataset.go);
  }, true);

  var fromHash = function (instant) {
    var h = location.hash;
    if (h === '#home') go('home', { instant: instant, force: instant });
    else if (h === '#shop') go('shop', { instant: instant, force: instant });
    else if (h === '#play') go('play', { instant: instant, force: instant });
    else if (h === '#cards') go('cards', { instant: instant, force: instant });
    else if (h === '#deckbuilder') go('deck', { instant: instant, force: instant });
    else if (/^#deck=/.test(h)) go('deck', { instant: instant, force: instant, hash: h });
  };
  addEventListener('hashchange', function () { fromHash(false); });

  /* เริ่มต้น: Home เป็นหน้าแรก (เกมกับ Card List ซ่อนไว้จนกว่าจะกดแท็บ) */
  hubFrame.src = hubFrame.dataset.src + (location.hash === '#shop' ? '#shop' : '#home');
  if (/^#(home|shop|play|cards|deckbuilder|deck=)/.test(location.hash)) { cur = 'home'; fromHash(true); }

  /* ลองเปิดซอง: หน้าต่างซ้อน (iframe /packs.html โหลดครั้งแรกที่กด) — โหมดทดลอง ไม่เก็บเข้าคอลเลกชันจริง */
  var ov = document.getElementById('pkOv'), pf = document.getElementById('pkFrame');
  var packs = function (open) {
    ov.hidden = !open;
    if (open && !pf.getAttribute('src')) pf.src = pf.dataset.src;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) document.getElementById('pkClose').focus();
  };
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-packs]')) { e.preventDefault(); packs(true); } });
  document.getElementById('pkClose').addEventListener('click', function () { packs(false); });
  ov.addEventListener('click', function (e) { if (e.target === ov) packs(false); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ov.hidden) packs(false); });
  window.AFSite = { go: go, openDeck: openDeck, get tab() { return cur; } };
})();
