# Issue 99 — giữ thao tác xem kết quả

Phạm vi phát hành: Term 1, Term 2, Mini K56 (paper/CBT); Substitute Test 1/2 K56/K67 (CBT). Term/Mini K67 và dashboard Writing giữ nguyên. Đối chiếu [issue #99](https://github.com/tranhoangduc90/izone-AI-team/issues/99) và commit K67 `689a672ab74aed6b68f07e8d10026cecfc714fc6`. Bản ghép giữ toàn bộ sửa hiện có tại `8f3d6d8204c60cc22d52afd35ee158b7a2927e3c`.

## Thay đổi nhỏ

- Ba app Substitute dùng fingerprint dữ liệu từng câu riêng từng bảng. Điểm tổng hợp đổi không dựng lại bảng, mất focus hoặc vị trí cuộn. Câu đổi cập nhật bảng và giữ lựa chọn mở/đóng trước đó; bỏ event trễ của bảng đã bị thay.
- Ba app K56 giữ thuật toán đã tương đương K67, chỉ bổ sung fallback `state.studentRef` trước tên hiển thị để nhận diện đúng học viên trong cùng phiên.
- Tăng revision app và bootstrap thành `20261014-result-details-v1` ở cả đường preview và đường thi thường. Không đổi cấu hình/audio, backend hoặc n8n.

## Regression

`tests/term-test-result-details.mjs` chạy nguyên renderer trong Chrome: giữ DOM/focus/cuộn khi điểm tổng hợp đổi; cập nhật câu mới; Writing có điểm; tên hiển thị đổi trong cùng học viên/lượt. Cùng test đã tái hiện lỗi trên sáu app base và đạt sau sửa, không dùng bản đưa lỗi giả.

`tests/term-test-result-details-browser.mjs` kiểm 10 tuyến qua HTML/bootstrap/storage thật với API giả. Mỗi bảng mở riêng ít nhất 35 giây, qua ít nhất ba cập nhật nền khi áp dụng; Writing ready giữ Listening đóng/Reading mở. Đổi học viên, lớp và lượt riêng từng chiều, giữ namespace cũ để phát hiện trộn dữ liệu. Mini paper không có polling Writing: kiểm chờ và handler tải lại kết quả; Writing không áp dụng.

Fixture Mini cũ bổ sung mock telemetry `client-event`, giữ nguyên assertions. Không gửi dữ liệu giả vào API thật. Suite đăng ký cả test kết quả Substitute lân cận.

```powershell
node --test tests/term-test-result-details.mjs tests/substitute-result-live.test.mjs
node --test tests/term-test-result-details-browser.mjs
node scripts/run-term-test-67-regression.mjs --all
# Kiểm frontend online; mọi API vẫn bị fixture chặn trước khi gửi.
$env:RESULT_DETAILS_BASE_URL='https://tranhoangduc90.github.io/izone-ai-team-pages/'
node --test tests/term-test-result-details-browser.mjs
Remove-Item Env:RESULT_DETAILS_BASE_URL
```

Máy Linh dùng runtime Playwright/Chrome sẵn có và adapter riêng cho các fixture cũ vốn neo đường dẫn máy Đức. Assertions revision của bảy fixture được cập nhật theo đúng bộ nạp mới. Fixture kết quả chờ DOM/nút sẵn sàng; fixture ghi nhớ học viên chờ response prepare thay vì 30 ms, giữ nguyên assertions.

Bộ regression 20 file được chạy đầy đủ: lượt đầu 103/106 đạt; hai file lỗi được chạy lại, không gọi lượt đầu là PASS. Renderer mới đạt 6/6. Bộ K56/Substitute mở rộng 40 file đạt 212/215: hai ca thiếu backend/dependency ở đường dẫn máy Đức; một ca dùng hash nội dung production tháng 9 đã cũ. Hash nội dung đó khớp base `8f3d6d8` và không đổi trong gói này. Fixture giao diện ghi nhớ K67 còn gặp timeout thao tác trên máy kiểm thiếu RAM; đây là khoảng trống kiểm, không phải bằng chứng Term/Mini K67 bị sửa hoặc đã hỏng.

Log, trạng thái từng lần chạy, hash tài nguyên công khai, commit Pages/build và biên nhận sổ chung lưu ngoài source trong hồ sơ `issue99-toggle`. Không đổi baseline cũ chỉ để làm suite xanh; không tổng hợp các lượt có lỗi thành một lần chạy PASS.

## Giới hạn và quay lui

Test online bằng API giả chứng minh frontend đã phát hành và hành vi trong ca giả; không chứng minh phiên học viên từng gặp lỗi đã hết lỗi. Chưa nghiệm thu API/Portal/n8n thật hoặc mobile. Không nộp/reset bài thật, gọi AI hoặc ghi điểm học viên để kiểm.

Quay lui bằng một commit đảo đúng gói này trên main hiện hành sau quyền riêng và đối chiếu thay đổi mới. Không reset/force push hoặc đưa nguyên bản cũ lên website. Bản mã Git, Pages đã build, hash tài nguyên live và kết quả phiên thật là các trạng thái riêng.
