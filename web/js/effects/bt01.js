/* AvastFall TCG – สคริปต์เอฟเฟกต์การ์ดชุด BT01
   หนึ่งการ์ด = FX[id] หนึ่งรายการ + NOTES[id] อธิบายการตีความ
   ถ้าแก้ข้อความการ์ดใน card-api ให้แก้สคริปต์ตรงนี้ แล้วอัปเดตข้อความใน js/data/snapshot.js ให้ตรงกัน */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {}, NOTES = AF.notes = AF.notes || {};
const log = AF.log, place = AF.place;

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

NOTES['BT01-001'] = 'AUTO: Unit ฝ่ายเราที่นอนอยู่ประกาศโจมตีได้ ข้อความการ์ดระบุว่า Unit ที่เพิ่งลงสนามได้รับผลนี้เช่นกัน (ผลนี้ตามไปทุกใบที่ลงสนามหลังจากมี Avatar ใบนี้ ไม่ได้จำกัดเฉพาะใบที่อยู่ในสนามตอนแรก) การทำงานเหมือนเดิม ข้อความเพิ่มมาเพื่อให้ชัดเจนเท่านั้น (ยังต้องไม่ใช่ Unit ที่เพิ่งลงสนามในเทิร์นนี้ ยกเว้นมีความสามารถโจมตีได้ทันที) ตีความให้ Unit แต่ละใบประกาศโจมตีด้วยวิธีนี้ได้ครั้งเดียวต่อเทิร์น ไม่งั้นจะโจมตีวนซ้ำไม่จำกัด ACTIVATE: ส่ง 3 ใบบนสุดลงกองทิ้ง (ถ้าเหลือน้อยกว่า 3 ส่งเท่าที่มี) นับเฉพาะการ์ดประเภท Unit แล้วทำลาย Unit ฝ่ายตรงข้าม 1 ใบที่ Cost เท่ากับจำนวนนั้น (Cost ตามที่พิมพ์บนการ์ด) ถ้าไม่มี Unit ที่ตรงเงื่อนไข การ์ดที่ส่งลงกองทิ้งแล้วไม่คืน เลือกใช้ได้เมื่อ Main Deck มีการ์ดอย่างน้อย 1 ใบ';
})(globalThis.AF = globalThis.AF || {});
