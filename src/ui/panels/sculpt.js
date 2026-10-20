import { el, section, controlRow } from '../controls.js';
import { brushes } from '../../registries.js';

let unsubscribe = null;

const RESOLUTIONS = [
  { value: 50000, label: 'Low — 50k triangles (fast, game-friendly)' },
  { value: 150000, label: 'Medium — 150k triangles' },
  { value: 400000, label: 'High — 400k triangles (fine detail)' },
  { value: 1000000, label: 'Ultra — 1M triangles (needs a strong GPU)' },
];

export default {
  id: 'sculpt',
  label: 'Sculpt',
  icon: 'sculpt',
  render(app) {
    unsubscribe?.();
    const ctl = app.sculpt;
    const { store } = app;
    if (!ctl) return el('p', { class: 'empty' }, 'Loading…');
    const root = el('div');

    if (!ctl.active) {
      let res = store.get('sculpt.resolution') || 150000;
      const go = el('button', { class: 'btn primary wide', type: 'button' }, 'Start sculpting');
      go.addEventListener('click', () => {
        go.disabled = true;
        go.textContent = 'Preparing mesh…';
        // let the button repaint before the heavy subdivision runs
        setTimeout(() => {
          try {
            ctl.start(res);
            app.ui.toast('Sculpt mode: drag on the cube to sculpt');
          } catch (err) {
            console.error(err);
            app.ui.toast(`Could not start sculpting: ${err.message}`, 'error');
          }
          app.ui.rerender();
        }, 30);
      });
      root.append(
        el('p', { class: 'lead' }, 'Draw, carve, drag and stretch the cube by hand, and paint colour or glow onto it.'),
        section('Start', el('div', {},
          controlRow({ type: 'select', label: 'Detail level', options: RESOLUTIONS }, res, (v) => (res = Number(v))),
          el('p', { class: 'small' }, 'This freezes the current shape (including size and modifiers) into a sculptable mesh. Materials, surface, glow, effects and particles keep working. More detail = finer brushes but heavier files for games.'),
          go,
        )),
      );
      return root;
    }

    const s = ctl.settings;
    const save = () => ctl.saveSettings();

    // brush picker
    const grid = el('div', { class: 'brush-grid' });
    for (const b of brushes.list()) {
      const btn = el('button', { class: `brush${s.brush === b.id ? ' active' : ''} ${b.kind}`, type: 'button', title: `${b.hint || ''} (key: ${b.key?.toUpperCase() || '-'})` },
        el('span', { class: 'brush-name' }, b.label), el('span', { class: 'brush-key' }, b.key?.toUpperCase() || ''));
      btn.addEventListener('click', () => {
        s.brush = b.id;
        save();
        app.ui.rerender();
      });
      grid.append(btn);
    }
    const current = brushes.get(s.brush);

    const settings = el('div', { class: 'controls' },
      controlRow({ type: 'range', label: 'Size', min: 0.005, max: 0.6, step: 0.005, hint: '[ and ] keys' }, s.radius, (v) => ((s.radius = v), save())),
      controlRow({ type: 'range', label: 'Strength', min: 0.02, max: 1, step: 0.01 }, s.strength, (v) => ((s.strength = v), save())),
      controlRow({ type: 'range', label: 'Edge hardness', min: 0, max: 0.95, step: 0.01, hint: '0 = soft falloff, high = hard-edged stamp' }, s.hardness, (v) => ((s.hardness = v), save())),
      controlRow({ type: 'color', label: 'Paint / glow colour' }, s.color, (v) => ((s.color = v), save())),
      controlRow({ type: 'range', label: 'Painted glow strength', min: 0, max: 10, step: 0.05 }, store.get('sculpt.glow'), (v) => store.set('sculpt.glow', v)),
    );

    const sym = el('div', { class: 'sym-row' }, el('span', { class: 'ctl-label' }, 'Mirror'));
    for (const axis of ['X', 'Y', 'Z']) {
      const key = `sym${axis}`;
      const b = el('button', { class: `chip${s[key] ? ' active' : ''}`, type: 'button' }, axis);
      b.addEventListener('click', () => {
        s[key] = !s[key];
        save();
        b.classList.toggle('active', s[key]);
      });
      sym.append(b);
    }

    const undo = el('button', { class: 'btn', type: 'button', disabled: !ctl.undoStack.length }, 'Undo stroke');
    const redo = el('button', { class: 'btn', type: 'button', disabled: !ctl.redoStack.length }, 'Redo stroke');
    undo.addEventListener('click', () => ctl.undo());
    redo.addEventListener('click', () => ctl.redo());
    const discard = el('button', { class: 'btn danger', type: 'button' }, 'Discard sculpt');
    discard.addEventListener('click', () => {
      if (!confirm('Discard all sculpting and painting and go back to the editable shape?')) return;
      ctl.discard();
      app.ui.rerender();
    });

    root.append(
      el('p', { class: 'lead' }, el('b', {}, current?.label || ''), ' — ', current?.hint || ''),
      section('Brush', el('div', {}, grid, settings, sym)),
      section('Stroke history', el('div', { class: 'row gap' }, undo, redo)),
      section('Tips', el('ul', { class: 'tips' },
        el('li', {}, 'Left-drag on the cube to sculpt; drag off the cube or right-drag to rotate the view; scroll to zoom.'),
        el('li', {}, 'Hold Ctrl (⌘ on Mac) to invert: carve ↔ draw, erase paint/glow.'),
        el('li', {}, 'Hold Shift to smooth with any sculpt brush.'),
        el('li', {}, '[ and ] change the brush size; letter keys pick brushes.'),
        el('li', {}, 'The cube holds still while this tab is open; its animation resumes when you leave.'),
      ), { open: false }),
      section('Sculpt mesh', el('div', {},
        el('p', { class: 'small' }, `${(ctl.mesh.T / 1000).toFixed(0)}k triangles. Shape, size and modifiers are frozen while sculpted.`),
        discard,
      ), { open: false }),
    );

    unsubscribe = ctl.onChange(() => {
      if (app.ui.active === 'sculpt') app.ui.rerender();
    });
    return root;
  },
};
