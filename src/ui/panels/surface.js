import { el, section, bound, paramControls, controlRow } from '../controls.js';
import { patterns } from '../../registries.js';
import { withDefaults } from '../../core/schema.js';
import { SURFACE_SCHEMA } from '../schemas.js';

export default {
  id: 'surface',
  label: 'Surface',
  icon: 'surface',
  render(app) {
    const { store } = app;
    const root = el('div');
    const id = store.get('surface.pattern');
    const pattern = patterns.get(id);

    const select = controlRow({ type: 'select', label: 'Pattern', options: () => patterns.options() }, id, (v) => {
      store.set('surface.pattern', v);
      app.ui.rerender();
    });
    const params = withDefaults(pattern?.params, store.get(`surface.params.${id}`));
    const paramsEl = paramControls(pattern?.params || {}, params, (k, v) => store.set(`surface.params.${id}.${k}`, v));

    const colors = store.get('surface.colors');
    const colorRow = el('div', { class: 'ctl' }, el('label', { class: 'ctl-label' }, 'Colours'));
    const swatches = el('div', { class: 'swatch-row' });
    colors.forEach((c, i) => {
      const input = el('input', { type: 'color', value: c, title: `Colour ${i + 1}` });
      input.addEventListener('input', () => store.set(`surface.colors.${i}`, input.value));
      swatches.append(input);
    });
    colorRow.append(swatches);

    root.append(
      el('p', { class: 'lead' }, 'Procedural textures are baked to real images, so they export to Unity and Blender exactly as you see them.'),
      section('Pattern', el('div', {}, select, paramsEl)),
      section('Colours & mapping', el('div', {}, colorRow, bound(store, 'surface', SURFACE_SCHEMA))),
    );
    return root;
  },
};
