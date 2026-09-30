// Bản xem trước chỉ dùng dữ liệu giả, không gọi AI, không đọc bài học viên hoặc ghi Portal.
// Chạy: node tests/fixtures/substitute-writing-preview.mjs rồi mở http://127.0.0.1:4185/
import http from 'node:http';
import fs from 'node:fs';
const root=new URL('../../',import.meta.url);
const modules={k56:'substitute-k56-shared',k56sub2:'substitute-test-2-k56-shared',k67:'substitute-k67-shared'};
const names=['cleanWritingFeedback','writingReportSummary','looksLikeWritingHtml','appendSanitizedWritingHtml','appendSafeWritingFeedback','writingCriterionSections','writingCriterionFallbackSummary','writingCriterionConclusion','appendWritingComponent','openWritingFeedback'];
let probes=0;
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4185');
  if(url.pathname==='/probe'){probes++;res.writeHead(204);res.end();return;}
  if(url.pathname==='/count'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({probes}));return;}
  if(url.pathname!=='/'){res.writeHead(404);res.end();return;}
  const module=modules[url.searchParams.get('module')]||modules.k67;
  const taskNumber=module===modules.k56sub2?1:2;
  const source=fs.readFileSync(new URL('term-tests/'+module+'/app.js',root),'utf8');
  const helpers=names.map(name=>{
    const start=source.indexOf('  function '+name+'('),end=source.indexOf('\n  function ',start+1);
    if(start<0)throw new Error('Thiếu helper '+name);
    return source.slice(start,end);
  }).join('\n');
  const route=module===modules.k67?'substitute-test-1-k67':module===modules.k56sub2?'substitute-test-2-k56':'substitute-test-1-k56';
  const css=fs.readFileSync(new URL('term-tests/'+route+'-computer-based/styles.css',root),'utf8').replace(/@import[^;]+;/g,'');
  const essay='This synthetic paragraph is used to review the new feedback layout. It is not a student submission and does not trigger grading. '.repeat(6);
  const model={taskNumber,taskScore:7,report:'<h2>Nhận xét tổng hợp</h2><p>Bài mẫu có luận điểm rõ. Cần bổ sung ví dụ và liên kết ý cụ thể hơn.</p><table><tr><th>Điểm mạnh</th><th>Cần cải thiện</th></tr><tr><td>Diễn đạt rõ ràng</td><td>Phát triển ví dụ</td></tr></table><img/src="/probe"><iframe src="/probe"></iframe><script>window.previewUnsafe=true;</script>',criteria:[taskNumber===1?'TA':'TR','CC','LR','GRA'].map(code=>({code,bandScore:7,feedback:'### **1. Triển khai ý**\nTóm tắt minh họa cho giao diện.\n### **2. Tính rõ ràng**\nNội dung minh họa thứ hai.\n### **3. Độ chính xác**\nNội dung minh họa thứ ba.\n### **KẾT LUẬN**\nBài mẫu đạt mức 7. Cần phát triển dẫn chứng để nâng chất lượng lập luận.',components:Array.from({length:code==='GRA'?1:3},(_,i)=>({label:'Khía cạnh '+(i+1),feedback:'Phân tích minh họa: giữ ý chính rõ ràng, bổ sung ví dụ cụ thể và đối chiếu cách diễn đạt.\n\n**Cách cải thiện:** viết lại câu với dẫn chứng rõ hơn.'}))}))};
  const setup=`const writingConfig={tasks:[{id:'task${taskNumber}',label:'Writing Task ${taskNumber}',prompt:'Đề minh họa — chỉ xem giao diện, không phải đề thi thật.'}]};
  const state={drafts:{writing:{task${taskNumber}:${JSON.stringify(essay+'\n\n'+essay)}}}};
  const formatBand=String;const countWords=s=>s.trim().split(/\\s+/).length;const criterionTitle=s=>s;
  openWritingFeedback(${JSON.stringify(model).replace(/</g,'\\u003c')});`;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Xem trước nhận xét Writing — dữ liệu giả</title><style>'+css+'</style><body><h1>Bản xem trước — không gửi bài</h1><script>'+helpers+'\n'+setup+'</script></body></html>');
}).listen(4185,'127.0.0.1',()=>console.log('Synthetic Writing preview: http://127.0.0.1:4185/'));
