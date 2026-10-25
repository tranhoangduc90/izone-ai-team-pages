import '../teacher-sso.js';
import {createTeacherLoginPreference} from '../../shared/teacher-login-preference.js?rev=20260918-v1';
export function createTeacherSessionClient({apiBaseUrl,sessionPath}){
 const url=new URL(sessionPath,apiBaseUrl).href;
 async function restore(){
  const r=await fetch(url,{credentials:'include',cache:'no-store'});
  if(r.status===401)return null;
  const v=await r.json();if(!r.ok)throw Object.assign(Error(v.message||'Chưa xác minh được quyền giảng viên.'),{status:r.status});return v;
 }
 return {restore,async login(credential){await globalThis.IzoneTeacherSso.login('task1',credential,createTeacherLoginPreference(()=>localStorage).read());return restore();},async logout(){await globalThis.IzoneTeacherSso.logout();return {ok:true};}};
}
