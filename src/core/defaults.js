/**
 * The default design. Every saved design / preset is a (partial) object of
 * this shape. Bump `version` and add a migration in migrate() when changing it.
 */
export const STATE_VERSION = 1;

export const DEFAULT_STATE = {
  version: STATE_VERSION,
  name: 'My Clicker Cube',
  shape: { type: 'tessellated', params: {} }, // params keyed by shape id
  size: { x: 1, y: 1, z: 1, scale: 1 },
  shading: 'auto', // auto | flat | smooth
  modifiers: [], // [{ uid, type, enabled, params }]
  material: {
    color: '#ffffff',
    metalness: 0.1,
    roughness: 0.35,
    opacity: 1,
    transmission: 0,
    ior: 1.5,
    thickness: 0.6,
    dispersion: 0,
    attenuationColor: '#ffffff',
    attenuationDistance: 2,
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    iridescence: 0,
    iridescenceIOR: 1.3,
    sheen: 0,
    sheenColor: '#ffffff',
    specularIntensity: 1,
    envMapIntensity: 1,
    doubleSided: false,
    wireframe: false,
  },
  glow: { color: '#ffffff', intensity: 0 },
  grout: { color: '#15161c', glowColor: '#ff5a00', glow: 0, roughness: 0.8, metalness: 0 },
  surface: {
    pattern: 'none',
    params: {}, // keyed by pattern id
    colors: ['#1d2b64', '#4d7cff', '#cfe3ff'],
    ramp: '3', // '2' | '3' | 'rainbow'
    resolution: 256,
    pixelate: 0,
    scale: 1,
    normalStrength: 1,
    emissiveMode: 'mask', // none | mask | color
    contrast: 1,
    invert: false,
  },
  animation: {
    spinX: 0,
    spinY: 0.35,
    bobAmplitude: 0.04,
    bobSpeed: 1.2,
    pulseScale: 0,
    pulseSpeed: 1.5,
    glowPulse: 0,
    glowPulseSpeed: 1.5,
    flicker: 0,
    scrollU: 0,
    scrollV: 0,
    wobble: 0,
  },
  effects: [], // [{ uid, type, enabled, params }]
  particles: [], // [{ uid, type, enabled, params }]
  post: { bloom: true, bloomStrength: 0.55, bloomRadius: 0.45, bloomThreshold: 0.9, pixelate: 0 },
  scene: {
    bgStyle: 'gradient', // solid | gradient | transparent
    bgTop: '#1d2440',
    bgBottom: '#05060a',
    environment: 'studio',
    envIntensity: 1,
    exposure: 1,
    ground: true,
    shadowOpacity: 0.35,
    keyLight: 2.2,
    keyColor: '#ffffff',
    rimLight: 1.2,
    rimColor: '#7aa2ff',
    ambient: 0.25,
    autoRotate: false,
    grid: false,
  },
  clicker: {
    enabled: true,
    squash: 0.14,
    burstParticles: 'sparks',
    burstCount: 30,
    counter: true,
    floatText: '+1',
  },
};

/** Upgrade older saved designs and fill missing keys from the defaults. */
export function migrate(state) {
  const merged = deepMerge(structuredClone(DEFAULT_STATE), state || {});
  merged.version = STATE_VERSION;
  return merged;
}

/** Deep merge for plain objects; arrays and primitives are replaced. */
export function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], v);
    } else {
      target[k] = structuredClone(v);
    }
  }
  return target;
}

let uidCounter = 0;
export const uid = () => `${Date.now().toString(36)}${(uidCounter++).toString(36)}`;
