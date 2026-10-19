import { shapes } from '../registries.js';
import { createRng } from '../core/rng.js';
import { MeshBuilder, CUBE_FACES, tileTint } from './MeshBuilder.js';
import { buildTiling, tilingOptions } from './tilings.js';
import { inset, centroid } from './polygon.js';

/**
 * Tessellated cube: every face is covered by a tiling of convex polygons that
 * are inset (gap), extruded (depth) and optionally bevelled / pyramided.
 * Material group 0 = tiles, group 1 = grout (the core the tiles sit on).
 */
shapes.register({
  id: 'tessellated',
  label: 'Tessellated Cube',
  category: 'Cubes',
  usesGrout: true,
  params: {
    tiling: { type: 'select', label: 'Tiling', options: tilingOptions(), default: 'hex' },
    tiles: { type: 'int', label: 'Tiles per side', min: 1, max: 16, default: 4 },
    gap: { type: 'range', label: 'Gap', min: 0, max: 0.08, step: 0.001, default: 0.012 },
    depth: { type: 'range', label: 'Tile depth', min: 0.005, max: 0.25, step: 0.005, default: 0.06 },
    heightJitter: { type: 'range', label: 'Height variation', min: 0, max: 1, step: 0.01, default: 0.2 },
    top: {
      type: 'select',
      label: 'Tile top',
      options: [
        { value: 'flat', label: 'Flat' },
        { value: 'bevel', label: 'Bevelled' },
        { value: 'pyramid', label: 'Pyramid' },
        { value: 'frame', label: 'Picture frame' },
      ],
      default: 'bevel',
    },
    bevel: { type: 'range', label: 'Bevel / rim', min: 0, max: 0.05, step: 0.001, default: 0.008, showIf: (p) => p.top !== 'flat' },
    peak: { type: 'range', label: 'Pyramid height', min: 0, max: 0.2, step: 0.005, default: 0.05, showIf: (p) => p.top === 'pyramid' },
    shade: { type: 'range', label: 'Tile shade variation', min: 0, max: 1, step: 0.01, default: 0.15 },
    hue: { type: 'range', label: 'Tile hue variation', min: 0, max: 1, step: 0.01, default: 0 },
    sameAllFaces: { type: 'bool', label: 'Same pattern every face', default: false },
    seed: { type: 'seed', label: 'Seed', default: 7 },
  },
  build(p) {
    const mb = new MeshBuilder();
    const rng = createRng(p.seed);
    const core = 0.5 - p.depth;
    const span = core * 2;

    const toWorld = (face, x, y, h) => [
      face.n[0] * (core + h) + face.u[0] * x * span + face.v[0] * y * span,
      face.n[1] * (core + h) + face.u[1] * x * span + face.v[1] * y * span,
      face.n[2] * (core + h) + face.u[2] * x * span + face.v[2] * y * span,
    ];
    const uvOf = (x, y) => [x + 0.5, y + 0.5];

    mb.group(0);
    CUBE_FACES.forEach((face, fi) => {
      const tiles = buildTiling(p.tiling, p.tiles, p.sameAllFaces ? p.seed : p.seed + fi * 101);
      for (const poly of tiles) {
        const base = inset(poly, p.gap / span / 2 + 1e-5) || null;
        if (!base) continue;
        const h = p.depth * (1 - p.heightJitter * rng());
        const color = tileTint(rng, p.shade, p.hue);
        const rim = p.top === 'flat' ? 0 : p.bevel / span;
        const top = rim > 0 && p.top !== 'frame' ? inset(base, rim) || base : base;
        const n = base.length;

        // side walls
        for (let i = 0; i < n; i++) {
          const a = base[i];
          const b = base[(i + 1) % n];
          const ta = top[i % top.length];
          const tb = top[(i + 1) % top.length];
          mb.quad(
            toWorld(face, a[0], a[1], 0),
            toWorld(face, b[0], b[1], 0),
            toWorld(face, tb[0], tb[1], h),
            toWorld(face, ta[0], ta[1], h),
            [uvOf(...a), uvOf(...b), uvOf(...tb), uvOf(...ta)],
            color,
          );
        }

        // cap
        const [cx, cy] = centroid(top);
        if (p.top === 'pyramid') {
          const apex = toWorld(face, cx, cy, h + p.peak);
          for (let i = 0; i < top.length; i++) {
            const a = top[i];
            const b = top[(i + 1) % top.length];
            mb.tri(toWorld(face, a[0], a[1], h), toWorld(face, b[0], b[1], h), apex, [uvOf(...a), uvOf(...b), uvOf(cx, cy)], color);
          }
        } else if (p.top === 'frame' && rim > 0) {
          const inner = inset(top, rim) || top;
          const sink = h * 0.5;
          for (let i = 0; i < top.length; i++) {
            const a = top[i], b = top[(i + 1) % top.length];
            const ia = inner[i % inner.length], ib = inner[(i + 1) % inner.length];
            // rim top
            mb.quad(toWorld(face, a[0], a[1], h), toWorld(face, b[0], b[1], h), toWorld(face, ib[0], ib[1], h), toWorld(face, ia[0], ia[1], h),
              [uvOf(...a), uvOf(...b), uvOf(...ib), uvOf(...ia)], color);
            // inner wall going down
            mb.quad(toWorld(face, ia[0], ia[1], h), toWorld(face, ib[0], ib[1], h), toWorld(face, ib[0], ib[1], sink), toWorld(face, ia[0], ia[1], sink),
              [uvOf(...ia), uvOf(...ib), uvOf(...ib), uvOf(...ia)], color);
          }
          const [ix, iy] = centroid(inner);
          for (let i = 0; i < inner.length; i++) {
            const a = inner[i], b = inner[(i + 1) % inner.length];
            mb.tri(toWorld(face, a[0], a[1], sink), toWorld(face, b[0], b[1], sink), toWorld(face, ix, iy, sink), [uvOf(...a), uvOf(...b), uvOf(ix, iy)], color);
          }
        } else {
          for (let i = 1; i < top.length - 1; i++) {
            const a = top[0], b = top[i], c = top[i + 1];
            mb.tri(toWorld(face, a[0], a[1], h), toWorld(face, b[0], b[1], h), toWorld(face, c[0], c[1], h), [uvOf(...a), uvOf(...b), uvOf(...c)], color);
          }
        }
      }
    });

    // grout core
    mb.group(1);
    for (const face of CUBE_FACES) {
      const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
      mb.quad(...corners.map(([x, y]) => toWorld(face, x, y, 0)), corners.map(([x, y]) => uvOf(x, y)), [1, 1, 1]);
    }
    return mb.build();
  },
});
