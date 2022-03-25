// based off https://austin-eng.com/webgpu-samples/samples/imageBlur#../../shaders/fullscreenTexturedQuad.wgsl

@group(0) @binding(0) var mySampler : sampler;
@group(0) @binding(1) var computeTexture : texture_2d<f32>;
@group(0) @binding(2) var canvasTexture : texture_2d<f32>;
@group(0) @binding(3) var<uniform> uniforms: Uniform;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>;
  @location(0) fragUV : vec2<f32>;
};

struct Uniform {
  timestep: f32;
}

var<private> EXPOSURE: f32 = 0.5;

fn ACESFilm(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51f;
  let b = 0.03f;
  let c = 2.43f;
  let d = 0.59f;
  let e = 0.14f;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), vec3<f32>(0.0), vec3<f32>(1.0));
}

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
  let col1 = textureSample(computeTexture, mySampler, fragUV).rgb;
  let col2 = textureSample(canvasTexture, mySampler, fragUV).rgb;
  let col3 = mix(col1, col2, 1.0 - 1.0/uniforms.timestep);
  return vec4<f32>(col3, 1.0);
}
