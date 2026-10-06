// Ca kiểm riêng của reviewer: dữ liệu giả, VM chạy source UI thật với DOM/API tối thiểu.
// Không gọi mạng/VPS/AI; kết quả kiểm cho biết phản hồi muộn có làm mất hoặc trộn bài không.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const core=await import(pathToFileURL(root+'/lesson5-demo/core.mjs'));
const {createClient}=await import(pathToFileURL(root+'/lesson5-thu/client.mjs'));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(api={}){
 const elements=new Map(),storage=new Map(),textarea={dataset:{field:'idea1'},value:'',disabled:false};
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,dataset:{},textContent:'',innerHTML:'',value:'',handlers:{},addEventListener(k,f){this.handlers[k]=f;},querySelector(){return null;},scrollIntoView(){},focus(){}});return elements.get(id);};
 const context=vm.createContext({...core,installStyles(){},createClient:()=>({setToken(){},...api}),document:{getElementById:el,querySelector:()=>null,querySelectorAll:s=>s==='textarea[data-field]'?[textarea]:[]},window:{addEventListener(){},scrollTo(){}},localStorage:{setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),getItem:k=>storage.get(k)||null},crypto:{randomUUID:()=> 'fixture-request'},setTimeout:()=>0,clearTimeout(){},Promise,JSON,Date,Number,String,Object,structuredClone});
 const source=fs.readFileSync(root+'/lesson5-thu/app.js','utf8').replace(/^import .*\r?\n/gm,'').replace('void bootstrap();','');
 vm.runInContext(source,context);
 const run=code=>vm.runInContext(code,context);
 run("render=()=>{};state.ref='a-ref';state.responses.idea1='Old draft';student='A';");
 return {run,el,textarea,storage,context};
}

function replyForm(body='Lời trả lời'){
 const button={disabled:false},status={textContent:''};
 const form={dataset:{threadReply:'thread-one'},elements:{body:{value:body,disabled:false}},querySelector:s=>s==='button'?button:status};
 return {form,button,status,event:{target:{closest:()=>form},preventDefault(){}}};
}
test('R-UI-REPLY-LOCK · giữ ô trả lời trong lúc gửi, không mất chữ nhập thêm',async()=>{
 const ack=deferred(),h=fixture({thread:()=>ack.promise}),r=replyForm();
 const pending=h.el('workspace').handlers.submit(r.event);await Promise.resolve();await Promise.resolve();
 assert.equal(r.form.elements.body.disabled,true);
 ack.resolve({session:h.run('structuredClone(state)')});await pending;
});
test('R-UI-REPLY-SAVE · lưu nháp trước khi gửi trao đổi, ACK không hạ bản đã lưu',async()=>{
 const sent=[],h=fixture({save:async()=>({session:{version:2}}),thread:async()=>{sent.push(h.run('state.version'));return {session:h.run('structuredClone(state)')};}}),r=replyForm();
 h.run("dirty={idea1:'Bài vừa nhập'};state.responses.idea1='Bài vừa nhập';");
 await h.el('workspace').handlers.submit(r.event);
 assert.deepEqual(sent,[2]);assert.equal(h.run('state.version'),2);assert.equal(h.run('Object.keys(dirty).length'),0);
});
test('R-UI-REPLY-ORDER · đang lưu thì chưa gửi reply, khóa input và giữ phiên bản mới',async()=>{
 const save=deferred(),ack=deferred();let replies=0;const h=fixture({save:()=>save.promise,thread:()=>{replies++;return ack.promise;}}),r=replyForm();
 h.run("dirty={idea1:'Nháp cần lưu'};state.responses.idea1='Nháp cần lưu';");
 const pending=h.el('workspace').handlers.submit(r.event);await Promise.resolve();await Promise.resolve();
 assert.equal(replies,0);assert.equal(h.textarea.disabled,true);
 h.textarea.value='Nhập lúc đang chờ';h.el('workspace').handlers.input({target:h.textarea});assert.equal(h.run('state.responses.idea1'),'Nháp cần lưu');
 save.resolve({session:{version:2}});await h.run('serial');await Promise.resolve();assert.equal(replies,1);
 assert.equal(h.run('busy'),true);assert.equal(h.run('editingLocked'),true);
 ack.resolve({session:h.run('structuredClone(state)')});await pending;
 assert.equal(h.run('state.version'),2);assert.equal(h.run('state.responses.idea1'),'Nháp cần lưu');assert.equal(h.run('editingLocked'),false);
});
test('R-UI-REPLY-SAVE-FAIL · lưu bài thất bại giữ nháp reply và chưa gửi trao đổi',async()=>{
 let replies=0;const h=fixture({save:async()=>{throw new Error('Offline');},thread:async()=>{replies++;}}),r=replyForm();
 h.run("dirty={idea1:'Nháp chưa lưu'};");await h.el('workspace').handlers.submit(r.event);
 assert.equal(replies,0);assert.equal(r.form.elements.body.value,'Lời trả lời');assert.equal(r.form.elements.body.disabled,false);assert.equal(h.run('dirty.idea1'),'Nháp chưa lưu');
});
test('R-UI-REPLY-RENDER · mất ACK rồi dựng lại trang vẫn giữ requestId để thử lại',async()=>{
 const h=fixture(),old=replyForm(),fresh=replyForm('');old.form.dataset.replyId='stable-id';old.form.dataset.replyBody=old.form.elements.body.value;
 let calls=0;h.context.document.querySelectorAll=s=>s==='[data-thread-reply]'?(calls++===0?[old.form]:[fresh.form]):[];
 h.context.savedContent=()=>'';h.context.approvalLabel=()=>'';h.context.threadsView=()=>'';h.context.renderJourney=()=>'';h.context.renderProcessing=()=>'';
 const source=fs.readFileSync(root+'/lesson5-thu/app.js','utf8');const start=source.indexOf('function render(){'),end=source.indexOf('function hasReplyDraft()',start);
 vm.runInContext(source.slice(start,end),h.context);h.run('render()');
 assert.equal(fresh.form.dataset.replyId,'stable-id');assert.equal(fresh.form.dataset.replyBody,old.form.dataset.replyBody);assert.equal(fresh.form.elements.body.value,old.form.elements.body.value);
});
test('R-UI-IDENTITY · read-latest cũ không áp bài A vào phiên B',async()=>{
 const read=deferred(),h=fixture({read:()=>read.promise});
 const pending=h.el('read-latest').handlers.click();
 h.run("generation++;state=createState();state.ref='b-ref';state.responses.idea1='B draft';student='B';");
 const old=core.createState();old.ref='a-ref';old.responses.idea1='A private draft';read.resolve({session:old});await pending;
 assert.equal(h.run('state.ref'),'b-ref');assert.equal(h.run('state.responses.idea1'),'B draft');
});
test('R-UI-POLL · poll trước save không hạ version sau ACK',async()=>{
 const read=deferred(),h=fixture({read:()=>read.promise,save:async()=>({session:{version:2}})});
 const old=h.run('structuredClone(state)');const pending=h.run('poll()');
 h.run("dirty={idea1:'New draft'};state.responses.idea1='New draft';");await h.run('flush()');
 read.resolve({session:old});await pending;
 assert.equal(h.run('state.version'),2);assert.equal(h.run('state.responses.idea1'),'New draft');
});
test('R-UI-TYPING · input trong autosave được giữ trong state và nháp',async()=>{
 const save=deferred(),h=fixture({save:()=>save.promise});h.run("dirty={idea1:'Old draft'};");const pending=h.run('flush()');await Promise.resolve();
 h.textarea.value='Old draft + new words';h.el('workspace').handlers.input({target:h.textarea});save.resolve({session:{version:2}});await pending;
 assert.equal(h.run('state.responses.idea1'),'Old draft + new words');assert.equal(h.run('dirty.idea1'),'Old draft + new words');assert.ok(h.storage.size>0);
});
test('R-UI-CHECK · khóa nhập ngay trước đợi flush',async()=>{
 const save=deferred(),h=fixture({save:()=>save.promise,check:async()=>({session:h.run('structuredClone(state)')})});
 h.run("dirty={idea1:'Old draft'};state.responses.idea2='Idea two';state.responses.topicSentence='Topic sentence';");
 const button={dataset:{check:'topic'},disabled:false};const pending=h.el('workspace').handlers.click({target:{closest:s=>s==='button'?button:null}});
 assert.equal(h.textarea.disabled,true);assert.equal(h.run('editingLocked'),true);save.resolve({session:{version:2}});await pending;
});
test('R-UI-READ-SINGLE · doubleclick read-latest chỉ tạo một read',async()=>{
 const read=deferred();let calls=0;const h=fixture({read:()=>{calls++;return read.promise;}});
 const first=h.el('read-latest').handlers.click(),second=h.el('read-latest').handlers.click();
 const next=h.run('structuredClone(state)');read.resolve({session:next});await Promise.all([first,second]);assert.equal(calls,1);
});
test('R-UI-ACK · retry body gián đoạn dùng nguyên requestId',async()=>{
 let calls=0;const bodies=[];const api=createClient('https://fixture.invalid',async(_url,options)=>{calls++;bodies.push(options.body);return {ok:true,status:200,json:async()=>{if(calls===1)throw new TypeError('Body interrupted after ACK headers');return {ok:true,session:{version:2}};}};});
 const result=await api.save('a-ref',{baseVersion:1,requestId:'stable-request',responses:{idea1:'Draft'}});assert.equal(calls,2);assert.equal(bodies[0],bodies[1]);assert.equal(result.session.version,2);
});
test('R-UI-409 · HTTP conflict không retry mutation',async()=>{
 let calls=0;const api=createClient('https://fixture.invalid',async()=>{calls++;return {ok:false,status:409,json:async()=>({ok:false,error:'VERSION_CONFLICT'})};});
 await assert.rejects(api.save('a-ref',{baseVersion:1,requestId:'stable-request',responses:{idea1:'Draft'}}),error=>error.status===409);assert.equal(calls,1);
});
test('R-UI-DRAFT · khôi phục chỉ phần chưa lưu, giữ trường máy chủ mới',async()=>{
 const h=fixture({save:async()=>({session:{version:2}})});h.run("state.responses.idea2='New server idea two';");
 h.storage.set('izone-handout67:draft:a-ref',JSON.stringify({ref:'a-ref',changes:{idea1:'Unsaved idea one'},responses:{idea1:'Unsaved idea one',idea2:'Old server idea two'}}));
 h.el('restore-draft').handlers.click();await h.run('serial');assert.equal(h.run('state.responses.idea1'),'Unsaved idea one');assert.equal(h.run('state.responses.idea2'),'New server idea two');
});

test('R-UI-CLASS · trang lớp thật chỉ nạp tên trong đúng lớp của route',async()=>{
 const h=fixture({roster:async()=>({classes:[{classRef:'handout67-thu',className:'Lớp giả',students:[{studentRef:'fake',displayName:'Tên giả'}]},{classRef:'IC2304',className:'IC2304',students:[{studentRef:'actual-fixture',displayName:'Tên kiểm lớp'}]}]})});
 h.run("document.body={dataset:{classRef:'IC2304'}};");await h.run('bootstrap()');
 assert.equal(h.run('classes.length'),1);assert.equal(h.run('classes[0].classRef'),'IC2304');
 assert.equal(h.run('names.fake'),undefined);assert.equal(h.run("names['actual-fixture']"),'Tên kiểm lớp');
 assert.ok(!h.el('class-select').innerHTML.includes('handout67-thu'));
});

test('R-UI-CLASS-CLOSED · không fallback lớp khác khi lớp route chưa mở',async()=>{
 const h=fixture({roster:async()=>({classes:[{classRef:'handout67-thu',className:'Lớp giả',students:[]}]})});
 h.run("document.body={dataset:{classRef:'IC2304'}};");await h.run('bootstrap()');
 assert.equal(h.run('classes.length'),0);assert.equal(h.run('Object.keys(names).length'),0);
});
