import { el, section, bound } from '../controls.js';
import { SCENE_SCHEMA } from '../schemas.js';

export default {
  id: 'scene',
  label: 'Scene',
  icon: 'scene',
  render(app) {
    return el('div', {}, el('p', { class: 'lead' }, 'Preview environment only — reflections and lighting here don’t change the exported model.'), section('Viewer', bound(app.store, 'scene', SCENE_SCHEMA)));
  },
};
