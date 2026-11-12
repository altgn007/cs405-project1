/**
 * mat4 — 4x4 matrices for Parts A and C.
 * Float32Array(16), column-major: element (row r, col c) is at c*4 + r.
 * Column vectors, so multiply(A, B) = A·B and B is applied first.
 * Clip space is WebGPU's: depth z in [0, 1].
 */
import * as v3 from './vec3.js';

/* ---------------- Part A ---------------- */

export function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

// out(r, c) = sum over k of a(r, k) * b(k, c)
export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

export function translate(tx, ty, tz) {
  const m = identity();
  m[12] = tx; m[13] = ty; m[14] = tz;
  return m;
}

export function rotateX(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

export function rotateY(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

export function rotateZ(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function scale(sx, sy, sz) {
  return new Float32Array([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]);
}

export function transpose(m) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) out[r * 4 + c] = m[c * 4 + r];
  }
  return out;
}

// M = T·R  →  M^-1 = R^T · T(-t), so the new translation is -R^T·t
export function invertRigid(m) {
  const out = new Float32Array(16);
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) out[c * 4 + r] = m[r * 4 + c];
  }
  for (let r = 0; r < 3; r++) {
    out[12 + r] = -(out[r] * m[12] + out[4 + r] * m[13] + out[8 + r] * m[14]);
  }
  out[15] = 1;
  return out;
}

export function transformVec4(m, v) {
  const out = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) {
    out[r] = m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3];
  }
  return out;
}

// point (w = 1), divided by w
export function transformPoint(m, p) {
  const v = transformVec4(m, [p[0], p[1], p[2], 1]);
  return [v[0] / v[3], v[1] / v[3], v[2] / v[3]];
}

/* ---------------- Part C ---------------- */

export function lookAt(eye, target, up) {
  const f = v3.normalize(v3.sub(target, eye)); // forward
  let r = v3.cross(f, up);
  // up parallel to the view direction: use another axis instead
  if (v3.length(r) < 1e-6) {
    r = Math.abs(f[1]) < 0.9 ? v3.cross(f, [0, 1, 0]) : v3.cross(f, [1, 0, 0]);
  }
  r = v3.normalize(r);
  const u = v3.cross(r, f);
  // rows are r, u, -f (camera looks down -z)
  return new Float32Array([
    r[0], u[0], -f[0], 0,
    r[1], u[1], -f[1], 0,
    r[2], u[2], -f[2], 0,
    -v3.dot(r, eye), -v3.dot(u, eye), v3.dot(f, eye), 1,
  ]);
}

// depth: z = -near -> 0, z = -far -> 1
export function perspective(fovY, aspect, near, far) {
  const g = 1 / Math.tan(fovY / 2);
  return new Float32Array([
    g / aspect, 0, 0, 0,
    0, g, 0, 0,
    0, 0, far / (near - far), -1,
    0, 0, (near * far) / (near - far), 0,
  ]);
}

export function orthographic(left, right, bottom, top, near, far) {
  return new Float32Array([
    2 / (right - left), 0, 0, 0,
    0, 2 / (top - bottom), 0, 0,
    0, 0, 1 / (near - far), 0,
    -(right + left) / (right - left), -(top + bottom) / (top - bottom), near / (near - far), 1,
  ]);
}

/* ---------------- provided ---------------- */

/** Pretty-print a column-major matrix as four rows. */
export function format(m, digits = 2) {
  if (!m) return '(none)';
  const w = digits + 4;
  let s = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) s += (+m[c * 4 + r]).toFixed(digits).padStart(w);
    if (r < 3) s += '\n';
  }
  return s;
}
