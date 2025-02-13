// src/globals.d.ts

import { ShaderMaterial } from "three";
import { ReactThreeFiber } from "@react-three/fiber";
import { Color } from "three";

declare module "*.glsl" {
  const file: string;
  export default file;
}

declare module "@react-three/fiber" {
  interface ThreeElements {
    customShaderMaterial: ReactThreeFiber.Object3DNode<
      ShaderMaterial,
      typeof ShaderMaterial
    > & {
      wireframe?: boolean;
      transparent?: boolean;
      "uniforms-u_time-value"?: number;
      "uniforms-u_frequency-value"?: number;
      "uniforms-u_color-value"?: Color;
    };
  }
}
