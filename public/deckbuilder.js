/* Card List · Deckbuilder
   - จัดเด็คแบบเดียวกับ AvastFallTCGsim (Avatar 1 ใบ + Main Deck 59 ใบ = 60 ใบ, ชื่อซ้ำ ≤ 4, Element Deck 8 ใบ, ธาตุตาม Avatar)
   - ส่งออกเป็นข้อความรูปแบบเดียวกับปุ่ม "คัดลอกเป็นข้อความ" ของ AvastFallTCGsim → วางที่ "นำเข้าจากข้อความ" ได้ทันที
   - ลิงก์แชร์: <เว็บนี้>/#deck=<ข้อความเด็คเข้ารหัส> เปิดแล้วโหลดเด็คเข้า Deckbuilder
   ทำงานหลัง index.html โหลดข้อมูลการ์ดเสร็จ (เรียก DB.init()) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const LS_DECKS = 'cl-decks';
  const TABS = [['Unit', 'Unit'], ['Spell', 'Spell'], ['Ultimate', 'Ultimate'], ['ALL', 'ALL']];
  const KORD = { Unit: 0, Enchant: 1, Counter: 2, Equipment: 3, Domain: 4, Ultimate: 5 };
  const KINDS = ['Unit', 'Enchant', 'Counter', 'Equipment', 'Domain', 'Ultimate'];
  const tabOf = k => (k === 'Unit' ? 'Unit' : k === 'Ultimate' ? 'Ultimate' : 'Spell');
  const DEFAULT_NAME = 'เด็คใหม่', IMPORT_NAME = 'เด็คที่นำเข้า';

  let DEFS = {}, DECKS = {}, ELS = [], inited = false;
  const owned = id => (((window.__AF || {}).owned) || {})[id] || 0;          // จำนวนที่ผู้ใช้มีจริง (รวมเวอร์ชันพิเศษเข้าใบหลักแล้ว)
  const S = { own: true, id: null, name: DEFAULT_NAME, avatar: null, counts: {}, edeck: null, tab: 'ALL', q: '', fd: '', ft: '', fe: '', sort: 'id', fin: false, sh: 'mid', elopen: false };

  /* ---------------- storage (try/catch เสมอ) ---------------- */
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const loadSaved = () => { const a = lsGet(LS_DECKS); return Array.isArray(a) ? a : []; };

  /* ---------------- ข้อมูลการ์ด → รูปแบบเดียวกับเอนจินของ sim ---------------- */
  function buildDefs() {
    DEFS = {}; DECKS = window.DECKS || {};
    for (const c of window.CARDS || []) {
      const id = c.deck + '-' + c.no;
      if (c.key && c.key !== id) continue;                       // ตัวสลับภาพ (เช่น SR) ใช้ตัวหลัก
      const kind = c.type === 'Spell' ? (c.sub || 'Enchant') : c.type;
      const raw = c.cost != null ? c.cost : c.sc;
      const list = Array.isArray(c.els) && c.els.length ? c.els : [c.el || (DECKS[c.deck] || {}).el].filter(Boolean);
      const els = [...new Set(list)];
      DEFS[id] = { id, deck: c.deck, no: c.no, name: c.name, kind, cost: raw == null ? 0 : raw, noCost: raw == null, tribe: c.tribe || '', els, img: c.img || '', fx: c.fx || [] };
    }
    ELS = Object.keys(window.ELEMENTS || {});
  }
  const cmpId = (a, b) => a.deck.localeCompare(b.deck) || a.no.localeCompare(b.no);
  /* ข้อยกเว้นบน Avatar (ตรงกับ AF.allowedInDeck ใน web/js/engine/engine.js): Avatar บางใบใส่การ์ดนอกธาตุได้
     BT01-003 เซนโง มุรามาสะ — ใส่การ์ดที่มีคำว่า "ดาบ" ในชื่อได้ทุกธาตุ (จ่าย Cost ด้วยธาตุใดก็ได้เป็นกฎตอนเล่น เอนจินจัดการอยู่แล้ว) */
  const AV_ALLOW = { 'BT01-003': c => String(c.name || '').includes('ดาบ') };
const allowed = (av, card) => {
  if (!card.els.length) return true;
  const ex = av && AV_ALLOW[av.id];
  if (ex && ex(card)) return true;
  return card.els.every(e => ((av && av.els) || []).includes(e));
};
  const defaultEdeck = av => {
    const els = av && av.els && av.els.length ? av.els : [];
    const o = {}; els.forEach((e, i) => { o[e] = Math.floor(8 / els.length) + (i < 8 % els.length ? 1 : 0); }); return o;
  };
  const edeckOf = d => (d.edeck && Object.values(d.edeck).some(n => n > 0) ? d.edeck : defaultEdeck(DEFS[d.avatar]));
  const mainCount = d => Object.values(d.counts).reduce((a, b) => a + b, 0);
  const sizeOf = d => 1 + mainCount(d);
  const nameCounts = d => { const o = {}; for (const [id, n] of Object.entries(d.counts)) { const nm = DEFS[id] ? DEFS[id].name : id; o[nm] = (o[nm] || 0) + n; } return o; };
  function validate(d) {
    const errs = [], n = sizeOf(d), av = DEFS[d.avatar];
    if (n !== 60) errs.push('เด็คต้องมี 60 ใบพอดี (รวม Avatar) ตอนนี้ ' + n + ' ใบ');
    for (const [id] of Object.entries(d.counts)) {
      const df = DEFS[id];
      if (!df) { errs.push('ไม่พบการ์ด ' + id); continue; }
      if (df.kind === 'Avatar') errs.push(df.name + ' เป็น Avatar ใส่ใน Main Deck ไม่ได้');
      else if (av && !allowed(av, df)) errs.push(df.name + ' (ธาตุ' + df.els.join('/') + ') ใส่ไม่ได้ Avatar เป็นธาตุ' + (av.els.join('/') || 'ไม่ระบุ'));
    }
    for (const [id, n] of Object.entries(d.counts)) { const df = DEFS[id]; if (df && owned(id) < n) errs.push(df.name + ': ใส่ ' + n + ' ใบ แต่คุณมีแค่ ' + owned(id) + ' ใบ'); }
    if (av && owned(av.id) < 1) errs.push('คุณยังไม่มี Avatar ' + av.name);
    for (const [nm, c] of Object.entries(nameCounts(d))) if (c > 4) errs.push(nm + ' ใส่ได้ไม่เกิน 4 ใบ (ตอนนี้ ' + c + ')');
    if (!av || av.kind !== 'Avatar') errs.push('ต้องเลือก Avatar 1 ใบ');
    const en = Object.values(edeckOf(d)).reduce((a, b) => a + b, 0);
    if (en !== 8) errs.push('Element Deck ต้องมี 8 ใบพอดี (ตอนนี้ ' + en + ' ใบ)');
    return errs;
  }

  /* ---------------- ข้อความเด็ค (รูปแบบเดียวกับ AvastFallTCGsim) ---------------- */
  function toText(d) {
    const nm = String(d.name || DEFAULT_NAME).replace(/[\r\n]+/g, ' ').trim() || DEFAULT_NAME;
    const L = ['# ' + nm];
    if (d.avatar) L.push('Avatar ' + d.avatar);
    for (const [k, n] of Object.entries(edeckOf(d))) if (n > 0 && k) L.push('Element ' + k + ' ' + n);
    for (const id of Object.keys(d.counts).filter(i => d.counts[i] > 0).sort()) L.push(id + ' x' + d.counts[id] + '  # ' + ((DEFS[id] || {}).name || '?'));
    return L.join('\n');
  }
  /* เด็คที่นำเข้า/แชร์มา: ตัดการ์ดที่ผู้ใช้ไม่มีออก แล้วบอกว่าตัดอะไรไป */
  function fitOwned(r) {
    const cut = [];
    for (const [id, n] of Object.entries(r.counts)) { const k = Math.min(n, owned(id)); if (k < n) cut.push(((DEFS[id] || {}).name || id) + ' ×' + (n - k)); if (k > 0) r.counts[id] = k; else delete r.counts[id]; }
    if (r.avatar && !owned(r.avatar)) { cut.push('Avatar ' + ((DEFS[r.avatar] || {}).name || r.avatar)); r.avatar = null; }
    if (cut.length) r.warns.push('ข้ามการ์ดที่คุณยังไม่มี: ' + cut.join(', '));
    return r;
  }
  function parseText(txt) {
    const out = { name: IMPORT_NAME, avatar: null, counts: {}, edeck: null, warns: [] };
    const byName = {}, byId = {};
    for (const d of Object.values(DEFS)) { byName[d.name.toLowerCase()] = d.id; byId[d.id.toLowerCase()] = d.id; }
    for (const raw of String(txt).split(/\r?\n/)) {
      let line = raw.trim(); if (!line) continue;
      if (line[0] === '#') { if (out.name === IMPORT_NAME && line.length > 1) out.name = line.replace(/^#+\s*/, '').trim() || out.name; continue; }
      line = line.replace(/\s+#.*$/, '').replace(/\s+\/\/.*$/, '').trim(); if (!line) continue;
      let m = line.match(/^avatar\s*[:：]?\s*(.+)$/i);
      if (m) { const k = m[1].trim().toLowerCase(); const id = byId[k] || byName[k]; if (id) out.avatar = id; else out.warns.push('ไม่พบ Avatar: ' + m[1]); continue; }
      m = line.match(/^element\s*[:：]?\s*(\S+)\s*[x×]?\s*(\d+)$/i);
      if (m) { out.edeck = out.edeck || {}; out.edeck[m[1]] = (out.edeck[m[1]] || 0) + +m[2]; continue; }
      m = line.match(/^(?:(\d+)\s*[x×]?\s+)?(.+?)(?:\s*[x×]\s*(\d+))?$/i);
      if (!m) { out.warns.push('อ่านไม่ออก: ' + line); continue; }
      const n = +(m[1] || m[3] || 1), k = m[2].trim().toLowerCase(), id = byId[k] || byName[k];
      if (!id) { out.warns.push('ไม่พบการ์ด: ' + m[2]); continue; }
      if (DEFS[id].kind === 'Avatar') { if (!out.avatar) out.avatar = id; continue; }
      out.counts[id] = (out.counts[id] || 0) + n;
    }
    for (const id of Object.keys(out.counts)) out.counts[id] = Math.min(4, out.counts[id]);
    if (!out.avatar) out.warns.push('ไม่ได้ระบุ Avatar');
    return out;
  }
  const b64 = s => { const u = new TextEncoder().encode(s); let b = ''; u.forEach(x => { b += String.fromCharCode(x); }); return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); return new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))); };
  const SIM = '/';
  const simLink = d => SIM + '#deck=' + b64(toText(d));
  const shareLink = d => location.origin + location.pathname + '#deck=' + b64(toText(d));

  /* ---------------- helpers UI ---------------- */
  const ico = (n, s) => { const e = (window.ELEMENTS || {})[n]; return e ? `<svg width="${s}" height="${s}" viewBox="0 0 18 18" style="vertical-align:-3px"><circle cx="9" cy="9" r="8" fill="#fff" stroke="${e.c}" stroke-width="2"/><path d="${e.p}" fill="${e.c}"/></svg>` : ''; };
  const pic = d => (d.img ? `<img loading="lazy" src="${esc(d.img)}" alt="${esc(d.name)}">` : `<div class="noimg">${esc(d.name)}</div>`);
  const costTxt = d => (d.kind === 'Unit' ? 'Cost ' + d.cost : d.noCost ? '' : 'Spend ' + d.cost);
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(label == null ? v : label)}</option>`;
  /* แจ้งหน้าเกม (ถ้าฝังอยู่) ว่ารายการเด็คเปลี่ยน เพื่อให้หน้าเลือกเด็คอัปเดตทันที */
  const notify = () => { try { if (window.parent && window.parent !== window) window.parent.postMessage({ afDecksChanged: 1 }, location.origin); } catch (e) { } };
  let toastT = 0;
  function toast(msg) {
    const t = $('dbt'); if (!t) return; t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
  }
  async function copy(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) { }
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); return ok;
  }
  const snap = () => JSON.stringify([S.name, S.avatar, S.counts, S.edeck]);
  let base = '';
  const dirty = () => snap() !== base && !(S.id === null && !Object.keys(S.counts).length);

  /* ---------------- โครงหน้า ---------------- */
  function skeleton() {
    $('v-deck').innerHTML = `
    <div id="dlist"></div>
    <div id="dedit" hidden>
    <div class="db-topbar"><button class="chip" data-a="back">← กลับ</button><h1>Deckbuilder</h1></div>
    <div class="db-wrap">
      <section class="db-pool">
        <div class="db-libhead" id="dlh" data-a="shtoggle"><span class="db-grip"></span><b>Card Library</b><span class="cnt db-cnt" id="dcnt"></span></div>
        <div class="db-toolbar">
          <label class="db-sr"><span aria-hidden="true">🔍</span><input id="dq" type="search" placeholder="ค้นหาชื่อ / รหัส / เผ่า"></label>
          <button class="chip db-tb" data-a="fpanel" id="dfb">⚙ Filters<i id="dfn" hidden></i></button>
          <button class="chip db-tb" data-a="spanel" id="dsb">⇅ Sorting</button>
          <div class="db-panel db-filters" id="dfil" hidden></div>
          <div class="db-panel db-sortp" id="dsort" hidden></div>
        </div>
        <div class="db-grid" id="dgrid"></div>
      </section>
      <aside class="db-side box" id="dside">
        <button class="chip db-sheet-x" data-a="sheet">✕ ปิดแผงเด็ค (กลับไปเลือกการ์ด)</button>
        <label class="db-lbl">ชื่อเด็ค<input id="dname" type="text" maxlength="40"></label>
        <div class="db-head" id="dhead"></div>
        <div class="db-tabs" id="dtabs" role="tablist"></div>
        <div class="db-el" id="del"></div>
        <div class="db-mini" id="dmini"></div>
        <div class="db-bot" id="dbot"></div>
      </aside>
    </div>
    <div id="dbar" class="db-bar-m"></div>
    </div>
    <div id="dov" class="db-ov" hidden></div><div id="dbt" class="db-toast" role="status"></div>`;
    $('dfil').innerHTML = '';
    initSheetDrag(); applySh();
    $('v-deck').addEventListener('contextmenu', e => { if (!canHover) return; const t = e.target.closest && e.target.closest('.db-img[data-id]'); if (t) { e.preventDefault(); add(t.dataset.id, -1); } });
    $('dq').addEventListener('input', e => { S.q = e.target.value; renderPool(); });
    $('dname').addEventListener('input', e => { S.name = e.target.value; });
    $('dfil').addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; S[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; renderPool(); });
    $('v-deck').addEventListener('click', onClick);
    $('dov').addEventListener('click', e => { if (e.target.id === 'dov') closeOv(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !$('dov').hidden) closeOv(); });
  }

  function renderFilters() {
    const decks = [...new Set(Object.values(DEFS).map(d => d.deck))].sort();
    const els = [...new Set(Object.values(DEFS).flatMap(d => d.els))];
    const sel = (k, items, all0) => `<select data-k="${k}" aria-label="${esc(all0)}"><option value="">${esc(all0)}</option>${items.map(o => Array.isArray(o) ? opt(o[0], S[k], o[1]) : opt(o, S[k])).join('')}</select>`;
    $('dfil').innerHTML = sel('fd', decks, 'ทุกเด็ค') + sel('ft', KINDS, 'ทุกประเภท') + sel('fe', els, 'ทุกธาตุ') +
      `<label class="db-chk"><input type="checkbox" data-k="own" ${S.own ? 'checked' : ''}> เฉพาะที่ฉันมี</label><label class="db-chk"><input type="checkbox" data-k="fin" ${S.fin ? 'checked' : ''}> เฉพาะที่อยู่ในเด็ค</label>`;
    renderSort();
  }
  const SORTS = [['id', 'เรียงตามรหัส'], ['cost', 'Cost ต่ำ → สูง'], ['costd', 'Cost สูง → ต่ำ'], ['name', 'เรียงตามชื่อ']];
  function renderSort() { $('dsort').innerHTML = SORTS.map(([v, l]) => `<button class="chip ${S.sort === v ? 'on' : ''}" data-a="sortset" data-v="${v}">${l}</button>`).join(''); }
  function closePanels() { if ($('dfil')) { $('dfil').hidden = true; $('dsort').hidden = true; } }
  function updBadge() { const n = ['fd', 'ft', 'fe'].filter(k => S[k]).length + (S.fin ? 1 : 0) + (S.own ? 0 : 1); $('dfn').textContent = n || ''; $('dfn').hidden = !n; }
  const SH = ['min', 'mid', 'full'];
  const isMob = () => !!(window.matchMedia && matchMedia('(max-width:900px)').matches);
  function applySh() { const e = $('dedit'); if (e) SH.forEach(k => e.classList.toggle('sh-' + k, S.sh === k)); }
  let dragY = null, dragged = false;
  function initSheetDrag() {
    const h = $('dlh');
    h.addEventListener('pointerdown', e => { dragY = e.clientY; dragged = false; });
    h.addEventListener('pointerup', e => {
      if (dragY == null) return; const dy = e.clientY - dragY; dragY = null;
      if (!isMob() || Math.abs(dy) < 30) return;
      dragged = true; setTimeout(() => { dragged = false; }, 60);
      S.sh = SH[Math.max(0, Math.min(2, SH.indexOf(S.sh) + (dy < 0 ? 1 : -1)))]; applySh();
    });
    h.addEventListener('pointercancel', () => { dragY = null; });
  }

  function renderPool() {
    hideZoom();
    const av = DEFS[S.avatar], nc = nameCounts(S), q = S.q.trim().toLowerCase();
    const sorter = S.sort === 'cost' ? (x, y) => x.cost - y.cost || cmpId(x, y) : S.sort === 'costd' ? (x, y) => y.cost - x.cost || cmpId(x, y)
      : S.sort === 'name' ? (x, y) => x.name.localeCompare(y.name, 'th') || cmpId(x, y) : cmpId;
    const pool = Object.values(DEFS).filter(d => d.kind !== 'Avatar');
    const lib = pool.filter(d => (S.tab === 'ALL' || tabOf(d.kind) === S.tab) && (!S.fd || d.deck === S.fd) && (!S.ft || d.kind === S.ft) &&
      (!S.fe || d.els.includes(S.fe)) && (!S.fin || (S.counts[d.id] || 0) > 0) && (!S.own || owned(d.id) > 0 || (S.counts[d.id] || 0) > 0) &&
      (!q || (d.name + ' ' + d.id + ' ' + d.tribe).toLowerCase().includes(q))).sort(sorter);
    updBadge();
    $('dcnt').innerHTML = `แสดง <b>${lib.length}</b> จาก <b>${pool.length}</b> ใบ`;
    $('dgrid').innerHTML = lib.map(d => {
      const n = S.counts[d.id] || 0, have = owned(d.id), bad = av && !allowed(av, d), full = (nc[d.name] || 0) >= 4 || bad || n >= have;
      return `<div class="db-t ${n ? 'in' : ''} ${bad || !have ? 'off' : ''}" ${bad ? `title="ธาตุ${esc(d.els.join('/'))} ใส่ไม่ได้ Avatar เป็นธาตุ${esc(av.els.join('/') || 'ไม่ระบุ')}"` : ''}>
        <button class="db-img" data-z="${esc(d.id)}" data-a="add" data-id="${esc(d.id)}" aria-label="เพิ่ม ${esc(d.name)}" ${full ? 'data-full="1"' : ''}>${pic(d)}<span class="db-pill ${n ? '' : 'z'}">${n}</span><span class="db-own ${have ? '' : 'none'}">${have ? 'มี ' + have : 'ยังไม่มี'}</span></button><button class="db-i" data-a="zoom" data-id="${esc(d.id)}" aria-label="ดูรายละเอียด ${esc(d.name)}">i</button>${n ? `<button class="db-minus" data-a="sub" data-id="${esc(d.id)}" aria-label="ลด ${esc(d.name)}">−</button>` : ''}
        <div class="db-nm">${esc(d.name)}</div><div class="db-mt">${d.els.map(e => ico(e, 12)).join('')} ${esc(d.id)} ${esc(costTxt(d))}</div>
        <div class="db-step"><button data-a="sub" data-id="${esc(d.id)}" ${n ? '' : 'disabled'} aria-label="ลด">−</button><b>${n}</b><button data-a="add" data-id="${esc(d.id)}" ${full ? 'disabled' : ''} aria-label="เพิ่ม">+</button></div></div>`;
    }).join('') || '<div class="empty">ไม่พบการ์ดตามตัวกรอง</div>';
  }

  function renderSide() {
    hideZoom();
    const av = DEFS[S.avatar], tot = sizeOf(S), ed = edeckOf(S), edTot = Object.values(ed).reduce((a, b) => a + b, 0), nc = nameCounts(S);
    const errs = validate(S);
    const byTab = { Unit: 0, Spell: 0, Ultimate: 0, ALL: 0 };
    for (const [id, n] of Object.entries(S.counts)) { const d = DEFS[id]; if (d) { byTab[tabOf(d.kind)] += n; byTab.ALL += n; } }
    if ($('dname') !== document.activeElement) $('dname').value = S.name;
    $('dhead').innerHTML = `<button class="db-av" ${av ? `data-z="${esc(av.id)}"` : ''} data-a="avopen" aria-label="เลือก Avatar">${av ? pic(av) : '<div class="noimg">เลือก<br>Avatar</div>'}<span>เลือก Avatar</span></button>
      <div class="db-info"><b>${av ? esc(av.name) : 'ยังไม่ได้เลือก Avatar'}</b>${av ? `<div class="db-mt">${av.els.map(e => ico(e, 13)).join('')} ${esc(av.id)}</div>` : ''}
      <div class="db-tot"><b>${tot}</b>/60 ${tot === 60 ? '<span class="good">ครบ</span>' : `<span class="bad">${tot < 60 ? 'ขาด ' + (60 - tot) : 'เกิน ' + (tot - 60)}</span>`}</div>
      <div class="db-bar"><i class="${tot === 60 ? 'ok' : tot > 60 ? 'over' : ''}" style="width:${Math.min(100, tot / 60 * 100)}%"></i></div></div>`;
    $('dtabs').innerHTML = TABS.map(([k, l]) => `<button class="db-tab ${S.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}" role="tab" aria-selected="${S.tab === k}">${l}<b>${byTab[k]}</b></button>`).join('');
    $('del').innerHTML = `<div class="db-elh" data-a="elt"><span>${S.elopen ? '▾' : '▸'} Element Deck <b>${edTot}</b>/8 ${edTot === 8 ? '<span class="good">✓</span>' : ''}</span><button class="chip" data-a="edauto">ตามธาตุ Avatar</button></div>
      <div class="db-elg" ${S.elopen ? '' : 'hidden'}>${ELS.map(k => `<div class="db-elc">${ico(k, 16)}<span>${esc(k)}</span><button data-a="edm" data-k="${esc(k)}" data-d="-1" aria-label="ลด ${esc(k)}">−</button><b>${ed[k] || 0}</b><button data-a="edm" data-k="${esc(k)}" data-d="1" aria-label="เพิ่ม ${esc(k)}">+</button></div>`).join('')}</div>`;
    const mine = Object.keys(S.counts).filter(id => S.counts[id] > 0 && DEFS[id]).map(id => DEFS[id]).sort((x, y) => (KORD[x.kind] - KORD[y.kind]) || x.cost - y.cost || cmpId(x, y));
    $('dmini').innerHTML = mine.map(d => `<div class="db-m" data-z="${esc(d.id)}"><div class="db-img" data-a="zoomt" data-id="${esc(d.id)}">${pic(d)}<span class="db-pill">${S.counts[d.id]}</span></div>
      <div class="db-step"><button data-a="sub" data-id="${esc(d.id)}" aria-label="ลด">−</button><button data-a="add" data-id="${esc(d.id)}" ${(nc[d.name] || 0) >= 4 || S.counts[d.id] >= owned(d.id) ? 'disabled' : ''} aria-label="เพิ่ม">+</button></div></div>`).join('')
      || '<span class="db-muted">ยังไม่มีการ์ดในเด็ค คลิกการ์ดทางซ้ายเพื่อใส่ลงเด็ค (ใส่ได้เท่าที่คุณมี)</span>';
    $('dbot').innerHTML = (errs.length ? `<div class="db-warn">${errs.map(esc).join('<br>')}</div>` : '<div class="good">✓ เด็คถูกต้อง พร้อมใช้เล่น กดบันทึกแล้วกด PLAY ที่ Home</div>') +
      `<div class="db-acts"><button class="chip pri" data-a="share">📤 แชร์ / คัดลอกข้อความ</button><button class="chip" data-a="save">💾 บันทึกเด็ค</button><button class="chip" data-a="import">📥 นำเข้าจากข้อความ</button><button class="chip" data-a="clear">ล้างเด็ค</button></div>`;
    $('dbar').innerHTML = `<button class="db-bav" data-a="avopen" aria-label="เปลี่ยน Avatar">${av ? pic(av) : '<span>Avatar</span>'}</button>
      <div class="db-bin"><b>${av ? esc(av.name) : 'ยังไม่ได้เลือก Avatar'}</b><span><b>${tot}</b>/60 ${tot === 60 ? '<span class="good">ครบ</span>' : `<span class="bad">${tot < 60 ? 'ขาด ' + (60 - tot) : 'เกิน ' + (tot - 60)}</span>`}</span></div>
      <button class="chip pri" data-a="avopen">เปลี่ยน Avatar</button><button class="chip" data-a="sheet">ดูเด็ค ▲</button>`;
    $('dside').classList.toggle('open', !!S.sheet);
    renderPool();
  }

  /* ---------------- modal ---------------- */
  function openOv(html) { $('dov').innerHTML = `<div class="db-dlg box" role="dialog">${html}</div>`; $('dov').hidden = false; }
  function closeOv() { $('dov').hidden = true; $('dov').innerHTML = ''; }

  let shareD = null;
  function shareModal(d) {
    d = shareD = d || S; const text = toText(d), errs = validate(d);
    openOv(`<h2>แชร์เด็ค: ${esc(d.name)}</h2>
      ${errs.length ? `<div class="db-warn">เด็คนี้ยังไม่ถูกต้องตามกติกา (นำเข้าได้ แต่ต้องแก้ก่อนเล่น):<br>${errs.map(esc).join('<br>')}</div>` : ''}
      <p class="db-muted">คัดลอกข้อความนี้ส่งให้เพื่อน แล้วให้เพื่อนกด <b>นำเข้าจากข้อความ</b> ที่แท็บ Deckbuilder ของเขาแล้ววาง (เด็คที่บันทึกของคุณเองเล่นได้จากปุ่ม PLAY ที่ Home เลย ไม่ต้องคัดลอก · เพื่อนต้องมีการ์ดครบตามเด็คจึงจะใช้ได้)</p>
      <textarea id="dtxt" class="db-ta" readonly>${esc(text)}</textarea>
      <div class="db-acts"><button class="chip pri" data-a="copytxt">คัดลอกข้อความ</button><button class="chip" data-a="copylink">คัดลอกลิงก์แชร์</button><button class="chip" data-a="dl">ดาวน์โหลด .txt</button>
      <button class="chip" data-a="closeov">ปิด</button></div>
      <p class="db-muted">ลิงก์แชร์เปิดแล้วจะโหลดเด็คนี้ในหน้า Deckbuilder นี้ (ผู้รับกดคัดลอกข้อความต่อเพื่อนำเข้า AvastFallTCGsim)</p>`);
  }
  function importModal(text, warns) {
    openOv(`<h2>นำเข้าเด็คจากข้อความ</h2><p class="db-muted">วางข้อความเด็ค (รูปแบบเดียวกับที่ส่งออกจาก AvastFallTCGsim) หรือลิงก์แชร์ของหน้านี้</p>
      <textarea id="dimp" class="db-ta" placeholder="# เด็คของฉัน&#10;Avatar SD01-001&#10;Element ทอง 8&#10;SD01-002 x3">${esc(text || '')}</textarea>
      ${warns && warns.length ? `<div class="db-warn">${warns.map(esc).join('<br>')}</div>` : ''}
      <div class="db-acts"><button class="chip pri" data-a="doimport">นำเข้า</button><button class="chip" data-a="closeov">ปิด</button></div>`);
  }
  function avatarModal() {
    const avs = Object.values(DEFS).filter(d => d.kind === 'Avatar').sort((a, b) => (owned(b.id) > 0) - (owned(a.id) > 0) || cmpId(a, b));
    openOv(`<h2>เลือก Avatar <small class="db-muted">(เลือกได้เฉพาะที่คุณมี)</small></h2><div class="db-avg">${avs.map(d => `<button class="db-avc ${S.avatar === d.id ? 'on' : ''} ${owned(d.id) ? '' : 'lock'}" data-z="${esc(d.id)}" data-a="avpick" data-id="${esc(d.id)}">${pic(d)}<b>${esc(d.name)}</b><small>${d.els.map(e => ico(e, 13)).join('')} ${esc(d.id)} · ${owned(d.id) ? 'มี ' + owned(d.id) : '🔒 ยังไม่มี'}</small></button>`).join('') || '<span class="db-muted">ไม่พบ Avatar</span>'}</div>
      <div class="db-acts"><button class="chip" data-a="closeov">ปิด</button></div>`);
  }

  /* ---------------- เด็ค: เพิ่ม/ลบ/บันทึก/โหลด ---------------- */
  function setDeck(d) {
    S.id = d.id || null; S.name = d.name || DEFAULT_NAME; S.avatar = d.avatar && DEFS[d.avatar] ? d.avatar : null;
    S.counts = {}; for (const [id, n] of Object.entries(d.counts || {})) if (DEFS[id] && n > 0) S.counts[id] = Math.min(4, n);
    S.edeck = d.edeck && Object.values(d.edeck).some(n => n > 0) ? Object.assign({}, d.edeck) : null;
    base = d.fresh ? '' : snap();
    S.q = ''; S.sheet = false; if ($('dq')) $('dq').value = '';
    setMode('edit'); renderSide();
  }
  function newDeck() {
    const f = Object.values(DEFS).filter(d => d.kind === 'Avatar' && owned(d.id) > 0).sort(cmpId)[0];
    if (!f) { toast('ยังไม่มี Avatar — ซื้อ Starter Deck ที่ Shop ก่อน'); return goShop(); }
    setDeck({ id: null, name: DEFAULT_NAME, avatar: f && f.id, counts: {}, edeck: null, fresh: true });
    newDeckModal();
  }
  function newDeckModal() {
    const avs = Object.values(DEFS).filter(d => d.kind === 'Avatar').sort((a, b) => (owned(b.id) > 0) - (owned(a.id) > 0) || cmpId(a, b));
    openOv(`<h2>สร้างเด็คใหม่</h2><label class="db-lbl">ชื่อเด็ค<input id="dnn" type="text" maxlength="40" value="${esc(S.name)}"></label>
      <h3 class="db-nvh">เลือก Avatar <small class="db-muted">(เลือกได้เฉพาะที่คุณมี)</small></h3>
      <div class="db-avg">${avs.map(d => `<button class="db-avc ${S.avatar === d.id ? 'on' : ''} ${owned(d.id) ? '' : 'lock'}" data-z="${esc(d.id)}" data-a="nvpick" data-id="${esc(d.id)}">${pic(d)}<b>${esc(d.name)}</b><small>${d.els.map(e => ico(e, 13)).join('')} ${esc(d.id)} · ${owned(d.id) ? 'มี ' + owned(d.id) : '🔒 ยังไม่มี'}</small></button>`).join('')}</div>
      <div class="db-acts"><button class="chip pri" data-a="nvgo">เริ่มจัดเด็ค</button><button class="chip" data-a="closeov">ข้าม</button></div>`);
  }
  const goShop = () => { try { window.parent.postMessage({ afGo: 'shop' }, location.origin); } catch (e) { } };
  const hasAny = () => Object.values(DEFS).some(d => d.kind === 'Avatar' && owned(d.id) > 0);
  function loadDeck(id) { const d = loadSaved().find(x => x.id === id); if (d) setDeck(d); }
  function setMode(m) { $('dlist').hidden = m !== 'list'; $('dedit').hidden = m !== 'edit'; S.mode = m; if (m === 'list') renderList(); else { S.sh = 'mid'; applySh(); } }
  function backToList() {
    if (dirty() && !confirm('มีการแก้ไขที่ยังไม่ได้บันทึก ออกโดยไม่บันทึก?')) return;
    S.id = null; closeOv(); setMode('list'); scrollTo(0, 0);
  }
  function renderList() {
    hideZoom();
    const saved = loadSaved().sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const cards = saved.map(d => {
      const av = DEFS[d.avatar], errs = validate(d), ed = edeckOf(d), sure = confirmDel === d.id;
      const edTxt = Object.entries(ed).filter(([, n]) => n > 0).map(([k, n]) => k + ' ' + n).join(' · ') || '—';
      return `<div class="db-deck box"><div class="db-dart" ${av ? `data-z="${esc(av.id)}"` : ''}>${av ? pic(av) : '<div class="noimg">—</div>'}</div>
        <div class="db-dinfo"><h3>${esc(d.name)}</h3><div class="db-muted">Avatar: ${esc(av ? av.name : '—')} · ${sizeOf(d)}/60 ใบ</div><div class="db-muted">Element Deck: ${esc(edTxt)}</div>
        ${errs.length ? `<div class="bad db-ds">⚠ ${esc(errs[0])}${errs.length > 1 ? ` (และอีก ${errs.length - 1} ข้อ)` : ''}</div>` : '<div class="good db-ds">✓ เด็คถูกต้อง</div>'}
        <div class="db-acts">${errs.length ? '' : `<button class="chip pri" data-a="play" data-id="${esc(d.id)}">▶ เล่นด้วยเด็คนี้</button>`}<button class="chip ${errs.length ? 'pri' : ''}" data-a="edit" data-id="${esc(d.id)}">แก้ไข</button><button class="chip" data-a="lshare" data-id="${esc(d.id)}">แชร์ / คัดลอกข้อความ</button><button class="chip" data-a="dup" data-id="${esc(d.id)}">ทำสำเนา</button>
        <button class="chip ${sure ? 'danger' : ''}" data-a="del" data-id="${esc(d.id)}">${sure ? 'ยืนยันลบ' : 'ลบ'}</button></div></div></div>`;
    }).join('');
    $('dlist').innerHTML = `<h1>Deckbuilder</h1><p class="db-sub">จัดเด็คได้เฉพาะ<b>การ์ดที่คุณมี</b> (ซื้อเพิ่มที่ Shop) · เด็คที่บันทึกแล้วเก็บไว้กับบัญชีของคุณ และเล่นได้จากปุ่ม PLAY ที่ Home · ส่งให้เพื่อนด้วย <b>แชร์ / คัดลอกข้อความ</b></p>
      <div class="db-lgrid">${cards}${hasAny() ? '<button class="db-deck db-add" data-a="create"><span>＋</span>สร้างเด็คใหม่</button>' : '<button class="db-deck db-add" data-a="toshop"><span>🛒</span>ยังไม่มีการ์ด — ไปซื้อ Starter Deck ที่ Shop</button>'}</div>
      <div class="db-acts"><button class="chip" data-a="import">📥 นำเข้าจากข้อความ / ลิงก์</button></div>`;
  }
  let confirmDel = null;
  function saveDeck() {
    const a = loadSaved(), id = S.id || 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const rec = { id, name: (S.name || '').trim() || DEFAULT_NAME, avatar: S.avatar, counts: JSON.parse(JSON.stringify(S.counts)), edeck: S.edeck ? Object.assign({}, S.edeck) : null, updated: Date.now() };
    const i = a.findIndex(x => x.id === id); if (i >= 0) a[i] = rec; else a.push(rec);
    S.id = id; S.name = rec.name; base = snap();
    const okSave = lsSet(LS_DECKS, a); if (okSave) notify();
    toast(okSave ? 'บันทึกเด็คแล้ว ✓ ใช้กด PLAY ที่ Home ได้เลย' : 'บันทึกลงเครื่องไม่ได้');
    renderSide();
  }
  function add(id, dlt) {
    const df = DEFS[id]; if (!df) return;
    let n = (S.counts[id] || 0) + dlt;
    if (dlt > 0) {
      const av = DEFS[S.avatar];
      if (av && !allowed(av, df)) return toast('ธาตุไม่ตรงกับ Avatar');
      if (n > owned(id)) return toast(owned(id) ? 'คุณมี ' + df.name + ' แค่ ' + owned(id) + ' ใบ ใส่ครบแล้ว' : 'คุณยังไม่มีการ์ดใบนี้ — ไปซื้อที่ Shop');
      if ((nameCounts(S)[df.name] || 0) >= 4) return toast('ชื่อซ้ำได้ไม่เกิน 4 ใบ');
    }
    n = Math.max(0, Math.min(4, n)); if (n) S.counts[id] = n; else delete S.counts[id];
    renderSide();
  }
  function doImport() {
    let txt = ($('dimp') || {}).value || '';
    const m = txt.match(/#deck=([A-Za-z0-9_-]+)/);
    if (m) { try { txt = unb64(m[1]); } catch (e) { return importModal(txt, ['ลิงก์ไม่ถูกต้อง']); } }
    const r = fitOwned(parseText(txt));
    if (!Object.keys(r.counts).length && !r.avatar) return importModal(txt, ['ไม่พบการ์ดในข้อความ', ...r.warns]);
    setDeck({ id: null, name: r.name, avatar: r.avatar, counts: r.counts, edeck: r.edeck, fresh: true });
    if (r.warns.length) importModal(txt, ['นำเข้าแล้ว แต่มีบางบรรทัดถูกข้าม:', ...r.warns]); else { closeOv(); toast('นำเข้าเด็คแล้ว ✓'); }
  }
  function download(d) {
    const blob = new Blob([toText(d) + '\n'], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (d.name || 'deck').replace(/[\\/:*?"<>|]+/g, '_') + '.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function onClick(e) {
    if (!e.target.closest('.db-toolbar')) closePanels();
    const t = e.target.closest('[data-a]'); if (!t) return;
    const a = t.dataset.a, id = t.dataset.id;
    switch (a) {
      case 'add': return add(id, 1);
      case 'sub': return add(id, -1);
      case 'sheet': S.sheet = !S.sheet; $('dside').classList.toggle('open', S.sheet); if (S.sheet) $('dside').scrollTop = 0; return;
      case 'zoom': case 'zoomt': {
        if (a === 'zoomt' && canHover) return;
        const d = DEFS[id]; if (!d) return;
        openOv(`<div class="zpop zd">${zoomHtml(d)}</div><div class="db-acts"><button class="chip pri" data-a="add" data-id="${esc(id)}">＋ เพิ่มลงเด็ค</button><button class="chip" data-a="closeov">ปิด</button></div>`); return;
      }
      case 'tab': S.tab = t.dataset.v; return renderSide();
      case 'fpanel': { const o = $('dfil').hidden; closePanels(); $('dfil').hidden = !o; return; }
      case 'spanel': { const o = $('dsort').hidden; closePanels(); $('dsort').hidden = !o; return; }
      case 'sortset': S.sort = t.dataset.v; renderSort(); closePanels(); return renderPool();
      case 'shtoggle': if (!isMob() || dragged || e.target.closest('.db-toolbar')) return; S.sh = S.sh === 'mid' ? 'full' : 'mid'; return applySh();
      case 'elt': S.elopen = !S.elopen; return renderSide();
      case 'nvpick': { const n = $('dnn'); if (n) S.name = n.value; if (!owned(id)) return toast('คุณยังไม่มี Avatar ใบนี้ — ไปซื้อที่ Shop'); S.avatar = id; S.edeck = null; renderSide(); return newDeckModal(); }
      case 'nvgo': { const n = $('dnn'); S.name = ((n && n.value) || '').trim() || DEFAULT_NAME; closeOv(); return renderSide(); }
      case 'create': return newDeck();
      case 'toshop': return goShop();
      case 'play': { try { window.parent.postMessage({ afLaunch: { deckId: id } }, location.origin); } catch (e) { } return; }
      case 'back': return backToList();
      case 'edit': return loadDeck(id);
      case 'lshare': { const d = loadSaved().find(x => x.id === id); if (d) shareModal(d); return; }
      case 'dup': { const a = loadSaved(), d = a.find(x => x.id === id); if (!d) return; a.push(Object.assign(JSON.parse(JSON.stringify(d)), { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: d.name + ' (สำเนา)', updated: Date.now() })); lsSet(LS_DECKS, a); notify(); return renderList(); }
      case 'del': { if (confirmDel !== id) { confirmDel = id; return renderList(); } lsSet(LS_DECKS, loadSaved().filter(x => x.id !== id)); notify(); confirmDel = null; toast('ลบเด็คแล้ว'); return renderList(); }
      case 'save': return saveDeck();
      case 'clear': if (Object.keys(S.counts).length && !confirm('ล้างการ์ดทั้งหมดในเด็คนี้?')) return; S.counts = {}; return renderSide();
      case 'avopen': return avatarModal();
      case 'avpick': if (!owned(id)) return toast('คุณยังไม่มี Avatar ใบนี้ — ไปซื้อที่ Shop'); S.avatar = id; closeOv(); return renderSide();
      case 'edm': { const cur = Object.assign({}, edeckOf(S)); const v = Math.max(0, (cur[t.dataset.k] || 0) + +t.dataset.d); if (v) cur[t.dataset.k] = v; else delete cur[t.dataset.k]; S.edeck = cur; return renderSide(); }
      case 'edauto': S.edeck = null; return renderSide();
      case 'share': return shareModal(S);
      case 'import': return importModal('', []);
      case 'doimport': return doImport();
      case 'closeov': return closeOv();
      case 'copytxt': return toast(await copy(toText(shareD || S)) ? 'คัดลอกข้อความแล้ว ✓' : 'คัดลอกไม่ได้ เลือกข้อความแล้วกด Ctrl+C');
      case 'copylink': return toast(await copy(shareLink(shareD || S)) ? 'คัดลอกลิงก์แล้ว ✓' : 'คัดลอกไม่ได้');
      case 'dl': return download(shareD || S);
    }
  }


  /* ---------------- เอาเมาส์วางบนการ์ด → ขยายให้อ่านความสามารถชัด ๆ ----------------
     ใช้กับทุกที่ที่มี data-z="<รหัสการ์ด>" (คลังการ์ด · เด็คด้านขวา · Avatar · หน้ารายการเด็ค)
     ปิดบนจอสัมผัส (ไม่มี hover) · กล่องขยายไม่รับเมาส์ จึงไม่กะพริบ */
  const canHover = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  let zEl = null, zFor = null;
  function hideZoom() { if (zEl) { zEl.classList.remove('on'); zEl.style.display = 'none'; } zFor = null; }
  function injectZoomCss() {
    if (document.getElementById('dzoom-css')) return;
    const s = document.createElement('style'); s.id = 'dzoom-css';
    s.textContent = `
#dzoom{position:fixed;left:0;top:0;z-index:2147483000;box-sizing:border-box;width:360px;max-width:calc(100vw - 16px);padding:10px;pointer-events:none;opacity:0;visibility:hidden;transform:scale(.97);transition:opacity .12s,transform .12s;background:var(--card,#fff);color:var(--ink,#111);border:3px solid var(--ink,#111);border-radius:20px;box-shadow:8px 8px 0 rgba(0,0,0,.35);overflow:hidden;font-size:15px;line-height:1.5}
#dzoom.on{opacity:1;visibility:visible;transform:none}
#dzoom .zi,.zpop .zi{display:flex;justify-content:center}
.zpop img{display:block;max-width:100%;width:auto;height:auto;border:3px solid var(--ink,#111);border-radius:14px}
.zpop h3{margin:10px 2px 6px;font-size:1.25rem;line-height:1.25}
.zpop .zm{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.zpop .zc{display:inline-flex;align-items:center;gap:4px;padding:2px 12px;border:2px solid var(--ink,#111);border-radius:99px;font-weight:700;font-size:.85rem;background:var(--card,#fff)}
.zpop p{margin:6px 2px 0}.zpop .zn{color:var(--mut,#666)}
.zpop .kw{display:inline-block;margin-right:6px;padding:0 9px;border-radius:7px;background:#111;color:#fff;font-weight:700;font-size:.8rem}
.zpop .kw.AUTO,.zpop .kw.ACTIVATE,.zpop .kw.COST{background:#111}
.db-img[data-z],.db-m[data-z]{cursor:zoom-in}
.db-t{position:relative}.db-i{display:none;position:absolute;top:10px;left:10px;width:26px;height:26px;border-radius:50%;border:2px solid var(--ink,#111);background:var(--gold,#fc0);color:#111;font:700 15px/1 serif;font-style:italic;padding:0;cursor:pointer;z-index:2}
@media(hover:none),(pointer:coarse){.db-i{display:block}.db-m .db-img{cursor:zoom-in}}
.db-bar-m,.db-sheet-x{display:none}
.zd{max-height:calc(100vh - 120px);overflow:auto}.zd img{max-height:52vh}
/* ---------- v2 layout: PC สองคอลัมน์ · มือถือ/แท็บเล็ต = คลังการ์ดเป็น bottom sheet ---------- */
#dedit .db-topbar{margin:0 0 8px;gap:10px;flex-wrap:nowrap}
#dedit .db-topbar h1{font-size:1.2rem;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dedit .db-wrap{grid-template-columns:minmax(0,1fr) 420px;gap:14px;height:calc(100vh - 150px);min-height:520px;align-items:stretch}
html.embed #dedit .db-wrap{height:calc(100vh - 84px)}
#dedit .db-pool{display:flex;flex-direction:column;min-height:0;min-width:0}
.db-libhead{display:flex;align-items:baseline;gap:10px;margin-bottom:8px;position:relative}
.db-libhead b{font-size:1.15rem;letter-spacing:.05em;text-transform:uppercase}
.db-libhead .db-cnt{margin:0 0 0 auto;font-size:.85rem}
.db-grip{display:none}
.db-toolbar{position:relative;display:flex;gap:8px;align-items:center;margin-bottom:10px;flex:none}
.db-sr{flex:1;min-width:0;display:flex;align-items:center;gap:6px;border:3px solid var(--ink,#111);border-radius:12px;background:var(--card,#fff);padding:0 10px;box-shadow:3px 3px 0 var(--ink,#111)}
.db-sr input{border:0;box-shadow:none;background:transparent;padding:8px 2px;min-width:0}
.db-sr input:focus{outline:0}
.db-tb{flex:none;white-space:nowrap;padding:8px 14px;font-weight:700;position:relative}
.db-tb i{position:absolute;top:-7px;right:-6px;min-width:20px;height:20px;border-radius:99px;background:var(--gold,#fc0);color:#111;border:2px solid #111;font:700 .72rem/16px sans-serif;text-align:center;font-style:normal}
.db-panel{position:absolute;top:calc(100% + 8px);left:0;right:0;z-index:9;background:var(--card,#fff);border:3px solid var(--ink,#111);border-radius:14px;box-shadow:4px 4px 0 var(--ink,#111);padding:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:center;margin:0}
.db-sortp{display:flex;flex-wrap:wrap}
#dedit .db-grid{flex:1;min-height:0;overflow:auto;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;padding:6px 8px 28px;align-content:start}
.db-t{padding:4px}
.db-t .db-step{display:none}
.db-img .db-pill{top:auto;right:6px;bottom:6px;min-width:30px;height:30px;font-size:1rem;padding:0 4px;box-shadow:0 2px 4px rgba(0,0,0,.35)}
.db-pill.z{background:#e6e6e6;color:#555}
.db-t .db-minus{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;border:2px solid #111;background:#fff;color:#111;font:700 1rem/1 sans-serif;cursor:pointer;z-index:2;padding:0}
.db-t:hover .db-img img{transform:translateY(-2px)}
#dedit .db-side{position:static;max-height:none;height:100%;overflow:hidden;padding:12px;gap:8px;min-height:0}
#dedit .db-side>.db-mini{flex:1;min-height:90px;overflow:auto;align-content:start;padding:4px;grid-template-columns:repeat(auto-fill,minmax(84px,1fr))}
#dedit .db-side>.db-bot{max-height:34%;overflow:auto}
.db-av{width:104px}
.db-tab{display:flex;flex-direction:column;align-items:center;line-height:1.15;padding:6px 2px}.db-tab b{display:block;margin:0;font-size:1.05rem}
.db-elh{cursor:pointer}
.db-nvh{margin:12px 0 6px;color:var(--ink,#111)}
@media(min-width:1280px){#dedit .db-wrap{grid-template-columns:minmax(0,1fr) 460px}#dedit .db-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}}
@media(min-width:901px) and (max-width:1100px){#dedit .db-wrap{grid-template-columns:minmax(0,1fr) 340px}#dedit .db-grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}}
@media(max-width:900px){
 #dedit{--sh:48vh;position:fixed;inset:0;z-index:12;background:var(--bg,#fbfbf7);display:flex;flex-direction:column;padding:calc(8px + env(safe-area-inset-top,0px)) 10px 0;overflow:hidden}
 #dedit[hidden]{display:none}
 #dedit.sh-min{--sh:calc(58px + env(safe-area-inset-bottom,0px))}
 #dedit.sh-full{--sh:calc(100vh - 64px)}
 @supports(height:100dvh){#dedit.sh-full{--sh:calc(100dvh - 64px)}#dedit{--sh:48dvh}#dedit.sh-min{--sh:calc(58px + env(safe-area-inset-bottom,0px))}}
 #dedit .db-wrap{display:block;height:auto;min-height:0;flex:1;position:relative}
 #dedit .db-side{position:absolute;inset:0;height:auto;overflow:auto;display:flex;border:0;box-shadow:none;background:transparent;padding:0 0 calc(var(--sh) + 12px)}
 #dedit .db-side>.db-sheet-x{display:none}
 #dedit .db-side>.db-mini{flex:none;overflow:visible;min-height:60px;grid-template-columns:repeat(auto-fill,minmax(62px,1fr))}
 #dedit .db-side>.db-bot{max-height:none;overflow:visible}
 .db-bar-m{display:none!important}
 #dedit .db-pool{position:fixed;left:0;right:0;bottom:0;height:var(--sh);z-index:14;background:var(--card,#fff);border-top:3px solid var(--ink,#111);border-radius:18px 18px 0 0;box-shadow:0 -6px 18px rgba(0,0,0,.28);padding:6px 10px calc(8px + env(safe-area-inset-bottom,0px));transition:height .2s}
 .db-libhead{padding-top:12px;cursor:pointer;touch-action:none;user-select:none;margin-bottom:6px}
 .db-grip{display:block;position:absolute;top:0;left:50%;transform:translateX(-50%);width:46px;height:5px;border-radius:9px;background:var(--mut,#888)}
 #dedit.sh-min .db-toolbar,#dedit.sh-min .db-grid{display:none}
 .db-tb{flex:1;text-align:center}.db-sr{flex:2}
 #dedit .db-grid{grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;padding:4px 2px 16px}
 .db-t .db-minus{top:6px;right:6px}
}
@media(max-width:600px){
 #dedit .db-grid{grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px}
 .db-t{padding:2px}.db-t .db-nm,.db-t .db-mt{display:none}
 .db-t .db-own:not(.none){display:none}.db-t .db-own{font-size:.58rem;padding:0 5px;left:2px;bottom:2px}
 .db-img .db-pill{min-width:24px;height:24px;font-size:.85rem;right:3px;bottom:3px}
 .db-t .db-i{top:5px;left:5px;width:22px;height:22px;font-size:13px}
 .db-t .db-minus{width:24px;height:24px;top:4px;right:4px}
 .db-m .db-step button{width:22px;height:22px}
 .db-tb{padding:8px 8px;font-size:.85rem}.db-sr{flex:1.4}
}
@media(prefers-reduced-motion:reduce){#dzoom{transition:none}}`;
    document.head.appendChild(s);
  }
  function placeZoom(anchor) {
    const r = anchor.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, gap = 12;
    const img = zEl.querySelector('img');
    if (img) { img.style.maxHeight = ''; const over = zEl.offsetHeight - (vh - 16); if (over > 0) img.style.maxHeight = Math.max(140, img.offsetHeight - over) + 'px'; }
    const w = zEl.offsetWidth, h = zEl.offsetHeight;
    const room = { right: vw - r.right, left: r.left };
    let x = room.right >= w + gap + 8 || room.right >= room.left ? r.right + gap : r.left - gap - w;
    x = Math.max(8, Math.min(x, vw - w - 8));
    const y = Math.max(8, Math.min(r.top + r.height / 2 - h / 2, vh - h - 8));
    zEl.style.transform = ''; zEl.style.left = x + 'px'; zEl.style.top = y + 'px';
  }
  function zoomHtml(d) {
    const fx = (d.fx || []).map(f => `<p>${f[0] ? `<span class="kw ${esc(String(f[0]).split(' ')[0])}">${esc(String(f[0]).split(' ')[0])}</span>` : ''}${esc(f[0] && /^\S+\s/.test(f[0]) ? f[0].replace(/^\S+\s+/, '') + ': ' : '')}${esc(f[1])}</p>`).join('') || '<p class="zn">ไม่มีเอฟเฟกต์</p>';
    const chips = [d.kind, costTxt(d), d.tribe, d.id].filter(Boolean).map(c => `<span class="zc">${esc(c)}</span>`).join('');
    return `<div class="zi">${d.img ? `<img src="${esc(d.img)}" alt="">` : ''}</div><h3>${d.els.map(e => ico(e, 18)).join('')} ${esc(d.name)}</h3><div class="zm">${chips}</div>${fx}`;
  }
  function showZoom(anchor) {
    const d = DEFS[anchor.dataset.z]; if (!d) return hideZoom();
    injectZoomCss();
    if (!zEl) { zEl = document.createElement('div'); zEl.id = 'dzoom'; zEl.className = 'zpop'; zEl.setAttribute('aria-hidden', 'true'); document.body.appendChild(zEl); }
    zEl.innerHTML = zoomHtml(d);
    zFor = anchor; zEl.style.display = ''; zEl.classList.add('on'); placeZoom(anchor);
    const im = zEl.querySelector('img'); if (im && !im.complete) im.onload = () => { if (zFor === anchor) placeZoom(anchor); };
  }
  function initZoom() {
    if (!canHover) return;
    document.addEventListener('mouseover', e => {
      const a = e.target.closest && e.target.closest('[data-z]');
      if (!a) return hideZoom();
      if (a !== zFor) showZoom(a);
    });
    document.addEventListener('mouseout', e => {
      if (!zFor) return;
      const to = e.relatedTarget;
      if (!to || !(to.closest && to.closest('[data-z]') === zFor)) hideZoom();
    });
    addEventListener('scroll', hideZoom, true);
    addEventListener('blur', hideZoom);
    addEventListener('keydown', e => { if (e.key === 'Escape') hideZoom(); });
  }

  /* ---------------- สลับหน้า Card List / Deckbuilder ---------------- */
  function showView(v) {
    hideZoom();
    const deck = v === 'deck';
    $('v-cards').hidden = deck; $('v-deck').hidden = !deck;
    document.querySelectorAll('.sitetabs a[data-v]').forEach(a => { const on = a.dataset.v === v; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    try { history.replaceState(null, '', deck ? '#deckbuilder' : location.pathname + location.search); } catch (e) { }
  }
  function fromHash() {
    const m = location.hash.match(/^#deck=([A-Za-z0-9_-]+)/);
    if (m) {
      try { const r = fitOwned(parseText(unb64(m[1]))); setDeck({ id: null, name: r.name, avatar: r.avatar, counts: r.counts, edeck: r.edeck, fresh: true }); showView('deck'); toast('โหลดเด็คจากลิงก์แล้ว'); return true; } catch (e) { }
    }
    if (location.hash === '#deckbuilder') { showView('deck'); return true; }
    return false;
  }

  /* รับเด็คจากหน้าเกม: { id } แก้เด็คที่บันทึกไว้ · { text, name } ใส่เป็นเด็คใหม่ที่ยังไม่บันทึก (เช่นคัดลอกเด็คตัวอย่างมาแก้) */
  function openDeck(p) {
    if (S.mode === 'edit' && dirty() && !confirm('มีการแก้ไขที่ยังไม่ได้บันทึก ทิ้งแล้วเปิดเด็คอื่น?')) return;
    showView('deck'); closeOv();
    if (p && p.id) { const d = loadSaved().find(x => x.id === p.id); if (d) return setDeck(d); toast('ไม่พบเด็คนี้ในที่เก็บ'); return setMode('list'); }
    if (p && p.text) { const r = fitOwned(parseText(p.text)); return setDeck({ id: null, name: p.name || r.name, avatar: r.avatar, counts: r.counts, edeck: r.edeck, fresh: true }); }
  }
  window.DB = {
    show: showView, openDeck, ready: () => inited,
    refreshOwned(map) { window.__AF = window.__AF || {}; window.__AF.owned = map || {}; if (!inited) return; renderFilters(); if (S.mode === 'edit') renderSide(); else renderList(); },
    init() {
      if (inited) return; inited = true;
      buildDefs(); injectZoomCss(); skeleton(); renderFilters(); initZoom();
      document.querySelectorAll('.sitetabs a[data-v]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); showView(a.dataset.v); }));
      setMode('list');
      fromHash();
      addEventListener('hashchange', fromHash);
      if (window.__afDeckQ) { const q = window.__afDeckQ; window.__afDeckQ = null; openDeck(q); }
    }
  };
})();
