// ระบบผู้ใช้: สมัคร/ล็อกอินผ่าน Supabase Auth · เซสชันเก็บเป็นคุกกี้ httpOnly (ใช้ได้ทั้งหน้าเกม, iframe, /admin)
//   POST /api/auth/signup · /login · /logout   GET /api/auth/me
//   ผู้ดูแล: profiles.role = 'admin'  (หรือใส่อีเมลใน ADMIN_EMAILS ="a@x.com,b@y.com" แล้วล็อกอินครั้งถัดไปจะถูกตั้งเป็น admin ให้เอง)
const express = require("express");
const rateLimit = require("express-rate-limit");
const supa = require("./supa");
const log = require("./log");

const START_COINS = Number(process.env.START_COINS ?? 500);
const ADMIN_EMAILS = new Set((process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
const AT = "af_at", RT = "af_rt";
const USERNAME_RE = /^[A-Za-z0-9_\u0E00-\u0E7F]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cookiesOf = (req) => Object.fromEntries((req.headers.cookie || "").split(";").map((s) => s.trim()).filter(Boolean)
  .map((s) => { const i = s.indexOf("="); try { return [s.slice(0, i), decodeURIComponent(s.slice(i + 1))]; } catch { return [s.slice(0, i), ""]; } }));
const cookieOpts = (req, maxAgeSec) => ({ httpOnly: true, sameSite: "lax", secure: !!req.secure, path: "/", maxAge: maxAgeSec * 1000 });
function setSession(req, res, s) {
  res.cookie(AT, s.access_token, cookieOpts(req, Math.max(60, s.expires_in || 3600)));
  res.cookie(RT, s.refresh_token, cookieOpts(req, 30 * 86400));
}
function clearSession(res) { res.clearCookie(AT, { path: "/" }); res.clearCookie(RT, { path: "/" }); }

// ---- แคชสั้น ๆ ลดการยิง Supabase ทุกคำขอ ----
const tokenCache = new Map();       // access token -> { user, exp }
const profCache = new Map();        // user id -> { p, exp }
const TOKEN_TTL = 60_000, PROF_TTL = 20_000;
setInterval(() => { const n = Date.now(); for (const [k, v] of tokenCache) if (v.exp < n) tokenCache.delete(k); for (const [k, v] of profCache) if (v.exp < n) profCache.delete(k); }, 60_000).unref();
const dropProfile = (id) => profCache.delete(id);

async function verify(at) {
  if (!at) return null;
  const hit = tokenCache.get(at); if (hit && hit.exp > Date.now()) return hit.user;
  const { data, error } = await supa.db.auth.getUser(at);
  if (error || !data || !data.user) return null;
  tokenCache.set(at, { user: data.user, exp: Date.now() + TOKEN_TTL });
  return data.user;
}

// โปรไฟล์เกม (ชื่อผู้ใช้ บทบาท เหรียญ) — ไม่มีก็สร้างให้ · อีเมลใน ADMIN_EMAILS = admin
async function profileOf(user) {
  const c = profCache.get(user.id); if (c && c.exp > Date.now()) return c.p;
  let p = supa.must(await supa.db.from("profiles").select("*").eq("id", user.id).maybeSingle(), "profile");
  const email = (user.email || "").toLowerCase();
  if (!p) {
    const base = String(user.user_metadata?.username || email.split("@")[0] || "player").replace(/[^A-Za-z0-9_\u0E00-\u0E7F]/g, "").slice(0, 16) || "player";
    for (let i = 0; i < 6 && !p; i++) {
      const username = i ? `${base}${Math.floor(Math.random() * 9000 + 1000)}` : base;
      const r = await supa.db.from("profiles").insert({ id: user.id, username, email, role: ADMIN_EMAILS.has(email) ? "admin" : "user", coins: START_COINS }).select().maybeSingle();
      if (!r.error) p = r.data;
      else if (!/duplicate|unique/i.test(r.error.message)) throw new Error("profile: " + r.error.message);
      else p = supa.must(await supa.db.from("profiles").select("*").eq("id", user.id).maybeSingle(), "profile");   // สร้างซ้อนกัน
    }
    if (!p) throw new Error("สร้างโปรไฟล์ไม่สำเร็จ");
  } else if (ADMIN_EMAILS.has(email) && p.role !== "admin") {
    p = supa.must(await supa.db.from("profiles").update({ role: "admin" }).eq("id", user.id).select().maybeSingle(), "promote");
  }
  profCache.set(user.id, { p, exp: Date.now() + PROF_TTL });
  return p;
}

// อ่านเซสชันจากคุกกี้ (หมดอายุ → ต่ออายุด้วย refresh token ให้เอง) → { user, profile } | null
async function getSession(req, res) {
  if (!supa.enabled) return null;
  if (req._af !== undefined) return req._af;
  const ck = cookiesOf(req);
  let user = await verify(ck[AT]).catch(() => null);
  if (!user && ck[RT] && res) {
    try {
      const { data, error } = await supa.anon().auth.refreshSession({ refresh_token: ck[RT] });
      if (!error && data && data.session) { setSession(req, res, data.session); user = data.session.user; tokenCache.set(data.session.access_token, { user, exp: Date.now() + TOKEN_TTL }); }
      else if (res.headersSent === false) clearSession(res);
    } catch { /* ใช้ไม่ได้ → ถือว่ายังไม่ล็อกอิน */ }
  }
  if (!user) return (req._af = null);
  const profile = await profileOf(user);
  return (req._af = { user, profile });
}
const { leagueOf, tiers: rankTiers } = require("./rank");
const publicUser = (s) => { const pts = Number(s.profile.rank_points) || 0;   // rank_points/wins/losses มาจาก schema.sql ใหม่ (ยังไม่ได้รัน = 0)
  return { id: s.user.id, email: s.profile.email || s.user.email, username: s.profile.username, role: s.profile.role, coins: s.profile.coins,
    points: pts, wins: Number(s.profile.wins) || 0, losses: Number(s.profile.losses) || 0, league: leagueOf(pts).name,
    rankClaimable: rankTiers(pts, s.profile.rank_claims).filter((t) => t.claimable).length }; };   // จำนวนรางวัลเลื่อนแรงค์ที่รอกดรับ

// middleware: ต้องล็อกอิน (API)
const requireAuth = async (req, res, next) => {
  try {
    if (!supa.enabled) return res.status(503).json({ error: "setup_required", message: "ยังไม่ได้ตั้งค่า Supabase บนเซิร์ฟเวอร์" });
    const s = await getSession(req, res);
    if (!s) return res.status(401).json({ error: "unauthorized" });
    req.session = s; next();
  } catch (e) { console.error("auth:", e.message); res.status(500).json({ error: "auth_error" }); }
};
const requireAdmin = (req, res, next) => (req.session && req.session.profile.role === "admin") ? next() : res.status(403).json({ error: "forbidden" });

// กันคำขอข้ามเว็บที่เปลี่ยนข้อมูล: ถ้ามี Origin ต้องเป็นโฮสต์เดียวกับเรา
const sameOrigin = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const o = req.get("origin"); if (!o) return next();
  try { if (new URL(o).host !== req.get("host")) return res.status(403).json({ error: "bad_origin" }); } catch { return res.status(403).json({ error: "bad_origin" }); }
  next();
};

const router = express.Router();
const lim = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่" } });
const fail = (res, code, msg) => res.status(code).json({ error: msg });
const authMsg = (m = "") => /invalid login|invalid credentials/i.test(m) ? "อีเมล/ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
  : /not confirmed/i.test(m) ? "ยังไม่ได้ยืนยันอีเมล — เปิดอีเมลที่ Supabase ส่งไปแล้วกดลิงก์ยืนยันก่อน"
  : /already registered|already been registered/i.test(m) ? "อีเมลนี้สมัครไปแล้ว"
  : /password/i.test(m) ? "รหัสผ่านไม่ผ่านเกณฑ์ (อย่างน้อย 8 ตัวอักษร)" : "ดำเนินการไม่สำเร็จ ลองใหม่อีกครั้ง";

router.use(sameOrigin);
router.get("/status", (_req, res) => res.json({ configured: supa.enabled, error: supa.startupError || undefined }));

router.post("/signup", lim, async (req, res) => {
  if (!supa.enabled) return fail(res, 503, "ยังไม่ได้ตั้งค่า Supabase บนเซิร์ฟเวอร์");
  const email = String(req.body?.email || "").trim().toLowerCase(), password = String(req.body?.password || ""), username = String(req.body?.username || "").trim();
  if (!EMAIL_RE.test(email)) return fail(res, 400, "อีเมลไม่ถูกต้อง");
  if (!USERNAME_RE.test(username)) return fail(res, 400, "ชื่อผู้ใช้ 3–20 ตัว ใช้ได้เฉพาะ A–Z ก–๙ 0–9 และ _");
  if (password.length < 8 || password.length > 72) return fail(res, 400, "รหัสผ่านต้องยาว 8–72 ตัวอักษร");
  try {
    const dup = supa.must(await supa.db.from("profiles").select("id").ilike("username", username).maybeSingle(), "username");
    if (dup) return fail(res, 409, "ชื่อผู้ใช้นี้ถูกใช้แล้ว");
    const { data, error } = await supa.anon().auth.signUp({ email, password, options: { data: { username } } });
    if (error) return fail(res, 400, authMsg(error.message));
    if (!data.user) return fail(res, 400, "สมัครไม่สำเร็จ");
    log.audit("signup", { req, user: { username }, status: 200, detail: { needConfirm: !data.session } });
    if (!data.session) return res.json({ ok: true, needConfirm: true });          // เปิด Confirm email ไว้ใน Supabase
    setSession(req, res, data.session); tokenCache.set(data.session.access_token, { user: data.user, exp: Date.now() + TOKEN_TTL });
    const s = await getSession({ headers: { cookie: `${AT}=${encodeURIComponent(data.session.access_token)}` } });
    res.json({ ok: true, user: publicUser(s) });
  } catch (e) { console.error("signup:", e.message); fail(res, 500, "สมัครไม่สำเร็จ ลองใหม่อีกครั้ง"); }
});

router.post("/login", lim, async (req, res) => {
  if (!supa.enabled) return fail(res, 503, "ยังไม่ได้ตั้งค่า Supabase บนเซิร์ฟเวอร์");
  let id = String(req.body?.email || req.body?.identifier || "").trim(); const password = String(req.body?.password || "");
  if (!id || !password) return fail(res, 400, "กรอกอีเมล/ชื่อผู้ใช้ และรหัสผ่าน");
  try {
    if (!id.includes("@")) {                                                        // ล็อกอินด้วยชื่อผู้ใช้ → หาอีเมลจากโปรไฟล์
      const p = supa.must(await supa.db.from("profiles").select("email").ilike("username", id).maybeSingle(), "login");
      if (!p || !p.email) return fail(res, 401, authMsg("invalid login"));
      id = p.email;
    }
    const { data, error } = await supa.anon().auth.signInWithPassword({ email: id.toLowerCase(), password });
    if (error || !data.session) { log.audit("login_fail", { req, user: { username: String(req.body?.email || req.body?.identifier || "").slice(0, 60) }, status: 401 }); return fail(res, 401, authMsg(error && error.message)); }
    setSession(req, res, data.session); tokenCache.set(data.session.access_token, { user: data.user, exp: Date.now() + TOKEN_TTL });
    const s = await getSession({ headers: { cookie: `${AT}=${encodeURIComponent(data.session.access_token)}` } });
    log.audit("login", { req, user: s.profile, status: 200 });
    res.json({ ok: true, user: publicUser(s) });
  } catch (e) { console.error("login:", e.message); fail(res, 500, "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง"); }
});

router.post("/logout", (req, res) => {
  const at = cookiesOf(req)[AT]; if (at) tokenCache.delete(at);
  clearSession(res); res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  try {
    if (!supa.enabled) return res.status(503).json({ error: "setup_required" });
    const s = await getSession(req, res);
    if (!s) return res.status(401).json({ error: "unauthorized" });
    res.json({ user: publicUser(s) });
  } catch (e) { res.status(500).json({ error: "auth_error" }); }
});

module.exports = { router, getSession, requireAuth, requireAdmin, sameOrigin, publicUser, dropProfile, cookiesOf, ADMIN_EMAILS };
