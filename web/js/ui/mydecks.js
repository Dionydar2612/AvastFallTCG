/* UI · หน้า "เด็คของฉัน" และตัวแก้ไขเด็ค (ส่วนตัวช่วย) */
'use strict';
/* ------------------------------------------------------------------ my decks page + editor helpers */
function mydecksHTML(){
  const rows=ui.my.map(d=>{const errs=AF.validateDeck({avatar:d.avatar,counts:d.counts,edeck:d.edeck});const w=deckWarn(d);const sure=ui.confirmDel===d.id;
    return `<div class="mdk"><div class="art im-${artKey(d.avatar)}"></div><div class="info"><h3>${esc(d.name)}</h3>
      <div class="muted">Avatar: ${esc((AF.defs[d.avatar]||{name:'—'}).name)} · ${AF.deckSize({counts:d.counts})}/60 ใบ</div><div class="muted">Element Deck: ${edeckText(d)}</div>
      ${errs.length?`<div class="bad">⚠ ${errs.map(esc).join(' · ')}</div>`:'<div class="good">✓ เด็คถูกต้อง</div>'}${w?`<div class="muted">⚠ ${w} ใบยังไม่มีสคริปต์/ข้อความเปลี่ยน</div>`:''}</div>
      <div class="acts"><button class="btn sm" data-act="playas" data-id="${d.id}" data-p="0">ใช้เป็นผู้เล่น 1</button><button class="btn sm" data-act="playas" data-id="${d.id}" data-p="1">ใช้เป็นผู้เล่น 2</button>
      <button class="btn sm" data-act="mdedit" data-id="${d.id}">แก้ไข</button><button class="btn sm" data-act="mddup" data-id="${d.id}">ทำสำเนา</button><button class="btn sm" data-act="mdtext" data-id="${d.id}">คัดลอกเป็นข้อความ</button>
      <button class="btn sm ${sure?'danger':''}" data-act="mddel" data-id="${d.id}">${sure?'ยืนยันลบ':'ลบ'}</button></div></div>`}).join('');
  return `${navHTML()}
  <div class="hero"><h1>เด็คของฉัน</h1><p class="muted">สร้างเด็คจากการ์ดทั้งหมดใน card-api เด็ค 60 ใบ (รวม Avatar) ชื่อซ้ำได้ไม่เกิน 4 ใบ และ Element Deck 8 ใบ แบ่งธาตุเองได้ เด็คเก็บไว้ในเบราว์เซอร์นี้ (ส่งต่อให้เพื่อนด้วยข้อความได้)</p></div>
  <div class="go" style="margin-top:0"><button class="btn pri" data-act="newdeck" data-p="-1">＋ สร้างเด็คใหม่</button><button class="btn" data-act="mdimport">นำเข้าจากข้อความ</button></div>
  <div class="mdlist">${rows||'<p class="muted">ยังไม่มีเด็คของคุณ กด "สร้างเด็คใหม่" หรือเริ่มจากเด็คตัวอย่างโดยกด "คัดลอกไปแก้เป็นเด็คของฉัน" ในหน้า "เล่น"</p>'}</div>
  ${ui.modal?modalHTML():''}`;
}
function newEd(base,forP){
  const defs=Object.values(AF.defs);
  const av=base?base.avatar:(defs.find(d=>d.kind==='Avatar')||{}).id;
  return {id:base&&base.id||null,name:base?base.name:'เด็คใหม่',avatar:av,counts:Object.assign({},base?base.counts:{}),edeck:base&&base.edeck?Object.assign({},base.edeck):null,edeckAuto:!(base&&base.edeck),fd:'',ft:'',fe:'',fin:false,q:'',forP};
}
function edEdeck(e){return e.edeck||AF.defaultEdeck(AF.defs[e.avatar])}
function edErrors(e){return AF.validateDeck({avatar:e.avatar,counts:e.counts,edeck:edEdeck(e)})}
function deckToText(d){
  const L=['# '+d.name,'Avatar '+d.avatar];
  for(const [k,n] of Object.entries(AF.edeckOf(d)))if(n>0)L.push('Element '+k+' '+n);
  const ids=Object.keys(d.counts).filter(i=>d.counts[i]>0).sort();
  for(const id of ids)L.push(id+' x'+d.counts[id]+'  # '+((AF.defs[id]||{}).name||'?'));
  return L.join('\n');
}
function parseDeckText(txt){
  const out={name:'เด็คที่นำเข้า',avatar:null,counts:{},edeck:null,warns:[]};
  const byName={};for(const d of Object.values(AF.defs))byName[d.name.toLowerCase()]=d.id;
  const byId={};for(const d of Object.values(AF.defs))byId[d.id.toLowerCase()]=d.id;
  for(let raw of String(txt).split(/\r?\n/)){
    let line=raw.trim();if(!line)continue;
    if(line[0]==='#'){if(out.name==='เด็คที่นำเข้า'&&line.length>1)out.name=line.replace(/^#+\s*/,'').trim()||out.name;continue}
    line=line.replace(/\s+#.*$/,'').replace(/\s+\/\/.*$/,'').trim();if(!line)continue;
    let m=line.match(/^avatar\s*[:：]?\s*(.+)$/i);
    if(m){const k=m[1].trim().toLowerCase();const id=byId[k]||byName[k];if(id)out.avatar=id;else out.warns.push('ไม่พบ Avatar: '+m[1]);continue}
    m=line.match(/^element\s*[:：]?\s*(\S+)\s*[x×]?\s*(\d+)$/i);
    if(m){out.edeck=out.edeck||{};out.edeck[m[1]]=(out.edeck[m[1]]||0)+ +m[2];continue}
    m=line.match(/^(?:(\d+)\s*[x×]?\s+)?(.+?)(?:\s*[x×]\s*(\d+))?$/i);
    if(!m){out.warns.push('อ่านไม่ออก: '+line);continue}
    const n=+(m[1]||m[3]||1);const k=m[2].trim().toLowerCase();const id=byId[k]||byName[k];
    if(!id){out.warns.push('ไม่พบการ์ด: '+m[2]);continue}
    if(AF.defs[id].kind==='Avatar'){if(!out.avatar)out.avatar=id;continue}
    out.counts[id]=(out.counts[id]||0)+n;
  }
  if(!out.avatar){const f=Object.values(AF.defs).find(d=>d.kind==='Avatar');out.avatar=f&&f.id;out.warns.push('ไม่ได้ระบุ Avatar ใช้ '+(f?f.name:'—')+' แทน')}
  return out;
}
const uidGen=()=>'d'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
