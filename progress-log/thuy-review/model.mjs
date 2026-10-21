// Chuyển bản chụp thành dữ liệu màn hình và tính tỷ lệ từ số câu học viên tự báo.
// Không lấy điểm quiz hay Test để lấp chỗ trống của bài luyện tập.
export const SKILLS = {listening:'Listening', reading:'Reading', speaking:'Speaking', writing:'Writing'};
export const itemsOf = definition => (definition?.blocks || []).flatMap(b => b.items || []);
export const validReport = v => Boolean(v && Number.isInteger(v.correct) && Number.isInteger(v.total) && v.total > 0 && v.correct >= 0 && v.correct <= v.total);
export const blank = v => v == null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
export function applicable(item, responses) {
  const c = item.interactionConfig || {}, value = responses[c.visibleWhenItemVersionId];
  return !c.visibleWhenItemVersionId || (Array.isArray(value) ? value.includes(c.visibleWhenValue) : value === c.visibleWhenValue);
}
export function practiceReport(definition, detail, skill) {
  if (!detail?.submissionId) return null;
  const values = itemsOf(definition).filter(i => i.interactionType === 'number_score' && i.skillCodes?.includes(skill) && applicable(i, detail.responses || {}))
    .map(i => detail.responses?.[i.itemVersionId]).filter(validReport);
  if (!values.length) return null;
  const correct = values.reduce((n,v) => n + v.correct, 0), total = values.reduce((n,v) => n + v.total, 0);
  return {correct, total, percent:correct / total * 100, exercises:values.length};
}
export function priority(reports) {
  const valid = reports.filter(r => Number.isFinite(r.percent) && r.percent >= 0 && r.percent <= 100)
    .sort((a,b) => b.sessionNumber - a.sessionNumber);
  const recent = valid.slice(0,3), average = valid.length ? valid.reduce((n,r) => n+r.percent,0)/valid.length : null;
  const recentAverage = recent.length === 3 ? recent.reduce((n,r) => n+r.percent,0)/3 : null;
  return {count:valid.length, average, recentAverage, flagged:recentAverage !== null && recentAverage < 60, recent};
}
export function quizScore(detail) {
  const values = (detail?.gradingItems || []).filter(g => g.maxScore > 0 && Number.isFinite(g.scoreEarned));
  return values.length ? {earned:values.reduce((n,g) => n+g.scoreEarned,0), max:values.reduce((n,g) => n+g.maxScore,0)} : null;
}
export function cleanDetail(detail, definition) {
  return {student:detail.student, status:detail.status, sessionNumber:detail.sessionNumber,
    submissionId:detail.submissionId || null, responses:detail.responses || {}, gradingItems:detail.gradingItems || [], definition};
}
export function publishedSourceFeedback(student){
  if(student.sessionComment)return student.sessionComment.visibility==='visible'?student.sessionComment.noteText||'':'';
  return student.teacherSessionFeedback?.noteText||'';
}
export function projectSnapshot(raw) {
  const sessions = raw.sessions.map(s => {
    const definition = s.dashboard.definition;
    return {number:s.number, date:s.date, title:s.dashboard.title, definition,
      closesAt:s.publicAssignment.submissionWindow?.effectiveClosesAt||null,
      answerKey:s.privateKey?.items||{},
      releases:s.publicAssignment.blockReleases.map(r => ({blockId:r.blockId,status:r.status})),
      students:s.dashboard.students.map(st => {
        const detail = s.details[st.studentRef] || {student:{studentRef:st.studentRef,name:st.name}};
        const live = s.live.students.find(v => v.studentRef === st.studentRef);
        return {studentRef:st.studentRef, name:st.name, discriminator:st.discriminator || '',
          submitted:Boolean(st.submissionId), completeness:st.completeness,
          checkpoints:st.checkpoints || [], started:Boolean(live?.draftUpdatedAt || st.submissionId || st.checkpoints?.length),
          draftUpdatedAt:live?.draftUpdatedAt, detail:cleanDetail(detail,definition),
          draftResponses:live?.draftResponses || {}, quiz:quizScore(detail),
          reports:Object.fromEntries(['listening','reading'].map(skill => [skill,practiceReport(definition,detail,skill)])),
          portal:{status:st.portalSync?.status || 'not_recorded', readbackAt:st.portalSync?.readbackAt || null, reviewRequired:Boolean(st.portalSync?.reviewRequired)},
          publishedFeedback:publishedSourceFeedback(st)};
      }),
      analytics:s.analytics.items.map(i => ({id:i.itemVersionId,prompt:i.prompt,objective:i.objective,counts:i.counts,errorRate:i.errorRate,choices:i.choices || [],students:i.students||[]})),
      generation:0, replacement:null, retired:[]};
  });
  const people = new Map();
  for (const s of sessions) for (const p of s.students) {
    if (!people.has(p.studentRef)) people.set(p.studentRef,{studentRef:p.studentRef,name:p.name,discriminator:p.discriminator});
  }
  return {capturedAt:raw.capturedAt,className:'IC2305',classId:raw.classId,sessions,
    people:[...people.values()].sort((a,b) => a.name.localeCompare(b.name,'vi')), testCoverage:raw.overview.testCoverage,
    courseSessions:raw.courseSessions||[], totalSessions:raw.plan?.totalSessions||null,
    testSources:raw.testSources||[],testResults:raw.testResults||[],
    coverage:{practice:raw.courseLoaded?'all_available_published_forms':'selected_sessions',missingSessions:raw.courseLoaded?[1,7]:[]}};
}
export function personJourney(data, studentRef, skill) {
  const reports = [...data.sessions,...(data.courseSessions||[]).filter(s=>!data.sessions.some(v=>v.number===s.number))].flatMap(s => {
    const p = s.students.find(p => p.studentRef === studentRef), r = p?.reports?.[skill];
    return r ? [{...r,sessionNumber:s.number,date:s.date}] : [];
  });
  return priority(reports);
}
// Bản đồ câu chữ đã biết: chỉ gom cùng vấn đề, không suy mức tự tin từ việc chưa thấy vấn đề.
const speakingCategories=[
  ['ideas','Khó mở rộng ý',['Khó mở rộng ý','Khó phát triển ý và nói đủ dài','Em thiếu ý hoặc chưa biết cách phát triển câu trả lời']],
  ['vocabulary','Thiếu từ vựng',['Thiếu từ vựng','Thiếu từ vựng để diễn đạt ý','Em thiếu từ vựng để diễn đạt điều mình muốn nói']],
  ['pronunciation','Cần luyện phát âm',['Cần luyện phát âm','Phát âm chưa rõ hoặc sai trọng âm']],
  ['fluency','Còn ngập ngừng',['Còn ngập ngừng','Nói ngắt quãng hoặc dừng quá lâu','Em ngập ngừng nhiều hoặc phải dừng lại để nghĩ']],
  ['grammar','Cần cải thiện ngữ pháp',['Cần cải thiện ngữ pháp','Dùng ngữ pháp chưa chính xác','Em còn mắc lỗi ngữ pháp khi nói']],
  ['coherence','Cần cải thiện mạch lạc',['Câu trả lời chưa liên kết, thiếu mạch lạc']],
  ['no-issue','Chưa nhận thấy vấn đề',['Em chưa nhận thấy vấn đề','Em chưa nhận thấy vấn đề lớn','Em chưa nhận thấy vấn đề lớn trong buổi luyện tập này']],
  ['confident','Diễn đạt tự tin hơn',['Diễn đạt tự tin hơn']],
  ['other','Vấn đề khác',['Vấn đề khác','Vấn đề khác. Nêu rõ']],
];
const normalizeSpeaking=label=>String(label||'').normalize('NFC').trim().replace(/\s+/g,' ').replace(/[.!?:;…]+$/g,'').toLocaleLowerCase('vi');
const speakingLabels=new Map(speakingCategories.flatMap(([id,label,variants])=>variants.map(v=>[normalizeSpeaking(v),{id,label}])));
export function speakingGroup(label){const key=normalizeSpeaking(label);return speakingLabels.get(key)||{id:'source:'+key,label:String(label).trim(),unmapped:true};}

// Mỗi học viên/buổi đóng góp tối đa một lần cho mỗi nhóm; chỉ lấy phiếu đã nộp cuối.
// Giữ cả câu chữ gốc để người xem đối chiếu cách gom; không sửa bản chụp hoặc tính điểm.
export function speakingAnalytics(sessions,studentRefs=null){
  const allowed=studentRefs?new Set(studentRefs):null,groups=new Map(),contributors=new Set(),seenSessions=new Set();let forms=0;
  for(const session of [...sessions].sort((a,b)=>b.number-a.number)){
    if(seenSessions.has(session.number))continue;seenSessions.add(session.number);
    const seenPeople=new Set();
    for(const person of session.students){
      if(!person.submitted||allowed&&!allowed.has(person.studentRef)||seenPeople.has(person.studentRef))continue;seenPeople.add(person.studentRef);
      const responses=person.detail?.responses||{},chosen=new Set();
      for(const item of itemsOf(session.definition).filter(i=>i.skillCodes?.includes('speaking')&&i.graderType==='none'&&i.options?.length&&applicable(i,responses))){
        const value=responses[item.itemVersionId],values=Array.isArray(value)?value:[value];
        for(const option of item.options.filter(o=>values.includes(o.id)&&normalizeSpeaking(o.label))){
          const group=speakingGroup(option.label);
          if(!groups.has(group.id))groups.set(group.id,{...group,count:0,originals:new Map()});
          const entry=groups.get(group.id);entry.originals.set(option.label,(entry.originals.get(option.label)||0)+1);
          if(!chosen.has(group.id)){entry.count++;chosen.add(group.id);}
        }
      }
      if(chosen.size){forms++;contributors.add(person.studentRef);}
    }
  }
  const sorted=[...groups.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'vi')).map(g=>({...g,originals:[...g.originals].map(([label,count])=>({label,count}))}));
  return {groups:sorted,contributors:contributors.size,forms,selections:sorted.reduce((sum,g)=>sum+g.count,0)};
}
// Tổng quan cá nhân dùng cùng nhóm với bảng lớp, không suy thành điểm Speaking.
// Nhận xét mới nhất chỉ lấy bản đã công bố, kể cả khi học viên chưa nộp phiếu buổi đó.
export function speakingSummary(sessions,studentRef,published=(session,person)=>person.publishedFeedback||'') {
  const seen=new Set();let latest=null;
  for(const session of [...sessions].sort((a,b)=>b.number-a.number)){
    if(seen.has(session.number))continue;seen.add(session.number);
    const person=session.students.find(p=>p.studentRef===studentRef);if(!person)continue;
    const text=published(session,person);
    if(!latest&&typeof text==='string'&&text.trim())latest={number:session.number,date:session.date,text};
  }
  return {frequencies:speakingAnalytics(sessions,[studentRef]).groups.map(({label,count})=>({label,count})),latest};
}
// Chỉ dùng để thử thao tác: kiểm dữ liệu trước khi lưu, chấm câu có khóa ở máy chủ.
export function validateResponses(definition, responses) {
  if (!responses || typeof responses !== 'object' || Array.isArray(responses)) throw new Error('Câu trả lời không hợp lệ.');
  const items = itemsOf(definition), ids = new Set(items.map(i => i.itemVersionId));
  if (Object.keys(responses).some(id => !ids.has(id))) throw new Error('Câu trả lời thuộc bài khác.');
  for (const i of items) {
    const v = responses[i.itemVersionId];
    if (!applicable(i,responses) || blank(v)) continue;
    if (i.interactionType === 'single_choice' && !i.options.some(o => o.id === v)) throw new Error('Lựa chọn không hợp lệ.');
    if (i.interactionType === 'multiple_choice' && (!Array.isArray(v)||v.some(id=>!i.options.some(o=>o.id===id)))) throw new Error('Lựa chọn không hợp lệ.');
    if (i.interactionType === 'number_score' && (!validReport(v) || v.total !== i.interactionConfig.max)) throw new Error('Số câu đúng phải từ 0 đến tổng số câu.');
    if (['short_text','long_text'].includes(i.interactionType) && (typeof v !== 'string' || v.length > 20000)) throw new Error('Nội dung trả lời không hợp lệ.');
  }
}
export function grade(definition, responses, keys) {
  return itemsOf(definition).filter(i => applicable(i,responses)).map(i => {
    const v = responses[i.itemVersionId], key = keys[i.itemVersionId], scored = i.maxScore > 0 && ['exact_option','exact_options','exact_text','exact_matching'].includes(key?.graderType);
    const normal=value=>String(value??'').trim().toLocaleLowerCase('vi').replace(/\s+/g,' ');
    const correct = scored && (key.graderType==='exact_option'?v===key.expectedOptionId:key.graderType==='exact_options'?Array.isArray(v)&&JSON.stringify([...v].sort())===JSON.stringify([...key.expectedOptions].sort()):key.graderType==='exact_text'?Boolean(normal(v))&&key.expectedText.split('\n').some(a=>normal(a)===normal(v)):key.pairs.every((_,n)=>String(v?.[n])===String(n)));
    return {itemVersionId:i.itemVersionId, verdict:scored ? (correct?'correct':'incorrect') : (blank(v)?'blank':'ungraded'),
      maxScore:scored?i.maxScore:0, scoreEarned:correct?i.maxScore:0};
  });
}
