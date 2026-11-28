const normalInterval = 30000;

// Every visible surface asks the server for the same per-class cache. No browser owns the Portal schedule.
export function watchPortalCalendar({visible,read,apply,onError=()=>{}}) {
  let timer,context,request,generation=0,visibleBefore=false;
  function clear(){clearTimeout(timer);timer=undefined;}
  function schedule(delay=normalInterval){
    clear();
    if(context&&visible()&&!document.hidden)
      timer=setTimeout(()=>void refresh(),Math.max(50,delay));
  }
  async function refresh(){
    clear();
    if(!context||!visible()||document.hidden||request)return;
    const owner=context,version=generation;
    const controller=new AbortController();
    request=controller;
    let delay=normalInterval;
    try{
      const calendar=await read(owner,controller.signal);
      if(context!==owner||version!==generation||!visible()||document.hidden)return;
      if(calendar){
        delay=Number.isFinite(calendar.refreshInMs)?calendar.refreshInMs:normalInterval;
        apply(calendar,owner);
      }
    }catch(error){if(!controller.signal.aborted&&version===generation&&context===owner)onError(error,owner);}
    finally{
      if(request===controller)request=undefined;
      if(version===generation)schedule(delay);
    }
  }
  function resume(){
    const current=Boolean(context&&visible()&&!document.hidden);
    if(!current){clear();request?.abort();request=undefined;generation++;}
    else if(!visibleBefore||!timer)void refresh();
    visibleBefore=current;
  }
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('focus',()=>{if(context&&visible()&&!document.hidden)void refresh();});
  return {
    set(owner,calendar){
      if(!calendar){context=null;resume();return;}
      if(context?.key!==owner.key){generation++;request?.abort();request=undefined;}
      context=owner;
      visibleBefore=Boolean(visible()&&!document.hidden);
      apply(calendar,owner);
      schedule(calendar.refreshInMs);
    },
    resume
  };
}

export function renderPortalCalendar(root,calendar){
  root.hidden=!calendar;
  if(!calendar)return;
  let list=root.querySelector('ol');
  if(!list){
    const header=document.createElement('summary');header.textContent='Lịch học trên Portal';
    const notice=document.createElement('p');notice.className='muted';notice.setAttribute('role','status');
    list=document.createElement('ol');root.append(header,notice,list);
  }
  const notice=root.querySelector('[role="status"]');
  const checked=calendar.checkedAt?new Date(calendar.checkedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'';
  const message=calendar.stale?(checked?'Chưa kiểm được lịch mới. Lần đọc thành công gần nhất lúc '+checked+'.':'Chưa đọc được lịch Portal.'):'';
  if(notice.textContent!==message)notice.textContent=message;
  const old=new Map([...list.children].map(row=>[row.dataset.portalId,row]));
  const rows=calendar.entries.map(entry=>{
    const row=old.get(entry.id)||document.createElement('li');
    row.dataset.portalId=entry.id;
    const date=entry.date?.split('-').reverse().join('/');
    const label=entry.status==='cancelled'?'Nghỉ':entry.status==='needs_review'?'Chưa xác minh':'Buổi '+entry.sessionNumber;
    const text=[label,date,entry.startsAt?.slice(11,16)].filter(Boolean).join(' · ');
    if(row.textContent!==text)row.textContent=text;
    return row;
  });
  const keep=new Set(rows);
  for(const existing of [...list.children])if(!keep.has(existing))existing.remove();
  for(const [index,row]of rows.entries())if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);
}

export function applyCalendarToJourney(journey,calendar){
  const old=journey.portalSchedule;
  if(old?.checkedAt&&calendar.checkedAt&&Date.parse(old.checkedAt)>Date.parse(calendar.checkedAt))return journey;
  if(old?.version===calendar.version&&old?.stale===calendar.stale&&JSON.stringify(old?.links)===JSON.stringify(calendar.links))return journey;
  const entries=new Map(calendar.entries.map(entry=>[entry.id,entry]));
  const links=new Map((calendar.links||[]).map(entry=>[entry.storageSessionNumber,entry.id]));
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format();
  const sessions=journey.sessions.map(session=>{
    const id=links.get(session.sessionNumber)||session.erpSessionId;
    if(!id)return session;
    const slot=entries.get(id);
    const changes={
      erpSessionId:id,
      portalSessionNumber:slot?.sessionNumber??null,
      sessionDate:slot?.date??session.sessionDate,
      sessionStartTime:slot?.startsAt?.slice(11)??session.sessionStartTime,
      future:Boolean(slot?.status==='active'&&slot.date>today),
      scheduleStatus:!slot||slot.status==='needs_review'?'needs_review':
        slot.status==='cancelled'?'cancelled':calendar.stale?'temporarily_unavailable':'connected'
    };
    return Object.entries(changes).some(([key,value])=>session[key]!==value)?{...session,...changes}:session;
  });
  return {...journey,sessions,portalSchedule:calendar,
    scheduleStatus:calendar.stale?'temporarily_unavailable':calendar.entries.some(slot=>slot.status==='needs_review')?'needs_review':'connected'};
}
