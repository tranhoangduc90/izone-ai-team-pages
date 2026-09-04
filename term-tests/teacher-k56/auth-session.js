/*
 * Nhận mã Google và cấu hình ứng dụng; giữ mã còn hạn trong tab để tải lại trang.
 * Chỉ đọc hạn dùng để tránh gửi mã cũ; máy chủ vẫn xác minh chữ ký và quyền xem lớp.
 * Không lưu kết quả học viên. Nếu trình duyệt chặn lưu, đăng nhập vẫn dùng được
 * nhưng giao diện sẽ báo không thể nhớ phiên sau khi tải lại.
 */
export function tokenExpiresAt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(part => !part)) return 0;
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function createSessionStore({ apiBaseUrl, clientId, getStorage, now = Date.now }) {
  // Tách phiên theo API và ứng dụng Google để không nối nhầm môi trường.
  const key = `term-tests:teacher-session:v1:${apiBaseUrl}:${clientId}`;
  const usable = token => tokenExpiresAt(token) > now() + 10_000;
  const clear = () => {
    try { getStorage().removeItem(key); } catch { /* Bộ nhớ có thể bị trình duyệt chặn. */ }
  };
  return {
    clear,
    usable,
    read() {
      try {
        const token = getStorage().getItem(key) || '';
        if (usable(token)) return token;
      } catch { /* Không đọc được thì để người dùng đăng nhập bình thường. */ }
      clear();
      return '';
    },
    save(token) {
      if (!usable(token)) { clear(); return false; }
      try {
        getStorage().setItem(key, token);
        return true;
      } catch {
        return false;
      }
    }
  };
}
