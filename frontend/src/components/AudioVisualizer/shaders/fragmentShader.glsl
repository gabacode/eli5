 uniform float u_time;
 uniform float u_frequency;
 uniform vec3 u_color;
 varying vec2 vUv;
 varying float vDisplacement;
 
 void main() {
   vec3 color = u_color;
   
   // Moderate color response
   color *= (1.0 + vDisplacement * 3.0);
   
   // Moderate pulsing
   float pulse = 0.5 + 0.4 * sin(u_time * 0.5);
   color *= mix(1.0, u_frequency, pulse);
   
   // Moderate brightness variation
   float brightness = 1.0 + u_frequency;
   color *= brightness;
   
   gl_FragColor = vec4(color, 1.0);
 }