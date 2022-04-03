import { vec3 } from 'gl-matrix';
import {vec4Size} from './generic';

interface MaterialOptions {
  diffuse: vec3;
  roughness: number;
  specular: vec3;
  metalness: number;
  emissive: vec3;
}

class Material {
  diffuse: vec3 = vec3.create();
  roughness: number = 0;
  specular: vec3 = vec3.create();
  metalness: number = 0;
  emissive: vec3 = vec3.create();

  static size = 3 * vec4Size;

  constructor(options: Partial<MaterialOptions>) {
    Object.assign(this, options);
  }

  toArray(): number[] {
    return [
      ...this.diffuse,
      this.roughness,
      ...this.specular,
      this.metalness,
      ...this.emissive,
      0
    ];
  }
}

export const materials = [
  new Material({
    diffuse: vec3.fromValues(0.3, 0.5, 1.0),
    roughness: 0.7,
    specular: vec3.fromValues(1.0, 1.0, 1.0),
    metalness: 0,
    emissive: vec3.fromValues(0, 0, 0)
  }),

  new Material({
    diffuse: vec3.fromValues(1.0, 0.3, 0.3),
    roughness: 0.99,
    specular: vec3.fromValues(1.0, 1.0, 1.0),
    metalness: 0,
    emissive: vec3.fromValues(0, 0, 0)
  }),

  new Material({
    diffuse: vec3.fromValues(0.8, 0.8, 0.6),
    roughness: 0.1,
    specular: vec3.fromValues(0.8, 0.8, 0.6),
    metalness: 1,
    emissive: vec3.fromValues(0, 0, 0)
  }),

  new Material({
    diffuse: vec3.fromValues(0.9, 0.9, 0.9),
    roughness: 1.0,
    specular: vec3.fromValues(1.0, 1.0, 1.0),
    metalness: 0,
    emissive: vec3.fromValues(0, 0, 0)
  }),

  new Material({
    diffuse: vec3.fromValues(0.0, 0.0, 0.0),
    roughness: 1.0,
    specular: vec3.fromValues(0.0, 0.0, 0.0),
    metalness: 0,
    emissive: vec3.fromValues(20, 20, 10)
  }),

  new Material({
    diffuse: vec3.fromValues(0.0, 0.0, 0.0),
    roughness: 1.0,
    specular: vec3.fromValues(0.0, 0.0, 0.0),
    metalness: 0,
    emissive: vec3.fromValues(20, 10, 20)
  }),

  new Material({
    diffuse: vec3.fromValues(0.0, 0.0, 0.0),
    roughness: 1.0,
    specular: vec3.fromValues(0.0, 0.0, 0.0),
    metalness: 0,
    emissive: vec3.fromValues(10, 20, 20)
  }),
];

export default Material;