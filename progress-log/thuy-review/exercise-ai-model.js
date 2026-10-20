/* Local parser for the AI interaction prototype; no network calls or generated keys. */
(function(root){
 const kinds={general:'Chung',listening:'Listening',reading:'Reading',speaking:'Speaking',writing:'Writing'};
 const sample='';
 const base=(type,skill,prompt,purpose='practice')=>({skill,question:{type,purpose,prompt,explanation:'',...(['mcq','multi'].includes(type)?{options:[],answers:[]}:{}),...(['gap','open'].includes(type)?{answer:''}:{}),...(type==='matching'?{pairs:[]}:{} )},warnings:[]});
 function parse(text,defaultSkill='general'){
  if(defaultSkill&&!kinds[defaultSkill])throw Error('Chọn kỹ năng nhận câu hỏi.');
  const raw=String(text||'').replace(/\r\n?/g,'\n').trim();
  if(!raw)throw Error('Dán nội dung đề bài trước khi phân tích.');
  if(raw.length>24000)throw Error('Mỗi lần phân tích tối đa 24.000 ký tự.');
  let skill=defaultSkill,hint='',title='',sections=[],current={skill,hint,lines:[]};
  for(const line of raw.split('\n')){
   if(/^Tên bài\s*:/i.test(line)){title=line.replace(/^Tên bài\s*:\s*/i,'').trim();continue}
   const skillName=Object.keys(kinds).find(k=>new RegExp(`\\b${k}\\b`,'i').test(line));
   if(/^(?:phần|section)\s*\d*\s*[:.\-]?/i.test(line)||/^\s*(Listening|Reading|Speaking|Writing)\s*:?\s*$/i.test(line)){
    if(current.lines.some(v=>v.trim()))sections.push(current);
    skill=skillName||skill;hint=line.toLowerCase();current={skill,hint,lines:[]};
   }else current.lines.push(line);
  }
  if(current.lines.some(v=>v.trim()))sections.push(current);
  const items=[];
  for(const section of sections){
   if(!kinds[section.skill])throw Error('Chọn kỹ năng nhận câu hỏi hoặc ghi rõ kỹ năng trong đề bài.');
   const blocks=section.lines.join('\n').trim().split(/\n\s*\n/).filter(Boolean);
   for(const block of blocks){
    const pairLines=block.split('\n').map(l=>l.replace(/^\s*\d+[.)]\s*/,'').trim()).filter(Boolean);
    const matches=pairLines.map(l=>l.match(/^(.+?)\s+(?:-|–|→|=)\s+(.+)$/)).filter(Boolean);
    if(matches.length>=2&&(/matching|nối|ghép/.test(section.hint)||matches.length>=pairLines.length-1)){
     const item=base('matching',section.skill,pairLines.find(l=>!/^(.+?)\s+(?:-|–|→|=)\s+(.+)$/.test(l))||'Nối các cặp tương ứng.');
     item.question.pairs=matches.map(m=>({left:m[1],right:m[2]}));items.push(item);continue;
    }
    const questions=block.split(/\n(?=\s*\d+[.)]\s+)/).filter(Boolean);
    for(const input of questions){
     const content=input.replace(/^\s*\d+[.)]\s*/,'').trim();
     const lines=content.split('\n');
     const answer=lines.find(l=>/^(?:đáp án|answer|đáp án mẫu|gợi ý)\s*:/i.test(l));
     const explanation=lines.find(l=>/^(?:giải thích|explanation)\s*:/i.test(l));
     const body=lines.filter(l=>!/^(?:đáp án|answer|đáp án mẫu|gợi ý|giải thích|explanation)\s*:/i.test(l));
     const options=body.map(l=>l.match(/^\s*([A-H])[.):]\s+(.+)$/)).filter(Boolean);
     const prompt=body.filter(l=>!/^\s*[A-H][.):]\s+/.test(l)).join('\n').trim();
     const answerText=answer?answer.replace(/^[^:]+:\s*/,'').split(/\s*(?:Giải thích|Explanation)\s*:/i)[0].trim():'';
     const explanationText=explanation?explanation.replace(/^[^:]+:\s*/,''):answer?.match(/(?:Giải thích|Explanation)\s*:\s*(.*)/i)?.[1]||'';
     const reflection=/tự nhận xét|cảm nhận|suy ngẫm/.test(section.hint+' '+prompt.toLowerCase());
     if(options.length>=2){
      const letters=(answerText.match(/\b[A-H]\b/g)||[]);
      const multiple=letters.length>1||/chọn nhiều|các đáp án|select all|choose (?:two|three|all)/i.test(section.hint+' '+prompt)||reflection;
      const item=base(multiple?'multi':'mcq',section.skill,prompt,reflection?'reflection':'practice');
      item.question.options=options.map(m=>m[2]);
      item.question.answers=reflection?[]:letters.map(l=>options.findIndex(m=>m[1]===l)).filter(i=>i>=0);
      if(!reflection&&!item.question.answers.length)item.warnings.push('Chưa có đáp án đúng; cần bổ sung khi soạn.');
      item.question.explanation=explanationText;items.push(item);continue;
     }
     const blanks=[...prompt.matchAll(/\[([^\]\n]+)\]/g)];
     if(blanks.length&&!reflection){
      blanks.forEach((match,index)=>{
       const item=base('gap',section.skill,prompt.replace(/\[([^\]\n]+)\]/g,(_all,word,offset)=>offset===match.index?'_____':word));
       item.question.answer=/^[_\s.]+$/.test(match[1])?answerText:match[1];item.question.explanation=explanationText;
       if(!item.question.answer)item.warnings.push('Chưa có đáp án điền từ; cần bổ sung khi soạn.');items.push(item);
      });continue;
     }
     if(reflection){
      const item=base('multi',section.skill,prompt,'reflection');item.question.options=['',''];
      item.warnings.push('Tự nhận xét cần có các lựa chọn; bổ sung khi soạn.');items.push(item);continue;
     }
     const gap=/_{2,}/.test(prompt)||/gap|fill in|điền/.test(section.hint);
     const item=base(gap?'gap':'open',section.skill,prompt);item.question.answer=answerText;item.question.explanation=explanationText;
     if(gap&&!answerText)item.warnings.push('Chưa có đáp án điền từ; cần bổ sung khi soạn.');
     items.push(item);
    }
   }
  }
  if(!items.length)throw Error('Chưa tìm thấy câu hỏi. Kiểm tra lại nội dung đề bài.');
  if(items.length>100)throw Error('Mỗi lần chỉ thêm tối đa 100 câu hỏi.');
  return {title,items};
 }
 function merge(draft,items,title='',sectionId=null){
  if(!items.length)throw Error('Chọn ít nhất một câu hỏi để thêm vào bài.');
  const next=structuredClone(draft);
  if(!next.title.trim()&&title)next.title=title.slice(0,150);
  if(next.schemaVersion===3){
   if(next.questions.length+items.length>200)throw Error('Mỗi bài có tối đa 200 câu hỏi.');
   const target=next.sections?.length?(sectionId??next.sections[0].id):'';
   if(next.sections?.length&&!next.sections.some(p=>p.id===target))throw Error('Phần nhận câu hỏi không còn tồn tại. Chọn lại phần đang soạn.');
   for(const item of items){if(!kinds[item.skill])throw Error('Kỹ năng nhận câu hỏi không hợp lệ.');next.questions.push({...structuredClone(item.question),id:crypto.randomUUID(),skill:item.skill,section:target})}
   return next;
  }
  for(const item of items){
   if(!kinds[item.skill])throw Error('Kỹ năng nhận câu hỏi không hợp lệ.');
   let part=next.schemaVersion===2?next.parts.find(p=>p.id===(sectionId??'review')):next.parts.find(p=>p.skill===item.skill);
   if(!part){part={skill:item.skill,prompt:['listening','reading'].includes(item.skill)?'Ghi lại kết quả bài đã làm trên lớp.':item.skill==='speaking'?'Hoàn thành phần tự nhận xét Speaking.':'Hoàn thành bài Writing theo yêu cầu bên dưới.',...(['listening','reading'].includes(item.skill)?{total:20}:{}),questions:[]};next.parts.push(part)}
   part.questions=part.questions||[];
   if(part.questions.length>=100)throw Error(`Phần ${kinds[item.skill]} có tối đa 100 câu hỏi.`);
   part.questions.push({...structuredClone(item.question),skill:item.skill,id:crypto.randomUUID()});
  }
  return next;
 }
 const api={sample,parse,merge};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProgressLogExerciseAIModel=api;
})(typeof window!=='undefined'?window:globalThis);
