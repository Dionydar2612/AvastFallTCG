// เก็บ/โหลดข้อมูลการ์ด  ·  ฐานข้อมูลหลัก = Supabase (ตาราง cards, card_sets, elements, card_backups)
//   - state ในหน่วยความจำเป็นแคชของฐานข้อมูล: โหลดตอนเริ่มเซิร์ฟเวอร์ และอัปเดตทุกครั้งที่ save()
//   - ถ้าฐานข้อมูลยังว่าง (ครั้งแรก) จะ seed จาก data/*.json ที่มากับโค้ดให้อัตโนมัติ
//   - รูปการ์ด "ฝังในโค้ด": อยู่ที่ public/images/<รหัส>.jpg (ตั้ง DATA_DIR/IMG_DIR เฉพาะกรณีต้องการที่เก็บรูปแยก)
const fs = require("fs"), path = require("path");
const { strip } = require("./importer");
const supa = require("./supa");
const root = path.join(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null;
const imgDir = process.env.IMG_DIR ? path.resolve(process.env.IMG_DIR) : DATA_DIR ? path.join(DATA_DIR, "images") : path.join(root, "public", "images");
const seedDir = path.join(root, "data");
const dataDir = DATA_DIR ? path.join(DATA_DIR, "data") : seedDir;   // ไฟล์เสริมบนดิสก์ (Update Note) — การ์ด/ผู้ใช้อยู่ใน Supabase
try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) { }
const IMG_EXT = ["jpg", "png", "webp"];
const MAX_BACKUPS = 30;
const state = { cards: [], decks: [], elements: {}, byId: new Map(), raw: [], imgs: new Map() };
const listeners = [];
const onChange = (fn) => listeners.push(fn);          // เรียกหลัง save() สำเร็จ (ใช้สร้างสินค้าในร้านให้ชุดใหม่)

const readSeed = (f) => JSON.parse(fs.readFileSync(path.join(seedDir, f), "utf8"));
const cardRow = (c) => ({ id: c.id, deck: c.deck, no: String(c.no), name: c.name, type: c.type, rarity: c.rarity || null, data: c, updated_at: new Date().toISOString() });
const deckRow = (d) => ({ id: d.id, name: d.name || d.id, data: d, updated_at: new Date().toISOString() });

async function init() {
  fs.mkdirSync(imgDir, { recursive: true });
  if (DATA_DIR && !fs.readdirSync(imgDir).length) {            // ดิสก์แยกที่ยังว่าง → คัดลอกรูปเริ่มต้นไปให้
    const seed = path.join(root, "public", "images");
    if (fs.existsSync(seed) && path.resolve(seed) !== imgDir) for (const f of fs.readdirSync(seed)) fs.copyFileSync(path.join(seed, f), path.join(imgDir, f));
  }
  if (!supa.enabled) {                                          // ยังไม่ตั้ง Supabase: อ่านอย่างเดียวจากไฟล์เริ่มต้น (ล็อกอิน/แก้ไขใช้ไม่ได้)
    console.warn("⚠ ยังไม่ได้ตั้ง SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — ใช้ข้อมูลเริ่มต้นแบบอ่านอย่างเดียว");
    state.raw = readSeed("cards.json").map(strip); state.decks = readSeed("decks.json"); state.elements = readSeed("elements.json");
    return rebuild();
  }
  await load();
  if (!state.raw.length) { await seedDb(); await load(); }
}

async function seedDb() {
  console.log("seeding Supabase จาก data/*.json …");
  const cards = readSeed("cards.json").map(strip), decks = readSeed("decks.json"), els = readSeed("elements.json");
  for (const part of supa.chunk(cards)) supa.must(await supa.db.from("cards").upsert(part.map(cardRow)), "seed cards");
  for (const part of supa.chunk(decks)) supa.must(await supa.db.from("card_sets").upsert(part.map(deckRow)), "seed card_sets");
  supa.must(await supa.db.from("elements").upsert(Object.entries(els).map(([name, data]) => ({ name, data }))), "seed elements");
}

async function load() {
  state.raw = (await supa.fetchAll("cards", "id,data", "id")).map((r) => strip(r.data));
  state.decks = (await supa.fetchAll("card_sets", "id,data", "id")).map((r) => r.data);
  state.elements = Object.fromEntries((await supa.fetchAll("elements", "name,data", "name")).map((r) => [r.name, r.data]));
  rebuild();
}

function imageMap() {
  const m = new Map();
  for (const f of fs.readdirSync(imgDir)) {
    const mt = f.match(/^(.+)\.(jpg|jpeg|png|webp)$/i); if (!mt) continue;
    m.set(mt[1].toLowerCase(), `/images/${f}?v=${Math.floor(fs.statSync(path.join(imgDir, f)).mtimeMs / 1000)}`);
  }
  return m;
}
function rebuild() {
  const im = imageMap();
  state.cards = state.raw.map((c) => { const o = strip(c), img = im.get(c.id.toLowerCase()); if (img) o.image = img; return o; });
  state.byId = new Map(state.cards.map((c) => [c.id.toLowerCase(), c]));
  state.imgs = im;
}
const hasImage = (id) => state.imgs.has(id.toLowerCase());

async function backup(note) {
  if (!supa.enabled) return;
  supa.must(await supa.db.from("card_backups").insert({ note: note || "", n_cards: state.raw.length, n_decks: state.decks.length, payload: { cards: state.raw, decks: state.decks } }), "backup");
  const old = supa.must(await supa.db.from("card_backups").select("id").order("id", { ascending: false }).range(MAX_BACKUPS, MAX_BACKUPS + 200), "backup list");
  if (old && old.length) await supa.db.from("card_backups").delete().in("id", old.map((r) => r.id));
}

// บันทึกการ์ด/เด็คลง Supabase (เฉพาะแถวที่เปลี่ยน/ถูกลบ) แล้วค่อยอัปเดตแคชในหน่วยความจำ — ถ้าฐานข้อมูลล้มเหลวจะโยน error และแคชไม่เปลี่ยน
async function save({ cards, decks }, note) {
  if (!supa.enabled) throw new Error("ยังไม่ได้ตั้งค่า Supabase จึงบันทึกไม่ได้");
  await backup(note);
  if (cards) {
    const next = cards.map(strip), before = new Map(state.raw.map((c) => [c.id, JSON.stringify(c)]));
    const changed = next.filter((c) => before.get(c.id) !== JSON.stringify(c));
    const keep = new Set(next.map((c) => c.id)), gone = [...before.keys()].filter((id) => !keep.has(id));
    for (const part of supa.chunk(changed)) supa.must(await supa.db.from("cards").upsert(part.map(cardRow)), "save cards");
    for (const part of supa.chunk(gone)) supa.must(await supa.db.from("cards").delete().in("id", part), "delete cards");
    state.raw = next;
  }
  if (decks) {
    const before = new Map(state.decks.map((d) => [d.id, JSON.stringify(d)]));
    const changed = decks.filter((d) => before.get(d.id) !== JSON.stringify(d));
    const keep = new Set(decks.map((d) => d.id)), gone = [...before.keys()].filter((id) => !keep.has(id));
    for (const part of supa.chunk(changed)) supa.must(await supa.db.from("card_sets").upsert(part.map(deckRow)), "save card_sets");
    for (const part of supa.chunk(gone)) supa.must(await supa.db.from("card_sets").delete().in("id", part), "delete card_sets");
    state.decks = decks;
  }
  rebuild();
  for (const fn of listeners) { try { await fn(); } catch (e) { console.error("store listener:", e.message); } }
}

async function listBackups() {
  if (!supa.enabled) return [];
  const rows = supa.must(await supa.db.from("card_backups").select("id,at,note,n_cards,n_decks").order("id", { ascending: false }).limit(MAX_BACKUPS), "backups");
  return rows.map((r) => ({ name: String(r.id), at: r.at, note: r.note, cards: r.n_cards, decks: r.n_decks }));
}
async function restore(name) {
  if (!/^\d{1,15}$/.test(String(name))) throw new Error("bad_name");
  const r = supa.must(await supa.db.from("card_backups").select("payload").eq("id", Number(name)).maybeSingle(), "restore");
  if (!r) throw new Error("not_found");
  await save({ cards: r.payload.cards, decks: r.payload.decks }, `restore #${name}`);
}

function saveImage(id, ext, buf) {
  for (const e of [...IMG_EXT, "jpeg"]) { const p = path.join(imgDir, `${id}.${e}`); if (e !== ext && fs.existsSync(p)) fs.unlinkSync(p); }
  fs.writeFileSync(path.join(imgDir, `${id}.${ext}`), buf);
  rebuild();
}
module.exports = { state, init, load, save, hasImage, listBackups, restore, saveImage, onChange, imgDir, dataDir, DATA_DIR };
