# Giải quyết E-04, E-05, E-06 — Term Test 1/2 K56

## Phạm vi đã chốt trước sửa source

Đức yêu cầu giải quyết cả ba ca, cho phép phép thử thật và dọn dữ liệu sau thử. Chọn nghiệm thu `small_complete` cho đúng ba hành vi trên cả hai Term; không mở rộng sang chấm bài/ghi điểm/đổi backend hoặc n8n. Dữ liệu giả đã hoàn thành trong PostgreSQL RAM đáp ứng ca UI, nên không cần tạo bài hoặc điểm thật mới.

Source sửa là Pages remote main `61909536cce51bfa7e15d475579b87b3f1a166cf`, worktree `codex/k56-edge-20261003-pages`; giữ các thay đổi thứ tự thi và Writing mới hơn bản `f28a593`. Handler đọc kết quả thật/backend fixture khóa `6bc4816`; fixture chỉ mô phỏng roster và nội dung/phiên mở lại, không cấp sẵn phản hồi endpoint kết quả. Mọi mạng ngoài bị chặn.

## Phát hiện và cách sửa

- E-04: làm chậm một phản hồi đọc kết quả ít nhất bốn giây, dùng đúng endpoint POST result mà frontend sử dụng (tài liệu cũ gọi GET theo nghĩa đọc). Đối chiếu UI hồi phục và mở lại đúng bài/điểm, kho không đổi. Đã đạt hai Term trên source ghim f28a593; kiểm lại trên source hiện hành.
- E-05: màn hình 360 px đọc đủ nhận xét dài, nhưng PDF cắt cuối và lặp vùng nhìn thấy. Dialog có chiều cao giới hạn và vùng cuộn, chưa có quy tắc in. Sửa CSS in của riêng hai route Term: bỏ fixed/grid scrollport, cho toàn bài phân trang, ẩn nền app và nút điều khiển. Phải kiểm đầy đủ 12 dòng cùng đầu/cuối của cả bốn tiêu chí, bài nguồn và ảnh từng trang PDF.
- E-06: Chrome Cài đặt đặt Page zoom 200%, cửa sổ native 640 px; DPR 1→2, layout 624→312 px do viền cửa sổ. Không dùng CSS zoom, pinch hay viewport emulation thay zoom thật. Shared body min-width 320 gây tràn ngang tại 312; override chiều rộng tối thiểu chỉ trong CSS hai route và kiểm cuộn/mở/đóng bài chấm.

## Kiểm và đường quay lại

Giữ cùng runner cho RED trên source base và GREEN sau sửa. Bộ thử mới phải đủ hai Term/ba ca, dữ liệu đúng, không job mới/Portal write/mạng production/JS error. Chạy audit K56/Substitute/K67 hiện hành và kiểm cú pháp/JSON/diff; không bỏ test fail hoặc đổi nghiệm thu để báo xong. Mèo review chỉ đọc đã xác nhận nguyên nhân bản in và nhắc kiểm đủ từng tiêu chí; root giữ sửa/kiểm cuối.

Không sửa shared CSS để tránh tác động Mini/Substitute/K67. Cache version hai stylesheet Term được tăng để người dùng nhận CSS mới. Backup nội dung base bằng Git/hash; nếu bản sửa không đạt thì giữ ca failed/unknown, không phát hành. Sau phát hành, tải byte CSS/HTML thật và chạy lại browser với CSS thật để xác nhận đích. Nếu cần quay lại chỉ revert đúng commit CSS/cache/test này, không đổi backend/kho bài. Không phát sinh dữ liệu thật cần Đức xóa trong đợt ba ca này.

## Đánh giá ảnh hưởng và giới hạn

Nếu sửa: nhận xét dài phân trang được khi in; cửa sổ phóng lớn hẹp không bị ép rộng 320 px. Nếu không sửa: người dùng có thể thấy đủ trên màn hình nhưng bản in mất cuối nhận xét; zoom 200% ở cửa sổ 640 px có tràn ngang. Quy tắc chỉ thêm vào CSS Term 1/2 K56; các module dùng chung, Mini/Substitute/K67, backend, quyền và workflow giữ nguyên. Công cụ impact graph không có trong phiên; phạm vi được đối chiếu bằng diff và full suite liên quan, không tuyên bố đã gọi graph.

Quyền phát hành Pages của Đức đã cấp trong hướng dẫn chung; không cần OAuth hoặc quyền ghi Portal. Side effect production là cập nhật bốn asset HTML/CSS và phiên cache. Không phát sinh phí AI, lượt chấm, job, API ghi hoặc dữ liệu học viên; có một lần build Pages thông thường. Sai CSS có thể ảnh hưởng đọc/in ở hai route; giữ base 6190953 và snapshot bốn file, rollback bằng revert commit tác vụ rồi đọc lại URL/CSS.

Đã sửa bộ kiểm ghi nhớ tên để chờ dữ liệu phiên và popup thực sự xuất hiện thay các khoảng đợi 30/40 ms; không đổi sản phẩm hoặc giảm assertion. Cập nhật hash CSS trong phép kiểm parity vì thay đổi CSS có chủ đích; hash nội dung đề và layout gốc giữ nguyên. Ảnh Playwright mặc định bị cắt khi zoom native: dùng surface Chrome không có clip CSS, kiểm đủ chiều rộng vật lý và ảnh không trống. Sửa công cụ chụp không thay assertion zoom hay giấu overflow.

Mức tin cậy cao cho Chrome và phạm vi ba ca trên hai Term theo fixture đã lưu, sau khi đủ PDF/ảnh, audit kho, full suite và readback live. Không suy rộng thành nghiệm thu Safari/Firefox, pipeline chấm hoặc toàn bộ Term; các phần đó cần bằng chứng riêng. Khi thiếu bằng chứng sau phát hành, giữ `deployed_awaiting_validation`, không đóng bằng test cục bộ.

## Giá trị của bộ kiểm

E-04 bảo vệ khả năng đọc sau mạng chậm; E-05 bắt cắt bài khi in và overflow trên điện thoại; E-06 bắt việc phóng native làm mất bố cục hoặc thao tác cuộn/đóng. Bộ E-03 cũ chỉ kiểm hai tab thường, không có delay, feedback dài, PDF hoặc native zoom. Kỳ vọng dựa trên marker/bài giả đã lưu và số hàng audit độc lập, không suy từ DOM chứa nội dung hoặc code có CSS. Không thêm export/hook vào ứng dụng thật.
