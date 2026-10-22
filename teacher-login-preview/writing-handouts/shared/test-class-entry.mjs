// Chỉ link có đúng mã lớp thử mới chọn lớp thử; máy chủ vẫn kiểm roster và quyền mở bài.
// Link học viên hiện hành giữ lớp mặc định. Lớp thử chưa mở thì dừng, không mở nhầm lớp thật.
export function lessonEntryClass(lesson, search = '') {
  const requested = new URLSearchParams(search).get('class');
  if (requested !== 'CODEXID261018') return lesson.defaultClass || '';
  if (!lesson.classes?.includes(requested)) throw new Error('TEST_CLASS_NOT_OPEN');
  return requested;
}
