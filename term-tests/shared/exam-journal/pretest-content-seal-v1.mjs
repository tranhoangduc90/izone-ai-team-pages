// Portable Web Crypto producer used only in the synthetic content candidate.
export const sealedType='content_sealed_v1';
export const encryptionKeyId='pretest-content-fixture-v1';
export const segmentBytes=24*1024;
export const maxSegments=4;
const encoder=new TextEncoder();

export function contentAad(canonical,scopeId,row,env){
  return encoder.encode(canonical([sealedType,scopeId,row.id,row.pageVisitId,row.sequence,env.keyId,env.contentId,env.part,env.parts]));
}

function base64url(value){
  const bytes = new Uint8Array(value);
  let text='';
  for(let offset=0;offset<bytes.length;offset+=4096) text+=String.fromCharCode(...bytes.subarray(offset,offset+4096));
  return btoa(text).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

export async function sealContentEvent(row,scopeId,publicKey,canonical,keyId=encryptionKeyId){
  if (!['content_checkpoint','content_changed'].includes(row.type)) throw Error('SEALED_CONTENT_TYPE');
  const bytes=encoder.encode(canonical(row));
  const parts=Math.ceil(bytes.length/segmentBytes);
  if(parts>maxSegments) throw Error('SEALED_LIMIT');
  const {subtle}=crypto;
  const key=await subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
  const wrappedKey=base64url(await subtle.wrapKey('raw',key,publicKey,'RSA-OAEP'));
  const chunks=[];
  for(let part=0;part<parts;part++){
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const env={keyId,contentId:row.id,part,parts,wrappedKey,iv:base64url(iv)};
    const chunk={...row,type:sealedType,id:crypto.randomUUID(),data:{checkpointState:env}};
    const encrypted=await subtle.encrypt({name:'AES-GCM',iv,additionalData:contentAad(canonical,scopeId,chunk,env)},key,
      bytes.subarray(part*segmentBytes,(part+1)*segmentBytes));
    env.ciphertext=base64url(encrypted);
    chunks.push(chunk);
  }
  return chunks;
}
