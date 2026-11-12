/**
 * Bonus: Bézier evaluated in a compute shader, drawn as a ribbon.
 * The compute pass is submitted on its own before the frame's render pass.
 */
import computeWGSL from './shaders/ribbonCompute.wgsl?raw';
import ribbonWGSL from './shaders/ribbon.wgsl?raw';
import { createShader, fragmentConstants } from './shader.js';
import { DEPTH_FORMAT } from './renderer.js';

const MAX_SEGS = 16;
const SAMPLES = 40;

export class Ribbon {
  constructor(gpu, renderer) {
    const device = this.device = gpu.device;
    this.renderer = renderer;
    this.params = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.ctrl = device.createBuffer({ size: MAX_SEGS * 4 * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.verts = device.createBuffer({ size: 2 * (MAX_SEGS * SAMPLES + 1) * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX });

    this.computePipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: computeWGSL }), entryPoint: 'main' },
    });
    this.computeGroup = device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.params } },
        { binding: 1, resource: { buffer: this.ctrl } },
        { binding: 2, resource: { buffer: this.verts } },
      ],
    });

    const module = createShader(device, ribbonWGSL, 'ribbon');
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module, entryPoint: 'vs',
        buffers: [{
          arrayStride: 32,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x4' },
            { shaderLocation: 1, offset: 16, format: 'float32x4' },
          ],
        }],
      },
      fragment: { module, entryPoint: 'fs', constants: fragmentConstants(gpu), targets: [{ format: gpu.viewFormat }] },
      primitive: { topology: 'triangle-strip', cullMode: 'none' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });
    this.uniform = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.renderGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniform } }],
    });
    this.count = 0;
  }

  // segments: world-space [[p0, p1, p2, p3], ...]
  compute(segments, width) {
    const n = Math.min(segments.length, MAX_SEGS);
    const ctrl = new Float32Array(n * 16);
    for (let s = 0; s < n; s++) {
      for (let k = 0; k < 4; k++) ctrl.set([...segments[s][k], 1], (s * 4 + k) * 4);
    }
    this.device.queue.writeBuffer(this.ctrl, 0, ctrl);
    const params = new ArrayBuffer(16);
    new Uint32Array(params, 0, 2).set([n, SAMPLES]);
    new Float32Array(params, 8, 1).set([width]);
    this.device.queue.writeBuffer(this.params, 0, params);

    const samples = n * SAMPLES + 1;
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.computePipeline);
    pass.setBindGroup(0, this.computeGroup);
    pass.dispatchWorkgroups(Math.ceil(samples / 64));
    pass.end();
    this.device.queue.submit([encoder.finish()]);
    this.count = 2 * samples;
  }

  draw(pass, viewProj) {
    this.device.queue.writeBuffer(this.uniform, 0, viewProj);
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.renderGroup);
    pass.setVertexBuffer(0, this.verts);
    pass.draw(this.count);
    this.renderer.countDraw(this.count);
  }
}
