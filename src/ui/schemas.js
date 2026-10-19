import { ENVIRONMENTS } from '../viewer/environments.js';

/** Param schemas for the fixed sections of the design state (see core/defaults.js). */
const r = (label, min, max, step, extra = {}) => ({ type: 'range', label, min, max, step, ...extra });
const c = (label, extra = {}) => ({ type: 'color', label, ...extra });
const b = (label, extra = {}) => ({ type: 'bool', label, ...extra });

export const SIZE_SCHEMA = {
  x: r('Width (X)', 0.2, 3, 0.01),
  y: r('Height (Y)', 0.2, 3, 0.01),
  z: r('Depth (Z)', 0.2, 3, 0.01),
  scale: r('Overall scale', 0.1, 5, 0.01, { hint: '1 = one metre in Unity / Blender' }),
};

export const SHADING_SCHEMA = {
  shading: { type: 'select', label: 'Shading', options: [{ value: 'auto', label: 'Auto' }, { value: 'flat', label: 'Flat / faceted' }, { value: 'smooth', label: 'Smooth' }] },
};

export const MATERIAL_SCHEMAS = {
  base: {
    color: c('Base colour / tint'),
    metalness: r('Metalness', 0, 1, 0.01),
    roughness: r('Roughness', 0, 1, 0.01),
    opacity: r('Opacity', 0, 1, 0.01),
    envMapIntensity: r('Reflection strength', 0, 3, 0.01),
  },
  glass: {
    transmission: r('Transmission (glass)', 0, 1, 0.01),
    ior: r('Index of refraction', 1, 2.5, 0.01, { hint: 'Water 1.33, glass 1.5, diamond 2.42' }),
    thickness: r('Thickness', 0, 3, 0.01),
    dispersion: r('Dispersion (rainbow)', 0, 10, 0.1),
    attenuationColor: c('Absorption colour'),
    attenuationDistance: r('Absorption distance', 0.05, 5, 0.01),
  },
  coats: {
    clearcoat: r('Clearcoat', 0, 1, 0.01),
    clearcoatRoughness: r('Clearcoat roughness', 0, 1, 0.01),
    iridescence: r('Iridescence (soap/pearl)', 0, 1, 0.01),
    iridescenceIOR: r('Iridescence IOR', 1, 2.3, 0.01),
    sheen: r('Sheen (velvet)', 0, 1, 0.01),
    sheenColor: c('Sheen colour'),
    specularIntensity: r('Specular', 0, 1, 0.01),
  },
  flags: {
    doubleSided: b('Double sided'),
    wireframe: b('Wireframe'),
  },
};

export const GLOW_SCHEMA = {
  color: c('Glow colour'),
  intensity: r('Glow intensity', 0, 10, 0.01, { hint: 'Above ~1 triggers bloom' }),
};

export const GROUT_SCHEMA = {
  color: c('Grout colour'),
  roughness: r('Roughness', 0, 1, 0.01),
  metalness: r('Metalness', 0, 1, 0.01),
  glowColor: c('Grout glow colour'),
  glow: r('Grout glow', 0, 10, 0.01, { hint: 'Glowing cracks between tiles (lava!)' }),
};

export const SURFACE_SCHEMA = {
  ramp: { type: 'select', label: 'Colour ramp', options: [{ value: '3', label: '3 colours' }, { value: '2', label: '2 colours (1 → 3)' }, { value: 'rainbow', label: 'Rainbow' }] },
  resolution: { type: 'select', label: 'Texture resolution', options: [64, 128, 256, 512, 1024].map((v) => ({ value: v, label: `${v} px` })) },
  pixelate: { type: 'select', label: 'Pixelate', options: [{ value: 0, label: 'Off (smooth)' }, ...[4, 8, 16, 32, 64].map((v) => ({ value: v, label: `${v} × ${v} pixels` }))] },
  scale: r('Texture tiling', 0.25, 8, 0.25),
  contrast: r('Contrast', 0.2, 3, 0.01),
  invert: b('Invert'),
  normalStrength: r('Bumpiness', 0, 6, 0.05),
  emissiveMode: {
    type: 'select',
    label: 'Glow source',
    options: [{ value: 'none', label: 'Whole surface' }, { value: 'mask', label: 'Pattern mask (glow colour)' }, { value: 'color', label: 'Pattern colours glow' }],
  },
};

export const ANIMATION_SCHEMA = {
  spinY: r('Spin (Y)', -4, 4, 0.01),
  spinX: r('Tumble (X)', -4, 4, 0.01),
  wobble: r('Wobble', 0, 1, 0.01),
  bobAmplitude: r('Bob height', 0, 0.4, 0.005),
  bobSpeed: r('Bob speed', 0, 4, 0.01),
  pulseScale: r('Size pulse', 0, 0.3, 0.005),
  pulseSpeed: r('Pulse speed', 0, 6, 0.01),
  glowPulse: r('Glow pulse', 0, 1, 0.01),
  glowPulseSpeed: r('Glow pulse speed', 0, 6, 0.01),
  flicker: r('Glow flicker', 0, 1, 0.01),
  scrollU: r('Texture scroll U', -1, 1, 0.005),
  scrollV: r('Texture scroll V', -1, 1, 0.005),
};

export const CLICKER_SCHEMA = {
  enabled: b('Click feedback'),
  squash: r('Squash amount', 0, 0.5, 0.005),
  burstCount: { type: 'int', label: 'Burst particles', min: 0, max: 300 },
  counter: b('Show click counter'),
  floatText: { type: 'text', label: 'Floating text' },
};

export const POST_SCHEMA = {
  bloom: b('Bloom'),
  bloomStrength: r('Bloom strength', 0, 3, 0.01, { showIf: (p) => p.bloom }),
  bloomRadius: r('Bloom radius', 0, 1, 0.01, { showIf: (p) => p.bloom }),
  bloomThreshold: r('Bloom threshold', 0, 1.5, 0.01, { showIf: (p) => p.bloom }),
  pixelate: { type: 'int', label: 'Pixelate view (0 = off)', min: 0, max: 12 },
};

export const SCENE_SCHEMA = {
  bgStyle: { type: 'select', label: 'Background', options: [{ value: 'gradient', label: 'Gradient' }, { value: 'solid', label: 'Solid' }, { value: 'transparent', label: 'Transparent' }] },
  bgTop: c('Top colour', { showIf: (p) => p.bgStyle === 'gradient' }),
  bgBottom: c('Bottom / solid colour', { showIf: (p) => p.bgStyle !== 'transparent' }),
  environment: { type: 'select', label: 'Reflections', options: Object.entries(ENVIRONMENTS).map(([value, e]) => ({ value, label: e.label })) },
  envIntensity: r('Reflection intensity', 0, 3, 0.01),
  exposure: r('Exposure', 0.1, 3, 0.01),
  keyLight: r('Key light', 0, 8, 0.01),
  keyColor: c('Key light colour'),
  rimLight: r('Rim light', 0, 8, 0.01),
  rimColor: c('Rim light colour'),
  ambient: r('Ambient', 0, 2, 0.01),
  ground: b('Ground shadow'),
  shadowOpacity: r('Shadow darkness', 0, 1, 0.01, { showIf: (p) => p.ground }),
  grid: b('Grid'),
  autoRotate: b('Auto-rotate camera'),
};
