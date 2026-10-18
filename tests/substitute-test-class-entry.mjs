// Kiểm luồng nhận metadata lớp thử: chỉ yêu cầu trên link riêng, không nới lớp lạ hoặc đổi epoch.
import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../term-tests/substitute-shared/state.js',import.meta.url),'utf8');
const epoch='11111111-1111-4111-8111-111111111111';
async function open(slug,search,classes){let body;const c=vm.createContext({AbortController,setTimeout,clearTimeout,location:{search},window:{addEventListener(){}},fetch:async(_url,options)=>{body=JSON.parse(options.body);return{ok:true,json:async()=>({testSlug:slug,historyEpoch:epoch,stateVersion:2,maintenance:false,classes})};}});vm.runInContext(source,c);const result=await c.window.SUBSTITUTE_STATE.initialize({slug},{API_BASE_URL:'https://fixture.test'});return{body,result};}
const normal=[{code:'DEMO',name:'Demo'},{code:'IC2304',name:'IC2304'}],qa={code:'CODEXID261018',name:'[THỬ] Nhận diện chéo'};
for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
 test(slug+': link thường giữ nguyên yêu cầu và danh sách',async()=>{const r=await open(slug,'?class=IC2304',normal);assert.deepEqual(r.body.payload,{});assert.equal(r.result.historyEpoch,epoch);});
 test(slug+': link riêng yêu cầu đúng lớp thử và giữ epoch',async()=>{const r=await open(slug,'?class=CODEXID261018',[...normal,qa]);assert.equal(r.body.payload.qaClass,'CODEXID261018');assert.equal(r.result.historyEpoch,epoch);assert.equal(r.result.classes.at(-1).code,qa.code);});
 test(slug+': không nhận lớp thử ngoài link riêng hoặc lớp lạ',async()=>{await assert.rejects(()=>open(slug,'',[...normal,qa]),/Danh sách lớp/);await assert.rejects(()=>open(slug,'?class=CODEXID261018',[...normal,{code:'UNKNOWN',name:'Unknown'}]),/Danh sách lớp/);});
}
