# Kiểm bản xem thử Lesson 5 — 05/10/2026

Phạm vi: route riêng `writing-handouts/lesson5-demo/`; kế hoạch và demo local. Không có xác thực thật, grading AI, callback backend, thao tác database, publish hoặc n8n mutation trong đợt này.

## Bằng chứng

| Yêu cầu | Mã kiểm | Kết quả |
|---|---|---|
| Chọn tên → ghi nhớ → xác nhận như Progress Log | T-UI | PASS trên browser, ghi nhớ tắt không tự chọn tên; reload vẫn yêu cầu xác nhận |
| Đề đầy đủ, hai idea, topic, các ô vàng | T-UI/T-INVALID | PASS; ô trống báo lỗi và focus vào ô cần nhập |
| Topic → B1 → A1 → X1 | T-FLOW/T-LOCK | PASS native và browser; pending khóa nút/ô nhập |
| Vocab1 chỉ sau đủ ba điểm; ý2 chỉ sau nút chuyển | T-VOCAB/T-LOCK | PASS; không có nội dung vocab hoặc ô B2 khi chưa đến bước |
| B2 → A2 → X2; B2 nhìn được B1 đã duyệt | T-FLOW/T-UI | PASS browser; B1 là ngữ cảnh chỉ đọc |
| Từ vựng đúng A/X/B, mỗi nhóm hai cụm ≤5 từ | T-VOCAB | PASS fixture; chưa chứng nhận sinh từ vựng thật |
| Comment từng lượt có snapshot, không mất nội dung cũ | T-HISTORY | PASS native và browser mở lịch sử |
| Không nhận callback giả đến muộn sau reset | T-ASYNC | PASS native; generation + requestId, chặn gửi trùng |
| Lỗi kỹ thuật giữ bài, không tăng lần cần sửa, retry | T-ERROR | PASS native và browser |
| Restore tiến độ, đổi người học, logout không ghi đè nháp | T-RESTORE/T-UI | PASS; student B trống, quay student A khôi phục bài |
| Desktop/mobile, bàn phím/focus, không cuộn ngang toàn trang | T-UI | PASS, 360/390/759/760/761/1099/1100/1101/1440 px |

Native runner: `node --test writing-handouts/lesson5-demo/core.test.mjs` — 8/8, không skip. T-UI là lượt kiểm browser riêng, không đếm lại tám ca native. Check cú pháp `node --check` cho app.js/core.mjs. Suite Writing hiện có `npm test` 149/149 và `npm run check` đạt; không thay shared source hoặc route đang chạy.

Browser Playwright CLI: Chromium của session riêng, desktop 1440×950, mobile 390×844; snapshot trước tương tác. Lượt browser cuối trả `{outcome:passed,count:15}` cho 15 assertion của toàn hành trình, khóa/chờ, từ vựng và đổi người học. Console ứng dụng 0 lỗi/0 cảnh báo; network chỉ tài nguyên tĩnh, không gọi API bên ngoài. Một session chẩn đoán riêng đã bị CSP từ chối thử fetch CSS; đây không phải lời gọi của ứng dụng, session nghiệm thu cuối không có lỗi đó.

Ảnh đã mở và xem: `output/playwright/lesson5-demo/login-desktop.png`, `login-mobile.png`, `writing-desktop.png`, `writing-mobile.png`, `vocabulary-desktop.png`. Các ảnh và Playwright raw log là artifact local, không đưa dữ liệu học viên thật lên Git.

## Đối chiếu mẫu và sai khác chủ đích

Mẫu Writing live: render 1280×720; navy topbar #14213D, body 16 px, card radius 14 px, input 15.04 px, bố cục bài + Comment; font computed Inter với system fallback, chưa xác nhận font file Inter thật. Mẫu Progress Log: source khung 620 px, card radius23, thanh navy8, button48; URL chung không đủ mã phiếu nên login live chưa đo. Demo dùng cấu trúc chọn tên/xác nhận từ source/fixture của mẫu; không tuyên bố pixel-perfect.

Demo tăng cỡ label/body login cho dễ đọc; đổi textarea vàng theo Docs; token IZONE navy152B4E/redDB0829; thêm sidebar bước và chia B/A/X theo yêu cầu. Mobile là thiết kế bổ sung đã render/kiểm, không suy từ ảnh desktop mẫu. Cùng dữ liệu fixture trên desktop/mobile, đã đối chiếu bài và lịch sử.

## Giới hạn và áp dụng bài học

Selector test của máy trả `unknown/fallback_release`: graph/registry chưa đủ và source discovery thay đổi. Không dùng selector làm bằng chứng pass. Route này chỉ import core của chính nó; không sửa shared module. Đã chạy toàn suite Writing hiện có, native demo và browser độc lập. Không chứng nhận toàn Pages, backend hoặc production từ kết quả demo.

Recipe định dạng bên ghi/bên đọc: dùng version1 và restore fixture; chống ghi lại/truyền dữ liệu: T-ASYNC + T-RESTORE; test ngoài glob: gọi core.test.mjs trực tiếp và ghi biên nhận riêng. Lease và truy vấn SQL không áp dụng demo; giữ nghĩa vụ kiểm ở P2–P5. Không có lỗi thật đã phát hành trong phạm vi route mới, nên RED trên base không áp dụng.

Graph snapshot tool không có trong công cụ phiên; đã đọc map/import trực tiếp (app → core) và chốt phạm vi route độc lập. Backend/n8n production cần review độc lập, identity/schema fixture, test full suite, execution và readback theo PLAN.md trước triển khai.

Trạng thái: demo local có thể xem thử; sản phẩm thật chưa triển khai. Ngưỡng tuổi job, tải30 và chi phí trong kế hoạch là đề xuất cần đo trước phát hành. Không mở rộng quyền deployment từ bản HTML này.
