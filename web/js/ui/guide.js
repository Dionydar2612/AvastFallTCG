/* UI · หน้า "วิธีเล่น" (สอนเล่นตั้งแต่ต้น: การ์ดคืออะไร สนามมีอะไร เล่นการ์ดยังไง และ Keyword ทั้งหมด)
   - ภาพประกอบแผนผังเป็น SVG ในไฟล์นี้ ใช้สีตามธีมสว่าง/มืดของหน้าเว็บ
   ภาพการ์ดตัวอย่าง 4 ใบ (Avatar, Unit, Enchant, Ultimate) อยู่ที่ assets/guide/card-*.jpg (เรนเดอร์จาก BT01.pdf)
   - ตัวอย่างการ์ดจริงใช้รูปจาก card-api ผ่าน class cardArt() ถ้ารูปโหลดไม่ได้จะเห็นลายหลังการ์ดแทน
     และเอาเมาส์ชี้ (หรือแตะ) การ์ดตัวอย่างเพื่อดูการ์ดเต็มได้
   - ใส่ลิงก์วิดีโอสอนเล่นที่ TUTORIAL_VIDEO ได้ (ไฟล์ .mp4/.webm หรือลิงก์ YouTube embed) เว้นว่าง = ไม่แสดง
   - สไตล์เฉพาะหน้านี้ฉีดเข้า <head> จากไฟล์นี้เอง (GUIDE_CSS) จึงไม่ต้องแก้ css/style.css */
'use strict';
const TUTORIAL_VIDEO='';   // เช่น 'assets/tutorial.mp4' หรือ 'https://www.youtube.com/embed/xxxxxxxxxxx'

/* ------------------------------------------------------------------ สไตล์เฉพาะหน้า */
const GUIDE_CSS=`
.gd{max-width:980px}
.gd p{margin:0}
.gd h2{scroll-margin-top:14px}
.gd h3{font-size:15px}
.gd-toc{display:flex;flex-wrap:wrap;gap:6px;max-width:980px;margin:4px 0 0}
.gd-toc a{border:1.5px solid var(--line);border-radius:99px;padding:3px 11px;background:var(--panel);color:var(--ink);text-decoration:none;font-size:12.5px;font-weight:600}
.gd-toc a:hover{background:var(--ink);color:var(--paper)}
.gd-svg{width:100%;height:auto;max-width:780px;display:block;background:var(--panel);border:2px solid var(--line);border-radius:14px}
.gd-svg text{font-family:var(--f-body);fill:var(--ink)}
.gd-svg .t2{fill:var(--ink2)}
.gd-svg .tw{fill:#fff}
.gd-svg .b{font-weight:700}
.sv-card{fill:var(--paper);stroke:var(--line);stroke-width:2}
.sv-zone{fill:var(--mat);stroke:var(--line);stroke-width:2}
.sv-teal{fill:var(--tealtint);stroke:var(--teal);stroke-width:2.5}
.sv-slot{fill:none;stroke:var(--ink2);stroke-width:1.6;stroke-dasharray:5 4}
.sv-soft{fill:var(--soft);stroke:var(--line);stroke-width:1.5}
.sv-coral{fill:var(--coral);stroke:var(--line);stroke-width:1.5}
.sv-gold{fill:var(--gold);stroke:var(--line);stroke-width:1.5}
.sv-teal2{fill:var(--teal);stroke:var(--line);stroke-width:1.5}
.sv-good{fill:var(--good);stroke:var(--line);stroke-width:1.5}
.sv-bad{fill:var(--bad);stroke:var(--line);stroke-width:1.5}
.sv-line{fill:none;stroke:var(--line);stroke-width:2.2}
.sv-arrow{fill:none;stroke:var(--ink);stroke-width:2.5;marker-end:url(#gd-ah)}
.sv-bar{fill:var(--soft)}
.gd-cardx{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:8px 18px;align-items:start;background:var(--panel);border:2px solid var(--line);border-radius:14px;padding:12px 14px;margin:10px 0}
.gd-cardx>h3{grid-column:1/-1;margin:0;font-size:16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.gd-cardx>p{grid-column:1/-1}
@media (max-width:760px){.gd-cardx{grid-template-columns:1fr}.gd-cimg{max-width:320px}}
.gd-cimg{position:relative;width:100%}
.gd-cimg img{display:block;width:100%;height:auto;border-radius:10px;border:2px solid var(--line);cursor:help}
.gd-cimg i{position:absolute;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:var(--coral);color:#fff;font:700 12px var(--f-body);font-style:normal;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 0 0 1.5px var(--line);pointer-events:none}
.gd-thumb{width:100px;height:auto;border-radius:8px;border:2px solid var(--line);cursor:help;display:block}
.gd-fig{display:grid;gap:6px;margin:6px 0}
.gd-fig figcaption{font-size:12.5px;color:var(--ink2)}
.gd-split{display:grid;grid-template-columns:minmax(0,330px) minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:760px){.gd-split{grid-template-columns:1fr}}
.gd-legend{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.gd-legend li{display:grid;grid-template-columns:26px 1fr;gap:9px;align-items:start}
.gd-legend li>i{font-style:normal;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--coral);color:#fff;font:700 12.5px var(--f-body);border:1.5px solid var(--line)}
.gd-legend b{display:block}
.gd-kinds{display:grid;gap:10px}
.gd-kind{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;background:var(--panel);border:2px solid var(--line);border-radius:12px;padding:10px 12px;align-items:start}
.gd-kind h3{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.gd-kind ul{margin:6px 0 0;padding-left:18px;display:grid;gap:3px}
.gd-kind .card{--cw:92px;cursor:help}
@media (max-width:520px){.gd-kind{grid-template-columns:1fr}}
.gd-tag{display:inline-block;font:700 11px/1 var(--f-body);letter-spacing:.04em;border:1.5px solid var(--line);border-radius:6px;padding:3px 6px;background:var(--soft)}
.gd-steps{list-style:none;margin:0;padding:0;display:grid;gap:8px;counter-reset:st}
.gd-steps li{counter-increment:st;display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:start;background:var(--panel);border:2px solid var(--line);border-radius:12px;padding:8px 12px}
.gd-steps li::before{content:counter(st);display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--teal);color:#fff;font-weight:700;border:1.5px solid var(--line)}
.gd-play{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
.gd-play>div{background:var(--panel);border:2px solid var(--line);border-radius:12px;padding:10px 12px;display:grid;gap:6px;align-content:start}
.gd-play ol{margin:0;padding-left:20px;display:grid;gap:3px}
.gd-kw{background:var(--panel);border:2px solid var(--line);border-radius:12px;padding:10px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;align-items:start;scroll-margin-top:14px}
.gd-kw header{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.gd-kw .when{font-size:12.5px;color:var(--ink2)}
.gd-kw .body{display:grid;gap:5px;min-width:0}
.gd-kw .ex{display:flex;gap:8px;align-items:flex-start}
.gd-kw .ex .card{--cw:70px;cursor:help}
.gd-kw .ex small{display:block;text-align:center;max-width:76px;line-height:1.2;color:var(--ink2);margin-top:3px;font-size:11px}
@media (max-width:560px){.gd-kw{grid-template-columns:1fr}}
.kwb{display:inline-block;font:700 13px/1 var(--f-disp);letter-spacing:.03em;border:2px solid var(--line);border-radius:8px;padding:5px 10px;color:#fff;box-shadow:1px 1px 0 var(--line)}
.kwb.k-adv{background:var(--teal)}.kwb.k-adm{background:var(--coral)}.kwb.k-auto{background:#7b3fc4}
.kwb.k-act{background:var(--gold);color:#173646}.kwb.k-ann{background:#1f7fc4}.kwb.k-pro{background:#8b5a3c}
.kwb.k-ctr{background:#d4443a}.kwb.k-cost{background:var(--ink);color:var(--paper)}.kwb.k-ds{background:#0a9a4b}
.kwb.k-tn{background:#ee5a2a}.kwb.k-gen{background:var(--ink2)}
.gd-kwgrid{display:grid;gap:10px}
.gd-elrow{display:flex;gap:8px;flex-wrap:wrap}
.gd-elrow .chip{font-size:13px;padding:4px 12px}
.gd-gloss{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px}
.gd-gloss>div{background:var(--panel);border:1.5px solid var(--line);border-radius:10px;padding:7px 10px;font-size:13px}
.gd-gloss b{display:block}
`;
function ensureGuideCss(){
  if(document.getElementById('guidecss'))return;
  const s=document.createElement('style');s.id='guidecss';s.textContent=GUIDE_CSS;document.head.appendChild(s);
}

/* ------------------------------------------------------------------ ตัวช่วยเล็ก ๆ */
function videoHTML(){
  const u=TUTORIAL_VIDEO.trim();if(!u)return '';
  if(/youtube\.com\/embed\/|youtube-nocookie\.com\/embed\//.test(u))return `<div class="gd-video"><iframe src="${esc(u)}" title="วิดีโอสอนเล่น" allow="accelerometer;encrypted-media;picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  return `<div class="gd-video"><video src="${esc(u)}" controls preload="metadata" playsinline></video></div>`;
}
/* การ์ดจริงจาก card-api (ชี้เพื่อดูการ์ดเต็ม) ถ้าไม่มีการ์ดนี้ในข้อมูล จะไม่แสดง */
function gcard(id,w){
  if(!AF.defs||!AF.defs[id])return '';
  return `<div class="card ${cardArt(id)}" data-pdef="${esc(id)}" title="${esc(AF.defs[id].name)}" style="--cw:${w||92}px"></div>`;
}
function gname(id){return AF.defs&&AF.defs[id]?AF.defs[id].name:id}
/* ป้ายตัวเลขบนภาพ */
const gm=(x,y,n)=>`<circle cx="${x}" cy="${y}" r="11" class="sv-coral"/><text x="${x}" y="${y+4.5}" text-anchor="middle" class="tw b" style="font-size:13px">${n}</text>`;
const GD_DEFS=`<defs><marker id="gd-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--ink)"/></marker></defs>`;
function legend(items){return `<ol class="gd-legend">${items.map(([a,b],i)=>`<li><i>${i+1}</i><div><b>${a}</b>${b}</div></li>`).join('')}</ol>`}

/* ภาพการ์ดจริง (เรนเดอร์จาก BT01.pdf) + ป้ายเลขวางบนภาพ
   marks = [[x%, y%], ...] ตำแหน่งป้ายแต่ละเลข (เปอร์เซ็นต์ของความกว้าง/ความสูงภาพ) เรียงตามรายการคำอธิบาย
   ถ้าเปลี่ยนภาพการ์ด ปรับตัวเลขตำแหน่งในรายการ GUIDE_CARDS ด้านล่างได้เลย */
const GUIDE_IMG='assets/guide/';
function gthumb(file,pdef,alt){return `<img class="gd-thumb" src="${GUIDE_IMG}${file}" data-pdef="${esc(pdef)}" alt="${esc(alt)}" width="720" height="1018" loading="lazy">`}
function cardx(c){
  return `<div class="gd-cardx"><h3>${c.title}</h3><p>${c.intro}</p>
    <div class="gd-cimg"><img src="${GUIDE_IMG}${c.file}" data-pdef="${esc(c.pdef)}" alt="${esc(c.alt)}" width="720" height="1018" loading="lazy">${c.marks.map(([x,y],i)=>`<i style="left:${x}%;top:${y}%">${i+1}</i>`).join('')}</div>
    ${legend(c.items)}</div>`;
}
const GUIDE_CARDS=[
  {title:'Avatar <span class="gd-tag">ตัวแทนของคุณ</span>',file:'card-avatar.jpg',pdef:'SD02-001',alt:'การ์ด Avatar: ธอธ ผู้รักษาภูมิปัญญา',
   intro:'ตัวอย่าง: ธอธ ผู้รักษาภูมิปัญญา (SD02-001) Avatar ไม่มีค่า Cost, ATK, DEF หรือ CRI เพราะไม่ได้ลงสนามไปโจมตี แต่เป็นตัวที่ถ้า HP หมดคุณแพ้',
   marks:[[74,3],[16,9],[50,30],[3.5,46.8],[30,51],[3.5,64],[92,88.4],[45,97.8]],
   items:[
    ['ป้ายประเภท AVATAR','บอกว่าเป็น Avatar แต่ละเด็คมี 1 ใบ ไม่อยู่ในมือหรือ Main Deck แต่วางอยู่ที่ช่อง Avatar ตลอดเกม ในเกมนี้ Avatar เริ่มที่ HP 10 (ไม่ได้พิมพ์บนการ์ด)'],
    ['ธาตุ','ธาตุประจำการ์ด ในภาพคือธาตุพืช'],
    ['ภาพการ์ด','ชี้ที่การ์ดบนสนามเพื่อดูใบเต็มได้ตลอดเกม'],
    ['ข้อความประกอบ (แถบสีเขียว)','คำพูดหรือเรื่องราวของตัวละคร ไม่มีผลต่อเกม'],
    ['เผ่า [ … ]','ข้อความในวงเล็บเหลี่ยมคือเผ่า เอฟเฟกต์ของการ์ดอื่นอ้างถึงได้'],
    ['ความสามารถ','Avatar มีได้หลายความสามารถ นำหน้าด้วย Keyword ในภาพมี AUTO (ทำงานต่อเนื่อง ไม่ต้องกดใช้) และ ACTIVATE 1/turn (คุณกดใช้เอง เทิร์นละครั้ง)'],
    ['ชื่อ Avatar','อยู่ที่แถบสีเขียวด้านล่างของการ์ด'],
    ['รหัสการ์ด','SD02 … 001/019 คือชุด SD02 ใบที่ 1 จากทั้งหมด 19 ใบ ถัดมาเป็นเครดิตภาพ']
   ]},
  {title:'Unit <span class="gd-tag">ลง Action Zone</span>',file:'card-unit.jpg',pdef:'SD02-002',alt:'การ์ด Unit: อาลักษณ์แห่งบันทึกศักดิ์สิทธิ์',
   intro:'ตัวอย่าง: อาลักษณ์แห่งบันทึกศักดิ์สิทธิ์ (SD02-002) Unit คือการ์ดที่มีข้อมูลครบที่สุด มีทั้ง Cost, CRI, ATK และ DEF',
   marks:[[17,5],[13,15],[88,19],[50,30],[25,44.4],[92,51.6],[40,59.4],[95,72],[3.5,91.5],[95,83],[42,97.5]],
   items:[
    ['COST (วงกลมมุมซ้ายบน)','จำนวน Element ที่ต้องจ่ายเพื่อ Invite (อัญเชิญ) Unit ใบนี้ลงสนาม ในภาพคือ 1'],
    ['ธาตุ','ต้องจ่าย Cost ด้วย Element ธาตุนี้เท่านั้น (ธาตุเดียวกับ Unit)'],
    ['CRI (ป้ายมุมขวาบน)','ดาเมจที่ทำกับ HP ของ Avatar เมื่อ Unit ใบนี้โจมตี Avatar สำเร็จ ใบนี้เป็น 0 จึงไม่ทำให้ HP ลด'],
    ['ภาพการ์ด','ชี้ที่การ์ดเพื่อดูใบเต็มได้'],
    ['ป้ายประเภท UNIT','บอกว่าเป็น Unit ลงได้ที่ Action Zone'],
    ['ชื่อการ์ด','อยู่ใต้ภาพ ใช้อ้างอิงในเอฟเฟกต์ และเด็คใส่ชื่อซ้ำได้ไม่เกิน 4 ใบ'],
    ['เผ่า [ … ]','ในภาพคือ “อาลักษณ์” เอฟเฟกต์ของการ์ดอื่นอ้างถึงได้ เช่น Avatar ธอธที่เปิดเจอเผ่านี้แล้วจั่วการ์ด'],
    ['ความสามารถ','นำหน้าด้วย Keyword บอกว่าทำงานตอนไหน ในภาพมี ADVENT (ทำงานตอนลงสนาม) และ ACTIVATE 1/turn (กดใช้เอง เทิร์นละครั้ง)'],
    ['ข้อความประกอบ','คำพูดหรือเรื่องราว ไม่มีผลต่อเกม'],
    ['ATK / DEF (มุมขวาล่าง)','ตัวเลขซ้ายคือ ATK พลังโจมตี ตัวเลขขวาคือ DEF พลังป้องกัน ในภาพคือ ATK 1 / DEF 3 ถ้า ATK ของผู้โจมตีมากกว่าหรือเท่ากับ DEF ของเป้า เป้าถูกทำลาย'],
    ['รหัสการ์ด','ชุดและลำดับของการ์ด']
   ]},
  {title:'Spell · Enchant <span class="gd-tag">ลง Magic Area</span>',file:'card-enchant.jpg',pdef:'SD02-010',alt:'การ์ด Enchant: อ่านสิ่งที่ซ่อนอยู่ระหว่างบรรทัด',
   intro:'ตัวอย่าง: อ่านสิ่งที่ซ่อนอยู่ระหว่างบรรทัด (SD02-010) Spell ไม่มีวงกลม COST และไม่มี ATK/DEF/CRI ค่าใช้จ่ายอยู่ในบรรทัด SpellCost ในกล่องข้อความ',
   marks:[[93,8.5],[14,17],[50,35],[46,51.2],[38,57],[60,61.2],[3,70],[90,88.4],[48,97.8]],
   items:[
    ['ชื่อการ์ด','Spell วางชื่อไว้ที่แถบสีขาวด้านบน (Avatar, Unit และ Ultimate วางชื่อไว้ด้านล่าง)'],
    ['ธาตุ','ธาตุของการ์ด แต่ Spell จ่ายค่าใช้จ่ายด้วย Element ธาตุไหนก็ได้'],
    ['ภาพการ์ด','ชี้ที่การ์ดเพื่อดูใบเต็มได้'],
    ['ป้ายชนิด SPELL | ENCHANT','SPELL คือกลุ่มใหญ่ ส่วนช่องที่สองคือชนิดย่อย ได้แก่ Enchant, Counter, Equipment และ Domain'],
    ['กลุ่ม [ … ]','คล้ายเผ่าของ Unit ในภาพคือ “อักขระเวทมนตร์” เอฟเฟกต์ของการ์ดอื่นอ้างถึงได้'],
    ['SpellCost','ค่าใช้จ่ายของ Spell “Spend 1 Element” คือใช้ Element ธาตุไหนก็ได้ที่ตั้งอยู่ 1 ใบ (Equipment ใช้ EquipCost, Domain ใช้ CastCost)'],
    ['ผลของการ์ด','ใบนี้ลดค่าใช้จ่าย Spell ของคุณลง 1 Element และวางค้างไว้ที่ “Spell Zone” ซึ่งในเกมนี้คือช่อง Magic Area (3 ช่อง) เมื่อจบเทิร์นฝ่ายตรงข้ามต้องทิ้งการ์ดใบนี้และการ์ดบนมืออีก 2 ใบ ถ้าทำไม่ได้จะเสียพลังชีวิต 2 หน่วย'],
    ['ข้อความประกอบ','อยู่ในช่องสีขาวล่างสุด ไม่มีผลต่อเกม'],
    ['รหัสการ์ด','ชุดและลำดับของการ์ด']
   ]},
  {title:'Ultimate <span class="gd-tag">ใช้ใน Ultimate Phase</span>',file:'card-ultimate.jpg',pdef:'SD02-019',alt:'การ์ด Ultimate: การพิพากษาครั้งสุดท้ายของเทพธอธ',
   intro:'ตัวอย่าง: การพิพากษาครั้งสุดท้ายของเทพธอธ (SD02-019) โครงเหมือน Avatar แต่เป็นไม้ตายบนมือ ไม่มี Cost, ATK, DEF หรือ CRI ค่าใช้จ่ายอยู่ในบรรทัด CastCost',
   marks:[[72,3],[16,9],[50,30],[3.5,46.8],[32,51],[60,56],[3,66],[93,88.6],[48,97.8]],
   items:[
    ['ป้ายประเภท Ultimate','ไม้ตายที่เล่นจากมือ ใช้ได้เฉพาะ Ultimate Phase (หลัง Attack Phase)'],
    ['ธาตุ','ธาตุของการ์ด'],
    ['ภาพการ์ด','ชี้ที่การ์ดเพื่อดูใบเต็มได้'],
    ['ข้อความประกอบ (แถบสีเขียว)','คำพูดหรือเรื่องราว ไม่มีผลต่อเกม'],
    ['กลุ่ม [ … ]','ในภาพคือ “ปรากฏการณ์” เอฟเฟกต์ของการ์ดอื่นอ้างถึงได้'],
    ['CastCost','ค่าใช้จ่ายของ Ultimate “Spend 3 Element” คือต้องมี Element ตั้งอยู่ 3 ใบ ซึ่งสูงกว่า Spell ทั่วไป'],
    ['ความสามารถ','ไม้ตายจะมีผลกระทบค่อนข้างสูงและมีผลต่อเกมและสามารถร่ายได้ในช่วง Ultimate Phase เท่านั้น'],
    ['ชื่อการ์ด','อยู่ที่แถบสีเขียวด้านล่าง'],
    ['รหัสการ์ด','ชุดและลำดับของการ์ด']
   ]}
];

/* ------------------------------------------------------------------ ภาพประกอบ (SVG) */
/* กระดานฝั่งของคุณ */
function svgBoard(){
  const slot=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="sv-slot"/>`;
  const three=(x,y)=>slot(x,y,40,56)+slot(x+48,y,40,56)+slot(x+96,y,40,56);
  return `<svg class="gd-svg" viewBox="0 0 780 500" role="img" aria-label="สนามฝั่งของคุณและตำแหน่งโซนต่าง ๆ">${GD_DEFS}
  <rect x="8" y="8" width="764" height="484" rx="16" class="sv-zone"/>
  <rect x="24" y="22" width="150" height="26" rx="13" class="sv-card"/><text x="99" y="40" text-anchor="middle" style="font-size:12px">Element Deck 7</text>
  <rect x="186" y="22" width="150" height="26" rx="13" class="sv-card"/><text x="238" y="40" text-anchor="middle" style="font-size:12px">Element 2/3</text>
  <circle cx="294" cy="35" r="7" class="sv-teal2"/><circle cx="314" cy="35" r="7" class="sv-teal2"/><circle cx="334" cy="35" r="7" style="fill:var(--soft);stroke:var(--line);stroke-width:1.5"/>
  <rect x="348" y="22" width="100" height="26" rx="13" class="sv-card"/><text x="398" y="40" text-anchor="middle" style="font-size:12px">มือ 7 ใบ</text>
  <rect x="24" y="62" width="732" height="170" rx="12" class="sv-teal"/>
  <text x="390" y="82" text-anchor="middle" class="b" style="fill:var(--coral);font-size:13px">Action Zone · Unit 4 ช่อง</text>
  <rect x="226" y="94" width="76" height="106" rx="8" class="sv-card"/><text x="264" y="146" text-anchor="middle" style="font-size:11px">Unit</text><text x="264" y="162" text-anchor="middle" class="t2" style="font-size:10px">ตั้ง (Stand)</text>
  <g transform="rotate(90 372 147)"><rect x="334" y="94" width="76" height="106" rx="8" class="sv-card"/></g><text x="372" y="144" text-anchor="middle" style="font-size:11px">Unit</text><text x="372" y="160" text-anchor="middle" class="t2" style="font-size:10px">นอน (Rest)</text>
  ${slot(450,94,76,106)}${slot(556,94,76,106)}
  <rect x="24" y="258" width="170" height="124" rx="12" class="sv-card"/><text x="109" y="276" text-anchor="middle" class="b" style="fill:var(--coral);font-size:12px">Magic Area</text>${three(33,292)}
  <polygon points="262,262 296,282 296,322 262,342 228,322 228,282" class="sv-teal"/><text x="262" y="308" text-anchor="middle" class="b" style="font-size:12px">Avatar</text>
  <text x="262" y="366" text-anchor="middle" class="b" style="font-size:14px">HP 10</text>
  <rect x="225" y="373" width="74" height="7" rx="3" class="sv-good"/>
  <rect x="328" y="258" width="170" height="124" rx="12" class="sv-card"/><text x="413" y="276" text-anchor="middle" class="b" style="fill:var(--coral);font-size:12px">Domain</text>${three(337,292)}
  <rect x="560" y="276" width="52" height="74" rx="6" class="sv-line" style="fill:var(--ink)"/><text x="586" y="318" text-anchor="middle" class="tw b" style="font-size:10px">AVAST</text>
  <text x="586" y="264" text-anchor="middle" class="b" style="fill:var(--coral);font-size:12px">Main Deck</text><circle cx="612" cy="282" r="13" class="sv-coral"/><text x="612" y="287" text-anchor="middle" class="tw b" style="font-size:12px">52</text>
  <text x="690" y="264" text-anchor="middle" class="b" style="fill:var(--coral);font-size:12px">กองทิ้ง</text>${slot(664,276,52,74)}
  <text x="690" y="318" text-anchor="middle" class="t2" style="font-size:10px">ว่าง</text>
  ${[0,1,2,3,4,5,6].map(i=>`<rect x="${190+i*56}" y="404" width="48" height="68" rx="6" class="sv-card"/>`).join('')}
  <text x="100" y="442" text-anchor="middle" class="b" style="font-size:13px">การ์ดบนมือ</text><text x="100" y="460" text-anchor="middle" class="t2" style="font-size:11px">อยู่ใต้กระดาน เห็นเฉพาะคุณ</text>
  ${gm(24,35,7)}${gm(186,35,7)}${gm(36,76,2)}${gm(36,272,3)}${gm(240,262,1)}${gm(340,272,4)}${gm(544,296,5)}${gm(650,296,6)}${gm(190,418,8)}
  </svg>`;
}
/* ตั้ง / นอน + Element */
function svgStandRest(){
  const tok=(x,y,on)=>`<circle cx="${x}" cy="${y}" r="13" style="fill:${on?'var(--teal)':'var(--soft)'};stroke:var(--line);stroke-width:2"/>${on?'':`<path d="M${x-5} ${y}h10" class="sv-line"/>`}`;
  return `<svg class="gd-svg" viewBox="0 0 780 210" role="img" aria-label="การ์ดตั้งและนอน และ Element ที่ใช้แล้ว">${GD_DEFS}
  <text x="20" y="26" class="b" style="font-size:14px">Unit: ตั้ง → นอน → ตั้งกลับ</text>
  <rect x="40" y="78" width="64" height="90" rx="8" class="sv-card"/><text x="72" y="128" text-anchor="middle" style="font-size:11px">Unit</text>
  <text x="72" y="190" text-anchor="middle" class="b" style="font-size:12px">Stand (ตั้ง)</text><text x="72" y="206" text-anchor="middle" class="t2" style="font-size:10.5px">พร้อมโจมตี/ใช้งาน</text>
  <path d="M116 123h60" class="sv-arrow"/><text x="146" y="113" text-anchor="middle" class="t2" style="font-size:10.5px">โจมตี</text>
  <g transform="rotate(90 232 123)"><rect x="200" y="78" width="64" height="90" rx="8" class="sv-card" style="fill:var(--soft)"/></g><text x="232" y="127" text-anchor="middle" style="font-size:11px">Unit</text>
  <text x="232" y="190" text-anchor="middle" class="b" style="font-size:12px">Rest (นอน)</text><text x="232" y="206" text-anchor="middle" class="t2" style="font-size:10.5px">ใช้ไปแล้วในเทิร์นนี้</text>
  <path d="M232 76C232 40 72 40 72 74" class="sv-arrow"/><text x="152" y="62" text-anchor="middle" class="t2" style="font-size:10.5px">Start Phase ของเรา</text>
  <text x="440" y="26" class="b" style="font-size:14px">Element: ตั้ง = พร้อมจ่าย · นอน = จ่ายไปแล้ว</text>
  ${tok(466,86,true)}${tok(500,86,true)}${tok(534,86,true)}${tok(568,86,true)}
  <text x="517" y="118" text-anchor="middle" class="t2" style="font-size:11px">ต้นเทิร์น: ตั้งครบ 4 ใบ</text>
  <path d="M600 86h40" class="sv-arrow"/><text x="620" y="76" text-anchor="middle" class="t2" style="font-size:10.5px">Spend 2</text>
  ${tok(664,86,true)}${tok(698,86,true)}${tok(732,86,false)}${tok(766,86,false)}
  <text x="715" y="118" text-anchor="middle" class="t2" style="font-size:11px">เหลือ 2 ใบ ที่จ่ายต่อได้</text>
  <text x="440" y="160" style="font-size:12px">ธาตุ 6 แบบ: พืช · ทอง · ดิน · มืด · น้ำ · ไฟ</text>
  <text x="440" y="180" class="t2" style="font-size:11px">เหลือ Element ตั้งอยู่เท่าไร ดูจากช่อง “Element x/y” บนหัวฝั่งของคุณ</text>
  </svg>`;
}
/* ลำดับเทิร์น */
function svgTurn(){
  const names=[['Start','ตั้งทุกใบ',0],['Draw','จั่ว + Element',0],['Main','ลง/ใช้การ์ด',1],['Attack','โจมตี',1],['Ultimate','ไม้ตาย',1],['End','จบเทิร์น',0]];
  const w=124;
  return `<svg class="gd-svg" viewBox="0 0 780 124" role="img" aria-label="ลำดับ 6 เฟสในหนึ่งเทิร์น">
  ${names.map(([a,b,pl],i)=>{const x=10+i*w;return `<polygon points="${x},20 ${x+w-14},20 ${x+w},56 ${x+w-14},92 ${x},92 ${x+14},56" class="${pl?'sv-coral':'sv-soft'}"/><text x="${x+w/2}" y="52" text-anchor="middle" class="b ${pl?'tw':''}" style="font-size:15px">${a}</text><text x="${x+w/2}" y="72" text-anchor="middle" class="${pl?'tw':'t2'}" style="font-size:11.5px">${b}</text>`}).join('')}
  <text x="10" y="114" class="t2" style="font-size:11px">สีเทา = ระบบทำให้อัตโนมัติ · สีแดง = ถึงตาคุณเลือกทำ</text>
  </svg>`;
}
/* ชีวิตของ Unit: มือ → สนาม → กองทิ้ง */
function svgLifecycle(){
  const box=(x,w,t,s)=>`<rect x="${x}" y="46" width="${w}" height="58" rx="10" class="sv-card"/><text x="${x+w/2}" y="72" text-anchor="middle" class="b" style="font-size:14px">${t}</text><text x="${x+w/2}" y="90" text-anchor="middle" class="t2" style="font-size:11px">${s}</text>`;
  const chip=(x,y,w,t,c)=>`<rect x="${x}" y="${y}" width="${w}" height="20" rx="6" class="${c}"/><text x="${x+w/2}" y="${y+14}" text-anchor="middle" class="${c==='sv-gold'?'':'tw'} b" style="font-size:11px">${t}</text>`;
  return `<svg class="gd-svg" viewBox="0 0 780 190" role="img" aria-label="เส้นทางของ Unit ตั้งแต่บนมือจนถึงกองทิ้ง และจังหวะที่ keyword ทำงาน">${GD_DEFS}
  ${box(14,120,'บนมือ','Hand')}${box(330,150,'Action Zone','บนสนาม')}${box(650,116,'กองทิ้ง','Discard')}
  <path d="M138 75h186" class="sv-arrow"/><text x="231" y="66" text-anchor="middle" class="t2" style="font-size:11px">Invite (จ่าย Element ตรงธาตุ)</text>
  <path d="M484 75h160" class="sv-arrow"/><text x="564" y="66" text-anchor="middle" class="t2" style="font-size:11px">ถูกทำลาย</text>
  ${chip(14,12,132,'ANNOUNCE [บนมือ]','sv-gold')}
  ${chip(256,116,76,'ADVENT','sv-teal2')}
  ${chip(342,116,84,'ACTIVATE','sv-gold')}${chip(430,116,52,'AUTO','sv-coral')}
  ${chip(548,116,84,'ADMONISH','sv-coral')}
  ${chip(634,12,136,'ANNOUNCE [กองทิ้ง]','sv-gold')}
  <text x="14" y="168" style="font-size:12px"><tspan class="b">ADVENT</tspan> ทำงานตอนเข้าสนาม · <tspan class="b">ADMONISH</tspan> ทำงานตอนถูกทำลายลงกองทิ้ง · <tspan class="b">ANNOUNCE</tspan> ใช้ได้ตอนอยู่บนมือ/กองทิ้ง</text>
  <text x="14" y="184" class="t2" style="font-size:11px">ACTIVATE กดใช้เอง · AUTO ทำงานเองเมื่อเงื่อนไขตรง ทั้งสองอยู่ได้ตลอดที่การ์ดอยู่บนสนาม</text>
  </svg>`;
}
/* การโจมตี 3 กรณี */
function svgAttack(){
  const mini=(x,y,t,c)=>`<rect x="${x}" y="${y}" width="58" height="80" rx="7" class="${c||'sv-card'}"/><text x="${x+29}" y="${y+26}" text-anchor="middle" class="b" style="font-size:12px">${t}</text>`;
  return `<svg class="gd-svg" viewBox="0 0 780 232" role="img" aria-label="ผลการโจมตีทั้ง 3 กรณี">${GD_DEFS}
  <text x="14" y="24" class="b" style="font-size:13.5px">① ATK ≥ DEF</text>
  ${mini(24,48,'ATK 3','sv-coral')}<path d="M92 88h50" class="sv-arrow"/>${mini(150,48,'DEF 2')}
  <path d="M160 86l38 34M198 86l-38 34" style="stroke:var(--bad);stroke-width:5;stroke-linecap:round"/>
  <text x="112" y="152" text-anchor="middle" class="b" style="font-size:12.5px;fill:var(--bad)">3 ≥ 2 → เป้าถูกทำลาย</text>
  <text x="112" y="170" text-anchor="middle" class="t2" style="font-size:11px">ลงกองทิ้ง (ADMONISH ทำงานถ้ามี)</text>
  <text x="274" y="24" class="b" style="font-size:13.5px">② ATK &lt; DEF</text>
  ${mini(284,48,'ATK 1','sv-coral')}<path d="M352 88h50" class="sv-arrow"/>${mini(410,48,'DEF 3','sv-teal2')}
  <text x="372" y="152" text-anchor="middle" class="b" style="font-size:12.5px">1 &lt; 3 → ไม่เกิดอะไรขึ้น</text>
  <text x="372" y="170" text-anchor="middle" class="t2" style="font-size:11px">Unit ที่โจมตีก็ยังนอนลงอยู่ดี</text>
  <text x="534" y="24" class="b" style="font-size:13.5px">③ โจมตี Avatar</text>
  ${mini(544,48,'CRI 2','sv-gold')}<path d="M612 88h40" class="sv-arrow"/>
  <polygon points="700,52 728,68 728,102 700,118 672,102 672,68" class="sv-teal"/><text x="700" y="90" text-anchor="middle" class="b" style="font-size:11px">Avatar</text>
  <text x="640" y="152" text-anchor="middle" class="b" style="font-size:12.5px;fill:var(--bad)">HP 10 → 8</text>
  <text x="640" y="170" text-anchor="middle" class="t2" style="font-size:11px">ดาเมจ = CRI ของ Unit ที่โจมตี</text>
  <text x="14" y="206" style="font-size:12px">ทุกครั้งที่โจมตี Unit ผู้โจมตีจะ “นอน” · ตีเข้า Avatar ได้เมื่อฝ่ายตรงข้ามไม่มี Unit หรือทุกใบนอนอยู่</text>
  <text x="14" y="222" class="t2" style="font-size:11px">Unit ที่เพิ่งลงสนามในเทิร์นนี้ยังโจมตีไม่ได้ (ยกเว้นการ์ดที่เขียนว่าทำได้)</text>
  </svg>`;
}
/* Counter / ลำดับการทำงาน */
function svgCounter(){
  return `<svg class="gd-svg" viewBox="0 0 780 214" role="img" aria-label="ขั้นตอนการใช้ Counter และลำดับการทำงานของเอฟเฟกต์">${GD_DEFS}
  <text x="14" y="24" class="b" style="font-size:13.5px">① คู่ต่อสู้ทำบางอย่าง</text>
  <rect x="26" y="40" width="58" height="80" rx="7" class="sv-coral"/><text x="55" y="84" text-anchor="middle" class="tw b" style="font-size:11px">ประกาศ<tspan x="55" dy="14">โจมตี</tspan></text>
  <text x="14" y="146" class="t2" style="font-size:11px">โจมตี / ใช้ความสามารถ</text><text x="14" y="161" class="t2" style="font-size:11px">Unit / ร่าย Spell</text>
  <path d="M100 82h44" class="sv-arrow"/>
  <text x="168" y="24" class="b" style="font-size:13.5px">② เกมถามคุณ: ใช้ Counter ไหม?</text>
  <rect x="190" y="40" width="58" height="80" rx="7" class="sv-teal2"/><text x="219" y="84" text-anchor="middle" class="tw b" style="font-size:11px">Counter<tspan x="219" dy="14">บนมือ</tspan></text>
  <circle cx="276" cy="56" r="9" class="sv-teal2"/><circle cx="298" cy="56" r="9" class="sv-teal2"/>
  <text x="166" y="146" class="t2" style="font-size:11px">จ่ายด้วย Element ที่เหลือตั้งอยู่</text><text x="166" y="161" class="t2" style="font-size:11px">จากเทิร์นตัวเอง (ไม่ต้องเป็นตาเรา)</text>
  <path d="M330 82h44" class="sv-arrow"/>
  <text x="396" y="24" class="b" style="font-size:13.5px">③ ทำงานย้อนจากใบสุดท้าย</text>
  <rect x="400" y="40" width="168" height="40" rx="8" class="sv-teal2"/><text x="484" y="65" text-anchor="middle" class="tw b" style="font-size:12.5px">Counter ของคุณ — ทำก่อน</text>
  <rect x="400" y="86" width="168" height="40" rx="8" class="sv-coral"/><text x="484" y="111" text-anchor="middle" class="tw b" style="font-size:12.5px">การโจมตี — ทำทีหลัง</text>
  <path d="M584 60v54" class="sv-arrow"/><text x="596" y="90" class="t2" style="font-size:11px">ลำดับ</text>
  <text x="640" y="52" style="font-size:12px">ตอบโต้ซ้อนกันได้</text><text x="640" y="70" class="t2" style="font-size:11px">อีกฝ่ายตอบ Counter ของคุณ</text><text x="640" y="85" class="t2" style="font-size:11px">ซ้ำได้ ใบหลังสุดทำก่อนเสมอ</text>
  <text x="14" y="200" style="font-size:12px">Counter ที่ยังไม่จบผลจะวางใน Magic Area (มี 3 ช่อง) ถ้าเต็มจะร่ายเพิ่มไม่ได้</text>
  </svg>`;
}

/* ------------------------------------------------------------------ ข้อมูล Keyword */
function kwList(){
  return [
    {id:'advent',cls:'k-adv',name:'ADVENT',when:'ตอนที่ Unit ลงมาที่ Action Zone',
     what:'ความสามารถที่ทำงานทันทีเมื่อ Unit ใบนั้นเข้าสู่สนาม ไม่ว่าคุณจะ Invite จากมือหรือถูกเอฟเฟกต์อัญเชิญลงมา ใช้ได้เฉพาะตอนเข้าสนามเท่านั้น ถ้าโดนทำลายแล้วอัญเชิญใหม่ ADVENT จะทำงานอีกครั้ง เป้าหมายจะถูกเลือกก่อนที่คู่ต่อสู้จะได้ตอบโต้',
     ex:['SD01-004']},
    {id:'admonish',cls:'k-adm',name:'ADMONISH',when:'ตอน Unit ถูกทำลายและลงกองทิ้ง',
     what:'ความสามารถ “ทิ้งท้าย” ทำงานเมื่อ Unit ใบนั้นถูกทำลายแล้วไปอยู่ในกองทิ้ง ไม่ทำงานถ้า Unit ถูกเอฟเฟกต์ส่งกลับขึ้นมือแทน หรือถูกปิดความสามารถอยู่',
     ex:['SD01-003']},
    {id:'auto',cls:'k-auto',name:'AUTO',when:'อัตโนมัติ เมื่อเงื่อนไขตรงตามข้อความ',
     what:'ความสามารถที่ไม่ต้องกดใช้ มี 2 แบบ คือ “ทำงานเองตอนเกิดเหตุการณ์” เช่น เมื่อ Unit นี้โจมตี หรือ “มีผลต่อเนื่อง” ตลอดที่การ์ดอยู่บนสนาม ถ้าข้อความเขียนว่า “คุณต้อง…” (เช่นต้องทิ้งการ์ด) เกมจะถามให้คุณทำตามนั้น และถ้าทำไม่ได้จะถือว่าเงื่อนไขไม่สำเร็จตามที่การ์ดเขียนไว้',
     ex:['SD01-002']},
    {id:'activate',cls:'k-act',name:'ACTIVATE · ACTIVATE 1/turn',when:'คุณเลือกกดใช้เองใน Main Phase',
     what:'ความสามารถที่คุณกดใช้เอง คลิก Avatar, Unit, Equipment หรือ Domain ที่มีความสามารถนี้ในช่วง Main Phase แล้วเลือกรายการที่ขึ้นต้นด้วย “ACTIVATE:” ค่าใช้จ่ายอยู่ในวงเล็บเหลี่ยม เช่น [Spend 2 Element] ส่วน 1/turn หมายถึงใช้ได้ 1 ครั้งต่อเทิร์นต่อการ์ด 1 ใบ ฝ่ายตรงข้ามตอบโต้ด้วย Counter ได้ ถ้าไม่มี “1/turn” จะใช้ซ้ำได้ตามที่ค่าใช้จ่ายและเงื่อนไขในข้อความอนุญาต',
     ex:['SD01-001']},
    {id:'announce',cls:'k-ann',name:'ANNOUNCE [โซน]',when:'ใช้ได้ขณะการ์ดอยู่นอกสนาม ตามโซนในวงเล็บเหลี่ยม',
     what:'ความสามารถที่ใช้จากโซนอื่นที่ไม่ใช่ Action Zone โดยวงเล็บบอกว่าโซนไหน เช่น [บนมือ] ใช้ได้ตอนการ์ดอยู่บนมือ หรือ [กองทิ้ง] ใช้ได้ตอนอยู่ในกองทิ้ง (คลิกกองทิ้งเพื่อเปิดดู แล้วกดปุ่มที่การ์ดใบนั้น ส่วน [บนมือ] คลิกการ์ดบนมือแล้วเลือกรายการที่ขึ้นต้นด้วย “ANNOUNCE:”) มักเป็นการ์ดที่ไม่ได้ลงสนามด้วยวิธีปกติ เช่น อัญเชิญจากกองทิ้งโดยไม่ต้องจ่าย Cost',
     ex:['SD03-004','SD03-009']},
    {id:'counter',cls:'k-ctr',name:'Counter',when:'ตอนคู่ต่อสู้ทำบางอย่าง ในเทิร์นของเขา',
     what:'การ์ด Spell ชนิดตอบโต้ เล่นจากมือใน Main Phase ไม่ได้ ต้องรอจังหวะที่เกมถามว่า “ใช้ Counter ไหม?” คือตอนที่คู่ต่อสู้ประกาศโจมตี ใช้ความสามารถ หรือร่าย Spell จ่ายด้วย Element ที่ยังตั้งอยู่ ผลทำงานก่อนสิ่งที่ถูกตอบโต้ และตอบซ้อนกันได้ บางการ์ดนับจำนวน “ครั้งที่ใช้ Counter สำเร็จในเทิร์นนี้” เป็นเงื่อนไข',
     ex:['SD02-013']},
    {id:'cost',cls:'k-cost',name:'COST · SpellCost · EquipCost · CastCost',when:'บรรทัดค่าใช้จ่ายของ Spell และ Ultimate',
     what:'บอกว่าต้องจ่ายอะไรเพื่อใช้การ์ด SpellCost ใช้กับ Enchant และ Counter, EquipCost ใช้กับ Equipment, CastCost ใช้กับ Domain และ Ultimate ส่วนใหญ่เขียนว่า “Spend N Element” คือใช้ Element ธาตุอะไรก็ได้ที่ตั้งอยู่ N ใบ (นอนลง) บางใบจ่ายด้วย “พลังชีวิต N หน่วย” คือเสีย HP ของ Avatar ตามที่ระบุ',
     ex:['SD01-013','SD04-013']},
    {id:'doublestrike',cls:'k-ds',name:'DoubleStrike',when:'หลัง Unit โจมตีเสร็จ',
     what:'หลังโจมตีแล้ว Unit กลับเป็นสภาพตั้งและโจมตีได้อีก 1 ครั้งในเทิร์นเดียวกัน (ได้ 1 รอบเพิ่มต่อเทิร์น) การ์ดบางใบได้ DoubleStrike ผ่านความสามารถ ACTIVATE ต้องใช้ก่อนโจมตี',
     ex:['SD03-009']},
    {id:'taunt',cls:'k-tn',name:'“ต้องทำลายก่อนเสมอ”',when:'ผลต่อเนื่องของ Unit บนสนาม',
     what:'Unit ที่มีข้อความนี้เป็นเป้าที่ฝ่ายตรงข้ามต้องจัดการก่อน ตราบใดที่มันอยู่บนสนาม ฝ่ายตรงข้ามจะโจมตี Avatar ไม่ได้ และต้องเลือกโจมตี Unit ใบนั้นก่อน (ถ้าโจมตีไม่ผ่านก็ต้องหาทางทำลายมันด้วยวิธีอื่น)',
     ex:['SD04-013']},
    {id:'equip',cls:'k-gen',name:'สวมใส่ (Equip)',when:'ร่าย Equipment ใน Main Phase',
     what:'Equipment ติดอยู่กับ Unit บนสนาม โดยปกติ Unit 1 ใบสวมใส่ได้ 1 ใบ (การ์ดบางใบเขียนว่าสวมเพิ่มได้) บางใบจำกัดเฉพาะ Unit ชื่อที่ระบุ ค่า ATK/DEF ที่เพิ่มให้ใช้กับ Unit ที่สวม เมื่อ Unit ออกจากสนาม Equipment ก็ออกไปด้วย เว้นแต่การ์ดเขียนไว้ว่ากลับขึ้นมือ',
     ex:['SD01-017']},
    {id:'ult',cls:'k-gen',name:'Ultimate',when:'ใช้ใน Ultimate Phase เท่านั้น',
     what:'ไม้ตายบนมือ ใช้ได้เฉพาะ Ultimate Phase ตอนที่ Element ตั้งอยู่พอจ่าย CastCost และเงื่อนไขบนการ์ดครบ ถ้ายังไม่พอ เกมจะข้ามเฟสนี้ให้',
     ex:['SD01-019']}
  ];
}
function kwHTML(k){
  const ex=(k.ex||[]).filter(id=>AF.defs&&AF.defs[id]);
  return `<article class="gd-kw" id="kw-${k.id}"><header><span class="kwb ${k.cls}">${k.name}</span><span class="when">${k.when}</span></header>
  <div class="body"><p>${k.what}</p></div>
  ${ex.length?`<div class="ex">${ex.map(id=>`<div>${gcard(id,70)}<small>${esc(gname(id))}</small></div>`).join('')}</div>`:''}</article>`;
}

/* ------------------------------------------------------------------ หน้าวิธีเล่น */
function guideHTML(){
  ensureGuideCss();
  const toc=[['gd-goal','เป้าหมาย'],['gd-setup','เตรียมเกม'],['gd-card','การ์ดมีอะไรบ้าง'],['gd-kinds','ชนิดการ์ด'],['gd-field','สนาม'],['gd-element','Element'],['gd-turn','เทิร์น'],['gd-play','เล่นการ์ดยังไง'],['gd-attack','โจมตี'],['gd-counter','Counter'],['gd-keywords','Keyword'],['gd-screen','อ่านหน้าจอ'],['gd-first','ลองเล่นรอบแรก']];
  const phases=[
    ['Start','ตั้ง Unit และ Element ที่นอนอยู่ให้ตั้งขึ้นทั้งหมด'],
    ['Draw','จั่วการ์ด 1 ใบ และรับ Element 1 ใบจาก Element Deck (ผู้เล่นคนแรกเทิร์นแรกจั่วเพิ่ม 1 ใบแทนการรับ Element)'],
    ['Main','ลงการ์ด อัญเชิญ Unit ใช้ความสามารถ ทำได้กี่อย่างก็ได้ตามที่ Element พอ Unit ที่ลงเทิร์นนี้ยังโจมตีไม่ได้'],
    ['Attack','ให้ Unit ที่ตั้งอยู่โจมตี โจมตีได้หลายครั้งถ้ามี Unit หลายใบ'],
    ['Ultimate','ใช้การ์ด Ultimate ถ้า Element และเงื่อนไขครบ'],
    ['End','จบเทิร์น เอฟเฟกต์ “จนจบเทิร์น” หมดผล ส่งต่อให้อีกฝ่าย']
  ];
  const first=[
    'กดแท็บ "เล่น" เลือกโหมด "เล่นกับบอท" และเลือกเด็คตัวอย่างให้ทั้งสองฝั่ง',
    'กดเริ่มเกม ระบบจะแจกการ์ดให้ 6 ใบ ดูมือของคุณที่ด้านล่างของจอ จะเปลี่ยนมือใหม่ได้ 1 ครั้งถ้าไม่พอใจ',
    'ใน Main Phase คลิก Unit ที่ Cost ต่ำบนมือ (ใบที่เรืองแสงคือเล่นได้) แล้วเลือก “อัญเชิญ …” โดยใช้ Element ธาตุตรงกับ Unit',
    'กดปุ่ม "ไป Attack Phase" ถ้าไม่มี Unit ที่โจมตีได้ เกมจะผ่านเฟสให้ รอบอทเล่น แล้วเทิร์นถัดไป Unit ที่ลงไว้จะโจมตีได้',
    'เลือก Unit ที่ตั้งอยู่ แล้วคลิกเป้าหมายสีแดง ถ้าฝั่งตรงข้ามไม่มี Unit ตั้งอยู่ ตีเข้า Avatar ได้เลย',
    'ลองเล่นจนจบเกม ถ้าสงสัยจุดไหน กดปุ่ม "กติกา" บนหน้าเกม ชี้การ์ดเพื่ออ่านข้อความเต็ม หรือ "ส่งข้อเสนอแนะ" บอกเราได้'
  ];
  const elIcons=Object.keys(ELEMENTS).map(n=>`<span class="chip">${elIcon(n,16)} ${n}</span>`).join('');
  return `${navHTML()}
  <div class="hero"><span class="ot-badge"><i></i>วิธีเล่น · สอนเล่นตั้งแต่ต้น</span><h1>เริ่มเล่น AvastFall TCG</h1><p class="muted">อ่านจบแล้วลองเล่นกับบอทได้ทันที หน้านี้อธิบายตั้งแต่ว่าการ์ดแต่ละใบมีอะไร สนามมีอะไร เล่นการ์ดยังไง ไปจนถึง Keyword ทุกตัว ถ้าติดตรงไหนระหว่างเล่น กดปุ่ม "กติกา" บนหน้าเกมเปิดดูย่อ ๆ ได้ตลอด</p>
  <nav class="gd-toc" aria-label="สารบัญ">${toc.map(([id,t],i)=>`<a href="#${id}">${i+1}. ${t}</a>`).join('')}</nav>
  <div class="ot-cta"><button class="btn pri" data-act="page" data-v="play">ไปลองเล่นเลย</button></div></div>
  ${videoHTML()}

  <section class="gd" id="gd-goal"><h2>1. เป้าหมายของเกม</h2>
    <p>ใช้ Unit โจมตีให้ HP ของ Avatar ฝ่ายตรงข้ามจาก 10 เหลือ 0 ก่อน ส่วนอีกทางที่แพ้ได้คือ Main Deck หมด ถ้าถึงช่วง Draw Phase แล้วจั่วการ์ดไม่ได้ คุณแพ้ทันที ถ้า HP ของทั้งสองฝ่ายหมดพร้อมกันหรือเล่นครบ 120 เทิร์น ผลคือเสมอ</p>
    <div class="gd-grid"><div class="note"><b>ชนะ</b><br>HP Avatar ฝ่ายตรงข้ามเหลือ 0</div><div class="note"><b>แพ้</b><br>HP Avatar ของคุณเหลือ 0 หรือจั่วการ์ดประจำเทิร์นไม่ได้เพราะเด็คหมด</div></div>
  </section>

  <section class="gd" id="gd-setup"><h2>2. เตรียมเกม</h2>
    <ol class="gd-steps">
      <li><div><b>เด็คของแต่ละคน</b><br>เด็คหลัก 60 ใบ (รวม Avatar 1 ใบ) ชื่อซ้ำได้ไม่เกิน 4 ใบ และ Element Deck แยกอีก 8 ใบ Avatar วางคว่ำไว้ก่อน อีก 59 ใบคือ Main Deck</div></li>
      <li><div><b>สุ่มผู้เล่นคนแรก</b><br>ระบบสุ่มให้ (เลือกเองได้ในหน้าตั้งค่า)</div></li>
      <li><div><b>จั่วมือเริ่มต้น 6 ใบ และเปลี่ยนมือได้ 1 ครั้ง</b><br>ถ้าไม่พอใจ ใบทั้งหมดจะไปอยู่ใต้เด็ค แล้วจั่วใหม่ 6 ใบ (Mulligan)</div></li>
      <li><div><b>รับ Element ใบแรก และหงายหน้า Avatar</b><br>ทั้งสองฝั่งได้ Element 1 ใบจาก Element Deck ก่อนเริ่ม แล้วเทิร์นแรกก็เริ่มต้น</div></li>
    </ol>
  </section>

  <section class="gd" id="gd-card"><h2>3. การ์ดหนึ่งใบมีอะไรบ้าง</h2>
    <p>การ์ดแต่ละชนิดมีข้อมูลไม่เท่ากัน ข้างล่างคือการ์ดจริง 4 ใบ พร้อมป้ายตัวเลขบนภาพที่ตรงกับรายการคำอธิบายข้าง ๆ ชี้หรือแตะภาพเพื่อดูการ์ดเต็ม</p>
    ${GUIDE_CARDS.map(cardx).join('')}
    <p class="muted">Counter, Equipment และ Domain เป็น Spell เช่นกัน จัดวางข้อมูลคล้าย Enchant ต่างกันที่ชนิดย่อยบนป้ายและชื่อค่าใช้จ่าย (SpellCost, EquipCost, CastCost)</p>
  </section>

  <section class="gd" id="gd-kinds"><h2>4. ชนิดของการ์ด และไว้ทำอะไร</h2>
    <p>ชี้ที่การ์ดตัวอย่างเพื่อดูการ์ดเต็ม ส่วนรายละเอียดว่าแต่ละส่วนบนการ์ดคืออะไร ดูที่หัวข้อ 3</p>
    <div class="gd-kinds">
      <div class="gd-kind">${gthumb('card-avatar.jpg','SD02-001','Avatar')}<div><h3>Avatar <span class="gd-tag">1 ใบต่อเด็ค</span></h3><p>ตัวแทนของคุณ มี HP 10 ไม่ได้อยู่ในมือหรือเด็ค แต่อยู่ในช่อง Avatar ตลอดเกม ถ้า HP เหลือ 0 คุณแพ้ บางตัวมีความสามารถ ACTIVATE ให้คลิกใช้ได้ใน Main Phase</p></div></div>
      <div class="gd-kind">${gthumb('card-unit.jpg','SD02-002','Unit')}<div><h3>Unit <span class="gd-tag">ลง Action Zone</span></h3><p>ตัวละครที่ลงสนามไปโจมตีและป้องกัน เป็นตัวหลักของเกม</p><ul><li>มีค่า Cost, ATK, DEF, CRI และเผ่า</li><li>Invite ด้วย Element ธาตุตรงกับ Unit จำนวนเท่า Cost</li><li>วางได้ 4 ช่องใน Action Zone ถ้าเต็มต้องลงเพิ่มไม่ได้</li><li>ลงแล้วอยู่ในสภาพตั้ง แต่เทิร์นที่ลงยังโจมตีไม่ได้</li></ul></div></div>
      <div class="gd-kind">${gthumb('card-enchant.jpg','SD02-010','Enchant')}<div><h3>Enchant <span class="gd-tag">Spell · Magic Area</span></h3><p>เวทใช้ใน Main Phase จ่าย SpellCost แล้วเกิดผลตามข้อความ การ์ดที่ผลยังไม่จบจะค้างอยู่ใน Magic Area (3 ช่อง ในข้อความการ์ดเรียกว่า Spell Zone) ผลหมดแล้วลงกองทิ้ง ถ้า Magic Area เต็มจะร่าย Enchant เพิ่มไม่ได้</p></div></div>
      <div class="gd-kind">${gcard('SD02-013')}<div><h3>Counter <span class="gd-tag">Spell · ตอบโต้</span></h3><p>Spell ที่ใช้ตอบโต้ในเทิร์นฝ่ายตรงข้ามเท่านั้น เช่น เพิ่ม DEF ให้ Unit ที่ถูกโจมตี หรือยกเลิก Spell ของเขา ดูหัวข้อ 10 และ Keyword “Counter”</p></div></div>
      <div class="gd-kind">${gcard('SD01-017')}<div><h3>Equipment <span class="gd-tag">Spell · ติดกับ Unit</span></h3><p>อุปกรณ์ที่ติดกับ Unit บนสนาม ให้ ATK/DEF เพิ่มหรือความสามารถใหม่แก่ Unit ที่สวม โดยปกติ Unit 1 ใบสวมได้ 1 ใบ ถ้า Unit ใบนั้นถูกทำลาย Equipment ก็ออกจากสนามไปด้วย (เว้นแต่การ์ดเขียนต่าง) จ่าย EquipCost ตอนสวม</p></div></div>
      <div class="gd-kind">${gcard('SD02-018')}<div><h3>Domain <span class="gd-tag">Spell · Domain Zone</span></h3><p>สนามพิเศษที่มีผลต่อเนื่องให้ฝั่งเรา หรือกวนฝั่งตรงข้าม วางได้ฝั่งละ 3 ใบ และห้ามมี Domain ชื่อซ้ำกันบนสนามฝั่งเดียวกัน จ่าย CastCost ตอนวาง</p></div></div>
      <div class="gd-kind">${gthumb('card-ultimate.jpg','SD02-019','Ultimate')}<div><h3>Ultimate <span class="gd-tag">ไม้ตาย · Ultimate Phase</span></h3><p>ไม้ตายที่ใช้ได้เฉพาะ Ultimate Phase ซึ่งอยู่หลัง Attack Phase จ่าย CastCost ซึ่งสูง ผลแรง เช่น กวาดล้างสนาม ใช้ได้เมื่อ Element พอและเงื่อนไขบนการ์ดครบ</p></div></div>
    </div>
    <p class="muted">Enchant, Counter, Equipment, Domain เรียกรวมว่า Spell ซึ่งมีค่า “Spell Cost” แทน Cost ของ Unit และไม่มี ATK/DEF/CRI</p>
  </section>

  <section class="gd" id="gd-field"><h2>5. สนามมีอะไรบ้าง และไว้ทำอะไร</h2>
    <p>นี่คือฝั่งของคุณ (ครึ่งล่างของจอ) ฝั่งคู่ต่อสู้อยู่ครึ่งบนของจอ มีโซนครบชุดเดียวกัน</p>
    <figure class="gd-fig">${svgBoard()}<figcaption>ฝั่งของคุณ ตัวเลขตรงกับรายการข้างล่าง</figcaption></figure>
    <div class="gd-grid">
      <div class="note"><b>1 · Avatar และ HP</b><br>ตัวแทนของคุณ HP เริ่มที่ 10 เมื่อถูก Unit โจมตีสำเร็จจะลดลงตามค่า CRI</div>
      <div class="note"><b>2 · Action Zone</b><br>ที่ลง Unit มี 4 ช่อง Unit ตั้ง (พร้อมโจมตี) หรือนอน (โจมตีไปแล้ว) บางการ์ดทำให้จำนวนช่องลดลงได้</div>
      <div class="note"><b>3 · Magic Area</b><br>3 ช่อง ไว้วาง Enchant และ Counter ที่ผลยังไม่จบ Equipment, Domain และ Ultimate ไม่ใช้ช่องนี้</div>
      <div class="note"><b>4 · Domain Zone</b><br>3 ช่อง ไว้วาง Domain ที่มีผลต่อเนื่อง ชื่อห้ามซ้ำกัน</div>
      <div class="note"><b>5 · Main Deck</b><br>เด็คหลัก ตัวเลขคือจำนวนใบที่เหลือ จั่วจากบนสุด ถ้าหมดตอนจั่วประจำเทิร์นคุณแพ้</div>
      <div class="note"><b>6 · กองทิ้ง</b><br>การ์ดที่ถูกทำลายหรือใช้ไปแล้วลงที่นี่ คลิกเพื่อเปิดดู บางการ์ดใช้ความสามารถจากกองทิ้งได้ (ANNOUNCE [กองทิ้ง])</div>
      <div class="note"><b>7 · Element Deck และ Element</b><br>กองแยก 8 ใบ ทุก Draw Phase รับ 1 ใบมาเป็น Element ของคุณ “Element 2/3” หมายถึงตั้งพร้อมจ่าย 2 จากทั้งหมด 3 ใบ</div>
      <div class="note"><b>8 · การ์ดบนมือ</b><br>เห็นเฉพาะคุณ ขอบเรืองแสงเขียวอมฟ้าคือใบที่เล่นได้ตอนนี้ คลิกเพื่อเลือกวิธีเล่น</div>
    </div>
  </section>

  <section class="gd" id="gd-element"><h2>6. Element คือทรัพยากรของคุณ</h2>
    <p>การ์ดส่วนใหญ่ต้องจ่ายด้วย Element ตอนเริ่มเกมมี 1 ใบ แล้วได้เพิ่ม 1 ใบทุกเทิร์น (ผู้เล่นคนแรกเทิร์นแรกไม่ได้ Element แต่จั่วเพิ่ม 1 ใบ) Element ที่จ่ายแล้วจะ “นอน” และกลับมาตั้งใหม่ใน Start Phase ของเรา</p>
    <div class="gd-elrow">${elIcons}</div>
    <figure class="gd-fig">${svgStandRest()}<figcaption>ตั้ง = พร้อมใช้งาน · นอน = ใช้แล้วจนกว่าจะถึง Start Phase ของเรา</figcaption></figure>
    <div class="gd-grid"><div class="note"><b>Invite (อัญเชิญ Unit)</b><br>จ่าย Element ธาตุตรงกับ Unit ตามจำนวน Cost เช่น Unit ธาตุไฟ Cost 2 ต้องใช้ Element ไฟที่ตั้งอยู่ 2 ใบ</div><div class="note"><b>Spend (Enchant, Equipment, Domain, Ultimate, ความสามารถ)</b><br>จ่าย Element ธาตุไหนก็ได้ที่ตั้งอยู่ตามจำนวนที่ระบุ</div></div>
    <p class="muted">Element ที่เหลือหลังจบเทิร์นของเรายังตั้งอยู่ และใช้ร่าย Counter ในเทิร์นคู่ต่อสู้ได้ ดังนั้นการเก็บไว้บ้างอาจคุ้มกว่าใช้หมด</p>
  </section>

  <section class="gd" id="gd-turn"><h2>7. ลำดับในหนึ่งเทิร์น</h2>
    <figure class="gd-fig">${svgTurn()}</figure>
    <ol class="gd-phases">${phases.map(([a,b])=>`<li><b>${a}</b><span>${b}</span></li>`).join('')}</ol>
    <p class="muted">แถบเฟสด้านบนของหน้าเกมไฮไลต์เฟสปัจจุบัน และปุ่มสีแดงที่แถบสถานะใช้ไปเฟสถัดไป</p>
  </section>

  <section class="gd" id="gd-play"><h2>8. เล่นการ์ดแต่ละชนิดยังไง</h2>
    <p>ทุกอย่างทำจากการคลิก ใน Main Phase การ์ดบนมือที่เล่นได้จะมีขอบเรืองแสงสีเขียวอมฟ้า คลิกแล้วเลือกการกระทำจากเมนูที่ขึ้นมา ถ้าเล่นไม่ได้ เมนูจะบอกเหตุผล เช่น Element ไม่พอ</p>
    <figure class="gd-fig">${svgLifecycle()}<figcaption>เส้นทางของ Unit และจังหวะที่ Keyword ทำงาน</figcaption></figure>
    <div class="gd-play">
      <div><h3>Unit</h3><ol><li>คลิก Unit บนมือ แล้วเลือก “อัญเชิญ ชื่อการ์ด (Invite N)”</li><li>ต้องมี Element ธาตุตรงกับ Unit ตั้งอยู่ตาม Cost และ Action Zone ยังมีช่องว่าง</li><li>Unit ลงสนามในสภาพตั้ง ADVENT (ถ้ามี) ทำงานทันที</li><li>เทิร์นที่ลงยังโจมตีไม่ได้ รอเทิร์นถัดไป</li></ol></div>
      <div><h3>Enchant</h3><ol><li>คลิกการ์ดแล้วเลือก “ร่าย ชื่อการ์ด” จ่าย SpellCost</li><li>เลือกเป้าหมายตามข้อความ (ถ้ามี) คู่ต่อสู้ตอบโต้ได้ก่อน</li><li>ผลทำงาน ถ้ายังมีผลต่อเนื่องจะค้างใน Magic Area</li></ol></div>
      <div><h3>Equipment</h3><ol><li>คลิกการ์ดแล้วเลือก “ร่าย ชื่อการ์ด” จากนั้นเลือก Unit ของเราที่จะสวม</li><li>จ่าย EquipCost</li><li>ค่าและความสามารถใหม่ติดกับ Unit นั้นทันที</li></ol></div>
      <div><h3>Domain</h3><ol><li>คลิกการ์ดแล้วเลือก “ร่าย ชื่อการ์ด” จ่าย CastCost</li><li>วางลง Domain Zone ได้สูงสุด 3 ใบ ห้ามชื่อซ้ำ</li><li>ผลต่อเนื่องทำงานตลอดที่ยังอยู่บนสนาม</li></ol></div>
      <div><h3>ความสามารถ ACTIVATE</h3><ol><li>คลิก Avatar, Unit, Equipment หรือ Domain ที่มีความสามารถนี้</li><li>เลือกรายการ “ACTIVATE: …” แล้วจ่ายค่าใช้จ่ายที่ระบุ</li><li>1/turn คือใช้ได้ครั้งเดียวต่อเทิร์น</li></ol></div>
      <div><h3>Ultimate และ Counter</h3><ol><li>Ultimate: รอถึง Ultimate Phase คลิกใบนั้นบนมือ แล้วเลือก “ใช้ ชื่อการ์ด”</li><li>Counter: ใช้ไม่ได้ใน Main Phase รอให้เกมถามว่า “ใช้ Counter ไหม?” แล้วเลือกใบที่ต้องการ</li></ol></div>
    </div>
  </section>

  <section class="gd" id="gd-attack"><h2>9. การโจมตี</h2>
    <p>ใน Attack Phase คลิก Unit ของคุณที่เรืองแสง (ต้องตั้งอยู่ และไม่ใช่ใบที่เพิ่งลงเทิร์นนี้) แล้วคลิกเป้าหมายที่ขึ้นขอบสีแดง Unit ที่โจมตีจะนอนลง</p>
    <figure class="gd-fig">${svgAttack()}</figure>
    <div class="gd-grid"><div class="note"><b>โจมตี Unit</b><br>ถ้า ATK ของเราเท่ากับหรือมากกว่า DEF ของเป้า เป้าจะถูกทำลาย ถ้าน้อยกว่าจะไม่มีอะไรเกิดขึ้น</div><div class="note"><b>โจมตี Avatar</b><br>ทำได้เมื่อฝ่ายตรงข้ามไม่มี Unit หรือ Unit ทุกใบนอนอยู่ และไม่มี Unit ที่มีข้อความ “ต้องทำลายก่อนเสมอ” ดาเมจเท่ากับค่า CRI ของ Unit ที่โจมตี</div></div>
    <p class="muted">ฝ่ายตรงข้ามตอบโต้ด้วย Counter ได้ตอนที่คุณประกาศโจมตี อ่านต่อหัวข้อถัดไป</p>
  </section>

  <section class="gd" id="gd-counter"><h2>10. Counter ตอบโต้ในเทิร์นฝ่ายตรงข้าม</h2>
    <p>ตอนที่ฝ่ายตรงข้ามประกาศโจมตี ใช้ความสามารถ หรือร่าย Spell เกมจะถามคุณว่าจะตอบโต้ไหม คุณใช้ Counter จากมือ หรือความสามารถที่ตอบโต้ได้ โดยจ่ายด้วย Element ที่เหลือตั้งอยู่ ผลทำงานเป็นแบบใบสุดท้ายที่ใช้ทำก่อน</p>
    <figure class="gd-fig">${svgCounter()}</figure>
  </section>

  <section class="gd" id="gd-keywords"><h2>11. Keyword ทั้งหมด</h2>
    <p>Keyword คือคำขึ้นต้นของแต่ละความสามารถบนการ์ด บอกว่าทำงานตอนไหนและใครเป็นคนเริ่ม ชี้การ์ดตัวอย่างเพื่อดูข้อความเต็ม</p>
    <div class="gd-kwgrid">${kwList().map(kwHTML).join('')}</div>
    <h3 style="margin-top:8px">คำที่เจอบ่อยในข้อความการ์ด</h3>
    <div class="gd-gloss">
      <div><b>Stand (ตั้ง) / Rest (นอน)</b>สภาพของ Unit และ Element ตั้ง = พร้อมใช้ นอน = ใช้แล้ว ดูหัวข้อ 6</div>
      <div><b>Invite / อัญเชิญ</b>นำ Unit ลง Action Zone ด้วยการจ่าย Cost หรือด้วยเอฟเฟกต์ ถ้าเอฟเฟกต์เขียนว่าอัญเชิญ “ในสภาพนอน” Unit จะลงมาโดยนอนอยู่</div>
      <div><b>Spend N Element</b>จ่าย Element ธาตุอะไรก็ได้ที่ตั้งอยู่ N ใบ (ทำให้นอน)</div>
      <div><b>ทำลาย</b>Unit ถูกทำลายแล้วลงกองทิ้ง (ADMONISH ทำงานถ้ามี) บางใบ “ไม่ถูกทำลายด้วยความสามารถของการ์ด” จึงต้องกำจัดด้วยการต่อสู้</div>
      <div><b>ส่งกลับขึ้นมือ</b>บางเอฟเฟกต์ทำให้การ์ดกลับขึ้นมือแทนการลงกองทิ้ง เช่น Unit ที่สวมมโยลเนียร์</div>
      <div><b>ถาวร</b>ค่าที่เปลี่ยนมีผลตลอดที่การ์ดยังอยู่บนสนาม</div>
      <div><b>จนจบเทิร์น · จนจบเทิร์นของคู่แข่ง · จนจบการต่อสู้</b>ระยะเวลาที่ค่าเปลี่ยน เช่น DEF +3 จนจบการต่อสู้ หมายถึงถึงจบการโจมตีครั้งนั้นเท่านั้น</div>
      <div><b>ATK +n · DEF −n</b>เพิ่มหรือลดค่าของ Unit ตามที่ระบุ ค่าที่เห็นบนสนามคือค่าหลังคำนวณแล้ว</div>
      <div><b>เผ่า (Tribe)</b>คำในช่อง “ชนิด · เผ่า” ของการ์ด มีเอฟเฟกต์ที่ค้นหาหรือเพิ่มพลังตามเผ่า</div>
      <div><b>ชื่อ “…”</b>เอฟเฟกต์ที่ระบุชื่อการ์ดจะตรงเมื่อชื่อการ์ดมีคำนั้นอยู่ในชื่อ</div>
      <div><b>เปิดเผย / ดู / เรียง</b>เปิดเผยให้ทั้งสองฝ่ายเห็น ส่วน “ดู” เห็นเฉพาะผู้เล่นคนนั้น และ “เรียง” คือจัดลำดับการ์ดบนสุดของ Main Deck</div>
    </div>
  </section>

  <section class="gd" id="gd-screen"><h2>12. อ่านหน้าจอเกม</h2>
    <ol class="gd-steps">
      <li><div><b>แถบด้านบน</b><br>แสดงเทิร์นและเฟสปัจจุบัน ปุ่ม “ตั้งค่า” ปรับขนาดหน้าจอ “กติกา” เปิดสรุปกติกา “เริ่มใหม่” เล่นใหม่ด้วยเด็คเดิม และ “ยอมแพ้” กลับหน้าแรก</div></li>
      <li><div><b>แถบสถานะตรงกลาง</b><br>บอกว่าตอนนี้ถึงตาใคร ต้องทำอะไร และมีปุ่มไปเฟสถัดไป เช่น “ไป Attack Phase”</div></li>
      <li><div><b>สีขอบการ์ดบอกสถานะ</b><br>เขียวอมฟ้า = เล่นหรือเลือกได้ · แดง = เป้าหมายที่โจมตีหรือเลือกได้ · เหลือง = ใบที่เลือกอยู่</div></li>
      <li><div><b>แผงด้านขวา</b><br>แท็บ “การ์ด” อ่านข้อความการ์ดที่ชี้หรือคลิก · “บันทึก” เป็นบันทึกการเล่นทั้งเกม (ดาวน์โหลดเป็นไฟล์ได้) · “กติกา” สรุปกติกา</div></li>
    </ol>
  </section>

  <section class="gd" id="gd-first"><h2>13. ลองเล่นรอบแรก</h2><ol class="gd-first">${first.map(t=>`<li>${t}</li>`).join('')}</ol><div class="ot-cta"><button class="btn pri" data-act="page" data-v="play">เริ่มเล่นกับบอท</button> <button class="btn" data-act="feedback">ส่งข้อเสนอแนะ / แจ้งบั๊ก</button></div></section>`;
}
