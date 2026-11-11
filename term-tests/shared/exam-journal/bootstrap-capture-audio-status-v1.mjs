import {connectExamJournal} from './bridge-audio-status-v1.mjs?v=20261024-startup-v2&resilience=20261027-v1&diagnostics=20261105-v2&miniAudio=20261108-v1&termEof=20261108-v1&termK56Audio=20261108-v1&audioStatus=20261111-audio-milestones-v2';

// No learner credentials are reconstructed here. Native app adoption supplies them later.
export function connectAudioCapture(metadata,{classCodeHint}={}){
 const win=globalThis.window,cfg=win?.TERM_TEST_APP_CONFIG,slug=win?.TERM_TEST_CONFIG?.slug;
 if(cfg?.EXAM_JOURNAL_ENABLED!==true||typeof slug!=='string'||!metadata)return null;
 const existing=win.EXAM_JOURNAL_AUDIO_TRANSFER;
 const endpoint=cfg.EXAM_JOURNAL_BASE_URL||(slug.startsWith('substitute-')
  ?new URL(cfg.API_BASE_URL,win.location.href).origin+'/substitute-journal-api/'+slug
  :cfg.API_BASE_URL+'/api/term-tests/'+slug);
 const bridge=existing?null:connectExamJournal({enabled:true,endpoint,testSlug:slug,build:cfg.EXAM_JOURNAL_BUILD||'unknown',
  getState:()=>({stage:'audio-loading',classCode:classCodeHint||'',generation:0,drafts:{}})});
 return (existing||((meta,options)=>bridge.startAudioTransfer(meta,options)))(metadata,{forceUnconfirmed:true,classCodeHint});
}
