import test from 'node:test';
import assert from 'node:assert/strict';
import {connectedState} from '../sw-task2-writing/writing-handouts/shops-review/connected-adapter.mjs';
import {ACTIVITY,canOpen} from '../sw-task2-writing/writing-handouts/shops-review/model.mjs';
import {sameVocabularySource} from '../sw-task2-writing/writing-handouts/shops-review/vocabulary-adapter.mjs';
const person={id:'student',classRef:'class',name:'Học viên thử',classCode:'CS-FIXTURE'};
const body={body_choice:'body1',topic_sentence:'topic',body1_idea1:'idea1',body1_idea2:'idea2',idea1_a:'a1',idea1_x:'x1',idea1_b:'b1',idea2_a:'a2',idea2_x:'x2',idea2_b:'b2'};
const vocab=label=>['A1','X1','B1','A2','X2','B2'].map(point=>({point,terms:[{phrase:label+point,meaningVi:'Nghĩa thử'}]}));
function raw(status='pending'){
 const sections=['topic_sentence','supporting_idea_1','supporting_idea_2','draft'];
 return {sessionRef:'session',activitySlug:ACTIVITY,studentRef:'student',classRef:'class',responses:{...body},draftVersion:1,updatedAt:'2026-11-05T00:00:00Z',
  ui:{version:'sw-task2-lesson9-v1',data:{idea2Opened:true}},uiVocabulary:{status:'missing'},uiEvents:[],
  sections:Object.fromEntries(sections.map(key=>[key,{status:key==='draft'?'draft':'passed',locked:key!=='draft'}])),
  attempts:sections.slice(0,3).map(key=>({attemptRef:key,section:key,status:'completed',resultStatus:'passed',snapshot:{...body},createdAt:'2026-11-05T00:00:00Z'})),
  comments:[{attemptRef:'supporting_idea_2',section:'supporting_idea_2',status:'completed',feedback:'Nhận xét đã sẵn sàng',createdAt:'2026-11-05T00:00:00Z',
   artifacts:{vocabularyTaskVersion:'deferred-v1',vocabularyStatus:status,...(status==='available'?{vocabulary:vocab('new')}: {})}}]};
}
test('review and unchanged Draft gate are available while vocabulary is pending or failed',()=>{
 for(const status of ['pending','unavailable']){
  const s=connectedState(raw(status),person);assert.equal(s.steps.si2.history[0].feedback,'Nhận xét đã sẵn sàng');
  assert.equal(s.steps.si2.status,'passed');assert.equal(canOpen(s,'draft'),true);
  assert.equal(s.vocabStatus,status==='pending'?'pending':'failed');
 }
 const blocked=raw();blocked.sections.supporting_idea_1={status:'needs_revision',locked:false};assert.equal(canOpen(connectedState(blocked,person),'draft'),false);
});
test('pending latest attempt never falls back to the vocabulary of an older attempt',()=>{
 const r=raw();r.attempts.push({...r.attempts[2],attemptRef:'old'});
 r.comments.unshift({...r.comments[0],attemptRef:'old',artifacts:{vocabulary:vocab('OLD')}});
 const s=connectedState(r,person);assert.equal(s.vocabStatus,'pending');assert.deepEqual(s.vocabularyGroups,{});
});
test('matching late vocabulary is shown, argument edits hide it, Draft typing keeps it',()=>{
 const r=raw('available');assert.equal(connectedState(r,person).vocabStatus,'ready');
 r.responses.draft1='Student writes Draft while vocabulary arrives';assert.equal(connectedState(r,person).vocabStatus,'ready');
 r.responses.idea2_x='Edited reasoning';const s=connectedState(r,person);assert.equal(s.vocabStatus,'failed');assert.deepEqual(s.vocabularyGroups,{});
 assert.equal(s.steps.si2.status,'passed');assert.equal(canOpen(s,'draft'),true);
 assert.equal(sameVocabularySource(body,{...body,body_choice:'body2'}),false);
});
