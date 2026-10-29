// Update Note: โน้ตแจ้งอัปเดตที่แอดมินเขียนใน /admin แล้วแสดงให้ผู้เล่นทุกคน
// เก็บใน Supabase (ตาราง update_notes) เหมือนข้อมูลการ์ด — ลบ/แก้แล้วคงอยู่ถาวร ไม่ย้อนกลับตอนรีสตาร์ต/deploy ใหม่
//   - state ในหน่วยความจำเป็นแคชของฐานข้อมูล: โหลดตอนเริ่มเซิร์ฟเวอร์ แล้วอัปเดตทุกครั้งที่เพิ่ม/แก้/ลบ (ถ้าเขียนฐานข้อมูลไม่สำเร็จ แคชไม่เปลี่ยน)
//   - ครั้งแรกที่ตารางยังว่าง จะใส่ข้อมูลเริ่มต้นให้ "ครั้งเดียว" (จาก data/updates.json เดิมถ้ามี ไม่งั้นใช้ SEED ด้านล่าง) แล้วบันทึกเครื่องหมายไว้ใน app_meta
//     ต่อให้แอดมินลบหมดทุกข้อความ ก็จะไม่ถูกใส่กลับมาอีก
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const store = require("./store");
const supa = require("./supa");

const legacyFile = () => path.join(store.dataDir, "updates.json");   // ไฟล์รุ่นเก่า (ใช้นำเข้าครั้งแรกเท่านั้น)
const SEEDED_KEY = "update_notes_seeded";
const NEED_TABLE = "ยังไม่มีตาราง update_notes ในฐานข้อมูล — เปิด Supabase → SQL Editor แล้วรัน supabase/schema.sql ใหม่อีกครั้ง";
const MAX_NOTES = 200, MAX_ITEMS = 30;

// ครั้งแรกที่ยังไม่มีไฟล์ จะใส่ Update Note เดิมที่เคยเขียนไว้ในโค้ดให้ (แอดมินลบทิ้งได้ในหน้า /admin)
const SEED = [
  { date: "2026-10-23", title: "รวมการสร้างเด็คไว้ที่ Deckbuilder", items: ["การสร้าง/แก้ไข/ลบ/นำเข้าเด็คทั้งหมดอยู่ที่แท็บ Deckbuilder ที่เดียว เด็คที่บันทึกแล้วจะมาให้เลือกในหน้าเล่นทันที (เด็คที่เคยสร้างไว้ในเกมรุ่นเก่าย้ายมาให้อัตโนมัติ)", "หน้าเลือกเด็คแสดงเฉพาะเด็คปัจจุบัน กด \"เปลี่ยนเด็ค\" เพื่อเลือกเด็คอื่น", "ย้าย \"วิธีเล่น\" และ \"Update Note\" (ไอคอนกระดิ่ง) ขึ้นไปที่แถบเมนูด้านบน และนำชิปสถานะการ์ดกับปุ่มกติกาโดยย่อออกจากหน้าเล่น", "อัปเดตการ์ดชุด BT01 JUGGERNAUT ETERNAL (รูปและข้อความตามไฟล์ล่าสุด) และเปลี่ยนการ์ดตัวอย่างในหน้า \"วิธีเล่น\" เป็นการ์ดชุด BT01"] },
  { date: "2026-10-23", title: "รวมเว็บ + ปรับข้อความการ์ด", items: ["เว็บเกมและ Card List รวมอยู่ที่โดเมนเดียวกัน สลับระหว่าง Playtest กับ Card List ได้ด้วยแท็บเลื่อนด้านบน (เกมที่เล่นค้างไว้ไม่หายเวลาสลับแท็บ) เกมดึงข้อมูลการ์ดและรูปจากเซิร์ฟเวอร์เดียวกัน", "BT01-001 ผู้คุมไฟนรก ซาลอุน: ปรับข้อความเอฟเฟกต์ AUTO ให้ชัดเจนว่า Unit ที่เพิ่งลงสนามได้รับผลนี้เช่นกัน การทำงานในเกมเหมือนเดิม"] },
  { date: "2026-10-20", title: "ปรับห้องออนไลน์", items: ["ตั้งชื่อที่แสดงตอนเล่นได้ในหน้าห้อง (ไม่ใส่จะเป็น ผู้เล่น 1/2) ระบบจำชื่อไว้ในเบราว์เซอร์", "ถ้าฝ่ายใดกดยอมแพ้หรือออกจากเกมในโหมดออนไลน์ ทั้งสองฝ่ายจะกลับมาหน้าแรกทันที"] },
  { date: "2026-10-20", title: "เล่นออนไลน์กับเพื่อน", items: ["เพิ่มโหมด \"เล่นออนไลน์กับเพื่อน\": กด \"สร้างห้อง\" แล้วส่งรหัสห้อง 5 ตัว (หรือลิงก์) ให้เพื่อน เพื่อนกรอกรหัสเข้าห้อง ต่างคนต่างเลือกเด็คของตัวเอง กด \"พร้อม\" ทั้งคู่แล้วเกมเริ่ม ใครเล่นก่อนสุ่มให้", "ห้องเป็นแบบส่วนตัว ใช้เล่นกันสองคนเท่านั้น ถ้าเน็ตสะดุดระบบจะต่อใหม่ให้เอง แต่ถ้ารีเฟรชหน้าระหว่างเกม เกมนั้นจะเล่นต่อไม่ได้", "ทั้งสองคนควรเปิดหน้าเว็บในเวอร์ชันเดียวกัน ถ้าข้อมูลการ์ดไม่ตรงกัน ระบบจะแจ้งและไม่เริ่มเกม ให้รีเฟรชแล้วเข้าห้องใหม่"] },
  { date: "2026-10-20", title: "ปรับหน้าตา", items: ["เปลี่ยนปุ่ม \"ข้อสังเกต\" เป็น \"Update Note\""] },
];

let notes = [];
let ready = false;                                              // false = ใช้ฐานข้อมูลไม่ได้ (ยังไม่ตั้ง Supabase หรือยังไม่มีตาราง) → อ่านได้อย่างเดียว
const sortNotes = () => notes.sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at));
const toRow = (n) => ({ id: n.id, note_date: n.date, title: n.title, items: n.items, at: n.at });
const fromRow = (r) => ({ id: r.id, at: new Date(r.at).toISOString(), date: r.note_date, title: r.title, items: Array.isArray(r.items) ? r.items : [] });
const seedNotes = () => {
  try { const a = JSON.parse(fs.readFileSync(legacyFile(), "utf8")); if (Array.isArray(a) && a.length) return a.filter((n) => n && n.title && Array.isArray(n.items)); }
  catch (e) { if (e.code !== "ENOENT") console.error("อ่าน updates.json เดิมไม่ได้ (ข้ามไปใช้ข้อมูลเริ่มต้น):", e.message); }
  const base = Date.now() - SEED.length * 1000;
  return SEED.map((n, i) => ({ id: crypto.randomBytes(6).toString("hex"), at: new Date(base + (SEED.length - i) * 1000).toISOString(), ...n }));
};
const need = () => { if (!ready) throw new Error(supa.enabled ? NEED_TABLE : "ยังไม่ได้ตั้งค่า Supabase จึงบันทึกไม่ได้"); };

async function init() {
  if (!supa.enabled) { notes = seedNotes(); sortNotes(); return; }         // โหมดอ่านอย่างเดียว (ไม่มีฐานข้อมูล)
  try {
    let rows = await supa.fetchAll("update_notes", "*", "id");
    if (!rows.length) {
      const done = supa.must(await supa.db.from("app_meta").select("key").eq("key", SEEDED_KEY).maybeSingle(), "app_meta");
      if (!done) {                                                         // ยังไม่เคยใส่ข้อมูลเริ่มต้น → ใส่ครั้งเดียว
        const seed = seedNotes().map((n) => toRow({ id: n.id || crypto.randomBytes(6).toString("hex"), at: n.at || new Date().toISOString(), date: n.date, title: n.title, items: n.items }));
        for (const part of supa.chunk(seed)) supa.must(await supa.db.from("update_notes").upsert(part), "seed update_notes");
        supa.must(await supa.db.from("app_meta").upsert({ key: SEEDED_KEY, value: { at: new Date().toISOString(), n: seed.length } }), "seed marker");
        rows = await supa.fetchAll("update_notes", "*", "id");
      }
    }
    notes = rows.map(fromRow); ready = true;
  } catch (e) {
    console.error("⚠ โหลด Update Note จากฐานข้อมูลไม่สำเร็จ:", e.message);
    console.error("  " + NEED_TABLE);
    notes = []; ready = false;
  }
  sortNotes();
}

function clean(b) {
  const title = String(b?.title ?? "").trim().slice(0, 120);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.date ?? "")) ? String(b.date) : new Date().toISOString().slice(0, 10);
  const raw = Array.isArray(b?.items) ? b.items : String(b?.items ?? "").split(/\r?\n/);
  const items = raw.map((s) => String(s).trim().slice(0, 600)).filter(Boolean).slice(0, MAX_ITEMS);
  if (!title) throw new Error("กรุณาใส่หัวข้อ");
  if (!items.length) throw new Error("กรุณาใส่รายละเอียดอย่างน้อย 1 บรรทัด");
  return { title, date, items };
}
const list = () => notes;
async function add(b) {
  need();
  const n = { id: crypto.randomBytes(6).toString("hex"), at: new Date().toISOString(), ...clean(b) };
  supa.must(await supa.db.from("update_notes").insert(toRow(n)), "update_notes");
  notes.push(n); sortNotes();
  if (notes.length > MAX_NOTES) {                                           // เก็บแค่ MAX_NOTES ล่าสุด
    const old = notes.slice(MAX_NOTES); notes = notes.slice(0, MAX_NOTES);
    try { await supa.db.from("update_notes").delete().in("id", old.map((x) => x.id)); } catch (e) { /* ลบของเก่าไม่สำเร็จไม่เป็นไร */ }
  }
  return n;
}
async function update(id, b) {
  need();
  const i = notes.findIndex((n) => n.id === id); if (i < 0) return null;
  const next = { ...notes[i], ...clean(b) };
  supa.must(await supa.db.from("update_notes").update({ note_date: next.date, title: next.title, items: next.items }).eq("id", id), "update_notes");
  notes[i] = next; sortNotes(); return next;
}
async function remove(id) {
  need();
  if (!notes.some((n) => n.id === id)) return false;
  supa.must(await supa.db.from("update_notes").delete().eq("id", id), "update_notes");   // ลบจากฐานข้อมูลก่อน สำเร็จแล้วค่อยลบจากแคช
  notes = notes.filter((n) => n.id !== id); return true;
}
module.exports = { init, list, add, update, remove };
