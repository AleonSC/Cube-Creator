/**
 * Schema -> DOM controls. Every panel and list item is rendered from param
 * schemas (core/schema.js), so new features get UI automatically.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c.nodeType ? c : document.createTextNode(c));
  return node;
}

const resolveOptions = (opts) => (typeof opts === 'function' ? opts() : opts || []).map((o) => (typeof o === 'object' ? o : { value: o, label: String(o).replace(/^\w/, (m) => m.toUpperCase()) }));

/**
 * @param schema   param schema
 * @param values   current values (object, will be kept in sync)
 * @param onChange (key, value) => void
 */
export function paramControls(schema, values, onChange) {
  const wrap = el('div', { class: 'controls' });
  const rows = [];
  const refresh = () => rows.forEach(({ row, def }) => (row.style.display = def.showIf && !def.showIf(values) ? 'none' : ''));
  for (const [key, def] of Object.entries(schema)) {
    const set = (v) => {
      values[key] = v;
      onChange(key, v);
      refresh();
    };
    const row = controlRow(def, values[key], set);
    rows.push({ row, def });
    wrap.append(row);
  }
  refresh();
  return wrap;
}

export function controlRow(def, value, set) {
  const label = el('label', { class: 'ctl-label', title: def.hint || null }, def.label || '');
  if (def.hint) label.append(el('span', { class: 'hint-dot', title: def.hint }, '?'));
  const row = el('div', { class: `ctl ctl-${def.type}` }, label);
  row.append(input(def, value, set));
  return row;
}

function input(def, value, set) {
  switch (def.type) {
    case 'range':
    case 'int': {
      const step = def.type === 'int' ? 1 : def.step ?? 0.01;
      const parse = (v) => (def.type === 'int' ? parseInt(v, 10) : parseFloat(v));
      const range = el('input', { type: 'range', min: def.min, max: def.max, step, value });
      const num = el('input', { type: 'number', min: def.min, max: def.max, step, value, class: 'num' });
      const fill = () => range.style.setProperty('--fill', `${((range.value - def.min) / (def.max - def.min)) * 100}%`);
      range.addEventListener('input', () => {
        num.value = range.value;
        fill();
        set(parse(range.value));
      });
      num.addEventListener('change', () => {
        let v = parse(num.value);
        if (Number.isNaN(v)) v = def.default ?? def.min;
        range.value = v;
        fill();
        set(v);
      });
      fill();
      return el('div', { class: 'range-wrap' }, range, num);
    }
    case 'color': {
      const picker = el('input', { type: 'color', value });
      const text = el('input', { type: 'text', value, class: 'hex', maxlength: 7, spellcheck: 'false' });
      picker.addEventListener('input', () => {
        text.value = picker.value;
        set(picker.value);
      });
      text.addEventListener('change', () => {
        const v = text.value.trim();
        if (/^#?[0-9a-f]{6}$/i.test(v)) {
          const hex = v.startsWith('#') ? v : `#${v}`;
          picker.value = hex;
          set(hex.toLowerCase());
        } else text.value = picker.value;
      });
      return el('div', { class: 'color-wrap' }, picker, text);
    }
    case 'bool': {
      const box = el('input', { type: 'checkbox' });
      box.checked = !!value;
      box.addEventListener('change', () => set(box.checked));
      return el('label', { class: 'switch' }, box, el('span', { class: 'slider' }));
    }
    case 'select': {
      const opts = resolveOptions(def.options);
      const sel = el('select');
      const groups = new Map();
      for (const o of opts) {
        const option = el('option', { value: o.value }, o.label);
        if (String(o.value) === String(value)) option.selected = true;
        if (o.group) {
          if (!groups.has(o.group)) {
            const g = el('optgroup', { label: o.group });
            groups.set(o.group, g);
            sel.append(g);
          }
          groups.get(o.group).append(option);
        } else sel.append(option);
      }
      sel.addEventListener('change', () => {
        const o = opts.find((x) => String(x.value) === sel.value);
        set(o ? o.value : sel.value);
      });
      return sel;
    }
    case 'seed': {
      const num = el('input', { type: 'number', value, class: 'num seed', step: 1 });
      num.addEventListener('change', () => set(parseInt(num.value, 10) || 0));
      const dice = el('button', { class: 'icon-btn', title: 'Random seed', type: 'button' }, '🎲');
      dice.addEventListener('click', () => {
        num.value = Math.floor(Math.random() * 99999);
        set(parseInt(num.value, 10));
      });
      return el('div', { class: 'seed-wrap' }, num, dice);
    }
    default: {
      const text = el('input', { type: 'text', value: value ?? '' });
      text.addEventListener('input', () => set(text.value));
      return text;
    }
  }
}

/** Collapsible titled section. */
export function section(title, body, { open = true, extra = null } = {}) {
  const details = el('details', { class: 'section', open });
  const summary = el('summary', {}, el('span', { class: 'section-title' }, title));
  if (extra) summary.append(extra);
  details.append(summary, el('div', { class: 'section-body' }, body));
  return details;
}

/** Bind a schema to a store path: values come from the store, edits write back. */
export function bound(store, path, schema, defaults = {}) {
  const current = store.get(path) || {};
  const values = { ...defaults, ...current };
  return paramControls(schema, values, (key, v) => store.set(path ? `${path}.${key}` : key, v));
}
