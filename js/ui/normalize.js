// Makes a loaded / imported report safe to use: fills missing fields with
// defaults and fixes types, so older or hand-edited drafts never crash the UI.

import { createEmptyReport, newId, SCHEMA_VERSION } from '../model.js';

const SEVERITY_KEYS = ['major', 'minor', 'cosmetic'];

const str = (v) => (v === null || v === undefined ? '' : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const id = (v, prefix) => (typeof v === 'string' && v ? v : newId(prefix));

function ref(v) {
  if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !v.id) return null;
  return { id: v.id, w: Number(v.w) || 0, h: Number(v.h) || 0 };
}
const refs = (v) => arr(v).map(ref).filter(Boolean);

export function normalizeReport(raw) {
  const base = createEmptyReport();
  const r = obj(raw);

  const d = obj(r.details);
  const details = {};
  Object.keys(base.details).forEach((k) => { details[k] = k in d ? str(d[k]) : base.details[k]; });

  const dm = obj(r.dimensions);
  const dimensions = {
    ceilingHeight: str(dm.ceilingHeight),
    doorHeight: str(dm.doorHeight),
    spaces: arr(dm.spaces).map((s0) => {
      const s = obj(s0);
      const parts = arr(s.parts).map((p0) => {
        const p = obj(p0);
        return { id: id(p.id, 'part'), length: str(p.length), width: str(p.width), area: str(p.area) };
      });
      if (!parts.length) parts.push({ id: newId('part'), length: '', width: '', area: '' });
      return { id: id(s.id, 'space'), name: str(s.name), parts };
    }),
  };

  const w = obj(r.water);
  const water = {
    tds: str(w.tds),
    tdsNote: 'tdsNote' in w ? str(w.tdsNote) : base.water.tdsNote,
    tdsPhoto: ref(w.tdsPhoto),
    ph: str(w.ph),
    phNote: 'phNote' in w ? str(w.phNote) : base.water.phNote,
    phPhoto: ref(w.phPhoto),
    fittings: Array.isArray(w.fittings)
      ? w.fittings.map((f0) => { const f = obj(f0); return { id: id(f.id, 'fit'), item: str(f.item), brand: str(f.brand) }; })
      : base.water.fittings,
  };

  const rooms = arr(r.rooms).map((rm0) => {
    const rm = obj(rm0);
    return {
      id: id(rm.id, 'room'),
      name: str(rm.name),
      subtitle: str(rm.subtitle),
      spaceImages: refs(rm.spaceImages),
      observations: arr(rm.observations).map((o0) => {
        const o = obj(o0);
        return {
          id: id(o.id, 'obs'),
          photos: refs(o.photos),
          description: str(o.description),
          location: str(o.location),
          severity: SEVERITY_KEYS.includes(o.severity) ? o.severity : 'minor',
        };
      }),
    };
  });

  return { version: SCHEMA_VERSION, details, dimensions, water, rooms };
}

/** Removes references to photos that are not in `available` (Set of ids). Returns how many were removed. */
export function stripMissingImages(report, available) {
  let removed = 0;
  const keep = (ref) => {
    if (ref && available.has(ref.id)) return true;
    removed += 1;
    return false;
  };
  const w = report.water;
  if (w.tdsPhoto && !keep(w.tdsPhoto)) w.tdsPhoto = null;
  if (w.phPhoto && !keep(w.phPhoto)) w.phPhoto = null;
  report.rooms.forEach((room) => {
    room.spaceImages = room.spaceImages.filter(keep);
    room.observations.forEach((o) => { o.photos = o.photos.filter(keep); });
  });
  return removed;
}
