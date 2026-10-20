// Dữ liệu vào là khóa/bài đã chọn. Chỉ cho phép hai lớp giả và sáu bài đã biết.
// Mọi yêu cầu reset gắn đúng lớp, học viên và bài; lỗi dừng ở bài đó, không tự gửi lại.
export const COURSES = Object.freeze({
  '56': { code: 'CODEXDEMO56', api: 'https://ducizone.ddns.net/mapping-api-demo', teacher: 'teacher-k56',
    tests: {term1:'term-test-1-k56',term2:'term-test-2-k56',mini:'mini-test-k56'} },
  '67': { code: 'CODEXDEMO806', api: 'https://ducizone.ddns.net:18869/term-mini-k67-api', teacher: 'teacher',
    tests: {term1:'term-test-1',term2:'term-test-2',mini:'mini-test-lesson-5'} }
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function demoContext(course, test) {
  const config=COURSES[course],slug=config?.tests[test];
  if(!slug)throw new Error('Khóa hoặc bài demo không hợp lệ.');
  return {...config,slug};
}
export async function loadStudents(context, request=fetch) {
  const response=await request(`${context.api}/api/term-tests/roster?class=${context.code}&test=${context.slug}`,{signal:AbortSignal.timeout(15000),cache:'no-store'});
  const data=await response.json();
  if(!response.ok||data.ok!==true||data.class?.name!==context.code||!Array.isArray(data.students))throw new Error(data.message||'Chưa tải được đúng lớp demo. Hãy thử tải lại.');
  if(!data.students.length)throw new Error('Lớp demo chưa có học viên. Hãy thử tải lại sau khi lớp được mở.');
  const refs=new Set();
  for(const student of data.students){
    if(!uuid.test(student.ref)||typeof student.name!=='string'||!student.name.trim()||refs.has(student.ref))throw new Error('Danh sách học viên chưa hợp lệ.');
    refs.add(student.ref);
  }
  return data.students;
}
export function resetSignal(context,studentRef){return `izone-demo-reset:student:${context.code}:${studentRef}:${context.slug}`;}
export function clearStudentStorage(context,studentRef,storages){
  // Chỉ bỏ trạng thái đã chứng minh thuộc người vừa reset; không xóa cả kho trình duyệt.
  for(const storage of storages){
    try{
      const keys=Array.from({length:storage.length},(_,i)=>storage.key(i));
      for(const key of keys){
        const base=`izone-test:${context.slug}:${context.code}`;
        if(key!==base&&!key?.startsWith(base+':'))continue;
        try{if(JSON.parse(storage.getItem(key))?.studentRef===studentRef)storage.removeItem(key);}catch{/* Giữ dữ liệu không rõ chủ. */}
      }
    }catch{/* Reset trên máy chủ vẫn có hiệu lực khi trình duyệt chặn storage. */}
  }
}
export async function resetStudent(context,studentRef,request=fetch){
  if(!uuid.test(studentRef)||!Object.values(COURSES).some(c=>c.code===context.code&&c.api===context.api&&Object.values(c.tests).includes(context.slug)))throw new Error('Chỉ được reset học viên demo.');
  const response=await request(`${context.api}/api/term-tests/demo/reset`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),
    body:JSON.stringify({classCode:context.code,testSlug:context.slug,studentRef,confirmation:'RESET_DEMO_STUDENT'})});
  const data=await response.json();
  if(!response.ok||data.ok!==true||!Number.isInteger(data.reset?.attempts)||data.reset.attempts<0||!Number.isInteger(data.reset?.sessions)||data.reset.sessions<0)throw new Error(data.message||'Chưa được máy chủ xác nhận reset. Không tự gửi lại; hãy tải lại để kiểm tra.');
  return data.reset;
}
