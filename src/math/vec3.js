/**
 * vec3 — 3-component vectors as plain arrays [x, y, z].
 * Every function returns a new array and does not change its inputs.
 */

export function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

export function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

export function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

// right-handed cross product
export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function length(a) { return Math.sqrt(dot(a, a)); }

// zero vector stays zero instead of NaN
export function normalize(a) {
  const l = length(a);
  if (l < 1e-12) return [0, 0, 0];
  return [a[0] / l, a[1] / l, a[2] / l];
}
