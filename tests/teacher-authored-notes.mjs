// Giảng viên cần đọc đủ ghi chú không đánh số, nhưng không được có input hoặc audio nháp.
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPracticeDefinitionHtml} from '../shared/teacher-practice-definition.js';
test('GV xem đủ Access và ô trống Note Completion, chỉ đọc',()=>{
 const html=renderPracticeDefinitionHtml({authored:true,groups:[{kind:'completion',label:'Impact',instruction:'ONE WORD ONLY',introduction:'Access\nLoss of independence for disabled people.',questions:[{n:40,text:'The {blank} in offices is often too low.'}]}]},['40']);
 assert.ok(html.includes('Loss of independence for disabled people.'));
 assert.ok(html.includes('The _____ in offices is often too low.'));
 assert.doesNotMatch(html,/<input|<audio|\{blank\}/);
});
