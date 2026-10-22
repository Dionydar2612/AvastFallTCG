/* UI · เด็คตัวอย่าง + เด็คของฉัน (localStorage) + ค่าตั้งต้นที่จำไว้ */
'use strict';
/* ------------------------------------------------------------------ decks (presets + my decks) */
function defaultCfg(){return {mode:'bot',sel:[null,null],first:'random',speed:550,api:DATA.DEFAULT_API}}
function loadCfg(){let c=defaultCfg();try{const s=JSON.parse(localStorage.getItem('af-playtest')||'null');if(s){if(Array.isArray(s.sel))c.sel=s.sel;for(const k of ['mode','first','speed','api'])if(s[k]!==undefined)c[k]=s[k];if(String(c.api).replace(/\/+$/,'')===DATA.LEGACY_API)c.api=DATA.DEFAULT_API}}catch(e){}
  try{const q=new URLSearchParams(location.search).get('api');if(q&&/^https?:\/\//.test(q))c.api=q}catch(e){}
  return c}
function saveCfg(){try{localStorage.setItem('af-playtest',JSON.stringify(ui.cfg))}catch(e){}}
function loadMy(){try{const a=JSON.parse(localStorage.getItem('af-mydecks')||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function saveMy(){try{localStorage.setItem('af-mydecks',JSON.stringify(ui.my))}catch(e){ui.toast='บันทึกลงเครื่องไม่ได้'}}
function presetDecks(){return DATA.series.map(s=>{const a=AF.autoDeck(s);return {key:'preset:'+s,name:DATA.raw.DECKS[s].name,series:s,avatar:a.avatar,counts:a.counts,edeck:null,preset:true}})}
function allDecks(){return [...presetDecks(),...ui.my.map(d=>({key:'my:'+d.id,name:d.name,series:(AF.defs[d.avatar]||{}).deck||'',avatar:d.avatar,counts:d.counts,edeck:d.edeck,preset:false,id:d.id}))]}
function deckByKey(k){return allDecks().find(d=>d.key===k)||null}
function fixSelections(){const ks=allDecks().map(d=>d.key);const pre=presetDecks().map(d=>d.key);for(const i of [0,1]){if(!ks.includes(ui.cfg.sel[i]))ui.cfg.sel[i]=pre[Math.min(i,pre.length-1)]||ks[0]||null}}
const deckErrors=k=>{const d=deckByKey(k);return d?AF.validateDeck({avatar:d.avatar,counts:d.counts,edeck:d.edeck}):['ไม่พบเด็คที่เลือก']};
const deckOf=i=>{const d=deckByKey(ui.cfg.sel[i]);return {series:d.series,avatar:d.avatar,counts:d.counts,edeck:d.edeck,name:d.name}};
function deckWarn(d){let n=0;for(const id of [d.avatar,...Object.keys(d.counts)]){const f=AF.defs[id];if(f&&(f.unscripted||f.stale))n++}return n}
function edeckText(d){const e=AF.edeckOf(d);return Object.entries(e).filter(([,n])=>n>0).map(([k,n])=>elIcon(k,12)+esc(k)+' '+n).join(' · ')}
const kindTh=k=>({Avatar:'Avatar',Unit:'Unit',Enchant:'Enchant (เวท)',Counter:'Counter (ตอบโต้)',Equipment:'Equipment (อุปกรณ์)',Domain:'Domain (สนาม)',Ultimate:'Ultimate'}[k]||k);
