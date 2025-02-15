import { useFrame, useThree } from "@react-three/fiber";
import { MutableRefObject, useEffect, useRef } from "react";
import * as THREE from "three";
import { AudioAnalyzer } from "./Analyzer";

interface SceneProps {
  analyzerRef: MutableRefObject<AudioAnalyzer | null>;
  colorStart: THREE.Color | string;
  colorEnd: THREE.Color | string;
  multiplier: number;
}

export const Scene = ({
  analyzerRef,
  colorStart,
  colorEnd,
  multiplier,
}: SceneProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const { camera } = useThree();
  const amplitudeRef = useRef(0);

  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    if (!analyzerRef.current) return;

    const updateAudioData = () => {
      const analyzer = analyzerRef.current;
      if (!analyzer) return;

      analyzer.getAnalyzerNode().getByteFrequencyData(analyzer.dataArray);
      const avg = analyzer.getAverageFrequency();
      amplitudeRef.current = avg > 0 ? avg : 0;
    };

    const interval = setInterval(updateAudioData, 16);
    return () => clearInterval(interval);
  }, [analyzerRef]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current) return;

    const uniforms = materialRef.current.uniforms;
    uniforms.u_time.value = clock.getElapsedTime();

    uniforms.u_frequency.value = THREE.MathUtils.lerp(
      uniforms.u_frequency.value,
      amplitudeRef.current > 0.1 ? amplitudeRef.current * 8 : 0,
      0.08 // Smoothing factor
    );
    const scaleFactor = 1.0 + Math.sin(clock.getElapsedTime() * 0.618) * 0.05;
    meshRef.current.scale.setScalar(scaleFactor);
    meshRef.current.rotation.y = 1.57;
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />

      <mesh ref={meshRef}>
        <icosahedronGeometry args={[4, 15]} />
        <customShaderMaterial
          ref={(el) => {
            if (el) {
              materialRef.current = el;
              el.uniforms.u_colorStart.value = new THREE.Color(colorStart);
              el.uniforms.u_colorEnd.value = new THREE.Color(colorEnd);
              el.uniforms.u_multiplier.value = multiplier;
            }
          }}
        />
      </mesh>
    </>
  );
};
