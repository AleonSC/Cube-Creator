import { el, section } from '../controls.js';
import { listEditor } from '../listEditor.js';
import { particlePresets } from '../../registries.js';
import { EMITTER_SCHEMA } from '../../particles/index.js';
import { particleLayer } from '../../presets/index.js';

export default {
  id: 'particles',
  label: 'Particles',
  icon: 'particles',
  render(app) {
    const { store } = app;
    return el(
      'div',
      {},
      el('p', { class: 'lead' }, 'Stack as many particle layers as you like. Start from a recipe, then tweak every setting.'),
      section(
        'Particle layers',
        listEditor(store, {
          path: 'particles',
          addLabel: '+ Add particle layer…',
          addOptions: () => particlePresets.options(),
          create: (id) => particleLayer(id),
          schemaOf: () => EMITTER_SCHEMA,
          titleOf: (item) => item.label || item.preset || 'Layer',
          emptyText: 'Embers, bubbles, snow, sparks, magic dust, confetti…',
        }),
      ),
    );
  },
};
