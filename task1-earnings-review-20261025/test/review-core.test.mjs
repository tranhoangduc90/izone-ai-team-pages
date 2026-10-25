import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotFields,filterStudents} from '../js/review-ui.js';
test('submitted Outline keeps both bodies and never displays current Draft as submitted input',()=>{
 const snapshot={overview:'old overview',body1:'old one',body2:'old two',draft1:'private draft',draft2:'private final'};
 const fields=snapshotFields({snapshot},'outline');assert.deepEqual(fields.map(x=>x.text),['old one','old two']);assert.equal(JSON.stringify(fields).includes('private'),false);assert.equal(snapshot.body1,'old one');
});
test('missing historical snapshot remains missing instead of substituting a current answer',()=>{
 assert.equal(snapshotFields({feedback:'old',overview:'current'},'overview'),null);
});
test('teacher filtering preserves identity, counts and source order while prioritizing support',()=>{
 const controls={'review-search':{value:'viên'},'review-filter':{value:''},'review-order':{value:'priority'},'review-count':{}};
 globalThis.document={getElementById:id=>controls[id]};
 const rows=[{studentRef:'first',displayName:'Học viên A',supportRequired:false},{studentRef:'second',displayName:'Học viên B',supportRequired:true}];
 const filtered=filterStudents(rows,()=> 'writing');assert.deepEqual(filtered.map(x=>x.studentRef),['second','first']);assert.equal(rows[0].studentRef,'first');assert.match(controls['review-count'].textContent,/2\/2/);
 controls['review-filter'].value='passed';assert.equal(filterStudents(rows,()=> 'writing').length,0);
});
