# Speaking Homework buổi 4 — IC2304

Nguồn: Google Docs cũ `1ndj3S00OxlwJ39HxrQIgZVnGa5hI1hkz8Fy4hHzPUnk`, đã đọc ngày 29/09/2026. Phạm vi: trang nộp và API/database; chưa gắn vào Classroom khi chưa có bài giao và bản sao Docs mới.

## Trải nghiệm

Học viên mở CTA của bản Docs riêng, lớp được chọn sẵn và tên được nhớ theo Progress Log. Trang hiển thị hai bài chính: Chèn điểm giữa (đủ ba giai đoạn trong một hội thoại) và Freestyle (ba câu Speaking có góp ý rồi nói lại). Kế tiếp là danh sách Bác sĩ AI xếp theo Chờ luyện rồi Số lần đề xuất giảm dần, mặc định năm bài, có nút xem toàn bộ. Học viên chọn hai bài khác nhau, nộp hai ChatGPT Share khác nhau; chỉ khi cả bốn link đạt mới có biên nhận. IC2304 có 6/15 học viên chưa đủ hai bài cá nhân ở thời điểm kiểm 30/09; theo lựa chọn của Đức, ô chọn cho phép lấy bài còn thiếu từ Kho bài chung, có nhãn riêng và nút mở bài. Bài đó chỉ gia nhập lịch sử cá nhân sau khi đạt. Sau biên nhận, học viên có thể nộp thêm từng bài từ chính trang này, kể cả khi Homework đã đóng; mỗi lượt lưu riêng, không sửa biên nhận cũ.

## Thiết kế vận hành

Đường chính: Pages → API xác thực Doc/roster → database → hàng kiểm Share/AI → database → hàng Bác sĩ AI → danh sách mới → biên nhận → hàng ghi Docs. Phân tích là bất đồng bộ; UI hiện đang kiểm, tự đọc lại trong 10 giây và chỉ nói đã nhận khi DB trả accepted. Giả định 15 học viên IC2304, cao điểm 15 lượt mở cùng lúc và 60 link/giờ; giới hạn API Speaking là 360 yêu cầu/phút cho một IP, đo lại trước khi mở nhiều lớp. AI có giới hạn 45 giây/lượt, Share reader có timeout; lỗi giữ trạng thái pending/failed và retry theo lease, học viên không mất link. Mọi link được chuẩn hóa, khóa trùng trong cả khóa, ghi đúng student_ref/docID, các lần nộp thêm dùng ID và slot riêng. Log chỉ chứa mã lỗi; chủ hệ thống xem hàng việc quá hạn và retry. Không tự đăng Classroom hay sửa Doc mẫu cũ.

## Kiểm và đường lui

Kiểm URL `/s/t_…` tại browser và API; 3 giai đoạn, 3 câu, hai bài bổ trợ khác nhau, lưu/khôi phục, retry/idempotency, hai học viên đồng thời, cập nhật danh sách sau từng bài, luyện thêm sau biên nhận, docs/roster binding. Chạy full suite API/Pages, kiểm desktop/mobile và readback Pages/API/database. Migration cần backup và có đường đảo ngược không xóa bài đã nộp. Nếu chưa có bài Classroom/bản sao Docs, production chỉ ở trạng thái sẵn sàng chờ kích hoạt, không tuyên bố nghiệm thu hành trình thật.
