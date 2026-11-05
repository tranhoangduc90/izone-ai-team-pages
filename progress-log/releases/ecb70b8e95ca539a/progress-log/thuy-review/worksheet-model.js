/* One worksheet contract for authoring, assignment, preview and student work. */
(function(root){
 const labels={review:'Ôn tập',new:'Bài mới',single:'Bài tập'},skills={general:'Chung',listening:'Listening',reading:'Reading',speaking:'Speaking',writing:'Writing'};
 const clone=value=>structuredClone(value),normal=value=>String(value??'').trim().toLocaleLowerCase('vi').replace(/\s+/g,' ');
 const parts=()=>['review','new'].map(id=>({id,title:labels[id],instructions:'',questions:[]}));
 function normalize(form){
  const next=clone(form);
  if(form.schemaVersion===3){
   const items=next.questions||[],sections=next.sections||[];
   next.parts=sections.length>=2?sections.map(s=>({...(next.sectionMeta?.[s.id]||{}),...s,questions:items.filter(q=>q.section===s.id)})):[{id:'single',title:'Bài tập',questions:items}];
   return next;
  }
  if(form.schemaVersion===2){next.parts=parts().map(p=>({...p,...clone(form.parts.find(v=>v.id===p.id)||{})}));return next}
  next.schemaVersion=2;next.parts=parts();
  (form.parts||[]).forEach((p,i)=>{
   const target=next.parts[i===0?0:1],skill=p.skill;
   if(p.instructions)target.instructions+=(target.instructions?'\n':'')+p.instructions;
   if(p.passage)target.instructions+=(target.instructions?'\n':'')+p.passage;
   if(p.audioUrl)target.audioUrl=p.audioUrl;
   const questions=(p.questions||[]).map((q,j)=>{
    if(q.correct)return {id:q.id,skill,type:q.options.length?'mcq':'gap',purpose:'practice',prompt:q.prompt,options:q.options.map(v=>v[1]),answers:q.correct.map(a=>q.options.findIndex(v=>v[0]===a)),answer:q.correct.join('\n')};
    return {...clone(q),id:q.id||`legacy-${skill}-${i}-${j}`,skill};
   });
   if(!questions.length&&p.prompt&&!['listening','reading'].includes(skill))questions.push({id:`legacy-${skill}-${i}`,skill,type:'open',purpose:'reflection',prompt:p.prompt,answer:''});
   if(skill==='speaking'&&!questions.some(q=>q.purpose==='reflection'&&q.type==='multi'))questions.push({id:`reflection-${i}`,skill,type:'multi',purpose:'reflection',prompt:'Em muốn cải thiện điều gì khi nói?',options:['Mở rộng ý','Độ trôi chảy','Phát âm','Từ vựng'],answers:[]});
   target.questions.push(...questions);
   if(['listening','reading'].includes(skill))target.questions.push({id:`report-${skill}-${i}`,skill,type:'score',purpose:'reflection',prompt:p.prompt||`Số câu đúng trong bài ${skills[skill]} trên lớp`,total:p.total||20});
  });
  return next;
 }
 function toDraft(form){
  if(form.schemaVersion===3)return clone(form);
  const value=normalize(form),next={...value,schemaVersion:3,sections:value.parts.length>=2?value.parts.map(p=>({id:p.id,title:p.title})):[],questions:value.parts.flatMap(p=>p.questions.map(q=>({...q,section:value.parts.length>=2?p.id:''}))),sectionMeta:Object.fromEntries(value.parts.map(p=>[p.id,{instructions:p.instructions||'',audioUrl:p.audioUrl||''}]))};
  delete next.parts;return next;
 }
 const skillList=form=>[...new Set(normalize(form).parts.flatMap(p=>p.questions.map(q=>q.skill||'general')))];
 const graded=q=>(q.original?.maxScore>0||['listening','reading'].includes(q.skill))&&q.purpose!=='reflection'&&['mcq','multi','gap','matching'].includes(q.type);
 function correct(q,response){
  if(q.type==='mcq')return (q.answers||[]).includes(Number(response))&&response!==''&&response!==undefined;
  if(q.type==='multi')return Array.isArray(response)&&JSON.stringify([...response].map(Number).sort())===JSON.stringify([...(q.answers||[])].sort());
  if(q.type==='gap')return String(q.answer||'').split('\n').some(a=>normal(a)&&normal(a)===normal(response));
  if(q.type==='matching')return q.pairs.every((_,i)=>String(response?.[i])===String(i));
  return false;
 }
 const api={labels,skills,normalize,toDraft,skillList,graded,correct};
 root.ProgressLogWorksheet=api;
})(globalThis);
