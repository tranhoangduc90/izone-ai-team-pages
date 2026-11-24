import {OfflineRuntime as Base} from './offline-mini-browser-cloud-v1.mjs';
import {withProtectedListening} from '../k56-offline-shared/listening-continuity-protected-v2.mjs';
import {withExamDeparture} from '../k56-offline-shared/exam-departure-v1.mjs';

export {BUILD,canonical,hash,ExamStore,exportHtml} from './offline-mini-browser-cloud-v1.mjs';
class MiniListeningRuntime extends withProtectedListening(Base) {
  attachPlayer(options){
    if(this.listeningRecoveryEnabled)return super.attachPlayer(options);
    return Base.prototype.attachPlayer.call(this,options);
  }
}

export const OfflineRuntime=withExamDeparture(MiniListeningRuntime,{taskId:'task2'});
