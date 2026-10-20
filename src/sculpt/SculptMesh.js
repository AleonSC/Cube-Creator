import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { subdivideOnce } from '../modifiers/deformers.js';

/**
 * Editable, dense version of the cube used by sculpt / paint brushes.
 *
 * Render vertices (indexed geometry, may be split at uv / colour seams) map to
 * "unique" welded points. Brushes move unique points, so seams and touching
 * tiles never tear. Paint (RGBA) and glow (RGB) also live on unique points and
 * are composited into the render colour / glow attributes.
 */
export class SculptMesh {
  /** Freeze an arbitrary geometry into a sculptable mesh with ~targetTris triangles. */
  static fromGeometry(source, targetTris) {
    let g = source.index ? source.toNonIndexed() : source.clone();
    for (let i = 0; i < 8 && (g.attributes.position.count / 3) * 4 <= targetTris * 1.6; i++) g = subdivideOnce(g);
    g.deleteAttribute('normal');
    for (const name of Object.keys(g.attributes)) if (!['position', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    const merged = mergeVertices(g, 1e-6);
    const n = merged.attributes.position.count;
    // weld render vertices by position only
    const pos = merged.attributes.position.array;
    const keyToU = new Map();
    const vu = new Uint32Array(n);
    const uPosList = [];
    for (let v = 0; v < n; v++) {
      const key = `${Math.round(pos[v * 3] * 1e5)},${Math.round(pos[v * 3 + 1] * 1e5)},${Math.round(pos[v * 3 + 2] * 1e5)}`;
      let u = keyToU.get(key);
      if (u === undefined) {
        u = uPosList.length / 3;
        keyToU.set(key, u);
        uPosList.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      }
      vu[v] = u;
    }
    const U = uPosList.length / 3;
    return new SculptMesh({
      index: Uint32Array.from(merged.index.array),
      vu,
      uv: Float32Array.from(merged.attributes.uv.array),
      baseColor: Float32Array.from(merged.attributes.color.array),
      uPos: Float32Array.from(uPosList),
      uPaint: new Float32Array(U * 4),
      uGlow: new Float32Array(U * 3),
      groups: merged.groups.map((gr) => ({ ...gr })),
    });
  }

  constructor({ index, vu, uv, baseColor, uPos, uPaint, uGlow, groups }) {
    Object.assign(this, { index, vu, uv, baseColor, uPos, uPaint, uGlow, groups });
    this.n = vu.length;
    this.U = uPos.length / 3;
    this.T = index.length / 3;
    this.uNorm = new Float32Array(this.U * 3);
    this.matColor = new THREE.Color(1, 1, 1);
    this.stamp = new Uint32Array(this.U);
    this.stampId = 0;
    this.buildAdjacency();
    this.buildGeometry();
  }

  buildAdjacency() {
    const { U, T, n, index, vu } = this;
    // unique -> triangles
    const tc = new Uint32Array(U + 1);
    for (let i = 0; i < T * 3; i++) tc[vu[index[i]] + 1]++;
    for (let u = 0; u < U; u++) tc[u + 1] += tc[u];
    const tris = new Uint32Array(T * 3);
    const fill = tc.slice(0, U);
    for (let i = 0; i < T * 3; i++) tris[fill[vu[index[i]]]++] = (i / 3) | 0;
    this.uTriStart = tc;
    this.uTris = tris;
    // unique -> render vertices
    const vc = new Uint32Array(U + 1);
    for (let v = 0; v < n; v++) vc[vu[v] + 1]++;
    for (let u = 0; u < U; u++) vc[u + 1] += vc[u];
    const verts = new Uint32Array(n);
    const vfill = vc.slice(0, U);
    for (let v = 0; v < n; v++) verts[vfill[vu[v]]++] = v;
    this.uVertStart = vc;
    this.uVerts = verts;
  }

  buildGeometry() {
    const g = new THREE.BufferGeometry();
    g.setIndex(new THREE.BufferAttribute(this.index, 1));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.n * 3), 3));
    g.setAttribute('sculptGlow', new THREE.BufferAttribute(new Float32Array(this.n * 3), 3));
    for (const gr of this.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    for (const name of ['position', 'normal', 'color', 'sculptGlow']) g.attributes[name].setUsage(THREE.DynamicDrawUsage);
    g.userData.sculpt = true;
    this.geometry = g;
    this.writePositions(null);
    this.updateNormals(null);
    this.writeColors(null);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    this.bvh = new MeshBVH(g, { indirect: true });
    g.boundsTree = this.bvh;
  }

  // ------------------------------------------------------------- queries

  /** Unique points within `radius` of `center`. Collects touched BVH nodes for refit. */
  findInSphere(center, radius, nodes) {
    const out = [];
    const s = ++this.stampId;
    const r2 = radius * radius;
    const { index, vu, uPos, stamp } = this;
    this.bvh.shapecast({
      intersectsBounds: (box, isLeaf, score, depth, nodeIndex) => {
        if (box.distanceToPoint(center) > radius) return false;
        nodes?.add(nodeIndex);
        return true;
      },
      intersectsTriangle: (tri, ti) => {
        for (let k = 0; k < 3; k++) {
          const u = vu[index[ti * 3 + k]];
          if (stamp[u] === s) continue;
          stamp[u] = s;
          const dx = uPos[u * 3] - center.x, dy = uPos[u * 3 + 1] - center.y, dz = uPos[u * 3 + 2] - center.z;
          if (dx * dx + dy * dy + dz * dz <= r2) out.push(u);
        }
        return false;
      },
    });
    return out;
  }

  /** Calls fn(neighbourUnique) for each unique point sharing a triangle with u (may repeat). */
  forEachNeighbour(u, fn) {
    const { uTriStart, uTris, index, vu } = this;
    for (let i = uTriStart[u]; i < uTriStart[u + 1]; i++) {
      const t = uTris[i];
      for (let k = 0; k < 3; k++) {
        const w = vu[index[t * 3 + k]];
        if (w !== u) fn(w);
      }
    }
  }

  // ------------------------------------------------------------- updates

  /** Copy unique positions to render vertices (all when `us` is null). */
  writePositions(us) {
    const pos = this.geometry.attributes.position.array;
    const each = (u) => {
      for (let i = this.uVertStart[u]; i < this.uVertStart[u + 1]; i++) {
        const v = this.uVerts[i];
        pos[v * 3] = this.uPos[u * 3];
        pos[v * 3 + 1] = this.uPos[u * 3 + 1];
        pos[v * 3 + 2] = this.uPos[u * 3 + 2];
      }
    };
    if (us) us.forEach(each);
    else for (let u = 0; u < this.U; u++) each(u);
    this.geometry.attributes.position.needsUpdate = true;
  }

  /** Recompute smooth normals of `us` and their 1-ring (all when null). */
  updateNormals(us) {
    let list = us;
    if (us) {
      const s = ++this.stampId;
      list = [];
      const add = (w) => {
        if (this.stamp[w] !== s) {
          this.stamp[w] = s;
          list.push(w);
        }
      };
      for (const u of us) {
        add(u);
        this.forEachNeighbour(u, add);
      }
    }
    const { uTriStart, uTris, index, vu, uPos, uNorm } = this;
    const nrm = this.geometry.attributes.normal.array;
    const each = (u) => {
      let nx = 0, ny = 0, nz = 0;
      for (let i = uTriStart[u]; i < uTriStart[u + 1]; i++) {
        const t = uTris[i] * 3;
        const a = vu[index[t]] * 3, b = vu[index[t + 1]] * 3, c = vu[index[t + 2]] * 3;
        const e1x = uPos[b] - uPos[a], e1y = uPos[b + 1] - uPos[a + 1], e1z = uPos[b + 2] - uPos[a + 2];
        const e2x = uPos[c] - uPos[a], e2y = uPos[c + 1] - uPos[a + 1], e2z = uPos[c + 2] - uPos[a + 2];
        nx += e1y * e2z - e1z * e2y;
        ny += e1z * e2x - e1x * e2z;
        nz += e1x * e2y - e1y * e2x;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      uNorm[u * 3] = nx / l;
      uNorm[u * 3 + 1] = ny / l;
      uNorm[u * 3 + 2] = nz / l;
      for (let i = this.uVertStart[u]; i < this.uVertStart[u + 1]; i++) {
        const v = this.uVerts[i] * 3;
        nrm[v] = uNorm[u * 3];
        nrm[v + 1] = uNorm[u * 3 + 1];
        nrm[v + 2] = uNorm[u * 3 + 2];
      }
    };
    if (list) list.forEach(each);
    else for (let u = 0; u < this.U; u++) each(u);
    this.geometry.attributes.normal.needsUpdate = true;
  }

  /** Composite base tint x material colour with paint, and write glow (all when null). */
  writeColors(us) {
    const col = this.geometry.attributes.color.array;
    const glow = this.geometry.attributes.sculptGlow.array;
    const { baseColor, uPaint, uGlow, matColor } = this;
    const each = (u) => {
      const a = uPaint[u * 4 + 3];
      for (let i = this.uVertStart[u]; i < this.uVertStart[u + 1]; i++) {
        const v = this.uVerts[i] * 3;
        col[v] = baseColor[v] * matColor.r * (1 - a) + uPaint[u * 4] * a;
        col[v + 1] = baseColor[v + 1] * matColor.g * (1 - a) + uPaint[u * 4 + 1] * a;
        col[v + 2] = baseColor[v + 2] * matColor.b * (1 - a) + uPaint[u * 4 + 2] * a;
        glow[v] = uGlow[u * 3];
        glow[v + 1] = uGlow[u * 3 + 1];
        glow[v + 2] = uGlow[u * 3 + 2];
      }
    };
    if (us) us.forEach(each);
    else for (let u = 0; u < this.U; u++) each(u);
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.sculptGlow.needsUpdate = true;
  }

  setMaterialColor(color) {
    if (this.matColor.equals(color)) return;
    this.matColor.copy(color);
    this.writeColors(null);
  }

  refit(nodes) {
    this.bvh.refit(nodes && nodes.size ? nodes : null);
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();
  }

  hasGlow() {
    for (let i = 0; i < this.uGlow.length; i++) if (this.uGlow[i] > 0.01) return true;
    return false;
  }

  // -------------------------------------------------------- serialisation

  static FIELDS = [['index', Uint32Array], ['vu', Uint32Array], ['uv', Float32Array], ['baseColor', Float32Array], ['uPos', Float32Array], ['uPaint', Float32Array], ['uGlow', Float32Array]];

  /** Pack into one binary blob: [u32 headerLen][header JSON][aligned typed arrays]. */
  toBytes() {
    const header = { v: 1, groups: this.groups, lengths: SculptMesh.FIELDS.map(([k]) => this[k].length) };
    const h = new TextEncoder().encode(JSON.stringify(header));
    const headPad = Math.ceil((4 + h.length) / 4) * 4;
    const total = headPad + SculptMesh.FIELDS.reduce((s, [k]) => s + this[k].byteLength, 0);
    const out = new Uint8Array(total);
    new DataView(out.buffer).setUint32(0, h.length, true);
    out.set(h, 4);
    let o = headPad;
    for (const [k] of SculptMesh.FIELDS) {
      out.set(new Uint8Array(this[k].buffer, this[k].byteOffset, this[k].byteLength), o);
      o += this[k].byteLength;
    }
    return out;
  }

  static fromBytes(bytes) {
    const len = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + len)));
    let o = Math.ceil((4 + len) / 4) * 4;
    const data = { groups: header.groups };
    SculptMesh.FIELDS.forEach(([k, Type], i) => {
      const count = header.lengths[i];
      data[k] = new Type(bytes.buffer.slice(bytes.byteOffset + o, bytes.byteOffset + o + count * 4));
      o += count * 4;
    });
    return new SculptMesh(data);
  }

  /** Snapshot of the given uniques (for per-stroke undo). */
  capture(us) {
    const ids = Uint32Array.from(us);
    const pos = new Float32Array(ids.length * 3), paint = new Float32Array(ids.length * 4), glow = new Float32Array(ids.length * 3);
    ids.forEach((u, i) => {
      pos.set(this.uPos.subarray(u * 3, u * 3 + 3), i * 3);
      paint.set(this.uPaint.subarray(u * 4, u * 4 + 4), i * 4);
      glow.set(this.uGlow.subarray(u * 3, u * 3 + 3), i * 3);
    });
    return { ids, pos, paint, glow };
  }

  restore(snap) {
    snap.ids.forEach((u, i) => {
      this.uPos.set(snap.pos.subarray(i * 3, i * 3 + 3), u * 3);
      this.uPaint.set(snap.paint.subarray(i * 4, i * 4 + 4), u * 4);
      this.uGlow.set(snap.glow.subarray(i * 3, i * 3 + 3), u * 3);
    });
    const list = Array.from(snap.ids);
    this.writePositions(list);
    this.updateNormals(list);
    this.writeColors(list);
    this.refit(null);
  }

  dispose() {
    this.geometry.dispose();
  }
}
