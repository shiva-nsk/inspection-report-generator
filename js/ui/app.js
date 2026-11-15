// The one in-memory report + a tiny event bus.
//
// Events:
//   'details'    report details changed (name in top bar, cover info)
//   'dimensions' spaces / areas changed (total area)
//   'rooms'      sections or observations changed (side nav, counts)
//   'change'     anything changed (fires after the specific events)
//   'reload'     the whole report was replaced (new / import) - re-render everything
//   'panel'      a different step was shown (data = panel key)

import { scheduleSave } from '../store.js';

export const app = {
  report: null,
  revision: 0, // bumps on every change; lets the PDF step reuse an up-to-date PDF
};

const listeners = new Map();

export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}

export function emit(evt, data) {
  const set = listeners.get(evt);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(data); } catch (err) { console.error(`Error in "${evt}" listener`, err); }
  }
}

/** Call after every model mutation: bumps revision, autosaves, notifies. */
export function changed(...events) {
  app.revision += 1;
  scheduleSave(app.report);
  events.forEach((e) => emit(e));
  emit('change');
}

export function roomStats(room) {
  const s = { observations: room.observations.length, major: 0, minor: 0, cosmetic: 0, photos: room.spaceImages.length };
  for (const o of room.observations) {
    if (s[o.severity] !== undefined) s[o.severity] += 1;
    s.photos += o.photos.length;
  }
  return s;
}

export function reportStats(report) {
  const t = { sections: report.rooms.length, observations: 0, major: 0, minor: 0, cosmetic: 0, photos: 0 };
  for (const r of report.rooms) {
    const s = roomStats(r);
    t.observations += s.observations;
    t.major += s.major;
    t.minor += s.minor;
    t.cosmetic += s.cosmetic;
    t.photos += s.photos;
  }
  if (report.water.tdsPhoto) t.photos += 1;
  if (report.water.phPhoto) t.photos += 1;
  return t;
}
