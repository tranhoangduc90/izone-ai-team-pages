const preparing = new WeakMap();

export function prepareExamShell(runtime) {
  const pending = preparing.get(runtime);
  if (pending) return pending;
  const task = runtime.prepareCache().catch(error => {
    preparing.delete(runtime);
    throw error;
  });
  preparing.set(runtime, task);
  return task;
}

export function warmExamShell(runtime) {
  if (navigator.onLine !== false) void prepareExamShell(runtime).catch(() => {});
}
