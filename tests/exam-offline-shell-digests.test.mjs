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

test('Pretest K67 paper installs the active student cache without teacher SSO', async () => {
  const route = new URL('pretest-lesson-16/', root);
  const name = 'offline-assets-student-cache-v3.mjs';
  const worker = await readFile(new URL('offline-worker-audio-status-v2.js', route), 'utf8');
  assert.ok(worker.includes(`'./${name}'`));
  const { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } = await import(new URL(name, route).href);
  assert.deepEqual(ASSETS, Object.keys(ASSET_HASHES));
  assert.ok(!ASSETS.includes('../../shared/teacher-single-sign-on.js'));
  assert.deepEqual(await assetMismatches(route, ASSETS, ASSET_HASHES), []);
  const sorted = Object.fromEntries(ASSETS.toSorted().map(asset => [asset, ASSET_HASHES[asset]]));
  assert.equal(ASSET_BUILD_ID, createHash('sha256').update(JSON.stringify(sorted)).digest('hex'));
});

test('Mini K67 keeps the v2 shell and installs the v3 receipt journal shell', async () => {
  const route = new URL('mini-test-lesson-5-computer-based/', root);
  for (const version of ['v2', 'v3']) {
    const name = `offline-assets-mini-student-cache-${version}.mjs`;
    const worker = await readFile(new URL(`offline-worker-mini-student-cache-${version}.js`, route), 'utf8');
    assert.ok(worker.includes(`'./${name}'`));
    const { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } = await import(new URL(name, route).href);
    assert.deepEqual(ASSETS, Object.keys(ASSET_HASHES));
    assert.deepEqual(await assetMismatches(route, ASSETS, ASSET_HASHES), []);
    assert.equal(ASSET_BUILD_ID, createHash('sha256').update(JSON.stringify(ASSET_HASHES)).digest('hex'));
  }
  const publicEntry = await readFile(new URL('index.html', route), 'utf8');
  const offlineEntry = await readFile(new URL('index-mini-student-cache-v3.html', route), 'utf8');
  for (const html of [publicEntry, offlineEntry]) {
    assert.ok(html.includes('bootstrap-mini-k67-student-cache-v3.js'));
  }
});

test('Mini K67 paper keeps its v2 shell and pins the v3 journal dependencies', async () => {
  const route = new URL('mini-test-lesson-5/', root);
  const worker = await readFile(new URL('offline-worker.js', route), 'utf8');
  assert.ok(worker.includes("'./offline-assets-student-cache-v3.mjs'"));
  const previous = await import(new URL('offline-assets-student-cache-v2.mjs', route).href);
  const current = await import(new URL('offline-assets-student-cache-v3.mjs', route).href);
  assert.deepEqual(current.ASSETS, Object.keys(current.ASSET_HASHES));
  for(const asset of previous.ASSETS) assert.equal(current.ASSET_HASHES[asset], previous.ASSET_HASHES[asset], asset);
  assert.deepEqual(await assetMismatches(route, current.ASSETS, current.ASSET_HASHES), []);
  assert.equal(current.ASSET_BUILD_ID, createHash('sha256').update(JSON.stringify(current.ASSET_HASHES)).digest('hex'));
  assert.equal(await readFile(new URL('index.html', route), 'utf8'),
    await readFile(new URL('index-student-cache-v3.html', route), 'utf8'));
  assert.ok(current.ASSETS.includes('../shared/exam-journal/bridge-mini-k67-paper-browser-cloud-v2.mjs'));
});

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const route = new URL(`${entry.name}/`, root);
  const manifest = new URL('offline-assets.mjs', route);
  if (existsSync(manifest)) test(`${entry.name} offline shell matches its published files`, async () => {
    const { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } = await import(manifest.href);
    assert.deepEqual(ASSETS, Object.keys(ASSET_HASHES));
    const sorted = Object.fromEntries(Object.keys(ASSET_HASHES).sort().map(name => [name, ASSET_HASHES[name]]));
    assert.equal(ASSET_BUILD_ID, createHash('sha256').update(JSON.stringify(sorted)).digest('hex'));
    assert.deepEqual(await assetMismatches(route, ASSETS, ASSET_HASHES), []);
  });

  const versionedManifests = k56RecoveryRoutes.has(entry.name) ? [...k56RecoveryManifests] : [];
  if (entry.name === 'term-test-1') versionedManifests.push('offline-assets-parallel-v1.mjs');
  if (['term-test-1-computer-based', 'term-test-2-computer-based'].includes(entry.name)) {
    versionedManifests.push('offline-assets-listening-first-frame-v1.mjs', 'offline-assets-parallel-v1.mjs');
  }
  if (entry.name === 'term-test-2-computer-based') versionedManifests.push('offline-assets-browser-cloud-v1.mjs');
  if (entry.name === 'term-test-2-k56-computer-based') versionedManifests.push('offline-assets-listening-report-v2.mjs');
  if (['mini-test-lesson-5-computer-based', 'pretest-lesson-16-computer-based'].includes(entry.name)) {
    versionedManifests.push('offline-assets-audio-report-v1.mjs');
  }
  for (const name of versionedManifests) {
    test(`${entry.name} ${name} matches its published files`, async () => {
      const workerName = entry.name === 'term-test-1' ? 'offline-worker.js' : name.replace('assets-', 'worker-').replace('.mjs', '.js');
      const worker = await readFile(new URL(workerName, route), 'utf8');
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
