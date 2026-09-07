(function () {
  'use strict';

  const contract = window.WEBTEST34_PEDAGOGICAL_TYPES;
  if (!contract) throw new Error('WEBTEST34_PEDAGOGICAL_TYPES_MISSING');

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

  function answerPrefixForItem(item) {
    return contract.resolvePedagogicalType(item?.pedagogicalTypeCode).answerPrefix;
  }

  function buildResponses({ items, blocks, answers }) {
    const blockItems = blocks?.length
      ? blocks.flatMap(block => (block.items || []).map(item => ({ item, block })))
      : [...(items || [])].sort((left, right) => Number(left.position) - Number(right.position)).map(item => ({ item }));
    const typedItems = blockItems.filter(({ item }) => String(item?.pedagogicalTypeCode || ''));
    if (typedItems.length && typedItems.length !== blockItems.length) {
      throw new Error('WEBTEST34_PEDAGOGICAL_TYPE_MIXED: items must all include a pedagogicalTypeCode or all omit it');
    }
    const typeOrdinals = new Map();
    const answerKeys = new Set();
    const itemIds = new Set();
    return Object.fromEntries(blockItems.map(({ item }) => {
      if (!item?.itemVersionId) throw new Error('WEBTEST34_ITEM_ID_MISSING');
      if (itemIds.has(item.itemVersionId)) throw new Error(`WEBTEST34_ITEM_ID_DUPLICATE: ${item.itemVersionId}`);
      itemIds.add(item.itemVersionId);
      const prefix = typedItems.length ? answerPrefixForItem(item) : '';
      const ordinal = (typeOrdinals.get(prefix) || 0) + 1;
      if (prefix) typeOrdinals.set(prefix, ordinal);
      const answerKey = prefix ? `${prefix}_${ordinal}` : answerKeyForPosition(item.position);
      if (answerKeys.has(answerKey)) throw new Error(`WEBTEST34_ANSWER_KEY_DUPLICATE: ${answerKey}`);
      answerKeys.add(answerKey);
      return [item.itemVersionId, String(answers?.[answerKey] ?? '')];
    }));
  }

  window.WEBTEST34_LEARNING_KEY_MAP = Object.freeze({ answerKeyForPosition, answerPrefixForItem, buildResponses, resolvePedagogicalType: contract.resolvePedagogicalType });
}());
