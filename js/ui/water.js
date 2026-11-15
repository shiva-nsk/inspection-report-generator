// Step 3: Water quality & fittings.

import { app, changed } from './app.js';
import { createFitting } from '../model.js';
import { h, icon, iconButton } from './dom.js';
import { singlePhoto } from './photos.js';
import { toast } from './toast.js';

let fitList = null;

export function renderWater(panel) {
  const w = app.report.water;

  const testBlock = ({ title, valueKey, noteKey, photoKey, unit, placeholder }) => {
    const valueId = `f-${valueKey}`;
    const noteId = `f-${noteKey}`;
    return h('div', { class: 'test-block' },
      h('h4', { class: 'test-title' }, title),
      h('div', { class: 'field' },
        h('label', { for: valueId }, `${title} value`),
        h('div', { class: 'input-unit' },
          h('input', {
            id: valueId,
            type: 'text',
            inputmode: 'decimal',
            class: 'num-input',
            value: w[valueKey],
            placeholder,
            autocomplete: 'off',
            oninput: (e) => { w[valueKey] = e.target.value; changed(); },
          }),
          unit ? h('span', { class: 'unit' }, unit) : null)),
      h('div', { class: 'field' },
        h('label', { for: noteId }, 'Note'),
        h('input', {
          id: noteId,
          type: 'text',
          value: w[noteKey],
          autocomplete: 'off',
          oninput: (e) => { w[noteKey] = e.target.value; changed(); },
        })),
      h('div', { class: 'field' },
        h('span', { class: 'label' }, `${title} photo`),
        singlePhoto({
          label: `${title} photo`,
          get: () => w[photoKey],
          set: (ref) => { w[photoKey] = ref; changed(); },
        })));
  };

  fitList = h('div', { class: 'fittings' });

  panel.replaceChildren(
    h('div', { class: 'panel-head' },
      h('h2', { tabindex: '-1' }, 'Water & Fittings'),
      h('p', { class: 'panel-intro' }, 'Water test readings with a photo of the meter, and the brands of the fittings installed.')),
    h('div', { class: 'card' },
      h('h3', { class: 'card-title' }, 'Water quality'),
      h('div', { class: 'test-grid' },
        testBlock({ title: 'TDS', valueKey: 'tds', noteKey: 'tdsNote', photoKey: 'tdsPhoto', unit: 'ppm', placeholder: 'e.g. 180' }),
        testBlock({ title: 'pH', valueKey: 'ph', noteKey: 'phNote', photoKey: 'phPhoto', unit: '', placeholder: 'e.g. 7.2' }))),
    h('div', { class: 'card' },
      h('h3', { class: 'card-title' }, 'Fittings & brands'),
      h('div', { class: 'fit-head', 'aria-hidden': 'true' }, h('span', {}, 'Item'), h('span', {}, 'Brand'), h('span')),
      fitList,
      h('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: addFitting }, icon('plus'), 'Add fitting')),
    h('div', { class: 'panel-foot' },
      h('button', { type: 'button', class: 'btn', 'data-goto': 'dimensions' }, icon('left'), 'Back'),
      h('button', { type: 'button', class: 'btn btn-primary', 'data-goto': 'sections' }, 'Next: Sections & Observations', icon('right'))),
  );
  renderFittings();
}

function renderFittings() {
  const fittings = app.report.water.fittings;
  fitList.replaceChildren(...fittings.map((fit, i) => h('div', { class: 'fit-row', dataset: { fitId: fit.id } },
    h('input', {
      type: 'text',
      class: 'fit-item',
      list: 'dl-fittings',
      value: fit.item,
      placeholder: 'e.g. Faucet',
      'aria-label': `Fitting ${i + 1} item`,
      autocomplete: 'off',
      oninput: (e) => { fit.item = e.target.value; changed(); },
    }),
    h('input', {
      type: 'text',
      class: 'fit-brand',
      value: fit.brand,
      placeholder: 'e.g. Jaquar',
      'aria-label': `Fitting ${i + 1} brand`,
      autocomplete: 'off',
      oninput: (e) => { fit.brand = e.target.value; changed(); },
    }),
    iconButton('x', `Remove fitting ${i + 1}`, () => removeFitting(fit), 'danger'))));
  if (!fittings.length) fitList.append(h('p', { class: 'obs-empty' }, 'No fittings listed.'));
}

function addFitting() {
  const fit = createFitting();
  app.report.water.fittings.push(fit);
  renderFittings();
  changed();
  fitList.querySelector(`[data-fit-id="${CSS.escape(fit.id)}"] .fit-item`)?.focus();
}

function removeFitting(fit) {
  const list = app.report.water.fittings;
  const i = list.indexOf(fit);
  if (i < 0) return;
  list.splice(i, 1);
  renderFittings();
  changed();
  const items = fitList.querySelectorAll('.fit-item');
  if (items.length) items[Math.min(i, items.length - 1)].focus();
  toast(`Fitting “${fit.item.trim() || 'unnamed'}” removed.`, {
    action: {
      label: 'Undo',
      run: () => {
        list.splice(Math.min(i, list.length), 0, fit);
        renderFittings();
        changed();
      },
    },
  });
}
