(function () {
  'use strict';
  const transportUrl = new URL('../../shared/audio/transport.mjs?v=20261023-cf512-1', document.currentScript.src).href;

  // Dữ liệu vào: đường dẫn audio, hàm nhận tiến độ và tín hiệu hủy khi học viên thử lại.
  // Việc chính: đọc toàn bộ các khối dữ liệu từ mạng rồi mới ghép thành một Blob trong máy.
  // Kết quả: chỉ trả file audio sau khi tải đủ; giao diện dựa vào đó mới mở khóa bài Listening.
  // Khi lỗi: ném lỗi cho giao diện giữ bài bị khóa và hiện nút tải lại.
  async function downloadAudio(source, options = {}) {
    // The legacy encrypted /session URL is deliberately outside the public catalog.
    const {downloadSubstitute} = await import(transportUrl);
    const preferred = await downloadSubstitute(source, options);
    if (preferred) return preferred;
    const fetchImpl = options.fetchImpl || window.fetch.bind(window);
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    const response = await fetchImpl(source, {
      cache: 'force-cache',
      signal: options.signal
    });
    if (!response.ok) throw new Error('AUDIO_HTTP_' + response.status);

    const contentType = response.headers?.get?.('content-type') || 'audio/mpeg';
    const declaredTotal = Number(response.headers?.get?.('content-length')) || 0;
    if (!response.body?.getReader) {
      const blob = await response.blob();
      if (!blob.size) throw new Error('AUDIO_EMPTY');
      onProgress({ loaded: blob.size, total: blob.size, complete: true });
      return blob;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress({ loaded, total: declaredTotal, complete: false });
    }
    if (!loaded) throw new Error('AUDIO_EMPTY');
    const blob = new Blob(chunks, { type: contentType });
    onProgress({ loaded, total: Math.max(declaredTotal, loaded), complete: true });
    return blob;
  }

  window.TERM_TEST_AUDIO_LOADER = { downloadAudio };
}());
