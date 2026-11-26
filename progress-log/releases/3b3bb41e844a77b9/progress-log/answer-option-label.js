// Resolve stored option IDs only against the definition of the item being reviewed.
export function answerOptionLabel(item, value, empty = 'Chưa trả lời') {
  if (value == null || value === '') return empty;
  return item.options?.find(option => option.id === value)?.label || 'Không đối chiếu được lựa chọn';
}
