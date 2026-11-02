# Theo dõi nền học viên Speaking — source, chưa phát hành

Ba engine Lesson2, Lesson3 và Lesson4–15 dùng chung bộ theo dõi khi native `/open` quảng bá cả `studentStateStream` và `studentCombinedView`. Backend cũ giữ poller native; không gọi endpoint dò năng lực riêng. Idle không tạo stream; tab ẩn giữ đường đọc native hiện có.

Metadata đi qua POST, token không nằm trong URL. Chỉ tải gói open–Doctor khi nội dung đổi; Docs có gói nhỏ và cập nhật riêng. Đổi người/unit, phản hồi bị hủy hoặc trả muộn không được phủ dữ liệu mới. Counter Docs chống lùi sau lần đọc native. Nháp, công nhận, tự nộp và biên nhận giữ renderer/luồng native.

Khi Docs hoàn tất cùng nội dung mới, đọc hết nội dung trước khi nghỉ. Endpoint mới không hỗ trợ thì giữ đúng một vòng native còn thiếu, kể cả Docs vừa xóa pending. Lỗi view tăng khoảng chờ30/60giây, tôn trọng Retry-After; metadata mới không phá khoảng chờ. Lỗi401/403/423 đóng tracker, không chuyển sang endpoint yếu hơn.

## Kiểm trên gói source này

- Frontend49/49: observer chung, tracker học viên, consumer Reading/Listening, chính sách/hiển thị và hợp đồng HTML Speaking.
- Trình duyệt cách ly11/11: ba engine × ba nhịp15giây thật; mobile390px với backend không có capability; Docs-only; nội dung đổi giữ vùng khác; nội dung cuối cùng Docs; mất phản hồi finish nhưng chỉ một lần nộp; đổi người trong lúc view cũ chậm; fallback native cuối; lỗi503 và hồi phục sau khoảng chờ30giây.
- Runner dùng Edge headless/profile sạch, dữ liệu giả, CSP cùng bộ chặn kết nối ngoài loopback. Không gọi AI, Google, Docs hoặc database production. Chrome plugin cũng đã kiểm các engine với dữ liệu giả; các lượt tab mất giữa chừng không được nhận là đạt. Bằng chứng Google/SSO thật vẫn còn thiếu.
- Backend liên quan có kiểm riêng405ca local (391đạt/14native-onlyskip) và20/20 PostgreSQL native; không cộng chồng các nhóm/môi trường thành một lượt mới.

Lệnh frontend:

```powershell
node --test tests/test-state-observer.test.mjs tests/speaking-student-tracking.test.mjs tests/practice-result-tracking.test.mjs tests/practice-teacher-tracking.test.mjs tests/speaking-analysis-status.mjs tests/speaking-homework-policy.mjs tests/speaking-homework-lesson2-3-parity.mjs tests/speaking-homework-lesson4.mjs tests/speaking-homework-lesson3-no-doctor.mjs
```

Runner browser: đặt `PLAYWRIGHT_MODULE` tới `index.mjs` của Playwright đã cài và `SPEAKING_EVIDENCE_DIR` tới thư mục bằng chứng riêng mới, rồi chạy `node tests/speaking-student-observation-browser.mjs`. Không dùng `@playwright/test`. Đầu vào là source thật cùng dữ liệu giả; đầu ra là các JSON kiểm và hash source. Lỗi hành vi, kết nối ngoài loopback hoặc exception chưa xử lý làm runner thất bại; thư mục bằng chứng phải được giữ để điều tra.

## Phần chưa hoàn tất

Đây là checkpoint source học viên, không phải hoàn tất T3 hay bản sẵn sàng phát hành. Giao diện giảng viên gộp hai kho Speaking, cache pin xuyên HTML/loader, actual CLI/worker-on-off/wake/drain, lỗi phụ thuộc chậm/cùng NAT, exact live overlay, image cuối, SSO/canary/chuyển tương thích/readback/metrics vẫn còn. Không bật flag hoặc đổi database khi chỉ nhập gói này. T4–T6 giữ nguyên phạm vi.
