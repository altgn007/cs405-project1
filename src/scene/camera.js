/**
 * Camera — Part C. Orbit camera stored as target + distance + orientation
 * quaternion (bonus). eye is computed from those every frame.
 */
import * as mat4 from '../math/mat4.js';
import * as v3 from '../math/vec3.js';
import * as quat from '../math/quat.js';

const START_EYE = [0.3, 0.35, 4.1];
const START_TARGET = [0.3, -0.15, 0.3];

export function createCamera() {
  const cam = {
    target: [...START_TARGET],
    dist: v3.length(v3.sub(START_EYE, START_TARGET)),
    rot: quat.fromLook(START_EYE, START_TARGET),
    eye: [...START_EYE],
    up: [0, 1, 0],
    fovY: Math.PI / 4, // radians
    near: 0.1,
    far: 100,
    projection: 'perspective', // or 'orthographic'
    orthoHeight: 2.2,
    anim: null,
  };
  updateCamera(cam);
  return cam;
}

export function updateCamera(cam) {
  // camera looks down its own -z, so the eye is at +z from the target
  cam.eye = v3.add(cam.target, v3.scale(quat.rotate(cam.rot, [0, 0, 1]), cam.dist));
  // same visible height in orthographic as perspective has at the target
  cam.orthoHeight = 2 * cam.dist * Math.tan(cam.fovY / 2);
}

// mouse drag: yaw around world y, pitch around the camera's x
export function orbit(cam, yaw, pitch) {
  const back = quat.rotate(cam.rot, [0, 0, 1]);
  const current = Math.asin(back[1]);
  const limit = 1.5; // about 86 degrees, stay away from the poles
  pitch = Math.max(-limit - current, Math.min(limit - current, pitch));
  cam.rot = quat.multiply(quat.fromAxisAngle([0, 1, 0], yaw), cam.rot);
  cam.rot = quat.normalize(quat.multiply(cam.rot, quat.fromAxisAngle([1, 0, 0], -pitch)));
  cam.anim = null;
}

export function zoom(cam, factor) {
  cam.dist = Math.min(30, Math.max(0.5, cam.dist * factor));
}

// bonus: smooth move to another viewpoint (slerp the rotation)
export function flyTo(cam, eye, target, fovY = Math.PI / 4) {
  cam.anim = {
    t: 0,
    from: { rot: cam.rot, target: cam.target, dist: cam.dist, fovY: cam.fovY },
    to: { rot: quat.fromLook(eye, target), target, dist: v3.length(v3.sub(eye, target)), fovY },
  };
}

export function stepCamera(cam, dt) {
  const a = cam.anim;
  if (a) {
    a.t = Math.min(1, a.t + dt);
    const s = a.t * a.t * (3 - 2 * a.t); // ease in/out
    cam.rot = quat.slerp(a.from.rot, a.to.rot, s);
    cam.target = a.from.target.map((x, i) => x + (a.to.target[i] - x) * s);
    cam.dist = a.from.dist + (a.to.dist - a.from.dist) * s;
    cam.fovY = a.from.fovY + (a.to.fovY - a.from.fovY) * s;
    if (a.t === 1) cam.anim = null;
  }
  updateCamera(cam);
}

export function viewProjection(cam, aspect) {
  const view = mat4.lookAt(cam.eye, cam.target, cam.up);
  let proj;
  if (cam.projection === 'orthographic') {
    const h = cam.orthoHeight / 2, w = h * aspect;
    proj = mat4.orthographic(-w, w, -h, h, cam.near, cam.far);
  } else {
    proj = mat4.perspective(cam.fovY, aspect, cam.near, cam.far);
  }
  return { matrix: mat4.multiply(proj, view), view };
}

// frustum corners at depth d, in world space (camera-to-world = inverse of view)
export function frustumRect(cam, view, aspect, d) {
  const toWorld = mat4.invertRigid(view);
  const h = cam.projection === 'orthographic' ? cam.orthoHeight / 2 : d * Math.tan(cam.fovY / 2);
  const w = h * aspect;
  return [[-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d]].map((p) => mat4.transformPoint(toWorld, p));
}

// ray from the camera through a pixel (ndc x, y), hit with the painting plane z = 0
export function hitPainting(cam, ndc, aspect) {
  const f = v3.normalize(v3.sub(cam.target, cam.eye));
  const r = v3.normalize(v3.cross(f, cam.up));
  const u = v3.cross(r, f);
  let origin = cam.eye, dir;
  if (cam.projection === 'orthographic') {
    const h = cam.orthoHeight / 2;
    origin = v3.add(origin, v3.add(v3.scale(r, ndc[0] * h * aspect), v3.scale(u, ndc[1] * h)));
    dir = f;
  } else {
    const h = Math.tan(cam.fovY / 2);
    dir = v3.add(f, v3.add(v3.scale(r, ndc[0] * h * aspect), v3.scale(u, ndc[1] * h)));
  }
  if (Math.abs(dir[2]) < 1e-6) return null;
  const t = -origin[2] / dir[2];
  if (t < 0) return null;
  return v3.add(origin, v3.scale(dir, t));
}
