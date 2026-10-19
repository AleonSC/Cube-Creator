import { withDefaults } from '../core/schema.js';
import { particlePresets, particleSprites } from '../registries.js';
import { EMITTER_SCHEMA } from '../particles/index.js';
import { spriteDataURL } from '../particles/sprites.js';
import { exportGLTF, exportOBJ } from './models.js';
import { makeZip } from './zip.js';
import { makeUnityPackage } from './unitypackage.js';
import { slug } from './prepare.js';
import configCs from './templates/CubeCreatorConfig.cs?raw';
import cubeCs from './templates/CubeCreatorCube.cs?raw';
import particlesCs from './templates/CubeCreatorParticles.cs?raw';
import setupCs from './templates/CubeCreatorSetup.cs?raw';
import blenderPy from './templates/setup_blender.py?raw';

/** Engine-neutral description of runtime behaviour (animation, glow, particles). */
export function runtimeConfig(app) {
  const s = app.store.get();
  const b = app.assembler.bounds;
  const layer = (params, name) => ({ name, ...withDefaults(EMITTER_SCHEMA, params) });
  const burstRecipe = particlePresets.get(s.clicker.burstParticles);
  const burst = burstRecipe
    ? layer({ ...burstRecipe.params, rate: 0, emitFrom: 'surface', direction: 'outward', speed: Math.max(1.2, burstRecipe.params.speed || 0), lifetime: Math.min(burstRecipe.params.lifetime || 1, 1.2) }, burstRecipe.label)
    : null;
  return {
    name: s.name,
    version: s.version,
    animation: { ...s.animation },
    glow: { color: s.glow.color, intensity: s.glow.intensity },
    groutGlow: { color: s.grout.glowColor, intensity: s.grout.glow },
    clicker: { enabled: s.clicker.enabled, squash: s.clicker.squash, burstCount: s.clicker.burstCount, hasBurst: !!burst, burst },
    bounds: { x: b.x, y: b.y, z: b.z },
    particles: s.particles.filter((p) => p.enabled).map((p) => layer(p.params, p.label || p.preset || 'Layer')),
    scene: { ...s.scene },
    post: { ...s.post },
  };
}

const dataUrlToBytes = (url) => Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));

/**
 * Unity export. Shared runtime (scripts, sprites) lives at fixed paths under
 * Assets/CubeCreator so every cube reuses one copy; each cube gets its own
 * folder under Assets/CubeCreator/Cubes. As a .unitypackage the shared files
 * keep the same GUIDs, so importing more cubes updates instead of duplicating.
 */
export async function exportUnityBundle(app, { includeEffects = true, includeObj = true, format = 'unitypackage' } = {}) {
  const name = slug(app.store.get('name'));
  const base = 'Assets/CubeCreator';
  const cube = `${base}/Cubes/CubeCreator_${name}`;
  const config = runtimeConfig(app);
  const files = {};
  // the C# component drives the idle animation, so don't bake a clip into the model
  files[`${cube}/Models/${name}.glb`] = await exportGLTF(app, { binary: true, includeEffects, bakeAnimation: false });
  if (includeObj) {
    const obj = await exportOBJ(app, { includeEffects, baseName: name });
    files[`${cube}/Models/OBJ/${name}.obj`] = obj.obj;
    files[`${cube}/Models/OBJ/${name}.mtl`] = obj.mtl;
    for (const [file, blob] of Object.entries(obj.textures)) files[`${cube}/Models/OBJ/${file}`] = blob;
  }
  files[`${cube}/CubeCreatorConfig_${name}.json`] = JSON.stringify(config, null, 2);
  files[`${base}/Scripts/CubeCreatorConfig.cs`] = configCs;
  files[`${base}/Scripts/CubeCreatorCube.cs`] = cubeCs;
  files[`${base}/Scripts/CubeCreatorParticles.cs`] = particlesCs;
  files[`${base}/Scripts/Editor/CubeCreatorSetup.cs`] = setupCs;
  // ship every sprite so cubes imported later never miss one
  for (const s of particleSprites.list()) files[`${base}/Resources/CubeCreatorSprites/${s.id}.png`] = dataUrlToBytes(spriteDataURL(s.id));
  files[`${base}/README.md`] = unityReadme();
  return format === 'zip' ? makeZip(files) : makeUnityPackage(files);
}

export async function exportBlenderBundle(app, { includeEffects = true, bakeAnimation = true } = {}) {
  const name = slug(app.store.get('name'));
  const config = runtimeConfig(app);
  const glbName = `${name}.glb`;
  const json = JSON.stringify(config).replace(/'/g, '\\u0027');
  const script = blenderPy.replace('__CONFIG__', json).replace('__GLB__', glbName);
  return makeZip({
    [`${name}_blender/${glbName}`]: await exportGLTF(app, { binary: true, includeEffects, bakeAnimation }),
    [`${name}_blender/setup_blender.py`]: script,
    [`${name}_blender/cube_config.json`]: JSON.stringify(config, null, 2),
    [`${name}_blender/README.md`]: blenderReadme(name, glbName),
  });
}

function unityReadme() {
  return `# Cube Creator for Unity

## Import
1. **Install glTFast** once per project: Package Manager → \`+\` → *Add package by name* →
   \`com.unity.cloud.gltfast\`. If it shows compile errors, pick an older version in its
   *Version History* tab — or skip glTFast entirely: the OBJ copy of each cube is used
   instead (glow still works; glass/transparency must be set by hand).
2. **Import the cube:** double-click the \`.unitypackage\` (or *Assets → Import Package →
   Custom Package…*) and click **Import**. Every cube shares one copy of the scripts in
   \`Assets/CubeCreator/Scripts\`; each cube gets its own folder in \`Assets/CubeCreator/Cubes\`.
   Importing more cubes later just updates the shared scripts — no duplicates.
   (Zip export instead? Extract it into your project folder — the one that contains
   \`Assets\` — and let it merge/replace files.)
3. **Cube Creator → Set Up Cube** (top menu). With several cubes, first select the one you
   want (its \`.glb\` in the Project window, or the model in your scene). It adds the cube to
   the scene, attaches **CubeCreatorCube** with its config and, in URP, adds a Bloom volume.
4. Press **Play** and click the cube.

Manual alternative: drag \`Cubes/CubeCreator_<name>/Models/<name>.glb\` into the scene, add
the **CubeCreatorCube** component to its top object and assign its
\`CubeCreatorConfig_<name>.json\` to **Config**.

## Clicker hooks
- \`onClicked (int clicks)\` UnityEvent in the inspector.
- \`CubeCreatorCube.AnyCubeClicked\` static C# event.
- Call \`cube.Click()\` to trigger it from your own code. Mouse clicks and taps already
  work with both the old Input Manager and the new Input System.

## Notes
- Works with URP (uses *Universal Render Pipeline/Particles/Unlit*) and the Built-in
  pipeline (legacy particle shaders). If particles render pink in a player build, add
  the shader to *Project Settings → Graphics → Always Included Shaders*.
- Glow needs **Bloom** (Set Up Cube adds it in URP; threshold ~0.9).
- Particle settings approximate the web preview using Unity's ParticleSystem modules —
  tweak the generated \`Particles_*\` children freely.
- Upgrading from an older Cube Creator export that had a \`Scripts\` folder inside each
  cube folder? Delete those per-cube \`Scripts\` folders, then import this package.
`;
}

function blenderReadme(name, glb) {
  return `# ${name} — Cube Creator Blender bundle

**Quick:** File → Import → glTF 2.0 → \`${glb}\`. Materials (PBR, glass/transmission,
emission strength), vertex colours, textures and the *Idle* animation import directly.

**Full setup (recommended):** open Blender → *Scripting* workspace → *Open* →
\`setup_blender.py\` → *Run Script* (or \`blender --python setup_blender.py\`). It imports
the model and also creates:
- EEVEE render settings, AgX/Filmic view transform and bloom (compositor *Glare* node on 4.2+;
  enable *Viewport Shading → Compositor* to preview it live),
- world background, camera and key/rim lights,
- the particle layers as particle systems with glowing instances that fade over life,
- the timeline length matching the looping idle animation.

Press **Space** to play, **F12** to render. Settings are in \`cube_config.json\`.
`;
}
