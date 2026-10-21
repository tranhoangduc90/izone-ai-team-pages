// Gắn editor gốc của Thủy vào demo. Bài gốc chỉ được sao chép; sửa/duyệt không ghi lớp thật.
// Giữ định danh câu và điều kiện khi chuyển bản sao sang phiếu mới.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Gợi ý do giảng viên nhập, thu gọn ban đầu và không tham gia chấm điểm.
export function hintMarkup(value){return typeof value==='string'&&value.trim()?`<details class="questionHint"><summary>Xem gợi ý</summary><p>${escape(value)}</p></details>`:'';}
export async function loadEditor(){
  if(window.ProgressLogExerciseEditor)return;
  window.ProgressLogHintMarkup=hintMarkup;
  window.$=id=>document.getElementById(id);window.esc=escape;
  window.toast=message=>{const e=document.querySelector('#toast');e.textContent=message;e.className='show';setTimeout(()=>e.className='',5000);};
  for(const name of ['worksheet-model.js','library-model.js','exercise-ai-model.js','exercise-ai.js','exercise-editor.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(name,import.meta.url);script.onload=resolve;script.onerror=()=>reject(Error('Chưa tải được bộ soạn bài. Hãy tải lại trang.'));document.head.append(script);});
}
export function sourceDraft(session){
  const blocks=session.definition.blocks,ids=new Map(blocks.flatMap(b=>b.items).map(i=>[i.itemVersionId,crypto.randomUUID()]));
  return {schemaVersion:3,title:session.title+' · Bản riêng',source:'mine',level:'',revision:1,status:'draft',
    sections:blocks.length>1?blocks.map(b=>({id:b.blockId,title:b.title.replace(/^phần\s*\d+\s*[:：.]?\s*/i,'')})):[],
    sectionMeta:Object.fromEntries(blocks.map(b=>[b.blockId,{instructions:b.instructions||''}])),
    questions:blocks.flatMap(b=>b.items.map(i=>{const key=session.answerKey?.[i.itemVersionId],type={single_choice:'mcq',multiple_choice:'multi',long_text:'open',short_text:'gap',number_score:'score'}[i.interactionType];
      if(!type)throw Error('Dạng câu gốc này chưa có bộ soạn tương ứng; giữ nguyên phiếu gốc.');
      return {id:ids.get(i.itemVersionId),type,purpose:i.maxScore>0?'practice':'reflection',skill:i.skillCodes?.find(k=>['listening','reading','speaking','writing'].includes(k))||'general',section:blocks.length>1?b.blockId:'',prompt:i.prompt,explanation:'',
        ...(i.options?.length?{options:i.options.map(o=>o.label),optionIds:i.options.map(o=>o.id),answers:key?.expectedOptionId?[i.options.findIndex(o=>o.id===key.expectedOptionId)]:[]}:{}),
        ...(['gap','open'].includes(type)?{answer:type==='open'?i.interactionConfig?.hintText||'':''}:{}),...(type==='score'?{total:i.interactionConfig.max}:{}),
        original:{...structuredClone(i),copyId:ids.get(i.itemVersionId),conditionId:ids.get(i.interactionConfig?.visibleWhenItemVersionId)}};
    }))};
}
export function toDefinition(form){
  const sections=form.sections.length?form.sections:[{id:'single',title:'Bài tập'}],questionMap=new Map(form.questions.map(q=>[q.original?.itemVersionId,q.id]));
  const keys={};
  const definition={title:form.title,answerReleasePolicy:'hidden',blocks:sections.map(section=>({blockId:section.id,title:section.title,instructions:form.sectionMeta?.[section.id]?.instructions||'',items:form.questions.filter(q=>!form.sections.length||q.section===section.id).map((q,index)=>{
    const options=(q.options||[]).map((label,n)=>({id:q.optionIds?.[n]||String.fromCharCode(65+n),label}));
    const graded=q.purpose!=='reflection'&&(q.original?.maxScore>0||['listening','reading'].includes(q.skill))&&['mcq','multi','gap','matching'].includes(q.type);
    const config={...(q.original?.interactionConfig||{}),...(q.type==='score'?{min:0,max:q.total,step:1}:{})};
    delete config.hintText;
    if(q.type==='open'&&q.answer?.trim())config.hintText=q.answer;
    if(config.visibleWhenItemVersionId){const controller=questionMap.get(config.visibleWhenItemVersionId);if(!controller)throw Error('Câu điều kiện đang trỏ tới câu đã bỏ. Hãy giữ câu điều khiển trước khi xuất bản.');config.visibleWhenItemVersionId=controller;}
    const item={...q.original,itemFamilyId:crypto.randomUUID(),itemVersionId:q.id,position:index+1,displayNumber:index+1,prompt:q.prompt,helpText:q.original?.helpText||'',interactionType:{mcq:'single_choice',multi:'multiple_choice',gap:'short_text',open:'long_text',matching:'matching',score:'number_score'}[q.type],graderType:graded?{mcq:'exact_option',multi:'exact_options',gap:'exact_text',matching:'exact_matching'}[q.type]:'none',maxScore:graded?(q.original?.maxScore||1):0,required:q.original?.required??true,options,interactionConfig:config,skillCodes:q.original&&(q.skill==='general'||q.original.skillCodes?.includes(q.skill))?q.original.skillCodes:[q.skill],evidenceSource:q.type==='score'?'student_self_report':'demo_authoring'};
    delete item.copyId;delete item.conditionId;
    if(graded){if(['mcq','multi'].includes(q.type)&&!q.answers?.length)throw Error(`Câu ${index+1}: chưa có đáp án, không tự đoán.`);if(q.type==='gap'&&!q.answer?.trim())throw Error(`Câu ${index+1}: chưa có đáp án.`);keys[q.id]={graderType:item.graderType,expectedOptionId:options[q.answers?.[0]]?.id,expectedOptions:(q.answers||[]).map(n=>options[n]?.id),expectedText:q.answer||'',pairs:q.pairs||[]};}
    if(q.type==='matching')item.interactionConfig.pairs=q.pairs;
    return item;
  })}))};
  const all=definition.blocks.flatMap(b=>b.items);
  for(const item of all){const c=item.interactionConfig;if(c.visibleWhenItemVersionId&&!all.find(v=>v.itemVersionId===c.visibleWhenItemVersionId)?.options.some(o=>o.id===c.visibleWhenValue))throw Error('Phương án điều khiển câu có điều kiện đã bị bỏ. Giữ lại phương án hoặc bỏ câu phụ trước khi xuất bản.');}
  return {definition,keys};
}
