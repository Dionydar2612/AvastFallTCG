/* UI · ตัวช่วยเด็ค (ส่งเด็คตัวอย่างไปแก้ใน Deckbuilder)
   การสร้าง/แก้ไข/ลบ/นำเข้าเด็คทั้งหมดอยู่ที่แท็บ Deckbuilder ที่เดียว (public/deckbuilder.js) ที่นี่ไม่มีตัวแก้ไขเด็คแล้ว */
'use strict';
function deckToText(d){
  const L=['# '+d.name,'Avatar '+d.avatar];
  for(const [k,n] of Object.entries(AF.edeckOf(d)))if(n>0)L.push('Element '+k+' '+n);
  const ids=Object.keys(d.counts).filter(i=>d.counts[i]>0).sort();
  for(const id of ids)L.push(id+' x'+d.counts[id]+'  # '+((AF.defs[id]||{}).name||'?'));
  return L.join('\n');
}
