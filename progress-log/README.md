# Progress Log — giao diện tĩnh

Hai giao diện dùng chung API backend:

- `index.html`: học viên chọn tên, xác nhận, điền và nộp từng checkpoint; nộp đủ lần cuối kích hoạt đồng bộ điểm danh. **Xem hành trình của em** nằm trong chính phiếu, có báo chờ/thử lại/quay về. Không cấp thêm link Journey.
- `teacher.html`: ba tab **Theo dõi lớp**, **Hành trình lớp**, **Tạo phiếu**. Tab đầu theo dõi từng phiếu và phân tích câu; tab giữa xem toàn lớp qua các buổi; tab cuối soạn/sao chép/nhập, lưu nháp, xem thử, duyệt và phát hành.

Dashboard chỉ đọc bản nháp đã được autosave, không gửi từng phím gõ. Khi tab đang hiển thị, trang hỏi máy chủ mỗi tám giây; khi tab bị ẩn thì dừng. Mỗi kết quả được đối chiếu `assignmentId` và `studentRef` trước khi hiển thị để request cũ của lớp khác không ghi đè màn hình hiện tại.

Các câu nhập kết quả như `8/10` dùng object `{ correct, total }`, không dùng chuỗi tự do. Nội dung học viên ghi lại từ lời giảng viên có nhãn `student_reported_teacher_feedback`; chỉ nội dung được chính giảng viên lưu ở portal mới là lời nhắn thật của giảng viên.

Link học viên có dạng `https://<pages-host>/progress-log/#assignment=<public-token>`. Token đặt trong fragment để trình duyệt không gửi nó vào request GitHub Pages.

## Xác nhận lịch và xem toàn lớp

Vào **Hành trình lớp → chọn lớp**. Có thể mở cùng màn từ nút **Xem hành trình lớp** trong tab Theo dõi lớp. Không cần chọn một phiếu đã phát hành để xem lớp chưa có Progress Log.

Mở **Xác nhận ngày của từng buổi** sẽ tự đọc ERP. Mỗi hàng chỉ có một dropdown với số buổi, thứ và ngày. **Đọc lại lịch học của lớp** đọc nguồn mới; phần đang chỉnh được giữ trong tab. Đề xuất chưa ghi database; giảng viên bấm **Xác nhận kế hoạch lớp** mới chốt. Hai người lưu cùng lúc sẽ thấy phần đối chiếu, không ghi đè âm thầm.

IC2305 là pilot ERP 1294, 31 buổi. Buổi Test/chưa có phiếu/sắp tới được phân biệt, không suy là vắng. Listening/Reading hiện khi thi hoàn tất; Writing có thể chờ chấm rồi xuất hiện khi làm mới. Trạng thái job điểm danh và bằng chứng đã ghi Portal là hai lớp riêng.

## Soạn, duyệt và phát phiếu

Trong **Tạo phiếu**, chọn lớp/buổi rồi tạo nháp hoặc sao chép phiếu nguồn. Danh mục giới hạn tám nhóm đang dùng: câu mở, MCQ, dropdown, gapfill, nhóm ô ngắn, checklist Speaking, ô giải thích có điều kiện, số câu đúng tự khai. Có danh sách phần để đi tới vùng sửa; đổi thứ tự vẫn giữ ô phụ sau câu điều khiển. Có thể thêm ô giải thích ngay tại phương án liên quan.

Nhập CSV/TSV có **Xem trước lô câu hỏi → Xác nhận thêm lô này vào nháp**. Dòng lỗi chặn cả lô. Lưu nháp giữ phía máy chủ, có revision; lỗi giữ phần đang soạn. Đáp án không lưu localStorage/sessionStorage. Khi đang ghi, các ô soạn được khóa ngắn để response không làm mất phần mới gõ.

**Xem thử như học viên** mở kho demo với học viên giả. **Gửi duyệt/Duyệt bản này** kiểm đúng quyền khóa; sửa nội dung sau duyệt cần duyệt lại. **Phát hành phiếu cho lớp** tạo phiên bản bất biến, kiểm trùng buổi và đọc lại roster/hash. Nút mở phiếu vừa phát hành dùng cùng link Progress Log, token trong fragment. Retry cùng thao tác không nhân phiếu.

Nâng cấp 01/10/2026 đang được nghiệm thu trong worktree; các nút mới chỉ có trên production sau cổng phát hành API/migration/Pages. Luồng chọn thư viện cũ vẫn dùng trong mục thu gọn. Chi tiết giao diện và giới hạn: [hướng dẫn nâng cấp](UPGRADE-20261001.md).

## Chạy thử local

Từ thư mục gốc snapshot, chạy:

```bash
bash ./run-local.sh
```

Script chỉ phục vụ file frontend tại `http://127.0.0.1:8090/term-tests/`; trang gọi
`https://ducizone.ddns.net/mapping-api`, và backend production mới kết nối database trên VPS.
Không khởi động backend hoặc database local cho luồng này.

Backend production phải cho phép origin `http://127.0.0.1:8090` trong `ALLOWED_ORIGINS`; nếu
không, trình duyệt sẽ chặn CORS.

## Kiểm thử

Lệnh này đọc HTML/JavaScript và kiểm các guard bảo mật chính. Khi lỗi, Node nêu rule bị vi phạm; không thay đổi file hoặc gọi API.

```powershell
node --test tests/progress-log-static.mjs
```

Không publish trước khi backend staging đã bật schema `learning`; nếu publish sớm, trang thật sẽ chỉ báo API chưa sẵn sàng.
