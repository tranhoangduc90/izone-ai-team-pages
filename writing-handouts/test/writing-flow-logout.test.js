// Nhận vào: đúng handler đăng xuất của Pages V1/V2 và phiên giả.
// Việc chính: chạy handler thật, kiểm thu hồi phía máy chủ trước khóa giao diện và lỗi mạng.
// Kết quả: không giữ phiên chỉ vì ẩn UI; không đổi cookie hoặc gọi API bên ngoài.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
for (const name of ['writing-flow.js','writing-flow-v2.js']) for(const fail of [false,true]) {
  test(name+' đăng xuất '+(fail?'khi mạng lỗi':'thu hồi phiên'),async()=> {
    const source=process.env.WRITING_LOGOUT_SOURCE_DIR
      ? path.join(process.env.WRITING_LOGOUT_SOURCE_DIR,name) : new URL('../js/'+name,import.meta.url);
    const code=fs.readFileSync(source,'utf8');
    const start=code.indexOf("$('flow-logout').addEventListener");
    const block=code.slice(start,code.indexOf('\nvoid init();',start));
    assert.ok(start>=0);
    const events=[];let callback;let warning='';
    const nodes={'flow-logout':{addEventListener(_event,handler){callback=handler;}},'remember-flow-login':{checked:true}};
    const context={
      $:id=>nodes[id],
      state:{sessionClient:{async logout(){events.push('revoke');if(fail)throw new Error('network fixture');}}},
      clearLogin(){events.push('clear');},
      google:{accounts:{id:{disableAutoSelect(){events.push('disable-auto');}}}},
      loginPreference:{set(value){events.push('remember:'+value);}},
      showError(_id,message){warning=message;},
    };
    vm.runInNewContext(block,context);
    await callback();
    assert.deepEqual(events,['revoke','clear','disable-auto','remember:false']);
    assert.equal(nodes['remember-flow-login'].checked,false);
    if(fail)assert.match(warning,/chưa xác nhận thu hồi phiên/u);
    else assert.equal(warning,'');
  });
}
