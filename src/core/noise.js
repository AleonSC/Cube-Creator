import { hash2 } from './rng.js';

/**
 * Periodic (tileable) 2D noise functions. Coordinates are in "cells"; the
 * pattern repeats every `period` cells on both axes so textures wrap
 * seamlessly when repeated on cube faces.
 */
const mod = (a, n) => ((a % n) + n) % n;
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

function grad(ix, iy, period, seed, dx, dy) {
  const a = hash2(mod(ix, period), mod(iy, period), seed) * Math.PI * 2;
  return Math.cos(a) * dx + Math.sin(a) * dy;
}

/** Gradient noise in roughly [-1, 1]. */
export function pnoise(x, y, period, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fade(fx);
  const v = fade(fy);
  const n00 = grad(ix, iy, period, seed, fx, fy);
  const n10 = grad(ix + 1, iy, period, seed, fx - 1, fy);
  const n01 = grad(ix, iy + 1, period, seed, fx, fy - 1);
  const n11 = grad(ix + 1, iy + 1, period, seed, fx - 1, fy - 1);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.414;
}

/** Fractal noise in [0,1]. u,v in [0,1); base = integer frequency. */
export function fbm(u, v, base, octaves = 5, seed = 0, gain = 0.5) {
  let amp = 0.5;
  let freq = base;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * pnoise(u * freq, v * freq, freq, seed + o * 31);
    norm += amp;
    amp *= gain;
    freq *= 2;
  }
  return 0.5 + 0.5 * (sum / norm);
}

/** Ridged fractal noise in [0,1]; sharp bright creases (lightning, caustics). */
export function ridged(u, v, base, octaves = 4, seed = 0) {
  let amp = 0.5;
  let freq = base;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(pnoise(u * freq, v * freq, freq, seed + o * 17));
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Periodic Worley / cellular noise. Returns {f1, f2, id} with distances in cell units. */
export function worley(u, v, cells, seed = 0, jitter = 1) {
  const x = u * cells;
  const y = v * cells;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i;
      const cy = iy + j;
      const wx = mod(cx, cells);
      const wy = mod(cy, cells);
      const px = cx + 0.5 + (hash2(wx, wy, seed) - 0.5) * jitter;
      const py = cy + 0.5 + (hash2(wx, wy, seed + 99) - 0.5) * jitter;
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash2(wx, wy, seed + 7);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return { f1, f2, id };
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Non-periodic 3D value noise in [-1,1] (used by geometry modifiers). */
export function noise3(x, y, z, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const h = (i, j, k) => hash2(ix + i + Math.imul(iz + k, 7919), iy + j, seed) * 2 - 1;
  const x00 = lerp(h(0, 0, 0), h(1, 0, 0), fx);
  const x10 = lerp(h(0, 1, 0), h(1, 1, 0), fx);
  const x01 = lerp(h(0, 0, 1), h(1, 0, 1), fx);
  const x11 = lerp(h(0, 1, 1), h(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

export function fbm3(x, y, z, octaves = 3, seed = 0) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise3(x * freq, y * freq, z * freq, seed + o * 13);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
