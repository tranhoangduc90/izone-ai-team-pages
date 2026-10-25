import { lesson10Parts } from './lesson-10-parts.js';

export const lesson11Code = '67-speaking-ke_chuyen_dien_bien_chi_tiet';
export const lesson11Parts = [
  { key: 'story_detail', title: 'Kể chuyện: Diễn biến chi tiết',
    url: 'https://ducizone.short.gy/ke_chuyen_dien_bien_chinh',
    lead: 'Hoàn thành ít nhất một lượt luyện đầy đủ cho một chủ đề với chatbot.',
    steps: [
      'Luyện bốn bước cơ bản: bẻ nhỏ hành động, thêm chi tiết giác quan, Hành động → Cảm xúc và Cảm xúc → Hành động.',
      'Ghép ba nhịp đầu, phát triển nhịp bốn và năm, rồi tự kể lại đoạn diễn biến đủ năm nhịp. Đọc góp ý sau từng bước; có thể nói hoặc gõ.',
      'Sau một câu chuyện hoàn chỉnh, bạn có thể chọn tổng kết và chia sẻ toàn bộ hội thoại. Luyện đề mới hoặc thử thách 90 giây cuối bài là tùy chọn. Dùng hội thoại riêng với phần Trước – Trong – Sau.'
    ] },
  { ...lesson10Parts.find(part => part.key === 'story_sequence'), steps: [
    ...lesson10Parts.find(part => part.key === 'story_sequence').steps.slice(0, 2),
    'Làm đủ bốn phần trong cùng hội thoại, rồi chia sẻ cả đoạn chat. Dùng hội thoại riêng với bài Diễn biến chi tiết.'
  ] }
];
