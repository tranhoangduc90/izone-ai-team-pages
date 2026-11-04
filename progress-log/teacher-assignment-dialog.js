// Giao đúng bản đã xuất bản; giữ từng dòng đích và mã retry khi có lỗi một phần.
import {bindDialogDismiss,node} from './session-comments.js';
const button=(label,action)=>{const b=node('button',label,'button');b.type='button';b.addEventListener('click',action);return b;};
const slotLabels={occupied:'Đã có phiếu',needs_confirmation:'Chờ xác nhận',needs_review:'Cần đối chiếu',unavailable:'Chưa đọc được lịch ERP'};
const scheduleLabels={empty:'Chưa có lịch ERP có thể dùng cho lớp này.',unavailable:'Chưa đọc được lịch ERP của lớp.',
  unconfirmed:'Lịch ERP của lớp chưa được xác nhận.',needs_review:'Lịch ERP của lớp cần đối chiếu.'};
const rosterLabels={empty:'Lớp chưa có học viên hợp lệ.',unverified:'Danh sách học viên của lớp cần đối chiếu ERP.'};
const refreshErrors=new Set(['ERP_SESSION_NOT_CONFIRMED','ERP_SCHEDULE_UNAVAILABLE','ERP_SESSION_REVIEW_REQUIRED',
  'ASSIGNMENT_SESSION_CONFLICT','DRAFT_ROSTER_UNVERIFIED','DRAFT_ROSTER_CHANGED','CLASS_ACCESS_DENIED']);
const displayDate=date=>date?' · '+date.split('-').reverse().join('/'):'';
export function createAssignmentDialog({request,getClasses,getPreferredClass,onAssigned=()=>{},onConfirmSchedule}){
  const pending=new Map();let lifecycle=0;
  return {open(entry){
    if(!entry.publication?.id&&!entry.draft?.id)throw Error('Chưa xác định được phiếu cần giao.');
    const viewKey=entry.source+':'+entry.id+':'+(entry.publication?.id||'draft:'+entry.detail.revision);
    const run=lifecycle;let view=pending.get(viewKey);
    if(view){view.show();view.refresh();return;}
    if(!view){
      const dialog=node('dialog','','thuy-management-dialog thuy-assignment-dialog'),head=node('header','','thuy-management-head');
      const close=button('Đóng',()=>dialog.close());head.append(node('h2','Giao bài tập'),close);
      const body=node('div','','thuy-management-body'),summary=node('section','','thuy-assignment-summary'),tags=node('div','','thuy-assignment-skills');
      summary.append(node('h2',entry.title));for(const skill of new Set((entry.definition?.blocks||[]).flatMap(b=>b.items.flatMap(i=>i.skillCodes||[]))))tags.append(node('span',({general:'Chung',listening:'Listening',reading:'Reading',speaking:'Speaking',writing:'Writing'})[skill]||skill));summary.append(tags);
      const targets=node('div','','thuy-assignment-targets'),status=node('p','','notice');status.setAttribute('role','status');
      const footer=node('footer','','thuy-assignment-footer'),back=button('Quay lại bài tập',()=>dialog.close()),submit=button('Giao bài',()=>void assign()),add=button('+ Thêm lớp nhận bài tập',()=>addTarget(''));submit.classList.add('primary');
      body.append(summary,targets,add);footer.append(status,back,submit);dialog.append(head,body,footer);bindDialogDismiss(dialog);
      const rows=[],reads=new Map(),operationId=crypto.randomUUID(),publicationOperationId=crypto.randomUUID();let busy=false,opener=null;
      const canSend=row=>Boolean(row.classes.value&&row.sessions.value&&!row.loading&&!row.sessions.selectedOptions[0]?.disabled);
      function syncSubmit(){
        const active=rows.filter(row=>!row.done);
        submit.disabled=busy||!active.length||active.some(row=>!canSend(row));
        submit.textContent=busy?'Đang giao…':!active.length?'Đã giao':'Giao bài';
      }
      function getAvailability(classId){
        if(!reads.has(classId)){
          const task=request('/teacher/assignment-sessions?classId='+encodeURIComponent(classId),{timeoutMs:20000})
            .finally(()=>reads.delete(classId));
          reads.set(classId,task);
        }
        return reads.get(classId);
      }
      async function addTarget(preferred=getPreferredClass()){
        if(rows.length&&rows.every(row=>row.done)&&status.classList.contains('success')){
          status.firstChild.textContent='Các lượt giao đã xác nhận.';
        }
        const row=node('div','','thuy-assignment-target'),classLabel=node('label','Chọn lớp'),sessionLabel=node('label','Chọn buổi học'),classes=node('select'),sessions=node('select'),message=node('small');
        const controls=node('div','','thuy-assignment-schedule'),availabilityNote=node('small');availabilityNote.setAttribute('role','status');
        const retry=button('Thử đọc lại lịch',()=>void readPlan(sessions.value));
        const confirm=button('Xác nhận lịch của lớp',()=>{
          if(!classes.value||!onConfirmSchedule)return;
          const selected=classes.value,chosen=sessions.value;
          dialog.close();
          onConfirmSchedule(selected,()=>{
            if(run!==lifecycle||classes.value!==selected)return;
            view.show();void readPlan(chosen||String(entry.sessionNumber||''));
          });
        });
        retry.hidden=confirm.hidden=true;controls.append(availabilityNote,retry,confirm);
        classes.setAttribute('aria-label','Chọn lớp nhận bài '+(rows.length+1));sessions.setAttribute('aria-label','Chọn buổi học '+(rows.length+1));
        classes.append(new Option('Chọn lớp',''));for(const item of getClasses())classes.append(new Option(item.class_name+(item.student_count!=null?' · '+item.student_count+' học viên':''),String(item.class_id)));
        classLabel.append(classes);sessionLabel.append(sessions);row.append(classLabel,sessionLabel,controls,message);targets.append(row);
        const state={classes,sessions,message,retry,confirm,generation:0,done:false,loading:false,refresh:readPlan};rows.push(state);
        async function readPlan(preferredSession=''){
          const generation=++state.generation,classId=classes.value;
          const current=()=>run===lifecycle&&state.generation===generation&&classes.value===classId&&!state.done;
          state.loading=Boolean(classId);
          sessions.replaceChildren(new Option(classId?'Đang đọc lịch…':'Chọn lớp trước',''));sessions.disabled=true;
          availabilityNote.textContent='';retry.hidden=confirm.hidden=true;syncSubmit();
          if(!classId)return;
          try{
            const {availability}=await getAvailability(classId);
            if(!current())return;
            if(String(availability?.classId)!==classId||!Array.isArray(availability.sessions)||!Array.isArray(availability.proposals))throw Error('Lịch trả về chưa khớp lớp.');
            const options=availability.sessions.map(slot=>{
              const suffix=slotLabels[slot.status]||'';
              const option=new Option('Buổi '+slot.sessionNumber+displayDate(slot.date)+(slot.kind==='test'?' · Test':'')+(suffix?' · '+suffix:''),String(slot.sessionNumber));
              option.disabled=slot.status!=='available'||availability.rosterStatus!=='verified';
              return option;
            });
            const proposals=availability.proposals.map(slot=>{
              const option=new Option('ERP · Buổi '+slot.sessionNumber+displayDate(slot.date)+' · Chờ xác nhận','proposal:'+slot.sessionNumber);
              option.disabled=true;return option;
            });
            const selectable=options.some(option=>!option.disabled);
            const needsPlan=availability.scheduleStatus!=='ready'||proposals.length>0||availability.sessions.some(slot=>['needs_confirmation','needs_review'].includes(slot.status));
            const notes=[scheduleLabels[availability.scheduleStatus],rosterLabels[availability.rosterStatus]];
            if(!selectable&&!notes.some(Boolean))notes.push('Lớp hiện không còn buổi đủ điều kiện giao.');
            availabilityNote.textContent=notes.filter(Boolean).join(' ');
            const emptyLabel=availability.scheduleStatus==='empty'?'Chưa có lịch ERP':availability.scheduleStatus==='needs_review'?'Lịch cần đối chiếu':'Chưa đọc được lịch';
            sessions.replaceChildren(new Option(options.length||proposals.length?'Chọn buổi học':emptyLabel,''),...options,...proposals);
            sessions.disabled=sessions.options.length<=1;
            if(options.some(option=>!option.disabled&&option.value===preferredSession))sessions.value=preferredSession;
            retry.hidden=availability.scheduleStatus!=='unavailable'&&!rosterLabels[availability.rosterStatus];
            confirm.hidden=!onConfirmSchedule||!needsPlan;
          }catch(error){
            if(!current())return;
            sessions.replaceChildren(new Option('Chưa đọc được lịch',''));
            availabilityNote.textContent=['READ_ABORTED','READ_TIMEOUT'].includes(error.code)?'Đọc lịch quá lâu. Hãy thử lại.':error.message;retry.hidden=error.status===403;
          }finally{
            if(current()){state.loading=false;syncSubmit();}
          }
        }
        classes.addEventListener('change',()=>{message.textContent='';void readPlan();});
        sessions.addEventListener('change',syncSubmit);
        classes.value=String(preferred||'');await readPlan(String(entry.sessionNumber||''));
      }
      async function assign(){
        if(busy)return;
        const active=rows.filter(row=>!row.done),choices=active.map(row=>({classId:row.classes.value,sessionNumber:Number(row.sessions.value)}));
        if(!choices.length)return;
        status.className='notice';
        for(const row of active){row.classes.removeAttribute('aria-invalid');row.sessions.removeAttribute('aria-invalid');}
        const missing=active.find(row=>!canSend(row));
        if(missing){const control=missing.classes.value?missing.sessions:missing.classes;control.setAttribute('aria-invalid','true');missing.message.textContent='Chọn đủ lớp và buổi học.';status.textContent='Chọn đủ lớp và buổi học cho từng dòng.';control.focus();return;}
        if(new Set(rows.map(row=>row.classes.value+':'+row.sessions.value)).size!==rows.length){status.textContent='Một lớp và buổi chỉ xuất hiện một lần.';return;}
        busy=true;submit.disabled=add.disabled=close.disabled=back.disabled=true;
        for(const row of rows){row.classes.disabled=true;row.sessions.disabled=true;row.retry.disabled=row.confirm.disabled=true;}
        syncSubmit();dialog.setAttribute('aria-busy','true');
        status.textContent='Đang giao và đối chiếu từng lớp…';
        try{
          if(!entry.publication){
            const {draft}=await request('/teacher/form-drafts/'+entry.id);
            if(run!==lifecycle)return;
            if(draft.id!==entry.id||draft.revision!==entry.detail.revision||draft.contentHash!==entry.detail.contentHash)throw Error('Phiếu đã được chỉnh sửa. Đóng cửa sổ và mở lại Giao bài để dùng đúng bản mới.');
            if(draft.status!=='approved')await request('/teacher/form-drafts/'+entry.id+'/approve',{method:'POST',body:{expectedRevision:draft.revision,expectedHash:draft.contentHash,libraryOnly:true}});
            if(run!==lifecycle)return;
            const prepared=await request('/teacher/form-drafts/'+entry.id+'/publish-library',{method:'POST',body:{expectedRevision:draft.revision,operationId:publicationOperationId}});
            if(run!==lifecycle)return;
            const p=prepared.publication;
            if(!p?.id||p.draftId!==entry.id||p.revision!==draft.revision||p.formVersionId!==draft.definition.formVersionId)throw Error('Phiên bản chuẩn bị giao chưa khớp phiếu; chưa giao cho lớp.');
            entry.publication=p;
          }
          const reply=await request('/teacher/form-publications/'+entry.publication.id+'/assign',{method:'POST',body:{operationId,targets:choices,origin:{source:entry.draft?'draft':'library',id:entry.id}}});
          if(run!==lifecycle)return;
          const results=reply.delivery?.results;if(!Array.isArray(results)||results.length!==choices.length)throw Error('Kết quả chưa đủ các đích vừa giao. Thử lại dùng cùng mã thao tác.');
          const key=value=>String(value.classId)+':'+value.sessionNumber,byTarget=new Map(results.map(result=>[key(result),result]));
          if(byTarget.size!==choices.length||choices.some(choice=>!byTarget.has(key(choice))))throw Error('Kết quả giao chưa khớp lớp và buổi đã chọn.');
          for(const choice of choices){const result=byTarget.get(key(choice));if(result.ok&&(result.delivery?.formVersionId!==entry.publication.formVersionId||!Number.isInteger(result.delivery.rosterCount)||result.delivery.rosterCount<0))throw Error('Phiên bản hoặc số học viên vừa giao chưa khớp.');}
          for(const [index,expected]of choices.entries()){
            const row=active[index],result=byTarget.get(key(expected));
            if(result.ok){row.done=true;row.retry.hidden=row.confirm.hidden=true;row.message.textContent='Đã giao · '+result.delivery.rosterCount+' học viên';onAssigned({...result.delivery,title:entry.title});}
            else {
              row.message.textContent=result.message||'Chưa giao được. Thử lại đích này.';
              if(refreshErrors.has(result.error))void row.refresh(row.sessions.value);
            }
          }
          status.textContent=rows.every(row=>row.done)?'Đã giao và đối chiếu tất cả các lớp.':'Một số đích chưa giao được. Các lớp đã giao được giữ nguyên; bấm Giao bài để thử lại đích còn lại.';
          const receipt=node('span',rows.filter(row=>row.done).map(row=>row.classes.selectedOptions[0]?.textContent+' · '+row.sessions.selectedOptions[0]?.textContent+' · '+row.message.textContent).join('; '),'thuy-delivery-receipt');status.append(receipt);
          status.classList.add(rows.every(row=>row.done)?'success':'error');
        }catch(error){status.classList.add('error');status.textContent='Chưa xác nhận đủ kết quả: '+error.message;}
        finally{
          busy=false;dialog.setAttribute('aria-busy','false');add.disabled=close.disabled=back.disabled=false;
          for(const row of rows){
            row.classes.disabled=row.done;row.sessions.disabled=row.done||row.loading||row.sessions.options.length<=1;
            row.retry.disabled=row.confirm.disabled=row.done;
          }
          syncSubmit();
        }
      }
      dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
      dialog.addEventListener('close',()=>{if(dialog.open)return;dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});});
      view={dialog,show(){if(dialog.open)return;opener=document.activeElement;document.body.append(dialog);dialog.showModal();},
        refresh(){if(!busy)for(const row of rows)if(!row.done&&row.classes.value)void row.refresh(row.sessions.value);}};
      pending.set(viewKey,view);void addTarget();
    }
    view.show();
  },clear(){lifecycle++;for(const view of pending.values()){view.dialog.close();view.dialog.remove();}pending.clear();}};
}
