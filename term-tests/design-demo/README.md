# Demo màu Term / Mini Test 67

Bản công khai để xem và thử phối màu trên các màn Term Test 1, Term Test 2 và Mini Test buổi 5. Mở `index.html`; chọn một màn hoặc một bộ màu. Xanh sương là mặc định, tiếp theo là Sage dịu, Kem cát và Tím xám; các preset lịch sử nằm phía sau.

## Dữ liệu và tương tác

- Nội dung đọc/nghe, biểu đồ, bài viết, điểm và nhận xét được tự soạn để minh họa. Không chứa đề riêng, đáp án thật hay snapshot học viên.
- `demo-runtime.js` mô phỏng API ngay trong trình duyệt. Nút lưu/nộp chỉ đổi dữ liệu trong RAM của tab; tải lại khởi tạo tình huống mẫu. Không dùng demo để làm bài thi thật.
- Bộ màu lưu trong localStorage riêng của demo. Tham số `labOption` giữ bốn phương án độc lập khi so sánh. Màu tồn tại sau tải lại; bài làm thử không có cam kết lưu lâu dài.
- CSP giới hạn kết nối cùng nguồn; runtime chặn API ngoài mock. Audio là âm thử tự tạo, không phải bài nghe IELTS.

## Source và cách phát hành

Demo tái dùng renderer `../shared/` và `../term-test-2-computer-based/`, không sao chép hoặc sửa logic thi. `skin.css`, `presentation.js`, `preview.css`, `header.css` và `color-lab.*` chỉ được nạp bởi các entry trong thư mục này. Các URL bài thi đang dùng không nạp lớp demo.

Mỗi trang dùng đường dẫn tương đối để chạy dưới prefix GitHub Pages. Đường công khai: `/izone-ai-team-pages/term-tests/design-demo/`.

Kiểm trước phát hành: các entry trên máy tĩnh với prefix Pages; desktop/mobile; đổi và nhớ màu, thứ tự preset; mở nhận xét và mở rộng nhận xét; phiếu Mini hai cột; phòng chờ; Console/network và không gọi API thật. Quay lui bằng revert commit thêm thư mục demo; không khôi phục backend hoặc database.
