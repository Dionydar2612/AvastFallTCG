/* AvastFall TCG – สคริปต์เอฟเฟกต์การ์ดชุด SD05 Thirst for Death
   หนึ่งการ์ด = FX[id] หนึ่งรายการ + (ถ้าจำเป็น) NOTES[id] อธิบายการตีความ
   ถ้าแก้ข้อความการ์ดใน card-api ให้แก้สคริปต์ตรงนี้ แล้วอัปเดตข้อความใน js/data/snapshot.js ให้ตรงกัน

   ชุดนี้ใช้ตัวช่วยใหม่ในเอนจิน (js/engine/engine.js):
   - flag 'noStand'  Unit ไม่เปลี่ยนเป็น Stand (ใน Start Phase) · AF.setStand ตรวจ flag นี้
   - flag 'direct'   Unit โจมตี Avatar ได้โดยตรง (ไม่ต้องรอให้ Unit ฝั่งตรงข้ามนอนหมด)
   - fx.castLife     ค่าร่ายเป็นพลังชีวิต (Enchant / Equipment)
   - fx.costMod      Avatar ลดค่าร่ายการ์ดบางใบ
   - equip.followHost  Equipment ที่ย้ายไปสวมต่อเมื่อผู้สวมออกจากสนาม
   - AF.hooks.turnEnd  ฟังก์ชันที่ทำงานหลังจบเทิร์น (ใช้ทำลาย/ทิ้ง Unit ที่ถูกกำหนดไว้) */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {}, NOTES = AF.notes = AF.notes || {};
const opp = AF.opp, stat = AF.stat, place = AF.place, log = AF.log;
const hasName = AF.hasName, addMod = AF.addMod;
const fxOf = c => FX[c.def.id] || {};
const { enterByEffect } = AF.fxKit;

/* =============================================================== SD05 Thirst for Death */
const NAME = 'ฮัสซัน';
const DRAGONS = ['SD05-007', 'SD05-008', 'SD05-009'];            // "การ์ดใบนี้มีชื่อเพิ่มเติมว่า ฮัสซัน"
const isHassan = c => c.def.name.includes(NAME) || DRAGONS.includes(c.def.id);   // ใช้ได้ทุกโซน (สนาม/มือ/กองทิ้ง/Main Deck)
const extraHassan = { extraNames: () => [NAME] };
const myHassans = (G, p, f) => H.myUnits(G, p, u => isHassan(u) && (!f || f(u)));
const lifeOk = (G, p, n) => G.players[p].avatar.hp > n;
const loseLife = (G, p, n) => { const P = G.players[p]; P.avatar.hp -= n; log(G, `${P.name} จ่ายพลังชีวิต ${n} หน่วย (HP ${P.avatar.hp})`, p); AF.checkEnd(G); };
const restOpp = (G, p, self, f) => H.oppUnits(G, p, u => u.state === 'rest' && (!f || f(u)), self);
const effDestroy = (G, p, u, self) => H.destroy(G, u, { kind: 'effect', player: p, source: self });

/* ทำลาย/ทิ้ง Unit ที่ถูกกำหนดไว้ตอนจบเทิร์น (หลัง emit turnEnd ก่อนโมดิฟายเออร์หมดอายุ) */
AF.hooks.turnEnd.push(async (G, p) => {
  for (const Q of G.players) for (const u of [...Q.field]) {
    if (!u || u.zone !== 'field') continue;
    const md = u.mods.find(m => m.doomDestroy === G.turn);
    if (md) { log(G, `${u.def.name} ถูกทำลายเมื่อจบเทิร์น`, u.owner); await H.destroy(G, u, { kind: 'effect', player: md.by, source: md.src }); continue; }
    if (u.mods.some(m => m.doomDiscard === G.turn)) { log(G, `${u.def.name} ถูกส่งลงกองทิ้งเมื่อจบเทิร์น`, u.owner); await H.removeUnit(G, u, 'discard'); }
  }
});

/* ---- 001 ฮัสซัน อิ ซับบาห์ ผู้มอบความตาย (Avatar) */
FX['SD05-001'] = {
  abilities: [{
    id: 'curse', kw: 'ACTIVATE 1/turn', zone: 'avatar', label: 'Unit ฝ่ายตรงข้ามที่นอน: ไม่ Stand รอบหน้า และลงกองทิ้งตอนจบเทิร์นนั้น',
    can: ({ G, p, self }) => restOpp(G, p, self).length > 0,
    targets: async ({ G, p, self }) => (await H.pickUnit(G, p, restOpp(G, p, self), 'ฮัสซัน อิ ซับบาห์: เลือก Unit ฝ่ายตรงข้ามที่อยู่ในสภาพนอน')) || false,
    resolve: async ({ G, p, self }, u) => {
      if (!u || u.zone !== 'field') return;
      addMod(G, u, { flag: 'noStand', doomDiscard: G.turn + 1, until: 'oppTurnEnd' });
      log(G, `${u.def.name} จะไม่ Stand ใน Start Phase ถัดไป และถูกส่งลงกองทิ้งเมื่อจบเทิร์นนั้น`, p);
    } }],
  costMod: (G, p, card) => card.def.name === 'อิสมาอีลียะฮ์' ? G.players[p].field.filter(u => u && hasName(G, u, NAME)).length : 0
};

/* ---- 002 ฮัสซัน ตุ๊กตาต้องสาป */
FX['SD05-002'] = { advent: {
  targets: async ({ G, p, self }) => {
    const c = H.oppUnits(G, p, null, self); if (!c.length) return false;
    return (await H.pickUnit(G, p, c, 'ตุ๊กตาต้องสาป: เลือก Unit ฝ่ายตรงข้าม 1 ใบ เปลี่ยนเป็นสภาพนอน')) || false;
  },
  resolve: async ({ G, p }, u) => {
    if (!u || u.zone !== 'field') return;
    u.state = 'rest';
    addMod(G, u, { flag: 'noStand', until: 'oppTurnEnd' });
    log(G, `${u.def.name} เปลี่ยนเป็นสภาพนอน และไม่สามารถ Stand ได้ในเทิร์นถัดไปของฝ่ายตรงข้าม`, p);
  } } };

/* ---- 003 ฮัสซัน ประกายแสง */
FX['SD05-003'] = { admonish: async ({ G, p, self }) => {
  const atk = stat(G, self, 'atk');
  const c = H.oppUnits(G, p, u => u.def.cost === atk, self);
  const u = await H.pickUnit(G, p, c, `ประกายแสง: เลือก Unit ฝ่ายตรงข้ามที่ Cost = ${atk} เพื่อทำลาย`);
  if (u) await effDestroy(G, p, u, self); else log(G, `ไม่มี Unit ฝ่ายตรงข้ามที่ Cost = ${atk}`, p);
} };

/* ---- 004 ฮัสซัน แขนต้องสาป */
const armTargets = (G, p, self) => restOpp(G, p, self, u => u.def.cost <= self.def.cost);
FX['SD05-004'] = { abilities: [{
  id: 'arm', kw: 'ACTIVATE 1/turn', label: '[Spend 1 มืด] ทำลาย Unit ที่นอน ≤ 2 ใบ (Cost ≤ ใบนี้)',
  can: ({ G, p, self }) => AF.standElems(G.players[p], 'มืด').length >= 1 && armTargets(G, p, self).length > 0,
  pay: async ({ G, p }) => { AF.spendElems(G, p, 1, 'มืด'); },
  targets: async ({ G, p, self }) => {
    const ch = await H.pickCards(G, p, { title: `แขนต้องสาป: เลือก Unit ฝ่ายตรงข้ามที่นอนอยู่และ Cost ≤ ${self.def.cost} (สูงสุด 2 ใบ)`, cards: armTargets(G, p, self), min: 1, max: 2 });
    return ch.length ? ch : false;
  },
  resolve: async ({ G, p, self }, list) => { for (const u of list || []) if (u.zone === 'field') await effDestroy(G, p, u, self); } }] };

/* ---- 005 ฮัสซัน ร้อยหน้า — สั่งใช้ความสามารถของ "ฮัสซัน" ใบอื่นซ้ำโดยไม่จ่าย Cost */
const rerunOptions = (G, p, self, u) => {
  const f = fxOf(u), out = [];
  if (f.advent) out.push({ label: 'ADVENT', run: () => AF.runAbility(G, p, u, f.advent, 'unit-ability', 'ADVENT') });
  if (f.admonish) out.push({ label: 'ADMONISH', run: () => f.admonish({ G, p, self: u }) });
  for (const ab of f.abilities || []) if ((ab.zone || 'field') === 'field' && !ab.prophecy && !ab.noCopy)
    out.push({ label: (ab.kw || 'ACTIVATE').split(' ')[0] + ': ' + ab.label, run: () => AF.runAbility(G, p, u, ab, 'unit-ability', (ab.kw || '').split(' ')[0]) });
  return out;
};
const rerunTargets = (G, p, self) => myHassans(G, p, u => u !== self && !AF.silenced(G, u) && rerunOptions(G, p, self, u).length > 0);
FX['SD05-005'] = { abilities: [{
  id: 'copy', noCopy: true, kw: 'ACTIVATE 1/turn', spend: 2, label: '[Spend 2] สั่งใช้ความสามารถของ "ฮัสซัน" ใบอื่นอีกครั้งโดยไม่จ่าย Cost',
  can: ({ G, p, self }) => rerunTargets(G, p, self).length > 0,
  targets: async ({ G, p, self }) => {
    const u = await H.pickUnit(G, p, rerunTargets(G, p, self), 'ร้อยหน้า: เลือก Unit ที่มีคำว่า "ฮัสซัน" ในชื่อเพื่อสั่งใช้ความสามารถซ้ำ');
    if (!u) return false;
    const opts = rerunOptions(G, p, self, u);
    const i = opts.length > 1 ? await H.choose(G, p, `เลือกความสามารถของ ${u.def.name}`, opts.map(o => o.label)) : 0;
    return { u, o: opts[i] };
  },
  resolve: async ({ G, p, self }, t) => {
    if (!t || t.u.zone !== 'field') return;
    log(G, `${self.def.name} สั่งใช้ความสามารถ ${t.o.label} ของ ${t.u.def.name} อีกครั้ง`, p);
    await t.o.run();
  } }] };

/* ---- 006 ฮัสซัน หมวกแดง */
FX['SD05-006'] = { abilities: [{
  id: 'cloak', kw: 'ACTIVATE 1/turn', spend: 2, label: '[Spend 2 + นอน] Unit ฝ่ายเรา 1 ใบ โจมตีได้ทันที/โจมตี Avatar ตรงๆ แล้วถูกทำลายตอนจบเทิร์น',
  can: ({ G, p, self }) => self.state === 'stand' && H.myUnits(G, p, u => u !== self && u.state === 'stand').length > 0,
  pay: async ({ G, self }) => { self.state = 'rest'; },
  targets: async ({ G, p, self }) => (await H.pickUnit(G, p, H.myUnits(G, p, u => u !== self && u.state === 'stand'), 'หมวกแดง: เลือก Unit ฝ่ายเรา 1 ใบ')) || false,
  resolve: async ({ G, p, self }, u) => {
    if (!u || u.zone !== 'field') return;
    addMod(G, u, { flag: 'haste', until: 'turnEnd' });
    addMod(G, u, { flag: 'direct', until: 'turnEnd' });
    addMod(G, u, { doomDestroy: G.turn, by: p, src: self, until: 'turnEnd' });
    log(G, `${u.def.name} โจมตีได้ทันทีและโจมตี Avatar ได้โดยตรงจนจบเทิร์น (แล้วจะถูกทำลาย)`, p);
  } }] };

/* ---- 007 มังกรมารกระดูก มากราฟ ดราก้อน */
FX['SD05-007'] = Object.assign({ advent: { resolve: async ({ G, p }) => {
  const us = myHassans(G, p);
  for (const u of us) addMod(G, u, { flag: 'haste', until: 'turnEnd' });
  log(G, `Unit "ฮัสซัน" ของ ${G.players[p].name} ${us.length} ใบ โจมตีได้แม้จะพึ่งลงมา`, p);
} } }, extraHassan);

/* ---- 008 มังกรมารกระดูก เอทาริส ดราก้อน */
FX['SD05-008'] = Object.assign({ advent: { resolve: async ({ G, p, self }) => {
  const P = G.players[p];
  const kill = H.oppUnits(G, p, null, self);
  const back = P.discard.filter(c => c.def.kind === 'Unit');
  const labels = [], acts = [];
  if (kill.length) { labels.push('ทำลาย Unit ฝ่ายตรงข้าม 1 ใบ'); acts.push('kill'); }
  if (back.length && AF.freeSlot(P)) { labels.push('เลือกการ์ด 1 ใบจากกองทิ้งมาที่ Action Zone'); acts.push('back'); }
  if (!acts.length) { log(G, 'เอทาริส ดราก้อน: ไม่มีตัวเลือกที่ทำได้', p); return; }
  const i = acts.length > 1 ? await H.choose(G, p, 'เอทาริส ดราก้อน: เลือก 1 อย่าง', labels) : 0;
  if (acts[i] === 'kill') {
    const u = await H.pickUnit(G, p, kill, 'เอทาริส ดราก้อน: เลือก Unit ฝ่ายตรงข้ามที่จะทำลาย');
    if (u) await effDestroy(G, p, u, self);
  } else {
    const [c] = await H.pickCards(G, p, { title: 'เอทาริส ดราก้อน: เลือกการ์ดจากกองทิ้งของคุณมาที่ Action Zone', cards: back });
    if (c) await enterByEffect(G, p, c);
  }
} } }, extraHassan);

/* ---- 009 มังกรมารกระดูก เพลทา ดราก้อน */
FX['SD05-009'] = Object.assign({ on: { turnEnd: async ({ G, self, p }) => {
  if (self.zone !== 'field') return;
  let n = 0;
  for (const Q of G.players) for (const u of Q.field) if (u && stat(G, u, 'def') > 0) { addMod(G, u, { def: -1, until: 'perm' }); n++; }
  if (n) log(G, `${self.def.name}: จบเทิร์น DEF ของ Unit ทุกใบ -1 (${n} ใบ)`, p);
} } }, extraHassan);

/* ---- 010 กลอุบายแห่งเงา */
FX['SD05-010'] = { counter: {
  when: (G, r, last) => last.kind === 'attack' && last.controller !== r && G.players[r].field.some(Boolean),
  resolve: async ({ G, p, target }) => {
    const u = await H.pickUnit(G, p, H.myUnits(G, p), 'กลอุบายแห่งเงา: เลือก Unit ฝ่ายคุณ 1 ใบเพื่อนำขึ้นมือ');
    if (u) { await H.removeUnit(G, u, 'hand'); log(G, `${u.def.name} กลับขึ้นมือ`, p); }
    H.cancel(G, target); log(G, 'การโจมตีนั้นถูกยกเลิก', p);
  } } };

/* ---- 011 ออร่าแห่งความตาย */
FX['SD05-011'] = { counter: {
  when: (G, r, last) => last.controller !== r && H.oppUnits(G, r, u => stat(G, u, 'atk') <= 3).length > 0,
  resolve: async ({ G, p, self }) => {
    const u = await H.pickUnit(G, p, H.oppUnits(G, p, u => stat(G, u, 'atk') <= 3, self), 'ออร่าแห่งความตาย: เลือก Unit ฝ่ายตรงข้ามที่ ATK ≤ 3 เพื่อทำลาย');
    if (u) await effDestroy(G, p, u, self); else log(G, 'ไม่มีเป้าหมาย', p);
  } } };

/* ---- 012 เจตจำนงแห่งความกล้า */
FX['SD05-012'] = { spell: {
  can: ({ G, p }) => G.players[p].field.some(Boolean), cantReason: 'ไม่มี Unit ฝ่ายเราบนสนาม',
  resolve: async ({ G, p }) => {
    const u = await H.pickUnit(G, p, H.myUnits(G, p), 'เจตจำนงแห่งความกล้า: เลือก Unit ฝ่ายเรา 1 ใบ');
    if (u) { addMod(G, u, { atk: 3, until: 'turnEnd' }); log(G, `${u.def.name} ได้รับ ATK +3 จนจบเทิร์น`, p); }
  } } };

/* ---- 013 อ้างว้าง เงียบเหงา คนเขลา ความตาย */
FX['SD05-013'] = { spell: {
  can: ({ G, p }) => myHassans(G, p).length > 0, cantReason: 'ต้องมี Unit ที่ชื่อ "ฮัสซัน" บนสนามฝ่ายคุณ',
  resolve: async ({ G, p, self }) => {
    const mine = myHassans(G, p);
    if (!mine.length) { log(G, 'ไม่มี Unit "ฮัสซัน" บนสนาม ไม่เกิดผล', p); return; }
    const u = await H.pickUnit(G, p, mine, 'อ้างว้าง เงียบเหงา: เลือก Unit "ฮัสซัน" ฝ่ายคุณ 1 ใบเพื่อทำลาย');
    if (u) await effDestroy(G, p, u, self);
    H.draw(G, p, 1);
    const P = G.players[p];
    const top = P.deck.slice(0, 5);
    if (!top.length) { log(G, 'Main Deck ว่าง', p); return; }
    log(G, `${P.name} เปิดการ์ด ${top.length} ใบบนสุดของ Main Deck: ${top.map(c => c.def.name).join(', ')}`, p, { reveal: top.map(c => c.uid) });
    const cand = top.filter(c => c.def.kind === 'Unit' && isHassan(c));
    let chosen = [];
    if (cand.length) chosen = await H.pickCards(G, p, { title: 'เลือก Unit "ฮัสซัน" สูงสุด 2 ใบ นำเข้าสู่ Action Zone (Advent ทำงาน)', cards: cand, optional: true, max: 2, kind: 'reveal', ctx: { all: top } });
    for (const c of chosen) await enterByEffect(G, p, c, { adv: true });
    const rest = top.filter(c => c.zone === 'deck');
    await H.toBottom(G, p, rest);
  } } };

/* ---- 014 ชีวิตแลกด้วยชีวิต */
FX['SD05-014'] = { castLife: 1, spell: { resolve: async ({ G, p }) => { H.damageAvatar(G, opp(p), 1); } } };

/* ---- 015 ป้อมปราการแห่งเลือด (Domain) */
FX['SD05-015'] = { abilities: [{
  id: 'blood', kw: 'ACTIVATE 1/turn', zone: 'domain', label: '[พลังชีวิต 1] Unit "ฮัสซัน" ได้รับ ATK +2 และโจมตีได้ทันที',
  can: ({ G, p }) => lifeOk(G, p, 1) && myHassans(G, p).length > 0,
  pay: async ({ G, p }) => { loseLife(G, p, 1); },
  targets: async ({ G, p }) => (await H.pickUnit(G, p, myHassans(G, p), 'ป้อมปราการแห่งเลือด: เลือก Unit "ฮัสซัน" ฝ่ายเรา 1 ใบ')) || false,
  resolve: async ({ G, p }, u) => {
    if (!u || u.zone !== 'field') return;
    addMod(G, u, { atk: 2, until: 'turnEnd' }); addMod(G, u, { flag: 'haste', until: 'turnEnd' });
    log(G, `${u.def.name} ได้รับ ATK +2 และโจมตีได้ทันทีจนจบเทิร์น`, p);
  } }] };

/* ---- 016 สวนสวรรค์แห่งอลามุต (Domain) */
const garden = (G, p) => G.players[p].discard.filter(c => c.def.kind === 'Unit' && isHassan(c) && c.def.cost <= 2);
FX['SD05-016'] = { abilities: [{
  id: 'garden', kw: 'ACTIVATE 1/turn', zone: 'domain', spend: 1, label: '[Spend 1] นำ Unit "ฮัสซัน" Cost ≤ 2 จากกองทิ้งขึ้นมือ',
  can: ({ G, p }) => garden(G, p).length > 0,
  targets: async ({ G, p }) => { const [c] = await H.pickCards(G, p, { title: 'สวนสวรรค์แห่งอลามุต: เลือก Unit "ฮัสซัน" Cost ≤ 2 จากกองทิ้ง', cards: garden(G, p) }); return c || false; },
  resolve: async ({ G, p }, c) => { if (c && c.zone === 'discard') { place(G, c, 'hand'); log(G, `${G.players[p].name} นำ ${c.def.name} จากกองทิ้งขึ้นมือ`, p); } } }] };

/* ---- 017 อสุราอาสัญ (Equipment) */
FX['SD05-017'] = { castLife: 1, equip: { followHost: true },
  aura: { cri: (G, self, u, host) => u === host ? 1 + (self.hops || 0) : 0 } };

/* ---- 018 ป้อมปราการมาเซียฟ (Domain) */
FX['SD05-018'] = { abilities: [{
  id: 'gate', kw: 'ACTIVATE 1/turn', zone: 'domain', spend: 1, label: '[Spend 1] นำ Unit ฝ่ายเราขึ้นมือ แล้ว Element ที่ Rest 2 ใบ (อย่างน้อย 1) เป็น Stand',
  can: ({ G, p }) => G.players[p].field.some(Boolean),
  targets: async ({ G, p }) => (await H.pickUnit(G, p, H.myUnits(G, p), 'ป้อมปราการมาเซียฟ: เลือก Unit ฝ่ายเรา 1 ใบเพื่อนำขึ้นมือ')) || false,
  resolve: async ({ G, p }, u) => {
    if (!u || u.zone !== 'field') return;
    await H.removeUnit(G, u, 'hand'); log(G, `${u.def.name} กลับขึ้นมือ`, p);
    const rest = G.players[p].elems.filter(e => e.state === 'rest').slice(0, 2);
    rest.forEach(e => { e.state = 'stand'; });
    if (rest.length) log(G, `Element ${rest.length} ใบกลับเป็น Stand`, p);
  } }] };

/* ---- 019 อิสมาอีลียะฮ์ (Ultimate) */
FX['SD05-019'] = { ultimate: {
  can: ({ G, p }) => H.oppUnits(G, p).length > 0,
  resolve: async ({ G, p, self }) => {
    const u = await H.pickUnit(G, p, H.oppUnits(G, p, null, self), 'อิสมาอีลียะฮ์: เลือก Unit ฝ่ายตรงข้าม 1 ใบเพื่อทำลาย');
    if (u) await effDestroy(G, p, u, self); else log(G, 'ไม่มี Unit ให้ทำลาย', p);
    H.damageAvatar(G, opp(p), 3);
  } } };

/* ------------------------------------------------------------- คำอธิบายการตีความ (แสดงในหน้า "ข้อสังเกต" และตัวตรวจการ์ด) */
NOTES['SD05-001'] = 'ACTIVATE: เลือก Unit ฝ่ายตรงข้ามที่นอนอยู่ จะไม่ Stand ใน Start Phase ถัดไปของฝ่ายตรงข้าม และถูกส่งลงกองทิ้ง (ไม่นับเป็นถูกทำลาย) เมื่อจบเทิร์นนั้น AUTO: ค่าร่ายของ "อิสมาอีลียะฮ์" ลด 1 ต่อ Unit ที่ชื่อมีคำว่า "ฮัสซัน" บนสนามฝ่ายเรา (รวมมังกรที่มีชื่อเพิ่มเติม) ต่ำสุด 0';
NOTES['SD05-002'] = 'เลือก Unit ฝ่ายตรงข้ามใบใดก็ได้ (ไม่จำกัดว่าต้องนอนอยู่) เปลี่ยนเป็นสภาพนอน และ Stand ไม่ได้ตลอดเทิร์นถัดไปของฝ่ายตรงข้ามรอบเดียว จากนั้นกลับเป็นปกติ';
NOTES['SD05-003'] = 'ADMONISH ทำงานเมื่อการ์ดนี้ลงกองทิ้งหลังถูกทำลาย ใช้ ATK ปัจจุบันตอนถูกทำลาย (ถ้าออกจากสนามแล้วใช้ ATK ตามตัวการ์ด 2) และต้องเลือกเป้าหมายถ้ามี';
NOTES['SD05-004'] = 'ค่าใช้จ่ายคือ Element ธาตุมืด 1 ใบที่ตั้งอยู่ (นอนลง) ต้องมี Unit ที่นอนอยู่และ Cost ≤ Cost ของการ์ดนี้ (2) อย่างน้อย 1 ใบ เลือกได้ 1–2 ใบ';
NOTES['SD05-005'] = 'ตีความ "ความสามารถ" = ADVENT / ADMONISH / ACTIVATE ของ Unit ที่มีคำว่า "ฮัสซัน" ใบอื่น (ไม่ใช่ใบนี้เอง เพื่อกันวนซ้ำ และไม่รวม AUTO ที่เป็นผลต่อเนื่อง) สั่งใช้โดยไม่จ่าย Cost ของความสามารถนั้น (เช่น ไม่ต้องจ่าย Element หรือไม่ต้องนอนลง) และไม่นับรอบ 1/turn ของความสามารถนั้น ADMONISH ถือว่าเงื่อนไข "ถูกทำลาย" เกิดขึ้นอีกครั้ง ถ้าเลือกแล้วไม่มีเป้าหมาย ค่า Element 2 ใบที่จ่ายแล้วจะไม่คืน';
NOTES['SD05-006'] = 'การนอนของการ์ดนี้ถือเป็นค่าใช้จ่าย (ต้อง Stand อยู่) เลือก Unit ฝ่ายเราใบอื่นที่ Stand อยู่ (ใบที่นอนโจมตีไม่ได้อยู่แล้ว) ได้รับความสามารถโจมตีได้ทันที และโจมตี Avatar ได้โดยตรง (แม้ฝ่ายตรงข้ามมี Unit ที่ Stand) จนจบเทิร์น แล้วถูกทำลายตอนจบเทิร์น "โจมตีโดยตรง" ไม่ข้ามผลบังคับโจมตี Unit (taunt)';
NOTES['SD05-007'] = 'ADVENT ให้ Unit "ฮัสซัน" ทุกใบที่อยู่บนสนามตอนนั้น (รวมใบนี้) โจมตีได้ทันทีจนจบเทิร์น Unit "ฮัสซัน" ที่ลงมาหลังจากนั้นไม่ได้รับ ชื่อเพิ่มเติม "ฮัสซัน" ถือว่าเป็นชื่อของการ์ดทุกโซน ไม่ใช่เฉพาะบนสนาม';
NOTES['SD05-008'] = 'การ์ดจากกองทิ้งเป็นได้เฉพาะ Unit (เพราะลง Action Zone ได้เฉพาะ Unit) และนำลงสนามแบบไม่อัญเชิญ (ADVENT ของใบนั้นไม่ทำงาน) ถ้าฝ่ายตรงข้ามไม่มี Unit หรือ Action Zone เต็ม ตัวเลือกนั้นเลือกไม่ได้';
NOTES['SD05-009'] = 'ทำงานทุกครั้งที่จบเทิร์น (ทั้งของเราและฝ่ายตรงข้าม) กับ Unit ทุกใบของทั้งสองฝ่าย รวมใบนี้ ลด DEF ถาวรครั้งละ 1 ข้าม Unit ที่ DEF เหลือ 0 อยู่แล้ว (ไม่สะสมค่าติดลบ)';
NOTES['SD05-010'] = 'ใช้ตอบโต้ได้เมื่อฝ่ายตรงข้ามประกาศโจมตี ต้องมี Unit ของเราอย่างน้อย 1 ใบ เลือก Unit ขึ้นมือ (Equipment ของ Unit นั้นลงกองทิ้ง) แล้วการโจมตียกเลิก';
NOTES['SD05-011'] = 'ใช้ตอบโต้ได้กับทุกอย่างที่ฝ่ายตรงข้ามทำ ต้องมี Unit ฝ่ายตรงข้ามที่ ATK ≤ 3';
NOTES['SD05-013'] = 'ร่ายได้เมื่อมี Unit "ฮัสซัน" ฝ่ายเรา ทำลาย 1 ใบ (ADMONISH ของใบนั้นทำงานตามปกติ) จั่ว 1 ใบ เปิด 5 ใบบนสุด เลือก Unit "ฮัสซัน" สูงสุด 2 ใบลงสนามโดยไม่จ่าย Cost และ ADVENT ทำงาน ใบที่ลงไม่ได้ (Action Zone เต็ม) กับที่เหลือเรียงไว้ใต้ Main Deck ตามที่ผู้เล่นเลือก';
NOTES['SD05-014'] = 'ค่าร่ายคือพลังชีวิต 1 หน่วย (ร่ายไม่ได้ถ้า HP ≤ 1) ไม่มีค่า Element';
NOTES['SD05-015'] = 'ค่าใช้จ่ายของ ACTIVATE คือพลังชีวิต 1 หน่วย (ใช้ไม่ได้ถ้า HP ≤ 1) "โจมตีได้ทันทีแม้จะพึ่งลงมา" = flag haste ในเทิร์นนี้';
NOTES['SD05-016'] = 'เลือก Unit "ฮัสซัน" ที่ Cost ≤ 2 จากกองทิ้งขึ้นมือ (มังกรมี Cost 5 จึงไม่เข้าเงื่อนไข)';
NOTES['SD05-017'] = 'ค่าร่ายคือพลังชีวิต 1 หน่วย Unit ที่สวมใส่ได้ CRI +1 เมื่อผู้สวมออกจากสนาม (ถูกทำลาย/กลับมือ/ทิ้ง) เจ้าของเลือก Unit ใบอื่นที่ยังไม่มี Equipment สวมต่อ และ CRI ที่ให้เพิ่มอีก 1 ต่อการย้ายหนึ่งครั้ง (+1, +2, +3 …) ถ้าไม่มี Unit ให้สวมต่อ การ์ดลงกองทิ้ง';
NOTES['SD05-018'] = 'นำ Unit ขึ้นมือสำเร็จแล้ว เปลี่ยน Element ที่ Rest เป็น Stand สูงสุด 2 ใบ (ถ้ามีเพียง 1 ใบก็ 1 ใบ) ระบบเลือก Element ให้อัตโนมัติ';
NOTES['SD05-019'] = 'ใช้ได้เมื่อฝ่ายตรงข้ามมี Unit ให้เลือก ทำลาย Unit แล้วสร้างความเสียหาย 3 ต่อพลังชีวิตฝ่ายตรงข้ามเสมอ (แม้ Unit นั้นรอดจากการทำลาย) ค่าร่ายลดได้จาก Avatar ฮัสซัน อิ ซับบาห์';

})(globalThis.AF = globalThis.AF || {});
