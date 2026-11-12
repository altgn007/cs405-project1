/**
 * Least-squares cubic Bézier through a drawn stroke (bonus).
 * P0 and P3 are the stroke ends; P1, P2 come from the 2x2 normal equations.
 */
import { bernstein3, cubicBezier, cubicBezierTangent } from './curves.js';

const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

function solve(pts, t) {
  const P0 = pts[0], P3 = pts[pts.length - 1];
  let a11 = 0, a12 = 0, a22 = 0;
  const r1 = [0, 0], r2 = [0, 0];
  for (let i = 0; i < pts.length; i++) {
    const [b0, b1, b2, b3] = bernstein3(t[i]);
    a11 += b1 * b1; a12 += b1 * b2; a22 += b2 * b2;
    for (let k = 0; k < 2; k++) {
      const r = pts[i][k] - b0 * P0[k] - b3 * P3[k]; // what P1, P2 must explain
      r1[k] += b1 * r; r2[k] += b2 * r;
    }
  }
  const det = a11 * a22 - a12 * a12;
  const P1 = [0, 1].map((k) => (a22 * r1[k] - a12 * r2[k]) / det);
  const P2 = [0, 1].map((k) => (a11 * r2[k] - a12 * r1[k]) / det);
  return [P0, P1, P2, P3];
}

export function fitBezier(pts) {
  // start with chord-length parameters
  const t = [0];
  for (let i = 1; i < pts.length; i++) t.push(t[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  for (let i = 0; i < t.length; i++) t[i] /= t[t.length - 1];

  let seg = solve(pts, t);
  // a few rounds: move each t towards the closest curve point, solve again
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < t.length; i++) {
      const d = sub(cubicBezier(...seg, t[i]), pts[i]);
      const tan = cubicBezierTangent(...seg, t[i]);
      const den = dot(tan, tan);
      if (den > 1e-12) t[i] = Math.min(1, Math.max(0, t[i] - dot(d, tan) / den));
    }
    seg = solve(pts, t);
  }

  let err = 0;
  for (let i = 0; i < pts.length; i++) err += dot(sub(cubicBezier(...seg, t[i]), pts[i]), sub(cubicBezier(...seg, t[i]), pts[i]));
  return { segment: seg, rms: Math.sqrt(err / pts.length) };
}
