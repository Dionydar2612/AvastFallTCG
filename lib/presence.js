// ใครออนไลน์: เบราว์เซอร์ที่เปิดหน้าเกม/การ์ด/แอดมินอยู่ ส่ง POST /api/presence ทุก ~40 วินาที (เฉพาะตอนแท็บมองเห็นอยู่)
// เซิร์ฟเวอร์เก็บ profiles.last_seen_at (+ last_page) → "ออนไลน์" = เห็นล่าสุดไม่เกิน WINDOW_MS · ใช้ได้แม้รันหลายเครื่อง/รีสตาร์ต
const supa = require("./supa");

const WINDOW_MS = 100_000, WRITE_EVERY_MS = 30_000;
const PAGES = new Set(["game", "cards", "admin"]);
const lastWrite = new Map();
let colOk = true;
setInterval(() => { const n = Date.now(); for (const [k, v] of lastWrite) if (n - v > 10 * 60_000) lastWrite.delete(k); }, 5 * 60_000).unref();

const missing = (e) => e && /last_seen_at|last_page/.test(e.message || "");
function warnOnce(e) { if (colOk) console.error("⚠ profiles ยังไม่มีคอลัมน์ last_seen_at/last_page — รัน supabase/schema.sql ใหม่ (" + e.message + ")"); colOk = false; }

async function ping(sess, page) {
  if (!supa.enabled || !colOk) return;
  const id = sess.user.id, n = Date.now();
  if (n - (lastWrite.get(id) || 0) < WRITE_EVERY_MS) return;     // กันยิงฐานข้อมูลถี่เกินจำเป็น
  lastWrite.set(id, n);
  const r = await supa.db.from("profiles").update({ last_seen_at: new Date(n).toISOString(), last_page: PAGES.has(page) ? page : "game" }).eq("id", id);
  if (r.error) { if (missing(r.error)) warnOnce(r.error); else throw new Error(r.error.message); }
}

async function online() {
  if (!supa.enabled || !colOk) return [];
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const r = await supa.db.from("profiles").select("id,username,role,last_seen_at,last_page").gte("last_seen_at", since).order("last_seen_at", { ascending: false });
  if (r.error) { if (missing(r.error)) { warnOnce(r.error); return []; } throw new Error(r.error.message); }
  return r.data;
}

module.exports = { ping, online, WINDOW_MS, enabled: () => colOk };
