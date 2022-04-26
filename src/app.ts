import { vec3, vec4, mat4 } from 'gl-matrix';
import { WebIO } from '@gltf-transform/core';

import Camera from './camera';
import Material, { materials } from './materials';
import Sphere, { spheres } from './spheres';
import { vec4Size, parseGLTFDocument } from './generic';

//// CONSTANTS AND INIT ////
let keys: Record<string, boolean> = {};
let computeTexture: GPUTexture | undefined;
let computeCopyTexture: GPUTexture | undefined;
let camera: Camera | undefined;
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

  const noSupport: HTMLDivElement | null = document.querySelector('.no-support');
  if (noSupport) {
    noSupport.style.display = 'none';
  }

  //// LOAD RELEVANT FILES ////
  const computeWGSL = await fetch('./compute.wgsl')
    .then(response => response.text());

  const fullscreenTexturedQuadWGSL = await fetch('./fullscreen-textured-quad.wgsl')
    .then(response => response.text());
  
  const io = new WebIO({credentials: 'include'});
  const gltfDoc = await io.read('/suz-cube.gltf');

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

    if (computeTexture) {
      computeTexture = device.createTexture({
        size: presentationSize,
        format: 'rgba16float',
        usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_SRC
      });
    
      computeCopyTexture = device.createTexture({
        size: presentationSize,
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
    }

    if (camera) {
      camera.width = presentationSize[0];
      camera.height = presentationSize[1];
      camera.timestep = 1;
      camera.updateMatrices();
      camera.updateBuffer(device);
    }
  }

  configureCanvasSize();

  window.addEventListener('resize', configureCanvasSize);

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
        buffer: {
          type: 'read-only-storage'
        }
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'read-only-storage'
        }
      },
      {
        binding: 4,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'read-only-storage'
        }
      },
      {
        binding: 5,
        visibility: GPUShaderStage.COMPUTE,
        sampler: {
          type: 'filtering'
        }
      },
      {
        binding: 6,
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          sampleType: 'float'
        }
      },
      {
        binding: 7,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          format: 'rgba16float',
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
        buffer: {
          type: 'uniform',
        }
      },
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
    magFilter: 'nearest',
    minFilter: 'nearest',
  });

  computeTexture = device.createTexture({
    size: presentationSize,
    format: 'rgba16float',
    usage:
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.STORAGE_BINDING |
    GPUTextureUsage.COPY_SRC
  });

  computeCopyTexture = device.createTexture({
    size: presentationSize,
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
  });

  //// CAMERA SETUP ////
  camera = new Camera({
    position: vec3.fromValues(-6, 0, 6),
    width: presentationSize[0],
    height: presentationSize[1]
  });
  camera.makeBuffer(device);

  //// SPHERE ARRAY ////
  const sphereData = spheres.flatMap(sphere => sphere.toArray());
  const sphereBuffer = device.createBuffer({
    size: spheres.length * Sphere.size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    mappedAtCreation: true
  });
  const sphereArray = new Float32Array(sphereBuffer.getMappedRange());
  sphereArray.set(sphereData);
  sphereBuffer.unmap();

  //// VERTEX AND MESH ARRAYS ////
  const { triangleData, meshData } = parseGLTFDocument(gltfDoc);
  const triBuffer = device.createBuffer({
    size: triangleData.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    mappedAtCreation: true
  });
  const triArray = new Float32Array(triBuffer.getMappedRange());
  triArray.set(triangleData);
  triBuffer.unmap();

  const meshBuffer = device.createBuffer({
    size: meshData.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    mappedAtCreation: true
  });
  const meshArray = new Float32Array(meshBuffer.getMappedRange());
  meshArray.set(meshData);
  meshBuffer.unmap();

  //// MATERIAL ARRAY ////
  const materialData = materials.flatMap(material => material.toArray());
  const materialBuffer = device.createBuffer({
    size: materials.length * Material.size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    mappedAtCreation: true
  });
  const materialArray = new Float32Array(materialBuffer.getMappedRange());
  materialArray.set(materialData);
  materialBuffer.unmap();

  //// RENDER UNIFORMS ////
  const renderUniformBuffer = device.createBuffer({
    size: vec4Size,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true
  });
  const renderUniformArray = new Float32Array(renderUniformBuffer.getMappedRange());
  renderUniformArray.set([
    0.5,
  ]);
  renderUniformBuffer.unmap();

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
    if (!camera) throw Error("Camera not instantiated.");
    if (!computeTexture || !computeCopyTexture) throw Error("Compute textures not instantiated.");
    const commandEncoder = device.createCommandEncoder();
    //// EVENT HANDLING ////
    let dirty = false;
    let rotY = 0;
    let rotX = 0;
    let zoom = 0;

    if (keys['a']) {
      dirty = true;
      rotY = -1;
    } else if (keys['d']) {
      dirty = true;
      rotY = 1;
    }

    if (keys['w']) {
      dirty = true;
      rotX = 1;
    } else if (keys['s']) {
      dirty = true;
      rotX = -1;
    }

    if (keys['q']) {
      dirty = true;
      zoom = -1;
    } else if (keys['z']) {
      dirty = true;
      zoom = 1;
    }

    if (dirty) {
      camera.timestep = 1;
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
      vec3.scale(camera.position, camera.position, 1 + zoom * 0.02);
      camera.updateMatrices();
      camera.updateBuffer(device);
    }

    //// COMPUTE PASS ////
    camera.updateTimestep(device);
    // start pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, device.createBindGroup({
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
          resource: {
            buffer: triBuffer,
          }
        },
        {
          binding: 3,
          resource: {
            buffer: materialBuffer,
          }
        },
        {
          binding: 4,
          resource: {
            buffer: meshBuffer,
          }
        },
        {
          binding: 5,
          resource: sampler,
        },
        {
          binding: 6,
          resource: computeCopyTexture.createView(),
        },
        {
          binding: 7,
          resource: computeTexture.createView(),
        },
      ],
    }));
    // workgroup sizes are 16x16 right now
    computePass.dispatch(
      Math.ceil(presentationSize[0] / 16),
      Math.ceil(presentationSize[1] / 16),
      1
    );
    computePass.end();
    // Copy the updated texture back
    commandEncoder.copyTextureToTexture(
      {
        texture: computeTexture,
      },
      {
        texture: computeCopyTexture,
      },
      presentationSize,
    );

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

    // todo memoize bind groups somehow
    renderPass.setBindGroup(0, device.createBindGroup({
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
          resource: {
            buffer: renderUniformBuffer,
          },
        },
      ],
    }));
    renderPass.draw(6, 1, 0, 0);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    camera.timestep += 1;
    requestAnimationFrame(frame);
  }
}
