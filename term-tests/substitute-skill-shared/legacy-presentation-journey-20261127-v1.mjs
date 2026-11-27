import {bootstrapMarkup,createNativeResultViews} from '../substitute-shared/native-exam-ui.mjs';
import {makeSubstituteBackup} from '../substitute-shared/backup-export-submission-recovery-v1.mjs?v=20261112-submission-recovery-v1';

const labels={listening:'Listening',reading:'Reading'};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
let explanationReady;
function loadExplanations(sourceSlug){
 if(!explanationReady)explanationReady=(async()=>{
  const css=node('link');css.rel='stylesheet';css.href='../k67-shared/answer-explanations.css?v=20261021-substitute-v1';document.head.append(css);
  for(const path of ['../k67-shared/review-audio.js?v=20261026-term1-replay1',sourceSlug.endsWith('k67')?'../k67-shared/answer-explanations.js?v=20261111-k67-makeup-v1':'../ic2311-retake-review/answer-explanations.js?v=20261107-1'])await new Promise((resolve,reject)=>{const script=node('script');script.src=path;script.onload=resolve;script.onerror=reject;document.head.append(script);});
 })();
 return explanationReady;
}

// Presentation and explicit user actions only. The legacy controller owns the attempt.
export function connectLegacyPresentation({skill,sourceSlug,getState,storage,persist,beforeLeave,release,isBusy,isReady=()=>true,onPrepare,readReview}){
 const $=id=>document.getElementById(id),header=document.querySelector('#app>.topbar'),main=$('page-shell');
 document.body.dataset.substituteInlineResult='true';document.body.classList.add('single-skill');
 // The existing Reading worker reserves result=0 for staying in the exam shell.
 // Set it before preparation registers/activates a worker; old cached clients keep their bridge.
 if(skill==='reading'){const url=new URL(location.href);url.searchParams.set('result','0');history.replaceState(history.state,'',url);}
 const sheet=node('link');sheet.rel='stylesheet';sheet.href='../substitute-skill-shared/native-shell.css';document.head.append(sheet);
 const identity=$('identityView'),oldLearner=$('learner'),nameSelect=$('studentSelect')||node('select');
 nameSelect.id='studentSelect';nameSelect.disabled=true;nameSelect.setAttribute('aria-label','Họ và tên đã xác nhận');
 if(!oldLearner?.matches('option')){const option=node('option',oldLearner?.textContent||'');option.id='learner';nameSelect.replaceChildren(option);}
 const copy=node('div',undefined,'identity-copy'),title=node('h2','Họ và tên đã xác nhận');title.id='identityTitle';
 const classLabel=$('classLabel')||$('class-label')||node('p');classLabel.hidden=true;copy.append(classLabel,title);
 const selectLabel=node('label',undefined,'cbt-student-select');selectLabel.append(nameSelect);identity.replaceChildren(copy,selectLabel);
 const change=node('button','Đổi người học','button button-secondary'),download=node('button','Tải bài làm về máy','button button-secondary substitute-backup-download');
 change.type=download.type='button';change.id='legacy-change-person';download.id='legacy-download-work';header.insertBefore(change,identity);header.insertBefore(download,identity);
 const reference=node('div');reference.innerHTML=bootstrapMarkup({sourceSlug});
 const lobby=$('lobby'),refHeader=reference.querySelector('.cbt-lobby-header');
 if(skill==='listening'&&refHeader)lobby.querySelector('.cbt-lobby-header').replaceChildren(...refHeader.cloneNode(true).childNodes);
 for(const[oldId,newId]of[['download-step','bootstrapDownloadStep'],['preview-step','bootstrapPreviewStep'],['start-step','bootstrapStartStep']]){
  if(skill!=='listening')break;const old=$(oldId),ref=reference.querySelector('#'+newId);if(old&&ref)old.querySelector('h3').textContent=ref.querySelector('h3').textContent;
 }
 $('prepare').hidden=true;document.querySelectorAll('.retake-checks').forEach(e=>e.hidden=true);
 const confirm=node('dialog',undefined,'cbt-identity-confirm');confirm.id='legacy-confirm-identity';
 confirm.append(node('h2','Xác nhận thông tin dự thi'),node('p'));
 const actions=node('div',undefined,'cbt-confirm-actions'),cancel=node('button','Quay lại chọn tên','button button-secondary'),accept=node('button','Đúng thông tin, tiếp tục','button button-primary');cancel.type=accept.type='button';actions.append(cancel,accept);confirm.append(actions);document.body.append(confirm);
 const cancelSelection=()=>{confirm.close();$('student').value='';$('prepare').disabled=true;$('student').focus();};cancel.onclick=cancelSelection;confirm.addEventListener('cancel',e=>{e.preventDefault();cancelSelection();});
 $('student').addEventListener('change',()=>{if(isBusy()||getState()?.identity||!$('student').value)return;confirm.querySelector('p').textContent=$('student').selectedOptions[0].textContent+' · '+$('class').value;accept.disabled=!isReady();if(!confirm.open)confirm.showModal();});
 $('class').addEventListener('change',()=>{if(confirm.open)confirm.close();});
 accept.onclick=()=>{if(isBusy()||!isReady()||!confirm.open||!$('student').value)return;confirm.close();void onPrepare();};
 const changeDialog=node('dialog',undefined,'cbt-identity-confirm');changeDialog.append(node('h2','Đổi người dự thi?'),node('p','Bài làm và thời gian hiện tại được giữ. Bạn có thể chọn lại người này để tiếp tục đúng lượt.'));
 const changeActions=node('div',undefined,'cbt-confirm-actions'),stay=node('button','Tiếp tục làm','button button-secondary'),leave=node('button','Xác nhận đổi người','button button-primary');stay.type=leave.type='button';changeActions.append(stay,leave);changeDialog.append(changeActions);document.body.append(changeDialog);change.onclick=()=>{if(!isBusy())changeDialog.showModal();};stay.onclick=()=>changeDialog.close();
 const key=(code,ref)=>'substitute-parity-person:'+sourceSlug+':'+skill+':'+code+':'+ref;
 leave.onclick=async()=>{
  if(isBusy())return;leave.disabled=true;
  try{await beforeLeave();const state=getState();if(state?.identity){await persist();await storage.put(key(state.identity.classCode,state.identity.studentRef),structuredClone(state));}release();await storage.clear('current',{attemptId:state.identity.attemptId,generation:state.identity.generation});const preparation=await storage.get('preparation');if(preparation?.studentRef===state.identity.studentRef)await storage.clear('preparation',{operationId:preparation.operationId});const url=new URL(location.href);url.searchParams.delete('class');location.replace(url);}
  catch{leave.disabled=false;changeDialog.querySelector('p').textContent='Chưa hoàn tất đổi người. Giữ nguyên trang và dữ liệu; tải lại để tiếp tục bài cũ.';}
 };
 download.onclick=()=>{
  const state=getState();if(!state?.identity)return;
  const scope={testSlug:state.identity.testSlug||sourceSlug,sourceSlug,skill,classCode:state.identity.classCode,studentRef:state.identity.studentRef,clientRunId:state.identity.attemptId};
  const out=makeSubstituteBackup({scope,lobby:{studentName:state.learnerName||state.name},app:{drafts:{[skill]:state.answers}},sections:[{skill,answers:state.answers,status:state.serverConfirmed?'acknowledged':'pending'}],writing:null,title:'Bản lưu bài làm · '+labels[skill]});
  const url=URL.createObjectURL(out.blob),a=node('a');a.href=url;a.download=out.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 if(skill==='reading'){
  const old=$('reading-clock'),clock=node('div',undefined,'cbt-reading-clock');clock.setAttribute('role','timer');const value=node('strong',old.textContent);value.id='reading-clock';clock.append(node('span','Còn'),value,node('span','/ 40 phút'));old.replaceWith(clock);
 }
 const result=node('section',undefined,'panel result-panel');result.id='legacy-native-result';result.hidden=true;
 const resultHeader=node('div',undefined,'result-heading'),resultCopy=node('div'),resultName=node('h2'),resultClass=node('p'),resultChange=node('button','Đổi người dự thi','button button-secondary');resultChange.type='button';resultChange.onclick=change.onclick;resultCopy.append(node('p','Kết quả cá nhân','eyebrow'),resultName,resultClass);resultHeader.append(resultCopy,resultChange);const summary=node('div'),details=node('div'),resultNote=node('p');result.append(resultHeader,summary,details,resultNote);main.append(result);
 const view=node('button','Xem kết quả','button button-primary');view.type='button';view.id='legacy-view-result';view.hidden=true;$('finished').querySelector('.transition-actions,.form-actions')?.prepend(view);
 let resultAttempt=null,loading=false;
 view.onclick=async()=>{
  const state=getState(),identity=state?.identity,receiptId=typeof state?.receipt==='string'?state.receipt:state?.receipt?.receiptId;
  if(loading||!identity||!state.serverConfirmed||!receiptId)return;loading=true;view.disabled=true;
  try{
   const response=await readReview(receiptId),review=response.review,binding=review?.identity;
   if(!binding||binding.testSlug!==identity.testSlug||binding.contentVersion!==identity.contentVersion||binding.attemptId!==identity.attemptId||binding.generation!==identity.generation||binding.classCode!==identity.classCode||binding.studentRef!==identity.studentRef||binding.receiptId!==receiptId||binding.revision!==state.ackedRevision)throw Error('REVIEW_SCOPE_CONFLICT');
   const section=review.result?.[skill];if(!section||!Number.isInteger(section.correct)||!Number.isInteger(section.total)||!Array.isArray(section.details))throw Error('REVIEW_RESULT_INCOMPLETE');
   const views=createNativeResultViews({state:{resultDetailsOpen:{}},elements:{summaryGrid:summary,questionDetails:details},testConfig:{slug:sourceSlug},formatBand:n=>Number(n).toFixed(1),sectionScore:s=>s.correct+'/'+s.total+' câu đúng'});
   views.renderScoreSummary({result:{[skill]:section},writing:{grading:null}});
   for(const row of [...summary.querySelectorAll('table tbody tr')])if(row.cells[0].textContent!==labels[skill])row.remove();
   details.replaceChildren(views.renderDetailBlock(labels[skill],section.details),views.renderSkillPerformance(labels[skill],section));
   if(review.bundle){await loadExplanations(sourceSlug);window.K67_ANSWER_EXPLANATIONS.attach({container:details,payload:{completed:true,result:review.result},testSlug:binding.testSlug,title:document.querySelector('.topbar h1').textContent,reviewKey:receiptId,loadReview:async()=>({review})});}
   resultName.textContent=review.studentName||state.learnerName||state.name;resultClass.textContent=identity.classCode+' · '+document.querySelector('.topbar h1').textContent;
   resultNote.textContent='Biên nhận: '+receiptId+'. Trạng thái ghi điểm Portal do hệ thống xác nhận riêng.';resultAttempt=identity.attemptId;$('finished').hidden=true;result.hidden=false;
  }catch{resultNote.textContent='Chưa tải được kết quả đã xác nhận. Bạn có thể thử lại; bài nộp và biên nhận vẫn được giữ.';result.hidden=false;}
  finally{loading=false;view.disabled=false;}
 };
 return {
  async restoreSelected(){const state=getState();if(state?.identity)return false;const saved=await storage.get(key($('class').value,$('student').value));if(!saved?.permit||saved.identity?.studentRef!==$('student').value||saved.identity?.classCode!==$('class').value)return false;await storage.put('current',saved);location.reload();return true;},
  refresh(){accept.disabled=!isReady();const state=getState();if(state?.identity){state.presentationVersion='substitute-parity12';}const active=!!state?.identity&&!identity.hidden;change.hidden=!active;download.hidden=!state?.identity;const ready=state?.phase==='submitted'&&state.serverConfirmed&&!state.pending;view.hidden=!ready;if(resultAttempt===state?.identity?.attemptId&&ready){$('finished').hidden=true;result.hidden=false;}else result.hidden=true;const link=$('view-review');if(link&&ready)link.hidden=true;},
 };
}
