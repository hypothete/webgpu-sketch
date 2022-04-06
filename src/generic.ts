import { vec4 } from 'gl-matrix';
import { Document, bounds } from '@gltf-transform/core';

export const vec4Size = 4 * Float32Array.BYTES_PER_ELEMENT;

export interface SceneInfo {
  triangleData: Float32Array;
  meshData: Float32Array;
}

export function parseGLTFDocument(gltfDoc: Document): SceneInfo {
  const nodes = gltfDoc.getRoot().listNodes();
  const triRaw: number[] = [];
  const meshRaw: number[] = [];

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
        }
      }
    });

    const nodeBBox = bounds(node);
    meshRaw.push(...nodeBBox.min, 0, ...nodeBBox.max, nodeIndex);
  });

  return {
    triangleData: Float32Array.from(triRaw),
    meshData: Float32Array.from(meshRaw),
  };
}