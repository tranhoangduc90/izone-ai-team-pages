(function () {
  'use strict';
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let meta=null,binding=null,blocked=false;
  const controllers=new Set();
  // Từng getter có thể bị chặn; vẫn dùng nơi còn truy cập được, hoặc giữ lượt trong RAM.
  const stores=(names=['sessionStorage','localStorage'])=>names.flatMap(name=>{try{return window[name]?[window[name]]:[];}catch{return [];}});
  const allowed=slug=>/^substitute-test-[12]-k(?:56|67)$/.test(slug);
  function stop(){blocked=true;for(const controller of controllers)controller.abort();controllers.clear();window.dispatchEvent(new Event('substitute:stopped'));}
  async function initialize(config,app){
    if(!allowed(config.slug))throw new Error('Bài thi không hợp lệ.');
    // Chỉ link lớp thử yêu cầu thêm hai hồ sơ giả; link lớp thật gửi payload cũ.
    const testClass=/(?:^|[?&])class=CODEXID261018(?:&|$)/.test(location.search||'');
    const controller=new AbortController();controllers.add(controller);
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(app.API_BASE_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({route:'/api/test/history',payload:testClass?{qaClass:'CODEXID261018'}:{}}),signal:controller.signal,cache:'no-store'});
      const value=await response.json();
      if(!response.ok||value.testSlug!==config.slug||!uuid.test(value.historyEpoch)||value.stateVersion!==2)throw new Error('Không xác nhận được phiên dữ liệu. Hãy tải lại trang.');
      if(value.maintenance)throw new Error('Bài thi đang bảo trì. Vui lòng quay lại sau.');
      if(value.classes!==undefined&&(!Array.isArray(value.classes)||!value.classes.length||new Set(value.classes.map(c=>c?.code)).size!==value.classes.length||!value.classes.some(c=>c.code==='DEMO')||value.classes.some(c=>!c||!(/^(?:DEMO|IC\d{3,8})$/.test(c.code)||testClass&&c.code==='CODEXID261018')||typeof c.name!=='string'||!c.name.trim())))throw new Error('Danh sách lớp không hợp lệ. Hãy tải lại trang.');
      meta=value;return value;
    }finally{clearTimeout(timer);controllers.delete(controller);}
  }
  function bind(value){
    if(!meta||blocked)throw new Error('Phiên làm bài không còn hợp lệ.');
    const previous=binding;
    binding={testSlug:meta.testSlug,historyEpoch:meta.historyEpoch,classCode:String(value.classCode||'').toUpperCase(),
      studentRef:String(value.studentRef||''),clientRunId:String(value.clientRunId||''),attemptToken:String(value.attemptToken||''),
      ...(value.examVersion?{examVersion:value.examVersion}:{})};
    if(value.examSessionId)binding.examSessionId=value.examSessionId;
    else if(previous?.examSessionId&&['classCode','studentRef','clientRunId'].every(key=>previous[key]===binding[key]))binding.examSessionId=previous.examSessionId;
    if(meta.testSlug==='substitute-test-2-k67'&&value.writingSessionId)binding.writingSessionId=value.writingSessionId;
    if(binding.examVersion&&(binding.testSlug!=='substitute-test-2-k67'||binding.examVersion!=='substitute-k67-test2-two-task-20261007-v1'))throw new Error('Phiên bản Writing không hợp lệ.');
    if(!uuid.test(binding.clientRunId)||!binding.studentRef)throw new Error('Thiếu định danh lượt làm bài.');
    return {...binding};
  }
  function key(prefix,namespace,{lobby=false}={}){
    if(!meta)throw new Error('Chưa xác nhận phiên dữ liệu.');
    const suffix=lobby?'lobby':binding?binding.studentRef+':'+binding.clientRunId:'unbound';
    return prefix+meta.testSlug+':'+namespace+':server-grade:state-v2:'+meta.historyEpoch+':'+suffix;
  }
  function accept(value,expected=binding){
    const b=value?._substitute;
    if(blocked||!meta||!b||b.version!==2||b.testSlug!==meta.testSlug||b.historyEpoch!==meta.historyEpoch)return false;
    if(expected&&['classCode','studentRef','clientRunId'].some(k=>String(b[k]||'')!==String(expected[k]||'')))return false;
    if(expected?.attemptToken&&b.attemptToken!==expected.attemptToken)return false;
    if(b.examVersion&&(b.testSlug!=='substitute-test-2-k67'||b.examVersion!=='substitute-k67-test2-two-task-20261007-v1'))return false;
    // Lobby reload validates the saved version before a specific run is rebound.
    if(expected&&(b.examVersion||'')!==(expected.examVersion||''))return false;
    if(expected?.writingSessionId&&b.writingSessionId!==expected.writingSessionId)return false;
    return ['classCode','studentRef','clientRunId','attemptToken','examVersion','writingSessionId'].every(k=>!value[k]||String(value[k])===String(b[k]||''));
  }
  function stamp(value){
    if(blocked)throw new Error('Lượt làm bài đã được reset.');
    const b=binding||{classCode:value.classCode||'',studentRef:value.studentRef||'',clientRunId:value.clientRunId||''};
    return {...value,_substitute:{...b,version:2,testSlug:meta.testSlug,historyEpoch:meta.historyEpoch}};
  }
  function canReset(slug){
    if(!allowed(slug)||slug!==(meta?.testSlug||window.TERM_TEST_CONFIG?.slug))return false;
    const selected=typeof document!=='undefined'?document.getElementById('bootstrapClass'):null;
    if(selected&&selected.value!=='DEMO')return false;
    // Định danh đã xác nhận thắng URL/DOM; không đổi lớp để reset lượt thật.
    const current=binding?.classCode||window.TERM_TEST_BOOTSTRAP?.classCode;
    if(current)return current==='DEMO';
    return (selected?selected.value:new URL(location.href).searchParams.get('class'))==='DEMO';
  }
  function clear(slug,{broadcast=true}={}){
    if(!allowed(slug))throw new Error('INVALID_RESET_SCOPE');
    if(!canReset(slug))throw new Error('RESET_DEMO_ONLY');
    stop();
    if(broadcast)localStorage.setItem('izone-demo-reset:'+slug+':DEMO:server-grade',crypto.randomUUID());
    const prefixes=['izone-test:','izone-test-ui:','izone-test-annotations:'].map(p=>p+slug+':');
    for(const storage of stores()){
      const keys=[];for(let i=0;i<storage.length;i++){
        const k=storage.key(i),prefix=k&&prefixes.find(p=>k.startsWith(p));if(!prefix)continue;
        const namespace=k.slice(prefix.length).split(':')[0];
        if(namespace==='DEMO')keys.push(k);
        else if(namespace==='RETAKE-LOBBY'){
          // Lobby dùng chung: chỉ xóa khi xác định được nó thuộc DEMO.
          try{const v=JSON.parse(storage.getItem(k));if((v.classCode||v._substitute?.classCode)==='DEMO'&&(!v._substitute?.classCode||v._substitute.classCode==='DEMO'))keys.push(k);}catch{/* Dữ liệu không rõ chủ được giữ nguyên. */}
        }
      }
      for(const k of keys)storage.removeItem(k);
      if(keys.some(k=>storage.getItem(k)!==null))throw new Error('STORAGE_NOT_CLEARED');
    }
    history.replaceState(null,'',location.href);
  }
  function payload(value){if(blocked||!meta)throw new Error('Lượt làm bài đã hết hiệu lực. Hãy tải lại trang.');return {...value,historyEpoch:meta.historyEpoch,...(binding?{classCode:binding.classCode,studentRef:binding.studentRef,clientRunId:binding.clientRunId}:{}),...(binding?.examSessionId?{examSessionId:binding.examSessionId}:{}),...(binding?.examVersion?{examVersion:binding.examVersion}:{}),...(binding?.writingSessionId?{writingSessionId:binding.writingSessionId}:{})};}
  function track(controller){if(blocked)controller.abort();else controllers.add(controller);return ()=>controllers.delete(controller);}
  window.addEventListener('storage',event=>{if(meta&&canReset(meta.testSlug)&&event.key==='izone-demo-reset:'+meta.testSlug+':DEMO:server-grade'&&event.newValue)stop();});
  window.SUBSTITUTE_STATE=Object.freeze({initialize,bind,key,accept,stamp,canReset,clear,payload,track,stop,storages:stores,get blocked(){return blocked;},get meta(){return meta;}});
}());
