/* UI · ลากวาง (Drag & Drop) ด้วย Pointer Events — ใช้ได้ทั้งนิ้วบนมือถือและเมาส์
   1) Main/Ultimate Phase: ลากการ์ดบนมือ (ใบที่เรืองแสง = เล่นได้) ไปวางบนสนามของเรา → อัญเชิญ / ร่าย / ติดตั้ง / วาง Domain / ใช้ Ultimate
      (ถ้าการ์ดใบนั้นมีได้หลายคำสั่ง จะเปิดเมนูให้เลือกตรงที่ปล่อย)
   2) Attack Phase: ลาก Unit ที่เรืองแสงไปวางบน Unit ฝ่ายตรงข้าม หรือ Avatar เพื่อโจมตี
   - การแตะ/คลิกแบบเดิมยังใช้ได้ทุกอย่าง: ลากเริ่มเมื่อขยับเกิน SLOP พิกเซล
   - มือถือ: ปัดแนวนอนบนมือ = เลื่อนดูการ์ด · ลากขึ้น/ลง = หยิบการ์ด (CSS touch-action: pan-x ที่ .handrow .card.hl)
   - ระหว่างลากจะไม่ render ใหม่ (ภาพที่ลากคือสำเนา .dnd-ghost) · ตอนปล่อยตรวจซ้ำว่า pending เดิมยังอยู่ */
'use strict';
(function () {
  const SLOP = 8, SNAP = 30;
  let st = null, hintEl = null, blockClickUntil = 0;

  const VERB = { summon: 'อัญเชิญ', spell: 'ร่าย', equip: 'ติดตั้ง', domain: 'วางสนาม', ultimate: 'ใช้' };
  const inRect = (p, r, pad) => p.x >= r.left - pad && p.x <= r.right + pad && p.y >= r.top - pad && p.y <= r.bottom + pad;
  const distRect = (p, r) => Math.hypot(Math.max(r.left - p.x, 0, p.x - r.right), Math.max(r.top - p.y, 0, p.y - r.bottom));

  /* หาสิ่งที่ลากได้จากจุดที่แตะ (ต้องเป็นตาของเราและมีคำสั่งที่เล่นได้จริง) */
  function pickSource(t) {
    const pd = pdOf();
    if (!pd || ui.screen !== 'game' || ui.cover !== null || ui.over || ui.menu || ui.modal || ui.settings || pd.p !== ui.viewer) return null;
    if (pd.kind === 'act') {
      const el = t.closest('.handrow .card[data-uid]'); if (!el) return null;
      const uid = +el.dataset.uid;
      const acts = pd.spec.actions.filter(a => a.uid === uid && a.card && a.card.zone === 'hand');
      return acts.length ? { kind: 'hand', el, uid, acts, pd } : null;
    }
    if (pd.kind === 'attack') {
      const el = t.closest('.side.bot .azone .card[data-uid]'); if (!el) return null;
      const uid = +el.dataset.uid;
      const cur = pd.spec.options.find(x => x.attacker.uid === uid);
      return cur ? { kind: 'attack', el, uid, cur, pd } : null;
    }
    return null;
  }

  root.addEventListener('pointerdown', e => {
    if (st || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const s = pickSource(e.target); if (!s) return;
    st = Object.assign(s, { pid: e.pointerId, type: e.pointerType, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, on: false, ghost: null, raf: 0, hot: { x: e.clientX, y: e.clientY }, target: null });
    addEventListener('pointermove', onMove, { passive: false });
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', cleanup);
    addEventListener('touchmove', onTouchMove, { passive: false });
  });
  /* กันเมนูกดค้าง/เลือกข้อความบนมือถือ ระหว่างยกการ์ด */
  root.addEventListener('contextmenu', e => { if (st && st.on) e.preventDefault(); });
  /* ลากเสร็จแล้วอย่าให้ click ที่ตามมาไปกดการ์ด/โซนข้างใต้ */
  root.addEventListener('click', e => { if (Date.now() < blockClickUntil) { e.stopPropagation(); e.preventDefault(); } }, true);

  function onTouchMove(e) { if (st && st.on && e.cancelable) e.preventDefault(); }

  function onMove(e) {
    if (!st || e.pointerId !== st.pid) return;
    st.x = e.clientX; st.y = e.clientY;
    if (!st.on) {
      const dx = st.x - st.sx, dy = st.y - st.sy;
      if (Math.hypot(dx, dy) < SLOP) return;
      if (st.type === 'touch' && st.kind === 'hand' && Math.abs(dx) > Math.abs(dy) * 1.3) return cleanup();   // ปัดแนวนอน = เลื่อนมือ ไม่ใช่หยิบการ์ด
      begin();
    }
    if (e.cancelable) e.preventDefault();
    update();
  }

  function begin() {
    st.on = true;
    const r = st.el.getBoundingClientRect();
    st.w = r.width; st.h = r.height; st.ox = st.sx - r.left; st.oy = st.sy - r.top;
    const g = st.el.cloneNode(true);
    g.removeAttribute('data-uid'); g.removeAttribute('title');
    g.querySelectorAll('[data-uid]').forEach(n => n.removeAttribute('data-uid'));
    g.classList.remove('hl', 'dim', 'tg', 'sel', 'flash', 'atk');
    g.classList.add('dnd-ghost');
    g.style.setProperty('--cw', r.width + 'px');
    g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    document.body.appendChild(g);
    st.ghost = g;
    st.el.classList.add('dnd-src-on');
    document.body.classList.add('dnd-on');
    hidePop();
    hintEl = document.createElement('div'); hintEl.id = 'dndhint'; document.body.appendChild(hintEl);
    try { navigator.vibrate && navigator.vibrate(8); } catch (_) { }
    st.raf = requestAnimationFrame(loop);
  }

  /* เลื่อนหน้าอัตโนมัติเมื่อลากไปชิดขอบบน (มือถือที่สนามยาวกว่าจอ) · ขอบล่างเฉพาะตอนลาก Unit ไปโจมตี (ที่ล่างเป็นแถบมือ) */
  function loop() {
    if (!st || !st.on) return;
    const y = st.hot.y, H = innerHeight;
    let dy = 0;
    if (y < 90) dy = -Math.ceil((90 - y) / 5);
    else if (st.kind === 'attack' && y > H - 90) dy = Math.ceil((y - (H - 90)) / 5);
    if (dy) { scrollBy(0, dy); update(); }
    st.raf = requestAnimationFrame(loop);
  }

  function place() {
    const touch = st.type === 'touch';
    /* นิ้วบังการ์ด → ยกการ์ดขึ้นเหนือนิ้ว แล้วใช้กลางการ์ดเป็นจุดวาง · เมาส์ใช้ตำแหน่งเคอร์เซอร์ */
    const gx = touch ? st.x - st.w / 2 : st.x - st.ox, gy = touch ? st.y - st.h * 0.85 : st.y - st.oy;
    st.ghost.style.transform = `translate3d(${gx}px,${gy}px,0) scale(1.1) rotate(-3deg)`;
    st.hot = touch ? { x: gx + st.w / 2, y: gy + st.h / 2 } : { x: st.x, y: st.y };
  }

  function clearMarks() {
    document.querySelectorAll('.dnd-zone,.dnd-over,.dnd-ok').forEach(n => n.classList.remove('dnd-zone', 'dnd-over', 'dnd-ok'));
  }
  const nameOf = uid => { const c = cardMap()[uid]; return c ? c.def.name : ''; };

  function update() {
    if (!st || !st.on) return;
    place(); clearMarks();
    const hot = st.hot; let msg = '';
    st.target = null;
    if (st.kind === 'hand') {
      const side = root.querySelector('.side.bot'); if (!side) return;
      const summon = st.acts.some(a => a.t === 'summon');
      const zone = summon ? (side.querySelector('.azone') || side) : side;
      zone.classList.add('dnd-zone');
      const inside = inRect(hot, side.getBoundingClientRect(), 6);
      if (inside) { st.target = 'own'; zone.classList.add('dnd-over'); }
      const a0 = st.acts[0], nm = a0.card.def.name;
      msg = inside ? (st.acts.length > 1 ? `ปล่อยเพื่อเลือกคำสั่ง · ${nm}` : `ปล่อยเพื่อ${VERB[a0.t] || 'ใช้'} ${nm}`) : (summon ? 'ลากไปวางที่ Action Zone ของคุณ' : 'ลากไปวางที่สนามของคุณ');
    } else {
      const list = [];
      for (const u of st.cur.units) { const el = root.querySelector(`.side.top .card[data-uid="${u.uid}"]`); if (el) list.push({ el, id: u.uid }); }
      if (st.cur.avatar) { const el = root.querySelector('.side.top .hexw'); if (el) list.push({ el, id: 'avatar' }); }
      let best = null, bd = 1e9;
      for (const t of list) { t.el.classList.add('dnd-ok'); const d = distRect(hot, t.el.getBoundingClientRect()); if (d < bd) { bd = d; best = t; } }
      if (best && bd <= (st.type === 'touch' ? SNAP + 10 : SNAP)) { best.el.classList.add('dnd-over'); st.target = best; }
      msg = st.target ? `ปล่อยเพื่อโจมตี ${st.target.id === 'avatar' ? 'Avatar' : nameOf(st.target.id)}` : (list.length ? 'ลากไปวางบนเป้าหมายสีแดง' : 'ไม่มีเป้าหมายที่โจมตีได้');
    }
    if (hintEl) { hintEl.textContent = msg; hintEl.classList.toggle('go', !!st.target); }
  }

  function onUp(e) {
    if (!st || e.pointerId !== st.pid) return;
    if (!st.on) return cleanup();                       // แค่แตะ ไม่ได้ลาก → ปล่อยให้ click เดิมทำงาน
    if (e.cancelable) e.preventDefault();
    blockClickUntil = Date.now() + 450;
    st.x = e.clientX; st.y = e.clientY; update();
    const s = st, target = st.target, still = pdOf() === s.pd && ui.screen === 'game' && ui.cover === null;
    const hot = s.hot;
    cleanup();
    if (!still || !target) return;
    if (s.kind === 'hand') {
      if (s.acts.length === 1) return answer(s.acts[0]);
      ui.menu = { actions: s.acts, x: Math.max(8, hot.x - 100), y: hot.y }; return render();
    }
    answer({ attacker: s.uid, target: target.id });
  }

  function cleanup() {
    if (!st) return;
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
    removeEventListener('pointercancel', cleanup); removeEventListener('touchmove', onTouchMove);
    cancelAnimationFrame(st.raf);
    if (st.ghost) st.ghost.remove();
    if (st.el) st.el.classList.remove('dnd-src-on');
    document.querySelectorAll('.dnd-src-on').forEach(n => n.classList.remove('dnd-src-on'));
    clearMarks();
    document.body.classList.remove('dnd-on');
    if (hintEl) { hintEl.remove(); hintEl = null; }
    st = null;
  }
  window.AFDnd = { cancel: cleanup, active: () => !!(st && st.on) };
})();
