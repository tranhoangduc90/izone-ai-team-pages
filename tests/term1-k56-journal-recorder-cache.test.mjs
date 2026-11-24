import assert from 'node:assert/strict';
import test from 'node:test';
import {journalRecorderCache} from '../term-tests/term-test-1-k56-computer-based/journal-recorder-cache-v1.mjs';

const canonical='../shared/exam-journal/recorder.mjs';
const alternate='../shared/exam-journal/recorder-term1-k56-fallback-v1.mjs';
const app='index.html';
const url=asset=>new URL(asset,'https://exam.test/term-tests/term1/').href;
const expected='Verified recorder test bytes.';

function setup(t, bodies) {
  const responses=[], saved=new Map();
  t.mock.method(globalThis, 'fetch', async request => {
    assert.equal(request.searchParams.get('examBuild'), 'fixture');
    const name=request.pathname.split('/').at(-1);
    responses.push(name);
    const value=bodies.get(name);
    return new Response(value, {status:value===undefined?503:200});
  });
  const verify=async (response, asset) => {
    assert.equal(asset, canonical);
    assert.equal(response.ok, true);
    assert.equal(await response.clone().text(), expected);
  };
  const recorder=journalRecorderCache({assets:[app,canonical,alternate],assetBuildId:'fixture',url,verify});
  return {recorder, responses, saved, cache:{put:async (key,response)=>saved.set(key,await response.text())}};
}

test('a verified fallback serves the missing canonical recorder', async t => {
  const {recorder,responses,saved,cache}=setup(t,new Map([[alternate.split('/').at(-1),expected]]));
  assert.deepEqual(recorder.requiredAssets,[app]);
  assert.equal(recorder.handles(new URL(url(canonical)).pathname),true);
  assert.equal(recorder.handles(new URL(url(app)).pathname),false);
  assert.equal(await (await recorder.get(cache)).text(),expected);
  assert.deepEqual(responses,[canonical,alternate].map(asset=>asset.split('/').at(-1)));
  assert.equal(saved.get(url(canonical)),expected);
});

test('a missing or mismatched recorder does not make core assets optional', async t => {
  const {recorder,saved,cache}=setup(t,new Map([[alternate.split('/').at(-1),'wrong bytes']]));
  assert.equal(await recorder.get(cache),null);
  assert.equal(saved.size,0);
  assert.deepEqual(recorder.requiredAssets,[app]);
});
