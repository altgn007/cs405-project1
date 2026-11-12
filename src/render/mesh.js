/**
 * Mesh pipeline for the objects in front of the painting.
 * Each draw in a frame gets its own uniform buffer from a pool, because all
 * writeBuffer calls happen before the frame runs (see scene.js note).
 */
import meshWGSL from './shaders/mesh.wgsl?raw';
import { createShader, fragmentConstants } from './shader.js';
import { DEPTH_FORMAT } from './renderer.js';
import { multiply } from '../math/mat4.js';

export function createMesh(device, data) {
  const buffer = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(buffer, 0, data);
  return { buffer, count: data.length / 6 };
}

export class MeshPipeline {
  constructor(gpu, renderer) {
    this.device = gpu.device;
    this.renderer = renderer;
    const module = createShader(this.device, meshWGSL, 'mesh');
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
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });
    this.pool = [];
    this.used = 0;
  }

  // call once per frame before drawing
  begin() { this.used = 0; }

  draw(pass, mesh, viewProj, model, color, unlit = false) {
    if (this.used === this.pool.length) {
      const buffer = this.device.createBuffer({ size: 160, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer } }],
      });
      this.pool.push({ buffer, bindGroup });
    }
    const slot = this.pool[this.used++];
    const data = new Float32Array(40);
    data.set(multiply(viewProj, model), 0);
    data.set(model, 16);
    data.set(color, 32);
    data[36] = unlit ? 1 : 0;
    this.device.queue.writeBuffer(slot.buffer, 0, data);

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, slot.bindGroup);
    pass.setVertexBuffer(0, mesh.buffer);
    pass.draw(mesh.count);
    this.renderer.countDraw(mesh.count);
  }
}

