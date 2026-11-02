# Focus đỏ bo tròn phát sáng — 02/11/2026

Mẫu Đức chọn: viền `2px #DB0829`, bốn góc `12px`, quầng `0 0 0 3px rgba(219,8,41,.12), 0 0 16px rgba(219,8,41,.24)`. Không chuyển động.

`red-focus-glow.js` chỉ thay chỉ báo focus **đang có màu đỏ** (outline hoặc shadow đỏ của ô đang chọn, outline của khung cha hoặc checkbox proxy). Focus xanh, viền lỗi tĩnh, nội dung, handler, request và lưu trữ không đổi. Viền nổi ngoài vùng bị cắt; hỗ trợ dialog/popover native, viewport, scroll và bộ nạp thay body. Chế độ tương phản cao giữ focus native. Tải CSS lỗi giữ giao diện cũ. CSP dùng nonce được giữ bằng cách truyền nonce từ script sang stylesheet.

Các entry sản phẩm nạp script tương đối `shared/red-focus-glow.js?v=20261102-r1`; JS tự nạp CSS cùng thư mục. Khi tạo entry mới từ template, giữ thẻ này. Riêng `writing-handouts/student-journey.html` có CSP chỉ cho script inline: nhúng nguyên JS kèm `data-iz-red-focus-source` làm URL gốc tải CSS, không nới CSP. Khi sửa canonical JS, đồng bộ bản inline đó và các bản runtime được liệt kê dưới đây.

Bản tương ứng: Mapping Review `master170/`, Docs site `site/master170/`, AI Gateway `src/master170/`, Writing viewer `frontend-red-focus/`. Apps Script dùng HTTPS canonical Pages; phải phát Pages trước khi cập nhật HEAD/deployment của đúng project. Không push các source Apps Script cũ đè live; clone đầy đủ live rồi chỉ thêm tag UI. Bản sao Docs cũ có project riêng không tự cập nhật từ project gốc.

Kiểm: `tests/red-focus-glow-browser.mjs` kiểm marker, màu, bốn góc, khung đầy đủ, input/selection/action, checkbox, dialog, popover, scroll, resize, high contrast, CSP và bộ nạp. `tests/red-focus-products-browser.mjs` đọc danh sách consumer bằng `RED_FOCUS_CONSUMERS_FILE`; chạy HTML/scripts thật với mọi API ngoài bị chặn, không chứng nhận luồng nghiệp vụ thật. `RED_FOCUS_ARTIFACTS` phải trỏ ra ngoài Git. Các trang cần đăng nhập có thể chưa lộ controls trong fixture; không suy từ số entry thành số màn nghiệp vụ được nghiệm thu.

Quay lại: revert đúng commit tích hợp để bỏ tag/các asset riêng của task. Native focus cũ vẫn có trong source gốc; không phục hồi database/bài làm/điểm. Runtime server và Apps Script phải quay bằng bản sao/version của chính lần phát, không dựng lại từ main cũ.
