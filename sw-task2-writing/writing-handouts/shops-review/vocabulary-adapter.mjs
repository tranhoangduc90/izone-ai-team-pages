export function vocabularyPoint(row){
 const declared=String(row?.point||row?.key||'').toUpperCase();
 if(/^[AXB][12]$/.test(declared))return declared;
 const field=/^idea([12])_([axb])$/.exec(row?.sourceField||'');
 return field?field[2].toUpperCase()+field[1]:null;
}
// Draft text does not invalidate vocabulary; changes to the approved arguments do.
export function sameVocabularySource(before,after){
 return ['body_choice','topic_sentence','body1_idea1','body1_idea2','body2_idea1','body2_idea2',
  'idea1_a','idea1_x','idea1_b','idea2_a','idea2_x','idea2_b'].every(k=>(before?.[k]||'')===(after?.[k]||''));
}
export function legacyVocabularyRows(rows){
 if(!Array.isArray(rows))return [];
 return rows.filter(row=>!vocabularyPoint(row)).slice(0,30).map(row=>({
  label:String(row?.idea||row?.sourceField||'Nội dung đã lưu'),
  terms:(Array.isArray(row?.terms)?row.terms:[]).map(term=>typeof term==='string'?{phrase:term,meaningVi:''}:{phrase:String(term?.phrase||''),meaningVi:String(term?.meaningVi||'')}).filter(t=>t.phrase),
 })).filter(row=>row.terms.length);
}
