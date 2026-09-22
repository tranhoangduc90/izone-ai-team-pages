(function () {
  'use strict';
  // Chỉ xóa bản nháp trên trình duyệt của đúng bài Substitute K67.
  // Không phụ thuộc mã lớp hoặc hậu tố phiên bản; không gọi API/backend.
  function clear(slug) {
    if (!/^substitute-test-[12]-k67$/.test(slug)) throw new Error('INVALID_RESET_SCOPE');
    const prefixes = ['izone-test:', 'izone-test-ui:', 'izone-test-annotations:']
      .map(prefix => prefix + slug + ':');
    for (const storage of [sessionStorage, localStorage]) {
      const keys = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && prefixes.some(prefix => key.startsWith(prefix))) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
      if (keys.some(key => storage.getItem(key) !== null)) throw new Error('STORAGE_NOT_CLEARED');
    }
  }
  window.K67_RESET_STORAGE = Object.freeze({ clear });
}());
