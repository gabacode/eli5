import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { AudioAnalyzer } from "./Analyzer";
import { fragmentShader, vertexShader } from "./shaders";

const CustomShaderMaterial = shaderMaterial(
  {
    u_time: 0,
    u_frequency: 0,
    u_color: new THREE.Color(0.5, 0.8, 1.0),
  },
  vertexShader,
  fragmentShader
);

extend({ CustomShaderMaterial });

interface AudioVisualizerProps {
  analyzerRef: React.MutableRefObject<AudioAnalyzer | null>;
}

const Scene = ({ analyzerRef }: AudioVisualizerProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { camera } = useThree();
  const amplitudeRef = useRef(0);

  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    if (!analyzerRef.current) return;

    const checkData = () => {
      const analyzer = analyzerRef.current;
      if (!analyzer) return;

      analyzer.getAnalyzerNode().getByteFrequencyData(analyzer.dataArray);
      const avg = analyzer.getAverageFrequency();
      if (avg > 0) {
        amplitudeRef.current = avg;
      }
    };

    const interval = setInterval(checkData, 16);
    return () => clearInterval(interval);
  }, [analyzerRef]);

  useFrame(({ clock }) => {
    if (meshRef.current && materialRef.current && analyzerRef.current) {
      const uniforms = materialRef.current.uniforms;
      uniforms.u_time.value = clock.getElapsedTime();
      console.log("Current Amplitude:", amplitudeRef.current);
      uniforms.u_frequency.value = amplitudeRef.current;
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[4, 15]} />
      <customShaderMaterial
        ref={materialRef}
        wireframe
        transparent
        uniforms-u_time-value={0}
        uniforms-u_frequency-value={0}
        uniforms-u_color-value={new THREE.Color(0.5, 0.8, 1.0)}
      />
    </mesh>
  );
};

export const AudioVisualizer = ({ analyzerRef }: AudioVisualizerProps) => {
  const options = {
    antialias: true,
    outputColorSpace: THREE.SRGBColorSpace,
  };

  return (
    <div style={{ width: "100%", height: "400px", background: "transparent" }}>
      <Canvas camera={{ fov: 58, near: 0.1, far: 1000 }} gl={options}>
        <Scene analyzerRef={analyzerRef} />
      </Canvas>
    </div>
  );
};
