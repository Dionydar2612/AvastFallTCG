/* AvastFall TCG – สคริปต์เอฟเฟกต์การ์ดชุด SD01 Storm Thunder
   หนึ่งการ์ด = FX[id] หนึ่งรายการ + (ถ้าจำเป็น) NOTES[id] อธิบายการตีความ
   ถ้าแก้ข้อความการ์ดใน card-api ให้แก้สคริปต์ตรงนี้ แล้วอัปเดตข้อความใน js/data/snapshot.js ให้ตรงกัน */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {}, NOTES = AF.notes = AF.notes || {};
const opp = AF.opp, stat = AF.stat, place = AF.place, log = AF.log;
const hasName = AF.hasName, tribeHas = AF.tribeHas, addMod = AF.addMod;
const fxOf = c => FX[c.def.id] || {};
const { killAdvent, killSpell, myHasName, isKnight, prophecyAb, enterByEffect } = AF.fxKit;

/* =============================================================== SD01 Storm Thunder */
FX['SD01-001'] = { abilities: [{
  id: 'zap', kw: 'ACTIVATE 1/turn', label: '[Spend 2] ทำลาย Unit DEF ≤ 3', zone: 'avatar', spend: 2,
  can: ({ G, p, self }) => H.oppUnits(G, p, u => stat(G, u, 'def') <= 3, self).length > 0,
  targets: killAdvent(3).targets, resolve: killAdvent(3).resolve }] };
FX['SD01-003'] = { admonish: async ({ G, p }) => { H.draw(G, p, 1); } };
FX['SD01-004'] = { advent: {
  targets: killAdvent(2).targets,
  resolve: async ({ G, p, self }, u) => {
    const ok = await killAdvent(2).resolve({ G, p, self }, u);
    if (ok && self.zone === 'field' && myHasName(G, p, 'ทันโยสเตอร์')) { addMod(G, self, { def: 1, until: 'perm' }); log(G, `${self.def.name} ได้รับ DEF +1 ถาวร`, p); }
  } } };
FX['SD01-005'] = {
  advent: { resolve: async ({ G, p }) => { await H.digTop(G, p, { n: 5, title: 'เลือก "ทันกริสนีร์" หรือ "มโยลเนียร์" 1 ใบ', filter: c => c.def.name.includes('ทันกริสนีร์') || c.def.name.includes('มโยลเนียร์') }); } },
  on: { unitDestroyed: async ({ G, self, p, owner }) => { if (owner === opp(p) && myHasName(G, p, 'ทันกริสนีร์')) { addMod(G, self, { atk: 1, until: 'perm' }); log(G, `${self.def.name} ได้รับ ATK +1 ถาวร`, p); } } }
};
FX['SD01-007'] = { on: { unitDestroyed: async ({ G, self, p, owner }) => {
  if (owner === opp(p) && self.flags.modi !== G.turn) { self.flags.modi = G.turn; addMod(G, self, { cri: 1, until: 'perm' }); log(G, `${self.def.name} ได้รับ CRI +1 ถาวร`, p); } } } };
FX['SD01-008'] = { advent: killAdvent(3) };
FX['SD01-009'] = { returnOnBattleDestroy: true };
FX['SD01-010'] = {
  advent: { resolve: async ({ G, p, self }) => {
    const P = G.players[p];
    if (!P.avatar.card.def.name.includes('ธอร์')) { log(G, 'Avatar ของเราไม่ได้ชื่อ "ธอร์" ADVENT ไม่เกิดผล', p); return; }
    const c = P.hand.filter(x => x.def.kind === 'Equipment' && x.def.name.includes('มโยลเนียร์'));
    if (!c.length || self.zone !== 'field') { log(G, 'ไม่มี มโยลเนียร์ บนมือ', p); return; }
    const [m] = await H.pickCards(G, p, { title: 'เลือก มโยลเนียร์ ที่จะสวมใส่', cards: c });
    AF.attach(G, m, self); log(G, `${self.def.name} สวมใส่ ${m.def.name} (ไม่ต้องจ่าย Cost)`, p, { equip: m.uid });
  } },
  extraNames: (G, u) => u.equips.some(e => e.def.name === 'มโยลเนียร์') ? ['ธอร์'] : []
};
FX['SD01-011'] = { advent: killAdvent(4) };
FX['SD01-012'] = { on: { attackSuccess: async ({ G, self, p, attacker, destroyed }) => {
  if (attacker === self && destroyed && self.zone === 'field') { if (AF.setStand(G, self)) log(G, `${self.def.name} กลับเป็น Stand และโจมตีได้อีกครั้ง`, p); } } } };
FX['SD01-013'] = { spell: killSpell(1) };
FX['SD01-014'] = { spell: { resolve: async ({ G, p }) => {
  const got = await H.digTop(G, p, { n: 3, title: 'เลือก Unit เผ่า "บุตรแห่งธอร์" หรือ "สหายแห่งธอร์" ที่ Cost ≤ 2 นำลงสนาม', dest: 'field',
    filter: c => c.def.kind === 'Unit' && c.def.cost <= 2 && (tribeHas(c, 'บุตรแห่งธอร์') || tribeHas(c, 'สหายแห่งธอร์')) });
  for (const c of got) await enterByEffect(G, p, c);
} } };
FX['SD01-015'] = { spell: { resolve: async ({ G, p }) => { await H.search(G, p, { title: 'เลือกการ์ดเผ่า "อาวุธ" 1 ใบจาก Main Deck', filter: c => tribeHas(c, 'อาวุธ') }); } } };
FX['SD01-016'] = {
  equip: { def: 2, canEquip: (G, u) => hasName(G, u, 'ธอร์'), extra: (G, u) => u.equips.length === 1 && u.equips[0].def.name.includes('มโยลเนียร์') },
  abilities: [{ id: 'smite', kw: 'ACTIVATE 1/turn', zone: 'equip', label: 'ทำลาย Unit ที่ ATK ต่ำกว่าผู้สวมใส่',
    can: ({ G, p, self }) => !!self.host && H.oppUnits(G, p, u => stat(G, u, 'atk') < stat(G, self.host, 'atk'), self).length > 0,
    targets: async ({ G, p, self }) => (await H.pickUnit(G, p, H.oppUnits(G, p, u => stat(G, u, 'atk') < stat(G, self.host, 'atk'), self), 'เลือก Unit ฝ่ายตรงข้ามที่ ATK ต่ำกว่าผู้สวมใส่')) || false,
    resolve: async ({ G, p, self }, u) => { if (u && u.zone === 'field') await H.destroy(G, u, { kind: 'effect', player: p, source: self }); } }]
};
FX['SD01-017'] = { equip: { atk: 2, canEquip: (G, u) => hasName(G, u, 'ธอร์'), returnAllOnHostDestroyed: true } };
FX['SD01-018'] = { aura: { def: (G, self, u) => (u.owner !== self.owner && u.def.cost < 4 && myHasName(G, self.owner, 'ทันกริสนีร์') && myHasName(G, self.owner, 'ทันโยสเตอร์')) ? -1 : 0 } };
FX['SD01-019'] = { ultimate: { resolve: async ({ G, p, self }) => {
  const all = [...G.players[p].field, ...G.players[opp(p)].field].filter(Boolean);
  log(G, `${self.def.name}: ทำลายการ์ดทุกใบใน Action Zone ของทั้งสองฝ่าย`, p);
  const cnt = [0, 0];   // จำนวนการ์ดของแต่ละฝ่ายที่ถูกทำลายด้วยเอฟเฟกต์นี้สำเร็จ
  for (const u of all) if (u.zone === 'field') { if (await H.destroy(G, u, { kind: 'effect', player: p, source: self })) cnt[u.owner]++; }
  /* ความเสียหายเกิดพร้อมกัน: หัก HP ทั้งสองฝ่ายก่อน แล้วค่อยตรวจแพ้/เสมอครั้งเดียว */
  for (const q of [p, opp(p)]) {
    const n = cnt[q]; if (n <= 0) continue;
    const Q = G.players[q]; Q.avatar.hp -= n;
    log(G, `Avatar ของ ${Q.name} ได้รับ ${n} ดาเมจจากการ์ดของตนที่ถูกทำลาย (HP ${Q.avatar.hp})`, q, { dmg: n });
  }
  AF.checkEnd(G);
} } };

/* ธีอัลฟี (SD01-002) ถูกจัดการในเอนจิน (resolveAttack) จึงไม่มีสคริปต์แยก */
FX['SD01-002'] = FX['SD01-002'] || { builtin: true };

/* ------------------------------------------------------------- คำอธิบายการตีความ (แสดงในหน้า "ข้อสังเกต" และตัวตรวจการ์ด) */
NOTES["SD01-002"] = "ตีความตามตัวอักษร: เมื่อ ATK ของเป้า ≤ DEF ของธีอัลฟี (ปกติ DEF 0) ต้องทิ้งการ์ด 1 ใบจึงจะทำลาย ถ้าไม่มีการ์ดจะโจมตีไม่สำเร็จ ข้อความนี้แทบไม่เกิดผลและเป็นข้อเสียล้วน อาจตั้งใจให้เป็น \"DEF ของเป้า > ATK ของ Unit นี้\" (ตอนนี้ระบบใช้ตามตัวอักษรเสมอ)";
NOTES["SD01-019"] = "ทำลายทุก Unit ใน Action Zone ของทั้งสองฝ่าย แล้วแต่ละฝ่ายเสีย HP เท่ากับจำนวนการ์ดของฝ่ายตนที่ถูกทำลายสำเร็จด้วยเอฟเฟกต์นี้ (Unit ที่ไม่ถูกทำลาย เช่น มีผลป้องกัน ไม่นับ) ความเสียหายเกิดพร้อมกัน ถ้า HP ของทั้งสองฝ่ายเหลือ 0 พร้อมกันถือว่าเสมอ";
NOTES["SD01-005"] ="ชื่อ \"มโยลเนียร์\" จับคู่กับ \"ผู้ถือครอง มโยลเนียร์\" ด้วย เพราะชื่อมีคำนี้";
NOTES["SD01-010"] = "ADVENT สวมใส่ มโยลเนียร์ ฟรี และเป็นทางเดียวที่ มโยลเนียร์ จะลงสนามได้ เพราะ มโยลเนียร์ ต้องสวมที่การ์ดชื่อ \"ธอร์\" แต่ Unit ที่ได้ชื่อ \"ธอร์\" คือใบนี้เองหลังสวมแล้ว";
NOTES["SD01-017"] = "สวมใส่ด้วย EquipCost ไม่ได้ในทางปฏิบัติ ต้องมาจาก ADVENT ของ ผู้ถือครอง มโยลเนียร์";

})(globalThis.AF = globalThis.AF || {});
