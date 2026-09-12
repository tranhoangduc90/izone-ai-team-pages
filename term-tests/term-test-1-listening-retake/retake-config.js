(function () {
  'use strict';

  const baseConfig = window.TERM_TEST_CONFIG;
  if (!baseConfig) return;

  const query = new URLSearchParams(window.location.search);
  const retakeGrant = (query.get('retake') || '').trim();

  function fingerprint(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  window.TERM_TEST_CONFIG = Object.freeze({
    ...baseConfig,
    title: 'Term Test 1 · Thi bù Listening',
    intro: 'Lượt làm riêng phần Listening. Reading và Writing không xuất hiện và không bị thay đổi.'
  });
  window.TERM_TEST_RETAKE_CONFIG = Object.freeze({
    mode: 'listening-only',
    grant: retakeGrant,
    storageScope: retakeGrant
      ? `:listening-retake:${fingerprint(retakeGrant)}`
      : ':listening-retake:missing'
  });
}());
