import { el, section, bound } from '../controls.js';
import { listEditor } from '../listEditor.js';
import { effects } from '../../registries.js';
import { uid } from '../../core/defaults.js';
import { GLOW_SCHEMA, POST_SCHEMA } from '../schemas.js';

export default {
  id: 'fx',
  label: 'Glow & FX',
  icon: 'fx',
  render(app) {
    const { store } = app;
    return el(
      'div',
      {},
      section('Glow / emission', bound(store, 'glow', GLOW_SCHEMA)),
      section(
        '3D effects',
        listEditor(store, {
          path: 'effects',
          addLabel: '+ Add effect…',
          addOptions: () => effects.options(),
          create: (type) => ({ uid: uid(), type, enabled: true, params: {} }),
          schemaOf: (item) => effects.get(item.type)?.params,
          titleOf: (item) => effects.get(item.type)?.label || item.type,
          emptyText: 'Add outlines, auras, orbit rings, a glowing core, lightning…',
        }),
      ),
      section('Post-processing (viewer)', bound(store, 'post', POST_SCHEMA)),
    );
  },
};
