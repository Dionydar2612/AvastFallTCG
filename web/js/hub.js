/* Home (ล็อบบี้) · ร้านค้า  (web/hub.html — ฝังเป็น iframe ในเว็บหลัก แท็บ Home/Shop อยู่ที่แถบเมนูหลัก)
   - Home จัดวางแบบล็อบบี้เกม: ซ้ายภาพเด่น · กลางเหรียญตราเด็ค + ปุ่ม PLAY · ขวาแถบรางวัลรายวัน · ล่างซ้ายโปรไฟล์ · ล่างขวาเด็ค
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
  function launch(deckId) { tell({ afLaunch: { mode: S.mode, deckId: deckId || null } }); }
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

  function renderHome() {
    return Promise.all([api('GET', '/api/me'), api('GET', '/api/updates').catch(function () { return { data: [] }; }), loadCards(), api('GET', '/api/shop').catch(function () { return { data: [] }; }), loadOwned().catch(function () { })]).then(function (r) {
      var me = r[0], notes = (r[1].data || []).slice(0, 3), shop = (r[3].data || []).slice(0, 3); S.me = me; setCoins(me.user.coins); S.items = {}; shop.forEach(function (i) { S.items[i.id] = i; });
      var st = me.stats, pct = st.totalCards ? Math.round(st.ownedUnique / st.totalCards * 100) : 0;
      var decks = readDecks().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
      var infos = decks.map(deckInfo), okDeck = decks.filter(function (d, i) { return infos[i].ok; })[0] || null;
      var main = decks[0] || null, mainInfo = main ? infos[0] : null;
      var fan = pickAvatars(decks), emblem = fan[0] || null;
      var haveDecks = decks.length > 0;

      var fanHtml = fan.map(function (c, i) { return '<div class="fc f' + i + '">' + pic(c) + '</div>'; }).join('');
      var deckLine = main ? '<button type="button" class="dpill" data-go="decks" title="ไปจัดเด็ค"><b>' + esc(main.name || 'เด็คใหม่') + '</b><span class="' + (mainInfo.ok ? 'ok' : 'warn') + '">' + (mainInfo.ok ? '✓ พร้อมเล่น' : mainInfo.miss ? '⚠ การ์ดไม่พอ' : mainInfo.n + '/60 ใบ') + '</span></button>'
        : '<button type="button" class="dpill" data-go="shop"><b>ยังไม่มีเด็คของคุณ</b><span class="warn">เริ่มที่ Shop ›</span></button>';
      var hint = okDeck ? 'เล่นด้วยเด็ค “' + esc(okDeck.name || 'เด็คใหม่') + '”' : (st.ownedTotal ? 'จัดเด็คให้ครบ 60 ใบที่ Decks · ตอนนี้ลองเล่นด้วยเด็คตัวอย่างได้เลย' : 'ยังไม่มีการ์ด — ลองเล่นด้วยเด็คตัวอย่างฟรี หรือไปซื้อ Starter Deck ที่ Shop');

      var h = '<div class="lobby">' +
        '<div class="subbar" role="tablist" aria-label="โหมดการเล่น">' + MODES.map(function (m) { return '<button type="button" role="tab" class="mode' + (S.mode === m[0] ? ' on' : '') + '" aria-selected="' + (S.mode === m[0]) + '" data-mode="' + m[0] + '">' + m[1] + '</button>'; }).join('') +
        '<span class="grow"></span><button type="button" class="sublink" data-hdr="guide">📖 วิธีเล่น</button><button type="button" class="sublink" data-hdr="notes">🔔 ข่าวอัปเดต</button></div>' +
        '<section class="stage">' +
          '<div class="art"><div class="artcut"><div class="artin"><div class="glow"></div><div class="fan n' + fan.length + '">' + fanHtml + '</div><div class="logo">AVASTFALL<small>TRADING CARD GAME</small></div></div></div></div>' +
          '<div class="side">' +
            '<div class="center">' +
              '<div class="hexo"><div class="hexi">' + (emblem ? pic(emblem) : '<img src="' + BACK + '" alt="">') + '</div></div>' + deckLine +
              '<button type="button" class="play" data-act="play"><span>PLAY</span></button>' +
              '<p class="hint">' + hint + '</p>' +
            '</div>' +
            '<button type="button" class="daily' + (me.dailyReady ? ' ready' : ' done') + '" data-act="daily"' + (me.dailyReady ? '' : ' disabled') + '><span class="dc"></span><span class="dt"><small>รางวัลรายวัน</small><b>' + (me.dailyReady ? '+' + me.dailyAmount + ' เหรียญ' : 'รับแล้ว ✓') + '</b></span></button>' +
            '<div class="bottom">' +
              '<button type="button" class="profile" data-go="cards" title="ดูการ์ดของฉัน"><span class="hexb"><b>' + st.ownedUnique + '</b></span><span class="pinfo"><small>PROFILE</small><b>' + esc(me.user.username) + '</b><span class="bar"><i class="' + (pct >= 100 ? 'full' : '') + '" style="width:' + pct + '%"></i></span><em>สะสมแล้ว ' + st.ownedUnique + ' / ' + st.totalCards + ' แบบ</em></span></button>' +
              '<button type="button" class="decksbox" data-go="decks" title="ไปจัดเด็ค"><span class="dinfo"><small>DECKS</small><b>' + (main ? esc(main.name || 'เด็คใหม่') : 'ยังไม่มีเด็ค') + '</b><em>' + decks.length + ' เด็ค</em></span><span class="dbox"><i></i></span></button>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<div class="below">' +
          '<h2>เริ่มต้นใน 3 ขั้นตอน</h2><div class="steps">' + [
            [st.ownedTotal > 0, '1', 'ซื้อการ์ด', 'เปิดซองหรือซื้อ Starter Deck ที่ Shop — มีเหรียญเริ่มต้นให้แล้ว', 'shop', 'ไปร้านค้า'],
            [decks.some(function (d, i) { return infos[i].ok; }), '2', 'จัดเด็ค 60 ใบ', 'ใช้เฉพาะการ์ดที่คุณมี · Avatar 1 ใบ + Main Deck 59 ใบ', 'decks', haveDecks ? 'ไปที่ Decks' : 'สร้างเด็ค'],
            [false, '3', 'ลงสนาม', 'เลือกโหมดด้านบนแล้วกด PLAY — เด็คตัวอย่างใช้ทดลองได้ฟรี', 'play', 'เล่นเลย']
          ].map(function (s) { return '<div class="box step' + (s[0] ? ' done' : '') + '"><span class="n">' + (s[0] ? '✓' : s[1]) + '</span><div><b>' + s[2] + '</b><p>' + s[3] + '</p></div><button type="button" class="btn sm' + (s[0] ? '' : ' pri') + '" data-go="' + s[4] + '">' + s[5] + '</button></div>'; }).join('') + '</div>' +
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
      S.okDeckId = okDeck ? okDeck.id : null;
      $('view').innerHTML = h;
    });
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
      Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (b) { var on = b === md; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      return;
    }
    var hd = t.closest('[data-hdr]'); if (hd) { tell({ afHdr: hd.dataset.hdr }); return; }
    var g = t.closest('[data-go]'); if (g) { go(g.dataset.go, g.dataset.deck ? { deckId: g.dataset.deck } : null); return; }
    var cc = t.closest('[data-card]'); if (cc && S.byId) { cardDetail(S.byId[cc.dataset.card.toLowerCase()]); return; }
    var a = t.closest('[data-act]'); if (!a) return;
    var item = a.closest('.item'), id = item && item.dataset.id;
    if (a.dataset.act === 'inc' || a.dataset.act === 'dec') {
      var it = S.items && S.items[id] || { price: 0, kind: 'pack' }, max = it.kind === 'pack' ? 10 : 3, q = Math.max(1, Math.min(max, (S.qty[id] || 1) + (a.dataset.act === 'inc' ? 1 : -1)));
      S.qty[id] = q; item.querySelector('[data-q]').textContent = q; item.querySelector('[data-total]').textContent = fmt(it.price * q); refreshBuyState();
    } else if (a.dataset.act === 'buy') buy(id, a);
    else if (a.dataset.act === 'play') launch(S.okDeckId);
    else if (a.dataset.act === 'playdeck') launch(a.dataset.deck);
    else if (a.dataset.act === 'daily') { a.disabled = true; api('POST', '/api/me/daily').then(function (r) { setCoins(r.coins); toast('🎁 ได้รับ ' + r.amount + ' เหรียญ!'); show('home'); }).catch(function (er) { toast(er.message, true); a.disabled = false; }); }
  });
  /* เว็บหลักสั่งสลับหน้า (แท็บ Home / Shop บนแถบเมนู) */
  addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.afView && RENDER[e.data.afView]) show(e.data.afView); });

  var h = location.hash.replace('#', '');
  show(RENDER[h] ? h : 'home');
})();
