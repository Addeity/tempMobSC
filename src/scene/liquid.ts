/*
 * The footer band's liquid metal. Raw WebGL2, no three.js: two small passes.
 *
 *  1. A ripple field, the classic two-buffer wave: each step a cell becomes
 *     the average of its neighbours minus its own last height, a little
 *     damped. The pointer's path since the last frame presses into it, so a
 *     wake opens behind the pointer and keeps travelling after it stops.
 *  2. The surface: noise folded through noise and drifting slowly, plus the
 *     ripples, shaded as a mirror metal reflecting a dark studio (one long
 *     soft light overhead, a thin one to the side, a hot spot). Cool, a
 *     breath of the product's blue in it, never brighter than the type on it.
 *
 * Drawn at reduced resolution (the surface has no fine detail to lose) and
 * only while some of the band is in view; motion stops under reduced motion
 * or "Pause motion", leaving one still frame. One canvas, moved into
 * whichever panel's footer is showing.
 */
import { gsap, reduceMotion } from '../lib/motion.ts';
import { store } from '../lib/store.ts';

const QUAD_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;

const RIPPLE_FS = `#version 300 es
precision highp float;
uniform sampler2D uPrev;   // r: height now, g: height a step ago
uniform vec2 uTexel, uFrom, uTo;
uniform float uForce, uRadius, uAspect;
in vec2 vUv;
out vec4 o;
void main() {
  vec2 s = texture(uPrev, vUv).rg;
  float around = texture(uPrev, vUv + vec2(uTexel.x, 0.)).r + texture(uPrev, vUv - vec2(uTexel.x, 0.)).r
               + texture(uPrev, vUv + vec2(0., uTexel.y)).r + texture(uPrev, vUv - vec2(0., uTexel.y)).r;
  float h = (around * .5 - s.g) * .972;
  // the stretch the pointer covered since the last step, as a capsule
  vec2 k = vec2(uAspect, 1.);
  vec2 a = (vUv - uFrom) * k, b = (uTo - uFrom) * k;
  float d = length(a - b * clamp(dot(a, b) / max(dot(b, b), 1e-6), 0., 1.));
  h += uForce * (1. - smoothstep(0., uRadius, d));
  o = vec4(clamp(h, -1.5, 1.5), s.r, 0., 1.);
}`;

const SURFACE_FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime, uWaveAmt;
uniform sampler2D uWave;
in vec2 vUv;
out vec4 o;

// an integer hash: exact, so neighbouring cells always agree on the corner they
// share (a float one can round differently on each side and tear the noise along the grid)
float hash(vec2 p) {
  uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n) * (1. / 4294967295.);
}
// value noise with a quintic fade: on a mirror, the cubic one's creases show as cracks
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = mat2(1.6, -1.2, 1.2, 1.6) * p + 9.2; a *= .42; }
  return v;
}
// noise folded through noise, drifting: large slow shapes, like smoke poured as metal
float surface(vec2 p, float t) {
  vec2 q = vec2(fbm(p + vec2(0., t * .09)), fbm(p + vec2(4.7, -1.3) - t * .07));
  return fbm(p + q * 1.7 + vec2(-t * .05, t * .02));
}
// a dark studio for the metal to reflect. Every light is broad and soft: a
// narrow one draws thin bright contour lines across a bumpy mirror
vec3 studio(vec3 r) {
  float l = .018 + .06 * smoothstep(-.3, 1., r.y);
  l += (1. - smoothstep(0., .42, abs(r.y - .42))) * (1. - smoothstep(.15, 1.2, abs(r.x - .1))) * .9;
  l += (1. - smoothstep(0., .3, abs(r.x + .5))) * smoothstep(-.2, .8, r.y) * .28;
  l += pow(max(dot(r, normalize(vec3(.38, .52, .76))), 0.), 24.) * 1.15;
  return vec3(l);
}
void main() {
  float aspect = uRes.x / uRes.y;
  const float zoom = .8;
  vec2 p = (vUv - .5) * vec2(aspect, 1.) * zoom;
  const float e = .012;
  vec2 step = vec2(e / (aspect * zoom), e / zoom);
  vec3 w = vec3(texture(uWave, vUv).r, texture(uWave, vUv + vec2(step.x, 0.)).r, texture(uWave, vUv + vec2(0., step.y)).r) * uWaveAmt;
  float h = surface(p, uTime) + w.x;
  float hx = surface(p + vec2(e, 0.), uTime) + w.y;
  float hy = surface(p + vec2(0., e), uTime) + w.z;
  vec3 n = normalize(vec3((h - hx) / e * .5, (h - hy) / e * .5, 1.));
  vec3 col = studio(reflect(vec3(0., 0., -1.), n));
  col += pow(1. - n.z, 3.) * .12;                               // edges catch the light
  col *= mix(.5, 1., smoothstep(.25, .75, h));                   // valleys fall into shadow
  col *= vec3(.86, .91, 1.06);                                   // cool, a breath of the product's blue
  col *= mix(.4, 1., 1. - smoothstep(.3, 1.35, length((vUv - .5) * vec2(aspect * .7, 1.))));
  col *= mix(.3, 1., smoothstep(.02, .2, vUv.y));                // the bottom edge, under the small print, kept dim
  // a soft ceiling: the darks and mids as they were, the brightest of the metal held below
  // mid-grey, so the band's white type keeps its contrast over any part of it (WCAG AA)
  col = .47 * (1. - exp(-col / .47));
  col += (hash(floor(gl_FragCoord.xy) + floor(fract(uTime) * 61.)) - .5) / 255.;  // dither, against banding
  o = vec4(col, 1.);
}`;

interface Target { tex: WebGLTexture; fbo: WebGLFramebuffer }

export class Liquid {
  private host: HTMLElement | null = null;
  private running = false;
  private time = 7.3;
  private scale = 0.5;
  private frameMs = 16;
  private still = false;
  private waves: Target[] = [];
  private simW = 0;
  private simH = 0;
  private wavesOn = false;
  private pointer = { x: -1, y: -1, sx: -1, sy: -1, lastX: -1, lastY: -1, moved: 0, inside: false };
  private frames = 0;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();

  private constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly ripple: WebGLProgram,
    private readonly surface: WebGLProgram,
  ) {
    canvas.className = 'rfoot__gl';
    canvas.setAttribute('aria-hidden', 'true');
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    for (const p of [ripple, surface]) {
      const loc = gl.getAttribLocation(p, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    // the ripples need a float target; without one the surface still flows, it just cannot be touched
    this.wavesOn = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    addEventListener('pointermove', (e) => { this.pointer.x = e.clientX; this.pointer.y = e.clientY; this.pointer.moved = performance.now(); }, { passive: true });
    this.canvas.addEventListener('webglcontextlost', () => { this.run(false); this.canvas.remove(); });
  }

  /** null where WebGL2 or the shaders are unavailable: the band stays plain black */
  static create(): Liquid | null {
    const probe = document.createElement('canvas');  // the canvas the band will show
    const gl = probe.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const program = (fs: string) => {
      const p = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, QUAD_VS], [gl.FRAGMENT_SHADER, fs]] as const) {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    };
    const ripple = program(RIPPLE_FS);
    const surface = program(SURFACE_FS);
    if (!ripple || !surface) return null;
    return new Liquid(probe, gl, ripple, surface);
  }

  private u(program: WebGLProgram, name: string): WebGLUniformLocation | null {
    const key = `${program === this.ripple ? 'r' : 's'}:${name}`;
    if (!this.uniforms.has(key)) this.uniforms.set(key, this.gl.getUniformLocation(program, name));
    return this.uniforms.get(key)!;
  }

  /** move into this footer, sized to it */
  attach(host: HTMLElement): void {
    if (this.host !== host) {
      this.host = host;
      host.prepend(this.canvas);
      this.canvas.classList.remove('is-on');
      this.still = false;
    }
    this.resize();
  }

  run(on: boolean): void {
    if (on === this.running) return;
    this.running = on;
    if (on) gsap.ticker.add(this.tick);
    else gsap.ticker.remove(this.tick);
  }

  private resize(): void {
    if (!this.host) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2) * this.scale;
    const cw = Math.max(1, Math.round(w * dpr)), ch = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.still = false;
    }
    // the ripple field: 256 wide, as tall as the band's shape asks
    const sw = 256, sh = Math.max(48, Math.round(256 * h / Math.max(w, 1)));
    if (this.wavesOn && (sw !== this.simW || sh !== this.simH)) this.makeWaves(sw, sh);
  }

  private makeWaves(w: number, h: number): void {
    const gl = this.gl;
    for (const t of this.waves) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
    this.waves = [0, 1].map(() => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, w, h, 0, gl.RG, gl.HALF_FLOAT, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]] as const) gl.texParameteri(gl.TEXTURE_2D, k, v);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this.wavesOn = false;
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fbo };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.simW = w;
    this.simH = h;
  }

  private tick = (_t: number, deltaMs: number): void => {
    if (!this.host) return;
    const gl = this.gl;
    const dt = Math.min(deltaMs / 1000, 0.05);
    const calm = reduceMotion || store.get().motionPaused;
    const rect = this.host.getBoundingClientRect();
    const p = this.pointer;
    const touched = !reduceMotion && performance.now() - p.moved < 1600;
    // held still and untouched, one frame is enough
    if (calm && !touched && this.still) return;

    this.tuneResolution(deltaMs);
    if (!calm) this.time += dt * 0.32;

    if (this.wavesOn && this.waves.length) {
      // the pointer, in the band's own 0..1 (y up), followed a little behind
      const ux = (p.x - rect.left) / rect.width, uy = 1 - (p.y - rect.top) / rect.height;
      const k = 1 - Math.exp(-15 * dt);
      const inside = ux > -0.05 && ux < 1.05 && uy > -0.05 && uy < 1.05;
      // a pointer arriving from elsewhere starts its wake where it enters, not
      // as a streak from wherever it was last seen
      if (inside && !p.inside) { p.sx = ux; p.sy = uy; }
      p.inside = inside;
      p.lastX = p.sx; p.lastY = p.sy;
      p.sx += (ux - p.sx) * k;
      p.sy += (uy - p.sy) * k;
      const aspect = rect.width / Math.max(rect.height, 1);
      const speed = Math.hypot((p.sx - p.lastX) * aspect, p.sy - p.lastY) / Math.max(dt, 1e-3);
      const force = reduceMotion || !inside ? 0 : Math.min(speed * 0.05, 0.22);

      const [read, write] = this.waves as [Target, Target];
      gl.useProgram(this.ripple);
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
      gl.viewport(0, 0, this.simW, this.simH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, read.tex);
      gl.uniform1i(this.u(this.ripple, 'uPrev'), 0);
      gl.uniform2f(this.u(this.ripple, 'uTexel'), 1 / this.simW, 1 / this.simH);
      gl.uniform2f(this.u(this.ripple, 'uFrom'), p.lastX, p.lastY);
      gl.uniform2f(this.u(this.ripple, 'uTo'), p.sx, p.sy);
      gl.uniform1f(this.u(this.ripple, 'uForce'), force);
      gl.uniform1f(this.u(this.ripple, 'uRadius'), 0.02);
      gl.uniform1f(this.u(this.ripple, 'uAspect'), aspect);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.waves = [write, read];
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.surface);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.waves[0]?.tex ?? null);
    gl.uniform1i(this.u(this.surface, 'uWave'), 0);
    gl.uniform1f(this.u(this.surface, 'uWaveAmt'), this.wavesOn ? 0.16 : 0);
    gl.uniform2f(this.u(this.surface, 'uRes'), this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u(this.surface, 'uTime'), this.time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (!this.still) this.canvas.classList.add('is-on');
    this.still = true;
  };

  /* a phone that cannot keep up gets fewer pixels, not a stutter: checked
     once a second, a step down when frames run long, back up when calm */
  private tuneResolution(deltaMs: number): void {
    if (deltaMs > 250) return;
    this.frameMs += (deltaMs - this.frameMs) * 0.05;
    if (++this.frames % 60) return;
    const next = this.frameMs > 26 ? Math.max(0.3, this.scale - 0.1) : this.frameMs < 17.5 ? Math.min(0.5, this.scale + 0.1) : this.scale;
    if (next !== this.scale) { this.scale = next; this.resize(); }
  }
}
