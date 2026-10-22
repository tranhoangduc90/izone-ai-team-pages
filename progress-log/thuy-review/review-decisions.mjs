// Áp dụng dữ liệu bổ sung đã xác minh vào cả phiên mới và phiên trình duyệt cũ, không thay snapshot gốc.
import {miniResults} from './mini-test-results.mjs';
export const sessionContext=number=>Number(number)===4?'Ôn Listening; bài mới Reading và Speaking':'';
export const needsFeedbackVerification=(number,ref,text)=>Number(number)===4&&ref==='e988230c-995b-4b23-87b7-fb9ae7f663ac'&&text?.trim()==='gjjyuyuy';
export const learnerFeedback=(number,ref,text)=>needsFeedbackVerification(number,ref,text)?'':text||'';
export function applyReviewData(data){
 if(data.className!=='IC2305')return data;
 const people=new Set((data.people||[]).map(p=>p.studentRef));
 const refs=new Set(miniResults.map(v=>v.studentRef));
 data.testResults=[...(data.testResults||[]).filter(v=>!(refs.has(v.studentRef)&&v.result?.testSlug==='mini-test-lesson-5')),
  ...miniResults.filter(v=>people.has(v.studentRef)).map(v=>structuredClone(v))];
 return data;
}

// Đồng hồ dưới đây chỉ phục vụ demo lịch sử. Mọi thời điểm phải có múi giờ, không đổi hạn lớp thật.
function stamp(value){
 if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Thời điểm không hợp lệ hoặc thiếu múi giờ.');
 return new Date(value).toISOString();
}
const cutoff=when=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(stamp(when)));
 const get=type=>parts.find(p=>p.type===type).value;
 return stamp(`${get('year')}-${get('month')}-${get('day')}T22:00:00+07:00`);
};
export function deadlineView(session){
 const saved=session.deadlineState;
 const originalClosesAt=saved?saved.originalClosesAt:session.closesAt||null;
 const extensions=saved?.extensions||[];
 const closesAt=extensions.at(-1)?.closesAt||originalClosesAt;
 const now=stamp(saved?.now||`${session.date}T21:00:00+07:00`);
 return {revision:saved?.revision||0,now,originalClosesAt,closesAt,thresholdAt:saved?.thresholdAt||null,
  extensions:structuredClone(extensions),closed:closesAt?Date.parse(now)>=Date.parse(closesAt):false,simulated:true};
}
export function changeDeadline(session,body){
 const prior=deadlineView(session);
 if(body.expectedRevision!==prior.revision)throw Error('Hạn nhận bài đã thay đổi ở tab khác. Mở lại để xem bản mới trước khi sửa.');
 if(body.action==='deadlineClock'){
  if(!prior.closesAt)throw Error('Chưa có mốc đóng tự động để thử hết hạn.');
  session.deadlineState={...prior,now:new Date(Date.parse(prior.closesAt)+60000).toISOString(),revision:prior.revision+1};
 }else{
  const next=stamp(body.closesAt),reason=typeof body.reason==='string'?body.reason.trim():'';
  if(!prior.closed)throw Error('Phiếu chưa hết hạn; chưa cần mở lại bằng gia hạn.');
  if(!reason||reason.length>500)throw Error('Hãy ghi lý do gia hạn, tối đa 500 ký tự.');
  if(Date.parse(next)<=Date.parse(prior.now)||Date.parse(next)<=Date.parse(prior.closesAt))throw Error('Hạn mới phải sau thời gian mô phỏng và hạn cũ.');
  session.deadlineState={...prior,revision:prior.revision+1,extensions:[...prior.extensions,{closesAt:next,reason,changedAt:prior.now,previousClosesAt:prior.closesAt}]};
 }
 return {ok:true,deadline:deadlineView(session)};
}
export function updateAutoDeadline(session,fake){
 const prior=deadlineView(session);
 if(prior.originalClosesAt)return;
 const times=new Map();
 for(const person of session.students){
  const last=person.checkpoints?.map(c=>c.submittedAt).filter(Boolean).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  if(person.submitted&&person.completeness==='complete'&&last)times.set(person.studentRef,stamp(last));
 }
 for(const [key,state] of fake){
  if(!key.startsWith(`${session.number}:${session.generation}:`)||!state.submitted||state.completeness!=='complete')continue;
  const last=state.submittedAt||state.checkpoints.map(c=>c.submittedAt).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  if(last)times.set(key,stamp(last));
 }
 const third=[...times.values()].sort((a,b)=>Date.parse(a)-Date.parse(b))[2];
 if(third)session.deadlineState={...prior,revision:prior.revision+1,thresholdAt:third,originalClosesAt:cutoff(third)};
}
