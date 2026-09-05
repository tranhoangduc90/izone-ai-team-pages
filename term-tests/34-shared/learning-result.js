(function () {
  'use strict';

  function sectionIdForType(type) {
    const value = String(type || '');
    if (value.startsWith('vocabulary')) return 'vocabulary';
    if (value.startsWith('listening')) return 'listening';
    if (value.startsWith('pronunciation')) return 'pronunciation';
    if (value.startsWith('translation')) return 'translation';
    if (value.startsWith('writing') || value.startsWith('speaking')) return 'speaking';
    return '';
  }

  function sectionIdForTitle(title) {
    const value = String(title || '').toLowerCase();
    if (value.includes('vocabulary')) return 'vocabulary';
    if (value.includes('listening')) return 'listening';
    if (value.includes('pronunciation')) return 'pronunciation';
    if (value.includes('translation')) return 'translation';
    if (value.includes('writing') || value.includes('speaking')) return 'speaking';
    return '';
  }

  function groupResultItems({ blocks, sections, items }) {
    const sourceBlocks = blocks?.length ? blocks : [];
    const sourceGroups = sourceBlocks.length
      ? sourceBlocks.map((block, index) => ({
        id: block.blockId || sectionIdForTitle(block.title) || `block-${index + 1}`,
        fallbackId: sectionIdForTitle(block.title),
        label: block.title || sections?.[index]?.label || `Phần ${index + 1}`,
        score: 0,
        maxScore: 0,
        gradedMaxScore: 0,
        correct: 0,
        graded: 0,
        items: []
      }))
      : (sections || []).map(section => ({
        id: section.id,
        fallbackId: section.id,
        label: section.label,
        score: 0,
        maxScore: 0,
        gradedMaxScore: 0,
        correct: 0,
        graded: 0,
        items: []
      }));
    const groupsByItemId = new Map();
    const groupsByFallbackId = new Map();

    for (const [index, group] of sourceGroups.entries()) {
      for (const item of sourceBlocks[index]?.items || []) {
        groupsByItemId.set(item.itemVersionId, group);
      }
      if (group.fallbackId && !groupsByFallbackId.has(group.fallbackId)) {
        groupsByFallbackId.set(group.fallbackId, group);
      }
    }

    for (const item of items || []) {
      const group = groupsByItemId.get(item.itemVersionId) || groupsByFallbackId.get(sectionIdForType(item.pedagogicalTypeCode));
      if (!group) continue;
      group.items.push(item);
      const maxScore = Number(item.maxScore) || 0;
      const isPending = item.verdict === 'pending' || item.verdict === 'manual_review';
      if (maxScore <= 0) continue;
      group.maxScore += maxScore;
      group.score += Number(item.scoreEarned) || 0;
      if (!isPending) {
        group.gradedMaxScore += maxScore;
        group.graded += 1;
      }
      if (item.verdict === 'correct') group.correct += 1;
    }

    return sourceGroups.filter(group => group.items.length);
  }

  window.WEBTEST34_LEARNING_RESULT = Object.freeze({ groupResultItems });
}());
