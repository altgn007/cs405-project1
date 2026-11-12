/**
 * Curve export — Part D.
 *
 * Required JSON format (control points in NORMALISED painting coordinates:
 * u, v ∈ [0, 1], origin at the TOP-LEFT corner of the painting, v downwards,
 * the same as texture coordinates):
 *
 * {
 *   "painting": "kavunlu",
 *   "kind": "bezier-c1",                 // or "catmull-rom" / "bspline"
 *   "segments": [                          // for "bezier-c1": 4 points each
 *     [[0.12, 0.40], [0.18, 0.31], [0.27, 0.30], [0.33, 0.38]],
 *     ...
 *   ],
 *   "points": [[u, v], ...]                // for "catmull-rom" / "bspline"
 * }
 *
 * The painting quad spans x ∈ [−a, a], y ∈ [−1, 1] at z = 0 (a = image
 * width / height), so  u = (x + a) / (2a)  and  v = (1 − y) / 2.
 */

// curve points are stored as [u, v] already, so only rounding is needed
const round = (p) => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];

export function curveToJSON(curve) {
  const out = { painting: curve.painting, kind: curve.kind };
  if (curve.kind === 'bezier-c1') out.segments = curve.segments.map((seg) => seg.map(round));
  else out.points = curve.points.map(round);
  return out;
}

/** Provided: save any object as a .json download in the browser. */
export function downloadJSON(obj, filename = 'curve.json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
