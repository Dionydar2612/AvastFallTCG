// หลังบ้าน /admin — ต้องล็อกอินด้วยบัญชี Supabase ที่มี profiles.role = 'admin' (หรืออีเมลอยู่ใน ADMIN_EMAILS)
// เพิ่ม/แก้/ลบการ์ด · นำเข้า Excel · เด็ค · สำรอง/กู้คืน → บันทึกลงฐานข้อมูล Supabase ทันที (lib/store.js) · จัดการผู้ใช้และราคาสินค้าในร้านด้วย
const path = require("path");
const express = require("express"), multer = require("multer");
const updates = require("../lib/updates"), store = require("../lib/store"), imp = require("../lib/importer"), xl = require("../lib/xlsx");
const auth = require("../lib/auth"), me = require("../lib/me"), supa = require("../lib/supa");
const systemControl = require("../lib/system-control");
const crypto = require("crypto");
const S = store.state;

const router = express.Router();
router.use((_req, res, next) => { res.set({ "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" }); next(); });
// หน้าหลังบ้าน: ยังไม่ล็อกอิน → ไปหน้า login แล้วกลับมาที่นี่ · ล็อกอินแล้วแต่ไม่ใช่แอดมิน → แจ้งไม่มีสิทธิ์
router.get("/", async (req, res, next) => {
  try {
    const sess = await auth.getSession(req, res);
    if (!sess) return res.redirect(302, "/?next=/admin");
    if (sess.profile.role !== "admin") return res.status(403).type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ไม่มีสิทธิ์</title><body style="font-family:sans-serif;max-width:520px;margin:15vh auto;padding:0 16px"><h2>🔒 บัญชีนี้ไม่มีสิทธิ์เข้าหลังบ้าน</h2><p>ล็อกอินอยู่ในชื่อ <b>${String(sess.profile.username).replace(/[<&>]/g, "")}</b> (role: ${sess.profile.role}) — ให้ผู้ดูแลตั้ง role เป็น admin ให้ก่อน</p><p><a href="/">← กลับหน้าหลัก</a></p></body>`);
    res.sendFile(path.join(__dirname, "index.html"));
  } catch (e) { next(e); }
});
router.get("/clip.js", (_req, res) => res.type("application/javascript").sendFile(path.join(__dirname, "clip.js")));

const api = express.Router();
const up = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 101 } });
const wrapA = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => res.status(400).json({ error: e.message }));

// หน้าหลังบ้านเรียกตรวจก่อนว่าล็อกอินเป็นแอดมินอยู่ไหม
api.get("/me", async (req, res) => {
  try { const s = await auth.getSession(req, res); res.json({ enabled: supa.enabled, authed: !!s && s.profile.role === "admin", user: s ? auth.publicUser(s) : null }); }
  catch { res.json({ enabled: supa.enabled, authed: false }); }
});

// ---- ต้องเป็นแอดมินตั้งแต่ตรงนี้ ----
api.use(auth.requireAuth, auth.requireAdmin);
api.use((req, res, next) => {
  if (req.method !== "GET" && req.get("x-admin") !== "1") return res.status(403).json({ error: "bad_request" });
  next();
});
api.use(auth.sameOrigin);
api.use(require("../lib/log").auditMutations);   // ทุกการแก้ไขของแอดมิน (การ์ด, ราคา, เหรียญ, สิทธิ์, นำเข้า, กู้คืน) ลง audit_logs
api.use(me.adminRouter);                          // /users · /shop

api.get("/cards", (_req, res) => res.json({ data: S.cards, decks: S.decks, elements: Object.keys(S.elements) }));
api.get("/cards/archived", (_req, res) => res.json({ data: S.raw.filter(c => c.archived_at).map(c => ({ ...c, archived_at: c.archived_at })) }));
api.post("/cards/:id/archive", wrapA(async (req, res) => { const ok = await store.setArchived(req.params.id, true); if (!ok) return res.status(404).json({ error: "ไม่พบการ์ด" }); res.json({ ok: true }); }));
api.post("/cards/:id/restore", wrapA(async (req, res) => { const ok = await store.setArchived(req.params.id, false); if (!ok) return res.status(404).json({ error: "ไม่พบการ์ด" }); res.json({ ok: true }); }));
const CARD_TYPES = ["Avatar", "Unit", "Spell", "Ultimate"];
const TYPE_ALIAS = { "อวตาร": "Avatar", "ยูนิต": "Unit", "สเปล": "Spell", "อัลติเมท": "Ultimate", "อัลติเมต": "Ultimate" };
const typeOf = (raw) => CARD_TYPES.find((x) => x.toLowerCase() === raw.toLowerCase()) || TYPE_ALIAS[raw];
// ใส่ฟิลด์ที่เหลือ (ธาตุ ค่าสถานะ เอฟเฟกต์ ฯลฯ) จากฟอร์มลงในการ์ด · โยน Error ถ้าข้อมูลไม่ถูกต้อง
function fillCard(card, b) {
  for (const k of ["sub", "rarity", "rotation", "artist", "tribe", "flavor"]) {
    const v = String(b[k] || "").trim(); if (v) card[k] = v;
  }
  // ธาตุ: รับ element (+ element2 สำหรับ 2 ธาตุ) หรือ "ไฟ/มืด" ในช่องเดียว · เก็บแบบเดียวกับตอนนำเข้า Excel (element = ธาตุแรก, elements = ทั้งหมด)
  const els = [b.element, b.element2].flatMap((v) => String(v || "").split(/[\/,，、]/)).map((x) => x.trim().replace(/^ธาตุ/, "")).filter(Boolean);
  const uniq = [...new Set(els)];
  if (uniq.length > 2) throw new Error("การ์ดใบหนึ่งใส่ธาตุได้สูงสุด 2 ธาตุ");
  if (!uniq.length && String(b.element2 || "").trim()) throw new Error("ใส่ธาตุที่ 1 ก่อนใส่ธาตุที่ 2");
  if (uniq.length) { card.element = uniq[0]; if (uniq.length > 1) card.elements = uniq; }
  for (const k of ["cost", "cri", "atk", "def", "sc"]) {
    const v = String(b[k] ?? "").trim();
    if (v !== "") { if (!Number.isFinite(Number(v))) throw new Error(`${k.toUpperCase()} ต้องเป็นตัวเลข`); card[k] = Number(v); }
  }
  card.effects = [];
  for (let i = 1; i <= 5; i++) {
    const keyword = String(b[`effect${i}_keyword`] || "").trim();
    const text = String(b[`effect${i}_text`] || "").trim();
    if (text) card.effects.push({ keyword, text });
    else if (keyword) throw new Error(`เอฟเฟกต์ ${i}: ใส่ข้อความเอฟเฟกต์ด้วย หรือเอาคีย์เวิร์ดออก`);
  }
  return card;
}
function readImage(file) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("รูปต้องมีขนาดไม่เกิน 5MB");
  const ext = magic(file.buffer);
  if (!ext) throw new Error("ไฟล์รูปไม่ถูกต้อง รองรับ JPG, PNG และ WEBP");
  return { ext, buffer: file.buffer };
}

// เพิ่ม/แก้ไขการ์ดทีละใบจากฟอร์ม โดยไม่ต้องใช้ Excel
api.post("/cards", up.single("image"), async (req, res) => {
  try {
    const b = req.body || {};
    const deck = String(b.deck || "").trim();
    const noRaw = String(b.no || "").trim();
    const variant = String(b.variant || "").trim();
    const name = String(b.name || "").trim();
    const typeRaw = String(b.type || "").trim();
    const type = typeOf(typeRaw);
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(deck)) return res.status(400).json({ error: "เด็ค/ซีรีส์ใช้ได้เฉพาะ A–Z, 0–9, - และ _ (ไม่เกิน 40 ตัว)" });
    if (!/^\d{1,4}$/.test(noRaw)) return res.status(400).json({ error: "เลขการ์ดต้องเป็นตัวเลข 1–4 หลัก เช่น 001" });
    if (variant && !/^[A-Za-z0-9]+$/.test(variant)) return res.status(400).json({ error: "เวอร์ชันพิเศษใช้ได้เฉพาะ A–Z และ 0–9 เช่น SR" });
    if (!name) return res.status(400).json({ error: "กรุณากรอกชื่อการ์ด" });
    if (!type) return res.status(400).json({ error: "กรุณาเลือกประเภทการ์ด" });
    const no = noRaw.padStart(3, "0"), id = `${deck}-${no}${variant}`;
    const old = S.raw.find((c) => c.id.toLowerCase() === id.toLowerCase());
    if (old) return res.status(409).json({ error: `รหัส ${id} มีอยู่แล้ว หากต้องการแก้ไข ให้ใช้ Excel นำเข้าทับหรือแก้ข้อมูลผ่านวิธีที่รองรับ` });
    const card = fillCard({ id, deck, no, name, type }, b);
    const image = readImage(req.file);
    const merged = imp.mergeCards(S.raw, [card], false);
    const decks = S.decks.some((d) => d.id.toLowerCase() === deck.toLowerCase())
      ? undefined
      : [...S.decks, { id: deck, name: deck }].sort((a, b) => a.id.localeCompare(b.id));
    await store.save({ cards: merged.result, decks }, `manual add ${id}`);
    if (image) store.saveImage(id, image.ext, image.buffer);
    res.json({ ok: true, card: S.byId.get(id.toLowerCase()), imageSaved: !!image });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// แก้ไขการ์ดที่มีอยู่แล้วทีละใบ (id/เด็ค/เลขการ์ดเปลี่ยนไม่ได้) + เปลี่ยนรูปการ์ดได้ถ้าแนบรูปมา
api.put("/cards/:id", up.single("image"), async (req, res) => {
  try {
    const old = S.raw.find((c) => c.id.toLowerCase() === req.params.id.toLowerCase());
    if (!old) return res.status(404).json({ error: "ไม่พบการ์ด" });
    const b = req.body || {};
    const name = String(b.name || "").trim();
    const type = typeOf(String(b.type || "").trim());
    if (!name) return res.status(400).json({ error: "กรุณากรอกชื่อการ์ด" });
    if (!type) return res.status(400).json({ error: "กรุณาเลือกประเภทการ์ด" });
    const base = { ...old, name, type };
    for (const k of ["sub", "element", "elements", "rarity", "rotation", "artist", "tribe", "flavor", "cost", "cri", "atk", "def", "sc", "effects"]) delete base[k];
    const card = fillCard(base, b);
    const image = readImage(req.file);
    const merged = imp.mergeCards(S.raw, [card], false);
    await store.save({ cards: merged.result }, `manual edit ${old.id}`);
    if (image) store.saveImage(old.id, image.ext, image.buffer);
    res.json({ ok: true, card: S.byId.get(old.id.toLowerCase()), imageSaved: !!image });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

api.delete("/cards/:id", wrapA(async (req, res) => {
  const ok = await store.setArchived(req.params.id, true);
  if (!ok) return res.status(404).json({ error: "ไม่พบการ์ด" });
  res.json({ ok: true, archived: true });
}));

api.put("/decks/:id", wrapA(async (req, res) => {
  const b = req.body || {}, id = req.params.id;
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(id)) return res.status(400).json({ error: "id เด็คใช้ได้เฉพาะ A-Z 0-9 _ -" });
  const d = { id, name: String(b.name || id).slice(0, 100) };
  if (b.total !== "" && b.total != null) { if (isNaN(Number(b.total))) return res.status(400).json({ error: "total ต้องเป็นตัวเลข" }); d.total = Number(b.total); }
  for (const k of ["rotation", "element", "rarity", "artist"]) if (b[k]) d[k] = String(b[k]).slice(0, 100);
  await store.save({ decks: [...S.decks.filter((x) => x.id !== id), d].sort((a, b) => a.id.localeCompare(b.id)) }, `deck ${id}`);
  res.json({ ok: true });
}));
api.delete("/decks/:id", wrapA(async (req, res) => {
  if (S.raw.some((c) => c.deck === req.params.id)) return res.status(409).json({ error: "ยังมีการ์ดในเด็คนี้ ลบการ์ดก่อน" });
  await store.save({ decks: S.decks.filter((x) => x.id !== req.params.id) }, `delete deck ${req.params.id}`);
  res.json({ ok: true });
}));

// ---- Excel ----
api.get("/template.xlsx", async (_req, res) => {
  const buf = await xl.build({ cards: [], decks: S.decks });
  res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="cards-template.xlsx"' }).send(buf);
});
api.get("/export.xlsx", async (_req, res) => {
  const buf = await xl.build({ cards: S.raw, decks: S.decks });
  res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="cards-current.xlsx"' }).send(buf);
});

// ขั้นที่ 1: อ่านไฟล์ -> ส่งหัวคอลัมน์ + ข้อเสนอการจับคู่
api.post("/import/inspect", up.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "ยังไม่ได้เลือกไฟล์" });
    const book = await xl.readBook(req.file.buffer, req.file.originalname);
    if (!book.sheets.length) return res.status(400).json({ error: "ไฟล์ว่างเปล่า" });
    const sheets = book.sheets.map((s) => ({ name: s.name, headers: s.headers, rowCount: s.rows.length, sample: s.rows.slice(0, 3), mapping: imp.autoMap(s.headers) }));
    const def = sheets.find((s) => s.name.toLowerCase() === "cards") || sheets.find((s) => !["decks", "วิธีใช้"].includes(s.name.toLowerCase())) || sheets[0];
    res.json({ fields: imp.FIELDS.map(({ key, label, required }) => ({ key, label, required: !!required })), sheets, defaultSheet: def.name });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ขั้นที่ 2: dry=1 ตรวจอย่างเดียว / dry=0 บันทึกจริง
api.post("/import/run", up.fields([{ name: "file", maxCount: 1 }, { name: "images", maxCount: 100 }]), async (req, res) => {
  try {
    const excelFile = req.files?.file?.[0];
    const imageFiles = req.files?.images || [];
    if (!excelFile) return res.status(400).json({ error: "ยังไม่ได้เลือกไฟล์ Excel/CSV" });
    const dry = req.body.dry !== "0", replace = req.body.mode === "replace";
    const mapping = JSON.parse(req.body.mapping || "{}");
    const book = await xl.readBook(excelFile.buffer, excelFile.originalname);
    const sheet = book.sheets.find((s) => s.name === req.body.sheet) || book.sheets[0];
    if (!sheet) return res.status(400).json({ error: "ไม่พบชีทที่เลือก" });

    const errors = [], warns = [];
    const imageChecks = [], imageById = new Map();
    for (const f of imageFiles) {
      const name = Buffer.from(f.originalname, "latin1").toString("utf8");
      const mt = name.match(/^([A-Za-z0-9][A-Za-z0-9_-]{0,40})\.(jpe?g|png|webp)$/i);
      if (!mt) { errors.push(`รูป "${name}": ชื่อไฟล์ต้องตรงกับ id การ์ด เช่น SD04-001.jpg`); continue; }
      if (f.size > 5 * 1024 * 1024) { errors.push(`รูป "${name}": ไฟล์ใหญ่เกิน 5MB`); continue; }
      const ext = magic(f.buffer);
      if (!ext) { errors.push(`รูป "${name}": เนื้อหาไฟล์ไม่ใช่รูป JPG/PNG/WEBP ที่รองรับ`); continue; }
      const id = mt[1], key = id.toLowerCase();
      if (imageById.has(key)) { errors.push(`มีรูปซ้ำสำหรับ id ${id}`); continue; }
      imageById.set(key, { id, ext, buffer: f.buffer, name });
      imageChecks.push({ file: name, id, ext });
    }
    let decks = S.decks;
    const dsheet = book.sheets.find((s) => s !== sheet && ["decks", "deck", "เด็ค"].includes(s.name.toLowerCase()));
    let deckInfo = null;
    if (dsheet) {
      const pd = imp.parseDecks(dsheet); errors.push(...pd.errors);
      decks = imp.mergeDecks(S.decks, pd.decks, replace);
      deckInfo = { fromSheet: dsheet.name, count: pd.decks.length };
    }
    const incomingIds = new Set(imageById.keys());
    const r = imp.rowsToCards(sheet, mapping, { decks: Object.fromEntries(decks.map((d) => [d.id, d])), elements: S.elements, hasImage: (id) => store.hasImage(id) || incomingIds.has(String(id).toLowerCase()) });
    errors.push(...r.errors); warns.push(...r.warns);
    const importedIds = new Set(r.cards.map((c) => c.id.toLowerCase()));
    const knownIds = new Set([...S.raw.map((c) => c.id.toLowerCase()), ...importedIds]);
    const matchedImages = imageChecks.filter((im) => knownIds.has(im.id.toLowerCase()));
    const unmatchedImages = imageChecks.filter((im) => !knownIds.has(im.id.toLowerCase()));
    if (unmatchedImages.length) warns.push(...unmatchedImages.map((im) => `รูป ${im.file}: ไม่พบ id นี้ในข้อมูลการ์ดที่จะนำเข้าหรือในระบบ รูปนี้จะไม่ถูกบันทึก`));
    if (errors.length) return res.json({ ok: false, errors, warns, images: { total: imageFiles.length, matched: matchedImages, unmatched: unmatchedImages } });

    const m = imp.mergeCards(S.raw, r.cards, replace);
    if (!dry) {
      await store.save({ cards: m.result, decks: dsheet ? decks : undefined }, `import ${excelFile.originalname}${replace ? " (replace)" : ""}`);
      for (const im of matchedImages) store.saveImage(im.id, im.ext, im.buffer);
    }
    res.json({ ok: true, dry, stats: { added: m.added, updated: m.updated, same: m.same, removed: m.removed, total: m.result.length },
      images: { total: imageFiles.length, matched: matchedImages.map(({ file, id, ext }) => ({ file, id, ext })), unmatched: unmatchedImages },
      deckInfo, warns: warns.slice(0, 200), changes: m.changes.filter((c) => c.status !== "same").slice(0, 300) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- รูป ----
const magic = (b) => (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "jpg"
  : b.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? "png"
  : b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" ? "webp" : null);
api.post("/images", up.array("files", 100), (req, res) => {
  const out = (req.files || []).map((f) => {
    const name = Buffer.from(f.originalname, "latin1").toString("utf8");
    const mt = name.match(/^([A-Za-z0-9][A-Za-z0-9_-]{0,40})\.(jpe?g|png|webp)$/i);
    if (!mt) return { file: name, ok: false, error: "ชื่อไฟล์ต้องเป็น <id>.jpg เช่น SD04-001.jpg" };
    if (f.size > 5 * 1024 * 1024) return { file: name, ok: false, error: "ไฟล์ใหญ่เกิน 5MB" };
    const ext = magic(f.buffer); if (!ext) return { file: name, ok: false, error: "ไม่ใช่ไฟล์รูป jpg/png/webp" };
    store.saveImage(mt[1], ext, f.buffer);
    return { file: name, ok: true, id: mt[1], saved: `${mt[1]}.${ext}`, hasCard: S.byId.has(mt[1].toLowerCase()) };
  });
  res.json({ results: out });
});

// ---- Update Note (โน้ตแจ้งอัปเดตที่ผู้เล่นทุกคนเห็นในเกม) ----
api.get("/updates", (_req, res) => res.json({ data: updates.list() }));
api.post("/updates", async (req, res) => {
  try { res.json({ ok: true, note: await updates.add(req.body) }); } catch (e) { res.status(400).json({ error: e.message }); }
});
api.put("/updates/:id", async (req, res) => {
  try { const n = await updates.update(req.params.id, req.body); n ? res.json({ ok: true, note: n }) : res.status(404).json({ error: "ไม่พบโน้ตนี้" }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
api.delete("/updates/:id", async (req, res) => {
  try { (await updates.remove(req.params.id)) ? res.json({ ok: true }) : res.status(404).json({ error: "ไม่พบโน้ตนี้" }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Scheduled announcements ----
api.get("/announcements", wrapA(async (_req, res) => {
  const rows = supa.must(await supa.db.from("system_announcements").select("*").order("created_at", { ascending: false }).limit(200), "announcements");
  res.json({ data: rows });
}));
api.post("/announcements", wrapA(async (req, res) => {
  const b = req.body || {}, title = String(b.title || "").trim().slice(0, 140), body = String(b.body || "").trim().slice(0, 5000);
  if (!title || !body) throw new Error("กรุณากรอกหัวข้อและรายละเอียดประกาศ");
  const kind = ["news","patch","warning","maintenance","emergency"].includes(b.kind) ? b.kind : "news";
  const status = ["draft","scheduled","published"].includes(b.status) ? b.status : "draft";
  const row = { id: crypto.randomBytes(8).toString("hex"), title, body, kind, status, publish_at: b.publish_at || null, expires_at: b.expires_at || null, pinned: !!b.pinned };
  supa.must(await supa.db.from("system_announcements").insert(row), "create announcement"); res.json({ ok: true, data: row });
}));
api.put("/announcements/:id", wrapA(async (req, res) => {
  const b = req.body || {}, patch = {};
  for (const k of ["title","body","kind","status","publish_at","expires_at","pinned"]) if (b[k] !== undefined) patch[k] = b[k];
  patch.updated_at = new Date().toISOString();
  const rows = supa.must(await supa.db.from("system_announcements").update(patch).eq("id", req.params.id).select("*"), "update announcement");
  if (!rows?.length) return res.status(404).json({ error: "ไม่พบประกาศ" }); res.json({ ok: true, data: rows[0] });
}));
api.delete("/announcements/:id", wrapA(async (req, res) => { supa.must(await supa.db.from("system_announcements").delete().eq("id", req.params.id), "delete announcement"); res.json({ ok: true }); }));

// ---- Control Center: health, maintenance, snapshot ----
api.get("/system/status", wrapA(async (_req, res) => {
  const c = await systemControl.get();
  let db = { connected: false, latency_ms: null, error: null };
  if (supa.enabled) { const t = Date.now(); try { supa.must(await supa.db.from("app_meta").select("key").limit(1), "db ping"); db = { connected: true, latency_ms: Date.now() - t, error: null }; } catch (e) { db.error = e.message; } }
  const mem = process.memoryUsage();
  res.json({ ok: true, uptime_seconds: Math.floor(process.uptime()), node: process.version, environment: process.env.NODE_ENV || "development", database: db, memory: { rss_bytes: mem.rss, heap_used_bytes: mem.heapUsed, heap_total_bytes: mem.heapTotal }, cards: { active: S.cards.length, archived: S.raw.filter(x => x.archived_at).length }, maintenance: c.maintenance, updated_at: c.updated_at, snapshot: c.snapshot || snapshotMeta });
}));
api.put("/system/maintenance", wrapA(async (req, res) => {
  const allowed = ["game", "matchmaking", "shop", "cards", "global"], incoming = req.body?.maintenance || {};
  const maintenance = {};
  for (const k of allowed) if (incoming[k] !== undefined) { if (typeof incoming[k] !== "boolean") throw new Error(`${k} ต้องเป็น true/false`); maintenance[k] = incoming[k]; }
  const messages = {};
  for (const k of allowed) if (req.body?.messages?.[k] !== undefined) messages[k] = String(req.body.messages[k]).slice(0, 300);
  const saved = await systemControl.update({ maintenance, messages });
  res.json({ ok: true, maintenance: saved.maintenance, messages: saved.messages });
}));
let snapshotMeta = { generated_at: null, sha256: null, cards: 0, decks: 0 };
function makeSnapshot() {
  const active = S.raw.filter(c => !c.archived_at);
  const DECKS = Object.fromEntries(S.decks.map(d => [d.id, { name: d.name || d.id, total: d.total, rot: d.rotation, el: d.element || "", rar: d.rarity, art: d.artist }]));
  const CARDS = active.filter(c => c.deck && c.no).map(c => ({ deck: c.deck, no: String(c.no), name: c.name, type: c.type, sub: c.sub, cost: c.cost, sc: c.sc, atk: c.atk, def: c.def ?? c.defense, cri: c.cri, tribe: c.tribe, fx: (c.effects || []).map(e => [e.keyword || "", e.text || ""]), fl: c.flavor || "", element: c.element, elements: c.elements, rarity: c.rarity, artist: c.artist || "" }));
  return `/* Generated manually from Supabase by AvastFall Admin. Do not edit by hand. */\nglobalThis.AF = globalThis.AF || {};\nAF.SNAPSHOT=${JSON.stringify({ DECKS, CARDS, ELEMENTS: S.elements }, null, 1)};\n`;
}
api.post("/system/snapshot/generate", wrapA(async (_req, res) => {
  if (!supa.enabled || supa.startupError) throw new Error("Database ไม่พร้อมใช้งาน จึงไม่สร้าง Snapshot จากข้อมูลที่อาจไม่ครบ");
  const source = makeSnapshot(), hash = crypto.createHash("sha256").update(source).digest("hex");
  snapshotMeta = { generated_at: new Date().toISOString(), sha256: hash, cards: S.cards.length, decks: S.decks.length };
  await systemControl.update({ snapshot: snapshotMeta });
  res.set({ "Content-Type": "application/javascript; charset=utf-8", "Content-Disposition": 'attachment; filename="snapshot.js"' }).send(source);
}));

// ---- สำรอง/กู้คืน ----
api.get("/backups", wrapA(async (_req, res) => res.json({ data: await store.listBackups() })));
api.post("/backups/restore", async (req, res) => {
  try { await store.restore(String(req.body?.name || "")); res.json({ ok: true }); } catch (e) { console.error("restore:", e.message); res.status(400).json({ error: "กู้คืนไม่สำเร็จ" }); }
});

api.use((err, _req, res, _next) => res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "ไฟล์ใหญ่เกิน 10MB" : err.message }));
router.use("/api", api);
module.exports = router;
