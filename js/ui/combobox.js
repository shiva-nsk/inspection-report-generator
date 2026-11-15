// Description field: free text + searchable list of common issues.
//
// One shared suggestion list is moved into whichever field is active, so 150+
// observations don't create 150 dropdowns.

import { OBSERVATION_PRESETS } from '../presets.js';
import { app } from './app.js';
import { h, icon } from './dom.js';

const POPUP_ID = 'combo-popup';
const supportsFieldSizing = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content');

let popup = null;
let state = null; // { box, items: string[], active: number, full: boolean }

function getPopup() {
  if (!popup) {
    popup = h('ul', { id: POPUP_ID, class: 'combo-pop', role: 'listbox', 'aria-label': 'Suggested descriptions', hidden: true });
    // keep focus in the text field while clicking the list
    popup.addEventListener('mousedown', (e) => e.preventDefault());
    popup.addEventListener('click', (e) => {
      const li = e.target.closest('[role="option"]');
      if (li && state) pick(Number(li.dataset.index));
    });
    document.body.append(popup);
  }
  return popup;
}

/** Descriptions already typed in this report, most used first (deduped, case-insensitive). */
export function usedDescriptions(exclude = '') {
  const seen = new Map();
  for (const room of app.report.rooms) {
    for (const o of room.observations) {
      const text = (o.description || '').trim();
      if (!text) continue;
      const key = text.toLowerCase();
      const entry = seen.get(key);
      if (entry) entry.n += 1; else seen.set(key, { text, n: 1 });
    }
  }
  const ex = exclude.trim().toLowerCase();
  return [...seen.entries()]
    .filter(([key]) => key !== ex)
    .sort((a, b) => b[1].n - a[1].n)
    .map(([, v]) => v.text);
}

export function autosize(ta) {
  if (supportsFieldSizing) return;
  if (!ta.isConnected) return;
  ta.style.height = 'auto';
  if (ta.scrollHeight) ta.style.height = `${ta.scrollHeight + 2}px`;
}

function appendHighlighted(el, text, q) {
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) { el.textContent = text; return; }
  el.append(text.slice(0, i), h('mark', {}, text.slice(i, i + q.length)), text.slice(i + q.length));
}

function open(box, full) {
  const q = full ? '' : box.ta.value.trim().toLowerCase();
  const match = (s) => !q || s.toLowerCase().includes(q);
  const usedAll = usedDescriptions(box.ta.value);
  const usedKeys = new Set(usedAll.map((s) => s.toLowerCase()));
  const used = usedAll.filter(match);
  const presets = OBSERVATION_PRESETS.filter((s) => !usedKeys.has(s.toLowerCase()) && match(s));
  const items = [...used, ...presets];
  const current = box.ta.value.trim().toLowerCase();
  if (!items.length || (!full && items.length === 1 && items[0].toLowerCase() === current)) {
    close();
    return;
  }
  const p = getPopup();
  p.replaceChildren();
  let index = 0;
  const addGroup = (title, list) => {
    if (!list.length) return;
    p.append(h('li', { class: 'combo-group', role: 'presentation' }, title));
    for (const text of list) {
      const li = h('li', { role: 'option', id: `combo-opt-${index}`, class: 'combo-opt', 'aria-selected': 'false', dataset: { index: String(index) } });
      appendHighlighted(li, text, q);
      p.append(li);
      index += 1;
    }
  };
  addGroup('Used in this report', used);
  addGroup(q ? 'Matching common issues' : 'Common issues', presets);

  if (state && state.box !== box) close();
  state = { box, items, active: -1, full };
  box.wrap.append(p);
  p.hidden = false;
  p.scrollTop = 0;
  box.ta.setAttribute('aria-expanded', 'true');
  box.wrap.classList.add('is-open');
  // open upwards if there's no room below
  const rect = box.wrap.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom;
  p.classList.toggle('up', below < 260 && rect.top > below);
}

export function close() {
  if (!state) return;
  const { box } = state;
  box.ta.setAttribute('aria-expanded', 'false');
  box.ta.removeAttribute('aria-activedescendant');
  box.wrap.classList.remove('is-open');
  state = null;
  if (popup) {
    popup.hidden = true;
    document.body.append(popup);
  }
}

function setActive(i) {
  if (!state) return;
  const n = state.items.length;
  const next = Math.max(-1, Math.min(n - 1, i));
  const p = getPopup();
  const prev = p.querySelector('.combo-opt.active');
  if (prev) { prev.classList.remove('active'); prev.setAttribute('aria-selected', 'false'); }
  state.active = next;
  if (next < 0) { state.box.ta.removeAttribute('aria-activedescendant'); return; }
  const li = p.querySelector(`#combo-opt-${next}`);
  if (li) {
    li.classList.add('active');
    li.setAttribute('aria-selected', 'true');
    li.scrollIntoView({ block: 'nearest' });
    state.box.ta.setAttribute('aria-activedescendant', li.id);
  }
}

function pick(i) {
  if (!state) return;
  const text = state.items[i];
  const { box } = state;
  close();
  if (text === undefined) return;
  box.ta.value = text;
  box.onInput(text);
  autosize(box.ta);
  box.ta.focus();
  box.ta.setSelectionRange(text.length, text.length);
}

function onKey(box, e) {
  const isOpen = !!state && state.box === box;
  if (!isOpen) {
    if (e.key === 'ArrowDown' && (e.altKey || box.ta.selectionStart === box.ta.value.length)) {
      e.preventDefault();
      open(box, e.altKey || !box.ta.value.trim());
      if (state && !e.altKey) setActive(0);
    }
    return;
  }
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setActive(state.active + 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      setActive(state.active - 1);
      break;
    case 'PageDown':
      e.preventDefault();
      setActive(state.active + 8);
      break;
    case 'PageUp':
      e.preventDefault();
      setActive(state.active - 8);
      break;
    case 'Enter':
      if (state.active >= 0) {
        e.preventDefault();
        pick(state.active);
      } else {
        close();
      }
      break;
    case 'Escape':
      e.preventDefault();
      e.stopPropagation();
      close();
      break;
    case 'Tab':
      close();
      break;
    default:
  }
}

/**
 * combobox({ id, value, placeholder, onInput }) -> wrapper element.
 * The <textarea> inside has the given id (for the <label for>).
 */
export function combobox({ id, value = '', placeholder = '', onInput }) {
  const ta = h('textarea', {
    id,
    class: 'combo-input',
    rows: supportsFieldSizing ? '1' : '2',
    placeholder,
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': POPUP_ID,
    'aria-haspopup': 'listbox',
    autocomplete: 'off',
  });
  ta.value = value;
  const btn = h('button', {
    type: 'button',
    class: 'combo-toggle',
    tabindex: '-1',
    'aria-label': 'Show list of common issues',
    title: 'Show list of common issues',
  }, icon('chevDown'));
  const wrap = h('div', { class: 'combo' }, ta, btn);
  const box = { wrap, ta, onInput };

  ta.addEventListener('input', () => {
    onInput(ta.value);
    autosize(ta);
    open(box, false);
  });
  ta.addEventListener('keydown', (e) => onKey(box, e));
  ta.addEventListener('blur', () => { if (state && state.box === box) close(); });
  if (!supportsFieldSizing) ta.addEventListener('focus', () => autosize(ta));
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => {
    if (state && state.box === box && state.full) { close(); return; }
    ta.focus();
    open(box, true);
  });
  return wrap;
}
