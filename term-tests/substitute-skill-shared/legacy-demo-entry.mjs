import {legacyProfile} from './class-directory.mjs';

// Only the DEMO branch uses the skill runtime. Real routes retain their controller.
export async function bootLegacyDemo(){
 if(window.IZONE_EXAM_DEVICE_BLOCKED)return;
 const profile=legacyProfile();if(!profile||new URL(location.href).searchParams.get('class')!=='DEMO')throw Error('LEGACY_DEMO_SCOPE_INVALID');
 document.body.dataset.test=profile.testId;document.body.dataset.skill=profile.skill;document.body.dataset.legacyDemo='true';
 // Legacy confirmation dialogs live outside #app; do not leave duplicate IDs.
 document.querySelectorAll('body > dialog').forEach(dialog=>dialog.remove());
 const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='../substitute-skill-shared/native-shell.css';document.head.append(sheet);
 const {mountNativeShell}=await import('./native-shell.mjs?v=20261118-parity12-v1');mountNativeShell();
 document.getElementById('class').addEventListener('change',event=>{
  if(!event.target.value||event.target.value==='DEMO')return;
  event.stopImmediatePropagation();const url=new URL(location.href);url.searchParams.delete('class');if(profile.testId.includes('k56-listening'))url.searchParams.set('course','56');location.assign(url);
 },true);
 await import(profile.skill==='listening'?'./objective-controller-listening-report-v1.mjs?v=20261118-parity12-v1':'./objective-controller.mjs?v=20261118-parity12-v1');
}
