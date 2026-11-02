import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
const base=new URL('../term-tests/shared/exam-journal/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('SDK_MANIFEST.json',base)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the exact SDK assets and all direct module imports use one package revision',()=>{
 assert.equal(manifest.version,1);assert.equal(manifest.kind,'exam-journal-browser-sdk');
 assert.equal(manifest.productionEnabled,false);assert.equal(manifest.hostEntryRevisionRequired,true);
 assert.equal(Object.keys(manifest.assets).length,8);
 for(const [name,asset]of Object.entries(manifest.assets)){
  const raw=fs.readFileSync(new URL(name,base));assert.equal(raw.length,asset.bytes,name);assert.equal(hash(raw),asset.sha256,name);
  const text=raw.toString('utf8');
  for(const match of text.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)(['"])([^'"]+)\1/g)){
   const url=new URL(match[2],base);assert.equal(url.search,'?ej='+manifest.revision,name);
   assert.ok(asset.dependencies.includes(url.pathname.split('/').at(-1)),name);
  }
 }
 const source=JSON.parse(fs.readFileSync(new URL('SOURCE.json',base)));
 assert.equal(source.release,manifest.revision);
 for(const entry of source.files){assert.equal(entry.sha256,manifest.assets[entry.file].sha256);}
});

test('audio hosts preserve optional capture and point to the same bootstrap revision',()=>{
 const files=['../shared/public-audio.mjs','../shared/audio/transport.mjs','../term-tests/k67-shared/public-audio.js',
  ...['term-test-2','term-test-1-k56','term-test-2-k56','mini-test-k56','substitute-test-1-k56','substitute-test-2-k56',
   'substitute-test-1-k67','substitute-test-2-k67'].map(slug=>'../term-tests/'+slug+'-computer-based/audio-loader.js')];
 for(const file of files){
  const text=fs.readFileSync(new URL(file,import.meta.url),'utf8');
  assert.match(text,/EXAM_JOURNAL_ENABLED!==true/);
  const capture=text.match(/['"]([^'"]*exam-journal\/bootstrap-capture\.mjs\?[^'"]+)['"]/);
  assert.ok(capture,file);assert.equal(new URL(capture[1],'https://fixture.invalid/').search,'?ej='+manifest.revision,file);
  assert.match(text,/void import\(bootstrapUrl\)/);
 }
});

test('a Windows-style Git checkout preserves every emitted SDK hash',()=>{
 const directory=fs.mkdtempSync(path.join(tmpdir(),'journal-sdk-git-')),checkout=path.join(directory,'checkout');
 const git=(...args)=>execFileSync('git',['-c','core.autocrlf=true',...args],{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const names=['.gitattributes','SDK_MANIFEST.json','SOURCE.json',...Object.keys(manifest.assets)];
 for(const name of names)fs.copyFileSync(new URL(name,base),path.join(directory,name));
 git('init','--quiet');git('add','--',...names);
 git('checkout-index','--all','--prefix='+checkout.replaceAll('\\','/')+'/');
 const copied=JSON.parse(fs.readFileSync(path.join(checkout,'SDK_MANIFEST.json')));
 assert.deepEqual(copied,manifest);
 for(const [name,asset]of Object.entries(manifest.assets)){
  const raw=fs.readFileSync(path.join(checkout,name));assert.equal(raw.length,asset.bytes,name);assert.equal(hash(raw),asset.sha256,name);
 }
 // Keep this tiny owned fixture for diagnostics; no remote or commits are made.
});
