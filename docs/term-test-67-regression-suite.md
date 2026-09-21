# Bộ regression Term Test 67

## Mục đích

Bộ này gom các kiểm thử còn hữu ích của Term Test 1, Term Test 2 và Mini Test Buổi 5 khóa 67 vào một lệnh. Test dùng fixture giả và server local; không nộp bài, không chấm bài và không ghi dữ liệu học viên thật.

```powershell
# Đầy đủ: test tĩnh và test trình duyệt.
node scripts/run-term-test-67-regression.mjs --all

# Nhanh: chỉ test tĩnh, phù hợp khi đang sửa code.
node scripts/run-term-test-67-regression.mjs --quick

# Xem danh sách file đang thuộc bộ regression.
node scripts/run-term-test-67-regression.mjs --list
```

Nếu test lỗi, Node trả mã khác 0 và nêu đúng ca không đạt. Test trình duyệt cần Playwright trong runtime Codex trên máy Đức; không có Playwright thì trạng thái là chưa chạy, không được coi là đạt.

## Phạm vi được giữ

| Nhóm rủi ro | Test nguồn |
|---|---|
| Substitute Test 1/2 K67 tách route, đủ 40 câu và không lộ đáp án/secret | `substitute-k67.test.mjs` |
| Xác nhận đúng học viên, hồ sơ tạm và không tự mở lượt | `mini-test-identity.mjs`, `term-student-memory-ui.cjs`, `term-test-reliability.mjs` |
| Mất mạng, autoplay, checkpoint và phục hồi audio | `term-test-audio-recovery.mjs` |
| Thi lại riêng Listening và cách ly phiên | `term-test-listening-retake.mjs` |
| Kết quả Writing trực tiếp, polling dự phòng và cache revision | `term-test-k67-live-results.mjs` |
| Dàn ý Writing, thời gian chuẩn bị, kết luận và phản hồi đầy đủ | `term-test-k67-writing-update.mjs`, `term-test-writing-parity-feedback.mjs` |
| Link phản hồi trên dashboard giảng viên | `term-teacher-feedback-links.mjs` |
| Phiên đăng nhập giảng viên, logout và chống CSRF | `teacher-login-preference.mjs`, `term-test-teacher-session.mjs` |
| Trang tạo link, quyền lớp và audio của từng bài | `term-test-landing.mjs` |
| Tài nguyên local, xác nhận danh tính, reset lượt và bố cục matching | `term-test-reliability.mjs` |

Danh sách máy đọc nằm ở `tests/term-test-67-regression-manifest.json`. Khi thêm một regression test mới cho Term Test 67, thêm file vào đúng nhóm và chạy lại cả `--quick` lẫn `--all`.

## Nguồn lịch sử đã đối chiếu

Các task trực tiếp tạo hoặc sửa hành vi hiện còn được kiểm:

- `01a037b8-87c1-7e11-81e0-00b21d946497`: hồ sơ tạm Mini Test và các sửa bố cục CBT.
- `01a04869-c6df-7e71-8d0c-98add8911de6`: gói chuyển giao Term Test 67 và cổng xác nhận danh tính.
- `01a06b94-f1d3-7332-9ee9-ecb4e0b5c523`: bố cục map, matching và phân bổ chiều ngang.
- `01a090a7-24d1-7ac3-ba13-c3c477166d0f`: web thi lại riêng Listening Term Test 1.
- `01a090d0-a082-7cd3-9010-4afab602209d`: chống dồn tải và cơ chế retry dùng chung.
- `01a0947f-7332-7001-b7b4-a18a5e55c44e`: link Listening audio trên trang Term Test.
- `01a09ebc-fd18-7e43-807c-3232ac819192`: đẩy kết quả chấm trực tiếp và giữ polling dự phòng.
- `01a0b3d6-cabe-7651-ba2c-65741f7dd028`: ghi nhớ đăng nhập dashboard giảng viên và kích thước checkbox.
- `01a0bc8f-5fbd-78b3-bbdf-2deb3e19ffb8`: phiên đăng nhập giảng viên phía máy chủ.

Các task Writing 56/67 và audit ghi nhớ học viên được dùng để giữ các test phản hồi Writing, UUID, nhiều tab và fail-closed; dữ liệu riêng tư trong session không được đưa vào repo.

Trong lúc tích hợp ngày 21/09/2026, `origin/main` nhận thêm commit `d22715b` phát hành Substitute Test 1/2 K67. Bộ regression đã nhận luôn test `substitute-k67.test.mjs` của bản mới nhất này.

## Quy tắc khi tạo đề hoặc sửa hệ thống

1. Chạy `--quick` trong lúc sửa.
2. Chạy `--all` trên revision cuối cùng trước khi đẩy `main`.
3. Nếu thay cache revision, cập nhật cả trang nạp tài nguyên và assertion liên quan; không xóa assertion chỉ để test xanh.
4. Nếu thay hành vi đã từng lỗi, bổ sung test tái hiện đúng lỗi trước khi sửa.
5. Sau khi đẩy Pages, đọc lại URL thật; test local không thay thế bằng chứng phát hành.
