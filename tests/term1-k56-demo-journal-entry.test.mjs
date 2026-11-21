import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { ASSETS, ASSET_HASHES } from '../term-tests/term-test-1-k56-computer-based/demo-journal-v1/offline-assets.mjs';

const root = new URL('../term-tests/term-test-1-k56-computer-based/', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');

test('lối DEMO giữ riêng quyền, địa chỉ Worker và thư mục cache', async () => {
  const [html, bootstrap, worker, imagePreparation] = await Promise.all([
    read('demo-journal-v1/index.html'),
    read('bootstrap-term1-demo-journal-v1.js'),
    read('demo-journal-v1/offline-worker.js'),
    read('demo-journal-v1/listening-preparation.mjs'),
  ]);
  const published = new URL('https://example.test/term-tests/term-test-1-k56-computer-based/demo-journal-v1/');
  const baseURI = new URL(html.match(/<base href="([^"]+)"/)[1], published).href;
  const destinations = [];
  const search = '?class=IC5601&mode=read_first';
  await runInNewContext(bootstrap, {
    window: { location: { search } },
    document: { baseURI, getElementById: () => ({}) },
    location: { search, hash: '#resume', replace: url => destinations.push(url) },
    URL, URLSearchParams,
  });
  assert.deepEqual(destinations, [baseURI + 'index.html' + search + '#resume']);
  assert.match(html, /izone-journal-prod-261116-k56-term1-cbt-demo-ingress\.tranhoangduc90\.workers\.dev/);
  assert.match(worker, /target\.pathname\.startsWith\(scope\.pathname\)/);
  assert.match(imagePreparation, /new URL\(source\|\|'',document\.baseURI\)/);
});

test('manifest DEMO ghim đủ tài nguyên để mở lại bài offline', async () => {
  const names = new Set(ASSETS);
  assert.equal(names.size, ASSETS.length);
  assert.deepEqual(names, new Set(Object.keys(ASSET_HASHES)));
  for (const file of ASSETS) {
    let bytes = await readFile(new URL(file, root));
    if (/\.(?:html|js|mjs|css|svg)$/.test(file)) {
      bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    }
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ASSET_HASHES[file], file);
  }
});
