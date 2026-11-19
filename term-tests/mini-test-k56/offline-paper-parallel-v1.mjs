import {createOfflineRuntime} from '../k56-offline-shared/runtime-mini-parallel-entry-v1.mjs';
import {MINI_PAPER_PROFILE} from '../k56-offline-shared/profiles.mjs?v=20261107-mini-v1';

const runtime=createOfflineRuntime({...MINI_PAPER_PROFILE,parallelEntryFlag:'miniPaperParallelEntry'});
export const {BUILD,ExamStore,exportHtml}=runtime;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readProfileId(classCode,retainedOwner=null) {
  const key=MINI_PAPER_PROFILE.localPrefix+'device:'+classCode;
  try {
    const stored=localStorage.getItem(key);
    const id=uuid.test(retainedOwner||'') ? retainedOwner : uuid.test(stored||'') ? stored : crypto.randomUUID();
    if(id!==stored)localStorage.setItem(key,id);
    return id;
  } catch {
    // Without a durable owner do not opt into a new offline scope.
    return null;
  }
}

export class OfflineRuntime extends runtime.OfflineRuntime {
  constructor(options) {
    super(options);
    this.workerPath='./offline-worker-paper-shell-v2.js';
  }
  acceptOfficialProgress(progress,onlySkill=null) {
    // Old permits remain valid. The signed, scoped response can supply official progress after upgrade.
    if (progress && this.record?.prepared?.attemptMode==='answer_sheet') this.record.prepared.miniPaperParallelEntry=true;
    return super.acceptOfficialProgress(progress,onlySkill);
  }
}
