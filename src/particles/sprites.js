import * as THREE from 'three';
import { particleSprites } from '../registries.js';

/**
 * Particle sprite shapes, drawn once onto a canvas (white on transparent;
 * particle colour tints them). draw(ctx, S) where S = canvas size.
 */
const radial = (ctx, S, stops) => {
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  stops.forEach(([o, a]) => g.addColorStop(o, `rgba(255,255,255,${a})`));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
};

particleSprites.registerAll([
  { id: 'soft', label: 'Soft glow', draw: (c, S) => radial(c, S, [[0, 1], [0.25, 0.75], [0.6, 0.2], [1, 0]]) },
  { id: 'dot', label: 'Hard dot', draw: (c, S) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2); c.fill(); } },
  { id: 'square', label: 'Pixel square', nearest: true, draw: (c, S) => { c.fillStyle = '#fff'; c.fillRect(S * 0.12, S * 0.12, S * 0.76, S * 0.76); } },
  {
    id: 'star',
    label: 'Sparkle star',
    draw: (c, S) => {
      radial(c, S, [[0, 0.9], [0.15, 0.3], [0.4, 0]]);
      c.fillStyle = '#fff';
      c.beginPath();
      const m = S / 2;
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? S * 0.07 : S * 0.48;
        const a = (i / 8) * Math.PI * 2;
        c[i ? 'lineTo' : 'moveTo'](m + Math.cos(a) * r, m + Math.sin(a) * r);
      }
      c.fill();
    },
  },
  { id: 'ring', label: 'Ring', draw: (c, S) => { c.strokeStyle = '#fff'; c.lineWidth = S * 0.09; c.beginPath(); c.arc(S / 2, S / 2, S * 0.38, 0, Math.PI * 2); c.stroke(); } },
  {
    id: 'bubble',
    label: 'Bubble',
    draw: (c, S) => {
      radial(c, S, [[0, 0.05], [0.7, 0.15], [0.86, 0.85], [0.95, 0.3], [1, 0]]);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      c.ellipse(S * 0.36, S * 0.34, S * 0.09, S * 0.06, -0.6, 0, Math.PI * 2);
      c.fill();
    },
  },
  {
    id: 'flake',
    label: 'Snowflake',
    draw: (c, S) => {
      c.strokeStyle = '#fff';
      c.lineWidth = S * 0.06;
      c.lineCap = 'round';
      const m = S / 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const ex = m + Math.cos(a) * S * 0.42, ey = m + Math.sin(a) * S * 0.42;
        c.beginPath(); c.moveTo(m, m); c.lineTo(ex, ey); c.stroke();
        const bx = m + Math.cos(a) * S * 0.26, by = m + Math.sin(a) * S * 0.26;
        for (const d of [-0.6, 0.6]) {
          c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + d) * S * 0.12, by + Math.sin(a + d) * S * 0.12); c.stroke();
        }
      }
    },
  },
  {
    id: 'heart',
    label: 'Heart',
    draw: (c, S) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.moveTo(S * 0.5, S * 0.85);
      c.bezierCurveTo(S * 0.1, S * 0.55, S * 0.1, S * 0.15, S * 0.5, S * 0.32);
      c.bezierCurveTo(S * 0.9, S * 0.15, S * 0.9, S * 0.55, S * 0.5, S * 0.85);
      c.fill();
    },
  },
  {
    id: 'flame',
    label: 'Flame lick',
    draw: (c, S) => {
      const g = c.createRadialGradient(S / 2, S * 0.62, 0, S / 2, S * 0.62, S * 0.45);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(S / 2, S * 0.04);
      c.bezierCurveTo(S * 0.8, S * 0.4, S * 0.92, S * 0.7, S / 2, S * 0.96);
      c.bezierCurveTo(S * 0.08, S * 0.7, S * 0.2, S * 0.4, S / 2, S * 0.04);
      c.fill();
    },
  },
  {
    id: 'streak',
    label: 'Streak / line',
    draw: (c, S) => {
      const g = c.createLinearGradient(0, 0, S, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, S * 0.44, S, S * 0.12);
    },
  },
]);

const cache = new Map();
export function getSpriteTexture(id) {
  const sprite = particleSprites.get(id) || particleSprites.get('soft');
  if (cache.has(sprite.id)) return cache.get(sprite.id);
  const S = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  sprite.draw(canvas.getContext('2d'), S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (sprite.nearest) tex.magFilter = THREE.NearestFilter;
  cache.set(sprite.id, tex);
  return tex;
}

/** PNG data URL of a sprite (used by exporters). */
export function spriteDataURL(id) {
  return getSpriteTexture(id).image.toDataURL('image/png');
}
