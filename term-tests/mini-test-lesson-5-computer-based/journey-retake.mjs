import { createOfflineRuntime } from '../k56-offline-shared/runtime.mjs?v=20261107-mini-v3';
import { downloadTermAudio } from '../k56-offline-shared/whole-audio-retake.mjs?v=20261107-retake-v1';
import { createListeningEofGate } from '../k67-shared/listening-eof.mjs?v=20261107-v1';

const miniSlug='mini-test-lesson-5';
const term1Slug='term-test-1';
const term2Slug='term-test-2';
const retakeProfile='term-test-1-listening-retake';
const journeyProfiles=new Map([
  [miniSlug,{version:'mini-k67-cbt-journey-v1',dbName:'izone-mini-k67-journey-v1',build:'mini-k67-cbt-shell-v1',title:'Mini K67'}],
  [term1Slug,{version:'term1-k67-cbt-journey-v1',dbName:'izone-term1-k67-journey-v1',build:'term1-k67-cbt-shell-v1',title:'Term 1 K67',writing:true}],
  [term2Slug,{version:'term2-k67-cbt-journey-v1',dbName:'izone-term2-k67-journey-v1',build:'term2-k67-cbt-shell-v1',title:'Term 2 K67',writing:true}],
  [term1Slug+'-paper',{version:'term1-k67-paper-journey-v1',dbName:'izone-term1-k67-paper-v1',build:'term1-k67-paper-shell-v1',title:'Term 1 K67 · Phiếu giấy',paper:true,slug:term1Slug}],
  [term2Slug+'-paper',{version:'term2-k67-paper-journey-v1',dbName:'izone-term2-k67-paper-v1',build:'term2-k67-paper-shell-v1',title:'Term 2 K67 · Phiếu giấy',paper:true,slug:term2Slug}],
  [retakeProfile,{version:'term1-k67-listening-retake-v1',dbName:'izone-term1-k67-listening-retake-v1',build:'term1-k67-listening-retake-shell-v1',
    title:'Term 1 K67 · Thi bù Listening',retake:true,slug:term1Slug,endpoint:'/api/term-tests/term-test-1/listening-retake/'}]
].map(([slug,profile])=>[slug,{...profile,endpoint:profile.endpoint||`/api/term-tests/${profile.slug||slug}/${profile.paper?'paper':'cbt'}-journey/`,
  ...createOfflineRuntime({...profile,localPrefix:profile.version+':'})}]));
const keyOf = ({classCode,studentRef,examSessionToken,generation}) => [classCode,studentRef,examSessionToken,generation].join(':');
const hex = value => [...new Uint8Array(value)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const hash = async value => hex(await crypto.subtle.digest('SHA-256', value));
const text = new TextEncoder();
const ordered = answers => Object.fromEntries(Object.entries(answers).sort(([a],[b])=>a.localeCompare(b)));
const id = value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
const nameKey = value => String(value||'').normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');

export async function miniJourneyRecovery(classCode,mode,slug=miniSlug){
  if(!navigator.locks||!crypto.subtle)return null;
  const {ExamStore,version}=journeyProfiles.get(slug);
  const store=await new ExamStore().open();
  const candidates=[];
  for(const key of await store.keys(classCode+':')){
    if(key.endsWith(':audio'))continue;
    const record=await store.get(key).catch(()=>null);
    const bundle=record?.package;
    if(!record?.ready||!record.activatedAt||bundle?.version!==version||!id(bundle.studentRef)||!id(bundle.examSessionToken)
        ||(mode&&bundle.examMode!==mode)||keyOf({...bundle,classCode})!==key)continue;
    candidates.push({bundle,activatedAt:record.activatedAt});
  }
  if(!candidates.length)return null;
  return studentName=>{
    const matches=candidates.filter(({bundle})=>nameKey(bundle.studentName)===nameKey(studentName));
    if(new Set(matches.map(({bundle})=>bundle.studentRef)).size!==1)return null;
    return matches.sort((a,b)=>b.activatedAt-a.activatedAt)[0].bundle;
  };
}

export function termPaperRecovery(classCode,slug) {return miniJourneyRecovery(classCode,null,slug+'-paper');}

export async function findMiniJourney(scope,slug=miniSlug) {
  if (!navigator.locks || !crypto.subtle || !id(scope.examSessionToken) || !id(scope.studentRef)) return null;
  const {ExamStore,version}=journeyProfiles.get(slug);
  const store = await new ExamStore().open();
  const key = keyOf(scope);
  const record = await store.get(key);
  if (!record?.ready || record.package?.version !== version || record.package.examSessionToken !== scope.examSessionToken
      || record.package.studentRef !== scope.studentRef || record.package.generation !== scope.generation) return null;
  return { store,key,record };
}

export async function openTermPaperJourney({slug,classCode,studentRef,mode,request,prepare=false}) {
  if(!navigator.locks||!navigator.serviceWorker||!globalThis.indexedDB||!crypto.subtle||!classCode||!id(studentRef))return null;
  const profile=slug+'-paper';
  const {ExamStore,OfflineRuntime,version,endpoint}=journeyProfiles.get(profile);
  const store=await new ExamStore().open();
  const key=`paper-owner:${classCode}:${studentRef}`;
  const scope=await navigator.locks.request(version+':'+key,async()=>{
    let owner=await store.get(key);
    if(owner?.scope?.classCode===classCode&&owner.scope.studentRef===studentRef){
      const saved=await store.get(keyOf(owner.scope));
      const bundle=saved?.package;
      if(saved?.ready&&bundle?.version===version&&bundle.studentRef===studentRef
          &&bundle.examSessionToken===owner.scope.examSessionToken&&bundle.generation===owner.scope.generation)return owner.scope;
    }
    if(!prepare||navigator.onLine===false)return null;
    if(!owner){
      let offer;
      try{offer=await request(endpoint+'availability');}catch{return null;}
      if(!offer.enabled)return null;
      try{await new OfflineRuntime({}).prepareCache();}catch{return null;}
      owner={deviceProof:hex(crypto.getRandomValues(new Uint8Array(32)))};
      await store.put(key,owner);
    }
    let bundle;
    try{
      bundle=await request(endpoint+'prepare',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({classCode,studentRef,deviceProof:owner.deviceProof,examMode:mode,identityConfirmed:true})});
    }catch(error){if(error.status===404||error.code==='OFFLINE_NEW_DISABLED')return null;throw error;}
    if(bundle.version!==version||bundle.studentRef!==studentRef||!id(bundle.attemptToken)||!id(bundle.examSessionToken)
        ||!Number.isSafeInteger(bundle.generation)||!Number.isSafeInteger(bundle.activatedAt)||!Number.isSafeInteger(bundle.serverNow)
        ||!Number.isFinite(bundle.timing?.readingDurationMinutes)||!['read_first','lis_first'].includes(bundle.examMode)
        ||!(/^[a-f0-9]{64}$/.test(bundle.permit)))throw new Error('Quyền lưu phiếu chưa khớp lượt.');
    const scope={classCode,studentRef,examSessionToken:bundle.examSessionToken,generation:bundle.generation};
    if(!await store.get(keyOf(scope)))await store.put(keyOf(scope),{deviceProof:owner.deviceProof,package:bundle,ready:true,
      activatedAt:bundle.activatedAt,clock:{epoch:bundle.serverNow,wall:Date.now()},sections:{},drafts:{},revisions:{},pending:[],receipts:{}});
    await store.put(key,{...owner,scope});
    return scope;
  });
  if(!scope)return null;
  return openMiniJourney({scope,request,slug:profile,existing:{store}});
}

export async function openTerm1RetakeJourney({classCode,studentRef,retakeGrant,request,prepare=false}) {
  if(!navigator.locks||!navigator.serviceWorker||!globalThis.indexedDB||!crypto.subtle||!classCode||!retakeGrant)return null;
  const {ExamStore,version,endpoint}=journeyProfiles.get(retakeProfile);
  const store=await new ExamStore().open();
  const key=`retake-owner:${classCode}:${await hash(text.encode(retakeGrant))}`;
  const owner=await navigator.locks.request(version+':'+key,async()=>{
    const saved=await store.get(key);
    if(saved?.scope){
      const scope=saved.scope;
      const record=await store.get(keyOf(scope));
      if(scope.classCode===classCode&&record?.ready&&record.package?.version===version
          &&record.package.studentRef===scope.studentRef&&record.package.examSessionToken===scope.examSessionToken
          &&record.package.generation===scope.generation&&(!studentRef||studentRef===scope.studentRef))return {scope};
    }
    if(!prepare||!id(studentRef)||navigator.onLine===false)return null;
    const deviceProof=saved?.deviceProof||hex(crypto.getRandomValues(new Uint8Array(32)));
    await store.put(key,{...saved,deviceProof});
    const load=()=>request(endpoint+'prepare',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({classCode,studentRef,deviceProof,retakeGrant})});
    const bundle=await load();
    if(bundle.version!==version||bundle.studentRef!==studentRef||bundle.className!==classCode
        ||bundle.examMode!=='lis_first'||!id(bundle.examSessionToken)||bundle.attemptToken!==bundle.examSessionToken
        ||!Number.isSafeInteger(bundle.generation)||!Number.isSafeInteger(bundle.serverNow)
        ||!(/^[a-f0-9]{64}$/.test(bundle.permit))||bundle.timing?.listeningReviewSeconds!==120) {
      throw new Error('Quyền thi bù chưa khớp lượt được cấp.');
    }
    const scope={classCode,studentRef,examSessionToken:bundle.examSessionToken,generation:bundle.generation};
    await store.put(key,{deviceProof,scope});
    return {scope,deviceProof,bundle,load};
  });
  if(!owner)return null;
  return openMiniJourney({scope:owner.scope,request,existing:{store},slug:retakeProfile,prepare,retakeOffer:owner});
}

export async function openMiniJourney({scope,request,existing,prepare=false,slug=miniSlug,pagesOnly=false,retakeOffer}) {
  if (!navigator.locks || !crypto.subtle || !id(scope.examSessionToken) || !id(scope.studentRef)) return null;
  const {ExamStore,OfflineRuntime,version,endpoint,title,writing,paper,retake,slug:audioSlug}=journeyProfiles.get(slug);
  const store = existing?.store || await new ExamStore().open();
  const key = keyOf(scope);
  const release = await new Promise((resolve,reject)=>{
    navigator.locks.request(version+':'+key,{ifAvailable:true},lock=>{
      if(!lock){resolve(null);return;}
      return new Promise(done=>resolve(done));
    }).catch(reject);
  });
  if(!release) throw new Error('Bài đang mở ở tab khác. Hãy trở lại tab đang giữ bài.');
  let record;
  const changed = new EventTarget();
  let busy=false, retryAt=0, message='', stopped=false, timer;
  let playing=null;
  const owner = {examSessionToken:scope.examSessionToken,generation:scope.generation};
  const save = () => store.put(key,record);
  const notify = value=>{if(value!==message){message=value;changed.dispatchEvent(new Event('change'));}};
  const order = () => {
    if(retake)return ['listening'];
    const sections=record.package.examMode==='read_first'?['reading','listening']:['listening','reading'];
    if(writing)sections.push('writing');
    return sections;
  };
  const next = () => order().find(section=>!record.sections[section]?.operationId)||'result';
  const send = (path,body,permit=record?.package?.permit)=>request(endpoint+path,{method:'POST',
    headers:{'Content-Type':'application/json',...(permit?{'x-term2-permit':permit}:{})},
    body:JSON.stringify({...owner,deviceProof:record.deviceProof,...body})});
  async function close(){
    if(stopped)return;
    stopped=true;clearInterval(timer);window.removeEventListener('online',flush);
    if(playing)await playing.checkpoint().catch(()=>{});
    playing?.stop();release();
  }

  try {
    record=await store.get(key);
    if (!record?.ready) {
      if(!prepare || navigator.onLine===false){await close();return null;}
      record ||= {deviceProof:retakeOffer?.deviceProof||hex(crypto.getRandomValues(new Uint8Array(32))),sections:{},drafts:{},revisions:{},pending:[],receipts:{}};
      await save();
      const load=retakeOffer?.load||(()=>send('prepare',{classCode:scope.classCode,studentRef:scope.studentRef},null));
      let value;
      try {value=retakeOffer?.bundle||await load();}
      catch(error){if(error.status===404||error.code==='OFFLINE_NEW_DISABLED'){await close();return null;}throw error;}
      if(value.version!==version||value.examSessionToken!==scope.examSessionToken||value.studentRef!==scope.studentRef
          ||value.generation!==scope.generation||!id(value.attemptToken)||value.activatedAt!==null)throw new Error('Bản đề chưa khớp lượt được cấp.');
      const {audioDownload,...bundle}=value;
      const manifest=bundle.audioManifest;
      const refresh=(writing||retake)&&!pagesOnly?async()=>{
        let renewed;
        try{renewed=await load();}
        catch(error){if(!error.status||error.status>=500)error.audioRefreshUnavailable=true;throw error;}
        if(renewed.version!==version||renewed.examSessionToken!==scope.examSessionToken||renewed.generation!==scope.generation
            ||renewed.studentRef!==scope.studentRef||renewed.audioManifest?.sha256!==manifest.sha256){
          throw Object.assign(new Error('Quyền tải audio đã thay đổi.'),{status:403});
        }
        return {manifest:renewed.audioManifest,download:renewed.audioDownload};
      }:undefined;
      const blob=await downloadTermAudio(audioSlug||slug,{pagesUrl:manifest.url,sha256:manifest.sha256,bytes:manifest.byteLength},
        {audioDownload:pagesOnly?undefined:audioDownload,refresh});
      await store.put(key+':audio',{blob});
      const stored=await store.get(key+':audio');
      if (!(stored?.blob instanceof Blob) || stored.blob.size!==manifest.byteLength || await hash(await stored.blob.arrayBuffer())!==manifest.sha256) {
        throw new Error('Không đọc lại được audio trên thiết bị.');
      }
      await new OfflineRuntime({}).prepareCache();
      record.package=bundle;record.ready=true;
      await save();
    }else if(pagesOnly&&navigator.onLine!==false&&!navigator.serviceWorker?.controller){
      // A native attempt already prepared from the primary link can also enter from the rescue link.
      // Keep the verified attempt accessible even if this route's secondary shell cannot be installed now.
      await new OfflineRuntime({}).prepareCache().catch(()=>{});
    }
    window.addEventListener('online',flush);
    timer=setInterval(flush,5_000);
  } catch(error){await close();throw error;}

  let mono=performance.now();
  let epoch=record.clock?.epoch??record.package.serverNow;
  if(record.clock){
    const passed=Date.now()-record.clock.wall;
    if(passed<0||passed>72*60*60*1_000)record.clockInvalid=true;
    else epoch+=passed;
  }
  const now = () => Math.floor(epoch+Math.max(0,performance.now()-mono));
  const persist = () => {record.clock={epoch:now(),wall:Date.now()};return save();};

  function view(){
    const p=record.package;
    const l=record.sections.listening,r=record.sections.reading,w=record.sections.writing;
    return {ok:true,studentRef:p.studentRef,studentName:p.studentName,...(paper?{className:p.className,examDelivery:'answer_sheet'}:{}),
      examSessionToken:p.examSessionToken,attemptToken:p.attemptToken,generation:p.generation,
      examMode:p.examMode,nextSection:next(),listeningSubmitted:Boolean(l?.operationId),readingSubmitted:Boolean(r?.operationId),completed:Boolean(l?.operationId&&(retake||r?.operationId)),
      ...(writing?{writingStarted:Boolean(w?.startedAt),writingSubmitted:Boolean(w?.operationId),
        writingDeadlineAt:w?.deadline?new Date(w.deadline).toISOString():null}:{}),
      readingStartedAt:r?.startedAt?new Date(r.startedAt).toISOString():null,readingDeadlineAt:r?.deadline?new Date(r.deadline).toISOString():null,
      listeningStartedAt:l?.startedAt?new Date(l.startedAt).toISOString():null,listeningDeadlineAt:l?.deadline?new Date(l.deadline).toISOString():null,
      readingDraft:record.drafts.reading||{},readingDraftRevision:record.revisions.reading||0,
      serverNow:new Date(now()).toISOString(),portalSyncStatus:'not_applicable',localOnly:Boolean(record.pending.length)};
  }

  async function begin(){
    if(record.activatedAt)return view();
    const result=await send('begin',{});
    if(result.version!==version||result.examSessionToken!==scope.examSessionToken||result.generation!==scope.generation
        ||!Number.isSafeInteger(result.activatedAt))throw new Error('Chưa xác nhận được mốc mở bài.');
    record.activatedAt=result.activatedAt;epoch=Math.max(result.activatedAt,result.serverNow||0);mono=performance.now();
    // The first skill's clock starts at the server activation, even after a lost reply.
    await start(order()[0],record.activatedAt);
    return view();
  }

  async function start(section,at=now()){
    if(!record.activatedAt||next()!==section)throw new Error('Hãy hoàn thành phần trước.');
    if(!record.sections[section]){
      record.sections[section]={startedAt:at,...(section==='listening'?{position:0}:
        {deadline:at+record.package.timing[section+'DurationMinutes']*60_000})};
      await persist();
    }
    return view();
  }

  async function saveDrafts(drafts,revisions){
    if(stopped)return;
    const section=next();
    if(section==='result'||!record.sections[section])return;
    const draft=drafts[section]||{};
    const revision=Number(revisions[section])||0;
    if(revision < (record.revisions[section]||0) || (revision===(record.revisions[section]||0)&&JSON.stringify(draft)===JSON.stringify(record.drafts[section]||{})))return;
    const prior=record.drafts[section],priorRevision=record.revisions[section];
    const saved=structuredClone(draft);
    record.drafts[section]=saved;record.revisions[section]=revision;
    try{await persist();}catch(error){
      if(record.drafts[section]===saved){
        if(prior===undefined)delete record.drafts[section];else record.drafts[section]=prior;
        if(priorRevision===undefined)delete record.revisions[section];else record.revisions[section]=priorRevision;
      }
      throw error;
    }
    if((paper||retake)&&!record.pending.length)notify('Đã lưu nháp trên máy');
    return true;
  }

  async function seal(section,answers,revision,automatic){
    const s=record.sections[section];
    if(s?.operationId)return view();
    if(stopped||next()!==section||!s?.startedAt)throw new Error('Chưa bắt đầu phần này.');
    if(record.clockInvalid)throw new Error('Chưa xác nhận được giờ thi. Nháp vẫn được giữ trên máy.');
    const captured=now();
    if(automatic && (!s.deadline||captured<s.deadline||(section==='listening'&&(!s.eofAt||!playing?.reviewComplete())))) {
      throw new Error('Chưa đủ điều kiện tự nộp bài.');
    }
    const preceding=order()[order().indexOf(section)-1];
    const payload={...owner,operationId:crypto.randomUUID(),section,previousOperationId:preceding?record.sections[preceding].operationId:null,
      startedAt:s.startedAt,capturedAt:automatic?s.deadline:captured,revision:Number(revision)||0,automatic,
      eofAt:section==='listening'?s.eofAt||null:null,heardSeconds:section==='listening'?s.position||0:0,answers:ordered(answers||{})};
    s.operationId=payload.operationId;record.pending.push(payload);
    record.drafts[section]=payload.answers;record.revisions[section]=payload.revision;
    try{await persist();}catch(error){record.pending.pop();delete s.operationId;throw error;}
    if(section==='listening'){playing?.stop();playing=null;}
    notify('Đã lưu trên máy · Chờ đồng bộ');void flush();return view();
  }

  async function flush(){
    if(stopped||busy||navigator.onLine===false||performance.now()<retryAt||record.review||!record.pending.length)return;
    busy=true;
    try{
      while(!stopped&&record.pending.length){
        const pending=record.pending[0];
        const checked=(writing||paper||retake)?await send('status',{section:pending.section,operationId:pending.operationId}):null;
        const result=checked?.persisted?checked:await send('seal',pending);
        const receipt=result.receipt;
        if(stopped)return;
        if(receipt?.version!==version||receipt.examSessionToken!==scope.examSessionToken||receipt.generation!==scope.generation
            ||receipt.section!==pending.section||receipt.operationId!==pending.operationId||!id(receipt.attemptToken)
            ||receipt.payloadHash!==await hash(text.encode(JSON.stringify(pending))))throw new Error('Biên nhận không khớp bản đã lưu.');
        record.receipts[pending.section]=receipt;record.pending.shift();
        try{await persist();}catch(error){record.pending.unshift(pending);delete record.receipts[pending.section];throw error;}
      }
      notify('Máy chủ đã xác nhận nhận bài');
    }catch(error){
      retryAt=performance.now()+10_000;
      if([400,401,403,409,422].includes(error.status)){record.review=true;await persist().catch(()=>{});}
      notify(record.review?'Bài vẫn lưu trên máy · Cần đối soát':'Đã lưu trên máy · Chờ đồng bộ');
    }finally{busy=false;}
  }

  async function verifiedAudio(){
    const stored=await store.get(key+':audio');
    const manifest=record.package.audioManifest;
    if (!(stored?.blob instanceof Blob)||stored.blob.size!==manifest.byteLength||await hash(await stored.blob.arrayBuffer())!==manifest.sha256) {
      throw new Error('Audio trên máy chưa khớp. Bài vẫn được giữ.');
    }
    return stored.blob;
  }

  async function mountPlayer({host,onReview,onAuto,volume}){
    if(playing||next()!=='listening'||!record.sections.listening)return;
    const audio=document.createElement('audio');
    audio.hidden=true;audio.id='miniJourneyAudio';
    if(Number.isFinite(volume))audio.volume=Math.max(0,Math.min(1,volume));
    const button=document.createElement('button');button.type='button';button.className='button button-secondary';button.textContent='Nghe tiếp';
    const status=document.createElement('p');status.setAttribute('role','status');
    host.append(audio,button,status);
    const s=record.sections.listening;
    let blob;
    try{blob=await verifiedAudio();}catch(error){button.disabled=true;status.textContent=error.message;return;}
    const url=URL.createObjectURL(blob);
    audio.src=url;audio.preload='metadata';
    const anchor=s.position||0;
    const gate=createListeningEofGate({audio,anchorSeconds:anchor,reviewSeconds:record.package.timing.listeningReviewSeconds});
    let last=anchor, stoppedPlayer=false, reviewing=false, lastAuto=-Infinity;
    let reviewEnd=null;
    function covered(){
      let value=anchor;
      for(let i=0;i<audio.played.length;i+=1){
        if(audio.played.start(i)>value+.25)break;
        value=Math.max(value,audio.played.end(i));
      }
      return Math.min(value,audio.currentTime||0);
    }
    async function checkpoint(){
      if(stoppedPlayer||s.operationId)return;
      if(!s.eofAt)s.position=Math.max(s.position||0,covered());
      else if(reviewEnd!==null)s.reviewRemaining=Math.max(0,Math.ceil(reviewEnd-performance.now()));
      await persist();
    }
    function startReview(){
      reviewing=true;button.disabled=true;
      reviewEnd=performance.now()+(s.reviewRemaining??record.package.timing.listeningReviewSeconds*1_000);
      onReview(s.deadline);
    }
    if(s.eofAt) startReview();
    audio.addEventListener('loadedmetadata',()=>{
      if(!s.eofAt&&anchor>0)audio.currentTime=Math.min(anchor,Math.max(0,audio.duration-.02));
    });
    audio.addEventListener('ratechange',gate.recordRate);
    audio.addEventListener('pause',()=>{void checkpoint().catch(()=>{});});
    audio.addEventListener('error',()=>{status.textContent='Chưa phát được audio. Nháp vẫn được giữ.';});
    audio.addEventListener('timeupdate',()=>{
      if(audio.currentTime>=last+1){last=audio.currentTime;void checkpoint().catch(()=>{});}
    });
    audio.addEventListener('ended',event=>{
      if(!gate.confirmEnd(event))return;
      s.position=audio.duration;s.eofAt=now();s.reviewRemaining=record.package.timing.listeningReviewSeconds*1_000;
      s.deadline=s.eofAt+s.reviewRemaining;
      void persist().then(startReview).catch(()=>{status.textContent='Chưa lưu được mốc nghe. Bài sẽ chưa tự nộp.';});
    });
    button.addEventListener('click',async()=>{
      try{await audio.play();button.disabled=true;}
      catch{status.textContent='Chưa phát được audio. Hãy thử nghe tiếp.';}
    });
    audio.addEventListener('pause',()=>{if(!reviewing&&!stoppedPlayer)button.disabled=false;});
    const reviewComplete=()=>reviewEnd!==null&&performance.now()>=reviewEnd&&now()>=s.deadline;
    const tick=setInterval(()=>{
      if(reviewing){
        const seconds=Math.max(0,Math.ceil((reviewEnd-performance.now())/1000));
        status.textContent=`Đã nghe hết · Còn ${seconds} giây rà bài`;
        void checkpoint().catch(()=>{});
        if(reviewComplete()&&!s.operationId&&performance.now()-lastAuto>=10_000){lastAuto=performance.now();onAuto();}
      }else status.textContent=audio.paused?'Bấm Nghe tiếp để phát từ mốc đã lưu.':`Đang nghe · ${Math.floor(audio.currentTime)} giây`;
    },1000);
    playing={checkpoint,reviewComplete,stop(){stoppedPlayer=true;clearInterval(tick);audio.pause();URL.revokeObjectURL(url);host.hidden=true;}};
  }

  function download(liveDraft=null){
    const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const body=order().map(section=>{
      const progress=record.sections[section];
      const status=record.receipts[section]?'Máy chủ đã nhận':progress?.operationId?'Đã lưu trên máy · Chờ đồng bộ':
        progress?'Đang làm':'Chưa bắt đầu';
      const started=progress?.startedAt?` · Bắt đầu ${new Date(progress.startedAt).toISOString()}`:'';
      const answers=(paper||retake)&&liveDraft&&next()===section?liveDraft:record.drafts[section]||{};
      return `<h2>${section}</h2><dl>`+Object.entries(answers).map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')+
        `</dl><p>${status}${started}</p>`;
    }).join('');
    const html='<!doctype html><html lang="vi"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><title>Bài làm '+title+'</title><h1>Bài làm '+title+'</h1>'+body+'</html>';
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=title.replaceAll(' ','-')+'.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),30_000);
  }
  const resultToken=()=>record.receipts[order().at(-1)]?.attemptToken||null;
  if(paper||retake)notify(record.review?'Bài vẫn lưu trên máy · Cần đối soát':record.pending.length?'Đã lưu trên máy · Chờ đồng bộ':
    resultToken()?'Máy chủ đã xác nhận nhận bài':'Tự lưu trên thiết bị');
  void flush();
  return {content:record.package.content,paper,retake,view,start,begin,saveDrafts,seal,mountPlayer,verifiedAudio,download,resultToken,now,
    ...(retake?{loadResult:()=>send('result',{})}:{}),
    activated:()=>Boolean(record.activatedAt),drafts:()=>structuredClone(record.drafts),revisions:()=>({...record.revisions}),close,changed,
    message:()=>message,reviewComplete:()=>playing?.reviewComplete()===true};
}
