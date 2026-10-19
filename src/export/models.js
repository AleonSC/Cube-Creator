import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { prepareExportObject, bakeIdleClip } from './prepare.js';

/** glTF / GLB (Unity via glTFast, Blender, Godot, three.js, web viewers). */
export async function exportGLTF(app, { binary = true, includeEffects = true, includeLights = true, bakeAnimation = true } = {}) {
  const root = prepareExportObject(app.assembler, { includeEffects, includeLights });
  root.userData = { generator: 'Cube Creator', design: app.store.get('name') };
  const animations = bakeAnimation ? [bakeIdleClip(app.store.get())] : [];
  const result = await new GLTFExporter().parseAsync(root, { binary, animations, onlyVisible: true, maxTextureSize: 2048 });
  return binary ? new Blob([result], { type: 'model/gltf-binary' }) : new Blob([JSON.stringify(result, null, 2)], { type: 'model/gltf+json' });
}

export function exportSTL(app, { includeEffects = false } = {}) {
  const root = prepareExportObject(app.assembler, { includeEffects, includeLights: false });
  const data = new STLExporter().parse(root, { binary: true });
  return new Blob([data], { type: 'model/stl' });
}

export async function exportUSDZ(app, { includeEffects = true } = {}) {
  const root = prepareExportObject(app.assembler, { includeEffects, includeLights: false });
  // USDZ exporter does not support multi-material groups -> split them
  splitGroups(root);
  // USDZ only understands MeshStandardMaterial: turn unlit materials into emissive ones
  root.traverse((o) => {
    if (o.isMesh && o.material?.isMeshBasicMaterial) {
      const m = o.material;
      o.material = new THREE.MeshStandardMaterial({ name: m.name, color: '#000000', emissive: m.color, emissiveIntensity: 1, side: m.side });
    }
  });
  const data = await new USDZExporter().parseAsync(root, { quickLookCompatible: true });
  return new Blob([data], { type: 'model/vnd.usdz+zip' });
}

function splitGroups(root) {
  const meshes = [];
  root.traverse((o) => o.isMesh && Array.isArray(o.material) && meshes.push(o));
  for (const mesh of meshes) {
    const g = mesh.geometry;
    mesh.material.forEach((mat, mi) => {
      const parts = g.groups.filter((gr) => gr.materialIndex === mi);
      if (!parts.length) return;
      const sub = extractRanges(g, parts);
      const m = new THREE.Mesh(sub, mat);
      m.name = `${mesh.name}_${mat.name || mi}`;
      m.position.copy(mesh.position);
      m.quaternion.copy(mesh.quaternion);
      m.scale.copy(mesh.scale);
      mesh.parent.add(m);
    });
    mesh.children.slice().forEach((c) => mesh.parent.add(c));
    mesh.removeFromParent();
  }
}

function extractRanges(g, ranges) {
  const src = g.index ? g.toNonIndexed() : g;
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) {
    const s = attr.itemSize;
    const total = ranges.reduce((n, r) => n + r.count, 0);
    const arr = new Float32Array(total * s);
    let w = 0;
    for (const r of ranges) {
      arr.set(attr.array.subarray(r.start * s, (r.start + r.count) * s), w);
      w += r.count * s;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  return out;
}

/**
 * Wavefront OBJ + MTL + PNG textures. Supports multiple materials, vertex
 * colours (Blender extension) and PBR MTL keys (Pr/Pm/Ke).
 * Returns { obj, mtl, textures: { 'name.png': Blob } }.
 */
export async function exportOBJ(app, { includeEffects = true, baseName = 'cube' } = {}) {
  const root = prepareExportObject(app.assembler, { includeEffects, includeLights: false });
  const lines = [`# Cube Creator export`, `mtllib ${baseName}.mtl`];
  const materials = new Map();
  const textures = {};
  let vOff = 1;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const nm = new THREE.Matrix3();

  const matName = (m) => {
    if (!materials.has(m)) materials.set(m, (m.name || 'Material') + '_' + materials.size);
    return materials.get(m);
  };

  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const col = g.attributes.color;
    nm.getNormalMatrix(o.matrixWorld);
    lines.push(`o ${o.name || 'mesh'}`);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      lines.push(col ? `v ${f(v.x)} ${f(v.y)} ${f(v.z)} ${f(col.getX(i))} ${f(col.getY(i))} ${f(col.getZ(i))}` : `v ${f(v.x)} ${f(v.y)} ${f(v.z)}`);
    }
    for (let i = 0; i < pos.count; i++) lines.push(uv ? `vt ${f(uv.getX(i))} ${f(uv.getY(i))}` : 'vt 0 0');
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      lines.push(`vn ${f(n.x)} ${f(n.y)} ${f(n.z)}`);
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mat = mats[gr.materialIndex] || mats[0];
      lines.push(`usemtl ${matName(mat)}`);
      for (let i = gr.start; i < gr.start + gr.count; i += 3) {
        const a = i + vOff, b = i + 1 + vOff, c = i + 2 + vOff;
        lines.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`);
      }
    }
    vOff += pos.count;
  });

  const mtl = ['# Cube Creator materials'];
  for (const [m, name] of materials) {
    const c = m.color || new THREE.Color(1, 1, 1);
    const e = (m.emissive || new THREE.Color(0, 0, 0)).clone().multiplyScalar(m.emissiveIntensity ?? 1);
    mtl.push(`newmtl ${name}`);
    mtl.push(`Kd ${f(c.r)} ${f(c.g)} ${f(c.b)}`);
    mtl.push('Ka 0 0 0');
    mtl.push('Ks 0.5 0.5 0.5');
    mtl.push(`Ns ${f(Math.max(1, (1 - (m.roughness ?? 0.5)) * 900))}`);
    mtl.push(`Ke ${f(e.r)} ${f(e.g)} ${f(e.b)}`);
    mtl.push(`d ${f(m.opacity ?? 1)}`);
    if (m.ior) mtl.push(`Ni ${f(m.ior)}`);
    if (m.roughness !== undefined) mtl.push(`Pr ${f(m.roughness)}`);
    if (m.metalness !== undefined) mtl.push(`Pm ${f(m.metalness)}`);
    if (m.transmission) mtl.push(`Tf ${f(1 - m.transmission)} ${f(1 - m.transmission)} ${f(1 - m.transmission)}`);
    mtl.push('illum 2');
    for (const [key, slot] of [['map', 'map_Kd'], ['emissiveMap', 'map_Ke'], ['normalMap', 'norm']]) {
      const tex = m[key];
      if (!tex?.image) continue;
      const file = `${name}_${key}.png`;
      textures[file] = await canvasToBlob(tex.image, tex.flipY);
      mtl.push(`${slot} ${file}`);
      if (key === 'normalMap') mtl.push(`map_Bump -bm 1 ${file}`);
    }
    mtl.push('');
  }
  return { obj: lines.join('\n'), mtl: mtl.join('\n'), textures };
}

const f = (x) => (Math.round(x * 1e5) / 1e5).toString();

/** Canvas/image -> PNG blob. OBJ/MTL readers expect top-down images, which a canvas already is. */
export function canvasToBlob(image) {
  return new Promise((res) => {
    if (image instanceof HTMLCanvasElement) return image.toBlob(res, 'image/png');
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    c.getContext('2d').drawImage(image, 0, 0);
    c.toBlob(res, 'image/png');
  });
}
