import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shapes } from '../registries.js';
import { createRng } from '../core/rng.js';

/**
 * Built-in primitive shapes. Geometry is normalised to fit a unit cube by the
 * assembler, so build() can use any convenient scale.
 * `smooth: true` => auto shading uses smooth normals.
 */
const detail = (label = 'Tessellation', max = 6, def = 0) => ({ type: 'int', label, min: 0, max, default: def });

shapes.registerAll([
  {
    id: 'cube',
    label: 'Cube',
    category: 'Cubes',
    params: { segments: { type: 'int', label: 'Subdivisions', min: 1, max: 48, default: 8, hint: 'More subdivisions = smoother deformations' } },
    build: (p) => new THREE.BoxGeometry(1, 1, 1, p.segments, p.segments, p.segments),
  },
  {
    id: 'rounded',
    label: 'Rounded Cube',
    category: 'Cubes',
    smooth: true,
    params: {
      radius: { type: 'range', label: 'Corner radius', min: 0.01, max: 0.5, step: 0.01, default: 0.12 },
      segments: { type: 'int', label: 'Corner segments', min: 1, max: 12, default: 5 },
    },
    build: (p) => new RoundedBoxGeometry(1, 1, 1, p.segments, Math.min(p.radius, 0.499)),
  },
  {
    id: 'sphere',
    label: 'Sphere',
    category: 'Round',
    smooth: true,
    params: {
      widthSegments: { type: 'int', label: 'Longitude segments', min: 3, max: 96, default: 48 },
      heightSegments: { type: 'int', label: 'Latitude segments', min: 2, max: 64, default: 32 },
    },
    build: (p) => new THREE.SphereGeometry(0.5, p.widthSegments, p.heightSegments),
  },
  {
    id: 'geosphere',
    label: 'Geodesic Sphere',
    category: 'Polyhedra',
    params: { detail: detail('Tessellation', 6, 2) },
    build: (p) => new THREE.IcosahedronGeometry(0.5, p.detail),
  },
  {
    id: 'tetrahedron',
    label: 'Tetrahedron (d4)',
    category: 'Polyhedra',
    params: { detail: detail() },
    build: (p) => new THREE.TetrahedronGeometry(0.5, p.detail),
  },
  {
    id: 'octahedron',
    label: 'Octahedron (d8)',
    category: 'Polyhedra',
    params: { detail: detail() },
    build: (p) => new THREE.OctahedronGeometry(0.5, p.detail),
  },
  {
    id: 'dodecahedron',
    label: 'Dodecahedron (d12)',
    category: 'Polyhedra',
    params: { detail: detail() },
    build: (p) => new THREE.DodecahedronGeometry(0.5, p.detail),
  },
  {
    id: 'icosahedron',
    label: 'Icosahedron (d20)',
    category: 'Polyhedra',
    params: { detail: detail() },
    build: (p) => new THREE.IcosahedronGeometry(0.5, p.detail),
  },
  {
    id: 'prism',
    label: 'Prism / Cylinder',
    category: 'Round',
    params: {
      sides: { type: 'int', label: 'Sides', min: 3, max: 64, default: 6 },
      topRatio: { type: 'range', label: 'Top radius', min: 0, max: 1.5, step: 0.01, default: 1 },
      heightSegments: { type: 'int', label: 'Height segments', min: 1, max: 32, default: 4 },
      smoothSides: { type: 'bool', label: 'Smooth sides', default: false },
    },
    build: (p) => {
      const g = new THREE.CylinderGeometry(0.5 * p.topRatio, 0.5, 1, p.sides, p.heightSegments);
      g.userData.smooth = p.smoothSides;
      return g;
    },
  },
  {
    id: 'capsule',
    label: 'Capsule',
    category: 'Round',
    smooth: true,
    params: {
      length: { type: 'range', label: 'Length', min: 0, max: 2, step: 0.01, default: 0.6 },
      segments: { type: 'int', label: 'Segments', min: 3, max: 48, default: 24 },
    },
    build: (p) => new THREE.CapsuleGeometry(0.4, p.length, 12, p.segments),
  },
  {
    id: 'torus',
    label: 'Torus / Ring',
    category: 'Round',
    smooth: true,
    params: {
      tube: { type: 'range', label: 'Thickness', min: 0.05, max: 0.9, step: 0.01, default: 0.35 },
      radialSegments: { type: 'int', label: 'Tube sides', min: 3, max: 48, default: 24 },
      tubularSegments: { type: 'int', label: 'Ring segments', min: 3, max: 128, default: 64 },
    },
    build: (p) => new THREE.TorusGeometry(0.5, 0.5 * p.tube, p.radialSegments, p.tubularSegments),
  },
  {
    id: 'torusKnot',
    label: 'Torus Knot',
    category: 'Round',
    smooth: true,
    params: {
      p: { type: 'int', label: 'Winds (p)', min: 1, max: 9, default: 2 },
      q: { type: 'int', label: 'Loops (q)', min: 1, max: 9, default: 3 },
      tube: { type: 'range', label: 'Thickness', min: 0.05, max: 0.6, step: 0.01, default: 0.25 },
      radialSegments: { type: 'int', label: 'Tube sides', min: 3, max: 32, default: 16 },
    },
    build: (p) => new THREE.TorusKnotGeometry(0.5, 0.5 * p.tube, 160, p.radialSegments, p.p, p.q),
  },
  {
    id: 'gem',
    label: 'Gem (brilliant cut)',
    category: 'Crystals',
    params: {
      facets: { type: 'int', label: 'Facets', min: 3, max: 32, default: 10 },
      table: { type: 'range', label: 'Table size', min: 0.05, max: 0.95, step: 0.01, default: 0.55 },
      crown: { type: 'range', label: 'Crown height', min: 0.02, max: 0.8, step: 0.01, default: 0.25 },
      pavilion: { type: 'range', label: 'Pavilion depth', min: 0.1, max: 1.5, step: 0.01, default: 0.6 },
    },
    build: (p) => {
      const r = 0.5;
      const pts = [
        new THREE.Vector2(0.0001, -p.pavilion),
        new THREE.Vector2(r, 0),
        new THREE.Vector2(r, 0.04),
        new THREE.Vector2(r * p.table, 0.04 + p.crown),
        new THREE.Vector2(0.0001, 0.04 + p.crown),
      ];
      return new THREE.LatheGeometry(pts, p.facets);
    },
  },
  {
    id: 'crystalCluster',
    label: 'Crystal Cluster',
    category: 'Crystals',
    params: {
      count: { type: 'int', label: 'Crystals', min: 1, max: 24, default: 7 },
      sides: { type: 'int', label: 'Sides', min: 3, max: 10, default: 6 },
      spread: { type: 'range', label: 'Spread', min: 0, max: 1.2, step: 0.01, default: 0.6 },
      thickness: { type: 'range', label: 'Thickness', min: 0.05, max: 0.5, step: 0.01, default: 0.16 },
      seed: { type: 'seed', label: 'Seed', default: 3 },
    },
    build: (p) => {
      const rng = createRng(p.seed);
      const parts = [];
      for (let i = 0; i < p.count; i++) {
        const len = i === 0 ? 1 : rng.range(0.4, 0.9);
        const r = p.thickness * (i === 0 ? 1.2 : rng.range(0.6, 1));
        const shaft = new THREE.CylinderGeometry(r, r * 0.9, len, p.sides, 1);
        shaft.translate(0, len / 2, 0);
        const tip = new THREE.ConeGeometry(r, r * 1.6, p.sides, 1);
        tip.translate(0, len + r * 0.8, 0);
        let g = mergeGeometries([shaft.toNonIndexed(), tip.toNonIndexed()]);
        const tilt = i === 0 ? 0 : rng.range(0.2, 1) * p.spread;
        g.rotateZ(tilt);
        g.rotateY(rng() * Math.PI * 2);
        parts.push(g);
      }
      return mergeGeometries(parts);
    },
  },
]);
