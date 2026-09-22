/* Phiên Google chỉ giữ trong bộ nhớ; quyền quyết định tại máy chủ. */
(() => {
  const clientId='235597750133-urmb86ktf5recnvvtbghf13bktfv5rkj.apps.googleusercontent.com';
  let idToken='',actor=null,expiryTimer,epoch=0;
  function clear(message='Đã đăng xuất.') {
    epoch++;idToken='';actor=null;clearTimeout(expiryTimer);
    document.getElementById('recordingAuthStatus').textContent=message;
    document.getElementById('recordingLogout').hidden=true;
    document.getElementById('recordingGoogleLogin').hidden=false;
    document.dispatchEvent(new Event('recording-auth-changed'));
  }
  function token(){if(!actor||Date.now()>=actor.expiresAt){clear('Vui lòng đăng nhập Google để xem nội bộ và xác nhận đăng.');throw new Error('AUTH_REQUIRED');}return idToken;}
  async function request(body){const current=epoch;const response=await fetch(window.RECORDING_NIGHTLY.actionUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...body,idToken:token()}),referrerPolicy:'no-referrer',cache:'no-store'});if(current!==epoch)throw new Error('AUTH_SESSION_CHANGED');if(response.status===401)clear('Phiên đăng nhập chưa hợp lệ. Vui lòng đăng nhập lại.');return response;}
  window.recordingAuth={token,request,clear,isAuthenticated:()=>Boolean(actor&&Date.now()<actor.expiresAt)};
  async function login(result) {
    clear('Đang xác minh quyền…');const current=epoch;
    const candidate=result.credential;if(!candidate)return clear('Google chưa trả về phiên đăng nhập.');
    document.getElementById('recordingAuthStatus').textContent='Đang xác minh quyền…';
    try{
      const response=await fetch(window.RECORDING_NIGHTLY.actionUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'auth',idToken:candidate}),referrerPolicy:'no-referrer',cache:'no-store'});
      const data=await response.json();if(current!==epoch)return;if(!response.ok||!data.ok||!data.actor?.verified||data.actor.expiresAt<=Date.now())throw new Error('DENIED');
      idToken=candidate;actor=data.actor;document.getElementById('recordingAuthStatus').textContent='Đã đăng nhập — có quyền xem nội bộ và xác nhận đăng.';
      document.getElementById('recordingLogout').hidden=false;document.getElementById('recordingGoogleLogin').hidden=true;
      expiryTimer=setTimeout(()=>clear('Phiên đã hết hạn. Vui lòng đăng nhập lại.'),Math.max(0,actor.expiresAt-Date.now()));document.dispatchEvent(new Event('recording-auth-changed'));
    }catch{if(current===epoch)clear('Tài khoản chưa được cấp quyền hoặc phiên Google không hợp lệ.');}
  }
  function init(attempt=0){
    if(!window.google?.accounts?.id){if(attempt<50)return setTimeout(()=>init(attempt+1),200);return clear('Không tải được đăng nhập Google. Hãy mở trang bằng Chrome và thử lại.');}
    google.accounts.id.initialize({client_id:clientId,auto_select:false,callback:login});
    google.accounts.id.renderButton(document.getElementById('recordingGoogleLogin'),{type:'standard',theme:'outline',size:'large',text:'signin_with',locale:'vi'});
  }
  document.getElementById('recordingLogout').addEventListener('click',()=>{window.google?.accounts?.id?.disableAutoSelect();clear();});
  init();
})();
