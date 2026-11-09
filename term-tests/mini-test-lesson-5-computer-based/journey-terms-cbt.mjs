import { createOfflineRuntime } from '../k56-offline-shared/runtime.mjs?v=20261107-mini-v3';
import { downloadTermAudio } from '../k56-offline-shared/whole-audio-terms-cbt.mjs?v=20261107-terms-cbt-v1';
import { mountOfflineListeningPlayer, prepareContinuityAudio, mountContinuityListeningPlayer } from '../k67-shared/offline-journey-ui.mjs?v=20261110-continuity-v2';

const miniSlug='mini-test-lesson-5';
const term1Slug='term-test-1';
const term2Slug='term-test-2';
const journeyProfiles=new Map([
  [miniSlug,{version:'mini-k67-cbt-journey-v1',dbName:'izone-mini-k67-journey-v1',build:'mini-k67-cbt-shell-v1',title:'Mini K67'}],
  [term1Slug,{version:'term1-k67-cbt-journey-v1',dbName:'izone-term1-k67-journey-v1',build:'term1-k67-cbt-shell-v1',title:'Term 1 K67',writing:true}],
  [term2Slug,{version:'term2-k67-cbt-journey-v1',dbName:'izone-term2-k67-journey-v1',build:'term2-k67-cbt-shell-v1',title:'Term 2 K67',writing:true}],
  [term1Slug+'-paper',{version:'term1-k67-paper-journey-v1',dbName:'izone-term1-k67-paper-v1',build:'term1-k67-paper-shell-v1',title:'Term 1 K67 · Phiếu giấy',paper:true,slug:term1Slug}],
  [term2Slug+'-paper',{version:'term2-k67-paper-journey-v1',dbName:'izone-term2-k67-paper-v1',build:'term2-k67-paper-shell-v1',title:'Term 2 K67 · Phiếu giấy',paper:true,slug:term2Slug}]
].map(([slug,profile])=>[slug,{...profile,endpoint:`/api/term-tests/${profile.slug||slug}/${profile.paper?'paper':'cbt'}-journey/`,
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

export async function openMiniJourney({scope,request,existing,prepare=false,slug=miniSlug,pagesOnly=false}) {
  if (!navigator.locks || !crypto.subtle || !id(scope.examSessionToken) || !id(scope.studentRef)) return null;
  const {ExamStore,OfflineRuntime,version,endpoint,title,writing,paper}=journeyProfiles.get(slug);
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
  let playing=null, preparedPlayer=null, preparingPlayer=null, verifiedBlob=null, savingOperation=false;
  let journal, listeningStartIntent;
  const diagnostics=[];
  const continuity=()=>!paper&&record.package.listeningContinuityVersion===1;
  function drainDiagnostics() {
    while(journal?.recorder&&diagnostics.length){
      try{
        if(!journal.recorder.record('state_observed',{cause:'k67_offline_journey',checkpointState:diagnostics[0]}))return;
        diagnostics.shift();
      }catch{return;}
    }
  }
  function observe(action,details={}){
    if(action==='audio_playing'&&listeningStartIntent!==undefined){
      details={...details,elapsedMs:performance.now()-listeningStartIntent};
    }
    if(diagnostics.length>=32)diagnostics.shift();
    diagnostics.push({offlineVersion:1,action,observedAt:new Date().toISOString(),...details});
    drainDiagnostics();
  }
  function setJournal(value){journal=value;drainDiagnostics();}
  function markListeningStart(){listeningStartIntent=performance.now();}
  function onOnline(){retryAt=0;void flush();}
  const owner = {examSessionToken:scope.examSessionToken,generation:scope.generation};
  const save = () => store.put(key,record);
  const notify = value=>{if(value!==message){message=value;changed.dispatchEvent(new Event('change'));}};
  const order = () => {
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
    stopped=true;clearInterval(timer);window.removeEventListener('online',onOnline);
    if(playing?.checkpoint)await playing.checkpoint().catch(()=>{});
    playing?.stop();
    preparedPlayer?.release();
    release();
  }

  try {
    record=await store.get(key);
    if (!record?.ready) {
      if(!prepare || navigator.onLine===false){await close();return null;}
      record ||= {deviceProof:hex(crypto.getRandomValues(new Uint8Array(32))),sections:{},drafts:{},revisions:{},pending:[],receipts:{}};
      await save();
      let value;
      try {value=await send('prepare',{classCode:scope.classCode,studentRef:scope.studentRef},null);}
      catch(error){if(error.status===404||error.code==='OFFLINE_NEW_DISABLED'){await close();return null;}throw error;}
      if(value.version!==version||value.examSessionToken!==scope.examSessionToken||value.studentRef!==scope.studentRef
          ||value.generation!==scope.generation||!id(value.attemptToken)||value.activatedAt!==null)throw new Error('Bản đề chưa khớp lượt được cấp.');
      const {audioDownload,...bundle}=value;
      const manifest=bundle.audioManifest;
      const refresh=writing&&!pagesOnly?async()=>{
        let renewed;
        try{renewed=await send('prepare',{classCode:scope.classCode,studentRef:scope.studentRef},null);}
        catch(error){if(!error.status||error.status>=500)error.audioRefreshUnavailable=true;throw error;}
        if(renewed.version!==version||renewed.examSessionToken!==scope.examSessionToken||renewed.generation!==scope.generation
            ||renewed.studentRef!==scope.studentRef||renewed.audioManifest?.sha256!==manifest.sha256){
          throw Object.assign(new Error('Quyền tải audio đã thay đổi.'),{status:403});
        }
        return {manifest:renewed.audioManifest,download:renewed.audioDownload};
      }:undefined;
      const blob=await downloadTermAudio(slug,{pagesUrl:manifest.url,sha256:manifest.sha256,bytes:manifest.byteLength},
        {audioDownload:pagesOnly?undefined:audioDownload,refresh});
      await store.put(key+':audio',{blob});
      const stored=await store.get(key+':audio');
      if (!(stored?.blob instanceof Blob) || stored.blob.size!==manifest.byteLength || await hash(await stored.blob.arrayBuffer())!==manifest.sha256) {
        throw new Error('Không đọc lại được audio trên thiết bị.');
      }
      verifiedBlob=stored.blob;
      if(!paper&&bundle.listeningContinuityVersion===1){
        observe('audio_download_verified',{byteLength:stored.blob.size});
        preparedPlayer=prepareContinuityAudio(stored.blob,observe);
      }
      await new OfflineRuntime({}).prepareCache();
      record.package=bundle;record.ready=true;
      await save();
    }else if(pagesOnly&&navigator.onLine!==false&&!navigator.serviceWorker?.controller){
      // A native attempt already prepared from the primary link can also enter from the rescue link.
      // Keep the verified attempt accessible even if this route's secondary shell cannot be installed now.
      await new OfflineRuntime({}).prepareCache().catch(()=>{});
    }
    window.addEventListener('online',onOnline);
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
    return {ok:true,studentName:p.studentName,...(paper?{className:p.className,examDelivery:'answer_sheet'}:{}),
      examSessionToken:p.examSessionToken,attemptToken:p.attemptToken,generation:p.generation,
      examMode:p.examMode,nextSection:next(),listeningSubmitted:Boolean(l?.operationId&&!l.interrupted),
      listeningInterrupted:Boolean(l?.interrupted),needsListeningAcknowledgment:Boolean(l?.interrupted&&!l.acknowledged),
      readingSubmitted:Boolean(r?.operationId),completed:Boolean(l?.operationId&&r?.operationId),
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
    if(!record.activatedAt||next()!==section||view().needsListeningAcknowledgment)throw new Error('Hãy hoàn thành phần trước.');
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
    if(paper&&!record.pending.length)notify('Đã lưu nháp trên máy');
    return true;
  }

  async function seal(section,answers,revision,automatic){
    const s=record.sections[section];
    if(s?.interrupted||view().needsListeningAcknowledgment)throw new Error('Hãy xác nhận Listening đã gián đoạn.');
    if(s?.operationId)return view();
    if(savingOperation)throw new Error('Đang lưu kết quả của lượt.');
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
    if(section==='listening'&&continuity()&&!automatic){
      observe('listening_early_submit_confirmed',{operationId:payload.operationId});
      playing?.pauseForSubmit?.();
    }
    await storeOperation(s,payload);
    if(section==='listening'){
      if(continuity())observe('listening_local_collected',{operationId:payload.operationId});
      playing?.stop();playing=null;
    }
    notify('Đã lưu trên máy · Chờ đồng bộ');void flush();return view();
  }

  async function storeOperation(section,payload){
    const {section:skill}=payload;
    const previousDraft=record.drafts[skill], previousRevision=record.revisions[skill];
    const interrupted=payload.outcome==='interrupted';
    savingOperation=true;
    section.operationId=payload.operationId;
    if(interrupted)section.interrupted=true;
    record.pending.push(payload);
    if(!interrupted){
      record.drafts[skill]=payload.answers;
      record.revisions[skill]=payload.revision;
    }
    try{await persist();}
    catch(error){
      record.pending.splice(record.pending.indexOf(payload),1);
      delete section.operationId;
      if(interrupted)delete section.interrupted;
      else {
        if(previousDraft===undefined)delete record.drafts[skill];else record.drafts[skill]=previousDraft;
        if(previousRevision===undefined)delete record.revisions[skill];else record.revisions[skill]=previousRevision;
      }
      throw error;
    }finally{savingOperation=false;}
  }

  async function interrupt(reason){
    const section=record.sections.listening;
    if(section?.interrupted)return view();
    if(!continuity()||savingOperation||!section?.startedAt||section.operationId||section.eofAt||next()!=='listening')
      throw new Error('Listening đã có kết quả.');
    const preceding=order()[order().indexOf('listening')-1];
    const payload={...owner,operationId:crypto.randomUUID(),section:'listening',
      previousOperationId:preceding?record.sections[preceding].operationId:null,
      startedAt:section.startedAt,capturedAt:now(),revision:record.revisions.listening||0,
      automatic:false,eofAt:null,heardSeconds:0,answers:{},outcome:'interrupted'};
    await storeOperation(section,payload);
    observe('listening_interrupted',{operationId:payload.operationId,reason});
    playing?.stop();playing=null;
    preparedPlayer?.release();preparedPlayer=null;
    notify('Listening gián đoạn đã lưu trên máy · Chờ đồng bộ');
    void flush();
    return view();
  }

  async function acknowledgeInterruption(){
    const section=record.sections.listening;
    if(!section?.interrupted)throw new Error('Chưa lưu được trạng thái gián đoạn.');
    section.acknowledged=true;
    try{await persist();}
    catch(error){delete section.acknowledged;throw error;}
    return view();
  }

  async function flush(){
    if(stopped||busy||savingOperation||navigator.onLine===false||performance.now()<retryAt||record.review||!record.pending.length)return;
    busy=true;
    try{
      while(!stopped&&!savingOperation&&record.pending.length){
        const pending=record.pending[0];
        const checked=(writing||paper)?await send('status',{section:pending.section,operationId:pending.operationId}):null;
        const result=checked?.persisted?checked:await send(pending.outcome==='interrupted'?'interrupt':'seal',pending);
        const receipt=result.receipt;
        if(stopped)return;
        if(receipt?.version!==version||receipt.examSessionToken!==scope.examSessionToken||receipt.generation!==scope.generation
            ||receipt.section!==pending.section||receipt.operationId!==pending.operationId||receipt.outcome!==pending.outcome||!id(receipt.attemptToken)
            ||receipt.payloadHash!==await hash(text.encode(JSON.stringify(pending))))throw new Error('Biên nhận không khớp bản đã lưu.');
        record.receipts[pending.section]=receipt;record.pending.shift();
        try{await persist();}catch(error){record.pending.unshift(pending);delete record.receipts[pending.section];throw error;}
        if(continuity()&&pending.section==='listening')
          observe('listening_server_received',{operationId:pending.operationId,outcome:pending.outcome||'submitted'});
      }
      if(!record.pending.length)notify('Máy chủ đã xác nhận nhận bài');
    }catch(error){
      retryAt=performance.now()+10_000;
      if([400,401,403,409,422].includes(error.status)){record.review=true;await persist().catch(()=>{});}
      notify(record.review?'Bài vẫn lưu trên máy · Cần đối soát':'Đã lưu trên máy · Chờ đồng bộ');
    }finally{busy=false;}
  }

  async function verifiedAudio(){
    if(verifiedBlob)return verifiedBlob;
    const stored=await store.get(key+':audio');
    const manifest=record.package.audioManifest;
    if (!(stored?.blob instanceof Blob)||stored.blob.size!==manifest.byteLength||await hash(await stored.blob.arrayBuffer())!==manifest.sha256) {
      throw new Error('Audio trên máy chưa khớp. Bài vẫn được giữ.');
    }
    verifiedBlob=stored.blob;
    if(continuity())observe('audio_download_verified',{byteLength:verifiedBlob.size});
    return verifiedBlob;
  }

  async function preparePlayer(){
    if(preparedPlayer)return preparedPlayer;
    if(!preparingPlayer)preparingPlayer=verifiedAudio().then(blob=>{
      if(stopped)throw new Error('Đã đóng lượt Listening.');
      preparedPlayer=prepareContinuityAudio(blob,observe);
      return preparedPlayer;
    }).finally(()=>{preparingPlayer=null;});
    return preparingPlayer;
  }

  async function mountPlayer({autoplay=false,...options}){
    const section=record.sections.listening;
    if(playing||next()!=='listening'||!section)return;
    const timing=record.package.timing;
    const player=continuity()
      ? mountContinuityListeningPlayer({...options,section,timing,now,persist,observe,
          entry:section.eofAt?null:await preparePlayer()})
      : await mountOfflineListeningPlayer({...options,section,timing,verifiedAudio,now,persist});
    if(!player)return;
    playing=player;
    if(autoplay)playing.playFromStart();
  }

  function download(liveDraft=null){
    const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const body=order().map(section=>{
      const progress=record.sections[section];
      const status=progress?.interrupted
        ? (record.receipts[section]?'Listening gián đoạn · Máy chủ đã nhận':'Listening gián đoạn · Chờ đồng bộ')
        : record.receipts[section]?'Máy chủ đã nhận':progress?.operationId?'Đã lưu trên máy · Chờ đồng bộ':
        progress?'Đang làm':'Chưa bắt đầu';
      const started=progress?.startedAt?` · Bắt đầu ${new Date(progress.startedAt).toISOString()}`:'';
      const answers=paper&&liveDraft&&next()===section?liveDraft:record.drafts[section]||{};
      return `<h2>${section}</h2><dl>`+Object.entries(answers).map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')+
        `</dl><p>${status}${started}</p>`;
    }).join('');
    const html='<!doctype html><html lang="vi"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><title>Bài làm '+title+'</title><h1>Bài làm '+title+'</h1>'+body+'</html>';
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=title.replaceAll(' ','-')+'.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),30_000);
  }
  const resultToken=()=>record.receipts[order().at(-1)]?.attemptToken||null;
  const hasReceipt = paper ? Boolean(resultToken()) : Object.keys(record.receipts).length > 0;
  if (record.review) notify('Bài vẫn lưu trên máy · Cần đối soát');
  else if (record.pending.length) notify('Đã lưu trên máy · Chờ đồng bộ');
  else if (hasReceipt) notify('Máy chủ đã xác nhận nhận bài');
  else if (paper) notify('Tự lưu trên thiết bị');
  void flush();
  return {content:record.package.content,paper,view,start,begin,saveDrafts,seal,mountPlayer,verifiedAudio,download,resultToken,now,
    activated:()=>Boolean(record.activatedAt),drafts:()=>structuredClone(record.drafts),revisions:()=>({...record.revisions}),close,changed,
    message:()=>message,reviewComplete:()=>playing?.reviewComplete()===true,
    continuity,preparePlayer,interrupt,acknowledgeInterruption,setJournal,markListeningStart,
    listeningReviewStarted:()=>Boolean(record.sections.listening?.eofAt)};
}
