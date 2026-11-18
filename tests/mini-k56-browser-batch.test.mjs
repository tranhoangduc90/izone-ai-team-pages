import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { selectMiniK56BrowserBatch } from '../term-tests/shared/exam-journal/mini-k56-browser-batch-v1.mjs';
import { ASSETS, ASSET_HASHES } from '../term-tests/mini-test-k56-computer-based/offline-assets-mini-browser-cloud-v1.mjs';

const route = { destination: 'pubsub-v1', pilotId: 'k56-mini-261116' };
const event = length => ({ type: 'audio_observed', data: { action: 'ổ'.repeat(length) } });

test('Mini partitions technical events by byte size before sealing', () => {
  const selection = selectMiniK56BrowserBatch([event(8500), event(8500), event(8500)], route);
  assert.deepEqual(selection, { ...route, count: 2 });
  assert.deepEqual(selectMiniK56BrowserBatch([event(20000), event(1)], route),
    { destination: 'collector-v1', count: 1 });
});

test('Mini preserves content order and the Collector setting', () => {
  const content = { type: 'content_checkpoint', data: { text: 'synthetic response' } };
  assert.deepEqual(selectMiniK56BrowserBatch([event(1), content, event(1)], route), { ...route, count: 1 });
  const collector = { destination: 'collector-v1' };
  assert.deepEqual(selectMiniK56BrowserBatch([content, event(1)], route), { ...collector, count: 1 });
  assert.deepEqual(selectMiniK56BrowserBatch([content, event(1)], collector), { ...collector, count: 2 });
});

test('Mini browser cloud shell pins its journal imports without replacing old assets', async () => {
  const root = new URL('../term-tests/mini-test-k56-computer-based/', import.meta.url);
  assert.equal(ASSETS.includes('index.html'), false);
  for (const name of ['bridge-mini-browser-cloud-v1.mjs', 'transport-mini-browser-cloud-v1.mjs',
    'legacy-drain-mini-browser-cloud-v1.mjs', 'bootstrap-capture.mjs', 'outbox.mjs', 'sealed-batch.mjs']) {
    assert.ok(ASSETS.includes('../shared/exam-journal/' + name), name);
  }
  for (const asset of ASSETS) {
    const raw = await readFile(new URL(asset, root));
    const hash = data => createHash('sha256').update(data).digest('hex');
    const normalized = /\.(mjs|js|html|css|svg)$/.test(asset) ? raw.toString('utf8').replace(/\r\n/g, '\n') : raw;
    assert.ok(hash(raw) === ASSET_HASHES[asset] || hash(normalized) === ASSET_HASHES[asset], asset);
  }
});
