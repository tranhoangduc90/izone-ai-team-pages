/* Phiếu và Hành trình đọc cùng dữ liệu đang diễn trong tab giảng viên. */
(() => {
  if (parent === window || !parent.presentationData) {
    location.replace(window.progressPresentation.base);
    return;
  }
  window.PROGRESS_LOG_CONFIG = {
    API_BASE_URL: location.origin,
    THUY_PILOT_CLASS_IDS: ['9041'],
  };
  const request = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (url.origin !== location.origin) throw new Error('Địa chỉ ngoài phiên trình chiếu.');
    if (url.pathname.startsWith('/api/')) return parent.presentationRequest(url.href, options);
    return request(input, options);
  };
})();
