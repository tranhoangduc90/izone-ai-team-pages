// Nhận thứ tự từ link, sau đó dùng trạng thái máy chủ làm nguồn sự thật.
// Token không chứng minh đã nộp Listening; lỗi API được giao diện hiện rõ và giữ nháp.
window.K67_EXAM_ORDER = Object.freeze({
  requested: () => new URLSearchParams(location.search).get('mode') === 'read_first' ? 'read_first' : 'lis_first',
  request: options => {
    if (!options.body) return options;
    const body = JSON.parse(options.body);
    return {...options, body:JSON.stringify({examMode:window.K67_EXAM_ORDER.requested(),
      examDelivery:document.body.classList.contains('cbt-mode')?'cbt':'answer_sheet',
      orderClientVersion:1,...body})};
  },
  apply: (state, response) => {
    if (!response.examMode) return;
    const url = new URL(location.href); url.searchParams.set('mode',response.examMode);
    history.replaceState(history.state,'',url.href);
    for (const field of ['examMode','examDelivery','nextSection','readingSubmitted','listeningSubmitted','completed',
      'readingStartedAt','readingDeadlineAt','listeningStartedAt','listeningDeadlineAt'])
      if (field in response) state[field] = response[field];
  },
  // Khôi phục cả hai kỹ năng: nháp server đã ACK thắng bản local cũ;
  // nháp local có revision lớn hơn vẫn giữ để gửi lại, không đánh dấu đã ACK giả.
  restoreDrafts: (state,response) => {
    const drafts={...state.drafts},draftRevisions={...state.draftRevisions},draftAckRevisions={...state.draftAckRevisions};
    for(const skill of ['listening','reading']) {
      const key=skill+'DraftRevision';if(!(key in response))continue;
      const server=Number(response[key])||0,local=Number(state.draftRevisions?.[skill])||0;
      if(server>=local) {drafts[skill]={...(response[skill+'Draft']||{})};draftRevisions[skill]=server;}
      draftAckRevisions[skill]=server;
    }
    return {drafts,draftRevisions,draftAckRevisions};
  }
});
