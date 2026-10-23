/* AvastFall TCG – สคริปต์เอฟเฟกต์การ์ดชุด BT01
   หนึ่งการ์ด = FX[id] หนึ่งรายการ + NOTES[id] อธิบายการตีความ
   ถ้าแก้ข้อความการ์ดใน card-api ให้แก้สคริปต์ตรงนี้ แล้วอัปเดตข้อความใน js/data/snapshot.js ให้ตรงกัน */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {}, NOTES = AF.notes = AF.notes || {};
const log = AF.log, place = AF.place;
const opp = AF.opp, tribeHas = AF.tribeHas, addMod = AF.addMod;

/* ---- 001 ผู้คุมไฟนรก ซาลอุน (Avatar ไฟ/มืด) */
FX['BT01-001'] = {
  /* AUTO: Unit ฝ่ายเราประกาศโจมตีได้แม้นอน รวมถึง Unit ที่ลงสนามทีหลัง (อ่านโดย AF.legalAttacks ใน engine.js ทุกครั้งที่ตรวจ จึงครอบคลุม Unit ที่เพิ่งลงสนามโดยอัตโนมัติ) */
  restAttack: true,
  abilities: [{
    id: 'hellfire', kw: 'ACTIVATE 1/turn', zone: 'avatar',
    label: 'ส่ง 3 ใบบนสุดของ Main Deck ลงกองทิ้ง ทำลาย Unit ฝ่ายตรงข้ามที่ Cost = จำนวน Unit ที่ส่งลงกองทิ้ง',
    can: ({ G, p }) => G.players[p].deck.length > 0,
    resolve: async ({ G, p, self }) => {
      const P = G.players[p]; let units = 0, n = 0;
      while (n < 3 && P.deck.length) {
        const c = P.deck[0]; place(G, c, 'discard'); n++;
        if (c.def.kind === 'Unit') units++;
      }
      log(G, `${self.def.name}: ส่งการ์ด ${n} ใบบนสุดของ Main Deck ลงกองทิ้ง (เป็น Unit ${units} ใบ)`, p);
      const cands = H.oppUnits(G, p, u => u.def.cost === units, self);
      const u = await H.pickUnit(G, p, cands, `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่ Cost ${units} เพื่อทำลาย`);
      if (!u) { log(G, `ไม่มี Unit ฝ่ายตรงข้ามที่ Cost ${units}`, p); return; }
      if (u.zone === 'field') await H.destroy(G, u, { kind: 'effect', player: p, source: self });
    } }]
};

/* =============================================================== BT01 (ไฟ) ตัวช่วย */
const FIRE = 'ไฟ';
const isGlad = c => tribeHas(c, 'นักสู้กลาดิเอเตอร์');
/* ส่งการ์ดบนสุดของ Main Deck ลงกองทิ้งทีละใบ คืนรายการที่ส่งจริง */
const topToDiscard = (G, p, n) => {
  const P = G.players[p], sent = [];
  for (let i = 0; i < n && P.deck.length; i++) { const c = P.deck[0]; place(G, c, 'discard'); sent.push(c); }
  return sent;
};
const unitsIn = a => a.filter(c => c.def.kind === 'Unit');

/* ---- 005 ทาสแห่งเปลวไฟนรก กิลรันทา */
FX['BT01-005'] = {
  abilities: [{
    id: 'stoke', kw: 'ACTIVATE 1/turn', label: 'เปลี่ยนการ์ดนี้เป็นนอน ส่งการ์ดใบบนสุดของ Main Deck ลงกองทิ้ง',
    can: ({ G, p, self }) => self.state === 'stand' && G.players[p].deck.length > 0,
    pay: ({ self }) => { self.state = 'rest'; },
    resolve: async ({ G, p, self }) => {
      const [c] = topToDiscard(G, p, 1);
      if (c) log(G, `${self.def.name}: ส่ง ${c.def.name} จากบนสุดของ Main Deck ลงกองทิ้ง`, p);
    } }]
};

/* ---- 006 ฮัมบาบา ร่างอสูรเพลิงนรก */
FX['BT01-006'] = {
  anyElementCost: true,                                        // จ่าย Cost ด้วย Element ธาตุใดก็ได้
  deckAllow: av => !!av && (av.name || '').includes('ฮัมบาบา'), // ใส่เด็คได้ถ้า Avatar ชื่อ ฮัมบาบา (ธาตุไฟอยู่แล้วผ่านกฎธาตุปกติ)
  abilities: [{
    id: 'purge', kw: 'ACTIVATE 1/turn', label: 'ส่งการ์ดนี้ลงกองทิ้ง นำ Domain ทุกใบของทั้งสองฝ่ายลงกองทิ้ง',
    can: ({ G }) => G.players.some(P => P.domains.length > 0),
    pay: async ({ G, self }) => { await H.removeUnit(G, self, 'discard'); },
    resolve: async ({ G, p, self }) => {
      let n = 0;
      for (const P of G.players) for (const d of [...P.domains]) { place(G, d, 'discard'); n++; log(G, `${d.def.name} ถูกนำลงกองทิ้ง (ผลของ ${self.def.name})`, p); }
      if (!n) log(G, 'ไม่มี Domain บนสนาม', p);
    } }]
};

/* ---- 007 ลานิสตา ผู้ฝึกกลาดิเอเตอร์ */
FX['BT01-007'] = {
  abilities: [{
    id: 'train', kw: 'ACTIVATE 1/turn', label: '[Spend 1 ไฟ] Unit เผ่า "นักสู้กลาดิเอเตอร์" ของคุณ 1 ใบ ได้รับ ATK +2 จนจบเทิร์น',
    spend: 1, spendEl: FIRE,
    can: ({ G, p }) => H.myUnits(G, p, isGlad).length > 0,
    targets: async ({ G, p }) => (await H.pickUnit(G, p, H.myUnits(G, p, isGlad), 'ลานิสตา: เลือก Unit เผ่า "นักสู้กลาดิเอเตอร์" ให้ ATK +2')) || false,
    resolve: async ({ G, p }, u) => { if (u && u.zone === 'field') { addMod(G, u, { atk: 2, until: 'turnEnd' }); log(G, `${u.def.name} ได้รับ ATK +2 จนจบเทิร์น`, p); } } }]
};

/* ---- 009 หมาป่าเพลิงเฝ้าประตู */
FX['BT01-009'] = { advent: {
  resolve: async ({ G, p, self }) => {
    const n = unitsIn(topToDiscard(G, p, 2)).length;
    if (n && self.zone === 'field') { addMod(G, self, { atk: n, until: 'turnEnd' }); log(G, `${self.def.name} ได้รับ ATK +${n} จนจบเทิร์น (ส่ง Unit ลงกองทิ้ง ${n} ใบ)`, p); }
    else log(G, `${self.def.name}: ไม่มี Unit ถูกส่งลงกองทิ้ง ATK ไม่เปลี่ยน`, p);
  } } };

/* ---- 010 ราชาลาวาผู้เผาผลาญ อิกซาน */
FX['BT01-010'] = { on: { attackSuccess: async ({ G, self, p, attacker, target, destroyed }) => {
  if (attacker !== self || target === 'avatar' || !destroyed) return;
  log(G, `${self.def.name}: ทำลาย Unit ฝ่ายตรงข้ามสำเร็จ สร้างความเสียหายใส่ Avatar ฝ่ายตรงข้าม 1 หน่วย`, p);
  H.damageAvatar(G, opp(p), 1, self);
} } };

/* ---- 011 ถ่านแดงปะทุ */
FX['BT01-011'] = { costEl: FIRE, spell: { resolve: async ({ G, p, self }) => {
  const u = await H.pickUnit(G, p, H.myUnits(G, p), 'ถ่านแดงปะทุ: เลือก Unit ของคุณ 1 ใบ (ATK +2 จนจบเทิร์น แล้วเปลี่ยนเป็นนอน)');
  if (!u) { log(G, 'ไม่มี Unit ของคุณให้เลือก', p); return; }
  addMod(G, u, { atk: 2, until: 'turnEnd' }); u.state = 'rest';
  log(G, `${u.def.name} ได้รับ ATK +2 จนจบเทิร์น และเปลี่ยนเป็นนอน`, p);
} } };

/* ---- 012 คำพิพากษาแห่งเปลวเพลิง */
FX['BT01-012'] = { spell: { resolve: async ({ G, p, self }) => {
  const n = unitsIn(topToDiscard(G, p, 3)).length;
  const lim = n + 2;
  log(G, `${self.def.name}: ส่ง Unit ลงกองทิ้ง ${n} ใบ ทำลายได้ที่ Cost ไม่เกิน ${lim}`, p);
  const u = await H.pickUnit(G, p, H.oppUnits(G, p, x => x.def.cost <= lim, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่ Cost ไม่เกิน ${lim} เพื่อทำลาย`);
  if (u) await H.destroy(G, u, { kind: 'effect', player: p, source: self }); else log(G, 'ไม่มี Unit ฝ่ายตรงข้ามที่เข้าเงื่อนไข', p);
} } };

/* ---- 013 เสียงเชียร์จากอัฒจันทร์ */
FX['BT01-013'] = { costEl: FIRE, spell: { resolve: async ({ G, p, self }) => {
  const bonus = H.myUnits(G, p, isGlad).length >= 2;
  H.draw(G, p, bonus ? 2 : 1);
  if (bonus) log(G, `${self.def.name}: มี Unit เผ่า "นักสู้กลาดิเอเตอร์" ตั้งแต่ 2 ใบ จั่วเพิ่ม 1 ใบ`, p);
} } };

/* ---- 014 ลุกโชนก่อนดับสูญ (Counter) */
FX['BT01-014'] = { counter: {
  when: (G, r, last) => last.kind === 'attack' && last.controller !== r && last.target !== 'avatar' && last.target.owner === r,
  resolve: async ({ G, p, self, target }) => {
    const t = target && target.target, a = target && target.attacker;
    if (!t || t === 'avatar' || !a) return;
    (G.tmpHooks = G.tmpHooks || []).push({ name: 'unitDestroyed', battle: true, fn: async ({ unit, by }) => {
      if (unit !== t || !by || by.kind !== 'battle' || by.attacker !== a || a.zone !== 'field') return;
      log(G, `${self.def.name}: ${t.def.name} ถูกทำลายในการต่อสู้ ทำลาย ${a.def.name} ที่โจมตีด้วย`, p);
      await H.destroy(G, a, { kind: 'effect', player: p, source: self });
    } });
    log(G, `${self.def.name}: ถ้า ${t.def.name} ถูกทำลายในการต่อสู้ครั้งนี้ จะทำลาย ${a.def.name} ด้วย`, p);
  } } };

/* ---- 015 ดาบโซ่เพลิงนรก อิกนิส */
FX['BT01-015'] = { equip: { atk: 2 }, on: { attackDeclared: async ({ G, self, p, attacker, wasRest }) => {
  if (!self.host || attacker !== self.host || !wasRest) return;
  addMod(G, attacker, { cri: 1, until: 'turnEnd' });
  log(G, `${attacker.def.name}: ประกาศโจมตีขณะนอน ได้รับ CRI +1 จนจบเทิร์น (${self.def.name})`, p);
} } };

/* ---- 016 เกราะหนังแห่งสนามประลอง */
FX['BT01-016'] = { equip: { def: 3, onHostDestroyed: ({ G, self, host }) => {
  log(G, `${self.def.name}: ${host.def.name} ถูกทำลาย จั่วการ์ด 1 ใบ`, self.owner);
  H.draw(G, self.owner, 1);
} } };

/* ---- 017 โรงตีดาบ (Domain) */
const swords = (G, p) => G.players[p].discard.filter(c => (c.def.name || '').includes('ดาบ'));
FX['BT01-017'] = {
  abilities: [{
    id: 'reforge', kw: 'ACTIVATE 1/turn', zone: 'domain', label: 'นำการ์ดที่มีคำว่า "ดาบ" ในชื่อสูงสุด 2 ใบจากกองทิ้งกลับเข้า Main Deck แล้วสับ',
    can: ({ G, p }) => swords(G, p).length > 0,
    resolve: async ({ G, p, self }) => {
      const picked = await H.pickCards(G, p, { title: `${self.def.name}: เลือกการ์ดที่มีคำว่า "ดาบ" ในชื่อ สูงสุด 2 ใบ`, cards: swords(G, p), min: 1, max: 2 });
      if (!picked.length) return;
      for (const c of picked) place(G, c, 'deckBottom');
      AF.shuffleDeck(G, p);
      log(G, `${self.def.name}: นำ ${picked.map(c => c.def.name).join(', ')} กลับเข้า Main Deck แล้วสับ`, p);
    } }]
};

/* ---- 018 ประตูนรกเปิดออก (Ultimate) */
FX['BT01-018'] = { ultimate: { resolve: async ({ G, p, self }) => {
  const sentUnits = unitsIn(topToDiscard(G, p, 5));
  const n = sentUnits.length;
  log(G, `${self.def.name}: ส่งการ์ด 5 ใบลงกองทิ้ง (เป็น Unit ${n} ใบ)`, p);
  const max = Math.min(3, n), chosen = [];
  while (chosen.length < max) {
    const c = H.oppUnits(G, p, null, self).filter(u => !chosen.includes(u));
    if (!c.length) break;
    const u = await H.pickUnit(G, p, c, `${self.def.name}: เลือก Unit ฝ่ายตรงข้าม (${chosen.length + 1}/${max}) เพื่อส่งลงกองทิ้ง`, chosen.length > 0);
    if (!u) break; chosen.push(u);
  }
  const sent = [...sentUnits];
  for (const u of chosen) if (u.zone === 'field') { await H.removeUnit(G, u, 'discard'); sent.push(u); log(G, `${u.def.name} ถูกส่งลงกองทิ้ง (ไม่นับว่าถูกทำลาย)`, p); }
  const cand = sent.filter(c => c.zone === 'discard' && c.def.cost <= 3);
  if (!cand.length || !AF.freeSlot(G.players[p])) { log(G, 'ไม่มี Unit Cost 3 หรือต่ำกว่าให้นำเข้าสนาม หรือ Action Zone เต็ม', p); return; }
  const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit Cost 3 หรือต่ำกว่า เพื่อนำเข้า Action Zone ในสภาพนอน`, cards: cand });
  if (!c) return;
  if (c.owner !== p) {   // Unit ของฝ่ายตรงข้าม: ย้ายเจ้าของเป็นผู้ร่าย (เอนจินวางการ์ดตามเจ้าของ)
    const old = G.players[c.owner].discard; old.splice(old.indexOf(c), 1);
    c.owner = p; c.zone = 'limbo'; G.players[p].limbo.push(c);
  }
  await H.enterField(G, p, c, { state: 'rest', byEffect: true, effectOwner: p });   // ไม่ส่ง adv: ADVENT ไม่ทำงาน
} } };


/* =============================================================== BT01 (น้ำ / ดิน / พืช / มืด / ทอง) การ์ดเบอร์ 002, 004, 021–096
   การ์ดที่ไม่มีข้อความเอฟเฟกต์ (058–062, 064–066, 089) ไม่ต้องมีสคริปต์ */
const stat = AF.stat, hasFlag = AF.hasFlag, fxk = AF.fxKit;
const trb = (u, s) => tribeHas(u, s);
const noAbility = u => !u.def.fx.some(f => f[0] !== 'COST' && f[1]);
const myConq = (G, p, f) => H.myUnits(G, p, u => trb(u, 'ผู้พิชิต') && (!f || f(u)));
const E_GROUND = 'ดิน';
/* Unit ที่สวม เกราะศิลาผนึก (BT01-055) ไม่ถูกเปลี่ยนเป็นนอนโดยเอฟเฟกต์ของฝ่ายตรงข้าม — ใช้กับเอฟเฟกต์ BT01 ที่สั่งให้นอน */
const restByEffect = (G, u, byP) => {
  if (!u || u.zone !== 'field') return false;
  if (u.owner !== byP && u.equips.some(e => e.def.id === 'BT01-055')) { log(G, `${u.def.name} สวมใส่ เกราะศิลาผนึก ไม่ถูกเปลี่ยนเป็นนอนโดยเอฟเฟกต์ฝ่ายตรงข้าม`, byP); return false; }
  u.state = 'rest'; return true;
};
/* ห้าม Stand ใน Start Phase: turnsAhead = กี่เทิร์น (นับรวมเทิร์นผู้เล่นสลับกัน) ที่ผลนี้ยังอยู่ */
const lockStand = (G, u, turnsAhead) => { const m = addMod(G, u, { flag: 'noStand', until: 'x' }); m.expireAt = G.turn + turnsAhead; return m; };
const gainEl = (G, p, n) => {
  let got = 0; for (let i = 0; i < n; i++) if (AF.tools.element(G, p)) got++;
  log(G, got ? `${G.players[p].name} รับ Element +${got} ใบจาก Element Deck` : 'Element Deck ไม่มี Element เหลือให้รับ', p); return got;
};
const isKata = c => (c.def.name || '').includes('กระบวนท่า');
const sendHostName = u => u.def.name;
const dmgOpp = (G, p, n, src) => H.damageAvatar(G, opp(p), n, src);
const effDestroy = (G, p, self, u) => H.destroy(G, u, { kind: 'effect', player: p, source: self });
const atkOnMine = (G, r, last, f) => last.kind === 'attack' && last.controller !== r && last.target !== 'avatar' && last.target.owner === r && (!f || f(last.target, last.attacker));
const oppAttack = (G, r, last) => last.kind === 'attack' && last.controller !== r;
const pickMyUnit = (G, p, f, title) => H.pickUnit(G, p, H.myUnits(G, p, f), title);

/* ---- 002 ผู้พิทักษ์แห่งป่าซีดาร์ ฮัมบาบา (Avatar พืช/ทอง) */
FX['BT01-002'] = {
  aura: {   // Unit ฝ่ายเราบน Action Zone ที่ไม่มีความสามารถ ได้รับ ATK +1 DEF +1 CRI +1 (อ่านโดย engine ผ่าน aura ของ Avatar)
    atk: (G, av, u) => u.owner === av.owner && noAbility(u) ? 1 : 0,
    def: (G, av, u) => u.owner === av.owner && noAbility(u) ? 1 : 0,
    cri: (G, av, u) => u.owner === av.owner && noAbility(u) ? 1 : 0 },
  abilities: [{ id: 'cedar', kw: 'ACTIVATE 1/turn', zone: 'avatar', spend: 1, label: '[Spend 1 Element] จั่วการ์ด 1 ใบจาก Main Deck ของคุณ',
    can: ({ G, p }) => G.players[p].deck.length > 0,
    resolve: async ({ G, p }) => { H.draw(G, p, 1); } }]
};

/* ---- 003 เซนโง มุรามาสะ (Avatar น้ำ) */
FX['BT01-003'] = {
  deckAllowCard: c => (c.name || '').includes('ดาบ'),         // ใส่การ์ดที่มีคำว่า "ดาบ" ในชื่อเข้าเด็คได้ทุกธาตุ
  anyElementFor: c => (c.def.name || '').includes('ดาบ'),      // จ่าย Cost การ์ดเหล่านั้นด้วย Element ธาตุใดก็ได้
  abilities: [{ id: 'forge', kw: 'ACTIVATE 1/turn', zone: 'avatar', label: 'เลือก Equipment "ดาบ" จาก Main Deck นำเข้า Action Zone เป็น Unit (Cost 3 ATK 4 DEF 4 CRI 1) แล้วสับ Main Deck',
    can: ({ G, p }) => AF.freeSlot(G.players[p]) && G.players[p].deck.some(c => c.def.kind === 'Equipment' && (c.def.name || '').includes('ดาบ')),
    resolve: async ({ G, p, self }) => {
      const P = G.players[p];
      const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Equipment ที่มีคำว่า "ดาบ" ในชื่อ จาก Main Deck`, cards: P.deck.filter(x => x.def.kind === 'Equipment' && (x.def.name || '').includes('ดาบ')), private: true });
      if (!c) return;
      const orig = c.def;
      c.def = Object.assign({}, orig, { kind: 'Unit', type: 'Unit', sub: null, cost: 3, atk: 4, def: 4, cri: 1, swordUnit: true });
      c.host = c;   // เอฟเฟกต์ "Unit ที่สวมใส่" ส่งผลต่อการ์ดใบนี้เอง
      if (!(await fxk.enterByEffect(G, p, c)) || c.zone !== 'field') { c.def = orig; c.host = null; AF.shuffleDeck(G, p); return; }
      AF.shuffleDeck(G, p);
      log(G, `${self.def.name}: ${orig.name} กลายเป็น Unit (Cost 3 / ATK 4 / DEF 4 / CRI 1) นำเข้า Action Zone แล้วสับ Main Deck`, p);
    } }]
};

/* ---- 004 ราชาผู้พิชิต อิสกันดาร์ (Avatar ดิน) */
FX['BT01-004'] = {
  aura: {
    atk: (G, av, u) => u.owner === av.owner && trb(u, 'ผู้พิชิต') ? 1 : 0,
    cri: (G, av, u) => u.owner === av.owner && trb(u, 'ผู้พิชิต') ? 1 : 0 },
  on: { attackSuccess: async ({ G, self, p, attacker, target, destroyed }) => {
    if (!attacker || attacker.owner !== p || target === 'avatar' || !destroyed) return;
    const e = G.players[p].elems.find(x => x.state === 'rest');
    if (!e) { log(G, `${self.def.name}: ไม่มี Element ที่นอนอยู่ให้เปลี่ยนเป็น Stand`, p); return; }
    e.state = 'stand'; G.version++; log(G, `${self.def.name}: ${attacker.def.name} ทำลาย Unit ฝ่ายตรงข้ามสำเร็จ เปลี่ยน Element 1 ใบ (${e.el}) เป็น Stand`, p);
  } }
};

/* ---- 008 นักรบเกราะลาวา กุนธี */
FX['BT01-008'] = { aura: { atk: (G, self, u) => u === self && self.state === 'rest' ? 2 : 0 } };

/* ---- 019 นักดาบพเนจร ชาบูโร่ */
FX['BT01-019'] = { advent: { resolve: async ({ G, p, self }) => {
  const got = await H.search(G, p, { from: ['deck'], filter: c => (c.def.name || '').includes('กระบวนท่า'), title: `${self.def.name}: เลือกการ์ดที่มีคำว่า "กระบวนท่า" ในชื่อ จาก Main Deck` });
  if (!got) log(G, 'ไม่พบการ์ดที่มีคำว่า "กระบวนท่า" ใน Main Deck (สับ Main Deck)', p);
} } };

/* ---- 020 ศิษย์ฝึกหัดแห่งสำนักมุรามาสะ */
FX['BT01-020'] = { advent: { resolve: async ({ G, p, self }) => {
  const P = G.players[p];
  const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือกการ์ดที่มีคำว่า "ดาบ" จากมือ เพื่อนำไปไว้ใต้ Main Deck`, cards: P.hand.filter(x => (x.def.name || '').includes('ดาบ')), optional: true });
  if (!c) { log(G, 'ไม่ได้ส่งการ์ด "ดาบ" ลงใต้ Main Deck จึงไม่จั่ว', p); return; }
  place(G, c, 'deckBottom'); log(G, `${self.def.name}: นำ ${c.def.name} ไปไว้ใต้ Main Deck`, p);
  H.draw(G, p, 1);
} } };

/* ---- 021 เกนจิ */
FX['BT01-021'] = { advent: { resolve: async ({ G, p, self }) => {
  if (self.zone === 'field') { addMod(G, self, { flag: 'haste', until: 'turnEnd' }); log(G, `${self.def.name} โจมตีได้ทันทีในเทิร์นนี้`, p); } } } };

/* ---- 022 โรนินดาบคู่ */
FX['BT01-022'] = { aura: { cri: (G, self, u) => u === self && self.equips.length > 0 ? 1 : 0 } };

/* ---- 023 สวี่โหยว ผู้ชี้ทางลับ */
FX['BT01-023'] = { advent: {
  targets: async ({ G, p, self }) => {
    const c = H.oppUnits(G, p, u => u.state === 'rest', self);
    if (!c.length) return false;
    return (await H.pickUnit(G, p, c, `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่นอนอยู่ เพื่อนำไปไว้ใต้ Main Deck`)) || false;
  },
  resolve: async ({ G, p, self }, u) => { if (u && u.zone === 'field') { await H.removeUnit(G, u, 'deckBottom'); log(G, `${u.def.name} ถูกนำไปไว้ใต้ Main Deck ของ ${G.players[u.owner].name}`, p); } } } };

/* ---- 024 ช่างตีดาบผู้สืบทอด */
FX['BT01-024'] = { advent: { resolve: async ({ G, p, self }) => {
  const c = G.players[p].discard.filter(x => x.def.kind === 'Equipment' && (x.def.name || '').includes('ดาบ'));
  const [e] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Equipment ที่มีคำว่า "ดาบ" ในชื่อ จากกองทิ้ง`, cards: c });
  if (!e) { log(G, 'ไม่มี Equipment ที่มีคำว่า "ดาบ" ในกองทิ้ง', p); return; }
  place(G, e, 'deckBottom'); AF.shuffleDeck(G, p); log(G, `${self.def.name}: นำ ${e.def.name} กลับเข้า Main Deck แล้วสับ`, p);
} } };

/* ---- 025 ซามูไรเงา อินาวิ */
const kataFx = c => FX[c.def.id] && FX[c.def.id].spell;
FX['BT01-025'] = { abilities: [{ id: 'echo', kw: 'ACTIVATE 1/turn', spend: 1,
  label: '[Spend 1 Element] ทิ้ง "กระบวนท่า" จากมือ แล้วใช้เอฟเฟกต์ "กระบวนท่า" ใบอื่นจากกองทิ้งโดยไม่จ่าย Cost',
  can: ({ G, p }) => { const P = G.players[p]; return P.hand.some(h => isKata(h) && P.discard.some(c => isKata(c) && kataFx(c) && c.def.name !== h.def.name)); },
  pay: async ({ G, p }) => {
    const P = G.players[p];
    const hs = P.hand.filter(h => isKata(h) && P.discard.some(c => isKata(c) && kataFx(c) && c.def.name !== h.def.name));
    const [h] = await H.pickCards(G, p, { title: 'อินาวิ: เลือกการ์ด "กระบวนท่า" บนมือที่จะทิ้ง', cards: hs });
    if (!h) return; G._echo = h.def.name; place(G, h, 'discard'); log(G, `${P.name} ทิ้ง ${h.def.name}`, p);
  },
  resolve: async ({ G, p, self, item }) => {
    const P = G.players[p];
    const cands = P.discard.filter(c => isKata(c) && kataFx(c) && c.def.name !== G._echo);
    const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือกการ์ด "กระบวนท่า" ใบอื่นจากกองทิ้งเพื่อใช้เอฟเฟกต์`, cards: cands });
    if (!c) return;
    log(G, `${self.def.name}: ใช้เอฟเฟกต์ของ ${c.def.name} โดยไม่ต้องจ่าย Cost`, p);
    await kataFx(c).resolve({ G, p, self: c, item });
  } }] };

/* ---- 026 ผู้สืบทอดสำนักดาบ */
FX['BT01-026'] = { on: { attackSuccess: async ({ G, self, p, attacker, target, destroyed }) => {
  if (attacker !== self || target === 'avatar' || !destroyed || !self.equips.length || self.flags.n26 === G.turn) return;
  self.flags.n26 = G.turn;
  if (AF.setStand(G, self)) log(G, `${self.def.name}: สวมใส่ Equipment และทำลาย Unit สำเร็จ กลับเป็น Stand โจมตีได้อีกครั้ง`, p);
} } };

/* ---- 027 ซุนปิน ผู้ลวงทัพ */
FX['BT01-027'] = { abilities: [{ id: 'feint', kw: 'ACTIVATE 1/turn', spend: 1,
  label: '[Spend 1 Element] ทิ้ง "ตำราพิชัยสงคราม" จากมือ เลือก Unit ฝ่ายตรงข้ามที่ Cost ต่ำกว่า นำไปไว้ใต้ Main Deck',
  can: ({ G, p, self }) => G.players[p].hand.some(c => (c.def.name || '').includes('ตำราพิชัยสงคราม')) && H.oppUnits(G, p, u => u.def.cost < self.def.cost, self).length > 0,
  pay: async ({ G, p }) => {
    const P = G.players[p];
    const [c] = await H.pickCards(G, p, { title: 'ซุนปิน: เลือก "ตำราพิชัยสงคราม" บนมือที่จะทิ้ง', cards: P.hand.filter(x => (x.def.name || '').includes('ตำราพิชัยสงคราม')) });
    if (c) { place(G, c, 'discard'); log(G, `${P.name} ทิ้ง ${c.def.name}`, p); }
  },
  targets: async ({ G, p, self }) => (await H.pickUnit(G, p, H.oppUnits(G, p, u => u.def.cost < self.def.cost, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่ Cost ต่ำกว่า ${self.def.cost}`)) || false,
  resolve: async ({ G, p }, u) => { if (u && u.zone === 'field') { await H.removeUnit(G, u, 'deckBottom'); log(G, `${u.def.name} ถูกนำไปไว้ใต้ Main Deck ของ ${G.players[u.owner].name}`, p); } } }] };

/* ---- 028 อสุรดาบ อิโซ */
FX['BT01-028'] = {
  advent: {
    targets: async ({ G, p, self }) => {
      const c = H.oppUnits(G, p, u => stat(G, u, 'atk') < stat(G, self, 'atk'), self);
      if (!c.length) return false;
      return (await H.pickUnit(G, p, c, `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่ ATK ต่ำกว่า ${stat(G, self, 'atk')} เพื่อทำลาย`)) || false;
    },
    resolve: async ({ G, p, self }, u) => {
      if (!u || u.zone !== 'field') return;
      const dmg = stat(G, u, 'cri') + stat(G, self, 'cri');
      if (await effDestroy(G, p, self, u)) { log(G, `${self.def.name}: ทำลาย ${u.def.name} สำเร็จ สร้างความเสียหาย ${dmg} หน่วยใส่ Avatar ฝ่ายตรงข้าม`, p); if (dmg > 0) dmgOpp(G, p, dmg, self); }
    } },
  on: { unitEntered: async ({ G, self, p, unit }) => { if (unit === self) { addMod(G, self, { flag: 'haste', until: 'turnEnd' }); log(G, `${self.def.name} โจมตีได้ทันทีแม้เพิ่งลงสนาม`, p); } } }
};

/* ---- 029 กระบวนท่า นางแอ่นหวนกลับ */
FX['BT01-029'] = {
  spell: { resolve: async ({ G, p, self }) => {
    const u = await H.pickUnit(G, p, H.oppUnits(G, p, x => x.def.cost < 2, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่ Cost ต่ำกว่า 2 เพื่อทำลาย`);
    if (u) await effDestroy(G, p, self, u); else log(G, 'ไม่มี Unit ฝ่ายตรงข้ามที่ Cost ต่ำกว่า 2', p);
  } },
  abilities: [{ id: 'swallow', kw: 'ANNOUNCE', zone: 'discard', label: '[กองทิ้ง] ส่งการ์ดใบบนสุดของ Main Deck ลงกองทิ้ง แล้วนำการ์ดใบนี้ขึ้นมือ',
    can: ({ G, p }) => G.players[p].deck.length > 0,
    resolve: async ({ G, p, self }) => {
      const [c] = topToDiscard(G, p, 1); if (c) log(G, `${self.def.name}: ส่ง ${c.def.name} จากบนสุดของ Main Deck ลงกองทิ้ง`, p);
      if (self.zone === 'discard') { place(G, self, 'hand'); log(G, `${self.def.name} กลับขึ้นมือ`, p); }
    } }]
};

/* ---- 030 กระบวนท่า แรงขับสามขั้นตอน */
FX['BT01-030'] = { spell: { resolve: async ({ G, p, self }) => {
  const u = await pickMyUnit(G, p, null, `${self.def.name}: เลือก Unit ของคุณ 1 ใบ`);
  if (!u) { log(G, 'ไม่มี Unit ของคุณให้เลือก', p); return; }
  addMod(G, u, { flag: 'haste', until: 'turnEnd' }); addMod(G, u, { flag: 'multiStand', until: 'turnEnd' });
  log(G, `${u.def.name} โจมตีได้ทันที และกลับเป็น Stand ได้อีก 2 ครั้งหลังโจมตี จนจบเทิร์น`, p);
} } };

/* ---- 031 กระบวนท่า หนึ่งจิต ไร้ดาบ */
FX['BT01-031'] = { spell: { resolve: async ({ G, p, self }) => {
  const u = await pickMyUnit(G, p, null, `${self.def.name}: เลือก Unit ของคุณ 1 ใบ`);
  if (!u) { log(G, 'ไม่มี Unit ของคุณให้เลือก', p); return; }
  addMod(G, u, { atk: 3, until: 'turnEnd' }); addMod(G, u, { flag: 'noCounter', until: 'turnEnd' });
  log(G, `${u.def.name} ได้รับ ATK +3 และการโจมตีถูกตอบโต้ด้วย Counter ไม่ได้ จนจบเทิร์น`, p);
} } };

/* ---- 032 ตำราพิชัยสงคราม ชิงลมชิงจังหวะ */
FX['BT01-032'] = { spell: { resolve: async ({ G, p, self }) => {
  const u = await H.pickUnit(G, p, H.oppUnits(G, p, null, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้าม 1 ใบ เพื่อเปลี่ยนเป็นนอน`);
  if (u && restByEffect(G, u, p)) log(G, `${u.def.name} ถูกเปลี่ยนเป็นนอน`, p); else if (!u) log(G, 'ไม่มี Unit ฝ่ายตรงข้ามให้เลือก', p);
  H.draw(G, p, 1);
} } };

/* ---- 033 ไต้ฝุ่นทิป */
FX['BT01-033'] = { spell: { resolve: async ({ G, p, self }) => {
  const c = [];
  for (const P of G.players) { c.push(...P.domains); for (const m of P.magic) if (m && m !== self && m.def.type === 'Spell') c.push(m); }
  const [t] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Spell ใน Domain Zone หรือ Magic Area เพื่อส่งลงกองทิ้ง`, cards: c });
  if (!t) { log(G, 'ไม่มี Spell ใน Domain Zone หรือ Magic Area ให้เลือก', p); return; }
  place(G, t, 'discard'); log(G, `${t.def.name} ถูกส่งลงกองทิ้ง`, p);
} } };

/* ---- 034 กระบวนท่า ตอบโต้ในพริบตา */
FX['BT01-034'] = { counter: {
  when: (G, r, last) => atkOnMine(G, r, last),
  resolve: async ({ G, p, self, target }) => {
    const t = target && target.target, a = target && target.attacker;
    if (!t || t === 'avatar' || !a || a.zone !== 'field' || t.zone !== 'field') return;
    if (stat(G, a, 'atk') <= stat(G, t, 'atk')) { log(G, `${self.def.name}: ATK ของ ${a.def.name} ไม่เกิน ${t.def.name} ทำลายผู้โจมตี`, p); await effDestroy(G, p, self, a); }
    else log(G, `${self.def.name}: ATK ของ ${a.def.name} สูงกว่า ไม่เกิดผล`, p);
  } } };

/* ---- 035 / 036 ดาบน้ำ */
FX['BT01-035'] = { equip: { atk: 1 } };
FX['BT01-036'] = { equip: { atk: 1 }, on: { attackDeclared: async ({ G, self, p, attacker, target }) => {
  if (!self.host || attacker !== self.host || target === 'avatar' || target.zone !== 'field') return;
  addMod(G, target, { def: -1, until: 'battle' }); log(G, `${target.def.name} ได้รับ DEF -1 จนจบการต่อสู้ (${self.def.name})`, p);
} } };

/* ---- 037 ปรกหมื่นกระบี่ (Ultimate วางใน Domain Zone) */
const finish37 = ({ G, p, self }) => { log(G, `${self.def.name}: ไม่มีการ์ดอยู่ใต้ใบนี้แล้ว ส่งลงกองทิ้ง`, p); place(G, self, 'discard'); };
FX['BT01-037'] = {
  ultimate: {
    can: ({ G, p }) => G.players[p].domains.length < AF.DOMAIN_LIMIT,
    resolve: async ({ G, p, self }) => {
      const P = G.players[p];
      place(G, self, 'domain'); self.under = [];
      for (const b of P.discard.filter(c => (c.def.name || '').includes('ดาบ'))) { place(G, b, 'limbo'); P.limbo.splice(P.limbo.indexOf(b), 1); b.zone = 'under'; self.under.push(b); }
      log(G, `${self.def.name} ถูกวางใน Domain Zone พร้อมการ์ด "ดาบ" ${self.under.length} ใบใต้การ์ด`, p);
      if (!self.under.length) finish37({ G, p, self });
    } },
  abilities: [{ id: 'rain', kw: 'ACTIVATE 1/turn', zone: 'domain', label: 'นำการ์ด 1 ใบใต้การ์ดนี้กลับ Main Deck แล้วสับ สร้างความเสียหาย 1 หน่วย และรับ Element 1 ใบ',
    can: ({ self }) => !!(self.under && self.under.length),
    resolve: async ({ G, p, self }) => {
      const P = G.players[p];
      const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือกการ์ดใต้ใบนี้ที่จะกลับเข้า Main Deck`, cards: self.under });
      if (!c) return;
      self.under.splice(self.under.indexOf(c), 1); c.zone = 'limbo'; P.limbo.push(c); place(G, c, 'deckBottom'); AF.shuffleDeck(G, p);
      log(G, `${self.def.name}: นำ ${c.def.name} กลับเข้า Main Deck แล้วสับ`, p);
      dmgOpp(G, p, 1, self); gainEl(G, p, 1);
      if (!self.under.length && self.zone === 'domain') finish37({ G, p, self });
    } }]
};

/* ---- 038 / 039 เคอนอส / เคราเทรัส (ADVENT + End Phase เหมือนกันทุกตัวอักษร) 042 ใช้ AUTO เดียวกัน */
const conscript = { targets: async ({ G, p, self }) => (await pickMyUnit(G, p, u => trb(u, 'ทหาร'), `${self.def.name}: เลือก Unit เผ่า "ทหาร" ของคุณ 1 ใบ`)) || false,
  resolve: async ({ G, p }, u) => { if (u && u.zone === 'field') { addMod(G, u, { def: 1, until: 'oppTurnEnd' }); log(G, `${u.def.name} ได้รับ DEF +1 จนจบเทิร์นถัดไปของฝ่ายตรงข้าม`, p); } } };
const holdLine = { turnEnd: async ({ G, self, player }) => {
  if (player !== self.owner || self.zone !== 'field') return;
  AF.setStand(G, self); addMod(G, self, { flag: 'taunt', until: 'oppTurnEnd' });
  log(G, `${self.def.name}: เข้าสู่ End Phase เปลี่ยนเป็น Stand ฝ่ายตรงข้ามต้องทำลายก่อนเสมอ จนกว่าจะเริ่มเทิร์นของคุณ`, self.owner);
} };
FX['BT01-038'] = { advent: conscript, on: holdLine };
FX['BT01-039'] = { advent: conscript, on: holdLine };

/* ---- 040 ยักษ์หินผู้เฝ้าขุนเขา */
FX['BT01-040'] = { advent: { resolve: async ({ G, p }) => { gainEl(G, p, 1); } } };

/* ---- 041 เซอร์ กาลาฮัด */
FX['BT01-041'] = {
  advent: { resolve: async ({ G, p, self }) => {
    if (self.zone !== 'field' || self.equips.length) { log(G, `${self.def.name}: สวมใส่ Equipment เพิ่มไม่ได้`, p); return; }
    const c = G.players[p].hand.filter(x => x.def.kind === 'Equipment' && (x.def.name || '').includes('โต๊ะกลม'));
    const [e] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Equipment ที่มีคำว่า "โต๊ะกลม" จากมือ เพื่อสวมใส่โดยไม่จ่าย EquipCost`, cards: c });
    if (!e) { log(G, 'ไม่มี Equipment ที่มีคำว่า "โต๊ะกลม" บนมือ', p); return; }
    AF.attach(G, e, self); log(G, `${self.def.name} สวมใส่ ${e.def.name} (ไม่จ่าย EquipCost)`, p, { equip: e.uid });
  } },
  aura: { def: (G, self, u) => u !== self && u.owner === self.owner ? (trb(u, 'อัศวินโต๊ะกลม') ? 2 : 1) : 0 }
};

/* ---- 042 เฮเฟสเทียน */
FX['BT01-042'] = {
  advent: { targets: async ({ G, p, self }) => (await pickMyUnit(G, p, u => u !== self && trb(u, 'ผู้พิชิต'), `${self.def.name}: เลือก Unit เผ่า "ผู้พิชิต" ใบอื่นของคุณ`)) || false,
    resolve: async ({ G, p }, u) => { if (u && u.zone === 'field') { addMod(G, u, { flag: 'haste', until: 'turnEnd' }); log(G, `${u.def.name} โจมตีได้ทันทีในเทิร์นนี้`, p); } } },
  on: holdLine
};

/* ---- 043 ปโตเลมีที่ 1 โซเตอร์ */
FX['BT01-043'] = {
  aura: { def: (G, self, u) => u.owner === self.owner && trb(u, 'ผู้พิชิต') ? 1 : 0 },
  on: { attackResolved: async ({ G, self, p, target }) => {
    if (target === 'avatar' || target.owner !== p || target.zone !== 'field' || !hasFlag(target, 'taunt')) return;
    if (G.players[p].hand.length < 2) return;
    if (!(await H.yesNo(G, p, `${self.def.name}: ${target.def.name} รอดการโจมตี ทิ้งการ์ดบนมือ 2 ใบเพื่อเปลี่ยนเป็น Stand?`, 'ทิ้ง 2 ใบ', 'ไม่'))) return;
    const d = await H.discardFromHand(G, p, 2, `${self.def.name}: เลือกการ์ดบนมือที่จะทิ้ง`);
    if (d.length === 2 && AF.setStand(G, target)) log(G, `${target.def.name} เปลี่ยนเป็น Stand`, p);
  } }
};

/* ---- 044 เซลิวคัสที่ 1 นิเคเตอร์ */
FX['BT01-044'] = { advent: { resolve: async ({ G, p, self }) => {
  const P = G.players[p]; const got = [];
  for (let i = 0; i < 2; i++) {
    const c = P.deck.filter(x => x.def.kind === 'Unit' && trb(x, 'ทหาร') && x.def.cost <= 2 && !got.includes(x));
    if (!c.length || !AF.freeSlot(P)) break;
    const [u] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit เผ่า "ทหาร" Cost 2 หรือต่ำกว่า (${i + 1}/2)`, cards: c, optional: true, private: true });
    if (!u) break; got.push(u);
    await fxk.enterByEffect(G, p, u);   // ไม่ส่ง adv: ADVENT ไม่ทำงาน
  }
  AF.shuffleDeck(G, p); log(G, `${self.def.name}: นำ Unit ลงสนาม ${got.length} ใบ แล้วสับ Main Deck`, p);
} } };

/* ---- 045 ขบวนทัพค้อนและทั่ง */
FX['BT01-045'] = { spell: {
  cantReason: 'ต้องมี Unit เผ่า "ผู้พิชิต" 4 ใบบน Action Zone',
  can: ({ G, p }) => myConq(G, p).length >= 4,
  resolve: async ({ G, p, self }) => {
    const pool = H.myUnits(G, p, u => trb(u, 'ทหาร') || trb(u, 'ผู้พิชิต'));
    const a = await H.pickUnit(G, p, pool, `${self.def.name}: เลือก Unit ใบแรก (ATK +1 และ CRI +1)`);
    if (!a) return;
    addMod(G, a, { atk: 1, until: 'turnEnd' }); addMod(G, a, { cri: 1, until: 'turnEnd' });
    log(G, `${a.def.name} ได้รับ ATK +1 และ CRI +1 จนจบเทิร์น`, p);
    const b = await H.pickUnit(G, p, pool.filter(u => u !== a && u.zone === 'field'), `${self.def.name}: เลือก Unit ใบที่สอง (ต้องถูกทำลายก่อนเสมอ)`);
    if (!b) return;
    if (hasFlag(b, 'taunt')) { addMod(G, b, { def: 2, until: 'turnEnd' }); log(G, `${b.def.name} มีผลอยู่แล้ว ได้รับ DEF +2 จนจบเทิร์นแทน`, p); }
    else { addMod(G, b, { flag: 'taunt', until: 'turnEnd' }); log(G, `${b.def.name}: ฝ่ายตรงข้ามต้องทำลาย Unit นี้ก่อนเสมอ จนจบเทิร์น`, p); }
  } } };

/* ---- 046 ผืนดินอุดมสมบูรณ์ */
FX['BT01-046'] = { spell: {
  cantReason: 'มีการ์ดชื่อเดียวกันอยู่ในกองทิ้งของคุณ',
  can: ({ G, p, self }) => !G.players[p].discard.some(c => c.def.name === self.def.name),
  resolve: async ({ G, p }) => { gainEl(G, p, 2); } } };

/* ---- 047 เส้นทางเสบียงมาซิโดเนีย */
FX['BT01-047'] = { spell: { resolve: async ({ G, p, self }) => {
  H.draw(G, p, 1);
  if (!trb(G.players[p].avatar.card, 'ราชา')) return;
  const [e] = await H.pickCards(G, p, { title: `${self.def.name}: Avatar เป็นเผ่า "ราชา" เลือก Equipment จากกองทิ้งนำขึ้นมือ`, cards: G.players[p].discard.filter(c => c.def.kind === 'Equipment') });
  if (e) { place(G, e, 'hand'); log(G, `${self.def.name}: นำ ${e.def.name} จากกองทิ้งขึ้นมือ`, p); }
} } };

/* ---- 048 ยุทธวิธีฟาแลงซ์ */
FX['BT01-048'] = { counter: {
  when: (G, r, last) => oppAttack(G, r, last),
  resolve: async ({ G, p, self }) => {
    const us = H.myUnits(G, p, u => trb(u, 'ทหาร'));
    for (const u of us) addMod(G, u, { def: 1, until: 'battle' });
    log(G, `${self.def.name}: Unit เผ่า "ทหาร" ${us.length} ใบได้รับ DEF +1 จนจบการต่อสู้`, p);
  } } };

/* ---- 049 บัญชาการสายฟ้าแลบ */
FX['BT01-049'] = { counter: {
  when: (G, r, last) => oppAttack(G, r, last) && G.players[r].field.some(u => u && u.state === 'rest' && trb(u, 'ผู้พิชิต')),
  resolve: async ({ G, p, self }) => {
    const u = await pickMyUnit(G, p, x => x.state === 'rest' && trb(x, 'ผู้พิชิต'), `${self.def.name}: เลือก Unit เผ่า "ผู้พิชิต" ที่นอนอยู่`);
    if (u && AF.setStand(G, u)) { u.attackedTurn = -1; log(G, `${u.def.name} เปลี่ยนเป็น Stand`, p); }
  } } };

/* ---- 050 โล่แห่งการปกปักษ์ */
FX['BT01-050'] = { counter: {
  when: (G, r, last) => oppAttack(G, r, last),
  resolve: async ({ G, p, self, target }) => { H.cancel(G, target); H.healAvatar(G, p, 1); log(G, `${self.def.name}: ยกเลิกการโจมตี และได้รับพลังชีวิต +1`, p); } } };

/* ---- 051 สภาโต๊ะกลม */
FX['BT01-051'] = { counter: {
  when: (G, r, last) => atkOnMine(G, r, last, t => trb(t, 'อัศวินโต๊ะกลม')),
  resolve: async ({ G, p, self, target }) => {
    const t = target && target.target; if (!t || t === 'avatar' || t.zone !== 'field') return;
    addMod(G, t, { atk: 2, until: 'battle' }); addMod(G, t, { def: 2, until: 'battle' });
    log(G, `${t.def.name} ได้รับ ATK +2 และ DEF +2 จนจบการต่อสู้`, p);
    if (t.equips.length) H.draw(G, p, 1);
  } } };

/* ---- 052 หลุมพรางใต้พื้นดิน */
FX['BT01-052'] = { counter: {
  when: (G, r, last) => oppAttack(G, r, last) && stat(G, last.attacker, 'atk') <= 3,
  resolve: async ({ G, p, self, target }) => {
    const a = target && target.attacker; if (!a || a.zone !== 'field') return;
    log(G, `${self.def.name}: ทำลาย ${a.def.name} (ATK ${stat(G, a, 'atk')})`, p); await effDestroy(G, p, self, a);
  } } };

/* ---- 053 รถม้าศึกแห่งกอร์เดียน */
FX['BT01-053'] = { costEl: E_GROUND, on: { attackSuccess: async ({ G, self, p, attacker, target, destroyed }) => {
  if (!self.host || attacker !== self.host || target === 'avatar' || !destroyed || self.n53 === G.turn) return;
  self.n53 = G.turn;
  if (AF.setStand(G, attacker)) log(G, `${attacker.def.name}: ทำลาย Unit สำเร็จ เปลี่ยนเป็น Stand (${self.def.name})`, p);
} } };

/* ---- 054 โต๊ะกลม แห่งคณะอัศวิน */
FX['BT01-054'] = {
  costEl: E_GROUND,
  abilities: [{ id: 'sit', kw: 'ANNOUNCE', zone: 'hand', label: '[บนมือ] ทิ้งการ์ดใบนี้ ได้รับ Element 1 ใบ',
    can: ({ G, p }) => G.players[p].edeck.length > 0,
    pay: async ({ G, p, self }) => { place(G, self, 'discard'); log(G, `${G.players[p].name} ทิ้ง ${self.def.name}`, p); },
    resolve: async ({ G, p }) => { gainEl(G, p, 1); } }],
  equip: { flagIf: (h, f) => f === 'taunt' && (h.def.name || '').includes('กาลาฮัด') },
  aura: { def: (G, e, u, host) => host && u === host && (host.def.name || '').includes('กาลาฮัด') ? 3 : 0 }
};

/* ---- 055 เกราะศิลาผนึก */
FX['BT01-055'] = { costEl: E_GROUND, equip: { def: 2 } };

/* ---- 056 มหานครอเล็กซานเดรีย (Domain) */
FX['BT01-056'] = {
  aura: { def: (G, d, u) => u.owner === d.owner && (trb(u, 'ผู้พิชิต') || trb(u, 'ทหาร')) ? 1 : 0 },
  abilities: [{ id: 'ds', kw: 'ACTIVATE 1/turn', zone: 'domain', label: 'เลือก Unit เผ่า "ผู้พิชิต" ได้รับ DoubleStrike จนจบเทิร์น',
    can: ({ G, p }) => myConq(G, p).length > 0,
    targets: async ({ G, p, self }) => (await H.pickUnit(G, p, myConq(G, p), `${self.def.name}: เลือก Unit เผ่า "ผู้พิชิต"`)) || false,
    resolve: async ({ G, p }, u) => { if (u && u.zone === 'field') { addMod(G, u, { flag: 'doubleStrike', until: 'turnEnd' }); log(G, `${u.def.name} ได้รับ DoubleStrike จนจบเทิร์น`, p); } } }]
};

/* ---- 057 ยาตราทัพสู่ปลายขอบโลก (Ultimate) */
FX['BT01-057'] = { ultimate: {
  can: ({ G, p }) => myConq(G, p).length >= 2,
  resolve: async ({ G, p, self }) => {
    const chosen = [];
    for (let i = 0; i < 2; i++) {
      const u = await H.pickUnit(G, p, myConq(G, p, x => !chosen.includes(x)), `${self.def.name}: เลือก Unit เผ่า "ผู้พิชิต" (${i + 1}/2)`, i > 0);
      if (!u) break; chosen.push(u);
    }
    for (const u of chosen) {
      if (u.zone !== 'field') continue;
      AF.setStand(G, u);
      const dmg = stat(G, u, 'cri');
      log(G, `${u.def.name} โจมตี Avatar ของ ${G.players[opp(p)].name} โดยตรง (CRI ${dmg}) ด้วย ${self.def.name}`, p, { atkAvatar: u.uid });
      u.state = 'rest'; u.attackedTurn = G.turn;
      if (dmg > 0) dmgOpp(G, p, dmg, u);
      await AF.emit(G, 'attackSuccess', { attacker: u, target: 'avatar', destroyed: false });
      if (u.zone === 'field') lockStand(G, u, 2);
    }
  } } };

/* ---- 063 ผู้พิพากษาแห่งสองสัจจะ (PROPHECY) */
FX['BT01-063'] = { abilities: [fxk.prophecyAb('ประกาศชื่อการ์ด สำเร็จ: เลือก Unit ฝ่ายตรงข้าม เปลี่ยนเป็นนอน และไม่ Stand ใน Start Phase ถัดไป', async ({ G, p, self }) => {
  const u = await H.pickUnit(G, p, H.oppUnits(G, p, null, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้าม 1 ใบ`);
  if (!u) { log(G, 'ไม่มี Unit ฝ่ายตรงข้ามให้เลือก', p); return; }
  if (restByEffect(G, u, p)) { lockStand(G, u, 1); log(G, `${u.def.name} ถูกเปลี่ยนเป็นนอน และไม่ Stand ใน Start Phase ถัดไปของฝ่ายตรงข้าม`, p); }
})] };

/* ---- 067 ทลายร่าง */
FX['BT01-067'] = { spell: { resolve: async ({ G, p, self }) => {
  const P = G.players[p];
  const hb = c => c.def.kind === 'Unit' && (c.def.name || '').includes('ฮัมบาบา');
  const modes = [];
  if (P.discard.some(hb) && H.myUnits(G, p, hb).length) modes.push(0);
  if (H.myUnits(G, p, u => u.def.cost >= 3).length) modes.push(1);
  if (!modes.length) { log(G, `${self.def.name}: ไม่มีความสามารถที่เลือกได้`, p); return; }
  const m = modes.length === 1 ? modes[0] : modes[await H.choose(G, p, `${self.def.name}: เลือกความสามารถ 1 อย่าง`, ['สลับ Unit "ฮัมบาบา" ในกองทิ้งกับบน Action Zone', 'ทำลาย Unit Cost 3 ขึ้นไปของคุณ แล้วจั่ว 4 ใบ'])];
  if (m === 0) {
    const old = await pickMyUnit(G, p, hb, `${self.def.name}: เลือก Unit "ฮัมบาบา" บน Action Zone ที่จะส่งลงกองทิ้ง`);
    const [nw] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit "ฮัมบาบา" จากกองทิ้งที่จะนำเข้าสนาม`, cards: P.discard.filter(hb) });
    if (!old || !nw) return;
    const st = old.state, eqs = [...old.equips], mods = old.mods, flags = old.flags, et = old.enteredTurn, at = old.attackedTurn;
    place(G, old, 'discard');
    place(G, nw, 'field', { state: st }); nw.mods = mods; nw.flags = flags; nw.enteredTurn = et; nw.attackedTurn = at;
    for (const e of eqs) AF.attach(G, e, nw);
    log(G, `${self.def.name}: สลับ ${old.def.name} กับ ${nw.def.name} (สภาพ ${st === 'rest' ? 'นอน' : 'Stand'}, Equipment และผลที่ติดอยู่ยังคงอยู่)`, p);
  } else {
    const u = await pickMyUnit(G, p, x => x.def.cost >= 3, `${self.def.name}: เลือก Unit ของคุณที่ Cost 3 ขึ้นไป เพื่อทำลาย`);
    if (u && await effDestroy(G, p, self, u)) H.draw(G, p, 4);
  }
} } };

/* ---- 068 สัญญาณรุกราน */
FX['BT01-068'] = { spell: {
  cantReason: 'ต้องมีการ์ดบนมืออีก 1 ใบให้ทิ้ง',
  can: ({ G, p }) => G.players[p].hand.length >= 2,
  resolve: async ({ G, p, self }) => {
    const d = await H.discardFromHand(G, p, 1, `${self.def.name}: เลือกการ์ดบนมือที่จะทิ้งเป็นค่าร่าย`);
    if (!d.length) return;
    await H.search(G, p, { from: ['deck'], filter: c => c.def.kind === 'Unit' && trb(c, 'เทพเจ้า'), title: `${self.def.name}: เลือก Unit เผ่า "เทพเจ้า" จาก Main Deck` });
  } } };

/* ---- 069 ผู้พิทักษ์ตื่นกลางเปลวเพลิง */
const godsIn = (G, p) => [...G.players[p].hand, ...G.players[p].discard].filter(c => c.def.kind === 'Unit' && trb(c, 'เทพเจ้า'));
FX['BT01-069'] = { spell: {
  cantReason: 'ใช้ได้เมื่อ HP ของ Avatar เหลือ 5 หรือต่ำกว่า และมี Unit เผ่า "เทพเจ้า" ในมือหรือกองทิ้ง',
  can: ({ G, p }) => G.players[p].avatar.hp <= 5 && AF.freeSlot(G.players[p]) && godsIn(G, p).length > 0,
  resolve: async ({ G, p, self }) => {
    const [u] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit เผ่า "เทพเจ้า" จากมือหรือกองทิ้ง`, cards: godsIn(G, p) });
    if (!u) return;
    if (await fxk.enterByEffect(G, p, u) && u.zone === 'field') { addMod(G, u, { flag: 'haste', until: 'turnEnd' }); log(G, `${u.def.name} นำเข้าสนามโดยไม่จ่าย Cost (ADVENT ไม่ทำงาน) และโจมตีได้ในเทิร์นนี้`, p); }
  } } };

/* ---- 070 ม้วนคัมภีร์แห่งการเลือกเฟ้น */
FX['BT01-070'] = { spell: { resolve: async ({ G, p, self }) => {
  const c = await H.digTop(G, p, { n: 4, title: `${self.def.name}: เลือก 1 ใบจาก 4 ใบบนสุดนำขึ้นมือ`, count: 1 });
  if (!c.length) log(G, 'ไม่ได้เลือกการ์ดใด', p);
} } };

/* ---- 071 การปกปักษ์จากผู้พิทักษ์ */
FX['BT01-071'] = { counter: {
  when: (G, r, last) => last.kind === 'attack' && last.controller !== r && last.target === 'avatar' && last.attacker && AF.freeSlot(G.players[r]) && G.players[r].discard.some(c => c.def.kind === 'Unit'),
  resolve: async ({ G, p, self, target }) => {
    const [u] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit จากกองทิ้งเพื่อนำเข้าสนามและรับการโจมตีแทน`, cards: G.players[p].discard.filter(c => c.def.kind === 'Unit') });
    if (!u) return;
    if (await fxk.enterByEffect(G, p, u) && u.zone === 'field') { target.target = u; log(G, `${self.def.name}: เปลี่ยนเป้าหมายการโจมตีเป็น ${u.def.name}`, p); }
  } } };

/* ---- 072 การเผชิญหน้ากับเทพ */
FX['BT01-072'] = { counter: {
  when: (G, r, last) => atkOnMine(G, r, last, t => trb(t, 'เทพเจ้า')),
  resolve: async ({ G, p, self, target }) => {
    const t = target && target.target; if (!t || t === 'avatar' || t.zone !== 'field') return;
    const d = stat(G, t, 'def'); addMod(G, t, { def: d, until: 'battle' });
    log(G, `${t.def.name}: DEF เพิ่มเป็น 2 เท่า (${d} → ${d * 2}) จนจบการต่อสู้`, p);
  } } };

/* ---- 073 เสียงสะท้อนแห่งการลบล้าง */
FX['BT01-073'] = { counter: {
  when: (G, r, last) => !!last.isCounter && last.controller !== r,
  resolve: async ({ G, p, self, target }) => { H.cancel(G, target); log(G, `${self.def.name}: ยกเลิกผลของ ${target.label || 'Counter'}`, p); } } };

/* ---- 074 มงกุฎดอกไม้ */
FX['BT01-074'] = {
  equip: { def: 1, canEquip: (G, u) => (u.def.els || []).includes('พืช') },
  shield: (G, e, u, src, byP) => !(e.host === u && src && src.def && src.def.kind === 'Enchant' && byP !== e.owner)
};

/* ---- 075 ป่าซีดาร์ (Domain) */
FX['BT01-075'] = { abilities: [{ id: 'grove', kw: 'ACTIVATE 1/turn', zone: 'domain', label: 'เลือก Unit 2 ใบจาก Main Deck นำเข้า Action Zone ฟรี สับ ทิ้งใบนี้ และจบเทิร์นทันที',
  can: ({ G, p }) => AF.freeSlot(G.players[p]) && G.players[p].deck.some(c => c.def.kind === 'Unit'),
  resolve: async ({ G, p, self }) => {
    const P = G.players[p]; const got = [];
    const c = P.deck.filter(x => x.def.kind === 'Unit');
    const picked = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit สูงสุด 2 ใบจาก Main Deck`, cards: c, min: 0, max: 2, optional: true, private: true });
    for (const u of picked) { if (await fxk.enterByEffect(G, p, u, { adv: true })) got.push(u); }
    AF.shuffleDeck(G, p);
    log(G, `${self.def.name}: นำ ${got.map(u => u.def.name).join(', ') || 'ไม่มี Unit'} เข้าสนามโดยไม่จ่าย Cost แล้วสับ Main Deck`, p);
    if (self.zone === 'domain') place(G, self, 'discard');
    G.endNow = true; log(G, 'ต้องจบเทิร์นทันที (ข้าม Main/Attack/Ultimate Phase ที่เหลือ)', p);
  } }] };

/* ---- 076 ความพิโรธแห่งผืนป่า (Ultimate) */
FX['BT01-076'] = { ultimate: {
  can: ({ G, p }) => H.myUnits(G, p, u => trb(u, 'เทพเจ้า')).length > 0,
  resolve: async ({ G, p, self }) => {
    const g = await pickMyUnit(G, p, u => trb(u, 'เทพเจ้า'), `${self.def.name}: เลือก Unit เผ่า "เทพเจ้า" ของคุณ`);
    if (!g) return;
    const d = stat(G, g, 'def'); let n = 0;
    for (const u of H.oppUnits(G, p, x => stat(G, x, 'atk') <= d, self)) if (u.zone === 'field' && await effDestroy(G, p, self, u)) n++;
    log(G, `${self.def.name}: DEF ของ ${g.def.name} = ${d} ทำลาย Unit ฝ่ายตรงข้าม ${n} ใบ`, p);
    if (n > 0) dmgOpp(G, p, n, self);
  } } };

/* ---- 077 วิญญาณที่ถูกพันธนาการ อิลซาร์ */
FX['BT01-077'] = { abilities: [{ id: 'bound', kw: 'ANNOUNCE', zone: 'discard', spend: 1, label: '[กองทิ้ง] Spend 1 Element นำการ์ดนี้เข้า Action Zone ในสภาพนอน',
  can: ({ G, p }) => AF.freeSlot(G.players[p]),
  resolve: async ({ G, p, self }) => { if (self.zone === 'discard') await fxk.enterByEffect(G, p, self, { state: 'rest' }); } }] };

/* ---- 078 ผู้นำทางสู่นรก แครอน */
FX['BT01-078'] = { advent: { resolve: async ({ G, p, self }) => {
  const P = G.players[p];
  if (!P.deck.length) { log(G, 'Main Deck ว่าง', p); return; }
  const picked = await H.pickCards(G, p, { title: `${self.def.name}: เลือกการ์ดที่ชอบ 2 ใบจาก Main Deck`, cards: P.deck.slice(), min: Math.min(2, P.deck.length), max: 2, private: true });
  for (const c of picked) P.deck.splice(P.deck.indexOf(c), 1);
  AF.shuffleDeck(G, p);
  const ord = await H.order(G, p, `${self.def.name}: เรียงการ์ดที่เลือก (ใบแรก = บนสุดของ Main Deck)`, picked);
  P.deck.unshift(...ord); G.version++;
  log(G, `${self.def.name}: ค้นการ์ด ${ord.length} ใบ สับ Main Deck แล้ววางไว้บนสุด`, p);
} } };

/* ---- 079 ฮัสซัน พรานราตรี */
FX['BT01-079'] = { on: { unitDestroyed: async ({ G, self, p, unit, owner }) => {
  if (owner === p || unit.state !== 'rest' || self.flags.n79 === G.turn) return;
  self.flags.n79 = G.turn; log(G, `${self.def.name}: Unit ฝ่ายตรงข้ามที่นอนอยู่ถูกทำลาย จั่วการ์ด 1 ใบ`, p); H.draw(G, p, 1);
} } };

/* ---- 080 ผู้พิพากษาแห่งขุมนรก คาธัส */
FX['BT01-080'] = { advent: { resolve: async ({ G, p, self }) => {
  const chosen = [];
  for (let i = 0; i < 2; i++) {
    const u = await H.pickUnit(G, p, H.oppUnits(G, p, x => !chosen.includes(x), self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้าม (${i + 1}/2)`);
    if (!u) break; chosen.push(u);
  }
  for (const u of chosen) if (restByEffect(G, u, p)) { lockStand(G, u, 1); log(G, `${u.def.name} ถูกเปลี่ยนเป็นนอน และ Stand ไม่ได้ในเทิร์นถัดไปของฝ่ายตรงข้าม`, p); }
} } };

/* ---- 081 อัศวินทมิฬผู้ตกนรก ฮาดัมลุน */
FX['BT01-081'] = { advent: { resolve: async ({ G, p, self }) => {
  const [u] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit จากกองทิ้งเพื่อนำเข้าสนามในสภาพนอน`, cards: G.players[p].discard.filter(c => c.def.kind === 'Unit') });
  if (!u) { log(G, 'ไม่มี Unit ในกองทิ้ง', p); return; }
  await fxk.enterByEffect(G, p, u, { state: 'rest' });   // ADVENT ไม่ทำงาน
} } };

/* ---- 082 ขุดวิญญาณจากเถ้าถ่าน */
FX['BT01-082'] = { spell: { resolve: async ({ G, p, self }) => {
  const [c] = topToDiscard(G, p, 1); if (c) log(G, `${self.def.name}: ส่ง ${c.def.name} จากบนสุดของ Main Deck ลงกองทิ้ง`, p);
  const [u] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit จากกองทิ้งแสดงให้ฝ่ายตรงข้ามดู แล้วนำขึ้นมือ`, cards: G.players[p].discard.filter(x => x.def.kind === 'Unit') });
  if (u) { place(G, u, 'hand'); log(G, `${self.def.name}: แสดง ${u.def.name} แล้วนำขึ้นมือ`, p, { show: [u.uid] }); }
} } };

/* ---- 083 พิธีแลกวิญญาณ (ค่าร่ายเป็นพลังชีวิต 2 หน่วย) */
FX['BT01-083'] = { castLife: 2, spell: { resolve: async ({ G, p }) => { H.draw(G, p, 3); } } };

/* ---- 084 โซ่ตรวนนรก */
FX['BT01-084'] = { counter: {
  when: (G, r, last) => oppAttack(G, r, last),
  resolve: async ({ G, p, self, target }) => {
    const a = target && target.attacker; if (!a || a.zone !== 'field') return;
    addMod(G, a, { atk: -2, until: 'battle' }); lockStand(G, a, 2);
    log(G, `${a.def.name} ได้รับ ATK -2 จนจบการต่อสู้ และไม่ Stand ใน Start Phase ถัดไปของฝ่ายตรงข้าม`, p);
  } } };

/* ---- 085 พิษไร้รส */
FX['BT01-085'] = { counter: {
  when: (G, r, last) => oppAttack(G, r, last),
  resolve: async ({ G, p, self, target }) => {
    H.cancel(G, target);
    const a = target && target.attacker;
    log(G, `${self.def.name}: ยกเลิกการโจมตี`, p);
    if (a && a.zone === 'field') { a.state = 'rest'; lockStand(G, a, 2); log(G, `${a.def.name} นอน และไม่ Stand ใน Start Phase ถัดไปของฝ่ายตรงข้าม`, p); }
  } } };

/* ---- 086 ดาบมารสุริยัน แกรม */
FX['BT01-086'] = { equip: {}, on: { attackDeclared: async ({ G, self, p, attacker, target }) => {
  if (!self.host || attacker !== self.host || target === 'avatar' || target.zone !== 'field' || !(target.def.els || []).includes('มืด')) return;
  log(G, `${self.def.name}: ${target.def.name} เป็นธาตุมืด ทำลายทันที`, p); await effDestroy(G, p, self, target);
} } };

/* ---- 087 ทัณฑสถานแห่งขุมนรก (Domain) */
FX['BT01-087'] = { abilities: [{ id: 'prison', kw: 'ACTIVATE 1/turn', zone: 'domain', label: 'ส่งการ์ดใบบนสุดของ Main Deck ลงกองทิ้ง หากเป็น Unit เลือก Unit ฝ่ายใดก็ได้ 1 ใบเปลี่ยนเป็นนอน',
  can: ({ G, p }) => G.players[p].deck.length > 0,
  resolve: async ({ G, p, self }) => {
    const [c] = topToDiscard(G, p, 1); if (!c) return;
    log(G, `${self.def.name}: ส่ง ${c.def.name} ลงกองทิ้ง`, p);
    if (c.def.kind !== 'Unit') return;
    const cands = [...H.myUnits(G, p), ...H.oppUnits(G, p, null, self)];
    const u = await H.pickUnit(G, p, cands, `${self.def.name}: เลือก Unit ฝ่ายใดก็ได้ 1 ใบ เพื่อเปลี่ยนเป็นนอน`);
    if (u && restByEffect(G, u, p)) log(G, `${u.def.name} ถูกเปลี่ยนเป็นนอน`, p);
  } }] };

/* ---- 088 เฮมดัลล์ ผู้เฝ้าสะพานรุ้ง */
FX['BT01-088'] = { advent: { resolve: async ({ G, p, self }) => {
  await H.digTop(G, p, { n: 4, filter: c => c.def.kind === 'Equipment', title: `${self.def.name}: เลือก Equipment 1 ใบจาก 4 ใบบนสุดนำขึ้นมือ`, count: 1 });
} } };

/* ---- 090 ทำลายล้างทุกสรรพสิ่ง */
FX['BT01-090'] = { spell: { resolve: async ({ G, p, self }) => {
  const all = [...G.players[p].field, ...G.players[opp(p)].field].filter(Boolean);
  let n = 0; for (const u of all) if (u.zone === 'field' && await effDestroy(G, p, self, u)) n++;
  log(G, `${self.def.name}: ทำลายการ์ดใน Action Zone ของทั้งสองฝ่าย ${n} ใบ`, p);
} } };

/* ---- 091 งานเลี้ยงแห่งวัลฮัลลา */
FX['BT01-091'] = { spell: { resolve: async ({ G, p, self }) => {
  const [u] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit เผ่า "เทพเจ้า" หรือ "วิญญาณ" จากกองทิ้ง`, cards: G.players[p].discard.filter(c => c.def.kind === 'Unit' && (trb(c, 'เทพเจ้า') || trb(c, 'วิญญาณ'))) });
  if (!u) { log(G, 'ไม่มี Unit เผ่า "เทพเจ้า" หรือ "วิญญาณ" ในกองทิ้ง', p); return; }
  place(G, u, 'hand'); log(G, `${self.def.name}: นำ ${u.def.name} ขึ้นมือ`, p);
  await H.discardFromHand(G, p, 1, `${self.def.name}: เลือกการ์ดบนมือที่จะทิ้ง`);
} } };

/* ---- 092 สายฟ้าสกัดทัพ */
FX['BT01-092'] = { counter: {
  when: (G, r, last) => oppAttack(G, r, last) && stat(G, last.attacker, 'def') <= 3,
  resolve: async ({ G, p, self, target }) => {
    const a = target && target.attacker; if (!a || a.zone !== 'field') return;
    log(G, `${self.def.name}: ทำลาย ${a.def.name} (DEF ${stat(G, a, 'def')})`, p); await effDestroy(G, p, self, a);
  } } };

/* ---- 093 ออบซิเดียน ดาบสังหารเทพ */
FX['BT01-093'] = {
  on: { attackDeclared: async ({ G, self, p, attacker, target }) => {
    if (!self.host || attacker !== self.host || target === 'avatar' || target.zone !== 'field' || !trb(target, 'เทพเจ้า')) return;
    log(G, `${self.def.name}: ${target.def.name} เป็นเผ่า "เทพเจ้า" ทำลายทันที`, p); await effDestroy(G, p, self, target);
  } },
  abilities: [{ id: 'obs', kw: 'ACTIVATE 1/turn', zone: 'equip', label: 'จั่วการ์ด 1 ใบจาก Main Deck ของคุณ',
    can: ({ G, p }) => G.players[p].deck.length > 0,
    resolve: async ({ G, p }) => { H.draw(G, p, 1); } }]
};

/* ---- 094 ดาบอมตะ ดูแรนดัล */
FX['BT01-094'] = { equip: { atk: 1, flags: ['direct'] } };

/* ---- 095 ดาบศักดิ์สิทธิ์ เอกซ์แคลิเบอร์ */
FX['BT01-095'] = {
  equip: { atk: 2, def: 2, canEquip: (G, u) => trb(u, 'อัศวินโต๊ะกลม') },
  on: { attackSuccess: async ({ G, self, p, attacker, target, destroyed }) => {
    if (!self.host || attacker !== self.host || target === 'avatar' || !destroyed) return;
    log(G, `${self.def.name}: ${attacker.def.name} ทำลาย Unit สำเร็จ สร้างความเสียหาย 1 หน่วยใส่ Avatar ฝ่ายตรงข้าม`, p); dmgOpp(G, p, 1, self);
  } }
};

/* ---- 096 สวนเอเดน (Domain) */
FX['BT01-096'] = { unitCostMod: (G, p, card) => card.def.kind === 'Unit' && trb(card, 'เทพเจ้า') ? 1 : 0 };


NOTES['BT01-001'] = 'AUTO: Unit ฝ่ายเราที่นอนอยู่ประกาศโจมตีได้ ข้อความการ์ดระบุว่า Unit ที่เพิ่งลงสนามได้รับผลนี้เช่นกัน (ผลนี้ตามไปทุกใบที่ลงสนามหลังจากมี Avatar ใบนี้ ไม่ได้จำกัดเฉพาะใบที่อยู่ในสนามตอนแรก) การทำงานเหมือนเดิม ข้อความเพิ่มมาเพื่อให้ชัดเจนเท่านั้น (ยังต้องไม่ใช่ Unit ที่เพิ่งลงสนามในเทิร์นนี้ ยกเว้นมีความสามารถโจมตีได้ทันที) ตีความให้ Unit แต่ละใบประกาศโจมตีด้วยวิธีนี้ได้ครั้งเดียวต่อเทิร์น ไม่งั้นจะโจมตีวนซ้ำไม่จำกัด ACTIVATE: ส่ง 3 ใบบนสุดลงกองทิ้ง (ถ้าเหลือน้อยกว่า 3 ส่งเท่าที่มี) นับเฉพาะการ์ดประเภท Unit แล้วทำลาย Unit ฝ่ายตรงข้าม 1 ใบที่ Cost เท่ากับจำนวนนั้น (Cost ตามที่พิมพ์บนการ์ด) ถ้าไม่มี Unit ที่ตรงเงื่อนไข การ์ดที่ส่งลงกองทิ้งแล้วไม่คืน เลือกใช้ได้เมื่อ Main Deck มีการ์ดอย่างน้อย 1 ใบ';
NOTES['BT01-005'] = 'ACTIVATE: ใช้ได้เมื่อการ์ดนี้ตั้งอยู่ (ต้องเปลี่ยนเป็นนอนเป็นค่าใช้จ่าย) และ Main Deck ยังมีการ์ด ส่งการ์ดใบบนสุดลงกองทิ้ง';
NOTES['BT01-006'] = 'ข้อความ "สามารถสวมใส่" ตีความเป็นกฎใส่ลงเด็ค: ปกติ Avatar ธาตุไฟใส่ได้อยู่แล้ว และเพิ่มข้อยกเว้นให้ Avatar ที่ชื่อมีคำว่า "ฮัมบาบา" ใส่ได้ด้วย (กฎของ Deckbuilder บนหน้า Card List ยังไม่รู้ข้อยกเว้นนี้) จ่าย Cost ของใบนี้ด้วย Element ธาตุใดก็ได้ ACTIVATE: ส่งการ์ดนี้ลงกองทิ้งเป็นค่าใช้จ่าย แล้วนำ Domain ทุกใบของทั้งสองฝ่ายลงกองทิ้งของเจ้าของ ใช้ได้เมื่อมี Domain บนสนามอย่างน้อย 1 ใบ';
NOTES['BT01-007'] = 'ACTIVATE: จ่าย Element ธาตุไฟ 1 ใบ เลือก Unit เผ่า "นักสู้กลาดิเอเตอร์" ของคุณ 1 ใบ (รวมตัวลานิสตาเองเพราะมีเผ่านี้) ได้รับ ATK +2 จนจบเทิร์น ใช้ซ้ำได้เทิร์นละครั้ง';
NOTES['BT01-009'] = 'ADVENT: ส่งการ์ด 2 ใบบนสุดของ Main Deck ลงกองทิ้ง นับเฉพาะการ์ดประเภท Unit ที่ถูกส่ง ATK +1 ต่อ Unit 1 ใบ จนจบเทิร์น';
NOTES['BT01-010'] = 'AUTO: ทำงานเมื่อการ์ดนี้ทำลาย Unit ฝ่ายตรงข้ามได้จากการต่อสู้ ไม่ทำงานถ้าโจมตี Avatar หรือโจมตีไม่สำเร็จ สร้างความเสียหาย 1 หน่วยใส่ Avatar ฝ่ายตรงข้าม';
NOTES['BT01-011'] = 'ค่าร่ายต้องเป็น Element ธาตุไฟ 1 ใบ เลือก Unit ของคุณ ATK +2 จนจบเทิร์น แล้วเปลี่ยน Unit นั้นเป็นนอน (ผลจบทันที การ์ดลงกองทิ้ง) ถ้าไม่มี Unit ของคุณ ร่ายได้แต่ไม่เกิดผล';
NOTES['BT01-012'] = 'ส่ง 3 ใบบนสุดของ Main Deck ลงกองทิ้ง นับเฉพาะ Unit ที่ถูกส่ง แล้วทำลาย Unit ฝ่ายตรงข้าม 1 ใบที่ Cost (ที่พิมพ์บนการ์ด) ไม่เกินจำนวนนั้น + 2 ต่อให้ไม่มี Unit ถูกส่งเลย ก็ยังทำลาย Unit Cost 2 หรือต่ำกว่าได้';
NOTES['BT01-013'] = 'ค่าร่ายต้องเป็น Element ธาตุไฟ 1 ใบ จั่ว 1 ใบ ถ้ามี Unit เผ่า "นักสู้กลาดิเอเตอร์" บนสนามอย่างน้อย 2 ใบ (นับตอนผลทำงาน) จั่วเพิ่มอีก 1 ใบ';
NOTES['BT01-014'] = 'ใช้ตอบโต้ได้ตอนฝ่ายตรงข้ามประกาศโจมตี Unit ของคุณ (ไม่ใช่โจมตี Avatar) ผลคือถ้า Unit ที่ถูกโจมตีถูกทำลายในการต่อสู้ครั้งนี้ จะทำลาย Unit ที่โจมตีด้วย (นับเป็นการทำลายด้วยเอฟเฟกต์) ถ้า Unit รอดการต่อสู้ ผลไม่ทำงานและหมดอายุเมื่อจบการต่อสู้';
NOTES['BT01-015'] = 'AUTO: ถ้า Unit ที่สวมใส่ประกาศโจมตีทั้งที่อยู่ในสภาพนอนก่อนประกาศ (ทำได้เมื่อ Avatar ซาลอุน BT01-001 ให้โจมตีขณะนอนได้) ได้รับ CRI +1 จนจบเทิร์น ถ้าตั้งอยู่ตามปกติจะไม่ได้โบนัส';
NOTES['BT01-016'] = 'AUTO: เมื่อ Unit ที่สวมใส่ถูกทำลาย (ไม่ว่าด้วยการต่อสู้หรือเอฟเฟกต์) เกราะลงกองทิ้งแล้วจั่ว 1 ใบ ถ้า Unit ถูกส่งลงกองทิ้งโดยไม่ได้ถูกทำลาย (เช่น BT01-018) ไม่จั่ว';
NOTES['BT01-017'] = 'ACTIVATE: เลือกการ์ดที่มีคำว่า "ดาบ" ในชื่อ 1-2 ใบจากกองทิ้งของคุณ (ต้องเลือกอย่างน้อย 1 ใบ) นำกลับเข้า Main Deck แล้วสับทั้งกอง ใช้ได้เทิร์นละครั้ง';
NOTES['BT01-018'] = 'ส่ง 5 ใบบนสุดลงกองทิ้ง นับเฉพาะ Unit ที่ถูกส่ง เลือก Unit ฝ่ายตรงข้ามได้สูงสุด 3 ใบ แต่ไม่เกินจำนวนนั้น ส่งลงกองทิ้ง (ไม่นับว่าถูกทำลาย ADMONISH ไม่ทำงาน Equipment ของ Unit นั้นลงกองทิ้ง) จากนั้นเลือก Unit Cost 3 หรือต่ำกว่า 1 ใบจาก Unit ทั้งหมดที่ถูกส่งลงกองทิ้งด้วยเอฟเฟกต์นี้ (ทั้งของคุณและของฝ่ายตรงข้าม) นำเข้า Action Zone ของคุณในสภาพนอน ADVENT ไม่ทำงาน ถ้าเป็น Unit ของฝ่ายตรงข้าม จะเปลี่ยนเจ้าของเป็นคุณ (ถ้าถูกทำลายภายหลังจะลงกองทิ้งของคุณ) ถ้า Action Zone เต็มจะไม่นำเข้า';


/* ---- หมายเหตุสำหรับหน้า Update Note: การ์ดชุดเพิ่ม (002, 004, 021–096) */
NOTES['BT01-008'] = 'AUTO: ขณะอยู่ในสภาพนอน ได้รับ ATK +2 (คำนวณสดตามสถานะ)';
NOTES['BT01-019'] = 'ADVENT: ค้นการ์ดชื่อมีคำว่า "กระบวนท่า" 1 ใบจาก Main Deck แสดงให้ฝ่ายตรงข้ามดู นำขึ้นมือ แล้วสับ (ถ้าไม่มีก็สับอย่างเดียว)';
NOTES['BT01-020'] = 'ADVENT: ส่งการ์ดมือที่ชื่อมีคำว่า "ดาบ" 1 ใบไปไว้ใต้ Main Deck เมื่อทำสำเร็จจั่ว 1 ใบ (ถ้าไม่มีหรือไม่เลือก ไม่จั่ว)';
NOTES['BT01-003'] = 'ใส่ในเด็คได้เฉพาะการ์ดที่มีคำว่า "ดาบ" ในชื่อโดยไม่จำกัดธาตุ และจ่าย Cost ของการ์ดเหล่านั้นด้วย Element ธาตุใดก็ได้ (ใช้กับ Unit/Equipment ที่ชื่อมีคำว่า ดาบ) · ACTIVATE 1/turn: การ์ดที่ถูกเลือกกลายเป็น Unit Cost 3 ATK 4 DEF 4 CRI 1 ยังคงความสามารถทั้งหมด เอฟเฟกต์ของ Equipment ที่ระบุ "Unit ที่สวมใส่" ส่งผลต่อการ์ดใบนี้เอง (เช่น ATK/DEF โบนัส, ความสามารถตอนโจมตี) เมื่อออกจากสนามกลับเป็น Equipment ตามเดิม (ADVENT ไม่ทำงาน) ข้อจำกัด: ความสามารถ Equipment ที่ต้องมี Unit ผู้สวมเป็นตัวอื่นอาจไม่ครบทุกใบ'; 
NOTES['BT01-002'] = 'AUTO: ใช้กับ Unit ฝ่ายเราที่ไม่มีข้อความความสามารถ (นอกจาก COST) ณ ปัจจุบัน (คำนวณสด) · ACTIVATE 1/turn: Spend 1 Element จั่ว 1 ใบ';
NOTES['BT01-004'] = 'AUTO ข้อ 1: เมื่อ Unit ฝ่ายเราทำลาย Unit ฝ่ายตรงข้ามสำเร็จจากการต่อสู้ เปลี่ยน Element ที่นอนอยู่ 1 ใบเป็น Stand (เลือกให้อัตโนมัติ) · ข้อ 2: Unit เผ่า "ผู้พิชิต" ได้ ATK +1 CRI +1';
NOTES['BT01-021'] = 'ADVENT: โจมตีได้ทันทีในเทิร์นที่ลง (จนจบเทิร์น)';
NOTES['BT01-025'] = 'ตีความ: ใช้เอฟเฟกต์ได้เฉพาะการ์ด Spell แบบ Enchant ที่มีคำว่า "กระบวนท่า" ในชื่อ (Counter เช่น BT01-034 ใช้นอกจังหวะ Chain ไม่ได้) ไม่นับ BT01-037 เพราะชื่อไม่มีคำนี้ · ห้ามเลือกการ์ดชื่อเดียวกับที่ทิ้ง · การ์ดที่ใช้เอฟเฟกต์ยังอยู่ในกองทิ้ง';
NOTES['BT01-026'] = '1/turn: ทำลาย Unit ฝ่ายตรงข้ามสำเร็จและสวม Equipment อยู่ กลับเป็น Stand โจมตีได้อีกครั้ง';
NOTES['BT01-028'] = 'ADVENT: ความเสียหายต่อ Avatar = CRI ของ Unit ที่ถูกทำลาย (ค่าก่อนถูกทำลาย) + CRI ของการ์ดนี้ · AUTO: โจมตีได้ทันทีที่ลงสนาม';
NOTES['BT01-029'] = 'ANNOUNCE [กองทิ้ง]: ตีความ "ใช้ได้ 1 ครั้ง" เป็นครั้งเดียวต่อเทิร์น';
NOTES['BT01-030'] = 'ผลกลับเป็น Stand ได้อีก 2 ครั้ง นับหลังการโจมตีแต่ละครั้ง (รวมโจมตีได้สูงสุด 3 ครั้งต่อเทิร์น) จนจบเทิร์น';
NOTES['BT01-031'] = 'ATK +3 และการโจมตีของ Unit นั้นไม่เปิดให้ฝ่ายตรงข้ามใช้ Counter ตอบโต้ จนจบเทิร์น';
NOTES['BT01-032'] = 'Unit ที่สวม เกราะศิลาผนึก (BT01-055) ไม่ถูกเปลี่ยนเป็นนอนโดยเอฟเฟกต์ฝ่ายตรงข้าม (ใช้ได้กับเอฟเฟกต์ของชุด BT01 ที่สั่งให้นอน)';
NOTES['BT01-033'] = 'เลือก Spell ได้ทั้ง Domain Zone และ Magic Area ของทั้งสองฝ่าย (ไม่นับการ์ดใบนี้เอง)';
NOTES['BT01-034'] = 'เปรียบเทียบ ATK ตอนเอฟเฟกต์ทำงาน (รวมผลเสริม/ลดที่ได้จาก Counter อื่นก่อนหน้า)';
NOTES['BT01-036'] = 'DEF -1 ให้ Unit ที่ถูกโจมตีจนจบการต่อสู้';
NOTES['BT01-037'] = 'วางใน Domain Zone แล้วนำการ์ดชื่อมีคำว่า "ดาบ" ทั้งหมดในกองทิ้ง (ทุกประเภท) ไปไว้ใต้การ์ด · ACTIVATE 1/turn: นำ 1 ใบใต้การ์ดกลับล่างสุดของ Main Deck (แล้วสับ) ดาเมจ 1 หน่วย รับ Element 1 ใบ · เมื่อไม่มีการ์ดใต้ใบนี้ส่งลงกองทิ้ง (ถ้า Element Deck หมด ไม่ได้รับเพิ่ม)';
NOTES['BT01-038'] = 'AUTO End Phase: Stand และ "ต้องทำลายก่อนเสมอ" จนจบเทิร์นของฝ่ายตรงข้าม (เหมือน BT01-039 และ 042)';
NOTES['BT01-040'] = 'ADVENT: รับ Element 1 ใบ (ถ้า Element Deck หมดจะไม่ได้รับเพิ่ม)';
NOTES['BT01-041'] = 'ADVENT: สวมใส่ Equipment "โต๊ะกลม" จากมือฟรี (ต้องยังไม่มี Equipment) · AUTO: Unit ใบอื่นฝ่ายเรา DEF +1 (เผ่า อัศวินโต๊ะกลม +2 แทน)';
NOTES['BT01-043'] = 'AUTO 2: ตรวจหลังการต่อสู้จบ ถ้า Unit ที่มีผลบังคับทำลายก่อนเสมอรอด สามารถทิ้งการ์ดมือ 2 ใบเพื่อ Stand';
NOTES['BT01-044'] = 'ค้นได้สูงสุด 2 ใบ (ต้องมีช่องว่าง) Unit ที่ลงด้วยผลนี้ไม่ทำ ADVENT';
NOTES['BT01-045'] = 'ข้อความการ์ดพิมพ์ \\n1. \\n2. ติดมา แสดงเป็นข้อ 1/2 · ตีความ "จนจบเทิร์น" ตามที่พิมพ์ (จบเทิร์นของคุณ) · ไม่มี SpellCost ที่พิมพ์ ร่ายได้เมื่อมี Unit เผ่า "ผู้พิชิต" 4 ใบ';
NOTES['BT01-046'] = 'ร่ายได้เมื่อไม่มีการ์ดชื่อเดียวกันในกองทิ้งของคุณ';
NOTES['BT01-048'] = 'ตีความ: ใช้ตอบโต้การโจมตีของฝ่ายตรงข้าม DEF +1 จนจบการต่อสู้นั้น (การ์ดไม่ได้ระบุระยะเวลา)';
NOTES['BT01-049'] = 'ตีความ: ใช้ตอบโต้การโจมตีของฝ่ายตรงข้าม Stand Unit "ผู้พิชิต" ที่นอนอยู่ 1 ใบ';
NOTES['BT01-053'] = 'AUTO 1/turn: ทำลาย Unit สำเร็จจากการต่อสู้ ผู้สวมกลับเป็น Stand · EquipCost ต้องใช้ Element ดิน 2 ใบ';
NOTES['BT01-054'] = 'EquipCost Element ดิน 6 ใบ · ANNOUNCE [บนมือ]: ทิ้งใบนี้รับ Element 1 ใบ · ตีความ "การ์ดใบนี้" ในข้อความ AUTO = Unit "กาลาฮัด" ที่สวมใส่ (DEF +3 และฝ่ายตรงข้ามต้องโจมตี Unit นั้นก่อน)';
NOTES['BT01-055'] = 'Unit ที่สวมไม่ถูกเปลี่ยนเป็นนอนโดยเอฟเฟกต์ของฝ่ายตรงข้าม (บังคับกับเอฟเฟกต์ BT01 ที่สั่งให้นอน ชุดอื่นก่อนหน้านี้ยังไม่เช็ก)';
NOTES['BT01-056'] = 'AUTO: Unit เผ่า "ผู้พิชิต" และ "ทหาร" ฝ่ายเรา DEF +1 · ACTIVATE: ให้ DoubleStrike จนจบเทิร์น';
NOTES['BT01-057'] = 'โจมตี Avatar ตรงๆ (ไม่สนใจ Unit ยืน/ผลบังคับทำลายก่อน) ทันทีตอนใช้ ความเสียหาย = CRI ของ Unit · Unit เปลี่ยนเป็นนอนและไม่ Stand ใน Start Phase ถัดไปของคุณ';
NOTES['BT01-063'] = 'PROPHECY: ประกาศชื่อการ์ด ถ้าตรงกับการ์ดบนสุดของ Main Deck เลือก Unit ฝ่ายตรงข้ามให้นอนและไม่ Stand ใน Start Phase ถัดไป';
NOTES['BT01-067'] = 'เลือกความสามารถ 1 อย่างจากที่ทำได้ · สลับ: Unit ใหม่รับสภาพ (นอน/Stand) Equipment และผลที่ติดอยู่ของ Unit เดิม (ADVENT ไม่ทำงาน)';
NOTES['BT01-068'] = 'SpellCost: Spend 1 Element และทิ้งการ์ดมือ 1 ใบ (ใช้ได้เมื่อมีการ์ดอื่นบนมือ)';
NOTES['BT01-069'] = 'ร่ายได้เมื่อ HP Avatar เหลือ 5 หรือต่ำกว่า Unit ที่ลงสนามโจมตีได้ในเทิร์นนี้';
NOTES['BT01-071'] = 'ใช้ได้เมื่อมีช่องว่างใน Action Zone และมี Unit ในกองทิ้ง · เปลี่ยนเป้าหมายเป็น Unit นั้นจนจบการต่อสู้';
NOTES['BT01-072'] = 'DEF ของ Unit เทพเจ้าที่ถูกโจมตีเพิ่มเป็น 2 เท่า (คิดจากค่า DEF ขณะนั้น) จนจบการต่อสู้';
NOTES['BT01-073'] = 'ยกเลิกผลของ Counter ที่ฝ่ายตรงข้ามใช้ (เมื่อ Counter ใบนั้นกำลังอยู่ใน Chain)';
NOTES['BT01-074'] = 'สวมได้เฉพาะ Unit ธาตุพืช · AUTO: Unit ที่สวมไม่ตกเป็นเป้าหมายของ Enchant ฝ่ายตรงข้าม';
NOTES['BT01-075'] = 'ACTIVATE: เลือก Unit สูงสุด 2 ใบจาก Main Deck ลงสนามฟรี (ADVENT ทำงาน) สับ ทิ้งโดเมนนี้ แล้วจบเทิร์นทันที (ข้ามเฟสที่เหลือ)';
NOTES['BT01-076'] = 'Unit ฝ่ายตรงข้ามทุกใบที่ ATK ต่ำกว่าหรือเท่ากับ DEF ของ Unit เทพเจ้าที่เลือกถูกทำลาย แล้วดาเมจ 1 หน่วยต่อ Unit ที่ถูกทำลายสำเร็จ';
NOTES['BT01-079'] = '1/turn: เมื่อ Unit ฝ่ายตรงข้ามที่อยู่ในสภาพนอนถูกทำลาย จั่ว 1 ใบ';
NOTES['BT01-083'] = 'ค่าร่ายคือพลังชีวิต 2 หน่วย (ไม่ใช่ Element) ร่ายไม่ได้ถ้าพลังชีวิตไม่เกิน 2';
NOTES['BT01-084'] = 'ATK -2 จนจบการต่อสู้ และผู้โจมตีไม่ Stand ใน Start Phase ถัดไปของฝ่ายตรงข้าม';
NOTES['BT01-085'] = 'ยกเลิกการโจมตี ผู้โจมตีนอนและไม่ Stand ใน Start Phase ถัดไปของฝ่ายตรงข้าม';
NOTES['BT01-086'] = 'ตีความ: เมื่อ Unit ผู้สวมประกาศโจมตี Unit ธาตุมืด (Dark) จะทำลายทันทีก่อนเข้าสู่ Chain · ข้อความ AUTO "การ์ดใบนี้ไม่ตกเป็นเป้าหมายของ Enchant" ยังไม่มีผลในเกม (ไม่มี Enchant ที่เลือก Equipment ได้)';
NOTES['BT01-087'] = 'ACTIVATE 1/turn: ถ้าการ์ดบนสุดที่ส่งลงกองทิ้งเป็น Unit เลือก Unit ฝ่ายใดก็ได้ให้นอน';
NOTES['BT01-093'] = 'เมื่อผู้สวมโจมตี Unit เผ่า "เทพเจ้า" ทำลายทันที (ก่อน Chain) · ACTIVATE 1/turn จากการ์ดนี้: จั่ว 1 ใบ';
NOTES['BT01-094'] = 'ตีความข้อความ: ผู้สวมโจมตี Avatar ฝ่ายตรงข้ามได้โดยตรง · AUTO ห้ามทำลาย/ถอดโดยฝ่ายตรงข้าม ยังไม่บังคับครอบคลุมทุกเอฟเฟกต์';
NOTES['BT01-095'] = 'สวมได้เฉพาะ Unit เผ่า อัศวินโต๊ะกลม · ทำลาย Unit สำเร็จ ดาเมจ Avatar ฝ่ายตรงข้าม 1';
NOTES['BT01-096'] = 'Domain: ค่าอัญเชิญ Unit เผ่า "เทพเจ้า" ของคุณลด 1 (ไม่ต่ำกว่า 0) · SpellCost 3';

})(globalThis.AF = globalThis.AF || {});
