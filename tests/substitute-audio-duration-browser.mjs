// Chỉ đọc metadata audio thật trong repo; không phát bài, không gọi API/AI/Portal.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createRequire} from 'node:module';
const root=path.resolve(new URL('../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const {chromium}=createRequire('C:/Users/vukha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const server=createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!p.startsWith(root+path.sep)||!p.endsWith('.mp3'))return res.writeHead(403).end();try{res.setHeader('Content-Type','audio/mpeg');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true}),values=[];
try{const page=await browser.newPage();for(const[slug,expected]of Object.entries({'substitute-test-1-k56':1728.535488,'substitute-test-2-k56':1708.097732,'substitute-test-1-k67':1688.64,'substitute-test-2-k67':1745.057958})){
 await page.setContent('<audio preload="metadata" src="'+base+'/term-tests/'+slug+'-computer-based/assets/private/listening-'+slug+'.mp3"></audio>');
 await page.waitForFunction(()=>Number.isFinite(document.querySelector('audio').duration));const seconds=await page.locator('audio').evaluate(a=>a.duration);
 values.push({slug,seconds,expected});
}console.log(JSON.stringify({values,aiCalls:0,portalWrites:0}));for(const row of values)assert.ok(Math.abs(row.seconds-row.expected)<1,JSON.stringify(row));console.log(JSON.stringify({ok:true}));}finally{await browser.close();await new Promise(r=>server.close(r));}
