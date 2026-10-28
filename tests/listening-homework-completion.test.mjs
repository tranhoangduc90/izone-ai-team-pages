import test from 'node:test';
import assert from 'node:assert/strict';
import {hasAnswerContent} from '../listening-homework/answer-content.mjs';
import {encodeAnswer} from '../listening-homework/answer-codec.mjs';
test('Placeholder-only plain and composite answers do not count as completed',()=>{
 for(const raw of ['', ' ','…','—','\u200b','\u2060',' - — … ','N/A','Lựa chọn: \nDẫn chứng: \u200b','(a) —\n(b) …\n(c) \u200b'])assert.equal(hasAnswerContent(raw),false,JSON.stringify(raw));
 for(const id of ['S8','S17','S19'])assert.equal(hasAnswerContent(encodeAnswer(id,{[id+'quote']:'\u200b'})),false);
 assert.equal(hasAnswerContent(encodeAnswer('S4',{S4a:'—',S4b:'…',S4c:'\u200b'})),false);
});
test('Meaningful choice, partial evidence and words with formatting characters still count',()=>{
 for(const raw of ['Không','1','A','mot tac gia','social\u200b context','Lựa chọn: Có\nDẫn chứng: ','Lựa chọn: \nDẫn chứng: meaningful evidence','(a) meaningful\n(b) \n(c) '])assert.equal(hasAnswerContent(raw),true,JSON.stringify(raw));
});
