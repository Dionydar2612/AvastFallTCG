/* แท็บเลื่อน Playtest ↔ Card List
   - Playtest = เกม (#app)  ·  Card List = /cards/?embed=1 ใน iframe (โหลดตอนกดครั้งแรก)
   - สลับแท็บเกมไม่หายเพราะเกมยังรันอยู่ในหน้าเดิม  ·  #cards ในลิงก์ = เปิดแท็บ Card List
   - องค์ประกอบใดมี data-go="cards|play" กดแล้วสลับแท็บ */
(function () {
  'use strict';
  const view = document.getElementById('siteView'), sw = document.getElementById('siteSw'), bar = document.getElementById('siteBar');
  const frame = document.getElementById('cardsFrame');
  const panes = { play: document.getElementById('panePlay'), cards: document.getElementById('paneCards') };
  const btns = [...sw.querySelectorAll('button[data-tab]')];
  const scrollAt = { play: 0, cards: 0 };
  let cur = 'play', timer = 0;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  const fit = () => document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  fit(); addEventListener('resize', fit);

  function go(tab, opts) {
    if (!panes[tab]) return;
    opts = opts || {};
    if (tab === cur && !opts.force) return;
    if (tab === 'cards' && !frame.src) frame.src = frame.dataset.src;
    scrollAt[cur] = window.scrollY;
    const prev = cur; cur = tab;
    panes[tab].classList.remove('off');                       // แสดงทั้งสองฝั่งระหว่างเลื่อน
    sw.dataset.tab = tab; view.dataset.tab = tab;
    btns.forEach(b => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    clearTimeout(timer);
    const done = () => { panes[prev === tab ? (tab === 'play' ? 'cards' : 'play') : prev].classList.add('off'); window.scrollTo(0, tab === 'play' ? scrollAt.play : 0); };
    if (reduce || opts.instant) done(); else timer = setTimeout(done, 400);
    try { history.replaceState(null, '', tab === 'cards' ? '#cards' : location.pathname + location.search); } catch (e) { }
    document.title = tab === 'cards' ? 'Card List · AvastFall TCG' : 'AvastFall TCG · Open Test ทดลองเล่น';
    if (tab === 'play') window.dispatchEvent(new Event('resize'));
  }

  btns.forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  sw.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const t = e.key === 'ArrowRight' ? 'cards' : 'play'; go(t); btns.find(b => b.dataset.tab === t).focus(); e.preventDefault();
  });
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('[data-go]');
    if (!a) return; e.preventDefault(); go(a.dataset.go);
  }, true);
  addEventListener('hashchange', () => { if (location.hash === '#cards') go('cards'); });

  panes.cards.classList.add('off');
  if (location.hash === '#cards') { cur = 'play'; go('cards', { instant: true, force: true }); }
  window.AFSite = { go, get tab() { return cur; } };
})();
