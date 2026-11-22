import test from 'node:test';
import assert from 'node:assert/strict';
import {loadClassDirectory} from '../term-tests/substitute-skill-shared/class-directory.mjs';
import {bindIdentitySelection,restorePreparedSelection} from '../term-tests/substitute-skill-shared/identity-selection.mjs';

class Element {
  value = '';
  options = [];
  add(option){this.options.push(option);}
  replaceChildren(...children){this.options=children;this.value=children[0]?.value??'';}
  addEventListener(){}
  setAttribute(){}
  after(...nodes){this.following=nodes;}
  closest(){return null;}
  close(){this.open=false;}
}

globalThis.Option=class {constructor(text,value){Object.assign(this,{text,value});}};
const testId='substitute-test-2-k56-listening-makeup';
const directory=classes=>async()=>Response.json({version:1,testId,classes});

test('dropdown hides denied and ambiguous classes and clears removed selection', async()=>{
  const select=new Element();
  select.value='IC1235';
  const state=await loadClassDirectory(testId,select,{fetcher:directory([
    {code:'IC1234',eligible:true},
    {code:'IC1235',eligible:false},
    {code:'IC1236',key:'duplicate-a',eligible:false,reason:'CLASS_CODE_AMBIGUOUS'},
    {code:'IC1236',key:'duplicate-b',eligible:false,reason:'CLASS_CODE_AMBIGUOUS'}
  ])});
  assert.deepEqual(select.options.map(option=>option.value),['','IC1234']);
  assert.equal(select.value,'');
  assert.throws(()=>state.requireEligible('IC1235'),{code:'CLASS_NOT_ELIGIBLE'});
  await loadClassDirectory(testId,select,{fetcher:directory([])});
  assert.equal(select.options[0].text,'Không có lớp đủ điều kiện cho bài này');
});

test('roster handles failed, empty and delayed replies and retries the same class',async()=>{
  const elements=Object.fromEntries(['class','student','prepare','confirm-identity','start','preview','heard','notice','confirm-no','confirm-yes'].map(id=>[id,new Element()]));
  globalThis.document={getElementById:id=>elements[id],createElement:()=>new Element()};
  let mode='error',finish;
  bindIdentitySelection({onRoster:()=>{},onConfirm:()=>{},onError:()=>{},loadRoster:async code=>{
    if(mode==='error')throw Error('ERP_ROSTER_UNAVAILABLE');
    if(mode==='empty')return [];
    if(code==='IC1234'&&mode==='race')return new Promise(resolve=>{finish=resolve;});
    return [{name:'Học viên giả',studentRef:'17'}];
  }});
  const select=elements.class,student=elements.student;
  select.value='IC1234';
  await select.onchange();
  assert.equal(student.disabled,true);
  assert.match(student.following[0].textContent,/Không tải được danh sách học viên/);
  assert.equal(student.following[1].hidden,false);
  mode='empty';
  await student.following[1].onclick();
  assert.equal(student.disabled,true);
  assert.match(student.following[0].textContent,/Không có học viên đủ điều kiện/);
  mode='race';
  const late=select.onchange();
  select.value='IC1237';
  await select.onchange();
  finish([{name:'Sai lớp',studentRef:'20'}]);
  await late;
  assert.deepEqual(student.options.map(option=>option.value),['','17']);
  assert.equal(student.disabled,false);
});

test('reloading prepared storage restores only the previously confirmed identity',()=>{
  const state={prepareOperation:'fixture-op',identity:{classCode:'IC1234',studentRef:'17'},name:'Học viên giả'};
  const classSelect=new Element(),student=new Element();
  restorePreparedSelection(state,classSelect,student);
  assert.deepEqual([classSelect.value,student.value],['IC1234','17']);
  assert.ok(classSelect.disabled&&student.disabled);
  for(const closed of [{startedAt:1},{sealed:true}]){
    const previousClass=new Element(),previousStudent=new Element();
    restorePreparedSelection({...state,...closed},previousClass,previousStudent);
    assert.deepEqual([previousClass.value,previousStudent.value],['','']);
  }
  classSelect.value='IC1237';
  restorePreparedSelection(state,classSelect,student);
  assert.equal(classSelect.value,'IC1237');
});
