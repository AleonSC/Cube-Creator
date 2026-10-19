import { presets, particlePresets } from '../registries.js';
import { DEFAULT_STATE, deepMerge, uid } from '../core/defaults.js';

// Importing a preset module registers its looks. Add new preset files here.
import './elements.js';

const LOOK_SECTIONS = ['material', 'glow', 'grout', 'surface', 'animation', 'post'];

/** Return a new design with the preset's look (and optionally shape) applied. */
export function applyPreset(state, presetId, { includeShape = false } = {}) {
  const preset = presets.get(presetId);
  if (!preset) return state;
  const next = structuredClone(state);
  const look = preset.look || {};
  for (const key of LOOK_SECTIONS) {
    next[key] = structuredClone(DEFAULT_STATE[key]);
    // keep the user's texture resolution / scale choices for smoother UX
    if (look[key]) deepMerge(next[key], look[key]);
  }
  const keep = ({ ground, grid, autoRotate, shadowOpacity }) => ({ ground, grid, autoRotate, shadowOpacity });
  next.scene = deepMerge({ ...structuredClone(DEFAULT_STATE.scene), ...keep(state.scene) }, look.scene || {});
  next.effects = (look.effects || []).map((e) => ({ uid: uid(), type: e.type, enabled: true, params: structuredClone(e.params || {}) }));
  next.particles = (look.particles || []).map((p) => particleLayer(p.preset, p.params));
  if (includeShape && preset.shape) {
    next.shape.type = preset.shape.type;
    next.shape.params[preset.shape.type] = { ...(next.shape.params[preset.shape.type] || {}), ...preset.shape.params };
  }
  next.name = `${preset.label} Cube`;
  return next;
}

/** Particle layer entry built from a recipe id + overrides. */
export function particleLayer(recipeId, overrides = {}) {
  const recipe = particlePresets.get(recipeId);
  return {
    uid: uid(),
    enabled: true,
    preset: recipeId,
    label: recipe?.label || recipeId,
    params: { ...(recipe?.params || {}), ...overrides },
  };
}
