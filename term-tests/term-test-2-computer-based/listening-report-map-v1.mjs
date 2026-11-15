const readingGaps = [
  {id:'before-q1', from:57.14, to:82.46, part:1, questions:'1–5'},
  {id:'before-q6', from:252.14, to:277.42, part:1, questions:'6–10'},
  {id:'before-q11', from:460.62, to:490.96, part:2, questions:'11–14'},
  {id:'before-q15', from:639.68, to:670.06, part:2, questions:'15–20'},
  {id:'before-q21', from:879.62, to:909.94, part:3, questions:'21–26'},
  {id:'before-q27', from:1096.62, to:1122.02, part:3, questions:'27–30'},
  {id:'before-q31', from:1313.68, to:1379.02, part:4, questions:'31–40'},
];

// The long check-after-Part and transfer intervals have no next question label.
// They and the edges of the reading intervals intentionally have no verdict.
const audibleWindows = [
  [1.2,38.5], [44.95,56.6], [83,251.6], [277.95,384.35],
  [446.05,460.08], [491.5,639.12], [670.6,832.85], [864.58,879.07],
  [910.48,1096.08], [1122.55,1265.76], [1297.42,1313.1],
  [1379.6,1583.5], [1589.95,1769.5], [1831,1840.4],
];

export const term2ListeningReportMap = Object.freeze({
  version:1,
  sha256:'656921dc9888dcfe778eb0cfa6b61491fd906500edde28054d53d26194df219e',
  duration:1843.2,
  readingGaps:Object.freeze(readingGaps.map(Object.freeze)),
  audibleWindows:Object.freeze(audibleWindows.map(Object.freeze)),
});
