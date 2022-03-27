import { vec3 } from 'gl-matrix';

const vec4Size = 4 * Float32Array.BYTES_PER_ELEMENT;

interface SphereOptions {
  position: vec3;
  radius: number;
  diffuse: vec3;
  roughness: number;
  emissive: vec3;
}

class Sphere {
  position: vec3 = vec3.create();
  radius: number = 1;
  diffuse: vec3 = vec3.create();
  roughness: number = 0.5;
  emissive: vec3 = vec3.create();

  static size = 3 * vec4Size;

  constructor(options: Partial<SphereOptions>) {
    Object.assign(this, options);
  }

  toArray(): number[] {
    return [
      ...this.position,
      this.radius,
      ...this.diffuse,
      this.roughness,
      ...this.emissive,
      0
    ];
  }
}

// sample spheres
export const spheres = [
  // blue
  new Sphere({
    position: vec3.fromValues(-4, 0, 0),
    radius: 0.8,
    diffuse: vec3.fromValues(0.3, 0.5, 1.0),
    roughness: 0.7,
    emissive: vec3.fromValues(0, 0, 0),
  }),

  // red
  new Sphere({
    position: vec3.fromValues(-0.2, 0, 0),
    radius: 0.4,
    diffuse: vec3.fromValues(1.0, 0.3, 0.3),
    roughness: 0.99,
    emissive: vec3.fromValues(0, 0, 0),
  }),

  // reflective
  new Sphere({
    position: vec3.fromValues(3, 0, 0),
    radius: 1.5,
    diffuse: vec3.fromValues(0.8, 0.8, 0.6),
    roughness: 0.1,
    emissive: vec3.fromValues(0, 0, 0),
  }),

  // ground
  new Sphere({
    position: vec3.fromValues(0, -500, 0),
    radius: 498,
    diffuse: vec3.fromValues(0.9, 0.9, 0.9),
    roughness: 1.0,
    emissive: vec3.fromValues(0, 0, 0),
  }),

  // lights
  new Sphere({
    position: vec3.fromValues(-0, 2, 0),
    radius: 0.8,
    diffuse: vec3.fromValues(0.0, 0.0, 0.0),
    roughness: 0.99,
    emissive: vec3.fromValues(20, 20, 10),
  }),
  new Sphere({
    position: vec3.fromValues(-2, -1, 5),
    radius: 0.5,
    diffuse: vec3.fromValues(0.0, 0.0, 0.0),
    roughness: 0.99,
    emissive: vec3.fromValues(20, 10, 20),
  }),
  new Sphere({
    position: vec3.fromValues(0, 0, -5),
    radius: 0.5,
    diffuse: vec3.fromValues(0.0, 0.0, 0.0),
    roughness: 0.99,
    emissive: vec3.fromValues(10, 20, 20),
  }),
];

export default Sphere;
