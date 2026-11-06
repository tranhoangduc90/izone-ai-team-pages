// Chỉ opt-in lớp K67 đã xác minh; danh sách trộn lớp giữ giao diện nền.
export function isWriting67Scope(classIds) {
  return Array.isArray(classIds) && classIds.length > 0 &&
    classIds.every(id => typeof id === 'string' && id.toUpperCase() === 'IC2304');
}

export function setWriting67Scope(classIds) {
  const active = isWriting67Scope(classIds);
  if (active) {
    document.documentElement.dataset.izoneTheme = 'master170';
    document.body.dataset.m170Product = 'writing';
    document.body.dataset.m170Course = '67';
  } else {
    delete document.documentElement.dataset.izoneTheme;
    delete document.body.dataset.m170Product;
    delete document.body.dataset.m170Course;
  }
  return active;
}
