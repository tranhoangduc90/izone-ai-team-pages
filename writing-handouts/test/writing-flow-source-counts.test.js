import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { collectWritingPairs, sourceIssueAlreadyDelivered, sourceIssueMatchesPair,
  withinWritingRange } from '../js/writing-flow-overview.js';

const source=fs.readFileSync(process.env.WRITING_SOURCE_COUNT_FILE || new URL('../js/writing-flow-v2.js',import.meta.url),'utf8');
const stages=['intake','precheck','main','critic','arbiter','render','deliver'];
function snippet(start,end){const at=source.indexOf(start);return source.slice(at,source.indexOf(end,at));}
function node(){return {children:[],dataset:{},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;}};}
function contextFor(issues,peers=[]){const root=node();return { root, stages, state:{counts:{stages:[]},journeyIssues:[],sourcePairCache:new Map(),refreshGeneration:1,
  api:{writingSourceIssues:async()=>({data:{issues}}),writingPairsPage:async filters=>({data:{pairs:peers.filter(p=>p.homework_file_id===filters.search)}})}},
  $:()=>root,document:{createElement:node},isTestView:()=>false,selectView(){},
  stageNames:Object.fromEntries(stages.map(s=>[s,s])),testStageNames:{},
  actionButton:()=>node(),makeText:(tag,text)=>({tag,text}),collectWritingPairs,
  sourceIssueAlreadyDelivered,sourceIssueMatchesPair,withinWritingRange };}
const issue=(doc,extra={})=>({homework_file_id:doc,source_app_id:'demo-app',source_table_id:'demo-table',source_record_id:'demo-record-'+doc,source_link_index:1,essay_slot:null,first_seen_at:'2026-10-13T01:00:00Z',...extra});
function load(context){vm.createContext(context);const counts=source.includes('function stageCounts(')?snippet('function stageCounts(', '\nfunction renderStageQuick()'):'';vm.runInContext(counts+'\n'+snippet('async function visibleSourceIssues(', '\nasync function loadView()')+'\n'+snippet('function renderJourney()', '\nfunction setupV2Filters('),context);}
async function intakeCard(context,sourceKind='homework'){const groups=await context.visibleSourceIssues({sourceKind},true);context.state.journeyIssues=groups.unpaired;context.renderJourney();return context.root.children.find(n=>n.className==='flow-journey-grid').children[0].children[0];}

test('8 file lỗi trước khi tạo bài vẫn hiện 8 bài tiếp nhận và 8 cần kiểm tra',async()=>{
  const context=contextFor(Array.from({length:8},(_,i)=>issue('demo-doc-'+i)));load(context);
  const card=await intakeCard(context);
  assert.equal(card.children[2].text,'8 bài ở bước');assert.equal(card.children[3].text,'8 cần kiểm tra');
});

test('cộng lỗi nguồn chưa có bài vào các bài tiếp nhận; không đếm đôi bản ghi đã có',async()=>{
  const a=issue('doc-a'),b=issue('doc-b');
  const context=contextFor([a,b], [{...a,pair_id:'demo-a',status:'needs_review',stage_key:'intake',essay_slot:1}]);
  context.state.counts.stages=[{stage_key:'intake',stage_status:'pending',pair_count:2},{stage_key:'intake',stage_status:'needs_review',pair_count:1}];load(context);
  const card=await intakeCard(context);assert.equal(card.children[2].text,'4 bài ở bước');assert.equal(card.children[3].text,'2 cần kiểm tra');
});

test('loại nguồn đã giao đúng ô, giữ lỗi ở ô khác và gom cảnh báo lặp cùng nguồn',async()=>{
  const a=issue('doc-a',{essay_slot:1}),b=issue('doc-a',{essay_slot:2});
  const context=contextFor([a,b,{...b,issue_key:'another-reason'}],[{...a,pair_id:'demo-a',status:'delivered',lms_url:'https://example.invalid/result'}]);load(context);
  const card=await intakeCard(context);assert.equal(card.children[2].text,'1 bài ở bước');assert.equal(card.children[3].text,'1 cần kiểm tra');
});

test('đối chiếu lại trạng thái ở lượt cập nhật mới để bài vừa giao không còn bị tính lỗi',async()=>{
  const a=issue('doc-a');const context=contextFor([a]);load(context);
  assert.equal((await intakeCard(context)).children[2].text,'1 bài ở bước');
  context.state.refreshGeneration+=1;
  context.state.api.writingPairsPage=async()=>({data:{pairs:[{...a,pair_id:'demo-a',status:'delivered',lms_url:'https://example.invalid/result'}]}});
  assert.equal((await intakeCard(context)).children[2].text,'0 bài ở bước');
});

test('các ô hoặc link nguồn khác nhau cùng Docs không bị gộp mất',async()=>{
  const a=issue('doc-a',{essay_slot:1});const context=contextFor([a,{...a,essay_slot:2},{...a,source_link_index:2}]);load(context);
  assert.equal((await intakeCard(context)).children[2].text,'3 bài ở bước');
});

test('nguồn Test được tính riêng ở tiếp nhận Test, không lẫn vào Homework',async()=>{
  const context=contextFor([issue('doc-homework'),issue('doc-test',{source_type:'term_test'})]);load(context);
  assert.equal((await intakeCard(context)).children[2].text,'1 bài ở bước');
  context.isTestView=()=>true;
  assert.equal((await intakeCard(context,'test')).children[2].text,'1 bài ở bước');
});
