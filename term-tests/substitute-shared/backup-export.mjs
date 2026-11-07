const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>typeof value==='string'?value:'';
const number=value=>Number.isFinite(value)?value:null;

function objectiveAnswers(value){
 if(!value||typeof value!=='object')return {};
 return Object.fromEntries(Object.entries(value).filter(([question,answer])=>/^\d+(?:[a-z]|[._-]\d+)?$/i.test(question)
  &&(typeof answer==='string'||Array.isArray(answer)&&answer.every(item=>typeof item==='string'))));
}

function writingAnswers(value){
 return {task1:text(value?.task1),task2:text(value?.task2)};
}

// Local snapshots and submission payloads contain authorization and grading data.
// Only copy the student response fields needed to recover work from this file.
export function makeSubstituteBackup({scope,lobby,app,sections,writing,title}){
 const {testSlug,classCode,studentRef,clientRunId}=scope;
 const identity={testSlug,classCode,studentRef,clientRunId};
 const order=lobby?.examOrder==='reading-first'?'reading-first':'listening-first';
 const record={version:1,exportedAt:new Date().toISOString(),scope:identity,
  lobby:{studentName:text(lobby?.studentName??app?.studentName),examOrder:order},
  app:{drafts:{listening:objectiveAnswers(app?.drafts?.listening),reading:objectiveAnswers(app?.drafts?.reading),
   writing:writingAnswers(app?.drafts?.writing)}},
  sections:sections.filter(row=>['listening','reading'].includes(row.skill)).map(row=>({skill:row.skill,
   answers:objectiveAnswers(row.answers),status:row.status==='acknowledged'?'acknowledged':'pending',
   queuedAt:number(row.queuedAt),acknowledgedAt:number(row.acknowledgedAt)})),
  writing:writing?{answers:writingAnswers(writing.payload),status:writing.status==='acknowledged'?'acknowledged':'pending',
   queuedAt:number(writing.queuedAt),acknowledgedAt:number(writing.acknowledgedAt)}:null};
 const json=escapeHtml(JSON.stringify(record,null,2)),heading=escapeHtml(title);
 const html=`<!doctype html><html lang="vi"><meta charset="utf-8"><title>${heading}</title><style>body{font:16px/1.6 system-ui;max-width:960px;margin:auto;padding:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>${heading}</h1><p>Bản lưu ngoại tuyến để giữ câu trả lời. Hãy giữ file này và liên hệ giáo viên nếu trang thi không đồng bộ được.</p><pre>${json}</pre></html>`;
 return {blob:new Blob([html],{type:'text/html;charset=utf-8'}),name:`${testSlug}-${classCode}-${studentRef}-${clientRunId.slice(0,8)}.html`};
}
