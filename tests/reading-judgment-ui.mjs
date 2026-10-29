// Native Term uses radio labels once, without a separate answer bank.
import test from 'node:test';
import assert from 'node:assert/strict';
import {groupsHtml,groupDisplayLabel,prepHtml} from '../reading-practice/authored-ui.js';
for(const values of [['TRUE','FALSE','NOT GIVEN'],['YES','NO','NOT GIVEN']])test(values[0]+' statements use three restored radio choices and one number',()=>{
 const group={id:'judgment',kind:'matching',label:values.join(' / '),instruction:'Read each statement.',options:values.map(value=>({value,text:value})),questions:[{n:8,text:'A complete source statement.'},{n:9,text:'Another complete source statement.'}]};
 const html=groupsHtml([group],{answers:{8:values[2]}},()=>'<button>Flag</button>');
 assert.equal((html.match(/type="radio"/g)||[]).length,6);assert.equal((html.match(/checked/g)||[]).length,1);assert.equal((html.match(/cbt-blank-number/g)||[]).length,0);assert.ok(html.includes('authored-judgment-list'));assert.ok(html.includes('cbt-choice-single-label'));
 for(const value of values)assert.ok(html.includes('value="'+value+'"'));
});
test('The display title omits subtitle without changing its source group',()=>{
 const group={id:'q40',kind:'mcq',label:'Multiple choice — subtitle',instruction:'Choose one.',questions:[{n:40,text:'A complete question.',options:[{value:'A',text:'Choice A'},{value:'B',text:'Choice B'}]}]};
 const original=JSON.stringify(group),html=groupsHtml([group],{answers:{}},()=> '');
 assert.match(html,/<h4>Question 40 · Multiple choice(?:<span[^>]*hidden[^>]*>[^<]*<\/span>)?<\/h4>/);assert.equal(JSON.stringify(group),original);
 assert.equal(groupDisplayLabel(group),'Multiple choice');
 const prep=prepHtml({questionIds:['40'],groups:[group],totalMs:3600000},null,'reading',()=>'',()=> '');
 assert.match(prep,/<h3>Multiple choice<\/h3>/);assert.doesNotMatch(prep,/subtitle/i);
 assert.equal(JSON.stringify(group),original);
});
