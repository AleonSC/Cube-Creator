import { shapes } from '../registries.js';
import { createRng } from '../core/rng.js';
import { MeshBuilder, tileTint } from './MeshBuilder.js';

/**
 * Pixel / voxel cube: an N x N x N block of little cubes. Hidden interior
 * faces are culled. Pair with the "Pixel Art" surface pattern for a classic
 * pixel-clicker look.
 */
const DIRS = [
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

shapes.register({
  id: 'voxel',
  label: 'Pixel / Voxel Cube',
  category: 'Cubes',
  params: {
    resolution: { type: 'int', label: 'Voxels per side', min: 1, max: 24, default: 8 },
    gap: { type: 'range', label: 'Gap', min: 0, max: 0.45, step: 0.01, default: 0 },
    missing: { type: 'range', label: 'Missing voxels', min: 0, max: 0.9, step: 0.01, default: 0 },
    jitter: { type: 'range', label: 'Pop-out jitter', min: 0, max: 1, step: 0.01, default: 0 },
    shade: { type: 'range', label: 'Shade variation', min: 0, max: 1, step: 0.01, default: 0.2 },
    hue: { type: 'range', label: 'Hue variation', min: 0, max: 1, step: 0.01, default: 0 },
    uvMode: {
      type: 'select',
      label: 'Texture mapping',
      options: [
        { value: 'face', label: 'Whole face (1 texture per side)' },
        { value: 'voxel', label: 'Per voxel (texture on every block)' },
      ],
      default: 'face',
    },
    seed: { type: 'seed', label: 'Seed', default: 11 },
  },
  build(p) {
    const N = p.resolution;
    const rng = createRng(p.seed);
    const s = 1 / N;
    const filled = new Uint8Array(N * N * N);
    const idx = (x, y, z) => x + N * (y + N * z);
    const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < N && y < N && z < N;
    for (let z = 0; z < N; z++)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const surface = x === 0 || y === 0 || z === 0 || x === N - 1 || y === N - 1 || z === N - 1;
          filled[idx(x, y, z)] = surface && rng() < p.missing ? 0 : 1;
        }
    const solid = p.gap === 0 && p.jitter === 0;
    const mb = new MeshBuilder();
    mb.group(0);
    for (let z = 0; z < N; z++)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          if (!filled[idx(x, y, z)]) continue;
          const color = tileTint(rng, p.shade, p.hue);
          const pop = p.jitter * rng() * s * 0.6;
          const half = (s * (1 - p.gap)) / 2;
          const cx = -0.5 + (x + 0.5) * s;
          const cy = -0.5 + (y + 0.5) * s;
          const cz = -0.5 + (z + 0.5) * s;
          for (const dir of DIRS) {
            const [dx, dy, dz] = dir.d;
            if (solid && inside(x + dx, y + dy, z + dz) && filled[idx(x + dx, y + dy, z + dz)]) continue;
            const isOuter = !inside(x + dx, y + dy, z + dz);
            const off = isOuter ? pop : 0;
            const verts = dir.c.map(([a, b, c]) => [
              cx + (a * 2 - 1) * half + dx * off,
              cy + (b * 2 - 1) * half + dy * off,
              cz + (c * 2 - 1) * half + dz * off,
            ]);
            let uvs;
            if (p.uvMode === 'voxel') uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
            else {
              // project onto the face plane so one texture spans the whole side
              uvs = verts.map(([vx, vy, vz]) => {
                if (dx) return [-dx * vz + 0.5, vy + 0.5];
                if (dy) return [vx + 0.5, -dy * vz + 0.5];
                return [dz * vx + 0.5, vy + 0.5];
              });
            }
            mb.quad(...verts, uvs, color);
          }
        }
    return mb.build();
  },
});
