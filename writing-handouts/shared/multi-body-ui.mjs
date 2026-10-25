import {bodyView,bodyKey,bodyIndexOf,ideaPassed,available,isPrepared,bodyConfig} from './workflow.mjs?v=20261025-l11-ideas-v4';
import {wholeSections} from './whole-chain-ui.mjs';
import {renderRecap} from '../lesson5-thu/recovery-ui.mjs?v=20261025-l11-ideas-v4';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Cùng component Lesson 9; chỉ thêm phạm vi ID/action để hai body không nhận nhầm sự kiện.
export function scopeBodyMarkup(html,n){
 return html.replace(/\b(id|data-target|data-check|data-attest|data-count|data-edit|data-field|for)="([^"]+)"/g,(all,attr,key)=>{
  if(attr==='id'||attr==='for'){
   const m=/^(step-|field-|error-)(.+)$/.exec(key);
   if(m&&!bodyIndexOf(m[2]))return attr+'="'+m[1]+bodyKey(n,m[2])+'"';
   if(['topic','idea1','idea2','next-idea','completion'].includes(key))return attr+'="'+bodyKey(n,key)+'"';
  }else if(!bodyIndexOf(key))return attr+'="'+bodyKey(n,key)+'"';
  return all;
 });
}
export function renderMultiBodies(state,lesson,renderers){
 const preparation=isPrepared(lesson)?'<section class="section-group" id="outline"><div class="group-header"><div><span class="group-number" aria-hidden="true">1</span><h2>Chốt idea của cả hai thân bài</h2><p>Làm rõ phương án tốt hơn trước; chưa viết Topic sentence ở bước này.</p></div></div>'+renderers.stepCard('outline')+'</section>':'';
 if(isPrepared(lesson)&&state.steps.outline?.status!=='passed')return preparation+'<div class="lock-note">◌ &nbsp; Hai thân bài mở sau khi kế hoạch idea chung được thông qua.</div>';
 return preparation+lesson.bodies.map(base=>{
  const copy=bodyConfig(lesson,state,base.body);
  const n=copy.body,view=bodyView(state,n),prefix=k=>bodyKey(n,k);
  let html=wholeSections(view,{field:(name,disabled)=>renderers.field(prefix(name),disabled),comments:key=>renderers.comments(prefix(key)),stepCard:key=>renderers.stepCard(prefix(key))});
  html=html.replace('Chốt hai nguyên nhân để giải thích vì sao người ta theo thời trang.',esc(copy.topicInstruction))
   .replaceAll('Chốt điểm đầu và điểm cuối trước khi hoàn thiện cầu nối. Nhập đủ cả ba ô rồi Check một lần. AI sẽ đọc cả chuỗi để kiểm cách ý này giải thích WHY.',esc(copy.chainInstruction))
   .replace('Ý 2 cần có nguyên nhân hoặc cơ chế riêng; hai ý vẫn có thể cùng dẫn đến việc theo thời trang.',esc(copy.comparisonInstruction));
  if(isPrepared(lesson))html=html.replace('Ý tưởng & Topic sentence','Topic sentence');
  const done=ideaPassed(view,2),recap=done?'<div id="completion">'+renderRecap(view)+'</div>':'';
  return '<section class="handout-body" id="body'+n+'" data-body-index="'+n+'" aria-labelledby="body'+n+'-title"><div class="page-title body-title"><div><p class="kicker red">THÂN BÀI '+n+'</p><h2 id="body'+n+'-title">'+esc(copy.title)+'</h2><p>'+esc(copy.focus)+'</p></div><span class="badge '+(done?'passed':'')+'">'+(done?'✓ Đã hoàn thiện':'Thân bài '+n)+'</span></div>'+scopeBodyMarkup(html+recap,n)+'</section>';
 }).join('');
}
export function multiJourney(state,lesson){
 const nav=(id,title,sub,num,done,enabled)=>'<button class="nav-item '+(done?'done ':'')+(id!=='prompt'&&!done&&enabled?'active':'')+'" data-target="'+id+'" '+(enabled?'':'disabled')+'><span>'+(done?'✓':num)+'</span><span>'+esc(title)+'<small>'+esc(sub)+'</small></span></button>';
 const ready=!isPrepared(lesson)||state.steps.outline?.status==='passed';
 return nav('prompt','Đề bài','Đọc đề','?',false,true)+(isPrepared(lesson)?nav('outline','Chốt idea hai thân bài','Chưa viết Topic','1',ready,true):'')+lesson.bodies.map(({body:n})=>{
  const s=bodyView(state,n),topic=s.steps.topic.status==='passed';
  return '<div class="body-nav-group" role="group" aria-label="Thân bài '+n+'"><p class="kicker">Thân bài '+n+'</p>'+nav(bodyKey(n,'topic'),isPrepared(lesson)?'Topic sentence':'Ý tưởng & Topic',isPrepared(lesson)?'Từ hai idea đã chốt':'Chốt cả hai idea','1',topic,ready)+nav(bodyKey(n,'idea1'),'Lập luận ý 1','Check cả chuỗi','2',ideaPassed(s,1),ready&&available(s,'si1'))+nav(bodyKey(n,'idea2'),'Lập luận ý 2','Check cả chuỗi','3',ideaPassed(s,2),ready&&s.idea2Open)+nav(bodyKey(n,'completion'),'Bảng cuối','Nội dung & từ vựng','4',ideaPassed(s,2),ready&&ideaPassed(s,2))+'</div>';
 }).join('');
}
