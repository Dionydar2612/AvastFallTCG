/* AvastFall TCG – สคริปต์เอฟเฟกต์การ์ดชุด BT01
   หนึ่งการ์ด = FX[id] หนึ่งรายการ + NOTES[id] อธิบายการตีความ
   ถ้าแก้ข้อความการ์ดใน card-api ให้แก้สคริปต์ตรงนี้ แล้วอัปเดตข้อความใน js/data/snapshot.js ให้ตรงกัน */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {}, NOTES = AF.notes = AF.notes || {};
const log = AF.log, place = AF.place, opp = AF.opp, addMod = AF.addMod, tribeHas = AF.tribeHas;
const { enterByEffect } = AF.fxKit;

const FIRE = 'ไฟ', GLAD = 'นักสู้กลาดิเอเตอร์';
/* ส่งการ์ดบนสุดของ Main Deck ลงกองทิ้งทีละใบ (เท่าที่มี) คืนรายการการ์ดที่ส่ง */
const mill = (G, p, n) => { const P = G.players[p]; const out = []; while (out.length < n && P.deck.length) { const c = P.deck[0]; place(G, c, 'discard'); out.push(c); } return out; };
const unitCount = cs => cs.filter(c => c.def.kind === 'Unit').length;

/* ---- 001 ผู้คุมไฟนรก ซาลอุน (Avatar ไฟ/มืด) */
FX['BT01-001'] = {
  /* AUTO: Unit ฝ่ายเราประกาศโจมตีได้แม้นอน รวมถึง Unit ที่ลงสนามทีหลัง และ Unit ที่เพิ่งลงสนามแล้วอยู่ในสภาพนอน (อ่านโดย AF.legalAttacks ใน engine.js ทุกครั้งที่ตรวจ) */
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

NOTES['BT01-001'] = 'AUTO: Unit ฝ่ายเราที่นอนอยู่ประกาศโจมตีได้ (ได้ครั้งเดียวต่อ Unit ต่อเทิร์น กันโจมตีวนซ้ำ) และผลนี้ครอบคลุม Unit ที่เพิ่งลงสนามด้วย: Unit ที่ลงสนามเทิร์นนี้แล้วอยู่ในสภาพนอน (เช่น หมาป่าเพลิงเฝ้าประตูที่ถูกถ่านแดงปะทุทำให้นอน) ประกาศโจมตีได้ทันที ส่วน Unit ที่เพิ่งลงสนามแต่ยัง Stand อยู่ยังโจมตีไม่ได้ เพราะซาลอุนให้แค่ "โจมตีได้แม้นอน" ไม่ได้ให้ "โจมตีได้ทันที" ACTIVATE: ส่ง 3 ใบบนสุดลงกองทิ้ง (ถ้าเหลือน้อยกว่า 3 ส่งเท่าที่มี) นับเฉพาะการ์ดประเภท Unit แล้วทำลาย Unit ฝ่ายตรงข้าม 1 ใบที่ Cost เท่ากับจำนวนนั้น (Cost ตามที่พิมพ์บนการ์ด) ถ้าไม่มี Unit ที่ตรงเงื่อนไข การ์ดที่ส่งลงกองทิ้งแล้วไม่คืน เลือกใช้ได้เมื่อ Main Deck มีการ์ดอย่างน้อย 1 ใบ';

/* ---- 005 ทาสแห่งเปลวไฟนรก กิลรันทา (Unit) */
FX['BT01-005'] = { abilities: [{
  id: 'stoke', kw: 'ACTIVATE 1/turn', zone: 'field', label: 'เปลี่ยนการ์ดนี้เป็นนอน ส่งการ์ดใบบนสุดของ Main Deck ลงกองทิ้ง',
  can: ({ G, p, self }) => self.state === 'stand' && G.players[p].deck.length > 0,
  pay: async ({ self }) => { self.state = 'rest'; },
  resolve: async ({ G, p, self }) => {
    const [c] = mill(G, p, 1);
    if (c) log(G, `${self.def.name}: ส่ง ${c.def.name} จากบนสุดของ Main Deck ลงกองทิ้ง`, p);
  } }] };
NOTES['BT01-005'] = 'ACTIVATE: การเปลี่ยนการ์ดนี้เป็นนอนเป็นค่าใช้จ่าย จึงใช้ได้เฉพาะตอนที่ยัง Stand และ Main Deck ต้องมีการ์ดอย่างน้อย 1 ใบ แล้วส่งการ์ดบนสุด 1 ใบลงกองทิ้ง';

/* ---- 006 ฮัมบาบา ร่างอสูรเพลิงนรก (Unit) */
FX['BT01-006'] = {
  /* ใส่เด็ค/อัญเชิญได้เมื่อ Avatar เป็นธาตุไฟ หรือชื่อ “ฮัมบาบา” และจ่าย Cost ด้วย Element ธาตุไหนก็ได้ (อ่านโดย engine.js: deckAllow / summonCond / anyElementCost) */
  anyElementCost: true,
  deckAllow: av => (av.els || []).includes(FIRE) || (av.name || '').includes('ฮัมบาบา'),
  summonCond: (G, p) => { const d = G.players[p].avatar.card.def; return (d.els || []).includes(FIRE) || d.name.includes('ฮัมบาบา'); },
  summonCondReason: 'อัญเชิญได้เมื่อ Avatar เป็นธาตุไฟหรือชื่อ “ฮัมบาบา” เท่านั้น',
  abilities: [{
    id: 'doom', kw: 'ACTIVATE 1/turn', zone: 'field', label: 'ส่งการ์ดใบนี้ลงกองทิ้ง: นำการ์ดทุกใบใน Domain Zone ของผู้เล่นทั้งสองฝ่ายลงกองทิ้ง',
    can: ({ G }) => G.players.some(P => P.domains.length > 0),
    pay: async ({ G, self }) => { await H.removeUnit(G, self, 'discard'); },
    resolve: async ({ G, p, self }) => {
      let n = 0;
      for (const P of G.players) for (const d of [...P.domains]) { place(G, d, 'discard'); n++; }
      log(G, `${self.def.name}: นำการ์ดใน Domain Zone ทั้งสองฝ่ายลงกองทิ้ง ${n} ใบ`, p);
    } }] };
NOTES['BT01-006'] = 'ข้อความ "สวมใส่การ์ดใบนี้ได้" ตีความเป็นเงื่อนไขการใส่เด็คและอัญเชิญ: ต้องมี Avatar ธาตุไฟหรือชื่อ “ฮัมบาบา” (Avatar ชื่อฮัมบาบาที่ไม่ใช่ธาตุไฟก็ใส่เด็คได้) และจ่าย Cost ด้วย Element ธาตุอะไรก็ได้ ACTIVATE: ส่งการ์ดใบนี้ลงกองทิ้งเป็นค่าใช้จ่าย (Equipment ที่สวมอยู่ลงกองทิ้งด้วย) แล้วนำการ์ดทุกใบใน Domain Zone ของทั้งสองฝ่ายลงกองทิ้งของเจ้าของการ์ด ใช้ได้เมื่อมี Domain อย่างน้อย 1 ใบบนสนาม';

/* ---- 007 ลานิสตา ผู้ฝึกกลาดิเอเตอร์ (Unit) */
FX['BT01-007'] = { abilities: [{
  id: 'coach', kw: 'ACTIVATE 1/turn', zone: 'field', label: '[Spend 1 ไฟ] เลือก Unit เผ่า “นักสู้กลาดิเอเตอร์” ฝ่ายเรา 1 ใบ ได้รับ ATK +2 จนจบเทิร์น',
  can: ({ G, p }) => AF.standElems(G.players[p], FIRE).length >= 1 && H.myUnits(G, p, u => tribeHas(u, GLAD)).length > 0,
  pay: async ({ G, p }) => { AF.spendElems(G, p, 1, FIRE); },
  targets: async ({ G, p, self }) => (await H.pickUnit(G, p, H.myUnits(G, p, u => tribeHas(u, GLAD)), `${self.def.name}: เลือก Unit เผ่า “${GLAD}” ให้ได้รับ ATK +2`)) || false,
  resolve: async ({ G, p, self }, u) => {
    if (!u || u.zone !== 'field') return;
    addMod(G, u, { atk: 2, until: 'turnEnd' });
    log(G, `${u.def.name} ได้รับ ATK +2 จนจบเทิร์น`, p);
  } }] };
NOTES['BT01-007'] = 'ค่าใช้จ่ายคือ Element ธาตุไฟที่ Stand 1 ใบ เลือกได้รวมถึงลานิสตาเองเพราะมีเผ่า “นักสู้กลาดิเอเตอร์” ด้วย';

/* ---- 009 หมาป่าเพลิงเฝ้าประตู (Unit) */
FX['BT01-009'] = { advent: { resolve: async ({ G, p, self }) => {
  const cs = mill(G, p, 2); const n = unitCount(cs);
  log(G, `${self.def.name}: ส่งการ์ด ${cs.length} ใบบนสุดของ Main Deck ลงกองทิ้ง (เป็น Unit ${n} ใบ)`, p);
  if (n > 0 && self.zone === 'field') { addMod(G, self, { atk: n, until: 'turnEnd' }); log(G, `${self.def.name} ได้รับ ATK +${n} จนจบเทิร์น`, p); }
} } };
NOTES['BT01-009'] = 'ADVENT: ส่ง 2 ใบบนสุดลงกองทิ้ง (ถ้าเหลือน้อยกว่า 2 ส่งเท่าที่มี) ได้ ATK +1 ต่อ Unit 1 ใบที่ส่งลงไป';

/* ---- 010 ราชาลาวาผู้เผาผลาญ อิกซาน (Unit) */
FX['BT01-010'] = { on: { unitDestroyed: async ({ G, self, p, owner, by }) => {
  if (owner !== opp(p) || !by || (by.attacker !== self && by.source !== self)) return;
  log(G, `${self.def.name}: ทำลาย Unit ฝ่ายตรงข้ามสำเร็จ สร้างความเสียหายใส่ Avatar ฝ่ายตรงข้าม 1 หน่วย`, p);
  H.damageAvatar(G, opp(p), 1, self);
} } };
NOTES['BT01-010'] = 'AUTO: ทำงานเมื่อ Unit ฝ่ายตรงข้ามถูกการ์ดนี้ทำลาย ไม่ว่าจะด้วยการโจมตีหรือด้วยความสามารถของการ์ดนี้ แล้วสร้างความเสียหายใส่ Avatar ฝ่ายตรงข้าม 1 หน่วย (ไม่ขึ้นกับ CRI)';

/* ---- 011 ถ่านแดงปะทุ (Enchant) */
FX['BT01-011'] = { spell: {
  can: ({ G, p }) => H.myUnits(G, p).length > 0, cantReason: 'ไม่มี Unit ของเราบนสนาม',
  resolve: async ({ G, p, self }) => {
    const u = await H.pickUnit(G, p, H.myUnits(G, p), `${self.def.name}: เลือก Unit ของคุณ 1 ใบ ได้รับ ATK +2 แล้วเปลี่ยนเป็นนอน`);
    if (!u) { log(G, 'ไม่มี Unit ของเราให้เลือก', p); return; }
    addMod(G, u, { atk: 2, until: 'turnEnd' }); u.state = 'rest';
    log(G, `${u.def.name} ได้รับ ATK +2 จนจบเทิร์น และเปลี่ยนเป็นนอน`, p);
  } } };
NOTES['BT01-011'] = 'ร่ายได้เมื่อมี Unit ของเราบนสนาม Unit ที่ถูกเลือกจะนอนทันที ถ้าฝั่งเราเป็น Avatar ซาลอุน Unit นั้นยังประกาศโจมตีได้ แม้เพิ่งลงสนามในเทิร์นนี้';

/* ---- 012 คำพิพากษาแห่งเปลวเพลิง (Enchant) */
FX['BT01-012'] = { spell: { resolve: async ({ G, p, self }) => {
  const cs = mill(G, p, 3); const n = unitCount(cs); const max = n + 2;
  log(G, `${self.def.name}: ส่งการ์ด ${cs.length} ใบบนสุดของ Main Deck ลงกองทิ้ง (เป็น Unit ${n} ใบ) ทำลายได้ถึง Cost ${max}`, p);
  const u = await H.pickUnit(G, p, H.oppUnits(G, p, x => x.def.cost <= max, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่ Cost ไม่เกิน ${max} เพื่อทำลาย`);
  if (!u) { log(G, `ไม่มี Unit ฝ่ายตรงข้ามที่ Cost ไม่เกิน ${max}`, p); return; }
  await H.destroy(G, u, { kind: 'effect', player: p, source: self });
} } };
NOTES['BT01-012'] = 'ส่ง 3 ใบบนสุด (ถ้าเหลือน้อยกว่านั้นส่งเท่าที่มี) นับเฉพาะ Unit แล้วทำลาย Unit ฝ่ายตรงข้าม 1 ใบที่ Cost (ตามที่พิมพ์บนการ์ด) ไม่เกินจำนวนนั้น + 2 ร่ายได้แม้ Main Deck ว่าง (จะได้ Cost สูงสุด 2)';

/* ---- 013 เสียงเชียร์จากอัฒจันทร์ (Enchant) */
FX['BT01-013'] = { spell: { resolve: async ({ G, p, self }) => {
  const bonus = H.myUnits(G, p, u => tribeHas(u, GLAD)).length >= 2;
  H.draw(G, p, bonus ? 2 : 1);
  log(G, `${self.def.name}: จั่วการ์ด ${bonus ? 2 : 1} ใบ${bonus ? ' (มี Unit นักสู้กลาดิเอเตอร์ตั้งแต่ 2 ใบ)' : ''}`, p);
} } };
NOTES['BT01-013'] = 'จั่ว 1 ใบ ถ้ามี Unit เผ่า “นักสู้กลาดิเอเตอร์” ฝ่ายเราตั้งแต่ 2 ใบบนสนามจั่วเพิ่มอีก 1 ใบ (รวม 2 ใบ) ตรวจเงื่อนไขตอนผลทำงาน';

/* ---- 014 ลุกโชนก่อนดับสูญ (Counter) */
FX['BT01-014'] = { counter: {
  when: (G, r, last) => last.kind === 'attack' && last.target !== 'avatar' && last.target.owner === r,
  resolve: async ({ G, p, self, target }) => {
    const u = target.target, a = target.attacker;
    if (u === 'avatar' || u.zone !== 'field' || a.zone !== 'field') return;
    u.flags = u.flags || {};
    u.flags.avenge = { attacker: a, source: self, label: self.def.name };   // engine.js (resolveAttack) ตรวจตอน Unit นี้ถูกทำลาย
    log(G, `${self.def.name}: ถ้า ${u.def.name} ถูกทำลายในการต่อสู้นี้ จะทำลาย ${a.def.name} ด้วย`, p);
  } } };
NOTES['BT01-014'] = 'ใช้ตอบโต้ได้ตอนที่ Unit ของเราตกเป็นเป้าหมายการโจมตี (ไม่ใช่การโจมตี Avatar) ถ้า Unit นั้นถูกทำลายในการต่อสู้ครั้งนี้ จะทำลาย Unit ที่โจมตีด้วย (นับเป็นการทำลายด้วยความสามารถ) ผลหมดเมื่อจบการต่อสู้';

/* ---- 015 ดาบโซ่เพลิงนรก อิกนิส (Equipment) */
FX['BT01-015'] = { equip: { atk: 2 }, on: { attackDeclared: async ({ G, self, p, attacker, wasRest }) => {
  if (!self.host || attacker !== self.host || !wasRest) return;
  addMod(G, attacker, { cri: 1, until: 'turnEnd' });
  log(G, `${self.def.name}: ${attacker.def.name} ประกาศโจมตีขณะนอน ได้รับ CRI +1 จนจบเทิร์น`, p);
} } };
NOTES['BT01-015'] = 'ATK +2 ให้ผู้สวมใส่ AUTO: ตรวจสภาพของผู้สวมใส่ก่อนประกาศโจมตี ถ้านอนอยู่ (เช่น ได้ผลของ Avatar ซาลอุน) ได้ CRI +1 จนจบเทิร์น';

/* ---- 016 เกราะหนังแห่งสนามประลอง (Equipment) */
FX['BT01-016'] = { equip: { def: 3 }, onHostDestroyed: async ({ G, p, self, host }) => {
  H.draw(G, p, 1);
  log(G, `${self.def.name}: ${host.def.name} ถูกทำลาย จั่วการ์ด 1 ใบ`, p);
} };
NOTES['BT01-016'] = 'DEF +3 ให้ผู้สวมใส่ AUTO: เมื่อผู้สวมใส่ถูกทำลาย (ทั้งในการต่อสู้และด้วยความสามารถ) จั่ว 1 ใบ ทำงานผ่าน hook onHostDestroyed ใน engine.js เพราะ Equipment ลงกองทิ้งก่อนมี event unitDestroyed';

/* ---- 017 โรงตีดาบ (Domain) */
FX['BT01-017'] = { abilities: [{
  id: 'forge', kw: 'ACTIVATE 1/turn', zone: 'domain', label: 'เลือกการ์ดที่มีคำว่า “ดาบ” ในชื่อสูงสุด 2 ใบจากกองทิ้ง นำกลับเข้า Main Deck แล้วสับ',
  can: ({ G, p }) => G.players[p].discard.some(c => c.def.name.includes('ดาบ')),
  resolve: async ({ G, p, self }) => {
    const P = G.players[p];
    const ch = await H.pickCards(G, p, { title: `${self.def.name}: เลือกการ์ดที่มีคำว่า “ดาบ” ในชื่อสูงสุด 2 ใบจากกองทิ้ง`, cards: P.discard.filter(c => c.def.name.includes('ดาบ')), optional: true, max: 2 });
    if (!ch.length) { log(G, `${self.def.name}: ไม่ได้เลือกการ์ด`, p); return; }
    for (const c of ch) place(G, c, 'deckBottom');
    AF.shuffleDeck(G, p);
    log(G, `${self.def.name}: นำ ${ch.map(c => c.def.name).join(', ')} กลับเข้า Main Deck แล้วสับ`, p);
  } }] };
NOTES['BT01-017'] = 'ACTIVATE: เลือกการ์ดทุกประเภทที่ชื่อมีคำว่า “ดาบ” ในกองทิ้งของเรา สูงสุด 2 ใบ (ไม่ต้องเลือกครบ 2) นำกลับเข้า Main Deck แล้วสับ ใช้ได้เมื่อกองทิ้งมีการ์ดที่เข้าเงื่อนไข';

/* ---- 018 ประตูนรกเปิดออก (Ultimate) */
FX['BT01-018'] = { ultimate: { resolve: async ({ G, p, self }) => {
  const cs = mill(G, p, 5); const milled = cs.filter(c => c.def.kind === 'Unit'); const n = milled.length;
  log(G, `${self.def.name}: ส่งการ์ด ${cs.length} ใบบนสุดของ Main Deck ลงกองทิ้ง (เป็น Unit ${n} ใบ)`, p);
  const chosen = [], cap = Math.min(3, n);
  for (let i = 0; i < cap; i++) {
    const pool = H.oppUnits(G, p, x => !chosen.includes(x), self);
    const u = await H.pickUnit(G, p, pool, `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามเพื่อส่งลงกองทิ้ง (${i + 1}/${cap}) กดข้ามเพื่อหยุด`, true);
    if (!u) break;
    chosen.push(u);
  }
  for (const u of chosen) if (u.zone === 'field') { await H.removeUnit(G, u, 'discard'); log(G, `${u.def.name} ถูกส่งลงกองทิ้ง (ไม่นับเป็นการถูกทำลาย)`, opp(p)); }
  const cands = milled.filter(c => c.zone === 'discard' && c.def.cost <= 3);
  if (!cands.length) return;
  const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit Cost 3 หรือต่ำกว่า 1 ใบ เข้าสู่ Action Zone ในสภาพนอน`, cards: cands });
  if (c) await enterByEffect(G, p, c, { state: 'rest' });
} } };
NOTES['BT01-018'] = 'ส่ง 5 ใบบนสุดลงกองทิ้ง (ถ้าเหลือน้อยกว่านั้นส่งเท่าที่มี) เลือก Unit ฝ่ายตรงข้ามได้สูงสุด 3 ใบ แต่ไม่เกินจำนวน Unit ที่ส่งลงกองทิ้ง แล้วส่งลงกองทิ้งโดยไม่นับว่าถูกทำลาย (ADMONISH ไม่ทำงาน) จากนั้นเลือก Unit Cost ≤ 3 จาก Unit ที่ส่งลงกองทิ้งจาก Main Deck ของเรา 1 ใบ นำเข้า Action Zone ในสภาพนอน (ADVENT ไม่ทำงาน) ตีความว่า "Unit ที่ถูกส่งลงกองทิ้งด้วยเอฟเฟกต์นี้" ในประโยคสุดท้ายหมายถึง Unit จาก Main Deck ของเรา ไม่รวม Unit ฝ่ายตรงข้าม เพราะการ์ดฝ่ายตรงข้ามนำเข้า Action Zone ของเราไม่ได้ ถ้า Action Zone เต็ม จะนำเข้าไม่ได้';
})(globalThis.AF = globalThis.AF || {});
