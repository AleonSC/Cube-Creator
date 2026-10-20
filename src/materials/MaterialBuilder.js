import * as THREE from 'three';

/**
 * Turns state.material / glow / grout + baked textures into Three.js
 * physically-based materials. Only standard glTF-compatible features are
 * used so materials export cleanly to Unity (glTFast) and Blender.
 */
export class MaterialBuilder {
  constructor() {
    this.main = new THREE.MeshPhysicalMaterial({ name: 'CubeSurface' });
    this.grout = new THREE.MeshStandardMaterial({ name: 'CubeGrout' });
    // unlit variants: exact colours, no lighting (glTF KHR_materials_unlit)
    this.unlitMain = new THREE.MeshBasicMaterial({ name: 'CubeSurface' });
    this.unlitGrout = new THREE.MeshBasicMaterial({ name: 'CubeGrout' });
    this.signature = '';
    // painted glow from the sculpt brush: per-vertex emissive added in the shader
    this.sculptGlow = { value: 0 };
    [this.main, this.grout, this.unlitMain, this.unlitGrout].forEach((m) => injectSculptGlow(m, this.sculptGlow));
  }

  /** @param textures result of TextureBuilder.build (or null) */
  update(state, textures, { vertexColors = false, flatShading = false } = {}) {
    const m = state.material;
    const s = state.surface;
    const mat = this.main;

    mat.color.set(m.color);
    mat.metalness = m.metalness;
    mat.roughness = m.roughness;
    mat.transmission = m.transmission;
    mat.ior = m.ior;
    mat.thickness = m.thickness;
    mat.dispersion = m.dispersion;
    mat.attenuationColor.set(m.attenuationColor);
    mat.attenuationDistance = m.attenuationDistance;
    mat.clearcoat = m.clearcoat;
    mat.clearcoatRoughness = m.clearcoatRoughness;
    mat.iridescence = m.iridescence;
    mat.iridescenceIOR = m.iridescenceIOR;
    mat.sheen = m.sheen;
    mat.sheenColor.set(m.sheenColor);
    mat.specularIntensity = m.specularIntensity;
    mat.envMapIntensity = m.envMapIntensity;
    mat.opacity = m.opacity;
    mat.transparent = m.opacity < 1;
    mat.depthWrite = m.opacity >= 0.98;
    mat.side = m.doubleSided || m.opacity < 1 ? THREE.DoubleSide : THREE.FrontSide;
    mat.wireframe = m.wireframe;
    mat.flatShading = flatShading;
    mat.vertexColors = vertexColors;

    mat.emissive.set(state.glow.color);
    mat.emissiveIntensity = state.glow.intensity;
    mat.userData.baseEmissiveIntensity = state.glow.intensity;

    mat.map = textures?.map || null;
    mat.emissiveMap = textures?.emissiveMap || null;
    mat.normalMap = textures?.normalMap || null;
    for (const t of [mat.map, mat.emissiveMap, mat.normalMap]) {
      if (t) t.repeat.set(s.scale, s.scale);
    }

    const g = state.grout;
    this.grout.color.set(g.color);
    this.grout.roughness = g.roughness;
    this.grout.metalness = g.metalness;
    this.grout.emissive.set(g.glowColor);
    this.grout.emissiveIntensity = g.glow;
    this.grout.userData.baseEmissiveIntensity = g.glow;
    this.grout.envMapIntensity = m.envMapIntensity;

    // Shader-affecting flags: recompile only when they change
    const sig = [!!mat.map, !!mat.emissiveMap, !!mat.normalMap, vertexColors, flatShading, m.transmission > 0, m.wireframe, mat.transparent, mat.side, m.iridescence > 0, m.clearcoat > 0, m.sheen > 0, m.dispersion > 0].join();
    if (sig !== this.signature) {
      mat.needsUpdate = true;
      this.grout.needsUpdate = true;
      this.signature = sig;
    }
    if (m.unlit) return this.updateUnlit(state, mat);
    return { main: mat, grout: this.grout };
  }

  updateUnlit(state, physical) {
    const u = this.unlitMain;
    for (const k of ['map', 'opacity', 'transparent', 'depthWrite', 'side', 'wireframe', 'vertexColors']) u[k] = physical[k];
    u.color.copy(physical.color);
    this.unlitGrout.color.set(state.grout.color);
    u.needsUpdate = true;
    this.unlitGrout.needsUpdate = true;
    return { main: u, grout: this.unlitGrout };
  }

  /** Enable the painted-glow shader path only while a sculpt (which has the attribute) is shown. */
  setSculptGlow(intensity, enabled) {
    this.sculptGlow.value = intensity;
    for (const m of [this.main, this.grout, this.unlitMain, this.unlitGrout]) {
      const has = 'SCULPT_GLOW' in m.defines;
      if (has === enabled) continue;
      if (enabled) m.defines.SCULPT_GLOW = '';
      else delete m.defines.SCULPT_GLOW;
      m.needsUpdate = true;
    }
  }

  /** Per-frame animation hooks: emissive pulse/flicker + texture scrolling. */
  animate(state, t) {
    const a = state.animation;
    let k = 1;
    if (a.glowPulse > 0) k *= 1 - a.glowPulse * 0.5 + a.glowPulse * 0.5 * Math.sin(t * a.glowPulseSpeed * Math.PI * 2);
    if (a.flicker > 0) k *= 1 - a.flicker * 0.5 * (Math.sin(t * 23.1) * Math.sin(t * 13.7) * 0.5 + 0.5 + Math.random() * 0.3);
    this.main.emissiveIntensity = this.main.userData.baseEmissiveIntensity * k;
    this.grout.emissiveIntensity = this.grout.userData.baseEmissiveIntensity * k;
    const ou = (t * a.scrollU) % 1;
    const ov = (t * a.scrollV) % 1;
    for (const tex of [this.main.map, this.main.emissiveMap, this.main.normalMap]) {
      if (tex) tex.offset.set(ou, ov);
    }
  }

  dispose() {
    this.main.dispose();
    this.grout.dispose();
    this.unlitMain.dispose();
    this.unlitGrout.dispose();
  }
}

/**
 * Adds `sculptGlow` (vec3 per vertex, painted with the glow brush) to a
 * material's emission. Geometries without the attribute read (0,0,0), so the
 * injection is harmless everywhere else.
 */
function injectSculptGlow(material, uniform) {
  material.defines ||= {};
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSculptGlow = uniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n#ifdef SCULPT_GLOW\nattribute vec3 sculptGlow;\nvarying vec3 vSculptGlow;\n#endif')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef SCULPT_GLOW\nvSculptGlow = sculptGlow;\n#endif');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n#ifdef SCULPT_GLOW\nuniform float uSculptGlow;\nvarying vec3 vSculptGlow;\n#endif');
    if (shader.fragmentShader.includes('totalEmissiveRadiance')) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef SCULPT_GLOW\ntotalEmissiveRadiance += vSculptGlow * uSculptGlow;\n#endif');
    } else {
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', '#ifdef SCULPT_GLOW\noutgoingLight += vSculptGlow * uSculptGlow;\n#endif\n#include <opaque_fragment>');
    }
  };
  material.customProgramCacheKey = () => ('SCULPT_GLOW' in material.defines ? 'sculptGlow:on' : 'sculptGlow:off');
}
