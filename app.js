"use strict";
// based on code from these sources:
// https://surma.dev/things/webgpu/ 
// https://austin-eng.com/webgpu-samples/samples/imageBlur
start();
async function start() {
    //// GPU RESOURCE SETUP ////
    if (!navigator.gpu)
        throw Error("WebGPU not supported.");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
        throw Error("Couldn't request WebGPU adapter.");
    const device = await adapter.requestDevice();
    if (!device)
        throw Error("Couldn't request WebGPU logical device.");
    const canvas = document.querySelector('canvas');
    if (!canvas)
        throw Error("No canvas element found.");
    const context = canvas.getContext('webgpu');
    if (!context)
        throw Error("Couldn't create a WebGPU context.");
    const computeWGSL = await fetch('/compute.wgsl')
        .then(response => response.text());
    const fullscreenTexturedQuadWGSL = await fetch('/fullscreen-textured-quad.wgsl')
        .then(response => response.text());
    //// CANVAS SETUP ////
    const presentationFormat = context.getPreferredFormat(adapter);
    let presentationSize = [0, 0];
    function configureCanvasSize() {
        if (!canvas || !context)
            return;
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
    //// PIPELINE SETUP ////
    const computePipeline = device.createComputePipeline({
        compute: {
            module: device.createShaderModule({
                code: computeWGSL,
            }),
            entryPoint: "main",
        },
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
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture: canvasTexture }, [imageBitmap.width, imageBitmap.height]);
    //// SHADER BIND GROUPS ////
    const computeBindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            // {
            //   binding: 0,
            //   resource: sampler,
            // },
            {
                binding: 0,
                resource: canvasTexture.createView(),
            },
        ],
    });
    const renderBindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
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
    function frame() {
        if (!context)
            throw Error("Lost rendering context!");
        const commandEncoder = device.createCommandEncoder();
        //// COMPUTE PASS ////
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(computePipeline);
        computePass.setBindGroup(0, computeBindGroup);
        // workgroup sizes are 16x16 right now
        computePass.dispatch(Math.ceil(presentationSize[0] / 16), Math.ceil(presentationSize[1] / 16), 1);
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
        requestAnimationFrame(frame);
    }
}
//# sourceMappingURL=app.js.map