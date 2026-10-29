# Master #170 — tài nguyên giao diện dùng chung

Options/bank có nền riêng `--m170-option-bank-bg` = `#F6F9FC`, theo `.cbt-option-bank` của Term67 native, phân biệt với vùng làm bài trắng. Giữ bank ở phải, đệm16px/gap12px; chuẩn này áp dụng sáu consumer đã opt-in, không đổi K56. Khi kiểm phải đọc computed background của bank và vùng làm cạnh nhau, gồm khung hẹp.

Entry chỉ nhận master khi chủ động bật scope. `theme.css` giữ font/token/control/focus/logo; các adapter giữ bố cục và cách hiển thị trạng thái theo sản phẩm. Đọc [hướng dẫn bảo toàn và runner](../../docs/MASTER170_INTERFACE_MEMORY.md) trước thay tài nguyên chung hoặc tạo consumer mới.

Sản phẩm đã chuyển tiếp tục dùng Source Sans 3, nền Reading, nút navy và ngữ nghĩa trạng thái Linh. Không phục hồi font/màu cũ từ ví dụ trong skill. Không đổi rich text, run dẫn chứng, annotation, timer, audio, quyền, lưu/nộp hoặc dữ liệu để ép giao diện.

Test, Progress Log và mọi handout SW trong phạm vi loại trừ giữ chuẩn riêng; CSS chung thay đổi vẫn cần kiểm bảo toàn các consumer đó. Master không phải lệnh đổi mọi sản phẩm sang cùng một bố cục.
