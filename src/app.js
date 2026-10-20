import * as THREE from 'three';
import { Store } from './core/Store.js';
import { DEFAULT_STATE, migrate } from './core/defaults.js';
import { Viewer } from './viewer/Viewer.js';
import { CubeAssembler } from './cube/CubeAssembler.js';
import { UI } from './ui/UI.js';
import { SculptController } from './sculpt/SculptController.js';
import { presets, shapes, patterns } from './registries.js';
import { applyPreset } from './presets/index.js';
import { tilingOptions } from './shapes/tilings.js';
import { download, slug } from './export/prepare.js';

const STORAGE_KEY = 'cube-creator:design';

/**
 * Wires state -> 3D. Store changes mark parts of the cube dirty; the render
 * loop rebuilds only what changed, once per frame.
 */
export class App {
  constructor(root) {
    const saved = Store.loadSaved(STORAGE_KEY);
    const initial = saved ? migrate(saved) : migrate(applyPreset(DEFAULT_STATE, 'lava'));
    if (!saved) initial.name = 'My Clicker Cube';
    this.store = new Store(initial, { storageKey: STORAGE_KEY });
    this.clicks = 0;
    this.paused = false;
    this.dirty = { geometry: true, material: true, effects: true, particles: true, scene: true };

    this.ui = new UI(this, root);
    this.viewer = new Viewer(this.ui.viewport);
    this.assembler = new CubeAssembler();
    this.viewer.scene.add(this.assembler.root);
    this.sculpt = new SculptController(this);
    this.sculpt.setEditing(this.ui.active === 'sculpt');
    this.ui.rerender();
    this.sculpt.restore();

    this.store.subscribe((paths) => {
      this.markDirty(paths);
      this.ui.onStateChange(paths);
    });
    this.setupClicking();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  markDirty(paths) {
    const d = this.dirty;
    for (const p of paths) {
      const top = p.split('.')[0];
      if (p === '*') Object.keys(d).forEach((k) => (d[k] = true));
      else if (['shape', 'size', 'modifiers', 'shading'].includes(top)) d.geometry = d.material = d.effects = true;
      else if (top === 'sculpt') d.geometry = d.material = d.effects = d.particles = true;
      else if (['material', 'glow', 'grout', 'surface'].includes(top)) d.material = true;
      else if (top === 'effects') d.effects = true;
      else if (top === 'particles' || top === 'clicker') d.particles = true;
      else if (top === 'scene' || top === 'post') d.scene = true;
    }
  }

  rebuild() {
    const s = this.store.get();
    const d = this.dirty;
    try {
      const sculpt = s.sculpt.active ? this.sculpt.mesh : null;
      if (d.geometry) {
        this.assembler.buildGeometry(s, sculpt);
        this.viewer.setGroundLevel(-this.assembler.bounds.y - 0.35);
      }
      if (d.material) this.assembler.buildMaterial(s, sculpt);
      if (d.effects) this.assembler.buildEffects(s);
      if (d.particles) this.assembler.syncParticles(s);
      if (d.scene) this.viewer.applyScene(s.scene, s.post);
    } catch (err) {
      console.error(err);
      this.ui.toast(`Something went wrong: ${err.message}`, 'error');
    }
    Object.keys(d).forEach((k) => (d[k] = false));
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    if (this.paused) return;
    if (Object.values(this.dirty).some(Boolean)) this.rebuild();
    this.assembler.update(this.store.get(), dt, { holdStill: this.sculpt.editing });
    this.viewer.render();
  }

  setupClicking() {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    const hit = (e) => {
      const rect = this.viewer.renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, this.viewer.camera);
      return ray.intersectObject(this.assembler.mesh, false).length > 0;
    };
    const canvas = this.viewer.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      down = null;
      const s = this.store.get();
      if (!s.clicker.enabled || this.sculpt.editing || !hit(e)) return;
      this.assembler.click(s);
      this.clicks++;
      this.ui.setCount(this.clicks);
      const rect = this.ui.viewport.getBoundingClientRect();
      this.ui.floatText(s.clicker.floatText, e.clientX - rect.left, e.clientY - rect.top);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons) return;
      if (this.sculpt.editing) return void (canvas.style.cursor = 'crosshair');
      canvas.style.cursor = this.store.get('clicker.enabled') && hit(e) ? 'pointer' : '';
    });
  }

  // ------------------------------------------------------------- commands
  /** Undo/redo: brush strokes while sculpting, design changes otherwise. */
  undo() {
    if (this.sculpt.editing && this.sculpt.undo()) return;
    this.store.undo();
  }

  redo() {
    if (this.sculpt.editing && this.sculpt.redo()) return;
    this.store.redo();
  }

  /** Full design including the sculpted mesh (compressed), for saving to a file. */
  designJSON() {
    const data = structuredClone(this.store.get());
    const sculptData = this.sculpt.serialize();
    if (sculptData) data.sculptData = sculptData;
    return data;
  }

  newDesign() {
    const fresh = migrate(DEFAULT_STATE);
    // the default material is a white tint (so preset textures show true colours);
    // give a blank design a visible starting colour instead
    fresh.material.color = '#6f7dff';
    fresh.material.roughness = 0.3;
    if (this.sculpt.active) this.sculpt.discard();
    this.store.replace(fresh);
    this.ui.toast('New design');
  }

  loadDesign(json) {
    const { sculptData, ...design } = json;
    if (sculptData) this.sculpt.load(sculptData);
    else if (design.sculpt?.active) design.sculpt.active = false; // file has no mesh data
    this.store.replace(migrate(design));
    if (sculptData) this.sculpt.persist();
  }

  saveDesign() {
    const blob = new Blob([JSON.stringify(this.designJSON())], { type: 'application/json' });
    download(blob, `${slug(this.store.get('name'))}.cube.json`);
  }

  async quickScreenshot() {
    const blob = await this.viewer.screenshot();
    download(blob, `${slug(this.store.get('name'))}.png`);
  }

  /** Random preset + random shape tweaks. */
  randomize() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const preset = pick(presets.list());
    const next = applyPreset(this.store.get(), preset.id, { includeShape: Math.random() < 0.3 });
    if (Math.random() < 0.7) {
      const shapeIds = ['tessellated', 'tessellated', 'tessellated', 'rounded', 'voxel', 'geosphere', 'cube', 'extruded', 'gem', 'dodecahedron'];
      next.shape.type = pick(shapeIds);
      if (next.shape.type === 'tessellated') {
        next.shape.params.tessellated = {
          ...(next.shape.params.tessellated || {}),
          tiling: pick(tilingOptions()).value,
          tiles: 2 + Math.floor(Math.random() * 6),
          top: pick(['flat', 'bevel', 'pyramid', 'frame']),
          heightJitter: Math.random() * 0.6,
          seed: Math.floor(Math.random() * 9999),
        };
      }
    }
    if (Math.random() < 0.3 && next.surface.pattern === 'none') {
      next.surface.pattern = pick(patterns.list().filter((p) => p.id !== 'none')).id;
    }
    if (!shapes.has(next.shape.type)) next.shape.type = 'cube';
    this.store.replace(next);
    this.ui.toast(`Random: ${preset.label} on ${shapes.get(next.shape.type).label}`);
  }
}
