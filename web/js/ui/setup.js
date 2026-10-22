/* UI · หน้าตั้งค่าเกม (เลือกโหมด เด็ค ใครเล่นก่อน) */
'use strict';
/* ------------------------------------------------------------------ setup screen */
function navHTML(){
  const st=DATA.status;const iss=DATA.issues();
  const txt=st.state==='loading'?'กำลังโหลดการ์ดจาก card-api…':st.state==='live'?`การ์ดจาก card-api · ${st.count} ใบ`:st.state==='cache'?`การ์ดที่บันทึกไว้ · ${st.count} ใบ (ต่อ card-api ไม่ได้)`:`การ์ดที่ฝังไว้ · ${st.count} ใบ (ต่อ card-api ไม่ได้)`;
  const warn=iss.unscripted.length+iss.stale.length;
  return `<div class="top"><div class="brand"><i>A</i>AvastFall Playtest<span class="ot-tag">OPEN TEST</span></div>
  <nav class="tabs site-tabs"><button class="${ui.page==='play'?'on':''}" data-act="page" data-v="play">Playtest</button><button class="${ui.page==='cards'?'on':''}" data-act="cardspage">Card List</button><button class="${ui.page==='mydecks'?'on':''}" data-act="deckbuilderpage">Deckbuilder${ui.my.length?` (${ui.my.length})`:''}</button></nav>
  <span class="spacer"></span><button class="btn sm note-bell" data-act="notes" aria-label="Update Note" title="Update Note">Update Note <span aria-hidden="true">🔔</span><i class="bell-dot"></i></button><button class="btn sm" data-act="feedback">ข้อเสนอแนะ</button></div>`;
}
function deckTile(d,i,on){
  const bad=deckErrors(d.key).length;
  return `<button class="dk ${on?'on':''}" data-act="sel" data-p="${i}" data-k="${esc(d.key)}"><div class="art im-${artKey(d.avatar)}"></div><div class="nm"><b>${esc(d.name)}</b><span class="muted">${d.preset?esc(d.series)+' · ':'เด็คของฉัน · '}${elIcons(AF.defs[d.avatar])}</span>${bad?'<span class="bad">⚠ ยังไม่ครบ</span>':''}</div></button>`;
}
function setupHTML(){
  const c=ui.cfg;
  const names=c.mode==='bot'?['คุณ (ผู้เล่น 1)','บอท (ผู้เล่น 2)']:c.mode==='hot'?['ผู้เล่น 1','ผู้เล่น 2']:c.mode==='online'?['เด็คของคุณ','']:['บอท A','บอท B'];
  const decks=allDecks();
  const pb=i=>{const k=c.sel[i];const d=deckByKey(k);const errs=deckErrors(k);const w=d?deckWarn(d):0;
    const changing=ui.changeDeckFor===i;
    const tiles=changing?decks.map(x=>deckTile(x,i,x.key===k)).join(''):`${d?deckTile(d,i,true):'<p class="muted">ยังไม่ได้เลือกเด็ค</p>'}<button class="btn sm" data-act="changedeck" data-p="${i}">เปลี่ยนเด็ค ▾</button>`;
    return `<section class="pbox"><h2>${esc(names[i])}</h2><div class="decks">${tiles}</div>
    <div class="opt"><span class="muted">${d?`${AF.deckSize({counts:d.counts})}/60 ใบ · Element Deck: ${edeckText(d)}`:''}</span></div>
    ${errs.length?`<div class="warnbox">${errs.map(esc).join('<br>')}</div>`:'<span class="muted">เด็คถูกต้อง</span>'}
    ${w?`<div class="note"><b>⚠ ${w} ใบในเด็คนี้</b> ยังไม่มีสคริปต์เอฟเฟกต์ หรือข้อความต่างจากที่สคริปต์เขียนไว้ ผลอาจไม่ครบ ดูรายละเอียดที่ชิป "ข้อมูลการ์ด" ด้านบน</div>`:''}</section>`};
  const bad=[0,1].some(i=>deckErrors(c.sel[i]).length);
  return `${navHTML()}
  <div class="hero"><span class="ot-badge"><i></i>OPEN TEST · เปิดให้ทดลองเล่น</span><h1>ร่วมทดลองเล่น AvastFall TCG <span class="ot-rev">กติกา Revised</span></h1><p class="muted">ขอเชิญทุกคนมาลองเล่นเวอร์ชันทดสอบ เล่นกับบอท ชวนเพื่อนเล่นสองคนในเครื่องเดียว หรือดูบอทเล่นกันเองก็ได้ ไม่ต้องสมัครหรือติดตั้งอะไร และสร้างและจัดการเด็คได้ที่แท็บ "Deckbuilder"<br>เวอร์ชันนี้ยังอยู่ในช่วงทดสอบ การ์ดและกติกาอาจมีการปรับเปลี่ยน เจอบั๊กหรืออยากแนะนำอะไร บอกเราได้เลย</p><div class="ot-cta"><button class="btn pri" data-act="feedback">ส่งข้อเสนอแนะ / แจ้งบั๊ก</button></div></div>
  <div class="opts"><div class="opt"><label>โหมด</label><div class="seg">${[['bot','เล่นกับบอท'],['hot','สองคนในเครื่องเดียว'],['spec','ดูบอทเล่นกันเอง'],['online','เล่นออนไลน์กับเพื่อน']].map(([k,l])=>`<button class="${c.mode===k?'on':''}" data-act="mode" data-v="${k}">${l}</button>`).join('')}</div></div></div>
  ${c.mode==='online'?onlineHTML(pb):`<div class="setup" style="margin-top:16px">${pb(0)}${pb(1)}</div>
  <div class="opts"><div class="opt"><label>ใครเล่นก่อน</label><div class="seg">${[['random','สุ่ม'],['0','ผู้เล่น 1'],['1','ผู้เล่น 2']].map(([k,l])=>`<button class="${String(c.first)===k?'on':''}" data-act="first" data-v="${k}">${l}</button>`).join('')}</div></div></div>
  <div class="go"><button class="btn pri" data-act="start" ${bad?'disabled':''}>เริ่มเกม</button>${ui.err?`<span class="warnbox">${esc(ui.err)}</span>`:''}</div>`}
  ${ui.modal?modalHTML():''}`;
}
