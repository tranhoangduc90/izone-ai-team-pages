// Khi phát hành, thay duy nhất apiBase bằng địa chỉ API Reading đã kiểm chứng.
window.READING_CONFIG=Object.freeze({
 apiBase:['127.0.0.1','localhost'].includes(location.hostname)?'/api':'https://ducizone.ddns.net/reading-practice-api/api'
});
