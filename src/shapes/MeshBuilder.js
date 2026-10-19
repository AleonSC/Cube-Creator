import * as THREE from 'three';

/**
 * Accumulates triangles (non-indexed) with uv + vertex colour + material
 * groups. Used by procedural shapes (tessellated cube, voxels...).
 */
export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.col = [];
    this.groups = [];
    this.currentGroup = -1;
    this.groupStart = 0;
  }

  /** Begin a material group (0 = main surface, 1 = grout/secondary). */
  group(materialIndex) {
    this.endGroup();
    this.currentGroup = materialIndex;
    this.groupStart = this.pos.length / 3;
  }

  endGroup() {
    const count = this.pos.length / 3 - this.groupStart;
    if (this.currentGroup >= 0 && count > 0) {
      this.groups.push({ start: this.groupStart, count, materialIndex: this.currentGroup });
    }
    this.currentGroup = -1;
  }

  /** a,b,c = [x,y,z]; uvs = [[u,v] x3]; color = [r,g,b] */
  tri(a, b, c, uvs, color = [1, 1, 1]) {
    this.pos.push(...a, ...b, ...c);
    if (uvs) this.uv.push(...uvs[0], ...uvs[1], ...uvs[2]);
    else this.uv.push(0, 0, 1, 0, 1, 1);
    this.col.push(...color, ...color, ...color);
  }

  quad(a, b, c, d, uvs, color) {
    const u = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
    this.tri(a, b, c, [u[0], u[1], u[2]], color);
    this.tri(a, c, d, [u[0], u[2], u[3]], color);
  }

  build({ colors = true } = {}) {
    this.endGroup();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    for (const gr of this.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    g.computeVertexNormals();
    return g;
  }
}

/** Cube face frames: normal, u axis, v axis (u x v = n => outward CCW winding). */
export const CUBE_FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

/** HSV-ish tint helper -> [r,g,b] multiplier around white. */
export function tileTint(rng, brightnessVar, hueVar) {
  const b = 1 - brightnessVar * rng();
  if (hueVar <= 0) return [b, b, b];
  const c = new THREE.Color().setHSL(rng(), 1, 0.5);
  return [
    b * (1 - hueVar + hueVar * c.r),
    b * (1 - hueVar + hueVar * c.g),
    b * (1 - hueVar + hueVar * c.b),
  ];
}
