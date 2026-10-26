import { lesson11Parts } from './lesson-11-parts.js';

export const lesson12Code = '67-speaking-ke_chuyen_ket_cuc_y_nghia';
export const lesson12Parts = [
  { key: 'story_outcome', title: 'Kể chuyện: Kết cục và ý nghĩa',
    url: 'https://ducizone.short.gy/ke_chuyen_ket_cuc',
    lead: 'Hoàn thành ít nhất một lượt luyện đầy đủ với chatbot.',
    steps: [
      'Tìm hiểu Cầu Nối Bài Học: Kết quả thực tế → Cầu nối suy ngẫm → Bài học; chọn hướng Sự nhận ra, Kỹ năng hoặc Giá trị.',
      'Luyện ba tình huống có hướng dẫn và ba tình huống bán tự do: tự tìm cầu nối, ghép đoạn kết và đọc góp ý. Có thể nói hoặc gõ.',
      'Làm bài Part 2 tự do: kể tóm tắt câu chuyện, nêu kết quả thực tế và tự tạo đoạn kết có cầu nối bài học. Đọc nhận xét và tổng kết rồi chia sẻ cả hội thoại; thử thêm đề là tùy chọn. Dùng hội thoại riêng với phần Trước – Trong – Sau.'
    ] },
  { ...lesson11Parts.find(part => part.key === 'story_sequence'), steps: [
    ...lesson11Parts.find(part => part.key === 'story_sequence').steps.slice(0, 2),
    'Làm đủ bốn phần trong cùng hội thoại, rồi chia sẻ cả đoạn chat. Dùng hội thoại riêng với bài Kết cục và ý nghĩa.'
  ] }
];
