import { mat4, vec3 } from 'gl-matrix';

const vec4Size = 4 * Float32Array.BYTES_PER_ELEMENT;

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
  viewMatrix: mat4 = mat4.create();
  mvpMatrix: mat4 = mat4.create();
  fovy: number = (2 * Math.PI) / 5;
  width: number = 1;
  height: number = 1;
  near: number = 0.01;
  far: number = 100;
  buffer?: GPUBuffer;

  constructor(options: Partial<CameraOptions>) {
    Object.assign(this, options);
    this.updateMatrices();
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
    mat4.multiply(
      this.mvpMatrix,
      this.projectionMatrix,
      this.viewMatrix
    );
  }

  updateBuffer(device: GPUDevice) {
    if (!this.buffer) throw Error('No camera buffer to update');
    const cameraArray = Float32Array.from([
      ...this.mvpMatrix as Float32Array,
      this.width, this.height,
      this.near, this.far,
    ]);
    device.queue.writeBuffer(
      this.buffer,
      0,
      cameraArray
    )
  }

  makeBuffer(device: GPUDevice) {
    this.buffer = device.createBuffer({
      size: 6 * vec4Size, // 4x4 matrix, resolution, near, far, timestep
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    const cameraArray = new Float32Array(this.buffer.getMappedRange());
    cameraArray.set([
      ...this.mvpMatrix as Float32Array,
      this.width, this.height,
      this.near, this.far,
      0
    ]);
    this.buffer.unmap();
  }
}

export default Camera;
