// Trường hợp nguồn cũ đã được Đức chốt M03: giữ bản gốc, ẩn khỏi UI học viên, GV thấy nhãn xác minh.
export function legacyFeedbackForView(detail,{teacher=false}={}){
 const unverified=String(detail.classId)==='1294'&&detail.sessionNumber===4
  &&detail.student?.studentRef==='e988230c-995b-4b23-87b7-fb9ae7f663ac'
  &&detail.teacherSessionFeedback?.noteText==='gjjyuyuy';
 if(!unverified)return detail;
 return {...detail,teacherSessionFeedback:teacher?{...detail.teacherSessionFeedback,noteText:'Cần xác minh · Nhận xét nguồn cũ: '+detail.teacherSessionFeedback.noteText}:null};
}
