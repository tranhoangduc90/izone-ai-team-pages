/* Local prototype: repository sources and assigned snapshots are separate. */
(function(root){
 const skills={listening:'Listening',reading:'Reading',speaking:'Speaking',writing:'Writing'};
 const levels=['5.0–6.0','6.0–7.0'];
 const createDraft=()=>({schemaVersion:3,title:'',source:'mine',level:'',revision:1,status:'draft',sections:[],questions:[]});
 const classes=[{id:'IC2305'}];
 const seed=()=>({version:1,forms:[],assignments:[]});
 const questionTypes={mcq:'Trắc nghiệm',multi:'Chọn nhiều đáp án',gap:'Điền từ',open:'Trả lời mở',matching:'Nối cặp',score:'Ghi số câu đúng'};
 function newQuestion(type,purpose='practice'){
  if(!questionTypes[type])throw Error('Dạng câu hỏi không hợp lệ.');
  return {id:crypto.randomUUID(),type,purpose,prompt:'',explanation:'',...(['mcq','multi'].includes(type)?{options:['','','',''],answers:[]}:{}),...(type==='gap'?{answer:''}:{}),...(type==='matching'?{pairs:[{left:'',right:''},{left:'',right:''}]}:{})};
 }
 function validateQuestion(q,index){
  const prefix=`Câu ${index+1}: `;
  if(!questionTypes[q.type])throw Error(prefix+'dạng câu hỏi không hợp lệ.');
  if(!q.prompt?.trim())throw Error(prefix+'nhập nội dung câu hỏi.');
  if(!['practice','reflection'].includes(q.purpose))throw Error(prefix+'chọn mục đích hợp lệ.');
  const graded=q.purpose!=='reflection'&&(!q.skill||['listening','reading'].includes(q.skill));
  if(q.skill&&!['general',...Object.keys(skills)].includes(q.skill))throw Error(prefix+'chọn nội dung hợp lệ.');
  if(q.type==='score'&&(!['listening','reading'].includes(q.skill)||!Number.isInteger(q.total)||q.total<1||q.total>100))throw Error(prefix+'chọn Listening/Reading và tổng số câu từ 1 đến 100.');
  if(['mcq','multi'].includes(q.type)){
   if(!Array.isArray(q.options)||q.options.length<2||q.options.length>8||q.options.some(o=>typeof o!=='string'||!o.trim()))throw Error(prefix+'nhập từ 2 đến 8 lựa chọn đầy đủ.');
   if(graded){
    if(!Array.isArray(q.answers)||!q.answers.length||q.answers.some(a=>!Number.isInteger(a)||a<0||a>=q.options.length)||new Set(q.answers).size!==q.answers.length||(q.type==='mcq'&&q.answers.length!==1))throw Error(prefix+'chọn đáp án đúng.');
   }
  }
  if(q.type==='gap'&&graded&&!q.answer?.trim())throw Error(prefix+'nhập đáp án điền từ.');
  if(q.type==='matching'&&(!Array.isArray(q.pairs)||q.pairs.length<2||q.pairs.some(p=>!p.left?.trim()||!p.right?.trim())))throw Error(prefix+'nhập ít nhất 2 cặp nối đầy đủ.');
 }
 function saveForm(state,draft,status='published'){
  if(!['draft','published'].includes(status))throw Error('Trạng thái bài tập không hợp lệ.');
  if(draft.id&&state.forms.find(f=>f.id===draft.id)?.source!=='mine')throw Error('Chỉ sửa bài tập của tôi.');
  const form={...structuredClone(draft),title:draft.title.trim()||(status==='draft'?'Bài tập chưa đặt tên':''),source:'mine',status,id:draft.id||crypto.randomUUID(),revision:draft.id?(draft.revision||1)+1:1};
  validateForm(form);
  if((form.level&&!levels.includes(form.level))||(status==='published'&&!levels.includes(form.level)))throw Error('Chọn trình độ 5.0–6.0 hoặc 6.0–7.0.');
  const next=structuredClone(state),index=next.forms.findIndex(f=>f.id===form.id);
  if(index<0)next.forms.unshift(form);else next.forms[index]=form;
  return {state:next,form};
 }
 function validateForm(form){
  if(!form?.title?.trim())throw Error('Nhập tên phiếu.');
  if(form.schemaVersion===3){
   if(!Array.isArray(form.questions)||form.questions.length>200)throw Error('Mỗi bài có tối đa 200 câu hỏi.');
   if(form.status!=='draft'&&!form.questions.length)throw Error('Thêm ít nhất một câu hỏi.');
   if(form.audioUrl&&!/^https?:\/\//i.test(form.audioUrl))throw Error('Liên kết audio phải bắt đầu bằng https:// hoặc http://.');
   if(!Array.isArray(form.sections)||(form.sections.length&&form.sections.length<2)||form.sections.length>10)throw Error('Chọn không chia phần hoặc từ 2 đến 10 phần.');
   const sectionIds=new Set(form.sections.map(s=>s.id));if(sectionIds.size!==form.sections.length||form.sections.some(s=>!s.id))throw Error('Các phần cần có mã riêng.');
   if(form.status!=='draft')for(const s of form.sections){
    if(!s.title?.trim())throw Error('Đặt tên cho từng phần.');
    if(!form.questions.some(q=>q.section===s.id))throw Error(`Phần “${s.title}” chưa có câu hỏi.`);
   }
   const ids=new Set();
   for(let i=0;i<form.questions.length;i++){
    const q=form.questions[i];if(!q.id||ids.has(q.id))throw Error('Mỗi câu hỏi cần mã riêng.');ids.add(q.id);
    if(form.sections.length?!sectionIds.has(q.section):!!q.section)throw Error(`Câu ${i+1}: chọn một trong các phần đã tạo.`);
    if(form.status!=='draft'){
     if(!['general',...Object.keys(skills)].includes(q.skill))throw Error(`Câu ${i+1}: chọn kỹ năng hoặc Chung.`);
     validateQuestion(q,i);
    }
   }
   return true;
  }
  if(form.schemaVersion===2){
   if(!Array.isArray(form.parts)||form.parts.length!==2||form.parts[0].id!=='review'||form.parts[1].id!=='new')throw Error('Bài tập cần có hai phần: Ôn tập và Bài mới.');
   if(form.status!=='draft'&&!form.parts.some(p=>p.questions?.length))throw Error('Thêm ít nhất một câu hỏi vào Ôn tập hoặc Bài mới.');
   const ids=new Set();
   for(const p of form.parts){
    if(!Array.isArray(p.questions)||p.questions.length>100)throw Error('Mỗi phần có tối đa 100 câu hỏi.');
    if(p.audioUrl&&!/^https?:\/\//i.test(p.audioUrl))throw Error('Liên kết audio phải bắt đầu bằng https:// hoặc http://.');
    for(let i=0;i<p.questions.length;i++){
     const q=p.questions[i];if(!q.id||ids.has(q.id))throw Error('Mỗi câu hỏi cần mã riêng.');ids.add(q.id);
     if(form.status!=='draft'){
      if(!['general',...Object.keys(skills)].includes(q.skill))throw Error(`Câu ${i+1}: chọn nội dung thuộc Chung hoặc một kỹ năng.`);
      validateQuestion(q,i);
     }
    }
   }
   return true;
  }
  if(!Array.isArray(form.parts)||(form.status!=='draft'&&!form.parts.length))throw Error('Chọn ít nhất một kỹ năng.');
  if(new Set(form.parts.map(p=>p.skill)).size!==form.parts.length)throw Error('Mỗi kỹ năng chỉ có một phần.');
  for(const p of form.parts){
   if(!skills[p.skill])throw Error('Kỹ năng không hợp lệ.');
   if(form.status==='draft')continue;
   if(['listening','reading'].includes(p.skill)&&(!Number.isInteger(p.total)||p.total<1||p.total>100))throw Error('Tổng số câu phải là số nguyên từ 1 đến 100.');
   if(!p.prompt?.trim())throw Error(`Nhập nội dung phần ${skills[p.skill]}.`);
   if(p.audioUrl){try{const u=new URL(p.audioUrl);if(!['https:','http:'].includes(u.protocol))throw Error()}catch{throw Error('Liên kết audio phải bắt đầu bằng https:// hoặc http://.')}}
   if(p.questions!==undefined){if(!Array.isArray(p.questions)||p.questions.length>100)throw Error('Mỗi phần có tối đa 100 câu hỏi.');p.questions.forEach(validateQuestion)}
  }
  return true;
 }
 function assign(state,formId,targets){
  const form=state.forms.find(f=>f.id===formId);if(!form)throw Error('Không tìm thấy phiếu.');if(form.status==='draft')throw Error('Xuất bản bài tập trước khi giao vào lớp.');validateForm(form);
  if(!targets.length)throw Error('Chọn lớp và buổi học.');
  const keys=new Set(state.assignments.map(a=>`${a.classId}:${a.session}`));
  for(const target of targets){
   if(!classes.some(c=>c.id===target.classId)||!Number.isInteger(target.session)||target.session<1||target.session>24)throw Error('Chọn lớp và buổi học hợp lệ.');
   const key=`${target.classId}:${target.session}`;
   if(keys.has(key))throw Error(`${target.classId} · Buổi ${target.session} đã có phiếu.`);keys.add(key);
  }
  const next=structuredClone(state);
  for(const target of targets)next.assignments.push({id:crypto.randomUUID(),...target,formId:form.id,snapshot:structuredClone(form),assignedAt:new Date().toISOString()});
  return next;
 }
 function withdraw(state,assignmentId){
  const assignment=state.assignments.find(a=>a.id===assignmentId);
  if(!assignment)throw Error('Bài tập này đã được gỡ hoặc không còn tồn tại.');
  const next=structuredClone(state);
  next.assignments=next.assignments.filter(a=>a.id!==assignmentId);
  if(Array.isArray(next.history)){next.history=next.history.filter(a=>a.classId!==assignment.classId||a.session!==assignment.session);if(!next.history.length)delete next.history}
  return next;
 }
 const api={skills,levels,createDraft,classes,seed,questionTypes,newQuestion,validateQuestion,saveForm,validateForm,assign,withdraw};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProgressLogLibraryModel=api;
})(typeof window!=='undefined'?window:globalThis);
