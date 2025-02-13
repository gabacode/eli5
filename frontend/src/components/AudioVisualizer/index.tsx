import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { shaderMaterial, OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { AudioAnalyzer } from "./Analyzer";
import vertexShader from "./shaders/vertexShader.glsl?raw";
import fragmentShader from "./shaders/fragmentShader.glsl?raw";

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
      if (amplitudeRef.current > 0.1) {
        uniforms.u_frequency.value = amplitudeRef.current * 1.5;
      } else {
        uniforms.u_frequency.value = 0;
      }
      meshRef.current.rotation.y += 0.0001;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />

      <mesh ref={meshRef}>
        <icosahedronGeometry args={[4, 15]} />
        <customShaderMaterial
          ref={materialRef}
          wireframe
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
};

export const AudioVisualizer = ({ analyzerRef }: AudioVisualizerProps) => {
  const options = {
    antialias: true, // Enable antialiasing for smoother edges
    powerPreference: "high-performance",
    outputColorSpace: THREE.SRGBColorSpace,
  };

  return (
    <div style={{ width: "100%", height: "400px", background: "transparent" }}>
      <Canvas
        camera={{ fov: 58, near: 0.1, far: 1000 }}
        gl={options}
        shadows // Enable shadow mapping
      >
        <Scene analyzerRef={analyzerRef} />
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
};
