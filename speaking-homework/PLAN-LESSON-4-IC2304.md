# Speaking Homework buổi 4 — IC2304

Nguồn hướng dẫn: Google Docs cũ `1ndj3S00OxlwJ39HxrQIgZVnGa5hI1hkz8Fy4hHzPUnk`. Mẫu nộp mới `1XUV5k6PjAAFjAwD8t_HdWRgVfjUF3WaUb2eZMh20Ivs` có CTA chữ trắng và ô tình trạng. Bài Classroom IC2304 `888120053939` đã tạo ở trạng thái nháp, chưa có bản sao học viên. Mã bài chuẩn theo mẫu là `67-speaking-diem_giua`.

Ngày 30/09, bốn ChatGPT Share thật của Đức đã được đọc và kiểm riêng từng phần: Chèn điểm giữa đạt ba giai đoạn, Freestyle đạt ba câu, hai bài bổ trợ tương ứng với “Thiếu / thừa giới từ” và “Dạng từ sau linking verb” trong kho đang hoạt động. Bài giới từ có dấu hiệu nhập chữ và cần học viên xác nhận đã luyện nói. Trên bản sao Docs nội bộ `1GHzDQNRPF8kctqgQxLBQqq_gjY8RGRSy3nT3zm3xkqY`, CTA đã gắn đúng Doc ID/lớp/mã bài mà vẫn giữ chữ trắng không gạch dưới; dòng xác nhận thử ghi đúng ô tình trạng và đọc lại được. Bản sao này không thuộc Classroom và biên nhận trong đó là giả, chỉ để kiểm đường ghi Docs.

## Trải nghiệm

Học viên mở CTA của bản Docs riêng, lớp được chọn sẵn và tên được nhớ theo Progress Log. Trang hiển thị hai bài chính: Chèn điểm giữa (đủ ba giai đoạn trong một hội thoại) và Freestyle (ba câu Speaking có góp ý rồi nói lại). Kế tiếp là danh sách Bác sĩ AI xếp theo Chờ luyện rồi Số lần đề xuất giảm dần, mặc định năm bài, có nút xem toàn bộ. Học viên chọn hai bài khác nhau, nộp hai ChatGPT Share khác nhau; chỉ khi cả bốn link đạt mới có biên nhận. IC2304 có 6/15 học viên chưa đủ hai bài cá nhân ở thời điểm kiểm 30/09; theo lựa chọn của Đức, ô chọn cho phép lấy bài còn thiếu từ Kho bài chung, có nhãn riêng và nút mở bài. Bài đó chỉ gia nhập lịch sử cá nhân sau khi đạt. Sau biên nhận, học viên có thể nộp thêm từng bài từ chính trang này, kể cả khi Homework đã đóng; mỗi lượt lưu riêng, không sửa biên nhận cũ.

## Thiết kế vận hành

Đường chính: Pages → API xác thực Doc/roster → database → hàng kiểm Share/AI → database → hàng Bác sĩ AI → danh sách mới → biên nhận → hàng ghi Docs. Phân tích là bất đồng bộ; UI hiện đang kiểm, tự đọc lại trong 10 giây và chỉ nói đã nhận khi DB trả accepted. Giả định 15 học viên IC2304, cao điểm 15 lượt mở cùng lúc và 60 link/giờ; giới hạn API Speaking là 360 yêu cầu/phút cho một IP, đo lại trước khi mở nhiều lớp. AI có giới hạn 45 giây/lượt, Share reader có timeout; lỗi giữ trạng thái pending/failed và retry theo lease, học viên không mất link. Mọi link được chuẩn hóa, khóa trùng trong cả khóa, ghi đúng student_ref/docID, các lần nộp thêm dùng ID và slot riêng. Log chỉ chứa mã lỗi; chủ hệ thống xem hàng việc quá hạn và retry. Không tự đăng Classroom hay sửa Doc mẫu cũ.

## Kiểm và đường lui

Kiểm URL `/s/t_…` tại browser và API; 3 giai đoạn, 3 câu, hai bài bổ trợ khác nhau, lưu/khôi phục, retry/idempotency, hai học viên đồng thời, cập nhật danh sách sau từng bài, luyện thêm sau biên nhận, docs/roster binding. Chạy full suite API/Pages, kiểm desktop/mobile và readback Pages/API/database. Migration cần backup và có đường đảo ngược không xóa bài đã nộp. Nếu chưa có bài Classroom/bản sao Docs, production chỉ ở trạng thái sẵn sàng chờ kích hoạt, không tuyên bố nghiệm thu hành trình thật.
