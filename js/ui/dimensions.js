// Step 2: Spaces & Dimensions.

import { app, changed } from './app.js';
import { createSpace, createPart, partArea, spaceArea, totalArea, fmt2, parseNum } from '../model.js';
import { h, icon, iconButton, reveal } from './dom.js';
import { toast } from './toast.js';

let listEl = null;
let emptyEl = null;
let grandEl = null;
const spaceCtx = new Map();

function numInput({ cls, value, label, placeholder, onInput, id }) {
  return h('input', {
    type: 'text',
    inputmode: 'decimal',
    id: id || null,
    class: `num-input ${cls}`,
    value: value ?? '',
    placeholder: placeholder || null,
    'aria-label': label,
    autocomplete: 'off',
    oninput: (e) => onInput(e.target.value),
  });
}

export function renderDimensions(panel) {
  const dims = app.report.dimensions;
  spaceCtx.clear();

  const heightField = (key, label) => {
    const id = `f-${key}`;
    return h('div', { class: 'field' },
      h('label', { for: id }, label),
      h('div', { class: 'input-unit' },
        numInput({ id, cls: 'height-input', value: dims[key], label: null, placeholder: 'e.g. 10', onInput: (v) => { dims[key] = v; changed('dimensions'); } }),
        h('span', { class: 'unit' }, 'ft')));
  };
  const heights = h('div', { class: 'card' },
    h('h3', { class: 'card-title' }, 'Heights'),
    h('div', { class: 'form-grid form-grid-2' }, heightField('ceilingHeight', 'Ceiling height'), heightField('doorHeight', 'Door height')));

  listEl = h('div', { class: 'spaces' });
  emptyEl = h('p', { class: 'obs-empty' }, 'No spaces yet. Add each room with its length and width in feet. L-shaped rooms can have more than one row.');
  grandEl = h('strong', { class: 'grand-total-value' });

  panel.replaceChildren(
    h('div', { class: 'panel-head' },
      h('h2', { tabindex: '-1' }, 'Spaces & Dimensions'),
      h('p', { class: 'panel-intro' }, 'Room sizes in feet. The area is worked out for you; type an exact area only if you want to override it.')),
    heights,
    h('div', { class: 'card' },
      h('h3', { class: 'card-title' }, 'Spaces'),
      h('div', { class: 'part-head', 'aria-hidden': 'true' },
        h('span', {}, 'Length (ft)'), h('span'), h('span', {}, 'Width (ft)'), h('span'),
        h('span', {}, 'Area (sq ft)'), h('span', {}, 'Exact area (optional)'), h('span')),
      emptyEl,
      listEl,
      h('div', { class: 'spaces-foot' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: addSpace }, icon('plus'), 'Add space'),
        h('p', { class: 'grand-total' }, 'Total area: ', grandEl, ' sq ft'))),
    h('div', { class: 'panel-foot' },
      h('button', { type: 'button', class: 'btn', 'data-goto': 'details' }, icon('left'), 'Back'),
      h('button', { type: 'button', class: 'btn btn-primary', 'data-goto': 'water' }, 'Next: Water & Fittings', icon('right'))),
  );
  syncSpaces();
}

function updateGrand() {
  if (grandEl) grandEl.textContent = fmt2(totalArea(app.report));
}

function syncSpaces() {
  const spaces = app.report.dimensions.spaces;
  const existing = new Map();
  listEl.querySelectorAll(':scope > .space').forEach((el) => existing.set(el.dataset.spaceId, el));
  spaces.forEach((space, i) => {
    let el = existing.get(space.id);
    if (el) existing.delete(space.id);
    else el = createSpaceEl(space);
    if (listEl.children[i] !== el) listEl.insertBefore(el, listEl.children[i] || null);
    spaceCtx.get(space.id).setIndex(i, spaces.length);
  });
  existing.forEach((el, id) => { el.remove(); spaceCtx.delete(id); });
  emptyEl.hidden = spaces.length > 0;
  updateGrand();
}

function addSpace() {
  const space = createSpace('');
  app.report.dimensions.spaces.push(space);
  syncSpaces();
  changed('dimensions');
  reveal(spaceCtx.get(space.id).nameInput);
}

function moveSpace(space, d, btn) {
  const list = app.report.dimensions.spaces;
  const i = list.indexOf(space);
  const j = i + d;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  syncSpaces();
  changed('dimensions');
  if (btn && !btn.disabled) btn.focus(); else spaceCtx.get(space.id)?.nameInput.focus();
}

function removeSpace(space) {
  const list = app.report.dimensions.spaces;
  const i = list.indexOf(space);
  if (i < 0) return;
  list.splice(i, 1);
  syncSpaces();
  changed('dimensions');
  toast(`Space “${space.name.trim() || 'unnamed'}” removed.`, {
    action: {
      label: 'Undo',
      run: () => {
        list.splice(Math.min(i, list.length), 0, space);
        syncSpaces();
        changed('dimensions');
      },
    },
  });
}

function createSpaceEl(space) {
  const el = h('div', { class: 'space', dataset: { spaceId: space.id } });
  const nameInput = h('input', {
    type: 'text',
    class: 'space-name',
    list: 'dl-rooms',
    value: space.name,
    placeholder: 'Space name, e.g. Living Room',
    'aria-label': 'Space name',
    autocomplete: 'off',
    oninput: (e) => { space.name = e.target.value; changed('dimensions'); },
  });
  const total = h('span', { class: 'space-total' });
  const upBtn = iconButton('up', 'Move space up', () => moveSpace(space, -1, upBtn));
  const downBtn = iconButton('down', 'Move space down', () => moveSpace(space, 1, downBtn));
  const delBtn = iconButton('trash', 'Remove space', () => removeSpace(space), 'danger');
  const partsEl = h('div', { class: 'parts' });
  const addRow = h('button', {
    type: 'button',
    class: 'btn btn-small btn-ghost',
    onclick: () => {
      const part = createPart();
      space.parts.push(part);
      syncParts();
      changed('dimensions');
      partsEl.querySelector(`[data-part-id="${CSS.escape(part.id)}"] .part-length`)?.focus();
    },
  }, icon('plus'), 'Add row (L×W)');

  function updateTotal() {
    total.textContent = `${fmt2(spaceArea(space))} sq ft`;
  }

  function syncParts() {
    partsEl.replaceChildren(...space.parts.map((part, i) => createPartRow(space, part, i, ctx)));
    updateTotal();
    updateGrand();
  }

  el.append(
    h('div', { class: 'space-head' }, nameInput, total, h('div', { class: 'space-actions' }, upBtn, downBtn, delBtn)),
    partsEl,
    addRow,
  );

  const ctx = {
    nameInput,
    updateTotal,
    syncParts,
    setIndex(i, n) {
      upBtn.disabled = i === 0;
      downBtn.disabled = i === n - 1;
    },
  };
  spaceCtx.set(space.id, ctx);
  syncParts();
  return el;
}

function createPartRow(space, part, index, ctx) {
  const row = h('div', { class: 'part', dataset: { partId: part.id } });
  const rowName = () => `${space.name.trim() || 'space'}${space.parts.length > 1 ? `, row ${index + 1}` : ''}`;
  const auto = h('output', { class: 'part-auto' });
  const area = numInput({
    cls: 'part-area',
    value: part.area,
    label: `Exact area in square feet for ${rowName()} (optional)`,
    onInput: (v) => { part.area = v; refresh(); },
  });
  const L = numInput({ cls: 'part-length', value: part.length, label: `Length in feet for ${rowName()}`, placeholder: 'Length', onInput: (v) => { part.length = v; refresh(); } });
  const W = numInput({ cls: 'part-width', value: part.width, label: `Width in feet for ${rowName()}`, placeholder: 'Width', onInput: (v) => { part.width = v; refresh(); } });
  const rm = iconButton('x', 'Remove this row', () => {
    const i = space.parts.indexOf(part);
    if (i < 0 || space.parts.length <= 1) return;
    space.parts.splice(i, 1);
    ctx.syncParts();
    changed('dimensions');
    const inputs = listEl.querySelectorAll(`[data-space-id="${CSS.escape(space.id)}"] .part-length`);
    if (inputs.length) inputs[Math.min(i, inputs.length - 1)].focus();
  }, 'part-remove');
  rm.disabled = space.parts.length <= 1;

  function show() {
    const autoVal = partArea({ ...part, area: '' });
    area.placeholder = Number.isNaN(autoVal) ? 'auto' : fmt2(autoVal);
    const eff = partArea(part);
    auto.textContent = Number.isNaN(eff) ? '–' : fmt2(eff);
    const manual = !Number.isNaN(parseNum(part.area));
    auto.classList.toggle('is-manual', manual);
    auto.title = manual ? 'Using the exact area you typed' : 'Length × width';
    const bad = (v) => String(v).trim() !== '' && Number.isNaN(parseNum(v));
    L.classList.toggle('invalid', bad(part.length));
    W.classList.toggle('invalid', bad(part.width));
    area.classList.toggle('invalid', bad(part.area));
  }
  function refresh() {
    show();
    ctx.updateTotal();
    updateGrand();
    changed('dimensions');
  }

  row.append(L, h('span', { class: 'op', 'aria-hidden': 'true' }, '×'), W, h('span', { class: 'op', 'aria-hidden': 'true' }, '='), auto, area, rm);
  show();
  return row;
}
