// Nạp module trạng thái đăng nhập thật vào VM của các test giao diện cũ.
// Chỉ bổ sung thao tác DOM tối thiểu; không giả lập kết quả đăng nhập hay bỏ kiểm quyền.
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../shared/teacher-auth-state.js',import.meta.url),'utf8').replace(/^export /gm,'');

export function installTeacherAuthFixture(context) {
  function element(node={}) {
    const attributes=new Map();
    node.hidden??=false;
    node.handlers??={};
    node.addEventListener??=function(type,handler){this.handlers[type]=handler;};
    node.after??=function(sibling){this.nextElementSibling=sibling;};
    node.setAttribute??=function(name,value){attributes.set(name,String(value));};
    node.removeAttribute??=function(name){attributes.delete(name);};
    node.getAttribute??=function(name){return attributes.get(name)??null;};
    return node;
  }
  const doc=context.document;
  doc.createElement??=()=>element();
  element(doc.getElementById('login'));
  element(doc.getElementById('teacher-startup-status'));
  vm.runInContext(source,context,{filename:'shared/teacher-auth-state.js'});
}
