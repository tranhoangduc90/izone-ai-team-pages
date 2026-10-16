# K67: hiển thị Writing trắng — 17/10/2026

Áp dụng cho Term Test 1/2, Listening trước và Reading trước. Backend xác nhận Task bắt buộc nộp trắng nhận 0 bằng `blank-writing-v1`; frontend giữ số 0 và hiển thị “Điểm theo quy tắc bài trắng”, “Không có nội dung bài làm”. Không mô tả bài này như được AI chấm theo bốn tiêu chí.

Trang học viên `term-tests/shared/app.js` và giảng viên `term-tests/teacher/app.js` cùng hiểu `gradingMethod=blank_rule`. Không đổi cách hiển thị bài có nội dung. Chỉ tăng revision nạp app dùng chung và app giảng viên; không thay file âm thanh, cache audio, phòng chờ, phục hồi, thời gian, phân quyền hoặc nội dung Listening vừa cập nhật.

Backend tương thích: `term-mini-k67-api`, app version `k67-blank-writing-zero-20261017`, image `sha256:488751a1015c4e84d9ff925875784e7b8846f23feff9f37db632a1f479e323aa`. Đọc README và `BLANK_WRITING_RELEASE_20261017.md` trong `izone-classroom-mapping-review/products/term-mini-k67` trước khi dựng/phát hành tiếp. Phiếu L/R được phân biệt bằng scope, không tạo bài Writing mới; bài chính thức mới nhất nhận 0 vẫn là bài được chọn. Các bài/điểm đã chấm trước đây giữ nguyên.

Sáu ca browser mới tại `tests/term-test-blank-writing-browser.mjs` đã đạt: bốn tổ hợp học viên, hai chi tiết giảng viên, Band 0 và nhãn quy tắc, không lỗi JavaScript. API và đăng nhập trong các ca này là dữ liệu giả. File mới nằm trong inventory Term Test 67. Đã kiểm toàn inventory trước phát hành; các nhóm timeout/fixture khi chạy song song được giữ log rồi kiểm lại thành công, gồm 47 ca sự cố audio, chủ tab, bộ nhớ học viên và client lưu Writing dùng chung K56.

Bằng chứng riêng: `E:/Codex-Data/k67-blank-writing-zero-20261017/`. Backend có canary HTTP production đủ bốn tổ hợp bằng học viên giả, không ghi Portal thật. UI browser mới không thay bằng chứng đăng nhập Google giảng viên thật.
