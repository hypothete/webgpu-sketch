// based on code from these sources:
// https://surma.dev/things/webgpu/ 
// https://austin-eng.com/webgpu-samples/samples/imageBlur

import { mat4, vec3, vec4 } from 'gl-matrix';

const vec4Size = 4 * Float32Array.BYTES_PER_ELEMENT;
const NEAR = 0.01;
const FAR = 100;
let timestep = 0;

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

  const imageBitmap = await createImageBitmap(canvas);

  // todo this usage probably needs work
  const canvasTexture = device.createTexture({
    size: [imageBitmap.width, imageBitmap.height, 1],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture: canvasTexture },
    [imageBitmap.width, imageBitmap.height]
  );

  //// CAMERA SETUP ////
  const aspect = canvas.width / canvas.height;
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix,
    (2 * Math.PI) / 5,
    aspect,
    NEAR,
    FAR
  );
  const viewMatrix = mat4.create();
  mat4.lookAt(viewMatrix,
    vec3.fromValues(-3, 1, 3), // position
    vec3.fromValues(0, 0, 0),  // target
    vec3.fromValues(0, 1, 0)   // up
  );
  const mvpMatrix = mat4.create();
  mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
  const mvpArray: Float32Array = mvpMatrix as Float32Array;
  const cameraBuffer = device.createBuffer({
    size: 6 * vec4Size, // 4x4 matrix, resolution, near, far, timestep
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });
  const cameraArray = new Float32Array(cameraBuffer.getMappedRange());
  cameraArray.set([
    ...mvpArray,
    canvas.width, canvas.height, NEAR, FAR,
    0
  ]);
  cameraBuffer.unmap();

  //// SPHERE ARRAY ////
  const spherePositions = [
    vec4.fromValues(-2, 0, 0, 1),
    vec4.fromValues(-1, 0, 0, 1),
    vec4.fromValues(0, 0, 0, 1),
    vec4.fromValues(2, 0, 0, 1)
  ];
  const sphereBuffer = device.createBuffer({
    size: spherePositions.length * vec4Size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    mappedAtCreation: true
  });
  const sphereArray = new Float32Array(sphereBuffer.getMappedRange());
  // precompute mvpMatrix positions for spheres
  sphereArray.set([
    ...spherePositions.flatMap(spherePos => {
      vec4.transformMat4(spherePos, spherePos, mvpMatrix);
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
          buffer: cameraBuffer,
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
        resource: canvasTexture.createView(),
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
        resource: canvasTexture.createView(),
      },
    ],
  });

  //// RENDER LOOP ////
  requestAnimationFrame(frame);

  function frame () {
    if (!canvas || !context) throw Error("Lost rendering context!");
    const commandEncoder = device.createCommandEncoder();

    //// COMPUTE PASS ////
    // update timestep
    const tsBuffer = Float32Array.from([timestep]);
    device.queue.writeBuffer(cameraBuffer, vec4Size * 5, tsBuffer);
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
    // commandEncoder.copyTextureToTexture(
    //   {
    //     texture: swapChainTexture,
    //   },
    //   {
    //     texture: canvasTexture,
    //   },
    //   presentationSize
    // );

    device.queue.submit([commandEncoder.finish()]);
    timestep += 1;
    requestAnimationFrame(frame);
  }
}
