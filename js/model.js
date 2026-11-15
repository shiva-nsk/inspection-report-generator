// Report data model + pure helpers. No DOM, no PDF code here, so it can be
// unit-tested in Node.
//
// Report shape (saved as JSON; photos are stored separately by id):
// {
//   version: 1,
//   details:    { projectName, unitNo, customerName, propertyType, inspectionDate /* YYYY-MM-DD */ },
//   dimensions: { ceilingHeight, doorHeight,
//                 spaces: [{ id, name, parts: [{ id, length, width, area /* '' = auto */ }] }] },
//   water:      { tds, tdsNote, tdsPhoto, ph, phNote, phPhoto, fittings: [{ id, item, brand }] },
//   rooms:      [{ id, name, subtitle /* '' = auto */, spaceImages: [ImageRef],
//                  observations: [{ id, photos: [ImageRef], description, location /* '' = room name */,
//                                   severity: 'major'|'minor'|'cosmetic' }] }]
// }
// ImageRef = { id, w, h }   (pixel size of the stored, already-resized JPEG)

import { ROOM_PRESETS, DEFAULT_FITTINGS } from './presets.js';

export const SCHEMA_VERSION = 1;

let counter = 0;
export function newId(prefix = 'id') {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function createEmptyReport() {
  return {
    version: SCHEMA_VERSION,
    details: {
      projectName: '',
      unitNo: '',
      customerName: '',
      propertyType: '',
      inspectionDate: todayIso(),
    },
    dimensions: { ceilingHeight: '', doorHeight: '', spaces: [] },
    water: {
      tds: '',
      tdsNote: 'Total dissolved solids in supply water',
      tdsPhoto: null,
      ph: '',
      phNote: 'Neutral range (6.5 – 8.5 acceptable)',
      phPhoto: null,
      fittings: DEFAULT_FITTINGS.map((item) => ({ id: newId('fit'), item, brand: '' })),
    },
    rooms: [],
  };
}

export function createSpace(name = '') {
  return { id: newId('space'), name, parts: [createPart()] };
}

export function createPart(length = '', width = '') {
  return { id: newId('part'), length, width, area: '' };
}

export function createRoom(name = '') {
  return { id: newId('room'), name, subtitle: '', spaceImages: [], observations: [] };
}

export function createObservation(photos = []) {
  return { id: newId('obs'), photos, description: '', location: '', severity: 'minor' };
}

export function createFitting(item = '', brand = '') {
  return { id: newId('fit'), item, brand };
}

// ---------- numbers ----------

export function parseNum(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(/,/g, '');
  if (s === '') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Area of one length x width row. Manual value wins when filled in. */
export function partArea(part) {
  const manual = parseNum(part.area);
  if (!Number.isNaN(manual)) return round2(manual);
  const l = parseNum(part.length);
  const w = parseNum(part.width);
  if (Number.isNaN(l) || Number.isNaN(w)) return NaN;
  return round2(l * w);
}

export function spaceArea(space) {
  return round2(space.parts.reduce((sum, p) => {
    const a = partArea(p);
    return Number.isNaN(a) ? sum : sum + a;
  }, 0));
}

export function totalArea(report) {
  return round2(report.dimensions.spaces.reduce((sum, s) => sum + spaceArea(s), 0));
}

export function fmt2(n) {
  return Number.isNaN(n) ? '' : n.toFixed(2);
}

// ---------- text ----------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** '2026-11-11' -> '11 November 2026' */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function todayIso(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Subtitle under a room title, e.g. "Space images and defects recorded in the living area." */
export function roomSubtitle(room) {
  if (room.subtitle && room.subtitle.trim()) return room.subtitle.trim();
  const name = (room.name || '').trim();
  const preset = ROOM_PRESETS.find((r) => r.name.toLowerCase() === name.toLowerCase());
  const area = preset ? preset.area : name.toLowerCase();
  return `Space images and defects recorded in the ${area}.`;
}

export function observationLocation(room, obs) {
  return (obs.location && obs.location.trim()) || (room.name || '').trim();
}

/** "3 BHK · T-10-1702" shown on the cover. */
export function coverPropertyLine(details) {
  return [details.propertyType, details.unitNo].map((s) => (s || '').trim()).filter(Boolean).join(' · ');
}

/** Suggested file name for the PDF. */
export function pdfFileName(details) {
  const parts = [details.projectName, details.unitNo, 'Inspection Report']
    .map((s) => (s || '').trim()).filter(Boolean);
  return `${parts.join(' - ').replace(/[\\/:*?"<>|]+/g, '-')}.pdf`;
}

// ---------- checks before generating ----------

/** Returns a list of human-readable problems. Empty list = ready. */
export function validateReport(report) {
  const problems = [];
  const d = report.details;
  if (!d.projectName.trim()) problems.push('Project name is empty.');
  if (!d.unitNo.trim()) problems.push('Unit number is empty.');
  if (!d.customerName.trim()) problems.push('Customer name is empty.');
  if (!d.inspectionDate) problems.push('Inspection date is empty.');
  report.dimensions.spaces.forEach((s, i) => {
    if (!s.name.trim()) problems.push(`Dimensions: space #${i + 1} has no name.`);
    s.parts.forEach((p) => {
      if (Number.isNaN(partArea(p))) problems.push(`Dimensions: "${s.name || `space #${i + 1}`}" has a row with missing length/width.`);
    });
  });
  report.rooms.forEach((r, i) => {
    const rn = r.name.trim() || `section #${i + 1}`;
    if (!r.name.trim()) problems.push(`Section #${i + 1} has no name.`);
    r.observations.forEach((o, j) => {
      if (!o.description.trim()) problems.push(`${rn}: observation ${pad2(j + 1)} has no description.`);
      if (!o.photos.length) problems.push(`${rn}: observation ${pad2(j + 1)} has no photo.`);
    });
  });
  return problems;
}

/** Every image id referenced by the report (used for export / cleanup). */
export function collectImageIds(report) {
  const ids = [];
  const add = (ref) => { if (ref && ref.id) ids.push(ref.id); };
  add(report.water.tdsPhoto);
  add(report.water.phPhoto);
  report.rooms.forEach((r) => {
    r.spaceImages.forEach(add);
    r.observations.forEach((o) => o.photos.forEach(add));
  });
  return ids;
}
