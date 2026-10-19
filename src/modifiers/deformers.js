import * as THREE from 'three';
import { modifiers } from '../registries.js';
import { fbm3, noise3 } from '../core/noise.js';
import { hash2 } from '../core/rng.js';

/**
 * Stackable geometry modifiers. Each modifier is either
 *   deform(p: Vector3, params, ctx)  - per-vertex, position-only (crack-free)
 *   apply(geometry, params) -> geometry  - whole-geometry (topology changes)
 * Geometry is roughly inside [-0.5, 0.5]^3 when modifiers run.
 */
const axisOpt = { type: 'select', label: 'Axis', options: ['y', 'x', 'z'], default: 'y' };
const others = { x: ['y', 'z'], y: ['z', 'x'], z: ['x', 'y'] };

modifiers.registerAll([
  {
    id: 'subdivide',
    label: 'Subdivide (tessellate)',
    hint: 'Splits every triangle into 4. Put it first to give other modifiers more detail.',
    params: { iterations: { type: 'int', label: 'Iterations', min: 1, max: 4, default: 1 } },
    apply(geometry, p) {
      let g = geometry.index ? geometry.toNonIndexed() : geometry;
      for (let it = 0; it < p.iterations; it++) g = subdivideOnce(g);
      return g;
    },
  },
  {
    id: 'twist',
    label: 'Twist',
    params: { axis: axisOpt, angle: { type: 'range', label: 'Angle', min: -720, max: 720, step: 1, default: 90 } },
    deform(v, p) {
      const [a, b] = others[p.axis];
      const t = v[p.axis] * THREE.MathUtils.degToRad(p.angle);
      const c = Math.cos(t), s = Math.sin(t);
      const x = v[a], y = v[b];
      v[a] = x * c - y * s;
      v[b] = x * s + y * c;
    },
  },
  {
    id: 'taper',
    label: 'Taper',
    params: { axis: axisOpt, amount: { type: 'range', label: 'Amount', min: -1.5, max: 1.5, step: 0.01, default: 0.5 } },
    deform(v, p) {
      const [a, b] = others[p.axis];
      const k = Math.max(0.01, 1 - p.amount * (v[p.axis] + 0.5));
      v[a] *= k;
      v[b] *= k;
    },
  },
  {
    id: 'bend',
    label: 'Bend',
    params: { angle: { type: 'range', label: 'Angle', min: -270, max: 270, step: 1, default: 60 } },
    deform(v, p) {
      const ang = THREE.MathUtils.degToRad(p.angle);
      if (Math.abs(ang) < 1e-4) return;
      const r = 1 / ang;
      const theta = v.y * ang;
      const x = v.x;
      v.x = r - (r - x) * Math.cos(theta);
      v.y = (r - x) * Math.sin(theta);
    },
  },
  {
    id: 'spherify',
    label: 'Spherify / Inflate',
    params: { amount: { type: 'range', label: 'Amount', min: -1, max: 1, step: 0.01, default: 0.5 } },
    deform(v, p) {
      const len = v.length();
      if (len < 1e-6) return;
      const target = v.clone().multiplyScalar(0.62 / len);
      v.lerp(target, p.amount);
    },
  },
  {
    id: 'noise',
    label: 'Noise displace (rock / blob)',
    params: {
      amount: { type: 'range', label: 'Amount', min: 0, max: 0.4, step: 0.005, default: 0.08 },
      frequency: { type: 'range', label: 'Frequency', min: 0.5, max: 12, step: 0.1, default: 3 },
      octaves: { type: 'int', label: 'Detail', min: 1, max: 5, default: 3 },
      seed: { type: 'seed', label: 'Seed', default: 5 },
    },
    deform(v, p) {
      const len = v.length() || 1;
      const n = fbm3(v.x * p.frequency, v.y * p.frequency, v.z * p.frequency, p.octaves, p.seed);
      v.multiplyScalar(1 + (n * p.amount * 2) / len);
    },
  },
  {
    id: 'melt',
    label: 'Melt / Drip',
    params: {
      amount: { type: 'range', label: 'Droop', min: 0, max: 0.6, step: 0.01, default: 0.2 },
      spread: { type: 'range', label: 'Base spread', min: 0, max: 1, step: 0.01, default: 0.3 },
      drips: { type: 'range', label: 'Drip lumpiness', min: 0, max: 8, step: 0.1, default: 4 },
      seed: { type: 'seed', label: 'Seed', default: 2 },
    },
    deform(v, p) {
      const up = v.y + 0.5; // 0 at bottom, 1 at top
      const lump = 0.5 + 0.5 * noise3(v.x * p.drips, 0, v.z * p.drips, p.seed);
      v.y -= p.amount * up * up * (0.4 + lump);
      const s = 1 + p.spread * Math.pow(Math.max(0, 1 - up), 3);
      v.x *= s;
      v.z *= s;
      v.y = Math.max(v.y, -0.5);
    },
  },
  {
    id: 'wave',
    label: 'Wave / Ripple',
    params: {
      axis: axisOpt,
      amplitude: { type: 'range', label: 'Amplitude', min: 0, max: 0.2, step: 0.002, default: 0.04 },
      frequency: { type: 'range', label: 'Frequency', min: 0.5, max: 20, step: 0.1, default: 6 },
    },
    deform(v, p) {
      const [a, b] = others[p.axis];
      const k = 1 + p.amplitude * Math.sin(v[p.axis] * p.frequency * Math.PI * 2) * 4;
      v[a] *= k;
      v[b] *= k;
    },
  },
  {
    id: 'shatter',
    label: 'Low-poly jitter',
    params: {
      amount: { type: 'range', label: 'Amount', min: 0, max: 0.1, step: 0.001, default: 0.02 },
      seed: { type: 'seed', label: 'Seed', default: 9 },
    },
    deform(v, p) {
      // hash the quantised position so shared vertices move together (no cracks)
      const qx = Math.round(v.x * 1e4), qy = Math.round(v.y * 1e4), qz = Math.round(v.z * 1e4);
      v.x += (hash2(qx, qy + qz, p.seed) - 0.5) * p.amount * 2;
      v.y += (hash2(qy, qz + qx, p.seed + 1) - 0.5) * p.amount * 2;
      v.z += (hash2(qz, qx + qy, p.seed + 2) - 0.5) * p.amount * 2;
    },
  },
  {
    id: 'stretch',
    label: 'Squash / Stretch',
    params: {
      x: { type: 'range', label: 'X', min: 0.1, max: 3, step: 0.01, default: 1 },
      y: { type: 'range', label: 'Y', min: 0.1, max: 3, step: 0.01, default: 1.3 },
      z: { type: 'range', label: 'Z', min: 0.1, max: 3, step: 0.01, default: 1 },
    },
    deform(v, p) {
      v.x *= p.x;
      v.y *= p.y;
      v.z *= p.z;
    },
  },
]);

/** Split each triangle into 4 (non-indexed geometry; interpolates all attributes). */
function subdivideOnce(g) {
  const names = Object.keys(g.attributes);
  const src = names.map((n) => g.attributes[n]);
  const triCount = g.attributes.position.count / 3;
  const out = src.map((a) => new Float32Array(a.count * 4 * a.itemSize));
  const groups = g.groups.map((gr) => ({ ...gr, start: gr.start * 4, count: gr.count * 4 }));
  let w = 0;
  const get = (a, i, k) => a.array[i * a.itemSize + k];
  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3, i1 = i0 + 1, i2 = i0 + 2;
    // vertex order of 4 children using corners (0,1,2) and mids (m01=3, m12=4, m20=5)
    const tris = [[0, 3, 5], [3, 1, 4], [5, 4, 2], [3, 4, 5]];
    for (const tri of tris) {
      for (const vi of tri) {
        src.forEach((a, ai) => {
          for (let k = 0; k < a.itemSize; k++) {
            const c = [get(a, i0, k), get(a, i1, k), get(a, i2, k)];
            const val = vi < 3 ? c[vi] : vi === 3 ? (c[0] + c[1]) / 2 : vi === 4 ? (c[1] + c[2]) / 2 : (c[2] + c[0]) / 2;
            out[ai][w * a.itemSize + k] = val;
          }
        });
        w++;
      }
    }
  }
  const ng = new THREE.BufferGeometry();
  names.forEach((n, i) => ng.setAttribute(n, new THREE.BufferAttribute(out[i], src[i].itemSize)));
  groups.forEach((gr) => ng.addGroup(gr.start, gr.count, gr.materialIndex));
  ng.userData = { ...g.userData };
  return ng;
}
