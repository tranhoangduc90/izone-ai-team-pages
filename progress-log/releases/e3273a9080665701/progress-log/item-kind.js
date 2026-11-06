// Mode của câu có ưu tiên; dữ liệu cũ vẫn đọc được mà không ghi lại definition.
export const effectiveItemKind=(item,block)=>item.kind??block?.kind??null;
export const editorItemKind=(item,block)=>effectiveItemKind(item,block)??(item.graderType==='none'?'survey':'exercise');
