/**
 * quat — quaternions [x, y, z, w] for the orbit camera (bonus).
 */
import * as v3 from './vec3.js';

export function fromAxisAngle(axis, rad) {
  const a = v3.normalize(axis), s = Math.sin(rad / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(rad / 2)];
}

// a·b: rotate by b first, then a
export function multiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function normalize(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return q.map((x) => x / l);
}

// v' = v + w·t + q.xyz × t, with t = 2 q.xyz × v
export function rotate(q, v) {
  const u = [q[0], q[1], q[2]];
  const t = v3.scale(v3.cross(u, v), 2);
  return v3.add(v3.add(v, v3.scale(t, q[3])), v3.cross(u, t));
}

export function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map((x) => -x); d = -d; } // shorter way round
  if (d > 0.9995) return normalize(a.map((x, i) => x + (b[i] - x) * t));
  const om = Math.acos(d);
  const wa = Math.sin((1 - t) * om) / Math.sin(om), wb = Math.sin(t * om) / Math.sin(om);
  return a.map((x, i) => wa * x + wb * b[i]);
}

// orientation of a camera at eye looking at target (world up)
export function fromLook(eye, target) {
  const z = v3.normalize(v3.sub(eye, target));
  const x = v3.normalize(v3.cross([0, 1, 0], z));
  const y = v3.cross(z, x);
  // rotation matrix with columns x, y, z → quaternion
  const tr = x[0] + y[1] + z[2];
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, s / 4];
  } else if (x[0] > y[1] && x[0] > z[2]) {
    const s = Math.sqrt(1 + x[0] - y[1] - z[2]) * 2;
    q = [s / 4, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s];
  } else if (y[1] > z[2]) {
    const s = Math.sqrt(1 + y[1] - x[0] - z[2]) * 2;
    q = [(y[0] + x[1]) / s, s / 4, (z[1] + y[2]) / s, (z[0] - x[2]) / s];
  } else {
    const s = Math.sqrt(1 + z[2] - x[0] - y[1]) * 2;
    q = [(z[0] + x[2]) / s, (z[1] + y[2]) / s, s / 4, (x[1] - y[0]) / s];
  }
  return normalize(q);
}
