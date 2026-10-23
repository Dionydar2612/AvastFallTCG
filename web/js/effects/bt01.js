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

})(globalThis.AF = globalThis.AF || {});
