import * as THREE from 'three';
import { acceleratedRaycast } from 'three-mesh-bvh';
import { brushes } from '../registries.js';
import { SculptMesh } from './SculptMesh.js';
import { sculptDB, encodeSculpt, decodeSculpt } from './storage.js';
import { uid } from '../core/defaults.js';

THREE.Mesh.prototype.raycast = acceleratedRaycast; // BVH-accelerated picking for dense meshes

export const BRUSH_DEFAULTS = { brush: 'draw', radius: 0.08, strength: 0.5, hardness: 0.2, symX: true, symY: false, symZ: false, color: '#ff4d6d' };

/**
 * Owns the sculpt mesh and turns pointer strokes into brush dabs.
 * Editing is on while the Sculpt tab is open: the cube's idle animation is
 * paused so it holds still, left-drag on the cube sculpts, everything else orbits.
 */
export class SculptController {
  constructor(app) {
    this.app = app;
    this.mesh = null; // SculptMesh
    this.editing = false;
    this.settings = { ...BRUSH_DEFAULTS, ...loadSettings() };
    this.undoStack = [];
    this.redoStack = [];
    this.stroke = null;
    this.ray = new THREE.Raycaster();
    this.ray.firstHitOnly = true;
    this.listeners = new Set();
    this.makeCursor();
    this.bindPointer();
  }

  // ----------------------------------------------------------- lifecycle

  get active() {
    return !!(this.mesh && this.app.store.get('sculpt.active'));
  }

  /** Freeze the current procedural cube into a sculptable mesh. */
  start(resolution) {
    const source = this.app.assembler.proceduralGeometry;
    this.setMesh(SculptMesh.fromGeometry(source, resolution));
    const id = uid();
    this.app.store.update('sculpt', (s) => Object.assign(s, { active: true, id, resolution }));
    this.persist();
    this.setEditing(this.app.ui.active === 'sculpt');
  }

  setMesh(mesh) {
    this.mesh?.dispose();
    this.mesh = mesh;
    this.undoStack = [];
    this.redoStack = [];
    this.app.dirty.geometry = this.app.dirty.material = this.app.dirty.effects = this.app.dirty.particles = true;
    this.emit();
  }

  discard() {
    const id = this.app.store.get('sculpt.id');
    if (id) sculptDB.remove(id);
    this.mesh?.dispose();
    this.mesh = null;
    this.undoStack = [];
    this.redoStack = [];
    this.app.store.update('sculpt', (s) => Object.assign(s, { active: false, id: null }));
    this.setEditing(false);
    this.emit();
  }

  /** Restore the autosaved mesh for the current design (on page load). */
  async restore() {
    const { active, id } = this.app.store.get('sculpt');
    if (!active || !id) return;
    const bytes = await sculptDB.load(id);
    if (bytes) {
      this.setMesh(SculptMesh.fromBytes(new Uint8Array(bytes)));
      this.setEditing(this.app.ui.active === 'sculpt');
    }
    else {
      this.app.store.update('sculpt', (s) => Object.assign(s, { active: false, id: null }));
      this.app.ui.toast('Saved sculpt not found in this browser — showing the unsculpted cube.', 'error');
    }
  }

  persist() {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      const id = this.app.store.get('sculpt.id');
      if (this.mesh && id) sculptDB.save(id, this.mesh.toBytes());
    }, 600);
  }

  /** Compressed sculpt for embedding in a saved design file. */
  serialize() {
    return this.active ? encodeSculpt(this.mesh.toBytes()) : null;
  }

  load(b64) {
    this.setMesh(SculptMesh.fromBytes(decodeSculpt(b64)));
    this.persist();
  }

  setEditing(on) {
    this.editing = on && this.active;
    this.cursor.visible = false;
    this.app.viewer.controls.mouseButtons.RIGHT = this.editing ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    // copy first: a listener may re-render the panel, which re-subscribes during iteration
    [...this.listeners].forEach((fn) => fn());
  }

  saveSettings() {
    try {
      localStorage.setItem('cube-creator:brush', JSON.stringify(this.settings));
    } catch {
      /* optional */
    }
  }

  // ---------------------------------------------------------------- undo

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this.mesh.restore(entry.before);
    this.redoStack.push(entry);
    this.finishEdit();
    return true;
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    this.mesh.restore(entry.after);
    this.undoStack.push(entry);
    this.finishEdit();
    return true;
  }

  // ------------------------------------------------------------- pointer

  bindPointer() {
    const host = this.app.ui.viewport;
    host.addEventListener('pointerdown', (e) => this.onDown(e), { capture: true });
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  pick(e) {
    const canvas = this.app.viewer.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.app.viewer.camera);
    const target = this.app.assembler.mesh;
    const hit = this.ray.intersectObject(target, false)[0];
    if (!hit) return null;
    const inv = target.matrixWorld.clone().invert();
    const point = hit.point.clone().applyMatrix4(inv);
    const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
    return { point, normal, world: hit.point, worldNormal: normal.clone().transformDirection(target.matrixWorld) };
  }

  onDown(e) {
    if (!this.editing || e.button !== 0 || !e.isPrimary) return;
    const hit = this.pick(e);
    if (!hit) return; // off the cube: let OrbitControls rotate
    e.preventDefault();
    e.stopPropagation(); // keep OrbitControls from starting a rotation
    const brush = this.currentBrush(e);
    this.stroke = { brush, ids: [], seen: new Set(), before: null, last: hit.point.clone(), pointerId: e.pointerId };
    if (brush.grab) this.beginGrab(hit);
    else this.dabAt(hit.point, e);
  }

  onMove(e) {
    if (!this.editing) return;
    const hit = this.stroke?.grab ? null : this.pick(e);
    this.updateCursor(hit, e);
    if (!this.stroke || e.pointerId !== this.stroke.pointerId) return;
    if (this.stroke.grab) return this.moveGrab(e);
    if (!hit) return;
    // evenly spaced dabs along the stroke
    const spacing = this.settings.radius * 0.3;
    const from = this.stroke.last;
    const dist = from.distanceTo(hit.point);
    if (dist < spacing) return;
    const steps = Math.min(20, Math.floor(dist / spacing));
    for (let i = 1; i <= steps; i++) this.dabAt(from.clone().lerp(hit.point, i / steps), e);
    this.stroke.last = hit.point.clone();
  }

  onUp(e) {
    if (!this.stroke || e.pointerId !== this.stroke.pointerId) return;
    const s = this.stroke;
    this.stroke = null;
    if (!s.ids.length) return;
    this.undoStack.push({ before: s.before, after: this.mesh.capture(s.ids) });
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack.length = 0;
    this.finishEdit(s.brush.kind === 'paint');
  }

  onKey(e) {
    if (!this.editing || e.target.matches('input, select, textarea')) return;
    if (e.key === '[' || e.key === ']') {
      this.settings.radius = THREE.MathUtils.clamp(this.settings.radius * (e.key === ']' ? 1.15 : 1 / 1.15), 0.005, 0.6);
      this.saveSettings();
      this.emit();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const b = brushes.list().find((x) => x.key === e.key.toLowerCase());
    if (b) {
      this.settings.brush = b.id;
      this.saveSettings();
      this.emit();
    }
  }

  currentBrush(e) {
    const b = brushes.get(this.settings.brush) || brushes.get('draw');
    return e.shiftKey && b.kind === 'sculpt' ? brushes.get('smooth') : b;
  }

  // -------------------------------------------------------------- dabs

  /** Mirror copies of a point according to the symmetry toggles. */
  mirrors(p) {
    const { symX, symY, symZ } = this.settings;
    const out = [p.clone()];
    for (const [on, axis] of [[symX, 'x'], [symY, 'y'], [symZ, 'z']]) {
      if (!on) continue;
      const n = out.length;
      for (let i = 0; i < n; i++) {
        const m = out[i].clone();
        m[axis] = -m[axis];
        if (m.distanceToSquared(out[i]) > 1e-10) out.push(m);
      }
    }
    return out;
  }

  /** Record pre-stroke values of points before they are first modified. */
  track(ids) {
    const s = this.stroke;
    const fresh = ids.filter((u) => !s.seen.has(u));
    if (!fresh.length) return;
    fresh.forEach((u) => s.seen.add(u));
    const snap = this.mesh.capture(fresh);
    if (!s.before) s.before = snap;
    else s.before = concatSnap(s.before, snap);
    s.ids.push(...fresh);
  }

  weightFn(center) {
    const { radius, hardness } = this.settings;
    const P = this.mesh.uPos;
    return (u) => {
      const d = Math.hypot(P[u * 3] - center.x, P[u * 3 + 1] - center.y, P[u * 3 + 2] - center.z) / radius;
      if (d >= 1) return 0;
      if (d <= hardness) return 1;
      const t = (d - hardness) / (1 - hardness);
      return (1 - t * t) * (1 - t * t);
    };
  }

  dabAt(point, e) {
    const mesh = this.mesh;
    const brush = this.stroke.brush;
    const { radius, strength } = this.settings;
    const color = new THREE.Color(this.settings.color);
    const nodes = new Set();
    const touched = [];
    for (const center of this.mirrors(point)) {
      const ids = mesh.findInSphere(center, radius, nodes);
      if (!ids.length) continue;
      this.track(ids);
      const weight = this.weightFn(center);
      const normal = new THREE.Vector3();
      for (const u of ids) {
        const w = weight(u);
        normal.x += mesh.uNorm[u * 3] * w;
        normal.y += mesh.uNorm[u * 3 + 1] * w;
        normal.z += mesh.uNorm[u * 3 + 2] * w;
      }
      if (normal.lengthSq() < 1e-12) normal.set(0, 1, 0);
      normal.normalize();
      brush.dab({ mesh, ids, weight, center, normal, strength, radius, invert: e.ctrlKey || e.metaKey, color });
      touched.push(...ids);
    }
    if (!touched.length) return;
    if (brush.kind === 'paint') mesh.writeColors(touched);
    else {
      mesh.writePositions(touched);
      mesh.updateNormals(touched);
      mesh.refit(nodes);
    }
  }

  // -------------------------------------------------------------- grab

  beginGrab(hit) {
    const mesh = this.mesh;
    const cam = this.app.viewer.camera;
    const regions = this.mirrors(hit.point).map((center, i) => {
      const ids = mesh.findInSphere(center, this.settings.radius, null);
      const weight = this.weightFn(center);
      return { ids, w: ids.map(weight), orig: ids.map((u) => [mesh.uPos[u * 3], mesh.uPos[u * 3 + 1], mesh.uPos[u * 3 + 2]]), flip: this.flipOf(hit.point, center, i) };
    });
    const all = regions.flatMap((r) => r.ids);
    this.track([...new Set(all)]);
    const normal = cam.getWorldDirection(new THREE.Vector3());
    this.stroke.grab = { regions, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.world), start: hit.world.clone() };
  }

  /** Which axes are mirrored for symmetry copy i (sign per axis). */
  flipOf(p, c) {
    return new THREE.Vector3(Math.sign(p.x) !== Math.sign(c.x) && Math.abs(p.x) > 1e-9 ? -1 : 1, Math.sign(p.y) !== Math.sign(c.y) && Math.abs(p.y) > 1e-9 ? -1 : 1, Math.sign(p.z) !== Math.sign(c.z) && Math.abs(p.z) > 1e-9 ? -1 : 1);
  }

  moveGrab(e) {
    const g = this.stroke.grab;
    const canvas = this.app.viewer.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.app.viewer.camera);
    const p = this.ray.ray.intersectPlane(g.plane, new THREE.Vector3());
    if (!p) return;
    // world-space drag -> mesh space
    const target = this.app.assembler.mesh;
    const delta = p.sub(g.start).applyMatrix3(new THREE.Matrix3().setFromMatrix4(target.matrixWorld).invert());
    const mesh = this.mesh;
    const touched = [];
    for (const r of g.regions) {
      r.ids.forEach((u, i) => {
        const w = r.w[i];
        mesh.uPos[u * 3] = r.orig[i][0] + delta.x * r.flip.x * w;
        mesh.uPos[u * 3 + 1] = r.orig[i][1] + delta.y * r.flip.y * w;
        mesh.uPos[u * 3 + 2] = r.orig[i][2] + delta.z * r.flip.z * w;
      });
      touched.push(...r.ids);
    }
    mesh.writePositions(touched);
    mesh.updateNormals(touched);
    mesh.refit(null);
    this.cursor.visible = false;
  }

  // ----------------------------------------------------------- feedback

  makeCursor() {
    const g = new THREE.RingGeometry(0.94, 1, 48);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide, toneMapped: false });
    this.cursor = new THREE.Mesh(g, m);
    this.cursor.renderOrder = 999;
    this.cursor.visible = false;
    this.cursor.userData.noExport = true;
    this.app.viewer.scene.add(this.cursor);
  }

  updateCursor(hit, e) {
    if (!hit) {
      if (!this.stroke) this.cursor.visible = false;
      return;
    }
    const b = this.currentBrush(e);
    this.cursor.visible = true;
    this.cursor.position.copy(hit.world).addScaledVector(hit.worldNormal, 0.002);
    this.cursor.lookAt(hit.world.clone().add(hit.worldNormal));
    this.cursor.scale.setScalar(this.settings.radius);
    this.cursor.material.color.set(b.kind === 'paint' ? this.settings.color : e.ctrlKey || e.metaKey ? '#ff6b6b' : '#ffffff');
  }

  /** After a stroke / undo: rebuild things that depend on the whole mesh. */
  finishEdit(paintOnly = false) {
    if (!paintOnly) {
      this.app.assembler.refreshSculptBounds();
      this.app.dirty.effects = true;
    }
    this.persist();
    this.emit();
  }
}

function concatSnap(a, b) {
  const cat = (x, y) => {
    const out = new x.constructor(x.length + y.length);
    out.set(x);
    out.set(y, x.length);
    return out;
  };
  return { ids: cat(a.ids, b.ids), pos: cat(a.pos, b.pos), paint: cat(a.paint, b.paint), glow: cat(a.glow, b.glow) };
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('cube-creator:brush')) || {};
  } catch {
    return {};
  }
}
