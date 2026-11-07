const boundPickers = new WeakSet();

export const selectionKey = skill => 'ic2311-review-name:' + skill;

export async function readNameReview(api, studentRef, {check, signal} = {}) {
  const timeout = AbortSignal.timeout(7000);
  const response = await fetch(api + '/review-by-name', {
    method:'POST', credentials:'omit', cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({studentRef,check}),
    signal:signal ? AbortSignal.any([signal,timeout]) : timeout,
  });
  if (response.status===404) return null;
  if (!response.ok) throw Error('Review unavailable');
  return response.json();
}

export function attachStudentReview({api,skill}) {
  const student=document.getElementById('student');
  if (!student || boundPickers.has(student)) return;
  boundPickers.add(student);
  let current;

  async function checkSelected() {
    current?.abort();
    const studentRef=student.value;
    if (!studentRef || student.disabled || !navigator.onLine) return;
    const controller=new AbortController();
    current=controller;
    try {
      const available=await readNameReview(api,studentRef,{check:true,signal:controller.signal});
      if (!available?.ok || controller.signal.aborted || student.value!==studentRef || student.disabled) return;
      try { sessionStorage.setItem(selectionKey(skill),studentRef); } catch {}
      location.assign('../ic2311-retake-review/?' + new URLSearchParams({skill,view:'by-name'}));
    } catch {
      // A failed lookup leaves exam preparation available.
    } finally {
      if (current===controller) current=undefined;
    }
  }

  student.addEventListener('change',checkSelected);
  document.addEventListener('retake-already-submitted',checkSelected);
  addEventListener('pagehide',()=>current?.abort());
  if (student.value && student.offsetParent) void checkSelected();
}
