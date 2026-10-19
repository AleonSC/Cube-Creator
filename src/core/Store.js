import { clone } from './schema.js';

/**
 * Central design state. Everything that describes a cube lives here as plain
 * JSON so it can be saved, loaded, undone and exported.
 *
 *   store.get('material.color')
 *   store.set('material.color', '#ff0000')
 *   store.subscribe((paths) => ...)   // paths = Set of changed dot-paths
 */
export class Store {
  constructor(initial, { storageKey = null, historyLimit = 100 } = {}) {
    this.state = clone(initial);
    this.listeners = new Set();
    this.pending = new Set();
    this.flushQueued = false;
    this.storageKey = storageKey;
    this.undoStack = [];
    this.redoStack = [];
    this.historyLimit = historyLimit;
    this.lastSnapshot = JSON.stringify(this.state);
    this.historyTimer = null;
  }

  get(path) {
    if (!path) return this.state;
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this.state);
  }

  set(path, value, { silent = false } = {}) {
    const keys = path.split('.');
    let o = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
    if (!silent) this.changed(path);
  }

  /** Mutate via callback, then notify for `path`. Handy for list edits. */
  update(path, fn) {
    fn(this.get(path));
    this.changed(path);
  }

  /** Replace the whole design (load preset / file). */
  replace(next, { recordHistory = true } = {}) {
    if (recordHistory) this.commitHistory(true);
    this.state = clone(next);
    this.changed('*');
    if (recordHistory) this.lastSnapshot = JSON.stringify(this.state);
  }

  changed(path) {
    this.pending.add(path);
    this.scheduleHistory();
    if (this.flushQueued) return;
    this.flushQueued = true;
    queueMicrotask(() => {
      this.flushQueued = false;
      const paths = this.pending;
      this.pending = new Set();
      this.listeners.forEach((fn) => fn(paths));
      this.persist();
    });
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---- history -----------------------------------------------------------
  scheduleHistory() {
    clearTimeout(this.historyTimer);
    this.historyTimer = setTimeout(() => this.commitHistory(), 350);
  }

  commitHistory(force = false) {
    clearTimeout(this.historyTimer);
    const snap = JSON.stringify(this.state);
    if (!force && snap === this.lastSnapshot) return;
    if (snap === this.lastSnapshot) return;
    this.undoStack.push(this.lastSnapshot);
    if (this.undoStack.length > this.historyLimit) this.undoStack.shift();
    this.redoStack.length = 0;
    this.lastSnapshot = snap;
  }

  undo() {
    this.commitHistory();
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(this.lastSnapshot);
    this.restore(prev);
    return true;
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.lastSnapshot);
    this.restore(next);
    return true;
  }

  restore(snap) {
    clearTimeout(this.historyTimer);
    this.state = JSON.parse(snap);
    this.lastSnapshot = snap;
    this.changed('*');
    clearTimeout(this.historyTimer);
  }

  // ---- persistence -------------------------------------------------------
  persist() {
    if (!this.storageKey) return;
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      } catch {
        /* storage unavailable (private mode / quota) - autosave is optional */
      }
    }, 500);
  }

  static loadSaved(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
