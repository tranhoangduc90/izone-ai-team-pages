import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadResult() {
  const context = { window: {} };
  vm.runInNewContext(
    await readFile(new URL('../term-tests/34-shared/pedagogical-types.js', import.meta.url), 'utf8'),
    context
  );
  vm.runInNewContext(
    await readFile(new URL('../term-tests/34-shared/learning-result.js', import.meta.url), 'utf8'),
    context
  );
  return context.window.WEBTEST34_LEARNING_RESULT;
}

test('groups legacy result codes through the shared section contract', async () => {
  const result = await loadResult();
  const groups = result.groupResultItems({
    blocks: [{ blockId: 'pron-block', title: 'Pronunciation', items: [{ itemVersionId: 'result-item' }] }],
    items: [{ itemVersionId: 'result-item', pedagogicalTypeCode: 'pronunciation_ipa_to_word', maxScore: 1, scoreEarned: 1, verdict: 'correct' }]
  });
  assert.equal(groups[0].items.length, 1);
  assert.equal(groups[0].score, 1);
  assert.equal(groups.incomplete, false);
});

test('marks unmatched result items so the UI cannot present a complete total', async () => {
  const result = await loadResult();
  const groups = result.groupResultItems({
    blocks: [{ blockId: 'vocab-block', title: 'Vocabulary', items: [] }],
    items: [{ itemVersionId: 'orphan', pedagogicalTypeCode: 'translation', maxScore: 4, scoreEarned: 4, verdict: 'correct' }]
  });
  assert.equal(groups.incomplete, true);
  assert.equal(Array.from(groups.unmatchedItems, item => item.itemVersionId).join(','), 'orphan');
});
