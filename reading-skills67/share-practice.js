/* Cập nhật riêng trạng thái Share; giữ vùng nhập/đọc, bỏ phản hồi của scope cũ. */
(function(){
 'use strict';let scope='',value=null,timer=null,generation=0,localUrl='',readonlyView=false,activeClient=null,wasLocked=true;
 const labels={PRACTICE_NOT_ACCEPTED:'Hãy hoàn thành và kiểm tra link luyện ChatGPT trước khi gửi chấm.',SHARE_URL_INVALID:'Dùng link chia sẻ cả hội thoại dạng https://chatgpt.com/share/…'};
 function paint(){
  const card=document.querySelector('.share-practice'),status=document.querySelector('#practice-status');if(!card)return;
  card.dataset.state=value?.status||'loading';const text=value?.message||'Đang đọc trạng thái luyện tập…';if(status.textContent!==text)status.textContent=text;
  const locked=!readonlyView&&value?.status!=='accepted',gate=document.querySelector('.reading-practice-gate'),content=gate?.querySelector('.reading-practice-content'),overlay=gate?.querySelector('.reading-practice-overlay');
  if(gate)gate.dataset.locked=String(locked);if(content){content.inert=locked;content.setAttribute('aria-disabled',String(locked));}if(overlay)overlay.hidden=!locked;
  if(!readonlyView){
   document.querySelectorAll('[data-target]').forEach(el=>{if(el.tagName==='SELECT')el.disabled=locked;else el.readOnly=locked;});
   document.querySelectorAll('[data-flag],#grade-button').forEach(el=>el.disabled=locked);
  }
  document.querySelectorAll('[data-action="notes"],[data-action="review"]').forEach(el=>el.disabled=locked);
  const jump=document.querySelector('#practice-gate-jump');if(jump)jump.onclick=()=>{card.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});document.querySelector('.practice-open')?.focus({preventScroll:true});};
  if(wasLocked&&!locked&&!readonlyView)activeClient?.flush?.().catch(()=>{});wasLocked=locked;
 }
 async function refresh(client,current,attemptId){clearTimeout(timer);try{const next=await client.practice(attemptId);if(current!==generation)return;value=next;const input=document.querySelector('#practice-share');if(input&&!localUrl&&next.url)input.value=next.url;paint();if(['queued','processing'].includes(next.status))timer=setTimeout(()=>refresh(client,current,attemptId),4000);}catch{if(current!==generation)return;value={status:'unavailable',message:'Chưa đọc được trạng thái link; bài đang viết vẫn được giữ.'};paint();}}
 function bind({content,teacher,client,attemptId,readonly=false}){
  if(!content.practice||!client)return;
  readonlyView=readonly;activeClient=client;
  const person=client.identity,key=[person.ownerId,person.courseId,content.code,content.version,teacher?'teacher':'student',attemptId||'draft'].join(':');
  if(scope!==key){scope=key;generation++;value=null;localUrl='';wasLocked=true;clearTimeout(timer);if(!readonly)try{localUrl=localStorage.getItem('reading-share-draft:'+scope)||'';}catch{}refresh(client,generation,attemptId);}
  const input=document.querySelector('#practice-share'),button=document.querySelector('#practice-check');if(!input)return;
  const guide=document.querySelector('.share-practice details');
  if(guide&&!guide.querySelector('.share-guide-illustrations')){
   const gallery=document.createElement('div');gallery.className='share-guide-illustrations';
   for(const [title,steps] of [['iPhone',[['iphone-menu.png','1. Mở danh sách hội thoại.'],['iphone-select-chat.png','2. Chọn đúng bài luyện.'],['iphone-share-chat.png','3. Chọn Chia Sẻ Đoạn Chat.'],['iphone-share-link.png','4. Sao chép liên kết chia sẻ.']]],['Android',[['android-menu.png','1. Mở hội thoại, nhấn ba chấm.'],['android-share.png','2. Chọn Chia sẻ.'],['android-share-link.png','3. Sao chép liên kết chia sẻ.']]]]){
    const section=document.createElement('section'),h=document.createElement('h3');h.textContent=title;section.append(h);
    for(const [file,caption] of steps){const figure=document.createElement('figure'),img=document.createElement('img'),label=document.createElement('figcaption');img.src='../../speaking-homework/assets/'+file;img.alt=title+' · '+caption;img.loading='lazy';label.textContent=caption;figure.append(img,label);section.append(figure);}gallery.append(section);
   }guide.append(gallery);
  }
  input.readOnly=readonly;if(button)button.hidden=readonly;input.value=localUrl||value?.url||'';paint();
  input.oninput=()=>{localUrl=input.value;try{localStorage.setItem('reading-share-draft:'+scope,localUrl);}catch{}};
  if(button)button.onclick=async()=>{const current=generation;button.disabled=true;try{const next=await client.savePractice({url:input.value.trim(),requestId:crypto.randomUUID()});if(current!==generation)return;value=next;localUrl='';try{localStorage.removeItem('reading-share-draft:'+scope);}catch{}paint();refresh(client,current);}catch(error){if(current!==generation)return;value={status:'retry',message:labels[error.code]||'Chưa kiểm được link. Nội dung bạn dán vẫn được giữ.'};paint();}finally{if(current===generation&&button.isConnected)button.disabled=false;}};
 }
 window.ReadingSharePractice={bind,isAccepted:()=>value?.status==='accepted',message:code=>labels[code]};
}());
