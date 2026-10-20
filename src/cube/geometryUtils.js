import * as THREE from 'three';

/**
 * Smooth vertex normals by averaging face normals of all vertices that share a
 * position (works on indexed or non-indexed geometry, ignores uv seams).
 */
export function smoothNormals(geometry) {
  if (geometry.userData.sculpt) return geometry; // sculpt meshes keep their own smooth normals
  if (geometry.index) geometry = geometry.toNonIndexed();
  const p = geometry.attributes.position;
  const acc = new Map();
  const key = (i) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const keys = new Array(p.count);
  const faceN = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    n.subVectors(c, b).cross(a.clone().sub(b)); // area-weighted
    const fn = n.clone().normalize();
    for (let k = 0; k < 3; k++) faceN.set([fn.x, fn.y, fn.z], (i + k) * 3);
    for (let k = 0; k < 3; k++) {
      const kk = (keys[i + k] = key(i + k));
      const v = acc.get(kk) || acc.set(kk, new THREE.Vector3()).get(kk);
      v.add(n);
    }
  }
  const normals = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = acc.get(keys[i]).clone();
    // opposing faces at one position (coincident caps) cancel out: use the face normal
    if (v.lengthSq() < 1e-12) v.fromArray(faceN, i * 3);
    v.normalize();
    normals[i * 3] = v.x;
    normals[i * 3 + 1] = v.y;
    normals[i * 3 + 2] = v.z;
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}

/** Flat (faceted) normals. */
export function flatNormals(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  return g;
}

/** Reverse triangle winding so FrontSide renders the inside (exportable outlines). */
export function flipWinding(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    const attr = g.attributes[name];
    const s = attr.itemSize;
    for (let i = 0; i < attr.count; i += 3) {
      for (let k = 0; k < s; k++) {
        const t = attr.array[(i + 1) * s + k];
        attr.array[(i + 1) * s + k] = attr.array[(i + 2) * s + k];
        attr.array[(i + 2) * s + k] = t;
      }
    }
  }
  if (g.attributes.normal) {
    const n = g.attributes.normal.array;
    for (let i = 0; i < n.length; i++) n[i] = -n[i];
  }
  return g;
}

/**
 * Remove zero-area triangles (cone tips, poles). Their zero normals turn into
 * NaN in shaders, which bloom then smears across the whole screen.
 */
export function dropDegenerate(geometry, eps = 1e-12) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = g.attributes.position;
  const keep = new Uint8Array(p.count / 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let kept = 0;
  for (let t = 0; t < keep.length; t++) {
    a.fromBufferAttribute(p, t * 3);
    b.fromBufferAttribute(p, t * 3 + 1);
    c.fromBufferAttribute(p, t * 3 + 2);
    if (c.sub(b).cross(a.sub(b)).lengthSq() > eps) (keep[t] = 1), kept++;
  }
  if (kept === keep.length) return g;
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) {
    const s = attr.itemSize;
    const arr = new Float32Array(kept * 3 * s);
    let w = 0;
    for (let t = 0; t < keep.length; t++) {
      if (!keep[t]) continue;
      arr.set(attr.array.subarray(t * 3 * s, (t + 1) * 3 * s), w);
      w += 3 * s;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  // remap material groups onto the compacted triangle list
  const prefix = new Uint32Array(keep.length + 1);
  for (let t = 0; t < keep.length; t++) prefix[t + 1] = prefix[t] + keep[t];
  for (const gr of g.groups) {
    const start = prefix[gr.start / 3];
    const count = prefix[(gr.start + gr.count) / 3] - start;
    if (count > 0) out.addGroup(start * 3, count * 3, gr.materialIndex);
  }
  out.userData = { ...g.userData };
  return out;
}
