// Lightweight persistent system controls stored in Supabase app_meta.
const supa = require('./supa');
const KEY = 'system_control_v1';
const DEFAULT = { maintenance: { game: false, matchmaking: false, shop: false, cards: false, global: false }, messages: {}, updated_at: null };
let current = { ...DEFAULT, maintenance: { ...DEFAULT.maintenance }, messages: {} };
let loaded = false;
async function load() {
  if (!supa.enabled) { loaded = true; return current; }
  const row = supa.must(await supa.db.from('app_meta').select('value').eq('key', KEY).maybeSingle(), 'system control');
  if (row && row.value) current = { ...DEFAULT, ...row.value, maintenance: { ...DEFAULT.maintenance, ...(row.value.maintenance || {}) }, messages: row.value.messages || {} };
  loaded = true; return current;
}
async function get() { if (!loaded) await load(); return current; }
async function update(patch) {
  if (!supa.enabled) throw new Error('ยังไม่ได้ตั้งค่า Supabase จึงบันทึกการตั้งค่าระบบไม่ได้');
  const old = await get();
  current = { ...old, ...patch, maintenance: { ...old.maintenance, ...(patch.maintenance || {}) }, messages: { ...old.messages, ...(patch.messages || {}) }, updated_at: new Date().toISOString() };
  supa.must(await supa.db.from('app_meta').upsert({ key: KEY, value: current }), 'save system control');
  return current;
}
module.exports = { load, get, update, KEY };
