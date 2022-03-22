struct Camera {
  matrix : mat4x4<f32>;
}

@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(1) var outputTex : texture_storage_2d<rgba8unorm, write>;

@stage(compute) @workgroup_size(16, 16, 1)
fn main(
    @builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(local_invocation_id) local_id : vec3<u32>,
  ) {

  let x = f32(global_id.x);
  let y = f32(global_id.y);
  let lx = f32(local_id.x);
  let ly = f32(local_id.y);

  let col = vec4<f32>(
    (x * 0.25 + lx) / 256.0,
    (y * 0.25 + ly) / 256.0,
    0.0,
    1.0
  );

  textureStore(outputTex, vec2<i32>(i32(x),i32(y)), col);
}