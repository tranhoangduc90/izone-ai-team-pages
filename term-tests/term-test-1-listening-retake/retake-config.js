(function () {
  'use strict';

  const baseConfig = window.TERM_TEST_CONFIG;
  if (!baseConfig) return;

  window.TERM_TEST_CONFIG = Object.freeze({
    ...baseConfig,
    title: 'Term Test 1 · Thi bù Listening',
    intro: 'Lượt làm riêng phần Listening. Reading và Writing không xuất hiện và không bị thay đổi.'
  });
  window.TERM_TEST_RETAKE_CONFIG = Object.freeze({ mode: 'listening-only' });
}());
