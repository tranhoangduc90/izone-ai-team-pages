# Thư viện CTA demo cho giảng viên

31 bài mở thẳng nội dung, không đăng nhập hoặc chọn lớp/học viên. Bản demo dùng để làm quen và trình chiếu; các ô nhập, cờ, ghi chú và nút làm lại chỉ thao tác trong trang demo. Nhận xét/kết quả là ví dụ được ghi nhãn, không phải chấm câu trả lời vừa nhập.

- [Thư viện demo](https://tranhoangduc90.github.io/izone-ai-team-pages/homework-demo/)
- [Google Docs demo riêng](https://docs.google.com/document/d/1GTMs2ne7Ejjo4YqdOQQyjPkULfg-bomdwmpvqjchRtE/edit)
- [File CTA gốc để copy giao bài](https://docs.google.com/document/d/17d2BlBjwvXwTwytiZnIeiMUkO59eBd7-6FVAdwJKoxg/edit) — không được sửa bởi gói này.

## Phạm vi và nguồn

14 Speaking, 6 Reading Homework, 7 Reading thực chiến, 1 Listening Homework, 3 Listening thực chiến. `catalog.json` là bảng đối chiếu mã CTA, URL, số phần/câu/ô và hash dữ liệu công khai. Mỗi mã có một HTML và JSON riêng.

Cấu trúc đề Reading/Listening được đọc trực tiếp từ runtime ngày 30/10/2026, chỉ lấy nội dung hiển thị; không lấy key, lời giải chấm, rubric, danh tính hoặc bài làm. Full Test 2 dùng bản v2 đang chạy. Reading Homework tái sử dụng renderer/engine native; Speaking dùng các phần và CSS native; thực chiến dùng `authored-ui.js` native; Listening Homework dùng `interactive-workspace.mjs` native.

Demo có lối khởi động riêng và không nạp identity/SSO/web-client thật. Reading Homework chỉ nhận nội dung demo qua object được entry riêng cấp; đường production giữ cách khởi động cũ. Không thay API, cơ sở dữ liệu, workflow CTA, lịch hoặc mẫu gốc.

Audio Scandinavian Studies, Science experiment và Inclusive design dùng bộ tải Cloudflare/Pages hiện hành. Tree planting có một bản MP3 demo trên Pages, khớp SHA-256 đề đang chạy, tải và kiểm hash trước phát; không mở API audio production hoặc thay quyền native.

## Dựng lại và kiểm

`tools/build-homework-demos.mjs` nhận thư mục capture riêng tư rõ ràng làm đối số. Nó dùng inventory Docs, snapshot question-only và các phần Speaking native để dựng 31 bài. Capture không được đưa lên Git; chỉ output đã chọn trường được phát hành. Không tạo dữ liệu giả để thay một bài bị thiếu.

`tests/homework-demo-browser.mjs` kiểm đủ mã, phiên sạch, câu/ô/part, thao tác minh họa, reset, desktop/mobile, lỗi JavaScript/asset và không gọi dịch vụ học viên thật. `tests/homework-demo-audio-browser.mjs` kiểm chuẩn bị, giải mã và phát bốn audio. Đặt `PLAYWRIGHT_MODULE`, `DEMO_CAPTURE_DIR`, `DEMO_EVIDENCE_DIR`; thêm `DEMO_PUBLIC_BASE` để kiểm URL đã phát hành. `DEMO_ONLY_CODES` chỉ dùng cho lượt kiểm bù, không chứng nhận toàn bộ 31 bài.

Phát hành riêng bằng commit Pages. Quay lui bằng revert commit của gói, giữ nguyên mọi dữ liệu học viên và file CTA gốc. Docs demo có lịch sử phiên bản riêng; không restore tài liệu gốc.
