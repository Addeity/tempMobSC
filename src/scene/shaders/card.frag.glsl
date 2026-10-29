// The rounded card, the rounded screen inside it, the workflow's cell of the
// atlas in that screen (or, on the card coming forward to be handed to the
// page, the still the page's copy of it shows), a depth grade, and the rim.
// FACE_* and SCREEN_* come in as defines from cardMaterial.ts, so the shader
// and the canvas faces share one set of numbers.
uniform sampler2D uFace;
uniform sampler2D uVideo;
uniform vec4  uCell;
uniform float uVideoMix;
uniform sampler2D uPoster;
uniform float uPosterMix;
uniform float uPosterAspect;
uniform float uOpacity;
uniform float uBlur;
uniform float uHover;
uniform float uDim;
uniform float uDepthNear;
uniform float uDepthFar;
uniform vec3  uDepthColor;
uniform float uDepthStrength;
uniform vec3  uRim;
varying vec2  vUv;
varying float vViewZ;

const vec2 FACE   = vec2(FACE_W, FACE_H);
const vec4 SCREEN = vec4(SCREEN_X, SCREEN_Y, SCREEN_W, SCREEN_H);

vec3 linearToSRGB(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec4 sampleBlurred(sampler2D tex, vec2 uv, float blur) {
  if (blur <= 0.0005) return texture2D(tex, uv);
  vec4 acc  = texture2D(tex, uv) * 0.25;
  acc      += texture2D(tex, uv + vec2( blur, 0.0))   * 0.125;
  acc      += texture2D(tex, uv + vec2(-blur, 0.0))   * 0.125;
  acc      += texture2D(tex, uv + vec2(0.0,   blur))  * 0.125;
  acc      += texture2D(tex, uv + vec2(0.0,  -blur))  * 0.125;
  acc      += texture2D(tex, uv + vec2( blur,  blur)) * 0.0625;
  acc      += texture2D(tex, uv + vec2(-blur,  blur)) * 0.0625;
  acc      += texture2D(tex, uv + vec2( blur, -blur)) * 0.0625;
  acc      += texture2D(tex, uv + vec2(-blur, -blur)) * 0.0625;
  return acc;
}

void main() {
  vec2 uv = vUv;
  // from behind, read the right way round rather than mirrored
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  vec2 p = vec2(uv.x, 1.0 - uv.y) * FACE;   // face pixels, y down

  float dCard = sdRound(p - FACE * 0.5, FACE * 0.5, 26.0);
  float aa    = max(fwidth(dCard), 0.0001);
  float cardA = 1.0 - smoothstep(-aa, aa, dCard);
  if (cardA <= 0.0) discard;

  vec3 col = sampleBlurred(uFace, uv, uBlur).rgb;

  vec2  sc   = SCREEN.xy + SCREEN.zw * 0.5;
  float dScr = sdRound(p - sc, SCREEN.zw * 0.5, 12.0);
  float aS   = max(fwidth(dScr), 0.0001);
  float scr = 1.0 - smoothstep(-aS, aS, dScr);
  vec2 s = (p - SCREEN.xy) / SCREEN.zw;
  s.y = 1.0 - s.y;
  float inScr = scr * uVideoMix;
  if (inScr > 0.0) {
    // three stores video as plain RGBA8 and decodes it only in its own
    // materials, so the frame arrives sRGB-encoded: decode it here
    vec3 v = pow(texture2D(uVideo, uCell.xy + clamp(s, 0.0, 1.0) * uCell.zw).rgb, vec3(2.2));
    float r = length((s - 0.5) * vec2(1.0, 0.82));
    v *= mix(1.0, 0.86, smoothstep(0.32, 0.78, r));
    col = mix(col, v, inScr);
  }
  // the still, cut to cover the screen from its middle, as the page's copy is
  // (an upright phone's is taller than the screen), and as plain as that copy
  float inPoster = scr * uPosterMix;
  if (inPoster > 0.0) {
    vec2 q = clamp(s, 0.0, 1.0) - 0.5;
    float k = (SCREEN.z / SCREEN.w) / uPosterAspect;
    if (k > 1.0) q.y /= k; else q.x *= k;
    col = mix(col, pow(texture2D(uPoster, q + 0.5).rgb, vec3(2.2)), inPoster);
  }

  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, 0.84 + 0.16 * max(uHover, uPosterMix));   // full colour on hover, and handed over
  col *= (1.0 - uDim * 0.42) * (1.0 + uHover * 0.05);   // the rest step back

  float depthT = smoothstep(uDepthNear, uDepthFar, vViewZ);
  col = mix(col, uDepthColor, depthT * uDepthStrength);

  // the rim: a hairline at rest, cobalt and a touch wider under the pointer
  float rimW = 1.4 + uHover * 1.4;
  float rim  = 1.0 - smoothstep(rimW - aa, rimW + aa, -dCard);
  col = mix(col, mix(vec3(0.050, 0.060, 0.085), uRim, uHover), rim * (1.0 - depthT * 0.6));

  gl_FragColor = vec4(linearToSRGB(col), cardA * uOpacity);
}
