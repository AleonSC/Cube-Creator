import * as THREE from 'three';
import { patterns } from '../registries.js';
import { withDefaults } from '../core/schema.js';

/**
 * Bakes a procedural pattern into real image textures (colour, emissive,
 * normal). Because the result is ordinary bitmaps, they survive export to
 * glTF / OBJ and look the same in Unity and Blender.
 */
export class TextureBuilder {
  constructor() {
    this.cacheKey = null;
    this.result = null;
  }

  /** @returns {{map, emissiveMap, normalMap} | null} */
  build(surface) {
    const pattern = patterns.get(surface.pattern) || patterns.get('none');
    if (pattern.id === 'none') {
      this.dispose();
      return null;
    }
    const params = withDefaults(pattern.params, surface.params?.[pattern.id]);
    const key = JSON.stringify([pattern.id, params, surface.colors, surface.ramp, surface.resolution, surface.pixelate, surface.normalStrength, surface.emissiveMode, surface.contrast, surface.invert]);
    if (key === this.cacheKey && this.result) return this.result;
    this.dispose();

    const res = surface.pixelate > 0 ? surface.pixelate : surface.resolution;
    const n = res * res;
    const col = new Uint8ClampedArray(n * 4);
    const emi = new Uint8ClampedArray(n * 4);
    const height = new Float32Array(n);
    const ramp = makeRamp(surface);
    const ctx = { res };
    const contrast = surface.contrast ?? 1;

    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const i = y * res + x;
        // canvas row 0 is the top of the image; flipY makes v=1 the top
        const s = pattern.sample((x + 0.5) / res, 1 - (y + 0.5) / res, params, ctx);
        let t = (s.t - 0.5) * contrast + 0.5;
        if (surface.invert) t = 1 - t;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const c = ramp(t);
        col[i * 4] = c[0];
        col[i * 4 + 1] = c[1];
        col[i * 4 + 2] = c[2];
        col[i * 4 + 3] = 255;
        const e = s.e < 0 ? 0 : s.e > 1 ? 1 : s.e;
        if (surface.emissiveMode === 'color') {
          emi[i * 4] = c[0] * e;
          emi[i * 4 + 1] = c[1] * e;
          emi[i * 4 + 2] = c[2] * e;
        } else {
          emi[i * 4] = emi[i * 4 + 1] = emi[i * 4 + 2] = e * 255;
        }
        emi[i * 4 + 3] = 255;
        height[i] = s.h;
      }
    }

    const nearest = surface.pixelate > 0;
    const map = makeTexture(col, res, true, nearest);
    const emissiveMap = surface.emissiveMode === 'none' ? null : makeTexture(emi, res, true, nearest);
    const normalMap = surface.normalStrength > 0 ? makeTexture(heightToNormal(height, res, surface.normalStrength), res, false, nearest) : null;
    map.name = 'baseColor';
    if (emissiveMap) emissiveMap.name = 'emissive';
    if (normalMap) normalMap.name = 'normal';

    this.cacheKey = key;
    this.result = { map, emissiveMap, normalMap };
    return this.result;
  }

  dispose() {
    if (this.result) Object.values(this.result).forEach((t) => t?.dispose());
    this.result = null;
    this.cacheKey = null;
  }
}

function makeRamp(surface) {
  // ramp works in sRGB byte space, matching what the canvas stores
  const cols = (surface.colors || ['#000000', '#888888', '#ffffff']).map(hexToRgb);
  if (surface.ramp === 'rainbow') return (t) => hslToRgb(t * 0.85, 0.9, 0.55);
  const stops = surface.ramp === '2' ? [cols[0], cols[2]] : cols;
  return (t) => {
    const f = t * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(f));
    const k = f - i;
    const a = stops[i], b = stops[i + 1];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
}

export function hexToRgb(hex) {
  const v = parseInt(String(hex).replace('#', ''), 16) || 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [f(0), f(8), f(4)];
}

function heightToNormal(h, res, strength) {
  const out = new Uint8ClampedArray(res * res * 4);
  const at = (x, y) => h[((y + res) % res) * res + ((x + res) % res)];
  const k = strength * res * 0.02;
  for (let y = 0; y < res; y++)
    for (let x = 0; x < res; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k;
      const dy = (at(x, y + 1) - at(x, y - 1)) * k;
      // canvas y grows downward; flip so bumps light correctly with flipY textures
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * res + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  return out;
}

function makeTexture(data, res, srgb, nearest) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  canvas.getContext('2d').putImageData(new ImageData(data, res, res), 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (nearest) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
  }
  tex.anisotropy = 8;
  return tex;
}
