(function () {
  'use strict';
  // Chỉ xóa bản nháp trên trình duyệt của đúng bài Substitute K67.
  // Quyền và phạm vi DEMO do state.js sở hữu; không gọi API/backend.
  function clear(slug,options) {
    if (!/^substitute-test-[12]-k67$/.test(slug)) throw new Error('INVALID_RESET_SCOPE');
    if(!window.SUBSTITUTE_STATE)throw new Error('RESET_DEMO_ONLY');
    window.SUBSTITUTE_STATE.clear(slug,options);
  }
  window.K67_RESET_STORAGE = Object.freeze({ clear });
}());
