import { Registry } from './core/Registry.js';

/**
 * All extension points of Cube Creator. Feature modules import the registry
 * they extend and call `.register({...})`. See README "Extending".
 */
export const shapes = new Registry('shapes'); // geometry generators
export const modifiers = new Registry('modifiers'); // geometry deformers (stackable)
export const patterns = new Registry('patterns'); // procedural surface textures
export const presets = new Registry('presets'); // one-click looks (glass, lava, fire...)
export const effects = new Registry('effects'); // attached 3D effects (outline, aura, rings...)
export const particlePresets = new Registry('particlePresets'); // particle emitter recipes
export const particleSprites = new Registry('particleSprites'); // particle sprite textures
export const exporters = new Registry('exporters'); // file exporters
