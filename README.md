# CS405 Project 1

Painting: **Hoca Ali Rıza — Moda İskelesi**. I picked it because the far shoreline gives a
clear horizon, and the leaning plane tree and the hill are good shapes to trace with curves.

## Run

```bash
npm install
npm run dev     # http://localhost:5173
npm test
```

Needs Node.js 20.19+ and a browser with WebGPU (Chrome / Edge).

## Controls

- Left-drag: orbit the camera, wheel: zoom
- Drag a control point to move it (C1 is kept at the Bézier joints)
- Shift + click on the painting: add a spline point
- Alt + drag on the painting: draw a stroke, a Bézier is fitted to it (bonus)
- `1` main view, `2` inspection view, `P` perspective/orthographic, `A` debug axes,
  `Space` pause the arm, `R` reset

The panel has a folder for each part (sliders, matrices, curve options, export buttons).
Frame time and vertices per frame are at the top of the panel.

## Files

- `src/math/` — vec3, mat4 (Parts A, C), curves (Part D), quat and fit (bonus)
- `src/scene/scene.js` — Part A boxes, Part B robot arm, camera-matching guides
- `src/scene/curveEditor.js` — Part D and the curve bonuses
- `src/scene/camera.js` — orbit camera, viewpoints, frustum, mouse ray
- `src/render/` — mesh, line and ribbon pipelines (+ the starter files)
- `curves/` — exported curves (JSON)

## Parts

- **A**: a green cube controlled from the panel (translation, axis + angle, scale), T·R·S / S·R·T
  switch with both matrices shown; three more boxes placed with T·R·S.
- **B**: robot arm arm → base → lower → upper → hand (5 nodes, 5 levels). The base turns,
  the lower and upper arm bend. `hand.world` is shown in the panel.
- **C**: lookAt / perspective / orthographic, orbit camera, inspection camera that shows the
  main camera's frustum.
- **D**: 4-segment C1 Bézier along the tree, de Casteljau steps with a t slider, Catmull–Rom
  and B-spline along the hill, a small object moving on the curve facing the tangent, JSON export.

## Bonus

1. Least-squares Bézier fit of a drawn stroke (`math/fit.js`)
2. Surface of revolution from the Bézier (`scene/shapes.js`)
3. Camera matched to the painting: "painter's eye" button, horizon line and floor grid
4. Quaternion orbit camera with smooth moves between viewpoints (`math/quat.js`)
5. Bézier evaluated in a compute shader and drawn as a ribbon (`render/ribbon.js`)
