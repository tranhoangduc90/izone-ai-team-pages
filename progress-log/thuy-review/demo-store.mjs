// Bộ nhớ thử dùng chung cho máy chủ local và Pages. Chỉ đổi dữ liệu trong phiên.
// Đầu vào là gói riêng tư đã đọc; không có API hoặc đường ghi tới hệ thống thật.
import {projectSnapshot,itemsOf,applicable,blank,validateResponses,grade,allPartsSubmitted} from './model.mjs';
import {applyReviewData,learnerFeedback,deadlineView,changeDeadline,updateAutoDeadline} from './review-decisions.mjs';
export function createDemoStore(raw){
const initial=raw.baseline||(raw.format==='thuy-review-data-v1'?raw.data:projectSnapshot(raw));
const keys=raw.format==='thuy-review-data-v1'?raw.keys:Object.fromEntries(raw.sessions.map(s=>[s.number,s.privateKey?.items||{}]));
let data = applyReviewData(structuredClone(raw.format==='thuy-review-data-v1'?raw.data:initial)), fake = new Map(raw.demoState?.fake||[]), feedback = new Map(raw.demoState?.feedback||[]);
const fakePeople = [{studentRef:'demo-a',name:'Học viên thử A'},{studentRef:'demo-b',name:'Học viên thử B'}];
const byNumber = number => {
  const s = data.sessions.find(s => s.number === Number(number));
  if (!s) throw new Error('Không tìm thấy buổi học.');
  return s;
};
function fakeState(s,ref) {
  if (!fakePeople.some(p => p.studentRef === ref)) throw new Error('Không có người học thử này.');
  const key = `${s.number}:${s.generation}:${ref}`;
  if (!fake.has(key)) fake.set(key,{responses:{},checkpoints:[],submitted:false,participated:false,updatedAt:null,gradingItems:[]});
  return fake.get(key);
}
function studentData(s, ref) {
  const isFake = ref.startsWith('demo-'), person = isFake ? fakePeople.find(p => p.studentRef === ref) : s.students.find(p => p.studentRef === ref);
  if (!person) throw new Error('Người học không thuộc danh sách buổi này.');
  const state = isFake ? fakeState(s,ref) : null;
  // Lịch sử thu hồi và nháp nhận xét không nằm trong phản hồi cho học viên.
  const responses = isFake ? state.responses : (person.submitted ? person.detail.responses : person.draftResponses);
  const published = feedback.get(`${s.number}:${s.generation}:${ref}`)?.published ?? person.publishedFeedback ?? '';
  const visibleGrading = s.showAnswers && (isFake ? state.submitted || state.checkpoints.length : person.submitted);
  return {capturedAt:data.capturedAt,number:s.number,date:s.date,title:s.title,definition:s.definition,generation:s.generation,
    replacement:Boolean(s.replacement),person:{studentRef:ref,name:person.name},isFake,deadline:deadlineView(s),
    roster:isFake?fakePeople:s.students.map(p => ({studentRef:p.studentRef,name:p.name})),
    releases:s.releases, submitted:isFake?state.submitted:person.submitted,
    completeness:isFake?state.completeness:person.completeness,
    checkpoints:isFake?state.checkpoints:person.checkpoints, responses,
    participated:isFake?state.participated:Boolean(person.checkpoints.length || person.submitted),
    portal:isFake?'simulated':person.portal.status,
    gradingItems:visibleGrading ? (isFake?state.gradingItems:person.detail.gradingItems) : [],
    answersVisible:Boolean(visibleGrading),answerKey:visibleGrading?s.answerKey||keys[s.number]||{}:{}, publishedFeedback:learnerFeedback(s.number,ref,published),
    courseHistory:isFake?[]:[...data.sessions,...(data.courseSessions||[])].flatMap(v=>{const p=v.students.find(p=>p.studentRef===ref);return p?[{number:v.number,date:v.date,title:v.title,definition:v.definition,submitted:p.submitted,responses:p.submitted?p.detail.responses:p.draftResponses,gradingItems:[],publishedFeedback:learnerFeedback(v.number,ref,feedback.get(`${v.number}:${v.generation}:${ref}`)?.published??p.publishedFeedback??'')}]:[];}),
    testResults:isFake?[]:(data.testResults||[]).filter(v=>v.studentRef===ref),
    sessions:data.sessions.map(v => ({number:v.number,date:v.date,title:v.title,available:isFake || v.students.some(p => p.studentRef === ref)}))};
}
function mergeEditable(s, state, responses) {
  validateResponses(s.definition,responses);
  const next = {...state.responses};
  for (const block of s.definition.blocks) {
    if (state.checkpoints.some(c => c.blockId === block.blockId)) continue;
    for (const item of block.items) {
      if (Object.hasOwn(responses,item.itemVersionId)) next[item.itemVersionId] = responses[item.itemVersionId];
    }
  }
  return next;
}
function mutate(body) {
  if (body.action === 'reset') {data=applyReviewData(structuredClone(initial));fake=new Map();feedback=new Map();return {ok:true};}
  const s = byNumber(body.number);
  if (body.generation !== s.generation) throw new Error('Bài đã được thu hồi. Nháp cũ được giữ trong lịch sử của giảng viên; hãy mở bài hiện tại.');
  if(['deadlineClock','deadlineExtend'].includes(body.action))return changeDeadline(s,body);
  if (body.action === 'release') {
    const r=s.releases.find(v => v.blockId===body.blockId);
    if (!r) throw new Error('Không tìm thấy phần bài.');
    r.status=body.open?'open':'closed';return {ok:true};
  }
  if (body.action === 'showAnswers') {s.showAnswers=Boolean(body.open);return {ok:true};}
  if (body.action === 'replace') {
    const template=body.definition?{number:s.number,title:body.title,definition:body.definition,answerKey:body.keys}:byNumber(body.template);
    if(!template.definition?.blocks?.length||!template.title?.trim())throw Error('Bài thay thế chưa hợp lệ.');
    const history={title:s.title,generation:s.generation,retiredAt:new Date().toISOString(),definition:s.definition,answerKey:s.answerKey,feedback:Object.fromEntries([...feedback].filter(([key])=>key.startsWith(`${s.number}:${s.generation}:`))),
      students:structuredClone(s.students),fake:[...fake].filter(([key]) => key.startsWith(`${s.number}:${s.generation}:`))};
    s.retired.push(history);s.generation++;s.closesAt=null;delete s.deadlineState;
    s.replacement={template:template.number};s.title=`Bài thay thế · ${template.title}`;
    s.definition=structuredClone(template.definition);s.answerKey=structuredClone(template.answerKey||keys[template.number]||{});s.showAnswers=false;
    s.releases=s.definition.blocks.map(b => ({blockId:b.blockId,status:'closed'}));
    s.analytics=[];
    s.students=s.students.map(p => ({...p,submitted:false,started:false,checkpoints:[],draftResponses:{},quiz:null,
      reports:{listening:null,reading:null},portal:{status:'not_recorded',readbackAt:null},
      detail:{student:{studentRef:p.studentRef,name:p.name},sessionNumber:s.number,status:'not_submitted',submissionId:null,responses:{},gradingItems:[],definition:s.definition}}));
    return {ok:true};
  }
  if (['feedbackDraft','feedbackPublish'].includes(body.action)) {
    if (!s.students.some(p => p.studentRef===body.ref) && !fakePeople.some(p => p.studentRef===body.ref)) throw new Error('Sai người học.');
    if (typeof body.text !== 'string' || body.text.length>20000) throw new Error('Nhận xét không hợp lệ.');
    const key=`${s.number}:${s.generation}:${body.ref}`, prior=s.students.find(p=>p.studentRef===body.ref)?.publishedFeedback||'', old=feedback.get(key)||{draft:prior,published:prior};
    old.draft=body.text;
    if (body.action==='feedbackPublish') old.published=body.text;
    old.updatedAt=new Date().toISOString();feedback.set(key,old);return {ok:true,...old};
  }
  const state=fakeState(s,body.ref);
  if (state.submitted) {
    if(body.action==='final'||(body.action==='checkpoint'&&state.checkpoints.some(c=>c.blockId===body.blockId)))return {ok:true,participated:true,submitted:true,completeness:state.completeness};
    throw new Error('Bài đã nộp; chỉ được xem lại.');
  }
  if(body.action==='checkpoint'&&state.checkpoints.some(c=>c.blockId===body.blockId))return {ok:true,participated:true,submitted:state.submitted,completeness:state.completeness};
  if(['checkpoint','final'].includes(body.action)&&deadlineView(s).closed&&!(body.action==='final'&&allPartsSubmitted(s.definition,state.checkpoints)))throw Error('Phiếu đã hết hạn nhận bài. Nháp vẫn được giữ; hãy liên hệ giảng viên nếu cần gia hạn.');
  const next=mergeEditable(s,state,body.responses||{});
  if (body.failSave) throw new Error('Lỗi lưu được mô phỏng. Nội dung vẫn ở người học hiện tại; thử lưu lại để tiếp tục.');
  if (body.action==='draft') {
    state.responses=next;state.updatedAt=new Date().toISOString();return {ok:true,updatedAt:state.updatedAt};
  }
  if (body.action==='checkpoint') {
    const block=s.definition.blocks.find(b => b.blockId===body.blockId);
    if (!block || s.releases.find(r => r.blockId===body.blockId)?.status!=='open') throw new Error('Phần này đang đóng. Nháp được giữ.');
    if (state.checkpoints.some(c => c.blockId===block.blockId)) return {ok:true};
    const incomplete=block.items.some(i => applicable(i,next) && blank(next[i.itemVersionId]));
    const checkpoints=[...state.checkpoints,{blockId:block.blockId,submittedAt:deadlineView(s).now,completeness:incomplete?'partial':'complete'}];
    const gradingItems=grade(s.definition,next,s.answerKey||keys[s.replacement?.template||s.number]||{}),completed=allPartsSubmitted(s.definition,checkpoints);
    // Tính xong kết quả trước khi ghi; phần cuối và hoàn tất phiếu được nhận cùng lúc.
    const completion=completed?{submitted:true,submittedAt:deadlineView(s).now,completeness:itemsOf(s.definition).some(i=>applicable(i,next)&&blank(next[i.itemVersionId]))?'partial':'complete'}:{};
    Object.assign(state,{responses:next,checkpoints,participated:true,gradingItems},completion);
    if(completed)updateAutoDeadline(s,fake);
    return {ok:true,participated:true,submitted:state.submitted,completeness:state.completeness};
  }
  if (body.action==='final') {
    // Tương thích phiếu 2/2 từ tab cũ; không cho bỏ qua phần chưa nộp.
    if(!allPartsSubmitted(s.definition,state.checkpoints))throw new Error('Hãy nộp từng phần trước khi hoàn tất phiếu.');
    const completeness=itemsOf(s.definition).some(i=>applicable(i,next)&&blank(next[i.itemVersionId]))?'partial':'complete';
    const gradingItems=grade(s.definition,next,s.answerKey||keys[s.replacement?.template||s.number]||{});
    Object.assign(state,{responses:next,submitted:true,participated:true,completeness,gradingItems});
    state.submittedAt=deadlineView(s).now;updateAutoDeadline(s,fake);
    return {ok:true,participated:true,completeness:state.completeness};
  }
  throw new Error('Thao tác không được hỗ trợ.');
}

return {
 exportPackage:()=>structuredClone({format:'thuy-review-data-v1',data,baseline:initial,keys,demoState:{fake:[...fake],feedback:[...feedback]}}),
 teacher:()=>structuredClone({...data,sessions:data.sessions.map(v=>({...v,deadline:deadlineView(v)})),feedback:Object.fromEntries(feedback),fakePeople,simulationOnly:true}),
 student:(number,ref,generation)=>{const session=byNumber(number);if(generation!=null&&Number(generation)!==session.generation){const error=Error('Bài cũ đã thu hồi. Hãy mở bài hiện tại.');error.status=410;throw error;}return structuredClone(studentData(session,ref||'demo-a'));},
 mutate,
 metadata:()=>({capturedAt:data.capturedAt})
};
}
