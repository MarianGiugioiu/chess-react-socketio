export default /* glsl */ `
uniform float time; // Add time uniform
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

float sdSphere(vec3 p, float s) {
  return length(p) - s;
}

mat2 rot2D(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

vec3 rot3D(vec3 p, vec3 axis, float angle) {
  return mix(dot(axis, p) * axis, p, cos(angle)) * cross(axis, p) * sin(angle);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdOctahedron( vec3 p, float s)
{
p = abs(p);
return (p.x+p.y+p.z-s)*0.57735027;
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k * (1.0/ 6.0);
}

vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.263, 0.416, 0.557);
  return a + b * cos(6.28318 * (c * t + d));
}

float map(vec3 p) {
  p.z += time * .4;
  p.xy = fract(p.xy) - .5;
  p.z = mod(p.z, .25) - .125;
  float box = sdOctahedron(p, .15);
  
  return box;
}

void main() {
  vec2 uv = vUv * 3.0 - 1.5;
  vec2 m = vec2(cos(time*.2), sin(time*.2));
  vec3 ro = vec3(0, 0, -3);
  vec3 rd = normalize(vec3(uv, 1));
  vec3 col = vec3(0);
  float t = 0.0;
  
  int i;
  for (i = 0; i < 80; i++) {
      vec3 p = ro + rd * t;
      p.xy *= rot2D(t * .2 * m.x);
      p.y += sin(t*(m.y+1.)*.5) * .35;
      float d = map(p);
      t += d;
      if (d < 0.001 || t > 100.) break;
  }
  col = palette(t * 0.04 + float(i) * 0.005);
  
  gl_FragColor = vec4(col, 1.0);
}
`