// The reference's bend, driven by spin and scroll velocity, on a plane with
// enough segments for it to show. Hover lifts the card toward the viewer.
uniform float uBendH;
uniform float uBendV;
uniform float uTime;
uniform float uPhase;
uniform float uScale;
uniform float uHover;
varying vec2  vUv;
varying float vViewZ;

void main() {
  vUv = uv;
  vec3 pos = position;

  float xn = (uv.x - 0.5) * 2.0;
  float yn = (uv.y - 0.5) * 2.0;
  pos.z -= (1.0 - xn * xn) * uBendH;
  pos.z -= (1.0 - yn * yn) * uBendV;
  pos.z += sin(uv.y * 6.283 + uTime * 0.55 + uPhase)
         * sin(uv.x * 3.14  + uTime * 0.35 + uPhase * 1.3) * 0.012;

  pos.xy *= uScale;
  pos.z  += uHover * 0.38;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  vViewZ = -mvPos.z;
  gl_Position = projectionMatrix * mvPos;
}
