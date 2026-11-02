import {patchReadingView} from './reading-view.mjs?v=20261027-reading1';
import {createPracticeResultTracker} from './practice-result-tracking.mjs?v=20261102-result1';
const stableParts=['explanation-body','explanation-analysis','explanation-evidence','explanation-prompt','explanation-heading-text','explanation-options','explanation-option-body','explanation-dialog-passage','explanation-dialog-detail','explanation-dialog-passage-scroll','explanation-dialog-detail-scroll','explanation-dialog-analysis','explanation-dialog-compare','explanation-dialog-answer'];
function nodeKey(node){
 if(node.nodeType!==1)return'';
 if(node.id)return'#'+node.id;
 for(const [attribute,prefix] of [['resultQuestion','question:'],['explanationQuestion','explanation:'],['option','option:'],['replay','replay:']])if(node.dataset[attribute])return prefix+node.dataset[attribute];
 if(node.dataset.action)return'action:'+node.dataset.action+':'+(node.dataset.question||node.dataset.attempt||'');
 const part=stableParts.find(name=>node.classList.contains(name));return part?'part:'+part:'';
}
const options={nodeKey,boundary:(old,next)=>old.nodeType===1&&old.matches('[data-replay]')&&old.dataset.replay===next.dataset?.replay&&old.dataset.label===next.dataset?.label?'keep':undefined};
function readingAnchor(root){
 const doc=root.ownerDocument,view=doc.defaultView,selection=doc.getSelection();
 let anchor=selection?.rangeCount&&!selection.isCollapsed?selection.getRangeAt(0).cloneRange():null;
 let element=anchor?(anchor.startContainer.nodeType===1?anchor.startContainer:anchor.startContainer.parentElement):doc.activeElement;
 if(!element||!root.contains(element))return()=>{};
 anchor??=element;const top=anchor.getBoundingClientRect().top;if(top<0||top>view.innerHeight)return()=>{};
 const scrollers=[];for(let parent=element.parentElement;parent;parent=parent.parentElement)if(parent.scrollHeight>parent.clientHeight+1&&['auto','scroll'].includes(view.getComputedStyle(parent).overflowY))scrollers.push(parent);
 return()=>{
  if(!element.isConnected||!root.contains(element))return;
  for(const scroller of scrollers){const delta=anchor.getBoundingClientRect().top-top;if(Math.abs(delta)<1)return;scroller.scrollTop+=delta;}
  const delta=anchor.getBoundingClientRect().top-top;if(Math.abs(delta)>=1)view.scrollBy(0,delta);
 };
}
export function patchPracticeResultView(root,markup){
 const restore=readingAnchor(root);
 const template=root.ownerDocument.createElement('template');template.innerHTML=markup;
 for(const old of root.querySelectorAll('.inline-explanation-row:not([hidden])')){
  const next=[...template.content.querySelectorAll('.inline-explanation-row')].find(node=>node.id===old.id);if(next){next.hidden=false;const number=old.id.replace('explanation-',''),button=template.content.querySelector(`[data-action="explanation-toggle"][data-question="${number}"]`);if(button){button.setAttribute('aria-expanded','true');button.textContent='Ẩn giải thích';}}
 }
 const oldDetails=[...root.querySelectorAll('details')],nextDetails=[...template.content.querySelectorAll('details')];
 oldDetails.forEach((node,index)=>{if(node.open&&nextDetails[index]?.querySelector('summary')?.textContent===node.querySelector('summary')?.textContent)nextDetails[index].open=true;});
 patchReadingView(root,template.content,options);
 restore();
}
export function patchPracticeResultPart(root,selector,markup){
 const old=root.querySelector(selector);if(!old)return;const template=root.ownerDocument.createElement('template');template.innerHTML=markup;const next=template.content.firstElementChild;if(!next||old.isEqualNode(next))return;
 for(const attribute of [...old.attributes])if(!next.hasAttribute(attribute.name))old.removeAttribute(attribute.name);
 for(const attribute of next.attributes)if(old.getAttribute(attribute.name)!==attribute.value)old.setAttribute(attribute.name,attribute.value);
 const restore=readingAnchor(old);patchReadingView(old,next,options);restore();
}
/** A view owns one observer. Its token stays in headers; leaving the view aborts all its reads. */
export function createPracticeResultView({root,api,context,request,loadResult,acceptResult,acceptProgress,onRevoked}){
 let tracker,key=null;const notice=root.ownerDocument.createElement('div');notice.className='toast';notice.dataset.practiceResultState='';notice.setAttribute('role','status');notice.hidden=true;root.ownerDocument.body.append(notice);
 const contextKey=value=>value?JSON.stringify([value.token,value.scope]):null;
 function close(){tracker?.close();tracker=null;key=null;notice.hidden=true;}
 function sync(){
  const value=context();if(!value||root.ownerDocument.hidden){close();return;}
  const wanted=contextKey(value);if(tracker&&key===wanted)return;close();key=wanted;
  const current=()=>key===wanted&&contextKey(context())===wanted&&!root.ownerDocument.hidden;
  const query='?'+new URLSearchParams({attemptId:value.scope.attemptId});
  const unavailable=()=>{if(current()){notice.textContent='Chưa đọc được cập nhật mới; giữ kết quả đang xem và tự thử lại.';notice.hidden=false;}};
  tracker=createPracticeResultTracker({scope:value.scope,initialResult:value.initialResult,url:api+'/student-progress/events'+query,headers:value.headers,
   poll:({signal})=>request('/student-progress/status'+query,{signal}),loadResult:input=>loadResult({...input,scope:value.scope}),
   onResult:result=>{if(current())return acceptResult(result);},onProgress:progress=>{if(current())return acceptProgress(progress);},
   onError:error=>{if(!current())return;if([401,403,423].includes(error.status)){close();onRevoked(error);}else unavailable();},
   onUnavailable:unavailable,onSynchronized:()=>{if(current())notice.hidden=true;},onUnsupported:()=>{if(current()){close();notice.textContent='Chưa có kênh cập nhật kết quả. Kết quả đang xem được giữ; hãy mở lại bài để kiểm tra bản mới.';notice.hidden=false;}}});
 }
 return{sync,close,snapshot:()=>({active:Boolean(tracker),tracker:tracker?.snapshot()})};
}
