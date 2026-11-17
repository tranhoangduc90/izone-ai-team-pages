import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const route=new URL('../term-tests/term-test-2-k56-computer-based/',import.meta.url);
const file=process.env.K56_TERM2_SHELL_BASELINE==='1'?'offline-assets-listening-report-v2.mjs':'offline-assets-listening-report-v3.mjs';
test('Term2 K56 current shell dependency graph matches the published LF bytes',async()=>{
 const {ASSETS,ASSET_HASHES,ASSET_BUILD_ID}=await import(new URL(file,route));
 const failures=[];
 for(const name of ASSETS){const bytes=await readFile(new URL(name,route));const value=/\.(png|woff2)$/.test(name)?bytes:bytes.toString().replace(/\r\n/g,'\n');
  if(createHash('sha256').update(value).digest('hex')!==ASSET_HASHES[name])failures.push(name);}
 assert.deepEqual(failures,[]);
 assert.equal(createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.keys(ASSET_HASHES).sort().map(key=>[key,ASSET_HASHES[key]])))).digest('hex'),ASSET_BUILD_ID);
 assert.equal(ASSETS.includes('index.html'),false);
});
