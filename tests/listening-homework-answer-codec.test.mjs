import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeBody,encodeBody,UI_KIND} from '../listening-homework/answer-codec.mjs';
const items=['D1','D2','D3',...Array.from({length:19},(_,n)=>'S'+(n+1))].map(id=>({id}));
const state=(raw)=>({...decodeBody(raw,items),notes:raw.notes||'',flags:[]});
test('Historical answers remain byte-for-byte, including unknown combined variants',()=>{
 const raw={answers:{S1:'Cả hai chốt ý này theo tôi hiểu.',S4:'cụm một / cụm hai — còn ý ba',S8:'Có — a short quote.',S19:'Tôi chọn cách C, hiệu quả hơn A.'},annotations:[{kind:'existing-note',text:'keep'}],notes:'Ghi chú gốc'};
 const encoded=encodeBody(state(raw),items,raw.annotations);
 for(const [id,text]of Object.entries(raw.answers))assert.equal(encoded.answers[id],text);
 assert.deepEqual(encoded.annotations[0],raw.annotations[0]);assert.equal(encoded.notes,raw.notes);
});
test('A saved interaction can restore its three independent slots without changing the grader input',()=>{
 const original={fields:{S4a:'A quote with a newline\ncontinued',S4b:'Cụm 2',S4c:'Cụm 3',S8choice:'Có',S8quote:'one word',mcq24:'B'},legacy:{},notes:'note',flags:['S4']};
 const body=encodeBody(original,items),restored=state(body);for(const [key,value] of Object.entries(original.fields))assert.equal(restored.fields[key],value);
 assert.equal(body.flags[0],7);assert.equal(encodeBody(restored,items).answers.S4,body.answers.S4);
});
test('Stale presentation metadata never overrides a newer raw answer or a malformed choice',()=>{
 const raw={answers:{S4:'new raw answer',S8:'Lựa chọn: both\nDẫn chứng: unclear'},annotations:[{kind:UI_KIND,fields:{S4a:'old',S4b:'old',S4c:'old'}}]};
 const decoded=state(raw);assert.equal(decoded.legacy.S4,'new raw answer');assert.equal(encodeBody(decoded,items).answers.S8,raw.answers.S8);
});
test('Empty subfields remain an unanswered item; partial subfields are one stable target',()=>{
 const s={fields:{S4a:'',S4b:'',S4c:''},legacy:{},notes:'',flags:[]};assert.equal(encodeBody(s,items).answers.S4,'');s.fields.S4b='only the middle idea';const body=encodeBody(s,items);assert.equal(Object.keys(body.answers).length,22);assert.equal(body.answers.S4,'(a) \n(b) only the middle idea\n(c) ');
});
