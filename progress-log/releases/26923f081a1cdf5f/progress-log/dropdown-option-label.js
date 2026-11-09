// Bộ soạn tạo UUID nội bộ. Phiếu cũ dùng mã ngắn A/B hoặc i/ii làm một phần nhãn.
const INTERNAL_OPTION_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;

export function dropdownOptionLabel(option, separator = '. ') {
  return INTERNAL_OPTION_ID.test(option.id) ? option.label : option.id + separator + option.label;
}
