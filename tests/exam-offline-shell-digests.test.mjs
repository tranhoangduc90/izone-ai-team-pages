import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../term-tests/', import.meta.url);
const textExtensions = /\.(?:js|mjs|html|css|svg|json|txt)$/i;
const k56RecoveryRoutes = new Set(['term-test-1-k56-computer-based', 'term-test-2-k56-computer-based']);
const k56RecoveryManifests = ['offline-assets-listening-first-frame-v1.mjs', 'offline-assets-submission-recovery-v1.mjs'];

async function assetMismatches(route, assets, hashes) {
  const mismatches = [];
  for (const asset of assets) {
    const file = new URL(asset, route);
    const bytes = await readFile(file);
    const content = textExtensions.test(file.pathname) ? bytes.toString().replace(/\r\n/g, '\n') : bytes;
    const digest = createHash('sha256').update(content).digest('hex');
    if (digest !== hashes[asset]) mismatches.push(asset);
  }
  return mismatches;
}

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const route = new URL(`${entry.name}/`, root);
  const manifest = new URL('offline-assets.mjs', route);
  if (!existsSync(manifest)) continue;

  test(`${entry.name} offline shell matches its published files`, async () => {
    const { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } = await import(manifest.href);
    assert.deepEqual(ASSETS, Object.keys(ASSET_HASHES));
    const sorted = Object.fromEntries(Object.keys(ASSET_HASHES).sort().map(name => [name, ASSET_HASHES[name]]));
    assert.equal(ASSET_BUILD_ID, createHash('sha256').update(JSON.stringify(sorted)).digest('hex'));
    assert.deepEqual(await assetMismatches(route, ASSETS, ASSET_HASHES), []);
  });

  const versionedManifests = k56RecoveryRoutes.has(entry.name) ? [...k56RecoveryManifests] : [];
  if (['term-test-1-computer-based', 'term-test-2-computer-based'].includes(entry.name)) {
    versionedManifests.push('offline-assets-listening-first-frame-v1.mjs', 'offline-assets-parallel-v1.mjs');
  }
  if (entry.name === 'term-test-2-computer-based') versionedManifests.push('offline-assets-browser-cloud-v1.mjs');
  if (entry.name === 'term-test-2-k56-computer-based') versionedManifests.push('offline-assets-listening-report-v2.mjs');
  for (const name of versionedManifests) {
    test(`${entry.name} ${name} matches its published files`, async () => {
      const worker = await readFile(new URL(name.replace('assets-', 'worker-').replace('.mjs', '.js'), route), 'utf8');
      assert.ok(worker.includes(`'./${name}'`));
      const { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } = await import(new URL(name, route).href);
      assert.deepEqual(ASSETS, Object.keys(ASSET_HASHES));
      assert.deepEqual(await assetMismatches(route, ASSETS, ASSET_HASHES), []);
      // Term 2's Listening manifest builder hashes the original ordered entries.
      const entries = entry.name === 'term-test-2-k56-computer-based' && name.includes('listening-first-frame')
        ? Object.entries(ASSET_HASHES)
        : Object.fromEntries(Object.keys(ASSET_HASHES).sort().map(asset => [asset, ASSET_HASHES[asset]]));
      assert.equal(ASSET_BUILD_ID, createHash('sha256').update(JSON.stringify(entries)).digest('hex'));
    });
  }
}
