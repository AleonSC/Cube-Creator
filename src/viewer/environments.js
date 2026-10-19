import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Reflection environments. Each returns a THREE.Scene that is baked into a
 * PMREM env map. Add one = add an entry.
 */
function skyScene({ top, horizon, bottom, panels = [] }) {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const cTop = new THREE.Color(top), cHor = new THREE.Color(horizon), cBot = new THREE.Color(bottom);
  const colors = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    const c = y > 0 ? cHor.clone().lerp(cTop, Math.pow(y, 0.6)) : cHor.clone().lerp(cBot, Math.pow(-y, 0.4));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const p of panels) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.intensity), side: THREE.DoubleSide }));
    m.position.set(...p.pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  return scene;
}

export const ENVIRONMENTS = {
  studio: { label: 'Studio', build: () => new RoomEnvironment() },
  sunset: {
    label: 'Sunset',
    build: () => skyScene({ top: '#2b3a7a', horizon: '#ff8a4c', bottom: '#2a1a1a', panels: [{ pos: [6, 1.5, -5], w: 4, h: 2, color: '#ffb36b', intensity: 12 }] }),
  },
  night: {
    label: 'Night city',
    build: () => skyScene({ top: '#05060f', horizon: '#1a2250', bottom: '#020203', panels: [{ pos: [-6, 2, 4], w: 3, h: 6, color: '#ff3dbb', intensity: 6 }, { pos: [6, 2, -3], w: 3, h: 6, color: '#3dd9ff', intensity: 6 }] }),
  },
  daylight: {
    label: 'Daylight',
    build: () => skyScene({ top: '#5ea4ff', horizon: '#dff0ff', bottom: '#6b6151', panels: [{ pos: [4, 8, 3], w: 2.5, h: 2.5, color: '#fff6e0', intensity: 10 }] }),
  },
  inferno: {
    label: 'Inferno',
    build: () => skyScene({ top: '#1a0000', horizon: '#ff3300', bottom: '#2a0800', panels: [{ pos: [0, -6, 5], w: 8, h: 3, color: '#ff6a00', intensity: 8 }] }),
  },
  arctic: {
    label: 'Arctic',
    build: () => skyScene({ top: '#9fd8ff', horizon: '#ffffff', bottom: '#cfe9ff', panels: [{ pos: [5, 6, 5], w: 3, h: 3, color: '#ffffff', intensity: 10 }] }),
  },
  none: { label: 'None', build: null },
};
