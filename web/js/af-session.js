/* เซสชันฝั่งเบราว์เซอร์ (โหลดเป็นสคริปต์แรกของทุกหน้า — เซิร์ฟเวอร์แทรกให้ใน <head> ตอนส่งหน้า)
   - เซิร์ฟเวอร์ใส่เด็คของผู้ใช้ลง localStorage 'cl-decks' ให้แล้วก่อนสคริปต์อื่นทำงาน
   - ตรงนี้ดักการเขียน 'cl-decks' (Deckbuilder / เกม) แล้วบันทึกขึ้น Supabase ผ่าน PUT /api/me/decks (หน่วงสั้น ๆ รวมหลายครั้งเป็นครั้งเดียว)
   - window.AF.logout() ออกจากระบบ · หมดอายุ/ถูกออกจากระบบ (401) → กลับหน้า login อัตโนมัติ */
(function () {
  'use strict';
  var KEY = 'cl-decks', timer = 0, pending = null, rawSet = Storage.prototype.setItem;
  var top_ = (function () { try { return window.top || window; } catch (e) { return window; } })();

  function toLogin() { try { top_.location.href = '/'; } catch (e) { location.href = '/'; } }
  function api(method, url, body) {
    return fetch(url, { method: method, credentials: 'same-origin', keepalive: true,
      headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { if (r.status === 401) { toLogin(); throw new Error('unauthorized'); } return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
  }
  function flush() {
    clearTimeout(timer); timer = 0;
    if (pending === null) return;
    var raw = pending, list; pending = null;
    try { list = JSON.parse(raw); } catch (e) { return; }
    if (!Array.isArray(list)) return;
    api('PUT', '/api/me/decks', { decks: list }).then(function (j) {
      if (j && j.decks) { try { rawSet.call(window.localStorage, KEY, JSON.stringify(j.decks)); } catch (e) { } window.dispatchEvent(new Event('af-decks-sync')); }   // เซิร์ฟเวอร์ตัดการ์ดที่ผู้ใช้ไม่มีออก → ใช้รายการที่แก้แล้ว
      window.dispatchEvent(new CustomEvent('af-decks-saved'));
    })
      .catch(function (e) { if (e.message !== 'unauthorized') console.warn('บันทึกเด็คขึ้นเซิร์ฟเวอร์ไม่สำเร็จ:', e.message); window.dispatchEvent(new CustomEvent('af-decks-save-error')); });
  }
  Storage.prototype.setItem = function (k, v) {
    rawSet.apply(this, arguments);
    if (this === window.localStorage && k === KEY) { pending = String(v); clearTimeout(timer); timer = setTimeout(flush, 500); }
  };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });

  // ส่งสัญญาณ "ออนไลน์" ทุก ~40 วินาที (เฉพาะตอนแท็บมองเห็นอยู่) — แอดมินดูได้ที่ /admin
  var PAGE = /^\/cards/.test(location.pathname) ? 'cards' : 'game';
  function beat() { if (document.visibilityState === 'visible') api('POST', '/api/presence', { page: PAGE }).catch(function () { }); }
  beat(); setInterval(beat, 40000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') beat(); });

  window.AF = {
    user: (window.__AF && window.__AF.user) || null,
    api: api,
    logout: function () {
      flush();
      return fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(function () { })
        .then(function () { try { localStorage.removeItem(KEY); localStorage.removeItem('af-collection-v1'); } catch (e) { } toLogin(); });
    }
  };
})();
