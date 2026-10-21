// Chỉ lưu bài tự soạn của demo trên trình duyệt; không lưu dữ liệu lớp hoặc gọi Portal.
export const LIBRARY_PREFIX='izone:progress-log:thuy-review:authoring:v1:';
const valid=form=>form?.schemaVersion===3&&form.source==='mine'&&typeof form.id==='string'&&form.id.length>0&&typeof form.title==='string'&&Array.isArray(form.sections)&&Array.isArray(form.questions)&&['draft','published'].includes(form.status);
export function libraryStorage(getStorage){
  const read=(storage,key)=>{
    const raw=storage.getItem(key);if(raw===null)return null;
    const record=JSON.parse(raw);
    if(record.version!==1||!valid(record.form)||key!==LIBRARY_PREFIX+record.form.id||(record.working&&(!valid(record.working)||record.working.id!==record.form.id)))throw Error('Bản nháp đã lưu chưa đọc được. Dữ liệu cũ vẫn được giữ nguyên.');
    return record;
  };
  return {
    load(){
      const storage=getStorage(),records=[];
      for(let n=0;n<storage.length;n++){const key=storage.key(n);if(key?.startsWith(LIBRARY_PREFIX))records.push(read(storage,key));}
      records.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
      return {library:{version:1,forms:records.map(r=>r.form),assignments:[]},working:Object.fromEntries(records.filter(r=>r.working).map(r=>[r.form.id,r.working]))};
    },
    save(form,working=null){
      if(!valid(form)||working&&(!valid(working)||working.id!==form.id))throw Error('Bản nháp không hợp lệ, chưa ghi đè dữ liệu đã lưu.');
      const storage=getStorage(),key=LIBRARY_PREFIX+form.id;
      // Mỗi phiếu một mục riêng: lưu phiếu này không ghi đè phiếu khác ở tab khác.
      const previous=read(storage,key);
      if(working&&previous&&previous.form.revision!==form.revision)throw Error('Phiếu đã được lưu ở tab khác. Giữ tab này và mở bản mới để đối chiếu trước khi lưu.');
      if(!working&&previous&&form.revision<=previous.form.revision)throw Error('Có bản lưu mới hơn ở tab khác. Giữ phần đang sửa và mở bản mới để đối chiếu.');
      const record={version:1,form:structuredClone(form),...(working?{working:{...structuredClone(working),status:'draft'}}:{}),updatedAt:Date.now()};
      const value=JSON.stringify(record);
      try{storage.setItem(key,value);}catch{throw Error('Chưa lưu được nháp: bộ nhớ trình duyệt bị chặn hoặc đã đầy. Hãy giữ trang đang mở.');}
      if(storage.getItem(key)!==value)throw Error('Chưa xác nhận được bản nháp đã lưu. Hãy giữ trang đang mở.');
    }
  };
}
