// Kho thật: API và các phiếu được cấp quyền. Không dùng storage hay bài giả của demo.
import {comparisonTable} from './thuy-live/comparison-table.js?rev=20261022-parity-v1';
import {questionPresentation} from './thuy-live/question-presentation.js?rev=20261022-parity-v1';
import {bindDialogDismiss,node} from './session-comments.js';
const button=(text,action)=>{const b=node('button',text,'button');b.type='button';b.addEventListener('click',action);return b;};
const skills={general:'Chung',reflection:'Tự nhìn lại',listening:'Listening',reading:'Reading',speaking:'Speaking',writing:'Writing'};
const fold=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/giu,'d').toLocaleLowerCase('vi');
export function createFormLibrary({host,request,onCopy,onCreate=()=>{},onOpenDraft=()=>{},onCopyUsed=()=>{}}){
 let scope='all',generation=0,usedGeneration=0,entries=[],used=[],drafts=[];
 const heading=node('div','','thuy-library-heading'),create=button('+ Tạo bài tập',onCreate);create.classList.add('primary');heading.append(node('h1','Quản lý bài tập'),create);
 const panel=node('section','','thuy-library-panel'),nav=node('nav','','editor-library-tabs'),tools=node('div','','thuy-library-tools'),filter=node('select'),search=node('input'),status=node('span'),list=node('div');
 nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Nguồn bài tập');
 search.type='search';search.placeholder='Tìm tên bài tập';search.setAttribute('aria-label','Tìm bài tập');filter.setAttribute('aria-label','Lọc kỹ năng trong kho phiếu');status.setAttribute('role','status');
 for(const [value,label]of [['','Tất cả kỹ năng'],...Object.entries(skills)]){const o=node('option',label);o.value=value;filter.append(o);}
 const tabs=new Map(),sourceName=s=>({izone:'Kho IZONE',personal:'Của tôi',used:'Phiếu đã dùng',review:'Chờ bạn duyệt'})[s],all=()=>[...entries,...drafts,...used];
 function paint(){
  const selected=all().filter(e=>(scope==='all'||e.source===scope)&&(!filter.value||(e.skills||[]).includes(filter.value))&&fold(e.title).includes(fold(search.value)));
  for(const [id,b]of tabs){b.hidden=id==='review'&&!drafts.some(d=>d.source==='review');b.setAttribute('aria-selected',String(scope===id));b.tabIndex=scope===id?0:-1;b.querySelector('span').textContent=String(all().filter(e=>id==='all'||e.source===id).length);}
  status.textContent=selected.length+' bài tập';list.replaceChildren();
  if(!selected.length){const empty=node('div','','thuy-library-empty');empty.append(node('h3',scope==='izone'?'Chưa có bài chuẩn trong Kho IZONE':scope==='personal'?'Chưa có bài riêng':'Không tìm thấy bài tập'),node('p',scope==='izone'?'Người phụ trách cần chuẩn bị và duyệt bộ bài chuẩn. Phiếu đã dùng không tự trở thành bài chuẩn.':'Tạo bài mới hoặc thử tên, kỹ năng khác.'));if(search.value||filter.value)empty.append(button('Bỏ bộ lọc',()=>{search.value='';filter.value='';paint();}));list.append(empty);return;}
  const wrap=node('div','','thuy-library-scroll'),table=node('table'),thead=node('thead'),head=node('tr'),body=node('tbody');
  for(const title of ['Tên bài tập','Kỹ năng','Nguồn']){const th=node('th',title);th.scope='col';head.append(th);}thead.append(head);table.append(thead,body);
  for(const entry of selected){const row=node('tr');row.tabIndex=0;row.setAttribute('aria-label','Xem '+entry.title);const name=node('td'),open=button(entry.title,()=>void preview(entry));open.className='thuy-library-name';
   name.append(open,node('small',entry.meta||entry.itemCount+' câu · '+new Date(entry.createdAt).toLocaleDateString('vi-VN')));const tags=node('td');
   for(const skill of entry.skills||[])tags.append(node('span',skills[skill]||skill,'badge blue'));if(!entry.skills?.length)tags.append(node('small',entry.source==='used'||entry.draft&&!entry.definition?'Chưa đọc kỹ năng':'Chưa chọn kỹ năng'));
   row.append(name,tags,node('td',sourceName(entry.source)));
   row.addEventListener('click',event=>{if(!event.target.closest('button,a')&&!window.getSelection()?.toString())void preview(entry);});row.addEventListener('keydown',event=>{if(event.target===row&&['Enter',' '].includes(event.key)){event.preventDefault();void preview(entry);}});body.append(row);
  }wrap.append(table);list.append(wrap);
 }
 async function load(){const run=++generation;status.textContent='Đang đọc kho…';
  try{const replies=await Promise.all(['izone','personal'].map(s=>request('/teacher/form-library?scope='+s+'&skill=').then(r=>r.entries.map(e=>({...e,source:s})))));if(run!==generation)return;entries=replies.flat();paint();}
  catch(error){if(run===generation)status.textContent='Chưa đọc được kho: '+error.message;}
 }
 async function hydrateUsed(rows,run){
  for(let offset=0;offset<rows.length;offset+=3){
   await Promise.all(rows.slice(offset,offset+3).map(async entry=>{try{
    const reply=await request('/teacher/dashboard?assignment='+encodeURIComponent(entry.id));if(run!==usedGeneration)return;
    if(reply.dashboard?.assignmentId!==entry.id)throw Error('Nội dung phiếu chưa khớp.');
    entry.definition=reply.dashboard.definition;const items=entry.definition.blocks.flatMap(b=>b.items);
    entry.skills=[...new Set(items.flatMap(i=>i.skillCodes||[]))];if(!entry.skills.length)entry.skills=['general'];
    const count=new Set(items.map(i=>{const label=String(i.displayNumber||i.position);return i.layoutType==='keyword_selection'?label.replace(/^(\d+)[A-Z]$/u,'$1'):label;})).size;
    entry.meta=entry.assignment.class_name+' · Buổi '+entry.assignment.session_number+' · '+count+' câu';
   }catch(error){if(run===usedGeneration)entry.readError=error.message;}}));
   if(run!==usedGeneration)return;paint();
  }
  if(run===usedGeneration&&rows.some(e=>e.readError)){const retry=button('Thử đọc lại kỹ năng',()=>{for(const e of rows)delete e.readError;void hydrateUsed(rows,++usedGeneration);});list.prepend(node('p','Một số phiếu chưa đọc được kỹ năng. Nội dung chưa được tính vào bộ lọc kỹ năng.'),retry);}
 }
 async function preview(entry){
  const opener=document.activeElement,d=node('dialog','','thuy-management-dialog'),head=node('header','','thuy-management-head'),body=node('div','','thuy-management-body');
  const close=button('×',()=>d.close());close.setAttribute('aria-label','Đóng');
  head.append(node('h2',entry.title),button(entry.source==='used'?'Tạo bản riêng':'Sửa bài tập',async()=>{const result=entry.draft?await onOpenDraft(entry):entry.source==='used'?await onCopyUsed(entry):await onCopy(entry);if(result!==false)d.close();}),close);d.append(head,body);body.append(node('p','Đang tải nội dung…'));document.body.append(d);bindDialogDismiss(d);d.showModal();
  d.addEventListener('close',()=>{d.remove();if(opener?.isConnected)opener.focus();},{once:true});
  try{
   let definition=entry.definition;
   if(!definition){const reply=entry.draft?await request('/teacher/form-drafts/'+entry.id+(entry.draft.reviewMode?'/review':'')):entry.source==='used'?await request('/teacher/dashboard?assignment='+encodeURIComponent(entry.id)):await request('/teacher/form-library/'+entry.id);if(!d.open)return;
    if(entry.draft){if(reply.draft.id!==entry.id)throw Error('Nháp trả về chưa khớp.');definition=reply.draft.definition;}
    else if(entry.source==='used'){if(reply.dashboard.assignmentId!==entry.id)throw Error('Phiếu trả về chưa khớp.');definition=reply.dashboard.definition;}
    else{if(reply.entry.id!==entry.id)throw Error('Phiếu trả về chưa khớp.');definition=reply.entry.definition;}}
   if(!d.open)return;body.replaceChildren();if(definition.instructions)body.append(node('p',definition.instructions));
   for(const block of definition.blocks){body.append(node('h3',block.title));if(block.instructions)body.append(node('p',block.instructions));const comparison=block.items.filter(i=>i.groupId==='comparison-reading'&&i.layoutType==='numbered_short_texts');
    let comparisonRendered=false,previousNumber=null;
    for(const item of block.items){
     if(comparison.length===2&&comparison.includes(item)){if(!comparisonRendered){const table=comparisonTable(comparison,{valueFor:()=>[],onChange:()=>{},resizeInput:()=>{}});for(const input of table.querySelectorAll('textarea')){input.disabled=true;input.placeholder='…';}body.append(table);comparisonRendered=true;}continue;}
     const raw=String(item.displayNumber||item.position),number=raw.match(/^\d+/u)?.[0]||raw;
     const display=questionPresentation({...item,displayNumber:number}),card=node('section');
     if(number!==previousNumber){body.append(node('h3','Câu '+number));previousNumber=number;}
     card.append(node('b',display.title));if(item.helpText)card.append(node('p',item.helpText));
     if(item.layoutType==='keyword_selection')card.append(node('p',(item.options||[]).map(o=>o.label).join(' ')));
     else for(const option of item.options||[])card.append(node('p',option.label));
     for(const line of item.interactionConfig?.sentenceLines||[])card.append(node('p',line.parts.join(' […] ')));body.append(card);
    }}
  }catch(error){body.replaceChildren(node('p',error.message));}
 }
 for(const [value,label]of [['all','Tất cả'],['izone','Kho IZONE'],['used','Phiếu đã dùng'],['personal','Của tôi'],['review','Chờ bạn duyệt']]){const b=button('',()=>{scope=value;paint();});b.setAttribute('role','tab');b.append(document.createTextNode(label+' '),node('span','0'));tabs.set(value,b);nav.append(b);}
 nav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const values=[...tabs.keys()].filter(key=>!tabs.get(key).hidden),i=values.indexOf(scope);scope=values[event.key==='Home'?0:event.key==='End'?values.length-1:(i+(event.key==='ArrowRight'?1:values.length-1))%values.length];event.preventDefault();paint();tabs.get(scope).focus();});
 search.addEventListener('input',paint);filter.addEventListener('change',async()=>{
  const unresolved=drafts.filter(e=>!e.definition),run=usedGeneration;
  if(filter.value&&unresolved.length){filter.disabled=true;status.textContent='Đang đọc kỹ năng nháp…';try{
   for(let offset=0;offset<unresolved.length;offset+=3)await Promise.all(unresolved.slice(offset,offset+3).map(async entry=>{
    const reply=await request('/teacher/form-drafts/'+entry.id+(entry.draft.reviewMode?'/review':''));if(run!==usedGeneration)return;if(reply.draft.id!==entry.id)throw Error('Nháp trả về chưa khớp.');entry.definition=reply.draft.definition;entry.skills=[...new Set(entry.definition.blocks.flatMap(b=>b.items).flatMap(i=>i.skillCodes||[]))];if(!entry.skills.length)entry.skills=['general'];
   }));
  }catch(error){status.textContent='Chưa đọc đủ kỹ năng: '+error.message;return;}finally{filter.disabled=false;}}
  if(run===usedGeneration)paint();
 });tools.append(search,filter,status);panel.append(nav,tools,list);host.append(heading,panel);paint();
 return {refresh:load,setUsed(assignments){used=assignments.map(a=>({id:a.assignment_id,title:a.title,source:'used',meta:a.class_name+' · Buổi '+a.session_number,skills:a.skills||[],assignment:a}));paint();void hydrateUsed(used,++usedGeneration);},setDrafts(values){drafts=values.map(d=>({id:d.id,title:d.definition?.title||d.title||'Phiếu chưa đặt tên',source:d.reviewMode?'review':'personal',draft:d,definition:d.definition,skills:[...new Set((d.definition?.blocks||[]).flatMap(b=>b.items).flatMap(i=>i.skillCodes||[]))],meta:'Buổi '+d.sessionNumber+' · Bản '+d.revision+' · '+({draft:'Nháp',pending_review:'Chờ duyệt',approved:'Đã duyệt',published:'Đã phát hành'}[d.status]||d.status)}));paint();},clear(){generation++;usedGeneration++;entries=[];drafts=[];used=[];list.replaceChildren();status.textContent='Đăng nhập để mở kho bài.';}};
}
