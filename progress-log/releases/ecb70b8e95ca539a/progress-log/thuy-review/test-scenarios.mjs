// Điểm và nhận xét giả chỉ để duyệt giao diện; cùng mã người luôn cho cùng bộ số.
// Không sửa gói dữ liệu, không tạo bài thi hoặc ghi kết quả vào hệ thống thật.
export function testScenario(ref,slug){
  const titles={'mini-test-lesson-5':'Mini Test','term-test-1':'Term Test 1','term-test-2':'Term Test 2'};
  if(!titles[slug])return null;
  const seed=[...String(ref)+slug].reduce((sum,c)=>sum+c.charCodeAt(0),0),total=slug==='mini-test-lesson-5'?20:40;
  const correct=offset=>Math.min(total,Math.floor(total*.4)+(seed+offset)%Math.ceil(total*.6+1));
  return {synthetic:true,testSlug:slug,title:titles[slug]+' · Dữ liệu giả',
    listening:{correct:correct(0),total},reading:{correct:correct(7),total},
    writing:{score:4.5+(seed%7)*.5,tasks:{
      1:{feedback:'[Dữ liệu giả để xem giao diện] Bài có phần tổng quan và đã chọn được các đặc điểm chính. Cần nhóm số liệu rõ hơn, so sánh trực tiếp giữa các đối tượng và kiểm tra đơn vị. Đoạn nhận xét dài này giúp thử cách rút gọn hai dòng và nút Đọc đủ; không phải đánh giá bài làm của học viên.'},
      2:{feedback:'[Dữ liệu giả để xem giao diện] Quan điểm đã xuất hiện trong mở bài và các ý chính có liên quan đến đề. Cần giải thích rõ quan hệ nguyên nhân–kết quả, bổ sung ví dụ phù hợp và kiểm tra liên kết giữa các đoạn. Đây chỉ là nội dung minh họa bố cục, không do giảng viên chấm.'}
    }}};
}
