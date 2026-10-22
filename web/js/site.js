/* แถบเมนูเดียวของทั้งเว็บ: Playtest · Card List · Deckbuilder
   - Playtest = เกม (#app)  ·  Card List / Deckbuilder = /cards/?embed=1 ใน iframe เดียวกัน (โหลดตอนกดครั้งแรก)
   - สลับแท็บแล้วเกมที่ค้างอยู่ไม่หาย เพราะเกมยังรันอยู่ในหน้าเดิม
   - ลิงก์ #cards = เปิด Card List · #deckbuilder หรือ #deck=... (ลิงก์แชร์เด็ค) = เปิด Deckbuilder
   - องค์ประกอบใดมี data-go="play|cards|deck" กดแล้วสลับแท็บ
   - Card List ตัดแถบเมนูของตัวเองทิ้งเมื่อฝังอยู่ (?embed=1) แล้วรับคำสั่งสลับหน้าจากที่นี่ผ่าน postMessage */
(function () {
  'use strict';
  const view = document.getElementById('siteView'), sw = document.getElementById('siteSw'), bar = document.getElementById('siteBar');
  const frame = document.getElementById('cardsFrame');
  const panes = { play: document.getElementById('panePlay'), cards: document.getElementById('paneCards') };
  const btns = [...sw.querySelectorAll('button[data-tab]')];
  const paneOf = t => (t === 'play' ? 'play' : 'cards');   // cards + deck ใช้ iframe เดียวกัน
  const TITLE = { play: 'AvastFall TCG · Open Test ทดลองเล่น', cards: 'Card List · AvastFall TCG', deck: 'Deckbuilder · AvastFall TCG' };
  const scrollAt = { play: 0 };
  let cur = 'play', timer = 0, ready = false;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  const fit = () => document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  fit(); addEventListener('resize', fit);

  const tell = v => { try { frame.contentWindow.postMessage({ afView: v }, location.origin); } catch (e) { } };
  frame.addEventListener('load', () => { ready = true; tell(cur === 'deck' ? 'deck' : 'cards'); });

  function go(tab, opts) {
    if (!TITLE[tab]) return;
    opts = opts || {};
    if (tab === cur && !opts.force) return;
    const prev = cur, from = paneOf(prev), to = paneOf(tab);
    if (to === 'cards') {
      if (!frame.getAttribute('src')) frame.src = frame.dataset.src + (opts.hash || (tab === 'deck' ? '#deckbuilder' : ''));
      else if (ready) tell(tab === 'deck' ? 'deck' : 'cards');
    }
    if (from === 'play') scrollAt.play = window.scrollY;
    cur = tab;
    panes[to].classList.remove('off');                          // แสดงทั้งสองฝั่งระหว่างเลื่อน
    sw.dataset.tab = tab; view.dataset.tab = tab;
    btns.forEach(b => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    clearTimeout(timer);
    const done = () => { if (from !== to) panes[from].classList.add('off'); if (from !== to) window.scrollTo(0, to === 'play' ? scrollAt.play : 0); };
    if (reduce || opts.instant) done(); else timer = setTimeout(done, 400);
    try { history.replaceState(null, '', tab === 'cards' ? '#cards' : tab === 'deck' ? '#deckbuilder' : location.pathname + location.search); } catch (e) { }
    document.title = TITLE[tab];
    if (tab === 'play') window.dispatchEvent(new Event('resize'));
  }

  btns.forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  sw.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const order = btns.map(b => b.dataset.tab), i = order.indexOf(cur);
    const t = order[Math.min(order.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    go(t); btns.find(b => b.dataset.tab === t).focus(); e.preventDefault();
  });
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('[data-go]');
    if (!a) return; e.preventDefault(); go(a.dataset.go);
  }, true);

  const fromHash = (instant) => {
    const h = location.hash;
    if (h === '#cards') go('cards', { instant, force: instant });
    else if (h === '#deckbuilder') go('deck', { instant, force: instant });
    else if (/^#deck=/.test(h)) go('deck', { instant, force: instant, hash: h });
  };
  addEventListener('hashchange', () => fromHash(false));

  panes.cards.classList.add('off');
  if (/^#(cards|deckbuilder|deck=)/.test(location.hash)) { cur = 'play'; fromHash(true); }
  window.AFSite = { go, get tab() { return cur; } };
})();
