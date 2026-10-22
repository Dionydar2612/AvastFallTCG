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
window.__af={ui,AF,DATA};
