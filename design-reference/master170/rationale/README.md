# Master170 — thuyết minh và kế thừa đến từng chi tiết

Bản ngày 30/10/2026 mở rộng **R3 đã chốt và bổ sung nền Options 29/10**, không đặt lại phong cách. Phạm vi: Reading/Listening thực chiến, hai Homework, Term/Mini và Substitute67. K56, Writing, Speaking, Progress Log, SW giữ phạm vi riêng. Tài liệu không tự cấp quyền phát hành, chấm hoặc nộp bài.

Mở [bộ tra cứu tương tác](https://tranhoangduc90.github.io/izone-ai-team-pages/design-reference/master170/rationale/), [dữ liệu đầy đủ](catalog.json), hoặc [những điểm đã tối ưu](CHANGES_AND_RATIONALE.md). DOCX có ảnh được lưu tại thư mục `private-deployments/master-design-rationale-20261030/` của dự án chính. Bản R3 và các biên nhận cũ được giữ nguyên.

## Cách đọc và dùng cho bài mới

1. Xác định **engine, người dùng, màn, loại câu, profile và phiên bản runtime**. TFNG của bài thi khác Homework phân tích mảnh. Một lesson mới kế thừa engine đang phát, không sao app cũ từ archive.
2. Đọc các quy tắc chung theo vai trò; chọn hợp đồng của màn và từng dạng thực sự có. Tra ID để thấy yêu cầu, lý do, dấu hiệu sai, điều kiện/ngoại lệ, nguồn và cách kiểm. Quy tắc chung A–H/S/T không bị bỏ chỉ vì bảng dạng bài chỉ dẫn vài ID đặc thù.
3. Giữ ý đồ đã chốt. Dùng component/adapter native của đúng engine; đừng vẽ lại một bài thi để bắt chước ảnh. Đổi cấu hình đề/lớp không phải lý do đổi timer, audio, quyền key, Note hay đích ghi.
4. Kiểm từng instance/trạng thái chịu tác động: văn bản dài, bỏ trống/đã chọn, focus, cờ, cuối nhóm, lỗi và quay lại. Giữ ít nhất hai câu hoặc hai stem độc lập trong fixture để xem phân cách; **không thêm câu vào đề thật**. Màn entry không phải dạng câu và không cần hai câu giả.
5. Ghi kết quả đúng mức: chưa kiểm, đã quan sát hay lỗi, gắn route/revision/điều kiện và bằng chứng. Có tài liệu, ảnh đẹp, HTTP200 hay test nguồn không có nghĩa nghiệp vụ đã đúng. Bộ tra cứu xuất phiếu tự rà với mặc định chưa kiểm; nó không khóa công cụ hoặc phát hành.

## Ba lớp quyết định

**Ý đồ đã chốt:** Source Sans3, vai trò màu, Options bên phải/nền #F6F9FC, phân câu nhẹ, ngoại lệ Matching và bài có hình, hai thang compact/Homework. Giữ cả mục đích lẫn biểu hiện; không viện một nguyên tắc tổng quát để tự đảo bank xuống dưới.

**Profile native:** số đo ở A100 và điều kiện tương ứng. Passage17/30,26; Listening stem16; option14,72; control14,08/cao38; Homework vùng học18/cao44; Options 16 theo bổ sung riêng. Không có một font-size hoặc padding áp mọi lớp. Nhận diện và ý nghĩa giữ chung, mật độ theo nhiệm vụ.

**Bố cục thích nghi:** chiều rộng, breakpoint, vùng cuộn và đệm theo thành phần. Kiểm nội dung thực, zoom, chiều cao thấp và cuối trang. Thay số đo khi cần phải giải thích kết quả, giữ ý đồ và phạm vi, không chỉnh baseline/dung sai để che sai.

## Bao phủ và giới hạn

- **184/184 tiêu chí** có lý do riêng và dấu hiệu sai; giữ requirement/verification hiện hành để truy vết, bổ sung phạm vi và ngoại lệ.
- **28 hợp đồng màn/hành trình** với các quyết định thành phần và trạng thái. Chúng là bản phân tích màn điển hình trong phạm vi, không phải chứng nhận mọi route/lesson đã được quan sát. Chỉ mục255 mục 24/10 là hồ sơ lịch sử nhiều sản phẩm, không bị ghi lại thành28 màn đã đạt.
- **31 demo** có diễn giải từng thành phần và ca kiểm đặc thù, dẫn tới renderer thật và ảnh R3. Ảnh ghi rõ mốc; bổ sung Options sau ảnh phải kiểm ở demo hiện hành.
- Lý do thiết kế là suy luận áp dụng từ nguồn đã lưu, không phải lời nguyên văn tác giả hay kết quả nghiên cứu người dùng. Không tuyên bố WCAG toàn sản phẩm, thử touch thật, SSO/AI/Docs thật nếu chưa có bằng chứng tương ứng.

## Nguồn và cập nhật

`catalog.json` ghim SHA256 của các nguồn đã dùng. Các bản tổng quát trong hệ thống còn có ví dụ màu focus/cỡ chữ cũ; thứ tự hiện hành là yêu cầu mới của Đức → R3 và nền Options 29/10 → profile master 1.1 → nguyên tắc hệ thống → ví dụ lịch sử. Không sửa lại biên nhận cũ.

Sau này có yêu cầu mới, cập nhật đúng ID, phần màn/dạng liên quan và fixture/renderer chịu tác động. Giữ lý do và điều đã thay thế. Không tạo thêm một checklist rời không nối vào chuỗi master → ID → màn/dạng → component → skill → bằng chứng.

## Công cụ đi kèm

`build_catalog.py` chỉ đọc nguồn và dựng JSON/JS cho bộ tra cứu. `verify_catalog.py` kiểm tính đầy đủ/liên kết và một số ca âm; không chạy hay chứng nhận sản phẩm. `build_docx.py` tạo sổ tay Word từ cùng dữ liệu. Đầu vào là tiêu chí, thuyết minh, hợp đồng và ảnh fixture; đầu ra là tài liệu/phiếu tra cứu. Thiếu ID/nguồn/ảnh cần thiết thì báo lỗi cụ thể, không điền PASS tự động.
