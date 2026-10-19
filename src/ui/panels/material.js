import { el, section, bound } from '../controls.js';
import { shapes } from '../../registries.js';
import { MATERIAL_SCHEMAS, GROUT_SCHEMA } from '../schemas.js';

export default {
  id: 'material',
  label: 'Material',
  icon: 'material',
  render(app) {
    const { store } = app;
    const root = el('div');
    root.append(
      section('Base', bound(store, 'material', MATERIAL_SCHEMAS.base)),
      section('Glass / liquid', bound(store, 'material', MATERIAL_SCHEMAS.glass), { open: store.get('material.transmission') > 0 }),
      section('Coatings', bound(store, 'material', MATERIAL_SCHEMAS.coats), { open: false }),
      section('Options', bound(store, 'material', MATERIAL_SCHEMAS.flags), { open: false }),
    );
    if (shapes.get(store.get('shape.type'))?.usesGrout) {
      root.append(section('Grout (between tiles)', bound(store, 'grout', GROUT_SCHEMA)));
    }
    return root;
  },
};
