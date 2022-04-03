import { vec3 } from 'gl-matrix';
import {vec4Size} from './generic';

interface SphereOptions {
  position: vec3;
  radius: number;
  material: number;
}

class Sphere {
  position: vec3 = vec3.create();
  radius: number = 1;
  material: number = 0;

  static size = 2 * vec4Size;

  constructor(options: Partial<SphereOptions>) {
    Object.assign(this, options);
  }

  toArray(): number[] {
    return [
      ...this.position,
      this.radius,
      this.material,
      0, 0, 0
    ];
  }
}

// sample spheres
export const spheres = [
  // blue
  new Sphere({
    position: vec3.fromValues(-4, 0, 0),
    radius: 0.8,
    material: 0
  }),

  // red
  // new Sphere({
  //   position: vec3.fromValues(-0.2, 0, 0),
  //   radius: 0.4,
  //   material: 1,
  // }),

  // reflective
  new Sphere({
    position: vec3.fromValues(3, 0, 0),
    radius: 1.5,
    material: 2,
  }),

  // ground
  new Sphere({
    position: vec3.fromValues(0, -500, 0),
    radius: 498,
    material: 3,
  }),

  // lights
  new Sphere({
    position: vec3.fromValues(-0, 2, 0),
    radius: 0.7,
    material: 4,
  }),
  new Sphere({
    position: vec3.fromValues(-2, -1, 5),
    radius: 0.4,
    material: 5,
  }),
  new Sphere({
    position: vec3.fromValues(0, 0, -5),
    radius: 0.5,
    material: 6,
  }),
];

export default Sphere;
