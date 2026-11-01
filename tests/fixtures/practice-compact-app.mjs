// Real practice router/service/SQL, isolated synthetic identities. Never connects to a live database.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

export async function createPracticeCompactApp({root,product}) {
 const backend=process.env.TEST_SERVICES_NATIVE_PRACTICE_ROOT;
 if(!backend||!path.isAbsolute(backend)||!['reading','listening'].includes(product))throw Error('ISOLATED_PRACTICE_ROOT_REQUIRED');
 const productRoot=path.join(backend,'products',product+'-practice');
 const require=createRequire(path.join(productRoot,'package.json')),express=require('express');
 const {fixture}=await import(pathToFileURL(path.join(productRoot,'test/helpers.js')));
 const {createApp}=await import(pathToFileURL(path.join(productRoot,'src/app.js')));
 const f=await fixture();let server;
 try{
  f.context.classes=async()=>[{id:'1124',classCode:'FIXTURE 67'}];
  const ownerProof={classId:'1124',studentRef:f.studentRef,code:f.content.code,documentId:f.registration.documentId,tabId:f.registration.tabId,courseId:'11',courseWorkId:'22',submissionId:'33',googleUserId:'44',verifiedAt:new Date().toISOString()};
  await f.pool.query(`UPDATE ${product}_practice.binding SET owner_proof=$1 WHERE id=$2`,[ownerProof,f.registered.bindingId]);
  // The browser plays real audio: its native server must use wall time, not the unit fixture's frozen clock.
  const services=await import(pathToFileURL(path.join(productRoot,'src/service.js')));
  f.service=services[product==='reading'?'createReadingService':'createListeningService']({pool:f.pool,context:f.context,clock:Date.now,pageBase:'https://example.test/'+product+'-practice/'});
  let audioFile,audioHash;
  if(product==='listening'){
   const directory=path.join(root,'listening-homework/audio-assets');
   const file=(await fs.readdir(directory)).find(name=>name.endsWith('.mp3'));if(!file)throw Error('LOCAL_APPROVED_AUDIO_REQUIRED');
   audioFile=path.join(directory,file);audioHash=crypto.createHash('sha256').update(await fs.readFile(audioFile)).digest('hex');
   f.content.definition.audio.sha256=audioHash;
   await f.pool.query('UPDATE listening_practice.content SET definition=$1 WHERE code=$2',[f.content.definition,f.content.code]);
  }
  const requests=[],app=express(),controls={holdPulse:null},origins=[];
  app.use((req,res,next)=>{const row={path:req.path,method:req.method,compact:req.query.ack==='compact-v1',started:Date.now()};requests.push(row);const json=res.json.bind(res);res.json=body=>{row.body=body;return json(body);};res.on('finish',()=>{row.status=res.statusCode;row.completed=true;});if(req.path==='/api/pulse'&&controls.holdPulse){const wait=controls.holdPulse;controls.holdPulse=null;row.held=true;wait.then(next);return;}next();});
  app.use(createApp({pool:f.pool,service:f.service,origins,googleClientId:'fixture-only-client',adminKey:'F'.repeat(43),verifyGoogle:async()=>null,staticRoot:root,audioFile,audioHash}));
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const origin='http://127.0.0.1:'+server.address().port,url=new URL(f.registered.entryUrl);url.protocol='http:';url.host=server.address().address+':'+server.address().port;
  origins.push(origin);
  return{...f,origin,url:url.href,requests,controls,async close(){await new Promise(resolve=>server.close(resolve));await f.close();}};
 }catch(error){server?.close();await f.close();throw error;}
}
