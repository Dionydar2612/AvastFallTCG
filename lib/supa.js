// ตัวเชื่อม Supabase (ฝั่งเซิร์ฟเวอร์เท่านั้น)
//   SUPABASE_URL · SUPABASE_ANON_KEY (ใช้ login/สมัคร) · SUPABASE_SERVICE_ROLE_KEY (ใช้อ่าน/เขียนฐานข้อมูล — ห้ามส่งไปเบราว์เซอร์)
const URL_ = process.env.SUPABASE_URL || "";
const ANON = process.env.SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const enabled = !!(URL_ && ANON && SERVICE);

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
let db = null;
if (enabled) {
  const { createClient } = require("@supabase/supabase-js");
  db = createClient(URL_, SERVICE, opts);                          // ฐานข้อมูล + ตรวจ token (สิทธิ์เต็ม)
  exports.anon = () => createClient(URL_, ANON, opts);             // สร้างใหม่ทุกครั้งที่ login/refresh ไม่ให้ session ปนกัน
}
exports.enabled = enabled;
exports.db = db;

// ช่วย: โยน error ถ้า query ล้มเหลว
exports.must = (r, what = "db") => {
  if (r && r.error) { const e = new Error(`${what}: ${r.error.message}`); e.cause = r.error; throw e; }
  return r ? r.data : null;
};
// ดึงทั้งตาราง (Supabase จำกัด 1000 แถว/ครั้ง)
exports.fetchAll = async (table, columns = "*", order = "id") => {
  const out = []; const page = 1000;
  for (let from = 0; ; from += page) {
    const r = await db.from(table).select(columns).order(order).range(from, from + page - 1);
    const rows = exports.must(r, table); out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
};
exports.chunk = (a, n = 200) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
