import test from 'node:test';import assert from 'node:assert/strict';import {TASKS,selectTask} from '../sw-task2-preview-20261025/writing-handouts/shops-review/lesson-config.mjs';
test('tám đề có nguyên văn, dạng bài và hướng dẫn riêng, không rơi về Shops',()=>{
 assert.deepEqual(Object.values(TASKS).map(t=>t.number).sort((a,b)=>a-b),[1,2,3,4,9,10,11,12]);assert.equal(selectTask('unknown'),null);
 for(const [slug,t] of Object.entries(TASKS)){assert.equal(t.slug,slug);assert.ok(t.previewAvailable);assert.ok(t.statement.length>60);assert.equal(t.guide.steps.length,3);assert.ok(t.guide.label);assert.equal(t.uiVersion,'sw-task2-lesson9-v1');}
 assert.equal(TASKS['writing-task2-crime-prevention-responsibility'].questionType,'discussion');assert.equal(TASKS['writing-task2-urban-crowding-traffic-congestion'].questionType,'problems-solutions');assert.equal(TASKS['writing-task2-english-medium-instruction'].questionType,'outweigh');
});
