import { el, section, bound, controlRow } from '../controls.js';
import { particlePresets } from '../../registries.js';
import { ANIMATION_SCHEMA, CLICKER_SCHEMA } from '../schemas.js';

export default {
  id: 'animation',
  label: 'Animate',
  icon: 'animation',
  render(app) {
    const { store } = app;
    const burst = controlRow(
      { type: 'select', label: 'Click burst particles', options: () => [{ value: 'none', label: 'None' }, ...particlePresets.options()] },
      store.get('clicker.burstParticles'),
      (v) => store.set('clicker.burstParticles', v),
    );
    return el(
      'div',
      {},
      section('Idle animation', bound(store, 'animation', ANIMATION_SCHEMA)),
      section('Clicker feedback', el('div', {}, bound(store, 'clicker', CLICKER_SCHEMA), burst)),
    );
  },
};
