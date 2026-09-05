# Rà soát đầy đủ ghi nhớ và đổi người học

Phạm vi hai lớp CS trong tài liệu này là đợt thí điểm. Đợt mở rộng toàn bộ lớp và sản phẩm được mô tả tại [ghi nhớ toàn bộ sản phẩm](student-memory-all-products.md); các quy tắc an toàn và kiểm thử dưới đây vẫn được giữ.

## Đặc tả khóa trước khi sửa — 05/09/2026

Nguồn: repo Pages commit `d555d37`, hai giao diện Writing và module ghi nhớ đã phát hành. Mục tiêu mới: tick sẵn ô ghi nhớ, đồng bộ lựa chọn giữa các app thuộc phạm vi xác minh, kiểm hồ sơ tạm và cho xem trạng thái đổi người. Không coi cùng trình duyệt là đủ: cần cùng nguồn website, cùng khóa lưu và cùng namespace mã học viên đã được xác minh.

- Mặc định ô ghi nhớ có tick; thay lớp/tên không tự bỏ tick và không tự bật lại nếu người dùng đã bỏ.
- Tự chọn chỉ là điền form. Không tự mở phiên, bắt đầu tính giờ, bỏ xác thực mã hồ sơ tạm, ghép tên giống nhau hoặc lấy bài người trước.
- Với hồ sơ tạm: chưa ghi nhớ sang app khác vì backend cấp UUID riêng cho từng bài/lớp. Mã truy cập vẫn phải nhập; không tự tạo hồ sơ hoặc mượn người cùng tên. Sau đối soát, chỉ UUID chính thức đang có trong roster mới được ghi nhớ.
- Đăng ký hồ sơ tạm/mở phiên phải khóa form trong lúc chờ; nút đổi người phải xóa các ô tên/mã đang nhập dở, tránh để dữ liệu người trước trên màn hình.
- Form chưa mở bài có thể cập nhật theo bộ nhớ của tab khác. Bài đã mở luôn giữ danh tính gốc; báo rõ thay đổi ghi nhớ bên ngoài thay vì âm thầm chuyển đích lưu.
- Đổi người đang viết: chặn tương tác trong lúc lưu, lưu xong rồi mới trở lại form; lỗi, xung đột hoặc lượt chấm đang gửi thì giữ bài. Không xóa IndexedDB/bài server của người trước.
- Giữ đề, chấm điểm, prerequisite, bố cục và font/màu gốc. N/A cho công thức/đáp án mới vì không sửa bài thi hoặc bộ chấm. Rollback: hoàn tác commit frontend và đọc lại URL; không xóa dữ liệu học viên.

## Ma trận cần kiểm

Lần đầu, default checked, bỏ tick, reload, xuyên đề/app, nhiều lớp, link khác/sai lớp, roster đảo thứ tự/cùng tên/ID mất, hồ sơ tạm mới/có sẵn/trùng tên/PIN sai hoặc thiếu, lỗi đăng ký, đổi lớp giữa request, nhấp đôi, đổi người ở form và đang viết, lưu lỗi/409, hai tab, bộ nhớ hỏng/đọc/ghi/xóa bị chặn, mobile/desktop, cache sau phát hành. Mỗi nhóm phải có kết quả thực tế; không tuyên bố mọi khả năng của hệ thống đã được chứng minh chỉ bằng danh sách này.

Ảnh minh họa chỉ dùng fixture giả và chụp từ giao diện thực tế. Dữ liệu thật chỉ đọc tối thiểu để kiểm hợp đồng/phạm vi, không đưa tên/mã học viên thật vào ảnh, test hay báo cáo.

## Phạm vi thực hiện

- Hai lớp CS đã được mở tính năng: Writing Task 1/Task 2, ba answer sheet Term/Mini và ba trang thi trên máy dùng cùng bootstrap.
- Cùng nguồn website và cùng trình duyệt mới chia sẻ được bộ nhớ. Bản K56/demo dùng hệ thống khác không được ghép UUID; trang giảng viên và trang chấm Google Docs không có bước chọn học viên nên không áp dụng.
- Chỉ nhớ `{version, studentRef}`. Tên hiển thị luôn lấy từ roster mới của đúng bài/lớp. Không chứa mã hồ sơ tạm, token phiên, tên hoặc nội dung bài viết trong khóa ghi nhớ mới.
- Việc bỏ tick tắt chọn sẵn xuyên app. Nó không xóa bài hoặc lượt thi đang làm đã được app lưu từ trước.
- Hồ sơ không thuộc roster bài đích phải chọn lại; không tự thêm người vào lớp, không ghép bằng tên giống nhau.

## Các ca đã kiểm bằng dữ liệu giả

| Nhóm | Kết quả mong đợi đã kiểm |
|---|---|
| Lần đầu/bỏ tick | Tick mặc định; chọn lớp/tên không tự bật lại lựa chọn đã bỏ |
| Xuyên bài Writing | Task 1 ↔ Task 2 nhận đúng UUID và mã lớp mới; đủ 10 manifest; không tự mở phiên |
| Xuyên hệ thống | Writing/Term chính thức dùng cùng khóa; backend/demo khác giữ kho riêng |
| Roster | Đảo thứ tự, cùng tên, UUID mất, nhiều lớp, query đúng/sai/khác đều không ghép nhầm |
| Hồ sơ tạm Writing | Tên/PIN sai, hồ sơ đã có, trùng tên chính thức, xác nhận khác người, mã sai/khóa, lỗi API |
| Đăng ký | Khóa form khi gửi; không đổi lớp giữa request; không mở nhầm tên cũ khi đăng ký mới |
| Đổi người Writing | Xóa tên/PIN đang nhập; giữ lớp của link; lưu trước khi đổi; người sau không nhận nháp người trước |
| Lưu đồng thời | Đang lưu rồi gõ thêm/bấm đổi vẫn lưu bản cuối đúng UUID; lỗi mạng/409 giữ bài |
| Nhiều tab | Màn chọn tên cập nhật; bài/lượt thi đã mở giữ danh tính; CBT đang xác nhận giữ đúng UUID khi tab khác đổi bộ nhớ |
| Term/Mini | Ba answer sheet + ba CBT × hai lớp; prefill không tự resume/prepare/start; hủy/xác nhận giữ cổng hiện có |
| Hồ sơ tạm → chính thức | Checkbox được bật lại; giữ đúng lựa chọn tick hoặc bỏ tick trước đó |
| Trình duyệt | JSON hỏng, khóa lưu bị chặn, xóa lỗi; không báo đã quên khi xóa thất bại |
| Hiển thị | Desktop/mobile; checkbox đúng kích thước; cache module và bootstrap được đổi phiên bản |

Kiểm thử không tạo/nộp bài thật. Các API học viên được thay bằng fixture và có chặn mặc định cho request chưa mô phỏng. Kiểm server riêng chỉ sửa quy tắc chấp nhận dấu chấm trong mã lớp; không thay đáp án, đề thi, quyền giáo viên hoặc danh sách lớp.
