import test from 'node:test';import assert from 'node:assert/strict';
import {vocabularyPoint,legacyVocabularyRows} from '../sw-task2-preview-20261025/writing-handouts/shops-review/vocabulary-adapter.mjs';
test('từ vựng bám point hoặc sourceField, không ghép theo thứ tự',()=>{
 assert.equal(vocabularyPoint({point:'x2'}),'X2');assert.equal(vocabularyPoint({sourceField:'idea1_b'}),'B1');assert.equal(vocabularyPoint({idea:'an idea described in Vietnamese'}),null);
});
test('từ vựng cũ thiếu point vẫn đọc được và không tự bịa nghĩa',()=>{
 assert.deepEqual(legacyVocabularyRows([{idea:'Nội dung cũ',terms:['keep the original phrase']},{point:'A1',terms:[{phrase:'mapped',meaningVi:'đã ánh xạ'}]}]),[{label:'Nội dung cũ',terms:[{phrase:'keep the original phrase',meaningVi:''}]}]);
});
