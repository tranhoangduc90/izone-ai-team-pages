// Fixture sender. A close or retry may change the grant, but only an exact ACK
// can settle the durable batch and advance the source cursor.
const enc=new TextEncoder();

export function createPretestContentSender({stage,grant,post,waitMs=120_000}){
  const inFlight=new Map();
  async function transmit(binding,destination,force){
    const batch=await stage.reserve(binding,destination,{force,waitMs});
    if(!batch)return {status:'deferred'};
    const ticket=await grant(batch);
    if(ticket?.bindingId!==binding||ticket.destination!==destination||!ticket.auth?.ticket) return {status:'held',batchId:batch.batchId};
    const request={schemaVersion:1,bindingId:binding,batchId:batch.batchId,eventPayloadSha256:batch.eventPayloadSha256,
      auth:ticket.auth,events:batch.events};
    if(enc.encode(JSON.stringify(request)).byteLength>60_000)throw Error('CONTENT_TRANSPORT_LIMIT');
    const receipt=await post(destination,request);
    const removed=await stage.acknowledge(batch,receipt);
    return {status:removed?'acknowledged':'settled-by-peer',batchId:batch.batchId,count:batch.ids.length};
  }
  return {flush(binding,destination,{force=false}={}){
    if(!/^[a-f0-9]{64}$/.test(binding)||!['collector-v1','pubsub-v1'].includes(destination))throw Error('CONTENT_TRANSPORT_SCOPE');
    const lane=binding+':'+destination;
    if(inFlight.has(lane))return inFlight.get(lane);
    const job=transmit(binding,destination,force).finally(()=>inFlight.delete(lane));
    inFlight.set(lane,job);
    return job;
  }};
}
