// Lesson 8 nhận ba hội thoại chính; mỗi bài So sánh có đủ hai phần của chatbot nguồn.
// Hai bài bổ trợ, kiểm link, nháp và biên nhận tiếp tục dùng luồng Speaking chung.
export const lesson8Code = '67-speaking-so_sanh';
export const lesson8Parts = [
  { key: 'comparison_direct', title: 'So sánh trực tiếp',
    url: 'https://ducizone.short.gy/phat_trien_y_so_sanh_truc_tiep',
    lead: 'Luyện ít nhất 3 câu có hướng dẫn và 3 câu tự do trong cùng một hội thoại.',
    steps: [
      'Làm PHẦN 1: LUYỆN TẬP CÓ HƯỚNG DẪN với 3 câu: tìm điểm chung, chọn khía cạnh và tự xây dựng câu so sánh.',
      'Làm PHẦN 2: LUYỆN TẬP TỰ DO với 3 câu: trả lời hoàn chỉnh, giải thích khía cạnh đã chọn và xem góp ý.',
      'Chia sẻ toàn bộ hội thoại có cả hai phần, dán link vào ô bên cạnh rồi xác nhận.'
    ] },
  { key: 'comparison_extended', title: 'So sánh mở rộng',
    url: 'https://ducizone.short.gy/phat_trien_y_so_sanh_mo_rong',
    lead: 'Luyện ít nhất 3 câu có hướng dẫn và 3 câu tự do trong cùng một hội thoại.',
    steps: [
      'Làm PHẦN 1: LUYỆN TẬP CÓ HƯỚNG DẪN với 3 câu: chọn yếu tố liên quan và tự nói hoặc viết câu so sánh mở rộng.',
      'Làm PHẦN 2: LUYỆN TẬP TỰ DO với 3 câu: trả lời hoàn chỉnh có ý so sánh mở rộng, giải thích yếu tố đã chọn và xem góp ý.',
      'Chia sẻ toàn bộ hội thoại có cả hai phần. Dùng hội thoại riêng với bài So sánh trực tiếp.'
    ] },
  { key: 'freestyle', title: 'Full câu Speaking · Freestyle',
    url: 'https://ducizone.short.gy/freestyle',
    lead: 'Luyện ít nhất 1 câu Speaking, có góp ý và lượt trả lời lại.',
    steps: [
      'Yêu cầu ChatGPT hỏi một câu; nếu cần, nhờ gợi ý ý tưởng hoặc từ vựng.',
      'Trả lời câu hỏi rồi đọc góp ý, sửa lỗi và nâng cấp câu trả lời của ChatGPT.',
      'Nói hoặc viết lại trọn câu trả lời sau góp ý. Hoàn thành một câu là đủ.'
    ] }
];
