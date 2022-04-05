struct Camera {
  iViewMatrix: mat4x4<f32>,
  iProjectionMatrix: mat4x4<f32>,
  resolution: vec2<f32>,
  near: f32,
  far: f32,
  timestep: f32
}

struct RayPoint {
  color: vec4<f32>,
  position: vec2<f32>
}

@group(0) @binding(0) var<storage> points: array<RayPoint>;
@group(0) @binding(1) var<uniform> camera: Camera;
@group(0) @binding(2) var mySampler : sampler;
@group(0) @binding(3) var computeCopyTexture : texture_2d<f32>;
@group(0) @binding(4) var outputTex: texture_storage_2d<rgba16float, write>;

fn getNearestColor (uv: vec2<f32>) -> vec4<f32> {
  let numPoints = arrayLength(&points);
  var i = 0u;
  var minDist = camera.resolution.x * camera.resolution.y;
  var closestColor = vec4<f32>();
  loop {
    if (i >= numPoints) {
      break;
    }
    let ptDist = distance(points[i].position, uv);
    if (ptDist < minDist) {
      minDist = ptDist;
      closestColor = points[i].color;
    }
  }
  return closestColor;
}

@stage(compute) @workgroup_size(16, 16, 1)
fn main(
    @builtin(global_invocation_id) global_id : vec3<u32>
  ) {
  let x = f32(global_id.x);
  let y = f32(global_id.y);
  let uv = vec2<f32>(
    (x / camera.resolution.x),
    (y / camera.resolution.y)
  );
  let col1 = getNearestColor(uv);
  // let col2 = textureSampleLevel(computeCopyTexture, mySampler, uv, 0.0);
  // let col3 = mix(col1, col2, 1.0 - 1.0 / camera.timestep);
  textureStore(outputTex, vec2<i32>(i32(x),i32(y)), col1);
}