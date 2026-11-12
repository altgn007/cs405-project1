/**
 * Line pipeline: everything pushed with add() during a frame is drawn in one
 * line-list draw. Vertex format [x, y, z, r, g, b], same as geometry.axes().
 */
import linesWGSL from './shaders/lines.wgsl?raw';
import { createShader, fragmentConstants } from './shader.js';
import { DEPTH_FORMAT } from './renderer.js';

export class LinePipeline {
  constructor(gpu, renderer) {
    this.device = gpu.device;
    this.renderer = renderer;
    const module = createShader(this.device, linesWGSL, 'lines');
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module, entryPoint: 'vs',
        buffers: [{
          arrayStride: 24,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x3' },
          ],
        }],
      },
      fragment: { module, entryPoint: 'fs', constants: fragmentConstants(gpu), targets: [{ format: gpu.viewFormat }] },
      primitive: { topology: 'line-list' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'less-equal' },
    });
    this.uniform = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniform } }],
    });
    this.vertices = [];
    this.buffer = null;
    this.capacity = 0;
  }

  begin() { this.vertices.length = 0; }

  line(a, b, color) {
    this.vertices.push(a[0], a[1], a[2], ...color, b[0], b[1], b[2], ...color);
  }

  // polyline through pts
  strip(pts, color) {
    for (let i = 0; i + 1 < pts.length; i++) this.line(pts[i], pts[i + 1], color);
  }

  // x, y, z axes of a matrix (red, green, blue)
  axes(m, len) {
    const o = [m[12], m[13], m[14]];
    const end = (c) => [o[0] + m[c * 4] * len, o[1] + m[c * 4 + 1] * len, o[2] + m[c * 4 + 2] * len];
    this.line(o, end(0), [1, 0, 0]);
    this.line(o, end(1), [0, 1, 0]);
    this.line(o, end(2), [0, 0, 1]);
  }

  draw(pass, viewProj) {
    const count = this.vertices.length / 6;
    if (count === 0) return;
    const data = new Float32Array(this.vertices);
    if (data.byteLength > this.capacity) {
      this.buffer?.destroy();
      this.capacity = data.byteLength * 2;
      this.buffer = this.device.createBuffer({ size: this.capacity, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    }
    this.device.queue.writeBuffer(this.buffer, 0, data);
    this.device.queue.writeBuffer(this.uniform, 0, viewProj);
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.buffer);
    pass.draw(count);
    this.renderer.countDraw(count);
  }
}
