struct Uniforms {
  camPosition: vec4<f32>;
  camDirection: vec4<f32>;
  camUp: vec4<f32>;
  resolution: vec2<f32>;
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

var<private> NEAR: f32 = 0.1;
var<private> FAR: f32 = 100.0;
var<private> TESTLIGHT: vec3<f32> = vec3<f32>(10.0, 10.0, -2.0);

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
  var intersections = vec2<f32>(FAR, NEAR);
  var nearSphere: Sphere;

  loop {
    if (i >= numSpheres) {
      break;
    }
    let sphereIntersections = intersectSphere(r, spheres[i]);
    if (sphereIntersections.x > NEAR &&
      sphereIntersections.x < sphereIntersections.y &&
      sphereIntersections.x < intersections.x) {
        intersections.x = sphereIntersections.x;
        nearSphere = spheres[i];
    }
    i = i + 1u;
  }

  if (intersections.x >= FAR) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }

  let hit = rayAt(r, intersections.x);
  let sNormal = sphereNormal(nearSphere, hit);
  let lambert = dot(sNormal, TESTLIGHT);
  return vec4<f32>(lambert, lambert, lambert, 1.0);

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

  let aspect: f32 = uniforms.resolution.y / uniforms.resolution.x;

  let rayOffset = vec3<f32>(
    (2.0 * (x / uniforms.resolution.x) - 1.0) / aspect,
    (1.0 - 2.0 * (y / uniforms.resolution.y)),
    0.0
  );

  let ray = Ray(
    vec3<f32>(uniforms.camPosition.xyz),
    normalize(uniforms.camDirection.xyz + rayOffset)
  );

  let col = raytrace(ray);

  textureStore(outputTex, vec2<i32>(i32(x),i32(y)), col);
}