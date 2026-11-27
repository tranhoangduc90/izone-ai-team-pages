import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import test from 'node:test';
import {installListeningEofRecorder, waitForListeningEof} from './helpers/k67-listening-eof.mjs';

const require=createRequire(process.env.PLAYWRIGHT_MODULE ||
  resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');

test('Trusted EOF survives synchronous removal of the official Listening player',async()=>{
  const browser=await chromium.launch({channel:process.env.K67_BROWSER_CHANNEL||'msedge'});
  try{
    const context=await browser.newContext();
    await installListeningEofRecorder(context);
    const page=await context.newPage();
    await page.goto('data:text/html,<section id="miniJourneyPlayer"></section><audio id="preview"></audio>');
    await page.evaluate(async()=>{
      const player=document.createElement('audio');
      player.id='miniJourneyAudio';
      document.querySelector('#miniJourneyPlayer').append(player);
      const samples=4000;
      const bytes=new DataView(new ArrayBuffer(44+2*samples));
      for(const [offset,word] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']]){
        [...word].forEach((character,index)=>bytes.setUint8(offset+index,character.charCodeAt(0)));
      }
      for(const [offset,field] of [[4,bytes.byteLength-8],[16,16],[24,8000],[28,16000],[40,samples*2]]){
        bytes.setUint32(offset,field,true);
      }
      for(const [offset,field] of [[20,1],[22,1],[32,2],[34,16]])bytes.setUint16(offset,field,true);
      const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
      const preview=document.querySelector('#preview');
      preview.src=url;
      const previewEnded=new Promise(resolve=>preview.addEventListener('ended',resolve,{once:true}));
      await preview.play();
      await previewEnded;
      if(window.k67TestListeningEof)throw new Error('Preview must not count as official EOF');
      player.src=url;
      player.addEventListener('ended',event=>{if(event.isTrusted)player.remove();});
      await player.play();
      player.dispatchEvent(new Event('ended'));
      if(window.k67TestListeningEof)throw new Error('Synthetic EOF must be ignored');
    });
    const eof=await waitForListeningEof(page,4_000);
    assert.equal(eof.playerGeneration,1);
    assert.equal(eof.duration,0.5);
    assert.equal(eof.position,eof.duration);
    // This is the previous polling condition. It cannot find the removed node.
    assert.equal(await page.evaluate(()=>document.getElementById('miniJourneyAudio')?.ended),undefined);
    await page.reload();
    assert.equal(await page.evaluate(()=>window.k67TestListeningEof),null);
  }finally{
    await browser.close();
  }
});
