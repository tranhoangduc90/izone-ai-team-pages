/* Phiên trình chiếu có bộ nhớ riêng, kể cả khi chạy cùng tên miền với Progress Log. */
(() => {
  const script = document.currentScript;
  function makeStorage() {
    const entries = new Map();
    return {
      get length() { return entries.size; },
      key: index => [...entries.keys()][index] ?? null,
      getItem: key => entries.get(String(key)) ?? null,
      setItem: (key, value) => { entries.set(String(key), String(value)); },
      removeItem: key => { entries.delete(String(key)); },
      clear: () => entries.clear(),
    };
  }
  const memory = (parent !== window && parent.progressPresentation?.memory) || {
    localStorage: makeStorage(), sessionStorage: makeStorage(),
  };
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, name, { value: memory[name] });
  }
  // Bộ soạn và bài mẫu chạy trong bộ nhớ của tab, không mở kho danh tính dùng chung.
  Object.defineProperty(window, 'indexedDB', { value: undefined });
  window.addEventListener('storage', event => event.stopImmediatePropagation(), true);
  window.progressPresentation = Object.freeze({ memory, base: new URL('./', script.src) });
})();
