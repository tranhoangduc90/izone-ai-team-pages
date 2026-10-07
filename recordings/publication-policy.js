// Chính sách thuần được nhúng nguyên nguồn vào Code node và dashboard; không chứa credential.
var recordingPublication = (() => {
  const minimumSeconds = 600;
  function timestamp(value) {
    let text=String(value ?? '').trim();
    if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text))text=text.replace(' ','T')+'+07:00';
    return Date.parse(text);
  }
  function duration(record) {
    const start=timestamp(record?.recordingStart),end=timestamp(record?.recordingEnd);
    return Number.isFinite(start)&&Number.isFinite(end)&&end>start?(end-start)/1000:null;
  }
  function date(value) {
    const t=timestamp(value);return Number.isFinite(t)?new Date(t+7*3600000).toISOString().slice(0,10):'';
  }
  function validDate(value) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
    const parsed=new Date(value+'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
  }
  function title({lessonNumber,recordingDate,partNumber,totalParts}) {
    if(!Number.isInteger(Number(lessonNumber))||Number(lessonNumber)<1||!validDate(recordingDate))throw Error('INVALID_PUBLISH_METADATA');
    const [year,month,day]=recordingDate.split('-');
    const base=`Buổi ${Number(lessonNumber)} (${day}.${month}.${year.slice(2)})`;
    if(Number(totalParts)>1){if(!Number.isInteger(Number(partNumber))||Number(partNumber)<1||Number(partNumber)>Number(totalParts))throw Error('INVALID_PUBLISH_METADATA');return base+` - Phần ${Number(partNumber)}`;}
    return base;
  }
  function durationBlock(record) {
    const seconds=duration(record);return seconds===null?'DURATION_UNVERIFIED':seconds<minimumSeconds?'VIDEO_UNDER_TEN_MINUTES':'';
  }
  function eligiblePart(record) {
    return !record.excluded && record.type==='MP4' && record.status==='completed' && record.fileSize>0 && !record.observationStale && !durationBlock(record);
  }
  function parts(record,records) {
    const published=(records||[]).filter(r=>r.id!==record.id && record.classSessionId && r.classSessionId===record.classSessionId && r.videoId);
    if(!published.length)return {partNumber:record.partNumber,totalParts:record.totalParts||1,requiresConfirmation:false};
    const minimum=Math.max(...published.map(r=>Number(r.partNumber)||1))+1;
    const partNumber=Math.max(Number(record.partNumber)||0,minimum);
    return {partNumber,totalParts:Math.max(Number(record.totalParts)||1,partNumber),requiresConfirmation:true};
  }
  function metadata(record,input={}) {
    const className=String(input.className??record.className??'').trim().toUpperCase();
    const lessonNumber=Number(input.lessonNumber??record.lessonNumber);
    const recordingDate=String(input.recordingDate??record.recordingDate??date(record.recordingStart));
    if(!/^[A-Z]{1,4}\d{3,5}$/.test(className)||!Number.isInteger(lessonNumber)||lessonNumber<1||!validDate(recordingDate))throw Error('INVALID_PUBLISH_METADATA');
    return {className,lessonNumber,recordingDate};
  }
  const messages={DURATION_UNVERIFIED:'Chưa xác minh thời lượng',VIDEO_UNDER_TEN_MINUTES:'Video dưới 10 phút — không đăng YouTube',FILE_NOT_READY:'Chưa có MP4 hoàn chỉnh',STALE_METADATA:'Metadata chưa được xác minh lại',EMPTY_FILE:'Dung lượng tệp không hợp lệ',FILE_TOO_LARGE_FOR_PILOT:'File vượt giới hạn 640 MiB',RECORDING_DELETED:'Recording đã được xóa trong Zoom'};
  function playlistResults(playlists,query='') {
    const key=String(query).trim().toLocaleLowerCase('vi');
    const code=String(query).trim().toUpperCase();
    const exact=p=>String(p.title||'').toUpperCase().match(/\b[A-Z]{1,4}\d{3,5}\b/g)?.includes(code);
    return (playlists||[]).filter(p=>!key||String(p.title||'').toLocaleLowerCase('vi').includes(key)).sort((a,b)=>Number(Boolean(exact(b)))-Number(Boolean(exact(a)))||String(a.title).localeCompare(String(b.title),'vi')||String(a.id).localeCompare(String(b.id)));
  }
  return {minimumSeconds,duration,date,validDate,title,durationBlock,eligiblePart,parts,metadata,messages,playlistResults};
})();
