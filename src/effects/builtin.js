import * as THREE from 'three';
import { effects } from '../registries.js';
import { smoothNormals, flipWinding } from '../cube/geometryUtils.js';
import { createRng } from '../core/rng.js';

/**
 * Attached 3D effects. create(ctx, params) returns an instance:
 *   { object, attach: 'mesh' | 'pivot', update?(dt, t, params), dispose?() }
 * ctx = { geometry, bounds (half extents), mesh, pivot }
 * 'mesh'  => spins with the cube;  'pivot' => stays upright, follows bob/scale.
 * Objects flagged userData.noExport are viewer-only (custom shaders/sprites).
 */
const glowMat = (color, intensity) =>
  new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0 });

effects.registerAll([
  {
    id: 'outline',
    label: 'Toon outline',
    params: {
      color: { type: 'color', label: 'Colour', default: '#000000' },
      thickness: { type: 'range', label: 'Thickness', min: 0.002, max: 0.1, step: 0.001, default: 0.02 },
      glow: { type: 'range', label: 'Glow', min: 0, max: 10, step: 0.1, default: 0 },
    },
    create(ctx, p) {
      let g = smoothNormals(ctx.geometry.clone());
      const pos = g.attributes.position;
      const nor = g.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i, pos.getX(i) + nor.getX(i) * p.thickness, pos.getY(i) + nor.getY(i) * p.thickness, pos.getZ(i) + nor.getZ(i) * p.thickness);
      }
      g.clearGroups();
      if (g.attributes.color) g.deleteAttribute('color'); // glTF would tint the outline otherwise
      g = flipWinding(g);
      const c = new THREE.Color(p.color).multiplyScalar(1 + p.glow);
      const mat = new THREE.MeshBasicMaterial({ color: c, name: 'Outline' });
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = 'Outline';
      return { object: mesh, attach: 'mesh', dispose: () => { g.dispose(); mat.dispose(); } };
    },
  },
  {
    id: 'wireframe',
    label: 'Glowing edges',
    params: {
      color: { type: 'color', label: 'Colour', default: '#7df9ff' },
      brightness: { type: 'range', label: 'Brightness', min: 0, max: 10, step: 0.1, default: 3 },
      thickness: { type: 'range', label: 'Thickness', min: 0, max: 0.03, step: 0.0005, default: 0.004, hint: '0 = hairline (viewer only); >0 = real geometry that exports' },
      angle: { type: 'range', label: 'Edge angle threshold', min: 1, max: 90, step: 1, default: 25 },
      offset: { type: 'range', label: 'Offset', min: 0, max: 0.05, step: 0.001, default: 0.003 },
    },
    create(ctx, p) {
      const edges = new THREE.EdgesGeometry(ctx.geometry, p.angle);
      const s = 1 + p.offset * 2;
      edges.scale(s, s, s);
      const color = new THREE.Color(p.color);
      if (p.thickness <= 0) {
        const mat = new THREE.LineBasicMaterial({ color: color.multiplyScalar(p.brightness) });
        const lines = new THREE.LineSegments(edges, mat);
        lines.userData.noExport = true;
        return { object: lines, attach: 'mesh', dispose: () => { edges.dispose(); mat.dispose(); } };
      }
      const g = edgeTubes(edges, p.thickness);
      edges.dispose();
      const mat = glowMat(color, p.brightness);
      mat.name = 'EdgeGlow';
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = 'GlowEdges';
      return { object: mesh, attach: 'mesh', dispose: () => { g.dispose(); mat.dispose(); } };
    },
  },
  {
    id: 'aura',
    label: 'Aura (fresnel glow shell)',
    params: {
      color: { type: 'color', label: 'Colour', default: '#4dc9ff' },
      intensity: { type: 'range', label: 'Intensity', min: 0, max: 6, step: 0.05, default: 1.6 },
      power: { type: 'range', label: 'Edge falloff', min: 0.5, max: 8, step: 0.1, default: 2.5 },
      size: { type: 'range', label: 'Size', min: 1, max: 2, step: 0.01, default: 1.18 },
      pulse: { type: 'range', label: 'Pulse', min: 0, max: 1, step: 0.01, default: 0.25 },
      speed: { type: 'range', label: 'Pulse speed', min: 0, max: 6, step: 0.05, default: 1.5 },
    },
    create(ctx, p) {
      const g = smoothNormals(ctx.geometry.clone());
      g.clearGroups();
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(p.color) }, uIntensity: { value: p.intensity }, uPower: { value: p.power } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uIntensity; uniform float uPower;
          varying vec3 vN; varying vec3 vV;
          void main() {
            float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
            gl_FragColor = vec4(uColor * uIntensity * f, f);
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.scale.setScalar(p.size);
      mesh.userData.noExport = true;
      return {
        object: mesh,
        attach: 'mesh',
        update(dt, t) {
          const k = 1 - p.pulse * 0.5 + p.pulse * 0.5 * Math.sin(t * p.speed * Math.PI * 2);
          mat.uniforms.uIntensity.value = p.intensity * k;
          mesh.scale.setScalar(p.size * (1 + p.pulse * 0.03 * Math.sin(t * p.speed * Math.PI * 2)));
        },
        dispose: () => { g.dispose(); mat.dispose(); },
      };
    },
  },
  {
    id: 'halo',
    label: 'Halo glow (billboard)',
    params: {
      color: { type: 'color', label: 'Colour', default: '#ffb84d' },
      size: { type: 'range', label: 'Size', min: 0.5, max: 6, step: 0.05, default: 2.4 },
      intensity: { type: 'range', label: 'Intensity', min: 0, max: 3, step: 0.05, default: 0.8 },
    },
    create(ctx, p) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g2 = c.getContext('2d');
      const grd = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.3, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g2.fillStyle = grd;
      g2.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(p.color).multiplyScalar(p.intensity), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(p.size);
      sprite.renderOrder = -1;
      sprite.userData.noExport = true;
      return { object: sprite, attach: 'pivot', dispose: () => { tex.dispose(); mat.dispose(); } };
    },
  },
  {
    id: 'rings',
    label: 'Orbit rings',
    params: {
      count: { type: 'int', label: 'Rings', min: 1, max: 6, default: 2 },
      radius: { type: 'range', label: 'Radius', min: 0.5, max: 2.5, step: 0.01, default: 1.05 },
      thickness: { type: 'range', label: 'Thickness', min: 0.002, max: 0.1, step: 0.001, default: 0.012 },
      color: { type: 'color', label: 'Colour', default: '#8af3ff' },
      glow: { type: 'range', label: 'Glow', min: 0, max: 10, step: 0.1, default: 3 },
      speed: { type: 'range', label: 'Spin speed', min: -3, max: 3, step: 0.01, default: 0.6 },
      tilt: { type: 'range', label: 'Tilt spread', min: 0, max: 1, step: 0.01, default: 0.6 },
      seed: { type: 'seed', label: 'Seed', default: 4 },
    },
    create(ctx, p) {
      const group = new THREE.Group();
      group.name = 'OrbitRings';
      const rng = createRng(p.seed);
      const mat = glowMat(p.color, p.glow);
      mat.name = 'RingGlow';
      const geos = [];
      for (let i = 0; i < p.count; i++) {
        const g = new THREE.TorusGeometry(p.radius * (1 + i * 0.12), p.thickness, 8, 128);
        geos.push(g);
        const ring = new THREE.Mesh(g, mat);
        ring.rotation.set(Math.PI / 2 + rng.range(-1, 1) * p.tilt * 1.2, rng.range(-1, 1) * p.tilt, 0);
        ring.userData.spin = (rng() * 0.5 + 0.75) * (i % 2 ? -1 : 1);
        group.add(ring);
      }
      return {
        object: group,
        attach: 'pivot',
        update(dt) {
          group.children.forEach((r) => (r.rotation.z += dt * p.speed * r.userData.spin));
        },
        dispose: () => { geos.forEach((g) => g.dispose()); mat.dispose(); },
      };
    },
  },
  {
    id: 'satellites',
    label: 'Orbiting satellites',
    params: {
      count: { type: 'int', label: 'Count', min: 1, max: 12, default: 3 },
      shape: { type: 'select', label: 'Shape', options: ['cube', 'sphere', 'octahedron'], default: 'cube' },
      size: { type: 'range', label: 'Size', min: 0.02, max: 0.4, step: 0.005, default: 0.1 },
      radius: { type: 'range', label: 'Orbit radius', min: 0.6, max: 2.5, step: 0.01, default: 1.1 },
      speed: { type: 'range', label: 'Speed', min: -4, max: 4, step: 0.01, default: 1 },
      useCubeMaterial: { type: 'bool', label: 'Use cube material', default: true },
      color: { type: 'color', label: 'Colour', default: '#ffffff', showIf: (q) => !q.useCubeMaterial },
      glow: { type: 'range', label: 'Glow', min: 0, max: 10, step: 0.1, default: 1, showIf: (q) => !q.useCubeMaterial },
    },
    create(ctx, p) {
      const group = new THREE.Group();
      group.name = 'Satellites';
      const g = p.shape === 'sphere' ? new THREE.SphereGeometry(p.size / 2, 16, 12) : p.shape === 'octahedron' ? new THREE.OctahedronGeometry(p.size / 2) : new THREE.BoxGeometry(p.size, p.size, p.size);
      g.setAttribute('sculptGlow', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
      const own = p.useCubeMaterial ? null : glowMat(p.color, p.glow);
      if (own) own.color.set(p.color);
      const mat = own || (Array.isArray(ctx.mesh.material) ? ctx.mesh.material[0] : ctx.mesh.material);
      for (let i = 0; i < p.count; i++) {
        const m = new THREE.Mesh(g, mat);
        m.userData.phase = (i / p.count) * Math.PI * 2;
        group.add(m);
      }
      return {
        object: group,
        attach: 'pivot',
        update(dt, t) {
          group.children.forEach((m, i) => {
            const a = m.userData.phase + t * p.speed;
            m.position.set(Math.cos(a) * p.radius, Math.sin(a * 2 + i) * 0.15, Math.sin(a) * p.radius);
            m.rotation.set(t + i, t * 1.3, 0);
          });
        },
        dispose: () => { g.dispose(); own?.dispose(); },
      };
    },
  },
  {
    id: 'core',
    label: 'Inner glowing core + light',
    params: {
      shape: { type: 'select', label: 'Core shape', options: ['sphere', 'icosahedron', 'cube', 'none'], default: 'icosahedron' },
      size: { type: 'range', label: 'Core size', min: 0.05, max: 0.9, step: 0.01, default: 0.35 },
      color: { type: 'color', label: 'Colour', default: '#ff6a00' },
      glow: { type: 'range', label: 'Core glow', min: 0, max: 20, step: 0.1, default: 6 },
      light: { type: 'range', label: 'Light intensity', min: 0, max: 20, step: 0.1, default: 3 },
      spin: { type: 'range', label: 'Core spin', min: -4, max: 4, step: 0.01, default: 1 },
    },
    create(ctx, p) {
      const group = new THREE.Group();
      group.name = 'Core';
      const light = new THREE.PointLight(p.color, p.light, 4, 2);
      light.name = 'CoreLight';
      group.add(light);
      let g = null;
      let mat = null;
      let mesh = null;
      if (p.shape !== 'none') {
        const r = p.size / 2;
        g = p.shape === 'sphere' ? new THREE.SphereGeometry(r, 24, 16) : p.shape === 'cube' ? new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6) : new THREE.IcosahedronGeometry(r, 0);
        mat = glowMat(p.color, p.glow);
        mat.color.set(p.color);
        mat.name = 'CoreGlow';
        mesh = new THREE.Mesh(g, mat);
        mesh.name = 'CoreMesh';
        group.add(mesh);
      }
      return {
        object: group,
        attach: 'pivot',
        update(dt) {
          if (mesh) {
            mesh.rotation.y += dt * p.spin;
            mesh.rotation.x += dt * p.spin * 0.6;
          }
        },
        dispose: () => { g?.dispose(); mat?.dispose(); light.dispose(); },
      };
    },
  },
  {
    id: 'lightning',
    label: 'Lightning arcs',
    params: {
      count: { type: 'int', label: 'Bolts', min: 1, max: 12, default: 4 },
      color: { type: 'color', label: 'Colour', default: '#9fd0ff' },
      brightness: { type: 'range', label: 'Brightness', min: 0.5, max: 12, step: 0.1, default: 5 },
      reach: { type: 'range', label: 'Reach', min: 0.05, max: 1.5, step: 0.01, default: 0.45 },
      jag: { type: 'range', label: 'Jaggedness', min: 0, max: 0.3, step: 0.005, default: 0.08 },
      rate: { type: 'range', label: 'Flicker rate', min: 1, max: 30, step: 0.5, default: 12 },
    },
    create(ctx, p) {
      const SEG = 10;
      const g = new THREE.BufferGeometry();
      const arr = new Float32Array(p.count * SEG * 2 * 3);
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.brightness), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const lines = new THREE.LineSegments(g, mat);
      lines.frustumCulled = false;
      lines.userData.noExport = true;
      const b = ctx.bounds;
      const v = new THREE.Vector3();
      const onSurface = () => {
        v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        const ax = ['x', 'y', 'z'][Math.floor(Math.random() * 3)];
        v[ax] = Math.sign(v[ax]) || 1;
        return v.set(v.x * b.x, v.y * b.y, v.z * b.z).clone();
      };
      let acc = 1;
      const regen = () => {
        let w = 0;
        for (let k = 0; k < p.count; k++) {
          const a = onSurface();
          const end = a.clone().add(a.clone().normalize().multiplyScalar(p.reach)).add(new THREE.Vector3().randomDirection().multiplyScalar(p.reach * 0.6));
          let prev = a;
          for (let s = 1; s <= SEG; s++) {
            const t = s / SEG;
            const pt = a.clone().lerp(end, t);
            if (s < SEG) pt.add(new THREE.Vector3().randomDirection().multiplyScalar(p.jag));
            arr.set([prev.x, prev.y, prev.z, pt.x, pt.y, pt.z], w);
            w += 6;
            prev = pt;
          }
        }
        g.attributes.position.needsUpdate = true;
      };
      return {
        object: lines,
        attach: 'mesh',
        update(dt) {
          acc += dt * p.rate;
          if (acc >= 1) {
            acc = 0;
            regen();
            mat.opacity = 0.5 + Math.random() * 0.5;
          }
        },
        dispose: () => { g.dispose(); mat.dispose(); },
      };
    },
  },
  {
    id: 'pedestal',
    label: 'Pedestal / base',
    params: {
      shape: { type: 'select', label: 'Shape', options: ['round', 'square', 'hex'], default: 'round' },
      color: { type: 'color', label: 'Colour', default: '#2a2f3d' },
      metalness: { type: 'range', label: 'Metalness', min: 0, max: 1, step: 0.01, default: 0.6 },
      glowColor: { type: 'color', label: 'Rim glow colour', default: '#4dc9ff' },
      glow: { type: 'range', label: 'Rim glow', min: 0, max: 10, step: 0.1, default: 2 },
      gap: { type: 'range', label: 'Hover height', min: 0, max: 0.8, step: 0.01, default: 0.25 },
    },
    create(ctx, p) {
      const sides = p.shape === 'square' ? 4 : p.shape === 'hex' ? 6 : 48;
      const r = Math.max(ctx.bounds.x, ctx.bounds.z) * 1.35;
      const g = new THREE.CylinderGeometry(r * 0.92, r, 0.12, sides, 1);
      const rimG = new THREE.CylinderGeometry(r * 0.93, r * 0.93, 0.02, sides, 1, true);
      const mat = new THREE.MeshStandardMaterial({ color: p.color, metalness: p.metalness, roughness: 0.35, name: 'Pedestal' });
      const rimM = glowMat(p.glowColor, p.glow);
      const group = new THREE.Group();
      group.name = 'Pedestal';
      const base = new THREE.Mesh(g, mat);
      const rim = new THREE.Mesh(rimG, rimM);
      rim.position.y = 0.065;
      if (sides === 4) { base.rotation.y = Math.PI / 4; rim.rotation.y = Math.PI / 4; }
      group.add(base, rim);
      group.position.y = -ctx.bounds.y - p.gap - 0.06;
      return { object: group, attach: 'world', dispose: () => { g.dispose(); rimG.dispose(); mat.dispose(); rimM.dispose(); } };
    },
  },
]);

/** Turn line segments into thin square prisms (exportable "thick lines"). */
function edgeTubes(edges, r) {
  const pos = edges.attributes.position;
  const out = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const u = new THREE.Vector3(), v = new THREE.Vector3();
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let i = 0; i < pos.count; i += 2) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    d.subVectors(b, a);
    if (d.lengthSq() < 1e-12) continue;
    d.normalize();
    u.set(Math.abs(d.y) < 0.9 ? 0 : 1, Math.abs(d.y) < 0.9 ? 1 : 0, 0).cross(d).normalize();
    v.crossVectors(d, u);
    const ring = (p) => corners.map(([x, y]) => p.clone().addScaledVector(u, x * r).addScaledVector(v, y * r));
    const ra = ring(a), rb = ring(b);
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      out.push(ra[k], ra[k2], rb[k2], ra[k], rb[k2], rb[k]);
    }
  }
  const g = new THREE.BufferGeometry().setFromPoints(out);
  g.computeVertexNormals();
  return g;
}
