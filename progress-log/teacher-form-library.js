// Ba nguồn kho dùng cùng dữ liệu/quyền thật; xem trước chạy renderer học viên trong kho demo.
import {bindDialogDismiss,node} from './session-comments.js';
import {reviewContent} from './docs-import-review.js?rev=20261025-docs-import-v1';
import {mountWorksheetFrame} from './worksheet-preview.js?rev=20261030-multi-limit-v1';
import {mountAssignmentManagement} from './thuy-live/assignment-management.js?rev=20261028-the15-v1';
const button=(label,action)=>{const b=node('button',label,'button');b.type='button';b.addEventListener('click',action);return b;};
const fold=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/giu,'d').toLocaleLowerCase('vi');
export function createFormLibrary({host,request,onCopy,onCreate=()=>{},onOpenDraft=()=>{},onCopyUsed=()=>{},onAssign=()=>{},onRefresh=()=>{},getClassContext=()=>({}),onManagementChanged=()=>{}}){
  let scope='izone',generation=0,lifecycle=0,entries=[],used=[],drafts=[],publicationRows=[],publications=new Map(),listSignature='';
  const dialogs=new Set(),managers=new Set();
  const sourceOperations=new Map();
  const heading=node('div','','thuy-library-heading'),create=button('+ Tạo bài tập',onCreate);create.classList.add('primary');heading.append(node('h1','Quản lý bài tập'),create);
  const panel=node('section','','thuy-library-panel'),nav=node('nav','','editor-library-tabs'),tools=node('div','','thuy-library-tools'),search=node('input'),status=node('span'),list=node('div');
  search.type='search';search.placeholder='Tìm tên bài tập';search.setAttribute('aria-label','Tìm bài tập');status.setAttribute('role','status');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Nguồn bài tập');
  const tabs=new Map(),sourceName=s=>({izone:'Kho chung',personal:'Kho cá nhân',used:'Phiếu đã giao'})[s];
  const matchedPublication=entry=>{const value=publications.get(entry.sourceDraftId||entry.draft?.id);return value&&value.revision===(entry.sourceRevision||entry.draft?.revision)?value:publicationRows.find(p=>p.libraryEntryId===entry.id||p.assignmentId===entry.id||entry.source==='used'&&entry.definition&&p.formVersionId===entry.definition.formVersionId)||entry.publication;};
  const all=()=>[...entries,...drafts,...used].map(entry=>({...entry,publication:matchedPublication(entry)}));
  const historyTools=node('div','','thuy-library-history');
  const publicationNotice=node('p','','notice thuy-publication-notice');publicationNotice.setAttribute('role','status');publicationNotice.hidden=true;let highlighted=null;
  const historyManagement=mountAssignmentManagement({host:historyTools,getContext:getClassContext,request,onChanged:onManagementChanged});for(const [index,control]of [...historyTools.children].entries())control.hidden=index<2;
  managers.add(historyManagement);
  function paint(){
    historyTools.hidden=scope!=='used';historyManagement.refresh();
    const values=all(),selected=values.filter(entry=>entry.source===scope&&fold(entry.title).includes(fold(search.value)));
    for(const [id,b]of tabs){b.setAttribute('aria-selected',String(scope===id));b.tabIndex=scope===id?0:-1;b.querySelector('span').textContent=String(values.filter(e=>e.source===id).length);}
    status.textContent=selected.length+' bài tập';
    const signature=JSON.stringify([scope,search.value,selected.map(e=>[e.id,e.source,e.title,e.meta,e.itemCount,e.publication])]);
    if(signature===listSignature)return;listSignature=signature;list.replaceChildren();
    if(!selected.length){list.append(node('p',scope==='izone'?'Chưa có bài chuẩn trong Kho chung.':scope==='personal'?'Chưa có bài trong Kho cá nhân.':'Chưa có phiếu đã giao phù hợp.','thuy-library-empty'));return;}
    const wrap=node('div','','thuy-library-scroll'),table=node('table'),head=node('tr'),thead=node('thead'),body=node('tbody');
    for(const title of ['Tên bài tập','Nguồn','']){const th=node('th',title);th.scope='col';head.append(th);}thead.append(head);table.append(thead,body);
    for(const entry of selected){
      const row=node('tr'),name=node('td'),open=button(entry.title,()=>void preview(entry));row.tabIndex=0;row.dataset.entryId=entry.id;row.classList.toggle('thuy-library-published',entry.id===highlighted);row.setAttribute('aria-label','Xem '+entry.title);open.className='thuy-library-name';
      name.append(open,node('small',entry.meta||`${entry.itemCount||0} câu`));const actions=node('td');
      if(entry.source!=='used'){const assign=button('Giao bài',()=>void assignEntry(entry));assign.classList.add('primary');actions.append(assign);}
      row.append(name,node('td',sourceName(entry.source)),actions);
      row.addEventListener('click',event=>{if(!event.target.closest('button,a')&&!getSelection()?.toString())void preview(entry);});
      row.addEventListener('keydown',event=>{if(event.target===row&&['Enter',' '].includes(event.key)){event.preventDefault();void preview(entry);}});body.append(row);
    }wrap.append(table);list.append(wrap);
  }
  async function load(){const run=++generation;status.textContent='Đang đọc kho…';
    try{const replies=await Promise.all(['izone','personal'].map(source=>request('/teacher/form-library?scope='+source).then(reply=>(reply.entries||[]).map(entry=>({...entry,source})))));if(run!==generation)return false;entries=replies.flat();paint();return true;}
    catch(error){if(run===generation){status.textContent='Chưa đọc được kho: '+error.message;const retry=button('Thử đọc lại kho',()=>void load());list.replaceChildren(retry);}return false;}
  }
  async function readEntry(entry){
    if(entry.definition&&entry.detail)return entry;
    const reply=await request(entry.draft?'/teacher/form-drafts/'+entry.id+(entry.draft.reviewMode?'/review':''):entry.source==='used'?'/teacher/dashboard?assignment='+encodeURIComponent(entry.id):'/teacher/form-library/'+entry.id);
    const detail=entry.draft?reply.draft:entry.source==='used'?reply.dashboard:reply.entry;
    if((entry.source==='used'?detail.assignmentId:detail.id)!==entry.id)throw Error('Nội dung trả về chưa khớp phiếu.');
    const full={...entry,detail,definition:detail.definition};full.publication=matchedPublication(full);return full;
  }
  async function assignEntry(entry){if(entry.source==='used')return;const run=lifecycle;try{
    const full=await readEntry(entry);
    if(run!==lifecycle)return;
    if(!full.publication&&!entry.draft){
      const source=entry.source==='used'?'assignment':'library',key=source+':'+entry.id;if(!sourceOperations.has(key))sourceOperations.set(key,crypto.randomUUID());
      const reply=await request('/teacher/form-publications/from-source',{method:'POST',body:{source,id:entry.id,operationId:sourceOperations.get(key)}});
      if(run!==lifecycle)return;
      full.publication=reply.publication;publicationRows.push(reply.publication);sourceOperations.delete(key);
    }
    if(!full.publication&&entry.draft){
      const reviews=full.detail.gradingKey?.importReviews||{},items=full.definition.blocks.flatMap(b=>b.items);
      const pending=items.map((item,index)=>reviews[item.itemVersionId]&&reviews[item.itemVersionId].reviewedContent!==reviewContent(item,full.detail.gradingKey)?index+1:null).filter(Boolean);
      if(pending.length)throw Error('Chưa thể giao: câu '+pending.join(', ')+' còn cảnh báo key chưa xử lý. Mở phiếu, bấm Sửa bài để bổ sung đáp án hoặc xác nhận chế độ không chấm.');
    }
    if(!full.publication&&!entry.draft)throw Error('Chưa chuẩn bị được phiên bản để giao; hãy thử lại.');await onAssign(full);
  }catch(error){if(run===lifecycle)status.textContent=error.message;}}
  async function preview(entry){
    const run=lifecycle;
    const opener=document.activeElement,dialog=node('dialog','','thuy-management-dialog thuy-library-detail'),head=node('header','','thuy-management-head'),body=node('div','','thuy-management-body'),notice=node('p','Đang đọc phiếu…');notice.setAttribute('role','status');
    const close=button('×',()=>dialog.close());close.setAttribute('aria-label','Đóng');
    const edit=button('Sửa bài',async()=>{try{const result=entry.draft?await onOpenDraft(entry):entry.source==='used'?await onCopyUsed(entry):await onCopy(entry);if(result!==false)dialog.close();}catch(error){notice.textContent=error.message;}});
    head.append(node('h2',entry.title),edit);
    if(entry.source!=='used'){const assign=button('Giao bài',()=>void assignEntry(entry));assign.classList.add('primary');head.append(assign);}
    head.append(close);body.append(notice);dialog.append(head,body);document.body.append(dialog);dialogs.add(dialog);bindDialogDismiss(dialog);dialog.showModal();
    dialog.addEventListener('close',()=>{dialogs.delete(dialog);dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});},{once:true});
    try{
      const full=await readEntry(entry);if(run!==lifecycle||!dialog.open)return;
      if(entry.source==='used'){
        const host=node('div','','thuy-assignment-actions');body.append(host);
        const a=entry.assignment;const management=mountAssignmentManagement({host,getContext:()=>({assignmentId:entry.id,classId:String(a.class_id),className:a.class_name,sessionNumber:Number(a.session_number),title:entry.title}),request,onChanged:onManagementChanged});managers.add(management);management.refresh();
      }
      const reply=await request(entry.draft?'/teacher/form-drafts/'+entry.id+'/preview-grant':entry.source==='used'?'/teacher/demo-grants':'/teacher/form-library/'+entry.id+'/preview-grant',
        {method:'POST',body:entry.draft?{expectedRevision:full.detail.revision}:entry.source==='used'?{assignmentId:entry.id}:{}});
      if(run!==lifecycle||!dialog.open)return;mountWorksheetFrame(body,{grant:reply.grant,title:entry.title});notice.hidden=true;
    }catch(error){notice.hidden=false;notice.textContent='Chưa mở được phiếu: '+error.message;body.append(button('Thử mở lại',()=>{dialog.close();void preview(entry);}));}
  }
  for(const [value,label]of [['izone','Kho chung'],['personal','Kho cá nhân'],['used','Phiếu đã giao']]){const b=button('',()=>{scope=value;paint();});b.setAttribute('role','tab');b.append(document.createTextNode(label+' '),node('span','0'));tabs.set(value,b);nav.append(b);}
  nav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const keys=[...tabs.keys()],index=keys.indexOf(scope);scope=keys[event.key==='Home'?0:event.key==='End'?keys.length-1:(index+(event.key==='ArrowRight'?1:keys.length-1))%keys.length];event.preventDefault();paint();tabs.get(scope).focus();});
  search.addEventListener('input',paint);tools.append(search,status);panel.append(nav,publicationNotice,tools,historyTools,list);host.append(heading,panel);paint();
  return {refresh:load,showPersonal(id,{published=false,error,retry}={}){
    scope='personal';search.value='';highlighted=id;listSignature='';paint();publicationNotice.hidden=false;
    publicationNotice.textContent=error?'Đã xuất bản thành công. Chưa cập nhật đủ danh sách kho: '+error:published?'Đã xuất bản thành công. Phiếu mới được đánh dấu trong Kho cá nhân.':'Đã xuất bản. Đang cập nhật Kho cá nhân…';
    if(retry)publicationNotice.append(button('Tải lại danh sách',async()=>{try{await retry();}catch(e){publicationNotice.firstChild.textContent='Đã xuất bản. Chưa tải lại được: '+e.message;}}));
    requestAnimationFrame(()=>{list.querySelector('[data-entry-id="'+CSS.escape(id)+'"]')?.scrollIntoView({block:'center'});});
  },setPublications(rows){publicationRows=rows;publications=new Map(rows.filter(row=>row.draftId).map(row=>[row.draftId,row]));paint();},setUsed(assignments){used=assignments.map(a=>({id:a.assignment_id,title:a.title,source:'used',meta:a.class_name+' · Buổi '+a.session_number,assignment:a}));paint();},setDrafts(rows){drafts=rows.map(d=>({id:d.id,title:d.definition?.title||d.title||'Phiếu chưa đặt tên',source:'personal',draft:d,sourceDraftId:d.id,definition:d.definition,meta:'Buổi '+d.sessionNumber+' · Bản '+d.revision+' · '+({draft:'Nháp',pending_review:'Chờ duyệt',approved:'Đã duyệt',published:'Đã xuất bản'}[d.status]||d.status)}));paint();},clear(){generation++;lifecycle++;publicationNotice.hidden=true;highlighted=null;for(const dialog of dialogs){dialog.close();dialog.remove();}dialogs.clear();for(const manager of managers)manager.dispose?.();managers.clear();managers.add(historyManagement);entries=[];used=[];drafts=[];publicationRows=[];publications.clear();sourceOperations.clear();listSignature='';list.replaceChildren();status.textContent='Đăng nhập để mở kho bài.';}};
}
