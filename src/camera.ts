import { mat4, vec3, vec4 } from 'gl-matrix';
import { Document } from '@gltf-transform/core';

import { vec4Size } from './generic';

interface CameraOptions {
  position: vec3;
  target: vec3;
  up: vec3;
  fovy: number;
  width: number;
  height: number;
  near: number;
  far: number;
}

class Camera {
  position: vec3 = vec3.create();
  target: vec3 = vec3.create();
  up: vec3 = vec3.fromValues(0, 1, 0);
  projectionMatrix: mat4 = mat4.create();
  iProjectionMatrix: mat4 = mat4.create();
  viewMatrix: mat4 = mat4.create();
  iViewMatrix: mat4 = mat4.create();
  fovy: number = (2 * Math.PI) / 5;
  width: number = 1;
  height: number = 1;
  near: number = 0.01;
  far: number = 100;
  buffer?: GPUBuffer;
  timestep: number = 1;

  constructor(options: Partial<CameraOptions>) {
    Object.assign(this, options);
    this.updateMatrices();
  }

  get direction () {
    const vecToReturn = vec3.create();
    return vec3.normalize(vecToReturn, vec3.subtract(vecToReturn, this.target, this.position));
  }

  updateMatrices () {
    mat4.perspective(
      this.projectionMatrix,
      this.fovy,
      this.width / this.height,
      this.near,
      this.far
    );
    mat4.lookAt(
      this.viewMatrix,
      this.position,
      this.target,
      this.up
    );
    mat4.invert(this.iViewMatrix, this.viewMatrix);
    mat4.invert(this.iProjectionMatrix, this.projectionMatrix);
  }

  updateBuffer(device: GPUDevice) {
    if (!this.buffer) throw Error('No camera buffer to update');
    const cameraArray = Float32Array.from([
      ...this.iViewMatrix as Float32Array,
      ...this.iProjectionMatrix as Float32Array,
      this.width, this.height,
      this.near, this.far,
      this.timestep,
    ]);
    device.queue.writeBuffer(
      this.buffer,
      0,
      cameraArray
    )
  }

  makeBuffer(device: GPUDevice) {
    this.buffer = device.createBuffer({
      size: (4 + 4 + 2) * vec4Size, // 2 4x4 matrices, resolution, near, far, timestep
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    const cameraArray = new Float32Array(this.buffer.getMappedRange());
    cameraArray.set([
      ...this.iViewMatrix as Float32Array,
      ...this.iProjectionMatrix as Float32Array,
      this.width, this.height,
      this.near, this.far,
      this.timestep,
    ]);
    this.buffer.unmap();
  }

  updateTimestep(device: GPUDevice) {
    const tsBuffer = Float32Array.from([this.timestep]);
    device.queue.writeBuffer(this.buffer as GPUBuffer, vec4Size * 9, tsBuffer);
  }

  cullGLTFDocument(gltfDoc: Document): Float32Array {
    const nodes = gltfDoc.getRoot().listNodes();
    const triRaw: number[] = [];
    nodes.forEach(node => {
      const meshTransform = node.getMatrix();
      const mesh = node.getMesh();
      if (!mesh) return;
      const primitives = mesh.listPrimitives();
      primitives.forEach(primitive => {
        const indices = primitive.getIndices();
        const positions = primitive.getAttribute('POSITION');
        if (indices && positions) {
          const indexArray = indices.getArray();
          if (!indexArray) return;
          // iterate over triangles, cull & add to buffer
          for(let i = 0; i < indexArray?.length; i ++) {
            const aPosition = vec4.fromValues(
              ...positions.getElement(indexArray[i], []) as [number, number, number],
              1
            );

            vec4.transformMat4(aPosition, aPosition, meshTransform);
            triRaw.push(...aPosition);
          }
        }
      });
    });

    return Float32Array.from(triRaw);
  }
}

export default Camera;
