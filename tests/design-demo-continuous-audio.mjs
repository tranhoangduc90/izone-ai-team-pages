import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

// Kiểm ranh giới phòng chờ → iframe: phát ngay trong click, không phát lại khi đổi Part.
const path='term-tests/design-demo/real-host.js';
const source=process.env.DESIGN_AUDIO_BASE?execFileSync('git',['show',process.env.DESIGN_AUDIO_BASE+':'+path],{encoding:'utf8'}):fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
async function host({rejectPlay=false}={}){
 const nodes=new Map(),audios=[];
 const element=tag=>({tag,contentWindow:{},dataset:{},paused:true,ended:false,plays:0,append(){},replaceChildren(...c){this.firstElementChild=c[0];},addEventListener(){},removeAttribute(){},load(){},remove(){this.removed=true;},pause(){this.paused=true;},play(){this.plays++;if(rejectPlay)return Promise.reject(Error('blocked'));this.paused=false;return Promise.resolve();}});
 const document={body:{dataset:{demoTools:'off'},append(){}},getElementById(id){if(!['workspace','frame-slot','real-status'].includes(id))return null;if(!nodes.has(id))nodes.set(id,element('div'));return nodes.get(id);},createElement(tag){const el=element(tag);if(tag==='audio')audios.push(el);return el;}};
 const window={TERM_TEST_APP_CONFIG:{API_BASE_URL:'https://api.example'},addEventListener(){}};
 vm.runInNewContext(source,{window,document,URL,URLSearchParams,Date,AbortController,DOMException,location:{search:''},fetch:async()=>({ok:true,json:async()=>({ok:true,content:{},definitionVersion:1}),blob:async()=>new Blob(['audio'])})});
 await new Promise(r=>setImmediate(r));
 const ctx=window.getRealDemoContext(nodes.get('frame-slot').firstElementChild.contentWindow);await ctx.audio();
 return {ctx,audios};
}
test('start plays synchronously before opening Listening and retains the same audio across screen navigation',async()=>{
 const h=await host();const started=h.ctx.startListeningAudio(.4);
 assert.equal(h.audios.length,1);assert.equal(h.audios[0].plays,1);assert.equal(h.audios[0].volume,.4);
 await started;h.audios[0].currentTime=12;h.ctx.navigate('listening');
 assert.equal(h.ctx.getListeningAudio(),h.audios[0]);assert.equal(h.ctx.getListeningAudio().currentTime,12);
 await h.ctx.startListeningAudio(.4);assert.equal(h.audios[0].plays,1);
 h.ctx.stopListeningAudio();assert.equal(h.ctx.getListeningAudio(),null);assert.equal(h.audios[0].removed,true);
});
test('ended audio cannot restart; blocked initial playback is removed so the lobby can retry',async()=>{
 const h=await host();await h.ctx.startListeningAudio(1);h.audios[0].ended=true;
 await assert.rejects(h.ctx.startListeningAudio(1),/không phát lại/);assert.equal(h.audios[0].plays,1);
 const failed=await host({rejectPlay:true});await assert.rejects(failed.ctx.startListeningAudio(1),/blocked/);
 assert.equal(failed.ctx.getListeningAudio(),null);assert.equal(failed.audios[0].removed,true);
});
