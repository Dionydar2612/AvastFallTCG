/* AvastFall TCG – สคริปต์เอฟเฟกต์การ์ดชุด SD04 Savage Gladiator
   หนึ่งการ์ด = FX[id] หนึ่งรายการ + (ถ้าจำเป็น) NOTES[id] อธิบายการตีความ
   ถ้าแก้ข้อความการ์ดใน card-api ให้แก้สคริปต์ตรงนี้ แล้วอัปเดตข้อความใน js/data/snapshot.js ให้ตรงกัน */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {}, NOTES = AF.notes = AF.notes || {};
const opp = AF.opp, stat = AF.stat, place = AF.place, log = AF.log;
const hasName = AF.hasName, tribeHas = AF.tribeHas, addMod = AF.addMod;
const fxOf = c => FX[c.def.id] || {};
const { killAdvent, killSpell, myHasName, isKnight, prophecyAb, enterByEffect } = AF.fxKit;

/* =============================================================== SD04 Savage Gladiator */
const isGlad = c => tribeHas(c, 'นักสู้กลาดิเอเตอร์');
const hasteOk = (G, u) => u.state === 'stand' && u.enteredTurn === G.turn && !AF.hasFlag(u, 'haste') && !u.def.fx.some(f => f[0] !== 'COST' && f[1]);
const armTargets = (G, p, w) => AF.equipTargets(G, p, w).filter(isGlad);
const lockUnits = (G, self, locks) => { if (locks.length) self.linger = { expire: Infinity, locks }; };
FX['SD04-001'] = {
  abilities: [
    { id: 'haste', kw: 'AUTO', zone: 'avatar', uses: 4, spend: 2, label: '[Spend 2] Unit ที่ไม่มีความสามารถ โจมตีได้ทันที',
      can: ({ G, p }) => H.myUnits(G, p, u => hasteOk(G, u)).length > 0,
      targets: async ({ G, p }) => (await H.pickUnit(G, p, H.myUnits(G, p, u => hasteOk(G, u)), 'เลือก Unit ที่ไม่มีความสามารถ เพื่อให้โจมตีได้ทันที')) || false,
      resolve: async ({ G, p }, u) => { if (u && u.zone === 'field') { addMod(G, u, { flag: 'haste', until: 'turnEnd' }); log(G, `${u.def.name} โจมตีได้ทันทีในเทิร์นนี้`, p); } } },
    { id: 'arm', kw: 'ACTIVATE 1/turn', zone: 'avatar', label: 'สวมใส่อาวุธจากกองทิ้งให้ นักสู้กลาดิเอเตอร์ (จบเทิร์นทำลาย Unit นั้น)',
      can: ({ G, p }) => G.players[p].equipTurn !== G.turn && G.players[p].discard.some(c => c.def.kind === 'Equipment' && tribeHas(c, 'อาวุธ') && armTargets(G, p, c).length),
      targets: async ({ G, p }) => {
        const ws = G.players[p].discard.filter(c => c.def.kind === 'Equipment' && tribeHas(c, 'อาวุธ') && armTargets(G, p, c).length);
        const [w] = await H.pickCards(G, p, { title: 'เลือก Equipment เผ่า "อาวุธ" จากกองทิ้ง', cards: ws });
        if (!w) return false;
        const u = await H.pickUnit(G, p, armTargets(G, p, w), `เลือก Unit "นักสู้กลาดิเอเตอร์" ที่จะสวมใส่ ${w.def.name}`);
        return u ? { w, u } : false;
      },
      resolve: async ({ G, p }, t) => {
        if (!t || t.w.zone !== 'discard' || t.u.zone !== 'field' || !armTargets(G, p, t.w).includes(t.u)) return;
        AF.attach(G, t.w, t.u); addMod(G, t.u, { doomEnd: true, until: 'perm' });
        log(G, `${t.u.def.name} สวมใส่ ${t.w.def.name} (จะถูกทำลายเมื่อจบเทิร์น)`, p, { equip: t.w.uid });
      } }],
  on: { turnEnd: async ({ G, self, p, player }) => {
    if (player !== p) return;
    for (const u of H.myUnits(G, p, x => x.mods.some(m => m.doomEnd))) { log(G, `${u.def.name} ถูกทำลายเมื่อจบเทิร์น (ผลของ ${self.def.name})`, p); await H.destroy(G, u, { kind: 'effect', player: p, source: self }); }
  } }
};
FX['SD04-010'] = {
  spell: { resolve: async ({ G, p, self }) => {
    const all = [...G.players[p].field, ...G.players[opp(p)].field].filter(u => u && (u.owner === p || H.targetable(G, u, self, p)));
    const u = await H.pickUnit(G, p, all, 'พันธนาการ: เลือก Unit 1 ใบ (จะไม่สามารถเปลี่ยนสภาพเป็น Stand ได้)');
    if (!u) { log(G, 'ไม่มี Unit ให้เลือก', p); return; }
    lockUnits(G, self, [u]); log(G, `${u.def.name} ถูกพันธนาการ — ไม่สามารถเปลี่ยนสภาพเป็น Stand ได้`, p);
  } },
  on: { turnEnd: async ({ G, self, p, player }) => { if (player === p && self.zone === 'magic' && self.linger) { log(G, `${self.def.name}: จบเทิร์น จั่วการ์ด 1 ใบ`, p); H.draw(G, p, 1); } } }
};
FX['SD04-011'] = { spell: { resolve: async ({ G, p, self }) => {
  const mine = await H.pickUnit(G, p, H.myUnits(G, p), 'แสงยามอัสดง: เลือก Unit ฝ่ายเรา 1 ใบ');
  const theirs = await H.pickUnit(G, p, H.oppUnits(G, p, null, self), 'แสงยามอัสดง: เลือก Unit ฝ่ายตรงข้าม 1 ใบ');
  const locks = [];
  for (const u of [mine, theirs]) if (u && u.zone === 'field') { u.state = 'rest'; locks.push(u); log(G, `${u.def.name} เปลี่ยนเป็นสภาพนอน และไม่สามารถเป็น Stand ได้`, p); }
  lockUnits(G, self, locks);
} } };
/* หยั่งเชิง — ร่ายได้เมื่อไม่มีการ์ดชื่อเดียวกันในกองทิ้งของเรา
   คงอยู่ใน Magic Area 3 เทิร์นของคู่ต่อสู้ (นับเฉพาะเทิร์นคู่ต่อสู้) ระหว่างนั้น Unit ทั้งสองฝ่ายประกาศโจมตีไม่ได้ */
FX['SD04-012'] = {
  spell: {
    can: ({ G, p, self }) => !G.players[p].discard.some(c => c.def.name === self.def.name), cantReason: 'มีการ์ดชื่อ "หยั่งเชิง" อยู่ในกองทิ้งของคุณแล้ว',
    resolve: async ({ G, p, self }) => {
      self.linger = { expire: Infinity, oppTurns: 3 };   // นับถอยหลังเฉพาะเมื่อจบเทิร์นของฝ่ายตรงข้าม
      log(G, `${self.def.name} ค้างอยู่ใน Magic Area 3 เทิร์นของฝ่ายตรงข้าม — ทุก Unit ประกาศโจมตีไม่ได้`, p);
    }
  },
  lockAttacks: true,
  on: { turnEnd: async ({ G, self, p, player }) => {
    if (player === p || self.zone !== 'magic' || !self.linger || self.linger.oppTurns == null) return;
    self.linger.oppTurns--;
    if (self.linger.oppTurns > 0) { log(G, `${self.def.name}: เหลืออีก ${self.linger.oppTurns} เทิร์นของฝ่ายตรงข้าม`, p); return; }
    place(G, self, 'discard'); log(G, `${self.def.name} สิ้นสุดผล (ครบ 3 เทิร์นของฝ่ายตรงข้าม) และลงกองทิ้ง`, p);
  } }
};
FX['SD04-013'] = { counter: { life: 4,
  when: (G, r, last) => last.controller !== r && AF.freeSlot(G.players[r]) && G.players[r].hand.some(c => c.def.kind === 'Unit' && !fxOf(c).cantSummonFromHand),
  resolve: async ({ G, p }) => {
    const us = G.players[p].hand.filter(c => c.def.kind === 'Unit' && !fxOf(c).cantSummonFromHand);
    const [c] = await H.pickCards(G, p, { title: 'รุกชน: เลือก Unit บนมือเพื่ออัญเชิญลงสนาม', cards: us });
    if (!c) return;
    if (await enterByEffect(G, p, c, { adv: true }) && c.zone === 'field') { addMod(G, c, { def: 8, flag: 'taunt', until: 'perm' }); log(G, `${c.def.name} ได้รับ DEF +8 — ฝ่ายตรงข้ามต้องทำลายก่อนเสมอ`, p); }
  } } };
FX['SD04-014'] = { counter: {
  when: (G, r, last) => last.kind === 'attack' && last.controller !== r && last.target !== 'avatar' && last.target.owner === r && stat(G, last.attacker, 'atk') < stat(G, last.target, 'atk'),
  resolve: async ({ G, p, target }) => {
    const t = target && target.target; if (!t || t === 'avatar' || t.zone !== 'field') return;
    const a = stat(G, t, 'atk'), d = stat(G, t, 'def');
    addMod(G, t, { atk: d - a, def: a - d, until: 'battle' }); log(G, `${t.def.name}: สลับ ATK/DEF (ATK ${d} / DEF ${a}) จนจบการต่อสู้`, p);
  } } };
/* ลุ่มหลง ในโลกีย์ — Counter: ทำลาย Unit ของเรา 1 ใบ จากนั้นจั่ว 4 ใบ (การจั่วไม่ขึ้นกับว่าทำลายสำเร็จหรือไม่) */
FX['SD04-015'] = { counter: {
  when: (G, r, last) => last.controller !== r && G.players[r].field.some(Boolean),
  resolve: async ({ G, p, self }) => {
    const mine = H.myUnits(G, p);
    if (mine.length) {
      const u = await H.pickUnit(G, p, mine, 'ลุ่มหลง ในโลกีย์: เลือก Unit ของคุณเพื่อทำลาย');
      if (u) await H.destroy(G, u, { kind: 'effect', player: p, source: self });
    } else log(G, 'ไม่มี Unit ของคุณให้ทำลาย', p);
    H.draw(G, p, 4);
  } } };
FX['SD04-016'] = { equip: { atk: 3, noEffectDestroy: true } };
FX['SD04-017'] = { equip: { atk: 3 }, on: { attackSuccess: async ({ G, self, p, attacker, target, destroyed }) => {
  if (self.host && attacker === self.host && (target === 'avatar' || destroyed)) H.healAvatar(G, p, 1); } } };
FX['SD04-018'] = { fieldLimit: 1, domainEnter: async ({ G, p, self }) => {
  for (const q of [p, opp(p)]) {
    const us = H.myUnits(G, q); if (us.length < 2) continue;
    const keep = await H.pickUnit(G, q, us, 'สถานที่แห่งเกียรติยศ: เลือก Unit 1 ใบที่จะเก็บไว้ (ที่เหลือลงกองทิ้ง)');
    for (const u of us) if (u !== keep && u.zone === 'field') { H.removeUnit(G, u, 'discard'); log(G, `${u.def.name} ถูกทิ้งลงกองทิ้ง`, q); }
  } } };
FX['SD04-019'] = { ultimate: {
  can: ({ G, p }) => !G.players[opp(p)].field.some(Boolean),
  resolve: async ({ G, p }) => { if (G.players[opp(p)].field.some(Boolean)) { log(G, 'ฝ่ายตรงข้ามมี Unit บนสนาม ไม่เกิดผล', p); return; } H.damageAvatar(G, opp(p), 1); } } };

/* ------------------------------------------------------------- คำอธิบายการตีความ (แสดงในหน้า "ข้อสังเกต" และตัวตรวจการ์ด) */
NOTES["SD04-001"] = "AUTO ตีความเป็นความสามารถที่สั่งใช้เองใน Main Phase: จ่าย 2 Element เลือก Unit ที่ \"ไม่มีข้อความความสามารถ\" ให้โจมตีได้ในเทิร์นที่ลงสนาม (ทำได้หลายครั้งต่อเทิร์น ครั้งละ 1 Unit) ACTIVATE: การสวมใส่ด้วยความสามารถนี้ไม่ต้องจ่าย EquipCost นับเป็นการสวมใส่ Equipment ในเทิร์นนั้น ถ้าสวม ดาบกลาดิอุส จะไม่ถูกทำลายตอนจบเทิร์น (เพราะดาบกันการทำลายด้วยความสามารถ)";
NOTES["SD04-010"] = "เลือก Unit ได้ทั้งสองฝ่าย ล็อกเฉพาะการกลับเป็น Stand (Unit ที่ Stand อยู่แล้วยัง Stand ต่อ) ถ้า Unit ออกจากสนามด้วยวิธีอื่น (เช่น กลับขึ้นมือ) การ์ดนี้ลงกองทิ้งด้วย";
NOTES["SD04-011"] = "ตีความ \"เลือก Unit ฝั่งละ 1 ใบ\" ว่าผู้ร่ายเลือก Unit ฝ่ายเรา 1 ใบ และฝ่ายตรงข้าม 1 ใบ การ์ดค้างจนกว่า Unit ที่ถูกเลือกทั้งหมดจะออกจากสนาม (แต่ละใบถูกล็อกจนกว่าตัวเองจะถูกทำลาย)";
NOTES["SD04-012"] = "นับเฉพาะเทิร์นของฝ่ายตรงข้าม 3 เทิร์น (นับถอยหลังทุกครั้งที่จบเทิร์นของฝ่ายตรงข้าม) การ์ดลงกองทิ้งเมื่อจบเทิร์นที่ 3 ของฝ่ายตรงข้าม ระหว่างนั้นทุก Unit ของทั้งสองฝ่ายประกาศโจมตีไม่ได้ ร่ายได้เฉพาะเมื่อไม่มีการ์ดชื่อ \"หยั่งเชิง\" ในกองทิ้งของคุณ การโจมตีที่เกิดจากเอฟเฟกต์ (เช่น Ultimate) ไม่ถูกห้าม";
NOTES["SD04-013"] = "ค่าร่ายคือจ่ายพลังชีวิต 4 หน่วย (ใช้ไม่ได้ถ้า HP ≤ 4) ใช้ตอบโต้ได้กับทุกอย่างที่ฝ่ายตรงข้ามทำ การ์ดไม่ได้ระบุจังหวะ \"อัญเชิญ\" ตีความว่าไม่ต้องจ่าย Cost และ ADVENT ทำงาน (ยกเว้นการ์ดที่ห้ามอัญเชิญจากมือ) \"ต้องทำลายก่อนเสมอ\" = ฝ่ายตรงข้ามประกาศโจมตีได้เฉพาะ Unit นั้นจนกว่าจะหมดไป (โจมตี Avatar ไม่ได้)";
NOTES["SD04-014"] = "ไม่มีค่าร่ายพิมพ์ไว้บนการ์ด ระบบจึงนับเป็น 0 Element การสลับ ATK/DEF มีผลจนจบการต่อสู้ครั้งนั้น (ไม่ได้ระบุระยะเวลา)";
NOTES["SD04-015"] = "ใช้ตอบโต้ได้กับทุกอย่างที่ฝ่ายตรงข้ามทำ (ต้องมี Unit ของคุณอย่างน้อย 1 ใบจึงจะใช้ได้) เลือกทำลาย Unit ของคุณ 1 ใบ จากนั้นจั่ว 4 ใบเสมอ ตามข้อความ \"จากนั้น\" ไม่ขึ้นกับว่าทำลายสำเร็จหรือไม่ (เช่น Unit ที่กันการทำลายจากเอฟเฟกต์ก็ยังจั่ว)";
NOTES["SD04-018"] = "เมื่อวางการ์ด ฝ่ายที่มี Unit มากกว่า 1 ใบ ต้องเลือกเก็บไว้ 1 ใบ ที่เหลือลงกองทิ้ง (เจ้าของ Unit เป็นผู้เลือก เริ่มจากเจ้าของการ์ด) ฝ่ายที่มี Unit 1 ใบอยู่แล้วไม่ต้องทิ้ง ระหว่างที่การ์ดอยู่ ทั้งสองฝ่ายมี Unit บน Action Zone ได้สูงสุด 1 ใบ";
NOTES["SD04-019"] = "ใช้ได้เฉพาะเมื่อสนามฝ่ายตรงข้ามไม่มี Unit (ระบบกันการใช้พลาด)";

})(globalThis.AF = globalThis.AF || {});
