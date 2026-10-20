import * as THREE from 'three';
import { shapes, modifiers, effects, particlePresets } from '../registries.js';
import { withDefaults } from '../core/schema.js';
import { TextureBuilder } from '../surface/TextureBuilder.js';
import { MaterialBuilder } from '../materials/MaterialBuilder.js';
import { ParticleEmitter, EMITTER_SCHEMA } from '../particles/index.js';
import { smoothNormals, flatNormals, dropDegenerate } from './geometryUtils.js';

/**
 * Builds and animates the cube object graph from the design state:
 *
 *   root  "ClickerCube"           (exported root)
 *   ├─ pivot                      bob / pulse / click squash
 *   │  ├─ mesh "CubeMesh"         spin; 'mesh' effects attach here
 *   │  ├─ 'pivot' effects         (rings, core, halo...)
 *   │  └─ particles               (viewer only)
 *   └─ 'world' effects            (pedestal)
 */
export class CubeAssembler {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'ClickerCube';
    this.pivot = new THREE.Group();
    this.pivot.name = 'Pivot';
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    this.mesh.name = 'CubeMesh';
    this.mesh.castShadow = true;
    this.pivot.add(this.mesh);
    this.root.add(this.pivot);

    this.textures = new TextureBuilder();
    this.materials = new MaterialBuilder();
    this.bounds = new THREE.Vector3(0.5, 0.5, 0.5);
    this.effectInstances = [];
    this.emitters = new Map(); // uid -> ParticleEmitter
    this.burstEmitter = null;
    this.time = 0;
    this.squash = { v: 0, x: 0 }; // spring state
  }

  // ---------------------------------------------------------------- geometry
  buildGeometry(state, sculpt = null) {
    if (sculpt) return this.useGeometry(sculpt.geometry);
    const shape = shapes.get(state.shape.type) || shapes.get('cube');
    const params = withDefaults(shape.params, state.shape.params[shape.id]);
    let g = shape.build(params);
    // Built-in three.js geometries (box, cylinder, extrude...) tag faces with their own
    // material groups. Only grout-aware shapes use groups (0 = surface, 1 = grout);
    // anything else must render as one surface or faces without a material vanish.
    if (!shape.usesGrout) g.clearGroups();

    // normalise into a unit cube centred on the origin
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const size = bb.getSize(new THREE.Vector3());
    const center = bb.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(size.x, size.y, size.z, 1e-6);
    g.translate(-center.x, -center.y, -center.z);
    g.scale(k, k, k);

    // modifier stack
    const v = new THREE.Vector3();
    for (const entry of state.modifiers) {
      if (!entry.enabled) continue;
      const mod = modifiers.get(entry.type);
      if (!mod) continue;
      const p = withDefaults(mod.params, entry.params);
      if (mod.apply) g = mod.apply(g, p);
      if (mod.deform) {
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          mod.deform(v, p);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        pos.needsUpdate = true;
      }
    }

    const s = state.size;
    g.scale(s.x * s.scale, s.y * s.scale, s.z * s.scale);

    const smooth = state.shading === 'smooth' || (state.shading === 'auto' && (g.userData.smooth ?? shape.smooth));
    g = dropDegenerate(g);
    g = smooth ? smoothNormals(g) : flatNormals(g);

    this.proceduralGeometry?.dispose();
    this.proceduralGeometry = g; // kept so a sculpt can be frozen from it
    this.useGeometry(g);
  }

  useGeometry(g) {
    this.mesh.geometry = g;
    this.hasGrout = g.groups.some((gr) => gr.materialIndex === 1);
    this.hasVertexColors = !!g.attributes.color;
    this.refreshSculptBounds();
  }

  /** Recompute bounds after the geometry changed in place (sculpting). */
  refreshSculptBounds() {
    const g = this.mesh.geometry;
    g.computeBoundingBox();
    g.computeBoundingSphere();
    g.boundingBox.getSize(this.bounds).multiplyScalar(0.5);
    this.emitters.forEach((e) => e.setBounds(this.bounds));
    this.burstEmitter?.setBounds(this.bounds);
  }

  // ---------------------------------------------------------------- material
  buildMaterial(state, sculpt = null) {
    const tex = this.textures.build(state.surface);
    const { main, grout } = this.materials.update(state, tex, {
      vertexColors: this.hasVertexColors,
      flatShading: state.shading === 'flat',
    });
    if (this.mesh.geometry.userData.sculpt && sculpt) {
      sculpt.setMaterialColor(new THREE.Color(state.material.color));
      main.color.setRGB(1, 1, 1);
    }
    this.materials.setSculptGlow(state.sculpt?.glow ?? 0, !!this.mesh.geometry.attributes.sculptGlow);
    this.mesh.material = this.hasGrout ? [main, grout] : main;
    this.mesh.castShadow = state.material.transmission < 0.5 && state.material.opacity > 0.5;
  }

  // ----------------------------------------------------------------- effects
  buildEffects(state) {
    this.effectInstances.forEach((e) => {
      e.instance.object?.removeFromParent();
      e.instance.dispose?.();
    });
    this.effectInstances = [];
    const ctx = { geometry: this.mesh.geometry, bounds: this.bounds.clone(), mesh: this.mesh, pivot: this.pivot };
    for (const entry of state.effects) {
      if (!entry.enabled) continue;
      const fx = effects.get(entry.type);
      if (!fx) continue;
      const params = withDefaults(fx.params, entry.params);
      try {
        const instance = fx.create(ctx, params);
        const parent = instance.attach === 'mesh' ? this.mesh : instance.attach === 'world' ? this.root : this.pivot;
        if (instance.object) {
          instance.object.userData.isEffect = true;
          parent.add(instance.object);
        }
        this.effectInstances.push({ instance, params });
      } catch (err) {
        console.error(`effect ${entry.type} failed`, err);
      }
    }
  }

  // --------------------------------------------------------------- particles
  syncParticles(state) {
    const seen = new Set();
    for (const entry of state.particles) {
      if (!entry.enabled) continue;
      seen.add(entry.uid);
      const params = withDefaults(EMITTER_SCHEMA, entry.params);
      let em = this.emitters.get(entry.uid);
      if (!em) {
        em = new ParticleEmitter(params, this.bounds);
        this.emitters.set(entry.uid, em);
        this.pivot.add(em.points);
      } else em.setParams(params);
    }
    for (const [uid, em] of this.emitters) {
      if (!seen.has(uid)) {
        em.dispose();
        this.emitters.delete(uid);
      }
    }
    // click burst emitter
    const burstId = state.clicker.burstParticles;
    const preset = particlePresets.get(burstId);
    if (!preset || burstId === 'none') {
      this.burstEmitter?.dispose();
      this.burstEmitter = null;
    } else {
      const params = withDefaults(EMITTER_SCHEMA, { ...preset.params, rate: 0, emitFrom: 'surface', direction: 'outward', speed: Math.max(1.2, preset.params.speed || 0), lifetime: Math.min(preset.params.lifetime || 1, 1.2) });
      if (!this.burstEmitter) {
        this.burstEmitter = new ParticleEmitter(params, this.bounds, { minCapacity: 600 });
        this.pivot.add(this.burstEmitter.points);
      } else this.burstEmitter.setParams(params);
    }
  }

  // ------------------------------------------------------------------- click
  click(state) {
    this.squash.v -= 30 * state.clicker.squash;
    this.burstEmitter?.burst(state.clicker.burstCount);
  }

  // --------------------------------------------------------------- per frame
  update(state, dt, { holdStill = false } = {}) {
    this.time += dt;
    if (holdStill) {
      // sculpt mode: keep the cube perfectly still so brushes land where you point
      this.mesh.rotation.set(0, 0, 0);
      this.pivot.position.set(0, 0, 0);
      this.pivot.scale.set(1, 1, 1);
      this.squash.x = this.squash.v = 0;
      this.materials.animate(state, this.time);
      for (const { instance, params } of this.effectInstances) instance.update?.(dt, this.time, params);
      this.emitters.forEach((e) => e.update(dt));
      return;
    }
    const t = this.time;
    const a = state.animation;
    const TAU = Math.PI * 2;
    this.mesh.rotation.y += a.spinY * TAU * dt * 0.25;
    this.mesh.rotation.x += a.spinX * TAU * dt * 0.25;
    this.mesh.rotation.z = a.wobble * 0.25 * Math.sin(t * 1.7);
    this.pivot.position.y = a.bobAmplitude * Math.sin(t * a.bobSpeed * TAU);

    // squash spring
    const sq = this.squash;
    sq.v += (-sq.x * 260 - sq.v * 14) * dt;
    sq.x += sq.v * dt;
    const pulse = 1 + a.pulseScale * 0.5 * Math.sin(t * a.pulseSpeed * TAU);
    const sx = pulse * (1 - sq.x * 0.5);
    const sy = pulse * (1 + sq.x);
    this.pivot.scale.set(sx, sy, sx);

    this.materials.animate(state, t);
    for (const { instance, params } of this.effectInstances) instance.update?.(dt, t, params);
    this.emitters.forEach((e) => e.update(dt));
    this.burstEmitter?.update(dt);
  }

  dispose() {
    this.textures.dispose();
    this.materials.dispose();
  }
}
