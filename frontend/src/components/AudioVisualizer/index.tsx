import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

interface ShaderMaterialUniforms {
  u_time: { value: number };
  u_frequency: { value: number };
  u_color: { value: THREE.Color };
}

class AudioAnalyzer {
  private context: AudioContext;
  private analyzer: AnalyserNode;
  private source?: MediaStreamAudioSourceNode;
  public dataArray: Uint8Array;

  constructor() {
    this.context = new AudioContext();
    this.analyzer = this.context.createAnalyser();
    this.analyzer.fftSize = 32;
    this.analyzer.minDecibels = -90;
    this.analyzer.maxDecibels = -10;
    this.analyzer.smoothingTimeConstant = 0.65;
    this.dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
  }

  async startMicrophoneInput() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.context.createMediaStreamSource(stream);
      this.source.connect(this.analyzer);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  }

  getAverageFrequency(): number {
    this.analyzer.getByteFrequencyData(this.dataArray);
    let sum = 0;
    const length = this.dataArray.length;
    for (let i = 0; i < length; i++) {
      sum += this.dataArray[i];
    }
    return Math.pow(sum / length / 255, 2) * 3;
  }

  cleanup() {
    if (this.source) {
      this.source.disconnect();
    }
    this.context.close();
  }
}

// Shaders
const vertexShader = `
  uniform float u_time;
  uniform float u_frequency;
  
  varying vec2 vUv;
  varying float vDisplacement;
  
  void main() {
    vUv = uv;
    
    // Amplified displacement based on audio frequency
    vec3 newPosition = position;
    float displacement = sin(newPosition.x * 2.0 + u_time) * 
                        sin(newPosition.y * 2.0 + u_time) * 
                        (u_frequency * 1.5); // Increased multiplier from 0.3 to 1.5
    
    // Add additional reactive displacement
    displacement += u_frequency * 0.5 * sin(newPosition.x * 3.0 + u_time * 2.0);
    
    vDisplacement = displacement;
    newPosition += normal * displacement;
    
    vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;
  }
`;

const fragmentShader = `
  uniform float u_time;
  uniform float u_frequency;
  uniform vec3 u_color;
  
  varying vec2 vUv;
  varying float vDisplacement;
  
  void main() {
    float distort = 0.1 * vDisplacement;
    vec3 color = u_color * (1.0 + vDisplacement * 2.0); // Amplified color response
    
    // Add pulsing based on frequency
    float pulse = 0.5 + 0.5 * sin(u_time * 0.5);
    color *= mix(1.0, u_frequency * 2.0, pulse); // More dramatic color pulsing
    
    // Add brightness variation based on frequency
    float brightness = 1.0 + u_frequency * 1.5;
    color *= brightness;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

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

const Scene = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [audioAnalyzer] = useState(() => new AudioAnalyzer());

  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    audioAnalyzer.startMicrophoneInput();
    return () => {
      audioAnalyzer.cleanup();
    };
  }, [camera, audioAnalyzer]);

  useFrame(({ clock }) => {
    if (meshRef.current && materialRef.current) {
      if (Math.floor(clock.getElapsedTime() * 60) % 2 === 0) {
        const uniforms = materialRef.current
          .uniforms as unknown as ShaderMaterialUniforms;
        uniforms.u_time.value = clock.getElapsedTime();
        uniforms.u_frequency.value = audioAnalyzer.getAverageFrequency();
      }
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <>
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
    </>
  );
};

export const AudioVisualizer = memo(() => {
  return (
    <div style={{ width: "100%", height: "400px", background: "transparent" }}>
      <Canvas
        camera={{ fov: 58, near: 0.1, far: 1000 }}
        gl={{
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
});
