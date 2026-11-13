// Giao đúng bản đã xuất bản; giữ từng dòng đích và mã retry khi có lỗi một phần.
import {bindDialogDismiss,node} from '/izone-ai-team-pages/progress-log/releases/f768d3259648c952/progress-log/session-comments.js';
import {COPY_STUDENT_LINK_LABEL,decorateCopyStudentLinkButton,studentAssignmentLink} from '/izone-ai-team-pages/progress-log/releases/f768d3259648c952/progress-log/student-assignment-link.js';
const button=(label,action)=>{const b=node('button',label,'button');b.type='button';b.addEventListener('click',action);return b;};
const scheduleLabels={empty:'Portal chưa có lịch cho lớp này.',unavailable:'Chưa đọc được lịch Portal của lớp.',
  needs_review:'Lịch trên Portal có buổi chưa rõ thứ tự hoặc trạng thái. Hãy đối chiếu tại Portal.'};
const rosterLabels={empty:'Lớp chưa có học viên hợp lệ.',unverified:'Danh sách học viên của lớp cần đối chiếu ERP.'};
const refreshErrors=new Set(['ERP_SESSION_NOT_CONFIRMED','ERP_SCHEDULE_UNAVAILABLE','ERP_SESSION_REVIEW_REQUIRED',
  'ASSIGNMENT_SESSION_CONFLICT','DRAFT_ROSTER_UNVERIFIED','DRAFT_ROSTER_CHANGED','CLASS_ACCESS_DENIED',
  'CLASS_STATUS_UNAVAILABLE','CLASS_NOT_ONGOING']);
const displayDate=date=>date?' · '+date.split('-').reverse().join('/'):'';
const icClassNumber=name=>Number(String(name??'').trim().match(/^IC\s*(\d+)\b/i)?.[1]??-1);
export function createAssignmentDialog({request,getClasses,getPreferredClass,getClassStatus=()=> 'ready',onAssigned=()=>{}}){
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
      const receipts=node('div','','thuy-delivery-receipt');
      const footer=node('footer','','thuy-assignment-footer'),back=button('Quay lại bài tập',()=>dialog.close()),submit=button('Giao bài',()=>void assign()),add=button('+ Thêm lớp nhận bài tập',()=>addTarget(''));submit.classList.add('primary');
      const classNotice=node('p','','thuy-assignment-class-notice');classNotice.setAttribute('role','status');
      const ownDraft=entry.source==='personal'&&entry.draft?.id&&!entry.draft.reviewMode&&!entry.publication;
      body.append(summary,classNotice,targets,add);
      footer.append(status,receipts,back,submit);dialog.append(head,body,footer);bindDialogDismiss(dialog);
      const rows=[],reads=new Map(),operationId=crypto.randomUUID();let busy=false,opener=null;
      const canSend=row=>Boolean(row.classes.value&&row.sessions.value&&!row.loading&&!row.sessions.selectedOptions[0]?.disabled);
      function syncSubmit(){
        const active=rows.filter(row=>!row.done);
        submit.disabled=busy||!active.length||active.some(row=>!canSend(row));
        submit.textContent=busy?'Đang giao…':!active.length?'Đã giao':'Giao bài';
      }
      function getAvailability(classId){
        if(!reads.has(classId)){
          const task=request('/teacher/assignment-sessions?classId='+encodeURIComponent(classId)+'&source=portal',{timeoutMs:20000})
            .finally(()=>reads.delete(classId));
          reads.set(classId,task);
        }
        return reads.get(classId);
      }
      function fillClassChoices(select,preferred){
        const available=getClasses();
        const ordered=available.map(item=>({item,icNumber:icClassNumber(item.class_name)}))
          .sort((a,b)=>b.icNumber-a.icNumber);
        select.replaceChildren(new Option('Chọn lớp',''));
        for(const {item} of ordered){
          const option=new Option(item.class_name+(item.student_count!=null?' · '+item.student_count+' học viên':''),String(item.class_id));
          option.dataset.className=item.class_name;
          select.append(option);
        }
        select.disabled=!available.length;
        select.value=available.some(item=>String(item.class_id)===preferred)?preferred:'';
        classNotice.textContent=available.length?'':getClassStatus()==='unavailable'
          ?'Chưa tải được trạng thái lớp từ ERP. Hãy làm mới Progress Log và thử lại.'
          :'Bạn chưa có lớp đang học được phép giao bài.';
        add.hidden=!available.length;
      }
      async function addTarget(preferred=getPreferredClass()){
        if(rows.length&&rows.every(row=>row.done)&&status.classList.contains('success')){
          status.firstChild.textContent='Các lượt giao đã xác nhận.';
        }
        const row=node('div','','thuy-assignment-target'),classLabel=node('label','Chọn lớp'),sessionLabel=node('label','Chọn buổi học'),classes=node('select'),sessions=node('select'),message=node('small');
        const controls=node('div','','thuy-assignment-schedule'),availabilityNote=node('small');availabilityNote.setAttribute('role','status');
        const retry=button('Thử đọc lại lịch',()=>void readPlan(sessions.value));
        retry.hidden=true;controls.append(availabilityNote,retry);
        classes.setAttribute('aria-label','Chọn lớp nhận bài '+(rows.length+1));sessions.setAttribute('aria-label','Chọn buổi học '+(rows.length+1));
        fillClassChoices(classes,String(preferred||''));
        classLabel.append(classes);sessionLabel.append(sessions);row.append(classLabel,sessionLabel,controls,message);targets.append(row);
        const state={classes,sessions,message,retry,portalTargets:new Map(),generation:0,done:false,loading:false,refresh:readPlan};rows.push(state);
        async function readPlan(preferredSession=''){
          const generation=++state.generation,classId=classes.value;
          const current=()=>run===lifecycle&&state.generation===generation&&classes.value===classId&&!state.done;
          const prior=state.portalTargets.get(preferredSession);
          state.portalTargets.clear();state.loading=Boolean(classId);
          sessions.replaceChildren(new Option(classId?'Đang đọc lịch…':'Chọn lớp trước',''));sessions.disabled=true;
          availabilityNote.textContent='';retry.hidden=true;syncSubmit();
          if(!classId)return;
          try{
            const {availability}=await getAvailability(classId);
            if(!current())return;
            if(String(availability?.classId)!==classId||!Array.isArray(availability.sessions))throw Error('Lịch trả về chưa khớp lớp.');
            const options=availability.sessions.map(slot=>{
              const option=new Option('Buổi '+slot.sessionNumber+displayDate(slot.date),String(slot.sessionNumber));
              option.disabled=slot.status!=='available'||!slot.portalTarget?.id||availability.rosterStatus!=='verified';
              if(!option.disabled)state.portalTargets.set(option.value,slot.portalTarget);
              return option;
            });
            const selectable=options.some(option=>!option.disabled);
            const notes=[scheduleLabels[availability.scheduleStatus],rosterLabels[availability.rosterStatus]];
            if(!selectable&&!notes.some(Boolean))notes.push('Lớp hiện không còn buổi đủ điều kiện giao.');
            availabilityNote.textContent=notes.filter(Boolean).join(' ');
            const emptyLabel=availability.scheduleStatus==='ready'?'Không còn buổi để giao':'Chưa có buổi chọn được';
            sessions.replaceChildren(new Option(options.length?'Chọn buổi học':emptyLabel,''),...options);
            sessions.disabled=sessions.options.length<=1;
            const selected=state.portalTargets.get(preferredSession);
            if(selected&&(!prior||(prior.id===selected.id&&prior.startsAt===selected.startsAt)))sessions.value=preferredSession;
            retry.hidden=availability.scheduleStatus!=='unavailable'&&!rosterLabels[availability.rosterStatus];
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
        await readPlan(String(entry.sessionNumber||''));
      }
      function addReceipt(row,delivery){
        const destination=row.classes.selectedOptions[0].dataset.className+' · '+row.sessions.selectedOptions[0].textContent;
        const receipt=node('div','','thuy-delivery-row'),info=node('div','','thuy-delivery-destination');
        info.append(node('b',destination),node('small',row.message.textContent));
        const feedback=node('small','','thuy-delivery-copy-status');feedback.setAttribute('role','status');
        const link=studentAssignmentLink(delivery.publicToken);
        const copy=button(COPY_STUDENT_LINK_LABEL,async()=>{
          try{
            await navigator.clipboard.writeText(link);
            feedback.textContent='Đã sao chép link';
          }catch{
            const manual=node('a','Mở link để sao chép');manual.href=link;manual.target='_blank';manual.rel='noopener noreferrer';
            feedback.replaceChildren(manual);
          }
        });
        copy.setAttribute('aria-label',COPY_STUDENT_LINK_LABEL+' · '+destination);
        decorateCopyStudentLinkButton(copy);
        receipt.append(info,copy,feedback);receipts.append(receipt);
      }
      async function assign(){
        if(busy)return;
        const active=rows.filter(row=>!row.done),choices=active.map(row=>({classId:row.classes.value,
          sessionNumber:Number(row.sessions.value),portalTarget:row.portalTargets.get(row.sessions.value)}));
        if(!choices.length)return;
        status.className='notice';
        for(const row of active){row.classes.removeAttribute('aria-invalid');row.sessions.removeAttribute('aria-invalid');}
        const missing=active.find(row=>!canSend(row));
        if(missing){const control=missing.classes.value?missing.sessions:missing.classes;control.setAttribute('aria-invalid','true');missing.message.textContent='Chọn đủ lớp và buổi học.';status.textContent='Chọn đủ lớp và buổi học cho từng dòng.';control.focus();return;}
        if(new Set(rows.map(row=>row.classes.value+':'+row.sessions.value)).size!==rows.length){status.textContent='Một lớp và buổi chỉ xuất hiện một lần.';return;}
        busy=true;submit.disabled=add.disabled=close.disabled=back.disabled=true;
        for(const row of rows){row.classes.disabled=true;row.sessions.disabled=true;row.retry.disabled=true;}
        syncSubmit();dialog.setAttribute('aria-busy','true');
        status.textContent='Đang giao và đối chiếu từng lớp…';
        try{
          // Nút Giao bài xác nhận đúng bản nháp và các đích đang hiển thị.
          const reply=ownDraft
            ?await request('/teacher/form-drafts/'+entry.id+'/assign-to-classes',{method:'POST',body:{operationId,targets:choices,
              expectedRevision:entry.detail.revision,expectedHash:entry.detail.contentHash,confirmedAnswers:true}})
            :await request('/teacher/form-publications/'+entry.publication.id+'/assign',{method:'POST',body:{operationId,targets:choices,origin:{source:entry.draft?'draft':'library',id:entry.id}}});
          if(run!==lifecycle)return;
          if(ownDraft&&(reply.sourceRevision!==entry.detail.revision||reply.sourceHash!==entry.detail.contentHash))
            throw Error('Kết quả giao chưa khớp phiên bản bài đã xác nhận.');
          const results=reply.delivery?.results;if(!Array.isArray(results)||results.length!==choices.length)throw Error('Kết quả chưa đủ các đích vừa giao. Thử lại dùng cùng mã thao tác.');
          const key=value=>String(value.classId)+':'+value.sessionNumber,byTarget=new Map(results.map(result=>[key(result),result]));
          if(byTarget.size!==choices.length||choices.some(choice=>!byTarget.has(key(choice))))throw Error('Kết quả giao chưa khớp lớp và buổi đã chọn.');
          for(const choice of choices){
            const result=byTarget.get(key(choice));
            if(result.portalTarget?.id!==choice.portalTarget.id||result.portalTarget?.startsAt!==choice.portalTarget.startsAt)
              throw Error('Kết quả giao chưa khớp mốc Portal đã chọn.');
            if(result.ok&&(!result.delivery?.formVersionId||!ownDraft&&result.delivery.formVersionId!==entry.publication.formVersionId
              ||!Number.isInteger(result.delivery.rosterCount)||result.delivery.rosterCount<1))
              throw Error('Phiên bản hoặc số học viên vừa giao chưa khớp.');
            if(result.ok&&(key(result.delivery)!==key(choice)||!studentAssignmentLink(result.delivery.publicToken)))
              throw Error('Link học viên chưa khớp lớp và buổi đã giao.');
          }
          for(const [index,expected]of choices.entries()){
            const row=active[index],result=byTarget.get(key(expected));
            if(result.ok){row.done=true;row.retry.hidden=true;row.message.textContent='Đã giao · '+result.delivery.rosterCount+' học viên';addReceipt(row,result.delivery);onAssigned({...result.delivery,title:entry.title});}
            else {
              row.message.textContent=result.message||'Chưa giao được. Thử lại đích này.';
              if(refreshErrors.has(result.error))void row.refresh(row.sessions.value);
            }
          }
          status.textContent=rows.every(row=>row.done)?'Đã giao và đối chiếu tất cả các lớp.':'Một số đích chưa giao được. Các lớp đã giao được giữ nguyên; bấm Giao bài để thử lại đích còn lại.';
          status.classList.add(rows.every(row=>row.done)?'success':'error');
        }catch(error){status.classList.add('error');status.textContent='Chưa xác nhận đủ kết quả: '+error.message;}
        finally{
          busy=false;dialog.setAttribute('aria-busy','false');add.disabled=close.disabled=back.disabled=false;
          for(const row of rows){
            row.classes.disabled=row.done;row.sessions.disabled=row.done||row.loading||row.sessions.options.length<=1;
            row.retry.disabled=row.done;
          }
          syncSubmit();
        }
      }
      dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
      dialog.addEventListener('close',()=>{if(dialog.open)return;dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});});
      view={dialog,show(){if(dialog.open)return;opener=document.activeElement;document.body.append(dialog);dialog.showModal();},
        refresh(){if(!busy)for(const row of rows)if(!row.done){
          const previous=row.classes.value;
          fillClassChoices(row.classes,previous);
          void row.refresh(row.classes.value===previous?row.sessions.value:'');
        }}};
      pending.set(viewKey,view);void addTarget();
    }
    view.show();
  },clear(){lifecycle++;for(const view of pending.values()){view.dialog.close();view.dialog.remove();}pending.clear();}};
}
