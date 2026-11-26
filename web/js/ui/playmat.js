/* UI · สนามเล่น (Playmat): พื้นหลังเปลี่ยนได้ — พรีเซ็ต / รูปจากเครื่อง / ลิงก์รูป
   - ชั้นพื้นหลัง #matbg อยู่นอก #app (เกม render ซ้ำก็ไม่กระพริบ) · หน้าต่างเลือกสนาม #matdlg ก็อยู่นอก #app เช่นกัน
   - รูปที่นำเข้าถูกย่อ (ด้านยาวสุด 2200px) แล้วเก็บเป็น Blob ใน IndexedDB ของเบราว์เซอร์นี้เท่านั้น ไม่อัปโหลดขึ้นเซิร์ฟเวอร์
   - ค่าที่เลือก/ความมืด/ความเบลอ เก็บใน localStorage 'af-mat'
   - เปิดหน้าต่างด้วย AFMat.open() (ปุ่ม "🖼 สนาม" ในเกม = data-act="mat") */
'use strict';
(function () {
  var KEY = 'af-mat', DBN = 'af-playmat', STORE = 'img', MAXSIDE = 2200, MAXFILE = 30 * 1024 * 1024;
  var PRESETS = [
    { id: 'meadow', name: 'ทุ่งหญ้า', src: '/assets/mat/meadow.jpg', t: '/assets/mat/meadow-t.jpg' },
    { id: 'sakura', name: 'ซากุระยามค่ำ', src: '/assets/mat/sakura.jpg', t: '/assets/mat/sakura-t.jpg' },
    { id: 'cyber', name: 'ไซเบอร์', src: '/assets/mat/cyber.jpg', t: '/assets/mat/cyber-t.jpg' },
    { id: 'plain', name: 'สีพื้นเรียบ', css: 'radial-gradient(ellipse at 50% 45%,#1d4a66 0%,#0b2236 60%,#050d16 100%)' }
  ];
  var DEF = { id: 'meadow', dim: 0.12, blur: 0, url: '' };
  var st = load(), customURL = null, hasCustom = false, msgTimer = 0;

  /* ---------- เก็บค่า ---------- */
  function load() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { }
    var s = { id: DEF.id, dim: DEF.dim, blur: DEF.blur, url: '' };
    if (typeof o.id === 'string') s.id = o.id;
    if (typeof o.dim === 'number' && o.dim >= 0 && o.dim <= 0.9) s.dim = o.dim;
    if (typeof o.blur === 'number' && o.blur >= 0 && o.blur <= 20) s.blur = o.blur;
    if (typeof o.url === 'string') s.url = o.url;
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } }

  /* ---------- IndexedDB (เก็บรูปที่นำเข้า) ---------- */
  function idb() {
    return new Promise(function (res, rej) {
      try {
        var rq = indexedDB.open(DBN, 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error); };
      } catch (e) { rej(e); }
    });
  }
  function idbOp(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, mode), rq = fn(tx.objectStore(STORE));
        tx.oncomplete = function () { db.close(); res(rq && rq.result); };
        tx.onerror = tx.onabort = function () { db.close(); rej(tx.error); };
      });
    });
  }
  var dbGet = function (k) { return idbOp('readonly', function (s) { return s.get(k); }); };
  var dbPut = function (k, v) { return idbOp('readwrite', function (s) { return s.put(v, k); }); };
  var dbDel = function (k) { return idbOp('readwrite', function (s) { return s.delete(k); }); };

  /* ---------- ชั้นพื้นหลัง ---------- */
  var bg = document.createElement('div');
  bg.id = 'matbg'; bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML = '<div class="mb-img"></div><div class="mb-dim"></div>';
  document.body.insertBefore(bg, document.body.firstChild);
  var imgEl = bg.firstChild;

  function apply() {
    bg.style.setProperty('--mb-dim', st.dim);
    bg.style.setProperty('--mb-blur', st.blur + 'px');
    var p = PRESETS.filter(function (x) { return x.id === st.id; })[0], v = 'none';
    if (st.id === 'custom' && customURL) v = 'url("' + customURL + '")';
    else if (st.id === 'url' && /^https?:\/\//i.test(st.url)) v = 'url("' + st.url.replace(/["\\\s]/g, encodeURIComponent) + '")';
    else if (p && p.src) v = 'url("' + p.src + '")';
    else if (p && p.css) v = p.css;
    imgEl.style.backgroundImage = v;
    document.documentElement.setAttribute('data-mat', st.id);
  }
  function setCustom(blob) {
    if (customURL) { try { URL.revokeObjectURL(customURL); } catch (e) { } customURL = null; }
    hasCustom = !!blob;
    if (blob) customURL = URL.createObjectURL(blob);
  }

  /* ---------- นำเข้ารูป ---------- */
  function decode(file) {
    if (window.createImageBitmap) return createImageBitmap(file).catch(function () { return viaImg(file); });
    return viaImg(file);
  }
  function viaImg(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); res(im); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('decode')); };
      im.src = u;
    });
  }
  function toBlob(cv, q) { return new Promise(function (res) { cv.toBlob(res, 'image/jpeg', q); }); }
  function importFile(file) {
    if (!file) return Promise.resolve();
    if (!/^image\//.test(file.type)) { say('ไฟล์นี้ไม่ใช่รูปภาพ — ใช้ JPG / PNG / WebP'); return Promise.resolve(); }
    if (file.size > MAXFILE) { say('ไฟล์ใหญ่เกิน 30 MB — ลองย่อรูปก่อน'); return Promise.resolve(); }
    say('กำลังเตรียมรูป…', true);
    return decode(file).then(function (src) {
      var w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
      if (!w || !h) throw new Error('size');
      var k = Math.min(1, MAXSIDE / Math.max(w, h)), cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      var cx = cv.getContext('2d'); cx.fillStyle = '#0b2414'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.imageSmoothingQuality = 'high'; cx.drawImage(src, 0, 0, cv.width, cv.height);
      if (src.close) src.close();
      return toBlob(cv, 0.88).then(function (b) { return b && b.size > 6 * 1024 * 1024 ? toBlob(cv, 0.7) : b; });
    }).then(function (blob) {
      if (!blob) throw new Error('blob');
      setCustom(blob); st.id = 'custom'; save(); apply(); render();
      return dbPut('custom', blob).then(function () { say('ใช้รูปของคุณเป็นสนามแล้ว · บันทึกไว้ในเบราว์เซอร์นี้', true); },
        function () { say('ใช้รูปได้ แต่เบราว์เซอร์ไม่ยอมบันทึกถาวร (โหมดส่วนตัว?) — รีเฟรชแล้วรูปจะหาย'); });
    }).catch(function () { say('เปิดรูปนี้ไม่ได้ — ลองไฟล์ JPG / PNG / WebP'); });
  }
  function useURL(v) {
    v = (v || '').trim();
    if (!/^https:\/\/\S+$/i.test(v)) { say('ใส่ลิงก์รูปที่ขึ้นต้นด้วย https://'); return; }
    say('กำลังโหลดรูปจากลิงก์…', true);
    var im = new Image(), done = false, to = setTimeout(function () { if (!done) { done = true; say('โหลดรูปจากลิงก์ไม่ทัน — ลองบันทึกรูปแล้วนำเข้าจากเครื่องแทน'); } }, 10000);
    im.onload = function () { if (done) return; done = true; clearTimeout(to); st.id = 'url'; st.url = v; save(); apply(); render(); say('ใช้รูปจากลิงก์แล้ว (ลิงก์ต้องยังเปิดได้ตอนเล่น)', true); };
    im.onerror = function () { if (done) return; done = true; clearTimeout(to); say('โหลดรูปจากลิงก์ไม่ได้ — เว็บต้นทางอาจไม่อนุญาต ลองนำเข้าจากเครื่องแทน'); };
    im.src = v;
  }
  function choose(id) {
    if (id === 'custom' && !customURL) return;
    st.id = id; save(); apply(); render();
  }
  function delCustom() {
    setCustom(null); dbDel('custom').catch(function () { });
    if (st.id === 'custom') st.id = DEF.id;
    save(); apply(); render(); say('ลบรูปของฉันแล้ว', true);
  }
  function reset() {
    st = { id: DEF.id, dim: DEF.dim, blur: DEF.blur, url: '' }; save(); apply(); render(); say('คืนค่าสนามเริ่มต้นแล้ว', true);
  }

  /* ---------- หน้าต่างเลือกสนาม ---------- */
  var dlg = document.createElement('div');
  dlg.id = 'matdlg'; dlg.hidden = true; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-label', 'เปลี่ยนสนาม');
  document.body.appendChild(dlg);
  var picker = document.createElement('input');   // ตัวเลือกไฟล์ถาวร: ไม่โดนวาดใหม่ระหว่างเกมทำงาน
  picker.type = 'file'; picker.accept = 'image/*'; picker.hidden = true; document.body.appendChild(picker);
  picker.addEventListener('change', function () { var f = picker.files && picker.files[0]; picker.value = ''; importFile(f); });

  function render() {
    var thumbs = PRESETS.map(function (p) {
      var th = p.t ? 'background-image:url(' + p.t + ')' : 'background-image:' + p.css;
      return '<button type="button" class="md-p' + (st.id === p.id ? ' on' : '') + '" data-m="pick" data-id="' + p.id + '"><span class="th" style="' + th + '"></span><b>' + p.name + '</b></button>';
    }).join('');
    if (hasCustom && customURL) thumbs += '<button type="button" class="md-p' + (st.id === 'custom' ? ' on' : '') + '" data-m="pick" data-id="custom"><span class="th" style="background-image:url(' + customURL + ')"></span><b>รูปของฉัน</b><span class="md-del" role="button" tabindex="0" data-m="del" title="ลบรูปของฉัน" aria-label="ลบรูปของฉัน">🗑</span></button>';
    if (st.id === 'url' && st.url) thumbs += '<button type="button" class="md-p on" data-m="pick" data-id="url"><span class="th" style="background-image:url(&quot;' + st.url.replace(/["\\\s<>]/g, encodeURIComponent) + '&quot;)"></span><b>รูปจากลิงก์</b></button>';
    var keep = dlg.querySelector('.md-msg'), msg = keep ? keep.outerHTML : '<p class="md-msg" hidden></p>';
    var urlVal = dlg.querySelector('#mdUrl') ? dlg.querySelector('#mdUrl').value : '';
    dlg.innerHTML =
      '<div class="md-h"><h2>🖼 เปลี่ยนสนาม</h2><button type="button" class="md-x" data-m="close" aria-label="ปิด">✕</button></div>' +
      '<div class="md-b">' +
      '<div class="md-sec">เลือกสนาม</div><div class="md-grid">' + thumbs + '</div>' +
      '<div class="md-row"><button type="button" class="md-btn big" data-m="file">📁 นำเข้ารูปจากเครื่อง…</button>' +
      '<p class="md-hint">ลากรูปมาวางที่หน้าต่างนี้ก็ได้ · JPG / PNG / WebP · รูปแนวนอน 16:9 ขนาด 1600px ขึ้นไปจะคมที่สุด</p></div>' +
      '<div class="md-row"><input id="mdUrl" class="md-url" type="url" inputmode="url" placeholder="หรือวางลิงก์รูป https://…" value="' + urlVal.replace(/"/g, '&quot;') + '"><button type="button" class="md-btn" data-m="url">ใช้ลิงก์</button></div>' +
      msg +
      '<label class="md-sl"><span>ความมืดของพื้นหลัง <b id="mdDimV">' + Math.round(st.dim * 100) + '%</b></span><input id="mdDim" type="range" min="0" max="80" step="1" value="' + Math.round(st.dim * 100) + '"></label>' +
      '<label class="md-sl"><span>ความเบลอ <b id="mdBlurV">' + st.blur + 'px</b></span><input id="mdBlur" type="range" min="0" max="16" step="1" value="' + st.blur + '"></label>' +
      '<p class="md-note">ถ้ารูปสว่างจนอ่านการ์ดยาก ให้เพิ่มความมืด · รูปที่นำเข้าเก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่อัปโหลดขึ้นเซิร์ฟเวอร์ และไม่มีผลกับคู่ต่อสู้</p>' +
      '<div class="md-row" style="justify-content:space-between"><button type="button" class="md-btn" data-m="reset">↺ คืนค่าเริ่มต้น</button><button type="button" class="md-btn pri" data-m="close">เสร็จ</button></div>' +
      '</div>';
  }
  function say(t, ok) {
    var m = dlg.querySelector('.md-msg'); if (!m) return;
    m.textContent = t; m.className = 'md-msg' + (ok ? ' ok' : ''); m.hidden = !t;
    clearTimeout(msgTimer); if (t) msgTimer = setTimeout(function () { var x = dlg.querySelector('.md-msg'); if (x) x.hidden = true; }, 6000);
  }
  function open() { render(); dlg.hidden = false; var b = dlg.querySelector('.md-x'); if (b) b.focus({ preventScroll: true }); }
  function close() { dlg.hidden = true; }

  dlg.addEventListener('click', function (e) {
    var t = e.target.closest('[data-m]'); if (!t) return;
    var m = t.dataset.m;
    if (m === 'close') return close();
    if (m === 'file') return picker.click();
    if (m === 'pick') { if (e.target.closest('[data-m="del"]')) return delCustom(); return choose(t.dataset.id); }
    if (m === 'del') return delCustom();
    if (m === 'url') return useURL((dlg.querySelector('#mdUrl') || {}).value);
    if (m === 'reset') return reset();
  });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'mdUrl') { e.preventDefault(); useURL(e.target.value); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.m === 'del') { e.preventDefault(); e.stopPropagation(); delCustom(); }
  });
  dlg.addEventListener('input', function (e) {   // เลื่อนแล้วเห็นผลสด ไม่วาดหน้าต่างใหม่ (สไลเดอร์ไม่สะดุด)
    if (e.target.id === 'mdDim') { st.dim = e.target.value / 100; document.getElementById('mdDimV').textContent = e.target.value + '%'; apply(); save(); }
    if (e.target.id === 'mdBlur') { st.blur = +e.target.value; document.getElementById('mdBlurV').textContent = e.target.value + 'px'; apply(); save(); }
  });
  /* ลากรูปมาวาง */
  ['dragenter', 'dragover'].forEach(function (n) { dlg.addEventListener(n, function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); dlg.classList.add('drag'); } }); });
  dlg.addEventListener('dragleave', function (e) { if (!dlg.contains(e.relatedTarget)) dlg.classList.remove('drag'); });
  dlg.addEventListener('drop', function (e) { e.preventDefault(); dlg.classList.remove('drag'); var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; importFile(f); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !dlg.hidden) { close(); e.stopPropagation(); } }, true);

  /* ---------- เริ่มทำงาน ---------- */
  apply();
  dbGet('custom').then(function (b) {
    if (b) { setCustom(b); if (st.id === 'custom') apply(); }
    else if (st.id === 'custom') { st.id = DEF.id; save(); apply(); }
  }).catch(function () { if (st.id === 'custom') { st.id = DEF.id; apply(); } });

  window.AFMat = { open: open, close: close, toggle: function () { dlg.hidden ? open() : close(); }, state: function () { return JSON.parse(JSON.stringify(st)); } };
})();
