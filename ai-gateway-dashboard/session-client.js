/*
 * Dữ liệu nhận vào: Google credential một lần và các yêu cầu API của dashboard.
 * Việc chính: đổi credential lấy cookie HttpOnly, gửi cookie tự động và gắn CSRF cho thao tác ghi.
 * Kết quả: phiên được khôi phục sau reload/tab mới mà JavaScript không giữ token bí mật.
 * Khi lỗi: trả mã lỗi ngắn để app hiện thông báo và quay về nút đăng nhập khi cần.
 */
(function exposeSessionClient(global) {
  class SessionClientError extends Error {
    constructor(message, status, code) {
      super(message);
      this.name = 'SessionClientError';
      this.status = status;
      this.code = code;
    }
  }

  function create({ baseUrl, fetchImpl = global.fetch.bind(global) }) {
    const root = String(baseUrl || '').replace(/\/$/, '');

    async function request(path, { method = 'GET', headers = {}, body } = {}) {
      const normalizedMethod = method.toUpperCase();
      const requestHeaders = { ...headers };
      if (!['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) requestHeaders['x-izone-csrf'] = '1';
      if (body !== undefined) requestHeaders['content-type'] = 'application/json';
      return fetchImpl(`${root}${path}`, {
        method: normalizedMethod,
        credentials: 'include',
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    async function payloadOrError(response) {
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new SessionClientError(
          payload?.error?.message || `API trả về mã ${response.status}.`,
          response.status,
          payload?.error?.code || '',
        );
      }
      return payload;
    }

    return Object.freeze({
      request,
      async login(credential) {
        return payloadOrError(await request('/auth/session', { method: 'POST', body: { credential } }));
      },
      async restore() {
        const response = await request('/auth/session');
        if (response.status === 401) return null;
        return payloadOrError(response);
      },
      async logout() {
        const response = await request('/auth/session', { method: 'DELETE' });
        if (response.status === 204) return;
        await payloadOrError(response);
      },
    });
  }

  global.AIGatewaySessionClient = Object.freeze({ create, SessionClientError });
}(window));
