// based off https://austin-eng.com/webgpu-samples/samples/imageBlur#../../shaders/fullscreenTexturedQuad.wgsl

@group(0) @binding(0) var mySampler : sampler;
@group(0) @binding(1) var computeTexture : texture_2d<f32>;
@group(0) @binding(2) var canvasTexture : texture_2d<f32>;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>;
  @location(0) fragUV : vec2<f32>;
};

@stage(vertex)
fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
      vec2<f32>( 1.0,  1.0),
      vec2<f32>( 1.0, -1.0),
      vec2<f32>(-1.0, -1.0),
      vec2<f32>( 1.0,  1.0),
      vec2<f32>(-1.0, -1.0),
      vec2<f32>(-1.0,  1.0));

  var uv = array<vec2<f32>, 6>(
      vec2<f32>(1.0, 0.0),
      vec2<f32>(1.0, 1.0),
      vec2<f32>(0.0, 1.0),
      vec2<f32>(1.0, 0.0),
      vec2<f32>(0.0, 1.0),
      vec2<f32>(0.0, 0.0));

  var output : VertexOutput;
  output.Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
  output.fragUV = uv[VertexIndex];
  return output;
}

@stage(fragment)
fn frag_main(@location(0) fragUV : vec2<f32>) -> @location(0) vec4<f32> {
  let col1 = textureSample(computeTexture, mySampler, fragUV);
  let col2 = textureSample(canvasTexture, mySampler, fragUV);
  return vec4<f32>(mix(col1, col2, 0.8).rgb, 1.0);
}
