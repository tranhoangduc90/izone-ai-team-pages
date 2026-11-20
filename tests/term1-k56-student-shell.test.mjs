import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const route = new URL('../term-tests/term-test-1-k56-computer-based/', import.meta.url);
const textAsset = /\.(?:css|html|js|json|mjs|svg)$/i;
const read = name => readFile(new URL(name, route), 'utf8');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('Term 1 K56 student cache does not require teacher sign-in', async () => {
  const index = await read('index.html');
  const bootstrap = index.match(/src="(bootstrap-[^"?]+\.js)\?/)[1];
  const bootstrapSource = await read(bootstrap);
  const workers = [...bootstrapSource.matchAll(/workerPath='\.\/(offline-worker-[^']+)'/g)];
  assert.equal(workers.length, 2);
  const worker = workers[0][1];
  assert.equal(workers[1][1], worker);

  const workerSource = await read(worker);
  const manifest = workerSource.match(/from '\.\/(offline-assets-[^']+)'/)[1];
  const shell = workerSource.match(/from '\.\/(shell-worker-[^']+)'/)[1];
  const { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } = await import(new URL(manifest, route).href);
  assert.ok(!ASSETS.includes('../../shared/teacher-single-sign-on.js'));
  assert.deepEqual(ASSETS, Object.keys(ASSET_HASHES));

  const offlineEntry = (await read(shell)).match(/const entry=legacy\?'index\.html':'([^']+)'/)[1];
  assert.equal(await read(offlineEntry), index);
  for (const entry of [bootstrap, worker, shell, offlineEntry]) assert.ok(ASSETS.includes(entry), entry);
  for (const asset of ASSETS) {
    const bytes = await readFile(new URL(asset, route));
    const deployedBytes = textAsset.test(asset) ? bytes.toString('utf8').replaceAll('\r\n', '\n') : bytes;
    assert.equal(sha256(deployedBytes), ASSET_HASHES[asset], asset);
  }
  assert.equal(sha256(JSON.stringify(ASSET_HASHES)), ASSET_BUILD_ID);
});
