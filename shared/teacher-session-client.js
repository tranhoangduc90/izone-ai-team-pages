/*
 * Nhận vào: địa chỉ API, Google credential ở lần đăng nhập và tùy chọn fetch của dashboard.
 * Việc làm: đổi Google credential lấy cookie HttpOnly, gửi cookie ở các request sau và thêm cổng chống CSRF khi ghi dữ liệu.
 * Kết quả: JavaScript không giữ token đăng nhập; tải lại trang vẫn khôi phục được phiên từ máy chủ.
 * Khi lỗi: trả lỗi có status để giao diện phân biệt hết phiên, thiếu quyền và lỗi mạng.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function joinUrl(base, path) {
  return `${String(base || '').replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || data.error || `API trả về mã ${response.status}.`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function teacherSessionRequestOptions(options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!SAFE_METHODS.has(method)) headers.set('x-izone-csrf', '1');
  return { ...options, method, headers, credentials: 'include' };
}

export function createTeacherSessionClient({ apiBaseUrl, sessionPath }) {
  const url = joinUrl(apiBaseUrl, sessionPath);
  return {
    async login(credential) {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credential })
      });
      return parseResponse(response);
    },
    async restore() {
      const response = await fetch(url, { method: 'GET', credentials: 'include', cache: 'no-store' });
      if (response.status === 401) return null;
      return parseResponse(response);
    },
    async logout() {
      const response = await fetch(url, teacherSessionRequestOptions({ method: 'DELETE' }));
      if (response.status === 401) return { ok: true };
      return parseResponse(response);
    }
  };
}
