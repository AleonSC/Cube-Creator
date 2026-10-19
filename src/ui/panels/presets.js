import { el } from '../controls.js';
import { presets } from '../../registries.js';
import { applyPreset } from '../../presets/index.js';

export default {
  id: 'presets',
  label: 'Presets',
  icon: 'presets',
  render(app) {
    const root = el('div');
    let includeShape = app.ui.prefs.includeShape ?? false;
    const toggle = el('input', { type: 'checkbox' });
    toggle.checked = includeShape;
    toggle.addEventListener('change', () => (includeShape = app.ui.prefs.includeShape = toggle.checked));
    const search = el('input', { type: 'search', placeholder: 'Search looks… (lava, glass, pixel)', class: 'search' });

    root.append(
      el('p', { class: 'lead' }, 'One-click looks. Each sets material, surface, glow, animation, effects and particles — then tweak anything.'),
      el('div', { class: 'row gap' },
        el('label', { class: 'switch' }, toggle, el('span', { class: 'slider' })),
        el('span', { class: 'small' }, 'Also apply the preset’s suggested shape'),
      ),
      search,
    );

    const grid = el('div');
    const renderGrid = () => {
      grid.innerHTML = '';
      const q = search.value.trim().toLowerCase();
      const byCat = new Map();
      for (const p of presets.list()) {
        if (q && !`${p.label} ${p.category} ${p.id}`.toLowerCase().includes(q)) continue;
        if (!byCat.has(p.category)) byCat.set(p.category, []);
        byCat.get(p.category).push(p);
      }
      for (const [cat, list] of byCat) {
        grid.append(el('h4', { class: 'cat' }, cat));
        const g = el('div', { class: 'preset-grid' });
        for (const p of list) {
          const [a, b] = p.swatch || ['#888', '#222'];
          const card = el(
            'button',
            { class: 'preset-card', type: 'button', title: p.shape ? `Suggested shape: ${p.shape.type}` : p.label },
            el('span', { class: 'swatch', style: `background: radial-gradient(circle at 30% 30%, ${a}, ${b})` }),
            el('span', { class: 'preset-label' }, p.label),
          );
          card.addEventListener('click', () => {
            app.store.replace(applyPreset(app.store.get(), p.id, { includeShape }));
            app.ui.toast(`Applied “${p.label}”`);
          });
          g.append(card);
        }
        grid.append(g);
      }
      if (!byCat.size) grid.append(el('p', { class: 'empty' }, 'No presets match.'));
    };
    search.addEventListener('input', renderGrid);
    renderGrid();
    root.append(grid);
    return root;
  },
};
