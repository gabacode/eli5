uniform float u_time;
uniform float u_frequency;
varying vec2 vUv;
varying float vDisplacement;

void main() {
  vUv = uv;
  vec3 newPosition = position;

  // Organic wave displacement using sin and time
  float baseDisplacement = sin(newPosition.x * 3.0 + u_time) * 
                           sin(newPosition.y * 3.0 + u_time) * u_frequency * 0.8;

  // Radial ripple effect expanding outward over time
  float radialEffect = sin(length(newPosition.xy) * 5.0 + u_time * 2.5) * 0.5;

  // Smooth out displacement for fluid motion
  baseDisplacement *= (0.9 + 0.2 * sin(newPosition.x * 2.5 + u_time * 1.2));

  // Introduce a slight noise-like variation
  float noise = sin(newPosition.x * 10.0 + u_time * 3.0) * 0.05;
  baseDisplacement += noise;

  // Apply displacement to the normal direction
  vDisplacement = baseDisplacement * radialEffect;
  newPosition += normal * vDisplacement;

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(newPosition, 1.0);
}
