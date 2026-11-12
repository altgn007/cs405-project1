/**
 * Part D — curves drawn over the painting, plus the curve bonuses
 * (least-squares fit, surface of revolution, GPU ribbon).
 *
 * Points are kept as [u, v] on the painting (0..1, top-left origin) and
 * turned into world positions on the painting plane when drawn:
 *   x = (2u - 1)·a,  y = 1 - 2v   (a = painting aspect)
 */
import * as C from '../math/curves.js';
import * as mat4 from '../math/mat4.js';
import * as v3 from '../math/vec3.js';
import { fitBezier } from '../math/fit.js';
import { lathe } from './shapes.js';
import { createMesh } from '../render/mesh.js';
import { curveToJSON, downloadJSON } from './curveExport.js';

// traced on Moda İskelesi: the leaning plane tree, from the root up the trunk and along the branch
const BEZIER_START = [
  [0.372, 0.865], [0.385, 0.798], [0.395, 0.73], [0.41, 0.665],
  [0.425, 0.6], [0.436, 0.533], [0.465, 0.475],
  [0.494, 0.417], [0.546, 0.369], [0.585, 0.315],
  [0.624, 0.261], [0.662, 0.205], [0.7, 0.15],
];
// the hill on the far shore
const SPLINE_START = [
  [0.739, 0.556], [0.77, 0.537], [0.8, 0.527], [0.84, 0.52],
  [0.885, 0.521], [0.922, 0.528], [0.955, 0.523], [0.995, 0.529],
];

export function createCurveEditor({ device, panel, painting, getPaintingId, meshes }) {
  const s = {
    bez: BEZIER_START.map((p) => [...p]),
    spl: SPLINE_START.map((p) => [...p]),
    kind: 'catmull-rom',
    showSteps: true, seg: 0, t: 0.4, animateT: false,
    bird: true, birdU: 0,
    ribbon: false, lathe: false,
  };
  let dragging = null;  // { list, i }
  let stroke = null;    // points of the stroke being drawn
  let fit = null;       // fitted segment (world)
  let latheMesh = null, latheDirty = true;

  const world = (uv) => [(2 * uv[0] - 1) * painting.aspect, 1 - 2 * uv[1], 0.005];
  const toUV = (p) => [(p[0] / painting.aspect + 1) / 2, (1 - p[1]) / 2];

  function segments() {
    const out = [];
    for (let i = 0; i + 3 < s.bez.length; i += 3) out.push(s.bez.slice(i, i + 4).map(world));
    return out;
  }

  function splinePoints(n = 16) {
    const P = s.spl.map(world);
    const out = [];
    if (s.kind === 'catmull-rom') {
      // repeat the end points so the curve reaches them
      const Q = [P[0], ...P, P[P.length - 1]];
      for (let i = 0; i + 3 < Q.length; i++) {
        for (let k = 0; k <= n; k++) out.push(C.catmullRom(Q[i], Q[i + 1], Q[i + 2], Q[i + 3], k / n));
      }
    } else {
      // triple the end points so the B-spline starts and ends on them
      const Q = [P[0], P[0], ...P, P[P.length - 1], P[P.length - 1]];
      for (let i = 0; i + 3 < Q.length; i++) {
        for (let k = 0; k <= n; k++) out.push(C.bspline(Q[i], Q[i + 1], Q[i + 2], Q[i + 3], k / n));
      }
    }
    return out;
  }

  // move a Bézier point and keep C1 at the joints
  function moveBez(i, uv) {
    const P = s.bez;
    if (i % 3 === 0) {
      // joint: move both handles with it
      const d = [uv[0] - P[i][0], uv[1] - P[i][1]];
      if (i > 0) P[i - 1] = [P[i - 1][0] + d[0], P[i - 1][1] + d[1]];
      if (i < P.length - 1) P[i + 1] = [P[i + 1][0] + d[0], P[i + 1][1] + d[1]];
      P[i] = uv;
    } else if (i % 3 === 2) {
      P[i] = uv;
      if (i + 2 < P.length) P[i + 2] = C.c1NextControl(P[i], P[i + 1]);
    } else {
      P[i] = uv;
      if (i - 2 >= 0) P[i - 2] = C.c1NextControl(P[i], P[i - 1]);
    }
    latheDirty = true;
  }

  /* ---------- panel ---------- */
  const f = panel.folder('Part D · Curves');
  f.toggle('de Casteljau steps', s, 'showSteps');
  const segSlider = f.slider('segment', s, 'seg', 0, 3, 1);
  const tSlider = f.slider('t', s, 't', 0, 1, 0.01);
  f.toggle('animate t', s, 'animateT');
  f.select('spline', ['catmull-rom', 'bspline'], s.kind, (v) => (s.kind = v));
  f.toggle('bird on the curve', s, 'bird');
  f.button('export Bézier', () => downloadJSON(curveToJSON({ painting: getPaintingId(), kind: 'bezier-c1', segments: chunks(s.bez) }), 'bezier.json'));
  f.button('export spline', () => downloadJSON(curveToJSON({ painting: getPaintingId(), kind: s.kind, points: s.spl }), `${s.kind}.json`));
  f.note('Drag points to move them. Shift+click adds a spline point.');

  const b = panel.folder('Bonus · Curves', { open: false });
  b.toggle('GPU ribbon (compute)', s, 'ribbon');
  b.toggle('surface of revolution', s, 'lathe');
  b.note('Alt + drag on the painting: draw a stroke, a cubic Bézier is fitted to it.');
  const fitText = b.text('no stroke yet');

  function chunks(P) {
    const out = [];
    for (let i = 0; i + 3 < P.length; i += 3) out.push(P.slice(i, i + 4));
    return out;
  }

  /* ---------- mouse ---------- */
  return {
    state: s,

    // nearest control point to the mouse (within 12 px)
    pick(ndc, viewProj, width, height) {
      let best = null, bestD = 12;
      const test = (list, P) => P.forEach((uv, i) => {
        const c = mat4.transformVec4(viewProj, [...world(uv), 1]);
        const dx = (c[0] / c[3] - ndc[0]) * width / 2, dy = (c[1] / c[3] - ndc[1]) * height / 2;
        const d = Math.hypot(dx, dy);
        if (d < bestD) { bestD = d; best = { list, i }; }
      });
      test('bez', s.bez);
      test('spl', s.spl);
      return best;
    },
    startDrag(p) { dragging = p; },
    dragTo(hit) {
      if (!dragging) return;
      const uv = toUV(hit);
      if (dragging.list === 'bez') moveBez(dragging.i, uv); else s.spl[dragging.i] = uv;
    },
    endDrag() { dragging = null; },
    addSplinePoint(hit) { s.spl.push(toUV(hit)); },

    startStroke(hit) { stroke = [hit]; },
    addStroke(hit) { if (stroke) stroke.push(hit); },
    endStroke() {
      if (stroke && stroke.length > 4) {
        const r = fitBezier(stroke.map((p) => [p[0], p[1]]));
        fit = r.segment.map((p) => [p[0], p[1], 0.005]);
        const px = r.rms * painting.size[1] / 2; // world units → image pixels
        fitText.set(`${stroke.length} samples, rms error ${px.toFixed(2)} px`);
      }
      stroke = null;
    },

    reset() {
      s.bez = BEZIER_START.map((p) => [...p]);
      s.spl = SPLINE_START.map((p) => [...p]);
      s.t = 0.4; s.seg = 0; fit = null; latheDirty = true;
      segSlider.update(); tSlider.update();
    },

    update(dt) {
      if (s.animateT) { s.t = (s.t + dt * 0.3) % 1; tSlider.update(); }
      if (s.bird) s.birdU = (s.birdU + dt * 0.08) % 1;
    },

    // world segments for the GPU ribbon
    ribbonSegments() { return segments(); },

    draw(pass, viewProj, meshPipe, lines) {
      const segs = segments();
      const point = (p, color) => meshPipe.draw(pass, meshes.cube, viewProj,
        mat4.multiply(mat4.translate(p[0], p[1], p[2]), mat4.scale(0.03, 0.03, 0.03)), color, true);

      // Bézier curve, control polygon and points
      for (const g of segs) {
        const pts = [];
        for (let k = 0; k <= 30; k++) pts.push(C.cubicBezier(...g, k / 30));
        lines.strip(pts, [1, 0.45, 0.1]);
      }
      lines.strip(s.bez.map(world), [0.6, 0.6, 0.6]);
      s.bez.forEach((uv, i) => {
        const sel = dragging && dragging.list === 'bez' && dragging.i === i;
        point(world(uv), sel ? [1, 0, 0] : i % 3 === 0 ? [1, 0.8, 0.2] : [0.2, 0.6, 1]);
      });

      // spline and its points
      lines.strip(splinePoints(), [0.3, 1, 0.4]);
      s.spl.forEach((uv, i) => {
        const sel = dragging && dragging.list === 'spl' && dragging.i === i;
        point(world(uv), sel ? [1, 0, 0] : [0.3, 1, 0.4]);
      });

      // de Casteljau steps on one segment
      if (s.showSteps && segs[s.seg]) {
        const levels = C.deCasteljau(segs[s.seg], s.t);
        const colors = [null, [0, 0.9, 0.9], [0.8, 0.3, 1], [1, 0, 0]];
        for (let k = 1; k < levels.length; k++) {
          lines.strip(levels[k], colors[k]);
          for (const p of levels[k]) point(p, colors[k]);
        }
      }

      // bird along the curve, nose along the tangent
      if (s.bird) {
        const n = segs.length;
        const u = Math.min(Math.max(s.birdU, 0), 1);
        const i = Math.min(Math.floor(u * n), n - 1), t = u * n - i;
        const p = C.cubicBezier(...segs[i], t);
        const x = v3.normalize(C.cubicBezierTangent(...segs[i], t));
        const z = [0, 0, 1], y = v3.cross(z, x);
        const frame = new Float32Array([...x, 0, ...y, 0, ...z, 0, p[0], p[1], 0.05, 1]);
        meshPipe.draw(pass, meshes.cube, viewProj, mat4.multiply(frame, mat4.scale(0.12, 0.03, 0.03)), [0.95, 0.95, 0.9]);
        meshPipe.draw(pass, meshes.cube, viewProj, mat4.multiply(frame, mat4.scale(0.03, 0.13, 0.01)), [0.8, 0.2, 0.1]);
      }

      // bonus: fitted curve
      if (stroke) lines.strip(stroke, [1, 1, 1]);
      if (fit) {
        const pts = [];
        for (let k = 0; k <= 40; k++) pts.push(C.cubicBezier(...fit, k / 40));
        lines.strip(pts, [1, 0.3, 0.9]);
        lines.strip(fit, [0.6, 0.2, 0.5]);
      }

      // bonus: surface of revolution of the Bézier, axis through its first point
      if (s.lathe) {
        if (latheDirty) {
          const pts = [];
          for (const g of segs) for (let k = 0; k < 16; k++) pts.push(C.cubicBezier(...g, k / 16));
          const x0 = pts[0][0], y0 = pts[0][1];
          latheMesh?.buffer.destroy();
          latheMesh = createMesh(device, lathe(pts.map((p) => [Math.abs(p[0] - x0), p[1] - y0])));
          latheDirty = false;
        }
        const model = mat4.multiply(mat4.translate(0.35, -1, 1.1), mat4.scale(0.28, 0.28, 0.28));
        meshPipe.draw(pass, latheMesh, viewProj, model, [0.8, 0.7, 0.55]);
      }
    },
  };
}
