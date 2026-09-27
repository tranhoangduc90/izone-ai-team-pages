/*
 * Chỉ nhớ lựa chọn tự đăng nhập của giảng viên trên thiết bị này.
 * Mã Google và dữ liệu học viên không được ghi vào localStorage.
 */
const KEY = 'izone:teacher-auto-login:v1';

export function createTeacherLoginPreference(getStorage) {
  return {
    read() {
      try { return getStorage().getItem(KEY) === '1'; } catch { return false; }
    },
    set(enabled) {
      try {
        if (enabled) getStorage().setItem(KEY, '1');
        else getStorage().removeItem(KEY);
        return this.read() === enabled;
      } catch { return false; }
    }
  };
}
