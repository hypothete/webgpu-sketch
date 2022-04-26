import { vec3, vec4 } from 'gl-matrix';
import { Document, bounds } from '@gltf-transform/core';

export const vec4Size = 4 * Float32Array.BYTES_PER_ELEMENT;

export class BVHTriangle {
  a: vec3 = vec3.create();
  b: vec3 = vec3.create();
  c: vec3 = vec3.create();

  min: vec3 = vec3.create();
  max: vec3 = vec3.create();

  constructor(a: vec3, b: vec3, c: vec3) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.getBounds();
  }

  getBounds() {
    vec3.min(this.min, vec3.min(this.min, this.a, this.b), this.c);
    vec3.max(this.max, vec3.max(this.max, this.a, this.b), this.c);
  }
}

export interface AABB {
  min: vec3;
  max: vec3;
}

export interface SceneInfo {
  triangleData: Float32Array;
  meshData: Float32Array;
  bvhTriangles: BVHTriangle[];
}

export function parseGLTFDocument(gltfDoc: Document): SceneInfo {
  const nodes = gltfDoc.getRoot().listNodes();
  const triRaw: number[] = [];
  const meshRaw: number[] = [];
  const bvhTriangles: BVHTriangle[] = [];

  nodes.forEach((node, nodeIndex) => {
    const meshTransform = node.getMatrix();
    const mesh = node.getMesh();
    if (!mesh) return;

    const primitives = mesh.listPrimitives();
    primitives.forEach(primitive => {
      const indices = primitive.getIndices();
      const positions = primitive.getAttribute('POSITION');
      if (indices && positions) {
        const indexArray = indices.getArray();
        if (!indexArray) return;
        // iterate over triangles & add to buffer
        for (let i = 0; i < indexArray.length; i+= 3) {
          const aPosition = vec4.fromValues(...positions.getElement(indexArray[i + 0], []) as [number, number, number], 1);
          const bPosition = vec4.fromValues(...positions.getElement(indexArray[i + 1], []) as [number, number, number], 1);
          const cPosition = vec4.fromValues(...positions.getElement(indexArray[i + 2], []) as [number, number, number], 1);
          vec4.transformMat4(aPosition, aPosition, meshTransform);
          vec4.transformMat4(bPosition, bPosition, meshTransform);
          vec4.transformMat4(cPosition, cPosition, meshTransform);
          const triangleData = [...aPosition, ...bPosition, ...cPosition];
          triangleData[11] = nodeIndex;
          triRaw.push(...triangleData);
          bvhTriangles.push(new BVHTriangle(
            vec3.fromValues(...aPosition.slice(0, 3) as [number, number, number]),
            vec3.fromValues(...bPosition.slice(0, 3) as [number, number, number]),
            vec3.fromValues(...cPosition.slice(0, 3) as [number, number, number]),
          ));
        }
      }
    });

    const nodeBBox = bounds(node);
    meshRaw.push(...nodeBBox.min, 0, ...nodeBBox.max, nodeIndex);
  });

  return {
    triangleData: Float32Array.from(triRaw),
    meshData: Float32Array.from(meshRaw),
    bvhTriangles
  };
}

interface BVHNode {
  children: (BVHNode | BVHTriangle)[]
}

interface BVH {
  root: BVHNode
}

function getBoundsOfTriangles (triangles: BVHTriangle[]): AABB {
  return triangles.reduce((acc, item) => {
    vec3.min(acc.min, acc.min, item.min);
    vec3.max(acc.max, acc.max, item.max);
    return acc;
  }, { 
    min: vec3.fromValues(Infinity, Infinity, Infinity),
    max: vec3.fromValues(-Infinity, -Infinity, -Infinity)
  } as AABB);
}

export function makeBVH (sceneInfo: SceneInfo): BVH {

}