// Link Hành trình riêng dùng đúng access token hiện hành; chỉ đọc bài của chính học viên.
// Lỗi một nguồn giữ lịch sử cũ để xem, không suy điểm trống hoặc ghi bài/điểm danh.
import {buildSkillCourse,renderPersonSkills} from './course-skills.js?rev=20261030-the20-v1';
import {legacyFeedbackForView} from './feedback-policy.js';
import {writingResultLink} from '../student-test-results.js?rev=20261030-the20-v1';
export async function mountStudentSkillJourney(host,journey,request,resultContext={}){
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
  const person={...journey.student,externalTests:journey.externalTests||[],cells:journey.sessions},overview={classId:journey.class.classId,sessions:journey.sessions,students:[person],coverage:journey.coverage};
  const forms=journey.sessions.map(session=>{const detail=records.get(session.sessionNumber),student={...person,submissionId:detail?.submissionId,sessionComment:session.sessionComment,teacherSessionFeedback:detail?.teacherSessionFeedback};
   return {sessionNumber:session.sessionNumber,definition:detail?.definition||{blocks:[]},dashboard:{students:[student]},live:{students:[{studentRef:person.studentRef,submissionId:detail?.submissionId,finalResponses:detail?.responses||{}}]}};});
  const course=buildSkillCourse(overview,forms),paint=()=>renderPersonSkills(host,course,person,{history:false,studentView:true,
    writingResultUrl:(result,task)=>writingResultLink(result,task,resultContext)});
  paint();return {refreshComments(comments){const byNumber=new Map(comments.map(note=>[note.sessionNumber,note]));
    for(const session of course.sessions){const note=byNumber.get(session.number);session.students[0].publishedFeedback=note?.visibility==='visible'?note.noteText:'';}paint();}};
 }catch(error){host.textContent='Chưa đọc đủ kết quả bốn kỹ năng: '+error.message+' Lịch sử bên dưới vẫn xem được.';}
}
