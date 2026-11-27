/* AvastFall TCG – สคริปต์เอฟเฟกต์การ์ดชุด AT01 Avatar of Gods
   หนึ่งการ์ด = FX[id] หนึ่งรายการ + NOTES[id] อธิบายการตีความ
   โหลดหลัง bt01.js (ต้องมี _kit.js เพื่อใช้ H.removeUnit) · ต้องใช้ engine.js ที่เพิ่ม AF.guards แล้ว (ดู engine.patch.txt)

   ที่ยังไม่ได้เขียน: 034 กระจกสะท้อนกรรม (รอกฎเพิ่ม) · 005 AUTO (ทิ้งมือเพื่อใช้ความสามารถ → ดาเมจ 1)
   ต้องใช้ engine.js ที่แพตช์แล้ว (AF.guards, AF.abilityGuards, Avatar โจมตี/สวม Equipment, P.avatar2, Unit 2 ช่อง) */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {}, NOTES = AF.notes = AF.notes || {};
const log = AF.log, place = AF.place, opp = AF.opp, stat = AF.stat, addMod = AF.addMod;
const hasEl = (u, el) => (u.def.els || []).includes(el);
const P_ = (G, p) => G.players[p];
const myUnits = (G, p, f) => H.myUnits(G, p, f);
const killOpp = async (G, p, self, filter, title) => {
  const u = await H.pickUnit(G, p, H.oppUnits(G, p, filter, self), title);
  if (u && u.zone === 'field') await H.destroy(G, u, { kind: 'effect', player: p, source: self });
  return u;
};
const onceTurn = (G, self, key) => { self.flags = self.flags || {}; if (self.flags[key] === G.turn) return false; self.flags[key] = G.turn; return true; };

/* ---------------------------------------------------------------- guards (ใช้กับ engine.patch) */
AF.guards = AF.guards || [];
AF.guards.push((G, u, by) => {
  by = by || { kind: 'effect' };
  // 008 โอซีอานัส: Unit ธาตุน้ำไม่ถูกทำลายจากการ์ดที่ไม่ใช่ Unit
  if (by.kind === 'effect' && hasEl(u, 'น้ำ') && !(by.source && by.source.def.kind === 'Unit')) {
    if (G.players.some(P => P.avatar.card && P.avatar.card.def.id === 'AT01-008' && (P.avatar.card.owner === u.owner || true))) {
      const own = G.players[u.owner].avatar.card; if (own && own.def.id === 'AT01-008') return true;
    }
  }
  // 013 เทียแมท: ถูกทำลายได้ด้วยการต่อสู้เท่านั้น
  if (by.kind === 'effect' && u.def.at01Legend) return true;
  // 002 เฮสเทีย: Unit ธาตุไฟที่ถูกเลือก ไม่ถูกทำลายจนจบเทิร์นถัดไปของอีกฝ่าย
  if (u.mods && u.mods.some(m => m.flag === 'at01Ward')) return true;
  // 043 มงกุฎแห่งเอกภาพ: ไม่ถูกนำออกจาก Action Zone ได้ทุกกรณี
  if (u.equips && u.equips.some(e => e.def.id === 'AT01-043')) return true;
  // 041 โล่เอจิส: ส่งโล่ลงกองทิ้งแทนการถูกทำลาย
  const aegis = u.equips && u.equips.find(e => e.def.id === 'AT01-041');
  if (aegis) { place(G, aegis, 'discard'); log(G, `${aegis.def.name}: ส่งลงกองทิ้งแทน ${u.def.name} จึงไม่ถูกทำลาย`, u.owner); return true; }
  // 045 วิหารแห่งสมดุลนิรันดร์: Unit ที่ ATK = DEF ไม่ถูกทำลายด้วยความสามารถการ์ด
  if (by.kind === 'effect' && stat(G, u, 'atk') === stat(G, u, 'def') && G.players.some(P => P.domains.some(d => d.def.id === 'AT01-045'))) return true;
  return false;
});

/* 029 อูตาร์: ขัดจังหวะความสามารถ Unit ของฝั่งตรงข้าม */
AF.abilityGuards = AF.abilityGuards || [];
AF.abilityGuards.push(async ({ G, p, card, kind }) => {
  if (kind !== 'unit-ability') return false;
  const q = opp(p), Q = P_(G, q);
  for (const w of Q.field) {
    if (!w || w.def.id !== 'AT01-029' || AF.silenced(G, w) || AF.standElems(Q).length < 3) continue;
    if (!(await H.yesNo(G, q, `${w.def.name}: ${P_(G, p).name} ใช้ความสามารถของ ${card.def.name} — จ่าย 3 Element เพื่อยกเลิก?`))) continue;
    await AF.payElems(G, q, 3, null, `${w.def.name}: ยกเลิกความสามารถ`);
    log(G, `${w.def.name}: ยกเลิกความสามารถของ ${card.def.name}`, q);
    if (Q.avatar.hp > 2 && await H.yesNo(G, q, `${w.def.name}: จ่ายพลังชีวิต 2 หน่วยเพื่อลบความสามารถของ ${card.def.name} ออกจาก Text Box?`)) {
      Q.avatar.hp -= 2; log(G, `${Q.name} จ่ายพลังชีวิต 2 หน่วย (HP ${Q.avatar.hp})`, q);
      if (card.zone === 'field') addMod(G, card, { silence: true, until: 'perm' });
    }
    return true;
  }
  return false;
});

/* 039: Banish ตอนจบเทิร์น */
AF.hooks.turnEnd.push(async (G) => {
  const list = G.at01Banish || []; G.at01Banish = [];
  for (const u of list) if (u.zone === 'field') { AF.banish(G, u); log(G, `${u.def.name} ถูก Banish (จุดสูงสุดแห่งการตั้งมั่น)`, u.owner); }
});

/* ================================================================ AVATAR */
FX['AT01-001'] = {
  on: { unitDestroyed: async ({ G, self, p, unit, by }) => {
    if (!by || by.kind !== 'battle' || !by.attacker || by.attacker.owner !== p || unit.owner === p) return;
    if (!onceTurn(G, self, 'yama')) return;
    const d = P_(G, opp(p)).discard; if (!d.length) return;
    const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือกการ์ดในกองทิ้งฝ่ายตรงข้ามเพื่อนำออกจากเกม`, cards: d.slice() });
    if (c) { AF.banish(G, c); log(G, `${self.def.name}: นำ ${c.def.name} ออกจากเกม`, p); }
  } },
  abilities: [{ id: 'weaken', kw: 'ACTIVATE 1/turn', zone: 'avatar', spend: 2, label: '[Spend 2] Unit ฝ่ายตรงข้าม ATK -2 DEF -2 จนจบเทิร์น',
    can: ({ G, p }) => H.oppUnits(G, p).length > 0,
    targets: async ({ G, p, self }) => (await H.pickUnit(G, p, H.oppUnits(G, p, null, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้าม`)) || false,
    resolve: async ({ G, p }, u) => { if (u && u.zone === 'field') addMod(G, u, { atk: -2, def: -2, until: 'turnEnd' }); } }]
};
FX['AT01-002'] = {
  abilities: [{ id: 'ward', kw: 'ACTIVATE 1/turn', zone: 'avatar', spend: 2, label: '[Spend 2] ไฟ: ไม่ถูกทำลายจนจบเทิร์นถัดไปของอีกฝ่าย / ทอง: ทำลาย Unit ที่ถูกโจมตีทันที (ไม่ถูก Counter)',
    can: ({ G, p }) => myUnits(G, p).length > 0,
    targets: async ({ G, p, self }) => (await H.pickUnit(G, p, myUnits(G, p), `${self.def.name}: เลือก Unit ฝ่ายคุณ`)) || false,
    resolve: async ({ G, p }, u) => {
      if (!u || u.zone !== 'field') return;
      if (hasEl(u, 'ไฟ')) addMod(G, u, { flag: 'at01Ward', until: 'oppTurnEnd' });
      if (hasEl(u, 'ทอง')) { addMod(G, u, { flag: 'noCounter', until: 'turnEnd' }); addMod(G, u, { flag: 'at01Smite', until: 'turnEnd' }); }
    } }]
};
FX['AT01-003'] = {
  on: { turnStart: async ({ G, self, p, player }) => {
    if (player !== p) return;
    const c = myUnits(G, p, u => hasEl(u, 'ไฟ') || hasEl(u, 'พืช'));
    if (!c.length) return;
    const u = await H.pickUnit(G, p, myUnits(G, p), `${self.def.name}: เลือก Unit ให้ได้รับ ATK +1 จนจบเทิร์น`, true);
    if (u) addMod(G, u, { atk: 1, until: 'turnEnd' });
  } },
  abilities: [{ id: 'sun', kw: 'ACTIVATE 1/turn', zone: 'avatar', spend: 2, label: '[Spend 2] Unit ไฟ/พืช ATK +2 DEF +1 จนจบเทิร์น',
    can: ({ G, p }) => myUnits(G, p, u => hasEl(u, 'ไฟ') || hasEl(u, 'พืช')).length > 0,
    targets: async ({ G, p, self }) => (await H.pickUnit(G, p, myUnits(G, p, u => hasEl(u, 'ไฟ') || hasEl(u, 'พืช')), `${self.def.name}: เลือก Unit ธาตุไฟหรือพืช`)) || false,
    resolve: async ({ G }, u) => { if (u && u.zone === 'field') addMod(G, u, { atk: 2, def: 1, until: 'turnEnd' }); } }]
};
FX['AT01-004'] = {
  on: {
    turnStart: async ({ G, p, player }) => {   // เริ่มเกม: HP 20 ทั้งสองฝ่าย (ใช้ครั้งเดียวตอนเทิร์นแรก)
      if (G.at01Hp20 || G.turn !== 1) return;
      if (!G.players.some(P => P.avatar.card && P.avatar.card.def.id === 'AT01-004')) return;
      G.at01Hp20 = true; for (const P of G.players) P.avatar.hp = 20;
      log(G, 'กรานนุส: ผู้เล่นทั้งสองมีพลังชีวิต 20 หน่วย', p);
    },
    turnEnd: async ({ G, self, p, player }) => {
      if (player !== p) return;   // ผู้เล่นเจ้าของเทิร์นต้องมีการ์ดบนมือไม่เกิน 3
      const P = P_(G, player); const n = P.hand.length - 3;
      if (n > 0) await H.discardFromHand(G, player, n, `${self.def.name}: ทิ้งการ์ดจนเหลือ 3 ใบ`);
    } },
  abilities: [{ id: 'heal', kw: 'ACTIVATE 1/turn', zone: 'avatar', label: 'ทิ้ง 3 ใบบนสุดของ Main Deck แล้วเลือกการ์ดจากกองทิ้ง 1 ใบขึ้นมือ',
    can: ({ G, p }) => P_(G, p).deck.length >= 3,
    resolve: async ({ G, p, self }) => {
      const P = P_(G, p);
      for (let i = 0; i < 3 && P.deck.length; i++) place(G, P.deck[0], 'discard');
      const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือกการ์ดจากกองทิ้งขึ้นมือ`, cards: P.discard.slice() });
      if (c) place(G, c, 'hand');
    } }]
};
FX['AT01-005'] = {
  abilities: [{ id: 'swap', kw: 'ACTIVATE 1/turn', zone: 'avatar', label: 'ส่ง Unit 1 ใบลงกองทิ้ง + Unit อีก 1 ใบวางใต้กอง; ฝั่งตรงข้ามทิ้งมือสุ่ม 1 ใบ + ส่งใบบนสุดของกองลงกองทิ้ง',
    can: ({ G, p }) => myUnits(G, p).length >= 2,
    resolve: async ({ G, p, self }) => {
      const a = await H.pickUnit(G, p, myUnits(G, p), `${self.def.name}: เลือก Unit ที่จะส่งลงกองทิ้ง`); if (!a) return;
      const b = await H.pickUnit(G, p, myUnits(G, p, u => u !== a), `${self.def.name}: เลือก Unit ที่จะวางใต้กองการ์ด`); if (!b) return;
      H.removeUnit(G, a, 'discard'); H.removeUnit(G, b, 'deckBottom');
      const Q = P_(G, opp(p));
      if (Q.hand.length) { const c = Q.hand[Math.floor(G.rng() * Q.hand.length)]; place(G, c, 'discard'); log(G, `${Q.name} ทิ้ง ${c.def.name} แบบสุ่ม`, opp(p)); }
      if (Q.deck.length) place(G, Q.deck[0], 'discard');
    } }]
};
FX['AT01-006'] = { avatarAtk: 4, equipCostMod: 1 };   // engine: สวม Equipment ได้ทุกกรณี · Avatar ที่สวมแล้วโจมตีได้ ATK 4 · EquipCost -1
FX['AT01-007'] = {
  abilities: [{ id: 'grant', kw: 'ACTIVATE 1/turn', zone: 'avatar', label: 'Unit 1 ใบได้รับธาตุ: พืช = DEF +2 และไม่ถูกทำลายจาก Spell / แสง(ทอง) = CRI +1 และโจมตี Avatar ตรง',
    can: ({ G, p }) => myUnits(G, p).length > 0,
    resolve: async ({ G, p, self }) => {
      const u = await H.pickUnit(G, p, myUnits(G, p), `${self.def.name}: เลือก Unit`); if (!u) return;
      const k = await H.choose(G, p, 'เลือกธาตุ', ['พืช: DEF +2 และไม่ถูกทำลายจากการ์ด Spell', 'แสง: CRI +1 และโจมตี Avatar ตรง']);
      if (k === 0) { addMod(G, u, { def: 2, until: 'perm' }); addMod(G, u, { flag: 'at01SpellImmune', until: 'perm' }); }
      else { addMod(G, u, { cri: 1, until: 'perm' }); addMod(G, u, { flag: 'direct', until: 'perm' }); }
    } }]
};
FX['AT01-008'] = {
  abilities: [{ id: 'return', kw: 'ACTIVATE 1/turn', zone: 'avatar', label: 'นำ Unit 1 ใบบนสนามขึ้นมือ; เทิร์นนี้ Cost อัญเชิญ Unit ธาตุน้ำ -1',
    can: ({ G }) => AF.units(G, 0).length + AF.units(G, 1).length > 0,
    resolve: async ({ G, p, self }) => {
      const all = [...AF.units(G, 0), ...AF.units(G, 1)];
      const u = await H.pickUnit(G, p, all, `${self.def.name}: เลือก Unit ที่จะนำขึ้นมือ`); if (!u) return;
      H.removeUnit(G, u, 'hand'); P_(G, p).at01WaterDisc = G.turn;
    } }]
};
FX['AT01-009'] = {
  on: { unitDestroyed: async ({ G, self, p, unit, owner }) => {
    if (owner !== p || unit.zone !== 'discard') return;
    if (!(await H.yesNo(G, p, `${self.def.name}: นำ ${unit.def.name} กลับขึ้นมือ?`))) return;
    place(G, unit, 'hand');
    const e = P_(G, p).elems.find(x => x.state === 'rest'); if (e) e.state = 'stand';
  } }
};
FX['AT01-010'] = {
  on: { turnEnd: async ({ G, self, p, player }) => {
    if (player !== p || !myUnits(G, p, u => hasEl(u, 'พืช') || hasEl(u, 'มืด')).length) return;
    const u = await H.pickUnit(G, p, H.oppUnits(G, p, null, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่จะประกาศโจมตีไม่ได้`, true);
    if (u) addMod(G, u, { flag: 'noAttack', until: 'oppTurnEnd' });
  } },
  abilities: [{ id: 'silence', kw: 'ACTIVATE 1/turn', zone: 'avatar', spend: 2, label: '[Spend 2] Unit ฝ่ายตรงข้ามที่ไม่ใช่ธาตุมืด/พืช ถูกลบความสามารถ',
    can: ({ G, p }) => H.oppUnits(G, p, u => !hasEl(u, 'มืด') && !hasEl(u, 'พืช')).length > 0,
    targets: async ({ G, p, self }) => (await H.pickUnit(G, p, H.oppUnits(G, p, u => !hasEl(u, 'มืด') && !hasEl(u, 'พืช'), self), `${self.def.name}: เลือก Unit`)) || false,
    resolve: async ({ G }, u) => { if (u && u.zone === 'field') addMod(G, u, { silence: true, until: 'perm' }); } }]
};
FX['AT01-011'] = {
  on: { unitEntered: async ({ G, self, p, unit, via }) => {
    if (unit.owner !== p || via !== 'summon') return;
    const e = P_(G, p).elems.find(x => x.state === 'rest'); if (e) { e.state = 'stand'; log(G, `${self.def.name}: Element 1 ใบเปลี่ยนเป็น Stand`, p); }
  } }
};
FX['AT01-012'] = { secondAvatar: 'เพอร์เซฟนี',   // engine: เริ่มเกมได้ Avatar เพอร์เซฟนีอีกใบ (ไม่นับในเด็ค 60)
  on: { abilityUsed: async ({ G, self, p, card, player }) => {
    if (player !== p || card.owner !== p || !card.def.name.includes('เพอร์เซฟนี') || !onceTurn(G, self, 'demeter')) return;
    if (AF.gainElement(G, p)) log(G, `${self.def.name}: ได้รับ Element +1`, p);
  } } };
FX['AT01-013'] = { abilities: [{ id: 'rise', kw: 'ACTIVATE 1/game', zone: 'avatar', label: 'กลายเป็น Legendary Unit (ใช้ 2 ช่อง ATK/DEF 10) ทำลายการ์ดหงายหน้าฝั่งตรงข้ามทั้งหมด',
  can: ({ G, p, self }) => { const P = P_(G, p); return self.zone === 'avatar' && P.field.indexOf(null) >= 0 && P.field.filter(Boolean).reduce((n, u) => n + (u.slots || 1), 0) + 2 <= (P.fieldCap ?? 4); },
  resolve: async ({ G, p, self }) => {
    const P = P_(G, p), O = P_(G, opp(p)), orig = self.def;
    self.def = Object.assign({}, orig, { kind: 'Unit', type: 'Unit', cost: 10, atk: 10, def: 10, cri: 0, at01Legend: true });
    self.slots = 2; P.at01Tiamat = true;
    if (!(await H.enterField(G, p, self, { byEffect: true, effectOwner: p }))) { self.def = orig; self.slots = 1; P.at01Tiamat = false; return; }
    let n = 0;
    for (const u of [...O.field]) if (u && u.zone === 'field' && await H.destroy(G, u, { kind: 'effect', player: p, source: self })) n++;
    for (const d of [...O.domains]) { place(G, d, 'discard'); n++; }
    for (const m of [...O.magic]) if (m && m.linger) { place(G, m, 'discard'); n++; }
    if (n) addMod(G, self, { atk: n, def: n, until: 'perm' });
    log(G, `${orig.name}: ทำลายการ์ดฝั่งตรงข้าม ${n} ใบ → ATK/DEF +${n} (ตอนนี้ ${stat(G, self, 'atk')}/${stat(G, self, 'def')})`, p);
  } }] };
FX['AT01-014'] = {
  abilities: [{ id: 'burst', kw: 'ACTIVATE 1/turn', zone: 'avatar', spend: 5, label: '[Spend 5] สร้างความเสียหาย 3 ให้ Avatar ฝ่ายตรงข้าม (+2 ถ้าคืน Element ทั้งหมดเข้า Element Deck)',
    resolve: async ({ G, p, self }) => {
      let dmg = 3; const P = P_(G, p);
      if (P.elems.length && await H.yesNo(G, p, `${self.def.name}: นำ Element ทั้งหมดกลับ Element Deck เพื่อเพิ่มความเสียหาย +2?`)) {
        P.edeck.push(...P.elems.splice(0)); dmg += 2;
      }
      H.damageAvatar(G, opp(p), dmg, self);
    } }]
};
FX['AT01-015'] = {
  abilities: [{ id: 'revive', kw: 'ACTIVATE 1/turn', zone: 'avatar', spend: 2, label: '[Spend 2] อัญเชิญ Unit จากกองทิ้ง แล้วส่ง Unit ฝ่ายตรงข้ามใต้ Main Deck (ไม่ได้ = จั่ว 1)',
    can: ({ G, p }) => P_(G, p).discard.some(c => c.def.kind === 'Unit') && !!AF.freeSlot(P_(G, p)),
    resolve: async ({ G, p, self }) => {
      const P = P_(G, p);
      const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit จากกองทิ้ง`, cards: P.discard.filter(x => x.def.kind === 'Unit') });
      const ok = c ? await H.enterField(G, p, c, { adv: true, byEffect: true, effectOwner: p }) : false;
      const t = ok ? await H.pickUnit(G, p, H.oppUnits(G, p, null, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามส่งใต้ Main Deck`) : null;
      if (t) H.removeUnit(G, t, 'deckBottom'); else H.draw(G, p, 1);
    } }]
};

/* ================================================================ UNIT */
FX['AT01-016'] = { advent: { resolve: async ({ G, p, self }) => {
  const rest = P_(G, p).elems.filter(e => e.state === 'rest'); if (!rest.length) return;
  rest[0].state = 'stand'; log(G, `${self.def.name}: Element 1 ใบเปลี่ยนเป็น Stand`, p);
} } };
FX['AT01-017'] = { advent: { resolve: async ({ G, p, self }) => {
  const u = await H.pickUnit(G, p, myUnits(G, p), `${self.def.name}: เลือก Unit ฝ่ายเรา DEF +1`); if (u) addMod(G, u, { def: 1, until: 'turnEnd' });
} } };
FX['AT01-018'] = { counter: {
  when: (G, r, last) => last.kind === 'attack' && last.controller !== r,
  resolve: async ({ G, self, target }) => { if (target) H.cancel(G, target); } } };
FX['AT01-019'] = { advent: { resolve: async ({ G, p }) => { H.healAvatar(G, p, 1); } } };
const intercept = id => ({ on: { attackDeclared: async ({ G, self, p, item, target }) => {
  if (self.zone !== 'field' || !target || target === 'avatar' || target === self || target.owner !== p || target.zone !== 'field') return;
  if (AF.standElems(P_(G, p)).length < 1) return;
  if (!(await H.yesNo(G, p, `${self.def.name}: จ่าย 1 Element เพื่อเปลี่ยนเป้าหมายการโจมตีมาที่การ์ดนี้?`))) return;
  await AF.payElems(G, p, 1, null, `${self.def.name}: เปลี่ยนเป้าหมาย`);
  item.target = self;
} } });
FX['AT01-020'] = intercept('AT01-020');
FX['AT01-025'] = intercept('AT01-025');
FX['AT01-021'] = { advent: { resolve: async ({ G, p, self }) => {
  const t = await H.pickUnit(G, p, H.oppUnits(G, p, u => u.state === 'rest', self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่นอนอยู่`, true);
  if (t) addMod(G, t, { flag: 'noStand', until: 'perm' });
  const m = await H.pickUnit(G, p, myUnits(G, p, u => u.state === 'rest'), `${self.def.name}: (ถ้าต้องการ) เลือก Unit ฝ่ายเราที่นอนอยู่`, true);
  if (m) addMod(G, m, { flag: 'noStand', until: 'perm' });
  H.draw(G, p, 1);
} } };
FX['AT01-022'] = { on: { attackDeclared: async ({ G, self, p, attacker }) => {
  if (attacker !== self || AF.units(G, opp(p)).length <= AF.units(G, p).length) return;
  addMod(G, self, { atk: 3, until: 'turnEnd' }); log(G, `${self.def.name}: ATK +3 จนจบเทิร์น`, p);
} } };
FX['AT01-023'] = { advent: { resolve: async ({ G, p, self }) => {
  const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Enchant/Counter จากกองทิ้ง`, cards: P_(G, p).discard.filter(x => x.def.kind === 'Enchant' || x.def.kind === 'Counter'), optional: true });
  if (c) place(G, c, 'hand');
} } };
FX['AT01-024'] = { aura: { def: (G, self, u) => (u.owner === self.owner ? 1 : 0) } };
FX['AT01-026'] = { abilities: [{ id: 'match', kw: 'ACTIVATE 1/turn', zone: 'field', label: 'ปรับ ATK ตั้งต้นของ Unit ฝ่ายเราให้เท่ากับ ATK ของการ์ดนี้',
  can: ({ G, p, self }) => myUnits(G, p, u => u !== self).length > 0,
  resolve: async ({ G, p, self }) => {
    const u = await H.pickUnit(G, p, myUnits(G, p, x => x !== self), `${self.def.name}: เลือก Unit ฝ่ายเรา`); if (!u) return;
    addMod(G, u, { atk: stat(G, self, 'atk') - stat(G, u, 'atk'), until: 'perm' });
  } }] };
FX['AT01-027'] = { advent: { resolve: async ({ G, p, self }) => {
  if (!AF.freeSlot(P_(G, p))) return;
  const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit จากกองทิ้ง`, cards: P_(G, p).discard.filter(x => x.def.kind === 'Unit'), optional: true });
  if (c && await H.enterField(G, p, c, { adv: true, byEffect: true, effectOwner: p })) H.healAvatar(G, p, c.def.cost);
} } };
FX['AT01-028'] = { abilities: [{ id: 'announce', kw: 'ANNOUNCE', zone: 'discard', label: '[กองทิ้ง] ทิ้งการ์ดบนมือ 3 ใบ อัญเชิญการ์ดนี้ (ถ้าถูกทำลายในเทิร์นฝั่งตรงข้ามที่ผ่านมา)',
  can: ({ G, p, self }) => self.zone === 'discard' && self.destroyedTurn === G.turn - 1 && P_(G, p).hand.length >= 3 && !!AF.freeSlot(P_(G, p)),
  resolve: async ({ G, p, self }) => {
    const d = await H.discardFromHand(G, p, 3, `${self.def.name}: เลือกการ์ดบนมือ 3 ใบที่จะทิ้ง`); if (d.length < 3 || self.zone !== 'discard') return;
    await H.enterField(G, p, self, { adv: true, byEffect: true, effectOwner: p });
  } }], advent: { resolve: async ({ G, p, self }) => {
  const t = await H.pickUnit(G, p, H.oppUnits(G, p, null, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้าม`); if (!t) return;
  if (t.state === 'rest') await H.destroy(G, t, { kind: 'effect', player: p, source: self }); else t.state = 'rest';
} } };
FX['AT01-029'] = {};   // ตัวขัดจังหวะอยู่ที่ AF.abilityGuards ด้านล่าง
FX['AT01-030'] = { advent: { resolve: async ({ G, p, self }) => {
  const t = await H.pickUnit(G, p, H.oppUnits(G, p, null, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้าม ATK/DEF -3`); if (t) addMod(G, t, { atk: -3, def: -3, until: 'perm' });
} } };

/* ================================================================ COUNTER */
FX['AT01-031'] = { counter: {
  when: (G, r, last) => /ability/.test(last.kind) && last.controller !== r,
  resolve: async ({ G, target }) => { if (target) H.cancel(G, target); } } };
FX['AT01-032'] = { counter: {
  when: (G, r, last) => last.kind === 'attack' && last.controller !== r,
  resolve: async ({ G, target }) => { if (target && target.attacker) addMod(G, target.attacker, { flag: 'noAttack', until: 'turnEnd' }); } } };
FX['AT01-033'] = { counter: {
  when: (G, r, last) => last.kind === 'spell' && last.controller !== r && last.source && (last.source.def.kind === 'Enchant' || last.source.def.kind === 'Counter'),
  resolve: async ({ G, target }) => { if (target) H.cancel(G, target); } } };

/* ================================================================ ENCHANT */
const MANY = /(Unit|ยูนิต)[^\n]{0,40}(ทุกใบ|ทั้งหมด)|ทุก\s*Unit|Unit\s*ทุก|(Unit|เป้าหมาย)[^\n]{0,20}\s[2-9]\s*ใบ|สูงสุด\s*[2-9]\s*ใบ/;
FX['AT01-035'] = { counter: {
  when: (G, r, last) => last.controller !== r && /ability|spell|ultimate/.test(last.kind) && !!last.source && (last.source.def.fx || []).some(f => f[0] !== 'COST' && MANY.test(f[1])),
  resolve: async ({ G, target }) => { if (target) H.cancel(G, target); } } };
FX['AT01-036'] = { spell: { resolve: async ({ G, p, self }) => {
  const u = await H.pickUnit(G, p, myUnits(G, p), `${self.def.name}: เลือก Unit ฝ่ายเรา ATK +2 DEF +2`); if (u) addMod(G, u, { atk: 2, def: 2, until: 'turnEnd' });
} } };
FX['AT01-037'] = { spell: { resolve: async ({ G, self, p }) => {
  for (const u of [...AF.units(G, 0), ...AF.units(G, 1)]) if (u.zone === 'field' && stat(G, u, 'def') === 0) { H.removeUnit(G, u, 'discard'); log(G, `${self.def.name}: ${u.def.name} ลงกองทิ้ง`, p); }
} } };
FX['AT01-038'] = { spell: { resolve: async ({ G, p, self }) => {
  for (const u of [...AF.units(G, 0), ...AF.units(G, 1)]) u.mods = u.mods.filter(m => !(m.atk || m.def));
  log(G, `${self.def.name}: Unit ทุกใบกลับสู่ค่า ATK/DEF พื้นฐาน`, p);
} } };
FX['AT01-039'] = { spell: { resolve: async ({ G, p, self }) => {
  const u = await H.pickUnit(G, p, [...AF.units(G, p), ...AF.units(G, opp(p))], `${self.def.name}: เลือก Unit ATK +5 (Banish เมื่อจบเทิร์น)`); if (!u) return;
  addMod(G, u, { atk: 5, until: 'turnEnd' }); (G.at01Banish = G.at01Banish || []).push(u);
} } };
FX['AT01-040'] = { spell: { can: ({ G, p }) => myUnits(G, p).length > 0, cantReason: 'ไม่มี Unit ฝ่ายคุณให้เลือก',
  resolve: async ({ G, p, self }) => {
    const u = await H.pickUnit(G, p, myUnits(G, p), `${self.def.name}: เลือก Unit ฝ่ายคุณที่จะทำลาย`); if (!u) return;
    if (await H.destroy(G, u, { kind: 'effect', player: p, source: self })) H.draw(G, opp(p), 3);
  } } };

/* ================================================================ EQUIPMENT */
FX['AT01-041'] = { equip: { def: 2 } };   // + guard ด้านบน
FX['AT01-042'] = { equip: { atk: 2 }, on: { attackSuccess: async ({ G, self, p, attacker, target, destroyed }) => {
  if (!self.host || attacker !== self.host || target === 'avatar' || !destroyed) return;
  await killOpp(G, p, self, null, `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามอีก 1 ใบเพื่อทำลาย`);
} } };
FX['AT01-043'] = { equip: { atk: 1, def: 1 } };   // + guard ด้านบน

/* ================================================================ DOMAIN */
FX['AT01-044'] = { abilities: [{ id: 'free', kw: 'ACTIVATE 1/turn', zone: 'domain', label: '[Main] ถ้ามี Element ต่างธาตุ ≥ 2: อัญเชิญ Unit จากมือโดยไม่ต้องจ่าย Cost',
  can: ({ G, p }) => new Set(P_(G, p).elems.map(e => e.el)).size >= 2 && P_(G, p).hand.some(c => c.def.kind === 'Unit') && !!AF.freeSlot(P_(G, p)),
  resolve: async ({ G, p, self }) => {
    const [c] = await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit จากมือ`, cards: P_(G, p).hand.filter(x => x.def.kind === 'Unit') });
    if (c) await H.enterField(G, p, c, { adv: true, byEffect: true, effectOwner: p });
  } }] };
FX['AT01-045'] = {};   // + guard ด้านบน

/* ---------------------------------------------------------------- NOTES */
Object.assign(NOTES, {
  'AT01-002': 'ธาตุทอง: ตีความเป็นเอฟเฟกต์จนจบเทิร์น (Unit ที่เลือกโจมตี → ทำลายเป้าหมายทันที ใช้ Counter ไม่ได้)',
  'AT01-004': 'HP 20 ใช้ตอนเริ่มเทิร์นแรกของเกม · จำกัดมือ 3 ใบใช้กับเจ้าของเทิร์น',
  'AT01-007': 'ผลของธาตุที่เลือกมีผลถาวร (ข้อความไม่ระบุระยะเวลา) · แฟล็ก at01SpellImmune ยังไม่ถูกตรวจใน engine',
  'AT01-008': 'ส่วนลด Cost อัญเชิญธาตุน้ำเก็บไว้ที่ P.at01WaterDisc แต่ engine ยังไม่ได้อ่านค่านี้',
  'AT01-018': 'Unit ที่มี Counter ใช้จากบนมือ (engine ตรวจ Counter เฉพาะบนมือ)',
  'AT01-006': 'สวม Equipment ได้ทุกกรณี (Avatar มี Equipment ได้ 1 ใบ) · เมื่อสวมแล้ว Avatar ประกาศโจมตีได้ ATK 4+โบนัส Equipment · EquipCost ลด 1 (ไม่ต่ำกว่า 0)',
  'AT01-012': 'เริ่มเกมได้ Avatar เพอร์เซฟนีเป็นใบที่สองอัตโนมัติ (ไม่นับในเด็ค 60) · Element +1 ตีความเป็น 1 ครั้งต่อเทิร์น',
  'AT01-013': 'เทียแมทใช้งานจาก Avatar Zone ครั้งเดียว · ใช้ 2 ช่อง · ถูกทำลายได้เฉพาะจากการต่อสู้ · ถูกทำลาย = แพ้ · ทำลายทุกการ์ดหงายหน้าฝั่งตรงข้าม (Unit/Domain/Enchant ที่ค้างอยู่)',
  'AT01-028': 'ANNOUNCE ใช้ได้ใน Main Phase ของเรา เมื่อการ์ดนี้อยู่กองทิ้งและถูกทำลายในเทิร์นของฝั่งตรงข้าม (เทิร์นก่อนหน้า)',
  'AT01-029': 'ขัดจังหวะเฉพาะความสามารถ Unit ที่ฝ่ายตรงข้ามใช้ (ADVENT/ACTIVATE) จ่าย 3 Element ยกเลิก; ถ้า HP > 2 เลือกจ่าย 2 HP เพื่อลบความสามารถทั้งหมดของ Unit นั้น · ถามผู้เล่นทุกครั้ง',
  'AT01-035': 'ตรวจจากข้อความการ์ดต้นทาง: มีคำว่า Unit ทุกใบ/ทั้งหมด หรือ Unit 2+ ใบ ถือว่ามีผลต่อ Unit ตั้งแต่ 2 ใบ',
  'AT01-005': 'AUTO (ทิ้งมือเพื่อใช้ความสามารถ → ดาเมจ Avatar 1) ยังไม่ได้เขียน เพราะ engine ไม่มีเหตุการณ์ทิ้งการ์ดเป็นค่าใช้จ่าย'
});
})(globalThis.AF = globalThis.AF || {});
