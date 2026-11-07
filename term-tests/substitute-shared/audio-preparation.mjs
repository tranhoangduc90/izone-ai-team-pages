import {DIRECT_POLICY,directAsset,downloadDirect,supportsDirect} from '../../shared/audio/direct-substitute.mjs?v=20261107-substitute-r2-v1';

const fields=['testSlug','classCode','studentRef','clientRunId','historyEpoch','examOrder','deviceId','generation'];
const same=(scope,binding)=>Boolean(binding&&fields.every(key=>binding[key]===scope[key]));
const denied=()=>Object.assign(new Error('Quyền tải audio không khớp lượt thi.'),{accessDenied:true});

// Native grants stay in this tab's memory. The downloaded audio is verified before the UI may start the exam.
export async function authorizeSubstituteAudio(scope,request,{signal}={}){
 if(!supportsDirect())return null;
 const input={...scope,audioPolicy:DIRECT_POLICY};
 let latest,receivedAt;
 const read=async requestSignal=>{
  const result=await request(input,requestSignal);
  if(result.audioTransport==='legacy')return null;
  if(result.audioTransport!==DIRECT_POLICY||!same(scope,result.binding)||typeof result.audioPreparationToken!=='string')throw denied();
  const asset=directAsset(result.manifest,scope.testSlug);
  if(asset.sha256!==result.binding.sha256||latest&&latest.manifest.sha256!==asset.sha256)throw denied();
  latest=result;
  receivedAt=performance.now();
  return result;
 };
 if(!await read(signal))return null;
 return Object.freeze({
  async download(options={}){
   return downloadDirect(latest.manifest,latest.audioDownload,{...options,signal:options.signal??signal,testSlug:scope.testSlug,
    preferFallback:latest.audioDownload===null,refresh:async({signal:nextSignal})=>{
     const next=await read(nextSignal);
     return next?{manifest:next.manifest,download:next.audioDownload}:{manifest:latest.manifest,download:null};
    }});
  },
  isCurrent(current){return same(current,scope)&&performance.now()-receivedAt<115*60_000;},
  startFields(current){
   if(!same(current,scope))throw denied();
   return {audioPolicy:DIRECT_POLICY,audioPreparationToken:latest.audioPreparationToken};
  }
 });
}
