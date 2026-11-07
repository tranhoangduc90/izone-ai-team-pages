# Term Test 1 K56 — bảo toàn bài làm

Term1 giữ renderer, đề, dữ liệu cũ và tổng thời gian: Listening40 câu/41 ô (32a+32b), Reading26 câu/40 phút, Writing Task2/55 phút; không có textbox dàn ý.

`term-tests/k56-offline-shared/` là lõi kho/queue/receipt/clock/player và whole-audio. Wrapper Term2 giữ API export, policy, namespace và defaults v1. Term1 dùng riêng `izone-term1-k56-v1`, `term1-k56:`, lock `term1:` và worker theo scope Term1 CBT; không migrate/xóa kho Term2.

Lượt mới tải đủ graph, quyền toàn hành trình và audio trước Ready. Audio chính là GitHub Pages; Cloudinary dự phòng phải khớp cùng SHA-256 `c7766f97758ec5ecdd3b69dfd3f762567a50bdbb0fd38930a2b609879e8439fc`, 29.559.371byte. Tải/kiểm/ghi đọc lại trước giờ làm, dùng một Blob local khi thi. Lượt native đang làm giữ transport cũ.

Input được ghi trên máy trước mạng; chỉ receipt đúng scope/hash/revision mới gỡ pending. Cùng hồ sơ trình duyệt mở lại sẽ đọc run theo owner/binding; hạn R/W không cấp lại. Đổi người nhả con trỏ latest/lock nhưng giữ nguyên run cũ. File tải HTML độc lập chứa 41 trường L, 26 trường R và Task2, escape HTML, không permit/token/khóa audio.

Listening không tự thu theo wall deadline. API/log/lỗi ghi không được điều khiển phát/dừng. Media lỗi hoặc không tiến giữ checkpoint/hold; mở lại lúc hold vẫn dừng, chỉ tiếp tục qua controller. Tự thu cần sự kiện ended thật, media đã ended và thời lượng đúng đề; event giả/seek sát cuối không đủ. R/W đọc deadline từ runtime ngay cả khi native storage mirror lỗi.

Backend tương ứng: `izone-classroom-mapping-review/backend/ops/releases/term1-offline-20261107`. Term1 chỉ cấp khi flag riêng đúng `true`; tắt cấp mới không tắt nhận pending đã cấp. Canonical Task2 trắng nhận0 theo quy tắc, không tạo job AI. Không chấm lại bài cũ.

## Lệnh kiểm

- `python tests/build-term2-offline-assets.py 1` và `2`: dựng graph riêng từng bài, tính byte text LF như Git/Pages.
- `python tests/term2-offline-release-bytes.py 1` và `2`: đối chiếu độc lập Git blobs thật.
- Unit: `term1-offline-unit.mjs`, `term2-offline-unit.mjs`, `k56-offline-profiles.mjs`.
- Browser: `term1-offline-browser.mjs`, `term1-offline-faults.mjs`, `term1-offline-edges.mjs`; hồi quy `term2-offline-faults.mjs` và native integration.
- `term1-full-round.mjs`: hai lượt đủ audio thật + R40 + W55, một offline từ Ready/reload, kết quả native SQL0 hoặc AI giả6. `term2-full-round.mjs`: hai lượt hồi quy đủ giờ. Các danh tính/API là fixture, không nộp/chấm thay học viên.

Đặt `TERM2_EVIDENCE` ra thư mục riêng ngoài repo. Full runner cần `TERM2_FULL_ROUND=1`; Term1 thêm `K56_TEST_PRODUCT=1`, `TERM2_NATIVE_FIXTURE`, `K56_FAKE_GRADING`, `TERM2_RUNTIME_ROOT`, `TERM2_DEPS_PACKAGE`. Không nhận lượt đang chạy hoặc bị dừng là đạt. Báo cáo phát hành cuối nằm trong bộ nhớ dự án chính.
