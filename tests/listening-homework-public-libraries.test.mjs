import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {ASSETS} from '../shared/audio/catalog.mjs';
import {createHash} from 'node:crypto';
const content=JSON.parse(await fs.readFile(new URL('../listening-homework/paper-on-public-libraries-content.json',import.meta.url),'utf8'));
test('Public Libraries keeps every source exercise and a distinct item identity',()=>{
 assert.equal(content.code,'67-listening-paper-on-public-libraries');
 assert.equal(content.items.length,16);
 assert.equal(new Set(content.items.map(i=>i.id)).size,16);
 assert.deepEqual(content.chapters.map(c=>c.ids.length),[7,6,3]);
 assert.deepEqual(content.chapters.flatMap(c=>c.ids),content.items.map(i=>i.id));
 assert.equal(Math.ceil(content.items.length*content.minimumCompletion),13);
 const blanks=content.dictation.flatMap(l=>l.parts).filter(p=>typeof p==='object');
 assert.deepEqual(blanks.map(p=>p.id),content.items.filter(i=>i.group==='dictation').map(i=>i.id));
 assert.equal(blanks.find(p=>p.id==='D4').words,5);
 for(const item of content.items){
  for(const key of ['answer','acceptedAnswers','units','core','accept','reject'])assert.equal(item[key],undefined);
  for(const cue of Object.values(item.evidenceContext))assert.ok(content.transcript.some(t=>t.id===cue));
 }
});
test('Public Libraries audio matches the immutable asset and every cue stays inside the exercise',async()=>{
 const asset=ASSETS[content.audioId];assert.ok(asset);
 const bytes=await fs.readFile(new URL('../listening-homework/audio-assets/'+asset.url.split('/').at(-1),import.meta.url));
 assert.equal(bytes.length,asset.byteLength);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
 assert.equal(asset.chunks.reduce((sum,c)=>sum+c.byteLength,0),bytes.length);
 for(const c of content.chapters)assert.ok(c.start>=0&&c.end<=32.544&&c.start<c.end);
 for(const c of content.transcript)assert.ok(c.start>=0&&c.end<=content.transcriptScope.end&&c.start<c.end);
});
test('Public Libraries inherits the live controller and student/teacher entry',async()=>{
 const page=await fs.readFile(new URL('../listening-homework/paper-on-public-libraries.html',import.meta.url),'utf8');
 assert.match(page,/data-izone-ui-profile="skill-homework"/);
 assert.match(page,/data-workspace-space="unified"/);
 assert.match(page,/app\.mjs\?v=20261102-state1/);
 assert.match(page,/id="teacher-entry"/);
 assert.doesNotMatch(page,/id="remember"/);
 assert.match(page,/Bối cảnh trước đoạn luyện nghe/);
 assert.doesNotMatch(page,/origami|Horton Castle/);
});
