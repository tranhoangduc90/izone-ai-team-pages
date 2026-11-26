(() => {
  const entry=document.currentScript;
  const config=entry.dataset;
  const load=source=>new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=source;
    script.onload=resolve;
    script.onerror=()=>reject(Error('EXAM_ENTRY_ASSET_UNAVAILABLE'));
    document.head.append(script);
  });

  async function verifiedCandidate(){
    if(!navigator.serviceWorker)return false;
    const url=new URL(config.worker,location.href);
    try{
      // Reuse this verified worker when re-registering would fail offline.
      const existing=await navigator.serviceWorker.getRegistration();
      if(existing?.active?.scriptURL===url.href&&existing.active.state==='activated')return true;
      const registration=await navigator.serviceWorker.register(url,{updateViaCache:'none'});
      const stopAt=performance.now()+6000;
      let installing;
      while(performance.now()<stopAt){
        if(registration.active?.scriptURL===url.href&&registration.active.state==='activated')return true;
        const waiting=registration.installing??registration.waiting;
        if(waiting?.scriptURL===url.href)installing=waiting;
        if(installing?.state==='redundant')return false;
        await new Promise(resolve=>setTimeout(resolve,80));
      }
    }catch{}
    return false;
  }

  void (async()=>{
    const candidate=await verifiedCandidate();
    await load(candidate?config.timing:config.priorTiming);
    await load(candidate?config.bootstrap:config.priorBootstrap);
  })().catch(()=>console.error('EXAM_ENTRY_ASSET_UNAVAILABLE'));
})();
