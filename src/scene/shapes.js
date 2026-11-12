/**
 * Extra mesh for the surface of revolution bonus. Same format as geometry.js:
 * [x y z nx ny nz], triangle-list.
 */

// profile [r, h] turned around the y axis
export function lathe(profile, slices = 40) {
  const out = [];
  const vert = (i, j) => {
    const ang = (j / slices) * 2 * Math.PI;
    const [r, h] = profile[i];
    // normal from the profile direction, turned 90 degrees
    const a = profile[Math.max(i - 1, 0)], b = profile[Math.min(i + 1, profile.length - 1)];
    const dr = b[0] - a[0], dh = b[1] - a[1], len = Math.hypot(dr, dh) || 1;
    return [r * Math.cos(ang), h, r * Math.sin(ang), (dh / len) * Math.cos(ang), -dr / len, (dh / len) * Math.sin(ang)];
  };
  for (let i = 0; i + 1 < profile.length; i++) {
    for (let j = 0; j < slices; j++) {
      out.push(...vert(i, j), ...vert(i + 1, j), ...vert(i + 1, j + 1));
      out.push(...vert(i, j), ...vert(i + 1, j + 1), ...vert(i, j + 1));
    }
  }
  return new Float32Array(out);
}
