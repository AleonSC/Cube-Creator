/**
 * Generic plugin registry. Every extensible feature (shapes, modifiers,
 * surface patterns, presets, effects, particle presets, exporters) is a
 * Registry instance. Adding a feature = register one descriptor object.
 *
 * Descriptor shape (common fields):
 *   id       unique string key, stored in saved designs
 *   label    human readable name
 *   category optional grouping for UI
 *   params   optional param schema (see core/schema.js)
 */
export class Registry {
  constructor(name) {
    this.name = name;
    this.items = new Map();
    this.listeners = new Set();
  }

  register(descriptor) {
    if (!descriptor || !descriptor.id) throw new Error(`[${this.name}] descriptor needs an id`);
    if (this.items.has(descriptor.id)) console.warn(`[${this.name}] overriding "${descriptor.id}"`);
    this.items.set(descriptor.id, descriptor);
    this.listeners.forEach((fn) => fn(descriptor));
    return descriptor;
  }

  registerAll(list) {
    list.forEach((d) => this.register(d));
  }

  get(id) {
    return this.items.get(id);
  }

  has(id) {
    return this.items.has(id);
  }

  list() {
    return [...this.items.values()];
  }

  /** [{value, label, group}] for select controls */
  options() {
    return this.list().map((d) => ({ value: d.id, label: d.label || d.id, group: d.category }));
  }

  onRegister(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
