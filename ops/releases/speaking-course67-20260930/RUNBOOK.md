# Speaking 67 — phần giao diện T2/T3

## Phạm vi và trạng thái

Bản này thêm chọn lớp/tên cho Lessons 2/3/4, nhớ UUID để chọn sẵn, khóa danh tính phiên, giữ Docs cùng lớp và bỏ Docs khi đổi lớp. Nội dung/hình, Doctor và luyện thêm Lesson 4 giữ nguyên; Lesson 3 không có Doctor.

Manifest kế thừa PLAN `large_phased`, chỉ ghi **ready trước Pages deploy** cho T2/T3. Không tuyên bố toàn bộ lớp, T5, Docs/biên nhận thật hoặc Portal đã được nghiệm thu. Chưa có mutation production của phần Pages trong hồ sơ này.

## Bằng chứng hiện có

- Full suite áp dụng: 16 lệnh đạt, không skip; API giả cục bộ. Browser nhận diện 26 ca; closed CTA 15 ca; shared memory 13 ca. Các test có tên `real` vẫn chạy fixture cục bộ.
- Closed CTA: cùng test RED trên adapter WIP trước sửa, GREEN sau sửa. Đây không phải RED trên Git HEAD gốc. Server vẫn quyết định quyền mở lại qua biên nhận; giao diện không tự cấp quyền.
- Source/test hash 12 file: `sha256:17fec2495a3191b07b93a1294e2bd124ff90e1d3b6a3ff9ab1f3d3b6188fed92`. Docs trong thư mục này không nằm trong phạm vi hash. HEAD gốc: `954087f9690946f2e4cb1deccf180bcc3d6c060b`.
- Root đã đọc API catalog thật lúc 2026-09-30 15:32:41 UTC: 3 mã HTTP 200, mỗi mã 9 lớp; IC2304 buổi 2/3 mở, buổi 4 nháp; 8 lớp còn lại chưa có bài. Đây chỉ là kiểm danh mục API.
- Evidence riêng: `E:/Codex-Data/speaking-course67-plan-20260930/frontend-evidence/`, gồm `suite-results.json`, `identity-results.json`, `closed-cta-results.json`, `closed-red/run.json`, ảnh `lesson-*`, `catalog-live.json` và `pages-gate-check.json`. Không chép hồ sơ học viên hoặc token vào Git.

## Kiểm lại trước phát hành

Chạy từ Pages worktree. Runner đọc 12 file để băm revision rồi chạy toàn bộ lệnh áp dụng; lỗi bất kỳ lệnh nào sẽ trả exit code khác 0 và giữ log riêng. Sau đó checker đối chiếu manifest với revision vừa đọc, không dùng hash cũ nếu source đổi.

```powershell
# Kiểm source/test hiện tại; kết quả và hash nằm trong suite-results.json riêng tư.
node 'E:/Codex-Data/speaking-course67-plan-20260930/frontend-evidence/run-suite.mjs'
$suite = Get-Content -Raw -LiteralPath 'E:/Codex-Data/speaking-course67-plan-20260930/frontend-evidence/suite-results.json' | ConvertFrom-Json
# Kiểm manifest: sai revision, thiếu test hoặc rủi ro mở sẽ hiện outcome fail.
python 'C:/Users/ADMIN/.codex/scripts/validate_product_quality_gate.py' 'ops/releases/speaking-course67-20260930/quality-gate.json' --current-revision $suite.revision
```

Runtime browser của suite: `C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`. Đây là đường dẫn local, không phải dependency triển khai Pages.

## Root bổ sung sau Pages deploy

1. Ghi revision thực đã phát hành và đọc lại 3 trang/JS/CSS, CORS và API catalog.
2. Kiểm browser thật: roster, UUID đã nhớ từ hệ thống chung, lựa chọn lớp/tên, nháp/chưa có bài, mobile/keyboard, memory clear. Chưa có quyền kiểm nộp thì không tạo grant hoặc biên nhận giả ở production.
3. Ghi mutation/readback thực và quan sát lỗi/429/pending; chuyển trạng thái thành `deployed_awaiting_validation` khi còn thiếu nghiệm thu. Chỉ ghi `verified` khi đủ phần phát hành đã chốt; cổng tổng PLAN vẫn giữ T5 và Portal pending nếu chưa có outcome.

## Quay lui

Root phát hành lại Pages revision trước nếu giao diện lỗi. API additive phải giữ tương thích. Không sửa hoặc xóa Docs/biên nhận học viên để quay lui. Giữ evidence và trạng thái các phần chưa nghiệm thu trong manifest tổng.
