/* UI · ตัววาดหน้า (render) และจัดขนาดการ์ดให้พอดีจอ */
'use strict';
/* ------------------------------------------------------------------ render scheduling */
let raf=0;
function scheduleRender(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;render()})}
function fitLayout(){
  const de=document.documentElement;
  if(!de.classList.contains('fit')||innerWidth<=1050){de.style.removeProperty('--cwb');return}
  const main=document.querySelector('.game main');if(!main)return;
  const top=main.getBoundingClientRect().top+scrollY;
  const W=innerWidth/((ui.scale||100)/100);   // ความกว้างจริงในหน่วยหลัง zoom
  let hi=Math.min(82,W*.054,(W-726)/7.2),lo=26;
  const ok=x=>{de.style.setProperty('--cwb',x+'px');return main.getBoundingClientRect().bottom+scrollY<=innerHeight-8};
  if(hi<=lo){de.style.setProperty('--cwb',lo+'px');return}
  if(ok(hi))return;
  for(let i=0;i<7;i++){const m=(hi+lo)/2;if(ok(m))lo=m;else hi=m}
  de.style.setProperty('--cwb',lo+'px');
}
addEventListener('resize',()=>{if(ui.screen==='game')fitLayout()});
function render(){
  document.documentElement.classList.toggle('fit',ui.screen==='game');
  const keep=document.querySelector('.log');const atBottom=keep?keep.scrollTop+keep.clientHeight>=keep.scrollHeight-30:true;const ps=document.querySelector('.pbody');const pst=ps?ps.scrollTop:0;
  const ovs=document.querySelector('.ov .list');const ovt=ovs?ovs.scrollTop:0;
  const ks={};document.querySelectorAll('[data-ks]').forEach(e=>ks[e.dataset.ks]=e.scrollTop);
  /* เก็บโฟกัส/ตำแหน่งเคอร์เซอร์ของช่องกรอก (เช่นฟอร์มข้อเสนอแนะ) ไม่ให้หลุดเมื่อมีการ render ซ้ำ */
  const ae=document.activeElement;let fk=null;
  if(ae&&ae.dataset&&ae.dataset.fb){try{fk={k:ae.dataset.fb,s:ae.selectionStart,e:ae.selectionEnd}}catch(_){fk={k:ae.dataset.fb}}}
  root.innerHTML=ui.screen==='setup'?(ui.page==='mydecks'?mydecksHTML():ui.page==='guide'?guideHTML():setupHTML()):gameHTML();
  document.querySelectorAll('[data-ks]').forEach(e=>{if(ks[e.dataset.ks]!=null)e.scrollTop=ks[e.dataset.ks]});
  document.documentElement.classList.toggle('fit',ui.screen==='game'&&ui.cover===null);
  if(fk){const el=document.querySelector('[data-fb="'+fk.k+'"]');if(el){el.focus();try{if(fk.s!=null)el.setSelectionRange(fk.s,fk.e)}catch(_){}}}
  fitLayout();
  const lg=document.querySelector('.log');if(lg&&atBottom)lg.scrollTop=lg.scrollHeight;
  if(ui.tab!=='log'){const pb=document.querySelector('.pbody');if(pb)pb.scrollTop=pst}
  const o2=document.querySelector('.ov .list');if(o2)o2.scrollTop=ovt;
}
