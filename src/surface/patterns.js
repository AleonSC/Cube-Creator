import { patterns } from '../registries.js';
import { fbm, ridged, worley, pnoise, smoothstep, clamp01 } from '../core/noise.js';
import { hash2 } from '../core/rng.js';

/**
 * Procedural surface patterns. sample(u, v, params) is called per texel with
 * u, v in [0,1) and returns:
 *   t  0..1  position on the colour ramp (colour 1 -> 2 -> 3)
 *   e  0..1  emissive mask (where the surface glows)
 *   h  0..1  height (converted to a normal map for bumpy lighting)
 * Patterns should tile (wrap) seamlessly. Integer frequencies keep them tileable.
 */
const seed = { type: 'seed', label: 'Seed', default: 1 };
const freq = (label = 'Scale', def = 4, max = 32) => ({ type: 'int', label, min: 1, max, default: def });

patterns.registerAll([
  {
    id: 'none',
    label: 'None (solid colour)',
    category: 'Basic',
    params: {},
    sample: () => ({ t: 0, e: 1, h: 0 }),
  },
  {
    id: 'gradient',
    label: 'Gradient',
    category: 'Basic',
    params: {
      direction: { type: 'select', label: 'Direction', options: ['vertical', 'horizontal', 'diagonal', 'radial'], default: 'vertical' },
    },
    sample(u, v, p) {
      let t = v;
      if (p.direction === 'horizontal') t = u;
      else if (p.direction === 'diagonal') t = (u + v) / 2;
      else if (p.direction === 'radial') t = clamp01(Math.hypot(u - 0.5, v - 0.5) * 2);
      return { t, e: t, h: 0 };
    },
  },
  {
    id: 'clouds',
    label: 'Clouds / Smoke',
    category: 'Natural',
    params: {
      scale: freq('Scale', 3, 16),
      octaves: { type: 'int', label: 'Detail', min: 1, max: 7, default: 5 },
      contrast: { type: 'range', label: 'Contrast', min: 0.2, max: 4, step: 0.05, default: 1.4 },
      seed,
    },
    sample(u, v, p) {
      const n = fbm(u, v, p.scale, p.octaves, p.seed);
      const t = clamp01((n - 0.5) * p.contrast + 0.5);
      return { t, e: t, h: t };
    },
  },
  {
    id: 'marble',
    label: 'Marble',
    category: 'Natural',
    params: {
      veins: freq('Veins', 3, 12),
      turbulence: { type: 'range', label: 'Turbulence', min: 0, max: 12, step: 0.1, default: 5 },
      sharpness: { type: 'range', label: 'Vein sharpness', min: 0.5, max: 8, step: 0.1, default: 3 },
      seed,
    },
    sample(u, v, p) {
      const n = fbm(u, v, 2, 5, p.seed);
      const s = Math.sin((u + v) * Math.PI * 2 * p.veins + n * p.turbulence);
      const t = Math.pow(1 - Math.abs(s), p.sharpness);
      return { t, e: t, h: 1 - t };
    },
  },
  {
    id: 'cells',
    label: 'Cells / Crystal',
    category: 'Natural',
    params: {
      cells: freq('Cells', 6, 32),
      mode: { type: 'select', label: 'Style', options: [{ value: 'f1', label: 'Bubbles' }, { value: 'flat', label: 'Flat facets' }, { value: 'edges', label: 'Cell edges' }], default: 'flat' },
      edge: { type: 'range', label: 'Edge width', min: 0.01, max: 0.5, step: 0.01, default: 0.08 },
      jitter: { type: 'range', label: 'Irregularity', min: 0, max: 1, step: 0.01, default: 0.9 },
      seed,
    },
    sample(u, v, p) {
      const w = worley(u, v, p.cells, p.seed, p.jitter);
      const edge = 1 - smoothstep(0, p.edge, w.f2 - w.f1);
      if (p.mode === 'f1') return { t: clamp01(w.f1), e: 1 - clamp01(w.f1), h: 1 - clamp01(w.f1) };
      if (p.mode === 'edges') return { t: edge, e: edge, h: 1 - edge };
      return { t: w.id, e: edge, h: w.id * 0.6 + (1 - edge) * 0.4 };
    },
  },
  {
    id: 'lavaCracks',
    label: 'Lava Cracks',
    category: 'Elemental',
    params: {
      cells: freq('Rock size', 5, 24),
      width: { type: 'range', label: 'Crack width', min: 0.01, max: 0.4, step: 0.005, default: 0.12 },
      hotspots: { type: 'range', label: 'Hot spots', min: 0, max: 1, step: 0.01, default: 0.35 },
      seed,
    },
    sample(u, v, p) {
      const w = worley(u, v, p.cells, p.seed, 0.9);
      const crust = fbm(u, v, p.cells * 2, 4, p.seed + 5);
      const crack = 1 - smoothstep(0, p.width, w.f2 - w.f1);
      const hot = smoothstep(1 - p.hotspots, 1, fbm(u, v, 3, 3, p.seed + 9)) * 0.8;
      const e = clamp01(crack + hot * (1 - crack));
      return { t: clamp01(crust * 0.45 * (1 - e) + e), e, h: (1 - crack) * (0.6 + crust * 0.4) };
    },
  },
  {
    id: 'flames',
    label: 'Flames',
    category: 'Elemental',
    params: {
      tongues: freq('Flame tongues', 4, 16),
      turbulence: { type: 'range', label: 'Turbulence', min: 0, max: 2, step: 0.01, default: 0.8 },
      intensity: { type: 'range', label: 'Intensity', min: 0.3, max: 3, step: 0.05, default: 1.2 },
      seed,
    },
    sample(u, v, p) {
      const warp = fbm(u, v, 3, 4, p.seed) * p.turbulence;
      const n = fbm(u + warp * 0.3, v * 1 + warp * 0.2, p.tongues, 5, p.seed + 3);
      const band = 0.5 + 0.5 * Math.sin((u + warp * 0.2) * Math.PI * 2 * p.tongues);
      const t = clamp01(Math.pow(n * (0.6 + 0.6 * band), 1.5) * p.intensity * 1.6);
      return { t, e: t, h: t };
    },
  },
  {
    id: 'caustics',
    label: 'Water Caustics',
    category: 'Elemental',
    params: {
      scale: freq('Scale', 3, 12),
      sharpness: { type: 'range', label: 'Sharpness', min: 1, max: 12, step: 0.1, default: 5 },
      seed,
    },
    sample(u, v, p) {
      const r = ridged(u, v, p.scale, 4, p.seed);
      const r2 = ridged(u + 0.37, v + 0.11, p.scale, 3, p.seed + 7);
      const t = clamp01(Math.pow(Math.max(r, r2), p.sharpness));
      return { t, e: t, h: t };
    },
  },
  {
    id: 'lightning',
    label: 'Lightning / Energy veins',
    category: 'Elemental',
    params: {
      scale: freq('Scale', 3, 12),
      thickness: { type: 'range', label: 'Thinness', min: 2, max: 40, step: 0.5, default: 14 },
      seed,
    },
    sample(u, v, p) {
      const r = ridged(u, v, p.scale, 5, p.seed);
      const t = Math.pow(r, p.thickness);
      return { t, e: t, h: t };
    },
  },
  {
    id: 'galaxy',
    label: 'Galaxy / Starfield',
    category: 'Cosmic',
    params: {
      stars: { type: 'range', label: 'Star density', min: 0, max: 0.05, step: 0.001, default: 0.012 },
      nebula: { type: 'range', label: 'Nebula', min: 0, max: 1, step: 0.01, default: 0.7 },
      scale: freq('Nebula scale', 2, 8),
      seed,
    },
    sample(u, v, p, ctx) {
      const neb = Math.pow(fbm(u, v, p.scale, 6, p.seed), 2.2) * p.nebula * 1.8;
      const px = Math.floor(u * ctx.res), py = Math.floor(v * ctx.res);
      const star = hash2(px, py, p.seed) < p.stars ? 0.6 + 0.4 * hash2(py, px, p.seed + 1) : 0;
      const t = clamp01(neb);
      return { t, e: clamp01(star + neb * 0.6), h: star };
    },
  },
  {
    id: 'circuit',
    label: 'Tech grid / Circuit',
    category: 'Tech',
    params: {
      cells: freq('Grid', 8, 32),
      width: { type: 'range', label: 'Line width', min: 0.02, max: 0.4, step: 0.01, default: 0.08 },
      nodes: { type: 'range', label: 'Nodes', min: 0, max: 1, step: 0.01, default: 0.25 },
      seed,
    },
    sample(u, v, p) {
      const x = u * p.cells, y = v * p.cells;
      const cx = Math.floor(x), cy = Math.floor(y);
      const fx = x - cx, fy = y - cy;
      const horiz = hash2(cx, cy, p.seed) < 0.55;
      const vert = hash2(cx, cy, p.seed + 1) < 0.45;
      const d = Math.min(horiz ? Math.abs(fy - 0.5) : 9, vert ? Math.abs(fx - 0.5) : 9);
      let e = 1 - smoothstep(p.width * 0.5, p.width, d);
      if (hash2(cx, cy, p.seed + 2) < p.nodes) {
        const r = Math.hypot(fx - 0.5, fy - 0.5);
        e = Math.max(e, 1 - smoothstep(p.width * 1.4, p.width * 2, r));
      }
      return { t: e, e, h: e };
    },
  },
  {
    id: 'hexgrid',
    label: 'Hex grid lines',
    category: 'Tech',
    params: {
      cells: freq('Hexes', 6, 24),
      width: { type: 'range', label: 'Line width', min: 0.01, max: 0.3, step: 0.005, default: 0.06 },
    },
    sample(u, v, p) {
      // rows chosen so the hex lattice tiles with (nearly) undistorted hexagons
      const rows = Math.max(1, Math.round(p.cells / 1.732));
      const r = hexEdge(u * p.cells, v * rows * 1.732);
      const e = 1 - smoothstep(p.width * 0.5, p.width, r);
      return { t: e, e, h: 1 - e };
    },
  },
  {
    id: 'stripes',
    label: 'Stripes / Bands',
    category: 'Basic',
    params: {
      count: freq('Stripes', 6, 32),
      angle: { type: 'select', label: 'Angle', options: [{ value: 0, label: 'Horizontal' }, { value: 1, label: 'Vertical' }, { value: 2, label: 'Diagonal' }], default: 2 },
      softness: { type: 'range', label: 'Softness', min: 0, max: 1, step: 0.01, default: 0.1 },
      wobble: { type: 'range', label: 'Wobble', min: 0, max: 1, step: 0.01, default: 0 },
      seed,
    },
    sample(u, v, p) {
      const w = p.wobble ? (fbm(u, v, 2, 3, p.seed) - 0.5) * p.wobble : 0;
      const a = Number(p.angle);
      const x = a === 0 ? v : a === 1 ? u : u + v;
      const s = 0.5 + 0.5 * Math.sin((x + w) * Math.PI * 2 * p.count);
      const t = p.softness <= 0 ? (s > 0.5 ? 1 : 0) : smoothstep(0.5 - p.softness / 2, 0.5 + p.softness / 2, s);
      return { t, e: t, h: t };
    },
  },
  {
    id: 'checker',
    label: 'Checker',
    category: 'Basic',
    params: { cells: freq('Squares', 4, 32) },
    sample(u, v, p) {
      const t = (Math.floor(u * p.cells) + Math.floor(v * p.cells)) % 2;
      return { t, e: t, h: t };
    },
  },
  {
    id: 'pixelArt',
    label: 'Pixel Art blocks',
    category: 'Pixel',
    params: {
      cells: { type: 'int', label: 'Pixels', min: 2, max: 64, default: 16 },
      levels: { type: 'int', label: 'Colour levels', min: 2, max: 8, default: 4 },
      noiseMix: { type: 'range', label: 'Smooth noise mix', min: 0, max: 1, step: 0.01, default: 0.5 },
      border: { type: 'range', label: 'Edge darkening', min: 0, max: 1, step: 0.01, default: 0.35 },
      glowPixels: { type: 'range', label: 'Glowing pixels', min: 0, max: 0.5, step: 0.01, default: 0.06 },
      seed,
    },
    sample(u, v, p) {
      const cx = Math.floor(u * p.cells), cy = Math.floor(v * p.cells);
      const cu = (cx + 0.5) / p.cells, cv = (cy + 0.5) / p.cells;
      const n = hash2(cx, cy, p.seed) * (1 - p.noiseMix) + fbm(cu, cv, 3, 3, p.seed) * p.noiseMix;
      let t = Math.floor(clamp01(n) * p.levels) / (p.levels - 1);
      const edge = Math.min(cx, cy, p.cells - 1 - cx, p.cells - 1 - cy) === 0;
      if (edge) t *= 1 - p.border;
      const glow = hash2(cx, cy, p.seed + 3) < p.glowPixels ? 1 : 0;
      return { t: clamp01(t), e: glow, h: t };
    },
  },
  {
    id: 'bricks',
    label: 'Bricks / Stone',
    category: 'Natural',
    params: {
      rows: freq('Rows', 6, 24),
      mortar: { type: 'range', label: 'Mortar', min: 0.01, max: 0.3, step: 0.005, default: 0.08 },
      roughness: { type: 'range', label: 'Roughness', min: 0, max: 1, step: 0.01, default: 0.5 },
      seed,
    },
    sample(u, v, p) {
      const y = v * p.rows;
      const row = Math.floor(y);
      const cols = Math.max(1, Math.round(p.rows / 2));
      const x = u * cols + (row % 2 ? 0.5 : 0);
      const col = Math.floor(x);
      const fx = x - col, fy = y - row;
      const m = Math.min(fx, 1 - fx, (fy) * 0.5, (1 - fy) * 0.5) * 2;
      const brick = smoothstep(p.mortar * 0.5, p.mortar, m);
      const n = fbm(u, v, 8, 4, p.seed) * p.roughness;
      const shade = 0.5 + 0.5 * hash2(col % cols, row, p.seed);
      const t = brick ? clamp01(0.35 + shade * 0.5 + n * 0.3) * brick : 0;
      return { t, e: 1 - brick, h: brick * (0.7 + n * 0.3) };
    },
  },
  {
    id: 'wood',
    label: 'Wood grain',
    category: 'Natural',
    params: {
      grain: freq('Grain lines', 10, 40),
      waviness: { type: 'range', label: 'Waviness', min: 0, max: 3, step: 0.05, default: 1 },
      seed,
    },
    sample(u, v, p) {
      const n = fbm(u, v, 2, 4, p.seed) * p.waviness;
      const s = 0.5 + 0.5 * Math.sin((v + n * 0.25) * Math.PI * 2 * p.grain + pnoise(u * 8, v * 8, 8, p.seed) * 0.6);
      const t = Math.pow(s, 2);
      return { t, e: t, h: t };
    },
  },
  {
    id: 'scales',
    label: 'Dragon scales',
    category: 'Natural',
    params: { rows: freq('Rows', 8, 32) },
    sample(u, v, p) {
      const y = v * p.rows;
      const row = Math.floor(y);
      const x = u * p.rows + (row % 2 ? 0.5 : 0);
      const fx = x - Math.floor(x) - 0.5;
      const fy = y - row;
      const d = Math.hypot(fx, fy * 0.9);
      const t = clamp01(1 - d * 1.6);
      return { t, e: smoothstep(0.38, 0.5, d), h: t };
    },
  },
]);

function hexEdge(x, y) {
  // distance to the nearest edge of a flat-topped unit hex lattice
  const a = [mod(x, 1) - 0.5, mod(y, 1.732) - 0.866];
  const b = [mod(x - 0.5, 1) - 0.5, mod(y - 0.866, 1.732) - 0.866];
  const g = Math.hypot(a[0], a[1]) < Math.hypot(b[0], b[1]) ? a : b;
  const ax = Math.abs(g[0]), ay = Math.abs(g[1]);
  return 0.5 - Math.max(ax * 0.5 + ay * 0.866, ax);
}
const mod = (a, n) => ((a % n) + n) % n;
