/* Home (ล็อบบี้) · ร้านค้า  (web/hub.html — ฝังเป็น iframe ในเว็บหลัก แท็บ Home/Shop อยู่ที่แถบเมนูหลัก)
   - Home จัดวางแบบล็อบบี้เกม: ซ้ายภาพเด่น · กลางเหรียญตราเด็ค + ปุ่ม PLAY · ขวาแถบรางวัลรายวัน · ล่างซ้ายความคืบหน้าชุดการ์ด · ล่างขวาเด็ค
   - ข้อมูลทั้งหมดมาจาก API ที่ต้องล็อกอิน (Supabase): /api/me · /api/me/daily · /api/me/collection · /api/shop · /api/shop/buy · /api/cards
   - คุยกับเว็บหลักผ่าน postMessage: afGo (สลับแท็บ) · afLaunch (ไปหน้า Play พร้อมโหมด/เด็ค) · afCoins · afOwned · afHubView · afHdr */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var BACK = '/assets/card-back.jpg';
  var MODES = [['bot', 'VS บอท'], ['hot', '2 คน · เครื่องเดียว'], ['online', 'ออนไลน์กับเพื่อน']];
  var S = { view: 'home', cards: null, byId: null, own: (window.__AF && window.__AF.owned) || {}, raw: {}, qty: {}, me: null, coins: 0, items: {}, mode: 'bot' };
  try { S.mode = localStorage.getItem('af-lobby-mode') || 'bot'; } catch (e) { }
  if (!MODES.some(function (m) { return m[0] === S.mode; })) S.mode = 'bot';
  var baseId = function (id) { return String(id).replace(/^([A-Za-z0-9]+-\d+).*$/, '$1'); };
  var fmt = function (n) { return Number(n).toLocaleString('th-TH'); };

  /* ---------- พื้นฐาน ---------- */
  function toLogin() { try { window.top.location.href = '/'; } catch (e) { location.href = '/'; } }
  function api(method, url, body) {
    return fetch(url, { method: method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 401) { toLogin(); throw new Error('กรุณาเข้าสู่ระบบ'); }
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || j.message || ('ผิดพลาด ' + r.status)); return j; });
      });
  }
  var tt = 0;
  function toast(msg, bad) { var t = $('toast'); t.textContent = msg; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(function () { t.className = 'toast' + (bad ? ' bad' : ''); }, 2800); }
  function tell(msg) { try { window.parent.postMessage(msg, location.origin); } catch (e) { } }
  function setCoins(n) {
    S.coins = n; if (S.me) S.me.user.coins = n; tell({ afCoins: n });
    var el = document.querySelector('[data-bal]'); if (el) el.textContent = fmt(n);
    refreshBuyState();
  }
  function go(target, extra) { tell(Object.assign({ afGo: target }, extra || {})); }
  /* เริ่มเกมทันทีตามโหมดที่เลือก (เรียกเข้าเว็บหลักตรง ๆ เพื่อรู้ผลทันที) — ถ้าเด็คใช้ไม่ได้จะแจ้งตรงนี้ ไม่ย้ายหน้า */
  function launch(deckId) {
    try { var r = window.parent.AFSite.launch({ mode: S.mode, deckId: deckId || null }); if (r && !r.ok && r.err) toast(r.err, true); }
    catch (e) { tell({ afLaunch: { mode: S.mode, deckId: deckId || null } }); }
  }
  var game = function () { try { return window.parent.__af || null; } catch (e) { return null; } };
  var imgOf = function (c) { return c.image || ('/images/' + c.id + '.jpg'); };
  var pic = function (c) { return c ? '<img loading="lazy" src="' + esc(imgOf(c)) + '" alt="' + esc(c.name) + '" onerror="this.onerror=null;this.src=\'' + BACK + '\'">' : '<div class="noimg">?</div>'; };

  function loadCards() {
    if (S.cards) return Promise.resolve();
    var out = [];
    function page(n) {
      return api('GET', '/api/cards?limit=500&page=' + n).then(function (j) {
        out = out.concat(j.data || []);
        return n < (j.pages || 1) ? page(n + 1) : null;
      });
    }
    return page(1).then(function () { S.cards = out; S.byId = {}; out.forEach(function (c) { S.byId[c.id.toLowerCase()] = c; }); });
  }
  function loadOwned() { return api('GET', '/api/me/collection').then(function (j) { S.raw = j.owned || {}; S.own = j.base || j.owned || {}; return j; }); }

  /* ---------- หน้าต่างซ้อน (2 ชั้น: ชั้นบนใช้ดูรายละเอียดการ์ดทับหน้าต่างเปิดซอง) ---------- */
  function openDlg(html, onClose, upper) {
    var ov = $(upper ? 'ov2' : 'ov'); ov.innerHTML = '<div class="dlg" role="dialog" aria-modal="true"><button type="button" class="x" aria-label="ปิด">✕</button>' + html + '</div>'; ov.hidden = false;
    ov._close = onClose || null; document.body.style.overflow = 'hidden';
    ov.querySelector('.x').focus();
    return ov.querySelector('.dlg');
  }
  function closeDlg() {
    var ov = !$('ov2').hidden ? $('ov2') : $('ov'); if (ov.hidden) return;
    ov.hidden = true; ov.innerHTML = ''; if ($('ov').hidden && $('ov2').hidden) document.body.style.overflow = '';
    var f = ov._close; ov._close = null; if (f) f();
  }
  ['ov', 'ov2'].forEach(function (id) { $(id).addEventListener('click', function (e) { if (e.target === $(id) || e.target.closest('.x')) { if (id === 'ov' && !$('ov2').hidden) return; closeDlg(); } }); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDlg(); });

  function cardDetail(c) {
    var els = (c.elements && c.elements.length ? c.elements : c.element ? [c.element] : []);
    var st = c.type === 'Unit' ? [['Cost', c.cost], ['CRI', c.cri], ['ATK', c.atk], ['DEF', c.def]] : (c.sc != null ? [['ค่า Element', c.sc]] : []);
    var own = S.raw ? (S.raw[c.id] || 0) : null;
    openDlg('<div class="detail"><div>' + pic(c) + '</div><div><h2>' + esc(c.name) + '</h2><div class="mut">' + esc(c.id) + (own != null ? ' · คุณมี <b>' + own + '</b> ใบ' : '') + '</div>' +
      '<div class="tags"><span class="tg">' + esc(c.type) + (c.sub ? ' · ' + esc(c.sub) : '') + '</span>' + els.map(function (e) { return '<span class="tg">ธาตุ' + esc(e) + '</span>'; }).join('') +
      (c.rarity ? '<span class="tg">Rarity ' + esc(c.rarity) + '</span>' : '') + (c.rotation ? '<span class="tg">Rotation ' + esc(c.rotation) + '</span>' : '') + (c.tribe ? '<span class="tg">' + esc(c.tribe) + '</span>' : '') + '</div>' +
      (st.length ? '<div class="tags">' + st.map(function (x) { return '<span class="tg" style="background:var(--gold);color:#111">' + x[0] + ' ' + esc(x[1] == null ? '-' : x[1]) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="eff">' + ((c.effects || []).length ? c.effects.map(function (e) { return '<p>' + (e.keyword ? '<span class="kw ' + esc(String(e.keyword).split(' ')[0]) + '">' + esc(e.keyword) + '</span>' : '') + esc(e.text) + '</p>'; }).join('') : '<span class="mut">ไม่มีเอฟเฟกต์</span>') + '</div>' +
      (c.flavor ? '<p class="mut"><i>' + esc(c.flavor) + '</i></p>' : '') + (c.artist ? '<p class="mut">นักวาด: ' + esc(c.artist) + '</p>' : '') + '</div></div>', null, !$('ov').hidden);
  }

  /* ---------- ข้อมูลเด็ค (เด็คถูกเก็บที่ Supabase ผ่านเว็บหลัก แล้วใส่ไว้ใน localStorage ให้ทุกหน้าอ่านได้) ---------- */
  function readDecks() { try { var a = JSON.parse(localStorage.getItem('cl-decks') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function deckSize(d) { return 1 + Object.keys(d.counts || {}).reduce(function (a, k) { return a + (d.counts[k] || 0); }, 0); }
  /* เด็คพร้อมเล่น = ครบ 60 ใบ + มีการ์ดครบทุกใบตามที่ใส่ไว้ (กติกาเดียวกับ Deckbuilder) */
  function deckInfo(d) {
    var miss = 0, n = deckSize(d);
    Object.keys(d.counts || {}).forEach(function (id) { var have = S.own[id] || 0, need = d.counts[id] || 0; if (have < need) miss += need - have; });
    if (d.avatar && !(S.own[d.avatar] > 0)) miss++;
    if (!d.avatar) miss++;
    return { n: n, miss: miss, ok: n === 60 && !miss };
  }

  /* ---------- HOME (ล็อบบี้) ---------- */
  function pickAvatars(decks) {
    var av = S.cards.filter(function (c) { return c.type === 'Avatar' && c.image && /^[A-Za-z0-9]+-\d+$/.test(c.id); });
    var out = [], seen = {};
    var add = function (c) { if (c && !seen[c.id]) { seen[c.id] = 1; out.push(c); } };
    decks.forEach(function (d) { if (out.length < 3 && d.avatar && S.own[d.avatar] > 0) add(S.byId[String(d.avatar).toLowerCase()]); });
    av.filter(function (c) { return S.own[c.id] > 0; }).forEach(function (c) { if (out.length < 3) add(c); });
    var dn = new Date(), seed = dn.getFullYear() * 372 + dn.getMonth() * 31 + dn.getDate(), rest = av.filter(function (c) { return !seen[c.id]; }), i = 0;
    while (out.length < 3 && rest.length) { add(rest.splice((seed * (7 + i * 3) + i * 11) % rest.length, 1)[0]); i++; }
    return out;
  }

  /* ความคืบหน้าแต่ละชุดการ์ด (SD01…BT01): นับเฉพาะ "แบบ" การ์ดหลัก (ไม่รวมภาพ alt) · next = ชุดที่ใกล้ครบที่สุดแต่ยังไม่ครบ */
  function setProgress() {
    var m = {}, order = [];
    (S.cards || []).forEach(function (c) {
      if (!/^[A-Za-z0-9]+-\d+$/.test(c.id)) return;
      var k = c.deck || String(c.id).split('-')[0];
      if (!m[k]) { m[k] = { code: k, have: 0, total: 0 }; order.push(k); }
      m[k].total++; if (S.own[c.id] > 0) m[k].have++;
    });
    var list = order.sort().map(function (k) { return m[k]; }), part = list.filter(function (x) { return x.have < x.total; });
    part.sort(function (a, b) { return (b.have / b.total) - (a.have / a.total); });
    return { list: list, done: list.length - part.length, next: part[0] || null };
  }
  function openSets() {
    var sp = setProgress(), st = S.me && S.me.stats;
    var dlg = openDlg('');
    dlg.innerHTML = '<button type="button" class="x" aria-label="ปิด">✕</button><h2>ความคืบหน้าชุดการ์ด</h2><p class="mut" style="margin:0 40px 10px 0">' + (st ? 'สะสมแล้ว <b>' + st.ownedUnique + ' / ' + st.totalCards + '</b> แบบ · ' : '') + 'ครบแล้ว ' + sp.done + ' จาก ' + sp.list.length + ' ชุด</p>' +
      '<div class="sets">' + sp.list.map(function (x) {
        var pct = x.total ? Math.round(x.have / x.total * 100) : 0, full = x.have >= x.total;
        return '<div class="srow"><b>' + esc(x.code) + '</b><span class="bar"><i class="' + (full ? 'full' : '') + '" style="width:' + pct + '%"></i></span><span class="sn">' + x.have + ' / ' + x.total + '</span><em class="' + (full ? 'ok' : 'mut') + '">' + (full ? '✓ ครบ' : 'ขาด ' + (x.total - x.have)) + '</em></div>';
      }).join('') + '</div><div class="acts3"><button type="button" class="btn" data-go="cards">🃏 ดูการ์ดของฉัน</button><button type="button" class="btn pri" data-go="shop">ไปร้านค้า</button></div>';
  }

  function renderHome() {
    try { var m0 = localStorage.getItem('af-lobby-mode'); if (MODES.some(function (m) { return m[0] === m0; })) S.mode = m0; } catch (e) { }
    return Promise.all([api('GET', '/api/me'), api('GET', '/api/updates').catch(function () { return { data: [] }; }), loadCards(), api('GET', '/api/shop').catch(function () { return { data: [] }; }), loadOwned().catch(function () { })]).then(function (r) {
      var me = r[0], notes = (r[1].data || []).slice(0, 3), shop = (r[3].data || []).slice(0, 3); S.me = me; setCoins(me.user.coins); S.items = {}; shop.forEach(function (i) { S.items[i.id] = i; });
      var st = me.stats, pct = st.totalCards ? Math.round(st.ownedUnique / st.totalCards * 100) : 0;
      var decks = readDecks().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
      var infos = decks.map(deckInfo), okDeck = decks.filter(function (d, i) { return infos[i].ok; })[0] || null;
      var G = game(), cur = null, curInfo = null;                                                   // เด็คที่จะใช้เล่นจริง (ตามที่เลือกไว้ในเกม)
      try { if (G && G.ui && G.ui.cfg) { var d0 = G.deckByKey(G.ui.cfg.sel[0]); if (d0) { cur = { name: d0.name, preset: !!d0.preset, ok: !G.deckErrors(d0.key).length }; } } } catch (e) { }
      var inGame = !!(G && G.ui && G.ui.screen === 'game');
      var main = decks[0] || null, mainInfo = main ? infos[0] : null;
      var fan = pickAvatars(decks), emblem = fan[0] || null;
      var haveDecks = decks.length > 0;
      var sets = setProgress();
      var seen = ''; try { seen = localStorage.getItem('af-notes-seen') || ''; } catch (e) { }
      var n0 = (r[1].data || [])[0], newNote = !!(n0 && n0.title && ((n0.id || n0.date) + '|' + n0.title) !== seen);

      var fanHtml = fan.map(function (c, i) { return '<div class="fc f' + i + '">' + pic(c) + '</div>'; }).join('');
      var deckLine = cur ? '<button type="button" class="dpill" data-act="setup" title="เปลี่ยนเด็ค"><b>' + esc(cur.name || 'เด็ค') + '</b><span class="' + (cur.ok ? 'ok' : 'warn') + '">' + (cur.ok ? (cur.preset ? '✓ เด็คตัวอย่าง' : '✓ พร้อมเล่น') : '⚠ ใช้เล่นไม่ได้') + '</span></button>' : main ? '<button type="button" class="dpill" data-go="decks" title="ไปจัดเด็ค"><b>' + esc(main.name || 'เด็คใหม่') + '</b><span class="' + (mainInfo.ok ? 'ok' : 'warn') + '">' + (mainInfo.ok ? '✓ พร้อมเล่น' : mainInfo.miss ? '⚠ การ์ดไม่พอ' : mainInfo.n + '/60 ใบ') + '</span></button>'
        : '<button type="button" class="dpill" data-go="shop"><b>ยังไม่มีเด็คของคุณ</b><span class="warn">เริ่มที่ Shop ›</span></button>';
      var modeName = (MODES.filter(function (m) { return m[0] === S.mode; })[0] || MODES[0])[1];
      var hint = (S.mode === 'online' ? 'โหมดออนไลน์: กด PLAY เพื่อสร้างหรือเข้าห้องกับเพื่อน' : 'กด PLAY เพื่อเริ่ม ' + modeName + ' ทันที') + (cur && cur.preset && !st.ownedTotal ? ' · ใช้เด็คตัวอย่างฟรี หรือซื้อ Starter Deck ที่ Shop' : '');

      var h = '<div class="lobby">' +
        '<div class="subbar" role="tablist" aria-label="โหมดการเล่น">' + MODES.map(function (m) { return '<button type="button" role="tab" class="mode' + (S.mode === m[0] ? ' on' : '') + '" aria-selected="' + (S.mode === m[0]) + '" data-mode="' + m[0] + '">' + m[1] + '</button>'; }).join('') +
        '<span class="grow"></span><button type="button" class="sublink" data-hdr="guide">📖 วิธีเล่น</button><button type="button" class="sublink" data-hdr="notes">🔔 ข่าวอัปเดต<i class="ndot" id="ndot"' + (newNote ? '' : ' hidden') + '></i></button><button type="button" class="sublink" data-hdr="feedback">💬 ข้อเสนอแนะ</button></div>' +
        '<section class="stage">' +
          '<div class="art"><div class="artcut"><div class="artin"><div class="glow"></div><div class="fan n' + fan.length + '">' + fanHtml + '</div><div class="logo">AVASTFALL<small>TRADING CARD GAME</small></div></div></div></div>' +
          '<div class="side">' +
            '<div class="center">' +
              '<div class="hexo"><div class="hexi">' + (emblem ? pic(emblem) : '<img src="' + BACK + '" alt="">') + '</div></div>' + deckLine +
              '<div id="ctl" class="ctl">' + ctlHtml(inGame, hint) + '</div>' +
            '</div>' +
            '<button type="button" class="daily' + (me.dailyReady ? ' ready' : ' done') + '" data-act="daily"' + (me.dailyReady ? '' : ' disabled') + '><span class="dc"></span><span class="dt"><small>รางวัลรายวัน</small><b>' + (me.dailyReady ? '+' + me.dailyAmount + ' เหรียญ' : 'รับแล้ว ✓') + '</b></span></button>' +
            '<div class="bottom">' +
              '<button type="button" class="profile" data-act="sets" title="ดูความคืบหน้าแต่ละชุดการ์ด"><span class="hexb"><b>' + sets.done + '</b></span><span class="pinfo"><small>SETS</small><b>' + (sets.next ? esc(sets.next.code) + ' · ขาดอีก ' + (sets.next.total - sets.next.have) + ' ใบ' : sets.list.length ? 'ครบทุกชุดแล้ว 🎉' : 'ยังไม่มีข้อมูลชุด') + '</b><span class="bar"><i class="' + (sets.next ? '' : 'full') + '" style="width:' + (sets.next ? Math.round(sets.next.have / sets.next.total * 100) : 100) + '%"></i></span><em>ชุดที่สะสมครบ ' + sets.done + ' / ' + sets.list.length + ' ชุด</em></span></button>' +
              '<button type="button" class="decksbox" data-go="decks" title="ไปจัดเด็ค"><span class="dinfo"><small>DECKS</small><b>' + (main ? esc(main.name || 'เด็คใหม่') : 'ยังไม่มีเด็ค') + '</b><em>' + decks.length + ' เด็ค</em></span><span class="dbox"><i></i></span></button>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<div class="below">' +
          '<h2>เริ่มต้นใน 3 ขั้นตอน</h2><div class="steps">' + [
            [st.ownedTotal > 0, '1', 'ซื้อการ์ด', 'เปิดซองหรือซื้อ Starter Deck ที่ Shop — มีเหรียญเริ่มต้นให้แล้ว', 'shop', 'ไปร้านค้า'],
            [decks.some(function (d, i) { return infos[i].ok; }), '2', 'จัดเด็ค 60 ใบ', 'ใช้เฉพาะการ์ดที่คุณมี · Avatar 1 ใบ + Main Deck 59 ใบ', 'decks', haveDecks ? 'ไปที่ Decks' : 'สร้างเด็ค'],
            [false, '3', 'ลงสนาม', 'เลือกโหมดด้านบนแล้วกด PLAY เริ่มเล่นได้ทันที — เด็คตัวอย่างใช้ทดลองได้ฟรี', 'play!', 'PLAY']
          ].map(function (s) { return '<div class="box step' + (s[0] ? ' done' : '') + '"><span class="n">' + (s[0] ? '✓' : s[1]) + '</span><div><b>' + s[2] + '</b><p>' + s[3] + '</p></div><button type="button" class="btn sm' + (s[0] ? '' : ' pri') + '" ' + (s[4] === 'play!' ? 'data-act="play"' : 'data-go="' + s[4] + '"') + '>' + s[5] + '</button></div>'; }).join('') + '</div>' +
          (haveDecks ? '<h2>เด็คของฉัน <small>ล่าสุด ' + Math.min(decks.length, 6) + ' จาก ' + decks.length + '</small><span class="grow"></span><button type="button" class="btn sm" data-go="decks">จัดการเด็ค ›</button></h2><div class="decks">' + decks.slice(0, 6).map(function (d, i) {
            var av = S.byId[String(d.avatar || '').toLowerCase()], inf = infos[i];
            return '<div class="box dk">' + (av ? pic(av) : '<div class="noimg">–</div>') + '<div class="info"><b>' + esc(d.name || 'เด็คใหม่') + '</b><span class="' + (inf.ok ? 'ok' : 'warn') + '">' + (inf.ok ? '✓ พร้อมเล่น' : inf.miss ? '⚠ การ์ดที่มีไม่พอ' : inf.n + '/60 ใบ') + '</span>' +
              '<div class="acts2">' + (inf.ok ? '<button type="button" class="btn sm pri" data-act="playdeck" data-deck="' + esc(d.id) + '">▶ เล่น</button>' : '') + '<button type="button" class="btn sm" data-go="decks" data-deck="' + esc(d.id) + '">แก้ไข</button></div></div></div>';
          }).join('') + '</div>' : '') +
          (shop.length ? '<h2>แนะนำในร้านค้า<span class="grow"></span><button type="button" class="btn sm" data-go="shop">ดูทั้งหมด ›</button></h2><div class="shop">' + shop.map(itemHtml).join('') + '</div>' : '') +
          (notes.length ? '<h2>ข่าวอัปเดตล่าสุด</h2><div class="notes">' + notes.map(function (n) {
            return '<div class="box note"><h3>' + esc(n.title) + '</h3><div class="d">' + esc(n.date || String(n.at || '').slice(0, 10)) + '</div><ul>' + (n.items || []).slice(0, 3).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
          }).join('') + '</div>' : '') +
        '</div></div>';
      S.okDeckId = okDeck ? okDeck.id : null; S.inGame = inGame; S.hint = hint;
      $('view').innerHTML = h;
    });
  }

  /* ---------- ปุ่มเล่น / ห้องออนไลน์ (อยู่ที่ Home ทั้งหมด ไม่ต้องย้ายหน้า) ---------- */
  function ctlHtml(inGame, hint) {
    var resume = inGame ? '<button type="button" class="resume" data-act="resume">▶ มีเกมที่กำลังเล่นอยู่ — กลับเข้าเกม</button>' : '';
    if (S.mode === 'online') return resume + onlineHtml();
    return resume + '<button type="button" class="play" data-act="play"><span>PLAY</span></button><p class="hint">' + (hint || '') + '</p>';
  }
  function olStatus(o) {
    if (o.pid === 0 && !o.hadPeer) return 'รอเพื่อนเข้าห้อง… ส่งรหัสหรือลิงก์ให้เพื่อน';
    if (!o.peer) return 'เพื่อนหลุดจากห้อง (รอกลับเข้ามา)';
    if (o.ready) return o.peerReady ? 'กำลังเริ่มเกม…' : 'คุณพร้อมแล้ว รอเพื่อนกดพร้อม…';
    return o.peerReady ? 'เพื่อนพร้อมแล้ว — กด “พร้อม” ได้เลย' : 'เพื่อนเข้าห้องแล้ว — กด “พร้อม” เมื่อพร้อมเล่น';
  }
  function onlineHtml() {
    var G = game(); if (!G) return '<p class="hint">กำลังเตรียมระบบเกม… ลองสลับโหมดอีกครั้ง</p>';
    var u = G.ui, o = u.ol, err = u.err ? '<div class="olerr">' + esc(u.err) + '</div>' : '';
    var derr = G.deckErrors(u.cfg.sel[0]), dwarn = derr.length ? '<div class="olerr">เด็คที่เลือกยังใช้เล่นไม่ได้: ' + esc(derr[0]) + ' · กดที่ป้ายเด็คด้านบนเพื่อเปลี่ยน</div>' : '';
    var name = '<label class="olrow"><span>ชื่อที่แสดง</span><input id="olname" maxlength="16" autocomplete="off" value="' + esc(u.pname || '') + '" placeholder="ชื่อของคุณ (ไม่ใส่ก็ได้)"></label>';
    if (!o) {
      return '<div class="olbox">' + name +
        '<button type="button" class="play ol" data-act="olcreate"' + (u.olbusy ? ' disabled' : '') + '><span>สร้างห้อง</span></button>' +
        '<div class="olrow join"><input id="olcode" maxlength="5" autocomplete="off" value="' + esc(u.olcode || '') + '" placeholder="รหัสห้อง 5 ตัว"><button type="button" class="btn pri" data-act="oljoin"' + (u.olbusy ? ' disabled' : '') + '>เข้าห้อง</button></div>' +
        err + dwarn + '<p class="hint">สร้างห้องแล้วส่งรหัสให้เพื่อน หรือกรอกรหัสที่เพื่อนให้มา · เด็คที่ใช้คือเด็คในป้ายด้านบน</p></div>';
    }
    var link = location.origin + '/?room=' + o.code;
    return '<div class="olbox"><div class="olcode">ห้อง <b>' + esc(o.code) + '</b></div><p class="olst">' + esc(olStatus(o)) + '</p>' + (o.conn === false ? '<p class="hint">⚠ กำลังเชื่อมต่อเซิร์ฟเวอร์ใหม่…</p>' : '') + (o.ready ? '' : name) +
      '<div class="olrow"><input id="ollink" readonly value="' + esc(link) + '"><button type="button" class="btn sm" data-act="olcopy">คัดลอกลิงก์</button></div>' +
      '<div class="olrow"><button type="button" class="btn pri" data-act="olready"' + ((!o.peer || o.ready || derr.length) ? ' disabled' : '') + '>พร้อม</button><button type="button" class="btn" data-act="olleave">ออกจากห้อง</button></div>' + err + dwarn + '</div>';
  }
  function refreshCtl() { var c = $('ctl'); if (c) c.innerHTML = ctlHtml(S.inGame, S.hint); }
  /* ติดตามสถานะห้อง (อยู่ในเว็บหลัก) ทุก 0.5 วินาที: เปลี่ยนเมื่อไรค่อยวาดใหม่ · เกมเริ่มแล้วสลับไปกระดานเอง */
  var lastSig = '';
  setInterval(function () {
    if (S.view !== 'home') return;
    var G = game(); if (!G) return; var u = G.ui, o = u.ol;
    if (o && S.mode !== 'online') { S.mode = 'online'; try { localStorage.setItem('af-lobby-mode', 'online'); } catch (e) { } show('home'); return; }   // เปิดลิงก์ห้อง ?room=
    if (u.screen === 'game' && S.mode === 'online' && !S.inGame) { S.inGame = true; go('play'); return; }
    if (S.mode !== 'online') { lastSig = ''; return; }
    var sig = JSON.stringify([o && [o.code, o.peer, o.ready, o.peerReady, o.conn, o.hadPeer], u.err, u.olbusy, u.screen]);
    if (sig === lastSig) return;
    var ae = document.activeElement; if (ae && ae.closest && ae.closest('#ctl') && ae.tagName === 'INPUT') return;   // กำลังพิมพ์อยู่ ไม่วาดทับ
    lastSig = sig; S.inGame = u.screen === 'game'; refreshCtl();
  }, 500);
  document.addEventListener('input', function (e) {
    var G = game(); if (!G) return;
    if (e.target.id === 'olname') { G.ui.pname = e.target.value; try { localStorage.setItem('af-pname', G.ui.pname); } catch (er) { } }
    if (e.target.id === 'olcode') { e.target.value = e.target.value.toUpperCase(); G.ui.olcode = e.target.value; }
  });
  function olAct(act) {
    var G = game(), W = window.parent; if (!G) return; var u = G.ui;
    if (act === 'olcreate') { u.cfg.mode = 'online'; G.saveCfg(); W.olCreate(); }
    else if (act === 'oljoin') { u.cfg.mode = 'online'; G.saveCfg(); W.olJoin(u.olcode); }
    else if (act === 'olready') W.olReady();
    else if (act === 'olleave') { W.olLeave(true); u.err = ''; lastSig = ''; refreshCtl(); }
    else if (act === 'olcopy') {
      var inp = $('ollink'), btn = document.querySelector('[data-act="olcopy"]'), ok = false;
      try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(inp.value).catch(function () { }); ok = true; } } catch (er) { }
      if (!ok) { inp.select(); try { ok = document.execCommand('copy'); } catch (er) { } }
      if (btn) btn.textContent = ok ? 'คัดลอกแล้ว' : 'กดคัดลอกเอง';
    }
    lastSig = '';
  }

  /* ---------- ตั้งค่าแมตช์ (เด็คของทั้งสองฝั่ง · ใครเล่นก่อน) เป็นหน้าต่างบน Home ---------- */
  function openMatch() {
    var G = game(); if (!G) { toast('ระบบเกมยังโหลดไม่เสร็จ ลองอีกครั้ง', true); return; }
    try { G.ui.my = window.parent.loadMy(); G.ui.cfg.mode = S.mode === 'online' ? 'online' : (G.ui.cfg.mode === 'online' ? 'bot' : G.ui.cfg.mode); } catch (e) { }
    var dlg = openDlg('', function () { show('home'); });
    var draw = function () {
      var u = G.ui, c = u.cfg, all = G.allDecks(), top = dlg.scrollTop;
      var row = function (d, p) {
        var av = S.byId && S.byId[String(d.avatar || '').toLowerCase()], errs = G.deckErrors(d.key), on = c.sel[p] === d.key;
        return '<button type="button" class="drow' + (on ? ' on' : '') + '" data-pick="' + p + '" data-k="' + esc(d.key) + '"><span class="th">' + (av ? pic(av) : '') + '</span><span class="tx"><b>' + esc(d.name) + '</b><small>' + (d.preset ? esc(d.series || 'เด็คตัวอย่าง') + ' · ตัวอย่างฟรี' : 'เด็คของฉัน') + '</small></span><span class="' + (errs.length ? 'warn' : 'ok') + '">' + (errs.length ? '⚠ ' + esc(errs[0].length > 46 ? errs[0].slice(0, 46) + '…' : errs[0]) : '✓ พร้อมเล่น') + '</span></button>';
      };
      var mine = all.filter(function (d) { return !d.preset; }), pre = all.filter(function (d) { return d.preset; });
      var list = function (p) { return (mine.length ? '<div class="dgrp">เด็คของฉัน</div>' + mine.map(function (d) { return row(d, p); }).join('') : '') + '<div class="dgrp">เด็คตัวอย่าง (ใช้ฟรี)</div>' + pre.map(function (d) { return row(d, p); }).join(''); };
      var two = S.mode !== 'online';
      dlg.innerHTML = '<button type="button" class="x" aria-label="ปิด">✕</button><h2>เลือกเด็ค</h2><p class="mut" style="margin:0 40px 6px 0">' + (S.mode === 'online' ? 'เลือกเด็คของคุณสำหรับห้องออนไลน์' : 'เลือกเด็คของทั้งสองฝั่งและใครเล่นก่อน · กด PLAY ที่ Home เพื่อเริ่มได้ทันที') + '</p>' +
        '<div class="mgrid"><section><h3>' + (S.mode === 'bot' ? 'เด็คของคุณ' : S.mode === 'hot' ? 'เด็คผู้เล่น 1' : 'เด็คของคุณ') + '</h3><div class="dlist">' + list(0) + '</div></section>' +
        (two ? '<section><h3>' + (S.mode === 'bot' ? 'เด็คบอท' : 'เด็คผู้เล่น 2') + '</h3><button type="button" class="btn sm' + (c.picked1 ? '' : ' pri') + '" data-rand="1">🎲 สุ่มเด็คตัวอย่างทุกครั้ง</button><div class="dlist">' + list(1) + '</div></section>' : '') + '</div>' +
        (two ? '<div class="srow2"><b>ใครเล่นก่อน</b>' + [['random', 'สุ่ม'], ['0', 'ผู้เล่น 1'], ['1', 'ผู้เล่น 2']].map(function (f) { return '<button type="button" class="btn sm' + (String(c.first) === f[0] ? ' pri' : '') + '" data-first="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' : '') +
        '<div class="acts3"><button type="button" class="btn pri" data-mclose="1">เสร็จสิ้น</button></div>';
      dlg.scrollTop = top;
    };
    dlg.onclick = function (e) {
      var G2 = game(), c = G2.ui.cfg, t = e.target;
      if (t.closest('.x') || t.closest('[data-mclose]')) { closeDlg(); return; }
      var pk = t.closest('[data-pick]'); if (pk) { c.sel[+pk.dataset.pick] = pk.dataset.k; c['picked' + pk.dataset.pick] = true; G2.saveCfg(); draw(); return; }
      if (t.closest('[data-rand]')) { c.picked1 = false; G2.saveCfg(); draw(); return; }
      var f = t.closest('[data-first]'); if (f) { c.first = f.dataset.first; G2.saveCfg(); draw(); }
    };
    draw();
  }

  /* ---------- ร้านค้า ---------- */
  function itemHtml(it) {
    var cards = (S.cards || []).filter(function (c) { return c.deck.toLowerCase() === it.set.toLowerCase() && c.image; });
    var art;
    if (it.kind === 'pack') {
      var a = cards[0], b = cards[Math.floor(cards.length / 2)], c = cards[cards.length - 1];
      art = '<div class="art pack">' + (a ? pic(a) : '') + (c ? pic(c) : '') + (b ? pic(b) : '<img src="' + BACK + '" alt="">') + '</div>';
    } else art = '<div class="art">' + (it.cover ? '<img src="' + esc(it.cover) + '" alt="' + esc(it.name) + '">' : '<img src="' + BACK + '" alt="">') + '</div>';
    var max = it.kind === 'pack' ? 10 : 3, q = Math.min(S.qty[it.id] || 1, max);
    var tag = '<span class="tag">' + (it.kind === 'pack' ? 'ซอง ' + (it.size || 8) + ' ใบ' : 'Starter · ' + it.cardCount + ' แบบ ×' + (it.copies || 3)) + '</span>';
    art = art.replace('>', '>' + tag);                                   // แทรกป้ายหลังแท็กเปิดของ .art
    var have = (S.cards || []).filter(function (c) { return c.deck.toLowerCase() === it.set.toLowerCase() && /^[A-Za-z0-9]+-\d+$/.test(c.id) && S.own[c.id] > 0; }).length;
    return '<article class="box item" data-id="' + esc(it.id) + '">' + art +
      '<div class="body"><h3>' + esc(it.name) + '</h3><div class="desc">' + esc(it.description) + '</div><div class="mut own">สะสมจากชุดนี้แล้ว ' + have + ' / ' + (it.cardCount || 0) + ' แบบ</div><div class="buy"><span class="price"><i class="cn"></i> <span data-total>' + fmt(it.price * q) + '</span></span>' +
      '<span class="qty"><button type="button" data-act="dec" aria-label="ลด">−</button><span data-q>' + q + '</span><button type="button" data-act="inc" aria-label="เพิ่ม">+</button></span>' +
      '<button type="button" class="btn pri" data-act="buy">ซื้อ</button></div></div></article>';
  }
  /* ปุ่มซื้อ: เหรียญไม่พอ = กดไม่ได้ (ฝั่งเซิร์ฟเวอร์ตรวจซ้ำอีกชั้น) */
  function refreshBuyState() {
    Array.prototype.forEach.call(document.querySelectorAll('.item'), function (el) {
      var it = S.items[el.dataset.id]; if (!it) return;
      var q = S.qty[it.id] || 1, can = S.coins >= it.price * q, b = el.querySelector('[data-act="buy"]');
      b.disabled = !can; b.textContent = can ? 'ซื้อ' : 'เหรียญไม่พอ'; el.querySelector('[data-total]').parentNode.classList.toggle('short', !can);
    });
  }
  function renderShop() {
    return Promise.all([api('GET', '/api/shop'), loadCards(), loadOwned().catch(function () { })]).then(function (r) {
      var items = r[0].data; S.items = {}; items.forEach(function (i) { S.items[i.id] = i; }); setCoins(r[0].coins);
      var packs = items.filter(function (i) { return i.kind === 'pack'; }), starters = items.filter(function (i) { return i.kind === 'starter'; });
      $('view').innerHTML = '<div class="page"><div class="pagehead"><div><h1>ร้านค้า</h1><p class="mut">ใช้เหรียญซื้อซองการ์ดและ Starter Deck · รับเหรียญฟรีทุกวันที่หน้า Home</p></div><span class="grow"></span><div class="bal"><i class="cn"></i><span>เหรียญของคุณ</span><b data-bal>' + fmt(S.coins) + '</b></div><button type="button" class="btn" data-go="cards">🃏 ดูการ์ดของฉัน</button></div>' +
        (starters.length ? '<h2>Starter Deck <small>ได้การ์ดครบชุด ใบละ 3 ใบ พร้อมจัดเด็คได้ทันที — เหมาะสำหรับมือใหม่</small></h2><div class="shop">' + starters.map(itemHtml).join('') + '</div>' : '') +
        (packs.length ? '<h2>ซองการ์ด <small>สุ่มได้ใบหายากเพิ่ม</small></h2><div class="shop">' + packs.map(itemHtml).join('') + '</div>' : '') +
        (!items.length ? '<div class="box empty">ยังไม่มีสินค้าวางขาย</div>' : '') + '</div>';
      refreshBuyState();
    });
  }
  function buy(id, btn) {
    var it = S.items && S.items[id]; var q = S.qty[id] || 1; if (!it) return;
    btn.disabled = true;
    api('POST', '/api/shop/buy', { itemId: id, qty: q }).then(function (res) {
      setCoins(res.coins); tell({ afOwned: 1 });
      return loadOwned().catch(function () { }).then(function () { reveal(res); });
    }).catch(function (e) { toast(e.message, true); }).then(function () { refreshBuyState(); });
  }

  /* ---------- เปิดซอง / รับ Starter ---------- */
  function revClass(c) { var r = String(c.rarity || 'C').toUpperCase(); return r === 'C' ? '' : r === 'R' ? 'rare' : 'srare'; }
  function reveal(res) {
    var packs = res.packs, i = 0, isPack = res.kind === 'pack';
    function draw() {
      var list = packs[i], flipped = 0, last = i >= packs.length - 1;
      var dlg = $('ov').querySelector('.dlg') || openDlg('');
      dlg.innerHTML = '<button type="button" class="x" aria-label="ปิด">✕</button><div class="reveal-top"><h2 style="margin:0">' + (isPack ? '🎉 เปิดซอง' + (packs.length > 1 ? ' ' + (i + 1) + '/' + packs.length : '') : '🎁 ได้รับ ' + esc(res.item.name)) + '</h2><span class="grow"></span>' +
        (isPack ? '<button type="button" class="btn sm" data-r="all">พลิกทั้งหมด</button>' : '') + (isPack && !last ? '<button type="button" class="btn pri sm" data-r="next">ซองถัดไป ›</button>' : '<button type="button" class="btn sm" data-r="done">เสร็จสิ้น</button><button type="button" class="btn pri sm" data-r="deck">🃏 ไปจัดเด็ค ›</button>') + '</div>' +
        '<div class="reveal">' + list.map(function (c, n) {
          return '<button type="button" class="rc ' + revClass(c) + (isPack ? '' : ' flip') + '" data-n="' + n + '" aria-label="' + (isPack ? 'พลิกการ์ด' : esc(c.name)) + '"><span class="b"><img src="' + BACK + '" alt=""></span><span class="f">' + pic(c) + (c.isNew ? '<span class="new">NEW</span>' : '') + (c.qty > 1 ? '<span class="qq">×' + c.qty + '</span>' : '') + '</span></button>';
        }).join('') + '</div><p class="mut center" id="rvInfo" style="margin:12px 0 0">' + (isPack ? 'แตะการ์ดเพื่อพลิก' : 'ใบที่มี “NEW” คือการ์ดใหม่ของคุณ · การ์ดเหล่านี้ใช้จัดเด็คที่ Decks ได้ทันที') + '</p>';
      var info = function () {
        if (!isPack) return;
        var nw = list.filter(function (c) { return c.isNew; }).length;
        $('rvInfo').textContent = flipped >= list.length ? (nw ? '✨ ได้การ์ดใหม่ ' + nw + ' ใบ!' : 'ไม่มีการ์ดใหม่ในซองนี้') : 'แตะการ์ดเพื่อพลิก (' + flipped + '/' + list.length + ')';
      };
      dlg.onclick = function (e) {
        if (e.target.closest('.x')) { closeDlg(); return; }
        var rc = e.target.closest('.rc'), act = e.target.closest('[data-r]');
        if (rc && isPack) { if (!rc.classList.contains('flip')) { rc.classList.add('flip'); flipped++; info(); } else cardDetail(list[+rc.dataset.n]); }
        else if (rc) cardDetail(list[+rc.dataset.n]);
        if (!act) return;
        if (act.dataset.r === 'all') { dlg.querySelectorAll('.rc').forEach(function (x) { x.classList.add('flip'); }); flipped = list.length; info(); }
        if (act.dataset.r === 'next') { i++; draw(); }
        if (act.dataset.r === 'done') closeDlg();
        if (act.dataset.r === 'deck') { closeDlg(); go('decks'); }
      };
    }
    openDlg('', function () { if (S.view === 'shop') show('shop'); });
    draw();
  }

  /* ---------- สลับหน้า ---------- */
  var RENDER = { home: renderHome, shop: renderShop };
  var seq = 0;
  function show(v) {
    if (!RENDER[v]) v = 'home'; S.view = v; var my = ++seq;
    document.title = { home: 'Home', shop: 'ร้านค้า' }[v] + ' · AvastFall TCG';
    try { history.replaceState(null, '', '#' + v); } catch (e) { }
    tell({ afHubView: v });
    return RENDER[v]().then(function () {
      if (my !== seq) return;
      var vw = $('view'); vw.classList.remove('in'); void vw.offsetWidth; vw.classList.add('in'); window.scrollTo(0, 0);
    }).catch(function (e) { if (my === seq) $('view').innerHTML = '<div class="page"><div class="box empty">โหลดข้อมูลไม่สำเร็จ: ' + esc(e.message) + '<br><br><button type="button" class="btn" data-view="' + v + '">ลองใหม่</button></div></div>'; });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var vb = t.closest('[data-view]'); if (vb) { show(vb.dataset.view); return; }
    var md = t.closest('[data-mode]'); if (md) {
      S.mode = md.dataset.mode; try { localStorage.setItem('af-lobby-mode', S.mode); } catch (er) { }
      var G = game(); if (G) { if (S.mode !== 'online' && G.ui.ol) window.parent.olLeave(true); G.ui.cfg.mode = S.mode === 'online' ? 'online' : (G.ui.cfg.mode === 'online' ? 'bot' : G.ui.cfg.mode); G.saveCfg(); G.ui.err = ''; }
      var mn = (MODES.filter(function (m) { return m[0] === S.mode; })[0] || MODES[0])[1]; if (S.mode !== 'online') S.hint = 'กด PLAY เพื่อเริ่ม ' + mn + ' ทันที';
      lastSig = ''; refreshCtl();
      Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (b) { var on = b === md; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      return;
    }
    var hd = t.closest('[data-hdr]'); if (hd) {
      var k = hd.dataset.hdr;
      if (k === 'notes') { var nd = $('ndot'); if (nd) nd.hidden = true; }
      try { if (k !== 'guide' && window.parent.AFSite && window.parent.AFSite.panel) { window.parent.AFSite.panel(k); return; } } catch (er) { }
      tell({ afHdr: k }); return;
    }
    var g = t.closest('[data-go]'); if (g) { if (g.closest('.ov')) closeDlg(); go(g.dataset.go, g.dataset.deck ? { deckId: g.dataset.deck } : null); return; }
    var cc = t.closest('[data-card]'); if (cc && S.byId) { cardDetail(S.byId[cc.dataset.card.toLowerCase()]); return; }
    var a = t.closest('[data-act]'); if (!a) return;
    var item = a.closest('.item'), id = item && item.dataset.id;
    if (a.dataset.act === 'inc' || a.dataset.act === 'dec') {
      var it = S.items && S.items[id] || { price: 0, kind: 'pack' }, max = it.kind === 'pack' ? 10 : 3, q = Math.max(1, Math.min(max, (S.qty[id] || 1) + (a.dataset.act === 'inc' ? 1 : -1)));
      S.qty[id] = q; item.querySelector('[data-q]').textContent = q; item.querySelector('[data-total]').textContent = fmt(it.price * q); refreshBuyState();
    } else if (a.dataset.act === 'buy') buy(id, a);
    else if (a.dataset.act === 'play') launch(null);
    else if (a.dataset.act === 'setup') openMatch();
    else if (a.dataset.act === 'sets') openSets();
    else if (/^ol/.test(a.dataset.act)) olAct(a.dataset.act);
    else if (a.dataset.act === 'resume') go('play');
    else if (a.dataset.act === 'playdeck') launch(a.dataset.deck);
    else if (a.dataset.act === 'daily') { a.disabled = true; api('POST', '/api/me/daily').then(function (r) { setCoins(r.coins); toast('🎁 ได้รับ ' + r.amount + ' เหรียญ!'); show('home'); }).catch(function (er) { toast(er.message, true); a.disabled = false; }); }
  });
  /* เว็บหลักสั่งสลับหน้า (แท็บ Home / Shop บนแถบเมนู) */
  addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.afNotesSeen) { var nd = $('ndot'); if (nd) nd.hidden = true; }
    if (e.data.afView && RENDER[e.data.afView]) show(e.data.afView);
  });

  var h = location.hash.replace('#', '');
  show(RENDER[h] ? h : 'home');
})();
