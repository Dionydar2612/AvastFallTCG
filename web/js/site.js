/* แถบเมนูเดียวของทั้งเว็บ: Home · Play · Decks · Cards · Shop · Rewards  (ต้องล็อกอินก่อน — เซิร์ฟเวอร์ตรวจแล้วจึงส่งหน้านี้มา)
   - Home / Shop = /hub.html ใน iframe เดียวกัน · Play = เกม (#app) · Decks / Cards = /cards/?embed=1 ใน iframe เดียวกัน
   - iframe โหลดตอนกดครั้งแรก · สลับแท็บแล้วเกมที่ค้างอยู่ไม่หาย เพราะเกมยังรันอยู่ในหน้าเดิม
   - ลิงก์ #shop · #play · #decks · #cards · #deck=... (ลิงก์แชร์เด็ค) เปิดแท็บนั้นตรง ๆ · ไม่มี hash = Home
   - องค์ประกอบใดมี data-go="home|play|decks|cards|shop" กดแล้วสลับแท็บ
   - ทุกครั้งที่สลับ หน้าใหม่เลื่อนเข้าจากทิศทางตามลำดับแท็บ (ขวา→ซ้ายเมื่อไปแท็บถัดไป) ด้วยเอฟเฟกต์เดียวกันทุกหน้า
   - iframe คุยกับหน้านี้ผ่าน postMessage:
       afGo {afGo:'shop', deckId?}   ขอสลับแท็บ        afLaunch {mode, deckId?}   ไปหน้า Play พร้อมตั้งโหมด/เด็ค
       afCoins n                      เหรียญเปลี่ยน       afOwned 1                 ซื้อ/ได้การ์ดใหม่ → โหลดข้อมูลการ์ดที่มีใหม่ทุกหน้า
       afHubView 'home'|'shop'|'rewards'  สลับภายใน hub     afDaily bool  มีรางวัลรายวันรอรับไหม     afDecksChanged 1          Deckbuilder บันทึก/ลบเด็ค
       afHdr 'guide'|'notes'|'feedback'  วิธีเล่น (ไปหน้าเกม) · แจ้งเตือน/ข้อเสนอแนะ (หน้าต่างซ้อนบนหน้าเดิม ไม่ย้ายหน้า) */
(function () {
  'use strict';
  var view = document.getElementById('siteView'), sw = document.getElementById('siteSw'), bar = document.getElementById('siteBar');
  var cardsFrame = document.getElementById('cardsFrame'), hubFrame = document.getElementById('hubFrame');
  var panes = { play: document.getElementById('panePlay'), cards: document.getElementById('paneCards'), hub: document.getElementById('paneHub') };
  var btns = [].slice.call(sw.querySelectorAll('button[data-tab]'));
  var ORDER = ['home', 'decks', 'cards', 'shop', 'rewards'];                    // แท็บบนแถบเมนู
  var FLOW = ['home', 'play', 'decks', 'cards', 'shop', 'rewards'];            // ลำดับสำหรับทิศทางเอฟเฟกต์ (play = หน้าเกม/ตั้งค่าแมตช์ ซ้อนอยู่ใต้ Home ไม่มีแท็บของตัวเอง)
  var navOf = function (t) { return t === 'play' ? 'home' : t; };
  var PANE = { home: 'hub', shop: 'hub', play: 'play', cards: 'cards', decks: 'cards', rewards: 'hub' };
  var TITLE = { home: 'Home · AvastFall TCG', play: 'เกม · AvastFall TCG', decks: 'Decks · AvastFall TCG', cards: 'Cards · AvastFall TCG', shop: 'Shop · AvastFall TCG', rewards: 'Rewards · AvastFall TCG' };
  var HASH = { home: '', play: '#play', decks: '#decks', cards: '#cards', shop: '#shop', rewards: '#rewards' };
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
      if (hasOwn()) post(cardsFrame, { afOwned: window.__AF.owned });
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
  refreshOwned();   // โหลดรายการการ์ดที่มีตั้งแต่เข้าหน้า (เดิมเรียกเฉพาะหลังซื้อ/เปิดซอง → Deckbuilder เห็นว่าไม่มีการ์ดหลังรีเฟรช)

  /* ---------- สื่อสารกับ iframe ---------- */
  function post(frame, msg) { try { if (frame.contentWindow) frame.contentWindow.postMessage(msg, location.origin); } catch (e) { } }
  var tellCards = function (v) { post(cardsFrame, { afView: v }); };
  var pendingDeck = null;
  var sendDeck = function () { if (pendingDeck && ready.cards) { post(cardsFrame, { afDeck: pendingDeck }); pendingDeck = null; } };
  var hasOwn = function () { var o = window.__AF && window.__AF.owned; return !!o && Object.keys(o).length > 0; };   // ห้ามส่งแผนที่ว่าง/ค้างไปทับค่าที่ iframe โหลดเองได้ถูกต้อง
  cardsFrame.addEventListener('load', function () { ready.cards = true; if (hasOwn()) post(cardsFrame, { afOwned: window.__AF.owned }); tellCards(cur === 'decks' ? 'deck' : 'cards'); sendDeck(); });
  hubFrame.addEventListener('load', function () { ready.hub = true; });

  addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data) return;
    var d = e.data;
    if (d.afDecksChanged) window.dispatchEvent(new Event('af-decks-sync'));          // Deckbuilder บันทึก/ลบเด็ค → เกมโหลดรายการเด็คใหม่
    if (d.afCoins != null) setCoin(d.afCoins);
    if (d.afDaily != null) { var rd = $('tabRewardsDot'); if (rd) rd.hidden = !d.afDaily; }                    // มีรางวัลรายวันรอรับ → จุดแดงที่แท็บ Rewards
    if (d.afOwned) { refreshOwned(); refreshMe(); }
    if (d.afHubView && PANE[d.afHubView] === 'hub' && cur !== d.afHubView && PANE[cur] === 'hub') go(d.afHubView, { fromHub: true });
    if (d.afLaunch) launch(d.afLaunch);
    if (d.afSetup) { go('play'); if (window.AFApp && AFApp.setup) AFApp.setup(d.afSetup); }
    if (d.afHdr) hdr(d.afHdr);                                                                // วิธีเล่น (ไปหน้าเกม) · แจ้งเตือน/ข้อเสนอแนะ (เปิดหน้าต่างทับหน้าเดิม)
    if (d.afGo) { var t = ALIAS[d.afGo] || d.afGo; if (TITLE[t]) { if (t === 'decks' && d.deckId) openDeck({ id: d.deckId }); else go(t); } }
  });

  /* เปิด Deckbuilder พร้อมเด็คที่ระบุ: { id } = แก้เด็คที่บันทึกไว้ · { text, name } = ใส่เด็คเป็นเด็คใหม่ */
  function openDeck(p) { pendingDeck = p; go('decks', { force: true }); sendDeck(); }
  /* ไปหน้า Play พร้อมตั้งโหมด (bot/hot/online) และเด็คของผู้เล่น 1 */
  function launch(o) {
    o = o || {};
    if (!o.mode) { try { o.mode = localStorage.getItem('af-lobby-mode') || 'bot'; } catch (e) { o.mode = 'bot'; } }   // โหมดที่เลือกไว้ที่ Home
    if (!window.AFApp || !AFApp.launch) return { ok: false, err: 'ระบบเกมยังโหลดไม่เสร็จ ลองอีกครั้ง' };
    var r = AFApp.launch(o);
    if (r && r.ok && !r.queued) go('play');                                    // เริ่มเกมแล้วค่อยสลับไปกระดาน · ถ้าเด็คใช้ไม่ได้ จะอยู่ที่ Home และแจ้งข้อความให้
    return r || { ok: false, err: '' };
  }
  /* มีเกมค้างอยู่ → แสดงปุ่ม "กลับเข้าเกม" เมื่อผู้เล่นออกไปดูหน้าอื่น */
  var gameBtn = $('siteGame');
  function syncGame() { var g = window.__af && __af.ui && __af.ui.screen === 'game'; if (gameBtn) gameBtn.hidden = !(g && cur !== 'play'); }
  setInterval(syncGame, 700);
  if (gameBtn) gameBtn.addEventListener('click', function () { go('play'); });

  /* ปุ่มบนเมนูบัญชี / แถบ Home: วิธีเล่น = ไปหน้าวิธีเล่น · แจ้งเตือน/ข้อเสนอแนะ = เปิดหน้าต่างซ้อนตรงจุดที่กด ไม่ย้ายหน้า */
  function hdr(k) {
    if (k === 'notes' || k === 'feedback') { panel(k); return; }
    go('play'); if (window.AFApp && AFApp[k]) AFApp[k]();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-hdr]'); if (!b) return;
    e.preventDefault(); hdr(b.dataset.hdr);
  });

  /* ---------- หน้าต่างแจ้งเตือน (Update Note) · ข้อเสนอแนะ ---------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var pEl = null;
  function closePanel() { if (!pEl) return; pEl.remove(); pEl = null; document.body.style.overflow = ''; }
  function shell(title, html) {
    closePanel();
    var ov = document.createElement('div'); ov.className = 'af-ov';
    ov.innerHTML = '<div class="af-dlg" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><button type="button" class="af-x" aria-label="ปิด">✕</button><h2>' + esc(title) + '</h2><div class="af-body">' + html + '</div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('.af-x') || e.target.closest('[data-pclose]')) closePanel(); });
    document.body.appendChild(ov); pEl = ov; document.body.style.overflow = 'hidden';
    ov.querySelector('.af-x').focus();
    return ov.querySelector('.af-body');
  }
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && pEl) closePanel(); });
  function panel(kind) { if (kind === 'feedback') openFeedback(); else openNotes(); }

  var noteKey = function (n) { return n ? (n.id || n.date) + '|' + n.title : ''; };
  function openNotes() {
    var body = shell('🔔 แจ้งเตือน · ข่าวอัปเดต', '<p class="af-mut">กำลังโหลด…</p>');
    fetch('/api/updates', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (j) {
      var list = (j.data || []).filter(function (n) { return n && n.title && Array.isArray(n.items); });
      if (!pEl || !body.isConnected) return;
      body.innerHTML = list.length ? list.map(function (n) {
        return '<div class="af-note"><b>' + esc(n.date || String(n.at || '').slice(0, 10)) + ' · ' + esc(n.title) + '</b><ul>' + n.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
      }).join('') : '<p class="af-mut">ยังไม่มีประกาศอัปเดต</p>';
      try { if (list[0]) localStorage.setItem('af-notes-seen', noteKey(list[0])); } catch (e) { }
      if (window.AFApp && AFApp.syncBell) AFApp.syncBell();
      post(hubFrame, { afNotesSeen: 1 });
    }).catch(function () { if (pEl && body.isConnected) body.innerHTML = '<p class="af-err">โหลดข่าวอัปเดตไม่สำเร็จ ลองใหม่อีกครั้ง</p>'; });
  }

  var PAGE = { home: 'Home', play: 'เกม', decks: 'Decks', cards: 'Cards', shop: 'Shop', rewards: 'Rewards' };
  function openFeedback() {
    var cats = (window.AF && AF.feedback && AF.feedback.CATEGORIES) || [['suggest', 'ข้อเสนอแนะ']];
    var body = shell('💬 ข้อเสนอแนะ', '<p class="af-mut">อยากให้ปรับหรือเพิ่มอะไร พบจุดผิดปกติ หรือการ์ดใบไหนทำงานไม่ตรงข้อความ บอกได้ที่นี่ ผู้พัฒนาจะอ่านทุกข้อความ</p>' +
      '<label class="af-fl">หัวข้อ<select data-f="cat">' + cats.map(function (c) { return '<option value="' + esc(c[0]) + '">' + esc(c[1]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="af-fl">ข้อความ<textarea data-f="text" maxlength="1500" rows="6" placeholder="พิมพ์ข้อเสนอแนะของคุณ"></textarea></label>' +
      '<label class="af-fl">ชื่อ (ไม่ใส่ก็ได้)<input data-f="name" type="text" maxlength="60"></label>' +
      '<label class="af-fl">ช่องทางติดต่อกลับ (ไม่ใส่ก็ได้)<input data-f="contact" type="text" maxlength="100" placeholder="อีเมล / ไอดีโซเชียล"></label>' +
      '<input data-f="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;height:0">' +
      '<div class="af-err" data-f-msg hidden></div>' +
      '<div class="af-acts"><button type="button" class="af-btn" data-pclose>ยกเลิก</button><button type="button" class="af-btn pri" data-f-send>ส่งข้อเสนอแนะ</button></div>');
    var q = function (k) { return body.querySelector('[data-f="' + k + '"]'); }, msg = body.querySelector('[data-f-msg]'), send = body.querySelector('[data-f-send]');
    q('text').focus();
    send.addEventListener('click', function () {
      var text = q('text').value;
      if (text.trim().length < 3) { msg.textContent = 'กรุณาพิมพ์ข้อความอย่างน้อย 3 ตัวอักษร'; msg.hidden = false; return; }
      msg.hidden = true; send.disabled = true; send.textContent = 'กำลังส่ง…';
      AF.feedback.send({ category: q('cat').value, text: text, name: q('name').value, contact: q('contact').value, website: q('website').value,
        context: { 'หน้า': PAGE[cur] || cur, 'จอ': innerWidth + 'x' + innerHeight, 'ภาษา': navigator.language || '' } })
        .then(function () {
          if (!pEl || !body.isConnected) return;
          body.innerHTML = '<p>ส่งถึงผู้พัฒนาเรียบร้อยแล้ว ขอบคุณที่ช่วยกันปรับปรุงเกม</p><div class="af-acts"><button type="button" class="af-btn" data-f-again>ส่งอีกข้อความ</button><button type="button" class="af-btn pri" data-pclose>ปิด</button></div>';
          body.querySelector('[data-f-again]').addEventListener('click', openFeedback);
          body.parentNode.querySelector('h2').textContent = 'ขอบคุณสำหรับข้อเสนอแนะ';
        })
        .catch(function (er) { if (!pEl || !body.isConnected) return; msg.textContent = er.message; msg.hidden = false; send.disabled = false; send.textContent = 'ส่งข้อเสนอแนะ'; });
    });
  }

  function go(tab, opts) {
    tab = ALIAS[tab] || tab;
    if (!TITLE[tab]) return;
    opts = opts || {};
    if (tab === cur && !opts.force) return;
    var prev = cur, from = PANE[prev], to = PANE[tab];
    if (to === 'cards') {
      if (!cardsFrame.getAttribute('src')) cardsFrame.src = cardsFrame.dataset.src + '&v=11' + (opts.hash || (tab === 'decks' ? '#deckbuilder' : ''));
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
  var HUBV = h0 === 'shop' || h0 === 'rewards' ? h0 : 'home';
  hubFrame.src = hubFrame.dataset.src + '#' + HUBV;
  /* เตรียมหน้า Cards ระหว่างที่ผู้เล่นอยู่ Home เพื่อลดเวลารอเมื่อเปิดแท็บครั้งแรก */
  var warmCards = function () { if (!cardsFrame.getAttribute('src')) cardsFrame.src = cardsFrame.dataset.src + '&v=11'; };
  if (window.requestIdleCallback) requestIdleCallback(warmCards, { timeout: 1200 });
  else setTimeout(warmCards, 500);
  if (/^#(deck=|home|shop|rewards|play|cards|decks|deckbuilder)/.test(location.hash)) { cur = HUBV; fromHash(true); }

  window.AFSite = { go: go, openDeck: openDeck, launch: launch, panel: panel, get tab() { return cur; } };
})();
