import * as THREE from "three";
import { Canvas, extend } from "@react-three/fiber";
import { shaderMaterial, OrbitControls } from "@react-three/drei";
import { AudioAnalyzer } from "./Analyzer";
import vertexShader from "./shaders/vertexShader.glsl?raw";
import fragmentShader from "./shaders/fragmentShader.glsl?raw";
import { Scene } from "./Scene";

const CustomShaderMaterial = shaderMaterial(
  {
    u_time: 0,
    u_frequency: 0,
    u_colorStart: new THREE.Color(0.2, 0.4, 1.0),
    u_colorEnd: new THREE.Color(0.8, 0.2, 1.0),
    u_multiplier: 1.0,
  },
  vertexShader,
  fragmentShader
);

extend({ CustomShaderMaterial });

interface AudioVisualizerProps {
  analyzerRef: React.MutableRefObject<AudioAnalyzer | null>;
  colorStart: string;
  colorEnd: string;
  multiplier: number;
}

export const AudioVisualizer = ({
  analyzerRef,
  colorStart,
  colorEnd,
  multiplier,
}: AudioVisualizerProps) => {
  const options = {
    antialias: true,
    powerPreference: "high-performance",
    outputColorSpace: THREE.SRGBColorSpace,
  };

  return (
    <div style={{ width: "100%", height: "400px", background: "transparent" }}>
      <Canvas camera={{ fov: 58, near: 0.1, far: 1000 }} gl={options} shadows>
        <Scene
          analyzerRef={analyzerRef}
          colorStart={colorStart}
          colorEnd={colorEnd}
          multiplier={multiplier}
        />
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
};
