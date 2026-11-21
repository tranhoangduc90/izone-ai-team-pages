import {connectExamJournal as connectMiniDemoJournal} from './bridge-mini-demo-journal-v1.mjs';
import {connectExamJournal} from './bridge-audio-status-v1.mjs?v=20261024-startup-v2&resilience=20261027-v1&diagnostics=20261105-v2&miniAudio=20261108-v1&termEof=20261108-v1&termK56Audio=20261108-v1&audioStatus=20261111-audio-milestones-v2';

// No learner credentials are reconstructed here. Native app adoption supplies them later.
export function connectAudioCapture(metadata,{classCodeHint}={}){
 const win=globalThis.window,cfg=win?.TERM_TEST_APP_CONFIG,slug=win?.TERM_TEST_CONFIG?.slug;
 if(cfg?.EXAM_JOURNAL_ENABLED!==true||typeof slug!=='string'||!metadata)return null;
 const existing=win.EXAM_JOURNAL_AUDIO_TRANSFER;
 const endpoint=cfg.EXAM_JOURNAL_BASE_URL||(slug.startsWith('substitute-')
  ?new URL(cfg.API_BASE_URL,win.location.href).origin+'/substitute-journal-api/'+slug
  :cfg.API_BASE_URL+'/api/term-tests/'+slug);
 const classCode=classCodeHint||new URL(win.location.href).searchParams.get('class')||'';
 const demo=slug==='mini-test-k56'&&endpoint==='https://ducizone.ddns.net/mapping-api-demo/api/term-tests/mini-test-k56'
  &&classCode.trim().toUpperCase()==='CODEXDEMO56';
 const connect=demo?connectMiniDemoJournal:connectExamJournal;
 const bridge=existing?null:connect({enabled:true,endpoint,testSlug:slug,build:cfg.EXAM_JOURNAL_BUILD||'unknown',
  submissionMetadataOnly:demo,
  getState:()=>({stage:'audio-loading',classCode,generation:0,drafts:{}})});
 return (existing||((meta,options)=>bridge.startAudioTransfer(meta,options)))(metadata,{forceUnconfirmed:true,classCodeHint});
}
