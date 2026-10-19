// Chạy callback lịch sử bằng Chrome thật và máy chủ localhost tách riêng từng test.
// Không coi việc Node đọc được một biểu thức async là đã thực thi các assertion trong đó.
const {createServer}=require('node:http');
const {readFile,mkdir}=require('node:fs/promises');
const {resolve,extname,sep}=require('node:path');
const {createRequire}=require('node:module');
const root=resolve(__dirname,'../..');
exports.run=async callback=>{
 const server=createServer(async(req,res)=>{
  try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
   if(!path.startsWith(root+sep))throw Error('Sai phạm vi');
   res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(path)]||'text/plain'));
   res.end(await readFile(path));
  }catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  await mkdir(resolve(root,'output/playwright'),{recursive:true});
  const context=await browser.newContext();
  const page=await context.newPage();page.setDefaultTimeout(7000);
  return await callback(page,{origin:'http://127.0.0.1:'+server.address().port});
 }finally{await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
};
