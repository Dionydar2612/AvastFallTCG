/* UI · เริ่มเกม กระดาน มือ แผงข้างจอ */
'use strict';
/* ------------------------------------------------------------------ game start */
function startGame(){
  const c=ui.cfg;ui.err='';
  if([0,1].some(i=>deckErrors(ui.cfg.sel[i]).length)){ui.err='เด็คยังไม่ครบ 60 ใบ';render();return}
  saveCfg();ui.token++;const token=ui.token;
  const delay=()=>ui.cfg.speed;
  const humanIdx=c.mode==='bot'?0:null;
  const mkHuman=p=>({
    act:(G,pp,spec)=>req(token,p,'act',spec),attack:(G,pp,spec)=>req(token,p,'attack',spec),pick:(G,pp,spec)=>req(token,p,'pick',spec),
    order:(G,pp,spec)=>req(token,p,'order',spec),respond:(G,pp,spec)=>req(token,p,'respond',spec),mulligan:(G,pp,spec)=>req(token,p,'mulligan',spec)});
  const io=[0,1].map(p=>c.mode==='hot'||(c.mode==='bot'&&p===humanIdx)?mkHuman(p):AF.makeBot({delay}));
  const names=c.mode==='bot'?['คุณ','บอท']:c.mode==='hot'?['ผู้เล่น 1','ผู้เล่น 2']:['บอท A','บอท B'];
  const G=AF.createGame({decks:[deckOf(0),deckOf(1)],io,names,first:c.first==='random'?undefined:+c.first,parallelMull:c.mode!=='hot',refresh:scheduleRender});
  Object.assign(ui,{G,intro:{first:G.first},screen:'game',pending:null,viewer:humanIdx??0,inspect:null,sel:null,menu:null,modal:null,cover:null,seen:0,over:null,tab:'card',peek:false,toast:'',gmenu:false,showPanel:false});
  render();
  AF.runGame(G,120).then(r=>{if(ui.token===token){ui.over=r;ui.pending=null;render()}}).catch(e=>{console.error(e);if(ui.token===token){ui.err='เกิดข้อผิดพลาดในระบบ: '+e.message;ui.over={winner:null,reason:ui.err};render()}});
}
function req(token,p,kind,spec){
  return new Promise(res=>{
    if(token!==ui.token)return;
    ui.pending={kind,spec,p,res,order:[]};ui.sel=null;ui.menu=null;ui.modal=null;
    if(ui.cfg.mode==='hot'&&ui.viewer!==p)ui.cover=p;
    if(kind==='act'||kind==='attack')ui.tab='card';
    render();
  });
}
function answer(v){const pd=ui.pending;if(!pd)return;ui.pending=null;ui.sel=null;ui.menu=null;ui.modal=null;pd.res(v);render()}

/* ------------------------------------------------------------------ board helpers */
function cardMap(){
  const m={};const G=ui.G;
  for(const P of G.players){
    m[P.avatar.card.uid]=P.avatar.card;
    for(const z of [P.deck,P.hand,P.discard,P.domains,P.limbo])for(const c of z)m[c.uid]=c;
    for(const u of P.field)if(u){m[u.uid]=u;for(const e of u.equips)m[e.uid]=e}
    for(const c of P.magic)if(c)m[c.uid]=c;
  }
  return m;
}
const pdOf=()=>ui.pending;
function freshLog(){const G=ui.G;const f=G.log.slice(ui.seen);ui.seen=G.log.length;return f}
function cardEl(c,o={}){
  const G=ui.G;const d=c.def;
  const statsPreview=d.kind==='Unit'?`<span class="chip">ATK ${d.atk}</span><span class="chip">DEF ${d.def}</span><span class="chip">CRI ${d.cri}</span>`:d.kind==='Avatar'&&c.owner>=0&&G.players[c.owner]&&G.players[c.owner].avatar.card.uid===c.uid?`<span class="chip">HP ${G.players[c.owner].avatar.hp}</span>`:'';
  if(o.down)return `<div class="card back ${o.cls||''}" ${o.uid?`data-uid="${c.uid}"`:''}></div>`;
  return `<div class="card ${cardArt(d.id)} ${o.cls||''}" data-uid="${c.uid}" title="${esc(d.name)}" ${o.style?`style="${o.style}"`:''}>${o.inner||''}</div>`;
}
function unitEl(u,hl){
  const G=ui.G;
  const sv=(k)=>AF.stat(G,u,k),b=(k)=>u.def[k];
  const cl=k=>sv(k)>b(k)?'up':sv(k)<b(k)?'down':'';
  const tags=[];
  if(u.enteredTurn===G.turn&&u.owner===G.active)tags.push('<span class="tag" title="ลงสนามเทิร์นนี้ ยังโจมตีไม่ได้">ใหม่</span>');
  if(AF.silenced(G,u))tags.push('<span class="tag warn" title="สูญเสียความสามารถ">ปิดสกิล</span>');
  if(u.equips.length)tags.push(`<span class="tag" title="${esc(u.equips.map(e=>e.def.name).join(', '))}">EQ${u.equips.length}</span>`);
  if(u.mods.some(m=>m.flag==='doubleStrike'))tags.push('<span class="tag">x2</span>');
  const eqs=u.equips.length?`<div class="eqs">${u.equips.map(e=>`<div class="eqc ${cardArt(e.def.id)} ${hlFor(e.uid)}" data-uid="${e.uid}" title="${esc(e.def.name)}"></div>`).join('')}</div>`:'';
  const inner=eqs+`<div class="stats"><span class="s a ${cl('atk')}" title="ATK">${sv('atk')>=9999?'∞':sv('atk')}</span><span class="s d ${cl('def')}" title="DEF">${sv('def')}</span><span class="s c ${cl('cri')}" title="CRI">${sv('cri')}</span></div><div class="tags">${tags.join('')}</div>`;
  return cardEl(u,{cls:`${u.state==='rest'?'rest':''} ${hl||''}`,inner});
}
function hlFor(uid){
  const pd=pdOf();if(!pd||ui.cover!==null)return '';
  if(pd.kind==='pick'&&(pd.spec.kind==='units'||pd.spec.kind==='attackTarget')){if(pd.spec.options.some(o=>o.id===uid))return 'tg'}
  if(pd.kind==='attack'){
    const o=pd.spec.options;
    if(ui.sel==null){if(o.some(x=>x.attacker.uid===uid))return 'hl'}
    else{if(uid===ui.sel)return 'sel';const cur=o.find(x=>x.attacker.uid===ui.sel);if(cur&&cur.units.some(u=>u.uid===uid))return 'tg';if(o.some(x=>x.attacker.uid===uid))return 'hl'}
  }
  if(pd.kind==='act'){if(pd.spec.actions.some(a=>a.uid===uid||(a.card&&a.card.host&&a.card.host.uid===uid)))return 'hl'}
  return '';
}
function avatarTargetable(p){
  const pd=pdOf();if(!pd)return false;
  if(pd.kind==='attack'&&ui.sel!=null){const cur=pd.spec.options.find(x=>x.attacker.uid===ui.sel);return !!(cur&&cur.avatar&&p!==pd.p)}
  if(pd.kind==='pick'&&pd.spec.kind==='attackTarget')return pd.spec.options.some(o=>o.id==='avatar')&&p!==pd.p;
  return false;
}
function sideHTML(p,isTop,fresh){
  const G=ui.G,P=G.players[p];const dl=AF.DOMAIN_LIMIT;
  const avHL=hlFor(P.avatar.card.uid);const avT=avatarTargetable(p);
  const hit=fresh.find(l=>l.extra&&l.extra.dmg&&l.p===p);
  const hpbar=`<div class="hp" title="HP ${P.avatar.hp}">${Array.from({length:10},(_,i)=>`<i class="${i<P.avatar.hp?'':'off'}"></i>`).join('')}</div>`;
  const av=`<div class="av"><div class="hexw ${avT?'tg':avHL==='hl'?'hl':''}" data-uid="${P.avatar.card.uid}" ${avT?`data-zone="avatar" data-p="${p}"`:''}><div class="hex ${cardArt(P.avatar.card.def.id)} ${hit?'hit':''}"></div>${hit?`<span class="float">-${hit.extra.dmg}</span>`:''}</div><div class="hpn">HP ${P.avatar.hp}</div>${hpbar}</div>`;
  const slots=P.field.map(u=>`<div class="slot ${u?'':'empty'}">${u?unitEl(u,(hlFor(u.uid))+(prefs.playFx&&!prefs.motion&&fresh.some(l=>l.extra&&(l.extra.enter===u.uid))?' summon':'')+(fresh.some(l=>l.extra&&l.extra.attack===u.uid)?' atk':'')):''}</div>`).join('');
  const action=`<div class="azone"><span class="zlab">Action Zone · Unit 4 ช่อง</span><div class="in">${slots}</div></div>`;
  const msl=P.magic.map(c=>`<div class="mslot">${c?cardEl(c,{cls:'mini'}):''}</div>`).join('');
  const dsl=Array.from({length:dl},(_,i)=>{const c=P.domains[i];return `<div class="mslot">${c?cardEl(c,{cls:`mini ${hlFor(c.uid)}`}):''}</div>`}).join('');
  const deckTop=P.avatar.card.def.id==='SD02-001'&&P.deck[0]?cardEl(P.deck[0],{cls:'mini'}):`<div class="card back mini"></div>`;
  const dtop=P.discard[P.discard.length-1];
  const dHL=pdOf()&&pdOf().kind==='act'&&pdOf().p===p&&pdOf().spec.actions.some(a=>a.zone==='discard');
  const eli=`<span class="eli"><span class="eld" title="Element Deck">Element Deck <b>${P.edeck.length}</b>${[...new Set([...P.edeck,...P.elems].map(x=>x.el))].map(k=>elIcon(k,12)).join('')}</span><span class="ela" title="Element ที่พร้อมใช้ / ทั้งหมด">Element <b>${AF.standElems(P).length}/${P.elems.length}</b> <span class="elems">${P.elems.map(e=>`<span class="el ${e.state==='rest'?'rest':''}" title="${e.state==='rest'?'Rest (ใช้แล้ว)':'Stand (พร้อมใช้)'}">${elIcon(e.el,14)}</span>`).join('')||'<span class="muted">ยังไม่มี</span>'}</span></span></span>`;
  const disc=`<div class="pile ${dHL?'hl':''}" data-zone="discard" data-p="${p}"><span class="zlab">กองทิ้ง</span><div style="position:relative">${dtop?cardEl(dtop,{cls:'mini'}).replace(/data-uid="\d+"/,''):'<div class="mslot"></div>'}<span class="cnt">${P.discard.length}</span></div></div>`;
  const mid=`<div class="row mid"><div class="zone"><span class="zlab">Magic Area</span><div class="in">${msl}</div></div>${av}<div class="zone"><span class="zlab">Domain</span><div class="in">${dsl}</div></div><div class="pile" data-zone="deck" data-p="${p}"><span class="zlab">Main Deck</span><div style="position:relative">${deckTop}<span class="cnt">${P.deck.length}</span></div></div>${disc}</div>`;
  const rows=isTop?[mid,action]:[action,mid];
  const handN=P.hand.length;
  const oppHand=isTop?`<div class="hand-opp">${ui.peek?P.hand.map(c=>cardEl(c,{})).join(''):P.hand.map(c=>`<div class="card back"></div>`).join('')}</div>`:'';
  return `<div class="side ${isTop?'top':'bot'} ${G.active===p&&G.phase!=='over'?'act':''}"><div class="head"><span>${esc(P.name)}</span><span class="pill">${esc(P.deckName||(DATA.raw.DECKS[P.deckSeries]||{}).name||'')}</span><span class="pill">มือ ${handN} ใบ</span>${G.active===p?'<span class="pill" style="background:var(--gold);color:#111">กำลังเล่น</span>':''}${eli}${isTop?oppHand:''}</div>${rows.join('')}</div>`;
}
function phaseBar(){
  const G=ui.G;const order=[['start','เริ่ม'],['draw','จั่ว'],['main','Main'],['attack','Attack'],['ultimate','Ultimate'],['end','จบ']];
  const i=order.findIndex(o=>o[0]===G.phase);
  return `<div class="phases">${order.map((o,k)=>`<span class="ph ${k===i?'on':k<i?'done':''}">${o[1]}</span>`).join('')}</div>`;
}
function handHTML(){
  const G=ui.G;const P=G.players[ui.viewer];const pd=pdOf();
  const playable=new Set(pd&&pd.kind==='act'&&pd.p===ui.viewer&&ui.cover===null?pd.spec.actions.filter(a=>a.card&&a.card.zone==='hand').map(a=>a.uid):[]);
  const act=pd&&pd.kind==='act'&&pd.p===ui.viewer;
  const hidden=ui.cfg.mode==='spec'&&!ui.peek;
  const fan=(i)=>{const mid=(P.hand.length-1)/2,t=mid?((i-mid)/mid):0;return `--hand-order:${i};--fan-angle:${(t*12).toFixed(1)}deg;--fan-y:${(Math.abs(t)*Math.abs(t)*8).toFixed(1)}px`};
  return `<div class="handrow">${P.hand.map((c,i)=>hidden?`<div class="card back handc" style="${fan(i)}"></div>`:cardEl(c,{cls:`handc ${playable.has(c.uid)?'hl':act?'dim':''}`,style:fan(i)})).join('')||'<span class="muted">ไม่มีการ์ดบนมือ</span>'}</div>`;
}
function barHTML(){
  const G=ui.G;const pd=pdOf();
  if(ui.over)return '';
  if(!pd||ui.cover!==null){return `<div class="bar"><span class="msg muted">${G.phase==='setup'?(ui.cfg.mode==='hot'?'เตรียมเกม…':'รอผู้เล่นอีกฝั่งเลือกมือเริ่มต้น… (ของคุณเลือกแล้ว)'):`${esc(G.players[G.active].name)} กำลังเล่น…`}${ui.ol&&!ui.ol.peer&&!ui.over?' · ⚠ เพื่อนหลุดการเชื่อมต่อ รอกลับเข้าห้อง':''}</span>${ui.cfg.mode!=='hot'&&ui.cfg.mode!=='online'?`<button class="btn sm" data-act="speed">${ui.cfg.speed===0?'ความเร็ว: ทันที':ui.cfg.speed<300?'ความเร็ว: เร็ว':ui.cfg.speed<800?'ความเร็ว: ปกติ':'ความเร็ว: ช้า'}</button>`:''}</div>`}
  const nm=esc(G.players[pd.p].name);
  if(pd.kind==='act'){
    const ph=pd.spec.phase;
    const nxt=ph==='main'?'ไป Attack Phase':'จบ Ultimate Phase';
    const hint=ph==='main'?'ลากการ์ดจากมือไปวางบนสนามของคุณ (หรือแตะการ์ดเพื่อเลือกคำสั่ง) · แตะ Avatar/Unit เพื่อใช้ความสามารถ':'Ultimate Phase: ลาก Ultimate จากมือไปวางบนสนาม (หรือแตะเพื่อใช้)';
    return `<div class="bar you"><span class="msg"><b>${nm}</b> · ${ph==='main'?'Main Phase':'Ultimate Phase'}<br><span class="muted">${hint}</span></span><button class="btn pri" data-act="pass">${nxt}</button></div>`;
  }
  if(pd.kind==='attack'){
    const sel=ui.sel!=null?ui.G&&cardMap()[ui.sel]:null;
    return `<div class="bar you"><span class="msg"><b>${nm}</b> · Attack Phase<br><span class="muted">${sel?`เลือก ${esc(sel.def.name)} แล้ว: คลิกเป้าหมายสีแดง (Unit ฝ่ายตรงข้าม${pd.spec.options.find(o=>o.attacker.uid===ui.sel)?.avatar?' หรือ Avatar':''})`:'ลาก Unit ที่เรืองแสงไปวางบนเป้าหมาย (หรือแตะ Unit แล้วแตะเป้าหมาย)'}</span></span>${sel?'<button class="btn" data-act="unsel">ยกเลิกการเลือก</button>':''}<button class="btn pri" data-act="endatk">จบ Attack Phase</button></div>`;
  }
  if(pd.kind==='pick'&&(pd.spec.kind==='units'||pd.spec.kind==='attackTarget')){
    return `<div class="bar you"><span class="msg"><b>${nm}</b> · ${esc(pd.spec.title)}<br><span class="muted">คลิกเป้าหมายสีแดงบนสนาม</span></span>${pd.spec.optional?'<button class="btn" data-act="skip">ข้าม</button>':''}</div>`;
  }
  return `<div class="bar you"><span class="msg"><b>${nm}</b> · กำลังตัดสินใจ</span></div>`;
}
function chainHTML(){
  const G=ui.G;if(!G.stack||!G.stack.length)return '';
  return `<div class="chain"><b>กำลังตอบโต้:</b> ${G.stack.map(it=>esc(`${G.players[it.controller].name}: ${it.label||it.source.def.name}`)).join(' ← ')}</div>`;
}
function inspectorHTML(c){
  if(!c)return `<div class="muted">เอาเมาส์ชี้ (หรือแตะ) การ์ดใบไหนก็ได้เพื่อดูรายละเอียด</div><div class="legend" style="margin-top:12px"><span class="s a" style="position:static">A</span> ATK · <span class="s d" style="position:static">D</span> DEF · <span class="s c" style="position:static">C</span> CRI<br>เลขเขียว = บัฟ เลขแดง = ลดค่า</div>`;
  const G=ui.G;const d=c.def;
  let live='';
  if(c.zone==='field'){live=`<div class="kv"><span class="chip">ATK ${AF.stat(G,c,'atk')}</span><span class="chip">DEF ${AF.stat(G,c,'def')}</span><span class="chip">CRI ${AF.stat(G,c,'cri')}</span><span class="chip">${c.state==='rest'?'Rest (นอน)':'Stand (ตั้ง)'}</span></div>`+(c.equips.length?`<div class="muted">สวมใส่: ${c.equips.map(e=>esc(e.def.name)).join(', ')}</div>`:'')+(c.mods.length?`<div class="muted">ผลชั่วคราว/ถาวร: ${c.mods.map(m=>[m.atk?`ATK${m.atk>0?'+':''}${m.atk}`:'',m.def?`DEF${m.def>0?'+':''}${m.def}`:'',m.cri?`CRI${m.cri>0?'+':''}${m.cri}`:'',m.silence?'ปิดสกิล':'',m.flag||''].filter(Boolean).join(' ')+(m.until==='perm'?' (ถาวร)':'')).join(' · ')}</div>`:'')}
  let why='';
  if(c.zone==='hand'&&c.owner===ui.viewer&&pdOf()&&pdOf().kind==='act'){const w=AF.whyNot(G,c.owner,c);if(w)why=`<div class="note"><b>เล่นตอนนี้ไม่ได้:</b> ${esc(w)}</div>`}
  const cost=d.kind==='Unit'?`Cost ${d.cost}`:d.kind==='Avatar'?'':(d.noCost?'ไม่มีค่าร่าย':`Spend ${d.cost}`);
  const fx=d.fx.map(f=>`<div>${f[0]?`<span class="kw">${esc(f[0])}</span>`:''}${esc(f[1])}</div>`).join('')||'<div class="muted">ไม่มีเอฟเฟกต์</div>';
  return `<div class="insp"><div class="ihd"><div class="big ${cardArt(d.id)}" title="แตะเพื่อขยาย/ย่อรูปการ์ด"></div><div class="itx"><h3>${esc(d.name)}</h3><div class="kv"><span class="chip">${kindTh(d.kind)}</span>${cost?`<span class="chip">${cost}</span>`:''}${statsPreview}<span class="chip">${esc(d.tribe)}</span><span class="chip">${d.id}</span></div>${live}</div></div><div class="fxl">${fx}</div>${why}${(d.unscripted?'<div class="note"><b>ยังไม่มีสคริปต์เอฟเฟกต์:</b> การ์ดนี้เล่นได้ แต่เอฟเฟกต์ไม่ทำงาน ใช้แถบ "เครื่องมือ" ทำผลเอง</div>':'')+(d.stale?'<div class="note"><b>ข้อความต่างจากที่สคริปต์เขียนไว้:</b> การ์ดถูกแก้ใน card-api เอฟเฟกต์อาจไม่ตรงกับข้อความใหม่</div>':'')}${CARD_NOTES[d.id]?`<div class="note"><b>การตีความของระบบ:</b> ${esc(CARD_NOTES[d.id])}</div>`:''}</div>`;
}
function panelHTML(){
  const G=ui.G;
  const tabs=[['card','การ์ด'],['log','บันทึก'],['rule','กติกา']];
  let body='';
  if(ui.tab==='card')body=inspectorHTML(ui.inspect&&cardMap()[ui.inspect.uid]);
  else if(ui.tab==='log')body=`<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn sm" data-act="dllog">⬇ ดาวน์โหลด Log Battle</button></div><div class="log">${G.log.map(l=>`<div class="${l.extra&&l.extra.divider?'div':'p'+(l.p===null?'':l.p)}">${esc(l.text)}</div>`).join('')}</div>`;
  else body=rulesHTML(true);
  return `<aside class="panel ${ui.showPanel?'show':''}"><button class="btn sm pclose" data-act="panel">✕ ปิด</button><div class="tabs">${tabs.map(([k,l])=>`<button class="${ui.tab===k?'on':''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div><div class="pbody">${body}</div></aside>`;
}
function introHTML(){
  const G=ui.G,f=G.first,s=1-f,hot=ui.cfg.mode==='hot',me=ui.viewer;
  const card=(p,first)=>`<div class="ti-p ${first?'first':'second'} ${!hot&&p===me?'me':''}"><span class="ti-n">${first?'1':'2'}</span><div><b>${esc(G.players[p].name)}</b>${!hot&&p===me?' <em>(คุณ)</em>':''}<small>${first?'เริ่มก่อน':'เริ่มหลัง'}</small></div></div>`;
  const note=hot?'สองคนใช้เครื่องเดียวกัน ตอนเลือกมือเริ่มต้นจะถามทีละคน แล้วระบบจะบอกให้ส่งเครื่องต่อ':ui.cfg.mode==='online'?'ต่างคนต่างเลือกเปลี่ยนมือเริ่มต้นได้พร้อมกัน ไม่ต้องรอเพื่อน':'เลือกว่าจะเปลี่ยนมือเริ่มต้นหรือเก็บไว้ในขั้นต่อไป';
  return `<div class="cover"><div class="ti"><h1>ลำดับการเล่น</h1><p class="muted">${ui.cfg.mode!=='online'&&ui.cfg.first!=='random'?'ตามที่ตั้งค่าไว้':'สุ่มแล้ว'}</p>${card(f,true)}${card(s,false)}${!hot&&me===f?'<p class="ti-t"><b>คุณได้เล่นก่อน</b></p>':!hot&&me===s?'<p class="ti-t"><b>คุณเล่นหลัง</b></p>':''}<p class="muted">${note}</p><button class="btn pri" data-act="intro">ไปเลือกมือเริ่มต้น</button></div></div>`;
}
function gameHTML(){
  const G=ui.G;const fresh=freshLog();const v=ui.viewer;
  if(ui.intro)return introHTML();
  if(ui.cover!==null)return `<div class="cover"><div style="display:grid;gap:14px;justify-items:center"><h1>ส่งอุปกรณ์ให้ ${esc(G.players[ui.cover].name)}</h1><p>ให้ผู้เล่นอีกฝั่งหันหน้าหนี แล้วกดเมื่อพร้อม</p><button class="btn" data-act="ready">พร้อมแล้ว</button></div></div>`;
  const opp=1-v;
  const btns=`<button class="btn sm" data-act="settings">⚙ ตั้งค่า</button><button class="btn sm" data-act="help">กติกา</button>${ui.cfg.mode==="online"?"":`<button class="btn sm" data-act="restart">เริ่มใหม่</button>`}<button class="btn sm" data-act="surrender">ยอมแพ้</button>`;
  return `<div class="top"><button class="btn sm home" data-act="gohome" title="ไปหน้า Home (เกมยังค้างอยู่ กลับมาเล่นต่อได้)">⌂ Home</button><span class="pill">เทิร์น ${G.turn}</span>${phaseBar()}<span class="spacer"></span><button class="btn sm narrowonly" data-act="panel">📋 การ์ด/บันทึก</button><span class="tbtns">${btns}</span><button class="btn sm onlym" data-act="gmenu" aria-label="เมนู">☰ เมนู</button></div>
  ${ui.gmenu?`<div class="gmenu"><button class="btn" data-act="panel">📋 การ์ด · บันทึก · กติกา</button><button class="btn" data-act="settings">⚙ ตั้งค่า</button><button class="btn" data-act="help">📖 กติกาโดยย่อ</button>${ui.cfg.mode==="online"?"":`<button class="btn" data-act="restart">↻ เริ่มใหม่</button>`}<button class="btn" data-act="surrender">🏳 ยอมแพ้</button><button class="btn" data-act="gohome">⌂ ไปหน้า Home</button></div>`:''}
  <div class="game" data-ph="${pdOf()&&pdOf().kind||''}"><main style="min-width:0"><section class="duel-half opponent">${sideHTML(opp,true,fresh)}</section><div class="board-controls">${chainHTML()}${barHTML()}</div><section class="duel-half player">${sideHTML(v,false,fresh)}</section><div class="hand-dock">${handHTML()}</div></main>${panelHTML()}</div>
  ${ui.menu?menuHTML():''}${ui.over?overHTML():''}${pendingModalHTML()}${ui.modal?modalHTML():''}${ui.settings?settingsHTML():''}`;
}
function overHTML(){
  const G=ui.G,r=ui.over;
  if(ui.ol&&ui.ol.mm)return mmOverHTML(G,r,ui.ol);   // แมตช์จับคู่ออนไลน์: หน้าสรุปผลพร้อมแต้ม/เหรียญ (js/ui/online.js)
  return `<div class="ov"><div class="dlg narrow over"><h2>จบเกม</h2><div class="win">${r.winner==null?'เสมอ':esc(G.players[r.winner].name)+' ชนะ'}</div><div>${esc(r.reason)}</div><div class="muted">เล่นไป ${G.turn} เทิร์น · HP ${G.players.map(P=>esc(P.name)+' '+P.avatar.hp).join(' / ')}</div><div class="acts"><button class="btn" data-act="closeover">ดูกระดาน</button><button class="btn" data-act="tosetup">ตั้งค่าใหม่</button><button class="btn pri" data-act="restart">เล่นอีกครั้ง</button></div></div></div>`;
}

/* ------------------------------------------------------------------ ตั้งค่า: ขนาดหน้าจอ (zoom ทั้งหน้า เก็บในเครื่อง) */
const SCALE_KEY='af-scale',SCALE_MIN=70,SCALE_MAX=130;
function loadScale(){let v=100;try{v=parseInt(localStorage.getItem(SCALE_KEY),10)}catch(e){}return v>=SCALE_MIN&&v<=SCALE_MAX?v:100}
function applyScale(v,save){
  v=Math.max(SCALE_MIN,Math.min(SCALE_MAX,Math.round(v)));
  ui.scale=v;document.documentElement.style.zoom=v===100?'':String(v/100);
  if(save!==false){try{localStorage.setItem(SCALE_KEY,v)}catch(e){}}
  if(ui.screen==='game'&&typeof fitLayout==='function')fitLayout();
}
/* ค่ากำหนดส่วนตัวของหน้าเกม (จำไว้ในเบราว์เซอร์) */
const PREF_KEY='af-prefs';
const prefs=Object.assign({hover:true,motion:false,playFx:true},(()=>{try{return JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}catch(e){return {}}})());
function applyPrefs(){document.documentElement.classList.toggle('rm',!!prefs.motion);try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs))}catch(e){}}
applyPrefs();
function settingsHTML(){
  const v=ui.scale||100,bot=ui.cfg.mode==='bot'||ui.cfg.mode==='spec',sp=ui.cfg.speed;
  const seg=(k,val,on,label)=>`<button class="btn sm ${on?'pri':''}" data-act="pref" data-k="${k}" data-v="${val}">${label}</button>`;
  return `<div class="ov"><div class="dlg narrow"><h2>ตั้งค่า</h2>
    <h3 class="sh">หน้าจอ</h3>
    <label class="fl">ขนาดหน้าจอ <b id="scaleval">${v}%</b>
      <input id="scalerange" type="range" min="${SCALE_MIN}" max="${SCALE_MAX}" step="5" value="${v}" style="width:100%"></label>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${[80,90,100,110,120].map(n=>`<button class="btn sm ${n===v?'pri':''}" data-act="setscale" data-v="${n}">${n}%</button>`).join('')}</div>
    <p class="muted">ปรับขนาดการ์ดและตัวอักษรทั้งหน้า</p>
    <h3 class="sh">การเล่น</h3>
    ${bot?`<div class="srow"><span>ความเร็วบอท</span><span class="sseg">${[[0,'ทันที'],[250,'เร็ว'],[550,'ปกติ'],[1000,'ช้า']].map(([n,l])=>`<button class="btn sm ${sp===n?'pri':''}" data-act="pref" data-k="speed" data-v="${n}">${l}</button>`).join('')}</span></div>`:''}
    <div class="srow"><span>แสดงการ์ดเมื่อเอาเมาส์ชี้</span><span class="sseg">${seg('hover','1',prefs.hover,'เปิด')}${seg('hover','0',!prefs.hover,'ปิด')}</span></div>
    <div class="srow"><span>เอฟเฟกต์ตอนลงการ์ด</span><span class="sseg">${seg('playFx','1',prefs.playFx,'เปิด')}${seg('playFx','0',!prefs.playFx,'ปิด')}</span></div>
    <p class="muted">แสดงแสงและจังหวะการ์ดลงสนามเมื่อมีการอัญเชิญ</p>
    <div class="srow"><span>แอนิเมชัน</span><span class="sseg">${seg('motion','0',!prefs.motion,'ปกติ')}${seg('motion','1',prefs.motion,'ลดลง')}</span></div>
    <p class="muted">ค่าทั้งหมดถูกจำไว้ในเบราว์เซอร์นี้</p>
    <h3 class="sh">เมนูลัด</h3>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="help">กติกาโดยย่อ</button>${ui.G?`<button class="btn sm" data-act="dllog">⬇ บันทึกเกม (Battle Log)</button>`:''}</div>
    <div class="acts"><button class="btn" data-act="setscale" data-v="100">รีเซ็ตขนาด</button><button class="btn pri" data-act="closesettings">ปิด</button></div></div></div>`;
}
applyScale(loadScale(),false);
