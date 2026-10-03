// Lấy tên nội dung từ phiếu/lịch đã xác nhận và tính nhãn buổi theo giờ Việt Nam.
// Đồng hồ chỉ chọn nhãn/đường vào; máy chủ vẫn quyết định quyền và mở từng phần.
export function contentTitle(slot,form){
  const raw=String(form?.title||slot?.assignments?.[0]?.title||'').trim();
  const title=raw.replace(/^ENTRANCE\s+TICKET\s*[•:·–—-]\s*/iu,'').replace(/^Progress\s*Log\s*(?:[-–—:·]\s*)?(?:buổi\s*\d+\s*(?:[-–—:·]\s*)?)?/iu,'').replace(/^Buổi\s*\d+\s*[-–—:·]\s*/iu,'').trim().replace(/\b(Listening|Reading|Writing|Speaking)\b/gi,m=>m[0].toUpperCase()+m.slice(1).toLowerCase());
  return title|| (slot?.sessionKind==='test'?'Buổi Test':'Nội dung chưa được xác nhận');
}
export function skillsLabel(title){return [...title.matchAll(/\b(Listening|Reading|Writing|Speaking)\b/gi)].map(m=>m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');}
export function sessionHeading(slot,form){return 'Buổi '+String(slot?.sessionNumber??form?.sessionNumber??'').padStart(2,'0')+' · '+contentTitle(slot,form);}
export function vietnamDate(now=Date.now()){return new Date(now+7*3600_000).toISOString().slice(0,10);}
export function startsAt(date){
  if(!/^\d{4}-\d{2}-\d{2}$/u.test(String(date)))return null;
  const day=Date.parse(date+'T00:00:00Z');
  if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==date)return null;
  return Date.parse(date+'T18:25:00+07:00');
}
export function sessionState(slot,cell,form,now=Date.now()){
  if(!Number.isFinite(now))throw new Error('Thời gian không hợp lệ.');
  if(slot?.conflict||slot?.assignments?.length>1||cell?.status==='needs_review')return {kind:'review',label:'Cần đối chiếu phiếu',canLearn:false};
  if(cell?.status==='not_assigned')return {kind:'locked',label:'Chưa được gán phiếu',canLearn:false};
  if(cell?.status==='complete')return {kind:'complete',label:'✓ Đã hoàn thành',canLearn:false};
  if(cell?.status==='test_result')return {kind:'complete',label:'Đã có kết quả Test',canLearn:false};
  if(!form||!cell?.assignmentId)return {kind:'empty',label:slot?.sessionKind==='test'?'Buổi Test · chưa có kết quả':'Chưa tạo Progress Log',canLearn:false};
  if(form.status!=='published')return {kind:'locked',label:'Phiếu đã đóng · xem lại',canLearn:false};
  const start=startsAt(slot?.sessionDate);
  if(start===null)return {kind:'locked',label:'Chưa xác nhận lịch học',canLearn:false};
  if(now<start)return {kind:'locked',label:'Chưa đến buổi học',canLearn:false};
  if(vietnamDate(now)===slot.sessionDate)return {kind:'active',label:'Nhấn để học buổi hôm nay',canLearn:true};
  return {kind:'active',label:cell?.status==='incomplete'?'Tiếp tục Progress Log':'Mở Progress Log của buổi học',canLearn:true};
}
