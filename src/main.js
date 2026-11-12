/**
 * Entry point: wires GPU, painting, camera, scene and UI together and runs
 * the render loop.
 *
 *   p_clip = P · V · M · p_object
 */
import './ui/style.css';
import { initWebGPU, showFatal } from './render/gpu.js';
import { Renderer } from './render/renderer.js';
import { Painting } from './render/painting.js';
import { createCamera, viewProjection, stepCamera, orbit, zoom, flyTo, frustumRect, hitPainting } from './scene/camera.js';
import { createScene, HORIZON_Y } from './scene/scene.js';
import { createPanel } from './ui/panel.js';
import { Stats } from './ui/stats.js';
import { attachPointer } from './ui/input.js';
import { PAINTINGS, DEFAULT_PAINTING, paintingURL } from './config.js';
import * as mat4 from './math/mat4.js';
import * as quat from './math/quat.js';

async function main() {
  const canvas = document.getElementById('gfx');
  const gpu = await initWebGPU(canvas);
  const renderer = new Renderer(gpu);
  const painting = new Painting(gpu);

  const params = new URLSearchParams(location.search);
  let current = PAINTINGS.find((p) => p.id === params.get('painting'))
    ?? PAINTINGS.find((p) => p.id === DEFAULT_PAINTING);
  await painting.load(paintingURL(current));

  /* ---------------- UI ---------------- */
  const panelRoot = document.getElementById('panel');
  const panel = createPanel(panelRoot);
  const title = document.createElement('h1');
  title.textContent = 'CS405 · Project 1';
  panelRoot.appendChild(title);
  const stats = new Stats(panelRoot);

  const pf = panel.folder('Painting');
  pf.select('painting', PAINTINGS.map((p) => ({ value: p.id, label: `${p.artist} — ${p.title}` })), current.id,
    async (id) => {
      current = PAINTINGS.find((p) => p.id === id);
      await painting.load(paintingURL(current));
      history.replaceState(null, '', `?painting=${id}`);
    });

  const camera = createCamera();
  // fixed second camera that looks at the scene and the main camera from the side
  const inspect = createCamera();
  inspect.target = [-0.2, -0.35, 1.2];
  inspect.rot = quat.fromLook([3.9, 2.1, 5.6], inspect.target);
  inspect.dist = Math.hypot(4.1, 2.45, 4.4);
  stepCamera(inspect, 0);

  const view = { mode: 'main' };
  const cf = panel.folder('Camera');
  const viewSelect = cf.select('view', ['main', 'inspection'], view.mode, (v) => (view.mode = v));
  const projSelect = cf.select('projection', ['perspective', 'orthographic'], camera.projection, (v) => (camera.projection = v));
  const camOpts = { fov: 45 };
  const fovSlider = cf.slider('fovY °', camOpts, 'fov', 15, 100, 1, (v) => (camera.fovY = (v * Math.PI) / 180));
  const nearSlider = cf.slider('near', camera, 'near', 0.01, 2, 0.01);
  const farSlider = cf.slider('far', camera, 'far', 3, 300, 1);
  const camReadout = cf.text('');
  // bonus: smooth moves between viewpoints
  cf.button('front', () => flyTo(camera, [0.3, 0.35, 4.1], [0.3, -0.15, 0.3]));
  cf.button('side', () => flyTo(camera, [2.6, 0.2, 2.4], [0.4, -0.4, 0.5]));
  cf.button("painter's eye", () => {
    // eye at the painted horizon, looking straight at the painting
    const d = 2.6;
    flyTo(camera, [0, HORIZON_Y, d], [0, HORIZON_Y, 0], 2 * Math.atan((1 - HORIZON_Y) * 1.04 / d));
  });

  const scene = createScene({ gpu, renderer, painting, panel, getPaintingId: () => current.id });

  function reset() {
    Object.assign(camera, createCamera());
    camOpts.fov = 45; fovSlider.update(); nearSlider.update(); farSlider.update();
    projSelect.set(camera.projection);
    scene.reset();
  }

  const vf = panel.folder('View');
  vf.button('reset', reset);
  vf.note('Keys: 1 main view · 2 inspection view · P projection · A debug axes · Space pause arm · R reset');
  vf.note(gpu.encodeSRGB ? 'sRGB: encoded in shader (fallback)' : 'sRGB: canvas -srgb view');

  /* -------------- input --------------- */
  let mode = null;
  let lastVP = null;
  const ndcOf = (px) => [(px[0] / canvas.clientWidth) * 2 - 1, 1 - (px[1] / canvas.clientHeight) * 2];
  const aspect = () => canvas.width / canvas.height;

  attachPointer(canvas, {
    down(e) {
      if (view.mode !== 'main' || e.button !== 0) return;
      const ndc = ndcOf(e.px);
      const hit = hitPainting(camera, ndc, aspect());
      if (e.alt && hit) { scene.curves.startStroke(hit); mode = 'stroke'; return; }
      const picked = scene.curves.pick(ndc, lastVP, canvas.clientWidth, canvas.clientHeight);
      if (picked) { scene.curves.startDrag(picked); mode = 'point'; return; }
      if (e.shift && hit) { scene.curves.addSplinePoint(hit); return; }
      mode = 'orbit';
    },
    drag(e) {
      if (mode === 'orbit') { orbit(camera, -e.dx * 0.008, e.dy * 0.008); return; }
      const hit = hitPainting(camera, ndcOf(e.px), aspect());
      if (!hit) return;
      if (mode === 'point') scene.curves.dragTo(hit);
      if (mode === 'stroke') scene.curves.addStroke(hit);
    },
    up() {
      if (mode === 'point') scene.curves.endDrag();
      if (mode === 'stroke') scene.curves.endStroke();
      mode = null;
    },
    wheel(e) {
      if (view.mode === 'main') zoom(camera, Math.exp(e.delta * 0.001));
    },
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === '1') { view.mode = 'main'; viewSelect.set('main'); }
    if (k === '2') { view.mode = 'inspection'; viewSelect.set('inspection'); }
    if (k === 'p') { camera.projection = camera.projection === 'perspective' ? 'orthographic' : 'perspective'; projSelect.set(camera.projection); }
    if (k === 'a') scene.state.debugAxes = !scene.state.debugAxes;
    if (k === 'r') reset();
    if (k === ' ') { e.preventDefault(); scene.toggleAnimation(); }
  });

  // main camera's frustum, drawn when looking through the inspection camera
  function drawFrustum(lines, mainView) {
    const near = frustumRect(camera, mainView, aspect(), camera.near);
    const mid = frustumRect(camera, mainView, aspect(), camera.dist); // cut at the target, far is too big to show
    for (let i = 0; i < 4; i++) {
      lines.line(near[i], near[(i + 1) % 4], [1, 0.8, 0]);
      lines.line(mid[i], mid[(i + 1) % 4], [1, 0.8, 0]);
      lines.line(near[i], mid[i], [1, 0.8, 0]);
      lines.line(camera.eye, near[i], [1, 0.8, 0]);
    }
    lines.line(camera.eye, camera.target, [1, 1, 1]);
  }

  /* ------------ render loop ----------- */
  let last = performance.now();
  function frame(now) {
    stats.begin(now);
    // the first rAF timestamp can be a bit earlier than `last`, so keep dt >= 0
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;

    stepCamera(camera, dt);
    if (camera.anim) { camOpts.fov = (camera.fovY * 180) / Math.PI; fovSlider.update(); }
    scene.update(dt, now / 1000);

    const main = viewProjection(camera, aspect());
    lastVP = main.matrix;
    const vp = view.mode === 'main' ? main.matrix : viewProjection(inspect, aspect()).matrix;

    camReadout.set(
      `eye    ${camera.eye.map((x) => x.toFixed(2)).join(', ')}\n` +
      `target ${camera.target.map((x) => x.toFixed(2)).join(', ')}\n` +
      `fovY ${(camera.fovY * 180 / Math.PI).toFixed(1)}°  near ${camera.near}  far ${camera.far}`
    );

    renderer.render((pass) => {
      painting.draw(pass, mat4.multiply(vp, painting.model), renderer);
      scene.draw(pass, vp, view.mode === 'inspection' ? (lines) => drawFrustum(lines, main.view) : null);
    });

    stats.end(renderer.stats);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((e) => {
  console.error(e);
  showFatal(e.message ?? String(e));
});
