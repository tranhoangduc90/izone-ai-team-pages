# Journey nằm trong Progress Log — kế hoạch theo lát cắt

## Mục tiêu và phạm vi

Học viên mở link Progress Log đang dùng, chọn và xác nhận tên, rồi xem hành trình ngay trong cùng trang. Cùng một học viên/lớp có một chuỗi buổi học liên tục; buổi Test hoặc buổi không có phiếu vẫn có vị trí riêng. Nộp Progress Log đủ điều kiện tạo yêu cầu điểm danh để đồng bộ sang Portal; trạng thái trong Progress Log không được gọi là kết quả Portal khi chưa đọc lại.

Phạm vi nghiệm thu: `large_phased`. Lát 1 bật giao diện xem dữ liệu Progress Log hiện có trong trang học viên và API đọc theo cặp link phiếu + học viên. Lát 2 tạo vị trí cho mọi buổi đến mốc có dữ liệu gần nhất, kể cả khoảng trống không có assignment, và cho link phiếu đã đóng mở Journey. Lát 3A kiểm nguồn thật và hiển thị rõ mức dữ liệu hiện có cùng trạng thái hàng đồng bộ Portal. Lát 3B1 cho giảng viên xác nhận tổng số buổi và các buổi Test trên dashboard lớp; Journey dùng bản xác nhận này để xếp cả buổi chưa có phiếu. Lát 3B2A cho giảng viên xác nhận ngày từng buổi; lát 3B2B1 cho giảng viên ghép dòng lịch ERP vào buổi; lát 3B2B2 ghép bài Test và đọc điểm hoàn tất, bổ sung Writing khi chấm xong. Lát 3B2B3 rà lịch đổi, ánh xạ Portal và nguồn thật. Lát 4 kiểm thử liên dịch vụ, phát hành và quan sát thật. Đức đã cho phép push và triển khai ngày 30/09; cổng kiểm chất lượng vẫn phải đạt trước khi chuyển production.

## Luồng người dùng

1. Mở link Progress Log của một buổi và chọn đúng tên.
2. Tại bước xác nhận, bấm “Xem hành trình”; cùng thao tác chọn tên đang dùng cho phiếu, không cấp link riêng.
3. Xem từng buổi, tiến bộ, nhận xét và tổng kết đã công bố; quay về phiếu mà không mất lựa chọn.
4. Sau khi nộp phiếu, có thể mở lại Journey ngay từ màn kết quả.

## Ràng buộc và điểm dừng

- Chỉ đọc Journey; không ghi điểm danh khi xem. Không ghi token hay dữ liệu học viên vào URL/log.
- Vì lựa chọn của Đức là giữ cách chọn tên, người có link phiếu và chọn tên khác có thể xem nội dung của tên đó. Đây là giới hạn quyền hiện tại; không mô tả là xác thực cá nhân.
- Khi lớp chưa có kế hoạch được xác nhận, chỉ hiện 1…N tới mốc có bằng chứng và ghi rõ ô suy ra. Khi giảng viên xác nhận, hiện 1…tổng số buổi của lớp và đánh dấu các buổi Test đã khai; Test không có phiếu vẫn là buổi Test, không bị coi là thiếu bài hay vắng. Không suy ngày học, kết quả Test hoặc điểm danh từ kế hoạch.
- Khi API hoặc frontend lỗi, phiếu vẫn mở/nộp bình thường; Journey báo chưa tải được.
- Không phát hành nếu regression nộp phiếu → sự kiện điểm danh → đồng bộ → đọc lại Portal hoặc phiên giảng viên chưa đạt.
- Rollback: trở về revision Pages/API trước thay đổi. Bảng kế hoạch là migration chỉ thêm dữ liệu; giữ bảng khi rollback code để không mất xác nhận của giảng viên.

## Thiết kế vận hành

Đường đi: GitHub Pages → API Progress Log → PostgreSQL learning; Portal chỉ tham gia ở luồng điểm danh hiện có. Journey dùng một request đọc khi học viên bấm; không polling. Dashboard đọc kế hoạch theo phiếu đang chọn và lưu kế hoạch theo lớp bằng revision để chặn ghi đè đồng thời; nếu xung đột, giữ nội dung giảng viên đang nhập để họ đối chiếu. Tải dự kiến bằng lượt mở của học viên một lớp, cần đo qua access log trước khi đặt ngưỡng chính thức. API có rate limit hiện có; frontend báo lỗi tải và giữ nguyên phiếu. Cần đo tải rồi chốt timeout trước phát hành. Query lọc theo class + student, không trả đáp án người khác. Theo dõi tỷ lệ lỗi endpoint, p95 latency và số buổi thiếu nguồn; test 0/ít/nhiều assignment, Test không phiếu, cross-class, token sai, Portal chưa đồng bộ. Chỉ gắn nhãn Portal “đã ghi nhận” khi có readback.

## Tình trạng các lát local

- Lát 1: học viên xem Journey trong cùng trang/link phiếu; link phiếu đã đóng chỉ mở phần Journey, không mở form. Nút tạo link cá nhân trên dashboard giảng viên được ẩn; route/link cũ vẫn giữ để không làm hỏng link đã gửi.
- Lát 2: timeline tạo 1…N, trong đó N là số buổi cao nhất có assignment, evidence hoặc báo cáo đã công bố. Buổi trống không bị ghi “chưa nộp”; evidence Test chỉ cho biết loại Test, không lộ nội dung chưa được công bố. Nguồn lịch lớp cho các buổi sau N và điểm Test chưa được nối.
- Lát 3A: API gắn nguồn của từng ô buổi và trạng thái job đồng bộ Portal; giao diện không gọi ô suy ra là buổi không có phiếu. Trạng thái job chỉ mô tả tiến trình đồng bộ, không thay bằng chứng điểm danh đọc lại từ Portal.
- Lát 3B1: dashboard giảng viên lưu tổng số buổi và số thứ tự các buổi Test chung cho lớp, có kiểm quyền, kiểm số buổi, chống ghi đè và đọc lại sau lưu. Journey hiển thị kế hoạch này ngay trong link phiếu đang dùng. Nếu dữ liệu mới vượt tổng buổi đã xác nhận, Journey vẫn hiện dữ liệu đó và báo giảng viên kiểm lại kế hoạch. Đã kiểm local trên PGlite và giao diện; migration/API chưa chạy production.
- Lát 3B2A local: dashboard cho giảng viên điền ngày đã đối chiếu theo từng số buổi, lưu cùng kế hoạch lớp bằng revision và đọc lại. Journey chỉ hiện ngày ở buổi đã xác nhận, kể cả Test không có phiếu. API cũ không gửi danh sách ngày vẫn giữ các ngày đã lưu. Đây là ngày do giảng viên xác nhận, chưa phải bản đồng bộ hay đối chiếu tự động từ ERP.
- Lát 3B2B1 local: backend đọc các dòng `class_sessions` đúng lớp qua tài khoản Metabase chỉ ở máy chủ; giảng viên bấm đọc lịch rồi ghép ID dòng với số buổi. API kiểm lại ID và ngày khi tạo hoặc đổi ghép, lưu cùng revision kế hoạch và đọc lại. Không tự gán số buổi theo thứ tự dòng; khi nguồn lỗi vẫn cho nhập ngày thủ công. Thời gian chờ đọc nguồn tối đa 7 giây theo cấu hình, phản hồi lỗi chung không lộ thông tin đăng nhập. Cần xác minh kết nối từ môi trường chạy backend, quyền tài khoản và giới hạn truy vấn trước phát hành.
- Lát 3B2B2 local: giảng viên đọc danh sách bài Test có thể ghép rồi xác nhận mã bài cho buổi Test. Danh sách cho biết bài đã có kết quả của lớp, mới có danh sách lớp, hoặc chỉ có định nghĩa bài thi; nhờ vậy có thể ghép trước khi học viên đầu tiên hoàn tất bài. Mỗi lần học viên mở Journey, API đọc kết quả hoàn tất mới nhất của đúng học viên/lớp/bài Test từ kho bài thi; Listening/Reading hiện khi hoàn tất, Writing chỉ hiện điểm khi bản chấm cuối ở trạng thái sẵn sàng và có thể đến muộn hơn. Không trả bài làm, đáp án hoặc điểm của học viên khác. Nếu kho bài thi lỗi, Journey vẫn mở và báo nguồn Test tạm thời chưa đọc được; nếu chưa ghép bài hoặc chưa có kết quả thì giữ trạng thái chưa có điểm. Cần đo độ trễ hai database, kiểm dữ liệu thật và cách sửa ghép bài trước phát hành.
- Lát 3B2B3 local: dashboard đọc lại lịch ERP khi mở kế hoạch đã ghép dòng, báo dòng thiếu/ngày đổi và chặn lưu ánh xạ đã biết là lệch; người dạy có thể chọn lại dòng hoặc bỏ ghép để nhập ngày thủ công. Đã đọc workflow Portal trong source: khi Portal không trả số buổi, workflow chọn dòng `class_sessions` theo ngày. Vì số dòng có thể khác tổng buổi, không coi workflow này là bằng chứng đã điểm danh đúng buổi. Cần đối chiếu ánh xạ và kết quả Portal trên một lớp thật trước phát hành. Không lấy điểm từ adapter chưa chạy hoặc từ ngày `class_tests.started_at`.
- Ứng viên tích hợp đã gộp bản xem thử giảng viên mới nhất vào backend Journey. Bản thử học viên cũng mở Journey trong cùng phiếu và chỉ dùng kho demo. Kiểm local trên bản ứng viên: backend 256/256, Pages 29/29, kiểm cú pháp và build demo đạt; trình duyệt thật mở Journey trên desktop/mobile, console 0 lỗi. Chưa triển khai hoặc xác nhận nguồn ERP/Test từ container production.
- Lát 4 còn mở: migration, thử kết nối/quyền/độ trễ từ môi trường backend thật, chọn lớp thật có ánh xạ học viên và Test rõ ràng, đối chiếu từng buổi với Portal, kiểm phiên giảng viên và quan sát sau phát hành. Chỉ thực hiện khi có lớp/nguồn thật phù hợp và quyền phát hành riêng.

## Đầu vào và điều kiện đóng cổng lớp thật

- Một lớp 56/67 có ít nhất một link Progress Log thật, danh sách học viên đã ghép đúng lớp và giảng viên có quyền dashboard. Không yêu cầu đủ 30/31 assignment: kế hoạch lớp phải giữ được buổi chưa có phiếu và buổi Test không có Progress Log.
- Giảng viên đối chiếu tổng buổi, ngày, ID dòng ERP và mã bài Test trên dashboard. Cần một bài Test hoàn tất để kiểm Listening/Reading; khi Writing còn chấm, Journey phải ghi đang chờ và tự hiện điểm sau bản chấm cuối. Nếu chưa có chuỗi trạng thái này ở lớp thật, chỉ kết luận phần tương ứng đã qua fixture local.
- Đối chiếu ít nhất một bài nộp đủ điều kiện theo chuỗi `submission → attendance event → outbox job → đúng class_session_id trên Portal → outcome đọc lại`. Nếu thứ tự dòng ERP của workflow Portal khác ánh xạ giảng viên xác nhận, dừng cổng phát hành và xử lý luồng Portal riêng; không dùng trạng thái `complete` của outbox thay cho kết quả Portal.
- Trước và sau dựng API phải so cấu hình điểm danh, worker và hàng chờ; kiểm phiên giảng viên 90 ngày, health, lỗi/độ trễ Journey và khả năng quay về image/Pages trước đó. Khi chưa có lớp thật được giảng viên đối chiếu hoặc các phép kiểm image cuối chưa đạt, trạng thái là `not_ready`, không gọi bản production đã kiểm chứng.

## Kiểm tra phát hành ngày 30/09

- Hai branch Pages/API đã push, PR nháp đã mở, chưa merge `main` hoặc đổi production. Image API live đã đổi sang `speaking-lesson4:20260930-v1`; gói overlay khóa hash được cập nhật theo đúng image này. Backend branch đã ghép `main` Speaking buổi 4, PR có thể merge sạch và đạt 263/263 test.
- Image ứng viên Journey đã build trên VPS nhưng chưa chạy dịch vụ. Full suite trên source trích chính xác từ image live cộng tám module Journey đạt 260/263. Ba ca không đạt thuộc baseline Term Test: giới hạn job chấm Writing thực tế 6 thay vì test đòi 4; fixture branch thiếu `class_started_at` mà query live dùng; endpoint dashboard live thiếu `accessMode`/`isAssignedTeacher` mà test branch đòi. Ca giới hạn job cũng không đạt khi chạy riêng. Không sửa Term Test ngầm trong gói Journey.
- Chạy nguồn đọc mới trong image ứng viên trên dữ liệu thật: lịch ERP một lớp 29 dòng trong khoảng 0,8 giây; danh sách ba bài Test có thể ghép; một kết quả đúng học viên/lớp/bài. Ba biến Metabase vẫn chưa được cấu hình cho API live. Hàng chờ điểm danh có 102 job complete; một job gần nhất đọc lại được có mặt trong Portal/ERP, nhưng chưa có event mới sau phát hành Journey.
- Migration chưa áp, chưa xác nhận ánh xạ của một lớp thật trên dashboard và chưa thử rollback. Vì vậy cổng phát hành đang `not_ready` dù quyền triển khai đã được cấp.
