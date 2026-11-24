import {OfflineRuntime as Base,BUILD,ExamStore,exportHtml,readProfileId} from './offline-paper-parallel-v1.mjs';
import {withExamDeparture} from '../k56-offline-shared/exam-departure-v1.mjs';

export {BUILD,ExamStore,exportHtml,readProfileId};
const DepartureRuntime=withExamDeparture(Base,{taskId:'task2'});
export class OfflineRuntime extends DepartureRuntime {
  mount(options) {
    super.mount(options);
    const banner=this.departureBanner;
    if(!banner?.isConnected||banner.querySelector("[data-paper-other-receipt]"))return;
    const note=document.createElement('p');
    note.setAttribute('role','status');
    note.setAttribute('data-paper-other-receipt','');
    banner.append(note);
    const render=()=>{
      const skill=this.record?.departure?.skill;
      const label=skill==='reading'?'Reading':'Listening';
      note.hidden=!this.record?.sections[skill]?.confirmedElsewhere;
      note.textContent=note.hidden?'':'Máy chủ đã ghi nhận phần '+label+' từ lượt khác. Bản chốt này vẫn được giữ trên thiết bị để đối soát.';
    };
    this.addEventListener('change',render);
    const unmount=this.unmountDeparture;
    this.unmountDeparture=()=>{this.removeEventListener('change',render);unmount?.();};
    render();
  }
}
