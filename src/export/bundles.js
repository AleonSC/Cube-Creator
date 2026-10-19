import { withDefaults } from '../core/schema.js';
import { particlePresets } from '../registries.js';
import { EMITTER_SCHEMA } from '../particles/index.js';
import { spriteDataURL } from '../particles/sprites.js';
import { exportGLTF, exportOBJ } from './models.js';
import { makeZip } from './zip.js';
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

function usedSprites(config) {
  const ids = new Set(config.particles.map((p) => p.sprite));
  if (config.clicker.burst) ids.add(config.clicker.burst.sprite);
  return [...ids];
}

const dataUrlToBytes = (url) => Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));

export async function exportUnityBundle(app, { includeEffects = true, includeObj = true } = {}) {
  const name = slug(app.store.get('name'));
  const root = `CubeCreator_${name}`;
  const config = runtimeConfig(app);
  const files = {};
  // the C# component drives the idle animation, so don't bake a clip into the model
  files[`${root}/Models/${name}.glb`] = await exportGLTF(app, { binary: true, includeEffects, bakeAnimation: false });
  if (includeObj) {
    const obj = await exportOBJ(app, { includeEffects, baseName: name });
    files[`${root}/Models/OBJ/${name}.obj`] = obj.obj;
    files[`${root}/Models/OBJ/${name}.mtl`] = obj.mtl;
    for (const [file, blob] of Object.entries(obj.textures)) files[`${root}/Models/OBJ/${file}`] = blob;
  }
  files[`${root}/CubeCreatorConfig_${name}.json`] = JSON.stringify(config, null, 2);
  files[`${root}/Scripts/CubeCreatorConfig.cs`] = configCs;
  files[`${root}/Scripts/CubeCreatorCube.cs`] = cubeCs;
  files[`${root}/Scripts/CubeCreatorParticles.cs`] = particlesCs;
  files[`${root}/Scripts/Editor/CubeCreatorSetup.cs`] = setupCs;
  for (const id of usedSprites(config)) files[`${root}/Resources/CubeCreatorSprites/${id}.png`] = dataUrlToBytes(spriteDataURL(id));
  files[`${root}/README.md`] = unityReadme(name, root);
  return makeZip(files);
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

function unityReadme(name, root) {
  return `# ${name} — Cube Creator Unity bundle

## Import
1. **Install glTFast** once per project: Package Manager → \`+\` → *Add package by name* →
   \`com.unity.cloud.gltfast\`. (Without it, the included OBJ model is used instead; the
   glow still works, but glass/transparency must be set up by hand.)
2. Drag the \`${root}\` folder into your project's **Assets**.
3. In the top menu choose **Cube Creator → Set Up Cube**. It adds the cube to the open
   scene, attaches **CubeCreatorCube** with this config, and (in URP) adds a Bloom volume
   so glow shows. To set up a cube that's already in your scene, select it first.
4. Press **Play** and click the cube.

Manual alternative: drag \`Models/${name}.glb\` into the scene, add the **CubeCreatorCube**
component to its top object and assign \`CubeCreatorConfig_${name}.json\` to **Config**.

## Clicker hooks
- \`onClicked (int clicks)\` UnityEvent in the inspector.
- \`CubeCreatorCube.AnyCubeClicked\` static C# event.
- Call \`cube.Click()\` to trigger it from your own code. Mouse clicks and taps already
  work with both the old Input Manager and the new Input System.

## Notes
- Works with URP (uses *Universal Render Pipeline/Particles/Unlit*) and the Built-in
  pipeline (legacy particle shaders). If particles render pink in a player build, add
  the shader to *Project Settings → Graphics → Always Included Shaders*.
- For glow, enable **Bloom** (URP Volume → Bloom, or Post Processing stack). Suggested
  threshold 0.8–1.0.
- Particle sprites live in \`Resources/CubeCreatorSprites\`.
- Particle settings are an approximation of the web preview mapped onto Unity's
  ParticleSystem modules — tweak them freely after Play by inspecting the generated
  \`Particles_*\` children (or copy them in Play mode and paste after).
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
