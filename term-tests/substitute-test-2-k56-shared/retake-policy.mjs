const SKILLS = Object.freeze(['listening', 'reading', 'writing']);
const EPSILON = 1e-9;
export const SUBSTITUTE_TEST_2_MAX_SCORES = Object.freeze({ listening: 40, reading: 40, writing: 9 });
export const SUBSTITUTE_TEST_2_PORTAL_CLASS = 'IC2264';

function assertScores(label, scores, maxScores) {
  for (const skill of SKILLS) {
    const value = scores?.[skill];
    const maximum = maxScores?.[skill];
    if (typeof maximum !== 'number' || !Number.isFinite(maximum) || maximum <= 0) {
      throw new TypeError(`${label}: điểm tối đa ${skill} phải là số dương.`);
    }
    const validStep = Number.isInteger(value * (skill === 'writing' ? 10 : 1));
    if (typeof value !== 'number' || !Number.isFinite(value) || !validStep || value < 0 || value > maximum) {
      throw new TypeError(`${label}: điểm ${skill} không đúng bước điểm hoặc vượt ${maximum}.`);
    }
  }
}

function roundForDisplay(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizedAverage(scores, maxScores) {
  return SKILLS.reduce((sum, skill) => sum + scores[skill] / maxScores[skill], 0) / SKILLS.length * 100;
}

function compareCandidates(left, right) {
  if (Math.abs(left.cost - right.cost) > EPSILON) return left.cost - right.cost;
  if (Math.abs(left.capDistance - right.capDistance) > EPSILON) return left.capDistance - right.capDistance;
  if (Math.abs(left.pointDistance - right.pointDistance) > EPSILON) return left.pointDistance - right.pointDistance;
  for (const skill of SKILLS) {
    if (left.scores[skill] !== right.scores[skill]) return right.scores[skill] - left.scores[skill];
  }
  return 0;
}

function chooseIntegerCombination(actual, ideal, maxScores, floorPct, ceilingPct, portalDecimals) {
  const candidates = [];

  for (let listeningTick = 0; listeningTick <= actual.listening; listeningTick += 1) {
    for (let readingTick = 0; readingTick <= actual.reading; readingTick += 1) {
      for (let writingTick = 0; writingTick <= Math.round(actual.writing * 10); writingTick += 1) {
        const listening = listeningTick;
        const reading = readingTick;
        const writing = writingTick / 10;
        const scores = { listening, reading, writing };
        const averagePct = normalizedAverage(scores, maxScores);
        const displayedPct = roundForDisplay(averagePct, portalDecimals);
        const cost = SKILLS.reduce((sum, skill) => {
          const delta = (scores[skill] - ideal[skill]) / maxScores[skill];
          return sum + delta ** 2;
        }, 0);
        const pointDistance = SKILLS.reduce((sum, skill) => sum + Math.abs(scores[skill] - ideal[skill]), 0);
        const candidate = {
          scores,
          averagePct,
          displayedPct,
          cost,
          pointDistance,
          capDistance: Math.abs(averagePct - floorPct)
        };
        if (averagePct >= floorPct - EPSILON && averagePct <= ceilingPct + EPSILON
          && displayedPct >= floorPct - EPSILON && displayedPct <= ceilingPct + EPSILON) {
          candidates.push(candidate);
        }
      }
    }
  }

  if (!candidates.length) {
    throw new RangeError(`Không có tổ hợp điểm Portal trong khoảng ${floorPct}%–${ceilingPct}%.`);
  }
  candidates.sort(compareCandidates);
  return {
    ...candidates[0],
    mode: candidates[0].capDistance <= EPSILON ? 'exact' : 'within_55_57'
  };
}

function portalFields(scores, testNumber) {
  return {
    [`Term Test ${testNumber} Listening (Thi lại)`]: scores.listening,
    [`Term Test ${testNumber} Reading (Thi lại)`]: scores.reading,
    [`Term Test ${testNumber} Writing (Thi lại)`]: scores.writing
  };
}

export function calculateRetakePolicy({
  firstAttempt,
  retakeActual,
  maxScores = SUBSTITUTE_TEST_2_MAX_SCORES,
  capPct = 55,
  ceilingPct = 57,
  portalDecimals = 0,
  testNumber = 2
}) {
  if (maxScores?.listening !== 40 || maxScores?.reading !== 40
    || maxScores?.writing !== 9 || testNumber !== 2) {
    throw new TypeError('Substitute Test 2 K56 phải dùng đúng cột điểm 40/40/9.');
  }
  assertScores('Điểm lần đầu', firstAttempt, maxScores);
  assertScores('Điểm thi lại', retakeActual, maxScores);
  if (!Number.isInteger(portalDecimals) || portalDecimals < 0 || portalDecimals > 3) {
    throw new TypeError('Số chữ số thập phân hiển thị trên Portal phải từ 0 đến 3.');
  }
  if (typeof ceilingPct !== 'number' || !Number.isFinite(ceilingPct) || ceilingPct < capPct) {
    throw new TypeError('Ngưỡng trên của điểm điều chỉnh phải lớn hơn hoặc bằng 55%.');
  }

  const firstAveragePct = normalizedAverage(firstAttempt, maxScores);
  const retakeAveragePct = normalizedAverage(retakeActual, maxScores);
  const improved = retakeAveragePct > firstAveragePct + EPSILON;
  const capped = improved && retakeAveragePct > capPct + EPSILON;

  if (!capped) {
    const reason = improved ? 'improved_not_above_cap' : 'not_improved';
    return {
      status: 'ready',
      policy: reason,
      policyApplied: false,
      capPct,
      ceilingPct,
      portalDecimals,
      firstAveragePct,
      retakeAveragePct,
      factor: 1,
      actualScores: { ...retakeActual },
      idealAdjustedScores: { ...retakeActual },
      portalScores: { ...retakeActual },
      portalAveragePct: retakeAveragePct,
      portalDisplayedAveragePct: roundForDisplay(retakeAveragePct, portalDecimals),
      combinationMode: 'actual',
      portalFields: portalFields(retakeActual, testNumber),
      externalWrite: false
    };
  }

  const factor = capPct / retakeAveragePct;
  const idealAdjustedScores = Object.fromEntries(SKILLS.map(skill => [skill, retakeActual[skill] * factor]));
  const selected = chooseIntegerCombination(retakeActual, idealAdjustedScores, maxScores, capPct, ceilingPct, portalDecimals);

  return {
    status: 'ready',
    policy: 'cap_55',
    policyApplied: true,
    capPct,
    ceilingPct,
    portalDecimals,
    firstAveragePct,
    retakeAveragePct,
    factor,
    actualScores: { ...retakeActual },
    idealAdjustedScores,
    portalScores: selected.scores,
    portalAveragePct: selected.averagePct,
    portalDisplayedAveragePct: selected.displayedPct,
    combinationMode: selected.mode,
    portalFields: portalFields(selected.scores, testNumber),
    externalWrite: false
  };
}

export function policyLabel(policy) {
  return {
    cap_55: 'Áp dụng trần 55%',
    improved_not_above_cap: 'Gửi điểm thực tế',
    not_improved: 'Không áp dụng nâng điểm'
  }[policy] || 'Chờ xử lý';
}

export function portalClassDecision(classCode) {
  const normalized = String(classCode || '').trim().toUpperCase();
  return normalized === SUBSTITUTE_TEST_2_PORTAL_CLASS
    ? { eligible: true, classCode: normalized, classId: '1252', mode: 'portal' }
    : { eligible: false, classCode: normalized, classId: null, mode: normalized === 'DEMO' ? 'preview' : 'blocked' };
}
