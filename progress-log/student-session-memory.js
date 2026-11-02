const key='izone:progress-log:logout:v1',historyKey='progressLogLogoutEpoch';
const handoffKey='izone:progress-log:selection-handoff:v1';
// Chỉ chuyển lựa chọn vừa xác nhận trong cùng tab; không lưu tên hoặc token phiếu.
export function handoffProgressStudent({classId,studentRef,remember}){
  try{sessionStorage.setItem(handoffKey,JSON.stringify({classId:String(classId),studentRef,remember:Boolean(remember),at:Date.now(),logoutEpoch:epoch()}));return true;}catch{return false;}
}
export function consumeProgressStudentHandoff({classId,studentRefs,expectedRef}){
  try{
    const raw=sessionStorage.getItem(handoffKey);sessionStorage.removeItem(handoffKey);const value=JSON.parse(raw||'null');
    if(!value||value.classId!==String(classId)||value.studentRef!==expectedRef||!studentRefs.includes(value.studentRef)
      ||value.logoutEpoch!==epoch()||!Number.isFinite(value.at)||Date.now()-value.at<0||Date.now()-value.at>120000)return null;
    return value;
  }catch{return null;}
}
function epoch(){try{return localStorage.getItem(key)||'0';}catch{return '0';}}
export function stampProgressStudent(){try{history.replaceState({...history.state,[historyKey]:epoch()},'');}catch{/* Nháp vẫn gắn chủ bằng token trong tab. */}}
export function progressPinWasLoggedOut(){return Boolean((history.state?.izoneCourseStudentIdentityV1||history.state?.[historyKey]!==undefined)&&!history.state?.izoneCourseStudentIdentityV1?.cleared)
  &&String(history.state?.[historyKey]||'0')!==epoch();}
export function markProgressLogout(){try{localStorage.setItem(key,crypto.randomUUID());}catch{/* Bộ nhớ danh tính đã được xóa nguyên tử trước bước này. */}}
