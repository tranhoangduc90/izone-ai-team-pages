let clientId;
async function googleReady(){
 const end=Date.now()+15000;
 while(Date.now()<end){if(window.google?.accounts?.id)return window.google.accounts.id;await new Promise(r=>setTimeout(r,100));}
 throw Error('Chưa tải được nút Google. Kiểm kết nối rồi bấm Thử lại đăng nhập.');
}
export async function renderGoogleLogin(container,{onCredential,onError}){
 if(!container)return;
 const response=await fetch((window.IZONE_SHOPS?.apiBase||'/api/v1/')+'auth/config',{credentials:'include',cache:'no-store'});if(!response.ok)throw Error('Chưa đọc được cấu hình đăng nhập.');
 const config=await response.json();if(!config.sharedSession)throw Error('Bộ phiên dùng chung chưa sẵn sàng.');
 const g=await googleReady();
 if(clientId!==config.googleClientId){clientId=config.googleClientId;g.initialize({client_id:clientId,ux_mode:'popup',auto_select:false,callback:result=>Promise.resolve(onCredential(result.credential)).catch(onError)});}
 if(!container.isConnected)return;
 g.renderButton(container,{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'rectangular',locale:'vi',width:300});
}
