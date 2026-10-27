/* UI · หน้าตั้งค่าเกม (เลือกโหมด เด็ค ใครเล่นก่อน) */
'use strict';
/* ------------------------------------------------------------------ setup screen */
/* หัวหน้าเกม: เมนูหลักย้ายไปอยู่แถบบนสุดของเว็บแล้ว (วิธีเล่น · Update Note ใน index.html/site.js)
   ที่นี่เหลือแค่ปุ่มกลับเมื่ออยู่หน้า "วิธีเล่น" */
function navHTML(){
  return ui.page==='guide'?`<div class="top"><button class="btn sm" data-act="page" data-v="play">← กลับหน้าเล่น</button><span class="spacer"></span><button class="btn sm" data-act="feedback">ข้อเสนอแนะ</button></div>`
    :`<div class="top"><span class="spacer"></span><button class="btn sm" data-act="feedback">ข้อเสนอแนะ</button></div>`;
}
function deckTile(d,i,on,cur){
  const bad=deckErrors(d.key).length;
  return `<${cur?'div':'button'} class="dk ${on?'on':''} ${cur?'cur':''}" ${cur?'':`data-act="sel" data-p="${i}" data-k="${esc(d.key)}"`}><div class="art im-${artKey(d.avatar)}"></div><div class="nm"><b>${esc(d.name)}</b><span class="muted">${d.preset?esc(d.series)+' · ':'เด็คของฉัน · '}${elIcons(AF.defs[d.avatar])}</span>${bad?'<span class="bad">⚠ ยังไม่ครบ</span>':''}</div></${cur?'div':'button'}>`;
}
function setupHTML(){
  const c=ui.cfg;
  const names=c.mode==='bot'?['คุณ (ผู้เล่น 1)','บอท (ผู้เล่น 2)']:c.mode==='hot'?['ผู้เล่น 1','ผู้เล่น 2']:c.mode==='online'?['เด็คของคุณ','']:['บอท A','บอท B'];
  const pb=i=>{const k=c.sel[i];const d=deckByKey(k);const errs=deckErrors(k);const w=d?deckWarn(d):0;
    const tile=d?deckTile(d,i,true,true):'<div class="note">ยังไม่ได้เลือกเด็ค</div>';
    return `<section class="pbox"><h2>${esc(names[i])}</h2><div class="curdeck">${tile}</div>
    <div class="opt"><span class="muted">${d?`${AF.deckSize({counts:d.counts})}/60 ใบ · Element Deck: ${edeckText(d)}`:''}</span></div>
    <div class="opt"><button class="btn sm pri" data-act="chgdeck" data-p="${i}">เปลี่ยนเด็ค</button><button class="btn sm" data-act="editdb" data-p="${i}" ${d?'':'disabled'}>${d&&d.preset?'คัดลอกไปแก้ที่ Deckbuilder':'แก้ไขที่ Deckbuilder'}</button><button class="btn sm" data-go="deck">＋ สร้างเด็คที่ Deckbuilder</button></div>
    ${errs.length?`<div class="warnbox">${errs.map(esc).join('<br>')}</div>`:'<span class="muted">เด็คถูกต้อง</span>'}
    ${w?`<div class="note"><b>⚠ ${w} ใบในเด็คนี้</b> ยังไม่มีสคริปต์เอฟเฟกต์ หรือข้อความต่างจากที่สคริปต์เขียนไว้ ผลอาจไม่ครบ ดูรายละเอียดที่ชิป "ข้อมูลการ์ด" ด้านบน</div>`:''}</section>`};
  const bad=[0,1].some(i=>deckErrors(c.sel[i]).length);
  return `${navHTML()}
  <div class="hero"><span class="ot-badge"><i></i>OPEN TEST · เปิดให้ทดลองเล่น</span><h1>ร่วมทดลองเล่น AvastFall TCG <span class="ot-rev">กติกา Revised</span></h1><p class="muted">ขอเชิญทุกคนมาลองเล่นเวอร์ชันทดสอบ เล่นกับบอท ชวนเพื่อนเล่นสองคนในเครื่องเดียว หรือดูบอทเล่นกันเองก็ได้ ไม่ต้องสมัครหรือติดตั้งอะไร และสร้างเด็คของตัวเองได้ที่แท็บ "Deckbuilder" (เด็คที่บันทึกไว้จะมาให้เลือกที่หน้านี้)<br>เวอร์ชันนี้ยังอยู่ในช่วงทดสอบ การ์ดและกติกาอาจมีการปรับเปลี่ยน เจอบั๊กหรืออยากแนะนำอะไร บอกเราได้เลย</p><div class="ot-cta"><button class="btn pri" data-act="feedback">ส่งข้อเสนอแนะ / แจ้งบั๊ก</button></div></div>
  <div class="opts"><div class="opt"><label>โหมด</label><div class="seg">${[['bot','เล่นกับบอท'],['hot','สองคนในเครื่องเดียว'],['spec','ดูบอทเล่นกันเอง'],['online','เล่นออนไลน์กับเพื่อน']].map(([k,l])=>`<button class="${c.mode===k?'on':''}" data-act="mode" data-v="${k}">${l}</button>`).join('')}</div></div></div>
  ${c.mode==='online'?onlineHTML(pb):`<div class="setup" style="margin-top:16px">${pb(0)}${pb(1)}</div>
  <div class="opts"><div class="opt"><label>ใครเล่นก่อน</label><div class="seg">${[['random','สุ่ม'],['0','ผู้เล่น 1'],['1','ผู้เล่น 2']].map(([k,l])=>`<button class="${String(c.first)===k?'on':''}" data-act="first" data-v="${k}">${l}</button>`).join('')}</div></div></div>
  <div class="go"><button class="btn pri" data-act="start" ${bad?'disabled':''}>เริ่มเกม</button>${ui.err?`<span class="warnbox">${esc(ui.err)}</span>`:''}</div>`}
  ${ui.modal?modalHTML():''}`;
}
