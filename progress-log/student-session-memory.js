const key='izone:progress-log:logout:v1',historyKey='progressLogLogoutEpoch';
function epoch(){try{return localStorage.getItem(key)||'0';}catch{return '0';}}
export function stampProgressStudent(){try{history.replaceState({...history.state,[historyKey]:epoch()},'');}catch{/* Nháp vẫn gắn chủ bằng token trong tab. */}}
export function progressPinWasLoggedOut(){return Boolean((history.state?.izoneCourseStudentIdentityV1||history.state?.[historyKey]!==undefined)&&!history.state?.izoneCourseStudentIdentityV1?.cleared)
  &&String(history.state?.[historyKey]||'0')!==epoch();}
export function markProgressLogout(){try{localStorage.setItem(key,crypto.randomUUID());}catch{/* Bộ nhớ danh tính đã được xóa nguyên tử trước bước này. */}}
