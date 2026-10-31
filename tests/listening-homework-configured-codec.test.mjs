import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeBody,encodeBody,encodeAnswer} from '../listening-homework/answer-codec.mjs';
const items=[{id:'D1',ui:{kind:'quote'}},{id:'S3',ui:{kind:'choice'}},{id:'S10',ui:{kind:'slots',slots:[{key:'S10a',label:'first'},{key:'S10b',label:'second'}]}}];
test('Configured lesson fields round trip independently and preserve historical free text',()=>{
 const state={fields:{D1:'original words',S3:'F',S10a:'first clause',S10b:'second clause'},flags:['S10'],notes:'my note',legacy:{}};
 const body=encodeBody(state,items);assert.equal(body.answers.S10,'(a) first clause\n(b) second clause');
 const restored=decodeBody(body,items);assert.equal(restored.fields.S10a,'first clause');assert.equal(restored.fields.S10b,'second clause');assert.equal(restored.fields.S3,'F');
 const historical=decodeBody({...body,answers:{...body.answers,S10:'free wording from an older draft'}},items);
 assert.equal(historical.legacy.S10,'free wording from an older draft');assert.equal(historical.fields.S10a,undefined);
 const changed={...state,fields:{...state.fields,S10b:''}};assert.equal(encodeBody(changed,items).answers.S10,'(a) first clause\n(b) ');
 assert.equal(encodeAnswer('S10',{},items[2]),'');
});
