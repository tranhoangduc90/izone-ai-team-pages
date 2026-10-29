# Writing K67 — phục hồi xác nhận lưu sau lỗi kết nối

Khi máy chủ lưu snapshot A nhưng trình duyệt mất phản hồi, học viên có thể đã viết tiếp snapshot B trước khi thử lại. Client cũ gửi B với revision cũ, gặp xung đột và dừng autosave. Bài mới vẫn ở máy; lúc hết giờ, backend chốt bản canonical đã lưu, có thể chưa có nội dung Task 2.

## Thay đổi

- Giữ snapshot gửi chưa rõ kết quả trong đúng kho phiên, kèm người học, attempt và base revision.
- Chỉ nối lại xác nhận khi máy chủ trả đúng cả hai Task của snapshot từng gửi và revision tăng đúng một bước. Giữ bài đang viết mới hơn và thử lưu từ revision đã đối chiếu, tối đa một lần trong mỗi thao tác.
- Khôi phục cùng bằng chứng sau reload. Bản khác người/lượt, nội dung khác hoặc revision nhảy nhiều bước vẫn cần học viên chọn rõ; không tự vượt xung đột.
- Thông báo xung đột nêu rõ bài mới chỉ đang giữ trên máy và cần chọn bản để tiếp tục lưu.
- Bump `writing_ack=20261029-v1` qua app, bootstrap, entry giấy/CBT, thi bù và phiếu cứu hộ K67. Không thay storage key, thời hạn thi, endpoint lưu/chấm hoặc engine K56/Substitute.

Các trang đã mở bằng code cũ vẫn chạy code cũ. Bản cũ chưa giữ snapshot gửi chưa rõ kết quả vẫn cần xử lý xung đột bằng lựa chọn rõ của học viên; không suy từ nội dung tương tự để tự ghi đè.

## Kiểm chứng

Ca mất ACK rồi viết Task 2 và ca reload cùng bằng chứng đều thất bại trên app base, sau đó đạt trên app sửa. Ca chính kiểm đủ cả hai Task sau lưu và payload nộp tự động sau hạn; fixture bàn giao sự kiện `requestSubmit` giống adapter đồng hồ, không chứng nhận lại đồng hồ hoặc âm thanh thiết bị thật.

Runner trình duyệt dùng app thật với API giả. Đã bổ sung dependency đồng hồ/identity Substitute còn thiếu vào fixture và dùng subprocess bất đồng bộ để đọc đủ output của runner con trên Windows. Dữ liệu trong các ca đều là dữ liệu giả; không gọi AI hoặc ghi Portal.

Các lệnh kiểm liên quan:

```text
node --test tests/term-writing-save-clients.cjs
node --test tests/term-mini-submission-contract.mjs tests/term-mini-pending-storage.mjs tests/term-mini-cache-graph.mjs
node --check term-tests/shared/app.js
git diff --check
```

Nhóm static còn lại của manifest K67 có 70/75 ca đạt trên cả base và head, cùng năm ca thất bại do kỳ vọng revision/guard cũ. Giữ nguyên kết quả đó; không sửa kỳ vọng để nhận toàn bộ suite xanh. Phép kiểm này không chứng nhận lại toàn bộ Google, AI, Portal, audio hoặc mọi thiết bị.

## Phát hành và quay lui

Chỉ frontend Pages thay đổi. Trước phát hành kiểm diff, dữ liệu riêng tư và graph cache; sau phát hành so hash asset public và mở các entry trong trình duyệt chỉ đọc. Quay lại bằng revert gói frontend trên dữ liệu đang có; không restore database, reset phiên hoặc chấm lại học viên để quay code.

Phục hồi nội dung/điểm của một incident là thao tác quản trị riêng có phê duyệt, bản chụp trước ghi và readback. Không đưa bài làm hoặc định danh học viên vào source, test hay tài liệu công khai này.
