import * as THREE from 'three';

/**
 * Builds a clean, export-ready copy of the cube:
 *  - viewer-only objects removed (particles, sprites, custom shaders)
 *  - animation pose reset (idle animation can be baked as a clip instead)
 *  - texture scroll offsets reset
 */
export function prepareExportObject(assembler, { includeEffects = true, includeLights = true } = {}) {
  const root = assembler.root.clone(true);
  const remove = [];
  root.traverse((o) => {
    if (o === root) return;
    const viewerOnly = o.userData.noExport || o.isPoints || o.isSprite || o.material?.isShaderMaterial;
    if (viewerOnly || (!includeEffects && o.userData.isEffect) || (!includeLights && o.isLight)) remove.push(o);
  });
  remove.forEach((o) => o.removeFromParent());

  const pivot = root.getObjectByName('Pivot');
  const mesh = root.getObjectByName('CubeMesh');
  pivot.position.set(0, 0, 0);
  pivot.scale.set(1, 1, 1);
  mesh.rotation.set(0, 0, 0);

  // work on copies so exporting never touches the live viewer materials
  root.traverse((o) => {
    if (!o.isMesh) return;
    const copy = (m) => {
      const c = m.clone();
      for (const k of ['map', 'emissiveMap', 'normalMap']) {
        if (c[k]) {
          c[k] = c[k].clone();
          c[k].offset.set(0, 0);
        }
      }
      if (c.userData.baseEmissiveIntensity !== undefined) c.emissiveIntensity = c.userData.baseEmissiveIntensity;
      // glTF stores emission as colour + optional strength; zero the colour so viewers
      // without KHR_materials_emissive_strength don't show a non-glowing cube glowing
      if (c.emissive && c.emissiveIntensity <= 0) {
        c.emissive.setRGB(0, 0, 0);
        c.emissiveIntensity = 1;
      }
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
  });
  if (mesh.geometry.userData.sculpt) bakeSculptGlow(mesh, assembler.materials.sculptGlow.value);
  root.updateMatrixWorld(true);
  return root;
}

/**
 * glTF has no per-vertex emission, so triangles painted with the glow brush are
 * regrouped by (quantised) glow colour, each group getting an emissive copy of
 * its material. The viewer-only `sculptGlow` attribute is removed.
 */
function bakeSculptGlow(mesh, intensity) {
  const src = mesh.geometry;
  const g = src.clone();
  g.userData = {};
  const glow = g.attributes.sculptGlow.array;
  g.deleteAttribute('sculptGlow');
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const index = g.index.array;
  const T = index.length / 3;
  const groups = g.groups.length ? g.groups : [{ start: 0, count: index.length, materialIndex: 0 }];
  const triMat = new Uint8Array(T);
  for (const gr of groups) for (let t = gr.start / 3; t < (gr.start + gr.count) / 3; t++) triMat[t] = gr.materialIndex;

  // bucket each triangle: '' = not glowing, else quantised colour key
  const keys = new Array(T);
  const buckets = new Map();
  for (let t = 0; t < T; t++) {
    let r = 0, gg = 0, b = 0;
    for (let k = 0; k < 3; k++) {
      const v = index[t * 3 + k] * 3;
      r += glow[v] / 3; gg += glow[v + 1] / 3; b += glow[v + 2] / 3;
    }
    const m = Math.max(r, gg, b);
    if (intensity <= 0 || m < 0.12) { keys[t] = ''; continue; }
    const q = (x) => Math.round((x / m) * 4) / 4;
    const key = `${triMat[t]}|${q(r)},${q(gg)},${q(b)}|${Math.round(m * 4) / 4}`;
    keys[t] = key;
    if (!buckets.has(key)) buckets.set(key, { mat: triMat[t], color: [q(r), q(gg), q(b)], level: Math.round(m * 4) / 4, count: 0 });
    buckets.get(key).count++;
  }
  if (!buckets.size) {
    mesh.geometry = g;
    return;
  }
  // keep at most 16 glow materials; fold the rarest into their closest neighbour
  const list = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count);
  const kept = list.slice(0, 16);
  const remap = new Map(kept.map(([k]) => [k, k]));
  for (const [k, info] of list.slice(16)) {
    let best = kept[0][0], bd = Infinity;
    for (const [kk, ki] of kept) {
      const d = ki.color.reduce((s, c, i) => s + (c - info.color[i]) ** 2, 0) + (ki.mat === info.mat ? 0 : 10);
      if (d < bd) { bd = d; best = kk; }
    }
    remap.set(k, best);
  }

  const outMats = [...mats];
  const slot = new Map();
  for (const [k, info] of kept) {
    const base = mats[info.mat] || mats[0];
    const m = base.isMeshBasicMaterial
      ? new THREE.MeshBasicMaterial({ name: `PaintGlow_${slot.size}`, vertexColors: true })
      : base.clone();
    m.name = `PaintGlow_${slot.size}`;
    if (m.emissive) {
      m.emissive.setRGB(...info.color);
      m.emissiveIntensity = intensity * info.level;
      m.emissiveMap = null;
    } else m.color.setRGB(...info.color.map((c) => Math.min(1, c * intensity * info.level)));
    slot.set(k, outMats.length);
    outMats.push(m);
  }

  // rebuild the index sorted by output material so each forms one group
  const order = [];
  const matOf = (t) => (keys[t] ? slot.get(remap.get(keys[t])) : triMat[t]);
  for (let t = 0; t < T; t++) order.push(t);
  order.sort((a, b) => matOf(a) - matOf(b));
  const newIndex = new Uint32Array(T * 3);
  g.clearGroups();
  let start = 0;
  order.forEach((t, i) => {
    newIndex.set(index.subarray(t * 3, t * 3 + 3), i * 3);
    const m = matOf(t);
    if (i === T - 1 || matOf(order[i + 1]) !== m) {
      g.addGroup(start * 3, (i + 1 - start) * 3, m);
      start = i + 1;
    }
  });
  g.setIndex(new THREE.BufferAttribute(newIndex, 1));
  mesh.geometry = g;
  mesh.material = outMats;
}

/**
 * Bake the idle animation (spin + bob) into an AnimationClip that loops
 * seamlessly. Track names target the node names inside the export root.
 */
export function bakeIdleClip(state, { fps = 30 } = {}) {
  const a = state.animation;
  const spinRate = a.spinY * Math.PI * 2 * 0.25; // rad/s, matches CubeAssembler
  const spinX = a.spinX * Math.PI * 2 * 0.25;
  let duration = 4;
  if (Math.abs(a.spinY) > 1e-3) duration = Math.abs((Math.PI * 2) / spinRate);
  else if (a.bobAmplitude > 0 && a.bobSpeed > 0) duration = 1 / a.bobSpeed;
  duration = Math.min(Math.max(duration, 0.5), 60);
  const frames = Math.max(2, Math.round(duration * fps));
  const bobCycles = Math.max(1, Math.round(duration * a.bobSpeed));
  const spinXCycles = Math.round((spinX * duration) / (Math.PI * 2));

  const times = [], quats = [], positions = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i <= frames; i++) {
    const t = (i / frames) * duration;
    times.push(t);
    const spinYCycles = Math.abs(a.spinY) > 1e-3 ? Math.sign(spinRate) : 0;
    e.set((spinXCycles * Math.PI * 2 * t) / duration, (spinYCycles * Math.PI * 2 * t) / duration, 0);
    q.setFromEuler(e);
    quats.push(q.x, q.y, q.z, q.w);
    positions.push(0, a.bobAmplitude * Math.sin((bobCycles * Math.PI * 2 * t) / duration), 0);
  }
  const tracks = [new THREE.QuaternionKeyframeTrack('CubeMesh.quaternion', times, quats)];
  if (a.bobAmplitude > 0) tracks.push(new THREE.VectorKeyframeTrack('Pivot.position', times, positions));
  return new THREE.AnimationClip('Idle', duration, tracks);
}

export function slug(name) {
  return (name || 'cube').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'cube';
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
