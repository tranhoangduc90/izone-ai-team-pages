# Giữ giao diện master #170 khi sửa hoặc tạo sản phẩm

Nguồn chuẩn dùng lâu dài: [bảo toàn và kế thừa master #170](https://github.com/tranhoangduc90/izone-AI-team/blob/main/docs/interface-master170/README.md), gồm bản đầy đủ 21 mục/17 hình, token, mốc cuối và 255 mục màn/popup/trạng thái. Bản mẫu lịch sử không được dùng để đổi ngược sản phẩm đã chuyển.

## Nguồn thực thi trong repo

- `shared/master170/theme.css` và `shared/master170/assets/`: Source Sans 3 thường/nghiêng, logo, token và scope opt-in. Các CSS adapter trong cùng thư mục giữ khác biệt practice, handout, teacher, Writing Flow, Materials, Speaking, Recording, grader và Cổng AI.
- Giữ `data-izone-theme`, `data-m170-product`, điều kiện Homework/Test, thứ tự import, specificity và query version hiện hành của entry/loader/template. Có tên font trong CSS không chứng minh nội dung lồng hoặc rich editor đã dùng font thật.
- Khi tạo entry mới trong phạm vi master, kế thừa theme và adapter đúng nhiệm vụ; giữ engine/API của sản phẩm. Tạo lesson mới dùng phiên bản giao diện/engine đã phát, không copy HTML cũ từ skill/demo rồi mang font cũ trở lại.
- Sửa CSS chung phải tìm mọi consumer thực sự nạp nó, kiểm cả ảnh hưởng lên nhóm được loại trừ. Nếu không có công cụ graph, đọc import/template/selector trực tiếp và báo phạm vi; không coi thiếu công cụ là lý do bỏ kiểm hoặc dựng cổng mới.

**Nhóm loại trừ của đợt chuyển:** toàn bộ Test, Progress Log và mọi handout Writing Speaking–Writing chuyên sâu, gồm học viên/giảng viên/library/Draft/kết quả/popup/trạng thái và nguồn dùng chung liên quan. Giữ chuẩn và thread riêng của chúng. `student-journey.html` lấy nguồn SW được giữ; font comparison là demo độc lập và phải giữ cả preset tham khảo cũ lẫn Master. Các HTML `teacher-login-preview/` là tư liệu, không dùng nghiệm thu sản phẩm hiện hành.

## Reading — cập nhật theo yêu cầu 25/10/2026

Reading thực chiến không hiển thị dòng chú thích tên/mã màu giao diện ở cuối bài (ví dụ “Navy đậm: đang chọn…”). Giữ màu và trạng thái của nút/cờ cùng nhãn hỗ trợ tiếp cận; không phục hồi dòng chú thích từ mẫu/ảnh cũ. Quy tắc áp dụng cho bài hiện hành và các bài Reading kế thừa sau.

## Hồi quy đã lưu, chọn theo phần chịu tác động

| Phần | Runner trong `tests/` |
|---|---|
| Handout 67 heading/header | `handout67-heading-browser.mjs`, `handout67-header-browser.mjs` |
| Writing Flow clock/search/popup | `writing-flow-updated-layout-browser.mjs`, `writing-flow-toolbar-layout-browser.mjs`, `writing-flow-detail-layout-browser.mjs` |
| Reading/Listening màn thấp | `practice-short-viewport-browser.mjs` |
| Materials status/focus/teacher/preview | `materials-status-browser.mjs`, `materials-history-async-focus-browser.mjs`, `materials-teacher-browser.mjs`, `materials-preview-layout-browser.mjs` |
| Speaking actions/colors/receipt | `speaking-actions-browser.mjs`, `speaking-submit-colors-browser.mjs`, `speaking-teacher-receipt-browser.mjs` |
| Popup Cổng AI | `ai-gateway-dialog-browser.mjs` |
| Phòng so font | `master170-font-comparison-native.mjs` |

Đọc phần cấu hình của từng runner để dùng đúng biến môi trường, fixture và thư mục bằng chứng ngoài Git. Một số runner nhận đường dẫn file của Playwright, số khác nhận module specifier; không truyền chung một định dạng cho mọi script. Giữ dữ liệu giả/RAM và chặn ghi dịch vụ thật theo harness; không chạy nguyên mọi `.mjs` vì có script kiểm nghiệp vụ riêng. Mục nào không có runner phù hợp thì kiểm browser trực tiếp và ghi giới hạn.

Các ca trên đã bắt được lỗi tiêu đề khó đọc, header/clock đè nhau, nhãn tìm kiếm bị cắt, JSON đẩy rộng popup mobile, pane đề cao 0, focus bị footer che và font bị báo chờ sai. Giữ đúng trigger của ca hồi quy; không thay bằng kiểm tên class hoặc số lượng selector. Ảnh trước/sau phải được nhìn ở đúng nội dung/trạng thái. Bộ test này không chứng nhận mọi màn hoặc Google/Docs/AI thật.

## Mốc cuối đã lưu

Các sửa UI đến [PR272](https://github.com/tranhoangduc90/izone-ai-team-pages/pull/272), merge `f3b1e0a8244f1b10a65adda13bde5ce91bdc6583`, đã có readback riêng. Root lưu [mốc triển khai cuối](https://github.com/tranhoangduc90/izone-AI-team/blob/main/docs/interface-master170/ROLLOUT_STATE_2026-10-24.md) và các giới hạn. Không phát lại runtime khi chỉ đọc hoặc lưu bộ nhớ.

Mỗi PR có ảnh hưởng giao diện cần nói rõ chuẩn/consumer đang kế thừa, phần đổi, bằng chứng kiểm và phần chưa kiểm. Repo chưa có CI giao diện bao phủ tự động mọi tình huống; hướng dẫn này không thêm checker/branch protection/cổng xin phép. Một thay đổi thuần tài liệu chỉ cần kiểm tài liệu và phạm vi diff, không chạy lại ứng dụng để có con số đẹp.
