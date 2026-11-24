import assert from 'node:assert/strict';
import test from 'node:test';
import { createOfflineRuntime } from '../term-tests/k56-offline-shared/runtime-pretest-listening-first-frame-v1-recovery-records-v1.mjs';

const { ExamStore } = createOfflineRuntime({ localPrefix: 'pretest:' });

function storeWithCopies(localRecord, indexedRecord) {
  const store = new ExamStore({ local: { getItem: () => JSON.stringify(localRecord) } });
  store.db = { transaction: () => ({ objectStore: () => ({
    get() {
      const request = { result: indexedRecord };
      queueMicrotask(() => request.onsuccess());
      return request;
    }
  }) }) };
  return store;
}

test('opens the latest saved attempt when a journal property was omitted by JSON', async () => {
  const indexedRecord = {
    _revision: 5,
    drafts: { listening: { 1: 'fixture answer' } },
    listeningDiagnostics: [{ action: 'audio_anomaly', previous: [{ command: undefined, positionMs: 530 }] }]
  };
  const localRecord = JSON.parse(JSON.stringify(indexedRecord));
  assert.deepEqual(await storeWithCopies(localRecord,indexedRecord).get('attempt'),localRecord);
});

test('keeps refusing two actual drafts at the same revision', async () => {
  const localRecord = { _revision: 5, drafts: { listening: { 1: 'local answer' } } };
  const indexedRecord = { _revision: 5, drafts: { listening: { 1: 'different answer' } } };
  await assert.rejects(storeWithCopies(localRecord,indexedRecord).get('attempt'), { code: 'LOCAL_REVISION_CONFLICT' });
});
