import { brushes } from '../registries.js';

/**
 * Sculpt / paint brushes. A brush is called once per dab:
 *
 *   dab(ctx) where ctx = {
 *     mesh       SculptMesh (uPos / uNorm / uPaint / uGlow arrays)
 *     ids        unique point ids inside the brush sphere
 *     weight(u)  0..1 falloff for point u
 *     center     brush centre (Vector3, mesh space)
 *     normal     average surface normal under the brush
 *     strength   0..1 slider value
 *     radius     brush radius
 *     invert     true while Ctrl / Cmd is held
 *     color      paint colour (THREE.Color, linear)
 *   }
 *
 * kind: 'sculpt' changes shape, 'paint' changes colour/glow (no normals/BVH work).
 * Brushes with `grab: true` are handled by the controller (drag a captured region).
 * Add a brush = register one more descriptor.
 */
const STEP = 0.06; // displacement per dab as a fraction of the radius

brushes.registerAll([
  {
    id: 'draw',
    label: 'Draw',
    kind: 'sculpt',
    key: 'd',
    hint: 'Build up raised detail. Ctrl = carve.',
    dab({ mesh, ids, weight, normal, strength, radius, invert }) {
      const k = (invert ? -1 : 1) * strength * radius * STEP;
      for (const u of ids) {
        const w = weight(u) * k;
        mesh.uPos[u * 3] += normal.x * w;
        mesh.uPos[u * 3 + 1] += normal.y * w;
        mesh.uPos[u * 3 + 2] += normal.z * w;
      }
    },
  },
  {
    id: 'carve',
    label: 'Carve',
    kind: 'sculpt',
    key: 'c',
    hint: 'Cut grooves and engravings. Ctrl = raise.',
    dab: (ctx) => brushes.get('draw').dab({ ...ctx, invert: !ctx.invert }),
  },
  {
    id: 'inflate',
    label: 'Inflate',
    kind: 'sculpt',
    key: 'i',
    hint: 'Puff surfaces outward along their own normals. Ctrl = deflate.',
    dab({ mesh, ids, weight, strength, radius, invert }) {
      const k = (invert ? -1 : 1) * strength * radius * STEP;
      for (const u of ids) {
        const w = weight(u) * k;
        mesh.uPos[u * 3] += mesh.uNorm[u * 3] * w;
        mesh.uPos[u * 3 + 1] += mesh.uNorm[u * 3 + 1] * w;
        mesh.uPos[u * 3 + 2] += mesh.uNorm[u * 3 + 2] * w;
      }
    },
  },
  {
    id: 'grab',
    label: 'Grab / Drag',
    kind: 'sculpt',
    key: 'g',
    grab: true,
    hint: 'Grab a region and drag / stretch it with the cursor.',
  },
  {
    id: 'smooth',
    label: 'Smooth',
    kind: 'sculpt',
    key: 's',
    hint: 'Relax bumps. Hold Shift with any sculpt brush to smooth.',
    dab({ mesh, ids, weight, strength }) {
      const next = new Float32Array(ids.length * 3);
      ids.forEach((u, i) => {
        let x = 0, y = 0, z = 0, c = 0;
        mesh.forEachNeighbour(u, (w) => {
          x += mesh.uPos[w * 3];
          y += mesh.uPos[w * 3 + 1];
          z += mesh.uPos[w * 3 + 2];
          c++;
        });
        const k = c ? weight(u) * Math.min(1, strength * 1.2) : 0;
        next[i * 3] = mesh.uPos[u * 3] + (x / (c || 1) - mesh.uPos[u * 3]) * k;
        next[i * 3 + 1] = mesh.uPos[u * 3 + 1] + (y / (c || 1) - mesh.uPos[u * 3 + 1]) * k;
        next[i * 3 + 2] = mesh.uPos[u * 3 + 2] + (z / (c || 1) - mesh.uPos[u * 3 + 2]) * k;
      });
      ids.forEach((u, i) => mesh.uPos.set(next.subarray(i * 3, i * 3 + 3), u * 3));
    },
  },
  {
    id: 'flatten',
    label: 'Flatten',
    kind: 'sculpt',
    key: 'f',
    hint: 'Sand the area level.',
    dab({ mesh, ids, weight, normal, strength }) {
      let cx = 0, cy = 0, cz = 0;
      for (const u of ids) {
        cx += mesh.uPos[u * 3];
        cy += mesh.uPos[u * 3 + 1];
        cz += mesh.uPos[u * 3 + 2];
      }
      cx /= ids.length || 1; cy /= ids.length || 1; cz /= ids.length || 1;
      for (const u of ids) {
        const d = (mesh.uPos[u * 3] - cx) * normal.x + (mesh.uPos[u * 3 + 1] - cy) * normal.y + (mesh.uPos[u * 3 + 2] - cz) * normal.z;
        const k = d * weight(u) * Math.min(1, strength * 0.6);
        mesh.uPos[u * 3] -= normal.x * k;
        mesh.uPos[u * 3 + 1] -= normal.y * k;
        mesh.uPos[u * 3 + 2] -= normal.z * k;
      }
    },
  },
  {
    id: 'pinch',
    label: 'Pinch / Crease',
    kind: 'sculpt',
    key: 'p',
    hint: 'Pull surface toward the stroke to sharpen ridges. Ctrl = spread.',
    dab({ mesh, ids, weight, center, normal, strength, invert }) {
      const k0 = (invert ? -1 : 1) * strength * 0.15;
      for (const u of ids) {
        let dx = center.x - mesh.uPos[u * 3], dy = center.y - mesh.uPos[u * 3 + 1], dz = center.z - mesh.uPos[u * 3 + 2];
        const dn = dx * normal.x + dy * normal.y + dz * normal.z; // keep it on the surface plane
        dx -= normal.x * dn; dy -= normal.y * dn; dz -= normal.z * dn;
        const k = weight(u) * k0;
        mesh.uPos[u * 3] += dx * k;
        mesh.uPos[u * 3 + 1] += dy * k;
        mesh.uPos[u * 3 + 2] += dz * k;
      }
    },
  },
  {
    id: 'paint',
    label: 'Paint colour',
    kind: 'paint',
    key: 'b',
    hint: 'Paint colour onto the surface. Ctrl = erase paint.',
    dab({ mesh, ids, weight, strength, color, invert }) {
      for (const u of ids) {
        const k = weight(u) * strength;
        const p = mesh.uPaint;
        if (invert) {
          p[u * 4 + 3] *= 1 - k;
          continue;
        }
        p[u * 4] += (color.r - p[u * 4]) * (p[u * 4 + 3] > 0 ? k : 1);
        p[u * 4 + 1] += (color.g - p[u * 4 + 1]) * (p[u * 4 + 3] > 0 ? k : 1);
        p[u * 4 + 2] += (color.b - p[u * 4 + 2]) * (p[u * 4 + 3] > 0 ? k : 1);
        p[u * 4 + 3] += (1 - p[u * 4 + 3]) * k;
      }
    },
  },
  {
    id: 'glow',
    label: 'Paint glow',
    kind: 'paint',
    key: 'e',
    hint: 'Paint glowing areas in the brush colour. Ctrl = erase glow.',
    dab({ mesh, ids, weight, strength, color, invert }) {
      const g = mesh.uGlow;
      for (const u of ids) {
        const k = weight(u) * strength;
        for (let c = 0; c < 3; c++) {
          const target = invert ? 0 : [color.r, color.g, color.b][c];
          g[u * 3 + c] += (target - g[u * 3 + c]) * k;
        }
      }
    },
  },
]);
