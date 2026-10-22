/* AvastFall TCG – ตัวช่วยที่สคริปต์การ์ดทุกชุดใช้ร่วมกัน (โหลดก่อน sd01–sd04) */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {};
const opp = AF.opp, stat = AF.stat, place = AF.place, log = AF.log;
const hasName = AF.hasName, tribeHas = AF.tribeHas, addMod = AF.addMod;
const fxOf = c => FX[c.def.id] || {};

/* shared helpers ------------------------------------------------------- */
H.removeUnit = (G, u, dest) => { // send a unit off the field WITHOUT destroying it (equipment -> discard)
  const eq = [...u.equips];
  place(G, u, dest);
  return AF.releaseEquips(G, u, eq, 'discard');   // Equipment ปกติลงกองทิ้งทันที (ซิงก์) ยกเว้นที่ตามไปสวมต่อ (followHost) จะถามต่อแบบ async
};
const killAdvent = maxDef => ({
  targets: async ({ G, p, self }) => {
    const c = H.oppUnits(G, p, u => stat(G, u, 'def') <= maxDef, self);
    if (!c.length) return false;
    return (await H.pickUnit(G, p, c, `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่ DEF ≤ ${maxDef} เพื่อทำลาย`)) || false;
  },
  resolve: async ({ G, p, self }, u) => { if (u && u.zone === 'field') return H.destroy(G, u, { kind: 'effect', player: p, source: self }); }
});
const killSpell = maxDef => ({
  resolve: async ({ G, p, self }) => {
    const c = H.oppUnits(G, p, u => stat(G, u, 'def') <= maxDef, self);
    const u = await H.pickUnit(G, p, c, `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่ DEF ≤ ${maxDef} เพื่อทำลาย`);
    if (u) await H.destroy(G, u, { kind: 'effect', player: p, source: self }); else log(G, 'ไม่มีเป้าหมายที่เข้าเงื่อนไข', p);
  }
});
const myHasName = (G, p, s) => G.players[p].field.some(u => u && hasName(G, u, s));
const isKnight = c => tribeHas(c, 'อัศวินโต๊ะกลม');
const prophecyAb = (label, resolve, extra = {}) => Object.assign({ id: 'proph', kw: 'ACTIVATE 1/turn', prophecy: true, label, zone: 'field', resolve }, extra);
const enterByEffect = async (G, p, card, o = {}) => {
  const ok = await H.enterField(G, p, card, Object.assign({ byEffect: true, effectOwner: p }, o));
  if (!ok && card.zone !== 'field') place(G, card, card.zone === 'deck' ? 'deckBottom' : 'discard');
  return ok;
};

AF.fxKit = { killAdvent, killSpell, myHasName, isKnight, prophecyAb, enterByEffect };
})(globalThis.AF = globalThis.AF || {});
