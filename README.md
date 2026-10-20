# Cube Creator

A browser app for designing custom 3D **clicker cubes** — tessellated polygons, glass,
lava, fire, water, air and dozens more looks — with glow, 3D effects, particles and click
feedback, then exporting them to **Unity** and **Blender**.

## Quick start

**Just use it:** download [`Cube-Creator.html`](Cube-Creator.html) and double-click it.
It opens in your browser. No install, no internet needed, and every export works.
(On GitHub: open the file → *Download raw file*.)

**Put it online:** in this repo's *Settings → Pages*, set *Source* to *GitHub Actions*.
Every push to `main` then publishes the app at `https://<your-user>.github.io/<repo>/`.

**Edit the code (live reload):** install [Node.js](https://nodejs.org), then double-click
`Start Cube Creator (dev).bat` (Windows) or run `./start.sh` (macOS/Linux). That is the
same as:

```bash
npm install
npm start               # opens http://localhost:5173 with live reload
npm run build:single    # rebuilds Cube-Creator.html after code changes
npm run build           # static site in dist/ (what GitHub Pages serves)
```

## Features

| Area | What you get |
| --- | --- |
| **Shapes** | Tessellated cube (11 tilings: squares, bricks, triangles, hexagons, rhombille, diamonds, octagon+square, shards, Voronoi, Mondrian, dominoes; flat/bevel/pyramid/picture-frame tiles, gaps, depth, height and colour variation), cube, rounded cube, pixel/voxel cube, sphere, geodesic sphere, d4/d8/d12/d20, prism, capsule, torus, torus knot, brilliant-cut gem, crystal cluster, extruded tokens (coin, star, heart, gear, cross, lightning bolt) |
| **Sculpt & paint** | Freeze any cube into a dense mesh (50k–1M triangles) and shape it by hand: draw, carve, inflate, grab/drag/stretch, smooth, flatten, pinch; paint colour and glow onto the surface. Mirror symmetry on X/Y/Z, size/strength/hardness, per-stroke undo, Ctrl to invert, Shift to smooth, `[` `]` to resize. Sculpts autosave and are embedded in saved designs; painted glow exports as emissive materials |
| **Size & modifiers** | Per-axis size + scale, flat/smooth shading, stackable modifiers: subdivide, twist, taper, bend, spherify, noise, melt/drip, wave, low-poly jitter, squash/stretch |
| **Materials** | Full PBR: colour, metal, roughness, opacity, glass transmission, IOR, thickness, dispersion, absorption colour, clearcoat, iridescence, sheen, specular; separate “grout” material between tiles (with its own glow, e.g. lava cracks) |
| **Surfaces** | 18 procedural patterns (clouds, marble, cells, lava cracks, flames, caustics, lightning, galaxy, circuit, hex grid, stripes, checker, pixel art, bricks, wood, dragon scales…) with 3-colour/rainbow ramps, pixelation, bump, and per-pattern glow. They are **baked into real textures**, so they export intact |
| **Glow & FX** | Emission colour/intensity, bloom, pixelated view; effects: toon outline, glowing edges, fresnel aura, halo, orbit rings, satellites, inner glowing core + light, lightning arcs, pedestal |
| **Particles** | Unlimited layers from 25 recipes (embers, flames, sparks, smoke, steam, bubbles, rain, snow, wind, tornado, magic dust, fireflies, stardust, pixel bits, confetti, hearts, coins…), every parameter editable |
| **Animation & clicker** | Spin, tumble, wobble, bob, pulse, glow pulse/flicker, texture scroll; click squash, particle burst, counter and floating “+1” |
| **Presets** | 42 one-click looks: glass, frosted glass, gems, water, ocean, ice, lava, magma, fire, soul fire, sun, air, cloud, storm, stone, grass block, nature, wood, marble, moon, gold, chrome, copper, dragon scales, neon, hologram, cyber circuit, plasma, galaxy, void, arcane, pearl, slime, candy, rainbow, toon, retro pixel, coin box |
| **Workflow** | Undo/redo, autosave, save/load `.cube.json`, “Random” button |

## Exporting

| Target | Export | Notes |
| --- | --- | --- |
| **Unity** | *Unity package (.unitypackage)* | Double-click to import, then **Cube Creator → Set Up Cube** in Unity. Contains the `.glb` (needs [glTFast](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@latest), `com.unity.cloud.gltfast`), an OBJ fallback, and shared C# scripts in `Assets/CubeCreator/Scripts` that recreate idle animation, glow pulse, texture scroll, particles and click squash/burst, with an `onClicked(int)` event. Every cube shares one copy of the scripts, so you can import as many cubes as you like |
| **Blender** | *Blender bundle (.zip)* | `.glb` with a baked *Idle* animation + `setup_blender.py`, which imports it and sets up EEVEE, bloom, world, camera, lights and particle systems. Or just *File → Import → glTF 2.0* |
| Anything else | `.glb`, `.gltf`, OBJ+MTL, STL (3D printing), USDZ (Apple AR) | |
| 2D games / store art | PNG render, turntable sprite sheet | Transparent backgrounds supported |

Exported models are in metres (1 unit = 1 m), Y-up, with PBR materials. Viewer-only
extras (particles, aura shader, halo sprite) do not go into the model files; the engine
bundles recreate the particles natively instead.

## Architecture (built to be extended)

Everything extensible is a **registry** (`src/registries.js`). A feature module imports a
registry and calls `.register({...})`. The UI is **generated from param schemas**, so a
new feature gets sliders, colour pickers and dropdowns automatically, and it is saved,
undone, loaded and exported with no extra work.

```
src/
  registries.js          shapes, modifiers, patterns, presets, effects, particlePresets, particleSprites, exporters
  core/                  Registry, Store (state + undo/redo + autosave), schema helpers, defaults, noise, seeded RNG
  shapes/                geometry generators (tessellated.js + tilings.js, primitives, voxel, extruded)
  modifiers/             stackable deformers
  surface/               procedural patterns + TextureBuilder (bakes colour/emissive/normal maps)
  materials/             MaterialBuilder (PBR, grout, glow pulse, texture scroll)
  effects/               attached 3D effects
  particles/             data-driven emitter, sprites, recipes
  presets/               one-click looks
  cube/                  CubeAssembler: builds and animates the cube from state
  viewer/                renderer, camera, lights, reflection environments, bloom/pixel post
  export/                exporters, Unity/Blender bundles, C#/Python templates
  sculpt/                SculptMesh (welded dense mesh + BVH), brushes, stroke controller, autosave
  ui/                    schema-driven controls, list editor, sidebar panels
```

The design is plain JSON (`src/core/defaults.js`) — that is what gets saved, undone and
handed to the exporters.

### Recipes for adding features

- **Shape**: add `src/shapes/myShape.js` with
  `shapes.register({ id, label, category, params: {...}, build(params) { return new THREE.BufferGeometry() } })`,
  then import it in `src/shapes/index.js`. Geometry is auto-centred and scaled to a unit cube.
  Return material groups `0` (surface) / `1` (grout) and set `usesGrout: true` to get a grout material.
- **Tiling** for the tessellated cube: add an entry to `TILINGS` in `src/shapes/tilings.js` that returns convex polygons in `[-0.5, 0.5]²`.
- **Modifier**: `modifiers.register({ id, label, params, deform(vec3, params) })` (per vertex) or `apply(geometry, params)`.
- **Surface pattern**: `patterns.register({ id, label, category, params, sample(u, v, params) { return { t, e, h } } })` — colour-ramp position, glow mask and height in 0..1.
- **Preset look**: add an entry to `src/presets/elements.js` (or a new file imported from `src/presets/index.js`).
- **3D effect**: `effects.register({ id, label, params, create(ctx, params) { return { object, attach: 'mesh' | 'pivot' | 'world', update?, dispose? } } })`. Set `object.userData.noExport = true` for viewer-only objects.
- **Particle recipe / sprite**: add to `src/particles/presets.js` / `particleSprites.register({ id, label, draw(ctx2d, size) })`.
- **Exporter**: `exporters.register({ id, label, category, ext, description, params, run(app, options) => Blob })`.
- **Sculpt / paint brush**: `brushes.register({ id, label, kind: 'sculpt' | 'paint', key, hint, dab(ctx) })` in `src/sculpt/brushes.js` — `ctx` gives the touched points, falloff `weight(u)`, brush centre/normal, strength, radius, invert and colour.
- **Sidebar tab**: create `src/ui/panels/myPanel.js` (`{ id, label, icon, render(app) }`) and list it in `src/ui/panels/index.js`.
- **New design-state field**: add it to `DEFAULT_STATE` (older saves are filled in by `migrate()`), then route it in `App.markDirty` (`src/app.js`).
