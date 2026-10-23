'use strict';
const ids=['reading','listening','writing','mapping','term67','materials','k56','k56demo','handout67','substitute'];
async function check(){
 document.querySelector('#check').disabled=true;const rows=[];
 try{for(const product of ids){document.querySelector('#status').textContent='Đang kiểm '+product;const start=performance.now();let status=200;
  try{await window.IzoneTeacherSso.restore(product);if(product==='handout67'||product==='substitute')status=(await fetch('https://ducizone.ddns.net'+(product==='handout67'?'/api/handout67/v1/teacher/classes':'/substitute-teacher-api/teacher/scopes'),{credentials:'include',cache:'no-store'})).status;}
  catch(e){status=e.status||0;}
  rows.push({product,status,ms:Math.round(performance.now()-start)});document.querySelector('#results').textContent=JSON.stringify(rows,null,2);
 }document.querySelector('#status').textContent='Đã kiểm đủ 10 nguồn';}
 finally{document.querySelector('#check').disabled=false;}
}
document.querySelector('#check').onclick=check;
document.querySelector('#logout').onclick=async()=>{document.querySelector('#status').textContent='Đang đăng xuất chung';try{await window.IzoneTeacherSso.logout();await check();}catch(e){document.querySelector('#status').textContent='Chưa xác minh được đăng xuất: '+e.message;}};
