import {downloadPreferred} from '../../shared/audio/transport.mjs';
import {ASSETS} from '../../shared/audio/catalog.mjs';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep the original demo namespace and IDs so existing local drafts remain readable.
const KEY='izone:listening-homework:interactive-demo:scandinavian:v1';
const chapters=[{title:'Nghe và điền từ',start:156,end:182.62,ids:['D1','D2','D3']},{title:'Phân tích câu 24',start:182.62,end:218.12,ids:Array.from({length:8},(_,i)=>'S'+(i+1))},{title:'Phân tích câu 25',start:218.46,end:246.96,ids:Array.from({length:11},(_,i)=>'S'+(i+9))}];
let data,state={fields:{},flags:[],chapter:0,history:[],notes:'',fontPercent:100,views:{}},activeItem='D1',activeField=null,selectedText='',tapStart=null,currentWordRange=null,toastTimer;
let audioTask=null,audioUrl=null,playIntent=0,clip={...chapters[0],label:chapters[0].title},lastCue=null,viewPane='passage',revealGeneration=0;
const audio=$('audio');audio.volume=.8;
const mobile=()=>matchMedia('(max-width:980px)').matches;
const itemId=key=>key.replace(/(?:quote|choice|[abc])$/,'');
const number=id=>data?.items.findIndex(i=>i.id===id)+1;
const itemLabel=id=>'Mục '+number(id);
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('save-status').textContent='Đã giữ trên thiết bị';}catch{$('save-status').textContent='Chưa lưu được · Hãy giữ trang mở';}}
function answer(id){
 if(id==='S4')return ['a','b','c'].map(s=>state.fields['S4'+s]||'').filter(s=>s.trim()).join(' / ');
 if(['S8','S17','S19'].includes(id))return [state.fields[id+'choice'],state.fields[id+'quote']].filter(Boolean).join(' · ');
 return state.fields[id]||'';
}
function progress(){
 const done=data.items.filter(i=>answer(i.id).trim()).length;
 $('progress').textContent=`${done}/22 đã nhập`;
 chapters.forEach((c,n)=>$('count-'+n).textContent=c.ids.filter(id=>answer(id).trim()).length+'/'+c.ids.length);
 $('review-count').textContent=`${22-done} chưa nhập`;
 $('flag-summary').textContent=state.flags.length?state.flags.length+' đã đánh dấu':'';
 document.querySelectorAll('[data-jump]').forEach(b=>{const id=b.dataset.jump,filled=!!answer(id).trim(),flagged=state.flags.includes(id),active=id===activeItem;
  b.classList.toggle('is-answered',filled);b.classList.toggle('is-flagged',flagged);b.classList.toggle('is-active',active);b.setAttribute('aria-current',String(active));b.setAttribute('aria-label',[itemLabel(id),filled?'đã nhập':'chưa nhập',flagged?'đã đánh dấu':''].filter(Boolean).join(', '));});
 document.querySelectorAll('[data-flag]').forEach(b=>{const marked=state.flags.includes(b.dataset.flag);b.classList.toggle('is-flagged',marked);b.setAttribute('aria-pressed',String(marked));b.setAttribute('aria-label',(marked?'Bỏ đánh dấu ':'Đánh dấu ')+itemLabel(b.dataset.flag));});
}
function rememberView(){if(!data)return;state.views[state.chapter]={exercise:$('exercise').scrollTop,transcript:$('transcript-cues').scrollTop,pane:viewPane};}
function setPane(pane,{focus=false}={}){viewPane=state.chapter===0?'passage':pane;$('readingView').dataset.designPane=viewPane;document.querySelectorAll('[data-pane]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pane===viewPane)));if(focus&&mobile()){const target=$(viewPane==='passage'?'exercise':'transcript-panel');target.scrollIntoView({block:'start',behavior:'auto'});}}
function fieldInput(key,label){return `<input class="evidence-input" id="field-${key}" data-field="${key}" value="${escape(state.fields[key]||'')}" aria-label="${escape(itemLabel(itemId(key))+' · '+label)}" autocomplete="off" spellcheck="false">`;}
function quoteSlot(key,label='Dẫn chứng từ audio'){return `<div class="evidence-slot" data-slot="${key}"><div class="slot-heading"><label for="field-${key}">${label}</label><button class="cbt-tool-button evidence-button" data-evidence="${key}">Chọn trong Transcript</button></div><div class="evidence-row">${fieldInput(key,label)}<button class="text-button clear-field" data-clear="${key}" aria-label="Xóa ${escape(itemLabel(itemId(key))+' · '+label)}">×</button></div></div>`;}
function choices(key,options){return `<div class="response-choices" role="group" aria-label="${escape(itemLabel(itemId(key))+' · Chọn ý')}">${options.map(([value,text])=>`<label class="cbt-choice cbt-choice-single-label"><input type="radio" name="${key}" data-field="${key}" value="${escape(value)}" ${state.fields[key]===value?'checked':''}><span>${text}</span></label>`).join('')}</div>`;}
function itemBody(item){const id=item.id;
 if(id==='S1')return choices(id,[['Ý kiến riêng của một người','Ý kiến riêng một người'],['Lựa chọn cuối cùng được cả James và Beth đồng ý','Lựa chọn được cả hai đồng ý']]);
 if(id==='S5')return choices(id,[['Có','Có'],['Không','Không']]);
 if(id==='S4')return quoteSlot('S4a','(a) Mở lời nêu vướng mắc')+quoteSlot('S4b','(b) Đánh giá mức độ khó')+quoteSlot('S4c','(c) Đề nghị để sang dịp khác');
 if(['S8','S17','S19'].includes(id))return choices(id+'choice',id==='S19'?[['C','C · Bối cảnh xã hội'],['A','A · Lịch sử thể loại']]:[['Có','Có'],['Không','Không']])+quoteSlot(id+'quote',id==='S8'?'Dẫn chứng · 1 từ':'Dẫn chứng thể hiện nhận định');
 if(['S10','S13','S16','S18'].includes(id))return `<label class="visually-hidden" for="field-${id}">Câu trả lời ${itemLabel(id)}</label><textarea class="hw-short-answer" rows="2" id="field-${id}" data-field="${id}" placeholder="Giải thích ngắn theo cách hiểu của bạn…">${escape(state.fields[id]||'')}</textarea><p class="hint">${id==='S10'||id==='S16'?'Trả lời bằng tiếng Việt.':'Có thể giải thích bằng tiếng Việt hoặc trích tiếng Anh.'} Không cần khớp từng ký tự với đáp án mẫu.</p>`;
 return quoteSlot(id,['S6','S9','S12'].includes(id)?'Dẫn chứng · 1 từ':'Dẫn chứng từ audio');
}
function renderItem(item){return `<article class="item cbt-question-card" id="item-${item.id}" role="group" aria-labelledby="title-${item.id}"><div class="cbt-question-heading"><span class="cbt-question-number" aria-label="${itemLabel(item.id)}">${number(item.id)}</span><p id="title-${item.id}">${escape(item.question)}</p><button class="cbt-flag-button flag" data-flag="${item.id}" aria-pressed="false" aria-label="Đánh dấu ${itemLabel(item.id)}">⚑</button></div>${itemBody(item)}</article>`;}
function mcq(n){const q=data.questions.find(q=>q.number===n);return `<section class="mcq-context" aria-label="Câu hỏi gốc ${n}"><p class="hw-section-label">CHỌN Ý TRƯỚC, PHÂN TÍCH SAU</p><article class="cbt-question-card"><div class="cbt-question-heading"><span class="cbt-question-number">${n}</span><p>${escape(q.stem)}</p></div><div class="cbt-choice-list">${Object.entries(q.options).map(([letter,text])=>`<label class="cbt-choice"><input type="radio" name="mcq${n}" data-field="mcq${n}" value="${letter}" ${state.fields['mcq'+n]===letter?'checked':''}><span class="cbt-choice-letter">${letter}</span><span>${escape(text)}</span></label>`).join('')}</div></article><p>Chọn ý chính rồi tìm dẫn chứng trong các mục ở dưới.</p></section>`;}
function blank(id,count,size=''){return `<span class="inline-blank ${size}" id="item-${id}"><input id="field-${id}" data-field="${id}" value="${escape(state.fields[id]||'')}" aria-label="${itemLabel(id)} · Điền ${count} từ" autocomplete="off" spellcheck="false"><label for="field-${id}">${count} từ</label></span>`;}
function render(){
 const c=chapters[state.chapter];$('readingView').dataset.homeworkChapter=state.chapter;$('section-title').textContent='Listening · 22 mục';
 document.querySelectorAll('[data-chapter]').forEach(b=>{const selected=+b.dataset.chapter===state.chapter;b.classList.toggle('is-active',selected);if(selected)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 const head=`<header class="cbt-passage-header"><h3>${c.title}</h3><p>${state.chapter===0?'Nghe lại và điền trực tiếp vào câu. Gợi ý số từ nằm dưới mỗi ô.':'Chọn ý chính, tìm dẫn chứng và giải thích theo cách hiểu của bạn.'}</p></header>`;
 let body;
 if(state.chapter===0)body=`<div class="dictation-passage"><div class="dictation-line"><span class="speaker">Beth</span><p>OK. Now how are you finding the courses you’re taking this term, James?</p></div><div class="dictation-line"><span class="speaker">James</span><p>Well, I’m really enjoying the one on Swedish cinema.</p></div><div class="dictation-line"><span class="speaker">Beth</span><p>That’ll continue next term, but the one on Scandinavian literature that’s running at the moment ${blank('D1',3)} by more ${blank('D2',1,'short')} courses. Oh, and by the way, if you’re interested in watching Danish television programmes, there’s going to be a course on that ${blank('D3',4,'long')}.</p></div><div class="dictation-line"><span class="speaker">James</span><p>That sounds good.</p></div></div><p class="hw-dictation-help">Bạn có thể tạm dừng, lùi 5 giây và nghe lại phần đang luyện. Câu trả lời được giữ khi chuyển phần.</p>`;
 else body=mcq(state.chapter===1?24:25)+'<p class="hw-section-label">PHÂN TÍCH Ý NGHĨA VÀ DẪN CHỨNG</p>'+data.items.filter(i=>c.ids.includes(i.id)).map(renderItem).join('');
 $('exercise-content').innerHTML=head+body;$('transcript-panel').hidden=state.chapter===0;$('pane-switch').hidden=state.chapter===0;
 $('next').textContent=state.chapter===0?'Sang câu 24 →':state.chapter===1?'Sang câu 25 →':'Rà lại các mục';
 $('content-viewport').dataset.fontSize=state.fontPercent;$('font-percent').textContent=state.fontPercent+'%';
 activeField=null;selectionTarget();clearSelection();progress();
}
function stop(){playIntent++;audio.pause();}
function revealContext(contextCue,targetCue){
 const generation=++revealGeneration;
 document.querySelectorAll('.context-cue').forEach(e=>e.classList.remove('context-cue'));
 $(targetCue)?.classList.add('context-cue');
 requestAnimationFrame(()=>{if(generation!==revealGeneration||state.chapter===0)return;const node=$(contextCue);if(!node)return;const box=$('transcript-cues');box.scrollTop+=node.getBoundingClientRect().top-box.getBoundingClientRect().top-8;const target=$(targetCue);if(target){const bottom=Math.min(box.getBoundingClientRect().bottom,mobile()?document.querySelector('.hw-question-dock').getBoundingClientRect().top:innerHeight);const start=target.querySelector('.cue-head').getBoundingClientRect().bottom+28;if(start>bottom-8)box.scrollTop+=start-bottom+8;}});
}
function setChapter(n,{focus=true,restore=false}={}){
 rememberView();stop();state.chapter=n;activeItem=chapters[n].ids[0];state.activeItem=activeItem;render();setClip(chapters[n]);
 const saved=restore?state.views[n]:null;setPane(saved?.pane||(n===0?'passage':'questions'));
 $('exercise').scrollTop=saved?.exercise||0;
 if(saved&&Number.isFinite(saved.transcript))$('transcript-cues').scrollTop=saved.transcript;
 else if(n>0)revealContext(n===1?'cue-5':'cue-12',n===1?'cue-5':'cue-12');
 save();if(focus){if(mobile())$(n===0?'exercise':'transcript-panel').scrollIntoView({block:'start',behavior:'auto'});else $('exercise').focus({preventScroll:true});}
 document.querySelector(`[data-jump="${activeItem}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function selectionTarget(){
 $('selection-target').textContent=activeField?'Đang lấy dẫn chứng cho '+itemLabel(itemId(activeField))+(activeField.startsWith('S4')?' · ô ('+activeField.slice(-1)+')':''):'Chọn một ô dẫn chứng bên bài tập';
 $('use-selection').disabled=!activeField;document.querySelectorAll('[data-slot]').forEach(e=>e.classList.toggle('active',e.dataset.slot===activeField));
 const item=data?.items.find(i=>i.id===itemId(activeField||''));$('context-task').hidden=!item;if(item){$('context-task-label').textContent=itemLabel(item.id)+' · Xem yêu cầu';$('context-task-text').textContent=item.question;}
}
function activateField(key){const id=itemId(key);if(!chapters[state.chapter].ids.includes(id))return;if(activeField!==key)clearSelection();activeField=key;activeItem=id;state.activeItem=id;selectionTarget();progress();}
function selectEvidence(key){
 activateField(key);setPane('questions',{focus:true});const item=data.items.find(i=>i.id===itemId(key));const c=item.evidenceContext;
 if(c)revealContext(c.contextCue,c.targetCue);$('selection-help').textContent=$('tap-mode').checked?'Chạm từ đầu, rồi chạm từ cuối của cụm muốn lấy.':'Bôi đen một cụm trong lời nói, rồi bấm “Dùng đoạn này”.';
}
function showSelection(text){selectedText=text.replace(/\s+/g,' ').trim();$('selected-text').textContent=selectedText;$('selection-preview').hidden=!selectedText;}
function clearSelection(){showSelection('');tapStart=null;currentWordRange=null;document.querySelectorAll('.word.picked').forEach(e=>e.classList.remove('picked'));window.getSelection()?.removeAllRanges();}
function useSelection(){
 if(!activeField||!selectedText)return;const key=activeField,field=$('field-'+key);state.fields[key]=selectedText;field.value=selectedText;save();progress();clearSelection();setPane('passage',{focus:mobile()});field.focus({preventScroll:true});field.scrollIntoView({block:'center',behavior:'auto'});toast('Đã thêm vào '+itemLabel(itemId(key))+'. Bạn vẫn có thể sửa trực tiếp.');
}
function renderTranscript(){
 $('transcript-scope').textContent=data.transcriptScope.label;
 $('transcript-cues').innerHTML=data.transcript.map(c=>`<section class="cue" id="${c.id}" data-start="${c.start}" data-end="${c.end}"><div class="cue-head"><strong>${c.speaker}</strong><button class="cbt-tool-button" data-cue="${c.id}" aria-label="Nghe lời ${c.speaker} từ ${clock(c.start)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg> ${clock(c.start)}</button></div><p data-cue-text="${c.id}">${c.text.split(/(\s+)/).map((w,i)=>/^\s+$/.test(w)?w:`<span class="word" data-word="${i}">${escape(w)}</span>`).join('')}</p></section>`).join('');
}
function clock(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
function setClip(c){clip={start:c.start,end:c.end,label:c.title||c.label};if(audioUrl)audio.currentTime=clip.start;$('audio-label').textContent=clip.label;$('seek').min=clip.start;$('seek').max=clip.end;$('seek').value=clip.start;$('time').textContent=clock(clip.start)+' / '+clock(clip.end);}
async function prepareAudio(preferFallback=false){
 if(audioUrl)return;if(audioTask)return audioTask;
 $('play').disabled=true;$('audio-status').textContent='Đang chuẩn bị audio…';$('fallback').hidden=true;
 const work=(async()=>{
  const a=ASSETS['homework-listening-02-scandinavian'];
  const blob=await downloadPreferred({...a,envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1'}},{preferFallback,onProgress:p=>$('audio-status').textContent=`Đang tải audio · ${Math.min(100,Math.round(p.loaded/p.total*100))}%`,onEvent:e=>{if(e.source==='pages')$('audio-status').textContent='Đang tải từ nguồn dự phòng…';}});
  if(!blob)throw Error('Audio unavailable');audioUrl=URL.createObjectURL(blob);audio.src=audioUrl;
  await new Promise((resolve,reject)=>{if(audio.readyState>=1)return resolve();audio.addEventListener('loadedmetadata',resolve,{once:true});audio.addEventListener('error',reject,{once:true});});
  audio.currentTime=clip.start;$('audio-status').textContent='Sẵn sàng · Có thể nghe lại từng đoạn.';
 })();audioTask=work;
 try{await work;}finally{audioTask=null;$('play').disabled=false;}
}
function audioError(error){const denied=error.accessDenied||error.status===401||error.status===403;$('audio-status').textContent=denied?'Chưa xác nhận được quyền audio. Hãy giữ bài và báo giáo viên.':error.name==='NotAllowedError'?'Audio đã sẵn sàng. Bấm phát để nghe.':'Chưa tải được audio. Bài đang nhập được giữ; hãy thử lại.';$('fallback').hidden=!!denied||error.name==='NotAllowedError';}
async function playClip(c,preferFallback=false){stop();if(c)setClip(c);const intent=++playIntent;try{await prepareAudio(preferFallback);if(intent!==playIntent||document.hidden)return;if(audio.currentTime<clip.start||audio.currentTime>=clip.end-.1)audio.currentTime=clip.start;audio.playbackRate=+$('speed').value;await audio.play();}catch(e){if(intent===playIntent)audioError(e);}}
function renderPlay(){const playing=!audio.paused;$('play').innerHTML=playing?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';$('play').setAttribute('aria-label',playing?'Tạm dừng audio':'Phát đoạn đang luyện');}
function updateAudio(){const t=audio.currentTime;if(t>=clip.end&&!audio.paused){audio.pause();audio.currentTime=clip.end;}$('seek').value=Math.min(clip.end,Math.max(clip.start,t));$('time').textContent=clock(Math.max(clip.start,t))+' / '+clock(clip.end);const cue=data.transcript.find(c=>t>=c.start&&t<c.end);if(cue?.id!==lastCue){if(lastCue)$(lastCue)?.classList.remove('current');lastCue=cue?.id;if(lastCue)$(lastCue)?.classList.add('current');}}

function bindDialog(id,closeId,opener){const dialog=$(id);let outside=false;$(closeId).onclick=()=>dialog.close();dialog.addEventListener('pointerdown',e=>{const r=dialog.getBoundingClientRect();outside=e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;});dialog.addEventListener('pointerup',e=>{const r=dialog.getBoundingClientRect();if(outside&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();outside=false;});dialog.addEventListener('close',()=>{if(id==='explanation-dialog')stop();if(!dialog.skipReturnFocus)$(opener).focus({preventScroll:true});dialog.skipReturnFocus=false;});}
async function sampleFeedback(){
 stop();const button=$('sample-feedback');button.disabled=true;
 try{const r=await fetch(new URL('./feedback-demo.json',import.meta.url),{cache:'no-store'});if(!r.ok)throw Error();const f=await r.json();
  const snapshot={id:crypto.randomUUID(),at:new Date().toISOString(),answers:Object.fromEntries(data.items.map(i=>[i.id,answer(i.id)])),count:data.items.filter(i=>answer(i.id)).length,notes:state.notes};state.history=[snapshot,...state.history].slice(0,5);save();
  const cue=data.transcript.find(c=>c.id==='cue-7'),quoted=escape(cue.text).replace(escape(f.quote),`<mark>${escape(f.quote)}</mark>`);
  $('review-content').innerHTML=`<div class="explanation-dialog-columns"><section class="explanation-dialog-passage"><div class="explanation-dialog-pane-head"><strong>Transcript</strong><span>03:12–03:24</span></div><div class="explanation-dialog-passage-scroll"><strong>Beth</strong><p>${quoted}</p><button id="replay-review" class="replay-button">▷ Nghe lại đoạn dẫn chứng</button></div></section><section class="explanation-dialog-detail"><div class="explanation-dialog-detail-scroll"><p class="hw-review-caption">Tình huống minh họa có sẵn. Chưa chấm nội dung bạn vừa nhập.</p><h3 class="hw-review-status">${escape(f.status)}</h3><p class="hw-review-caption">Câu trả lời minh họa</p><blockquote class="hw-review-quote">${escape(f.response)}</blockquote><p>${escape(f.reason)}</p><p><strong>Bước tiếp theo:</strong> ${escape(f.nextStep)}</p><p class="hw-review-caption">${escape(f.writingNote)}</p></div></section></div><div class="hw-review-actions"><button id="revise-s4" class="button">Về Mục 7 để bổ sung →</button></div>`;
  $('replay-review').onclick=()=>playClip({start:f.start,end:f.end,label:'Dẫn chứng · Mục 7'});
  $('revise-s4').onclick=()=>{$('explanation-dialog').skipReturnFocus=true;$('explanation-dialog').close();setChapter(1,{focus:false});setPane('passage',{focus:mobile()});activateField('S4c');const field=$('field-S4c');field.focus({preventScroll:true});field.scrollIntoView({block:'center',behavior:'auto'});};$('explanation-dialog').showModal();
 }catch{toast('Chưa mở được góp ý minh họa. Nháp vẫn được giữ.');}finally{button.disabled=false;}
}
function history(){stop();const box=$('history-content');box.replaceChildren();if(!state.history.length)box.innerHTML='<p class="history-empty">Chưa có lượt thử. Bấm “Xem góp ý mẫu” để trải nghiệm luồng đối chiếu và sửa bài.</p>';else for(const h of state.history){const row=document.createElement('section');row.className='history-row';const title=document.createElement('strong');title.textContent=new Date(h.at).toLocaleString('vi-VN');const p=document.createElement('p');p.textContent=`${h.count}/22 mục đã nhập khi mở góp ý mẫu · Chưa chấm`;const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Xem bản thử lúc đó';const text=document.createElement('div');text.className='snapshot';text.textContent=data.items.map(i=>itemLabel(i.id)+': '+(h.answers[i.id]||'(Chưa điền)')).join('\n');details.append(summary,text);row.append(title,p,details);box.append(row);}$('history-dialog').showModal();}
function setFont(delta){state.fontPercent=Math.min(120,Math.max(90,state.fontPercent+delta));$('content-viewport').dataset.fontSize=state.fontPercent;$('font-percent').textContent=state.fontPercent+'%';save();}
function toggleNotes(open){$('notes-panel').hidden=!open;$('notes-button').setAttribute('aria-expanded',String(open));if(open)$('notes').focus();else $('notes-button').focus();}
document.querySelectorAll('[data-chapter]').forEach(b=>b.onclick=()=>setChapter(+b.dataset.chapter));
document.querySelectorAll('[data-pane]').forEach(b=>b.onclick=()=>{setPane(b.dataset.pane,{focus:true});rememberView();save();});
$('return-exercise').onclick=()=>{setPane('passage',{focus:true});const field=activeField?$('field-'+activeField):$('exercise');field?.focus({preventScroll:true});field?.scrollIntoView({block:'center',behavior:'auto'});};
$('exercise-content').addEventListener('input',e=>{const f=e.target.closest('[data-field]');if(!f)return;state.fields[f.dataset.field]=f.value;rememberView();save();progress();});
$('exercise-content').addEventListener('focusin',e=>{const f=e.target.closest('[data-field]');if(f)activateField(f.dataset.field);});
$('exercise-content').addEventListener('click',e=>{const evidence=e.target.closest('[data-evidence]');if(evidence)return selectEvidence(evidence.dataset.evidence);const clear=e.target.closest('[data-clear]');if(clear){const key=clear.dataset.clear;state.fields[key]='';$('field-'+key).value='';$('field-'+key).focus();save();progress();}const flag=e.target.closest('[data-flag]');if(flag){const id=flag.dataset.flag;state.flags=state.flags.includes(id)?state.flags.filter(f=>f!==id):[...state.flags,id];save();progress();}});
$('question-map').addEventListener('click',e=>{const b=e.target.closest('[data-jump]');if(!b)return;const id=b.dataset.jump,n=chapters.findIndex(c=>c.ids.includes(id));if(n!==state.chapter)setChapter(n,{focus:false});activeItem=id;state.activeItem=id;setPane('passage',{focus:mobile()});const target=$('item-'+id),field=target.querySelector('input[data-field],textarea[data-field]')||target.querySelector('button[data-evidence]');target.scrollIntoView({block:'center',behavior:'auto'});field?.focus({preventScroll:true});progress();rememberView();save();});
for(const event of ['mouseup','keyup'])$('transcript-cues').addEventListener(event,()=>{if($('tap-mode').checked)return;const s=getSelection(),paragraph=n=>(n?.nodeType===1?n:n?.parentElement)?.closest('[data-cue-text]');const a=paragraph(s?.anchorNode),f=paragraph(s?.focusNode);if(a&&a===f&&s.toString().trim())showSelection(s.toString());});
$('transcript-cues').addEventListener('click',e=>{const play=e.target.closest('[data-cue]');if(play){const c=data.transcript.find(c=>c.id===play.dataset.cue);return playClip({...c,label:c.speaker+' · '+clock(c.start)});}const word=e.target.closest('[data-word]');if(!word||!$('tap-mode').checked)return;const p=word.closest('[data-cue-text]'),index=+word.dataset.word;
 if(!tapStart||tapStart.cue!==p.dataset.cueText||currentWordRange){clearSelection();tapStart={cue:p.dataset.cueText,index};word.classList.add('picked');showSelection(word.textContent);$('selection-help').textContent='Chạm từ cuối của cụm, hoặc dùng ngay từ vừa chọn.';return;}
 const lo=Math.min(tapStart.index,index),hi=Math.max(tapStart.index,index);currentWordRange=[lo,hi];const words=[...p.querySelectorAll('[data-word]')];words.forEach(w=>w.classList.toggle('picked',+w.dataset.word>=lo&&+w.dataset.word<=hi));showSelection(words.filter(w=>+w.dataset.word>=lo&&+w.dataset.word<=hi).map(w=>w.textContent).join(' '));$('selection-help').textContent='Bấm “Dùng đoạn này” để thêm vào ô trả lời.';
});
$('tap-mode').onchange=()=>{clearSelection();$('transcript-cues').classList.toggle('tap-on',$('tap-mode').checked);$('selection-help').textContent=$('tap-mode').checked?'Chạm từ đầu, rồi chạm từ cuối của cụm muốn lấy.':'Bôi đen một cụm, rồi bấm “Dùng đoạn này”.';};
$('use-selection').onpointerdown=e=>e.preventDefault();$('use-selection').onclick=useSelection;$('clear-selection').onclick=clearSelection;
$('play').onclick=()=>audio.paused?playClip():stop();$('back').onclick=()=>{if(audioUrl)audio.currentTime=Math.max(clip.start,audio.currentTime-5);else toast('Bấm phát để chuẩn bị audio trước.');};
$('seek').oninput=()=>{if(audioUrl)audio.currentTime=+$('seek').value;else $('seek').value=clip.start;};$('speed').onchange=()=>audio.playbackRate=+$('speed').value;$('volume').oninput=()=>audio.volume=+$('volume').value;$('fallback').onclick=()=>playClip(null,true);
audio.addEventListener('play',renderPlay);audio.addEventListener('pause',renderPlay);audio.addEventListener('timeupdate',updateAudio);audio.addEventListener('ended',renderPlay);
$('font-down').onclick=()=>setFont(-10);$('font-up').onclick=()=>setFont(10);$('notes-button').onclick=()=>toggleNotes($('notes-panel').hidden);$('close-notes').onclick=()=>toggleNotes(false);$('notes').oninput=()=>{state.notes=$('notes').value;save();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('notes-panel').hidden)toggleNotes(false);});
$('next').onclick=()=>{if(state.chapter<2)setChapter(state.chapter+1);else{const blank=data.items.find(i=>!answer(i.id).trim())||data.items[0];document.querySelector(`[data-jump="${blank.id}"]`).click();}};
$('sample-feedback').onclick=sampleFeedback;$('history-button').onclick=history;bindDialog('explanation-dialog','close-review','sample-feedback');bindDialog('history-dialog','close-history','history-button');
for(const id of ['exercise','transcript-cues'])$(id).addEventListener('scroll',()=>{rememberView();save();},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();rememberView();save();}});window.addEventListener('pagehide',event=>{stop();rememberView();save();if(!event.persisted&&audioUrl)URL.revokeObjectURL(audioUrl);});
try{
 const r=await fetch(new URL('./content.json',import.meta.url),{cache:'no-store'});if(!r.ok)throw Error();data=await r.json();
 try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.fields&&[0,1,2].includes(s.chapter)&&Array.isArray(s.flags)&&Array.isArray(s.history))state={...state,...s,views:s.views||{},notes:typeof s.notes==='string'?s.notes:'',fontPercent:[90,100,110,120].includes(s.fontPercent)?s.fontPercent:100};}catch{}
 state.flags=state.flags.filter(id=>data.items.some(i=>i.id===id));state.history=state.history.slice(0,5);$('notes').value=state.notes;
 $('question-map').innerHTML=data.items.map(i=>`<button class="cbt-question-button" data-jump="${i.id}">${number(i.id)}</button>`).join('');renderTranscript();
 // Initial restoration keeps old answers. Only explicit part navigation resets context.
 const saved=state.views[state.chapter],savedItem=state.activeItem;render();activeItem=chapters[state.chapter].ids.includes(savedItem)?savedItem:chapters[state.chapter].ids[0];progress();setClip(chapters[state.chapter]);setPane(saved?.pane||(state.chapter===0?'passage':'questions'));
 $('loading').hidden=true;$('lesson').hidden=false;
 requestAnimationFrame(()=>{if(saved){$('exercise').scrollTop=saved.exercise||0;$('transcript-cues').scrollTop=saved.transcript||0;}else if(state.chapter>0)revealContext(state.chapter===1?'cue-5':'cue-12',state.chapter===1?'cue-5':'cue-12');});save();
}catch{$('loading').hidden=true;$('load-error').hidden=false;$('load-error').textContent='Chưa tải được bản thử. Hãy kiểm tra kết nối rồi tải lại trang; nháp đã lưu trên thiết bị vẫn được giữ.';}
