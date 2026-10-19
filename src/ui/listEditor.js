import { el, paramControls } from './controls.js';
import { ICONS } from './icons.js';
import { withDefaults } from '../core/schema.js';
import { uid } from '../core/defaults.js';

/**
 * Generic editor for stackable lists in the design (modifiers, effects,
 * particle layers). Items are { uid, type?, enabled, params, label? }.
 *
 * options:
 *   path          store path of the array
 *   addOptions    () => [{value,label,group}]
 *   create(value) => new item
 *   schemaOf(item)=> param schema
 *   titleOf(item) => string
 *   emptyText
 */
export function listEditor(store, opts) {
  const root = el('div', { class: 'list-editor' });
  const collapsed = new Set();

  const render = () => {
    root.innerHTML = '';
    const items = store.get(opts.path) || [];
    const add = el('select', { class: 'add-select' }, el('option', { value: '' }, opts.addLabel || '+ Add…'));
    const groups = new Map();
    for (const o of opts.addOptions()) {
      const option = el('option', { value: o.value }, o.label);
      if (o.group) {
        if (!groups.has(o.group)) groups.set(o.group, el('optgroup', { label: o.group }));
        groups.get(o.group).append(option);
      } else add.append(option);
    }
    groups.forEach((g) => add.append(g));
    add.addEventListener('change', () => {
      if (!add.value) return;
      store.update(opts.path, (arr) => arr.push(opts.create(add.value)));
      render();
    });
    root.append(add);

    if (!items.length) root.append(el('p', { class: 'empty' }, opts.emptyText || 'Nothing added yet.'));

    items.forEach((item, i) => {
      const schema = opts.schemaOf(item);
      if (!schema) return;
      const values = withDefaults(schema, item.params);
      const enabled = el('input', { type: 'checkbox', title: 'Enabled' });
      enabled.checked = item.enabled;
      enabled.addEventListener('change', () => store.set(`${opts.path}.${i}.enabled`, enabled.checked));
      const move = (d) => {
        const j = i + d;
        if (j < 0 || j >= items.length) return;
        store.update(opts.path, (arr) => arr.splice(j, 0, arr.splice(i, 1)[0]));
        render();
      };
      const btn = (icon, title, fn) => el('button', { class: 'icon-btn sm', title, type: 'button', html: ICONS[icon], onClick: (e) => (e.stopPropagation(), fn()) });
      const isCollapsed = collapsed.has(item.uid);
      const title = el('span', { class: 'item-title', title: isCollapsed ? 'Click to show settings' : 'Click to hide settings' }, el('span', { class: 'chev' }, isCollapsed ? '▸' : '▾'), opts.titleOf(item));
      const head = el(
        'div',
        { class: 'item-head', onClick: () => (isCollapsed ? collapsed.delete(item.uid) : collapsed.add(item.uid), render()) },
        el('label', { class: 'switch sm', onClick: (e) => e.stopPropagation() }, enabled, el('span', { class: 'slider' })),
        title,
        btn('up', 'Move up', () => move(-1)),
        btn('down', 'Move down', () => move(1)),
        btn('copy', 'Duplicate', () => {
          store.update(opts.path, (arr) => arr.splice(i + 1, 0, { ...structuredClone(item), uid: uid() }));
          render();
        }),
        btn('trash', 'Remove', () => {
          store.update(opts.path, (arr) => arr.splice(i, 1));
          render();
        }),
      );
      const body = el('div', { class: 'item-body' });
      if (!isCollapsed) {
        body.append(paramControls(schema, values, (key, v) => store.set(`${opts.path}.${i}.params.${key}`, v)));
      }
      root.append(el('div', { class: `list-item${isCollapsed ? ' collapsed' : ''}` }, head, body));
    });
  };
  render();
  return root;
}
