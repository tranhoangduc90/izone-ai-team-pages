(function () {
  'use strict';

  const positionToAnswerKey = new Map();

  function addRange(firstPosition, count, prefix) {
    for (let index = 0; index < count; index += 1) {
      positionToAnswerKey.set(firstPosition + index, `${prefix}_${index + 1}`);
    }
  }

  addRange(1, 25, 'vocab1');
  addRange(26, 25, 'vocab2');
  addRange(51, 5, 'listen_p1');
  addRange(56, 5, 'listen_p2');
  addRange(61, 5, 'listen_p3');
  addRange(66, 10, 'pron_p1');
  addRange(76, 10, 'pron_p2');
  addRange(86, 8, 'translation');
  addRange(94, 3, 'speaking');

  function answerKeyForPosition(position) {
    const answerKey = positionToAnswerKey.get(Number(position));
    if (!answerKey) throw new Error(`WEBTEST34_POSITION_KEY_MISSING: ${position}`);
    return answerKey;
  }

  const typeToAnswerPrefix = Object.freeze([
    ['vocabulary_listen_write', 'vocab1'],
    ['vocabulary_picture_write', 'vocab2'],
    ['listening_order', 'listen_p1'],
    ['listening_choice', 'listen_p1'],
    ['listening_gap', 'listen_p2'],
    ['listening_true_false', 'listen_p3'],
    ['listening_tf', 'listen_p3'],
    ['pronunciation_ipa_to_word', 'pron_p1'],
    ['pronunciation_word_to_ipa', 'pron_p2'],
    ['translation_sentence', 'translation'],
    ['writing_speaking', 'speaking']
  ]);

  function answerPrefixForItem(item) {
    const type = String(item?.pedagogicalTypeCode || '');
    return typeToAnswerPrefix.find(([code]) => type === code)?.[1] || '';
  }

  function buildResponses({ items, blocks, answers }) {
    const blockItems = blocks?.length
      ? blocks.flatMap(block => (block.items || []).map(item => ({ item, block })))
      : [...(items || [])].sort((left, right) => Number(left.position) - Number(right.position)).map(item => ({ item }));
    const typeOrdinals = new Map();
    return Object.fromEntries(blockItems.map(({ item }) => {
      const prefix = answerPrefixForItem(item);
      const ordinal = (typeOrdinals.get(prefix) || 0) + 1;
      if (prefix) typeOrdinals.set(prefix, ordinal);
      const answerKey = prefix ? `${prefix}_${ordinal}` : answerKeyForPosition(item.position);
      return [item.itemVersionId, String(answers?.[answerKey] ?? '')];
    }));
  }

  window.WEBTEST34_LEARNING_KEY_MAP = Object.freeze({ answerKeyForPosition, answerPrefixForItem, buildResponses });
}());
