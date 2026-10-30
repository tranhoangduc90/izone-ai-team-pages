// Giao đúng bản đã xuất bản; giữ từng dòng đích và mã retry khi có lỗi một phần.
import {bindDialogDismiss,node} from './session-comments.js';
const button=(label,action)=>{const b=node('button',label,'button');b.type='button';b.addEventListener('click',action);return b;};
export function createAssignmentDialog({request,getClasses,getPreferredClass,onAssigned=()=>{}}){
  const pending=new Map();let lifecycle=0;
  return {open(entry){
    if(!entry.publication?.id&&!entry.draft?.id)throw Error('Chưa xác định được phiếu cần giao.');
    const viewKey=entry.publication?.id||'draft:'+entry.id+':'+entry.detail.revision;
    const run=lifecycle;let view=pending.get(viewKey);
    if(!view){
      const dialog=node('dialog','','thuy-management-dialog thuy-assignment-dialog'),head=node('header','','thuy-management-head');
      const close=button('Đóng',()=>dialog.close());head.append(node('h2','Giao bài tập'),close);
      const body=node('div','','thuy-management-body'),summary=node('section','','thuy-assignment-summary'),tags=node('div','','thuy-assignment-skills');
      summary.append(node('h2',entry.title));for(const skill of new Set((entry.definition?.blocks||[]).flatMap(b=>b.items.flatMap(i=>i.skillCodes||[]))))tags.append(node('span',({general:'Chung',listening:'Listening',reading:'Reading',speaking:'Speaking',writing:'Writing'})[skill]||skill));summary.append(tags);
      const targets=node('div','','thuy-assignment-targets'),status=node('p','','notice');status.setAttribute('role','status');
      const footer=node('footer','','thuy-assignment-footer'),back=button('Quay lại bài tập',()=>dialog.close()),submit=button('Giao bài',()=>void assign()),add=button('+ Thêm lớp nhận bài tập',()=>addTarget());submit.classList.add('primary');
      body.append(summary,targets,add);footer.append(status,back,submit);dialog.append(head,body,footer);bindDialogDismiss(dialog);
      const rows=[],operationId=crypto.randomUUID(),publicationOperationId=crypto.randomUUID();let busy=false,opener=null;
      function syncSubmit(){submit.disabled=busy||rows.every(row=>row.done);submit.textContent=busy?'Đang giao…':rows.every(row=>row.done)?'Đã giao':'Giao bài';}
      async function addTarget(preferred=getPreferredClass()){
        const row=node('div','','thuy-assignment-target'),classLabel=node('label','Chọn lớp'),sessionLabel=node('label','Chọn buổi học'),classes=node('select'),sessions=node('select'),message=node('small');
        classes.setAttribute('aria-label','Chọn lớp nhận bài '+(rows.length+1));sessions.setAttribute('aria-label','Chọn buổi học '+(rows.length+1));
        classes.append(new Option('Chọn lớp',''));for(const item of getClasses())classes.append(new Option(item.class_name+(item.student_count!=null?' · '+item.student_count+' học viên':''),String(item.class_id)));
        classLabel.append(classes);sessionLabel.append(sessions);row.append(classLabel,sessionLabel,message);targets.append(row);
        const state={row,classes,sessions,message,generation:0,done:false};rows.push(state);syncSubmit();
        async function readPlan(){
          const generation=++state.generation,classId=classes.value;sessions.replaceChildren(new Option('Đang đọc lịch…',''));sessions.disabled=true;message.textContent='';
          if(!classId){sessions.replaceChildren(new Option('Chọn lớp trước',''));return;}
          try{
            const reply=await request('/teacher/journey-plan?classId='+encodeURIComponent(classId));if(run!==lifecycle||state.generation!==generation||classes.value!==classId)return;
            const plan=reply.plan;if(String(plan.classId)!==classId)throw Error('Lịch trả về chưa khớp lớp.');
            sessions.replaceChildren(new Option('Chọn buổi học',''));
            for(let number=1;number<=plan.totalSessions;number++){
              const date=plan.sessionDates?.find(value=>Number(value.sessionNumber)===number)?.date;
              sessions.append(new Option('Buổi '+number+(date?' · '+date.split('-').reverse().join('/') :''),String(number)));
            }sessions.disabled=state.done;sessions.value=String(entry.sessionNumber||'');
          }catch(error){if(state.generation===generation){sessions.replaceChildren(new Option('Chưa đọc được lịch',''));message.textContent=error.message;}}
        }
        classes.addEventListener('change',()=>void readPlan());classes.value=String(preferred||'');await readPlan();
      }
      async function assign(){
        if(busy)return;
        const active=rows.filter(row=>!row.done),choices=active.map(row=>({classId:row.classes.value,sessionNumber:Number(row.sessions.value)}));
        if(!choices.length)return;
        status.className='notice';
        for(const row of active){row.classes.removeAttribute('aria-invalid');row.sessions.removeAttribute('aria-invalid');}
        const missing=active.find(row=>!row.classes.value||!row.sessions.value);
        if(missing){const control=missing.classes.value?missing.sessions:missing.classes;control.setAttribute('aria-invalid','true');missing.message.textContent='Chọn đủ lớp và buổi học.';status.textContent='Chọn đủ lớp và buổi học cho từng dòng.';control.focus();return;}
        if(new Set(rows.map(row=>row.classes.value+':'+row.sessions.value)).size!==rows.length){status.textContent='Một lớp và buổi chỉ xuất hiện một lần.';return;}
        busy=true;submit.disabled=add.disabled=close.disabled=back.disabled=true;for(const row of rows){row.classes.disabled=true;row.sessions.disabled=true;}
        syncSubmit();dialog.setAttribute('aria-busy','true');
        status.textContent='Đang giao và đối chiếu từng lớp…';
        try{
          if(!entry.publication){
            const {draft}=await request('/teacher/form-drafts/'+entry.id);
            if(run!==lifecycle)return;
            if(draft.id!==entry.id||draft.revision!==entry.detail.revision||draft.contentHash!==entry.detail.contentHash)throw Error('Phiếu đã được chỉnh sửa. Đóng cửa sổ và mở lại Giao bài để dùng đúng bản mới.');
            if(draft.status!=='approved')await request('/teacher/form-drafts/'+entry.id+'/approve',{method:'POST',body:{expectedRevision:draft.revision,expectedHash:draft.contentHash}});
            if(run!==lifecycle)return;
            const prepared=await request('/teacher/form-drafts/'+entry.id+'/publish-library',{method:'POST',body:{expectedRevision:draft.revision,operationId:publicationOperationId}});
            if(run!==lifecycle)return;
            const p=prepared.publication;
            if(!p?.id||p.draftId!==entry.id||p.revision!==draft.revision||p.formVersionId!==draft.definition.formVersionId)throw Error('Phiên bản chuẩn bị giao chưa khớp phiếu; chưa giao cho lớp.');
            entry.publication=p;
          }
          const reply=await request('/teacher/form-publications/'+entry.publication.id+'/assign',{method:'POST',body:{operationId,targets:choices}});
          if(run!==lifecycle)return;
          const results=reply.delivery?.results;if(!Array.isArray(results)||results.length!==choices.length)throw Error('Kết quả chưa đủ các đích vừa giao. Thử lại dùng cùng mã thao tác.');
          const key=value=>String(value.classId)+':'+value.sessionNumber,byTarget=new Map(results.map(result=>[key(result),result]));
          if(byTarget.size!==choices.length||choices.some(choice=>!byTarget.has(key(choice))))throw Error('Kết quả giao chưa khớp lớp và buổi đã chọn.');
          for(const choice of choices){const result=byTarget.get(key(choice));if(result.ok&&(result.delivery?.formVersionId!==entry.publication.formVersionId||!Number.isInteger(result.delivery.rosterCount)||result.delivery.rosterCount<0))throw Error('Phiên bản hoặc số học viên vừa giao chưa khớp.');}
          for(const [index,expected]of choices.entries()){
            const row=active[index],result=byTarget.get(key(expected));
            if(result.ok){row.done=true;row.message.textContent='Đã giao · '+result.delivery.rosterCount+' học viên';onAssigned({...result.delivery,title:entry.title});}
            else row.message.textContent=result.message||'Chưa giao được. Thử lại đích này.';
          }
          status.textContent=rows.every(row=>row.done)?'Đã giao và đối chiếu tất cả các lớp.':'Một số đích chưa giao được. Các lớp đã giao được giữ nguyên; bấm Giao bài để thử lại đích còn lại.';
          const receipt=node('span',rows.filter(row=>row.done).map(row=>row.classes.selectedOptions[0]?.textContent+' · '+row.sessions.selectedOptions[0]?.textContent+' · '+row.message.textContent).join('; '),'thuy-delivery-receipt');status.append(receipt);
          status.classList.add(rows.every(row=>row.done)?'success':'error');
        }catch(error){status.classList.add('error');status.textContent='Chưa xác nhận đủ kết quả: '+error.message;}
        finally{busy=false;dialog.setAttribute('aria-busy','false');add.disabled=close.disabled=back.disabled=false;syncSubmit();for(const row of rows){row.classes.disabled=row.done;row.sessions.disabled=row.done||!row.classes.value;}}
      }
      dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
      dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});});
      view={dialog,show(){if(dialog.open)return;opener=document.activeElement;document.body.append(dialog);dialog.showModal();}};pending.set(viewKey,view);void addTarget();
    }
    view.show();
  },clear(){lifecycle++;for(const view of pending.values()){view.dialog.close();view.dialog.remove();}pending.clear();}};
}
