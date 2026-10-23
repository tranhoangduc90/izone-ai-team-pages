# Progress Log — phục hồi lỗi đọc phản hồi HTTP 200

Khi header HTTP đã trả 200 nhưng nội dung bị ngắt, hết thời gian đọc hoặc không phải JSON hợp lệ, dashboard cũ đổi lỗi đọc thành `null` rồi báo “Hệ thống trả về mã 200”. SSE có thể vẫn mở nên việc đọc lại chờ heartbeat hoặc lần đọc bù tiếp theo. Số 200 không diễn tả nguyên nhân và giảng viên có thể phải chờ lâu dù kết nối thông báo còn tốt.

Hai ca Chromium dùng máy chủ HTTP giả đã tái hiện đúng nhãn lỗi trên source trước sửa: ngắt socket giữa body và trả HTML với status 200. Body của lần lỗi production ban đầu không được lưu, nên chưa quy được nguyên nhân truyền tải cụ thể của lần đó. Đây là bằng chứng sửa cơ chế xử lý/phục hồi, không phải khẳng định đã xác định tầng mạng gây ngắt ban đầu.

## Thay đổi

- `api-response.js` phân biệt phản hồi chưa đọc đủ, JSON/schema không hợp lệ, timeout và lỗi HTTP/quyền. Chỉ nhận JSON có `ok: true`; không lấy header 200 làm xác nhận dữ liệu đã đọc hoặc thao tác đã lưu.
- `teacher.js` dùng bộ đọc này, giữ kiểm generation và xử lý hết phiên/quyền hiện hành. Không tự phát lại POST/PUT/DELETE.
- `teacher-live-updates.js` tự đọc lại sau lỗi HTTP/body ngay cả khi SSE vẫn mở. Backoff có jitter tăng dần, trần khoảng 30 giây; chỉ một lượt đọc đang chạy. Làm mới thủ công vẫn chủ động thử ngay. Mốc dữ liệu chỉ đổi sau khi áp dụng thành công, lần đọc full lỗi vẫn phải thử lại full.
- Heartbeat giữ nhãn/lý do lỗi cho đến khi đọc lại thành công. Mã chẩn đoán tối thiểu nằm trong thuộc tính DOM, không chứa câu trả lời hoặc thông tin phiên.
- Đổi lớp/phiên hoặc dừng theo dõi hủy lượt cũ; giữ panel, nhận xét nháp, câu chọn và số liệu đã có. Header, CSS, font và bố cục theo preset giữ nguyên.
- Canonical và alias HTML cùng tăng revision JS để tải bản sửa. Giữ phiên đăng nhập chung mới nhất từ main.

## Kiểm chứng trước phát hành

Trên cùng source cuối, toàn bộ `tests/progress-log-*.mjs` và `tests/teacher-sso-core.test.mjs` chạy tuần tự: **121 đạt, 0 lỗi, 0 bỏ qua**. Nhóm gồm phản hồi 200 bị ngắt/HTML, timeout body 15 giây, tự đọc lại khi không có heartbeat mới, backoff không bị heartbeat bỏ qua, đổi lớp/dừng lượt cũ, giữ nháp/panel, quyền/phiên chung và các luồng Progress Log hiện hành.

Hai ca hồi quy cùng runner thất bại trên source base `6a782a7` vì nhãn “mã 200”, đạt trên bản sửa. Fixture không gửi dữ liệu lớp thật hoặc ghi Portal. Kết quả này là kiểm trước phát hành; Pages build, asset public và Chrome production được ghi riêng trong báo cáo vận hành.

Không thay backend hoặc nhịp autosave học viên. Kết quả tải 30 lớp ×18 học viên của đợt thí điểm trước không bị đổi thành cam kết tải production mới. SSE vẫn chỉ bật cho IC2305 theo cấu hình máy chủ.

## Phát hành và quay lui

Phát gói Pages, kiểm asset có revision mới rồi kiểm phiên thật, SSE, tự cập nhật, Làm mới và mất mạng/phục hồi. Kiểm lỗi mạng chỉ trên tab kiểm, phục hồi cấu hình mạng trước bàn giao; không nộp bài, công bố nhận xét hoặc điều chỉnh điểm danh thật.

Nếu cần quay code, revert riêng commit Pages của bản sửa; giữ API, schema và toàn bộ bài/điểm mới. Không restore database để quay frontend.
