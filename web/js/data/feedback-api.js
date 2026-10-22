/* ส่งข้อเสนอแนะไปที่ POST /api/feedback — ใช้ผ่าน AF.feedback.send(...) และ AF.feedback.CATEGORIES */
(function (AF) {
  'use strict';
  const CATEGORIES = [
    ['suggest', 'ข้อเสนอแนะ'],
    ['bug', 'พบข้อผิดพลาด'],
    ['card', 'เรื่องการ์ด/เอฟเฟกต์'],
    ['rule', 'เรื่องกติกา'],
    ['other', 'อื่น ๆ']
  ];
  async function send(payload) {
    let res;
    try {
      res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || 'ส่งไม่สำเร็จ (' + res.status + ')');
    return data;
  }
  AF.feedback = { CATEGORIES, send };
})(globalThis.AF = globalThis.AF || {});
