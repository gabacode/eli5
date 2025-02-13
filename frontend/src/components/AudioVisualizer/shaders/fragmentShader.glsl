uniform float u_time;
uniform float u_frequency;
uniform vec3 u_colorStart;
uniform vec3 u_colorEnd;
uniform float u_multiplier;
varying float vDisplacement;

void main() {
  // Smooth gradient color transition based on displacement
  vec3 color = mix(u_colorStart, u_colorEnd, smoothstep(-0.3, 1.0, vDisplacement));

  // Pulsating glow effect based on time and displacement
  float pulse = 0.5 + 0.4 * sin(u_time * 1.5);
  float intensity = mix(1.0, u_frequency * 0.3 + 1.0, pulse) * u_multiplier;

  // Additional color banding effect for more visual depth
  float bands = sin(vDisplacement * 10.0 + u_time) * 0.05;
  color += bands;

  // Improved brightness control for a more dynamic feel
  float brightness = 1.0 + (u_frequency * 0.25);
  color *= brightness * intensity;

  // Soft glow effect using smoothstep and gamma correction
  gl_FragColor = vec4(pow(color, vec3(1.3)), 1.0);
}
