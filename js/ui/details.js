// Step 1: Report details.

import { app, changed, on } from './app.js';
import { totalArea, fmt2 } from '../model.js';
import { h, icon } from './dom.js';

let totalEl = null;

const FIELDS = [
  { key: 'projectName', label: 'Project / Society name', placeholder: 'e.g. My Home Sayuk' },
  { key: 'unitNo', label: 'Unit No.', placeholder: 'e.g. T-10-1702' },
  { key: 'customerName', label: 'Customer name', placeholder: 'e.g. Mr. Ravi Kumar' },
  { key: 'propertyType', label: 'Property type', placeholder: 'e.g. 3 BHK', list: 'dl-proptypes', hint: 'Pick from the list or type your own.' },
  { key: 'inspectionDate', label: 'Inspection date', type: 'date' },
];

export function renderDetails(panel) {
  const d = app.report.details;
  const fields = FIELDS.map((f) => {
    const id = `f-${f.key}`;
    const input = h('input', {
      id,
      type: f.type || 'text',
      value: d[f.key] || '',
      placeholder: f.placeholder || null,
      list: f.list || null,
      autocomplete: 'off',
      oninput: (e) => { d[f.key] = e.target.value; changed('details'); },
    });
    return h('div', { class: 'field' },
      h('label', { for: id }, f.label),
      input,
      f.hint ? h('p', { class: 'hint' }, f.hint) : null);
  });

  totalEl = h('output', { id: 'f-totalArea', class: 'readonly-value' });
  const totalField = h('div', { class: 'field' },
    h('span', { class: 'label', id: 'lbl-total' }, 'Total area'),
    totalEl,
    h('p', { class: 'hint' }, 'Worked out from the rooms in ',
      h('button', { type: 'button', class: 'link', 'data-goto': 'dimensions' }, 'Spaces & Dimensions'), '.'));
  totalEl.setAttribute('aria-labelledby', 'lbl-total');

  panel.replaceChildren(
    h('div', { class: 'panel-head' },
      h('h2', { tabindex: '-1' }, 'Report details'),
      h('p', { class: 'panel-intro' }, 'These details appear on the cover page of the report.')),
    h('div', { class: 'card' }, h('div', { class: 'form-grid' }, ...fields, totalField)),
    h('div', { class: 'panel-foot' },
      h('span'),
      h('button', { type: 'button', class: 'btn btn-primary', 'data-goto': 'dimensions' }, 'Next: Spaces & Dimensions', icon('right'))),
  );
  updateTotal();
}

function updateTotal() {
  if (!totalEl || !app.report) return;
  const t = totalArea(app.report);
  totalEl.textContent = t > 0 ? `${fmt2(t)} sq ft` : '– (no room sizes entered yet)';
}

on('dimensions', updateTotal);
