import { el, section, bound, paramControls } from '../controls.js';
import { listEditor } from '../listEditor.js';
import { shapes, modifiers } from '../../registries.js';
import { withDefaults } from '../../core/schema.js';
import { uid } from '../../core/defaults.js';
import { SIZE_SCHEMA, SHADING_SCHEMA } from '../schemas.js';

export default {
  id: 'shape',
  label: 'Shape',
  icon: 'shape',
  render(app) {
    const { store } = app;
    const root = el('div');

    // shape picker + params
    const type = store.get('shape.type');
    const picker = el('div', { class: 'chip-grid' });
    for (const s of shapes.list()) {
      const chip = el('button', { class: `chip${s.id === type ? ' active' : ''}`, type: 'button' }, s.label);
      chip.addEventListener('click', () => {
        store.set('shape.type', s.id);
        app.ui.rerender();
      });
      picker.append(chip);
    }
    const shape = shapes.get(type);
    const params = withDefaults(shape?.params, store.get(`shape.params.${type}`));
    const paramsEl = shape
      ? paramControls(shape.params, params, (k, v) => store.set(`shape.params.${type}.${k}`, v))
      : el('p', { class: 'empty' }, 'Unknown shape');

    root.append(
      section('Base shape', picker),
      section(`${shape?.label || ''} settings`, paramsEl),
      section('Size', el('div', {}, bound(store, 'size', SIZE_SCHEMA), bound(store, '', SHADING_SCHEMA))),
      section(
        'Modifiers (stack, top → bottom)',
        listEditor(store, {
          path: 'modifiers',
          addLabel: '+ Add modifier…',
          addOptions: () => modifiers.options(),
          create: (type) => ({ uid: uid(), type, enabled: true, params: {} }),
          schemaOf: (item) => modifiers.get(item.type)?.params,
          titleOf: (item) => modifiers.get(item.type)?.label || item.type,
          emptyText: 'Twist, melt, spherify, noise… Tip: add “Subdivide” first on tessellated cubes.',
        }),
      ),
    );
    return root;
  },
};
