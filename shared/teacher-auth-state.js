/* Nhận panel đăng nhập và vùng thông báo của trang GV hiện hành.
   Chờ xác minh thì ẩn form; chỉ hiện Google khi hết/chưa có phiên.
   Lỗi mạng/thiếu quyền có thông báo và thử lại, không tự coi là đã đăng nhập. */
export function createTeacherAuthState({ panel, notice, retry, badge, hideOnReady = false }) {
  let needsLogin = false;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button-secondary';
  button.textContent = 'Thử lại';
  button.hidden = true;
  notice.after(button);
  button.addEventListener('click', () => { if (!button.disabled) void retry(); });
  return {
    get needsLogin() { return needsLogin; },
    checking() {
      needsLogin = false;
      panel.hidden = true;
      button.hidden = true;
      notice.textContent = 'Đang khôi phục đăng nhập của bạn…';
      notice.hidden = false;
      notice.setAttribute('aria-busy', 'true');
      if (badge) badge.textContent = 'Đang xác minh đăng nhập…';
    },
    signedOut() {
      needsLogin = true;
      panel.hidden = false;
      button.hidden = true;
      notice.removeAttribute('aria-busy');
      if (hideOnReady) notice.hidden = true;
      if (badge) badge.textContent = 'Chưa đăng nhập';
    },
    ready() {
      needsLogin = false;
      panel.hidden = true;
      button.hidden = true;
      notice.removeAttribute('aria-busy');
      if (hideOnReady) notice.hidden = true;
    },
    failed(error) {
      needsLogin = error.status === 401;
      panel.hidden = !needsLogin;
      button.hidden = needsLogin;
      notice.removeAttribute('aria-busy');
      notice.hidden = false;
      if (badge) badge.textContent = needsLogin ? 'Chưa đăng nhập' : error.status === 403 ? 'Chưa có quyền truy cập' : 'Chưa xác minh được phiên';
      notice.textContent = error.status === 403
        ? 'Tài khoản đang đăng nhập chưa có quyền truy cập. Hãy liên hệ quản trị viên để kiểm tra quyền.'
        : 'Chưa mở được sản phẩm: ' + error.message;
    }
  };
}
