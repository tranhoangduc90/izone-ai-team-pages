// Đọc đề/bài/lần chấm đúng IC2200. Không dùng bootstrap tạo phiên hoặc token học viên thật.
(()=>{
 const test=window.TERM_TEST_CONFIG.slug,root=document.getElementById('app');
 const base=window.TERM_TEST_APP_CONFIG.API_BASE_URL+'/api/term-tests/teacher/design-demo',scope='?class=IC2200&test='+test;
 root.innerHTML='<header class="topbar"><h1>'+window.TERM_TEST_CONFIG.title+' · Bài đã chấm</h1></header><main class="full-history"><label>Học viên IC2200 <select id="saved-student"></select></label><p id="saved-status" role="status">Đang đọc bài đã chấm…</p><div id="saved-frame"></div></main>';
 const select=document.getElementById('saved-student'),status=document.getElementById('saved-status'),slot=document.getElementById('saved-frame');
 let ticket=0,content=null,snapshot=null;
 async function get(path){const response=await fetch(base+path+scope,{credentials:'omit',cache:'no-store'});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.message||data.error||'Chưa đọc được dữ liệu.');return data;}
 async function choose(){
  const run=++ticket;slot.replaceChildren();snapshot=null;status.textContent='Đang đọc đúng bài và lần chấm…';
  try{
   const response=await fetch(base+'/snapshot'+scope+'&attempt='+encodeURIComponent(select.value),{credentials:'omit',cache:'no-store'});const data=await response.json();if(run!==ticket)return;if(!response.ok||!data.ok)throw Error(data.error||'Chưa đọc được bài.');snapshot=data.snapshot;
   const f=document.createElement('iframe');f.title='Bài đã chấm · Chỉ đọc';f.src='../design-full/saved.html?test='+test+'&class=DEMO67&screen=result';slot.append(f);status.textContent='Bài gốc và lần chấm đã lưu · chỉ đọc';
  }catch(e){if(run===ticket)status.textContent=e.message;}
 }
 window.getSavedDemoContext=child=>{if(child!==slot.firstElementChild?.contentWindow||!snapshot)throw Error('Bài đọc không còn hiệu lực.');return {mode:'saved',toolsEnabled:false,screen:'result',content:content.content,timing:content.timing,snapshot,trial:{},navigate(){throw Error('Bài đã chấm chỉ để xem.');}};};
 select.addEventListener('change',choose);
 (async()=>{try{const [c,list]=await Promise.all([get('/content'),get('/attempts')]);content=c;
  if(!list.attempts.length){status.textContent='IC2200 chưa có bài hoàn tất để xem ở bài test này.';select.disabled=true;return;}
  for(const a of list.attempts){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;select.append(o);}await choose();
 }catch(e){status.textContent=e.message;}})();
})();
