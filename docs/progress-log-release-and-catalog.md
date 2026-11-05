# Progress Log: phiên bản web và kho bài

Các link công khai giữ nguyên. Sáu entry học viên/giảng viên/Hành trình dùng bộ nạp nhỏ, chọn một gói bất biến chứa cùng phiên bản HTML, JS, CSS, module con và tài nguyên liên quan. Script khôi phục URL chuẩn trước khi mở ứng dụng; nháp và đăng nhập vẫn dùng cùng origin, định danh và khóa lưu hiện hành.

## Phát hành

Chạy `node tools/build-progress-release.mjs`. Mã phiên bản lấy từ nội dung nguồn và bộ đóng gói; không sửa tay query của từng module. Commit gói mới, `release.json` và fallback của sáu entry cùng thay đổi nguồn. Không sửa hoặc xóa gói cũ: tab cũ có thể cần tải tiếp module và rollback cần giữ URL cũ.

Workflow `Package Progress Log release` tự làm bước đóng gói sau thay đổi Progress Log/shared trên main, lưu gói vào main và yêu cầu build Pages theo cấu hình xuất bản hiện có. Nó không đổi cấu hình hosting hoặc source của sản phẩm khác. Nếu push/build bị từ chối, sửa lỗi trong Actions; không báo đã phát chỉ từ commit nguồn.

API `/api/learning/frontend-release` chỉ trả mã phiên bản đã kiểm. Máy chủ đọc manifest công khai, kiểm toàn bộ file/hash và sáu entry trước khi chuyển; lỗi hay thiếu file giữ phiên bản cũ. Bản đã kiểm được giữ trong `learning.frontend_release_state` để khởi động lại API không làm mất điểm quay lui. Route này không dùng quota Hành trình và không đọc dữ liệu học viên.

Trình duyệt kiểm khi vào trang, quay lại tab, có mạng và khoảng 60 giây khi hoạt động. Trang chủ rảnh có thể chuyển tự động; đang nhập/lưu/nộp/xem chi tiết giữ nguyên và báo có bản mới. Lỗi lưu không cho chuyển bản. Vị trí đọc và bộ lọc kho được khôi phục khi chuyển an toàn. Không xóa cookies, storage hay bài để cập nhật. Tab mở từ trước lần cài cơ chế này cần mở lại/tải lại một lần; máy offline hoặc bị tạm dừng nhận cập nhật khi hoạt động lại.

## Kho bài và dữ liệu

`Xóa bài` thêm tombstone cho các revision của cùng worksheet trong đúng kho; không DELETE draft, publication, assignment, submission, checkpoint hay attendance. Chủ bài quản lý Kho cá nhân; chỉ Progress Log admin đang hoạt động được tạo/xóa ở Kho chung. Quyền course authority không tự cấp quyền quản lý Kho chung.

Xóa một nguồn không xóa nguồn còn hoạt động ở kho khác. API chặn giao/sửa/copy trực tiếp từ nguồn đã xóa; giao và xóa dùng cùng khóa transaction để đối chiếu lại nguồn sau khi chờ. Phiếu đã giao giữ bản chụp và lịch sử. Không dùng thu hồi assignment để xóa bài trong kho.

Tổng quan học viên có tùy chọn `includeSkills` để nhận một lô dữ liệu kỹ năng của chính người học. Không gọi chi tiết mọi buổi để dựng trang chủ. Yêu cầu đọc cùng nguồn đang chờ được gộp; mỗi caller giữ quyền hủy riêng, không cache kết quả vĩnh viễn. Resume đọc lại attempt active bằng quota riêng; chỉ start mới dùng hạn mức tạo lượt. Hạn mức draft/checkpoint/final vẫn giữ nguyên.
