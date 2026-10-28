// Link Hành trình riêng dùng đúng access token hiện hành; chỉ đọc bài của chính học viên.
// Lỗi một nguồn giữ lịch sử cũ để xem, không suy điểm trống hoặc ghi bài/điểm danh.
import {buildSkillCourse,renderPersonSkills} from './course-skills.js?rev=20261028-thuy-v1';
import {legacyFeedbackForView} from './feedback-policy.js';
export async function mountStudentSkillJourney(host,journey,request){
 host.textContent='Đang đọc kết quả bốn kỹ năng…';
 try{
  const records=new Map(),sessions=journey.sessions.filter(s=>['complete','incomplete'].includes(s.completeness));
  for(let offset=0;offset<sessions.length;offset+=3){
   const details=await Promise.all(sessions.slice(offset,offset+3).map(async session=>{
    const {detail}=await request(session.sessionNumber);
    if(detail.student?.studentRef!==journey.student.studentRef||String(detail.classId)!==String(journey.class.classId)||detail.sessionNumber!==session.sessionNumber)throw Error('Chi tiết chưa khớp người/lớp/buổi.');
    return legacyFeedbackForView(detail);
   }));for(const detail of details)records.set(detail.sessionNumber,detail);
  }
  const person={...journey.student,externalTests:journey.externalTests||[],cells:journey.sessions},overview={classId:journey.class.classId,sessions:journey.sessions,students:[person]};
  const forms=journey.sessions.map(session=>{const detail=records.get(session.sessionNumber),student={...person,submissionId:detail?.submissionId,sessionComment:session.sessionComment,teacherSessionFeedback:detail?.teacherSessionFeedback};
   return {sessionNumber:session.sessionNumber,definition:detail?.definition||{blocks:[]},dashboard:{students:[student]},live:{students:[{studentRef:person.studentRef,submissionId:detail?.submissionId,finalResponses:detail?.responses||{}}]}};});
  renderPersonSkills(host,buildSkillCourse(overview,forms),person,{history:false});
 }catch(error){host.textContent='Chưa đọc đủ kết quả bốn kỹ năng: '+error.message+' Lịch sử bên dưới vẫn xem được.';}
}
