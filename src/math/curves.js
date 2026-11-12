/**
 * curves — Part D. Points are arrays of any length ([x, y] or [x, y, z]).
 * A piecewise Bézier is an array of segments [P0, P1, P2, P3].
 */

// sum of w[i] * pts[i]
function combine(pts, w) {
  const out = new Array(pts[0].length).fill(0);
  for (let i = 0; i < pts.length; i++) {
    for (let k = 0; k < out.length; k++) out[k] += w[i] * pts[i][k];
  }
  return out;
}

// (1-t)^3, 3t(1-t)^2, 3t^2(1-t), t^3
export function bernstein3(t) {
  const u = 1 - t;
  return [u * u * u, 3 * t * u * u, 3 * t * t * u, t * t * t];
}

export function cubicBezier(p0, p1, p2, p3, t) {
  return combine([p0, p1, p2, p3], bernstein3(t));
}

// B'(t) = 3(1-t)^2 (P1-P0) + 6t(1-t) (P2-P1) + 3t^2 (P3-P2)
export function cubicBezierTangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return combine([p0, p1, p2, p3], [-3 * u * u, 3 * u * u - 6 * t * u, 6 * t * u - 3 * t * t, 3 * t * t]);
}

// lerp neighbours at t until one point is left; returns every level
export function deCasteljau(points, t) {
  const levels = [points.map((p) => [...p])];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < prev.length - 1; i++) {
      next.push(prev[i].map((x, k) => x + (prev[i + 1][k] - x) * t));
    }
    levels.push(next);
  }
  return levels;
}

// C1: tangents equal at the joint → Q1 = 2·P3 − P2
export function c1NextControl(p2, p3) {
  return p3.map((x, k) => 2 * x - p2[k]);
}

// segment i covers u in [i/n, (i+1)/n]
export function evalPiecewise(segments, u) {
  const n = segments.length;
  const s = Math.min(Math.max(u, 0), 1) * n;
  const i = Math.min(Math.floor(s), n - 1);
  return cubicBezier(...segments[i], s - i);
}

// Catmull-Rom between p1 and p2, tangents (p2-p0)/2 and (p3-p1)/2
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return combine([p0, p1, p2, p3], [
    0.5 * (-t + 2 * t2 - t3),
    0.5 * (2 - 5 * t2 + 3 * t3),
    0.5 * (t + 4 * t2 - 3 * t3),
    0.5 * (-t2 + t3),
  ]);
}

// uniform cubic B-spline basis
export function bsplineBasis(t) {
  const u = 1 - t, t2 = t * t, t3 = t2 * t;
  return [u * u * u / 6, (3 * t3 - 6 * t2 + 4) / 6, (-3 * t3 + 3 * t2 + 3 * t + 1) / 6, t3 / 6];
}

export function bspline(p0, p1, p2, p3, t) {
  return combine([p0, p1, p2, p3], bsplineBasis(t));
}
