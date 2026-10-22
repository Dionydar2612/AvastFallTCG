/* UI · การคลิก/เมาส์/คีย์บอร์ด และ handle() ของทุกปุ่ม (data-act) */
'use strict';
/* ------------------------------------------------------------------ interactions */
function openMenu(actions,el){const r=el.getBoundingClientRect();ui.menu={actions,x:r.left,y:r.bottom+4};render()}
function onCard(uid,el){
  const G=ui.G;const m=cardMap();const c=m[uid];if(!c)return;
  const _pdv=pdOf();if(!(_pdv&&_pdv.p===ui.viewer&&(_pdv.kind==='attack'||(_pdv.kind==='pick'&&(_pdv.spec.kind==='units'||_pdv.spec.kind==='attackTarget')))&&!ui.menu))showPop(c,el,true);
  const pd=pdOf();
  if(ui.cover!==null)return;
  if(pd&&pd.p===ui.viewer){
    if(pd.kind==='pick'&&(pd.spec.kind==='units'||pd.spec.kind==='attackTarget')){
      if(pd.spec.options.some(o=>o.id===uid))return answer([uid]);
      if(pd.spec.kind==='attackTarget'&&c.def.kind==='Avatar'&&c.owner!==pd.p&&pd.spec.options.some(o=>o.id==='avatar'))return answer(['avatar']);
    }
    if(pd.kind==='attack'){
      const o=pd.spec.options;
      if(ui.sel!=null){
        const cur=o.find(x=>x.attacker.uid===ui.sel);
        if(cur&&cur.units.some(u=>u.uid===uid))return answer({attacker:ui.sel,target:uid});
        if(cur&&cur.avatar&&c.def.kind==='Avatar'&&c.owner!==pd.p)return answer({attacker:ui.sel,target:'avatar'});
      }
      if(o.some(x=>x.attacker.uid===uid)){ui.sel=ui.sel===uid?null:uid;ui.inspect=c;return render()}
    }
    if(pd.kind==='act'){
      const acts=pd.spec.actions.filter(a=>a.uid===uid||(a.card&&a.card.host&&a.card.host.uid===uid));
      if(acts.length){ui.inspect=c;return openMenu(acts,el)}
      if(c.zone==='hand'&&c.owner===pd.p){const w=AF.whyNot(G,c.owner,c);ui.inspect=c;ui.tab='card';ui.menu={actions:[],x:el.getBoundingClientRect().left,y:el.getBoundingClientRect().bottom,why:w};return render()}
    }
  }
  ui.inspect=c;ui.menu=null;if(innerWidth<1050&&ui.tab!=='card')ui.tab='card';render();
}
const pop=document.createElement('div');pop.id='cardpop';pop.hidden=true;document.body.appendChild(pop);
let popPin=false;
function hidePop(){pop.hidden=true;popPin=false}
function pdefCard(id){const d=AF.defs[id];return d?{uid:0,def:d,zone:'pool',owner:-1}:null}
function showPop(c,el,pin,force){
  try{
    if(!c||!el){return hidePop()}
    if(!force){
    if(!ui.G||ui.screen!=='game'||ui.cover!==null){return hidePop()}
    if(c.zone==='hand'&&c.owner!==ui.viewer&&!ui.peek&&ui.cfg.mode!=='spec')return hidePop();
    if(c.zone==='deck')return hidePop();}
    pop.innerHTML=inspectorHTML(c);popPin=!!pin;pop.hidden=false;
    const r=el.getBoundingClientRect(),W=250,vw=innerWidth,vh=innerHeight;
    const sheet=vw<700;pop.classList.toggle('sheet',sheet);
    if(sheet)return;
    const menuW=pin&&ui.menu!==false?300:0;
    let x=r.right+8+(pin?menuW-r.width:0);
    if(x+W>vw-8)x=r.left-W-8;
    if(x<8)x=Math.max(8,vw-W-8);
    const h=pop.offsetHeight;let y=Math.min(Math.max(8,r.top-20),vh-h-8);
    pop.style.left=x+'px';pop.style.top=Math.max(8,y)+'px';
  }catch(e){hidePop()}
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')hidePop()});
function setInspect(c){
  const pb=document.querySelector('.pbody');if(!c||(ui.inspect&&ui.inspect.uid===c.uid))return;
  ui.inspect=c;if(ui.tab==='card'&&pb)pb.innerHTML=inspectorHTML(c);
}
const canHover=matchMedia('(hover:hover)').matches;
root.addEventListener('mouseover',e=>{if(!ui.G||ui.screen!=='game'){const pd0=e.target.closest('[data-pdef]');if(pd0&&canHover)showPop(pdefCard(pd0.dataset.pdef),pd0,false,true);return}const pd0=e.target.closest('[data-pdef]');if(pd0){if(canHover)showPop(pdefCard(pd0.dataset.pdef),pd0,false,true);return}const pp=e.target.closest('[data-pop]');if(pp){const c=cardMap()[+pp.dataset.pop];if(c&&canHover)showPop(c,pp,false);return}const el=e.target.closest('[data-uid]');if(el){const c=cardMap()[+el.dataset.uid];if(c){setInspect(c);if(canHover)showPop(c,el,false)}}});
root.addEventListener('mouseout',e=>{if(popPin)return;const el=e.target.closest('[data-uid],[data-pop],[data-pdef]');if(el&&!(e.relatedTarget&&el.contains(e.relatedTarget)))hidePop()});
root.addEventListener('change',e=>{const t=e.target.closest('[data-chg]');if(!t)return;const v=t.type==='checkbox'?t.checked:t.value;
  if(t.dataset.chg==='edf'){ui.ed[t.dataset.k]=v;return render()}
  if(t.dataset.chg==='edfrom'){const b=v?deckByKey(v):null;if(b){ui.ed.avatar=b.avatar;ui.ed.counts=Object.assign({},b.counts);if(b.edeck){ui.ed.edeck=Object.assign({},b.edeck);ui.ed.edeckAuto=false}else{ui.ed.edeck=null;ui.ed.edeckAuto=true}}return render()}});
root.addEventListener('input',e=>{if(e.target.dataset&&e.target.dataset.fb){ui.fb[e.target.dataset.fb]=e.target.value;return}if(e.target.id==='edname'&&ui.ed){ui.ed.name=e.target.value;return}if(e.target.id==='edq'&&ui.ed){const q=e.target.value.trim().toLowerCase();ui.ed.q=e.target.value;document.querySelectorAll('.pgrid .pt').forEach(b=>b.hidden=!!q&&!b.dataset.q.includes(q));return}if(e.target.id==='nsearch'){const q=e.target.value.trim();document.querySelectorAll('#nlist [data-n]').forEach(b=>b.hidden=q&&!b.dataset.n.includes(q))}});
root.addEventListener('click',e=>{
  hidePop();
  const a=e.target.closest('[data-act]');
  if(a)return handle(a.dataset.act,a.dataset,a,e);
  const pdf=e.target.closest('[data-pdef]');if(pdf&&!e.target.closest('[data-act]')){showPop(pdefCard(pdf.dataset.pdef),pdf,false,true);popPin=true;return}
  const pp=e.target.closest('[data-pop]');if(pp){const c=cardMap()[+pp.dataset.pop];if(c)showPop(c,pp,false);popPin=true;return}
  const z=e.target.closest('[data-zone]');
  const u=e.target.closest('[data-uid]');
  if(u&&ui.screen==='game'&&!(z&&z.dataset.zone==='avatar'&&u===z))return onCard(+u.dataset.uid,u);
  if(z&&ui.screen==='game'){
    const p=+z.dataset.p;
    if(z.dataset.zone==='avatar'){const pd=pdOf();if(pd&&pd.kind==='attack'&&ui.sel!=null)return answer({attacker:ui.sel,target:'avatar'});if(pd&&pd.kind==='pick'&&pd.spec.kind==='attackTarget')return answer(['avatar'])}
    if(z.dataset.zone==='discard'){ui.modal={t:'discard',p};ui.menu=null;return render()}
    if(z.dataset.zone==='deck'){ui.modal={t:'pile',p};return render()}
  }
  if(ui.menu){ui.menu=null;render()}
});
function handle(act,d,el,e){
  const G=ui.G;const pd=pdOf();
  switch(act){
    case 'sel':ui.cfg.sel[+d.p]=d.k;saveCfg();return render();
    case 'page':ui.page=d.v;ui.modal=null;ui.confirmDel=null;return render();
    case 'data':ui.modal={t:'data'};return render();
    case 'apiapply':{const v=(document.getElementById('apiurl')||{}).value||'';if(/^https?:\/\//.test(v.trim()))ui.cfg.api=v.trim();DATA.setApi(ui.cfg.api);saveCfg();ui.modal=null;DATA.load();return render()}
    case 'newdeck':{const p=+d.p;ui.ed=newEd(null,p>=0?p:null);const base=p>=0?deckByKey(ui.cfg.sel[p]):null;if(base){ui.ed.avatar=base.avatar;ui.ed.counts=Object.assign({},base.counts);ui.ed.name='เด็คของฉัน – '+base.name}ui.modal={t:'ded'};return render()}
    case 'editsel':{const p=+d.p;const base=deckByKey(ui.cfg.sel[p]);if(!base)return;
      if(base.preset){ui.ed=newEd({name:'เด็คของฉัน – '+base.name,avatar:base.avatar,counts:base.counts,edeck:null},p)}
      else{const my=ui.my.find(x=>x.id===base.id);ui.ed=newEd(my,p)}
      ui.modal={t:'ded'};return render()}
    case 'mdedit':{const my=ui.my.find(x=>x.id===d.id);if(!my)return;ui.ed=newEd(my,null);ui.modal={t:'ded'};return render()}
    case 'mddup':{const my=ui.my.find(x=>x.id===d.id);if(!my)return;ui.my.push({...JSON.parse(JSON.stringify(my)),id:uidGen(),name:my.name+' (สำเนา)',updated:Date.now()});saveMy();return render()}
    case 'mddel':{if(ui.confirmDel!==d.id){ui.confirmDel=d.id;return render()}ui.my=ui.my.filter(x=>x.id!==d.id);ui.confirmDel=null;saveMy();fixSelections();saveCfg();return render()}
    case 'mdtext':{const my=ui.my.find(x=>x.id===d.id);if(!my)return;ui.modal={t:'dtext',name:my.name,text:deckToText(my)};return render()}
    case 'mdimport':ui.modal={t:'dimport',text:'',warns:[]};return render();
    case 'doimport':{const txt=(document.getElementById('imptxt')||{}).value||'';const r=parseDeckText(txt);
      if(!Object.keys(r.counts).length){ui.modal={t:'dimport',text:txt,warns:['ไม่พบการ์ดในข้อความ',...r.warns]};return render()}
      ui.my.push({id:uidGen(),name:r.name,avatar:r.avatar,counts:r.counts,edeck:r.edeck,updated:Date.now()});saveMy();
      ui.modal=r.warns.length?{t:'dimport',text:txt,warns:['นำเข้าแล้ว แต่มีบางบรรทัดถูกข้าม:',...r.warns]}:null;return render()}
    case 'copytxt':{const ta=document.getElementById('dtxt');if(!ta)return;ta.focus();ta.select();let ok=false;try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(ta.value).catch(()=>{});ok=true}}catch(e){}try{ok=document.execCommand('copy')||ok}catch(e){}el.textContent=ok?'คัดลอกแล้ว ✓':'เลือกข้อความไว้แล้ว กด Ctrl+C';return}
    case 'playas':{ui.cfg.sel[+d.p]='my:'+d.id;saveCfg();ui.page='play';return render()}
    case 'edc':{const e=ui.ed;if(!e)return;const df=AF.defs[d.id];if(!df)return;let n=(e.counts[d.id]||0)+ +d.d;if(+d.d>0){const av=AF.defs[e.avatar];if(av&&!AF.allowedInDeck(av,df))return;const tot=Object.entries(e.counts).reduce((a,[i,c])=>a+(AF.defs[i]&&AF.defs[i].name===df.name?c:0),0);if(tot>=4)return}n=Math.max(0,Math.min(4,n));if(n)e.counts[d.id]=n;else delete e.counts[d.id];return render()}
    case 'edav':{const e=ui.ed;e.avatar=d.id;if(e.edeckAuto)e.edeck=null;return render()}
    case 'ede':{const e=ui.ed;const cur=Object.assign({},edEdeck(e));const v=Math.max(0,(cur[d.k]||0)+ +d.d);if(v)cur[d.k]=v;else delete cur[d.k];e.edeck=cur;e.edeckAuto=false;return render()}
    case 'edeauto':{const e=ui.ed;e.edeck=null;e.edeckAuto=true;return render()}
    case 'edcancel':ui.ed=null;ui.modal=null;return render();
    case 'edsave':{const e=ui.ed;if(!e)return;const rec={id:e.id||uidGen(),name:(e.name||'').trim()||'เด็คใหม่',avatar:e.avatar,counts:JSON.parse(JSON.stringify(e.counts)),edeck:e.edeck?Object.assign({},e.edeck):null,updated:Date.now()};
      const i=ui.my.findIndex(x=>x.id===rec.id);if(i>=0)ui.my[i]=rec;else ui.my.push(rec);saveMy();
      if(e.forP!=null&&e.forP>=0){ui.cfg.sel[e.forP]='my:'+rec.id;saveCfg()}
      ui.ed=null;ui.modal=null;return render()}
    case 'mode':if(d.v!=='online')olLeave(true);ui.err='';ui.cfg.mode=d.v;return render();
    case 'olcreate':return olCreate();
    case 'oljoin':return olJoin();
    case 'olready':return olReady();
    case 'olleave':olLeave(true);ui.err='';return render();
    case 'olcopy':return olCopy(el);
    case 'first':ui.cfg.first=d.v;return render();
    case 'start':return startGame();
    case 'help':ui.modal={t:'help'};return render();
    case 'notes':ui.modal={t:'notes'};return render();
    case 'feedback':ui.fb.msg='';ui.fb.ok=false;ui.modal={t:'feedback'};return render();
    case 'fbagain':ui.fb=Object.assign(ui.fb,{text:'',msg:'',ok:false});return render();
    case 'fbsend':return sendFeedback();
    case 'closemodal':ui.modal=null;return render();
    case 'closemenu':ui.menu=null;return render();
    case 'closeover':ui.over=ui.over;ui.hideOver=true;ui.overShown=false;ui.over=null;return render();
    case 'restart':return startGame();
    case 'tosetup':olLeave(true);ui.token++;ui.screen='setup';ui.page='play';DATA.applyPending();fixSelections();ui.pending=null;ui.over=null;ui.modal=null;return render();
    case 'tab':ui.tab=d.v;return render();
    case 'settings':ui.settings=true;return render();
    case 'closesettings':ui.settings=false;return render();
    case 'setscale':applyScale(+d.v);return render();
    case 'surrender':{
      if(!confirm('ยอมแพ้และกลับไปหน้าแรก?'))return;
      olLeave(true);ui.token++;ui.screen='setup';ui.page='play';DATA.applyPending();fixSelections();ui.pending=null;ui.over=null;ui.modal=null;ui.menu=null;ui.settings=false;
      return render();
    }
    case 'dllog':{
      const G=ui.G;
      const head=`AvastFall Playtest – Battle Log\nผู้เล่น: ${G.players.map(P=>P.name).join(' vs ')}\nเทิร์นล่าสุด: ${G.turn}\nบันทึกเมื่อ: ${new Date().toLocaleString('th-TH')}\n${'='.repeat(40)}\n`;
      const body=G.log.map(l=>l.extra&&l.extra.divider?`\n----- ${l.text} -----`:`[T${l.turn}] ${l.text}`).join('\n');
      const blob=new Blob([head+body+'\n'],{type:'text/plain;charset=utf-8'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='avastfall-battlelog-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.txt';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      return;
    }
    case 'ready':ui.viewer=ui.cover;ui.cover=null;return render();
    case 'speed':{const s=ui.cfg.speed;ui.cfg.speed=s>=800?0:s===0?250:s<300?550:1000;saveCfg();return render()}
    case 'pass':return answer({t:'pass'});
    case 'doact':{const a=ui.menu.actions[+d.i];return answer(a)}
    case 'doactu':{const a=pd.spec.actions.find(x=>x.uid===+d.id&&x.zone==='discard');return answer(a)}
    case 'endatk':return answer(null);
    case 'unsel':ui.sel=null;return render();
    case 'skip':return answer([]);
    case 'mull':return answer(d.v==='1');
    case 'respond':return answer(d.id===''?null:+d.id);
    case 'choice':{const o=pd.spec.options.find(x=>String(x.id)===d.id);return answer([o?o.id:d.id])}
    case 'pickc':{const id=+d.id;const s=pd.spec;const max=s.max||1;const i=pd.order.indexOf(id);if(i>=0)pd.order.splice(i,1);else{if(max===1)pd.order=[id];else if(pd.order.length<max)pd.order.push(id)}return render()}
    case 'pickok':return answer(pd.order.slice());
    case 'pickskip':return answer([]);
    case 'ord':{const id=+d.id;const i=pd.order.indexOf(id);if(i>=0)pd.order.splice(i,1);else pd.order.push(id);return render()}
    case 'ordreset':pd.order=[];return render();
    case 'ordkeep':return answer(pd.spec.cards.map(c=>c.uid));
    case 'ordok':return answer(pd.order.slice());
  }
}
// answer the pick for names: engine expects option ids (names)
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(ui.settings){ui.settings=false;render();return}if(ui.modal&&ui.modal.t!=='ded'){ui.modal=null;render()}}});
// สไลเดอร์ขนาดหน้าจอ: ปรับสดโดยไม่ render ใหม่ (กันสไลเดอร์สะดุดขณะลาก)
root.addEventListener('input',e=>{if(e.target.id!=='scalerange')return;applyScale(+e.target.value);const l=document.getElementById('scaleval');if(l)l.textContent=ui.scale+'%'});

/* ส่งข้อเสนอแนะ (ตัวส่งจริงอยู่ที่ js/data/feedback-api.js) */
async function sendFeedback(){
  const f=ui.fb;if(f.busy)return;
  if(f.text.trim().length<3){f.msg='กรุณาพิมพ์ข้อความอย่างน้อย 3 ตัวอักษร';return render()}
  f.busy=true;f.msg='';render();
  const website=(document.querySelector('[data-fb=website]')||{}).value||'';
  try{
    await AF.feedback.send({category:f.cat,text:f.text,name:f.name,contact:f.contact,website,
      context:{หน้า:ui.screen==='game'?'ในเกม':ui.page==='mydecks'?'เด็คของฉัน':'ตั้งค่า',จอ:innerWidth+'x'+innerHeight,ภาษา:navigator.language||''}});
    f.ok=true;f.text='';
  }catch(e){f.msg=e.message}
  f.busy=false;render();
}
