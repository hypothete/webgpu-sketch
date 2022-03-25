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
  diffuse: vec3<f32>;
  roughness: f32;
  emissive: vec3<f32>;
}

struct Ray {
  origin: vec3<f32>;
  direction: vec3<f32>;
}

struct Info {
  lengths: vec2<f32>;
  normal: vec3<f32>;
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage> spheres: array<Sphere>;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;

var<private> UP: vec3<f32> = vec3<f32>(0.0, 1.0, 0.0);
var<private> PI: f32 = 3.141592653589;
var<private> EPSILON: f32 = 0.001;

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

fn intersectSpheres(r: Ray,  info: ptr<function,Info>) -> Sphere  {
  let numSpheres = arrayLength(&spheres);
  var i: u32 = 0u;
  var closestSphere: Sphere;
  loop {
    if (i >= numSpheres) {
      break;
    }
    // project sphere into camera space
    let movedSphere = Sphere(
      (uniforms.mvpMatrix * vec4<f32>(spheres[i].position, 1.0)).xyz,
      spheres[i].radius,
      vec3<f32>(0.0),
      0.0,
      vec3<f32>(0.0),
    );
    let sphereIntersections = intersectSphere(r, movedSphere);
    if (sphereIntersections.x > uniforms.near &&
      sphereIntersections.x < sphereIntersections.y &&
      sphereIntersections.x < (*info).lengths.x) {
        (*info).lengths.x = sphereIntersections.x;
        (*info).normal = sphereNormal(movedSphere, rayAt(r, sphereIntersections.x));
        closestSphere = spheres[i];
    }
    i = i + 1u;
  }
  return closestSphere;
}

fn raytrace(r: ptr<function,Ray>) -> vec4<f32> {
  var info: Info = Info(
    vec2<f32>(uniforms.far, uniforms.near),
    vec3(0.0)
  );
  var col = vec3<f32>(0.0, 0.0, 0.0);
  var throughput = vec3<f32>(1.0, 1.0, 1.0);
  let bounces: u32 = 3u;
  var i: u32 = bounces;
  loop {
    if (i < 1u) {
      break;
    }
    let closestSphere = intersectSpheres(*r, &info);
    let hit = rayAt(*r, info.lengths.x);
    if (info.lengths.x >= uniforms.far) {
      break;
    }
    // Update ray
    let doSpecular = rand(vec2<f32>(hit.xz - hit.yx)) > closestSphere.roughness;
    let diffuseDir = normalize(info.normal + randomOnUnitSphere(hit.xy - hit.yz));
    let specularDir = reflect((*r).direction, info.normal);
    (*r).direction = mix(diffuseDir, specularDir, f32(doSpecular));
    (*r).origin = hit + (*r).direction * EPSILON;

    // add color
    col = col + closestSphere.emissive * throughput;
    throughput = throughput * closestSphere.diffuse;
    // todo add specular color to sphere
    i = i - 1u;
  }
  return vec4<f32>(col, 1.0);
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

  // note: can't get pointers to lets
  var ray = Ray(
    vec3<f32>(0.0),
    normalize(rayOffset)
  );

  let col = raytrace(&ray);

  textureStore(outputTex, vec2<i32>(i32(x),i32(y)), col);
}