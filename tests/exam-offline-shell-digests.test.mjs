import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../term-tests/', import.meta.url);
const textExtensions = /\.(?:js|mjs|html|css|svg)$/i;

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const route = new URL(`${entry.name}/`, root);
  const manifest = new URL('offline-assets.mjs', route);
  if (!existsSync(manifest)) continue;

  test(`${entry.name} offline shell matches its published files`, async () => {
    const { ASSETS, ASSET_HASHES } = await import(manifest.href);
    assert.deepEqual(ASSETS, Object.keys(ASSET_HASHES));
    const mismatches = [];
    for (const asset of ASSETS) {
      const file = new URL(asset, route);
      const bytes = await readFile(file);
      const content = textExtensions.test(file.pathname) ? bytes.toString().replace(/\r\n/g, '\n') : bytes;
      const digest = createHash('sha256').update(content).digest('hex');
      if (digest !== ASSET_HASHES[asset]) mismatches.push(asset);
    }
    assert.deepEqual(mismatches, []);
  });
}
