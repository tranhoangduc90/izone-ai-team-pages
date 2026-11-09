(() => {
  const destination = new URL('../term-test-2-computer-based/', location.href);
  const params = new URLSearchParams(location.search);
  const classCode = params.get('class')?.trim().toUpperCase();
  const mode = params.get('mode');
  const link = document.getElementById('exam-link');

  if (!['IC2213', 'IC2207'].includes(classCode)) {
    link.hidden = true;
    document.getElementById('notice').textContent = 'Hãy mở đường dẫn chính do giảng viên gửi.';
    return;
  }

  destination.searchParams.set('class', classCode);
  if (mode === 'lis_first' || mode === 'read_first') destination.searchParams.set('mode', mode);
  link.href = destination.href;
  location.replace(destination.href);
})();
