# Mini K56 CBT: tiến độ chính thức và giữ lượt đang làm

Gói ứng viên kế thừa giao diện Mini K56 hiện hành, giữ đề, thứ tự kỹ năng, Task 2, storage/BUILD và bộ phát Mini. Chỉ entry chính chuyển sang bộ nạp mới; mọi gói bất biến cũ giữ nguyên. Backend tương ứng là gói `mini-k56-cbt-parallel-entry-20261118` trong repository `izone-classroom-mapping-review`, PR #253. Chưa coi merge frontend là bằng chứng backend đã phát.

`tests/build-mini-k56-parallel-entry.py` ghép trên `runtime-recovery-v1.mjs` của Mini, giữ retry khi lần ghi Listening đầu thất bại, pending seal, initial play và telemetry. Chỉ thêm tiến độ chính thức, xuất HTML an toàn và nhận capability cho đúng lượt cũ. Không thay toàn runtime bằng bản Term. Wrapper giữ attempt/session/generation/owner, nháp và hạn; request đọc tiến độ lỗi hoặc sai scope không xóa hàng chờ hoặc chuyển bài sang đối soát.

Phản hồi tiến độ khi khôi phục không phân biệt được lần nộp của chính hồ sơ với hồ sơ khác. Nếu đang có seal/interrupt chưa đọc biên nhận, giữ operation và liên kết tới kỹ năng kế cho tới khi `/offline/status` xác nhận receipt hoặc xung đột rõ ràng. Khi status của operation chưa được lưu trả tiến độ đã chốt, giữ đáp án thua trong `supersededLocalOperations`, không dựng receipt. HTML tải về chỉ xuất trường được chọn, không mang owner/permit/native scope.

Luồng Báo lỗi âm thanh dùng cùng cửa sổ im lặng/hash Mini đã kiểm, thêm lựa chọn không nghe thấy, bị rè và ba thiết bị, Cancel. Xác nhận đi tiếp qua controller gián đoạn Mini hiện có. CSS chỉ áp vào hộp thoại mới trong entry Mini; giữ bộ phát và các thành phần khác. Telemetry nối report/loại lỗi/thiết bị với operation khi đã có, không đồng nghĩa đã đọc được ở Collector/cloud.

## Kiểm đã chạy trong môi trường cách ly

- `mini-k56-parallel-entry.test.mjs`: bảy ca progress/export, warm đúng scope, sai scope/API lỗi, xung đột, pending seal qua refresh, retry lần ghi Listening lỗi và hash toàn bộ 184 tài nguyên.
- `mini-k56-parallel-native-browser.mjs`: hai thứ tự, A đã seal kỹ năng đầu qua native API, B dùng giao diện thật làm tiếp tới Task 2; mất ACK, một bài chính thức, một receipt/run/job Writing. HTTP/PGlite thật với roster/nội dung giả.
- `mini-k56-parallel-warm-native-browser.mjs`: v3 đang làm Reading qua nâng bản, F5 và đóng/mở offline; cùng scope/nháp/hạn, hai HTML tải thật, tiếp Listening/Task 2 và một receipt/job khi mất ACK. Hai asset dùng chung trong cache v3 được dựng từ byte lịch sử đã đối chiếu đúng SHA; không sửa file cũ trong source.
- `mini-k56-report-parallel-browser.mjs`: bốn nhánh không nghe thấy/ba thiết bị, Cancel giữ bài, khoảng im lặng không tạo gián đoạn, nút tiếp ổn định và mở Reading. API giả; ảnh hộp thoại đã xem trực tiếp. Ca này chưa chứng minh metadata đã đến Collector.
- `mini-k56-report-native-collector-browser.mjs`: browser chọn Loa ngoài, native HTTP/PGlite lưu một interrupt nhưng chưa giữ bài chính thức, rồi mở Reading. Bảy quan sát từ browser được fixture bọc envelope và gửi qua owner/context/collect đang phục vụ vào kho mã hóa cách ly, giữ loại lỗi/thiết bị/report/operation và từ chối sai binding. Đây chưa phải mạng browser tới Collector VPS hoặc cloud. Fixture dùng ràng buộc gián đoạn chung K56 đã đối chiếu production; lần đầu nạp nhầm ràng buộc Term 1 là lỗi thiết lập thử, không phải RED sản phẩm.

Ca warm đã tái hiện lỗi xóa seal đang chờ trong lúc refresh và mất liên kết kỹ năng kế; unit regression RED/GREEN cùng ca, browser native warm GREEN sau sửa. Bằng chứng và profile giả lưu riêng tư ngoài Git. Các ca ngắn không thay audio đủ thời lượng, đầu ra thiết bị, AI/Portal, tải vận hành hoặc cloud production.

## Phát và quay lui

Trước chuyển frontend, đọc lại API/policy đang phục vụ, phát backend tương thích và migration additive theo gói backend, xác nhận dữ liệu cũ và cờ Mini riêng. Sau phát Pages, đối chiếu entry, worker/manifest và toàn bộ hash public. Bài thật chỉ đọc. Giữ trạng thái browser, native, content và cloud riêng theo kế hoạch GOAL.

Nếu cần dừng cấp mới, ưu tiên backend `drain` giữ lượt đã cấp. Giữ schema/receipt mới, cache và API hiểu scope Mini mới; không restore dữ liệu hoặc quay sang code không hiểu các lượt đã cấp. Đổi entry về phiên bản trước không tự giải quyết hàng chờ của tab mới. Không thay file trong các gói bất biến đã phát.
