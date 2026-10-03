// Minh họa công khai, toàn bộ tên/bài đều giả. Tám nhóm câu và hai buổi đã gán trong tương lai.
import {demoCourse as original} from '../reference-preview/fixture.js';
import {vietnamDate} from './session-ui.js';
export const demoCourse=structuredClone(original);
const titles={2:'Listening 2 + Reading 2',3:'Reading 3 + Writing 1',4:'Listening 3 + Speaking 1',5:'Reading 4 + Writing 2',7:'Reading 5 + Speaking 3',8:'Listening 5 + Writing 3'};
for(const a of demoCourse.assignments)a.title=titles[a.sessionNumber];
for(const number of [7,8])demoCourse.assignments.push({id:'demo-future-'+number,sessionNumber:number,title:titles[number],status:'published',blocks:[],releases:[],analytics:{assignmentId:'demo-future-'+number,items:[],submittedCount:0}});
const today=vietnamDate();
for(const slot of demoCourse.overview.sessions){
  slot.assignments=demoCourse.assignments.filter(a=>a.sessionNumber===slot.sessionNumber).map(a=>({assignmentId:a.id,title:a.title}));
  if(slot.sessionNumber===7)slot.sessionDate=today;
  if(slot.sessionNumber===8)slot.sessionDate=new Date(Date.parse(today+'T00:00:00Z')+86400_000).toISOString().slice(0,10);
}
for(const person of demoCourse.overview.students)for(const cell of person.cells)if([7,8].includes(cell.sessionNumber)){cell.assignmentId='demo-future-'+cell.sessionNumber;cell.status='not_submitted';}
export function demoDetail(ref,number){
  const student=demoCourse.overview.students.find(p=>p.studentRef===ref),form=demoCourse.assignments.find(a=>a.sessionNumber===number),cell=student.cells.find(c=>c.sessionNumber===number);
  const scored=form?.analytics.items.filter(i=>i.objective)||[];
  const items=scored.map(i=>({itemVersionId:i.itemVersionId,position:i.position,prompt:i.prompt,interactionType:'single_choice',required:true,options:i.choices.map(c=>({id:c.optionId,label:c.label}))}));
  items.push(
    {itemVersionId:'demo-dropdown',position:4,prompt:'Chọn tiêu đề phù hợp nhất cho đoạn văn.',interactionType:'single_choice',layoutType:'matching_heading_dropdown',options:[{id:'a',label:'The benefits of reading'},{id:'b',label:'A change in learning habits'}]},
    {itemVersionId:'demo-gaps',position:5,prompt:'Hoàn thành câu về cách tìm bằng chứng.',interactionType:'short_text',interactionConfig:{responseCount:2,sentenceLines:[{title:'Reading:',parts:['Em cần tìm ',' trước khi quyết định ','.']}]}},
    {itemVersionId:'demo-short',position:6,prompt:'Ghi hai điều em cần kiểm trước khi viết.',interactionType:'short_text',layoutType:'numbered_short_texts',interactionConfig:{responseCount:2,responseLabels:['Ý chính','Bằng chứng']}},
    {itemVersionId:'demo-speaking',position:7,prompt:'Em gặp khó khăn nào khi nói?',interactionType:'multi_choice',layoutType:'speaking_issue_checklist',options:[{id:'vocab',label:'Chọn từ đúng ý'},{id:'other',label:'Khác'}]},
    {itemVersionId:'demo-other',position:8,prompt:'Mô tả thêm khó khăn khác của em.',interactionType:'long_text',interactionConfig:{visibleWhenItemVersionId:'demo-speaking',visibleWhenValue:'other',requiredWhenVisible:true}}
  );
  // Buổi03 có8 câu để test regression; buổi khác bổ sung tự luận và tự khai, tổng10 câu.
  if(number!==3)items.push({itemVersionId:'demo-reflection',position:9,prompt:'Điều em nhớ nhất hôm nay là gì?',interactionType:'long_text'},{itemVersionId:'demo-self',position:10,prompt:'Em tự khai số câu đúng trong bài luyện.',interactionType:'number_score'});
  const submitted=['complete','incomplete'].includes(cell.status);
  const responses=submitted?Object.fromEntries(scored.map(i=>[i.itemVersionId,i.students.find(s=>s.studentRef===ref)?.optionIds?.[0]])):{};
  if(submitted)Object.assign(responses,{'demo-dropdown':'b','demo-gaps':['bằng chứng cụ thể','đáp án'],'demo-short':['Câu chủ đề phải nêu ý chính.','Chi tiết cần hỗ trợ đúng ý.'],'demo-speaking':['other'],'demo-other':'Em chưa nối các ý rõ ràng khi nói.\nEm muốn luyện cách mở rộng câu trả lời.','demo-reflection':'Bằng chứng quan trọng hơn việc nhìn thấy cùng từ khóa.\nEm cần đọc lại cả câu chứa bằng chứng.','demo-self':{correct:6,total:10}});
  const gradingItems=submitted?scored.map(i=>({itemVersionId:i.itemVersionId,verdict:i.students.find(s=>s.studentRef===ref)?.verdict||'pending',scoreEarned:i.students.find(s=>s.studentRef===ref)?.verdict==='correct'?1:0,maxScore:1})):[];
  return {classId:'demo',student,sessionNumber:number,status:cell.status,submissionId:submitted?'demo-submission':null,definition:form?{title:form.title,blocks:[{blockId:'demo-part1',checkpoint:1,title:'Ôn tập kiến thức',items:items.slice(0,3)},{blockId:'demo-part2',checkpoint:2,title:'Luyện tập và nhìn lại buổi học',instructions:'Dưới đây là nội dung và câu trả lời đã ghi trong buổi học.',items:items.slice(3)}]}:null,responses,gradingItems};
}
