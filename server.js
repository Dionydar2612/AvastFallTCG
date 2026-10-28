// AvastFall TCG – เซิร์ฟเวอร์รวม: เกมทดลองเล่น (/) + Card List/Deckbuilder (/cards/) + card-api (/api) + หลังบ้าน (/admin)
//   /                    เกมทดลองเล่น (web/)           + /api/feedback, /recommece, /api/room/*  (lib/playtest.js)
//   /cards/              Card List + Deckbuilder (public/)  ·  /api/docs เอกสาร API
//   /api/cards ...       card-api สาธารณะ (เกมเรียกจากเซิร์ฟเวอร์เดียวกันนี้)
//   /admin               หลังบ้าน (ล็อกอินด้วยบัญชี role=admin ของ Supabase)
// ต้องล็อกอิน (Supabase Auth) ก่อนใช้งานทุกหน้า: ยังไม่ล็อกอิน → เห็นหน้า login (web/login.html) · /api/* ตอบ 401
const path = require("path");
const express = require("express");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const fs = require("fs");
const store = require("./lib/store");
const supa = require("./lib/supa");
const auth = require("./lib/auth");
const me = require("./lib/me");
const updates = require("./lib/updates");
updates.init();
const playtest = require("./lib/playtest");
const S = store.state; // แคชของฐานข้อมูลการ์ด (แก้ผ่าน /admin แล้วมีผลทันที)

const PORT = process.env.PORT || 3000;
const costOf = (c) => c.cost ?? c.sc ?? 0;
const kwOf = (c) => (c.effects || []).map((e) => e.keyword.split(" ")[0]).filter(Boolean);

const app = express();
app.set("trust proxy", 1);
// เส้นทางของเกม (feedback / ห้องออนไลน์ SSE) ต้องมาก่อน compression และ express.json — ต้องล็อกอินก่อนใช้ (ยกเว้นหน้าอ่านข้อเสนอแนะของแอดมินที่ใช้ ADMIN_KEY เดิม)
app.use((req, res, next) => {
  if (req.path === "/api/feedback" || req.path.startsWith("/api/room/")) return auth.requireAuth(req, res, next);
  next();
});
app.use(playtest.middleware);
app.use(compression());
app.use(express.json({ limit: "300kb" }));

// ---------- หน้าเว็บ: ต้องล็อกอิน + ใส่ข้อมูลผู้ใช้/เด็คที่บันทึกไว้ลงหน้า (ไม่ต้องรอโหลดซ้ำ) ----------
const readTxt = (f) => fs.readFileSync(path.join(__dirname, f), "utf8");
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, "");
// หน้า HTML จริงอ่านสดทุกครั้ง (ไฟล์เล็ก + แก้โค้ดแล้วเห็นผลทันที) ส่งแบบไม่แคชเพราะเป็นข้อมูลเฉพาะบุคคล
function page(file, onGuest) {
  return async (req, res, next) => {
    try {
      const sess = await auth.getSession(req, res);
      res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
      if (!sess) return onGuest(req, res);
      const decks = await me.decksOf(sess.user.id).catch(() => []);
      const boot = `<script>window.__AF=${safeJson({ user: auth.publicUser(sess) })};try{localStorage.setItem("cl-decks",${safeJson(JSON.stringify(decks))})}catch(e){}</script><script src="/js/af-session.js"></script>`;
      res.type("html").send(readTxt(file).replace(/<head[^>]*>/i, (m) => m + boot));
    } catch (e) { next(e); }
  };
}
const guestLogin = (_req, res) => res.type("html").send(readTxt("web/login.html"));
const guestBounce = (_req, res) => res.redirect(302, "/");
app.get(["/", "/index.html"], page("web/index.html", guestLogin));
app.get(["/hub.html"], page("web/hub.html", guestBounce));
app.get(["/packs.html"], page("web/packs.html", guestBounce));
app.get(["/cards", "/cards/", "/cards/index.html"], page("public/index.html", guestBounce));

// ---------- รูป + หน้าเว็บ ----------
app.use("/images", express.static(store.imgDir, { maxAge: "1d", setHeaders: (r) => r.setHeader("Access-Control-Allow-Origin", "*") }));
app.use("/cards", express.static(path.join(__dirname, "public"), {
  maxAge: "7d", index: "index.html",
  // โค้ดหน้าเว็บ (html/js/css) ให้เบราว์เซอร์ตรวจเวอร์ชันใหม่ทุกครั้ง ไม่งั้นแก้แล้วผู้ใช้ยังเห็นของเก่าได้ถึง 7 วัน (รูปการ์ดยังแคชตามเดิม)
  setHeaders: (res, file) => { if (/\.(html|js|css)$/i.test(file)) res.setHeader("Cache-Control", "no-cache"); },
}));

// ---------- API ----------
const api = express.Router();
api.use(rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false,
  message: { error: "too_many_requests" } }));
api.use((req, res, next) => { res.set("Cache-Control", /^\/(me|shop)/.test(req.path) ? "no-store" : "private, max-age=60"); next(); });
api.get("/health", (_req, res) => res.status(supa.startupError ? 503 : 200).json({ ok: !supa.startupError, cards: S.cards.length, supabase: supa.enabled, error: supa.startupError || undefined }));
api.get("/docs", (_req, res) => res.sendFile(path.join(__dirname, "public", "docs.html")));
api.use(auth.requireAuth);                     // ตั้งแต่ตรงนี้ลงไปต้องล็อกอิน
api.use(auth.sameOrigin);
api.use(me.router);                            // /api/me · /api/me/daily · /api/me/decks · /api/me/collection · /api/shop

const withImageUrl = (req) => (c) => (c.image ? { ...c, imageUrl: `${req.protocol}://${req.get("host")}${c.image}` } : c);


// GET /api/cards?deck=SD01&type=Unit&element=ทอง&rarity=C&rotation=A&keyword=AUTO
//               &q=ธอร์&costMin=0&costMax=3&sort=cost&order=asc&page=1&limit=50
api.get("/cards", (req, res) => {
  const q = req.query;
  const list = (v) => (v ? String(v).split(",").map((s) => s.trim().toLowerCase()) : null);
  const f = { deck: list(q.deck), type: list(q.type), element: list(q.element),
              rarity: list(q.rarity), rotation: list(q.rotation), tribe: list(q.tribe) };
  const kw = list(q.keyword);
  const text = q.q ? String(q.q).toLowerCase() : "";
  const cmin = q.costMin !== undefined ? Number(q.costMin) : -Infinity;
  const cmax = q.costMax !== undefined ? Number(q.costMax) : Infinity;

  let out = S.cards.filter((c) => {
    for (const [k, vals] of Object.entries(f)) {
      if (!vals) continue;
      const v = String(c[k] ?? "").toLowerCase();
      if (k === "element") { // Avatar หลายธาตุ: ตรงกับธาตุใดก็ได้ใน elements[]
        const vs = [v, ...((c.elements || []).map((x) => String(x).toLowerCase()))];
        if (!vs.some((x) => vals.includes(x))) return false;
        continue;
      }
      if (k === "tribe" ? !vals.some((x) => v.includes(x)) : !vals.includes(v)) return false;
    }
    if (kw && !kwOf(c).some((k) => kw.includes(k.toLowerCase()))) return false;
    const cost = costOf(c);
    if (cost < cmin || cost > cmax) return false;
    if (text) {
      const hay = [c.id, c.name, c.tribe, c.flavor, ...(c.effects || []).map((e) => e.text)]
        .join(" ").toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });

  const sortKey = ["id", "name", "type", "cost", "atk", "def"].includes(q.sort) ? q.sort : "id";
  const dir = q.order === "desc" ? -1 : 1;
  const val = (c) => (sortKey === "cost" ? costOf(c) : c[sortKey] ?? "");
  out.sort((a, b) => {
    const x = val(a), y = val(b);
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "th")) * dir;
  });

  const limit = Math.min(Math.max(parseInt(q.limit) || 100, 1), 500);
  const page = Math.max(parseInt(q.page) || 1, 1);
  const total = out.length;
  out = out.slice((page - 1) * limit, page * limit).map(withImageUrl(req));
  res.json({ total, page, limit, pages: Math.ceil(total / limit), data: out });
});

// GET /api/cards/SD01-001
api.get("/cards/:id", (req, res) => {
  const c = S.byId.get(req.params.id.toLowerCase());
  if (!c) return res.status(404).json({ error: "card_not_found" });
  res.json({ data: withImageUrl(req)(c) });
});

// POST /api/cards/batch  { "ids": ["SD01-001","SD01-002"] }  -> ใช้โหลดเด็คที่ผู้ใช้จัดไว้
api.post("/cards/batch", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 200) : null;
  if (!ids) return res.status(400).json({ error: "ids_required" });
  const found = [], missing = [];
  for (const id of ids) {
    const c = S.byId.get(String(id).toLowerCase());
    c ? found.push(withImageUrl(req)(c)) : missing.push(id);
  }
  res.json({ data: found, missing });
});

api.get("/decks", (_req, res) =>
  res.json({ data: S.decks.map((d) => ({ ...d, count: S.cards.filter((c) => c.deck === d.id).length })) }));

api.get("/decks/:id", (req, res) => {
  const d = S.decks.find((x) => x.id.toLowerCase() === req.params.id.toLowerCase());
  if (!d) return res.status(404).json({ error: "deck_not_found" });
  res.json({ data: { ...d, cards: S.cards.filter((c) => c.deck === d.id).map(withImageUrl(req)) } });
});

api.get("/elements", (_req, res) => res.json({ data: S.elements }));

// ค่าที่ใช้ทำ dropdown ตัวกรอง
api.get("/filters", (_req, res) => {
  const u = (a) => [...new Set(a.filter(Boolean))];
  res.json({ data: {
    deck: u(S.cards.map((c) => c.deck)), type: u(S.cards.map((c) => c.type)),
    element: u(S.cards.map((c) => c.element)), rarity: u(S.cards.map((c) => c.rarity)),
    rotation: u(S.cards.map((c) => c.rotation)), keyword: u(S.cards.flatMap(kwOf)).filter((k) => k !== "COST"),
    costMax: Math.max(0, ...S.cards.map(costOf)),
  } });
});

// Update Note ที่แอดมินเขียนใน /admin  (เกมดึงไปแสดงให้ผู้เล่นทุกคน ไม่แคชเพื่อให้เห็นของใหม่ทันที)
api.get("/updates", (_req, res) => { res.set("Cache-Control", "no-cache"); res.json({ data: updates.list() }); });

api.use((_req, res) => res.status(404).json({ error: "not_found" }));

app.use("/api/auth", auth.router);
app.use("/api", api);
app.use("/admin", require("./admin/router"));

// ---------- เกมทดลองเล่น (หน้าแรก) ----------
app.use(express.static(path.join(__dirname, "web"), { index: false, maxAge: 0, etag: true }));
app.use((_req, res) => res.status(404).type("text/plain; charset=utf-8").send("ไม่พบหน้านี้"));

(async () => {
  // ถ้าเชื่อม/โหลดฐานข้อมูลไม่สำเร็จ ยังเปิดเซิร์ฟเวอร์ไว้ (ให้ Render ไม่ล่ม) แต่บอกสาเหตุที่ /api/health และหน้า login
  try {
    await store.init();                                   // โหลดการ์ดจาก Supabase (ครั้งแรกจะ seed จาก data/*.json ให้)
    if (supa.enabled) await me.ensureShopItems();         // สร้างสินค้าในร้านให้ชุดที่ยังไม่มี
  } catch (e) {
    supa.startupError = e.message;
    console.error("❌ เชื่อมต่อ/โหลด Supabase ไม่สำเร็จ:", e.message);
    console.error("   เช็ก: (1) รัน supabase/schema.sql ใน SQL Editor แล้วหรือยัง (2) SUPABASE_URL / คีย์ถูกต้องไหม (3) ใช้ Node >= 22");
  }
  app.listen(PORT, () => console.log(`AvastFall TCG on http://localhost:${PORT}  ·  Supabase: ${supa.enabled ? (supa.startupError ? "เชื่อมไม่สำเร็จ" : "เชื่อมแล้ว") : "ยังไม่ได้ตั้งค่า"}  ·  การ์ด ${S.cards.length} ใบ`));
})();