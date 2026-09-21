(function () {
  'use strict';

  // Dữ liệu vào: đường dẫn audio, hàm nhận tiến độ và tín hiệu hủy khi học viên thử lại.
  // Việc chính: đọc toàn bộ các khối dữ liệu từ mạng rồi mới ghép thành một Blob trong máy.
  // Kết quả: chỉ trả file audio sau khi tải đủ; giao diện dựa vào đó mới mở khóa bài Listening.
  // Khi lỗi: ném lỗi cho giao diện giữ bài bị khóa và hiện nút tải lại.
  async function downloadAudio(source, options = {}) {
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
