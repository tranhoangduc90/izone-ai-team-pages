import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ORDER,FIELDS} from '../lesson5-demo/core.mjs';
// Source giảng viên thật, dữ liệu giả: không để retry hoặc read muộn vượt ranh giới đăng nhập.
function fixture(fetcher){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{addEventListener(){},hidden:false,textContent:'',innerHTML:'',value:'',dataset:{}});return elements.get(id);};
 const context=vm.createContext({ORDER,FIELDS,installStyles(){},fetch:fetcher,document:{getElementById:get,querySelectorAll:()=>[]},AbortSignal,JSON,String,Object,Number,Date,crypto,Error,Promise,setTimeout,clearInterval,setInterval,window:{}});
 const source=fs.readFileSync(new URL('./teacher.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('void boot();','');vm.runInContext(source,context);
 return {run:code=>vm.runInContext(code,context),context};
}
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
