/* UI · ค่าพื้นฐาน: ตัวช่วย DOM, ไอคอนธาตุ, สถานะหน้าจอ (ui)
   ไฟล์ใน js/ui/ ทุกไฟล์เป็นสคริปต์ธรรมดาที่ใช้ตัวแปรระดับบนร่วมกัน ลำดับโหลดดูใน index.html */
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const root=$('#app');
const DATA=AF.cardData;   // ข้อมูลการ์ดจาก js/data/cards-api.js (UI อ่านผ่านตัวนี้เท่านั้น)
const imgcssEl=$('#imgcss');
const ELEMENTS={"พืช":{c:"#0a9a4b",p:"M4 14C4 7 8 4 14 4c0 6-3 10-10 10z"},"ทอง":{c:"#e8a317",p:"M4 12h5l1-3H5zM9 12h5l-1-3H10zM6.5 9h5L10.5 6h-3z"},"ดิน":{c:"#8b5a3c",p:"M4 12c0-3 2-5 5-5s5 2 5 4-2 3-5 3-5 0-5-2z"},"มืด":{c:"#7b3fc4",p:"M11 3a6 6 0 1 0 4 9 5 5 0 0 1-4-9z"},"น้ำ":{c:"#1f7fc4",p:"M9 3c3 4 5 6 5 8a5 5 0 0 1-10 0c0-2 2-4 5-8z"},"ไฟ":{c:"#ee5a2a",p:"M9 2c1 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z"}};
const elIcons=(d,s=13)=>((d&&d.els)||[]).map(k=>elIcon(k,s)).join('');
const elIcon=(n,s=20)=>{const e=ELEMENTS[n];return e?`<svg width="${s}" height="${s}" viewBox="0 0 18 18"><path d="${e.p}" fill="${e.c}"/></svg>`:''};

/* ------------------------------------------------------------------ state */
const ui={fb:{cat:'suggest',text:'',name:'',contact:'',busy:false,msg:'',ok:false},screen:'setup',cfg:null,G:null,token:0,pending:null,viewer:0,inspect:null,sel:null,menu:null,modal:null,tab:'card',cover:null,seen:0,toast:'',peek:false,edit:null,over:null,err:'',fresh:[],page:'play',my:[],ed:null,confirmDel:null};
