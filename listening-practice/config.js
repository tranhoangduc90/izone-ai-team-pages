// API riêng Listening; không chứa khóa chấm hoặc credential.
window.LISTENING_CONFIG=Object.freeze({apiBase:['127.0.0.1','localhost'].includes(location.hostname)?'/api':'https://ducizone.ddns.net/listening-practice-api/api'});
