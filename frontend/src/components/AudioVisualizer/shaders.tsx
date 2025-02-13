export const vertexShader = `
  uniform float u_time;
  uniform float u_frequency;
  
  varying vec2 vUv;
  varying float vDisplacement;
  
  void main() {
    vUv = uv;
    
    vec3 newPosition = position;
    // Amplify the displacement effect
    float displacement = sin(newPosition.x * 2.0 + u_time) * 
                        sin(newPosition.y * 2.0 + u_time) * 
                        (u_frequency * 5.0); // Increased multiplier
    
    // Add more dramatic movement
    displacement += u_frequency * 2.0 * sin(newPosition.x * 3.0 + u_time * 2.0);
    
    vDisplacement = displacement;
    newPosition += normal * displacement;
    
    vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;
  }
`;

export const fragmentShader = `
  uniform float u_time;
  uniform float u_frequency;
  uniform vec3 u_color;
  
  varying vec2 vUv;
  varying float vDisplacement;
  
  void main() {
    vec3 color = u_color;
    
    // Amplify color response
    color *= (1.0 + vDisplacement * 4.0);
    
    // Enhanced pulsing
    float pulse = 0.5 + 0.5 * sin(u_time * 0.5);
    color *= mix(1.0, u_frequency * 4.0, pulse);
    
    // Increased brightness variation
    float brightness = 1.0 + u_frequency * 3.0;
    color *= brightness;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;
