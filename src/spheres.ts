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
  new Sphere({
    position: vec3.fromValues(-4, 0, 0),
    radius: 0.8,
    diffuse: vec3.fromValues(0.1, 0.7, 0.99),
    roughness: 0.9,
    emissive: vec3.fromValues(0, 0, 0),
  }),
  new Sphere({
    position: vec3.fromValues(-2, 0, 0),
    radius: 0.33,
    diffuse: vec3.fromValues(7.0, 0.7, 1.0),
    roughness: 0.99,
    emissive: vec3.fromValues(0, 0, 0),
  }),
  new Sphere({
    position: vec3.fromValues(0, 5, 3),
    radius: 5.2,
    diffuse: vec3.fromValues(0.0, 0.0, 0.0),
    roughness: 0.99,
    emissive: vec3.fromValues(20.9, 20.9, 20.99),
  }),
  new Sphere({
    position: vec3.fromValues(3, 0, 0),
    radius: 1.5,
    diffuse: vec3.fromValues(0.8, 0.8, 0.5),
    roughness: 0.01,
    emissive: vec3.fromValues(0, 0, 0),
  }),
];

export default Sphere;
