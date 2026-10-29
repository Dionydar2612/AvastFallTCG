/* UI · จุดเริ่มต้นของแอป (โหลดเป็นไฟล์สุดท้าย) */
'use strict';
DATA.boot();                       // ใช้สำเนาในเบราว์เซอร์ หรือ snapshot ก่อน
ui.cfg=loadCfg();ui.my=loadMy();
DATA.setApi(ui.cfg.api);
syncFromData();fixSelections();
render();
DATA.load();                       // แล้วค่อยดึงข้อมูลล่าสุดจาก card-api
try{const rc=new URLSearchParams(location.search).get('room');if(rc){ui.cfg.mode='online';ui.olcode=rc.toUpperCase();history.replaceState(null,'',location.pathname);olJoin(ui.olcode)}}catch(e){}   // เปิดลิงก์ห้อง ?room=รหัส
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ui.screen!=='game'&&Date.now()-(DATA.status.at||0)>90000&&DATA.status.state!=='loading')DATA.load()});
/* ปุ่มบนแถบเมนูหลัก (วิธีเล่น · กระดิ่ง Update Note) เรียกเข้ามาทางนี้ (js/site.js) */
const noteKey=()=>{const u=UPDATE_NOTES[0];return u?(u.id||u.date)+'|'+u.title:''};
function syncBell(){let seen='';try{seen=localStorage.getItem('af-notes-seen')||''}catch(e){}const d=document.getElementById('hdrNotesDot');if(d)d.hidden=seen===noteKey()}
window.AFApp={
  /* กด PLAY ที่ Home (หรือ ▶ เล่น ที่ Decks): เริ่มเกมทันทีตามโหมดที่เลือก — ไม่ผ่านหน้าตั้งค่า
     - เด็คผู้เล่น 1: ที่ระบุมา > ที่ผู้เล่นเลือกไว้เอง > เด็คของฉันที่พร้อมเล่น > เด็คตัวอย่าง
     - คู่ต่อสู้ (บอท/ผู้เล่น 2): ที่ผู้เล่นเลือกไว้เอง ไม่งั้นสุ่มเด็คตัวอย่าง
     - ออนไลน์ หรือเด็คยังไม่พร้อม → เปิดหน้าตั้งค่าแมตช์ให้จัดการต่อ (ซ้อนอยู่ใต้ Home) */
  launch(o){
    if(ui.screen==='game'){if(!confirm('มีเกมที่กำลังเล่นอยู่ — เริ่มเกมใหม่แทนไหม?'))return;olLeave(true);ui.token++}
    ui.screen='setup';ui.page='play';ui.modal=null;ui.err='';ui.over=null;ui.pending=null;
    const mode=['bot','hot','spec','online'].includes(o.mode)?o.mode:'bot';ui.cfg.mode=mode;
    ui.my=loadMy();
    const mine=allDecks().filter(d=>!d.preset);
    if(o.deckId&&deckByKey('my:'+o.deckId)){ui.cfg.sel[0]='my:'+o.deckId;ui.cfg.picked0=true}
    else if(!ui.cfg.picked0){const ok=mine.find(d=>!deckErrors(d.key).length);if(ok)ui.cfg.sel[0]=ok.key}
    fixSelections();
    if(mode!=='online'&&!ui.cfg.picked1){const pre=presetDecks().filter(d=>d.key!==ui.cfg.sel[0]);if(pre.length)ui.cfg.sel[1]=pre[Math.floor(Math.random()*pre.length)].key}
    saveCfg();
    if(mode==='online'||[0,1].some(i=>deckErrors(ui.cfg.sel[i]).length)){render();scrollTo(0,0);return}
    startGame();scrollTo(0,0)
  },
  /* เปิดหน้าตั้งค่าแมตช์ (เลือกเด็ค/คู่ต่อสู้/ใครเล่นก่อน/ห้องออนไลน์) โดยไม่เริ่มเกม */
  setup(o){
    if(ui.screen==='game')return;
    ui.page='play';ui.modal=null;ui.err='';
    if(o&&o.mode&&['bot','hot','spec','online'].includes(o.mode))ui.cfg.mode=o.mode;
    ui.my=loadMy();fixSelections();render();scrollTo(0,0)
  },
  guide(){if(ui.screen==='setup'){ui.page='guide';ui.modal=null;render();scrollTo(0,0)}else{ui.modal={t:'help'};render()}},   // กำลังเล่นอยู่: เปิดกติกาโดยย่อแทน เกมไม่หาย
  notes(){ui.modal={t:'notes'};render();try{localStorage.setItem('af-notes-seen',noteKey())}catch(e){}syncBell();loadUpdateNotes().then(()=>{try{localStorage.setItem('af-notes-seen',noteKey())}catch(e){}syncBell()})}
};
syncBell();
window.__af={ui,AF,DATA,deckByKey,deckErrors,allDecks,loadMy};
