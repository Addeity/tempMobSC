import { Color, DoubleSide, ShaderMaterial, type Texture, type Vector4 } from 'three';
import { FACE, SCREEN } from './faces.ts';
import fragmentShader from './shaders/card.frag.glsl?raw';
import vertexShader from './shaders/card.vert.glsl?raw';

const f = (n: number) => n.toFixed(1);
const RIM = new Color(0x5098f8);

export interface CardUniforms {
  face: Texture;
  video: Texture | null;
  cell: Vector4;
  depthNear: number;
  depthFar: number;
  depthColor: Color;
}

export function createCardMaterial(u: CardUniforms): ShaderMaterial {
  return new ShaderMaterial({
    defines: {
      FACE_W: f(FACE.width), FACE_H: f(FACE.height),
      SCREEN_X: f(SCREEN.x), SCREEN_Y: f(SCREEN.y), SCREEN_W: f(SCREEN.width), SCREEN_H: f(SCREEN.height),
    },
    uniforms: {
      uFace: { value: u.face },
      uVideo: { value: u.video },
      uCell: { value: u.cell },
      uVideoMix: { value: 0 },
      uPoster: { value: null },
      uPosterMix: { value: 0 },
      uPosterAspect: { value: 16 / 9 },
      uOpacity: { value: 0 },
      uBlur: { value: 0.02 },
      uHover: { value: 0 },
      uDim: { value: 0 },
      uDepthNear: { value: u.depthNear },
      uDepthFar: { value: u.depthFar },
      uDepthColor: { value: u.depthColor },
      uDepthStrength: { value: 0.58 },
      uRim: { value: RIM },
      uBendH: { value: 0 },
      uBendV: { value: 0 },
      uTime: { value: 0 },
      uPhase: { value: Math.random() * Math.PI * 2 },
      uScale: { value: 1 },
    },
    vertexShader,
    fragmentShader,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}
