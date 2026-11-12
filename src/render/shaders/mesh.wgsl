// Simple lit mesh: Lambert + ambient.

struct Uniforms {
  mvp: mat4x4f,
  model: mat4x4f,
  color: vec4f,     // linear rgb
  params: vec4f,    // x = 1 → no lighting
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) normal: vec3f,
};

@vertex
fn vs(@location(0) pos: vec3f, @location(1) normal: vec3f) -> VSOut {
  var out: VSOut;
  out.pos = u.mvp * vec4f(pos, 1.0);
  out.normal = (u.model * vec4f(normal, 0.0)).xyz;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  if (u.params.x > 0.5) {
    return toOutput(u.color);
  }
  let n = normalize(in.normal);
  let lightDir = normalize(vec3f(0.6, 0.7, 0.5));
  let diffuse = abs(dot(n, lightDir));  // abs: lit from both sides
  let c = u.color.rgb * (0.25 + 0.75 * diffuse);
  return toOutput(vec4f(c, 1.0));
}
