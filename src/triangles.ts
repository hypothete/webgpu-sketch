import { vec3 } from "gl-matrix";

class Triangle {
  a: vec3 = vec3.create();
  b: vec3 = vec3.create();
  c: vec3 = vec3.create();
}

export default Triangle;