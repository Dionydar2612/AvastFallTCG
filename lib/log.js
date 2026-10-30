// บันทึกกิจกรรม (log) — 2 ชั้น
//   1) JSON 1 บรรทัดต่อเหตุการณ์ออก stdout  → Render / Fly / Docker เก็บและส่งต่อไปเครื่องมือ log ภายนอกได้ทันที (Better Stack, Loki, Datadog ฯลฯ)
//   2) เหตุการณ์สำคัญ (ล็อกอิน, สมัคร, ซื้อของ, แอดมินแก้ข้อมูล) เก็บลงตาราง audit_logs ใน Supabase → ดูได้ที่หน้า /admin แท็บ "บันทึกกิจกรรม"
// ไม่เก็บรหัสผ่าน/โทเคน: ฟิลด์ที่ชื่อมี pass/token/secret/key/cookie จะถูกปิดเป็น ***
const supa = require("./supa");

const REDACT = /pass|token|secret|key|cookie|auth/i;
function clean(v, depth = 0) {
  if (v == null) return v;
  if (typeof v === "string") return v.length > 200 ? v.slice(0, 200) + "…" : v;
  if (typeof v !== "object") return v;
  if (depth >= 3) return "[…]";
  if (Array.isArray(v)) return v.slice(0, 10).map((x) => clean(x, depth + 1));
  const o = {};
  for (const [k, x] of Object.entries(v).slice(0, 25)) o[k] = REDACT.test(k) ? "***" : clean(x, depth + 1);
  return o;
}

function line(level, msg, extra) {
  const o = { t: new Date().toISOString(), level, msg, ...extra };
  (level === "error" ? console.error : console.log)(JSON.stringify(o));
}

let tableOk = true;
// action: ข้อความสั้น ๆ เช่น "login", "login_fail", "PUT /admin/api/users/…"
function audit(action, { req, user, detail, status } = {}) {
  try {
    const u = user || (req && req.session && req.session.profile) || null;
    const row = {
      user_id: u && u.id || null, username: u && u.username || null, action: String(action).slice(0, 120),
      detail: detail === undefined ? null : clean(detail), ip: req && req.ip || null, status: status ?? null,
    };
    line("info", "audit", { action: row.action, user: row.username, status: row.status, ip: row.ip, detail: row.detail });
    if (supa.enabled && tableOk) {
      Promise.resolve(supa.db.from("audit_logs").insert(row)).then((r) => {
        if (r && r.error && /audit_logs/.test(r.error.message)) { tableOk = false; console.error("⚠ ยังไม่มีตาราง audit_logs — รัน supabase/schema.sql ใหม่ (log ยังออกทาง stdout ตามปกติ)"); }
      }).catch(() => { });
    }
  } catch { /* log ต้องไม่ทำให้เกมล้ม */ }
}

// access log: 1 บรรทัดต่อคำขอ (ข้ามไฟล์ static, health และ presence ping ที่ยิงทุก 40 วินาที)
const SKIP = /^\/(images|css|js|assets|favicon)|\.(js|css|png|jpe?g|webp|ico|svg|woff2?)$|^\/api\/(health|presence)$/i;
function accessLog(req, res, next) {
  const t = Date.now();
  res.on("finish", () => {
    const p = req.originalUrl.split("?")[0];
    if (SKIP.test(p)) return;
    line(res.statusCode >= 500 ? "error" : "info", "http", { method: req.method, path: p, status: res.statusCode, ms: Date.now() - t, user: req.session && req.session.profile && req.session.profile.username || undefined, ip: req.ip });
  });
  next();
}

// บันทึกทุกคำขอที่ "เปลี่ยนข้อมูล" (POST/PUT/DELETE) หลังผ่านการล็อกอินแล้ว
const quiet = /\/(presence|me\/decks)$/;
function auditMutations(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  res.on("finish", () => {
    const p = req.originalUrl.split("?")[0];
    if (quiet.test(p)) return;
    audit(`${req.method} ${p}`, { req, status: res.statusCode, detail: req.body && Object.keys(req.body).length ? req.body : undefined });
  });
  next();
}

// ลบ log เก่ากว่า KEEP_DAYS วัน (วันละครั้ง) กันตารางโต
const KEEP_DAYS = Number(process.env.AUDIT_KEEP_DAYS ?? 30);
function startCleanup() {
  if (!supa.enabled) return;
  const run = () => Promise.resolve(supa.db.from("audit_logs").delete().lt("at", new Date(Date.now() - KEEP_DAYS * 864e5).toISOString())).catch(() => { });
  setTimeout(run, 30_000).unref(); setInterval(run, 24 * 3600_000).unref();
}

module.exports = { audit, accessLog, auditMutations, line, startCleanup };
