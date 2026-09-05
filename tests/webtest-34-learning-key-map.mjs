import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const mapPath = new URL('../term-tests/34-shared/learning-key-map.js', import.meta.url);

async function loadKeyMap() {
  const source = await readFile(mapPath, 'utf8');
  const context = { window: {} };
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
