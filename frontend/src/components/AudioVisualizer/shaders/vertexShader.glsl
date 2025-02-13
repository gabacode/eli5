 uniform float u_time;
 uniform float u_frequency;
 varying vec2 vUv;
 varying float vDisplacement;
 
 void main() {
   vUv = uv;
   vec3 newPosition = position;
   
   // Moderate displacement effect
   float displacement = sin(newPosition.x * 2.0 + u_time) * sin(newPosition.y * 2.0 + u_time) * u_frequency;
   
   // Moderate secondary movement
   displacement += u_frequency * 1.5 * sin(newPosition.x * 2.5 + u_time * 1.8);
   
   vDisplacement = displacement;
   newPosition += normal * displacement;
   
   vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
   vec4 viewPosition = viewMatrix * modelPosition;
   vec4 projectedPosition = projectionMatrix * viewPosition;
   gl_Position = projectedPosition;
 }