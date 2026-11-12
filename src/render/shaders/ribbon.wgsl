// Draws the ribbon made by ribbonCompute.wgsl.

@group(0) @binding(0) var<uniform> viewProj: mat4x4f;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vs(@location(0) pos: vec4f, @location(1) color: vec4f) -> VSOut {
  var out: VSOut;
  out.pos = viewProj * pos;
  out.color = color;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return toOutput(in.color);
}
