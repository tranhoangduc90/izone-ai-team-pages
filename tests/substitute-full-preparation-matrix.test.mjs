import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {createContext, runInContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {relative} from 'node:path';

const provisional='11111111-1111-4111-8111-111111111111';
const official='22222222-2222-4222-8222-222222222222';
const revoked='33333333-3333-4333-8333-333333333333';
const root=new URL('../term-tests/',import.meta.url);
const revision=process.env.SUBSTITUTE_PREPARATION_BASE;
async function readSource(url){
  if(!revision)return readFile(url,'utf8');
  assert.match(revision,/^[a-f0-9]{40}$/);
  const cwd=fileURLToPath(new URL('../',import.meta.url));
  const path=relative(cwd,fileURLToPath(url)).replaceAll('\\','/');
  return execFileSync('git',['show',revision+':'+path],{cwd,encoding:'utf8'});
}

async function fixture(slug,attribute,{assignedRun=official,changeSelection=false}={}){
  const directory=new URL(slug+'-computer-based/',root);
  const html=await readSource(new URL('index.html',directory));
  const file=html.match(new RegExp(attribute+'="([^"?]+)'))[1];
  const source=await readSource(new URL(file,directory));
  const entryPath=source.match(/import\('([^']*assignment-student-entry[^']*)'\)/)[1];
  const {adoptFullAdmissionRun}=await import(new URL(entryPath,directory));
  const hash=createHash('sha256').update(JSON.stringify('substitute-run:'+slug+':'+revoked)).digest('hex');
  const actions=[],scope={classCode:'IC99001',studentRef:'fixture-student'};
  let context;
  const window={addEventListener(){},crypto:{subtle:{async digest(...args){
    if(changeSelection)context.elements.bootstrapStudent.value='other-student';
    return webcrypto.subtle.digest(...args);
  }}}};
  context=createContext({window,AbortController,setTimeout,clearTimeout,TextEncoder,
    location:{search:''},
    fetch:async()=>({ok:true,json:async()=>({testSlug:slug,historyEpoch:revoked,stateVersion:2,invalidatedRunHashes:[hash]})}),
    state:{...scope,clientRunId:provisional,annotationRunId:revoked},classCode:scope.classCode,classLoadGeneration:1,
    elements:{bootstrapStudent:{value:scope.studentRef}},assignmentClasses:{has:()=>true},
    intake:{entry:{session:()=>undefined,select:({onReady})=>onReady({scope})},
      bindFullAdmission:async()=>({clientRunId:assignedRun}),adoptFullAdmissionRun},
    isUuid:value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
    parallelEntry:()=>true,studentPointer:()=>'fixture',listeningLease:{key:'fixture:'+provisional},
    releaseListeningLease:()=>actions.push('release'),acquireListeningLease:async()=>{actions.push('acquire');return true;},
    observeLobbyDecision(){},
    saveState(patch){const value={...context.state,...patch};window.SUBSTITUTE_STATE.bind(value);context.state=window.SUBSTITUTE_STATE.stamp(value);},
    prepareSelectedStudent:()=>{actions.push('audio');return true;}
  });
  const audioHelper=html.match(/src="([^"?]*audio-lobby[^"?]*)/)[1];
  runInContext(await readSource(new URL(audioHelper,directory)),context);
  runInContext(await readSource(new URL('substitute-shared/state.js',root)),context);
  await window.SUBSTITUTE_STATE.initialize({slug},{API_BASE_URL:'https://fixture.invalid/'});
  context.saveState({});
  const start=source.indexOf('  async function openAssignmentIntake(');
  runInContext(source.slice(start,source.indexOf('  async function prepareSelectedStudent(',start)),context);
  return {context,actions,prepare:()=>context.openAssignmentIntake(scope.studentRef,false)};
}

for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
  for(const attribute of ['data-bootstrap','data-prior-bootstrap']){
    test(slug+' '+attribute+': mã mới đi tới audio dù bài có lịch sử reset',async()=>{
      const f=await fixture(slug,attribute);
      assert.equal(await f.prepare(),true);
      assert.equal(f.context.state.clientRunId,official);
      assert.equal(f.actions.at(-1),'audio');
    });
    test(slug+' '+attribute+': mã đã reset không đổi chủ lượt hoặc mở audio',async()=>{
      const f=await fixture(slug,attribute,{assignedRun:revoked});
      await assert.rejects(f.prepare(),/ASSIGNMENT_RUN_REVOKED/);
      assert.equal(f.context.state.clientRunId,provisional);
      assert.deepEqual(f.actions,[]);
    });
    test(slug+' '+attribute+': đổi người khi đang xác minh không áp phản hồi cũ',async()=>{
      const f=await fixture(slug,attribute,{changeSelection:true});
      await assert.rejects(f.prepare(),/ASSIGNMENT_SELECTION_CHANGED/);
      assert.equal(f.context.state.clientRunId,provisional);
      assert.deepEqual(f.actions,[]);
    });
  }
}
