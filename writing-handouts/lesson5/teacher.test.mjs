import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ORDER,FIELDS,createState} from '../lesson5-demo/core.mjs';
// Source giảng viên thật, dữ liệu giả: không để retry hoặc read muộn vượt ranh giới đăng nhập.
function fixture(fetcher){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{handlers:{},addEventListener(k,f){this.handlers[k]=f;},hidden:false,textContent:'',innerHTML:'',value:'',dataset:{}});return elements.get(id);};
 const context=vm.createContext({ORDER,FIELDS,installStyles(){},savedContent:()=>'',approvalLabel:()=>'',threadsView:()=>'',fetch:fetcher,document:{getElementById:get,querySelectorAll:()=>[]},AbortSignal,JSON,String,Object,Number,Date,crypto,Error,Promise,setTimeout,clearInterval,setInterval,window:{}});
 const source=fs.readFileSync(new URL('./teacher.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('void boot();','');vm.runInContext(source,context);
 return {run:code=>vm.runInContext(code,context),context,get};
}
function replyForm(body='GV trả lời'){
 const button={disabled:false},status={textContent:''};
 const form={dataset:{threadReply:'thread-one'},elements:{body:{value:body,disabled:false}},querySelector:s=>s==='button[type="submit"]'?button:status};
 return {form,button,status,event:{target:{closest:()=>form},preventDefault(){}}};
}
test('T-TEACHER-UI-REPLY-LOCK · không cho sửa lời trả lời khi đang gửi',async()=>{
 let resolve;const ack=new Promise(r=>resolve=r),h=fixture(async()=>({ok:true,status:200,json:()=>ack})),r=replyForm();
 h.run("selected={ref:'same-session'};renderDetail=()=>{};readActivity=async()=>{};");
 const pending=h.get('detail-content').handlers.submit(r.event);
 assert.equal(r.form.elements.body.disabled,true);resolve({ok:true,session:createState()});await pending;
});
test('T-TEACHER-UI-CREATE-LOCK · gửi comment bám đoạn khóa composer và lỗi giữ nháp',async()=>{
 let reject;const ack=new Promise((_r,e)=>reject=e),h=fixture(async()=>({ok:true,status:200,json:()=>ack})),r=replyForm('Nháp góp ý theo đoạn');
 r.form.dataset.commentCreate='1';h.context.formUnderTest=r.form;
 h.run("selected={ref:'same-session'};composer={ref:'same-session',epoch:0,field:'a1',fieldHash:'hash',range:{start:0,end:2},form:formUnderTest};");
 const pending=h.get('detail-content').handlers.submit(r.event);
 assert.equal(r.form.elements.body.disabled,true);reject(new TypeError('Lost ACK'));await pending;
 assert.equal(r.form.elements.body.value,'Nháp góp ý theo đoạn');assert.equal(r.form.elements.body.disabled,false);assert.equal(h.run('composer.form===formUnderTest'),true);
});
test('T-TEACHER-UI-STATUS-CAS · gửi đúng phiên bản trao đổi đang xem',async()=>{
 let body;const h=fixture(async(_url,options)=>{body=JSON.parse(options.body);return {ok:true,status:200,json:async()=>({ok:true,session:createState()})};});
 h.run("selected={ref:'same-session'};detailSession={commentVersion:7};renderDetail=()=>{};");
 h.context.statusButton={dataset:{threadStatus:'thread-one',status:'addressed'},disabled:false};await h.run('sendStatus(statusButton)');
 assert.equal(body.expectedCommentVersion,7);
});
test('T-TEACHER-UI-STATUS-CONFLICT · đọc trạng thái mới, không tự ghi lại và giữ nháp reply',async()=>{
 const calls=[],next=createState();next.commentVersion=9;
 const h=fixture(async(_url,options)=>{calls.push(options.method);return options.method==='POST'?{ok:false,status:409,json:async()=>({ok:false,error:'COMMENT_VERSION_CONFLICT'})}:{ok:true,status:200,json:async()=>({ok:true,session:next})};}),r=replyForm('Nháp cần giữ');
 r.form.dataset.requestId='stable-id';r.form.dataset.requestBody=r.form.elements.body.value;
 h.context.document.querySelectorAll=()=>[r.form];
 h.run("selected={ref:'same-session'};detailSession={commentVersion:7};");
 h.context.statusButton={dataset:{threadStatus:'thread-one',status:'addressed'},disabled:false};await h.run('sendStatus(statusButton)');
 assert.deepEqual(calls,['POST','GET']);assert.equal(h.run('detailSession.commentVersion'),9);assert.equal(r.form.elements.body.value,'Nháp cần giữ');assert.equal(r.form.dataset.requestId,'stable-id');
});
test('T-TEACHER-UI-REPLY-RENDER · thử lại sau dựng DOM dùng mã gửi cũ',()=>{
 const h=fixture(),old=replyForm(),fresh=replyForm('');old.form.dataset.requestId='stable-id';old.form.dataset.requestBody=old.form.elements.body.value;
 let calls=0;h.context.document.querySelectorAll=s=>s==='[data-thread-reply]'?(calls++===0?[old.form]:[fresh.form]):[];
 h.context.nextSession=createState();h.run('renderDetail(nextSession)');
 assert.equal(fresh.form.dataset.requestId,'stable-id');assert.equal(fresh.form.dataset.requestBody,old.form.dataset.requestBody);assert.equal(fresh.form.elements.body.value,old.form.elements.body.value);
});
test('T-TEACHER-UI-COMPOSER · góp ý cũ và reply khác không xóa comment đang soạn',async()=>{
 let calls=0;const h=fixture(async()=>{calls++;return {ok:true,status:200,json:async()=>({ok:true,session:createState()})};}),r=replyForm();
 h.run("selected={ref:'same-session'};detailVersion=1;composer={field:'a1',form:{draft:'Nháp comment cần giữ'}};renderDetail=()=>{composer=null;};readActivity=async()=>{};refresh=async()=>{};");
 h.get('comment-text').value='Góp ý legacy';h.get('comment-section').value='b1';
 await h.get('comment-form').handlers.submit({preventDefault(){}});
 assert.equal(h.run('composer.form.draft'),'Nháp comment cần giữ');
 await h.get('detail-content').handlers.submit(r.event);
 assert.equal(h.run('composer.form.draft'),'Nháp comment cần giữ');assert.equal(calls,0);
});
test('T-TEACHER-UI-COMPOSER-HASH · chuẩn bị hộp góp ý chậm không mở giữa lượt reply đang gửi',async()=>{
 let hashResolve,ackResolve;const hash=new Promise(r=>hashResolve=r),ack=new Promise(r=>ackResolve=r);
 const h=fixture(async()=>({ok:true,status:200,json:()=>ack})),r=replyForm(),opening=replyForm('');
 opening.form.className='';opening.form.elements.body.focus=()=>{};opening.form.querySelector=()=>({addEventListener(){}});
 h.context.document.createElement=()=>opening.form;h.context.fieldHash=()=>hash;
 h.context.fieldRoot={dataset:{selectField:'a1'},isConnected:true,closest:()=>({append(){}}),focus(){}};
 h.run("selected={ref:'same-session'};detailSession={responses:{a1:'Điểm A'}};renderDetail=()=>{composer=null;};readActivity=async()=>{};");
 const openingTask=h.run('startComposer(fieldRoot)');const replyTask=h.get('detail-content').handlers.submit(r.event);
 hashResolve('field-hash');await openingTask;
 assert.equal(h.run('composer'),null);
 ackResolve({ok:true,session:createState()});await replyTask;
});
test('T-TEACHER-UI-IDENTITY · ACK mất rồi đổi giảng viên không POST retry sang người mới',async()=>{
 let calls=0,h;
 h=fixture(async()=>{calls++;return {ok:true,status:200,json:async()=>{h.run('epoch++;');throw new TypeError('Lost ACK body after commit');}};});
 await assert.rejects(h.run("request('/sessions/fixture/comments','POST',{requestId:'same',feedback:'A wrote this'})"),e=>e.message==='IDENTITY_CHANGED');
 assert.equal(calls,1);
});
test('T-TEACHER-UI-LATE · read detail cũ sau ACK góp ý không ghi đè nhận xét mới',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const h=fixture(async()=>({ok:true,status:200,json:()=>pending}));
 h.run("selected={ref:'same-session'};renderDetail=s=>{detailVersion=s.version;};");
 const read=h.run("readDetail('same-session')");
 h.run('detailSequence++;detailVersion=2;');resolve({ok:true,session:{version:1}});await read;
 assert.equal(h.run('detailVersion'),2);
});
