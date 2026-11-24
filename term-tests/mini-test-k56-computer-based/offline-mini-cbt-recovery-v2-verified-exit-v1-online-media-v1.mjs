import {OfflineRuntime as Base} from './offline-mini-browser-cloud-v1.mjs';
import {withProtectedListening} from '../k56-offline-shared/listening-continuity-protected-v2.mjs';
import {withExamDeparture} from '../k56-offline-shared/exam-departure-verified-v1.mjs';

export {BUILD,canonical,hash,ExamStore,exportHtml} from './offline-mini-browser-cloud-v1.mjs';
class MiniListeningRuntime extends withProtectedListening(Base) {
  order(){return super.order().filter(skill=>skill==='listening'||skill==='reading');}
  post(path,body,withPermit){
    // An old pinned Mini shell can still prepare its own legacy attempt.
    const request=path==='/offline/prepare'?{...body,listeningRecoveryClientVersion:1}:body;
    return super.post(path,request,withPermit);
  }
  attachPlayer(options){
    if(this.listeningRecoveryEnabled)return super.attachPlayer(options);
    return Base.prototype.attachPlayer.call(this,options);
  }
}

export const OfflineRuntime=withExamDeparture(MiniListeningRuntime,{taskId:'task2'});
