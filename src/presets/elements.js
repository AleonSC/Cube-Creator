import { presets } from '../registries.js';

/**
 * One-click looks. A preset's `look` is a partial design state that replaces
 * the material / glow / grout / surface / animation / effects / particles /
 * post sections (anything omitted resets to default). Optional `shape` is only
 * applied when the user ticks "also apply shape".
 *
 * Helpers keep entries short:
 *   surf(pattern, patternParams, extra)   surface section
 *   fx(type, params)                      effect entry
 *   pt(recipeId, overrides)               particle layer from a recipe
 */
const surf = (pattern, params = {}, extra = {}) => ({ pattern, params: { [pattern]: params }, ...extra });
const fx = (type, params = {}) => ({ type, params });
const pt = (preset, params = {}) => ({ preset, params });

const glassBase = { metalness: 0, roughness: 0.02, transmission: 1, ior: 1.5, thickness: 0.9, specularIntensity: 1 };

presets.registerAll([
  // ------------------------------------------------------------ glass & gems
  {
    id: 'glass', label: 'Glass', category: 'Glass & Gems', swatch: ['#dff4ff', '#ffffff'],
    look: { material: { ...glassBase }, post: { bloomStrength: 0.35 } },
  },
  {
    id: 'frosted', label: 'Frosted Glass', category: 'Glass & Gems', swatch: ['#e9f1f7', '#b6c8d6'],
    look: { material: { ...glassBase, roughness: 0.38, thickness: 1.2 }, surface: surf('clouds', { scale: 6, octaves: 4 }, { colors: ['#d8e6f0', '#f4f9fc', '#ffffff'], normalStrength: 0.4, emissiveMode: 'none' }) },
  },
  {
    id: 'crystal', label: 'Amethyst Crystal', category: 'Glass & Gems', swatch: ['#c49bff', '#6a2cc9'],
    shape: { type: 'crystalCluster', params: {} },
    look: {
      material: { ...glassBase, color: '#e2ccff', attenuationColor: '#8a3dff', attenuationDistance: 0.8, dispersion: 2, iridescence: 0.35, thickness: 1.2 },
      glow: { color: '#b07dff', intensity: 0.15 },
      surface: surf('cells', { cells: 5, mode: 'flat' }, { colors: ['#f2e6ff', '#ffffff', '#ffffff'], normalStrength: 1.4, emissiveMode: 'none' }),
      effects: [fx('aura', { color: '#a46bff', intensity: 1.2, size: 1.12 })],
      particles: [pt('frost', { colorStart: '#ffffff', colorEnd: '#b07dff' })],
    },
  },
  {
    id: 'diamond', label: 'Diamond', category: 'Glass & Gems', swatch: ['#ffffff', '#cfe8ff'],
    shape: { type: 'gem', params: {} },
    look: {
      material: { ...glassBase, ior: 2.42, dispersion: 6, thickness: 1.6, roughness: 0 },
      particles: [pt('frost', { rate: 12, colorEnd: '#ffffff', size: 0.07 })],
      animation: { spinY: 0.25 },
      post: { bloomStrength: 0.5, bloomThreshold: 0.75 },
    },
  },
  {
    id: 'ruby', label: 'Ruby', category: 'Glass & Gems', swatch: ['#ff2a52', '#7a0019'],
    look: { material: { ...glassBase, color: '#ff4d6a', attenuationColor: '#c4001d', attenuationDistance: 0.4, ior: 1.77, dispersion: 1.5 }, glow: { color: '#ff1a40', intensity: 0.1 } },
  },
  {
    id: 'emerald', label: 'Emerald', category: 'Glass & Gems', swatch: ['#2bff88', '#006b37'],
    look: { material: { ...glassBase, color: '#5dffa5', attenuationColor: '#00a152', attenuationDistance: 0.45, ior: 1.58, dispersion: 1 }, glow: { color: '#00ff7a', intensity: 0.08 } },
  },
  {
    id: 'sapphire', label: 'Sapphire', category: 'Glass & Gems', swatch: ['#3d7bff', '#08217a'],
    look: { material: { ...glassBase, color: '#6f9bff', attenuationColor: '#0a35c4', attenuationDistance: 0.4, ior: 1.77, dispersion: 1.5 } },
  },

  // ---------------------------------------------------------------- water/ice
  {
    id: 'water', label: 'Water', category: 'Water & Ice', swatch: ['#6fd0ff', '#1565c0'],
    look: {
      material: { ...glassBase, ior: 1.33, color: '#a8e4ff', attenuationColor: '#1e88e5', attenuationDistance: 0.7, roughness: 0.04 },
      glow: { color: '#9fe8ff', intensity: 0.7 },
      surface: surf('caustics', { scale: 3, sharpness: 5 }, { colors: ['#ffffff', '#ffffff', '#ffffff'], emissiveMode: 'mask', normalStrength: 1.2 }),
      animation: { scrollU: 0.03, scrollV: 0.05, wobble: 0.3 },
      particles: [pt('bubbles'), pt('droplets', { rate: 8 })],
    },
  },
  {
    id: 'ocean', label: 'Deep Ocean', category: 'Water & Ice', swatch: ['#0a4f8a', '#00172e'],
    look: {
      material: { ...glassBase, ior: 1.33, color: '#3da3ff', attenuationColor: '#002a5c', attenuationDistance: 0.35 },
      glow: { color: '#3dd9ff', intensity: 0.5 },
      surface: surf('caustics', { scale: 2, sharpness: 7 }, { colors: ['#ffffff', '#ffffff', '#ffffff'], emissiveMode: 'mask' }),
      animation: { scrollU: 0.02, scrollV: -0.03 },
      particles: [pt('bubbles', { rate: 25, colorStart: '#7fe3ff' })],
      scene: { environment: 'night' },
    },
  },
  {
    id: 'ice', label: 'Ice', category: 'Water & Ice', swatch: ['#d6f3ff', '#7fc8ff'],
    look: {
      material: { ...glassBase, ior: 1.31, color: '#dff6ff', roughness: 0.12, attenuationColor: '#7fc8ff', attenuationDistance: 1.2 },
      glow: { color: '#bdeaff', intensity: 0.25 },
      surface: surf('cells', { cells: 7, mode: 'edges', edge: 0.05 }, { colors: ['#ffffff', '#ffffff', '#ffffff'], normalStrength: 2, emissiveMode: 'mask' }),
      effects: [fx('aura', { color: '#9fe3ff', intensity: 0.9 })],
      particles: [pt('snow'), pt('frost')],
      scene: { environment: 'arctic' },
    },
  },

  // ------------------------------------------------------------- fire & lava
  {
    id: 'lava', label: 'Lava', category: 'Fire & Lava', swatch: ['#ff6a00', '#1a0705'],
    look: {
      material: { roughness: 0.85, metalness: 0 },
      glow: { color: '#ffffff', intensity: 3.2 },
      grout: { color: '#1a0805', glowColor: '#ff4a00', glow: 4 },
      surface: surf('lavaCracks', { cells: 5, width: 0.12, hotspots: 0.35 }, { colors: ['#120806', '#4a1408', '#ffb300'], emissiveMode: 'color', normalStrength: 2.5 }),
      animation: { glowPulse: 0.3, glowPulseSpeed: 0.6, scrollV: 0.01 },
      effects: [fx('halo', { color: '#ff5a1f', size: 2.6, intensity: 0.7 })],
      particles: [pt('embers'), pt('smoke', { rate: 8 })],
      post: { bloomStrength: 0.9, bloomThreshold: 0.7 },
      scene: { environment: 'inferno' },
    },
  },
  {
    id: 'magma', label: 'Cooling Magma Rock', category: 'Fire & Lava', swatch: ['#3a2a26', '#ff4500'],
    look: {
      material: { roughness: 0.95 },
      glow: { color: '#ffffff', intensity: 1.6 },
      grout: { color: '#120705', glowColor: '#ff3300', glow: 2.5 },
      surface: surf('lavaCracks', { cells: 4, width: 0.05, hotspots: 0.1 }, { colors: ['#1d1715', '#3d302b', '#ff5a00'], emissiveMode: 'color', normalStrength: 3 }),
      animation: { glowPulse: 0.4, glowPulseSpeed: 0.4 },
      particles: [pt('embers', { rate: 10 })],
    },
  },
  {
    id: 'fire', label: 'Fire', category: 'Fire & Lava', swatch: ['#ffcc33', '#ff2200'],
    look: {
      material: { color: '#ffffff', roughness: 0.6 },
      glow: { color: '#ffffff', intensity: 1.4 },
      surface: surf('flames', { tongues: 4, turbulence: 0.9 }, { colors: ['#3a0500', '#ff3d00', '#fff3a0'], emissiveMode: 'color', normalStrength: 0.4 }),
      animation: { scrollV: -0.35, flicker: 0.35 },
      effects: [fx('halo', { color: '#ff7a1a', size: 3, intensity: 0.45 }), fx('aura', { color: '#ff5a00', intensity: 1.2, power: 2.5 })],
      particles: [pt('flames', { brightness: 1.1, opacity: 0.5 }), pt('embers', { rate: 50 })],
      post: { bloomStrength: 0.75, bloomThreshold: 0.8 },
      scene: { environment: 'inferno' },
    },
  },
  {
    id: 'soulfire', label: 'Soul Fire (blue)', category: 'Fire & Lava', swatch: ['#7fe8ff', '#1b3dff'],
    look: {
      material: { roughness: 0.6 },
      glow: { color: '#ffffff', intensity: 1.4 },
      surface: surf('flames', { tongues: 5 }, { colors: ['#000a2a', '#1b6bff', '#d6fbff'], emissiveMode: 'color' }),
      animation: { scrollV: -0.4, flicker: 0.3 },
      effects: [fx('aura', { color: '#2b8cff', intensity: 1.2 })],
      particles: [pt('flames', { colorStart: '#d6fbff', colorEnd: '#1b3dff', brightness: 1.1, opacity: 0.5 }), pt('embers', { colorStart: '#aef3ff', colorEnd: '#2b5bff' })],
      post: { bloomStrength: 0.75, bloomThreshold: 0.8 },
      scene: { environment: 'night' },
    },
  },
  {
    id: 'sun', label: 'Sun / Star', category: 'Fire & Lava', swatch: ['#fff3b0', '#ff9a00'],
    shape: { type: 'sphere', params: {} },
    look: {
      glow: { color: '#ffffff', intensity: 1.5 },
      surface: surf('clouds', { scale: 6, contrast: 2 }, { colors: ['#ff4d00', '#ffae00', '#fff7c2'], emissiveMode: 'color' }),
      animation: { scrollU: 0.02, glowPulse: 0.15 },
      effects: [fx('halo', { color: '#ffb84d', size: 3.2, intensity: 0.5 })],
      particles: [pt('embers', { emitFrom: 'sphere', direction: 'outward', colorStart: '#fff2a8' })],
      post: { bloomStrength: 0.8, bloomThreshold: 0.8 },
    },
  },

  // --------------------------------------------------------------- air/sky
  {
    id: 'air', label: 'Air / Wind', category: 'Air & Sky', swatch: ['#f2fdff', '#a6e4ff'],
    look: {
      material: { ...glassBase, roughness: 0.3, color: '#f0fbff', opacity: 0.55 },
      glow: { color: '#e6fbff', intensity: 0.4 },
      surface: surf('clouds', { scale: 3, contrast: 1.8 }, { colors: ['#cfefff', '#ffffff', '#ffffff'], emissiveMode: 'mask', normalStrength: 0.3 }),
      animation: { scrollU: 0.08, bobAmplitude: 0.08, bobSpeed: 0.6 },
      effects: [fx('aura', { color: '#dff8ff', intensity: 1.2, power: 1.6 })],
      particles: [pt('wind'), pt('vortex', { rate: 35 })],
      scene: { environment: 'daylight', bgTop: '#7fc4ff', bgBottom: '#e6f6ff' },
    },
  },
  {
    id: 'cloud', label: 'Cloud', category: 'Air & Sky', swatch: ['#ffffff', '#c9d6e3'],
    look: {
      material: { roughness: 1, sheen: 1, sheenColor: '#ffffff' },
      surface: surf('clouds', { scale: 4, octaves: 6 }, { colors: ['#aab8c8', '#eef3f8', '#ffffff'], emissiveMode: 'none', normalStrength: 1.5 }),
      animation: { bobAmplitude: 0.06, bobSpeed: 0.5 },
      particles: [pt('steam', { colorEnd: '#ffffff', opacity: 0.3 })],
      scene: { environment: 'daylight', bgTop: '#5ea4ff', bgBottom: '#dff0ff' },
    },
  },
  {
    id: 'storm', label: 'Storm / Electric', category: 'Air & Sky', swatch: ['#9fd0ff', '#1a2250'],
    look: {
      material: { roughness: 0.5, color: '#3a4466' },
      glow: { color: '#9fd0ff', intensity: 2.5 },
      surface: surf('lightning', { scale: 3, thickness: 12 }, { colors: ['#151a2e', '#2b3558', '#9fd0ff'], emissiveMode: 'mask' }),
      animation: { flicker: 0.6 },
      effects: [fx('lightning'), fx('aura', { color: '#4a7dff', intensity: 1.2 })],
      particles: [pt('electric'), pt('rain', { rate: 60 })],
      post: { bloomStrength: 1, bloomThreshold: 0.6 },
      scene: { environment: 'night' },
    },
  },

  // ------------------------------------------------------------- earth/nature
  {
    id: 'stone', label: 'Stone', category: 'Earth & Nature', swatch: ['#8a8580', '#4a4744'],
    look: {
      material: { roughness: 0.92 },
      surface: surf('bricks', { rows: 6 }, { colors: ['#2e2c2a', '#7a756f', '#b5afa7'], emissiveMode: 'none', normalStrength: 2.5 }),
      grout: { color: '#2a2826' },
      particles: [pt('dust', { rate: 6 })],
    },
  },
  {
    id: 'grass', label: 'Grass Block (pixel)', category: 'Earth & Nature', swatch: ['#5fbf3a', '#7a5230'],
    shape: { type: 'voxel', params: {} },
    look: {
      material: { roughness: 0.9 },
      surface: surf('pixelArt', { cells: 16, levels: 4, glowPixels: 0 }, { colors: ['#2f7a1f', '#5fbf3a', '#9be36b'], emissiveMode: 'none', pixelate: 16, normalStrength: 0.5 }),
      particles: [pt('pixels', { rate: 6 })],
    },
  },
  {
    id: 'leaf', label: 'Living Nature', category: 'Earth & Nature', swatch: ['#8bdc4a', '#1f6b2a'],
    look: {
      material: { roughness: 0.6, sheen: 0.6, sheenColor: '#d6ff9a' },
      surface: surf('cells', { cells: 6, mode: 'edges', edge: 0.12 }, { colors: ['#1f6b2a', '#4bab3a', '#b6ff6b'], normalStrength: 1.5, emissiveMode: 'none' }),
      particles: [pt('leaves'), pt('fireflies')],
    },
  },
  {
    id: 'wood', label: 'Wood', category: 'Earth & Nature', swatch: ['#c08a52', '#6b3f1d'],
    look: { material: { roughness: 0.7, clearcoat: 0.3 }, surface: surf('wood', { grain: 12 }, { colors: ['#6b3f1d', '#a8703c', '#d9a46a'], emissiveMode: 'none', normalStrength: 0.8 }) },
  },
  {
    id: 'marble', label: 'Marble', category: 'Earth & Nature', swatch: ['#f4f1ec', '#8a8f99'],
    look: { material: { roughness: 0.15, clearcoat: 0.6 }, surface: surf('marble', { veins: 3, turbulence: 6 }, { colors: ['#f5f2ee', '#c9c6c0', '#4b4f57'], emissiveMode: 'none', normalStrength: 0.2 }) },
  },
  {
    id: 'moon', label: 'Moon Rock', category: 'Earth & Nature', swatch: ['#c9c9c9', '#5a5a5a'],
    look: { material: { roughness: 1 }, surface: surf('cells', { cells: 7, mode: 'f1', jitter: 1 }, { colors: ['#4a4a4a', '#9a9a9a', '#d8d8d8'], emissiveMode: 'none', normalStrength: 3 }), scene: { environment: 'night' } },
  },

  // ------------------------------------------------------------------ metals
  {
    id: 'gold', label: 'Gold', category: 'Metals', swatch: ['#ffd76a', '#b8860b'],
    look: { material: { color: '#ffcf5a', metalness: 1, roughness: 0.18 }, particles: [pt('frost', { colorStart: '#fffbe6', colorEnd: '#ffd76a', rate: 10 })], grout: { color: '#4a3200', metalness: 1, roughness: 0.4 } },
  },
  { id: 'chrome', label: 'Chrome', category: 'Metals', swatch: ['#f5f7fa', '#7a828f'], look: { material: { color: '#ffffff', metalness: 1, roughness: 0.04 } } },
  { id: 'copper', label: 'Copper', category: 'Metals', swatch: ['#ff9f6b', '#8a3f1d'], look: { material: { color: '#f2a07a', metalness: 1, roughness: 0.3 } } },
  {
    id: 'dragon', label: 'Dragon Scales', category: 'Metals', swatch: ['#c41a1a', '#ffb000'],
    look: { material: { metalness: 0.8, roughness: 0.3, clearcoat: 0.6 }, glow: { color: '#ff7a00', intensity: 1.2 }, surface: surf('scales', { rows: 10 }, { colors: ['#3a0505', '#c41a1a', '#ffb000'], emissiveMode: 'mask', normalStrength: 2 }), particles: [pt('embers', { rate: 12 })] },
  },

  // ------------------------------------------------------------- energy/tech
  {
    id: 'neon', label: 'Neon', category: 'Energy & Tech', swatch: ['#ff3df2', '#120018'],
    look: {
      material: { color: '#12101a', roughness: 0.3, metalness: 0.4 },
      grout: { color: '#08060c', glowColor: '#ff3df2', glow: 6 },
      effects: [fx('wireframe', { color: '#ff3df2', brightness: 2.2, angle: 30, thickness: 0.003 })],
      post: { bloomStrength: 0.7, bloomThreshold: 0.75 },
      scene: { environment: 'night', bgTop: '#1a0626', bgBottom: '#040108' },
    },
  },
  {
    id: 'hologram', label: 'Hologram', category: 'Energy & Tech', swatch: ['#3dfcff', '#003a4a'],
    look: {
      material: { color: '#3dfcff', opacity: 0.35, roughness: 0.2, metalness: 0, doubleSided: true },
      glow: { color: '#3dfcff', intensity: 1.4 },
      surface: surf('hexgrid', { cells: 8, width: 0.06 }, { colors: ['#00262e', '#00a3b8', '#bfffff'], emissiveMode: 'mask', normalStrength: 0 }),
      animation: { scrollV: 0.15, flicker: 0.25 },
      effects: [fx('wireframe', { color: '#3dfcff', brightness: 1.4, thickness: 0.0025 }), fx('aura', { color: '#3dfcff', intensity: 0.8 })],
      particles: [pt('pixels', { colorStart: '#bfffff', colorEnd: '#3dfcff', blending: 'additive', gravity: -0.5, brightness: 2.5 })],
      post: { bloomStrength: 0.6, bloomThreshold: 0.75 },
      scene: { environment: 'night' },
    },
  },
  {
    id: 'circuit', label: 'Cyber Circuit', category: 'Energy & Tech', swatch: ['#39ff88', '#03140a'],
    look: {
      material: { color: '#ffffff', metalness: 0.6, roughness: 0.35 },
      glow: { color: '#39ff88', intensity: 3 },
      surface: surf('circuit', { cells: 10 }, { colors: ['#04120a', '#0c2d18', '#39ff88'], emissiveMode: 'mask', normalStrength: 1 }),
      animation: { glowPulse: 0.4, glowPulseSpeed: 1 },
      post: { bloomStrength: 0.9, bloomThreshold: 0.6 },
      scene: { environment: 'night' },
    },
  },
  {
    id: 'plasma', label: 'Plasma', category: 'Energy & Tech', swatch: ['#ff5af0', '#5a00ff'],
    look: {
      material: { ...glassBase, color: '#ff9cf6', transmission: 0.6, attenuationColor: '#7a00ff', attenuationDistance: 0.5 },
      glow: { color: '#ffffff', intensity: 2.2 },
      surface: surf('lightning', { scale: 2, thickness: 8 }, { colors: ['#1a0030', '#a000ff', '#ffb3fb'], emissiveMode: 'color' }),
      animation: { scrollU: 0.1, scrollV: 0.07, glowPulse: 0.3 },
      effects: [fx('core', { color: '#ff5af0', glow: 8 }), fx('lightning', { color: '#ff9cf6' })],
      particles: [pt('magic', { colorStart: '#ffd6ff', colorEnd: '#ff3df2' })],
      post: { bloomStrength: 1.1, bloomThreshold: 0.55 },
      scene: { environment: 'night' },
    },
  },

  // ------------------------------------------------------------------ cosmic
  {
    id: 'galaxy', label: 'Galaxy', category: 'Cosmic & Magic', swatch: ['#3a1a8a', '#ff6ad5'],
    look: {
      material: { roughness: 0.25, clearcoat: 1 },
      glow: { color: '#ffffff', intensity: 2 },
      surface: surf('galaxy', { stars: 0.015, nebula: 0.8 }, { colors: ['#05010f', '#3a1a8a', '#ff6ad5'], emissiveMode: 'color', resolution: 512 }),
      animation: { scrollU: 0.01 },
      effects: [fx('rings', { color: '#c6a8ff', glow: 2.5 })],
      particles: [pt('stardust'), pt('orbiters')],
      scene: { environment: 'night', bgTop: '#0b0420', bgBottom: '#000000' },
    },
  },
  {
    id: 'void', label: 'Void / Dark Matter', category: 'Cosmic & Magic', swatch: ['#000000', '#5b1aa8'],
    look: {
      material: { color: '#050208', roughness: 0.05, clearcoat: 1, metalness: 0.3 },
      effects: [fx('aura', { color: '#7a2cff', intensity: 2.5, power: 1.5, size: 1.25 })],
      particles: [pt('void'), pt('stardust', { direction: 'inward', colorStart: '#7a2cff', colorEnd: '#000000' })],
      scene: { environment: 'night', bgTop: '#0a0414', bgBottom: '#000000' },
    },
  },
  {
    id: 'arcane', label: 'Arcane Magic', category: 'Cosmic & Magic', swatch: ['#b07dff', '#2a0a5a'],
    look: {
      material: { color: '#2a1450', roughness: 0.3, metalness: 0.5 },
      glow: { color: '#c89bff', intensity: 2.5 },
      surface: surf('circuit', { cells: 6, width: 0.05, nodes: 0.4 }, { colors: ['#1a0a33', '#3a1a6a', '#e0c8ff'], emissiveMode: 'mask' }),
      animation: { glowPulse: 0.5, glowPulseSpeed: 0.8 },
      effects: [fx('rings', { color: '#c89bff', count: 3 }), fx('aura', { color: '#9d4dff', intensity: 1.4 })],
      particles: [pt('magic')],
      scene: { environment: 'night' },
    },
  },
  {
    id: 'pearl', label: 'Pearl', category: 'Cosmic & Magic', swatch: ['#fff8f2', '#e6d6ff'],
    shape: { type: 'sphere', params: {} },
    look: { material: { color: '#fffaf5', roughness: 0.2, iridescence: 1, iridescenceIOR: 1.6, sheen: 0.6, sheenColor: '#ffd9f0', clearcoat: 1 } },
  },

  // -------------------------------------------------------------------- fun
  {
    id: 'slime', label: 'Slime', category: 'Fun & Stylised', swatch: ['#9dff3d', '#1f7a00'],
    shape: { type: 'rounded', params: { radius: 0.25 } },
    look: {
      material: { ...glassBase, color: '#b6ff6b', transmission: 0.7, roughness: 0.1, attenuationColor: '#3dbb00', attenuationDistance: 0.5, clearcoat: 1 },
      glow: { color: '#7dff3d', intensity: 0.3 },
      animation: { pulseScale: 0.05, pulseSpeed: 1.2, wobble: 0.4 },
      particles: [pt('toxic')],
    },
  },
  {
    id: 'candy', label: 'Candy / Jelly', category: 'Fun & Stylised', swatch: ['#ff8ac9', '#ff3d8b'],
    look: {
      material: { ...glassBase, color: '#ff9ccf', transmission: 0.8, roughness: 0.15, attenuationColor: '#ff3d8b', attenuationDistance: 0.6, clearcoat: 1, sheen: 0.5 },
      particles: [pt('hearts')],
      animation: { pulseScale: 0.04 },
    },
  },
  {
    id: 'rainbow', label: 'Rainbow', category: 'Fun & Stylised', swatch: ['#ff3d3d', '#3d7bff'],
    look: {
      material: { roughness: 0.3, clearcoat: 0.8 },
      glow: { color: '#ffffff', intensity: 0.8 },
      surface: surf('stripes', { count: 3, angle: 2, softness: 1 }, { ramp: 'rainbow', emissiveMode: 'color', normalStrength: 0 }),
      animation: { scrollU: 0.15 },
      particles: [pt('confetti')],
    },
  },
  {
    id: 'toon', label: 'Toon / Cel', category: 'Fun & Stylised', swatch: ['#ffcf3d', '#000000'],
    look: {
      material: { color: '#ffcf3d', roughness: 1, metalness: 0, envMapIntensity: 0.3 },
      grout: { color: '#000000' },
      effects: [fx('outline', { thickness: 0.025 })],
      post: { bloom: false },
    },
  },
  {
    id: 'retro', label: 'Retro Pixel', category: 'Fun & Stylised', swatch: ['#ff6b3d', '#3d2bff'],
    shape: { type: 'voxel', params: { resolution: 8 } },
    look: {
      material: { roughness: 0.8 },
      glow: { color: '#ffffff', intensity: 1.5 },
      surface: surf('pixelArt', { cells: 8, levels: 5, glowPixels: 0.08 }, { colors: ['#3d2bff', '#ff3d8b', '#ffcf3d'], pixelate: 8, emissiveMode: 'color', normalStrength: 0 }),
      particles: [pt('pixels', { colorStart: '#ffcf3d', colorEnd: '#ff3d8b' })],
      post: { pixelate: 3 },
    },
  },
  {
    id: 'coinbox', label: 'Coin Box', category: 'Fun & Stylised', swatch: ['#ffc21a', '#a35b00'],
    look: {
      material: { color: '#ffc21a', metalness: 0.4, roughness: 0.35 },
      grout: { color: '#7a3d00' },
      glow: { color: '#ff9a00', intensity: 0.3 },
      particles: [pt('coins', { rate: 4 })],
      animation: { bobAmplitude: 0.06 },
    },
  },
]);
