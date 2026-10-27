/* UI · เล่นออนไลน์กับเพื่อน (ห้องส่วนตัวด้วยรหัสห้อง)
   วิธีทำงาน (lockstep): ทั้งสองเบราว์เซอร์รัน engine ตัวเดียวกันด้วย seed เดียวกัน
   ฝั่งตัวเองใช้ io แบบคนกดหน้าจอแล้วส่ง "ตัวเลือกที่กด" ไปให้ server ส่งต่อ ส่วนฝั่งเพื่อนใช้ io ที่รอรับตัวเลือกนั้น
   server ไม่รู้กติกา (ดู /api/room/* ใน server.js) · ผู้เล่น 0 = คนสร้างห้อง, 1 = คนเข้าห้อง
   หมายเหตุ: เบราว์เซอร์ของแต่ละคนมีสถานะเกมเต็ม (เปิด DevTools แอบดูมือเพื่อนได้) เหมาะกับเล่นกับเพื่อน/Open Test เท่านั้น */
'use strict';
const OL={es:null,q:[],w:null,chain:Promise.resolve(),n:0,tok:0};
ui.ol=null;ui.olcode='';

const olName=()=>String(ui.pname||'').trim().slice(0,16);
try{ui.pname=localStorage.getItem('af-pname')||''}catch(e){ui.pname=''}
const nameInput=()=>`<div class="opt"><label for="olname">ชื่อที่แสดงตอนเล่น</label><input id="olname" value="${esc(ui.pname||'')}" maxlength="16" placeholder="ชื่อของคุณ (ไม่ใส่ก็ได้)" autocomplete="off" style="padding:6px 10px;border:2px solid var(--ink);border-radius:8px;font-size:15px;min-width:180px"></div>`;
function olHash(){try{const s=JSON.stringify(Object.keys(AF.defs).sort().map(k=>[k,AF.defs[k]]));let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return String(h>>>0)}catch(e){return ''}}
async function olApi(path,body){
  let r,j;
  try{r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});j=await r.json().catch(()=>({}))}
  catch(e){throw new Error('ต่อเซิร์ฟเวอร์ไม่ได้')}
  if(!r.ok||j.ok===false)throw new Error(j.error||'เกิดข้อผิดพลาด ('+r.status+')');
  return j;
}
/* ส่งข้อความเข้าห้อง: ส่งทีละอัน ตามลำดับ และลองใหม่เมื่อเน็ตสะดุด (server ตัดข้อความซ้ำด้วยเลขลำดับ n) */
function olSend(msg){
  const o=ui.ol;if(!o)return Promise.resolve();
  if(msg.t==='move')msg.n=++OL.n;
  const job=async()=>{
    for(let i=0;i<40;i++){
      if(ui.ol!==o&&msg.t!=='leave')return;   // ข้อความ leave ต้องส่งให้ได้แม้ปิดห้องฝั่งตัวเองแล้ว
      try{return await olApi('/api/room/send',{code:o.code,pid:o.pid,token:o.token,msg})}
      catch(e){if(/ไม่พบห้อง|ไม่ถูกต้อง|ยังไม่/.test(e.message))throw e;await new Promise(r=>setTimeout(r,1500))}
    }
  };
  const p=OL.chain.then(job);OL.chain=p.catch(()=>{});return p;
}
function olConnect(){
  const o=ui.ol;if(OL.es)OL.es.close();
  const es=new EventSource(`/api/room/events?code=${encodeURIComponent(o.code)}&pid=${o.pid}&token=${o.token}`);
  OL.es=es;
  es.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(e){return}olOn(m)};
  es.onerror=()=>{if(ui.ol===o){o.conn=false;scheduleRender()}};
  es.onopen=()=>{if(ui.ol===o){o.conn=true;scheduleRender()}};
}
function olOn(m){
  const o=ui.ol;if(!o)return;
  if(m.t==='peer'){o.peer=!!m.online;if(m.online)o.hadPeer=true}
  else if(m.t==='peerready')o.peerReady=true;
  else if(m.t==='start')olStart(m);
  else if(m.t==='move'){if(OL.w&&OL.w.tok===OL.tok){const w=OL.w;OL.w=null;w.res(m)}else OL.q.push(m)}
  else if(m.t==='leave'){
    if(ui.screen==='game'&&ui.over)return;   // จบเกมแล้ว ปล่อยให้ดูกระดานต่อ
    if(ui.screen==='game'){   // เพื่อนยอมแพ้/ออก → กลับหน้าแรกทันที
      const nm=ui.G&&ui.G.players[1-o.pid]?ui.G.players[1-o.pid].name:'เพื่อน';
      ui.token++;ui.screen='setup';ui.page='play';DATA.applyPending();fixSelections();ui.pending=null;ui.over=null;ui.modal=null;ui.menu=null;ui.settings=false;
      olLeave(false);ui.err=nm+' ยอมแพ้/ออกจากเกม จึงกลับมาหน้าแรก';
      return render();
    }
    o.peer=false;o.ready=false;o.peerReady=false;
  }
  scheduleRender();
}
function olLeave(notify){
  const o=ui.ol;if(!o)return;
  if(notify)olSend({t:'leave'}).catch(()=>{});
  const es=OL.es;ui.ol=null;OL.es=null;OL.q=[];OL.w=null;
  setTimeout(()=>{if(es)es.close()},notify?800:0);
}
async function olCreate(){
  ui.err='';ui.olbusy=true;render();
  try{const j=await olApi('/api/room/create');ui.ol={code:j.code,pid:j.pid,token:j.token,peer:false,ready:false,peerReady:false,conn:false};olConnect()}
  catch(e){ui.err=e.message}
  ui.olbusy=false;render();
}
async function olJoin(code){
  code=String(code||ui.olcode||'').trim().toUpperCase();ui.err='';
  if(code.length<4){ui.err='กรอกรหัสห้องก่อน';return render()}
  ui.olbusy=true;render();
  try{const j=await olApi('/api/room/join',{code});ui.ol={code:j.code,pid:j.pid,token:j.token,peer:true,ready:false,peerReady:false,conn:false};olConnect()}
  catch(e){ui.err=e.message}
  ui.olbusy=false;render();
}
async function olReady(){
  const o=ui.ol;if(!o||o.ready)return;
  if(deckErrors(ui.cfg.sel[0]).length){ui.err='เด็คยังไม่ครบ 60 ใบ';return render()}
  ui.err='';o.ready=true;render();
  try{await olSend({t:'ready',deck:deckOf(0),hash:olHash(),name:olName()})}
  catch(e){o.ready=false;ui.err=e.message;render()}
}
/* ------------------------------------------------------------------ แปลงตัวเลือกเป็นข้อความที่ส่งข้ามเครื่อง */
function olEnc(kind,v,spec){
  if(kind==='act'){if(v&&v.t==='pass')return {pass:1};const i=spec.actions.indexOf(v);return {i}}
  return v===undefined?null:v;
}
function olDec(kind,v,spec){
  if(kind==='act'){if(v&&v.pass)return {t:'pass'};const a=spec.actions[v&&v.i];if(!a)throw new Error('desync');return a}
  return v;
}
function olStart(m){
  const o=ui.ol;if(!o||ui.screen==='game')return;
  if(m.hashes[0]!==m.hashes[1]){ui.err='ข้อมูลการ์ดของสองเครื่องไม่ตรงกัน (card-api อัปเดตไม่พร้อมกัน) ให้ทั้งคู่รีเฟรชหน้าแล้วสร้าง/เข้าห้องใหม่';olLeave(true);return}
  const me=o.pid;ui.token++;const token=ui.token;
  OL.q=[];OL.w=null;OL.tok=token;
  const local=p=>{
    const f=kind=>async(G,pp,spec)=>{const v=await req(token,p,kind,spec);if(ui.token===token)olSend({t:'move',k:kind,v:olEnc(kind,v,spec)}).catch(()=>{});return v};
    return {act:f('act'),attack:f('attack'),pick:f('pick'),order:f('order'),respond:f('respond'),mulligan:f('mulligan')};
  };
  const remote=()=>{
    const f=kind=>async(G,pp,spec)=>{
      const mv=OL.q.length?OL.q.shift():await new Promise(res=>{OL.w={tok:token,res}});
      if(mv.k!==kind)throw new Error('desync: คาดว่า '+kind+' แต่ได้ '+mv.k);
      return olDec(kind,mv.v,spec);
    };
    return {act:f('act'),attack:f('attack'),pick:f('pick'),order:f('order'),respond:f('respond'),mulligan:f('mulligan')};
  };
  const io=[0,1].map(p=>p===me?local(p):remote());
  const names=[0,1].map(p=>(m.names&&m.names[p])||'ผู้เล่น '+(p+1));
  const G=AF.createGame({decks:m.decks,io,names,first:m.first,seed:m.seed,refresh:scheduleRender});
  Object.assign(ui,{G,screen:'game',pending:null,viewer:me,inspect:null,sel:null,menu:null,modal:null,cover:null,seen:0,over:null,tab:'card',peek:false,toast:'',err:''});
  render();
  AF.runGame(G,120).then(r=>{if(ui.token===token){ui.over=r;ui.pending=null;render()}}).catch(e=>{console.error(e);if(ui.token===token){const ds=/desync/.test(e.message);ui.err=ds?'สถานะเกมของสองเครื่องไม่ตรงกัน (desync) ต้องจบเกมนี้':'เกิดข้อผิดพลาดในระบบ: '+e.message;ui.over={winner:null,reason:ui.err};render()}});
}
/* ------------------------------------------------------------------ หน้า lobby (แสดงแทนกล่องเลือกเด็คสองฝั่งเมื่อเลือกโหมดออนไลน์) */
function onlineHTML(pb){
  const o=ui.ol;
  const err=ui.err?`<span class="warnbox">${esc(ui.err)}</span>`:'';
  if(!o){
    return `<div class="setup" style="margin-top:16px">${pb(0)}<section class="pbox"><h2>ห้องส่วนตัว</h2>
      <p class="muted">เล่นกับเพื่อนผ่านอินเทอร์เน็ต เลือกเด็คของคุณทางซ้ายก่อน แล้วสร้างห้องส่งรหัสให้เพื่อน หรือกรอกรหัสที่เพื่อนให้มา</p>
      ${nameInput()}
      <div class="opt"><button class="btn pri" data-act="olcreate" ${ui.olbusy?'disabled':''}>สร้างห้อง</button></div>
      <div class="opt"><input id="olcode" value="${esc(ui.olcode||'')}" maxlength="5" placeholder="รหัสห้อง 5 ตัว" autocomplete="off" style="text-transform:uppercase;width:150px;padding:6px 10px;border:2px solid var(--ink);border-radius:8px;font:600 16px monospace;letter-spacing:2px"><button class="btn" data-act="oljoin" ${ui.olbusy?'disabled':''}>เข้าห้อง</button></div>
      ${err}</section></div>`;
  }
  const link=location.origin+location.pathname+'?room='+o.code;
  const st=o.pid===0&&!o.hadPeer?'รอเพื่อนเข้าห้อง… ส่งรหัสหรือลิงก์ด้านล่างให้เพื่อน':!o.peer?'เพื่อนหลุดจากห้อง (รอกลับเข้ามา)':o.ready?(o.peerReady?'กำลังเริ่มเกม…':'คุณพร้อมแล้ว รอเพื่อนกดพร้อม…'):(o.peerReady?'เพื่อนพร้อมแล้ว เลือกเด็คแล้วกด "พร้อม"':'เพื่อนอยู่ในห้องแล้ว เลือกเด็คแล้วกด "พร้อม"');
  const bad=deckErrors(ui.cfg.sel[0]).length;
  return `<div class="setup" style="margin-top:16px">${pb(0)}<section class="pbox"><h2>ห้อง <span style="font:700 26px monospace;letter-spacing:4px">${esc(o.code)}</span></h2>
    <p>${esc(st)}</p>
    <p class="muted">${o.conn===false?'⚠ กำลังเชื่อมต่อเซิร์ฟเวอร์ใหม่… · ':''}คุณคือ ${o.pid===0?'เจ้าของห้อง':'ผู้เข้าร่วม'} · ใครเล่นก่อนสุ่มให้ · ชื่อที่ว่างจะแสดงเป็น ผู้เล่น 1/2</p>
    ${o.ready?'':nameInput()}
    <div class="opt"><input id="ollink" readonly value="${esc(link)}" style="flex:1;min-width:200px;padding:6px 10px;border:2px solid var(--ink);border-radius:8px;font-size:13px" onclick="this.select()"><button class="btn sm" data-act="olcopy">คัดลอกลิงก์</button></div>
    <div class="opt"><button class="btn pri" data-act="olready" ${(!o.peer||o.ready||bad)?'disabled':''}>พร้อม</button><button class="btn" data-act="olleave">ออกจากห้อง</button></div>
    ${err}</section></div>`;
}
root.addEventListener('input',e=>{if(e.target.id==='olcode')ui.olcode=e.target.value.toUpperCase();if(e.target.id==='olname'){ui.pname=e.target.value;try{localStorage.setItem('af-pname',ui.pname)}catch(err){}}});
function olCopy(el){
  const t=(document.getElementById('ollink')||{}).value||'';let ok=false;
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).catch(()=>{});ok=true}}catch(e){}
  if(!ok){const i=document.getElementById('ollink');if(i){i.select();try{ok=document.execCommand('copy')}catch(e){}}}
  if(el){el.textContent=ok?'คัดลอกแล้ว':'กดคัดลอกเอง';}
}
