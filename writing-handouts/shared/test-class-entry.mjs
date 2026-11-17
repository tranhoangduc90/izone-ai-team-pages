// Bài cũ giữ lớp mặc định; bài có roster riêng nhận lớp trong link sau kiểm cấu hình server.
// Lớp thử chưa mở hoặc lớp ngoài phạm vi thì dừng, không tự mở nhầm lớp khác.
export function lessonEntryClass(lesson, search = '') {
  const requested = new URLSearchParams(search).get('class');
  const courseWideLesson5=lesson.activity==='lesson5'&&lesson.classes?.length>1;
  if((lesson.rosterScope==='lesson'||courseWideLesson5)&&requested&&requested!=='CODEXID261018'){
    const matches=(lesson.classes||[]).filter(c=>c.toLowerCase()===requested.trim().toLowerCase());
    if(matches.length!==1)throw new Error('CLASS_NOT_OPEN');
    return matches[0];
  }
  if(courseWideLesson5&&!requested)return '';
  if (requested !== 'CODEXID261018') return lesson.defaultClass || '';
  if (!lesson.classes?.includes(requested)) throw new Error('TEST_CLASS_NOT_OPEN');
  return requested;
}
