import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
import { useAudio } from "../../hooks";

interface ShaderMaterialUniforms {
  u_time: { value: number };
  u_frequency: { value: number };
  u_color: { value: THREE.Color };
}

export interface AudioAnalyzerInterface {
  getAnalyzerNode(): AnalyserNode;
  connectSource(source: AudioNode): void;
  getAverageFrequency(): number;
  cleanup(): void;
  dataArray: Uint8Array;
}

export class AudioAnalyzer implements AudioAnalyzerInterface {
  private analyzer: AnalyserNode;
  public dataArray: Uint8Array;

  constructor(context: AudioContext) {
    this.analyzer = context.createAnalyser();
    this.analyzer.fftSize = 256;
    this.analyzer.minDecibels = -90;
    this.analyzer.maxDecibels = -10;
    this.analyzer.smoothingTimeConstant = 0.85;
    this.dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    this.startMonitoring();
  }

  private startMonitoring() {
    const checkData = () => {
      this.analyzer.getByteFrequencyData(this.dataArray);
      const hasNonZero = this.dataArray.some((value) => value > 0);
      if (hasNonZero) {
        console.log("Monitoring analyzer:", {
          time: new Date().toISOString(),
          hasNonZeroData: hasNonZero,
          firstFewValues: Array.from(this.dataArray.slice(0, 5)),
          maxValue: Math.max(...Array.from(this.dataArray)),
        });
      }
    };
    setInterval(checkData, 500);
  }

  getAnalyzerNode(): AnalyserNode {
    return this.analyzer;
  }

  connectSource(source: AudioNode): void {
    source.connect(this.analyzer);
    console.log("Audio source connected to analyzer", {
      fftSize: this.analyzer.fftSize,
      frequencyBinCount: this.analyzer.frequencyBinCount,
      minDecibels: this.analyzer.minDecibels,
      maxDecibels: this.analyzer.maxDecibels,
    });
  }

  getAverageFrequency(): number {
    this.analyzer.getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    // Return raw average without scaling to maintain original behavior
    return sum / this.dataArray.length / 255;
  }

  cleanup(): void {
    try {
      this.analyzer.disconnect();
    } catch (error) {
      console.error("Error cleaning up analyzer:", error);
    }
  }
}

const vertexShader = `
  uniform float u_time;
  uniform float u_frequency;
  
  varying vec2 vUv;
  varying float vDisplacement;
  
  void main() {
    vUv = uv;
    
    vec3 newPosition = position;
    float displacement = sin(newPosition.x * 2.0 + u_time) * 
                        sin(newPosition.y * 2.0 + u_time) * 
                        (u_frequency * 1.5);
    
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
    vec3 color = u_color * (1.0 + vDisplacement * 2.0);
    
    float pulse = 0.5 + 0.5 * sin(u_time * 0.5);
    color *= mix(1.0, u_frequency * 2.0, pulse);
    
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

interface SceneProps {
  analyzer: AudioAnalyzer | null;
}

const Scene = ({ analyzer }: SceneProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame(({ clock }) => {
    if (meshRef.current && materialRef.current && analyzer) {
      const uniforms = materialRef.current
        .uniforms as unknown as ShaderMaterialUniforms;
      uniforms.u_time.value = clock.getElapsedTime();
      uniforms.u_frequency.value = analyzer.getAverageFrequency();

      // Basic rotation
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

export const AudioVisualizer = () => {
  const { analyzer } = useAudio({ wsRef: useRef<WebSocket | null>(null) });

  const options = {
    antialias: true,
    outputColorSpace: THREE.SRGBColorSpace,
  };

  return (
    <div style={{ width: "100%", height: "400px", background: "transparent" }}>
      <Canvas camera={{ fov: 58, near: 0.1, far: 1000 }} gl={options}>
        <Scene analyzer={analyzer} />
      </Canvas>
    </div>
  );
};
