/* ตัวกรองแบบเลือกได้หลายตัว (multi-select) ใช้ร่วมกันระหว่าง Card List และ Deckbuilder
   state = { k: [ค่าที่เลือก], __m: { k: 'any'|'all' }, __r: { k: [min|null, max|null] } }
   spec  = [{ t:'chips', k, label, items:[{v,l,i}], mode:true, adv:true, limit }, { t:'range', k, label, min, max, adv:true }]
   - ในกลุ่มเดียวกัน = "หรือ" (เลือก Unit + Spell = ได้ทั้งสองประเภท) · ข้ามกลุ่ม = "และ"
   - กลุ่มที่ mode:true (ธาตุ, Keyword, เผ่า) สลับเป็น "ต้องตรงครบทุกอัน" ได้
   - ช่วงตัวเลข (Cost / ATK / DEF / CRI) ใส่ต่ำสุด–สูงสุด ปล่อยว่างข้างใดข้างหนึ่งได้ · การ์ดที่ไม่มีค่านั้น (เช่น Spell ไม่มี ATK) จะถูกซ่อนเมื่อกรองช่วงนั้น */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const CSS = `
.mf{display:grid;gap:12px}
.mf-g{border:0;margin:0;padding:0;min-width:0}
.mf-g>legend{font-weight:700;padding:0;margin:0 0 6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mf-g>legend i{font-style:normal;background:var(--gold,#ffc20e);color:#111;border-radius:99px;padding:0 8px;font-size:.75rem;line-height:1.5}
.mf-chips{display:flex;flex-wrap:wrap;gap:6px}
.mf-chips .chip{padding:3px 12px;font-size:.92rem;display:inline-flex;align-items:center;gap:5px}
.mf-chips .chip[hidden]{display:none}
.mf-mode{font:inherit;font-size:.75rem;font-weight:400;border:1px dashed currentColor;background:none;color:inherit;border-radius:99px;padding:0 10px;cursor:pointer;opacity:.85}
.mf-mode.all{border-style:solid;font-weight:700;opacity:1}
.mf-more{font:inherit;font-size:.85rem;border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;padding:3px 6px}
.mf-rng{display:flex;align-items:center;gap:6px}
.mf-rng input{width:78px!important;padding:5px 8px!important;border-width:2px!important;border-radius:10px!important}
.mf-ranges{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.mf-adv{border:2px dashed currentColor;border-radius:12px;padding:8px 12px}
.mf-adv>summary{cursor:pointer;font-weight:700}
.mf-adv[open]>summary{margin-bottom:10px}.mf-adv>.mf{margin-top:2px}
.mf-sum{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.mf-sum:empty{display:none}
.mf-tag{font:inherit;font-size:.82rem;border:2px solid currentColor;border-radius:99px;background:none;color:inherit;padding:0 10px;cursor:pointer}
.mf-tag b{margin-left:4px}.mf-tag:hover{background:var(--gold,#ffc20e);color:#111;border-color:#111}
.mf-clr{font:inherit;border:2px solid currentColor;border-radius:99px;background:none;color:inherit;padding:2px 14px;cursor:pointer;font-weight:700}
.mf-clr:hover{background:var(--gold,#ffc20e);color:#111;border-color:#111}`;
  function css() { if (document.getElementById('mf-css')) return; const s = document.createElement('style'); s.id = 'mf-css'; s.textContent = CSS; document.head.appendChild(s); }

  const arr = (st, k) => st[k] || (st[k] = []);
  const modeOf = (st, k) => (st.__m && st.__m[k]) || 'any';
  const rangeOf = (st, k) => (st.__r && st.__r[k]) || [null, null];
  const num = v => (v === '' || v == null || !isFinite(Number(v)) ? null : Number(v));

  function chipsHtml(g, st) {
    const sel = arr(st, g.k), lim = g.limit || 0, big = lim && g.items.length > lim + 2;
    const open = big && g.items.slice(lim).some(it => sel.includes(it.v));
    const btn = (it, i) => `<button type="button" class="chip mf-c${sel.includes(it.v) ? ' on' : ''}" data-mf="${esc(g.k)}" data-v="${esc(it.v)}" aria-pressed="${sel.includes(it.v)}"${big && i >= lim && !open ? ' hidden data-x="1"' : ''}>${it.i || ''}${esc(it.l == null ? it.v : it.l)}</button>`;
    return `<fieldset class="mf-g" data-g="${esc(g.k)}"><legend>${esc(g.label)} <i${sel.length ? '' : ' hidden'}>${sel.length}</i>${g.mode ? `<button type="button" class="mf-mode" data-mf-mode="${esc(g.k)}"></button>` : ''}</legend>
      <div class="mf-chips">${g.items.map(btn).join('')}${big ? `<button type="button" class="mf-more" data-mf-more="${esc(g.k)}"${open ? ' data-open="1"' : ''}>${open ? 'ย่อ' : `แสดงทั้งหมด (+${g.items.length - lim})`}</button>` : ''}</div></fieldset>`;
  }
  function rangeHtml(g, st) {
    const r = rangeOf(st, g.k);
    return `<fieldset class="mf-g" data-g="${esc(g.k)}"><legend>${esc(g.label)}</legend><div class="mf-rng"><input type="number" inputmode="numeric" data-mf-r="${esc(g.k)}" data-e="0" min="${g.min ?? 0}" max="${g.max ?? ''}" step="1" placeholder="${g.min ?? 0}" value="${r[0] == null ? '' : r[0]}" aria-label="${esc(g.label)} ต่ำสุด"><span>–</span><input type="number" inputmode="numeric" data-mf-r="${esc(g.k)}" data-e="1" min="${g.min ?? 0}" max="${g.max ?? ''}" step="1" placeholder="${g.max ?? ''}" value="${r[1] == null ? '' : r[1]}" aria-label="${esc(g.label)} สูงสุด"></div></fieldset>`;
  }
  function part(spec, st) {
    const ch = spec.filter(g => g.t === 'chips').map(g => chipsHtml(g, st)).join(''), rg = spec.filter(g => g.t === 'range').map(g => rangeHtml(g, st)).join('');
    return ch + (rg ? `<div class="mf-ranges">${rg}</div>` : '');
  }
  // → HTML ทั้งชุด: แถบสรุปตัวกรองที่ใช้ + กลุ่มหลัก + (ขั้นสูงใน <details>)
  function render(spec, st) {
    css();
    const basic = spec.filter(g => !g.adv), adv = spec.filter(g => g.adv);
    return `<div class="mf"><div class="mf-sum"></div>${part(basic, st)}${adv.length ? `<details class="mf-adv"${adv.some(g => active(g, st)) ? ' open' : ''}><summary>ตัวกรองขั้นสูง <span class="mf-advn"></span></summary><div class="mf">${part(adv, st)}</div></details>` : ''}</div>`;
  }
  function active(g, st) { if (g.t === 'range') { const r = rangeOf(st, g.k); return r[0] != null || r[1] != null; } return arr(st, g.k).length > 0; }
  const count = (spec, st) => spec.filter(g => active(g, st)).length;

  // ----- เงื่อนไขการจับคู่ -----
  function has(st, k, vals) {
    const sel = st[k]; if (!sel || !sel.length) return true;
    const v = (vals || []).filter(x => x != null && x !== '');
    return modeOf(st, k) === 'all' ? sel.every(s => v.includes(s)) : sel.some(s => v.includes(s));
  }
  function inRange(st, k, val) {
    const r = rangeOf(st, k); if (r[0] == null && r[1] == null) return true;
    if (val == null) return false;
    return (r[0] == null || val >= r[0]) && (r[1] == null || val <= r[1]);
  }
  function reset(st) { for (const k of Object.keys(st)) delete st[k]; }

  // ----- ผูกอีเวนต์ (เรียกครั้งเดียวต่อ root) · onChange() ถูกเรียกทุกครั้งที่ตัวกรองเปลี่ยน -----
  function bind(root, spec, st, onChange) {
    const byK = Object.fromEntries(spec.map(g => [g.k, g]));
    const label = (k, v) => { const g = byK[k], it = g && g.items && g.items.find(x => x.v === v); return it ? (it.l == null ? it.v : it.l) : v; };
    function sync() {
      root.querySelectorAll('.mf-c').forEach(b => { const on = arr(st, b.dataset.mf).includes(b.dataset.v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      root.querySelectorAll('.mf-g[data-g]').forEach(f => { const k = f.dataset.g, i = f.querySelector('legend>i'); if (i) { const n = arr(st, k).length; i.textContent = n; i.hidden = !n; } });
      root.querySelectorAll('.mf-mode').forEach(b => { const all = modeOf(st, b.dataset.mfMode) === 'all'; b.classList.toggle('all', all); b.textContent = all ? 'ต้องตรงครบทุกอัน' : 'ตรงอันใดอันหนึ่ง'; b.title = 'กดเพื่อสลับ: ตรงอันใดอันหนึ่ง / ต้องตรงครบทุกอันที่เลือก'; });
      root.querySelectorAll('input[data-mf-r]').forEach(i => { if (document.activeElement === i) return; const r = rangeOf(st, i.dataset.mfR)[+i.dataset.e]; i.value = r == null ? '' : r; });
      const tags = [];
      for (const g of spec) {
        if (g.t === 'range') { const r = rangeOf(st, g.k); if (r[0] != null || r[1] != null) tags.push(`<button type="button" class="mf-tag" data-mf-rm="${esc(g.k)}">${esc(g.label)} ${r[0] == null ? '≤' + r[1] : r[1] == null ? '≥' + r[0] : r[0] + '–' + r[1]}<b>×</b></button>`); }
        else for (const v of arr(st, g.k)) tags.push(`<button type="button" class="mf-tag" data-mf-rm="${esc(g.k)}" data-v="${esc(v)}">${esc(label(g.k, v))}<b>×</b></button>`);
      }
      const s = root.querySelector('.mf-sum'); if (s) s.innerHTML = tags.join('');
      const an = root.querySelector('.mf-advn'); if (an) { const n = spec.filter(g => g.adv && active(g, st)).length; an.textContent = n ? '(' + n + ')' : ''; }
    }
    root.addEventListener('click', e => {
      const c = e.target.closest('[data-mf]'), m = e.target.closest('[data-mf-mode]'), rm = e.target.closest('[data-mf-rm]'), more = e.target.closest('[data-mf-more]');
      if (c) { const a = arr(st, c.dataset.mf), i = a.indexOf(c.dataset.v); i < 0 ? a.push(c.dataset.v) : a.splice(i, 1); }
      else if (m) { st.__m = st.__m || {}; st.__m[m.dataset.mfMode] = modeOf(st, m.dataset.mfMode) === 'all' ? 'any' : 'all'; }
      else if (rm) { const k = rm.dataset.mfRm; if (rm.dataset.v != null && rm.dataset.v !== '') { const a = arr(st, k), i = a.indexOf(rm.dataset.v); if (i >= 0) a.splice(i, 1); } else if (st.__r) delete st.__r[k]; }
      else if (more) { const f = more.closest('.mf-g'), hid = f.querySelectorAll('.mf-chips .chip[data-x]'), open = more.dataset.open !== '1'; hid.forEach(b => { b.hidden = !open; }); more.dataset.open = open ? '1' : ''; const g = byK[more.dataset.mfMore]; more.textContent = open ? 'ย่อ' : `แสดงทั้งหมด (+${g.items.length - (g.limit || 0)})`; return; }
      else return;
      sync(); onChange();
    });
    root.addEventListener('input', e => {
      const i = e.target.closest('input[data-mf-r]'); if (!i) return;
      st.__r = st.__r || {}; const k = i.dataset.mfR, r = st.__r[k] || (st.__r[k] = [null, null]); r[+i.dataset.e] = num(i.value);
      if (r[0] != null && r[1] != null && r[0] > r[1]) { /* ใส่สลับกัน: ใช้ตอนกรองโดยสลับให้เอง */ }
      if (r[0] == null && r[1] == null) delete st.__r[k];
      sync(); onChange();
    });
    sync();
    return sync;
  }
  // ช่วงที่ผู้ใช้ใส่สลับกัน (ต่ำสุด > สูงสุด) → สลับให้เองตอนกรอง
  const _in = inRange;
  window.MF = { render, bind, count, has, inRange: (st, k, v) => { const r = rangeOf(st, k); if (r[0] != null && r[1] != null && r[0] > r[1]) { return _in({ __r: { [k]: [r[1], r[0]] } }, k, v); } return _in(st, k, v); }, reset, active };
})();
