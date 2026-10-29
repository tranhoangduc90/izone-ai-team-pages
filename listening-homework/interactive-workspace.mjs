import {downloadPreferred} from '../shared/audio/transport.mjs?v=20261027-l2-v1&audio=20261028-part-rescue-v1&ej=ej-a176e4d58d3089a76456';
import {decodeBody,encodeBody,encodeAnswer} from './answer-codec.mjs?v=20261028-integration1';
import {hasAnswerContent} from './answer-content.mjs?v=20261029-grading2';
export function createListeningWorkspace(options){
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep the original demo namespace and IDs so existing local drafts remain readable.

const chapters=[{title:'Nghe và điền từ',start:156,end:182.62,ids:['D1','D2','D3']},{title:'Phân tích câu 24',start:182.62,end:218.12,ids:Array.from({length:8},(_,i)=>'S'+(i+1))},{title:'Phân tích câu 25',start:218.46,end:246.96,ids:Array.from({length:11},(_,i)=>'S'+(i+9))}];
let data=options.data,state={fields:{},flags:[],chapter:0,history:[],notes:'',fontPercent:100,views:{},legacy:{},legacyOriginal:{}},activeItem='D1',activeField=null,selectedText='',tapStart=null,currentWordRange=null,toastTimer;
let audioTask=null,audioUrl=null,playIntent=0,clip={...chapters[0],label:chapters[0].title},lastCue=null,viewPane='passage',revealGeneration=0;
const audio=$('audio');audio.volume=.8;const lifetime=new AbortController();const scopeListen=(el,event,fn,opts={})=>el.addEventListener(event,fn,{...opts,signal:lifetime.signal});let destroyed=false,lastBody='',feedback=null,feedbackKey='',annotations=[],downloadAbort=null;let reviewOpener=null;
const mobile=()=>matchMedia('(max-width:980px)').matches;
const itemId=key=>key.replace(/(?:quote|choice|[abc])$/,'');
const number=id=>data?.items.findIndex(i=>i.id===id)+1;
const itemLabel=id=>'Mục '+number(id);
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);}
function getBody(){return encodeBody(state,data.items,annotations);}
function save(){
 if(destroyed)return;options.onView?.({chapter:state.chapter,fontPercent:state.fontPercent,activeItem,views:state.views});
 const next=JSON.stringify(getBody());if(!options.readonly&&next!==lastBody){lastBody=next;options.onChange?.();}
}
function answer(id){return Object.hasOwn(state.legacy,id)?state.legacy[id]:encodeAnswer(id,state.fields);}
function progress(){
 const done=data.items.filter(i=>hasAnswerContent(answer(i.id))).length;
 $('progress').textContent=`${done}/22 đã nhập`;
 chapters.forEach((c,n)=>$('count-'+n).textContent=c.ids.filter(id=>hasAnswerContent(answer(id))).length+'/'+c.ids.length);
 $('review-count').textContent=`${22-done} chưa nhập`;
 $('flag-summary').textContent=state.flags.length?state.flags.length+' đã đánh dấu':'';
 document.querySelectorAll('[data-jump]').forEach(b=>{const id=b.dataset.jump,filled=hasAnswerContent(answer(id)),flagged=state.flags.includes(id),active=id===activeItem;
  b.classList.toggle('is-answered',filled);b.classList.toggle('is-flagged',flagged);b.classList.toggle('is-active',active);b.setAttribute('aria-current',String(active));b.setAttribute('aria-label',[itemLabel(id),filled?'đã nhập':'chưa nhập',flagged?'đã đánh dấu':''].filter(Boolean).join(', '));});
 document.querySelectorAll('[data-flag]').forEach(b=>{const marked=state.flags.includes(b.dataset.flag);b.classList.toggle('is-flagged',marked);b.setAttribute('aria-pressed',String(marked));b.setAttribute('aria-label',(marked?'Bỏ đánh dấu ':'Đánh dấu ')+itemLabel(b.dataset.flag));});
}
function revealField(field){
 field.scrollIntoView({block:'center',behavior:'auto'});
 // Let responsive dock/viewport measurements settle before protecting the focused field.
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(!field.isConnected||document.activeElement!==field)return;
  const r=field.getBoundingClientRect(),dock=document.querySelector('.hw-question-dock').getBoundingClientRect(),box=$('exercise');
  let delta=r.bottom-Math.min(innerHeight,dock.top)+12;
  if(delta>0){const before=box.scrollTop;box.scrollTop+=delta;delta-=box.scrollTop-before;if(delta>0)window.scrollBy({top:delta,behavior:'instant'});}
 }));
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
function renderItem(item){return `<article class="item cbt-question-card" id="item-${item.id}" role="group" aria-labelledby="title-${item.id}"><div class="cbt-question-heading"><span class="cbt-question-number" aria-label="${itemLabel(item.id)}">${number(item.id)}</span><p id="title-${item.id}">${escape(item.question)}</p><button class="cbt-flag-button flag" data-flag="${item.id}" aria-pressed="false" aria-label="Đánh dấu ${itemLabel(item.id)}">⚑</button></div>${legacyBody(item)}<div id="feedback-${item.id}" class="hw-feedback"></div></article>`;}
function mcq(n){const q=data.questions.find(q=>q.number===n);return `<section class="mcq-context" aria-label="Câu hỏi gốc ${n}"><p class="hw-context-label">Câu hỏi IELTS gốc · Chọn ý trước, phân tích sau</p><article class="cbt-question-card"><div class="cbt-question-heading"><span class="cbt-question-number">${n}</span><p>${escape(q.stem)}</p></div><div class="cbt-choice-list">${Object.entries(q.options).map(([letter,text])=>`<label class="cbt-choice"><input type="radio" name="mcq${n}" data-field="mcq${n}" value="${letter}" ${state.fields['mcq'+n]===letter?'checked':''}><span class="cbt-choice-letter">${letter}</span><span>${escape(text)}</span></label>`).join('')}</div></article><p>Chọn ý chính rồi tìm dẫn chứng trong các mục ở dưới.</p></section>`;}
function blank(id,count,size=''){return `<span class="inline-blank ${size}" id="item-${id}"><span class="hw-blank-control"><input id="field-${id}" data-field="${id}" value="${escape(state.fields[id]||'')}" aria-label="${itemLabel(id)} · Điền ${count} từ" autocomplete="off" spellcheck="false"><button type="button" class="cbt-flag-button flag" data-flag="${id}" aria-pressed="false" aria-label="Đánh dấu ${itemLabel(id)}">⚑</button></span><label for="field-${id}">${itemLabel(id)} · ${count} từ</label><span id="feedback-${id}" class="hw-feedback"></span></span>`;}

function render(){
 const c=chapters[state.chapter];$('readingView').dataset.homeworkChapter=state.chapter;$('section-title').textContent='Listening · 22 mục';
 document.querySelectorAll('[data-chapter]').forEach(b=>{const selected=+b.dataset.chapter===state.chapter;b.classList.toggle('is-active',selected);if(selected)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 const range=[['1–3'],['4–11'],['12–22']][state.chapter][0];
 const head=`<header class="cbt-passage-header hw-group-heading"><h3>Mục ${range} · ${c.title}</h3><p>${state.chapter===0?'Nghe lại và điền trực tiếp vào câu. Gợi ý số từ nằm dưới mỗi ô.':'Chọn ý chính, tìm dẫn chứng và giải thích theo cách hiểu của bạn.'}</p></header>`;
 let body;
 if(state.chapter===0)body=`<div class="dictation-passage"><div class="dictation-line"><span class="speaker">Beth</span><p>OK. Now how are you finding the courses you’re taking this term, James?</p></div><div class="dictation-line"><span class="speaker">James</span><p>Well, I’m really enjoying the one on Swedish cinema.</p></div><div class="dictation-line"><span class="speaker">Beth</span><p>That’ll continue next term, but the one on Scandinavian literature that’s running at the moment ${blank('D1',3)} by more ${blank('D2',1,'short')} courses. Oh, and by the way, if you’re interested in watching Danish television programmes, there’s going to be a course on that ${blank('D3',4,'long')}.</p></div><div class="dictation-line"><span class="speaker">James</span><p>That sounds good.</p></div></div><p class="hw-dictation-help">Bạn có thể tạm dừng, lùi 5 giây và nghe lại phần đang luyện. Câu trả lời được giữ khi chuyển phần.</p>`;
 else body=mcq(state.chapter===1?24:25)+'<h4 class="hw-analysis-heading">Phân tích ý nghĩa và dẫn chứng</h4>'+data.items.filter(i=>c.ids.includes(i.id)).map(renderItem).join('');
 $('exercise-content').innerHTML=head+body;$('transcript-panel').hidden=state.chapter===0;$('pane-switch').hidden=state.chapter===0;
 $('next').textContent=state.chapter===0?'Sang câu 24 →':state.chapter===1?'Sang câu 25 →':'Rà lại các mục';
 $('content-viewport').dataset.fontSize=state.fontPercent;$('content-viewport').style.setProperty('--hw-scale',state.fontPercent/100);$('font-percent').textContent=state.fontPercent+'%';
 activeField=null;selectionTarget();clearSelection();progress();applyReadonly();paintFeedback();
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
 $('use-selection').disabled=options.readonly||!activeField;document.querySelectorAll('[data-slot]').forEach(e=>e.classList.toggle('active',e.dataset.slot===activeField));
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
 if(!activeField||!selectedText)return;const key=activeField,field=$('field-'+key);state.fields[key]=selectedText;field.value=selectedText;save();progress();clearSelection();setPane('passage',{focus:mobile()});field.focus({preventScroll:true});revealField(field);toast('Đã thêm vào '+itemLabel(itemId(key))+'. Bạn vẫn có thể sửa trực tiếp.');
}
function renderTranscript(){
 $('transcript-scope').textContent=data.transcriptScope.label;
 $('transcript-cues').innerHTML=data.transcript.map(c=>`<section class="cue" id="${c.id}" data-start="${c.start}" data-end="${c.end}"><div class="cue-head"><strong>${c.speaker}</strong><button class="cbt-tool-button" data-cue="${c.id}" aria-label="Nghe lời ${c.speaker} từ ${clock(c.start)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg> ${clock(c.start)}</button></div><p data-cue-text="${c.id}">${c.text.split(/(\s+)/).map((w,i)=>/^\s+$/.test(w)?w:`<span class="word" data-word="${i}">${escape(w)}</span>`).join('')}</p></section>`).join('');
}
function clock(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
function setClip(c){clip={start:c.start,end:c.end,label:c.title||c.label};if(audioUrl)audio.currentTime=clip.start;$('audio-label').textContent=clip.label;$('seek').min=clip.start;$('seek').max=clip.end;$('seek').value=clip.start;$('time').textContent=clock(clip.start)+' / '+clock(clip.end);}
async function prepareAudio(preferFallback=false){
 if(audioUrl)return;if(audioTask)return audioTask;
 $('play').disabled=true;$('audio-status').dataset.state='loading';$('audio-status').textContent='Đang chuẩn bị audio…';$('fallback').hidden=true;
 const work=(async()=>{
  downloadAbort=new AbortController();const signal=AbortSignal.any([lifetime.signal,downloadAbort.signal]);
  const manifest=await options.audioManifest();if(destroyed)throw new DOMException('Identity changed','AbortError');
  const blob=await downloadPreferred(manifest,{signal,preferFallback,onProgress:p=>{if(!destroyed)$('audio-status').textContent=`Đang tải audio · ${Math.min(100,Math.round(p.loaded/p.total*100))}%`;},onEvent:e=>{if(!destroyed&&e.source==='pages')$('audio-status').textContent='Đang tải từ nguồn dự phòng…';}});
  if(destroyed)throw new DOMException('Identity changed','AbortError');
  if(!blob)throw Error('Audio unavailable');audioUrl=URL.createObjectURL(blob);audio.src=audioUrl;
  await new Promise((resolve,reject)=>{if(audio.readyState>=1)return resolve();scopeListen(audio,'loadedmetadata',resolve,{once:true});scopeListen(audio,'error',reject,{once:true});});
  if(destroyed)throw new DOMException('Identity changed','AbortError');audio.currentTime=clip.start;$('audio-status').dataset.state='routine';$('audio-status').textContent='Sẵn sàng · Có thể nghe lại từng đoạn.';
 })();audioTask=work;
 try{await work;}finally{audioTask=null;$('play').disabled=false;}
}
function audioError(error){$('audio-status').dataset.state='error';const denied=error.accessDenied||error.status===401||error.status===403;$('audio-status').textContent=denied?'Chưa xác nhận được quyền audio. Hãy giữ bài và báo giáo viên.':error.name==='NotAllowedError'?'Audio đã sẵn sàng. Bấm phát để nghe.':'Chưa tải được audio. Bài đang nhập được giữ; hãy thử lại.';$('fallback').hidden=!!denied||error.name==='NotAllowedError';}
async function playClip(c,preferFallback=false){stop();if(c)setClip(c);const intent=++playIntent;try{await prepareAudio(preferFallback);if(intent!==playIntent||document.hidden)return;if(audio.currentTime<clip.start||audio.currentTime>=clip.end-.1)audio.currentTime=clip.start;audio.playbackRate=+$('speed').value;await audio.play();}catch(e){if(intent===playIntent)audioError(e);}}
function renderPlay(){const playing=!audio.paused;$('audio-status').dataset.state=playing?'routine':$('audio-status').dataset.state||'routine';$('play').innerHTML=playing?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';$('play').setAttribute('aria-label',playing?'Tạm dừng audio':'Phát đoạn đang luyện');}
function updateAudio(){const t=audio.currentTime;if(t>=clip.end&&!audio.paused){audio.pause();audio.currentTime=clip.end;}$('seek').value=Math.min(clip.end,Math.max(clip.start,t));$('time').textContent=clock(Math.max(clip.start,t))+' / '+clock(clip.end);const cue=data.transcript.find(c=>t>=c.start&&t<c.end);if(cue?.id!==lastCue){if(lastCue)$(lastCue)?.classList.remove('current');lastCue=cue?.id;if(lastCue)$(lastCue)?.classList.add('current');}}

function bindDialog(id,closeId,opener){const dialog=$(id);let outside=false;$(closeId).onclick=()=>dialog.close();scopeListen(dialog,'pointerdown',e=>{const r=dialog.getBoundingClientRect();outside=e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;});scopeListen(dialog,'pointerup',e=>{const r=dialog.getBoundingClientRect();if(outside&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();outside=false;});scopeListen(dialog,'close',()=>{if(id==='explanation-dialog')stop();if(!dialog.skipReturnFocus)(reviewOpener?.isConnected?reviewOpener:$(opener)).focus({preventScroll:true});reviewOpener=null;dialog.skipReturnFocus=false;});}

function legacyBody(item){
 if(Object.hasOwn(state.legacy,item.id))return `<div class="hw-legacy"><p>Giữ nguyên câu trả lời đã lưu. Bạn có thể tiếp tục sửa tại đây.</p><label class="visually-hidden" for="legacy-${item.id}">Câu trả lời ${itemLabel(item.id)}</label><textarea id="legacy-${item.id}" class="hw-short-answer" data-legacy="${item.id}">${escape(state.legacy[item.id])}</textarea><button class="cbt-tool-button" data-convert="${item.id}">Dùng ô tương tác</button></div>`;
 return itemBody(item)+(state.legacyOriginal[item.id]?`<details class="hw-legacy-original"><summary>Câu trả lời trước khi chuyển ô</summary><p>${escape(state.legacyOriginal[item.id])}</p></details>`:'');
}
function applyReadonly(){
 for(const el of $('exercise-content').querySelectorAll('input,textarea')){if(el.type==='radio')el.disabled=options.readonly;else el.readOnly=options.readonly;}
 for(const el of $('exercise-content').querySelectorAll('[data-flag],[data-evidence],[data-clear],[data-convert]'))el.disabled=options.readonly;
 $('notes').readOnly=options.readonly;$('use-selection').disabled=options.readonly||!activeField;
}
function paintFeedback(){
 $('sample-feedback').textContent='Xem góp ý';$('sample-feedback').disabled=!feedback;
 for(const item of data.items){const node=$('feedback-'+item.id);if(!node)continue;const f=feedback?.items.find(i=>i.id===item.id)?.feedback;
  const key=JSON.stringify([feedback?.attemptId,f]);if(node.dataset.key===key)continue;node.dataset.key=key;node.replaceChildren();if(!f)continue;
  const label=document.createElement('strong');label.textContent=statusLabel(f)+(f.totalUnits>1?` · ${f.metUnits}/${f.totalUnits} ý`:'');
  const button=document.createElement('button');button.className='cbt-tool-button';button.dataset.review=item.id;button.textContent='Xem đối chiếu';node.append(label,button);node.className='hw-feedback '+f.status;
 }
}
function statusLabel(f){return {correct:'Đạt ý',partial:'Cần bổ sung',incorrect:'Cần đối chiếu lại',blank:'Chưa trả lời'}[f.status]||'Góp ý';}
function openReview(id,opener){
 const row=feedback?.items.find(i=>i.id===id);if(!row)return;stop();reviewOpener=opener;
 const item=data.items.find(i=>i.id===id),f=row.feedback,context=item.evidenceContext;
 const first=context?.contextCue||'cue-1',last=context?.targetCue||'cue-4',from=data.transcript.findIndex(c=>c.id===first),to=data.transcript.findIndex(c=>c.id===last);
 const cues=data.transcript.slice(from,to+1),start=cues[0].start,end=cues.at(-1).end;
 $('review-title').textContent='Góp ý · '+itemLabel(id);$('explanation-dialog').dataset.feedbackStatus=f.status;
 $('review-content').innerHTML=`<div class="explanation-dialog-columns"><section class="explanation-dialog-passage"><div class="explanation-dialog-pane-head"><strong>Transcript</strong><span>${clock(start)}–${clock(end)}</span></div><div class="explanation-dialog-passage-scroll">${cues.map(c=>`<strong>${escape(c.speaker)}</strong><p>${escape(c.text)}</p>`).join('')}<button id="replay-review" class="replay-button">▷ Nghe lại đoạn dẫn chứng</button></div></section><section class="explanation-dialog-detail"><div class="explanation-dialog-detail-scroll"><p class="hw-review-caption">${escape(item.question)}</p><p class="hw-review-caption">Bản nộp · ${escape(feedback.label)}</p><h3 class="hw-review-status">${escape(statusLabel(f))}${f.totalUnits>1?` · ${f.metUnits}/${f.totalUnits} ý`:''}</h3><blockquote class="hw-review-quote">${escape(row.answer||'(Chưa trả lời)')}</blockquote><p>${escape(f.reason)}</p>${f.nextStep?`<p><strong>Bước tiếp theo:</strong> ${escape(f.nextStep)}</p>`:''}${f.writingNotes?.length?`<p>Góp ý cách viết: ${escape(f.writingNotes.join(' '))}</p>`:''}${f.modelAnswer?`<details><summary>Đối chiếu đáp án gợi ý</summary><p>${escape(f.modelAnswer)}</p></details>`:''}</div></section></div><div class="hw-review-actions"><button id="revise-item" class="button">${options.readonly?'Về '+itemLabel(id):'Về '+itemLabel(id)+' để bổ sung'} →</button></div>`;
 $('replay-review').onclick=()=>playClip({start,end,label:'Dẫn chứng · '+itemLabel(id)});
 $('revise-item').onclick=()=>{$('explanation-dialog').skipReturnFocus=true;$('explanation-dialog').close();document.querySelector(`[data-jump="${id}"]`).click();};$('explanation-dialog').showModal();
}
function setFeedback(value){
 const key=JSON.stringify(value);if(key===feedbackKey)return;feedbackKey=key;
 if(feedback?.attemptId!==value?.attemptId&&$('explanation-dialog').open)$('explanation-dialog').close();
 feedback=value;paintFeedback();
}
function setBody(value,{restart=false}={}){
 if(restart){stop();state.chapter=0;state.views={};activeItem=data.items[0].id;setClip(chapters[0]);}
 annotations=value.annotations||[];const decoded=decodeBody(value,data.items);Object.assign(state,decoded,{notes:value.notes||'',flags:data.items.filter((i,n)=>(value.flags||[]).includes(n+1)).map(i=>i.id)});
 render();lastBody=JSON.stringify(getBody());$('notes').value=state.notes;setPane(state.chapter===0?'passage':'questions');options.onReady?.();
}
function setFont(delta){state.fontPercent=Math.min(120,Math.max(90,state.fontPercent+delta));$('content-viewport').dataset.fontSize=state.fontPercent;$('content-viewport').style.setProperty('--hw-scale',state.fontPercent/100);$('font-percent').textContent=state.fontPercent+'%';save();}
function toggleNotes(open){$('notes-panel').hidden=!open;$('notes-button').setAttribute('aria-expanded',String(open));if(open)$('notes').focus();else $('notes-button').focus();}
document.querySelectorAll('[data-chapter]').forEach(b=>b.onclick=()=>setChapter(+b.dataset.chapter));
document.querySelectorAll('[data-pane]').forEach(b=>b.onclick=()=>{setPane(b.dataset.pane,{focus:true});rememberView();save();});
$('return-exercise').onclick=()=>{setPane('passage',{focus:true});const field=activeField?$('field-'+activeField):$('exercise');field?.focus({preventScroll:true});if(field)revealField(field);};
$('exercise-content').oninput=e=>{if(options.readonly)return;const legacy=e.target.closest('[data-legacy]');if(legacy){state.legacy[legacy.dataset.legacy]=legacy.value;}else{const f=e.target.closest('[data-field]');if(!f)return;state.fields[f.dataset.field]=f.value;}rememberView();save();progress();};
scopeListen($('exercise-content'),'focusin',e=>{
 const f=e.target.closest('[data-field]');if(!f)return;
 if(f.type==='radio'){const id=itemId(f.dataset.field);if(data.items.some(i=>i.id===id))activeItem=id;activeField=null;selectionTarget();clearSelection();progress();return;}
 activateField(f.dataset.field);if(mobile()||matchMedia('(max-height:760px)').matches)revealField(f);
});
$('exercise-content').onclick=e=>{const review=e.target.closest('[data-review]');if(review)return openReview(review.dataset.review,review);if(options.readonly)return;const convert=e.target.closest('[data-convert]');if(convert){const id=convert.dataset.convert;state.legacyOriginal[id]=state.legacy[id];delete state.legacy[id];render();save();return;}const evidence=e.target.closest('[data-evidence]');if(evidence)return selectEvidence(evidence.dataset.evidence);const clear=e.target.closest('[data-clear]');if(clear){const key=clear.dataset.clear;state.fields[key]='';$('field-'+key).value='';$('field-'+key).focus();save();progress();}const flag=e.target.closest('[data-flag]');if(flag){const id=flag.dataset.flag;state.flags=state.flags.includes(id)?state.flags.filter(f=>f!==id):[...state.flags,id];save();progress();}};
scopeListen($('question-map'),'click',e=>{const b=e.target.closest('[data-jump]');if(!b)return;const id=b.dataset.jump,n=chapters.findIndex(c=>c.ids.includes(id));if(n!==state.chapter)setChapter(n,{focus:false});activeItem=id;state.activeItem=id;setPane('passage',{focus:mobile()});const target=$('item-'+id),field=target.querySelector('[data-legacy],input[data-field],textarea[data-field]')||target.querySelector('button[data-evidence]');target.scrollIntoView({block:'center',behavior:'auto'});field?.focus({preventScroll:true});if(field)revealField(field);progress();rememberView();save();});
for(const event of ['mouseup','keyup'])scopeListen($('transcript-cues'),event,()=>{if($('tap-mode').checked)return;const s=getSelection(),paragraph=n=>(n?.nodeType===1?n:n?.parentElement)?.closest('[data-cue-text]');const a=paragraph(s?.anchorNode),f=paragraph(s?.focusNode);if(a&&a===f&&s.toString().trim())showSelection(s.toString());});
scopeListen($('transcript-cues'),'click',e=>{const play=e.target.closest('[data-cue]');if(play){const c=data.transcript.find(c=>c.id===play.dataset.cue);return playClip({...c,label:c.speaker+' · '+clock(c.start)});}const word=e.target.closest('[data-word]');if(!word||!$('tap-mode').checked)return;const p=word.closest('[data-cue-text]'),index=+word.dataset.word;
 if(!tapStart||tapStart.cue!==p.dataset.cueText||currentWordRange){clearSelection();tapStart={cue:p.dataset.cueText,index};word.classList.add('picked');showSelection(word.textContent);$('selection-help').textContent='Chạm từ cuối của cụm, hoặc dùng ngay từ vừa chọn.';return;}
 const lo=Math.min(tapStart.index,index),hi=Math.max(tapStart.index,index);currentWordRange=[lo,hi];const words=[...p.querySelectorAll('[data-word]')];words.forEach(w=>w.classList.toggle('picked',+w.dataset.word>=lo&&+w.dataset.word<=hi));showSelection(words.filter(w=>+w.dataset.word>=lo&&+w.dataset.word<=hi).map(w=>w.textContent).join(' '));$('selection-help').textContent='Bấm “Dùng đoạn này” để thêm vào ô trả lời.';
});
$('tap-mode').onchange=()=>{clearSelection();$('transcript-cues').classList.toggle('tap-on',$('tap-mode').checked);$('selection-help').textContent=$('tap-mode').checked?'Chạm từ đầu, rồi chạm từ cuối của cụm muốn lấy.':'Bôi đen một cụm, rồi bấm “Dùng đoạn này”.';};
$('use-selection').onpointerdown=e=>e.preventDefault();$('use-selection').onclick=()=>{if(!options.readonly)useSelection();};$('clear-selection').onclick=clearSelection;
$('play').onclick=()=>audio.paused?playClip():stop();$('back').onclick=()=>{if(audioUrl)audio.currentTime=Math.max(clip.start,audio.currentTime-5);else toast('Bấm phát để chuẩn bị audio trước.');};
$('seek').oninput=()=>{if(audioUrl)audio.currentTime=+$('seek').value;else $('seek').value=clip.start;};$('speed').onchange=()=>audio.playbackRate=+$('speed').value;$('volume').oninput=()=>audio.volume=+$('volume').value;$('fallback').onclick=()=>playClip(null,true);
scopeListen(audio,'play',renderPlay);scopeListen(audio,'pause',renderPlay);scopeListen(audio,'timeupdate',updateAudio);scopeListen(audio,'ended',renderPlay);
$('font-down').onclick=()=>setFont(-10);$('font-up').onclick=()=>setFont(10);$('notes-button').onclick=()=>toggleNotes($('notes-panel').hidden);$('close-notes').onclick=()=>toggleNotes(false);$('notes').oninput=()=>{state.notes=$('notes').value;save();};
scopeListen(document,'keydown',e=>{if(e.key==='Escape'&&!$('notes-panel').hidden)toggleNotes(false);});
$('next').onclick=()=>{if(state.chapter<2)setChapter(state.chapter+1);else{const blank=data.items.find(i=>!hasAnswerContent(answer(i.id)))||data.items[0];document.querySelector(`[data-jump="${blank.id}"]`).click();}};
$('sample-feedback').onclick=()=>openReview(feedback?.items.find(i=>i.feedback.status!=='correct')?.id||feedback?.items[0]?.id,$('sample-feedback'));$('history-button').onclick=()=>options.onHistory?.();bindDialog('explanation-dialog','close-review','sample-feedback');
for(const id of ['exercise','transcript-cues'])scopeListen($(id),'scroll',()=>{rememberView();save();},{passive:true});
scopeListen(document,'visibilitychange',()=>{if(document.hidden){stop();downloadAbort?.abort();rememberView();save();}});scopeListen(window,'pagehide',()=>{stop();downloadAbort?.abort();rememberView();save();});

Object.assign(state,{chapter:options.initialView?.chapter||0,fontPercent:options.initialView?.fontPercent||100,views:options.initialView?.views||{}});
if(![0,1,2].includes(state.chapter))state.chapter=0;
$('question-map').innerHTML=data.items.map(i=>`<button class="cbt-question-button" data-jump="${i.id}">${number(i.id)}</button>`).join('');renderTranscript();setBody(options.body||{answers:{},annotations:[],notes:'',flags:[]});setClip(chapters[state.chapter]);
const dockObserver=new ResizeObserver(()=>document.body.style.setProperty('--hw-dock-height',Math.ceil(document.querySelector('.hw-question-dock').getBoundingClientRect().height)+'px'));dockObserver.observe(document.querySelector('.hw-question-dock'));
$('lesson').hidden=false;
requestAnimationFrame(()=>{if(state.chapter>0)revealContext(state.chapter===1?'cue-5':'cue-12',state.chapter===1?'cue-5':'cue-12');});
return {getBody,setBody,setFeedback,stop,openReview,destroy(){destroyed=true;dockObserver.disconnect();stop();lifetime.abort();clearTimeout(toastTimer);if(audioUrl)URL.revokeObjectURL(audioUrl);audio.removeAttribute('src');if($('explanation-dialog').open)$('explanation-dialog').close();}};
}
