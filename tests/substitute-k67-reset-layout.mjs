import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
const read = p => process.env.REGRESSION_BASE
  ? execFileSync('git', ['show', `${process.env.REGRESSION_BASE}:${p}`], {encoding:'utf8',stdio:['ignore','pipe','ignore']})
  : fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function storage(entries) {
  const map = new Map(entries);
  return {get length(){return map.size;}, key:i=>[...map.keys()][i] ?? null,
    getItem:k=>map.get(k) ?? null, setItem:(k,v)=>map.set(k,v), removeItem:k=>map.delete(k)};
}
function harness(n, fail = false) {
  const slug = `substitute-test-${n}-k67`;
  const own = ['izone-test:', 'izone-test-ui:', 'izone-test-annotations:'].flatMap(p =>
    ['RETAKE-LOBBY','DEMO','IC2139'].flatMap(c => ['',':substitute-k67-task2-20260922-v2',':future-version'].map(v=>p+slug+':'+c+':server-grade'+v)));
  const other = ['izone-test:substitute-test-2-k56:DEMO:server-grade', `izone-test:${slug}-other:DEMO:server-grade`, 'unrelated'];
  const listeners = {}, elements = [];
  function element(){const children={};const e={hidden:true,disabled:false,addEventListener:(k,f)=>{e[k]=f;},setAttribute(){},focus(){},append(){},classList:{add(){}},querySelector:s=>children[s]??=(element()),showModal(){e.open=true;},close(){e.open=false;}};elements.push(e);return e;}
  const root=element();
  const ctx={URL,URLSearchParams,Math,Date,sessionStorage:storage([...own,...other].map(k=>[k,'synthetic'])),localStorage:storage([...own,...other].map(k=>[k,'synthetic'])),history:{replaceState(){}},location:{search:'?demo=exam&grading=server&class=DEMO&demoStudent=synthetic&demoAttempt=synthetic',href:'https://example.test/?demo=exam&grading=server&class=DEMO&demoStudent=synthetic&demoAttempt=synthetic',replace(url){ctx.replaced=url;}},document:{getElementById:()=>root,createElement:element,body:{append(){}}},MutationObserver:class{observe(){}},window:{TERM_TEST_CONFIG:{slug,title:'Synthetic'},TERM_TEST_APP_CONFIG:{AUTH_MODE:'online-demo'},addEventListener:(k,f)=>listeners[k]=f}};
  if(fail)ctx.sessionStorage.removeItem=()=>{throw new Error('blocked');};
  let helper='';
  try { helper=read('term-tests/substitute-k67-shared/reset-storage.js'); } catch { /* Missing on the unfixed base. */ }
  if(helper)vm.runInNewContext(helper,ctx);
  vm.runInNewContext(read(`term-tests/substitute-test-${n}-k67-computer-based/demo-reset.js`),ctx);
  const dialog=elements.find(e=>e.className==='k56-reset-dialog');
  return {ctx,own,other,dialog,listeners,confirm:()=>dialog.querySelector('[data-reset-confirm]').click()};
}
for(const n of [1,2]) {
  test(`Sub ${n} reset removes versioned state and retains other tests`,()=>{
    const h=harness(n);h.confirm();
    for(const s of [h.ctx.sessionStorage,h.ctx.localStorage]){
      for(const k of h.own)assert.equal(s.getItem(k),null,k);
      for(const k of h.other)assert.equal(s.getItem(k),'synthetic',k);
    }
    const url=new URL(h.ctx.replaced);for(const k of ['class','demoStudent','demoAttempt'])assert.equal(url.searchParams.has(k),false);
    assert.equal(url.searchParams.get('reset'),'1');
    h.confirm();assert.ok(h.ctx.replaced,'Reset remains idempotent');
  });
  test(`Sub ${n} blocked storage does not reload or silently succeed`,()=>{
    const h=harness(n,true);h.confirm();assert.equal(h.ctx.replaced,undefined);
    assert.equal(h.dialog.querySelector('.k56-reset-error').hidden,false);
    assert.equal(h.dialog.querySelector('[data-reset-confirm]').disabled,false);
  });
  test(`Sub ${n} another-tab reset clears versioned identity`,()=>{
    const h=harness(n);h.listeners.storage({key:`izone-demo-reset:substitute-test-${n}-k67:RETAKE-LOBBY:server-grade`,newValue:'1'});
    for(const k of h.own)assert.equal(h.ctx.sessionStorage.getItem(k),null);
  });
  test(`Sub ${n} reload reset uses the same cleanup before restoring state`,()=>{
    const b=read(`term-tests/substitute-test-${n}-k67-computer-based/bootstrap.js`);
    assert.ok(b.indexOf('window.K67_RESET_STORAGE.clear(testConfig.slug)')>0);
    assert.ok(b.indexOf('window.K67_RESET_STORAGE.clear(testConfig.slug)')<b.indexOf('let state = readState()'));
    const html=read(`term-tests/substitute-test-${n}-k67-computer-based/index.html`);
    assert.ok(html.indexOf('reset-storage.js')<html.indexOf('src="bootstrap.js'));
  });
}
test('Listening instruction blocks preserve centered content gutters',()=>{
  const css=read('term-tests/substitute-k67-shared/semantic-layout.css');
  assert.match(css,/\.cbt-listening-section\s*>\s*\.k67-instruction-block[^{]*\{[^}]*margin-inline:\s*auto/);
});
test('Cleanup rejects an invalid or unrelated test slug without deleting storage',()=>{
  const h=harness(2);
  for(const slug of ['',null,'substitute-test-2-k56','substitute-test-2-k67:']) {
    assert.throws(()=>h.ctx.window.K67_RESET_STORAGE.clear(slug),/INVALID_RESET_SCOPE/);
  }
  for(const k of h.own)assert.equal(h.ctx.sessionStorage.getItem(k),'synthetic');
});
