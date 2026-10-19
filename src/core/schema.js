/**
 * Param schemas drive both default values and auto-generated UI.
 *
 * Supported control types:
 *   range   { min, max, step }          number slider
 *   int     { min, max }                integer slider
 *   color   {}                          '#rrggbb'
 *   bool    {}                          checkbox
 *   select  { options: [..] }           options: ['a','b'] or [{value,label}]
 *   seed    {}                          integer with a dice button
 *   text    {}                          free text
 * Common: label, default, hint, showIf(params) -> bool
 */
export function defaultsFromSchema(schema = {}) {
  const out = {};
  for (const [key, def] of Object.entries(schema)) {
    out[key] = clone(def.default ?? fallbackDefault(def));
  }
  return out;
}

/** Fill in any missing keys in `values` using the schema defaults. */
export function withDefaults(schema = {}, values = {}) {
  return { ...defaultsFromSchema(schema), ...values };
}

function fallbackDefault(def) {
  switch (def.type) {
    case 'range':
    case 'int':
      return def.min ?? 0;
    case 'color':
      return '#ffffff';
    case 'bool':
      return false;
    case 'select': {
      const o = def.options?.[0];
      return typeof o === 'object' ? o.value : o;
    }
    case 'seed':
      return 1;
    default:
      return '';
  }
}

export function clone(v) {
  return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
}
