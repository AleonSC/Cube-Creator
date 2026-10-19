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

  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((m) => {
    for (const k of ['map', 'emissiveMap', 'normalMap']) m[k]?.offset.set(0, 0);
    if (m.userData.baseEmissiveIntensity !== undefined) m.emissiveIntensity = m.userData.baseEmissiveIntensity;
  });
  root.updateMatrixWorld(true);
  return root;
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
