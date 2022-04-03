import { Accessor } from '@gltf-transform/core';

export const vec4Size = 4 * Float32Array.BYTES_PER_ELEMENT;

export function makeVec4ArrayFromAccessor(input: Accessor): Float32Array {
  const output: number[] = [];

  for (let i = 0; i < input.getCount(); i+= 1) {
    output.push(...input.getElement(i, []), 0);
  }
  return Float32Array.from(output);
}