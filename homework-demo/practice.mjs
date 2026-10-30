import {esc,installBanner,feedbackHtml,wireDialog,loadScript} from './common.mjs';
import {ASSETS} from '../shared/audio/catalog.mjs';
import {downloadPreferred} from '../shared/audio/transport.mjs?v=20261028-part-rescue-v1';
export async function mount(data){
 const listening=data.subject==='listening';
 const ui=await import(listening?'../listening-practice/authored-ui.js?v=20261029-approved-r3':'../reading-practice/authored-ui.js?v=20261030-sentence-r3-2');
 const d=data.definition,lesson=d.lesson,main=document.querySelector('main'),storageKey='izone:homework-demo:'+data.code;
 let state={answers:{},flags:[],annotations:[],notes:''},currentPassage=lesson.passages?.[0]||null,remaining=data.totalMs,clock=null,audioUrl=null,audioTask=null;
 try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved)state={...state,...saved};}catch{}
 const allIds=d.groups.flatMap(g=>g.questions.map(q=>q.n));
 function save(){try{sessionStorage.setItem(storageKey,JSON.stringify(state));return true;}catch{return false;}}
 const flag=n=>`<button type="button" class="cbt-flag-button flag ${state.flags.includes(n)?'is-flagged':''}" data-demo-flag="${n}" aria-label="Đánh dấu câu ${n}" aria-pressed="${state.flags.includes(n)}">⚑</button>`;
 const fmt=ms=>{const sec=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;};
 function stopClock(){clearInterval(clock);clock=null;const b=document.querySelector('#demo-clock');if(b)b.textContent='Chạy thử đồng hồ';}
 function reset(){stopClock();state={answers:{},flags:[],annotations:[],notes:''};remaining=data.totalMs;save();render();}
 function write(n,value){state.answers[n]=value;save();updateNav();}
 function updateNav(){for(const b of document.querySelectorAll('[data-demo-jump]'))b.classList.toggle('filled',!!state.answers[b.dataset.demoJump]);const count=allIds.filter(n=>state.answers[n]).length;document.querySelector('#demo-count').textContent=`${count}/${allIds.length} đã điền · Thao tác thử`;}
 function passageHtml(){const p=currentPassage,ids=p?.paragraphs||Object.keys(d.passage||{});return `<header class="cbt-passage-header"><h2>${esc(p?.title||lesson.title)}</h2>${d.passageSubtitles?.[p?.id]?`<p>${esc(d.passageSubtitles[p.id])}</p>`:''}</header><div class="cbt-passage-body">${ids.map(id=>`<section class="cbt-passage-paragraph" data-paragraph="${esc(id)}" id="paragraph-${esc(id)}"><span class="cbt-paragraph-label">${esc(p?.labels?.[id]||id)}</span><p data-annotation-root-key="demo-${esc(data.code)}-${esc(id)}">${esc(d.passage[id])}</p></section>`).join('')}</div>`;}
 function questions(){
  const groups=currentPassage?d.groups.filter(g=>g.questions.some(q=>q.n>=currentPassage.start&&q.n<=currentPassage.end)):d.groups;
  const pane=document.querySelector('#question-scroll');pane.innerHTML=ui.groupsHtml(groups,state,flag,{practiceLayout:true});
  if(!listening)document.querySelector('#passage-scroll').innerHTML=passageHtml();
  ui.bindMultiple(pane,write);
  for(const input of pane.querySelectorAll('[data-answer]'))input.addEventListener(input.tagName==='SELECT'||input.type==='radio'?'change':'input',()=>write(input.dataset.answer,input.value));
  for(const b of pane.querySelectorAll('[data-demo-flag]'))b.onclick=()=>{const n=+b.dataset.demoFlag;state.flags=state.flags.includes(n)?state.flags.filter(x=>x!==n):[...state.flags,n];b.classList.toggle('is-flagged',state.flags.includes(n));b.setAttribute('aria-pressed',String(state.flags.includes(n)));save();};
  if(listening&&ui.mountNoteDocument)ui.mountNoteDocument(document.querySelector('#readingView'),groups,lesson.title);
  window.ReadingAnnotations?.install();updateNav();
 }
 function render(){
  main.innerHTML=`<header class="topbar"><a href="./index.html"><img src="../shared/master170/assets/izone-logo-color.png" alt="IZONE — IELTS chiến lược" width="145" height="48"></a><h1>${listening?'Listening':'Reading'} thực chiến · ${esc(lesson.title)}</h1><div class="demo-tools"><strong id="demo-timer">${fmt(remaining)}</strong><button id="demo-clock" type="button">Chạy thử đồng hồ</button><button id="demo-notes-open" type="button">Notes</button><button id="demo-feedback-open" type="button">Xem ví dụ kết quả</button></div></header>${listening?'<div class="demo-note"><button id="demo-audio-prepare" type="button">Chuẩn bị audio</button><audio id="demo-audio" class="demo-audio" controls preload="none"></audio><span id="demo-audio-status" role="status">Nhấn để tải và nghe thử.</span></div>':''}${currentPassage?`<nav class="demo-tab" aria-label="Chọn passage">${lesson.passages.map(p=>`<button type="button" data-demo-passage="${esc(p.id)}" aria-pressed="${p.id===currentPassage.id}">${esc(p.title)}</button>`).join('')}</nav>`:''}${!listening?'<nav class="demo-tab demo-mobile-tabs" aria-label="Vùng làm bài"><button type="button" data-demo-pane="passage">Bài đọc</button><button type="button" data-demo-pane="questions">Câu hỏi</button></nav>':''}<div id="readingView" class="demo-content cbt-reading-section ${listening?'demo-listening-content':''}"><article id="passage-scroll" class="demo-pane cbt-reading-passage" data-pane="passage" aria-label="${listening?'Đề bài':'Bài đọc'}" ${listening?'hidden':''}></article><section id="question-scroll" class="demo-pane cbt-reading-questions question-list" data-pane="questions" aria-label="Câu hỏi"></section></div><div class="demo-note"><span id="demo-count" role="status"></span><span>Ví dụ kết quả không chấm bài vừa nhập.</span></div><nav class="demo-question-nav" aria-label="Đi đến câu hỏi">${allIds.map(n=>`<button type="button" data-demo-jump="${n}" aria-label="Câu ${n}">${n}</button>`).join('')}</nav><dialog id="demo-notes"><h2>Ghi chú khi demo</h2><textarea class="demo-note-input" aria-label="Ghi chú">${esc(state.notes)}</textarea><button type="button" data-close>Đóng</button></dialog><dialog id="demo-feedback"><h2>Ví dụ xem kết quả</h2><p>Ở bài thật, sau khi nộp, học viên xem điểm và lời giải theo từng câu.</p>${feedbackHtml()}<p>Bản demo giữ riêng các đáp án bạn vừa nhập để có thể quay lại sửa thử.</p><button type="button" data-close>Về bài</button></dialog>`;
  const openNotes=wireDialog(document.querySelector('#demo-notes')),openFeedback=wireDialog(document.querySelector('#demo-feedback'));
  document.querySelector('#demo-notes-open').onclick=openNotes;document.querySelector('#demo-feedback-open').onclick=openFeedback;
  document.querySelector('#demo-notes textarea').oninput=e=>{state.notes=e.target.value;save();};
  document.querySelector('#demo-clock').onclick=e=>{if(clock){stopClock();return;}e.target.textContent='Tạm dừng đồng hồ';let last=performance.now();clock=setInterval(()=>{const now=performance.now();remaining=Math.max(0,remaining-(now-last));last=now;document.querySelector('#demo-timer').textContent=fmt(remaining);if(!remaining)stopClock();},250);};
  main.querySelectorAll('[data-demo-pane]').forEach(b=>b.onclick=()=>{document.body.dataset.activePane=b.dataset.demoPane;});
  main.querySelectorAll('[data-demo-passage]').forEach(b=>b.onclick=()=>{currentPassage=lesson.passages.find(p=>p.id===b.dataset.demoPassage);for(const t of main.querySelectorAll('[data-demo-passage]'))t.setAttribute('aria-pressed',String(t===b));questions();});
  main.querySelectorAll('[data-demo-jump]').forEach(b=>b.onclick=()=>{const n=+b.dataset.demoJump;const p=lesson.passages?.find(p=>n>=p.start&&n<=p.end);if(p&&p.id!==currentPassage?.id){currentPassage=p;questions();for(const t of main.querySelectorAll('[data-demo-passage]'))t.setAttribute('aria-pressed',String(t.dataset.demoPassage===p.id));}document.body.dataset.activePane='questions';const target=document.querySelector(`#q-${n}`);target?.scrollIntoView({block:'center'});target?.querySelector('input,select')?.focus({preventScroll:true});});
  questions();if(listening){document.querySelector('#demo-audio-prepare').onclick=prepareAudio;if(audioUrl)document.querySelector('#demo-audio').src=audioUrl;}
 }
 async function prepareAudio(){
  if(audioUrl){document.querySelector('#demo-audio').src=audioUrl;return;}if(audioTask)return audioTask;
  const status=document.querySelector('#demo-audio-status'),button=document.querySelector('#demo-audio-prepare');button.disabled=true;
  audioTask=(async()=>{try{
   status.textContent='Đang chuẩn bị audio…';const hash=d.audio.sha256,asset=Object.values(ASSETS).find(x=>x.sha256===hash);let blob;
   if(asset)blob=await downloadPreferred({...asset,envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1'}},{onProgress:p=>status.textContent=`Đang tải audio · ${Math.round(100*p.loaded/p.total)}%`});
   else{const response=await fetch(new URL(`./audio/${hash}.mp3`,import.meta.url));if(!response.ok)throw Error('Không tải được audio');const bytes=await response.arrayBuffer();const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(digest!==hash)throw Error('Audio không đúng phiên bản');blob=new Blob([bytes],{type:'audio/mpeg'});}
   audioUrl=URL.createObjectURL(blob);const audio=document.querySelector('#demo-audio');audio.src=audioUrl;await new Promise((resolve,reject)=>{audio.addEventListener('loadedmetadata',resolve,{once:true});audio.addEventListener('error',()=>reject(Error('Trình duyệt chưa đọc được audio')),{once:true});});status.textContent='Audio sẵn sàng · Nhấn phát để nghe thử.';button.hidden=true;
  }catch(error){status.textContent=error.message+' · Bấm chuẩn bị để thử lại.';status.className='demo-audio-error';}finally{button.disabled=false;audioTask=null;}})();return audioTask;
 }
 window.ReadingInteractionBridge={current:()=>state,scope:()=>data.code+':demo',writable:()=>true,save,showPane:p=>document.body.dataset.activePane=p,closeGeneralNotes:()=>{}};
 render();installBanner(reset);await loadScript(new URL('../reading-practice/annotations.js?v=20261024-master170-notes6',import.meta.url).href);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopClock();document.querySelector('#demo-audio')?.pause();}});
}
