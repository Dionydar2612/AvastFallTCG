/* AvastFall TCG – ชั้นข้อมูลการ์ด (ไม่แตะ DOM / UI)

   หน้าที่
   - ดึงการ์ด เด็ค ธาตุ จาก card-api เก็บสำเนาไว้ใน localStorage และสำรองด้วย js/data/snapshot.js
   - ให้ URL รูปการ์ด (รูปทั้งหมดดึงจาก card-api ไม่มีรูปฝังในโค้ด)
   - ตรวจการ์ดใหม่ / การ์ดที่ยังไม่มีสคริปต์เอฟเฟกต์ / การ์ดที่ข้อความต่างจากที่สคริปต์เขียนไว้ พร้อมรายการความต่าง

   UI ใช้ผ่าน AF.cardData เท่านั้น (ดู js/ui/data-sync.js) ถ้าแก้ที่นี่ UI ไม่ต้องแก้ตาม

   "ข้อความที่สคริปต์เขียนไว้ตามนั้น" = ข้อมูลใน js/data/snapshot.js
   เมื่อแก้สคริปต์ใน js/effects/*.js ให้ตรงกับข้อความล่าสุดแล้ว ให้แก้รายการนั้นใน snapshot.js ให้เหมือน card-api
   ป้าย "ข้อความเปลี่ยน" ของการ์ดใบนั้นก็จะหายไป */
(function (AF) {
'use strict';

/* card-api อยู่บนเซิร์ฟเวอร์เดียวกับหน้าเว็บนี้ (เว็บรวม) ถ้าเปิดไฟล์ตรง ๆ (file://) ใช้ตัวเดิมบน Render แทน */
const LEGACY_API = 'https://avastfalltcglist.onrender.com';
const DEFAULT_API = /^https?:$/.test(location.protocol) ? location.origin : LEGACY_API;
const CACHE_KEY = 'af-cards-cache';

const cid = c => c.deck + '-' + c.no;
/* ชุดที่ขึ้นต้นด้วย BT (BT01, BT02, ...) ไม่แสดงเป็นเด็คตัวอย่าง แต่ยังเลือกใส่เด็คตัวเองได้ในหน้าสร้างเด็ค */
const NO_PRESET = /^BT/i;
const sigOf = c => [c.name, c.type, c.sub || '', c.cost ?? c.sc ?? '', c.atk ?? '', c.def ?? c.defense ?? '', c.cri ?? '', c.tribe || '', JSON.stringify(c.fx || [])].join('|');

/* ---------------------------------------------------------------- snapshot (ข้อความที่สคริปต์เขียนไว้) */
const SNAP = AF.SNAPSHOT;
const SNAP_IDS = new Set(), SNAP_SIG = {}, SNAP_CARD = {};
for (const c of SNAP.CARDS) {
  if (c.key && c.key !== cid(c)) continue;
  SNAP_IDS.add(cid(c)); SNAP_SIG[cid(c)] = sigOf(c); SNAP_CARD[cid(c)] = c;
}

/* ---------------------------------------------------------------- API → รูปแบบข้อมูลของเอนจิน */
function normalizeApi(cards, decks, elements) {
  const D = {};
  for (const d of decks || []) D[d.id] = { name: d.name || d.id, total: d.total, rot: d.rotation, el: d.element || '', rar: d.rarity, art: d.artist };
  const C = [];
  for (const c of cards) {
    if (!c || !c.deck || !c.no) continue;
    if (c.id && c.id !== c.deck + '-' + c.no) continue; // variants (เช่น SR) ใช้ตัวหลัก
    const t = {
      deck: c.deck, no: c.no, name: c.name, type: c.type, sub: c.sub, cost: c.cost, sc: c.sc, atk: c.atk, def: c.def ?? c.defense, cri: c.cri, tribe: c.tribe,
      fx: (c.effects || []).map(e => [e.keyword || '', e.text || '']), fl: c.flavor || '', element: c.element, elements: c.elements, rarity: c.rarity, artist: c.artist, image: c.image || ''
    };
    if (t.type === 'Spell' && !t.sub) t.sub = 'Enchant';
    C.push(t);
    if (!D[c.deck]) D[c.deck] = { name: c.deck, el: c.element || '' };
  }
  return { DECKS: D, CARDS: C, ELEMENTS: elements || {} };
}

async function fetchJSON(url, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}

/* ---------------------------------------------------------------- public object */
const listeners = [];
let loadSeq = 0;
const D = AF.cardData = {
  DEFAULT_API,
  LEGACY_API,
  api: DEFAULT_API,
  raw: SNAP,                 // ข้อมูลที่ใช้อยู่ตอนนี้ (รูปแบบ { DECKS, CARDS, ELEMENTS })
  series: [],                // รหัสชุดที่มี Avatar (ใช้ทำเด็คตัวอย่าง)
  status: { state: 'builtin', at: 0, err: '', count: SNAP_IDS.size, cached: false },
  pending: null,             // ข้อมูลใหม่ที่โหลดเสร็จระหว่างเล่นเกม รอใช้ตอนกลับหน้าตั้งค่า
  holdApply: () => false     // UI กำหนดให้คืน true ระหว่างเกม เพื่อไม่ให้ข้อมูลเปลี่ยนกลางเกม
};

D.subscribe = fn => { listeners.push(fn); };
const notify = ev => { for (const fn of listeners) { try { fn(ev, D); } catch (e) { console.error(e); } } };

D.setApi = url => { if (/^https?:\/\//.test(String(url).trim())) D.api = String(url).trim(); };
D.apiBase = () => (D.api || DEFAULT_API).replace(/\/+$/, '');
/* ลิงก์ไปหน้า Card List: ถ้า card-api คือเซิร์ฟเวอร์นี้ → /cards/ ถ้าชี้ไป card-api ภายนอก → หน้าแรกของเซิร์ฟเวอร์นั้น */
D.cardListUrl = () => D.apiBase() === DEFAULT_API && DEFAULT_API !== LEGACY_API ? '/cards/' : D.apiBase() + '/';

/* URL รูปการ์ด: ใช้ path ที่ API ให้มา (มี ?v= กันแคชเก่า) ถ้าไม่มีใช้ /images/<รหัส>.jpg */
D.imageUrl = def => {
  const img = def && def.image;
  if (img) return /^https?:\/\//.test(img) ? img : D.apiBase() + (img[0] === '/' ? '' : '/') + img;
  return `${D.apiBase()}/images/${def.id}.jpg`;
};

/* ใช้ข้อมูลชุดหนึ่งกับเอนจิน และคำนวณป้ายเตือนของแต่ละการ์ด */
D.apply = raw => {
  D.raw = raw;
  AF.loadData(raw);
  D.series = Object.keys(raw.DECKS).filter(s => !NO_PRESET.test(s) && Object.values(AF.defs).some(d => d.deck === s && d.kind === 'Avatar'));
  D.live = {};
  for (const c of raw.CARDS) {
    if (c.key && c.key !== cid(c)) continue;
    D.live[cid(c)] = c;
    const d = AF.defs[cid(c)]; if (!d) continue;
    d.isNew = !SNAP_IDS.has(d.id);
    d.stale = !!(AF.FX[d.id] && SNAP_SIG[d.id] !== sigOf(c));
  }
  notify('data');
};
D.applyPending = () => { if (D.pending) { const r = D.pending; D.pending = null; D.apply(r); return true; } return false; };

/* เริ่มต้น: ใช้สำเนาในเบราว์เซอร์ ถ้าไม่มีใช้ snapshot */
D.boot = () => {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.raw && c.raw.CARDS && c.raw.CARDS.length) {
      D.status = { state: 'cache', at: c.at, err: '', count: c.raw.CARDS.length, cached: true };
      D.apply(c.raw); return;
    }
  } catch (e) { }
  D.status = { state: 'builtin', at: 0, err: '', count: SNAP_IDS.size, cached: false };
  D.apply(SNAP);
};

/* โหลดจาก card-api (เรียกซ้ำได้ ผลของครั้งล่าสุดเท่านั้นที่มีผล) */
D.load = async () => {
  const seq = ++loadSeq, base = D.apiBase();
  const prev = D.status.state === 'loading' ? (D.status.cached ? 'cache' : 'builtin') : D.status.state;  // ถ้าโหลดพลาด กลับไปสถานะเดิม
  D.status = Object.assign({}, D.status, { state: 'loading', err: '' }); notify('status');
  try {
    let cards = [], page = 1, pages = 1;
    do {
      const j = await fetchJSON(`${base}/api/cards?limit=500&page=${page}`, 50000);
      cards = cards.concat(j.data || []); pages = j.pages || 1; page++;
    } while (page <= pages && page < 20);
    const dk = await fetchJSON(`${base}/api/decks`, 50000);
    const el = await fetchJSON(`${base}/api/elements`, 50000).catch(() => ({ data: {} }));
    const raw = normalizeApi(cards, dk.data, el.data);
    if (!raw.CARDS.length) throw new Error('API ไม่มีการ์ด');
    if (seq !== loadSeq) return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ base, at: Date.now(), raw })); } catch (e) { }
    D.status = { state: 'live', at: Date.now(), err: '', count: raw.CARDS.length, cached: D.status.cached };
    if (D.holdApply()) { D.pending = raw; notify('status'); } else D.apply(raw);
  } catch (e) {
    if (seq !== loadSeq) return;
    D.status = Object.assign({}, D.status, { state: prev, err: (e && e.name === 'AbortError') ? 'หมดเวลารอ (เซิร์ฟเวอร์อาจกำลังตื่น)' : String(e && e.message || e) });
    notify('status');
  }
};

/* ---------------------------------------------------------------- ตรวจสอบการ์ด */
D.issues = () => {
  const defs = Object.values(AF.defs);
  return { isNew: defs.filter(d => d.isNew), stale: defs.filter(d => d.stale), unscripted: defs.filter(d => d.unscripted) };
};

const lines = c => {
  const o = { 'ชื่อ': c.name, 'ประเภท': c.type + (c.sub ? ' / ' + c.sub : ''), 'Cost': c.cost ?? c.sc ?? '', 'ATK': c.atk ?? '', 'DEF': c.def ?? c.defense ?? '', 'CRI': c.cri ?? '', 'เผ่า': c.tribe || '' };
  (c.fx || []).forEach((f, i) => { o['เอฟเฟกต์ ' + (i + 1)] = (f[0] ? '[' + f[0] + '] ' : '') + f[1]; });
  return o;
};
/* รายการที่ข้อความการ์ดใน card-api ต่างจากที่สคริปต์เขียนไว้: [{label, was, now}] */
D.diff = id => {
  const a = SNAP_CARD[id] ? lines(SNAP_CARD[id]) : null, b = D.live && D.live[id] ? lines(D.live[id]) : null;
  if (!a) return [{ label: 'snapshot', was: '(ยังไม่มีรายการนี้ใน js/data/snapshot.js)', now: b ? 'มีใน card-api' : '' }];
  if (!b) return [];
  const out = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (String(a[k] ?? '(ไม่มี)') !== String(b[k] ?? '(ไม่มี)')) out.push({ label: k, was: String(a[k] ?? '(ไม่มี)'), now: String(b[k] ?? '(ไม่มี)') });
  return out;
};

})(globalThis.AF = globalThis.AF || {});
