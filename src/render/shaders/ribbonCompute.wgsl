// Bonus: evaluate the Bézier segments on the GPU and write a ribbon
// (triangle strip) straight into a vertex buffer. One thread per sample.

struct Params {
  segCount: u32,
  samplesPerSeg: u32,
  width: f32,
  pad: f32,
};
struct Vertex {
  pos: vec4f,
  color: vec4f,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> ctrl: array<vec4f>;      // 4 per segment
@group(0) @binding(2) var<storage, read_write> verts: array<Vertex>; // 2 per sample

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let total = params.segCount * params.samplesPerSeg + 1u;
  let i = id.x;
  if (i >= total) { return; }

  var seg = i / params.samplesPerSeg;
  var t = f32(i % params.samplesPerSeg) / f32(params.samplesPerSeg);
  if (seg == params.segCount) { seg = seg - 1u; t = 1.0; } // last sample

  let p0 = ctrl[seg * 4u].xyz;
  let p1 = ctrl[seg * 4u + 1u].xyz;
  let p2 = ctrl[seg * 4u + 2u].xyz;
  let p3 = ctrl[seg * 4u + 3u].xyz;
  let s = 1.0 - t;

  let pos = s * s * s * p0 + 3.0 * t * s * s * p1 + 3.0 * t * t * s * p2 + t * t * t * p3;
  let tan = 3.0 * s * s * (p1 - p0) + 6.0 * t * s * (p2 - p1) + 3.0 * t * t * (p3 - p2);
  let side = normalize(vec3f(-tan.y, tan.x, 0.0)) * params.width; // perpendicular, in the painting plane

  let k = f32(i) / f32(total - 1u);
  let color = mix(vec4f(1.0, 0.35, 0.05, 1.0), vec4f(0.1, 0.4, 1.0, 1.0), k);
  verts[2u * i] = Vertex(vec4f(pos + side, 1.0), color);
  verts[2u * i + 1u] = Vertex(vec4f(pos - side, 1.0), color);
}
