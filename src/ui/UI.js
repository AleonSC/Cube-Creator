import { el } from './controls.js';
import { ICONS } from './icons.js';
import { PANELS } from './panels/index.js';

/** App chrome: header, tab bar, panel host, viewport HUD and toasts. */
export class UI {
  constructor(app, root) {
    this.app = app;
    app.ui = this; // panels rendered during construction read app.ui
    this.prefs = loadPrefs();
    this.active = PANELS.some((p) => p.id === this.prefs.tab) ? this.prefs.tab : 'presets';

    this.nameInput = el('input', { class: 'name-input', type: 'text', spellcheck: 'false', 'aria-label': 'Design name' });
    this.nameInput.addEventListener('input', () => app.store.set('name', this.nameInput.value));
    const hbtn = (icon, title, fn, label) => el('button', { class: 'hbtn', title, type: 'button', onClick: fn, html: ICONS[icon] + (label ? `<span>${label}</span>` : '') });
    this.fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
    this.fileInput.addEventListener('change', () => this.loadFile());

    const header = el(
      'header',
      { class: 'topbar' },
      el('div', { class: 'brand' }, el('span', { class: 'logo' }), el('span', { class: 'brand-name' }, 'Cube Creator')),
      this.nameInput,
      el(
        'div',
        { class: 'actions' },
        hbtn('undo', 'Undo (Ctrl+Z)', () => app.undo()),
        hbtn('redo', 'Redo (Ctrl+Shift+Z)', () => app.redo()),
        hbtn('dice', 'Surprise me – random cube', () => app.randomize(), 'Random'),
        hbtn('new', 'New design', () => app.newDesign()),
        hbtn('open', 'Open design (.json)', () => this.fileInput.click()),
        hbtn('save', 'Save design (.json)', () => app.saveDesign()),
        el('button', { class: 'btn primary export-btn', type: 'button', onClick: () => this.show('export'), html: ICONS.export + '<span>Export</span>' }),
      ),
      this.fileInput,
    );

    this.tabs = el('nav', { class: 'tabs' });
    for (const p of PANELS) {
      const t = el('button', { class: 'tab', type: 'button', 'data-id': p.id, title: p.label, html: `${ICONS[p.icon] || ''}<span>${p.label}</span>` });
      t.addEventListener('click', () => this.show(p.id));
      this.tabs.append(t);
    }
    this.panelHost = el('div', { class: 'panel' });
    const sidebar = el('aside', { class: 'sidebar' }, this.tabs, this.panelHost);

    this.viewport = el('main', { class: 'viewport' });
    this.counter = el('div', { class: 'counter' }, el('span', { class: 'count' }, '0'), el('span', { class: 'count-label' }, 'clicks'));
    this.hint = el('div', { class: 'hint' }, 'Drag to orbit · scroll to zoom · click the cube!');
    const vbtn = (icon, title, fn) => el('button', { class: 'vbtn', title, type: 'button', onClick: fn, html: ICONS[icon] });
    this.autoBtn = vbtn('rotate', 'Auto-rotate camera', () => app.store.set('scene.autoRotate', !app.store.get('scene.autoRotate')));
    const tools = el(
      'div',
      { class: 'view-tools' },
      vbtn('target', 'Reset camera', () => app.viewer.resetCamera()),
      this.autoBtn,
      vbtn('camera', 'Quick screenshot (PNG)', () => app.quickScreenshot()),
    );
    this.viewport.append(this.counter, this.hint, tools);
    this.toasts = el('div', { class: 'toasts' });

    root.append(header, el('div', { class: 'body' }, sidebar, this.viewport), this.toasts);
    this.show(this.active);
    this.sync();

    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input[type=text], input[type=number], input[type=search], textarea')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? app.redo() : app.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        app.redo();
      }
    });
  }

  show(id) {
    this.active = id;
    this.app.sculpt?.setEditing(id === 'sculpt');
    this.prefs.tab = id;
    savePrefs(this.prefs);
    this.tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.id === id));
    this.rerender();
  }

  /** Rebuild the active panel from the current state (keeps scroll position). */
  rerender() {
    const panel = PANELS.find((p) => p.id === this.active);
    const scroll = this.panelHost.scrollTop;
    this.panelHost.innerHTML = '';
    this.panelHost.append(el('h2', { class: 'panel-title' }, panel.label), panel.render(this.app));
    this.panelHost.scrollTop = scroll;
  }

  /** Reflect state in chrome (name, counter, toggles). */
  sync() {
    const s = this.app.store.get();
    if (document.activeElement !== this.nameInput) this.nameInput.value = s.name;
    this.counter.style.display = s.clicker.counter && s.clicker.enabled ? '' : 'none';
    this.autoBtn.classList.toggle('on', s.scene.autoRotate);
  }

  onStateChange(paths) {
    this.sync();
    if (paths.has('*')) this.rerender();
  }

  setCount(n) {
    this.counter.querySelector('.count').textContent = n.toLocaleString();
    this.counter.classList.remove('bump');
    void this.counter.offsetWidth;
    this.counter.classList.add('bump');
    this.hint.classList.add('hidden');
  }

  floatText(text, x, y) {
    if (!text) return;
    const f = el('div', { class: 'float-text', style: `left:${x}px; top:${y}px` }, text);
    this.viewport.append(f);
    setTimeout(() => f.remove(), 900);
  }

  toast(msg, kind = 'info') {
    const t = el('div', { class: `toast ${kind}` }, msg);
    this.toasts.append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  async loadFile() {
    const file = this.fileInput.files[0];
    this.fileInput.value = '';
    if (!file) return;
    try {
      this.app.loadDesign(JSON.parse(await file.text()));
      this.toast(`Loaded ${file.name}`);
    } catch (err) {
      this.toast(`Could not load file: ${err.message}`, 'error');
    }
  }
}

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem('cube-creator:prefs')) || {};
  } catch {
    return {};
  }
}
function savePrefs(p) {
  try {
    localStorage.setItem('cube-creator:prefs', JSON.stringify({ tab: p.tab, includeShape: p.includeShape }));
  } catch {
    /* optional */
  }
}
