/**
 * The scene: Part A boxes, Part B robot arm, Part D curves (curveEditor.js)
 * and the camera-matching guides (bonus).
 *
 * main.js calls scene.update(dt), scene.draw(pass, viewProj) and scene.reset().
 */
import * as mat4 from '../math/mat4.js';
import { cube } from './geometry.js';
import { SceneNode } from './node.js';
import { createCurveEditor } from './curveEditor.js';
import { createMesh, MeshPipeline } from '../render/mesh.js';
import { LinePipeline } from '../render/lines.js';
import { Ribbon } from '../render/ribbon.js';

// horizon of Moda İskelesi (far shoreline), v = 0.612 → y = 1 - 2v
export const HORIZON_Y = 1 - 2 * 0.612;

// T·R·S helper
const TRS = (t, r, s) => mat4.multiply(mat4.translate(...t), mat4.multiply(r, mat4.scale(...s)));

export function createScene({ gpu, renderer, painting, panel, getPaintingId }) {
  const { device } = gpu;
  const meshPipe = new MeshPipeline(gpu, renderer);
  const lines = new LinePipeline(gpu, renderer);
  const ribbon = new Ribbon(gpu, renderer);
  const meshes = { cube: createMesh(device, cube()) };
  const state = { debugAxes: false, horizon: false, grid: false };

  /* ---------- Part A ---------- */
  const A = { tx: -1.0, ty: 0.45, tz: 0.6, axis: 'y', angle: 0.6, sx: 0.3, sy: 0.3, sz: 0.3, order: 'T·R·S' };
  const startA = { ...A };
  const fa = panel.folder('Part A · Transformations');
  const sliders = [
    fa.slider('tx', A, 'tx', -2, 2), fa.slider('ty', A, 'ty', -1.5, 1.5), fa.slider('tz', A, 'tz', -0.5, 2),
    fa.slider('angle', A, 'angle', -Math.PI, Math.PI),
    fa.slider('sx', A, 'sx', 0.05, 1), fa.slider('sy', A, 'sy', 0.05, 1), fa.slider('sz', A, 'sz', 0.05, 1),
  ];
  const axisSelect = fa.select('axis', ['x', 'y', 'z'], A.axis, (v) => (A.axis = v));
  const orderSelect = fa.select('order', ['T·R·S', 'S·R·T'], A.order, (v) => (A.order = v));
  const matText = fa.text('');

  function cubeMatrices() {
    const T = mat4.translate(A.tx, A.ty, A.tz);
    const R = A.axis === 'x' ? mat4.rotateX(A.angle) : A.axis === 'y' ? mat4.rotateY(A.angle) : mat4.rotateZ(A.angle);
    const S = mat4.scale(A.sx, A.sy, A.sz);
    return { TRS: mat4.multiply(T, mat4.multiply(R, S)), SRT: mat4.multiply(S, mat4.multiply(R, T)) };
  }

  // three fixed boxes in front of the painting
  const boxes = [
    { model: TRS([-1.3, -0.85, 0.5], mat4.identity(), [0.3, 0.3, 0.3]), color: [0.5, 0.25, 0.05] },
    { model: TRS([-0.6, -0.9, 0.9], mat4.rotateY(0.6), [0.2, 0.2, 0.2]), color: [0.6, 0.55, 0.1] },
    { model: TRS([-1.0, -0.75, 1.1], mat4.rotateZ(-0.3), [0.1, 0.5, 0.1]), color: [0.25, 0.25, 0.3] },
  ];

  /* ---------- Part B: robot arm ---------- */
  // node.data.shape is only used for drawing that node, children do not inherit it
  const node = (name, shape, color) => {
    const n = new SceneNode(name);
    n.data = { shape, color };
    return n;
  };
  const root = node('arm');
  const base = root.addChild(node('base', mat4.scale(0.4, 0.1, 0.4), [0.35, 0.18, 0.06]));
  const lower = base.addChild(node('lower', TRS([0, 0.25, 0], mat4.identity(), [0.1, 0.5, 0.1]), [0.7, 0.05, 0.03]));
  const upper = lower.addChild(node('upper', TRS([0, 0.2, 0], mat4.identity(), [0.08, 0.4, 0.08]), [0.05, 0.1, 0.7]));
  const hand = upper.addChild(node('hand', mat4.scale(0.14, 0.14, 0.14), [0.2, 0.7, 0.05]));
  root.local = mat4.translate(1.0, -0.95, 0.6);

  const B = { animate: true, time: 0 };
  const fb = panel.folder('Part B · Scene graph');
  const animToggle = fb.toggle('animate', B, 'animate');
  fb.toggle('debug axes', state, 'debugAxes');
  fb.note('arm → base → lower → upper → hand');
  const leafText = fb.text('');

  function poseArm() {
    const t = B.time;
    base.local = mat4.rotateY(0.5 * t);                                                 // turns
    lower.local = mat4.multiply(mat4.translate(0, 0.05, 0), mat4.rotateZ(0.3 * Math.sin(t)));       // leans
    upper.local = mat4.multiply(mat4.translate(0, 0.5, 0), mat4.rotateZ(0.6 * Math.sin(1.3 * t)));  // bends
    hand.local = mat4.translate(0, 0.47, 0);
    root.updateWorld();
  }

  /* ---------- Part D ---------- */
  const curves = createCurveEditor({ device, panel, painting, getPaintingId, meshes });

  /* ---------- bonus: camera matching ---------- */
  const fc = panel.folder('Bonus · Camera matching', { open: false });
  fc.toggle('painted horizon', state, 'horizon');
  fc.toggle('floor grid', state, 'grid');
  fc.note('Painter\'s eye: eye at the horizon height, looking straight ahead. The floor grid then vanishes on the painted horizon.');

  return {
    state, curves,

    update(dt) {
      if (B.animate) B.time += dt;
      poseArm();
      curves.update(dt);
      const { TRS: a, SRT: b } = cubeMatrices();
      matText.set(`T·R·S\n${mat4.format(a)}\n\nS·R·T\n${mat4.format(b)}\n\nusing ${A.order}`);
      leafText.set(`hand.world\n${mat4.format(hand.world, 3)}`);
    },

    toggleAnimation() { B.animate = !B.animate; animToggle.update(); },

    /** extraLines(lines): lets main.js add the frustum lines */
    draw(pass, viewProj, extraLines) {
      meshPipe.begin();
      lines.begin();

      // Part A
      const { TRS: a, SRT: b } = cubeMatrices();
      const cubeM = A.order === 'T·R·S' ? a : b;
      meshPipe.draw(pass, meshes.cube, viewProj, cubeM, [0.3, 0.8, 0.1]);
      for (const box of boxes) meshPipe.draw(pass, meshes.cube, viewProj, box.model, box.color);

      // Part B
      root.traverse((n) => {
        if (n.data.shape) meshPipe.draw(pass, meshes.cube, viewProj, mat4.multiply(n.world, n.data.shape), n.data.color);
        if (state.debugAxes) lines.axes(n.world, 0.2);
      });
      if (state.debugAxes) {
        lines.axes(cubeM, 1.5);
        lines.axes(mat4.identity(), 0.5);
      }

      // Part D
      curves.draw(pass, viewProj, meshPipe, lines);
      if (curves.state.ribbon) {
        ribbon.compute(curves.ribbonSegments(), 0.02);
        ribbon.draw(pass, viewProj);
      }

      // bonus guides: the floor is the plane y = -1 under the painting
      const asp = painting.aspect;
      if (state.horizon) lines.line([-asp, HORIZON_Y, 0.005], [asp, HORIZON_Y, 0.005], [1, 1, 0]);
      if (state.grid) {
        for (let x = -1.8; x <= 1.81; x += 0.2) lines.line([x, -1, 0], [x, -1, 1.6], [0.7, 0.7, 0.7]);
        for (let z = 0; z <= 1.61; z += 0.2) lines.line([-1.8, -1, z], [1.8, -1, z], [0.7, 0.7, 0.7]);
      }

      if (extraLines) extraLines(lines);
      lines.draw(pass, viewProj);
    },

    reset() {
      Object.assign(A, startA);
      sliders.forEach((sl) => sl.update());
      axisSelect.set(A.axis); orderSelect.set(A.order);
      B.time = 0; B.animate = true; animToggle.update();
      curves.reset();
    },
  };
}
