struct Uniforms {
  iViewMatrix: mat4x4<f32>;
  iProjectionMatrix: mat4x4<f32>;
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
@group(0) @binding(2) var mySampler : sampler;
@group(0) @binding(3) var computeCopyTexture : texture_2d<f32>;
@group(0) @binding(4) var outputTex: texture_storage_2d<rgba16float, write>;

let PI: f32 = 3.141592653589;
let EPSILON: f32 = 0.001;
let RAY_BOUNCES: u32 = 4u;
let SAMPLES: u32 = 8u;

var<private> RNGSTATE: u32 = 42u;

fn pcgHash() -> u32 {
  let state = RNGSTATE;
  RNGSTATE = RNGSTATE * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn randomFloat() -> f32 {
  return f32(pcgHash()) / 4294967296.0;
}

fn randomUnitVector() -> vec3<f32> {
  let z = randomFloat() * 2.0 - 1.0;
  let a = randomFloat() * (PI * 2.0);
  let r = sqrt(1.0 - z * z);
  let x = r * cos(a);
  let y = r * sin(a);
  return vec3<f32>(x, y, z);
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
    let sphereIntersections = intersectSphere(r, spheres[i]);
    if (sphereIntersections.x > uniforms.near &&
      sphereIntersections.x < sphereIntersections.y &&
      sphereIntersections.x < (*info).lengths.x) {
        (*info).lengths.x = sphereIntersections.x;
        (*info).normal = sphereNormal(spheres[i], rayAt(r, sphereIntersections.x));
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
  var col = vec3<f32>(0.0);
  var throughput = vec3<f32>(1.0, 1.0, 1.0);
  var i: u32 = RAY_BOUNCES;
  loop {
    if (i < 1u) {
      break;
    }
    let closestSphere = intersectSpheres(*r, &info);
    let hit = rayAt(*r, info.lengths.x);
    if (info.lengths.x >= uniforms.far) {
      break;
    }
    // col = info.normal;
    // break;
    let doSpecular = randomFloat();
    let diffuseDir = normalize(info.normal + randomUnitVector());
    let specularDir = reflect((*r).direction, info.normal);
    (*r).direction = select(diffuseDir, specularDir, doSpecular > closestSphere.roughness);
    (*r).origin = hit + (*r).direction * EPSILON;

    // add color
    col = col + closestSphere.emissive * throughput;
    throughput = throughput * closestSphere.diffuse;
    // todo add specular color to sphere
    i = i - 1u;
  }
  return vec4<f32>(col, 1.0);
  // return vec4<f32>(f32(i/bounces), 0.0, 0.0, 1.0); // debug for bounces
}

@stage(compute) @workgroup_size(16, 16, 1)
fn main(
    @builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(local_invocation_id) local_id : vec3<u32>,
  ) {

  let x = f32(global_id.x);
  let y = f32(global_id.y);
  RNGSTATE = u32(uniforms.timestep * x * y);
  let aspect = uniforms.resolution.y / uniforms.resolution.x;
  let uv = vec2<f32>(
    (x / uniforms.resolution.x),
    (y / uniforms.resolution.y)
  );
  let camPosition = uniforms.iViewMatrix * vec4<f32>(0.0, 0.0, 0.0, 1.0);

  var col1 = vec4<f32>();

  var i: u32 = 0u;
  loop {
    if (i >= SAMPLES) {
      break;
    }
    let jitter = vec2<f32>(randomFloat(), randomFloat()) - 0.5;
    var rayDirection = uniforms.iViewMatrix * (uniforms.iProjectionMatrix * vec4<f32>(
      (2.0 * (jitter.x + x) / uniforms.resolution.x) - 1.0,
      (1.0 - 2.0 * (jitter.y + y) / uniforms.resolution.y),
      1.0,
      1.0
    ));

    rayDirection = vec4<f32>(normalize(rayDirection.xyz), 1.0);
    
    var ray = Ray(
      camPosition.xyz,
      rayDirection.xyz
    );

    col1 = col1 + raytrace(&ray);
    i = i + 1u;
  }
  col1 = vec4<f32>(col1.rgb / 8.0, 1.0);

  let col2 = textureSampleLevel(computeCopyTexture, mySampler, uv, 0.0);
  let col3 = mix(col1, col2, 1.0 - 1.0 / uniforms.timestep);

  textureStore(outputTex, vec2<i32>(i32(x),i32(y)), col3);
}