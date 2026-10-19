import { createRng } from '../core/rng.js';
import { clipToSquare, clipHalfPlane, regularPolygon, clean, ccw, area } from './polygon.js';

/**
 * Tiling generators. Each returns convex polygons covering the unit square
 * [-0.5, 0.5]^2. `n` = approximate tiles per side, `rng` = seeded random.
 * Register more by adding an entry to TILINGS.
 */
const finish = (polys) =>
  polys
    .map((p) => clean(clipToSquare(p)))
    .filter((p) => p.length >= 3 && Math.abs(area(p)) > 1e-5)
    .map(ccw);

export const TILINGS = {
  square: {
    label: 'Squares',
    build(n) {
      const s = 1 / n;
      const out = [];
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const x = -0.5 + i * s;
          const y = -0.5 + j * s;
          out.push([[x, y], [x + s, y], [x + s, y + s], [x, y + s]]);
        }
      return finish(out);
    },
  },

  brick: {
    label: 'Bricks',
    build(n) {
      const h = 1 / n;
      const w = 2 / n;
      const out = [];
      for (let j = 0; j < n; j++) {
        const off = j % 2 ? -w / 2 : 0;
        for (let x = -0.5 + off - w; x < 0.5; x += w) {
          const y = -0.5 + j * h;
          out.push([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
        }
      }
      return finish(out);
    },
  },

  triangle: {
    label: 'Triangles',
    build(n) {
      const s = 1 / n;
      const h = (s * Math.sqrt(3)) / 2;
      const rows = Math.ceil(1 / h) + 1;
      const out = [];
      for (let r = 0; r < rows; r++) {
        const y0 = -0.5 + r * h;
        const y1 = y0 + h;
        const off = r % 2 ? s / 2 : 0;
        for (let i = -2; i <= n + 1; i++) {
          const x = -0.5 + i * s - off;
          out.push([[x, y0], [x + s, y0], [x + s / 2, y1]]);
          out.push([[x + s / 2, y1], [x + s, y0], [x + s * 1.5, y1]]);
        }
      }
      return finish(out);
    },
  },

  hex: {
    label: 'Hexagons',
    build(n) {
      const r = 1 / (n * Math.sqrt(3));
      const dx = Math.sqrt(3) * r;
      const dy = 1.5 * r;
      const out = [];
      const rows = Math.ceil(1 / dy) + 2;
      for (let j = -1; j < rows; j++) {
        const off = j % 2 ? dx / 2 : 0;
        for (let i = -1; i <= n + 1; i++) {
          out.push(regularPolygon(-0.5 + i * dx + off, -0.5 + j * dy, r, 6, Math.PI / 6));
        }
      }
      return finish(out);
    },
  },

  rhombille: {
    label: 'Rhombille (3D cubes)',
    build(n) {
      const r = 1 / (n * Math.sqrt(3));
      const dx = Math.sqrt(3) * r;
      const dy = 1.5 * r;
      const out = [];
      const rows = Math.ceil(1 / dy) + 2;
      for (let j = -1; j < rows; j++) {
        const off = j % 2 ? dx / 2 : 0;
        for (let i = -1; i <= n + 1; i++) {
          const cx = -0.5 + i * dx + off;
          const cy = -0.5 + j * dy;
          const v = regularPolygon(cx, cy, r, 6, Math.PI / 6);
          for (let k = 0; k < 3; k++) {
            out.push([[cx, cy], v[k * 2], v[k * 2 + 1], v[(k * 2 + 2) % 6]]);
          }
        }
      }
      return finish(out);
    },
  },

  diamond: {
    label: 'Diamonds',
    build(n) {
      const s = 1 / n;
      const out = [];
      for (let i = -1; i <= n + 1; i++)
        for (let j = -1; j <= n + 1; j++) {
          const cx = -0.5 + i * s;
          const cy = -0.5 + j * s;
          out.push([[cx, cy - s / 2], [cx + s / 2, cy], [cx, cy + s / 2], [cx - s / 2, cy]]);
          const ox = cx + s / 2;
          const oy = cy + s / 2;
          out.push([[ox, oy - s / 2], [ox + s / 2, oy], [ox, oy + s / 2], [ox - s / 2, oy]]);
        }
      return finish(out);
    },
  },

  octagon: {
    label: 'Octagons + Squares',
    build(n) {
      const s = 1 / n;
      const c = s / (2 + Math.SQRT2); // corner cut
      const out = [];
      for (let i = -1; i <= n; i++)
        for (let j = -1; j <= n; j++) {
          const x = -0.5 + i * s;
          const y = -0.5 + j * s;
          out.push([
            [x + c, y], [x + s - c, y], [x + s, y + c], [x + s, y + s - c],
            [x + s - c, y + s], [x + c, y + s], [x, y + s - c], [x, y + c],
          ]);
          const X = x + s;
          const Y = y + s;
          out.push([[X, Y - c], [X + c, Y], [X, Y + c], [X - c, Y]]);
        }
      return finish(out);
    },
  },

  shards: {
    label: 'Shards (split squares)',
    build(n, rng) {
      const s = 1 / n;
      const out = [];
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const x = -0.5 + i * s;
          const y = -0.5 + j * s;
          const a = [x, y], b = [x + s, y], c = [x + s, y + s], d = [x, y + s];
          if (rng() < 0.5) out.push([a, b, c], [a, c, d]);
          else out.push([a, b, d], [b, c, d]);
        }
      return finish(out);
    },
  },

  voronoi: {
    label: 'Voronoi (organic)',
    build(n, rng) {
      const count = n * n;
      const pts = [];
      for (let i = 0; i < count; i++) pts.push([rng() - 0.5, rng() - 0.5]);
      // a light relaxation pass gives more even cells
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        let cell = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
        const [px, py] = pts[i];
        for (let j = 0; j < pts.length && cell.length >= 3; j++) {
          if (i === j) continue;
          const [qx, qy] = pts[j];
          // keep points closer to p than q: (q-p).x <= (|q|^2-|p|^2)/2
          const a = qx - px;
          const b = qy - py;
          const c = (qx * qx + qy * qy - px * px - py * py) / 2;
          cell = clipHalfPlane(cell, a, b, c);
        }
        out.push(cell);
      }
      return finish(out);
    },
  },

  mondrian: {
    label: 'Mondrian (random blocks)',
    build(n, rng) {
      const out = [];
      const minSize = 1 / (n * 1.5);
      const split = (x0, y0, x1, y1, depth) => {
        const w = x1 - x0;
        const h = y1 - y0;
        const canSplit = (w > minSize * 2 || h > minSize * 2) && depth < 12;
        if (!canSplit || (depth > 1 && rng() < 0.15)) {
          out.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
          return;
        }
        if (w >= h) {
          const t = x0 + w * (0.3 + rng() * 0.4);
          split(x0, y0, t, y1, depth + 1);
          split(t, y0, x1, y1, depth + 1);
        } else {
          const t = y0 + h * (0.3 + rng() * 0.4);
          split(x0, y0, x1, t, depth + 1);
          split(x0, t, x1, y1, depth + 1);
        }
      };
      split(-0.5, -0.5, 0.5, 0.5, 0);
      return finish(out);
    },
  },

  domino: {
    label: 'Dominoes',
    build(n, rng) {
      const s = 1 / n;
      const used = new Set();
      const out = [];
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          if (used.has(i + ',' + j)) continue;
          const x = -0.5 + i * s;
          const y = -0.5 + j * s;
          const canW = i + 1 < n && !used.has(i + 1 + ',' + j);
          const canH = j + 1 < n;
          const r = rng();
          if (canW && r < 0.3) {
            used.add(i + 1 + ',' + j);
            out.push([[x, y], [x + 2 * s, y], [x + 2 * s, y + s], [x, y + s]]);
          } else if (canH && r < 0.55) {
            used.add(i + ',' + (j + 1));
            out.push([[x, y], [x + s, y], [x + s, y + 2 * s], [x, y + 2 * s]]);
          } else out.push([[x, y], [x + s, y], [x + s, y + s], [x, y + s]]);
        }
      return finish(out);
    },
  },
};

export function buildTiling(id, n, seed) {
  const t = TILINGS[id] || TILINGS.square;
  return t.build(Math.max(1, n | 0), createRng(seed));
}

export const tilingOptions = () => Object.entries(TILINGS).map(([value, t]) => ({ value, label: t.label }));
