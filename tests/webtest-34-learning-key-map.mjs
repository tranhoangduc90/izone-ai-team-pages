import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const mapPath = new URL('../term-tests/34-shared/learning-key-map.js', import.meta.url);
const contractPath = new URL('../term-tests/34-shared/pedagogical-types.js', import.meta.url);

async function loadKeyMap() {
  const source = await readFile(mapPath, 'utf8');
  const context = { window: {} };
  vm.runInNewContext(await readFile(contractPath, 'utf8'), context, { filename: contractPath.pathname });
  vm.runInNewContext(source, context, { filename: mapPath.pathname });
  return context.window.WEBTEST34_LEARNING_KEY_MAP;
}

test('maps every canonical Webtest 34 position to the frontend answer key', async () => {
  const keyMap = await loadKeyMap();
  assert.deepEqual(
    [1, 26, 50, 51, 56, 61, 66, 76, 86, 94, 96].map(position => keyMap.answerKeyForPosition(position)),
    ['vocab1_1', 'vocab2_1', 'vocab2_25', 'listen_p1_1', 'listen_p2_1', 'listen_p3_1', 'pron_p1_1', 'pron_p2_1', 'translation_1', 'speaking_1', 'speaking_3']
  );
});

test('builds responses by stable position even when assignment items are shuffled', async () => {
  const keyMap = await loadKeyMap();
  const responses = keyMap.buildResponses({
    items: [
      { position: 61, itemVersionId: 'tf-item' },
      { position: 51, itemVersionId: 'order-item' }
    ],
    answers: { listen_p1_1: 'A', listen_p3_1: 'T' }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(responses)), { 'order-item': 'A', 'tf-item': 'T' });
});

test('resolves canonical and legacy pedagogical codes through one shared contract', async () => {
  const keyMap = await loadKeyMap();
  const expected = [
    ['vocabulary_listen_write', 'vocab1', 'vocabulary'],
    ['vocabulary_picture_write', 'vocab2', 'vocabulary'],
    ['listening_order', 'listen_p1', 'listening'],
    ['listening_choice', 'listen_p1', 'listening'],
    ['listening_gap', 'listen_p2', 'listening'],
    ['listening_true_false', 'listen_p3', 'listening'],
    ['listening_tf', 'listen_p3', 'listening'],
    ['pronunciation_word', 'pron_p1', 'pronunciation'],
    ['pronunciation_ipa_to_word', 'pron_p1', 'pronunciation'],
    ['pronunciation_choice', 'pron_p2', 'pronunciation'],
    ['pronunciation_word_to_ipa', 'pron_p2', 'pronunciation'],
    ['translation', 'translation', 'translation'],
    ['translation_sentence', 'translation', 'translation'],
    ['speaking', 'speaking', 'speaking'],
    ['writing_speaking', 'speaking', 'speaking']
  ];
  for (const [code, answerPrefix, sectionId] of expected) {
    const metadata = keyMap.resolvePedagogicalType(code);
    assert.deepEqual(
      JSON.parse(JSON.stringify(metadata)),
      { canonicalCode: metadata.canonicalCode, aliases: [...metadata.aliases], answerPrefix, sectionId }
    );
  }
  assert.throws(
    () => keyMap.resolvePedagogicalType('unknown_type'),
    /WEBTEST34_PEDAGOGICAL_TYPE_UNSUPPORTED/
  );
});

test('uses one ordinal sequence when canonical and legacy codes are mixed', async () => {
  const keyMap = await loadKeyMap();
  const responses = keyMap.buildResponses({
    items: [
      { position: 66, pedagogicalTypeCode: 'pronunciation_word', itemVersionId: 'canonical-item' },
      { position: 67, pedagogicalTypeCode: 'pronunciation_ipa_to_word', itemVersionId: 'legacy-item' }
    ],
    answers: { pron_p1_1: 'FIRST', pron_p1_2: 'SECOND' }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(responses)), {
    'canonical-item': 'FIRST',
    'legacy-item': 'SECOND'
  });
});

test('rejects unknown or mixed missing pedagogical codes instead of falling back silently', async () => {
  const keyMap = await loadKeyMap();
  assert.throws(
    () => keyMap.buildResponses({
      items: [{ position: 66, pedagogicalTypeCode: 'new_code', itemVersionId: 'unknown-item' }],
      answers: { pron_p1_1: 'answer' }
    }),
    /WEBTEST34_PEDAGOGICAL_TYPE_UNSUPPORTED/
  );
  assert.throws(
    () => keyMap.buildResponses({
      items: [
        { position: 66, itemVersionId: 'missing-code' },
        { position: 67, pedagogicalTypeCode: 'pronunciation_word', itemVersionId: 'typed-item' }
      ],
      answers: { pron_p1_1: 'answer' }
    }),
    /WEBTEST34_PEDAGOGICAL_TYPE_MIXED/
  );
  assert.throws(
    () => keyMap.buildResponses({
      items: [
        { position: 66, itemVersionId: 'duplicate-item' },
        { position: 67, itemVersionId: 'duplicate-item' }
      ],
      answers: { pron_p1_1: 'one', pron_p1_2: 'two' }
    }),
    /WEBTEST34_ITEM_ID_DUPLICATE/
  );
});
