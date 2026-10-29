# Master170 — thư viện demo theo dạng, 29/10/2026

[Mở31demo để duyệt](https://tranhoangduc90.github.io/izone-ai-team-pages/design-reference/master170/). Mỗi dạng có link `?case=...`, mã tiêu chí và khung máy tính/390px/320px. Trạng thái: chờ Đức duyệt demo; các sửa lỗi radio/note/Ghi nhớ trước đó đã được chốt riêng trong PR351.

Reading/Listening dùng `authored-ui.js` và chuỗi CSS hiện hành. Reading Homework dùng prototype/TFNG renderer thật với20/42target giả, kho nháp riêng trong RAM và hai endpoint giả; không nạp access/web-client hoặc gọi API bài làm. Listening Homework dùng preview đã có, góp ý mô phỏng và không ghi AI/Docs. Các sơ đồ là SVG giả. Demo giữ chức năng điền/chọn/cờ, giới hạn chọn hai và popup Homework; không đăng ký lesson mới.

Nguồn chuẩn: [master1.1 và checklist184mục](https://github.com/tranhoangduc90/izone-AI-team/blob/main/docs/interface-master170/MASTER_STANDARD_V1_1.md), [bổ sung sửa lỗi29/10](https://github.com/tranhoangduc90/izone-AI-team/blob/main/docs/interface-master170/UI_CORRECTIONS_2026-10-29.md). Ảnh31demo, DOCX54trang và biên nhận chi tiết nằm trong hồ sơ master-design-upgrade-20261028 của dự án chính trên laptop.

Kiểm:10unit/contract đạt;93tổ hợp dạng×khung đạt trong Chrome DevTools bằng hợp bằng chứng không đếm trùng. Hai bài chọn hai đáp án chặn lựa chọn thứ ba; Homework review có20/42góp ý và popup mở/đóng ở ba khung. Đây là kiểm component/fixture, không chứng nhận SSO/AI/Docs, mọi phần master hoặc thiết bị thật. Link/nội dung đề trong demo không phải lesson đã mở cho lớp.

Chỉ thư mục demo và tài liệu/ca kiểm được thêm. Giữ các trang thi, engine, bài làm, điểm và K56. Khi đổi asset native, kiểm lại demo chịu tác động; không dùng demo mới chưa duyệt để thay baseline Term độc lập.
