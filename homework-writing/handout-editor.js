import {draftKey,loadBackup,saveBackup} from './drafts.js';
import {handoutTablesHtml} from './handout-tables.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setupHandoutEditor(root,{person,assignment,save,isCurrent,onChange=()=>{}}){
 const storage=draftKey(person.id,assignment.id,'handout');let data,local,editing=false,dirty=false,pending=null,conflict=null,loaded=false,saving=null,mutation=0;
 const content=()=>root.querySelector('#handout-content'),status=()=>root.querySelector('#handout-status');
 const active=()=>root.isConnected&&isCurrent();
 function collect(){if(!local)return;root.querySelectorAll('[data-handout-path]').forEach(el=>{const p=JSON.parse(el.dataset.handoutPath);let dest=local;for(const k of p.slice(0,-1))dest=dest[k];dest[p.at(-1)]=el.value;});}
 async function backup(){collect();if(!data)return;try{await saveBackup(storage,{tables:local,baseRevision:data.revision,fingerprint:data.fingerprint,dirty,editing,pending});}catch{if(active())status().textContent='Chưa lưu dự phòng được; em giữ một bản sao trước khi rời trang.';}}
 const field=(label,value,path,small=false)=>`<label class="field handout-copy-field"><span>${esc(label)}</span>${small?`<input data-handout-path="${esc(JSON.stringify(path))}" value="${esc(value)}">`:`<textarea rows="3" data-handout-path="${esc(JSON.stringify(path))}">${esc(value)}</textarea>`}</label>`;
 function draw(){
  if(!active()||!data)return;
  const sourceBadge=root.querySelector('.handout-person .badge');
  if(data.sourceKind==='homework-created-trial')sourceBadge.textContent='Handout thử · Homework';
  else if(data.readMode==='homework-copy')sourceBadge.textContent='Bản sao Homework';
  else sourceBadge.textContent=data.tables.length?'Nguồn K67 · bản sao':'Chưa có handout';
  if(data.outlinePreview){
    content().innerHTML='<p class="section-note">'+esc(data.message||'')+'</p>'+handoutTablesHtml(data.tables,esc);
    return;
  }
  content().innerHTML=`<p class="section-note">${esc(data.message||'')}</p><div class="handout-copy-tools">${data.canEdit?`<button type="button" data-edit-handout ${editing?'hidden':''}>Chỉnh handout</button><button type="button" data-save-handout ${editing?'':'hidden'}>Lưu handout</button><button type="button" data-cancel-handout ${editing?'':'hidden'}>Hủy</button>`:'<span class="badge neutral">Chỉ đọc · lượt bài đã được nhận hoặc chưa đủ nguồn</span>'}<span data-handout-save-status role="status">${dirty?'Có chỉnh sửa chưa lưu':data.revision?'Đã lưu bản '+data.revision:'Bản sao nguồn chưa chỉnh'}</span></div><div data-handout-conflict></div>`+
   (editing?local.map((t,i)=>`<section class="handout-copy-table"><h3>${esc(t.title)}</h3>${field('Câu chủ đề',t.topicSentence,[i,'topicSentence'])}${t.rows.map((r,j)=>`<fieldset><legend>${esc(r.label)}</legend>${['A','X','B'].map(k=>`<section>${field(k+' · Nội dung',r[k].content,[i,'rows',j,k,'content'])}${r[k].keywords.map((w,n)=>`<div class="handout-keyword-edit">${field('Keyword tiếng Anh',w.en,[i,'rows',j,k,'keywords',n,'en'],true)}${field('Nghĩa tiếng Việt',w.vi,[i,'rows',j,k,'keywords',n,'vi'],true)}</div>`).join('')}</section>`).join('')}</fieldset>`).join('')}</section>`).join(''):handoutTablesHtml(data.tables,esc));
  content().querySelectorAll('[data-handout-path]').forEach(e=>e.oninput=()=>{collect();dirty=true;mutation++;pending=null;onChange();void backup();root.querySelector('[data-handout-save-status]').textContent='Có chỉnh sửa chưa lưu · đang giữ trên thiết bị';});
  const edit=root.querySelector('[data-edit-handout]');if(edit)edit.onclick=()=>{editing=true;local=structuredClone(data.tables);draw();void backup();};
  const cancel=root.querySelector('[data-cancel-handout]');if(cancel)cancel.onclick=()=>{editing=false;dirty=false;pending=null;conflict=null;local=structuredClone(data.tables);draw();void backup();};
  const button=root.querySelector('[data-save-handout]');if(button)button.onclick=()=>flush().catch(e=>{status().textContent=e.message;});
  if(conflict){
   const panel=root.querySelector('[data-handout-conflict]');panel.innerHTML=`<div class="error-panel"><p>Handout đã có bản mới. Bản em đang sửa vẫn còn trong các ô bên dưới.</p><details><summary>Đọc bản trên máy chủ</summary>${handoutTablesHtml(conflict.tables,esc)}</details><button type="button" data-use-server>Dùng bản máy chủ</button><button type="button" data-keep-local>Giữ bản em sửa để lưu lại</button></div>`;
   panel.querySelector('[data-use-server]').onclick=()=>{data=conflict;conflict=null;dirty=false;pending=null;local=structuredClone(data.tables);draw();void backup();};
   panel.querySelector('[data-keep-local]').onclick=()=>{collect();data=conflict;conflict=null;pending=null;dirty=true;draw();void backup();};
  }
 }
 async function receive(result){
  if(!active())return;
  if(dirty){if(result.fingerprint!==data.fingerprint){conflict=result;draw();}return;}
  data=result;local=structuredClone(result.tables);if(!loaded){loaded=true;const b=await loadBackup(storage).catch(()=>null);if(!active())return;
   if(b?.dirty&&result.canEdit){local=b.tables;editing=true;dirty=true;pending=b.pending;const server=data;data={...result,revision:b.baseRevision,fingerprint:b.fingerprint};if(server.revision!==b.baseRevision||server.fingerprint!==b.fingerprint)conflict=server;}
  }draw();
 }
 async function flush(){
  if(saving){await saving;return flush();}collect();if(!dirty)return data;
  if(conflict)throw Error('Em đối chiếu hai bản handout trước khi lưu hoặc nộp nhé.');
  if(!data.canEdit)throw Error('Lượt bài này không còn mở chỉnh handout.');
  const at=mutation,payload=pending||{expectedRevision:data.revision,sourceFingerprint:data.fingerprint,clientMutationId:crypto.randomUUID(),tables:structuredClone(local)};pending=payload;await backup();
  saving=(async()=>{try{const result=await save(payload);if(!active())return;data=result;pending=null;if(at===mutation){dirty=false;editing=false;local=structuredClone(result.tables);}else dirty=true;onChange();await backup();draw();status().textContent='Đã lưu handout trên Homework · bản '+result.revision;return result;}
   catch(e){if(active()){if(e.code==='HANDOUT_CONFLICT'){conflict=e.details.current;pending=null;draw();}status().textContent=e.message;}throw e;}finally{saving=null;}})();
  const saved=await saving;if(active()&&dirty&&!conflict)return flush();return saved;
 }
 return {receive,flush,backup,isDirty:()=>dirty,get revision(){return data?.revision??0;},get fingerprint(){return data?.fingerprint??null;}};
}
