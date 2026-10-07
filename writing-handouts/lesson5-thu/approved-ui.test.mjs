import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../lesson5-demo/core.mjs';
import {renderJourney,renderProcessing,renderRecap} from './recovery-ui.mjs';
import {savedContent,threadsView,approvalLabel} from './features.mjs';

// Dữ liệu giả chạy renderer thật: kiểm vị trí ô, snapshot và cách mở lịch sử.
// Không gửi bài lên API; lỗi assertion cho biết yêu cầu nào bị sai.
function fixture(){
 const nodes=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,{addEventListener(){},hidden:false,dataset:{},value:'',innerHTML:''});return nodes.get(id);};
 const state=core.createState();state.ref='fixture';state.idea2Open=true;
 for(const key of core.ORDER)state.steps[key].status='passed';
 for(const field of Object.keys(state.responses))state.responses[field]='Bài giả '+field;
 const context=vm.createContext({...core,renderJourney,renderProcessing,renderRecap,savedContent,threadsView,approvalLabel,installStyles(){},createClient:()=>({}),document:{getElementById:get,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},setTimeout:()=>0,clearTimeout(){},JSON,Object,String,Number,Date,Promise});
 const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace('void bootstrap();','');
 vm.runInContext(source,context);context.current=state;vm.runInContext('state=current;',context);
 return {state,run:code=>vm.runInContext(code,context)};
}
for(const key of ['a1','x1','a2','x2'])test('A-POINT-'+key+' · chỉ một ô đọc/chỉnh nằm trong điểm đang làm',()=>{
 const h=fixture();h.state.steps[key].status='revision';
 const html=h.run(`stepCard('${key}')`),active=html.match(/<li[^>]*class="argument-point is-current[\s\S]*?<\/li>/)?.[0]||'';
 assert.match(active,new RegExp(`id="field-${key}"`));
 assert.equal((html.match(new RegExp(`id="field-${key}"`,'g'))||[]).length,1);
 assert.ok(!active.includes('disabled'));
});
test('A-HISTORY · bản gửi trước nhận xét, mới nhất mở và đúng bản cũ',()=>{
 const h=fixture();h.state.steps.a1.history=[
  {number:1,jobRef:'old',status:'revision',snapshot:{a1:'Bản cũ <script>'},feedback:'Nhận xét cũ'},
  {number:2,jobRef:'new',status:'passed',snapshot:{a1:'Bản được chấm'},feedback:'Nhận xét mới'}
 ];
 const html=h.run("comments('a1')");
 assert.ok(html.indexOf('Lần 2')<html.indexOf('Lần 1'));
 assert.match(html,/data-history="new" open/);
 assert.ok(html.indexOf('Nội dung đã gửi')<html.indexOf('Nhận xét AI'));
 assert.match(html,/Nhận xét bản trước/);assert.match(html,/Bản cũ &lt;script&gt;/);
 assert.ok(!html.includes('<script>'));
});
test('A-PASSED · phần đã đạt đọc một vùng, Edit tại chỗ và cộng/trừ',()=>{
 const h=fixture(),html=h.run("stepCard('a1')");
 assert.match(html,/class="prior-step expandable"/);
 assert.match(html,/expand-icon/);
 assert.equal((html.match(/data-edit="a1"/g)||[]).length,1);
 assert.equal((html.match(/id="field-a1"/g)||[]).length,0);
});
test('A-RECAP · toàn ô có trạng thái để tô nền đúng dữ liệu',()=>{
 const h=fixture();h.state.vocabulary={};
 const html=renderRecap(h.state);
 assert.equal((html.match(/<td[^>]*data-status="passed"/g)||[]).length,6);
});
