// Nhận thống kê hiện hành từ API; xếp câu sai và cộng đúng/sai cho từng học viên.
// Không chấm lại bài, không suy điểm từ câu tự luận, không biến buổi chưa có phiếu thành lỗi.
export function summarizeClass(course, sessionNumber = null) {
  const forms = course.assignments.filter(a => sessionNumber === null || Number(a.sessionNumber) === Number(sessionNumber));
  if (new Set(forms.map(a=>a.id)).size !== forms.length) throw new Error('Dữ liệu trùng phiếu.');
  const people = new Map(course.overview.students.map(s=>[s.studentRef,{...s,correct:0,incorrect:0,pending:0,manual:0,ungraded:0,submitted:0}]));
  const questions=[];
  for (const form of forms) {
    const submitted=new Set();
    for (const item of form.analytics.items) {
      const seen=new Set();
      for (const result of item.students) {
        if (seen.has(result.studentRef)) throw new Error('Một câu có học viên bị đếm hai lần.');
        seen.add(result.studentRef);
        if (!people.has(result.studentRef)) people.set(result.studentRef,{studentRef:result.studentRef,name:result.name,
          discriminator:result.discriminator,correct:0,incorrect:0,pending:0,manual:0,ungraded:0,submitted:0,cells:[]});
        const person=people.get(result.studentRef);
        submitted.add(result.studentRef);
        const category=!item.objective?'ungraded':result.verdict==='manual_review'?'manual':result.verdict;
        if (!['correct','incorrect','pending','manual','ungraded'].includes(category)) throw new Error('Trạng thái chấm chưa được hỗ trợ.');
        person[category]++;
      }
      if(item.objective) questions.push({...item,assignmentId:form.id,sessionNumber:form.sessionNumber,
        key:form.id+':'+item.itemVersionId});
    }
    // Overview giữ bài nộp kể cả khi toàn bộ câu điều kiện đều ẩn.
    for(const person of people.values()){
      if(person.cells?.some(cell=>cell.assignmentId===form.id&&['complete','incomplete'].includes(cell.status)))submitted.add(person.studentRef);
    }
    for(const id of submitted) people.get(id).submitted++;
  }
  questions.sort((a,b)=>b.counts.incorrect-a.counts.incorrect || (b.errorRate??-1)-(a.errorRate??-1)
    || a.sessionNumber-b.sessionNumber || a.position-b.position || a.key.localeCompare(b.key));
  const students=[...people.values()].map(s=>({...s,graded:s.correct+s.incorrect,
    errorRate:s.correct+s.incorrect?s.incorrect/(s.correct+s.incorrect):null}))
    .sort((a,b)=>b.incorrect-a.incorrect || a.name.localeCompare(b.name,'vi') || a.studentRef.localeCompare(b.studentRef));
  const totals=students.reduce((n,s)=>{
    for(const k of ['correct','incorrect','pending','manual','ungraded','submitted']) n[k]+=s[k];
    return n;
  },{correct:0,incorrect:0,pending:0,manual:0,ungraded:0,submitted:0});
  return {forms,questions,students,totals,graded:totals.correct+totals.incorrect};
}

export function sessionLabel(cell) {
  return ({complete:'Đã nộp đủ',incomplete:'Đã nộp · chưa đủ',not_submitted:'Chưa nộp phiếu',
    not_assigned:'Không thuộc danh sách phiếu',scheduled:'Phiếu sắp mở',no_assignment:'Chưa tạo Progress Log',
    test_pending:'Buổi Test · chưa có kết quả',test_result:'Có kết quả Test',needs_review:'Có nhiều phiếu · cần đối chiếu'})[cell.status] || 'Chưa xác định';
}

export const percent=value=>value===null?'—':Math.round(value*100)+'%';
