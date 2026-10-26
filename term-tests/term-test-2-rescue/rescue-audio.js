// Dữ liệu vào: manifest MP3 sau khi API gốc đã kiểm lớp, người, phiên và chủ audio.
// Chỉ chọn nguồn Pages có sẵn; hash/byte, nháp, đồng hồ và các bước nộp giữ nguyên.
// Lỗi quyền API vẫn chặn. Lỗi tải/hash vẫn hiện tại phòng chờ, không tự bắt đầu thi.
(function () {
  'use strict';
  const classCode = new URLSearchParams(location.search).get('class')?.trim().toUpperCase();
  const current = window.K67_PUBLIC_AUDIO;
  if (classCode !== 'IC2213' || window.TERM_TEST_CONFIG?.slug !== 'term-test-2' || !current) {
    window.TERM_TEST_APP_CONFIG = undefined;
    document.getElementById('app').textContent = 'Link dự phòng này dành cho Term Test 2 lớp IC2213. Hãy dùng đúng link giáo viên gửi.';
    return;
  }
  const download = current.download;
  window.K67_PUBLIC_AUDIO = Object.freeze({
    ...current,
    download(manifest, options) {
      const pagesManifest = { ...manifest };
      delete pagesManifest.cloudflare;
      return download(pagesManifest, options);
    }
  });
}());
