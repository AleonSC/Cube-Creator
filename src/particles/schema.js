import { particleSprites } from '../registries.js';

/**
 * One generic, data-driven emitter powers every particle effect. Presets
 * (particles/presets.js) are just different values for these params, which
 * also map cleanly onto Unity's ParticleSystem and Blender particles.
 */
export const EMITTER_SCHEMA = {
  sprite: { type: 'select', label: 'Sprite', options: () => particleSprites.options(), default: 'soft' },
  rate: { type: 'range', label: 'Rate (per sec)', min: 0, max: 400, step: 1, default: 40 },
  lifetime: { type: 'range', label: 'Lifetime (s)', min: 0.1, max: 8, step: 0.05, default: 1.5 },
  lifetimeVar: { type: 'range', label: 'Lifetime variation', min: 0, max: 1, step: 0.01, default: 0.3 },
  emitFrom: {
    type: 'select',
    label: 'Emit from',
    options: [
      { value: 'surface', label: 'Cube surface' },
      { value: 'volume', label: 'Inside cube' },
      { value: 'top', label: 'Top face' },
      { value: 'bottom', label: 'Bottom face' },
      { value: 'sphere', label: 'Sphere shell' },
      { value: 'ring', label: 'Ring around' },
      { value: 'point', label: 'Centre point' },
      { value: 'above', label: 'Sky above (rain/snow)' },
    ],
    default: 'surface',
  },
  emitScale: { type: 'range', label: 'Emitter size', min: 0.1, max: 3, step: 0.01, default: 1 },
  direction: {
    type: 'select',
    label: 'Direction',
    options: [
      { value: 'up', label: 'Up' },
      { value: 'down', label: 'Down' },
      { value: 'outward', label: 'Outward' },
      { value: 'inward', label: 'Inward (implode)' },
      { value: 'random', label: 'Random' },
      { value: 'orbit', label: 'Orbit' },
      { value: 'swirlUp', label: 'Swirl upward' },
    ],
    default: 'up',
  },
  speed: { type: 'range', label: 'Speed', min: 0, max: 6, step: 0.01, default: 0.6 },
  speedVar: { type: 'range', label: 'Speed variation', min: 0, max: 1, step: 0.01, default: 0.4 },
  spread: { type: 'range', label: 'Spread', min: 0, max: 1, step: 0.01, default: 0.25 },
  gravity: { type: 'range', label: 'Gravity', min: -6, max: 12, step: 0.05, default: 0 },
  drag: { type: 'range', label: 'Drag', min: 0, max: 5, step: 0.05, default: 0.2 },
  turbulence: { type: 'range', label: 'Turbulence', min: 0, max: 6, step: 0.05, default: 0.3 },
  size: { type: 'range', label: 'Size', min: 0.005, max: 0.6, step: 0.005, default: 0.06 },
  sizeEnd: { type: 'range', label: 'End size ×', min: 0, max: 4, step: 0.01, default: 0.3 },
  colorMode: { type: 'select', label: 'Colour mode', options: [{ value: 'gradient', label: 'Start → End' }, { value: 'randomHue', label: 'Random rainbow' }], default: 'gradient' },
  colorStart: { type: 'color', label: 'Start colour', default: '#ffd27a', showIf: (p) => p.colorMode !== 'randomHue' },
  colorEnd: { type: 'color', label: 'End colour', default: '#ff3d00', showIf: (p) => p.colorMode !== 'randomHue' },
  brightness: { type: 'range', label: 'Brightness (glow)', min: 0.1, max: 8, step: 0.05, default: 2 },
  opacity: { type: 'range', label: 'Opacity', min: 0, max: 1, step: 0.01, default: 1 },
  fadeIn: { type: 'range', label: 'Fade in', min: 0, max: 0.5, step: 0.01, default: 0.05 },
  blending: { type: 'select', label: 'Blending', options: [{ value: 'additive', label: 'Additive (glowy)' }, { value: 'normal', label: 'Normal (solid)' }], default: 'additive' },
  twinkle: { type: 'range', label: 'Twinkle', min: 0, max: 1, step: 0.01, default: 0 },
  seed: { type: 'seed', label: 'Seed', default: 1 },
};
