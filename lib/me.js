// ข้อมูลของผู้ใช้ที่ล็อกอินแล้ว: โปรไฟล์/เหรียญ · รางวัลรายวัน · คอลเลกชัน · เด็คที่จัดไว้ · ร้านค้า (ซื้อซอง/Starter Deck)
// ทุกอย่างคำนวณและบันทึกที่เซิร์ฟเวอร์ (เหรียญและการ์ดที่ได้โกงจากเบราว์เซอร์ไม่ได้)
const crypto = require("crypto");
const express = require("express");
const supa = require("./supa");
const store = require("./store");
const { dropProfile, publicUser } = require("./auth");
const presence = require("./presence");
const S = store.state;

const DAILY = Number(process.env.DAILY_COINS ?? 100);
const PACK_DEFAULT = { size: 8, commonSlots: 7, rareSlot: { R: 88, SR: 12, SSR: 3, UR: 1 }, unknownWeight: 1, noDupInPack: true };
const RANK = ["C", "R", "SR", "SSR", "UR"];
const DEFAULT_PRICE = { pack: Number(process.env.PACK_PRICE ?? 100), starter: Number(process.env.STARTER_PRICE ?? 500) };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });   // YYYY-MM-DD เวลาไทย

// ---- กันกดซ้อน: ทำทีละคำสั่งต่อผู้ใช้ ----
const locks = new Map();
function withLock(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  const run = prev.catch(() => { }).then(fn);
  const tail = run.catch(() => { }); locks.set(id, tail);
  tail.then(() => { if (locks.get(id) === tail) locks.delete(id); });
  return run;
}
class HttpErr extends Error { constructor(code, msg) { super(msg); this.code = code; } }

// ---------- โปรไฟล์ / เหรียญ ----------
const freshProfile = async (id) => supa.must(await supa.db.from("profiles").select("*").eq("id", id).maybeSingle(), "profile");
async function setCoins(id, from, to) {          // optimistic: เปลี่ยนเฉพาะเมื่อเหรียญยังเท่าที่อ่านมา
  const r = supa.must(await supa.db.from("profiles").update({ coins: to }).eq("id", id).eq("coins", from).select("coins"), "coins");
  if (!r || !r.length) throw new HttpErr(409, "ข้อมูลเหรียญเปลี่ยนระหว่างทำรายการ ลองใหม่อีกครั้ง");
  dropProfile(id);
}
async function ownedMap(uid) {
  const out = {}; const page = 1000;
  for (let from = 0; ; from += page) {
    const rows = supa.must(await supa.db.from("user_cards").select("card_id,qty").eq("user_id", uid).order("card_id").range(from, from + page - 1), "collection");
    for (const r of rows) if (r.qty > 0) out[r.card_id] = r.qty;
    if (rows.length < page) break;
  }
  return out;
}
// การ์ดเวอร์ชันพิเศษ (เช่น SD01-019SR) นับรวมกับใบหลัก (SD01-019) เวลาจัดเด็ค
const baseId = (id) => String(id).replace(/^([A-Za-z0-9]+-\d+).*$/, "$1");
function ownedBase(owned) { const o = {}; for (const [id, n] of Object.entries(owned || {})) { const b = baseId(id); o[b] = (o[b] || 0) + n; } return o; }
// ตัดการ์ดที่ผู้ใช้ไม่มี/มีไม่พอออกจากเด็ค (กันแก้ localStorage โกง และเด็คเก่าที่จัดไว้ก่อนมีกติกานี้) · คืน { deck, trimmed }
function fitDeckToOwned(d, own) {
  let trimmed = 0; const counts = {};
  for (const [id, n] of Object.entries(d.counts || {})) {
    const have = own[baseId(id)] || 0, keep = Math.max(0, Math.min(Number(n) || 0, have));
    trimmed += (Number(n) || 0) - keep; if (keep > 0) counts[id] = keep;
  }
  const out = { ...d, counts };
  if (d.avatar && !(own[baseId(d.avatar)] > 0)) { out.avatar = null; trimmed += 1; }
  return { deck: out, trimmed };
}
async function decksOf(uid) {
  const rows = supa.must(await supa.db.from("user_decks").select("data,updated_at").eq("user_id", uid).order("updated_at", { ascending: false }).limit(200), "decks");
  return rows.map((r) => r.data);
}

// ---------- สุ่มซอง (พอร์ตจาก web/js/packs.js) ----------
const rnd = (n) => crypto.randomInt(n);
const rar = (c) => String(c.rarity || "C").trim().toUpperCase();
function pickWeighted(map) {
  const e = Object.entries(map), t = e.reduce((s, [, w]) => s + w, 0);
  let r = rnd(Math.round(t * 1000)) / 1000;
  for (const [k, w] of e) if ((r -= w) < 0) return k;
  return e[e.length - 1][0];
}
function pick(list, taken, dup) {
  let pool = list;
  if (dup) { const f = list.filter((c) => !taken.has(c.id)); if (f.length) pool = f; }
  const c = pool[rnd(pool.length)]; taken.add(c.id); return c;
}
function openPack(cards, cfgIn) {
  const P = { ...PACK_DEFAULT, ...(cfgIn || {}) }, by = {};
  cards.forEach((c) => (by[rar(c)] = by[rar(c)] || []).push(c));
  const commons = by.C && by.C.length ? by.C : cards, taken = new Set(), out = [];
  for (let i = 0; i < Math.min(P.commonSlots, P.size); i++) out.push(pick(commons, taken, P.noDupInPack));
  const w = {};
  for (const k of Object.keys(by)) if (k !== "C") w[k] = P.rareSlot[k] !== undefined ? P.rareSlot[k] : P.unknownWeight;
  while (out.length < P.size) { const r = Object.keys(w).length ? pickWeighted(w) : "C"; out.push(pick(by[r] || commons, taken, P.noDupInPack)); }
  const rk = (c) => { const i = RANK.indexOf(rar(c)); return i < 0 ? 1.5 : i; };
  return out.sort((a, b) => rk(a) - rk(b));
}
const setCards = (setId) => S.cards.filter((c) => c.deck.toLowerCase() === String(setId).toLowerCase());
const baseCards = (setId) => { const all = setCards(setId); const b = all.filter((c) => /^[A-Za-z0-9]+-\d+$/.test(c.id)); return b.length ? b : all; };

// ---------- ร้านค้า ----------
// สร้างสินค้าเริ่มต้นให้ทุกชุดที่ยังไม่มี: BT* = ซองการ์ด · SD* = Starter Deck  (แอดมินแก้ราคา/ปิดขายในแท็บ "ร้านค้า" ของ /admin)
async function ensureShopItems() {
  if (!supa.enabled) return;

  // card_sets อาจว่างได้แม้มี cards อยู่แล้ว (store.init จะ seed เฉพาะเมื่อ cards ว่าง)
  // รวมชุดจากทั้ง card_sets และ cards เพื่อให้ร้านค้าสร้างสินค้ากลับมาได้
  const catalog = new Map();
  S.decks.forEach((d) => {
    if (d && d.id) catalog.set(String(d.id).toUpperCase(), { id: String(d.id).toUpperCase(), name: d.name || d.id });
  });
  S.cards.forEach((c) => {
    if (!c || !c.deck) return;
    const id = String(c.deck).toUpperCase();
    if (!catalog.has(id)) catalog.set(id, { id, name: id });
  });

  const have = new Set(supa.must(await supa.db.from("shop_items").select("id"), "shop").map((r) => r.id));
  const rows = [];
  [...catalog.values()].sort((a, b) => a.id.localeCompare(b.id)).forEach((d, i) => {
    const kind = /^BT/i.test(d.id) ? "pack" : /^SD/i.test(d.id) ? "starter" : null;
    if (!kind) return;
    const id = `${kind}-${d.id}`;
    if (have.has(id)) return; // รักษาราคาและสถานะที่แอดมินตั้งไว้
    rows.push(kind === "pack"
      ? { id, kind, set_id: d.id, name: `ซองการ์ด ${d.id}${d.name && d.name !== d.id ? " · " + d.name : ""}`, description: `สุ่ม ${PACK_DEFAULT.size} ใบจากชุด ${d.id} (มีโอกาสได้ใบหายาก)`, price: DEFAULT_PRICE.pack, config: {}, active: true, sort: 10 + i }
      : { id, kind, set_id: d.id, name: `Starter Deck ${d.id}${d.name && d.name !== d.id ? " · " + d.name : ""}`, description: `ได้การ์ดครบทั้งชุด ${d.id} ใบละ 3 ใบ พร้อมจัดเด็คได้ทันที`, price: DEFAULT_PRICE.starter, config: { copies: 3 }, active: true, sort: 100 + i });
  });
  if (rows.length) {
    supa.must(await supa.db.from("shop_items").upsert(rows, { onConflict: "id", ignoreDuplicates: true }), "shop seed");
    console.log("กู้คืนสินค้าในร้านที่ขาด:", rows.map((r) => r.id).join(", "));
  }
}
store.onChange(ensureShopItems);

const ssItem = (it) => ({ id: it.id, kind: it.kind, set: it.set_id, name: it.name, description: it.description, price: it.price,
  cardCount: baseCards(it.set_id).length, size: ["pack","special_pack","mystery_box"].includes(it.kind) ? ({ ...PACK_DEFAULT, ...it.config }).size : undefined,
  commonSlots: ["pack","special_pack","mystery_box"].includes(it.kind) ? ({ ...PACK_DEFAULT, ...it.config }).commonSlots : undefined,
  rareSlot: ["pack","special_pack","mystery_box"].includes(it.kind) ? ({ ...PACK_DEFAULT, ...it.config }).rareSlot : undefined, unknownWeight: ["pack","special_pack","mystery_box"].includes(it.kind) ? ({ ...PACK_DEFAULT, ...it.config }).unknownWeight : undefined, copies: it.kind === "starter" ? (it.config.copies || 3) : undefined,
  grants: ["bundle","promotion"].includes(it.kind) ? (Array.isArray(it.config.grants) ? it.config.grants : []) : undefined,
  cover: (baseCards(it.set_id).find((c) => c.type === "Avatar" && c.image) || baseCards(it.set_id).find((c) => c.image) || {}).image || null });

async function buy(uid, itemId, qtyIn) {
  const item = supa.must(await supa.db.from("shop_items").select("*").eq("id", String(itemId)).eq("active", true).maybeSingle(), "item");
  if (!item) throw new HttpErr(404, "ไม่พบสินค้านี้");
  const qty = Math.floor(Number(qtyIn) || 1);
  if (qty < 1 || qty > (["pack","special_pack","mystery_box"].includes(item.kind) ? 10 : 3)) throw new HttpErr(400, "จำนวนไม่ถูกต้อง");
  const randomKinds = ["pack", "special_pack", "mystery_box"];
  const fixedKinds = ["bundle", "promotion"];
  const pool = randomKinds.includes(item.kind) ? setCards(item.set_id) : baseCards(item.set_id);
  if (randomKinds.includes(item.kind) && !pool.length) throw new HttpErr(409, "สินค้านี้ยังไม่มีการ์ดในชุด");
  const fixedGrants = Array.isArray(item.config && item.config.grants) ? item.config.grants : [];
  if (fixedKinds.includes(item.kind) && !fixedGrants.length) throw new HttpErr(409, "สินค้านี้ยังไม่ได้กำหนดรายการการ์ดที่จะได้รับ");
  if (fixedKinds.includes(item.kind) && fixedGrants.some(g => !g || !S.byId.has(String(g.id || "").toLowerCase()) || !Number.isInteger(Number(g.qty)) || Number(g.qty) < 1 || Number(g.qty) > 99)) throw new HttpErr(409, "รายการการ์ดในสินค้านี้ไม่ถูกต้อง");
  const total = item.price * qty, p = await freshProfile(uid);
  if (!p) throw new HttpErr(401, "ไม่พบผู้ใช้");
  if (p.coins < total) throw new HttpErr(402, `เหรียญไม่พอ (ต้องใช้ ${total} มีอยู่ ${p.coins})`);

  const packs = [];
  if (randomKinds.includes(item.kind)) {
    for (let i = 0; i < qty; i++) packs.push(openPack(pool, { ...PACK_DEFAULT, ...(item.config || {}) }));
  } else if (item.kind === "starter") {
    const copies = Math.max(1, Math.min(10, item.config.copies || 3));
    for (let i = 0; i < qty; i++) for (const c of pool) for (let k = 0; k < copies; k++) (packs[i] = packs[i] || []).push(c);
  } else {
    for (let i = 0; i < qty; i++) {
      packs.push(fixedGrants.flatMap(g => Array.from({ length: Number(g.qty) }, () => S.byId.get(String(g.id).toLowerCase()))));
    }
  }
  const grant = new Map(); packs.flat().forEach((c) => grant.set(c.id, (grant.get(c.id) || 0) + 1));

  const ids = [...grant.keys()];
  const have = new Map(); for (const part of supa.chunk(ids, 150)) supa.must(await supa.db.from("user_cards").select("card_id,qty").eq("user_id", uid).in("card_id", part), "owned").forEach((r) => have.set(r.card_id, r.qty));

  await setCoins(uid, p.coins, p.coins - total);                      // หักเหรียญก่อน แล้วค่อยให้การ์ด (พังกลางทาง = คืนเหรียญ)
  try {
    const rows = ids.map((id) => ({ user_id: uid, card_id: id, qty: (have.get(id) || 0) + grant.get(id) }));
    for (const part of supa.chunk(rows)) supa.must(await supa.db.from("user_cards").upsert(part), "grant");
  } catch (e) {
    await supa.db.from("profiles").update({ coins: p.coins }).eq("id", uid); dropProfile(uid);
    throw new HttpErr(500, "ให้การ์ดไม่สำเร็จ คืนเหรียญแล้ว ลองใหม่อีกครั้ง");
  }
  await supa.db.from("purchases").insert({ user_id: uid, item_id: item.id, qty, price: total });

  const seen = new Set(), view = (c) => { const isNew = !have.has(c.id) && !seen.has(c.id); seen.add(c.id); return { ...c, isNew }; };
  const out = randomKinds.includes(item.kind)
    ? packs.map((pk) => pk.map(view))
    : [[...grant.keys()].map((id) => ({ ...S.byId.get(id.toLowerCase()), isNew: !have.has(id), qty: grant.get(id) }))];
  return { ok: true, coins: p.coins - total, item: ssItem(item), kind: item.kind, packs: out };
}

// ---------- เส้นทาง ----------
const router = express.Router();
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { if (e instanceof HttpErr) return res.status(e.code).json({ error: e.message }); console.error(req.method, req.originalUrl, e.message); res.status(500).json({ error: "เซิร์ฟเวอร์ผิดพลาด ลองใหม่อีกครั้ง" }); }
};

router.get("/me", wrap(async (req, res) => {
  const uid = req.session.user.id, p = await freshProfile(uid);
  const owned = await ownedMap(uid);
  const buys = supa.must(await supa.db.from("purchases").select("item_id,qty").eq("user_id", uid), "purchases");
  const decks = supa.must(await supa.db.from("user_decks").select("deck_id", { count: "exact", head: false }).eq("user_id", uid), "decks");
  res.json({ user: publicUser({ user: req.session.user, profile: p }), dailyReady: p.last_daily !== today(), dailyAmount: DAILY,
    stats: { ownedUnique: Object.keys(owned).length, ownedTotal: Object.values(owned).reduce((a, b) => a + b, 0), totalCards: S.cards.length,
      packsOpened: buys.filter((b) => b.item_id.startsWith("pack-")).reduce((a, b) => a + b.qty, 0), decks: decks.length } });
}));

router.post("/me/daily", wrap(async (req, res) => {
  const uid = req.session.user.id;
  const r = await withLock(uid, async () => {
    const p = await freshProfile(uid);
    if (p.last_daily === today()) throw new HttpErr(409, "วันนี้รับรางวัลไปแล้ว พรุ่งนี้มาใหม่นะ");
    const u = supa.must(await supa.db.from("profiles").update({ coins: p.coins + DAILY, last_daily: today() }).eq("id", uid).eq("coins", p.coins).select("coins"), "daily");
    if (!u.length) throw new HttpErr(409, "ลองใหม่อีกครั้ง");
    dropProfile(uid); return { ok: true, amount: DAILY, coins: p.coins + DAILY };
  });
  res.json(r);
}));

// ---- แรงค์: ตารางรางวัลเลื่อนแรงค์ + กดรับ ----
const rankLib = require("./rank");
const rankView = (p) => { const pts = Number(p.rank_points) || 0, tiers = rankLib.tiers(pts, p.rank_claims);
  return { points: pts, wins: Number(p.wins) || 0, losses: Number(p.losses) || 0, league: rankLib.leagueOf(pts), tiers, claimable: tiers.filter((t) => t.claimable).length, coins: p.coins, winPts: rankLib.REWARD.win.points, lossPts: -rankLib.REWARD.loss.points }; };
router.get("/me/rank", wrap(async (req, res) => res.json(rankView(await freshProfile(req.session.user.id)))));
router.post("/me/rank/claim", wrap(async (req, res) => {
  const uid = req.session.user.id, name = String((req.body && req.body.tier) || "").toUpperCase();
  const out = await withLock(uid, async () => {
    const p = await freshProfile(uid);
    if (!p) throw new HttpErr(404, "ไม่พบผู้ใช้");
    const t = rankLib.tiers(p.rank_points, p.rank_claims).find((x) => x.name === name);
    if (!t) throw new HttpErr(400, "ไม่พบลีกนี้");
    if (!t.reached) throw new HttpErr(409, `ต้องมี ${t.at} แต้มขึ้นไปจึงรับรางวัลลีกนี้ได้`);
    if (t.claimed) throw new HttpErr(409, "รับรางวัลลีกนี้ไปแล้ว");
    if (!t.coins) throw new HttpErr(409, "ลีกนี้ไม่มีรางวัลให้รับ");
    const claims = [...new Set([...(Array.isArray(p.rank_claims) ? p.rank_claims : []), name])];
    const r = await supa.db.from("profiles").update({ coins: p.coins + t.coins, rank_claims: claims }).eq("id", uid).eq("coins", p.coins).select("*");
    if (r.error) { if (/rank_claims|column/i.test(r.error.message)) throw new HttpErr(503, "ยังไม่ได้รัน supabase/schema.sql ใหม่ (ขาดคอลัมน์ rank_claims) — แจ้งผู้ดูแลระบบ"); throw new HttpErr(500, r.error.message); }
    if (!r.data || !r.data.length) throw new HttpErr(409, "ข้อมูลเหรียญเปลี่ยนระหว่างทำรายการ ลองใหม่อีกครั้ง");
    dropProfile(uid);
    return { ok: true, tier: name, amount: t.coins, ...rankView(r.data[0]) };
  });
  res.json(out);
}));

router.get("/me/collection", wrap(async (req, res) => { const owned = await ownedMap(req.session.user.id); res.json({ owned, base: ownedBase(owned), unique: Object.keys(owned).length, total: Object.values(owned).reduce((a, b) => a + b, 0) }); }));

router.get("/me/decks", wrap(async (req, res) => res.json({ data: await decksOf(req.session.user.id) })));
router.put("/me/decks", wrap(async (req, res) => {
  const uid = req.session.user.id, arr = req.body && req.body.decks;
  if (!Array.isArray(arr) || arr.length > 100) throw new HttpErr(400, "รูปแบบเด็คไม่ถูกต้อง");
  const own = ownedBase(await ownedMap(uid));            // เด็คต้องใช้การ์ดที่ผู้ใช้มีจริงเท่านั้น
  const rows = [], seen = new Set(), decks = []; let trimmed = 0;
  for (const raw of arr) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !/^[\w.-]{1,64}$/.test(raw.id) || seen.has(raw.id)) throw new HttpErr(400, "เด็คมีรหัส (id) ไม่ถูกต้อง");
    if (JSON.stringify(raw).length > 30_000) throw new HttpErr(400, "เด็คใหญ่เกินไป");
    const f = fitDeckToOwned(raw, own), d = f.deck; trimmed += f.trimmed;
    seen.add(d.id); decks.push(d); rows.push({ user_id: uid, deck_id: d.id, name: String(d.name || "").slice(0, 80), data: d, updated_at: new Date().toISOString() });
  }
  await withLock(uid, async () => {
    for (const part of supa.chunk(rows, 50)) supa.must(await supa.db.from("user_decks").upsert(part), "save decks");
    const cur = supa.must(await supa.db.from("user_decks").select("deck_id").eq("user_id", uid), "decks");
    const gone = cur.map((r) => r.deck_id).filter((id) => !seen.has(id));
    if (gone.length) supa.must(await supa.db.from("user_decks").delete().eq("user_id", uid).in("deck_id", gone), "delete decks");
  });
  res.json({ ok: true, count: rows.length, trimmed, decks: trimmed ? decks : undefined });   // trimmed > 0 = ฝั่งเบราว์เซอร์ต้องใช้รายการที่แก้แล้วแทน
}));

router.get("/shop", wrap(async (req, res) => {
  await ensureShopItems();
  const items = supa.must(await supa.db.from("shop_items").select("*").eq("active", true).order("sort"), "shop");
  const p = await freshProfile(req.session.user.id);
  res.json({ coins: p.coins, data: items.map(ssItem) });
}));
router.post("/shop/buy", wrap(async (req, res) => {
  const uid = req.session.user.id;
  res.json(await withLock(uid, () => buy(uid, req.body && req.body.itemId, req.body && req.body.qty)));
}));

// ---------- รางวัลแมตช์จับคู่ออนไลน์ ----------
// เปลี่ยนเหรียญ + แต้มแรงก์ + สถิติแพ้ชนะของผู้เล่นหนึ่งคน (เรียกจากห้องออนไลน์ lib/playtest.js เมื่อผลแมตช์ยืนยันแล้ว)
//   result: "win" | "loss" | "draw" · คืน { coins, points, wins, losses, pointsSaved } ค่าใหม่หลังบันทึก
// ถ้ายังไม่ได้รัน schema.sql ใหม่ (ไม่มีคอลัมน์ rank_points/wins/losses) จะบันทึกเฉพาะเหรียญ และ pointsSaved = false
let rankCols = true;
function awardMatch(uid, { coins = 0, points = 0, result }) {
  return withLock(uid, async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const p = await freshProfile(uid);
      if (!p) throw new HttpErr(404, "ไม่พบผู้ใช้");
      const next = { coins: Math.max(0, p.coins + coins) };
      if (rankCols) {
        next.rank_points = Math.max(0, (Number(p.rank_points) || 0) + points);
        if (result === "win") next.wins = (Number(p.wins) || 0) + 1;
        if (result === "loss") next.losses = (Number(p.losses) || 0) + 1;
      }
      const r = await supa.db.from("profiles").update(next).eq("id", uid).eq("coins", p.coins).select("*");
      if (r.error) {
        if (rankCols && /rank_points|wins|losses|column/i.test(r.error.message)) { rankCols = false; console.warn("ยังไม่มีคอลัมน์ rank_points/wins/losses ใน profiles — รัน supabase/schema.sql ใหม่เพื่อเปิดระบบแต้ม (ตอนนี้แจกเฉพาะเหรียญ)"); continue; }
        throw new HttpErr(500, r.error.message);
      }
      if (!r.data || !r.data.length) continue;            // เหรียญเปลี่ยนระหว่างทาง (เช่นซื้อของพร้อมกัน) → อ่านใหม่แล้วลองอีกครั้ง
      dropProfile(uid);
      const q = r.data[0];
      return { dPoints: rankCols ? (next.rank_points - (Number(p.rank_points) || 0)) : 0, coins: q.coins, points: rankCols ? Number(q.rank_points) || 0 : 0, wins: Number(q.wins) || 0, losses: Number(q.losses) || 0, pointsSaved: rankCols };
    }
    throw new HttpErr(409, "บันทึกรางวัลไม่สำเร็จ");
  });
}

// ---------- สำหรับแอดมิน (ผูกใน /admin) ----------
const adminRouter = express.Router();
adminRouter.get("/users", wrap(async (_req, res) => {
  // last_seen_at/last_page = ใครออนไลน์ (ถ้ายังไม่ได้รัน schema.sql ใหม่ → ถอยไปใช้คอลัมน์เดิม ไม่ให้แท็บผู้ใช้พัง)
  let rows;
  try { rows = await supa.fetchAll("profiles", "id,username,email,role,coins,created_at,last_seen_at,last_page", "created_at"); }
  catch { rows = await supa.fetchAll("profiles", "id,username,email,role,coins,created_at", "created_at"); }
  res.json({ data: rows, onlineWindowMs: presence.WINDOW_MS });
}));
adminRouter.put("/users/:id", wrap(async (req, res) => {
  const b = req.body || {}, patch = {};
  if (b.role !== undefined) { if (!["user", "admin"].includes(b.role)) throw new HttpErr(400, "role ไม่ถูกต้อง"); patch.role = b.role; }
  if (b.coins !== undefined) { const n = Math.floor(Number(b.coins)); if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw new HttpErr(400, "จำนวนเหรียญไม่ถูกต้อง"); patch.coins = n; }
  if (!Object.keys(patch).length) throw new HttpErr(400, "ไม่มีอะไรให้แก้");
  if (patch.role === "user" && req.params.id === req.session.user.id) throw new HttpErr(400, "ลดสิทธิ์ตัวเองไม่ได้");
  const r = supa.must(await supa.db.from("profiles").update(patch).eq("id", req.params.id).select("id"), "user");
  if (!r.length) throw new HttpErr(404, "ไม่พบผู้ใช้"); dropProfile(req.params.id); res.json({ ok: true });
}));
// ใครออนไลน์ตอนนี้ (เห็นล่าสุดไม่เกิน ~100 วินาที)
adminRouter.get("/online", wrap(async (_req, res) => {
  const rows = await presence.online();
  res.json({ count: rows.length, enabled: presence.enabled(), data: rows });
}));
// บันทึกกิจกรรมล่าสุด  ?limit=200&q=ข้อความ  (ค้นจากชื่อผู้ใช้/การกระทำ)
adminRouter.get("/logs", wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 200, 1), 500);
  let q = supa.db.from("audit_logs").select("*").order("at", { ascending: false }).limit(limit);
  const t = String(req.query.q || "").trim().replace(/[%,()*]/g, "").slice(0, 60);
  if (t) q = q.or(`username.ilike.%${t}%,action.ilike.%${t}%`);
  const r = await q;
  if (r.error) { if (/audit_logs/.test(r.error.message)) return res.json({ data: [], missing: true }); throw new HttpErr(500, r.error.message); }
  res.json({ data: r.data });
}));
adminRouter.get("/stats", wrap(async (_req, res) => {
  const users = await supa.fetchAll("profiles", "id,username,role,coins,created_at", "created_at");
  const buys = await supa.fetchAll("purchases", "item_id,qty,price,at", "at").catch(() => []);
  const day = 864e5, now = Date.now();
  const items = supa.must(await supa.db.from("shop_items").select("id,active"), "shop");
  res.json({
    users: users.length, admins: users.filter((u) => u.role === "admin").length,
    newUsers7d: users.filter((u) => now - new Date(u.created_at) < 7 * day).length,
    coinsTotal: users.reduce((a, u) => a + (u.coins || 0), 0),
    cards: S.cards.length, sets: S.decks.length,
    noImage: S.cards.filter((c) => !c.image).length,
    shopActive: items.filter((i) => i.active).length, shopTotal: items.length,
    online: (await presence.online().catch(() => [])).length,
    purchases: buys.length, spent: buys.reduce((a, b) => a + (b.price || 0), 0),
    recentUsers: users.slice(-5).reverse().map((u) => ({ username: u.username, role: u.role, created_at: u.created_at })),
  });
}));
adminRouter.get("/shop", wrap(async (_req, res) => res.json({ data: supa.must(await supa.db.from("shop_items").select("*").order("sort"), "shop") })));
adminRouter.post("/shop", wrap(async (req, res) => {
  const b = req.body || {}, id = String(b.id || "").trim(), kind = String(b.kind || "");
  const allowed = ["special_pack", "mystery_box", "bundle", "promotion"];
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(id)) throw new HttpErr(400, "รหัสสินค้าต้องเป็นอังกฤษ/ตัวเลข/ขีด 3–64 ตัว");
  if (!allowed.includes(kind)) throw new HttpErr(400, "ประเภทสินค้าไม่ถูกต้อง");
  const name = String(b.name || "").trim().slice(0, 120);
  if (!name) throw new HttpErr(400, "กรุณาใส่ชื่อสินค้า");
  const price = Math.floor(Number(b.price));
  if (!Number.isFinite(price) || price < 0 || price > 10000000) throw new HttpErr(400, "ราคาไม่ถูกต้อง");
  const setId = String(b.set_id || "").trim().toUpperCase();
  if (!setId) throw new HttpErr(400, "กรุณาระบุรหัสชุดการ์ด");
  const config = b.config && typeof b.config === "object" && !Array.isArray(b.config) ? b.config : {};
  if (["special_pack","mystery_box"].includes(kind)) {
    const n = Math.floor(Number(config.size || 8));
    if (n < 1 || n > 30) throw new HttpErr(400, "จำนวนการ์ดสุ่มต้องอยู่ระหว่าง 1–30 ใบ");
    config.size = n;
  } else {
    if (!Array.isArray(config.grants) || !config.grants.length || config.grants.length > 100) throw new HttpErr(400, "Bundle/โปรโมชั่นต้องกำหนดการ์ดที่จะได้รับ");
    for (const g of config.grants) if (!g || !S.byId.has(String(g.id || "").toLowerCase()) || !Number.isInteger(Number(g.qty)) || Number(g.qty) < 1 || Number(g.qty) > 99) throw new HttpErr(400, "รหัสการ์ดหรือจำนวนในรายการของแถมไม่ถูกต้อง");
  }
  const row = { id, kind, set_id: setId, name, description: String(b.description || "").slice(0,300), price, config, active: b.active !== false, sort: Number.isFinite(Number(b.sort)) ? Math.floor(Number(b.sort)) : 500 };
  const r = await supa.db.from("shop_items").insert(row).select("id");
  if (r.error) { if (/duplicate key/i.test(r.error.message)) throw new HttpErr(409, "รหัสสินค้านี้มีอยู่แล้ว"); throw new HttpErr(500, r.error.message); }
  res.json({ ok: true, id });
}));
adminRouter.put("/shop/:id", wrap(async (req, res) => {
  const b = req.body || {}, patch = {};
  if (b.price !== undefined) { const n = Math.floor(Number(b.price)); if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw new HttpErr(400, "ราคาไม่ถูกต้อง"); patch.price = n; }
  if (b.active !== undefined) patch.active = !!b.active;
  if (b.name !== undefined) { const s = String(b.name).trim().slice(0, 120); if (!s) throw new HttpErr(400, "ใส่ชื่อสินค้า"); patch.name = s; }
  if (b.description !== undefined) patch.description = String(b.description).slice(0, 300);
  if (!Object.keys(patch).length) throw new HttpErr(400, "ไม่มีอะไรให้แก้");
  const r = supa.must(await supa.db.from("shop_items").update(patch).eq("id", req.params.id).select("id"), "shop");
  if (!r.length) throw new HttpErr(404, "ไม่พบสินค้า"); res.json({ ok: true });
}));

module.exports = { router, adminRouter, awardMatch, decksOf, ownedMap, ownedBase, baseId, ensureShopItems, openPack, baseCards };
