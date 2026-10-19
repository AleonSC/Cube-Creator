import * as THREE from 'three';
import { shapes } from '../registries.js';

/** Flat 2D outlines extruded into chunky clicker tokens (coins, stars, hearts...). */
const OUTLINES = {
  polygon(p) {
    const s = new THREE.Shape();
    for (let i = 0; i < p.points; i++) {
      const a = Math.PI / 2 + (i / p.points) * Math.PI * 2;
      const fn = i ? 'lineTo' : 'moveTo';
      s[fn](Math.cos(a) * 0.5, Math.sin(a) * 0.5);
    }
    return s;
  },
  star(p) {
    const s = new THREE.Shape();
    const n = p.points * 2;
    for (let i = 0; i < n; i++) {
      const r = i % 2 ? 0.5 * p.innerRatio : 0.5;
      const a = Math.PI / 2 + (i / n) * Math.PI * 2;
      s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    return s;
  },
  circle() {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
    return s;
  },
  heart() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.45);
    s.bezierCurveTo(-0.15, -0.3, -0.55, -0.05, -0.5, 0.18);
    s.bezierCurveTo(-0.45, 0.45, -0.1, 0.5, 0, 0.28);
    s.bezierCurveTo(0.1, 0.5, 0.45, 0.45, 0.5, 0.18);
    s.bezierCurveTo(0.55, -0.05, 0.15, -0.3, 0, -0.45);
    return s;
  },
  gear(p) {
    const s = new THREE.Shape();
    const teeth = p.points;
    const steps = teeth * 4;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const r = i % 4 < 2 ? 0.5 : 0.5 * p.innerRatio;
      s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.12, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return s;
  },
  plus(p) {
    const w = 0.5 * p.innerRatio;
    const s = new THREE.Shape();
    const pts = [[-w, 0.5], [w, 0.5], [w, w], [0.5, w], [0.5, -w], [w, -w], [w, -0.5], [-w, -0.5], [-w, -w], [-0.5, -w], [-0.5, w], [-w, w]];
    pts.forEach(([x, y], i) => s[i ? 'lineTo' : 'moveTo'](x, y));
    return s;
  },
  lightning() {
    const s = new THREE.Shape();
    const pts = [[0.1, 0.5], [-0.3, -0.05], [-0.02, -0.05], [-0.12, -0.5], [0.32, 0.08], [0.04, 0.08], [0.2, 0.5]];
    pts.forEach(([x, y], i) => s[i ? 'lineTo' : 'moveTo'](x, y));
    return s;
  },
};

shapes.register({
  id: 'extruded',
  label: 'Token (extruded shape)',
  category: 'Tokens',
  params: {
    outline: {
      type: 'select',
      label: 'Outline',
      options: [
        { value: 'circle', label: 'Coin' },
        { value: 'polygon', label: 'Polygon' },
        { value: 'star', label: 'Star' },
        { value: 'heart', label: 'Heart' },
        { value: 'gear', label: 'Gear' },
        { value: 'plus', label: 'Plus / Cross' },
        { value: 'lightning', label: 'Lightning bolt' },
      ],
      default: 'star',
    },
    points: { type: 'int', label: 'Points / sides / teeth', min: 3, max: 24, default: 5, showIf: (p) => ['polygon', 'star', 'gear'].includes(p.outline) },
    innerRatio: { type: 'range', label: 'Inner ratio', min: 0.1, max: 0.95, step: 0.01, default: 0.45, showIf: (p) => ['star', 'gear', 'plus'].includes(p.outline) },
    thickness: { type: 'range', label: 'Thickness', min: 0.02, max: 1, step: 0.01, default: 0.25 },
    bevel: { type: 'range', label: 'Bevel', min: 0, max: 0.15, step: 0.005, default: 0.04 },
    bevelSegments: { type: 'int', label: 'Bevel segments', min: 1, max: 8, default: 3 },
  },
  build(p) {
    const outline = OUTLINES[p.outline] || OUTLINES.circle;
    const g = new THREE.ExtrudeGeometry(outline(p), {
      depth: p.thickness,
      bevelEnabled: p.bevel > 0,
      bevelThickness: p.bevel,
      bevelSize: p.bevel * 0.8,
      bevelSegments: p.bevelSegments,
      curveSegments: 32,
    });
    g.translate(0, 0, -p.thickness / 2);
    // ExtrudeGeometry UVs are in shape units; remap to roughly 0..1
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) + 0.5);
    return g;
  },
});
