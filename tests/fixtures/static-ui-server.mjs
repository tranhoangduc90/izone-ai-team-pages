import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function serveDirectory(root){
 root=path.resolve(root);
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'};
 const server=http.createServer(async(req,res)=>{
  try{const u=new URL(req.url,'http://local'),relative=decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''),file=path.resolve(root,'.'+relative);
   if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   const bytes=await fs.readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
