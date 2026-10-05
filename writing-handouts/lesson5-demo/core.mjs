// Dữ liệu nhận vào là bài demo; quản lý luật mở khóa và kết quả giả, không gọi dịch vụ.
// Lỗi nhập/lượt cũ trả mã để giao diện báo rõ, không biến lỗi thành bài cần sửa.
export const ORDER = ['topic', 'b1', 'a1', 'x1', 'b2', 'a2', 'x2'];
export const FIELDS = {topic:['idea1','idea2','topicSentence'], b1:['b1'], a1:['a1'], x1:['x1'], b2:['b2'], a2:['a2'], x2:['x2']};
export const EXAMPLE = {
  idea1:'Lãng phí tiền, khó dành dụm cho những nhu cầu thiết yếu.',
  idea2:'Tạo thêm rác thải và gây áp lực lên môi trường.',
  topicSentence:'Buying unnecessary products is a negative development because it can put pressure on personal finances and the environment.',
  b1:'Không còn đủ tiền để trang trải các nhu cầu thiết yếu như tiền nhà hoặc học phí.',
  a1:'Chi tiền mua một chiếc điện thoại mới dù điện thoại đang dùng vẫn hoạt động tốt.',
  x1:'Khoản tiền dành cho chiếc điện thoại mới làm giảm số tiền còn lại cho tiền nhà và học phí.',
  b2:'Lượng rác thải tăng lên, khiến bãi chôn lấp phải tiếp nhận nhiều đồ bị bỏ đi hơn.',
  a2:'Thay đồ dùng còn tốt bằng mẫu mới rồi vứt bỏ đồ cũ.',
  x2:'Những đồ cũ vẫn dùng được bị thải bỏ sớm, làm tăng lượng rác phải xử lý.'
};
export const VOCAB = {
  1:{ A:[['buy unnecessary products','mua sản phẩm không cần thiết'],['replace working devices','thay thiết bị vẫn hoạt động']], X:[['reduce available savings','làm giảm khoản tiết kiệm còn lại'],['spend beyond their needs','chi tiêu vượt nhu cầu']], B:[['cover essential expenses','trang trải chi phí thiết yếu'],['face financial pressure','chịu áp lực tài chính']] },
  2:{ A:[['discard usable products','vứt bỏ sản phẩm còn dùng được'],['replace items unnecessarily','thay đồ không cần thiết']], X:[['increase household waste','tăng rác thải sinh hoạt'],['shorten product lifespans','rút ngắn vòng đời sản phẩm']], B:[['put pressure on landfills','gây áp lực lên bãi rác'],['harm the environment','gây hại môi trường']] }
};
export function createState(generation = 0) {
  return {version:1,generation,responses:Object.fromEntries(Object.keys(EXAMPLE).map(k=>[k,''])),steps:Object.fromEntries(ORDER.map(k=>[k,{status:'draft',history:[],pending:null,error:''}])),idea2Open:false};
}
export function ideaPassed(s, n) { return ['b','a','x'].every(k=>s.steps[k+n].status==='passed'); }
export function available(s, key) {
  const pos=ORDER.indexOf(key);
  return pos>=0 && (pos===0 || s.steps[ORDER[pos-1]].status==='passed') && (pos<4 || s.idea2Open);
}
export function canEdit(s,key) { return available(s,key) && !['passed','pending'].includes(s.steps[key].status); }
export function setField(s,key,field,value) {
  if(!canEdit(s,key)||!FIELDS[key]?.includes(field))return false;
  s.responses[field]=String(value).slice(0,4000); return true;
}
export function beginCheck(s,key,requestId) {
  if(!canEdit(s,key)) return {ok:false,error:'LOCKED'};
  const empty=FIELDS[key].find(k=>!s.responses[k].trim());
  if(empty)return {ok:false,error:'EMPTY',field:empty};
  if(ORDER.some(k=>s.steps[k].pending))return {ok:false,error:'BUSY'};
  const ticket={requestId,key,generation:s.generation,snapshot:{...s.responses}};
  s.steps[key].status='pending'; s.steps[key].pending=ticket; s.steps[key].error='';
  return {ok:true,ticket};
}
export function finishCheck(s,ticket,result,feedback) {
  const step=s.steps[ticket.key];
  if(ticket.generation!==s.generation || !step?.pending || step.pending.requestId!==ticket.requestId)return false;
  if(!['passed','revision','technical_error'].includes(result))return false;
  step.pending=null; step.status=result;
  if(result==='technical_error') {step.error='Lượt chấm chưa hoàn tất. Bài của bạn vẫn được giữ.';return true;}
  step.error='';
  step.history.push({number:step.history.length+1,status:result,feedback,snapshot:ticket.snapshot});
  return true;
}
export function openIdea2(s) {if(!ideaPassed(s,1))return false;s.idea2Open=true;return true;}
export function fixture(caseName,generation=0) {
  const s=createState(generation); if(caseName==='blank')return s;
  s.responses={...EXAMPLE};
  const passed=caseName==='complete'?7:caseName==='idea1'?4:0;
  for(const key of ORDER.slice(0,passed)) {
    if(key==='b2')openIdea2(s);
    const {ticket}=beginCheck(s,key,'fixture-'+key);
    finishCheck(s,ticket,'passed','Phần này đã làm rõ điều cần chứng minh. Giữ nguyên nội dung và chuyển sang bước tiếp theo.');
  }
  if(caseName==='revision') {
    s.responses.topicSentence='Buying unnecessary products is bad for people.';
    const {ticket}=beginCheck(s,'topic','fixture-revision');
    finishCheck(s,ticket,'revision','Câu chủ đề đã nêu việc mua đồ không cần thiết, nhưng “bad for people” chưa tóm tắt cả hai ý. Em muốn người đọc thấy hai tác hại nào ngay từ câu này? Hãy tự viết lại câu để bao quát cả hai.');
  }
  return s;
}
export function restore(raw,generation=0) {
  const fresh=createState(generation);
  try {
    const saved=JSON.parse(raw);if(saved.version!==1||!saved.responses||!saved.steps) return fresh;
    for(const field of Object.keys(EXAMPLE))if(typeof saved.responses[field]==='string')fresh.responses[field]=saved.responses[field].slice(0,4000);
    fresh.idea2Open=saved.idea2Open===true;
    for(const key of ORDER) {
      const old=saved.steps[key];if(!old||!available(fresh,key))continue;
      fresh.steps[key].history=(Array.isArray(old.history)?old.history:[]).filter(h=>['passed','revision'].includes(h.status)&&typeof h.feedback==='string'&&h.snapshot&&FIELDS[key].every(f=>typeof h.snapshot[f]==='string')).slice(-100);
      const latest=fresh.steps[key].history.at(-1);
      fresh.steps[key].status=latest?.status==='passed'?'passed':old.status==='pending'||old.status==='technical_error'?'technical_error':latest?'revision':'draft';
      if(fresh.steps[key].status==='technical_error')fresh.steps[key].error='Phiên xem thử đã gián đoạn. Nội dung được giữ; bạn có thể Check lại.';
    }
    if(!ideaPassed(fresh,1))fresh.idea2Open=false;
    return fresh;
  }catch {return fresh;}
}
