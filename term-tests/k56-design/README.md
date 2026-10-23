# Theme K56 — master #170 v1.0

Chỉ bật trên entry có `body[data-k56-design]`. Nguồn duyệt: yêu cầu triển khai của Linh ngày 23/10/2026 và master #170 v1.0, Source Sans 3 / nút navy. #177 chỉ là mẫu độ chi tiết.

## Trách nhiệm và ranh giới

| Module | Nhận → tạo | Điều phải giữ |
|---|---|---|
| `theme.css` | DOM hiện hành → token, bố cục, trạng thái, responsive | Không thêm control, nội dung đề hoặc nghiệp vụ |
| `presentation.js` | Header, dialog đã được renderer tạo → logo, đóng/focus | Không API/storage; không thay node đáp án hoặc văn bản annotation |
| Các `index.html` K56 | Entry cũ → opt-in và asset có phiên bản | Giữ CSP, query, script/controller và SSO |
| Ba adapter K56 | Preference Writing hiện có → giữ tỷ lệ riêng của đề khi chưa có preference | Preference cũ ưu tiên; không đổi revision, handler nộp hoặc thời gian |
| Worker K56 | Vỏ trang → cache thêm đúng font/logo công khai | Không cache bài làm, API, audio hoặc tài nguyên riêng |

Mười một entry: landing `k56-demo`, ba CBT, ba phiếu, ba Audio Backup và `teacher-k56`. K67/Substitute không opt in. Hai consumer Substitute có dùng adapter K56 nên runner cuối dùng `--all`.

## Bố cục

- Theo phản hồi sau phát hành ngày 23/10: giữ cấu trúc đề K56 cũ. Reading 50/50 trên desktop; ≤980 px bài đọc trên, câu hỏi dưới, cả hai cùng hiện và cuộn độc lập. Không thêm nút đổi vùng, không đổi nhóm/control hoặc DOM annotation.
- Linh duyệt bổ sung ngày 23/10: căn đều hai lề các đoạn văn dài, đặc biệt bài Reading; dòng cuối căn trái. Không áp cho nhãn, đáp án, bảng và ô đang nhập.
- Writing: dùng default của content (Term 1: 44%, Term 2/Mini: 50%) và ưu tiên preference cũ. Giữ separator, đề/dàn ý/editor/meta theo cấu trúc gốc; ≤620 px xếp dọc theo CSS gốc. Khung laptop tính chiều cao còn lại để không cắt số từ/trạng thái lưu.
- Phiếu: hai cột đi từ trên xuống theo cột như bản gốc, màn hẹp một cột. Câu 32 Term 1 vẫn là cặp ô; nhóm 24–26 Term 2 vẫn do handler chọn ba xử lý.
- Giảng viên: lọc gần bảng, tóm tắt gọn, giữ tab, toàn bài, nháp và quyền hiện hành. Dialog chỉ đọc giữ nhấn–nhả ngoài, Escape, nút đóng và trả focus; bản lưu dùng nút đóng của owner để dọn timer.

## Tài nguyên

Font được sao nguyên byte từ `writing-handouts/assets/fonts/SourceSans3-Variable.woff2`, kèm `SourceSans3-LICENSE.md` (OFL). Logo IZONE được sao nguyên byte từ `term-tests/substitute-shared/izone-logo-color.png`; giấy phép font không cấp quyền đối với logo.

## Kiểm local an toàn

```powershell
node --test --test-concurrency=1 tests/k56-master170-browser.mjs tests/k56-master170-entry-teacher.mjs tests/k56-original-layout-browser.mjs tests/k56-listening-offline-scope.mjs
node scripts/run-k56-product-audit.mjs --all
```

Runner browser dùng Playwright đã có và Edge, đọc `CODEX_NODE_MODULES` hoặc runtime trong hồ sơ người dùng. Không thêm dependency sản phẩm. Mọi API của các test mới là fixture; request bên ngoài bị chặn. Media Listening là mô phỏng, không chứng minh nghe được trên thiết bị vật lý.

Các test mới bảo vệ token/font thực nạp, breakpoint, cùng node/giá trị đáp án khi chuyển vùng, bố cục Reading gốc và thứ tự phiếu, đủ footer Writing, 12 đường landing, 12 đường mở kết quả cũ, phiếu, audio lỗi và hành trình giảng viên. Bộ hồi quy cũ vẫn bảo vệ identity/revision/nộp/phục hồi. Lỗi của bộ cũ không được xóa hoặc đổi kỳ vọng để làm xanh.

## Phát hành và quay lui

Bản v1 đã phát hành trước phản hồi. Gói sửa v2 hiện chưa commit/push/deploy. Khi được cấp quyền riêng, phát hành đồng bộ entry, bootstrap, ba adapter, theme/script/font/logo và worker. Giữ nguyên cơ chế xác nhận nộp của #172. Không đổi query, storage key hoặc xóa cache/nháp của học viên.

Quay lui bằng gói frontend tương thích trước thay đổi: bỏ opt-in/theme và trả đúng entry/bootstrap/adapter/worker của gói trước. Không restore database, reset bài/điểm hoặc xóa nháp. Sau phát hành cần đọc lại asset đích và xác nhận nghiệp vụ thật được Đức chỉ định; fixture không thay phần đó.

## Checklist từ K67

Xem `docs/K56_K67_UI_CHECKLIST_2026-10-23.md`: 120 điểm bố cục, từng điểm có phạm vi áp dụng, mức bằng chứng hoặc khoảng trống. Chỉ tham khảo bố cục, mật độ và quan hệ các vùng; font/màu tiếp tục master K56, không sao từ K67; không nạp skin/engine K67 hoặc sao các phần K67 đã bỏ sang K56. Landing bỏ card demo trùng cuối trang; demo vẫn có trong chọn lớp.
