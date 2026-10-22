/* UI · เชื่อมหน้าจอกับ AF.cardData (ชั้นดึงข้อมูลอยู่ที่ js/data/cards-api.js)
   - สร้าง CSS รูปการ์ดจาก URL ของ API
   - รับแจ้งเมื่อข้อมูลเปลี่ยน แล้ววาดหน้าใหม่ */
'use strict';
const artKey=id=>String(id).replace(/[^\w-]/g,'_');
const cardArt=id=>`im-${artKey(id)}`;

/* รูปการ์ดทั้งหมดดึงจาก card-api ถ้ารูปยังโหลดไม่ได้ (เซิร์ฟเวอร์หลับ/ออฟไลน์) จะเห็นหลังการ์ดแทน */
function buildImgCss(){
  const back='url("assets/card-back.jpg")';
  const rules=[];
  for(const d of Object.values(AF.defs)){
    const u=DATA.imageUrl(d).replace(/"/g,'%22');
    rules.push(`.im-${artKey(d.id)}{background-image:url("${u}"),${back}}`);
  }
  imgcssEl.textContent=rules.join('\n');
}
function syncFromData(){
  const raw=DATA.raw;
  if(raw.ELEMENTS)for(const [k,v] of Object.entries(raw.ELEMENTS))if(v&&v.p)ELEMENTS[k]={c:v.c,p:v.p};
  buildImgCss();
}
DATA.holdApply=()=>ui.screen==='game';   // ไม่เปลี่ยนข้อมูลกลางเกม
DATA.subscribe(ev=>{
  if(ev==='data'){syncFromData();if(ui.cfg){fixSelections();render()}}
  else if(ui.screen==='setup'&&ui.cfg)render();
});
function loadFromApi(){return DATA.load()}
