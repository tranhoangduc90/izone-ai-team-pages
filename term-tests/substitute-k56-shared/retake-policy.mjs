const SKILLS = Object.freeze(['listening', 'reading', 'writing']);
const EPSILON = 1e-9;

function assertScores(label, scores, maxScores) {
  for (const skill of SKILLS) {
    const value = scores?.[skill];
    const maximum = maxScores?.[skill];
    if (!Number.isInteger(maximum) || maximum <= 0) {
      throw new TypeError(`${label}: điểm tối đa ${skill} phải là số nguyên dương.`);
    }
    if (!Number.isInteger(value) || value < 0 || value > maximum) {
      throw new TypeError(`${label}: điểm ${skill} phải là số nguyên từ 0 đến ${maximum}.`);
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

function chooseIntegerCombination(actual, ideal, maxScores, capPct, portalDecimals) {
  const exact = [];
  const displayed = [];
  let nearest = null;

  for (let listening = 0; listening <= actual.listening; listening += 1) {
    for (let reading = 0; reading <= actual.reading; reading += 1) {
      for (let writing = 0; writing <= actual.writing; writing += 1) {
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
          capDistance: Math.abs(averagePct - capPct)
        };

        if (candidate.capDistance <= EPSILON) exact.push(candidate);
        if (Math.abs(displayedPct - capPct) <= EPSILON) displayed.push(candidate);
        if (!nearest || candidate.capDistance < nearest.capDistance - EPSILON
          || (Math.abs(candidate.capDistance - nearest.capDistance) <= EPSILON && compareCandidates(candidate, nearest) < 0)) {
          nearest = candidate;
        }
      }
    }
  }

  const pool = exact.length ? exact : displayed.length ? displayed : [nearest];
  pool.sort(compareCandidates);
  return {
    ...pool[0],
    mode: exact.length ? 'exact' : displayed.length ? 'rounds_to_cap' : 'nearest'
  };
}

function portalFields(scores, testNumber) {
  return {
    [`Term Test ${testNumber} Lis (Thi lại)`]: scores.listening,
    [`Term Test ${testNumber} Read (Thi lại)`]: scores.reading,
    [`Term Test ${testNumber} Wri (Thi lại)`]: scores.writing
  };
}

export function calculateRetakePolicy({
  firstAttempt,
  retakeActual,
  maxScores,
  capPct = 55,
  portalDecimals = 0,
  testNumber = 1
}) {
  assertScores('Điểm lần đầu', firstAttempt, maxScores);
  assertScores('Điểm thi lại', retakeActual, maxScores);
  if (!Number.isInteger(portalDecimals) || portalDecimals < 0 || portalDecimals > 3) {
    throw new TypeError('Số chữ số thập phân hiển thị trên Portal phải từ 0 đến 3.');
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
  const selected = chooseIntegerCombination(retakeActual, idealAdjustedScores, maxScores, capPct, portalDecimals);

  return {
    status: 'ready',
    policy: 'cap_55',
    policyApplied: true,
    capPct,
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
