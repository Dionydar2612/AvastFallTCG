/* Home · ร้านค้า · คอลเลกชัน (web/hub.html — ฝังเป็น iframe ในแท็บ Home/Shop ของเว็บหลัก หรือเปิดตรง /hub.html ก็ได้)
   ข้อมูลทั้งหมดมาจาก API ที่ต้องล็อกอิน (Supabase): /api/me · /api/me/daily · /api/me/collection · /api/shop · /api/shop/buy · /api/cards */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var BACK = '/assets/card-back.jpg';
  var S = { view: 'home', cards: null, byId: null, owned: null, qty: {}, colSet: '', colOwn: 'all', colQ: '', me: null };
  var framed = window.parent !== window;

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
  function setCoins(n) {
    $('coinNum').textContent = Number(n).toLocaleString('th-TH');
    var c = $('coinChip'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
    if (S.me) S.me.user.coins = n;
    if (framed) { try { window.parent.postMessage({ afCoins: n }, location.origin); } catch (e) { } }
  }
  function go(target, extra) {
    if (framed) { try { window.parent.postMessage(Object.assign({ afGo: target }, extra || {}), location.origin); return; } catch (e) { } }
    location.href = target === 'play' ? '/' : target === 'deck' ? '/#deckbuilder' : '/#cards';
  }
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
    var own = S.owned ? (S.owned[c.id] || 0) : null;
    openDlg('<div class="detail"><div>' + pic(c) + '</div><div><h2>' + esc(c.name) + '</h2><div class="mut">' + esc(c.id) + (own != null ? ' · คุณมี <b>' + own + '</b> ใบ' : '') + '</div>' +
      '<div class="tags"><span class="tg">' + esc(c.type) + (c.sub ? ' · ' + esc(c.sub) : '') + '</span>' + els.map(function (e) { return '<span class="tg">ธาตุ' + esc(e) + '</span>'; }).join('') +
      (c.rarity ? '<span class="tg">Rarity ' + esc(c.rarity) + '</span>' : '') + (c.rotation ? '<span class="tg">Rotation ' + esc(c.rotation) + '</span>' : '') + (c.tribe ? '<span class="tg">' + esc(c.tribe) + '</span>' : '') + '</div>' +
      (st.length ? '<div class="tags">' + st.map(function (x) { return '<span class="tg" style="background:var(--gold);color:#111">' + x[0] + ' ' + esc(x[1] == null ? '-' : x[1]) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="eff">' + ((c.effects || []).length ? c.effects.map(function (e) { return '<p>' + (e.keyword ? '<span class="kw ' + esc(String(e.keyword).split(' ')[0]) + '">' + esc(e.keyword) + '</span>' : '') + esc(e.text) + '</p>'; }).join('') : '<span class="mut">ไม่มีเอฟเฟกต์</span>') + '</div>' +
      (c.flavor ? '<p class="mut"><i>' + esc(c.flavor) + '</i></p>' : '') + (c.artist ? '<p class="mut">นักวาด: ' + esc(c.artist) + '</p>' : '') + '</div></div>', null, !$('ov').hidden);
  }

  /* ---------- HOME ---------- */
  function readDecks() { try { var a = JSON.parse(localStorage.getItem('cl-decks') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function deckSize(d) { return 1 + Object.keys(d.counts || {}).reduce(function (a, k) { return a + (d.counts[k] || 0); }, 0); }

  function renderHome() {
    return Promise.all([api('GET', '/api/me'), api('GET', '/api/updates').catch(function () { return { data: [] }; }), loadCards(), api('GET', '/api/shop').catch(function () { return { data: [] }; })]).then(function (r) {
      var me = r[0], notes = (r[1].data || []).slice(0, 3), shop = (r[3].data || []).slice(0, 3); S.me = me; setCoins(me.user.coins);
      var st = me.stats, pct = st.totalCards ? Math.round(st.ownedUnique / st.totalCards * 100) : 0, decks = readDecks().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
      var h = '<section class="box hero"><div><h1>สวัสดี, ' + esc(me.user.username) + '! 👋</h1><p>พร้อมลุยหรือยัง? จัดเด็ค ซื้อซองการ์ด หรือเข้าไปทดลองเล่นได้เลย</p>' +
        '<div class="acts">' + (me.dailyReady ? '<button type="button" class="btn pri" data-act="daily">🎁 รับเหรียญประจำวัน +' + me.dailyAmount + '</button>' : '<span class="btn" style="cursor:default" title="พรุ่งนี้มารับใหม่ได้">✅ รับรางวัลวันนี้แล้ว</span>') +
        '<button type="button" class="btn" data-go="play">⚔ ทดลองเล่น</button>' + (me.user.role === 'admin' ? '<a class="btn" href="/admin" target="_blank" rel="noopener">🔧 หลังบ้าน</a>' : '') +
        '<button type="button" class="btn" data-act="logout">ออกจากระบบ</button></div></div><div class="big-a" aria-hidden="true">A</div></section>' +
        '<div class="stats">' +
        '<div class="box stat"><b>' + st.ownedUnique + '<small class="mut"> / ' + st.totalCards + '</small></b><span>การ์ดที่สะสมได้</span><div class="bar"><i class="' + (pct >= 100 ? 'full' : '') + '" style="width:' + pct + '%"></i></div></div>' +
        '<div class="box stat"><b>' + st.ownedTotal + '</b><span>การ์ดทั้งหมด (รวมใบซ้ำ)</span></div>' +
        '<div class="box stat"><b>' + decks.length + '</b><span>เด็คของฉัน</span></div>' +
        '<div class="box stat"><b>' + st.packsOpened + '</b><span>ซองที่เปิดแล้ว</span></div></div>' +
        '<h2>เริ่มจากตรงไหนดี</h2><div class="quick">' +
        qk('🛒', 'ร้านค้า', 'ซื้อซองการ์ดและ Starter Deck', 'view="shop"') + qk('🃏', 'จัดเด็ค', 'Deckbuilder สร้าง/แก้/แชร์เด็ค', 'go="deck"') +
        qk('🖼', 'Card List', 'แกลเลอรี / รายการ / ตาราง', 'go="cards"') + qk('📚', 'คอลเลกชัน', 'ดูการ์ดที่มี และที่ยังขาด', 'view="collection"') + qk('⚔', 'ทดลองเล่น', 'เล่นกับบอทหรือเพื่อนออนไลน์', 'go="play"') + '</div>' +
        '<h2>เด็คของฉัน <small>' + (decks.length ? 'ล่าสุด ' + Math.min(decks.length, 6) + ' จาก ' + decks.length : '') + '</small><span class="grow"></span><button type="button" class="btn sm" data-go="deck">+ สร้างเด็คใหม่</button></h2>' +
        (decks.length ? '<div class="decks">' + decks.slice(0, 6).map(function (d) {
          var av = S.byId[String(d.avatar || '').toLowerCase()], n = deckSize(d), okk = n === 60;
          return '<div class="box dk">' + (av ? pic(av) : '<div class="noimg">–</div>') + '<div class="info"><b>' + esc(d.name || 'เด็คใหม่') + '</b><span class="' + (okk ? 'ok' : 'warn') + '">' + (okk ? '✓ ครบ 60 ใบ' : n + '/60 ใบ') + '</span>' +
            '<div style="margin-top:4px;display:flex;gap:6px"><button type="button" class="btn sm" data-go="deck" data-deck="' + esc(d.id) + '">แก้ไข</button><button type="button" class="btn sm" data-go="play">เล่น</button></div></div></div>';
        }).join('') + '</div>' : '<div class="box empty">ยังไม่มีเด็ค — กด “สร้างเด็คใหม่” หรือซื้อ Starter Deck ในร้านค้าแล้วเริ่มจัดเด็คได้เลย</div>') +
        (shop.length ? '<h2>แนะนำในร้านค้า<span class="grow"></span><button type="button" class="btn sm" data-view="shop">ดูทั้งหมด ›</button></h2><div class="shop">' + shop.map(itemHtml).join('') + '</div>' : '') +
        (notes.length ? '<h2>ข่าวอัปเดตล่าสุด</h2><div class="notes">' + notes.map(function (n) {
          return '<div class="box note"><h3>' + esc(n.title) + '</h3><div class="d">' + esc(n.date || String(n.at || '').slice(0, 10)) + '</div><ul>' + (n.items || []).slice(0, 3).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
        }).join('') + '</div>' : '');
      $('view').innerHTML = h;
    });
  }
  function qk(ic, t, d, attr) { return '<button type="button" class="box qk" data-' + attr + '><span class="ic">' + ic + '</span><b>' + t + '</b><span>' + d + '</span></button>'; }

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
    return '<article class="box item" data-id="' + esc(it.id) + '">' + art +
      '<div class="body"><h3>' + esc(it.name) + '</h3><div class="desc">' + esc(it.description) + '</div><div class="buy"><span class="price">🪙 <span data-total>' + (it.price * q).toLocaleString('th-TH') + '</span></span>' +
      '<span class="qty"><button type="button" data-act="dec" aria-label="ลด">−</button><span data-q>' + q + '</span><button type="button" data-act="inc" aria-label="เพิ่ม">+</button></span>' +
      '<button type="button" class="btn pri" data-act="buy">ซื้อ</button></div></div></article>';
  }
  function renderShop() {
    return Promise.all([api('GET', '/api/shop'), loadCards()]).then(function (r) {
      var items = r[0].data; S.items = {}; items.forEach(function (i) { S.items[i.id] = i; }); setCoins(r[0].coins);
      var packs = items.filter(function (i) { return i.kind === 'pack'; }), starters = items.filter(function (i) { return i.kind === 'starter'; });
      $('view').innerHTML = '<h2>🛒 ร้านค้า <small>ใช้เหรียญ 🪙 ซื้อซองการ์ดและ Starter Deck · รับเหรียญฟรีทุกวันที่หน้า Home</small></h2>' +
        (packs.length ? '<h2>ซองการ์ด <small>สุ่มได้ใบหายากเพิ่ม</small></h2><div class="shop">' + packs.map(itemHtml).join('') + '</div>' : '') +
        (starters.length ? '<h2>Starter Deck <small>ได้การ์ดครบชุด พร้อมจัดเด็ค</small></h2><div class="shop">' + starters.map(itemHtml).join('') + '</div>' : '') +
        (!items.length ? '<div class="box empty">ยังไม่มีสินค้าวางขาย</div>' : '');
    });
  }
  function buy(id, btn) {
    var it = S.items && S.items[id]; var q = S.qty[id] || 1; if (!it) return;
    btn.disabled = true;
    api('POST', '/api/shop/buy', { itemId: id, qty: q }).then(function (res) { setCoins(res.coins); S.owned = null; reveal(res); })
      .catch(function (e) { toast(e.message, true); }).then(function () { btn.disabled = false; });
  }

  /* ---------- เปิดซอง / รับ Starter ---------- */
  function revClass(c) { var r = String(c.rarity || 'C').toUpperCase(); return r === 'C' ? '' : r === 'R' ? 'rare' : 'srare'; }
  function reveal(res) {
    var packs = res.packs, i = 0, isPack = res.kind === 'pack';
    function draw() {
      var list = packs[i], flipped = 0;
      var dlg = $('ov').querySelector('.dlg') || openDlg('');
      dlg.innerHTML = '<button type="button" class="x" aria-label="ปิด">✕</button><div class="reveal-top"><h2 style="margin:0">' + (isPack ? '🎉 เปิดซอง' + (packs.length > 1 ? ' ' + (i + 1) + '/' + packs.length : '') : '🎁 ได้รับ ' + esc(res.item.name)) + '</h2><span class="grow"></span>' +
        '<button type="button" class="btn sm" data-r="all">พลิกทั้งหมด</button>' + (isPack && i < packs.length - 1 ? '<button type="button" class="btn pri sm" data-r="next">ซองถัดไป ›</button>' : '<button type="button" class="btn pri sm" data-r="done">เสร็จสิ้น</button>') + '</div>' +
        '<div class="reveal">' + list.map(function (c, n) {
          return '<button type="button" class="rc ' + revClass(c) + (isPack ? '' : ' flip') + '" data-n="' + n + '" aria-label="' + (isPack ? 'พลิกการ์ด' : esc(c.name)) + '"><span class="b"><img src="' + BACK + '" alt=""></span><span class="f">' + pic(c) + (c.isNew ? '<span class="new">NEW</span>' : '') + (c.qty > 1 ? '<span class="qq">×' + c.qty + '</span>' : '') + '</span></button>';
        }).join('') + '</div><p class="mut center" id="rvInfo" style="margin:12px 0 0">' + (isPack ? 'แตะการ์ดเพื่อพลิก' : 'ใบที่มี “NEW” คือการ์ดใหม่ของคุณ') + '</p>';
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
      };
    }
    openDlg('', function () { if (S.view === 'home') show('home'); });
    draw();
  }

  /* ---------- คอลเลกชัน ---------- */
  function renderCollection() {
    return Promise.all([loadCards(), api('GET', '/api/me/collection')]).then(function (r) {
      S.owned = r[1].owned; var sets = {}; S.cards.forEach(function (c) { var d = (sets[c.deck] = sets[c.deck] || { id: c.deck, n: 0, own: 0 }); d.n++; if (S.owned[c.id]) d.own++; });
      var all = S.cards.length, have = S.cards.filter(function (c) { return S.owned[c.id]; }).length;
      var tile = function (id, label, own, n) { var p = n ? Math.round(own / n * 100) : 0; return '<button type="button" class="box set' + (S.colSet === id ? ' on' : '') + '" data-set="' + esc(id) + '"><b><span>' + esc(label) + '</span><small>' + own + '/' + n + '</small></b><div class="bar"><i class="' + (p >= 100 ? 'full' : '') + '" style="width:' + p + '%"></i></div></button>'; };
      $('view').innerHTML = '<h2>📚 คอลเลกชันของฉัน <small>สะสมแล้ว ' + have + ' จาก ' + all + ' แบบ · รวม ' + r[1].total + ' ใบ</small></h2>' +
        '<div class="sets">' + tile('', 'ทั้งหมด', have, all) + Object.keys(sets).sort().map(function (k) { return tile(k, k, sets[k].own, sets[k].n); }).join('') + '</div>' +
        '<div class="tools"><input id="colQ" type="search" placeholder="ค้นหาชื่อ / รหัสการ์ด" value="' + esc(S.colQ) + '"><select id="colOwn"><option value="all">ทั้งหมด</option><option value="own">เฉพาะที่มี</option><option value="miss">เฉพาะที่ยังไม่มี</option></select><button type="button" class="btn sm" data-go="cards">เปิด Card List ›</button></div>' +
        '<div class="cgrid" id="colGrid"></div>';
      $('colOwn').value = S.colOwn; drawCol();
    });
  }
  function drawCol() {
    var q = S.colQ.trim().toLowerCase();
    var list = S.cards.filter(function (c) {
      if (S.colSet && c.deck !== S.colSet) return false;
      var o = S.owned[c.id] || 0; if (S.colOwn === 'own' && !o) return false; if (S.colOwn === 'miss' && o) return false;
      return !q || (c.id + ' ' + c.name).toLowerCase().indexOf(q) >= 0;
    });
    $('colGrid').innerHTML = list.length ? list.map(function (c) {
      var o = S.owned[c.id] || 0; return '<button type="button" class="cc' + (o ? '' : ' miss') + '" data-card="' + esc(c.id) + '">' + pic(c) + (o ? '<span class="q">×' + o + '</span>' : '') + '<span class="nm">' + esc(c.name) + '</span></button>';
    }).join('') : '<div class="box empty" style="grid-column:1/-1">ไม่พบการ์ดที่ตรงเงื่อนไข</div>';
  }

  /* ---------- สลับหน้า ---------- */
  var RENDER = { home: renderHome, shop: renderShop, collection: renderCollection };
  var seq = 0;
  function show(v) {
    if (!RENDER[v]) v = 'home'; S.view = v; var my = ++seq;
    Array.prototype.forEach.call($('hubNav').querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.v === v); });
    try { history.replaceState(null, '', '#' + v); } catch (e) { }
    document.title = { home: 'Home', shop: 'ร้านค้า', collection: 'คอลเลกชัน' }[v] + ' · AvastFall TCG';
    if (framed) { try { window.parent.postMessage({ afHubView: v }, location.origin); } catch (e) { } }
    $('view').innerHTML = '<p class="mut center">กำลังโหลด…</p>';
    return RENDER[v]().catch(function (e) { if (my === seq) $('view').innerHTML = '<div class="box empty">โหลดข้อมูลไม่สำเร็จ: ' + esc(e.message) + '<br><br><button type="button" class="btn" data-view="' + v + '">ลองใหม่</button></div>'; });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var vb = t.closest('[data-v],[data-view]'); if (vb) { show(vb.dataset.v || vb.dataset.view); return; }
    var g = t.closest('[data-go]'); if (g) { go(g.dataset.go, g.dataset.deck ? { deckId: g.dataset.deck } : null); return; }
    var set = t.closest('[data-set]'); if (set) { S.colSet = set.dataset.set; Array.prototype.forEach.call(document.querySelectorAll('.set'), function (x) { x.classList.toggle('on', x === set); }); drawCol(); return; }
    var cc = t.closest('[data-card]'); if (cc && S.byId) { cardDetail(S.byId[cc.dataset.card.toLowerCase()]); return; }
    var a = t.closest('[data-act]'); if (!a) return;
    var item = a.closest('.item'), id = item && item.dataset.id;
    if (a.dataset.act === 'inc' || a.dataset.act === 'dec') {
      var it = S.items && S.items[id] || { price: 0, kind: 'pack' }, max = it.kind === 'pack' ? 10 : 3, q = Math.max(1, Math.min(max, (S.qty[id] || 1) + (a.dataset.act === 'inc' ? 1 : -1)));
      S.qty[id] = q; item.querySelector('[data-q]').textContent = q; item.querySelector('[data-total]').textContent = (it.price * q).toLocaleString('th-TH');
    } else if (a.dataset.act === 'buy') buy(id, a);
    else if (a.dataset.act === 'daily') { a.disabled = true; api('POST', '/api/me/daily').then(function (r) { setCoins(r.coins); toast('🎁 ได้รับ ' + r.amount + ' เหรียญ!'); show('home'); }).catch(function (er) { toast(er.message, true); a.disabled = false; }); }
    else if (a.dataset.act === 'logout') { if (window.AF) window.AF.logout(); else api('POST', '/api/auth/logout').then(toLogin); }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'colQ') { S.colQ = e.target.value; drawCol(); } });
  document.addEventListener('change', function (e) { if (e.target.id === 'colOwn') { S.colOwn = e.target.value; drawCol(); } });
  /* เว็บหลักสั่งสลับหน้า (แท็บ Home / Shop บนแถบเมนู) */
  addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.afView && RENDER[e.data.afView]) show(e.data.afView); });

  var h = location.hash.replace('#', '');
  show(RENDER[h] ? h : 'home');
})();
