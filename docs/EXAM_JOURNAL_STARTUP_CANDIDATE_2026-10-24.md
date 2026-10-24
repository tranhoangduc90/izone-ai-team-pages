# Bản ứng viên: nhật ký chọn học viên và khởi tạo

Trạng thái: đã sửa và kiểm cục bộ; **chưa commit/push/merge hoặc phát hành production**. Thực hiện theo yêu cầu Đức ngày 24/10/2026: giữ nguyên kiểm quyền, bài làm và điểm; báo trước khi phát hành.

## Vấn đề và kết quả

Trước đây bộ ghi phòng chờ được nối khi tải audio. Thao tác chọn tên trước đó chỉ còn ảnh chụp giá trị hiện tại sau khi có context; không biết đủ các lần chọn/đổi trước đó. Các request khởi tạo cũng có thể kết thúc trước lúc bộ ghi sẵn sàng.

Bản ứng viên gắn bộ thu trước khi app/bootstrap chạy, trong phần cuối tệp cấu hình đề vốn đã được tải. Không thêm một tệp mạng mà màn hình thi phải chờ. Phần ghi/gửi log chạy riêng, không được await bởi luồng thi.

Ghi thêm:

- Giá trị và tên hiển thị trước/sau khi chọn, đổi hoặc bỏ chọn học viên; chọn lớp ở Substitute; vào/rời/bấm ô nhận diện.
- Nút xác nhận, đổi người, nghe thử, thử lại và bắt đầu tại phòng chờ; chỉ quan sát thao tác, không tự gọi hành động.
- Giá trị được chương trình đặt/khôi phục được đánh dấu riêng; không suy thành thao tác người dùng. Có ảnh chụp định kỳ tối đa mỗi giây để nhận ra thay đổi `.value` không phát sự kiện.
- Bắt đầu thu, DOM sẵn sàng, trang tải/xuất hiện/ẩn; số lựa chọn và tình trạng khóa ô nhận diện. Không gửi cả danh sách lớp/học viên.
- Bắt đầu/kết thúc/lỗi/HTTP status/thời lượng request khởi tạo. Không giữ body, token, query string hoặc nội dung trả về. `client_handler_returned` chỉ nói hàm client trả về, chưa phải bằng chứng bài đã lưu.

Log audio hiện có tiếp tục ghi tải từng phần, hoàn tất, checksum và tình trạng player. Không thay cách tải, phát hoặc khóa audio.

## Phạm vi và bảo toàn

Áp dụng 7 engine: Term/Mini K67; Term 1 K56; Term 2 K56; Mini K56; Substitute K67; Substitute 1 K56; Substitute 2 K56. Bao phủ 17 entry học viên, gồm giấy, computer-based và Listening retake.

Nguồn chuẩn bộ thu là `term-tests/shared/exam-journal/lobby-capture.js`. `node tools/build-exam-journal-startup.mjs --write` ghép bản giống hệt vào 10 tệp `test-config.js`; chạy không có `--write` để kiểm đồng nhất. Phần định nghĩa đề gốc giữ nguyên. Các đường nạp có revision mới để tránh app/audio dùng bridge cũ từ cache.

So sánh source xác nhận 7 app và 8 bootstrap chỉ thêm quan sát/đổi revision; 10 phần định nghĩa đề gốc giữ nguyên. Không sửa backend, đáp án/key, cách tính điểm, quyền lớp, token bài thi, đồng hồ, dữ liệu bài hoặc giao thức lưu/nộp. SOURCE.json ghi hash theo nội dung Git thực sự phát hành. Bản vá browser này nằm trong Pages; chưa hợp nhất vào cây backend `tools/exam-journal` của đợt trước. Khi đồng bộ vendor sau này phải giữ bản vá và chạy hai regression test mới.

## Cách đọc khi điều tra

Các sự kiện mới dùng type hiện có: `identity_observed`, `state_observed`, `button_clicked`, `request_*`, cùng `sequence_gap`. Giữ schema/event version 1 vì đây là dữ liệu bổ sung tương thích hợp đồng đang chạy. Build có hậu tố `+startup-20261024-v1`; dữ liệu thu sớm có `captureVersion`.

Phần chọn tên luôn `identityConfirmed:false`, được ghi bằng vé **chưa xác nhận** do API cấp. Không lấy tên/UUID trên dropdown làm bằng chứng quyền. Bộ ghi khởi tạo nhập module muộn cũng không được thay callback state của app đã chạy.

Khi tra theo học viên cần xem cả scope đã xác thực và scope `__unconfirmed__` cùng lớp/bài/pageVisitId. Trong `checkpointState` có:

- `selected` / `previous`: value và label trên màn hình; `source` và `trusted`: sự kiện thật, synthetic hay ảnh chụp giá trị do chương trình đặt/giá trị ban đầu.
- `observedAt`: thời điểm quan sát gốc UTC; `captureOrdinal`: thứ tự thu trên trang. `occurredAt` là lúc tạo sự kiện sau khi có context. Các lô HTTP có thể tới khác thứ tự; dựng lịch sử bằng thời điểm gốc và ordinal.
- `classCodeAtObservation`: lớp lúc thu. Nếu lúc đầu chưa biết lớp thì giữ chuỗi rỗng, kèm `scopeClassSource:later_page_hint` khi gắn được lớp sau; lớp này vẫn chưa xác minh.

Request hoàn tất sau khi đổi lớp vẫn giữ lớp lúc request bắt đầu; sự kiện cũ không được chuyển sang chủ bài mới.

## Kiểm chứng

Bằng chứng ngoài Git: `C:/Codex-Work/exam-journal-init-20261024/evidence/`.

| Nhóm | Kết quả |
|---|---|
| Regression chọn A rồi B trước audio/context | RED đúng lỗi ở bản gốc: 0/2 lần chọn; GREEN bản sửa: đủ 2 lần, tên trước/sau và mốc gốc |
| Browser thu sớm | 6/6: chọn/khôi phục/xóa/đổi; tách lớp; tắt producer; collector lỗi + phục hồi + trần bộ đệm; ban đầu chưa có lớp |
| Hợp đồng mới + regression lưu/nộp/identity/cache | 84/84 |
| Recorder/bridge của bản đã chạy, trỏ import vào module ứng viên | 22/22, gồm Writing/đáp án, ACK sai, gửi lại, hai tab, RAM/IndexedDB lỗi, thoát trang và owner |
| Nộp Listening/Reading với handler thật và API/media giả | 96/96 trên 6 sản phẩm |
| Mở bài/điểm cũ, hai thứ tự giấy/CBT K56 | 12/12, kiểm lại sau khi ghép vào config |
| Nhận diện với giao diện thật, journal trả 503 | Term K56 16/16; giấy K56 8/8; Substitute 5/5; giữ các kiểm quyền/nháp cũ và chặn mọi dịch vụ thật |
| Contract collector đang triển khai + kho mã hóa cục bộ | Sự kiện mới được normalize, đọc lại nguyên dữ liệu và gửi trùng không nhân đôi; chi tiết trong deployed-contract.json |

Hai bộ kiểm cũ `mini-test-identity.mjs` và `k56-mini-paper-regression.mjs` không xanh; đã chạy đối chứng bản gốc `c1ad5fec44f10b7b77180b19cbf1c88d809438dd`. Bộ giấy cũ cùng lỗi 7/9 trên hai bản; bộ identity cũ có chờ roster chưa ổn định và còn đòi xác nhận lại sau reload, trái hành vi đã được xác minh của luồng nhớ người. Không tính hai bộ này là bằng chứng đạt. Bộ identity hiện hành và kiểm bài/điểm cũ ở trên bảo vệ các hành vi liên quan. Không sửa nghiệp vụ để chiều theo kiểm cũ.

## Giới hạn và ảnh hưởng vận hành

- Trước khi có vé ghi log hợp lệ, hàng thu sớm chỉ ở RAM: tối đa 128 sự kiện/64 KiB, tính cả lô đang chờ. Vượt trần có bộ đếm mất và ghi `sequence_gap` khi phục hồi; khoảng thiếu được đánh dấu cho cả khởi tạo trang. Nếu đóng trang trước khi xin được vé thì chưa bảo đảm giữ được hàng RAM này.
- Không cam kết bắt mọi giá trị trung gian do code tự gán rồi đổi lại trong dưới một giây mà không có sự kiện/DOM mutation. Thao tác chọn tên thực tế có event được thu ngay.
- Thêm mã quan sát vào asset có sẵn và thêm log khởi tạo/request; dùng lịch flush/retry hiện có, không mở đường gửi liên tục riêng. Không gọi Gemini hoặc mua dịch vụ. Giữ quota VPS 1,5 GB/máy, cảnh báo 70%, dừng nhận 85%, sàn trống 5 GB và chính sách 90 ngày hiện hành.
- Kiểm mới dùng dữ liệu giả, collector/kho cục bộ; chưa phải readback production cho bản ứng viên, tải Gemini cao điểm, phục hồi vật lý 90 ngày hoặc Safari.

## Phương án phát hành để duyệt

Đây là gói Pages, không có migration database hoặc sửa dịch vụ VPS. Sau khi Đức duyệt Git và phát hành đúng gói: kiểm lại nhánh main/không có xung đột, tạo PR, merge theo quyền rồi kiểm revision public và hành vi đọc log thụ động. Không tạo/nộp/chấm bài học viên để kiểm. Tiếp tục theo dõi lượt thật đầu tiên.

Hoàn tác bằng việc phục hồi các asset/revision của bản trước qua một bản phát hành được duyệt; không xóa nhật ký, bài hoặc điểm. Nếu chưa phát hành thì production tiếp tục hoạt động như hiện tại, vẫn thiếu lịch sử thao tác rất sớm đã nêu.
