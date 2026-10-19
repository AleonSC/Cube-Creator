import { exporters } from '../registries.js';
import { exportGLTF, exportOBJ, exportSTL, exportUSDZ } from './models.js';
import { exportUnityBundle, exportBlenderBundle } from './bundles.js';
import { makeZip } from './zip.js';
import { slug } from './prepare.js';

/**
 * File exporters. run(app, options) resolves to a Blob; the UI downloads it
 * as `${slug(name)}${ext}`. Add a format = register one more descriptor.
 */
const effects = { type: 'bool', label: 'Include 3D effects (outline, rings, core...)', default: true };

exporters.registerAll([
  {
    id: 'unity',
    label: 'Unity package (.zip)',
    category: 'Game engines',
    ext: '_unity.zip',
    icon: 'unity',
    description: 'GLB + OBJ model, particle sprites and C# scripts that recreate the animation, glow, particles and click feedback.',
    params: { includeEffects: effects, includeObj: { type: 'bool', label: 'Include OBJ fallback (no glTFast needed)', default: true } },
    run: (app, o) => exportUnityBundle(app, o),
  },
  {
    id: 'blender',
    label: 'Blender bundle (.zip)',
    category: 'Game engines',
    ext: '_blender.zip',
    icon: 'blender',
    description: 'GLB with baked idle animation + a Python script that sets up bloom, world, camera, lights and particle systems.',
    params: { includeEffects: effects, bakeAnimation: { type: 'bool', label: 'Bake idle animation', default: true } },
    run: (app, o) => exportBlenderBundle(app, o),
  },
  {
    id: 'glb',
    label: 'glTF binary (.glb)',
    category: '3D models',
    ext: '.glb',
    description: 'Single-file PBR model with textures, glow and (optional) idle animation. Best for Unity (glTFast), Blender, Godot and the web.',
    params: {
      includeEffects: effects,
      bakeAnimation: { type: 'bool', label: 'Bake idle animation clip', default: true },
      includeLights: { type: 'bool', label: 'Include lights (core glow light)', default: true },
    },
    run: (app, o) => exportGLTF(app, { ...o, binary: true }),
  },
  {
    id: 'gltf',
    label: 'glTF JSON (.gltf)',
    category: '3D models',
    ext: '.gltf',
    description: 'Human-readable glTF with embedded buffers and textures.',
    params: { includeEffects: effects, bakeAnimation: { type: 'bool', label: 'Bake idle animation clip', default: true } },
    run: (app, o) => exportGLTF(app, { ...o, binary: false }),
  },
  {
    id: 'obj',
    label: 'OBJ + MTL (.zip)',
    category: '3D models',
    ext: '_obj.zip',
    description: 'Universal mesh format with materials and PNG textures. Imports natively everywhere.',
    params: { includeEffects: effects },
    async run(app, o) {
      const name = slug(app.store.get('name'));
      const r = await exportOBJ(app, { ...o, baseName: name });
      return makeZip({ [`${name}.obj`]: r.obj, [`${name}.mtl`]: r.mtl, ...r.textures });
    },
  },
  {
    id: 'stl',
    label: 'STL (.stl)',
    category: '3D models',
    ext: '.stl',
    description: 'Geometry only, for 3D printing.',
    params: { includeEffects: { ...effects, default: false } },
    run: (app, o) => exportSTL(app, o),
  },
  {
    id: 'usdz',
    label: 'USDZ (.usdz)',
    category: '3D models',
    ext: '.usdz',
    description: 'Apple AR Quick Look / Reality Composer.',
    params: { includeEffects: effects },
    run: (app, o) => exportUSDZ(app, o),
  },
  {
    id: 'png',
    label: 'PNG image',
    category: 'Images',
    ext: '.png',
    description: 'Render of the current view — great for icons and store art.',
    params: {
      size: { type: 'select', label: 'Size', options: [{ value: 256, label: '256 px' }, { value: 512, label: '512 px' }, { value: 1024, label: '1024 px' }, { value: 2048, label: '2048 px' }], default: 1024 },
      transparent: { type: 'bool', label: 'Transparent background', default: true },
    },
    run: (app, o) => app.viewer.screenshot({ width: Number(o.size), height: Number(o.size), transparent: o.transparent }),
  },
  {
    id: 'spritesheet',
    label: 'Turntable sprite sheet',
    category: 'Images',
    ext: '_sheet.png',
    description: 'Rotating frames in a grid for 2D / pixel clicker games (Unity Sprite Editor: Grid By Cell Count).',
    params: {
      frames: { type: 'int', label: 'Frames', min: 4, max: 64, default: 16 },
      size: { type: 'select', label: 'Frame size', options: [{ value: 64, label: '64 px' }, { value: 128, label: '128 px' }, { value: 256, label: '256 px' }, { value: 512, label: '512 px' }], default: 128 },
      transparent: { type: 'bool', label: 'Transparent background', default: true },
    },
    async run(app, o) {
      const size = Number(o.size);
      const cols = Math.ceil(Math.sqrt(o.frames));
      const rows = Math.ceil(o.frames / cols);
      const mesh = app.assembler.mesh;
      const prevRot = mesh.rotation.y;
      app.paused = true;
      try {
        const bitmaps = await app.viewer.capture({
          width: size,
          height: size,
          transparent: o.transparent,
          frames: o.frames,
          beforeFrame: (i) => (mesh.rotation.y = (i / o.frames) * Math.PI * 2),
        });
        const c = document.createElement('canvas');
        c.width = cols * size;
        c.height = rows * size;
        const g = c.getContext('2d');
        bitmaps.forEach((b, i) => g.drawImage(b, (i % cols) * size, Math.floor(i / cols) * size));
        return await new Promise((res) => c.toBlob(res, 'image/png'));
      } finally {
        mesh.rotation.y = prevRot;
        app.paused = false;
      }
    },
  },
  {
    id: 'design',
    label: 'Cube design (.json)',
    category: 'Design',
    ext: '.cube.json',
    description: 'Save the editable design to load back into Cube Creator later.',
    params: {},
    run: (app) => new Blob([JSON.stringify(app.store.get(), null, 2)], { type: 'application/json' }),
  },
]);
