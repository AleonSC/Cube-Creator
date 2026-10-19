import presets from './presets.js';
import shape from './shape.js';
import material from './material.js';
import surface from './surface.js';
import fx from './fx.js';
import particles from './particles.js';
import animation from './animation.js';
import scene from './scene.js';
import exportPanel from './export.js';

/**
 * Sidebar tabs, in order. A panel = { id, label, icon, render(app) -> Element }.
 * Add a tab = create a file and list it here.
 */
export const PANELS = [presets, shape, material, surface, fx, particles, animation, scene, exportPanel];
