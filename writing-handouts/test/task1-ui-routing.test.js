import test from 'node:test';
import assert from 'node:assert/strict';
import {TASK1_UI_SLUGS,task1UiRoute} from '../js/task1-ui-routing.js';
import {snapshotFields} from '../js/task1-ui.js';
test('the six Task 1 URLs keep the selected lesson and role while other products stay on their existing UI',()=>{
 for(const slug of TASK1_UI_SLUGS){
  assert.deepEqual(task1UiRoute('?class=CS.070626&task='+slug,'/writing-handouts/index.html'),{slug,role:'student'});
  assert.deepEqual(task1UiRoute('?task='+slug+'&class=CS.160826','/writing-handouts/teacher.html'),{slug,role:'teacher'});
 }
 for(const slug of ['sample-task','writing-lesson13-young-leaders','pie-app-users-by-age-copy','average-earnings-by-sector-2000-2010/other',''])assert.equal(task1UiRoute('?task='+slug,'/writing-handouts/index.html'),null);
});
test('Task 1 timelines show only the original fields for that section, including an old empty body',()=>{
 const snapshot={overview:'then',body1:'old body one',body2:'',draft1:'old first',draft2:'old second'};
 assert.deepEqual(snapshotFields({snapshot},'outline').map(x=>x.text),['old body one','']);
 assert.deepEqual(snapshotFields({snapshot},'draft').map(x=>x.text),['old first','old second']);
 assert.equal(snapshotFields({feedback:'no original snapshot',draft2:'new text'},'draft'),null);
});
