import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),out=process.env.DEMO_EVIDENCE_DIR;assert.ok(out);await fs.mkdir(out,{recursive:true});
const codes=['67-listening-scandinavian-studies','67-practice-listening_mcq_flowchart','67-practice-listening_c20_t3_p4_inclusive_design','67-practice-listening_c19_t4_p4_tree_planting'];
const server=process.env.DEMO_PUBLIC_BASE?null:await serveDirectory(root),base=process.env.DEMO_PUBLIC_BASE||server.origin+'/';
const browser=await chromium.launch({channel:'chrome',headless:true});const rows=[];
try{for(const code of codes){const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 try{await page.goto(new URL('homework-demo/'+code+'.html',base).href);await page.locator('body[data-demo-ready="true"]').waitFor();const hw=code==='67-listening-scandinavian-studies',audio=hw?'#audio':'#demo-audio';
  if(hw)await page.locator('#play').click();else{await page.locator('#demo-audio-prepare').click();await page.waitForFunction(()=>document.querySelector('#demo-audio')?.readyState>=1,{},{timeout:90000});await page.locator(audio).click({position:{x:18,y:18}});}
  await page.waitForFunction(selector=>{const a=document.querySelector(selector);return a&&!a.paused&&a.currentTime>0;},audio,{timeout:90000});
  const actual=await page.locator(audio).evaluate(a=>({duration:a.duration,currentTime:a.currentTime,paused:a.paused,readyState:a.readyState}));
  assert.ok(actual.duration>100);assert.deepEqual(errors,[]);assert.equal(requests.filter(r=>/ducizone\.ddns\.net|accounts\.google/.test(r.url)).length,0);
  rows.push({code,passed:true,...actual,sourceRequests:requests.filter(r=>/workers\.dev|\.mp3/.test(r.url)).length});console.log(JSON.stringify(rows.at(-1)));
 }catch(error){rows.push({code,passed:false,error:error.message,errors});console.log(JSON.stringify(rows.at(-1)));}finally{await context.close();}
}}finally{await browser.close();await server?.close();await fs.writeFile(path.join(out,'audio-results.json'),JSON.stringify(rows,null,2));}
assert.equal(rows.filter(x=>x.passed).length,4,JSON.stringify(rows.filter(x=>!x.passed)));
