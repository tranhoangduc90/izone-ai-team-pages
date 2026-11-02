import {createServer,request as upstreamRequest} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';

// Renderer và hai app/source/auth SQL thật trên dữ liệu tổng hợp, chỉ loopback.
// Chỉ thay config/SSO ở ranh giới trình duyệt; không giả DTO hoặc metadata API.
export async function startSpeakingTeacherFixture(root,{enabled=true,parentEnabled=enabled,sourceOverride=null}={}){
 if(!process.env.SPEAKING_BACKEND_DIR)throw Error('SPEAKING_BACKEND_DIR_REQUIRED');
 const backend=resolve(process.env.SPEAKING_BACKEND_DIR),module=await import(pathToFileURL(resolve(backend,'test/speaking-observation-http-fixture.mjs')).href);
 const {id,code}=await import(pathToFileURL(resolve(backend,'test/speaking-observation-fixture.mjs')).href);
 const f=await module.httpFixture({enabled,parentEnabled,nativeTeacher:true}),requests=[],sockets=new Set(),timers=new Set();
 const control={cookie:module.cookie,failures:[],delays:[]};let server;
 try{
  server=createServer(async(req,res)=>{
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname.startsWith('/mapping-api/api/')){
    const path=url.pathname.slice('/mapping-api'.length),legacy=!path.startsWith('/api/speaking-homework-independent/');
    const target=new URL((legacy?f.parent:f.independent).split('/api/')[0]+path+url.search);
    const record={path,query:url.search,method:req.method,at:Date.now(),status:null,bytes:0};requests.push(record);
    const failureIndex=control.failures.findIndex(item=>item.path===path);
    if(failureIndex>=0){const failure=control.failures.splice(failureIndex,1)[0];record.status=failure.status;
     return res.writeHead(failure.status,{'content-type':'application/json',...(failure.retryAfter?{'retry-after':String(failure.retryAfter)}:{})}).end(JSON.stringify({ok:false,error:'FIXTURE_READ_FAILURE',message:'Lỗi đọc thử có kiểm soát.'}));}
    const delayIndex=control.delays.findIndex(item=>item.path===path),delay=delayIndex<0?0:control.delays.splice(delayIndex,1)[0].ms;
    const upstream=upstreamRequest(target,{method:req.method,headers:{cookie:control.cookie,origin:module.origin,
     ...(req.headers['content-type']?{'content-type':req.headers['content-type']}:{})}},response=>{
     record.status=response.statusCode;
     const headers={...response.headers};delete headers['set-cookie'];delete headers['access-control-allow-origin'];delete headers['access-control-allow-credentials'];
     const pipe=()=>{if(res.destroyed){response.destroy();return;}res.writeHead(response.statusCode,headers);response.on('data',chunk=>record.bytes+=chunk.length);response.pipe(res);};
     if(delay){const timer=setTimeout(()=>{timers.delete(timer);pipe();},delay);timers.add(timer);}else pipe();
    });
    res.once('close',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json'});res.end('{"ok":false,"error":"FIXTURE_PROXY_ERROR"}');});
    req.pipe(upstream);return;
   }
   if(url.pathname==='/term-tests/shared/config.js')return res.writeHead(200,{'content-type':'text/javascript'}).end('window.TERM_TEST_APP_CONFIG={API_BASE_URL:"/mapping-api",GOOGLE_CLIENT_ID:"fixture-google-client"};');
   if(url.pathname==='/shared/teacher-single-sign-on.js')return res.writeHead(200,{'content-type':'text/javascript'}).end('window.IzoneTeacherSso={restore:async()=>({ok:true})};');
   const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root+sep))return res.writeHead(403).end();
   try{
    const body=sourceOverride&&url.pathname==='/shared/teacher-progress.js'?await readFile(sourceOverride):await readFile(path);
    res.writeHead(200,{'content-type':({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream'});res.end(body);
   }catch{res.writeHead(404).end();}
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return{...f,id,code,requests,control,origin:`http://127.0.0.1:${server.address().port}`,
   async wake(){await Promise.all([f.observation?.wake(),f.parentObservation?.wake()]);},
   async close(){for(const timer of timers)clearTimeout(timer);for(const socket of sockets)socket.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await f.close();}
  };
 }catch(error){server?.closeAllConnections();server?.close();await f.close();throw error;}
}
