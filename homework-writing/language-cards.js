// Chỉ chiếu các cụm sửa đã kiểm; không chấm lại hoặc đổi bản AI đã lưu.
export function languageCards(result) {
  const edits = new Map((result.languageCards || []).map(card => [card.id, card]));
  return result.items.flatMap((item, sourceIndex) => {
    const highlights = (item.highlights || []).filter(h => [h.original,h.revised].every((r,i) =>
      Number.isSafeInteger(r?.start) && Number.isSafeInteger(r?.end) && r.start >= 0 && r.end > r.start && r.end <= (i ? item.revised_text : item.original_text).length));
    return (highlights.length ? highlights : [null]).map((highlight, index) => {
      const id = `s${sourceIndex}-${highlight ? 'h'+index : 'whole'}`;
      const replacement = highlight && item.revised_text.slice(highlight.revised.start,highlight.revised.end);
      const revised = highlight ? item.original_text.slice(0,highlight.original.start)+replacement+item.original_text.slice(highlight.original.end) : item.revised_text;
      const edit = edits.get(id), revisedText = edit?.revised_text ?? revised;
      return {id, item:item.item, sourceIndex, correctionIndex:index, correctionCount:highlights.length,
        original_text:item.original_text, revised_text:revisedText, explanation:edit?.explanation ?? (highlight?.reason || item.explanation),
        decision:revisedText === item.original_text ? 'KEEP' : item.decision === 'UPGRADE' ? 'UPGRADE' : 'FIX',
        needsReview:!highlight && item.original_text !== item.revised_text,
        highlights:highlight ? [{original:highlight.original,revised:{start:highlight.original.start,end:highlight.original.start+replacement.length},reason:highlight.reason}] : [],
        revisedHighlights:revisedText === revised && highlight ? [{revised:{start:highlight.original.start,end:highlight.original.start+replacement.length}}] : []};
    });
  });
}
