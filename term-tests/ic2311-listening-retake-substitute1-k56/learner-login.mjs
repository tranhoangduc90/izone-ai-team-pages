export async function showLearnerLogin(container, challenge, onCredential) {
  const script=document.createElement('script');
  script.src='https://accounts.google.com/gsi/client';
  await new Promise((resolve,reject)=>{
    script.onload=resolve;
    script.onerror=reject;
    document.head.append(script);
  });
  const client=globalThis.google?.accounts?.id;
  if(!client)throw Error('GOOGLE_SIGN_IN_UNAVAILABLE');
  client.initialize({client_id:challenge.googleClientId,nonce:challenge.nonce,
    callback:({credential})=>onCredential({credential,nonce:challenge.nonce})});
  client.renderButton(container,{text:'signin_with',theme:'outline',size:'large',locale:'vi'});
  container.hidden=false;
}
