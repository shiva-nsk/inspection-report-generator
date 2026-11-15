// Side navigation between the five steps + "go to field" for the checks list.

import { app, emit, on, roomStats, reportStats } from './app.js';
import { h, reveal, plural } from './dom.js';
import { revealRoom } from './sections.js';
import { close as closeCombobox } from './combobox.js';
import { pad2 } from '../model.js';

export const PANELS = [
  { key: 'details', label: 'Report details' },
  { key: 'dimensions', label: 'Spaces & Dimensions' },
  { key: 'water', label: 'Water & Fittings' },
  { key: 'sections', label: 'Sections & Observations' },
  { key: 'generate', label: 'Preview & Generate' },
];

let navEl = null;
let roomsNavEl = null;
let current = null;

export function currentPanel() {
  return current;
}

export function panelEl(key) {
  return document.getElementById(`panel-${key}`);
}

export function initialPanel() {
  const key = (location.hash || '').replace('#', '');
  return PANELS.some((p) => p.key === key) ? key : 'details';
}

export function renderNav(el) {
  navEl = el;
  roomsNavEl = h('ol', { class: 'nav-rooms', 'aria-label': 'Sections' });
  const list = h('ol', { class: 'nav-steps' },
    PANELS.map((p, i) => h('li', {},
      h('button', {
        type: 'button',
        class: 'nav-item',
        dataset: { panel: p.key },
        onclick: () => showPanel(p.key, { focusHeading: true }),
      }, h('span', { class: 'nav-num', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'nav-label' }, p.label), h('span', { class: 'nav-badge' })),
      p.key === 'sections' ? roomsNavEl : null)));
  navEl.replaceChildren(list);
  updateRoomsNav();
  if (current) markCurrent();
}

function markCurrent() {
  navEl?.querySelectorAll('.nav-item').forEach((b) => {
    if (b.dataset.panel === current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
}

export function updateRoomsNav() {
  if (!roomsNavEl) return;
  const rooms = app.report.rooms;
  roomsNavEl.replaceChildren(...rooms.map((room, i) => {
    const s = roomStats(room);
    return h('li', {},
      h('button', {
        type: 'button',
        class: 'nav-room',
        title: `${room.name || 'Unnamed section'}: ${plural(s.observations, 'observation')}`,
        onclick: () => goTo({ panel: 'sections', roomId: room.id, selector: `[data-room-id="${CSS.escape(room.id)}"] .room-name`, block: 'start' }),
      },
      h('span', { class: 'nav-room-num' }, pad2(i + 1)),
      h('span', { class: 'nav-room-name' }, room.name.trim() || 'Unnamed section'),
      h('span', { class: 'nav-room-count', 'aria-label': plural(s.observations, 'observation') }, String(s.observations)),
      s.major ? h('span', { class: 'nav-room-major', title: `${s.major} major`, 'aria-label': `${s.major} major` }) : null));
  }));
  const t = reportStats(app.report);
  const badge = navEl?.querySelector('[data-panel="sections"] .nav-badge');
  if (badge) badge.textContent = t.observations ? String(t.observations) : '';
}

export function showPanel(key, { focusHeading = false, scroll = true } = {}) {
  if (!PANELS.some((p) => p.key === key)) key = 'details';
  closeCombobox();
  const changedPanel = current !== key;
  current = key;
  PANELS.forEach((p) => { const el = panelEl(p.key); if (el) el.hidden = p.key !== key; });
  markCurrent();
  if (location.hash !== `#${key}`) history.replaceState(null, '', `#${key}`);
  if (changedPanel && scroll) window.scrollTo({ top: 0 });
  if (focusHeading) panelEl(key)?.querySelector('h2')?.focus({ preventScroll: true });
  emit('panel', key);
}

/**
 * Go to a field: { panel, selector, roomId?, block? }.
 * Switches step, expands the section if needed, scrolls, focuses, flashes.
 */
export function goTo(loc) {
  showPanel(loc.panel, { scroll: false });
  if (loc.roomId) revealRoom(loc.roomId);
  requestAnimationFrame(() => {
    const el = loc.selector ? panelEl(loc.panel)?.querySelector(loc.selector) : null;
    if (el) reveal(el, { block: loc.block || 'center' });
  });
}

on('rooms', updateRoomsNav);
on('reload', updateRoomsNav);

// Buttons/links anywhere with data-goto="panelKey" switch step.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-goto]');
  if (btn) showPanel(btn.dataset.goto, { focusHeading: true });
});
