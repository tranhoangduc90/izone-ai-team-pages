// Máy chủ demo chỉ đọc bản chụp riêng tư. Các thao tác thử chỉ đổi bộ nhớ của tiến trình.
// Không có kết nối cơ sở dữ liệu, Portal hay API production; file gốc không bị ghi lại.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createDemoStore} from './demo-store.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = process.env.PROGRESS_DEMO_SNAPSHOT;
if (!snapshotPath) throw new Error('Cần đặt PROGRESS_DEMO_SNAPSHOT trỏ tới bản chụp riêng tư ngoài thư mục source.');
const rawBytes = await readFile(snapshotPath), raw = JSON.parse(rawBytes.toString('utf8'));
const sourceHash = createHash('sha256').update(rawBytes).digest('hex');
const store=createDemoStore(raw);
const port=Number(process.env.PORT||7163);
const staticFiles = new Map([
  ['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/theme.css','theme.css'],['/model.mjs','model.mjs'],
  ['/shared/answer-review.js','../answer-review.js'],['/shared/legacy-sentences.js','../legacy-sentences.js']
]);
staticFiles.set('/fonts.css','fonts.css');
staticFiles.set('/completion.css','completion.css');
staticFiles.set('/pages-adapter.mjs','pages-adapter.mjs');
staticFiles.set('/demo-store.mjs','demo-store.mjs');
staticFiles.set('/editor-bridge.mjs','editor-bridge.mjs');
staticFiles.set('/worksheet-model.js','worksheet-model.js');
staticFiles.set('/library-model.js','library-model.js');
staticFiles.set('/exercise-editor.js','exercise-editor.js');
staticFiles.set('/exercise-editor.css','exercise-editor.css');
staticFiles.set('/exercise-ai.js','exercise-ai.js');
staticFiles.set('/exercise-ai.css','exercise-ai.css');
staticFiles.set('/exercise-ai-model.js','exercise-ai-model.js');

for (let i=0;i<6;i++) staticFiles.set(`/fonts/geologica-${i}.woff2`,`fonts/geologica-${i}.woff2`);
const server=http.createServer(async(req,res) => {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  const send=(status,body,type='application/json; charset=utf-8') => {res.writeHead(status,{'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(body):body);};
  try {
    if (!['127.0.0.1','localhost'].some(h => req.headers.host===`${h}:${port}`)) return send(403,{error:'Chỉ mở từ máy này.'});
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    if (req.method==='GET' && url.pathname==='/api/health') return send(200,{ok:true,mode:'private_snapshot',sourceHash,capturedAt:store.metadata().capturedAt});
    if (req.method==='GET' && url.pathname==='/api/teacher') return send(200,store.teacher());
    if (req.method==='GET' && url.pathname==='/api/student') {
      return send(200,store.student(url.searchParams.get('number'),url.searchParams.get('ref'),url.searchParams.get('generation')));
    }
    if (req.method==='POST' && url.pathname==='/api/demo') {
      const origin=req.headers.origin;
      if (origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin)) return send(403,{error:'Không nhận thao tác từ website khác.'});
      if (!String(req.headers['content-type']).startsWith('application/json')) return send(415,{error:'Cần dữ liệu JSON.'});
      const chunks=[];let length=0;
      for await (const chunk of req) {length+=chunk.length;if(length>150000) return send(413,{error:'Nội dung quá lớn.'});chunks.push(chunk);}
      return send(200,store.mutate(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
    }
    if (req.method!=='GET' || !staticFiles.has(url.pathname)) return send(404,{error:'Không có đường dẫn này.'});
    const file=staticFiles.get(url.pathname), bytes=await readFile(path.resolve(root,file));
    const type=file.endsWith('.woff2')?'font/woff2':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'text/javascript';
    send(200,bytes,`${type}; charset=utf-8`);
  } catch(error) {send(error.status||400,{error:error.message || 'Không thực hiện được. Dữ liệu gốc không thay đổi.'});}
});
server.listen(port,'127.0.0.1',() => console.log(JSON.stringify({ok:true,url:`http://127.0.0.1:${port}`,mode:'private_snapshot',capturedAt:store.metadata().capturedAt})));
