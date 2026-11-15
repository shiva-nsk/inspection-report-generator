// Step 4: Sections (rooms) and their observations - the main work area.

import { app, changed, roomStats, reportStats } from './app.js';
import { createRoom, createObservation, roomSubtitle, pad2 } from '../model.js';
import { ROOM_PRESETS, SEVERITIES } from '../presets.js';
import { h, icon, iconButton, plural, reveal } from './dom.js';
import { photoStrip, fileButton, makeDropZone, removeWithUndo } from './photos.js';
import { addImageFiles, discardImages, unobserveThumbs } from '../images.js';
import { combobox, close as closeCombobox } from './combobox.js';
import { confirmDialog } from './modal.js';
import { toast } from './toast.js';

const collapsed = new Set(); // room ids (UI only, not saved)
const roomCtx = new Map(); // room id -> card context
let listEl = null;
let emptyEl = null;
let quickEl = null;
let summaryEl = null;

export function renderSections(panel) {
  roomCtx.clear();
  summaryEl = h('p', { class: 'toolbar-summary' });
  listEl = h('div', { class: 'rooms' });
  emptyEl = h('div', { class: 'empty-state card card-soft' },
    h('p', { class: 'empty-title' }, 'No sections yet'),
    h('p', {}, 'A section is one room or area, like “Living Room” or “Kitchen”. Add your first one below.'));
  quickEl = h('div', { class: 'quick-add' });

  panel.replaceChildren(
    h('div', { class: 'panel-head' },
      h('h2', { id: 'h-sections', tabindex: '-1' }, 'Sections & Observations'),
      h('p', { class: 'panel-intro' }, 'Each section is one room or area. Add a few general photos of the space, then record every defect as an observation with its photo, description and severity.')),
    h('div', { class: 'toolbar' }, summaryEl,
      h('div', { class: 'toolbar-right' },
        h('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => setAllCollapsed(false) }, 'Expand all'),
        h('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => setAllCollapsed(true) }, 'Collapse all'))),
    emptyEl,
    listEl,
    h('div', { class: 'add-section card card-soft' },
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => addRoom('') }, icon('plus'), 'Add section'),
      quickEl),
    h('div', { class: 'panel-foot' },
      h('button', { type: 'button', class: 'btn', 'data-goto': 'water' }, icon('left'), 'Back'),
      h('button', { type: 'button', class: 'btn btn-primary', 'data-goto': 'generate' }, 'Next: Preview & Generate', icon('right'))),
  );
  syncRooms();
}

// ---------- list of rooms ----------

function syncRooms() {
  const rooms = app.report.rooms;
  const existing = new Map();
  listEl.querySelectorAll(':scope > .room').forEach((el) => existing.set(el.dataset.roomId, el));
  rooms.forEach((room, i) => {
    let el = existing.get(room.id);
    if (el) existing.delete(room.id);
    else el = createRoomCard(room);
    if (listEl.children[i] !== el) listEl.insertBefore(el, listEl.children[i] || null);
    roomCtx.get(room.id).setIndex(i, rooms.length);
  });
  existing.forEach((el, id) => {
    unobserveThumbs(el);
    el.remove();
    roomCtx.delete(id);
  });
  emptyEl.hidden = rooms.length > 0;
  updateSummary();
  updateQuickAdd();
}

function updateSummary() {
  if (!summaryEl) return;
  const t = reportStats(app.report);
  summaryEl.textContent = `${plural(t.sections, 'section')} · ${plural(t.observations, 'observation')} · ${t.major} major · ${t.minor} minor · ${t.cosmetic} cosmetic`;
}

function updateQuickAdd() {
  if (!quickEl) return;
  const used = new Set(app.report.rooms.map((r) => r.name.trim().toLowerCase()));
  const free = ROOM_PRESETS.filter((p) => !used.has(p.name.toLowerCase()));
  quickEl.replaceChildren();
  if (!free.length) return;
  quickEl.append(h('span', { class: 'quick-label' }, 'Quick add:'),
    ...free.map((p) => h('button', { type: 'button', class: 'chip-btn', onclick: () => addRoom(p.name) }, p.name)));
}

function addRoom(name) {
  const room = createRoom(name);
  app.report.rooms.push(room);
  syncRooms();
  changed('rooms');
  const ctx = roomCtx.get(room.id);
  if (!ctx) return;
  if (name) reveal(ctx.card.querySelector('.room-head'), { focus: false, block: 'start' });
  reveal(ctx.nameInput, { focus: true, block: 'start', flashEl: ctx.card.querySelector('.room-head') });
}

function moveRoom(room, d, btn) {
  const rooms = app.report.rooms;
  const i = rooms.indexOf(room);
  const j = i + d;
  if (i < 0 || j < 0 || j >= rooms.length) return;
  closeCombobox();
  [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
  syncRooms();
  changed('rooms');
  if (btn && !btn.disabled) btn.focus(); else roomCtx.get(room.id)?.nameInput.focus();
  roomCtx.get(room.id)?.card.querySelector('.room-head').scrollIntoView({ block: 'nearest' });
}

async function deleteRoom(room) {
  const s = roomStats(room);
  const name = room.name.trim() || 'this section';
  const details = [];
  if (s.observations) details.push(plural(s.observations, 'observation'));
  if (s.photos) details.push(plural(s.photos, 'photo'));
  const ok = await confirmDialog({
    title: `Delete “${name}”?`,
    message: details.length
      ? `This removes the section with its ${details.join(' and ')}. This cannot be undone.`
      : 'This removes the empty section.',
    confirmLabel: 'Delete section',
    danger: true,
  });
  if (!ok) return;
  const rooms = app.report.rooms;
  const i = rooms.indexOf(room);
  if (i < 0) return;
  closeCombobox();
  rooms.splice(i, 1);
  collapsed.delete(room.id);
  discardImages([...room.spaceImages.map((r) => r.id), ...room.observations.flatMap((o) => o.photos.map((p) => p.id))]);
  syncRooms();
  changed('rooms');
  toast(`Section “${name}” deleted.`);
  const next = rooms[Math.min(i, rooms.length - 1)];
  if (next) roomCtx.get(next.id)?.nameInput.focus({ preventScroll: true });
}

function setCollapsed(roomId, value) {
  if (value) collapsed.add(roomId); else collapsed.delete(roomId);
  roomCtx.get(roomId)?.applyCollapsed();
}

function setAllCollapsed(value) {
  closeCombobox();
  app.report.rooms.forEach((r) => setCollapsed(r.id, value));
}

// ---------- one room card ----------

function createRoomCard(room) {
  const bodyId = `room-body-${room.id}`;
  const card = h('section', { class: 'room card', dataset: { roomId: room.id } });

  const toggle = h('button', {
    type: 'button',
    class: 'icon-btn room-toggle',
    'aria-controls': bodyId,
    onclick: () => setCollapsed(room.id, !collapsed.has(room.id)),
  }, icon('chevDown'));
  const num = h('span', { class: 'room-num', 'aria-hidden': 'true' });
  const nameInput = h('input', {
    type: 'text',
    class: 'room-name',
    list: 'dl-rooms',
    value: room.name,
    placeholder: 'Section name, e.g. Living Room',
    'aria-label': 'Section name',
    autocomplete: 'off',
  });
  const counts = h('div', { class: 'room-counts' });
  const upBtn = iconButton('up', 'Move section up', () => moveRoom(room, -1, upBtn));
  const downBtn = iconButton('down', 'Move section down', () => moveRoom(room, 1, downBtn));
  const delBtn = iconButton('trash', 'Delete section', () => deleteRoom(room), 'danger');
  const head = h('header', { class: 'room-head' }, toggle, num, nameInput, counts, h('div', { class: 'room-actions' }, upBtn, downBtn, delBtn));

  // subtitle
  const subId = `sub-${room.id}`;
  const subtitle = h('input', {
    type: 'text',
    id: subId,
    class: 'room-subtitle',
    value: room.subtitle,
    autocomplete: 'off',
    oninput: (e) => { room.subtitle = e.target.value; changed(); },
  });
  const subtitleField = h('div', { class: 'field' },
    h('label', { for: subId }, 'Subtitle ', h('span', { class: 'optional' }, '(optional – leave empty to use the grey text)')),
    subtitle);

  // space images
  const spaceStrip = photoStrip({
    list: () => room.spaceImages,
    label: 'Space images',
    addLabel: 'Add photos',
    emptyText: 'General photos of the room (no defects). Add a few – you can select several at once.',
    caption: () => `${room.name || 'Section'} – space images`,
    onChange: () => { updateCounts(); changed('rooms'); },
  });
  const spaceBlock = h('div', { class: 'block' },
    h('h3', { class: 'block-title' }, 'Space images'),
    spaceStrip);

  // observations
  const obsList = h('ol', { class: 'obs-list', 'aria-label': 'Observations' });
  const obsEmpty = h('p', { class: 'obs-empty' }, 'No observations yet. The quickest way: click “Add observations from photos” and select all the defect photos for this room.');
  const obsBlock = h('div', { class: 'block obs-block' },
    h('div', { class: 'block-head' },
      h('h3', { class: 'block-title' }, 'Observations')),
    obsEmpty,
    obsList,
    h('div', { class: 'obs-actions' },
      fileButton({
        label: 'Add observations from photos',
        className: 'btn btn-primary',
        iconName: 'image',
        onFiles: (files) => bulkAdd(room, files),
      }),
      h('button', { type: 'button', class: 'btn', onclick: () => addObservation(room) }, icon('plus'), 'Add observation')),
    h('p', { class: 'hint' }, 'Tip: select many photos at once – one observation is created per photo. You can also drag photos from a folder and drop them here.'));
  makeDropZone(obsBlock, (files) => bulkAdd(room, files));

  const body = h('div', { class: 'room-body', id: bodyId }, subtitleField, spaceBlock, obsBlock);
  card.append(head, body);

  function updatePlaceholders() {
    subtitle.placeholder = roomSubtitle({ ...room, subtitle: '' });
    const locPh = room.name.trim() || 'Location';
    obsList.querySelectorAll('.obs-loc').forEach((el) => { el.placeholder = locPh; });
    card.setAttribute('aria-label', `Section: ${room.name.trim() || 'unnamed'}`);
  }

  function updateCounts() {
    const s = roomStats(room);
    const chips = [h('span', { class: 'count' }, plural(s.observations, 'observation'))];
    SEVERITIES.forEach(({ key }) => {
      if (s[key]) chips.push(h('span', { class: `chip chip-${key}` }, `${s[key]} ${key}`));
    });
    chips.push(h('span', { class: 'count count-photos' }, plural(s.photos, 'photo')));
    counts.replaceChildren(...chips);
    obsEmpty.hidden = s.observations > 0;
    updateSummary();
  }

  function applyCollapsed() {
    const isCollapsed = collapsed.has(room.id);
    card.classList.toggle('collapsed', isCollapsed);
    body.hidden = isCollapsed;
    toggle.setAttribute('aria-expanded', String(!isCollapsed));
    toggle.setAttribute('aria-label', isCollapsed ? 'Expand section' : 'Collapse section');
    toggle.title = isCollapsed ? 'Expand section' : 'Collapse section';
  }

  function syncObs() {
    const items = room.observations;
    const existing = new Map();
    obsList.querySelectorAll(':scope > .obs').forEach((el) => existing.set(el.dataset.obsId, el));
    items.forEach((obs, i) => {
      let el = existing.get(obs.id);
      if (el) existing.delete(obs.id);
      else el = createObsRow(room, obs, ctx);
      if (obsList.children[i] !== el) obsList.insertBefore(el, obsList.children[i] || null);
      el._setIndex(i, items.length);
    });
    existing.forEach((el) => { unobserveThumbs(el); el.remove(); });
    updateCounts();
  }

  nameInput.addEventListener('input', () => {
    room.name = nameInput.value;
    updatePlaceholders();
    updateQuickAdd();
    changed('rooms');
  });

  const ctx = {
    room,
    card,
    nameInput,
    obsList,
    updateCounts,
    syncObs,
    applyCollapsed,
    setIndex(i, n) {
      num.textContent = pad2(i + 1);
      upBtn.disabled = i === 0;
      downBtn.disabled = i === n - 1;
    },
  };
  roomCtx.set(room.id, ctx);
  updatePlaceholders();
  applyCollapsed();
  syncObs();
  return card;
}

// ---------- observations ----------

function isLive(room) {
  return app.report.rooms.includes(room) && roomCtx.has(room.id);
}

async function bulkAdd(room, files) {
  const refs = await addImageFiles(files, { label: 'Adding observations' });
  if (!refs.length) return;
  if (!isLive(room)) { discardImages(refs.map((r) => r.id)); return; }
  const start = room.observations.length;
  refs.forEach((ref) => room.observations.push(createObservation([ref])));
  const ctx = roomCtx.get(room.id);
  ctx.syncObs();
  changed('rooms');
  toast(`Added ${plural(refs.length, 'observation')} to ${room.name.trim() || 'this section'}. Now add a description to each.`, { type: 'success' });
  const first = room.observations[start];
  const ta = first && ctx.obsList.querySelector(`[data-obs-id="${CSS.escape(first.id)}"] textarea`);
  if (ta) reveal(ta, { block: 'center' });
}

function addObservation(room, index = room.observations.length, template = null) {
  const obs = createObservation([]);
  if (template) {
    obs.description = template.description;
    obs.severity = template.severity;
    obs.location = template.location;
  }
  room.observations.splice(index, 0, obs);
  const ctx = roomCtx.get(room.id);
  ctx.syncObs();
  changed('rooms');
  const ta = ctx.obsList.querySelector(`[data-obs-id="${CSS.escape(obs.id)}"] textarea`);
  if (ta) reveal(ta, { block: 'center' });
}

function moveObs(room, obs, d, btn) {
  const list = room.observations;
  const i = list.indexOf(obs);
  const j = i + d;
  if (i < 0 || j < 0 || j >= list.length) return;
  closeCombobox();
  [list[i], list[j]] = [list[j], list[i]];
  roomCtx.get(room.id).syncObs();
  changed('rooms');
  if (btn && !btn.disabled) btn.focus();
  btn?.closest('.obs')?.scrollIntoView({ block: 'nearest' });
}

function deleteObs(room, obs) {
  const list = room.observations;
  const i = list.indexOf(obs);
  if (i < 0) return;
  closeCombobox();
  list.splice(i, 1);
  const ctx = roomCtx.get(room.id);
  ctx.syncObs();
  changed('rooms');
  // keep keyboard focus nearby
  const rows = ctx.obsList.querySelectorAll('.obs');
  const near = rows[Math.min(i, rows.length - 1)];
  if (near) near.querySelector('.obs-delete')?.focus({ preventScroll: true });
  removeWithUndo(`Observation ${pad2(i + 1)} deleted.`, obs.photos.map((p) => p.id), () => {
    if (!isLive(room)) return;
    room.observations.splice(Math.min(i, room.observations.length), 0, obs);
    roomCtx.get(room.id).syncObs();
    changed('rooms');
  });
}

function severityControl(obs, onPick) {
  const name = `sev-${obs.id}`;
  return h('fieldset', { class: 'sev' },
    h('legend', {}, 'Severity'),
    h('div', { class: 'sev-opts' },
      SEVERITIES.map(({ key, label }) => h('label', { class: `sev-opt sev-opt-${key}` },
        h('input', { type: 'radio', name, value: key, checked: obs.severity === key, onchange: () => onPick(key) }),
        h('span', {}, label)))));
}

function createObsRow(room, obs, ctx) {
  const li = h('li', { class: `obs sev-${obs.severity}`, dataset: { obsId: obs.id } });
  const num = h('div', { class: 'obs-num', 'aria-hidden': 'true' });

  const strip = photoStrip({
    list: () => obs.photos,
    label: 'Observation photos',
    addLabel: 'Add photo',
    compact: true,
    caption: () => `${room.name || 'Section'} – observation ${num.textContent}`,
    onChange: () => { ctx.updateCounts(); changed('rooms'); },
  });

  const descId = `desc-${obs.id}`;
  const desc = combobox({
    id: descId,
    value: obs.description,
    placeholder: 'Type, or pick a common issue from the list',
    onInput: (v) => { obs.description = v; changed(); },
  });

  const locId = `loc-${obs.id}`;
  const loc = h('input', {
    type: 'text',
    id: locId,
    class: 'obs-loc',
    value: obs.location,
    placeholder: room.name.trim() || 'Location',
    autocomplete: 'off',
    oninput: (e) => { obs.location = e.target.value; changed(); },
  });

  const sev = severityControl(obs, (key) => {
    obs.severity = key;
    li.classList.remove('sev-major', 'sev-minor', 'sev-cosmetic');
    li.classList.add(`sev-${key}`);
    ctx.updateCounts();
    changed('rooms');
  });

  const upBtn = iconButton('up', 'Move observation up', () => moveObs(room, obs, -1, upBtn));
  const downBtn = iconButton('down', 'Move observation down', () => moveObs(room, obs, 1, downBtn));
  const dupBtn = iconButton('copy', 'Duplicate observation (text only, no photos)', () => {
    addObservation(room, room.observations.indexOf(obs) + 1, obs);
  });
  const delBtn = iconButton('trash', 'Delete observation', () => deleteObs(room, obs), 'danger obs-delete');

  li.append(
    num,
    h('div', { class: 'obs-photos' }, strip),
    h('div', { class: 'obs-fields' },
      h('div', { class: 'field obs-desc' }, h('label', { for: descId }, 'Description'), desc),
      h('div', { class: 'obs-row2' },
        h('div', { class: 'field obs-locfield' },
          h('label', { for: locId }, 'Location ', h('span', { class: 'optional' }, '(empty = section name)')),
          loc),
        sev)),
    h('div', { class: 'obs-tools' }, upBtn, downBtn, dupBtn, delBtn),
  );
  // (dropping photos on the strip adds them to this observation - handled by photoStrip)

  li._setIndex = (i, n) => {
    num.textContent = pad2(i + 1);
    li.setAttribute('aria-label', `Observation ${pad2(i + 1)}`);
    upBtn.disabled = i === 0;
    downBtn.disabled = i === n - 1;
  };
  return li;
}

// ---------- navigation helpers (used by the side nav and the checks list) ----------

/** Expand the section (if collapsed) so something inside it can be focused. */
export function revealRoom(roomId) {
  if (collapsed.has(roomId)) setCollapsed(roomId, false);
  return roomCtx.get(roomId)?.card || null;
}
