// Verify the packaging boundary with both Windows and Git line endings.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const newline of ['\n','\r\n'])test('startup bundle replaces old observer exactly once with '+JSON.stringify(newline),()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'journal-bundle-'));
 try{
  fs.mkdirSync(path.join(temp,'tools'));fs.copyFileSync(path.join(root,'tools/build-exam-journal-startup.mjs'),path.join(temp,'tools/build-exam-journal-startup.mjs'));
  const shared=path.join(temp,'term-tests/shared/exam-journal');fs.mkdirSync(shared,{recursive:true});fs.writeFileSync(path.join(shared,'lobby-capture.js'),'// NEW OBSERVER\n');
  const targets=['term-test-1','term-test-2','mini-test-lesson-5','term-test-1-k56','term-test-2-k56','mini-test-k56','substitute-test-1-k67','substitute-test-2-k67','substitute-test-1-k56','substitute-test-2-k56'];
  for(const slug of targets){const dir=path.join(temp,'term-tests',slug);fs.mkdirSync(dir,{recursive:true});
   fs.writeFileSync(path.join(dir,'test-config.js'),['const nativeDefinition = "unchanged";','// BEGIN GENERATED EXAM JOURNAL STARTUP v1','// OLD OBSERVER','// END GENERATED EXAM JOURNAL STARTUP v1',''].join(newline));}
  const tool=path.join(temp,'tools/build-exam-journal-startup.mjs');execFileSync(process.execPath,[tool,'--write']);
  const once=fs.readFileSync(path.join(temp,'term-tests/term-test-2/test-config.js'),'utf8');
  execFileSync(process.execPath,[tool,'--write']);assert.equal(fs.readFileSync(path.join(temp,'term-tests/term-test-2/test-config.js'),'utf8'),once);
  assert.equal(once.split('BEGIN GENERATED').length-1,1);assert.ok(!once.includes('OLD OBSERVER'));
  assert.ok(once.startsWith('const nativeDefinition = "unchanged";'+newline));execFileSync(process.execPath,[tool,'--check']);
 }finally{fs.rmSync(temp,{recursive:true});}
});
