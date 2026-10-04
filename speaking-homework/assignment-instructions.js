// Nhận cấu hình API để hướng dẫn đúng số câu của bài đang mở.
export function freestyleInstructions(assignment) {
  const minimum = Number(assignment.parts?.find(part => part.part_key === 'freestyle')?.min_questions);
  if (!Number.isInteger(minimum) || minimum < 1) throw new Error('Thiếu số câu Freestyle của bài.');
  return {
    lead: `Luyện ít nhất ${minimum} câu Speaking, mỗi câu có góp ý và lượt trả lời lại.`,
    repeat: minimum === 1 ? 'Nói hoặc viết lại toàn bộ câu trả lời sau góp ý. Hoàn thành một câu là đủ.'
      : `Nói hoặc viết lại toàn bộ câu trả lời sau góp ý. Lặp lại để đủ ${minimum} câu.`
  };
}
