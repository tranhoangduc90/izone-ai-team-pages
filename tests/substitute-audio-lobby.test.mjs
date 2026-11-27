import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),isBase=process.env.SUBSTITUTE_AUDIO_BASE==='1';
const read=p=>readFileSync(new URL(p,root),'utf8');
const helper=read('term-tests/substitute-shared/audio-lobby-20261127-v1.js');
class Element extends EventTarget {
  constructor(tag){super();Object.assign(this,{tag,dataset:{},style:{},children:[],disabled:true,paused:false,readyState:0,duration:0,volume:1,muted:false,currentTime:0,playbackRate:1,seeking:false});}
  append(...children){this.children.push(...children);for(const c of children)c.parent=this;}
  before(node){this.previousElementSibling=node;node.next=this;}
  remove(){this.removed=true;if(this.next?.previousElementSibling===this)this.next.previousElementSibling=undefined;}
  matches(selector){return selector==='[data-audio-start-wait]'&&'audioStartWait' in this.dataset;}
  querySelector(){return null;}
  replaceChildren(...children){this.children=children;}
  removeAttribute(name){delete this[name];}
  load(){}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  click(){this.dispatchEvent(new Event('click'));}
}
function context(){
  let ms=0;const nodes=[];
  const document={body:new Element('body'),createElement:tag=>{const n=new Element(tag);nodes.push(n);return n;}};
  const window={},ctx=vm.createContext({window,document,console,Event,DOMException,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:()=>{}},performance:{now:()=>ms},setTimeout,clearTimeout,AbortController});
  vm.runInContext(helper,ctx);
  return {window,ctx,nodes,advance:s=>{ms+=s*1000;},document};
}
for(const resumed of [false,true])test('Lỗi player sau canplay phải khóa lại nút vào bài, kể cả F5: '+resumed,async()=>{
  const f=context(),folder='term-tests/substitute-test-1-k56-computer-based/';
  const source=isBase?execFileSync('git',['show','80434d34faa9257a0f0fa1dcad483997af6a4e62:'+folder+'bootstrap-media-review-run-check-20261127-v1.js'],{cwd:root,encoding:'utf8'}):read(folder+'bootstrap-journey-20261127-v1.js');
  const a=source.indexOf('  function clearOfficialPreparation'),b=source.indexOf('  const audioScope=',a);
  vm.runInContext(`let officialPlayer,officialObjectUrl='',officialReady=false,playerReadyMs,verifiedAudioBytes,previewHeard=true;
    const state=${JSON.stringify(resumed?{examSessionId:'existing-run'}:{})},classCode='IC99056',previewAudio=document.createElement('audio');
    const elements={bootstrapRetry:{hidden:true},bootstrapNotice:{isConnected:true}};let disabled=true;
    function setStartAvailability(){disabled=!officialReady||!previewHeard;}
    function showNotice(){} function observeLobbyDecision(){}
    ${source.slice(a,b)}
    globalThis.prepare=prepareOfficialPlayer;globalThis.readiness=()=>({officialReady,previewHeard,disabled});`,f.ctx);
  const pending=f.ctx.prepare({size:100},new AbortController().signal),player=f.nodes.find(n=>n.tag==='audio'&&n.src);
  player.readyState=4;player.duration=120;player.dispatchEvent(new Event('canplay'));await pending;
  assert.equal(f.ctx.readiness().disabled,false);
  player.error={code:3};player.dispatchEvent(new Event('error'));
  assert.equal(f.ctx.readiness().officialReady,false);
  assert.equal(f.ctx.readiness().previewHeard,false);
  assert.equal(f.ctx.readiness().disabled,true);
});
test('Lượt tải đã hủy không được xóa trình phát mới đang sẵn sàng',async()=>{
  const f=context(),source=read('term-tests/substitute-test-1-k56-computer-based/bootstrap-journey-20261127-v1.js');
  const a=source.indexOf('  function clearOfficialPreparation'),b=source.indexOf('  const audioScope=',a);
  vm.runInContext(`let officialPlayer,officialObjectUrl='',officialReady=false,playerReadyMs,verifiedAudioBytes,previewHeard=true;
    const state={},classCode='IC99056',previewAudio=document.createElement('audio');
    const elements={bootstrapRetry:{hidden:true},bootstrapNotice:{isConnected:true}};
    function setStartAvailability(){} function showNotice(){} function observeLobbyDecision(){}
    ${source.slice(a,b)}
    globalThis.prepare=prepareOfficialPlayer;globalThis.ready=()=>officialReady;`,f.ctx);
  const pending=f.ctx.prepare({size:100},new AbortController().signal),player=f.nodes.find(n=>n.tag==='audio'&&n.src);
  player.readyState=4;player.duration=120;player.dispatchEvent(new Event('canplay'));await pending;
  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(Promise.resolve().then(()=>f.ctx.prepare({size:999},cancelled.signal)),e=>e.name==='AbortError');
  assert.notEqual(player.removed,true);assert.equal(f.ctx.ready(),true);
});
test('Tiến độ nghe đủ không tự xác nhận nghe rõ; học viên có thể báo chưa nghe được',()=>{
  const f=context(),audio=new Element('audio'),button=new Element('button');let confirmed=0;
  audio.readyState=4;audio.duration=120;
  const start=()=>f.window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW(audio,button,()=>{confirmed++;button.disabled=false;});
  start();f.advance(10);audio.currentTime=10;audio.dispatchEvent(new Event('timeupdate'));
  assert.equal(confirmed,0);assert.equal(button.disabled,true);
  f.nodes.find(x=>x.textContent==='Tôi chưa nghe được').click();
  assert.equal(confirmed,0);assert.equal(audio.paused,true);
  audio.paused=false;audio.currentTime=0;start();f.advance(10);audio.currentTime=10;audio.dispatchEvent(new Event('timeupdate'));
  f.nodes.filter(x=>x.textContent==='Tôi đã nghe rõ').at(-1).click();
  assert.equal(confirmed,1);assert.equal(button.disabled,false);
});
test('Hủy lượt gỡ xác nhận cũ; mute không được tính là đã xác nhận',()=>{
  const f=context(),audio=new Element('audio'),button=new Element('button');audio.readyState=4;let confirmed=0;
  f.window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW(audio,button,()=>confirmed++);
  f.advance(10);audio.currentTime=10;audio.dispatchEvent(new Event('timeupdate'));
  const yes=f.nodes.find(x=>x.textContent==='Tôi đã nghe rõ');audio.muted=true;yes.click();assert.equal(confirmed,0);
  f.window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT(audio);
  assert.equal(f.nodes.find(x=>'audioHearingConfirmation' in x.dataset).removed,true);
});
test('Chờ metadata thoát khi hủy, timeout hoặc MediaError',async()=>{
  const f=context(),audio=new Element('audio'),controller=new AbortController();
  const pending=f.window.SUBSTITUTE_WAIT_FOR_AUDIO(audio,{signal:controller.signal});controller.abort();
  await assert.rejects(pending,e=>e.name==='AbortError');
  await assert.rejects(f.window.SUBSTITUTE_WAIT_FOR_AUDIO(audio,{timeoutMs:5}),e=>e.code==='AUDIO_PLAYER_TIMEOUT');
  const error=f.window.SUBSTITUTE_WAIT_FOR_AUDIO(audio);audio.error={code:3};audio.dispatchEvent(new Event('error'));
  await assert.rejects(error,e=>e.code==='AUDIO_PLAYER_ERROR'&&e.mediaCode===3);
});
test('Lỗi cấp audio giữ mã quyền thi và thông báo tiếng Việt',async()=>{
  const f=context(),source=read('term-tests/substitute-test-1-k56-computer-based/bootstrap-journey-20261127-v1.js');
  const a=source.indexOf('  async function requestAudioPreparation'),b=source.indexOf('  async function authorizeAudio',a);
  Object.assign(f.window,{setTimeout,clearTimeout,SUBSTITUTE_STATE:{track:()=>()=>{},payload:x=>x}});
  Object.assign(f.ctx,{appConfig:{API_BASE_URL:'https://fixture.invalid'},fetch:async()=>({ok:false,status:409,json:async()=>({code:'RETAKE_ALREADY_USED'})})});
  vm.runInContext(source.slice(a,b)+'\nglobalThis.request=requestAudioPreparation;',f.ctx);
  await assert.rejects(f.ctx.request({},new AbortController().signal),e=>e.code==='RETAKE_ALREADY_USED'&&e.message.includes('Bạn đã có lượt'));
});
