import { el, section, paramControls } from '../controls.js';
import { ICONS } from '../icons.js';
import { exporters } from '../../registries.js';
import { defaultsFromSchema } from '../../core/schema.js';
import { download, slug } from '../../export/prepare.js';

export default {
  id: 'export',
  label: 'Export',
  icon: 'export',
  render(app) {
    const root = el('div');
    root.append(
      el('p', { class: 'lead' },
        el('b', {}, 'Unity: '), 'use the Unity package (needs glTFast for .glb, or use the included OBJ). ',
        el('b', {}, 'Blender: '), 'use the Blender bundle or import the .glb directly.'),
    );
    app.ui.prefs.exportOptions ||= {};
    const byCat = new Map();
    for (const x of exporters.list()) {
      if (!byCat.has(x.category)) byCat.set(x.category, []);
      byCat.get(x.category).push(x);
    }
    for (const [cat, list] of byCat) {
      const body = el('div', { class: 'export-list' });
      for (const x of list) {
        const values = (app.ui.prefs.exportOptions[x.id] ||= defaultsFromSchema(x.params));
        const btn = el('button', { class: 'btn primary', type: 'button' }, 'Export');
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Exporting…';
          try {
            const blob = await x.run(app, { ...values });
            download(blob, `${slug(app.store.get('name'))}${x.ext}`);
            app.ui.toast(`Exported ${x.label}`);
          } catch (err) {
            console.error(err);
            app.ui.toast(`Export failed: ${err.message || err}`, 'error');
          } finally {
            btn.disabled = false;
            btn.textContent = 'Export';
          }
        });
        body.append(
          el('div', { class: 'export-card' },
            el('div', { class: 'export-head' }, x.icon ? el('span', { class: 'export-icon', html: ICONS[x.icon] }) : null, el('b', {}, x.label), btn),
            el('p', { class: 'small' }, x.description || ''),
            Object.keys(x.params || {}).length ? paramControls(x.params, values, () => {}) : null,
          ),
        );
      }
      root.append(section(cat, body));
    }
    return root;
  },
};
