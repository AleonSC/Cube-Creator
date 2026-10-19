import * as THREE from 'three';
import { createRng } from '../core/rng.js';
import { getSpriteTexture } from './sprites.js';

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.001, -mv.z);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vAlpha = aAlpha;
  }
`;
const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    float a = tex.a * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor * tex.rgb, a);
  }
`;

/**
 * CPU-simulated point-sprite particle emitter driven entirely by a params
 * object (see EMITTER_SCHEMA). `bounds` = half extents of the cube.
 */
export class ParticleEmitter {
  constructor(params, bounds, { minCapacity = 0 } = {}) {
    this.minCapacity = minCapacity;
    this.params = params;
    this.bounds = bounds.clone();
    this.rng = createRng(params.seed || 1);
    this.accum = 0;
    this.cursor = 0;
    this.time = 0;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: getSpriteTexture(params.sprite) }, uScale: { value: 500 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(new THREE.BufferGeometry(), this.material);
    this.points.frustumCulled = false;
    this.points.userData.noExport = true;
    this.points.onBeforeRender = (renderer, scene, camera) => {
      const h = renderer.getDrawingBufferSize(tmpV2).y;
      this.material.uniforms.uScale.value = camera.projectionMatrix.elements[5] * h * 0.5;
    };
    this.setParams(params);
  }

  setParams(params) {
    this.params = params;
    this.material.uniforms.uMap.value = getSpriteTexture(params.sprite);
    this.material.blending = params.blending === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending;
    const cap = Math.max(this.minCapacity, Math.min(6000, Math.ceil(params.rate * params.lifetime * (1 + params.lifetimeVar) * 1.15) + 64));
    if (!this.capacity || cap > this.capacity || cap < this.capacity / 3) this.allocate(cap);
    this.c0 = new THREE.Color(params.colorStart);
    this.c1 = new THREE.Color(params.colorEnd);
  }

  allocate(n) {
    this.capacity = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(1);
    this.life = new Float32Array(n).fill(0);
    this.size0 = new Float32Array(n);
    this.hue = new Float32Array(n);
    this.cursor = 0;
    const g = this.points.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(n), 1));
  }

  setBounds(b) {
    this.bounds.copy(b);
  }

  /** Emit `count` particles immediately (click bursts). */
  burst(count, origin) {
    for (let i = 0; i < count; i++) this.spawn(origin);
  }

  spawn(origin) {
    const p = this.params;
    const r = this.rng;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const b = tmpB.copy(this.bounds).multiplyScalar(p.emitScale);
    const P = tmpP;
    const maxB = Math.max(b.x, b.y, b.z);
    switch (p.emitFrom) {
      case 'volume': P.set(r.range(-b.x, b.x), r.range(-b.y, b.y), r.range(-b.z, b.z)); break;
      case 'top': P.set(r.range(-b.x, b.x), b.y, r.range(-b.z, b.z)); break;
      case 'bottom': P.set(r.range(-b.x, b.x), -b.y, r.range(-b.z, b.z)); break;
      case 'sphere': randomUnit(r, P).multiplyScalar(maxB * 1.25); break;
      case 'ring': { const a = r() * Math.PI * 2; P.set(Math.cos(a) * maxB * 1.4, r.range(-0.05, 0.05), Math.sin(a) * maxB * 1.4); break; }
      case 'point': P.set(0, 0, 0); break;
      case 'above': P.set(r.range(-b.x, b.x) * 2, b.y * 3.5, r.range(-b.z, b.z) * 2); break;
      default: {
        // surface: pick a face weighted by area
        const ax = b.y * b.z, ay = b.x * b.z, az = b.x * b.y;
        let k = r() * (ax + ay + az) * 2;
        const s = r.sign();
        if ((k -= ax * 2) < 0) P.set(s * b.x, r.range(-b.y, b.y), r.range(-b.z, b.z));
        else if ((k -= ay * 2) < 0) P.set(r.range(-b.x, b.x), s * b.y, r.range(-b.z, b.z));
        else P.set(r.range(-b.x, b.x), r.range(-b.y, b.y), s * b.z);
      }
    }
    if (origin) P.add(origin);

    const D = tmpD;
    switch (p.direction) {
      case 'down': D.set(0, -1, 0); break;
      case 'outward': D.copy(P).normalize(); if (D.lengthSq() === 0) randomUnit(r, D); break;
      case 'inward': D.copy(P).normalize().negate(); break;
      case 'random': randomUnit(r, D); break;
      case 'orbit': D.set(-P.z, 0, P.x).normalize(); break;
      case 'swirlUp': D.set(-P.z, 0, P.x).normalize().multiplyScalar(0.7).add(UP).normalize(); break;
      default: D.set(0, 1, 0);
    }
    if (p.spread > 0) D.add(randomUnit(r, tmpR).multiplyScalar(p.spread * 1.5)).normalize();
    const speed = p.speed * (1 - p.speedVar * r());

    this.pos[i * 3] = P.x; this.pos[i * 3 + 1] = P.y; this.pos[i * 3 + 2] = P.z;
    this.vel[i * 3] = D.x * speed; this.vel[i * 3 + 1] = D.y * speed; this.vel[i * 3 + 2] = D.z * speed;
    this.age[i] = 0;
    this.life[i] = p.lifetime * (1 - p.lifetimeVar * r());
    this.size0[i] = p.size * (0.6 + 0.8 * r());
    this.hue[i] = r();
  }

  update(dt) {
    const p = this.params;
    this.time += dt;
    if (p.rate > 0) {
      this.accum += p.rate * dt;
      const n = Math.min(Math.floor(this.accum), this.capacity);
      this.accum -= n;
      for (let k = 0; k < n; k++) this.spawn();
    }
    const g = this.points.geometry;
    const pa = g.attributes.position.array;
    const ca = g.attributes.aColor.array;
    const sa = g.attributes.aSize.array;
    const aa = g.attributes.aAlpha.array;
    const drag = Math.max(0, 1 - p.drag * dt);
    const turb = p.turbulence;
    const orbit = p.direction === 'orbit' || p.direction === 'swirlUp';
    const col = tmpC;
    for (let i = 0; i < this.capacity; i++) {
      const life = this.life[i];
      let age = this.age[i];
      if (age >= life) {
        sa[i] = 0;
        aa[i] = 0;
        continue;
      }
      age += dt;
      this.age[i] = age;
      const t = age / life;
      const j = i * 3;
      let vx = this.vel[j], vy = this.vel[j + 1], vz = this.vel[j + 2];
      let x = this.pos[j], y = this.pos[j + 1], z = this.pos[j + 2];
      vy -= p.gravity * dt;
      if (turb > 0) {
        const tt = this.time * 1.7;
        vx += Math.sin(y * 3.1 + tt + i) * turb * dt;
        vy += Math.sin(z * 2.7 + tt * 1.3) * turb * dt * 0.5;
        vz += Math.cos(x * 3.3 + tt * 0.9 + i) * turb * dt;
      }
      vx *= drag; vy *= drag; vz *= drag;
      if (orbit) {
        const ang = p.speed * dt * 1.2;
        const c = Math.cos(ang), s = Math.sin(ang);
        const nx = x * c - z * s;
        z = x * s + z * c;
        x = nx;
      }
      x += vx * dt; y += vy * dt; z += vz * dt;
      this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
      this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
      pa[j] = x; pa[j + 1] = y; pa[j + 2] = z;

      sa[i] = this.size0[i] * (1 + (p.sizeEnd - 1) * t);
      let alpha = p.opacity * Math.min(1, (1 - t) / 0.35);
      if (p.fadeIn > 0) alpha *= Math.min(1, t / p.fadeIn);
      if (p.twinkle > 0) alpha *= 1 - p.twinkle * (0.5 + 0.5 * Math.sin(this.time * 18 + i * 7.3));
      aa[i] = Math.max(0, alpha);
      if (p.colorMode === 'randomHue') col.setHSL(this.hue[i], 0.9, 0.6);
      else col.copy(this.c0).lerp(this.c1, t);
      ca[j] = col.r * p.brightness; ca[j + 1] = col.g * p.brightness; ca[j + 2] = col.b * p.brightness;
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpP = new THREE.Vector3();
const tmpD = new THREE.Vector3();
const tmpR = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Color();
const tmpV2 = new THREE.Vector2();
function randomUnit(r, out) {
  const u = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(a), u, s * Math.sin(a));
}
