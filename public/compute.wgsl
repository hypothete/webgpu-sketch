struct Uniforms {
  mvpMatrix: mat4x4<f32>;
  resolution: vec2<f32>;
  near: f32;
  far: f32;
  timestep: f32;
}

struct Sphere {
  position: vec3<f32>;
  radius: f32;
}

struct Ray {
  origin: vec3<f32>;
  direction: vec3<f32>;
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage> spheres: array<Sphere>;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;

var<private> TESTLIGHT: vec3<f32> = vec3<f32>(10.0, 10.0, -2.0);

fn rand(co: vec2<f32>) -> f32 {
  return fract(sin(dot(co.xy ,vec2<f32>(12.9898,78.233))) * 43758.5453);
}

fn randomOnUnitSphere(q: vec2<f32>) -> vec3<f32> {
  var p: vec3<f32>;
  var x = rand(q * vec2<f32>(-1.0, 7.0));
  var y = rand(q * vec2<f32>(9.0, 3.0));
  var z = rand(q * vec2<f32>(-22.0, 4.0));
  x = x / cos(x);
  y = y / cos(y);
  z = z / cos(z);
  p = 2.0 * vec3<f32>(x,y,z) - 1.0;
  p = normalize(p);
  return p;
}

fn intersectSphere(r: Ray, s: Sphere) -> vec2<f32> {
  let oc = r.origin - s.position;
  let a = dot(r.direction, r.direction);
  let b = dot(oc, r.direction);
  let c = dot(oc, oc) - s.radius * s.radius;
  let h = sqrt(b * b - a * c);
  return vec2<f32>(
    (-b - h) / a,
    (-b + h) / a
  ); // get intersect pts
}

fn rayAt(r: Ray, t: f32) -> vec3<f32> {
  return r.origin + r.direction * t;
}

fn sphereNormal(s: Sphere, p: vec3<f32>) -> vec3<f32> {
  return normalize(p - s.position);
}

fn raytrace(r: Ray) -> vec4<f32> {
  var i: u32 = 0u;
  let numSpheres = arrayLength(&spheres);
  var intersections = vec2<f32>(uniforms.far, uniforms.near);
  var nearSphere: Sphere;

  loop {
    if (i >= numSpheres) {
      break;
    }
    let sphereIntersections = intersectSphere(r, spheres[i]);
    if (sphereIntersections.x > uniforms.near &&
      sphereIntersections.x < sphereIntersections.y &&
      sphereIntersections.x < intersections.x) {
        intersections.x = sphereIntersections.x;
        nearSphere = spheres[i];
    }
    i = i + 1u;
  }

  if (intersections.x >= uniforms.far) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }

  let hit = rayAt(r, intersections.x);
  let sNormal = sphereNormal(nearSphere, hit);
  let camLight = uniforms.mvpMatrix * vec4<f32>(TESTLIGHT, 1.0);
  let lambert = sNormal + randomOnUnitSphere(hit.xy - hit.yz);
  //let lambert = clamp(dot(sNormal, camLight.rgb), 0.0, 1.0);
  return vec4<f32>(lambert, 1.0);

}

@stage(compute) @workgroup_size(16, 16, 1)
fn main(
    @builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(local_invocation_id) local_id : vec3<u32>,
  ) {

  let x = f32(global_id.x);
  let y = f32(global_id.y);
  let lx = f32(local_id.x);
  let ly = f32(local_id.y);
  let aspect = uniforms.resolution.y / uniforms.resolution.x;

  let jitter = vec2<f32>(
    rand(vec2<f32>(x, y + uniforms.timestep)),
    rand(vec2(uniforms.timestep - y, x))
  );

  let rayOffset = vec3<f32>(
    (1.0 - 2.0 * ((jitter.x + x) / uniforms.resolution.x)) / aspect,
    (1.0 - 2.0 * ((jitter.y + y) / uniforms.resolution.y)),
    1.0
  );

  let ray = Ray(
    vec3<f32>(0.0),
    normalize(rayOffset)
  );

  let col = raytrace(ray);

  textureStore(outputTex, vec2<i32>(i32(x),i32(y)), col);
}