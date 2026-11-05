// Dữ liệu hoàn toàn giả cho trang công khai; cố ý có ít phiếu trong khóa 31 buổi.
// Câu không chấm và buổi chưa có phiếu giúp kiểm trạng thái trống đúng nghĩa.
const names=['Thủy · Minh họa','Đức · Minh họa','Việt Anh · Minh họa','Hiền · Minh họa'];
const roster=names.map((name,i)=>({studentRef:'demo-student-'+i,name,discriminator:'',current:true}));
const prompts=[
  'A passage has no information about the writer’s opinion. Which answer should you choose?',
  'Which sentence correctly uses “although” to contrast two ideas?',
  'Which statement best describes the main idea of the paragraph?'
];
const forms=[2,3,4,5].map((sessionNumber,fi)=>{
  const submittedCount=fi===2?3:4;
  const items=prompts.map((prompt,position)=>{
    const students=roster.slice(0,submittedCount).map((s,si)=>({...s,submissionId:'demo-'+fi+'-'+si,
      answered:true,verdict:(si+fi+position)%3===0?'incorrect':'correct',optionIds:[(si+fi+position)%3===0?'B':'A']}));
    const incorrect=students.filter(s=>s.verdict==='incorrect').length;
    return {itemVersionId:'demo-item-'+fi+'-'+position,position:position+1,prompt,interactionType:'single_choice',objective:true,
      counts:{roster:4,submitted:submittedCount,visible:submittedCount,hidden:0,unanswered:0,answered:submittedCount,
        graded:submittedCount,correct:submittedCount-incorrect,incorrect,pending:0,manual:0,ungraded:0},
      errorRate:incorrect/submittedCount,students,choices:[{optionId:'A',label:'Phương án A',count:submittedCount-incorrect,incorrect:0},
        {optionId:'B',label:'Phương án B',count:incorrect,incorrect}]};
  });
  items.push({itemVersionId:'demo-reflection-'+fi,position:4,prompt:'Hôm nay em còn vướng điều gì?',interactionType:'long_text',objective:false,
    counts:{roster:4,submitted:submittedCount,answered:submittedCount,ungraded:submittedCount,graded:0,incorrect:0},
    students:roster.slice(0,submittedCount).map(s=>({...s,submissionId:'demo-reflection-'+fi+'-'+s.studentRef,answered:true,verdict:'ungraded',optionIds:[]})),choices:[]});
  return {id:'demo-assignment-'+fi,sessionNumber,title:'Reading · Speaking',status:'published',
    blocks:[{blockId:'b1',title:'Ôn tập kiến thức',checkpoint:1},{blockId:'b2',title:'Luyện tập hôm nay',checkpoint:2}],
    releases:[{blockId:'b1',status:'open'},{blockId:'b2',status:'closed'}],
    analytics:{assignmentId:'demo-assignment-'+fi,rosterCount:4,submittedCount,items}};
});
const sessions=Array.from({length:31},(_,i)=>({sessionNumber:i+1,sessionKind:[16,31].includes(i+1)?'test':'lesson',
  sessionDate:new Date(Date.UTC(2026,8,14+i*3)).toISOString().slice(0,10),future:i>5,
  assignments:forms.filter(a=>a.sessionNumber===i+1).map(a=>({assignmentId:a.id,title:a.title}))}));
const students=roster.map((s,i)=>({...s,completeCount:i===3?3:4,cells:sessions.map(session=>({sessionNumber:session.sessionNumber,
  assignmentId:session.assignments[0]?.assignmentId||null,
  status:session.assignments.length?(session.sessionNumber===4&&i===3?'not_submitted':'complete'):
    session.sessionKind==='test'?'test_pending':'no_assignment',testResult:null,portalSync:null}))}));
export const demoCourse={classId:'demo',className:'IC2305 · Minh họa',assignments:forms,
  overview:{classId:'demo',className:'IC2305 · Minh họa',totalSessions:31,planRevision:1,sessions,students,
    counts:{currentStudents:4,students:4,assignments:4,complete:15},testCoverage:'not_mapped'}};
