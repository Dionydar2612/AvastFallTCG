/* AvastFall TCG – สคริปต์เอฟเฟกต์การ์ดชุด SD03 The Foundation of Camelot
   หนึ่งการ์ด = FX[id] หนึ่งรายการ + (ถ้าจำเป็น) NOTES[id] อธิบายการตีความ
   ถ้าแก้ข้อความการ์ดใน card-api ให้แก้สคริปต์ตรงนี้ แล้วอัปเดตข้อความใน js/data/snapshot.js ให้ตรงกัน */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {}, NOTES = AF.notes = AF.notes || {};
const opp = AF.opp, stat = AF.stat, place = AF.place, log = AF.log;
const hasName = AF.hasName, tribeHas = AF.tribeHas, addMod = AF.addMod;
const fxOf = c => FX[c.def.id] || {};
const { killAdvent, killSpell, myHasName, isKnight, prophecyAb, enterByEffect } = AF.fxKit;

/* =============================================================== SD03 The Foundation of Camelot */
FX['SD03-001'] = { abilities: [
  { id: 'seek', kw: 'ACTIVATE 1/turn', zone: 'avatar', label: 'เปิด 5 ใบ หาการ์ดชื่อ "เส้นทาง"', can: ({ G, p }) => G.players[p].deck.length > 0,
    resolve: async ({ G, p }) => { await H.digTop(G, p, { n: 5, title: 'เลือกการ์ดที่มีชื่อ "เส้นทาง" 1 ใบ', filter: c => c.def.name.includes('เส้นทาง') }); } },
  { id: 'loot', kw: 'ACTIVATE 1/turn', zone: 'avatar', label: 'ทิ้ง 1 ใบบนมือ แล้วจั่ว 1', can: ({ G, p }) => G.players[p].hand.length > 0,
    pay: async ({ G, p }) => { await H.discardFromHand(G, p, 1); },
    resolve: async ({ G, p }) => { H.draw(G, p, 1); } }] };
FX['SD03-002'] = {
  admonish: async ({ G, p }) => { H.draw(G, p, 1); },
  on: { unitEntered: async ({ G, self, p, unit, byEffect, effectOwner }) => {
    if (unit !== self || !byEffect || effectOwner !== p) return;
    await H.search(G, p, { from: ['deck', 'discard'], title: 'เลือกการ์ดที่มีชื่อ "คาเมลอต" จาก Main Deck หรือกองทิ้ง', filter: c => c.def.name.includes('คาเมลอต') });
  } } };
FX['SD03-003'] = { advent: {
  targets: async ({ G, p, self }) => (await H.pickUnit(G, p, H.oppUnits(G, p, null, self), 'เลือก Unit ฝ่ายตรงข้ามที่จะสูญเสียความสามารถทั้งหมด')) || false,
  resolve: async ({ G, p }, u) => { if (u && u.zone === 'field') { addMod(G, u, { silence: true, until: 'oppTurnEnd' }); log(G, `${u.def.name} สูญเสียความสามารถทั้งหมดจนจบเทิร์นฝ่ายตรงข้าม`, p); } } } };
FX['SD03-004'] = { abilities: [{ id: 'ann', kw: 'ANNOUNCE', zone: 'discard', label: '[กองทิ้ง] ทิ้ง 1 ใบ แล้วลง Action Zone ฟรี',
  can: ({ G, p }) => AF.freeSlot(G.players[p]) && G.players[p].hand.length > 0 && G.players[p].field.some(u => u && u.def.name.includes('กวินีเวียร์')),
  pay: async ({ G, p }) => { await H.discardFromHand(G, p, 1, 'ANNOUNCE เซอร์ แลนเซล็อต: เลือกการ์ดบนมือที่จะทิ้ง'); },
  resolve: async ({ G, p, self }) => { if (self.zone === 'discard') await enterByEffect(G, p, self); } }] };
FX['SD03-005'] = { abilities: [{ id: 'sac', kw: 'ACTIVATE', zone: 'field', label: 'ส่งตัวเองลงกองทิ้ง อัญเชิญ "อาเทอร์" จากกองทิ้ง (นอน)',
  can: ({ G, p }) => G.players[p].discard.some(c => c.def.kind === 'Unit' && c.def.name.includes('อาเทอร์')),
  pay: async ({ G, self }) => { H.removeUnit(G, self, 'discard'); },
  targets: async ({ G, p }) => { const c = G.players[p].discard.filter(x => x.def.kind === 'Unit' && x.def.name.includes('อาเทอร์')); const [a] = await H.pickCards(G, p, { title: 'เลือก "อาเทอร์" จากกองทิ้ง', cards: c }); return a || false; },
  resolve: async ({ G, p }, a) => { if (a && a.zone === 'discard') await enterByEffect(G, p, a, { adv: true, state: 'rest' }); } }] };
FX['SD03-006'] = { on: { attackSuccess: async ({ G, self, p, attacker, target, destroyed }) => {
  if (attacker === self && (target === 'avatar' || destroyed)) H.healAvatar(G, p, 1); } } };
FX['SD03-007'] = {
  advent: { resolve: async ({ G, p }) => {
    const c = G.players[p].deck.filter(isKnight);
    const [k] = await H.pickCards(G, p, { title: 'เลือกการ์ดเผ่า "อัศวินโต๊ะกลม" 1 ใบจาก Main Deck ส่งลงกองทิ้ง', cards: c, kind: 'reveal', ctx: { search: true } });
    if (k) { place(G, k, 'discard'); log(G, `${k.def.name} ถูกส่งลงกองทิ้ง`, p); }
    AF.shuffleDeck(G, p);
    H.draw(G, p, 2);
  } },
  shield: (G, self, u, src) => !(u.owner === self.owner && isKnight(u) && src && src.def && src.def.kind === 'Enchant')
};
FX['SD03-008'] = { advent: { resolve: async ({ G, p }) => { await H.digTop(G, p, { n: 3, title: 'เลือก "ยุทธาการที่คัมลานน์" 1 ใบ', filter: c => c.def.name.includes('ยุทธาการที่คัมลานน์') }); } } };
FX['SD03-009'] = { cantSummonFromHand: true, abilities: [
  { id: 'ann', kw: 'ANNOUNCE', zone: 'hand', label: '[บนมือ] ทิ้งใบนี้ แล้วจั่ว 1',
    pay: async ({ G, self }) => { place(G, self, 'discard'); log(G, `${self.def.name} ถูกทิ้งลงกองทิ้ง`, self.owner); },
    resolve: async ({ G, p }) => { H.draw(G, p, 1); } },
  { id: 'ds', kw: 'ACTIVATE 1/turn', zone: 'field', label: 'ทิ้ง 1 ใบ รับ DoubleStrike', can: ({ G, p }) => G.players[p].hand.length > 0,
    pay: async ({ G, p }) => { await H.discardFromHand(G, p, 1); },
    resolve: async ({ G, self }) => { if (self.zone === 'field') { addMod(G, self, { flag: 'doubleStrike', until: 'turnEnd' }); log(G, `${self.def.name} ได้รับ DoubleStrike (โจมตีได้ 2 ครั้งในเทิร์นนี้)`, self.owner); } } }] };
FX['SD03-010'] = { spell: { resolve: async ({ G, p }) => {
  const got = await H.digTop(G, p, { n: 7, title: 'เลือก "ดาบในหิน" 1 ใบเพื่ออัญเชิญ', dest: 'field', filter: c => c.def.kind === 'Unit' && c.def.name.includes('ดาบในหิน') });
  for (const c of got) await enterByEffect(G, p, c, { adv: true });
} } };
FX['SD03-011'] = { spell: { resolve: async ({ G, p }) => { await H.digTop(G, p, { n: 7, title: 'เลือก Equipment ที่ชื่อมี "ดาบ" 1 ใบ', filter: c => c.def.kind === 'Equipment' && c.def.name.includes('ดาบ') }); } } };
FX['SD03-012'] = { spell: {
  can: ({ G, p }) => myHasName(G, p, 'มอเดร็ท'), cantReason: 'ต้องมี Unit ชื่อ "มอเดร็ท" บนสนาม',
  resolve: async ({ G, p }) => {
    const c = H.myUnits(G, p, u => hasName(G, u, 'มอเดร็ท')).filter(u => H.targetable(G, u, { def: { kind: 'Enchant' } }, p));
    const u = await H.pickUnit(G, p, c, 'เลือก "มอเดร็ท" 1 ใบ');
    if (u) { addMod(G, u, { flag: 'rekill', until: 'turnEnd' }); log(G, `${u.def.name}: เมื่อทำลาย Unit ฝ่ายตรงข้ามสำเร็จ กลับเป็น Stand โจมตีได้อีกครั้ง (จนจบเทิร์น)`, p); }
  } } };
FX['SD03-013'] = {
  spell: {
    can: ({ G, p }) => (G.players[p].castNames || {})['เจตจำนงแห่งคาเมลอต'] !== G.turn, cantReason: 'เทิร์นนี้ใช้ "เจตจำนงแห่งคาเมลอต" ไปแล้ว',
    resolve: async ({ G, p, self }) => { self.linger = { expire: G.turn + 1 }; log(G, `${self.def.name} ค้างอยู่ใน Magic Area จนจบเทิร์นฝ่ายตรงข้าม`, p); }
  },
  on: { unitDestroyed: async ({ G, self, p, owner, unit, by }) => {
    if (owner !== p || !by || by.kind !== 'battle' || G.active !== opp(p)) return;
    const n = isKnight(unit) ? 2 : 1; log(G, `${self.def.name}: Unit ถูกทำลายจากการโจมตี → จั่ว ${n} ใบ`, p); H.draw(G, p, n);
  } }
};
FX['SD03-014'] = { spell: { resolve: async ({ G, p }) => { await H.digTop(G, p, { n: 3, title: 'เลือก "อัศวินโต๊ะกลม" หรือ Equipment 1 ใบ ส่งลงกองทิ้ง', dest: 'discard', filter: c => isKnight(c) || c.def.kind === 'Equipment' }); } } };
FX['SD03-015'] = { spell: {
  can: ({ G, p }) => G.players[p].field.some(u => u && u.equips.length) && G.players[p].discard.some(c => c.def.kind === 'Unit' && isKnight(c)), cantReason: 'ต้องมี Equipment บนสนาม และมี Unit อัศวินโต๊ะกลมในกองทิ้ง',
  resolve: async ({ G, p }) => {
    const eqs = G.players[p].field.filter(Boolean).flatMap(u => u.equips);
    const [e] = await H.pickCards(G, p, { title: 'เลือก Equipment บนสนามของเราเพื่อส่งลงกองทิ้ง', cards: eqs, kind: 'reveal', ctx: { all: eqs } });
    if (!e) return;
    place(G, e, 'discard'); log(G, `${e.def.name} ถูกส่งลงกองทิ้ง`, p);
    const kn = G.players[p].discard.filter(c => c.def.kind === 'Unit' && isKnight(c));
    const [k] = await H.pickCards(G, p, { title: 'เลือก Unit เผ่า "อัศวินโต๊ะกลม" จากกองทิ้งนำลงสนาม (ADVENT ไม่ทำงาน)', cards: kn });
    if (k) await enterByEffect(G, p, k);
  } } };
FX['SD03-016'] = { counter: {
  when: (G, r, last) => last.kind === 'attack' && last.controller !== r,
  resolve: async ({ G, p, target }) => { H.cancel(G, target); } } };
FX['SD03-017'] = {
  equip: { atk: 2, noEffectDestroy: true },
  aura: { atk: (G, self, u, host) => (u !== host && u.owner === self.owner && isKnight(u)) ? 1 : 0, def: (G, self, u, host) => (u !== host && u.owner === self.owner && isKnight(u)) ? 1 : 0 }
};
FX['SD03-018'] = { abilities: [{ id: 'forge', kw: 'ACTIVATE 1/turn', zone: 'domain', label: 'ทำลาย "ดาบในหิน" → อัญเชิญ "อาเทอร์" จากกองทิ้ง + ติด Equipment ศักดิ์สิทธิ์',
  can: ({ G, p }) => myHasName(G, p, 'ดาบในหิน'),
  targets: async ({ G, p }) => (await H.pickUnit(G, p, H.myUnits(G, p, u => hasName(G, u, 'ดาบในหิน')), 'เลือก "ดาบในหิน" ของเราเพื่อทำลาย')) || false,
  resolve: async ({ G, p, self }, sword) => {
    if (sword && sword.zone === 'field') await H.destroy(G, sword, { kind: 'effect', player: p, source: self });
    const P = G.players[p];
    const arth = P.discard.filter(c => c.def.kind === 'Unit' && c.def.name.includes('อาเทอร์'));
    if (!arth.length || !AF.freeSlot(P)) return;
    if (!(await H.yesNo(G, p, 'อัญเชิญ "อาเทอร์" จากกองทิ้งมาที่ Action Zone?'))) return;
    const [a] = await H.pickCards(G, p, { title: 'เลือก "อาเทอร์"', cards: arth });
    if (!a) return;
    if (!(await enterByEffect(G, p, a, { adv: true }))) return;
    const holy = P.hand.filter(c => c.def.kind === 'Equipment' && tribeHas(c, 'ศักดิ์สิทธิ์'));
    if (holy.length && a.zone === 'field') { const [e] = await H.pickCards(G, p, { title: 'เลือก Equipment เผ่า "ศักดิ์สิทธิ์" จากมือเพื่อติดให้ อาเทอร์', cards: holy }); if (e) { AF.attach(G, e, a); log(G, `${a.def.name} สวมใส่ ${e.def.name}`, p, { equip: e.uid }); } }
  } }] };
FX['SD03-019'] = { ultimate: {
  can: ({ G, p }) => G.players[p].field.some(u => u && u.state === 'rest'),
  resolve: async ({ G, p, self }) => {
    const rest = H.myUnits(G, p, u => u.state === 'rest');
    const u = await H.pickUnit(G, p, rest, 'เลือก Unit ฝ่ายเราที่อยู่ในสภาพนอน');
    if (!u) return;
    if (!AF.setStand(G, u)) return; log(G, `${u.def.name} กลับเป็น Stand และโจมตีได้ 1 ครั้ง`, p);
    const camelot = G.players[p].domains.some(d => d.def.name.includes('คาเมลอต')) || G.players[opp(p)].domains.some(d => d.def.name.includes('คาเมลอต'));
    const holy = u.equips.some(e => tribeHas(e, 'ศักดิ์สิทธิ์'));
    if (camelot && holy) { addMod(G, u, { flag: 'atkInf', until: 'battle' }); addMod(G, u, { cri: 3, until: 'battle' }); log(G, `${u.def.name}: ATK อนันต์ และ CRI +3 จนจบการโจมตี`, p); }
    await H.freeAttack(G, p, u);
    if (u.zone === 'field') u.mods = u.mods.filter(m => m.until !== 'battle');
  } } };

/* ------------------------------------------------------------- คำอธิบายการตีความ (แสดงในหน้า "ข้อสังเกต" และตัวตรวจการ์ด) */
NOTES["SD03-009"] = "DoubleStrike ไม่มีในหนังสือกติกา ระบบตีความว่าโจมตีได้ 2 ครั้งในเทิร์นเดียว (หลังโจมตีครั้งแรกกลับเป็น Stand ได้อีกครั้งเดียว)";
NOTES["SD03-012"] = "ผลทำงานจนจบเทิร์น";
NOTES["SD03-013"] = "ตีความ \"ในเทิร์นก่อนของฝ่ายตรงข้าม\" เป็น \"ในเทิร์นถัดไปของฝ่ายตรงข้าม\" การ์ดค้างใน Magic Area จนจบเทิร์นนั้น";
NOTES["SD03-014"] = "ไม่มีค่าร่ายพิมพ์ไว้บนการ์ด ระบบจึงนับเป็น 0 Element";
NOTES["SD03-019"] = "การโจมตีทำเป็นส่วนหนึ่งของ Ultimate ไม่เปิดจังหวะ Counter แยกสำหรับการโจมตี";

})(globalThis.AF = globalThis.AF || {});
