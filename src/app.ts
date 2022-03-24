// based on code from these sources:
// https://surma.dev/things/webgpu/ 
// https://austin-eng.com/webgpu-samples/samples/imageBlur

import { mat4, vec3, vec4 } from 'gl-matrix';

//// CAMERA CLASS ////
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

//// CONSTANTS AND INIT ////
const vec4Size = 4 * Float32Array.BYTES_PER_ELEMENT;
let timestep = 0;
let keys: Record<string, boolean> = {};
start();

async function start() {
  //// GPU RESOURCE SETUP ////
  if (!navigator.gpu) throw Error("WebGPU not supported.");

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw Error("Couldn't request WebGPU adapter.");

  const device = await adapter.requestDevice();
  if (!device) throw Error("Couldn't request WebGPU logical device.");

  const canvas = document.querySelector('canvas');
  if (!canvas) throw Error("No canvas element found.");

  const context = canvas.getContext('webgpu');
  if (!context) throw Error("Couldn't create a WebGPU context.");

  const computeWGSL = await fetch('/compute.wgsl')
    .then(response => response.text());

  const fullscreenTexturedQuadWGSL = await fetch('/fullscreen-textured-quad.wgsl')
    .then(response => response.text());

  //// CANVAS SETUP ////
  const presentationFormat = context.getPreferredFormat(adapter);
  let presentationSize: [number, number]  = [0, 0];

  function configureCanvasSize () {
    if (!canvas || !context) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const devicePixelRatio = window.devicePixelRatio || 1;
    presentationSize = [
      canvas.clientWidth * devicePixelRatio,
      canvas.clientHeight * devicePixelRatio,
    ];
    context.configure({
      device,
      format: presentationFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      size: presentationSize,
      compositingAlphaMode: "premultiplied"
    });
  }

  configureCanvasSize();
  // todo handle resizing
  // window.addEventListener('resize', configureCanvasSize);

  //// PIPELINE AND BIND GROUP LAYOUT SETUP ////
  const computeBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'uniform',
        }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'read-only-storage'
        }
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          format: 'rgba8unorm',
          access: 'write-only'
        }
      }
    ]
  });

  const computePipeline = device.createComputePipeline({
    compute: {
      module: device.createShaderModule({
        code: computeWGSL,
      }),
      entryPoint: "main",
    },
    layout: device.createPipelineLayout({
      bindGroupLayouts: [computeBindGroupLayout]
    })
  });

  const renderBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
          type: 'filtering'
        }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          sampleType: 'float'
        }
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          sampleType: 'float'
        }
      }
    ]
  });

  const renderPipeline = device.createRenderPipeline({
    vertex: {
      module: device.createShaderModule({
        code: fullscreenTexturedQuadWGSL,
      }),
      entryPoint: 'vert_main',
    },
    fragment: {
      module: device.createShaderModule({
        code: fullscreenTexturedQuadWGSL,
      }),
      entryPoint: 'frag_main',
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
    layout: device.createPipelineLayout({
      bindGroupLayouts: [renderBindGroupLayout]
    })
  });

  //// TEXTURE SETUP ////
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  const computeTexture = device.createTexture({
    size: presentationSize,
    format: 'rgba8unorm',
    usage:
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.STORAGE_BINDING |
    GPUTextureUsage.COPY_DST |
    GPUTextureUsage.RENDER_ATTACHMENT,
  });
  
  const canvasTexture = device.createTexture({
    size: presentationSize,
    format: presentationFormat,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
  });

  //// CAMERA SETUP ////
  const camera = new Camera({
    position: vec3.fromValues(0, 0, 5),
    width: presentationSize[0],
    height: presentationSize[1]
  });
  camera.makeBuffer(device);

  //// SPHERE ARRAY ////
  const spherePositions = [
    vec4.fromValues(-4, 0, 0, 1),
    vec4.fromValues(-2, 0, 0, 1),
    vec4.fromValues(0, 0, 0, 1),
    vec4.fromValues(3, 0, 0, 1)
  ];
  const sphereBuffer = device.createBuffer({
    size: spherePositions.length * vec4Size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    mappedAtCreation: true
  });
  const sphereArray = new Float32Array(sphereBuffer.getMappedRange());
  sphereArray.set([
    ...spherePositions.flatMap(spherePos => {
      return [...spherePos.slice(0,3), 0.5];
    })
  ]);
  sphereBuffer.unmap();

  //// PIPELINE BIND GROUPS ////

  const computeBindGroup = device.createBindGroup({
    layout: computeBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: camera.buffer as GPUBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: sphereBuffer,
        }
      },
      {
        binding: 2,
        resource: computeTexture.createView(),
      },
    ],
  });

  const renderBindGroup = device.createBindGroup({
    layout: renderBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: sampler,
      },
      {
        binding: 1,
        resource: computeTexture.createView(),
      },
      {
        binding: 2,
        resource: canvasTexture.createView(),
      },
    ],
  });

  //// EVENT LISTENERS ////
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  //// RENDER LOOP ////
  requestAnimationFrame(frame);

  function frame () {
    if (!canvas || !context) throw Error("Lost rendering context!");
    const commandEncoder = device.createCommandEncoder();
    //// EVENT HANDLING ////
    let dirty = false;
    let rotY = 0;
    let rotX = 0;
    if (keys['a']) {
      dirty = true;
      rotY = -1;
    } else if (keys['d']) {
      dirty = true;
      rotY = 1;
    }
    if (keys['w']) {
      dirty = true;
      rotX = -1;
    } else if (keys['s']) {
      dirty = true;
      rotX = 1;
    }
    if (dirty) {
      const rotYMat = mat4.create();
      mat4.fromRotation(rotYMat, 0.02 * rotY, camera.up);
      vec3.transformMat4(camera.position, camera.position, rotYMat);
      const rotXMat = mat4.create();
      const xOrtho = vec3.create();
      const toTarget = vec3.create();
      vec3.sub(toTarget, camera.position, camera.target);
      vec3.cross(xOrtho, toTarget, camera.up);
      mat4.fromRotation(rotXMat, 0.02 * rotX, xOrtho);
      vec3.transformMat4(camera.position, camera.position, rotXMat);
      camera.updateMatrices();
      camera.updateBuffer(device);
    }

    //// COMPUTE PASS ////
    // update timestep
    const tsBuffer = Float32Array.from([timestep]);
    device.queue.writeBuffer(camera.buffer as GPUBuffer, vec4Size * 5, tsBuffer);
    // start pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    // workgroup sizes are 16x16 right now
    computePass.dispatch(
      Math.ceil(presentationSize[0] / 16),
      Math.ceil(presentationSize[1] / 16),
      1
    );
    computePass.end();

    ////RENDER PASS ////
    const swapChainTexture = context.getCurrentTexture();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: swapChainTexture.createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.draw(6, 1, 0, 0);
    renderPass.end();
    // Copy the updated texture back
    commandEncoder.copyTextureToTexture(
      {
        texture: swapChainTexture,
      },
      {
        texture: canvasTexture,
      },
      presentationSize,
    );

    device.queue.submit([commandEncoder.finish()]);
    timestep += 1;
    requestAnimationFrame(frame);
  }
}
